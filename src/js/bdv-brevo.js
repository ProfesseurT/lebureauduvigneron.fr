/* ================================================================
   LE BUREAU DU VIGNERON, brancher Brevo (lot 87, 08/10/2026)
   ----------------------------------------------------------------
   Voir CLAUDE.md « BREVO ». Dans l'onglet « Mes envois », sous « D'ou partent tes mails » :
     - le MAITRE colle la cle API Brevo du domaine, une fois pour tout le bureau, et choisit ce
       qui part par Brevo par defaut (mails d'affaire et de fiche, devis et commandes, mails
       programmes) ;
     - CHAQUE PERSONNE choisit son adresse d'expediteur parmi celles que Brevo a validees, et
       peut faire passer SES mails par sa boite au lieu de Brevo.
   La cle ne vit qu'en memoire de cette page, le temps de l'essai, et part a la fonction Edge
   `brevo` qui la range dans Vault. Elle n'est jamais relue.
   LOT 87 N'ENVOIE RIEN PAR BREVO : l'ecran le dit. L'envoi arrive au lot 88, qui lira
   `BdvBrevo.passe(sorte)`.
   ================================================================ */
(function () {
  'use strict';

  var BREVO = null;          // la ligne `brevo` du bureau, ou null
  var CHOIX = null;          // ma ligne `brevo_choix`, ou null
  var LU = false, ABSENTE = false, MAITRE = false;
  var EXP = null;            // les expediteurs lus chez Brevo, ou null
  var EXP_MOT = '';          // ce qu'il faut dire si la liste n'a pas pu etre lue
  var EN_COURS = false;
  var CONFIRMER = false;

  /* Les trois sortes de mails, dans l'ordre de l'ecran. La cle sert a `passe()`. */
  var SORTES = [
    ['affaires', 'defaut_affaires', 'Les mails écrits depuis une affaire ou une fiche client'],
    ['devis', 'defaut_devis', 'Les devis et les commandes'],
    ['programmes', 'defaut_programmes', 'Les mails programmés']
  ];

  function el(id) { return document.getElementById(id); }
  function bureau() { return window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau(); }
  function mk(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function dateCourte(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  async function charger() {
    var b = bureau();
    if (!b || !window.BdvCompte) return;
    try {
      var l = await BdvCompte.api('/brevo?select=etat,compte_email,compte_nom,cle_fin,defaut_affaires,defaut_devis,defaut_programmes,branche_le,verifie_le,erreur&bureau=eq.' + encodeURIComponent(b));
      BREVO = (Array.isArray(l) && l[0]) || null;
      var moi = BdvCompte.monId && BdvCompte.monId();
      var c = await BdvCompte.api('/brevo_choix?select=chemin,expediteur,expediteur_nom&bureau=eq.' + encodeURIComponent(b)
        + (moi ? '&personne=eq.' + encodeURIComponent(moi) : ''));
      CHOIX = (Array.isArray(c) && c[0]) || null;
      LU = true; ABSENTE = false;
    } catch (e) {
      LU = false;
      ABSENTE = !!e && (e.status === 404 || /PGRST|42P01/.test(String(e.detail || e.message || '')));
    }
    try { MAITRE = await BdvCompte.api('/rpc/est_maitre', { methode: 'POST', corps: { b: b } }) === true; }
    catch (e) { MAITRE = false; }
    try { document.dispatchEvent(new CustomEvent('bdv:brevo')); } catch (e) {}
  }

  async function lireExpediteurs() {
    if (!BREVO || !bureau()) return;
    EXP_MOT = 'Lecture de tes adresses chez Brevo…';
    peindreExp();
    var r = null;
    try { r = await BdvCompte.fonction('brevo', { action: 'expediteurs', bureau: bureau() }); }
    catch (e) { r = { resultat: 'erreur', mot: e && e.status === 503 ? 'Brevo n’est pas encore en place sur ce bureau.' : 'La liste de tes adresses n’a pas pu être lue. Réessaie.' }; }
    if (r && r.resultat === 'ok') { EXP = Array.isArray(r.expediteurs) ? r.expediteurs : []; EXP_MOT = ''; }
    else {
      EXP = null;
      EXP_MOT = (r && r.mot) || 'La liste de tes adresses n’a pas pu être lue. Réessaie.';
      if (r && (r.resultat === 'refusee' || r.resultat === 'ip') && BREVO) { BREVO.etat = 'refusee'; BREVO.erreur = r.mot; peindre(); return; }
    }
    peindreExp();
  }

  function dire(t, alerte) {
    var p = el('bdvvMot'); if (!p) return;
    p.textContent = t || '';
    p.className = 'bdvr-aide' + (alerte ? ' bdvr-aide--alerte' : '');
    p.hidden = !t;
    if (t && typeof p.scrollIntoView === 'function') { try { p.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }
  }

  function champ(parent, id, libelle, o) {
    o = o || {};
    var c = mk('div', 'bdvr-champ bdvr-champ--plein');
    var l = mk('label', 'bdvr-l', libelle); l.htmlFor = id;
    var i = mk(o.tag || 'input', 'bdvr-i'); i.id = id;
    if (!o.tag) { i.type = o.type || 'text'; if (o.auto) i.autocomplete = o.auto; }
    c.appendChild(l); c.appendChild(i);
    if (o.aide) { var a = mk('p', 'bdvr-aide', o.aide); a.id = id + 'Aide'; i.setAttribute('aria-describedby', a.id); c.appendChild(a); }
    parent.appendChild(c);
    return i;
  }

  /* ---------------- L'ECRAN ---------------- */
  function monter(cible) {
    var z = mk('section', 'bdvb bdvv'); z.id = 'bdvvZone'; z.setAttribute('aria-labelledby', 'bdvvTitre');
    var t = mk('h3', 'bdvd-sous', 'Brevo'); t.id = 'bdvvTitre';
    z.appendChild(t);
    var abs = mk('p', 'bdvr-aide bdvr-aide--alerte', 'Brevo n’est pas encore disponible sur ce bureau.');
    abs.id = 'bdvvAbsente'; abs.hidden = true; z.appendChild(abs);
    var corps = mk('div', 'bdvb-corps'); corps.id = 'bdvvCorps'; z.appendChild(corps);
    var mot = mk('p', 'bdvr-aide'); mot.id = 'bdvvMot'; mot.setAttribute('role', 'status'); mot.hidden = true;
    z.appendChild(mot);
    /* Apres « D'ou partent tes mails » : Brevo est l'autre chemin. */
    var apres = el('bdvbZone');
    if (apres && apres.parentNode === cible) cible.insertBefore(z, apres.nextSibling); else cible.appendChild(z);
    z.addEventListener('click', surClic);
    z.addEventListener('change', surChange);
    peindre();
    charger().then(function () { peindre(); if (BREVO && EXP == null) lireExpediteurs(); });
  }

  function peindre() {
    if (!el('bdvvZone')) return;
    el('bdvvAbsente').hidden = !ABSENTE;
    var c = el('bdvvCorps');
    c.hidden = ABSENTE;
    c.textContent = '';
    if (ABSENTE || !LU) return;
    var b = BREVO;
    if (!b) {
      c.appendChild(mk('p', 'bdvr-aide', 'Avec la clé API de ton compte Brevo, le bureau pourra envoyer tes mails, tes listes de clients et tes SMS par Brevo. Pour l’instant, rien ne part encore par Brevo : tes mails partent comme avant.'));
      if (MAITRE) peindreCle(c, false);
      else c.appendChild(mk('p', 'bdvr-aide', 'Le maître du bureau peut brancher le compte Brevo du domaine dans cet onglet.'));
      return;
    }
    var carte = mk('div', 'bdvb-carte');
    var qui = b.compte_nom || b.compte_email || 'ton compte';
    var fin = b.cle_fin ? ' (clé terminée par ' + b.cle_fin + ')' : '';
    if (b.etat === 'refusee') {
      /* Pas de coche : une cle refusee n'est plus « branchee ». */
      carte.appendChild(mk('p', 'bdvr-aide bdvr-aide--alerte', (b.erreur || 'Brevo refuse cette clé : crée une nouvelle clé API dans Brevo.')
        + ' Compte : ' + qui + (b.cle_fin ? ', clé terminée par ' + b.cle_fin : '') + '.' + (MAITRE ? '' : ' Préviens le maître du bureau.')));
      carte.appendChild(mk('p', 'bdvr-aide', 'Rien ne part par Brevo tant que la clé n’est pas remplacée.'));
      c.appendChild(carte);
      if (MAITRE) peindreCle(c, true);
    } else {
      carte.appendChild(mk('p', 'bdvb-ok', 'Brevo est branché sur ' + qui + fin
        + (b.branche_le ? ', depuis le ' + dateCourte(b.branche_le) : '') + '.'));
      /* Aussi visible que l'etat : sans elle, les reglages au-dessous se lisent comme deja actifs (vigneron, lot 87). */
      carte.appendChild(mk('p', 'bdvb-sous', 'Rien ne part encore par Brevo : tes mails partent comme avant. L’envoi par Brevo arrive bientôt.'));
      c.appendChild(carte);
    }

    /* Ce qui part par Brevo pour tout le bureau. */
    var rg = mk('div', 'bdvb-reglages');
    rg.appendChild(mk('p', 'bdvb-sous', 'Ce qui partira par Brevo, pour tout le bureau'));
    if (MAITRE) {
      SORTES.forEach(function (s) {
        var lab = mk('label', 'bdvr-chk'); var i = mk('input'); i.type = 'checkbox'; i.id = 'bdvvDefaut_' + s[0];
        i.dataset.sorte = s[0]; i.checked = b[s[1]] !== false;
        lab.appendChild(i); lab.appendChild(document.createTextNode(' ' + s[2]));
        rg.appendChild(lab);
      });
      rg.appendChild(mk('p', 'bdvr-aide', 'Chacun peut quand même faire passer ses mails par sa propre boîte, ci-dessous.'));
    } else {
      var oui = SORTES.filter(function (s) { return b[s[1]] !== false; }).map(function (s) { return s[2].toLowerCase(); });
      rg.appendChild(mk('p', 'bdvr-aide', oui.length ? 'Le maître a choisi pour Brevo : ' + oui.join(', ') + '.' : 'Le maître n’a rien mis sur Brevo pour l’instant.'));
    }
    c.appendChild(rg);

    /* Mes mails a moi. */
    var mm = mk('div', 'bdvb-reglages'); mm.id = 'bdvvMoi';
    mm.appendChild(mk('p', 'bdvb-sous', 'Par où partent tes mails'));
    var q = mk('div', 'bdvr-groupe'); q.setAttribute('role', 'radiogroup'); q.setAttribute('aria-label', 'Par où partent tes mails');
    var boite = window.BdvBoite && BdvBoite.prete && BdvBoite.prete() ? BdvBoite.adresse() : '';
    var chemin = CHOIX && CHOIX.chemin === 'boite' ? 'boite' : 'bureau';
    [['bdvvParBureau', 'bureau', 'Comme le bureau', ' : ils partiront par Brevo pour ce que le maître a coché, sinon comme avant.'],
     ['bdvvParBoite', 'boite', 'Par ma boîte', boite ? ' ' + boite + ', jamais par Brevo.' : ' : branche-la d’abord dans « D’où partent tes mails ».']].forEach(function (x) {
      var lab = mk('label', 'bdvr-chk'); var r = mk('input'); r.type = 'radio'; r.name = 'bdvvChemin'; r.id = x[0]; r.value = x[1];
      r.checked = chemin === x[1];
      if (x[1] === 'boite' && !boite && chemin !== 'boite') r.disabled = true;
      var sp = mk('span'); sp.appendChild(mk('b', null, x[2])); sp.appendChild(document.createTextNode(x[3]));
      lab.appendChild(r); lab.appendChild(document.createTextNode(' ')); lab.appendChild(sp);
      q.appendChild(lab);
    });
    mm.appendChild(q);
    var zexp = mk('div'); zexp.id = 'bdvvExpZone'; mm.appendChild(zexp);
    c.appendChild(mm);
    peindreExp();

    if (MAITRE) {
      var fin = mk('div', 'bdvb-gestes bdvb-fin');
      var rt = mk('button', 'bdvr-btn bdvr-btn--creux', 'Retirer Brevo'); rt.type = 'button'; rt.id = 'bdvvRetirer';
      fin.appendChild(rt); c.appendChild(fin);
      var cf = mk('div', 'bdvb-confirme'); cf.id = 'bdvvConfirme'; cf.hidden = !CONFIRMER;
      cf.appendChild(mk('p', null, 'Retirer Brevo efface la clé rangée, pour tout le bureau. Les mails repartiront comme avant. Pense aussi à supprimer la clé dans Brevo.'));
      var non = mk('button', 'bdvr-btn bdvr-btn--creux', 'Non, le garder'); non.type = 'button'; non.id = 'bdvvGarder';
      var ou = mk('button', 'bdvr-btn', 'Oui, retirer Brevo'); ou.type = 'button'; ou.id = 'bdvvOui';
      cf.appendChild(non); cf.appendChild(ou); c.appendChild(cf);
    }
  }

  /* Le champ de la cle et les deux reglages a faire chez Brevo (le maitre seul). */
  function peindreCle(c, remplacer) {
    var f = mk('div', 'bdvb-form'); f.id = 'bdvvForm';
    /* Trois etapes en paragraphes numerotes : une liste <ol> sortait ses numeros de la marge. */
    f.appendChild(mk('p', 'bdvr-aide', '1. Dans Brevo : SMTP et API, onglet Clés API, puis « Générer une nouvelle clé API ».'));
    f.appendChild(mk('p', 'bdvr-aide', '2. Dans Brevo, menu Sécurité puis « Adresses IP autorisées » : désactive le blocage. Sinon Brevo bloquera les envois du bureau.'));
    f.appendChild(mk('p', 'bdvr-aide', '3. Colle la clé ci-dessous.'));
    var g = mk('div', 'bdvr-grille');
    var i = champ(g, 'bdvvCle', remplacer ? 'La nouvelle clé API Brevo' : 'La clé API Brevo', { type: 'password', auto: 'off',
      aide: 'Elle ouvre tout ton compte Brevo : elle est rangée chiffrée, personne ne peut la relire, pas même toi.' });
    i.setAttribute('autocapitalize', 'off'); i.spellcheck = false;
    f.appendChild(g);
    var ge = mk('div', 'bdvb-gestes');
    var bt = mk('button', 'bdvr-btn', remplacer ? 'Remplacer la clé' : 'Brancher Brevo'); bt.type = 'button'; bt.id = 'bdvvBrancher';
    ge.appendChild(bt); f.appendChild(ge);
    c.appendChild(f);
  }

  function peindreExp() {
    var z = el('bdvvExpZone'); if (!z) return;
    z.textContent = '';
    var actuel = CHOIX && CHOIX.expediteur || '';
    if (EXP == null) {
      if (actuel) z.appendChild(mk('p', 'bdvr-aide', 'Ton adresse d’expéditeur : ' + actuel + '.'));
      if (EXP_MOT) z.appendChild(mk('p', 'bdvr-aide' + (/Lecture/.test(EXP_MOT) ? '' : ' bdvr-aide--alerte'), EXP_MOT));
      if (!/Lecture/.test(EXP_MOT)) ajouterRecharger(z);
      return;
    }
    var actifs = EXP.filter(function (x) { return x.actif; });
    var g = mk('div', 'bdvr-grille');
    var s = champ(g, 'bdvvExp', 'Ton adresse d’expéditeur chez Brevo', { tag: 'select',
      aide: 'Seules les adresses validées dans Brevo peuvent envoyer. Pour en ajouter une : dans Brevo, menu Expéditeurs.' });
    var vide = mk('option', null, actifs.length ? 'Choisis ton adresse' : 'Aucune adresse validée chez Brevo'); vide.value = '';
    s.appendChild(vide);
    EXP.forEach(function (x) {
      var o = mk('option', null, x.email + (x.nom ? ' (' + x.nom + ')' : '') + (x.actif ? '' : ', pas encore validée'));
      o.value = x.email; o.disabled = !x.actif; o.dataset.nom = x.nom || '';
      s.appendChild(o);
    });
    var connu = EXP.some(function (x) { return x.email === actuel && x.actif; });
    s.value = connu ? actuel : '';
    z.appendChild(g);
    if (actuel && !connu) z.appendChild(mk('p', 'bdvr-aide bdvr-aide--alerte', 'Ton adresse ' + actuel + ' n’est plus validée chez Brevo : choisis-en une autre.'));
    ajouterRecharger(z);
  }
  function ajouterRecharger(z) {
    var ge = mk('div', 'bdvb-gestes');
    var r = mk('button', 'bdvr-btn bdvr-btn--creux', 'Mettre à jour la liste'); r.type = 'button'; r.id = 'bdvvRelire';
    ge.appendChild(r); z.appendChild(ge);
  }

  /* ---------------- LES GESTES (ils s'enregistrent tout de suite) ---------------- */
  async function brancher() {
    var i = el('bdvvCle'); var cle = i ? String(i.value || '').trim() : '';
    if (!cle) { dire('Colle d’abord la clé API Brevo.', true); if (i) i.focus(); return; }
    if (EN_COURS) return;
    EN_COURS = true; var bt = el('bdvvBrancher'); if (bt) bt.disabled = true;
    dire('Le bureau demande à Brevo si la clé est bonne…');
    var r = null;
    try { r = await BdvCompte.fonction('brevo', { action: 'brancher', bureau: bureau(), cle: cle }); }
    catch (e) {
      r = { resultat: 'erreur', mot: e && e.status === 503 ? 'Brevo n’est pas encore en place sur ce bureau.'
        : /aucune session/.test(String(e && e.message)) ? 'Ta session a expiré : reconnecte-toi, puis recommence.'
        : (e && e.status === 403 ? 'Seul le maître du bureau branche Brevo.' : 'La clé n’a pas pu être vérifiée. Réessaie.') };
    }
    EN_COURS = false;
    if (r && r.resultat === 'branche') {
      if (i) i.value = '';
      EXP = null; EXP_MOT = '';
      await charger(); peindre();
      dire('Brevo est branché' + (r.compte_nom || r.compte_email ? ' sur ' + (r.compte_nom || r.compte_email) : '') + '. Choisis maintenant ton adresse d’expéditeur.');
      lireExpediteurs();
      return;
    }
    if (el('bdvvBrancher')) el('bdvvBrancher').disabled = false;
    dire((r && r.mot) || 'La clé n’a pas pu être vérifiée. Réessaie.', true);
  }

  async function regler(sorte, oui) {
    var corps = { p_bureau: bureau(), p_affaires: null, p_devis: null, p_programmes: null };
    corps['p_' + sorte] = !!oui;
    try {
      var r = await BdvCompte.api('/rpc/brevo_regler', { methode: 'POST', corps: corps });
      if (r !== true) throw new Error('rien');
      var s = SORTES.filter(function (x) { return x[0] === sorte; })[0];
      if (BREVO && s) BREVO[s[1]] = !!oui;
      dire('C’est enregistré pour tout le bureau.');
    } catch (e) { dire('Ce réglage n’a pas été enregistré. Réessaie.', true); await charger(); peindre(); }
  }

  async function choisir(chemin, exp, nom) {
    try {
      var r = await BdvCompte.api('/rpc/brevo_choisir', { methode: 'POST',
        corps: { p_bureau: bureau(), p_chemin: chemin, p_expediteur: exp, p_nom: nom } });
      if (r !== true) throw new Error('rien');
      CHOIX = CHOIX || { chemin: 'bureau', expediteur: null, expediteur_nom: null };
      if (chemin != null) CHOIX.chemin = chemin;
      if (exp != null) { CHOIX.expediteur = exp || null; CHOIX.expediteur_nom = nom || null; }
      dire(chemin === 'boite' ? 'Tes mails partiront par ta boîte, jamais par Brevo.'
        : chemin === 'bureau' ? 'Tes mails suivront le réglage du bureau.'
        : exp ? 'Tes mails par Brevo partiront de ' + exp + '.' : 'Ton adresse d’expéditeur est effacée.');
      try { document.dispatchEvent(new CustomEvent('bdv:brevo')); } catch (e) {}
    } catch (e) { dire('Ce choix n’a pas été enregistré. Réessaie.', true); await charger(); peindre(); }
  }

  async function retirer() {
    try {
      var r = await BdvCompte.api('/rpc/brevo_retirer', { methode: 'POST', corps: { p_bureau: bureau() } });
      if (r !== true) throw new Error('rien');
      CONFIRMER = false; EXP = null; EXP_MOT = '';
      await charger(); peindre();
      dire('Brevo est retiré : la clé est effacée. Supprime-la aussi dans Brevo, onglet Clés API.');
    } catch (e) { dire('Brevo n’a pas pu être retiré. Réessaie.', true); }
  }

  function surClic(e) {
    var t = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    if (t.id === 'bdvvBrancher') brancher();
    else if (t.id === 'bdvvRelire') lireExpediteurs();
    else if (t.id === 'bdvvRetirer') { CONFIRMER = true; var cf = el('bdvvConfirme'); if (cf) { cf.hidden = false; el('bdvvGarder').focus(); } }
    else if (t.id === 'bdvvGarder') { CONFIRMER = false; el('bdvvConfirme').hidden = true; el('bdvvRetirer').focus(); }
    else if (t.id === 'bdvvOui') retirer();
  }
  function surChange(e) {
    var t = e.target; if (!t) return;
    if (t.dataset && t.dataset.sorte) regler(t.dataset.sorte, t.checked);
    else if (t.name === 'bdvvChemin') choisir(t.value, null, null);
    else if (t.id === 'bdvvExp') {
      var o = t.options[t.selectedIndex];
      choisir(null, t.value || '', t.value && o ? (o.dataset.nom || '') : '');
    }
  }

  function rafraichir() { EXP = null; EXP_MOT = ''; return charger().then(function () { peindre(); if (BREVO) lireExpediteurs(); }); }

  function brancherBloc() {
    if (!window.BdvReglages || !BdvReglages.brancher) return false;
    BdvReglages.brancher({ blocs: [{ hote: 'envois', monter: monter, rafraichir: rafraichir }] });
    return true;
  }
  if (!brancherBloc()) document.addEventListener('DOMContentLoaded', brancherBloc);
  /* La boite branchee ou retiree change le choix « Par ma boite ». */
  document.addEventListener('bdv:boite', function () { if (el('bdvvZone') && LU) peindre(); });

  /* Le lot 88 demandera : ce mail-la part-il par Brevo pour moi ? Faux tant que rien n'est sur,
     jamais un « peut-etre » : une absence n'est pas un oui. */
  function passe(sorte) {
    var s = SORTES.filter(function (x) { return x[0] === sorte; })[0];
    return !!(s && LU && BREVO && BREVO.etat === 'branche' && BREVO[s[1]] !== false
      && !(CHOIX && CHOIX.chemin === 'boite') && CHOIX && CHOIX.expediteur);
  }
  function lireTot() { if (bureau() && !LU) charger(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lireTot); else lireTot();
  document.addEventListener('bdv:bureau', lireTot);

  window.BdvBrevo = { charger: charger, passe: passe,
    expediteur: function () { return CHOIX && CHOIX.expediteur || ''; },
    _etat: function () { return { BREVO: BREVO, CHOIX: CHOIX, LU: LU, ABSENTE: ABSENTE, MAITRE: MAITRE, EXP: EXP, EXP_MOT: EXP_MOT }; } };
})();
