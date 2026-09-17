/* ============================================================================
   LOT 23, 17/09/2026 : LA TABLE ETROITE, ET LA VUE QUI CLASSE

   A COLLER DANS SUPABASE, editeur SQL, APRES le lot 22.

   POURQUOI CE LOT EXISTE, ET C'EST UNE CORRECTION D'ERREUR. Le lot 22 a pose
   des colonnes typees SUR `ventes`, et il n'a presque rien change :

       avant le socle, sur le JSON            6 949 ms
       apres le socle, colonnes typees        6 333 ms
       les MEMES lignes, sans `brut`            667 ms

   `brut` est reste dans la ligne. Chaque ligne pese encore un demi-kilo-octet
   de JSON, et Postgres doit le traverser pour atteindre les colonnes typees,
   rangees apres lui. Lire trois colonnes revient donc a lire les 264 Mo de la
   table.

   LA MESURE DU 344 ms ANNONCEE LA VEILLE ETAIT FAITE SUR UNE TABLE D'ESSAI QUI
   NE PORTAIT PAS `brut`. J'ai presente comme « le gain des colonnes typees » ce
   qui etait « le gain des colonnes typees DANS UNE LIGNE ETROITE ». La lecon
   est generale et vaut pour tout le depot : une mesure faite sur un decor n'est
   valable que pour ce decor, et il faut ecrire lequel a cote du chiffre.

   CE QUE FAIT CE LOT. Les colonnes typees demenagent dans leur propre table,
   `ventes_lignes`, qui ne porte QUE des colonnes etroites. Un declencheur sur
   `ventes` la tient a jour : rien ne change dans le navigateur, il n'y a rien a
   redeployer. Les colonnes generees du lot 22 sont retirees de `ventes`, qui
   retrouve sa taille.

   LES 43 COLONNES Y SONT, pas seulement celles dont on a besoin aujourd'hui.
   Deux raisons : le registre croise sur n'importe laquelle d'entre elles, y
   compris les quatorze colonnes perso ; et le canal se lit dans la colonne que
   le vigneron a DESIGNEE dans ses reglages, qui peut etre n'importe laquelle.
   Une colonne oubliee ici, c'est un axe qui disparait sans message.

   Au bout du chantier, quand plus rien ne lira le JSON, `brut` disparait et il
   ne reste que cette table.
   ============================================================================ */

/* -------------------------------------------------------------------------
   1. LA TABLE ETROITE
   ------------------------------------------------------------------------- */
create table if not exists public.ventes_lignes (
  bureau           uuid not null,
  empreinte        text not null,
  le_jour          date,
  num_facture      text,
  produit          text,
  cuvee            text,
  num_produit      text,
  famille          text,
  conditionnement  text,
  perso_produit1   text,
  perso_produit2   text,
  perso_produit3   text,
  perso_produit4   text,
  perso_produit5   text,
  appellation      text,
  couleur          text,
  millesime        text,
  pu_ht            numeric,
  total_ht         numeric,
  client_nom       text,
  num_client       text,
  client_cle       text,
  commercial       text,
  qte              numeric,
  code_tarif       text,
  perso_client1    text,
  perso_client2    text,
  perso_client3    text,
  perso_client4    text,
  perso_client5    text,
  perso_client6    text,
  perso_client7    text,
  perso_client8    text,
  perso_client9    text,
  pays             text,
  origine          text,
  ville            text,
  cp               text,
  vendeur          text,
  tri_perso1       text,
  type_offert      text,
  ordre_drm        text,
  depot            text,
  lieu_vente       text,
  emails           text,
  fixe             text,
  mobile           text,
  primary key (bureau, empreinte)
);

/* -------------------------------------------------------------------------
   2. LE DECLENCHEUR QUI LA TIENT A JOUR

   `security definer` parce qu'il ecrit dans une table dont personne d'autre
   n'a le droit d'ecrire : c'est le seul chemin, et c'est ce qui garantit que
   la table etroite ne peut pas diverger de `ventes`. Effacer puis inserer
   plutot qu'un upsert a quarante-quatre colonnes : plus court, donc relisible,
   et un import ne passe ici qu'une fois par ligne.
   ------------------------------------------------------------------------- */
