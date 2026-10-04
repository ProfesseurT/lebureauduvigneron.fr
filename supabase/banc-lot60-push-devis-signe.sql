-- ===========================================================================
-- BANC DU LOT 60 (la premiere notification), 03/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue TOUT le banc du lot 59 (qui rejoue 58 a 47), passe DEUX FOIS
-- supabase/lot60-push-devis-signe.sql, puis verifie ce que le lot promet.
--   psql -h /tmp -p 55457 -d banc60 -v ON_ERROR_STOP=1 -f banc-lot60-push-devis-signe.sql
-- Derniere ligne attendue : « BANC DU LOT 60 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot59-push-abonnements.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);

\ir lot60-push-devis-signe.sql
\ir lot60-push-devis-signe.sql
truncate banc.resultats;

-- Un appareil d'une personne HORS du bureau BA.
insert into public.push_abonnements (endpoint, personne, p256dh, auth, appareil)
  select 'https://fcm.googleapis.com/fcm/send/dehors', u.id, repeat('k', 87), repeat('a', 22), 'dehors'
    from auth.users u
   where u.id not in (select m.personne from public.membres m where m.bureau = 'ba000000-0000-0000-0000-0000000000ba')
   limit 1;

select banc.ok('push_cibles : le role de service seul',
  has_function_privilege('service_role', 'public.push_cibles(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.push_cibles(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.push_cibles(uuid)', 'execute'));
select banc.ok('le decor a bien un appareil hors du bureau',
  (select count(*) = 1 from public.push_abonnements where appareil = 'dehors'));
set role service_role;
create temp table t60 as select public.push_cibles('ba000000-0000-0000-0000-0000000000ba') as c;
reset role;
select banc.ok('les appareils des membres du bureau, et eux seuls',
  (select jsonb_array_length(c) = (select count(*) from public.push_abonnements a
          where a.personne in (select personne from public.membres where bureau = 'ba000000-0000-0000-0000-0000000000ba'))
     and jsonb_array_length(c) >= 1
     and not c @> '[{"endpoint":"https://fcm.googleapis.com/fcm/send/dehors"}]' from t60));
select banc.ok('chaque cible porte l adresse et les deux cles, rien d autre',
  (select bool_and((select array_agg(k order by k) from jsonb_object_keys(e) k) = array['auth','endpoint','p256dh'])
     from t60, jsonb_array_elements(c) e));
set role service_role;
select banc.ok('un bureau inconnu : une liste vide, pas une erreur',
  public.push_cibles('00000000-0000-0000-0000-000000000000') = '[]'::jsonb);
reset role;
select banc.ok('le journal a ses deux colonnes',
  (select count(*) = 2 from information_schema.columns
    where table_name = 'notif_envois' and column_name in ('push_partis', 'push_echec')));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 60 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
