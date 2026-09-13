-- ===========================================================================
-- BANC DE CLOISON, lot 15, 13/09/2026. NE PAS PASSER DANS SUPABASE.
-- ===========================================================================
-- Ce fichier ne se colle NULLE PART dans le projet reel. Il fabrique une fausse
-- base, y passe supabase/lot15-bureaux.sql, et verifie qu'un bureau ne lit pas
-- l'autre. Il tourne sur un PostgreSQL jetable, et il a trouve un defaut du
-- premier coup (voir le controle 10).
--
-- POURQUOI IL EXISTE. La cle anon est publique, lisible dans un fichier
-- JavaScript du site. Les politiques de securite par ligne sont le SEUL mur. Une
-- relecture attentive ne prouve rien : il faut deux comptes, et de vraies
-- requetes refusees.
--
-- COMMENT ON L'A LANCE le 13/09/2026 (PostgreSQL 16 dans un conteneur jetable) :
--   initdb -D /tmp/pgtest -A trust
--   pg_ctl -D /tmp/pgtest -o "-k /tmp/pgsock" start
--   psql -h /tmp/pgsock -d postgres -v ON_ERROR_STOP=1 -f banc-lot15-cloison.sql
--   psql -h /tmp/pgsock -d postgres -f lot15-bureaux.sql      (deux fois : rejouable)
--   puis la section CONTROLES du bas, en retirant le commentaire.
--
-- CE QU'IL DEVIENDRA. Au lot 2, quand les six tables de donnees basculeront sur
-- le bureau, ce fichier devient `scripts/banc-cloison.mjs` et parle a la VRAIE
-- base par de VRAIS appels HTTP avec deux VRAIS jetons. Un controle SQL prouve
-- que les politiques sont justes ; il ne prouve pas que PostgREST les applique
-- comme on croit. Les deux ne se remplacent pas.

-- ---------------------------------------------------------------------------
-- LE DECOR : ce que Supabase fournit et qu'un Postgres nu n'a pas
-- ---------------------------------------------------------------------------
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
grant usage on schema public to anon, authenticated, service_role;

-- INDISPENSABLE, et c'est le piege du decor : Supabase accorde ALL par defaut a
-- `anon` et `authenticated` sur toute table neuve du schema public. Sans cette
-- ligne, le `revoke all` du lot 15 ne retire rien et le banc valide un mur qui
-- n'a jamais ete construit.
alter default privileges in schema public grant all on tables to anon, authenticated;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);

-- `auth.uid()` se pilote ici par un reglage de session : c'est ce qui permet de
-- se faire passer pour Alice puis pour Bob dans le meme psql.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- La table `profils` reduite a ce que le lot 15 touche.
create table public.profils (
  id uuid primary key references auth.users on delete cascade,
  email text not null, prenom text, nom text, domaine text,
  cree_le timestamptz not null default now()
);
alter table public.profils enable row level security;
create policy "lire sa fiche" on public.profils for select using (auth.uid() = id);
create policy "modifier sa fiche" on public.profils for update
  using (auth.uid() = id) with check (auth.uid() = id);
revoke insert, delete, update on public.profils from anon, authenticated;
grant select on public.profils to authenticated;
grant update (prenom, nom, domaine) on public.profils to authenticated;

create or replace function public.creer_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profils (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
create trigger creer_profil_apres_inscription after insert on auth.users
  for each row execute function public.creer_profil();

-- Deux comptes inscrits AVANT la migration, dont un seul a renseigne son domaine.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','alice@exemple.fr'),
  ('22222222-2222-2222-2222-222222222222','bob@exemple.fr');
update public.profils set domaine = 'Domaine des Hauts Coteaux' where email = 'alice@exemple.fr';

-- ===========================================================================
-- ICI, PASSER supabase/lot15-bureaux.sql. DEUX FOIS.
-- ===========================================================================
-- Le second passage ne doit produire que des NOTICE « already exists », aucune
-- erreur, et ne doit PAS creer un deuxieme bureau par personne.

-- ---------------------------------------------------------------------------
-- LES CONTROLES, et le verdict attendu de chacun
-- ---------------------------------------------------------------------------
-- 1. MIGRATION. Deux lignes : Alice sur « Domaine des Hauts Coteaux », Bob sur
--    son adresse faute de domaine. Les deux maitres, les deux bureaux courants poses.
--      select p.email, b.nom, m.role, (p.bureau_courant = b.bureau) as courant
--        from public.profils p join public.membres m on m.personne = p.id
--        join public.bureaux b on b.bureau = m.bureau order by p.email;
--
-- 2. INSCRIPTION NEUVE. Carole doit ressortir maitre de « Mon bureau ».
--      insert into auth.users (id, email)
--        values ('33333333-3333-3333-3333-333333333333','carole@exemple.fr');
--
-- 3. CLOISON. Alice ne voit QU'UN bureau et QU'UNE ligne de membre.
--      set role authenticated; set test.uid = '11111111-1111-1111-1111-111111111111';
--      select count(*) from public.bureaux;   -- 1
--      select count(*) from public.membres;   -- 1
--
-- 4. ELEVATION. S'ajouter comme maitre ailleurs : « permission denied for table membres ».
--      insert into public.membres (bureau, personne, role)
--        select bureau, '11111111-...', 'maitre' from public.bureaux limit 1;
--
-- 5. ELEVATION, l'autre chemin. Se promouvoir sur sa propre ligne : meme refus.
--      update public.membres set role = 'maitre' where personne = '11111111-...';
--
-- 6. RENOMMER LE BUREAU D'UN AUTRE : UPDATE 0, et le nom de Bob reste intact.
--    Ne pas lancer psql avec -q : c'est le compte de lignes qui est le verdict.
--
-- 7. BUREAU COURANT VOLE. Se poser le bureau de Bob :
--    « ce compte n'est pas membre de ce bureau ».
--
-- 8. LE GESTE LEGITIME PASSE. Renommer SON bureau : UPDATE 1. Un banc qui ne
--    verifie que des refus valide une base ou plus rien ne marche.
--
-- 9. COLONNE NON ACCORDEE. `update bureaux set cree_par = null` sur son propre
--    bureau : « permission denied ». Le grant est colonne par colonne, pas table.
--
-- 10. DERNIER MAITRE. Retrograder le seul maitre d'un bureau :
--     « ce bureau n'aurait plus aucun maitre ». Le declencheur tient meme en
--     superutilisateur, donc meme depuis l'editeur SQL de Supabase.
--
-- 11. LES DROITS. `role_table_grants` doit rendre SELECT seul, et zero ligne
--     pour `anon`. LE DEFAUT TROUVE PAR CE BANC : le `grant update (nom)`
--     n'apparait pas dans cette vue, il vit dans `column_privileges`. Le
--     controle ecrit dans le lot 15 affirmait le contraire, il aurait fait
--     conclure a un grant rate. Corrige le jour meme.
