/* ================================================================
   LE BUREAU DU VIGNERON, la barre de navigation du bureau
   ----------------------------------------------------------------
   Ecrit le 07/09/2026, lot 1 de la fusion dans le bureau (voir
   PLAN_fusion-bureau.md).

   CE FICHIER PORTE LA LISTE UNIQUE DES PIECES DU BUREAU. C'est tout son objet.
   Avant lui, la liste existait a deux endroits qui ne se ressemblaient pas :
   NAV dans les ecrans de vente, et deux liens en dur dans le tiroir du bureau.
   Deux listes, c'est deux listes a tenir a jour, et un jour l'une des deux ment.

   Le principe arrete avec Ted le 07/09/2026 : UNE SEULE NAVIGATION, A PLAT. Le
   nom « tableau de bord » n'est plus un lieu ou l'on va. Ses ecrans sont des
   pieces du bureau, au meme rang que « Ma journee ». Un chantier nouveau entre
   donc ICI, dans PIECES, et jamais par une page autonome de plus.

   OU EN EST-ON. La fusion est faite. Les pieces de vente sont des adresses du
   bureau (/mon-bureau/#clients), le clic est intercepte ici, et
   /outils/dashboard-vigneron/ n'est plus qu'une page de redirection qui traduit
   les anciennes adresses. Les `href` restent de vrais liens : une adresse se
   copie, s'ouvre dans un autre onglet, se met en favori, et fonctionne encore
   si le JavaScript n'a pas pris.

   LE REPLI A ETE SUPPRIME le 07/09/2026, sur decision de Ted : bouton, raccourci
   clavier, preference `bdv_volet_replie` et classe `--replie`. Motif, et il vaut
   pour tout bouton qu'on serait tente d'ajouter ici : personne ne clique pour
   gagner 170 pixels sur un ecran qui en a 1670, et un hamburger dans une barre
   qui ne nomme que des objets du bureau ne ressemble a rien de ce bureau. La
   largeur decide maintenant seule : intercalaires complets, puis icones seules
   sous 1180 px, puis barre horizontale sous 901 px. C'est du CSS, il n'y a plus
   d'etat a garder ni de preference a relire.

   NE PAS REINTRODUIRE un repli a zero sans reintroduire un menu de secours avec :
   la barre ne doit jamais pouvoir disparaitre completement, sinon on s'enferme
   dans la piece ou l'on se trouve.
   ================================================================ */
