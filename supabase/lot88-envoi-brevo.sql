-- ============================================================================
-- LOT 88, 09/10/2026 : LES MAILS PARTENT PAR BREVO. A COLLER DANS SUPABASE, APRES LE LOT 87.
-- ============================================================================
-- Ce que le maitre a coche (lot 87) part maintenant par Brevo, depuis l'adresse d'expediteur
-- que chacun a choisie. « Par ma boite » reste par la boite. Rien d'autre ne change.
--   - `brevo_pour_envoi()` dit, pour UNE personne et UNE sorte de mail, si le mail part par
--     Brevo et avec quoi. Cle de service seule : elle rend la cle.
--   - `brevo_envoi_permis()` : 200 mails par jour et par personne au plus (comme la boite).
--     [Certain] L'offre gratuite de Brevo plafonne de son cote a 300 par jour pour tout le
--     compte, newsletters comprises.
--   - `brevo_envois` garde 30 jours, pour chaque mail parti, son identifiant Brevo : c'est ce
--     qui permettra au lot 90 de rattacher « arrive » ou « adresse morte » au bon mail. Ni le
--     destinataire, ni le texte.
--   - `brevo_choix.copie_a_soi` : une copie cachee a soi, cochee d'office. Un mail parti par
--     Brevo ne se range dans aucun dossier « Envoyes ».
-- PAS DE BASCULE : si Brevo doit envoyer et ne peut pas (cle refusee, pas d'adresse choisie),
-- le mail NE part PAS par la boite a la place. On le dit. Decision de Ted du 08/10/2026.
-- REJOUABLE.
-- ============================================================================

alter table public.brevo_choix add column if not exists copie_a_soi boolean not null default true;

create table if not exists public.brevo_envois (
  id         bigserial primary key,
  bureau     uuid not null,
  personne   uuid not null references auth.users(id) on delete cascade,
  sorte      text not null,
  le         timestamptz not null default now(),
  message_id text,
  constraint brevo_envois_sorte check (sorte in ('affaires', 'devis', 'programmes')),
  constraint brevo_envois_message check (message_id is null or char_length(message_id) <= 200)
);
create index if not exists brevo_envois_personne on public.brevo_envois (personne, le);
alter table public.brevo_envois enable row level security;
revoke all on public.brevo_envois from anon, authenticated;

-- ---------------------------------------------------------------- CHOISIR, AVEC LA COPIE
-- Le lot 87 avait 4 arguments ; celle-ci en a 5, le dernier facultatif. L'ancienne part,
-- sinon PostgREST hesiterait entre les deux.
drop function if exists public.brevo_choisir(uuid, text, text, text);
create or replace function public.brevo_choisir(p_bureau uuid, p_chemin text, p_expediteur text,
  p_nom text, p_copie boolean default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null or not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = moi) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  insert into public.brevo_choix as c (bureau, personne, chemin, expediteur, expediteur_nom, copie_a_soi, maj_le)
  values (p_bureau, moi, coalesce(p_chemin, 'bureau'),
      nullif(lower(btrim(coalesce(p_expediteur, ''))), ''),
      nullif(regexp_replace(btrim(coalesce(p_nom, '')), '\s+', ' ', 'g'), ''), coalesce(p_copie, true), now())
  on conflict on constraint brevo_choix_pkey do update set
      chemin = coalesce(p_chemin, c.chemin),
      expediteur = case when p_expediteur is null then c.expediteur
                        else nullif(lower(btrim(p_expediteur)), '') end,
      expediteur_nom = case when p_nom is null then c.expediteur_nom
                            else nullif(regexp_replace(btrim(p_nom), '\s+', ' ', 'g'), '') end,
      copie_a_soi = coalesce(p_copie, c.copie_a_soi),
      maj_le = now();
  return true;
end $$;
revoke all on function public.brevo_choisir(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.brevo_choisir(uuid, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------- PAR OU PART CE MAIL (cle de service)
-- etat :
--   'ok'                   : il part par Brevo, avec cette cle, cette adresse, ce nom ;
--   'pas_branche'          : Brevo n'est pas branche sur le bureau -> la boite, comme avant ;
--   'par_ma_boite'         : la personne a choisi sa boite         -> la boite ;
--   'pas_pour_cette_sorte' : le maitre n'a pas coche cette sorte   -> la boite ;
--   'refusee'              : Brevo refuse la cle      -> le mail NE part PAS (pas de bascule) ;
--   'sans_expediteur'      : aucune adresse choisie   -> le mail NE part PAS.
create or replace function public.brevo_pour_envoi(p_personne uuid, p_bureau uuid, p_sorte text)
returns table (etat text, cle text, expediteur text, nom text, copie boolean)
language plpgsql stable security definer set search_path = '' as $$
declare b public.brevo; c public.brevo_choix; coche boolean;
begin
  if not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  if p_sorte not in ('affaires', 'devis', 'programmes') then
    raise exception 'sorte inconnue' using errcode = '22023';
  end if;
  select * into b from public.brevo x where x.bureau = p_bureau;
  if not found then return query select 'pas_branche'::text, null::text, null::text, null::text, null::boolean; return; end if;
  select * into c from public.brevo_choix x where x.bureau = p_bureau and x.personne = p_personne;
  if found and c.chemin = 'boite' then return query select 'par_ma_boite'::text, null::text, null::text, null::text, null::boolean; return; end if;
  coche := case p_sorte when 'affaires' then b.defaut_affaires when 'devis' then b.defaut_devis else b.defaut_programmes end;
  if not coche then return query select 'pas_pour_cette_sorte'::text, null::text, null::text, null::text, null::boolean; return; end if;
  if b.etat = 'refusee' then return query select 'refusee'::text, null::text, null::text, null::text, null::boolean; return; end if;
  if c.expediteur is null then return query select 'sans_expediteur'::text, null::text, null::text, null::text, null::boolean; return; end if;
  return query
    select 'ok'::text, v.decrypted_secret, c.expediteur, c.expediteur_nom, coalesce(c.copie_a_soi, true)
      from vault.decrypted_secrets v where v.id = b.secret_id;
end $$;
revoke all on function public.brevo_pour_envoi(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.brevo_pour_envoi(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------- LE PLAFOND (cle de service)
-- Rend l'identifiant de la ligne posee, ou null si le plafond du jour est atteint.
create or replace function public.brevo_envoi_permis(p_personne uuid, p_bureau uuid, p_sorte text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare n integer; i bigint;
begin
  if not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('brevo_envoi:' || p_personne));
  delete from public.brevo_envois where le < now() - interval '30 days';
  select count(*) into n from public.brevo_envois where personne = p_personne and le > now() - interval '1 day';
  if n >= 200 then return null; end if;
  insert into public.brevo_envois (bureau, personne, sorte) values (p_bureau, p_personne, p_sorte) returning id into i;
  return i;
end $$;
revoke all on function public.brevo_envoi_permis(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.brevo_envoi_permis(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------- L'IDENTIFIANT BREVO (cle de service)
create or replace function public.brevo_envoi_noter(p_id bigint, p_message_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.brevo_envois set message_id = left(nullif(btrim(p_message_id), ''), 200) where id = p_id;
  return found;
end $$;
revoke all on function public.brevo_envoi_noter(bigint, text) from public, anon, authenticated;
grant execute on function public.brevo_envoi_noter(bigint, text) to service_role;

-- CONTROLES, a lancer apres (ils ne modifient rien)
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args,
--        has_function_privilege('authenticated', p.oid, 'execute') as connecte,
--        has_function_privilege('anon', p.oid, 'execute') as anon
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname like 'brevo%' order by 1;
--   -> une seule brevo_choisir (5 arguments) ; brevo_pour_envoi, brevo_envoi_* : connecte faux
