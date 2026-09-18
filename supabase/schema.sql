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
-- POSEE ICI, ET PAS 200 LIGNES PLUS BAS. Le `grant update` juste en dessous nomme
-- cette colonne. Elle n'etait declaree qu'en section 12 : sur une base NEUVE ce
-- fichier mourait a la ligne suivante, et rien de ce qui suit ne passait. Mesure
-- du 18/09/2026 par rejeu reel sur un Postgres 16 vide, voir npm run banc:rejeu.
alter table public.profils add column if not exists utilise_vitisoft text;  -- oui / non / inconnu

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
  -- Le motif du rappel, 11/09/2026 (lot 14). Facultatif. Vit et meurt avec `rappel`.
  rappel_titre text,
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
-- 14. Tout effacer : les echanges partent avec le reste, LES REGLAGES NON
-- ---------------------------------------------------------------------------
-- Contrairement aux signets, les echanges SONT des donnees de suivi commercial : ils
-- suivent le meme sort que les ventes et le suivi client.
--
-- CORRIGE LE 08/09/2026, cf. supabase/lot6-vider-la-base.sql. Cette fonction faisait un
-- DELETE sur la ligne entiere de `reglages`. Cette ligne porte deux natures : ce qui
-- DECRIT la base (file_travail, resume_ventes, depose_le, deposes par le tableau de bord)
-- et ce que le VIGNERON a choisi (objectif, exercice_debut, perso_labels, classement).
-- « Vider la base » effacait les deux, sans le dire, et de facon invisible sur le poste
-- de celui qui cliquait : l'objectif reste dans son navigateur et repart en base au geste
-- suivant. Il ne perdait donc rien chez lui, et tout sur son deuxieme appareil.
create or replace function public.effacer_mes_donnees()
returns void language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid();
begin
  if moi is null then raise exception 'aucune session'; end if;
  delete from public.echanges      where id = moi;
  delete from public.ventes        where id = moi;
  delete from public.suivi_clients where id = moi;
  -- La ligne SURVIT : on ne vide que ce qui est le reflet des ventes qu'on vient d'effacer.
  update public.reglages
     set file_travail = null, resume_ventes = null, depose_le = null, maj_le = now()
   where id = moi;
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


-- ===========================================================================
-- LOT 5, ajoute le 07/09/2026 : MES TACHES
-- ===========================================================================
-- Le bureau savait dire ce qui tombait (DRM, DAI, recolte) sans jamais pouvoir
-- apprendre que c'etait fait, et le vigneron n'avait aucun endroit pour noter ce
-- qu'aucun calcul ne peut deviner. Cette piece repond aux deux.
--
-- Le detail des choix, l'occurrence dans l'identifiant et la raison pour laquelle
-- decocher supprime la ligne sont ecrits en tete de supabase/lot5-taches.sql, dont
-- ces lignes sont la copie. Ne pas en garder deux versions qui divergent : ce
-- fichier est la reference, l'autre est ce qu'on colle.

-- ---------------------------------------------------------------------------
-- 14. Les taches
-- ---------------------------------------------------------------------------
create table if not exists public.taches (
  id        uuid not null references auth.users on delete cascade,
  tache_id  text not null,
  titre     text,
  source    text not null default 'libre',   -- libre / echeance
  ref       text,                            -- pour une obligation : sa cle (drm, dai...)
  echue_le  date,
  fait_le   timestamptz,                     -- nul = a faire
  cree_le   timestamptz not null default now(),
  maj_le    timestamptz not null default now(),
  primary key (id, tache_id)
);

create index if not exists taches_a_faire on public.taches (id, echue_le) where fait_le is null;

alter table public.taches enable row level security;

drop policy if exists "lire ses taches" on public.taches;
create policy "lire ses taches" on public.taches for select using (auth.uid() = id);
drop policy if exists "creer ses taches" on public.taches;
create policy "creer ses taches" on public.taches for insert with check (auth.uid() = id);
drop policy if exists "modifier ses taches" on public.taches;
create policy "modifier ses taches" on public.taches for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "supprimer ses taches" on public.taches;
create policy "supprimer ses taches" on public.taches for delete using (auth.uid() = id);

revoke all on public.taches from anon;
grant select, insert, update, delete on public.taches to authenticated;

-- PAS dans effacer_mes_donnees(), meme motif que les signets : cette fonction vide
-- LA BASE DE VENTES, pas le compte.


-- ---------------------------------------------------------------------------
-- 15. Reglage de stockage de `ventes`, 08/09/2026
-- ---------------------------------------------------------------------------
-- Constat mesure : 11 878 reecritures de lignes pour 4 939 lignes vivantes, et ZERO en
-- mode economique (HOT). Chaque import reecrit toute la base, index compris, y compris
-- les lignes dont le contenu n'a pas change : `resolution=merge-duplicates` fait un
-- UPDATE sur chaque ligne deja connue.
--
-- Une ligne fait 458 octets, une page 8 ko : a remplissage 100 %, une page contient
-- environ 17 lignes et n'a plus un octet libre. Un UPDATE ne peut donc pas rester sur sa
-- page, il en ecrit une nouvelle et met a jour les deux index. A 90 %, la place laissee
-- suffit, la mise a jour reste sur place et les index ne bougent pas.
--
-- Ne s'applique qu'aux pages ECRITES APRES ce reglage : les pages deja pleines le
-- restent jusqu'a ce qu'elles soient reecrites. Il n'y a rien a forcer, le prochain
-- import en profite.
alter table public.ventes set (fillfactor = 90);


-- ---------------------------------------------------------------------------
-- 16. Les choix de calendrier, 08/09/2026
-- ---------------------------------------------------------------------------
-- Les ECARTS du vigneron par rapport a la bibliotheque du calendrier : le repere
-- qu'il ne suit pas, et celui qu'il decale. Pas la bibliotheque elle-meme, qui
-- vit dans src/_data/echeances.json, ni ses occurrences a lui, qui sont des
-- taches.
--
-- UNE LIGNE N'EXISTE QUE S'IL Y A UN ECART. Suivi et non decale est l'etat par
-- defaut du monde. Rallumer un repere et remettre son decalage a zero SUPPRIME
-- la ligne, comme decocher une obligation dans la table des taches. Sans cette
-- regle, la table porterait une ligne par occurrence et par compte, toutes
-- neutres.
--
-- Ces lignes sont la copie de supabase/lot7-calendrier-choix.sql, qui est ce
-- qu'on colle. Ce fichier-ci est la reference. Ne pas les laisser diverger.

create table if not exists public.calendrier_choix (
  id        uuid not null references auth.users on delete cascade,
  -- La cle de l'occurrence dans src/_data/echeances.json (drm, taille, vendanges...).
  -- Jamais une cle de tache : une tache se supprime, elle ne s'eteint pas.
  cle       text not null,
  actif     boolean not null default true,
  -- Le decalage en JOURS, positif ou negatif. Une taille en fevrier n'est pas la
  -- meme en Loire et dans l'Herault ; le repere se deplace, l'obligation non.
  -- La borne n'est pas decorative : sans elle, un 3000 tape a la place de 30
  -- deplacerait le repere de huit ans sans que rien ne le signale.
  decale_de smallint not null default 0 check (decale_de between -180 and 180),
  maj_le    timestamptz not null default now(),
  primary key (id, cle)
);

alter table public.calendrier_choix enable row level security;

drop policy if exists "lire ses choix de calendrier" on public.calendrier_choix;
create policy "lire ses choix de calendrier" on public.calendrier_choix
  for select using (auth.uid() = id);
drop policy if exists "creer ses choix de calendrier" on public.calendrier_choix;
create policy "creer ses choix de calendrier" on public.calendrier_choix
  for insert with check (auth.uid() = id);
drop policy if exists "modifier ses choix de calendrier" on public.calendrier_choix;
create policy "modifier ses choix de calendrier" on public.calendrier_choix
  for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "supprimer ses choix de calendrier" on public.calendrier_choix;
create policy "supprimer ses choix de calendrier" on public.calendrier_choix
  for delete using (auth.uid() = id);

revoke all on public.calendrier_choix from anon;
grant select, insert, update, delete on public.calendrier_choix to authenticated;

-- PAS dans effacer_mes_donnees(), meme motif que les signets et les taches :
-- cette fonction vide LA BASE DE VENTES, pas le compte.


-- ---------------------------------------------------------------------------
-- 17. Une tache peut durer plusieurs jours, 08/09/2026
-- ---------------------------------------------------------------------------
-- Demande de Ted : « imagine c'est un salon sur plusieurs jours ». La fin est
-- FACULTATIVE ; sans elle la tache tombe un jour, comme avant.
--
-- POURQUOI UNE COLONNE ET PAS UNE DUREE. Les occurrences de la bibliotheque
-- portent une `duree` en jours, parce qu'une regle annuelle recalcule sa fin
-- chaque annee. Une tache ne se repete pas : elle a une vraie date de fin.
--
-- LE RETARD SE COMPTE SUR LA FIN. Un salon du 9 au 11 fevrier n'est pas en
-- retard le 10. C'est une regle d'affichage, elle vit dans le code.
--
-- Copie de supabase/lot8-taches-fin.sql, qui est ce qu'on colle.

alter table public.taches add column if not exists fin_le date;

-- Deux garde-fous, et aucun n'est decoratif :
--   - une fin avant son debut inverserait l'affichage sans rien signaler ;
--   - une fin SANS debut n'a aucun sens, et le calendrier ne saurait pas ou la
--     poser. Le code echange deja les deux dates si elles arrivent a l'envers,
--     mais une contrainte tient meme quand l'ecriture ne vient pas du code.
alter table public.taches drop constraint if exists taches_fin_apres_debut;
alter table public.taches add constraint taches_fin_apres_debut
  check (fin_le is null or (echue_le is not null and fin_le >= echue_le));

