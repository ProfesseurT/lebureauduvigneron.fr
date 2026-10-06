-- ===========================================================================
-- BANC DU LOT 71 (le lien de signature se recopie), 06/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 70, puis passe DEUX FOIS supabase/lot71-lien-recopiable.sql.
--   psql -h /tmp -p 55471 -d banc71 -v ON_ERROR_STOP=1 -f banc-lot71-lien-recopiable.sql
-- Derniere ligne attendue : « BANC DU LOT 71 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot70-signature-trace.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
\ir lot71-lien-recopiable.sql
\ir lot71-lien-recopiable.sql
grant execute on all functions in schema banc to service_role;
truncate banc.resultats;

insert into public.affaires (bureau, affaire_id, type_id, etape_id, client_id, client_nom, titre, issue)
  values ('b5000000-0000-0000-0000-000000000005', 'c7100000-0000-0000-0000-000000000001',
          'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'L1', 'en_cours')
  on conflict do nothing;

set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
create temp table t71 (k text primary key, id uuid, j1 text, j2 text);
grant all on t71 to authenticated, service_role;
insert into t71 (k, id) select 'v', d.devis_id
  from public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', 'c7100000-0000-0000-0000-000000000001', null,
    jsonb_build_array(banc.l(1500, 6))) d;
select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', (select id from t71), null, null, null, null,
  '<!doctype html><html><head><title>Devis ' || (select numero from public.devis where devis_id = (select id from t71)) || '</title></head><body>'
  || repeat('Anjou rouge 75 cl. ', 30) || '</body></html>');
update t71 set j1 = public.devis_lien_creer('b5000000-0000-0000-0000-000000000005', id);

select banc.ok('le bureau relit le jeton du lien vivant, egal a celui rendu a la creation',
  (select l.jeton = (select j1 from t71) from public.devis_liens l where l.devis_id = (select id from t71) and l.remplace_le is null));
update t71 set j2 = public.devis_lien_creer('b5000000-0000-0000-0000-000000000005', id);
select banc.ok('un nouveau lien : l ancien oublie son jeton, le nouveau garde le sien',
  (select count(*) = 1 from public.devis_liens l where l.devis_id = (select id from t71) and l.jeton is not null)
  and (select l.jeton = (select j2 from t71) from public.devis_liens l where l.devis_id = (select id from t71) and l.remplace_le is null));
select banc.qui('22222222-2222-2222-2222-222222222222');
select banc.ok('un autre bureau ne voit aucun jeton',
  (select count(*) from public.devis_liens where devis_id = (select id from t71)) = 0);
reset role;
select banc.ok('anon ne lit pas le jeton ; authenticated si',
  not has_column_privilege('anon', 'public.devis_liens', 'jeton', 'select')
  and has_column_privilege('authenticated', 'public.devis_liens', 'jeton', 'select')
  and not has_column_privilege('authenticated', 'public.devis_liens', 'jeton_hash', 'select'));
select banc.refus('la table refuse un jeton qui ne correspond pas a son empreinte',
  format('update public.devis_liens set jeton = %L where devis_id = %L and remplace_le is null', repeat('a', 64), (select id from t71)), '23514');
set role service_role;
select banc.ok('le lien vivant ouvre toujours /signer/ ; l ancien non',
  public.signature_lire((select j2 from t71))->>'etat' = 'a_signer' and public.signature_lire((select j1 from t71))->>'etat' = 'clos');
reset role;

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 71 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
