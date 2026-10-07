-- ===========================================================================
-- BANC DU LOT 76 (brancher sa boite), 07/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 75, pose une doublure de Vault et de `extensions`,
-- puis passe DEUX FOIS supabase/lot76-boites.sql.
--   psql -h /tmp -p 55475 -U postgres -d banc76 -v ON_ERROR_STOP=1 -f banc-lot76-boites.sql
-- Derniere ligne attendue : « BANC DU LOT 76 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot75-signature-mail.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Doublures de ce que Supabase fournit : Vault (memes signatures qu'en production, relevees le
-- 07/10/2026) et `extensions.digest`.
create schema if not exists vault;
create table if not exists vault.secrets (id uuid primary key default gen_random_uuid(),
  name text unique, description text, secret text);
create or replace function vault.create_secret(new_secret text, new_name text default null,
  new_description text default '', new_key_id uuid default null) returns uuid language sql as
$$ insert into vault.secrets (secret, name, description) values (new_secret, new_name, new_description) returning id $$;
create or replace function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null,
  new_description text default null, new_key_id uuid default null) returns void language sql as
$$ update vault.secrets set secret = coalesce(new_secret, secret), name = coalesce(new_name, name) where id = secret_id $$;
revoke all on schema vault from public;
create schema if not exists extensions;
grant usage on schema extensions to public;
create or replace function extensions.digest(t text, a text) returns bytea language sql immutable as
$$ select public.digest(t, a) $$;

\ir lot76-boites.sql
\ir lot76-boites.sql
truncate banc.resultats;
grant usage on schema banc to service_role;
grant execute on all functions in schema banc to service_role;

-- b1 : maitre 1111, simple 7575. b2 : 2222.
-- ------------------------------------------------ la fonction Edge (cle de service)
set role service_role;
select banc.ok('un essai est permis, et compte',
  public.boite_essai_permis('11111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001'));
select banc.refus('un essai pour un bureau dont on n est pas membre est refuse',
  $q$ select public.boite_essai_permis('11111111-1111-1111-1111-111111111111', 'b2000000-0000-0000-0000-000000000002') $q$, '42501');
select public.boite_essai_permis('11111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001')
  from generate_series(1, 9);
select banc.ok('au onzieme essai dans l heure, refus (pas de devinette de mot de passe)',
  not public.boite_essai_permis('11111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001'));
select banc.ok('ranger rend a_confirmer',
  public.boite_ranger('11111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001',
    'Julien@Closfertel.fr', 'gmail', 'smtp.gmail.com', 'julien@closfertel.fr', 'mot-de-passe-1', '123456') = 'a_confirmer');
reset role;
select banc.ok('le secret est dans Vault, et seulement la',
  (select count(*) = 1 from vault.secrets where secret = 'mot-de-passe-1')
  and not exists (select 1 from public.boites where adresse like '%mot-de-passe%' or identifiant like '%mot-de-passe%'));
select banc.ok('l adresse est rangee en minuscules, le code par son empreinte seulement',
  (select adresse = 'julien@closfertel.fr' and code_hash <> '123456' and char_length(code_hash) = 64 from public.boites
    where personne = '11111111-1111-1111-1111-111111111111'));
set role service_role;
select public.boite_ranger('11111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001',
    'julien@closfertel.fr', 'gmail', 'smtp.gmail.com', 'julien@closfertel.fr', 'mot-de-passe-2', '654321');
reset role;
select banc.ok('un nouvel essai REMPLACE le secret, il n en ajoute pas',
  (select count(*) = 1 from vault.secrets where name like 'boite:%') and exists (select 1 from vault.secrets where secret = 'mot-de-passe-2'));
set role service_role;
select banc.refus('un code qui n a pas 6 chiffres est refuse',
  $q$ select public.boite_ranger('11111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001',
      'julien@closfertel.fr', 'gmail', 'smtp.gmail.com', 'x', 'p', '12a456') $q$, '22023');
reset role;
select banc.refus('un serveur sur le port 587 n existe pas, meme ecrit par le proprietaire',
  $q$ update public.boites set port = 587 $q$, '23514');

-- ------------------------------------------------ le vigneron
set role authenticated;
select banc.qui('11111111-1111-1111-1111-111111111111');
select banc.ok('je lis ma boite', (select count(*) = 1 from public.boites));
select banc.refus('je ne lis pas le secret_id', $q$ select secret_id from public.boites $q$, '42501');
select banc.refus('je ne lis pas l empreinte du code', $q$ select code_hash from public.boites $q$, '42501');
select banc.refus('je ne peux pas ranger moi-meme un mot de passe',
  $q$ select public.boite_ranger('11111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001',
      'a@b.fr', 'gmail', 'smtp.gmail.com', 'a', 'p', '111111') $q$, '42501');
select banc.refus('je ne passe pas ma boite a branchee en direct',
  $q$ update public.boites set etat = 'branchee' $q$, '42501');
