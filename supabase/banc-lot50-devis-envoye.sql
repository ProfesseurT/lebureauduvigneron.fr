-- ===========================================================================
-- BANC DU DEVIS ENVOYE, lot 50, 01/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 49 (qui rejoue celui du lot 47), puis passe
-- DEUX FOIS supabase/lot50-devis-envoye.sql, et verifie ce que l'envoi promet.
--
-- COMMENT LE LANCER (PostgreSQL 16 jetable), DEPUIS LE DOSSIER supabase/ :
--   initdb -D /tmp/pg50 -A trust
--   pg_ctl -D /tmp/pg50 -o "-k /tmp -p 55450" start
--   psql -h /tmp -p 55450 -d postgres -c "create database banc50"
--   psql -h /tmp -p 55450 -d banc50 -v ON_ERROR_STOP=1 -f banc-lot50-devis-envoye.sql
-- Derniere ligne attendue : « BANC DU DEVIS ENVOYE : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot49-commande.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
\ir lot50-devis-envoye.sql
\ir lot50-devis-envoye.sql
truncate banc.resultats;

-- LE DECOR : un cinquieme bureau, deux types, un intrus (U4, maitre de B4).
insert into auth.users values ('55555555-5555-5555-5555-555555555555', 'u5@x.fr');
insert into public.bureaux (bureau, nom) values ('b5000000-0000-0000-0000-000000000005', 'Domaine Cinq');
insert into public.membres values
  ('b5000000-0000-0000-0000-000000000005', '55555555-5555-5555-5555-555555555555', 'simple');
insert into public.domaine (bureau, raison_sociale, siret, adresse, code_postal, ville, paiement_mode, paiement_jours, validite_jours)
  values ('b5000000-0000-0000-0000-000000000005', 'EARL Cinq', '55522233300011', '5 rue', '44000', 'Nantes', 'fdm', 30, 30);
insert into public.affaire_types (bureau, type_id, nom, famille) values
  ('b5000000-0000-0000-0000-000000000005', 'a5000000-0000-0000-0000-0000000000a5', 'Caviste', 'conquete'),
  ('b5000000-0000-0000-0000-000000000005', 'a5000000-0000-0000-0000-0000000000a6', 'Mariage', 'evenement');
insert into public.affaire_etapes (bureau, etape_id, type_id, nom, ordre) values
  ('b5000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-0000000000a5', 'Contact', 1),
  ('b5000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-0000000000a5', 'Devis envoyé', 2),
  ('b5000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000009', 'a5000000-0000-0000-0000-0000000000a6', 'Demande', 1);
