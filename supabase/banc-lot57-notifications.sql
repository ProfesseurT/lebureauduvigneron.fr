-- ===========================================================================
-- BANC DU LOT 57 (les nouvelles de « Mon commerce »), 03/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 56 (qui rejoue 55 a 47 et le decor de Supabase), pose
-- une fausse extension pg_net qui NOTE les appels au lieu de les faire, passe DEUX FOIS
-- supabase/lot57-notifications.sql, puis verifie ce que le lot promet.
--   psql -h /tmp -p 55457 -d banc57 -v ON_ERROR_STOP=1 -f banc-lot57-notifications.sql
-- Derniere ligne attendue : « BANC DU LOT 57 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot56-affaires-durcies.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- 0. LE DECOR : pg_net en faux, le prenom des profils, un bureau BA a trois membres
-- ---------------------------------------------------------------------------
create schema if not exists net;
create table if not exists net.appels (n serial primary key, url text, headers jsonb, body jsonb);
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
returns bigint language sql as
$$ insert into net.appels (url, headers, body) values (url, headers, body) returning n::bigint $$;
alter table public.profils add column if not exists prenom text;

\ir lot57-notifications.sql
\ir lot57-notifications.sql
truncate banc.resultats;

insert into auth.users values
  ('a1000000-0000-0000-0000-0000000000a1', 'anne@ba.fr'),
  ('a2000000-0000-0000-0000-0000000000a2', 'bruno@ba.fr'),
  ('a3000000-0000-0000-0000-0000000000a3', 'camila@ba.fr')
  on conflict do nothing;
insert into public.profils (id, email, prenom) values
  ('a1000000-0000-0000-0000-0000000000a1', 'anne@ba.fr', 'Anne'),
  ('a2000000-0000-0000-0000-0000000000a2', 'bruno@ba.fr', null),
  ('a3000000-0000-0000-0000-0000000000a3', 'camila@ba.fr', 'Camila')
  on conflict (id) do update set prenom = excluded.prenom;
insert into public.bureaux (bureau, nom) values ('ba000000-0000-0000-0000-0000000000ba', 'Domaine BA');
insert into public.membres values
  ('ba000000-0000-0000-0000-0000000000ba', 'a1000000-0000-0000-0000-0000000000a1', 'maitre'),
  ('ba000000-0000-0000-0000-0000000000ba', 'a2000000-0000-0000-0000-0000000000a2', 'simple'),
  ('ba000000-0000-0000-0000-0000000000ba', 'a3000000-0000-0000-0000-0000000000a3', 'simple');
insert into public.affaire_types (bureau, type_id, nom) values
  ('ba000000-0000-0000-0000-0000000000ba', 'aa000000-0000-0000-0000-000000000001', 'Caviste');