-- Rien d'autre a changer : les politiques RLS de `taches` portent sur la ligne
-- entiere, pas sur la liste des colonnes.


-- ===========================================================================
-- LOT 15, ajoute le 13/09/2026 : LE SOCLE DU TRAVAIL A PLUSIEURS.
-- ===========================================================================
-- Ces lignes sont la COPIE de supabase/lot15-bureaux.sql, qui est ce qu'on colle.
-- Ce fichier-ci est la reference. Ne pas les laisser diverger.
--
-- Le raisonnement complet, les arbitrages de Ted et les lots suivants sont dans
-- PLAN_multi-utilisateurs.md, a la racine du depot.
-- 1. Les bureaux
-- ---------------------------------------------------------------------------
-- Un bureau est le PROPRIETAIRE des donnees. C'est tout le chantier : aujourd'hui
-- une ligne de vente appartient a une personne et meurt avec son compte, demain
-- elle appartient au domaine et les personnes n'ont qu'un droit d'acces dessus.
--
-- `cree_par` est en `on delete set null` et PAS en cascade : celui qui a cree le
-- bureau peut partir, le bureau reste. C'est exactement la faute qu'on repare.
create table if not exists public.bureaux (
  bureau   uuid primary key default gen_random_uuid(),
  nom      text not null,
  cree_le  timestamptz not null default now(),
  cree_par uuid references auth.users on delete set null
);

alter table public.bureaux enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Les membres
-- ---------------------------------------------------------------------------
-- Qui a le droit d'entrer dans quel bureau, et a quel titre. Une personne a
-- autant de lignes que de bureaux ou elle travaille : c'est cette table, et elle
-- seule, qui rend le changement de bureau possible.
create table if not exists public.membres (
  bureau     uuid not null references public.bureaux on delete cascade,
  personne   uuid not null references auth.users     on delete cascade,
  role       text not null default 'simple' check (role in ('maitre','simple')),
  depuis     timestamptz not null default now(),
  invite_par uuid references auth.users on delete set null,
  primary key (bureau, personne)
);

-- « Dans quels bureaux est cette personne » est la question posee a chaque
-- ouverture de session. La cle primaire repond a l'autre sens, pas a celui-la.
create index if not exists membres_personne on public.membres (personne);

alter table public.membres enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Les deux fonctions de controle
-- ---------------------------------------------------------------------------
-- ELLES SONT LE COEUR DU DISPOSITIF, ET ELLES EXISTENT POUR UNE RAISON PRECISE.
--
-- Une politique de securite posee sur `membres` qui interrogerait `membres` fait
-- echouer Postgres : « infinite recursion detected in policy for relation
-- membres ». Une fonction `security definer` traverse la securite par ligne, donc
-- la recursion n'a pas lieu. C'est la seule sortie, et c'est le mur sur lequel se
-- cogne tout le monde qui ecrit du multi-utilisateurs sur Supabase.
--
-- `stable` et pas `volatile` : Postgres peut alors n'evaluer la fonction qu'une
-- fois par requete au lieu d'une fois par ligne. Sur une lecture de 5 000 lignes
-- de vente, ce mot-cle est la difference entre une politique gratuite et une
-- politique qui double le temps de reponse.
--
-- `set search_path = public` : sans lui, quelqu'un qui peut poser un schema dans
-- le chemin de recherche detourne l'appel a `membres` vers une table a lui. Meme
-- precaution que sur `effacer_mes_donnees()`.
create or replace function public.est_membre(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.membres m
     where m.bureau = b and m.personne = auth.uid()
  );
$$;

create or replace function public.est_maitre(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.membres m
     where m.bureau = b and m.personne = auth.uid() and m.role = 'maitre'
  );
$$;

-- `authenticated` DOIT pouvoir les executer : une fonction appelee dans une
-- politique s'execute avec les droits de celui qui lit, pas du proprietaire.
-- Sans ce grant, toutes les lectures echouent. Ce n'est pas une ouverture : ces
-- deux fonctions ne repondent que sur l'APPELANT, elles ne disent rien de
-- personne d'autre, et elles rendent `false` sans session.
revoke all on function public.est_membre(uuid) from public, anon;
revoke all on function public.est_maitre(uuid) from public, anon;
grant execute on function public.est_membre(uuid) to authenticated;
grant execute on function public.est_maitre(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Les politiques
-- ---------------------------------------------------------------------------
-- LA CLE ANON EST PUBLIQUE, elle est lisible dans un fichier JavaScript du site.
-- Ces politiques sont le SEUL mur. Une seule mal ecrite, et c'est le fichier
-- client d'un domaine qui devient lisible par un autre.

-- Un bureau se lit par ses membres, et se renomme par ses maitres.
drop policy if exists "lire son bureau" on public.bureaux;
create policy "lire son bureau" on public.bureaux
  for select using (public.est_membre(bureau));

drop policy if exists "renommer son bureau" on public.bureaux;
create policy "renommer son bureau" on public.bureaux
  for update using (public.est_maitre(bureau)) with check (public.est_maitre(bureau));

-- PAS de politique d'insertion ni de suppression : un bureau nait par le
-- declencheur d'inscription (section 6), et rien ne le supprime depuis le
-- navigateur. Creer un deuxieme bureau a la main viendra avec son ecran.

-- La liste des membres se lit par les membres du meme bureau : on doit savoir
-- avec qui on travaille.
drop policy if exists "lire les membres de son bureau" on public.membres;
create policy "lire les membres de son bureau" on public.membres
  for select using (public.est_membre(bureau));

-- ET AUCUNE AUTRE. C'est un vide VOLONTAIRE, le verrou le plus important du lot :
-- sans politique d'update, un simple utilisateur ne peut pas se nommer maitre en
-- une requete sur sa propre ligne. Les changements de role passeront par une
-- fonction qui verifie d'abord `est_maitre()`, au lot des invitations. Ne jamais
-- ajouter ici une politique d'update « pour simplifier ».

-- ---------------------------------------------------------------------------
-- 5. Les droits
-- ---------------------------------------------------------------------------
-- `revoke all` D'ABORD, sur anon ET sur authenticated. Supabase accorde INSERT,
-- UPDATE, DELETE, TRUNCATE, REFERENCES et TRIGGER par defaut a toute table neuve
-- du schema public : un `grant select` seul est redondant et laisse les six
-- autres en place. Regle du depot, payee le 09/09/2026 sur `v_courrier`.
revoke all on public.bureaux from anon, authenticated;
revoke all on public.membres from anon, authenticated;

grant select on public.bureaux to authenticated;
grant select on public.membres to authenticated;
grant update (nom) on public.bureaux to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Le dernier maitre ne peut pas etre retrograde
-- ---------------------------------------------------------------------------
-- Un bureau sans maitre est un bureau ou plus personne ne peut inviter ni
-- renommer. Le garde-fou est en base et pas dans l'ecran : il tient meme quand
-- l'ecriture ne vient pas du code, depuis cet editeur SQL par exemple.
--
-- SUR L'UPDATE SEULEMENT, et c'est deliberé. Un declencheur qui refuserait aussi
-- le DELETE ferait ECHOUER la suppression d'un compte : `membres.personne` est en
-- cascade sur `auth.users`, et quelqu'un qui supprime son compte doit pouvoir le
-- faire. Ce qu'il advient d'un bureau dont le seul maitre s'en va est une
-- question ouverte du plan, pas un cas a bloquer ici.
create or replace function public.garder_un_maitre()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'maitre' and new.role is distinct from 'maitre'
     and not exists (
       select 1 from public.membres m
        where m.bureau = old.bureau and m.role = 'maitre' and m.personne <> old.personne
     ) then
    raise exception 'ce bureau n''aurait plus aucun maitre';
  end if;
  return new;
end $$;

drop trigger if exists garder_un_maitre_avant_maj on public.membres;
create trigger garder_un_maitre_avant_maj
  before update on public.membres
  for each row execute function public.garder_un_maitre();

-- ---------------------------------------------------------------------------
-- 7. Le bureau courant
-- ---------------------------------------------------------------------------
-- Range sur la fiche pour suivre d'un appareil a l'autre : le vigneron qui change
-- de bureau sur son ordinateur le retrouve sur son telephone.
--
-- LA BASE NE LE CROIT JAMAIS. Cette colonne ne sert qu'a se souvenir d'un choix.
-- Aucune politique de securite ne la lit : elles verifient toutes l'appartenance
-- sur le bureau REEL de la ligne. Un navigateur trafique qui reclamerait le
-- bureau du voisin lit zero ligne, meme s'il arrive a ecrire ce nom ici.
alter table public.profils
  add column if not exists bureau_courant uuid references public.bureaux on delete set null;

grant update (bureau_courant) on public.profils to authenticated;

-- Le compte ne peut pas se poser un bureau dont il n'est pas membre. Ce n'est pas
-- une protection de donnees, c'est une protection de COHERENCE : un bureau
-- courant impossible ferait un ecran vide sans message, le pire des etats.
create or replace function public.verifier_bureau_courant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.bureau_courant is not null
     and new.bureau_courant is distinct from old.bureau_courant
     and not exists (
       select 1 from public.membres m
        where m.bureau = new.bureau_courant and m.personne = new.id
     ) then
    raise exception 'ce compte n''est pas membre de ce bureau';
  end if;
  return new;
end $$;

drop trigger if exists verifier_bureau_courant_avant_maj on public.profils;
create trigger verifier_bureau_courant_avant_maj
  before update on public.profils
  for each row execute function public.verifier_bureau_courant();

-- ---------------------------------------------------------------------------
-- 8. Un compte neuf nait avec son bureau
-- ---------------------------------------------------------------------------
-- Sans ca, la migration de la section 9 serait perimee des la premiere
-- inscription du lendemain, et le nouveau venu n'aurait de bureau nulle part.
--
-- Le bureau s'appelle « Mon bureau » et pas l'adresse de la personne : le nom du
-- domaine n'est pas encore connu a l'inscription, il est demande a l'ecran
-- suivant. Il se renomme ensuite, c'est ce que permet la politique de la
-- section 4.
create or replace function public.creer_profil()
returns trigger language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  insert into public.profils (id, email) values (new.id, new.email)
  on conflict (id) do nothing;

  -- `not exists` plutot qu'un `on conflict` : la cle du bureau est tiree au
  -- hasard, elle ne peut pas servir de garde contre un deuxieme passage.
  if not exists (select 1 from public.membres m where m.personne = new.id) then
    insert into public.bureaux (nom, cree_par) values ('Mon bureau', new.id)
      returning bureau into b;
    insert into public.membres (bureau, personne, role) values (b, new.id, 'maitre');
    update public.profils set bureau_courant = b where id = new.id;
  end if;

  return new;
end $$;

-- Fonction de DECLENCHEUR : elle n'a jamais besoin d'un droit d'execution, et une
-- fonction `security definer` joignable par /rest/v1/rpc/ n'a rien a faire dans
-- une surface publique. Meme regle qu'a la section 10 de schema.sql.
revoke all on function public.creer_profil()            from public, anon, authenticated;
revoke all on function public.garder_un_maitre()        from public, anon, authenticated;
revoke all on function public.verifier_bureau_courant() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. La migration des comptes existants
-- ---------------------------------------------------------------------------
-- Chaque compte deja inscrit devient MAITRE d'un bureau a lui seul. Personne ne
-- gagne ni ne perd un acces : il possede exactement ce qu'il possedait, sous un
-- nom nouveau.
--
-- Le bureau prend le nom du domaine quand il est renseigne, sinon le nom de la
-- personne, sinon son adresse. Le `where` rend le bloc rejouable : un compte qui
-- a deja un bureau est saute.
do $$
declare c record;
        b uuid;
begin
  for c in
    select p.id,
           coalesce(
             nullif(trim(p.domaine), ''),
             nullif(trim(concat_ws(' ', p.prenom, p.nom)), ''),
             p.email,
             'Mon bureau'
           ) as nom
      from public.profils p
     where not exists (select 1 from public.membres m where m.personne = p.id)
  loop
    insert into public.bureaux (nom, cree_par) values (left(c.nom, 120), c.id)
      returning bureau into b;
    insert into public.membres (bureau, personne, role) values (b, c.id, 'maitre');
    update public.profils set bureau_courant = b where id = c.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 10. A CONTROLER APRES AVOIR PASSE CE SCRIPT
-- ---------------------------------------------------------------------------
-- Les trois requetes ci-dessous ne changent rien, elles verifient. A lancer une
-- par une dans le meme editeur.
--
-- a) Autant de bureaux que de comptes, et un maitre par bureau :
--    select (select count(*) from public.profils)  as comptes,
--           (select count(*) from public.bureaux)  as bureaux,
--           (select count(*) from public.membres where role = 'maitre') as maitres;
--
-- b) Aucun compte orphelin, aucun bureau courant vide :
--    select count(*) as sans_bureau from public.profils p
--     where not exists (select 1 from public.membres m where m.personne = p.id)
--        or p.bureau_courant is null;
--
-- c) Les droits reellement poses. On attend `SELECT` seul, sur les deux tables, et
--    AUCUNE ligne pour `anon` :
--    select table_name, grantee, privilege_type
--      from information_schema.role_table_grants
--     where table_schema = 'public' and table_name in ('bureaux','membres')
--       and grantee in ('anon','authenticated')
--     order by table_name, grantee, privilege_type;
--
--    PIEGE, mesure le 13/09/2026 : le `grant update (nom)` de la section 5 N'APPARAIT
--    PAS dans cette vue. Un droit accorde colonne par colonne vit dans une AUTRE vue,
--    et lire la premiere seule fait conclure que le grant n'est pas passe. La question
--    « le maitre peut-il renommer son bureau » se pose donc ici :
--    select table_name, column_name, grantee, privilege_type
--      from information_schema.column_privileges
--     where table_schema = 'public' and table_name in ('bureaux','membres')
--       and grantee in ('anon','authenticated') and privilege_type <> 'SELECT'
--     order by table_name, column_name;


