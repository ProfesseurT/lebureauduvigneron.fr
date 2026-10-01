-- ============================================================================
-- LOT 47, 30/09/2026 : LE DEVIS. A COLLER DANS SUPABASE APRES LES LOTS 38 ET 39.
-- ============================================================================
-- Specification : `Claude outputs/lot47-spec.md` (sections C et D). Ce que ce lot porte :
--
--   1. UN DEVIS SE FAIT DEPUIS UNE AFFAIRE (client Vitisoft ou nouveau client), plusieurs
--      par affaire. Il n'est JAMAIS supprime : « Abandonner » le garde, numero compris.
--   2. LE NUMERO D-AAAA-NNNN EST DONNE A L'ENREGISTREMENT, PAR BUREAU, SANS TROU, et
--      repart a 1 chaque annee (annee lue a l'heure de Paris). Le compteur est une ligne
--      verrouillee jusqu'a la fin de la transaction : si l'enregistrement echoue apres
--      lui, la transaction est defaite ET le numero rendu.
--   3. LE CALCUL EST CELUI DU COMMERCIAL (section C), en centimes entiers, quantites
--      entieres, remises en centiemes de pour cent :
--        pu_l  = arrondi(pu   * (10000 - remise_ligne)   / 10000)
--        pu_f  = arrondi(pu_l * (10000 - remise_globale) / 10000)   <- prix unitaire signe
--        net   = qte * pu_l ; final = qte * pu_f
--        total_vins = somme des net ; total_ht = somme des final
--        remise_globale_c = total_vins - total_ht
--        tva = arrondi(total_ht * 2000 / 10000) sur le TOTAL ; ttc = total_ht + tva
--      Arrondi au plus proche, demi vers le haut (`round(numeric)` sur des positifs).
--      La meme regle vit dans src/js/bdv-devis-calcul.js ; banc-lot47-devis.sql compare.
--   4. L'ECRITURE PASSE PAR DEUX FONCTIONS, ET PAR ELLES SEULES : `devis_enregistrer()` et
--      `devis_abandonner()`. `authenticated` n'a que SELECT sur les tables : un PATCH
--      direct pourrait reecrire un total ou un numero. Tout le bureau ecrit quand meme,
--      par ces fonctions, qui verifient `est_membre()` en premiere ligne.
--   5. VENDEUR ET ACHETEUR SONT COPIES DANS LE DEVIS (jsonb), A CHAQUE ENREGISTREMENT tant
--      qu'il n'est pas envoye : la fiche du domaine ou du client peut changer ensuite,
--      le devis envoye ne bouge plus.
--   6. PREPARE POUR LE LOT 48 : statuts `envoye`, `signe`, `refuse`, colonnes `empreinte`,
--      `fige_le`, `signe_le`, `version_de`. Un devis qui n'est plus `enregistre` ne se
--      modifie plus, lignes comprises (declencheurs).
--
-- « VIDER LA BASE » N'Y TOUCHE PAS : `vider_la_base_du_bureau` (lot 30) nomme ses tables
-- une par une, et aucune n'est ici.
--
-- REJOUABLE : chaque instruction se repasse sans erreur.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. LE COMPTEUR, par bureau et par annee. Aucune politique, aucun droit :
--    seule devis_enregistrer() l'ecrit.
-- ---------------------------------------------------------------------------
create table if not exists public.devis_compteurs (
  bureau  uuid not null references public.bureaux(bureau) on delete cascade,
  annee   integer not null check (annee between 2020 and 2200),
  dernier integer not null default 0 check (dernier >= 0),
  primary key (bureau, annee)
);
alter table public.devis_compteurs enable row level security;
revoke all on public.devis_compteurs from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. LE DEVIS
-- ---------------------------------------------------------------------------
-- `expire` n'est PAS un statut : il se calcule sur `valable_jusqu`.
create table if not exists public.devis (
  bureau            uuid not null references public.bureaux(bureau) on delete cascade,
  devis_id          uuid not null default gen_random_uuid(),
  affaire_id        uuid not null,
  annee             integer not null,
  rang              integer not null check (rang >= 1),
  numero            text not null,
  statut            text not null default 'enregistre'
                    check (statut in ('enregistre', 'abandonne', 'envoye', 'signe', 'refuse')),
  version_de        uuid,
  date_devis        date not null,
  valable_jusqu     date not null,
  vendeur           jsonb not null check (jsonb_typeof(vendeur) = 'object'),
  paiement_mode     text not null check (paiement_mode in ('reception', 'nets', 'fdm')),
  paiement_jours    integer check (paiement_jours is null or paiement_jours between 1 and 30),
  validite_jours    integer not null check (validite_jours between 1 and 365),
  acheteur          jsonb not null check (jsonb_typeof(acheteur) = 'object'),
  client_cle        text,
  num_client        text,
  piste_id          uuid,
  remise_globale_cb integer not null default 0 check (remise_globale_cb between 0 and 10000),
  tva_cb            integer not null default 2000 check (tva_cb in (2000)),
  total_vins_c      bigint not null default 0 check (total_vins_c >= 0),
  remise_globale_c  bigint not null default 0 check (remise_globale_c >= 0),
  total_ht_c        bigint not null default 0 check (total_ht_c >= 0),
  tva_c             bigint not null default 0 check (tva_c >= 0),
  total_ttc_c       bigint not null default 0 check (total_ttc_c >= 0),
  notes             text check (notes is null or char_length(notes) <= 2000),
  empreinte         text check (empreinte is null or empreinte ~ '^[0-9a-f]{64}$'),
  fige_le           timestamptz,
  signe_le          timestamptz,
  abandonne_le      timestamptz,
  cree_par          uuid default auth.uid() references auth.users(id) on delete set null,
  maj_par           uuid default auth.uid() references auth.users(id) on delete set null,
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now(),
  primary key (bureau, devis_id),
  constraint devis_numero unique (bureau, numero),
  constraint devis_rang unique (bureau, annee, rang),
  constraint devis_affaire_fk foreign key (bureau, affaire_id)
    references public.affaires(bureau, affaire_id) on delete restrict,
  constraint devis_version_fk foreign key (bureau, version_de)
    references public.devis(bureau, devis_id) on delete restrict,
  -- `greatest` : un `lpad(.., 4)` TRONQUE le 10 000e devis en « 1000 ».
  constraint devis_numero_forme check (numero = 'D-' || annee::text || '-'
    || lpad(rang::text, greatest(4, length(rang::text)), '0')),
  constraint devis_validite check (valable_jusqu = date_devis + validite_jours),
  constraint devis_totaux check (remise_globale_c = total_vins_c - total_ht_c
                                 and total_ttc_c = total_ht_c + tva_c),
  constraint devis_tva check (tva_c = round(total_ht_c::numeric * tva_cb / 10000)),
  constraint devis_paiement check (
    (paiement_mode = 'reception' and paiement_jours is null)
    or (paiement_mode in ('nets', 'fdm') and paiement_jours is not null)),
  constraint devis_signe_prouve check (statut <> 'signe'
    or (empreinte is not null and fige_le is not null and signe_le is not null)),
  constraint devis_abandon_date check ((statut = 'abandonne') = (abandonne_le is not null))
);
create index if not exists devis_affaire on public.devis (bureau, affaire_id);


-- ---------------------------------------------------------------------------
-- 3. LES LIGNES
-- ---------------------------------------------------------------------------
-- `pu_f_c` est le prix unitaire SIGNE (colonne 23 de l'import Vitisoft), `final_c` le
-- total de la ligne (colonne 24) : qte * pu_f_c, exact par construction.
create table if not exists public.devis_lignes (
  bureau          uuid not null,
  devis_id        uuid not null,
  rang            smallint not null check (rang between 1 and 200),
  num_produit     text check (num_produit is null or char_length(num_produit) <= 40),
  designation     text not null check (char_length(btrim(designation)) between 1 and 200),
  conditionnement text check (conditionnement is null or char_length(conditionnement) <= 60),
  millesime       text check (millesime is null or char_length(millesime) <= 12),
  quantite        integer not null check (quantite > 0 and quantite <= 99999),
  pu_ht_c         bigint not null check (pu_ht_c between 0 and 9999999),
  remise_cb       integer not null default 0 check (remise_cb between 0 and 10000),
  source_prix     text not null default 'saisi' check (source_prix in ('client', 'bureau', 'saisi')),
  pu_l_c          bigint not null check (pu_l_c >= 0),
  pu_f_c          bigint not null check (pu_f_c >= 0),
  net_c           bigint not null check (net_c >= 0),
  final_c         bigint not null check (final_c >= 0),
  primary key (bureau, devis_id, rang),
  constraint devis_lignes_devis_fk foreign key (bureau, devis_id)
    references public.devis(bureau, devis_id) on delete cascade,
  constraint devis_lignes_pu_l check (pu_l_c = round(pu_ht_c::numeric * (10000 - remise_cb) / 10000)),
  constraint devis_lignes_ordre check (pu_f_c <= pu_l_c and pu_l_c <= pu_ht_c),
  constraint devis_lignes_montants check (net_c = quantite::bigint * pu_l_c
                                          and final_c = quantite::bigint * pu_f_c)
);


-- ---------------------------------------------------------------------------
-- 4. LE JOUR DU DEVIS, A L'HEURE DE PARIS
-- ---------------------------------------------------------------------------
-- La base tourne en UTC : le 1er janvier a 0 h 30 a Paris, il est encore le 31/12 a
-- Londres, et le devis prendrait le compteur de l'annee d'avant. Une fonction a part
-- pour que le banc eprouve la bascule sur des instants donnes.
create or replace function public.devis_jour(t timestamptz)
returns date
language sql
stable
set search_path = ''
as $$ select (t at time zone 'Europe/Paris')::date $$;
-- Lue par devis_propositions(), qui s'execute avec les droits de l'appelant.
revoke all on function public.devis_jour(timestamptz) from public, anon, authenticated;
grant execute on function public.devis_jour(timestamptz) to authenticated;


-- ---------------------------------------------------------------------------
-- 5. LES DECLENCHEURS : la base signe ; numero et date ne bougent jamais ; un devis
--    qui n'est plus `enregistre` est fige, ses lignes aussi.
-- ---------------------------------------------------------------------------
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
    -- Envoye, signe, refuse (lot 48) : seuls le statut et sa date bougent.
    if old.statut <> 'enregistre'
       and (to_jsonb(new) - array['statut', 'signe_le', 'maj_par', 'maj_le'])
           is distinct from (to_jsonb(old) - array['statut', 'signe_le', 'maj_par', 'maj_le']) then
      raise exception 'devis fige : fais-en une nouvelle version' using errcode = '23514';
    end if;
  end if;
  if auth.uid() is not null then new.maj_par := auth.uid();
  elsif tg_op = 'UPDATE' then new.maj_par := old.maj_par; end if;
  new.maj_le := now();
  return new;
end
$$;

create or replace function public.devis_lignes_figer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare st text; b uuid; d uuid;
begin
  if tg_op = 'DELETE' then b := old.bureau; d := old.devis_id;
  else b := new.bureau; d := new.devis_id; end if;
  select x.statut into st from public.devis x where x.bureau = b and x.devis_id = d;
  -- Parent introuvable : suppression du bureau en cascade, on laisse passer.
  if found and st <> 'enregistre' then
    raise exception 'devis fige : ses lignes ne changent plus' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

revoke all on function public.devis_signer()      from public, anon, authenticated;
revoke all on function public.devis_lignes_figer() from public, anon, authenticated;

drop trigger if exists devis_signer on public.devis;
create trigger devis_signer
  before insert or update on public.devis
  for each row execute function public.devis_signer();

drop trigger if exists devis_lignes_figer on public.devis_lignes;
create trigger devis_lignes_figer
  before insert or update or delete on public.devis_lignes
  for each row execute function public.devis_lignes_figer();


-- ---------------------------------------------------------------------------
-- 6. LES POLITIQUES : tout le bureau, et rien que lui. Forme « IN » (lot 38).
--    Les droits de table restent en LECTURE : l'ecriture passe par les fonctions.
--    Les politiques d'ecriture sont posees quand meme, pour qu'ouvrir un jour une
--    ecriture directe ne soit pas ouvrir tous les bureaux.
-- ---------------------------------------------------------------------------
alter table public.devis        enable row level security;
alter table public.devis_lignes enable row level security;

drop policy if exists devis_lire      on public.devis;
drop policy if exists devis_creer     on public.devis;
drop policy if exists devis_modifier  on public.devis;
drop policy if exists devis_supprimer on public.devis;
create policy devis_lire on public.devis for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy devis_creer on public.devis for insert to authenticated with check
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy devis_modifier on public.devis for update to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) ) with check
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy devis_supprimer on public.devis for delete to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );

drop policy if exists devis_lignes_lire      on public.devis_lignes;
drop policy if exists devis_lignes_creer     on public.devis_lignes;
drop policy if exists devis_lignes_modifier  on public.devis_lignes;
drop policy if exists devis_lignes_supprimer on public.devis_lignes;
create policy devis_lignes_lire on public.devis_lignes for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy devis_lignes_creer on public.devis_lignes for insert to authenticated with check
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy devis_lignes_modifier on public.devis_lignes for update to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) ) with check
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy devis_lignes_supprimer on public.devis_lignes for delete to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );

-- Supabase accorde tout par defaut : on retire, puis on donne (regle du 09/09/2026).
revoke all on public.devis, public.devis_lignes from public, anon, authenticated;
grant select on public.devis, public.devis_lignes to authenticated;


-- ---------------------------------------------------------------------------
-- 7. LES VINS PROPOSES
-- ---------------------------------------------------------------------------
-- `security invoker` : la RLS de v_ventes et d'affaires s'applique, un autre bureau
-- ne voit rien. Hors vente : prix <= 0 (offerts), quantite <= 0 (avoirs), et les
-- lignes que le classement valide dit hors vente. Un vin = num_produit (sinon le
-- produit) + conditionnement + millesime.
--   Client (affaire sur un client, ou piste devenue cliente) : SON dernier prix, sa
--   derniere quantite et la date, du plus recent au plus ancien.
--   Sinon (nouveau client, client sans aucune vente, ou `p_tout_le_domaine`) : les
--   ventes du bureau sur 12 mois, le prix le plus courant (a egalite, le plus haut),
--   par nombre de ventes. `derniere_qte` y est vide.
-- `source` dit laquelle des deux listes est rendue : 'client' ou 'bureau'.
drop function if exists public.devis_propositions(uuid, uuid);
drop function if exists public.devis_propositions(uuid, uuid, boolean);
create function public.devis_propositions(p_bureau uuid, p_affaire uuid, p_tout_le_domaine boolean default false)
returns table (num_produit text, designation text, conditionnement text, millesime text,
               pu_ht_c bigint, derniere_qte integer, derniere_vente date, nb_ventes integer, source text)
