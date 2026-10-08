-- ===========================================================================
-- BANC DU LOT 87 (brancher Brevo), 08/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue tout le banc du lot 86, puis passe DEUX FOIS supabase/lot87-brevo.sql sur un bureau
-- neuf (b87 : maitre 8701, simple 8702 ; 8703 est dans un autre bureau).
--   psql -h /tmp -p 55487 -U postgres -d banc87 -v ON_ERROR_STOP=1 -f banc-lot87-brevo.sql
-- Derniere ligne attendue : « BANC DU LOT 87 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot86-boite-google.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);
\ir lot87-brevo.sql
\ir lot87-brevo.sql
truncate banc.resultats;

insert into auth.users (id, email) values
  ('87010000-0000-0000-0000-000000000001', 'maitre87@clos.fr'),
  ('87020000-0000-0000-0000-000000000002', 'simple87@clos.fr'),
  ('87030000-0000-0000-0000-000000000003', 'autre87@clos.fr') on conflict do nothing;
insert into public.bureaux (bureau, nom) values
  ('b8700000-0000-0000-0000-000000000001', 'Clos 87'),
  ('b8700000-0000-0000-0000-000000000002', 'Autre 87') on conflict do nothing;
insert into public.membres (bureau, personne, role) values
  ('b8700000-0000-0000-0000-000000000001', '87010000-0000-0000-0000-000000000001', 'maitre'),
  ('b8700000-0000-0000-0000-000000000001', '87020000-0000-0000-0000-000000000002', 'simple'),
  ('b8700000-0000-0000-0000-000000000002', '87030000-0000-0000-0000-000000000003', 'maitre') on conflict do nothing;

-- ------------------------------------------------ la fonction Edge (cle de service)
set role service_role;
select banc.refus('un simple utilisateur ne branche pas Brevo',
  $q$ select public.brevo_ranger('87020000-0000-0000-0000-000000000002', 'b8700000-0000-0000-0000-000000000001',
      'xkeysib-aaaaaaaaaaaaaaaaaaaaaaaa-1234', 'c@clos.fr', 'Clos') $q$, '42501');
select banc.refus('un maitre d un autre bureau ne branche pas Brevo ici',
  $q$ select public.brevo_ranger('87030000-0000-0000-0000-000000000003', 'b8700000-0000-0000-0000-000000000001',
      'xkeysib-aaaaaaaaaaaaaaaaaaaaaaaa-1234', 'c@clos.fr', 'Clos') $q$, '42501');
select banc.refus('une cle trop courte est refusee',
  $q$ select public.brevo_ranger('87010000-0000-0000-0000-000000000001', 'b8700000-0000-0000-0000-000000000001',
      'xkeysib-court', 'c@clos.fr', 'Clos') $q$, '22023');
select banc.refus('une cle avec un espace est refusee',
  $q$ select public.brevo_ranger('87010000-0000-0000-0000-000000000001', 'b8700000-0000-0000-0000-000000000001',
      'xkeysib-aaaaaaaaaa aaaaaaaaaaaaa-1234', 'c@clos.fr', 'Clos') $q$, '22023');
select banc.ok('le maitre branche Brevo',
  public.brevo_ranger('87010000-0000-0000-0000-000000000001', 'b8700000-0000-0000-0000-000000000001',
    '  xkeysib-aaaaaaaaaaaaaaaaaaaaaaaa-1234  ', 'contact@clos.fr', E'Clos\n87') = 'branche');
select banc.ok('la fonction Edge relit la cle, sans espaces',
  public.brevo_cle('b8700000-0000-0000-0000-000000000001') = 'xkeysib-aaaaaaaaaaaaaaaaaaaaaaaa-1234');
reset role;
select banc.ok('la cle est dans Vault, et seulement la',
  (select count(*) = 1 from vault.secrets where secret like 'xkeysib-%')
  and not exists (select 1 from public.brevo b where b.compte_email like 'xkeysib%' or b.compte_nom like 'xkeysib%'));
select banc.ok('on garde les 4 derniers signes, le compte, sans retour a la ligne',
  (select cle_fin = '1234' and compte_email = 'contact@clos.fr' and compte_nom = 'Clos87' and etat = 'branche'
     and defaut_affaires and defaut_devis and defaut_programmes from public.brevo));

