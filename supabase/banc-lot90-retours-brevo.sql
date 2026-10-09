-- ===========================================================================
-- BANC DU LOT 90 (ce que Brevo renvoie), 09/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue tout le banc du lot 89, puis passe DEUX FOIS supabase/lot90-retours-brevo.sql.
--   psql -h /tmp -p 55490 -U postgres -d banc90 -v ON_ERROR_STOP=1 -f banc-lot90-retours-brevo.sql
-- Derniere ligne attendue : « BANC DU LOT 90 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot89-listes-brevo.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);
\ir lot90-retours-brevo.sql
\ir lot90-retours-brevo.sql
truncate banc.resultats;
-- Dans Supabase, service_role a tous les droits sur les tables de public ; le decor du banc non.
grant select on public.brevo, public.brevo_bloquees, public.suivi_accords, public.brevo_retours, public.brevo_envois to service_role;

-- Deux bureaux : 9001 (maitre 9001, simple 9002), 9003 seul dans le sien.
insert into auth.users (id, email) values
  ('90010000-0000-0000-0000-000000000001', 'maitre90@clos.fr'),
  ('90020000-0000-0000-0000-000000000002', 'simple90@clos.fr'),
  ('90030000-0000-0000-0000-000000000003', 'voisin90@clos.fr') on conflict do nothing;
insert into public.bureaux (bureau, nom) values
  ('b9000000-0000-0000-0000-000000000001', 'Clos 90'),
  ('b9000000-0000-0000-0000-000000000003', 'Voisin 90') on conflict do nothing;
insert into public.membres (bureau, personne, role) values
  ('b9000000-0000-0000-0000-000000000001', '90010000-0000-0000-0000-000000000001', 'maitre'),
  ('b9000000-0000-0000-0000-000000000001', '90020000-0000-0000-0000-000000000002', 'simple'),
  ('b9000000-0000-0000-0000-000000000003', '90030000-0000-0000-0000-000000000003', 'maitre') on conflict do nothing;

-- Les empreintes : celles que la fonction Edge et le navigateur calculent.
create or replace function pg_temp.emp(b text, a text) returns text language sql immutable as
  $$ select encode(sha256(convert_to(b || ':' || lower(btrim(a)), 'UTF8')), 'hex') $$;
\set B '''b9000000-0000-0000-0000-000000000001'''
\set V '''b9000000-0000-0000-0000-000000000003'''

set role service_role;
select banc.ok('Brevo pas branche : un evenement est inconnu (Brevo retire)',
  public.brevo_retour_noter(:B, 'm1', pg_temp.emp(:B, 'cave@x.fr'), 'transactionnel', 'morte', now()) = 'inconnu');
select public.brevo_ranger('90010000-0000-0000-0000-000000000001', :B, 'xkeysib-eeeeeeeeeeeeeeeeeeeeeeee-9090', 'contact@clos.fr', 'Clos');
select public.brevo_ranger('90030000-0000-0000-0000-000000000003', :V, 'xkeysib-ffffffffffffffffffffffff-9393', 'v@v.fr', 'V');
select banc.refus('une empreinte qui n en est pas une est refusee',
  $q$ select public.brevo_retour_noter('b9000000-0000-0000-0000-000000000001', 'm1', 'cave@x.fr', 'transactionnel', 'morte', now()) $q$, '22023');
select banc.refus('un evenement inconnu est refuse',
  $q$ select public.brevo_retour_noter('b9000000-0000-0000-0000-000000000001', 'm1', repeat('a', 64), 'transactionnel', 'livre', now()) $q$, '22023');
select banc.refus('une empreinte de jeton qui n en est pas une est refusee',
  $q$ select public.brevo_retours_poser('b9000000-0000-0000-0000-000000000001', 'jeton-en-clair') $q$, '22023');
select public.brevo_retours_poser(:B, repeat('c', 64));
select banc.ok('webhooks poses : branches, l empreinte du jeton se relit',
  public.brevo_retours_jeton(:B) = repeat('c', 64) and (select retours_etat = 'branches' from public.brevo where bureau = :B));
select public.brevo_retours_poser(:V, null);
select banc.ok('un echec se dit, sans jeton', public.brevo_retours_jeton(:V) is null
  and (select retours_etat = 'echec' from public.brevo where bureau = :V));

