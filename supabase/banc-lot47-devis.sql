-- ===========================================================================
-- BANC DU DEVIS, lot 47, 30/09/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Ce fichier ne se colle NULLE PART dans le projet reel. Il fabrique une fausse
-- base (le decor de Supabase, puis les VRAIS fichiers des lots 30, 34, 35, 38, 39),
-- y passe DEUX FOIS supabase/lot47-devis.sql, et verifie ce que le devis promet :
-- droits, numeros sans trou, gel, cloison entre bureaux, refus, calculs.
--
-- COMMENT LE LANCER (PostgreSQL 16 jetable), DEPUIS LE DOSSIER supabase/ :
--   initdb -D /tmp/pg47 -A trust
--   pg_ctl -D /tmp/pg47 -o "-k /tmp -p 55432" start
--   psql -h /tmp -p 55432 -d postgres -c "create database banc47"
--   psql -h /tmp -p 55432 -d banc47 -v ON_ERROR_STOP=1 -f banc-lot47-devis.sql
-- Derniere ligne attendue : « BANC DU DEVIS : N controles, 0 echec ». Le moindre
-- echec LEVE et arrete psql.
--
-- LA TABLE DE CAS PARTAGEE AVEC LE NAVIGATEUR : si ../scripts/fixtures/devis-calculs.json
-- existe (ecrit pour src/js/bdv-devis-calcul.js), chacun de ses cas passe par la RPC et
-- doit rendre EXACTEMENT les memes centimes. Sinon, seuls les cas de ce fichier jouent.
--
-- CE QUE LE BANC NE PROUVE PAS : que PostgREST applique ces droits comme on croit.
-- Un controle SQL prouve les politiques ; un appel HTTP avec deux vrais jetons reste a
-- faire en production (meme reserve qu'au lot 15). La concurrence (deux enregistrements
-- en meme temps) se joue a deux sessions, hors de ce fichier : voir le bas.
-- ===========================================================================

\set QUIET on
\o /dev/null
set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- 0. LE DECOR : ce que Supabase fournit et qu'un Postgres nu n'a pas
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists cron;
grant usage on schema public, auth to anon, authenticated;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
create table if not exists cron.job (jobname text primary key, schedule text, command text);
create or replace function cron.schedule(n text, s text, c text) returns bigint language sql as
$$ insert into cron.job values (n, s, c) on conflict (jobname) do update set schedule = excluded.schedule; select 1::bigint $$;
create or replace function cron.unschedule(n text) returns boolean language sql as
$$ delete from cron.job where jobname = n; select true $$;
-- INDISPENSABLE : Supabase accorde ALL par defaut sur toute table et toute fonction
-- neuves du schema public. Sans ces lignes, les `revoke` ne retirent rien et le banc
-- valide un mur qui n'a jamais ete construit.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

create table if not exists public.bureaux (
  bureau uuid primary key default gen_random_uuid(), nom text not null,
  cree_le timestamptz not null default now(), cree_par uuid references auth.users on delete set null);
create table if not exists public.membres (
  bureau uuid not null references public.bureaux on delete cascade,
  personne uuid not null references auth.users on delete cascade,
  role text not null default 'simple' check (role in ('maitre', 'simple')),
  primary key (bureau, personne));
alter table public.bureaux enable row level security;
alter table public.membres enable row level security;
-- est_membre / est_maitre : copies de lot15-bureaux.sql.
create or replace function public.est_membre(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membres m where m.bureau = b and m.personne = auth.uid()); $$;
create or replace function public.est_maitre(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membres m where m.bureau = b and m.personne = auth.uid() and m.role = 'maitre'); $$;
drop policy if exists membres_lire on public.membres;
create policy membres_lire on public.membres for select to authenticated using (personne = auth.uid());
grant select on public.membres to authenticated;

-- Les tables que vide le lot 30, en forme reduite (seule la colonne `bureau` compte ici).
create table if not exists public.reglages (bureau uuid primary key, classement jsonb, exercice_debut int,
  file_travail jsonb, resume_ventes jsonb, depose_le timestamptz, maj_le timestamptz);
create table if not exists public.ventes (bureau uuid not null, empreinte text not null, brut jsonb,
  primary key (bureau, empreinte));
create table if not exists public.echanges (id serial primary key, bureau uuid not null);
create table if not exists public.suivi_clients (id serial primary key, bureau uuid not null);
create table if not exists public.resumes (id serial primary key, bureau uuid not null);

-- ventes_lignes, bdv_champ et v_ventes : COPIES A LA LETTRE de lot23-table-etroite.sql
-- (sections 1, 3, 6 et 7). Le lot 23 entier demande le lot 22 et la table `ventes`
-- complete ; ce qui compte ici est la forme lue par devis_propositions().
create table if not exists public.ventes_lignes (
  bureau uuid not null, empreinte text not null, le_jour date, num_facture text, produit text,
  cuvee text, num_produit text, famille text, conditionnement text, perso_produit1 text,
  perso_produit2 text, perso_produit3 text, perso_produit4 text, perso_produit5 text,
  appellation text, couleur text, millesime text, pu_ht numeric, total_ht numeric,
  client_nom text, num_client text, client_cle text, commercial text, qte numeric,
  code_tarif text, perso_client1 text, perso_client2 text, perso_client3 text,
  perso_client4 text, perso_client5 text, perso_client6 text, perso_client7 text,
  perso_client8 text, perso_client9 text, pays text, origine text, ville text, cp text,
  vendeur text, tri_perso1 text, type_offert text, ordre_drm text, depot text,
  lieu_vente text, emails text, fixe text, mobile text,
  primary key (bureau, empreinte));
revoke all on public.ventes_lignes from anon, authenticated, public;
grant select on public.ventes_lignes to authenticated;
alter table public.ventes_lignes enable row level security;
drop policy if exists "lire les lignes du bureau" on public.ventes_lignes;
create policy "lire les lignes du bureau" on public.ventes_lignes
  for select to authenticated
  using (bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())));
