-- ===========================================================================
-- BANC DU LOT 83 (relier, delier, fusionner), 08/10/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Rejoue tout le banc du lot 80, puis passe DEUX FOIS lot83-relier-fusionner.sql.
--   psql -h /tmp -p 55483 -U postgres -d banc83 -v ON_ERROR_STOP=1 -f banc-lot83-relier-fusionner.sql
-- Derniere ligne attendue : « BANC DU LOT 83 : N controles, 0 echec ».
-- ===========================================================================
\ir banc-lot80-nouveaux-clients.sql
\pset tuples_only off
\set QUIET on
\o /dev/null
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Le decor avait reduit `suivi_clients` et `echanges` a quelques colonnes. Ce lot
-- depend de leur VRAIE forme (cles primaires, droits par auteur du lot 17) : on les
-- refait comme en production (colonnes relevees le 08/10/2026), puis on repasse le
-- lot 80 qui y repose ses declencheurs et recree la vue du courrier.
drop table if exists public.suivi_clients, public.echanges cascade;
create table public.suivi_clients (
  bureau uuid not null references public.bureaux(bureau) on delete cascade,
  client_id text not null, statut text, notes text, rappel date, canal text,
  tags text[] not null default '{}', maj_le timestamptz not null default now(), rappel_titre text,
  cree_par uuid default auth.uid(), proprietaire uuid, maj_par uuid default auth.uid(),
  primary key (bureau, client_id));
create table public.echanges (
  bureau uuid not null references public.bureaux(bureau) on delete cascade,
  echange_id text not null, client_id text not null, le timestamptz not null default now(),
  type text not null, canal text, resume text, maj_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  primary key (bureau, echange_id));
alter table public.suivi_clients enable row level security;
alter table public.echanges enable row level security;
grant select, insert, update, delete on public.suivi_clients, public.echanges to authenticated;
create policy "lire le suivi du bureau" on public.suivi_clients for select to authenticated using (public.est_membre(bureau));
create policy "creer un suivi" on public.suivi_clients for insert to authenticated with check (public.est_membre(bureau));
create policy "modifier un suivi du bureau" on public.suivi_clients for update to authenticated
  using (public.est_membre(bureau)) with check (public.est_membre(bureau));
create policy "supprimer un suivi du bureau" on public.suivi_clients for delete to authenticated using (public.est_membre(bureau));
create policy "lire le journal du bureau" on public.echanges for select to authenticated using (public.est_membre(bureau));
create policy "ecrire au journal" on public.echanges for insert to authenticated with check (public.est_membre(bureau));
create policy "modifier son echange" on public.echanges for update to authenticated
  using (public.est_membre(bureau) and cree_par = auth.uid()) with check (public.est_membre(bureau) and cree_par = auth.uid());
create policy "supprimer son echange" on public.echanges for delete to authenticated
  using (public.est_membre(bureau) and cree_par = auth.uid());
\ir lot80-nouveaux-clients.sql

\ir lot83-relier-fusionner.sql
\ir lot83-relier-fusionner.sql
truncate banc.resultats;

-- Decor : trois nouveaux clients dans b6 (maitre 6666, simple 7777), deux numeros Vitisoft.
insert into public.pistes (bureau, piste_id, nom, email, siret, telephone) values
  ('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', 'Cave Une', 'une@exemple.fr', null, null),
  ('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000002', 'Cave Deux', null, null, null),
  ('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000003', 'Cave Une bis', null, '12345678901234', '0601020304');
insert into public.suivi_clients (bureau, client_id, rappel, rappel_titre, tags, notes) values
  ('b6000000-0000-0000-0000-000000000006', 'p:93000000-0000-0000-0000-000000000001', date '2026-10-20', 'Relancer Une', '{Salon}', 'note piste une'),
  ('b6000000-0000-0000-0000-000000000006', 'p:93000000-0000-0000-0000-000000000002', date '2026-10-10', 'Relancer Deux', '{A,B}', 'note piste deux'),
  ('b6000000-0000-0000-0000-000000000006', '902', date '2026-11-30', 'Vitisoft', '{A}', 'note vitisoft'),
  ('b6000000-0000-0000-0000-000000000006', 'p:93000000-0000-0000-0000-000000000003', null, null, '{Bis}', 'note bis');
