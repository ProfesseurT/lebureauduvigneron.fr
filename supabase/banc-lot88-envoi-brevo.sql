-- ===========================================================================
-- BANC DU LOT 88 (les mails partent par Brevo), 09/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue tout le banc du lot 87, puis passe DEUX FOIS supabase/lot88-envoi-brevo.sql.
--   psql -h /tmp -p 55487 -U postgres -d banc88 -v ON_ERROR_STOP=1 -f banc-lot88-envoi-brevo.sql
-- ===========================================================================
\ir banc-lot87-brevo.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);
\ir lot88-envoi-brevo.sql
\ir lot88-envoi-brevo.sql
truncate banc.resultats;

-- Un bureau neuf : maitre 8801, simple 8802 ; 8803 hors du bureau.
insert into auth.users (id, email) values
  ('88010000-0000-0000-0000-000000000001', 'maitre88@clos.fr'),
  ('88020000-0000-0000-0000-000000000002', 'simple88@clos.fr'),
  ('88030000-0000-0000-0000-000000000003', 'dehors88@clos.fr') on conflict do nothing;
insert into public.bureaux (bureau, nom) values ('b8800000-0000-0000-0000-000000000001', 'Clos 88') on conflict do nothing;
insert into public.membres (bureau, personne, role) values
  ('b8800000-0000-0000-0000-000000000001', '88010000-0000-0000-0000-000000000001', 'maitre'),
  ('b8800000-0000-0000-0000-000000000001', '88020000-0000-0000-0000-000000000002', 'simple') on conflict do nothing;

set role service_role;
select banc.ok('sans Brevo : la boite, comme avant',
  (select etat = 'pas_branche' and cle is null from public.brevo_pour_envoi('88020000-0000-0000-0000-000000000002', 'b8800000-0000-0000-0000-000000000001', 'affaires')));
select banc.refus('hors du bureau : refus',
  $q$ select * from public.brevo_pour_envoi('88030000-0000-0000-0000-000000000003', 'b8800000-0000-0000-0000-000000000001', 'affaires') $q$, '42501');
select banc.refus('une sorte inconnue est refusee',
  $q$ select * from public.brevo_pour_envoi('88020000-0000-0000-0000-000000000002', 'b8800000-0000-0000-0000-000000000001', 'sms') $q$, '22023');
select public.brevo_ranger('88010000-0000-0000-0000-000000000001', 'b8800000-0000-0000-0000-000000000001',
  'xkeysib-dddddddddddddddddddddddd-8888', 'contact@clos.fr', 'Clos');
select banc.ok('Brevo branche, aucune adresse choisie : le mail ne part pas (pas de bascule)',
  (select etat = 'sans_expediteur' and cle is null from public.brevo_pour_envoi('88020000-0000-0000-0000-000000000002', 'b8800000-0000-0000-0000-000000000001', 'affaires')));
reset role;

set role authenticated;
select banc.qui('88020000-0000-0000-0000-000000000002');
select banc.ok('l ancien appel a 4 arguments marche encore (le navigateur du lot 87)',
  public.brevo_choisir(p_bureau => 'b8800000-0000-0000-0000-000000000001', p_chemin => null, p_expediteur => 'camila@clos.fr', p_nom => 'Camila'));
select banc.ok('la copie a soi est cochee d office', (select copie_a_soi from public.brevo_choix));
select public.brevo_choisir('b8800000-0000-0000-0000-000000000001', null, null, null, false);
select banc.ok('decocher la copie ne touche pas a l adresse', (select not copie_a_soi and expediteur = 'camila@clos.fr' from public.brevo_choix));
reset role;

set role service_role;
select banc.ok('adresse choisie, sorte cochee : Brevo, avec la cle, l adresse, le nom, la copie',
  (select etat = 'ok' and cle = 'xkeysib-dddddddddddddddddddddddd-8888' and expediteur = 'camila@clos.fr' and nom = 'Camila' and not copie
     from public.brevo_pour_envoi('88020000-0000-0000-0000-000000000002', 'b8800000-0000-0000-0000-000000000001', 'devis')));
reset role;