-- ===========================================================================
-- LOT 16, ajoute le 13/09/2026 : fermer deux fonctions joignables de dehors.
-- ===========================================================================
-- Copie de supabase/lot16-fermer-fonctions.sql, qui est ce qu'on colle, et ou le
-- raisonnement complet et la mesure sont ecrits.
--
-- LA REGLE, et c'est le symetrique de celle du 09/09/2026 sur les tables :
-- **un revoke sur PUBLIC ne retire pas un droit nominatif.** Supabase accorde
-- l'execution a anon, authenticated et service_role NOMMEMENT sur toute fonction
-- creee dans le schema public. Tout revoke de fermeture nomme donc les roles.
-- ===========================================================================
-- LOTS 10, 12 ET 13, REINTEGRES LE 18/09/2026 : ce fichier revoquait des objets
-- qu'il n'avait jamais crees.
-- ===========================================================================
-- CE QUI S'EST PASSE, ET POURQUOI PERSONNE NE L'A VU. Les deux `revoke` du lot 16
-- ci-dessous nomment `courrier_envois_purger()` et `profils_dater_consentements()`.
-- Aucune des deux n'etait definie ici : elles vivent dans lot13-purge-journal.sql
-- et lot12-preferences-emails.sql, et la table `courrier_envois` dans
-- lot10-courrier-envois.sql. Sur la base de production, qui les avait deja recues
-- par ces trois fichiers, les revoke passaient. Sur une base NEUVE, non : ce
-- fichier rendait SIX erreurs, la premiere des le grant de la section 3.
--
-- L'en-tete dit « ecrit pour etre rejouable sans erreur ». Il ne l'etait pas. Le
-- raisonnement de chaque objet reste dans son fichier de lot, qui est ce qu'on
-- colle au quotidien ; on ne recopie ici que ce qu'il faut pour que le rejeu
-- tienne debout tout seul. Le controle est `npm run banc:rejeu`.

create table if not exists public.courrier_envois (
  compte     uuid        not null references public.profils (id) on delete cascade,
  jour       date        not null,
  reserve_le timestamptz not null default now(),
  sujet      text,
  resend_id  text,
  echec      text,
  primary key (compte, jour)
);

alter table public.courrier_envois enable row level security;
revoke all on public.courrier_envois from anon, authenticated;

alter table public.profils
  add column if not exists consent_courrier boolean not null default false;

alter table public.profils
  add column if not exists jeton_emails uuid not null default gen_random_uuid();

create unique index if not exists profils_jeton_emails_idx
  on public.profils (jeton_emails);

alter table public.profils
  add column if not exists consent_courrier_le timestamptz;

alter table public.profils
  add column if not exists consent_news_le timestamptz;

grant update (consent_courrier) on public.profils to authenticated;

create or replace function public.profils_dater_consentements()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.consent_courrier is distinct from old.consent_courrier then
    new.consent_courrier_le := now();
  end if;
  if new.consent_news is distinct from old.consent_news then
    new.consent_news_le := now();
  end if;
  return new;
end;
$$;

drop trigger if exists profils_dater_consentements on public.profils;
create trigger profils_dater_consentements
  before update on public.profils
  for each row
  execute function public.profils_dater_consentements();

create or replace function public.courrier_envois_purger()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  effacees int;
begin
  delete from public.courrier_envois
   where jour < (current_date - interval '1 year');
  get diagnostics effacees = row_count;
  return effacees;
end;
$$;

-- Les deux portes de la page publique de preferences. `anon` n'a que la cle
-- publique et la securite par ligne lui interdit tout sur `profils` : ces deux
-- fonctions sont le seul chemin, et c'est pour cela qu'elles sont `security
-- definer` avec un `search_path` fige.
drop function if exists public.emails_lire(uuid);