insert into public.echanges (bureau, echange_id, client_id, type, resume, cree_par) values
  ('b6000000-0000-0000-0000-000000000006', 'e83-1', 'p:93000000-0000-0000-0000-000000000001', 'note', 'ecrite par 7777', '77777777-7777-7777-7777-777777777777'),
  ('b6000000-0000-0000-0000-000000000006', 'e83-2', 'p:93000000-0000-0000-0000-000000000002', 'note', 'deux', '66666666-6666-6666-6666-666666666666'),
  ('b6000000-0000-0000-0000-000000000006', 'e83-3', '902', 'note', 'vitisoft avant', '66666666-6666-6666-6666-666666666666'),
  ('b6000000-0000-0000-0000-000000000006', 'e83-4', 'p:93000000-0000-0000-0000-000000000003', 'note', 'bis', '66666666-6666-6666-6666-666666666666');
-- Son « suivi par » a quitte le bureau : la fusion ne doit pas buter dessus.
alter table public.affaires disable trigger user;
insert into public.affaires (bureau, affaire_id, type_id, etape_id, piste_id, titre, issue, proprietaire) values
  ('b6000000-0000-0000-0000-000000000006', 'c6830000-0000-0000-0000-000000000003', 'a6000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000003', 'Affaire bis', 'en_cours', '44444444-4444-4444-4444-444444444444');
alter table public.affaires enable trigger user;
update public.pistes set notes = repeat('g', 1500) where piste_id = '93000000-0000-0000-0000-000000000001';
update public.pistes set notes = repeat('a', 1500) where piste_id = '93000000-0000-0000-0000-000000000003';

-- 1. LE LIEN NE SE POSE PLUS A LA MAIN
set role authenticated;
select banc.qui('66666666-6666-6666-6666-666666666666');
select banc.refus('un compte ne pose plus client_id par un simple PATCH',
  $q$ update public.pistes set client_id = '901' where piste_id = '93000000-0000-0000-0000-000000000001' $q$, '42501');
select banc.refus('ni a la creation d une piste',
  $q$ insert into public.pistes (bureau, nom, client_id) values ('b6000000-0000-0000-0000-000000000006', 'Directe', '903') $q$, '42501');
update public.pistes set ville = 'Nantes' where piste_id = '93000000-0000-0000-0000-000000000001';
select banc.ok('le reste de la piste se modifie toujours',
  (select ville = 'Nantes' from public.pistes where piste_id = '93000000-0000-0000-0000-000000000001'));
update public.pistes set pas_vitisoft = '{777}' where piste_id = '93000000-0000-0000-0000-000000000002';
select banc.ok('« ce n est pas lui » s ecrit depuis le bureau',
  (select pas_vitisoft = '{777}' from public.pistes where piste_id = '93000000-0000-0000-0000-000000000002'));
select banc.refus('la trace des liens ne se lit pas depuis le navigateur',
  $q$ select * from public.liens_nouveaux $q$, '42501');

-- 2. RELIER, sans suivi Vitisoft
select banc.qui('44444444-4444-4444-4444-444444444444');
select banc.refus('un compte d un autre bureau ne relie pas',
  $q$ select public.relier_a_vitisoft('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', '901') $q$, '42501');
select banc.qui('66666666-6666-6666-6666-666666666666');
select banc.refus('un numero vide ou en p: est refuse',
  $q$ select public.relier_a_vitisoft('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', 'p:x') $q$, '22023');
select banc.refus('une piste en opposition ne se relie pas',
  $q$ select public.relier_a_vitisoft('b6000000-0000-0000-0000-000000000006', '96000000-0000-0000-0000-000000000001', '901') $q$, '42501');
