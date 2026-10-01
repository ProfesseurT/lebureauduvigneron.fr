-- ============================================================================
-- LOT 54, 01/10/2026 : LA TVA DU DEVIS AUTRE QUE 20 %. A COLLER DANS SUPABASE APRES LE LOT 53.
-- ============================================================================
-- Decisions de Ted (01/10/2026) : 5,5 % sur certaines lignes, export hors UE, pro de l'UE.
-- Franchise en base ABANDONNEE (BOFiP BOI-TVA-DECLA-40-10-10 § 80 : exclue pour l'exploitant
-- agricole qui a opte pour la TVA).
--
--   1. LE REGIME DU DEVIS, `regime_tva` :
--        'france' : chaque ligne a 20 % (vin, boissons alcooliques) ou 5,5 % (jus de raisin non
--                   fermente, mout, produits alimentaires : BOFiP BOI-TVA-LIQ-30-10-10) ;
--        'export' : livraison hors UE, exoneree (CGI 262 I) : toutes les lignes a 0 ;
--        'ue'     : livraison a un pro identifie dans un autre pays de l'UE, exoneree
--                   (CGI 262 ter I) : toutes les lignes a 0, et le numero de TVA du client ET
--                   celui du domaine sont obligatoires (BOI-TVA-DECLA-30-20-20-30 § 50).
--      Un devis d'avant ce lot vaut 'france', lignes a 20 % : c'etait le cas.
--   2. LA TVA SE CALCULE PAR TAUX, une fois par taux, sur la base HT de ce taux (lignes a ce
--      taux, plus le port s'il est a ce taux), arrondie au centime. Le port suit le taux du
--      devis (Ted) : 20 % en France, meme quand des lignes sont a 5,5 % ; 0 a l'export et en UE.
--      `devis.tva_cb` devient le TAUX DU PORT (2000 ou 0). Un devis a un seul taux rend
--      exactement l'ancien calcul.
--   3. L'ACCISE : a l'export et en UE, `accises_incluses` dit si les prix saisis comprennent
--      les droits d'accises (case decochee par defaut : un vin qui part en suspension de droits
--      sous DAE ne paie pas l'accise francaise). Le papier dit la verite dans les deux cas.
--   4. LA CONTRAINTE `devis_tva` (une TVA sur le total) est remplacee : elle ne tient plus
--      avec deux taux. La regle vit dans la fonction, et le banc la compare au navigateur.
--
-- REJOUABLE : chaque instruction se repasse sans erreur.
-- ============================================================================

-- 1. LES COLONNES (une valeur par defaut ne declenche aucun declencheur : les devis figes
--    recoivent 'france', 20 %, sans etre « modifies »)
alter table public.devis add column if not exists regime_tva text not null default 'france';
alter table public.devis add column if not exists client_tva text;
alter table public.devis add column if not exists accises_incluses boolean not null default true;
alter table public.devis_lignes add column if not exists tva_cb integer not null default 2000;

alter table public.devis drop constraint if exists devis_regime_tva;
alter table public.devis add constraint devis_regime_tva
  check (regime_tva in ('france', 'export', 'ue'));
alter table public.devis drop constraint if exists devis_tva_cb_check;
alter table public.devis drop constraint if exists devis_tva_port;
alter table public.devis add constraint devis_tva_port
  check ((regime_tva = 'france' and tva_cb = 2000) or (regime_tva <> 'france' and tva_cb = 0));
alter table public.devis drop constraint if exists devis_tva;
alter table public.devis add constraint devis_tva
  check (regime_tva = 'france' or tva_c = 0);
alter table public.devis drop constraint if exists devis_client_tva;
alter table public.devis add constraint devis_client_tva check (
  (regime_tva = 'ue') = (client_tva is not null)
  and (client_tva is null or client_tva ~ '^[A-Z]{2}[0-9A-Z+*]{2,13}$'));
alter table public.devis drop constraint if exists devis_accises;
alter table public.devis add constraint devis_accises
  check (regime_tva <> 'france' or accises_incluses);
alter table public.devis_lignes drop constraint if exists devis_lignes_tva;
alter table public.devis_lignes add constraint devis_lignes_tva check (tva_cb in (2000, 550, 0));

-- 2. ENREGISTRER : le corps du lot 53, plus la TVA (neuvieme argument) et le taux par ligne
--    (`tva_cb` dans chaque element de p_lignes, 2000 par defaut). `p_tva` NULL : un NOUVEAU
--    devis est 'france' ; un devis EXISTANT garde son regime.
drop function if exists public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text, uuid, jsonb);
drop function if exists public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text, uuid, jsonb, jsonb);
create function public.devis_enregistrer(
  p_bureau uuid, p_affaire uuid, p_devis uuid, p_lignes jsonb,
  p_remise_globale_cb integer default 0, p_notes text default null, p_version_de uuid default null,
  p_livraison jsonb default null, p_tva jsonb default null)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare
  af public.affaires; pi public.pistes; dom public.domaine; d public.devis; ancien public.devis;
  cle text; v_num text; v_nom text; v_ville text; v_cp text; v_pays text; v_mail text;
  g integer; jour date; y integer; n integer;
  vendeur_j jsonb; acheteur_j jsonb; t_vins bigint; t_fin bigint; t_ht bigint; t_tva bigint;
  l_mode text; l_adr jsonb; l_date date; l_transp text; l_port bigint; a_in jsonb;
  r_regime text; r_client text; r_accises boolean; r_port_cb integer; v_anciens jsonb;
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

  -- LOT 53 : LA LIVRAISON, lue et nettoyee AVANT toute ecriture.
  if p_livraison is not null and jsonb_typeof(p_livraison) <> 'object' then
    raise exception 'livraison illisible' using errcode = '23514';
  end if;
  l_mode := coalesce(nullif(btrim(p_livraison->>'mode'), ''), 'client');
  if l_mode not in ('client', 'adresse', 'retrait') then
    raise exception 'livraison : mode inconnu' using errcode = '23514';
  end if;
  l_date := nullif(btrim(coalesce(p_livraison->>'souhaitee', '')), '')::date;
  l_transp := nullif(btrim(coalesce(p_livraison->>'transporteur', '')), '');
  l_port := coalesce(nullif(btrim(coalesce(p_livraison->>'port_c', '')), '')::bigint, 0);
  if l_port < 0 or l_port > 9999999 then
    raise exception 'livraison : frais de port hors bornes' using errcode = '23514';
  end if;
  if l_mode = 'retrait' and (l_port > 0 or l_transp is not null) then
    raise exception 'livraison : un retrait au domaine n''a ni port ni transporteur' using errcode = '23514';
  end if;
  if l_mode = 'adresse' then
    a_in := p_livraison->'adresse';
    if a_in is null or jsonb_typeof(a_in) <> 'object' then
      raise exception 'livraison : adresse manquante' using errcode = '23514';
    end if;
    l_adr := jsonb_build_object(
      'nom', nullif(btrim(coalesce(a_in->>'nom', '')), ''),
      'adresse1', nullif(btrim(coalesce(a_in->>'adresse1', '')), ''),
      'adresse2', nullif(btrim(coalesce(a_in->>'adresse2', '')), ''),
      'code_postal', nullif(btrim(coalesce(a_in->>'code_postal', '')), ''),
      'ville', nullif(btrim(coalesce(a_in->>'ville', '')), ''),
      'pays', coalesce(nullif(btrim(coalesce(a_in->>'pays', '')), ''), 'France'),
      'telephone', nullif(btrim(coalesce(a_in->>'telephone', '')), ''));
    if l_adr->>'nom' is null or l_adr->>'adresse1' is null or l_adr->>'code_postal' is null
       or l_adr->>'ville' is null then
      raise exception 'livraison : adresse incomplete' using errcode = '23514';
    end if;
  end if;

  -- LOT 54 : LE REGIME DE TVA, lu AVANT toute ecriture. Le numero du client se range sans
  -- espaces ni points, en majuscules ; il commence par le code de SON pays (pas FR : une
  -- vente a un pro francais n'est pas une livraison intracommunautaire).
  if p_tva is not null and jsonb_typeof(p_tva) <> 'object' then
    raise exception 'tva illisible' using errcode = '23514';
  end if;
  r_regime := coalesce(nullif(btrim(p_tva->>'regime'), ''), 'france');
  if r_regime not in ('france', 'export', 'ue') then
    raise exception 'tva : regime inconnu' using errcode = '23514';
  end if;
  r_client := nullif(upper(regexp_replace(coalesce(p_tva->>'client_tva', ''), '[\s.\-]', '', 'g')), '');
  if coalesce(p_tva->>'accises_incluses', 'true') not in ('true', 'false') then
    raise exception 'tva : accises_incluses doit valoir true ou false' using errcode = '23514';
  end if;
  r_accises := coalesce((p_tva->>'accises_incluses')::boolean, r_regime = 'france');
  if r_regime = 'france' then r_accises := true; end if;
  if r_regime <> 'ue' then r_client := null; end if;
  if r_regime = 'ue' and (r_client is null or r_client !~ '^[A-Z]{2}[0-9A-Z+*]{2,13}$') then
    raise exception 'tva : numero de TVA du client manquant ou illisible' using errcode = '23514';
  end if;
  if r_regime = 'ue' and left(r_client, 2) = 'FR' then
    raise exception 'tva : un numero FR n''est pas une livraison intracommunautaire' using errcode = '23514';
  end if;

  select * into af from public.affaires x
   where x.bureau = p_bureau and x.affaire_id = p_affaire for share;
  if not found then raise exception 'affaire introuvable' using errcode = 'P0002'; end if;
  if af.issue <> 'en_cours' then raise exception 'affaire close' using errcode = '23514'; end if;

  -- LOT 50 : « REFAIRE CE DEVIS ».
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

  -- L'ACHETEUR.
  if af.piste_id is not null then
    select * into pi from public.pistes x where x.bureau = p_bureau and x.piste_id = af.piste_id;
    cle := pi.client_id;
  else
    cle := af.client_id;
  end if;
  if cle is not null then
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
    if l_date is not null and l_date < jour then
      raise exception 'livraison : date souhaitee avant le devis' using errcode = '23514';
    end if;
  else
    select * into d from public.devis x
     where x.bureau = p_bureau and x.devis_id = p_devis and x.affaire_id = p_affaire
     for update;
    if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
    if d.statut <> 'enregistre' then
      raise exception 'devis fige : il ne se modifie plus' using errcode = '23514';
    end if;
    -- SANS p_livraison / p_tva, UN DEVIS EXISTANT GARDE CE QU'IL A : un onglet reste ouvert
    -- sur le code d'avant ne doit rien effacer en silence.
    if p_livraison is null then
      l_mode := d.livraison_mode; l_adr := d.livraison; l_date := d.livraison_souhaitee;
      l_transp := d.transporteur; l_port := d.port_c;
    end if;
    if p_tva is null then
      r_regime := d.regime_tva; r_client := d.client_tva; r_accises := d.accises_incluses;
    end if;
    if l_date is not null and l_date < d.date_devis then
      raise exception 'livraison : date souhaitee avant le devis' using errcode = '23514';
    end if;
  end if;
  -- L'UE EXIGE AUSSI LE NUMERO DU DOMAINE (il s'imprime a cote de celui du client).
  if r_regime = 'ue' and dom.tva is null then
    raise exception 'tva : le numero de TVA du domaine manque (Mon domaine)' using errcode = '23514';
  end if;
  r_port_cb := case when r_regime = 'france' then 2000 else 0 end;
  -- En France, une ligne est a 20 % ou a 5,5 %, jamais a 0 : un devis « en France » sans TVA
  -- ni mention d'exoneration serait faux.
  if r_regime = 'france' and exists (select 1 from jsonb_array_elements(p_lignes) e(l)
       where coalesce(e.l->>'tva_cb', '2000') not in ('2000', '550')) then
    raise exception 'tva : en France une ligne est a 20 %% ou a 5,5 %%' using errcode = '23514';
  end if;

  if p_devis is null then
    y := extract(year from jour)::int;
    insert into public.devis_compteurs as c (bureau, annee, dernier) values (p_bureau, y, 1)
      on conflict (bureau, annee) do update set dernier = c.dernier + 1
      returning c.dernier into n;
    insert into public.devis (bureau, affaire_id, annee, rang, numero, date_devis, valable_jusqu,
      vendeur, paiement_mode, paiement_jours, validite_jours, acheteur, client_cle, num_client,
      piste_id, remise_globale_cb, tva_cb, notes, version_de,
      livraison_mode, livraison, livraison_souhaitee, transporteur,
      regime_tva, client_tva, accises_incluses)
    values (p_bureau, p_affaire, y, n,
      'D-' || y::text || '-' || lpad(n::text, greatest(4, length(n::text)), '0'),
      jour, jour + dom.validite_jours, vendeur_j, dom.paiement_mode, dom.paiement_jours,
      dom.validite_jours, acheteur_j, cle, v_num, af.piste_id, g, r_port_cb, p_notes, p_version_de,
      l_mode, l_adr, l_date, l_transp, r_regime, r_client, r_accises)
    returning * into d;
  else
    -- SANS p_tva (code d'avant le lot), une ligne sans taux reprend celui qu'elle avait :
    -- reconnue par son code et sa designation. Sinon, 20 %.
    if p_tva is null then
      select jsonb_object_agg(coalesce(x.num_produit, '') || '|' || x.designation, x.tva_cb) into v_anciens
        from public.devis_lignes x where x.bureau = p_bureau and x.devis_id = d.devis_id;
    end if;
    delete from public.devis_lignes x where x.bureau = p_bureau and x.devis_id = d.devis_id;
    -- Les totaux ET le port passent a zero le temps de reposer les lignes.
    update public.devis x
       set vendeur = vendeur_j, acheteur = acheteur_j, client_cle = cle, num_client = v_num,
           piste_id = af.piste_id, paiement_mode = dom.paiement_mode,
           paiement_jours = dom.paiement_jours, validite_jours = dom.validite_jours,
           valable_jusqu = x.date_devis + dom.validite_jours,
           remise_globale_cb = g, notes = p_notes,
           livraison_mode = l_mode, livraison = l_adr, livraison_souhaitee = l_date,
           transporteur = l_transp, port_c = 0,
           regime_tva = r_regime, client_tva = r_client, accises_incluses = r_accises, tva_cb = r_port_cb,
           total_vins_c = 0, remise_globale_c = 0, total_ht_c = 0, tva_c = 0, total_ttc_c = 0
     where x.bureau = p_bureau and x.devis_id = d.devis_id;
  end if;

  -- LES LIGNES. Le taux d'une ligne : 2000 ou 550 en France (2000 si absent), 0 sinon, quoi
  -- que dise la ligne. Un taux inconnu leve (contrainte devis_lignes_tva).
  insert into public.devis_lignes (bureau, devis_id, rang, num_produit, designation,
    conditionnement, millesime, quantite, pu_ht_c, remise_cb, source_prix,
    pu_l_c, pu_f_c, net_c, final_c, tva_cb)
  select p_bureau, d.devis_id, e.ord::smallint,
         nullif(btrim(e.l->>'num_produit'), ''), btrim(e.l->>'designation'),
         nullif(btrim(e.l->>'conditionnement'), ''), nullif(btrim(e.l->>'millesime'), ''),
         k.q, k.pu, k.r, coalesce(nullif(e.l->>'source_prix', ''), 'saisi'),
         pl.pu_l, pf.pu_f, k.q::bigint * pl.pu_l, k.q::bigint * pf.pu_f,
         case when r_regime = 'france' then k.t else 0 end
    from jsonb_array_elements(p_lignes) with ordinality as e(l, ord)
    cross join lateral (select (e.l->>'quantite')::integer as q,
                               (e.l->>'pu_ht_c')::bigint as pu,
                               coalesce((e.l->>'remise_cb')::integer, 0) as r,
                               coalesce((e.l->>'tva_cb')::integer,
                                 (v_anciens->>(coalesce(nullif(btrim(e.l->>'num_produit'), ''), '') || '|' || btrim(e.l->>'designation')))::integer,
                                 2000) as t) k
    cross join lateral (select round(k.pu::numeric * (10000 - k.r) / 10000)::bigint as pu_l) pl
    cross join lateral (select round(pl.pu_l::numeric * (10000 - g) / 10000)::bigint as pu_f) pf;

  select coalesce(sum(x.net_c), 0), coalesce(sum(x.final_c), 0) into t_vins, t_fin
    from public.devis_lignes x where x.bureau = p_bureau and x.devis_id = d.devis_id;
  t_ht := t_fin + l_port;
  -- LOT 54 : une TVA PAR TAUX, sur la base de ce taux (le port rejoint la base de son taux).
  select coalesce(sum(round(b.base::numeric * b.t / 10000)), 0)::bigint into t_tva
    from (select z.t, sum(z.m) as base
            from (select x.tva_cb as t, x.final_c as m from public.devis_lignes x
                   where x.bureau = p_bureau and x.devis_id = d.devis_id
                  union all select r_port_cb, l_port where l_port > 0) z
           group by z.t) b;

  update public.devis x
     set port_c = l_port, total_vins_c = t_vins, remise_globale_c = t_vins - t_fin, total_ht_c = t_ht,
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
revoke all on function public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text, uuid, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- CONTROLES, a lancer apres (ils ne modifient rien)
-- ---------------------------------------------------------------------------
-- select (select count(*) from information_schema.columns where table_name = 'devis'
--           and column_name in ('regime_tva', 'client_tva', 'accises_incluses'))
--      + (select count(*) from information_schema.columns where table_name = 'devis_lignes'
--           and column_name = 'tva_cb') as colonnes,
--        (select pronargs from pg_proc where proname = 'devis_enregistrer') as arguments;
-- -> colonnes 4, arguments 9
