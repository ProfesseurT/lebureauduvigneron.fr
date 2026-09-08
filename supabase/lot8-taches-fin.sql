-- ===========================================================================
-- LE BUREAU DU VIGNERON — UNE TACHE PEUT DURER PLUSIEURS JOURS
-- ===========================================================================
-- 08/09/2026, demande de Ted : « la creation d'une occurrence doit demander
-- aussi une date de fin facultative : imagine c'est un salon sur plusieurs
-- jours ». A coller dans l'editeur SQL de Supabase, apres
-- lot7-calendrier-choix.sql. Recopie dans supabase/schema.sql, la reference.
--
-- POURQUOI UNE COLONNE ET PAS UNE DUREE. Les occurrences de la bibliotheque
-- portent une `duree` en jours, parce qu'une regle annuelle recalcule sa fin
-- chaque annee. Une tache, elle, ne se repete pas : elle a une vraie date de
-- fin, et l'ecrire telle quelle evite de la deduire d'un compte de jours a
-- chaque lecture. Les deux formes disent la meme chose, chacune la ou elle est
-- juste.
--
-- LE RETARD SE COMPTE SUR LA FIN, PAS SUR LE DEBUT. Un salon du 9 au 11 fevrier
-- n'est pas en retard le 10. C'est une regle d'affichage, elle vit dans le
-- code ; la colonne se contente d'exister.
-- ===========================================================================

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
