-- ===========================================================================
-- BANC DU LOT 54 (la TVA du devis), 01/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 53 (qui rejoue 52, 51, 50, 49 et 47), puis passe DEUX
-- FOIS supabase/lot54-devis-tva.sql.
--   psql -h /tmp -p 55453 -d banc54 -v ON_ERROR_STOP=1 -f banc-lot54-devis-tva.sql
-- Derniere ligne attendue : « BANC DU LOT 54 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot53-devis-livraison.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
\ir lot54-devis-tva.sql
\ir lot54-devis-tva.sql
truncate banc.resultats;

insert into public.affaires (bureau, affaire_id, type_id, etape_id, client_id, client_nom, titre, issue) values
  ('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'T1', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'T2', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'T3', 'en_cours');
-- Le domaine du banc n'a pas de numero de TVA : on le pose plus bas, pour l'UE.

set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
create temp table t_54 (k text primary key, id uuid, num text);
grant all on t_54 to authenticated;
create function pg_temp.lt(pu bigint, q int, t int) returns jsonb language sql as
  $f$ select banc.l($1, $2) || jsonb_build_object('tva_cb', $3) $f$;

-- 1. LA SIGNATURE ET LES ANCIENS DEVIS
select banc.ok('une seule signature de devis_enregistrer, a 9 arguments, le dernier p_tva',
  (select count(*) from pg_proc where proname = 'devis_enregistrer') = 1
  and (select pronargs from pg_proc where proname = 'devis_enregistrer') = 9
  and (select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'devis_enregistrer') like '%p_tva jsonb');
select banc.ok('les devis d avant le lot : france, port a 20 %, lignes a 20 %',
  (select count(*) from public.devis where regime_tva <> 'france' or tva_cb <> 2000 or not accises_incluses) = 0
  and (select count(*) from public.devis_lignes where tva_cb <> 2000) = 0);

-- 2. SANS p_tva : comme avant
insert into t_54 select 'f', d.devis_id, d.numero from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005',
  'c5400000-0000-0000-0000-000000000001', null, jsonb_build_array(banc.l(1000, 6))) d;
select banc.ok('sans p_tva ni taux de ligne : france, 6000 / 1200 / 7200 (le calcul d avant)',
  (select regime_tva = 'france' and tva_cb = 2000 and total_ht_c = 6000 and tva_c = 1200 and total_ttc_c = 7200 and client_tva is null
     from public.devis where devis_id = (select id from t_54 where k = 'f')));

-- 3. 20 % ET 5,5 % DANS LE MEME DEVIS, AVEC DU PORT
-- 6 x 10,00 a 20 % = 60,00 ; 10 x 3,33 a 5,5 % = 33,30 ; port 15,00 a 20 %
-- base 20 % = 75,00 -> 15,00 ; base 5,5 % = 33,30 -> 1,8315 -> 1,83 ; TVA 16,83
select banc.ok('mixte : HT 108,30, TVA 15,00 + 1,83 = 16,83, TTC 125,13',
  (select total_ht_c = 10830 and tva_c = 1683 and total_ttc_c = 12513
     from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000001',
       (select id from t_54 where k = 'f'), jsonb_build_array(pg_temp.lt(1000, 6, 2000), pg_temp.lt(333, 10, 550)), 0, null, null,
       '{"mode":"client","port_c":1500}'::jsonb, '{"regime":"france"}'::jsonb)));
select banc.ok('chaque ligne garde son taux', (select array_agg(tva_cb order by rang) from public.devis_lignes
  where devis_id = (select id from t_54 where k = 'f')) = array[2000, 550]);
-- Remise globale 10 % : 6 x 9,00 = 54,00 ; 10 x 3,00 (3,33 -> 2,997 -> 3,00) = 30,00
select banc.ok('remise globale 10 % : la TVA se calcule sur les bases remisees (54 + 15 = 69 -> 13,80 ; 30 -> 1,65)',
  (select total_ht_c = 9900 and tva_c = 1545
     from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000001',
       (select id from t_54 where k = 'f'), jsonb_build_array(pg_temp.lt(1000, 6, 2000), pg_temp.lt(333, 10, 550)), 1000, null, null,
       '{"mode":"client","port_c":1500}'::jsonb, '{"regime":"france"}'::jsonb)));