create or replace function public.bdv_champ(l public.ventes_lignes, nom text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select case nom when 'produit' then l.produit when 'numClient' then l.num_client
    when 'client' then l.client_nom when 'famille' then l.famille
    when 'codeTarif' then l.code_tarif when 'typeOffert' then l.type_offert end; $$;
create or replace view public.v_ventes with (security_invoker = true) as
select l.*,
       coalesce((r.classement->>'valide')::boolean, false) as classement_valide,
       case when (r.classement->>'valide')::boolean then
         coalesce((r.classement->'horsCA'->>btrim(l.famille))::boolean, false)
       end as hors_ca,
       case when (r.classement->>'valide')::boolean then
         case when btrim(l.type_offert) <> ''
              then coalesce((r.classement->'gratuit'->>btrim(l.type_offert))::boolean, false)
              else false end
       end as est_offert,
       case when (r.classement->>'valide')::boolean then
         not coalesce((r.classement->'horsCA'->>btrim(l.famille))::boolean, false)
         and not (case when btrim(l.type_offert) <> ''
                       then coalesce((r.classement->'gratuit'->>btrim(l.type_offert))::boolean, false)
                       else false end)
       end as est_vente
  from public.ventes_lignes l
  left join public.reglages r on r.bureau = l.bureau;
revoke all on public.v_ventes from anon, authenticated, public;
grant select on public.v_ventes to authenticated;

-- ---------------------------------------------------------------------------
-- 1. LES VRAIS FICHIERS, puis le lot 47 DEUX FOIS (rejouable)
-- ---------------------------------------------------------------------------
\ir lot30-vider-la-preuve-complete.sql
\ir lot34-affaires.sql
\ir lot35-affaires-client.sql
\ir lot38-domaine.sql
\ir lot39-nouveau-client.sql
\ir lot47-devis.sql
\ir lot47-devis.sql
\set QUIET on

-- ---------------------------------------------------------------------------
-- 2. LES OUTILS DU BANC
-- ---------------------------------------------------------------------------
drop schema if exists banc cascade;
create schema banc;
create table banc.resultats (n serial, nom text, ok boolean, detail text);
grant usage on schema banc to anon, authenticated;
create function banc.ok(nom text, cond boolean, detail text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into banc.resultats (nom, ok, detail) values (nom, coalesce(cond, false), detail);
  if not coalesce(cond, false) then
    raise exception 'ECHEC : % %', nom, coalesce('(' || detail || ')', '');
  end if;
end $$;
-- Joue `q` avec les droits de l'appelant et verifie qu'il leve l'etat attendu.
create function banc.refus(nom text, q text, etat text) returns void
language plpgsql set search_path = '' as $$
declare e text; m text;
begin
  begin
    execute q;
    e := 'aucune erreur';
  exception when others then
    get stacked diagnostics e = returned_sqlstate, m = message_text;
  end;
  perform banc.ok(nom, e = etat, 'attendu ' || etat || ', recu ' || e || coalesce(' : ' || m, ''));
end $$;
grant execute on function banc.ok(text, boolean, text), banc.refus(text, text, text) to anon, authenticated;
create function banc.qui(u uuid) returns void language sql as
$$ select set_config('request.jwt.claim.sub', coalesce(u::text, ''), false) $$;
grant execute on function banc.qui(uuid) to anon, authenticated;
-- Une ligne de devis au format de p_lignes.
create function banc.l(pu bigint, q int, r int default 0, nom text default 'Vin', src text default 'saisi')
returns jsonb language sql immutable as $$
  select jsonb_build_object('num_produit', 'P-' || nom, 'designation', nom, 'conditionnement', '75cl',
    'millesime', '2022', 'quantite', q, 'pu_ht_c', pu, 'remise_cb', r, 'source_prix', src) $$;
grant execute on function banc.l(bigint, int, int, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. LE JEU DE DONNEES : deux bureaux, deux comptes
-- ---------------------------------------------------------------------------
-- U1 maitre de B1 ; U2 maitre de B2. B1 a une fiche domaine complete, B2 non.
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'u1@x.fr'),
  ('22222222-2222-2222-2222-222222222222', 'u2@x.fr');
insert into public.bureaux (bureau, nom) values
  ('b1000000-0000-0000-0000-000000000001', 'Domaine Un'),
  ('b2000000-0000-0000-0000-000000000002', 'Domaine Deux');
insert into public.membres values
  ('b1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'maitre'),
  ('b2000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'maitre');
insert into public.domaine (bureau, raison_sociale, forme_juridique, siret, siren, tva, adresse,
  code_postal, ville, email, paiement_mode, paiement_jours, validite_jours) values
  ('b1000000-0000-0000-0000-000000000001', 'EARL Domaine Un', 'EARL', '12345678900011', '123456789',
   'FR12123456789', '1 route des Vignes', '44330', 'Vallet', 'contact@un.fr', 'fdm', 30, 30),
  ('b2000000-0000-0000-0000-000000000002', 'Domaine Deux', null, null, null, null, null, null, null,
   null, 'reception', null, 15);
insert into public.affaire_types (bureau, type_id, nom, famille) values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-0000000000a1', 'Caviste', 'conquete'),
  ('b2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-0000000000a2', 'Caviste', 'conquete');
insert into public.affaire_etapes (bureau, etape_id, type_id, nom, ordre) values
  ('b1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000e1', 'a1000000-0000-0000-0000-0000000000a1', 'Contact', 1),
  ('b2000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-0000000000e2', 'a2000000-0000-0000-0000-0000000000a2', 'Contact', 1);
insert into public.pistes (bureau, piste_id, nom, nature, siret, adresse, code_postal, ville, email, client_id) values
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'Cave Neuve', 'caviste',
   '98765432100019', '3 quai Neuf', '44000', 'Nantes', 'neuve@x.fr', null),
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002', 'Ancienne Piste', 'restaurant',
   null, null, null, 'Clisson', null, 'C001');
-- Affaires de B1 : 01 client C001, 02 nouveau client, 03 close, 04 piste devenue cliente,
-- 05 client sans numero (cle = nom), 06 calculs, 07 table de cas partagee.
insert into public.affaires (bureau, affaire_id, type_id, etape_id, piste_id, client_id, client_nom, titre, issue) values
  ('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-0000000000e1', null, 'C001', 'Cave du Quai', 'Salon', 'en_cours'),
  ('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-0000000000e1', 'f1000000-0000-0000-0000-000000000001', null, null, 'Premiere commande', 'en_cours'),
  ('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-0000000000e1', null, 'C001', 'Cave du Quai', 'Close', 'gagnee'),
  ('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-0000000000e1', 'f1000000-0000-0000-0000-000000000002', null, null, 'Piste liee', 'en_cours'),
  ('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-0000000000e1', null, 'Bistrot Sans Numero', 'Bistrot Sans Numero', 'Sans numero', 'en_cours'),
  ('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-0000000000e1', null, 'C001', 'Cave du Quai', 'Calculs', 'en_cours'),
  ('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-0000000000e1', null, 'C001', 'Cave du Quai', 'Table partagee', 'en_cours'),
  ('b2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-0000000000a2', 'e2000000-0000-0000-0000-0000000000e2', null, 'Z9', 'Client Deux', 'B2', 'en_cours');

-- Le classement valide de B1 dit que « OFF » est un offert et « PLV » hors vente.
insert into public.reglages (bureau, classement) values
  ('b1000000-0000-0000-0000-000000000001', '{"valide": true, "gratuit": {"OFF": true}, "horsCA": {"PLV": true}}');
-- Ventes de B1. Dates relatives : le banc garde son sens quel que soit le jour.
insert into public.ventes_lignes (bureau, empreinte, le_jour, produit, num_produit, conditionnement, millesime,
  pu_ht, qte, client_nom, num_client, client_cle, ville, cp, pays, emails, famille, type_offert) values
  -- C001 : Muscadet vendu deux fois, le plus recent a 8,90 x 12
  ('b1000000-0000-0000-0000-000000000001', 'v01', current_date - 200, 'Muscadet', 'M1', '75cl', '2022', 8.50, 6,  'Cave du Quai', 'C001', 'C001', 'Nantes', '44000', 'France', 'cave@quai.fr;autre@quai.fr', 'Vin', ''),
  ('b1000000-0000-0000-0000-000000000001', 'v02', current_date - 20,  'Muscadet', 'M1', '75cl', '2022', 8.90, 12, 'Cave du Quai', 'C001', 'C001', 'Nantes', '44000', 'France', 'cave@quai.fr', 'Vin', ''),
  -- C001 : prix a trois decimales, arrondi au centime
  ('b1000000-0000-0000-0000-000000000001', 'v03', current_date - 40,  'Gros Plant', 'G1', '75cl', '2023', 5.125, 24, 'Cave du Quai', 'C001', 'C001', 'Nantes', '44000', 'France', 'cave@quai.fr', 'Vin', ''),
  -- C001 : un offert (prix 0), un offert par type, un avoir, une PLV : tous exclus
  ('b1000000-0000-0000-0000-000000000001', 'v04', current_date - 10,  'Muscadet', 'M1', '75cl', '2022', 0, 1, 'Cave du Quai', 'C001', 'C001', 'Nantes', '44000', 'France', null, 'Vin', ''),
  ('b1000000-0000-0000-0000-000000000001', 'v05', current_date - 5,   'Cremant', 'K1', '75cl', null, 12.00, 1, 'Cave du Quai', 'C001', 'C001', 'Nantes', '44000', 'France', null, 'Vin', 'OFF'),
  ('b1000000-0000-0000-0000-000000000001', 'v06', current_date - 4,   'Muscadet', 'M1', '75cl', '2022', 8.90, -2, 'Cave du Quai', 'C001', 'C001', 'Nantes', '44000', 'France', null, 'Vin', ''),
  ('b1000000-0000-0000-0000-000000000001', 'v07', current_date - 3,   'Tablier', 'T1', null, null, 15.00, 1, 'Cave du Quai', 'C001', 'C001', 'Nantes', '44000', 'France', null, 'PLV', ''),
  -- Autres clients de B1 : Folle Blanche 7,00 deux fois, 7,50 deux fois (egalite : le plus haut)
  ('b1000000-0000-0000-0000-000000000001', 'v08', current_date - 100, 'Folle Blanche', 'F1', '75cl', '2023', 7.00, 6, 'Client A', 'A1', 'A1', null, null, null, null, 'Vin', ''),
  ('b1000000-0000-0000-0000-000000000001', 'v09', current_date - 90,  'Folle Blanche', 'F1', '75cl', '2023', 7.00, 6, 'Client B', 'B1', 'B1', null, null, null, null, 'Vin', ''),
  ('b1000000-0000-0000-0000-000000000001', 'v10', current_date - 80,  'Folle Blanche', 'F1', '75cl', '2023', 7.50, 6, 'Client C', 'C3', 'C3', null, null, null, null, 'Vin', ''),
  ('b1000000-0000-0000-0000-000000000001', 'v11', current_date - 70,  'Folle Blanche', 'F1', '75cl', '2023', 7.50, 6, 'Client D', 'D1', 'D1', null, null, null, null, 'Vin', ''),
  -- Une vente vieille de plus de 12 mois : hors de la liste du bureau
  ('b1000000-0000-0000-0000-000000000001', 'v12', current_date - 500, 'Vieux Millesime', 'V1', '75cl', '2015', 30.00, 6, 'Client A', 'A1', 'A1', null, null, null, null, 'Vin', ''),
  -- Client sans numero : sa cle est son nom
  ('b1000000-0000-0000-0000-000000000001', 'v13', current_date - 30,  'Muscadet', 'M1', '75cl', '2022', 9.00, 6, 'Bistrot Sans Numero', '', 'Bistrot Sans Numero', 'Vertou', '44120', 'France', 'bistrot@x.fr', 'Vin', ''),
  -- Une vente de B2, que B1 ne doit jamais voir
  ('b2000000-0000-0000-0000-000000000002', 'w01', current_date - 10,  'Secret', 'S1', '75cl', '2020', 99.00, 1, 'Client Deux', 'Z9', 'Z9', null, null, null, null, 'Vin', '');

-- Lignes remplissant les tables que vide le lot 30, pour qu'il ait quelque chose a vider.
insert into public.ventes values ('b1000000-0000-0000-0000-000000000001', 'x1', '{}');
insert into public.echanges (bureau) values ('b1000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- 4. LES DROITS
-- ---------------------------------------------------------------------------
select banc.ok('anon : aucun droit sur les trois tables',
  not exists (select 1 from information_schema.role_table_grants
               where table_name in ('devis', 'devis_lignes', 'devis_compteurs') and grantee = 'anon'));
select banc.ok('authenticated : SELECT seul sur devis et devis_lignes, rien sur le compteur',
  (select array_agg(table_name || ':' || privilege_type order by table_name, privilege_type)
     from information_schema.role_table_grants
    where table_name in ('devis', 'devis_lignes', 'devis_compteurs') and grantee = 'authenticated')
  = array['devis:SELECT', 'devis_lignes:SELECT']);
select banc.ok('quatre politiques par table, aucune sur le compteur',
  (select count(*) from pg_policies where tablename = 'devis') = 4
  and (select count(*) from pg_policies where tablename = 'devis_lignes') = 4
  and (select count(*) from pg_policies where tablename = 'devis_compteurs') = 0);
select banc.ok('anon ne peut appeler aucune fonction du devis',
  not has_function_privilege('anon', 'public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text)', 'execute')
  and not has_function_privilege('anon', 'public.devis_abandonner(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.devis_propositions(uuid, uuid, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.devis_signer()', 'execute'));
select banc.ok('authenticated appelle les trois fonctions, pas les declencheurs',
  has_function_privilege('authenticated', 'public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text)', 'execute')
  and has_function_privilege('authenticated', 'public.devis_abandonner(uuid, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.devis_propositions(uuid, uuid, boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.devis_signer()', 'execute')
  and not has_function_privilege('authenticated', 'public.devis_lignes_figer()', 'execute'));
select banc.ok('le lot 30 ne nomme aucune table du devis',
  (select pg_get_functiondef('public.vider_la_base_du_bureau(uuid)'::regprocedure)) !~ 'devis');

-- ---------------------------------------------------------------------------
-- 5. U1 DANS B1 : ENREGISTRER, NUMEROTER, MODIFIER
-- ---------------------------------------------------------------------------
set role authenticated;
select banc.qui('11111111-1111-1111-1111-111111111111');

create temp table t_d1 as
select * from public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
  jsonb_build_array(banc.l(890, 12, 0, 'Muscadet', 'client'), banc.l(513, 24, 1000, 'Gros Plant', 'client')), 500, 'Livraison en mai');
select banc.ok('premier devis : D-AAAA-0001, annee de Paris',
  numero = 'D-' || extract(year from public.devis_jour(now()))::int || '-0001', numero) from t_d1;
select banc.ok('statut enregistre, validite = date + 30 jours, conditions copiees',
  statut = 'enregistre' and valable_jusqu = date_devis + 30 and paiement_mode = 'fdm' and paiement_jours = 30) from t_d1;
select banc.ok('signature posee par la base', cree_par = '11111111-1111-1111-1111-111111111111'
  and maj_par = '11111111-1111-1111-1111-111111111111') from t_d1;
select banc.ok('vendeur copie depuis le domaine', vendeur->>'raison_sociale' = 'EARL Domaine Un'
  and vendeur->>'siret' = '12345678900011' and vendeur->>'tva' = 'FR12123456789') from t_d1;
select banc.ok('acheteur client Vitisoft : nom, n° client, CP, ville, premier e-mail',
  acheteur->>'nom' = 'Cave du Quai' and num_client = 'C001' and acheteur->>'num_client' = 'C001'
  and acheteur->>'code_postal' = '44000' and acheteur->>'email' = 'cave@quai.fr'
  and acheteur->>'adresse' is null and client_cle = 'C001', acheteur::text) from t_d1;
-- Muscadet : 890, 0 % -> pu_l 890, g 5 % -> 845,5 -> 846 ; 12 -> net 10680, final 10152
-- Gros Plant : 513, 10 % -> 461,7 -> 462, g 5 % -> 438,9 -> 439 ; 24 -> net 11088, final 10536
-- vins 21768, HT 20688, remise 1080, TVA 4137,6 -> 4138, TTC 24826
select banc.ok('totaux du premier devis (regle du commercial)',
  total_vins_c = 21768 and total_ht_c = 20688 and remise_globale_c = 1080 and tva_c = 4138 and total_ttc_c = 24826,
  format('%s %s %s %s %s', total_vins_c, total_ht_c, remise_globale_c, tva_c, total_ttc_c)) from t_d1;
select banc.ok('lignes du premier devis',
  (select array_agg(format('%s:%s/%s/%s/%s', rang, pu_l_c, pu_f_c, net_c, final_c) order by rang)
     from public.devis_lignes where devis_id = (select devis_id from t_d1))
  = array['1:890/846/10680/10152', '2:462/439/11088/10536']);

create temp table t_d2 as
select * from public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', null,
  jsonb_build_array(banc.l(750, 6, 0, 'Folle Blanche', 'bureau')), 0, null);
select banc.ok('deuxieme devis : 0002', numero like '%-0002', numero) from t_d2;
select banc.ok('acheteur nouveau client : SIRET, adresse de la piste, pas de n° client',
  acheteur->>'nom' = 'Cave Neuve' and (acheteur->>'nouveau')::boolean and acheteur->>'siret' = '98765432100019'
  and acheteur->>'adresse' = '3 quai Neuf' and num_client is null and client_cle is null
  and piste_id = 'f1000000-0000-0000-0000-000000000001') from t_d2;

-- UN ECHEC APRES LE COMPTEUR REND LE NUMERO : la quantite « 6.5 » leve au moment des
-- lignes, donc apres l'increment. La transaction est defaite, le compteur avec elle.
select banc.refus('quantite non entiere : refusee (22P02)',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      '[{"designation":"X","quantite":"6.5","pu_ht_c":100}]'::jsonb, 0, null) $q$, '22P02');
select banc.refus('prix en euros au lieu de centimes : refuse (22P02)',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      '[{"designation":"X","quantite":1,"pu_ht_c":"8.50"}]'::jsonb, 0, null) $q$, '22P02');
create temp table t_d3 as
select * from public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', null,
  jsonb_build_array(banc.l(890, 6)), 0, null);
