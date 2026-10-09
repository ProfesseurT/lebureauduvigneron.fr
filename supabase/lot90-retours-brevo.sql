-- ============================================================================
-- LOT 90, 09/10/2026 : CE QUE BREVO RENVOIE AU BUREAU. A COLLER DANS SUPABASE, APRES LE LOT 92.
-- ============================================================================
-- Arbitrages de Ted du 09/10/2026 (CLAUDE.md « LOT 90 ») :
--   - Brevo previent le bureau EN TEMPS REEL (webhooks), et le bureau rattrape l'historique au
--     branchement (adresses deja bloquees, desinscrits des campagnes) ;
--   - le bureau sait qu'une adresse est DESINSCRITE, MORTE, a crie au SPAM ou est BLOQUEE ;
--   - il montre « ouvert le » et « a clique le » SEULEMENT pour un client qui a accepte le suivi
--     (case sur la fiche). [Certain, CNIL, recommandation du 12/03/2026 publiee le 14/04/2026]
--     suivre l'ouverture d'un mail client par client demande son accord prealable.
--   - un mail par Brevo vers une adresse morte, en spam, bloquee ou desinscrite des mails 1 a 1
--     ne part pas ; un desinscrit des CAMPAGNES recoit encore un mail perso (on previent).
--
-- AUCUNE ADRESSE N'ENTRE EN BASE. Partout, une EMPREINTE : sha256 de « <bureau>:<adresse en
-- minuscules, sans espaces autour> », en hexadecimal (64 signes). La fonction Edge la calcule
-- (le webhook, l'envoi, le rattrapage), le navigateur la calcule de son cote pour lire. C'est
-- une pseudonymisation, pas un anonymat : le bureau connait deja ces adresses.
--
-- CE QUE CE LOT POSE :
--   - `brevo` : le jeton des webhooks (son empreinte seulement) et leur etat ;
--   - `brevo_bloquees` : une ligne par adresse et par source (mails 1 a 1 / campagnes) ;
--   - `suivi_accords` : les adresses dont le client a accepte le suivi des ouvertures ;
--   - `brevo_envois` : l'empreinte du destinataire, gardee 90 jours (et non plus 30) ;
--   - `brevo_retours` : pour un mail parti, la PREMIERE ouverture, le premier clic, le rejet.
-- REJOUABLE. « VIDER LA BASE » N'Y TOUCHE PAS.
-- ============================================================================

-- ---------------------------------------------------------------- 1. LES WEBHOOKS DU BUREAU
-- `retours_jeton` : l'empreinte (sha256, hexadecimal) du jeton que Brevo envoie dans l'en-tete
-- `x-bdv-jeton`. Le jeton lui-meme n'est garde nulle part : il vit chez Brevo, dans le webhook.
alter table public.brevo add column if not exists retours_jeton text;
alter table public.brevo add column if not exists retours_etat  text;
alter table public.brevo add column if not exists retours_le    timestamptz;
alter table public.brevo add column if not exists rattrape_le   timestamptz;
alter table public.brevo drop constraint if exists brevo_retours_jeton;
alter table public.brevo add constraint brevo_retours_jeton check (retours_jeton is null or retours_jeton ~ '^[0-9a-f]{64}$');
alter table public.brevo drop constraint if exists brevo_retours_etat;
alter table public.brevo add constraint brevo_retours_etat check (retours_etat is null or retours_etat in ('branches', 'echec'));
grant select (retours_etat, retours_le, rattrape_le) on public.brevo to authenticated;

-- ---------------------------------------------------------------- 2. LES ADRESSES BLOQUEES
-- source 'transactionnel' : les mails 1 a 1 (Brevo bloque ensuite cet envoi lui-meme) ;
-- source 'campagne'       : les campagnes (un mail perso part encore, le vigneron est prevenu).
-- motif : 'desinscrit', 'morte' (rebond definitif, adresse invalide), 'spam', 'bloquee'.
-- Retirer Brevo efface ces lignes (cascade) : sans Brevo, plus personne ne les tient a jour.
create table if not exists public.brevo_bloquees (
  bureau    uuid not null references public.brevo (bureau) on delete cascade,
  empreinte text not null,
  source    text not null,
  motif     text not null,
  depuis    timestamptz,
  vu_le     timestamptz not null default now(),
  primary key (bureau, empreinte, source),
  constraint brevo_bloquees_empreinte check (empreinte ~ '^[0-9a-f]{64}$'),
  constraint brevo_bloquees_source check (source in ('transactionnel', 'campagne')),
  constraint brevo_bloquees_motif check (motif in ('desinscrit', 'morte', 'spam', 'bloquee'))
);
alter table public.brevo_bloquees enable row level security;
drop policy if exists brevo_bloquees_lire on public.brevo_bloquees;
create policy brevo_bloquees_lire on public.brevo_bloquees for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
revoke all on public.brevo_bloquees from anon, authenticated;
grant select on public.brevo_bloquees to authenticated;

-- ---------------------------------------------------------------- 3. L'ACCORD DU CLIENT
-- Une ligne = cette adresse a accepte le suivi des ouvertures et des clics. Pas de ligne = non.
-- Une absence n'est pas un oui. Le bureau le dit a Brevo a chaque envoi
-- (`contactPixelTrackingConsent`). Retirer l'accord efface la ligne.
create table if not exists public.suivi_accords (
  bureau     uuid not null references public.bureaux on delete cascade,
  empreinte  text not null,
  accepte_le timestamptz not null default now(),
  par        uuid references auth.users on delete set null,
  primary key (bureau, empreinte),
  constraint suivi_accords_empreinte check (empreinte ~ '^[0-9a-f]{64}$')
);
alter table public.suivi_accords enable row level security;
drop policy if exists suivi_accords_lire on public.suivi_accords;
create policy suivi_accords_lire on public.suivi_accords for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
revoke all on public.suivi_accords from anon, authenticated;
grant select on public.suivi_accords to authenticated;

create or replace function public.suivi_accorder(p_bureau uuid, p_empreinte text, p_oui boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null or not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = moi) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  if p_empreinte is null or p_empreinte !~ '^[0-9a-f]{64}$' then
    raise exception 'empreinte invalide' using errcode = '22023';
  end if;
  if p_oui is true then
    insert into public.suivi_accords (bureau, empreinte, accepte_le, par) values (p_bureau, p_empreinte, now(), moi)
      on conflict (bureau, empreinte) do nothing;
  elsif p_oui is false then
    delete from public.suivi_accords where bureau = p_bureau and empreinte = p_empreinte;
  else
    raise exception 'oui ou non' using errcode = '22023';
  end if;
  return true;
end $$;
revoke all on function public.suivi_accorder(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.suivi_accorder(uuid, text, boolean) to authenticated;

-- ---------------------------------------------------------------- 4. LES MAILS PARTIS
alter table public.brevo_envois add column if not exists empreinte text;
alter table public.brevo_envois drop constraint if exists brevo_envois_empreinte;
alter table public.brevo_envois add constraint brevo_envois_empreinte check (empreinte is null or empreinte ~ '^[0-9a-f]{64}$');
create index if not exists brevo_envois_message on public.brevo_envois (bureau, message_id) where message_id is not null;
create index if not exists brevo_envois_empreinte on public.brevo_envois (bureau, empreinte) where empreinte is not null;

-- Le plafond du lot 88, avec l'empreinte du destinataire. Garde 90 jours : Brevo garde ses
-- evenements 90 jours, au-dela il n'y a plus rien a rattacher. L'ancienne (3 arguments) part,
-- sinon PostgREST hesiterait ; les appels nommes de 3 arguments marchent encore (defaut).
drop function if exists public.brevo_envoi_permis(uuid, uuid, text);
create or replace function public.brevo_envoi_permis(p_personne uuid, p_bureau uuid, p_sorte text,
  p_empreinte text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare n integer; i bigint;
begin
  if not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  if p_empreinte is not null and p_empreinte !~ '^[0-9a-f]{64}$' then
    raise exception 'empreinte invalide' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('brevo_envoi:' || p_personne));
  delete from public.brevo_envois where le < now() - interval '90 days';
  select count(*) into n from public.brevo_envois where personne = p_personne and le > now() - interval '1 day';
  if n >= 200 then return null; end if;
  insert into public.brevo_envois (bureau, personne, sorte, empreinte) values (p_bureau, p_personne, p_sorte, p_empreinte)
    returning id into i;
  return i;
end $$;
revoke all on function public.brevo_envoi_permis(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.brevo_envoi_permis(uuid, uuid, text, text) to service_role;

-- ---------------------------------------------------------------- 5. CE QUI EST ARRIVE A UN MAIL
-- La premiere fois seulement : une deuxieme ouverture ne change rien (cle primaire).
create table if not exists public.brevo_retours (
  envoi     bigint not null references public.brevo_envois (id) on delete cascade,
  evenement text not null,
  le        timestamptz not null,
  primary key (envoi, evenement),
  constraint brevo_retours_evenement check (evenement in ('ouvert', 'clic', 'desinscrit', 'morte', 'spam', 'bloquee'))
);
alter table public.brevo_retours enable row level security;
revoke all on public.brevo_retours from anon, authenticated;

-- ---------------------------------------------------------------- 6. LA FONCTION EDGE (cle de service)
-- Poser l'empreinte du jeton une fois les webhooks crees chez Brevo, ou dire l'echec.
create or replace function public.brevo_retours_poser(p_bureau uuid, p_jeton text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_jeton is not null and p_jeton !~ '^[0-9a-f]{64}$' then
    raise exception 'empreinte du jeton invalide' using errcode = '22023';
  end if;
  update public.brevo set retours_jeton = p_jeton,
      retours_etat = case when p_jeton is null then 'echec' else 'branches' end,
      retours_le = now(), maj_le = now()
    where bureau = p_bureau;
  return found;
end $$;
revoke all on function public.brevo_retours_poser(uuid, text) from public, anon, authenticated;
grant execute on function public.brevo_retours_poser(uuid, text) to service_role;

create or replace function public.brevo_retours_jeton(p_bureau uuid)
returns text language sql stable security definer set search_path = '' as $$
  select b.retours_jeton from public.brevo b where b.bureau = p_bureau;
$$;
revoke all on function public.brevo_retours_jeton(uuid) from public, anon, authenticated;
grant execute on function public.brevo_retours_jeton(uuid) to service_role;

-- La gravite d'un motif : un spam ne redevient pas une simple desinscription.
create or replace function public.brevo_gravite(p_motif text)
returns integer language sql immutable set search_path = '' as $$
  select case p_motif when 'spam' then 4 when 'morte' then 3 when 'bloquee' then 2 when 'desinscrit' then 1 else 0 end;
$$;
revoke all on function public.brevo_gravite(text) from public, anon, authenticated;

-- Un evenement de Brevo. Rend 'note', 'ignore' (rien a faire), ou 'inconnu' (Brevo retire).
--   - un motif (desinscrit, morte, spam, bloquee) marque l'ADRESSE, avec ou sans mail retrouve ;
--   - ouvert et clic ne sont notes QUE sur un mail retrouve, pour SON destinataire (pas la
--     copie cachee a soi), et SEULEMENT si ce destinataire a accepte le suivi.
create or replace function public.brevo_retour_noter(p_bureau uuid, p_message_id text, p_empreinte text,
  p_source text, p_evenement text, p_le timestamptz)
returns text language plpgsql security definer set search_path = '' as $$
declare e public.brevo_envois; quand timestamptz := least(coalesce(p_le, now()), now());
begin
  if p_empreinte is null or p_empreinte !~ '^[0-9a-f]{64}$' then
    raise exception 'empreinte invalide' using errcode = '22023';
  end if;
  if p_source not in ('transactionnel', 'campagne') then raise exception 'source inconnue' using errcode = '22023'; end if;
  if p_evenement not in ('ouvert', 'clic', 'desinscrit', 'morte', 'spam', 'bloquee') then
    raise exception 'evenement inconnu' using errcode = '22023';
  end if;
  if not exists (select 1 from public.brevo b where b.bureau = p_bureau) then return 'inconnu'; end if;

  if p_evenement in ('desinscrit', 'morte', 'spam', 'bloquee') then
    insert into public.brevo_bloquees as x (bureau, empreinte, source, motif, depuis, vu_le)
    values (p_bureau, p_empreinte, p_source, p_evenement, quand, now())
    on conflict (bureau, empreinte, source) do update set
      motif = case when public.brevo_gravite(excluded.motif) > public.brevo_gravite(x.motif) then excluded.motif else x.motif end,
      depuis = least(coalesce(x.depuis, excluded.depuis), excluded.depuis),
      vu_le = now();
  end if;

  if p_source = 'transactionnel' and nullif(btrim(coalesce(p_message_id, '')), '') is not null then
    select * into e from public.brevo_envois x
     where x.bureau = p_bureau and x.message_id = left(btrim(p_message_id), 200)
     order by x.id desc limit 1;
    if found and e.empreinte = p_empreinte then
      if p_evenement in ('ouvert', 'clic') and not exists
         (select 1 from public.suivi_accords a where a.bureau = p_bureau and a.empreinte = p_empreinte) then
        return 'ignore';
      end if;
      insert into public.brevo_retours (envoi, evenement, le) values (e.id, p_evenement, quand)
        on conflict (envoi, evenement) do nothing;
      return 'note';
    end if;
  end if;
  return case when p_evenement in ('ouvert', 'clic') then 'ignore' else 'note' end;
end $$;
revoke all on function public.brevo_retour_noter(uuid, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.brevo_retour_noter(uuid, text, text, text, text, timestamptz) to service_role;

-- Le RATTRAPAGE : la liste COMPLETE d'une source, lue chez Brevo. Remplace ce que le bureau
-- savait de cette source : une adresse que Brevo a debloquee (le client s'est reinscrit) part.
-- N'appeler QU'AVEC une lecture complete : une lecture partielle effacerait des blocages.
-- p_lignes : [{ "e": empreinte, "m": motif, "d": date ou null }, ...]. Rend le nombre garde.
create or replace function public.brevo_bloquees_remplacer(p_bureau uuid, p_source text, p_lignes jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_source not in ('transactionnel', 'campagne') then raise exception 'source inconnue' using errcode = '22023'; end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' then raise exception 'lignes absentes' using errcode = '22023'; end if;
  if not exists (select 1 from public.brevo b where b.bureau = p_bureau) then return 0; end if;
  if exists (select 1 from jsonb_array_elements(p_lignes) l
              where coalesce(l->>'e', '') !~ '^[0-9a-f]{64}$'
                 or coalesce(l->>'m', '') not in ('desinscrit', 'morte', 'spam', 'bloquee')) then
    raise exception 'ligne invalide' using errcode = '22023';
  end if;
  delete from public.brevo_bloquees x
   where x.bureau = p_bureau and x.source = p_source
     and not exists (select 1 from jsonb_array_elements(p_lignes) l where l->>'e' = x.empreinte);
  insert into public.brevo_bloquees as x (bureau, empreinte, source, motif, depuis, vu_le)
    select p_bureau, l->>'e', p_source, (array_agg(l->>'m' order by public.brevo_gravite(l->>'m') desc))[1],
           min(least(nullif(l->>'d', '')::timestamptz, now())), now()
      from jsonb_array_elements(p_lignes) l group by l->>'e'
  on conflict (bureau, empreinte, source) do update set
    motif = excluded.motif, depuis = coalesce(excluded.depuis, x.depuis), vu_le = now();
  get diagnostics n = row_count;
  update public.brevo set rattrape_le = now() where bureau = p_bureau;
  return n;
end $$;
revoke all on function public.brevo_bloquees_remplacer(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.brevo_bloquees_remplacer(uuid, text, jsonb) to service_role;

-- Avant un envoi par Brevo : faut-il le retenir, et le client a-t-il accepte le suivi ?
-- bloque : le motif qui empeche l'envoi (morte, spam, bloquee, ou desinscrit des mails 1 a 1),
--          ou null. Une desinscription des seules campagnes n'empeche pas un mail perso.
create or replace function public.brevo_destinataire(p_bureau uuid, p_empreinte text)
returns table (bloque text, suivi boolean)
language sql stable security definer set search_path = '' as $$
  select
    (select x.motif from public.brevo_bloquees x
      where x.bureau = p_bureau and x.empreinte = p_empreinte
        and (x.motif in ('morte', 'spam', 'bloquee') or x.source = 'transactionnel')
      order by public.brevo_gravite(x.motif) desc limit 1),
    exists (select 1 from public.suivi_accords a where a.bureau = p_bureau and a.empreinte = p_empreinte);
$$;
revoke all on function public.brevo_destinataire(uuid, text) from public, anon, authenticated;
grant execute on function public.brevo_destinataire(uuid, text) to service_role;

-- ---------------------------------------------------------------- 7. LIRE (le bureau)
-- Les derniers mails partis par Brevo vers ces adresses, et ce qui leur est arrive.
-- Ouvert et clic n'apparaissent que si l'adresse a (encore) accepte le suivi : retirer
-- l'accord les cache aussitot.
create or replace function public.brevo_suivi(p_bureau uuid, p_empreintes text[])
returns table (empreinte text, envoi_le timestamptz, sorte text, evenement text, le timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = auth.uid()) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  if p_empreintes is null or cardinality(p_empreintes) = 0 then return; end if;
  if cardinality(p_empreintes) > 20 then raise exception 'trop d adresses' using errcode = '22023'; end if;
  return query
    select e.empreinte, e.le, e.sorte, r.evenement, r.le
      from public.brevo_envois e
      left join public.brevo_retours r on r.envoi = e.id
        and (r.evenement not in ('ouvert', 'clic')
             or exists (select 1 from public.suivi_accords a where a.bureau = e.bureau and a.empreinte = e.empreinte))
     where e.bureau = p_bureau and e.empreinte = any (p_empreintes) and e.message_id is not null
     order by e.le desc, r.le
     limit 200;
end $$;
revoke all on function public.brevo_suivi(uuid, text[]) from public, anon, authenticated;
grant execute on function public.brevo_suivi(uuid, text[]) to authenticated;

-- CONTROLES, a lancer apres (ils ne modifient rien)
-- 1) select p.proname, pg_get_function_identity_arguments(p.oid) as args,
--           has_function_privilege('authenticated', p.oid, 'execute') as connecte,
--           has_function_privilege('anon', p.oid, 'execute') as anon
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and (p.proname like 'brevo%' or p.proname like 'suivi_acc%') order by 1;
--    -> UNE brevo_envoi_permis (4 arguments) ; connecte vrai SEULEMENT pour brevo_choisir,
--       brevo_regler, brevo_retirer, brevo_suivi, suivi_accorder ; anon faux partout
-- 2) select column_name from information_schema.column_privileges
--     where table_name = 'brevo' and grantee = 'authenticated' order by 1;
--    -> 15 colonnes, ni secret_id ni retours_jeton
