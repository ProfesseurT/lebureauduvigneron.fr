-- ===========================================================================
-- BANC DU LOT 80 (les nouveaux clients), 08/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue tout le banc du lot 78, donne a `suivi_clients` et `echanges` leurs
-- vraies colonnes (le decor les avait reduites), puis passe DEUX FOIS
-- lot80-nouveaux-clients.sql.
--   psql -h /tmp -p 55480 -U postgres -d banc80 -v ON_ERROR_STOP=1 -f banc-lot80-nouveaux-clients.sql
-- Derniere ligne attendue : « BANC DU LOT 80 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot78-nom-affiche.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);

alter table public.suivi_clients add column if not exists notes text;
alter table public.suivi_clients add column if not exists tags text[] not null default '{}';
alter table public.suivi_clients add column if not exists maj_le timestamptz not null default now();
alter table public.echanges add column if not exists client_id text;
alter table public.echanges add column if not exists le timestamptz not null default now();
alter table public.echanges add column if not exists type text;
alter table public.echanges add column if not exists resume text;

\ir lot80-nouveaux-clients.sql
\ir lot80-nouveaux-clients.sql
truncate banc.resultats;

insert into public.pistes (bureau, piste_id, nom) values
  ('b8000000-0000-0000-0000-000000000008', '98000000-0000-0000-0000-0000000000b8', 'Ailleurs fixe')
  on conflict do nothing;
-- b6 : maitre 6666, pistes 96..02 (libre), 96..01 (opposee), Deja Vitisoft (reliee a C080).
-- b8 : piste « Ailleurs ».
delete from public.suivi_clients where bureau in ('b6000000-0000-0000-0000-000000000006', 'b8000000-0000-0000-0000-000000000008');
delete from public.echanges      where bureau in ('b6000000-0000-0000-0000-000000000006', 'b8000000-0000-0000-0000-000000000008');

insert into public.pistes (bureau, piste_id, nom, client_id) values
  ('b6000000-0000-0000-0000-000000000006', '98000000-0000-0000-0000-0000000000c1', 'Deja Vitisoft', 'C080')
  on conflict do nothing;

select banc.ok('piste_de_cle lit une cle de nouveau client',
  public.piste_de_cle('p:96000000-0000-0000-0000-000000000002') = '96000000-0000-0000-0000-000000000002'
  and public.piste_de_cle('C079') is null and public.piste_de_cle('p:abc') is null and public.piste_de_cle(null) is null);

insert into public.suivi_clients (bureau, client_id, rappel, rappel_titre, tags)
  values ('b6000000-0000-0000-0000-000000000006', 'p:96000000-0000-0000-0000-000000000002', current_date, 'Le rappeler', '{VIP}');
insert into public.echanges (bureau, client_id, type, resume)
  values ('b6000000-0000-0000-0000-000000000006', 'p:96000000-0000-0000-0000-000000000002', 'note', 'Appel, il rappelle jeudi');
select banc.ok('un suivi et une note sur un nouveau client sont acceptes',
  (select count(*) = 1 from public.suivi_clients where client_id = 'p:96000000-0000-0000-0000-000000000002')
  and (select count(*) = 1 from public.echanges where client_id = 'p:96000000-0000-0000-0000-000000000002'));
insert into public.suivi_clients (bureau, client_id, rappel) values ('b6000000-0000-0000-0000-000000000006', '706', current_date);
select banc.ok('un client Vitisoft (numero) passe comme avant',
  (select count(*) = 1 from public.suivi_clients where bureau = 'b6000000-0000-0000-0000-000000000006' and client_id = '706'));

select banc.refus('une cle mal formee est refusee',
  $q$ insert into public.suivi_clients (bureau, client_id) values ('b6000000-0000-0000-0000-000000000006', 'p:abc') $q$, '22023');
select banc.refus('la piste d un autre bureau est refusee',
  $q$ insert into public.suivi_clients (bureau, client_id) values ('b6000000-0000-0000-0000-000000000006', 'p:98000000-0000-0000-0000-0000000000b8') $q$, '23503');
select banc.refus('une piste en opposition est refusee',
  $q$ insert into public.suivi_clients (bureau, client_id) values ('b6000000-0000-0000-0000-000000000006', 'p:96000000-0000-0000-0000-000000000001') $q$, '42501');
