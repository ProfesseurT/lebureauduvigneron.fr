-- ============================================================================
-- LOT 50 : LE DEVIS ENVOYE, SA RELANCE, ET LE MONTANT DE L'AFFAIRE, 01/10/2026
-- ============================================================================
-- A coller dans Supabase (SQL Editor) APRES lot49-commande.sql. Rejouable.
--
-- Ce que Ted a valide le 01/10/2026 (apres l'avis du conseil sur les lots 34 a 49) :
--   1. « JE L'AI ENVOYE » : le vigneron envoie le PDF lui-meme, par sa messagerie.
--      AUCUN MAIL NE PART DU BUREAU : la regle du SEUIL ne s'applique pas. Le devis
--      passe `envoye`, avec la date de l'envoi (`envoye_le`, un JOUR, celui que le
--      vigneron dit, par defaut aujourd'hui) et son auteur.
--   2. LA RELANCE : le meme geste peut poser le rappel de l'affaire (« Relancer le
--      devis D-... ») et la passer a une etape. Le rappel remonte deja seul dans Ma
--      journee, le calendrier et le courrier du matin : rien de neuf a brancher.
--   3. LE MONTANT DE L'AFFAIRE vient du devis ENVOYE ou ACCEPTE (regle du 28/09/2026 :
--      « le montant n'est un chiffre que s'il vient d'un document envoye »). Il se
--      LIT dans `devis`, aucune colonne n'est ajoutee a `affaires` : deux endroits
--      qui portent le meme chiffre divergeraient.
--   4. UN DEVIS ENVOYE EST FIGE (le client l'a entre les mains). D'ou « REFAIRE CE
--      DEVIS » : `devis_enregistrer(..., p_version_de)` cree un nouveau numero qui
--      porte `version_de`, et l'ancien passe abandonne dans la meme transaction.
--   5. Un devis envoye s'accepte et s'abandonne, comme un devis enregistre.
--
-- `expire` n'est toujours PAS un statut : il se lit sur `valable_jusqu`.
-- ============================================================================

-- 1. LES COLONNES
alter table public.devis add column if not exists envoye_le  date;
alter table public.devis add column if not exists envoye_par uuid references auth.users(id) on delete set null;
alter table public.devis drop constraint if exists devis_envoye_date;
alter table public.devis add constraint devis_envoye_date
  check ((statut <> 'envoye' or envoye_le is not null)
         and (envoye_le is null or envoye_le >= date_devis));

-- 2. LE GEL, REECRIT. Un devis qui n'est plus `enregistre` ne change plus, SAUF les
--    colonnes de ses transitions : envoye -> accepte (date, auteur, code tarif),
--    envoye -> abandonne (date). Un devis accepte ne change plus du tout.
create or replace function public.devis_signer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
    if old.statut = 'accepte' then
      raise exception 'devis accepte : il ne se modifie plus' using errcode = '23514';
    end if;
    if old.statut <> 'enregistre'
       and (to_jsonb(new) - array['statut', 'signe_le', 'accepte_le', 'accepte_par', 'code_tarif',
                                  'abandonne_le', 'maj_par', 'maj_le'])
           is distinct from (to_jsonb(old) - array['statut', 'signe_le', 'accepte_le', 'accepte_par', 'code_tarif',
                                  'abandonne_le', 'maj_par', 'maj_le']) then
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

-- 3. ENVOYER
-- Refus : 42501 hors du bureau ; P0002 devis introuvable ; 23514 devis qui n'est pas
-- `enregistre`, affaire close, date d'envoi dans le futur ou avant le devis, rappel
-- avant l'envoi, etape hors du type. Deja envoye : rendu tel quel (double appui).
drop function if exists public.devis_envoyer(uuid, uuid, date, date, text, uuid);
create function public.devis_envoyer(
  p_bureau uuid, p_devis uuid, p_jour date default null,
  p_rappel date default null, p_rappel_titre text default null, p_etape uuid default null)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare d public.devis; af public.affaires; jour date; auj date;
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  select * into d from public.devis x
   where x.bureau = p_bureau and x.devis_id = p_devis for update;
  if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
  if d.statut = 'envoye' then return d; end if;
  if d.statut <> 'enregistre' then
    raise exception 'devis non envoyable : il n''est plus en cours' using errcode = '23514';
  end if;
  select * into af from public.affaires x
   where x.bureau = p_bureau and x.affaire_id = d.affaire_id for update;
  if af.issue <> 'en_cours' then raise exception 'affaire close' using errcode = '23514'; end if;

  auj := public.devis_jour(now());
  jour := coalesce(p_jour, auj);
  if jour > auj then raise exception 'date d''envoi dans le futur' using errcode = '23514'; end if;
  if jour < d.date_devis then raise exception 'date d''envoi avant le devis' using errcode = '23514'; end if;
  if p_rappel is not null and p_rappel < jour then
    raise exception 'rappel avant l''envoi' using errcode = '23514';
  end if;

  update public.devis x set statut = 'envoye', envoye_le = jour, envoye_par = auth.uid()
   where x.bureau = p_bureau and x.devis_id = d.devis_id
  returning * into d;

  -- L'etape est verifiee par affaires_signer (« etape hors du type de l'affaire »).
  if p_rappel is not null or p_etape is not null then
    update public.affaires x
       set rappel = coalesce(p_rappel, x.rappel),
           rappel_titre = case when p_rappel is null then x.rappel_titre
             else left(coalesce(nullif(btrim(p_rappel_titre), ''), 'Relancer le devis ' || d.numero), 120) end,
           etape_id = coalesce(p_etape, x.etape_id)
     where x.bureau = p_bureau and x.affaire_id = af.affaire_id;
  end if;
  return d;
