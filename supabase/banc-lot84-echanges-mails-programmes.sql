-- ===========================================================================
-- BANC DU LOT 84 (qui a eu l'echange, mails programmes), 08/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue tout le banc du lot 83, puis passe DEUX FOIS lot84-echanges-mails-programmes.sql.
--   psql -h /tmp -p 55484 -U postgres -d banc84 -v ON_ERROR_STOP=1 -f banc-lot84-echanges-mails-programmes.sql
-- Derniere ligne attendue : « BANC DU LOT 84 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot83-relier-fusionner.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);
\ir lot84-echanges-mails-programmes.sql
\ir lot84-echanges-mails-programmes.sql
-- Supabase donne au role de service tous les droits sur une table neuve ; le banc le refait.
grant all on public.mails_programmes to service_role;
grant usage on schema banc to service_role;
grant execute on all functions in schema banc to service_role;
truncate banc.resultats;

-- Decor : b1, maitre 1111, simple 7575 (boite branchee). Un type, une etape, deux pistes, deux affaires.
update public.boites set etat = 'branchee', utiliser = true, erreur = null where personne = '75757575-7575-7575-7575-757575757575';
delete from public.boites where personne = '11111111-1111-1111-1111-111111111111' and bureau = 'b1000000-0000-0000-0000-000000000001';
insert into public.affaire_types (bureau, type_id, nom) values
  ('b1000000-0000-0000-0000-000000000001', 'a8400000-0000-0000-0000-000000000001', 'Caviste 84') on conflict do nothing;
insert into public.affaire_etapes (bureau, etape_id, type_id, nom, ordre) values
  ('b1000000-0000-0000-0000-000000000001', 'e8400000-0000-0000-0000-000000000001', 'a8400000-0000-0000-0000-000000000001', 'Repere', 1) on conflict do nothing;
insert into public.pistes (bureau, piste_id, nom, email) values
  ('b1000000-0000-0000-0000-000000000001', '98400000-0000-0000-0000-000000000001', 'Cave 84', 'cave84@exemple.fr'),
  ('b1000000-0000-0000-0000-000000000001', '98400000-0000-0000-0000-000000000002', 'Cave Opposee', 'oppo@exemple.fr') on conflict do nothing;
insert into public.affaires (bureau, affaire_id, type_id, etape_id, piste_id, titre) values
  ('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001', 'a8400000-0000-0000-0000-000000000001',
   'e8400000-0000-0000-0000-000000000001', '98400000-0000-0000-0000-000000000001', 'Affaire 84'),
  ('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000002', 'a8400000-0000-0000-0000-000000000001',
   'e8400000-0000-0000-0000-000000000001', '98400000-0000-0000-0000-000000000002', 'Affaire opposee') on conflict do nothing;

-- ------------------------------------------------ 1. qui a eu l'echange, et quand
set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
insert into public.affaire_echanges (bureau, affaire_id, type, canal, corps, fait_par, fait_le)
  values ('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001', 'note', 'visite', 'Degustation au domaine',
          '11111111-1111-1111-1111-111111111111', now() - interval '3 days');
select banc.ok('une note porte le collegue qui a eu l echange et sa date ; l auteur reste celui qui note',
  (select fait_par = '11111111-1111-1111-1111-111111111111' and cree_par = '75757575-7575-7575-7575-757575757575'
          and fait_le < now() - interval '2 days' and le > now() - interval '1 minute'
     from public.affaire_echanges where corps = 'Degustation au domaine'));
select banc.refus('une personne hors du bureau est refusee',
  $q$ insert into public.affaire_echanges (bureau, affaire_id, type, corps, fait_par)
      values ('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001', 'note', 'x', '22222222-2222-2222-2222-222222222222') $q$, '23514');
select banc.refus('un echange ne se note pas dans le futur (journal de l affaire)',
  $q$ insert into public.affaire_echanges (bureau, affaire_id, type, corps, fait_le)
      values ('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001', 'note', 'x', now() + interval '3 days') $q$, '23514');
insert into public.echanges (bureau, echange_id, client_id, le, type, canal, resume, fait_par)
  values ('b1000000-0000-0000-0000-000000000001', 'e84-1', '901', now() - interval '5 days', 'appel', 'appel', 'Appel note apres coup',
          '11111111-1111-1111-1111-111111111111');
select banc.ok('un echange de fiche porte son collegue et la date choisie',
  (select fait_par = '11111111-1111-1111-1111-111111111111' and le < now() - interval '4 days' from public.echanges where echange_id = 'e84-1'));
select banc.refus('un echange de fiche hors du bureau est refuse',
  $q$ insert into public.echanges (bureau, echange_id, client_id, type, resume, fait_par)
      values ('b1000000-0000-0000-0000-000000000001', 'e84-2', '901', 'note', 'x', '22222222-2222-2222-2222-222222222222') $q$, '23514');
select banc.refus('un echange de fiche dans le futur est refuse',
  $q$ insert into public.echanges (bureau, echange_id, client_id, le, type, resume)
      values ('b1000000-0000-0000-0000-000000000001', 'e84-3', '901', now() + interval '5 days', 'note', 'x') $q$, '23514');

