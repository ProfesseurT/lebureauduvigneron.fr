-- ============================================================================
-- LOT 79, 08/10/2026 : LE LOGO DU DOMAINE SOUS LES MAILS ENVOYES DEPUIS SA BOITE. APRES 78.
-- ============================================================================
-- Le logo est celui de Mon domaine (lot 69, `domaine_logo`). Il part DANS le mail, en piece
-- jointe affichee (cid), jamais comme une image hebergee : les messageries bloquent les images
-- distantes par defaut, et le mail ne doit dependre d'aucune adresse du site.
--   - colonne `boites.logo_dans_mails`, cochee par defaut : la case de Mes envois ;
--   - `boite_logo()` : le vigneron la coche ou la decoche pour SA boite ;
--   - `boite_pour_envoi()` rend aussi `logo`, `logo_l` et `logo_h` (null si decochee ou sans logo).
-- `boite_pour_envoi` sert aussi aux mails programmes (lot 84) : ils prennent le logo de meme.
-- REJOUABLE.
-- ============================================================================

alter table public.boites add column if not exists logo_dans_mails boolean not null default true;
grant select (logo_dans_mails) on public.boites to authenticated;

create or replace function public.boite_logo(p_bureau uuid, p_avec boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_avec is null then return false; end if;
  update public.boites set logo_dans_mails = p_avec, maj_le = now()
    where bureau = p_bureau and personne = auth.uid();
  return found;
end $$;
revoke all on function public.boite_logo(uuid, boolean) from public, anon, authenticated;
grant execute on function public.boite_logo(uuid, boolean) to authenticated;

-- Le type rendu change : Postgres demande de supprimer la fonction avant de la recreer.
drop function if exists public.boite_pour_envoi(uuid, uuid);
create function public.boite_pour_envoi(p_personne uuid, p_bureau uuid)
returns table (adresse text, serveur text, identifiant text, secret text, copie_a_soi boolean, nom text,
               logo text, logo_l integer, logo_h integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query
    select b.adresse, b.serveur, b.identifiant, v.decrypted_secret, b.copie_a_soi,
           coalesce(b.nom_affiche, (select s.nom from public.signatures s
                                     where s.bureau = b.bureau and s.personne = b.personne)),
           case when b.logo_dans_mails then l.image end,
           case when b.logo_dans_mails then l.largeur end,
           case when b.logo_dans_mails then l.hauteur end
      from public.boites b
      join vault.decrypted_secrets v on v.id = b.secret_id
      left join public.domaine_logo l on l.bureau = b.bureau
     where b.bureau = p_bureau and b.personne = p_personne
       and b.etat = 'branchee' and b.utiliser
       and exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne);
end $$;
revoke all on function public.boite_pour_envoi(uuid, uuid) from public, anon, authenticated;
grant execute on function public.boite_pour_envoi(uuid, uuid) to service_role;

-- CONTROLE, a lancer apres (il ne modifie rien)
-- select has_function_privilege('authenticated', 'public.boite_pour_envoi(uuid, uuid)', 'execute') as connecte_envoi,
--        has_function_privilege('authenticated', 'public.boite_logo(uuid, boolean)', 'execute') as connecte_logo;
--   -> faux, vrai
