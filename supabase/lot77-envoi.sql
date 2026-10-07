-- ============================================================================
-- LOT 77, 07/10/2026 : ENVOYER UN MAIL DEPUIS SA BOITE. A COLLER APRES LE LOT 76.
-- ============================================================================
-- Le vigneron a branche sa boite (lot 76). Dans les redacteurs (une affaire, la fiche d'un
-- client), « Envoyer depuis ma boite » fait partir le mail par la fonction Edge `boite`,
-- action `envoyer`. Le clic EST la validation : aucun mail ne part sans lui.
-- Ce lot ajoute trois fonctions, executables par la CLE DE SERVICE SEULE :
--   - `boite_envoi_permis()` : le plafond, 200 envois par jour et par personne (Gmail en
--     accepte 500 pour un compte personnel) ; demande AVANT le serveur de mail ;
--   - `boite_pour_envoi()` : ce qu'il faut pour envoyer, mot de passe compris, lu dans Vault.
--     Seulement pour une boite BRANCHEE et que la personne UTILISE ;
--   - `boite_reconnecter()` : le serveur a refuse le mot de passe, la boite passe a
--     « reconnecter » et le bureau repasse par la messagerie.
-- On ne garde de chaque envoi que la personne, le bureau et l'heure, deux jours, pour le
-- plafond. Le mail lui-meme est note dans le journal de l'affaire ou du client, comme avant.
-- REJOUABLE.
-- ============================================================================

create table if not exists public.boite_envois (
  personne uuid not null references auth.users(id) on delete cascade,
  bureau   uuid not null,
  le       timestamptz not null default now()
);
create index if not exists boite_envois_personne on public.boite_envois (personne, le);
alter table public.boite_envois enable row level security;
revoke all on public.boite_envois from anon, authenticated;

create or replace function public.boite_envoi_permis(p_personne uuid, p_bureau uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('boite_envoi:' || p_personne));
  delete from public.boite_envois where le < now() - interval '2 days';
  select count(*) into n from public.boite_envois where personne = p_personne and le > now() - interval '1 day';
  if n >= 200 then return false; end if;
  insert into public.boite_envois (personne, bureau) values (p_personne, p_bureau);
  return true;
end $$;
revoke all on function public.boite_envoi_permis(uuid, uuid) from public, anon, authenticated;
grant execute on function public.boite_envoi_permis(uuid, uuid) to service_role;

create or replace function public.boite_pour_envoi(p_personne uuid, p_bureau uuid)
returns table (adresse text, serveur text, identifiant text, secret text, copie_a_soi boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query
    select b.adresse, b.serveur, b.identifiant, v.decrypted_secret, b.copie_a_soi
      from public.boites b
      join vault.decrypted_secrets v on v.id = b.secret_id
     where b.bureau = p_bureau and b.personne = p_personne
       and b.etat = 'branchee' and b.utiliser
       and exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne);
end $$;
revoke all on function public.boite_pour_envoi(uuid, uuid) from public, anon, authenticated;
grant execute on function public.boite_pour_envoi(uuid, uuid) to service_role;

create or replace function public.boite_reconnecter(p_personne uuid, p_bureau uuid, p_erreur text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.boites set etat = 'reconnecter', erreur = left(nullif(btrim(p_erreur), ''), 300), maj_le = now()
    where bureau = p_bureau and personne = p_personne and etat = 'branchee';
  return found;
end $$;
revoke all on function public.boite_reconnecter(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.boite_reconnecter(uuid, uuid, text) to service_role;

-- CONTROLE, a lancer apres (il ne modifie rien)
-- select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as connecte
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname in ('boite_envoi_permis', 'boite_pour_envoi', 'boite_reconnecter');
--   -> connecte faux pour les trois