language sql
stable
security invoker
set search_path = ''
as $$
  with a as (
    select coalesce(af.client_id, pi.client_id) as cle
      from public.affaires af
      left join public.pistes pi on pi.bureau = af.bureau and pi.piste_id = af.piste_id
     where af.bureau = p_bureau and af.affaire_id = p_affaire
  ),
  v as (
    select coalesce(nullif(btrim(l.num_produit), ''), btrim(l.produit)) as cle_produit,
           nullif(btrim(l.num_produit), '') as num_produit, btrim(l.produit) as produit,
           nullif(btrim(l.conditionnement), '') as conditionnement,
           nullif(btrim(l.millesime), '') as millesime,
           round(l.pu_ht * 100)::bigint as pu_c, l.qte, l.le_jour, l.client_cle
      from public.v_ventes l
     where l.bureau = p_bureau and l.pu_ht > 0 and l.qte > 0 and l.le_jour is not null
       and coalesce(l.est_vente, true)
       and nullif(btrim(l.produit), '') is not null
  ),
  du_client as (
    select distinct on (v.cle_produit, v.conditionnement, v.millesime)
           v.num_produit, v.produit, v.conditionnement, v.millesime, v.pu_c,
           greatest(1, round(v.qte))::int as qte, v.le_jour,
           (count(*) over (partition by v.cle_produit, v.conditionnement, v.millesime))::int as n
      from v join a on a.cle is not null and v.client_cle = a.cle
     where not p_tout_le_domaine
     order by v.cle_produit, v.conditionnement, v.millesime, v.le_jour desc, v.pu_c desc
  ),
  du_bureau as (
    select max(v.num_produit) as num_produit, max(v.produit) as produit, v.conditionnement, v.millesime,
           (mode() within group (order by v.pu_c desc)) as pu_c,
           max(v.le_jour) as le_jour, count(*)::int as n
      from v
     where exists (select 1 from a) and not exists (select 1 from du_client)
       and v.le_jour >= public.devis_jour(now()) - 365
     group by v.cle_produit, v.conditionnement, v.millesime
  )
  select z.num_produit, z.produit, z.conditionnement, z.millesime, z.pu_c, z.qte, z.le_jour, z.n, z.source
    from (
      select c.num_produit, c.produit, c.conditionnement, c.millesime, c.pu_c, c.qte, c.le_jour, c.n,
             'client'::text as source
        from du_client c
      union all
      select b.num_produit, b.produit, b.conditionnement, b.millesime, b.pu_c, null::int, b.le_jour, b.n,
             'bureau'::text
        from du_bureau b
    ) z
   order by case when z.source = 'client' then z.le_jour end desc nulls last,
            z.n desc, z.produit, z.conditionnement nulls first, z.millesime nulls first
   limit 300
