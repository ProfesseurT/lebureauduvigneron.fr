-- ===========================================================================
-- BANC DU LOT 56 (affaires et pistes durcies), 01/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 55 (qui rejoue 54 a 47, puis les lots 30, 34, 35,
-- 38 et 39 sur le decor de Supabase), passe DEUX FOIS supabase/lot56-affaires-durcies.sql,
-- puis verifie ce que le lot promet. Un bureau neuf (B6), un maitre (U6) et un SIMPLE
-- utilisateur (U7) : c'est lui qui joue les gestes, parce que c'est lui que le lot borne.
--   psql -h /tmp -p 55456 -d banc56 -v ON_ERROR_STOP=1 -f banc-lot56-affaires-durcies.sql
-- Derniere ligne attendue : « BANC DU LOT 56 : N controles, 0 echec ».
-- La course a deux sessions passe par dblink (extension livree avec PostgreSQL).
-- ===========================================================================
\ir banc-lot55-signature.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);
-- T3 (tour 3) : DES DONNEES D'AVANT LE LOT. Une piste deja en opposition sous l'ancien
-- declencheur (lot 34 : il ne connaissait ni l'adresse ni le code postal) garde son adresse,
-- son code postal et les notes de son affaire ; une piste voisine NON opposee garde les siens.
insert into public.bureaux (bureau, nom) values ('b9000000-0000-0000-0000-000000000009', 'Domaine Neuf');
insert into public.affaire_types (bureau, type_id, nom) values
  ('b9000000-0000-0000-0000-000000000009', 'a9000000-0000-0000-0000-000000000001', 'Caviste');
insert into public.affaire_etapes (bureau, etape_id, type_id, nom, ordre) values
  ('b9000000-0000-0000-0000-000000000009', 'e9000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000001', 'Contact', 1);
insert into public.pistes (bureau, piste_id, nom, adresse, code_postal, ville) values
  ('b9000000-0000-0000-0000-000000000009', '99000000-0000-0000-0000-000000000001', 'Ancienne Opposee', '3 rue Halles', '44000', 'Nantes'),
  ('b9000000-0000-0000-0000-000000000009', '99000000-0000-0000-0000-000000000002', 'Voisine Joignable', '5 rue Neuve', '44100', 'Nantes');
insert into public.affaires (bureau, affaire_id, type_id, etape_id, piste_id, titre, notes) values
  ('b9000000-0000-0000-0000-000000000009', 'c9000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000001',
   'e9000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000001', 'Ancienne', 'note ancienne'),
  ('b9000000-0000-0000-0000-000000000009', 'c9000000-0000-0000-0000-000000000002', 'a9000000-0000-0000-0000-000000000001',
   'e9000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000002', 'Voisine', 'note voisine');
update public.pistes set opposition = true where piste_id = '99000000-0000-0000-0000-000000000001';
create temp table t3_avant as
  select (select adresse is not null and code_postal is not null from public.pistes where piste_id = '99000000-0000-0000-0000-000000000001')
     and (select notes is not null from public.affaires where affaire_id = 'c9000000-0000-0000-0000-000000000001') as decor_vrai;
\ir lot56-affaires-durcies.sql
\ir lot56-affaires-durcies.sql
create extension if not exists dblink;
truncate banc.resultats;
select banc.ok('T3 : le decor est vrai (avant le lot, l ancienne opposition garde adresse, CP et notes)',
  (select decor_vrai from t3_avant));
select banc.ok('T3 : le lot efface l adresse et le code postal d une opposition anterieure',
  (select adresse is null and code_postal is null from public.pistes where piste_id = '99000000-0000-0000-0000-000000000001'));
select banc.ok('T3 : et les notes de son affaire',
  (select notes is null from public.affaires where affaire_id = 'c9000000-0000-0000-0000-000000000001'));
select banc.ok('T3 : nom, ville et opposition gardes',
  (select nom = 'Ancienne Opposee' and ville = 'Nantes' and opposition from public.pistes where piste_id = '99000000-0000-0000-0000-000000000001'));
select banc.ok('T3 : une piste NON opposee garde adresse, code postal et notes',
  (select adresse = '5 rue Neuve' and code_postal = '44100' from public.pistes where piste_id = '99000000-0000-0000-0000-000000000002')
  and (select notes = 'note voisine' from public.affaires where affaire_id = 'c9000000-0000-0000-0000-000000000002'));

-- ---------------------------------------------------------------------------
-- 0. LE DECOR : B6 (U6 maitre, U7 simple), B7 qu'on supprimera, B8 pour le SIRET
-- ---------------------------------------------------------------------------
insert into auth.users values
  ('66666666-6666-6666-6666-666666666666', 'u6@x.fr'),
  ('77777777-7777-7777-7777-777777777777', 'u7@x.fr')
  on conflict do nothing;
insert into public.bureaux (bureau, nom) values
  ('b6000000-0000-0000-0000-000000000006', 'Domaine Six'),
  ('b7000000-0000-0000-0000-000000000007', 'Domaine Sept'),
  ('b8000000-0000-0000-0000-000000000008', 'Domaine Huit');
insert into public.membres values
  ('b6000000-0000-0000-0000-000000000006', '66666666-6666-6666-6666-666666666666', 'maitre'),
  ('b6000000-0000-0000-0000-000000000006', '77777777-7777-7777-7777-777777777777', 'simple'),
  ('b7000000-0000-0000-0000-000000000007', '77777777-7777-7777-7777-777777777777', 'simple'),
  ('b8000000-0000-0000-0000-000000000008', '77777777-7777-7777-7777-777777777777', 'simple');
insert into public.domaine (bureau, raison_sociale, forme_juridique, siret, siren, tva, adresse,
  code_postal, ville, email, paiement_mode, paiement_jours, validite_jours) values
  ('b6000000-0000-0000-0000-000000000006', 'EARL Domaine Six', 'EARL', '12345678900011', '123456789',
   'FR12123456789', '6 route des Vignes', '44330', 'Vallet', 'contact@six.fr', 'fdm', 30, 30),
  ('b7000000-0000-0000-0000-000000000007', 'Domaine Sept', null, null, null, null, null, null, null,
   null, 'fdm', 30, 30);
insert into public.affaire_types (bureau, type_id, nom) values
  ('b6000000-0000-0000-0000-000000000006', 'a6000000-0000-0000-0000-000000000001', 'Caviste'),
  ('b6000000-0000-0000-0000-000000000006', 'a6000000-0000-0000-0000-000000000002', 'Mariage'),
  ('b6000000-0000-0000-0000-000000000006', 'a6000000-0000-0000-0000-000000000003', 'Course'),
  ('b7000000-0000-0000-0000-000000000007', 'a7000000-0000-0000-0000-000000000001', 'Caviste');
insert into public.affaire_etapes (bureau, etape_id, type_id, nom, ordre) values
  ('b6000000-0000-0000-0000-000000000006', 'e6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'Contact', 1),
  ('b6000000-0000-0000-0000-000000000006', 'e6000000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000002', 'Contact', 1),
  ('b6000000-0000-0000-0000-000000000006', 'e6000000-0000-0000-0000-000000000099', 'a6000000-0000-0000-0000-000000000001', 'Vide', 9),
  ('b7000000-0000-0000-0000-000000000007', 'e7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'Contact', 1);
-- Le type « Course » porte cinq etapes : la sixieme se dispute a deux sessions.
insert into public.affaire_etapes (bureau, type_id, nom, ordre)
  select 'b6000000-0000-0000-0000-000000000006', 'a6000000-0000-0000-0000-000000000003', 'C' || g, g
    from generate_series(1, 5) g;
insert into public.pistes (bureau, piste_id, nom, contact_nom, contact_fonction, email, telephone,
  adresse, code_postal, ville, siret, notes) values
  ('b6000000-0000-0000-0000-000000000006', '96000000-0000-0000-0000-000000000001', 'Cave Opposee',
   'Jean Lebon', 'Gerant', 'jean@cave.fr', '0600000000', '3 rue du Port', '44000', 'Nantes',
   '11122233300011', 'Prefere le blanc'),
  ('b6000000-0000-0000-0000-000000000006', '96000000-0000-0000-0000-000000000002', 'Autre Piste',
   null, null, 'autre@x.fr', null, null, null, null, null, null),
  ('b7000000-0000-0000-0000-000000000007', '97000000-0000-0000-0000-000000000001', 'Piste Sept',
   null, null, null, null, null, null, null, null, null);
insert into public.affaires (bureau, affaire_id, type_id, etape_id, piste_id, titre, notes) values
  ('b6000000-0000-0000-0000-000000000006', 'c6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', 'Premiere commande', 'Rappeler sa femme le soir'),
  ('b6000000-0000-0000-0000-000000000006', 'c6000000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000002', 'Autre', 'Note qui reste'),
  ('b7000000-0000-0000-0000-000000000007', 'c7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000001', 'Sept', null);

-- ---------------------------------------------------------------------------
-- 1. LES DROITS
-- ---------------------------------------------------------------------------
select banc.ok('authenticated n a plus DELETE sur affaires, pistes, domaine',
  not has_table_privilege('authenticated', 'public.affaires', 'delete')
  and not has_table_privilege('authenticated', 'public.pistes', 'delete')
  and not has_table_privilege('authenticated', 'public.domaine', 'delete'));
select banc.ok('aucune politique de suppression sur ces trois tables',
  not exists (select 1 from pg_policies where schemaname = 'public'
               and tablename in ('affaires', 'pistes', 'domaine') and cmd = 'DELETE'));
select banc.ok('les etapes gardent leur DELETE (l ecran retire une etape vide)',
  has_table_privilege('authenticated', 'public.affaire_etapes', 'delete')
  and exists (select 1 from pg_policies where tablename = 'affaire_etapes' and cmd = 'DELETE'));
select banc.ok('les trois autres droits du bureau restent',
  has_table_privilege('authenticated', 'public.affaires', 'select')
  and has_table_privilege('authenticated', 'public.affaires', 'insert')
  and has_table_privilege('authenticated', 'public.affaires', 'update')
  and has_table_privilege('authenticated', 'public.pistes', 'update')
  and has_table_privilege('authenticated', 'public.domaine', 'update'));
select banc.ok('anon n a toujours rien',
  not has_table_privilege('anon', 'public.affaires', 'select')
  and not has_table_privilege('anon', 'public.pistes', 'delete'));
select banc.ok('les fonctions du lot ne s appellent pas du navigateur',
  not has_function_privilege('authenticated', 'public.pistes_purger()', 'execute')
  and not has_function_privilege('anon', 'public.pistes_purger()', 'execute')
  and not has_function_privilege('authenticated', 'public.pistes_opposition_affaires()', 'execute')
  and not has_function_privilege('authenticated', 'public.affaire_etapes_plafond()', 'execute')
  and not has_function_privilege('authenticated', 'public.pistes_signer()', 'execute'));

-- ---------------------------------------------------------------------------
-- 2. LES GESTES DU SIMPLE UTILISATEUR
-- ---------------------------------------------------------------------------
set role authenticated;
select banc.qui('77777777-7777-7777-7777-777777777777');

select banc.refus('supprimer une affaire : refuse',
  $q$ delete from public.affaires where affaire_id = 'c6000000-0000-0000-0000-000000000002' $q$, '42501');
select banc.refus('supprimer une piste : refuse',
  $q$ delete from public.pistes where piste_id = '96000000-0000-0000-0000-000000000002' $q$, '42501');
select banc.refus('supprimer la fiche du domaine : refuse',
  $q$ delete from public.domaine where bureau = 'b6000000-0000-0000-0000-000000000006' $q$, '42501');
with d as (delete from public.affaire_etapes where etape_id = 'e6000000-0000-0000-0000-000000000099' returning 1)
select banc.ok('retirer une etape vide marche toujours', (select count(*) = 1 from d));

-- B1 : une etape ne change pas de type
select banc.refus('une etape ne change pas de type d affaire',
  $q$ update public.affaire_etapes set type_id = 'a6000000-0000-0000-0000-000000000002'
       where etape_id = 'e6000000-0000-0000-0000-000000000001' $q$, '23514');
with u as (update public.affaire_etapes set nom = 'Premier contact'
                where etape_id = 'e6000000-0000-0000-0000-000000000001' returning 1)
select banc.ok('renommer une etape marche toujours', (select count(*) = 1 from u));
with u as (update public.affaires set titre = 'Premiere commande, bis'
                where affaire_id = 'c6000000-0000-0000-0000-000000000002' returning 1)
select banc.ok('l affaire reste modifiable apres le refus', (select count(*) = 1 from u));
select banc.refus('sept etapes d un coup : refuse',
  $q$ insert into public.affaire_etapes (bureau, type_id, nom, ordre)
      select 'b6000000-0000-0000-0000-000000000006', 'a6000000-0000-0000-0000-000000000002', 'E' || g, g
        from generate_series(2, 7) g $q$, '23514');

-- Cosmetiques : un client vide, une affaire perdue sans motif
select banc.refus('un client vide est refuse',
  $q$ insert into public.affaires (bureau, type_id, etape_id, client_id, titre)
      values ('b6000000-0000-0000-0000-000000000006', 'a6000000-0000-0000-0000-000000000001',
              'e6000000-0000-0000-0000-000000000001', '  ', 'Vide') $q$, '23514');
select banc.refus('une affaire perdue sans motif est refusee',
  $q$ update public.affaires set issue = 'perdue', motif = null
       where affaire_id = 'c6000000-0000-0000-0000-000000000002' $q$, '23514');
with u as (update public.affaires set issue = 'perdue', motif = 'prix'
                where affaire_id = 'c6000000-0000-0000-0000-000000000002' returning 1)
select banc.ok('perdue avec le motif du menu : accepte', (select count(*) = 1 from u));
with u as (update public.affaires set issue = 'en_cours', motif = null
                where affaire_id = 'c6000000-0000-0000-0000-000000000002' returning issue)
select banc.ok('puis rouverte : le motif part avec', (select bool_and(issue = 'en_cours') from u));
reset role;
select banc.ok('les deux contraintes sont validees',
  (select bool_and(convalidated) and count(*) = 2 from pg_constraint
    where conname in ('affaires_client_non_vide', 'affaires_perdue_motif')));

-- ---------------------------------------------------------------------------
-- 3. L'OPPOSITION
-- ---------------------------------------------------------------------------
set role authenticated;
select banc.qui('77777777-7777-7777-7777-777777777777');
update public.pistes set opposition = true where piste_id = '96000000-0000-0000-0000-000000000001';
select banc.ok('opposition : contact, fonction, e-mail, telephone, notes effaces',
  (select contact_nom is null and contact_fonction is null and email is null and telephone is null and notes is null
     from public.pistes where piste_id = '96000000-0000-0000-0000-000000000001'));
select banc.ok('opposition : adresse et code postal effaces',
  (select adresse is null and code_postal is null from public.pistes where piste_id = '96000000-0000-0000-0000-000000000001'));
select banc.ok('opposition : nom, ville et SIRET gardes',
  (select nom = 'Cave Opposee' and ville = 'Nantes' and siret = '11122233300011'
     from public.pistes where piste_id = '96000000-0000-0000-0000-000000000001'));
select banc.ok('opposition : les notes de SES affaires effacees',
  (select notes is null from public.affaires where affaire_id = 'c6000000-0000-0000-0000-000000000001'));
select banc.ok('opposition : les notes des affaires d une AUTRE piste restent',
  (select notes = 'Note qui reste' from public.affaires where affaire_id = 'c6000000-0000-0000-0000-000000000002'));
update public.pistes set email = 're@x.fr', adresse = '4 rue', telephone = '0700000000'
 where piste_id = '96000000-0000-0000-0000-000000000001';
select banc.ok('apres l opposition, une coordonnee ressaisie ne s ecrit pas',
  (select email is null and adresse is null and telephone is null
     from public.pistes where piste_id = '96000000-0000-0000-0000-000000000001'));
select banc.refus('un compte connecte ne leve pas une opposition',
  $q$ update public.pistes set opposition = false where piste_id = '96000000-0000-0000-0000-000000000001' $q$, '42501');
select banc.qui('66666666-6666-6666-6666-666666666666');
select banc.refus('le maitre non plus',
  $q$ update public.pistes set opposition = false, email = 'retour@x.fr'
       where piste_id = '96000000-0000-0000-0000-000000000001' $q$, '42501');
reset role;
select banc.qui(null);
with u as (update public.pistes set opposition = false
                where piste_id = '96000000-0000-0000-0000-000000000001' returning opposition)
select banc.ok('Solumatic, hors session, peut la lever sur demande ecrite', (select bool_and(not opposition) from u));
update public.pistes set opposition = true where piste_id = '96000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- 4. LA PURGE A TROIS ANS
-- ---------------------------------------------------------------------------
insert into public.pistes (bureau, piste_id, nom, email, adresse, code_postal) values
  ('b6000000-0000-0000-0000-000000000006', '96000000-0000-0000-0000-0000000000a1', 'Adresse seule', null, '5 rue', '44100'),
  ('b6000000-0000-0000-0000-000000000006', '96000000-0000-0000-0000-0000000000a2', 'Notes d affaire seules', null, null, null),
  ('b6000000-0000-0000-0000-000000000006', '96000000-0000-0000-0000-0000000000a3', 'Gagnee', 'g@x.fr', '6 rue', null),
  ('b6000000-0000-0000-0000-000000000006', '96000000-0000-0000-0000-0000000000a4', 'En cours', 'c@x.fr', null, null),
  ('b6000000-0000-0000-0000-000000000006', '96000000-0000-0000-0000-0000000000a5', 'Recente', 'r@x.fr', null, null);
insert into public.affaires (bureau, affaire_id, type_id, etape_id, piste_id, titre, issue, motif, notes) values
  ('b6000000-0000-0000-0000-000000000006', 'c6000000-0000-0000-0000-0000000000a2', 'a6000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-0000000000a2', 'Perdue', 'perdue', 'prix', 'Son portable perso'),
  ('b6000000-0000-0000-0000-000000000006', 'c6000000-0000-0000-0000-0000000000a3', 'a6000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-0000000000a3', 'Gagnee', 'gagnee', null, 'Livrer le jeudi'),
  ('b6000000-0000-0000-0000-000000000006', 'c6000000-0000-0000-0000-0000000000a4', 'a6000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-0000000000a4', 'En cours', 'en_cours', null, null);
alter table public.pistes disable trigger user;
alter table public.affaires disable trigger user;
update public.pistes set maj_le = now() - interval '4 years'
 where piste_id in ('96000000-0000-0000-0000-0000000000a1', '96000000-0000-0000-0000-0000000000a2',
                    '96000000-0000-0000-0000-0000000000a3', '96000000-0000-0000-0000-0000000000a4');
update public.affaires set maj_le = now() - interval '4 years'
 where affaire_id in ('c6000000-0000-0000-0000-0000000000a2', 'c6000000-0000-0000-0000-0000000000a3',
                      'c6000000-0000-0000-0000-0000000000a4');
alter table public.pistes enable trigger user;
alter table public.affaires enable trigger user;
create temp table t_purge as select public.pistes_purger() as n;
select banc.ok('la purge prend exactement deux pistes', (select n = 2 from t_purge),
  'purgees : ' || (select n from t_purge));
select banc.ok('purge : une piste qui n a qu une adresse la perd, avec son code postal',
  (select adresse is null and code_postal is null and nom = 'Adresse seule'
     from public.pistes where piste_id = '96000000-0000-0000-0000-0000000000a1'));
select banc.ok('purge : les notes d une affaire perdue de la piste sont effacees',
  (select notes is null from public.affaires where affaire_id = 'c6000000-0000-0000-0000-0000000000a2'));
select banc.ok('purge : une piste GAGNEE garde ses coordonnees et ses notes',
  (select email = 'g@x.fr' and adresse = '6 rue' from public.pistes where piste_id = '96000000-0000-0000-0000-0000000000a3')
  and (select notes = 'Livrer le jeudi' from public.affaires where affaire_id = 'c6000000-0000-0000-0000-0000000000a3'));
select banc.ok('purge : une piste en cours et une piste recente ne bougent pas',
  (select count(*) = 2 from public.pistes
    where piste_id in ('96000000-0000-0000-0000-0000000000a4', '96000000-0000-0000-0000-0000000000a5')
      and email is not null));

-- ---------------------------------------------------------------------------
-- 5. UN SIRET, UNE PISTE
-- ---------------------------------------------------------------------------
set role authenticated;
select banc.qui('77777777-7777-7777-7777-777777777777');
select banc.refus('deux pistes au meme SIRET dans un bureau : refuse',
  $q$ insert into public.pistes (bureau, nom, siret) values
      ('b6000000-0000-0000-0000-000000000006', 'Doublon', '11122233300011') $q$, '23505');
with i as (insert into public.pistes (bureau, nom, siret) values
               ('b8000000-0000-0000-0000-000000000008', 'Ailleurs', '11122233300011') returning 1)
select banc.ok('le meme SIRET dans un autre bureau : accepte', (select count(*) = 1 from i));
with i as (insert into public.pistes (bureau, nom) values
               ('b6000000-0000-0000-0000-000000000006', 'Sans siret 1'),
               ('b6000000-0000-0000-0000-000000000006', 'Sans siret 2') returning 1)
select banc.ok('plusieurs pistes sans SIRET : accepte', (select count(*) = 2 from i));
reset role;
select banc.ok('l index simple du lot 39 est remplace par l index unique',
  exists (select 1 from pg_indexes where indexname = 'pistes_siret_unique')
  and not exists (select 1 from pg_indexes where indexname = 'pistes_siret'));

-- ---------------------------------------------------------------------------
-- 6. LE DEVIS QUI CLOT L'AFFAIRE MARCHE TOUJOURS (le motif « autre » par defaut)
-- ---------------------------------------------------------------------------
set role authenticated;
select banc.qui('77777777-7777-7777-7777-777777777777');
insert into public.affaires (bureau, affaire_id, type_id, etape_id, client_id, client_nom, titre) values
  ('b6000000-0000-0000-0000-000000000006', 'c6000000-0000-0000-0000-0000000000d1', 'a6000000-0000-0000-0000-000000000001',
   'e6000000-0000-0000-0000-000000000001', 'K6', 'Cave Six', 'Devis refuse');
create temp table t_d56 as select d.devis_id from
  public.devis_enregistrer('b6000000-0000-0000-0000-000000000006', 'c6000000-0000-0000-0000-0000000000d1', null,
    jsonb_build_array(banc.l(1000, 6))) d;
select public.devis_refuser('b6000000-0000-0000-0000-000000000006', (select devis_id from t_d56), null, true);
select banc.ok('un devis refuse sans motif clot l affaire en « autre »',
  (select issue = 'perdue' and motif = 'autre' from public.affaires where affaire_id = 'c6000000-0000-0000-0000-0000000000d1'));
reset role;

-- ---------------------------------------------------------------------------
-- 7. LA SUPPRESSION D'UN BUREAU EMPORTE TOUJOURS TOUT
-- ---------------------------------------------------------------------------
select banc.qui(null);
delete from public.bureaux where bureau = 'b7000000-0000-0000-0000-000000000007';
select banc.ok('la cascade d un bureau supprime vide affaires, pistes et domaine',
  not exists (select 1 from public.affaires where bureau = 'b7000000-0000-0000-0000-000000000007')
  and not exists (select 1 from public.pistes where bureau = 'b7000000-0000-0000-0000-000000000007')
  and not exists (select 1 from public.domaine where bureau = 'b7000000-0000-0000-0000-000000000007'));

-- ---------------------------------------------------------------------------
-- 8. LA COURSE : DEUX SESSIONS AJOUTENT CHACUNE LA SIXIEME ETAPE
-- ---------------------------------------------------------------------------
-- A pose la sixieme sans valider ; B tente la sienne. Avec le verrou, B ATTEND (elle est
-- encore occupee apres 300 ms), puis compte six une fois A validee, et elle est refusee.
create temp table t_course (cle text primary key, val text);
do $$
declare cs text := 'dbname=' || current_database() || ' host=' || current_setting('unix_socket_directories')
                   || ' port=' || current_setting('port') || ' user=' || current_user;
        prep text := $p$ begin; set local role authenticated;
                       set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777'; $p$;
        r int; e text;
begin
  perform dblink_connect('a56', cs);
  perform dblink_connect('b56', cs);
  perform dblink_exec('a56', prep);
  perform dblink_exec('a56', $q$ insert into public.affaire_etapes (bureau, type_id, nom, ordre) values
    ('b6000000-0000-0000-0000-000000000006', 'a6000000-0000-0000-0000-000000000003', 'Six A', 6) $q$);
  perform dblink_exec('b56', prep);
  perform dblink_send_query('b56', $q$ insert into public.affaire_etapes (bureau, type_id, nom, ordre) values
    ('b6000000-0000-0000-0000-000000000006', 'a6000000-0000-0000-0000-000000000003', 'Six B', 6) $q$);
  perform pg_sleep(0.3);
  insert into t_course values ('b_attend', dblink_is_busy('b56')::text);
  perform dblink_exec('a56', 'commit');
  perform * from dblink_get_result('b56', false) as x(t text);
  e := dblink_error_message('b56');
  perform * from dblink_get_result('b56', false) as x(t text);
  insert into t_course values ('b_erreur', e);
  perform dblink_exec('b56', 'rollback');
  perform dblink_disconnect('a56');
  perform dblink_disconnect('b56');
end $$;
select banc.ok('course : la seconde session attend le verrou du type',
  (select val = '1' from t_course where cle = 'b_attend'));
select banc.ok('course : la seconde est refusee par le plafond',
  (select val like '%six etapes%' from t_course where cle = 'b_erreur'),
  (select val from t_course where cle = 'b_erreur'));
select banc.ok('course : le type porte six etapes, pas sept',
  (select count(*) = 6 from public.affaire_etapes where type_id = 'a6000000-0000-0000-0000-000000000003'));

-- ---------------------------------------------------------------------------
-- 9. TOUR 2 (N3, N4) : UNE PERSONNE EN OPPOSITION NE SE RAPPELLE PLUS
-- ---------------------------------------------------------------------------
reset role;
select banc.qui(null);
insert into public.profils (id, email, bureau_courant, consent_courrier)
  select '77777777-7777-7777-7777-777777777777', 'u7@x.fr', 'b6000000-0000-0000-0000-000000000006', true
  where not exists (select 1 from public.profils where id = '77777777-7777-7777-7777-777777777777');
insert into public.reglages (bureau) select 'b6000000-0000-0000-0000-000000000006'
  where not exists (select 1 from public.reglages where bureau = 'b6000000-0000-0000-0000-000000000006');
insert into public.pistes (bureau, piste_id, nom, telephone) values
  ('b6000000-0000-0000-0000-000000000006', '96000000-0000-0000-0000-000000000009', 'Bistrot des Halles', '0611111111');
insert into public.affaires (bureau, affaire_id, type_id, etape_id, piste_id, titre, rappel, rappel_titre) values
  ('b6000000-0000-0000-0000-000000000006', 'c6000000-0000-0000-0000-000000000009', 'a6000000-0000-0000-0000-000000000001',
   'e6000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000009', 'Bistrot', current_date - 3, 'Le relancer'),
  ('b6000000-0000-0000-0000-000000000006', 'c6000000-0000-0000-0000-000000000008', 'a6000000-0000-0000-0000-000000000001',
   'e6000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000002', 'Autre a rappeler', current_date - 1, null);
set role authenticated;
select banc.qui('77777777-7777-7777-7777-777777777777');
select banc.ok('avant l opposition, le courrier porte ses deux affaires a rappeler',
  (select jsonb_array_length(affaires) = 2 from public.v_courrier where id = '77777777-7777-7777-7777-777777777777'));
update public.pistes set opposition = true where piste_id = '96000000-0000-0000-0000-000000000009';
select banc.ok('N4 : l opposition efface le rappel de son affaire en cours',
  (select rappel is null and rappel_titre is null from public.affaires where affaire_id = 'c6000000-0000-0000-0000-000000000009'));
select banc.ok('N4 : le rappel d une affaire d une AUTRE piste reste',
  (select rappel is not null from public.affaires where affaire_id = 'c6000000-0000-0000-0000-000000000008'));
select banc.ok('N4 : le courrier du matin ne porte plus que l autre affaire',
  (select jsonb_array_length(affaires) = 1 and affaires -> 0 ->> 'nom' = 'Autre Piste'
     from public.v_courrier where id = '77777777-7777-7777-7777-777777777777'));
select banc.refus('N4 : un rappel neuf sur son affaire est refuse',
  $q$ update public.affaires set rappel = current_date + 1
       where affaire_id = 'c6000000-0000-0000-0000-000000000009' $q$, '23514');
select banc.refus('N4 : une nouvelle affaire sur elle est refusee',
  $q$ insert into public.affaires (bureau, type_id, etape_id, piste_id, titre)
      values ('b6000000-0000-0000-0000-000000000006', 'a6000000-0000-0000-0000-000000000001',
              'e6000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000009', 'Encore') $q$, '23514');
select banc.refus('N4 : rattacher une autre affaire a elle est refuse',
  $q$ update public.affaires set piste_id = '96000000-0000-0000-0000-000000000009'
       where affaire_id = 'c6000000-0000-0000-0000-000000000008' $q$, '23514');
with u as (update public.affaires set titre = 'Bistrot, note'
                where affaire_id = 'c6000000-0000-0000-0000-000000000009' returning 1)
select banc.ok('N4 : son affaire reste modifiable (titre)', (select count(*) = 1 from u));
with u as (update public.affaires set issue = 'perdue', motif = 'autre'
                where affaire_id = 'c6000000-0000-0000-0000-000000000009' returning issue)
select banc.ok('N4 : et se classe « Pas pour cette fois »', (select bool_and(issue = 'perdue') from u));
select banc.refus('T5 : classee, son affaire ne se rouvre pas',
  $q$ update public.affaires set issue = 'en_cours', motif = null
       where affaire_id = 'c6000000-0000-0000-0000-000000000009' $q$, '23514');
select banc.refus('N3 : une piste au meme nom (casse et espaces mis a part) est refusee',
  $q$ insert into public.pistes (bureau, nom) values ('b6000000-0000-0000-0000-000000000006', '  bistrot   DES halles ') $q$, '23514');
select banc.refus('N3 : une piste au meme SIRET qu une piste en opposition est refusee',
  $q$ insert into public.pistes (bureau, nom, siret) values ('b6000000-0000-0000-0000-000000000006', 'Autre nom', '11122233300011') $q$, '23505');
with i as (insert into public.pistes (bureau, nom) values ('b8000000-0000-0000-0000-000000000008', 'Bistrot des Halles') returning 1)
select banc.ok('N3 : le meme nom dans un AUTRE bureau : accepte', (select count(*) = 1 from i));
with i as (insert into public.pistes (bureau, nom) values ('b6000000-0000-0000-0000-000000000006', 'Bistrot des Halles bis') returning 1)
select banc.ok('N3 : un nom different : accepte', (select count(*) = 1 from i));
reset role;
select banc.qui(null);
-- Un rappel reste d'avant (la garde coupee le temps d'un geste) : la vue le tient quand meme dehors.
alter table public.affaires disable trigger affaires_opposition_garde;
update public.affaires set issue = 'en_cours', rappel = current_date where affaire_id = 'c6000000-0000-0000-0000-000000000009';
alter table public.affaires enable trigger affaires_opposition_garde;
select banc.ok('N4 : meme avec un rappel, la vue du courrier tient l affaire en opposition dehors',
  (select jsonb_array_length(affaires) = 1 from public.v_courrier where id = '77777777-7777-7777-7777-777777777777'));
select banc.ok('v_courrier garde security_invoker et finit toujours par signes',
  (select reloptions = '{security_invoker=true}' from pg_class where relname = 'v_courrier')
  and (select column_name = 'signes' from information_schema.columns where table_name = 'v_courrier'
        order by ordinal_position desc limit 1)
  and not has_table_privilege('anon', 'public.v_courrier', 'select'));
select banc.ok('la garde ne s appelle pas du navigateur',
  not has_function_privilege('authenticated', 'public.affaires_opposition_garde()', 'execute'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 56 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
