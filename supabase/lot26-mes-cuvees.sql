/* ===========================================================================
   LOT 26 : « MES CUVEES » CALCULE PAR LE SERVEUR, 18/09/2026

   C'etait le dernier gros chargement du bureau : ouvrir cet ecran derivait les
   171 569 lignes pour en tirer UNE QUARANTAINE de cuvees. Un rapport de quatre
   mille contre un.

   VERIFIE COMME LES LOTS 25 ET 24 : la base d'essai des cas limites, le vrai
   moteur qui repond dessus, et une comparaison champ par champ.
   `npm run controle:cuvees` rend la requete. Dix-sept champs par cuvee,
   cinq cuvees, ZERO ecart.

   ---------------------------------------------------------------------------
   TROIS CONVENTIONS, ET AUCUNE N'EST CELLE QU'ON CROIT

   1. LE QUANTILE DE PRIX S'ECRIT `px[floor(p * n)]`, indice a partir de zero.
      Ni `percentile_cont`, ni `percentile_disc` — ce dernier prend un cran plus
      bas. Meme convention que les quartiles du premier achat, meme piege.

   2. LES REPERES DU DOMAINE NE PASSENT PAS PAR `median()`. `repRachat` et
      `repClients` s'ecrivent `a[a.length >> 1]`, qui rend l'element du HAUT sur
      un nombre pair, la ou `median()` fait la moyenne des deux. DEUX MEDIANES
      DIFFERENTES DANS LE MEME FICHIER, a quelques centaines de lignes d'ecart.

   3. LES PRIX NE SE COMPARENT QU'A CONDITIONNEMENT EGAL. Une cuvee vendue en
      75 cl et en magnum a deux prix qui n'ont rien a voir ; seul le
      conditionnement DOMINANT, en quantite, porte la fourchette.

   ---------------------------------------------------------------------------
   DEUX DEFAUTS TROUVES EN COMPARANT, ET AUCUN N'ETAIT DANS LE SQL

   1. DANS LE NAVIGATEUR. `agentProduits()` range une ligne sans nom de produit
      sous « (sans nom) », puis, ONZE LIGNES PLUS BAS, cherche cette meme cuvee
      sous la chaine vide pour calculer sa concentration. Resultat : la cuvee
      « (sans nom) » affichait 0 % de dependance et aucun plus gros acheteur,
      alors qu'elle tient a un seul client a 100 %. Deux replis differents pour
      la meme chose, dans la meme fonction. Le serveur rendait 100 %, et c'est
      lui qui avait raison. Corrige cote navigateur.

   2. DANS LA BASE D'ESSAI ELLE-MEME, deux fois. Elle ecrivait
      `produit: opts.produit || 'Cuvée Témoin'`, donc la ligne posee expres pour
      tester le produit SANS NOM recevait un nom : la fixture croyait tester ce
      cas et ne le testait pas. Et elle ne transmettait pas le conditionnement,
      donc les trois ventes en magnum arrivaient en 75 cl et polluaient la
      fourchette de prix qu'elles devaient justement en exclure.

      **Une base d'essai qui n'attrape pas ses propres defauts n'attrapera pas
      ceux du portage.** C'est la troisieme fois que celle-ci se reprend.

   ---------------------------------------------------------------------------
   LE TEMPS, ET CE QUI LE REGLE VRAIMENT

   Cette fonction met 5 735 ms sur la base de Ted. C'est tolerable une fois,
   intolerable a chaque clic : c'est le lot 27 qui la range en cache, et la
   lecture tombe alors a 0,77 ms. Porter un ecran le rend JUSTE ; c'est le cache
   qui le rend RAPIDE. Les deux sont necessaires, aucun ne suffit.
   =========================================================================== */

create or replace function public.cuvees_resume(b uuid)
returns jsonb language sql stable security invoker parallel safe set search_path = ''
as $$
with v as materialized (
  /* La cuvee, c'est le produit SANS son millesime : « Le Rose 2024 » et « Le Rose 2025 »
     sont la meme. Raisonner par produit-millesime fait crier au drame a chaque rotation,
     l'un s'effondrant pendant que l'autre demarre. Une ligne sans nom de produit se range
     sous « (sans nom) » plutot que de disparaitre du total. */
  select coalesce(nullif(public.bdv_cuvee(nullif(btrim(produit), '')), ''), '(sans nom)') as cuvee,
         client_cle, client_nom, num_facture, millesime, conditionnement,
         total_ht, qte, ex_annee, ex_pos,
         (le_jour - date '1970-01-01') as jour,
         extract(month from le_jour)::int as mois_civil
    from public.v_ventes where bureau = b and est_vente
),
tot as (select sum(total_ht) as ca_total from v),
x as (select max(ex_annee) as cur from v),
cut as (select max(ex_pos) as pos from v, x where v.ex_annee = x.cur),
base as (
  select v.cuvee, sum(v.total_ht) as ca, sum(v.qte) as btl,
         count(distinct v.client_cle) as clients,
         coalesce(sum(v.total_ht) filter (where v.ex_annee = (select cur from x)
                                            and v.ex_pos <= (select pos from cut)), 0) as cur,
         coalesce(sum(v.total_ht) filter (where v.ex_annee = (select cur from x) - 1
                                            and v.ex_pos <= (select pos from cut)), 0) as prev
    from v group by 1
),
parmois as (select v.cuvee, v.mois_civil, sum(v.total_ht) as somme from v group by 1,2),
/* De 0 a 12, et la case 0 reste vide : le tableau du navigateur est indice ainsi, et
   les deux doivent se comparer sans decalage. */
