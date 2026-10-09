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

   LA BOITE `#devisModale` (`tmod dmod`) EST UNE MODALE LARGE, A TOUTES LES LARGEURS
   (01/10/2026, juge vigneron V4). Un devis est une SAISIE : dans le tiroir d'un tiers
   d'ecran chaque vin devenait une carte de 335 px, et la liste des affaires restait
   derriere sans servir. Il ne passe donc PLUS par `BdvTiroir` : il pose lui-meme le
   contrat d'une modale (role dialog, aria-modal, defilement du corps rendu a la
   fermeture) et RETIENT LE CLAVIER, puisqu'il dit qu'il n'y a rien d'autre a l'ecran.
   Toujours UNE boite a la fois : le panneau d'affaire ecrit son etape en attente et se
   retire (`BdvTiroir.retirer`), puis le devis se pose ; « Retour a l'affaire » fait le
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
  /* LOT 65 : rappeler un devis envoye. */
  var MOT_SQL_RAPPEL = 'Rappeler un devis n’est pas encore disponible sur ton compte.';
  /* LOT 53 : la livraison. Trois facons de livrer, dans les mots du vigneron. */
  var MODES_LIV = [['client', 'À l’adresse du client'], ['adresse', 'À une autre adresse'], ['retrait', 'Il vient chercher au domaine']];
  var MOT_SQL_LIV = 'La livraison sur le devis n’est pas encore disponible sur ton compte. Tes lignes sont gardées.';
  /* LOT 54 : la TVA autre que 20 %. Trois regimes ; deux taux en France. Les mentions sont
     celles du BOFiP : BOI-TVA-DECLA-30-20-20-30 § 70 pour l'UE (texte exact), reference au
     262 I du CGI pour l'export (BOI-TVA-DECLA-30-20-20-10 § 490 exige la reference au texte). */
  var REGIMES = [['france', 'En France'], ['export', 'Export hors de l’UE'], ['ue', 'Un pro dans un autre pays de l’UE']];
  var TAUX = [['2000', '20 %'], ['550', '5,5 %']];
  var MENTION_EXPORT = 'Exonération de TVA, article 262 I du CGI.';
  var MENTION_UE = 'Exonération TVA, art. 262 ter-I du code général des impôts.';
  var ACCISES_HORS = 'Prix HT, hors droits d’accises.';
  /* V9 : tant que la question n'a pas de reponse, le total ne dit ni l'un ni l'autre. */
  var ACCISES_A_DIRE = 'Dis plus haut si tes prix comprennent les droits d’accises : le devis l’écrira.';
  var AIDE_ACCISE = 'Un vin qui part en suspension de droits (sous DAE) ne paie pas l’accise française : si c’est le cas, enlève-la de tes prix.';
  var AIDE_VIES = 'Vérifie ce numéro sur le site VIES de la Commission européenne avant d’envoyer : sans numéro valide, la vente reste taxée en France.';
  var AIDE_55 = 'Le 5,5 % vaut pour le jus de raisin non fermenté, le moût et l’épicerie. Le vin reste à 20 %.';
  /* Le fichier donne le taux de chaque LIGNE ; le port, Vitisoft le taxe au taux de son
     « Produit pour transport » (doc Import de commandes). Hors de France, il doit etre a 0 %. */
  var PORT_0 = 'Si tu factures du port, le « Produit pour transport » de Vitisoft doit être à 0 % de TVA : sinon Vitisoft taxera le port et la facture ne collera plus au devis.';
  var MOT_SQL_TVA = 'La TVA autre que 20 % n’est pas encore disponible sur ton compte. Tes lignes sont gardées.';
  var TRANSPORT_VITI = 'Des frais de port : dans Vitisoft, la configuration d’import doit avoir un « Produit pour transport », sinon la commande est refusée.';
  /* LOT 55 : la signature en ligne. Le lien part de la messagerie du vigneron, pas du
     bureau (decision de Ted du 01/10/2026). Le jeton ne s'affiche qu'une fois. */
  var MOT_SQL_SIG = 'La signature en ligne n’est pas encore disponible sur ton compte.';
  var MOT_LIEN_GARDE = 'Ce lien reste ici, et sur la carte du devis dans l’affaire, tant que le devis n’est pas signé. Il sert à une seule signature.';
  var MOT_LIEN_UNE_FOIS = 'Ce lien ne s’affiche qu’une fois : colle-le dans ton mail maintenant. Il sert à une seule signature. Perdu ? Crée un nouveau lien, l’ancien s’éteint.';
  var MOT_PROS = 'Réservé aux clients professionnels pour l’instant.';
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
  /* « 2 oct. », « 1er mai » : la date des phrases d'envoi (juge V1, 02/10/2026). */
  var MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function dateCourte(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    var j = +m[3];
    return (j === 1 ? '1er' : String(j)) + '\u00a0' + MOIS_COURTS[+m[2] - 1];
  }
  /* Une phrase qui finit sur « oct. » ne prend pas un second point (N8). */
  function finPhrase(t) { return /[.!?]$/.test(t) ? t : t + '.'; }
  function bureau() { return S && S.ctx && S.ctx.bureau; }
  function cleDe(p) {
    return [p.num_produit || '', p.designation || '', p.conditionnement || '', p.millesime || ''].join('|');
  }
  /* « Brut Tradition 2021, 75 cl » : produit + millesime + conditionnement. */
  function nomDe(l) {
    return String(l.designation || '') + (l.millesime ? ' ' + l.millesime : '') + (l.conditionnement ? ', ' + l.conditionnement : '');
  }
  /* T2 (02/10/2026) : le nom d'une ligne en DEUX morceaux. Le millesime et le format sont ce
     qui distingue deux lignes (« Le Rosé 2025, Bouteille » / « Le Rosé 2024, Magnum ») : ils
     ne disparaissent jamais. Si la place manque, c'est la designation qui se reduit
     (bdv-devis.css), le nom complet reste en `title` et dans le libelle de la case. */
  function fmtDe(l) {
    return (l.millesime ? String(l.millesime) : '') + (l.conditionnement ? (l.millesime ? ', ' : '') + l.conditionnement : '');
  }
  function nomHtml(l, balise) {
    var f = fmtDe(l), b = balise || 'span';
    return '<' + b + ' class="dmod__nom" title="' + esc(nomDe(l)) + '"><span class="dmod__vin">' + esc(String(l.designation || '')) + '</span>'
      + (f ? (l.millesime ? ' ' : '<span class="dmod__sep">, </span>') + '<span class="dmod__fmt">' + esc(f) + '</span>' : '') + '</' + b + '>';
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
  /* LOT 65 : RAPPELER. La colonne `version` arrive avec le SQL : sans elle, rien ne change.
     Un devis envoye se rappelle (lien coupe, modifiable sous le meme numero, version + 1)
     sauf s'il a ete signe, meme si l'acceptation a ete annulee depuis, ou si sa commande a
     deja ete telechargee pour Vitisoft. La base refuse les memes cas. */
  function lot65() { return !!(S && S.devis && Object.prototype.hasOwnProperty.call(S.devis, 'version')); }
  function versionDe(d) { return d && Number(d.version) > 1 ? Number(d.version) : 0; }
  function rappelPossible() {
    var d = S.devis;
    return !!(d && lot65() && d.statut === 'envoye' && affaireOuverte()
      && !(Number(d.commande_telechargements) > 0) && !(d.accord_annule_le && S.dejaSigne !== false));
  }
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
  function titreRelance(numero) { return 'Relancer le devis ' + numero + ' (vérifie qu’il est bien parti)'; }
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
  /* Deux taux dans les lignes : le taux se dit sur chaque ligne. */
  function mixte(lignes) {
    var vus = {}; (lignes || []).forEach(function (l) { vus[l.tva_cb == null ? 2000 : l.tva_cb] = 1; });
    return Object.keys(vus).length > 1;
  }
  function phraseLiv(d) {
    var m = d && d.livraison_mode, a = (d && d.livraison) || {};
    var j = d && d.livraison_souhaitee ? dateFr(String(d.livraison_souhaitee).slice(0, 10)) : '';
    if (m === 'retrait') return 'Il vient chercher au domaine' + (j ? ', le ' + j : '') + '.';
    var ou = m === 'adresse' ? 'À livrer à ' + [a.nom, a.adresse1, a.adresse2, [a.code_postal, a.ville].filter(Boolean).join(' '),
      a.pays && !/^france$/i.test(a.pays) ? a.pays : ''].filter(Boolean).join(', ') : 'À livrer à l’adresse du client';
    return ou + (j ? ', souhaitée le ' + j : '') + (d && d.transporteur ? ', par ' + d.transporteur : '') + '.';
  }

  /* ---------------- LA TVA (lot 54) ----------------
     Un devis d'avant le lot (ou sans le SQL) n'a pas ces colonnes : il est « en France »,
     lignes a 20 %, et c'est ce qu'il etait. */
  /* `accises` : true, false, ou null tant que le vigneron n'a pas repondu (juge V9). */
  function tvaVide() { return { regime: 'france', client: '', accises: null }; }
  function lot54() { return !!(S && S.devis && Object.prototype.hasOwnProperty.call(S.devis, 'regime_tva')); }
  function tvaDeDevis(d) {
    var v = tvaVide();
    if (!d) return v;
    v.regime = ['france', 'export', 'ue'].indexOf(d.regime_tva) >= 0 ? d.regime_tva : 'france';
    v.client = d.client_tva || '';
    /* Un devis deja enregistre hors de France porte sa reponse ; en France la question ne se pose pas. */
    v.accises = v.regime !== 'france' ? !!d.accises_incluses : null;
    return v;
  }
  function horsFrance() { return S.tva && S.tva.regime !== 'france'; }
  /* Le taux d'une ligne a l'ecran : 2000 ou 550 en France, 0 ailleurs. */
  function tauxDe(l) { return horsFrance() ? 0 : (String(l.tva) === '550' ? 550 : 2000); }
  function tvaParDefaut() { return S.tva.regime === 'france' && !S.lignes.some(function (l) { return String(l.tva) === '550'; }); }
  function tvaCorps() {
    var o = { regime: S.tva.regime };
    if (S.tva.regime === 'ue') o.client_tva = String(S.tva.client || '').trim();
    if (S.tva.regime !== 'france') o.accises_incluses = !!S.tva.accises;
    return o;
  }
  function numeroTva(t) { return String(t || '').toUpperCase().replace(/[\s.\-]/g, ''); }
  function libTaux(cb) { return cb === 550 ? '5,5 %' : cb === 0 ? '0 %' : C.pourcent(cb) + ' %'; }
  /* Les lignes de TVA des totaux : une par taux. Un devis a un seul taux de 20 % rend la
     MEME ligne qu'avant le lot (son papier, et sa copie, ne changent pas d'un octet). */
  function lignesTva(t, regime, cls) {
    if (regime === 'export' || regime === 'ue') return '<p' + cls + '><span>TVA</span><span>' + C.euros(0) + '</span></p>';
    var taux = (t.taux || []).filter(function (x) { return x.base > 0 || (t.taux || []).length === 1; });
    if (taux.length <= 1) return '<p' + cls + '><span>TVA ' + libTaux(taux.length ? taux[0].tva_cb : 2000) + '</span><span>' + C.euros(t.tva) + '</span></p>';
    return taux.map(function (x) {
      return '<p' + cls + '><span>TVA ' + libTaux(x.tva_cb) + ' sur ' + C.euros(x.base) + '</span><span>' + C.euros(x.tva) + '</span></p>';
    }).join('');
  }
  /* Les bases d'un devis enregistre, refaites depuis ses lignes (meme regle que la base). */
  function tauxDuDevis(d, lignes) {
    var r = C.devis((lignes || []).map(function (l) { return { pu_c: l.pu_ht_c, qte: l.quantite, remise_cb: l.remise_cb, tva_cb: l.tva_cb == null ? 2000 : l.tva_cb }; }),
      d.remise_globale_cb || 0, 2000, Number(d.port_c) || 0, d.tva_cb == null ? 2000 : d.tva_cb);
    return r.taux;
  }
  function phraseAccises(d) {
    return d && (d.regime_tva === 'export' || d.regime_tva === 'ue') && !d.accises_incluses ? ACCISES_HORS : ACCISES;
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
      qte: String(q > 0 ? q : 6), prix: C.saisie(pu), remise: '0', tva: '2000',
      pu_origine: pu, source_origine: p.source === 'client' ? 'client' : 'bureau',
      derniere_vente: p.derniere_vente || null };
  }
  function ligneDeDevis(l) {
    var p = (S.props || []).concat(S.propsDomaine || []).filter(function (x) { return cleDe(x) === cleDe(l); })[0];
    var pu = Number(l.pu_ht_c) || 0;
    return { cle: cleDe(l), num_produit: l.num_produit || null, designation: l.designation || '',
      conditionnement: l.conditionnement || null, millesime: l.millesime || null,
      qte: String(l.quantite), prix: C.saisie(pu), remise: C.pourcent(l.remise_cb || 0), tva: l.tva_cb === 550 ? '550' : '2000',
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
      if (l._c) ok.push({ pu_c: pu, qte: q, remise_cb: r, tva_cb: tauxDe(l) });
    });
    var port = portDe();
    var t = C.devis(ok, g, 2000, port || 0, horsFrance() ? 0 : 2000);
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
    var vide = !S.lignes.length && !String(S.notes || '').trim() && !(C.remiseCb(S.remise) > 0) && livParDefaut(S.liv) && S.tva.regime === 'france';
    try {
      if (vide) { localStorage.removeItem(CLE_BROUILLON + id); return; }
      localStorage.setItem(CLE_BROUILLON + id, JSON.stringify({ le: jourIso(), lignes: S.lignes.map(function (l) {
        var x = {}; Object.keys(l).forEach(function (k) { if (k.charAt(0) !== '_') x[k] = l[k]; }); return x;
      }), remise: S.remise, notes: S.notes, version_de: S.versionDe || null, liv: S.liv, tva: S.tva }));
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
      /* X1 (tour 3) : apres « Devis enregistré », la SUITE est dite et a portee, juste sous
         l'avis, donc dans le premier ecran a 390 : le bloc d'envoi est tout en bas. */
      + '<p class="dmod__prochaine" id="devProchaine" hidden>Prochaine étape : l’envoyer. <button type="button" class="btn" data-dev="allerEnvoi">Préparer l’envoi</button></p>'
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
    /* LE CLAVIER RESTE DANS LA BOITE (regle du 19/09/2026) : `aria-modal` annonce qu'il n'y
       a rien d'autre a l'ecran, Tab doit le prouver. Du dernier arret on revient au premier,
       et inversement ; un focus parti dehors (clic sur le voile, puis Tab) revient dedans. */
    MOD.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || MOD.hidden) return;
      var box = MOD.querySelector('.tmod__boite'), l = arrets(box);
      if (!l.length) return;
      var a = document.activeElement, i = l.indexOf(a);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); l[l.length - 1].focus(); }
      else if (!e.shiftKey && (i === l.length - 1 || i < 0)) { e.preventDefault(); l[0].focus(); }
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
    var nav = box.querySelector('.dmod__nav'), nh = nav && !nav.closest('[hidden]') ? nav.getBoundingClientRect().height : 0;
    var haut = b.top + nh + 8, bas = b.bottom - ph - 8;
    var d = 0;
    if (r.bottom > bas) d = Math.min(r.bottom - bas, r.top - haut);
    else if (r.top < haut) d = r.top - haut;
    if (d) box.scrollTop = box.scrollTop + d;
  }
  /* `sansDefiler` : l'avis est pose sans ramener la boite a lui (N2 : apres la creation du
     lien, c'est le lien qui doit rester sous le doigt). */
  function dire(txt, souci, sansDefiler) {
    var n = el('devAvis');
    if (!n) return;
    var pr = el('devProchaine'); if (pr) pr.hidden = true;
    n.textContent = txt || '';
    n.hidden = !txt;
    n.classList.toggle('aff-avis--souci', !!souci);
    if (txt && !sansDefiler && typeof n.scrollIntoView === 'function') { try { n.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
  }

  /* LE FOCUS VA AU « RETOUR A L'AFFAIRE », en modale COMME en tiroir : le bouton
     d'ou l'on vient vivait dans le panneau d'affaire, qui vient de se retirer. Le
     laisser la, ce serait le laisser sur un noeud cache. */
  /* LES ARRETS DU CLAVIER DANS LA BOITE, dans l'ordre du document, sans ce qui est cache. */
  function arrets(box) {
    if (!box) return [];
    return [].filter.call(box.querySelectorAll('a[href], button, input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])'), function (n) {
      /* Un champ cache par une feuille (display:none) n'a aucun rectangle. Sans mise en page
         (jsdom), rien n'en a : alors tout compte. */
      var vu = typeof n.getClientRects !== 'function' || n.getClientRects().length > 0 || !document.body.getClientRects().length;
      return !n.disabled && !n.closest('[hidden]') && n.getAttribute('tabindex') !== '-1' && vu;
    });
  }
  function poser() {
    monter();
    var neuf = MOD.hidden;
    MOD.hidden = false;
    /* UNE MODALE, PAS UN TIROIR : le contrat est pose ICI (voir l'en-tete). */
    var box = MOD.querySelector('.tmod__boite');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    document.body.style.overflow = 'hidden';
    if (neuf) { var r = el('devRetour') || MOD.querySelector('.tmod__x'); if (r) { try { r.focus(); } catch (e) {} } }
    poserHistoire();
  }
  function retirer() {
    if (!MOD || MOD.hidden) return false;
    MOD.hidden = true;
    document.body.style.overflow = '';
    oterHistoire();
    return true;
  }
  /* LOT 68 (arbitre par Ted) : LE BOUTON RETOUR DU NAVIGATEUR, et le geste retour de l'iPhone,
     font ce que fait « Retour à l'affaire ». Le devis pose une entree d'historique a la MEME
     adresse en s'ouvrant ; un retour la consomme :
       - dans l'apercu, il ramene au devis ;
       - sur un devis enregistre modifie, le premier retour reste et le dit (comme le bouton),
         le second sort ;
       - sinon il sort vers l'affaire.
     En sortant par un bouton, le devis retire sa propre entree (`history.back`) et ce retour-la
     est avale : bdv-nav ne repeint rien. `surRetour()`, expose en `window.BdvPremierPlan.retour`
     (bdv-nav ne nomme pas le devis), est appele AVANT que bdv-nav suive l'adresse ; il rend vrai
     quand le devis a pris le retour pour lui. */
  var HIST = { pose: false, depiler: 0 };
  function poserHistoire() {
    if (HIST.pose || !window.history || typeof history.pushState !== 'function') return;
    try { history.pushState({ bdvDevis: 1 }, '', location.href); HIST.pose = true; } catch (e) {}
  }
  function oterHistoire() {
    if (!HIST.pose) return;
    HIST.pose = false;
    try { HIST.depiler++; history.back(); } catch (e) { HIST.depiler = Math.max(0, HIST.depiler - 1); }
  }
  function surRetour() {
    if (HIST.depiler > 0) { HIST.depiler--; return true; }
    if (!MOD || MOD.hidden || !HIST.pose) return false;
    HIST.pose = false;   // l'entree vient d'etre consommee par le navigateur
    if (S && S.etat === 'apercu') {
      sortirApercu(); S.voirVersion = null; S.etat = 'edition'; peindre();
      var a = MOD.querySelector('[data-dev="apercu"]'); if (a) { try { a.focus(); } catch (e) {} }
      poserHistoire();
      return true;
    }
    if (garderAvantDePartir(true)) { poserHistoire(); return true; }
    if (S && S.ctx && typeof S.ctx.retour === 'function') retour(); else fermer();
    return true;
  }
  window.BdvPremierPlan = { retour: surRetour };
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('popstate', function (ev) {
      if (!ev || ev.__bdvVu) return;
      ev.__bdvVu = true;
      if (surRetour()) ev.__bdvPris = true;
    });
  }
  /* LE FOCUS EN SORTANT VA SUR UN ELEMENT VIVANT, jamais sur le corps de page :
     l'appelant sait lequel (`focusSortie`, le bouton qui avait ouvert l'affaire, ou
     le titre de la piece) ; a defaut, l'element d'ou l'on venait s'il existe encore. */
  function vivant(n) { return !!(n && n.isConnected && !n.closest('[hidden]') && typeof n.focus === 'function'); }
  function fermer() {
    if (MOD && !MOD.hidden && garderAvantDePartir()) return;
    if (!retirer()) return;
    var r = RETOUR_FOCUS; RETOUR_FOCUS = null;
    var f = S && S.ctx && typeof S.ctx.focusSortie === 'function' ? S.ctx.focusSortie() : null;
    var cible = vivant(f) ? f : (vivant(r) ? r : null);
    if (cible) { try { cible.focus(); } catch (e) {} }
  }
  /* « Retour a l'affaire » passe le devis ouvert : l'affaire ramene SA ligne dans la vue
     et y pose le focus (ou sur « Nouveau devis » s'il n'y en a pas). */
  /* LOT 66 : DES CHANGEMENTS PAS ENREGISTRES SUR UN DEVIS DEJA ENREGISTRE ne partent pas en
     silence. Un devis neuf garde son brouillon sur l'appareil ; un devis enregistre, non : le
     premier appui le dit, le second sort. */
  function garderAvantDePartir(parRetour) {
    if (!S || !S.devis || !S.modifie || S.etat !== 'edition' || S.quitterOk) return false;
    S.quitterOk = true;
    /* Vigneron (lot 68) : le geste de l'iPhone est un glissement, pas un appui. */
    dire('Tes changements ne sont pas enregistrés. Appuie sur « Enregistrer le devis », ou '
      + (parRetour ? 'reviens encore une fois en arrière' : 'appuie encore une fois') + ' pour partir sans eux.', true);
    return true;
  }
  /* `opts.mail` : « Envoyer le devis par email » (demande de Ted, 08/10/2026) : retour a
     l'affaire, le redacteur ouvert sur l'envoi du devis, le lien de signature dedans. */
  function retour(opts) {
    if (garderAvantDePartir()) return;
    var f = S && S.ctx && S.ctx.retour;
    var id = S && S.devis ? S.devis.devis_id : null;
    retirer();
    RETOUR_FOCUS = null;
    if (typeof f === 'function') f(id, opts || null);
  }
  /* La boite branchee (Mes envois) et une affaire ou revenir : le devis part par le redacteur. */
  function parBoite() {
    return !!(window.BdvBoite && BdvBoite.prete && BdvBoite.prete('devis') && S && S.ctx && typeof S.ctx.retour === 'function');
  }

  /* ---------------- L'OUVERTURE ---------------- */
  /* ctx : { bureau, affaire:{affaire_id, issue}, sujet, nouveau, devis (ou null),
             retour(), change() } */
  async function ouvrir(ctx) {
    RETOUR_FOCUS = document.activeElement;
    S = { ctx: ctx, etat: 'chargement', props: [], source: ctx.nouveau ? 'bureau' : 'client', propsDomaine: null,
          lignes: [], remise: '0', notes: '', devis: ctx.devis || null, lignesServeur: null, voirTout: false,
          q: '', brouillon: null, confirme: false, attente: false, manque: [], accord: false, modifie: false,
          envoi: false, versionDe: null, refus: false, annul: false, liv: livVide(), tva: tvaVide(),
          lien: null, lienInfo: null, preuve: null, rappel: false, dejaSigne: undefined, etape: 1, plis: null };
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
        S.tva = tvaDeDevis(S.devis);
        S.etat = 'edition';
        S.etape = 3; S.plis = null;
        var lu = lireSignature(moi);
        peindre();
        if (S.ctx && S.ctx.agir) lu.then(function () { if (moi === S) agirDepuisAffaire(); }, function () { if (moi === S) agirDepuisAffaire(); });
        return;
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
  /* LOT 67 : LE GESTE DE LA CARTE, FAIT DANS LE DEVIS. L'affaire passe `ctx.agir` ; le devis
     s'ouvre a l'etape 3 et fait le PREMIER pas du geste, jamais le dernier : il ouvre l'envoi
     (focus sur « Pas encore »), la confirmation de la correction (focus sur « Non, le garder »),
     amene « Le client a répondu ? », telecharge la commande (le bouton disait « Télécharger »),
     reprend les lignes dans un nouveau devis (rien n'est ecrit avant « Enregistrer »), ou
     montre la copie d'une version precedente. Si le geste n'est plus possible, le devis
     s'ouvre simplement : son ecran dit pourquoi. Une seule fois par ouverture. */
  function agirDepuisAffaire() {
    var g = S.ctx && S.ctx.agir;
    if (S.ctx) S.ctx.agir = null;
    if (!g || !S.devis || S.etat !== 'edition' || !MOD) return;
    if (g.action === 'version' && g.version >= 1) { S.voirVersion = g.version; entrerApercu(); return; }
    if (S.etape !== 3) montrerEtape(3, true);
    var b = null;
    if (g.action === 'envoi') {
      var bm = el('devEcrireMail');
      if (bm) { try { bm.focus({ preventScroll: true }); } catch (e) {} montrerDansBoite(bm); return; }
      b = MOD.querySelector('[data-dev="envoyer"]');
    }
    else if (g.action === 'corriger') b = MOD.querySelector('[data-dev="rappeler"]');
    else if (g.action === 'commande') b = MOD.querySelector('.dmod__commande [data-dev="telecharger"]:not([aria-disabled="true"])');
    else if (g.action === 'refaire') { if (MOD.querySelector('[data-dev="refaire"]')) { refaire(); return; } }
    else if (g.action === 'reponse') {
      var r = MOD.querySelector('.dmod__commande [data-dev="accepter"]') || MOD.querySelector('.dmod__commande [data-dev="refuser"]');
      if (r) { try { r.focus({ preventScroll: true }); } catch (e) { try { r.focus(); } catch (x) {} } montrerDansBoite(r.closest('.dmod__commande') || r); }
      return;
    }
    if (!b && g.action === 'corriger') {
      var rf = MOD.querySelector('[data-dev="refaire"]');
      if (rf) { try { rf.focus({ preventScroll: true }); } catch (e) {} montrerDansBoite(rf.closest('.dmod__suite') || rf); }
      return;
    }
    if (b) b.click();
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
    var nv = d && versionDe(d) ? ', version ' + versionDe(d) : '';
    var titre = d
      ? (d.statut === 'abandonne' ? 'Devis <s>' + esc(d.numero) + nv + '</s> <span class="aff-marque dmod__abandonne">abandonné</span>,' + pour
        : d.statut === 'accepte' ? 'Devis ' + esc(d.numero) + nv + ' <span class="aff-marque">' + (d.signe_le ? 'signé' : 'accepté') + '</span>,' + pour
        : d.statut === 'refuse' ? 'Devis ' + esc(d.numero) + nv + ' <span class="aff-marque dmod__abandonne">refusé</span>,' + pour
        : d.statut === 'envoye' ? 'Devis ' + esc(d.numero) + nv + ' <span class="aff-marque">' + (expire(d) ? 'expiré' : 'envoyé') + '</span>,' + pour
        : 'Devis ' + esc(d.numero) + nv + pour)
      : (S.versionDe ? 'Nouveau devis' : 'Devis') + pour;
    var sous = d ? '' : (S.versionDe ? 'Pas encore enregistré. Il remplacera le devis ' + esc(S.versionDe.numero) + ', qui passera abandonné.' : 'Pas encore enregistré.');
    if (d) {
      sous += 'Du ' + esc(dateFr(d.date_devis)) + ', valable jusqu’au ' + esc(dateFr(d.valable_jusqu)) + '.';
      if (d.cree_le && d.maj_le && d.maj_le !== d.cree_le && d.statut === 'enregistre') sous += ' Modifié le ' + esc(dateFr(d.maj_le)) + '.';
      if (d.statut === 'abandonne' && d.abandonne_le) sous += ' Abandonné le ' + esc(dateFr(d.abandonne_le)) + '.';
      if (d.envoye_le && d.statut !== 'abandonne') sous += ' Envoyé le ' + esc(dateFr(d.envoye_le)) + '.';
      if (d.rappele_le && versionDe(d)) sous += ' Corrigé le ' + esc(dateFr(d.rappele_le)) + ' : c’est la version ' + versionDe(d) + ', la version ' + (versionDe(d) - 1) + ' est gardée.';
      if (expire(d)) sous += ' Il a expiré : ses prix ne tiennent plus, relance ou refais-le.';
      if (d.statut === 'accepte' && d.accepte_le) sous += ' Accepté le ' + esc(dateFr(d.accepte_le)) + '.';
      if (d.statut === 'refuse' && d.refuse_le) sous += ' Refusé le ' + esc(dateFr(d.refuse_le)) + (motifRefus(d.refuse_motif) ? ' : ' + esc(motifRefus(d.refuse_motif).toLowerCase()) : '') + '.';
      if (d.statut !== 'accepte' && d.accord_annule_le) sous += ' Acceptation annulée le ' + esc(dateFr(d.accord_annule_le)) + '.';
      if (d.statut !== 'accepte' && Number(d.commande_telechargements) > 0 && d.commande_telechargee_le)
        sous += ' Sa commande avait été téléchargée le ' + esc(dateFr(d.commande_telechargee_le)) + '.';
    }
    /* « Retour a l'affaire » n'est PAS repeint : il garde le focus pendant que le corps
       arrive. Il se cache seulement quand personne n'a donne de chemin de retour. */
    /* Dans l'apercu, un seul chemin de retour (juge V18) : « Revenir au devis ». */
    el('devRetourL').hidden = typeof S.ctx.retour !== 'function' || S.etat === 'apercu';
    /* LOT 67 (vigneron) : la vue d'une version precedente porte SON titre, pas celui du devis en cours. */
    if (S.etat === 'apercu' && S.voirVersion && d) {
      titre = 'Devis ' + esc(d.numero) + ', version ' + S.voirVersion + ' <span class="aff-marque dmod__abandonne">remplacée</span>,' + pour;
      sous = 'Elle a été remplacée par la version ' + (versionDe(d) || S.voirVersion + 1) + ' : elle ne vaut plus. Ne la renvoie pas.';
    }
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
  /* ---------------- LOT 66 : LE DEVIS EN TROIS ETAPES (05/10/2026) ----------------
     Decision de Ted : la fabrication en PLEINE PAGE, en trois etapes, Les vins, Conditions,
     Verifier. LES TROIS ETAPES SONT TOUJOURS DANS LE DOCUMENT, et seule la visible n'est pas
     `hidden` : passer d'une etape a l'autre ne repeint rien, donc ne perd ni un champ ni le
     focus, et une erreur trouvee a l'enregistrement ramene a SON etape (`refuser`). Rien
     n'est ecrit en base avant « Enregistrer le devis », qui reste au pied a chaque etape :
     un client habituel se fait sans passer les etapes. Le pied garde le total en vue.
     LIVRAISON, TVA ET REMISE SE REPLIENT en une ligne qui dit ce qui est choisi, avec
     « Changer » ; elles s'ouvrent seules quand elles portent autre chose que le defaut. */
  var ETAPES = [[1, 'Les vins'], [2, 'Conditions'], [3, 'Vérifier']];
  var SUIVANT = { 1: 'Suivant : les conditions', 2: 'Suivant : vérifier' };
  function initPlis() {
    S.plis = { remise: (C.remiseCb(S.remise) || 0) !== 0, liv: !livParDefaut(S.liv), tva: S.tva.regime !== 'france' };
  }
  function pliOuvert(cle) { return !!(S.plis && S.plis[cle]); }
  var NOM_PLI = { liv: 'la livraison', tva: 'la TVA', remise: 'la remise' };
  function htmlPli(cle) {
    var o = pliOuvert(cle), r = cle === 'liv' ? resumeLiv() : cle === 'tva' ? resumeTva() : resumeRemise();
    return '<div class="dmod__pli"><p class="dmod__resume" id="devRes_' + cle + '">' + esc(r) + '</p>'
      + '<button type="button" class="btn dmod__changer" data-dev="pli" data-pli="' + cle + '" aria-expanded="' + (o ? 'true' : 'false')
      + '" aria-controls="devPli_' + cle + '"><span class="dmod__changer-m">' + (o ? 'Masquer' : 'Changer') + '</span><span class="hors-ecran"> ' + NOM_PLI[cle] + '</span></button></div>';
  }
  function resumeLiv() {
    var l = S.liv, p = portDe(), j = String(l.date || '').trim();
    var t = l.mode === 'retrait' ? 'Il vient chercher au domaine'
      : l.mode === 'adresse' ? 'À une autre adresse' + ([l.nom, l.ville].filter(function (x) { return String(x || '').trim(); }).length ? ' : ' + [l.nom, l.ville].filter(function (x) { return String(x || '').trim(); }).join(', ') : '')
      : 'À l’adresse du client';
    if (j && /^\d{4}-\d{2}-\d{2}$/.test(j)) t += ', souhaitée le ' + dateFr(j);
    if (l.mode !== 'retrait') t += p === null ? ', frais de port à corriger' : p > 0 ? ', frais de port ' + C.euros(p) + ' HT' : ', sans frais de port';
    return t + '.';
  }
  function resumeTva() {
    var t = S.tva;
    if (t.regime === 'export') return 'Export hors de l’UE, sans TVA.';
    if (t.regime === 'ue') return 'Un pro dans l’UE, sans TVA' + (String(t.client || '').trim() ? ', n° ' + numeroTva(t.client) : '') + '.';
    return 'En France, TVA ' + (S.lignes.some(function (l) { return String(l.tva) === '550'; }) ? '20 % et 5,5 %' : '20 %') + '.';
  }
  function resumeRemise() {
    var g = gDe();
    return g === null ? 'Remise à corriger.' : g > 0 ? 'Remise de ' + C.pourcent(g) + ' % sur tout le devis.' : 'Aucune remise sur tout le devis.';
  }
  function majResumes() {
    ['liv', 'tva', 'remise'].forEach(function (k) {
      var n = el('devRes_' + k); if (n) n.textContent = k === 'liv' ? resumeLiv() : k === 'tva' ? resumeTva() : resumeRemise();
    });
    var rc = el('devRecap'); if (rc && S.etape === 3) rc.innerHTML = htmlRecap();
  }
  function basculerPli(cle, ouvrir, focus) {
    if (!S.plis) initPlis();
    S.plis[cle] = ouvrir === undefined ? !S.plis[cle] : !!ouvrir;
    var c = el('devPli_' + cle); if (c) c.hidden = !S.plis[cle];
    var b = MOD.querySelector('[data-dev="pli"][data-pli="' + cle + '"]');
    if (b) { b.setAttribute('aria-expanded', S.plis[cle] ? 'true' : 'false'); var m = b.querySelector('.dmod__changer-m'); if (m) m.textContent = S.plis[cle] ? 'Masquer' : 'Changer'; }
    if (focus && S.plis[cle] && c) { var f = c.querySelector('input:checked, input, select, textarea'); if (f) { try { f.focus(); } catch (e) {} } }
  }
  function htmlEtapesNav() {
    return '<nav class="dmod__nav" id="devEtapes" aria-label="Étapes du devis"><ol class="dmod__nav-l">'
      + ETAPES.map(function (e) {
        return '<li><button type="button" class="dmod__nav-b" data-dev="etape" data-vers="' + e[0] + '"' + (S.etape === e[0] ? ' aria-current="step"' : '')
          + '><span class="dmod__nav-n" aria-hidden="true">' + e[0] + '</span><span class="dmod__nav-t">' + e[1] + '</span></button></li>';
      }).join('') + '</ol></nav>';
  }
  function etapeCachee(n) { return S.etape === n ? '' : ' hidden'; }
  function titreEtape(n, t) { return '<h3 class="hors-ecran dmod__etape-t" tabindex="-1">Étape ' + n + ' sur 3 : ' + t + '</h3>'; }
  /* CE QUE TU PROPOSES : ce que le client verra, relu avant d'enregistrer. Le papier exact
     se voit apres, par « Voir et imprimer » : il porte le numero que la base donne. */
  function htmlRecap() {
    calcul();
    var vins = S.lignes.length ? '<ul class="dmod__recap-l">' + S.lignes.map(function (l) {
      var q = qteDe(l), pu = puDe(l), r = rlDe(l);
      return '<li><span class="dmod__recap-n">' + esc(nomDe(l)) + '</span><span class="dmod__recap-m">'
        + (l._c ? esc(q + '\u00a0x ' + C.euros(pu) + '\u00a0HT' + (r ? ', remise ' + C.pourcent(r) + '\u00a0%' : '') + ' : ' + C.euros(l._c.net)) : MOT_CORRIGER) + '</span></li>';
    }).join('') + '</ul>' : '<p class="aff-aide">Aucun vin pour l’instant.</p>';
    var cond = [['Livraison', resumeLiv()], ['TVA', resumeTva()], ['Remise', resumeRemise()]];
    return vins + '<p class="dmod__recap-g"><button type="button" class="dmod__lien" data-dev="etape" data-vers="1">Changer les vins</button></p>'
      + '<dl class="dmod__recap-c">' + cond.map(function (c) { return '<div><dt>' + c[0] + '</dt><dd>' + esc(c[1]) + '</dd></div>'; }).join('')
      + (String(S.notes || '').trim() ? '<div><dt>Notes</dt><dd>' + esc(String(S.notes).trim()) + '</dd></div>' : '') + '</dl>'
      + '<p class="dmod__recap-g"><button type="button" class="dmod__lien" data-dev="etape" data-vers="2">Changer les conditions</button></p>';
  }
  /* Montrer une etape : rien n'est repeint. `sansFocus` : une erreur ramene a son etape et
     pose elle-meme le focus sur le champ fautif. */
  function montrerEtape(n, sansFocus) {
    if (!MOD || !(n >= 1 && n <= 3)) return;
    /* Quitter l'etape 3 referme la question ouverte (envoi, accord, refus, abandon, rappel,
       annulation) : le pied ne doit pas renvoyer a une question qu'on ne voit plus. */
    if (n !== 3) {
      S.envoi = false; S.accord = false; S.confirme = false; S.refus = false; S.rappel = false;
      ['devEnvoi', 'devAccord', 'devConfirme', 'devRefus', 'devRappel'].forEach(function (id) { var x = el(id); if (x) x.hidden = true; });
      if (S.annul) poserAnnul(false);
      var ax = el('devAnnul'); if (ax) ax.hidden = true;
    }
    S.etape = n;
    [].forEach.call(MOD.querySelectorAll('.dmod__etape[data-etape]'), function (x) { x.hidden = Number(x.getAttribute('data-etape')) !== n; });
    [].forEach.call(MOD.querySelectorAll('.dmod__nav-b'), function (b) {
      if (Number(b.getAttribute('data-vers')) === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    var rc = el('devRecap'); if (rc && n === 3) rc.innerHTML = htmlRecap();
    majPrincipal();
    if (sansFocus) return;
    var box = MOD.querySelector('.tmod__boite'); if (box) box.scrollTop = 0;
    var t = MOD.querySelector('.dmod__etape[data-etape="' + n + '"] .dmod__etape-t'); if (t) { try { t.focus({ preventScroll: true }); } catch (e) { try { t.focus(); } catch (x) {} } }
  }
  function htmlEdition() {
    var enreg = S.devis && S.devis.statut === 'enregistre';
    if (!S.plis) initPlis();
    return htmlEtapesNav()
      + '<div class="dmod__etape" data-etape="1"' + etapeCachee(1) + '>' + titreEtape(1, 'les vins')
      /* « CHERCHER UN VIN » EN TETE (juge V15) : pour ajouter un vin on ne descend plus sous
         tous ceux deja coches. Ce qu'on peut ajouter d'abord, ce qui est dans le devis ensuite.
         LOT 66 : rien n'est coche d'avance, on PROPOSE (decision de Ted). */
      + '<section class="dmod__bloc" aria-labelledby="devVinsT"><h3 class="dmod__t" id="devVinsT">Tes vins</h3>'
      + '<label class="aff-champ dmod__cherche"><span>Chercher un vin</span>'
      + '<input id="devCherche" type="search" autocomplete="off" maxlength="80" value="' + esc(S.q) + '"></label>'
      + '<div id="devProps">' + htmlProps() + '</div>'
      + '<h4 class="dmod__st" id="devDansT">Dans le devis</h4>'
      + '<ul class="dmod__lignes" id="devLignes" aria-labelledby="devDansT">' + htmlLignes() + '</ul></section></div>'
      + '<div class="dmod__etape" data-etape="2"' + etapeCachee(2) + '>' + titreEtape(2, 'les conditions')
      + '<section class="dmod__bloc" aria-labelledby="devRemiseT" id="devRemiseB"><h3 class="dmod__t" id="devRemiseT">Remise sur tout le devis</h3>' + htmlPli('remise')
      + '<div class="dmod__pli-corps" id="devPli_remise"' + (pliOuvert('remise') ? '' : ' hidden') + '>'
      + '<label class="aff-champ dmod__remise"><span>En %, 0 si aucune</span>'
      + '<input id="devRemise" type="text" inputmode="decimal" autocomplete="off" maxlength="6" value="' + esc(S.remise) + '"></label></div></section>'
      + '<section class="dmod__bloc" aria-labelledby="devLivT" id="devLiv">' + htmlLivraison() + '</section>'
      + '<section class="dmod__bloc" aria-labelledby="devTvaT" id="devTva">' + htmlTva() + '</section>'
      + htmlConditions(true)
      + '<section class="dmod__bloc" aria-labelledby="devNotesT"><h3 class="dmod__t" id="devNotesT">Notes</h3>'
      + '<textarea id="devNotes" class="dmod__notes" rows="3" maxlength="2000" aria-labelledby="devNotesT">' + esc(S.notes) + '</textarea></section></div>'
      + '<div class="dmod__etape" data-etape="3"' + etapeCachee(3) + '>' + titreEtape(3, 'vérifier')
      + htmlQui()
      + '<section class="dmod__bloc" aria-labelledby="devRecapT"><h3 class="dmod__t" id="devRecapT">Ce que tu proposes</h3><div id="devRecap">' + htmlRecap() + '</div></section>'
      + '<section class="dmod__bloc" aria-labelledby="devTotalT"><h3 class="dmod__t" id="devTotalT">Total</h3><div id="devTotal"></div></section>'
      /* L'ORDRE DU BAS EST CELUI DE LA VRAIE VIE (juge V12) : le voir, l'envoyer, la reponse du
         client, et l'abandon tout en bas, loin du geste qui valide. */
      + (enreg ? '<section class="dmod__bloc dmod__suite"><p class="dmod__gestes">'
        + '<button type="button" class="btn" data-dev="apercu">Voir et imprimer</button></p></section>'
        + htmlEnvoiAvant() + htmlReponse(true) + htmlAbandon() : '') + '</div>'
      /* LE PIED DIT LE HT D'ABORD (juge V3) : partout ou un seul montant se lit, c'est le HT,
         la monnaie du bureau ; le TTC suit, plus petit. Il porte « Suivant » aux deux premieres
         etapes, et « Enregistrer le devis » a toutes. */
      + '<div class="dmod__pied"><p class="dmod__pied-t">Total HT <b id="devPiedHt"></b> <span class="dmod__pied-ttc">TTC <span id="devPiedTtc"></span></span></p>'
      + '<p class="aff-aide dmod__pied-mot" id="devPiedMot" hidden></p>'
      + '<p class="dmod__pied-g"><button type="button" class="btn" data-dev="suivant" id="devSuivant"' + (S.etape === 3 ? ' hidden' : '') + '>' + (SUIVANT[S.etape] || '') + '</button>'
      + '<button type="button" class="btn btn--bordeaux" data-dev="enregistrer">Enregistrer le devis</button></p></div>';
  }
  /* LE CLAVIER DU CODE POSTAL (S9, juge V18) : des chiffres en France ou sans pays, du texte
     ailleurs (un code postal britannique ou neerlandais porte des lettres). */
  function cpFrance(p) { var x = norm(String(p == null ? '' : p)).trim(); return !x || x === 'france' || x === 'fr'; }
  function cpMode() { return cpFrance(S.liv && S.liv.pays) ? 'numeric' : 'text'; }
  /* LA LIVRAISON A L'ECRAN. Le mode se choisit d'abord ; les champs qui ne servent pas a ce
     mode ne sont pas dessines (un champ cache ne doit rien envoyer). */
  function champLiv(id, cle, lib, o) {
    o = o || {};
    return '<label class="aff-champ' + (o.large ? ' dmod__liv-l' : '') + (o.type === 'date' ? ' dmod__liv-date' : '') + '"><span>' + lib + '</span><input id="' + id + '" data-dev-liv="' + cle + '" type="'
      + (o.type || 'text') + '"' + (o.mode ? ' inputmode="' + o.mode + '"' : '') + ' autocomplete="' + (o.auto || 'off') + '" maxlength="' + (o.max || 80) + '"'
      + (o.min ? ' min="' + esc(o.min) + '"' : '') + (o.aide ? ' aria-describedby="' + id + 'Aide"' : '') + ' value="' + esc(S.liv[cle]) + '">'
      /* L'AIDE SOUS LE CHAMP, PAS DANS LE LIBELLE (S16) : deux libelles de hauteurs differentes
         decalaient les deux champs voisins d'une ligne. */
      + (o.aide ? '<small class="dmod__src" id="' + id + 'Aide">' + esc(o.aide) + '</small>' : '') + '</label>';
  }
  function htmlLivraison() {
    var l = S.liv, auj = jourIso();
    var min = S.devis && S.devis.date_devis && String(S.devis.date_devis) < auj ? String(S.devis.date_devis) : auj;
    return '<h3 class="dmod__t" id="devLivT">Livraison</h3>' + htmlPli('liv')
      + '<div class="dmod__pli-corps" id="devPli_liv"' + (pliOuvert('liv') ? '' : ' hidden') + '>'
      + '<fieldset class="dmod__liv-modes"><legend class="dmod__st">Comment le vin part ?</legend>'
      + MODES_LIV.map(function (m) {
        return '<label class="dmod__coche"><input type="radio" name="devLivMode" data-dev-livmode value="' + m[0] + '"'
          + (l.mode === m[0] ? ' checked' : '') + '><span>' + esc(m[1]) + '</span></label>';
      }).join('') + '</fieldset>'
      + (l.mode === 'adresse' ? '<div class="dmod__liv-champs">'
        + champLiv('devLivNom', 'nom', 'Destinataire', { large: true, auto: 'organization' })
        + champLiv('devLivA1', 'adresse1', 'Adresse', { large: true, max: 120, auto: 'address-line1' })
        + champLiv('devLivA2', 'adresse2', 'Complément (facultatif)', { large: true, max: 120, auto: 'address-line2' })
        + champLiv('devLivCp', 'cp', 'Code postal', { max: 10, auto: 'postal-code', mode: cpMode() })
        + champLiv('devLivVille', 'ville', 'Ville', { max: 60, auto: 'address-level2' })
        + champLiv('devLivPays', 'pays', 'Pays', { max: 60, auto: 'country-name' })
        + champLiv('devLivTel', 'tel', 'Téléphone (facultatif)', { type: 'tel', max: 20, auto: 'tel' })
        + '</div>' : '')
      + '<div class="dmod__liv-champs">'
      + champLiv('devLivDate', 'date', l.mode === 'retrait' ? 'Il passe le (facultatif)' : 'Livraison souhaitée le (facultatif)', { type: 'date', min: min, max: 10 })
      + (l.mode === 'retrait' ? '' : champLiv('devLivTransp', 'transporteur', 'Transporteur (facultatif)', { max: 60 })
        + champLiv('devLivPort', 'port', 'Frais de port HT', { mode: 'decimal', max: 12, aide: '0 si aucun' }))
      + '</div>'
      + (l.mode !== 'retrait' && portDe() > 0 ? '<p class="aff-aide">' + esc(TRANSPORT_VITI) + '</p>' : '') + '</div>';
  }
  /* LA TVA A L'ECRAN : le regime d'abord. Les champs qui ne servent pas ne sont pas dessines. */
  function htmlTva() {
    var t = S.tva, f = S.fiche || {};
    return '<h3 class="dmod__t" id="devTvaT">TVA</h3>' + htmlPli('tva')
      + '<div class="dmod__pli-corps" id="devPli_tva"' + (pliOuvert('tva') ? '' : ' hidden') + '>'
      + '<fieldset class="dmod__liv-modes"><legend class="dmod__st">Où va le vin ?</legend>'
      + REGIMES.map(function (m) {
        return '<label class="dmod__coche"><input type="radio" name="devTvaRegime" data-dev-regime value="' + m[0] + '"'
          + (t.regime === m[0] ? ' checked' : '') + '><span>' + esc(m[1]) + '</span></label>';
      }).join('') + '</fieldset>'
      + (t.regime === 'france' ? '<p class="aff-aide">' + esc(AIDE_55) + '</p>' : '')
      + (t.regime === 'ue' ? '<div class="dmod__liv-champs"><label class="aff-champ dmod__liv-l"><span>Numéro de TVA intracommunautaire du client (obligatoire)</span>'
        + '<input id="devTvaClient" type="text" autocomplete="off" maxlength="20" required aria-required="true" value="' + esc(t.client) + '"></label></div>'
        + '<p class="aff-aide">' + esc(AIDE_VIES) + '</p>'
        + (f.tva ? '' : '<p class="aff-aide">Ton numéro de TVA intracommunautaire manque : il doit figurer sur le devis. <button type="button" class="dmod__lien" data-dev="domaine">Le mettre dans Mon domaine</button></p>') : '')
      /* LES ACCISES SANS REPONSE PAR DEFAUT (juge V9) : c'est une question d'argent, et une case
         decochee d'office faisait imprimer « hors droits d'accises » sur des prix qui les
         comprenaient. Deux boutons, aucun choisi ; l'enregistrement demande la reponse. */
      + (t.regime !== 'france' ? '<p class="aff-aide">' + esc(AIDE_ACCISE) + '</p>'
        + '<fieldset class="dmod__liv-modes" id="devTvaAccises"><legend class="dmod__st">Tes prix comprennent-ils les droits d’accises ? (obligatoire)</legend>'
        + '<label class="dmod__coche"><input type="radio" name="devTvaAccises" data-dev-accises value="oui"' + (t.accises === true ? ' checked' : '') + '><span>Oui, mes prix comprennent l’accise</span></label>'
        + '<label class="dmod__coche"><input type="radio" name="devTvaAccises" data-dev-accises value="non"' + (t.accises === false ? ' checked' : '') + '><span>Non, mes prix sont hors accise</span></label></fieldset>'
        + '<p class="aff-aide">' + esc(PORT_0) + '</p>' : '') + '</div>';
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
        : '<label class="dmod__coche"><input type="checkbox" id="devRefusClore" checked><span>Passer l’affaire à « Pas pour cette\u00a0fois\u00a0»</span></label>')
      + '<p class="dmod__gestes"><button type="button" class="btn btn--bordeaux" data-dev="confirmerRefus">Oui, il a dit non</button>'
      + '<button type="button" class="btn" data-dev="pasRefus">Pas encore</button></p>'
      /* X7 (tour 3) : pendant cette question, les autres gestes du devis attendent, et le disent. */
      + '<p class="aff-aide dmod__attente" id="devRefusAttente">Les autres gestes du devis attendent ta réponse\u00a0: «\u00a0Oui, il a dit non\u00a0» ou «\u00a0Pas encore\u00a0».</p></div>';
  }
  /* « ANNULER L'ACCEPTATION » : pour un « oui » clique par erreur. La base ne sait pas si
     la commande est deja dans Vitisoft : l'ecran le dit, avant. */
  function htmlConfirmeAnnul() {
    var d = S.devis, gagnee = S.ctx.affaire && S.ctx.affaire.issue === 'gagnee';
    /* T5 (tour 3) : l'affaire d'une personne en opposition ne se rouvre pas (la base le refuse
       aussi, lot 56) : pas de case, et la phrase le dit. */
    var opp = !!S.ctx.opposee;
    return '<div class="dmod__confirme" id="devAnnul"' + (S.annul ? '' : ' hidden') + '>'
      + '<p class="aff-aide" id="devAnnulDit">Le devis ' + esc(d.numero) + ' repassera ' + (d.envoye_le ? 'envoyé' : 'enregistré')
      + ' et la commande ne se téléchargera plus. '
      + (Number(d.commande_telechargements) > 0 && d.commande_telechargee_le
        ? 'Son fichier a été téléchargé le ' + esc(dateFr(d.commande_telechargee_le)) + ' : elle est sans doute déjà dans Vitisoft. Supprime-la aussi là-bas, sinon elle sera facturée.</p>'
        : 'Si tu l’as déjà importée dans Vitisoft, supprime-la aussi là-bas : sinon elle sera facturée.</p>')
      + (d.signe_le ? '<p class="aff-aide">Il a été signé en ligne : la preuve reste gardée, et le lien s’éteint. Pour le faire signer de nouveau, tu créeras un nouveau lien.</p>' : '')
      + (gagnee && !opp ? '<label class="dmod__coche"><input type="checkbox" id="devAnnulRouvrir" checked><span>Rouvrir l’affaire</span></label>' : '')
      + (gagnee && opp ? '<p class="aff-aide">L’affaire reste close : cette personne a demandé à ne plus être contactée.</p>' : '')
      + '<p class="dmod__gestes"><button type="button" class="btn btn--bordeaux" data-dev="confirmerAnnul">Oui, annuler l’acceptation</button>'
      + '<button type="button" class="btn" data-dev="garderAccord">Non, la garder</button></p></div>';
  }
  function affaireOuverte() { var i = S.ctx.affaire && S.ctx.affaire.issue; return !i || i === 'en_cours'; }

  /* ---------------- L'ENVOI (lot 50) ----------------
     « Je l'ai envoyé » note la date et, si la case reste cochee, pose le rappel de l'affaire
     (« Relancer le devis D-... ») : c'est lui qui remonte dans Ma journee, le calendrier et le
     courrier du matin. Le rappel deja pose est NOMME, parce que celui-ci le remplace. L'etape
     n'est proposee que si le type d'affaire en a une qui parle de devis, plus loin. */
  /* ---------------- LA SIGNATURE EN LIGNE (lot 55) ----------------
     Le lien ne vaut que pour la COPIE FIGEE (lot 52) d'un devis envoye, et seulement si le
     devis ferait une commande importable : le client ne signe pas ce que le bureau ne
     saurait pas accepter. `lienInfo` : null pas encore lu, false aucun lien vivant,
     {cree_le} un lien vivant (dont le jeton ne se reaffiche pas), 'absent' SQL pas passe. */
  function lienPossible() { return lot52() && !manquesCommande().length; }
  function urlDuLien(jeton) { return location.origin + '/signer/#' + jeton; }
  /* LOT 67 : rend la promesse de ses lectures (le geste venu de l'affaire attend la derniere
     repeinte, sinon elle lui volerait le focus). */
  function lireSignature(moi) {
    var d = S.devis, att = [];
    if (!d || !lot52()) return Promise.resolve();
    if (d.statut === 'envoye') {
      att.push(api('/devis_liens?bureau=eq.' + encodeURIComponent(bureau()) + '&devis_id=eq.' + encodeURIComponent(d.devis_id)
        + '&remplace_le=is.null&select=cree_le,cree_par&order=cree_le.desc&limit=1').then(function (l) {
        if (moi !== S || !S.devis || S.devis.devis_id !== d.devis_id) return;
        S.lienInfo = Array.isArray(l) && l[0] ? l[0] : false;
        if (S.etat === 'edition') peindre();
      }, function (e) { if (moi === S && e && sqlAbsent(e)) { S.lienInfo = 'absent'; if (S.etat === 'edition') peindre(); } }));
    }
    /* LOT 71 (06/10/2026, demande de Ted) : LE LIEN SE RELIT. La base garde maintenant le jeton
       du lien vivant, lisible par le bureau : le lien redevient copiable a la reouverture. Lu A
       PART, pour que la colonne absente (SQL pas passe) ne casse pas la lecture du dessus.
       `S.lot71` dit seulement que la base garde le jeton (la phrase « ne s'affiche qu'une
       fois » devient fausse). */
    if (d.statut === 'envoye') {
      att.push(api('/devis_liens?bureau=eq.' + encodeURIComponent(bureau()) + '&devis_id=eq.' + encodeURIComponent(d.devis_id)
        + '&remplace_le=is.null&select=jeton&order=cree_le.desc&limit=1').then(function (l) {
        if (moi !== S || !S.devis || S.devis.devis_id !== d.devis_id) return;
        S.lot71 = true;
        var j = Array.isArray(l) && l[0] ? String(l[0].jeton || '') : '';
        if (/^[0-9a-f]{64}$/.test(j) && !lienMontre()) S.lien = { devis_id: d.devis_id, url: urlDuLien(j) };
        if (S.etat === 'edition') peindre();
      }, function () {}));
    }
    if (d.statut === 'envoye' && d.accord_annule_le && lot65()) {
      att.push(api('/devis_signatures?bureau=eq.' + encodeURIComponent(bureau()) + '&devis_id=eq.' + encodeURIComponent(d.devis_id)
        + '&select=lien_id&limit=1').then(function (l) {
        if (moi !== S || !S.devis || S.devis.devis_id !== d.devis_id) return;
        S.dejaSigne = Array.isArray(l) ? l.length > 0 : undefined;
        if (S.etat === 'edition') peindre();
      }, function () {}));
    }
    if (d.statut === 'accepte' && d.signe_le) {
      att.push(api('/devis_signatures?bureau=eq.' + encodeURIComponent(bureau()) + '&devis_id=eq.' + encodeURIComponent(d.devis_id)
        + '&order=signe_le.desc&limit=1').then(function (l) {
        if (moi !== S || !S.devis || S.devis.devis_id !== d.devis_id) return;
        S.preuve = Array.isArray(l) && l[0] ? l[0] : null;
        if (S.etat === 'edition') peindre();
      }, function () {}));
    }
    return Promise.all(att);
  }
  function heureFr(horo) {
    var x = new Date(horo);
    if (isNaN(x.getTime())) return '';
    return dateFr(jourIso(x)) + ' à ' + String(x.getHours()).padStart(2, '0') + ' h ' + String(x.getMinutes()).padStart(2, '0');
  }
  /* LE MESSAGE A COLLER : le client est VOUVOYE (regle du depot). Pas de tiret cadratin. */
  function messageType(url) {
    var d = S.devis, v = (d.vendeur && d.vendeur.raison_sociale) || '';
    return 'Bonjour,\n\nVoici notre devis ' + d.numero + (versionDe(d) ? ', version ' + versionDe(d) + ' (PDF joint). Elle remplace la version précédente, qui ne vaut plus.' : ' (PDF joint).') + ' Vous pouvez le signer en ligne, sans créer de compte, à cette adresse :\n'
      + url + '\n\n' + (d.valable_jusqu ? 'Il est valable jusqu’au ' + dateFr(d.valable_jusqu) + '.\n\n' : '')
      + 'Bien cordialement,\n' + v;
  }
  /* LE LIEN CREE, EN TETE DE LA BOITE (N2 et juge V1, tour 2) : copier le message, le coller
     dans le mail avec le PDF, puis la date notee et le rattrapage de la relance. Un seul bouton
     plein (V8). */
  function htmlLienMontre() {
    var url = S.lien.url, d = S.devis, a = S.ctx.affaire || {};
    var qui = S.ctx.sujet ? ' à ' + esc(S.ctx.sujet) : '';
    var auj = d.envoye_le && String(d.envoye_le).slice(0, 10) === jourIso();
    var note = d.envoye_le ? 'Noté envoyé ' + (auj ? 'aujourd’hui, ' : 'le ') + dateCourte(d.envoye_le) : '';
    if (note && a.rappel) note += ', relance le ' + dateCourte(a.rappel) + ' dans Ma journée';
    note = note ? finPhrase(note) : '';
    var rattrape = a.rappel ? ' ' + (auj ? 'Pas parti aujourd’hui ?' : 'Pas parti ce jour-là ?') + ' ' : '';
    var fin = (note || rattrape ? '<p class="aff-aide">' + esc(note) + rattrape
        + (rattrape ? (typeof S.ctx.retour === 'function'
          ? '<button type="button" class="dmod__lien" data-dev="retour">Décale la relance dans l’affaire</button>.'
          : 'Décale la relance dans l’affaire.') : '') + '</p>' : '')
      + '<p class="aff-aide">Quand ton client signe, le devis passe accepté tout seul et la commande Vitisoft est prête.</p>'
      + '</div></section>';
    /* Demande de Ted (08/10/2026) : boite branchee, plus de copie du message ni du lien. UN
       bouton : retour a l'affaire, le mail ouvert, le lien dedans. */
    if (parBoite()) return '<section class="dmod__bloc dmod__lientete" id="devLienBloc" aria-labelledby="devLienT">'
      + '<div class="dmod__confirme dmod__confirme--neutre dmod__lienbloc">'
      + '<h3 class="dmod__t" id="devLienT">Ton envoi est prêt</h3>'
      + '<p class="aff-aide">Le mail s’ouvre dans l’affaire' + qui + ', le lien de signature dedans. Tu le relis, il part de ta boîte.</p>'
      + '<p class="dmod__gestes"><button type="button" class="btn btn--bordeaux" data-dev="ecrireMail">Envoyer le devis par email</button></p>'
      + fin;
    return '<section class="dmod__bloc dmod__lientete" id="devLienBloc" aria-labelledby="devLienT">'
      + '<div class="dmod__confirme dmod__confirme--neutre dmod__lienbloc">'
      + '<h3 class="dmod__t" id="devLienT">Ton envoi est prêt</h3>'
      + '<ol class="dmod__etapes aff-aide"><li>Copie le message : le lien de signature est dedans.</li>'
      + '<li>Colle-le dans ton mail' + qui + ', avec le PDF du devis (« Voir et imprimer », puis enregistrer en PDF), et envoie.</li></ol>'
      + '<p class="dmod__gestes"><button type="button" class="btn btn--bordeaux" data-dev="messageCopier">Copier le message avec le lien</button>'
      + '<button type="button" class="btn" data-dev="lienCopier">Copier le lien seul</button></p>'
      + '<p class="aff-aide" id="devLienMot" aria-live="polite"></p>'
      + '<label class="aff-champ"><span>Le lien de signature</span><input id="devLienUrl" type="text" readonly value="' + esc(url) + '"></label>'
      + (S.lot71 ? '<p class="aff-aide">' + esc(MOT_LIEN_GARDE) + '</p>' : '<p class="aff-aide dmod__copie--souci">' + esc(MOT_LIEN_UNE_FOIS) + '</p>')
      + fin;
  }
  function lienMontre() { return !!(S.lien && S.devis && S.lien.devis_id === S.devis.devis_id && S.devis.statut === 'envoye'); }
  function htmlSignature() {
    var d = S.devis;
    if (!lot52() || S.lienInfo === 'absent') return '';
    var t = '<section class="dmod__bloc" aria-labelledby="devSigT"><h3 class="dmod__t" id="devSigT">Signature en ligne</h3>';
    if (expire(d)) return t + '<p class="aff-aide">Le devis a expiré : il ne se signe plus en ligne. Refais-le pour envoyer un nouveau lien.</p></section>';
    if (!d.papier_empreinte) return t + '<p class="aff-aide">Pas de copie exacte gardée pour ce devis : il ne peut pas se signer en ligne. Refais-le pour en avoir une.</p></section>';
    var m = manquesCommande();
    if (m.length) return t + '<p class="aff-aide">Pas de signature en ligne pour ce devis : ' + esc(phraseManques(m)) + '</p></section>';
    if (lienMontre()) return t + '<p class="aff-aide">' + (parBoite() ? 'Ton lien de signature est en tête du devis : envoie-le par email.' : 'Ton lien de signature est en tête du devis, avec le message à copier.') + '</p></section>';
    if (S.lienInfo && S.lienInfo.cree_le) return t + '<p class="aff-aide">Un lien de signature a été créé le ' + esc(heureFr(S.lienInfo.cree_le))
      + '. Il ne se réaffiche pas. Pour le renvoyer, crée un nouveau lien : l’ancien s’éteint.</p>'
      + '<p class="dmod__gestes"><button type="button" class="btn" data-dev="lienCreer">Créer un nouveau lien</button></p></section>';
    return t + '<p class="aff-aide">Ton client peut signer ce devis en ligne, sans compte. Crée un lien et colle-le dans ton mail. ' + esc(MOT_PROS) + '</p>'
      + '<p class="dmod__gestes"><button type="button" class="btn" data-dev="lienCreer">Créer un lien de signature</button></p></section>';
  }
  /* `motEnvoi` : la phrase de l'envoi qui vient de reussir, gardee devant toute erreur du lien. */
  async function creerLien(motEnvoi) {
    if (S.attente || !S.devis || S.devis.statut !== 'envoye') return false;
    var moi = S, r = null, err = null, d = S.devis;
    S.attente = true;
    try { r = await rpc('devis_lien_creer', { p_bureau: bureau(), p_devis: d.devis_id }); }
    catch (e) { err = e; }
    if (moi !== S) return false;
    S.attente = false;
    var jeton = typeof r === 'string' ? r : (Array.isArray(r) ? r[0] : r);
    if (err || typeof jeton !== 'string' || !/^[0-9a-f]{64}$/.test(jeton)) {
      var det = err ? String(err.detail || err.message || '') : '';
      var debut = (motEnvoi ? motEnvoi + ' Mais le' : 'Le') + ' lien de signature n’a pas pu se créer : ';
      if (err && sqlAbsent(err)) dire((motEnvoi ? motEnvoi + ' ' : '') + MOT_SQL_SIG, true);
      else if (/copie absente/.test(det)) dire(debut + 'pas de copie exacte gardée. Refais le devis pour en avoir une.', true);
      else if (/expire/.test(det)) dire(debut + 'le devis a expiré.', true);
      else if (/numero produit|sans numero ni e-mail/.test(det)) dire(debut + 'il ne ferait pas une commande importable dans Vitisoft.', true);
      else if (/affaire close|deja commandee/.test(det)) dire(debut + 'l’affaire est close ou déjà commandée.', true);
      else dire(debut + (err && !err.status ? 'ta connexion a coupé.' : 'la base l’a refusé.') + ' Réessaie avec « Créer un lien de signature ».', true);
      peindre();
      return false;
    }
    S.lien = { devis_id: d.devis_id, url: urlDuLien(jeton) };
    S.lienInfo = { cree_le: new Date().toISOString() };
    peindre();
    /* N2 (02/10/2026) : LE LIEN EST EN TETE DE LA BOITE, et la boite remonte a lui. Le focus va
       sur « Copier le message avec le lien », le geste qui suit ; le lien seul reste dans son
       champ, juste dessous, a selectionner. */
    var box = MOD.querySelector('.tmod__boite'), bloc = el('devLienBloc');
    if (box) box.scrollTop = 0;
    var cm = bloc && bloc.querySelector('[data-dev="messageCopier"], [data-dev="ecrireMail"]');
    if (cm) { try { cm.focus({ preventScroll: true }); } catch (e) {} }
    if (bloc) montrerDansBoite(bloc.querySelector('.dmod__gestes') || bloc);
    return true;
  }
  /* COPIER : le presse-papier quand le navigateur le permet, sinon le champ selectionne
     (le vigneron fait Cmd + C). Jamais un faux « copie ». */
  function copier(texte, mot) {
    var dit = el('devLienMot');
    function ok() { if (dit) dit.textContent = mot; }
    function rate() {
      var u = el('devLienUrl');
      if (u) { try { u.focus(); u.select(); } catch (e) {} }
      if (dit) dit.textContent = 'Copie impossible ici : le lien est sélectionné, copie-le avec Cmd + C (Ctrl + C sur PC).';
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(texte).then(ok, rate); return; }
    } catch (e) {}
    rate();
  }

  /* L'ENVOI EN DEUX TEMPS NOMMES (juge V1, 01/10/2026). Le bouton s'appelait « Je l'ai
     envoyé » alors qu'il fallait le presser AVANT d'envoyer le mail pour avoir le lien : le nom
     disait l'inverse du geste. Les noms disent maintenant l'ORDRE : « Préparer l'envoi » (le
     devis se fige, le lien et le message arrivent), puis le mail part de la messagerie.
     L'ORDRE DES APPELS NE CHANGE PAS : la base ne cree un lien que sur un devis ENVOYE
     (`devis_lien_creer`, lot 55), donc preparer l'envoi le NOTE envoye, a la date choisie. */
  /* AVANT LE CLIC, LE BUREAU DIT CE QU'IL VA NOTER (juge V1, tour 2, mots du vigneron) : la
     date d'envoi et la relance se posent AVANT que le mail parte, donc une phrase le dit juste
     au-dessus du bouton, avec les dates des champs, et se recalcule a chaque changement. Le
     bouton dit ce qu'il fait : « Figer le devis et créer le lien », ou sans lien « Figer le
     devis et le noter envoyé ». */
  function phraseEnvoi() {
    var auj = jourIso(), cJ = el('devEnvoiJour'), cR = el('devEnvoiRappel'), cRel = el('devEnvoiRelance');
    var jour = cJ && /^\d{4}-\d{2}-\d{2}$/.test(cJ.value) ? cJ.value : auj;
    var rel = cR ? (cR.checked ? (cRel && /^\d{4}-\d{2}-\d{2}$/.test(cRel.value) ? cRel.value : relanceProposee(jour, S.devis)) : '')
      : relanceProposee(jour, S.devis);
    return phraseEnvoiDe(jour, rel);
  }
  /* X9 (tour 3) : « Ce rappel remplace celui du 9 oct. » seulement si le rappel en place tombe
     un AUTRE jour que la relance qu'on pose : le meme jour, la phrase n'apprenait rien. Ecrite
     « 9 oct. » comme le reste de l'envoi, plus jamais 09/10/2026. Recalculee a chaque changement. */
  function phraseRemplace(rel, avecRappel) {
    var a = (S && S.ctx && S.ctx.affaire) || {}, ancien = String(a.rappel || '').slice(0, 10);
    if (!ancien || !avecRappel || !rel || rel === ancien) return '';
    return finPhrase('Ce rappel remplace celui du ' + dateCourte(ancien) + (a.rappel_titre ? ' (' + a.rappel_titre + ')' : ''));
  }
  function libelleEnvoi(avecLien) { return avecLien ? 'Figer le devis et créer le lien' : 'Figer le devis et le noter envoyé'; }
  function majEnvoi() {
    var p = el('devEnvoiPhrase'); if (p) p.textContent = phraseEnvoi();
    var rp = el('devEnvoiRemplace');
    if (rp) {
      var cR2 = el('devEnvoiRappel'), cRel2 = el('devEnvoiRelance');
      var txt = phraseRemplace(cRel2 && /^\d{4}-\d{2}-\d{2}$/.test(cRel2.value) ? cRel2.value : '', !cR2 || cR2.checked);
      rp.textContent = txt; rp.hidden = !txt;
    }
    var b = MOD && MOD.querySelector('[data-dev="confirmerEnvoi"]'), c = el('devEnvoiLien');
    if (b) b.textContent = libelleEnvoi(!!(c ? c.checked : false));
  }
  function htmlEnvoiAvant() {
    var d = S.devis, auj = jourIso(), a = S.ctx.affaire || {}, et = S.ctx.etapeDevis, lien = lienPossible();
    var min = d.date_devis && String(d.date_devis) < auj ? String(d.date_devis) : auj;
    /* DEMANDE DE TED, 08/10/2026 : boite branchee, rien ne se fige ici. Le devis se fige, prend
       son lien et se note envoye QUAND LE MAIL PART de l'affaire. « Le noter envoyé » garde le
       chemin d'un devis remis en main propre ou par courrier. */
    if (lien && parBoite() && !S.envoiAutre) {
      return '<section class="dmod__bloc" aria-labelledby="devEnvT"><h3 class="dmod__t" id="devEnvT">Envoyer le devis au client</h3>'
        + '<ol class="dmod__etapes aff-aide"><li>« Envoyer le devis par email » te ramène à l’affaire, le mail ouvert.</li>'
        + '<li>Quand il part de ta boîte, le devis se fige, son lien de signature se met dans le mail et il est noté envoyé. Pas avant.</li>'
        + '<li>La relance se choisit dans le mail.</li></ol>'
        + '<p class="aff-aide dmod__copie--souci" id="devEnvoiNote"' + (S.modifie ? '' : ' hidden') + '>Enregistre d’abord tes changements : c’est le devis enregistré que tu envoies.</p>'
        + '<p class="dmod__gestes"><button type="button" class="btn" id="devEcrireMail" data-dev="ecrireMail">Envoyer le devis par email</button></p>'
        + '<p class="aff-aide">Remis autrement, en main propre ou par courrier ? <button type="button" class="dmod__lien" data-dev="envoiAutre">Le noter envoyé</button></p></section>';
    }
    return '<section class="dmod__bloc" aria-labelledby="devEnvT"><h3 class="dmod__t" id="devEnvT">Envoyer le devis au client</h3>'
      + '<ol class="dmod__etapes aff-aide">' + ('<li>Prépare l’envoi ici : le devis se fige' + (lien ? ', et le bureau te donne le lien de signature et le message à coller.' : '.') + '</li>'
          + '<li>Envoie ton mail avec le PDF' + (lien ? ' et le lien' : '') + ', depuis ta messagerie.</li>')
      + '<li>Le bureau te rappelle de le relancer.</li></ol>'
      /* V8 : un changement pas enregistre se dit A COTE du bouton, pas seulement apres l'appui. */
      + '<p class="aff-aide dmod__copie--souci" id="devEnvoiNote"' + (S.modifie ? '' : ' hidden') + '>Enregistre d’abord tes changements : c’est le devis enregistré que tu envoies.</p>'
      + '<p class="dmod__gestes"><button type="button" class="btn" data-dev="envoyer">Préparer l’envoi</button></p>'
      + '<div class="dmod__confirme dmod__confirme--neutre" id="devEnvoi"' + (S.envoi ? '' : ' hidden') + '>'
      + '<label class="aff-champ dmod__jour"><span>Envoyé le</span><input id="devEnvoiJour" type="date" value="' + auj
      + '" min="' + esc(min) + '" max="' + auj + '" aria-describedby="devEnvoiJourAide"><small class="dmod__src" id="devEnvoiJourAide">Aujourd’hui par défaut. Tu l’as déjà envoyé un autre jour ? Change la date.</small></label>'
      + (lien ? '<label class="dmod__coche"><input type="checkbox" id="devEnvoiLien" checked><span>Avec un lien de signature en ligne. '
        + esc(MOT_PROS) + '</span></label>' : '')
      + '<label class="dmod__coche"><input type="checkbox" id="devEnvoiRappel" checked><span>Me rappeler de le relancer</span></label>'
      + '<label class="aff-champ dmod__jour"><span>Le</span><input id="devEnvoiRelance" type="date" value="' + relanceProposee(auj, d)
      + '" min="' + auj + '"></label>'
      + (a.rappel ? '<p class="aff-aide" id="devEnvoiRemplace"' + (phraseRemplace(relanceProposee(auj, d), true) ? '' : ' hidden') + '>'
        + esc(phraseRemplace(relanceProposee(auj, d), true)) + '</p>' : '')
      + (et ? '<label class="dmod__coche"><input type="checkbox" id="devEnvoiEtape" checked><span>Passer l’affaire à « '
        + esc(et.nom) + ' »</span></label>' : '')
      + '<p class="aff-aide">Le devis ' + esc(d.numero) + ' ne se modifiera plus : pour le changer, tu le referas sous un nouveau numéro.</p>'
      + '<p class="dmod__envoi-phrase" id="devEnvoiPhrase" aria-live="polite">' + esc(phraseEnvoiDe(auj, relanceProposee(auj, d))) + '</p>'
      + '<p class="dmod__gestes"><button type="button" class="btn btn--bordeaux" data-dev="confirmerEnvoi">' + esc(libelleEnvoi(lien)) + '</button>'
      + '<button type="button" class="btn" data-dev="pasEnvoye">Pas encore</button></p></div></section>';
  }
  /* La meme phrase, sans les champs (premier dessin, avant qu'ils existent). */
  function phraseEnvoiDe(jour, rel) {
    var auj = jourIso();
    var t = 'Le bureau le note envoyé ' + (jour === auj ? 'aujourd’hui, ' + dateCourte(jour) : 'le ' + dateCourte(jour));
    if (rel) t += ', et te rappelle de le relancer le ' + dateCourte(rel);
    t = finPhrase(t);
    if (jour === auj) t += ' Envoie ton mail juste après.';
    return t;
  }
  /* UN DEVIS ENVOYE SE RELIT, S'IMPRIME, SE REFAIT, S'ABANDONNE ET S'ACCEPTE. Il ne se modifie
     plus : le client a ce papier entre les mains. */
  /* D2 (01/10/2026) : la signature en ligne n'est proposee QUE sur une affaire ouverte. Sur une
     affaire gagnee a la main, la base refuse le lien (« affaire close ») : l'ecran ne propose
     pas un bouton qui finit en refus. L'ordre du bas est celui de htmlEdition (V12). */
  function htmlSuiteEnvoye() {
    var ouverte = affaireOuverte(), perdue = S.ctx.affaire && S.ctx.affaire.issue === 'perdue', d = S.devis, rp = rappelPossible();
    return (ouverte ? htmlSignature() : '') + '<section class="dmod__bloc dmod__suite"><p class="dmod__gestes">'
      + '<button type="button" class="btn" data-dev="apercu">Voir et imprimer</button>'
      + (rp ? '<button type="button" class="btn" data-dev="rappeler" aria-describedby="devRappelAide">Corriger ce devis (version ' + ((versionDe(d) || 1) + 1) + ')</button>'
        : ouverte ? '<button type="button" class="btn" data-dev="refaire">Refaire ce devis</button>' : '') + '</p>'
      + (rp ? '<p class="aff-aide" id="devRappelAide">Pour changer un prix ou une quantité : son lien de signature ne marchera plus, et tu le modifieras sous le même numéro, en version ' + ((versionDe(d) || 1) + 1) + '.</p>' + htmlConfirmeRappel()
        : ouverte ? '<p class="aff-aide">' + (Number(d.commande_telechargements) > 0 && lot65() ? 'Sa commande a déjà été téléchargée pour Vitisoft : il n’est plus modifiable. Pour le changer, appuie sur « Refaire ce devis » : '
          : d.accord_annule_le && S.dejaSigne === true ? 'Il a été signé en ligne : il n’est plus modifiable. Pour le changer, appuie sur « Refaire ce devis » : ' : 'Pour changer un prix ou une quantité, refais-le : ')
          + 'il reprend tes lignes sous un nouveau numéro, et celui-ci passe abandonné.</p>' : '')
      + '</section>'
      + htmlReponse(!perdue) + htmlAbandon();
  }
  /* « LE CLIENT A REPONDU ? » : oui (la commande Vitisoft) ou non (le refus), cote a cote, avec
     leurs deux confirmations. `avecOui` faux : l'affaire est perdue, un oui ne s'accepterait plus. */
  /* LOT 65 : la confirmation du rappel. Le focus va sur « Non, le garder ». */
  function htmlConfirmeRappel() {
    var d = S.devis, v = versionDe(d) || 1;
    return '<div class="dmod__confirme" id="devRappel"' + (S.rappel ? '' : ' hidden') + '>'
      + '<p class="aff-aide">Tu corriges le devis ' + esc(d.numero) + ' ? Son lien de signature ne marchera plus, et tu ne pourras pas revenir en arrière : il faudra renvoyer une version ' + (v + 1) + ', même identique. Il redevient modifiable, en version '
      + (v + 1) + ' datée d’aujourd’hui. La version ' + v + ' reste gardée.</p>'
      + '<p class="aff-aide">Ton client a reçu la version ' + v + ' : préviens-le qu’elle ne vaut plus, puis renvoie-lui la nouvelle (un message tout prêt te sera proposé au renvoi).</p>'
      + '<p class="dmod__gestes"><button type="button" class="btn btn--bordeaux" data-dev="confirmerRappel">Oui, le corriger</button>'
      + '<button type="button" class="btn" data-dev="garderRappel">Non, le garder</button></p></div>';
  }
  function htmlReponse(avecOui) {
    var m = avecOui ? manquesCommande() : [];
    var oui = avecOui && !m.length;
    return '<section class="dmod__bloc dmod__commande" aria-labelledby="devCmdT"><h3 class="dmod__t" id="devCmdT">Le client a répondu ?</h3>'
      + (m.length ? '<p class="aff-aide" id="devCmdManque">' + esc(phraseManques(m)) + '</p>'
        : oui ? '<p class="aff-aide">S’il accepte, le devis se fige, l’affaire passe Gagnée et tu reçois le fichier de commande pour Vitisoft.</p>' : '')
      + '<p class="aff-aide dmod__attente" id="devCmdAttente" hidden>Termine d’abord l’envoi ouvert plus haut, ou appuie sur « Pas encore » : un client répond au devis qu’il a reçu.</p>'
      + '<p class="dmod__gestes">' + (oui ? '<button type="button" class="btn" data-dev="accepter">Oui, il accepte</button>' : '')
      + '<button type="button" class="btn" data-dev="refuser">Non, il refuse</button></p>'
      + (oui ? htmlConfirmeAccord() : '') + htmlConfirmeRefus() + '</section>';
  }
  function htmlAbandon() {
    return '<section class="dmod__bloc dmod__fin"><p class="dmod__gestes">'
      + '<button type="button" class="dmod__lien dmod__lien--x" data-dev="abandonner">Abandonner ce devis</button></p>'
      + htmlConfirmeAbandon() + '</section>';
  }
  /* UNE LIGNE PAR VIN, EN TABLEAU QUAND LA PLACE LE PERMET (juge V4) : au-dessus de 56 rem de
     boite, la ligne d'en-tete porte les noms des colonnes et chaque vin tient sur une rangee
     (bdv-devis.css). En dessous, chaque vin reste une carte, et la remise et la TVA se
     replient tant qu'elles valent leur defaut (juge V15) : la carte dit « remise 5 % » ou
     « TVA 5,5 % » quand ce n'est pas le cas, et le pli s'ouvre de lui-meme. L'en-tete est un
     `li` cache aux aides techniques : chaque champ garde son vrai libelle, masque a l'oeil. */
  /* Une remise ou une TVA qui n'est pas le defaut ne se replie pas : on ne cache pas ce qui compte. */
  function lignePlusRequis(l) { return !!l && ((C.remiseCb(l.remise) || 0) !== 0 || (!horsFrance() && String(l.tva) === '550')); }
  function lignePlus(l) { return !!l._plus || (C.remiseCb(l.remise) || 0) !== 0 || (!horsFrance() && String(l.tva) === '550'); }
  function resumePlus(l) {
    var r = C.remiseCb(l.remise), m = [];
    if (r) m.push('remise ' + C.pourcent(r) + '\u00a0%');
    if (!horsFrance() && String(l.tva) === '550') m.push('TVA 5,5\u00a0%');
    return m.join(', ');
  }
  /* LOT 68 (arbitre par Ted) : AU TELEPHONE, UNE LIGNE DE VIN SE REPLIE en deux lignes : son nom
     et « 12 x 8,90 € HT = 106,80 € HT ». Un appui sur « Changer » la deplie. Une ligne qu'on vient
     d'ajouter, ou qui a une erreur, est depliee. En carte large ou en tableau, rien ne change :
     le resume n'existe pas (bdv-devis.css). */
  function resumeLigne(l) {
    var q = qteDe(l), pu = puDe(l), r = rlDe(l);
    return l._c ? q + '\u00a0x ' + C.euros(pu) + '\u00a0HT' + (r ? ', remise ' + C.pourcent(r) + '\u00a0%' : '') + ' = ' + C.euros(l._c.net) + '\u00a0HT' : MOT_CORRIGER;
  }
  function ligneOuverte(l) { return !!l._ouverte || !l._c; }
  function htmlLignes() {
    var tva = !horsFrance();
    calcul();
    if (!S.lignes.length) return '<li class="aff-aide dmod__vide">Aucun vin pour l’instant : coche-le dans la liste, ou cherche-le.</li>';
    var tete = S.lignes.length ? '<li class="dmod__lentete" aria-hidden="true"><span>Vin</span><span class="dmod__champs' + (tva ? ' dmod__champs--tva' : '') + '">'
      + '<span>Quantité</span><span>Prix HT unitaire</span><span>Remise %</span>' + (tva ? '<span>TVA</span>' : '') + '<span>Total HT</span></span></li>' : '';
    return tete + S.lignes.map(function (l, i) {
      var plus = lignePlus(l), rs = resumePlus(l);
      var o = ligneOuverte(l);
      return '<li class="dmod__ligne' + (plus ? ' dmod__ligne--plus' : '') + (o ? ' dmod__ligne--ouverte' : '') + '" data-cle="' + esc(l.cle) + '">'
        + '<div class="dmod__ltete"><label class="dmod__coche"><input type="checkbox" checked data-dev-coche="' + esc(l.cle) + '">'
        + nomHtml(l) + '</label>'
        + (l.num_produit ? '<p class="dmod__code">Code ' + esc(l.num_produit) + '</p>' : '') + '</div>'
        + '<button type="button" class="dmod__lresume" data-dev="ligne" aria-expanded="' + (o ? 'true' : 'false') + '" aria-controls="devLC' + i + '">'
        + '<span class="dmod__lresume-t" data-dev-lr>' + esc(resumeLigne(l)) + '</span><span class="dmod__lresume-g">' + (o ? 'Replier' : 'Changer') + '</span></button>'
        + '<div class="dmod__champs' + (tva ? ' dmod__champs--tva' : '') + '" id="devLC' + i + '">'
        + '<label class="aff-champ"><span class="dmod__lib">Quantité</span><input type="text" inputmode="numeric" autocomplete="off" maxlength="5" data-dev-champ="qte" value="' + esc(l.qte) + '"></label>'
        + '<label class="aff-champ"><span class="dmod__lib">Prix HT unitaire</span><input type="text" inputmode="decimal" autocomplete="off" maxlength="12" data-dev-champ="prix" value="' + esc(l.prix) + '" title="' + esc(provenance(l)) + '" aria-describedby="devSrc' + i + '">'
        + '<small class="dmod__src" id="devSrc' + i + '" data-dev-src>' + esc(provenance(l)) + '</small></label>'
        + '<label class="aff-champ dmod__repli"><span class="dmod__lib">Remise %</span><input type="text" inputmode="decimal" autocomplete="off" maxlength="6" data-dev-champ="remise" value="' + esc(l.remise) + '"></label>'
        + (tva ? '<label class="aff-champ dmod__repli"><span class="dmod__lib">TVA</span><select data-dev-champ="tva">' + TAUX.map(function (x) {
          return '<option value="' + x[0] + '"' + (String(l.tva) === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' : '')
        /* W10 (02/10/2026) : « Remise ou autre TVA » APRES la quantite et le prix, sur la meme
           rangee que le total de la ligne. Avant, il passait devant le premier champ qu'on
           touche. Le conteneur ne compte qu'en carte etroite (bdv-devis.css) ; ailleurs il
           s'efface (`display:contents`) et le total reste la derniere colonne. */
        + '<div class="dmod__lpied"><button type="button" class="dmod__lien dmod__plus" data-dev="plus" aria-expanded="' + (plus ? 'true' : 'false') + '">Remise ou autre TVA'
        + (rs ? '<span class="dmod__plus-r"> : ' + esc(rs) + '</span>' : '') + '</button>'
        + '<p class="dmod__lt"><span class="dmod__lib">Total HT de la ligne</span><b data-dev-lt></b><small class="dmod__src" data-dev-net></small></p></div>'
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
        + (montre.length ? '<ul class="dmod__props">' + montre.map(htmlProp).join('') + '</ul>' : '<p class="aff-aide">Tous ces vins sont déjà dans le devis.</p>')
        + (reste > 0 ? '<p><button type="button" class="dmod__lien" data-dev="voirTout">'
          + (reste === 1 ? 'Voir l’autre vin' : 'Voir les ' + reste + ' autres vins') + '</button></p>' : '');
    }
    /* LA LISTE DU CLIENT NE L'A PAS : on cherche dans les ventes du domaine, une fois. */
    if (S.source === 'client') {
      if (S.propsDomaine === null) { chercherDomaine(); return '<p class="aff-aide">Je cherche dans les ventes de ton domaine…</p>'; }
      var dt = S.propsDomaine.filter(function (p) { return correspond(p, mots); });
      var dl = dt.filter(function (p) { return !pris[cleDe(p)]; });
      if (dl.length) return '<h4 class="dmod__st">Dans les ventes de ton domaine</h4><ul class="dmod__props">' + dl.map(htmlProp).join('') + '</ul>';
      if (dt.length) return '<p class="aff-aide">Tous ces vins sont déjà dans le devis.</p>';
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
    /* X6 (tour 3) : sans remise sur tout le devis ni frais de port, « Total des vins HT » et
       « Total HT » disaient le meme nombre deux fois. A L'ECRAN seulement : le papier d'un devis
       deja envoye ne change pas d'un octet, sa copie gardee porte son empreinte. */
    var deuxTotaux = g > 0 || t.port > 0 || t.total_vins !== t.total_ht;
    return '<div class="dmod__totaux">'
      + (deuxTotaux ? '<p class="dmod__tl"><span>Total des vins HT</span><span>' + C.euros(t.total_vins) + '</span></p>' : '')
      + (g > 0 ? '<p class="dmod__tl"><span>' + libelleRemise(g) + ' :</span><span>-' + C.euros(t.remise_globale) + '</span></p>'
        + '<p class="dmod__tl-x">' + EXPLICATION_REMISE + '</p>' : '')
      + (t.port > 0 ? '<p class="dmod__tl"><span>Frais de port HT</span><span>' + C.euros(t.port) + '</span></p>' : '')
      + '<p class="dmod__tl"><span>Total HT</span><span>' + C.euros(t.total_ht) + '</span></p>'
      + lignesTva(t, t.regime, ' class="dmod__tl"')
      + '<p class="dmod__tl dmod__tl--ttc"><span>Total TTC</span><span>' + C.euros(t.ttc) + '</span></p></div>'
      + (t.regime === 'export' ? '<p class="aff-aide">' + MENTION_EXPORT + '</p>' : t.regime === 'ue' ? '<p class="aff-aide">' + MENTION_UE + '</p>' : '')
      + '<p class="aff-aide">' + (t.accisesInconnu ? ACCISES_A_DIRE : t.accisesHors ? ACCISES_HORS : ACCISES) + '</p>'
      + (avecDeux ? '<p class="aff-aide">Les deux remises s’ajoutent : la remise sur tout le devis s’applique après celles des lignes.</p>' : '');
  }
  /* LES MONTANTS SE METTENT A JOUR EN PLACE : repeindre la liste a chaque touche
     ferait perdre le champ ou l'on tape. */
  function majTotaux() {
    var t = calcul(), g = gDe() || 0;
    t.regime = S.tva.regime; t.accisesHors = horsFrance() && S.tva.accises === false;
    t.accisesInconnu = horsFrance() && S.tva.accises !== true && S.tva.accises !== false;
    var deux = g > 0 && S.lignes.some(function (l) { return (rlDe(l) || 0) > 0; });
    var tot = el('devTotal'); if (tot) tot.innerHTML = t.invalide ? htmlACorriger() : htmlTotaux(t, g, deux);
    majResumes();
    var piedH = el('devPiedHt'); if (piedH) piedH.textContent = t.invalide ? MOT_CORRIGER : C.euros(t.total_ht);
    var pied = el('devPiedTtc'); if (pied) pied.textContent = t.invalide ? MOT_CORRIGER : C.euros(t.ttc);
    S.lignes.forEach(function (l) {
      var li = MOD.querySelector('.dmod__ligne[data-cle="' + cssEsc(l.cle) + '"]');
      if (!li) return;
      li.querySelector('[data-dev-lt]').textContent = l._c ? C.euros(l._c.net) : MOT_CORRIGER;
      var lr = li.querySelector('[data-dev-lr]'); if (lr) lr.textContent = resumeLigne(l);
      /* PRIX NET = prix apres la remise de LIGNE (pu_l) : prix net x quantite = total de la ligne. */
      li.querySelector('[data-dev-net]').textContent = l._c && rlDe(l) > 0 ? 'Prix net ' + C.euros(l._c.pu_l) : '';
      li.querySelector('[data-dev-src]').textContent = provenance(l);
      var pi = li.querySelector('[data-dev-champ="prix"]'); if (pi) pi.title = provenance(l);
    });
    majPrincipal();
  }
  /* UN SEUL BOUTON PRINCIPAL A LA FOIS (juge V8). Une confirmation ouverte porte le sien : le
     pied se met en retrait et dit de la terminer. Sans confirmation, « Enregistrer le devis »
     est le geste principal tant qu'il y a quelque chose a enregistrer ; un devis enregistre et
     inchange passe la main a « Préparer l'envoi ». Repose a chaque saisie et a chaque
     confirmation ouverte ou refermee, jamais en repeignant. */
  function majPrincipal() {
    if (!MOD) return;
    var conf = !!(S && (S.envoi || S.accord || S.confirme || S.refus)), d = S && S.devis;
    var enreg = MOD.querySelector('[data-dev="enregistrer"]'), env = MOD.querySelector('[data-dev="envoyer"]') || el('devEcrireMail');
    var aEnregistrer = !d || !!S.modifie;
    var et = S && S.etape ? S.etape : 3, suiv = el('devSuivant');
    if (suiv) { suiv.hidden = et === 3; suiv.textContent = SUIVANT[et] || ''; suiv.classList.toggle('btn--bordeaux', !conf && et < 3); }
    if (enreg) enreg.classList.toggle('btn--bordeaux', !conf && aEnregistrer && (et === 3 || !suiv));
    if (env) env.classList.toggle('btn--bordeaux', !conf && !aEnregistrer);
    var mot = el('devPiedMot');
    if (mot) {
      mot.textContent = conf ? 'Termine d’abord la question ouverte plus haut.' : (d && S.modifie ? 'Modifié, pas encore enregistré.' : '');
      mot.hidden = !mot.textContent;
    }
    var note = el('devEnvoiNote'); if (note) note.hidden = !S.modifie;
    /* W11 (02/10/2026) : la preparation de l'envoi ouverte, « Oui, il accepte » et « Non, il
       refuse » passent en retrait et disent pourquoi. Un client ne repond pas a un devis qu'on
       est en train de lui envoyer. `aria-disabled` et pas `disabled` : le bouton garde le
       focus et se fait lire. */
    var attente = !!(S && S.envoi);
    ['accepter', 'refuser'].forEach(function (q) {
      var b = MOD.querySelector('.dmod__commande [data-dev="' + q + '"]');
      if (!b) return;
      if (attente) { b.setAttribute('aria-disabled', 'true'); b.setAttribute('aria-describedby', 'devCmdAttente'); }
      else { b.removeAttribute('aria-disabled'); if (b.getAttribute('aria-describedby') === 'devCmdAttente') b.removeAttribute('aria-describedby'); }
    });
    var at = el('devCmdAttente'); if (at) at.hidden = !attente;
    /* X7 (tour 3) : la question « Il a dit non » ouverte, UN seul geste actif. « Oui, il
       accepte », « Créer un lien » et « Refaire ce devis » passent en retrait, et disent pourquoi. */
    var refusOuvert = !!(S && S.refus);
    MOD.querySelectorAll('[data-dev="accepter"], [data-dev="lienCreer"], [data-dev="refaire"]').forEach(function (b) {
      if (refusOuvert) { b.setAttribute('aria-disabled', 'true'); b.setAttribute('aria-describedby', 'devRefusAttente'); }
      else if (b.getAttribute('aria-describedby') === 'devRefusAttente') {
        b.removeAttribute('aria-describedby');
        if (!(attente && b.closest('.dmod__commande'))) b.removeAttribute('aria-disabled');
      }
    });
  }
  /* T7 (tour 3) : pendant la question « Annuler l'acceptation ? », un seul bouton plein, celui
     de la question. « Télécharger la commande » passe en retrait (pas de `disabled` : il garde
     le focus et se fait lire), et sa description dit ce qu'on attend. */
  function poserAnnul(on) {
    S.annul = !!on;
    var b = MOD && MOD.querySelector('.dmod__commande [data-dev="telecharger"]');
    if (!b) return;
    b.classList.toggle('btn--bordeaux', !on);
    if (on) { b.setAttribute('aria-disabled', 'true'); b.setAttribute('aria-describedby', 'devAnnulDit'); }
    else { b.removeAttribute('aria-disabled'); b.removeAttribute('aria-describedby'); }
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
      if (x.quoi === 'code') return 'Le code article de ' + x.vins.join(', ') + ' porte un point-virgule, un guillemet ou un retour à la ligne, que le fichier de commande ne sait pas transporter sans le changer.'
        + (x.vins.length > 1 ? ' Retire-les du devis et ajoute-les' : ' Retire-le du devis et ajoute-le') + ' à la main dans Vitisoft.';
      if (x.quoi === 'client') return 'Ce client n’a ni numéro Vitisoft ni e-mail dans tes exports : Vitisoft créerait un deuxième client. Saisis cette commande dans Vitisoft.';
      return 'Ce devis n’a aucun vin.';
    }).join(' ');
  }
  function manquesCommande() {
    return window.BdvCommande ? BdvCommande.manques(S.devis, S.lignesServeur || []) : [];
  }
  function htmlConfirmeAccord() {
    return '<div class="dmod__confirme" id="devAccord"' + (S.accord ? '' : ' hidden') + '>'
      + (expire(S.devis) ? '<p class="aff-aide">Ce devis a expiré le ' + esc(dateFr(S.devis.valable_jusqu)) + ' : tu confirmes qu’il accepte ces prix ?</p>' : '')
      + '<p class="aff-aide">Le devis ' + esc(S.devis.numero) + ' ne se modifiera plus (une correction demandera un nouveau devis) et l’affaire passera Gagnée. Tu reçois ensuite le fichier pour Vitisoft.</p>'
      + '<p class="dmod__gestes"><button type="button" class="btn btn--bordeaux" data-dev="confirmerAccord">Oui, il a dit oui</button>'
      + '<button type="button" class="btn" data-dev="pasEncore">Pas encore</button></p></div>';
  }
  function htmlCommandeApres() {
    return '<section class="dmod__bloc dmod__commande" aria-labelledby="devCmdT"><h3 class="dmod__t" id="devCmdT">La commande Vitisoft</h3>'
      + (S.devis.signe_le ? htmlPreuve() : '<p class="dmod__cond">Accepté le ' + esc(dateFr(S.devis.accepte_le)) + '. L’affaire est gagnée.</p>')
      + '<p class="aff-aide" id="devCmdTrace"' + (phraseTrace(S.devis) ? '' : ' hidden') + '>' + esc(phraseTrace(S.devis)) + '</p>'
      + '<p class="dmod__gestes"><button type="button" class="btn' + (S.annul ? '" aria-disabled="true" aria-describedby="devAnnulDit"' : ' btn--bordeaux"') + ' data-dev="telecharger">Télécharger la commande</button>'
      + '<button type="button" class="btn" data-dev="apercu">Voir et imprimer</button></p>'
      + '<p class="aff-aide">' + esc(IMPORT_VITI) + ' ' + esc(DEJA_12) + '</p>'
      + '<p class="dmod__gestes"><button type="button" class="dmod__lien dmod__lien--x" data-dev="annulerAccord">Annuler l’acceptation</button></p>'
      + htmlConfirmeAnnul() + '</section>';
  }

  /* LA PREUVE D'UNE SIGNATURE EN LIGNE : ce que la base a garde, dit en clair. L'adresse IP
     est un indice (le client peut la forger), pas une identite : elle est nommee comme telle. */
  function htmlPreuve() {
    var d = S.devis, p = S.preuve;
    var h = '<p class="dmod__cond">Signé en ligne le ' + esc(heureFr(d.signe_le)) + (p ? ' par ' + esc(p.nom) + ' (' + esc(p.qualite) + ')'
      + (p.au_nom_de ? ', au nom de ' + esc(p.au_nom_de) : '') : '') + '. Le devis est accepté, l’affaire est gagnée.</p>';
    /* LOT 70 : la signature elle-meme (dessinee ou nom en ecriture manuscrite), telle que la base
       l'a gardee. Seul un PNG en base64 passe : l'adresse va dans un attribut. */
    if (p && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]+={0,2}$/.test(String(p.trace || '')))
      h += '<p class="aff-aide">' + (p.trace_mode === 'manuscrit' ? 'Signature : son nom, écrit en écriture manuscrite.' : 'Signature dessinée par le client.')
        + '</p><img class="dmod__signature" src="' + p.trace + '" alt="Signature de ' + esc(p.nom) + '">';
    if (p) h += '<details class="aff-plus"><summary>La preuve gardée</summary><p class="aff-aide">Case « Bon pour accord » cochée. Empreinte du devis signé : '
      + esc(empreinteLisible(p.papier_empreinte)) + (p.papier_empreinte === d.papier_empreinte ? ', la même que la copie gardée.' : '.')
      + (p.ip ? ' Adresse IP : ' + esc(p.ip) + ' (un indice, pas une identité).' : '') + (p.agent ? ' Navigateur : ' + esc(p.agent) + '.' : '')
      + ' Date et heure du serveur.</p></details>';
    return h;
  }

  function cmdEnTete(d) {
    return !!d && d.statut === 'accepte' && !(Number(d.commande_telechargements) > 0) && !d.commande_telechargee_le;
  }
  function htmlLecture() {
    var l = S.lignesServeur || [];
    var d = S.devis;
    var t = { total_vins: d.total_vins_c, remise_globale: d.remise_globale_c, port: Number(d.port_c) || 0, total_ht: d.total_ht_c, tva: d.tva_c, ttc: d.total_ttc_c,
      taux: tauxDuDevis(d, l), regime: d.regime_tva, accisesHors: phraseAccises(d) === ACCISES_HORS };
    var deux = d.remise_globale_cb > 0 && l.some(function (x) { return x.remise_cb > 0; });
    /* X2 (tour 3) : un devis accepte (signe en ligne ou « il a dit oui ») dont la commande n'a
       JAMAIS ete telechargee porte « La commande Vitisoft » EN TETE : la punaise et le bandeau
       disent « telecharge la commande », le bouton doit etre dans le premier ecran, a 390 comme
       a 1440 (meme motif que le lien de signature, N2). Une fois telechargee, le bloc retrouve
       sa place apres les conditions, a la prochaine ouverture : on ne deplace rien sous le doigt. */
    var cmdTete = cmdEnTete(d);
    return (lienMontre() ? htmlLienMontre() : '') + (cmdTete ? htmlCommandeApres() : '') + htmlQui()
      + '<section class="dmod__bloc" aria-labelledby="devVinsT"><h3 class="dmod__t" id="devVinsT">Tes vins</h3>'
      + '<ul class="dmod__lignes dmod__lignes--lues">' + l.map(function (x) {
        return '<li class="dmod__ligne">' + nomHtml(x, 'p') + '<p class="aff-aide">'
          + esc(x.quantite + '\u00a0x ' + C.euros(x.pu_ht_c) + '\u00a0HT' + (x.remise_cb ? ', remise ' + C.pourcent(x.remise_cb) + '\u00a0% (prix net ' + C.euros(prixNet(x)) + ')' : '')
          + ' : ' + C.euros(x.net_c) + (mixte(l) ? ', TVA ' + libTaux(x.tva_cb) : '')) + '</p></li>';
      }).join('') + '</ul></section>'
      + (d.regime_tva === 'export' || d.regime_tva === 'ue' ? '<section class="dmod__bloc" aria-labelledby="devTvaT"><h3 class="dmod__t" id="devTvaT">TVA</h3><p class="dmod__cond">'
        + (d.regime_tva === 'ue' ? 'Pro dans l’UE, n° de TVA ' + esc(d.client_tva || '') + '. ' : 'Export hors de l’UE. ') + esc(d.regime_tva === 'ue' ? MENTION_UE : MENTION_EXPORT) + '</p>'
        + (Number(d.port_c) > 0 ? '<p class="aff-aide">' + esc(PORT_0) + '</p>' : '') + '</section>' : '')
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
        : d.statut === 'accepte' ? (cmdTete ? '' : htmlCommandeApres())
        : d.statut === 'envoye' ? htmlSuiteEnvoye()
        : '<section class="dmod__bloc dmod__suite"><p class="dmod__gestes"><button type="button" class="btn" data-dev="apercu">Voir et imprimer</button></p></section>');
  }

  /* ---------------- LES GESTES ---------------- */
  function ligneDe(n) {
    var li = n.closest('.dmod__ligne');
    var cle = li && li.getAttribute('data-cle');
    return S.lignes.filter(function (l) { return l.cle === cle; })[0];
  }
  /* Apres chaque geste, le bouton principal est repose (V8) : une confirmation vient peut-etre
     de s'ouvrir ou de se refermer. */
  function surClic(ev) { surClicGeste(ev); if (S && S.etat === 'edition') majPrincipal(); }
  function surClicGeste(ev) {
    var b = ev.target.closest('[data-dev]');
    if (!b || !MOD.contains(b) || !S) return;
    var q = b.getAttribute('data-dev');
    if (q === 'fermer') { fermer(); return; }
    if (q === 'retour') { retour(); return; }
    if (q === 'ecrireMail') { retour({ mail: true }); return; }
    if (q === 'domaine') { ouvrirDomaine(); return; }
    if (q === 'etape') { montrerEtape(Number(b.getAttribute('data-vers'))); return; }
    if (q === 'suivant') { montrerEtape(Math.min(3, (S.etape || 1) + 1)); return; }
    if (q === 'pli') { basculerPli(b.getAttribute('data-pli'), undefined, true); return; }
    if (q === 'ligne') { basculerLigne(b.closest('.dmod__ligne'), true); return; }
    if (q === 'relire') { S.etat = 'chargement'; peindre(); charger(S); return; }
    if (q === 'reprendre') {
      var br = S.brouillon;
      S.lignes = (br.lignes || []).filter(function (l) { return l && l.cle; }).slice(0, MAX_LIGNES);
      S.remise = br.remise == null ? '0' : String(br.remise);
      S.notes = br.notes || '';
      S.versionDe = br.version_de && br.version_de.devis_id ? br.version_de : null;
      S.liv = Object.assign(livVide(), br.liv && typeof br.liv === 'object' ? br.liv : {});
      S.tva = Object.assign(tvaVide(), br.tva && typeof br.tva === 'object' ? br.tva : {});
      S.brouillon = null; S.etat = 'edition'; S.modifie = true; S.quitterOk = false; S.plis = null; S.etape = 1; peindre(); return;
    }
    if (q === 'zero') { effacerBrouillon(S.ctx.affaire.affaire_id); S.brouillon = null; S.versionDe = null; S.liv = livVide(); S.tva = tvaVide(); S.etat = 'edition'; S.etape = 1; S.plis = null; peindre(); return; }
    if (q === 'voirTout') { S.voirTout = true; peindreProps(); return; }
    if (q === 'plus') {
      var lp = b.closest('.dmod__ligne');
      if (!lp) return;
      if (lp.classList.contains('dmod__ligne--plus') && !lignePlusRequis(ligneDe(lp))) {
        var lx = ligneDe(lp); if (lx) lx._plus = false;
        lp.classList.remove('dmod__ligne--plus'); b.setAttribute('aria-expanded', 'false');
      } else ouvrirPlus(lp, true);
      return;
    }
    if (q === 'enregistrer') { enregistrer(); return; }
    if (q === 'apercu') { entrerApercu(); return; }
    if (q === 'revenir') {
      sortirApercu();
      S.voirVersion = null;
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
    if ((q === 'accepter' || q === 'lienCreer' || q === 'refaire' || q === 'rappeler') && S.refus) {
      var ra = el('devRefusAttente'); if (ra) montrerDansBoite(ra);
      var cr = MOD.querySelector('[data-dev="confirmerRefus"]'); if (cr) { try { cr.focus({ preventScroll: true }); } catch (e) { cr.focus(); } }
      return;
    }
    if ((q === 'accepter' || q === 'refuser') && S.envoi && b.closest('.dmod__commande')) {
      var at2 = el('devCmdAttente'); if (at2) { at2.hidden = false; montrerDansBoite(at2); }
      return;
    }
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
    if (q === 'allerEnvoi') { var pr2 = el('devProchaine'); if (pr2) pr2.hidden = true; if (S.etape !== 3) montrerEtape(3, true);
      var bm2 = el('devEcrireMail'); if (bm2) { try { bm2.focus({ preventScroll: true }); } catch (e) {} montrerDansBoite(bm2); return; }
      q = 'envoyer'; }
    if (q === 'envoiAutre') { S.envoiAutre = true; peindre(); var be = MOD.querySelector('[data-dev="envoyer"]'); if (be) { try { be.focus(); } catch (e) {} } return; }
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
      if (refus) S.refus = true; else poserAnnul(true);
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
      if (r1) S.refus = false; else poserAnnul(false);
      var bx2 = el(r1 ? 'devRefus' : 'devAnnul'); if (bx2) bx2.hidden = true;
      var rb = MOD.querySelector(r1 ? '[data-dev="refuser"]' : '[data-dev="annulerAccord"]'); if (rb) { try { rb.focus(); } catch (e) {} }
      return;
    }
    if (q === 'confirmerRefus') { noterRefus(); return; }
    if (q === 'confirmerAnnul') { annulerAccord(); return; }
    if (q === 'refaire') { refaire(); return; }
    if (q === 'rappeler') {
      S.rappel = true;
      var rc = el('devRappel');
      if (rc) {
        rc.hidden = false;
        var gn = rc.querySelector('[data-dev="garderRappel"]');
        if (gn) { try { gn.focus({ preventScroll: true }); } catch (e) { gn.focus(); } }
        montrerDansBoite(rc);
      }
      return;
    }
    if (q === 'garderRappel') { S.rappel = false; var rc2 = el('devRappel'); if (rc2) rc2.hidden = true;
      var rb2 = MOD.querySelector('[data-dev="rappeler"]'); if (rb2) { try { rb2.focus(); } catch (e) {} } return; }
    if (q === 'confirmerRappel') { rappeler(); return; }
    if (q === 'lienCreer') { creerLien(false); return; }
    if (q === 'lienCopier' && S.lien) { copier(S.lien.url, 'Lien copié : colle-le dans ton mail.'); return; }
    if (q === 'messageCopier' && S.lien) { copier(messageType(S.lien.url), 'Message copié : colle-le dans ton mail, joins le PDF, envoie.'); return; }
    if (q === 'telecharger' && S.annul) { var ga = MOD.querySelector('#devAnnul [data-dev="garderAccord"]'); if (ga) { try { ga.focus(); } catch (e) {} } return; }
    if (q === 'telecharger') { var nm = telecharger(); if (nm) noterTelechargement('Fichier ' + nm + ' téléchargé. ' + IMPORT_VITI); return; }
  }
  function majAideLiv() {
    var sec = el('devPli_liv') || el('devLiv'); if (!sec) return;
    var p = sec.querySelector('.aff-aide'), veut = S.liv.mode !== 'retrait' && portDe() > 0;
    if (veut && !p) { p = document.createElement('p'); p.className = 'aff-aide'; p.textContent = TRANSPORT_VITI; sec.appendChild(p); }
    else if (!veut && p) p.remove();
  }
  function surChangement(ev) {
    var t = ev.target;
    /* Les champs de l'envoi refont la phrase et le nom du bouton (juge V1). */
    if (t && t.closest && t.closest('#devEnvoi')) { majEnvoi(); return; }
    if (S && S.etat === 'edition' && t.hasAttribute && t.hasAttribute('data-dev-accises')) {
      S.tva.accises = t.value === 'oui'; S.modifie = true; S.quitterOk = false;
      var fx = el('devTvaAccises'); if (fx) { effacerErreur(fx); [].forEach.call(fx.querySelectorAll('input'), effacerErreur); [].forEach.call(fx.querySelectorAll('.dmod__err'), function (n) { n.remove(); }); }
      majTotaux(); ecrireBrouillon(); return;
    }
    if (S && S.etat === 'edition' && t.hasAttribute && t.hasAttribute('data-dev-regime')) {
      /* LE REGIME CHANGE : la section TVA ET les lignes se repeignent (le choix du taux n'existe
         qu'en France) ; le focus reste sur le bouton choisi. */
      /* En quittant la France, la question des accises se pose : sans reponse par defaut. */
      if (S.tva.regime === 'france' && t.value !== 'france') S.tva.accises = null;
      S.tva.regime = t.value;
      var sx = el('devTva'); if (sx) sx.innerHTML = htmlTva();
      var nl = el('devLignes'); if (nl) nl.innerHTML = htmlLignes();
      S.modifie = true; S.quitterOk = false; majTotaux(); ecrireBrouillon();
      var fr = MOD.querySelector('[data-dev-regime][value="' + cssEsc(S.tva.regime) + '"]'); if (fr) { try { fr.focus(); } catch (e) {} }
      return;
    }
    if (S && S.etat === 'edition' && t.hasAttribute && t.hasAttribute('data-dev-livmode')) {
      /* LE MODE CHANGE : la section se repeint, le focus reste sur le bouton choisi. */
      /* LE RETRAIT GARDE LE PORT ET LE TRANSPORTEUR DE COTE (S5, juge V10) : un clic par erreur
         sur « Il vient chercher » puis un retour a « Une autre adresse » les retrouve. Ils sont
         ignores tant que le mode est le retrait : `portDe()` rend 0, `livCorps()` ne les envoie
         pas, et la base, qui les refuse en retrait, ne les voit jamais. */
      S.liv.mode = t.value;
      var sec = el('devLiv'); if (sec) sec.innerHTML = htmlLivraison();
      S.modifie = true; S.quitterOk = false; majTotaux(); ecrireBrouillon();
      var f = MOD.querySelector('[data-dev-livmode][value="' + cssEsc(S.liv.mode) + '"]'); if (f) { try { f.focus(); } catch (e) {} }
      return;
    }
    if (!S || S.etat !== 'edition' || !t.hasAttribute || !t.hasAttribute('data-dev-coche')) return;
    var cle = t.getAttribute('data-dev-coche');
    if (t.checked) {
      if (S.lignes.length >= MAX_LIGNES) { t.checked = false; dire('Un devis porte 200 lignes au plus.', true); return; }
      var p = S.props.concat(S.propsDomaine || []).filter(function (x) { return cleDe(x) === cle; })[0];
      if (p && !S.lignes.some(function (l) { return l.cle === cle; })) {
        calcul();
        S.lignes.forEach(function (l) { if (l._c) l._ouverte = false; });
        var nl = ligneDeProposition(p); nl._ouverte = true; S.lignes.push(nl);
      }
    } else {
      S.lignes = S.lignes.filter(function (l) { return l.cle !== cle; });
    }
    var n = el('devLignes'); if (n) n.innerHTML = htmlLignes();
    S.modifie = true; S.quitterOk = false;
    peindreProps();
    majTotaux();
    ecrireBrouillon();
    var f = MOD.querySelector('[data-dev-coche="' + cssEsc(cle) + '"]');
    if (f) { try { f.focus(); } catch (e) {} }
  }
  function surSaisie(ev) {
    if (ev.target && ev.target.closest && ev.target.closest('#devEnvoi')) { majEnvoi(); return; }
    var t = ev.target;
    if (!S || S.etat !== 'edition') return;
    if (t.getAttribute && t.getAttribute('aria-invalid') === 'true') effacerErreur(t);
    if (t.id === 'devCherche') { S.q = t.value; peindreProps(); return; }
    if (t.id === 'devRemise') S.remise = t.value;
    else if (t.id === 'devNotes') S.notes = t.value;
    else if (t.id === 'devTvaClient') S.tva.client = t.value;
    else if (t.hasAttribute && t.hasAttribute('data-dev-liv')) {
      var avant = portDe() > 0;
      S.liv[t.getAttribute('data-dev-liv')] = t.value;
      if (t.id === 'devLivPays') { var cpI = el('devLivCp'); if (cpI) cpI.setAttribute('inputmode', cpMode()); }
      /* La phrase Vitisoft du port apparait / disparait sans repeindre le champ ou l'on tape. */
      if ((portDe() > 0) !== avant) majAideLiv();
    }
    else if (t.hasAttribute && t.hasAttribute('data-dev-champ')) {
      var l = ligneDe(t);
      if (!l) return;
      l[t.getAttribute('data-dev-champ')] = t.value;
    } else return;
    S.modifie = true; S.quitterOk = false;
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
    [].forEach.call(MOD.querySelectorAll('[aria-invalid="true"], [aria-describedby*="devErr"]'), effacerErreur);
    [].forEach.call(MOD.querySelectorAll('.dmod__err'), function (n) { n.remove(); });
  }
  /* `groupe` (facultatif) : un FIELDSET de choix. Le message va alors SOUS les choix, a la fin
     du groupe, et non derriere le premier bouton radio, ou il coupait son libelle en deux
     (N6, 02/10/2026) ; tous les choix le portent en description, et c'est le groupe entier
     qui est ramene au-dessus du pied collant. */
  function basculerLigne(li, focus, ouvrir) {
    var l = li && ligneDe(li);
    if (!l) return;
    l._ouverte = ouvrir === undefined ? !li.classList.contains('dmod__ligne--ouverte') : ouvrir;
    li.classList.toggle('dmod__ligne--ouverte', l._ouverte);
    var b = li.querySelector('[data-dev="ligne"]');
    if (b) { b.setAttribute('aria-expanded', l._ouverte ? 'true' : 'false'); var g = b.querySelector('.dmod__lresume-g'); if (g) g.textContent = l._ouverte ? 'Replier' : 'Changer'; }
    if (focus && l._ouverte) { var q = li.querySelector('[data-dev-champ="qte"]'); if (q) { try { q.focus({ preventScroll: true }); } catch (e) {} montrerDansBoite(q); } }
  }
  function refuser(txt, champ, groupe) {
    effacerErreurs();
    dire(txt, true);
    if (champ) {
      var pli = champ.closest && champ.closest('.dmod__pli-corps');
      if (pli && pli.hidden) basculerPli(pli.id.replace('devPli_', ''), true);
      var etp = champ.closest && champ.closest('.dmod__etape[data-etape]');
      if (etp && etp.hidden) montrerEtape(Number(etp.getAttribute('data-etape')), true);
      var li = champ.closest && champ.closest('.dmod__ligne');
      if (li && !li.classList.contains('dmod__ligne--ouverte')) basculerLigne(li, false, true);
      if (li && champ.closest('.dmod__repli')) ouvrirPlus(li, false);
      var id = 'devErr' + (++N_ERR);
      var e = document.createElement(groupe ? 'p' : 'span');
      e.className = 'dmod__err';
      e.id = id;
      e.textContent = txt;
      var cibles = groupe ? [].slice.call(groupe.querySelectorAll('input')) : [champ];
      if (groupe) { groupe.appendChild(e); groupe.setAttribute('aria-invalid', 'true'); }
      else champ.insertAdjacentElement('afterend', e);
      cibles.forEach(function (c) {
        if (!groupe) c.setAttribute('aria-invalid', 'true');
        c.setAttribute('aria-describedby', ((c.getAttribute('aria-describedby') || '') + ' ' + id).trim());
      });
      try { champ.focus({ preventScroll: true }); } catch (x) { try { champ.focus(); } catch (y) {} }
      montrerDansBoite(groupe || champ.closest('.aff-champ') || champ);
    }
    return null;
  }
  /* LE PLI « REMISE OU AUTRE TVA » d'une ligne s'ouvre en place, sans repeindre la liste. */
  function ouvrirPlus(li, focus) {
    var l = ligneDe(li);
    if (l) l._plus = true;
    li.classList.add('dmod__ligne--plus');
    var b = li.querySelector('[data-dev="plus"]'); if (b) b.setAttribute('aria-expanded', 'true');
    if (focus) { var r = li.querySelector('[data-dev-champ="remise"]'); if (r) { try { r.focus(); } catch (e) {} } }
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
      var lx = { num_produit: l.num_produit, designation: l.designation, conditionnement: l.conditionnement,
        millesime: l.millesime, quantite: q, pu_ht_c: pu, remise_cb: r, source_prix: sourceDe(l) };
      /* Le taux ne part que s'il dit quelque chose (5,5 %), ou si le SQL du lot 54 est passe. */
      if (tauxDe(l) !== 2000 || lot54() || !tvaParDefaut()) lx.tva_cb = tauxDe(l);
      sortie.push(lx);
    }
    if (gDe() === null) return refuser('Une remise va de 0 à 100 %.', el('devRemise'));
    var lv = S.liv;
    if (lv.mode === 'adresse') {
      if (!String(lv.nom).trim()) return refuser('Indique le destinataire de la livraison.', el('devLivNom'));
      if (!String(lv.adresse1).trim()) return refuser('Indique l’adresse de livraison.', el('devLivA1'));
      if (!String(lv.cp).trim()) return refuser('Indique le code postal de livraison.', el('devLivCp'));
      if (!String(lv.ville).trim()) return refuser('Indique la ville de livraison.', el('devLivVille'));
    }
    if (S.tva.regime === 'ue') {
      var nt = numeroTva(S.tva.client);
      if (!/^[A-Z]{2}[0-9A-Z+*]{2,13}$/.test(nt)) return refuser('Indique le numéro de TVA intracommunautaire du client, avec le code de son pays (par exemple DE123456789).', el('devTvaClient'));
      if (nt.slice(0, 2) === 'FR') return refuser('Un numéro qui commence par FR est français : choisis « En France ».', el('devTvaClient'));
      if (!(S.fiche && S.fiche.tva)) return refuser('Ton numéro de TVA intracommunautaire manque dans Mon domaine : il doit figurer sur le devis.', MOD.querySelector('#devTva [data-dev="domaine"]'));
    }
    if (horsFrance() && S.tva.accises !== true && S.tva.accises !== false)
      return refuser('Dis si tes prix comprennent les droits d’accises : le devis l’écrit au client.', MOD.querySelector('[data-dev-accises]'), el('devTvaAccises'));
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
      /* LE NEUVIEME (lot 54), meme regle. */
      if (!tvaParDefaut() || lot54()) corps.p_tva = tvaCorps();
      r = unSeul(await rpc('devis_enregistrer', corps));
    } catch (e) { err = e; }
    if (moi !== S) return;
    S.attente = false;
    if (bouton) bouton.removeAttribute('aria-busy');
    /* UN RETOUR VIDE OU SANS NUMERO EST UN ECHEC, et il se dit comme tel. */
    if (err || !r || !r.numero) {
      var detail = err ? String(err.detail || '') : '';
      if (err && sqlAbsent(err) && corps && corps.p_tva && !lot54()) dire(MOT_SQL_TVA, true);
      else if (err && sqlAbsent(err) && corps && corps.p_livraison && !lot53()) dire(MOT_SQL_LIV, true);
      else if (/tva :.*domaine/.test(detail)) dire('Ton numéro de TVA intracommunautaire manque dans Mon domaine. Tes lignes sont gardées.', true);
      else if (/tva :/.test(detail)) dire('La TVA n’est pas complète : vérifie le numéro de TVA du client. Tes lignes sont gardées.', true);
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
    if (lot54()) S.tva = tvaDeDevis(r);
    S.versionDe = null;
    effacerBrouillon(S.ctx.affaire.affaire_id);
    /* Le prix enregistre devient l'origine : sa provenance est celle qu'on vient d'ecrire. */
    S.lignes.forEach(function (l, i) { l.pu_origine = lignes[i].pu_ht_c; l.source_origine = lignes[i].source_prix; });
    S.lignesServeur = lignes.map(function (x, i) {
      var c = C.ligne(x.pu_ht_c, x.quantite, x.remise_cb, g);
      return Object.assign({ rang: i + 1, tva_cb: x.tva_cb == null ? 2000 : x.tva_cb, pu_l_c: c.pu_l, pu_f_c: c.pu_f, net_c: c.net, final_c: c.final }, x);
    });
    try {
      var lu = await api('/devis_lignes?bureau=eq.' + encodeURIComponent(bureau()) + '&devis_id=eq.' + encodeURIComponent(r.devis_id) + '&order=rang');
      if (Array.isArray(lu) && lu.length) S.lignesServeur = lu;
    } catch (e) {}
    if (moi !== S) return;
    S.confirme = false;
    S.modifie = false;
    S.etape = 3;
    peindre();
    dire('Devis ' + r.numero + (remplace ? ' enregistré. Il remplace le ' + remplace + ', abandonné.' : neuf ? ' enregistré.' : ' enregistré, avec tes changements.'));
    /* X1 : la suite n'est proposee que si le bloc d'envoi est la pour la recevoir. */
    var pro = el('devProchaine');
    if (pro && MOD.querySelector('[data-dev="envoyer"]')) pro.hidden = false;
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

  /* LOT 65 : « OUI, LE RAPPELER ». Un retour qui n'est pas `enregistre` est un ECHEC : le
     devis n'a pas bouge et son lien marche toujours. Reussi, le devis s'ouvre en saisie, avec
     les propositions relues (un devis envoye ne les avait pas chargees). */
  async function rappeler() {
    if (S.attente || !S.devis || S.devis.statut !== 'envoye') return;
    var moi = S, r = null, err = null, b = MOD.querySelector('[data-dev="confirmerRappel"]');
    S.attente = true;
    if (b) b.setAttribute('aria-busy', 'true');
    try { r = unSeul(await rpc('devis_rappeler', { p_bureau: bureau(), p_devis: S.devis.devis_id })); }
    catch (e) { err = e; }
    if (moi !== S) return;
    S.attente = false;
    if (b) b.removeAttribute('aria-busy');
    if (err || !r || r.statut !== 'enregistre') {
      var det = err ? String(err.detail || err.message || '') : '';
      if (err && sqlAbsent(err)) dire(MOT_SQL_RAPPEL, true);
      else if (/devis signe/.test(det)) dire('Ce devis a été signé en ligne : il n’est plus modifiable. Pour le changer, appuie sur « Refaire ce devis » : il repart sous un nouveau numéro.', true);
      else if (/commande deja telechargee/.test(det)) dire('Sa commande a déjà été téléchargée pour Vitisoft : il n’est plus modifiable. Pour le changer, appuie sur « Refaire ce devis » : il repart sous un nouveau numéro.', true);
      else if (/affaire close/.test(det)) dire('Cette affaire est close : rouvre-la d’abord pour corriger le devis.', true);
      else dire('Le devis n’est pas corrigé : ' + (err && !err.status ? 'ta connexion a coupé.' : 'le bureau l’a refusé.') + ' Il n’a pas bougé, son lien marche toujours.', true);
      return;
    }
    try {
      var p = await rpc('devis_propositions', { p_bureau: bureau(), p_affaire: S.ctx.affaire.affaire_id, p_tout_le_domaine: false });
      if (moi !== S) return;
      S.props = Array.isArray(p) ? trierProps(p) : [];
      if (S.props.length) S.source = S.props[0].source === 'client' ? 'client' : 'bureau';
    } catch (e) { if (moi !== S) return; S.props = []; }
    var livEffacee = !!(S.devis.livraison_souhaitee && !r.livraison_souhaitee);
    S.devis = r;
    S.rappel = false; S.envoi = false; S.lien = null; S.lienInfo = false; S.copie = null;
    S.lignes = (S.lignesServeur || []).map(ligneDeDevis);
    S.remise = C.pourcent(r.remise_globale_cb || 0);
    S.notes = r.notes || '';
    S.liv = livDeDevis(r);
    S.tva = tvaDeDevis(r);
    S.modifie = false;
    S.etat = 'edition'; S.etape = 1; S.plis = null;
    peindre();
    dire('Devis ' + r.numero + ' en correction : son lien de signature ne marche plus. Modifie-le, enregistre, puis renvoie la version ' + r.version + '.'
      + (livEffacee ? ' Sa date de livraison souhaitée était passée : elle est effacée, remets-en une si besoin.' : ''));
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
    /* LOT 55 : l'annulation eteint les liens ; un lien encore affiche serait un lien mort. */
    S.lien = null; S.lienInfo = false; S.preuve = null;
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
    var cLien = el('devEnvoiLien'), avecLien = !!(cLien && cLien.checked && lienPossible());
    var moi = S, r = null, err = null, b = MOD.querySelector('[data-dev="confirmerEnvoi"]');
    S.attente = true;
    if (b) b.setAttribute('aria-busy', 'true');
    /* LA RELANCE RATTRAPE LE DEVIS JAMAIS PARTI (juge V1, tour 2) : note envoye AUJOURD'HUI,
       c'est-a-dire avant le mail, son rappel le dit dans Ma journee. Note envoye un autre jour,
       le devis est parti : le titre par defaut de la base suffit. Moins de 80 signes. */
    var titreRel = rappel && jour === auj ? titreRelance(S.devis.numero) : null;
    var corpsE = { p_bureau: bureau(), p_devis: S.devis.devis_id, p_jour: jour, p_rappel: rappel, p_rappel_titre: titreRel, p_etape: et };
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
    S.lienInfo = false;
    if (rappel && S.ctx.affaire) { S.ctx.affaire.rappel = rappel; S.ctx.affaire.rappel_titre = titreRel || 'Relancer le devis ' + r.numero; }
    peindre();
    var motE = 'Devis ' + r.numero + ' noté envoyé le ' + dateFr(r.envoye_le) + '.' + (rappel ? ' Relance prévue le ' + dateFr(rappel) + ', dans Ma journée.' : '')
      + (copieE ? (r.papier_empreinte ? ' Une copie exacte est gardée.' : ' ' + MOT_COPIE_RATEE) : '');
    /* LE LIEN APRES L'ENVOI : il ne vaut que pour la copie figee. Copie ratee, pas de lien. */
    if (avecLien && r.papier_empreinte) {
      if (await creerLien(motE)) {
        if (moi !== S) return;
        /* N2 : l'avis ne redit pas tout (le bloc du lien porte la date et la relance) et il
           ne fait pas defiler : `creerLien` a deja pose le lien en tete, sous le doigt. */
        dire('Devis ' + r.numero + ' figé et noté envoyé. Une copie exacte est gardée. Ton message est prêt juste en dessous.', false, true);
        if (typeof S.ctx.change === 'function') { try { S.ctx.change(r); } catch (e) {} }
        return;
      }
      if (moi !== S) return;
      if (typeof S.ctx.change === 'function') { try { S.ctx.change(r); } catch (e) {} }
      return;
    }
    dire(motE + (avecLien && !r.papier_empreinte ? ' Sans copie exacte, pas de lien de signature.' : ''), copieE && !r.papier_empreinte);
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
    S.tva = tvaDeDevis(ancien);
    /* Une date souhaitee deja passee ne se reprend pas : le nouveau devis la refuserait. */
    if (S.liv.date && S.liv.date < jourIso()) S.liv.date = '';
    S.confirme = false; S.accord = false; S.envoi = false;
    S.etat = 'edition'; S.modifie = true; S.quitterOk = false; S.etape = 1; S.plis = null;
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
    /* LOT 55 : la punaise d'un devis signe s'en va quand sa commande est telechargee. */
    if (window.BdvAffairesJour && BdvAffairesJour.relireSignes) { try { BdvAffairesJour.relireSignes(); } catch (e) {} }
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
    /* Le logo lu avant de figer la copie : une copie sans logo ne se corrige plus. */
    if (window.BdvLogo && BdvLogo.pret) { try { await BdvLogo.pret(); } catch (e) { /* sans logo */ } }
    if (!f || !S || !S.devis) return null;
    return htmlPapier(S.devis, S.lignesServeur || [], { polices: polices(), feuilles: f, logo: logoPapier() });
  }
  /* LA COPIE GARDEE, relue a la demande (30 a 40 ko : jamais avec la liste). `verifiee` :
     true si son empreinte est retrouvee ici, false si elle ne correspond pas, null si ce
     navigateur ne sait pas la calculer. */
  async function lireCopie() {
    var d = S.devis;
    var l = await api('/devis_copies?bureau=eq.' + encodeURIComponent(bureau()) + '&devis_id=eq.'
      + encodeURIComponent(d.devis_id) + '&empreinte=eq.' + encodeURIComponent(d.papier_empreinte || '') + '&select=papier,empreinte,cree_le');
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
    if (S.voirVersion) return sourceVersion(S.voirVersion);
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
  /* LOT 67 : LA COPIE D'UNE VERSION PRECEDENTE (lot 65 : une copie par version envoyee). Elle
     se montre telle que le client l'a recue, et la note dit qu'elle ne vaut plus. */
  async function sourceVersion(n) {
    var d = S.devis, v = versionDe(d) || 1, moi = S, l = null;
    try {
      l = await api('/devis_copies?bureau=eq.' + encodeURIComponent(bureau()) + '&devis_id=eq.' + encodeURIComponent(d.devis_id)
        + '&version=eq.' + encodeURIComponent(String(n)) + '&select=papier,empreinte,cree_le');
    } catch (e) { l = null; }
    if (moi !== S) return null;
    var c = Array.isArray(l) ? l[0] : null;
    if (!c || !c.papier) return { html: '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Version ' + n + '</title><body></body></html>', copie: true, souci: true,
      note: 'La version ' + n + ' du devis ' + d.numero + ' n’a pas pu être lue : ' + (Array.isArray(l) ? 'aucune copie gardée pour elle.' : 'vérifie ta connexion et réessaie.') };
    /* Le papier MONTRE (et imprime) porte en tete qu'il ne vaut plus : la copie gardee, elle, ne
       change pas (l'empreinte n'est pas recalculee sur ce qui s'affiche). */
    var bandeau = '<p style="margin:0 0 16px;padding:8px 12px;border:2px solid #000;font:700 14px/1.4 sans-serif;color:#000;background:#fff">'
      + 'Version ' + n + ', remplacée par la version ' + v + ' : ce devis ne vaut plus.</p>';
    var html = /<body[^>]*>/i.test(c.papier) ? c.papier.replace(/<body[^>]*>/i, function (m) { return m + bandeau; }) : bandeau + c.papier;
    return { html: html, copie: true, version: n,
      note: 'Copie de la version ' + n + ' gardée le ' + dateFr(c.cree_le) + '. Empreinte numérique ' + empreinteLisible(c.empreinte) + '.' };
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
    return htmlPapier(S.devis, S.lignesServeur || [], { polices: polices(), logo: logoPapier() });
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
  /* L'APERCU : la boite est deja une modale large (voir l'en-tete), rien a defaire. */
  function entrerApercu() {
    dire('');
    S.etat = 'apercu';
    peindre();
    /* Le bouton « Voir et imprimer » vient de disparaitre : le focus va au geste de l'apercu. */
    var imp = MOD.querySelector(S.voirVersion ? '[data-dev="revenir"]' : '[data-dev="imprimer"]');
    if (imp) { try { imp.focus({ preventScroll: true }); } catch (e) { imp.focus(); } }
  }
  function sortirApercu() {}
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
    /* LOT 67 (vigneron) : devant une version qui ne vaut plus, le geste principal est d'en sortir. */
    var vieille = !!S.voirVersion;
    corps.innerHTML = '<p class="dmod__gestes dmod__apercu-g">'
      + (vieille ? '<button type="button" class="btn btn--bordeaux" data-dev="revenir">Revenir au devis</button>'
        + '<button type="button" class="btn" data-dev="imprimer">Imprimer cette ancienne version</button>'
        : '<button type="button" class="btn btn--bordeaux" data-dev="imprimer">Imprimer ou enregistrer en PDF</button>'
        + '<button type="button" class="btn" data-dev="revenir">Revenir au devis</button>') + '</p>'
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
      var f = cadre('devFeuille', 'dmod__feuille-i', 'Aperçu du devis ' + num + (src.version ? ', version ' + src.version : ''), src.copie);
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
  var LOGO_PAPIER = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
  function logoPapier() { return window.BdvLogo && BdvLogo.image ? BdvLogo.image() : null; }
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
    var avecTva = mixte(lignes);
    var lg = (lignes || []).map(function (l) {
      return '<tr><td class="dpap__vin"><b>' + esc(l.designation) + '</b>'
        + (l.millesime ? ' ' + esc(l.millesime) : '') + (l.conditionnement ? ', ' + esc(l.conditionnement) : '')
        + (l.num_produit ? '<br><span class="dpap__code">Code article ' + esc(l.num_produit) + '</span>' : '') + '</td>'
        + '<td class="dpap__n">' + esc(l.quantite) + '</td>'
        + '<td class="dpap__n">' + C.euros(l.pu_ht_c) + '</td>'
        + '<td class="dpap__n">' + (l.remise_cb ? C.pourcent(l.remise_cb) + ' %' : '') + '</td>'
        + (avecNet ? '<td class="dpap__n">' + C.euros(prixNet(l)) + '</td>' : '')
        + (avecTva ? '<td class="dpap__n">' + libTaux(l.tva_cb == null ? 2000 : l.tva_cb) + '</td>' : '')
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
      + '<style>@page{@bottom-left{content:"Devis ' + cssTexte((d.numero || '') + (versionDe(d) ? ', version ' + versionDe(d) : '')) + '";' + MARGE + '}'
      + '@bottom-right{content:"Page " counter(page) "/" counter(pages);' + MARGE + '}}</style>'
      + '</head><body class="dpap"><main class="dpap__feuille">'
      + '<header class="dpap__tete"><div class="dpap__vendeur">'
      /* LOT 69 : le logo du domaine, s'il y en a un, au-dessus de son nom. Une adresse data:
         en base64 verifiee ici ET par la base : il voyage DANS la copie gardee, jamais par
         un lien, sinon changer de logo changerait un devis deja signe. */
      + (o.logo && LOGO_PAPIER.test(o.logo) ? '<img class="dpap__logo" src="' + o.logo + '" alt="">' : '')
      + '<p class="dpap__raison">' + esc(raisonV) + forme + '</p>'
      + ligneSi(v.adresse) + ligneSi(cpVille(v))
      + ligneSi(v.siret ? 'SIRET ' + v.siret : '')
      + ligneSi(v.rcs_ville && (v.siren || v.siret) ? 'RCS ' + v.rcs_ville + ' ' + sirenFr(v.siren || String(v.siret).slice(0, 9)) : '')
      + ligneSi(v.capital_eur ? 'Capital de ' + Number(v.capital_eur).toLocaleString('fr-FR') + '\u00a0€' : '')
      + ligneSi(v.tva ? 'N° de TVA intracommunautaire ' + v.tva : '')
      + ligneSi(v.email) + ligneSi(v.telephone)
      + '</div><div class="dpap__titre"><h1 class="dpap__h1">Devis ' + esc(d.numero || '') + '</h1>'
      + (versionDe(d) ? '<p>Version ' + versionDe(d) + ', remplace la version ' + (versionDe(d) - 1) + '</p>' : '')
      + '<p>Date du devis : ' + esc(dateFr(d.date_devis)) + '</p>'
      + '<p>Devis valable jusqu’au ' + esc(dateFr(d.valable_jusqu)) + '</p></div></header>'
      + '<section class="dpap__client"><p class="dpap__etiq">Pour</p>'
      + '<p class="dpap__raison">' + esc(a.nom || '') + '</p>'
      + ligneSi(a.contact_nom ? 'À l’attention de ' + a.contact_nom : '')
      + ligneSi(a.adresse) + ligneSi(cpVille(a)) + ligneSi(a.pays && !/^france$/i.test(a.pays) ? a.pays : '')
      + ligneSi(a.siret ? 'SIRET ' + a.siret : '')
      + ligneSi(d.regime_tva === 'ue' && d.client_tva ? 'N° de TVA intracommunautaire ' + d.client_tva : '')
      + ligneSi(a.num_client ? 'N° client ' + a.num_client : '')
      + '</section>'
      /* LOT 53 : la livraison, sous le client. Un devis d'avant le lot n'a rien a dire. */
      + (livAdire(d) ? '<section class="dpap__liv"><p class="dpap__etiq">Livraison</p><p>' + esc(phraseLiv(d)) + '</p></section>' : '')
      + '<table class="dpap__table"><thead><tr><th>Vin</th><th class="dpap__n">Quantité</th><th class="dpap__n">Prix HT</th>'
      + '<th class="dpap__n">Remise</th>' + (avecNet ? '<th class="dpap__n">Prix net</th>' : '') + (avecTva ? '<th class="dpap__n">TVA</th>' : '')
      + '<th class="dpap__n">Total HT</th></tr></thead><tbody>' + lg + '</tbody></table>'
      + '<div class="dpap__fin"><section class="dpap__totaux">'
      + '<p><span>Total des vins HT</span><span>' + C.euros(d.total_vins_c) + '</span></p>'
      + (g > 0 ? '<p><span>' + libelleRemise(g) + ' :</span><span>-' + C.euros(d.remise_globale_c) + '</span></p>'
        + '<p class="dpap__x">' + EXPLICATION_REMISE + '</p>' : '')
      + (Number(d.port_c) > 0 ? '<p><span>Frais de port HT</span><span>' + C.euros(d.port_c) + '</span></p>' : '')
      + '<p><span>Total HT</span><span>' + C.euros(d.total_ht_c) + '</span></p>'
      + lignesTva({ tva: d.tva_c, taux: d.regime_tva ? tauxDuDevis(d, lignes) : null }, d.regime_tva, '')
      + '<p class="dpap__ttc"><span>Total TTC</span><span>' + C.euros(d.total_ttc_c) + '</span></p>'
      + '</section>'
      + '<section class="dpap__mentions">'
      + (d.regime_tva === 'export' ? '<p>' + MENTION_EXPORT + '</p>' : d.regime_tva === 'ue' ? '<p>' + MENTION_UE + '</p>' : '')
      + '<p>' + phraseAccises(d) + '</p>'
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

  /* FIGER AU DEPART DU MAIL (Ted, 08/10/2026), sans ouvrir le devis : relit le devis et ses
     lignes, refuse ce qui ne se signerait pas, range la copie exacte, note envoye aujourd'hui
     (sans rappel : c'est le mail qui pose la relance), puis cree le lien. Un refus rend
     `{ mot }`, rien ne part. Ne touche pas a `S` : le devis peut etre ferme. */
  async function figerPourMail(o) {
    var b = o && o.bureau, id = o && o.devis_id;
    function non(m) { var e = new Error(m); e.mot = m; return e; }
    if (!b || !id) throw non('Le devis n’a pas pu se figer.');
    var dl = await api('/devis?bureau=eq.' + encodeURIComponent(b) + '&devis_id=eq.' + encodeURIComponent(id) + '&select=*');
    var d = unSeul(dl);
    if (!d) throw non('Le devis n’a pas pu être relu.');
    if (d.statut !== 'enregistre') throw non('Ce devis est déjà parti ou fermé : ouvre-le pour voir où il en est.');
    if (!Object.prototype.hasOwnProperty.call(d, 'papier_empreinte')) throw non('La signature en ligne n’est pas encore en place dans ton bureau.');
    if (d.valable_jusqu && String(d.valable_jusqu) < jourIso()) throw non('Ce devis n’est plus valable : refais-le avant de l’envoyer.');
    var l = await api('/devis_lignes?bureau=eq.' + encodeURIComponent(b) + '&devis_id=eq.' + encodeURIComponent(id) + '&order=rang');
    if (!Array.isArray(l)) throw non('Les lignes du devis n’ont pas pu être relues.');
    var m = window.BdvCommande ? BdvCommande.manques(d, l) : [];
    if (m.length) throw non('Ce devis ne peut pas se signer en ligne : ' + phraseManques(m));
    var f = await feuillesPapier();
    if (window.BdvLogo && BdvLogo.pret) { try { await BdvLogo.pret(); } catch (e) {} }
    if (!f) throw non('La copie exacte du devis n’a pas pu se préparer. Réessaie.');
    var papier = htmlPapier(d, l, { polices: polices(), feuilles: f, logo: logoPapier() });
    var r = unSeul(await rpc('devis_envoyer', { p_bureau: b, p_devis: id, p_jour: jourIso(), p_rappel: null, p_rappel_titre: null, p_etape: o.etape || null, p_papier: papier }));
    if (!r || r.statut !== 'envoye' || !r.papier_empreinte) throw non('Le devis n’a pas pu se figer avec sa copie exacte.');
    var j = await rpc('devis_lien_creer', { p_bureau: b, p_devis: id });
    var jeton = typeof j === 'string' ? j : (Array.isArray(j) ? j[0] : j);
    if (typeof jeton !== 'string' || !/^[0-9a-f]{64}$/.test(jeton)) throw non('Le devis est figé, mais son lien de signature n’a pas pu se créer : ouvre-le pour le créer.');
    return { devis: r, jeton: jeton, url: urlDuLien(jeton) };
  }
  window.BdvDevis = { ouvrir: ouvrir, figerPourMail: figerPourMail, fermer: fermer, htmlPapier: htmlPapier, surRetour: surRetour,
                      _S: function () { return S; }, _cle: CLE_BROUILLON };
})();
