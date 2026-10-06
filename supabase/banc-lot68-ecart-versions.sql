-- ===========================================================================
-- BANC DU LOT 68 (l'ecart entre deux versions d'un devis), 06/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 65, puis passe DEUX FOIS supabase/lot68-ecart-versions.sql.
--   psql -h /tmp -p 55465 -d banc68 -v ON_ERROR_STOP=1 -f banc-lot68-ecart-versions.sql
-- Derniere ligne attendue : « BANC DU LOT 68 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot65-rappeler-devis.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
create temp table t_avant68 as select count(*) as n from public.devis where version > 1;
\ir lot68-ecart-versions.sql
\ir lot68-ecart-versions.sql
grant execute on all functions in schema banc to service_role;
truncate banc.resultats;

-- 1. LA FORME
select banc.ok('la table devis_versions existe, lisible par authenticated, pas par anon',
  has_table_privilege('authenticated', 'public.devis_versions', 'select')
  and not has_table_privilege('anon', 'public.devis_versions', 'select')
  and not has_table_privilege('authenticated', 'public.devis_versions', 'insert')
  and not has_table_privilege('authenticated', 'public.devis_versions', 'update'));
select banc.ok('le declencheur existe une fois', (select count(*) = 1 from pg_trigger where tgname = 'devis_garder_version' and not tgisinternal));
select banc.ok('les devis deja corriges n ont pas d ecart (rien n est invente)', not exists (select 1 from public.devis_versions));

insert into public.affaires (bureau, affaire_id, type_id, etape_id, client_id, client_nom, titre, issue) values
  ('b5000000-0000-0000-0000-000000000005', 'c6800000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'V1', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c6800000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'V2', 'en_cours');

set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
create temp table t_68 (k text primary key, id uuid, num text);
grant all on t_68 to authenticated, service_role;
insert into t_68 (k, id, num) select 'v' || n, d.devis_id, d.numero
  from generate_series(1, 2) n,
  lateral public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', ('c6800000-0000-0000-0000-00000000000' || n)::uuid, null,
    jsonb_build_array(banc.l(1500, 6))) d;
create function pg_temp.i68(k text) returns uuid language sql as $f$ select id from t_68 where t_68.k = $1 $f$;
create function pg_temp.pap68(k text, v text default '') returns text language sql as
  $f$ select '<!doctype html><html><head><title>Devis ' || (select num from t_68 where t_68.k = $1) || '</title></head><body>'
             || $2 || repeat('Chinon rouge 75 cl, six bouteilles. ', 20) || '</body></html>' $f$;
select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', pg_temp.i68('v' || n), null, null, null, null, pg_temp.pap68('v' || n))
  from generate_series(1, 2) n;
create temp table t68_ht as select total_ht_c from public.devis where devis_id = pg_temp.i68('v1');
grant all on t68_ht to authenticated, service_role;

-- 2. LA CORRECTION GARDE LE TOTAL DE LA VERSION QUI PART
select public.devis_rappeler('b5000000-0000-0000-0000-000000000005', pg_temp.i68('v1'));
select banc.ok('apres une correction, la version 1 est gardee avec SON total HT',
  (select count(*) = 1 and bool_and(version = 1 and total_ht_c = (select total_ht_c from t68_ht) and gardee_le is not null)
     from public.devis_versions where devis_id = pg_temp.i68('v1')));
select banc.ok('un membre du bureau la lit', (select count(*) = 1 from public.devis_versions where devis_id = pg_temp.i68('v1')));
-- Le total change dans la version 2 : la ligne gardee, non.
select public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c6800000-0000-0000-0000-000000000001', pg_temp.i68('v1'),
  jsonb_build_array(banc.l(1500, 12)));
select banc.ok('modifier la version 2 ne touche pas le total garde de la version 1',
  (select total_ht_c = (select total_ht_c from t68_ht) from public.devis_versions where devis_id = pg_temp.i68('v1') and version = 1)
  and (select total_ht_c <> (select total_ht_c from t68_ht) from public.devis where devis_id = pg_temp.i68('v1')));
select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', pg_temp.i68('v1'), null, null, null, null, pg_temp.pap68('v1', 'Version 2, remplace la version 1'));
select public.devis_rappeler('b5000000-0000-0000-0000-000000000005', pg_temp.i68('v1'));
select banc.ok('une seconde correction garde la version 2, a son total a elle',
  (select count(*) = 2 from public.devis_versions where devis_id = pg_temp.i68('v1'))
  and (select total_ht_c from public.devis_versions where devis_id = pg_temp.i68('v1') and version = 2)
      = (select total_ht_c from public.devis where devis_id = pg_temp.i68('v1')));
select banc.ok('un devis jamais corrige n a aucune version gardee', not exists (select 1 from public.devis_versions where devis_id = pg_temp.i68('v2')));

-- 3. PERSONNE NE L'ECRIT A LA MAIN
select banc.refus('un membre n ecrit pas une version gardee',
  format('insert into public.devis_versions (bureau, devis_id, version, total_ht_c) values (%L, %L, 5, 1)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i68('v2')), '42501');
select banc.refus('un membre ne change pas une version gardee',
  format('update public.devis_versions set total_ht_c = 1 where devis_id = %L', pg_temp.i68('v1')), '42501');
reset role;
select banc.refus('meme le proprietaire ne change pas une version gardee',
  format('update public.devis_versions set total_ht_c = 1 where devis_id = %L', pg_temp.i68('v1')), '23514');
set role authenticated;
select banc.qui('99999999-9999-9999-9999-999999999999');
select banc.ok('un etranger au bureau ne lit rien', not exists (select 1 from public.devis_versions));
reset role;

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 68 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
