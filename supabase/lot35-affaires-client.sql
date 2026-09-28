-- ============================================================================
-- LOT 35, 28/09/2026 : LE NOM DU CLIENT SUR UNE AFFAIRE. A COLLER APRES LE LOT 34.
-- ============================================================================
-- Une affaire chez un client existant porte son numero Vitisoft (`client_id`) et,
-- depuis ce lot, le nom qu'il avait a l'ouverture de l'affaire. C'est une ETIQUETTE,
-- pas une copie de la fiche : Vitisoft fait foi pour tout le reste. Sans elle, la
-- piece « Mes affaires » ne pourrait afficher qu'un numero, parce qu'elle ne charge
-- pas les lignes de vente.
--
-- LE NAVIGATEUR MARCHE AVANT CE SQL : sans la colonne, il cree l'affaire sans le nom
-- et affiche « Client n° ». REJOUABLE.
-- ============================================================================
alter table public.affaires
  add column if not exists client_nom text
  check (client_nom is null or char_length(client_nom) <= 160);

-- CONTROLE, a lancer apres (il ne modifie rien)
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'affaires' and column_name = 'client_nom';
--   -> 1 ligne