-- Le maitre regle ce qui part par defaut, puis remplace la cle : les reglages restent.
set role authenticated;
select banc.qui('87010000-0000-0000-0000-000000000001');
select banc.ok('le maitre regle : devis par Brevo, le reste non',
  public.brevo_regler('b8700000-0000-0000-0000-000000000001', false, null, false));
reset role;
select banc.ok('reglage pose, un null laisse la valeur',
  (select not defaut_affaires and defaut_devis and not defaut_programmes from public.brevo));
set role service_role;
select public.brevo_ranger('87010000-0000-0000-0000-000000000001', 'b8700000-0000-0000-0000-000000000001',
    'xkeysib-bbbbbbbbbbbbbbbbbbbbbbbb-5678', 'contact@clos.fr', 'Clos');
reset role;
select banc.ok('une nouvelle cle REMPLACE l ancienne, sans en ajouter, et garde les reglages',
  (select count(*) = 1 from vault.secrets where name like 'brevo:%')
  and exists (select 1 from vault.secrets where secret like 'xkeysib-bbbb%')
  and (select cle_fin = '5678' and not defaut_affaires and defaut_devis from public.brevo));

-- L'etat vu par Brevo.
set role service_role;
select banc.ok('noter un refus de Brevo', public.brevo_noter('b8700000-0000-0000-0000-000000000001', 'refusee', 'cle desactivee'));
reset role;
select banc.ok('refusee, avec le motif du bureau', (select etat = 'refusee' and erreur = 'cle desactivee' from public.brevo));
set role service_role;
select public.brevo_noter('b8700000-0000-0000-0000-000000000001', 'branche', 'ignore');
select banc.refus('un etat inconnu est refuse',
  $q$ select public.brevo_noter('b8700000-0000-0000-0000-000000000001', 'perdu', null) $q$, '22023');
reset role;
select banc.ok('rebranchee, le motif s efface', (select etat = 'branche' and erreur is null from public.brevo));

-- ------------------------------------------------ les membres
set role authenticated;
select banc.qui('87020000-0000-0000-0000-000000000002');
select banc.ok('un simple utilisateur lit l etat de Brevo', (select count(*) = 1 from public.brevo where bureau = 'b8700000-0000-0000-0000-000000000001'));
select banc.refus('personne ne lit la cle depuis le navigateur', $q$ select secret_id from public.brevo $q$, '42501');
select banc.refus('un simple utilisateur ne relit pas la cle', $q$ select public.brevo_cle('b8700000-0000-0000-0000-000000000001') $q$, '42501');
select banc.refus('un simple utilisateur ne regle pas Brevo',
  $q$ select public.brevo_regler('b8700000-0000-0000-0000-000000000001', true, true, true) $q$, '42501');
select banc.refus('un simple utilisateur ne retire pas Brevo',
  $q$ select public.brevo_retirer('b8700000-0000-0000-0000-000000000001') $q$, '42501');
select banc.refus('personne n ecrit dans brevo en direct',
  $q$ update public.brevo set defaut_affaires = true $q$, '42501');
select banc.ok('je choisis mon expediteur et ma boite',
  public.brevo_choisir('b8700000-0000-0000-0000-000000000001', 'boite', '  Camila@Clos.fr ', '  Camila   Vendramini '));
select banc.ok('choix pose, adresse en minuscules, espaces resserres',
  (select chemin = 'boite' and expediteur = 'camila@clos.fr' and expediteur_nom = 'Camila Vendramini' from public.brevo_choix));
select public.brevo_choisir('b8700000-0000-0000-0000-000000000001', 'bureau', null, null);
select banc.ok('un null laisse l expediteur', (select chemin = 'bureau' and expediteur = 'camila@clos.fr' from public.brevo_choix));
select public.brevo_choisir('b8700000-0000-0000-0000-000000000001', null, '', null);
select banc.ok('une chaine vide efface l expediteur', (select expediteur is null and expediteur_nom = 'Camila Vendramini' from public.brevo_choix));
select banc.refus('un chemin inconnu est refuse',
  $q$ select public.brevo_choisir('b8700000-0000-0000-0000-000000000001', 'gmail', null, null) $q$, '23514');