select banc.ok('apres deux echecs, le suivant est 0003 : aucun trou', numero like '%-0003', numero) from t_d3;
select banc.ok('piste devenue cliente : n° client relu dans ses ventes',
  num_client = 'C001' and client_cle = 'C001' and acheteur->>'nom' = 'Ancienne Piste'
  and not (acheteur->>'nouveau')::boolean) from t_d3;

create temp table t_d4 as
select * from public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005', null,
  jsonb_build_array(banc.l(900, 6)), 0, null);
select banc.ok('client sans numero Vitisoft : num_client vide, cle = nom',
  num_client is null and client_cle = 'Bistrot Sans Numero' and acheteur->>'email' = 'bistrot@x.fr') from t_d4;

-- LES REFUS
select banc.refus('affaire close : refusee',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', null,
      jsonb_build_array(banc.l(100, 1)), 0, null) $q$, '23514');
select banc.refus('zero ligne : refuse',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      '[]'::jsonb, 0, null) $q$, '23514');
select banc.refus('201 lignes : refuse',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      (select jsonb_agg(banc.l(100, 1)) from generate_series(1, 201)), 0, null) $q$, '23514');
select banc.refus('remise de ligne a 100,01 % : refusee',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      jsonb_build_array(banc.l(100, 1, 10001)), 0, null) $q$, '23514');
select banc.refus('remise negative : refusee',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      jsonb_build_array(banc.l(100, 1, -1)), 0, null) $q$, '23514');
select banc.refus('remise globale a 100,01 % : refusee',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      jsonb_build_array(banc.l(100, 1)), 10001, null) $q$, '23514');
select banc.refus('quantite 0 : refusee',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      jsonb_build_array(banc.l(100, 0)), 0, null) $q$, '23514');
select banc.refus('prix negatif : refuse',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      jsonb_build_array(banc.l(-1, 1)), 0, null) $q$, '23514');
select banc.refus('ligne sans designation : refusee',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      '[{"quantite":1,"pu_ht_c":100}]'::jsonb, 0, null) $q$, '23502');
select banc.refus('source de prix inconnue : refusee',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      jsonb_build_array(banc.l(100, 1, 0, 'X', 'devine')), 0, null) $q$, '23514');
select banc.refus('ecriture directe dans devis : refusee (42501)',
  $q$ update public.devis set total_ht_c = 1 $q$, '42501');