(function () {
  'use strict';

  /* « Mon exercice » ou « Mon annee » : le libelle suit l'exercice comptable du domaine,
     comme partout ailleurs.

     DEUX CHEMINS, ET C'EST VOULU. Le moteur de la base n'est plus charge a l'ouverture du
     bureau depuis le 07/09/2026 : exMot() n'existe donc pas encore quand la barre se
     peint. On lit alors la meme cle de navigateur que lui, directement.

     LA CLE EST DUPLIQUEE ICI, et c'est le prix a payer. Le moteur pese 83 ko et il n'est
     charge que pour ces deux caracteres-la. La lire de notre cote coute une ligne, mais
     elle doit rester d'accord avec EX_KEY dans bdv-base.js : la changer d'un seul cote
     ferait dire « Mon exercice » a un domaine en annee civile, sans erreur et sans que
     personne ne le remarque. Le meme piege que HASH_COLS, en beaucoup moins grave.

     exMot() garde la priorite des qu'il existe : le jour ou le moteur change de facon de
     decider, c'est lui qui a raison, pas nous. */
  var EX_KEY_MIROIR = 'bdv_exercice_v1';   // = EX_KEY dans src/js/bdv-base.js

  function motExercice() {
    try { if (typeof exMot === 'function') return 'Mon ' + exMot(); } catch (e) {}
    try {
      var m = parseInt(localStorage.getItem(EX_KEY_MIROIR), 10);
      return (m >= 2 && m <= 12) ? 'Mon exercice' : 'Mon année';
    } catch (e) { return 'Mon année'; }
  }

  /* ---------------------------------------------------------------------------
     LES PIECES DU BUREAU, dans l'ordre de la journee et pas dans l'ordre
     technique : ce qui presse d'abord, ce qu'on regarde ensuite, ce qu'on
     cherche quand on cherche, et les reglages en dernier parce qu'on y va une
     fois par mois.

     Les icones sont des entites HTML numeriques, comme dans les ecrans de
     vente, et elles sont ICI et pas dans le gabarit de la page : le controle de
     charte surveille les entites de src/js, pas celles des pages du site.
     Les deplacer dans mon-bureau.njk les sortirait du filet.
  --------------------------------------------------------------------------- */
  /* ---------------------------------------------------------------------------
     LES HUIT TRACES DE LA BARRE
     -------------------------------------------------------------------------
     Ecrits le 07/09/2026. C'etaient sept emoji, et c'etait le seul endroit du site
     ou une couleur arrivait sans avoir ete choisie : un soleil jaune, un graphique
     rouge, deux bonhommes bleus, sur un fond bleu-encre ou tout le reste est
     --gold et --on-dark-soft.

     LA REGLE DE CE JEU, pour que le neuvieme lui ressemble :
       - grille de 20 sur 20, aucun remplissage, le trait seul ;
       - epaisseur 1.4, arrondis aux extremites et aux jointures, parce que le
         trait du site est celui d'une plume et pas d'un couteau ;
       - `currentColor` et jamais une couleur : la couleur vient du CSS, donc de
         --gold, et suit l'etat de la piece sans qu'on ait a y penser ;
       - un objet de bureau chaque fois que c'est possible. Une page datee plutot
         qu'un soleil, un registre plutot qu'une loupe. C'est un bureau, pas une
         barre d'outils.
       - `vector-effect="non-scaling-stroke"` : le trait garde son epaisseur meme
         si la barre change d'echelle un jour.

     Ils sont ICI et pas dans un fichier d'images : huit traces de deux cents
     octets ne valent pas huit requetes, et le CSS doit pouvoir les colorer.
  --------------------------------------------------------------------------- */
  function trace(d) {
    return '<svg viewBox="0 0 20 20" width="16" height="16" fill="none"'
      + ' stroke="currentColor" stroke-width="1.4" stroke-linecap="round"'
      + ' stroke-linejoin="round" vector-effect="non-scaling-stroke"'
      + ' aria-hidden="true" focusable="false">' + d + '</svg>';
  }

  var TRACES = {
    // Ma journee : la page du jour sur le sous-main, avec sa reglure et sa date soulignee.
    journee:  '<rect x="3" y="3.5" width="14" height="13"/><path d="M3 7.5h14"/>'
              + '<path d="M6.5 11h7M6.5 13.5h4.5"/><path d="M7 2v3M13 2v3"/>',
    // Mes taches : le porte-bloc a pince, avec une ligne cochee et une qui attend.
    // Un objet du bureau, comme les autres, et il dit le geste sans le dessiner : la
    // coche est DANS la feuille, ce n'est pas une coche posee sur rien.
    taches:   '<rect x="4" y="4" width="12" height="12.5"/><path d="M8 4V2.8h4V4"/>'
              + '<path d="M7 9.6l1.7 1.7L12.9 7.1"/><path d="M7 13.6h6"/>',
    // Mon annee : trois barres qui montent. Le meme signe que le favicon du site.
    annee:    '<path d="M4 16.5h13"/><path d="M6.5 16.5v-4M10 16.5v-7.5M13.5 16.5v-11"/>',
    // Mes clients : deux tetes, celle de devant entiere, celle de derriere devinee.
    clients:  '<circle cx="8" cy="7" r="2.6"/><path d="M3.5 16.5c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2"/>'
              + '<path d="M13.2 5.1a2.6 2.6 0 0 1 0 4.6"/><path d="M14.5 12.9c1.3.7 2 1.9 2 3.6"/>',
    // Mes cuvees : un verre a pied. Le seul trace qui ne soit pas du mobilier, et
    // c'est bien : c'est ce qu'il y a dans le verre qu'on vend.
    produits: '<path d="M6 3.5h8l-.6 5a3.4 3.4 0 0 1-6.8 0z"/><path d="M10 12v4.5"/>'
              + '<path d="M7 16.5h6"/>',
    // Chercher : un registre ouvert, plutot qu'une loupe. On cherche dans un registre.
    chercher: '<path d="M10 5.5v11"/><path d="M10 5.5C8.6 4.4 6.6 4 3.5 4v10.5c3.1 0 5.1.4 6.5 1.5"/>'
              + '<path d="M10 5.5c1.4-1.1 3.4-1.5 6.5-1.5v10.5c-3.1 0-5.1.4-6.5 1.5"/>',
    // Le calendrier : le sablier, et le sable deja tombe.
    calendrier:'<path d="M6 3h8M6 17h8"/><path d="M6.5 3c0 3.2 3.5 5.2 3.5 7s-3.5 3.8-3.5 7"/>'
              + '<path d="M13.5 3c0 3.2-3.5 5.2-3.5 7s3.5 3.8 3.5 7"/><path d="M8 17h4"/>',
    // Mes reglages : un curseur de reglage, pas une roue crantee. On regle son bureau,
    // on ne le demonte pas.
    reglages: '<path d="M3.5 6.5h13M3.5 13.5h13"/><circle cx="12.5" cy="6.5" r="2.2"/>'
              + '<circle cx="7.5" cy="13.5" r="2.2"/>'
  };

  var PIECES = [
    { id: 'journee',   ico: TRACES.journee,   label: 'Ma journée',
      href: '/mon-bureau/',
      quoi: 'Ce qui presse, tes rappels, ton ardoise' },
    /* LE CALENDRIER EST DEUXIEME, ET C'EST UNE HYPOTHESE ASSUMEE. Elle est
       ecrite dans le document de refonte du 07/09/2026 : on ouvre son bureau
       pour ne rien oublier, et on regarde son annee deux fois l'an. C'est la
       seule piece qui repond exactement a « est-ce que j'ai oublie quelque
       chose », et elle etait sixieme, sous une piece ouverte trois fois par an.
       Si l'hypothese tombe, cet ordre se change ici, en une ligne. */
    /* MES TACHES EST DEUXIEME, juste apres la journee, et devant le calendrier.
       Meme raison que celle qui avait fait remonter le calendrier : on ouvre son
       bureau pour ne rien oublier. La difference, c'est qu'ici on peut agir, alors
       que le calendrier ne fait que dire. Ce qui se fait passe devant ce qui
       s'informe. Pas `viti` : les obligations et les notes ne demandent pas
       Vitisoft, et c'est la deuxieme raison pour quelqu'un de la filiere de creer
       un compte, apres les signets. */
    { id: 'taches',    ico: TRACES.taches,    label: 'Mes tâches',
      href: '/mon-bureau/#taches',
      quoi: 'Ce que tu notes, et tes obligations à cocher' },
    /* LE CALENDRIER EST UNE PIECE DU BUREAU depuis le 08/09/2026, et plus une
       sortie vers la page publique. C'etait la SEULE piece de la barre qui
       ejectait hors du bureau, vers un ecran sans intercalaires, et c'est ce
       que Ted a signale en ouvrant le chantier.
       La page publique /outils/echeances/ ne disparait pas pour autant : elle
       reste la porte d'entree, gratuite et sans compte, en vue liste. Ce qui est
       reserve au bureau, c'est de choisir sa vue, de cocher, de creer ses
       propres occurrences et de synchroniser son agenda. Voir PLAN_calendrier.md. */
    { id: 'calendrier', ico: TRACES.calendrier, label: 'Le calendrier',
      href: '/mon-bureau/#calendrier',
      quoi: 'DRM, DAI, récolte, facturation' },
    /* « MON COMMERCE » DEPUIS LE 11/09/2026, et c'etait « Mes clients ». La piece ne dit
       plus seulement qui rappeler : elle porte maintenant le verdict « d'ou vient ta
       variation » et les quatre mouvements de clientele, qui etaient empiles dans « Mon
       annee » avec vingt-deux autres blocs.

       L'IDENTIFIANT NE CHANGE PAS, et c'est une precaution, pas un oubli : `clients` tient
       l'adresse /mon-bureau/#clients, donc les signets du vigneron et les liens qu'il a
       copies, et c'est lui que `npm run banc` compare avec NAV dans bdv-ecrans.js.
       Renommer le libelle ne coute rien ; renommer l'identifiant casserait les deux. */
    { id: 'clients', viti: true,   ico: TRACES.clients, label: 'Mon commerce',
      href: '/mon-bureau/#clients',
      quoi: 'Qui rappeler, qui décroche, d\'où vient ton chiffre' },
    { id: 'annee', viti: true,     ico: TRACES.annee, label: motExercice,
      href: '/mon-bureau/#annee',
      quoi: 'Ton chiffre, ton rythme, tes canaux' },
    { id: 'produits', viti: true,  ico: TRACES.produits, label: 'Mes cuvées',
      href: '/mon-bureau/#produits',
      quoi: 'Ce qui part, ce qui dort' },
    /* « Chercher » etait le seul des sept a nommer un geste et pas un objet,
       dans une barre qui ne nomme que des objets. Et son trace est deja un
       registre ouvert. */
    { id: 'chercher', viti: true,  ico: TRACES.chercher, label: 'Mon registre',
      href: '/mon-bureau/#chercher',
      quoi: 'Une ligne, un client, une facture' },
    { id: 'reglages',  ico: TRACES.reglages,   label: 'Mes réglages',
      panneau: true,
      quoi: 'Ton domaine, ta base, tes objectifs' }
  ];

  function libelle(p) { return typeof p.label === 'function' ? p.label() : p.label; }

  /* ---------------------------------------------------------------------------
     SANS VITISOFT, LES QUATRE PIECES DE VENTE N'EXISTENT PAS. C'est une regle
     metier, pas un detail d'affichage : les ecrans de vente lisent un export
     Vitisoft, et sans lui ils n'ont rien a montrer. Le bureau ne montre donc
     pas la porte, exactement comme il ne montrait pas l'entree du tiroir avant
     le 07/09/2026 (`tiroirDash`, remplace par cet appel).

     C'est un MASQUAGE et pas un retrait de la liste : la fiche profil arrive du
     reseau, apres le montage de la barre. Retirer les lignes voudrait dire
     remonter toute la barre a l'arrivee du profil, et faire clignoter une
     navigation sous la souris du vigneron.
  --------------------------------------------------------------------------- */
  function sansVitisoft(oui) {
    PIECES.forEach(function (p) {
      if (!p.viti) return;
      var n = document.querySelector('.bureau-nav__ligne[data-piece="' + p.id + '"]');
      if (n) n.hidden = !!oui;
    });
  }


  /* =========================================================================
     LES ECRANS DE VENTE, CHARGES AU PREMIER CLIC
     -------------------------------------------------------------------------
     Lot 2c du 07/09/2026. Leur HTML est deja dans la page, masque : cinquante
     lignes de balises ne coutent rien. Ce qui attend le clic, c'est le poids :
     une feuille de 44 ko, Chart.js, le lecteur de fichiers Excel, et 2 500
     lignes de JavaScript. Personne ne doit payer ca pour venir lire une
     echeance dans « Ma journee ».

     L'ORDRE DES RESSOURCES EST UNE CONDITION. bdv-ecrans.js lit des variables
     de bdv-base.js des son analyse (bdv-base est deja charge par la page), et
     il observe .content au niveau global : la coque doit donc etre dans le
     document avant lui, ce qu'elle est. Les scripts sont enchaines un par un
     et pas lances ensemble : deux <script> ajoutes dynamiquement ne garantissent
     pas leur ordre d'execution.
  ========================================================================= */
  /* LE MOTEUR DE LA BASE, sorti de l'ouverture du bureau le 07/09/2026.

     Il y etait charge sans defer, donc il retardait le premier pixel de « Ma journee »,
     pour 83 ko plus PapaParse. Or « Ma journee » ne s'en sert pas : ses chiffres viennent
     du serveur par bdv-crm, qui ne touche a aucune variable du moteur. Verifie nom par
     nom sur les 161 globales du moteur : seuls bdv-reglages.js et ce fichier-ci en
     dependent, et tous deux savent faire sans.

     Deux choses seulement en ont vraiment besoin, et toutes deux se declenchent par un
     geste : ouvrir un ecran de vente, ou ouvrir le panneau de reglages, qui montre « Ma
     base » et « Le classement », lesquels sont des CALCULS sur les lignes de vente.

     L'ordre est celui qu'avait la page : PapaParse, bdv-sync, bdv-base. PapaParse n'est
     en fait appele que depuis handleFiles(), donc bien apres, mais l'en-tete du moteur
     annonce le contraire et ce n'est pas le jour de le contredire. */
  /* LA FEUILLE PART AVEC LE MOTEUR depuis le 08/09/2026, et pas seulement avec les ecrans
     de vente. C'est elle qui habille les deux seules choses que le moteur dit a l'ecran :
     le bandeau de statut (`.status`) et le voile « le moteur travaille » (`#busyov`).

     Sans elle, un import lance depuis le panneau de reglages, qui charge le moteur sans
     charger les ecrans, posait un bandeau SANS AUCUN STYLE : ni position fixe, ni fond, ni
     couleur. Il tombait donc au bout du <body>, dans le flux de la page, derriere la
     modale. C'est le « les calculs et disclaimers se font derriere la modale » signale par
     Ted. Le reste de la feuille est inerte ici : toutes ses autres regles sont portees par
     `.bdv-ventes`, et cette coque reste masquee tant qu'on n'ouvre pas un ecran de vente.
     poserCss() ne la reposera pas quand les ecrans arriveront a leur tour. */
  var MOTEUR = [
    { css: '/css/bdv-ecrans.css' },
    { js: 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js' },
    { js: '/js/bdv-sync.js' },
    { js: '/js/bdv-base.js' }
  ];

  /* Les ecrans de vente. Ils VIENNENT APRES le moteur, jamais avant : bdv-ecrans.js lit
     des variables declarees dedans des son analyse. */
  var RESSOURCES = [
    { css: '/css/bdv-ecrans.css' },
    { js: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js' },
    { js: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js' },
    { js: '/js/bdv-ecrans.js' }
  ];

  /* LE CALENDRIER : deux fichiers, et rien d'autre. Ni Chart.js, ni le lecteur
     xlsx, ni le moteur de la base : cette piece ne lit aucune ligne de vente.
     Elle lit le bloc JSON des echeances, deja dans la page, et le calcul de
     bdv-echeances.js, deja charge en defer par le gabarit. Elle attend quand
     meme le premier clic : le bureau ouvre a 32 ko bloquants, et ce chantier
     n'a pas le droit de les augmenter. */
  var RESSOURCES_CAL = [
    { css: '/css/bdv-calendrier.css' },
    /* L'ALMANACH AVANT LE CALENDRIER, et l'ordre est une condition : la piece
       appelle BdvAlmanach.entre() des son premier rendu, pour poser la lune, les
       saisons et les jours feries dans les cases. Charge apres, il n'existerait
       pas encore, le fond de carte serait vide, et rien ne le signalerait. */
    { js: '/js/bdv-almanach.js' },
    /* Les choix du vigneron, AVANT la piece pour la meme raison que l'almanach :
       reglesActives() les lit des le premier rendu. Charges apres, tous les
       reperes eteints reapparaitraient une fraction de seconde, puis
       disparaitraient : un clignotement que personne ne saurait expliquer. */
    { js: '/js/bdv-calchoix.js' },
    { js: '/js/bdv-calendrier.js' }
  ];

  function poserCss(href) {
    return new Promise(function (ok) {
      if (document.querySelector('link[href="' + href + '"]')) return ok();
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      // On n'attend pas indefiniment une feuille : mieux vaut un ecran mal mis en
      // forme qu'un ecran qui ne vient jamais.
      l.onload = l.onerror = function () { ok(); };
      document.head.appendChild(l);
    });
  }

  function poserJs(src) {
    return new Promise(function (ok, ko) {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      var t = document.createElement('script');
      t.src = src;
      t.onload = function () { ok(); };
      t.onerror = function () { ko(new Error('chargement impossible : ' + src)); };
      document.head.appendChild(t);
    });
  }

  function enchainer(liste, depart) {
    return liste.reduce(function (chaine, r) {
      return chaine.then(function () { return r.css ? poserCss(r.css) : poserJs(r.js); });
    }, depart || Promise.resolve());
  }

  var _moteur = null;
  function chargerMoteur() {
    if (_moteur) return _moteur;
    _moteur = enchainer(MOTEUR);
    /* Le libelle de la piece se corrige quand le moteur arrive : jusque-la il venait de
       notre lecture de la cle, maintenant il vient d'exMot(). Dans la quasi-totalite des
       cas les deux disent la meme chose et rien ne bouge a l'ecran. */
    _moteur = _moteur.then(function () { marquerLibelles(); });
    return _moteur;
  }

  var _cal = null;
  function chargerCalendrier() {
    if (_cal) return _cal;
    _cal = enchainer(RESSOURCES_CAL);
    return _cal;
  }

  var _chargement = null;
  function chargerEcrans() {
    if (_chargement) return _chargement;
    _chargement = enchainer(RESSOURCES, chargerMoteur());
    return _chargement;
  }

  /* Les quatre elements « hors page » de la coque : le bandeau de statut, le voile
     d'attente, le rapport imprimable et la modale. Ils sont deplaces sous <body> DES
     L'OUVERTURE de la page, et pas au premier clic. Deux raisons :
       1. @media print masque `body > *` puis rend #printReport : un rapport enfoui
          dans un conteneur reste invisible, un enfant d'un parent masque ne se
          rattrape pas.
       2. .status sert aux imports faits depuis le panneau de reglages, qui s'ouvre
          sans avoir jamais affiche un ecran de vente. Laisse dans le conteneur
          masque, il aurait rendu ces imports muets. */
  function sortirHorsPage() {
    ['status', 'busyov', 'printReport', 'modale'].forEach(function (id) {
      var n = document.getElementById(id);
      if (n && n.parentNode !== document.body) document.body.appendChild(n);
    });
  }

  /* =========================================================================
     LA BASCULE
     -------------------------------------------------------------------------
     « Ma journee » et les ecrans de vente occupent la meme colonne, l'un ou
     l'autre. Le reperage dans la barre, l'adresse et l'affichage bougent
     ensemble : un seul chemin, donc rien a tenir d'accord.
  ========================================================================= */
  function marquerActif(id) {
    var nav = document.getElementById('bureauNav');
    if (!nav) return;
    PIECES.forEach(function (p) {
      var l = nav.querySelector('.bureau-nav__ligne[data-piece="' + p.id + '"]');
      if (!l) return;
      var it = l.querySelector('.bureau-nav__item');
      if (!it) return;
      var actif = p.id === id;
      it.classList.toggle('bureau-nav__item--actif', actif);
      if (actif) it.setAttribute('aria-current', 'page');
      else it.removeAttribute('aria-current');
    });
  }

  /* Repose le texte de chaque piece sans reconstruire la barre : reconstruire perdrait
     le repere de la piece courante et l'etat du repli, et ferait clignoter la
     navigation sous la souris. */
  function marquerLibelles() {
    var nav = document.getElementById('bureauNav');
    if (!nav) return;
    PIECES.forEach(function (p) {
      var n = nav.querySelector('.bureau-nav__ligne[data-piece="' + p.id + '"] .bureau-nav__nom');
      if (n) n.textContent = libelle(p);
    });
  }

  function attente(id, oui) {
    var nav = document.getElementById('bureauNav');
    var l = nav && nav.querySelector('.bureau-nav__ligne[data-piece="' + id + '"]');
    var it = l && l.querySelector('.bureau-nav__item');
    if (it) it.classList.toggle('bureau-nav__item--attente', !!oui);
  }

  /* ---------------------------------------------------------------------------
     LE SEUL POINT D'ENTREE DES REGLAGES, et c'est tout son interet.

     Trois boutons ouvrent ce panneau : « Mes reglages » dans la barre, « Mes reglages »
     dans l'entete du bureau, et l'adresse /mon-bureau/#base. Avant le 07/09/2026 chacun
     appelait le module directement, ce qui allait tres bien tant que le moteur de la base
     etait deja charge par la page.

     Il ne l'est plus. Le banc a attrape la panne le jour meme : le bouton de la barre
     ouvrait le panneau sans demander le moteur, et « Ma base » comme « Le classement »
     restaient vides. Vides sans erreur, sans message, et pour la seule raison qu'on avait
     clique sur un bouton plutot que sur un autre.

     Donc UNE fonction, et les trois boutons passent par elle. En ajouter un quatrieme
     ailleurs, c'est l'appeler elle.
  --------------------------------------------------------------------------- */
  function ouvrirReglages() {
    /* Le panneau s'ouvre TOUT DE SUITE, sans attendre le moteur : « Toi » et « Le
       courrier » n'en ont pas besoin, et un panneau qui met une seconde a apparaitre
       donne l'impression d'un clic rate. « Ma base » et « Le classement » sont des
       calculs sur les lignes de vente : ils se remplissent quand le moteur arrive, par
       le rafraichissement que le module expose deja. */
    if (typeof window.ouvrirPanneauReglages === 'function') window.ouvrirPanneauReglages();
    else if (window.BdvReglages) window.BdvReglages.ouvrir();

    chargerMoteur().then(function () {
      if (window.BdvReglages && BdvReglages.rafraichir) BdvReglages.rafraichir();
    })['catch'](function () {
      if (window.BdvReglages && BdvReglages.dire) {
        BdvReglages.dire('Deux onglets de tes réglages, Ma base et Le classement, restent vides. Vérifie ta connexion, puis referme et rouvre ce panneau.');
      }
      _moteur = null;   // le prochain essai repart de zero
    });
  }

  /* `id` est une piece de la barre. `client` ouvre en plus une fiche. `ecrire` dit
     s'il faut poser l'adresse : faux quand on vient justement de la lire. */
  /* QUATRE PIECES SE PARTAGENT LA ZONE DE TRAVAIL depuis le 08/09/2026 : la journee,
     les taches, le calendrier, et la coque des ecrans de vente. Une seule fonction decide
     laquelle est visible, et elle les nomme TOUTES a chaque fois. Un `hidden` pose a la
     main dans une branche, c'est la garantie qu'un jour l'une des quatre reste
     affichee sous une autre : le bureau montrerait deux pieces empilees. */
  function seule(quelle) {
    var zones = { journee: 'bureauJournee', taches: 'bureauTaches',
                  calendrier: 'bureauCalendrier', ventes: 'bureauVentes' };
    Object.keys(zones).forEach(function (k) {
      var n = document.getElementById(zones[k]);
      if (n) n.hidden = (k !== quelle);
    });
  }

  function afficher(id, opts) {
    opts = opts || {};
    var journee = document.getElementById('bureauJournee');
    var ventes = document.getElementById('bureauVentes');
    if (!journee || !ventes) return;

    // Les reglages ne sont pas une destination : le panneau s'ouvre PAR-DESSUS ce qui
    // est affiche, et le reperage dans la barre ne bouge pas. Le moteur qu'il lui faut
    // est deja charge par la page, il n'attend pas les ecrans de vente.
    if (id === 'reglages' || id === 'base') { ouvrirReglages(); return; }

    var piece = PIECES.filter(function (p) { return p.id === id; })[0];
    if (!piece) id = 'journee';

    if (id === 'journee') {
      seule('journee');
      marquerActif('journee');
      if (opts.ecrire !== false && location.hash) history.pushState(null, '', location.pathname);
      return;
    }

    /* Mes taches n'a RIEN a charger : son module part avec la page, il ne lit ni le
       moteur des ventes ni PapaParse. Pas de voile d'attente, donc, et pas de retour
       en arriere possible : il n'y a pas de reseau a echouer avant l'affichage. */
    if (id === 'taches') {
      seule('taches');
      marquerActif('taches');
      if (opts.ecrire !== false && location.hash !== '#taches') history.pushState(null, '', '#taches');
      if (window.BdvTaches) BdvTaches.ouvrir();
      return;
    }

    /* LE CALENDRIER. Meme forme que les ecrans de vente, chargement au premier
       clic et voile d'attente sur la languette, mais sans le moteur : il n'y a
       rien a calculer sur les ventes ici. En cas d'echec reseau on revient a
       « Ma journee » plutot que de laisser une colonne vide, et on remet le
       chargement a zero pour redonner sa chance au prochain clic. */
    if (id === 'calendrier') {
      seule('calendrier');
      marquerActif('calendrier');
      if (opts.ecrire !== false && location.hash !== '#calendrier') {
        history.pushState(null, '', '#calendrier');
      }
      attente('calendrier', true);
      chargerCalendrier().then(function () {
        attente('calendrier', false);
        if (window.BdvCalendrier) BdvCalendrier.ouvrir();
      })['catch'](function () {
        attente('calendrier', false);
        _cal = null;
        afficher('journee');
        var avc = document.getElementById('bureauAvis');
        if (avc) {
          avc.textContent = 'Ton calendrier n\'a pas pu s\'ouvrir. Te voilà revenu à Ma journée : vérifie ta connexion et reclique.';
          avc.hidden = false;
        }
      });
      return;
    }

    seule('ventes');
    marquerActif(id);
    if (opts.ecrire !== false) {
      var h = '#' + (opts.client ? 'client=' + encodeURIComponent(opts.client) : id);
      if (location.hash !== h) history.pushState(null, '', h);
    }

    attente(id, true);
    chargerEcrans().then(function () {
      attente(id, false);
      if (typeof window.demarrerEcransVente !== 'function') return;
      window.demarrerEcransVente(opts.client ? { client: opts.client } : { ecran: id });
    })['catch'](function () {
      attente(id, false);
      // Le reseau a lache au milieu du chargement. On revient a « Ma journee » plutot
      // que de laisser une colonne vide qui ne dit rien, et on redonne sa chance au
      // prochain clic : c'est ce que le _chargement remis a zero achete.
      _chargement = null;
      afficher('journee');
      var av = document.getElementById('bureauAvis');
      if (av) {
        av.textContent = 'Tes écrans de vente n\'ont pas pu s\'ouvrir. Te voilà revenu à Ma journée : vérifie ta connexion et reclique.';
        av.hidden = false;
      }
    });
  }

  /* L'adresse fait foi a l'ouverture et au bouton Retour. Trois formes seulement :
     rien (Ma journee), #<piece>, et #client=<identifiant>. */
  function lireAdresse() {
    var brut = (location.hash || '').replace('#', '');
    if (!brut) return { id: 'journee' };
    if (brut.indexOf('client=') === 0) {
      return { id: 'clients', client: decodeURIComponent(brut.slice(7)) };
    }
    if (brut === 'base' || brut === 'parametres' || brut === 'reglages') return { id: 'reglages' };
    /* `echeances` etait le nom de la piece jusqu'au 08/09/2026. L'alias reste :
       une adresse se copie et se met en favori, c'est tout l'interet d'en avoir
       une, et un favori qui tombe a cote n'affiche aucune erreur. */
    if (brut === 'echeances') return { id: 'calendrier' };
    /* TOUTE piece de la barre est une adresse, et pas seulement les quatre pieces
       de vente. Ce filtre exigeait `viti` jusqu'au 08/09/2026 : un favori sur
       /mon-bureau/#taches ouvrait « Ma journee », sans erreur et sans que personne
       ne comprenne pourquoi. Les reglages restent hors liste, ils sont traites deux
       lignes plus haut : ce n'est pas une destination, c'est un panneau qui s'ouvre
       par-dessus ce qui est affiche. */
    var p = PIECES.filter(function (x) { return x.id === brut && !x.panneau; })[0];
    return p ? { id: brut } : { id: 'journee' };
  }

  function suivreAdresse() {
    var a = lireAdresse();
    afficher(a.id, { client: a.client, ecrire: false });
  }

  /* ---------------------------------------------------------------------------
     Monter la barre. `idActif` designe la piece ou l'on se trouve : elle n'est
     pas un lien, on n'a pas a pouvoir cliquer sur la page ou l'on est deja.
  --------------------------------------------------------------------------- */
  function monter(conteneur, idActif) {
    if (!conteneur) return;

    var html = '<ul class="bureau-nav__liste" id="bureauNavListe">';

    PIECES.forEach(function (p) {
      var actif = p.id === idActif;
      var nom = libelle(p);
      var marque = actif ? ' bureau-nav__item--actif" aria-current="page' : '';
      /* title porte le libelle ET ce que la piece contient. C'est ce qui rend les
         icones seules utilisables sous 1180 px : sans lui, huit traces nues. */
      var t = ' title="' + nom + (p.quoi ? ' : ' + p.quoi : '') + '"';
      var dedans = '<span class="bureau-nav__ico">' + trace(p.ico) + '</span>'
        + '<span class="bureau-nav__nom">' + nom + '</span>';
      html += '<li class="bureau-nav__ligne" data-piece="' + p.id + '">';
      /* LA PIECE ACTIVE RESTE UN LIEN. Au lot 1 elle etait rendue en <span> : on ne
         clique pas sur la page ou l'on est deja, et c'etait juste pour une barre qui
         rechargeait la page. Depuis que la barre navigue sans rechargement, un <span>
         figeait la premiere piece affichee : revenir a « Ma journee » apres un detour
         par « Mes clients » ne faisait plus rien, sans un message, sans une erreur.
         L'etat actif est donc porte par la classe et par aria-current, jamais par le
         choix de la balise. Recliquer sur la piece courante reaffiche la meme chose. */
      if (p.panneau) {
        html += '<button class="bureau-nav__item' + marque + '" type="button"'
          + ' data-bdv-nav-panneau="1"' + t + '>' + dedans + '</button>';
      } else {
        html += '<a class="bureau-nav__item' + marque + '" href="' + p.href + '"'
          + t + '>' + dedans + '</a>';
      }
      /* Les pieces de vente restent de vrais liens et pas des boutons : une adresse se
         copie, s'ouvre dans un autre onglet, se met en favori, et fonctionne encore si le
         JavaScript n'a pas pris. Le clic est simplement intercepte quand il peut l'etre. */
      html += '</li>';
    });

    html += '</ul>';
    conteneur.innerHTML = html;

    /* Les reglages sont un panneau, pas une page : la fonction vit dans
       bdv-reglages.js, chargee en defer, donc pas forcement la au moment ou on
       monte la barre. On la cherche au clic, jamais avant. */
    var b = conteneur.querySelector('[data-bdv-nav-panneau]');
    if (b) b.addEventListener('click', function () { ouvrirReglages(); });

    /* Le clic sur une piece de vente ne quitte plus la page. On laisse passer les clics
       qui ont un sens ailleurs : molette, milieu, ctrl ou cmd enfonce, c'est une demande
       d'ouvrir dans un autre onglet, et l'adresse du lien y repond toute seule. */
    conteneur.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a.bureau-nav__item');
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      var l = a.closest('.bureau-nav__ligne');
      var id = l && l.dataset.piece;
      if (!id) return;
      e.preventDefault();
      afficher(id);
    });

    /* Le meme interception, mais pour TOUS les liens du bureau qui pointent une piece :
       l'ardoise mene a « Mon exercice », le sous-main a la fiche d'un client, la punaise de
       l'age au panneau. Sans cette ligne ils rechargeaient la page entiere pour arriver au
       meme endroit. Pose sur le document, une seule fois, et pas sur chaque lien : ces
       liens sont repeints a chaque rafraichissement du sous-main. */
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="/mon-bureau/#"]');
      if (!a || conteneur.contains(a)) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      var brut = a.getAttribute('href').split('#')[1] || '';
      e.preventDefault();
      if (brut.indexOf('client=') === 0) afficher('clients', { client: decodeURIComponent(brut.slice(7)) });
      else afficher(brut || 'journee');
    });

    sortirHorsPage();
    mesurerEntete();
    // Le bouton Retour du navigateur circule dans le bureau au lieu d'en sortir.
    window.addEventListener('popstate', suivreAdresse);
    // Et l'adresse d'arrivee decide de la premiere piece affichee : un favori sur
    // /mon-bureau/#clients ouvre les clients, pas la journee.
    suivreAdresse();

  }

  /* ---------------------------------------------------------------------------
     LA HAUTEUR DE L'ENTETE, MESUREE ET PAS DEVINEE, 08/09/2026

     `.nav`, l'entete du site, est collee en haut de toutes les pages avec un fond
     opaque et --z-nav (100). La barre des pieces est collee aussi : avec `top: 0`
     des deux cotes, elle passait DESSOUS, et « Ma journee » comme « Mes taches »
     disparaissaient des qu'on faisait defiler. C'est ce que Ted a vu.

     Le decalage est ecrit en CSS (`--h-entete`), avec une valeur de repli qui
     tient tant que le JavaScript n'a pas pris. Mais un chiffre en dur se perime
     au premier changement de l'entete, en silence et seulement pour qui fait
     defiler. On mesure donc l'entete reelle et on repose la vraie valeur.

     Pourquoi sur <html> et pas sur la barre : c'est une propriete de la PAGE, et
     tout ce qui se collera un jour en haut en aura besoin. Un deuxieme element
     collant qui remesurerait l'entete pour son compte, c'est le meme chiffre a
     deux endroits.

     Au redimensionnement aussi : entre 900 et 901 px la barre change de nature,
     et sous 600 px l'entete change de hauteur. Sans le reglage sur `resize`, une
     fenetre reduite gardait la mesure de l'ancienne.
  --------------------------------------------------------------------------- */
  function mesurerEntete() {
    var entete = document.querySelector('.nav');
    if (!entete) return;
    var h = Math.round(entete.getBoundingClientRect().height);
    // Une hauteur nulle veut dire « pas encore mise en page » ou « masquee » : on
    // garde alors le repli du CSS plutot que de coller la barre sous rien.
    if (h > 0) document.documentElement.style.setProperty('--h-entete', h + 'px');
  }
  // Une seule mesure par salve de redimensionnement : `resize` part des dizaines de
  // fois pendant qu'on tire un coin de fenetre, et chaque lecture de
  // getBoundingClientRect force un recalcul de mise en page.
  var _mesure = null;
  window.addEventListener('resize', function () {
    if (_mesure) clearTimeout(_mesure);
    _mesure = setTimeout(function () { _mesure = null; mesurerEntete(); }, 120);
  });
  /* ET UNE FOIS LES POLICES ARRIVEES. La hauteur de l'entete depend de la police du
     logo : mesuree avant l'echange de police, elle peut se tromper de quelques
     pixels, et ces pixels sont exactement ce qui laisse voir un liseré de languette
     sous l'entete. Le `catch` couvre les navigateurs sans document.fonts. */
  try{ if (document.fonts && document.fonts.ready) document.fonts.ready.then(mesurerEntete); }catch(e){}

  /* `chargerEcrans` est expose depuis le 08/09/2026, et il n'a qu'un seul appelant :
     analyserPourLeBureau() dans bdv-base.js, apres un import fait au bureau. Le moteur
     des ventes sait cumuler des lignes, mais il ne sait pas les ANALYSER : le calcul de
     la file et du resume vit dans bdv-ecrans.js, que le bureau ne charge qu'au premier
     clic sur une piece de vente. Un vigneron qui importait puis regardait « Ma journee »
     voyait donc des tuiles vides, et seul un rechargement de page les remplissait.

     Expose et pas recopie : deux endroits qui enchainent la meme liste de ressources,
     c'est un doublon qui divergera le jour ou un fichier s'ajoutera a RESSOURCES. */
  window.BdvNav = { pieces: PIECES, monter: monter, libelle: libelle,
                    sansVitisoft: sansVitisoft, afficher: afficher,
                    marquerActif: marquerActif, ouvrirReglages: ouvrirReglages,
                    chargerEcrans: chargerEcrans };
})();