-- 01 envoi avec rappel et etape ; 02 envoi sans rien ; 03 refaire ; 04 accepter apres envoi ;
-- 05 abandonner apres envoi ; 06 close ; 07 etape d'un autre type.
insert into public.affaires (bureau, affaire_id, type_id, etape_id, client_id, client_nom, titre, issue, rappel, rappel_titre) values
  ('b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'A', 'en_cours', current_date + 40, 'Ancien rappel'),
  ('b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'B', 'en_cours', current_date + 40, 'Garde-moi'),
  ('b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'C', 'en_cours', null, null),
  ('b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000004', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'D', 'en_cours', null, null),
  ('b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000005', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'E', 'en_cours', null, null),
  ('b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000006', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'F', 'en_cours', null, null),
  ('b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000007', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'G', 'en_cours', null, null);
insert into public.ventes_lignes (bureau, empreinte, le_jour, produit, num_produit, pu_ht, qte, client_nom, num_client, client_cle, emails, code_tarif, famille, type_offert) values
  ('b5000000-0000-0000-0000-000000000005', 'k01', current_date - 30, 'Muscadet', 'M1', 6, 12, 'Cave Une', 'K1', 'K1', 'cave@x.fr', 'PRO', 'Vin', '');

set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
create temp table t_e (k text primary key, id uuid);
grant all on t_e to authenticated;
insert into t_e select 'e' || i, (public.devis_enregistrer('b5000000-0000-0000-0000-000000000005',
    ('c5000000-0000-0000-0000-00000000000' || i)::uuid, null, jsonb_build_array(banc.l(1000, 6)))).devis_id
  from generate_series(1, 7) i;
reset role;
update public.affaires set issue = 'perdue', motif = 'prix' where affaire_id = 'c5000000-0000-0000-0000-000000000006';
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');

-- 1. LES DROITS ET LES SIGNATURES
select banc.ok('anon ne peut pas envoyer',
  not has_function_privilege('anon', 'public.devis_envoyer(uuid, uuid, date, date, text, uuid)', 'execute'));
select banc.ok('authenticated peut envoyer',
  has_function_privilege('authenticated', 'public.devis_envoyer(uuid, uuid, date, date, text, uuid)', 'execute'));
select banc.ok('une seule signature de devis_enregistrer, a 7 arguments',
  (select count(*) from pg_proc where proname = 'devis_enregistrer') = 1
  and (select pronargs from pg_proc where proname = 'devis_enregistrer') = 7);
select banc.ok('anon ne peut pas enregistrer',
  not has_function_privilege('anon', 'public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text, uuid)', 'execute'));
select banc.refus('un PATCH direct reste interdit',
  $q$ update public.devis set statut = 'envoye', envoye_le = current_date where devis_id = (select id from t_e where k = 'e2') $q$, '42501');

-- 2. LES REFUS DE L'ENVOI (le devis reste enregistre)
select banc.refus('date d envoi dans le futur : refuse',
  $q$ select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e2'), current_date + 1) $q$, '23514');
select banc.refus('date d envoi avant le devis : refuse',
  $q$ select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e2'), current_date - 1) $q$, '23514');
select banc.refus('rappel avant l envoi : refuse',
  $q$ select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e2'), null, current_date - 1) $q$, '23514');
select banc.refus('etape d un autre type : refuse',
  $q$ select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e7'), null, current_date + 7, null,
       'e5000000-0000-0000-0000-000000000009') $q$, '23514');
select banc.ok('... et tout est defait : le devis 7 reste enregistre, l affaire sans rappel',
  (select statut from public.devis where devis_id = (select id from t_e where k = 'e7')) = 'enregistre'
  and (select rappel is null from public.affaires where affaire_id = 'c5000000-0000-0000-0000-000000000007'));
select banc.refus('affaire close : refuse',
  $q$ select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e6')) $q$, '23514');
select banc.qui('44444444-4444-4444-4444-444444444444');
select banc.refus('un autre bureau ne peut pas envoyer',
  $q$ select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e2')) $q$, '42501');
select banc.refus('ni sous son propre bureau (devis introuvable)',
  $q$ select public.devis_envoyer('b4000000-0000-0000-0000-000000000004', (select id from t_e where k = 'e2')) $q$, 'P0002');
select banc.qui('55555555-5555-5555-5555-555555555555');
select banc.ok('apres ces refus, le devis 2 est toujours enregistre',
  (select statut from public.devis where devis_id = (select id from t_e where k = 'e2')) = 'enregistre');

-- 3. ENVOYER, AVEC RAPPEL ET ETAPE
create temp table t_s as select * from public.devis_envoyer('b5000000-0000-0000-0000-000000000005',
  (select id from t_e where k = 'e1'), null, current_date + 7, null, 'e5000000-0000-0000-0000-000000000002');
select banc.ok('envoye, date du jour, auteur pose',
  (select statut = 'envoye' and envoye_le = public.devis_jour(now())
          and envoye_par = '55555555-5555-5555-5555-555555555555' from t_s));
select banc.ok('le rappel de l affaire est pose, motif par defaut avec le numero',
  (select rappel = current_date + 7 and rappel_titre = 'Relancer le devis ' || (select numero from t_s)
     from public.affaires where affaire_id = 'c5000000-0000-0000-0000-000000000001'));
select banc.ok('l affaire est passee a l etape Devis envoye',
  (select etape_id = 'e5000000-0000-0000-0000-000000000002' from public.affaires
    where affaire_id = 'c5000000-0000-0000-0000-000000000001'));
select banc.ok('double appui : rendu tel quel',
  (select envoye_le from public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e1')))
  = (select envoye_le from t_s));
select banc.refus('un devis envoye ne se modifie plus',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000001',
       (select id from t_e where k = 'e1'), jsonb_build_array(banc.l(1, 1))) $q$, '23514');
reset role;
select banc.refus('meme le proprietaire ne change pas un devis envoye',
  $q$ update public.devis set notes = 'x' where devis_id = (select id from t_e where k = 'e1') $q$, '23514');
select banc.refus('ni ses lignes',
  $q$ update public.devis_lignes set quantite = 99 where devis_id = (select id from t_e where k = 'e1') $q$, '23514');
select banc.refus('ni sa date d envoi',
  $q$ update public.devis set envoye_le = envoye_le + 1 where devis_id = (select id from t_e where k = 'e1') $q$, '23514');
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');

-- 4. ENVOYER SANS RAPPEL : l'affaire garde le sien, a la date dite
select banc.ok('envoi sans rappel, date donnee = jour du devis',
  (select statut = 'envoye' and envoye_le = date_devis
     from public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e2'),
          (select date_devis from public.devis where devis_id = (select id from t_e where k = 'e2')))));
select banc.ok('... et le rappel de l affaire n a pas bouge',
  (select rappel = current_date + 40 and rappel_titre = 'Garde-moi' and etape_id = 'e5000000-0000-0000-0000-000000000001'
     from public.affaires where affaire_id = 'c5000000-0000-0000-0000-000000000002'));

-- 5. ACCEPTER ET ABANDONNER UN DEVIS ENVOYE
select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e4'));
select banc.ok('un devis envoye s accepte, et garde sa date d envoi',
  (select statut = 'accepte' and envoye_le is not null and code_tarif = 'PRO'
     from public.devis_accepter('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e4'))));
select banc.ok('... l affaire est gagnee',
  (select issue from public.affaires where affaire_id = 'c5000000-0000-0000-0000-000000000004') = 'gagnee');
select banc.refus('un devis accepte ne s abandonne toujours pas',
  $q$ select public.devis_abandonner('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e4')) $q$, '23514');
reset role;
select banc.refus('ni ne se change par le proprietaire',
  $q$ update public.devis set code_tarif = 'X' where devis_id = (select id from t_e where k = 'e4') $q$, '23514');
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e5'));
select banc.ok('un devis envoye s abandonne',
  (select statut = 'abandonne' and abandonne_le is not null
     from public.devis_abandonner('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e5'))));
select banc.refus('un devis abandonne ne s envoie pas',
  $q$ select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e5')) $q$, '23514');

-- 6. REFAIRE CE DEVIS
select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_e where k = 'e3'));
select banc.refus('refaire avec un p_devis : refuse',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000003',
       (select id from t_e where k = 'e3'), jsonb_build_array(banc.l(900, 6)), 0, null, (select id from t_e where k = 'e3')) $q$, '23514');
select banc.refus('refaire le devis d une autre affaire : introuvable',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000007',
       null, jsonb_build_array(banc.l(900, 6)), 0, null, (select id from t_e where k = 'e3')) $q$, 'P0002');