select banc.refus('insertion directe dans devis_lignes : refusee (42501)',
  $q$ insert into public.devis_lignes (bureau, devis_id, rang, designation, quantite, pu_ht_c, pu_l_c, pu_f_c, net_c, final_c)
      select bureau, devis_id, 9, 'X', 1, 1, 1, 1, 1, 1 from public.devis limit 1 $q$, '42501');
select banc.refus('suppression directe d''un devis : refusee (42501)',
  $q$ delete from public.devis $q$, '42501');
select banc.refus('lecture du compteur : refusee (42501)',
  $q$ select * from public.devis_compteurs $q$, '42501');

-- LA MODIFICATION : meme numero, meme date, lignes remplacees, instantanes RECOPIES.
reset role;
update public.domaine set raison_sociale = 'EARL Domaine Un Renomme', validite_jours = 45
 where bureau = 'b1000000-0000-0000-0000-000000000001';
set role authenticated;
create temp table t_d1b as
select * from public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
  (select devis_id from t_d1), jsonb_build_array(banc.l(890, 6, 0, 'Muscadet', 'client')), 0, 'Modifie');
select banc.ok('modification : meme numero et meme date',
  b.numero = a.numero and b.date_devis = a.date_devis and b.devis_id = a.devis_id) from t_d1 a, t_d1b b;
