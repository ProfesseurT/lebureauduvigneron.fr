/* ============================================================================
   LOT 24, 17/09/2026 : « MON CAP » CALCULE PAR LE SERVEUR

   DEJA APPLIQUE EN BASE. Ce fichier est la reference : c'est lui qu'on modifie,
   et on colle ensuite dans Supabase, jamais l'inverse (regle du 10/09/2026,
   « rien de vivant en production ne doit etre inconnu du depot »).

   ================= LE CONTROLE QUI REND CE LOT DEFENDABLE =================

   Le tableau de bord depose DEJA ses propres chiffres dans
   `reglages.resume_ventes` : calcules par le NAVIGATEUR, sur la vraie base du
   vigneron, a chaque import. On tient donc gratuitement la seule comparaison
   qui compte, navigateur contre serveur, sur des donnees reelles.

   Resultat du 17/09/2026 sur les 171 569 lignes de Ted, TREIZE champs sur
   treize identiques :

     ca 970 959 · clients 1 617 · panier 87 · lignes 171 569
     variation -2,3 % · variationEuros -22 936 · atterrissage 1 627 963
     objectifPct 59 · dernierMois 8 · moisDebut 1 · exercice 2026
     et les DOUZE valeurs mensuelles, une a une

   `v_cap_controle` fige cette comparaison. **Tant qu'une ligne en sort avec
   `identique = false`, on ne retire aucun calcul du navigateur.**

   ==================== LES PIEGES PORTES A L'IDENTIQUE ====================

   1. L'ANCRE N'EST JAMAIS `now()`. L'exercice courant est le dernier PRESENT EN
      BASE, et le jour de coupe est le `ex_pos` le plus avance qu'il porte. La
      base de Ted s'arrete au 31/08/2026 : une requete qui daterait d'aujourd'hui
      comparerait huit mois de ventes a douze mois de calendrier.

   2. DEUX FENETRES DIFFERENTES, ET ELLES NE SE CONFONDENT PAS.
      La comparaison d'une annee sur l'autre se fait sur `ex_pos <= cut_pos`,
      au JOUR pres. L'atterrissage, lui, compare sur `ex_mois <= max_m`, au MOIS
      pres. C'est ce qu'ecrit le JavaScript, et prendre l'une pour l'autre change
      l'atterrissage de plusieurs dizaines de milliers d'euros sans rien casser.

   3. `ex_pos` EST UN ENTIER COMPOSITE, mois dans l'exercice fois cent plus le
      jour. Il se compare comme un entier, jamais comme un ecart en jours.

   4. UN MOIS SANS VENTE VAUT ZERO, il ne disparait pas. Sinon le douzieme point
      du graphique serait le huitieme.
   ============================================================================ */

/* -------------------------------------------------------------------------
   UN SEUL BALAYAGE, ET C'EST TOUT L'ENJEU DE PERFORMANCE

   La premiere version lisait `v_ventes` DIX-SEPT fois, dont douze pour
   construire la serie mensuelle un mois a la fois : 3 755 ms. Les deux
   exercices compares sont maintenant materialises UNE fois et tout en sort :
   1 141 ms.

   `as materialized` n'est pas decoratif : sans lui Postgres replonge dans la
   table a chaque usage du CTE, et on revient au point de depart.
   ------------------------------------------------------------------------- */
create or replace function public.cap_resume(b uuid)
returns jsonb
language sql stable security invoker parallel safe
set search_path = ''
as $$
with x as materialized (
  select max(ex_annee) as cur, count(*) as lignes from public.v_ventes where bureau = b
),
d as materialized (
  select v.ex_annee, v.ex_mois, v.ex_pos, v.le_jour, v.total_ht, v.qte, v.client_cle, v.num_facture
    from public.v_ventes v, x
   where v.bureau = b and v.est_vente and v.ex_annee between x.cur - 1 and x.cur
),
c as (
  select max(ex_mois) as max_m, max(ex_pos) as cut_pos,
         sum(total_ht) as done, sum(qte) as btl,
         count(distinct client_cle) as clients,
         count(distinct num_facture) filter (where num_facture <> '') as factures
    from d, x where d.ex_annee = x.cur
),
/* Le JOUR de coupe, pour la phrase « Au 31/08/2026 : ... ». C'est la date de la ligne
   qui porte le `ex_pos` le plus avance, pas le maximum des dates : sur un exercice a
   cheval, la ligne la plus avancee DANS l'exercice peut etre anterieure en calendrier. */
