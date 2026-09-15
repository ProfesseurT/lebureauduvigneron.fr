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

   ---------------------------------------------------------------------------
   LOT A, 14/09/2026 : LE QUATRIEME TYPE, `annuel-jour-semaine`.

   MOTIF, ET IL EST MESURE. Trois lignes de la bibliotheque portaient une date
   fixe pour une fete qui n'en a pas : fete des meres au 31 mai, fete des peres
   au 21 juin, Black Friday au 27 novembre. Leur propre champ `detail` avouait
   deja « repere cale sur la date la plus frequente, a verifier chaque annee ».
   En 2027 les TROIS tombent a cote : le vrai dernier dimanche de mai est le 30,
   le troisieme dimanche de juin le 20, le Black Friday le 26. Un vigneron qui
   cale sa campagne fete des meres sur un lundi a rate son week-end de vente.

   La regle porte donc le MOIS, le JOUR DE SEMAINE et le RANG, et la date se
   calcule pour l'annee demandee. Elle n'est plus jamais a retaper.

     { "type": "annuel-jour-semaine", "mois": 11, "jourSemaine": 4, "rang": 3 }

   - `mois`        : 1 a 12, comme dans `annuel`.
   - `jourSemaine` : 1 = lundi ... 7 = dimanche. C'est la numerotation ISO, celle
                     qu'un humain ecrit sans se tromper. `getDay()` compte
                     autrement, dimanche a zero, et la conversion tient dans un
                     modulo. Exposer `getDay()` dans le fichier de donnees aurait
                     fait ecrire « 0 » pour dimanche a quelqu'un qui pense « 7 ».
   - `rang`        : 1 a 5, ou la chaine `"dernier"`.
   - `puis`        : facultatif, un decalage en JOURS applique apres le calcul.
                     Il existe pour une seule raison, et elle est reelle : le
                     Black Friday n'est PAS le quatrieme vendredi de novembre.
                     C'est le LENDEMAIN du quatrieme jeudi, et les deux ne
                     coincident pas quand le 1er novembre tombe un vendredi.
                     Ecrit `"rang": 4, "jourSemaine": 4, "puis": 1`, il est juste
                     toutes les annees. Le Cyber Monday, c'est `"puis": 4`.

   NE PAS CONFONDRE `puis` ET `decale`. `puis` appartient a la REGLE et vaut pour
   tout le monde. `decale` appartient au COMPTE du vigneron, il vit dans la table
   `calendrier_choix`, et il ne s'applique jamais a une obligation. Deux champs,
   deux proprietaires.

   UN CINQUIEME JEUDI QUI N'EXISTE PAS NE DEBORDE PAS SUR LE MOIS SUIVANT. Meme
   motif que `jourDuMois()` juste en dessous : une date construite naivement
   sortirait du mois vise et se lirait fausse d'une semaine entiere sans qu'aucun
   calcul ne leve d'erreur. On retombe sur le dernier du mois.

   CE QUE CE TYPE NE SAIT PAS FAIRE, ET QUI EST TRAITE AILLEURS. La fete des
   meres francaise est le dernier dimanche de mai SAUF quand ce jour est la
   Pentecote, et elle bascule alors au premier dimanche de juin. Cette exception
   depend de Paques, que ce fichier ne calcule pas. Elle ne se produit que six
   fois en trente-cinq ans, la premiere en 2034. Elle n'est donc pas encodee ici
   mais DETECTEE : `scripts/banc-annuel.mjs` fait echouer la construction du site
   l'annee ou elle tombe, avec la conduite a tenir. Mieux vaut un site qui refuse
   de partir qu'une date fausse affichee avec l'aplomb d'une DRM.
   =========================================================================== */
