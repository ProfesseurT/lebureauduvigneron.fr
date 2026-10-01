-- ===========================================================================
-- BANC DU LOT 53 (la livraison du devis), 01/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 52 (qui rejoue 51, 50, 49 et 47), puis passe DEUX
-- FOIS supabase/lot53-devis-livraison.sql.
--   initdb -D /tmp/pg53 -A trust
--   pg_ctl -D /tmp/pg53 -o "-k /tmp -p 55453" start
--   psql -h /tmp -p 55453 -d postgres -c "create database banc53"
--   psql -h /tmp -p 55453 -d banc53 -v ON_ERROR_STOP=1 -f banc-lot53-devis-livraison.sql
-- Derniere ligne attendue : « BANC DU LOT 53 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot52-devis-copie-trace.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
\ir lot53-devis-livraison.sql
\ir lot53-devis-livraison.sql
truncate banc.resultats;

insert into public.affaires (bureau, affaire_id, type_id, etape_id, client_id, client_nom, titre, issue) values
  ('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'L1', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'L2', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'L3', 'en_cours');

set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
create temp table t_53 (k text primary key, id uuid, num text);
grant all on t_53 to authenticated;
create function pg_temp.adr(nom text default 'Restaurant Le Quai', a1 text default ' 3 quai de la Fosse ',
  cp text default '44000', ville text default 'Nantes', pays text default null) returns jsonb language sql as
  $f$ select jsonb_build_object('nom', $1, 'adresse1', $2, 'adresse2', null, 'code_postal', $3, 'ville', $4,
        'pays', $5, 'telephone', '0240000000') $f$;

-- 1. LA SIGNATURE ET LES DROITS
select banc.ok('une seule signature de devis_enregistrer, a 8 arguments, le dernier p_livraison',
  (select count(*) from pg_proc where proname = 'devis_enregistrer') = 1
  and (select pronargs from pg_proc where proname = 'devis_enregistrer') = 8
  and (select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'devis_enregistrer') like '%p_livraison jsonb');
select banc.ok('anon ne peut pas enregistrer',
  not has_function_privilege('anon', 'public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text, uuid, jsonb)', 'execute'));

-- 2. SANS LIVRAISON : comme avant le lot, a l'adresse du client, sans port
insert into t_53 select 'c', d.devis_id, d.numero from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005',
  'c5300000-0000-0000-0000-000000000001', null, jsonb_build_array(banc.l(1000, 6))) d;
select banc.ok('sans p_livraison : mode client, pas de port, totaux d avant (6000 / 1200 / 7200)',
  (select livraison_mode = 'client' and livraison is null and port_c = 0 and transporteur is null
          and total_ht_c = 6000 and tva_c = 1200 and total_ttc_c = 7200 and remise_globale_c = 0
     from public.devis where devis_id = (select id from t_53 where k = 'c')));
-- L'appel par NOMS d'avant (sept arguments) passe toujours : c'est ce que fait un navigateur
-- dont le code n'a pas encore ete redeploye.
select banc.ok('l appel nomme a sept arguments passe toujours',
  (select total_ht_c from public.devis_enregistrer(p_bureau => 'b5000000-0000-0000-0000-000000000005',
     p_affaire => 'c5300000-0000-0000-0000-000000000001', p_devis => (select id from t_53 where k = 'c'),
     p_lignes => jsonb_build_array(banc.l(1000, 6)), p_remise_globale_cb => 0, p_notes => null, p_version_de => null)) = 6000);

-- 3. UNE AUTRE ADRESSE, UN TRANSPORTEUR, UNE DATE, DU PORT
insert into t_53 select 'a', d.devis_id, d.numero from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005',
  'c5300000-0000-0000-0000-000000000002', null, jsonb_build_array(banc.l(1000, 6)), 0, null, null,
  jsonb_build_object('mode', 'adresse', 'adresse', pg_temp.adr(), 'souhaitee', (public.devis_jour(now()) + 10)::text,
    'transporteur', '  Kuehne  ', 'port_c', 1500)) d;
