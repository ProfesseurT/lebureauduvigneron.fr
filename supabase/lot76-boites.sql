-- ============================================================================
-- LOT 76, 07/10/2026 : BRANCHER SA BOITE. A COLLER DANS SUPABASE, APRES LE LOT 75.
-- ============================================================================
-- Decision de Ted du 07/10/2026 (JOURNAL.md) : A (la messagerie du vigneron s'ouvre) reste
-- le defaut ; pour qui le veut, B : le bureau envoie par la boite du vigneron, en SMTP 465.
-- Ce lot BRANCHE la boite et ne fait partir AUCUN mail vers un client (c'est le lot 77).
--
-- LE MOT DE PASSE :
--   - il est range dans Vault, chiffre (`vault.create_secret`), et nulle part ailleurs ;
--   - il n'arrive en base QUE par `boite_ranger()`, appelee par la fonction Edge `boite` avec
--     la cle de service, jamais par le navigateur. PostgREST passe les arguments comme
--     PARAMETRES : le texte de la requete ne le contient pas. Reglages mesures le 07/10/2026 :
--     log_statement = ddl, log_parameter_max_length_on_error = 0, pgaudit.log = none ;
--   - personne ne le relit : ni le navigateur, ni le maitre du bureau. Une colonne `secret_id`
--     n'est pas lisible par `authenticated` (droits par colonne) ;
--   - retirer la boite, quitter le bureau ou supprimer son compte efface le secret de Vault
--     (declencheur `boites_oublier`).
-- RIEN N'EST BRANCHE SANS MAIL D'ESSAI ARRIVE : la fonction Edge envoie un code a 6 chiffres
-- a l'adresse elle-meme ; seul `boite_confirmer()` avec ce code passe la boite a `branchee`.
-- On ne garde que l'empreinte du code, 15 minutes, 5 essais.
-- Les tentatives de test sont plafonnees (10 par heure et par personne) : sans plafond, la
-- fonction servirait a essayer des mots de passe sur la boite de quelqu'un d'autre.
-- « VIDER LA BASE » N'Y TOUCHE PAS. REJOUABLE.
-- ============================================================================

create table if not exists public.boites (
  bureau       uuid not null,
  personne     uuid not null,
  adresse      text not null,
  fournisseur  text not null,
  serveur      text not null,
  port         integer not null default 465,
  identifiant  text not null,
  secret_id    uuid,
  etat         text not null default 'a_confirmer',
  utiliser     boolean not null default true,
  copie_a_soi  boolean not null default true,
  code_hash    text,
  code_expire  timestamptz,
  code_essais  integer not null default 0,
  essai_le     timestamptz,
  branchee_le  timestamptz,
  erreur       text,
  maj_le       timestamptz not null default now(),
  primary key (bureau, personne),
  foreign key (bureau, personne) references public.membres (bureau, personne) on delete cascade,
  constraint boites_adresse check (char_length(adresse) <= 254 and adresse ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
  constraint boites_fournisseur check (fournisseur ~ '^[a-z0-9_]{1,30}$'),
  constraint boites_serveur check (char_length(serveur) <= 253 and serveur ~* '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  -- Supabase bloque les ports 25 et 587 : seul le 465 (SSL implicite) sort.
  constraint boites_port check (port = 465),
  constraint boites_identifiant check (char_length(identifiant) between 1 and 254),
  constraint boites_etat check (etat in ('a_confirmer', 'branchee', 'reconnecter')),
  constraint boites_branchee check (etat <> 'branchee' or (secret_id is not null and branchee_le is not null)),
  constraint boites_erreur check (erreur is null or char_length(erreur) <= 300)
);

create table if not exists public.boite_essais (
  personne uuid not null references auth.users(id) on delete cascade,
  le       timestamptz not null default now()
);
create index if not exists boite_essais_personne on public.boite_essais (personne, le);

alter table public.boites enable row level security;
alter table public.boite_essais enable row level security;
drop policy if exists boites_lire on public.boites;
-- Chacun lit SA ligne. Le maitre voit les autres par `boites_du_bureau()`, sans secret.
create policy boites_lire on public.boites for select to authenticated using
  ( personne = (select auth.uid())
    and bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
revoke all on public.boites from anon, authenticated;
revoke all on public.boite_essais from anon, authenticated;
-- Ni `secret_id`, ni `code_hash` : un droit par colonne, et aucune ecriture directe.
grant select (bureau, personne, adresse, fournisseur, serveur, port, identifiant, etat, utiliser,
  copie_a_soi, code_expire, essai_le, branchee_le, erreur, maj_le) on public.boites to authenticated;

-- ---------------------------------------------------------------- OUBLIER LE SECRET
create or replace function public.boites_oublier()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.secret_id is not null then
    delete from vault.secrets where id = old.secret_id;
  end if;
  return old;
end $$;
revoke all on function public.boites_oublier() from public, anon, authenticated;
drop trigger if exists boites_oublier on public.boites;
create trigger boites_oublier after delete on public.boites
  for each row execute function public.boites_oublier();

-- ---------------------------------------------------------------- LE PLAFOND DES ESSAIS
-- Appelee par la fonction Edge AVANT de toucher au serveur de mail. Rend vrai si l'essai est
-- permis, et le compte. Le membre doit appartenir au bureau.
create or replace function public.boite_essai_permis(p_personne uuid, p_bureau uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  -- Un verrou par personne : deux essais simultanes ne passent pas tous les deux sous le plafond.
  perform pg_advisory_xact_lock(hashtext('boite_essai:' || p_personne));
  delete from public.boite_essais where le < now() - interval '1 day';
  select count(*) into n from public.boite_essais where personne = p_personne and le > now() - interval '1 hour';
  if n >= 10 then return false; end if;
  insert into public.boite_essais (personne) values (p_personne);
  return true;
end $$;
revoke all on function public.boite_essai_permis(uuid, uuid) from public, anon, authenticated;
grant execute on function public.boite_essai_permis(uuid, uuid) to service_role;

-- ---------------------------------------------------------------- RANGER (cle de service seule)
-- Apres un envoi d'essai ACCEPTE par le serveur de la boite. Range le mot de passe dans Vault
-- (cree ou remplace), et l'empreinte du code envoye. La boite est `a_confirmer`.
create or replace function public.boite_ranger(p_personne uuid, p_bureau uuid, p_adresse text,
  p_fournisseur text, p_serveur text, p_identifiant text, p_secret text, p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare s uuid; nom text := 'boite:' || p_bureau || ':' || p_personne;
begin
  if not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  if p_secret is null or char_length(p_secret) not between 1 and 200 then
    raise exception 'mot de passe absent' using errcode = '22023';
  end if;
  if p_code !~ '^[0-9]{6}$' then raise exception 'code invalide' using errcode = '22023'; end if;
  select b.secret_id into s from public.boites b where b.bureau = p_bureau and b.personne = p_personne;
  if s is not null and exists (select 1 from vault.secrets v where v.id = s) then
    perform vault.update_secret(s, p_secret, nom, 'Boite d''envoi, Le Bureau du Vigneron', null);
  else
    s := vault.create_secret(p_secret, nom, 'Boite d''envoi, Le Bureau du Vigneron', null);
  end if;
  insert into public.boites as b (bureau, personne, adresse, fournisseur, serveur, port, identifiant,
      secret_id, etat, code_hash, code_expire, code_essais, essai_le, branchee_le, erreur, maj_le)
  values (p_bureau, p_personne, lower(btrim(p_adresse)), p_fournisseur, lower(btrim(p_serveur)), 465,
      btrim(p_identifiant), s, 'a_confirmer', encode(extensions.digest(p_code || ':' || p_personne, 'sha256'), 'hex'),
      now() + interval '15 minutes', 0, now(), null, null, now())
  on conflict on constraint boites_pkey do update set
      adresse = excluded.adresse, fournisseur = excluded.fournisseur, serveur = excluded.serveur,
      identifiant = excluded.identifiant, secret_id = excluded.secret_id, etat = 'a_confirmer',
      code_hash = excluded.code_hash, code_expire = excluded.code_expire, code_essais = 0,
      essai_le = now(), branchee_le = null, erreur = null, maj_le = now();
  return 'a_confirmer';
end $$;
revoke all on function public.boite_ranger(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.boite_ranger(uuid, uuid, text, text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------- CONFIRMER (le vigneron)
-- Rend 'branchee', 'faux' (code faux), 'expire' (15 min passees ou 5 essais), 'aucune'.
create or replace function public.boite_confirmer(p_bureau uuid, p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare b public.boites;
begin
  select * into b from public.boites x where x.bureau = p_bureau and x.personne = auth.uid() for update;
  if not found or b.code_hash is null then return 'aucune'; end if;
  if b.code_expire < now() or b.code_essais >= 5 then
    update public.boites set code_hash = null, code_expire = null where bureau = p_bureau and personne = auth.uid();
    return 'expire';
  end if;
  -- L'empreinte est salee par la personne : une empreinte qui fuirait ne se casse pas par table.
  if encode(extensions.digest(coalesce(btrim(p_code), '') || ':' || b.personne, 'sha256'), 'hex') <> b.code_hash then
    update public.boites set code_essais = code_essais + 1 where bureau = p_bureau and personne = auth.uid();
    return 'faux';
  end if;
  update public.boites set etat = 'branchee', branchee_le = now(), code_hash = null, code_expire = null,
      code_essais = 0, erreur = null, maj_le = now()
    where bureau = p_bureau and personne = auth.uid();
  return 'branchee';
end $$;
revoke all on function public.boite_confirmer(uuid, text) from public, anon, authenticated;
grant execute on function public.boite_confirmer(uuid, text) to authenticated;

-- ---------------------------------------------------------------- REGLER (le vigneron)
-- `utiliser` : le bureau envoie pour moi (vrai) ou ma messagerie ouvre le mail (faux), la
-- boite restant branchee. `copie_a_soi` : cochee d'office (OVH, IONOS, Orange ne rangent pas
-- dans Envoyes un mail parti par SMTP). Un NULL laisse la valeur en place.
create or replace function public.boite_regler(p_bureau uuid, p_utiliser boolean, p_copie boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.boites set utiliser = coalesce(p_utiliser, utiliser), copie_a_soi = coalesce(p_copie, copie_a_soi),
      maj_le = now()
    where bureau = p_bureau and personne = auth.uid();
  return found;
end $$;
revoke all on function public.boite_regler(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.boite_regler(uuid, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------- RETIRER (le vigneron)
-- La ligne part, et le declencheur efface le secret de Vault.
create or replace function public.boite_retirer(p_bureau uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from public.boites where bureau = p_bureau and personne = auth.uid();
  return found;
end $$;
revoke all on function public.boite_retirer(uuid) from public, anon, authenticated;
grant execute on function public.boite_retirer(uuid) to authenticated;

-- ---------------------------------------------------------------- CE QUE VOIT LE BUREAU
-- Qui envoie d'ou, jamais un code : adresse, etat, et si la personne s'en sert. LE MAITRE SEUL.
create or replace function public.boites_du_bureau(p_bureau uuid)
returns table (personne uuid, adresse text, etat text, utiliser boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.est_maitre(p_bureau) then
    raise exception 'seul le maitre du bureau voit les boites' using errcode = '42501';
  end if;
  return query select b.personne, b.adresse, b.etat, b.utiliser from public.boites b where b.bureau = p_bureau;
end $$;
revoke all on function public.boites_du_bureau(uuid) from public, anon, authenticated;
grant execute on function public.boites_du_bureau(uuid) to authenticated;

-- CONTROLES, a lancer apres (ils ne modifient rien)
-- 1) select column_name from information_schema.column_privileges
--      where table_name = 'boites' and grantee = 'authenticated' order by 1;
--      -> 15 colonnes, ni secret_id ni code_hash
-- 2) select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as connecte,
--           has_function_privilege('anon', p.oid, 'execute') as anon
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname like 'boite%' order by 1;
--      -> boite_ranger et boite_essai_permis : connecte faux ; anon faux partout