create or replace function public.ventes_lignes_suivre()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.ventes_lignes
     where bureau = old.bureau and empreinte = old.empreinte;
    return old;
  end if;
  delete from public.ventes_lignes
   where bureau = new.bureau and empreinte = new.empreinte;
  insert into public.ventes_lignes (bureau, empreinte, le_jour, num_facture, produit, cuvee, num_produit, famille, conditionnement, perso_produit1, perso_produit2, perso_produit3, perso_produit4, perso_produit5, appellation, couleur, millesime, pu_ht, total_ht, client_nom, num_client, client_cle, commercial, qte, code_tarif, perso_client1, perso_client2, perso_client3, perso_client4, perso_client5, perso_client6, perso_client7, perso_client8, perso_client9, pays, origine, ville, cp, vendeur, tri_perso1, type_offert, ordre_drm, depot, lieu_vente, emails, fixe, mobile)
  select new.bureau, new.empreinte,
         public.bdv_jour(v.brut->>0),
         v.brut->>1,
         v.brut->>2,
         public.bdv_cuvee(v.brut->>2),
         v.brut->>3,
         v.brut->>4,
         v.brut->>5,
         v.brut->>6,
         v.brut->>7,
         v.brut->>8,
         v.brut->>9,
         v.brut->>10,
         v.brut->>11,
         v.brut->>12,
         v.brut->>13,
         public.bdv_nombre(v.brut->>14),
         public.bdv_nombre(v.brut->>15),
         v.brut->>16,
         v.brut->>17,
         coalesce(nullif(v.brut->>17,''), nullif(v.brut->>16,''), '(inconnu)'),
         v.brut->>18,
         public.bdv_nombre(v.brut->>19),
         v.brut->>20,
         v.brut->>21,
         v.brut->>22,
         v.brut->>23,
         v.brut->>24,
         v.brut->>25,
         v.brut->>26,
         v.brut->>27,
         v.brut->>28,
         v.brut->>29,
         v.brut->>30,
         v.brut->>31,
         v.brut->>32,
         v.brut->>33,
         v.brut->>34,
         v.brut->>35,
         v.brut->>36,
         v.brut->>37,
         v.brut->>38,
         v.brut->>39,
         v.brut->>40,
         v.brut->>41,
         v.brut->>42
    from (select new.brut as brut) v;
  return new;
end;
$$;

drop trigger if exists ventes_lignes_suivre on public.ventes;
create trigger ventes_lignes_suivre
  after insert or update or delete on public.ventes
  for each row execute function public.ventes_lignes_suivre();

/* -------------------------------------------------------------------------
   3. LE REMPLISSAGE DES LIGNES DEJA EN BASE
   ------------------------------------------------------------------------- */
insert into public.ventes_lignes (bureau, empreinte, le_jour, num_facture, produit, cuvee, num_produit, famille, conditionnement, perso_produit1, perso_produit2, perso_produit3, perso_produit4, perso_produit5, appellation, couleur, millesime, pu_ht, total_ht, client_nom, num_client, client_cle, commercial, qte, code_tarif, perso_client1, perso_client2, perso_client3, perso_client4, perso_client5, perso_client6, perso_client7, perso_client8, perso_client9, pays, origine, ville, cp, vendeur, tri_perso1, type_offert, ordre_drm, depot, lieu_vente, emails, fixe, mobile)
select bureau, empreinte,
       public.bdv_jour(brut->>0) as le_jour,
         brut->>1 as num_facture,
         brut->>2 as produit,
         public.bdv_cuvee(brut->>2) as cuvee,
         brut->>3 as num_produit,
         brut->>4 as famille,
         brut->>5 as conditionnement,
         brut->>6 as perso_produit1,
         brut->>7 as perso_produit2,
         brut->>8 as perso_produit3,
         brut->>9 as perso_produit4,
         brut->>10 as perso_produit5,
         brut->>11 as appellation,
         brut->>12 as couleur,
         brut->>13 as millesime,
         public.bdv_nombre(brut->>14) as pu_ht,
         public.bdv_nombre(brut->>15) as total_ht,
         brut->>16 as client_nom,
         brut->>17 as num_client,
         coalesce(nullif(brut->>17,''), nullif(brut->>16,''), '(inconnu)') as client_cle,
         brut->>18 as commercial,
         public.bdv_nombre(brut->>19) as qte,
         brut->>20 as code_tarif,
         brut->>21 as perso_client1,
         brut->>22 as perso_client2,
         brut->>23 as perso_client3,
         brut->>24 as perso_client4,
         brut->>25 as perso_client5,
         brut->>26 as perso_client6,
         brut->>27 as perso_client7,
         brut->>28 as perso_client8,
         brut->>29 as perso_client9,
         brut->>30 as pays,
         brut->>31 as origine,
         brut->>32 as ville,
         brut->>33 as cp,
         brut->>34 as vendeur,
         brut->>35 as tri_perso1,
         brut->>36 as type_offert,
         brut->>37 as ordre_drm,
         brut->>38 as depot,
         brut->>39 as lieu_vente,
         brut->>40 as emails,
         brut->>41 as fixe,
         brut->>42 as mobile
  from public.ventes