select banc.ok('adresse rangee nettoyee, pays France par defaut, transporteur sans espaces',
  (select livraison_mode = 'adresse' and livraison->>'adresse1' = '3 quai de la Fosse' and livraison->>'pays' = 'France'
          and livraison->>'adresse2' is null and transporteur = 'Kuehne' and livraison_souhaitee = public.devis_jour(now()) + 10
     from public.devis where devis_id = (select id from t_53 where k = 'a')));
select banc.ok('le port entre dans le HT et la TVA le couvre : 6000 + 1500 = 7500, TVA 1500, TTC 9000',
  (select port_c = 1500 and total_vins_c = 6000 and remise_globale_c = 0 and total_ht_c = 7500 and tva_c = 1500 and total_ttc_c = 9000
     from public.devis where devis_id = (select id from t_53 where k = 'a')));
-- Avec une remise globale de 10 % : la remise ne touche PAS le port.
select banc.ok('remise globale 10 % : vins 6000, remise 600, port 1000, HT 6400, TVA 1280',
  (select total_vins_c = 6000 and remise_globale_c = 600 and port_c = 1000 and total_ht_c = 6400 and tva_c = 1280 and total_ttc_c = 7680
     from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000002',
       (select id from t_53 where k = 'a'), jsonb_build_array(banc.l(1000, 6)), 1000, null, null,
       jsonb_build_object('mode', 'adresse', 'adresse', pg_temp.adr(), 'port_c', 1000))));
select banc.ok('les lignes ne portent pas le port (somme des final = HT - port)',
  (select sum(final_c) from public.devis_lignes where devis_id = (select id from t_53 where k = 'a')) = 5400);

-- 4. LES REFUS
select banc.refus('adresse sans ville refusee',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, jsonb_build_object('mode', 'adresse', 'adresse', pg_temp.adr(ville => '  '))) $q$, '23514');
select banc.refus('mode adresse sans adresse refuse',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, '{"mode":"adresse"}'::jsonb) $q$, '23514');
select banc.refus('mode inconnu refuse',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, '{"mode":"poste"}'::jsonb) $q$, '23514');
select banc.refus('retrait au domaine avec du port refuse',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, '{"mode":"retrait","port_c":500}'::jsonb) $q$, '23514');
select banc.refus('retrait au domaine avec un transporteur refuse',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, '{"mode":"retrait","transporteur":"DHL"}'::jsonb) $q$, '23514');
select banc.refus('un port en euros a virgule (12.5) leve, jamais arrondi',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, '{"mode":"client","port_c":"12.5"}'::jsonb) $q$, '22P02');
select banc.refus('un port negatif refuse',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, '{"mode":"client","port_c":-1}'::jsonb) $q$, '23514');
select banc.refus('une date souhaitee avant le jour du devis refusee',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, jsonb_build_object('mode', 'client', 'souhaitee', '2020-01-01')) $q$, '23514');
select banc.refus('une livraison qui n est pas un objet refusee',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000003', null,
       jsonb_build_array(banc.l(1000, 1)), 0, null, null, '[1]'::jsonb) $q$, '23514');
select banc.ok('aucun refus n a consomme de numero (compteur inchange depuis le devis a)',
  (select count(*) from public.devis where affaire_id = 'c5300000-0000-0000-0000-000000000003') = 0);

-- 5. RETRAIT AU DOMAINE, PUIS RETOUR A L'ADRESSE DU CLIENT
insert into t_53 select 'r', d.devis_id, d.numero from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005',
  'c5300000-0000-0000-0000-000000000003', null, jsonb_build_array(banc.l(1000, 2)), 0, null, null,
  jsonb_build_object('mode', 'retrait', 'souhaitee', public.devis_jour(now())::text)) d;
select banc.ok('retrait : ni adresse, ni port, ni transporteur, la date gardee',
  (select livraison_mode = 'retrait' and livraison is null and port_c = 0 and transporteur is null
          and livraison_souhaitee = public.devis_jour(now()) and total_ht_c = 2000
     from public.devis where devis_id = (select id from t_53 where k = 'r')));
