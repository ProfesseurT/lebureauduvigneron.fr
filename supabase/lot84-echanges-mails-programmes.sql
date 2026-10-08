-- ============================================================================
-- LOT 84, 08/10/2026 : QUI A EU L'ECHANGE, ET LES MAILS PROGRAMMES. APRES LE LOT 83.
-- ============================================================================
-- Demande de Ted sur la page d'une affaire : « on augmente la note d'echange avec date et
-- personne », « on permet aussi de programmer un email ». Arbitrages du 08/10/2026 :
--   - la personne, c'est QUI CHEZ NOUS a eu l'echange (un membre du bureau, moi par defaut) ;
--   - un mail programme PART TOUT SEUL, depuis la boite branchee de celui qui l'a programme
--     (lot 77), a la date et a l'heure choisies.
--
-- 1. `echanges.fait_par` et `affaire_echanges.fait_par` : le membre qui a eu l'echange.
--    `cree_par` reste celui qui l'a NOTE (la base signe). Un membre seulement.
-- 2. `affaire_echanges.fait_le` : la date de l'echange quand on le note apres coup. `le`
--    reste l'heure de l'ecriture, posee par la base. (`echanges.le`, lui, a toujours ete
--    la date de l'echange, posee par le navigateur.) Jamais dans le futur.
-- 3. `mails_programmes` : un mail pret, qui attend son heure. Personne n'y ecrit en direct :
--    `mail_programmer()` (verifie la boite, l'heure, l'adresse), `mail_annuler()`,
--    `mail_retirer()`. La fonction `mails-programmes` (cle de service, toutes les 5 min)
--    prend ceux dont l'heure est passee (`mails_a_partir`), les envoie, et dit le resultat
--    (`mail_resultat`) : parti, il entre dans le journal de l'affaire et pose son rappel.
--    UN MAIL NE PART QU'UNE FOIS : il passe a « envoi » sous verrou avant d'etre envoye ;
--    bloque plus de 15 min dans cet etat, il devient « incertain », JAMAIS renvoye.
-- 4. L'opposition annule les mails prevus et efface leur contenu.
-- 5. L'horloge `mails-programmes`, toutes les 5 minutes.
-- REJOUABLE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 et 2. Qui a eu l'echange, et quand
-- ---------------------------------------------------------------------------
alter table public.echanges add column if not exists fait_par uuid references auth.users(id) on delete set null;
alter table public.affaire_echanges add column if not exists fait_par uuid references auth.users(id) on delete set null;
alter table public.affaire_echanges add column if not exists fait_le timestamptz;

create or replace function public.echange_fait_verifier()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.fait_par is not null and not exists
     (select 1 from public.membres m where m.bureau = new.bureau and m.personne = new.fait_par) then
    raise exception 'cette personne n''est pas du bureau' using errcode = '23514';
  end if;
  if tg_table_name = 'echanges' then
    if new.le > now() + interval '1 day' then
      raise exception 'un echange ne se note pas dans le futur' using errcode = '23514';
    end if;
  elsif new.fait_le is not null and (new.fait_le > now() + interval '1 hour' or new.fait_le < now() - interval '2 years') then
    raise exception 'la date de l''echange est hors des bornes' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.echange_fait_verifier() from public, anon, authenticated;

drop trigger if exists echanges_fait_verifier on public.echanges;
create trigger echanges_fait_verifier before insert or update of fait_par, le on public.echanges
  for each row execute function public.echange_fait_verifier();
drop trigger if exists affaire_echanges_fait_verifier on public.affaire_echanges;
create trigger affaire_echanges_fait_verifier before insert on public.affaire_echanges
  for each row execute function public.echange_fait_verifier();

-- ---------------------------------------------------------------------------
-- 3. Les mails programmes
-- ---------------------------------------------------------------------------
create table if not exists public.mails_programmes (
  bureau        uuid not null references public.bureaux(bureau) on delete cascade,
  mail_id       uuid not null default gen_random_uuid(),
  affaire_id    uuid not null,
  personne      uuid not null references auth.users(id) on delete cascade,
  destinataire  text check (destinataire is null or char_length(destinataire) <= 320),
  sujet         text check (sujet is null or char_length(sujet) <= 300),
  corps         text check (corps is null or char_length(corps) <= 20000),
  modele        text check (modele is null or modele ~ '^[a-z_]{1,40}$'),
  partir_le     timestamptz not null,
  rappel        date,
  rappel_titre  text check (rappel_titre is null or char_length(rappel_titre) <= 120),
  statut        text not null default 'prevu'
                check (statut in ('prevu', 'envoi', 'parti', 'echec', 'incertain', 'annule')),
  echec         text check (echec is null or char_length(echec) <= 300),
  cree_le       timestamptz not null default now(),
  envoi_le      timestamptz,
  fini_le       timestamptz,
  primary key (bureau, mail_id),
  constraint mails_programmes_affaire_fk foreign key (bureau, affaire_id)
    references public.affaires(bureau, affaire_id) on delete cascade
);
create index if not exists mails_programmes_affaire on public.mails_programmes (bureau, affaire_id);
create index if not exists mails_programmes_a_partir on public.mails_programmes (partir_le) where statut = 'prevu';

alter table public.mails_programmes enable row level security;
drop policy if exists mails_programmes_lire on public.mails_programmes;
create policy mails_programmes_lire on public.mails_programmes for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
revoke all on public.mails_programmes from anon, authenticated;
grant select on public.mails_programmes to authenticated;

-- La meme forme d'adresse que la fonction `boite` : celle qu'on controle est celle qui part.
create or replace function public.mail_programmer(p_bureau uuid, p_affaire uuid, p_destinataire text,
  p_sujet text, p_corps text, p_modele text, p_partir_le timestamptz, p_rappel date default null, p_rappel_titre text default null)
returns public.mails_programmes
language plpgsql security definer set search_path = '' as $$
declare moi uuid := auth.uid(); r public.mails_programmes; d text := btrim(coalesce(p_destinataire, ''));
begin
  if moi is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  if not exists (select 1 from public.boites b where b.bureau = p_bureau and b.personne = moi
                  and b.etat = 'branchee' and b.utiliser) then
    raise exception 'branche ta boite pour programmer un mail' using errcode = '23514';
  end if;
  if not exists (select 1 from public.affaires a where a.bureau = p_bureau and a.affaire_id = p_affaire) then
    raise exception 'affaire inconnue' using errcode = '23503';
  end if;
  if exists (select 1 from public.affaires a join public.pistes p on p.bureau = a.bureau and p.piste_id = a.piste_id
              where a.bureau = p_bureau and a.affaire_id = p_affaire and p.opposition) then
    raise exception 'cette personne a demande a ne plus etre contactee' using errcode = '42501';
  end if;
  if d !~ '^[^@\s()<>,;:"\[\]\\]+@[^@\s()<>,;:"\[\]\\]+\.[^@\s()<>,;:"\[\]\\]+$' or char_length(d) > 320 then
    raise exception 'adresse du destinataire illisible' using errcode = '23514';
  end if;
  if char_length(btrim(coalesce(p_sujet, ''))) = 0 and char_length(btrim(coalesce(p_corps, ''))) = 0 then
    raise exception 'un mail sans objet ni texte ne se programme pas' using errcode = '23514';
  end if;
  if p_partir_le is null or p_partir_le < now() + interval '5 minutes' or p_partir_le > now() + interval '60 days' then
    raise exception 'l''heure d''envoi doit etre dans 5 minutes a 60 jours' using errcode = '23514';
  end if;
  if (select count(*) from public.mails_programmes m where m.personne = moi and m.statut = 'prevu') >= 50 then
    raise exception 'tu as deja 50 mails programmes' using errcode = '23514';
  end if;
  insert into public.mails_programmes (bureau, affaire_id, personne, destinataire, sujet, corps, modele, partir_le, rappel, rappel_titre)
  values (p_bureau, p_affaire, moi, d, nullif(left(btrim(coalesce(p_sujet, '')), 300), ''), nullif(left(coalesce(p_corps, ''), 20000), ''),
          nullif(p_modele, ''), p_partir_le, p_rappel, nullif(left(btrim(coalesce(p_rappel_titre, '')), 120), ''))
  returning * into r;
  return r;
end $$;
revoke all on function public.mail_programmer(uuid, uuid, text, text, text, text, timestamptz, date, text) from public, anon, authenticated;
grant execute on function public.mail_programmer(uuid, uuid, text, text, text, text, timestamptz, date, text) to authenticated;

-- Annuler : celui qui l'a programme (c'est sa boite), ou le maitre du bureau. Seulement
-- un mail qui attend : un mail en cours d'envoi est verrouille par l'horloge, on attend.
create or replace function public.mail_annuler(p_bureau uuid, p_mail uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare m public.mails_programmes;
begin
  if auth.uid() is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  select * into m from public.mails_programmes x where x.bureau = p_bureau and x.mail_id = p_mail for update;
  if not found then raise exception 'mail inconnu' using errcode = '23503'; end if;
  if m.personne <> auth.uid() and not public.est_maitre(p_bureau) then
    raise exception 'seul celui qui l''a programme l''annule' using errcode = '42501';
  end if;
  if m.statut <> 'prevu' then return false; end if;
  update public.mails_programmes set statut = 'annule', fini_le = now()
   where bureau = p_bureau and mail_id = p_mail;
  return true;
end $$;
revoke all on function public.mail_annuler(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mail_annuler(uuid, uuid) to authenticated;

-- Retirer de l'ecran un mail qui n'attend plus (pas parti, incertain, annule, parti).
create or replace function public.mail_retirer(p_bureau uuid, p_mail uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  delete from public.mails_programmes
   where bureau = p_bureau and mail_id = p_mail and statut in ('echec', 'incertain', 'annule', 'parti')
     and (personne = auth.uid() or public.est_maitre(p_bureau));
  return found;
end $$;
revoke all on function public.mail_retirer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mail_retirer(uuid, uuid) to authenticated;

-- L'HORLOGE PREND CE QUI DOIT PARTIR. Cle de service seule.
create or replace function public.mails_a_partir(p_max integer default 20)
returns table (bureau uuid, mail_id uuid, personne uuid, destinataire text, sujet text, corps text)
language plpgsql security definer set search_path = '' as $$
begin
  -- Bloque en « envoi » : la fonction est tombee pendant l'envoi. Peut-etre parti : jamais renvoye.
  update public.mails_programmes set statut = 'incertain', fini_le = now()
   where statut = 'envoi' and envoi_le < now() - interval '15 minutes';
  -- Ce qui est fini depuis 30 jours s'en va, echec compris : c'est ce que dit la page rgpd
  -- (le mail parti est dans le journal de l'affaire).
  delete from public.mails_programmes where statut in ('parti', 'annule', 'echec', 'incertain') and fini_le < now() - interval '30 days';
  -- Personne qui a demande a ne plus etre contactee : rien ne part.
  update public.mails_programmes m set statut = 'annule', fini_le = now(), echec = 'Cette personne a demandé à ne plus être contactée.',
         destinataire = null, sujet = null, corps = null
    from public.affaires a join public.pistes p on p.bureau = a.bureau and p.piste_id = a.piste_id
   where m.statut = 'prevu' and a.bureau = m.bureau and a.affaire_id = m.affaire_id and p.opposition;
  return query
    with pris as (
      select x.bureau, x.mail_id from public.mails_programmes x
       where x.statut = 'prevu' and x.partir_le <= now()
       order by x.partir_le
       limit greatest(1, least(coalesce(p_max, 20), 50))
       for update skip locked
    )
    update public.mails_programmes m set statut = 'envoi', envoi_le = now()
      from pris where m.bureau = pris.bureau and m.mail_id = pris.mail_id
    returning m.bureau, m.mail_id, m.personne, m.destinataire, m.sujet, m.corps;
end $$;
revoke all on function public.mails_a_partir(integer) from public, anon, authenticated;
grant execute on function public.mails_a_partir(integer) to service_role;

-- LE RESULTAT. Parti : le journal de l'affaire, signe par celui qui l'a programme, et le
-- rappel s'il en avait un. Un mail pas en « envoi » ne bouge pas (rien ne se dit deux fois).
create or replace function public.mail_resultat(p_bureau uuid, p_mail uuid, p_resultat text, p_echec text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare m public.mails_programmes;
begin
  if p_resultat not in ('parti', 'echec', 'incertain') then
    raise exception 'resultat inconnu' using errcode = '22023';
  end if;
  select * into m from public.mails_programmes x where x.bureau = p_bureau and x.mail_id = p_mail for update;
  if not found or m.statut <> 'envoi' then return false; end if;
  update public.mails_programmes set statut = p_resultat, fini_le = now(),
         echec = case when p_resultat = 'parti' then null else left(nullif(btrim(p_echec), ''), 300) end
   where bureau = p_bureau and mail_id = p_mail;
  if p_resultat = 'parti' then
    begin
      insert into public.affaire_echanges (bureau, affaire_id, type, modele, destinataire, sujet, corps, cree_par)
      values (m.bureau, m.affaire_id, 'email', m.modele, m.destinataire, m.sujet, m.corps, m.personne);
    exception when others then null;  -- l'envoi est fait : un journal refuse ne le defait pas
    end;
    if m.rappel is not null then
      update public.affaires set rappel = m.rappel, rappel_titre = m.rappel_titre, maj_par = m.personne
       where bureau = m.bureau and affaire_id = m.affaire_id and issue = 'en_cours';
    end if;
  end if;
  return true;
end $$;
revoke all on function public.mail_resultat(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.mail_resultat(uuid, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. L'opposition : plus rien ne part, et le contenu s'efface
-- ---------------------------------------------------------------------------
create or replace function public.pistes_opposition_mails()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.opposition and not coalesce(old.opposition, false) then
    update public.mails_programmes m
       set statut = case when m.statut = 'prevu' then 'annule' else m.statut end,
           fini_le = case when m.statut = 'prevu' then now() else m.fini_le end,
           destinataire = null, sujet = null, corps = null
      from public.affaires a
     where a.bureau = new.bureau and a.piste_id = new.piste_id
       and m.bureau = a.bureau and m.affaire_id = a.affaire_id;
  end if;
  return null;
end $$;
revoke all on function public.pistes_opposition_mails() from public, anon, authenticated;
drop trigger if exists pistes_opposition_mails on public.pistes;
create trigger pistes_opposition_mails after update of opposition on public.pistes
  for each row execute function public.pistes_opposition_mails();

-- ---------------------------------------------------------------------------
-- 5. L'horloge : toutes les 5 minutes, la fonction `mails-programmes`, avec l'adresse et
--    la cle deja rangees dans `notif_reglage` (lot 57). Pour l'arreter :
--    select cron.unschedule('mails-programmes');
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('mails-programmes', '*/5 * * * *', $cron$
      select net.http_post(
        url := replace(r.url, '/notif-commerce', '/mails-programmes'),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notif-cle', r.cle),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000)
        from public.notif_reglage r where r.id
    $cron$);
  end if;
end $$;

-- CONTROLE, a lancer apres (il ne modifie rien)
-- select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as connecte
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname in ('mails_a_partir', 'mail_resultat');   -> faux pour les deux
-- select jobname, schedule from cron.job where jobname = 'mails-programmes';          -> */5 * * * *