-- Un mail parti vers cave@x.fr (message m1), avec son empreinte.
select public.brevo_envoi_permis('90020000-0000-0000-0000-000000000002', :B, 'affaires', pg_temp.emp(:B, 'cave@x.fr')) as envoi \gset
select public.brevo_envoi_noter(:'envoi', '<m1@smtp-relay.mailin.fr>');
select banc.ok('l ancien appel a 3 arguments marche encore (mails-programmes avant redeploiement)',
  public.brevo_envoi_permis(p_personne => '90020000-0000-0000-0000-000000000002', p_bureau => :B, p_sorte => 'programmes') is not null);
select banc.refus('une empreinte de destinataire invalide est refusee',
  $q$ select public.brevo_envoi_permis('90020000-0000-0000-0000-000000000002', 'b9000000-0000-0000-0000-000000000001', 'affaires', 'CAVE') $q$, '22023');

-- Pas d'accord : l'ouverture n'est pas notee.
select banc.ok('ouvert sans accord du client : ignore',
  public.brevo_retour_noter(:B, '<m1@smtp-relay.mailin.fr>', pg_temp.emp(:B, 'cave@x.fr'), 'transactionnel', 'ouvert', now()) = 'ignore');
select banc.ok('rien n est garde de cette ouverture', not exists (select 1 from public.brevo_retours where envoi = :'envoi'));
reset role;

-- L'accord, par un membre.
set role authenticated;
select banc.qui('90030000-0000-0000-0000-000000000003');
select banc.refus('hors du bureau : pas d accord possible',
  $q$ select public.suivi_accorder('b9000000-0000-0000-0000-000000000001', repeat('a', 64), true) $q$, '42501');
select banc.qui('90020000-0000-0000-0000-000000000002');
select banc.refus('une adresse en clair n est pas une empreinte',
  $q$ select public.suivi_accorder('b9000000-0000-0000-0000-000000000001', 'cave@x.fr', true) $q$, '22023');
select banc.refus('ni oui ni non : refuse',
  $q$ select public.suivi_accorder('b9000000-0000-0000-0000-000000000001', repeat('a', 64), null) $q$, '22023');
select public.suivi_accorder(:B, pg_temp.emp(:B, 'cave@x.fr'), true);
select public.suivi_accorder(:B, pg_temp.emp(:B, 'cave@x.fr'), true);
select banc.ok('l accord est date et signe, une seule fois',
  (select count(*) = 1 and bool_and(par = '90020000-0000-0000-0000-000000000002') from public.suivi_accords));
reset role;

set role service_role;
select banc.ok('avec accord : la premiere ouverture est notee',
  public.brevo_retour_noter(:B, '<m1@smtp-relay.mailin.fr>', pg_temp.emp(:B, 'cave@x.fr'), 'transactionnel', 'ouvert', now() - interval '2 hours') = 'note');
select public.brevo_retour_noter(:B, '<m1@smtp-relay.mailin.fr>', pg_temp.emp(:B, 'cave@x.fr'), 'transactionnel', 'ouvert', now());
select banc.ok('une deuxieme ouverture ne change pas la premiere',
  (select count(*) = 1 and min(le) < now() - interval '1 hour' from public.brevo_retours where envoi = :'envoi' and evenement = 'ouvert'));
reset role;
-- Meme si l'expediteur a lui-meme accepte le suivi, sa copie n'est pas le mail du client.
insert into public.suivi_accords (bureau, empreinte) values (:B, pg_temp.emp(:B, 'camila@clos.fr'));
set role service_role;
select banc.ok('la copie cachee a soi qui s ouvre ne compte pas',
  public.brevo_retour_noter(:B, '<m1@smtp-relay.mailin.fr>', pg_temp.emp(:B, 'camila@clos.fr'), 'transactionnel', 'clic', now()) = 'ignore'
  and not exists (select 1 from public.brevo_retours where envoi = :'envoi' and evenement = 'clic'));
select banc.ok('un mail d un autre bureau ne se rattache pas',
  public.brevo_retour_noter(:V, '<m1@smtp-relay.mailin.fr>', pg_temp.emp(:V, 'cave@x.fr'), 'transactionnel', 'clic', now()) = 'ignore');
select banc.ok('avec accord : le clic est note',
  public.brevo_retour_noter(:B, '<m1@smtp-relay.mailin.fr>', pg_temp.emp(:B, 'cave@x.fr'), 'transactionnel', 'clic', now() + interval '3 days') = 'note');
select banc.ok('une date dans le futur est ramenee a maintenant',
  (select le <= now() from public.brevo_retours where envoi = :'envoi' and evenement = 'clic'));

