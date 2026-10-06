-- ===========================================================================
-- BANC DU LOT 72 (le journal des affaires), 06/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 71, puis passe DEUX FOIS supabase/lot72-journal-affaires.sql.
--   psql -h /tmp -p 55472 -d banc72 -v ON_ERROR_STOP=1 -f banc-lot72-journal-affaires.sql
-- Derniere ligne attendue : « BANC DU LOT 72 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot71-lien-recopiable.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);
\ir lot72-journal-affaires.sql
\ir lot72-journal-affaires.sql
truncate banc.resultats;

insert into public.pistes (bureau, piste_id, nom, email) values
  ('b5000000-0000-0000-0000-000000000005', '97200000-0000-0000-0000-000000000001', 'Cave Piste', 'cave@exemple.fr'),
  ('b5000000-0000-0000-0000-000000000005', '97200000-0000-0000-0000-000000000002', 'Cave Voisine', 'voisine@exemple.fr')
  on conflict do nothing;
insert into public.affaires (bureau, affaire_id, type_id, etape_id, piste_id, titre) values
  ('b5000000-0000-0000-0000-000000000005', 'c7200000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-0000000000a5',
   'e5000000-0000-0000-0000-000000000001', '97200000-0000-0000-0000-000000000001', 'Piste 1'),
  ('b5000000-0000-0000-0000-000000000005', 'c7200000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-0000000000a5',
   'e5000000-0000-0000-0000-000000000001', '97200000-0000-0000-0000-000000000002', 'Piste 2')
  on conflict do nothing;

set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
insert into public.affaire_echanges (bureau, affaire_id, type, modele, destinataire, sujet, corps, cree_par, le)
  values ('b5000000-0000-0000-0000-000000000005', 'c7200000-0000-0000-0000-000000000001', 'email', 'degustation',
          'cave@exemple.fr', 'Degustation', 'Bonjour, ...', '22222222-2222-2222-2222-222222222222', '2001-01-01');
insert into public.affaire_echanges (bureau, affaire_id, type, canal, corps)
  values ('b5000000-0000-0000-0000-000000000005', 'c7200000-0000-0000-0000-000000000002', 'note', 'appel', 'Rappeler jeudi');
select banc.ok('un membre ecrit un mail et une note ; la base signe (auteur et date)',
  (select count(*) = 2 from public.affaire_echanges where bureau = 'b5000000-0000-0000-0000-000000000005')
  and (select cree_par = '55555555-5555-5555-5555-555555555555' and le > now() - interval '1 minute'
         from public.affaire_echanges where modele = 'degustation'));
select banc.refus('une note vide est refusee',
  $q$ insert into public.affaire_echanges (bureau, affaire_id, type, corps)
      values ('b5000000-0000-0000-0000-000000000005', 'c7200000-0000-0000-0000-000000000001', 'note', '   ') $q$, '23514');
select banc.refus('un mail sans objet ni texte est refuse',
  $q$ insert into public.affaire_echanges (bureau, affaire_id, type)
      values ('b5000000-0000-0000-0000-000000000005', 'c7200000-0000-0000-0000-000000000001', 'email') $q$, '23514');
select banc.refus('une sorte inconnue est refusee',
  $q$ insert into public.affaire_echanges (bureau, affaire_id, type, corps)
      values ('b5000000-0000-0000-0000-000000000005', 'c7200000-0000-0000-0000-000000000001', 'sms', 'x') $q$, '23514');
select banc.refus('une affaire d un autre bureau est refusee (cle etrangere)',
  $q$ insert into public.affaire_echanges (bureau, affaire_id, type, corps)
      values ('b5000000-0000-0000-0000-000000000005', 'c7100000-0000-0000-0000-000000000099', 'note', 'x') $q$, '23503');
select banc.refus('personne ne modifie une ligne',
  $q$ update public.affaire_echanges set corps = 'retouche' where modele = 'degustation' $q$, '42501');
select banc.refus('personne ne supprime une ligne',
  $q$ delete from public.affaire_echanges where modele = 'degustation' $q$, '42501');
select banc.ok('la ligne est intacte',
  (select corps = 'Bonjour, ...' from public.affaire_echanges where modele = 'degustation'));
select banc.qui('22222222-2222-2222-2222-222222222222');
select banc.ok('un autre bureau ne voit rien', (select count(*) = 0 from public.affaire_echanges where bureau = 'b5000000-0000-0000-0000-000000000005'));
select banc.refus('un autre bureau n ecrit pas',
  $q$ insert into public.affaire_echanges (bureau, affaire_id, type, corps)
      values ('b5000000-0000-0000-0000-000000000005', 'c7200000-0000-0000-0000-000000000001', 'note', 'x') $q$, '42501');
reset role;
select banc.ok('anon n a aucun droit ; authenticated lit et ecrit seulement',
  not has_table_privilege('anon', 'public.affaire_echanges', 'select')
  and has_table_privilege('authenticated', 'public.affaire_echanges', 'insert')
  and not has_table_privilege('authenticated', 'public.affaire_echanges', 'update')
  and not has_table_privilege('authenticated', 'public.affaire_echanges', 'delete'));

-- L'opposition : le contenu part, la trace reste ; plus rien ne s'ecrit.
update public.pistes set opposition = true where piste_id = '97200000-0000-0000-0000-000000000001';
select banc.ok('l opposition efface objet, texte et destinataire, garde la ligne',
  (select count(*) = 1 and bool_and(sujet is null and corps is null and destinataire is null and type = 'email')
     from public.affaire_echanges where affaire_id = 'c7200000-0000-0000-0000-000000000001'));
select banc.ok('la voisine non opposee garde sa note',
  (select corps = 'Rappeler jeudi' from public.affaire_echanges where affaire_id = 'c7200000-0000-0000-0000-000000000002'));
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
select banc.refus('plus rien ne s ecrit sur l affaire d une personne en opposition',
  $q$ insert into public.affaire_echanges (bureau, affaire_id, type, corps)
      values ('b5000000-0000-0000-0000-000000000005', 'c7200000-0000-0000-0000-000000000001', 'note', 'x') $q$, '42501');
reset role;

-- La purge a trois ans : le contenu du journal d'une piste ancienne part.
update public.affaires set issue = 'perdue', motif = 'prix' where affaire_id = 'c7200000-0000-0000-0000-000000000002';
alter table public.pistes disable trigger user;
alter table public.affaires disable trigger user;
update public.pistes set maj_le = now() - interval '4 years' where piste_id = '97200000-0000-0000-0000-000000000002';
update public.affaires set maj_le = now() - interval '4 years' where affaire_id = 'c7200000-0000-0000-0000-000000000002';
alter table public.pistes enable trigger user;
alter table public.affaires enable trigger user;
select public.pistes_purger();
select banc.ok('la purge a trois ans efface le contenu du journal de la piste',
  (select corps is null from public.affaire_echanges where affaire_id = 'c7200000-0000-0000-0000-000000000002')
  and (select email is null from public.pistes where piste_id = '97200000-0000-0000-0000-000000000002'));
select banc.ok('la purge n est appelable par aucun compte connecte',
  not has_function_privilege('authenticated', 'public.pistes_purger()', 'execute'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 72 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
