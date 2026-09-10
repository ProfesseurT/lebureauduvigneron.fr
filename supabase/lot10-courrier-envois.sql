-- ============================================================================
-- LOT 10  LE JOURNAL DES ENVOIS DU COURRIER DU MATIN
-- ============================================================================
-- A COLLER DANS L'EDITEUR SQL DE SUPABASE, projet qukmncqqwomhmrdhvetj.
-- Pas par le MCP : depuis que `profils` contient des adresses de vignerons, la
-- decision du 01/09/2026 est que tout DDL repasse a la main. Ce fichier est
-- rejouable.
--
-- CE QU'IL EMPECHE, ET C'EST LA SEULE RAISON DE SON EXISTENCE.
-- Le declencheur du lot 4 appelle la fonction d'envoi TOUTES LES HEURES. Sans
-- cette table, deux appels dans la meme journee envoient deux mails. Ca arrive
-- de trois facons, et aucune n'est theorique : le declencheur qui repasse, un
-- essai a la main un jour ou le mail est deja parti, et une relance apres une
-- reponse reseau perdue.
--
-- UN MAIL EN DOUBLE N'EST PAS UN PETIT DEFAUT. C'est celui qui apprend a ne
-- plus ouvrir le mail, exactement comme la tache sans date qui reparait chaque
-- matin. Le cout d'un mail manquant est un desagrement d'un jour ; le cout d'un
-- mail double est un lecteur perdu.
--
-- POURQUOI LA CLE PRIMAIRE EST (compte, jour), ET PAS UN `id` AVEC UN INDEX.
-- La cle primaire EST le garde-fou. Ce n'est pas la fonction qui verifie puis
-- ecrit -- entre le « verifier » et le « ecrire » d'un tel code, un second
-- appel passe. C'est Postgres qui refuse la deuxieme ligne, et il le fait sans
-- laisser d'intervalle. Le controle 2.4 en bas le prouve.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. LA TABLE
-- ---------------------------------------------------------------------------
create table if not exists public.courrier_envois (
  compte     uuid        not null references public.profils (id) on delete cascade,
  jour       date        not null,
  reserve_le timestamptz not null default now(),
  sujet      text,
  resend_id  text,
  echec      text,
  primary key (compte, jour)
);

-- POURQUOI `reserve_le` ET PAS `envoye_le`. La ligne est ecrite AVANT l'appel a
-- Resend, pas apres. Elle dit « ce compte est pris pour aujourd'hui », et c'est
-- ce que la fonction a besoin de savoir. `resend_id` se remplit apres, quand
-- Resend a repondu ; `echec` se remplit a la place s'il a refuse.
--
-- UNE LIGNE AVEC `echec` RESTE POSEE, ET C'EST UN ARBITRAGE, PAS UN OUBLI.
-- Un refus de Resend ne dit pas si le mail est parti ou non : une reponse
-- perdue ressemble a un refus. Effacer la ligne pour permettre une nouvelle
-- tentative reintroduit donc le doublon qu'on vient d'interdire. La fonction ne
-- reprend jamais toute seule ; la reprise se demande a la main, `?rejouer=1`,
-- et elle n'efface que les lignes qui portent un `echec`.

-- ---------------------------------------------------------------------------
-- 2. LA SECURITE : PERSONNE, SAUF LA FONCTION
-- ---------------------------------------------------------------------------
-- Cette table n'a AUCUNE politique, et c'est voulu. RLS active sans politique
-- veut dire : aucune ligne visible, pour aucun compte connecte. Seule la cle
-- `service_role`, qui court-circuite RLS et ne quitte jamais les secrets
-- Supabase, y accede. Un vigneron n'a rien a y lire : ce journal ne lui
-- apprendrait rien qu'il ne voie deja dans sa boite.
alter table public.courrier_envois enable row level security;

-- `revoke all` D'ABORD, sur anon ET sur authenticated, puis n'accorder RIEN.
-- Regle apprise le 09/09/2026 sur la vue v_courrier : Supabase pose des droits
-- par defaut sur le schema public, toute table neuve arrive avec INSERT,
-- UPDATE, DELETE, TRUNCATE, REFERENCES et TRIGGER deja accordes a
-- `authenticated`. Ne jamais partir du principe qu'un objet neuf arrive nu.
revoke all on public.courrier_envois from anon, authenticated;

comment on table public.courrier_envois is
  'Un envoi du courrier du matin par compte et par jour. La cle primaire '
  '(compte, jour) EST le garde-fou anti-doublon : c''est Postgres qui refuse le '
  'second envoi, pas la fonction. Ligne posee AVANT l''appel a Resend. Une '
  'ligne portant `echec` reste en place et ne se rejoue qu''a la main, '
  '?rejouer=1 : un refus de Resend ne dit pas si le mail est parti.';

-- ---------------------------------------------------------------------------
-- 3. LES CONTROLES, a passer juste apres avoir colle ce qui precede
-- ---------------------------------------------------------------------------
-- 3.1  La cle primaire est bien sur les deux colonnes.
--      Attendu : courrier_envois_pkey  PRIMARY KEY (compte, jour)
select conname, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.courrier_envois'::regclass
 order by conname;

-- 3.2  RLS active, et AUCUNE politique. Attendu : true, puis 0.
select relrowsecurity as rls_active
  from pg_class where oid = 'public.courrier_envois'::regclass;
select count(*) as politiques
  from pg_policies where schemaname = 'public' and tablename = 'courrier_envois';

-- 3.3  Aucun droit pour anon ni authenticated. Attendu : zero ligne.
--      Si une ligne remonte ici, le `revoke` de la section 2 n'a pas porte.
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name   = 'courrier_envois'
   and grantee in ('anon', 'authenticated')
 order by grantee, privilege_type;

-- 3.4  LE CONTROLE QUI COMPTE : la double coche est refusee par la base.
--      Deux insertions du meme compte le meme jour, la seconde doit etre
--      ignoree. Attendu : 1. Si ce controle rend 2, tout le lot 4 est a
--      refuser, et le mail partira en double le premier jour ou le
--      declencheur repassera.
insert into public.courrier_envois (compte, jour, sujet)
select id, '1999-01-01'::date, 'controle' from public.profils limit 1
on conflict do nothing;

insert into public.courrier_envois (compte, jour, sujet)
select id, '1999-01-01'::date, 'controle bis' from public.profils limit 1
on conflict do nothing;

select count(*) as lignes_attendu_1
  from public.courrier_envois where jour = '1999-01-01';

-- 3.5  On efface la trace du controle. A ne pas oublier : une ligne au
--      01/01/1999 ne genera rien, mais une trace de test qui survit finit
--      toujours par etre lue comme une donnee.
delete from public.courrier_envois where jour = '1999-01-01';
