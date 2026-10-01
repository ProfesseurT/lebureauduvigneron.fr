-- ===========================================================================
-- BANC DU LOT 51 (mentions, refus, annulation d'un accord), 01/10/2026.
-- NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 50 (qui rejoue 49 et 47), puis passe DEUX FOIS
-- supabase/lot51-devis-mentions-refus.sql.
--   initdb -D /tmp/pg51 -A trust
--   pg_ctl -D /tmp/pg51 -o "-k /tmp -p 55451" start
--   psql -h /tmp -p 55451 -d postgres -c "create database banc51"
--   psql -h /tmp -p 55451 -d banc51 -v ON_ERROR_STOP=1 -f banc-lot51-devis-mentions-refus.sql
-- Derniere ligne attendue : « BANC DU LOT 51 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot50-devis-envoye.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
\ir lot51-devis-mentions-refus.sql
\ir lot51-devis-mentions-refus.sql
truncate banc.resultats;

-- LE DECOR : le bureau cinq du lot 50, six affaires de plus.
insert into public.affaires (bureau, affaire_id, type_id, etape_id, client_id, client_nom, titre, issue) values
  ('b5000000-0000-0000-0000-000000000005', 'c5100000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'R1', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5100000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'R2', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5100000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'A1', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5100000-0000-0000-0000-000000000004', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'A2', 'en_cours');
update public.domaine set rcs_ville = 'Nantes', capital_eur = 7500 where bureau = 'b5000000-0000-0000-0000-000000000005';

set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
create temp table t_51 (k text primary key, id uuid);
grant all on t_51 to authenticated;
insert into t_51 select 'r1', (public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5100000-0000-0000-0000-000000000001', null, jsonb_build_array(banc.l(1000, 6)))).devis_id;
insert into t_51 select 'r2a', (public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5100000-0000-0000-0000-000000000002', null, jsonb_build_array(banc.l(1000, 6)))).devis_id;
insert into t_51 select 'r2b', (public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5100000-0000-0000-0000-000000000002', null, jsonb_build_array(banc.l(900, 6)))).devis_id;
insert into t_51 select 'a1', (public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5100000-0000-0000-0000-000000000003', null, jsonb_build_array(banc.l(1000, 6)))).devis_id;
insert into t_51 select 'a2', (public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5100000-0000-0000-0000-000000000004', null, jsonb_build_array(banc.l(1000, 6)))).devis_id;

-- 1. LES DROITS ET LES MENTIONS
select banc.ok('anon ne peut ni refuser ni annuler',
  not has_function_privilege('anon', 'public.devis_refuser(uuid, uuid, text, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.devis_annuler_accord(uuid, uuid, boolean)', 'execute'));
select banc.ok('authenticated peut refuser et annuler',
  has_function_privilege('authenticated', 'public.devis_refuser(uuid, uuid, text, boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.devis_annuler_accord(uuid, uuid, boolean)', 'execute'));
select banc.ok('toujours une seule signature de devis_enregistrer, a 7 arguments',
  (select count(*) from pg_proc where proname = 'devis_enregistrer') = 1
  and (select pronargs from pg_proc where proname = 'devis_enregistrer') = 7);
select banc.ok('le vendeur du devis porte le RCS et le capital',
  (select vendeur->>'rcs_ville' = 'Nantes' and (vendeur->>'capital_eur')::bigint = 7500 from public.devis where devis_id = (select id from t_51 where k = 'r1')));
reset role;
select banc.refus('un capital a zero est refuse',
  $q$ update public.domaine set capital_eur = 0 where bureau = 'b5000000-0000-0000-0000-000000000005' $q$, '23514');
select banc.refus('une ville de greffe vide est refusee',
  $q$ update public.domaine set rcs_ville = '  ' where bureau = 'b5000000-0000-0000-0000-000000000005' $q$, '23514');
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');

-- 2. REFUSER
select banc.refus('un motif inconnu est refuse',
  $q$ select public.devis_refuser('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'r1'), 'trop_cher') $q$, '23514');
select banc.refus('clore une affaire qui a un autre devis en cours : refuse',
  $q$ select public.devis_refuser('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'r2a'), 'prix', true) $q$, '23514');
select banc.ok('... et rien n a bouge (devis enregistre, affaire en cours)',
  (select statut from public.devis where devis_id = (select id from t_51 where k = 'r2a')) = 'enregistre'
  and (select issue from public.affaires where affaire_id = 'c5100000-0000-0000-0000-000000000002') = 'en_cours');
select banc.qui('44444444-4444-4444-4444-444444444444');
select banc.refus('un autre bureau ne peut pas refuser',
  $q$ select public.devis_refuser('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'r1')) $q$, '42501');
select banc.qui('55555555-5555-5555-5555-555555555555');
select banc.ok('refuser sans clore : statut, date, auteur, motif ; l affaire reste en cours',
  (select statut = 'refuse' and refuse_le is not null and refuse_par = '55555555-5555-5555-5555-555555555555' and refuse_motif = 'prix'
     from public.devis_refuser('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'r2a'), 'prix', false)));
select banc.ok('... l affaire reste en cours', (select issue from public.affaires where affaire_id = 'c5100000-0000-0000-0000-000000000002') = 'en_cours');
select banc.ok('sans motif : « autre »',
  (select refuse_motif = 'autre' from public.devis_refuser('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'r2b'))));
select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'r1'), null, current_date + 7);
select banc.ok('refuser un devis ENVOYE en closant : il garde sa date d envoi',
  (select statut = 'refuse' and envoye_le is not null from public.devis_refuser('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'r1'), 'moment', true)));
select banc.ok('... affaire perdue, meme motif, rappel efface',
  (select issue = 'perdue' and motif = 'moment' and rappel is null from public.affaires where affaire_id = 'c5100000-0000-0000-0000-000000000001'));
select banc.ok('double appui : rendu tel quel',
  (select refuse_motif from public.devis_refuser('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'r1'), 'prix')) = 'moment');
select banc.refus('un devis refuse ne s accepte pas',
  $q$ select public.devis_accepter('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'r2a')) $q$, '23514');
select banc.refus('ni ne s abandonne',
  $q$ select public.devis_abandonner('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'r2a')) $q$, '23514');
select banc.refus('ni ne se modifie',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5100000-0000-0000-0000-000000000002', (select id from t_51 where k = 'r2a'), jsonb_build_array(banc.l(1, 1))) $q$, '23514');
reset role;
select banc.refus('meme le proprietaire ne change pas un devis refuse',
  $q$ update public.devis set refuse_motif = 'autre' where devis_id = (select id from t_51 where k = 'r2a') $q$, '23514');
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
create temp table t_51n as select * from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005',
  'c5100000-0000-0000-0000-000000000002', null, jsonb_build_array(banc.l(800, 6)), 0, null, (select id from t_51 where k = 'r2a'));
select banc.ok('un devis refuse se REFAIT : le nouveau porte version_de, l ancien RESTE refuse',
  (select version_de = (select id from t_51 where k = 'r2a') from t_51n)
  and (select statut from public.devis where devis_id = (select id from t_51 where k = 'r2a')) = 'refuse');

-- 3. ANNULER UNE ACCEPTATION
select banc.refus('annuler un devis non accepte : refuse',
  $q$ select public.devis_annuler_accord('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'a1')) $q$, '23514');
select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'a1'));
select public.devis_accepter('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'a1'));
select banc.ok('decor : a1 accepte, affaire gagnee',
  (select statut from public.devis where devis_id = (select id from t_51 where k = 'a1')) = 'accepte'
  and (select issue from public.affaires where affaire_id = 'c5100000-0000-0000-0000-000000000003') = 'gagnee');
select banc.qui('44444444-4444-4444-4444-444444444444');
select banc.refus('un autre bureau ne peut pas annuler',
  $q$ select public.devis_annuler_accord('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'a1')) $q$, '42501');
select banc.qui('55555555-5555-5555-5555-555555555555');
select banc.ok('annuler un devis ENVOYE puis accepte : il revient envoye, accord efface, trace posee',
  (select statut = 'envoye' and accepte_le is null and accepte_par is null and code_tarif is null
          and accord_annule_le is not null and accord_annule_par = '55555555-5555-5555-5555-555555555555' and envoye_le is not null
     from public.devis_annuler_accord('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'a1'))));
select banc.ok('... et l affaire est rouverte',
  (select issue = 'en_cours' and close_le is null from public.affaires where affaire_id = 'c5100000-0000-0000-0000-000000000003'));
select banc.ok('il se re-accepte (une seule commande, le meme numero)',
  (select statut = 'accepte' from public.devis_accepter('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'a1'))));
select public.devis_accepter('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'a2'));
select banc.ok('annuler un devis accepte sans envoi, sans rouvrir : il revient enregistre, affaire toujours gagnee',
  (select statut = 'enregistre' and envoye_le is null
     from public.devis_annuler_accord('b5000000-0000-0000-0000-000000000005', (select id from t_51 where k = 'a2'), false)));
select banc.ok('... affaire toujours gagnee', (select issue from public.affaires where affaire_id = 'c5100000-0000-0000-0000-000000000004') = 'gagnee');
reset role;
select banc.refus('l annulation ne passe pas par un UPDATE direct qui change aussi un prix',
  $q$ update public.devis set statut = 'envoye', accepte_le = null, accord_annule_le = now(), notes = 'x'
       where devis_id = (select id from t_51 where k = 'a1') $q$, '23514');
select banc.refus('ni vers un statut qui ne colle pas a l envoi (enregistre alors qu il etait parti)',
  $q$ update public.devis set statut = 'enregistre', accepte_le = null, accord_annule_le = now()
       where devis_id = (select id from t_51 where k = 'a1') $q$, '23514');
select banc.refus('ni sans trace d annulation',
  $q$ update public.devis set statut = 'envoye', accepte_le = null where devis_id = (select id from t_51 where k = 'a1') $q$, '23514');

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 51 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
