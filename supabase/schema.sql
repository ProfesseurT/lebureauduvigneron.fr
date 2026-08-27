-- Le Bureau du Vigneron, lot 1 : socle des comptes.
-- A coller dans l'editeur SQL Supabase (projet region Europe). Pas de CLI Supabase dans ce
-- depot statique, ce fichier est la version versionnee, pas une migration executable ici.

-- Profils. Une ligne par compte, creee automatiquement a l'inscription.
create table public.profils (
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

create policy "lire sa fiche"
  on public.profils for select using (auth.uid() = id);

create policy "modifier sa fiche"
  on public.profils for update using (auth.uid() = id);

-- Pas de politique d'insertion : la ligne nait par declencheur, jamais par le client.
create function public.creer_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profils (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger creer_profil_apres_inscription
  after insert on auth.users
  for each row execute function public.creer_profil();

-- Points de vigilance (voir BRIEF_CLAUDE-CODE_comptes-supabase.md) :
-- 1. Verifier avec la cle anon, sans etre connecte, qu'un `select` sur `profils` renvoie zero
--    ligne. Si RLS est mal pose, la table des emails est publiquement lisible : c'est le seul
--    vrai risque de securite du lot.
-- 2. Aucune colonne n'accueille de donnee de vente. Un besoin de stockage d'analyse fera l'objet
--    d'un arbitrage a part.
