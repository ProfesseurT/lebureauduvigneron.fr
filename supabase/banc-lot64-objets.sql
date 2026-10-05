-- ===========================================================================
-- BANC DU LOT 64 (des objets et des notifications qui nomment), 05/10/2026.
-- NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue TOUT le banc du lot 63 (qui rejoue 62 a 47), passe DEUX FOIS
-- supabase/lot64-objets.sql, puis verifie ce que le lot promet.
--   psql -h /tmp -p 55457 -d banc64 -v ON_ERROR_STOP=1 -f banc-lot64-objets.sql
-- Derniere ligne attendue : « BANC DU LOT 64 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot63-alertes.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);

\ir lot64-objets.sql
\ir lot64-objets.sql
truncate banc.resultats;
truncate public.push_journal; truncate public.notif_mail_journal;
\set MATIN '''2026-10-09 05:30:00+00'''
\set SOIR  '''2026-10-09 15:30:00+00'''
update public.profils set bureau_courant = 'ba000000-0000-0000-0000-0000000000ba',
  notif_mail_echeance = false, notif_mail_devis_expire = false, notif_mail_rappels = false,
  notif_push_echeance = true, notif_push_devis_expire = true, notif_push_rappels = false
 where id in ('a1000000-0000-0000-0000-0000000000a1', 'a2000000-0000-0000-0000-0000000000a2', 'a3000000-0000-0000-0000-0000000000a3');

-- ---------------------------------------------------------------------------
-- 1. LA CASE, LES NOMS
-- ---------------------------------------------------------------------------
select banc.ok('la case « client et montant » existe, decochee par defaut, modifiable par chacun',
  (select column_default = 'false' from information_schema.columns where table_name = 'profils' and column_name = 'notif_push_detail')
  and has_column_privilege('authenticated', 'public.profils', 'notif_push_detail', 'update'));
select banc.ok('deux noms au plus, puis « +n »',
  public.notif_noms('{}') = '' and public.notif_noms(null) = '' and public.notif_noms(array['A']) = 'A'
  and public.notif_noms(array['A', 'B']) = 'A, B' and public.notif_noms(array['A', 'B', 'C']) = 'A, B +1' and public.notif_noms(array['A', 'B', 'C', 'D']) = 'A, B +2');

-- ---------------------------------------------------------------------------
-- 2. CHAQUE APPAREIL PORTE LE CHOIX DE SON PROPRIETAIRE
-- ---------------------------------------------------------------------------
update public.profils set notif_push_detail = true where id = 'a2000000-0000-0000-0000-0000000000a2';
set role service_role;
select banc.ok('push_cibles : detail vrai pour Bruno (1 appareil), faux pour Camila (10)',
  (select count(*) filter (where (e->>'detail')::boolean) = 1 and count(*) filter (where not (e->>'detail')::boolean) = 10
     from jsonb_array_elements(public.push_cibles('ba000000-0000-0000-0000-0000000000ba', 'signe', null)) e));
reset role;

-- ---------------------------------------------------------------------------
-- 3. LE MATIN : LA NOTIFICATION NOMME POUR BRUNO, PAS POUR CAMILA ; L'OBJET DU MAIL NOMME
-- ---------------------------------------------------------------------------
update public.profils set notif_mail_echeance = true, notif_mail_devis_expire = true where id = 'a1000000-0000-0000-0000-0000000000a1';
set role service_role;
create temp table m64 as select public.notif_horaire_lots('matin', :MATIN) as l;
reset role;
create temp table c64 as select (select coalesce(nullif(btrim(d.acheteur->>'nom'), ''), d.numero) from public.devis d
  where d.bureau = 'ba000000-0000-0000-0000-0000000000ba' and d.statut = 'envoye' and d.valable_jusqu = date '2026-10-10') as client;
select banc.ok('Bruno (case cochee) : « Devis <client> expire demain » dans sa notification',
  (select e->'message'->>'corps' = 'DRM à faire demain. Devis ' || (select client from c64) || ' expire demain.'
     from m64, jsonb_array_elements(l) e where e->>'personne' = 'a2000000-0000-0000-0000-0000000000a2'));
select banc.ok('Camila (case decochee) : la notification d avant, sans aucun nom',
  (select e->'message'->>'corps' = 'DRM à faire demain. Un devis expire demain sans réponse.'
     from m64, jsonb_array_elements(l) e where e->>'personne' = 'a3000000-0000-0000-0000-0000000000a3'));
select banc.ok('l objet du mail d Anne commence par le fait et nomme le client',
  (select e->'mail'->>'sujet' = 'DRM à faire demain · devis ' || (select client from c64) || ' expire demain'
     from m64, jsonb_array_elements(l) e where e->>'personne' = 'a1000000-0000-0000-0000-0000000000a1'));

-- ---------------------------------------------------------------------------
-- 4. LE SOIR : « À rappeler aujourd'hui : X, Y +n »
-- ---------------------------------------------------------------------------
update public.profils set notif_mail_rappels = true where id = 'a1000000-0000-0000-0000-0000000000a1';
update public.profils set notif_push_rappels = true where id in ('a2000000-0000-0000-0000-0000000000a2', 'a3000000-0000-0000-0000-0000000000a3');
-- La piste de l autre bureau passe en tete de l alphabet : si son nom fuyait, il serait
-- dans les deux noms affiches, pas cache dans le « +n ».
update public.pistes set nom = 'A FUITE' where bureau = 'b6000000-0000-0000-0000-000000000006' and client_id = 'C079';
set role service_role;
create temp table s64 as select public.notif_horaire_lots('soir', :SOIR) as l;
reset role;
select banc.ok('l objet du soir : « À rappeler aujourd hui : » puis deux noms et « +2 » (quatre rappels)',
  (select e->'mail'->>'sujet' ~ '^À rappeler aujourd''hui : [^,]+, [^,]+ \+2$'
     from s64, jsonb_array_elements(l) e where e->>'personne' = 'a1000000-0000-0000-0000-0000000000a1'));
