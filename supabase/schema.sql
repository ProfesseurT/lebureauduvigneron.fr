-- Le Bureau du Vigneron, lot 1 : socle des comptes.
-- A coller tel quel dans l'editeur SQL Supabase (projet qukmncqqwomhmrdhvetj, West EU Ireland).
-- Pas de CLI Supabase dans ce depot statique : ce fichier est la version versionnee, il n'est
-- pas execute par le depot. Il remplace les deux blocs qui etaient separes (schema + grants).
--
-- Ecrit pour etre rejouable sans erreur. Un script a moitie passe dans un onglet de navigateur
-- est le pire etat a deboguer, et c'est le seul mode d'execution qu'on a ici.

-- ---------------------------------------------------------------------------
-- 1. La table
-- ---------------------------------------------------------------------------
-- Aucune colonne n'accueille de donnee de vente. Un besoin de stockage d'analyse fera l'objet
-- d'un arbitrage a part (voir CLAUDE.md : les lignes de vente ne quittent pas le navigateur).
create table if not exists public.profils (
  id             uuid primary key references auth.users on delete cascade,
  email          text not null,
  prenom         text,
  nom            text,
  domaine        text,
  code_postal    text,
  profil         text,             -- vigneron / etudiant / pro-filiere
  outil_origine  text,             -- par quel outil il est entre
  consent_news   boolean not null default false,
  cree_le        timestamptz not null default now(),
  vu_le          timestamptz not null default now()
);

alter table public.profils enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Les politiques RLS
-- ---------------------------------------------------------------------------
drop policy if exists "lire sa fiche" on public.profils;
create policy "lire sa fiche"
  on public.profils for select
  using (auth.uid() = id);

-- Le `with check` est explicite alors que Postgres le deduirait du `using` : il interdit de
-- reecrire `id` avec l'identifiant d'un autre compte, et le dire noir sur blanc evite qu'une
-- relecture future le supprime en croyant simplifier.
drop policy if exists "modifier sa fiche" on public.profils;
create policy "modifier sa fiche"
  on public.profils for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Pas de politique d'insertion ni de suppression : la ligne nait et meurt par declencheur ou
-- par cascade, jamais par le client.

-- ---------------------------------------------------------------------------
-- 3. Les droits, colonne par colonne
-- ---------------------------------------------------------------------------
-- Supabase accorde ALL a anon et authenticated par defaut sur le schema public. Sans ce bloc,
-- la politique d'update autorise toutes les colonnes : un compte peut reecrire son propre champ
-- `email` avec l'adresse de quelqu'un d'autre, ce qui pollue la liste de diffusion sans laisser
-- de trace. Le droit se restreint donc colonne par colonne.
revoke insert, delete on public.profils from anon, authenticated;
revoke update on public.profils from anon, authenticated;
grant update (prenom, nom, domaine, code_postal, profil, outil_origine, consent_news, vu_le)
  on public.profils to authenticated;

-- `id`, `email` et `cree_le` sont volontairement absents de ce grant. Les declencheurs des
-- sections 4 et 5 sont SECURITY DEFINER : ils ecrivent malgre ces revoke, seul chemin autorise.

-- ---------------------------------------------------------------------------
-- 4. Naissance de la fiche
-- ---------------------------------------------------------------------------
create or replace function public.creer_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profils (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists creer_profil_apres_inscription on auth.users;
create trigger creer_profil_apres_inscription
  after insert on auth.users
  for each row execute function public.creer_profil();

-- ---------------------------------------------------------------------------
-- 5. Synchronisation de l'adresse
-- ---------------------------------------------------------------------------
-- Ajoute le 01/09/2026 avec le passage au mot de passe. `PUT /auth/v1/user`, que le code appelle
-- maintenant pour changer le mot de passe, accepte aussi un champ `email`. Le declencheur de la
-- section 4 ne recopie l'adresse qu'a l'insertion, et la section 3 interdit au compte de toucher
-- `profils.email` : sans ce second declencheur, un changement d'adresse cote GoTrue laisserait
-- une adresse perimee dans `profils` que rien ne pourrait corriger.
-- La condition `is distinct from` evite de reecrire la ligne a chaque connexion, car GoTrue met
-- `auth.users` a jour bien plus souvent que l'adresse ne change.
create or replace function public.synchroniser_email_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profils set email = new.email where id = new.id;
  return new;
end $$;

drop trigger if exists synchroniser_email_apres_maj on auth.users;
create trigger synchroniser_email_apres_maj
  after update on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.synchroniser_email_profil();
