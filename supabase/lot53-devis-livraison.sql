-- ============================================================================
-- LOT 53, 01/10/2026 : LA LIVRAISON DU DEVIS. A COLLER DANS SUPABASE APRES LE LOT 52.
-- ============================================================================
-- Decisions de Ted (01/10/2026) : adresse de livraison, date souhaitee, frais de port,
-- retrait au domaine, nom du transporteur. Port au taux du devis (20 % ici).
--
--   1. TROIS FACONS DE LIVRER, `livraison_mode` :
--        'client'  : a l'adresse du client (c'est celle de facturation dans Vitisoft) ;
--        'adresse' : a une autre adresse, saisie dans `livraison` (jsonb) ;
--        'retrait' : le client vient chercher au domaine. Ni port, ni transporteur, ni adresse.
--      Un devis d'avant ce lot vaut 'client', sans port : c'etait le cas.
--   2. LE PORT ENTRE DANS LE TOTAL HT, et la TVA se calcule sur ce total :
--        total_ht = somme des final + port ; remise_globale = total_vins - somme des final
--      D'ou la contrainte `devis_totaux` reecrite (port_c vaut 0 pour tous les anciens devis,
--      l'egalite d'avant reste vraie pour eux).
--   3. CE QUE VITISOFT LIRA (colonnes 25 a 38 du fichier de commande, lot 49) : le bloc de
--      livraison, le transporteur, le commentaire de livraison (date souhaitee, retrait) et
--      montant_livraison. Vitisoft refuse une commande avec des frais de port si la
--      configuration n'a pas de « Produit pour transport » (erreur 7) : voir le CAHIER.
--   4. UN DEVIS ENVOYE GARDE SA LIVRAISON : les nouvelles colonnes ne sont pas dans la
--      liste `libres` du gel (lot 52). Rien a reecrire de ce cote.
--
-- REJOUABLE : chaque instruction se repasse sans erreur.
-- ============================================================================

-- 1. LES COLONNES
alter table public.devis add column if not exists livraison_mode text not null default 'client';
alter table public.devis add column if not exists livraison jsonb;
alter table public.devis add column if not exists livraison_souhaitee date;
alter table public.devis add column if not exists transporteur text;
alter table public.devis add column if not exists port_c bigint not null default 0;

alter table public.devis drop constraint if exists devis_livraison_mode;
alter table public.devis add constraint devis_livraison_mode
  check (livraison_mode in ('client', 'adresse', 'retrait'));
alter table public.devis drop constraint if exists devis_livraison_adresse;
alter table public.devis add constraint devis_livraison_adresse check (
  (livraison_mode = 'adresse') = (livraison is not null)
  and (livraison is null or (jsonb_typeof(livraison) = 'object'
       and char_length(btrim(coalesce(livraison->>'nom', ''))) between 1 and 80
       and char_length(btrim(coalesce(livraison->>'adresse1', ''))) between 1 and 120
       and char_length(btrim(coalesce(livraison->>'code_postal', ''))) between 1 and 10
       and char_length(btrim(coalesce(livraison->>'ville', ''))) between 1 and 60
       and char_length(coalesce(livraison->>'adresse2', '')) <= 120
       and char_length(coalesce(livraison->>'pays', '')) <= 60
       and char_length(coalesce(livraison->>'telephone', '')) <= 20)));
alter table public.devis drop constraint if exists devis_livraison_retrait;
alter table public.devis add constraint devis_livraison_retrait
  check (livraison_mode <> 'retrait' or (port_c = 0 and transporteur is null));
alter table public.devis drop constraint if exists devis_transporteur;
alter table public.devis add constraint devis_transporteur
  check (transporteur is null or char_length(btrim(transporteur)) between 1 and 60);
alter table public.devis drop constraint if exists devis_port;
alter table public.devis add constraint devis_port check (port_c between 0 and 9999999);
alter table public.devis drop constraint if exists devis_livraison_date;
alter table public.devis add constraint devis_livraison_date
  check (livraison_souhaitee is null or livraison_souhaitee >= date_devis);

-- 2. LES TOTAUX, AVEC LE PORT
alter table public.devis drop constraint if exists devis_totaux;
alter table public.devis add constraint devis_totaux
  check (remise_globale_c = total_vins_c + port_c - total_ht_c and total_ttc_c = total_ht_c + tva_c);