create temp table r1 as select public.relier_a_vitisoft('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', ' 901 ') as r;
select banc.ok('relier rend le compte rendu (numero nettoye, 1 echange, suivi deplace)',
  (select r->>'client_id' = '901' and (r->>'echanges')::int = 1 and r->>'suivi' = 'deplace' from r1));
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('la piste porte le numero, signe par celui qui a relie',
  (select client_id = '901' and lie_par = '66666666-6666-6666-6666-666666666666' and lie_le is not null
     from public.pistes where piste_id = '93000000-0000-0000-0000-000000000001'));
select banc.ok('le suivi est passe sous le numero, intact',
  (select count(*) = 0 from public.suivi_clients where client_id = 'p:93000000-0000-0000-0000-000000000001')
  and (select rappel = date '2026-10-20' and tags = '{Salon}' and notes = 'note piste une'
         from public.suivi_clients where bureau = 'b6000000-0000-0000-0000-000000000006' and client_id = '901'));
select banc.ok('la note d un collegue est deplacee aussi (son auteur ne change pas)',
  (select client_id = '901' and cree_par = '77777777-7777-7777-7777-777777777777' from public.echanges where echange_id = 'e83-1'));
select banc.ok('la trace du lien est posee',
  (select client_id = '901' and echanges = '{e83-1}' and suivi_piste is not null and suivi_client is null
     from public.liens_nouveaux where piste_id = '93000000-0000-0000-0000-000000000001'));
set role authenticated;
select banc.qui('66666666-6666-6666-6666-666666666666');
select banc.ok('relier deux fois ne fait rien de plus',
  (public.relier_a_vitisoft('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', '901')->>'deja')::boolean);
select banc.refus('un nouveau client deja relie ne se relie pas a un autre numero',
  $q$ select public.relier_a_vitisoft('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', '902') $q$, '23514');
select banc.refus('un numero deja relie a une autre piste est refuse',
  $q$ select public.relier_a_vitisoft('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000002', '901') $q$, '23505');
select banc.refus('apres le lien, plus rien ne s ecrit sous p:',
  $q$ insert into public.echanges (bureau, echange_id, client_id, type, resume) values ('b6000000-0000-0000-0000-000000000006', 'e83-x', 'p:93000000-0000-0000-0000-000000000001', 'note', 'x') $q$, '23514');

-- 3. RELIER, avec un suivi Vitisoft : les deux se reunissent
select banc.qui('77777777-7777-7777-7777-777777777777');
create temp table r2 as select public.relier_a_vitisoft('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000002', '902') as r;
select banc.ok('un simple membre relie aussi, et le suivi est dit reuni',
  (select r->>'suivi' = 'reuni' from r2));
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('reunion : le rappel le plus proche avec son motif, les notes bout a bout, les etiquettes additionnees',
  (select rappel = date '2026-10-10' and rappel_titre = 'Relancer Deux' and notes = E'note vitisoft\nnote piste deux' and tags = '{A,B}'
     from public.suivi_clients where bureau = 'b6000000-0000-0000-0000-000000000006' and client_id = '902')
  and (select count(*) = 0 from public.suivi_clients where client_id = 'p:93000000-0000-0000-0000-000000000002'));

-- 4. DELIER sans rien toucher : tout revient
set role authenticated;
select banc.qui('66666666-6666-6666-6666-666666666666');
create temp table d2 as select public.delier_de_vitisoft('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000002') as r;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('delier rend le suivi Vitisoft d avant et le dit',
  (select r->>'suivi_vitisoft' = 'rendu' and (r->>'echanges')::int = 1 from d2)
  and (select rappel = date '2026-11-30' and notes = 'note vitisoft' and tags = '{A}'
         from public.suivi_clients where bureau = 'b6000000-0000-0000-0000-000000000006' and client_id = '902'));