select banc.refus('refaire un devis accepte : refuse (l affaire est close de toute facon)',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000004',
       null, jsonb_build_array(banc.l(900, 6)), 0, null, (select id from t_e where k = 'e4')) $q$, '23514');
select banc.refus('une ligne fausse fait echouer le remplacement...',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000003',
       null, jsonb_build_array(jsonb_build_object('designation', 'X', 'quantite', 1.5, 'pu_ht_c', 100)), 0, null, (select id from t_e where k = 'e3')) $q$, '22P02');
select banc.ok('... et l ancien reste envoye',
  (select statut from public.devis where devis_id = (select id from t_e where k = 'e3')) = 'envoye');
create temp table t_v as select * from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005',
  'c5000000-0000-0000-0000-000000000003', null, jsonb_build_array(banc.l(900, 6)), 0, 'nouvelle', (select id from t_e where k = 'e3'));
select banc.ok('le nouveau devis porte version_de et un nouveau numero',
  (select version_de = (select id from t_e where k = 'e3') and statut = 'enregistre'
          and numero <> (select numero from public.devis where devis_id = (select id from t_e where k = 'e3')) from t_v));
select banc.ok('l ancien est abandonne dans la meme transaction',
  (select statut = 'abandonne' and abandonne_le is not null from public.devis where devis_id = (select id from t_e where k = 'e3')));
select banc.refus('un devis deja remplace ne se remplace pas deux fois',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000003',
       null, jsonb_build_array(banc.l(800, 6)), 0, null, (select id from t_e where k = 'e3')) $q$, '23514');
select banc.ok('enregistrer sans p_version_de marche toujours (appel du lot 47)',
  (select version_de is null and statut = 'enregistre' from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005',
     'c5000000-0000-0000-0000-000000000007', null, jsonb_build_array(banc.l(700, 3)))));
reset role;

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU DEVIS ENVOYE : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
