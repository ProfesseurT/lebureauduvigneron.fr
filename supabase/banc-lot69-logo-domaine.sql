-- ===========================================================================
-- BANC DU LOT 69 (le logo du domaine), 06/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 68, puis passe DEUX FOIS supabase/lot69-logo-domaine.sql.
--   psql -h /tmp -p 55469 -d banc69 -v ON_ERROR_STOP=1 -f banc-lot69-logo-domaine.sql
-- Derniere ligne attendue : « BANC DU LOT 69 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot68-ecart-versions.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
\ir lot69-logo-domaine.sql
\ir lot69-logo-domaine.sql
grant execute on all functions in schema banc to service_role;
truncate banc.resultats;
insert into auth.users (id) values ('33333333-3333-3333-3333-333333333333') on conflict do nothing;
insert into public.membres values
  ('b1000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'simple')
  on conflict do nothing;

-- Un vrai PNG de 1 x 1 et un vrai JPEG minimal (en-tete seul : la base ne lit que la forme
-- et les premiers octets, c'est le navigateur qui relit l'image).
create temp table t69 (k text primary key, v text);
grant all on t69 to authenticated, service_role;
insert into t69 values
  ('png', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
  ('jpg', 'data:image/jpeg;base64,' || encode('\xffd8ffe000104a464946'::bytea, 'base64')),
  ('svg', 'data:image/png;base64,' || encode(convert_to('<svg onload="alert(1)"></svg>', 'UTF8'), 'base64')),
  ('svgtype', 'data:image/svg+xml;base64,' || encode(convert_to('<svg></svg>', 'UTF8'), 'base64')),
  ('jpgpng', 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
  ('guillemet', 'data:image/png;base64,iVBORw0KGgo"><script>'),
  ('gros', 'data:image/png;base64,iVBORw0KGgo' || repeat('A', 150000));
create function pg_temp.v69(k text) returns text language sql as $f$ select v from t69 where t69.k = $1 $f$;

-- 1. LA FORME
select banc.ok('la table se lit par authenticated, ne s ecrit pas en direct, rien pour anon',
  has_table_privilege('authenticated', 'public.domaine_logo', 'select')
  and not has_table_privilege('authenticated', 'public.domaine_logo', 'insert')
  and not has_table_privilege('authenticated', 'public.domaine_logo', 'update')
  and not has_table_privilege('authenticated', 'public.domaine_logo', 'delete')
  and not has_table_privilege('anon', 'public.domaine_logo', 'select'));
select banc.ok('anon n execute ni poser ni retirer',
  not has_function_privilege('anon', 'public.domaine_logo_poser(uuid,text,integer,integer)', 'execute')
  and not has_function_privilege('anon', 'public.domaine_logo_retirer(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.domaine_logo_valide(text)', 'execute'));
select banc.ok('le controle des octets : PNG et JPEG oui, SVG deguise non',
  public.domaine_logo_valide(pg_temp.v69('png')) and public.domaine_logo_valide(pg_temp.v69('jpg'))
  and not public.domaine_logo_valide(pg_temp.v69('svg')) and not public.domaine_logo_valide(pg_temp.v69('svgtype'))
  and not public.domaine_logo_valide(pg_temp.v69('jpgpng')) and not public.domaine_logo_valide(pg_temp.v69('guillemet'))
  and not public.domaine_logo_valide(pg_temp.v69('gros')) and not public.domaine_logo_valide(null));

-- 2. LE MAITRE POSE, CHANGE, RETIRE
set role authenticated;
select banc.qui('11111111-1111-1111-1111-111111111111');
select banc.ok('le maitre pose un PNG, l empreinte est calculee par la base',
  (select p.empreinte = encode(sha256(convert_to(pg_temp.v69('png'), 'UTF8')), 'hex') and p.largeur = 1
     from public.domaine_logo_poser('b1000000-0000-0000-0000-000000000001', pg_temp.v69('png'), 1, 1) p));
select banc.ok('il le relit, signe a son nom',
  (select count(*) = 1 and bool_and(maj_par = '11111111-1111-1111-1111-111111111111') from public.domaine_logo));
select banc.ok('le maitre le remplace par un JPEG (une seule ligne)',
  (select p.empreinte = encode(sha256(convert_to(pg_temp.v69('jpg'), 'UTF8')), 'hex')
     from public.domaine_logo_poser('b1000000-0000-0000-0000-000000000001', pg_temp.v69('jpg'), 300, 120) p)
  and (select count(*) = 1 from public.domaine_logo));
select banc.refus('un SVG deguise en PNG est refuse',
  format('select public.domaine_logo_poser(%L, %L, 1, 1)', 'b1000000-0000-0000-0000-000000000001', pg_temp.v69('svg')), '22023');
select banc.refus('un type svg+xml est refuse',
  format('select public.domaine_logo_poser(%L, %L, 1, 1)', 'b1000000-0000-0000-0000-000000000001', pg_temp.v69('svgtype')), '22023');
select banc.refus('un texte qui sort de l attribut est refuse',
  format('select public.domaine_logo_poser(%L, %L, 1, 1)', 'b1000000-0000-0000-0000-000000000001', pg_temp.v69('guillemet')), '22023');
select banc.refus('une image de plus de 150 000 signes est refusee',
  format('select public.domaine_logo_poser(%L, %L, 1, 1)', 'b1000000-0000-0000-0000-000000000001', pg_temp.v69('gros')), '22023');
select banc.refus('une largeur au-dela de 600 px est refusee',
  format('select public.domaine_logo_poser(%L, %L, 601, 1)', 'b1000000-0000-0000-0000-000000000001', pg_temp.v69('png')), '22023');
select banc.refus('le maitre d un bureau ne pose pas dans un autre',
  format('select public.domaine_logo_poser(%L, %L, 1, 1)', 'b2000000-0000-0000-0000-000000000002', pg_temp.v69('png')), '42501');
select banc.refus('meme le maitre n ecrit pas en direct',
  format('update public.domaine_logo set largeur = 2 where bureau = %L', 'b1000000-0000-0000-0000-000000000001'), '42501');

-- 3. LE SIMPLE UTILISATEUR LIT ET NE TOUCHE A RIEN
select banc.qui('33333333-3333-3333-3333-333333333333');
select banc.ok('un simple utilisateur du bureau lit le logo', (select count(*) = 1 from public.domaine_logo));
select banc.refus('il ne le change pas',
  format('select public.domaine_logo_poser(%L, %L, 1, 1)', 'b1000000-0000-0000-0000-000000000001', pg_temp.v69('png')), '42501');
select banc.refus('il ne le retire pas',
  format('select public.domaine_logo_retirer(%L)', 'b1000000-0000-0000-0000-000000000001'), '42501');
select banc.refus('il ne l efface pas en direct',
  format('delete from public.domaine_logo where bureau = %L', 'b1000000-0000-0000-0000-000000000001'), '42501');

-- 4. UN ETRANGER NE VOIT RIEN
select banc.qui('22222222-2222-2222-2222-222222222222');
select banc.ok('le maitre d un autre bureau ne lit pas ce logo', not exists (select 1 from public.domaine_logo));

-- 5. RETIRER
select banc.qui('11111111-1111-1111-1111-111111111111');
-- Trois requetes et pas une : l'ordre d'evaluation d'un `and` n'est pas garanti (lot 51).
select banc.ok('le maitre le retire : vrai', public.domaine_logo_retirer('b1000000-0000-0000-0000-000000000001'));
select banc.ok('il n y a plus rien a retirer : faux', not public.domaine_logo_retirer('b1000000-0000-0000-0000-000000000001'));
select banc.ok('la ligne est partie', not exists (select 1 from public.domaine_logo));
reset role;

-- 6. MEME LE ROLE DE SERVICE NE RANGE PAS UN FICHIER INVALIDE
select banc.refus('le declencheur refuse un SVG ecrit en direct par le proprietaire',
  format('insert into public.domaine_logo (bureau, image, empreinte, largeur, hauteur) values (%L, %L, %L, 1, 1)',
    'b1000000-0000-0000-0000-000000000001', pg_temp.v69('svg'), 'x'), '22023');

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 69 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