select banc.ok('modification : vendeur et validite recopies de la fiche du jour',
  vendeur->>'raison_sociale' = 'EARL Domaine Un Renomme' and validite_jours = 45
  and valable_jusqu = date_devis + 45) from t_d1b;
select banc.ok('modification : une seule ligne, totaux refaits',
  (select count(*) from public.devis_lignes where devis_id = t_d1b.devis_id) = 1
  and total_ht_c = 5340 and tva_c = 1068 and notes = 'Modifie') from t_d1b;
select banc.ok('modification : ne consomme pas de numero',
  (select count(*) from public.devis) = 4);
select banc.refus('modifier un devis sous une autre affaire : introuvable',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002',
      (select devis_id from t_d1), jsonb_build_array(banc.l(100, 1)), 0, null) $q$, 'P0002');

-- L'ABANDON : garde, numero compris, et fige.
create temp table t_ab as
select * from public.devis_abandonner('b1000000-0000-0000-0000-000000000001', (select devis_id from t_d2));
select banc.ok('abandon : statut abandonne, numero garde, date posee',
  statut = 'abandonne' and numero like '%-0002' and abandonne_le is not null) from t_ab;
select banc.ok('abandon deux fois : rendu tel quel',
  (select statut from public.devis_abandonner('b1000000-0000-0000-0000-000000000001', (select devis_id from t_d2))) = 'abandonne');
select banc.refus('devis abandonne : ne se modifie plus par la RPC',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002',
      (select devis_id from t_d2), jsonb_build_array(banc.l(100, 1)), 0, null) $q$, '23514');
reset role;
-- Meme le proprietaire de la base (qui passe les droits) bute sur les declencheurs.
select banc.refus('devis abandonne : UPDATE direct refuse, meme sans RLS',
  $q$ update public.devis set notes = 'x' where devis_id = (select devis_id from t_d2) $q$, '23514');
select banc.refus('devis abandonne : ses lignes ne changent plus',
  $q$ delete from public.devis_lignes where devis_id = (select devis_id from t_d2) $q$, '23514');
