-- ============================================================================
-- LOT 51 : MENTIONS LEGALES, REFUS DU CLIENT, ANNULER UNE ACCEPTATION, 01/10/2026
-- ============================================================================
-- A coller dans Supabase (SQL Editor) APRES lot50-devis-envoye.sql. Rejouable.
--
-- Ce que Ted a valide le 01/10/2026 (« les trois d'un coup ») :
--   1. MENTIONS : deux champs FACULTATIFS de la fiche du domaine, la ville du greffe
--      (`rcs_ville`, R123-237 du Code de commerce : « RCS » suivi de la ville du greffe,
--      pour qui est immatricule) et le capital social (`capital_eur`, obligatoire pour
--      SARL et societes par actions). Recopies dans l'instantane `vendeur` du devis.
--      Le cadre « Bon pour accord » est sur le papier, rien en base.
--   2. REFUS : `devis_refuser()` passe un devis enregistre ou envoye a `refuse`, avec la
--      date, l'auteur et le motif (la liste des affaires perdues). `p_clore` passe aussi
--      l'affaire a « Pas pour cette fois », et la base REFUSE si un autre devis de
--      l'affaire est encore en cours. Un devis refuse ne bouge plus ; il se refait.
--   3. ANNULER UNE ACCEPTATION : `devis_annuler_accord()` ramene un devis accepte a
--      `envoye` (s'il etait parti) ou `enregistre`, efface date, auteur et code tarif de
--      l'accord, garde la TRACE de l'annulation, et rouvre l'affaire si `p_rouvrir`.
-- ============================================================================

-- 1. LES COLONNES
alter table public.domaine add column if not exists rcs_ville text;
alter table public.domaine drop constraint if exists domaine_rcs_ville;
alter table public.domaine add constraint domaine_rcs_ville
  check (rcs_ville is null or char_length(btrim(rcs_ville)) between 1 and 80);
alter table public.domaine add column if not exists capital_eur bigint;
alter table public.domaine drop constraint if exists domaine_capital;
alter table public.domaine add constraint domaine_capital
  check (capital_eur is null or capital_eur between 1 and 999999999999);

alter table public.devis add column if not exists refuse_le     timestamptz;
alter table public.devis add column if not exists refuse_par    uuid references auth.users(id) on delete set null;
alter table public.devis add column if not exists refuse_motif  text;
alter table public.devis drop constraint if exists devis_refuse_motif;
alter table public.devis add constraint devis_refuse_motif
  check (refuse_motif is null or refuse_motif in
    ('prix', 'fournisseur', 'moment', 'sans_reponse', 'indisponible', 'autre'));
alter table public.devis drop constraint if exists devis_refuse_date;
alter table public.devis add constraint devis_refuse_date
  check (statut <> 'refuse' or refuse_le is not null);
alter table public.devis add column if not exists accord_annule_le  timestamptz;
alter table public.devis add column if not exists accord_annule_par uuid references auth.users(id) on delete set null;

-- 2. LE GEL, REECRIT. Abandonne et refuse : plus rien ne bouge. Accepte : rien ne bouge,
--    SAUF le retour en arriere de l'annulation (statut, et les colonnes de l'accord).
--    Les autres statuts : seules les colonnes des transitions bougent.
create or replace function public.devis_signer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare libres text[] := array['statut', 'signe_le', 'accepte_le', 'accepte_par', 'code_tarif',
  'abandonne_le', 'refuse_le', 'refuse_par', 'refuse_motif', 'accord_annule_le', 'accord_annule_par',
  'maj_par', 'maj_le'];
begin
  if tg_op = 'INSERT' then
    new.cree_par := coalesce(auth.uid(), new.cree_par); new.cree_le := now();
  else
    new.cree_par := old.cree_par; new.cree_le := old.cree_le;
    if (new.bureau, new.affaire_id, new.annee, new.rang, new.numero, new.date_devis)
       is distinct from (old.bureau, old.affaire_id, old.annee, old.rang, old.numero, old.date_devis) then
      raise exception 'numero et date d''un devis ne changent jamais' using errcode = '23514';
    end if;
    if old.statut = 'abandonne' then
      raise exception 'devis abandonne : il ne se modifie plus' using errcode = '23514';
    end if;
    if old.statut = 'refuse' then
      raise exception 'devis refuse : il ne se modifie plus' using errcode = '23514';
    end if;
    if old.statut = 'accepte'
       and not (new.statut in ('envoye', 'enregistre') and new.accepte_le is null
                and new.accord_annule_le is not null
                and new.accord_annule_le is distinct from old.accord_annule_le
                and (new.statut = 'envoye') = (old.envoye_le is not null)) then
      raise exception 'devis accepte : il ne se modifie plus' using errcode = '23514';
    end if;
    if old.statut <> 'enregistre'
       and (to_jsonb(new) - libres) is distinct from (to_jsonb(old) - libres) then
      raise exception 'devis fige : fais-en une nouvelle version' using errcode = '23514';
    end if;
  end if;
  if auth.uid() is not null then new.maj_par := auth.uid();
  elsif tg_op = 'UPDATE' then new.maj_par := old.maj_par; end if;
  new.maj_le := now();
  return new;
end
$$;
revoke all on function public.devis_signer() from public, anon, authenticated;

-- 3. REFUSER
-- Refus : 42501 hors du bureau ; P0002 devis introuvable ; 23514 devis qui n'est ni
-- enregistre ni envoye, motif inconnu, affaire close quand on veut la clore, autre devis
-- encore en cours. Deja refuse : rendu tel quel (double appui).
drop function if exists public.devis_refuser(uuid, uuid, text, boolean);
create function public.devis_refuser(p_bureau uuid, p_devis uuid, p_motif text default null, p_clore boolean default false)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare d public.devis; af public.affaires; m text;
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  select * into d from public.devis x
   where x.bureau = p_bureau and x.devis_id = p_devis for update;
  if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
  if d.statut = 'refuse' then return d; end if;
  if d.statut not in ('enregistre', 'envoye') then
    raise exception 'devis non refusable : il n''est plus en cours' using errcode = '23514';
  end if;
  m := coalesce(nullif(btrim(p_motif), ''), 'autre');
  if m not in ('prix', 'fournisseur', 'moment', 'sans_reponse', 'indisponible', 'autre') then
    raise exception 'motif inconnu' using errcode = '23514';
  end if;
  select * into af from public.affaires x
   where x.bureau = p_bureau and x.affaire_id = d.affaire_id for update;
  if coalesce(p_clore, false) then
    if af.issue <> 'en_cours' then raise exception 'affaire close' using errcode = '23514'; end if;
    if exists (select 1 from public.devis x where x.bureau = p_bureau and x.affaire_id = d.affaire_id
                 and x.devis_id <> d.devis_id and x.statut in ('enregistre', 'envoye')) then
      raise exception 'autre devis en cours' using errcode = '23514';
    end if;
  end if;

  update public.devis x set statut = 'refuse', refuse_le = now(), refuse_par = auth.uid(), refuse_motif = m
   where x.bureau = p_bureau and x.devis_id = d.devis_id
  returning * into d;

  if coalesce(p_clore, false) then
    update public.affaires x set issue = 'perdue', motif = m
     where x.bureau = p_bureau and x.affaire_id = af.affaire_id;
  end if;
  return d;
end
$$;
revoke all on function public.devis_refuser(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.devis_refuser(uuid, uuid, text, boolean) to authenticated;

-- 4. ANNULER UNE ACCEPTATION
-- Refus : 42501, P0002, 23514 devis qui n'est pas accepte. `p_rouvrir` remet l'affaire
-- en cours si elle est gagnee. La base ne sait pas si la commande est deja dans Vitisoft :
-- l'ecran le dit, et un reimport du meme numero y est refuse (erreur 12).
drop function if exists public.devis_annuler_accord(uuid, uuid, boolean);
create function public.devis_annuler_accord(p_bureau uuid, p_devis uuid, p_rouvrir boolean default true)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare d public.devis; af public.affaires;
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  select * into d from public.devis x
   where x.bureau = p_bureau and x.devis_id = p_devis for update;
  if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
  if d.statut <> 'accepte' then
    raise exception 'devis non accepte : rien a annuler' using errcode = '23514';
  end if;
  select * into af from public.affaires x
   where x.bureau = p_bureau and x.affaire_id = d.affaire_id for update;

  update public.devis x
     set statut = case when x.envoye_le is not null then 'envoye' else 'enregistre' end,
         accepte_le = null, accepte_par = null, code_tarif = null,
         accord_annule_le = now(), accord_annule_par = auth.uid()
   where x.bureau = p_bureau and x.devis_id = d.devis_id
  returning * into d;

  if coalesce(p_rouvrir, true) and af.issue = 'gagnee' then
    update public.affaires x set issue = 'en_cours'
     where x.bureau = p_bureau and x.affaire_id = af.affaire_id;
  end if;
  return d;
end
$$;
revoke all on function public.devis_annuler_accord(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.devis_annuler_accord(uuid, uuid, boolean) to authenticated;

-- 5. ENREGISTRER : le corps du lot 50, plus le RCS et le capital dans le vendeur, et un devis
--    REFUSE qui peut se refaire (il garde son statut). Le corps est celui du lot 47,
--    plus le remplacement. L'ancienne signature a six arguments est retiree : le
--    navigateur appelle par NOMS, et le septieme a une valeur par defaut.
drop function if exists public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text);
drop function if exists public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text, uuid);
create function public.devis_enregistrer(
  p_bureau uuid, p_affaire uuid, p_devis uuid, p_lignes jsonb,
  p_remise_globale_cb integer default 0, p_notes text default null, p_version_de uuid default null)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare
  af public.affaires; pi public.pistes; dom public.domaine; d public.devis; ancien public.devis;
  cle text; v_num text; v_nom text; v_ville text; v_cp text; v_pays text; v_mail text;
  g integer; jour date; y integer; n integer;
  vendeur_j jsonb; acheteur_j jsonb; t_vins bigint; t_ht bigint; t_tva bigint;
begin
  -- Le controle d'acces en PREMIERE LIGNE : la fonction est `security definer`.
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array'
     or jsonb_array_length(p_lignes) not between 1 and 200 then
    raise exception 'un devis porte de 1 a 200 lignes' using errcode = '23514';
  end if;
  g := coalesce(p_remise_globale_cb, 0);

  select * into af from public.affaires x
   where x.bureau = p_bureau and x.affaire_id = p_affaire for share;
  if not found then raise exception 'affaire introuvable' using errcode = 'P0002'; end if;
  if af.issue <> 'en_cours' then raise exception 'affaire close' using errcode = '23514'; end if;

  -- LOT 50 : « REFAIRE CE DEVIS ». Le nouveau devis REMPLACE un devis de la meme affaire,
  -- encore en cours (enregistre ou envoye) : l'ancien passe abandonne dans la MEME
  -- transaction, plus bas. Un nouveau devis seulement : on ne remplace pas en modifiant.
  if p_version_de is not null then
    if p_devis is not null then
      raise exception 'un devis modifie ne remplace pas un autre devis' using errcode = '23514';
    end if;
    select * into ancien from public.devis x
     where x.bureau = p_bureau and x.devis_id = p_version_de and x.affaire_id = p_affaire for update;
    if not found then raise exception 'devis remplace introuvable' using errcode = 'P0002'; end if;
    if ancien.statut not in ('enregistre', 'envoye', 'refuse') then
      raise exception 'devis remplace : il n''est plus en cours' using errcode = '23514';
    end if;
  end if;

  -- LE VENDEUR, relu a chaque enregistrement. Meme liste que BdvDomaine.complete().
  select * into dom from public.domaine x where x.bureau = p_bureau;
  if not found or dom.raison_sociale is null or dom.siret is null or dom.adresse is null
     or dom.code_postal is null or dom.ville is null then
    raise exception 'fiche du domaine incomplete' using errcode = '23514';
  end if;
  vendeur_j := jsonb_build_object(
    'raison_sociale', dom.raison_sociale, 'forme_juridique', dom.forme_juridique,
    'siret', dom.siret, 'siren', dom.siren, 'tva', dom.tva, 'adresse', dom.adresse,
    'code_postal', dom.code_postal, 'ville', dom.ville, 'email', dom.email,
    'telephone', dom.telephone, 'rcs_ville', dom.rcs_ville, 'capital_eur', dom.capital_eur);

  -- L'ACHETEUR. La cle est `client_cle` des ventes (numero Vitisoft, sinon le NOM) :
  -- le numero se relit dans la derniere vente, jamais dans la cle.
  if af.piste_id is not null then
    select * into pi from public.pistes x where x.bureau = p_bureau and x.piste_id = af.piste_id;
    cle := pi.client_id;
  else
    cle := af.client_id;
  end if;
  if cle is not null then
    -- Chaque champ est le plus recent NON VIDE : la derniere ligne d'un client porte
    -- souvent un e-mail vide (un offert, une PLV) alors que la precedente l'avait.
    select (array_agg(x.num order by x.le_jour desc nulls last) filter (where x.num is not null))[1],
           (array_agg(x.nom order by x.le_jour desc nulls last) filter (where x.nom is not null))[1],
           (array_agg(x.ville order by x.le_jour desc nulls last) filter (where x.ville is not null))[1],
           (array_agg(x.cp order by x.le_jour desc nulls last) filter (where x.cp is not null))[1],
           (array_agg(x.pays order by x.le_jour desc nulls last) filter (where x.pays is not null))[1],
           (array_agg(x.mail order by x.le_jour desc nulls last) filter (where x.mail is not null))[1]
      into v_num, v_nom, v_ville, v_cp, v_pays, v_mail
      from (select l.le_jour, nullif(btrim(l.num_client), '') as num, nullif(btrim(l.client_nom), '') as nom,
                   nullif(btrim(l.ville), '') as ville, nullif(btrim(l.cp), '') as cp,
                   nullif(btrim(l.pays), '') as pays,
                   nullif(btrim(split_part(coalesce(l.emails, ''), ';', 1)), '') as mail
              from public.ventes_lignes l
             where l.bureau = p_bureau and l.client_cle = cle) x;
  end if;
  if pi.piste_id is not null then
    acheteur_j := jsonb_build_object(
      'nom', pi.nom, 'nouveau', pi.client_id is null, 'nature', pi.nature, 'siret', pi.siret,
      'adresse', pi.adresse, 'code_postal', pi.code_postal, 'ville', pi.ville, 'pays', pi.pays,
      'contact_nom', pi.contact_nom, 'email', coalesce(pi.email, v_mail),
      'telephone', pi.telephone, 'num_client', v_num);
  else
    acheteur_j := jsonb_build_object(
      'nom', coalesce(af.client_nom, v_nom, cle), 'nouveau', false, 'adresse', null,
      'code_postal', v_cp, 'ville', v_ville, 'pays', v_pays, 'email', v_mail,
      'num_client', v_num);
  end if;

  if p_devis is null then
    jour := public.devis_jour(now());
    y := extract(year from jour)::int;
    -- Le verrou de ligne tient jusqu'a la fin de la transaction : un echec plus bas
    -- defait l'increment, le numero n'est pas perdu.
    insert into public.devis_compteurs as c (bureau, annee, dernier) values (p_bureau, y, 1)
      on conflict (bureau, annee) do update set dernier = c.dernier + 1
      returning c.dernier into n;
    insert into public.devis (bureau, affaire_id, annee, rang, numero, date_devis, valable_jusqu,
      vendeur, paiement_mode, paiement_jours, validite_jours, acheteur, client_cle, num_client,
      piste_id, remise_globale_cb, tva_cb, notes, version_de)
    values (p_bureau, p_affaire, y, n,
      'D-' || y::text || '-' || lpad(n::text, greatest(4, length(n::text)), '0'),
      jour, jour + dom.validite_jours, vendeur_j, dom.paiement_mode, dom.paiement_jours,
      dom.validite_jours, acheteur_j, cle, v_num, af.piste_id, g, 2000, p_notes, p_version_de)
    returning * into d;
  else
    select * into d from public.devis x
     where x.bureau = p_bureau and x.devis_id = p_devis and x.affaire_id = p_affaire
     for update;
    if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
    if d.statut <> 'enregistre' then
      raise exception 'devis fige : il ne se modifie plus' using errcode = '23514';
    end if;
    delete from public.devis_lignes x where x.bureau = p_bureau and x.devis_id = d.devis_id;
    -- Les totaux passent a zero le temps de reposer les lignes (contraintes d'egalite).
    update public.devis x
       set vendeur = vendeur_j, acheteur = acheteur_j, client_cle = cle, num_client = v_num,
           piste_id = af.piste_id, paiement_mode = dom.paiement_mode,
           paiement_jours = dom.paiement_jours, validite_jours = dom.validite_jours,
           valable_jusqu = x.date_devis + dom.validite_jours,
           remise_globale_cb = g, notes = p_notes,
           total_vins_c = 0, remise_globale_c = 0, total_ht_c = 0, tva_c = 0, total_ttc_c = 0
     where x.bureau = p_bureau and x.devis_id = d.devis_id;
  end if;

  -- LES LIGNES, calculees par la regle de la section C. Une quantite ou un prix qui
  -- n'est pas un entier leve (22P02) : jamais d'arrondi silencieux.
  insert into public.devis_lignes (bureau, devis_id, rang, num_produit, designation,
    conditionnement, millesime, quantite, pu_ht_c, remise_cb, source_prix,
    pu_l_c, pu_f_c, net_c, final_c)
  select p_bureau, d.devis_id, e.ord::smallint,
         nullif(btrim(e.l->>'num_produit'), ''), btrim(e.l->>'designation'),
         nullif(btrim(e.l->>'conditionnement'), ''), nullif(btrim(e.l->>'millesime'), ''),
         k.q, k.pu, k.r, coalesce(nullif(e.l->>'source_prix', ''), 'saisi'),
         pl.pu_l, pf.pu_f, k.q::bigint * pl.pu_l, k.q::bigint * pf.pu_f
    from jsonb_array_elements(p_lignes) with ordinality as e(l, ord)
    cross join lateral (select (e.l->>'quantite')::integer as q,
                               (e.l->>'pu_ht_c')::bigint as pu,
                               coalesce((e.l->>'remise_cb')::integer, 0) as r) k
    cross join lateral (select round(k.pu::numeric * (10000 - k.r) / 10000)::bigint as pu_l) pl
    cross join lateral (select round(pl.pu_l::numeric * (10000 - g) / 10000)::bigint as pu_f) pf;

  select coalesce(sum(x.net_c), 0), coalesce(sum(x.final_c), 0) into t_vins, t_ht
    from public.devis_lignes x where x.bureau = p_bureau and x.devis_id = d.devis_id;
  t_tva := round(t_ht::numeric * 2000 / 10000)::bigint;

  update public.devis x
     set total_vins_c = t_vins, remise_globale_c = t_vins - t_ht, total_ht_c = t_ht,
         tva_c = t_tva, total_ttc_c = t_ht + t_tva
   where x.bureau = p_bureau and x.devis_id = d.devis_id
  returning * into d;

  -- Un devis REFUSE garde son statut : le refus est une trace, pas un abandon.
  if p_version_de is not null and ancien.statut <> 'refuse' then
    update public.devis x set statut = 'abandonne', abandonne_le = now()
     where x.bureau = p_bureau and x.devis_id = p_version_de;
  end if;
  return d;
end
$$;
revoke all on function public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text, uuid) to authenticated;


notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- CONTROLES, a lancer apres (ils ne modifient rien)
-- ---------------------------------------------------------------------------
-- 1) select column_name from information_schema.columns
--     where table_name in ('domaine', 'devis') and column_name in
--       ('rcs_ville', 'capital_eur', 'refuse_le', 'refuse_motif', 'accord_annule_le');
--    -> 5 lignes
-- 2) select p.proname, pg_get_function_identity_arguments(p.oid) from pg_proc p
--     where p.proname in ('devis_refuser', 'devis_annuler_accord', 'devis_enregistrer') order by 1;
--    -> 3 lignes, devis_enregistrer avec 7 arguments
