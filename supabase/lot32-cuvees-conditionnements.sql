/* ============================================================================
   LOT 32, 24/09/2026 : LA FICHE D'UNE CUVEE REND SES CONDITIONNEMENTS

   A COLLER DANS SUPABASE, APRES le lot 31. Ce fichier est la reference : c'est
   lui qu'on modifie, et on colle ensuite (regle du 10/09/2026).

   CE QUI S'EST PASSE. Depuis le lot 26, la fiche d'une cuvee affichait le titre
   « Conditionnements » et RIEN dessous. `cuvees_resume()` calculait bien le
   volume par conditionnement (`condq`), mais ne s'en servait que pour trouver le
   DOMINANT, qui porte la fourchette de prix. Le detail n'etait pas rendu, et le
   navigateur le remplacait par un objet vide ecrit en dur.

   POURQUOI PERSONNE NE L'A VU : `npm run controle:cuvees` compare les champs que
   le serveur rend. Un champ qu'il ne rend pas ne peut pas diverger. C'est la
   lecon du lot 24 (« un controle ne prouve que ce qu'il compare »), une fois de
   plus. Le controle compare desormais `conds` aussi.

   CE QUE CE FICHIER CHANGE : un champ ADDITIF, `conds`, un tableau
   [{c, btl}] par cuvee. Aucun autre champ ne bouge. La fonction est recopiee du
   lot 26 a l'identique (verifie contre la production le 24/09/2026), plus un
   calcul `conds`, sa jointure et son champ de sortie.

   LE CACHE : `resumes` porte deja un resume « cuvees » calcule avec l'ancienne
   fonction, donc sans `conds`. On l'efface en fin de fichier, sinon la fiche
   resterait vide jusqu'au prochain import. L'absence est le seul etat qu'on ne
   peut pas lire par erreur (regle du lot 27) : le prochain clic recalcule.
   ============================================================================ */

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
/* LOT 32 : LE DETAIL, PAS SEULEMENT LE DOMINANT. Meme `condq` que la ligne du dessus,
   donc le dominant et la liste ne peuvent pas se contredire. Trie comme la fiche :
   le plus gros volume d'abord, le nom pour departager une egalite. */
conds as (select cuvee, jsonb_agg(jsonb_build_object('c', cond, 'btl', round(q,3))
                                  order by q desc, cond) as conds
            from condq group by 1),
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
         coalesce(conds.conds, '[]'::jsonb) as conds,
         mils.millesimes, mils.n_mil, mois.par_mois
    from base
         left join top1 on top1.cuvee = base.cuvee
         left join rachat on rachat.cuvee = base.cuvee
         left join conddom on conddom.cuvee = base.cuvee
         left join conds on conds.cuvee = base.cuvee
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
      'nPrix', n_prix, 'condDom', cond_dom, 'conds', conds,
      'millesimes', millesimes, 'parMois', par_mois) order by nom) from liste));
$$;

revoke all on function public.cuvees_resume(uuid) from anon, authenticated, public;
grant execute on function public.cuvees_resume(uuid) to authenticated;

/* Le cache perime, pour tous les bureaux : il a ete calcule sans `conds`. */
delete from public.resumes where cle = 'cuvees';

/* CONTROLE, a lire apres le collage : une ligne par cuvee de chaque bureau qui a
   des ventes, avec ses conditionnements. Une colonne `conds` vide veut dire que le
   collage n'a pas pris. Ne vise PAS le bureau d'essai : il a ete vide, et
   `jsonb_array_elements` leve sur une liste absente (constate le 24/09/2026). */
select e->>'nom' as cuvee, e->>'condDom' as dominant, e->'conds' as conds
  from (select distinct bureau from public.v_ventes) b,
       jsonb_array_elements(coalesce(public.cuvees_resume(b.bureau)->'liste', '[]'::jsonb)) e
 order by 1;