select banc.refus('devis abandonne : ne repasse pas a enregistre',
  $q$ update public.devis set statut = 'enregistre', abandonne_le = null where devis_id = (select devis_id from t_d2) $q$, '23514');
select banc.refus('un numero ne change jamais',
  $q$ update public.devis set numero = 'D-2026-0099', rang = 99 where devis_id = (select devis_id from t_d1) $q$, '23514');
select banc.refus('un devis signe sans preuve : refuse',
  $q$ update public.devis set statut = 'signe' where devis_id = (select devis_id from t_d1) $q$, '23514');

-- ---------------------------------------------------------------------------
-- 6. LA CLOISON : U2 NE VOIT RIEN DE B1, ET B1 NE LUI OUVRE RIEN
-- ---------------------------------------------------------------------------
set role authenticated;
select banc.qui('22222222-2222-2222-2222-222222222222');
select banc.ok('U2 lit zero devis de B1', (select count(*) from public.devis
  where bureau = 'b1000000-0000-0000-0000-000000000001') = 0);
select banc.ok('U2 lit zero ligne de B1', (select count(*) from public.devis_lignes
  where bureau = 'b1000000-0000-0000-0000-000000000001') = 0);
select banc.refus('U2 enregistre dans B1 : 42501',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      jsonb_build_array(banc.l(100, 1)), 0, null) $q$, '42501');
select banc.refus('U2 abandonne un devis de B1 : 42501',
  $q$ select public.devis_abandonner('b1000000-0000-0000-0000-000000000001', (select devis_id from t_d1)) $q$, '42501');
select banc.ok('U2 : propositions d''une affaire de B1 vides',
  (select count(*) from public.devis_propositions('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001')) = 0
  and (select count(*) from public.devis_propositions('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002')) = 0);
select banc.refus('B2, fiche du domaine incomplete : refuse',
  $q$ select public.devis_enregistrer('b2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', null,
      jsonb_build_array(banc.l(100, 1)), 0, null) $q$, '23514');
reset role;
update public.domaine set raison_sociale = 'Domaine Deux', siret = '11122233300044', adresse = '2 rue', code_postal = '49000', ville = 'Angers'
 where bureau = 'b2000000-0000-0000-0000-000000000002';
set role authenticated;
select banc.ok('B2 a son propre compteur : son premier devis est 0001',
  (select numero from public.devis_enregistrer('b2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', null,
      jsonb_build_array(banc.l(100, 1)), 0, null)) like '%-0001');
select banc.ok('B2 a reception : pas de jours, validite 15',
  (select paiement_mode = 'reception' and paiement_jours is null and validite_jours = 15 from public.devis
    where bureau = 'b2000000-0000-0000-0000-000000000002'));
select banc.qui(null);
select banc.refus('sans session : 42501',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      jsonb_build_array(banc.l(100, 1)), 0, null) $q$, '42501');
reset role;
set role anon;
select banc.qui(null);
select banc.refus('anon ne lit pas les devis', $q$ select * from public.devis $q$, '42501');
select banc.refus('anon n''appelle pas la RPC',
  $q$ select public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null,
      jsonb_build_array(banc.l(100, 1)), 0, null) $q$, '42501');
reset role;

-- ---------------------------------------------------------------------------
-- 7. L'ANNEE : lue a Paris, et le compteur repart a 1
-- ---------------------------------------------------------------------------
select banc.ok('31/12 a 23 h 30 a Paris : encore l''annee en cours',
  public.devis_jour('2026-12-31 23:30:00 Europe/Paris') = date '2026-12-31');
select banc.ok('1er janvier a 0 h 30 a Paris (23 h 30 UTC la veille) : annee suivante',
  public.devis_jour('2026-12-31 23:30:00+00') = date '2027-01-01');
select banc.ok('ete : 23 h 30 UTC le 30/06 est deja le 01/07 a Paris',
  public.devis_jour('2026-06-30 23:30:00+00') = date '2026-07-01');
-- Un compteur de l'an passe a 57 ne touche pas celui de l'annee.
insert into public.devis_compteurs values
  ('b2000000-0000-0000-0000-000000000002', extract(year from public.devis_jour(now()))::int - 1, 57);
set role authenticated;
select banc.qui('22222222-2222-2222-2222-222222222222');
select banc.ok('un compteur par annee : l''an passe a 57 n''avance pas celui de l''annee',
  (select numero from public.devis_enregistrer('b2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', null,
      jsonb_build_array(banc.l(100, 1)), 0, null)) like '%-0002');
reset role;
select banc.ok('le 10 000e devis ne se tronque pas',
  'D-2026-' || lpad(10000::text, greatest(4, length(10000::text)), '0') = 'D-2026-10000');

-- ---------------------------------------------------------------------------
-- 8. LES VINS PROPOSES
-- ---------------------------------------------------------------------------
set role authenticated;
select banc.qui('11111111-1111-1111-1111-111111111111');
create temp table t_pc as
select * from public.devis_propositions('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001');
select banc.ok('client : deux vins, pas d''offert, d''avoir ni de PLV',
  (select array_agg(designation order by derniere_vente desc) from t_pc) = array['Muscadet', 'Gros Plant'],
  (select string_agg(designation, ',') from t_pc));
select banc.ok('client : dernier prix, derniere quantite, date, deux ventes',
  (select pu_ht_c = 890 and derniere_qte = 12 and derniere_vente = current_date - 20 and nb_ventes = 2
          and source = 'client' and num_produit = 'M1' from t_pc where designation = 'Muscadet'));
select banc.ok('client : prix a trois decimales arrondi au centime (5,125 -> 513)',
  (select pu_ht_c from t_pc where designation = 'Gros Plant') = 513);
create temp table t_pn as
select * from public.devis_propositions('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002');
select banc.ok('nouveau client : les vins du bureau sur 12 mois, sans le vieux millesime ni B2',
  (select count(*) from t_pn where designation in ('Vieux Millesime', 'Secret')) = 0
  and (select bool_and(source = 'bureau' and derniere_qte is null) from t_pn));
select banc.ok('nouveau client : prix le plus courant, a egalite le plus haut (7,50)',
  (select pu_ht_c from t_pn where designation = 'Folle Blanche') = 750);
