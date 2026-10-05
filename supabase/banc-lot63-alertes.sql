-- ===========================================================================
-- BANC DU LOT 63 (mes alertes, mail x notification), 05/10/2026.
-- NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue TOUT le banc du lot 62 (qui rejoue 61 a 47), passe DEUX FOIS
-- supabase/lot63-alertes.sql, puis verifie ce que le lot promet.
--   psql -h /tmp -p 55457 -d banc63 -v ON_ERROR_STOP=1 -f banc-lot63-alertes.sql
-- Derniere ligne attendue : « BANC DU LOT 63 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot62-notif-affaires.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- LE DECOR : deux colonnes du vrai projet (lot 14 et lot des affaires) que les bancs anterieurs n ont pas.
-- Le faux pg_cron du decor (lot 47) ne remplacait que l horaire ; le vrai remplace aussi la
-- commande d une tache de meme nom. On le rend fidele, pour verifier le nouveau delai.
create or replace function cron.schedule(n text, s text, c text) returns bigint language sql as
$f$ insert into cron.job values (n, s, c) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command; select 1::bigint $f$;
alter table public.suivi_clients add column if not exists rappel_titre text;
alter table public.affaires add column if not exists rappel_titre text;
alter table public.affaires add column if not exists client_nom text;

\ir lot63-alertes.sql
\ir lot63-alertes.sql
truncate banc.resultats;
truncate public.push_journal;
\set MATIN '''2026-10-09 05:30:00+00'''
\set SOIR  '''2026-10-09 15:30:00+00'''
update public.profils set notif_mail_signe = true, notif_mail_gagnee = true,
  notif_push_signe = true, notif_push_echeance = true, notif_push_devis_expire = true, notif_push_rappels = false,
  bureau_courant = 'ba000000-0000-0000-0000-0000000000ba'
 where id in ('a1000000-0000-0000-0000-0000000000a1', 'a2000000-0000-0000-0000-0000000000a2', 'a3000000-0000-0000-0000-0000000000a3');
update public.suivi_clients set statut = 'traite';
update public.affaires set rappel = null where issue = 'en_cours';

-- ---------------------------------------------------------------------------
-- 1. LES CASES ET LES DROITS
-- ---------------------------------------------------------------------------
select banc.ok('quatre cases de mail, toutes decochees par defaut',
  (select string_agg(column_name || '=' || column_default, ',' order by column_name) from information_schema.columns
    where table_name = 'profils' and column_name in ('notif_mail_perdue', 'notif_mail_echeance', 'notif_mail_devis_expire', 'notif_mail_rappels'))
  = 'notif_mail_devis_expire=false,notif_mail_echeance=false,notif_mail_perdue=false,notif_mail_rappels=false');
select banc.ok('chacun peut les changer sur son profil (droit colonne par colonne)',
  has_column_privilege('authenticated', 'public.profils', 'notif_mail_perdue', 'update')
  and has_column_privilege('authenticated', 'public.profils', 'notif_mail_rappels', 'update'));
select banc.ok('le journal des mails : la fonction seule, personne d autre',
  has_table_privilege('service_role', 'public.notif_mail_journal', 'update')
  and not has_table_privilege('authenticated', 'public.notif_mail_journal', 'select')
  and not has_table_privilege('anon', 'public.notif_mail_journal', 'select'));

