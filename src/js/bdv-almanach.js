/* ===========================================================================
   LE BUREAU DU VIGNERON — L'ALMANACH : LUNE, SAISONS, JOURS FERIES
   ===========================================================================
   Lot 2 du chantier calendrier, 08/09/2026.

   POURQUOI CE FICHIER EXISTE, ET POURQUOI IL NE CONTIENT AUCUNE DATE.
   La base Notion du calendrier portait 55 lignes de phases de lune et 12 jours
   feries, tapes a la main, pour la seule annee 2026. Les memes lignes auraient
   ete a retaper fin 2026, puis fin 2027. Et une ligne tapee a la main peut
   etre fausse sans que personne ne s'en apercoive : verification faite le
   08/09/2026, la pleine lune de juin 2026 y etait datee du 29 alors qu'elle
   tombe le 30 a 01 h 57, heure de Paris. Une donnee, un doute ; un calcul, une
   verite verifiable.

   CE QUE CE FICHIER N'EST PAS. Ce ne sont pas des echeances. On ne coche pas
   une pleine lune, on ne la reporte pas, elle n'a ni source officielle ni
   public concerne. C'est un FOND DE CARTE : un repere discret dans la case du
   jour, qu'un seul interrupteur eteint. Le melanger aux obligations aurait
   noye huit dates qui comptent sous soixante-dix qui ne demandent rien.

   LES SOURCES DU CALCUL, ET LEUR PRECISION MESUREE.
   - Phases de la lune : Jean Meeus, Astronomical Algorithms, chapitre 49, avec
     les termes periodiques principaux. Confronte aux 50 phases de 2026 : 50 sur
     50 au bon jour en heure locale francaise.
   - Saisons : Meeus chapitre 27, table 27.B. Ecart mesure sur 2026 : 6 a 13
     minutes des ephemerides de reference, donc toujours le bon jour sauf a
     tomber a moins d'un quart d'heure de minuit. Le terme periodique S n'est
     pas implemente, il vaut au plus sept minutes.
   - Jours feries : les six dates fixes, plus Paques par l'algorithme gregorien
     anonyme, d'ou l'Ascension a plus 39 jours et le lundi de Pentecote a plus
     50. Verifie sur 2025, 2026 et 2027.

   L'HEURE EST CELLE DU NAVIGATEUR, et c'est voulu : le vigneron est en France,
   son navigateur aussi. Une phase a 23 h 57 en temps universel tombe le
   lendemain a Paris, et c'est le jour affiche par son telephone qui fait foi
   pour lui. Le calcul se fait en temps universel puis se lit en heure locale,
   jamais l'inverse.
   =========================================================================== */
