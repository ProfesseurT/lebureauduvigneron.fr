-- ===========================================================================
-- LE BUREAU DU VIGNERON — L'ABONNEMENT AGENDA
-- ===========================================================================
-- Lot E du chantier calendrier, 15/09/2026. A coller dans l'editeur SQL de
-- Supabase. Le meme texte est recopie dans supabase/schema.sql, qui reste la
-- reference : ne pas laisser les deux diverger.
--
-- CE QUE CETTE TABLE PORTE : le jeton qui ouvre le flux .ics d'UN compte, et
-- rien d'autre. Pas de contenu, pas de reglages. Le flux se recalcule a chaque
-- lecture depuis la bibliotheque et depuis `calendrier_choix`.
--
-- UNE URL .ICS EST UN MOT DE PASSE DEGUISE EN LIEN, et c'est ce qui commande
-- tout le reste de ce fichier. Google Agenda la garde sur ses serveurs, elle
-- traine dans l'historique du navigateur, elle se recopie dans un mail. Elle ne
-- s'expire jamais toute seule. Trois consequences, decidees avec Ted le
-- 15/09/2026 :
--
--   1. LE FLUX NE PORTE QUE LA BIBLIOTHEQUE. Obligations, travaux, rendez-vous,
--      temps forts. Ni « Mes taches », ni les rappels clients. Une URL qui fuite
--      ne livre alors rien que le site ne publie deja. C'est l'arbitrage 3 du
--      08/09 tenu jusqu'au bout : le calendrier porte des campagnes, le sous-main
--      porte des clients.
--   2. LE JETON NE LAISSE PAS DEVINER LE COMPTE. Il est tire au hasard par le
--      navigateur (crypto.getRandomValues), il n'est PAS derive de `id`. Un
--      jeton qui serait un hachage de l'identifiant permettrait, a qui connait
--      un identifiant, de fabriquer l'URL correspondante.
--   3. IL EST REVOCABLE, ET LA REVOCATION EST UNE SUPPRESSION DE LIGNE. Pas un
--      drapeau `actif` : une ligne revoquee qui reste en base est une ligne qu'un
--      jour quelqu'un rallumera par erreur. Supprimee, l'ancienne URL rend 404.
--
-- UNE SEULE LIGNE PAR COMPTE, tenue par la cle primaire. C'est la reponse a
-- « un flux par personne ou par bureau » : par personne. Un membre qui quitte un
-- bureau emporte son jeton, on le revoque avec son acces, et les autres membres
-- ne voient pas leur abonnement couper.
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
