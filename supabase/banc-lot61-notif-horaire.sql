-- ===========================================================================
-- BANC DU LOT 61 (le matin, le soir, la nuit), 05/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue TOUT le banc du lot 60 (qui rejoue 59 a 47), passe DEUX FOIS
-- supabase/lot61-notif-horaire.sql, puis verifie ce que le lot promet.
--   psql -h /tmp -p 55457 -d banc61 -v ON_ERROR_STOP=1 -f banc-lot61-notif-horaire.sql
-- Derniere ligne attendue : « BANC DU LOT 61 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot60-push-devis-signe.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- LE DECOR : la table des taches du vrai projet a un identifiant d'occurrence.
alter table public.taches add column if not exists tache_id text;

\ir lot61-notif-horaire.sql
\ir lot61-notif-horaire.sql
truncate banc.resultats;

-- Le bureau BA : Anne, Bruno, Camila. Seuls Bruno (le Mac partage) et Camila (dix
-- appareils) en ont. Tous ont BA comme bureau courant.
update public.profils set bureau_courant = 'ba000000-0000-0000-0000-0000000000ba'
 where id in ('a1000000-0000-0000-0000-0000000000a1', 'a2000000-0000-0000-0000-0000000000a2', 'a3000000-0000-0000-0000-0000000000a3');