select banc.ok('delier rend au nouveau client son suivi et sa note, et efface la trace',
  (select rappel = date '2026-10-10' and tags = '{A,B}' from public.suivi_clients where client_id = 'p:93000000-0000-0000-0000-000000000002')
  and (select client_id = 'p:93000000-0000-0000-0000-000000000002' from public.echanges where echange_id = 'e83-2')
  and (select client_id = '902' from public.echanges where echange_id = 'e83-3')
  and (select client_id is null and lie_par is null from public.pistes where piste_id = '93000000-0000-0000-0000-000000000002')
  and (select count(*) = 0 from public.liens_nouveaux where piste_id = '93000000-0000-0000-0000-000000000002'));

-- 5. DELIER apres un geste sur la fiche Vitisoft : on garde ce qui a ete ecrit
update public.suivi_clients set rappel = date '2026-12-24', rappel_titre = 'Noel'
 where bureau = 'b6000000-0000-0000-0000-000000000006' and client_id = '901';
insert into public.echanges (bureau, echange_id, client_id, type, resume) values
  ('b6000000-0000-0000-0000-000000000006', 'e83-5', '901', 'note', 'apres le lien');
set role authenticated;
select banc.qui('66666666-6666-6666-6666-666666666666');
create temp table d1 as select public.delier_de_vitisoft('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001') as r;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('un suivi Vitisoft modifie depuis le lien garde CE QUI A CHANGE, et c est dit',
  (select r->>'suivi_vitisoft' = 'garde' from d1)
  and (select rappel = date '2026-12-24' and rappel_titre = 'Noel' from public.suivi_clients where bureau = 'b6000000-0000-0000-0000-000000000006' and client_id = '901'));
select banc.ok('et rend a Vitisoft ce qui n a pas bouge : ni la note ni l etiquette de la piste n y restent en double',
  (select notes is null and tags = '{}' from public.suivi_clients where bureau = 'b6000000-0000-0000-0000-000000000006' and client_id = '901'));
select banc.ok('le nouveau client retrouve son suivi d avant, sa note ; celle ecrite apres reste sur Vitisoft',
  (select rappel = date '2026-10-20' and notes = 'note piste une' from public.suivi_clients where client_id = 'p:93000000-0000-0000-0000-000000000001')
  and (select client_id = 'p:93000000-0000-0000-0000-000000000001' from public.echanges where echange_id = 'e83-1')
  and (select client_id = '901' from public.echanges where echange_id = 'e83-5'));
set role authenticated;
select banc.qui('66666666-6666-6666-6666-666666666666');
select banc.ok('delier deux fois ne fait rien de plus',
  (public.delier_de_vitisoft('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001')->>'deja')::boolean);

-- 6. FUSIONNER deux nouveaux clients
select banc.refus('on ne fusionne pas un client avec lui-meme',
  $q$ select public.fusionner_nouveaux('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001') $q$, '22023');
select banc.refus('on ne fusionne pas avec une personne en opposition',
  $q$ select public.fusionner_nouveaux('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001') $q$, '42501');
select banc.refus('un client deja relie se delie avant de fusionner',
  $q$ select public.fusionner_nouveaux('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', '98000000-0000-0000-0000-0000000000c1') $q$, '23514');
select banc.qui('44444444-4444-4444-4444-444444444444');
select banc.refus('un compte d un autre bureau ne fusionne pas',
  $q$ select public.fusionner_nouveaux('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000003') $q$, '42501');
select banc.qui('66666666-6666-6666-6666-666666666666');
create temp table f1 as select public.fusionner_nouveaux('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000003') as r;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('l affaire dont le « suivi par » est parti passe, sans ce nom',
  (select proprietaire is null from public.affaires where affaire_id = 'c6830000-0000-0000-0000-000000000003'));
select banc.ok('des notes trop longues pour tenir ensemble ne se coupent pas : celles de l absorbee vont entieres au journal',
  (select notes = repeat('g', 1500) from public.pistes where piste_id = '93000000-0000-0000-0000-000000000001')
  and (select client_id = 'p:93000000-0000-0000-0000-000000000001' and resume like '%' || repeat('a', 1500)
         from public.echanges where echange_id = 'fusion-93000000000000000000000000000003'));
