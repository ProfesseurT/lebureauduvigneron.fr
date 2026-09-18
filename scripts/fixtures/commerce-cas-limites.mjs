/* ============================================================================
   scripts/fixtures/commerce-cas-limites.mjs

   LA BASE D'ESSAI DE « MON COMMERCE », PARTAGEE PAR LES DEUX COTES.

   POURQUOI UNE BASE FABRIQUEE ET PAS CELLE DE TED. Sa base de facturation est
   un abonnement mensuel : 1 831 clients sur 1 935 sont venus trois fois ou
   plus, 63 une seule fois, et seulement 34 sont observables a un an. Elle
   ecrase le moteur en VOLUME, ce qui est precieux, et elle ne touche presque
   AUCUN des cas ou un portage se trompe. Un client a deux achats, une mediane
   sur un nombre pair d'intervalles, un quantile pile sur sa borne : elle n'en
   a pas, ou pas assez. Porter contre elle reviendrait a mesurer la justesse
   d'une balance en pesant toujours le meme sac.

   Cette base-ci est ecrite A L'ENVERS : on part de la liste des pieges connus,
   et chaque client existe pour en toucher un. Elle est deterministe, donc les
   deux cotes voient exactement les memes nombres, et elle ne contient AUCUNE
   donnee reelle : le depot ne doit pas se mettre a porter les noms et le
   chiffre d'affaires des clients de Ted.

   ------------------------------------------------------------------------
   LES TROIS CONVENTIONS QUI NE SE VOIENT PAS, ET QUI CHANGENT LES LISTES
   ------------------------------------------------------------------------

   1. `median()` du depot fait la MOYENNE DES DEUX VALEURS CENTRALES quand le
      tableau est de longueur paire. C'est `percentile_cont(0.5)`, PAS
      `percentile_disc(0.5)`. Un client a trois achats a DEUX intervalles :
      c'est le cas le plus courant d'une base de domaine, et c'est justement
      celui ou les deux conventions divergent.

   2. `stdev()` du depot divise par n. C'est l'ecart-type de POPULATION,
      `stddev_pop`. Le `stddev()` de Postgres est celui d'ECHANTILLON, qui
      divise par n-1 et rend donc un nombre plus grand. Il sert a moduler le
      seuil de decrochage : un ecart-type surestime remonte le seuil, et des
      clients en recul reel disparaissent de la liste d'appels sans que rien
      ne le signale. Mesure faite sur la vraie base de Ted : trois clients
      sortent de la liste, et la perte annoncee bouge de 703 euros. Assez
      petit pour passer inapercu, assez gros pour etre trois coups de fil.

   3. Les quartiles du premier achat s'ecrivent `montants[floor(p * n)]`.
      Ce n'est NI `percentile_cont` NI `percentile_disc` : `percentile_disc`
      prend l'indice `ceil(p * n) - 1`, donc un cran plus bas. Sur une base de
      cent clients c'est un client d'ecart par borne, et ce client change de
      classe, donc de taux de retour, donc de rang dans la liste d'appels.

   Chacune est fausse SILENCIEUSEMENT : les nombres restent plausibles, les
   listes restent pleines, rien n'echoue. C'est la famille du signe des avoirs
   du 17/09/2026, 715 347 euros parfaitement credibles.
   ============================================================================ */

/* Jour absolu = jours depuis le 01/01/1970, la seule unite dans laquelle
   l'outil compare deja des intervalles (`_dayNum`). */
const JOUR = 86400000;
export const jourDe = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / JOUR);
export const dateDe = (j) => {
  const t = new Date(j * JOUR);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), t: j * JOUR };
};
/* AAAA-MM-JJ, pour le cote SQL. */
export const isoDe = (j) => new Date(j * JOUR).toISOString().slice(0, 10);

/* Le dernier jour de la base. Tout le reste se compte a rebours depuis lui,
   parce que c'est ce que fait le moteur : l'ancre n'est jamais `now()`. */
export const REF = jourDe(2026, 8, 31);

