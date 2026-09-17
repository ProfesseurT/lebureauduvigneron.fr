/* ===========================================================================
   LOT 25 : « MON COMMERCE » CALCULE PAR LE SERVEUR, 17/09/2026

   CE QUI EST PORTE ICI : le bridge (les quatre mouvements de clientele), la
   cadence d'achat par client, et le decrochage. Le « premier achat sans suite »
   n'est PAS dans ce fichier, et c'est dit plus bas.

   ---------------------------------------------------------------------------
   LE FILET, ET POURQUOI IL A FALLU EN FABRIQUER UN

   Pour « Mon cap », le controle etait gratuit : le navigateur depose deja ses
   chiffres dans `reglages.resume_ventes`, et `v_cap_controle` n'avait qu'a les
   lire. Ici, RIEN N'EST DEPOSE. Aucun chiffre de « Mon commerce » ne remonte
   sur le compte, donc aucune comparaison n'existait.

   Et la vraie base de Ted ne pouvait pas servir de terrain d'essai : c'est une
   facturation d'abonnement mensuel, 1 831 clients sur 1 935 venus trois fois ou
   plus, 63 une seule fois, 34 observables a un an. Elle ecrase le moteur en
   VOLUME, ce qui est precieux, et elle ne touche presque aucun des cas ou un
   portage se trompe.

   Le filet est donc en deux morceaux :

     1. `scripts/fixtures/commerce-cas-limites.mjs`, une base fabriquee A
        L'ENVERS : on part de la liste des pieges connus, et chaque client
        existe pour en toucher un. Elle est chargee dans le bureau d'essai
        `ZZ-ESSAI-COMMERCE` par `lot25-bureau-essai.sql`, et elle passe par le
        MEME chemin que les vraies ventes : declencheur, table etroite,
        `est_vente`, `ex_annee`. Le portage est donc verifie avec sa derivation,
        pas seulement ses agregats.

     2. `scripts/temoin-commerce.mjs` fait tourner le VRAI moteur dessus et
        fige sa reponse ; `scripts/controle-commerce.mjs` en fabrique la requete
        de comparaison, client par client et champ par champ.

   RESULTAT DU 17/09/2026 : 73 clients, 14 champs chacun, ZERO ecart.

   ---------------------------------------------------------------------------
   LES TROIS CONVENTIONS QUI NE SE VOIENT PAS

   Elles sont ecrites en clair dans le corps ci-dessous, a l'endroit ou elles
   servent. Verifiees par mutation sur le bureau d'essai, et voici ce que
   coute chacune si on prend celle de Postgres par defaut :

     `percentile_disc` au lieu de `percentile_cont` : SEPT cadences sur douze
     changent. C-PAIR-2 passe de 60 jours a 30, C-PAIR-4 de 60 a 20, C-AVOIR de
     185 jours a SIX. Un client dont la cadence tombe a six jours est en retard
     en permanence : il s'installe en tete de la liste d'appels et n'en sort
     plus.

     `stddev_samp` au lieu de `stddev_pop` : trois coefficients de variation
     changent, et C-PAIR-2 change de classe, de regulier a occasionnel. Sur la
     vraie base de Ted, la meme substitution fait sortir TROIS clients de la
     liste de decrochage et bouge la perte annoncee de 703 euros.

   Aucune de ces erreurs ne casse quoi que ce soit a l'ecran. Les listes
   restent pleines, les nombres restent plausibles. C'est la famille du signe
   des avoirs du 17/09/2026, 715 347 euros parfaitement credibles.

   ---------------------------------------------------------------------------
   CE QUI N'EST PAS FAIT

   `agentPremierAchat()` n'est pas porte. Sur la base de Ted il REFUSE de
   repondre : 34 clients observables la ou il en exige 40, et il a raison de
   refuser, un taux de retour sur 34 personnes ne dit rien. On ne peut donc pas
   le verifier sur des donnees reelles, seulement sur la base fabriquee. Le
   porter quand meme reviendrait a poser sur l'ecran des taux que personne n'a
   jamais pu confronter a la realite.

   Et « Mon commerce » lit encore `ROWS` pour tout le reste : le pied d'ecran
   (qui pese quoi), les libelles, le tri. Ce lot prouve la chaine, il ne
   supprime pas l'attente.
   =========================================================================== */

create or replace function public.commerce_resume(b uuid)
returns jsonb
language sql stable security invoker parallel safe
set search_path = ''
as $$
with v as materialized (
  /* LE JOUR EST UN ENTIER, pas une date : `_dayNum` du navigateur compte les jours
     depuis le 01/01/1970, et c'est la seule unite dans laquelle l'outil compare deja
     des intervalles. Garder un `date` ici obligerait a convertir a chaque comparaison,
     et une conversion oubliee ne se verrait pas. */
  select client_cle, client_nom, (le_jour - date '1970-01-01') as jour,
         total_ht, num_facture, ex_annee, ex_pos,
         extract(month from le_jour)::int as mois_civil
    from public.v_ventes where bureau = b and est_vente
),
/* LE JOUR DE REFERENCE, et il y en a DEUX dans le navigateur. `profilBase()` prend le
   dernier jour des lignes de VENTE ; `computeMeta()` prend le dernier jour de TOUTES
   les lignes, hors vente comprises, et c'est celui-la que « premier achat » utilise.
   Ils coincident presque toujours, donc l'ecart ne se verrait que le jour ou la
   derniere ligne de la base est un transport. On porte les deux, separement. */
