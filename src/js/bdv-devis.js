/* ================================================================
   LE BUREAU DU VIGNERON, le devis d'une affaire (lot 47, 30/09/2026)
   ----------------------------------------------------------------
   Specification tranchee : `Claude outputs/lot47-spec.md` (sections A, B, E).
   Voir CLAUDE.md, « LOT 47 ».

   CHARGE AU CLIC, jamais avec la page : bdv-affaires.js le pose (avec
   bdv-devis-calcul.js et bdv-devis.css) au premier « Nouveau devis » ou au
   premier devis rouvert. Pas un octet dans bdv-nav.js ni dans le code bloquant.

   CE FICHIER N'ECRIT QUE PAR QUATRE FONCTIONS DE LA BASE, `devis_enregistrer`,
   `devis_abandonner`, `devis_accepter` (lot 49) et `devis_envoyer` (lot 50) : `authenticated`
   n'a que SELECT sur les tables du devis.

   LOT 50 (01/10/2026) : « JE L'AI ENVOYE ». Aucun mail ne part d'ici : le vigneron envoie le
   PDF par sa messagerie, et le bureau le NOTE (date, et le rappel de relance de l'affaire).
   Un devis envoye est fige, comme a la base : « REFAIRE CE DEVIS » le recopie sous un nouveau
   numero, et l'ancien passe abandonne dans la meme transaction (`p_version_de`).
   Le numero D-AAAA-NNNN est donne PAR LA BASE a l'enregistrement : aucun
   numero n'existe a l'ecran avant. Un retour vide, ou sans numero, est un
   ECHEC dit comme tel, jamais « enregistre ».

   LA BOITE `#devisModale` (`tmod dmod`) passe par `BdvTiroir.poser/retirer`,
   comme le panneau d'une affaire, la tache et la fiche client : UNE boite a la
   fois. L'ordre est celui du lot 44 : le panneau d'affaire ecrit son etape en
   attente et se retire, puis le devis se pose. « Retour a l'affaire » fait le
   chemin inverse.

   LE BROUILLON VIT SUR L'APPAREIL (localStorage, `bdv_devis_brouillon_<affaire>`,
   prefixe `bdv_` : il part a la deconnexion), tant que le devis n'est pas
   enregistre. Il s'efface apres un enregistrement reussi.

   L'IMPRESSION PASSE PAR UN IFRAME CACHE, meme origine, rempli par
   `htmlPapier()` (pur) avec sa propre feuille `bdv-devis-papier.css` : JAMAIS de
   `@media print` dans la page, qui porte deja `#printReport` et le `@page A3` du
   calendrier.
   ================================================================ */
