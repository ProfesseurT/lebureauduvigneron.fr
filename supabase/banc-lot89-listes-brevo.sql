-- ===========================================================================
-- BANC DU LOT 89 (les listes vers Brevo), 09/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue tout le banc du lot 88, puis passe DEUX FOIS supabase/lot89-listes-brevo.sql.
--   psql -h /tmp -p 55487 -U postgres -d banc89 -v ON_ERROR_STOP=1 -f banc-lot89-listes-brevo.sql
-- ===========================================================================
\ir banc-lot88-envoi-brevo.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);
\ir lot89-listes-brevo.sql
\ir lot89-listes-brevo.sql
truncate banc.resultats;

-- Deux bureaux : 8901 (maitre 8901, simple 8902), 8903 seul dans le sien.
insert into auth.users (id, email) values
  ('89010000-0000-0000-0000-000000000001', 'maitre89@clos.fr'),
  ('89020000-0000-0000-0000-000000000002', 'simple89@clos.fr'),
  ('89030000-0000-0000-0000-000000000003', 'voisin89@clos.fr') on conflict do nothing;
insert into public.bureaux (bureau, nom) values
  ('b8900000-0000-0000-0000-000000000001', 'Clos 89'),
  ('b8900000-0000-0000-0000-000000000003', 'Voisin 89') on conflict do nothing;
insert into public.membres (bureau, personne, role) values
  ('b8900000-0000-0000-0000-000000000001', '89010000-0000-0000-0000-000000000001', 'maitre'),
  ('b8900000-0000-0000-0000-000000000001', '89020000-0000-0000-0000-000000000002', 'simple'),
  ('b8900000-0000-0000-0000-000000000003', '89030000-0000-0000-0000-000000000003', 'maitre') on conflict do nothing;

set role service_role;
select banc.ok('un simple membre peut creer une liste',
  public.brevo_liste_permise('89020000-0000-0000-0000-000000000002', 'b8900000-0000-0000-0000-000000000001'));
select banc.refus('hors du bureau : refus',
  $q$ select public.brevo_liste_permise('89030000-0000-0000-0000-000000000003', 'b8900000-0000-0000-0000-000000000001') $q$, '42501');
select banc.refus('noter hors du bureau : refus',
  $q$ select public.brevo_liste_noter('89030000-0000-0000-0000-000000000003', 'b8900000-0000-0000-0000-000000000001', 'x', 'clients', 1, 1, 1, 0) $q$, '42501');
select public.brevo_liste_noter('89020000-0000-0000-0000-000000000002', 'b8900000-0000-0000-0000-000000000001',
  E'  Salon\tde printemps  ', 'clients', 42, 9001, 120, 3) as id \gset
select banc.ok('noter rend un numero', :'id' <> '');
select banc.refus('une source inconnue est refusee',
  $q$ select public.brevo_liste_noter('89020000-0000-0000-0000-000000000002', 'b8900000-0000-0000-0000-000000000001', 'x', 'sms', 1, 1, 1, 0) $q$, '23514');
select public.brevo_liste_noter('89020000-0000-0000-0000-000000000002', 'b8900000-0000-0000-0000-000000000001', 'neg', 'commerce', 1, 1, -5, -2) as neg \gset
reset role;
-- (le banc n'a pas les droits par defaut de Supabase pour service_role : on relit en proprietaire)
select banc.ok('le nom est nettoye (bords, caracteres de controle)',
  (select nom = 'Salonde printemps' from public.brevo_listes where id = :'id'::bigint));
select banc.ok('un nombre negatif devient zero',
  (select envoyes = 0 and ecartes = 0 from public.brevo_listes where id = :'neg'::bigint));

-- Ce que voit chacun.
set role authenticated;
select banc.qui('89020000-0000-0000-0000-000000000002');
select banc.ok('le bureau voit ses listes', (select count(*) = 2 from public.brevo_listes));
select banc.refus('le navigateur n ecrit pas une liste',
  $q$ insert into public.brevo_listes (bureau, nom, source) values ('b8900000-0000-0000-0000-000000000001', 'x', 'clients') $q$, '42501');
select banc.refus('le navigateur ne modifie pas une liste',
  $q$ update public.brevo_listes set envoyes = 1 $q$, '42501');
select banc.refus('le navigateur n appelle pas noter',
  $q$ select public.brevo_liste_noter('89020000-0000-0000-0000-000000000002', 'b8900000-0000-0000-0000-000000000001', 'x', 'clients', 1, 1, 1, 0) $q$, '42501');
select banc.refus('le navigateur n appelle pas permise',
  $q$ select public.brevo_liste_permise('89020000-0000-0000-0000-000000000002', 'b8900000-0000-0000-0000-000000000001') $q$, '42501');
select banc.qui('89030000-0000-0000-0000-000000000003');
select banc.ok('un autre bureau ne voit rien', (select count(*) = 0 from public.brevo_listes));
reset role;

-- Le plafond : 20 listes en 24 heures, par bureau.
set role service_role;
select public.brevo_liste_noter('89010000-0000-0000-0000-000000000001', 'b8900000-0000-0000-0000-000000000001', 'l' || g, 'clients', g, g, 1, 0)
  from generate_series(1, 18) g;
select banc.ok('a 20 listes du jour, refus',
  not public.brevo_liste_permise('89010000-0000-0000-0000-000000000001', 'b8900000-0000-0000-0000-000000000001'));
select banc.ok('le plafond est par bureau : le voisin cree encore',
  public.brevo_liste_permise('89030000-0000-0000-0000-000000000003', 'b8900000-0000-0000-0000-000000000003'));
reset role;
update public.brevo_listes set le = now() - interval '2 days' where nom like 'l%' and bureau = 'b8900000-0000-0000-0000-000000000001';
set role service_role;
select banc.ok('le lendemain, on cree de nouveau',
  public.brevo_liste_permise('89010000-0000-0000-0000-000000000001', 'b8900000-0000-0000-0000-000000000001'));
reset role;
update public.brevo_listes set le = now() - interval '14 months' where nom = 'l1';
set role service_role;
select public.brevo_liste_permise('89010000-0000-0000-0000-000000000001', 'b8900000-0000-0000-0000-000000000001');
reset role;
select banc.ok('apres treize mois, la ligne s efface', not exists (select 1 from public.brevo_listes where nom = 'l1'));
select banc.ok('une ligne de moins de treize mois reste', exists (select 1 from public.brevo_listes where nom = 'l2'));

select banc.ok('ni adresse ni numero dans la table',
  not exists (select 1 from information_schema.columns where table_name = 'brevo_listes'
    and column_name in ('email', 'emails', 'sms', 'mobile', 'contacts', 'telephone')));
-- Quitter le bureau garde la ligne (historique du bureau) ; supprimer le compte efface le nom de l'auteur.
delete from auth.users where id = '89020000-0000-0000-0000-000000000002';
select banc.ok('un compte supprime : la liste reste, sans son auteur',
  (select personne is null from public.brevo_listes where nom = 'Salonde printemps'));
delete from public.bureaux where bureau = 'b8900000-0000-0000-0000-000000000001';
select banc.ok('le bureau supprime emporte ses listes',
  not exists (select 1 from public.brevo_listes where bureau = 'b8900000-0000-0000-0000-000000000001'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 89 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select nom, detail from banc.resultats where not ok;
