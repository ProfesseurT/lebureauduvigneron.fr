/* ===========================================================================
   LE BUREAU DU VIGNERON — LA PIECE « LE CALENDRIER »
   ===========================================================================
   Lot 1 puis lot 2 du chantier calendrier, 08/09/2026. Voir PLAN_calendrier.md
   pour les arbitrages tranches avec Ted avant la premiere ligne de code.

   CE QUE CETTE PIECE CORRIGE D'ABORD. Jusqu'au 08/09/2026, cliquer sur « Le
   calendrier » dans la barre du bureau EJECTAIT hors du bureau, vers la page
   publique /outils/echeances/, qui n'a pas les intercalaires. C'etait la seule
   piece de la barre a faire ca, et c'est ce que Ted a signale.

   CE FICHIER NE CALCULE AUCUNE DATE, ET C'EST LA REGLE. Les recurrences vivent
   dans bdv-echeances.js, la lune et les jours feries dans bdv-almanach.js.
   Une deuxieme copie ici aurait diverge, et la divergence se serait vue des
   mois plus tard, sur un chiffre de jours faux, sans qu'aucun controle ne la
   signale.

   IL N'ECRIT PAS NON PLUS DANS LA TABLE DES TACHES. Cocher une obligation passe
   par BdvTaches.basculerOccurrence(), qui construit la ligne lui-meme. Motif :
   l'identifiant d'occurrence `ech:drm:2026-09-10` doit rester le meme vu du
   calendrier et vu de « Mes taches », sinon les deux pieces se contrediraient
   au premier geste pose d'un cote. Un seul stockage, deux vitres.

   TROIS VUES, ET UNE QUATRIEME ECARTEE.
     - Le mois : la grille editoriale, vue par defaut. La grille en haut, et le
       detail des occurrences du mois EN DESSOUS : une case de calendrier est
       trop etroite pour porter un intitule, un public et une source, et un
       calendrier qui n'affiche que des sigles ne sert a personne.
     - L'annee : douze mini-mois sur un ecran. Elle repond a « a quoi ressemble
       mon annee », qui est la question d'un vigneron en janvier.
     - La liste : le compte a rebours de la page publique, inchange.
     - La semaine, ECARTEE : un agenda de semaine est une grille d'heures, et
       aucune occurrence de ce calendrier n'en porte. Ce serait un emploi du
       temps vide.

   LOT 2 : QUATRE FAMILLES, ET UN FOND DE CARTE QUI N'EN EST PAS UNE.
   Les familles se filtrent, se cochent, portent une source. Le fond de carte,
   lune, saisons et jours feries, ne se coche pas : on ne coche pas une pleine
   lune. Un seul interrupteur l'eteint, et il est dessine comme un fond, pas
   comme une occurrence. Les melanger aurait noye huit dates qui comptent sous
   soixante-dix qui ne demandent rien.

   AUCUN TEXTE NE PASSE PAR UNE CHAINE HTML. Les enveloppes sont construites
   ici, les textes poses en textContent. Regle du bureau, et elle n'est pas
   cosmetique : le lot 3 ouvrira ce calendrier aux occurrences ecrites par le
   vigneron lui-meme, et ce jour-la il sera trop tard pour y penser.
   =========================================================================== */