/* Exercice civil (moisDebut = 1), comme la base de Ted. `ex_pos` est le mois
   dans l'exercice fois cent plus le jour : un entier composite, qui se compare
   comme un entier. */
function exDe(j) {
  const d = dateDe(j);
  return { exY: d.y, exM: d.m, exPos: d.m * 100 + d.d };
}

/* Nommee une fois, utilisee par la ligne hors vente ET par le classement du
   bureau d'essai : deux chaines ecrites a la main finissent par differer d'un
   accent, et la ligne cesse alors silencieusement d'etre exclue. */
const HORS_CA = 'Transport';

let seq = 0;
const lignes = [];
/* Une vente. `qte` et le produit ne servent qu'a l'affichage cote « premier
   achat » ; ils sont poses pour que les deux cotes aient la meme chose a dire. */
function vente(id, nom, jour, montant, opts = {}) {
  const e = exDe(jour);
  lignes.push({
    id, nom,
    jour, iso: isoDe(jour),
    exY: e.exY, exM: e.exM, exPos: e.exPos,
    total: montant,
    qte: opts.qte != null ? opts.qte : Math.max(1, Math.round(montant / 12)),
    facture: opts.facture || ('F' + (++seq)),
    /* `!= null` ET PAS `||` : une chaine vide est un produit SANS NOM, pas un produit
       absent. Ecrit apres coup, parce que le `||` avalait silencieusement la ligne posee
       exprès pour verifier ou se range une vente sans nom de produit : la fixture croyait
       la tester et ne la testait pas. */
    produit: opts.produit != null ? opts.produit : 'Cuvée Témoin',
    famille: opts.famille || 'Vin',
    horsVente: opts.famille === HORS_CA,
    typeClient: opts.type || 'Caviste',
    ville: opts.ville || 'Nantes',
    millesime: opts.millesime != null ? opts.millesime : '2024',
    /* Ajoute le 18/09 : sans lui, les trois ventes en magnum posees pour verifier que le
       conditionnement DOMINANT filtre les prix arrivaient en 75 cl, et la fourchette de
       prix melangeait les deux. La fixture croyait tester ce cas, elle le rendait faux. */
    conditionnement: opts.conditionnement || '75cl'
  });
}

/* ---------------------------------------------------------------------------
   FAMILLE 1 : LA MEDIANE DES INTERVALLES, SUR UN NOMBRE PAIR ET IMPAIR

   `cadenceMinAchats` vaut 3, donc la cadence n'est calculee qu'a partir de
   trois achats, soit DEUX intervalles : le cas pair est le cas normal, pas le
   cas rare. Les deux clients ci-dessous ont des intervalles choisis pour que
   la moyenne des deux centraux et la valeur centrale basse different
   franchement, au lieu de se ressembler par chance.
   --------------------------------------------------------------------------- */
// 3 achats, 2 intervalles (30 et 90) : mediane 60 en moyenne des deux, 30 en
// valeur basse. Un facteur deux sur la cadence annoncee au vigneron.
vente('C-PAIR-2', 'Médiane paire, deux intervalles', REF - 200, 500);
vente('C-PAIR-2', 'Médiane paire, deux intervalles', REF - 170, 500);
vente('C-PAIR-2', 'Médiane paire, deux intervalles', REF - 80, 500);

// 5 achats, 4 intervalles (10, 20, 100, 200) : mediane 60, valeur basse 20.
vente('C-PAIR-4', 'Médiane paire, quatre intervalles', REF - 400, 300);
vente('C-PAIR-4', 'Médiane paire, quatre intervalles', REF - 390, 300);
vente('C-PAIR-4', 'Médiane paire, quatre intervalles', REF - 370, 300);
vente('C-PAIR-4', 'Médiane paire, quatre intervalles', REF - 270, 300);
vente('C-PAIR-4', 'Médiane paire, quatre intervalles', REF - 70, 300);

