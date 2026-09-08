/* ===========================================================================
   LE BUREAU DU VIGNERON — LE CALCUL DES ECHEANCES
   ===========================================================================
   Une seule logique de calcul, partagee par la page /outils/echeances/ et par
   la premiere ligne de /mon-bureau/. Deux copies auraient fini par diverger,
   et rien ne l'aurait signale.

   Le calcul se fait TOUJOURS dans le navigateur, jamais a la construction du
   site : une page construite en septembre et consultee en decembre afficherait
   sinon « dans 4 jours » pour une echeance passee depuis trois mois.

   Les donnees viennent de src/_data/echeances.json, injecte dans la page.

   ---------------------------------------------------------------------------
   LOT 2, 08/09/2026 : UNE OCCURRENCE A UN DEBUT ET UNE FIN.

   Ted : « le calendrier donnera une date debut et fin obligatoire ». Une DRM
   commence et finit le 10 ; une taille de la vigne dure cent cinq jours.

   LA REGLE PORTE UNE DUREE, L'OCCURRENCE PORTE UNE FIN, et ce n'est pas la
   meme chose dite deux fois. Une regle annuelle ne peut pas porter une date de
   fin en dur : elle la recalcule a chaque annee. La duree est en jours, elle
   vaut 1 par defaut, et elle est le SEUL champ nouveau du modele.

   Le plan prevoyait deux types de recurrence de plus, `annuel-periode` et
   `hebdomadaire`. Le premier n'existe pas : une periode annuelle, c'est
   `annuel` avec une duree, et deux types pour la meme chose auraient donne
   deux chemins de code a garder d'accord. Le second n'a aucun usage dans la
   bibliotheque : il s'ajoutera le jour ou une ligne en aura besoin, pas avant.

   Une duree qui traverse le 31 decembre se calcule toute seule, puisqu'on
   compte des jours a partir d'un debut. C'est la deuxieme raison de ne pas
   avoir ecrit une date de fin.
   =========================================================================== */