truncate public.push_journal;
-- Le 9 octobre 2026 a 7 h 30 a Paris (heure d'ete) = 5 h 30 UTC. Demain : DRM.
\set MATIN '''2026-10-09 05:30:00+00'''
\set SOIR  '''2026-10-09 15:30:00+00'''

-- ---------------------------------------------------------------------------
-- 1. LES CASES ET LES DROITS
-- ---------------------------------------------------------------------------
select banc.ok('quatre cases, cochees sauf les rappels du soir',
  (select string_agg(column_name || '=' || column_default, ',' order by column_name) from information_schema.columns
    where table_name = 'profils' and column_name like 'notif_push_%')
  = 'notif_push_devis_expire=true,notif_push_echeance=true,notif_push_rappels=false,notif_push_signe=true');
select banc.ok('le navigateur ecrit ses cases, rien d autre du lot',
  has_column_privilege('authenticated', 'public.profils', 'notif_push_rappels', 'update')
  and not has_table_privilege('authenticated', 'public.push_journal', 'select')
  and not has_function_privilege('authenticated', 'public.notif_horaire_lots(text, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.push_cibles(uuid, text)', 'execute')
  and has_function_privilege('service_role', 'public.notif_horaire_lots(text, timestamptz)', 'execute'));
select banc.ok('l ancienne push_cibles a un argument a disparu, la nouvelle le remplace avec la meme valeur par defaut',
  to_regprocedure('public.push_cibles(uuid)') is null and to_regprocedure('public.push_cibles(uuid,text)') is not null);

-- ---------------------------------------------------------------------------
-- 2. LES OBLIGATIONS
-- ---------------------------------------------------------------------------
select banc.ok('le 10 octobre : la DRM seule', (select array_agg(cle) = array['drm'] from public.notif_obligations_du('2026-10-10')));
select banc.ok('le 10 septembre : DRM et DAI', (select array_agg(cle order by cle) = array['dai','drm'] from public.notif_obligations_du('2026-09-10')));
select banc.ok('le 1er septembre 2026 : la reception des factures, une seule fois', (select array_agg(cle) = array['facture-reception'] from public.notif_obligations_du('2026-09-01'))
  and not exists (select 1 from public.notif_obligations_du('2027-09-01') where cle = 'facture-reception'));
select banc.ok('un jour sans obligation : rien', not exists (select 1 from public.notif_obligations_du('2026-10-11')));

-- ---------------------------------------------------------------------------
-- 3. LE MATIN
-- ---------------------------------------------------------------------------
set role service_role;
create temp table m1 as select public.notif_horaire_lots('matin', :MATIN) as l;
reset role;
select banc.ok('7 h 30 : Bruno et Camila, qui ont des appareils ; Anne, qui n en a pas, non',
  (select jsonb_array_length(l) = 2 from m1)
  and not exists (select 1 from m1, jsonb_array_elements(l) e where e->>'personne' = 'a1000000-0000-0000-0000-0000000000a1'));
select banc.ok('le message : « DRM à faire demain. », vers le bureau',
  (select bool_and(e->'message'->>'titre' = 'DRM à faire demain.' and e->'message'->>'url' = '/mon-bureau/'
                   and e->'message'->>'tag' = 'matin-2026-10-09') from m1, jsonb_array_elements(l) e));
select banc.ok('chacun ses appareils : dix pour Camila, un pour Bruno',
  (select jsonb_array_length(e->'cibles') from m1, jsonb_array_elements(l) e where e->>'personne' = 'a3000000-0000-0000-0000-0000000000a3') = 10
  and (select jsonb_array_length(e->'cibles') from m1, jsonb_array_elements(l) e where e->>'personne' = 'a2000000-0000-0000-0000-0000000000a2') = 1);
select banc.ok('le journal est pose AVANT l envoi', (select count(*) = 2 from public.push_journal where moment = 'matin'));
set role service_role;
select banc.ok('un second passage la meme heure ne rend rien', jsonb_array_length(public.notif_horaire_lots('matin', :MATIN)) = 0);
reset role;

-- Une case decochee, une echeance cochee.
truncate public.push_journal;
update public.profils set notif_push_echeance = false where id = 'a2000000-0000-0000-0000-0000000000a2';
insert into public.taches (bureau, tache_id, fait_le) values ('ba000000-0000-0000-0000-0000000000ba', 'ech:drm:2026-10-10', now());
set role service_role;
select banc.ok('DRM cochee par le bureau, case decochee chez Bruno : personne n est derange',
  jsonb_array_length(public.notif_horaire_lots('matin', :MATIN)) = 0);
reset role;
delete from public.taches where tache_id = 'ech:drm:2026-10-10';
update public.profils set notif_push_echeance = true where id = 'a2000000-0000-0000-0000-0000000000a2';

-- Le jour meme, pas cochee : encore une fois.
truncate public.push_journal;
set role service_role;
create temp table m2 as select public.notif_horaire_lots('matin', '2026-10-10 05:30:00+00') as l;
reset role;
select banc.ok('le jour meme, pas cochee : « DRM à faire aujourd hui. »',
  (select bool_and(e->'message'->>'titre' = 'DRM à faire aujourd''hui.') and jsonb_array_length(l) = 2 from m2, jsonb_array_elements(l) e group by l));

-- Un devis qui expire demain, et une signature de la nuit : tout tient dans UNE notification.
truncate public.push_journal;
set session_replication_role = replica;
update public.devis set bureau = 'ba000000-0000-0000-0000-0000000000ba', statut = 'envoye', date_devis = date '2026-10-10' - validite_jours, envoye_le = date '2026-10-10' - validite_jours, valable_jusqu = date '2026-10-10'
 where devis_id = (select devis_id from public.devis where statut = 'enregistre' order by devis_id limit 1);
set session_replication_role = origin;
insert into public.notif_envois (cle, bureau, affaire_id, sorte, demande_le, push_differe)
  values ('nuit-1', 'ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000001', 'signe', '2026-10-08 22:00:00+00', true),
         ('vieille', 'ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000001', 'signe', '2026-10-01 22:00:00+00', true);
set role service_role;
create temp table m3 as select public.notif_horaire_lots('matin', :MATIN) as l;
reset role;
select banc.ok('trois choses, UNE notification par personne, « 3 choses ce matin », sans nom ni montant',
  (select bool_and(e->'message'->>'titre' = '3 choses ce matin'
     and e->'message'->>'corps' = 'DRM à faire demain. Un devis expire demain sans réponse. Un devis a été signé cette nuit.')
     and jsonb_array_length(l) = 2 from m3, jsonb_array_elements(l) e group by l));
select banc.ok('une signature de plus de 14 h n est pas « de cette nuit »',
  (select corps not like '%2 devis%' from (select e->'message'->>'corps' as corps from m3, jsonb_array_elements(l) e limit 1) x));
select banc.ok('au matin, toutes les signatures differees sont soldees', not exists (select 1 from public.notif_envois where push_differe));

-- La case du devis signe decochee : la nuit n est pas annoncee a Bruno.
truncate public.push_journal;
update public.profils set notif_push_signe = false, notif_push_echeance = false, notif_push_devis_expire = false
 where id = 'a2000000-0000-0000-0000-0000000000a2';
update public.notif_envois set push_differe = true where cle = 'nuit-1';
set role service_role;
create temp table m4 as select public.notif_horaire_lots('matin', :MATIN) as l;
reset role;
select banc.ok('Bruno a tout decoche : il ne recoit rien, Camila si',
  (select jsonb_array_length(l) = 1 and l->0->>'personne' = 'a3000000-0000-0000-0000-0000000000a3' from m4));

-- Les gardes que le verificateur a cassees sans que le banc le voie.
truncate public.push_journal;
update public.profils set notif_push_signe = true, notif_push_echeance = true, notif_push_devis_expire = true
 where id = 'a2000000-0000-0000-0000-0000000000a2';
update public.notif_envois set push_differe = false;
insert into public.taches (bureau, tache_id, fait_le) values ('ba000000-0000-0000-0000-0000000000ba', 'ech:drm:2026-10-10', null);
set session_replication_role = replica;
update public.devis set statut = 'accepte', accepte_le = envoye_le where bureau = 'ba000000-0000-0000-0000-0000000000ba' and valable_jusqu = date '2026-10-10';
set session_replication_role = origin;
set role service_role;
create temp table m5 as select public.notif_horaire_lots('matin', :MATIN) as l;
reset role;
select banc.ok('une tache posee mais PAS cochee n arrete rien : la DRM est annoncee',
  (select bool_and(e->'message'->>'titre' = 'DRM à faire demain.') and jsonb_array_length(l) = 2 from m5, jsonb_array_elements(l) e group by l));
select banc.ok('un devis accepte qui aurait expire demain n est pas annonce',
  (select bool_and(e->'message'->>'corps' not like '%devis%' and e->'message'->>'titre' not like '%devis%') from m5, jsonb_array_elements(l) e));
delete from public.taches where tache_id = 'ech:drm:2026-10-10';
-- Une signature de nuit dans un AUTRE bureau dont Camila est membre.
truncate public.push_journal;
insert into public.membres values ('b1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-0000000000a3', 'simple') on conflict do nothing;
insert into public.notif_envois (cle, bureau, affaire_id, sorte, demande_le, push_differe)
  values ('nuit-autre', 'b1000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'signe', '2026-10-08 23:00:00+00', true);
set role service_role;
create temp table m6 as select public.notif_horaire_lots('matin', :MATIN) as l;
reset role;
select banc.ok('une signature de nuit dans un autre bureau de Camila lui est annoncee, pas a Bruno',
  (select e->'message'->>'corps' like '%signé cette nuit%' from m6, jsonb_array_elements(l) e where e->>'personne' = 'a3000000-0000-0000-0000-0000000000a3')
  and (select e->'message'->>'titre' = 'DRM à faire demain.' from m6, jsonb_array_elements(l) e where e->>'personne' = 'a2000000-0000-0000-0000-0000000000a2'));
-- Bruno quitte BA (bureau courant inchange) : plus rien pour lui.
truncate public.push_journal;
delete from public.membres where bureau = 'ba000000-0000-0000-0000-0000000000ba' and personne = 'a2000000-0000-0000-0000-0000000000a2';
set role service_role;
select banc.ok('qui n est plus membre de son bureau courant ne recoit plus rien',
  not exists (select 1 from jsonb_array_elements(public.notif_horaire_lots('matin', :MATIN)) e where e->>'personne' = 'a2000000-0000-0000-0000-0000000000a2'));
reset role;
insert into public.membres values ('ba000000-0000-0000-0000-0000000000ba', 'a2000000-0000-0000-0000-0000000000a2', 'simple');

-- ---------------------------------------------------------------------------
-- 4. LE SOIR
-- ---------------------------------------------------------------------------
insert into public.suivi_clients (bureau, client_id, rappel, statut)
  values ('ba000000-0000-0000-0000-0000000000ba', 'C042', date '2026-10-09', 'a_faire');
set role service_role;
select banc.ok('17 h 30 : la case des rappels est decochee par defaut, personne', jsonb_array_length(public.notif_horaire_lots('soir', :SOIR)) = 0);
reset role;
update public.profils set notif_push_rappels = true where id = 'a3000000-0000-0000-0000-0000000000a3';
set role service_role;
create temp table s1 as select public.notif_horaire_lots('soir', :SOIR) as l;
reset role;
select banc.ok('Camila l a cochee : « Un rappel promis pour aujourd hui n est pas fait. »',
  (select jsonb_array_length(l) = 1 and l->0->'message'->>'titre' = 'Un rappel promis pour aujourd''hui n''est pas fait.' from s1));
truncate public.push_journal;
update public.suivi_clients set statut = 'traite' where rappel = date '2026-10-09';
update public.affaires set issue = 'gagnee' where affaire_id = 'ca000000-0000-0000-0000-000000000001';
-- Une gagnee qui garde un rappel du jour (les declencheurs le videraient : on passe outre).
set session_replication_role = replica;
update public.affaires set rappel = date '2026-10-09' where affaire_id = 'ca000000-0000-0000-0000-000000000001';
set session_replication_role = origin;
set role service_role;
select banc.ok('le rappel traite, et l affaire au rappel du jour deja gagnee : plus rien', jsonb_array_length(public.notif_horaire_lots('soir', :SOIR)) = 0);
reset role;
reset role;
update public.affaires set issue = 'en_cours', motif = null where affaire_id = 'ca000000-0000-0000-0000-000000000001';
update public.affaires set rappel = date '2026-10-09' where affaire_id = 'ca000000-0000-0000-0000-000000000001';
truncate public.push_journal;
set role service_role;
select banc.ok('la meme affaire, encore en cours : un rappel annonce',
  (select l->0->'message'->>'titre' = 'Un rappel promis pour aujourd''hui n''est pas fait.' from (select public.notif_horaire_lots('soir', :SOIR) as l) x));
reset role;
do $$ begin
  begin
    perform public.notif_horaire_lots('midi');
    perform banc.ok('un moment inconnu est refuse', false);
  exception when invalid_parameter_value then
    perform banc.ok('un moment inconnu est refuse', true);
  end;
end $$;

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 61 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
