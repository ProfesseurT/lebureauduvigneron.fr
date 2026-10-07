-- ===========================================================================
-- BANC DU LOT 77 (envoyer depuis sa boite), 07/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 76, puis passe DEUX FOIS supabase/lot77-envoi.sql.
--   psql -h /tmp -p 55475 -U postgres -d banc77 -v ON_ERROR_STOP=1 -f banc-lot77-envoi.sql
-- ===========================================================================
\ir banc-lot76-boites.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);
create or replace view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
\ir lot77-envoi.sql
\ir lot77-envoi.sql
truncate banc.resultats;
grant execute on all functions in schema banc to service_role;

insert into public.membres (bureau, personne, role) values ('b1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'maitre') on conflict do nothing;
-- Le banc 76 a efface les boites : on en rebranche une (7575) et une a confirmer (1111), dans b1.
set role service_role;
select public.boite_ranger('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001',
  'camila@closfertel.fr', 'ovh', 'ssl0.ovh.net', 'camila@closfertel.fr', 'mdp-camila', '444444');
select public.boite_ranger('11111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001',
  'autre@domaine.fr', 'gmail', 'smtp.gmail.com', 'autre@domaine.fr', 'mdp-autre', '555555');
reset role;
set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select public.boite_confirmer('b1000000-0000-0000-0000-000000000001', '444444');
reset role;

set role service_role;
select banc.ok('une boite branchee rend de quoi envoyer, mot de passe compris',
  (select secret = 'mdp-camila' and adresse = 'camila@closfertel.fr' and copie_a_soi
     from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
select banc.ok('une boite pas encore confirmee ne rend rien',
  (select count(*) = 0 from public.boite_pour_envoi('11111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001')));
select banc.ok('la boite d un bureau ne sert pas dans un autre',
  (select count(*) = 0 from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b2000000-0000-0000-0000-000000000002')));
reset role;
update public.boites set utiliser = false where personne = '75757575-7575-7575-7575-757575757575';
set role service_role;
select banc.ok('« ma messagerie ouvre le mail » choisi : la boite ne sert pas',
  (select count(*) = 0 from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
reset role;
update public.boites set utiliser = true where personne = '75757575-7575-7575-7575-757575757575';

set role service_role;
select banc.ok('un envoi est permis, et compte',
  public.boite_envoi_permis('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001'));
select banc.refus('pas d envoi pour un bureau dont on n est pas membre',
  $q$ select public.boite_envoi_permis('75757575-7575-7575-7575-757575757575', 'b2000000-0000-0000-0000-000000000002') $q$, '42501');
select public.boite_envoi_permis('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001') from generate_series(1, 199);
select banc.ok('au 201e envoi du jour, refus',
  not public.boite_envoi_permis('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001'));
select banc.ok('un refus du mot de passe passe la boite a reconnecter',
  public.boite_reconnecter('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001', 'refus 535'));
select banc.ok('a reconnecter : plus rien a envoyer',
  (select count(*) = 0 from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
reset role;
select banc.ok('l etat et le motif sont notes',
  (select etat = 'reconnecter' and erreur = 'refus 535' from public.boites where personne = '75757575-7575-7575-7575-757575757575'));

select banc.ok('ni anon ni un compte connecte n appellent les trois fonctions',
  not has_function_privilege('authenticated', 'public.boite_pour_envoi(uuid, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.boite_envoi_permis(uuid, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.boite_reconnecter(uuid, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.boite_pour_envoi(uuid, uuid)', 'execute'));
select banc.ok('le journal des envois n est lisible par personne du navigateur',
  not has_table_privilege('authenticated', 'public.boite_envois', 'select')
  and not has_table_privilege('anon', 'public.boite_envois', 'select'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 77 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select nom, detail from banc.resultats where not ok;
