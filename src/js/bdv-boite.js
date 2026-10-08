/* ================================================================
   LE BUREAU DU VIGNERON, brancher sa boite mail (lot 76, 07/10/2026)
   ----------------------------------------------------------------
   Voir CLAUDE.md « LOT 76 » et JOURNAL.md du 07/10/2026. Dans l'onglet « Mes envois »,
   sous la phrase d'etat de bdv-signature.js, la question « D'ou partent tes mails » :
     - « Ma messagerie ouvre le mail » (defaut, option A) : rien a brancher ;
     - « Le bureau envoie pour moi » (option B) : l'adresse, le fournisseur reconnu, le
       mot de passe a donner, puis « Tester et brancher ». Le bureau envoie un code a
       6 chiffres a l'adresse elle-meme ; seul ce code branche la boite.
   Le mot de passe ne vit qu'en memoire de cette page, le temps de l'essai, et part a la
   fonction Edge `boite` qui le range dans Vault. Il n'est jamais relu.
   Les gestes s'enregistrent tout de suite (comme le logo), pas par « Enregistrer ».
   LOT 76 N'ENVOIE AUCUN MAIL A UN CLIENT : l'ecran le dit. C'est le lot 77.
   ================================================================ */
(function () {
  'use strict';

  var BOITE = null;          // ma ligne de `boites`, ou null
  var LU = false, ABSENTE = false;
  var NOM_COL = false;        // la base connait-elle `nom_affiche` (lot 78) ? Sinon, pas de champ.
  var LOGO_COL = false;       // et `logo_dans_mails` (lot 79) ? Sinon, pas de case.
  var MAITRE = null, AUTRES = [];
  var FOURN = null;          // le dernier « reconnaitre »
  var EN_COURS = false;
  var MDP = '';              // le mot de passe, le temps de l'essai seulement

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
      var l = await BdvCompte.api('/boites?select=adresse,fournisseur,serveur,identifiant,etat,utiliser,copie_a_soi,code_expire,essai_le,branchee_le,erreur&bureau=eq.' + encodeURIComponent(b));
      BOITE = (Array.isArray(l) && l[0]) || null;
      LU = true; ABSENTE = false;
      /* Le nom affiche se lit A PART : nomme dans la requete du dessus avant le SQL du lot 78,
         il ferait echouer toute la lecture de la boite. */
      NOM_COL = false;
      if (BOITE) {
        try {
          var ln = await BdvCompte.api('/boites?select=nom_affiche&bureau=eq.' + encodeURIComponent(b));
          if (Array.isArray(ln) && ln[0] && 'nom_affiche' in ln[0]) { BOITE.nom_affiche = ln[0].nom_affiche; NOM_COL = true; }
        } catch (e2) { NOM_COL = false; }
        /* La case du logo, a part elle aussi, pour la meme raison (lot 79). */
        LOGO_COL = false;
        try {
          var lg = await BdvCompte.api('/boites?select=logo_dans_mails&bureau=eq.' + encodeURIComponent(b));
          if (Array.isArray(lg) && lg[0] && 'logo_dans_mails' in lg[0]) { BOITE.logo_dans_mails = lg[0].logo_dans_mails; LOGO_COL = true; }
        } catch (e3) { LOGO_COL = false; }
      }
    } catch (e) {
      LU = false;
      ABSENTE = !!e && (e.status === 404 || /PGRST|42P01/.test(String(e.detail || e.message || '')));
    }
    try {
      MAITRE = await BdvCompte.api('/rpc/est_maitre', { methode: 'POST', corps: { b: b } }) === true;
      if (MAITRE) {
        var a = await BdvCompte.api('/rpc/boites_du_bureau', { methode: 'POST', corps: { p_bureau: b } });
        var moi = BdvCompte.monId && BdvCompte.monId();
        AUTRES = (Array.isArray(a) ? a : []).filter(function (x) { return x.personne !== moi; });
      }
    } catch (e) { AUTRES = []; }
    try { document.dispatchEvent(new CustomEvent('bdv:boite')); } catch (e) {}
  }

  function dire(t, alerte) {
    var p = el('bdvbMot'); if (!p) return;
    p.textContent = t || '';
    p.className = 'bdvr-aide' + (alerte ? ' bdvr-aide--alerte' : '');
    p.hidden = !t;
  }

  /* ---------------- L'ECRAN ---------------- */
  function monter(cible) {
    var z = mk('section', 'bdvb'); z.id = 'bdvbZone'; z.setAttribute('aria-labelledby', 'bdvbTitre');
    var t = mk('h3', 'bdvd-sous', 'D’où partent tes mails'); t.id = 'bdvbTitre';
    z.appendChild(t);
    var abs = mk('p', 'bdvr-aide bdvr-aide--alerte', 'Brancher ta boîte n’est pas encore disponible sur ce bureau.');
    abs.id = 'bdvbAbsente'; abs.hidden = true; z.appendChild(abs);

    var corps = mk('div', 'bdvb-corps'); corps.id = 'bdvbCorps';
    var q = mk('div', 'bdvr-groupe bdvs-question'); q.setAttribute('role', 'radiogroup'); q.setAttribute('aria-labelledby', 'bdvbTitre');
    [['bdvbMess', 'Ma messagerie ouvre le mail', ' : le bureau prépare le texte, tu cliques sur Envoyer. Rien à brancher.'],
     ['bdvbBureau', 'Le bureau envoie pour moi', ', depuis ma boîte : je la branche une fois, puis j’envoie d’un clic.']].forEach(function (x) {
      var lab = mk('label', 'bdvr-chk'); var r = mk('input'); r.type = 'radio'; r.name = 'bdvbMode'; r.id = x[0];
      /* Un seul enfant de texte : la case est en flex, le gras et la suite se separeraient. */
      var sp = mk('span'); sp.appendChild(mk('b', null, x[1])); sp.appendChild(document.createTextNode(x[2]));
      lab.appendChild(r); lab.appendChild(document.createTextNode(' ')); lab.appendChild(sp);
      q.appendChild(lab);
    });
    corps.appendChild(q);

    var etat = mk('div', 'bdvb-etat'); etat.id = 'bdvbEtat'; etat.hidden = true; corps.appendChild(etat);

    var f = mk('div', 'bdvb-form'); f.id = 'bdvbForm'; f.hidden = true;
    var g = mk('div', 'bdvr-grille');
    champ(g, 'bdvbAdresse', 'L’adresse de ta boîte', { type: 'email', auto: 'email', plein: true });
    f.appendChild(g);
    var fo = mk('div', 'bdvb-fourn'); fo.id = 'bdvbFourn'; fo.setAttribute('aria-live', 'polite'); f.appendChild(fo);
    var g2 = mk('div', 'bdvr-grille'); g2.id = 'bdvbAutre'; g2.hidden = true;
    champ(g2, 'bdvbServeur', 'Le serveur d’envoi (SMTP)', { place: 'smtp.mondomaine.fr', aide: 'Il se trouve dans l’aide de ton hébergeur. Le bureau envoie en SSL sur le port 465.' });
    champ(g2, 'bdvbIdent', 'L’identifiant, s’il n’est pas l’adresse', { auto: 'username' });
    f.appendChild(g2);
    var g3 = mk('div', 'bdvr-grille'); g3.id = 'bdvbMdpZone';
    var mdp = champ(g3, 'bdvbMdp', 'Le mot de passe à donner', { type: 'password', auto: 'off', plein: true,
      aide: 'Il part seulement avec « Tester et brancher », pas avec « Enregistrer ».' });
    mdp.setAttribute('autocapitalize', 'off'); mdp.spellcheck = false;
    f.appendChild(g3);
    var ge = mk('div', 'bdvb-gestes');
    var bt = mk('button', 'bdvr-btn', 'Tester et brancher'); bt.type = 'button'; bt.id = 'bdvbTester';
    ge.appendChild(bt); f.appendChild(ge);
    var ae = mk('p', 'bdvr-aide', 'Le bureau t’envoie un mail d’essai avec un code. Ton mot de passe est rangé chiffré, personne ne peut le relire, pas même le maître du bureau.');
    ae.id = 'bdvbAideEssai'; f.appendChild(ae);
    corps.appendChild(f);

    var c = mk('div', 'bdvb-code'); c.id = 'bdvbCode'; c.hidden = true;
    var gc = mk('div', 'bdvr-grille');
    var ic = champ(gc, 'bdvbCodeI', 'Le code reçu dans ta boîte', { mode: 'numeric', auto: 'one-time-code', max: 6,
      aide: 'Il arrive comme un mail de toi à toi. Regarde aussi dans les indésirables. Il marche 15 minutes.' });
    ic.pattern = '[0-9]{6}';
    c.appendChild(gc);
    var gb = mk('div', 'bdvb-gestes');
    var bb = mk('button', 'bdvr-btn', 'Brancher ma boîte'); bb.type = 'button'; bb.id = 'bdvbBrancher';
    var br = mk('button', 'bdvr-btn bdvr-btn--creux', 'Renvoyer un code'); br.type = 'button'; br.id = 'bdvbRenvoyer';
    gb.appendChild(bb); gb.appendChild(br); c.appendChild(gb);
    corps.appendChild(c);

    var mot = mk('p', 'bdvr-aide'); mot.id = 'bdvbMot'; mot.setAttribute('role', 'status'); mot.hidden = true;
    corps.appendChild(mot);
    var bu = mk('div', 'bdvb-bureau'); bu.id = 'bdvbAutres'; bu.hidden = true; corps.appendChild(bu);
    z.appendChild(corps);

    /* Sous la phrase d'etat de la signature, avant ses reglages. */
    var apres = el('bdvsEtat');
    if (apres && apres.parentNode === cible) cible.insertBefore(z, apres.nextSibling); else cible.insertBefore(z, cible.firstChild);

    z.addEventListener('change', surChange);
    z.addEventListener('click', surClic);
    z.addEventListener('input', function (e) { if (e.target && e.target.id === 'bdvbNom') e.target.dataset.sale = '1'; });
    el('bdvbAdresse').addEventListener('blur', function () { reconnaitre(); });
    peindre();
    charger().then(peindre);
  }
  function nomSignature() { var n = el('bdvsNom'); return n ? String(n.value || '').trim() : ''; }
  function nettoyerNom(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
  async function nommer(t) {
    var n = nettoyerNom(t.value);
    if (/[@<>"\\]/.test(n)) { dire('Le nom ne peut pas contenir @ < > " ou \\ : il ressemblerait à une adresse.', true); t.focus(); return; }
    var aGarder = n || null;
    try {
      var r = await BdvCompte.api('/rpc/boite_nommer', { methode: 'POST', corps: { p_bureau: bureau(), p_nom: aGarder } });
      if (r !== true) throw new Error('rien');
      BOITE.nom_affiche = aGarder;
      delete t.dataset.sale;
      t.value = n || nomSignature();
      var vu = n || nomSignature();
      dire(vu ? 'Tes clients verront « ' + vu + ' ».' : 'Tes clients verront ton adresse seule.');
    } catch (x) { dire('Ce nom n’a pas été enregistré. Réessaie.', true); }
  }
  function champ(parent, id, libelle, o) {
    o = o || {};
    var c = mk('div', 'bdvr-champ' + (o.plein ? ' bdvr-champ--plein' : ''));
    var l = mk('label', 'bdvr-l', libelle); l.htmlFor = id;
    var i = mk('input', 'bdvr-i'); i.id = id; i.type = o.type || 'text';
    if (o.auto) i.autocomplete = o.auto;
    if (o.max) i.maxLength = o.max;
    if (o.place) i.placeholder = o.place;
    if (o.mode) i.inputMode = o.mode;
    c.appendChild(l); c.appendChild(i);
    if (o.aide) { var a = mk('p', 'bdvr-aide', o.aide); a.id = id + 'Aide'; i.setAttribute('aria-describedby', a.id); c.appendChild(a); }
    parent.appendChild(c);
    return i;
  }

  function mode() { return el('bdvbBureau') && el('bdvbBureau').checked ? 'bureau' : 'messagerie'; }

  function peindreEtatHaut() {
    var bureauMode = mode() === 'bureau';
    var branchee = BOITE && BOITE.etat === 'branchee';
    /* La phrase d'etat du haut (bdv-signature.js) dit la VERITE du jour : au lot 76 le bureau
       n'envoie encore rien, meme une boite branchee (vigneron, lot 76). */
    var et = el('bdvsEtat');
    if (et) {
      if (!et.dataset.origine) et.dataset.origine = et.textContent;
      var murVu = FOURN && FOURN.statut === 'mur';
      et.textContent = !bureauMode || (murVu && !branchee) ? et.dataset.origine
        : branchee ? 'Tes mails partent de ta boîte ' + BOITE.adresse + ' : quand tu cliques « Envoyer depuis ma boîte », le bureau l’envoie. Si un envoi échoue, ta messagerie prend le relais.'
        : 'Branche ta boîte ci-dessous : tant qu’elle ne l’est pas, ta messagerie ouvre le mail.';
    }
  }

  function peindre() {
    if (!el('bdvbZone')) return;
    el('bdvbAbsente').hidden = !ABSENTE;
    el('bdvbCorps').hidden = ABSENTE;
    if (ABSENTE) return;
    var b = BOITE;
    if (!el('bdvbZone').dataset.touche) {
      el('bdvbBureau').checked = !!(b && b.utiliser);
      el('bdvbMess').checked = !(b && b.utiliser);
    }
    var bureauMode = mode() === 'bureau';
    var branchee = BOITE && BOITE.etat === 'branchee';
    peindreEtatHaut();
    var attend = b && b.etat === 'a_confirmer' && b.code_expire && new Date(b.code_expire) > new Date();
    var etat = el('bdvbEtat');
    etat.textContent = '';
    if (b && branchee) {
      etat.appendChild(mk('p', 'bdvb-ok', 'Ta boîte ' + b.adresse + ' est branchée' + (b.branchee_le ? ' depuis le ' + dateCourte(b.branchee_le) : '') + '.'));
      var lc = mk('label', 'bdvr-chk'); var cc = mk('input'); cc.type = 'checkbox'; cc.id = 'bdvbCopie'; cc.checked = b.copie_a_soi !== false;
      lc.appendChild(cc); lc.appendChild(document.createTextNode(' M’envoyer une copie de chaque mail (OVH, IONOS et Orange ne le rangent pas dans Envoyés)'));
      etat.appendChild(lc);
      if (NOM_COL) {
        var avant = el('bdvbNom');
        var garde = avant && avant.dataset.sale ? avant.value : null;
        champ(etat, 'bdvbNom', 'Le nom que voient tes clients', { max: 80, auto: 'off',
          place: nomSignature() || 'Teddy Pereira, Domaine du Clos',
          aide: 'Il s’affiche à la place de ton adresse dans leur boîte. Vide : le nom de ta signature.' });
        el('bdvbNom').value = garde != null ? garde : (b.nom_affiche || nomSignature());
        if (garde != null) el('bdvbNom').dataset.sale = '1';
      }
      if (LOGO_COL) {
        /* Le logo de Mon domaine (lot 69) sous les mails qui partent de la boite (lot 79). Sans
           logo, la case reste, et l'aide dit ou l'ajouter : decocher n'a alors rien a retirer. */
        var lg = mk('label', 'bdvr-chk'); var cl = mk('input'); cl.type = 'checkbox'; cl.id = 'bdvbLogo'; cl.checked = b.logo_dans_mails !== false;
        cl.setAttribute('aria-describedby', 'bdvbLogoAide');
        lg.appendChild(cl); lg.appendChild(document.createTextNode(' Mettre le logo du domaine sous mes mails'));
        etat.appendChild(lg);
        var aLogo = !!(window.BdvLogo && BdvLogo.image && BdvLogo.image());
        var al = mk('p', 'bdvr-aide', aLogo
          ? 'Il part dans le mail, sous ta signature, seulement quand le bureau envoie depuis ta boîte.'
          : 'Tu n’as pas encore de logo : ajoute-le dans l’onglet Mon domaine, il partira ensuite sous tes mails.');
        al.id = 'bdvbLogoAide'; etat.appendChild(al);
      }
      var rt = mk('button', 'bdvr-btn bdvr-btn--creux', 'Retirer ma boîte'); rt.type = 'button'; rt.id = 'bdvbRetirer';
      etat.appendChild(rt);
      var cf = mk('div', 'bdvb-confirme'); cf.id = 'bdvbConfirme'; cf.hidden = true;
      cf.appendChild(mk('p', null, 'Retirer ta boîte efface le mot de passe rangé. Tes mails repartiront de ta messagerie.'));
      var non = mk('button', 'bdvr-btn bdvr-btn--creux', 'Non, la garder'); non.type = 'button'; non.id = 'bdvbGarder';
      var oui = mk('button', 'bdvr-btn', 'Oui, la retirer'); oui.type = 'button'; oui.id = 'bdvbOui';
      cf.appendChild(non); cf.appendChild(oui);
      etat.appendChild(cf);
    } else if (b && b.etat === 'reconnecter') {
      etat.appendChild(mk('p', 'bdvr-aide bdvr-aide--alerte', 'Ta boîte ' + b.adresse + ' n’accepte plus le mot de passe rangé (il a peut-être changé). Rebranche-la ci-dessous.'));
    }
    etat.hidden = !bureauMode || !etat.firstChild;
    el('bdvbForm').hidden = !bureauMode || !!branchee;
    el('bdvbCode').hidden = !bureauMode || !!branchee || !attend;
    if (bureauMode && !branchee && b && !el('bdvbAdresse').value) el('bdvbAdresse').value = b.adresse;
    /* A defaut, l'adresse du compte : c'est souvent la meme. */
    if (bureauMode && !branchee && !el('bdvbAdresse').value) {
      try { var s = JSON.parse(localStorage.getItem('bdv_session')); el('bdvbAdresse').value = (s && s.user && s.user.email) || ''; } catch (e) {}
    }
    var au = el('bdvbAutres');
    au.textContent = '';
    if (MAITRE && AUTRES.length) {
      au.appendChild(mk('p', 'bdvr-aide', 'Dans ton bureau, ' + AUTRES.length + (AUTRES.length > 1 ? ' collègues ont' : ' collègue a') + ' une boîte : ' +
        AUTRES.map(function (x) { return x.adresse + (x.etat === 'branchee' ? '' : ' (pas encore branchée)'); }).join(', ') + '.'));
    }
    au.hidden = !au.firstChild;
    if (bureauMode && !branchee && el('bdvbAdresse').value && !FOURN) reconnaitre();
  }

  async function reconnaitre() {
    var a = (el('bdvbAdresse').value || '').trim().toLowerCase();
    var fo = el('bdvbFourn');
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(a)) { FOURN = null; fo.textContent = ''; return; }
    if (FOURN && FOURN.adresse === a) return;
    try {
      var r = await BdvCompte.fonction('boite', { action: 'reconnaitre', adresse: a });
      FOURN = Object.assign({ adresse: a }, r || {});
    } catch (e) { FOURN = { adresse: a, statut: 'inconnu' }; }
    peindreFourn();
  }
  function peindreFourn() {
    var fo = el('bdvbFourn'); fo.textContent = '';
    var f = FOURN || {};
    var mur = f.statut === 'mur';
    el('bdvbAutre').hidden = f.statut !== 'inconnu';
    el('bdvbMdpZone').hidden = mur;
    el('bdvbTester').hidden = mur;
    el('bdvbAideEssai').hidden = mur;
    peindreEtatHaut();
    if (mur) {
      fo.className = 'bdvb-fourn bdvb-mur';
      fo.appendChild(mk('p', null, f.nom + ' ne laisse pas le bureau envoyer pour toi avec un mot de passe. Garde « Ma messagerie ouvre le mail » : rien ne change pour toi.'));
      return;
    }
    fo.className = 'bdvb-fourn';
    if (f.statut === 'connu') {
      fo.appendChild(mk('p', 'bdvb-ok', 'Boîte reconnue : ' + f.nom + '.'));
      if (f.motDePasse) fo.appendChild(aideAvecLien(f.motDePasse));
    } else if (f.statut === 'inconnu') {
      fo.appendChild(mk('p', 'bdvr-aide', 'Le bureau ne reconnaît pas ce fournisseur. Indique son serveur d’envoi.'));
    }
  }

  /* L'adresse de la page Google (ou autre) devient un lien : au telephone, on ne la retape pas. */
  function aideAvecLien(t) {
    var p = mk('p', 'bdvr-aide');
    var m = String(t).match(/([a-z0-9.-]+\.(?:com|fr)\/[a-z0-9/_-]+)/i);
    if (!m) { p.textContent = t; return p; }
    var i = t.indexOf(m[1]);
    p.appendChild(document.createTextNode(t.slice(0, i)));
    var a = mk('a', null, m[1]); a.href = 'https://' + m[1]; a.target = '_blank'; a.rel = 'noopener';
    a.appendChild(mk('span', 'hors-ecran', ' (nouvel onglet)'));
    p.appendChild(a);
    p.appendChild(document.createTextNode(t.slice(i + m[1].length)));
    return p;
  }

  async function tester() {
    if (EN_COURS) return;
    var a = (el('bdvbAdresse').value || '').trim().toLowerCase();
    var p = el('bdvbMdp').value || MDP;
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(a)) { dire('Écris l’adresse de ta boîte.', true); el('bdvbAdresse').focus(); return; }
    if (!p) { dire('Il manque le mot de passe.', true); el('bdvbMdp').focus(); return; }
    MDP = p;
    EN_COURS = true; el('bdvbTester').disabled = true; el('bdvbRenvoyer').disabled = true;
    dire('Le bureau essaie ta boîte…');
    var r;
    try {
      r = await BdvCompte.fonction('boite', { action: 'tester', bureau: bureau(), adresse: a, mot_de_passe: p,
        serveur: (el('bdvbServeur').value || '').trim(), identifiant: (el('bdvbIdent').value || '').trim() });
    } catch (e) {
      r = { erreur: (e && e.message) || 'Le bureau n’a pas pu joindre ta boîte.' };
    }
    EN_COURS = false; el('bdvbTester').disabled = false; el('bdvbRenvoyer').disabled = false;
    var nom = (FOURN && FOURN.nom) || 'Ton fournisseur';
    if (r && r.resultat === 'code') {
      el('bdvbMdp').value = '';
      await charger();
      peindre();
      dire('Mail d’essai envoyé à ' + a + ', depuis ta boîte. Tape le code qu’il contient.');
      if (el('bdvbCodeI')) el('bdvbCodeI').focus();
      return;
    }
    MDP = '';
    if (r && r.resultat === 'refus') dire(nom + ' a refusé l’adresse ou le mot de passe.' + (FOURN && /gmail|workspace/.test(FOURN.cle || '') ? ' Il faut un mot de passe d’application, pas ton mot de passe habituel.' : ''), true);
    else if (r && r.resultat === 'injoignable') dire('Le serveur ' + (r.serveur || '') + ' ne répond pas sur le port 465. Vérifie son nom, ou garde ta messagerie.', true);
    else if (r && r.resultat === 'mur') { FOURN = { adresse: a, statut: 'mur', nom: r.nom }; peindreFourn(); }
    else if (r && (r.resultat === 'serveur' || r.resultat === 'plafond')) dire(r.erreur, true);
    else dire((r && r.erreur) || 'Ta boîte a refusé l’envoi d’essai' + (r && r.code_smtp ? ' (code ' + r.code_smtp + ')' : '') + '.', true);
  }

  async function brancher() {
    var c = (el('bdvbCodeI').value || '').replace(/\D/g, '');
    if (c.length !== 6) { dire('Le code a 6 chiffres.', true); el('bdvbCodeI').focus(); return; }
    var r;
    try { r = await BdvCompte.api('/rpc/boite_confirmer', { methode: 'POST', corps: { p_bureau: bureau(), p_code: c } }); }
    catch (e) { dire('Le bureau n’a pas pu vérifier le code. Réessaie.', true); return; }
    if (r === 'branchee') {
      MDP = ''; el('bdvbCodeI').value = '';
      await charger(); peindre();
      dire('C’est branché.');
      return;
    }
    if (r === 'faux') dire('Ce n’est pas le bon code. Copie celui du dernier mail reçu.', true);
    else dire('Ce code ne vaut plus. Demande-en un nouveau.', true);
  }

  async function surChange(e) {
    var t = e.target;
    if (t.name === 'bdvbMode') {
      el('bdvbZone').dataset.touche = '1';
      if (BOITE) {
        try {
          var ok = await BdvCompte.api('/rpc/boite_regler', { methode: 'POST', corps: { p_bureau: bureau(), p_utiliser: mode() === 'bureau', p_copie: null } });
          if (ok === true) BOITE.utiliser = mode() === 'bureau';
        } catch (x) { dire('Ce choix n’a pas été enregistré. Réessaie.', true); }
      }
      dire('');
      peindre();
    } else if (t.id === 'bdvbNom') {
      nommer(t);
    } else if (t.id === 'bdvbLogo') {
      try {
        var rl = await BdvCompte.api('/rpc/boite_logo', { methode: 'POST', corps: { p_bureau: bureau(), p_avec: t.checked } });
        if (rl !== true) throw new Error('rien');
        BOITE.logo_dans_mails = t.checked;
        dire(t.checked ? 'Le logo partira sous tes mails.' : 'Tes mails partiront sans logo.');
      } catch (x) { t.checked = !t.checked; dire('Ce choix n’a pas été enregistré. Réessaie.', true); }
    } else if (t.id === 'bdvbCopie') {
      try {
        var r = await BdvCompte.api('/rpc/boite_regler', { methode: 'POST', corps: { p_bureau: bureau(), p_utiliser: null, p_copie: t.checked } });
        if (r !== true) throw new Error('rien');
        BOITE.copie_a_soi = t.checked;
        dire(t.checked ? 'Tu recevras une copie de chaque mail.' : 'Tu ne recevras plus de copie.');
      } catch (x) { t.checked = !t.checked; dire('Ce choix n’a pas été enregistré. Réessaie.', true); }
    }
  }
  function surClic(e) {
    var b = e.target.closest && e.target.closest('button');
    if (!b) return;
    if (b.id === 'bdvbTester') { e.preventDefault(); tester(); }
    else if (b.id === 'bdvbRenvoyer') {
      e.preventDefault();
      if (MDP) tester();
      else { dire('Redonne le mot de passe, puis « Tester et brancher ».'); el('bdvbMdp').focus(); }
    }
    else if (b.id === 'bdvbBrancher') { e.preventDefault(); brancher(); }
    else if (b.id === 'bdvbRetirer') { e.preventDefault(); el('bdvbConfirme').hidden = false; el('bdvbGarder').focus(); }
    else if (b.id === 'bdvbGarder') { e.preventDefault(); el('bdvbConfirme').hidden = true; el('bdvbRetirer').focus(); }
    else if (b.id === 'bdvbOui') {
      e.preventDefault();
      BdvCompte.api('/rpc/boite_retirer', { methode: 'POST', corps: { p_bureau: bureau() } }).then(async function (r) {
        if (r !== true) throw new Error('rien');
        BOITE = null; FOURN = null; el('bdvbMess').checked = true; el('bdvbBureau').checked = false;
        await charger(); peindre();
        dire('Ta boîte est retirée, et son mot de passe effacé.');
        el('bdvbMess').focus();
      }).catch(function () { dire('La boîte n’a pas été retirée. Réessaie.', true); });
    }
  }

  function rafraichir() { var z = el('bdvbZone'); if (z) delete z.dataset.touche; return charger().then(peindre); }

  function brancherBloc() {
    if (!window.BdvReglages || !BdvReglages.brancher) return false;
    BdvReglages.brancher({ blocs: [{ hote: 'envois', monter: monter, rafraichir: rafraichir }] });
    return true;
  }
  if (!brancherBloc()) document.addEventListener('DOMContentLoaded', brancherBloc);

  /* ---------------- L'ENVOI, lot 77 ----------------
     Les deux redacteurs (affaire, fiche client) demandent `prete()` pour montrer « Envoyer
     depuis ma boite », puis `envoyer()`. Le clic EST la validation du vigneron : rien ne part
     sans lui. Un echec ne perd rien : le redacteur garde le texte et propose la messagerie. */
  function prete() { return !!(LU && BOITE && BOITE.etat === 'branchee' && BOITE.utiliser); }
  var EN_VOL = false;
  async function envoyer(o) {
    if (!prete()) return { ok: false, resultat: 'pas_branchee', mot: 'Ta boîte n’est pas branchée : ouvre le mail dans ta messagerie.' };
    if (EN_VOL) return { ok: false, resultat: 'en_cours', mot: 'Un envoi est déjà en cours.' };
    EN_VOL = true;
    var r;
    try {
      r = await BdvCompte.fonction('boite', { action: 'envoyer', bureau: bureau(), adresse: String(o.a || '').trim(),
        sujet: String(o.sujet || ''), texte: String(o.texte || '') });
    } catch (e) {
      /* Pas de reponse : le mail est peut-etre parti. On ne pousse pas a renvoyer. */
      /* Un refus de la fonction (400, 401, 413) prouve que rien n'est parti ; seuls le reseau
         ou une panne du serveur (500 et plus) laissent un doute. */
      var st = e && e.status;
      var avant = /aucune session|configuration absente/.test(String(e && e.message));
      r = st === 413 ? { resultat: 'trop_long' } : ((st && st < 500) || avant) ? { resultat: 'refus_fonction', erreur: e.message } : { resultat: 'incertain' };
    }
    EN_VOL = false;
    r = r || {};
    if (r.resultat === 'parti') return { ok: true, de: r.de, copie: r.copie, mot: 'Mail envoyé depuis ' + r.de + (r.copie ? ', avec une copie dans ta boîte.' : '.') };
    var mot = 'Pas parti : ';
    if (r.resultat === 'refus') {
      if (BOITE) BOITE.etat = 'reconnecter';
      mot += 'ta boîte a refusé le mot de passe (il a peut-être changé). Rebranche-la dans Mes réglages, onglet Mes envois.';
    } else if (r.resultat === 'injoignable') mot += 'le serveur de ta boîte ne répond pas. Réessaie dans un moment.';
    else if (r.resultat === 'destinataire') mot += 'ta boîte refuse cette adresse. Vérifie-la.';
    else if (r.resultat === 'passager') mot += 'ta boîte est occupée. Réessaie dans un moment.';
    else if (r.resultat === 'trop_long') mot += 'ce mail est trop long pour partir du bureau.';
    else if (r.resultat === 'refus_fonction') mot += (r.erreur === 'aucune session' ? 'ta session a expiré, reconnecte-toi.' : (r.erreur || 'le bureau a refusé l’envoi.'));
    else if (r.resultat === 'incertain') return { ok: false, resultat: 'incertain',
      mot: 'Peut-être parti : la réponse de ta boîte n’est pas arrivée. Regarde ton dossier Envoyés avant de le renvoyer.' };
    else if (r.resultat === 'plafond') mot += r.erreur;
    else if (r.resultat === 'pas_branchee') { charger(); mot += 'ta boîte n’est plus branchée.'; }
    else mot += 'le bureau n’a pas pu l’envoyer' + (r.code_smtp ? ' (code ' + r.code_smtp + ')' : '') + '.';
    return { ok: false, resultat: r.resultat || 'erreur', mot: mot + ' Ton texte est gardé : tu peux aussi l’ouvrir dans ta messagerie.' };
  }
  /* La boite se lit des que le bureau est connu, pas seulement a l'ouverture des reglages : le
     premier redacteur ouvert doit savoir s'il peut envoyer. */
  function lireTot() { if (bureau() && !LU) charger(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lireTot); else lireTot();
  document.addEventListener('bdv:bureau', lireTot);
  /* Un logo pose ou retire dans Mon domaine change l'aide de la case (lot 79). */
  document.addEventListener('bdv:logo', function () { if (el('bdvbZone') && LU) peindre(); });

  /* Le nom que voient les clients, tel que la fonction `boite` le pose (lot 78) : celui choisi
     dans Mes envois, sinon celui de la signature, avec le meme filtre. Vide : l'adresse seule.
     Sert a la ligne « De : » des deux redacteurs. */
  function nomVu() {
    var n = BOITE && BOITE.nom_affiche;
    if (!n && window.BdvSignature && BdvSignature.perso) { var p = BdvSignature.perso(); n = p && p.nom; }
    return String(n || '').replace(/[\u0000-\u001F\u007F@<>"\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  window.BdvBoite = { prete: prete, adresse: function () { return BOITE ? BOITE.adresse : ''; }, nom: nomVu, envoyer: envoyer, charger: charger,
    _etat: function () { return { BOITE: BOITE, LU: LU, ABSENTE: ABSENTE, FOURN: FOURN, MDP: MDP }; } };
})();
