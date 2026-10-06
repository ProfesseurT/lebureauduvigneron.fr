-- ===========================================================================
-- BANC DU LOT 70 (la signature dessinee ou manuscrite), 06/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 69, puis passe DEUX FOIS supabase/lot70-signature-trace.sql.
--   psql -h /tmp -p 55470 -d banc70 -v ON_ERROR_STOP=1 -f banc-lot70-signature-trace.sql
-- Derniere ligne attendue : « BANC DU LOT 70 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot69-logo-domaine.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
create temp table t_avant70 as select count(*) n from public.devis_signatures;
\ir lot70-signature-trace.sql
\ir lot70-signature-trace.sql
grant execute on all functions in schema banc to service_role;
truncate banc.resultats;

insert into public.affaires (bureau, affaire_id, type_id, etape_id, client_id, client_nom, titre, issue)
  select 'b5000000-0000-0000-0000-000000000005', ('c7000000-0000-0000-0000-00000000000' || n)::uuid,
         'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'T' || n, 'en_cours'
    from generate_series(1, 3) n on conflict do nothing;

create temp table t70 (k text primary key, v text);
grant all on t70 to authenticated, service_role;
insert into t70 values
  ('png', 'data:image/png;base64,iVBORw0KGgo' || repeat('AAAA', 60)),
  ('svg', 'data:image/png;base64,' || encode(convert_to('<svg onload="alert(1)"></svg>' || repeat(' ', 200), 'UTF8'), 'base64')),
  ('jpg', 'data:image/jpeg;base64,/9j/' || repeat('AAAA', 60)),
  ('court', 'data:image/png;base64,iVBORw0KGgoAAAA'),
  ('gros', 'data:image/png;base64,iVBORw0KGgo' || repeat('A', 150000)),
  ('guillemet', 'data:image/png;base64,iVBORw0KGgo' || repeat('A', 200) || '"><script>');
create function pg_temp.v70(k text) returns text language sql as $f$ select v from t70 where t70.k = $1 $f$;

set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
create temp table t_70 (k text primary key, id uuid, num text, jeton text);
grant all on t_70 to authenticated, service_role;
insert into t_70 (k, id, num) select 'u' || n, d.devis_id, d.numero
  from generate_series(1, 3) n,
  lateral public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', ('c7000000-0000-0000-0000-00000000000' || n)::uuid, null,
    jsonb_build_array(banc.l(1500, 6))) d;
create function pg_temp.i70(k text) returns uuid language sql as $f$ select id from t_70 where t_70.k = $1 $f$;
create function pg_temp.j70(k text) returns text language sql as $f$ select jeton from t_70 where t_70.k = $1 $f$;
create function pg_temp.e70(k text) returns text language sql as $f$ select papier_empreinte from public.devis where devis_id = (select id from t_70 where t_70.k = $1) $f$;
select public.devis_envoyer('b5000000-0000-0000-0000-000000000005', pg_temp.i70('u' || n), null, null, null, null,
  '<!doctype html><html><head><title>Devis ' || (select num from t_70 where k = 'u' || n) || '</title></head><body>'
  || repeat('Saumur blanc 75 cl. ', 30) || '</body></html>')
  from generate_series(1, 3) n;
update t_70 set jeton = public.devis_lien_creer('b5000000-0000-0000-0000-000000000005', id);
reset role;

-- 1. LA FORME
select banc.ok('une seule signature_poser, a 9 arguments',
  (select count(*) = 1 and min(pronargs) = 9 from pg_proc where proname = 'signature_poser'));
select banc.ok('anon et authenticated n executent ni signature_poser ni le controle d image ; le role de service si',
  not has_function_privilege('anon', 'public.signature_poser(text,text,text,boolean,text,text,text,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.signature_poser(text,text,text,boolean,text,text,text,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.signature_trace_valide(text)', 'execute')
  and has_function_privilege('service_role', 'public.signature_poser(text,text,text,boolean,text,text,text,text,text)', 'execute'));
select banc.ok('le controle d image : un PNG oui ; SVG deguise, JPEG, trop court, trop gros, guillemet non',
  public.signature_trace_valide(pg_temp.v70('png'))
  and not public.signature_trace_valide(pg_temp.v70('svg')) and not public.signature_trace_valide(pg_temp.v70('jpg'))
  and not public.signature_trace_valide(pg_temp.v70('court')) and not public.signature_trace_valide(pg_temp.v70('gros'))
  and not public.signature_trace_valide(pg_temp.v70('guillemet')) and not public.signature_trace_valide(null));
