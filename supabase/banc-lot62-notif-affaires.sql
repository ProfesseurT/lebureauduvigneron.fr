-- ===========================================================================
-- BANC DU LOT 62 (les affaires des collegues, le renouvellement), 05/10/2026.
-- NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue TOUT le banc du lot 61 (qui rejoue 60 a 47), passe DEUX FOIS
-- supabase/lot62-notif-affaires.sql, puis verifie ce que le lot promet.
--   psql -h /tmp -p 55457 -d banc62 -v ON_ERROR_STOP=1 -f banc-lot62-notif-affaires.sql
-- Derniere ligne attendue : « BANC DU LOT 62 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot61-notif-horaire.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);

\ir lot62-notif-affaires.sql
\ir lot62-notif-affaires.sql
truncate banc.resultats;
update public.profils set notif_mail_signe = true, notif_mail_gagnee = true;

-- ---------------------------------------------------------------------------
-- 1. LES CASES ET LES DROITS
-- ---------------------------------------------------------------------------
select banc.ok('gagnee cochee, perdue decochee par defaut',
  (select string_agg(column_name || '=' || column_default, ',' order by column_name) from information_schema.columns
    where table_name = 'profils' and column_name in ('notif_push_gagnee', 'notif_push_perdue'))
  = 'notif_push_gagnee=true,notif_push_perdue=false');
select banc.ok('push_cibles a trois arguments remplace celle a deux, service seul',
  to_regprocedure('public.push_cibles(uuid,text)') is null and to_regprocedure('public.push_cibles(uuid,text,uuid)') is not null
  and has_function_privilege('service_role', 'public.push_cibles(uuid,text,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.push_cibles(uuid,text,uuid)', 'execute'));
select banc.ok('push_remplacer s appelle sans compte (le recepteur n en a pas)',
  has_function_privilege('anon', 'public.push_remplacer(text,text,text,text)', 'execute'));

-- ---------------------------------------------------------------------------
-- 2. LA PERDUE REVIENT, SANS MAIL ; LA GAGNEE NE CHANGE PAS
-- ---------------------------------------------------------------------------
update public.affaires set issue = 'en_cours', motif = null where affaire_id = 'ca000000-0000-0000-0000-000000000002';
truncate net.appels;
set role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-0000000000a2', false);
update public.affaires set issue = 'perdue', motif = 'prix' where affaire_id = 'ca000000-0000-0000-0000-000000000002';
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('perdue : le declencheur previent de nouveau la fonction (pour la notification)', (select count(*) = 1 from net.appels));
set role service_role;
create temp table d62 as
  select public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000002') as p,
         public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000003') as g;
reset role;
select banc.ok('perdue : detail rendu, sorte perdue, et AUCUN destinataire de mail meme tout coche',
  (select p->>'sorte' = 'perdue' and p->'destinataires' = '[]'::jsonb from d62));
select banc.ok('perdue : le detail porte l auteur (close_par = Bruno)',
  (select p->>'close_par' = 'a2000000-0000-0000-0000-0000000000a2' from d62));
select banc.ok('gagnee : toujours ses mails (les trois membres, cases cochees)',
  (select g->>'sorte' = 'gagnee' and jsonb_array_length(g->'destinataires') = 3 and g ? 'close_par' from d62));

-- ---------------------------------------------------------------------------
-- 3. LES APPAREILS, SAUF L'AUTEUR
-- ---------------------------------------------------------------------------
set role service_role;
select banc.ok('gagnee par Camila : ses dix appareils sont exclus, Bruno (un appareil) est prevenu',
  jsonb_array_length(public.push_cibles('ba000000-0000-0000-0000-0000000000ba', 'gagnee', 'a3000000-0000-0000-0000-0000000000a3')) = 1);
select banc.ok('sans auteur (signature en ligne) : tout le monde',
  jsonb_array_length(public.push_cibles('ba000000-0000-0000-0000-0000000000ba', 'gagnee', null)) = 11);
select banc.ok('perdue : case decochee par defaut, personne',
  jsonb_array_length(public.push_cibles('ba000000-0000-0000-0000-0000000000ba', 'perdue', 'a3000000-0000-0000-0000-0000000000a3')) = 0);
reset role;
update public.profils set notif_push_perdue = true where id = 'a2000000-0000-0000-0000-0000000000a2';
set role service_role;
select banc.ok('Bruno coche la perdue : il la recoit quand c est Camila qui perd',
  jsonb_array_length(public.push_cibles('ba000000-0000-0000-0000-0000000000ba', 'perdue', 'a3000000-0000-0000-0000-0000000000a3')) = 1);