select banc.ok('nouveau client : classe par nombre de ventes (Muscadet 3, Folle Blanche 4)',
  (select array_agg(designation) from t_pn) = array['Folle Blanche', 'Muscadet', 'Gros Plant'],
  (select string_agg(designation || ':' || nb_ventes, ',') from t_pn));
select banc.ok('nouveau client : Muscadet vendu une fois a 8,50, 8,90 et 9,00 : a egalite, 9,00',
  (select pu_ht_c from t_pn where designation = 'Muscadet') = 900);
select banc.ok('piste devenue cliente : les ventes du client',
  (select bool_and(source = 'client') from public.devis_propositions('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004')));
select banc.ok('client, « tout le domaine » : la liste du bureau',
  (select bool_and(source = 'bureau') and count(*) = 3
     from public.devis_propositions('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', true)));
select banc.ok('affaire inconnue : rien',
  (select count(*) from public.devis_propositions('b1000000-0000-0000-0000-000000000001', gen_random_uuid())) = 0);
reset role;

-- ---------------------------------------------------------------------------
-- 9. LES CALCULS : cas de ce fichier, puis table partagee avec le navigateur
-- ---------------------------------------------------------------------------
-- Chaque cas : les lignes (pu_c, qte, remise_cb), la remise globale, et l'attendu
-- calcule A LA MAIN par la regle de la section C.
create temp table t_cas (nom text, cas jsonb);
insert into t_cas values
 ('sans remise', '{"lignes":[{"pu_c":850,"qte":6,"remise_cb":0}],"remise_globale_cb":0,
   "attendu":{"lignes":[{"pu_l":850,"pu_f":850,"net":5100,"final":5100}],"total_vins":5100,"remise_globale":0,"total_ht":5100,"tva":1020,"ttc":6120}}'),
 ('demi centime vers le haut', '{"lignes":[{"pu_c":1005,"qte":1,"remise_cb":5000}],"remise_globale_cb":0,
   "attendu":{"lignes":[{"pu_l":503,"pu_f":503,"net":503,"final":503}],"total_vins":503,"remise_globale":0,"total_ht":503,"tva":101,"ttc":604}}'),
 ('remise ligne 100 % et 12,5 % + globale 5 %', '{"lignes":[{"pu_c":1200,"qte":2,"remise_cb":10000},{"pu_c":999,"qte":3,"remise_cb":1250}],"remise_globale_cb":500,
   "attendu":{"lignes":[{"pu_l":0,"pu_f":0,"net":0,"final":0},{"pu_l":874,"pu_f":830,"net":2622,"final":2490}],"total_vins":2622,"remise_globale":132,"total_ht":2490,"tva":498,"ttc":2988}}'),
 ('remise globale 100 %', '{"lignes":[{"pu_c":1500,"qte":12,"remise_cb":0}],"remise_globale_cb":10000,
   "attendu":{"lignes":[{"pu_l":1500,"pu_f":0,"net":18000,"final":0}],"total_vins":18000,"remise_globale":18000,"total_ht":0,"tva":0,"ttc":0}}'),
 ('prix nul', '{"lignes":[{"pu_c":0,"qte":6,"remise_cb":0}],"remise_globale_cb":2500,
   "attendu":{"lignes":[{"pu_l":0,"pu_f":0,"net":0,"final":0}],"total_vins":0,"remise_globale":0,"total_ht":0,"tva":0,"ttc":0}}'),
 ('bornes : 99 999,99 EUR x 99 999', '{"lignes":[{"pu_c":9999999,"qte":99999,"remise_cb":1}],"remise_globale_cb":1,
   "attendu":{"lignes":[{"pu_l":9998999,"pu_f":9997999,"net":999889901001,"final":999789902001}],"total_vins":999889901001,"remise_globale":99999000,"total_ht":999789902001,"tva":199957980400,"ttc":1199747882401}}'),
 ('quart de centime : 0,25 -> 0', '{"lignes":[{"pu_c":1,"qte":1,"remise_cb":7500}],"remise_globale_cb":0,
   "attendu":{"lignes":[{"pu_l":0,"pu_f":0,"net":0,"final":0}],"total_vins":0,"remise_globale":0,"total_ht":0,"tva":0,"ttc":0}}'),
 ('TVA sur le total, pas par ligne : 3 x 0,02 -> 0,01 (par ligne ce serait 0)', '{"lignes":[{"pu_c":2,"qte":1,"remise_cb":0},{"pu_c":2,"qte":1,"remise_cb":0},{"pu_c":2,"qte":1,"remise_cb":0}],"remise_globale_cb":0,
   "attendu":{"lignes":[{"pu_l":2,"pu_f":2,"net":2,"final":2},{"pu_l":2,"pu_f":2,"net":2,"final":2},{"pu_l":2,"pu_f":2,"net":2,"final":2}],"total_vins":6,"remise_globale":0,"total_ht":6,"tva":1,"ttc":7}}'),
 ('TVA 0,6 centime vers le haut', '{"lignes":[{"pu_c":3,"qte":1,"remise_cb":0}],"remise_globale_cb":0,
   "attendu":{"lignes":[{"pu_l":3,"pu_f":3,"net":3,"final":3}],"total_vins":3,"remise_globale":0,"total_ht":3,"tva":1,"ttc":4}}');
-- 200 lignes a 1 centime, 50 % puis 50 % : chaque demi centime monte, 200 x 1.
insert into t_cas
select '200 lignes, demis centimes', jsonb_build_object(
  'lignes', (select jsonb_agg('{"pu_c":1,"qte":1,"remise_cb":5000}'::jsonb) from generate_series(1, 200)),
  'remise_globale_cb', 5000,
  'attendu', jsonb_build_object(
    'lignes', (select jsonb_agg('{"pu_l":1,"pu_f":1,"net":1,"final":1}'::jsonb) from generate_series(1, 200)),
    'total_vins', 200, 'remise_globale', 0, 'total_ht', 200, 'tva', 40, 'ttc', 240));

