/* ================================================================
   LE BUREAU DU VIGNERON, la fiche du domaine
   ----------------------------------------------------------------
   Ecrit le 28/09/2026, lot 38. Voir CLAUDE.md, « LA FICHE DU DOMAINE ».

   Ce qu'un devis doit porter et qui n'etait stocke nulle part : qui vend. Une ligne
   par bureau (table `domaine`), commune a tous ses membres, et deux reglages que Ted
   laisse au vigneron : les conditions de paiement et la validite d'un devis.

   LA RECHERCHE PASSE PAR L'API RECHERCHE D'ENTREPRISES (DINUM), demande de Ted.
   Gratuite, sans cle, 7 appels par seconde (data.gouv.fr, verifie le 28/09/2026).
   Le navigateur l'appelle directement, et C'EST LE VIGNERON QUI CHOISIT sa ligne puis
   relit les champs avant d'enregistrer : l'API trouve, elle ne decide pas.
   Si elle ne repond pas, rien ne bloque : tout se tape a la main.

   LE NUMERO DE TVA N'EST JAMAIS CALCULE. Il se deduit du SIREN par une formule, mais un
   domaine au regime de la franchise n'en a pas : en fabriquer un l'imprimerait sur un
   devis. On prend celui que l'API rend, sinon le champ reste vide.

   Ce module contribue un bloc au panneau des reglages (BdvReglages.brancher) et expose
   la fiche au futur devis. Aucune donnee du vigneron ne passe par une chaine HTML.
   ================================================================ */