-- ---------------------------------------------------------------------------
-- 2. LA PERDUE : UN MAIL POUR QUI L A COCHE, ET SEULEMENT LUI
-- ---------------------------------------------------------------------------
set role service_role;
select banc.ok('perdue, personne n a coche : aucun destinataire',
  public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000002')->'destinataires' = '[]'::jsonb);
reset role;
update public.profils set notif_mail_perdue = true where id = 'a1000000-0000-0000-0000-0000000000a1';
set role service_role;
select banc.ok('Anne coche la perdue : elle seule recoit le mail',
  (select jsonb_array_length(d->'destinataires') = 1 and d->'destinataires'->0->>'email' = (select email from public.profils where id = 'a1000000-0000-0000-0000-0000000000a1')
     from (select public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000002') as d) x));
select banc.ok('la gagnee ne change pas : ses trois destinataires',
  jsonb_array_length(public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000003')->'destinataires') = 3);
reset role;
update public.profils set notif_mail_perdue = false;

-- ---------------------------------------------------------------------------
-- 3. LE MATIN, TOUS LES MAILS DECOCHES : EXACTEMENT LE LOT 61
-- ---------------------------------------------------------------------------
set role service_role;
create temp table t1 as select public.notif_horaire_lots('matin', :MATIN) as l;
reset role;
select banc.ok('mails decoches : Bruno et Camila (appareils), « DRM à faire demain. », et aucun mail',
  (select jsonb_array_length(l) = 2 and bool_and(e->'message'->>'titre' = 'DRM à faire demain.' and not (e ? 'mail'))
     from t1, jsonb_array_elements(l) e group by l)
  and not exists (select 1 from t1, jsonb_array_elements(l) e where e->>'personne' = 'a1000000-0000-0000-0000-0000000000a1'));
select banc.ok('aucune ligne au journal des mails', not exists (select 1 from public.notif_mail_journal));

-- ---------------------------------------------------------------------------
-- 4. LE MATIN, AVEC LE MAIL : LE DETAIL
-- ---------------------------------------------------------------------------
truncate public.push_journal;
set session_replication_role = replica;
update public.devis set bureau = 'ba000000-0000-0000-0000-0000000000ba', statut = 'envoye', date_devis = date '2026-10-10' - validite_jours,
       envoye_le = date '2026-10-10' - validite_jours, valable_jusqu = date '2026-10-10'
 where devis_id = (select d.devis_id from public.devis d where d.abandonne_le is null and d.signe_le is null
                     and not exists (select 1 from public.devis x where x.bureau = 'ba000000-0000-0000-0000-0000000000ba'
                                       and x.numero = d.numero and x.devis_id <> d.devis_id)
                   order by d.devis_id limit 1);
set session_replication_role = origin;
-- LA FUITE : un AUTRE bureau (Domaine Six, dont Anne n est pas membre) a aussi un devis qui
-- expire demain, un rappel du soir et une affaire au rappel du jour. Rien ne doit en sortir.
set session_replication_role = replica;
insert into public.devis select (jsonb_populate_record(d, jsonb_build_object(
    'bureau', 'b6000000-0000-0000-0000-000000000006', 'devis_id', gen_random_uuid(), 'rang', 9999,
    'numero', 'D-' || d.annee || '-9999', 'acheteur', jsonb_build_object('nom', 'FUITE')))).*
  from public.devis d where d.valable_jusqu = date '2026-10-10' and d.statut = 'envoye' limit 1;
insert into public.suivi_clients (bureau, client_id, rappel, statut, rappel_titre)
  values ('b6000000-0000-0000-0000-000000000006', 'FUITE', date '2026-10-09', 'a_faire', 'Rappel FUITE');
insert into public.affaires select (jsonb_populate_record(a, jsonb_build_object(
    'bureau', 'b6000000-0000-0000-0000-000000000006', 'affaire_id', gen_random_uuid(), 'titre', 'Affaire FUITE',
    'client_nom', 'FUITE', 'issue', 'en_cours', 'rappel', '2026-10-09'))).*
  from public.affaires a limit 1;
set session_replication_role = origin;
-- Anne (sans appareil) coche les deux mails du matin ; Bruno (un appareil) le mail des echeances.
update public.profils set notif_mail_echeance = true, notif_mail_devis_expire = true where id = 'a1000000-0000-0000-0000-0000000000a1';
update public.profils set notif_mail_echeance = true where id = 'a2000000-0000-0000-0000-0000000000a2';
set role service_role;
create temp table t2 as select public.notif_horaire_lots('matin', :MATIN) as l;
reset role;
create temp table anne as select e from t2, jsonb_array_elements(l) e where e->>'personne' = 'a1000000-0000-0000-0000-0000000000a1';
create temp table bruno as select e from t2, jsonb_array_elements(l) e where e->>'personne' = 'a2000000-0000-0000-0000-0000000000a2';
create temp table camila as select e from t2, jsonb_array_elements(l) e where e->>'personne' = 'a3000000-0000-0000-0000-0000000000a3';
select banc.ok('Anne, sans appareil, a maintenant un mail, et pas de notification',
  (select e ? 'mail' and not (e ? 'message') from anne));
select banc.ok('son mail : la DRM de demain, puis le devis qui expire avec numero, client et montant',
  (select e->'mail'->'echeances' = '[{"court": "DRM", "quand": "demain"}]'::jsonb
      and jsonb_array_length(e->'mail'->'devis') = 1
      and e->'mail'->'devis'->0->>'numero' = (select numero from public.devis where valable_jusqu = date '2026-10-10' and statut = 'envoye' and bureau = 'ba000000-0000-0000-0000-0000000000ba')
      and e->'mail'->'devis'->0 ? 'client' and e->'mail'->'devis'->0 ? 'total_ht_c' from anne));
select banc.ok('son adresse, son prenom, son bureau, et le sujet « 2 choses à voir ce matin »',
  (select e->'mail'->>'email' = (select email from public.profils where id = 'a1000000-0000-0000-0000-0000000000a1')
      and e->'mail'->>'prenom' <> '' and e->'mail'->>'bureau_nom' is not null
      and e->'mail'->>'sujet' = '2 choses à voir ce matin' from anne));
select banc.ok('Bruno : la notification ET un mail des seules echeances (le devis, il ne l a pas coche en mail)',
  (select e ? 'message' and e->'mail'->>'sujet' = 'DRM à faire demain' and e->'mail'->'devis' = '[]'::jsonb from bruno));
select banc.ok('la notification de Bruno ne porte toujours ni nom ni montant',
  (select e->'message'->>'corps' = 'DRM à faire demain. Un devis expire demain sans réponse.' from bruno));
select banc.ok('Camila (aucun mail coche) : la notification seule', (select e ? 'message' and not (e ? 'mail') from camila));
select banc.ok('rien d un autre bureau dans aucun lot (client FUITE)', not exists (select 1 from t2 where l::text like '%FUITE%'));
select banc.ok('le journal des mails est pose AVANT l envoi : Anne et Bruno',
  (select count(*) = 2 from public.notif_mail_journal where moment = 'matin' and envoye_le is null));
set role service_role;
select banc.ok('un second passage la meme heure ne rend plus rien (ni mail ni notification)',
  jsonb_array_length(public.notif_horaire_lots('matin', :MATIN)) = 0);
reset role;

-- Sans adresse : pas de mail (et rien de reserve).
truncate public.notif_mail_journal; truncate public.push_journal;
update public.profils set email = null where id = 'a1000000-0000-0000-0000-0000000000a1';
set role service_role;
select banc.ok('sans adresse mail : Anne n est pas servie, et rien n est reserve pour elle',
  not exists (select 1 from jsonb_array_elements(public.notif_horaire_lots('matin', :MATIN)) e where e->>'personne' = 'a1000000-0000-0000-0000-0000000000a1')
  and not exists (select 1 from public.notif_mail_journal where personne = 'a1000000-0000-0000-0000-0000000000a1'));
reset role;
update public.profils set email = 'anne@exemple.fr' where id = 'a1000000-0000-0000-0000-0000000000a1';

-- ---------------------------------------------------------------------------
-- 5. LE SOIR : LES RAPPELS, PAR LEUR NOM
-- ---------------------------------------------------------------------------
update public.profils set notif_mail_echeance = false, notif_mail_devis_expire = false;
update public.profils set notif_mail_rappels = true where id = 'a1000000-0000-0000-0000-0000000000a1';
insert into public.suivi_clients (bureau, client_id, rappel, statut, rappel_titre)
  values ('ba000000-0000-0000-0000-0000000000ba', 'C077', date '2026-10-09', 'a_faire', 'Relancer pour le rosé'),
         ('ba000000-0000-0000-0000-0000000000ba', 'C078', date '2026-10-09', 'a_faire', null);
insert into public.pistes (bureau, piste_id, nom, nature, client_id)
  values ('ba000000-0000-0000-0000-0000000000ba', gen_random_uuid(), 'Cave Nommée', 'caviste', 'C078'),
         -- Le meme numero client dans un AUTRE bureau : son nom ne doit jamais venir ici.
         ('b6000000-0000-0000-0000-000000000006', gen_random_uuid(), 'Piste FUITE', 'caviste', 'C079');
insert into public.suivi_clients (bureau, client_id, rappel, statut)
  values ('ba000000-0000-0000-0000-0000000000ba', 'C079', date '2026-10-09', 'a_faire');
-- Camila coche aussi les rappels, mais son bureau courant est Domaine Six, dont elle n est pas membre.
update public.profils set notif_mail_rappels = true, bureau_courant = 'b6000000-0000-0000-0000-000000000006'
 where id = 'a3000000-0000-0000-0000-0000000000a3';
set session_replication_role = replica;
update public.affaires set rappel = date '2026-10-09', rappel_titre = 'Envoyer le tarif' where affaire_id = 'ca000000-0000-0000-0000-000000000001';
set session_replication_role = origin;
set role service_role;
create temp table s63 as select public.notif_horaire_lots('soir', :SOIR) as l;
reset role;
select banc.ok('17 h 30 : Anne seule (rappels decoches en notification pour tous), un mail',
  (select jsonb_array_length(l) = 1 and l->0->>'personne' = 'a1000000-0000-0000-0000-0000000000a1' and l->0 ? 'mail' and not (l->0 ? 'message') from s63));
select banc.ok('« 4 rappels promis pour aujourd hui ne sont pas faits », chacun avec son motif',
  (select l->0->'mail'->>'sujet' = '4 rappels promis pour aujourd''hui ne sont pas faits'
      and jsonb_array_length(l->0->'mail'->'rappels') = 4
      and exists (select 1 from jsonb_array_elements(l->0->'mail'->'rappels') r where r->>'quoi' = 'Client C077' and r->>'motif' = 'Relancer pour le rosé')
      and exists (select 1 from jsonb_array_elements(l->0->'mail'->'rappels') r where r->>'motif' = 'Envoyer le tarif')
      and l->0->'mail'->'echeances' = '[]'::jsonb from s63));
select banc.ok('le soir ne regarde jamais les echeances ni les devis', (select l->0->'mail'->'devis' = '[]'::jsonb from s63));
select banc.ok('un client suivi sans motif porte le nom de sa piste (« Cave Nommée »), pas son numero',
  (select exists (select 1 from jsonb_array_elements(l->0->'mail'->'rappels') r where r->>'quoi' = 'Cave Nommée' and r->>'motif' is null) from s63));
select banc.ok('un client sans piste dans CE bureau : « Client C079 », jamais le nom pris ailleurs',
  (select exists (select 1 from jsonb_array_elements(l->0->'mail'->'rappels') r where r->>'quoi' = 'Client C079') from s63));
select banc.ok('rien du Domaine Six, ni pour Anne ni pour Camila qui n en est pas membre',
  (select l::text not like '%FUITE%' and not exists (select 1 from jsonb_array_elements(l) e where e->>'personne' = 'a3000000-0000-0000-0000-0000000000a3') from s63));


-- ---------------------------------------------------------------------------
-- 6. LE PLAFOND PAR JOUR (mis a 1 pour le banc)
-- ---------------------------------------------------------------------------
truncate public.notif_mail_journal; truncate public.push_journal;
update public.profils set bureau_courant = 'ba000000-0000-0000-0000-0000000000ba' where id = 'a3000000-0000-0000-0000-0000000000a3';
update public.profils set notif_mail_echeance = true;   -- Anne, Bruno, Camila : trois mails possibles
set role service_role;
create temp table p1 as select public.notif_horaire_lots('matin', :MATIN, 1) as l;
reset role;
select banc.ok('plafond 1 : un seul mail reserve, les autres comptes « plafonnes »',
  (select count(*) = 1 from public.notif_mail_journal)
  and (select count(*) filter (where e ? 'mail') = 1 and bool_or((e->>'plafonnes')::int >= 2) from p1, jsonb_array_elements(l) e));
select banc.ok('le plafond ne touche pas les notifications (Bruno et Camila les ont)',
  (select count(*) filter (where e ? 'message') = 2 from p1, jsonb_array_elements(l) e));
set role service_role;
select banc.ok('le plafond vaut pour la JOURNEE : le soir, deja atteint, ne reserve rien',
  (select not exists (select 1 from jsonb_array_elements(public.notif_horaire_lots('soir', :SOIR, 1)) e where e ? 'mail')));
reset role;
select banc.ok('la tache cron attend 120 s', (select command like '%timeout_milliseconds := 120000%' from cron.job where jobname = 'notif-horaire')
  or not exists (select 1 from pg_namespace where nspname = 'cron'));
select banc.ok('le plafond par defaut est 20 par jour',
  pg_get_function_arguments('public.notif_horaire_lots(text, timestamptz, int)'::regprocedure) like '%p_plafond integer DEFAULT 20%');
select banc.ok('une seule fonction notif_horaire_lots (aucun appel ambigu)', (select count(*) = 1 from pg_proc where proname = 'notif_horaire_lots'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 63 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
