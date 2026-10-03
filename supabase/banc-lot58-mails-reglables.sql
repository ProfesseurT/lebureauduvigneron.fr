-- ===========================================================================
-- BANC DU LOT 58 (les mails des nouvelles se reglent), 03/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 57 (qui rejoue 56 a 47), passe DEUX FOIS
-- supabase/lot58-mails-reglables.sql, puis verifie les decisions de Ted du 03/10/2026 :
-- jamais de mail pour une perdue, une case par personne et par sorte, l'auteur coupe aussi.
--   psql -h /tmp -p 55457 -d banc58 -v ON_ERROR_STOP=1 -f banc-lot58-mails-reglables.sql
-- Derniere ligne attendue : « BANC DU LOT 58 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot57-notifications.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- LE DECOR, COMME LE VRAI PROJET : schema.sql retire l'ecriture de toute la table a anon et
-- authenticated, puis la rend colonne par colonne. Sans ce retrait, le banc dirait vrai
-- pour n'importe quelle colonne et ne prouverait rien.
grant select on public.profils to anon, authenticated;
revoke update on public.profils from anon, authenticated;

\ir lot58-mails-reglables.sql
\ir lot58-mails-reglables.sql
truncate banc.resultats;

-- ---------------------------------------------------------------------------
-- 1. LES DEUX CASES
-- ---------------------------------------------------------------------------
select banc.ok('deux colonnes, non nulles, cochees par defaut',
  (select count(*) = 2 from information_schema.columns
    where table_schema = 'public' and table_name = 'profils'
      and column_name in ('notif_mail_signe', 'notif_mail_gagnee')
      and is_nullable = 'NO' and column_default = 'true'));
select banc.ok('les profils existants gardent le comportement du lot 57 (tout coche)',
  (select count(*) = 0 from public.profils where not notif_mail_signe or not notif_mail_gagnee));
select banc.ok('le navigateur connecte peut ecrire ces deux colonnes, l anonyme non',
  has_column_privilege('authenticated', 'public.profils', 'notif_mail_signe', 'update')
  and has_column_privilege('authenticated', 'public.profils', 'notif_mail_gagnee', 'update')
  and not has_column_privilege('anon', 'public.profils', 'notif_mail_signe', 'update'));
select banc.ok('notif_detail reste au seul role de service',
  not has_function_privilege('authenticated', 'public.notif_detail(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.notif_detail(uuid, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.notif_detail(uuid, uuid)', 'execute'));

-- ---------------------------------------------------------------------------
-- 2. UNE PERDUE : NI APPEL, NI MAIL
-- ---------------------------------------------------------------------------
update public.affaires set issue = 'en_cours', motif = null where affaire_id = 'ca000000-0000-0000-0000-000000000002';
truncate net.appels;
set role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-0000000000a2', false);
update public.affaires set issue = 'perdue', motif = 'prix' where affaire_id = 'ca000000-0000-0000-0000-000000000002';
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('perdue par un collegue : la fermeture passe, l auteur est note',
  (select issue = 'perdue' and close_par = 'a2000000-0000-0000-0000-0000000000a2'
     from public.affaires where affaire_id = 'ca000000-0000-0000-0000-000000000002'));