mois as (
  select base.cuvee as cuvee, jsonb_agg(coalesce(pm.somme, 0) order by g.i) as par_mois
    from base cross join generate_series(0,12) g(i)
         left join parmois pm on pm.cuvee = base.cuvee and pm.mois_civil = g.i
   group by base.cuvee
),
parclient as (select v.cuvee, v.client_cle, max(v.client_nom) as nom, sum(v.total_ht) as ca,
                     count(distinct v.num_facture) as nfact from v group by 1,2),
/* LA CONCENTRATION : quelle part du CA de cette cuvee tient a son plus gros acheteur. */
top1 as (select distinct on (cuvee) cuvee, nom, ca from parclient order by cuvee, ca desc, client_cle),
/* LE RACHAT : parmi ceux qui l'ont goutee, combien en ont repris. */
rachat as (select cuvee, count(*) filter (where nfact > 1)::numeric / nullif(count(*),0) as taux
             from parclient group by 1),
condq as (select v.cuvee, coalesce(nullif(v.conditionnement,''),'?') as cond, sum(v.qte) as q
            from v group by 1,2),
conddom as (select distinct on (cuvee) cuvee, cond from condq order by cuvee, q desc, cond),
prix as (
  select v.cuvee, array_agg((v.total_ht / v.qte) order by (v.total_ht / v.qte)) as px
    from v join conddom d on d.cuvee = v.cuvee
   where v.qte > 0 and v.total_ht > 0 and coalesce(nullif(v.conditionnement,''),'?') = d.cond
   group by 1
),
/* `px[floor(p * n)]`, indice a partir de zero, borne au dernier. NI `percentile_cont`
   NI `percentile_disc` : ce dernier prend un cran plus bas. */
prixq as (
  select cuvee, array_length(px,1) as n,
         px[least(array_length(px,1), floor(0.1 * array_length(px,1))::int + 1)] as bas,
         px[least(array_length(px,1), floor(0.5 * array_length(px,1))::int + 1)] as med,
         px[least(array_length(px,1), floor(0.9 * array_length(px,1))::int + 1)] as haut
    from prix
),
parmil as (
  select v.cuvee, coalesce(nullif(btrim(v.millesime),''),'sans millésime') as mil,
         sum(v.total_ht) as ca, sum(v.qte) as btl,
         coalesce(sum(v.total_ht) filter (where v.ex_annee = (select cur from x)
                                            and v.ex_pos <= (select pos from cut)), 0) as cur,
         max(v.jour) as dernier
    from v group by 1,2
),
mils as (
  select cuvee, jsonb_agg(jsonb_build_object(
           'm', mil, 'ca', round(ca,2), 'btl', round(btl,3),
           'cur', round(cur,2), 'dernier', dernier) order by mil) as millesimes,
         count(*) as n_mil
    from parmil group by 1
),
liste as (
  select base.cuvee as nom, base.ca, base.btl, base.clients, base.cur, base.prev,
         base.ca / nullif((select ca_total from tot),0) * 100 as part,
         base.cur - base.prev as delta,
         coalesce(top1.ca / nullif(base.ca,0) * 100, 0) as top1,
         coalesce(top1.nom, '') as nom_top,
         coalesce(rachat.taux, 0) as rachat,
         coalesce(prixq.med, 0) as prix_med, coalesce(prixq.bas, 0) as prix_bas,
         coalesce(prixq.haut, 0) as prix_haut, coalesce(prixq.n, 0) as n_prix,
         coalesce(conddom.cond, '') as cond_dom,
         mils.millesimes, mils.n_mil, mois.par_mois
    from base
         left join top1 on top1.cuvee = base.cuvee
         left join rachat on rachat.cuvee = base.cuvee
         left join conddom on conddom.cuvee = base.cuvee
         left join prixq on prixq.cuvee = base.cuvee
         left join mils on mils.cuvee = base.cuvee
         left join mois on mois.cuvee = base.cuvee
),
/* `a[a.length >> 1]` DU NAVIGATEUR, qui rend l'element du HAUT sur un nombre pair.
   Ce n'est PAS `median()`, qui fait la moyenne des deux : deux medianes differentes
   dans le meme fichier, et les aligner par erreur est le reflexe naturel. */
rep as (
  select (array_agg(rachat order by rachat))[(count(*)/2)::int + 1] as rep_rachat,
         (array_agg(clients order by clients))[(count(*)/2)::int + 1] as rep_clients
    from liste
)
select jsonb_build_object(
  'ok', (select count(*) from liste) > 0,
  'caTotal', round((select ca_total from tot), 2),
  'nbMillesimes', (select coalesce(sum(n_mil),0) from liste),
  'repRachat', round((select rep_rachat from rep), 6),
  'repClients', (select rep_clients from rep),
  'exerciceCur', (select cur from x), 'coupePos', (select pos from cut),
  'liste', (select jsonb_agg(jsonb_build_object(
      'nom', nom, 'ca', round(ca,2), 'btl', round(btl,3), 'clients', clients,
      'part', round(part,6), 'cur', round(cur,2), 'prev', round(prev,2),
      'delta', round(delta,2), 'top1', round(top1,6), 'nomTop', nom_top,
      'rachat', round(rachat,6), 'prixMed', round(prix_med,6),
      'prixBas', round(prix_bas,6), 'prixHaut', round(prix_haut,6),
      'nPrix', n_prix, 'condDom', cond_dom,
      'millesimes', millesimes, 'parMois', par_mois) order by nom) from liste));
$$;

revoke all on function public.cuvees_resume(uuid) from anon, authenticated, public;
grant execute on function public.cuvees_resume(uuid) to authenticated;
