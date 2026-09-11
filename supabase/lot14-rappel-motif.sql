-- ===========================================================================
-- LOT 14, 11/09/2026 : UN RAPPEL PORTE SON MOTIF
-- ===========================================================================
-- A COLLER DANS L'EDITEUR SQL DE SUPABASE, projet qukmncqqwomhmrdhvetj.
-- Recopie en section 7 de supabase/schema.sql, qui reste la reference.
-- Rejouable : `add column if not exists`.
--
-- DEMANDE DE TED : « je veux pouvoir choisir la date et donner un texte a ce
-- rappel ». Une date seule ne dit pas ce qu'on s'etait promis : trois semaines
-- plus tard, la fiche demande d'appeler sans dire pourquoi, et le vigneron
-- rouvre tout son historique pour le retrouver.
--
-- POURQUOI ICI ET PAS DANS `taches`. C'etait l'autre chemin, et il a ete pese le
-- 11/09/2026 : faire du rappel une vraie tache aurait deplace la verite de
-- `suivi_clients` vers `taches`, donc touche le sous-main, le panneau, la regle
-- « un client deja suivi sort de la file », la vue `v_courrier` et la fonction
-- d'envoi de 8 h. Le calendrier et « Mes taches » LISENT ce rappel la ou il est ;
-- ils ne le recopient pas. Une chose a faire, un seul endroit qui la porte.
--
-- LA COLONNE EST FACULTATIVE, et elle le reste : une date sans motif est un
-- rappel valable. Elle est effacee EN MEME TEMPS que la date (voir planifier()
-- dans src/js/bdv-crm.js) : un motif sans date est une phrase orpheline qu'aucun
-- ecran ne montre, et qui se recollerait au prochain rappel pose sur ce client.
-- ===========================================================================

alter table public.suivi_clients add column if not exists rappel_titre text;

comment on column public.suivi_clients.rappel_titre is
  'Le motif du rappel, facultatif, ecrit par le vigneron. Vit et meurt avec '
  '`rappel` : retirer la date efface le motif.';

-- ---------------------------------------------------------------------------
-- LE CONTROLE, a passer juste apres
-- ---------------------------------------------------------------------------
-- La colonne existe et elle est bien nullable :
--
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'suivi_clients'
--  order by ordinal_position;
--
-- Puis, APRES avoir pose un rappel avec un motif dans une fiche client :
--
-- select client_id, rappel, rappel_titre from public.suivi_clients
--  where rappel_titre is not null;
--
-- Rien ne sort ? Le motif n'est pas parti : verifier que le deploiement Vercel
-- a bien pris src/js/bdv-sync.js, qui est le seul a ecrire cette colonne depuis
-- le tableau de bord.
