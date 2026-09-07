-- ===========================================================================
-- LOT 5, 07/09/2026 : MES TACHES
-- ===========================================================================
-- A coller dans l'editeur SQL de Supabase, ou applique par migration. Le contenu
-- est repris a l'identique en section 14 de schema.sql, qui reste la reference.
--
-- CE QUE CETTE TABLE PORTE, ET CE QU'ELLE NE PORTE PAS. Elle porte deux choses :
--   1. les taches que le vigneron ecrit lui-meme (`source = 'libre'`) ;
--   2. les obligations du calendrier QU'IL A COCHEES (`source = 'echeance'`).
--
-- Les obligations elles-memes ne sont PAS stockees. Elles sont calculees dans le
-- navigateur par src/js/bdv-echeances.js, a partir de src/_data/echeances.json.
-- Deposer les cinq obligations en base a la creation du compte aurait fige un
-- calendrier qui change de loi en loi, et il aurait fallu une tache planifiee
-- pour creer l'occurrence du mois suivant.
--
-- L'OCCURRENCE EST DANS L'IDENTIFIANT. Une DRM revient tous les 10 du mois : ce
-- qui est fait, ce n'est pas « la DRM », c'est la DRM du 10 septembre. D'ou
-- `tache_id = 'ech:drm:2026-09-10'`. Celle d'octobre arrive vierge toute seule.
--
-- DECOCHER UNE OBLIGATION SUPPRIME SA LIGNE. Une obligation pas encore faite est
-- l'etat par defaut du monde : il n'y a rien a stocker pour le dire, et garder
-- des lignes a `fait_le` nul remplirait la table d'occurrences que plus aucun
-- ecran ne montre.
--
-- `id` EN PREMIERE COLONNE DE LA CLE, comme les cinq autres tables du compte.
-- Toute ecriture du site porte `id: BdvCompte.monId()`, pose au moment de
-- l'envoi. C'est la regle nee de la panne des signets du 07/09/2026, ou la
-- colonne manquait et ou la table est restee vide pendant des jours sans qu'un
-- seul message ne le dise.
create table if not exists public.taches (
  id        uuid not null references auth.users on delete cascade,
  tache_id  text not null,
  titre     text,
  source    text not null default 'libre',   -- libre / echeance
  ref       text,                            -- pour une obligation : sa cle (drm, dai...)
  echue_le  date,                            -- facultatif : une tache peut n'avoir aucune date
  fait_le   timestamptz,                     -- nul = a faire
  cree_le   timestamptz not null default now(),
  maj_le    timestamptz not null default now(),
  primary key (id, tache_id)
);

-- « Ce qui reste a faire, du plus proche au plus lointain » est la seule lecture de
-- l'ecran. Les lignes sans date sortent en dernier, l'index les laisse a la fin.
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

-- Volontairement PAS ajoutee a effacer_mes_donnees(), pour la meme raison que les
-- signets : cette fonction est appelee par le bouton « Vider la base », qui parle
-- des lignes de vente. Quelqu'un qui reimporte un export propre ne s'attend pas a
-- y perdre sa liste de courses ni la trace des DRM qu'il a deposees. La suppression
-- complete d'un compte est un autre geste, a ecrire a part le jour ou elle existera.
