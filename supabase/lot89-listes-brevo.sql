-- ============================================================================
-- LOT 89, 09/10/2026 : LES LISTES VERS BREVO. A COLLER DANS SUPABASE, APRES LE LOT 88.
-- ============================================================================
-- Arbitrages de Ted (08 et 09/10/2026) : le bureau CREE une liste dans Brevo a partir de
-- « Mes clients » ou de « Mon commerce » (e-mail et mobile) ; le vigneron ecrit et envoie sa
-- campagne DANS Brevo. Une liste neuve et datee a chaque fois. Tout membre du bureau peut le
-- faire. Les clients en recul et ceux qui portent l'etiquette « Gros client » sont ecartes
-- d'office (une case les remet). Les desinscrits de Brevo sont ecartes AVANT l'envoi : la
-- fonction Edge lit la liste noire du compte et ne pousse jamais un contact desinscrit.
--
-- CE QUE GARDE LA BASE : une ligne par liste creee (qui, quand, son nom, son numero chez
-- Brevo, combien de contacts). NI les adresses, NI les numeros : ils sont chez Brevo.
-- Treize mois, puis la ligne s'efface. 20 listes par jour et par bureau au plus.
-- REJOUABLE.
-- ============================================================================

create table if not exists public.brevo_listes (
  id          bigserial primary key,
  bureau      uuid not null references public.bureaux on delete cascade,
  personne    uuid references auth.users on delete set null,
  le          timestamptz not null default now(),
  nom         text not null,
  source      text not null,
  liste_id    bigint,
  process_id  bigint,
  envoyes     integer not null default 0,
  ecartes     integer not null default 0,
  constraint brevo_listes_nom check (char_length(nom) between 1 and 120 and nom !~ '[[:cntrl:]]'),
  constraint brevo_listes_source check (source in ('clients', 'commerce')),
  constraint brevo_listes_nombres check (envoyes >= 0 and ecartes >= 0)
);
create index if not exists brevo_listes_bureau on public.brevo_listes (bureau, le desc);
alter table public.brevo_listes enable row level security;
drop policy if exists brevo_listes_lire on public.brevo_listes;
-- Tout le bureau voit les listes creees : c'est l'historique commun.
create policy brevo_listes_lire on public.brevo_listes for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
revoke all on public.brevo_listes from anon, authenticated;
grant select on public.brevo_listes to authenticated;

-- ---------------------------------------------------------------- PERMIS (cle de service)
-- Vrai si la personne est membre et si le bureau n'a pas deja cree 20 listes en 24 heures.
-- Efface au passage les lignes de plus de treize mois.
create or replace function public.brevo_liste_permise(p_personne uuid, p_bureau uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('brevo_liste:' || p_bureau));
  delete from public.brevo_listes where le < now() - interval '13 months';
  select count(*) into n from public.brevo_listes where bureau = p_bureau and le > now() - interval '1 day';
  return n < 20;
end $$;
revoke all on function public.brevo_liste_permise(uuid, uuid) from public, anon, authenticated;
grant execute on function public.brevo_liste_permise(uuid, uuid) to service_role;

-- ---------------------------------------------------------------- NOTER (cle de service)
-- Apres que Brevo a cree la liste. Rend le numero de la ligne.
create or replace function public.brevo_liste_noter(p_personne uuid, p_bureau uuid, p_nom text,
  p_source text, p_liste_id bigint, p_process_id bigint, p_envoyes integer, p_ecartes integer)
returns bigint language plpgsql security definer set search_path = '' as $$
declare i bigint;
begin
  if not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  insert into public.brevo_listes (bureau, personne, nom, source, liste_id, process_id, envoyes, ecartes)
  values (p_bureau, p_personne, left(regexp_replace(btrim(coalesce(p_nom, '')), '[[:cntrl:]]', '', 'g'), 120),
      p_source, p_liste_id, p_process_id, greatest(coalesce(p_envoyes, 0), 0), greatest(coalesce(p_ecartes, 0), 0))
  returning id into i;
  return i;
end $$;
revoke all on function public.brevo_liste_noter(uuid, uuid, text, text, bigint, bigint, integer, integer) from public, anon, authenticated;
grant execute on function public.brevo_liste_noter(uuid, uuid, text, text, bigint, bigint, integer, integer) to service_role;

-- CONTROLES, a lancer apres (ils ne modifient rien)
-- select has_table_privilege('authenticated', 'public.brevo_listes', 'insert') as ecrit,     -- faux
--        has_function_privilege('authenticated', 'public.brevo_liste_noter(uuid, uuid, text, text, bigint, bigint, integer, integer)', 'execute') as note; -- faux
