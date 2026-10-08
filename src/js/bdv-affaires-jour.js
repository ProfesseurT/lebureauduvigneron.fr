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
  var OPPOSE = {};       // piste_id -> true : la personne a demande a ne plus etre contactee (N4)
  var TYPE_NOM = {};     // type_id -> nom, pour dire le type d'une nouvelle (lot 57)
  var SIGNES = null;     // lot 55 : devis signes en ligne dont la commande n'est pas telechargee

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
  /* N4 (tour 2, 02/10/2026) : UNE PERSONNE EN OPPOSITION NE SE RELANCE PAS. Son affaire
     n'est ni « a relancer » ni « endormie » : elle sort du bloc, du bilan, de la punaise,
     du calendrier et de « Mes taches ». `oppose` vient de la piste, l'appelant le passe. */
  function etat(a, sommeil, aujourdhui, oppose) {
    var auj = aujourdhui || jourIso();
    if (oppose) {
      return { jours: 0, sommeil: sommeil > 0 ? sommeil : 30, retard: null, relancer: false, endormie: false,
               aRelancer: false, oppose: true };
    }
    var dort = sommeil > 0 ? sommeil : 30;
    var retard = a.rappel ? ecartJours(a.rappel, auj) : null;
    var jours = ecartJours(jourLocal(a.etape_le), auj);
    jours = jours == null ? 0 : Math.max(0, jours);
    var relancer = retard != null && retard >= 0;
    var endormie = retard == null && jours > dort;
    return { jours: jours, sommeil: dort, retard: retard, relancer: relancer, endormie: endormie,
             aRelancer: relancer || endormie };
  }
  function etatIci(a, auj) { return etat(a, SOMMEIL[a.type_id], auj, !!(a.piste_id && OPPOSE[a.piste_id])); }
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
  /* B6 (01/10/2026) : PostgREST plafonne une reponse a 1 000 lignes (Max rows). Au-dela,
     la liste etait tronquee sans un mot. On lit par pages, avec un ORDRE TOTAL (la cle
     unique en dernier) : sans lui, deux pages peuvent se chevaucher ou sauter une ligne. */
  var PAGE = 1000;
  async function lirePages(chemin) {
    var tout = [];
    for (var off = 0; off < 200 * PAGE; off += PAGE) {
      var r = await BdvCompte.api(chemin + '&limit=' + PAGE + '&offset=' + off);
      if (r == null) return null;
      tout = tout.concat(r);
      if (r.length < PAGE) break;
    }
    return tout;
  }
  async function charger() {
    var b = bureau();
    if (!b || !window.BdvCompte) return false;
    try {
      var aff = await lirePages('/affaires?select=affaire_id,titre,rappel,rappel_titre,piste_id,client_id,client_nom,etape_le,type_id'
        + '&issue=eq.en_cours&bureau=eq.' + encodeURIComponent(b) + '&order=affaire_id.asc');
      if (aff == null) return false;
      var som = await lireSommeils(b);
      if (som == null) return false;
      var ids = aff.map(function (a) { return a.piste_id; }).filter(Boolean);
      var noms = {}, clients = {}, opp = {};
      /* Les pistes par paquets de 100 : une adresse de 1 000 identifiants depasse ce
         qu'un serveur accepte de lire. */
      for (var i = 0; i < ids.length; i += 100) {
        var ps = await BdvCompte.api('/pistes?select=piste_id,nom,client_id,opposition&bureau=eq.' + encodeURIComponent(b)
          + '&piste_id=in.(' + ids.slice(i, i + 100).map(encodeURIComponent).join(',') + ')');
        if (ps == null) return false;
        ps.forEach(function (p) { noms[p.piste_id] = p.nom; if (p.client_id) clients[p.piste_id] = String(p.client_id); if (p.opposition) opp[p.piste_id] = true; });
      }
      EN_COURS = aff; NOMS = noms; CLIENT_DE = clients; SOMMEIL = som; OPPOSE = opp;
      await lireSignes(b);
      await lireNouv(b);
      repeindre();
      surveiller();
      return true;
    } catch (e) {
      /* LE LOT 35 N'EST PEUT-ETRE PAS PASSE : `client_nom` n'existe pas encore.
         On relit sans lui plutot que de laisser la journee sans ses affaires. */
      if (e && /client_nom/.test(String(e.detail || ''))) {
        try {
          var a2 = await lirePages('/affaires?select=affaire_id,titre,rappel,rappel_titre,piste_id,client_id,etape_le,type_id'
            + '&issue=eq.en_cours&bureau=eq.' + encodeURIComponent(b) + '&order=affaire_id.asc');
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
    var ts = await lirePages('/affaire_types?select=type_id,sommeil_jours,nom&bureau=eq.' + encodeURIComponent(b) + '&order=type_id.asc');
    if (ts == null) return null;
    var m = {};
    ts.forEach(function (t) { m[t.type_id] = t.sommeil_jours; if (t.nom) TYPE_NOM[t.type_id] = t.nom; });
    return m;
  }

  /* La piece repeint la journee apres chacun de ses gestes : elle pose ici ce
     qu'elle vient de relire (affaires, pistes, types), sans que la journee refasse
     une requete. */
  function poser(affaires, pistes, types) {
    EN_COURS = (affaires || []).filter(function (a) { return a.issue === 'en_cours'; });
    NOMS = {}; CLIENT_DE = {}; SOMMEIL = {}; OPPOSE = {};
    (types || []).forEach(function (t) { SOMMEIL[t.type_id] = t.sommeil_jours; if (t.nom) TYPE_NOM[t.type_id] = t.nom; });
    Object.keys(pistes || {}).forEach(function (k) {
      NOMS[k] = pistes[k].nom;
      if (pistes[k].client_id) CLIENT_DE[k] = String(pistes[k].client_id);
      if (pistes[k].opposition) OPPOSE[k] = true;
    });
    repeindre();
    relireSignes();
  }

  /* ================= LES DEVIS SIGNES EN LIGNE, LOT 55 (01/10/2026) =================
     Le client signe sur /signer/, la base accepte seule. Le vigneron l'apprend de deux
     facons (decision de Ted) : une PUNAISE tant que la commande Vitisoft n'est pas
     telechargee, et un BANDEAU tout de suite si son bureau est ouvert. Plus une ligne au
     courrier du lendemain, qui vient de la vue `v_courrier`.
     UNE LECTURE RATEE NE VIDE RIEN : on garde ce qu'on savait (une absence n'est pas un
     zero). La colonne `signe_le` existe depuis le lot 47 : avant le SQL du lot 55 la
     requete marche et ne rend rien. */
  async function lireSignes(b) {
    b = b || bureau();
    if (!b || !window.BdvCompte) return SIGNES;
    try {
      var l = await BdvCompte.api('/devis?select=devis_id,affaire_id,numero,signe_le,total_ht_c,acheteur'
        + '&statut=eq.accepte&signe_le=not.is.null&commande_telechargee_le=is.null&bureau=eq.' + encodeURIComponent(b)
        + '&order=signe_le.desc&limit=20');
      if (Array.isArray(l)) SIGNES = l;
    } catch (e) {}
    return SIGNES;
  }
  function clientDe(d) { return (d.acheteur && d.acheteur.nom) || 'Ton client'; }
  function punaisesSignes() {
    if (!SIGNES || !SIGNES.length) return [];
    var d = SIGNES[0];
    /* X3 (tour 3) : la seule punaise sans geste se lisait comme une information. Elle porte
       « Ouvrir le devis », un bouton de punaise (`postit__g`, a cote du lien, jamais dedans). */
    var cle = 'signe:' + d.affaire_id + ':' + d.devis_id;
    if (SIGNES.length === 1) return [{ cle: cle, tampon: 'devis signé',
      valeur: clientDe(d), sous: 'devis ' + d.numero + ' : télécharge la commande Vitisoft', href: '/mon-bureau/#affaires',
      gestes: [{ cle: 'signe-ouvrir', id: cle, mot: 'Ouvrir le devis', titre: 'Ouvrir le devis ' + d.numero + ' de ' + clientDe(d) }] }];
    return [{ cle: cle, valeur: String(SIGNES.length), libelle: 'devis signés à commander',
      sous: 'à commencer par ' + clientDe(d) + ', ' + d.numero, href: '/mon-bureau/#affaires',
      gestes: [{ cle: 'signe-ouvrir', id: cle, mot: 'Ouvrir le premier', titre: 'Ouvrir le devis ' + d.numero + ' de ' + clientDe(d) }] }];
  }
  /* LA PUNAISE OUVRE LE DEVIS, pas seulement la piece : la demande passe par
     sessionStorage (`bdv_devis_ouvrir`), comme « Voir son affaire ». Le `href` reste
     dessous pour un clic milieu. */
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('[data-cle^="signe:"] a, [data-signe-ouvrir]');
    if (!a) return;
    var cle = a.getAttribute('data-signe-ouvrir') || (a.closest('[data-cle]') || {}).getAttribute('data-cle');
    var m = /^signe:([^:]+):(.+)$/.exec(String(cle || ''));
    if (!m) return;
    try { sessionStorage.setItem('bdv_devis_ouvrir', JSON.stringify({ affaire: m[1], devis: m[2] })); } catch (e) {}
    /* M10 (01/10/2026) : marque « vu » au clic, mais la piece le DEMARQUE si le devis ne
       s'ouvre pas (`BdvAffaires.ouvrir` appelle `pasVu`) : sinon le bandeau d'un devis
       qu'on n'a jamais vu disparaissait pour toujours. */
    vu(m[2]);
    if (a.hasAttribute('data-signe-ouvrir')) { ev.preventDefault(); ouvrirPiece(); }
  });

  /* X3 : le bouton de la punaise. Ecoute en CAPTURE et arrete la : l'ecouteur commun des
     punaises (src/mon-bureau.njk) decrocherait la punaise comme un geste fait, alors qu'ouvrir
     le devis ne fait rien disparaitre (c'est le telechargement de la commande qui l'enleve). */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-punaise="signe-ouvrir"]');
    if (!b) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    var m = /^signe:([^:]+):(.+)$/.exec(String(b.getAttribute('data-id') || ''));
    if (!m) return;
    try { sessionStorage.setItem('bdv_devis_ouvrir', JSON.stringify({ affaire: m[1], devis: m[2] })); } catch (e) {}
    vu(m[2]);
    ouvrirPiece();
  }, true);

  /* M8 : la punaise d'UNE affaire ouvre cette affaire. Le `href` mene a la piece ; la
     demande posee avant la suit. */
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('[data-cle^="affaire:"] a');
    if (!a) return;
    var m = /^affaire:(.+)$/.exec(String((a.closest('[data-cle]') || {}).getAttribute('data-cle') || ''));
    if (m) { try { sessionStorage.setItem('bdv_affaire_ouvrir', m[1]); } catch (e) {} }
  });

  /* LES DEVIS DEJA VUS (lot 55). Le bandeau vert qui s'en servait est parti au lot 57 ;
     la liste reste HONOREE par les nouvelles : un devis signe ouvert depuis la punaise, ou
     montre par l'ancien bandeau, n'est plus une nouvelle. Cle `bdv_` : elle part a la
     deconnexion, avec le reste. */
  var CLE_VUS = 'bdv_signes_vus_v1';
  function vus() { try { return JSON.parse(localStorage.getItem(CLE_VUS) || '[]') || []; } catch (e) { return []; } }
  function pasVu(id) {
    try { localStorage.setItem(CLE_VUS, JSON.stringify(vus().filter(function (x) { return x !== id; }))); } catch (e) {}
  }
  function vu(id) {
    try { var v = vus(); if (v.indexOf(id) < 0) { v.push(id); localStorage.setItem(CLE_VUS, JSON.stringify(v.slice(-50))); } } catch (e) {}
  }
  /* ================= LES NOUVELLES DE « MON COMMERCE », LOT 57 (03/10/2026) =================
     Demande de Ted : « un point de notif sur la barre laterale Mon commerce, un point sur
     Mon bureau en haut a droite, et un truc en haut comme pour clients a rappeler ». Deux
     sortes de nouvelles, et deux seulement (ses choix) :
       - un devis SIGNE EN LIGNE par un client (la base l'a accepte seule) ;
       - une affaire GAGNEE ou PERDUE PAR UN COLLEGUE (`affaires.close_par`, pose par la base).
     Ce que J'AI fait moi-meme n'est jamais une nouvelle.
     UNE NOUVELLE DISPARAIT QUAND J'OUVRE L'AFFAIRE (ou son devis) : `vuAffaire()`, appelee par
     la piece quand elle peint le panneau ou la pleine page d'une affaire. « Tout marquer comme
     vu » range tout d'un geste.
     LE BANDEAU VERT DES DEVIS SIGNES EST PARTI (choix de Ted) : la pastille de l'en-tete le
     remplace. La PUNAISE, elle, reste : elle dit une chose a faire (telecharger la commande),
     pas une nouvelle.
     Fenetre : trente jours. Ce qui est plus vieux n'est plus une nouvelle.
     UNE LECTURE RATEE NE VIDE RIEN : on garde ce qu'on savait. Avant le SQL du lot 57, la
     colonne `close_par` n'existe pas : la lecture des affaires closes echoue, on n'annonce que
     les devis signes, et on le sait (`SANS_COLLEGUES`). */
  var NOUV = null;            // null = jamais lu ; [] = rien de neuf dans les 30 jours
  var SANS_COLLEGUES = false;
  var CLE_NV = 'bdv_notifs_vues_v1';   // prefixe bdv_ : part a la deconnexion
  var CLE_NB = 'bdv_notifs_n';         // le nombre, lu par le bandeau du site (base.njk)
  var FENETRE = 30 * 86400000;
  var ICO_NOUV = '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 20.5a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';

  function vuesNv() { try { return JSON.parse(localStorage.getItem(CLE_NV) || '{}') || {}; } catch (e) { return {}; } }
  function marquer(cles) {
    try {
      var v = vuesNv(), k;
      cles.forEach(function (c) { v[c] = Date.now(); });
      /* On ne garde que ce qui peut encore apparaitre : trente jours et un peu. */
      for (k in v) if (Date.now() - v[k] > FENETRE + 86400000) delete v[k];
      localStorage.setItem(CLE_NV, JSON.stringify(v));
    } catch (e) {}
  }
  function nouvelles() {
    if (!NOUV) return [];
    var v = vuesNv(), anc = vus();
    return NOUV.filter(function (n) {
      var va = v['a:' + n.affaire];
      return !v[n.cle] && !(va && va >= Date.parse(n.quand)) && !(n.devis && anc.indexOf(n.devis) >= 0);
    });
  }
  /* Les motifs d'une affaire perdue : la MEME liste que MOTIFS de bdv-affaires.js (le banc de
     la signature refuse qu'elles divergent). Un code inconnu reste tel quel. */
  var MOTIFS_NV = { prix: 'Le prix', fournisseur: 'Un fournisseur déjà en place', moment: 'Pas le bon moment',
    sans_reponse: 'Pas de réponse', indisponible: 'Date ou capacité indisponible', autre: 'Autre raison' };
  /* Un numero de devis ne se coupe jamais : traits d'union insecables. */
  function numero(n) { return String(n || '').replace(/-/g, '\u2011'); }
  function ilYA(iso) {
    var t = new Date(iso).getTime(); if (isNaN(t)) return '';
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 2) return 'à l’instant';
    if (m < 60) return 'il y a ' + m + ' min';
    var h = Math.round(m / 60);
    if (h < 24) return 'il y a ' + h + ' h';
    var j = Math.round(h / 24);
    return j === 1 ? 'hier' : 'il y a ' + j + ' jours';
  }
  function euros(c) {
    var n = Number(c); if (!isFinite(n)) return '';
    return Math.round(n / 100).toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' € HT';
  }
  async function lireNouv(b) {
    b = b || bureau();
    if (!b || !window.BdvCompte) return NOUV;
    var depuis = encodeURIComponent(new Date(Date.now() - FENETRE).toISOString());
    var l = [];
    try {
      var s = await BdvCompte.api('/devis?select=devis_id,affaire_id,numero,signe_le,total_ht_c,acheteur'
        + '&statut=eq.accepte&signe_le=gte.' + depuis + '&bureau=eq.' + encodeURIComponent(b)
        + '&order=signe_le.desc&limit=30');
      if (!Array.isArray(s)) return NOUV;
      s.forEach(function (d) {
        l.push({ cle: d.affaire_id + '@' + d.signe_le, sorte: 'signe', affaire: d.affaire_id, devis: d.devis_id,
          quand: d.signe_le, titre: clientDe(d) + ' a signé le devis ' + numero(d.numero),
          sous: [euros(d.total_ht_c), ilYA(d.signe_le)].filter(Boolean).join(', ') });
      });
    } catch (e) { return NOUV; }
    var moi = BdvCompte.monId && BdvCompte.monId();
    if (moi) {
      try {
        var a = await BdvCompte.api('/affaires?select=affaire_id,titre,issue,motif,type_id,close_le,close_par,client_nom,piste_id'
          + '&bureau=eq.' + encodeURIComponent(b) + '&issue=in.(gagnee,perdue)&close_le=gte.' + depuis
          + '&close_par=not.is.null&close_par=neq.' + encodeURIComponent(moi) + '&order=close_le.desc&limit=30');
        if (Array.isArray(a) && a.length) {
          SANS_COLLEGUES = false;
          var ids = a.map(function (x) { return x.piste_id; }).filter(Boolean), noms = {};
          if (ids.length) {
            var ps = await BdvCompte.api('/pistes?select=piste_id,nom&bureau=eq.' + encodeURIComponent(b)
              + '&piste_id=in.(' + ids.slice(0, 100).map(encodeURIComponent).join(',') + ')');
            (ps || []).forEach(function (p) { noms[p.piste_id] = p.nom; });
          }
          if (BdvCompte.trombinoscope) { try { await BdvCompte.trombinoscope(); } catch (e) {} }
          a.forEach(function (x) {
            var qui = (BdvCompte.nomAuteur && BdvCompte.nomAuteur(x.close_par)) || '';
            if (!qui || qui === 'un ancien membre') qui = 'Un collègue';
            var client = (x.piste_id && noms[x.piste_id]) || x.client_nom || x.titre || 'une affaire';
            l.push({ cle: x.affaire_id + '@' + x.close_le, sorte: x.issue, affaire: x.affaire_id,
              quand: x.close_le, titre: qui + (x.issue === 'gagnee' ? ' a gagné ' + client : ' a perdu ' + client),
              sous: [x.issue === 'perdue' ? (MOTIFS_NV[x.motif] || x.motif || '') : (TYPE_NOM[x.type_id] || ''), ilYA(x.close_le)]
                .filter(Boolean).join(', ') });
          });
        } else if (Array.isArray(a)) SANS_COLLEGUES = false;
      } catch (e) { SANS_COLLEGUES = true; }
    }
    l.sort(function (x, y) { return x.quand < y.quand ? 1 : x.quand > y.quand ? -1 : 0; });
    /* LA PREMIERE FOIS SUR CET APPAREIL, on ne deverse pas trente jours d'un coup : ce qui
       a plus de deux jours compte pour vu. Ensuite, la fenetre est de trente jours. */
    var premiere = false;
    try { premiere = localStorage.getItem(CLE_NV) == null; } catch (e) {}
    if (premiere) marquer(l.filter(function (n) { return Date.now() - new Date(n.quand).getTime() > 2 * 86400000; })
      .map(function (n) { return n.cle; }));
    NOUV = l;
    return NOUV;
  }

  /* LA PASTILLE DE L'EN-TETE : [phrase, piece, nature, chiffre, icone], la forme de
     `peindreResume()` (mon-bureau.njk). Une seule nouvelle, on la nomme ; plusieurs, on compte. */
  function nouv() {
    var n = nouvelles();
    if (!n.length) return null;
    var phrase = n.length === 1 ? n[0].titre : n.length + ' nouvelles de ton commerce';
    return [phrase, 'affaires', 'commerce', String(n.length), ICO_NOUV];
  }

  /* LES POINTS : la ligne « Mon commerce » de la barre (et donc sa case de la barre du bas,
     qui est la meme ligne), et « Mon bureau » du bandeau du site, par le nombre range pour
     base.njk. Le point est decoratif ; ce qui s'entend est le texte hors ecran du lien. */
  function peindrePoints() {
    var n = nouvelles().length;
    try { if (n) localStorage.setItem(CLE_NB, String(n)); else localStorage.removeItem(CLE_NB); } catch (e) {}
    if (window.bdvMajBandeau) { try { window.bdvMajBandeau(); } catch (e) {} }
    var a0 = document.querySelector('.bureau-nav__ligne[data-piece="clients"] a');
    if (!a0) return;
    var lien = a0.querySelector('.bureau-nav__ico') || a0;
    var p = lien.querySelector('.bureau-nav__point');
    if (!n) { if (p) p.remove(); return; }
    if (!p) {
      p = document.createElement('span'); p.className = 'bureau-nav__point';
      p.innerHTML = '<span class="hors-ecran"></span>';
      lien.appendChild(p);
    }
    p.firstChild.textContent = n === 1 ? ', une nouvelle' : ', ' + n + ' nouvelles';
  }

  /* LA LISTE, sous la pastille (un panneau a la place d'une bulle sous 700 px). Elle ne
     montre que ce qui est NOUVEAU ; « Ouvrir » mene a l'affaire (et au devis signe), ce qui
     la marque vue. */
  var POP = null, POP_DE = null, VOILE = null;
  function fermerNouv(rendre) {
    if (!POP || POP.hidden) return;
    POP.hidden = true; if (VOILE) VOILE.hidden = true;
    if (POP_DE) POP_DE.setAttribute('aria-expanded', 'false');
    if (rendre && POP_DE && document.contains(POP_DE)) POP_DE.focus();
  }
  function htmlNouv() {
    var n = nouvelles().slice(0, 8);
    var h = '<div class="bdv-nouv__tete"><h2 class="bdv-nouv__titre" id="bdvNouvTitre">Nouvelles de ton commerce</h2>'
      + '<button type="button" class="bdv-nouv__x" data-nouv="fermer" aria-label="Fermer">×</button></div>';
    if (!n.length) return h + '<p class="bdv-nouv__vide">Rien de neuf.</p>';
    h += '<ul class="bdv-nouv__liste">';
    n.forEach(function (x, i) {
      h += '<li class="bdv-nouv__l bdv-nouv__l--' + x.sorte + '"><span class="bdv-nouv__t"><strong></strong><span class="bdv-nouv__s"></span></span>'
        + '<button type="button" class="btn bdv-nouv__o" data-nouv="ouvrir" data-i="' + i + '">Ouvrir</button></li>';
    });
    h += '</ul>';
    var reste = nouvelles().length - n.length;
    if (reste > 0) h += '<p class="bdv-nouv__reste">Et ' + reste + ' de plus, dans Mon commerce.</p>';
    return h + '<div class="bdv-nouv__pied"><button type="button" class="btn" data-nouv="tout">Tout marquer comme vu</button></div>';
  }
  function ouvrirNouv(pastille) {
    if (!POP) {
      POP = document.createElement('div');
      POP.id = 'bdvNouv'; POP.className = 'bdv-nouv'; POP.hidden = true;
      POP.setAttribute('role', 'dialog'); POP.setAttribute('aria-labelledby', 'bdvNouvTitre');
      /* Le voile (visible sous 700 px seulement) : un appui a cote ferme la liste et ne touche
         a RIEN d'autre, pas meme le « Fait » d'une punaise juste au-dessus. */
      VOILE = document.createElement('div');
      VOILE.className = 'bdv-nouv-voile'; VOILE.hidden = true; VOILE.setAttribute('aria-hidden', 'true');
      VOILE.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); fermerNouv(true); });
      document.body.appendChild(VOILE);
      document.body.appendChild(POP);
      POP.addEventListener('click', function (ev) {
        var b = ev.target.closest && ev.target.closest('[data-nouv]');
        if (!b) return;
        var quoi = b.getAttribute('data-nouv');
        if (quoi === 'fermer') { fermerNouv(true); return; }
        if (quoi === 'tout') { marquer(nouvelles().map(function (x) { return x.cle; })); fermerNouv(true); majNouv(); return; }
        var x = nouvelles().slice(0, 8)[+b.getAttribute('data-i')];
        if (!x) return;
        fermerNouv(false);
        if (x.devis) { try { sessionStorage.setItem('bdv_devis_ouvrir', JSON.stringify({ affaire: x.affaire, devis: x.devis })); } catch (e) {} }
        ouvrirPiece(x.affaire);
      });
      POP.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); fermerNouv(true); } });
      document.addEventListener('click', function (ev) {
        if (POP.hidden || POP.contains(ev.target) || (POP_DE && POP_DE.contains(ev.target))) return;
        fermerNouv(false);
      });
    }
    POP_DE = pastille;
    POP.innerHTML = htmlNouv();
    var l = nouvelles().slice(0, 8), lis = POP.querySelectorAll('.bdv-nouv__l');
    for (var i = 0; i < lis.length; i++) {
      lis[i].querySelector('strong').textContent = l[i].titre;
      lis[i].querySelector('.bdv-nouv__s').textContent = l[i].sous;
      lis[i].querySelector('.bdv-nouv__o').setAttribute('aria-label', 'Ouvrir : ' + l[i].titre);
    }
    /* Sous la pastille, cale a droite de la fenetre ; le telephone en fait un panneau du bas (CSS). */
    var r = pastille.getBoundingClientRect(), bas = window.matchMedia && matchMedia('(max-width:700px)').matches;
    POP.style.top = bas ? '' : Math.round(r.bottom + 8) + 'px';
    POP.style.right = bas ? '' : Math.max(16, Math.round(window.innerWidth - r.right)) + 'px';
    POP.hidden = false; VOILE.hidden = false;
    pastille.setAttribute('aria-expanded', 'true');
    var f = POP.querySelector('.bdv-nouv__o') || POP.querySelector('[data-nouv="fermer"]');
    if (f) f.focus();
  }
  /* La pastille est un lien vers « A gagner » (un clic milieu y mene) ; un clic simple ouvre
     la liste. En CAPTURE : l'interception des liens de bdv-nav.js ecoute en bulle. */
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('.bureau-tete__etat--commerce');
    if (!a || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (POP && !POP.hidden && POP_DE === a) { fermerNouv(true); return; }
    ouvrirNouv(a);
  }, true);

  /* Tout ce qui fait changer le nombre passe par ici : la pastille, les points, et la liste
     si elle est ouverte. */
  function majNouv() {
    if (window.bdvMajResume) { try { window.bdvMajResume(); } catch (e) {} }
    var pa = document.querySelector('.bureau-tete__etat--commerce');
    if (pa) { pa.setAttribute('aria-haspopup', 'dialog'); pa.setAttribute('aria-expanded', POP && !POP.hidden ? 'true' : 'false'); }
    peindrePoints();
    if (POP && !POP.hidden) {
      if (!nouvelles().length || !pa) fermerNouv(false);
      else ouvrirNouv(pa);
    }
  }
  /* Appelee par la piece quand elle MONTRE une affaire (panneau ou pleine page). On retient
     l'affaire et l'instant, pas les nouvelles : la pleine page s'ouvre sans les avoir lues, et
     ce qui arrive APRES sur la meme affaire reste une nouvelle. */
  function vuAffaire(id) {
    if (!id) return;
    var avant = nouvelles().length;
    marquer(['a:' + id]);
    if (nouvelles().length !== avant) majNouv();
  }

  /* LA SURVEILLANCE : une requete etroite toutes les deux minutes, et seulement quand la
     page est vue ; plus une au retour sur l'onglet. Pas de connexion temps reel : une
     signature n'est pas une course, deux minutes suffisent. */
  var VEILLE = null;
  function surveiller() {
    majNouv();
    if (VEILLE) return;
    VEILLE = setInterval(function () { if (document.visibilityState === 'visible') relireSignes(); }, 120000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') relireSignes(); });
  }
  function relireSignes() {
    var avant = JSON.stringify((SIGNES || []).map(function (d) { return d.devis_id; }));
    return Promise.all([lireSignes(), lireNouv()]).then(function () {
      var apres = JSON.stringify((SIGNES || []).map(function (d) { return d.devis_id; }));
      if (apres !== avant) repeindre();
      majNouv();
    });
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
    /* Un NOUVEAU CLIENT (cle « p:<piste> », lot 81) : ses affaires sont celles de sa piste. */
    var piste = c.indexOf('p:') === 0 ? c.slice(2) : null;
    return EN_COURS.filter(function (a) {
      if (piste) return a.piste_id === piste;
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
      else if (a.piste_id) s.add('p:' + a.piste_id);
    });
    return s;
  }

  /* LES AFFAIRES DATEES, POUR LE CALENDRIER ET « MES TACHES ». Copies, jamais les
     objets eux-memes : ces deux pieces lisent, elles n'ecrivent pas. Une affaire sans
     rappel n'en fait pas partie, pour la raison qui tient une tache sans date hors du
     courrier : rien ne la fait tomber un jour plutot qu'un autre. */
  function datees() {
    if (!EN_COURS) return [];
    return EN_COURS.filter(function (a) { return !!a.rappel && !(a.piste_id && OPPOSE[a.piste_id]); }).map(function (a) {
      return { affaire_id: a.affaire_id, nom: nomDe(a), titre: a.titre || '',
               rappel: a.rappel, rappel_titre: a.rappel_titre || '' };
    });
  }

  /* Ouvrir « Mes affaires » depuis une autre piece : depuis le 29/09/2026 (lot 43),
     c'est l'onglet « A gagner » de « Mon commerce ». BdvNav.afficher('affaires') le
     traduit, et l'adresse #affaires aussi.
     M8 (01/10/2026) : avec un identifiant, la piece ouvre CETTE affaire (la demande passe
     par `bdv_affaire_ouvrir`, comme « Voir son affaire » de la fiche). Le calendrier,
     Mes taches et la punaise nominative de Ma journee le passent. */
  function ouvrirPiece(id) {
    if (id) { try { sessionStorage.setItem('bdv_affaire_ouvrir', String(id)); } catch (e) {} }
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
  function caseBilan(quoi, n, mot, sous, presse, court, nom, sans) {
    nom = (n == null ? '' : n + ' ') + court + ' : ' + nom;
    return '<button type="button" class="aff-bilan__case' + (sans ? ' aff-bilan__case--sans' : '') + '" data-bilan="' + quoi + '" aria-label="' + nom + '">'
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
      h += caseBilan('relancer', r, 'à relancer', 'promesse dépassée ou plus de nouvelles', r > 0, 'à relancer',
        r + (r > 1 ? ' affaires' : ' affaire') + ' à relancer, promesse dépassée ou plus de nouvelles');
    }
    if (avecViti()) {
      var c = null;
      try { c = window.bdvClientsASuivre ? window.bdvClientsASuivre() : null; } catch (e) { c = null; }
      /* Pas encore compte : pas de chiffre. Sous 700 px, « à suivre » seul : « à suivre : à
         l'ouverture » ne tient pas sur la rangee a 390 px avec deux cases a trois chiffres
         (calcul dans `banc:bureau`). La phrase entiere reste le nom du bouton. */
      /* S18 (01/10/2026) : « à suivre » seul se lisait comme un libelle casse. Le mot court
         nomme la case en entier ; mesure a 390 px, la rangee tient encore (banc:bureau). */
      if (c == null) h += caseBilan('clients', null, 'Clients à suivre<span class="hors-ecran"> :</span>', 'ouvre l’onglet pour les compter',
        false, 'Clients à suivre', 'ouvre l’onglet pour les compter', true);
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

  /* L'ONGLET « MES AFFAIRES » DE MES REGLAGES, 02/10/2026. Les types d'affaires s'y
     reglent. Ce module part avec la page, la piece non : il BRANCHE donc le bloc, et
     confie tout le reste a bdv-affaires.js, charge a la premiere ouverture du panneau.
     Il n'ecrit rien lui-meme : la regle « la piece reste la seule a ecrire » tient. */
  var HOTE_AFF = null;
  function blocReglages() {
    if (!window.BdvReglages || !BdvReglages.brancher) return false;
    BdvReglages.brancher({ blocs: [{
      hote: 'affaires',
      monter: function (c) { HOTE_AFF = c; },
      rafraichir: function () {
        if (!HOTE_AFF) return;
        var v = window.BdvAffaires ? Promise.resolve()
          : (window.BdvNav && BdvNav.chargerAffaires ? BdvNav.chargerAffaires() : Promise.reject(new Error('pas de chargeur')));
        v.then(function () {
          if (window.BdvAffaires && BdvAffaires.reglages) return BdvAffaires.reglages.ouvrir(HOTE_AFF);
          throw new Error('piece absente');
        }).catch(function () {
          HOTE_AFF.innerHTML = '<p class="bdvr-aide">Tes types d’affaires n’ont pas pu s’ouvrir. Ferme tes réglages et rouvre-les.</p>';
        });
      },
      enregistrer: function () {
        return window.BdvAffaires && BdvAffaires.reglages ? BdvAffaires.reglages.enregistrer() : undefined;
      }
    }] });
    return true;
  }
  if (!blocReglages()) document.addEventListener('DOMContentLoaded', blocReglages);

  /* L'AFFAIRE EN PLEINE PAGE, 03/10/2026 : /mon-bureau/#affaire=<id>, ouverte par
     « Agrandir ». Meme principe que la fiche client (#fiche=, mon-bureau.njk) : un
     demarrage ALLEGE en deux etapes, le bureau puis l'affaire. La piece seule ecrit,
     elle est chargee ici. Rend vrai si l'adresse est la sienne. */
  function pageAffaire() {
    var h = location.hash || '', id = null;
    if (h.indexOf('#affaire=') !== 0) return false;
    try { id = decodeURIComponent(h.slice(9)); } catch (e) { id = null; }
    if (!id) return false;
    document.body.classList.add('bdv-page-affaire');
    entrer('Affaire');
    function echec(t) {
      var p = document.getElementById('pageAffCorps') || document.body;
      if (p.querySelector && p.querySelector('.aff-vide')) return;
      var n = document.createElement('p'); n.className = 'aff-vide'; n.setAttribute('role', 'status');
      n.textContent = t + ' ';
      var a = document.createElement('a'); a.href = '/mon-bureau/#affaires'; a.textContent = 'Retour à Mon commerce';
      n.appendChild(a); p.appendChild(n);
    }
    var etapes = [
      { cle: 'bureau', texte: 'Ton bureau', faire: function () {
        if (!(window.BdvCompte && BdvCompte.chargerBureau)) return false;
        return BdvCompte.chargerBureau().then(function (b) { return !!b; });
      } },
      { cle: 'affaire', texte: 'L’affaire', faire: function () {
        if (!(window.BdvNav && BdvNav.chargerAffaires)) return false;
        return BdvNav.chargerAffaires().then(function () { return window.BdvAffaires.page(id); });
      } }
    ];
    var fin = window.BdvAmorce ? BdvAmorce.lancer(etapes) : Promise.reject(new Error('amorce absente'));
    fin.then(function (bilan) {
      if (bilan && bilan.rates && bilan.rates.length) echec('L’affaire n’a pas pu s’ouvrir : vérifie ta connexion et recharge la page.');
    })['catch'](function () { echec('L’affaire n’a pas pu s’ouvrir : vérifie ta connexion et recharge la page.'); });
    return true;
  }

  /* LA PAGE DE TRAVAIL GARDE LA BARRE ET L'EN-TETE, 08/10/2026. Demande de Ted : « je garde
     mon bandeau a gauche et mon haut de page ». Le contenu se pose dans `#bureauPage`
     (mon-bureau.njk), a la place des pieces, et l'en-tete dit ce qu'on regarde. Aucune piece
     n'est la courante (bdv-nav.js le sait par `bdv-page-travail`), et un clic sur la barre
     recharge le bureau dans cet onglet (arbitrage de Ted). Vit ici et pas dans le script en
     ligne : `banc:poids` est au plafond. */
  function entrer(titre) {
    var d = document, hote = d.getElementById('bureauPage'), h1 = d.getElementById('bureauPiece');
    d.body.classList.add('bdv-page-travail');
    if (window.BdvNav) BdvNav.monter(d.getElementById('bureauNav'), null);
    if (hote) hote.hidden = false;
    if (h1) h1.textContent = titre;
    if (window.bdvBrancherTete) window.bdvBrancherTete();
    return hote;
  }

  /* LA FICHE EN PLEINE PAGE, /mon-bureau/#fiche=<cle> (24/09/2026), demenagee ici le
     08/10/2026. Demarrage ALLEGE : le bureau, ses affaires (pour « Affaire en cours », une
     lecture ratee ne bloque pas), puis la fiche. Rend vrai si l'adresse est la sienne. */
  function avisFiche(texte) {
    var d = document, p = d.getElementById('pageFicheAvis');
    if (!p) { p = d.createElement('p'); p.id = 'pageFicheAvis'; p.className = 'page-fiche__avis'; p.setAttribute('role', 'status'); (d.getElementById('bureauPage') || d.body).appendChild(p); }
    p.textContent = texte + ' ';
    var a = d.createElement('a'); a.href = '/mon-bureau/#annuaire'; a.textContent = 'Retour à Mes clients';
    a.addEventListener('click', function (e) { e.preventDefault(); location.href = '/mon-bureau/#annuaire'; location.reload(); });
    p.appendChild(a);
  }
  function pageFiche() {
    var h = location.hash || '', id = null;
    if (h.indexOf('#fiche=') !== 0) return false;
    try { id = decodeURIComponent(h.slice(7)); } catch (e) { id = null; }
    if (!id) return false;
    document.body.classList.add('bdv-page-fiche');
    var hote = entrer('Fiche client');
    /* La fiche vit dans `#modale` ; `monter()` vient de la sortir sous <body> (pour la modale
       et le tiroir). En pleine page on la range dans la page de travail : elle prend la place
       des pieces, et un tiroir ouvert depuis elle (une affaire) la pousse. */
    var mo = document.getElementById('modale');
    if (hote && mo) hote.appendChild(mo);
    var rate = 'La fiche n’a pas pu s’ouvrir : vérifie ta connexion et recharge la page.';
    var etapes = [
      { cle: 'bureau', texte: 'Ton bureau', faire: function () {
        if (!(window.BdvCompte && BdvCompte.chargerBureau)) return false;
        return BdvCompte.chargerBureau().then(function (b) { return !!b; });
      } },
      { cle: 'affaires', texte: 'Ses affaires', faire: function () {
        return Promise.resolve(charger())['catch'](function () {}).then(function () { return true; });
      } },
      { cle: 'fiche', texte: 'La fiche du client', faire: function () {
        if (!(window.BdvNav && BdvNav.chargerEcrans)) return false;
        return BdvNav.chargerEcrans().then(function () {
          return typeof window.ouvrirFicheClient === 'function' ? window.ouvrirFicheClient(id, {}) : false;
        }).then(function (ok) {
          if (!ok) avisFiche('Ce client n’est pas dans les ventes de ton bureau.');
          return ok !== false;
        });
      } }
    ];
    var fin = window.BdvAmorce ? BdvAmorce.lancer(etapes) : Promise.reject(new Error('amorce absente'));
    fin.then(function (bilan) { if (bilan && bilan.rates && bilan.rates.length) avisFiche(rate); })['catch'](function () { avisFiche(rate); });
    return true;
  }

  window.BdvAffairesJour = { charger: charger, pageAffaire: pageAffaire, pageFiche: pageFiche, poser: poser, punaises: punaises, duClient: duClient, clientsEnAffaire: clientsEnAffaire,
                             datees: datees, ouvrirPiece: ouvrirPiece, famille: FAMILLE,
                             etat: etat, aRelancer: aRelancer, peindreBilan: peindreBilan,
                             vu: function (id) { vu(id); majNouv(); },
                             pasVu: function (id) { pasVu(id); majNouv(); },
                             nouv: nouv, vuAffaire: vuAffaire, nouvelles: nouvelles, signes: function () { return SIGNES; }, relireSignes: relireSignes, punaisesSignes: punaisesSignes };
})();
