/* ===========================================================================
   LE BUREAU DU VIGNERON — LA PIECE « LE CALENDRIER »
   ===========================================================================
   Lot 1 du chantier calendrier, 08/09/2026. Voir PLAN_calendrier.md pour les
   quatre arbitrages tranches avec Ted avant la premiere ligne de code.

   CE QUE CETTE PIECE CORRIGE D'ABORD. Jusqu'a aujourd'hui, cliquer sur « Le
   calendrier » dans la barre du bureau EJECTAIT hors du bureau, vers la page
   publique /outils/echeances/, qui n'a pas les intercalaires. C'etait la seule
   piece de la barre a faire ca, et c'est ce que Ted a signale.

   CE FICHIER NE CALCULE AUCUNE DATE, ET C'EST LA REGLE. Le calcul vit dans
   src/js/bdv-echeances.js, seule logique du site, partagee par la page
   publique, « Ma journee », « Mes taches » et cette piece. Une deuxieme copie
   ici aurait diverge, et la divergence se serait vue des mois plus tard, sur un
   chiffre de jours faux, sans qu'aucun controle ne la signale.

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

   AUCUN TEXTE NE PASSE PAR UNE CHAINE HTML. Les enveloppes sont construites
   ici, les textes poses en textContent. Regle du bureau, et elle n'est pas
   cosmetique : le lot 3 ouvrira ce calendrier aux occurrences ecrites par le
   vigneron lui-meme, et ce jour-la il sera trop tard pour y penser.
   =========================================================================== */