(function () {
  'use strict';

  var C = window.BdvDevisCalcul;
  var CLE_BROUILLON = 'bdv_devis_brouillon_';
  var MAX_LIGNES = 200, MAX_QTE = 99999, MAX_PU = 9999999;
  var PREMIERES = 8;

  var MOT_PANNE = 'Le devis n’est pas enregistré, ta connexion a coupé. Tes lignes sont gardées.';
  var MOT_REFUS = 'Le devis n’est pas enregistré : la base l’a refusé. Tes lignes sont gardées.';
  var MOT_SQL = 'Le devis n’est pas encore disponible sur ton compte.';
  /* Un retour vide alors que le reseau a repondu : on ne dit pas « ta connexion a coupe ». */
  var MOT_VIDE = 'Le devis n’est pas enregistré. Réessaie dans un instant. Tes lignes sont gardées.';
  /* La fiche du domaine n'a pas pu etre LUE : ce n'est pas une fiche incomplete. */
  var MOT_DOMAINE_ILLISIBLE = 'Je n’arrive pas à lire la fiche de ton domaine. Vérifie ta connexion et rouvre le devis.';
  var MOT_CORRIGER = 'à corriger';
  var PENALITES = 'Pénalités de retard : taux BCE majoré de 10 points. Indemnité forfaitaire pour frais de recouvrement : 40\u00a0€ (Code de commerce, L441-10).';
  var ACCISES = 'Prix HT, droits d’accises inclus.';
  /* LOT 49 : la commande Vitisoft. Les deux phrases du mode d'emploi vivent ici, une fois. */
  var IMPORT_VITI = 'Dans Vitisoft : Commandes/BL, menu Outils, Importer des commandes, puis choisis ce fichier.';
  var DEJA_12 = 'Si Vitisoft répond que la commande est déjà intégrée, elle y est déjà : rien à refaire.';
  var MOT_SQL_CMD = 'La commande Vitisoft n’est pas encore disponible sur ton compte.';
  var MOT_SQL_ENV = 'Noter l’envoi n’est pas encore disponible sur ton compte.';
  /* Une semaine pour relancer, et jamais apres l'expiration : passe ce jour, le devis ne
     tient plus ses prix. Le vigneron change la date s'il veut. */
  var RELANCE_JOURS = 7;
  /* LOT 51 : le motif d'un refus est celui d'une affaire perdue, dans le meme ordre. La
     liste vit aussi dans bdv-affaires.js (MOTIFS) et dans la base (`devis_refuse_motif`) :
     `npm run banc:devis` refuse qu'elles divergent. */
  var MOTIFS_REFUS = [
    ['prix', 'Le prix'], ['fournisseur', 'Un fournisseur déjà en place'],
    ['moment', 'Pas le bon moment'], ['sans_reponse', 'Pas de réponse'],
    ['indisponible', 'Date ou capacité indisponible'], ['autre', 'Autre raison']
  ];
  var MOT_SQL_REFUS = 'Noter un refus n’est pas encore disponible sur ton compte.';
  var MOT_SQL_ANNUL = 'Annuler une acceptation n’est pas encore disponible sur ton compte.';
  /* LOT 52 : la copie du devis envoye, et la trace du fichier de commande. */
  var MOT_COPIE_RATEE = 'La copie du devis n’a pas pu être gardée.';
  var MOT_TRACE_RATEE = 'Ce téléchargement n’a pas pu être noté.';
  /* LOT 53 : la livraison. Trois facons de livrer, dans les mots du vigneron. */
  var MODES_LIV = [['client', 'À l’adresse du client'], ['adresse', 'À une autre adresse'], ['retrait', 'Il vient chercher au domaine']];
  var MOT_SQL_LIV = 'La livraison sur le devis n’est pas encore disponible sur ton compte. Tes lignes sont gardées.';
  var TRANSPORT_VITI = 'Des frais de port : dans Vitisoft, la configuration d’import doit avoir un « Produit pour transport », sinon la commande est refusée.';
  var FEUILLES_PAPIER = ['/css/bdv-theme.css', '/css/bdv-devis-papier.css'];
  var FEUILLES = null;   // le texte des deux feuilles, lu une fois par session
  /* Police et encre du pied de page imprime, en dur : une boite de marge de @page ne lit
     pas les jetons (mesure du verificateur, 30/09/2026). Inter 8 pt, encre-3 du clair. */
  var MARGE = "font-family:'Inter',-apple-system,system-ui,sans-serif;font-size:8pt;color:#4C525A;";

  /* LES CHAMPS QUE `BdvDomaine.complete()` EXIGE, dans les mots du vigneron. La
     meme liste que la RPC (`fiche du domaine incomplete`). */
  var CHAMPS_DOMAINE = [['raison_sociale', 'la raison sociale'], ['siret', 'le SIRET'],
    ['adresse', 'l’adresse'], ['code_postal', 'le code postal'], ['ville', 'la ville']];

  var S = null, MOD = null, RETOUR_FOCUS = null;

  /* ---------------- OUTILS ---------------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function jourIso(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /* « 2026-03-12 » (ou un horodatage) -> « 12/03/2026 ». Un horodatage est ramene au
     jour LOCAL : `maj_le` est en UTC. */
  function dateFr(iso) {
    if (!iso) return '';
    var s = String(iso), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m && /T/.test(s)) { var d = new Date(s); if (!isNaN(d)) m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jourIso(d)); }
    else if (!m) m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }
  function bureau() { return S && S.ctx && S.ctx.bureau; }
  function cleDe(p) {
    return [p.num_produit || '', p.designation || '', p.conditionnement || '', p.millesime || ''].join('|');
  }
  /* « Brut Tradition 2021, 75 cl » : produit + millesime + conditionnement. */
  function nomDe(l) {
    return String(l.designation || '') + (l.millesime ? ' ' + l.millesime : '') + (l.conditionnement ? ', ' + l.conditionnement : '');
  }
  function sqlAbsent(e) {
    return !!e && (e.status === 404 || /PGRST202|PGRST205|42883|42P01/.test(String(e.detail || '')));
  }
  function api(chemin, o) {
    if (!window.BdvCompte || !BdvCompte.api) return Promise.resolve(null);
    return BdvCompte.api(chemin, o);
  }
  function rpc(nom, corps) { return api('/rpc/' + nom, { methode: 'POST', corps: corps }); }
  function unSeul(r) { return Array.isArray(r) ? (r[0] || null) : r; }
  /* Un devis se modifie tant qu'il est `enregistre` ET que son affaire est en cours. Une
     affaire gagnee ou perdue garde ses devis a relire et a imprimer (lot 47, retour du
     verificateur). */
  /* UN DEVIS ENVOYE DONT LA VALIDITE EST PASSEE. `expire` n'est pas un statut (lot 47) : il
     se lit sur la date, au jour local. */
  /* LOT 52 : la base connait-elle la copie ? La colonne arrive avec le SQL ; avant lui, rien
     ne part en plus (PostgREST refuserait un parametre inconnu). */
  function lot52() { return !!(S && S.devis && Object.prototype.hasOwnProperty.call(S.devis, 'papier_empreinte')); }
  function empreinteLisible(e) { return String(e || '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1 '); }
  function auteur(id) { return window.BdvCompte && BdvCompte.nomAuteur ? BdvCompte.nomAuteur(id) : ''; }
  /* « Déjà téléchargée 2 fois, la première le 01/10/2026 par Teddy. » Vide si jamais. */
  function phraseTrace(d) {
    var n = d && Number(d.commande_telechargements) || 0;
    if (!n || !d.commande_telechargee_le) return '';
    var qui = auteur(d.commande_telechargee_par);
    return 'Déjà téléchargée ' + (n === 1 ? 'une fois, le ' : n + ' fois, la première le ') + dateFr(d.commande_telechargee_le)
      + (qui ? ' par ' + qui : '') + '.';
  }
  function expire(d) { return !!(d && d.statut === 'envoye' && d.valable_jusqu && String(d.valable_jusqu) < jourIso()); }
  function plusJours(iso, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    return jourIso(new Date(+m[1], +m[2] - 1, +m[3] + n));
  }
  /* LA DATE DE RELANCE PROPOSEE : une semaine apres l'envoi, au plus tard le dernier jour de
     validite, et jamais avant l'envoi. */
  function relanceProposee(envoi, d) {
    var r = plusJours(envoi, RELANCE_JOURS);
    if (d && d.valable_jusqu && r > String(d.valable_jusqu)) r = String(d.valable_jusqu);
    if (r < envoi) r = envoi;
    return r;
  }
  function lectureSeule() {
    return !!(S.devis && (S.devis.statut !== 'enregistre' || (S.ctx.affaire && S.ctx.affaire.issue && S.ctx.affaire.issue !== 'en_cours')));
  }

  /* ---------------- LA LIVRAISON (lot 53) ----------------
     L'ecran garde le TEXTE saisi, comme pour les lignes. Un devis d'avant le lot (ou dont
     le SQL n'est pas passe) n'a pas ces colonnes : il vaut « a l'adresse du client », sans
     port, et c'est ce qu'il etait. */
  function livVide() {
    return { mode: 'client', nom: '', adresse1: '', adresse2: '', cp: '', ville: '', pays: 'France', tel: '',
             date: '', transporteur: '', port: '' };
  }
  function lot53() { return !!(S && S.devis && Object.prototype.hasOwnProperty.call(S.devis, 'livraison_mode')); }
  function livDeDevis(d) {
    var v = livVide(), a = (d && d.livraison) || {};
    if (!d) return v;
    v.mode = ['client', 'adresse', 'retrait'].indexOf(d.livraison_mode) >= 0 ? d.livraison_mode : 'client';
    v.nom = a.nom || ''; v.adresse1 = a.adresse1 || ''; v.adresse2 = a.adresse2 || '';
    v.cp = a.code_postal || ''; v.ville = a.ville || ''; v.pays = a.pays || 'France'; v.tel = a.telephone || '';
    v.date = d.livraison_souhaitee ? String(d.livraison_souhaitee).slice(0, 10) : '';
    v.transporteur = d.transporteur || '';
    v.port = Number(d.port_c) > 0 ? C.saisie(Number(d.port_c)) : '';
    return v;
  }
  /* Le port lisible, en centimes ; vide = 0 ; illisible = null (le total dit « a corriger »). */
  function portDe() {
    if (!S.liv || S.liv.mode === 'retrait') return 0;
    var t = String(S.liv.port == null ? '' : S.liv.port).trim();
    if (t === '') return 0;
    var c = C.centimes(t);
    return c !== null && c <= MAX_PU ? c : null;
  }
  /* Rien a dire : a l'adresse du client, sans date, sans transporteur, sans port. */
  function livParDefaut(l) {
    return l.mode === 'client' && !String(l.date || '').trim() && !String(l.transporteur || '').trim() && !(portDe() > 0);
  }
  /* Ce que la base recoit (`p_livraison`). Les champs vides partent vides : c'est elle qui
     nettoie, et elle refuse ce qui manque. */
  function livCorps() {
    var l = S.liv, o = { mode: l.mode, souhaitee: String(l.date || '').trim() || null };
    if (l.mode !== 'retrait') { o.transporteur = String(l.transporteur || '').trim() || null; o.port_c = portDe() || 0; }
    if (l.mode === 'adresse') o.adresse = { nom: l.nom, adresse1: l.adresse1, adresse2: l.adresse2, code_postal: l.cp,
      ville: l.ville, pays: l.pays, telephone: l.tel };
    return o;
  }
  /* LE PAPIER NE PARLE DE LIVRAISON QUE S'IL Y A QUELQUE CHOSE A DIRE : un devis d'avant le lot
     (ou sans rien de livraison) imprime comme avant, a l'octet pres, et sa copie rattrapee a
     l'accord ne dit rien que le papier envoye ne disait pas. */
  function livAdire(d) {
    return !!(d && d.livraison_mode && (d.livraison_mode !== 'client' || d.livraison_souhaitee || d.transporteur || Number(d.port_c) > 0));
  }
  /* « Livraison : ... » en une phrase, pour la lecture et le papier. */
  function phraseLiv(d) {
    var m = d && d.livraison_mode, a = (d && d.livraison) || {};
    var j = d && d.livraison_souhaitee ? dateFr(String(d.livraison_souhaitee).slice(0, 10)) : '';
    if (m === 'retrait') return 'Il vient chercher au domaine' + (j ? ', le ' + j : '') + '.';
    var ou = m === 'adresse' ? 'À livrer à ' + [a.nom, a.adresse1, a.adresse2, [a.code_postal, a.ville].filter(Boolean).join(' '),
      a.pays && !/^france$/i.test(a.pays) ? a.pays : ''].filter(Boolean).join(', ') : 'À livrer à l’adresse du client';
    return ou + (j ? ', souhaitée le ' + j : '') + (d && d.transporteur ? ', par ' + d.transporteur : '') + '.';
  }

  /* ---------------- LE DOMAINE ---------------- */
  function manquesDomaine(f) {
    if (window.BdvDomaine && BdvDomaine.complete && BdvDomaine.complete(f)) return [];
    return CHAMPS_DOMAINE.filter(function (c) { return !(f && f[c[0]]); }).map(function (c) { return c[1]; });
  }
  function liste(mots) {
    if (mots.length < 2) return mots.join('');
    return mots.slice(0, -1).join(', ') + ' et ' + mots[mots.length - 1];
  }

  /* ---------------- LES LIGNES ---------------- */
  /* Une ligne a l'ecran garde le TEXTE saisi (on ne corrige jamais ce que le
     vigneron tape) et le prix d'origine, pour savoir si le prix a ete change. */
  function ligneDeProposition(p) {
    var pu = Math.max(0, Math.round(Number(p.pu_ht_c) || 0));
    var q = parseInt(p.derniere_qte, 10);
    return { cle: cleDe(p), num_produit: p.num_produit || null, designation: p.designation || '',
      conditionnement: p.conditionnement || null, millesime: p.millesime || null,
      qte: String(q > 0 ? q : 6), prix: C.saisie(pu), remise: '0',
      pu_origine: pu, source_origine: p.source === 'client' ? 'client' : 'bureau',
      derniere_vente: p.derniere_vente || null };
  }
  function ligneDeDevis(l) {
    var p = (S.props || []).concat(S.propsDomaine || []).filter(function (x) { return cleDe(x) === cleDe(l); })[0];
    var pu = Number(l.pu_ht_c) || 0;
    return { cle: cleDe(l), num_produit: l.num_produit || null, designation: l.designation || '',
      conditionnement: l.conditionnement || null, millesime: l.millesime || null,
      qte: String(l.quantite), prix: C.saisie(pu), remise: C.pourcent(l.remise_cb || 0),
      pu_origine: pu, source_origine: l.source_prix || 'saisi',
      derniere_vente: p && p.source === 'client' ? p.derniere_vente : null };
  }
  function sourceDe(l) {
    var c = C.centimes(l.prix);
    return c !== null && c === l.pu_origine ? l.source_origine : 'saisi';
  }
  function provenance(l) {
    var s = sourceDe(l);
    if (s === 'client') return 'Son dernier prix' + (l.derniere_vente ? ', le ' + dateFr(l.derniere_vente) : '');
    if (s === 'bureau') return 'Ton prix le plus courant';
    return 'Prix changé à la main';
  }
  function qteDe(l) {
    var t = String(l.qte == null ? '' : l.qte).trim();
    if (!/^\d+$/.test(t)) return null;
    var q = parseInt(t, 10);
    return q >= 1 && q <= MAX_QTE ? q : null;
  }
  function puDe(l) { var c = C.centimes(l.prix); return c !== null && c <= MAX_PU ? c : null; }
  function rlDe(l) { var r = C.remiseCb(l.remise); return r !== null && r <= 10000 ? r : null; }
  function gDe() { var r = C.remiseCb(S.remise); return r !== null && r <= 10000 ? r : null; }

  /* LE CALCUL DE L'ECRAN, sur les lignes lisibles. Le serveur refait le meme
     (meme regle, meme table de cas) : l'ecran ne decide d'aucun montant. */
  function calcul() {
    var g = gDe() || 0, ok = [];
    S.lignes.forEach(function (l) {
      var q = qteDe(l), pu = puDe(l), r = rlDe(l);
      l._c = (q !== null && pu !== null && r !== null) ? C.ligne(pu, q, r, g) : null;
      if (l._c) ok.push({ pu_c: pu, qte: q, remise_cb: r });
    });
    var port = portDe();
    var t = C.devis(ok, g, 2000, port || 0);
    /* UNE VALEUR FAUSSE N'EST JAMAIS IGNOREE EN SILENCE : le total dit « a corriger ». */
    t.invalide = gDe() === null || port === null || S.lignes.some(function (l) { return !l._c; });
    return t;
  }

  /* ---------------- LE BROUILLON ---------------- */
  function lireBrouillon(id) {
    try {
      var b = JSON.parse(localStorage.getItem(CLE_BROUILLON + id) || 'null');
      return b && Array.isArray(b.lignes) ? b : null;
    } catch (e) { return null; }
  }
  function ecrireBrouillon() {
    if (!S || S.devis || S.etat !== 'edition') return;
    var id = S.ctx.affaire.affaire_id;
    var vide = !S.lignes.length && !String(S.notes || '').trim() && !(C.remiseCb(S.remise) > 0) && livParDefaut(S.liv);
    try {
      if (vide) { localStorage.removeItem(CLE_BROUILLON + id); return; }
      localStorage.setItem(CLE_BROUILLON + id, JSON.stringify({ le: jourIso(), lignes: S.lignes.map(function (l) {
        var x = {}; Object.keys(l).forEach(function (k) { if (k.charAt(0) !== '_') x[k] = l[k]; }); return x;
      }), remise: S.remise, notes: S.notes, version_de: S.versionDe || null, liv: S.liv }));
    } catch (e) {}
  }
  function effacerBrouillon(id) { try { localStorage.removeItem(CLE_BROUILLON + id); } catch (e) {} }

  /* ---------------- LA BOITE ---------------- */
  function monter() {
    if (MOD) return MOD;
    MOD = document.createElement('div');
    MOD.className = 'tmod dmod';
    MOD.id = 'devisModale';
    MOD.hidden = true;
    MOD.innerHTML = '<div class="tmod__voile" data-dev="fermer"></div>'
      + '<div class="tmod__boite dmod__boite" role="dialog" aria-modal="true" aria-labelledby="devTitre">'
      + '<button type="button" class="tmod__x" data-dev="fermer" aria-label="Fermer le devis">×</button>'
      + '<p class="dmod__retour-l" id="devRetourL"><button type="button" class="btn dmod__retour" id="devRetour" data-dev="retour">Retour à l’affaire</button></p>'
      + '<div class="dmod__tete" id="devTete"></div>'
      + '<p class="aff-avis" id="devAvis" role="status" aria-live="polite" hidden></p>'
      + '<div class="dmod__corps" id="devCorps"></div></div>';
    document.body.appendChild(MOD);
    MOD.addEventListener('click', surClic);
    MOD.addEventListener('input', surSaisie);
    MOD.addEventListener('change', surChangement);
    /* LE PIED COLLANT NE COUVRE JAMAIS CE QUI A LE FOCUS (WCAG 2.4.11) : tabulation,
       confirmation, champ fautif sont ramenes au-dessus de lui. */
    MOD.addEventListener('focusin', function (ev) {
      var t = ev.target;
      if (!t || (t.closest && t.closest('.dmod__pied'))) return;
      montrerDansBoite(t.closest('.aff-champ') || t);
    });
    MOD.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && ev.target && ev.target.tagName === 'INPUT' && ev.target.type !== 'checkbox') ev.preventDefault();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && MOD && !MOD.hidden) { e.preventDefault(); fermer(); }
    });
    return MOD;
  }
  /* RAMENER UN ELEMENT DANS LA BOITE QUI DEFILE, entre son haut et le haut du pied
     collant. `scrollIntoView` ne sait pas que le pied couvre le bas : on calcule. */
  function montrerDansBoite(n) {
    var box = MOD && MOD.querySelector('.tmod__boite');
    if (!box || !n || !n.getBoundingClientRect) return;
    var b = box.getBoundingClientRect(), r = n.getBoundingClientRect();
    var pied = box.querySelector('.dmod__pied');
    var ph = pied ? pied.getBoundingClientRect().height : 0;
    var haut = b.top + 8, bas = b.bottom - ph - 8;
    var d = 0;
    if (r.bottom > bas) d = Math.min(r.bottom - bas, r.top - haut);
    else if (r.top < haut) d = r.top - haut;
    if (d) box.scrollTop = box.scrollTop + d;
  }
  function dire(txt, souci) {
    var n = el('devAvis');
    if (!n) return;
    n.textContent = txt || '';
    n.hidden = !txt;
    n.classList.toggle('aff-avis--souci', !!souci);
    if (txt && typeof n.scrollIntoView === 'function') { try { n.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
  }

  /* LE FOCUS VA AU « RETOUR A L'AFFAIRE », en modale COMME en tiroir : le bouton
     d'ou l'on vient vivait dans le panneau d'affaire, qui vient de se retirer. Le
     laisser la, ce serait le laisser sur un noeud cache. */
  function poser() {
    monter();
    var neuf = MOD.hidden;
    MOD.hidden = false;
    if (window.BdvTiroir) window.BdvTiroir.poser(MOD.querySelector('.tmod__boite'));
    else document.body.style.overflow = 'hidden';
    if (neuf) { var r = el('devRetour') || MOD.querySelector('.tmod__x'); if (r) { try { r.focus(); } catch (e) {} } }
  }
  function retirer() {
    if (!MOD || MOD.hidden) return false;
    if (S) S.horsTiroir = false;
    MOD.hidden = true;
    if (window.BdvTiroir) window.BdvTiroir.retirer();
    else document.body.style.overflow = '';
    return true;
  }
  /* LE FOCUS EN SORTANT VA SUR UN ELEMENT VIVANT, jamais sur le corps de page :
     l'appelant sait lequel (`focusSortie`, le bouton qui avait ouvert l'affaire, ou
     le titre de la piece) ; a defaut, l'element d'ou l'on venait s'il existe encore. */
  function vivant(n) { return !!(n && n.isConnected && !n.closest('[hidden]') && typeof n.focus === 'function'); }
  function fermer() {
    if (!retirer()) return;
    var r = RETOUR_FOCUS; RETOUR_FOCUS = null;
    var f = S && S.ctx && typeof S.ctx.focusSortie === 'function' ? S.ctx.focusSortie() : null;
    var cible = vivant(f) ? f : (vivant(r) ? r : null);
    if (cible) { try { cible.focus(); } catch (e) {} }
  }
  /* « Retour a l'affaire » passe le devis ouvert : l'affaire ramene SA ligne dans la vue
     et y pose le focus (ou sur « Nouveau devis » s'il n'y en a pas). */
  function retour() {
    var f = S && S.ctx && S.ctx.retour;
    var id = S && S.devis ? S.devis.devis_id : null;
    retirer();
    RETOUR_FOCUS = null;
    if (typeof f === 'function') f(id);
  }

  /* ---------------- L'OUVERTURE ---------------- */
  /* ctx : { bureau, affaire:{affaire_id, issue}, sujet, nouveau, devis (ou null),
             retour(), change() } */
  async function ouvrir(ctx) {
    RETOUR_FOCUS = document.activeElement;
    S = { ctx: ctx, etat: 'chargement', props: [], source: ctx.nouveau ? 'bureau' : 'client', propsDomaine: null,
          lignes: [], remise: '0', notes: '', devis: ctx.devis || null, lignesServeur: null, voirTout: false,
          q: '', brouillon: null, confirme: false, attente: false, manque: [], accord: false, modifie: false,
          envoi: false, versionDe: null, refus: false, annul: false, liv: livVide() };
    var moi = S;
    monter();
    peindre();
    poser();
    dire('');
    /* 1. LA FICHE DU DOMAINE, DES L'OUVERTURE : un devis sans vendeur ne se fait pas.
       Un devis deja fige (abandonne, et plus tard envoye) se relit quand meme. */
    var fiche = window.BdvDomaine ? BdvDomaine.fiche() : null;
    if (!fiche) fiche = await relireDomaine();
    if (moi !== S) return;
    if (fiche === false && !lectureSeule()) { S.etat = 'illisible'; peindre(); return; }
    var manque = manquesDomaine(fiche || null);
    if (manque.length && !lectureSeule()) { S.etat = 'blocage'; S.manque = manque; peindre(); return; }
    S.fiche = fiche || null;
    await charger(moi);
  }
  /* RELIRE LA FICHE : la ligne, null si le domaine n'a pas de fiche, FALSE si la lecture
     a echoue (reseau, ou SQL du lot 38 pas passe). Les deux ne se disent pas pareil. */
  async function relireDomaine() {
    if (!window.BdvDomaine) return false;
    var f = null;
    try { f = await BdvDomaine.charger(); } catch (e) { return false; }
    if (!f && BdvDomaine.lue && !BdvDomaine.lue()) return false;
    return f || null;
  }
  async function charger(moi) {
    try {
      if (!lectureSeule()) {
        var p = await rpc('devis_propositions', { p_bureau: bureau(), p_affaire: S.ctx.affaire.affaire_id, p_tout_le_domaine: false });
        if (moi !== S) return;
        if (!Array.isArray(p)) { S.etat = 'panne'; peindre(); return; }
        S.props = trierProps(p);
        if (S.props.length) S.source = S.props[0].source === 'client' ? 'client' : 'bureau';
      }
      if (S.devis) {
        var l = await api('/devis_lignes?bureau=eq.' + encodeURIComponent(bureau())
          + '&devis_id=eq.' + encodeURIComponent(S.devis.devis_id) + '&order=rang');
        if (moi !== S) return;
        if (!Array.isArray(l)) { S.etat = 'panne'; peindre(); return; }
        S.lignesServeur = l;
        S.lignes = l.map(ligneDeDevis);
        S.remise = C.pourcent(S.devis.remise_globale_cb || 0);
        S.notes = S.devis.notes || '';
        S.liv = livDeDevis(S.devis);
        S.etat = 'edition';
      } else {
        S.brouillon = lireBrouillon(S.ctx.affaire.affaire_id);
        S.etat = S.brouillon ? 'reprise' : 'edition';
      }
    } catch (e) {
      if (moi !== S) return;
      S.etat = sqlAbsent(e) ? 'indispo' : 'panne';
    }
    peindre();
  }
  function trierProps(p) {
    var l = p.map(function (x, i) { return Object.assign({ _i: i }, x); });
    l.sort(function (a, b) {
      if (a.source === 'client' && b.source === 'client') {
        var da = String(a.derniere_vente || ''), db = String(b.derniere_vente || '');
        if (da !== db) return da < db ? 1 : -1;
      } else if ((b.nb_ventes || 0) !== (a.nb_ventes || 0)) return (b.nb_ventes || 0) - (a.nb_ventes || 0);
      return a._i - b._i;
    });
    return l;
  }

  /* ---------------- LE DESSIN ---------------- */
  function peindre() {
    var tete = el('devTete'), corps = el('devCorps');
    if (!tete || !corps) return;
    var d = S.devis;
    /* « Devis pour X » : le nom est dit UNE fois, ici ; le bloc « Pour qui » ne le redit
       pas en gros. Aucun numero avant l'enregistrement. */
    var pour = ' pour ' + esc(S.ctx.sujet || 'ce client');
    var titre = d
      ? (d.statut === 'abandonne' ? 'Devis <s>' + esc(d.numero) + '</s> <span class="aff-marque dmod__abandonne">abandonné</span>,' + pour
        : d.statut === 'accepte' ? 'Devis ' + esc(d.numero) + ' <span class="aff-marque">accepté</span>,' + pour
        : d.statut === 'refuse' ? 'Devis ' + esc(d.numero) + ' <span class="aff-marque dmod__abandonne">refusé</span>,' + pour
        : d.statut === 'envoye' ? 'Devis ' + esc(d.numero) + ' <span class="aff-marque">' + (expire(d) ? 'expiré' : 'envoyé') + '</span>,' + pour
        : 'Devis ' + esc(d.numero) + pour)
      : (S.versionDe ? 'Nouveau devis' : 'Devis') + pour;
    var sous = d ? '' : (S.versionDe ? 'Pas encore enregistré. Il remplacera le devis ' + esc(S.versionDe.numero) + ', qui passera abandonné.' : 'Pas encore enregistré.');
    if (d) {
      sous += 'Du ' + esc(dateFr(d.date_devis)) + ', valable jusqu’au ' + esc(dateFr(d.valable_jusqu)) + '.';
      if (d.cree_le && d.maj_le && d.maj_le !== d.cree_le && d.statut === 'enregistre') sous += ' Modifié le ' + esc(dateFr(d.maj_le)) + '.';
      if (d.statut === 'abandonne' && d.abandonne_le) sous += ' Abandonné le ' + esc(dateFr(d.abandonne_le)) + '.';
      if (d.envoye_le && d.statut !== 'abandonne') sous += ' Envoyé le ' + esc(dateFr(d.envoye_le)) + '.';
      if (expire(d)) sous += ' Il a expiré : ses prix ne tiennent plus, relance ou refais-le.';
      if (d.statut === 'accepte' && d.accepte_le) sous += ' Accepté le ' + esc(dateFr(d.accepte_le)) + '.';
      if (d.statut === 'refuse' && d.refuse_le) sous += ' Refusé le ' + esc(dateFr(d.refuse_le)) + (motifRefus(d.refuse_motif) ? ' : ' + esc(motifRefus(d.refuse_motif).toLowerCase()) : '') + '.';
      if (d.statut !== 'accepte' && d.accord_annule_le) sous += ' Acceptation annulée le ' + esc(dateFr(d.accord_annule_le)) + '.';
      if (d.statut !== 'accepte' && Number(d.commande_telechargements) > 0 && d.commande_telechargee_le)
        sous += ' Sa commande avait été téléchargée le ' + esc(dateFr(d.commande_telechargee_le)) + '.';
    }
    /* « Retour a l'affaire » n'est PAS repeint : il garde le focus pendant que le corps
       arrive. Il se cache seulement quand personne n'a donne de chemin de retour. */
    el('devRetourL').hidden = typeof S.ctx.retour !== 'function';
    tete.innerHTML = '<h2 class="tmod__titre" id="devTitre">' + titre + '</h2><p class="tmod__sous">' + sous + '</p>';
    MOD.querySelector('.tmod__boite').classList.toggle('dmod__boite--apercu', S.etat === 'apercu');
    if (S.etat === 'chargement') corps.innerHTML = '<p class="aff-aide">Ouverture du devis…</p>';
    else if (S.etat === 'blocage') corps.innerHTML = '<div class="dmod__bloque"><p class="dmod__phrase">Il manque des infos sur ton domaine pour faire un devis : '
      + esc(liste(S.manque)) + '.</p><p><button type="button" class="btn btn--bordeaux" data-dev="domaine">Compléter Mon domaine</button></p></div>';
    else if (S.etat === 'indispo') corps.innerHTML = '<p class="dmod__phrase">' + MOT_SQL + '</p>';
    else if (S.etat === 'illisible') corps.innerHTML = '<p class="dmod__phrase">' + MOT_DOMAINE_ILLISIBLE + '</p>';
    else if (S.etat === 'panne') corps.innerHTML = '<p class="dmod__phrase">Le devis ne s’est pas ouvert : ta connexion a coupé.</p>'
      + '<p><button type="button" class="btn" data-dev="relire">Réessayer</button></p>';
    else if (S.etat === 'reprise') corps.innerHTML = '<div class="dmod__bloque"><p class="dmod__phrase">Tu avais commencé un devis le '
      + esc(dateFr(S.brouillon.le).slice(0, 5)) + '. Le reprendre ?</p><p class="dmod__gestes">'
      + '<button type="button" class="btn btn--bordeaux" data-dev="reprendre">Reprendre</button>'
      + '<button type="button" class="btn" data-dev="zero">Repartir de zéro</button></p></div>';
    else if (S.etat === 'apercu') peindreApercu(corps);
    else corps.innerHTML = lectureSeule() ? htmlLecture() : htmlEdition();
    if (S.etat === 'edition' && !lectureSeule()) majTotaux();
  }

  function htmlQui() {
    var a = S.devis && S.devis.acheteur;
    var nom = (a && a.nom) || S.ctx.sujet || '';
    var nouveau = a ? !!a.nouveau : !!S.ctx.nouveau;
    var det = a ? [[a.code_postal, a.ville].filter(Boolean).join(' '), a.num_client ? 'n° client ' + a.num_client : '']
      .filter(Boolean).join(', ') : '';
    return '<section class="dmod__bloc" aria-labelledby="devQuiT"><h3 class="dmod__t" id="devQuiT">Pour qui</h3>'
      + '<p class="dmod__qui">' + esc(nom) + (det ? ', ' + esc(det) : '') + '</p>'
      + (nouveau ? '<p class="dmod__qui-m"><span class="aff-marque">Nouveau client, pas encore dans Vitisoft</span></p>' : '')
      + '</section>';
  }
  function htmlConditions(avecLien) {
    var f = S.devis || S.fiche || {};
    var cond = window.BdvDomaine && BdvDomaine.conditions ? BdvDomaine.conditions(f) : '';
    var val = f.validite_jours ? ' Devis valable ' + f.validite_jours + ' jours.' : '';
    return '<section class="dmod__bloc" aria-labelledby="devCondT"><h3 class="dmod__t" id="devCondT">Conditions</h3>'
      + '<p class="dmod__cond">' + esc(cond) + (cond ? '.' : '') + esc(val) + '</p>'
      + (avecLien ? '<p><button type="button" class="dmod__lien" data-dev="domaine">Changer dans Mon domaine</button></p>' : '')
      + '</section>';
  }
  function htmlEdition() {
    var enreg = S.devis && S.devis.statut === 'enregistre';
    return htmlQui()
      + '<section class="dmod__bloc" aria-labelledby="devVinsT"><h3 class="dmod__t" id="devVinsT">Tes vins</h3>'
      + '<ul class="dmod__lignes" id="devLignes">' + htmlLignes() + '</ul>'
      + '<label class="aff-champ dmod__cherche"><span>Chercher un vin</span>'
      + '<input id="devCherche" type="search" autocomplete="off" maxlength="80" value="' + esc(S.q) + '"></label>'
      + '<div id="devProps">' + htmlProps() + '</div></section>'
      + '<section class="dmod__bloc" aria-labelledby="devRemiseT"><h3 class="dmod__t" id="devRemiseT">Remise sur tout le devis</h3>'
      + '<label class="aff-champ dmod__remise"><span>En %, 0 si aucune</span>'
      + '<input id="devRemise" type="text" inputmode="decimal" autocomplete="off" maxlength="6" value="' + esc(S.remise) + '"></label></section>'
      + '<section class="dmod__bloc" aria-labelledby="devLivT" id="devLiv">' + htmlLivraison() + '</section>'
      + '<section class="dmod__bloc" aria-labelledby="devTotalT"><h3 class="dmod__t" id="devTotalT">Total</h3><div id="devTotal"></div></section>'
      + htmlConditions(true)
      + '<section class="dmod__bloc" aria-labelledby="devNotesT"><h3 class="dmod__t" id="devNotesT">Notes</h3>'
      + '<textarea id="devNotes" class="dmod__notes" rows="3" maxlength="2000" aria-labelledby="devNotesT">' + esc(S.notes) + '</textarea></section>'
      + (enreg ? '<section class="dmod__bloc dmod__suite"><p class="dmod__gestes">'
        + '<button type="button" class="btn" data-dev="apercu">Voir et imprimer</button>'
        + '<button type="button" class="dmod__lien" data-dev="refuser">Il a dit non</button>'
        + '<button type="button" class="dmod__lien dmod__lien--x" data-dev="abandonner">Abandonner ce devis</button></p>'
        + htmlConfirmeAbandon() + htmlConfirmeRefus() + '</section>'
        + htmlEnvoiAvant() + htmlCommandeAvant() : '')
      + '<div class="dmod__pied"><p class="dmod__pied-t">Total TTC <b id="devPiedTtc"></b></p>'
      + '<button type="button" class="btn btn--bordeaux" data-dev="enregistrer">Enregistrer le devis</button></div>';
  }
  /* LA LIVRAISON A L'ECRAN. Le mode se choisit d'abord ; les champs qui ne servent pas a ce
     mode ne sont pas dessines (un champ cache ne doit rien envoyer). */
  function champLiv(id, cle, lib, o) {
    o = o || {};
    return '<label class="aff-champ' + (o.large ? ' dmod__liv-l' : '') + '"><span>' + lib + '</span><input id="' + id + '" data-dev-liv="' + cle + '" type="'
      + (o.type || 'text') + '"' + (o.mode ? ' inputmode="' + o.mode + '"' : '') + ' autocomplete="' + (o.auto || 'off') + '" maxlength="' + (o.max || 80) + '"'
      + (o.min ? ' min="' + esc(o.min) + '"' : '') + ' value="' + esc(S.liv[cle]) + '"></label>';
  }
  function htmlLivraison() {
    var l = S.liv, auj = jourIso();
    var min = S.devis && S.devis.date_devis && String(S.devis.date_devis) < auj ? String(S.devis.date_devis) : auj;
    return '<h3 class="dmod__t" id="devLivT">Livraison</h3>'
      + '<fieldset class="dmod__liv-modes"><legend class="dmod__st">Comment le vin part ?</legend>'
      + MODES_LIV.map(function (m) {
        return '<label class="dmod__coche"><input type="radio" name="devLivMode" data-dev-livmode value="' + m[0] + '"'
          + (l.mode === m[0] ? ' checked' : '') + '><span>' + esc(m[1]) + '</span></label>';
      }).join('') + '</fieldset>'
      + (l.mode === 'adresse' ? '<div class="dmod__liv-champs">'
        + champLiv('devLivNom', 'nom', 'Destinataire', { large: true, auto: 'organization' })
        + champLiv('devLivA1', 'adresse1', 'Adresse', { large: true, max: 120, auto: 'address-line1' })
        + champLiv('devLivA2', 'adresse2', 'Complément (facultatif)', { large: true, max: 120, auto: 'address-line2' })
        + champLiv('devLivCp', 'cp', 'Code postal', { max: 10, auto: 'postal-code' })
        + champLiv('devLivVille', 'ville', 'Ville', { max: 60, auto: 'address-level2' })
        + champLiv('devLivPays', 'pays', 'Pays', { max: 60, auto: 'country-name' })
        + champLiv('devLivTel', 'tel', 'Téléphone (facultatif)', { type: 'tel', max: 20, auto: 'tel' })
        + '</div>' : '')
      + '<div class="dmod__liv-champs">'
      + champLiv('devLivDate', 'date', l.mode === 'retrait' ? 'Il passe le (facultatif)' : 'Livraison souhaitée le (facultatif)', { type: 'date', min: min, max: 10 })
      + (l.mode === 'retrait' ? '' : champLiv('devLivTransp', 'transporteur', 'Transporteur (facultatif)', { max: 60 })
        + champLiv('devLivPort', 'port', 'Frais de port HT, 0 si aucun', { mode: 'decimal', max: 12 }))
      + '</div>'
      + (l.mode !== 'retrait' && portDe() > 0 ? '<p class="aff-aide">' + esc(TRANSPORT_VITI) + '</p>' : '');
  }
  function htmlConfirmeAbandon() {
    return '<div class="dmod__confirme" id="devConfirme"' + (S.confirme ? '' : ' hidden') + '>'
      + '<p class="aff-aide">Tu abandonnes ce devis ? Il garde son numéro ' + esc(S.devis.numero) + ' et ne se modifie plus.</p>'
      + '<p class="dmod__gestes"><button type="button" class="btn btn--bordeaux" data-dev="confirmerAbandon">Oui, l’abandonner</button>'
      + '<button type="button" class="btn" data-dev="garder">Non, le garder</button></p></div>';
  }
  function motifRefus(code) { var m = MOTIFS_REFUS.filter(function (x) { return x[0] === code; })[0]; return m ? m[1] : ''; }
  /* « IL A DIT NON » : le motif, et la case qui clot l'affaire. Elle n'est proposee que si
     l'affaire est ouverte ET qu'aucun autre de ses devis n'est en cours (la base refuse
     sinon, et on le dit avant). Le focus va sur « Pas encore ». */
  function htmlConfirmeRefus() {
    var d = S.devis, autres = Number(S.ctx.autresEnCours) || 0;
    return '<div class="dmod__confirme" id="devRefus"' + (S.refus ? '' : ' hidden') + '>'
      + '<p class="aff-aide">Le devis ' + esc(d.numero) + ' passera refusé : il garde son numéro et ne se modifie plus. Tu pourras le refaire.</p>'
      + '<label class="aff-champ"><span>Pourquoi ?</span><select id="devRefusMotif">'
      + MOTIFS_REFUS.map(function (m) { return '<option value="' + m[0] + '">' + esc(m[1]) + '</option>'; }).join('') + '</select></label>'
      + (!affaireOuverte() ? ''
        : autres > 0 ? '<p class="aff-aide">L’affaire a encore ' + (autres > 1 ? autres + ' autres devis' : 'un autre devis') + ' en cours : elle reste ouverte.</p>'
        : '<label class="dmod__coche"><input type="checkbox" id="devRefusClore" checked><span>Passer l’affaire à « Pas pour cette fois »</span></label>')
      + '<p class="dmod__gestes"><button type="button" class="btn btn--bordeaux" data-dev="confirmerRefus">Oui, il a dit non</button>'
      + '<button type="button" class="btn" data-dev="pasRefus">Pas encore</button></p></div>';
  }
  /* « ANNULER L'ACCEPTATION » : pour un « oui » clique par erreur. La base ne sait pas si
     la commande est deja dans Vitisoft : l'ecran le dit, avant. */
  function htmlConfirmeAnnul() {
    var d = S.devis, gagnee = S.ctx.affaire && S.ctx.affaire.issue === 'gagnee';
    return '<div class="dmod__confirme" id="devAnnul"' + (S.annul ? '' : ' hidden') + '>'
      + '<p class="aff-aide">Le devis ' + esc(d.numero) + ' repassera ' + (d.envoye_le ? 'envoyé' : 'enregistré')
      + ' et la commande ne se téléchargera plus. '
      + (Number(d.commande_telechargements) > 0 && d.commande_telechargee_le
        ? 'Son fichier a été téléchargé le ' + esc(dateFr(d.commande_telechargee_le)) + ' : elle est sans doute déjà dans Vitisoft. Supprime-la aussi là-bas, sinon elle sera facturée.</p>'
        : 'Si tu l’as déjà importée dans Vitisoft, supprime-la aussi là-bas : sinon elle sera facturée.</p>')
      + (gagnee ? '<label class="dmod__coche"><input type="checkbox" id="devAnnulRouvrir" checked><span>Rouvrir l’affaire</span></label>' : '')
      + '<p class="dmod__gestes"><button type="button" class="btn btn--bordeaux" data-dev="confirmerAnnul">Oui, annuler l’acceptation</button>'
      + '<button type="button" class="btn" data-dev="garderAccord">Non, la garder</button></p></div>';
  }
  function affaireOuverte() { var i = S.ctx.affaire && S.ctx.affaire.issue; return !i || i === 'en_cours'; }

  /* ---------------- L'ENVOI (lot 50) ----------------
     « Je l'ai envoyé » note la date et, si la case reste cochee, pose le rappel de l'affaire
     (« Relancer le devis D-... ») : c'est lui qui remonte dans Ma journee, le calendrier et le
     courrier du matin. Le rappel deja pose est NOMME, parce que celui-ci le remplace. L'etape
     n'est proposee que si le type d'affaire en a une qui parle de devis, plus loin. */
  function htmlEnvoiAvant() {
    var d = S.devis, auj = jourIso(), a = S.ctx.affaire || {}, et = S.ctx.etapeDevis;
    var min = d.date_devis && String(d.date_devis) < auj ? String(d.date_devis) : auj;
    return '<section class="dmod__bloc" aria-labelledby="devEnvT"><h3 class="dmod__t" id="devEnvT">Tu l’as envoyé au client ?</h3>'
      + '<p class="aff-aide">Envoie le PDF par ta messagerie, puis note-le ici : le bureau te rappellera de le relancer.</p>'
      + '<p class="dmod__gestes"><button type="button" class="btn" data-dev="envoyer">Je l’ai envoyé</button></p>'
      + '<div class="dmod__confirme dmod__confirme--neutre" id="devEnvoi"' + (S.envoi ? '' : ' hidden') + '>'
      + '<label class="aff-champ dmod__jour"><span>Envoyé le</span><input id="devEnvoiJour" type="date" value="' + auj
      + '" min="' + esc(min) + '" max="' + auj + '"></label>'
      + '<label class="dmod__coche"><input type="checkbox" id="devEnvoiRappel" checked><span>Me rappeler de le relancer</span></label>'
      + '<label class="aff-champ dmod__jour"><span>Le</span><input id="devEnvoiRelance" type="date" value="' + relanceProposee(auj, d)
      + '" min="' + auj + '"></label>'
      + (a.rappel ? '<p class="aff-aide">Ce rappel remplace celui du ' + esc(dateFr(a.rappel))
        + (a.rappel_titre ? ' (' + esc(a.rappel_titre) + ')' : '') + '.</p>' : '')
      + (et ? '<label class="dmod__coche"><input type="checkbox" id="devEnvoiEtape" checked><span>Passer l’affaire à « '
        + esc(et.nom) + ' »</span></label>' : '')
      + '<p class="aff-aide">Le devis ' + esc(d.numero) + ' ne se modifiera plus : pour le changer, tu le referas sous un nouveau numéro.</p>'
      + '<p class="dmod__gestes"><button type="button" class="btn btn--bordeaux" data-dev="confirmerEnvoi">C’est noté</button>'
      + '<button type="button" class="btn" data-dev="pasEnvoye">Pas encore</button></p></div></section>';
  }
  /* UN DEVIS ENVOYE SE RELIT, S'IMPRIME, SE REFAIT, S'ABANDONNE ET S'ACCEPTE. Il ne se modifie
     plus : le client a ce papier entre les mains. */
  function htmlSuiteEnvoye() {
    var ouverte = affaireOuverte(), perdue = S.ctx.affaire && S.ctx.affaire.issue === 'perdue';
    return '<section class="dmod__bloc dmod__suite"><p class="dmod__gestes">'
      + '<button type="button" class="btn" data-dev="apercu">Voir et imprimer</button>'
      + (ouverte ? '<button type="button" class="btn" data-dev="refaire">Refaire ce devis</button>' : '')
      + '<button type="button" class="dmod__lien" data-dev="refuser">Il a dit non</button>'
      + '<button type="button" class="dmod__lien dmod__lien--x" data-dev="abandonner">Abandonner ce devis</button></p>'
      + (ouverte ? '<p class="aff-aide">Pour changer un prix ou une quantité, refais-le : il reprend tes lignes sous un nouveau numéro, et celui-ci passe abandonné.</p>' : '')
      + htmlConfirmeAbandon() + htmlConfirmeRefus() + '</section>'
      + (perdue ? '' : htmlCommandeAvant());
  }
  function htmlLignes() {
    return S.lignes.map(function (l, i) {
      return '<li class="dmod__ligne" data-cle="' + esc(l.cle) + '">'
        + '<label class="dmod__coche"><input type="checkbox" checked data-dev-coche="' + esc(l.cle) + '">'
        + '<span class="dmod__nom">' + esc(nomDe(l)) + '</span></label>'
        + (l.num_produit ? '<p class="dmod__code">Code ' + esc(l.num_produit) + '</p>' : '')
        + '<div class="dmod__champs">'
        + '<label class="aff-champ"><span>Quantité</span><input type="text" inputmode="numeric" autocomplete="off" maxlength="5" data-dev-champ="qte" value="' + esc(l.qte) + '"></label>'
        + '<label class="aff-champ"><span>Prix HT unitaire</span><input type="text" inputmode="decimal" autocomplete="off" maxlength="12" data-dev-champ="prix" value="' + esc(l.prix) + '" aria-describedby="devSrc' + i + '">'
        + '<small class="dmod__src" id="devSrc' + i + '" data-dev-src>' + esc(provenance(l)) + '</small></label>'
        + '<label class="aff-champ"><span>Remise %</span><input type="text" inputmode="decimal" autocomplete="off" maxlength="6" data-dev-champ="remise" value="' + esc(l.remise) + '"></label>'
        + '<p class="dmod__lt"><span>Total de la ligne</span><b data-dev-lt></b><small class="dmod__src" data-dev-net></small></p>'
        + '</div></li>';
    }).join('');
  }
  function coches() {
    var m = {}; S.lignes.forEach(function (l) { m[l.cle] = true; }); return m;
  }
  function correspond(p, mots) {
    var t = norm(nomDe(p) + ' ' + (p.num_produit || ''));
    return mots.every(function (m) { return t.indexOf(m) >= 0; });
  }
  function htmlProp(p) {
    var pu = Math.round(Number(p.pu_ht_c) || 0);
    var d = p.source === 'client'
      ? 'Son dernier prix : ' + C.euros(pu) + (p.derniere_vente ? ', le ' + dateFr(p.derniere_vente) : '')
      : 'Ton prix le plus courant : ' + C.euros(pu);
    return '<li class="dmod__prop"><label class="dmod__coche"><input type="checkbox" data-dev-coche="' + esc(cleDe(p)) + '">'
      + '<span class="dmod__nom">' + esc(nomDe(p)) + '</span><span class="dmod__prix">' + esc(d) + '</span></label></li>';
  }
  function htmlProps() {
    var pris = coches();
    var mots = norm(S.q).split(' ').filter(Boolean);
    if (!S.props.length && !mots.length) return '<p class="aff-aide">Tu n’as encore rien vendu sur 12 mois.</p>';
    var titre = S.source === 'client' ? 'Ce qu’il t’a déjà pris' : 'Tes vins vendus ces 12 derniers mois';
    var trouves = S.props.filter(function (p) { return !mots.length || correspond(p, mots); });
    var l = trouves.filter(function (p) { return !pris[cleDe(p)]; });
    if (trouves.length || !mots.length) {
      var montre = (S.voirTout || mots.length) ? l : l.slice(0, PREMIERES);
      var reste = l.length - montre.length;
      return '<h4 class="dmod__st">' + titre + '</h4>'
        + (montre.length ? '<ul class="dmod__props">' + montre.map(htmlProp).join('') + '</ul>' : '<p class="aff-aide">Tout ce qui correspond est déjà coché.</p>')
        + (reste > 0 ? '<p><button type="button" class="dmod__lien" data-dev="voirTout">'
          + (reste === 1 ? 'Voir l’autre vin' : 'Voir les ' + reste + ' autres vins') + '</button></p>' : '');
    }
    /* LA LISTE DU CLIENT NE L'A PAS : on cherche dans les ventes du domaine, une fois. */
    if (S.source === 'client') {
      if (S.propsDomaine === null) { chercherDomaine(); return '<p class="aff-aide">Je cherche dans les ventes de ton domaine…</p>'; }
      var dt = S.propsDomaine.filter(function (p) { return correspond(p, mots); });
      var dl = dt.filter(function (p) { return !pris[cleDe(p)]; });
      if (dl.length) return '<h4 class="dmod__st">Dans les ventes de ton domaine</h4><ul class="dmod__props">' + dl.map(htmlProp).join('') + '</ul>';
      if (dt.length) return '<p class="aff-aide">Tout ce qui correspond est déjà coché.</p>';
    }
    return '<p class="aff-aide">Aucun vin ne correspond à « ' + esc(S.q.trim()) + ' ».</p>';
  }
  var DOMAINE_EN_COURS = null;
  function chercherDomaine() {
    if (DOMAINE_EN_COURS) return;
    var moi = S;
    DOMAINE_EN_COURS = Promise.resolve()
      .then(function () { return rpc('devis_propositions', { p_bureau: bureau(), p_affaire: moi.ctx.affaire.affaire_id, p_tout_le_domaine: true }); })
      .then(function (r) { if (moi === S) S.propsDomaine = Array.isArray(r) ? trierProps(r) : []; },
            function () { if (moi === S) S.propsDomaine = []; })
      .then(function () { DOMAINE_EN_COURS = null; if (moi === S && S.etat === 'edition') peindreProps(); });
  }
  function peindreProps() { var n = el('devProps'); if (n) n.innerHTML = htmlProps(); }

  /* LA REGLE C S'EXPLIQUE : la remise globale s'applique a chaque prix unitaire, arrondi
     au centime, d'ou un montant qui peut s'ecarter de quelques centimes de g % du total. */
  function libelleRemise(g) { return 'Remise sur tout le devis ' + C.pourcent(g) + ' %'; }
  var EXPLICATION_REMISE = 'Appliquée à chaque prix unitaire, arrondie au centime.';
  function htmlACorriger() {
    return '<div class="dmod__totaux"><p class="dmod__tl dmod__tl--ttc"><span>Total TTC</span><span>' + MOT_CORRIGER + '</span></p></div>'
      + '<p class="aff-aide">Une quantité, un prix, une remise ou les frais de port ne sont pas lisibles : corrige-les pour voir le total.</p>'
      + '<p class="aff-aide">' + ACCISES + '</p>';
  }
  function htmlTotaux(t, g, avecDeux) {
    return '<div class="dmod__totaux">'
      + '<p class="dmod__tl"><span>Total des vins HT</span><span>' + C.euros(t.total_vins) + '</span></p>'
      + (g > 0 ? '<p class="dmod__tl"><span>' + libelleRemise(g) + ' :</span><span>-' + C.euros(t.remise_globale) + '</span></p>'
        + '<p class="dmod__tl-x">' + EXPLICATION_REMISE + '</p>' : '')
      + (t.port > 0 ? '<p class="dmod__tl"><span>Frais de port HT</span><span>' + C.euros(t.port) + '</span></p>' : '')
      + '<p class="dmod__tl"><span>Total HT</span><span>' + C.euros(t.total_ht) + '</span></p>'
      + '<p class="dmod__tl"><span>TVA 20 %</span><span>' + C.euros(t.tva) + '</span></p>'
      + '<p class="dmod__tl dmod__tl--ttc"><span>Total TTC</span><span>' + C.euros(t.ttc) + '</span></p></div>'
      + '<p class="aff-aide">' + ACCISES + '</p>'
      + (avecDeux ? '<p class="aff-aide">Les deux remises s’ajoutent : la remise sur tout le devis s’applique après celles des lignes.</p>' : '');
  }
  /* LES MONTANTS SE METTENT A JOUR EN PLACE : repeindre la liste a chaque touche
     ferait perdre le champ ou l'on tape. */
  function majTotaux() {
    var t = calcul(), g = gDe() || 0;
    var deux = g > 0 && S.lignes.some(function (l) { return (rlDe(l) || 0) > 0; });
    var tot = el('devTotal'); if (tot) tot.innerHTML = t.invalide ? htmlACorriger() : htmlTotaux(t, g, deux);
    var pied = el('devPiedTtc'); if (pied) pied.textContent = t.invalide ? MOT_CORRIGER : C.euros(t.ttc);
    S.lignes.forEach(function (l) {
      var li = MOD.querySelector('.dmod__ligne[data-cle="' + cssEsc(l.cle) + '"]');
      if (!li) return;
      li.querySelector('[data-dev-lt]').textContent = l._c ? C.euros(l._c.net) : MOT_CORRIGER;
      /* PRIX NET = prix apres la remise de LIGNE (pu_l) : prix net x quantite = total de la ligne. */
      li.querySelector('[data-dev-net]').textContent = l._c && rlDe(l) > 0 ? 'Prix net ' + C.euros(l._c.pu_l) : '';
      li.querySelector('[data-dev-src]').textContent = provenance(l);
    });
  }
  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  /* ---------------- LA COMMANDE VITISOFT (lot 49) ----------------
     « Le client a dit oui » FIGE le devis et passe l'affaire a Gagnee, dans la base, en
     une transaction (`devis_accepter`). Le fichier part ensuite du devis ENREGISTRE :
     un formulaire modifie et pas enregistre ne s'accepte pas. Ce qui empecherait un
     fichier importable se dit AVANT, en nommant le vin ou le client. */
  function phraseManques(m) {
    return m.map(function (x) {
      if (x.quoi === 'produit') return 'Pour Vitisoft, chaque vin doit avoir son code article, et il manque pour : '
        + x.vins.join(', ') + (x.vins.length > 1 ? '. Retire-les du devis et ajoute-les' : '. Retire-le du devis et ajoute-le') + ' à la main dans Vitisoft.';
      if (x.quoi === 'client') return 'Ce client n’a ni numéro Vitisoft ni e-mail dans tes exports : Vitisoft créerait un deuxième client. Saisis cette commande dans Vitisoft.';
      return 'Ce devis n’a aucun vin.';
    }).join(' ');
  }
  function manquesCommande() {
    return window.BdvCommande ? BdvCommande.manques(S.devis, S.lignesServeur || []) : [];
  }
  function htmlCommandeAvant() {
    var m = manquesCommande();
    return '<section class="dmod__bloc dmod__commande" aria-labelledby="devCmdT"><h3 class="dmod__t" id="devCmdT">Le client a dit oui ?</h3>'
      + (m.length ? '<p class="aff-aide" id="devCmdManque">' + esc(phraseManques(m)) + '</p>'
        : '<p class="aff-aide">Le devis enregistré devient une commande à importer dans Vitisoft.</p>')
      + (m.length ? '' : '<p class="dmod__gestes"><button type="button" class="btn" data-dev="accepter">Préparer la commande Vitisoft</button></p>'
        + '<div class="dmod__confirme" id="devAccord"' + (S.accord ? '' : ' hidden') + '>'
        + (expire(S.devis) ? '<p class="aff-aide">Ce devis a expiré le ' + esc(dateFr(S.devis.valable_jusqu)) + ' : tu confirmes qu’il accepte ces prix ?</p>' : '')
        + '<p class="aff-aide">Le devis ' + esc(S.devis.numero) + ' ne se modifiera plus (une correction demandera un nouveau devis) et l’affaire passera Gagnée. Tu reçois ensuite le fichier pour Vitisoft.</p>'
        + '<p class="dmod__gestes"><button type="button" class="btn btn--bordeaux" data-dev="confirmerAccord">Oui, il a dit oui</button>'
        + '<button type="button" class="btn" data-dev="pasEncore">Pas encore</button></p></div>')
      + '</section>';
  }
  function htmlCommandeApres() {
    return '<section class="dmod__bloc dmod__commande" aria-labelledby="devCmdT"><h3 class="dmod__t" id="devCmdT">La commande Vitisoft</h3>'
      + '<p class="dmod__cond">Accepté le ' + esc(dateFr(S.devis.accepte_le)) + '. L’affaire est gagnée.</p>'
      + '<p class="aff-aide" id="devCmdTrace"' + (phraseTrace(S.devis) ? '' : ' hidden') + '>' + esc(phraseTrace(S.devis)) + '</p>'
      + '<p class="dmod__gestes"><button type="button" class="btn btn--bordeaux" data-dev="telecharger">Télécharger la commande</button>'
      + '<button type="button" class="btn" data-dev="apercu">Voir et imprimer</button></p>'
      + '<p class="aff-aide">' + esc(IMPORT_VITI) + ' ' + esc(DEJA_12) + '</p>'
      + '<p class="dmod__gestes"><button type="button" class="dmod__lien dmod__lien--x" data-dev="annulerAccord">Annuler l’acceptation</button></p>'
      + htmlConfirmeAnnul() + '</section>';
  }

  function htmlLecture() {
    var l = S.lignesServeur || [];
    var d = S.devis;
    var t = { total_vins: d.total_vins_c, remise_globale: d.remise_globale_c, port: Number(d.port_c) || 0, total_ht: d.total_ht_c, tva: d.tva_c, ttc: d.total_ttc_c };
    var deux = d.remise_globale_cb > 0 && l.some(function (x) { return x.remise_cb > 0; });
    return htmlQui()
      + '<section class="dmod__bloc" aria-labelledby="devVinsT"><h3 class="dmod__t" id="devVinsT">Tes vins</h3>'
      + '<ul class="dmod__lignes dmod__lignes--lues">' + l.map(function (x) {
        return '<li class="dmod__ligne"><p class="dmod__nom">' + esc(nomDe(x)) + '</p><p class="aff-aide">'
          + esc(x.quantite + ' x ' + C.euros(x.pu_ht_c) + ' HT' + (x.remise_cb ? ', remise ' + C.pourcent(x.remise_cb) + ' % (prix net ' + C.euros(prixNet(x)) + ')' : '')
          + ' : ' + C.euros(x.net_c)) + '</p></li>';
      }).join('') + '</ul></section>'
      + '<section class="dmod__bloc" aria-labelledby="devLivT"><h3 class="dmod__t" id="devLivT">Livraison</h3><p class="dmod__cond">' + esc(phraseLiv(d)) + '</p>'
      + (Number(d.port_c) > 0 && d.statut === 'accepte' ? '<p class="aff-aide">' + esc(TRANSPORT_VITI) + '</p>' : '') + '</section>'
      + '<section class="dmod__bloc" aria-labelledby="devTotalT"><h3 class="dmod__t" id="devTotalT">Total</h3>'
      + htmlTotaux(t, d.remise_globale_cb || 0, deux) + '</section>'
      + htmlConditions(false)
      + (d.notes ? '<section class="dmod__bloc" aria-labelledby="devNotesT"><h3 class="dmod__t" id="devNotesT">Notes</h3><p class="dmod__cond">' + esc(d.notes) + '</p></section>' : '')
      + (d.statut === 'abandonne' ? '<p class="aff-aide">Ce devis est abandonné : il garde son numéro et ne se modifie plus.</p>'
        : d.statut === 'refuse' ? '<section class="dmod__bloc dmod__suite"><p class="aff-aide">Ce devis a été refusé : il garde son numéro et ne se modifie plus.</p>'
          + '<p class="dmod__gestes"><button type="button" class="btn" data-dev="apercu">Voir et imprimer</button>'
          + (affaireOuverte() ? '<button type="button" class="btn" data-dev="refaire">Refaire ce devis</button>' : '') + '</p></section>'
        : d.statut === 'accepte' ? htmlCommandeApres()
        : d.statut === 'envoye' ? htmlSuiteEnvoye()
        : '<section class="dmod__bloc dmod__suite"><p class="dmod__gestes"><button type="button" class="btn" data-dev="apercu">Voir et imprimer</button></p></section>');
  }

  /* ---------------- LES GESTES ---------------- */
  function ligneDe(n) {
    var li = n.closest('.dmod__ligne');
    var cle = li && li.getAttribute('data-cle');
    return S.lignes.filter(function (l) { return l.cle === cle; })[0];
  }
  function surClic(ev) {
    var b = ev.target.closest('[data-dev]');
    if (!b || !MOD.contains(b) || !S) return;
    var q = b.getAttribute('data-dev');
    if (q === 'fermer') { fermer(); return; }
    if (q === 'retour') { retour(); return; }
    if (q === 'domaine') { ouvrirDomaine(); return; }
    if (q === 'relire') { S.etat = 'chargement'; peindre(); charger(S); return; }
    if (q === 'reprendre') {
      var br = S.brouillon;
      S.lignes = (br.lignes || []).filter(function (l) { return l && l.cle; }).slice(0, MAX_LIGNES);
      S.remise = br.remise == null ? '0' : String(br.remise);
      S.notes = br.notes || '';
      S.versionDe = br.version_de && br.version_de.devis_id ? br.version_de : null;
      S.liv = Object.assign(livVide(), br.liv && typeof br.liv === 'object' ? br.liv : {});
      S.brouillon = null; S.etat = 'edition'; S.modifie = true; peindre(); return;
    }
    if (q === 'zero') { effacerBrouillon(S.ctx.affaire.affaire_id); S.brouillon = null; S.versionDe = null; S.liv = livVide(); S.etat = 'edition'; peindre(); return; }
    if (q === 'voirTout') { S.voirTout = true; peindreProps(); return; }
    if (q === 'enregistrer') { enregistrer(); return; }
    if (q === 'apercu') { entrerApercu(); return; }
    if (q === 'revenir') {
      sortirApercu();
      S.etat = 'edition'; peindre();
      var a = MOD.querySelector('[data-dev="apercu"]'); if (a) { try { a.focus(); } catch (e) {} }
      return;
    }
    if (q === 'imprimer') { imprimer(); return; }
    if (q === 'abandonner') {
      S.confirme = true;
      var c = el('devConfirme');
      if (c) {
        c.hidden = false;
        /* La confirmation s'ouvre SOUS le pied collant : on la ramene, et le focus va sur
           le geste qu'elle attend. */
        /* Le focus va sur le geste qui NE DETRUIT RIEN : deux appuis sur Entree ne doivent
           jamais abandonner un devis. */
        var non = c.querySelector('[data-dev="garder"]');
        if (non) { try { non.focus({ preventScroll: true }); } catch (e) { non.focus(); } }
        montrerDansBoite(c);
      }
      return;
    }
    if (q === 'garder') { S.confirme = false; var c2 = el('devConfirme'); if (c2) c2.hidden = true; return; }
    if (q === 'confirmerAbandon') { abandonner(); return; }
    if (q === 'accepter') {
      if (S.modifie) { dire('Enregistre d’abord tes changements : la commande part du devis enregistré.', true); return; }
      S.accord = true;
      var ac = el('devAccord');
      if (ac) {
        ac.hidden = false;
        /* Le focus va sur le geste qui ne fige rien : deux appuis sur Entree ne doivent
           jamais accepter un devis. */
        var pe = ac.querySelector('[data-dev="pasEncore"]');
        if (pe) { try { pe.focus({ preventScroll: true }); } catch (e) { pe.focus(); } }
        montrerDansBoite(ac);
      }
      return;
    }
    if (q === 'pasEncore') { S.accord = false; var a2 = el('devAccord'); if (a2) a2.hidden = true;
      var bt = MOD.querySelector('[data-dev="accepter"]'); if (bt) { try { bt.focus(); } catch (e) {} } return; }
    if (q === 'confirmerAccord') { accepter(); return; }
    if (q === 'envoyer') {
      if (S.modifie) { dire('Enregistre d’abord tes changements : c’est le devis enregistré que tu envoies.', true); return; }
      S.envoi = true;
      var ev = el('devEnvoi');
      if (ev) {
        ev.hidden = false;
        var pe2 = ev.querySelector('[data-dev="pasEnvoye"]');
        if (pe2) { try { pe2.focus({ preventScroll: true }); } catch (e) { pe2.focus(); } }
        montrerDansBoite(ev);
      }
      return;
    }
    if (q === 'pasEnvoye') { S.envoi = false; var ev2 = el('devEnvoi'); if (ev2) ev2.hidden = true;
      var be = MOD.querySelector('[data-dev="envoyer"]'); if (be) { try { be.focus(); } catch (e) {} } return; }
    if (q === 'confirmerEnvoi') { envoyer(); return; }
    if (q === 'refuser' || q === 'annulerAccord') {
      var refus = q === 'refuser';
      if (refus && S.modifie) { dire('Enregistre d’abord tes changements, ou ferme sans enregistrer : c’est le devis enregistré qu’il refuse.', true); return; }
      S[refus ? 'refus' : 'annul'] = true;
      var bx = el(refus ? 'devRefus' : 'devAnnul');
      if (bx) {
        bx.hidden = false;
        var nn = bx.querySelector(refus ? '[data-dev="pasRefus"]' : '[data-dev="garderAccord"]');
        if (nn) { try { nn.focus({ preventScroll: true }); } catch (e) { nn.focus(); } }
        montrerDansBoite(bx);
      }
      return;
    }
    if (q === 'pasRefus' || q === 'garderAccord') {
      var r1 = q === 'pasRefus';
      S[r1 ? 'refus' : 'annul'] = false;
      var bx2 = el(r1 ? 'devRefus' : 'devAnnul'); if (bx2) bx2.hidden = true;
      var rb = MOD.querySelector(r1 ? '[data-dev="refuser"]' : '[data-dev="annulerAccord"]'); if (rb) { try { rb.focus(); } catch (e) {} }
      return;
    }
    if (q === 'confirmerRefus') { noterRefus(); return; }
    if (q === 'confirmerAnnul') { annulerAccord(); return; }
    if (q === 'refaire') { refaire(); return; }
    if (q === 'telecharger') { var nm = telecharger(); if (nm) noterTelechargement('Fichier ' + nm + ' téléchargé. ' + IMPORT_VITI); return; }
  }
  function majAideLiv() {
    var sec = el('devLiv'); if (!sec) return;
    var p = sec.querySelector('.aff-aide'), veut = S.liv.mode !== 'retrait' && portDe() > 0;
    if (veut && !p) { p = document.createElement('p'); p.className = 'aff-aide'; p.textContent = TRANSPORT_VITI; sec.appendChild(p); }
    else if (!veut && p) p.remove();
  }
  function surChangement(ev) {
    var t = ev.target;
    if (S && S.etat === 'edition' && t.hasAttribute && t.hasAttribute('data-dev-livmode')) {
      /* LE MODE CHANGE : la section se repeint, le focus reste sur le bouton choisi. */
      S.liv.mode = t.value;
      if (S.liv.mode === 'retrait') { S.liv.port = ''; S.liv.transporteur = ''; }
      var sec = el('devLiv'); if (sec) sec.innerHTML = htmlLivraison();
      S.modifie = true; majTotaux(); ecrireBrouillon();
      var f = MOD.querySelector('[data-dev-livmode][value="' + cssEsc(S.liv.mode) + '"]'); if (f) { try { f.focus(); } catch (e) {} }
      return;
    }
    if (!S || S.etat !== 'edition' || !t.hasAttribute || !t.hasAttribute('data-dev-coche')) return;
    var cle = t.getAttribute('data-dev-coche');
    if (t.checked) {
      if (S.lignes.length >= MAX_LIGNES) { t.checked = false; dire('Un devis porte 200 lignes au plus.', true); return; }
      var p = S.props.concat(S.propsDomaine || []).filter(function (x) { return cleDe(x) === cle; })[0];
      if (p && !S.lignes.some(function (l) { return l.cle === cle; })) S.lignes.push(ligneDeProposition(p));
    } else {
      S.lignes = S.lignes.filter(function (l) { return l.cle !== cle; });
    }
    var n = el('devLignes'); if (n) n.innerHTML = htmlLignes();
    S.modifie = true;
    peindreProps();
    majTotaux();
    ecrireBrouillon();
    var f = MOD.querySelector('[data-dev-coche="' + cssEsc(cle) + '"]');
    if (f) { try { f.focus(); } catch (e) {} }
  }
  function surSaisie(ev) {
    var t = ev.target;
    if (!S || S.etat !== 'edition') return;
    if (t.getAttribute && t.getAttribute('aria-invalid') === 'true') effacerErreur(t);
    if (t.id === 'devCherche') { S.q = t.value; peindreProps(); return; }
    if (t.id === 'devRemise') S.remise = t.value;
    else if (t.id === 'devNotes') S.notes = t.value;
    else if (t.hasAttribute && t.hasAttribute('data-dev-liv')) {
      var avant = portDe() > 0;
      S.liv[t.getAttribute('data-dev-liv')] = t.value;
      /* La phrase Vitisoft du port apparait / disparait sans repeindre le champ ou l'on tape. */
      if ((portDe() > 0) !== avant) majAideLiv();
    }
    else if (t.hasAttribute && t.hasAttribute('data-dev-champ')) {
      var l = ligneDe(t);
      if (!l) return;
      l[t.getAttribute('data-dev-champ')] = t.value;
    } else return;
    S.modifie = true;
    majTotaux();
    ecrireBrouillon();
  }
  /* « Completer Mon domaine » : la boite du devis se retire, les reglages s'ouvrent sur
     l'onglet, par le SEUL point d'entree des reglages (`BdvNav.ouvrirReglages`). */
  function ouvrirDomaine() {
    fermer();
    if (window.BdvNav && BdvNav.ouvrirReglages) BdvNav.ouvrirReglages('bdvrBlocDomaine');
    /* Les reglages posent leur focus dans « Toi », onglet cache ici : on le met dans le
       premier champ de « Mon domaine », celui qu'on vient completer. */
    premierChampDomaine();
    setTimeout(premierChampDomaine, 0);
  }
  function premierChampDomaine() {
    var b = el('bdvrBlocDomaine');
    if (!b) return;
    var n = [].filter.call(b.querySelectorAll('input:not([type="hidden"]), select, textarea'), function (x) {
      return !x.disabled && !x.closest('[hidden]');
    })[0];
    if (n && document.activeElement !== n) { try { n.focus(); } catch (e) {} }
  }

  /* ---------------- ENREGISTRER ---------------- */
  function champDe(l, nom) {
    var li = MOD.querySelector('.dmod__ligne[data-cle="' + cssEsc(l.cle) + '"]');
    return li && li.querySelector('[data-dev-champ="' + nom + '"]');
  }
  /* L'ERREUR SE DIT LA OU VA LE FOCUS : une ligne sous le champ fautif, liee par
     `aria-describedby`, le champ marque `aria-invalid`, et ramene AU-DESSUS du pied
     collant. L'avis general la redit en haut, pour qui y regarde. */
  var N_ERR = 0;
  function effacerErreur(champ) {
    var d = (champ.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    d.filter(function (x) { return /^devErr/.test(x); }).forEach(function (x) { var n = el(x); if (n) n.remove(); });
    d = d.filter(function (x) { return !/^devErr/.test(x); });
    if (d.length) champ.setAttribute('aria-describedby', d.join(' ')); else champ.removeAttribute('aria-describedby');
    champ.removeAttribute('aria-invalid');
  }
  function effacerErreurs() {
    [].forEach.call(MOD.querySelectorAll('[aria-invalid="true"]'), effacerErreur);
    [].forEach.call(MOD.querySelectorAll('.dmod__err'), function (n) { n.remove(); });
  }
  function refuser(txt, champ) {
    effacerErreurs();
    dire(txt, true);
    if (champ) {
      var id = 'devErr' + (++N_ERR);
      var e = document.createElement('span');
      e.className = 'dmod__err';
      e.id = id;
      e.textContent = txt;
      champ.insertAdjacentElement('afterend', e);
      champ.setAttribute('aria-invalid', 'true');
      champ.setAttribute('aria-describedby', ((champ.getAttribute('aria-describedby') || '') + ' ' + id).trim());
      try { champ.focus({ preventScroll: true }); } catch (x) { try { champ.focus(); } catch (y) {} }
      montrerDansBoite(champ.closest('.aff-champ') || champ);
    }
    return null;
  }
  function verifier() {
    if (!S.lignes.length) return refuser('Coche au moins un vin.', el('devCherche'));
    var sortie = [];
    for (var i = 0; i < S.lignes.length; i++) {
      var l = S.lignes[i], nom = nomDe(l);
      var q = qteDe(l), pu = puDe(l), r = rlDe(l);
      if (q === null) return refuser('Indique la quantité pour ' + nom + '.', champDe(l, 'qte'));
      if (pu === null) return refuser('Indique un prix pour ' + nom + '.', champDe(l, 'prix'));
      if (r === null) return refuser('Une remise va de 0 à 100 %.', champDe(l, 'remise'));
      sortie.push({ num_produit: l.num_produit, designation: l.designation, conditionnement: l.conditionnement,
        millesime: l.millesime, quantite: q, pu_ht_c: pu, remise_cb: r, source_prix: sourceDe(l) });
    }
    if (gDe() === null) return refuser('Une remise va de 0 à 100 %.', el('devRemise'));
    var lv = S.liv;
    if (lv.mode === 'adresse') {
      if (!String(lv.nom).trim()) return refuser('Indique le destinataire de la livraison.', el('devLivNom'));
      if (!String(lv.adresse1).trim()) return refuser('Indique l’adresse de livraison.', el('devLivA1'));
      if (!String(lv.cp).trim()) return refuser('Indique le code postal de livraison.', el('devLivCp'));
      if (!String(lv.ville).trim()) return refuser('Indique la ville de livraison.', el('devLivVille'));
    }
    if (portDe() === null) return refuser('Les frais de port s’écrivent en euros, par exemple 15 ou 12,50.', el('devLivPort'));
    var dj = String(lv.date || '').trim(), dmin = S.devis && S.devis.date_devis ? String(S.devis.date_devis) : jourIso();
    if (dj && (!/^\d{4}-\d{2}-\d{2}$/.test(dj) || dj < dmin)) return refuser('La date de livraison ne peut pas être avant le devis.', el('devLivDate'));
    return sortie;
  }
  async function enregistrer() {
    if (S.attente || lectureSeule()) return;
    effacerErreurs();
    var lignes = verifier();
    if (!lignes) return;
    var moi = S, bouton = MOD.querySelector('[data-dev="enregistrer"]'), g = gDe();
    S.attente = true;
    if (bouton) bouton.setAttribute('aria-busy', 'true');
    var r = null, err = null, corps = null;
    try {
      corps = { p_bureau: bureau(), p_affaire: S.ctx.affaire.affaire_id, p_devis: S.devis ? S.devis.devis_id : null,
        p_lignes: lignes, p_remise_globale_cb: g, p_notes: String(S.notes || '').trim() || null };
      /* LE SEPTIEME ARGUMENT NE PART QUE S'IL SERT : tant que le SQL du lot 50 n'est pas passe,
         la base ne connait que la fonction a six arguments, et PostgREST refuserait TOUT
         enregistrement qui nomme un argument qu'elle n'a pas. */
      if (!S.devis && S.versionDe) corps.p_version_de = S.versionDe.devis_id;
      /* LE HUITIEME ARGUMENT (lot 53), meme regle : il part quand il dit quelque chose, ou
         quand le devis a deja les colonnes (le SQL est passe : remettre a l'adresse du client
         doit s'ecrire aussi). */
      if (!livParDefaut(S.liv) || lot53()) corps.p_livraison = livCorps();
      r = unSeul(await rpc('devis_enregistrer', corps));
    } catch (e) { err = e; }
    if (moi !== S) return;
    S.attente = false;
    if (bouton) bouton.removeAttribute('aria-busy');
    /* UN RETOUR VIDE OU SANS NUMERO EST UN ECHEC, et il se dit comme tel. */
    if (err || !r || !r.numero) {
      var detail = err ? String(err.detail || '') : '';
      if (err && sqlAbsent(err) && corps && corps.p_livraison && !lot53()) dire(MOT_SQL_LIV, true);
      else if (err && sqlAbsent(err)) dire(MOT_SQL, true);
      else if (/livraison/.test(detail)) dire('La livraison n’est pas complète : vérifie l’adresse, la date et les frais de port. Tes lignes sont gardées.', true);
      else if (/fiche du domaine incomplete/.test(detail)) {
        /* La base a relu la fiche et la trouve incomplete : on la relit aussi, pour
           nommer les VRAIS manques (et non les cinq champs par defaut). */
        var f = await relireDomaine();
        if (moi !== S) return;
        if (f === false) S.etat = 'illisible';
        else { S.etat = 'blocage'; S.manque = manquesDomaine(f); if (!S.manque.length) S.manque = ['la fiche que la base a refusée']; }
        peindre();
      }
      else if (/affaire close/.test(detail)) dire('Cette affaire est close : le devis ne s’enregistre plus. Tes lignes sont gardées.', true);
      else if (/devis remplace/.test(detail)) dire('Le devis ' + (S.versionDe ? S.versionDe.numero : '') + ' ne se remplace plus : il a été accepté ou abandonné entre-temps. Tes lignes sont gardées.', true);
      else if (err && S.versionDe && sqlAbsent(err)) dire('Refaire un devis n’est pas encore disponible sur ton compte. Tes lignes sont gardées.', true);
      else if (/devis fige|abandonne/.test(detail)) dire('Ce devis ne se modifie plus. Tes lignes sont gardées.', true);
      /* « ta connexion a coupe » seulement quand la requete n'a pas abouti (pas de statut). */
      else dire(err ? (err.status ? MOT_REFUS : MOT_PANNE) : MOT_VIDE, true);
      return;
    }
    var neuf = !S.devis, remplace = neuf && S.versionDe ? S.versionDe.numero : '';
    S.devis = r;
    if (lot53()) S.liv = livDeDevis(r);
    S.versionDe = null;
    effacerBrouillon(S.ctx.affaire.affaire_id);
    /* Le prix enregistre devient l'origine : sa provenance est celle qu'on vient d'ecrire. */
    S.lignes.forEach(function (l, i) { l.pu_origine = lignes[i].pu_ht_c; l.source_origine = lignes[i].source_prix; });
    S.lignesServeur = lignes.map(function (x, i) {
      var c = C.ligne(x.pu_ht_c, x.quantite, x.remise_cb, g);
      return Object.assign({ rang: i + 1, pu_l_c: c.pu_l, pu_f_c: c.pu_f, net_c: c.net, final_c: c.final }, x);
    });
    try {
      var lu = await api('/devis_lignes?bureau=eq.' + encodeURIComponent(bureau()) + '&devis_id=eq.' + encodeURIComponent(r.devis_id) + '&order=rang');
      if (Array.isArray(lu) && lu.length) S.lignesServeur = lu;
    } catch (e) {}
    if (moi !== S) return;
    S.confirme = false;
    S.modifie = false;
    peindre();
    dire('Devis ' + r.numero + (remplace ? ' enregistré. Il remplace le ' + remplace + ', abandonné.' : neuf ? ' enregistré.' : ' enregistré, avec tes changements.'));
    if (typeof S.ctx.change === 'function') { try { S.ctx.change(r); } catch (e) {} }
  }

  async function abandonner() {
    if (S.attente || !S.devis) return;
    var moi = S, r = null, err = null;
    S.attente = true;
    try { r = unSeul(await rpc('devis_abandonner', { p_bureau: bureau(), p_devis: S.devis.devis_id })); }
    catch (e) { err = e; }
    if (moi !== S) return;
    S.attente = false;
    if (err || !r || r.statut !== 'abandonne') {
      dire(err && sqlAbsent(err) ? MOT_SQL : 'Le devis n’est pas abandonné : la connexion a coupé ou la base a refusé. Réessaie.', true);
      return;
    }
    S.devis = r;
    S.confirme = false;
    peindre();
    dire('Devis ' + r.numero + ' abandonné. Il garde son numéro.');
    if (typeof S.ctx.change === 'function') { try { S.ctx.change(r); } catch (e) {} }
  }

  /* « OUI, IL A DIT NON » : un retour sans statut `refuse` est un ECHEC, le devis n'a pas
     bouge. Clore l'affaire est la case, et la base refuse si un autre devis est en cours. */
  async function noterRefus() {
    if (S.attente || !S.devis || (S.devis.statut !== 'enregistre' && S.devis.statut !== 'envoye')) return;
    var cM = el('devRefusMotif'), cC = el('devRefusClore');
    var motif = cM && cM.value ? cM.value : 'autre', clore = !!(cC && cC.checked && affaireOuverte());
    var moi = S, r = null, err = null, b = MOD.querySelector('[data-dev="confirmerRefus"]');
    S.attente = true;
    if (b) b.setAttribute('aria-busy', 'true');
    try { r = unSeul(await rpc('devis_refuser', { p_bureau: bureau(), p_devis: S.devis.devis_id, p_motif: motif, p_clore: clore })); }
    catch (e) { err = e; }
    if (moi !== S) return;
    S.attente = false;
    if (b) b.removeAttribute('aria-busy');
    if (err || !r || r.statut !== 'refuse') {
      var det = err ? String(err.detail || err.message || '') : '';
      if (err && sqlAbsent(err)) dire(MOT_SQL_REFUS, true);
      else if (/autre devis en cours/.test(det)) dire('L’affaire a un autre devis en cours : décoche « Pas pour cette fois », ou abandonne l’autre devis d’abord.', true);
      else if (/affaire close/.test(det)) dire('Cette affaire est déjà close : décoche « Pas pour cette fois ».', true);
      else dire('Le refus n’est pas noté : ' + (err && !err.status ? 'ta connexion a coupé.' : 'la base l’a refusé.') + ' Le devis n’a pas bougé.', true);
      return;
    }
    S.devis = r;
    S.refus = false;
    if (clore && S.ctx.affaire) { S.ctx.affaire.issue = 'perdue'; S.ctx.affaire.rappel = null; }
    peindre();
    dire('Devis ' + r.numero + ' noté refusé.' + (clore ? ' L’affaire passe à « Pas pour cette fois ».' : ''));
    var t = MOD.querySelector('[data-dev="apercu"]');
    if (t) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
    if (typeof S.ctx.change === 'function') { try { S.ctx.change(Object.assign({}, r, { affaireClose: clore })); } catch (e) {} }
  }
  /* « OUI, ANNULER L'ACCEPTATION » : le devis revient envoye ou enregistre. S'il redevient
     modifiable, ses lignes et ses propositions sont relues, comme a l'ouverture. */
  async function annulerAccord() {
    if (S.attente || !S.devis || S.devis.statut !== 'accepte') return;
    var cR = el('devAnnulRouvrir');
    var rouvrir = !!(cR && cR.checked);
    var moi = S, r = null, err = null, b = MOD.querySelector('[data-dev="confirmerAnnul"]');
    S.attente = true;
    if (b) b.setAttribute('aria-busy', 'true');
    try { r = unSeul(await rpc('devis_annuler_accord', { p_bureau: bureau(), p_devis: S.devis.devis_id, p_rouvrir: rouvrir })); }
    catch (e) { err = e; }
    if (moi !== S) return;
    S.attente = false;
    if (b) b.removeAttribute('aria-busy');
    if (err || !r || (r.statut !== 'envoye' && r.statut !== 'enregistre') || r.accepte_le) {
      dire(err && sqlAbsent(err) ? MOT_SQL_ANNUL
        : 'L’acceptation n’est pas annulée : ' + (err && !err.status ? 'ta connexion a coupé.' : 'la base l’a refusé.') + ' Le devis est toujours accepté.', true);
      return;
    }
    S.devis = r;
    S.annul = false;
    if (rouvrir && S.ctx.affaire && S.ctx.affaire.issue === 'gagnee') S.ctx.affaire.issue = 'en_cours';
    var mot = 'Acceptation du devis ' + r.numero + ' annulée : il est de nouveau ' + (r.statut === 'envoye' ? 'envoyé' : 'enregistré') + '.'
      + (rouvrir ? ' L’affaire est rouverte.' : '') + ' Pense à supprimer la commande dans Vitisoft si tu l’avais importée.';
    if (typeof S.ctx.change === 'function') { try { S.ctx.change(Object.assign({}, r, { affaireRouverte: rouvrir })); } catch (e) {} }
    if (r.statut === 'enregistre' && !lectureSeule()) { S.etat = 'chargement'; peindre(); await charger(moi); if (moi !== S) return; }
    else peindre();
    dire(mot);
  }

  async function accepter() {
    if (S.attente || !S.devis || (S.devis.statut !== 'enregistre' && S.devis.statut !== 'envoye')) return;
    if (S.modifie) { dire('Enregistre d’abord tes changements : la commande part du devis enregistré.', true); return; }
    var moi = S, r = null, err = null, b = MOD.querySelector('[data-dev="confirmerAccord"]');
    S.attente = true;
    if (b) b.setAttribute('aria-busy', 'true');
    var corpsA = { p_bureau: bureau(), p_devis: S.devis.devis_id };
    var copieA = lot52() && S.devis.statut === 'envoye' && !S.devis.papier_empreinte;
    if (copieA) { var papA = await copieDuPapier(); if (moi !== S) return; if (papA) corpsA.p_papier = papA; }
    try { r = unSeul(await rpc('devis_accepter', corpsA)); }
    catch (e) { err = e; }
    if (moi !== S) return;
    S.attente = false;
    if (b) b.removeAttribute('aria-busy');
    /* UN RETOUR SANS STATUT `accepte` EST UN ECHEC : le devis n'est PAS fige. */
    if (err || !r || r.statut !== 'accepte' || !r.accepte_le) {
      var det = err ? String(err.detail || err.message || '') : '';
      if (err && sqlAbsent(err)) dire(MOT_SQL_CMD, true);
      else if (/numero produit/.test(det)) dire('Un vin du devis n’a pas de code article : Vitisoft ne saurait pas quoi facturer. Le devis n’est pas figé.', true);
      else if (/sans numero ni e-mail/.test(det)) dire('Ce client n’a ni numéro Vitisoft ni e-mail : Vitisoft créerait un deuxième client. Le devis n’est pas figé.', true);
      else if (/deja commandee/.test(det)) dire('Cette affaire a déjà une commande : un seul devis accepté par affaire.', true);
      else if (/affaire close/.test(det)) dire('Cette affaire est perdue : son devis ne s’accepte plus.', true);
      else dire('Le devis n’est pas accepté : ' + (err && !err.status ? 'ta connexion a coupé.' : 'la base l’a refusé.') + ' Réessaie.', true);
      return;
    }
    S.devis = r;
    S.accord = false;
    peindre();
    var nom = telecharger();
    var motA = 'Devis ' + r.numero + ' accepté, affaire gagnée. ' + (copieA && !r.papier_empreinte ? MOT_COPIE_RATEE + ' ' : '');
    if (nom) noterTelechargement(motA + 'Fichier ' + nom + ' téléchargé. ' + IMPORT_VITI);
    else dire(motA + 'Le fichier n’est pas parti : appuie sur « Télécharger la commande ».', true);
    var t = MOD.querySelector('[data-dev="telecharger"]');
    if (t) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
    if (typeof S.ctx.change === 'function') { try { S.ctx.change(r); } catch (e) {} }
  }
  /* « C'EST NOTE » : la date d'envoi, et le rappel s'il est coche. Les dates fausses se disent
     sous le champ, comme a l'enregistrement. Un retour sans statut `envoye` est un ECHEC : le
     devis reste modifiable, et on le dit. */
  async function envoyer() {
    if (S.attente || !S.devis || S.devis.statut !== 'enregistre') return;
    effacerErreurs();
    var auj = jourIso(), cJour = el('devEnvoiJour'), cRap = el('devEnvoiRappel'), cRel = el('devEnvoiRelance'), cEt = el('devEnvoiEtape');
    var jour = cJour && cJour.value ? cJour.value : auj;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || jour > auj) return refuser('La date d’envoi ne peut pas être dans le futur.', cJour);
    if (S.devis.date_devis && jour < String(S.devis.date_devis)) return refuser('Le devis date du ' + dateFr(S.devis.date_devis) + ' : il n’a pas pu partir avant.', cJour);
    var rappel = null;
    if (cRap && cRap.checked) {
      rappel = cRel && cRel.value ? cRel.value : relanceProposee(jour, S.devis);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rappel) || rappel < jour) return refuser('La relance ne peut pas tomber avant l’envoi.', cRel);
    }
    var et = cEt && cEt.checked && S.ctx.etapeDevis ? S.ctx.etapeDevis.etape_id : null;
    var moi = S, r = null, err = null, b = MOD.querySelector('[data-dev="confirmerEnvoi"]');
    S.attente = true;
    if (b) b.setAttribute('aria-busy', 'true');
    var corpsE = { p_bureau: bureau(), p_devis: S.devis.devis_id, p_jour: jour, p_rappel: rappel, p_rappel_titre: null, p_etape: et };
    var copieE = lot52();
    if (copieE) { var papE = await copieDuPapier(); if (moi !== S) { return; } if (papE) corpsE.p_papier = papE; }
    try { r = unSeul(await rpc('devis_envoyer', corpsE)); }
    catch (e) { err = e; }
    if (moi !== S) return;
    S.attente = false;
    if (b) b.removeAttribute('aria-busy');
    if (err || !r || r.statut !== 'envoye' || !r.envoye_le) {
      var det = err ? String(err.detail || err.message || '') : '';
      if (err && sqlAbsent(err)) dire(MOT_SQL_ENV, true);
      else if (/futur/.test(det)) dire('La date d’envoi ne peut pas être dans le futur.', true);
      else if (/avant le devis/.test(det)) dire('La date d’envoi est avant celle du devis.', true);
      else if (/rappel avant/.test(det)) dire('La relance ne peut pas tomber avant l’envoi.', true);
      else if (/affaire close/.test(det)) dire('Cette affaire est close : son devis ne se note plus envoyé.', true);
      else if (/etape hors/.test(det)) dire('Cette étape n’existe plus pour ce type d’affaire. Décoche-la et réessaie.', true);
      else dire('L’envoi n’est pas noté : ' + (err && !err.status ? 'ta connexion a coupé.' : 'la base l’a refusé.') + ' Le devis n’est pas figé.', true);
      return;
    }
    S.devis = r;
    S.envoi = false;
    if (rappel && S.ctx.affaire) { S.ctx.affaire.rappel = rappel; S.ctx.affaire.rappel_titre = 'Relancer le devis ' + r.numero; }
    peindre();
    dire('Devis ' + r.numero + ' noté envoyé le ' + dateFr(r.envoye_le) + '.' + (rappel ? ' Relance prévue le ' + dateFr(rappel) + ', dans Ma journée.' : '')
      + (copieE ? (r.papier_empreinte ? ' Une copie exacte est gardée.' : ' ' + MOT_COPIE_RATEE) : ''), copieE && !r.papier_empreinte);
    var t = MOD.querySelector('[data-dev="apercu"]');
    if (t) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
    if (typeof S.ctx.change === 'function') { try { S.ctx.change(r); } catch (e) {} }
  }
  /* « REFAIRE CE DEVIS » : un NOUVEAU devis, aux memes lignes, a modifier. Rien n'est ecrit
     tant qu'il n'est pas enregistre ; a ce moment la base pose `version_de` et abandonne
     l'ancien dans la meme transaction. Les propositions sont relues : le devis envoye ne les
     avait pas chargees. */
  async function refaire() {
    if (S.attente || !S.devis || ['envoye', 'enregistre', 'refuse'].indexOf(S.devis.statut) < 0 || !affaireOuverte()) return;
    var moi = S, ancien = S.devis, lignes = S.lignesServeur || [];
    S.etat = 'chargement'; peindre();
    try {
      var p = await rpc('devis_propositions', { p_bureau: bureau(), p_affaire: S.ctx.affaire.affaire_id, p_tout_le_domaine: false });
      if (moi !== S) return;
      S.props = Array.isArray(p) ? trierProps(p) : [];
      if (S.props.length) S.source = S.props[0].source === 'client' ? 'client' : 'bureau';
    } catch (e) { if (moi !== S) return; S.props = []; }
    S.versionDe = { devis_id: ancien.devis_id, numero: ancien.numero };
    S.devis = null;
    S.lignes = lignes.map(ligneDeDevis);
    S.remise = C.pourcent(ancien.remise_globale_cb || 0);
    S.notes = ancien.notes || '';
    S.liv = livDeDevis(ancien);
    /* Une date souhaitee deja passee ne se reprend pas : le nouveau devis la refuserait. */
    if (S.liv.date && S.liv.date < jourIso()) S.liv.date = '';
    S.confirme = false; S.accord = false; S.envoi = false;
    S.etat = 'edition'; S.modifie = true;
    peindre();
    ecrireBrouillon();
    dire('Nouveau devis, avec les lignes du ' + ancien.numero + '. Change ce qu’il faut, puis enregistre-le.');
    var c = el('devCherche'); if (c) { try { c.focus({ preventScroll: true }); } catch (e) {} }
  }
  /* LE TELECHARGEMENT : le fichier se fabrique a chaque appui, depuis le devis fige et
     ses lignes relues. Meme devis, meme fichier, au caractere pres. */
  function telecharger() {
    if (!window.BdvCommande || !S.devis || S.devis.statut !== 'accepte') return null;
    var f;
    try { f = BdvCommande.fabriquer(S.devis, S.lignesServeur || []); }
    catch (e) { dire('Le fichier de commande n’a pas pu se fabriquer. Rouvre le devis et réessaie.', true); return null; }
    try {
      var u = URL.createObjectURL(new Blob([f.texte], { type: 'text/csv;charset=utf-8' }));
      var a = document.createElement('a');
      a.href = u; a.download = f.nom; a.hidden = true;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { try { URL.revokeObjectURL(u); } catch (e) {} }, 2000);
    } catch (e) { dire('Le téléchargement n’a pas pu partir. Réessaie.', true); return null; }
    return f.nom;
  }

  /* LOT 52 : LE TELECHARGEMENT EST NOTE APRES COUP. Le fichier est deja parti : une trace
     ratee ne le reprend pas, elle se dit. Le texte de la trace est remplace EN PLACE, le
     focus reste sur le bouton. */
  async function noterTelechargement(mot) {
    dire(mot);
    if (!lot52() || !S.devis || S.devis.statut !== 'accepte') return;
    var moi = S, r = null;
    try { r = unSeul(await rpc('devis_noter_telechargement', { p_bureau: bureau(), p_devis: S.devis.devis_id })); }
    catch (e) { r = null; }
    if (moi !== S) return;
    if (!r || !(Number(r.commande_telechargements) > 0)) { dire(mot + ' ' + MOT_TRACE_RATEE, true); return; }
    S.devis = r;
    var n = el('devCmdTrace');
    if (n) { n.textContent = phraseTrace(r); n.hidden = !n.textContent; }
    /* La confirmation d'annulation (repliee) cite la trace : elle est redite, pas repeinte. */
    var an = el('devAnnul');
    if (an && an.hidden) an.outerHTML = htmlConfirmeAnnul();
  }

  /* ---------------- L'APERCU ET L'IMPRESSION ---------------- */
  /* LOT 52 : LA COPIE EXACTE. Le papier, avec le TEXTE de ses deux feuilles (servies,
     minifiees) a la place des liens : imprime dans un an, apres un changement de dessin, il
     sortira pareil. Les polices restent des liens (elles ne portent aucun contenu). Une
     feuille qui ne se lit pas : pas de copie, et l'ecran le dit. */
  async function feuillesPapier() {
    if (FEUILLES) return FEUILLES;
    if (typeof fetch !== 'function') return null;
    try {
      var t = await Promise.all(FEUILLES_PAPIER.map(function (h) {
        return fetch(h, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(h); return r.text(); });
      }));
      if (t.some(function (x) { return !x || /<\s*\/?\s*(style|script)/i.test(x); })) return null;
      FEUILLES = t;
      return t;
    } catch (e) { return null; }
  }
  async function copieDuPapier() {
    var f = await feuillesPapier();
    if (!f || !S || !S.devis) return null;
    return htmlPapier(S.devis, S.lignesServeur || [], { polices: polices(), feuilles: f });
  }
  /* LA COPIE GARDEE, relue a la demande (30 a 40 ko : jamais avec la liste). `verifiee` :
     true si son empreinte est retrouvee ici, false si elle ne correspond pas, null si ce
     navigateur ne sait pas la calculer. */
  async function lireCopie() {
    var d = S.devis;
    var l = await api('/devis_copies?bureau=eq.' + encodeURIComponent(bureau()) + '&devis_id=eq.'
      + encodeURIComponent(d.devis_id) + '&select=papier,empreinte,cree_le');
    var c = Array.isArray(l) ? l[0] : null;
    if (!c || !c.papier) return null;
    var v = null;
    try {
      var sub = window.crypto && window.crypto.subtle;
      if (sub && typeof TextEncoder === 'function') {
        var h = new Uint8Array(await sub.digest('SHA-256', new TextEncoder().encode(c.papier)));
        var hex = Array.prototype.map.call(h, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        v = hex === c.empreinte && hex === d.papier_empreinte;
      }
    } catch (e) { v = null; }
    return { id: d.devis_id, papier: c.papier, empreinte: c.empreinte, le: c.cree_le, verifiee: v };
  }
  /* CE QUE L'APERCU MONTRE. Un devis qui a sa copie montre LA COPIE (c'est le papier que le
     client a eu). Sans copie, le devis est refait de ses donnees, et un devis parti le dit. */
  async function sourceApercu() {
    var d = S.devis;
    if (lot52() && d && d.papier_empreinte) {
      if (!S.copie || S.copie.id !== d.devis_id) {
        var moi = S, c = null;
        try { c = await lireCopie(); } catch (e) { c = null; }
        if (moi !== S) return null;
        S.copie = c;   // null : une lecture ratee se retente a la prochaine ouverture
      }
      if (S.copie) return { html: S.copie.papier, copie: true, note: noteCopie(S.copie) };
      return { html: papierCourant(), copie: false, souci: true,
        note: 'La copie gardée n’a pas pu être lue (connexion). Ceci est le devis refait à partir de ses données.' };
    }
    if (lot52() && d && (d.envoye_le || d.statut === 'accepte'))
      return { html: papierCourant(), copie: false,
        note: d.envoye_le ? 'Pas de copie gardée pour ce devis : il a été envoyé avant que le bureau les garde. Ceci est le devis refait à partir de ses données.'
          : 'Ce devis n’a pas été noté envoyé : pas de copie gardée. Ceci est le devis refait à partir de ses données.' };
    return { html: papierCourant(), copie: false, note: '' };
  }
  function noteCopie(c) {
    var d = S.devis;
    var quoi = d.envoye_le ? 'C’est la copie exacte du devis envoyé le ' + dateFr(d.envoye_le) : 'C’est la copie exacte du devis gardée le ' + dateFr(c.le);
    return quoi + ' : elle ne se modifie plus. Empreinte numérique ' + empreinteLisible(c.empreinte)
      + (c.verifiee === true ? ', vérifiée.' : c.verifiee === false ? '.' : '.')
      + (c.verifiee === false ? ' Attention : la copie ne correspond plus à son empreinte.' : '');
  }
  function polices() {
    return [].map.call(document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com"]'), function (l) { return l.href; });
  }
  function papierCourant() {
    return htmlPapier(S.devis, S.lignesServeur || [], { polices: polices() });
  }
  /* Le document s'ecrit dans l'iframe (meme origine : les feuilles /css/ se
     resolvent comme dans la page). On attend son `load`, qui suit les feuilles. */
  function remplir(iframe, html) {
    return new Promise(function (ok) {
      var fait = false;
      function fin() { if (!fait) { fait = true; ok(); } }
      iframe.addEventListener('load', fin, { once: true });
      var doc = iframe.contentDocument;
      if (!doc) { fin(); return; }
      doc.open(); doc.write(html); doc.close();
      if (doc.readyState === 'complete') setTimeout(fin, 0);
      setTimeout(fin, 4000);   // une feuille qui ne vient pas n'empeche pas d'imprimer
    });
  }
  /* L'APERCU SORT DU TIROIR : dans 461 px la feuille serait remise en page a un ou deux
     mots par ligne. La boite redevient une modale large le temps de l'apercu (le tiroir
     est rendu par `BdvTiroir.retirer`, puis repose au retour) ; le contrat ARIA suit. */
  function entrerApercu() {
    dire('');
    var box = MOD.querySelector('.tmod__boite');
    S.horsTiroir = !!(window.BdvTiroir && BdvTiroir.actif && BdvTiroir.actif());
    if (S.horsTiroir) {
      BdvTiroir.retirer();
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      document.body.style.overflow = 'hidden';
    }
    S.etat = 'apercu';
    peindre();
    /* Le bouton « Voir et imprimer » vient de disparaitre : le focus va au geste de l'apercu. */
    var imp = MOD.querySelector('[data-dev="imprimer"]');
    if (imp) { try { imp.focus({ preventScroll: true }); } catch (e) { imp.focus(); } }
  }
  function sortirApercu() {
    if (S.horsTiroir && window.BdvTiroir) BdvTiroir.poser(MOD.querySelector('.tmod__boite'));
    S.horsTiroir = false;
  }
  /* LA FEUILLE EST RENDUE A SA VRAIE LARGEUR (A4, 794 px), puis REDUITE a la place qu'on a :
     aucune colonne coupee, aucun defilement dans l'iframe (elle prend la hauteur du
     document), la seule chose qui defile est la boite. */
  var A4 = 794;
  function ajusterFeuille() {
    var f = el('devFeuille'), w = f && f.parentNode;
    if (!f || !w || !f.contentDocument || !f.contentDocument.documentElement) return;
    var h = Math.max(f.contentDocument.documentElement.scrollHeight || 0, 1123);
    var dispo = w.clientWidth || A4;
    var k = Math.min(1, dispo / A4);
    f.style.width = A4 + 'px';
    f.style.height = h + 'px';
    f.style.transform = 'scale(' + k + ')';
    w.style.height = Math.ceil(h * k) + 'px';
  }
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('resize', function () { if (S && S.etat === 'apercu') ajusterFeuille(); });
  }
  function peindreApercu(corps) {
    var num = S.devis ? S.devis.numero : '';
    corps.innerHTML = '<p class="dmod__gestes dmod__apercu-g">'
      + '<button type="button" class="btn btn--bordeaux" data-dev="imprimer">Imprimer ou enregistrer en PDF</button>'
      + '<button type="button" class="btn" data-dev="revenir">Revenir au devis</button></p>'
      + '<p class="aff-aide dmod__copie" id="devCopieNote" hidden></p>'
      + '<div class="dmod__feuille" id="devFeuilleW"></div>'
      + '<p class="aff-aide dmod__pdf">Pour lire en grand, enregistre-le en PDF.</p>';
    /* La feuille se lit depuis son haut : la boite gardait la position du formulaire. */
    MOD.querySelector('.tmod__boite').scrollTop = 0;
    var moi = S;
    S.apercu = null;
    sourceApercu().then(function (src) {
      if (moi !== S || S.etat !== 'apercu' || !src) return;
      S.apercu = src;
      var n = el('devCopieNote');
      if (n) { n.textContent = src.note; n.hidden = !src.note; n.classList.toggle('dmod__copie--souci', !!src.souci || / Attention /.test(src.note)); }
      var w = el('devFeuilleW');
      if (!w) return;
      var f = cadre('devFeuille', 'dmod__feuille-i', 'Aperçu du devis ' + num, src.copie);
      w.appendChild(f);
      remplir(f, src.html).then(ajusterFeuille);
    });
  }
  /* UNE COPIE VIENT DE LA BASE : elle s'affiche dans une iframe SANS SCRIPT (`sandbox`, meme
     origine pour la remplir et l'imprimer, modales pour l'impression). La base refuse deja
     tout `<script>` ; ceci ferme le reste (un attribut `on...`). */
  function cadre(id, classe, titre, copie) {
    var f = document.createElement('iframe');
    f.id = id; f.className = classe; f.title = titre;
    if (copie) f.setAttribute('sandbox', 'allow-same-origin allow-modals');
    return f;
  }
  async function imprimer() {
    var src = S.apercu || await sourceApercu();
    if (!src) return;
    /* Une iframe par sorte : on ne retire pas un `sandbox` a une iframe deja chargee. */
    var id = src.copie ? 'devImpressionCopie' : 'devImpression';
    var f = el(id);
    if (!f) {
      f = cadre(id, 'dmod__imprimeur', 'Impression du devis', src.copie);
      f.setAttribute('aria-hidden', 'true');
      f.setAttribute('tabindex', '-1');
      document.body.appendChild(f);
    }
    await remplir(f, src.html);
    var doc = f.contentDocument;
    try { if (doc && doc.fonts && doc.fonts.ready) await doc.fonts.ready; } catch (e) {}
    try { f.contentWindow.focus(); f.contentWindow.print(); }
    catch (e) { dire('L’impression n’a pas pu s’ouvrir. Réessaie.', true); }
  }

  /* LE DEVIS IMPRIME, PUR : (devis, lignes, options) -> un document HTML complet.
     Aucun acces au DOM de la page. Les conditions viennent de `BdvDomaine.conditions()`
     (la phrase de Mon domaine, ecrite une seule fois), lue sur l'INSTANTANE du devis :
     le devis porte `paiement_mode` et `paiement_jours` copies a l'enregistrement.
     Ce qui est imprime : section B de la specification. Jamais de numero d'accises. */
  function prixNet(l) { return l.pu_l_c != null ? l.pu_l_c : C.ligne(l.pu_ht_c, l.quantite, l.remise_cb || 0, 0).pu_l; }
  function sirenFr(s) { return String(s || '').replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3'); }
  function cssTexte(t) { return String(t).replace(/[\\"]/g, '\\$&').replace(/[\n\r]/g, ' '); }
  function htmlPapier(d, lignes, o) {
    o = o || {};
    d = d || {};
    var v = d.vendeur || {}, a = d.acheteur || {};
    var cond = o.conditions != null ? o.conditions
      : (window.BdvDomaine && BdvDomaine.conditions ? BdvDomaine.conditions(d) : '');
    function ligneSi(txt) { return txt ? '<p>' + esc(txt) + '</p>' : ''; }
    function cpVille(x) { return [x.code_postal, x.ville].filter(Boolean).join(' '); }
    var g = d.remise_globale_cb || 0;
    var raisonV = String(v.raison_sociale || '');
    var forme = v.forme_juridique && raisonV.toUpperCase().indexOf(String(v.forme_juridique).toUpperCase()) < 0
      ? ' (' + esc(v.forme_juridique) + ')' : '';
    /* LE PRIX NET (prix unitaire SIGNE, colonne 23 de Vitisoft) s'imprime des qu'une
       remise existe : c'est lui qui explique le total HT au centime pres. */
    /* « Prix net » = prix apres la remise de LIGNE (pu_l) : prix net x quantite = total HT
       de la ligne, et leur somme = total des vins. La remise globale reste une ligne des
       totaux. La colonne n'existe que si une ligne est remisee. */
    var avecNet = (lignes || []).some(function (l) { return l.remise_cb > 0; });
    var lg = (lignes || []).map(function (l) {
      return '<tr><td class="dpap__vin"><b>' + esc(l.designation) + '</b>'
        + (l.millesime ? ' ' + esc(l.millesime) : '') + (l.conditionnement ? ', ' + esc(l.conditionnement) : '')
        + (l.num_produit ? '<br><span class="dpap__code">Code article ' + esc(l.num_produit) + '</span>' : '') + '</td>'
        + '<td class="dpap__n">' + esc(l.quantite) + '</td>'
        + '<td class="dpap__n">' + C.euros(l.pu_ht_c) + '</td>'
        + '<td class="dpap__n">' + (l.remise_cb ? C.pourcent(l.remise_cb) + ' %' : '') + '</td>'
        + (avecNet ? '<td class="dpap__n">' + C.euros(prixNet(l)) + '</td>' : '')
        + '<td class="dpap__n">' + C.euros(l.net_c) + '</td></tr>';
    }).join('');
    return '<!doctype html><html lang="fr" data-theme="light"><head><meta charset="utf-8">'
      + '<title>Devis ' + esc(d.numero || '') + '</title>'
      + (o.polices || []).map(function (h) { return '<link rel="stylesheet" href="' + esc(h) + '">'; }).join('')
      + (o.feuilles ? o.feuilles.map(function (t) { return '<style>' + t + '</style>'; }).join('')
        : '<link rel="stylesheet" href="/css/bdv-theme.css"><link rel="stylesheet" href="/css/bdv-devis-papier.css">')
      /* SUR CHAQUE PAGE : le numero du devis et « Page N/M » (boites de marge de @page). Le
         numero change a chaque devis, d'ou ces deux regles ecrites ici et pas dans la feuille. */
      /* Valeurs LITTERALES : les var() de la page ne passent pas dans les boites de marge. */
      + '<style>@page{@bottom-left{content:"Devis ' + cssTexte(d.numero || '') + '";' + MARGE + '}'
      + '@bottom-right{content:"Page " counter(page) "/" counter(pages);' + MARGE + '}}</style>'
      + '</head><body class="dpap"><main class="dpap__feuille">'
      + '<header class="dpap__tete"><div class="dpap__vendeur">'
      + '<p class="dpap__raison">' + esc(raisonV) + forme + '</p>'
      + ligneSi(v.adresse) + ligneSi(cpVille(v))
      + ligneSi(v.siret ? 'SIRET ' + v.siret : '')
      + ligneSi(v.rcs_ville && (v.siren || v.siret) ? 'RCS ' + v.rcs_ville + ' ' + sirenFr(v.siren || String(v.siret).slice(0, 9)) : '')
      + ligneSi(v.capital_eur ? 'Capital de ' + Number(v.capital_eur).toLocaleString('fr-FR') + '\u00a0€' : '')
      + ligneSi(v.tva ? 'N° de TVA intracommunautaire ' + v.tva : '')
      + ligneSi(v.email) + ligneSi(v.telephone)
      + '</div><div class="dpap__titre"><h1 class="dpap__h1">Devis ' + esc(d.numero || '') + '</h1>'
      + '<p>Date du devis : ' + esc(dateFr(d.date_devis)) + '</p>'
      + '<p>Devis valable jusqu’au ' + esc(dateFr(d.valable_jusqu)) + '</p></div></header>'
      + '<section class="dpap__client"><p class="dpap__etiq">Pour</p>'
      + '<p class="dpap__raison">' + esc(a.nom || '') + '</p>'
      + ligneSi(a.contact_nom ? 'À l’attention de ' + a.contact_nom : '')
      + ligneSi(a.adresse) + ligneSi(cpVille(a)) + ligneSi(a.pays && !/^france$/i.test(a.pays) ? a.pays : '')
      + ligneSi(a.siret ? 'SIRET ' + a.siret : '')
      + ligneSi(a.num_client ? 'N° client ' + a.num_client : '')
      + '</section>'
      /* LOT 53 : la livraison, sous le client. Un devis d'avant le lot n'a rien a dire. */
      + (livAdire(d) ? '<section class="dpap__liv"><p class="dpap__etiq">Livraison</p><p>' + esc(phraseLiv(d)) + '</p></section>' : '')
      + '<table class="dpap__table"><thead><tr><th>Vin</th><th class="dpap__n">Quantité</th><th class="dpap__n">Prix HT</th>'
      + '<th class="dpap__n">Remise</th>' + (avecNet ? '<th class="dpap__n">Prix net</th>' : '')
      + '<th class="dpap__n">Total HT</th></tr></thead><tbody>' + lg + '</tbody></table>'
      + '<div class="dpap__fin"><section class="dpap__totaux">'
      + '<p><span>Total des vins HT</span><span>' + C.euros(d.total_vins_c) + '</span></p>'
      + (g > 0 ? '<p><span>' + libelleRemise(g) + ' :</span><span>-' + C.euros(d.remise_globale_c) + '</span></p>'
        + '<p class="dpap__x">' + EXPLICATION_REMISE + '</p>' : '')
      + (Number(d.port_c) > 0 ? '<p><span>Frais de port HT</span><span>' + C.euros(d.port_c) + '</span></p>' : '')
      + '<p><span>Total HT</span><span>' + C.euros(d.total_ht_c) + '</span></p>'
      + '<p><span>TVA 20 %</span><span>' + C.euros(d.tva_c) + '</span></p>'
      + '<p class="dpap__ttc"><span>Total TTC</span><span>' + C.euros(d.total_ttc_c) + '</span></p>'
      + '</section>'
      + '<section class="dpap__mentions"><p>' + ACCISES + '</p>'
      + (cond ? '<p>' + esc(cond) + '.</p>' : '')
      + '<p>' + esc(PENALITES) + '</p>'
      + (d.notes ? '<p class="dpap__notes">' + esc(d.notes) + '</p>' : '')
      + '</section></div>'
      /* LOT 51 : le cadre « Bon pour accord ». L'usage, pas une obligation : c'est ce que le
         client remplit quand il signe sur papier. Absent d'un devis abandonne ou refuse. */
      + (d.statut === 'abandonne' || d.statut === 'refuse' ? ''
        : '<section class="dpap__accord" aria-label="Bon pour accord"><p class="dpap__etiq">Bon pour accord</p>'
          + '<p class="dpap__case">Date :</p><p class="dpap__case">Nom et qualité du signataire :</p>'
          + '<p class="dpap__case dpap__case--signe">Signature et cachet :</p></section>')
      + '</main></body></html>';
  }

  window.BdvDevis = { ouvrir: ouvrir, fermer: fermer, htmlPapier: htmlPapier,
                      _S: function () { return S; }, _cle: CLE_BROUILLON };
})();