create or replace function public.emails_lire(jeton uuid)
returns table (email_masque text, rappels boolean, edition boolean,
               rappels_le timestamptz, edition_le timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select left(p.email, 2) || '…@' || split_part(p.email, '@', 2),
         p.consent_courrier,
         p.consent_news,
         p.consent_courrier_le,
         p.consent_news_le
    from public.profils p
   where p.jeton_emails = jeton;
$$;

create or replace function public.emails_ecrire(jeton uuid, rappels boolean, edition boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  touchees int;
begin
  update public.profils
     set consent_courrier = coalesce(rappels, consent_courrier),
         consent_news     = coalesce(edition, consent_news)
   where jeton_emails = jeton;
  get diagnostics touchees = row_count;
  return touchees = 1;
end;
$$;

revoke all on function public.emails_lire(uuid)                     from public;
revoke all on function public.emails_ecrire(uuid, boolean, boolean) from public;
grant execute on function public.emails_lire(uuid)                     to anon, authenticated;
grant execute on function public.emails_ecrire(uuid, boolean, boolean) to anon, authenticated;


revoke all on function public.courrier_envois_purger()      from public, anon, authenticated;
revoke all on function public.profils_dater_consentements() from public, anon, authenticated;


-- ===========================================================================
-- LOT 17, ajoute le 13/09/2026 : les donnees changent de proprietaire.
-- ===========================================================================
-- Copie de supabase/lot17-bascule-bureau.sql, qui est ce qu'on colle, et ou le
-- raisonnement, les deux familles de politiques et les controles sont ecrits.
--
-- LA REGLE A RETENIR EN RELISANT : la securite par ligne dit ce qu'on A LE DROIT
-- de lire, le bureau courant dit ce qu'on DOIT lire. Mesure du 13/09/2026 sur un
-- Postgres jetable : un compte membre de deux bureaux lit 57 lignes de vente sans
-- filtre, 50 avec. Toute requete du navigateur porte bureau=eq.<courant>,
-- lectures et suppressions comprises.
-- sera membre de deux bureaux, une lecture sans filtre de bureau melangerait les
-- deux sans lever la moindre erreur : deux domaines dans la meme ardoise. Toutes
-- les requetes du navigateur portent donc `bureau=eq.<courant>`, lectures ET
-- suppressions comprises, et pas seulement les ecritures.

-- ---------------------------------------------------------------------------
-- 0. LA VUE DU COURRIER PART D'ABORD
-- ---------------------------------------------------------------------------
-- `v_courrier` lit `reglages`, `suivi_clients`, `taches` et `profils` par leur
-- colonne `id`. Postgres REFUSE de supprimer une colonne dont une vue depend :
-- sans cette ligne, le script echoue a la premiere table. Elle est reconstruite
-- a la section 6, a l'identique pour celui qui la lit.
drop view if exists public.v_courrier;

-- ---------------------------------------------------------------------------
-- 1. LES ANCIENNES POLITIQUES PARTENT AVANT LES COLONNES
-- ---------------------------------------------------------------------------
-- Elles portent toutes sur `id`. Une politique qui depend d'une colonne empeche
-- de la supprimer, exactement comme la vue.
drop policy if exists "lire ses reglages"              on public.reglages;
drop policy if exists "creer ses reglages"             on public.reglages;
drop policy if exists "modifier ses reglages"          on public.reglages;
drop policy if exists "supprimer ses reglages"         on public.reglages;
drop policy if exists "lire son suivi"                 on public.suivi_clients;
drop policy if exists "creer son suivi"                on public.suivi_clients;
drop policy if exists "modifier son suivi"             on public.suivi_clients;
drop policy if exists "supprimer son suivi"            on public.suivi_clients;
drop policy if exists "lire ses ventes"                on public.ventes;
drop policy if exists "creer ses ventes"               on public.ventes;
drop policy if exists "modifier ses ventes"            on public.ventes;
drop policy if exists "supprimer ses ventes"           on public.ventes;
drop policy if exists "lire ses echanges"              on public.echanges;
drop policy if exists "creer ses echanges"             on public.echanges;
drop policy if exists "modifier ses echanges"          on public.echanges;
drop policy if exists "supprimer ses echanges"         on public.echanges;
drop policy if exists "lire ses taches"                on public.taches;
drop policy if exists "creer ses taches"               on public.taches;
drop policy if exists "modifier ses taches"            on public.taches;
drop policy if exists "supprimer ses taches"           on public.taches;
drop policy if exists "lire ses choix de calendrier"      on public.calendrier_choix;
drop policy if exists "creer ses choix de calendrier"     on public.calendrier_choix;
drop policy if exists "modifier ses choix de calendrier"  on public.calendrier_choix;
drop policy if exists "supprimer ses choix de calendrier" on public.calendrier_choix;

-- ---------------------------------------------------------------------------
-- 2. LA BASCULE, TABLE PAR TABLE
-- ---------------------------------------------------------------------------
-- Une fonction plutot que six blocs recopies : six copies d'un meme geste
-- divergent a la premiere correction, et c'est une regle du depot.
--
-- CE QU'ELLE FAIT, dans cet ordre, et l'ordre compte :
--   1. pose `bureau` et `cree_par` a cote de `id` ;
--   2. remplit les deux depuis `membres`, qui fait le lien personne -> bureau ;
--   3. REFUSE D'ALLER PLUS LOIN si une seule ligne n'a pas trouve son bureau.
--      C'est le garde-fou central : sans lui, une ligne orpheline verrait son
--      `bureau` rester nul, la contrainte tomberait, et on aurait perdu a qui
--      elle appartenait. Mieux vaut un script qui s'arrete qu'une ligne muette ;
--   4. supprime `id`, ce qui emporte avec lui la cle etrangere vers auth.users
--      et les index qui la portaient, refaits a la section 3 ;
--   5. repose la cle primaire sur (bureau, <cle metier>).
--
-- `cree_par` est en `on delete set null` : une personne part, on perd son nom
-- sur la ligne, on ne perd pas la ligne. C'est toute la raison de ce lot.
create or replace function public.basculer_vers_bureau(nom_table text, cle_metier text)
returns text language plpgsql as $$
declare restantes bigint;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name=nom_table and column_name='id') then
    return nom_table || ' : deja bascule, rien a faire';
  end if;

  execute format('alter table public.%I add column if not exists bureau uuid', nom_table);
  execute format('alter table public.%I add column if not exists cree_par uuid', nom_table);

  execute format(
    'update public.%I t set bureau = m.bureau, cree_par = coalesce(t.cree_par, t.id)
       from public.membres m where m.personne = t.id and t.bureau is null', nom_table);

  execute format('select count(*) from public.%I where bureau is null', nom_table) into restantes;
  if restantes > 0 then
    raise exception '% : % ligne(s) n''ont pas trouve leur bureau, rien n''a ete bascule',
      nom_table, restantes;
  end if;

  execute format('alter table public.%I drop constraint if exists %I', nom_table, nom_table || '_pkey');
  execute format('alter table public.%I drop column id', nom_table);
  execute format('alter table public.%I alter column bureau set not null', nom_table);
  execute format('alter table public.%I alter column cree_par set default auth.uid()', nom_table);
  execute format('alter table public.%I add constraint %I primary key (bureau%s)',
                 nom_table, nom_table || '_pkey',
                 case when cle_metier = '' then '' else ', ' || cle_metier end);
  execute format('alter table public.%I add constraint %I foreign key (bureau)
                    references public.bureaux on delete cascade',
                 nom_table, nom_table || '_bureau_fk');
  execute format('alter table public.%I add constraint %I foreign key (cree_par)
                    references auth.users on delete set null',
                 nom_table, nom_table || '_cree_par_fk');

  return nom_table || ' : bascule';
end $$;

select public.basculer_vers_bureau('reglages',         '');
select public.basculer_vers_bureau('ventes',           'empreinte');
select public.basculer_vers_bureau('suivi_clients',    'client_id');
select public.basculer_vers_bureau('echanges',         'echange_id');
select public.basculer_vers_bureau('taches',           'tache_id');
select public.basculer_vers_bureau('calendrier_choix', 'cle');

-- La fonction a fait son travail et n'a plus rien a faire dans la base : une
-- fonction qui sait renommer des cles primaires n'a pas a rester joignable.
drop function if exists public.basculer_vers_bureau(text, text);

-- ---------------------------------------------------------------------------
-- 3. LES INDEX, REFAITS SUR LE BUREAU
-- ---------------------------------------------------------------------------
-- Ils portaient tous `id` en tete et sont partis avec la colonne. Les refaire
-- n'est pas un confort : `echanges_client` est la seule lecture de la fiche
-- client, et `taches_a_faire` celle du panneau.
create index if not exists ventes_maj_le   on public.ventes   (bureau, maj_le);
create index if not exists echanges_client on public.echanges (bureau, client_id, le desc);
create index if not exists taches_a_faire  on public.taches   (bureau, echue_le) where fait_le is null;

-- Et un index qui n'existait pas : `cree_par` est desormais lu par TOUTES les
-- politiques d'ecriture des quatre tables de la famille A ci-dessous.
create index if not exists suivi_clients_cree_par    on public.suivi_clients    (cree_par);
create index if not exists echanges_cree_par         on public.echanges         (cree_par);
create index if not exists taches_cree_par           on public.taches           (cree_par);
create index if not exists calendrier_choix_cree_par on public.calendrier_choix (cree_par);

-- ---------------------------------------------------------------------------
-- 4. LES POLITIQUES, DEUX FAMILLES ET PAS UNE DE PLUS
-- ---------------------------------------------------------------------------
-- FAMILLE A, « chacun n'ecrit que ses propres lignes ». Arbitrage de Ted du
-- 13/09/2026, pris en connaissance de sa consequence : la premiere personne qui
-- touche une fiche client la verrouille pour les autres. Un collegue qui essaie
-- recoit une ERREUR FRANCHE, pas un refus poli : PostgreSQL rejette un
-- `on conflict do update` sur une ligne que la politique ne laisse pas modifier.
-- C'est bruyant, et c'est mieux qu'un enregistrement qui n'enregistre rien.
--
-- Ce choix vit ICI et nulle part ailleurs. L'ouvrir au bureau entier le jour ou
-- il genera coute deux lignes, `drop policy` et `create policy`, sans migration
-- et sans toucher au navigateur. Ne pas le prendre pour une contrainte de forme.
--
-- `cree_par` n'est PAS verifie a l'insertion par un `cree_par = auth.uid()` :
-- c'est le DEFAUT `auth.uid()` pose a la section 2 qui le remplit, et un compte
-- qui tenterait d'ecrire le nom d'un autre se heurterait au meme defaut. La
-- verification est sur la MODIFICATION, la ou elle protege vraiment.

-- suivi_clients
create policy "lire le suivi du bureau" on public.suivi_clients
  for select using (public.est_membre(bureau));
create policy "creer un suivi" on public.suivi_clients
  for insert with check (public.est_membre(bureau));
create policy "modifier son suivi" on public.suivi_clients
  for update using (public.est_membre(bureau) and cree_par = auth.uid())
          with check (public.est_membre(bureau) and cree_par = auth.uid());
create policy "supprimer son suivi" on public.suivi_clients
  for delete using (public.est_membre(bureau) and cree_par = auth.uid());

-- echanges. C'est ICI que la regle est la plus juste : un journal date ne se
-- reecrit pas, et surtout pas celui d'un collegue.
create policy "lire les echanges du bureau" on public.echanges
  for select using (public.est_membre(bureau));
create policy "creer un echange" on public.echanges
  for insert with check (public.est_membre(bureau));
create policy "modifier son echange" on public.echanges
  for update using (public.est_membre(bureau) and cree_par = auth.uid())
          with check (public.est_membre(bureau) and cree_par = auth.uid());
create policy "supprimer son echange" on public.echanges
  for delete using (public.est_membre(bureau) and cree_par = auth.uid());

-- taches
create policy "lire les taches du bureau" on public.taches
  for select using (public.est_membre(bureau));
create policy "creer une tache" on public.taches
  for insert with check (public.est_membre(bureau));
create policy "modifier sa tache" on public.taches
  for update using (public.est_membre(bureau) and cree_par = auth.uid())
          with check (public.est_membre(bureau) and cree_par = auth.uid());
create policy "supprimer sa tache" on public.taches
  for delete using (public.est_membre(bureau) and cree_par = auth.uid());

-- calendrier_choix
create policy "lire les choix de calendrier du bureau" on public.calendrier_choix
  for select using (public.est_membre(bureau));
create policy "creer un choix de calendrier" on public.calendrier_choix
  for insert with check (public.est_membre(bureau));
create policy "modifier son choix de calendrier" on public.calendrier_choix
  for update using (public.est_membre(bureau) and cree_par = auth.uid())
          with check (public.est_membre(bureau) and cree_par = auth.uid());
create policy "supprimer son choix de calendrier" on public.calendrier_choix
  for delete using (public.est_membre(bureau) and cree_par = auth.uid());

-- FAMILLE B, « le maitre seul ecrit ». Tout le bureau LIT.
--
-- `ventes` : un import de travers ne se trompe pas d'une ligne, il double le
-- chiffre d'affaires du domaine entier (mesure de CLAUDE.md : 4 939 lignes et
-- 532 201 euros deviennent 9 878 et 1 064 403). Ce geste appartient au maitre.
--
-- `reglages` : l'objectif, l'exercice et le classement sont AU BUREAU, arbitrage
-- de Ted du 13/09/2026. La meme ligne porte aussi la file de travail deposee par
-- le tableau de bord a chaque import, donc par le maitre.
--
-- PAS de `cree_par = auth.uid()` ici, et c'est deliberé : deux maitres doivent
-- pouvoir reimporter l'un par-dessus l'autre. Le mettre casserait le
-- `resolution=merge-duplicates` de tout second importateur.
create policy "lire les ventes du bureau" on public.ventes
  for select using (public.est_membre(bureau));
create policy "importer des ventes" on public.ventes
  for insert with check (public.est_maitre(bureau));
create policy "corriger des ventes" on public.ventes
  for update using (public.est_maitre(bureau)) with check (public.est_maitre(bureau));
create policy "effacer des ventes" on public.ventes
  for delete using (public.est_maitre(bureau));

create policy "lire les reglages du bureau" on public.reglages
  for select using (public.est_membre(bureau));
create policy "creer les reglages" on public.reglages
  for insert with check (public.est_maitre(bureau));
create policy "modifier les reglages" on public.reglages
  for update using (public.est_maitre(bureau)) with check (public.est_maitre(bureau));
create policy "supprimer les reglages" on public.reglages
  for delete using (public.est_maitre(bureau));

-- Les droits de table n'ont pas change, mais on les repose : `revoke all`
-- d'abord, sur anon ET authenticated, puis le strict necessaire.
revoke all on public.reglages, public.ventes, public.suivi_clients,
              public.echanges, public.taches, public.calendrier_choix
  from anon, authenticated;
grant select, insert, update, delete
  on public.reglages, public.ventes, public.suivi_clients,
     public.echanges, public.taches, public.calendrier_choix
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. « VIDER LA BASE » DEVIENT UN GESTE DE MAITRE, ET IL CHANGE DE NOM
-- ---------------------------------------------------------------------------
-- `effacer_mes_donnees()` disait « mes donnees » a quelqu'un qui s'appretait a
-- effacer celles de tout un domaine. Le nom devient vrai, et la fonction verifie
-- qui appelle AVANT d'effacer quoi que ce soit.
--
-- La ligne de `reglages` SURVIT, comme depuis le 08/09/2026 : on ne vide que ce
-- qui est le reflet des ventes qu'on vient d'effacer, jamais ce que le vigneron
-- a choisi. Les signets, les taches et les choix de calendrier ne sont pas
-- touches non plus : cette fonction vide LA BASE DE VENTES, pas le bureau.
create or replace function public.vider_la_base_du_bureau(b uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if b is null or not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut vider sa base';
  end if;
  delete from public.echanges      where bureau = b;
  delete from public.ventes        where bureau = b;
  delete from public.suivi_clients where bureau = b;
  update public.reglages
     set file_travail = null, resume_ventes = null, depose_le = null, maj_le = now()
   where bureau = b;
end $$;

revoke all on function public.vider_la_base_du_bureau(uuid) from public, anon;
grant execute on function public.vider_la_base_du_bureau(uuid) to authenticated;

-- L'ancienne est SUPPRIMEE, pas laissee a cote. Elle interroge des colonnes qui
-- n'existent plus : la garder, c'est laisser un bouton qui tombe en erreur le
-- jour ou quelqu'un le presse. L'ancien code deploye recevra un 404 franc.
drop function if exists public.effacer_mes_donnees();

-- ---------------------------------------------------------------------------
-- 6. LA VUE DU COURRIER, RECONSTRUITE
-- ---------------------------------------------------------------------------
-- IDENTIQUE POUR CELUI QUI LA LIT : memes neuf colonnes, memes noms, meme ordre.
-- La fonction `courrier-matin` demande `id,email,jeton_emails,depose_le,noms,
-- signaux,suivis,taches,resume_ventes` et n'a pas une ligne a changer.
--
-- Ce qui change est la PLOMBERIE : la vue partait de `reglages` et joignait sur
-- `id`. Elle part maintenant de la PERSONNE, passe par son `bureau_courant`, et
-- lit les donnees de ce bureau. La colonne rendue s'appelle toujours `id` et
-- vaut toujours la personne : c'est elle que `courrier_envois` enregistre, et
-- c'est a elle qu'on ecrit.
--
-- CE QUI RESTE A FAIRE, ET QUI N'EST PAS ICI : l'arbitrage de Ted veut que
-- chacun choisisse dans ses preferences, donc que le consentement devienne un
-- couple (personne, bureau). Tant que chacun n'a qu'un bureau, ce que fait cette
-- vue et ce que veut l'arbitrage se confondent. Le jour du lot des invitations,
-- `consent_courrier` sort de `profils`.
--
-- `security_invoker = true` N'EST PAS DECORATIF. Sans lui, une vue s'execute
-- avec les droits de son proprietaire, qui traverse la securite par ligne : tout
-- compte connecte lirait alors les adresses, les jetons de desinscription et les
-- notes clients de TOUS les comptes. C'est le reglage que portait deja la vue
-- d'origine, verifie le 13/09/2026. Ne jamais le laisser tomber.
create or replace view public.v_courrier with (security_invoker = true) as
with base as (
  select p.id as personne, p.email, p.jeton_emails, p.bureau_courant as bureau
    from public.profils p
   where p.consent_courrier and p.bureau_courant is not null
), signaux_gardes as (
  select b.personne, jsonb_agg(s.valeur order by s.n) as signaux
    from base b
    join public.reglages r on r.bureau = b.bureau
    cross join lateral jsonb_array_elements(
      coalesce(r.file_travail -> 'signaux', '[]'::jsonb)) with ordinality s(valeur, n)
   where not exists (
     select 1 from public.suivi_clients sc
      where sc.bureau = b.bureau
        and sc.client_id = (s.valeur ->> 'id')
        and (sc.rappel is not null or sc.statut = 'traite'))
   group by b.personne
), suivis_actifs as (
  select b.personne, jsonb_agg(to_jsonb(sc.*)) as suivis
    from base b join public.suivi_clients sc on sc.bureau = b.bureau
   where sc.rappel is not null and sc.statut is distinct from 'traite'
   group by b.personne
), taches_ouvertes as (
  select b.personne, jsonb_agg(to_jsonb(t.*)) as taches
    from base b join public.taches t on t.bureau = b.bureau
   where t.fait_le is null
   group by b.personne
)
select b.personne as id,
       b.email,
       b.jeton_emails,
       r.depose_le,
       coalesce(r.file_travail -> 'noms', '{}'::jsonb) as noms,
       coalesce(sg.signaux, '[]'::jsonb) as signaux,
       coalesce(sa.suivis,  '[]'::jsonb) as suivis,
       coalesce(tc.taches,  '[]'::jsonb) as taches,
       r.resume_ventes
  from base b
  join public.reglages r on r.bureau = b.bureau
  left join signaux_gardes  sg on sg.personne = b.personne
  left join suivis_actifs   sa on sa.personne = b.personne
  left join taches_ouvertes tc on tc.personne = b.personne;

revoke all on public.v_courrier from anon, authenticated;
grant select on public.v_courrier to authenticated;

-- ---------------------------------------------------------------------------
-- 7. A CONTROLER, DANS CET ORDRE
-- ---------------------------------------------------------------------------
-- a) Aucune table ne porte plus `id`, toutes portent `bureau` et `cree_par` :
--    select table_name, string_agg(column_name, ', ' order by column_name) as colonnes
--      from information_schema.columns
--     where table_schema='public' and column_name in ('id','bureau','cree_par')
--       and table_name in ('reglages','ventes','suivi_clients','echanges','taches','calendrier_choix')
--     group by table_name order by table_name;
--
-- b) AUCUNE LIGNE N'A ETE PERDUE. Les nombres attendus au 13/09/2026 :
--    ventes 9878, taches 20, suivi_clients 16, echanges 15, reglages 2,
--    calendrier_choix 1, et zero ligne sans bureau.
--    select 'ventes' t, count(*) n, count(*) filter (where bureau is null) sans_bureau from public.ventes
--    union all select 'taches', count(*), count(*) filter (where bureau is null) from public.taches
--    union all select 'suivi_clients', count(*), count(*) filter (where bureau is null) from public.suivi_clients
--    union all select 'echanges', count(*), count(*) filter (where bureau is null) from public.echanges
--    union all select 'reglages', count(*), count(*) filter (where bureau is null) from public.reglages
--    union all select 'calendrier_choix', count(*), count(*) filter (where bureau is null) from public.calendrier_choix
--    order by 1;
--
-- c) LE COURRIER DE DEMAIN PART ENCORE. La vue doit rendre une ligne par compte
--    consentant, avec son adresse et son jeton :
--    select id, email, (jeton_emails is not null) as jeton,
--           jsonb_array_length(suivis) as suivis, jsonb_array_length(taches) as taches
--      from public.v_courrier;
--
-- d) Et le controle de securite de Supabase, comme apres tout lot SQL.


