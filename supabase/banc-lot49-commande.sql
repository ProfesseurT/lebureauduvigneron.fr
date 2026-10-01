-- ===========================================================================
-- BANC DE LA COMMANDE, lot 49, 01/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 47 (decor, vrais fichiers, devis), puis passe
-- DEUX FOIS supabase/lot49-commande.sql, et verifie ce que l'accord promet.
--
-- COMMENT LE LANCER (PostgreSQL 16 jetable), DEPUIS LE DOSSIER supabase/ :
--   initdb -D /tmp/pg49 -A trust
--   pg_ctl -D /tmp/pg49 -o "-k /tmp -p 55449" start
--   psql -h /tmp -p 55449 -d postgres -c "create database banc49"
--   psql -h /tmp -p 55449 -d banc49 -v ON_ERROR_STOP=1 -f banc-lot49-commande.sql
-- Derniere ligne attendue : « BANC DE LA COMMANDE : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot47-devis.sql
\set QUIET on
\o /dev/null
\ir lot49-commande.sql
\ir lot49-commande.sql
truncate banc.resultats;

-- LE DECOR : un troisieme bureau, neuf, et un intrus.
insert into auth.users values
  ('33333333-3333-3333-3333-333333333333', 'u3@x.fr'),
  ('44444444-4444-4444-4444-444444444444', 'u4@x.fr');
insert into public.bureaux (bureau, nom) values
  ('b3000000-0000-0000-0000-000000000003', 'Domaine Trois'),
  ('b4000000-0000-0000-0000-000000000004', 'Domaine Quatre');