insert into public.affaire_etapes (bureau, etape_id, type_id, nom, ordre) values
  ('ba000000-0000-0000-0000-0000000000ba', 'ea000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'Contact', 1);
insert into public.pistes (bureau, piste_id, nom) values
  ('ba000000-0000-0000-0000-0000000000ba', '9a000000-0000-0000-0000-000000000001', 'Cave du Port');
insert into public.affaires (bureau, affaire_id, type_id, etape_id, piste_id, titre) values
  ('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'ea000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000001', 'Premiere commande'),
  ('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000001', 'ea000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000001', 'Salon');
insert into public.affaires (bureau, affaire_id, type_id, etape_id, client_id, client_nom, titre) values
  ('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000001', 'ea000000-0000-0000-0000-000000000001', 'C042', 'Bistrot Lune', 'Client');

-- ---------------------------------------------------------------------------
-- 1. LES DROITS
-- ---------------------------------------------------------------------------
select banc.ok('anon et authenticated : aucun droit sur notif_envois ni notif_reglage',
  not has_table_privilege('anon', 'public.notif_envois', 'select')
  and not has_table_privilege('authenticated', 'public.notif_envois', 'select')
  and not has_table_privilege('authenticated', 'public.notif_envois', 'insert')
  and not has_table_privilege('anon', 'public.notif_reglage', 'select')
  and not has_table_privilege('authenticated', 'public.notif_reglage', 'select')
  and not has_table_privilege('authenticated', 'public.notif_reglage', 'update'));
select banc.ok('notif_detail : service_role seul',
  not has_function_privilege('anon', 'public.notif_detail(uuid, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.notif_detail(uuid, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.notif_detail(uuid, uuid)', 'execute'));
select banc.ok('service_role : select, insert, update sur notif_envois, rien sur notif_reglage',
  has_table_privilege('service_role', 'public.notif_envois', 'insert')
  and has_table_privilege('service_role', 'public.notif_envois', 'update')
  and not has_table_privilege('service_role', 'public.notif_reglage', 'select'));
select banc.ok('les deux fonctions de declencheur ne s appellent pas du navigateur',
  not has_function_privilege('authenticated', 'public.affaires_close_par()', 'execute')
  and not has_function_privilege('authenticated', 'public.affaires_notifier()', 'execute')
  and not has_function_privilege('anon', 'public.affaires_notifier()', 'execute'));
select banc.ok('le secret refuse une cle courte',
  (select count(*) = 0 from public.notif_reglage));
do $$ begin
  begin
    insert into public.notif_reglage (url, cle) values ('http://x', 'court');
    perform banc.ok('notif_reglage refuse une cle de moins de 32 signes', false);
  exception when check_violation then
    perform banc.ok('notif_reglage refuse une cle de moins de 32 signes', true);
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 2. SANS REGLAGE : RIEN NE PART, RIEN NE CASSE
-- ---------------------------------------------------------------------------
truncate net.appels;
set role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-0000000000a2', false);
update public.affaires set issue = 'perdue', motif = 'prix' where affaire_id = 'ca000000-0000-0000-0000-000000000002';
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('sans reglage : la fermeture passe et aucun appel ne part',
  (select issue = 'perdue' from public.affaires where affaire_id = 'ca000000-0000-0000-0000-000000000002')
  and (select count(*) = 0 from net.appels));
select banc.ok('close_par pose par la base : celui qui a clos (Bruno)',
  (select close_par = 'a2000000-0000-0000-0000-0000000000a2' from public.affaires where affaire_id = 'ca000000-0000-0000-0000-000000000002'));

-- Un pg_net en panne ne bloque pas la fermeture.
insert into public.notif_reglage (id, url, cle) values (true, 'https://exemple.test/functions/v1/notif-commerce', repeat('k', 40));
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
returns bigint language plpgsql as $$ begin raise exception 'pg_net en panne'; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-0000000000a1', false);
update public.affaires set issue = 'gagnee' where affaire_id = 'ca000000-0000-0000-0000-000000000003';
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('pg_net en panne : la fermeture passe quand meme',
  (select issue = 'gagnee' and close_par = 'a1000000-0000-0000-0000-0000000000a1'
     from public.affaires where affaire_id = 'ca000000-0000-0000-0000-000000000003'));
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
returns bigint language sql as
$$ insert into net.appels (url, headers, body) values (url, headers, body) returning n::bigint $$;

-- ---------------------------------------------------------------------------
-- 3. AVEC REGLAGE : UN APPEL PAR FERMETURE, ET SEULEMENT A LA FERMETURE
-- ---------------------------------------------------------------------------
truncate net.appels;
set role authenticated;
select set_config('request.jwt.claim.sub', 'a3000000-0000-0000-0000-0000000000a3', false);
update public.affaires set notes = 'rien' where affaire_id = 'ca000000-0000-0000-0000-000000000001';
reset role;
select banc.ok('une modification sans fermeture n appelle personne', (select count(*) = 0 from net.appels));
set role authenticated;
update public.affaires set issue = 'gagnee' where affaire_id = 'ca000000-0000-0000-0000-000000000001';
update public.affaires set notes = 'apres' where affaire_id = 'ca000000-0000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('une fermeture : UN appel, a l adresse du reglage, avec la cle',
  (select count(*) = 1 from net.appels)
  and (select url = 'https://exemple.test/functions/v1/notif-commerce' and headers->>'x-notif-cle' = repeat('k', 40)
          and body->>'affaire_id' = 'ca000000-0000-0000-0000-000000000001'
          and body->>'bureau' = 'ba000000-0000-0000-0000-0000000000ba' from net.appels));
set role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-0000000000a1', false);
update public.affaires set issue = 'gagnee' where affaire_id = 'ca000000-0000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('reecrire issue sur une affaire deja close : pas de second appel, auteur garde',
  (select count(*) = 1 from net.appels)
  and (select close_par = 'a3000000-0000-0000-0000-0000000000a3' from public.affaires where affaire_id = 'ca000000-0000-0000-0000-000000000001'));
select banc.ok('close_par : Camila, et une modification ulterieure ne le change pas',
  (select close_par = 'a3000000-0000-0000-0000-0000000000a3' from public.affaires where affaire_id = 'ca000000-0000-0000-0000-000000000001'));
set role authenticated;
select set_config('request.jwt.claim.sub', 'a3000000-0000-0000-0000-0000000000a3', false);
update public.affaires set close_par = 'a1000000-0000-0000-0000-0000000000a1', notes = 'tente'
 where affaire_id = 'ca000000-0000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('une ecriture de close_par par le navigateur est ignoree',
  (select close_par = 'a3000000-0000-0000-0000-0000000000a3' from public.affaires where affaire_id = 'ca000000-0000-0000-0000-000000000001'));

-- ---------------------------------------------------------------------------
-- 4. CE QUE DIT LE MAIL
-- ---------------------------------------------------------------------------
set role service_role;
create temp table t57 as
  select public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000001') as g,
         public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000002') as p,
         public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000003') as c;