// 4 achats, 3 intervalles (15, 45, 120) : mediane 45, les deux conventions
// tombent d'accord. Il est la pour qu'un echec ne puisse pas venir de partout.
vente('C-IMPAIR-3', 'Médiane impaire, trois intervalles', REF - 300, 400);
vente('C-IMPAIR-3', 'Médiane impaire, trois intervalles', REF - 285, 400);
vente('C-IMPAIR-3', 'Médiane impaire, trois intervalles', REF - 240, 400);
vente('C-IMPAIR-3', 'Médiane impaire, trois intervalles', REF - 120, 400);

/* ---------------------------------------------------------------------------
   FAMILLE 2 : DEUX LIGNES LE MEME JOUR NE FONT QU'UN ACHAT

   `clientPurchaseDays()` range les jours dans un Set. Un portage qui compterait
   les LIGNES ou les FACTURES au lieu des JOURS DISTINCTS donnerait a ce client
   quatre achats au lieu de trois, donc une cadence, donc une place dans une
   liste ou il n'a rien a faire. Deux factures le meme jour, en plus, pour que
   compter les factures ne s'en sorte pas non plus.
   --------------------------------------------------------------------------- */
vente('C-MEMEJOUR', 'Deux lignes le même jour', REF - 200, 250, { facture: 'FJ-1' });
vente('C-MEMEJOUR', 'Deux lignes le même jour', REF - 200, 250, { facture: 'FJ-2' });
vente('C-MEMEJOUR', 'Deux lignes le même jour', REF - 100, 600, { facture: 'FJ-3' });
vente('C-MEMEJOUR', 'Deux lignes le même jour', REF - 40, 600, { facture: 'FJ-4' });

/* ---------------------------------------------------------------------------
   FAMILLE 3 : L'ECART-TYPE, POPULATION CONTRE ECHANTILLON

   La volatilite n'est calculee qu'a partir de TROIS exercices connus. Ces
   clients en ont exactement trois ou quatre, avec des chiffres annuels ecartes
   expres : c'est a n = 3 que la difference entre diviser par n et par n-1 est
   la plus grande (un facteur 1,22 sur l'ecart-type).

   Le seuil de decrochage vaut -30 % module par (1 + min(CV, 1.5)). Les deux
   clients ci-dessous sont poses DE PART ET D'AUTRE de la frontiere selon la
   convention retenue : avec la bonne, l'un alerte et l'autre non ; avec celle
   de Postgres par defaut, ils basculent tous les deux.
   --------------------------------------------------------------------------- */
// Trois exercices tres irreguliers (CV eleve), puis une chute de 45 %.
for (const [y, ca] of [[2023, 2000], [2024, 9000], [2025, 4000]])
  vente('C-CV3', 'Volatil, trois exercices', jourDe(y, 6, 15), ca);
vente('C-CV3', 'Volatil, trois exercices', jourDe(2025, 3, 10), 4000);
vente('C-CV3', 'Volatil, trois exercices', jourDe(2026, 3, 10), 2200);

// Quatre exercices reguliers (CV faible), meme chute de 45 % : lui doit sortir.
for (const [y, ca] of [[2022, 5000], [2023, 5200], [2024, 4900], [2025, 5100]])
  vente('C-CV4', 'Régulier, quatre exercices', jourDe(y, 6, 15), ca);
vente('C-CV4', 'Régulier, quatre exercices', jourDe(2025, 3, 10), 3000);
vente('C-CV4', 'Régulier, quatre exercices', jourDe(2026, 3, 10), 1650);

/* LE CLIENT DE LA FRONTIERE, et c'est lui qui rend la famille utile. Les deux
   precedents chutent si fort qu'ils alertent sous n'importe quelle convention :
   ils verifient la VALEUR du coefficient de variation, pas la LISTE. Celui-ci
   est pose entre les deux seuils, resolu numeriquement :

     chiffres annuels 1 500 / 9 000 / 6 000 / 2 975
     CV de population    0,5925  ->  seuil -47,77 %
     CV d'echantillon    0,7508  ->  seuil -50,52 %
     sa chute reelle                       -50,42 %

   Avec la bonne convention il est DANS la liste d'appels de Ted. Avec le
   `stddev()` de Postgres, qui est celui d'echantillon, il n'y est plus, et
   aucun chiffre a l'ecran ne parait anormal. Trois clients dans ce cas sur la
   vraie base, mesure le 17/09/2026. */