select banc.ok('mais jamais quand c est lui qui perd',
  jsonb_array_length(public.push_cibles('ba000000-0000-0000-0000-0000000000ba', 'perdue', 'a2000000-0000-0000-0000-0000000000a2')) = 0);
select banc.ok('une sorte inconnue : personne',
  jsonb_array_length(public.push_cibles('ba000000-0000-0000-0000-0000000000ba', 'autre', null)) = 0);
reset role;

-- ---------------------------------------------------------------------------
-- 4. LE RENOUVELLEMENT
-- ---------------------------------------------------------------------------
\set K '''BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM'''
\set A '''tBHItJI5svbpez7KI4CCXg'''
create temp table av as select endpoint, personne, appareil, cree_le from public.push_abonnements
  where personne = 'a2000000-0000-0000-0000-0000000000a2' limit 1;
grant select on av to anon;
update public.push_abonnements set cree_le = '2026-09-01 08:00+02' where endpoint = (select endpoint from av);
set role anon;
select banc.ok('une adresse inconnue n est jamais creee par ce chemin',
  public.push_remplacer('https://fcm.googleapis.com/fcm/send/inconnue', 'https://fcm.googleapis.com/fcm/send/neuve', :K, :A) = false);
select banc.ok('une nouvelle adresse hors des services d envoi est refusee',
  public.push_remplacer((select endpoint from av), 'https://exemple.fr/x', :K, :A) = false);
select banc.ok('l appareil de Bruno change d adresse : remplace',
  public.push_remplacer((select endpoint from av), 'https://fcm.googleapis.com/fcm/send/renouvelee', :K, :A) = true);
reset role;
select banc.ok('meme personne, meme nom, meme date d ajout, et l ancienne adresse a disparu',
  (select personne = (select personne from av) and appareil is not distinct from (select appareil from av)
       and cree_le = '2026-09-01 08:00+02'
     from public.push_abonnements where endpoint = 'https://fcm.googleapis.com/fcm/send/renouvelee')
  and not exists (select 1 from public.push_abonnements where endpoint = (select endpoint from av)));
set role anon;
select banc.ok('rejouer l ancienne adresse ne sert plus a rien',
  public.push_remplacer((select endpoint from av), 'https://fcm.googleapis.com/fcm/send/autre', :K, :A) = false);
reset role;
select banc.ok('rien n a ete cree en trop', not exists (select 1 from public.push_abonnements
  where endpoint in ('https://fcm.googleapis.com/fcm/send/neuve', 'https://fcm.googleapis.com/fcm/send/autre')));

-- Le vol d'adresse : Camila connait sa propre adresse et celle de Bruno.
create temp table vol as
  select (select endpoint from public.push_abonnements where personne = 'a3000000-0000-0000-0000-0000000000a3' limit 1) as sienne,
         'https://fcm.googleapis.com/fcm/send/renouvelee'::text as bruno;
grant select on vol to anon;
set role anon;
select banc.ok('vol : Camila ne peut pas prendre l adresse de Bruno',
  public.push_remplacer((select sienne from vol), (select bruno from vol), :K, :A) = false);
reset role;
select banc.ok('vol : la ligne de Bruno n a pas bouge (personne, cles) et celle de Camila non plus',
  (select personne = 'a2000000-0000-0000-0000-0000000000a2' and p256dh = :K
     from public.push_abonnements where endpoint = (select bruno from vol))
  and exists (select 1 from public.push_abonnements where endpoint = (select sienne from vol)));
insert into public.push_abonnements (endpoint, personne, p256dh, auth, appareil)
  values ('https://fcm.googleapis.com/fcm/send/vieille-bruno', 'a2000000-0000-0000-0000-0000000000a2', :K, :A, 'test');
set role anon;
select banc.ok('meme personne, adresse deja rangee : accepte, l ancienne part',
  public.push_remplacer('https://fcm.googleapis.com/fcm/send/vieille-bruno', (select bruno from vol), replace(:K, 'BNcR', 'BXXX'), :A) = true);
reset role;
select banc.ok('meme personne : la ligne existante garde ses cles',
  (select p256dh = :K from public.push_abonnements where endpoint = (select bruno from vol))
  and not exists (select 1 from public.push_abonnements where endpoint = 'https://fcm.googleapis.com/fcm/send/vieille-bruno'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 62 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