(function () {
  'use strict';

  var JOUR = 24 * 3600 * 1000;

  function minuit(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function aujourdhui() { return minuit(new Date()); }
  function plusJours(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function duree(r) {
    var n = parseInt((r || {}).duree, 10);
    return n > 0 ? n : 1;
  }
  function finDe(debut, r) { return plusJours(debut, duree(r) - 1); }

  // Le Nieme jour d'un mois, RAMENE au dernier jour quand le mois est plus
  // court. Une echeance au 31 construite naivement pour fevrier tombe le 2 ou
  // le 3 mars : la date affichee serait fausse d'un mois entier, et le calcul
  // n'aurait leve aucune erreur.
  function jourDuMois(an, mois, jour) {
    var dernier = new Date(an, mois + 1, 0).getDate();
    return new Date(an, mois, Math.min(jour, dernier));
  }

  // Prochaine occurrence a venir. Pour une echeance unique deja passee on renvoie
  // sa date : une obligation entree en vigueur reste utile a afficher.
  //
  // UNE OCCURRENCE COMMENCEE MAIS PAS FINIE EST « LA PROCHAINE », et cette regle
  // vaut la peine d'etre lue deux fois. Sans elle, un vigneron qui ouvre son
  // bureau le 15 janvier, en pleine taille, lit « Taille de la vigne, dans 320
  // jours ». La reponse juste est « en ce moment ». On regarde donc d'abord si
  // l'occurrence PRECEDENTE court encore, et seulement ensuite la suivante.
  /* LE DECALAGE DU VIGNERON S'APPLIQUE A LA DATE CANDIDATE, ET AVANT TOUT LE
     RESTE. Lot 3, 08/09/2026 : une taille en fevrier n'est pas la meme en Loire
     et dans l'Herault, le vigneron deplace donc ses reperes de quelques semaines.
     Le decaler APRES avoir decide si l'occurrence tombe dans la fenetre, ou si
     elle court encore, donnerait une date juste dans une fenetre fausse : un
     repere decale de trois semaines disparaitrait du mois ou il tombe. */
  function decale(e) {
    var n = parseInt((e || {}).decale, 10);
    if (!n) return 0;
    return Math.max(-180, Math.min(180, n));
  }
  function pose(d, n) { return n ? plusJours(d, n) : d; }

  function prochaine(r, ref, n) {
    if (!r) return null;
    n = n || 0;
    if (r.type === 'unique') {
      var u = minuit(new Date(r.date + 'T00:00:00'));
      return isNaN(u.getTime()) ? null : pose(u, n);
    }
    if (r.type === 'mensuel') {
      var pm = pose(jourDuMois(ref.getFullYear(), ref.getMonth() - 1, r.jour), n);
      if (finDe(pm, r) >= ref) return pm;
      var d = pose(jourDuMois(ref.getFullYear(), ref.getMonth(), r.jour), n);
      if (finDe(d, r) >= ref) return d;
      return pose(jourDuMois(ref.getFullYear(), ref.getMonth() + 1, r.jour), n);
    }
    if (r.type === 'annuel') {
      var pa = pose(jourDuMois(ref.getFullYear() - 1, r.mois - 1, r.jour), n);
      if (finDe(pa, r) >= ref) return pa;
      var a = pose(jourDuMois(ref.getFullYear(), r.mois - 1, r.jour), n);
      if (finDe(a, r) >= ref) return a;
      return pose(jourDuMois(ref.getFullYear() + 1, r.mois - 1, r.jour), n);
    }
    return null;
  }

  // Le ton dit l'urgence avant meme qu'on lise le nombre.
  function niveau(n, encours) {
    if (encours) return 'encours';
    if (n < 0) return 'passe';
    if (n === 0) return 'aujourdhui';
    if (n <= 7) return 'urgent';
    if (n <= 30) return 'proche';
    return 'loin';
  }
  function phrase(n, encours) {
    if (encours) return 'En ce moment';
    if (n < 0) return 'En vigueur depuis le';
    if (n === 0) return "C'est aujourd'hui";
    if (n === 1) return 'Demain';
    return 'Dans ' + n + ' jours';
  }
  function enFrancais(d) {
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function courte(d) {
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function sansJour(d) {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  // La forme d'une occurrence, ecrite UNE fois. calculer() et etaler() la
  // partagent : deux fabrications du meme objet auraient fini par ne plus
  // porter les memes champs, et l'ecran qui lit le champ manquant n'affiche
  // rien du tout, sans erreur.
  //
  // `date` reste le nom du DEBUT, et il n'a pas ete renomme en `debut` alors
  // que ce serait plus clair : trois ecrans le lisent deja, dont le bloc de
  // « Ma journee » et l'identifiant d'occurrence des taches. Un renommage
  // n'aurait rien apporte qu'un risque.
  function poser(e, d, ref) {
    var r = e.recurrence || {};
    var f = finDe(d, r);
    var encours = (d <= ref && f >= ref && duree(r) > 1);
    var n = Math.round((d - ref) / JOUR);
    return {
      e: e, date: d, debut: d, fin: f, duree: duree(r), enCours: encours,
      jours: n, niveau: niveau(n, encours), phrase: phrase(n, encours),
      dateLongue: enFrancais(d), dateCourte: courte(d),
      // « du 1er decembre au 15 mars », pour tout ce qui dure plus d'un jour.
      periode: duree(r) > 1 ? ('du ' + sansJour(d) + ' au ' + sansJour(f)) : null,
      famille: e.famille || 'obligations',
      statut: e.statut || 'obligation',
      decale: decale(e)
    };
  }

  // UNE REGLE QU'ON NE SAIT PAS LIRE EST IGNOREE, ELLE NE FAIT PAS TOMBER LE RESTE.
  // prochaine() rend null pour un type de recurrence inconnu ou une date mal ecrite.
  // Sans ce filtre, poser() appelle toLocaleDateString sur null : le script s'arrete,
  // et TOUT le calendrier disparait, plus la page publique, plus le bloc de « Ma
  // journee ». Une faute de frappe dans src/_data/echeances.json ne doit couter que
  // la ligne fautive. Ajoute le 08/09/2026, avant d'ouvrir le fichier a l'edition.
  function lisible(e, ref) {
    var d = prochaine((e || {}).recurrence, ref, decale(e));
    return d && !isNaN(d.getTime()) ? d : null;
  }

  // Liste triee : les echeances a venir d'abord, de la plus proche a la plus lointaine.
  // Celles deja en vigueur ferment la marche, elles informent sans plus alerter.
  // Ce qui est EN COURS passe devant tout : c'est ce qui se fait maintenant.
  function calculer(echeances) {
    var ref = aujourdhui();
    return (echeances || []).map(function (e) {
      var d = lisible(e, ref);
      return d ? poser(e, d, ref) : null;
    }).filter(Boolean).sort(function (a, b) {
      if (a.enCours && !b.enCours) return -1;
      if (b.enCours && !a.enCours) return 1;
      if (a.jours < 0 && b.jours >= 0) return 1;
      if (b.jours < 0 && a.jours >= 0) return -1;
      return a.jours - b.jours;
    });
  }

  // TOUTES les occurrences entre deux bornes, incluses, et pas seulement la
  // prochaine de chaque regle.
  //
  // POURQUOI CETTE FONCTION EST ICI ET PAS DANS LE MODULE DU CALENDRIER.
  // calculer() repond a « qu'est-ce qui tombe le plus tot », etaler() repond a
  // « qu'y a-t-il en octobre ». Ce sont deux questions, mais UNE SEULE lecture
  // des regles de recurrence. Ecrire la deuxieme ailleurs aurait remis dans le
  // site les deux copies que ce fichier existe justement pour eviter, et la
  // divergence se serait vue des mois plus tard, sur une date fausse dans une
  // grille, sans qu'aucun controle ne la signale.
  //
  // ON RETIENT CE QUI CHEVAUCHE LA FENETRE, PAS CE QUI Y COMMENCE. Lot 2 : une
  // taille qui demarre le 1er decembre doit apparaitre en janvier et en fevrier.
  // Un filtre sur le seul debut l'aurait fait disparaitre de deux mois sur trois,
  // sans erreur, et personne ne l'aurait cherchee la.
  function etaler(echeances, du, au) {
    var ref = aujourdhui();
    var out = [];
    du = minuit(du); au = minuit(au);
    (echeances || []).forEach(function (e) {
      var r = e.recurrence || {}, d, a, n = decale(e);
      // On remonte d'une duree avant la borne basse, ET du decalage : une
      // occurrence commencee avant la fenetre peut tres bien la traverser, et un
      // repere pousse de trois semaines vers l'avant commence trois semaines plus
      // tot dans le calendrier de la bibliotheque.
      var marge = plusJours(du, -(duree(r) - 1) - Math.abs(n));
      function garder(x) {
        if (!x || isNaN(x.getTime())) return;
        x = pose(x, n);
        if (finDe(x, r) >= du && x <= au) out.push(poser(e, x, ref));
      }
      if (r.type === 'unique') {
        garder(minuit(new Date(r.date + 'T00:00:00')));
        return;
      }
      if (r.type === 'mensuel') {
        var c = new Date(marge.getFullYear(), marge.getMonth(), 1);
        while (c <= au) {
          garder(jourDuMois(c.getFullYear(), c.getMonth(), r.jour));
          c = new Date(c.getFullYear(), c.getMonth() + 1, 1);
        }
        return;
      }
      if (r.type === 'annuel') {
        for (a = marge.getFullYear(); a <= au.getFullYear(); a++) {
          garder(jourDuMois(a, r.mois - 1, r.jour));
        }
      }
    });
    return out.sort(function (x, y) { return x.date - y.date; });
  }

  // La plus urgente encore a venir, ou null s'il n'y en a aucune.
  function laPlusPressante(echeances) {
    var l = calculer(echeances).filter(function (x) { return x.jours >= 0 || x.enCours; });
    return l.length ? l[0] : null;
  }

  // Lit le bloc JSON pose dans la page. Absent, on renvoie un tableau vide plutot
  // que de lever : une page sans echeances doit s'afficher, pas planter.
  function depuisLaPage(id) {
    var el = document.getElementById(id || 'bdvEcheances');
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  // Les quatre familles, dans l'ordre ou elles se lisent. Declarees ICI et pas
  // dans le module du calendrier : la page publique s'en sert aussi, pour ne
  // montrer que les obligations. Cinq listes de familles dans cinq fichiers,
  // c'est quatre occasions d'en oublier une.
  var FAMILLES = [
    { cle: 'obligations', label: 'Obligations',  quoi: 'Ça coûte une amende' },
    { cle: 'travaux',     label: 'Travaux',      quoi: 'Ce que je fais dehors' },
    { cle: 'rendezvous',  label: 'Rendez-vous',  quoi: 'Je m’inscris, je me déplace' },
    { cle: 'tempsforts',  label: 'Temps forts',  quoi: 'Ce que je poste et ce que je vends' },
    /* LA CINQUIEME FAMILLE NE VIENT PAS DE CE FICHIER DE DONNEES. Les taches
       datees du vigneron sont fabriquees en regles synthetiques par le module du
       calendrier, a partir de la table des taches, et passent ensuite par le MEME
       calcul que les autres. Elle est declaree ici quand meme, parce que c'est la
       liste que le filtre affiche, et que deux listes de familles dans deux
       fichiers, c'est une occasion d'en oublier une. */
    { cle: 'taches',      label: 'Mes tâches',   quoi: 'Ce que j’ai noté moi-même' }
  ];
  function deLaFamille(echeances, cle) {
    return (echeances || []).filter(function (e) {
      return (e.famille || 'obligations') === cle;
    });
  }

  window.BdvEcheances = {
    calculer: calculer,
    etaler: etaler,
    laPlusPressante: laPlusPressante,
    depuisLaPage: depuisLaPage,
    enFrancais: enFrancais,
    courte: courte,
    familles: FAMILLES,
    deLaFamille: deLaFamille
  };
})();
