-- ===========================================================================
-- BANC DU LOT 79 (le logo du domaine sous les mails), 08/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue tout le banc du lot 78 (donc 77, 76... jusqu'au 69, qui cree `domaine_logo`), puis
-- passe DEUX FOIS lot79-logo-mails.sql.
--   psql -h /tmp -p 55475 -U postgres -d banc79 -v ON_ERROR_STOP=1 -f banc-lot79-logo-mails.sql
-- ===========================================================================
\ir banc-lot78-nom-affiche.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);
\ir lot79-logo-mails.sql
\ir lot79-logo-mails.sql
truncate banc.resultats;
grant execute on all functions in schema banc to service_role;

update public.boites set etat = 'branchee', erreur = null where personne = '75757575-7575-7575-7575-757575757575';
delete from public.domaine_logo where bureau = 'b1000000-0000-0000-0000-000000000001';

set role service_role;
select banc.ok('sans logo dans Mon domaine : rien a joindre',
  (select logo is null and logo_l is null and logo_h is null
     from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
select banc.ok('le nom affiche du lot 78 est toujours rendu',
  (select count(*) = 1 from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
reset role;

insert into public.domaine_logo (bureau, image, empreinte, largeur, hauteur)
values ('b1000000-0000-0000-0000-000000000001',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        encode(sha256(convert_to('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'UTF8')), 'hex'),
        480, 160);

select banc.ok('la case est cochee par defaut',
  (select logo_dans_mails from public.boites where personne = '75757575-7575-7575-7575-757575757575'));
set role service_role;
select banc.ok('case cochee : le logo et ses dimensions partent avec la boite',
  (select logo like 'data:image/png;base64,%' and logo_l = 480 and logo_h = 160
     from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
reset role;

set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select banc.ok('le vigneron decoche la case de SA boite',
  public.boite_logo('b1000000-0000-0000-0000-000000000001', false));
reset role;
select banc.ok('la case est rangee decochee',
  (select not logo_dans_mails from public.boites where personne = '75757575-7575-7575-7575-757575757575'));
set role service_role;
select banc.ok('case decochee : plus de logo, la boite part quand meme',
  (select logo is null and logo_l is null and logo_h is null and adresse is not null
     from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
reset role;

set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select banc.ok('une reponse vide ne change rien',
  not public.boite_logo('b1000000-0000-0000-0000-000000000001', null));
reset role;
select banc.ok('apres une reponse vide, la case reste decochee',
  (select not logo_dans_mails from public.boites where personne = '75757575-7575-7575-7575-757575757575'));

set role authenticated;
select banc.qui('11111111-1111-1111-1111-111111111111');
select public.boite_logo('b1000000-0000-0000-0000-000000000001', true);
reset role;
select banc.ok('la case du collegue 7575 n a pas bouge',
  (select not logo_dans_mails from public.boites where personne = '75757575-7575-7575-7575-757575757575'));

set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select banc.ok('le vigneron la recoche',
  public.boite_logo('b1000000-0000-0000-0000-000000000001', true));
reset role;
set role service_role;
select banc.ok('recochee : le logo revient',
  (select logo is not null from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
reset role;

select banc.ok('droits : le compte connecte coche, il ne lit pas le mot de passe',
  has_function_privilege('authenticated', 'public.boite_logo(uuid, boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.boite_pour_envoi(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.boite_logo(uuid, boolean)', 'execute'));
select banc.ok('le compte connecte lit sa case',
  has_column_privilege('authenticated', 'public.boites', 'logo_dans_mails', 'select'));
select banc.ok('le compte connecte n ecrit pas la case en direct',
  not has_column_privilege('authenticated', 'public.boites', 'logo_dans_mails', 'update'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 79 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select nom, detail from banc.resultats where not ok;