for (const [y, ca] of [[2023, 1500], [2024, 9000], [2025, 6000]])
  vente('C-FRONTIERE', 'Pile entre les deux conventions', jourDe(y, 3, 12), ca);
vente('C-FRONTIERE', 'Pile entre les deux conventions', jourDe(2026, 3, 12), 2975);

// Deux exercices seulement : AUCUNE volatilite calculable, seuil brut a -30 %.
vente('C-CV2', 'Deux exercices, pas de volatilité', jourDe(2025, 2, 5), 3000);
vente('C-CV2', 'Deux exercices, pas de volatilité', jourDe(2025, 7, 5), 3000);
vente('C-CV2', 'Deux exercices, pas de volatilité', jourDe(2026, 2, 5), 1500);

/* ---------------------------------------------------------------------------
   FAMILLE 4 : LES QUATRE MOUVEMENTS DU BRIDGE, QUI DOIVENT BOUCLER

   Chaque euro de variation est dans EXACTEMENT une ligne : un client ne peut
   pas etre a la fois perdu et en baisse. Un client par mouvement, plus un
   client dont le montant ne bouge pas d'un centime, qui ne doit apparaitre
   dans AUCUNE des quatre et ne pas figurer parmi les mouvements.
   --------------------------------------------------------------------------- */
vente('C-NOUVEAU', 'Nouveau cette année', jourDe(2026, 4, 12), 1200);

vente('C-PERDU', 'Perdu cette année', jourDe(2025, 4, 12), 1800);
vente('C-PERDU', 'Perdu cette année', jourDe(2025, 1, 9), 900);

vente('C-HAUSSE', 'En hausse', jourDe(2025, 5, 20), 1000);
vente('C-HAUSSE', 'En hausse', jourDe(2026, 5, 20), 2500);

vente('C-BAISSE', 'En baisse', jourDe(2025, 5, 20), 3000);
vente('C-BAISSE', 'En baisse', jourDe(2026, 5, 20), 2100);

vente('C-STABLE', 'Rigoureusement stable', jourDe(2025, 5, 20), 1500);
vente('C-STABLE', 'Rigoureusement stable', jourDe(2026, 5, 20), 1500);

/* APRES LA COUPE : ces lignes sont postérieures au dernier jour de l'exercice
   courant et ne doivent entrer dans AUCUNE comparaison a date egale. Un
   portage qui comparerait des exercices ENTIERS au lieu de s'arreter au jour
   de coupe les compterait, et annoncerait une croissance qui n'existe pas. */
vente('C-BAISSE', 'En baisse', jourDe(2025, 11, 3), 5000);

/* UN AVOIR, ligne negative. Le piege deja paye le 17/09/2026 : sur la base de
   Ted, 1 144 lignes negatives pour -357 673 euros, et un signe perdu avait
   gonfle le chiffre d'affaires de 715 347 euros sans rien casser a l'ecran. */
vente('C-AVOIR', 'Client avec avoir', jourDe(2026, 2, 14), 900);
vente('C-AVOIR', 'Client avec avoir', jourDe(2026, 2, 20), -150, { qte: -12 });
vente('C-AVOIR', 'Client avec avoir', jourDe(2025, 2, 14), 900);