-- ------------------------------------------------ 2. programmer
select banc.ok('je programme un mail depuis ma boite branchee',
  (select statut = 'prevu' and personne = '75757575-7575-7575-7575-757575757575' and destinataire = 'cave84@exemple.fr'
     from public.mail_programmer('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001',
       ' cave84@exemple.fr ', 'Relance', 'Bonjour', 'relance_devis', now() + interval '1 hour', current_date + 7, 'Relancer')));
select banc.refus('pas dans moins de 5 minutes',
  $q$ select public.mail_programmer('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001',
       'cave84@exemple.fr', 'A', 'B', null, now() + interval '1 minute') $q$, '23514');
select banc.refus('pas au-dela de 60 jours',
  $q$ select public.mail_programmer('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001',
       'cave84@exemple.fr', 'A', 'B', null, now() + interval '61 days') $q$, '23514');
select banc.refus('une adresse a deux destinataires est refusee',
  $q$ select public.mail_programmer('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001',
       'a@x.fr, b@y.fr', 'A', 'B', null, now() + interval '1 hour') $q$, '23514');
select banc.refus('un mail vide est refuse',
  $q$ select public.mail_programmer('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001',
       'cave84@exemple.fr', ' ', '', null, now() + interval '1 hour') $q$, '23514');
select banc.refus('je ne peux pas ecrire dans la table',
  $q$ insert into public.mails_programmes (bureau, affaire_id, personne, partir_le)
      values ('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001', '75757575-7575-7575-7575-757575757575', now()) $q$, '42501');
select banc.ok('le bureau lit ses mails programmes', (select count(*) = 1 from public.mails_programmes));
select banc.qui('11111111-1111-1111-1111-111111111111');
select banc.refus('sans boite branchee, pas de mail programme',
  $q$ select public.mail_programmer('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001',
       'cave84@exemple.fr', 'A', 'B', null, now() + interval '1 hour') $q$, '23514');
reset role;
update public.boites set etat = 'reconnecter' where personne = '75757575-7575-7575-7575-757575757575';
set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select banc.refus('une boite a reconnecter ne programme pas',
  $q$ select public.mail_programmer('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001',
       'cave84@exemple.fr', 'A', 'B', null, now() + interval '1 hour') $q$, '23514');
reset role;
update public.boites set etat = 'branchee' where personne = '75757575-7575-7575-7575-757575757575';
set role authenticated;
select banc.qui('22222222-2222-2222-2222-222222222222');
select banc.ok('un autre bureau ne voit rien', (select count(*) = 0 from public.mails_programmes));
select banc.refus('un autre bureau ne programme pas chez moi',
  $q$ select public.mail_programmer('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001',
       'cave84@exemple.fr', 'A', 'B', null, now() + interval '1 hour') $q$, '42501');
reset role;

-- ------------------------------------------------ 3. annuler
set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select public.mail_programmer('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001',
  'cave84@exemple.fr', 'A annuler', 'X', null, now() + interval '2 hours');
select banc.ok('celui qui l a programme l annule',
  public.mail_annuler('b1000000-0000-0000-0000-000000000001', (select mail_id from public.mails_programmes where sujet = 'A annuler')));
select banc.ok('annuler deux fois ne fait rien',
  not public.mail_annuler('b1000000-0000-0000-0000-000000000001', (select mail_id from public.mails_programmes where sujet = 'A annuler')));
select banc.ok('je le retire de l ecran',
  public.mail_retirer('b1000000-0000-0000-0000-000000000001', (select mail_id from public.mails_programmes where sujet = 'A annuler')));
reset role;

-- ------------------------------------------------ 4. l'horloge : prendre, envoyer, noter
-- Le mail « Relance » est avance dans le passe pour etre du.
update public.mails_programmes set partir_le = now() - interval '1 minute' where sujet = 'Relance';
set role authenticated;
select banc.refus('un compte connecte ne prend pas les mails a partir',
  $q$ select * from public.mails_a_partir(10) $q$, '42501');
select banc.refus('un compte connecte ne dit pas le resultat',
  $q$ select public.mail_resultat('b1000000-0000-0000-0000-000000000001', gen_random_uuid(), 'parti') $q$, '42501');
reset role;
set role service_role;
select banc.ok('l horloge prend le mail du', (select count(*) = 1 and bool_and(sujet = 'Relance') from public.mails_a_partir(10)));
select banc.ok('un second passage ne le reprend pas', (select count(*) = 0 from public.mails_a_partir(10)));
reset role;
select banc.ok('il est en envoi', (select statut = 'envoi' from public.mails_programmes where sujet = 'Relance'));
set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select banc.ok('un mail en envoi ne s annule plus',
  not public.mail_annuler('b1000000-0000-0000-0000-000000000001', (select mail_id from public.mails_programmes where sujet = 'Relance')));
