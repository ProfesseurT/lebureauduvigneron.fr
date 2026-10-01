-- ===========================================================================
-- BANC DU LOT 52 (copie du devis envoye, trace du fichier de commande), 01/10/2026.
-- NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 51 (qui rejoue 50, 49 et 47), puis passe DEUX FOIS
-- supabase/lot52-devis-copie-trace.sql.
--   initdb -D /tmp/pg52 -A trust
--   pg_ctl -D /tmp/pg52 -o "-k /tmp -p 55452" start
--   psql -h /tmp -p 55452 -d postgres -c "create database banc52"
--   psql -h /tmp -p 55452 -d banc52 -v ON_ERROR_STOP=1 -f banc-lot52-devis-copie-trace.sql
-- Derniere ligne attendue : « BANC DU LOT 52 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot51-devis-mentions-refus.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
\ir lot52-devis-copie-trace.sql
\ir lot52-devis-copie-trace.sql
truncate banc.resultats;

insert into public.affaires (bureau, affaire_id, type_id, etape_id, client_id, client_nom, titre, issue) values
  ('b5000000-0000-0000-0000-000000000005', 'c5200000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'P1', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5200000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'P2', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5200000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'P3', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5200000-0000-0000-0000-000000000004', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'P4', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5200000-0000-0000-0000-000000000005', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'P5', 'en_cours');

set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
create temp table t_52 (k text primary key, id uuid, num text);
grant all on t_52 to authenticated;
insert into t_52 select 'p1', d.devis_id, d.numero from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5200000-0000-0000-0000-000000000001', null, jsonb_build_array(banc.l(1000, 6))) d;
insert into t_52 select 'p2', d.devis_id, d.numero from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5200000-0000-0000-0000-000000000002', null, jsonb_build_array(banc.l(1000, 6))) d;
insert into t_52 select 'p3', d.devis_id, d.numero from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5200000-0000-0000-0000-000000000003', null, jsonb_build_array(banc.l(1000, 6))) d;
insert into t_52 select 'p4', d.devis_id, d.numero from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5200000-0000-0000-0000-000000000004', null, jsonb_build_array(banc.l(1000, 6))) d;
insert into t_52 select 'p5', d.devis_id, d.numero from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c5200000-0000-0000-0000-000000000005', null, jsonb_build_array(banc.l(1000, 6))) d;
-- Un papier plausible : doctype, le numero, et de quoi depasser 500 octets.
create function pg_temp.pap(k text, extra text default '') returns text language sql as
  $f$ select '<!doctype html><html><head><title>Devis ' || (select num from t_52 where t_52.k = $1) || '</title></head><body>'
             || repeat('Bourgueil rouge 75 cl, six bouteilles. ', 20) || $2 || '</body></html>' $f$;

-- 1. LES DROITS
select banc.ok('une seule signature de devis_envoyer, a 7 arguments ; de devis_accepter, a 3',
  (select count(*) from pg_proc where proname = 'devis_envoyer') = 1 and (select pronargs from pg_proc where proname = 'devis_envoyer') = 7
  and (select count(*) from pg_proc where proname = 'devis_accepter') = 1 and (select pronargs from pg_proc where proname = 'devis_accepter') = 3);
select banc.ok('anon ne peut ni noter un telechargement ni lire une copie',
  not has_function_privilege('anon', 'public.devis_noter_telechargement(uuid, uuid)', 'execute')
  and not has_table_privilege('anon', 'public.devis_copies', 'select'));
select banc.ok('authenticated LIT les copies, n y ecrit pas, et ne range pas lui-meme',
  has_table_privilege('authenticated', 'public.devis_copies', 'select')
  and not has_table_privilege('authenticated', 'public.devis_copies', 'insert')
  and not has_table_privilege('authenticated', 'public.devis_copies', 'update')
  and not has_table_privilege('authenticated', 'public.devis_copies', 'delete')
  and not has_function_privilege('authenticated', 'public.devis_ranger_copie(uuid, uuid, text, text)', 'execute'));

-- 2. LA COPIE A L'ENVOI
create temp table t_e1 as select * from public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p1'),
  null, null, null, null, pg_temp.pap('p1'));
select banc.ok('l envoi range la copie, et le devis rendu porte son empreinte',
  (select papier_empreinte ~ '^[0-9a-f]{64}$' and papier_le is not null and statut = 'envoye' from t_e1));
select banc.ok('l empreinte est calculee par la BASE, sur le texte range',
  (select c.empreinte = encode(sha256(convert_to(pg_temp.pap('p1'), 'UTF8')), 'hex')
          and c.empreinte = (select papier_empreinte from t_e1) and c.cree_par = '55555555-5555-5555-5555-555555555555'
     from public.devis_copies c where c.devis_id = (select id from t_52 where k = 'p1')));
select banc.ok('double appui : rendu tel quel, la copie ne change pas',
  (select papier_empreinte from public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p1'),
     null, null, null, null, pg_temp.pap('p1', 'autre'))) = (select papier_empreinte from t_e1)
  and (select count(*) from public.devis_copies where devis_id = (select id from t_52 where k = 'p1')) = 1);
select banc.ok('envoyer SANS copie marche comme avant (navigateur d avant le lot)',
  (select statut = 'envoye' and papier_empreinte is null from public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p2'))));

-- 3. UNE COPIE INVALIDE EST IGNOREE, L'ENVOI PASSE
select banc.ok('une copie avec un script est ignoree, l envoi passe',
  (select statut = 'envoye' and papier_empreinte is null from public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p3'),
     null, null, null, null, pg_temp.pap('p3', '<SCRIPT>alert(1)</script>'))));
reset role;
select banc.ok('une copie sans le numero du devis serait ignoree (rien n est range)',
  public.devis_ranger_copie('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p4'), (select num from t_52 where k = 'p4'),
    '<!doctype html>' || repeat('x', 600)) is null
  and not exists (select 1 from public.devis_copies where devis_id = (select id from t_52 where k = 'p4')));