(function () {
  'use strict';

  var VUE_KEY  = 'bdv_cal_vue';
  var FAM_KEY  = 'bdv_cal_familles';
  var FOND_KEY = 'bdv_cal_fond';
  var VUES = ['mois', 'annee', 'liste'];

  /* Les jours commencent LUNDI. getDay() de JavaScript commence dimanche : la
     conversion se fait une seule fois, dans lundi0(), et jamais ailleurs. */
  var JOURS = [
    { court: 'lun', long: 'lundi' }, { court: 'mar', long: 'mardi' },
    { court: 'mer', long: 'mercredi' }, { court: 'jeu', long: 'jeudi' },
    { court: 'ven', long: 'vendredi' }, { court: 'sam', long: 'samedi' },
    { court: 'dim', long: 'dimanche' }
  ];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  var vue = 'mois';
  var curseur = null;      // le premier jour du mois affiche
  var familles = null;     // les cles actives, null = pas encore lu
  var fond = true;         // le fond de carte est-il allume
  var branche = false;

  /* ---------------- LES OUTILS DE DATE ----------------
     Les memes conventions que bdv-echeances.js et bdv-taches.js : minuit local,
     jamais UTC. Une echeance tombe un jour, pas a une heure, et melanger les
     deux fait sauter une journee sur les fuseaux a l'est de Greenwich. */
  function minuit(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function aujourdhui() { return minuit(new Date()); }
  function premierDuMois(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function plusJours(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function lundi0(d) { return (d.getDay() + 6) % 7; }
  function memeJour(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
  }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }

  function el(id) { return document.getElementById(id); }

  /* ---------------- LES DONNEES ----------------
     Le bloc JSON de la page, lu par le module de calcul. Ni cache ni copie : le
     lot 3 y ajoutera les occurrences du vigneron, et un cache pose ici serait
     le premier endroit a mentir. */
  function toutesLesRegles() {
    return window.BdvEcheances ? BdvEcheances.depuisLaPage('bdvEcheances') : [];
  }
  function reglesActives() {
    var f = famillesActives();
    return toutesLesRegles().filter(function (e) {
      return f.indexOf(e.famille || 'obligations') >= 0;
    });
  }
  function etaler(du, au) {
    if (!window.BdvEcheances || !BdvEcheances.etaler) return [];
    return BdvEcheances.etaler(reglesActives(), du, au);
  }
  function lesFamilles() {
    return (window.BdvEcheances && BdvEcheances.familles) || [];
  }

  /* ---------------- LE PONT AVEC « MES TACHES » ----------------
     Le calendrier montre l'etat, il ne le stocke pas. Sans le module des
     taches, ou sans compte, la coche disparait au lieu de mentir : une case a
     cocher qui ne retient rien est pire qu'une case absente. */
  function tachesLa() {
    return !!(window.BdvTaches && BdvTaches.basculerOccurrence && BdvTaches.estFaite);
  }
  function idOccurrence(cle, d) { return 'ech:' + cle + ':' + iso(d); }
  function faite(o) {
    return tachesLa() ? BdvTaches.estFaite(idOccurrence(o.e.cle, o.debut || o.date)) : false;
  }

  /* ---------------- CE QUI EST MEMORISE ----------------
     La vue, les familles allumees, le fond de carte. Dans le navigateur et pas
     en base : ce sont des preferences d'affichage, elles n'ont pas a suivre le
     vigneron d'un poste a l'autre, et les mettre en base aurait demande une
     colonne de plus a la table des reglages pour un confort. */
  function lireVue() {
    try {
      var v = localStorage.getItem(VUE_KEY);
      return VUES.indexOf(v) >= 0 ? v : 'mois';
    } catch (e) { return 'mois'; }
  }
  function ecrireVue(v) { try { localStorage.setItem(VUE_KEY, v); } catch (e) {} }

  /* TOUT EST ALLUME LE PREMIER JOUR, c'est la decision de Ted du 08/09/2026.
     Tout eteint, l'ecran d'accueil serait presque vide, et personne n'ouvre un
     ecran de reglages pour se creer du travail. Le vigneron eteint ce qui ne le
     concerne pas, et le geste est a un clic.

     ON ENREGISTRE CE QUI EST ETEINT, JAMAIS CE QUI EST ALLUME, et c'est ce qui
     rend la regle du dessus tenable dans le temps. Avec la liste des allumees,
     une cinquieme famille ajoutee plus tard serait absente de toutes les listes
     deja enregistrees, donc invisible a vie chez tous ceux qui ont touche au
     filtre une fois, sans erreur et sans que personne ne comprenne pourquoi. */
  function eteintes() {
    try {
      var brut = JSON.parse(localStorage.getItem(FAM_KEY));
      return Array.isArray(brut) ? brut : [];
    } catch (e) { return []; }
  }
  function famillesActives() {
    if (familles) return familles;
    var toutes = lesFamilles().map(function (f) { return f.cle; });
    var off = eteintes();
    familles = toutes.filter(function (c) { return off.indexOf(c) < 0; });
    if (!familles.length) familles = toutes;   // tout eteint n'a aucun interet
    return familles;
  }
  function basculerFamille(cle) {
    var off = eteintes(), i = off.indexOf(cle);
    if (i >= 0) off.splice(i, 1); else off.push(cle);
    // On ne laisse pas tout eteindre : un calendrier vide n'apprend rien, et le
    // vigneron n'aurait aucun indice sur la facon de le rallumer.
    if (off.length >= lesFamilles().length) return;
    try { localStorage.setItem(FAM_KEY, JSON.stringify(off)); } catch (e) {}
    familles = null;
    rendre();
  }
  function lireFond() {
    try { return localStorage.getItem(FOND_KEY) !== '0'; } catch (e) { return true; }
  }
  function basculerFond() {
    fond = !fond;
    try { localStorage.setItem(FOND_KEY, fond ? '1' : '0'); } catch (e) {}
    rendre();
  }

  /* ---------------- LE FOND DE CARTE ----------------
     Lune, saisons, jours feries. Calcules, jamais listes : la base Notion en
     portait 71 lignes tapees a la main pour la seule annee 2026, dont une
     fausse (la pleine lune de juin y etait datee du 29, elle tombe le 30 a
     01 h 57 heure de Paris). Cf. l'en-tete de bdv-almanach.js. */
  var SIGNES = ['●', '◑', '○', '◐'];   // nouvelle, 1er q., pleine, dernier q.
  function fondEntre(du, au) {
    if (!fond || !window.BdvAlmanach) return {};
    var par = {};
    BdvAlmanach.entre(du, au).forEach(function (x) {
      (par[iso(x.date)] = par[iso(x.date)] || []).push(x);
    });
    return par;
  }
  function poserFond(td, liste) {
    if (!liste || !liste.length) return;
    var box = document.createElement('span');
    box.className = 'calf';
    var titres = [];
    liste.forEach(function (x) {
      var s = document.createElement('span');
      s.className = 'calf__m';
      s.setAttribute('data-nature', x.nature);
      s.setAttribute('aria-hidden', 'true');
      if (x.nature === 'lune') s.textContent = SIGNES[x.quart];
      else if (x.nature === 'ferie') s.textContent = 'f';
      else s.textContent = '✲';
      box.appendChild(s);
      titres.push(x.nom);
    });
    /* Le titre porte les noms en clair : les signes de lune sont des caracteres
       decoratifs, ils sont masques aux lecteurs d'ecran, et sans ce titre
       l'information n'existerait que pour ceux qui savent lire un croissant. */
    box.title = titres.join(' · ');
    td.appendChild(box);
    if (liste.some(function (x) { return x.nature === 'ferie'; })) {
      td.setAttribute('data-ferie', 'oui');
    }
  }

  /* =========================================================================
     LA VUE MOIS
     -------------------------------------------------------------------------
     Un vrai <table>, et pas une grille de <div>. Un calendrier EST un tableau :
     une date se lit au croisement d'une semaine et d'un jour, un lecteur
     d'ecran doit pouvoir annoncer « mercredi 10 », et la page s'imprime.

     PIEGE DEJA PAYE UNE FOIS SUR CE SITE, cf. CLAUDE.md : ne jamais poser
     `display: block` sur une cellule. Elle sort de la mise en page du tableau,
     son fond se decale de quelques pixels et trace une bande claire en travers.
     La feuille de cette piece n'en pose aucun, et si une regle `.calm__c` doit
     s'ecrire, elle s'ecrit `td.calm__c`.

     CE QUI DURE PLUSIEURS JOURS PORTE SON INTITULE UNE FOIS PAR SEMAINE, au
     premier jour de la periode puis a chaque lundi. Les autres jours n'ont
     qu'un filet de continuation. Repeter « Taille de la vigne » dans cent cinq
     cases aurait rempli le mois d'un seul mot.
  ========================================================================= */
  function chipOccurrence(o, jour, avecTexte) {
    var li = document.createElement('li');
    li.className = 'calo';
    var estFaite = faite(o);
    li.setAttribute('data-fait', estFaite ? 'oui' : 'non');
    li.setAttribute('data-niveau', o.niveau);
    li.setAttribute('data-famille', o.famille);
    if (o.duree > 1) {
      li.setAttribute('data-long', 'oui');
      if (memeJour(jour, o.debut)) li.setAttribute('data-bord', 'debut');
      if (memeJour(jour, o.fin)) li.setAttribute('data-bord',
        memeJour(jour, o.debut) ? 'seul' : 'fin');
    }
    if (!avecTexte) {
      li.setAttribute('data-suite', 'oui');
      var barre = document.createElement('span');
      barre.className = 'calo__b';
      barre.setAttribute('aria-hidden', 'true');
      li.appendChild(barre);
      return li;
    }

    var libelle = o.e.titre;
    var infobulle = libelle + (o.periode ? ', ' + o.periode : ', ' + o.dateLongue);
    if (tachesLa()) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'calo__b';
      b.setAttribute('data-cal-coche', o.e.cle + '|' + iso(o.debut));
      b.setAttribute('data-cal-titre', o.e.titre);
      b.setAttribute('aria-pressed', estFaite ? 'true' : 'false');
      b.title = (estFaite ? 'Remettre à faire : ' : 'Marquer comme fait : ') + infobulle;
      b.setAttribute('aria-label', b.title);
      b.textContent = libelle;
      li.appendChild(b);
    } else {
      var s = document.createElement('span');
      s.className = 'calo__b';
      s.title = infobulle;
      s.textContent = libelle;
      li.appendChild(s);
    }
    return li;
  }

  function celluleJour(d, dansLeMois, occs, fondDuJour, ajd) {
    var td = document.createElement('td');
    td.className = 'calm__c';
    if (!dansLeMois) td.setAttribute('data-hors', 'oui');
    if (lundi0(d) >= 5) td.setAttribute('data-repos', 'oui');
    if (memeJour(d, ajd)) td.setAttribute('data-auj', 'oui');

    var tete = document.createElement('span');
    tete.className = 'calm__tete';
    var n = document.createElement('span');
    n.className = 'calm__n';
    n.textContent = String(d.getDate());
    tete.appendChild(n);
    poserFond(tete, fondDuJour);
    td.appendChild(tete);

    if (!occs.length) return td;

    var ul = document.createElement('ul');
    ul.className = 'calm__l';
    occs.forEach(function (o) {
      var avecTexte = memeJour(d, o.debut) || lundi0(d) === 0;
      ul.appendChild(chipOccurrence(o, d, avecTexte));
    });
    td.appendChild(ul);
    return td;
  }

  function vueMois(hote) {
    var ajd = aujourdhui();
    var debutMois = premierDuMois(curseur);
    var finMois = new Date(curseur.getFullYear(), curseur.getMonth() + 1, 0);

    /* La grille commence au lundi qui precede le 1er et finit au dimanche qui
       suit le dernier. On etale donc sur CETTE plage-la et pas sur le mois :
       une echeance du 31 aout doit apparaitre dans la premiere case de
       septembre, sinon elle disparait deux fois par an sans que personne ne
       comprenne pourquoi. */
    var depart = plusJours(debutMois, -lundi0(debutMois));
    var arrivee = plusJours(finMois, 6 - lundi0(finMois));

    var toutes = etaler(depart, arrivee);
    var lesFonds = fondEntre(depart, arrivee);

    /* Une occurrence longue est rangee dans CHAQUE jour qu'elle couvre. C'est
       ce qui fait le bandeau qui traverse la semaine. */
    var parJour = {};
    toutes.forEach(function (o) {
      var d = o.debut < depart ? new Date(depart) : new Date(o.debut);
      while (d <= o.fin && d <= arrivee) {
        (parJour[iso(d)] = parJour[iso(d)] || []).push(o);
        d = plusJours(d, 1);
      }
    });

    var table = document.createElement('table');
    table.className = 'calm';

    var thead = document.createElement('thead');
    var trh = document.createElement('tr');
    JOURS.forEach(function (j) {
      var th = document.createElement('th');
      th.scope = 'col';
      var ab = document.createElement('abbr');
      ab.title = j.long;
      ab.textContent = j.court;
      th.appendChild(ab);
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    var d = new Date(depart);
    while (d <= arrivee) {
      var tr = document.createElement('tr');
      for (var i = 0; i < 7; i++) {
        tr.appendChild(celluleJour(d, d.getMonth() === curseur.getMonth(),
                                   parJour[iso(d)] || [], lesFonds[iso(d)], ajd));
        d = plusJours(d, 1);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    hote.appendChild(table);

    /* LE DETAIL SOUS LA GRILLE. C'est ce qui fait la difference entre un
       calendrier et une decoration : la case dit qu'il y a quelque chose, la
       liste dit quoi, pour qui, et d'ou vient la date. */
    var duMois = toutes.filter(function (o) {
      return o.fin >= debutMois && o.debut <= finMois;
    });
    var sous = document.createElement('div');
    sous.className = 'cal__detail';
    var h = document.createElement('h3');
    h.className = 'cal__detailt';
    h.textContent = duMois.length
      ? (duMois.length > 1 ? 'Ce mois-ci, ' + duMois.length + ' dates' : 'Ce mois-ci, une date')
      : 'Ce mois-ci';
    sous.appendChild(h);
    if (!duMois.length) {
      var p = document.createElement('p');
      p.className = 'cal__vide';
      p.textContent = 'Rien ne tombe ce mois-ci. Sers-toi de ce répit.';
      sous.appendChild(p);
    } else {
      sous.appendChild(listeDe(duMois));
    }
    hote.appendChild(sous);
  }

  /* =========================================================================
     LA VUE ANNEE
     -------------------------------------------------------------------------
     Douze mini-mois. Elle ne cherche pas a dire CE QUI tombe, elle dit QUAND
     ca tombe : les mois pleins et les mois vides se voient d'un coup d'oeil,
     et c'est exactement ce qu'on veut savoir en janvier ou avant les vendanges.
     Cliquer sur un mois ouvre la vue mois sur ce mois-la.

     ELLE IGNORE LE FOND DE CARTE, et ce n'est pas un oubli : la lune touche un
     jour sur sept et les feries un de plus. Les poser ici remplirait douze
     grilles de trois centimetres, qui ne diraient plus rien du tout.
  ========================================================================= */
  function miniMois(an, mois, parJour, ajd) {
    var art = document.createElement('article');
    art.className = 'cala__m';

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cala__t';
    b.setAttribute('data-cal-mois', an + '-' + mois);
    b.textContent = MOIS[mois];
    b.title = 'Ouvrir ' + MOIS[mois] + ' ' + an + ' en grille';
    art.appendChild(b);

    var t = document.createElement('table');
    t.className = 'cala__g';
    var thead = document.createElement('thead');
    var trh = document.createElement('tr');
    JOURS.forEach(function (j) {
      var th = document.createElement('th');
      th.scope = 'col';
      var ab = document.createElement('abbr');
      ab.title = j.long;
      /* Une seule lettre : douze grilles sur un ecran ne laissent pas la place
         de trois. L'abbr porte le jour entier pour les lecteurs d'ecran. */
      ab.textContent = j.court.charAt(0);
      th.appendChild(ab);
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    t.appendChild(thead);

    var premier = new Date(an, mois, 1);
    var dernier = new Date(an, mois + 1, 0);
    var d = plusJours(premier, -lundi0(premier));
    var tbody = document.createElement('tbody');
    while (d <= dernier) {
      var tr = document.createElement('tr');
      for (var i = 0; i < 7; i++) {
        var td = document.createElement('td');
        td.className = 'cala__c';
        if (d.getMonth() === mois) {
          td.textContent = String(d.getDate());
          var occs = parJour[iso(d)];
          if (occs && occs.length) {
            td.setAttribute('data-plein', 'oui');
            td.title = occs.map(function (o) { return o.e.titre; }).join(' · ');
          }
          if (memeJour(d, ajd)) td.setAttribute('data-auj', 'oui');
        } else {
          td.setAttribute('data-hors', 'oui');
        }
        tr.appendChild(td);
        d = plusJours(d, 1);
      }
      tbody.appendChild(tr);
    }
    t.appendChild(tbody);
    art.appendChild(t);
    return art;
  }

  function vueAnnee(hote) {
    var an = curseur.getFullYear();
    var ajd = aujourdhui();
    var toutes = etaler(new Date(an, 0, 1), new Date(an, 11, 31));
    var parJour = {};
    toutes.forEach(function (o) {
      var d = o.debut < new Date(an, 0, 1) ? new Date(an, 0, 1) : new Date(o.debut);
      while (d <= o.fin && d.getFullYear() === an) {
        (parJour[iso(d)] = parJour[iso(d)] || []).push(o);
        d = plusJours(d, 1);
      }
    });

    var grille = document.createElement('div');
    grille.className = 'cala';
    for (var m = 0; m < 12; m++) grille.appendChild(miniMois(an, m, parJour, ajd));
    hote.appendChild(grille);

    var p = document.createElement('p');
    p.className = 'cal__vide';
    p.textContent = toutes.length
      ? (toutes.length > 1 ? toutes.length + ' dates en ' + an + '. Clique sur un mois pour le détail.'
                           : 'Une date en ' + an + '. Clique sur le mois pour le détail.')
      : 'Rien en ' + an + '.';
    hote.appendChild(p);
  }

  /* =========================================================================
     LA VUE LISTE
     -------------------------------------------------------------------------
     LES MEMES CLASSES QUE LA PAGE PUBLIQUE, `.echeance` et ses enfants, deja
     dans src/css/style.css. Ce n'est pas de l'economie de CSS : c'est la
     garantie que le compte a rebours a la meme allure a l'interieur et a
     l'exterieur du bureau. Deux mises en forme du meme objet auraient diverge.
  ========================================================================= */
  function listeDe(occs) {
    var box = document.createElement('div');
    box.className = 'echeances';
    occs.forEach(function (o) {
      var art = document.createElement('article');
      art.className = 'echeance';
      art.setAttribute('data-niveau', o.niveau);
      art.setAttribute('data-famille', o.famille);
      if (faite(o)) art.setAttribute('data-fait', 'oui');

      var g = document.createElement('div');
      g.className = 'echeance__compte';
      var q = document.createElement('span');
      q.className = 'echeance__quand';
      q.textContent = faite(o) ? 'Fait' : o.phrase;
      var dd = document.createElement('span');
      dd.className = 'echeance__date';
      // Ce qui dure porte sa periode, pas seulement son premier jour : « du 1er
      // decembre au 15 mars » dit ce qu'une date seule ne dit pas.
      dd.textContent = o.periode ? o.periode : o.dateLongue;
      g.appendChild(q); g.appendChild(dd);
      art.appendChild(g);

      var c = document.createElement('div');
      c.className = 'echeance__corps';
      var h = document.createElement('h3');
      h.className = 'echeance__titre';
      h.textContent = o.e.titre;
      c.appendChild(h);
      var qui = document.createElement('p');
      qui.className = 'echeance__qui';
      qui.textContent = o.e.qui || '';
      if (qui.textContent) c.appendChild(qui);
      if (o.e.detail) {
        var det = document.createElement('p');
        det.className = 'echeance__detail';
        det.textContent = o.e.detail;
        c.appendChild(det);
      }

      var liens = document.createElement('p');
      liens.className = 'echeance__liens';
      /* LE SEPARATEUR ENTRE LES LIENS. La page publique les joint par « · » dans
         sa chaine HTML ; en construisant les noeuds un par un, on le perd sans
         rien casser, et on lit « Lire l'articleSource : Douane » en un seul mot.
         Vu a la capture du 08/09/2026, invisible pour tous les controles. */
      function separer() {
        if (liens.childNodes.length) liens.appendChild(document.createTextNode(' · '));
      }
      if (tachesLa()) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'cal__coche';
        b.setAttribute('data-cal-coche', o.e.cle + '|' + iso(o.debut));
        b.setAttribute('data-cal-titre', o.e.titre);
        b.setAttribute('aria-pressed', faite(o) ? 'true' : 'false');
        b.textContent = faite(o) ? 'Remettre à faire' : 'C’est fait';
        liens.appendChild(b);
      }
      if (o.e.article) {
        separer();
        var a1 = document.createElement('a');
        a1.href = o.e.article;
        a1.textContent = 'Lire l’article';
        liens.appendChild(a1);
      }
      /* UN REPERE DE SAISON N'A PAS DE SOURCE OFFICIELLE, et il ne faut surtout
         pas lui en inventer une. Une date de taille affichee avec l'autorite
         d'un texte de loi, c'est le genre de chose qui se retourne contre la
         maison. Sans source, on le dit. */
      if (o.e.source) {
        separer();
        var a2 = document.createElement('a');
        a2.href = o.e.source;
        a2.target = '_blank';
        a2.rel = 'noopener';
        a2.textContent = 'Source : ' + (o.e.sourceNom || 'la source');
        liens.appendChild(a2);
      } else if (o.statut === 'repere') {
        separer();
        var sr = document.createElement('span');
        sr.className = 'echeance__repere';
        sr.textContent = 'Repère, pas une obligation';
        liens.appendChild(sr);
      }
      c.appendChild(liens);

      art.appendChild(c);
      box.appendChild(art);
    });
    return box;
  }

  function vueListe(hote) {
    /* calculer() rend LA PROCHAINE occurrence de chaque regle, triee par
       urgence, ce qui est en cours devant, les obligations deja en vigueur en
       dernier. C'est ce que fait la page publique, et c'est ce qu'on veut ici :
       la liste repond a « qu'est-ce qui tombe le plus tot », pas a « qu'y a-t-il
       en octobre ». */
    var l = window.BdvEcheances ? BdvEcheances.calculer(reglesActives()) : [];
    if (!l.length) {
      var p = document.createElement('p');
      p.className = 'cal__vide';
      p.textContent = 'Rien en vue. Rallume une famille pour voir plus de dates.';
      hote.appendChild(p);
      return;
    }
    hote.appendChild(listeDe(l));
  }

  /* =========================================================================
     LE FILTRE, LA BASCULE ENTRE LES VUES, ET LE TITRE DE PERIODE
  ========================================================================= */
  function monterFiltre() {
    var hote = el('calFiltre');
    if (!hote || hote.dataset.monte) return;
    hote.dataset.monte = '1';
    lesFamilles().forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'calfam';
      b.setAttribute('data-cal-famille', f.cle);
      b.title = f.quoi;
      b.textContent = f.label;
      hote.appendChild(b);
    });
  }

  function peindreFiltre() {
    var act = famillesActives();
    [].forEach.call(document.querySelectorAll('[data-cal-famille]'), function (b) {
      var on = act.indexOf(b.getAttribute('data-cal-famille')) >= 0;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('calfam--off', !on);
    });
    var f = el('calFond');
    if (f) {
      f.setAttribute('aria-pressed', fond ? 'true' : 'false');
      f.classList.toggle('calfam--off', !fond);
    }
  }

  function titrePeriode() {
    if (vue === 'liste') return 'Ce qui vient';
    if (vue === 'annee') return String(curseur.getFullYear());
    return MOIS[curseur.getMonth()] + ' ' + curseur.getFullYear();
  }

  function deplacer(sens) {
    if (vue === 'annee') curseur = new Date(curseur.getFullYear() + sens, 0, 1);
    else curseur = new Date(curseur.getFullYear(), curseur.getMonth() + sens, 1);
    rendre();
  }

  function rendre() {
    var corps = el('calCorps');
    if (!corps) return;
    if (!curseur) curseur = premierDuMois(new Date());

    monterFiltre();
    peindreFiltre();

    var per = el('calPeriode');
    if (per) per.textContent = titrePeriode();

    /* LA NAVIGATION DISPARAIT EN VUE LISTE, elle n'y veut rien dire : la liste
       ne montre pas une periode, elle montre la prochaine occurrence de chaque
       regle. Des fleches qui ne changent rien sont pires qu'aucune fleche.
       LE FOND DE CARTE AUSSI : il ne se pose que dans la grille du mois. */
    var nav = el('calNav');
    if (nav) nav.hidden = (vue === 'liste');
    var fb = el('calFond');
    if (fb) fb.hidden = (vue !== 'mois');

    [].forEach.call(document.querySelectorAll('[data-cal-vue]'), function (b) {
      var a = b.getAttribute('data-cal-vue') === vue;
      b.classList.toggle('cal__vue--actif', a);
      b.setAttribute('aria-pressed', a ? 'true' : 'false');
    });

    corps.innerHTML = '';
    corps.setAttribute('data-vue', vue);
    if (vue === 'mois') vueMois(corps);
    else if (vue === 'annee') vueAnnee(corps);
    else vueListe(corps);

    var note = el('calNote');
    if (note) {
      var n = reglesActives().length, t = toutesLesRegles().length;
      note.textContent = n === t
        ? (n > 1 ? n + ' occurrences suivies' : (n ? '1 occurrence suivie' : ''))
        : n + ' sur ' + t + ' occurrences';
    }
  }

  function allerA(v) {
    if (VUES.indexOf(v) < 0) return;
    vue = v;
    ecrireVue(v);
    rendre();
  }

  /* ---------------- LES BRANCHEMENTS ----------------
     Poses UNE fois, sur le document, et pas sur des boutons repeints a chaque
     rendu. Meme motif que l'interception des liens dans bdv-nav.js. */
  function brancher() {
    if (branche) return;
    branche = true;

    document.addEventListener('click', function (e) {
      var v = e.target.closest && e.target.closest('[data-cal-vue]');
      if (v) { e.preventDefault(); allerA(v.getAttribute('data-cal-vue')); return; }

      var fa = e.target.closest && e.target.closest('[data-cal-famille]');
      if (fa) { e.preventDefault(); basculerFamille(fa.getAttribute('data-cal-famille')); return; }

      var fo = e.target.closest && e.target.closest('#calFond');
      if (fo) { e.preventDefault(); basculerFond(); return; }

      var m = e.target.closest && e.target.closest('[data-cal-mois]');
      if (m) {
        e.preventDefault();
        var p = m.getAttribute('data-cal-mois').split('-');
        curseur = new Date(parseInt(p[0], 10), parseInt(p[1], 10), 1);
        allerA('mois');
        return;
      }

      var c = e.target.closest && e.target.closest('[data-cal-coche]');
      if (c) {
        e.preventDefault();
        if (!tachesLa()) return;
        var q = c.getAttribute('data-cal-coche').split('|');
        BdvTaches.basculerOccurrence(q[0], c.getAttribute('data-cal-titre'), q[1]);
        return;                 // le rendu suit l'evenement, pas ce clic
      }
    });

    var prec = el('calPrec'), suiv = el('calSuiv'), auj = el('calAuj');
    if (prec) prec.addEventListener('click', function () { deplacer(-1); });
    if (suiv) suiv.addEventListener('click', function () { deplacer(1); });
    if (auj) auj.addEventListener('click', function () {
      curseur = premierDuMois(new Date());
      rendre();
    });

    /* LE CALENDRIER SE REPEINT QUAND LES TACHES CHANGENT, et il l'apprend par un
       evenement plutot que par un appel direct. bdv-taches.js part avec la page
       et ce module arrive au premier clic : un appel direct depuis les taches
       vers le calendrier serait un appel a quelque chose qui n'existe pas
       encore la plupart du temps. Et cocher dans « Mes taches » doit se voir ici
       aussi, pas seulement l'inverse. */
    document.addEventListener('bdv:taches', function () {
      var z = el('bureauCalendrier');
      if (z && !z.hidden) rendre();
    });
  }

  /* Appelee par la barre a chaque ouverture de la piece. Idempotente. */
  function ouvrir() {
    vue = lireVue();
    fond = lireFond();
    if (!curseur) curseur = premierDuMois(new Date());
    brancher();
    rendre();
  }

  window.BdvCalendrier = { ouvrir: ouvrir, rendre: rendre, allerA: allerA };
})();