on conflict (bureau, empreinte) do nothing;

/* -------------------------------------------------------------------------
   4. LES DROITS. `revoke all` D'ABORD, ET SUR LES TROIS ROLES.

   Supabase accorde par defaut insert, update, delete et le reste a `anon` et
   `authenticated` sur toute table nouvellement creee du schema public. Un
   `grant select` seul serait REDONDANT et laisserait les six autres droits en
   place. Lecon du 09/09/2026, et sa symetrique du 13/09 : un revoke qui ne
   nomme pas les roles ne retire rien.

   PERSONNE N'ECRIT ICI, pas meme le maitre du bureau : la seule source est le
   declencheur, qui s'execute avec les droits de son proprietaire.
   ------------------------------------------------------------------------- */
revoke all on public.ventes_lignes from anon, authenticated, public;
grant select on public.ventes_lignes to authenticated;

alter table public.ventes_lignes enable row level security;

drop policy if exists "lire les lignes du bureau" on public.ventes_lignes;
create policy "lire les lignes du bureau" on public.ventes_lignes
  for select to authenticated
  using (
    bureau in (
      select m.bureau from public.membres m
       where m.personne = (select auth.uid())
    )
  );

/* -------------------------------------------------------------------------
   5. LES INDEX
   ------------------------------------------------------------------------- */
create index if not exists ventes_lignes_jour   on public.ventes_lignes (bureau, le_jour);
create index if not exists ventes_lignes_client on public.ventes_lignes (bureau, client_cle);
create index if not exists ventes_lignes_cuvee  on public.ventes_lignes (bureau, cuvee);

analyze public.ventes_lignes;

/* -------------------------------------------------------------------------
   6. `ventes` REND SES COLONNES GENEREES

   Elles ne servent plus a rien, et elles coutent 44 Mo plus le temps de les
   traverser a chaque lecture. Le JSON reste : c'est encore lui que le
   navigateur envoie a l'import, et c'est la source du declencheur.
   ------------------------------------------------------------------------- */
alter table public.ventes
  drop column if exists le_jour,         drop column if exists num_facture,
  drop column if exists produit,         drop column if exists cuvee,
  drop column if exists famille,         drop column if exists conditionnement,
  drop column if exists appellation,     drop column if exists couleur,
  drop column if exists millesime,       drop column if exists pu_ht,
  drop column if exists total_ht,        drop column if exists client_nom,
  drop column if exists client_cle,      drop column if exists commercial,
  drop column if exists qte,             drop column if exists code_tarif,
  drop column if exists pays,            drop column if exists origine,
  drop column if exists ville,           drop column if exists cp,
  drop column if exists vendeur,         drop column if exists tri_perso1,
  drop column if exists type_offert,     drop column if exists lieu_vente;

/* -------------------------------------------------------------------------
   6 bis. LIRE UNE COLONNE PAR SON NOM JAVASCRIPT

   Le vigneron DESIGNE dans ses reglages la colonne qui porte son canal de
   vente et celle qui porte sa typologie : `champCanal` vaut « codeTarif » chez
   l'un et « origine » chez l'autre, et ce peut etre n'importe laquelle des
   quarante-trois. Cette fonction fait le pont entre le nom que le navigateur
   connait et la colonne SQL qui le porte.

   Les noms sont ceux de `COLS` dans bdv-base.js, a la lettre. Un nom absent
   rend `null`, donc le canal tombera sur « Autre / non renseigné » : un trou
   visible, plutot qu'une erreur qui vide un ecran.
   ------------------------------------------------------------------------- */