-- LA TABLE PARTAGEE, si l'autre moitie du lot l'a ecrite.
\set fixture `cat ../scripts/fixtures/devis-calculs.json 2>/dev/null || echo '{"cas":[]}'`
create temp table t_fixture as select :'fixture'::jsonb as f;
insert into t_cas select 'table partagee : ' || coalesce(c->>'nom', '?'), c
  from t_fixture, jsonb_array_elements(f->'cas') c;
select banc.ok('table partagee lue (' || jsonb_array_length(f->'cas') || ' cas, 0 = fichier absent)', true) from t_fixture;

grant select on t_cas to authenticated;
set role authenticated;
select banc.qui('11111111-1111-1111-1111-111111111111');
do $$
declare c record; d public.devis; att jsonb; got jsonb; lg jsonb;
begin
  for c in select * from t_cas order by nom loop
    select jsonb_agg(jsonb_build_object('designation', 'Ligne ' || o, 'quantite', (x->>'qte')::int,
                     'pu_ht_c', (x->>'pu_c')::bigint, 'remise_cb', coalesce((x->>'remise_cb')::int, 0),
                     'source_prix', 'saisi') order by o)
      into lg from jsonb_array_elements(c.cas->'lignes') with ordinality as e(x, o);
    d := public.devis_enregistrer('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000006',
                                  null, lg, (c.cas->>'remise_globale_cb')::int, null);
    att := c.cas->'attendu';
    got := jsonb_build_object(
      'lignes', (select jsonb_agg(jsonb_build_object('pu_l', pu_l_c, 'pu_f', pu_f_c, 'net', net_c, 'final', final_c) order by rang)
                   from public.devis_lignes where bureau = d.bureau and devis_id = d.devis_id),
      'total_vins', d.total_vins_c, 'remise_globale', d.remise_globale_c, 'total_ht', d.total_ht_c,
      'tva', d.tva_c, 'ttc', d.total_ttc_c);
    perform banc.ok('calcul : ' || c.nom,
      got->'lignes' = att->'lignes'
      and (got->>'total_vins')::bigint = (att->>'total_vins')::bigint
      and (got->>'remise_globale')::bigint = (att->>'remise_globale')::bigint
      and (got->>'total_ht')::bigint = (att->>'total_ht')::bigint
      and (got->>'tva')::bigint = (att->>'tva')::bigint
      and (got->>'ttc')::bigint = (att->>'ttc')::bigint,
      'rendu ' || (got - 'lignes')::text);
  end loop;
end $$;
select banc.ok('colonne 23 x quantite = colonne 24, sur toutes les lignes',
  not exists (select 1 from public.devis_lignes where final_c <> quantite::bigint * pu_f_c));
reset role;

-- ---------------------------------------------------------------------------
-- 10. « VIDER LA BASE » NE TOUCHE NI AUX DEVIS, NI AU COMPTEUR, NI AU DOMAINE
-- ---------------------------------------------------------------------------
create temp table t_avant as select
  (select count(*) from public.devis where bureau = 'b1000000-0000-0000-0000-000000000001') as d,
  (select count(*) from public.devis_lignes where bureau = 'b1000000-0000-0000-0000-000000000001') as l,
  (select dernier from public.devis_compteurs where bureau = 'b1000000-0000-0000-0000-000000000001'
     and annee = extract(year from public.devis_jour(now()))::int) as c;
set role authenticated;
select banc.qui('11111111-1111-1111-1111-111111111111');
select banc.ok('le vidage a vide les ventes', (public.vider_la_base_du_bureau('b1000000-0000-0000-0000-000000000001')->>'vide')::boolean);
reset role;
select banc.ok('apres le vidage : memes devis, memes lignes, meme compteur, domaine present',
  a.d = (select count(*) from public.devis where bureau = 'b1000000-0000-0000-0000-000000000001')
  and a.l = (select count(*) from public.devis_lignes where bureau = 'b1000000-0000-0000-0000-000000000001')
  and a.c = (select dernier from public.devis_compteurs where bureau = 'b1000000-0000-0000-0000-000000000001'
               and annee = extract(year from public.devis_jour(now()))::int)
  and exists (select 1 from public.domaine where bureau = 'b1000000-0000-0000-0000-000000000001')
  and (select count(*) from public.ventes_lignes where bureau = 'b1000000-0000-0000-0000-000000000001') = 0)
  from t_avant a;
set role authenticated;
select banc.ok('apres le vidage : les propositions sont vides, le devis garde ses instantanes',
  (select count(*) from public.devis_propositions('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002')) = 0
  and (select acheteur->>'nom' from public.devis where devis_id = (select devis_id from t_d1)) = 'Cave du Quai');
reset role;

-- ---------------------------------------------------------------------------
-- 11. SUPPRIMER UN BUREAU EMPORTE SES DEVIS, MEME ABANDONNES
-- ---------------------------------------------------------------------------
-- Les declencheurs de gel ne doivent pas bloquer la cascade.
set role authenticated;
select banc.qui('22222222-2222-2222-2222-222222222222');
select public.devis_abandonner('b2000000-0000-0000-0000-000000000002',
  (select devis_id from public.devis where bureau = 'b2000000-0000-0000-0000-000000000002' order by rang limit 1));
reset role;
select banc.refus('une affaire qui porte un devis ne se supprime pas',
  $q$ delete from public.affaires where bureau = 'b2000000-0000-0000-0000-000000000002' $q$, '23503');
delete from public.bureaux where bureau = 'b2000000-0000-0000-0000-000000000002';
select banc.ok('bureau supprime : ses devis, lignes et compteurs partent avec lui',
  not exists (select 1 from public.devis where bureau = 'b2000000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.devis_lignes where bureau = 'b2000000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.devis_compteurs where bureau = 'b2000000-0000-0000-0000-000000000002'));
select banc.ok('B1 intact apres la suppression de B2',
  (select count(*) from public.devis where bureau = 'b1000000-0000-0000-0000-000000000001') > 0);

-- ---------------------------------------------------------------------------
-- LE BILAN
-- ---------------------------------------------------------------------------
\o
\set QUIET off
\pset tuples_only on
select 'BANC DU DEVIS : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
