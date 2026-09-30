/* ================================================================
   LE BUREAU DU VIGNERON, les affaires dans « Ma journee »
   ----------------------------------------------------------------
   Ecrit le 28/09/2026, lot 35. Voir CLAUDE.md, « LES AFFAIRES ».

   CE MODULE NE FAIT QUE LIRE. Il est charge avec la page, parce que la journee
   en a besoin des l'ouverture ; la piece « Mes affaires » (bdv-affaires.js),
   elle, attend le premier clic et reste la SEULE a ecrire.

   Il porte ce qui se lit sans ouvrir la piece, et rien d'autre :
   1. les punaises du panneau : les affaires a relancer ;
   2. les affaires en cours d'un client, pour sa fiche ;
   3. LA REGLE « A RELANCER », ecrite ici UNE fois (lot 45) : la piece l'appelle
      par `etat()`, la punaise et le bilan aussi. Trois nombres sous un meme mot,
      c'est un seul calcul ;
   4. le bilan commun de « Mon commerce » (#bureauComBilan, lot 45).

   SA LECTURE PASSE PAR `amorcer()` de mon-bureau.njk, jamais au chargement du
   fichier : une lecture lancee a cote de la sequence tomberait avant que la cle
   du bureau soit connue, et rendrait une zone vide (regle du 17/09/2026).

   LE VIGNERON EMPATHIQUE L'A DIT EN PREMIER : « que ca me ressorte tout seul
   dans Ma journee le jour ou je dois rappeler. Si je dois aller le chercher, je
   n'irai pas. » Et une relance client passe AVANT une piste : ces punaises
   viennent apres les rappels clients et les taches dans la pile.
   ================================================================ */