ref as (select max(jour) as jour from v),
reftout as (select max(le_jour - date '1970-01-01') as jour
              from public.v_ventes where bureau = b),

/* Les JOURS DISTINCTS par client. Pas les lignes, pas les factures : deux factures le
   meme jour ne font qu'un achat, et c'est ce que `clientPurchaseDays()` compte avec un
   Set. Compter les factures donnerait une cadence a des clients qui n'en ont pas. */
j as (select client_cle, jour from v group by 1,2),
jn as (select client_cle, count(*)::int as n, min(jour) as premier, max(jour) as dernier
         from j group by 1),
g as (select client_cle, (jour - lag(jour) over (partition by client_cle order by jour)) as ecart
        from j),
gaps as (select client_cle, ecart from g where ecart is not null),

/* ---- L'INTERVALLE MEDIAN DE LA BASE ----
   Tous les intervalles de tous les clients mis en commun, puis la mediane.
   `percentile_cont` et PAS `percentile_disc` : le `median()` du depot fait la MOYENNE
   DES DEUX VALEURS CENTRALES quand le tableau est de longueur paire. */
base as (select coalesce(percentile_cont(0.5) within group (order by ecart), 0) as med from gaps),

agg as (select client_cle, max(client_nom) as nom, sum(total_ht) as montant,
               count(distinct num_facture) as nfact
          from v group by 1),
/* Le mois d'achat habituel : le mois CIVIL ou ce client a laisse le plus d'argent.
   A egalite le navigateur rend le plus PETIT, parce qu'il parcourt un objet dont les
   cles sont des entiers, et JavaScript les range alors par ordre croissant. Un
   `order by total desc` seul rendrait n'importe lequel des ex aequo. */
mois as (select distinct on (client_cle) client_cle, mois_civil
           from (select client_cle, mois_civil, sum(total_ht) as t from v group by 1,2) z
          order by client_cle, t desc, mois_civil asc),
cadg as (select client_cle,
                percentile_cont(0.5) within group (order by ecart) as med,
                case when avg(ecart) > 0 then stddev_pop(ecart) / avg(ecart) else 0 end as cv
           from gaps group by 1),
cad as (
  select jn.client_cle, agg.nom, jn.n, agg.montant, agg.nfact,
         jn.dernier as last, ref.jour - jn.dernier as silence,
         case when agg.nfact > 0 then agg.montant / agg.nfact else agg.montant end as panier,
         /* Trois achats minimum (`cadenceMinAchats`), donc DEUX intervalles au moins :
            le cas pair est le cas courant, pas le cas rare. */
         case when jn.n >= 3 then cadg.med end as cadence,
         /* `stddev_pop`, PAS `stddev`. Le `stdev()` du depot divise par n ; celui de
            Postgres divise par n-1 et rend un nombre plus grand. Il classerait des
            clients reguliers en occasionnels, et il remonterait le seuil de decrochage
            juste assez pour faire disparaitre des clients de la liste d'appels. */
         case when jn.n >= 3 then cadg.cv end as cv,
         mois.mois_civil as mois_hab
    from jn join agg using (client_cle) cross join ref
         left join mois using (client_cle) left join cadg using (client_cle)
),
cad2 as (
  select c.*, (c.n >= 3) as fiable,
         case when c.n = 1 then 'one-shot'
              when c.n >= 3 then case when c.cv <= 0.5 then 'regulier' else 'occasionnel' end
              else 'peu' end as cls,
         coalesce(c.cadence, base.med) as cad_ref
    from cad c cross join base
),
cad3 as (
  select c.*,
         (c.cadence is not null and c.cadence >= 300 and c.cadence <= 430) as annuel,
         case when c.cad_ref > 0 then c.silence / c.cad_ref else 0 end as ampleur,
         /* STRICTEMENT SUPERIEUR. Un silence egal a 1,5 fois la cadence n'est PAS un
            retard : `>=` et `>` ne donnent pas la meme liste, et aucun des deux ne se
            plaint. La fixture pose un client exactement sur cette frontiere. */
         (c.cad_ref > 0 and c.n >= 2 and c.silence > c.cad_ref * 1.5) as en_retard,
         case when c.cadence is not null then c.last + c.cadence end as prochaine,
         case when c.n >= 3 then case when c.n >= 5 then 'bonne' else 'moyenne' end
              else 'faible' end as conf
    from cad2 c
),