select banc.ok('l ancien code ne vaut plus', public.boite_confirmer('b1000000-0000-0000-0000-000000000001', '123456') = 'faux');
select banc.ok('pas encore branchee', (select etat = 'a_confirmer' from public.boites));
select banc.ok('le bon code branche la boite', public.boite_confirmer('b1000000-0000-0000-0000-000000000001', ' 654321 ') = 'branchee');
select banc.ok('branchee, le code est oublie', (select etat = 'branchee' and branchee_le is not null and code_expire is null from public.boites));
select banc.ok('un code redonne apres coup ne sert plus', public.boite_confirmer('b1000000-0000-0000-0000-000000000001', '654321') = 'aucune');
select banc.ok('je regle : ma messagerie, copie decochee', public.boite_regler('b1000000-0000-0000-0000-000000000001', false, false));
select banc.ok('reglage pose, boite toujours branchee', (select not utiliser and not copie_a_soi and etat = 'branchee' from public.boites));
select public.boite_regler('b1000000-0000-0000-0000-000000000001', true, null);
select banc.ok('un null laisse la valeur', (select utiliser and not copie_a_soi from public.boites));

-- Le simple utilisateur et un autre bureau.
select banc.qui('75757575-7575-7575-7575-757575757575');
select banc.ok('un collegue ne lit pas ma boite', (select count(*) = 0 from public.boites));
select banc.refus('un simple utilisateur ne voit pas les boites des collegues',
  $q$ select * from public.boites_du_bureau('b1000000-0000-0000-0000-000000000001') $q$, '42501');
select banc.ok('un collegue ne retire pas ma boite', not public.boite_retirer('b1000000-0000-0000-0000-000000000001'));
select banc.ok('un collegue ne confirme rien chez moi', public.boite_confirmer('b1000000-0000-0000-0000-000000000001', '000000') = 'aucune');
select banc.qui('22222222-2222-2222-2222-222222222222');
select banc.refus('un autre bureau ne voit pas qui envoie d ou',
  $q$ select * from public.boites_du_bureau('b1000000-0000-0000-0000-000000000001') $q$, '42501');

select banc.qui('11111111-1111-1111-1111-111111111111');
select banc.ok('le maitre voit qui envoie d ou, sans secret',
  (select count(*) = 1 from public.boites_du_bureau('b1000000-0000-0000-0000-000000000001') where adresse = 'julien@closfertel.fr' and etat = 'branchee'));
-- Cinq codes faux : le code meurt.
reset role;
set role service_role;
select public.boite_ranger('75757575-7575-7575-7575-757575757575', 'b1000000-0000-0000-0000-000000000001',
    'camila@closfertel.fr', 'ovh', 'ssl0.ovh.net', 'camila@closfertel.fr', 'mdp-camila', '222222');
reset role;
set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select public.boite_confirmer('b1000000-0000-0000-0000-000000000001', '000000') from generate_series(1, 5);
select banc.ok('apres 5 codes faux, meme le bon code est refuse', public.boite_confirmer('b1000000-0000-0000-0000-000000000001', '222222') = 'expire');
reset role;
update public.boites set code_hash = encode(public.digest('333333:75757575-7575-7575-7575-757575757575', 'sha256'), 'hex'), code_expire = now() - interval '1 minute', code_essais = 0
  where personne = '75757575-7575-7575-7575-757575757575';
set role authenticated;
select banc.qui('75757575-7575-7575-7575-757575757575');
select banc.ok('un code de plus de 15 minutes ne branche pas', public.boite_confirmer('b1000000-0000-0000-0000-000000000001', '333333') = 'expire');
select banc.ok('je retire ma boite', public.boite_retirer('b1000000-0000-0000-0000-000000000001'));
reset role;
select banc.ok('retiree, son secret a quitte Vault', not exists (select 1 from vault.secrets where secret = 'mdp-camila'));
-- Quitter le bureau efface la boite ET son secret.
delete from public.membres where bureau = 'b1000000-0000-0000-0000-000000000001' and personne = '11111111-1111-1111-1111-111111111111';
select banc.ok('quitter le bureau efface la boite et son secret',
  not exists (select 1 from public.boites where personne = '11111111-1111-1111-1111-111111111111')
  and not exists (select 1 from vault.secrets where name like 'boite:%'));

select banc.ok('anon n a aucun droit',
  not has_table_privilege('anon', 'public.boites', 'select')
  and not has_function_privilege('anon', 'public.boite_confirmer(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.boite_retirer(uuid)', 'execute'));
select banc.ok('authenticated n appelle ni ranger ni le plafond',
  not has_function_privilege('authenticated', 'public.boite_ranger(uuid, uuid, text, text, text, text, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.boite_essai_permis(uuid, uuid)', 'execute'));
select banc.ok('authenticated ne peut rien ecrire en direct',
  not has_table_privilege('authenticated', 'public.boites', 'insert')
  and not has_table_privilege('authenticated', 'public.boites', 'update')
  and not has_table_privilege('authenticated', 'public.boites', 'delete'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 76 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select nom, detail from banc.resultats where not ok;