(function () {
  'use strict';

  var VUE_KEY = 'bdv_cal_vue';
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
  var branche = false;

  /* ---------------- LES OUTILS DE DATE ----------------
     Les memes conventions que bdv-echeances.js et bdv-taches.js : minuit local,
     jamais UTC. Une echeance tombe un jour, pas a une heure, et melanger les
     deux fait sauter une journee sur les fuseaux a l'est de Greenwich. */
  function minuit(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function aujourdhui() { return minuit(new Date()); }
  function premierDuMois(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
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
  function regles() {
    return window.BdvEcheances ? BdvEcheances.depuisLaPage('bdvEcheances') : [];
  }
  function etaler(du, au) {
    if (!window.BdvEcheances || !BdvEcheances.etaler) return [];
    return BdvEcheances.etaler(regles(), du, au);
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
    return tachesLa() ? BdvTaches.estFaite(idOccurrence(o.e.cle, o.date)) : false;
  }

  /* ---------------- LA VUE MEMORISEE ---------------- */
  function lireVue() {
    try {
      var v = localStorage.getItem(VUE_KEY);
      return VUES.indexOf(v) >= 0 ? v : 'mois';
    } catch (e) { return 'mois'; }
  }
  function ecrireVue(v) { try { localStorage.setItem(VUE_KEY, v); } catch (e) {} }

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
  ========================================================================= */
  function celluleJour(d, dansLeMois, occs, ajd) {
    var td = document.createElement('td');
    td.className = 'calm__c';
    if (!dansLeMois) td.setAttribute('data-hors', 'oui');
    if (lundi0(d) >= 5) td.setAttribute('data-repos', 'oui');
    if (memeJour(d, ajd)) td.setAttribute('data-auj', 'oui');

    var n = document.createElement('span');
    n.className = 'calm__n';
    n.textContent = String(d.getDate());
    td.appendChild(n);

    if (!occs.length) return td;

    var ul = document.createElement('ul');
    ul.className = 'calm__l';
    occs.forEach(function (o) {
      var li = document.createElement('li');
      li.className = 'calo';
      var estFaite = faite(o);
      li.setAttribute('data-fait', estFaite ? 'oui' : 'non');
      li.setAttribute('data-niveau', o.niveau);

      /* Le titre complet est dans le title et dans aria-label, jamais dans la
         case : la colonne d'un mois fait cent pixels de large et « DAI,
         declaration annuelle d'inventaire » y tiendrait sur six lignes. Le
         detail complet est dans la liste sous la grille. */
      var libelle = o.e.titre;
      if (tachesLa()) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'calo__b';
        b.setAttribute('data-cal-coche', o.e.cle + '|' + iso(o.date));
        b.setAttribute('data-cal-titre', o.e.titre);
        b.setAttribute('aria-pressed', estFaite ? 'true' : 'false');
        b.title = (estFaite ? 'Remettre à faire : ' : 'Marquer comme fait : ')
          + libelle + ', ' + o.dateLongue;
        b.setAttribute('aria-label', b.title);
        b.textContent = libelle;
        li.appendChild(b);
      } else {
        var s = document.createElement('span');
        s.className = 'calo__b';
        s.title = libelle;
        s.textContent = libelle;
        li.appendChild(s);
      }
      ul.appendChild(li);
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
    var depart = new Date(debutMois);
    depart.setDate(depart.getDate() - lundi0(debutMois));
    var arrivee = new Date(finMois);
    arrivee.setDate(arrivee.getDate() + (6 - lundi0(finMois)));

    var toutes = etaler(depart, arrivee);
    var parJour = {};
    toutes.forEach(function (o) {
      var k = iso(o.date);
      (parJour[k] = parJour[k] || []).push(o);
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
                                   parJour[iso(d)] || [], ajd));
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    hote.appendChild(table);

    /* LE DETAIL SOUS LA GRILLE. C'est ce qui fait la difference entre un
       calendrier et une decoration : la case dit qu'il y a quelque chose, la
       liste dit quoi, pour qui, et d'ou vient la date. */
    var duMois = toutes.filter(function (o) {
      return o.date >= debutMois && o.date <= finMois;
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
    var d = new Date(premier);
    d.setDate(d.getDate() - lundi0(premier));
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
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
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
      var k = iso(o.date);
      (parJour[k] = parJour[k] || []).push(o);
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
      if (faite(o)) art.setAttribute('data-fait', 'oui');

      var g = document.createElement('div');
      g.className = 'echeance__compte';
      var q = document.createElement('span');
      q.className = 'echeance__quand';
      q.textContent = faite(o) ? 'Fait' : o.phrase;
      var dd = document.createElement('span');
      dd.className = 'echeance__date';
      dd.textContent = o.dateLongue;
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
      qui.textContent = o.e.qui;
      c.appendChild(qui);
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
        b.setAttribute('data-cal-coche', o.e.cle + '|' + iso(o.date));
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
      separer();
      var a2 = document.createElement('a');
      a2.href = o.e.source;
      a2.target = '_blank';
      a2.rel = 'noopener';
      a2.textContent = 'Source : ' + o.e.sourceNom;
      liens.appendChild(a2);
      c.appendChild(liens);

      art.appendChild(c);
      box.appendChild(art);
    });
    return box;
  }

  function vueListe(hote) {
    /* calculer() rend LA PROCHAINE occurrence de chaque regle, triee par
       urgence, les obligations deja en vigueur en dernier. C'est exactement ce
       que fait la page publique, et c'est ce qu'on veut ici : la liste repond a
       « qu'est-ce qui tombe le plus tot », pas a « qu'y a-t-il en octobre ». */
    var l = window.BdvEcheances ? BdvEcheances.calculer(regles()) : [];
    if (!l.length) {
      var p = document.createElement('p');
      p.className = 'cal__vide';
      p.textContent = 'Rien en vue.';
      hote.appendChild(p);
      return;
    }
    hote.appendChild(listeDe(l));
  }

  /* =========================================================================
     LA BASCULE ENTRE LES VUES, ET LE TITRE DE PERIODE
  ========================================================================= */
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

    var per = el('calPeriode');
    if (per) per.textContent = titrePeriode();

    /* LA NAVIGATION DISPARAIT EN VUE LISTE, elle n'y veut rien dire : la liste
       ne montre pas une periode, elle montre la prochaine occurrence de chaque
       regle. Des fleches qui ne changent rien sont pires qu'aucune fleche. */
    var nav = el('calNav');
    if (nav) nav.hidden = (vue === 'liste');

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
      var n = regles().length;
      note.textContent = n > 1 ? n + ' échéances suivies' : (n ? '1 échéance suivie' : '');
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
    if (!curseur) curseur = premierDuMois(new Date());
    brancher();
    rendre();
  }

  window.BdvCalendrier = { ouvrir: ouvrir, rendre: rendre, allerA: allerA };
})();
