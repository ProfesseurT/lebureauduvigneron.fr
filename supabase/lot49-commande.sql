-- ============================================================================
-- LOT 49 : LE DEVIS ACCEPTE DEVIENT UNE COMMANDE VITISOFT, 01/10/2026
-- ============================================================================
-- A coller dans Supabase (SQL Editor) APRES lot47-devis.sql. Rejouable.
--
-- Decisions de Ted du 01/10/2026 :
--   1. Le lot 48 (envoi et signature en ligne) attend : la regle du SEUIL s'applique
--      avant le premier mail vers le client du vigneron. On saute a la commande.
--   2. « Le client a dit oui » FIGE le devis (statut `accepte`) et passe l'affaire
--      a « Gagnee », dans la MEME transaction. Une correction = un nouveau devis.
--   3. Le numero de commande du fichier est le numero du devis (D-AAAA-NNNN).
--      Vitisoft refuse un doublon (erreur 12) : re-telecharger ne cree rien deux fois.
--   4. La configuration d'import est celle de la section 3 de CAHIER_script-vitisoft.md.
--
-- CE QUE LA BASE GARDE, ET POURQUOI ELLE LE GARDE ELLE-MEME :
--   - `accepte` n'est pas une signature : aucune preuve n'est exigee (contrairement a
--     `signe`, lot 48). C'est le vigneron qui dit « il a dit oui ».
--   - on REFUSE d'accepter un devis qui ne ferait pas un fichier importable : une ligne
--     sans numero produit (Vitisoft ne sait pas quoi facturer), ou un client existant
--     sans numero NI adresse e-mail (Vitisoft creerait un doublon de client). Le refus
--     vient AVANT le gel : jamais un devis fige qu'on ne peut plus corriger.
--   - le code tarif du client (colonne 17) est relu dans sa derniere vente et COPIE
--     dans le devis au moment de l'accord : le fichier se refait a l'identique.
--   - une affaire qui a deja un devis accepte n'en accepte pas un second.
-- ============================================================================

-- 1. LE STATUT ET SES COLONNES
alter table public.devis drop constraint if exists devis_statut_check;
alter table public.devis add constraint devis_statut_check
  check (statut in ('enregistre', 'abandonne', 'accepte', 'envoye', 'signe', 'refuse'));
alter table public.devis add column if not exists accepte_le  timestamptz;
alter table public.devis add column if not exists accepte_par uuid references auth.users(id) on delete set null;
alter table public.devis add column if not exists code_tarif  text
  check (code_tarif is null or char_length(code_tarif) <= 40);
alter table public.devis drop constraint if exists devis_accepte_date;
alter table public.devis add constraint devis_accepte_date
  check (statut <> 'accepte' or accepte_le is not null);

-- Le gel du lot 47 couvre deja `accepte` : un devis qui n'est plus `enregistre` ne
-- change plus, lignes comprises (devis_signer, devis_lignes_figer). Rien a reecrire.

-- 2. ACCEPTER
-- Refus : 42501 hors du bureau ; P0002 devis introuvable ; 23514 devis non
-- `enregistre`, affaire perdue ou deja commandee, ligne sans numero produit, client
-- existant sans numero ni e-mail. Deja accepte : rendu tel quel (double appui).
drop function if exists public.devis_accepter(uuid, uuid);
create function public.devis_accepter(p_bureau uuid, p_devis uuid)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare d public.devis; af public.affaires; n_sans integer; v_tarif text;
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  select * into d from public.devis x
   where x.bureau = p_bureau and x.devis_id = p_devis for update;
  if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
  if d.statut = 'accepte' then return d; end if;
  if d.statut <> 'enregistre' then
    raise exception 'devis non acceptable : il n''est plus en cours' using errcode = '23514';
  end if;

  select * into af from public.affaires x
   where x.bureau = p_bureau and x.affaire_id = d.affaire_id for update;
  if af.issue = 'perdue' then raise exception 'affaire close' using errcode = '23514'; end if;
  if exists (select 1 from public.devis x where x.bureau = p_bureau
               and x.affaire_id = d.affaire_id and x.statut = 'accepte') then
    raise exception 'affaire deja commandee' using errcode = '23514';
  end if;

  select count(*) into n_sans from public.devis_lignes x
   where x.bureau = p_bureau and x.devis_id = d.devis_id
     and nullif(btrim(coalesce(x.num_produit, '')), '') is null;
  if n_sans > 0 then
    raise exception 'ligne sans numero produit' using errcode = '23514';
  end if;
  if not coalesce((d.acheteur->>'nouveau')::boolean, false)
     and nullif(btrim(coalesce(d.num_client, d.acheteur->>'num_client', '')), '') is null
     and nullif(btrim(coalesce(d.acheteur->>'email', '')), '') is null then
    raise exception 'client sans numero ni e-mail' using errcode = '23514';
  end if;

  if d.client_cle is not null then
    select (array_agg(btrim(l.code_tarif) order by l.le_jour desc nulls last)
              filter (where nullif(btrim(l.code_tarif), '') is not null))[1]
      into v_tarif
      from public.ventes_lignes l
     where l.bureau = p_bureau and l.client_cle = d.client_cle;
  end if;

  update public.devis x
     set statut = 'accepte', accepte_le = now(), accepte_par = auth.uid(),
         code_tarif = left(v_tarif, 40)
   where x.bureau = p_bureau and x.devis_id = d.devis_id
  returning * into d;

  if af.issue = 'en_cours' then
    update public.affaires x set issue = 'gagnee'
     where x.bureau = p_bureau and x.affaire_id = af.affaire_id;
  end if;
  return d;
end
$$;
revoke all on function public.devis_accepter(uuid, uuid) from public, anon, authenticated;
grant execute on function public.devis_accepter(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- CONTROLES, a lancer apres (ils ne modifient rien)
-- ---------------------------------------------------------------------------
-- 1) select pg_get_constraintdef(oid) from pg_constraint where conname = 'devis_statut_check';
--    -> la liste contient 'accepte'
-- 2) select r.rolname from pg_proc p join lateral aclexplode(p.proacl) a on true
--      join pg_roles r on r.oid = a.grantee
--     where p.proname = 'devis_accepter' and a.privilege_type = 'EXECUTE';
--    -> authenticated (et le proprietaire), jamais anon