-- ===========================================================================
-- LOT 18, ajoute le 13/09/2026 : l'equipe. Inviter, accepter, changer de bureau.
-- ===========================================================================
-- Copie de supabase/lot18-equipe.sql, qui est ce qu'on colle. Le banc qui le
-- verifie est supabase/banc-lot18-equipe.sql.
--
-- L'INVITATION EST UN LIEN, PAS UN MAIL : la regle du SEUIL de CLAUDE.md veut
-- qu'au premier destinataire qui n'est pas Ted on sorte du sous-domaine courrier.,
-- qu'on passe Resend au palier payant et qu'on ecrive les textes legaux. Un lien
-- ne declenche aucun des trois, et la fonction rend deja le jeton : le jour ou
-- l'envoi par mail arrivera, il se posera par-dessus sans rien changer ici.
-- ---------------------------------------------------------------------------
-- 1. La table des invitations
-- ---------------------------------------------------------------------------
-- LE JETON CLAIR N'EST JAMAIS STOCKE. La table ne porte que son empreinte, et la
-- fonction qui le fabrique est le seul endroit du systeme ou il existe en clair,
-- le temps d'une reponse. Quelqu'un qui lirait cette table entiere ne pourrait
-- accepter aucune invitation.
--
-- L'entropie vient de DEUX uuid concatenes, soit 244 bits, et pas de
-- `gen_random_bytes` : celui-la demande pgcrypto, et une dependance d'extension
-- pour tirer un nombre au hasard n'a pas sa place dans un chemin de securite.
create table if not exists public.invitations (
  jeton_hash  text primary key,
  bureau      uuid not null references public.bureaux on delete cascade,
  email       text not null,
  role        text not null default 'simple' check (role in ('maitre','simple')),
  invite_par  uuid references auth.users on delete set null,
  cree_le     timestamptz not null default now(),
  expire_le   timestamptz not null default (now() + interval '7 days'),
  utilise_le  timestamptz,
  utilise_par uuid references auth.users on delete set null
);