/* ---------------------------------------------------------------------------
   FAMILLE 5 : LE PREMIER ACHAT SANS SUITE

   Trois seuils a franchir pour que l'agent reponde quoi que ce soit :
     - 40 clients « observables », c'est-a-dire venus une seule fois il y a
       PLUS D'UN AN. En dessous, il refuse de publier un taux, et il a raison.
     - 15 clients par classe de montant pour que la classe publie le sien.
     - un an d'anciennete : en dessous, « pas revenu » veut surtout dire
       « pas encore eu le temps ».

   On en pose 48 observables, plus 6 trop recents qui doivent etre COMPTES
   dans la liste a rappeler mais EXCLUS du calcul des taux.

   LES MONTANTS SONT 100, 200, ... 4800 : reguliers expres, pour que les bornes
   de quartile tombent exactement entre deux clients. C'est la seule facon de
   voir un ecart d'un cran entre `floor(p*n)` et `percentile_disc`.
   --------------------------------------------------------------------------- */
for (let i = 0; i < 48; i++) {
  const j = REF - 400 - i * 7;                       // tous a plus d'un an
  const type = i % 3 === 0 ? 'Caviste' : (i % 3 === 1 ? 'Particulier' : 'Restaurant');
  vente('M-' + String(i).padStart(2, '0'), 'Venu une fois n°' + i, j, (i + 1) * 100, { type });
}
/* Onze d'entre eux sont en realite revenus : c'est ce qui donne au taux de
   retour une valeur autre que zero, et ce sont eux qui sortent de la liste. */
for (let i = 0; i < 11; i++) {
  const j = REF - 400 - i * 7 + 120;
  vente('M-' + String(i).padStart(2, '0'), 'Venu une fois n°' + i, j, 150);
}
/* Six venus une seule fois, mais il y a moins d'un an : dans la liste, hors
   des taux. Un portage qui les compterait dans les observables ferait baisser
   le taux de retour de toute la base. */
for (let i = 0; i < 6; i++)
  vente('R-' + i, 'Venu récemment n°' + i, REF - 30 - i * 5, 700 + i * 50, { type: 'Caviste' });

/* ---------------------------------------------------------------------------
   FAMILLE 5 bis : LE JOUR DE REFERENCE EST LE DERNIER JOUR DE LA BASE

   Ecrit apres coup, parce que la premiere version de cette fixture n'avait
   AUCUNE ligne au jour `REF` : la vente la plus recente tombait trente jours
   plus tot, et `profilBase()` a donc pose `refDay` la. Tous les silences
   calcules etaient trente jours trop courts, et les trois clients de la
   famille 6, poses de part et d'autre de leur frontiere, se retrouvaient tous
   du meme cote sans que rien ne le dise.

   C'est exactement le defaut que cette fixture est censee attraper, et elle se
   l'est fait a elle-meme : le jour de reference n'est pas une date choisie,
   c'est la DERNIERE VENTE DE LA BASE. Cette ligne-ci l'ancre. */
vente('C-ANCRE', 'Dernière vente de la base', REF, 100);

/* ---------------------------------------------------------------------------
   FAMILLE 6 : LA FRONTIERE DU RETARD DE CADENCE

   « En retard » veut dire : silence > 1,5 x cadence. Trois clients de meme
   cadence (60 jours), poses juste avant, juste apres, et exactement SUR la
   frontiere. Le troisieme decide de la stricte inegalite : `>` et `>=` ne
   donnent pas la meme liste, et aucun des deux ne se plaint.
   --------------------------------------------------------------------------- */
for (const [id, silence] of [['C-RETARD-NON', 85], ['C-RETARD-OUI', 95], ['C-RETARD-PILE', 90]]) {
  vente(id, 'Cadence 60, silence ' + silence, REF - silence - 120, 800);
  vente(id, 'Cadence 60, silence ' + silence, REF - silence - 60, 800);
  vente(id, 'Cadence 60, silence ' + silence, REF - silence, 800);
}

/* ---------------------------------------------------------------------------
   FAMILLE 7 : CE QUI NE DOIT PAS ENTRER

   Une ligne hors vente (`est_vente` faux) chez un client par ailleurs normal.
   Elle ne doit peser sur aucun montant, aucune cadence, aucun jour d'achat.
   Le classement du bureau decide de ce drapeau cote serveur, et c'est
   justement pour ca qu'il faut le verifier des deux cotes.
   --------------------------------------------------------------------------- */
