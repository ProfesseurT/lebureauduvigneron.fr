-- ============================================================================
-- LOT 39, 28/09/2026 : LE NOUVEAU CLIENT D'UNE AFFAIRE. A COLLER APRES LE LOT 38.
-- ============================================================================
-- Demande de Ted : creer un client dans l'affaire, par son SIRET ou a la main. En
-- base c'est une PISTE (pas encore dans Vitisoft) ; il lui manquait son SIRET et son
-- adresse, que l'annuaire officiel fournit et que le devis imprimera.
--
-- LE NAVIGATEUR MARCHE AVANT CE SQL : sans les colonnes, la piste se cree sans elles
-- et l'ecran le dit. REJOUABLE. « Vider la base » n'y touche pas (lot 34).
-- ============================================================================
alter table public.pistes
  add column if not exists siret text check (siret is null or siret ~ '^[0-9]{14}$');
alter table public.pistes
  add column if not exists adresse text check (adresse is null or char_length(adresse) <= 200);

create index if not exists pistes_siret on public.pistes (bureau, siret) where siret is not null;

-- CONTROLE, a lancer apres (il ne modifie rien)
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'pistes' and column_name in ('siret','adresse');
--   -> 2 lignes