insert into public.membres values
  ('b3000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'simple'),
  ('b4000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'maitre');
insert into public.domaine (bureau, raison_sociale, siret, adresse, code_postal, ville, paiement_mode, paiement_jours, validite_jours)
  values ('b3000000-0000-0000-0000-000000000003', 'SCEA Trois', '11122233300011', '2 rue', '49000', 'Angers', 'fdm', 30, 30);
insert into public.affaire_types (bureau, type_id, nom, famille) values
  ('b3000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-0000000000a3', 'Caviste', 'conquete');
insert into public.affaire_etapes (bureau, etape_id, type_id, nom, ordre) values
  ('b3000000-0000-0000-0000-000000000003', 'e3000000-0000-0000-0000-0000000000e3', 'a3000000-0000-0000-0000-0000000000a3', 'Contact', 1);
insert into public.pistes (bureau, piste_id, nom, nature, adresse, code_postal, ville, email) values
  ('b3000000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-000000000001', 'Cave Neuve Trois', 'caviste', '9 rue', '49100', 'Angers', 'neuve3@x.fr');
-- 01 client T1 ; 02 nouveau client ; 03 client sans numero ni e-mail ; 04 sans numero produit ;
-- 05 perdue ; 06 deux devis ; 07 deja gagnee a la main.
insert into public.affaires (bureau, affaire_id, type_id, etape_id, piste_id, client_id, client_nom, titre, issue) values
  ('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-0000000000a3', 'e3000000-0000-0000-0000-0000000000e3', null, 'T1', 'Bar Tarif', 'A', 'en_cours'),
  ('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-0000000000a3', 'e3000000-0000-0000-0000-0000000000e3', 'f3000000-0000-0000-0000-000000000001', null, null, 'B', 'en_cours'),
  ('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-0000000000a3', 'e3000000-0000-0000-0000-0000000000e3', null, 'Anonyme', 'Anonyme', 'C', 'en_cours'),
  ('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000004', 'a3000000-0000-0000-0000-0000000000a3', 'e3000000-0000-0000-0000-0000000000e3', null, 'T1', 'Bar Tarif', 'D', 'en_cours'),
  ('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-0000000000a3', 'e3000000-0000-0000-0000-0000000000e3', null, 'T1', 'Bar Tarif', 'E', 'en_cours'),
  ('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000006', 'a3000000-0000-0000-0000-0000000000a3', 'e3000000-0000-0000-0000-0000000000e3', null, 'T1', 'Bar Tarif', 'F', 'en_cours'),
  ('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000007', 'a3000000-0000-0000-0000-0000000000a3', 'e3000000-0000-0000-0000-0000000000e3', null, 'T1', 'Bar Tarif', 'G', 'en_cours');
insert into public.ventes_lignes (bureau, empreinte, le_jour, produit, num_produit, pu_ht, qte, client_nom, num_client, client_cle, emails, code_tarif, famille, type_offert) values
  ('b3000000-0000-0000-0000-000000000003', 't01', current_date - 90, 'Anjou', 'A9', 7, 6, 'Bar Tarif', 'T1', 'T1', 'bar@x.fr', 'PRO', 'Vin', ''),
  ('b3000000-0000-0000-0000-000000000003', 't02', current_date - 10, 'Anjou', 'A9', 7, 6, 'Bar Tarif', 'T1', 'T1', 'bar@x.fr', 'CHR', 'Vin', ''),
  ('b3000000-0000-0000-0000-000000000003', 't03', current_date - 5,  'Anjou', 'A9', 0, 1, 'Bar Tarif', 'T1', 'T1', null, '', 'Vin', ''),
  ('b3000000-0000-0000-0000-000000000003', 't04', current_date - 20, 'Anjou', 'A9', 7, 6, 'Anonyme', '', 'Anonyme', null, null, 'Vin', '');

set role authenticated;
select banc.qui('33333333-3333-3333-3333-333333333333');
create temp table t_d (k text primary key, id uuid);
grant all on t_d to authenticated;
insert into t_d select 'd1', (public.devis_enregistrer('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000001', null, jsonb_build_array(banc.l(1000, 6, 0, 'Anjou')))).devis_id;
insert into t_d select 'd2', (public.devis_enregistrer('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000002', null, jsonb_build_array(banc.l(1000, 6)))).devis_id;
insert into t_d select 'd3', (public.devis_enregistrer('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000003', null, jsonb_build_array(banc.l(1000, 6)))).devis_id;
insert into t_d select 'd4', (public.devis_enregistrer('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000004', null,
  jsonb_build_array(banc.l(1000, 6), jsonb_build_object('designation', 'Vin libre', 'quantite', 1, 'pu_ht_c', 500)))).devis_id;
insert into t_d select 'd5', (public.devis_enregistrer('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000005', null, jsonb_build_array(banc.l(1000, 6)))).devis_id;
insert into t_d select 'd6a', (public.devis_enregistrer('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000006', null, jsonb_build_array(banc.l(1000, 6)))).devis_id;
insert into t_d select 'd6b', (public.devis_enregistrer('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000006', null, jsonb_build_array(banc.l(900, 6)))).devis_id;
insert into t_d select 'd7', (public.devis_enregistrer('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000007', null, jsonb_build_array(banc.l(1000, 6)))).devis_id;
reset role;
update public.affaires set issue = 'perdue', motif = (select (array['prix'])[1]) where affaire_id = 'c3000000-0000-0000-0000-000000000005';
update public.affaires set issue = 'gagnee' where affaire_id = 'c3000000-0000-0000-0000-000000000007';
set role authenticated;
select banc.qui('33333333-3333-3333-3333-333333333333');

-- 1. LES DROITS
select banc.ok('anon ne peut pas accepter', not has_function_privilege('anon', 'public.devis_accepter(uuid, uuid)', 'execute'));
select banc.ok('authenticated peut accepter', has_function_privilege('authenticated', 'public.devis_accepter(uuid, uuid)', 'execute'));
select banc.ok('le statut accepte est connu',
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'devis_statut_check') ~ 'accepte');
select banc.refus('un PATCH direct reste interdit',
  $q$ update public.devis set statut = 'accepte', accepte_le = now() where devis_id = (select id from t_d where k = 'd1') $q$, '42501');

-- 2. LES REFUS, AVANT LE GEL
select banc.refus('ligne sans numero produit : refuse',
  $q$ select public.devis_accepter('b3000000-0000-0000-0000-000000000003', (select id from t_d where k = 'd4')) $q$, '23514');
select banc.ok('... et le devis reste modifiable',
  (select statut from public.devis where devis_id = (select id from t_d where k = 'd4')) = 'enregistre');
select banc.refus('client existant sans numero ni e-mail : refuse',
  $q$ select public.devis_accepter('b3000000-0000-0000-0000-000000000003', (select id from t_d where k = 'd3')) $q$, '23514');
select banc.refus('affaire perdue : refuse',
  $q$ select public.devis_accepter('b3000000-0000-0000-0000-000000000003', (select id from t_d where k = 'd5')) $q$, '23514');
select banc.qui('44444444-4444-4444-4444-444444444444');
select banc.refus('un autre bureau ne peut pas accepter',
  $q$ select public.devis_accepter('b3000000-0000-0000-0000-000000000003', (select id from t_d where k = 'd1')) $q$, '42501');
select banc.refus('ni sous son propre bureau (devis introuvable)',
  $q$ select public.devis_accepter('b4000000-0000-0000-0000-000000000004', (select id from t_d where k = 'd1')) $q$, 'P0002');
select banc.qui('33333333-3333-3333-3333-333333333333');

-- 3. ACCEPTER UN CLIENT EXISTANT
create temp table t_r as select * from public.devis_accepter('b3000000-0000-0000-0000-000000000003', (select id from t_d where k = 'd1'));
select banc.ok('accepte, date et auteur poses',
  (select statut = 'accepte' and accepte_le is not null and accepte_par = '33333333-3333-3333-3333-333333333333' from t_r));
select banc.ok('code tarif = celui de la DERNIERE vente non vide (CHR, pas PRO, pas le vide)',
  (select code_tarif from t_r) = 'CHR');
select banc.ok('l affaire est gagnee, sans motif, rappel efface',
  (select issue = 'gagnee' and motif is null and close_le is not null and rappel is null
     from public.affaires where affaire_id = 'c3000000-0000-0000-0000-000000000001'));
select banc.ok('double appui : rendu tel quel, meme date',
  (select accepte_le from public.devis_accepter('b3000000-0000-0000-0000-000000000003', (select id from t_d where k = 'd1')))
  = (select accepte_le from t_r));
select banc.refus('un devis accepte ne se modifie plus',
  $q$ select public.devis_enregistrer('b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000001', (select id from t_d where k = 'd1'), jsonb_build_array(banc.l(1, 1))) $q$, '23514');
select banc.refus('un devis accepte ne s abandonne plus',
  $q$ select public.devis_abandonner('b3000000-0000-0000-0000-000000000003', (select id from t_d where k = 'd1')) $q$, '23514');
reset role;
select banc.refus('meme le proprietaire ne change pas une ligne d un devis accepte',
  $q$ update public.devis_lignes set quantite = 99 where devis_id = (select id from t_d where k = 'd1') $q$, '23514');
select banc.refus('ni le devis lui-meme',
  $q$ update public.devis set notes = 'x' where devis_id = (select id from t_d where k = 'd1') $q$, '23514');
set role authenticated;
select banc.qui('33333333-3333-3333-3333-333333333333');

-- 4. NOUVEAU CLIENT
select banc.ok('nouveau client : accepte, sans numero ni code tarif',
  (select statut = 'accepte' and num_client is null and code_tarif is null
     from public.devis_accepter('b3000000-0000-0000-0000-000000000003', (select id from t_d where k = 'd2'))));

-- 5. UNE COMMANDE PAR AFFAIRE
select banc.ok('premier devis de l affaire F accepte',
  (select statut from public.devis_accepter('b3000000-0000-0000-0000-000000000003', (select id from t_d where k = 'd6a'))) = 'accepte');
select banc.refus('le second devis de la meme affaire est refuse',
  $q$ select public.devis_accepter('b3000000-0000-0000-0000-000000000003', (select id from t_d where k = 'd6b')) $q$, '23514');

-- 6. AFFAIRE DEJA GAGNEE A LA MAIN
select banc.ok('affaire deja gagnee : le devis s accepte, l affaire ne bouge pas',
  (select statut from public.devis_accepter('b3000000-0000-0000-0000-000000000003', (select id from t_d where k = 'd7'))) = 'accepte'
  and (select issue from public.affaires where affaire_id = 'c3000000-0000-0000-0000-000000000007') = 'gagnee');
reset role;

\o
\set QUIET off
\pset tuples_only on
select 'BANC DE LA COMMANDE : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