-- Les motifs marquent l'adresse.
select public.brevo_retour_noter(:B, null, pg_temp.emp(:B, 'promo@x.fr'), 'campagne', 'desinscrit', now() - interval '5 days');
select banc.ok('un desinscrit des campagnes n empeche pas un mail perso',
  (select bloque is null from public.brevo_destinataire(:B, pg_temp.emp(:B, 'promo@x.fr'))));
select public.brevo_retour_noter(:B, '<m9@x>', pg_temp.emp(:B, 'perso@x.fr'), 'transactionnel', 'desinscrit', now());
select banc.ok('un desinscrit des mails 1 a 1 : retenu',
  (select bloque = 'desinscrit' from public.brevo_destinataire(:B, pg_temp.emp(:B, 'perso@x.fr'))));
select public.brevo_retour_noter(:B, '<m1@smtp-relay.mailin.fr>', pg_temp.emp(:B, 'cave@x.fr'), 'transactionnel', 'morte', now());
select banc.ok('une adresse morte : retenue, et le mail porte le rejet',
  (select bloque = 'morte' and suivi from public.brevo_destinataire(:B, pg_temp.emp(:B, 'cave@x.fr')))
  and exists (select 1 from public.brevo_retours where envoi = :'envoi' and evenement = 'morte'));
select public.brevo_retour_noter(:B, null, pg_temp.emp(:B, 'promo@x.fr'), 'campagne', 'spam', now());
select public.brevo_retour_noter(:B, null, pg_temp.emp(:B, 'promo@x.fr'), 'campagne', 'desinscrit', now());
select banc.ok('un spam ne redevient pas une simple desinscription',
  (select motif = 'spam' from public.brevo_bloquees where bureau = :B and empreinte = pg_temp.emp(:B, 'promo@x.fr')));
select banc.ok('un spam des campagnes retient aussi le mail perso',
  (select bloque = 'spam' from public.brevo_destinataire(:B, pg_temp.emp(:B, 'promo@x.fr'))));
select banc.ok('la date du premier blocage reste',
  (select depuis < now() - interval '4 days' from public.brevo_bloquees where bureau = :B and empreinte = pg_temp.emp(:B, 'promo@x.fr')));
select banc.ok('une adresse inconnue : rien de retenu, pas d accord',
  (select bloque is null and not suivi from public.brevo_destinataire(:B, pg_temp.emp(:B, 'neuf@x.fr'))));

-- Le rattrapage remplace une source entiere.
select banc.refus('une ligne de rattrapage invalide est refusee',
  $q$ select public.brevo_bloquees_remplacer('b9000000-0000-0000-0000-000000000001', 'transactionnel', '[{"e":"x","m":"morte"}]') $q$, '22023');
select public.brevo_bloquees_remplacer(:B, 'transactionnel', jsonb_build_array(
  jsonb_build_object('e', pg_temp.emp(:B, 'cave@x.fr'), 'm', 'morte', 'd', '2026-01-02T10:00:00Z'),
  jsonb_build_object('e', pg_temp.emp(:B, 'vieux@x.fr'), 'm', 'desinscrit', 'd', null),
  jsonb_build_object('e', pg_temp.emp(:B, 'vieux@x.fr'), 'm', 'spam', 'd', '2025-05-05T00:00:00Z')));
select banc.ok('rattrapage : une adresse debloquee chez Brevo part (le client s est reinscrit)',
  not exists (select 1 from public.brevo_bloquees where bureau = :B and empreinte = pg_temp.emp(:B, 'perso@x.fr')));
select banc.ok('rattrapage : l historique entre, le motif le plus grave l emporte',
  (select motif = 'spam' and depuis = '2025-05-05T00:00:00Z' from public.brevo_bloquees where bureau = :B and empreinte = pg_temp.emp(:B, 'vieux@x.fr')));
select banc.ok('rattrapage : l autre source n est pas touchee',
  exists (select 1 from public.brevo_bloquees where bureau = :B and source = 'campagne' and empreinte = pg_temp.emp(:B, 'promo@x.fr')));
select banc.ok('rattrapage : date notee', (select rattrape_le is not null from public.brevo where bureau = :B));
select public.brevo_bloquees_remplacer(:B, 'transactionnel', '[]'::jsonb);
select banc.ok('rattrapage vide : plus rien pour cette source',
  not exists (select 1 from public.brevo_bloquees where bureau = :B and source = 'transactionnel'));
reset role;

