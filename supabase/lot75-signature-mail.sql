-- ============================================================================
-- LOT 75, 07/10/2026 : LA SIGNATURE DES MAILS. A COLLER DANS SUPABASE, APRES LE LOT 72.
-- ============================================================================
-- Arbitrages de Ted du 07/10/2026 (JOURNAL.md, « l'onglet Mes envois et la signature ») :
--   - UNE SIGNATURE PAR PERSONNE (`signatures`) : son nom, son role, son portable, et
--     deux reponses (la mettre dans les mails du bureau ; sa messagerie signe-t-elle deja).
--     Chacun lit et ecrit LA SIENNE, et seulement la sienne.
--   - UN BLOC COMMUN AU DOMAINE (`signature_domaine`) : nom du domaine, appellation, une
--     ligne d'action, un lien, l'actualite du moment AVEC SA DATE DE FIN, le pied legal.
--     Tout le bureau le LIT ; SEUL LE MAITRE l'ecrit, par une fonction `security definer`
--     (meme forme que le logo, lot 69).
--   - L'ACTUALITE N'EXISTE PAS SANS DATE DE FIN : la table le refuse.
-- Rien ici n'envoie de mail : le lot 75 ne fait que fabriquer la signature.
-- « VIDER LA BASE » N'Y TOUCHE PAS : rien ici ne vient d'un export.
-- REJOUABLE.
-- ============================================================================

-- ---------------------------------------------------------------- PAR PERSONNE
create table if not exists public.signatures (
  bureau           uuid not null references public.bureaux(bureau) on delete cascade,
  personne         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom              text,
  role             text,
  telephone        text,
  dans_mails       boolean not null default true,
  messagerie_signe boolean not null default false,
  maj_le           timestamptz not null default now(),
  primary key (bureau, personne),
  constraint signatures_nom check (nom is null or char_length(nom) between 1 and 80),
  constraint signatures_role check (role is null or char_length(role) between 1 and 60),
  constraint signatures_tel check (telephone is null or telephone ~ '^[0-9 +().-]{6,30}$')
);

create or replace function public.signatures_dater()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.maj_le := now();
  return new;
end $$;
revoke all on function public.signatures_dater() from public, anon, authenticated;
drop trigger if exists signatures_dater on public.signatures;
create trigger signatures_dater before insert or update on public.signatures
  for each row execute function public.signatures_dater();

alter table public.signatures enable row level security;
drop policy if exists signatures_lire on public.signatures;
drop policy if exists signatures_creer on public.signatures;
drop policy if exists signatures_changer on public.signatures;
drop policy if exists signatures_retirer on public.signatures;
create policy signatures_lire on public.signatures for select to authenticated using
  ( personne = (select auth.uid())
    and bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy signatures_creer on public.signatures for insert to authenticated with check
  ( personne = (select auth.uid())
    and bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy signatures_changer on public.signatures for update to authenticated
  using ( personne = (select auth.uid()) )
  with check ( personne = (select auth.uid())
    and bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy signatures_retirer on public.signatures for delete to authenticated using
  ( personne = (select auth.uid()) );

revoke all on public.signatures from anon, authenticated;
grant select, insert, update, delete on public.signatures to authenticated;

-- ---------------------------------------------------------------- COMMUN AU DOMAINE
create table if not exists public.signature_domaine (
  bureau        uuid primary key references public.bureaux(bureau) on delete cascade,
  nom_domaine   text,
  appellation   text,
  action        text,
  lien          text,
  actualite     text,
  actualite_fin date,
  pied_legal    boolean not null default true,
  maj_par       uuid references auth.users(id) on delete set null,
  maj_le        timestamptz not null default now(),
  constraint sigdom_nom check (nom_domaine is null or char_length(nom_domaine) between 1 and 80),
  constraint sigdom_appellation check (appellation is null or char_length(appellation) between 1 and 80),
  constraint sigdom_action check (action is null or char_length(action) between 1 and 100),
  constraint sigdom_lien check (lien is null or (char_length(lien) <= 120
    and lien ~* '^https?://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(/[^\s<>"]*)?$')),
  constraint sigdom_actualite check (actualite is null or char_length(actualite) between 1 and 90),
  -- Pas d'actualite sans date de fin, pas de date de fin sans actualite.
  constraint sigdom_actualite_fin check ((actualite is null) = (actualite_fin is null))
);

alter table public.signature_domaine enable row level security;
drop policy if exists sigdom_lire on public.signature_domaine;
create policy sigdom_lire on public.signature_domaine for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
revoke all on public.signature_domaine from anon, authenticated;
grant select on public.signature_domaine to authenticated;

-- POSER : le maitre seul. Une actualite dont la fin est deja passee est refusee :
-- elle ne s'afficherait jamais, et le vigneron croirait l'avoir posee.
create or replace function public.signature_domaine_poser(
  p_bureau uuid, p_nom text, p_appellation text, p_action text, p_lien text,
  p_actualite text, p_actualite_fin date, p_pied_legal boolean)
returns setof public.signature_domaine
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_maitre(p_bureau) then
    raise exception 'seul le maitre du bureau regle la signature du domaine' using errcode = '42501';
  end if;
  if nullif(btrim(p_actualite), '') is not null and p_actualite_fin is null then
    raise exception 'une actualite demande une date de fin' using errcode = '22023';
  end if;
  if nullif(btrim(p_actualite), '') is not null and p_actualite_fin < (now() at time zone 'Europe/Paris')::date then
    raise exception 'la date de fin de l actualite est passee' using errcode = '22023';
  end if;
  insert into public.signature_domaine as s (bureau, nom_domaine, appellation, action, lien,
      actualite, actualite_fin, pied_legal, maj_par, maj_le)
  values (p_bureau, nullif(btrim(p_nom), ''), nullif(btrim(p_appellation), ''), nullif(btrim(p_action), ''),
      nullif(btrim(p_lien), ''), nullif(btrim(p_actualite), ''),
      case when nullif(btrim(p_actualite), '') is null then null else p_actualite_fin end,
      coalesce(p_pied_legal, true), auth.uid(), now())
  on conflict on constraint signature_domaine_pkey do update
    set nom_domaine = excluded.nom_domaine, appellation = excluded.appellation, action = excluded.action,
        lien = excluded.lien, actualite = excluded.actualite, actualite_fin = excluded.actualite_fin,
        pied_legal = excluded.pied_legal, maj_par = excluded.maj_par, maj_le = excluded.maj_le;
  return query select * from public.signature_domaine s where s.bureau = p_bureau;
end
$$;
-- Un revoke sur `public` ne retire pas un droit nominatif (regle du 13/09/2026).
revoke all on function public.signature_domaine_poser(uuid, text, text, text, text, text, date, boolean) from public, anon, authenticated;
grant execute on function public.signature_domaine_poser(uuid, text, text, text, text, text, date, boolean) to authenticated;

-- CONTROLES, a lancer apres (ils ne modifient rien)
-- 1) select tablename, policyname, cmd from pg_policies where tablename in ('signatures','signature_domaine') order by 1,3;
--      -> signatures : DELETE, INSERT, SELECT, UPDATE ; signature_domaine : SELECT seul
-- 2) select table_name, grantee, privilege_type from information_schema.role_table_grants
--     where table_name in ('signatures','signature_domaine') and grantee in ('anon','authenticated') order by 1,3;
--      -> anon : rien ; signature_domaine : SELECT seul