(function () {
  'use strict';

  var EN_COURS = null;   // null = pas encore lu ; [] = lu, rien en cours
  var NOMS = {};         // piste_id -> nom
  var CLIENT_DE = {};    // piste_id -> client_id, pour une piste devenue cliente (lot 44)
  var SOMMEIL = {};      // type_id -> sommeil_jours, le delai qui endort une affaire (lot 45)

  /* LA FAMILLE « MES AFFAIRES », LOT 37 (28/09/2026). Elle rejoint la liste unique des
     familles, celle que lisent le filtre du calendrier et celui de « Mes taches ».
     ELLE EST AJOUTEE ICI, A L'EXECUTION, ET PAS ECRITE DANS bdv-echeances.js : ce
     fichier-la est joint a la fonction `agenda-ics` avec une empreinte, et le toucher
     forcerait un redeploiement pour une famille que l'abonnement .ics n'emportera
     JAMAIS (decision de Ted du 15/09/2026, FAMILLES_PUBLIQUES). La liste reste une :
     personne d'autre n'y ajoute, et on n'ajoute qu'une fois. */
  var FAMILLE = { cle: 'affaires', label: 'Mes affaires', quoi: 'Ceux que je veux gagner' };
  (function inscrire() {
    var l = window.BdvEcheances && BdvEcheances.familles;
    if (!l || !l.push) return;
    for (var i = 0; i < l.length; i++) if (l[i].cle === FAMILLE.cle) return;
    l.push(FAMILLE);
  })();

  /* Le reste du bureau se repeint par « Mes taches » : son `rendre()` repose le panneau
     ET previent le calendrier par `bdv:taches`. Un seul chemin, celui qui existe. */
  function repeindre() {
    if (window.BdvTaches && BdvTaches.rendre) { try { BdvTaches.rendre(); return; } catch (e) {} }
    if (window.bdvMajPanneau) { try { window.bdvMajPanneau(); } catch (e) {} }
    peindreBilan();   // sans « Mes taches », personne n'emet bdv:taches
  }

  function bureau() { return window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau(); }
  function jourIso(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* L'horodatage de la base (etape_le) est en UTC : on le ramene au jour LOCAL
     avant de compter, sinon une etape franchie a 23 h passe a demain. */
  function versDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function ecartJours(isoA, isoB) {
    var a = versDate(isoA), b = versDate(isoB);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  }
  function jourLocal(horo) {
    var d = horo ? new Date(horo) : null;
    return d && !isNaN(d) ? jourIso(d) : null;
  }

  /* ================= LA REGLE « A RELANCER », LOT 45 (29/09/2026) =================
     A RELANCER : un rappel passe ou du jour. ENDORMIE : aucun rappel, et plus
     longtemps dans l'etape que le delai du type. Une affaire qui a une date de
     rappel dans trois mois n'est PAS endormie : le client a dit « rappelez en
     janvier », et c'est exactement ce qu'on a note. `aRelancer` reunit les deux :
     c'est ce que compte le bloc « A relancer : N » de la piece, la punaise de Ma
     journee et la case du bilan. ELLE N'EST ECRITE QU'ICI : `etat()` de
     bdv-affaires.js l'appelle, il ne la redit pas. */
  function etat(a, sommeil, aujourdhui) {
    var auj = aujourdhui || jourIso();
    var dort = sommeil > 0 ? sommeil : 30;
    var retard = a.rappel ? ecartJours(a.rappel, auj) : null;
    var jours = ecartJours(jourLocal(a.etape_le), auj);
    jours = jours == null ? 0 : Math.max(0, jours);
    var relancer = retard != null && retard >= 0;
    var endormie = retard == null && jours > dort;
    return { jours: jours, sommeil: dort, retard: retard, relancer: relancer, endormie: endormie,
             aRelancer: relancer || endormie };
  }
  function etatIci(a, auj) { return etat(a, SOMMEIL[a.type_id], auj); }
  /* Les affaires a relancer, la plus en retard d'abord, les endormies ensuite :
     le meme ordre que le bloc de la piece. */
  function aRelancer() {
    if (!EN_COURS) return null;
    var auj = jourIso();
    return EN_COURS.filter(function (a) { return etatIci(a, auj).aRelancer; })
      .sort(function (x, y) {
        var rx = etatIci(x, auj).retard, ry = etatIci(y, auj).retard;
        return (ry == null ? -1 : ry) - (rx == null ? -1 : rx);
      });
  }

  /* Trois requetes etroites : les affaires en cours (sans leurs notes), le delai de
     sommeil de chaque type, puis le nom des seules pistes qui portent une affaire.
     Rend `false` si la lecture a echoue, comme les autres etapes de l'amorcage. */
  async function charger() {
    var b = bureau();
    if (!b || !window.BdvCompte) return false;
    try {
      var aff = await BdvCompte.api('/affaires?select=affaire_id,titre,rappel,rappel_titre,piste_id,client_id,client_nom,etape_le,type_id'
        + '&issue=eq.en_cours&bureau=eq.' + encodeURIComponent(b));
      if (aff == null) return false;
      var som = await lireSommeils(b);
      if (som == null) return false;
      var ids = aff.map(function (a) { return a.piste_id; }).filter(Boolean);
      var noms = {}, clients = {};
      if (ids.length) {
        var ps = await BdvCompte.api('/pistes?select=piste_id,nom,client_id&bureau=eq.' + encodeURIComponent(b)
          + '&piste_id=in.(' + ids.map(encodeURIComponent).join(',') + ')');
        (ps || []).forEach(function (p) { noms[p.piste_id] = p.nom; if (p.client_id) clients[p.piste_id] = String(p.client_id); });
      }
      EN_COURS = aff; NOMS = noms; CLIENT_DE = clients; SOMMEIL = som;
      repeindre();
      return true;
    } catch (e) {
      /* LE LOT 35 N'EST PEUT-ETRE PAS PASSE : `client_nom` n'existe pas encore.
         On relit sans lui plutot que de laisser la journee sans ses affaires. */
      if (e && /client_nom/.test(String(e.detail || ''))) {
        try {
          var a2 = await BdvCompte.api('/affaires?select=affaire_id,titre,rappel,rappel_titre,piste_id,client_id,etape_le,type_id'
            + '&issue=eq.en_cours&bureau=eq.' + encodeURIComponent(b));
          if (a2 == null) return false;
          var s2 = await lireSommeils(b);
          if (s2 == null) return false;
          EN_COURS = a2; SOMMEIL = s2;
          repeindre();
          return true;
        } catch (x) { return false; }
      }
      return false;
    }
  }

  /* Le delai de chaque type : la colonne est `sommeil_jours` (supabase/lot34-affaires.sql). */
  async function lireSommeils(b) {
    var ts = await BdvCompte.api('/affaire_types?select=type_id,sommeil_jours&bureau=eq.' + encodeURIComponent(b));
    if (ts == null) return null;
    var m = {};
    ts.forEach(function (t) { m[t.type_id] = t.sommeil_jours; });
    return m;
  }

  /* La piece repeint la journee apres chacun de ses gestes : elle pose ici ce
     qu'elle vient de relire (affaires, pistes, types), sans que la journee refasse
     une requete. */
  function poser(affaires, pistes, types) {
    EN_COURS = (affaires || []).filter(function (a) { return a.issue === 'en_cours'; });
    NOMS = {}; CLIENT_DE = {}; SOMMEIL = {};
    (types || []).forEach(function (t) { SOMMEIL[t.type_id] = t.sommeil_jours; });
    Object.keys(pistes || {}).forEach(function (k) {
      NOMS[k] = pistes[k].nom;
      if (pistes[k].client_id) CLIENT_DE[k] = String(pistes[k].client_id);
    });
    repeindre();
  }

  function nomDe(a) {
    if (a.piste_id) return NOMS[a.piste_id] || a.titre;
    return a.client_nom || a.titre;
  }

  /* UNE punaise, et pas une par affaire : la pile en porte cinq au plus, et une
     affaire ne passe pas devant un client qui attend. A un seul on nomme, a
     plusieurs on compte (regle du 10/09/2026).
     DEPUIS LE LOT 45, ELLE COMPTE AVEC LA REGLE UNIQUE : les endormies sans rappel
     en font partie. « N affaires a relancer » dit le meme nombre que le bloc
     « A relancer : N » de la piece et que la case du bilan. */
  function punaises() {
    var dues = aRelancer();
    if (!dues || !dues.length) return [];
    var auj = jourIso();
    var prem = dues[0];
    var retard = !prem.rappel || prem.rappel < auj;
    if (dues.length === 1) {
      return [{ cle: 'affaire:' + prem.affaire_id,
        tampon: !prem.rappel ? 'affaire endormie' : (retard ? 'affaire en retard' : 'affaire du jour'),
        valeur: nomDe(prem),
        sous: prem.rappel ? (prem.rappel_titre || 'une affaire à relancer') : 'aucun rappel noté, à relancer',
        ton: retard ? 'vieux' : '',
        href: '/mon-bureau/#affaires' }];
    }
    return [{ cle: 'affaires',
      valeur: String(dues.length),
      libelle: 'affaires à relancer',
      sous: 'à commencer par ' + nomDe(prem),
      ton: retard ? 'vieux' : '',
      href: '/mon-bureau/#affaires' }];
  }

  /* LES AFFAIRES D'UN CLIENT : portees par son numero, OU par une piste devenue ce client
     (`pistes.client_id`, lot 44). Sans la seconde, « Clients a suivre » lui proposait
     d'en creer une deuxieme. */
  function duClient(cle) {
    if (!EN_COURS || cle == null) return [];
    var c = String(cle);
    return EN_COURS.filter(function (a) {
      return (a.client_id != null && String(a.client_id) === c) || (!!a.piste_id && CLIENT_DE[a.piste_id] === c);
    });
  }

  /* UN CLIENT, UNE FOIS, LOT 45 (29/09/2026). Les clients qui ont une affaire en cours,
     par la MEME regle que `duClient` : son numero, ou une piste devenue ce client.
     « Clients a suivre » les retire A L'AFFICHAGE : l'affaire l'emporte, il est suivi
     dans « A gagner ». `null` tant que les affaires ne sont pas lues : on ne sait pas,
     donc on ne retire personne (une absence n'est pas un zero). */
  function clientsEnAffaire() {
    if (!EN_COURS) return null;
    var s = new Set();
    EN_COURS.forEach(function (a) {
      if (a.client_id != null) s.add(String(a.client_id));
      if (a.piste_id && CLIENT_DE[a.piste_id]) s.add(CLIENT_DE[a.piste_id]);
    });
    return s;
  }

  /* LES AFFAIRES DATEES, POUR LE CALENDRIER ET « MES TACHES ». Copies, jamais les
     objets eux-memes : ces deux pieces lisent, elles n'ecrivent pas. Une affaire sans
     rappel n'en fait pas partie, pour la raison qui tient une tache sans date hors du
     courrier : rien ne la fait tomber un jour plutot qu'un autre. */
  function datees() {
    if (!EN_COURS) return [];
    return EN_COURS.filter(function (a) { return !!a.rappel; }).map(function (a) {
      return { affaire_id: a.affaire_id, nom: nomDe(a), titre: a.titre || '',
               rappel: a.rappel, rappel_titre: a.rappel_titre || '' };
    });
  }

  /* Ouvrir « Mes affaires » depuis une autre piece : depuis le 29/09/2026 (lot 43),
     c'est l'onglet « A gagner » de « Mon commerce ». BdvNav.afficher('affaires') le
     traduit, et l'adresse #affaires aussi. La piece elle-meme ne sait pas
     encore deplier une affaire donnee : on l'ouvre, la relance est en tete. */
  function ouvrirPiece() {
    if (window.BdvNav && BdvNav.afficher) { try { BdvNav.afficher('affaires'); return; } catch (e) {} }
    location.hash = '#affaires';
  }

  /* ================= LE BILAN COMMUN DE « MON COMMERCE », LOT 45 (29/09/2026) =================
     Trois cases au-dessus des deux onglets, chacune un bouton qui mene a son nombre.
     `poserOnglets()` (bdv-nav.js) decide s'il est dans la piece ; ce module le peint,
     sans jamais charger le moteur des ventes. Il se repeint sur `bdv:taches` (les
     affaires ont bouge), sur `bdv:clients` (Clients a suivre vient de se calculer)
     et a chaque `poserOnglets()`.
     UNE ABSENCE N'EST PAS UN ZERO : affaires pas lues, aucune case d'affaire ;
     Clients a suivre pas encore calcule, une phrase et pas de chiffre. Aucun montant. */
  function avecViti() { return !(window.BdvNav && BdvNav.avecVitisoft && !BdvNav.avecVitisoft()); }
  function dansLaPiece() { return !!(window.BdvNav && BdvNav.ongletCourant && BdvNav.ongletCourant()); }
  /* UNE CASE, DEUX DESSINS (verificateur du lot 45, 29/09/2026). Sur l'ordinateur : le
     chiffre, le mot en capitales, la sous-ligne. Sous 700 px : le chiffre et un mot COURT
     (`court`, « 2 à relancer »), sur une seule rangee de 44 px. Le NOM ACCESSIBLE ne change
     pas avec la largeur : `aria-label` porte la phrase entiere (« 2 affaires à relancer,
     rappel passé ou affaire endormie »). */
  /* WCAG 2.5.3, LE NOM CONTIENT CE QU'ON VOIT : il COMMENCE par le texte du telephone
     (« 2 à relancer »), puis la phrase entiere, qui contient deja celui de l'ordinateur
     mot pour mot : on ne le repete pas. `banc:bureau` le verifie, etat par etat. */
  function caseBilan(quoi, n, mot, sous, presse, court, nom) {
    nom = (n == null ? '' : n + ' ') + court + ' : ' + nom;
    return '<button type="button" class="aff-bilan__case" data-bilan="' + quoi + '" aria-label="' + nom + '">'
      + (n == null ? '' : '<span class="aff-bilan__n' + (presse ? ' aff-bilan__n--presse' : '') + '">' + n + '</span> ')
      + '<span class="aff-bilan__l">' + mot + '</span>'
      + '<span class="aff-bilan__c">' + court + '</span>'
      + (sous ? ' <span class="aff-bilan__s">' + sous + '</span>' : '') + '</button>';
  }
  function htmlBilanCommun() {
    var h = '';
    var rel = aRelancer();
    if (EN_COURS && rel) {
      var n = EN_COURS.length, r = rel.length;
      /* LES MOTS EN BAS DE CASSE APRES UN CHIFFRE : l'ordinateur les passe en capitales. */
      var ms = n > 1 ? 'affaires en cours' : 'affaire en cours';
      h += caseBilan('affaires', n, ms, '', false, 'en cours', n + ' ' + ms);
      h += caseBilan('relancer', r, 'à relancer', 'rappel passé ou affaire endormie', r > 0, 'à relancer',
        r + (r > 1 ? ' affaires' : ' affaire') + ' à relancer, rappel passé ou affaire endormie');
    }
    if (avecViti()) {
      var c = null;
      try { c = window.bdvClientsASuivre ? window.bdvClientsASuivre() : null; } catch (e) { c = null; }
      /* Pas encore compte : pas de chiffre. Sous 700 px, « à suivre » seul : « à suivre : à
         l'ouverture » ne tient pas sur la rangee a 390 px avec deux cases a trois chiffres
         (calcul dans `banc:bureau`). La phrase entiere reste le nom du bouton. */
      if (c == null) h += caseBilan('clients', null, 'Clients à suivre<span class="hors-ecran"> :</span>', 'comptés à l’ouverture de l’onglet',
        false, 'à suivre', 'Clients à suivre : comptés à l’ouverture de l’onglet');
      /* Zero PARCE QUE tous sont deja dans une affaire : pas de « 0 », la phrase dit ou ils
         sont. Un vrai zero, sans affaire, garde son chiffre. */
      else if (c === 0 && window.bdvClientsASuivre.tousEnAffaire && window.bdvClientsASuivre.tousEnAffaire())
        h += caseBilan('clients', null, 'Tous tes clients à suivre sont dans une affaire', '', false, 'tous en affaire',
          'Tous tes clients à suivre sont dans une affaire');
      else {
        var mc = c > 1 ? 'clients à suivre' : 'client à suivre';
        var part = window.bdvClientsASuivre.partiel && window.bdvClientsASuivre.partiel() ? 'sans les premiers achats pour l’instant' : '';
        h += caseBilan('clients', c, mc, part, false, 'à suivre', c + ' ' + mc + (part ? ', ' + part : ''));
      }
    }
    /* Sans Vitisoft et sans affaire en cours, il n'y a rien a dresser. */
    if (!avecViti() && !(EN_COURS && EN_COURS.length)) return '';
    return h;
  }
  function peindreBilan() {
    var b = document.getElementById('bureauComBilan');
    if (!b) return;
    brancherBilan(b);
    var h = htmlBilanCommun();
    b.hidden = !dansLaPiece() || !h;
    if (b.innerHTML === h) return;
    /* Repeindre sous le doigt ne perd pas le focus : on le rend a la meme case. */
    var act = document.activeElement, garde = act && b.contains(act) ? act.getAttribute('data-bilan') : null;
    b.innerHTML = h;
    if (garde) { var n = b.querySelector('[data-bilan="' + garde + '"]'); if (n) { try { n.focus(); } catch (e) {} } }
  }
  /* LES GESTES. « A gagner » peut ne pas etre chargee : la demande passe par
     sessionStorage (`bdv_affaire_vue`), comme « Nouvelle affaire » de la fiche. La vue
     Liste n'est demandee QU'EN MEMOIRE : la piece ne reecrit pas `bdv_aff_vue`. */
  function brancherBilan(b) {
    if (b.getAttribute('data-branche')) return;
    b.setAttribute('data-branche', '1');
    b.addEventListener('click', function (ev) {
      var k = ev.target.closest && ev.target.closest('[data-bilan]');
      if (!k || !window.BdvNav) return;
      var quoi = k.getAttribute('data-bilan');
      if (quoi === 'clients') {
        if (window.bdvMotifTous) { try { window.bdvMotifTous(); } catch (e) {} }
        BdvNav.afficher('clients', { onglet: 'suivre' });
        return;
      }
      var dem = quoi === 'relancer' ? { filtre: '', vue: 'liste', focus: 'relancer' } : { filtre: '' };
      try { sessionStorage.setItem('bdv_affaire_vue', JSON.stringify(dem)); } catch (e) {}
      BdvNav.afficher('clients', { onglet: 'gagner' });
    });
  }
  document.addEventListener('bdv:taches', peindreBilan);
  document.addEventListener('bdv:clients', peindreBilan);

  window.BdvAffairesJour = { charger: charger, poser: poser, punaises: punaises, duClient: duClient, clientsEnAffaire: clientsEnAffaire,
                             datees: datees, ouvrirPiece: ouvrirPiece, famille: FAMILLE,
                             etat: etat, aRelancer: aRelancer, peindreBilan: peindreBilan };
})();