vente('C-HORSVENTE', 'A une ligne hors vente', jourDe(2026, 3, 1), 1000);
vente('C-HORSVENTE', 'A une ligne hors vente', jourDe(2026, 5, 1), 1000);
vente('C-HORSVENTE', 'A une ligne hors vente', jourDe(2026, 6, 1), 1000);
vente('C-HORSVENTE', 'A une ligne hors vente', jourDe(2026, 7, 1), 50000,
  { facture: 'F-TRANSPORT', famille: HORS_CA, produit: 'Transport' });

/* ---------------------------------------------------------------------------
   FAMILLE 8 : LES CUVEES, 18/09/2026

   Ajoutee pour le portage de « Mes cuvees ». Les pieges y sont d'une autre
   nature : ce ne sont plus des dates, ce sont des regroupements et des
   quantiles.

   1. LE MILLESIME EST RETIRE DU NOM. « Le Rose 2024 » et « Le Rose 2025 » sont
      la MEME cuvee : raisonner par produit-millesime fait crier au drame a
      chaque changement de millesime, l'un s'effondrant pendant que l'autre
      monte. Deux millesimes d'une meme cuvee, donc, avec des ventes qui
      basculent de l'un a l'autre.

   2. LE QUANTILE DE PRIX S'ECRIT `px[floor(p * n)]`, comme les quartiles du
      premier achat : ni `percentile_cont` ni `percentile_disc`. Les prix
      ci-dessous sont espaces regulierement pour que la borne tombe entre deux.

   3. LA MEDIANE DES REPERES N'EST PAS `median()`. `A.repRachat` et
      `A.repClients` passent par `a[a.length>>1]`, qui rend l'element du HAUT
      sur un nombre pair, la ou `median()` fait la moyenne des deux. Deux
      medianes differentes dans le meme fichier : il faut les porter
      separement, et c'est exactement le genre de detail qu'une relecture
      rapide aligne par erreur.

   4. LES PRIX NE SE COMPARENT QU'A CONDITIONNEMENT EGAL. Une cuvee vendue en
      75 cl et en magnum a deux prix qui n'ont rien a voir ; le moteur ne
      retient que le conditionnement DOMINANT. Une cuvee en porte deux ici.

   5. UNE CUVEE QUI TIENT A UN SEUL CLIENT doit sortir en alerte, et une ligne
      sans nom de produit doit se ranger quelque part plutot que disparaitre.
   --------------------------------------------------------------------------- */
const CUV = (nom, mil, cond, pu, qte, jour, client) =>
  vente(client, 'Acheteur ' + client.slice(-1), jour, pu * qte,
        { qte, produit: nom + ' ' + mil, millesime: mil, conditionnement: cond });

/* Deux millesimes de la meme cuvee : le 2024 s'eteint, le 2025 monte. La cuvee,
   elle, ne doit presque pas bouger. */
for (let i = 0; i < 6; i++) {
  CUV('Le Rosé', '2024', '75cl', 10 + i, 20, jourDe(2025, 3 + i, 10), 'V-' + (i % 3));
  CUV('Le Rosé', '2025', '75cl', 11 + i, 22, jourDe(2026, 2 + i, 10), 'V-' + (i % 3));
}
/* Prix reguliers de 8 a 20 euros sur douze ventes : les bornes des quantiles
   tombent PILE entre deux valeurs, ce qui est la seule facon de voir un cran
   d'ecart entre deux conventions. */
for (let i = 0; i < 12; i++)
  CUV('Le Blanc', '2025', '75cl', 8 + i, 30, jourDe(2026, 1 + (i % 8), 5 + i), 'V-' + (i % 4));
/* La meme cuvee en magnum, plus chere et moins vendue : le conditionnement
   dominant reste le 75 cl, et les prix du magnum ne doivent PAS entrer dans la
   fourchette. */
