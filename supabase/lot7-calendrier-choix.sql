-- ===========================================================================
-- LE BUREAU DU VIGNERON — LES CHOIX DE CALENDRIER
-- ===========================================================================
-- Lot 3 du chantier calendrier, 08/09/2026. A coller dans l'editeur SQL de
-- Supabase. Le meme texte est recopie dans supabase/schema.sql, qui reste la
-- reference : ne pas laisser les deux diverger.
--
-- CE QUE CETTE TABLE PORTE, ET CE QU'ELLE NE PORTE PAS.
-- Elle porte les ECARTS du vigneron par rapport a la bibliotheque : le repere
-- qu'il ne veut pas suivre, et celui qu'il decale. Elle ne porte PAS la
-- bibliotheque elle-meme, qui vit dans src/_data/echeances.json, ni ses
-- occurrences a lui, qui sont des taches.
--
-- UNE LIGNE N'EXISTE QUE S'IL Y A UN ECART. Suivi et non decale est l'etat par
-- defaut du monde : il n'y a rien a stocker pour le dire. Rallumer un repere et
-- remettre son decalage a zero SUPPRIME la ligne, exactement comme decocher une
-- obligation dans la table des taches. Sans cette regle, la table se remplirait
-- d'une ligne par occurrence et par compte, toutes neutres.
-- ===========================================================================

create table if not exists public.calendrier_choix (
  id        uuid not null references auth.users on delete cascade,
  -- La cle de l'occurrence dans src/_data/echeances.json (drm, taille, vendanges...).
  -- Jamais une cle de tache : une tache se supprime, elle ne s'eteint pas.
  cle       text not null,
  actif     boolean not null default true,
  -- Le decalage en JOURS, positif ou negatif. Une taille en fevrier n'est pas la
  -- meme en Loire et dans l'Herault ; le repere se deplace, l'obligation non.
  -- La borne n'est pas decorative : sans elle, un 3000 tape a la place de 30
  -- deplacerait le repere de huit ans sans que rien ne le signale.
  decale_de smallint not null default 0 check (decale_de between -180 and 180),
  maj_le    timestamptz not null default now(),
  primary key (id, cle)
);

alter table public.calendrier_choix enable row level security;

drop policy if exists "lire ses choix de calendrier" on public.calendrier_choix;
create policy "lire ses choix de calendrier" on public.calendrier_choix
  for select using (auth.uid() = id);
drop policy if exists "creer ses choix de calendrier" on public.calendrier_choix;
create policy "creer ses choix de calendrier" on public.calendrier_choix
  for insert with check (auth.uid() = id);
drop policy if exists "modifier ses choix de calendrier" on public.calendrier_choix;
create policy "modifier ses choix de calendrier" on public.calendrier_choix
  for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "supprimer ses choix de calendrier" on public.calendrier_choix;
create policy "supprimer ses choix de calendrier" on public.calendrier_choix
  for delete using (auth.uid() = id);

revoke all on public.calendrier_choix from anon;
grant select, insert, update, delete on public.calendrier_choix to authenticated;

-- PAS dans effacer_mes_donnees(), meme motif que les signets et les taches :
-- cette fonction vide LA BASE DE VENTES, pas le compte.
