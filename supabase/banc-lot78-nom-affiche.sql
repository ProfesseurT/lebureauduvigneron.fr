-- ===========================================================================
-- BANC DU LOT 78 (le nom affiche), 08/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue tout le banc du lot 77 (donc 76), puis passe DEUX FOIS lot78-nom-affiche.sql.
--   psql -h /tmp -p 55475 -U postgres -d banc78 -v ON_ERROR_STOP=1 -f banc-lot78-nom-affiche.sql
-- ===========================================================================
\ir banc-lot77-envoi.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);
\ir lot78-nom-affiche.sql
\ir lot78-nom-affiche.sql
truncate banc.resultats;
grant execute on all functions in schema banc to service_role;

-- La boite de 7575 a ete passee a « reconnecter » par le banc 77 : on la rebranche.
update public.boites set etat = 'branchee', erreur = null where personne = '75757575-7575-7575-7575-757575757575';
create table if not exists public.signatures (bureau uuid, personne uuid, nom text, primary key (bureau, personne));
delete from public.signatures where personne = '75757575-7575-7575-7575-757575757575';

set role service_role;
select banc.ok('sans nom choisi ni signature : pas de nom, l adresse seule',
  (select nom is null from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
reset role;
insert into public.signatures (bureau, personne, nom) values ('b1000000-0000-0000-0000-000000000001', '75757575-7575-7575-7575-757575757575', 'Camila Fertel');
set role service_role;
select banc.ok('sans nom choisi : le nom de la signature',
  (select nom = 'Camila Fertel' from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
reset role;

set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select banc.ok('le vigneron nomme sa boite (espaces resserres)',
  public.boite_nommer('b1000000-0000-0000-0000-000000000001', '  Camila,   Clos Fertel '));
reset role;
select banc.ok('le nom est range propre',
  (select nom_affiche = 'Camila, Clos Fertel' from public.boites where personne = '75757575-7575-7575-7575-757575757575'));
set role service_role;
select banc.ok('le nom choisi passe devant la signature',
  (select nom = 'Camila, Clos Fertel' from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
reset role;

set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select banc.refus('un nom qui ressemble a une adresse est refuse',
  $q$ select public.boite_nommer('b1000000-0000-0000-0000-000000000001', 'service@banque.fr') $q$, '23514');
select banc.refus('un chevron est refuse',
  $q$ select public.boite_nommer('b1000000-0000-0000-0000-000000000001', 'Camila <x>') $q$, '23514');
select banc.refus('plus de 80 signes est refuse',
  $q$ select public.boite_nommer('b1000000-0000-0000-0000-000000000001', repeat('a', 81)) $q$, '23514');
select banc.ok('vide : le nom est efface',
  public.boite_nommer('b1000000-0000-0000-0000-000000000001', '   '));
reset role;
select banc.ok('vide veut dire null',
  (select nom_affiche is null from public.boites where personne = '75757575-7575-7575-7575-757575757575'));

set role authenticated;
select banc.qui('11111111-1111-1111-1111-111111111111');
select public.boite_nommer('b1000000-0000-0000-0000-000000000001', 'Pirate');
reset role;
select banc.ok('la boite du collegue 7575 n a pas pris le nom',
  (select nom_affiche is null from public.boites where personne = '75757575-7575-7575-7575-757575757575'));

select banc.ok('droits : le compte connecte nomme, il ne lit pas le mot de passe',
  has_function_privilege('authenticated', 'public.boite_nommer(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.boite_pour_envoi(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.boite_nommer(uuid, text)', 'execute'));
select banc.ok('le compte connecte lit son nom affiche',
  has_column_privilege('authenticated', 'public.boites', 'nom_affiche', 'select'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 78 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select nom, detail from banc.resultats where not ok;