select banc.refus('une piste deja reliee a Vitisoft est refusee',
  $q$ insert into public.suivi_clients (bureau, client_id) values ('b6000000-0000-0000-0000-000000000006', 'p:98000000-0000-0000-0000-0000000000c1') $q$, '23514');
select banc.refus('le journal refuse aussi une cle d un autre bureau',
  $q$ insert into public.echanges (bureau, client_id, type, resume) values ('b6000000-0000-0000-0000-000000000006', 'p:98000000-0000-0000-0000-0000000000b8', 'note', 'x') $q$, '23503');
select banc.refus('on ne deplace pas un suivi vers une cle invalide',
  $q$ update public.suivi_clients set client_id = 'p:96000000-0000-0000-0000-000000000001' where client_id = '706' and bureau = 'b6000000-0000-0000-0000-000000000006' $q$, '42501');

-- LE NOM
select banc.ok('nom_du_client : le nom de la piste pour une cle p:, celui de la piste reliee pour un numero',
  public.nom_du_client('b6000000-0000-0000-0000-000000000006', 'p:96000000-0000-0000-0000-000000000002') = 'Autre Piste'
  and public.nom_du_client('b6000000-0000-0000-0000-000000000006', 'C080') = 'Deja Vitisoft'
  and public.nom_du_client('b6000000-0000-0000-0000-000000000006', '999') is null);
set role authenticated;
select banc.qui('44444444-4444-4444-4444-444444444444');
select banc.ok('un compte d un autre bureau ne lit pas le nom (fonction aux droits de l appelant)',
  public.nom_du_client('b6000000-0000-0000-0000-000000000006', 'p:96000000-0000-0000-0000-000000000002') is null);
select banc.qui('66666666-6666-6666-6666-666666666666');
select banc.ok('un membre du bureau lit le nom',
  public.nom_du_client('b6000000-0000-0000-0000-000000000006', 'p:96000000-0000-0000-0000-000000000002') = 'Autre Piste');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('anon ne peut pas appeler nom_du_client',
  not has_function_privilege('anon', 'public.nom_du_client(uuid, text)', 'execute'));

-- LE COURRIER
select banc.ok('v_courrier garde ses onze colonnes, dans le meme ordre',
  (select string_agg(attname, ',' order by attnum) from pg_attribute
    where attrelid = 'public.v_courrier'::regclass and attnum > 0)
  = 'id,email,jeton_emails,depose_le,noms,signaux,suivis,taches,resume_ventes,affaires,signes');
select banc.ok('v_courrier reste security_invoker',
  (select reloptions @> '{security_invoker=true}' from pg_class where relname = 'v_courrier'));
select banc.ok('chaque suivi du courrier porte le nom',
  pg_get_viewdef('public.v_courrier'::regclass) like '%nom_du_client(sc.bureau, sc.client_id)%');
select banc.ok('la fonction du soir nomme par nom_du_client, deux fois, et plus par la recherche d avant',
  (select (length(d) - length(replace(d, 'nom_du_client(s.bureau, s.client_id)', ''))) / length('nom_du_client(s.bureau, s.client_id)') = 2
          and position('p.client_id = s.client_id' in d) = 0
     from pg_get_functiondef('public.notif_horaire_lots(text, timestamptz, int)'::regprocedure) d));

-- VIDER LA BASE
insert into public.echanges (bureau, client_id, type, resume) values ('b6000000-0000-0000-0000-000000000006', '706', 'note', 'Vitisoft');
insert into public.ventes (bureau, empreinte) values ('b6000000-0000-0000-0000-000000000006', 'e80') on conflict do nothing;
set role authenticated;
select banc.qui('77777777-7777-7777-7777-777777777777');
select banc.refus('un simple utilisateur ne vide pas',
  $q$ select public.vider_la_base_du_bureau('b6000000-0000-0000-0000-000000000006') $q$, 'P0001');
select banc.qui('66666666-6666-6666-6666-666666666666');
create temp table vid as select public.vider_la_base_du_bureau('b6000000-0000-0000-0000-000000000006') as r;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('le vidage efface le suivi et le journal Vitisoft, et le dit',
  (select (r->>'vide')::boolean and (r->>'suivi')::int = 1 and (r->>'echanges')::int = 1 and (r->>'ventes')::int >= 1 from vid));