reset role;
select banc.ok('gagnee par un collegue : sorte gagnee, client = nom de la piste, par = Camila',
  (select g->>'sorte' = 'gagnee' and g->>'client' = 'Cave du Port' and g->>'par' = 'Camila'
          and g->>'type' = 'Caviste' and g->>'bureau_nom' = 'Domaine BA' from t57));
select banc.ok('destinataires : TOUT le bureau, celui qui a clos compris (sa confirmation)',
  (select jsonb_array_length(g->'destinataires') = 3
          and (g->'destinataires') @> '[{"email":"camila@ba.fr"},{"email":"anne@ba.fr"},{"email":"bruno@ba.fr"}]' from t57));
select banc.ok('perdue : sorte perdue, motif rendu, par = la partie avant @ si pas de prenom',
  (select p->>'sorte' = 'perdue' and p->>'motif' = 'prix' and p->>'par' = 'bruno' from t57));
select banc.ok('affaire client : le nom vient de client_nom',
  (select c->>'client' = 'Bistrot Lune' and c->>'sorte' = 'gagnee' from t57));
select banc.ok('la cle est l affaire et l instant de sa fermeture',
  (select g->>'cle' like 'ca000000-0000-0000-0000-000000000001:%' and length(g->>'cle') > 50 from t57));

-- Une affaire rouverte n'annonce plus rien.
update public.affaires set issue = 'en_cours', motif = null where affaire_id = 'ca000000-0000-0000-0000-000000000002';
select banc.ok('rouverte : close_par efface', (select close_par is null from public.affaires where affaire_id = 'ca000000-0000-0000-0000-000000000002'));
set role service_role;
select banc.ok('rouverte : notif_detail rend null',
  public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000002') is null);
reset role;
-- Une affaire fermee SANS auteur et SANS signature (la base, une reprise) ne s'annonce pas.
update public.affaires set issue = 'gagnee' where affaire_id = 'ca000000-0000-0000-0000-000000000002';
set role service_role;
select banc.ok('fermee sans auteur ni signature : rien a annoncer',
  public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000002') is null);
reset role;

-- LA SIGNATURE EN LIGNE : le devis signe du banc 55 (bureau B5). On rouvre son affaire et on
-- la referme SANS auteur, comme le fait signature_poser par la cle de service.
create temp table t57s as
  select d.bureau, d.affaire_id, d.numero from public.devis d
   where d.statut = 'accepte' and d.signe_le is not null limit 1;
grant select on t57s to service_role;
update public.affaires a set issue = 'en_cours' from t57s s where a.bureau = s.bureau and a.affaire_id = s.affaire_id;
update public.affaires a set issue = 'gagnee' from t57s s where a.bureau = s.bureau and a.affaire_id = s.affaire_id;
set role service_role;
create temp table t57d as
  select public.notif_detail(s.bureau, s.affaire_id) as d, s.numero from t57s s;
reset role;
select banc.ok('le decor a un devis signe', (select count(*) = 1 from t57s));
select banc.ok('signee en ligne : sorte signe, devis, lignes et signataire',
  (select d->>'sorte' = 'signe' and d->'devis'->>'numero' = numero
          and jsonb_array_length(d->'devis'->'lignes') >= 1
          and d->'devis'->'signataire'->>'nom' is not null and d->>'par' is null from t57d));
select banc.ok('signee en ligne : TOUT le bureau recoit',
  (select jsonb_array_length(d->'destinataires') = (select count(*) from public.membres m join public.profils p on p.id = m.personne
            where m.bureau = (select bureau from t57s) and p.email like '%@%') from t57d));

-- ---------------------------------------------------------------------------
-- 5. LE JOURNAL : UNE CLE, UN ENVOI
-- ---------------------------------------------------------------------------
set role service_role;
insert into public.notif_envois (cle, bureau, affaire_id, sorte)
  select g->>'cle', 'ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000001', 'gagnee' from t57;
insert into public.notif_envois (cle, bureau, affaire_id, sorte)
  select g->>'cle', 'ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000001', 'gagnee' from t57
  on conflict do nothing;
reset role;
select banc.ok('la meme cle ne se pose qu une fois', (select count(*) = 1 from public.notif_envois));
do $$ begin
  begin
    insert into public.notif_envois (cle, bureau, affaire_id, sorte)
      values ('x', 'ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000001', 'autre');
    perform banc.ok('notif_envois refuse une sorte inconnue', false);
  exception when check_violation then
    perform banc.ok('notif_envois refuse une sorte inconnue', true);
  end;
end $$;
select banc.ok('supprimer le bureau emporte son journal',
  (select confdeltype = 'c' from pg_constraint where conrelid = 'public.notif_envois'::regclass and contype = 'f'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 57 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
