-- ===========================================================================
-- BANC DU LOT 65 (rappeler un devis envoye), 05/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 64 (qui rejoue 63 ... 47), puis passe DEUX FOIS
-- supabase/lot65-rappeler-devis.sql.
--   psql -h /tmp -p 55465 -d banc65 -v ON_ERROR_STOP=1 -f banc-lot65-rappeler-devis.sql
-- Derniere ligne attendue : « BANC DU LOT 65 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot64-objets.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
create temp table t_avant65 as select count(*) as n from public.devis_copies;
\ir lot65-rappeler-devis.sql
\ir lot65-rappeler-devis.sql
grant execute on all functions in schema banc to service_role;
truncate banc.resultats;

insert into public.affaires (bureau, affaire_id, type_id, etape_id, client_id, client_nom, titre, issue) values
  ('b5000000-0000-0000-0000-000000000005', 'c6500000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'R1', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c6500000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'R2', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c6500000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'R3', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c6500000-0000-0000-0000-000000000004', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'R4', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c6500000-0000-0000-0000-000000000005', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'R5', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c6500000-0000-0000-0000-000000000006', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'R6', 'en_cours');

-- 1. LA FORME
select banc.ok('devis_rappeler existe une fois, a 2 arguments',
  (select count(*) = 1 and min(pronargs) = 2 from pg_proc where proname = 'devis_rappeler'));
select banc.ok('authenticated rappelle, anon non',
  has_function_privilege('authenticated', 'public.devis_rappeler(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.devis_rappeler(uuid, uuid)', 'execute'));
select banc.ok('la cle des copies porte la version',
  (select array_length(conkey, 1) = 3 from pg_constraint where conrelid = 'public.devis_copies'::regclass and contype = 'p'));
select banc.ok('les copies deja rangees sont toutes la version 1, aucune perdue',
  (select count(*) from public.devis_copies) = (select n from t_avant65)
  and not exists (select 1 from public.devis_copies where version <> 1));
select banc.ok('les devis existants sont en version 1',
  not exists (select 1 from public.devis where version <> 1 or rappele_le is not null));

set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
create temp table t_65 (k text primary key, id uuid, num text, jeton text);
grant all on t_65 to authenticated, service_role;
insert into t_65 (k, id, num) select 'r' || n, d.devis_id, d.numero
  from generate_series(1, 6) n,
  lateral public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', ('c6500000-0000-0000-0000-00000000000' || n)::uuid, null,
    jsonb_build_array(banc.l(1500, 6))) d;
create function pg_temp.i65(k text) returns uuid language sql as $f$ select id from t_65 where t_65.k = $1 $f$;
create function pg_temp.j65(k text) returns text language sql as $f$ select jeton from t_65 where t_65.k = $1 $f$;
create function pg_temp.pap65(k text, v text default '') returns text language sql as
  $f$ select '<!doctype html><html><head><title>Devis ' || (select num from t_65 where t_65.k = $1) || '</title></head><body>'
             || $2 || repeat('Chinon rouge 75 cl, six bouteilles. ', 20) || '</body></html>' $f$;
create function pg_temp.d65(k text) returns public.devis language sql as
  $f$ select * from public.devis where devis_id = (select id from t_65 where t_65.k = $1) $f$;

-- Tous envoyes avec leur copie ; r1, r2, r3 avec un lien.
select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', pg_temp.i65('r' || n), null, null, null, null, pg_temp.pap65('r' || n))
  from generate_series(1, 6) n;
update t_65 set jeton = public.devis_lien_creer('b5000000-0000-0000-0000-000000000005', id) where k in ('r1', 'r2', 'r3');

-- 2. LE RAPPEL
create temp table t65_r1 as select (pg_temp.d65('r1')).*;
create temp table t65_x1 as select * from public.devis_rappeler('b5000000-0000-0000-0000-000000000005', pg_temp.i65('r1'));
select banc.ok('rappele : enregistre, version 2, meme numero',
  (select statut = 'enregistre' and version = 2 and numero = (select num from t_65 where k = 'r1') from t65_x1));
select banc.ok('rappele : envoi, empreinte et date de la copie effaces ; rappel date et signe',
  (select envoye_le is null and envoye_par is null and papier_empreinte is null and papier_le is null
          and rappele_le is not null and rappele_par = '55555555-5555-5555-5555-555555555555' from t65_x1));
select banc.ok('rappele : lignes et totaux intacts',
  (select x.total_ht_c = r.total_ht_c and x.total_ttc_c = r.total_ttc_c from t65_x1 x, t65_r1 r));
select banc.ok('rappele : le lien est eteint',
  not exists (select 1 from public.devis_liens where devis_id = pg_temp.i65('r1') and remplace_le is null));
select banc.ok('la copie de la version 1 reste',
  (select count(*) = 1 and min(version) = 1 from public.devis_copies where devis_id = pg_temp.i65('r1')));