set role authenticated;
select banc.qui('88010000-0000-0000-0000-000000000001');
select public.brevo_regler('b8800000-0000-0000-0000-000000000001', null, null, false);
reset role;
set role service_role;
select banc.ok('une sorte decochee par le maitre : la boite',
  (select etat = 'pas_pour_cette_sorte' from public.brevo_pour_envoi('88020000-0000-0000-0000-000000000002', 'b8800000-0000-0000-0000-000000000001', 'programmes')));
select public.brevo_noter('b8800000-0000-0000-0000-000000000001', 'refusee', 'cle desactivee');
select banc.ok('cle refusee : le mail ne part pas, il ne bascule pas sur la boite',
  (select etat = 'refusee' and cle is null from public.brevo_pour_envoi('88020000-0000-0000-0000-000000000002', 'b8800000-0000-0000-0000-000000000001', 'affaires')));
select banc.ok('cle refusee mais sorte decochee : la boite, comme avant',
  (select etat = 'pas_pour_cette_sorte' from public.brevo_pour_envoi('88020000-0000-0000-0000-000000000002', 'b8800000-0000-0000-0000-000000000001', 'programmes')));
select public.brevo_noter('b8800000-0000-0000-0000-000000000001', 'branche', null);
reset role;

set role authenticated;
select banc.qui('88020000-0000-0000-0000-000000000002');
select public.brevo_choisir('b8800000-0000-0000-0000-000000000001', 'boite', null, null, null);
reset role;
set role service_role;
select banc.ok('par ma boite : la boite, meme pour une sorte cochee',
  (select etat = 'par_ma_boite' and cle is null from public.brevo_pour_envoi('88020000-0000-0000-0000-000000000002', 'b8800000-0000-0000-0000-000000000001', 'affaires')));

-- Le plafond et l'identifiant.
select public.brevo_envoi_permis('88020000-0000-0000-0000-000000000002', 'b8800000-0000-0000-0000-000000000001', 'affaires') as envoi \gset
select banc.ok('un envoi permis rend son numero', :'envoi' <> '');
select banc.ok('on note l identifiant Brevo',
  public.brevo_envoi_noter(:'envoi'::bigint, '<202610091200.123@smtp-relay.mailin.fr>'));
select public.brevo_envoi_permis('88020000-0000-0000-0000-000000000002', 'b8800000-0000-0000-0000-000000000001', 'affaires') from generate_series(1, 199);
select banc.ok('au 201e envoi du jour, refus', public.brevo_envoi_permis('88020000-0000-0000-0000-000000000002', 'b8800000-0000-0000-0000-000000000001', 'affaires') is null);
select banc.ok('le plafond est par personne : le maitre envoie encore',
  public.brevo_envoi_permis('88010000-0000-0000-0000-000000000001', 'b8800000-0000-0000-0000-000000000001', 'devis') is not null);
select banc.refus('hors du bureau, pas d envoi',
  $q$ select public.brevo_envoi_permis('88030000-0000-0000-0000-000000000003', 'b8800000-0000-0000-0000-000000000001', 'devis') $q$, '42501');
reset role;
select banc.ok('on ne garde ni destinataire ni texte',
  not exists (select 1 from information_schema.columns where table_name = 'brevo_envois'
    and column_name in ('destinataire', 'sujet', 'texte', 'corps')));
update public.brevo_envois set le = now() - interval '31 days' where personne = '88010000-0000-0000-0000-000000000001';
set role service_role;
select public.brevo_envoi_permis('88010000-0000-0000-0000-000000000001', 'b8800000-0000-0000-0000-000000000001', 'devis');
reset role;
select banc.ok('au-dela de 30 jours, la trace s efface',
  (select count(*) = 1 from public.brevo_envois where personne = '88010000-0000-0000-0000-000000000001'));

select banc.ok('authenticated n appelle ni pour_envoi, ni permis, ni noter',
  not has_function_privilege('authenticated', 'public.brevo_pour_envoi(uuid, uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.brevo_envoi_permis(uuid, uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.brevo_envoi_noter(bigint, text)', 'execute')
  and not has_table_privilege('authenticated', 'public.brevo_envois', 'select'));
select banc.ok('une seule brevo_choisir', (select count(*) = 1 from pg_proc where proname = 'brevo_choisir'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 88 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select nom, detail from banc.resultats where not ok;