(function (racine) {
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

  // Le RANG-ieme jour de semaine d'un mois. Voir l'en-tete pour la forme de la
  // regle et pour les deux pieges (la numerotation ISO, et le cinquieme jeudi).
  function jourSemaineDuMois(an, mois, js, rang) {
    var vise = parseInt(js, 10) % 7;          // 7 (dimanche) devient 0, comme getDay()
    if (!(vise >= 0 && vise <= 6)) return null;
    var dernierJour = new Date(an, mois + 1, 0);
    if (rang === 'dernier' || rang === -1) {
      return new Date(an, mois, dernierJour.getDate() - ((dernierJour.getDay() - vise + 7) % 7));
    }
    var n = parseInt(rang, 10);
    if (!(n >= 1)) return null;
    var premier = new Date(an, mois, 1);
    var jour = 1 + ((vise - premier.getDay() + 7) % 7) + (n - 1) * 7;
    while (jour > dernierJour.getDate()) jour -= 7;   // pas de debordement de mois
    return new Date(an, mois, jour);
  }

  // `puis` appartient a la REGLE, `decale` au COMPTE. Voir l'en-tete.
  function puis(r) {
    var n = parseInt((r || {}).puis, 10);
    return n ? n : 0;
  }

  // Le debut de l'occurrence `annuel-jour-semaine` pour une annee donnee.
  // Ecrit UNE fois : prochaine() et etaler() s'en servent tous les deux, et deux
  // calculs du meme jour auraient fini par ne plus rendre le meme.
  function debutJourSemaine(r, an) {
    var d = jourSemaineDuMois(an, r.mois - 1, r.jourSemaine, r.rang);
    return d ? plusJours(d, puis(r)) : null;
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
    if (r.type === 'annuel-jour-semaine') {
      // Meme enchainement que `annuel` : on regarde d'abord si celle de l'an
      // dernier court encore, sinon celle de cette annee, sinon la prochaine.
      var an = ref.getFullYear(), js, i;
      for (i = -1; i <= 0; i++) {
        js = debutJourSemaine(r, an + i);
        if (js) { js = pose(js, n); if (finDe(js, r) >= ref) return js; }
      }
      js = debutJourSemaine(r, an + 1);
      return js ? pose(js, n) : null;
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

  /* ---- APPLIQUER LES CHOIX DU VIGNERON -------------------------------------
     Sorti de `reglesActives()` de bdv-calendrier.js le 15/09/2026, et pose ICI
     pour une seule raison : la fonction Edge qui rend l'abonnement .ics doit
     appliquer EXACTEMENT la meme regle que l'ecran. Laisse dans le module du
     calendrier, il aurait fallu la reecrire cote serveur, et le jour ou un
     vigneron eteint un repere il aurait disparu de sa grille sans disparaitre
     de son agenda. Personne n'aurait su lequel des deux avait raison.

     `choixDe` est une FONCTION `cle -> { actif, decale }`, et pas une table :
     le navigateur passe `BdvCalchoix.choix`, le serveur passe une fonction
     adossee aux lignes de `calendrier_choix`. Aucun des deux n'a a connaitre
     la forme de stockage de l'autre.

     UNE OBLIGATION NE S'ETEINT PAS ET NE SE DECALE PAS, et le garde-fou est
     double : l'ecran ne montre pas les gestes, et cette fonction les ignorerait
     de toute facon. Un jour quelqu'un ecrira une ligne dans la table a la main,
     ou par un vieux bouton oublie ; ni le calendrier ni l'agenda ne doivent
     pour autant cacher une DRM ou la deplacer de trois semaines. */
  function appliquerChoix(regles, choixDe) {
    if (typeof choixDe !== 'function') return (regles || []).slice();
    return (regles || []).filter(function (e) {
      if ((e.statut || 'obligation') !== 'repere') return true;
      return choixDe(e.cle).actif !== false;
    }).map(function (e) {
      if ((e.statut || 'obligation') !== 'repere') return e;
      var d = parseInt(choixDe(e.cle).decale, 10);
      return d ? Object.assign({}, e, { decale: d }) : e;
    });
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
        return;
      }
      if (r.type === 'annuel-jour-semaine') {
        for (a = marge.getFullYear(); a <= au.getFullYear(); a++) {
          garder(debutJourSemaine(r, a));
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
  //
  // LE GARDE-FOU `document` A ETE AJOUTE LE 15/09/2026 avec le passage bi-runtime.
  // Cote Deno il n'y a pas de document : sans lui, un appel par megarde depuis la
  // fonction Edge leverait une ReferenceError au lieu de rendre une liste vide.
  // Le serveur, lui, lit le fichier de donnees joint, il ne lit jamais de page.
  function depuisLaPage(id) {
    if (typeof document === 'undefined') return [];
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
    { cle: 'taches',      label: 'Mes tâches',   quoi: 'Ce que j’ai noté moi-même' },
    /* LA SIXIEME FAMILLE NE VIENT PAS DE CE FICHIER NON PLUS, et elle n'est stockee
       nulle part : ce sont les rappels poses sur des clients, lus dans `suivi_clients`
       par le calendrier et par « Mes taches ». Demande de Ted le 11/09/2026.

       ELLE N'A PAS DE COULEUR, et ce n'est pas un oubli. La bande utilisable du papier
       s'arrete a L* 56 : cinq teintes n'y tenaient deja pas l'ecart de 3:1, une sixieme
       encore moins. Elle se distingue par la MATIERE, comme les taches : ecrite a la
       main, et marquee d'un combine. Ca se lit en niveaux de gris et en vision
       deuteranope, ce qu'une teinte de plus n'aurait pas fait.

       ET ELLE NE SE COCHE PAS. « Fait » pour un client, ce n'est pas une case : c'est
       ce qu'il a dit. Ces lignes menent a sa fiche, qui est le seul endroit ou l'on
       note un echange depuis le 11/09/2026. */
    { cle: 'clients',     label: 'Mes clients',  quoi: 'Ceux que j’ai promis de rappeler' }
  ];
  function deLaFamille(echeances, cle) {
    return (echeances || []).filter(function (e) {
      return (e.famille || 'obligations') === cle;
    });
  }

  /* ---- LES TROIS MONDES, 15/09/2026 ----
     Navigateur : la balise script pose BdvEcheances sur window.
     Node : les bancs jsdom injectent ce fichier dans une page, meme chose.
     Deno : globalThis.BdvEcheances apres l'import du fichier joint a la fonction
     Edge `agenda-ics`.

     MOTIF, ET IL EST ANCIEN. L'en-tete de ce fichier interdit depuis le premier
     jour d'ecrire le calcul une deuxieme fois. Le serveur qui rend l'abonnement
     .ics doit donc utiliser CE moteur, pas une copie : une divergence entre la
     grille du bureau et l'agenda d'un client ne se verrait que des mois plus
     tard, chez lui, et personne ne saurait lequel des deux a raison.

     C'est le meme motif, la meme forme et le meme garde-fou d'empreinte que
     `bdv-courrier.js`, qui a fait ce chemin le 09/09/2026. Ne pas remplacer ce
     bloc par un `export` : il fermerait les deux autres mondes.

     AUCUNE LIGNE DE CALCUL N'A CHANGE ce jour-la. Seules la premiere ligne, la
     derniere, et le garde-fou `document` de depuisLaPage() ont bouge. */
  var api = {
    calculer: calculer,
    etaler: etaler,
    laPlusPressante: laPlusPressante,
    depuisLaPage: depuisLaPage,
    appliquerChoix: appliquerChoix,
    enFrancais: enFrancais,
    courte: courte,
    familles: FAMILLES,
    deLaFamille: deLaFamille
  };
  racine.BdvEcheances = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