reset role;
set role service_role;
select banc.ok('parti : le resultat est note',
  public.mail_resultat('b1000000-0000-0000-0000-000000000001', (select mail_id from public.mails_programmes where sujet = 'Relance'), 'parti'));
select banc.ok('dire deux fois le resultat ne fait rien',
  not public.mail_resultat('b1000000-0000-0000-0000-000000000001', (select mail_id from public.mails_programmes where sujet = 'Relance'), 'parti'));
reset role;
select banc.ok('il entre dans le journal de l affaire, signe par celui qui l a programme',
  (select count(*) = 1 from public.affaire_echanges where sujet = 'Relance' and type = 'email' and modele = 'relance_devis'
      and cree_par = '75757575-7575-7575-7575-757575757575' and destinataire = 'cave84@exemple.fr'));
select banc.ok('et il pose le rappel de l affaire',
  (select rappel = current_date + 7 and rappel_titre = 'Relancer' from public.affaires where affaire_id = 'c8400000-0000-0000-0000-000000000001'));
select banc.ok('statut parti', (select statut = 'parti' and fini_le is not null from public.mails_programmes where sujet = 'Relance'));

-- Un echec, et un envoi bloque devenu incertain.
set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select public.mail_programmer('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001',
  'cave84@exemple.fr', 'Echec', 'X', null, now() + interval '1 hour');
select public.mail_programmer('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000001',
  'cave84@exemple.fr', 'Bloque', 'X', null, now() + interval '1 hour');
reset role;
update public.mails_programmes set partir_le = now() - interval '1 minute' where sujet in ('Echec', 'Bloque');
set role service_role;
select count(*) from public.mails_a_partir(10);
select public.mail_resultat('b1000000-0000-0000-0000-000000000001', (select mail_id from public.mails_programmes where sujet = 'Echec'), 'echec', 'Ta boîte demande à être rebranchée.');
reset role;
select banc.ok('un echec garde son motif et n entre pas au journal',
  (select statut = 'echec' and echec like 'Ta bo%' from public.mails_programmes where sujet = 'Echec')
  and not exists (select 1 from public.affaire_echanges where sujet = 'Echec'));
update public.mails_programmes set envoi_le = now() - interval '20 minutes' where sujet = 'Bloque';
set role service_role;
select count(*) from public.mails_a_partir(10);
reset role;
select banc.ok('bloque en envoi 15 min : incertain, jamais renvoye',
  (select statut = 'incertain' from public.mails_programmes where sujet = 'Bloque'));
-- La page rgpd promet : parti, annule ou pas parti, la ligne s'en va trente jours plus tard.
update public.mails_programmes set fini_le = now() - interval '31 days' where sujet in ('Echec', 'Bloque');
set role service_role;
select count(*) from public.mails_a_partir(10);
reset role;
select banc.ok('echec et incertain effaces trente jours apres (promesse rgpd)',
  not exists (select 1 from public.mails_programmes where sujet in ('Echec', 'Bloque')));

-- ------------------------------------------------ 5. l'opposition
set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select public.mail_programmer('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000002',
  'oppo@exemple.fr', 'Avant opposition', 'X', null, now() + interval '1 hour');
reset role;
update public.pistes set opposition = true where piste_id = '98400000-0000-0000-0000-000000000002';
select banc.ok('l opposition annule le mail prevu et efface son contenu',
  (select statut = 'annule' and sujet is null and corps is null and destinataire is null
     from public.mails_programmes where affaire_id = 'c8400000-0000-0000-0000-000000000002'));
set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select banc.refus('plus rien ne se programme pour une personne en opposition',
  $q$ select public.mail_programmer('b1000000-0000-0000-0000-000000000001', 'c8400000-0000-0000-0000-000000000002',
       'oppo@exemple.fr', 'A', 'B', null, now() + interval '1 hour') $q$, '42501');
reset role;

-- ------------------------------------------------ 6. les droits
select banc.ok('anon ne lit pas la table', not has_table_privilege('anon', 'public.mails_programmes', 'select'));
select banc.ok('connecte : lecture seule',
  has_table_privilege('authenticated', 'public.mails_programmes', 'select')
  and not has_table_privilege('authenticated', 'public.mails_programmes', 'insert')
  and not has_table_privilege('authenticated', 'public.mails_programmes', 'update')
  and not has_table_privilege('authenticated', 'public.mails_programmes', 'delete'));
select banc.ok('l horloge : cle de service seule',
  not has_function_privilege('authenticated', 'public.mails_a_partir(integer)', 'execute')
  and not has_function_privilege('anon', 'public.mails_a_partir(integer)', 'execute')
  and not has_function_privilege('anon', 'public.mail_resultat(uuid, uuid, text, text)', 'execute')
  and has_function_privilege('service_role', 'public.mails_a_partir(integer)', 'execute'));
select banc.ok('anon ne programme pas',
  not has_function_privilege('anon', 'public.mail_programmer(uuid, uuid, text, text, text, text, timestamptz, date, text)', 'execute'));

\o
\pset tuples_only on
select 'BANC DU LOT 84 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' from banc.resultats;
