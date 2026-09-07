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

   DEUX PIEGES REFERMES, notes pour qu'on ne les rouvre pas :
     1. Le raccourci clavier. Les ecrans de vente ecoutaient DEJA le crochet
        ouvrant pour replier leur volet ; les deux vivant desormais dans la meme
        page, deux ecouteurs auraient replie et deplie dans la meme frappe, ce
        qui ne se voit pas et ne se debugue pas. Leur volet a disparu au lot 2d,
        mais la garde `window.__bdvNavRaccourci` reste : elle est la reponse au
        cas ou une autre barre reviendrait un jour.
     2. Le mecanisme « ici » des ecrans de vente, le menu de secours de la barre
        haute quand le volet tombait a zero, a ete supprime et non fait
        cohabiter. Cette barre-ci ne se replie PAS a zero, elle garde ses
        icones : il n'y a plus de vigneron a sortir de l'ecran ou il se trouve.
        Ne pas reintroduire un repli a zero sans reintroduire un menu avec.
   ================================================================ */
(function () {
  'use strict';

  /* La preference de repli est PARTAGEE avec le volet des ecrans de vente, meme
     cle. Replier au bureau replie aussi la-bas, et c'est voulu : pour le
     vigneron c'est la meme barre, il ne comprendrait pas qu'elle se replie a
     moitie selon l'endroit ou il se trouve. */
  var VOLET_KEY = 'bdv_volet_replie';

  /* « Mon exercice » ou « Mon annee » : le libelle suit l'exercice comptable du
     domaine, comme partout ailleurs. exMot() vient de bdv-base.js, charge avant
     nous au bureau. On teste sa presence quand meme : cette barre doit pouvoir
     etre posee sur une page qui n'a pas besoin du moteur de la base. */
  function motExercice() {
    try { return typeof exMot === 'function' ? 'Mon ' + exMot() : 'Mon exercice'; }
    catch (e) { return 'Mon exercice'; }
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
  var PIECES = [
    { id: 'journee',   ico: '&#9728;',   label: 'Ma journée',
      href: '/mon-bureau/',
      quoi: 'Ce qui presse, tes rappels, ton ardoise' },
    { id: 'annee', viti: true,     ico: '&#128200;', label: motExercice,
      href: '/mon-bureau/#annee',
      quoi: 'Ton chiffre, ton rythme, tes canaux' },
    { id: 'clients', viti: true,   ico: '&#128101;', label: 'Mes clients',
      href: '/mon-bureau/#clients',
      quoi: 'Qui rappeler, qui decroche, qui revient' },
    { id: 'produits', viti: true,  ico: '&#127863;', label: 'Mes cuvées',
      href: '/mon-bureau/#produits',
      quoi: 'Ce qui part, ce qui dort' },
    { id: 'chercher', viti: true,  ico: '&#128301;', label: 'Chercher',
      href: '/mon-bureau/#chercher',
      quoi: 'Une ligne, un client, une facture' },
    { id: 'echeances', ico: '&#8987;',   label: 'Le compte à rebours',
      href: '/outils/echeances/',
      quoi: 'DRM, DAI, recolte, facturation' },
    { id: 'reglages',  ico: '&#9881;',   label: 'Mes réglages',
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

  /* ---------------------------------------------------------------------------
     Le repli
  --------------------------------------------------------------------------- */
  function estReplie() {
    try { return localStorage.getItem(VOLET_KEY) === '1'; } catch (e) { return false; }
  }

  function appliquer(atelier, bouton, replie) {
    atelier.classList.toggle('bureau-atelier--replie', replie);
    if (!bouton) return;
    bouton.setAttribute('aria-expanded', String(!replie));
    var mot = (replie ? 'Déplier' : 'Replier') + ' le menu';
    bouton.title = mot + ' (touche crochet ouvrant)';
    bouton.setAttribute('aria-label', mot);
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
  var RESSOURCES = [
    { css: '/css/bdv-ecrans.css' },
    { js: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js' },
    { js: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js' },
    { js: '/js/bdv-ecrans.js' }
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

  var _chargement = null;
  function chargerEcrans() {
    if (_chargement) return _chargement;
    _chargement = RESSOURCES.reduce(function (chaine, r) {
      return chaine.then(function () { return r.css ? poserCss(r.css) : poserJs(r.js); });
    }, Promise.resolve());
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

  function attente(id, oui) {
    var nav = document.getElementById('bureauNav');
    var l = nav && nav.querySelector('.bureau-nav__ligne[data-piece="' + id + '"]');
    var it = l && l.querySelector('.bureau-nav__item');
    if (it) it.classList.toggle('bureau-nav__item--attente', !!oui);
  }

  /* `id` est une piece de la barre. `client` ouvre en plus une fiche. `ecrire` dit
     s'il faut poser l'adresse : faux quand on vient justement de la lire. */
  function afficher(id, opts) {
    opts = opts || {};
    var journee = document.getElementById('bureauJournee');
    var ventes = document.getElementById('bureauVentes');
    if (!journee || !ventes) return;

    // Les reglages ne sont pas une destination : le panneau s'ouvre PAR-DESSUS ce qui
    // est affiche, et le reperage dans la barre ne bouge pas. Le moteur qu'il lui faut
    // est deja charge par la page, il n'attend pas les ecrans de vente.
    if (id === 'reglages' || id === 'base') {
      if (typeof window.ouvrirPanneauReglages === 'function') window.ouvrirPanneauReglages();
      else if (window.BdvReglages) window.BdvReglages.ouvrir();
      return;
    }

    var piece = PIECES.filter(function (p) { return p.id === id; })[0];
    if (!piece) id = 'journee';

    if (id === 'journee') {
      ventes.hidden = true;
      journee.hidden = false;
      marquerActif('journee');
      if (opts.ecrire !== false && location.hash) history.pushState(null, '', location.pathname);
      return;
    }

    journee.hidden = true;
    ventes.hidden = false;
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
        av.textContent = 'Tes ecrans de vente n\'ont pas pu se charger. Verifie ta connexion et reessaie.';
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
    var p = PIECES.filter(function (x) { return x.id === brut && x.viti; })[0];
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
    var atelier = conteneur.closest('.bureau-atelier') || document.body;

    var html = '<button class="bureau-nav__plier" id="bureauNavPlier" type="button"'
      + ' aria-controls="bureauNavListe" aria-expanded="true">'
      + '<span class="bureau-nav__filets" aria-hidden="true"></span></button>'
      + '<ul class="bureau-nav__liste" id="bureauNavListe">';

    PIECES.forEach(function (p) {
      var actif = p.id === idActif;
      var nom = libelle(p);
      var marque = actif ? ' bureau-nav__item--actif" aria-current="page' : '';
      /* title porte le libelle ET ce que la piece contient : replie, l'icone
         seule ne dit rien, et c'est la seule facon de retrouver son chemin. */
      var t = ' title="' + nom + (p.quoi ? ' — ' + p.quoi : '') + '"';
      var dedans = '<span class="bureau-nav__ico" aria-hidden="true">' + p.ico + '</span>'
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
    if (b) b.addEventListener('click', function () {
      if (typeof window.ouvrirPanneauReglages === 'function') window.ouvrirPanneauReglages();
    });

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
      // Le compte a rebours est une autre page : on ne l'intercepte pas.
      if (id === 'echeances') return;
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
    // Le bouton Retour du navigateur circule dans le bureau au lieu d'en sortir.
    window.addEventListener('popstate', suivreAdresse);
    // Et l'adresse d'arrivee decide de la premiere piece affichee : un favori sur
    // /mon-bureau/#clients ouvre les clients, pas la journee.
    suivreAdresse();

    var plier = conteneur.querySelector('#bureauNavPlier');
    appliquer(atelier, plier, estReplie());
    if (plier) plier.addEventListener('click', function () {
      var r = !atelier.classList.contains('bureau-atelier--replie');
      try { localStorage.setItem(VOLET_KEY, r ? '1' : '0'); } catch (e) {}
      appliquer(atelier, plier, r);
    });

    /* Le crochet ouvrant, jamais pendant une saisie. Voir le piege 1 en entete :
       une seule barre prend le raccourci par page. */
    if (!window.__bdvNavRaccourci) {
      window.__bdvNavRaccourci = true;
      document.addEventListener('keydown', function (e) {
        if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'
          || t.tagName === 'SELECT' || t.isContentEditable)) return;
        e.preventDefault();
        if (plier) plier.click();
      });
    }
  }

  window.BdvNav = { pieces: PIECES, monter: monter, libelle: libelle,
                    sansVitisoft: sansVitisoft, afficher: afficher,
                    marquerActif: marquerActif };
})();
