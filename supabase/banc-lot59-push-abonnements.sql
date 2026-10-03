-- ===========================================================================
-- BANC DU LOT 59 (les appareils des notifications), 03/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 58 (qui rejoue 57 a 47), passe DEUX FOIS
-- supabase/lot59-push-abonnements.sql, puis verifie ce que le lot promet.
--   psql -h /tmp -p 55457 -d banc59 -v ON_ERROR_STOP=1 -f banc-lot59-push-abonnements.sql
-- Derniere ligne attendue : « BANC DU LOT 59 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot58-mails-reglables.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);

\ir lot59-push-abonnements.sql
\ir lot59-push-abonnements.sql
truncate banc.resultats;

-- Trois adresses d'essai, une par service.
create temp table adr (n int, u text);
insert into adr values
  (1, 'https://web.push.apple.com/QGuQyavXutnMp6dSB7m-jEqH'),
  (2, 'https://fcm.googleapis.com/fcm/send/dXfY:APA91bH'),
  (3, 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB');
grant select on adr to authenticated;
\set K '''BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM'''
\set A '''tBHItJI5svbpez7KI4CCXg'''

-- ---------------------------------------------------------------------------
-- 1. LES DROITS
-- ---------------------------------------------------------------------------
select banc.ok('le navigateur lit, mais n ecrit jamais la table',
  has_table_privilege('authenticated', 'public.push_abonnements', 'select')
  and not has_table_privilege('authenticated', 'public.push_abonnements', 'insert')
  and not has_table_privilege('authenticated', 'public.push_abonnements', 'update')
  and not has_table_privilege('authenticated', 'public.push_abonnements', 'delete')
  and not has_table_privilege('anon', 'public.push_abonnements', 'select'));
select banc.ok('les deux fonctions : connecte oui, anonyme non',
  has_function_privilege('authenticated', 'public.push_inscrire(text,text,text,text)', 'execute')
  and has_function_privilege('authenticated', 'public.push_retirer(text)', 'execute')
  and not has_function_privilege('anon', 'public.push_inscrire(text,text,text,text)', 'execute')
  and not has_function_privilege('anon', 'public.push_retirer(text)', 'execute'));
select banc.ok('le role de service lit et nettoie',
  has_table_privilege('service_role', 'public.push_abonnements', 'select')
  and has_table_privilege('service_role', 'public.push_abonnements', 'delete'));

-- ---------------------------------------------------------------------------
-- 2. L'ADRESSE EST FILTREE A L'ENTREE
-- ---------------------------------------------------------------------------
select banc.ok('les quatre services passent',
  public.push_adresse_valide('https://web.push.apple.com/abc')
  and public.push_adresse_valide('https://fcm.googleapis.com/fcm/send/abc')
  and public.push_adresse_valide('https://updates.push.services.mozilla.com/wpush/v2/abc')
  and public.push_adresse_valide('https://wns2-par02p.notify.windows.com/w/?token=abc'));
select banc.ok('une adresse inventee, en http, ou deguisee est refusee',
  not public.push_adresse_valide('https://exemple.fr/push')
  and not public.push_adresse_valide('http://fcm.googleapis.com/fcm/send/abc')
  and not public.push_adresse_valide('https://fcm.googleapis.com.exemple.fr/x')
  and not public.push_adresse_valide('https://evil.fr/?u=https://fcm.googleapis.com/x')
  and not public.push_adresse_valide('https://fcm.googleapis.com/')
  and not public.push_adresse_valide('https://fcm.googleapis.com/a' || chr(1) || 'b')
  and not coalesce(public.push_adresse_valide(null), false));
set role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-0000000000a1', false);
do $$ begin
  begin
    perform public.push_inscrire('https://exemple.fr/push', repeat('k', 87), repeat('a', 22), 'iPhone');
    perform banc.ok('push_inscrire refuse une adresse qui n est pas un service d envoi', false);
  exception when invalid_parameter_value then
    perform banc.ok('push_inscrire refuse une adresse qui n est pas un service d envoi', true);
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 3. INSCRIRE, RELIRE, RETIRER
-- ---------------------------------------------------------------------------
select public.push_inscrire((select u from adr where n = 1), :K, :A, 'iPhone, Safari');
select public.push_inscrire((select u from adr where n = 2), :K, :A, 'Mac, Chrome');
select public.push_inscrire((select u from adr where n = 2), :K, :A, 'Mac, Chrome');
select banc.ok('Anne : deux appareils, et la reinscription du meme ne double pas',
  (select count(*) = 2 from public.push_abonnements));
reset role;
select banc.ok('la ligne porte la personne connectee, posee par la base',
  (select bool_and(personne = 'a1000000-0000-0000-0000-0000000000a1') from public.push_abonnements));
set role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-0000000000a2', false);
select banc.ok('Bruno ne voit pas les appareils d Anne', (select count(*) = 0 from public.push_abonnements));
select banc.ok('Bruno ne peut pas retirer l appareil d Anne',
  public.push_retirer((select u from adr where n = 1)) = false);
reset role;
select banc.ok('et il est toujours la', (select count(*) = 2 from public.push_abonnements));

-- Le poste partage : Bruno se connecte sur le Mac d'Anne et dit oui.
set role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-0000000000a2', false);
select public.push_inscrire((select u from adr where n = 2), :K, :A, 'Mac, Chrome');
reset role;
select banc.ok('poste partage : l adresse change de main, Anne ne recevra plus rien sur ce Mac',
  (select personne = 'a2000000-0000-0000-0000-0000000000a2' from public.push_abonnements where endpoint = (select u from adr where n = 2))
  and (select count(*) = 2 from public.push_abonnements));

set role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-0000000000a1', false);
select banc.ok('Anne retire son iPhone', public.push_retirer((select u from adr where n = 1)) = true);
select banc.ok('et ne voit plus rien', (select count(*) = 0 from public.push_abonnements));
reset role;

-- Anonyme : refuse.
set role anon;
do $$ begin
  begin
    perform public.push_inscrire('https://fcm.googleapis.com/fcm/send/x', repeat('k', 87), repeat('a', 22), null);
    perform banc.ok('l anonyme ne peut pas inscrire', false);
  exception when insufficient_privilege then
    perform banc.ok('l anonyme ne peut pas inscrire', true);
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 4. GARDE-FOUS
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', 'a3000000-0000-0000-0000-0000000000a3', false);
select public.push_inscrire('https://fcm.googleapis.com/fcm/send/c' || g, repeat('k', 87), repeat('a', 22), 'essai ' || g)
  from generate_series(1, 12) g;
reset role;
select banc.ok('dix appareils au plus par personne, les plus anciens sortent',
  (select count(*) = 10 from public.push_abonnements where personne = 'a3000000-0000-0000-0000-0000000000a3'));
do $$ begin
  begin
    insert into public.push_abonnements (endpoint, personne, p256dh, auth)
      values ('https://fcm.googleapis.com/fcm/send/z', 'a3000000-0000-0000-0000-0000000000a3', 'court', 'court');
    perform banc.ok('des cles trop courtes sont refusees', false);
  exception when check_violation then
    perform banc.ok('des cles trop courtes sont refusees', true);
  end;
end $$;
select banc.ok('supprimer le compte emporte ses appareils',
  (select confdeltype = 'c' from pg_constraint where conrelid = 'public.push_abonnements'::regclass and contype = 'f'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 59 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
