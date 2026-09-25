-- ============================================================================
-- LOT 33, 24/09/2026 : « MES CLIENTS ». A COLLER DANS SUPABASE, APRES LE LOT 32.
-- ============================================================================
--
-- Ce que Ted a decide le 24/09/2026, et que ce lot porte :
--
--   1. UN CLIENT PEUT AVOIR UN PROPRIETAIRE, un membre du bureau.
--   2. TOUT LE BUREAU ECRIT SUR LA FICHE D'UN CLIENT, ET ON NOMME QUI A FAIT L'ACTION.
--      C'est un changement de la regle du 13/09/2026 (« chacun n'ecrit que ses propres
--      lignes, maitre compris ») pour `suivi_clients` SEULEMENT. `echanges` n'en a pas
--      besoin : chaque echange est sa propre ligne, et en ajouter un est deja ouvert au
--      bureau entier. Le 13/09 annoncait le prix de ce retour : deux `drop policy` et deux
--      `create policy`, sans migration. Le voici.
--   3. LES ETIQUETTES SONT COMMUNES AU BUREAU. Elles vivaient deja dans
--      `suivi_clients.tags` ; ouvrir la ligne au bureau suffit a les rendre communes.
--      Aucune table de plus.
--   4. LES VUES ENREGISTREES de la liste, communes au bureau : table `vues_clients`.
--
-- LE NAVIGATEUR EST PRET AVANT CE SQL, ET IL NE CASSE RIEN S'IL N'EST PAS PASSE.
-- `lireSuivi()` lit `select=*` et decouvre les colonnes ; `proprietaire` ne part en
-- ecriture que si la colonne a ete vue. Tant que ce lot manque, « Mes clients » marche,
-- et dit seulement que l'attribution et les vues ne sont pas encore la.
--
-- REJOUABLE : chaque instruction se repasse sans erreur.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. LES DEUX COLONNES DE SUIVI_CLIENTS
-- ---------------------------------------------------------------------------
-- `proprietaire` : a qui est ce client. Facultatif. `on delete set null` : un compte
-- supprime rend ses clients sans proprietaire, il ne les emporte pas.
-- `maj_par` : qui a fait le dernier geste sur la fiche. Pose par la BASE (declencheur
-- plus bas), jamais par le navigateur : une signature qu'on peut choisir n'en est pas une.
alter table public.suivi_clients
  add column if not exists proprietaire uuid references auth.users(id) on delete set null;
alter table public.suivi_clients
  add column if not exists maj_par uuid default auth.uid() references auth.users(id) on delete set null;

create index if not exists suivi_clients_proprietaire on public.suivi_clients (bureau, proprietaire);


-- ---------------------------------------------------------------------------
-- 2. LE DECLENCHEUR QUI SIGNE, ET QUI REFUSE UN PROPRIETAIRE ETRANGER
-- ---------------------------------------------------------------------------
-- `security definer` parce qu'il lit `membres` pour verifier que le proprietaire
-- appartient bien au bureau : sans cette verification, n'importe qui pourrait
-- attribuer un client a un compte d'un autre domaine, qui ne le verrait jamais.
-- `auth.uid()` reste celui de l'appelant : il vient du jeton de la requete, pas du
-- role qui execute la fonction.
create or replace function public.suivi_signer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.maj_par := auth.uid();
  end if;
  if new.proprietaire is not null and not exists (
       select 1 from public.membres m
        where m.bureau = new.bureau and m.personne = new.proprietaire) then
    raise exception 'proprietaire hors du bureau' using errcode = '23514';
  end if;
  return new;
end
$$;

-- Une fonction de declencheur ne s'appelle pas en RPC (regle du lot 29).
revoke all on function public.suivi_signer() from public, anon, authenticated;

drop trigger if exists suivi_signer on public.suivi_clients;
create trigger suivi_signer
  before insert or update on public.suivi_clients
  for each row execute function public.suivi_signer();


-- ---------------------------------------------------------------------------
-- 3. TOUT LE BUREAU MODIFIE ET SUPPRIME UNE FICHE CLIENT
-- ---------------------------------------------------------------------------
-- Forme « IN », et pas `est_membre(bureau)` : une politique ne passe jamais une colonne
-- a une fonction (regle du 17/09/2026, 2 487 ms contre 236 sur le comptage).
drop policy if exists "modifier son suivi" on public.suivi_clients;
drop policy if exists "supprimer son suivi" on public.suivi_clients;
drop policy if exists "modifier un suivi du bureau" on public.suivi_clients;
drop policy if exists "supprimer un suivi du bureau" on public.suivi_clients;

create policy "modifier un suivi du bureau" on public.suivi_clients
  for update to authenticated
  using      ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) )
  with check ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );

create policy "supprimer un suivi du bureau" on public.suivi_clients
  for delete to authenticated
  using ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );


-- ---------------------------------------------------------------------------
-- 4. LES VUES ENREGISTREES DE « MES CLIENTS »
-- ---------------------------------------------------------------------------
-- Une vue, c'est un nom et une combinaison de filtres. Communes au bureau : Romane
-- ouvre « CHR dormants en Loire » que Ted a enregistree. Le nom est unique par bureau,
-- ce qui permet de reenregistrer une vue sous le meme nom sans la doubler.
-- `filtres` est borne : c'est une poignee de cles, pas un stockage de documents.
create table if not exists public.vues_clients (
  bureau    uuid not null references public.bureaux(bureau) on delete cascade,
  vue_id    uuid not null default gen_random_uuid(),
  nom       text not null check (char_length(nom) between 1 and 60),
  filtres   jsonb not null default '{}'::jsonb check (pg_column_size(filtres) < 4000),
  cree_par  uuid default auth.uid() references auth.users(id) on delete set null,
  cree_le   timestamptz not null default now(),
  primary key (bureau, vue_id),
  constraint vues_clients_nom unique (bureau, nom)
);

alter table public.vues_clients enable row level security;

drop policy if exists vues_clients_lire on public.vues_clients;
drop policy if exists vues_clients_creer on public.vues_clients;
drop policy if exists vues_clients_modifier on public.vues_clients;
drop policy if exists vues_clients_supprimer on public.vues_clients;

create policy vues_clients_lire on public.vues_clients
  for select to authenticated
  using ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy vues_clients_creer on public.vues_clients
  for insert to authenticated
  with check ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy vues_clients_modifier on public.vues_clients
  for update to authenticated
  using      ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) )
  with check ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy vues_clients_supprimer on public.vues_clients
  for delete to authenticated
  using ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );

-- Supabase accorde TOUT par defaut : un `grant` seul ne retire rien (regle du 09/09/2026).
revoke all on public.vues_clients from anon, authenticated;
grant select, insert, update, delete on public.vues_clients to authenticated;


-- ---------------------------------------------------------------------------
-- CONTROLES, a lancer apres (ils ne modifient rien)
-- ---------------------------------------------------------------------------
-- select column_name from information_schema.columns
--  where table_schema='public' and table_name='suivi_clients' and column_name in ('proprietaire','maj_par');
--   -> 2 lignes
-- select policyname, cmd from pg_policies where tablename in ('suivi_clients','vues_clients') order by 1;
--   -> « modifier un suivi du bureau », « supprimer un suivi du bureau », et les 4 de vues_clients
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name='vues_clients' and grantee in ('anon','authenticated') order by 1,2;
--   -> authenticated DELETE, INSERT, SELECT, UPDATE ; anon : rien
