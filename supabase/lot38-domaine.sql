-- ============================================================================
-- LOT 38, 28/09/2026 : LA FICHE DU DOMAINE. A COLLER DANS SUPABASE, APRES LE LOT 36.
-- ============================================================================
-- Ce qu'un devis doit porter et qui n'etait stocke nulle part : qui vend. Une ligne
-- PAR BUREAU, commune a tous ses membres, et deux reglages que Ted veut laisser au
-- vigneron : les conditions de paiement et la duree de validite d'un devis.
--
-- D'OU VIENNENT LES CHAMPS. Ted : « une recherche auto avec l'API du ministere pour le
-- SIRET ». C'est l'API Recherche d'entreprises (DINUM), gratuite et sans cle. Le
-- navigateur l'interroge, le vigneron choisit sa ligne, et ce qui arrive ici est ce
-- qu'il a relu et garde. La base ne fait confiance a aucune des deux sources : elle
-- verifie la forme de chaque identifiant.
--
-- LE DELAI DE PAIEMENT A UN PLAFOND LEGAL, ET LA BASE LE TIENT. Pour les boissons
-- alcooliques soumises aux droits d'accises, c'est 30 jours apres la fin du mois de
-- livraison (Code de commerce, L441-11 ; economie.gouv.fr, verifie le 28/09/2026).
-- Donc « 30 jours fin de mois » au plus, et « N jours nets » a 30 au plus. Le cas des
-- vins en vrac sous accord interprofessionnel (45 jours fin de mois ou 60 jours nets)
-- n'est pas ouvert : ce n'est pas la vente en bouteilles a un caviste.
--
-- « VIDER LA BASE » N'Y TOUCHE PAS : rien ici ne vient d'un export.
-- REJOUABLE.
-- ============================================================================

create table if not exists public.domaine (
  bureau          uuid primary key references public.bureaux(bureau) on delete cascade,
  raison_sociale  text check (raison_sociale is null or char_length(btrim(raison_sociale)) between 1 and 160),
  forme_juridique text check (forme_juridique is null or char_length(forme_juridique) <= 80),
  siret           text check (siret is null or siret ~ '^[0-9]{14}$'),
  siren           text check (siren is null or siren ~ '^[0-9]{9}$'),
  tva             text check (tva is null or tva ~ '^FR[0-9A-Z]{2}[0-9]{9}$'),
  adresse         text check (adresse is null or char_length(adresse) <= 200),
  code_postal     text check (code_postal is null or char_length(code_postal) <= 12),
  ville           text check (ville is null or char_length(ville) <= 80),
  email           text check (email is null or char_length(email) <= 200),
  telephone       text check (telephone is null or char_length(telephone) <= 40),
  paiement_mode   text not null default 'fdm' check (paiement_mode in ('reception', 'nets', 'fdm')),
  paiement_jours  integer check (paiement_jours is null or paiement_jours between 1 and 30),
  validite_jours  integer not null default 30 check (validite_jours between 1 and 365),
  maj_par         uuid default auth.uid() references auth.users(id) on delete set null,
  maj_le          timestamptz not null default now(),
  -- Le SIREN est le debut du SIRET : deux champs qui se contredisent feraient un devis faux.
  constraint domaine_siren_siret check (siret is null or siren is null or left(siret, 9) = siren),
  -- « A reception » n'a pas de jours ; les deux autres en ont forcement.
  constraint domaine_paiement check (
    (paiement_mode = 'reception' and paiement_jours is null)
    or (paiement_mode in ('nets', 'fdm') and paiement_jours is not null))
);

-- La valeur par defaut du mode est « fdm » : il lui faut ses jours.
alter table public.domaine alter column paiement_jours set default 30;

-- La base signe, comme ailleurs : une colonne de signature ne se protege pas par un
-- `revoke update (colonne)` quand le droit de table existe (regle du 28/09/2026).
create or replace function public.domaine_signer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then new.maj_par := auth.uid();
  elsif tg_op = 'UPDATE' then new.maj_par := old.maj_par; end if;
  new.maj_le := now();
  return new;
end
$$;
revoke all on function public.domaine_signer() from public, anon, authenticated;

drop trigger if exists domaine_signer on public.domaine;
create trigger domaine_signer
  before insert or update on public.domaine
  for each row execute function public.domaine_signer();

-- Tout le bureau lit et ecrit, sur le modele des lots 33 et 34. Forme « IN ».
alter table public.domaine enable row level security;
drop policy if exists domaine_lire      on public.domaine;
drop policy if exists domaine_creer     on public.domaine;
drop policy if exists domaine_modifier  on public.domaine;
drop policy if exists domaine_supprimer on public.domaine;
create policy domaine_lire on public.domaine for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy domaine_creer on public.domaine for insert to authenticated with check
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy domaine_modifier on public.domaine for update to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) ) with check
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy domaine_supprimer on public.domaine for delete to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );

-- Supabase accorde tout par defaut : on retire, puis on donne (regle du 09/09/2026).
revoke all on public.domaine from anon, authenticated;
grant select, insert, update, delete on public.domaine to authenticated;

-- CONTROLES, a lancer apres (ils ne modifient rien)
-- 1) select policyname from pg_policies where tablename = 'domaine';          -> 4 lignes
-- 2) select privilege_type from information_schema.role_table_grants
--     where table_name = 'domaine' and grantee = 'anon';                        -> 0 ligne