select banc.ok('trop courte, ou pas un document : ignoree',
  public.devis_ranger_copie('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p4'), (select num from t_52 where k = 'p4'), 'Devis ' || (select num from t_52 where k = 'p4')) is null
  and public.devis_ranger_copie('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p4'), (select num from t_52 where k = 'p4'),
        '<html>Devis ' || (select num from t_52 where k = 'p4') || repeat('x', 600)) is null);
select banc.ok('plus de 600 000 octets : ignoree',
  public.devis_ranger_copie('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p4'), (select num from t_52 where k = 'p4'),
    '<!doctype html>Devis ' || (select num from t_52 where k = 'p4') || repeat('x', 600001)) is null);

-- 4. UNE COPIE NE BOUGE PLUS
select banc.refus('meme le proprietaire ne modifie pas une copie',
  $q$ update public.devis_copies set papier = papier || ' ' where devis_id = (select id from t_52 where k = 'p1') $q$, '23514');
select banc.refus('ni ne la supprime',
  $q$ delete from public.devis_copies where devis_id = (select id from t_52 where k = 'p1') $q$, '23514');
select banc.refus('l empreinte du devis ne se reecrit pas',
  $q$ update public.devis set papier_empreinte = repeat('0', 64) where devis_id = (select id from t_52 where k = 'p1') $q$, '23514');
select banc.refus('une empreinte qui ne correspond pas au texte est refusee par la table',
  $q$ insert into public.devis_copies (bureau, devis_id, papier, empreinte) values ('b5000000-0000-0000-0000-000000000005',
       (select id from t_52 where k = 'p4'), repeat('y', 600), repeat('a', 64)) $q$, '23514');

-- 5. L'AUTRE BUREAU
set role authenticated;
select banc.qui('44444444-4444-4444-4444-444444444444');
select banc.ok('un autre bureau ne lit aucune copie', (select count(*) from public.devis_copies) = 0);
select banc.refus('ni ne note un telechargement',
  $q$ select public.devis_noter_telechargement('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p1')) $q$, '42501');
select banc.qui('55555555-5555-5555-5555-555555555555');
select banc.ok('le bureau lit sa copie', (select count(*) from public.devis_copies where devis_id = (select id from t_52 where k = 'p1')) = 1);

-- 6. LA COPIE A L'ACCORD
select banc.ok('un devis envoye SANS copie la recoit a l accord',
  (select statut = 'accepte' and papier_empreinte is not null from public.devis_accepter('b5000000-0000-0000-0000-000000000005',
     (select id from t_52 where k = 'p2'), pg_temp.pap('p2'))));
select banc.ok('un devis qui a deja sa copie la garde a l accord',
  (select papier_empreinte from public.devis_accepter('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p1'), pg_temp.pap('p1', 'neuf')))
    = (select papier_empreinte from t_e1));
select banc.ok('un devis accepte SANS avoir ete envoye ne garde pas de copie (il peut redevenir modifiable)',
  (select statut = 'accepte' and papier_empreinte is null from public.devis_accepter('b5000000-0000-0000-0000-000000000005',
     (select id from t_52 where k = 'p5'), pg_temp.pap('p5'))));
select banc.ok('accepter sans copie marche comme avant (2 arguments)',
  (select statut = 'accepte' from public.devis_accepter('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p4'))));

-- 7. LA TRACE DU TELECHARGEMENT
select banc.refus('un devis non accepte n a pas de commande a noter',
  $q$ select public.devis_noter_telechargement('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p3')) $q$, '23514');
select banc.ok('avant tout telechargement : zero, et pas de date',
  (select commande_telechargements = 0 and commande_telechargee_le is null from public.devis where devis_id = (select id from t_52 where k = 'p1')));
create temp table t_t1 as select * from public.devis_noter_telechargement('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p1'));
select banc.ok('le premier : date, qui, 1',
  (select commande_telechargements = 1 and commande_telechargee_le is not null and commande_telechargee_par = '55555555-5555-5555-5555-555555555555'
          and commande_derniere_le = commande_telechargee_le from t_t1));
select pg_sleep(0.01);
select banc.ok('le deuxieme : 2, la premiere date ne bouge pas, la derniere avance',
  (select commande_telechargements = 2 and commande_telechargee_le = (select commande_telechargee_le from t_t1)
          and commande_derniere_le >= (select commande_derniere_le from t_t1)
     from public.devis_noter_telechargement('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p1'))));
select banc.ok('la trace SURVIT a une annulation de l accord',
  (select statut = 'envoye' and commande_telechargements = 2 and commande_telechargee_le is not null
     from public.devis_annuler_accord('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p1'))));
select banc.refus('devis revenu envoye : plus de commande a noter',
  $q$ select public.devis_noter_telechargement('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p1')) $q$, '23514');
select banc.ok('re-accepte : la trace continue (3)',
  (select statut from public.devis_accepter('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p1'))) = 'accepte'
  and (select commande_telechargements from public.devis_noter_telechargement('b5000000-0000-0000-0000-000000000005', (select id from t_52 where k = 'p1'))) = 3);
reset role;
select banc.refus('un devis accepte ne change toujours pas un prix, meme avec la trace',
  $q$ update public.devis set commande_telechargements = 9, notes = 'x' where devis_id = (select id from t_52 where k = 'p1') $q$, '23514');
select banc.refus('une trace incoherente (un compte sans date) est refusee',
  $q$ update public.devis set commande_telechargements = 1 where devis_id = (select id from t_52 where k = 'p3') $q$, '23514');

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 52 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