select banc.ok('reenregistrer SANS p_tva garde les taux de ligne envoyes et le regime',
  (select regime_tva = 'france' from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000001',
       (select id from t_54 where k = 'f'), jsonb_build_array(pg_temp.lt(1000, 6, 2000), pg_temp.lt(333, 10, 550)))));
-- UNE TVA PAR TAUX, ET PAS UNE SUR LA SOMME : 20 % sur 75,02 = 15,004 -> 15,00 ; 5,5 % sur 33,32
-- = 1,8326 -> 1,83 ; total 16,83. Arrondie une seule fois sur la somme, elle ferait 16,84.
select banc.ok('arrondi PAR TAUX : 1500 + 183 = 1683 (et non 1684)',
  (select tva_c = 1683 from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000001',
       (select id from t_54 where k = 'f'), jsonb_build_array(pg_temp.lt(1000, 6, 2000), pg_temp.lt(3332, 1, 550)), 0, null, null,
       '{"mode":"client","port_c":1502}'::jsonb, '{"regime":"france"}'::jsonb)));
select banc.ok('un devis a deux vins nommes, 20 % et 5,5 %',
  (select tva_c = 1683 from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000001',
       (select id from t_54 where k = 'f'), jsonb_build_array(banc.l(1000, 6, 0, 'Rouge') || '{"tva_cb":2000}', banc.l(3332, 1, 0, 'Jus') || '{"tva_cb":550}'), 0, null, null,
       '{"mode":"client","port_c":1502}'::jsonb, '{"regime":"france"}'::jsonb)));
select banc.ok('vieil onglet (ni p_tva ni taux) : la ligne a 5,5 % garde son taux, reconnue par son code et son nom',
  (select tva_c = 1683 from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000001',
       (select id from t_54 where k = 'f'), jsonb_build_array(banc.l(1000, 6, 0, 'Rouge'), banc.l(3332, 1, 0, 'Jus')), 0, null, null,
       '{"mode":"client","port_c":1502}'::jsonb))
  and (select array_agg(tva_cb order by rang) from public.devis_lignes where devis_id = (select id from t_54 where k = 'f')) = array[2000, 550]);
select banc.refus('en France, une ligne a 0 % est refusee',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000003', null,
       jsonb_build_array(pg_temp.lt(1000, 1, 0)), 0, null, null, null, '{"regime":"france"}'::jsonb) $q$, '23514');
select banc.refus('accises_incluses qui n est pas un booleen : refus lisible (23514)',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, null, '{"regime":"export","accises_incluses":"oui"}'::jsonb) $q$, '23514');
select banc.refus('un taux de ligne inconnu (10 %) est refuse',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000003', null,
       jsonb_build_array(pg_temp.lt(1000, 1, 1000))) $q$, '23514');

-- 4. EXPORT HORS UE : tout a 0, meme une ligne envoyee a 20 %
insert into t_54 select 'x', d.devis_id, d.numero from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005',
  'c5400000-0000-0000-0000-000000000002', null, jsonb_build_array(pg_temp.lt(1000, 6, 2000), pg_temp.lt(333, 10, 550)), 0, null, null,
  '{"mode":"client","port_c":1500}'::jsonb, '{"regime":"export"}'::jsonb) d;
select banc.ok('export : TVA 0, port a 0 %, lignes a 0, accises NON incluses par defaut',
  (select regime_tva = 'export' and tva_cb = 0 and tva_c = 0 and total_ht_c = 10830 and total_ttc_c = 10830 and not accises_incluses and client_tva is null
     from public.devis where devis_id = (select id from t_54 where k = 'x'))
  and (select bool_and(tva_cb = 0) from public.devis_lignes where devis_id = (select id from t_54 where k = 'x')));
select banc.ok('export : la case « accises incluses » se garde si on la coche',
  (select accises_incluses from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000002',
       (select id from t_54 where k = 'x'), jsonb_build_array(banc.l(1000, 6)), 0, null, null, null,
       '{"regime":"export","accises_incluses":true}'::jsonb)));
select banc.ok('reenregistrer un devis export SANS p_tva le garde a l export, TVA 0',
  (select regime_tva = 'export' and tva_c = 0 from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000002',
       (select id from t_54 where k = 'x'), jsonb_build_array(banc.l(1000, 6)))));
select banc.ok('un numero de TVA client donne a l export n est pas garde',
  (select client_tva is null from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000002',
       (select id from t_54 where k = 'x'), jsonb_build_array(banc.l(1000, 6)), 0, null, null, null,
       '{"regime":"export","client_tva":"DE123456789"}'::jsonb)));