create index if not exists invitations_bureau on public.invitations (bureau, cree_le desc);

alter table public.invitations enable row level security;

-- Un maitre voit les invitations de SON bureau, pour savoir qui attend et
-- pouvoir annuler. Rien d'autre ne passe par le client : creer, accepter et
-- annuler sont des fonctions, parce que chacune a une regle a verifier.
drop policy if exists "lire les invitations de son bureau" on public.invitations;
create policy "lire les invitations de son bureau" on public.invitations
  for select using (public.est_maitre(bureau));

revoke all on public.invitations from anon, authenticated;
-- L'EMPREINTE RESTE DEHORS, colonne par colonne. Elle ne sert a rien a l'ecran,
-- et une empreinte qui circule est une empreinte qu'on peut essayer de casser
-- hors ligne. Le maitre annule par l'adresse invitee, pas par le jeton.
grant select (bureau, email, role, invite_par, cree_le, expire_le, utilise_le, utilise_par)
  on public.invitations to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Inviter
-- ---------------------------------------------------------------------------
-- Rend le jeton EN CLAIR, une seule fois, a celui qui invite. Il ne sera plus
-- jamais lisible nulle part : la table n'en garde que l'empreinte.
create or replace function public.inviter(b uuid, courriel text, r text default 'simple')
returns text language plpgsql security definer set search_path = public as $$
declare
  jeton text;
  adresse text := lower(trim(courriel));
begin
  if not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut inviter';
  end if;
  if adresse !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'cette adresse ne ressemble pas a une adresse e-mail';
  end if;
  if r not in ('maitre','simple') then
    raise exception 'role inconnu';
  end if;

  -- Deja dans le bureau : on le dit, au lieu de fabriquer un lien qui echouera.
  if exists (select 1 from public.membres m join auth.users u on u.id = m.personne
              where m.bureau = b and lower(u.email) = adresse) then
    raise exception 'cette personne est deja dans ce bureau';
  end if;

  -- Une invitation en attente pour la meme adresse est REMPLACEE. Sans ca, deux
  -- liens vivraient en meme temps pour la meme personne, et annuler le premier ne
  -- fermerait rien.
  delete from public.invitations
   where bureau = b and email = adresse and utilise_le is null;

  jeton := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.invitations (jeton_hash, bureau, email, role, invite_par)
  values (encode(sha256(convert_to(jeton, 'UTF8')), 'hex'), b, adresse, r, auth.uid());

  return jeton;
end $$;