select banc.ok('le vidage garde le nouveau client (2 lignes gardees, et il le dit)',
  (select (r->>'gardes')::int = 2 and (r->>'reste_total')::int = 0 from vid)
  and (select count(*) = 1 from public.suivi_clients where client_id = 'p:96000000-0000-0000-0000-000000000002')
  and (select count(*) = 1 from public.echanges where client_id = 'p:96000000-0000-0000-0000-000000000002'));
select banc.ok('les champs rendus d avant n ont pas change de nom',
  (select r ?& array['vide','ventes','lignes','suivi','echanges','resumes','reste','reste_total'] from vid));

-- L'OPPOSITION
update public.pistes set opposition = true where piste_id = '96000000-0000-0000-0000-000000000002';
select banc.ok('l opposition supprime sa fiche et vide le texte de son journal (la date reste)',
  (select count(*) = 0 from public.suivi_clients where client_id = 'p:96000000-0000-0000-0000-000000000002')
  and (select count(*) = 1 and bool_and(resume is null) from public.echanges where client_id = 'p:96000000-0000-0000-0000-000000000002'));
select banc.refus('apres l opposition, plus rien ne s ecrit sur sa fiche',
  $q$ insert into public.suivi_clients (bureau, client_id) values ('b6000000-0000-0000-0000-000000000006', 'p:96000000-0000-0000-0000-000000000002') $q$, '42501');
update public.pistes set opposition = false where piste_id = '96000000-0000-0000-0000-000000000002';

-- LA PURGE A TROIS ANS
insert into public.pistes (bureau, piste_id, nom, email) values
  ('b6000000-0000-0000-0000-000000000006', '98000000-0000-0000-0000-000000000001', 'Vieille sans geste', 'v1@exemple.fr'),
  ('b6000000-0000-0000-0000-000000000006', '98000000-0000-0000-0000-000000000002', 'Vieille note recente', 'v2@exemple.fr'),
  ('b6000000-0000-0000-0000-000000000006', '98000000-0000-0000-0000-000000000003', 'Vieille fiche seule', null)
  on conflict do nothing;
insert into public.suivi_clients (bureau, client_id, rappel, maj_le) values
  ('b6000000-0000-0000-0000-000000000006', 'p:98000000-0000-0000-0000-000000000001', date '2021-01-01', now() - interval '4 years'),
  ('b6000000-0000-0000-0000-000000000006', 'p:98000000-0000-0000-0000-000000000003', null, now() - interval '4 years');
insert into public.echanges (bureau, client_id, type, resume, le) values
  ('b6000000-0000-0000-0000-000000000006', 'p:98000000-0000-0000-0000-000000000001', 'note', 'vieux', now() - interval '4 years'),
  ('b6000000-0000-0000-0000-000000000006', 'p:98000000-0000-0000-0000-000000000002', 'note', 'recent', now() - interval '2 months');
alter table public.pistes disable trigger user;
update public.pistes set maj_le = now() - interval '4 years' where piste_id::text like '98000000%';
alter table public.pistes enable trigger user;
select public.pistes_purger();
select banc.ok('une vieille piste sans geste perd ses coordonnees, sa fiche et le texte de son journal',
  (select email is null from public.pistes where piste_id = '98000000-0000-0000-0000-000000000001')
  and (select count(*) = 0 from public.suivi_clients where client_id = 'p:98000000-0000-0000-0000-000000000001')
  and (select bool_and(resume is null) from public.echanges where client_id = 'p:98000000-0000-0000-0000-000000000001'));
select banc.ok('une note de moins de trois ans est un geste : la piste est gardee',
  (select email = 'v2@exemple.fr' from public.pistes where piste_id = '98000000-0000-0000-0000-000000000002')
  and (select resume = 'recent' from public.echanges where client_id = 'p:98000000-0000-0000-0000-000000000002'));
select banc.ok('une vieille fiche seule (sans coordonnees) est purgee aussi',
  (select count(*) = 0 from public.suivi_clients where client_id = 'p:98000000-0000-0000-0000-000000000003'));

select banc.ok('les fonctions internes ne sont pas appelables par un compte',
  not has_function_privilege('authenticated', 'public.cle_client_verifier()', 'execute')
  and not has_function_privilege('authenticated', 'public.pistes_purger()', 'execute'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 80 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select nom, detail from banc.resultats where not ok;
