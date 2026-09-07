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

   OU EN EST-ON. Au lot 1, la barre est posee au bureau et les pieces de vente
   sont encore des LIENS vers /outils/dashboard-vigneron/. Au lot 2, ces liens
   deviennent des changements d'ecran dans la page, et la vieille adresse ne
   sera plus qu'une redirection. La forme de PIECES est faite pour ce jour-la :
   remplacer `href` par un appel, sans toucher a l'ordre ni aux libelles.

   DEUX PIEGES POUR LE LOT 2, notes pendant qu'ils sont frais :
     1. Le raccourci clavier. Les ecrans de vente ecoutent DEJA le crochet
        ouvrant pour replier leur volet. Le jour ou les deux vivront dans la
        meme page, deux ecouteurs replieraient et deplieraient dans la meme
        frappe, ce qui ne se voit pas et ne se debugue pas. La garde
        `window.__bdvNavRaccourci` plus bas existe pour ca : le premier arrive
        prend la main, le second s'abstient.
     2. Le mecanisme « ici » des ecrans de vente (le menu de secours de la barre
        haute quand le volet est replie a zero) devient inutile ici, parce que
        cette barre-la ne se replie PAS a zero : elle garde ses icones. Il sera a
        supprimer, pas a faire cohabiter.
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
      href: '/outils/dashboard-vigneron/#annee',
      quoi: 'Ton chiffre, ton rythme, tes canaux' },
    { id: 'clients', viti: true,   ico: '&#128101;', label: 'Mes clients',
      href: '/outils/dashboard-vigneron/#clients',
      quoi: 'Qui rappeler, qui decroche, qui revient' },
    { id: 'produits', viti: true,  ico: '&#127863;', label: 'Mes cuvées',
      href: '/outils/dashboard-vigneron/#produits',
      quoi: 'Ce qui part, ce qui dort' },
    { id: 'chercher', viti: true,  ico: '&#128301;', label: 'Chercher',
      href: '/outils/dashboard-vigneron/#chercher',
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
      /* title porte le libelle ET ce que la piece contient : replie, l'icone
         seule ne dit rien, et c'est la seule facon de retrouver son chemin. */
      var t = ' title="' + nom + (p.quoi ? ' — ' + p.quoi : '') + '"';
      var dedans = '<span class="bureau-nav__ico" aria-hidden="true">' + p.ico + '</span>'
        + '<span class="bureau-nav__nom">' + nom + '</span>';
      html += '<li class="bureau-nav__ligne" data-piece="' + p.id + '">';
      if (actif) {
        html += '<span class="bureau-nav__item bureau-nav__item--actif"'
          + ' aria-current="page"' + t + '>' + dedans + '</span>';
      } else if (p.panneau) {
        html += '<button class="bureau-nav__item" type="button"'
          + ' data-bdv-nav-panneau="1"' + t + '>' + dedans + '</button>';
      } else {
        html += '<a class="bureau-nav__item" href="' + p.href + '"' + t + '>' + dedans + '</a>';
      }
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
                    sansVitisoft: sansVitisoft };
})();
