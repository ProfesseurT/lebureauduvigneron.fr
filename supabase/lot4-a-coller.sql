-- ===========================================================================
-- A COLLER DANS SUPABASE > SQL EDITOR > NEW QUERY, PUIS « RUN ».
-- Projet qukmncqqwomhmrdhvetj (lebureauduvigneron.fr, West EU Ireland).
-- Rejouable : le passer deux fois ne casse rien.
-- ===========================================================================
-- Ce fichier porte DEUX lots : le journal d'echanges (lot 4) et les trois colonnes que
-- le tableau de bord depose pour le bureau (lot 5, en bas). Les deux sont necessaires.
--
-- Tant qu'il n'est pas passe, et sans que rien ne casse ni ne se perde :
--   - les gestes s'enregistrent sur l'appareil, mais le journal ne suit pas d'un
--     appareil a l'autre, et la fiche client du bureau annonce un historique illisible ;
--   - /mon-bureau/ n'a ni ardoise, ni mot du jour, ni age d'analyse : le tableau de bord
--     n'a nulle part ou deposer ce qu'il calcule ;
--   - dans « Mes reglages » du bureau, l'objectif de CA et le mois d'exercice restent
--     verrouilles, volontairement : ecrire par-dessus une valeur qu'on n'a pas pu lire,
--     ce serait l'effacer.

create table if not exists public.echanges (
  id         uuid not null references auth.users on delete cascade,
  echange_id text not null,
  client_id  text not null,
  le         timestamptz not null default now(),
  type       text not null,
  canal      text,
  resume     text,
  primary key (id, echange_id)
);

create index if not exists echanges_client on public.echanges (id, client_id, le desc);

alter table public.echanges enable row level security;

drop policy if exists "lire ses echanges" on public.echanges;
create policy "lire ses echanges" on public.echanges for select using (auth.uid() = id);
drop policy if exists "creer ses echanges" on public.echanges;
create policy "creer ses echanges" on public.echanges for insert with check (auth.uid() = id);
drop policy if exists "modifier ses echanges" on public.echanges;
create policy "modifier ses echanges" on public.echanges for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "supprimer ses echanges" on public.echanges;
create policy "supprimer ses echanges" on public.echanges for delete using (auth.uid() = id);

revoke all on public.echanges from anon;
grant select, insert, update, delete on public.echanges to authenticated;

-- « Tout effacer » emporte desormais le journal avec le reste du suivi commercial.
create or replace function public.effacer_mes_donnees()
returns void language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid();
begin
  if moi is null then raise exception 'aucune session'; end if;
  delete from public.echanges      where id = moi;
  delete from public.ventes        where id = moi;
  delete from public.suivi_clients where id = moi;
  delete from public.reglages      where id = moi;
end $$;

revoke all on function public.effacer_mes_donnees() from public, anon;
grant execute on function public.effacer_mes_donnees() to authenticated;


-- ===========================================================================
-- LOT 5 : la file de travail passe dans le bureau.
-- ===========================================================================
alter table public.reglages add column if not exists file_travail jsonb;
alter table public.reglages add column if not exists resume_ventes jsonb;
alter table public.reglages add column if not exists depose_le timestamptz;