$$;
revoke all on function public.devis_propositions(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.devis_propositions(uuid, uuid, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- 8. ENREGISTRER : nouveau devis (p_devis vide) ou devis `enregistre` modifie.
-- ---------------------------------------------------------------------------
-- p_lignes : [{num_produit, designation, conditionnement, millesime, quantite (entier),
--              pu_ht_c (entier), remise_cb (entier, 0 a 10000), source_prix}]
-- Rend la ligne `devis` complete (numero, totaux, instantanes).
-- Refus : 42501 hors du bureau ; P0002 affaire ou devis introuvable ; 23514 fiche du
-- domaine incomplete, affaire close, 0 ou plus de 200 lignes, devis non `enregistre` ;
-- 22P02 une quantite ou un prix qui n'est pas un entier.
drop function if exists public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text);
create function public.devis_enregistrer(
  p_bureau uuid, p_affaire uuid, p_devis uuid, p_lignes jsonb,
  p_remise_globale_cb integer default 0, p_notes text default null)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare
  af public.affaires; pi public.pistes; dom public.domaine; d public.devis;
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
      piste_id, remise_globale_cb, tva_cb, notes)
    values (p_bureau, p_affaire, y, n,
      'D-' || y::text || '-' || lpad(n::text, greatest(4, length(n::text)), '0'),
      jour, jour + dom.validite_jours, vendeur_j, dom.paiement_mode, dom.paiement_jours,
      dom.validite_jours, acheteur_j, cle, v_num, af.piste_id, g, 2000, p_notes)
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
  return d;