select banc.refus('une adresse qui n en est pas une est refusee',
  $q$ select public.brevo_choisir('b8700000-0000-0000-0000-000000000001', null, 'camila <x@y.fr>', null) $q$, '23514');
select banc.refus('un nom avec un @ est refuse',
  $q$ select public.brevo_choisir('b8700000-0000-0000-0000-000000000001', null, null, 'moi@clos.fr') $q$, '23514');
select banc.refus('personne n ecrit son choix en direct',
  $q$ update public.brevo_choix set chemin = 'boite' $q$, '42501');

select banc.qui('87010000-0000-0000-0000-000000000001');
select banc.ok('le maitre ne lit pas le choix d un collegue', (select count(*) = 0 from public.brevo_choix));
select public.brevo_choisir('b8700000-0000-0000-0000-000000000001', null, 'contact@clos.fr', null);
select banc.ok('le maitre a son propre choix', (select count(*) = 1 from public.brevo_choix where expediteur = 'contact@clos.fr'));

select banc.qui('87030000-0000-0000-0000-000000000003');
select banc.ok('un autre bureau ne voit pas notre Brevo', (select count(*) = 0 from public.brevo where bureau = 'b8700000-0000-0000-0000-000000000001'));
select banc.refus('un autre bureau ne choisit rien chez nous',
  $q$ select public.brevo_choisir('b8700000-0000-0000-0000-000000000001', 'boite', null, null) $q$, '42501');
select banc.refus('un autre maitre ne retire pas notre Brevo',
  $q$ select public.brevo_retirer('b8700000-0000-0000-0000-000000000001') $q$, '42501');

-- ------------------------------------------------ retirer, quitter
select banc.qui('87010000-0000-0000-0000-000000000001');
select banc.ok('le maitre retire Brevo', public.brevo_retirer('b8700000-0000-0000-0000-000000000001'));
reset role;
select banc.ok('retire, la cle a quitte Vault', not exists (select 1 from vault.secrets where name like 'brevo:%'));
select banc.ok('les choix des personnes restent', (select count(*) = 2 from public.brevo_choix where bureau = 'b8700000-0000-0000-0000-000000000001'));
delete from public.membres where bureau = 'b8700000-0000-0000-0000-000000000001' and personne = '87020000-0000-0000-0000-000000000002';
select banc.ok('quitter le bureau efface son choix',
  not exists (select 1 from public.brevo_choix where personne = '87020000-0000-0000-0000-000000000002'));
set role service_role;
select public.brevo_ranger('87010000-0000-0000-0000-000000000001', 'b8700000-0000-0000-0000-000000000001',
    'xkeysib-cccccccccccccccccccccccc-9999', 'contact@clos.fr', 'Clos');
reset role;
delete from public.bureaux where bureau = 'b8700000-0000-0000-0000-000000000001';
select banc.ok('supprimer le bureau efface Brevo et sa cle',
  not exists (select 1 from public.brevo where bureau = 'b8700000-0000-0000-0000-000000000001')
  and not exists (select 1 from vault.secrets where name like 'brevo:%'));

select banc.ok('anon n a aucun droit',
  not has_table_privilege('anon', 'public.brevo', 'select')
  and not has_table_privilege('anon', 'public.brevo_choix', 'select')
  and not has_function_privilege('anon', 'public.brevo_choisir(uuid, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.brevo_regler(uuid, boolean, boolean, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.brevo_retirer(uuid)', 'execute'));
select banc.ok('authenticated n appelle ni ranger, ni la cle, ni noter, ni les controles de role',
  not has_function_privilege('authenticated', 'public.brevo_ranger(uuid, uuid, text, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.brevo_cle(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.brevo_noter(uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.brevo_est_maitre(uuid, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.brevo_est_membre(uuid, uuid)', 'execute'));
select banc.ok('authenticated ne peut rien ecrire en direct',
  not has_table_privilege('authenticated', 'public.brevo', 'insert')
  and not has_table_privilege('authenticated', 'public.brevo', 'update')
  and not has_table_privilege('authenticated', 'public.brevo', 'delete')
  and not has_table_privilege('authenticated', 'public.brevo_choix', 'insert')
  and not has_table_privilege('authenticated', 'public.brevo_choix', 'update')
  and not has_table_privilege('authenticated', 'public.brevo_choix', 'delete'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 87 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select nom, detail from banc.resultats where not ok;
