-- ============================================================================
-- LOT 78, 08/10/2026 : LE NOM AFFICHE DES MAILS ENVOYES DEPUIS SA BOITE. APRES LE LOT 77.
-- ============================================================================
-- Ted, apres le premier envoi reel : le client voyait « teddypereira88@gmail.com » seul.
-- Arbitrage de Ted : un champ libre « Nom affiche » dans Mes envois, rempli avec son nom
-- au depart. Vide, c'est le nom de sa signature (lot 75) ; vide aussi, l'adresse seule.
--   - colonne `boites.nom_affiche`, 1 a 80 signes, sans caractere de controle, ni @ < > " \ :
--     un nom qui ressemble a une adresse (« service@banque.fr ») tromperait le destinataire ;
--   - `boite_nommer()` : le vigneron l'ecrit pour SA boite seulement ;
--   - `boite_pour_envoi()` rend `nom` (le nom choisi, sinon celui de la signature).
-- REJOUABLE.
-- ============================================================================

alter table public.boites add column if not exists nom_affiche text;
alter table public.boites drop constraint if exists boites_nom_affiche;
alter table public.boites add constraint boites_nom_affiche check (
  nom_affiche is null or (char_length(nom_affiche) between 1 and 80
    and nom_affiche !~ '[[:cntrl:]@<>"\\]' and btrim(nom_affiche) = nom_affiche));
grant select (nom_affiche) on public.boites to authenticated;

create or replace function public.boite_nommer(p_bureau uuid, p_nom text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n text := nullif(btrim(regexp_replace(coalesce(p_nom, ''), '\s+', ' ', 'g')), '');
begin
  update public.boites set nom_affiche = n, maj_le = now()
    where bureau = p_bureau and personne = auth.uid();
  return found;
end $$;
revoke all on function public.boite_nommer(uuid, text) from public, anon, authenticated;
grant execute on function public.boite_nommer(uuid, text) to authenticated;

-- Le type rendu change : Postgres demande de supprimer la fonction avant de la recreer.
drop function if exists public.boite_pour_envoi(uuid, uuid);
create function public.boite_pour_envoi(p_personne uuid, p_bureau uuid)
returns table (adresse text, serveur text, identifiant text, secret text, copie_a_soi boolean, nom text)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query
    select b.adresse, b.serveur, b.identifiant, v.decrypted_secret, b.copie_a_soi,
           coalesce(b.nom_affiche, (select s.nom from public.signatures s
                                     where s.bureau = b.bureau and s.personne = b.personne))
      from public.boites b
      join vault.decrypted_secrets v on v.id = b.secret_id
     where b.bureau = p_bureau and b.personne = p_personne
       and b.etat = 'branchee' and b.utiliser
       and exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne);
end $$;
revoke all on function public.boite_pour_envoi(uuid, uuid) from public, anon, authenticated;
grant execute on function public.boite_pour_envoi(uuid, uuid) to service_role;

-- CONTROLE, a lancer apres (il ne modifie rien)
-- select has_function_privilege('authenticated', 'public.boite_pour_envoi(uuid, uuid)', 'execute') as connecte_envoi,
--        has_function_privilege('authenticated', 'public.boite_nommer(uuid, text)', 'execute') as connecte_nommer;
--   -> faux, vrai