create or replace function public.bdv_champ(l public.ventes_lignes, nom text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select case nom
    when 'date' then l.le_jour::text
    when 'numFacture' then l.num_facture
    when 'produit' then l.produit
    when 'numProduit' then l.num_produit
    when 'famille' then l.famille
    when 'conditionnement' then l.conditionnement
    when 'persoProduit1' then l.perso_produit1
    when 'persoProduit2' then l.perso_produit2
    when 'persoProduit3' then l.perso_produit3
    when 'persoProduit4' then l.perso_produit4
    when 'persoProduit5' then l.perso_produit5
    when 'appellation' then l.appellation
    when 'couleur' then l.couleur
    when 'millesime' then l.millesime
    when 'puHT' then l.pu_ht::text
    when 'totalHT' then l.total_ht::text
    when 'client' then l.client_nom
    when 'numClient' then l.num_client
    when 'commercial' then l.commercial
    when 'quantite' then l.qte::text
    when 'codeTarif' then l.code_tarif
    when 'persoClient1' then l.perso_client1
    when 'persoClient2' then l.perso_client2
    when 'persoClient3' then l.perso_client3
    when 'persoClient4' then l.perso_client4
    when 'persoClient5' then l.perso_client5
    when 'persoClient6' then l.perso_client6
    when 'persoClient7' then l.perso_client7
    when 'persoClient8' then l.perso_client8
    when 'persoClient9' then l.perso_client9
    when 'pays' then l.pays
    when 'origine' then l.origine
    when 'ville' then l.ville
    when 'cp' then l.cp
    when 'vendeur' then l.vendeur
    when 'triPerso1' then l.tri_perso1
    when 'typeOffert' then l.type_offert
    when 'ordreDRM' then l.ordre_drm
    when 'depot' then l.depot
    when 'lieuVente' then l.lieu_vente
    when 'emails' then l.emails
    when 'fixe' then l.fixe
    when 'mobile' then l.mobile
  end;
$$;

/* -------------------------------------------------------------------------
   7. LA VUE QUI CLASSE

   Elle porte ce que `classerLigne()` et `exDeriver()` calculent dans le
   navigateur. AUCUNE LOGIQUE N'EST REECRITE : le classement du vigneron est
   deja en base, dans `reglages.classement`, et ce ne sont que des tables de
   correspondance. Postgres y cherche, il ne decide rien.

   `security_invoker = true` : sans lui la vue s'executerait avec les droits de
   son proprietaire, et tout compte connecte lirait les ventes de tous les
   autres. Meme raison que pour `v_courrier`.

   LE MODE DEVINE N'EST PAS PORTE, ET C'EST VOLONTAIRE. Quand le vigneron n'a
   pas encore valide son classement, le navigateur devine (familles hors CA par
   ressemblance, canal par prefixes). Deviner ici aussi, c'est deux devinettes
   qui divergeront. La vue rend donc `classement_valide = false` et laisse
   `est_vente` a null : l'appelant saura qu'il ne peut pas se servir de ces
   colonnes-la, au lieu de lire un faux qui a l'air vrai.
   ------------------------------------------------------------------------- */
create or replace view public.v_ventes with (security_invoker = true) as
select l.*,
       coalesce((r.classement->>'valide')::boolean, false) as classement_valide,
       case when (r.classement->>'valide')::boolean then
         coalesce((r.classement->'horsCA'->>btrim(l.famille))::boolean, false)
       end as hors_ca,
       case when (r.classement->>'valide')::boolean then
         case when btrim(l.type_offert) <> ''
              then coalesce((r.classement->'gratuit'->>btrim(l.type_offert))::boolean, false)
              else false end
       end as est_offert,
       case when (r.classement->>'valide')::boolean then
         not coalesce((r.classement->'horsCA'->>btrim(l.famille))::boolean, false)
         and not (case when btrim(l.type_offert) <> ''
                       then coalesce((r.classement->'gratuit'->>btrim(l.type_offert))::boolean, false)
                       else false end)
       end as est_vente,
       case when (r.classement->>'valide')::boolean then
         coalesce(r.classement->'canaux'->>btrim(public.bdv_champ(l, r.classement->>'champCanal')),
                  'Autre / non renseigné')
       end as canal,
       case when (r.classement->>'valide')::boolean then
         coalesce(r.classement->'types'->>btrim(public.bdv_champ(l, r.classement->>'champType')),
                  'Non typé')
       end as typologie,
       /* L'EXERCICE COMPTABLE, porte depuis exDeriver(). `ex_pos` est le mois
          DANS l'exercice fois cent plus le jour : c'est le seul comparateur
          « a date egale » de l'outil, et il se compare comme un entier, pas
          comme un ecart en jours. Le reproduire autrement changerait les
          comparaisons d'une annee sur l'autre sans que rien ne le signale. */
       case when l.le_jour is null then null
            when coalesce(r.exercice_debut, 1) = 1 then extract(year from l.le_jour)::int
            when extract(month from l.le_jour)::int >= coalesce(r.exercice_debut, 1)
                 then extract(year from l.le_jour)::int
            else extract(year from l.le_jour)::int - 1 end as ex_annee,
       case when l.le_jour is null then null
            else ((extract(month from l.le_jour)::int - coalesce(r.exercice_debut, 1) + 12) % 12) + 1
       end as ex_mois,
       case when l.le_jour is null then null
            else (((extract(month from l.le_jour)::int - coalesce(r.exercice_debut, 1) + 12) % 12) + 1) * 100
                 + extract(day from l.le_jour)::int
       end as ex_pos
  from public.ventes_lignes l
  left join public.reglages r on r.bureau = l.bureau;

revoke all on public.v_ventes from anon, authenticated, public;
grant select on public.v_ventes to authenticated;