select banc.ok('la fusion rend son compte rendu',
  (select (r->>'echanges')::int = 1 and (r->>'affaires')::int = 1 from f1));
select banc.ok('la fiche absorbee a disparu, sa note, son affaire et son suivi sont sur la fiche gardee',
  (select count(*) = 0 from public.pistes where piste_id = '93000000-0000-0000-0000-000000000003')
  and (select client_id = 'p:93000000-0000-0000-0000-000000000001' from public.echanges where echange_id = 'e83-4')
  and (select piste_id = '93000000-0000-0000-0000-000000000001' from public.affaires where affaire_id = 'c6830000-0000-0000-0000-000000000003')
  and (select tags = '{Salon,Bis}' and notes = E'note piste une\nnote bis' and rappel = date '2026-10-20'
         from public.suivi_clients where client_id = 'p:93000000-0000-0000-0000-000000000001')
  and (select count(*) = 0 from public.suivi_clients where client_id = 'p:93000000-0000-0000-0000-000000000003'));
select banc.ok('les champs vides de la fiche gardee sont completes (SIRET et telephone), les remplis ne bougent pas',
  (select siret = '12345678901234' and telephone = '0601020304' and email = 'une@exemple.fr' and nom = 'Cave Une'
     from public.pistes where piste_id = '93000000-0000-0000-0000-000000000001'));

-- 7. L'OPPOSITION EFFACE LA TRACE
set role authenticated;
select banc.qui('66666666-6666-6666-6666-666666666666');
select public.relier_a_vitisoft('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000002', '902');
update public.pistes set opposition = true where piste_id = '93000000-0000-0000-0000-000000000002';
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('une opposition efface la trace du lien (elle porte une copie du suivi)',
  (select count(*) = 0 from public.liens_nouveaux where piste_id = '93000000-0000-0000-0000-000000000002'));
set role authenticated;
select banc.qui('66666666-6666-6666-6666-666666666666');
select banc.refus('une personne en opposition ne se delie pas',
  $q$ select public.delier_de_vitisoft('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000002') $q$, '42501');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- 7bis. « CE N'EST PAS LUI » PAR LA BASE
set role authenticated;
select banc.qui('77777777-7777-7777-7777-777777777777');
select public.piste_ecarter('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', '950');
select public.piste_ecarter('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', '949');
select public.piste_ecarter('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', '950');
select banc.ok('« Non » ajoute le numero dans la base, sans doublon et sans perdre les autres',
  (select pas_vitisoft @> '{949,950}' and array_length(array_positions(pas_vitisoft, '950'), 1) = 1 from public.pistes where piste_id = '93000000-0000-0000-0000-000000000001'));
select banc.qui('44444444-4444-4444-4444-444444444444');
select banc.refus('pas depuis un autre bureau',
  $q$ select public.piste_ecarter('b6000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000001', '1') $q$, '42501');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select banc.ok('le declencheur du lot 80 attend un lien en cours (for share)',
  pg_get_functiondef('public.cle_client_verifier()'::regprocedure) like '%piste_id = v_pid for share%');

-- 8. LES DROITS
select banc.ok('anon n appelle aucun des trois gestes',
  not has_function_privilege('anon', 'public.relier_a_vitisoft(uuid, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.delier_de_vitisoft(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.fusionner_nouveaux(uuid, uuid, uuid)', 'execute'));
select banc.ok('les outils internes ne sont pas appelables par un compte',
  not has_function_privilege('authenticated', 'public.suivi_reunir(uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.pistes_lien_garde()', 'execute')
  and not has_function_privilege('authenticated', 'public.suivi_contenu(jsonb)', 'execute'));
select banc.ok('le role de service et l editeur SQL posent toujours client_id directement',
  (select count(*) = 1 from public.pistes where client_id = 'C080'));

\o
\set QUIET off
\pset tuples_only on
select 'BANC DU LOT 83 : ' || count(*) || ' controles, ' || count(*) filter (where not ok) || ' echec' as bilan
  from banc.resultats;
select nom, detail from banc.resultats where not ok;