select banc.ok('les signatures deja posees restent, sans image',
  (select count(*) from public.devis_signatures) = (select n from t_avant70)
  and not exists (select 1 from public.devis_signatures where trace is not null or trace_mode is not null));

-- 2. SIGNER EXIGE L IMAGE
set role service_role;
select banc.ok('l appel a sept arguments (ancienne fonction Edge) est refuse « trace », rien n est ecrit',
  public.signature_poser(p_jeton => pg_temp.j70('u1'), p_nom => 'Jean Dupont', p_qualite => 'Gérant', p_accord => true,
    p_empreinte => pg_temp.e70('u1'), p_ip => null, p_agent => null)->>'refus' = 'trace'
  and not exists (select 1 from public.devis_signatures where devis_id = pg_temp.i70('u1')));
select banc.ok('un mode inconnu est refuse',
  public.signature_poser(pg_temp.j70('u1'), 'Jean Dupont', 'Gérant', true, pg_temp.e70('u1'), null, null, pg_temp.v70('png'), 'tampon')->>'refus' = 'trace');
select banc.ok('une image qui n est pas un PNG est refusee',
  public.signature_poser(pg_temp.j70('u1'), 'Jean Dupont', 'Gérant', true, pg_temp.e70('u1'), null, null, pg_temp.v70('svg'), 'dessin')->>'refus' = 'trace');
select banc.ok('le nom passe avant l image : un nom vide dit « nom »',
  public.signature_poser(pg_temp.j70('u1'), ' ', 'Gérant', true, pg_temp.e70('u1'), null, null, null, null)->>'refus' = 'nom');
select banc.ok('rien n a ete ecrit par ces refus',
  not exists (select 1 from public.devis_signatures where devis_id = pg_temp.i70('u1')));
create temp table t70_r1 as select public.signature_poser(pg_temp.j70('u1'), 'Jean Dupont', 'Gérant', true, pg_temp.e70('u1'),
  '1.2.3.4', 'banc', pg_temp.v70('png'), 'dessin') r;
select banc.ok('signe au pad : la page recoit l image et son mode',
  (select r->>'etat' = 'signe' and r->>'signe_trace' = pg_temp.v70('png') and r->>'signe_trace_mode' = 'dessin' from t70_r1));
select banc.ok('la preuve garde l image, le devis est accepte',
  (select s.trace = pg_temp.v70('png') and s.trace_mode = 'dessin' from public.devis_signatures s where s.devis_id = pg_temp.i70('u1'))
  and (select statut = 'accepte' from public.devis where devis_id = pg_temp.i70('u1')));
select banc.ok('signe en manuscrit : le mode est garde',
  public.signature_poser(pg_temp.j70('u2'), 'Marie Durand', 'Acheteuse', true, pg_temp.e70('u2'), null, null, pg_temp.v70('png'), 'manuscrit')->>'signe_trace_mode' = 'manuscrit');
select banc.ok('signature_lire rend l image apres coup',
  public.signature_lire(pg_temp.j70('u1'))->>'signe_trace' = pg_temp.v70('png'));
select banc.ok('un devis pas encore signe ne rend pas d image',
  public.signature_lire(pg_temp.j70('u3'))->>'etat' = 'a_signer' and public.signature_lire(pg_temp.j70('u3'))->>'signe_trace' is null);
reset role;

-- 3. LA TABLE TIENT SANS LA FONCTION
select banc.refus('la preuve ne change pas d image',
  format('update public.devis_signatures set trace = null, trace_mode = null where devis_id = %L', pg_temp.i70('u1')), '23514');
select banc.refus('une image sans mode est refusee par la table',
  format('insert into public.devis_signatures (lien_id, bureau, devis_id, numero, nom, qualite, accord, papier_empreinte, trace) '
    || 'select lien_id, bureau, devis_id, %L, %L, %L, true, %L, %L from public.devis_liens where devis_id = %L and remplace_le is null',
    'X', 'Jean Dupont', 'Gérant', pg_temp.e70('u3'), pg_temp.v70('png'), pg_temp.i70('u3')), '23514');

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 70 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