select banc.ok('rappeler un devis deja revenu enregistre le rend tel quel',
  (select version = 2 and statut = 'enregistre' from public.devis_rappeler('b5000000-0000-0000-0000-000000000005', pg_temp.i65('r1'))));

reset role;
set role service_role;
select banc.ok('le vieux lien ne montre plus rien (clos, ni client ni copie)',
  (select l->>'etat' = 'clos' and not (l ? 'papier') and not (l ? 'client')
     from public.signature_lire(pg_temp.j65('r1')) l));
select banc.ok('le vieux lien ne signe pas',
  (select l->>'etat' = 'clos' from public.signature_poser(pg_temp.j65('r1'), 'Jean Dupont', 'Gerant', true,
     (select empreinte from public.devis_copies where devis_id = pg_temp.i65('r1') and version = 1)) l)
  and not exists (select 1 from public.devis_signatures where devis_id = pg_temp.i65('r1')));
reset role;

-- 3. LA VERSION 2 SE MODIFIE, PART, ET SE SIGNE
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
select banc.ok('la version 2 se modifie sous le meme numero',
  (select numero = (select num from t_65 where k = 'r1') and version = 2 and total_ht_c = 2400 * 6
     from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c6500000-0000-0000-0000-000000000001', pg_temp.i65('r1'),
       jsonb_build_array(banc.l(2400, 6)))));
create temp table t65_e2 as select * from public.devis_envoyer('b5000000-0000-0000-0000-000000000005', pg_temp.i65('r1'),
  null, null, null, null, pg_temp.pap65('r1', 'version 2 '));
select banc.ok('la version 2 part avec sa propre copie',
  (select statut = 'envoye' and papier_empreinte ~ '^[0-9a-f]{64}$' from t65_e2)
  and (select count(*) = 2 from public.devis_copies where devis_id = pg_temp.i65('r1'))
  and (select empreinte = (select papier_empreinte from t65_e2) from public.devis_copies where devis_id = pg_temp.i65('r1') and version = 2)
  and (select empreinte <> (select papier_empreinte from t65_e2) from public.devis_copies where devis_id = pg_temp.i65('r1') and version = 1));
update t_65 set jeton = public.devis_lien_creer('b5000000-0000-0000-0000-000000000005', id) where k = 'r1';
reset role;
set role service_role;
select banc.ok('le nouveau lien montre la copie de la version 2, et la version',
  (select l->>'etat' = 'a_signer' and l->>'papier' like '%version 2 %' and (l->>'version')::int = 2
     from public.signature_lire(pg_temp.j65('r1')) l));
select banc.ok('la version 2 se signe',
  (select l->>'etat' = 'signe' from public.signature_poser(pg_temp.j65('r1'), 'Jean Dupont', 'Gerant', true,
     (select papier_empreinte from public.devis where devis_id = pg_temp.i65('r1'))) l));
select banc.ok('apres signature, le lien montre toujours la copie signee',
  (select l->>'etat' = 'signe' and l->>'papier' like '%version 2 %' from public.signature_lire(pg_temp.j65('r1')) l));
reset role;