end
$$;
revoke all on function public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.devis_enregistrer(uuid, uuid, uuid, jsonb, integer, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 9. ABANDONNER : le devis reste, numero compris, et ne se modifie plus.
-- ---------------------------------------------------------------------------
-- Deja abandonne : rendu tel quel (un double appui ne doit pas lever). Envoye,
-- signe ou refuse : refuse (lot 48).
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
  if d.statut <> 'enregistre' then
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

-- PostgREST relit ses fonctions.
notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- CONTROLES, a lancer apres (ils ne modifient rien)
-- ---------------------------------------------------------------------------
-- 1) select tablename, count(*) from pg_policies
--     where tablename in ('devis', 'devis_lignes', 'devis_compteurs') group by 1 order by 1;
--    -> devis 4, devis_lignes 4 (devis_compteurs : aucune ligne)
-- 2) select table_name, grantee, privilege_type from information_schema.role_table_grants
--     where table_name in ('devis', 'devis_lignes', 'devis_compteurs')
--       and grantee in ('anon', 'authenticated') order by 1, 2;
--    -> 2 lignes : devis / authenticated / SELECT et devis_lignes / authenticated / SELECT
-- 3) select p.proname, r.rolname from pg_proc p
--      join lateral aclexplode(p.proacl) a on true join pg_roles r on r.oid = a.grantee
--     where p.proname like 'devis%' and a.privilege_type = 'EXECUTE' order by 1, 2;
--    -> devis_abandonner, devis_enregistrer, devis_jour, devis_propositions : authenticated
--       (et le proprietaire) seulement ; jamais anon ; devis_signer et devis_lignes_figer : personne
-- 4) select public.devis_jour('2026-12-31 22:30:00+00'), public.devis_jour('2026-12-31 23:30:00+00');
--    -> 2026-12-31 et 2027-01-01
