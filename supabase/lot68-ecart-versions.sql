-- ============================================================================
-- LOT 68 : L'ECART DE MONTANT ENTRE DEUX VERSIONS D'UN DEVIS, 06/10/2026
-- ============================================================================
-- A coller dans Supabase (SQL Editor) APRES lot65-rappeler-devis.sql. Rejouable.
--
-- Decision de Ted du 05/10/2026 : la carte d'un devis corrige dit l'ecart avec la version
-- d'avant (« 60,00 EUR HT de moins que la version 1 »), A PARTIR DE MAINTENANT. Les devis
-- deja corriges n'ont pas l'ecart : leur ancien total n'a ete garde nulle part.
--
-- Une table a part, remplie par un declencheur au moment de la correction (version qui
-- monte) : le gel du devis (`devis_signer`) et `devis_rappeler` ne changent pas.
-- ============================================================================

create table if not exists public.devis_versions (
  bureau      uuid not null,
  devis_id    uuid not null,
  version     smallint not null,
  total_ht_c  bigint not null,
  gardee_le   timestamptz not null default now(),
  primary key (bureau, devis_id, version),
  foreign key (bureau, devis_id) references public.devis(bureau, devis_id) on delete cascade,
  constraint devis_versions_version check (version between 1 and 98)
);
alter table public.devis_versions enable row level security;
drop policy if exists devis_versions_lire on public.devis_versions;
create policy devis_versions_lire on public.devis_versions for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
revoke all on public.devis_versions from public, anon, authenticated;
grant select on public.devis_versions to authenticated;

-- Quand la version d'un devis monte (une correction, lot 65), le total de la version qui
-- part est garde. Une seule fois par version.
create or replace function public.devis_garder_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.version > old.version then
    insert into public.devis_versions (bureau, devis_id, version, total_ht_c)
      values (old.bureau, old.devis_id, old.version, coalesce(old.total_ht_c, 0))
      on conflict (bureau, devis_id, version) do nothing;
  end if;
  return null;
end
$$;
revoke all on function public.devis_garder_version() from public, anon, authenticated;
drop trigger if exists devis_garder_version on public.devis;
create trigger devis_garder_version after update of version on public.devis
  for each row execute function public.devis_garder_version();

-- Une ligne gardee ne bouge plus.
create or replace function public.devis_versions_figer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'version gardee : elle ne se modifie plus' using errcode = '23514';
end
$$;
revoke all on function public.devis_versions_figer() from public, anon, authenticated;
drop trigger if exists devis_versions_figer on public.devis_versions;
create trigger devis_versions_figer before update on public.devis_versions
  for each row execute function public.devis_versions_figer();

-- VERIFIER (a coller a part, chaque ligne doit rendre true) :
-- select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'devis_versions');
-- select exists (select 1 from pg_trigger where tgname = 'devis_garder_version' and not tgisinternal);