-- 4. LES REFUS
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
select banc.refus('un devis signe (donc accepte) ne se rappelle pas',
  format('select public.devis_rappeler(%L, %L)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i65('r1')), '23514');
select public.devis_annuler_accord('b5000000-0000-0000-0000-000000000005', pg_temp.i65('r1'), true);
select banc.ok('acceptation annulee : le devis signe redevient envoye', (pg_temp.d65('r1')).statut = 'envoye');
select banc.refus('un devis signe puis annule ne se rappelle toujours pas',
  format('select public.devis_rappeler(%L, %L)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i65('r1')), '23514');
-- r2 : accepte a la main, commande telechargee, acceptation annulee.
select public.devis_accepter('b5000000-0000-0000-0000-000000000005', pg_temp.i65('r2'));
select public.devis_noter_telechargement('b5000000-0000-0000-0000-000000000005', pg_temp.i65('r2'));
select public.devis_annuler_accord('b5000000-0000-0000-0000-000000000005', pg_temp.i65('r2'), true);
select banc.refus('une commande deja telechargee ne se rappelle pas',
  format('select public.devis_rappeler(%L, %L)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i65('r2')), '23514');
-- r3 : accepte a la main, PAS telechargee, puis annule : il se rappelle.
select public.devis_accepter('b5000000-0000-0000-0000-000000000005', pg_temp.i65('r3'));
select banc.refus('un devis accepte ne se rappelle pas',
  format('select public.devis_rappeler(%L, %L)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i65('r3')), '23514');
select public.devis_annuler_accord('b5000000-0000-0000-0000-000000000005', pg_temp.i65('r3'), true);
select banc.ok('accepte a la main, annule, jamais telecharge : il se rappelle',
  (select statut = 'enregistre' and version = 2 from public.devis_rappeler('b5000000-0000-0000-0000-000000000005', pg_temp.i65('r3'))));
-- r4 : abandonne.
select public.devis_abandonner('b5000000-0000-0000-0000-000000000005', pg_temp.i65('r4'));
select banc.refus('un devis abandonne ne se rappelle pas',
  format('select public.devis_rappeler(%L, %L)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i65('r4')), '23514');
select banc.refus('un devis inconnu',
  format('select public.devis_rappeler(%L, %L)', 'b5000000-0000-0000-0000-000000000005', gen_random_uuid()), 'P0002');
select banc.qui('22222222-2222-2222-2222-222222222222');
select banc.refus('hors du bureau',
  format('select public.devis_rappeler(%L, %L)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i65('r5')), '42501');
reset role;
-- r5 : affaire close a la main (gagnee sans devis accepte).
update public.affaires set issue = 'gagnee' where affaire_id = 'c6500000-0000-0000-0000-000000000005';
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
select banc.refus('une affaire close ne laisse pas rappeler',
  format('select public.devis_rappeler(%L, %L)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i65('r5')), '23514');
reset role;

-- 5. LA DATE : un devis envoye un autre jour est date du jour du rappel, sa validite suit.
set session_replication_role = replica;
update public.devis set date_devis = current_date - 40, valable_jusqu = current_date - 10,
       envoye_le = current_date - 40, livraison_souhaitee = current_date - 20 where devis_id = pg_temp.i65('r6');
set session_replication_role = origin;
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
select banc.ok('un devis expire, rappele, est date du jour et retrouve ses 30 jours',
  (select date_devis = public.devis_jour(now()) and valable_jusqu = public.devis_jour(now()) + 30 and version = 2
          and livraison_souhaitee is null
     from public.devis_rappeler('b5000000-0000-0000-0000-000000000005', pg_temp.i65('r6'))));
reset role;

-- 6. LE GEL
select banc.refus('la version ne change pas hors rappel',
  format('update public.devis set version = version + 1 where devis_id = %L', pg_temp.i65('r6')), '23514');
select banc.refus('le rappel ne se pose pas a la main',
  format('update public.devis set rappele_le = now() where devis_id = %L', pg_temp.i65('r6')), '23514');
select banc.refus('la date ne change pas hors rappel',
  format('update public.devis set date_devis = date_devis + 1 where devis_id = %L', pg_temp.i65('r6')), '23514');
select banc.refus('un faux rappel qui touche aussi aux notes est refuse',
  format('update public.devis set statut = ''enregistre'', version = version + 1, rappele_le = now(), envoye_le = null, envoye_par = null, papier_empreinte = null, papier_le = null, notes = ''x'' where devis_id = %L',
    pg_temp.i65('r1')), '23514');
select banc.refus('un faux rappel qui saute une version est refuse',
  format('update public.devis set statut = ''enregistre'', version = version + 2, rappele_le = now(), envoye_le = null, envoye_par = null, papier_empreinte = null, papier_le = null where devis_id = %L',
    pg_temp.i65('r1')), '23514');
select banc.refus('un faux rappel qui garde l empreinte est refuse',
  format('update public.devis set statut = ''enregistre'', version = version + 1, rappele_le = now(), envoye_le = null, envoye_par = null where devis_id = %L',
    pg_temp.i65('r1')), '23514');
select banc.refus('un faux rappel qui recule la date est refuse',
  format('update public.devis set statut = ''enregistre'', version = version + 1, rappele_le = now(), envoye_le = null, envoye_par = null, papier_empreinte = null, papier_le = null, date_devis = date_devis - 1, valable_jusqu = valable_jusqu - 1 where devis_id = %L',
    pg_temp.i65('r1')), '23514');
select banc.refus('un faux rappel qui avance la date au-dela d aujourd hui est refuse',
  format('update public.devis set statut = ''enregistre'', version = version + 1, rappele_le = now(), envoye_le = null, envoye_par = null, papier_empreinte = null, papier_le = null, date_devis = current_date + 300, valable_jusqu = current_date + 330 where devis_id = %L',
    pg_temp.i65('r1')), '23514');
select banc.refus('un faux rappel qui change la livraison souhaitee est refuse',
  format('update public.devis set statut = ''enregistre'', version = version + 1, rappele_le = now(), envoye_le = null, envoye_par = null, papier_empreinte = null, papier_le = null, livraison_souhaitee = current_date + 60 where devis_id = %L',
    pg_temp.i65('r1')), '23514');
select banc.refus('une copie de version 1 ne se supprime pas',
  format('delete from public.devis_copies where devis_id = %L and version = 1', pg_temp.i65('r1')), '23514');
select banc.ok('un devis neuf nait en version 1, sans rappel',
  not exists (select 1 from public.devis where devis_id = pg_temp.i65('r5') and (version <> 1 or rappele_le is not null)));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 65 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
