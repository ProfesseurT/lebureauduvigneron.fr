-- ===========================================================================
-- A COLLER DANS SUPABASE > SQL EDITOR > NEW QUERY, PUIS « RUN ».
-- Projet qukmncqqwomhmrdhvetj (lebureauduvigneron.fr, West EU Ireland).
-- Rejouable : le passer deux fois ne casse rien.
-- ===========================================================================
-- Tant que ce script n'est pas passe, l'ecran « Ma journee » fonctionne, les gestes
-- s'enregistrent sur l'appareil, mais le journal d'echanges ne suit pas d'un appareil
-- a l'autre. Rien ne casse, rien ne se perd : la synchronisation echoue en silence,
-- comme le reste du sync.

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