end
$$;
revoke all on function public.devis_envoyer(uuid, uuid, date, date, text, uuid) from public, anon, authenticated;
grant execute on function public.devis_envoyer(uuid, uuid, date, date, text, uuid) to authenticated;

-- 4. ACCEPTER : un devis envoye s'accepte aussi. Le reste est celui du lot 49.
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
  if d.statut not in ('enregistre', 'envoye') then
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

-- 5. ABANDONNER : un devis envoye s'abandonne aussi (le client n'a jamais repondu).
drop function if exists public.devis_abandonner(uuid, uuid);
create function public.devis_abandonner(p_bureau uuid, p_devis uuid)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare d public.devis;
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  select * into d from public.devis x
   where x.bureau = p_bureau and x.devis_id = p_devis for update;
  if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
  if d.statut = 'abandonne' then return d; end if;
  if d.statut not in ('enregistre', 'envoye') then
    raise exception 'devis fige : il ne s''abandonne plus' using errcode = '23514';
  end if;
  update public.devis x set statut = 'abandonne', abandonne_le = now()
   where x.bureau = p_bureau and x.devis_id = p_devis
  returning * into d;
  return d;
end
$$;
revoke all on function public.devis_abandonner(uuid, uuid) from public, anon, authenticated;
grant execute on function public.devis_abandonner(uuid, uuid) to authenticated;

-- 6. ENREGISTRER, AVEC « REFAIRE CE DEVIS » (p_version_de). Le corps est celui du lot 47,
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
    if ancien.statut not in ('enregistre', 'envoye') then
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
    'telephone', dom.telephone);

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

  if p_version_de is not null then
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
--     where table_name = 'devis' and column_name in ('envoye_le', 'envoye_par');
--    -> 2 lignes
-- 2) select p.proname, pg_get_function_identity_arguments(p.oid) from pg_proc p
--     where p.proname in ('devis_envoyer', 'devis_enregistrer') order by 1;
--    -> devis_enregistrer avec 7 arguments (UNE seule ligne), devis_envoyer avec 6
-- 3) select has_function_privilege('anon', 'public.devis_envoyer(uuid, uuid, date, date, text, uuid)', 'execute');
--    -> false