j as (
  select max(le_jour) as jour from d, x, c where d.ex_annee = x.cur and d.ex_pos = c.cut_pos
),
p as (
  select sum(total_ht) filter (where d.ex_mois <= c.max_m) as prev_ytd,
         sum(total_ht) as prev_full,
         sum(total_ht) filter (where d.ex_pos <= c.cut_pos) as prev_coupe,
         sum(qte)      filter (where d.ex_pos <= c.cut_pos) as prev_qte
    from d, x, c where d.ex_annee = x.cur - 1
),
cc as (
  select sum(total_ht) as cur_coupe, sum(qte) as cur_qte
    from d, x, c where d.ex_annee = x.cur and d.ex_pos <= c.cut_pos
),
mm as (
  select d.ex_mois, round(sum(d.total_ht)) as v
    from d, x where d.ex_annee = x.cur and d.ex_mois between 1 and 12 group by 1
),
mp as (
  select d.ex_mois, round(sum(d.total_ht)) as v
    from d, x where d.ex_annee = x.cur - 1 and d.ex_mois between 1 and 12 group by 1
),
m as (
  select jsonb_agg(coalesce(mm.v, 0) order by g.i) as mois
    from generate_series(1,12) g(i) left join mm on mm.ex_mois = g.i
),
mpr as (
  select jsonb_agg(coalesce(mp.v, 0) order by g.i) as mois
    from generate_series(1,12) g(i) left join mp on mp.ex_mois = g.i
),
r as (select exercice_debut, objectif from public.reglages where bureau = b),
/* LES DEUX PROJECTIONS, NOMMEES, PARCE QU'ELLES SERVENT QUATRE FOIS. `sai` est nulle
   quand l'exercice precedent n'a rien encaisse sur les mois connus : c'est ELLE, et
   pas « un exercice precedent existe en base », qui decide de la methode. La meme
   regle est ecrite dans computeAtterrissage() cote navigateur, et scripts/
   banc-cap-serveur.mjs compare les deux sorties champ par champ. */
lin as (select case when c.max_m > 0 then c.done * 12.0 / c.max_m end as v from c),
sai as (select case when p.prev_ytd > 0 then c.done / p.prev_ytd * p.prev_full end as v from c, p)
select jsonb_build_object(
  'exercice', case when coalesce(r.exercice_debut,1) = 1 then x.cur::text
                   else x.cur::text || '/' || (x.cur + 1)::text end,
  'exerciceNum', x.cur, 'precedentNum', x.cur - 1,
  'moisDebut', coalesce(r.exercice_debut, 1),
  'mois', m.mois, 'moisPrecedent', mpr.mois, 'dernierMois', nullif(c.max_m, 0),
  'ca', round(c.done), 'bouteilles', round(c.btl, 3),
  'clients', c.clients, 'factures', c.factures,
  'panier', case when c.factures > 0 then round(c.done / c.factures) end,
  'lignes', x.lignes,
  'coupeJour', to_char(j.jour, 'DD/MM/YYYY'),
  'coupePos', c.cut_pos,
  'caCoupe', round(cc.cur_coupe), 'caCoupePrecedent', round(p.prev_coupe),
  'qteCoupe', round(cc.cur_qte, 3), 'qteCoupePrecedent', round(p.prev_qte, 3),
  'variation', case when p.prev_coupe <> 0
                    then round((cc.cur_coupe - p.prev_coupe) / abs(p.prev_coupe) * 100, 1) end,
  'variationEuros', case when p.prev_coupe is not null then round(cc.cur_coupe - p.prev_coupe) end,
  'objectif', r.objectif,
  'objectifPct', case when r.objectif > 0 then round(c.done / r.objectif * 100) end,
  'complet', c.max_m >= 12,
  'atterrissage', case when c.max_m >= 12 then null else round(coalesce(sai.v, lin.v)) end,
  /* EN LINEAIRE, LE BAS DE LA FOURCHETTE EST LE REALISE, PAS LA PROJECTION. Une
     fourchette « 1 456 438 a 1 456 438 » n'informe de rien ; « ce qui est deja
     encaisse a la projection » dit quelque chose de vrai : au pire, l'exercice
     finit ou il en est. Le navigateur l'ecrivait deja ainsi, le serveur repondait
     deux fois la projection : c'etait le seul ecart de rendu entre les deux cotes. */
  'bas',  case when c.max_m >= 12 then null
               when sai.v is not null then round(least(sai.v, lin.v))
               else round(c.done) end,
  'haut', case when c.max_m >= 12 then null
               when sai.v is not null then round(greatest(sai.v, lin.v))
               else round(lin.v) end,
  'projectionLineaire', round(lin.v),
  'methode', case when sai.v is not null then 'saison' else 'lineaire' end
)
from x, c, p, cc, m, mpr, r, j, lin, sai;
$$;

revoke all on function public.cap_resume(uuid) from anon, authenticated, public;
grant execute on function public.cap_resume(uuid) to authenticated;

/* -------------------------------------------------------------------------
   LE CONTROLE, NAVIGATEUR CONTRE SERVEUR, CHAMP PAR CHAMP

   Elle ne vaut que si le depot est RECENT : un resume depose avant un import
   compare deux bases differentes. `depose_le` est rendu pour qu'on en juge.
   ------------------------------------------------------------------------- */
create or replace view public.v_cap_controle with (security_invoker = true) as
select r.bureau, r.depose_le, k.champ,
       r.resume_ventes->k.champ as cote_navigateur,
       public.cap_resume(r.bureau)->k.champ as cote_serveur,
       (r.resume_ventes->k.champ) is not distinct from (public.cap_resume(r.bureau)->k.champ) as identique
  from public.reglages r
  cross join lateral (values ('ca'),('clients'),('panier'),('lignes'),('mois'),
                             ('variation'),('variationEuros'),('atterrissage'),
                             ('objectif'),('objectifPct'),('moisDebut'),('dernierMois'),
                             ('exercice')) as k(champ)
 where r.resume_ventes is not null;

revoke all on public.v_cap_controle from anon, authenticated, public;
grant select on public.v_cap_controle to authenticated;

/* POUR CONTROLER, A TOUT MOMENT :

     select champ, cote_navigateur, cote_serveur from public.v_cap_controle
      where not identique;

   Zero ligne, et le serveur dit exactement ce que le navigateur dit. */