select banc.ok('reenregistrer SANS p_livraison (vieux code) GARDE la livraison et le port',
  (select livraison_mode = 'adresse' and livraison->>'nom' = 'Restaurant Le Quai' and port_c = 1000 and total_ht_c = 7000
     from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000002',
       (select id from t_53 where k = 'a'), jsonb_build_array(banc.l(1000, 6)))));
select banc.ok('reenregistrer avec mode client remet le devis a l adresse du client, et efface le port',
  (select livraison_mode = 'client' and livraison is null and livraison_souhaitee is null and port_c = 0 and total_ht_c = 6000
     from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000002',
       (select id from t_53 where k = 'a'), jsonb_build_array(banc.l(1000, 6)), 0, null, null, '{"mode":"client"}'::jsonb)));
-- On remet du port pour la suite.
select banc.ok('remise en adresse + 1500 de port',
  (select total_ht_c from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000002',
       (select id from t_53 where k = 'a'), jsonb_build_array(banc.l(1000, 6)), 0, null, null,
       jsonb_build_object('mode', 'adresse', 'adresse', pg_temp.adr(), 'transporteur', 'Kuehne', 'port_c', 1500))) = 7500);

-- 6. ENVOYE PUIS ACCEPTE : la livraison est figee avec le reste
select banc.ok('envoye : statut envoye, livraison intacte',
  (select statut = 'envoye' and port_c = 1500 and livraison_mode = 'adresse'
     from public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_53 where k = 'a'), null, null, null, null, null)));
select banc.refus('un devis envoye ne se reenregistre pas, meme pour la livraison',
  $q$ select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000002',
       (select id from t_53 where k = 'a'), jsonb_build_array(banc.l(1000, 6))) $q$, '23514');
select banc.ok('accepte : le port suit le devis',
  (select statut = 'accepte' and port_c = 1500 and total_ht_c = 7500
     from public.devis_accepter('b5000000-0000-0000-0000-000000000005', (select id from t_53 where k = 'a'))));
reset role;
select banc.refus('meme le proprietaire ne change pas le port d un devis accepte',
  $q$ update public.devis set port_c = 0, total_ht_c = 6000, tva_c = 1200, total_ttc_c = 7200 where devis_id = (select id from t_53 where k = 'a') $q$, '23514');

-- 7. LA TABLE SE DEFEND SEULE (sans passer par la fonction)
select banc.refus('table : un retrait avec du port est refuse',
  $q$ update public.devis set livraison_mode = 'retrait', port_c = 100, total_ht_c = total_ht_c + 100,
       tva_c = round((total_ht_c + 100)::numeric * 2000 / 10000), total_ttc_c = total_ht_c + 100 + round((total_ht_c + 100)::numeric * 2000 / 10000)
       where devis_id = (select id from t_53 where k = 'c') $q$, '23514');
select banc.refus('table : un port qui ne rentre pas dans le total est refuse',
  $q$ update public.devis set port_c = 100 where devis_id = (select id from t_53 where k = 'c') $q$, '23514');
select banc.refus('table : le mode adresse sans adresse est refuse',
  $q$ update public.devis set livraison_mode = 'adresse' where devis_id = (select id from t_53 where k = 'c') $q$, '23514');
select banc.refus('table : une adresse en mode client est refusee',
  $q$ update public.devis set livraison = pg_temp.adr() where devis_id = (select id from t_53 where k = 'c') $q$, '23514');
select banc.refus('table : un telephone de livraison de plus de 20 caracteres est refuse',
  $q$ update public.devis set livraison_mode = 'adresse', livraison = pg_temp.adr() || '{"telephone":"012345678901234567890"}'::jsonb
       where devis_id = (select id from t_53 where k = 'r') $q$, '23514');
select banc.ok('les devis des lots d avant restent valides (port 0, mode client)',
  (select count(*) from public.devis where port_c <> 0 and devis_id not in (select id from t_53)) = 0
  and (select count(*) from public.devis where livraison_mode is null) = 0);

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 53 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
