-- Le Bureau du Vigneron, lot 1 : socle des comptes.
-- A coller tel quel dans l'editeur SQL Supabase (projet qukmncqqwomhmrdhvetj, West EU Ireland).
-- Pas de CLI Supabase dans ce depot statique : ce fichier est la version versionnee, il n'est
-- pas execute par le depot. Il remplace les deux blocs qui etaient separes (schema + grants).
--
-- Ecrit pour etre rejouable sans erreur. Un script a moitie passe dans un onglet de navigateur
-- est le pire etat a deboguer, et c'est le seul mode d'execution qu'on a ici.

-- ---------------------------------------------------------------------------
-- 1. La table
-- ---------------------------------------------------------------------------
-- Aucune colonne n'accueille de donnee de vente. Un besoin de stockage d'analyse fera l'objet
-- d'un arbitrage a part (voir CLAUDE.md : les lignes de vente ne quittent pas le navigateur).
create table if not exists public.profils (
  id             uuid primary key references auth.users on delete cascade,
  email          text not null,
  prenom         text,
  nom            text,
  domaine        text,
  code_postal    text,
  profil         text,             -- vigneron / etudiant / pro-filiere
  outil_origine  text,             -- par quel outil il est entre
  consent_news   boolean not null default false,
  cree_le        timestamptz not null default now(),
  vu_le          timestamptz not null default now()
);

alter table public.profils enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Les politiques RLS
-- ---------------------------------------------------------------------------
drop policy if exists "lire sa fiche" on public.profils;
create policy "lire sa fiche"
  on public.profils for select
  using (auth.uid() = id);

-- Le `with check` est explicite alors que Postgres le deduirait du `using` : il interdit de
-- reecrire `id` avec l'identifiant d'un autre compte, et le dire noir sur blanc evite qu'une
-- relecture future le supprime en croyant simplifier.
drop policy if exists "modifier sa fiche" on public.profils;
create policy "modifier sa fiche"
  on public.profils for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Pas de politique d'insertion ni de suppression : la ligne nait et meurt par declencheur ou
-- par cascade, jamais par le client.

-- ---------------------------------------------------------------------------
-- 3. Les droits, colonne par colonne
-- ---------------------------------------------------------------------------
-- Supabase accorde ALL a anon et authenticated par defaut sur le schema public. Sans ce bloc,
-- la politique d'update autorise toutes les colonnes : un compte peut reecrire son propre champ
-- `email` avec l'adresse de quelqu'un d'autre, ce qui pollue la liste de diffusion sans laisser
-- de trace. Le droit se restreint donc colonne par colonne.
revoke insert, delete on public.profils from anon, authenticated;
revoke update on public.profils from anon, authenticated;
grant update (prenom, nom, domaine, code_postal, profil, outil_origine, consent_news, vu_le,
              utilise_vitisoft)
  on public.profils to authenticated;

-- `id`, `email` et `cree_le` sont volontairement absents de ce grant. Les declencheurs des
-- sections 4 et 5 sont SECURITY DEFINER : ils ecrivent malgre ces revoke, seul chemin autorise.

