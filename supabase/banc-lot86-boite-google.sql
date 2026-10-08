-- ===========================================================================
-- BANC DU LOT 86 (brancher sa boite avec Google), 08/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue tout le banc du lot 84 (qui ne passe pas par le 79), puis le lot 79, puis passe DEUX
-- FOIS lot86-boite-google.sql.
--   psql -h /tmp -p 55486 -U postgres -d banc86 -v ON_ERROR_STOP=1 -f banc-lot86-boite-google.sql
-- ===========================================================================
\ir banc-lot84-echanges-mails-programmes.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);
\ir lot79-logo-mails.sql
\ir lot86-boite-google.sql
\ir lot86-boite-google.sql
truncate banc.resultats;

-- Une boite branchee par mot de passe, pour voir qu'elle est REMPLACEE.
delete from public.boites where personne = '75757575-7575-7575-7575-757575757575';
select vault.create_secret('ancien-mot-de-passe', 'banc86-ancien', null, null) as s \gset
insert into public.boites (bureau, personne, adresse, fournisseur, serveur, identifiant, secret_id, etat, branchee_le, copie_a_soi)
  values ('b1000000-0000-0000-0000-000000000001', '75757575-7575-7575-7575-757575757575', 'ted@gmail.com', 'gmail',
          'smtp.gmail.com', 'ted@gmail.com', :'s', 'branchee', now(), true);

set role service_role;
-- --------------------------------------------------------------- L'ETAT
select banc.ok('poser : un membre pose un etat',
  public.google_etat_poser('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001', repeat('a', 64), 'https://lebureauduvigneron.fr'));
select banc.refus('poser : un non-membre est refuse',
  $q$ select public.google_etat_poser('75757575-7575-7575-7575-757575757575', 'b9999999-0000-0000-0000-000000000009', repeat('b', 64), 'https://lebureauduvigneron.fr') $q$, '42501');
select banc.refus('poser : une adresse de retour inconnue est refusee',
  $q$ select public.google_etat_poser('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001', repeat('c', 64), 'https://pirate.example') $q$, '23514');
select banc.refus('poser : une empreinte mal formee est refusee',
  $q$ select public.google_etat_poser('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001', 'abc', 'https://lebureauduvigneron.fr') $q$, '23514');
select banc.ok('voir : dit ou revenir sans consommer',
  public.google_etat_voir(repeat('a', 64)) = 'https://lebureauduvigneron.fr' and public.google_etat_voir(repeat('a', 64)) = 'https://lebureauduvigneron.fr');
select banc.ok('prendre : rend qui et ou revenir',
  (select personne = '75757575-7575-7575-7575-757575757575' and bureau = 'b1000000-0000-0000-0000-000000000001' and retour = 'https://lebureauduvigneron.fr'
     from public.google_etat_prendre(repeat('a', 64))));
select banc.ok('prendre : une seule fois',
  (select count(*) = 0 from public.google_etat_prendre(repeat('a', 64))));
select public.google_etat_poser('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001', repeat('d', 64), 'https://lebureauduvigneron.vercel.app');
reset role;
update public.oauth_etats set cree_le = now() - interval '11 minutes' where etat_hash = repeat('d', 64);
set role service_role;
select banc.ok('prendre : un etat de plus de 10 minutes ne sert plus',
  (select count(*) = 0 from public.google_etat_prendre(repeat('d', 64))));
select banc.ok('poser : dix par heure, pas onze',
  (select bool_and(public.google_etat_poser('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001', lpad(i::text, 64, 'e'), 'https://lebureauduvigneron.fr'))
     from generate_series(1, 9) i)
  and not public.google_etat_poser('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001', repeat('f', 64), 'https://lebureauduvigneron.fr'));

-- --------------------------------------------------------------- RANGER
select banc.refus('ranger : un jeton vide est refuse',
  $q$ select public.boite_google_ranger('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001', 'ted@gmail.com', '') $q$, '22023');
select banc.refus('ranger : un non-membre est refuse',
  $q$ select public.boite_google_ranger('75757575-7575-7575-7575-757575757575', 'b9999999-0000-0000-0000-000000000009', 'ted@gmail.com', '1//jeton-de-renouvellement') $q$, '42501');
select banc.ok('ranger : la boite est branchee tout de suite',
  public.boite_google_ranger('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001', 'Ted@Gmail.com', '1//jeton-de-renouvellement') = 'branchee');
reset role;
select banc.ok('ranger : la boite par mot de passe est remplacee, sans copie a soi, meme secret',
  (select fournisseur = 'google_api' and serveur = 'gmail.googleapis.com' and adresse = 'ted@gmail.com' and etat = 'branchee'
          and utiliser and not copie_a_soi and secret_id = :'s'
     from public.boites where personne = '75757575-7575-7575-7575-757575757575'));
select banc.ok('ranger : Vault garde le jeton, plus le mot de passe',
  (select decrypted_secret = '1//jeton-de-renouvellement' from vault.decrypted_secrets where id = :'s'));
set role service_role;
select banc.ok('pour l envoi : le fournisseur et le jeton partent',
  (select fournisseur = 'google_api' and secret = '1//jeton-de-renouvellement'
     from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
select banc.ok('reconnecter : marche aussi pour une boite Google',
  public.boite_reconnecter('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001', 'acces retire'));
select banc.ok('reconnecter : plus rien ne part',
  (select count(*) = 0 from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
select banc.ok('se reconnecter avec Google rebranche',
  public.boite_google_ranger('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001', 'ted@gmail.com', '1//nouveau-jeton') = 'branchee');
-- Deux instructions : une fonction stable voit l'etat du DEBUT de l'instruction.
select banc.ok('rebranchee : le nouveau jeton part',
  (select secret = '1//nouveau-jeton' from public.boite_pour_envoi('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001')));
reset role;

-- --------------------------------------------------------------- DROITS
select banc.ok('droits : aucune des trois fonctions pour un compte connecte ni anon',
  not has_function_privilege('authenticated', 'public.google_etat_poser(uuid, uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.google_etat_prendre(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.google_etat_voir(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.boite_google_ranger(uuid, uuid, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.boite_google_ranger(uuid, uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.boite_pour_envoi(uuid, uuid)', 'execute'));
select banc.ok('droits : personne ne lit les etats du navigateur',
  not has_table_privilege('authenticated', 'public.oauth_etats', 'select') and not has_table_privilege('anon', 'public.oauth_etats', 'select'));
select banc.ok('droits : le compte connecte lit toujours sa boite, sans secret',
  has_column_privilege('authenticated', 'public.boites', 'fournisseur', 'select')
  and not has_column_privilege('authenticated', 'public.boites', 'secret_id', 'select'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 86 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select nom, detail from banc.resultats where not ok;