-- Lire depuis le bureau.
set role authenticated;
select banc.qui('90020000-0000-0000-0000-000000000002');
select banc.ok('le bureau lit ses adresses bloquees', (select count(*) >= 1 from public.brevo_bloquees));
select banc.ok('il lit l etat des webhooks', (select retours_etat = 'branches' from public.brevo where bureau = :B));
select banc.ok('le suivi : le mail, son ouverture, son clic, son rejet',
  (select count(*) filter (where evenement in ('ouvert', 'clic', 'morte')) = 3
     from public.brevo_suivi(:B, array[pg_temp.emp(:B, 'cave@x.fr')])));
select public.suivi_accorder(:B, pg_temp.emp(:B, 'cave@x.fr'), false);
select banc.ok('accord retire : ouverture et clic disparaissent aussitot, le rejet reste',
  (select count(*) filter (where evenement in ('ouvert', 'clic')) = 0 and count(*) filter (where evenement = 'morte') = 1
     from public.brevo_suivi(:B, array[pg_temp.emp(:B, 'cave@x.fr')])));
select banc.refus('plus de 20 adresses d un coup : refuse',
  $q$ select * from public.brevo_suivi('b9000000-0000-0000-0000-000000000001', array_fill(repeat('a', 64), array[21])) $q$, '22023');
select banc.qui('90030000-0000-0000-0000-000000000003');
select banc.ok('le voisin ne voit rien du bureau', not exists (select 1 from public.brevo_bloquees where bureau = :B)
  and not exists (select 1 from public.suivi_accords where bureau = :B));
select banc.refus('le voisin ne lit pas le suivi',
  $q$ select * from public.brevo_suivi('b9000000-0000-0000-0000-000000000001', array[repeat('a', 64)]) $q$, '42501');
select banc.refus('un connecte ne note pas de retour',
  $q$ select public.brevo_retour_noter('b9000000-0000-0000-0000-000000000001', 'm', repeat('a', 64), 'campagne', 'spam', now()) $q$, '42501');
select banc.refus('un connecte ne lit pas le jeton',
  $q$ select public.brevo_retours_jeton('b9000000-0000-0000-0000-000000000001') $q$, '42501');
select banc.refus('un connecte ne remplace pas la liste',
  $q$ select public.brevo_bloquees_remplacer('b9000000-0000-0000-0000-000000000001', 'campagne', '[]') $q$, '42501');
select banc.refus('un connecte ne lit pas l empreinte du jeton dans la table',
  $q$ select retours_jeton from public.brevo $q$, '42501');
select banc.refus('un connecte n ecrit pas dans les adresses bloquees',
  $q$ delete from public.brevo_bloquees $q$, '42501');
select banc.refus('un connecte ne lit pas les retours bruts',
  $q$ select * from public.brevo_retours $q$, '42501');
reset role;

-- Ni adresse ni texte nulle part.
select banc.ok('aucune colonne d adresse dans les tables du lot',
  not exists (select 1 from information_schema.columns where table_name in ('brevo_bloquees', 'suivi_accords', 'brevo_retours', 'brevo_envois')
    and column_name in ('email', 'adresse', 'destinataire', 'sujet', 'texte')));
-- 90 jours, puis effacement (le mail emporte ses retours).
update public.brevo_envois set le = now() - interval '91 days' where id = :'envoi';
set role service_role;
select public.brevo_envoi_permis('90020000-0000-0000-0000-000000000002', :B, 'affaires', null);
reset role;
select banc.ok('apres 90 jours, le mail et ses retours s effacent',
  not exists (select 1 from public.brevo_envois where id = :'envoi') and not exists (select 1 from public.brevo_retours where envoi = :'envoi'));
-- Retirer Brevo efface les adresses bloquees ; l'accord du client reste (c'est le sien).
set role authenticated;
select banc.qui('90010000-0000-0000-0000-000000000001');
select public.suivi_accorder(:B, pg_temp.emp(:B, 'cave@x.fr'), true);
select public.brevo_retirer(:B);
reset role;
select banc.ok('Brevo retire : plus d adresses bloquees', not exists (select 1 from public.brevo_bloquees where bureau = :B));
select banc.ok('Brevo retire : l accord du client reste', exists (select 1 from public.suivi_accords where bureau = :B));
delete from public.bureaux where bureau = :B;
select banc.ok('le bureau supprime emporte les accords', not exists (select 1 from public.suivi_accords where bureau = :B));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 90 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select nom, detail from banc.resultats where not ok;