for (let i = 0; i < 3; i++)
  CUV('Le Blanc', '2025', 'Magnum', 45 + i, 4, jourDe(2026, 4 + i, 20), 'V-0');

/* Une cuvee qui tient a un seul client : il doit peser assez pour declencher
   l'alerte de dependance. */
for (let i = 0; i < 5; i++)
  CUV('Le Rouge de Garde', '2023', '75cl', 30, 40, jourDe(2026, 1 + i, 8), 'V-9');
CUV('Le Rouge de Garde', '2023', '75cl', 30, 5, jourDe(2026, 6, 8), 'V-8');

/* Une ligne SANS NOM DE PRODUIT. Elle doit se ranger quelque part plutot que
   disparaitre du total : une cuvee qui s'evapore, c'est un chiffre d'affaires
   qui ne boucle plus. */
vente('V-7', 'Acheteur 7', jourDe(2026, 5, 3), 240, { qte: 12, produit: '', millesime: '' });

export const LIGNES = lignes;
export default LIGNES;

/* ===========================================================================
   LA MEME FIXTURE, VUE PAR LE SERVEUR

   Le navigateur recoit des lignes deja derivees ; le serveur, lui, part du
   BRUT : le tableau de 43 colonnes tel que l'export du logiciel de facturation
   le pose, et c'est le declencheur de `ventes_lignes` qui en tire les colonnes
   typees. Emettre les deux depuis le MEME fichier est tout l'interet : si
   j'avais ecrit deux jeux d'essai, ils auraient fini par diverger, et le banc
   aurait compare deux bases en croyant en comparer une.

   Les indices viennent de `ventes_lignes_suivre()`, lot 23. Ils sont ecrits
   ici en clair parce qu'un decalage d'une case ne se voit pas : mettre la
   quantite la ou le serveur attend le code tarif ne fait pas d'erreur, ca fait
   des chiffres.
   =========================================================================== */
const JJMMAAAA = (j) => { const d = dateDe(j);
  return String(d.d).padStart(2,'0') + '/' + String(d.m).padStart(2,'0') + '/' + d.y; };
/* Les nombres partent en francais, avec la virgule : c'est ce que `bdv_nombre`
   attend, et c'est ce que le vrai export envoie. */
const FR = (n) => String(n).replace('.', ',');

export function brutDe(l) {
  const b = new Array(43).fill('');
  b[0]  = JJMMAAAA(l.jour);        // date
  b[1]  = l.facture;               // numFacture
  b[2]  = l.produit;               // produit
  b[4]  = l.famille;               // famille   -> decide de horsCA
  b[5]  = l.conditionnement;       // conditionnement
  b[11] = 'AOC Témoin';            // appellation
  b[12] = 'Rouge';                 // couleur
  b[13] = l.millesime;             // millesime
  b[14] = FR(Math.round((l.qte ? l.total / l.qte : l.total) * 10000) / 10000);  // puHT
  b[15] = FR(l.total);             // totalHT
  b[16] = l.nom;                   // client
  b[17] = l.id;                    // numClient -> client_cle
  b[19] = FR(l.qte);               // quantite
  b[20] = l.typeClient;            // codeTarif -> champType du classement
  b[30] = 'France';                // pays
  b[32] = l.ville;                 // ville
  b[33] = '44000';                 // cp
  return b;
}

/* Le classement du bureau d'essai. Il est ecrit ICI et pas dans le SQL, pour
   que la fixture porte sa propre definition de ce qui est une vente : les
   correspondances de typologie sont l'identite, donc le `_typeClient` que le
   navigateur recoit tout fait et celui que le serveur derive sont le meme mot,
   et non deux mots qui se ressemblent. */
export const CLASSEMENT = {
  valide: true,
  horsCA: { [HORS_CA]: true, 'Vin': false },
  gratuit: {},
  champCanal: 'lieuVente', canaux: {},
  champType: 'codeTarif',
  types: { 'Caviste': 'Caviste', 'Particulier': 'Particulier', 'Restaurant': 'Restaurant' }
};