select banc.ok('Bruno (case cochee) : la notification du soir nomme aussi, Camila non',
  (select e->'message'->>'titre' ~ '^À rappeler aujourd''hui : [^,]+, [^,]+ \+2\.$'
     from s64, jsonb_array_elements(l) e where e->>'personne' = 'a2000000-0000-0000-0000-0000000000a2')
  and (select e->'message'->>'titre' = '4 rappels promis pour aujourd''hui ne sont pas faits.'
     from s64, jsonb_array_elements(l) e where e->>'personne' = 'a3000000-0000-0000-0000-0000000000a3'));
select banc.ok('rien du Domaine Six dans le soir non plus', (select l::text not like '%FUITE%' from s64));

-- ---------------------------------------------------------------------------
-- 5. PLUSIEURS DEVIS QUI EXPIRENT : les noms seulement pour qui a coche
-- ---------------------------------------------------------------------------
truncate public.push_journal; truncate public.notif_mail_journal;
update public.profils set notif_mail_echeance = false, notif_mail_devis_expire = false, notif_mail_rappels = false;
set session_replication_role = replica;
insert into public.devis select (jsonb_populate_record(d, jsonb_build_object(
    'devis_id', gen_random_uuid(), 'rang', 9998, 'numero', 'D-' || d.annee || '-9998',
    'acheteur', jsonb_build_object('nom', 'Cave Seconde')))).*
  from public.devis d where d.bureau = 'ba000000-0000-0000-0000-0000000000ba' and d.statut = 'envoye' and d.valable_jusqu = date '2026-10-10' limit 1;
set session_replication_role = origin;
set role service_role;
create temp table m64b as select public.notif_horaire_lots('matin', :MATIN) as l;
reset role;
select banc.ok('deux devis expirent : Bruno (case cochee) les voit nommes, « 2 devis expirent demain (A, B) »',
  (select e->'message'->>'corps' like '%2 devis expirent demain (%Cave Seconde%)%'
     from m64b, jsonb_array_elements(l) e where e->>'personne' = 'a2000000-0000-0000-0000-0000000000a2'));
select banc.ok('Camila (case decochee) : aucun nom, « 2 devis expirent demain sans réponse »',
  (select e->'message'->>'corps' like '%2 devis expirent demain sans réponse%' and (e->'message')::text not like '%Cave Seconde%'
     from m64b, jsonb_array_elements(l) e where e->>'personne' = 'a3000000-0000-0000-0000-0000000000a3'));

-- ---------------------------------------------------------------------------
-- 6. LES PROMESSES DES LOTS 62 ET 63, REJOUEES SUR LES VERSIONS DU LOT 64
-- ---------------------------------------------------------------------------
set role service_role;
select banc.ok('62 rejoue : l auteur du geste n est jamais notifie (p_sauf), Bruno prevenu quand Camila gagne',
  jsonb_array_length(public.push_cibles('ba000000-0000-0000-0000-0000000000ba', 'gagnee', 'a3000000-0000-0000-0000-0000000000a3')) = 1
  and jsonb_array_length(public.push_cibles('ba000000-0000-0000-0000-0000000000ba', 'gagnee', 'a2000000-0000-0000-0000-0000000000a2')) = 10);
reset role;
truncate public.push_journal; truncate public.notif_mail_journal;
update public.profils set notif_mail_echeance = true;
set role service_role;
create temp table p64 as select public.notif_horaire_lots('matin', :MATIN, 1) as l;
reset role;
select banc.ok('63 rejoue : plafond 1, un seul mail reserve, les autres comptes',
  (select count(*) = 1 from public.notif_mail_journal)
  and (select bool_or((e->>'plafonnes')::int >= 2) from p64, jsonb_array_elements(l) e));
update public.profils set notif_mail_rappels = true;   -- le soir AURAIT des mails a reserver
set role service_role;
select banc.ok('63 rejoue : le plafond vaut pour la journee (le soir ne reserve plus rien)',
  not exists (select 1 from jsonb_array_elements(public.notif_horaire_lots('soir', :SOIR, 1)) e where e ? 'mail'));
reset role;
truncate public.push_journal; truncate public.notif_mail_journal;
update public.profils set notif_mail_echeance = false, notif_mail_rappels = false;
update public.profils set notif_mail_rappels = true where id in ('a1000000-0000-0000-0000-0000000000a1', 'a3000000-0000-0000-0000-0000000000a3');
update public.profils set bureau_courant = 'b6000000-0000-0000-0000-000000000006' where id = 'a3000000-0000-0000-0000-0000000000a3';
set role service_role;
create temp table s64b as select public.notif_horaire_lots('soir', :SOIR) as l;
reset role;
select banc.ok('63 rejoue : un client sans piste dans CE bureau reste « Client C079 », rien du Domaine Six',
  (select exists (select 1 from jsonb_array_elements(e->'mail'->'rappels') r where r->>'quoi' = 'Client C079') and l::text not like '%FUITE%'
     from s64b, jsonb_array_elements(l) e where e->>'personne' = 'a1000000-0000-0000-0000-0000000000a1'));

select banc.ok('63 rejoue : Camila, bureau courant Domaine Six sans en etre membre, n est pas servie',
  not exists (select 1 from s64b, jsonb_array_elements(l) e where e->>'personne' = 'a3000000-0000-0000-0000-0000000000a3'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 64 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