-- 3. ENREGISTRER : le corps du lot 51, plus la livraison (huitieme argument). L'ancienne
--    signature a sept arguments est retiree : le navigateur appelle par NOMS, et le
--    huitieme a une valeur par defaut. `p_livraison` NULL : un NOUVEAU devis part a l'adresse
--    du client, sans port ; un devis EXISTANT garde la livraison qu'il a.
drop function if exists public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text, uuid);
drop function if exists public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text, uuid, jsonb);
create function public.devis_enregistrer(
  p_bureau uuid, p_affaire uuid, p_devis uuid, p_lignes jsonb,
  p_remise_globale_cb integer default 0, p_notes text default null, p_version_de uuid default null,
  p_livraison jsonb default null)
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

  -- LOT 53 : LA LIVRAISON, lue et nettoyee AVANT toute ecriture. Un montant qui n'est pas
  -- un entier leve (22P02) : jamais d'arrondi silencieux.
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
    if l_date is not null and l_date < jour then
      raise exception 'livraison : date souhaitee avant le devis' using errcode = '23514';
    end if;
    y := extract(year from jour)::int;
    -- Le verrou de ligne tient jusqu'a la fin de la transaction : un echec plus bas
    -- defait l'increment, le numero n'est pas perdu.
    insert into public.devis_compteurs as c (bureau, annee, dernier) values (p_bureau, y, 1)
      on conflict (bureau, annee) do update set dernier = c.dernier + 1
      returning c.dernier into n;
    insert into public.devis (bureau, affaire_id, annee, rang, numero, date_devis, valable_jusqu,
      vendeur, paiement_mode, paiement_jours, validite_jours, acheteur, client_cle, num_client,
      piste_id, remise_globale_cb, tva_cb, notes, version_de,
      livraison_mode, livraison, livraison_souhaitee, transporteur)
    values (p_bureau, p_affaire, y, n,
      'D-' || y::text || '-' || lpad(n::text, greatest(4, length(n::text)), '0'),
      jour, jour + dom.validite_jours, vendeur_j, dom.paiement_mode, dom.paiement_jours,
      dom.validite_jours, acheteur_j, cle, v_num, af.piste_id, g, 2000, p_notes, p_version_de,
      l_mode, l_adr, l_date, l_transp)
    returning * into d;
  else
    select * into d from public.devis x
     where x.bureau = p_bureau and x.devis_id = p_devis and x.affaire_id = p_affaire
     for update;
    if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
    if d.statut <> 'enregistre' then
      raise exception 'devis fige : il ne se modifie plus' using errcode = '23514';
    end if;
    -- SANS p_livraison, UN DEVIS EXISTANT GARDE SA LIVRAISON : un onglet reste ouvert sur le
    -- code d'avant le lot (qui ignore ces colonnes) ne doit rien effacer en silence.
    if p_livraison is null then
      l_mode := d.livraison_mode; l_adr := d.livraison; l_date := d.livraison_souhaitee;
      l_transp := d.transporteur; l_port := d.port_c;
    end if;
    if l_date is not null and l_date < d.date_devis then
      raise exception 'livraison : date souhaitee avant le devis' using errcode = '23514';
    end if;
    delete from public.devis_lignes x where x.bureau = p_bureau and x.devis_id = d.devis_id;
    -- Les totaux ET le port passent a zero le temps de reposer les lignes (contraintes
    -- d'egalite) ; le port revient avec les totaux, plus bas.
    update public.devis x
       set vendeur = vendeur_j, acheteur = acheteur_j, client_cle = cle, num_client = v_num,
           piste_id = af.piste_id, paiement_mode = dom.paiement_mode,
           paiement_jours = dom.paiement_jours, validite_jours = dom.validite_jours,
           valable_jusqu = x.date_devis + dom.validite_jours,
           remise_globale_cb = g, notes = p_notes,
           livraison_mode = l_mode, livraison = l_adr, livraison_souhaitee = l_date,
           transporteur = l_transp, port_c = 0,
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

  select coalesce(sum(x.net_c), 0), coalesce(sum(x.final_c), 0) into t_vins, t_fin
    from public.devis_lignes x where x.bureau = p_bureau and x.devis_id = d.devis_id;
  -- LOT 53 : le port entre dans le total HT, et la TVA (une fois, sur le total) le couvre.
  t_ht := t_fin + l_port;
  t_tva := round(t_ht::numeric * 2000 / 10000)::bigint;

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
revoke all on function public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- CONTROLES, a lancer apres (ils ne modifient rien)
-- ---------------------------------------------------------------------------
-- 1) select column_name from information_schema.columns
--     where table_name = 'devis' and column_name in
--       ('livraison_mode', 'livraison', 'livraison_souhaitee', 'transporteur', 'port_c');
--    -> 5 lignes
-- 2) select pg_get_function_identity_arguments(p.oid) from pg_proc p where p.proname = 'devis_enregistrer';
--    -> 1 ligne, 8 arguments, le dernier « p_livraison jsonb »