(function () {
  'use strict';

  var API = 'https://recherche-entreprises.api.gouv.fr/search';
  var FICHE = null;       // la ligne lue, ou null
  var LU = false;         // la lecture a-t-elle abouti une fois
  var ABSENTE = false;    // la table manque (SQL du lot 38 pas passe), distinct d'une panne
  var TOUCHE = false;     // le vigneron a-t-il modifie quelque chose
  var TROUVES = [];       // les resultats de la derniere recherche
  /* LOT 51 : les deux mentions (RCS, capital) n'existent qu'apres le SQL du lot 51. On
     ne les ECRIT que si la base les a montrees, sinon tout l'enregistrement serait
     refuse pour deux colonnes pas encore creees (regle « le navigateur marche avant le
     SQL »). `null` = on ne sait pas encore, et on ne les montre pas. */
  var MENTIONS = null;

  /* LE PLAFOND LEGAL, ecrit une fois. Boissons alcooliques soumises aux droits
     d'accises : 30 jours apres la fin du mois de livraison au plus (Code de commerce,
     L441-11 ; economie.gouv.fr). La base refuse aussi au-dela : ceci n'est que l'ecran. */
  var JOURS_MAX = 30;

  function el(id) { return document.getElementById(id); }
  function bureau() { return window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau(); }
  function net(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function chiffres(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

  /* ---------------- LA LECTURE ET L'ECRITURE ---------------- */
  async function charger() {
    var b = bureau();
    if (!b || !window.BdvCompte) return null;
    try {
      var l = await BdvCompte.api('/domaine?select=*&bureau=eq.' + encodeURIComponent(b));
      FICHE = (Array.isArray(l) && l[0]) || null;
      if (FICHE) MENTIONS = Object.prototype.hasOwnProperty.call(FICHE, 'rcs_ville');
      else if (Array.isArray(l)) MENTIONS = await sonderMentions(b);
      /* Un retour vide (pas de session) n'est pas une lecture : le devis doit savoir
         dire « je n'arrive pas a lire » plutot que « il manque des infos » (lot 47). */
      LU = Array.isArray(l);
      ABSENTE = false;
      return FICHE;
    } catch (e) {
      /* LE LOT 38 N'EST PEUT-ETRE PAS PASSE : la table n'existe pas encore. On le dit
         dans le bloc au lieu de laisser croire que la fiche est vide. */
      LU = false;
      ABSENTE = !!e && (e.status === 404 || /PGRST|42P01/.test(String(e.detail || '')));
      return null;
    }
  }

  /* Sans fiche, `select=*` ne dit rien des colonnes : on demande la colonne elle-meme. Une
     colonne inconnue rend une erreur, c'est la reponse. */
  async function sonderMentions(b) {
    try { await BdvCompte.api('/domaine?select=rcs_ville,capital_eur&limit=1&bureau=eq.' + encodeURIComponent(b)); return true; }
    catch (e) { return false; }
  }
  function capitalDe(s) { var c = chiffres(s); return c ? Number(c) : null; }

  function lireChamps() {
    var mode = el('bdvdPaiement') ? el('bdvdPaiement').value : 'fdm';
    var jours = parseInt(el('bdvdJours') ? el('bdvdJours').value : '', 10);
    var val = parseInt(el('bdvdValidite') ? el('bdvdValidite').value : '', 10);
    return {
      raison_sociale: net(el('bdvdRaison').value) || null,
      forme_juridique: net(el('bdvdForme').value) || null,
      siret: chiffres(el('bdvdSiret').value) || null,
      tva: net(el('bdvdTva').value).toUpperCase().replace(/\s/g, '') || null,
      adresse: net(el('bdvdAdresse').value) || null,
      code_postal: net(el('bdvdCp').value) || null,
      ville: net(el('bdvdVille').value) || null,
      email: net(el('bdvdEmail').value) || null,
      telephone: net(el('bdvdTel').value) || null,
      rcs_ville: el('bdvdRcs') ? (net(el('bdvdRcs').value) || null) : null,
      capital_eur: el('bdvdCapital') ? capitalDe(el('bdvdCapital').value) : null,
      paiement_mode: mode,
      paiement_jours: mode === 'reception' ? null : (isNaN(jours) ? null : jours),
      validite_jours: isNaN(val) ? null : val
    };
  }

  /* Ce que la base refuserait, dit AVANT d'envoyer et dans les mots du vigneron. */
  function defauts(f) {
    var d = [];
    if (f.siret && !/^\d{14}$/.test(f.siret)) d.push('Le SIRET compte 14 chiffres.');
    if (f.tva && !/^FR[0-9A-Z]{2}\d{9}$/.test(f.tva)) d.push('Le numéro de TVA commence par FR, suivi de 11 caractères.');
    if (f.tva && f.siret && f.tva.slice(4) !== f.siret.slice(0, 9)) d.push('Le numéro de TVA ne correspond pas au SIRET.');
    if (f.paiement_mode !== 'reception') {
      if (!f.paiement_jours || f.paiement_jours < 1) d.push('Indique le nombre de jours de paiement.');
      else if (f.paiement_jours > JOURS_MAX) d.push('Pour le vin, la loi plafonne à 30 jours fin de mois.');
    }
    if (!f.validite_jours || f.validite_jours < 1 || f.validite_jours > 365) d.push('La validité d’un devis va de 1 à 365 jours.');
    if (f.capital_eur !== null && f.capital_eur !== undefined && !(f.capital_eur >= 1 && f.capital_eur <= 999999999999)) d.push('Le capital social s’écrit en euros, sans centimes.');
    if (f.rcs_ville && f.rcs_ville.length > 80) d.push('La ville du greffe tient en 80 caractères.');
    return d;
  }

  async function enregistrer() {
    if (!TOUCHE || !el('bdvdRaison')) return;
    var b = bureau();
    if (!b) throw new Error('sans bureau');
    var f = lireChamps();
    var d = defauts(f);
    if (d.length) { dire(d.join(' '), true); throw new Error('fiche invalide'); }
    f.bureau = b;
    f.siren = f.siret ? f.siret.slice(0, 9) : null;
    if (!MENTIONS) { delete f.rcs_ville; delete f.capital_eur; }
    var l = await BdvCompte.api('/domaine?on_conflict=bureau', {
      methode: 'POST', corps: f,
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=representation' }
    });
    /* Une ecriture qui ne rend aucune ligne n'a rien ecrit (regle du lot 34). */
    if (!Array.isArray(l) || !l.length) { dire('La fiche n’a pas été enregistrée. Réessaie.', true); throw new Error('rien ecrit'); }
    FICHE = l[0]; TOUCHE = false;
    dire('Fiche du domaine enregistrée.');
  }

  /* ---------------- LA RECHERCHE ---------------- */
  function adresseDe(s) {
    if (!s) return '';
    return net([s.numero_voie, s.indice_repetition, s.type_voie, s.libelle_voie].filter(Boolean).join(' '))
      + (s.complement_adresse ? ', ' + net(s.complement_adresse) : '');
  }
  /* LA FORME JURIDIQUE SE LIT DANS LE NOM, et seulement la. L'annuaire la rend sous
     forme de code INSEE (`nature_juridique`) ; traduire ce code demanderait une table
     de plusieurs centaines de lignes a tenir a jour. Le nom, lui, porte souvent le
     sigle en tete (« EARL DOMAINE... »). Sigle reconnu : on le propose ; sinon vide. */
  var FORMES = ['EARL', 'SCEA', 'GAEC', 'SCA', 'SCI', 'SARL', 'SAS', 'SASU', 'EURL', 'SA', 'SNC', 'GFA', 'SCV'];
  function formeDe(nom) {
    var m = /^([A-Z]{2,5})\b/.exec(net(nom).toUpperCase());
    return (m && FORMES.indexOf(m[1]) >= 0) ? m[1] : '';
  }
  function lire(r) {
    var s = r.siege || {};
    return {
      nom: net(r.nom_complet || r.nom_raison_sociale),
      forme: formeDe(r.nom_complet || r.nom_raison_sociale),
      siret: chiffres(s.siret),
      adresse: adresseDe(s),
      code_postal: net(s.code_postal),
      ville: net(s.libelle_commune),
      tva: (Array.isArray(r.tva) && r.tva[0]) ? String(r.tva[0]) : '',
      actif: r.etat_administratif === 'A'
    };
  }
  async function chercher(q) {
    q = net(q);
    if (q.length < 3) return { ok: false, mot: 'Tape au moins trois caractères, ou ton SIRET.' };
    var brut = chiffres(q);
    var terme = (brut.length === 9 || brut.length === 14) && brut.length === q.replace(/\s/g, '').length ? brut : q;
    try {
      var r = await fetch(API + '?q=' + encodeURIComponent(terme) + '&per_page=5', { headers: { Accept: 'application/json' } });
      if (r.status === 429) return { ok: false, mot: 'Le service est très sollicité. Réessaie dans une seconde.' };
      if (!r.ok) return { ok: false, mot: 'Le service ne répond pas. Tu peux remplir la fiche à la main.' };
      var j = await r.json();
      /* Les entreprises ouvertes d'abord : une fermee choisie par megarde imprimerait un
         SIRET mort en tete de chaque devis (vigneron empathique, 28/09/2026). */
      var l = (j && j.results || []).map(lire).filter(function (x) { return x.siret; })
        .sort(function (a, b) { return (a.actif ? 0 : 1) - (b.actif ? 0 : 1); });
      return { ok: true, liste: l };
    } catch (e) {
      return { ok: false, mot: 'Le service ne répond pas. Tu peux remplir la fiche à la main.' };
    }
  }

  /* ---------------- L'ECRAN ---------------- */
  function dire(m, alerte) {
    var p = el('bdvdMot');
    if (!p) return;
    p.textContent = m || '';
    p.classList.toggle('bdvr-aide--alerte', !!alerte);
  }
  function champ(parent, id, libelle, opts) {
    opts = opts || {};
    var c = document.createElement('div');
    c.className = 'bdvr-champ' + (opts.plein ? ' bdvr-champ--plein' : '');
    var l = document.createElement('label');
    l.className = 'bdvr-l'; l.htmlFor = id; l.textContent = libelle;
    var i = document.createElement(opts.select ? 'select' : 'input');
    i.className = 'bdvr-i'; i.id = id;
    if (!opts.select) i.type = opts.type || 'text';
    if (opts.mode) i.inputMode = opts.mode;
    if (opts.auto) i.autocomplete = opts.auto;
    if (opts.min != null) i.min = opts.min;
    if (opts.max != null) i.max = opts.max;
    (opts.options || []).forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; i.appendChild(op);
    });
    c.appendChild(l); c.appendChild(i);
    if (opts.aide) {
      var a = document.createElement('p'); a.className = 'bdvr-aide'; a.textContent = opts.aide; c.appendChild(a);
    }
    parent.appendChild(c);
    return i;
  }

  function sousTitre(parent, texte) {
    var h = document.createElement('h3');
    h.className = 'bdvd-sous';
    h.textContent = texte;
    parent.appendChild(h);
  }

  function monter(cible) {
    cible.textContent = '';
    var intro = document.createElement('p');
    intro.className = 'bdvr-aide';
    intro.textContent = 'Ce qui s’imprime en tête de tes devis. Une seule fiche pour tout ton bureau.';
    cible.appendChild(intro);

    /* La recherche d'abord : c'est elle qui evite de taper. */
    var g0 = document.createElement('div'); g0.className = 'bdvr-grille bdvd-cherche';
    var q = champ(g0, 'bdvdQ', 'Retrouver mon domaine', { plein: true,
      aide: 'Ton SIRET, ton SIREN ou le nom de ton domaine. La recherche passe par l’annuaire officiel des entreprises.' });
    var bc = document.createElement('button');
    bc.type = 'button'; bc.className = 'bdvr-btn'; bc.id = 'bdvdChercher'; bc.textContent = 'Chercher';
    g0.appendChild(bc);
    cible.appendChild(g0);
    /* LE MOT EST SOUS LA RECHERCHE, pas en bas du bloc : c'est la qu'on regarde apres
       avoir clique « Chercher ». En bas, il tombait sous la validite des devis, a un
       ecran de distance du geste (capture du 28/09/2026 a 390 px). */
    var mot = document.createElement('p');
    mot.className = 'bdvr-aide'; mot.id = 'bdvdMot'; mot.setAttribute('role', 'status');
    cible.appendChild(mot);
    var res = document.createElement('ul'); res.className = 'bdvd-res'; res.id = 'bdvdRes';
    cible.appendChild(res);

    sousTitre(cible, 'Ce qui s’imprime en tête');
    var g = document.createElement('div'); g.className = 'bdvr-grille';
    champ(g, 'bdvdRaison', 'Raison sociale', { plein: true, auto: 'organization' });
    champ(g, 'bdvdForme', 'Forme juridique', { aide: 'EARL, SCEA, GAEC, SARL… Laisse vide si tu ne sais pas.' });
    champ(g, 'bdvdSiret', 'SIRET', { mode: 'numeric' });
    champ(g, 'bdvdTva', 'N° de TVA intracommunautaire', { aide: 'Vide si ton domaine n’en a pas.' });
    champ(g, 'bdvdAdresse', 'Adresse', { plein: true, auto: 'street-address' });
    champ(g, 'bdvdCp', 'Code postal', { mode: 'numeric', auto: 'postal-code' });
    champ(g, 'bdvdVille', 'Ville', { auto: 'address-level2' });
    champ(g, 'bdvdEmail', 'E-mail du domaine', { type: 'email', auto: 'email' });
    champ(g, 'bdvdTel', 'Téléphone du domaine', { type: 'tel', auto: 'tel' });
    cible.appendChild(g);

    /* LOT 51 : les mentions de l'immatriculation (Code de commerce, R123-237) et le capital
       (SARL et societes par actions). Facultatives : un exploitant en nom propre n'est pas au
       RCS. Le bloc n'existe que si la base les connait. */
    var gm = document.createElement('div'); gm.className = 'bdvr-grille'; gm.id = 'bdvdMentions'; gm.hidden = true;
    champ(gm, 'bdvdRcs', 'Ville du greffe (RCS)', { auto: 'off',
      aide: 'Si ton domaine est immatriculé au RCS : la ville du greffe, imprimée « RCS Nantes » avec ton SIREN. Vide sinon.' });
    champ(gm, 'bdvdCapital', 'Capital social, en euros', { mode: 'numeric',
      aide: 'Obligatoire sur tes devis pour une SARL ou une SAS. Vide sinon.' });
    cible.appendChild(gm);

    sousTitre(cible, 'Tes conditions');
    var g2 = document.createElement('div'); g2.className = 'bdvr-grille';
    champ(g2, 'bdvdPaiement', 'Paiement', { select: true, options: [
      ['fdm', 'Jours fin de mois'], ['nets', 'Jours nets'], ['reception', 'À réception de facture']] });
    champ(g2, 'bdvdJours', 'Nombre de jours', { type: 'number', mode: 'numeric', min: 1, max: JOURS_MAX,
      aide: 'Pour le vin, la loi plafonne à 30 jours fin de mois.' });
    champ(g2, 'bdvdValidite', 'Validité d’un devis, en jours', { type: 'number', mode: 'numeric', min: 1, max: 365,
      aide: 'Passé ce délai, le client ne pourra plus le signer.' });
    cible.appendChild(g2);

    bc.addEventListener('click', lancer);
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); lancer(); } });
    res.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-bdvd-choisir]');
      if (!b) return;
      e.preventDefault();
      choisir(TROUVES[parseInt(b.getAttribute('data-bdvd-choisir'), 10)]);
    });
    cible.addEventListener('input', function (e) { if (e.target && e.target.id !== 'bdvdQ') TOUCHE = true; peindreJours(); });
    cible.addEventListener('change', function (e) { if (e.target && e.target.id !== 'bdvdQ') TOUCHE = true; peindreJours(); });
    peindre();
  }

  async function lancer() {
    var q = el('bdvdQ'); if (!q) return;
    dire('Recherche…');
    var r = await chercher(q.value);
    var ul = el('bdvdRes'); ul.textContent = '';
    if (!r.ok) { dire(r.mot, true); return; }
    TROUVES = r.liste;
    if (!TROUVES.length) { dire('Aucune entreprise trouvée. Vérifie le numéro, ou remplis la fiche à la main.', true); return; }
    dire(TROUVES.length === 1 ? 'Une entreprise trouvée. Vérifie que c’est la tienne.' : TROUVES.length + ' entreprises trouvées. Choisis la tienne.');
    TROUVES.forEach(function (x, i) {
      var li = document.createElement('li'); li.className = 'bdvd-ligne';
      var t = document.createElement('span'); t.className = 'bdvd-nom';
      t.textContent = (x.actif ? '' : 'Fermée · ') + x.nom;
      var s = document.createElement('span'); s.className = 'bdvd-detail';
      s.textContent = [x.code_postal + ' ' + x.ville, 'SIRET ' + x.siret].filter(function (v) { return net(v); }).join(' · ');
      /* Une fermee garde son bouton (un domaine repris garde parfois l'ancien nom), mais
         CREUX : le bouton plein ne va qu'a ce qui est ouvert. */
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'bdvr-btn' + (x.actif ? '' : ' bdvr-btn--creux');
      b.setAttribute('data-bdvd-choisir', String(i));
      b.textContent = x.actif ? 'C’est mon domaine' : 'La choisir quand même';
      li.appendChild(t); li.appendChild(s); li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function choisir(x) {
    if (!x) return;
    el('bdvdRaison').value = x.nom;
    if (x.forme) el('bdvdForme').value = x.forme;
    el('bdvdSiret').value = x.siret;
    el('bdvdTva').value = x.tva;
    el('bdvdAdresse').value = x.adresse;
    el('bdvdCp').value = x.code_postal;
    el('bdvdVille').value = x.ville;
    TOUCHE = true;
    el('bdvdRes').textContent = '';
    if (!x.actif) { dire('Attention : l’annuaire dit que cette entreprise est fermée. Vérifie avant d’enregistrer.', true); return; }
    dire(x.tva ? 'Fiche remplie. Relis-la, complète-la, puis enregistre.'
      : 'Fiche remplie, sans numéro de TVA : l’annuaire n’en donne pas. Ajoute-le si ton domaine en a un.');
  }

  function peindreJours() {
    var m = el('bdvdPaiement'), j = el('bdvdJours');
    if (!m || !j) return;
    j.disabled = m.value === 'reception';
  }

  function peindre() {
    if (!el('bdvdRaison')) return;
    var f = FICHE || {};
    el('bdvdRaison').value = f.raison_sociale || '';
    el('bdvdForme').value = f.forme_juridique || '';
    el('bdvdSiret').value = f.siret || '';
    el('bdvdTva').value = f.tva || '';
    el('bdvdAdresse').value = f.adresse || '';
    el('bdvdCp').value = f.code_postal || '';
    el('bdvdVille').value = f.ville || '';
    el('bdvdEmail').value = f.email || '';
    el('bdvdTel').value = f.telephone || '';
    if (el('bdvdMentions')) {
      el('bdvdMentions').hidden = !MENTIONS;
      el('bdvdRcs').value = f.rcs_ville || '';
      el('bdvdCapital').value = f.capital_eur ? String(f.capital_eur) : '';
    }
    el('bdvdPaiement').value = f.paiement_mode || 'fdm';
    el('bdvdJours').value = f.paiement_mode === 'reception' ? '' : String(f.paiement_jours || 30);
    el('bdvdValidite').value = String(f.validite_jours || 30);
    peindreJours();
    TOUCHE = false;
  }

  async function rafraichir() {
    await charger();
    /* Table absente et coupure reseau ne se disent pas pareil (lot 47, contre-verification). */
    if (!LU && el('bdvdMot')) dire(ABSENTE ? 'La fiche du domaine n’est pas encore disponible sur ton compte.'
      : 'Je n’arrive pas à lire la fiche de ton domaine. Vérifie ta connexion.', true);
    if (!TOUCHE) peindre();
  }

  /* ---------------- CE QUE LE DEVIS LIRA ---------------- */
  function complete(f) {
    f = f || FICHE;
    return !!(f && f.raison_sociale && f.siret && f.adresse && f.code_postal && f.ville);
  }
  function conditions(f) {
    f = f || FICHE || {};
    if (f.paiement_mode === 'reception') return 'Paiement à réception de facture';
    var n = f.paiement_jours || 30;
    return 'Paiement à ' + n + ' jours ' + (f.paiement_mode === 'nets' ? 'nets' : 'fin de mois');
  }

  function brancher() {
    if (!window.BdvReglages || !BdvReglages.brancher) return false;
    BdvReglages.brancher({ blocs: [{ hote: 'domaine', monter: monter, rafraichir: rafraichir, enregistrer: enregistrer }] });
    return true;
  }
  if (!brancher()) document.addEventListener('DOMContentLoaded', brancher);

  window.BdvDomaine = { charger: charger, fiche: function () { return FICHE; }, lue: function () { return LU; }, complete: complete,
                        conditions: conditions, chercher: chercher, mentions: function () { return MENTIONS; },
                        _lire: lire, _defauts: defauts };
})();
