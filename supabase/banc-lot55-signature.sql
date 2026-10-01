-- ===========================================================================
-- BANC DU LOT 55 (la signature en ligne du devis), 01/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue d'abord TOUT le banc du lot 54 (qui rejoue 53, 52, 51, 50, 49 et 47), pose le decor
-- que la vue du courrier lit (profils, taches, colonnes de suivi et de reglages), puis passe
-- DEUX FOIS supabase/lot55-signature.sql.
--   psql -h /tmp -p 55455 -d banc55 -v ON_ERROR_STOP=1 -f banc-lot55-signature.sql
-- Derniere ligne attendue : « BANC DU LOT 55 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot54-devis-tva.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public, auth to service_role;
-- Ce que Supabase porte et que le banc n'avait pas : la vue du courrier les lit.
create table if not exists public.profils (id uuid primary key, email text, jeton_emails uuid default gen_random_uuid(),
  bureau_courant uuid, consent_courrier boolean not null default false);
create table if not exists public.taches (id serial primary key, bureau uuid not null, fait_le timestamptz);
alter table public.suivi_clients add column if not exists client_id text;
alter table public.suivi_clients add column if not exists rappel date;
alter table public.suivi_clients add column if not exists statut text;
alter table public.reglages add column if not exists file_travail jsonb;
alter table public.reglages add column if not exists depose_le timestamptz;
alter table public.reglages add column if not exists resume_ventes jsonb;
\ir lot55-signature.sql
\ir lot55-signature.sql
-- Supabase donne tout au role de service ; le banc le lui donne a la main.
grant usage on schema banc to service_role;
grant execute on all functions in schema banc to service_role;
grant select on all tables in schema public to service_role;
truncate banc.resultats;

