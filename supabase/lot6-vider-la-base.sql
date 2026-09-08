-- ============================================================================
-- LOT 6, 08/09/2026 : « Vider la base » ne doit plus effacer tes reglages
-- ============================================================================
-- A COLLER DANS SUPABASE : projet > SQL Editor > New query > coller > Run.
-- Sans risque, et rejouable autant de fois qu'on veut : la fonction est
-- remplacee, aucune donnee n'est touchee par ce fichier lui-meme.
--
-- CE QUI CLOCHAIT, repere le 08/09/2026 en cherchant autre chose.
--
-- Le bouton « Vider la base » du panneau de reglages appelle
-- effacer_mes_donnees(), qui faisait un DELETE sur la LIGNE ENTIERE de la table
-- `reglages`. Or cette ligne ne porte pas que la base : elle porte aussi
-- l'objectif de chiffre d'affaires, le mois d'ouverture de l'exercice, les
-- libelles de familles renommees a la main et le classement valide une fois par
-- le vigneron. Vider sa base effacait donc tout ce travail de reglage, sans
-- l'annoncer, alors que le texte du bouton ne parle que des lignes de vente.
--
-- Pire, c'etait invisible : l'objectif reste dans le stockage local du
-- navigateur, l'ardoise continuait de l'afficher, et le premier geste suivant
-- le renvoyait en base. Le vigneron ne perdait donc rien sur SON poste, et tout
-- sur le suivant.
--
-- CE QU'ON FAIT A LA PLACE. On distingue deux natures dans la meme ligne :
--   * ce qui DECRIT LA BASE : la file de travail deposee par le tableau de
--     bord, le resume des ventes, la date du dernier depot. Ca part avec les
--     ventes, c'en est le reflet.
--   * ce qui est un REGLAGE CHOISI PAR LE VIGNERON : objectif, exercice,
--     libelles, classement. Ca reste. Il ne l'a pas efface, il a efface sa base.
--
-- La ligne n'est donc plus supprimee, elle est mise a jour. Et si elle n'existe
-- pas, il n'y a rien a faire : un UPDATE sur zero ligne ne leve pas.
-- ============================================================================

create or replace function public.effacer_mes_donnees()
returns void language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid();
begin
  if moi is null then raise exception 'aucune session'; end if;

  delete from public.echanges      where id = moi;
  delete from public.ventes        where id = moi;
  delete from public.suivi_clients where id = moi;

  -- La ligne de reglages SURVIT. Seul ce qui decrit la base disparait avec elle.
  update public.reglages
     set file_travail  = null,
         resume_ventes = null,
         depose_le     = null,
         maj_le        = now()
   where id = moi;
end $$;

revoke all on function public.effacer_mes_donnees() from public, anon;
grant execute on function public.effacer_mes_donnees() to authenticated;

-- ----------------------------------------------------------------------------
-- POUR VERIFIER, apres avoir clique « Vider la base » dans l'outil :
--   select objectif, exercice_debut, file_travail, depose_le
--     from public.reglages where id = auth.uid();
-- L'objectif et le mois d'exercice doivent etre encore la, la file et la date
-- de depot a null.
-- ----------------------------------------------------------------------------
