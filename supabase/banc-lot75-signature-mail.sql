-- ===========================================================================
-- BANC DU LOT 75 (la signature des mails), 07/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 72, puis passe DEUX FOIS supabase/lot75-signature-mail.sql.
--   psql -h /tmp -p 55475 -d banc75 -v ON_ERROR_STOP=1 -f banc-lot75-signature-mail.sql
-- Derniere ligne attendue : « BANC DU LOT 75 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot72-journal-affaires.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);
\ir lot75-signature-mail.sql
\ir lot75-signature-mail.sql
truncate banc.resultats;

-- Un simple utilisateur dans le bureau b1 (maitre : 1111).
insert into auth.users values ('75757575-7575-7575-7575-757575757575', 'simple@exemple.fr') on conflict do nothing;
insert into public.membres (bureau, personne, role) values
  ('b1000000-0000-0000-0000-000000000001', '75757575-7575-7575-7575-757575757575', 'simple') on conflict do nothing;

set role authenticated;

-- ------------------------------------------------ par personne
select banc.qui('11111111-1111-1111-1111-111111111111');
insert into public.signatures (bureau, nom, role, telephone) values
  ('b1000000-0000-0000-0000-000000000001', 'Julien Fertel', 'Vigneron', '06 12 34 56 78');
select banc.ok('chacun ecrit sa signature ; la personne est posee par la base',
  (select personne = '11111111-1111-1111-1111-111111111111' and dans_mails and not messagerie_signe
     from public.signatures where nom = 'Julien Fertel'));
select banc.refus('on n ecrit pas la signature d un autre',
  $q$ insert into public.signatures (bureau, personne, nom) values
      ('b1000000-0000-0000-0000-000000000001', '75757575-7575-7575-7575-757575757575', 'Usurpe') $q$, '42501');
select banc.refus('un telephone avec des lettres est refuse',
  $q$ update public.signatures set telephone = 'appelle-moi' where nom = 'Julien Fertel' $q$, '23514');
select banc.refus('un nom de plus de 80 signes est refuse',
  $q$ update public.signatures set nom = repeat('a', 81) where nom = 'Julien Fertel' $q$, '23514');
select banc.refus('un bureau dont on n est pas membre est refuse',
  $q$ insert into public.signatures (bureau, nom) values ('b2000000-0000-0000-0000-000000000002', 'Intrus') $q$, '42501');

select banc.qui('75757575-7575-7575-7575-757575757575');
select banc.ok('un autre membre ne lit pas la signature du maitre',
  (select count(*) = 0 from public.signatures where bureau = 'b1000000-0000-0000-0000-000000000001'));
insert into public.signatures (bureau, nom, messagerie_signe) values
  ('b1000000-0000-0000-0000-000000000001', 'Claire Fertel', true);
update public.signatures set nom = 'Pirate' where nom = 'Julien Fertel';
select banc.ok('un autre membre ne modifie pas la signature du maitre (aucune ligne touchee)',
  (select count(*) = 1 from public.signatures));
delete from public.signatures where nom = 'Julien Fertel';
reset role;
select banc.ok('ni ne la supprime', (select nom = 'Julien Fertel' from public.signatures
  where personne = '11111111-1111-1111-1111-111111111111'));
select banc.ok('la signature du simple utilisateur est la sienne',
  (select messagerie_signe from public.signatures where personne = '75757575-7575-7575-7575-757575757575'));
set role authenticated;

-- ------------------------------------------------ commun au domaine
select banc.qui('75757575-7575-7575-7575-757575757575');
select banc.refus('un simple utilisateur ne regle pas le bloc commun',
  $q$ select public.signature_domaine_poser('b1000000-0000-0000-0000-000000000001', 'Domaine', null, null, null, null, null, true) $q$, '42501');
select banc.refus('personne n ecrit le bloc commun en direct',
  $q$ insert into public.signature_domaine (bureau, nom_domaine) values ('b1000000-0000-0000-0000-000000000001', 'X') $q$, '42501');

select banc.qui('11111111-1111-1111-1111-111111111111');
select banc.refus('une actualite sans date de fin est refusee',
  $q$ select public.signature_domaine_poser('b1000000-0000-0000-0000-000000000001', 'Domaine', null, null, null,
      'Salon des Vins de Loire', null, true) $q$, '22023');
select banc.refus('une actualite dont la fin est passee est refusee',
  $q$ select public.signature_domaine_poser('b1000000-0000-0000-0000-000000000001', 'Domaine', null, null, null,
      'Salon passe', current_date - 2, true) $q$, '22023');
select banc.refus('un lien qui n est pas une adresse web est refuse',
  $q$ select public.signature_domaine_poser('b1000000-0000-0000-0000-000000000001', 'Domaine', null, null,
      'javascript:alert(1)', null, null, true) $q$, '23514');
select public.signature_domaine_poser('b1000000-0000-0000-0000-000000000001', '  Domaine du Clos Fertel ',
  'Saumur-Champigny', 'Caveau ouvert du mardi au samedi', 'https://closfertel.fr/boutique',
  'Salon des Vins de Loire, stand B12', current_date + 10, true);
select banc.ok('le maitre regle le bloc commun ; les blancs sont retires ; la base signe',
  (select nom_domaine = 'Domaine du Clos Fertel' and actualite_fin = current_date + 10
          and maj_par = '11111111-1111-1111-1111-111111111111' from public.signature_domaine
     where bureau = 'b1000000-0000-0000-0000-000000000001'));
select public.signature_domaine_poser('b1000000-0000-0000-0000-000000000001', 'Domaine du Clos Fertel',
  null, null, null, '   ', current_date + 3, false);
select banc.ok('une actualite vide efface aussi sa date de fin',
  (select actualite is null and actualite_fin is null and not pied_legal from public.signature_domaine
     where bureau = 'b1000000-0000-0000-0000-000000000001'));

select banc.qui('75757575-7575-7575-7575-757575757575');
select banc.ok('tout le bureau lit le bloc commun',
  (select count(*) = 1 from public.signature_domaine where bureau = 'b1000000-0000-0000-0000-000000000001'));
select banc.qui('22222222-2222-2222-2222-222222222222');
select banc.ok('un autre bureau ne le voit pas',
  (select count(*) = 0 from public.signature_domaine where bureau = 'b1000000-0000-0000-0000-000000000001'));
select banc.refus('un autre bureau ne le regle pas',
  $q$ select public.signature_domaine_poser('b1000000-0000-0000-0000-000000000001', 'X', null, null, null, null, null, true) $q$, '42501');

reset role;
select banc.refus('la table refuse une actualite sans fin, meme ecrite par le proprietaire',
  $q$ update public.signature_domaine set actualite = 'Sans fin', actualite_fin = null
      where bureau = 'b1000000-0000-0000-0000-000000000001' $q$, '23514');
select banc.ok('anon n a aucun droit sur les deux tables',
  not has_table_privilege('anon', 'public.signatures', 'select')
  and not has_table_privilege('anon', 'public.signature_domaine', 'select'));
select banc.ok('authenticated ne fait que lire le bloc commun',
  has_table_privilege('authenticated', 'public.signature_domaine', 'select')
  and not has_table_privilege('authenticated', 'public.signature_domaine', 'insert')
  and not has_table_privilege('authenticated', 'public.signature_domaine', 'update'));
select banc.ok('la fonction de pose n est pas appelable par anon',
  not has_function_privilege('anon', 'public.signature_domaine_poser(uuid, text, text, text, text, text, date, boolean)', 'execute'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 75 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