insert into public.affaires (bureau, affaire_id, type_id, etape_id, client_id, client_nom, titre, issue) values
  ('b5000000-0000-0000-0000-000000000005', 'c5500000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'S1', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5500000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'S2', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5500000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'S3', 'en_cours'),
  ('b5000000-0000-0000-0000-000000000005', 'c5500000-0000-0000-0000-000000000004', 'a5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000001', 'K1', 'Cave Une', 'S4', 'en_cours');
insert into public.profils (id, email, bureau_courant, consent_courrier)
  select '55555555-5555-5555-5555-555555555555', 'u5@x.fr', 'b5000000-0000-0000-0000-000000000005', true
  where not exists (select 1 from public.profils where id = '55555555-5555-5555-5555-555555555555');
insert into public.reglages (bureau) select 'b5000000-0000-0000-0000-000000000005'
  where not exists (select 1 from public.reglages where bureau = 'b5000000-0000-0000-0000-000000000005');

set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
create temp table t_55 (k text primary key, id uuid, num text, jeton text);
grant all on t_55 to authenticated, service_role;
insert into t_55 (k, id, num) select 's' || n, d.devis_id, d.numero
  from generate_series(1, 4) n,
  lateral public.devis_enregistrer('b5000000-0000-0000-0000-000000000005', ('c5500000-0000-0000-0000-00000000000' || n)::uuid, null,
    jsonb_build_array(banc.l(1250, 12))) d;
create function pg_temp.pap55(k text) returns text language sql as
  $f$ select '<!doctype html><html><head><title>Devis ' || (select num from t_55 where t_55.k = $1) || '</title></head><body>'
             || repeat('Muscadet sur lie 75 cl, douze bouteilles. ', 20) || '</body></html>' $f$;
create function pg_temp.i55(k text) returns uuid language sql as $f$ select id from t_55 where t_55.k = $1 $f$;
create function pg_temp.j55(k text) returns text language sql as $f$ select jeton from t_55 where t_55.k = $1 $f$;

-- 1. LES DROITS
select banc.ok('anon et authenticated n executent ni signature_lire ni signature_poser',
  not has_function_privilege('anon', 'public.signature_lire(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.signature_lire(text)', 'execute')
  and not has_function_privilege('anon', 'public.signature_poser(text, text, text, boolean, text, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.signature_poser(text, text, text, boolean, text, text, text)', 'execute'));
select banc.ok('service_role les execute',
  has_function_privilege('service_role', 'public.signature_lire(text)', 'execute')
  and has_function_privilege('service_role', 'public.signature_poser(text, text, text, boolean, text, text, text)', 'execute'));
select banc.ok('le coeur de l acceptation et l obstacle ne sont pas appelables du navigateur',
  not has_function_privilege('authenticated', 'public.devis_accepter_coeur(uuid, uuid, text, uuid, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.devis_accepter_coeur(uuid, uuid, text, uuid, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.devis_obstacle(uuid, uuid)', 'execute'));
select banc.ok('devis_lien_creer : authenticated oui, anon non',
  has_function_privilege('authenticated', 'public.devis_lien_creer(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.devis_lien_creer(uuid, uuid)', 'execute'));
select banc.ok('l empreinte du jeton ne se lit pas, meme par le bureau ; le reste du lien si',
  not has_column_privilege('authenticated', 'public.devis_liens', 'jeton_hash', 'select')
  and has_column_privilege('authenticated', 'public.devis_liens', 'cree_le', 'select')
  and not has_table_privilege('authenticated', 'public.devis_liens', 'insert'));
select banc.ok('les signatures se lisent par le bureau, ne s ecrivent pas ; anon n a rien',
  has_table_privilege('authenticated', 'public.devis_signatures', 'select')
  and not has_table_privilege('authenticated', 'public.devis_signatures', 'insert')
  and not has_table_privilege('authenticated', 'public.devis_signatures', 'update')
  and not has_table_privilege('anon', 'public.devis_signatures', 'select'));
select banc.ok('devis_accepter garde une seule signature, a 3 arguments',
  (select count(*) from pg_proc where proname = 'devis_accepter') = 1 and (select pronargs from pg_proc where proname = 'devis_accepter') = 3);

-- 2. CREER UN LIEN : seulement sur un devis envoye AVEC sa copie
select banc.refus('pas de lien sur un devis enregistre',
  format('select public.devis_lien_creer(%L, %L)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i55('s1')), '23514');
select 1 from public.devis_envoyer('b5000000-0000-0000-0000-000000000005', pg_temp.i55('s4'));
select banc.refus('pas de lien sur un devis envoye SANS copie',
  format('select public.devis_lien_creer(%L, %L)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i55('s4')), '23514');
select 1 from public.devis_envoyer('b5000000-0000-0000-0000-000000000005', pg_temp.i55('s1'), null, null, null, null, pg_temp.pap55('s1'));
select 1 from public.devis_envoyer('b5000000-0000-0000-0000-000000000005', pg_temp.i55('s2'), null, null, null, null, pg_temp.pap55('s2'));
select 1 from public.devis_envoyer('b5000000-0000-0000-0000-000000000005', pg_temp.i55('s3'), null, null, null, null, pg_temp.pap55('s3'));
update t_55 set jeton = public.devis_lien_creer('b5000000-0000-0000-0000-000000000005', id) where k in ('s1', 's2', 's3');
select banc.ok('le jeton fait 64 caracteres hexadecimaux',
  (select bool_and(jeton ~ '^[0-9a-f]{64}$') from t_55 where k in ('s1', 's2', 's3')));
select banc.ok('le bureau voit son lien (sans l empreinte)',
  (select count(*) from public.devis_liens where devis_id = pg_temp.i55('s1') and remplace_le is null) = 1);
select banc.qui('22222222-2222-2222-2222-222222222222');
select banc.ok('un autre bureau ne voit ni lien ni signature',
  (select count(*) from public.devis_liens where bureau = 'b5000000-0000-0000-0000-000000000005') = 0);
select banc.refus('un autre bureau ne cree pas de lien',
  format('select public.devis_lien_creer(%L, %L)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i55('s1')), '42501');
select banc.qui('55555555-5555-5555-5555-555555555555');
reset role;
select banc.ok('la base ne garde que l empreinte du jeton',
  (select l.jeton_hash = encode(sha256(convert_to(t.jeton, 'UTF8')), 'hex') and l.jeton_hash <> t.jeton
     from public.devis_liens l join t_55 t on t.id = l.devis_id where t.k = 's1' and l.remplace_le is null));

-- 3. LIRE, cote client (role de service)
set role service_role;
select banc.ok('jeton inconnu ou mal forme : inconnu, et rien d autre',
  public.signature_lire(repeat('0', 64)) = '{"etat":"inconnu"}'::jsonb
  and public.signature_lire('pas un jeton') = '{"etat":"inconnu"}'::jsonb
  and public.signature_lire(null) = '{"etat":"inconnu"}'::jsonb);
select banc.ok('jeton valide : a_signer, avec la copie, l empreinte, le client et les totaux',
  (select r->>'etat' = 'a_signer' and r->>'papier' = pg_temp.pap55('s1')
          and r->>'empreinte' = encode(sha256(convert_to(pg_temp.pap55('s1'), 'UTF8')), 'hex')
          and r->>'numero' = (select num from t_55 where k = 's1') and (r->>'total_ht_c')::bigint = 15000
          and r->>'client' = 'Cave Une' and r->>'vendeur' <> ''
     from (select public.signature_lire(pg_temp.j55('s1')) r) x));

-- 4. SIGNER : les refus ne posent rien
select banc.ok('nom trop court : refus nom, rien n est ecrit',
  public.signature_poser(pg_temp.j55('s1'), ' A ', 'Gérant', true, (select papier_empreinte from public.devis where devis_id = pg_temp.i55('s1')))->>'refus' = 'nom');
select banc.ok('qualite vide : refus qualite',
  public.signature_poser(pg_temp.j55('s1'), 'Jean Dupont', '  ', true, (select papier_empreinte from public.devis where devis_id = pg_temp.i55('s1')))->>'refus' = 'qualite');
select banc.ok('case non cochee : refus accord',
  public.signature_poser(pg_temp.j55('s1'), 'Jean Dupont', 'Gérant', false, (select papier_empreinte from public.devis where devis_id = pg_temp.i55('s1')))->>'refus' = 'accord');
select banc.ok('empreinte differente de la copie : refus empreinte',
  public.signature_poser(pg_temp.j55('s1'), 'Jean Dupont', 'Gérant', true, repeat('a', 64))->>'refus' = 'empreinte');
select banc.ok('un nom fait de caracteres invisibles est refuse',
  public.signature_poser(pg_temp.j55('s1'), E'\u200b\u200b\u200b', 'Gérant', true, (select papier_empreinte from public.devis where devis_id = pg_temp.i55('s1')))->>'refus' = 'nom');
select banc.ok('apres ces refus : aucune signature, devis toujours envoye',
  (select count(*) from public.devis_signatures) = 0
  and (select statut from public.devis where devis_id = pg_temp.i55('s1')) = 'envoye');

-- 5. SIGNER POUR DE VRAI
create temp table t_sig as select public.signature_poser(pg_temp.j55('s1'), E'  Jean\t  Dupont ', 'Gérant',
  true, (select papier_empreinte from public.devis where devis_id = pg_temp.i55('s1')), '203.0.113.7', 'Mozilla/5.0 banc') r;
select banc.ok('signe : etat signe, nom nettoye, date rendue',
  (select r->>'etat' = 'signe' and r->>'signe_nom' = 'Jean Dupont' and r->>'signe_qualite' = 'Gérant' and r->>'signe_le' is not null from t_sig));
reset role;
select banc.ok('la preuve : nom, qualite, accord, empreinte, IP, navigateur, au nom de, totaux',
  (select s.nom = 'Jean Dupont' and s.accord and s.ip = '203.0.113.7' and s.agent = 'Mozilla/5.0 banc'
          and s.au_nom_de = 'Cave Une' and s.total_ht_c = 15000 and s.total_ttc_c = 18000
          and s.papier_empreinte = d.papier_empreinte and s.numero = d.numero
     from public.devis_signatures s join public.devis d on d.devis_id = s.devis_id where s.devis_id = pg_temp.i55('s1')));
select banc.ok('le devis est accepte tout seul, signe_le = l heure de la preuve, accepte_par vide, affaire gagnee',
  (select d.statut = 'accepte' and d.signe_le = s.signe_le and d.accepte_le is not null and d.accepte_par is null
          and (select issue from public.affaires where affaire_id = d.affaire_id) = 'gagnee'
     from public.devis d join public.devis_signatures s on s.devis_id = d.devis_id where d.devis_id = pg_temp.i55('s1')));
select banc.ok('la base signe le devis sans auteur : maj_par garde le dernier humain',
  (select maj_par = '55555555-5555-5555-5555-555555555555' from public.devis where devis_id = pg_temp.i55('s1')));
set role service_role;
create temp table t_r4 as select public.signature_poser(pg_temp.j55('s1'), 'Autre', 'Autre', true, (select papier_empreinte from public.devis where devis_id = pg_temp.i55('s1'))) r;
select banc.ok('resigner le meme lien : rien de neuf, etat signe',
  (select r->>'signe_nom' from t_r4) = 'Jean Dupont'
  and (select count(*) from public.devis_signatures where devis_id = pg_temp.i55('s1')) = 1);
select banc.ok('relire un lien signe : signe, avec la copie',
  (select r->>'etat' = 'signe' and r->>'papier' is not null from (select public.signature_lire(pg_temp.j55('s1')) r) x));
reset role;
select banc.refus('une signature ne se modifie pas',
  format('update public.devis_signatures set nom = %L where devis_id = %L', 'X', pg_temp.i55('s1')), '23514');
select banc.refus('une signature ne se supprime pas',
  format('delete from public.devis_signatures where devis_id = %L', pg_temp.i55('s1')), '23514');

-- 6. UN NOUVEAU LIEN ETEINT L'ANCIEN
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
update t_55 set jeton = jeton || '|' || public.devis_lien_creer('b5000000-0000-0000-0000-000000000005', id) where k = 's2';
reset role;
set role service_role;
select banc.ok('l ancien lien est clos, le nouveau a signer',
  public.signature_lire(split_part(pg_temp.j55('s2'), '|', 1))->>'etat' = 'clos'
  and public.signature_lire(split_part(pg_temp.j55('s2'), '|', 2))->>'etat' = 'a_signer'
  and public.signature_lire(split_part(pg_temp.j55('s2'), '|', 1))->>'papier' is null);
create temp table t_r1 as select public.signature_poser(split_part(pg_temp.j55('s2'), '|', 1), 'Jean Dupont', 'Gérant', true,
    (select papier_empreinte from public.devis where devis_id = pg_temp.i55('s2'))) r;
select banc.ok('un lien eteint ne montre ni le client, ni les montants, ni l empreinte',
  (select not (r ? 'client') and not (r ? 'total_ht_c') and not (r ? 'empreinte') and not (r ? 'papier') and r->>'numero' is not null
     from (select public.signature_lire(split_part(pg_temp.j55('s2'), '|', 1)) r) x));
select banc.ok('signer par l ancien lien ne signe rien',
  (select r->>'etat' from t_r1) = 'clos'
  and (select statut from public.devis where devis_id = pg_temp.i55('s2')) = 'envoye');
reset role;

update public.affaires set issue = 'gagnee' where affaire_id = 'c5500000-0000-0000-0000-000000000002';
set role service_role;
select banc.ok('affaire passee gagnee a la main : le lien dit clos et ne signe pas',
  public.signature_lire(split_part(pg_temp.j55('s2'), '|', 2))->>'etat' = 'clos');
create temp table t_r5 as select public.signature_poser(split_part(pg_temp.j55('s2'), '|', 2), 'Jean Dupont', 'Gérant', true,
    (select papier_empreinte from public.devis where devis_id = pg_temp.i55('s2'))) r;
select banc.ok('... et rien n est ecrit', (select r->>'etat' from t_r5) = 'clos'
  and (select count(*) from public.devis_signatures where devis_id = pg_temp.i55('s2')) = 0);
reset role;
update public.affaires set issue = 'en_cours' where affaire_id = 'c5500000-0000-0000-0000-000000000002';

-- 7. UN DEVIS EXPIRE NE SE SIGNE PAS
alter table public.devis disable trigger user;
update public.devis set date_devis = current_date - 33, envoye_le = current_date - 33, valable_jusqu = current_date - 3 where devis_id = pg_temp.i55('s3');
alter table public.devis enable trigger user;
set role service_role;
select banc.ok('expire : etat expire, sans copie, et la signature ne passe pas',
  public.signature_lire(pg_temp.j55('s3'))->>'etat' = 'expire'
  and public.signature_lire(pg_temp.j55('s3'))->>'papier' is null
  and public.signature_poser(pg_temp.j55('s3'), 'Jean Dupont', 'Gérant', true,
    (select papier_empreinte from public.devis where devis_id = pg_temp.i55('s3')))->>'etat' = 'expire');
reset role;
set role authenticated;
select banc.refus('pas de nouveau lien sur un devis expire',
  format('select public.devis_lien_creer(%L, %L)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i55('s3')), '23514');
reset role;
alter table public.devis disable trigger user;
update public.devis set date_devis = current_date, envoye_le = current_date, valable_jusqu = current_date + 30 where devis_id = pg_temp.i55('s3');
alter table public.devis enable trigger user;

-- 8. UN DEVIS QUI NE FERAIT PAS UNE COMMANDE NE SE SIGNE PAS
-- Le gel interdit de toucher une ligne d'un devis envoye : on passe par le role qui
-- contourne (le banc), pour fabriquer le cas « ligne sans code article ».
alter table public.devis_lignes disable trigger user;
update public.devis_lignes set num_produit = null where devis_id = pg_temp.i55('s3');
alter table public.devis_lignes enable trigger user;
set role service_role;
create temp table t_r3 as select public.signature_poser(pg_temp.j55('s3'), 'Jean Dupont', 'Gérant', true,
           (select papier_empreinte from public.devis where devis_id = pg_temp.i55('s3'))) r;
select banc.ok('ligne sans code : la page dit clos, et la signature est bloquee sans rien ecrire',
  public.signature_lire(pg_temp.j55('s3'))->>'etat' = 'clos'
  and (select r->>'etat' = 'clos' and r->>'bloque' = 'ligne sans numero produit' from t_r3)
  and (select count(*) from public.devis_signatures where devis_id = pg_temp.i55('s3')) = 0
  and (select statut from public.devis where devis_id = pg_temp.i55('s3')) = 'envoye');
reset role;
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
select banc.refus('et le bureau ne cree pas de lien dessus',
  format('select public.devis_lien_creer(%L, %L)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i55('s3')), '23514');
select banc.refus('devis_accepter refuse toujours avec le meme message (ligne sans numero produit)',
  format('select public.devis_accepter(%L, %L)', 'b5000000-0000-0000-0000-000000000005', pg_temp.i55('s3')), '23514');

-- 9. ANNULER L'ACCORD D'UN DEVIS SIGNE
create temp table t_an as select * from public.devis_annuler_accord('b5000000-0000-0000-0000-000000000005', pg_temp.i55('s1'), true);
select banc.ok('annulation : devis envoye, signe_le efface, affaire rouverte',
  (select statut = 'envoye' and signe_le is null and accepte_le is null from t_an)
  and (select issue from public.affaires where affaire_id = 'c5500000-0000-0000-0000-000000000001') = 'en_cours');
reset role;
select banc.ok('la preuve reste, le lien est eteint',
  (select count(*) from public.devis_signatures where devis_id = pg_temp.i55('s1')) = 1
  and (select count(*) from public.devis_liens where devis_id = pg_temp.i55('s1') and remplace_le is null) = 0);
set role service_role;
select banc.ok('le lien deja signe dit toujours signe (sa preuve), et ne resigne pas',
  public.signature_lire(pg_temp.j55('s1'))->>'etat' = 'signe'
  and (select statut from public.devis where devis_id = pg_temp.i55('s1')) = 'envoye');
reset role;
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
update t_55 set jeton = public.devis_lien_creer('b5000000-0000-0000-0000-000000000005', id) where k = 's1';
reset role;
set role service_role;
create temp table t_r2 as select public.signature_poser(pg_temp.j55('s1'), 'Marie Dupont', 'Cogérante', true,
    (select papier_empreinte from public.devis where devis_id = pg_temp.i55('s1'))) r;
select banc.ok('un nouveau lien apres annulation se signe, deuxieme preuve',
  (select r->>'etat' from t_r2) = 'signe'
  and (select count(*) from public.devis_signatures where devis_id = pg_temp.i55('s1')) = 2
  and (select statut from public.devis where devis_id = pg_temp.i55('s1')) = 'accepte');
reset role;

-- 10. L'ACCEPTATION A LA MAIN MARCHE COMME AVANT
set role authenticated;
select banc.qui('55555555-5555-5555-5555-555555555555');
select banc.ok('devis_accepter a la main : accepte, accepte_par = le vigneron, signe_le vide',
  (select statut = 'accepte' and accepte_par = '55555555-5555-5555-5555-555555555555' and signe_le is null
     from public.devis_accepter('b5000000-0000-0000-0000-000000000005', pg_temp.i55('s4'))));
select banc.refus('hors du bureau, devis_accepter refuse toujours (42501)',
  format('select public.devis_accepter(%L, %L)', 'b2000000-0000-0000-0000-000000000002', pg_temp.i55('s4')), '42501');
reset role;

-- 11. LE COURRIER DU MATIN
select banc.ok('v_courrier garde security_invoker et finit par signes',
  (select reloptions = '{security_invoker=true}' from pg_class where relname = 'v_courrier')
  and (select column_name from information_schema.columns where table_name = 'v_courrier'
        order by ordinal_position desc limit 1) = 'signes');
select banc.ok('v_courrier : seule la signature qui tient (celle d un accord annule ne revient pas), avec client et montant',
  (select jsonb_array_length(signes) = 1 and signes->0->>'signataire' = 'Marie Dupont' and signes->0->>'client' = 'Cave Une'
          and (signes->0->>'total_ht_c')::bigint = 15000
     from public.v_courrier where id = '55555555-5555-5555-5555-555555555555'));
alter table public.devis_signatures disable trigger user;
alter table public.devis disable trigger user;
update public.devis_signatures set signe_le = now() - interval '25 hours' where devis_id = pg_temp.i55('s1') and nom = 'Marie Dupont';
update public.devis set signe_le = (select signe_le from public.devis_signatures where devis_id = pg_temp.i55('s1') and nom = 'Marie Dupont')
 where devis_id = pg_temp.i55('s1');
alter table public.devis enable trigger user;
alter table public.devis_signatures enable trigger user;
select banc.ok('une signature de plus de 24 heures ne revient pas',
  (select jsonb_array_length(signes) = 0 from public.v_courrier where id = '55555555-5555-5555-5555-555555555555'));
select banc.ok('anon ne lit pas la vue',
  not has_table_privilege('anon', 'public.v_courrier', 'select'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 55 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select '  ECHEC : ' || nom || coalesce('  -> ' || detail, '') from banc.resultats where not ok;