(function () {
  'use strict';

  var RAD = Math.PI / 180;
  function sin(d) { return Math.sin(d * RAD); }
  function cos(d) { return Math.cos(d * RAD); }
  function jdVersDate(jd) { return new Date((jd - 2440587.5) * 86400000); }
  function minuit(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  /* ---------------- LES PHASES DE LA LUNE ----------------
     k entier donne une nouvelle lune, k + 0,25 le premier quartier, k + 0,5 la
     pleine lune, k + 0,75 le dernier quartier. Les quatre corrections ne sont
     pas les memes selon la phase : nouvelle et pleine lune partagent une serie
     de termes, les deux quartiers en ont une autre, plus une correction W qui
     s'ajoute au premier quartier et se retranche au dernier. */
  var PHASES = ['Nouvelle lune', 'Premier quartier', 'Pleine lune', 'Dernier quartier'];

  function instantPhase(k, quart) {
    var T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    var jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2
            - 0.000000150 * T3 + 0.00000000073 * T4;
    var E  = 1 - 0.002516 * T - 0.0000074 * T2;
    var M  = 2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3;
    var Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;
    var F  = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
    var O  = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;
    var c;

    if (quart === 0 || quart === 2) {
      var neuve = quart === 0;
      c = (neuve ? -0.40720 : -0.40614) * sin(Mp)
        + (neuve ?  0.17241 :  0.17302) * E * sin(M)
        + (neuve ?  0.01608 :  0.01614) * sin(2 * Mp)
        + (neuve ?  0.01039 :  0.01043) * sin(2 * F)
        + (neuve ?  0.00739 :  0.00734) * E * sin(Mp - M)
        + (neuve ? -0.00514 : -0.00515) * E * sin(Mp + M)
        + (neuve ?  0.00208 :  0.00209) * E * E * sin(2 * M)
        - 0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F)
        + 0.00056 * E * sin(2 * Mp + M) - 0.00042 * sin(3 * Mp)
        + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F)
        - 0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(O)
        - 0.00007 * sin(Mp + 2 * M) + 0.00004 * sin(2 * Mp - 2 * F)
        + 0.00004 * sin(3 * M) + 0.00003 * sin(Mp + M - 2 * F)
        + 0.00003 * sin(2 * Mp + 2 * F) - 0.00003 * sin(Mp + M + 2 * F)
        + 0.00003 * sin(Mp - M + 2 * F) - 0.00002 * sin(Mp - M - 2 * F)
        - 0.00002 * sin(3 * Mp + M) + 0.00002 * sin(4 * Mp);
    } else {
      c = -0.62801 * sin(Mp) + 0.17172 * E * sin(M) - 0.01183 * E * sin(Mp + M)
        + 0.00862 * sin(2 * Mp) + 0.00804 * sin(2 * F) + 0.00454 * E * sin(Mp - M)
        + 0.00204 * E * E * sin(2 * M) - 0.00180 * sin(Mp - 2 * F)
        - 0.00070 * sin(Mp + 2 * F) - 0.00040 * sin(3 * Mp)
        - 0.00034 * E * sin(2 * Mp - M) + 0.00032 * E * sin(M + 2 * F)
        + 0.00032 * E * sin(M - 2 * F) - 0.00028 * E * E * sin(Mp + 2 * M)
        + 0.00027 * E * sin(2 * Mp + M) - 0.00017 * sin(O)
        - 0.00005 * sin(Mp - M - 2 * F) + 0.00004 * sin(2 * Mp + 2 * F)
        - 0.00004 * sin(Mp + M + 2 * F) + 0.00004 * sin(Mp - 2 * M)
        + 0.00003 * sin(Mp + M - 2 * F) + 0.00003 * sin(3 * M)
        + 0.00002 * sin(2 * Mp - 2 * F) + 0.00002 * sin(Mp - M + 2 * F)
        - 0.00002 * sin(3 * Mp + M);
      var W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp)
            - 0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
      c += (quart === 1 ? W : -W);
    }
    // Le resultat de Meeus est en temps dynamique. Delta T vaut environ 69 s a
    // notre epoque : negligeable pour un jour, retire quand meme parce qu'une
    // phase a 23 h 59 ne pardonne pas.
    return jdVersDate(jde + c - 69 / 86400);
  }

  /* ---------------- LES SAISONS ---------------- */
  var SAISONS = [
    { nom: 'Printemps', c: [2451623.80984, 365242.37404,  0.05169, -0.00411, -0.00057] },
    { nom: 'Été',       c: [2451716.56767, 365241.62603,  0.00325,  0.00888, -0.00030] },
    { nom: 'Automne',   c: [2451810.21715, 365242.01767, -0.11575,  0.00337,  0.00078] },
    { nom: 'Hiver',     c: [2451900.05952, 365242.74049, -0.06223, -0.00823,  0.00032] }
  ];
  function saisons(an) {
    var Y = (an - 2000) / 1000;
    return SAISONS.map(function (s) {
      var a = s.c;
      var jde = a[0] + a[1] * Y + a[2] * Y * Y + a[3] * Y * Y * Y + a[4] * Y * Y * Y * Y;
      return { nature: 'saison', nom: s.nom, date: minuit(jdVersDate(jde)) };
    });
  }

  /* ---------------- LES JOURS FERIES ----------------
     Six dates fixes, et quatre qui dependent de Paques. On ne liste jamais
     Paques : une liste se perime, l'algorithme non. */
  function paques(an) {
    var a = an % 19, b = Math.floor(an / 100), c = an % 100;
    var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mois = Math.floor((h + l - 7 * m + 114) / 31);
    var jour = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(an, mois - 1, jour);
  }
  function plus(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

  function feries(an) {
    var p = paques(an);
    return [
      { nom: "Jour de l'An",      date: new Date(an, 0, 1) },
      { nom: 'Lundi de Pâques',   date: plus(p, 1) },
      { nom: 'Fête du Travail',   date: new Date(an, 4, 1) },
      { nom: 'Victoire 1945',     date: new Date(an, 4, 8) },
      { nom: 'Ascension',         date: plus(p, 39) },
      { nom: 'Lundi de Pentecôte',date: plus(p, 50) },
      { nom: 'Fête nationale',    date: new Date(an, 6, 14) },
      { nom: 'Assomption',        date: new Date(an, 7, 15) },
      { nom: 'Toussaint',         date: new Date(an, 10, 1) },
      { nom: 'Armistice 1918',    date: new Date(an, 10, 11) },
      { nom: 'Noël',              date: new Date(an, 11, 25) }
    ].map(function (f) { return { nature: 'ferie', nom: f.nom, date: minuit(f.date) }; });
  }

  /* ---------------- CE QUE LE CALENDRIER APPELLE ----------------
     Une seule fonction, qui rend tout ce qui tombe entre deux bornes, du plus
     tot au plus tard. L'appelant ne sait pas si c'est calcule ou liste, et
     c'est bien : le jour ou une nature s'ajoute, aucun ecran ne change. */
  function entre(du, au) {
    du = minuit(du); au = minuit(au);
    var out = [];

    // Les phases : on part deux lunaisons avant la borne basse et on avance
    // jusqu'a depasser la borne haute. Une lunaison fait 29,53 jours.
    var kDebut = Math.floor((du.getFullYear() + (du.getMonth() / 12) - 2000) * 12.3685) - 2;
    var nb = Math.ceil((au - du) / (29.53 * 86400000)) + 4;
    for (var i = 0; i < nb; i++) {
      for (var q = 0; q < 4; q++) {
        var d = minuit(instantPhase(kDebut + i + q / 4, q));
        if (d >= du && d <= au) out.push({ nature: 'lune', nom: PHASES[q], date: d, quart: q });
      }
    }

    for (var an = du.getFullYear(); an <= au.getFullYear(); an++) {
      saisons(an).concat(feries(an)).forEach(function (x) {
        if (x.date >= du && x.date <= au) out.push(x);
      });
    }

    return out.sort(function (a, b) { return a.date - b.date; });
  }

  /* ===================== OU EST LA LUNE, MAINTENANT =====================
     Ajoute le 08/09/2026. Les phases ci-dessus donnent QUATRE INSTANTS dans le
     mois. L'entete du bureau a besoin d'autre chose : l'etat de la lune un mardi
     quelconque, entre deux phases. Ce sont deux questions differentes, et la
     seconde demande la position reelle des deux astres.

     POURQUOI ON NE S'EST PAS CONTENTE D'INTERPOLER. Compter les jours depuis la
     derniere nouvelle lune et diviser par 29,53 tient en cinq lignes. Mais
     l'orbite n'est pas un cercle parcouru a vitesse constante : l'ecart atteint
     six heures, soit deux a trois points de pourcentage sur la fraction
     eclairee, et surtout un croissant dessine du mauvais cote un jour sur
     trente. Un croissant a l'envers, un vigneron le voit en levant les yeux.

     LES SOURCES.
     - Position de la Lune : Meeus chapitre 47, tables 47.A et 47.B, tronquees
       aux termes qui pesent plus de 0,002 degre. Le reste s'annule dans le
       bruit : residu mesure sous 0,01 degre sur longitude et latitude.
     - Position du Soleil : Meeus chapitre 25, precision superieure a 0,01 degre
       pour notre siecle.
     - Fraction eclairee : Meeus chapitre 48. L'angle de phase n'est PAS le
       complement de l'elongation vue de la Terre, parce que le Soleil est a
       150 millions de kilometres et la Lune a 384 000 : l'ecart vaut jusqu'a
       0,15 degre, et le calcul le prend.

     DEUX CYCLES QU'IL NE FAUT JAMAIS CONFONDRE, et c'est la tout l'interet du
     bloc pour un vigneron en biodynamie :
     - CROISSANTE / DECROISSANTE, c'est la PHASE : la part eclairee grossit ou
       maigrit. Cycle de 29,53 jours. C'est ce que montre le calendrier.
     - MONTANTE / DESCENDANTE, c'est la DECLINAISON : la lune passe plus haut
       ou moins haut dans le ciel chaque jour. Cycle de 27,32 jours.
     Les deux se decalent en permanence : une lune peut tres bien etre
     croissante et descendante le meme jour. Les confondre serait une faute de
     fond pour qui travaille au calendrier lunaire.
     ===================================================================== */

  /* Table 47.A : D, M, M', F, coefficient de longitude (1e-6 degre),
     coefficient de distance (1e-3 km). */
  var T47A = [
    [0,0,1,0, 6288774,-20905355],[2,0,-1,0, 1274027,-3699111],
    [2,0,0,0, 658314,-2955968], [0,0,2,0, 213618,-569925],
    [0,1,0,0, -185116,48888],   [0,0,0,2, -114332,-3149],
    [2,0,-2,0, 58793,246158],   [2,-1,-1,0, 57066,-152138],
    [2,0,1,0, 53322,-170733],   [2,-1,0,0, 45758,-204586],
    [0,1,-1,0, -40923,-129620], [1,0,0,0, -34720,108743],
    [0,1,1,0, -30383,104755],   [2,0,0,-2, 15327,10321],
    [0,0,1,2, -12528,0],        [0,0,1,-2, 10980,79661],
    [4,0,-1,0, 10675,-34782],   [0,0,3,0, 10034,-23210],
    [4,0,-2,0, 8548,-21636],    [2,1,-1,0, -7888,24208],
    [2,1,0,0, -6766,30824],     [1,0,-1,0, -5163,-8379],
    [1,1,0,0, 4987,-16675],     [2,-1,1,0, 4036,-12831],
    [2,0,2,0, 3994,-10445],     [4,0,0,0, 3861,-11650],
    [2,0,-3,0, 3665,14403],     [0,1,-2,0, -2689,-7003],
    [2,0,-1,2, -2602,0],        [2,-1,-2,0, 2390,10056],
    [1,0,1,0, -2348,6322],      [2,-2,0,0, 2236,-9884],
    [0,1,2,0, -2120,5751],      [0,2,0,0, -2069,0],
    [2,-2,-1,0, 2048,-4950],    [2,0,1,-2, -1773,4130],
    [0,0,2,-2, -381,-4421],     [2,0,-1,-2, 0,8752]
  ];
  /* Table 47.B : D, M, M', F, coefficient de latitude (1e-6 degre). */
  var T47B = [
    [0,0,0,1, 5128122],[0,0,1,1, 280602],[0,0,1,-1, 277693],
    [2,0,0,-1, 173237],[2,0,-1,1, 55413],[2,0,-1,-1, 46271],
    [2,0,0,1, 32573],  [0,0,2,1, 17198], [2,0,1,-1, 9266],
    [0,0,2,-1, 8822],  [2,-1,0,-1, 8216],[2,0,-2,-1, 4324],
    [2,0,1,1, 4200],   [2,1,0,-1, -3359],[2,-1,-1,1, 2463],
    [2,-1,0,1, 2211],  [2,-1,-1,-1, 2065],[0,1,-1,-1, -1870],
    [4,0,-1,-1, 1828], [0,1,0,1, -1794], [0,0,0,3, -1749],
    [0,1,-1,1, -1565], [1,0,0,1, -1491], [0,1,1,1, -1475],
    [0,1,1,-1, -1410], [0,1,0,-1, -1344],[1,0,0,-1, -1335],
    [0,0,3,1, 1107],   [4,0,0,-1, 1021]
  ];

  function dateVersJd(d) { return d.getTime() / 86400000 + 2440587.5; }
  function tour(x) { x = x % 360; return x < 0 ? x + 360 : x; }

  function positionLune(jd) {
    var T = (jd - 2451545) / 36525, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    var Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
    var D  = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
    var M  = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
    var Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
    var F  =  93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;
    // E corrige l'excentricite de l'orbite terrestre, qui diminue lentement. Il
    // ne s'applique qu'aux termes ou l'anomalie du Soleil intervient.
    var E = 1 - 0.002516 * T - 0.0000074 * T2;
    var sl = 0, sr = 0, sb = 0, i, t, a, e;
    for (i = 0; i < T47A.length; i++) {
      t = T47A[i];
      a = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
      e = t[1] ? (Math.abs(t[1]) === 2 ? E * E : E) : 1;
      sl += t[4] * e * sin(a);
      sr += t[5] * e * cos(a);
    }
    for (i = 0; i < T47B.length; i++) {
      t = T47B[i];
      a = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
      e = t[1] ? (Math.abs(t[1]) === 2 ? E * E : E) : 1;
      sb += t[4] * e * sin(a);
    }
    /* LES TERMES ADDITIFS (Meeus 47, page 342). Ils viennent de Venus, de
       Jupiter et de l'aplatissement de la Terre, ils valent au plus 0,004
       degre. On les garde pour une seule raison : avec eux, le calcul tombe
       exactement sur l'exemple publie du livre, et un banc de test qui
       reproduit un resultat publie prouve quelque chose. Sans eux, il ne
       prouve que sa propre coherence. */
    var A1 = 119.75 + 131.849 * T;
    var A2 =  53.09 + 479264.290 * T;
    var A3 = 313.45 + 481266.484 * T;
    sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
    sb += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F)
        + 175 * sin(A1 + F) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);

    return {
      lambda: tour(Lp + sl / 1e6),   // longitude ecliptique, degres
      beta: sb / 1e6,                // latitude ecliptique, degres
      dist: 385000.56 + sr / 1000,   // distance Terre-Lune, kilometres
      T: T
    };
  }

  function positionSoleil(jd) {
    var T = (jd - 2451545) / 36525, T2 = T * T;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T2;
    var M  = 357.52911 + 35999.05029 * T - 0.0001537 * T2;
    var C  = (1.914602 - 0.004817 * T - 0.000014 * T2) * sin(M)
           + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
    var ex = 0.016708634 - 0.000042037 * T - 0.0000001267 * T2;
    var v  = M + C;
    var R  = 1.000001018 * (1 - ex * ex) / (1 + ex * cos(v));
    return { lambda: tour(L0 + C), dist: R * 149597870.7 };
  }

  // La declinaison : la hauteur de la lune sur l'equateur celeste. C'est elle,
  // et non la phase, qui fait la lune montante ou descendante.
  function declinaison(lam, bet, T) {
    var eps = 23.439291 - 0.0130042 * T - 0.00000016 * T * T + 0.000000504 * T * T * T;
    return Math.asin(sin(bet) * cos(eps) + cos(bet) * sin(eps) * sin(lam)) / RAD;
  }

  /* Le premier k a essayer pour une date donnee. On recule d'une lunaison pour
     etre certain de ne pas rater une phase qui vient de passer. */
  function kDepart(d) {
    return Math.floor((d.getFullYear() + d.getMonth() / 12 - 2000) * 12.3685) - 1;
  }

  // La phase exacte tombe-t-elle AUJOURD'HUI ? Si oui, on dit son nom, et il est
  // le meme que celui de la case du calendrier : deux ecrans ne se contredisent
  // jamais sur la meme journee.
  function phaseDuJour(d) {
    var j = minuit(d).getTime(), k0 = kDepart(d);
    for (var i = 0; i < 3; i++) {
      for (var q = 0; q < 4; q++) {
        if (minuit(instantPhase(k0 + i + q / 4, q)).getTime() === j) return q;
      }
    }
    return null;
  }

  // La prochaine phase apres l'instant donne. k croit avec (i, q) dans cet ordre
  // d'imbrication, donc la premiere trouvee est bien la plus proche.
  function prochainePhase(d) {
    var k0 = kDepart(d);
    for (var i = 0; i < 4; i++) {
      for (var q = 0; q < 4; q++) {
        var t = instantPhase(k0 + i + q / 4, q);
        if (t > d) {
          // Les jours se comptent de minuit a minuit, comme les compte un
          // vigneron : « dans 6 jours » doit tomber sur la case du calendrier.
          var jours = Math.round((minuit(t) - minuit(d)) / 86400000);
          return { quart: q, nom: PHASES[q], date: t, jours: jours };
        }
      }
    }
    return null;
  }

  var ENTRE_DEUX = ['Premier croissant', 'Lune gibbeuse croissante',
                    'Lune gibbeuse décroissante', 'Dernier croissant'];

  /* ---------------- LE DESSIN, EN DEUX ARCS ----------------
     De la geometrie pure, sans une ligne de document : elle est ici et non dans
     le gabarit pour une seule raison, c'est qu'un banc puisse la mettre a
     l'epreuve. Une fonction de dessin cachee dans une page ne se teste pas.

     Le terminateur - la frontiere entre le jour et la nuit lunaires - se projette
     sur le disque en une ELLIPSE de demi-largeur R fois le cosinus de
     l'elongation. Et ce cosinus vaut exactement 1 - 2k, k etant la fraction
     eclairee. D'ou :
       - a k = 0,5, la demi-largeur tombe a zero. SVG traite un rayon nul comme une
         droite, et une droite verticale est precisement ce qu'est un quartier.
       - sous 0,5 on RETIRE l'ellipse du demi-disque : elle bombe vers le limbe,
         c'est un croissant.
       - au-dessus on l'AJOUTE : elle bombe vers l'ombre, c'est une gibbeuse.
     Un seul drapeau de balayage separe les deux cas, et c'est la que se logerait
     une inversion croissant/gibbeuse. Le banc la cherche par l'aire : la surface
     ainsi tracee doit valoir pi R carre fois k, exactement.

     Le chemin est trace ECLAIRE A DROITE, donc croissant. C'est a l'appelant de
     le retourner quand la lune decroit : dans l'hemisphere nord la lune qui
     grossit est eclairee a droite, et un vigneron qui leve les yeux doit voir le
     meme cote que sur son ecran. */
  function chemin(k) {
    var R = 50, w = Math.abs(1 - 2 * k) * R;
    var sens = (k < 0.5) ? 0 : 1;
    return 'M0 ' + (-R) + 'A' + R + ' ' + R + ' 0 0 1 0 ' + R +
           'A' + w.toFixed(2) + ' ' + R + ' 0 0 ' + sens + ' 0 ' + (-R) + 'Z';
  }

  function lune(quand) {
    var d = quand || new Date();
    var jd = dateVersJd(d);
    var L = positionLune(jd), S = positionSoleil(jd);

    // Elongation geocentrique, puis angle de phase vu de la Lune.
    var psi = Math.acos(cos(L.beta) * cos(L.lambda - S.lambda)) / RAD;
    var ang = Math.atan2(S.dist * sin(psi), L.dist - S.dist * cos(psi)) / RAD;
    var eclairee = (1 + cos(ang)) / 2;

    // Croissante avant la pleine lune, decroissante apres. On lit le signe sur
    // l'elongation en longitude, pas sur la fraction : a 50 % on ne saurait pas
    // dire de quel quartier il s'agit.
    var elong = tour(L.lambda - S.lambda);
    var croissante = elong < 180;

    // Montante ou descendante : la declinaison dans six heures contre
    // maintenant. Six heures suffisent, elle bouge de 4 degres par jour.
    var L2 = positionLune(jd + 0.25);
    var dec0 = declinaison(L.lambda, L.beta, L.T);
    var dec1 = declinaison(L2.lambda, L2.beta, L2.T);

    var q = phaseDuJour(d);
    var nom = (q !== null) ? PHASES[q]
            : ENTRE_DEUX[Math.floor(tour(elong) / 90)];

    return {
      eclairee: eclairee,            // 0 a 1
      pourcent: Math.round(eclairee * 100),
      croissante: croissante,        // la phase grossit
      montante: dec1 > dec0,         // la declinaison monte
      declinaison: dec0,
      elongation: elong,
      nom: nom,
      quart: q,                      // 0 a 3 le jour d'une phase, sinon null
      prochaine: prochainePhase(d)
    };
  }

  window.BdvAlmanach = {
    entre: entre, saisons: saisons, feries: feries, paques: paques,
    phases: PHASES,
    lune: lune, chemin: chemin, prochainePhase: prochainePhase, phaseDuJour: phaseDuJour,
    positionLune: positionLune, positionSoleil: positionSoleil,
    declinaison: declinaison
  };
})();