select banc.ok('perdue : AUCUN appel a la fonction d envoi', (select count(*) = 0 from net.appels));
set role service_role;
select banc.ok('perdue : notif_detail rend null (meme appelee a la main)',
  public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000002') is null);
reset role;

-- La gagnee, elle, appelle toujours.
update public.affaires set issue = 'en_cours' where affaire_id = 'ca000000-0000-0000-0000-000000000003';
truncate net.appels;
set role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-0000000000a1', false);
update public.affaires set issue = 'gagnee' where affaire_id = 'ca000000-0000-0000-0000-000000000003';
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('gagnee : toujours UN appel', (select count(*) = 1 from net.appels));

-- ---------------------------------------------------------------------------
-- 3. LA CASE « AFFAIRE GAGNEE », PAR PERSONNE
-- ---------------------------------------------------------------------------
set role service_role;
select banc.ok('tout coche : les trois membres recoivent la gagnee',
  jsonb_array_length(public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000001')->'destinataires') = 3);
reset role;
update public.profils set notif_mail_gagnee = false where id = 'a2000000-0000-0000-0000-0000000000a2';
set role service_role;
create temp table t58a as
  select public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000001') as g;
reset role;
select banc.ok('Bruno decoche : les deux autres recoivent, lui non',
  (select jsonb_array_length(g->'destinataires') = 2
          and (g->'destinataires') @> '[{"email":"anne@ba.fr"},{"email":"camila@ba.fr"}]'
          and not (g->'destinataires') @> '[{"email":"bruno@ba.fr"}]' from t58a));
update public.profils set notif_mail_gagnee = false where id = 'a3000000-0000-0000-0000-0000000000a3';
set role service_role;
select banc.ok('Camila, l auteure, decoche : elle perd aussi sa confirmation',
  (public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000001')->'destinataires')
    = '[{"email":"anne@ba.fr","prenom":"Anne"}]'::jsonb);
reset role;
update public.profils set notif_mail_gagnee = false where id = 'a1000000-0000-0000-0000-0000000000a1';
set role service_role;
create temp table t58b as
  select public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000001') as g;
reset role;
select banc.ok('tout le monde decoche : le detail reste, la liste est vide (la fonction note 0)',
  (select g is not null and g->>'sorte' = 'gagnee' and g->'destinataires' = '[]'::jsonb from t58b));

-- ---------------------------------------------------------------------------
-- 4. LA CASE « DEVIS SIGNE », INDEPENDANTE DE L'AUTRE
-- ---------------------------------------------------------------------------
update public.profils set notif_mail_gagnee = false;
set role service_role;
create temp table t58c as
  select public.notif_detail(s.bureau, s.affaire_id) as d, s.bureau from t57s s;
reset role;
select banc.ok('gagnee decochee partout : le mail du devis signe part toujours a tout le bureau',
  (select d->>'sorte' = 'signe'
          and jsonb_array_length(d->'destinataires') = (select count(*) from public.membres m join public.profils p on p.id = m.personne
            where m.bureau = t58c.bureau and p.email like '%@%')
          and jsonb_array_length(d->'destinataires') >= 1 from t58c));
update public.profils p set notif_mail_signe = false
  where p.id = (select m.personne from public.membres m join public.profils x on x.id = m.personne
                 where m.bureau = (select bureau from t57s) and x.email like '%@%' order by x.email limit 1);
set role service_role;
create temp table t58d as
  select public.notif_detail(s.bureau, s.affaire_id) as d, s.bureau from t57s s;
reset role;
select banc.ok('un membre decoche le devis signe : un destinataire de moins, et pas lui',
  (select jsonb_array_length(t58d.d->'destinataires') = jsonb_array_length(t58c.d->'destinataires') - 1
          and not exists (select 1 from jsonb_array_elements(t58d.d->'destinataires') e
                           join public.profils p on p.email = e->>'email' where not p.notif_mail_signe)
     from t58c, t58d));

-- ---------------------------------------------------------------------------
-- 5. RIEN D'AUTRE N'A BOUGE
-- ---------------------------------------------------------------------------
update public.profils set notif_mail_signe = true, notif_mail_gagnee = true;
set role service_role;
select banc.ok('tout recoche : la gagnee repart aux trois, comme au lot 57',
  jsonb_array_length(public.notif_detail('ba000000-0000-0000-0000-0000000000ba', 'ca000000-0000-0000-0000-000000000001')->'destinataires') = 3);
reset role;
select banc.ok('le declencheur ne s appelle toujours pas du navigateur',
  not has_function_privilege('authenticated', 'public.affaires_notifier()', 'execute'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 58 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