x as (select max(ex_annee) as cur from v),
cut as (select max(ex_pos) as pos from v, x where v.ex_annee = x.cur),
yy as (
  select v.client_cle, max(v.client_nom) as nom,
         coalesce(sum(total_ht) filter (where ex_annee = x.cur), 0) as cur,
         coalesce(sum(total_ht) filter (where ex_annee = x.cur - 1), 0) as prev
    from v, x, cut
   where v.ex_annee in (x.cur, x.cur - 1) and v.ex_pos <= cut.pos
   group by 1
),
/* Le CA annuel COMPLET par exercice, pour la volatilite propre du client. Exercices
   entiers, PAS arretes au jour de coupe : ce sont deux fenetres differentes, et les
   confondre deplace le seuil sans rien casser a l'ecran. */
an as (select client_cle, ex_annee, sum(total_ht) as ca from v group by 1,2),
vol as (select client_cle, count(*) as n_an, avg(ca) as moy, stddev_pop(ca) as sd
          from an group by 1),
dec0 as (
  select yy.client_cle, yy.nom, yy.cur, yy.prev, yy.prev - yy.cur as perdu,
         case when yy.prev > 0 then (yy.cur - yy.prev) / yy.prev * 100 else 0 end as pct,
         case when vol.n_an >= 3 and vol.moy > 0 then vol.sd / vol.moy end as cv,
         jn.n as n_jours
    from yy join vol using (client_cle) join jn using (client_cle)
),
dec1 as (select d.*, -30 * (1 + least(coalesce(d.cv, 0), 1.5)) as seuil from dec0 d),
dec2 as (select * from dec1 where prev > 0 and cur >= 0 and pct < seuil),

/* ---- LES QUATRE MOUVEMENTS ----
   Chaque euro de variation est dans exactement une ligne. Un client rigoureusement
   stable n'est dans aucune, et ne figure pas non plus parmi les mouvements. */
br as (
  select coalesce(sum(cur) filter (where prev <= 0 and cur > 0), 0) as nw,
         coalesce(sum(cur - prev) filter (where not (prev <= 0 and cur > 0)
                                            and not (cur <= 0 and prev > 0)
                                            and cur - prev >= 0), 0) as up,
         coalesce(sum(cur - prev) filter (where not (prev <= 0 and cur > 0)
                                            and not (cur <= 0 and prev > 0)
                                            and cur - prev < 0), 0) as down,
         coalesce(sum(cur - prev) filter (where cur <= 0 and prev > 0), 0) as lost
    from yy
)
select jsonb_build_object(
  'refJour', (select jour from ref),
  'refJourTout', (select jour from reftout),
  'intervalleMedianBase', (select med from base),
  'exerciceCur', (select cur from x), 'exercicePrev', (select cur - 1 from x),
  'coupePos', (select pos from cut),
  'bridge', (select jsonb_build_object('nw', round(nw,2), 'up', round(up,2),
                                       'down', round(down,2), 'lost', round(lost,2),
                                       'delta', round(nw+up+down+lost,2)) from br),
  'cadence', (select jsonb_agg(jsonb_build_object(
                 'id', client_cle, 'n', n, 'montant', round(montant,2),
                 'panier', round(panier,4), 'last', last, 'silence', silence,
                 'cadence', cadence, 'cadRef', cad_ref, 'cv', round(cv::numeric,6),
                 'cls', cls, 'fiable', fiable, 'annuel', annuel, 'moisHab', mois_hab,
                 'enRetard', en_retard, 'ampleur', round(ampleur::numeric,6),
                 'prochaine', prochaine, 'conf', conf) order by client_cle) from cad3),
  'decroche', (select jsonb_agg(jsonb_build_object(
                 'id', client_cle, 'cur', round(cur,2), 'prev', round(prev,2),
                 'perdu', round(perdu,2), 'pct', round(pct,6),
                 'cv', round(cv::numeric,6), 'seuil', round(seuil::numeric,6))
                 order by perdu desc) from dec2 where n_jours > 1),
  'totPerdu', (select coalesce(round(sum(perdu),2),0) from dec2 where n_jours > 1),
  'ecartes', (select count(*) from dec2 where n_jours <= 1),
  'caEcarte', (select coalesce(round(sum(perdu),2),0) from dec2 where n_jours <= 1)
);
$$;

revoke all on function public.commerce_resume(uuid) from anon, authenticated, public;
grant execute on function public.commerce_resume(uuid) to authenticated;

/* POUR CONTROLER, A TOUT MOMENT :
     npm run temoin:commerce          fige la reponse du navigateur
     npm run controle:commerce        fabrique la requete de comparaison
   puis coller cette requete dans Supabase. Zero ligne = les deux cotes sont
   d'accord. Le bureau d'essai se recharge avec lot25-bureau-essai.sql.

   POUR LE SUPPRIMER, quand il n'aura plus lieu d'etre :
     delete from public.ventes  where bureau = '00000000-0000-4000-8000-0000000e5541';
     delete from public.reglages where bureau = '00000000-0000-4000-8000-0000000e5541';
     delete from public.bureaux  where bureau = '00000000-0000-4000-8000-0000000e5541';
*/