-- ---------------------------------------------------------------------------
-- 4. Naissance de la fiche
-- ---------------------------------------------------------------------------
create or replace function public.creer_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profils (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists creer_profil_apres_inscription on auth.users;
create trigger creer_profil_apres_inscription
  after insert on auth.users
  for each row execute function public.creer_profil();

-- ---------------------------------------------------------------------------
-- 5. Synchronisation de l'adresse
-- ---------------------------------------------------------------------------
-- Ajoute le 01/09/2026 avec le passage au mot de passe. `PUT /auth/v1/user`, que le code appelle
-- maintenant pour changer le mot de passe, accepte aussi un champ `email`. Le declencheur de la
-- section 4 ne recopie l'adresse qu'a l'insertion, et la section 3 interdit au compte de toucher
-- `profils.email` : sans ce second declencheur, un changement d'adresse cote GoTrue laisserait
-- une adresse perimee dans `profils` que rien ne pourrait corriger.
-- La condition `is distinct from` evite de reecrire la ligne a chaque connexion, car GoTrue met
-- `auth.users` a jour bien plus souvent que l'adresse ne change.
create or replace function public.synchroniser_email_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profils set email = new.email where id = new.id;
  return new;
end $$;

drop trigger if exists synchroniser_email_apres_maj on auth.users;
create trigger synchroniser_email_apres_maj
  after update on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.synchroniser_email_profil();

-- ===========================================================================
-- LOT 2, ajoute le 04/09/2026 : les donnees du vigneron passent en base.
-- ===========================================================================
-- Decision de Ted du 04/09/2026 : les reglages, le suivi client ET les lignes de vente sont
-- stockes sur le serveur et redistribues a la demande. La promesse « rien ne quitte ton
-- navigateur » ne s'applique plus. Les questions juridiques (annexe de sous-traitance),
-- de securite et l'arbitrage avec l'associe sont explicitement reportees a plus tard :
-- rien n'est deploye chez un client a cette date.
--
-- Consequence a garder en tete a chaque relecture : la cle anon est publique, elle vit dans
-- un fichier JavaScript que n'importe qui peut lire. Tout ce qui protege ces trois tables
-- tient dans les politiques ci-dessous. Une seule mal ecrite, et c'est le fichier client
-- complet de tous les vignerons qui devient lisible.

-- ---------------------------------------------------------------------------
-- 6. Les reglages du tableau de bord
-- ---------------------------------------------------------------------------
-- Une ligne par vigneron. Remplace bdv_objectif_v5, bdv_exercice_v1 et bdv_persolabels_v4,
-- qui vivaient dans le localStorage et disparaissaient avec le navigateur.
create table if not exists public.reglages (
  id              uuid primary key references auth.users on delete cascade,
  objectif        numeric,          -- objectif de chiffre d'affaires, null = aucun
  exercice_debut  smallint,         -- mois d'ouverture de l'exercice, 1 a 12, 1 = annee civile
  perso_labels    jsonb not null default '{}'::jsonb,
  classement      jsonb,            -- l'ecran Reglages : regroupements choisis par le vigneron
  maj_le          timestamptz not null default now()
);

alter table public.reglages enable row level security;

drop policy if exists "lire ses reglages" on public.reglages;
create policy "lire ses reglages" on public.reglages for select using (auth.uid() = id);
drop policy if exists "creer ses reglages" on public.reglages;
create policy "creer ses reglages" on public.reglages for insert with check (auth.uid() = id);
drop policy if exists "modifier ses reglages" on public.reglages;
create policy "modifier ses reglages" on public.reglages for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "supprimer ses reglages" on public.reglages;
create policy "supprimer ses reglages" on public.reglages for delete using (auth.uid() = id);

revoke all on public.reglages from anon;
grant select, insert, update, delete on public.reglages to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Le suivi client, pose a la main par le vigneron
-- ---------------------------------------------------------------------------
-- Jamais deduit des ventes. Remplace bdv_crm_v1.
-- `client_id` est le NUMERO client Vitisoft, seul. Decision du 04/09/2026 : Ted confirme que
-- la colonne est toujours remplie. Le nom ne sert plus qu'a l'affichage, pour qu'une fiche ne
-- s'orpheline pas le jour ou le vigneron corrige une orthographe dans Vitisoft.
create table if not exists public.suivi_clients (
  id         uuid not null references auth.users on delete cascade,
  client_id  text not null,
  statut     text,               -- a_faire / relance / traite
  notes      text,               -- texte libre. Voir l'avertissement en tete de ce lot.
  rappel     date,
  canal      text,
  tags       text[] not null default '{}',
  maj_le     timestamptz not null default now(),
  primary key (id, client_id)
);

alter table public.suivi_clients enable row level security;

drop policy if exists "lire son suivi" on public.suivi_clients;
create policy "lire son suivi" on public.suivi_clients for select using (auth.uid() = id);
drop policy if exists "creer son suivi" on public.suivi_clients;
create policy "creer son suivi" on public.suivi_clients for insert with check (auth.uid() = id);
drop policy if exists "modifier son suivi" on public.suivi_clients;
create policy "modifier son suivi" on public.suivi_clients for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "supprimer son suivi" on public.suivi_clients;
create policy "supprimer son suivi" on public.suivi_clients for delete using (auth.uid() = id);

revoke all on public.suivi_clients from anon;
grant select, insert, update, delete on public.suivi_clients to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Les lignes de vente
-- ---------------------------------------------------------------------------
-- La ligne est stockee BRUTE, telle que lue dans le CSV, et rien d'autre. C'est volontaire.
-- Tout le calcul reste dans le navigateur : le serveur ne fait que garder et rendre. Ajouter
-- ici des colonnes derivees (le CA, le canal, la famille) creerait une seconde verite qui
-- divergerait du jour ou classerLigne() change d'avis, sans que rien ne le signale.
--
-- `empreinte` est le cyrb53 deja calcule par le tableau de bord sur les 40 premieres colonnes.
-- La contrainte d'unicite fait la deduplication cote serveur pour rien : un reimport passe en
-- `on conflict do nothing` et ne cree pas de doublon, meme si deux appareils importent le meme
-- export en meme temps. Elle ne remplace pas la deduplication locale, elle la double.
--
-- ATTENTION, la meme regle qu'en local : HASH_COLS ne bouge jamais. Changer le nombre de
-- colonnes de l'empreinte cote navigateur rendrait toutes les lignes deja en base
-- meconnaissables, et le reimport doublerait le chiffre d'affaires en silence.
create table if not exists public.ventes (
  id         uuid not null references auth.users on delete cascade,
  empreinte  text not null,
  brut       jsonb not null,      -- le tableau des 43 colonnes, dans l'ordre du CSV
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now(),
  primary key (id, empreinte)
);

-- Le tableau de bord recharge tout au demarrage puis calcule en memoire : l'index qui compte
-- est celui du proprietaire. La cle primaire (id, empreinte) le fournit deja par son prefixe.
-- Cet index sert la synchronisation incrementale, « donne moi ce qui a change depuis ».
create index if not exists ventes_maj_le on public.ventes (id, maj_le);

alter table public.ventes enable row level security;

drop policy if exists "lire ses ventes" on public.ventes;
create policy "lire ses ventes" on public.ventes for select using (auth.uid() = id);
drop policy if exists "creer ses ventes" on public.ventes;
create policy "creer ses ventes" on public.ventes for insert with check (auth.uid() = id);
drop policy if exists "modifier ses ventes" on public.ventes;
create policy "modifier ses ventes" on public.ventes for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "supprimer ses ventes" on public.ventes;
create policy "supprimer ses ventes" on public.ventes for delete using (auth.uid() = id);

revoke all on public.ventes from anon;
grant select, insert, update, delete on public.ventes to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Tout effacer, en un seul geste
-- ---------------------------------------------------------------------------
-- Le vigneron doit pouvoir tout retirer sans nous ecrire. SECURITY DEFINER mais borne a
-- auth.uid() : la fonction ne peut effacer que les lignes de celui qui l'appelle, jamais
-- celles d'un autre, meme appelee avec un identifiant force.
create or replace function public.effacer_mes_donnees()
returns void language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid();
begin
  if moi is null then raise exception 'aucune session'; end if;
  delete from public.ventes        where id = moi;
  delete from public.suivi_clients where id = moi;
  delete from public.reglages      where id = moi;
end $$;

revoke all on function public.effacer_mes_donnees() from public, anon;
grant execute on function public.effacer_mes_donnees() to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Fermer les fonctions de declencheur a l'API
-- ---------------------------------------------------------------------------
-- Ajoute le 04/09/2026 apres un controle de securite. Les fonctions des sections 4 et 5 sont
-- des fonctions de DECLENCHEUR : elles n'ont jamais eu besoin d'un droit d'execution, un
-- declencheur s'executant avec les droits du proprietaire de la table et pas de l'appelant.
-- Le droit par defaut les rendait pourtant appelables a la main via /rest/v1/rpc/, y compris
-- sans session. Un appel direct echouerait (elles lisent `new`), mais une fonction
-- SECURITY DEFINER joignable de l'exterieur n'a rien a faire dans une surface publique.
revoke all on function public.creer_profil() from public, anon, authenticated;
revoke all on function public.synchroniser_email_profil() from public, anon, authenticated;


-- ===========================================================================
-- LOT 3, ajoute le 06/09/2026 : le bureau connecte.
-- ===========================================================================
-- Le compte s'ouvre a toute la filiere, pas seulement aux clients Vitisoft. Ce qu'il apporte
-- des le premier jour : mettre de cote ce qu'on veut relire, et etre reconnu par les ecrans
-- qui s'adaptent. Le tableau de bord des ventes reste, lui, reserve a Vitisoft.

-- ---------------------------------------------------------------------------
-- 11. La troisieme question de l'inscription
-- ---------------------------------------------------------------------------
-- Texte et pas booleen : « je ne sais pas » est une reponse frequente et utile, un booleen
-- l'ecraserait sur `null`, qui veut deja dire « n'a pas repondu ». Les deux ne se confondent
-- pas : l'un se redemande, l'autre non.
alter table public.profils add column if not exists utilise_vitisoft text;  -- oui / non / inconnu

-- Le grant de la section 3 a ete etendu a cette colonne. `id`, `email` et `cree_le` restent
-- dehors : un compte ne reecrit jamais sa propre identite.

-- ---------------------------------------------------------------------------
-- 12. Les signets
-- ---------------------------------------------------------------------------
-- Ce que le vigneron met de cote. Sans cette table les signets vivraient dans le localStorage
-- et mourraient avec le navigateur : le compte n'apporterait alors rien du tout.
--
-- `ref` est l'adresse du contenu sur le site (`/posts/marketing-sensoriel-vin/`), pas un
-- identifiant interne. C'est volontaire : le site est statique, il n'a pas de base d'articles,
-- et l'adresse est la seule cle qui existe des deux cotes. Consequence assumee : renommer un
-- article orpheline ses signets. Un article renomme doit donc garder une redirection.
--
-- `titre` est une copie d'affichage. Elle evite d'avoir a resoudre vingt adresses pour
-- dessiner la liste, et elle survit a la disparition d'un contenu.
create table if not exists public.signets (
  id       uuid not null references auth.users on delete cascade,
  ref      text not null,
  type     text not null default 'article',   -- article / video / outil
  etat     text not null default 'a_lire',    -- a_lire / lu
  titre    text,
  cree_le  timestamptz not null default now(),
  maj_le   timestamptz not null default now(),
  primary key (id, ref)
);

-- « Ce que j'ai mis de cote, du plus recent au plus ancien » est la seule lecture de l'ecran.
create index if not exists signets_maj_le on public.signets (id, maj_le desc);

alter table public.signets enable row level security;

drop policy if exists "lire ses signets" on public.signets;
create policy "lire ses signets" on public.signets for select using (auth.uid() = id);
drop policy if exists "creer ses signets" on public.signets;
create policy "creer ses signets" on public.signets for insert with check (auth.uid() = id);
drop policy if exists "modifier ses signets" on public.signets;
create policy "modifier ses signets" on public.signets for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "supprimer ses signets" on public.signets;
create policy "supprimer ses signets" on public.signets for delete using (auth.uid() = id);

revoke all on public.signets from anon;
grant select, insert, update, delete on public.signets to authenticated;

-- Volontairement PAS ajoutee a effacer_mes_donnees(). Cette fonction est appelee par le bouton
-- « Vider la base » du tableau de bord, qui parle des lignes de vente : quelqu'un qui reimporte
-- un export propre ne s'attend pas a y perdre ses articles mis de cote. La suppression complete
-- d'un compte est un autre geste, a ecrire a part le jour ou elle existera.

-- ===========================================================================
-- LOT 4, ajoute le 06/09/2026 : le journal d'echanges.
-- ===========================================================================
-- Le suivi client portait UNE note, un seul champ de texte : ecrire quelque chose en
-- septembre effacait ce qu'on avait note en aout. Un suivi commercial a besoin d'une pile
-- d'entrees datees, pas d'un bloc-notes qu'on ecrase.
--
-- ATTENTION, ces lignes sont des notes sur des personnes reelles, ecrites a la main par le
-- vigneron sur ses propres clients. Elles ne servent QU'A lui les rendre. Aucune lecture
-- croisee, aucune statistique, aucun ciblage : c'est ecrit dans la page de confidentialite
-- et ca ne se negocie pas.

-- ---------------------------------------------------------------------------
-- 13. Les echanges
-- ---------------------------------------------------------------------------
-- `echange_id` est genere par le navigateur, comme `empreinte` pour les ventes. La cle
-- primaire (id, echange_id) fait la deduplication cote serveur pour rien : reimporter deux
-- fois le meme geste ne cree pas de doublon, meme depuis deux appareils.
--
-- `type` reste du texte libre plutot qu'une enumeration Postgres : ajouter un type de geste
-- ne doit pas demander une migration. Les valeurs utilisees a ce jour : appel, message,
-- note, ecarte.
--
-- `le` est la date de CE QUI S'EST PASSE, `maj_le` celle de la derniere retouche du texte.
-- Une ligne dont les deux sont egales n'a jamais ete corrigee, et c'est ce que l'ecran
-- compare pour afficher « corrigé le ». Le defaut now() de maj_le est donc un piege pour
-- qui ecrit : une entree qui ne porte pas maj_le se fait horodater a l'arrivee de la
-- requete, et les cent millisecondes du reseau la font naitre « corrigee ». Toute
-- ecriture d'echange envoie les deux colonnes, a la meme valeur (voir bdv-crm.js).
create table if not exists public.echanges (
  id         uuid not null references auth.users on delete cascade,
  echange_id text not null,
  client_id  text not null,
  le         timestamptz not null default now(),
  type       text not null,
  canal      text,
  resume     text,
  maj_le     timestamptz not null default now(),
  primary key (id, echange_id)
);

-- Posee en base le 06/09/2026 avec la correction d'une entree, et absente de ce fichier
-- jusqu'au 07/09/2026 : une base creee depuis ce script refusait alors toute ecriture
-- d'echange, la colonne etant inconnue de PostgREST.
alter table public.echanges add column if not exists maj_le timestamptz not null default now();

-- La seule lecture de l'ecran : « l'historique de ce client, du plus recent au plus ancien ».
create index if not exists echanges_client on public.echanges (id, client_id, le desc);

alter table public.echanges enable row level security;

drop policy if exists "lire ses echanges" on public.echanges;
create policy "lire ses echanges" on public.echanges for select using (auth.uid() = id);
drop policy if exists "creer ses echanges" on public.echanges;
create policy "creer ses echanges" on public.echanges for insert with check (auth.uid() = id);
drop policy if exists "modifier ses echanges" on public.echanges;
create policy "modifier ses echanges" on public.echanges for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "supprimer ses echanges" on public.echanges;
create policy "supprimer ses echanges" on public.echanges for delete using (auth.uid() = id);

revoke all on public.echanges from anon;
grant select, insert, update, delete on public.echanges to authenticated;

-- ---------------------------------------------------------------------------
-- 14. Tout effacer : les echanges partent avec le reste
-- ---------------------------------------------------------------------------
-- Contrairement aux signets, les echanges SONT des donnees de suivi commercial : ils
-- suivent le meme sort que les ventes et le suivi client.
create or replace function public.effacer_mes_donnees()
returns void language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid();
begin
  if moi is null then raise exception 'aucune session'; end if;
  delete from public.echanges      where id = moi;
  delete from public.ventes        where id = moi;
  delete from public.suivi_clients where id = moi;
  delete from public.reglages      where id = moi;
end $$;

revoke all on function public.effacer_mes_donnees() from public, anon;
grant execute on function public.effacer_mes_donnees() to authenticated;


-- ===========================================================================
-- LOT 5, ajoute le 06/09/2026 : la file de travail passe dans le bureau.
-- ===========================================================================
-- Decision de Ted : le poste de travail, c'est /mon-bureau/, pas le tableau de bord.
-- Mais la file a besoin des moteurs d'analyse (decrochage, cadence, premier achat) qui
-- tournent sur les lignes de vente, dans le tableau de bord.
--
-- Recopier ces calculs cote site serait la pire decision possible : deux moteurs qui
-- divergent, et un bureau qui signale un client que le tableau de bord ne signale plus.
-- Donc le tableau de bord CALCULE et DEPOSE, le bureau LIT et AGIT.
--
-- Consequence, et c'est elle qui justifie tout le lot : la file devient utilisable depuis
-- un telephone sur lequel aucun export n'a jamais ete importe.

alter table public.reglages add column if not exists file_travail jsonb;
alter table public.reglages add column if not exists resume_ventes jsonb;
alter table public.reglages add column if not exists depose_le timestamptz;

-- Les droits de la section 6 couvrent deja ces colonnes : `grant select, insert, update,
-- delete on public.reglages to authenticated` porte sur la table entiere, pas colonne par
-- colonne, contrairement a `profils`. Rien a ajouter.