revoke all on function public.inviter(uuid, text, text) from public, anon;
grant execute on function public.inviter(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Ce que voit l'invite AVANT d'accepter
-- ---------------------------------------------------------------------------
-- OUVERTE SANS SESSION, et c'est deliberé : l'invite n'a pas forcement de compte,
-- il doit voir qui l'invite et ou avant de decider d'en creer un. Meme porte que
-- `emails_lire`, et meme justification : elle ne rend RIEN sans un jeton exact de
-- 244 bits, et ce qu'elle rend tient en quatre champs.
--
-- ELLE NE DIT PAS SI L'ADRESSE CORRESPOND. Repondre « ce n'est pas ton adresse »
-- a quelqu'un qui n'est pas connecte apprendrait a un curieux quelle adresse a
-- ete invitee. La verification a lieu a l'acceptation, ou il y a une session.
create or replace function public.invitation_apercu(jeton text)
returns table (bureau_nom text, invite_par_prenom text, etat text)
language sql stable security definer set search_path = public as $$
  select b.nom,
         coalesce(nullif(trim(p.prenom), ''), split_part(p.email, '@', 1)),
         case when i.utilise_le is not null then 'utilisee'
              when i.expire_le < now()      then 'expiree'
              else 'valide' end
    from public.invitations i
    join public.bureaux b on b.bureau = i.bureau
    left join public.profils p on p.id = i.invite_par
   where i.jeton_hash = encode(sha256(convert_to(jeton, 'UTF8')), 'hex');
$$;

revoke all on function public.invitation_apercu(text) from public;
grant execute on function public.invitation_apercu(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Accepter
-- ---------------------------------------------------------------------------
-- L'ADRESSE DOIT CORRESPONDRE, et c'est le verrou central de tout le lot. Sans
-- lui, n'importe qui ayant vu passer le lien (un mail transfere, une capture
-- d'ecran, un historique de navigateur partage) entrerait dans le fichier client
-- d'un domaine. Le lien seul ne suffit donc jamais : il faut le lien ET etre
-- connecte avec l'adresse invitee.
create or replace function public.accepter_invitation(jeton text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv public.invitations%rowtype;
  moi uuid := auth.uid();
  mon_email text;
begin
  if moi is null then raise exception 'aucune session'; end if;
  select lower(email) into mon_email from auth.users where id = moi;

  select * into inv from public.invitations
   where jeton_hash = encode(sha256(convert_to(jeton, 'UTF8')), 'hex')
   for update;

  if inv.jeton_hash is null then raise exception 'invitation inconnue'; end if;
  if inv.utilise_le is not null then raise exception 'invitation deja utilisee'; end if;
  if inv.expire_le < now() then raise exception 'invitation expiree'; end if;
  if inv.email is distinct from mon_email then
    raise exception 'cette invitation a ete envoyee a une autre adresse';
  end if;

  insert into public.membres (bureau, personne, role, invite_par)
  values (inv.bureau, moi, inv.role, inv.invite_par)
  on conflict (bureau, personne) do nothing;

  update public.invitations
     set utilise_le = now(), utilise_par = moi
   where jeton_hash = inv.jeton_hash;

  -- On arrive DANS le bureau ou l'on vient d'entrer : sans ca, l'invite accepte
  -- et se retrouve devant son propre bureau vide, sans comprendre ce qui a change.
  update public.profils set bureau_courant = inv.bureau where id = moi;

  return inv.bureau;
end $$;

revoke all on function public.accepter_invitation(text) from public, anon;
grant execute on function public.accepter_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Annuler une invitation en attente
-- ---------------------------------------------------------------------------
-- Par l'ADRESSE et pas par le jeton : le maitre ne l'a plus, et l'empreinte ne
-- lui est pas servie. C'est aussi ce qui rend le geste lisible a l'ecran.
create or replace function public.annuler_invitation(b uuid, courriel text)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut annuler une invitation';
  end if;
  delete from public.invitations
   where bureau = b and email = lower(trim(courriel)) and utilise_le is null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.annuler_invitation(uuid, text) from public, anon;
grant execute on function public.annuler_invitation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Qui est dans le bureau
-- ---------------------------------------------------------------------------
-- UNE FONCTION ET PAS UNE VUE, parce que `profils` appartient a la PERSONNE :
-- sa politique de securite est `auth.uid() = id`, et un maitre ne lit donc pas la
-- fiche de son collegue. Ouvrir cette politique aux gens du meme bureau rendrait
-- visible TOUTE la fiche, y compris `jeton_emails`, qui permet de modifier les
-- preferences d'e-mail de quelqu'un d'autre sans etre connecte.
--
-- Cette fonction rend donc les six champs dont l'ecran a besoin, et rien de plus.
create or replace function public.equipe(b uuid)
returns table (personne uuid, role text, depuis timestamptz,
               prenom text, nom text, email text)
language sql stable security definer set search_path = public as $$
  select m.personne, m.role, m.depuis, p.prenom, p.nom, p.email
    from public.membres m
    join public.profils p on p.id = m.personne
   where m.bureau = b and public.est_membre(b)
   order by (m.role = 'maitre') desc, m.depuis;
$$;

revoke all on function public.equipe(uuid) from public, anon;
grant execute on function public.equipe(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Changer le role de quelqu'un
-- ---------------------------------------------------------------------------
-- Le declencheur `garder_un_maitre` du lot 15 refuse deja de retrograder le
-- dernier maitre, et il tient meme depuis l'editeur SQL. Ici on ajoute la seule
-- chose qu'il ne peut pas savoir : QUI demande.
create or replace function public.changer_role(b uuid, personne_ciblee uuid, r text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut changer un role';
  end if;
  if r not in ('maitre','simple') then raise exception 'role inconnu'; end if;
  update public.membres set role = r
   where bureau = b and personne = personne_ciblee;
  if not found then raise exception 'cette personne n''est pas dans ce bureau'; end if;
end $$;

revoke all on function public.changer_role(uuid, uuid, text) from public, anon;
grant execute on function public.changer_role(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Retirer quelqu'un, ou partir soi-meme
-- ---------------------------------------------------------------------------
-- DEUX GESTES DANS UNE SEULE FONCTION, parce que c'est la meme ecriture avec la
-- meme consequence : un maitre retire un collegue, ou n'importe qui quitte un
-- bureau ou il ne travaille plus.
--
-- LE DECLENCHEUR DU LOT 15 NE COUVRE PAS CE CAS. Il porte sur l'UPDATE seulement,
-- et deliberement : un declencheur sur le DELETE ferait echouer la suppression
-- d'un compte, qui efface les lignes de `membres` en cascade. Le dernier maitre
-- se protege donc ICI, a la main.
--
-- ET ON RANGE LE BUREAU COURANT. Sans ca, la personne retiree garde un bureau
-- courant qu'elle n'a plus le droit de lire : tous ses ecrans deviennent vides,
-- sans un mot, et c'est exactement le pire etat connu du projet.
create or replace function public.retirer_membre(b uuid, personne_ciblee uuid)
returns void language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid();
begin
  if moi is null then raise exception 'aucune session'; end if;
  if personne_ciblee <> moi and not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut retirer quelqu''un';
  end if;

  if exists (select 1 from public.membres
              where bureau = b and personne = personne_ciblee and role = 'maitre')
     and not exists (select 1 from public.membres
                      where bureau = b and role = 'maitre' and personne <> personne_ciblee) then
    raise exception 'ce bureau n''aurait plus aucun maitre';
  end if;

  /* ON NE QUITTE PAS SON DERNIER BUREAU, trouve par le banc le 13/09/2026.
     Le cas se produit vraiment : Alice, maitresse de son propre bureau, nomme son
     associe maitre a son tour, puis s'en va. Elle n'appartient alors a AUCUN
     bureau. Consequence, cote navigateur : `monBureau()` rend nul, `pret()` est
     faux dans tous les modules, et tout le bureau devient muet SANS UN MESSAGE.
     C'est exactement l'etat que le projet refuse partout ailleurs.

     Tout compte nait avec son bureau solo (declencheur du lot 15), donc un
     collegue invite en a toujours au moins deux et se retire sans probleme. Cette
     exception ne se declenche que dans le cas ci-dessus, et elle rend l'invariant
     tenable : une personne appartient toujours a au moins un bureau. */
  if not exists (select 1 from public.membres
                  where personne = personne_ciblee and bureau <> b) then
    raise exception 'c''est le dernier bureau de cette personne : un compte appartient toujours a au moins un bureau';
  end if;

  delete from public.membres where bureau = b and personne = personne_ciblee;
  if not found then raise exception 'cette personne n''est pas dans ce bureau'; end if;

  update public.profils p
     set bureau_courant = (select m.bureau from public.membres m
                            where m.personne = personne_ciblee
                            order by m.depuis limit 1)
   where p.id = personne_ciblee and p.bureau_courant = b;
end $$;

revoke all on function public.retirer_membre(uuid, uuid) from public, anon;
grant execute on function public.retirer_membre(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. A CONTROLER APRES AVOIR PASSE CE SCRIPT
-- ---------------------------------------------------------------------------
-- a) Les six fonctions sont la, et seule `invitation_apercu` est ouverte a anon :
--    select p.proname,
--           has_function_privilege('anon', p.oid, 'execute') as anon_peut
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public'
--       and p.proname in ('inviter','invitation_apercu','accepter_invitation',
--                         'annuler_invitation','equipe','changer_role','retirer_membre')
--     order by 1;
--
-- b) L'empreinte du jeton n'est PAS lisible par un compte connecte. On attend
--    zero ligne pour `jeton_hash` :
--    select column_name from information_schema.column_privileges
--     where table_schema='public' and table_name='invitations'
--       and grantee='authenticated' and privilege_type='SELECT'
--       and column_name='jeton_hash';
--
-- c) Et le controle de securite de Supabase, comme apres tout lot SQL.


-- ===========================================================================
-- LOT 20, ajoute le 14/09/2026 : l'invite n'a pas de domaine, le lien part par mail.
-- ===========================================================================
-- Copie de supabase/lot20-invitation-par-mail.sql, qui est ce qu'on colle.
-- ---------------------------------------------------------------------------
-- Defaut signale par Ted le 14/09/2026 : « ca dedouble le bureau que tu as deja ».
-- Il a raison, et la faute vient du lot 15. « Chaque compte nait avec son bureau »
-- etait juste quand tout le monde etait independant. Un salarie qu'on invite n'a
-- pas de domaine : il travaille dans celui de son patron. Son bureau solo est un
-- doublon vide, il encombre le selecteur, et c'est LUI qui obligeait a interdire
-- de quitter son dernier bureau.
--
-- Le declencheur regarde donc s'il existe une invitation en attente POUR CETTE
-- ADRESSE au moment de l'inscription. C'est la seule facon de le savoir sans rien
-- demander au navigateur, et c'est aussi la plus sure : le client ne peut pas
-- mentir sur une invitation qu'il n'a pas.
create index if not exists invitations_email_en_attente
  on public.invitations (email) where utilise_le is null;

create or replace function public.creer_profil()
returns trigger language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  insert into public.profils (id, email) values (new.id, new.email)
  on conflict (id) do nothing;

  if not exists (select 1 from public.membres m where m.personne = new.id)
     and not exists (
       select 1 from public.invitations i
        where i.email = lower(new.email)
          and i.utilise_le is null
          and i.expire_le > now()
     ) then
    insert into public.bureaux (nom, cree_par) values ('Mon bureau', new.id)
      returning bureau into b;
    insert into public.membres (bureau, personne, role) values (b, new.id, 'maitre');
    update public.profils set bureau_courant = b where id = new.id;
  end if;

  return new;
end $$;

revoke all on function public.creer_profil() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. ON PEUT DONC N'APPARTENIR A AUCUN BUREAU
-- ---------------------------------------------------------------------------
-- Consequence directe de la section 1, et il faut la regarder en face : le jour
-- ou un maitre retire un salarie qui n'a que ce bureau-la, ce salarie se retrouve
-- avec zero bureau. C'etait exactement ce que le garde du lot 18 interdisait.
--
-- LE GARDE EST DONC RETIRE ICI, ET REMPLACE PAR UN ECRAN. `bureau_courant` passe a
-- `null`, le navigateur le voit, et la piece « L'equipe » le dit en toutes lettres
-- avec un bouton pour creer son propre bureau. Un etat nomme vaut mieux qu'un etat
-- interdit : interdire de partir, c'est enfermer quelqu'un chez son ancien patron.
--
-- Le garde du DERNIER MAITRE, lui, reste : un bureau sans maitre est un bureau que
-- plus personne ne peut administrer, et ca, aucun ecran ne le rattrape.
create or replace function public.retirer_membre(b uuid, personne_ciblee uuid)
returns void language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid();
begin
  if moi is null then raise exception 'aucune session'; end if;
  if personne_ciblee <> moi and not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut retirer quelqu''un';
  end if;

  if exists (select 1 from public.membres
              where bureau = b and personne = personne_ciblee and role = 'maitre')
     and not exists (select 1 from public.membres
                      where bureau = b and role = 'maitre' and personne <> personne_ciblee) then
    raise exception 'ce bureau n''aurait plus aucun maitre';
  end if;

  delete from public.membres where bureau = b and personne = personne_ciblee;
  if not found then raise exception 'cette personne n''est pas dans ce bureau'; end if;

  -- Nul quand il ne reste rien, et c'est un etat VALIDE depuis ce lot. Laisser un
  -- bureau courant qu'on n'a plus le droit de lire donnerait des ecrans vides sans
  -- un mot, ce que le projet refuse partout ailleurs.
  update public.profils p
     set bureau_courant = (select m.bureau from public.membres m
                            where m.personne = personne_ciblee
                            order by m.depuis limit 1)
   where p.id = personne_ciblee and p.bureau_courant = b;
end $$;

revoke all on function public.retirer_membre(uuid, uuid) from public, anon;
grant execute on function public.retirer_membre(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. CREER SON PROPRE BUREAU
-- ---------------------------------------------------------------------------
-- La sortie de l'etat « aucun bureau », et accessoirement ce qui permet a un
-- vigneron de tenir deux domaines. Le plafond n'est pas decoratif : sans lui, un
-- compte peut fabriquer des bureaux a la chaine et se servir du plafond
-- d'invitations de chacun (section 4) pour envoyer du courrier a volonte.
create or replace function public.creer_bureau(nom text)
returns uuid language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid(); b uuid; propre text := nullif(trim(nom), '');
begin
  if moi is null then raise exception 'aucune session'; end if;
  if propre is null then raise exception 'il faut un nom'; end if;
  if (select count(*) from public.membres where personne = moi) >= 10 then
    raise exception 'tu es deja dans dix bureaux, c''est le maximum';
  end if;

  insert into public.bureaux (nom, cree_par) values (left(propre, 120), moi)
    returning bureau into b;
  insert into public.membres (bureau, personne, role) values (b, moi, 'maitre');
  update public.profils set bureau_courant = b where id = moi;
  return b;
end $$;

revoke all on function public.creer_bureau(text) from public, anon;
grant execute on function public.creer_bureau(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. UN PLAFOND D'INVITATIONS, PARCE QUE LE LIEN PART MAINTENANT PAR MAIL
-- ---------------------------------------------------------------------------
-- Tant que le maitre copiait le lien lui-meme, inviter ne coutait rien a personne.
-- Des lors que le bouton ENVOIE un mail a une adresse quelconque, c'est un relais
-- a courrier indesirable, et il porte le nom de domaine du Bureau du Vigneron.
--
-- Deux plafonds et pas un : par BUREAU, et par PERSONNE. Le premier seul se
-- contourne en creant des bureaux, le second seul se contourne a plusieurs.
-- Vingt par jour est tres au-dessus d'un usage reel (un domaine invite deux ou
-- trois personnes dans sa vie) et tres en-dessous de ce qui interesse un
-- spammeur.
--
-- ET LE PLAFOND EST DANS LA BASE, pas dans la fonction d'envoi : c'est la base qui
-- fait foi, et elle protege aussi l'appel direct a /rest/v1/rpc/inviter.
create or replace function public.inviter(b uuid, courriel text, r text default 'simple')
returns text language plpgsql security definer set search_path = public as $$
declare
  jeton text;
  adresse text := lower(trim(courriel));
begin
  if not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut inviter';
  end if;
  if adresse !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'cette adresse ne ressemble pas a une adresse e-mail';
  end if;
  if r not in ('maitre','simple') then
    raise exception 'role inconnu';
  end if;
  if exists (select 1 from public.membres m join auth.users u on u.id = m.personne
              where m.bureau = b and lower(u.email) = adresse) then
    raise exception 'cette personne est deja dans ce bureau';
  end if;

  if (select count(*) from public.invitations
       where bureau = b and cree_le > now() - interval '1 day') >= 20 then
    raise exception 'vingt invitations depuis ce bureau aujourd''hui, c''est le maximum. Reessaie demain.';
  end if;
  if (select count(*) from public.invitations
       where invite_par = auth.uid() and cree_le > now() - interval '1 day') >= 20 then
    raise exception 'vingt invitations envoyees aujourd''hui, c''est le maximum. Reessaie demain.';
  end if;

  delete from public.invitations
   where bureau = b and email = adresse and utilise_le is null;

  jeton := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.invitations (jeton_hash, bureau, email, role, invite_par)
  values (encode(sha256(convert_to(jeton, 'UTF8')), 'hex'), b, adresse, r, auth.uid());

  return jeton;
end $$;

revoke all on function public.inviter(uuid, text, text) from public, anon;
grant execute on function public.inviter(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. L'APERCU REND L'ADRESSE INVITEE
-- ---------------------------------------------------------------------------
-- Arbitrage de Ted du 14/09/2026, et c'est ce qui fait marcher le cas « je n'ai
-- pas encore de compte » : l'ecran preremplit l'inscription avec cette adresse et
-- ne la laisse pas changer. Sans elle, l'invite cree un compte avec l'adresse de
-- son choix, et l'acceptation echoue APRES coup sur « cette invitation a ete
-- envoyee a une autre adresse », c'est-a-dire au pire moment.
--
-- Ce que ca coute : quelqu'un qui tient le lien apprend l'adresse invitee. Il tient
-- deja un jeton de 244 bits, il est donc soit l'invite, soit quelqu'un a qui il l'a
-- transmis. Ce qui protege reste entier : accepter demande le lien ET d'etre
-- connecte avec cette adresse-la.
-- `create or replace` NE SUFFIT PAS ICI : la fonction gagne une colonne, et Postgres
-- refuse de changer le type de retour d'une fonction existante (« cannot change return
-- type of existing function »). Elle se supprime donc d'abord. C'est le genre de detail
-- qui arrete un script au milieu dans un onglet de navigateur.
drop function if exists public.invitation_apercu(text);

create or replace function public.invitation_apercu(jeton text)
returns table (bureau_nom text, invite_par_prenom text, email text, etat text)
language sql stable security definer set search_path = public as $$
  select b.nom,
         coalesce(nullif(trim(p.prenom), ''), split_part(p.email, '@', 1)),
         i.email,
         case when i.utilise_le is not null then 'utilisee'
              when i.expire_le < now()      then 'expiree'
              else 'valide' end
    from public.invitations i
    join public.bureaux b on b.bureau = i.bureau
    left join public.profils p on p.id = i.invite_par
   where i.jeton_hash = encode(sha256(convert_to(jeton, 'UTF8')), 'hex');
$$;

revoke all on function public.invitation_apercu(text) from public;
grant execute on function public.invitation_apercu(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. A CONTROLER APRES AVOIR PASSE CE SCRIPT
-- ---------------------------------------------------------------------------
-- a) Les deux nouvelles fonctions sont la, et `creer_bureau` est fermee a anon :
--    select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_peut
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname in ('creer_bureau','inviter','invitation_apercu')
--     order by 1;
--
-- b) L'apercu rend bien quatre colonnes, dont l'adresse :
--    select * from public.invitation_apercu('jeton-invente');   -- zero ligne, sans erreur
--
-- c) Et le controle de securite de Supabase, comme apres tout lot SQL.


-- ===========================================================================
-- L'ABONNEMENT AGENDA, Lot E du 15/09/2026. Detail et motifs complets dans
-- supabase/lot12-agenda-abonnement.sql. Resume : une URL .ics est un mot de
-- passe deguise en lien, donc le flux ne porte QUE la bibliotheque, le jeton
-- est tire au hasard et ne derive pas de l'identifiant, et la revocation est
-- une suppression de ligne et pas un drapeau.
-- ===========================================================================
create table if not exists public.agenda_abonnement (
  id      uuid not null primary key references auth.users on delete cascade,
  -- Tire au hasard cote navigateur, 32 octets en base64url, soit 43 signes.
  -- La borne basse n'est pas decorative : elle interdit qu'un jour quelqu'un
  -- pose a la main un jeton court, devinable par force brute.
  jeton   text not null unique check (char_length(jeton) between 32 and 64),
  cree_le timestamptz not null default now(),
  -- Ecrit par la fonction Edge a chaque lecture du flux. C'est ce qui permet
  -- de repondre a « est-ce que quelqu'un s'en sert vraiment », et a « depuis
  -- quand ce jeton n'a-t-il plus servi » avant de le revoquer.
  vu_le   timestamptz
);

alter table public.agenda_abonnement enable row level security;

drop policy if exists "lire son abonnement agenda" on public.agenda_abonnement;
create policy "lire son abonnement agenda" on public.agenda_abonnement
  for select using (auth.uid() = id);
drop policy if exists "creer son abonnement agenda" on public.agenda_abonnement;
create policy "creer son abonnement agenda" on public.agenda_abonnement
  for insert with check (auth.uid() = id);
drop policy if exists "remplacer son abonnement agenda" on public.agenda_abonnement;
create policy "remplacer son abonnement agenda" on public.agenda_abonnement
  for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "revoquer son abonnement agenda" on public.agenda_abonnement;
create policy "revoquer son abonnement agenda" on public.agenda_abonnement
  for delete using (auth.uid() = id);

-- `anon` NE DOIT RIEN POUVOIR LIRE ICI, et c'est le point le plus important du
-- fichier. Le flux est servi par la fonction Edge avec la cle de service, qui
-- ne quitte jamais Supabase. Si `anon` pouvait lire cette table, n'importe qui
-- pourrait moissonner tous les jetons du site avec la cle publiable.
revoke all on public.agenda_abonnement from anon;
grant select, insert, update, delete on public.agenda_abonnement to authenticated;

-- PAS dans effacer_mes_donnees(), meme motif que les signets, les taches et les
-- choix de calendrier : cette fonction vide LA BASE DE VENTES, pas le compte.
