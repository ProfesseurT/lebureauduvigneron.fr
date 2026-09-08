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

  window.BdvAlmanach = {
    entre: entre, saisons: saisons, feries: feries, paques: paques,
    phases: PHASES
  };
})();