-- 5. PRO DE L'UE
select banc.refus('UE sans numero du client : refuse',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, null, '{"regime":"ue"}'::jsonb) $q$, '23514');
select banc.refus('UE alors que le domaine n a pas de numero de TVA : refuse',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, null, '{"regime":"ue","client_tva":"DE123456789"}'::jsonb) $q$, '23514');
select banc.refus('regime inconnu : refuse',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, null, '{"regime":"franchise"}'::jsonb) $q$, '23514');
reset role;
update public.domaine set tva = 'FR55555222333' where bureau = 'b5000000-0000-0000-0000-000000000005';
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
select banc.refus('UE avec un numero FR : refuse (le domaine a son numero, seul le FR bloque)',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, null, '{"regime":"ue","client_tva":"FR12345678901"}'::jsonb) $q$, '23514');
insert into t_54 select 'u', d.devis_id, d.numero from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005',
  'c5400000-0000-0000-0000-000000000003', null, jsonb_build_array(banc.l(1000, 6)), 0, null, null, null,
  '{"regime":"ue","client_tva":" de 123.456-789 "}'::jsonb) d;
select banc.ok('UE : numero range sans espaces ni points, en majuscules ; TVA 0 ; vendeur porte son numero',
  (select regime_tva = 'ue' and client_tva = 'DE123456789' and tva_c = 0 and total_ttc_c = 6000 and vendeur->>'tva' = 'FR55555222333'
     from public.devis where devis_id = (select id from t_54 where k = 'u')));
select banc.ok('retour en France : le numero du client s efface, accises incluses, TVA revenue',
  (select regime_tva = 'france' and client_tva is null and accises_incluses and tva_c = 1200
     from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5400000-0000-0000-0000-000000000003',
       (select id from t_54 where k = 'u'), jsonb_build_array(banc.l(1000, 6)), 0, null, null, null, '{"regime":"france","accises_incluses":false}'::jsonb)));
select banc.ok('remis en UE pour la suite', (select regime_tva from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005',
  'c5400000-0000-0000-0000-000000000003', (select id from t_54 where k = 'u'), jsonb_build_array(banc.l(1000, 6)), 0, null, null, null,
  '{"regime":"ue","client_tva":"DE123456789"}'::jsonb)) = 'ue');

-- 6. FIGE APRES L'ENVOI, ACCEPTE ENSUITE
select banc.ok('envoye : regime et numero intacts',
  (select statut = 'envoye' and regime_tva = 'ue' and client_tva = 'DE123456789'
     from public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_54 where k = 'u'), null, null, null, null, null)));
select banc.ok('accepte : la TVA suit', (select statut = 'accepte' and tva_c = 0
  from public.devis_accepter('b5000000-0000-0000-0000-000000000005', (select id from t_54 where k = 'u'))));
reset role;
select banc.refus('meme le proprietaire ne repasse pas en France un devis accepte',
  $q$ update public.devis set regime_tva = 'france', client_tva = null, tva_cb = 2000, tva_c = 1200, total_ttc_c = 7200
       where devis_id = (select id from t_54 where k = 'u') $q$, '23514');
select banc.refus('ni ne change le taux d une de ses lignes',
  $q$ update public.devis_lignes set tva_cb = 550 where devis_id = (select id from t_54 where k = 'u') $q$, '23514');

-- 7. LA TABLE SE DEFEND SEULE
select banc.refus('table : export avec de la TVA est refuse',
  $q$ update public.devis set tva_c = 1, total_ttc_c = total_ht_c + 1 where devis_id = (select id from t_54 where k = 'x') $q$, '23514');
select banc.refus('table : France avec un port a 0 % est refuse',
  $q$ update public.devis set tva_cb = 0 where devis_id = (select id from t_54 where k = 'f') $q$, '23514');
select banc.refus('table : UE sans numero du client est refuse',
  $q$ update public.devis set regime_tva = 'ue', tva_cb = 0, tva_c = 0, total_ttc_c = total_ht_c where devis_id = (select id from t_54 where k = 'x') $q$, '23514');
select banc.refus('table : France sans accises incluses est refuse',
  $q$ update public.devis set accises_incluses = false where devis_id = (select id from t_54 where k = 'f') $q$, '23514');

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 54 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
