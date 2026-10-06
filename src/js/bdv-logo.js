/* ================================================================
   LE BUREAU DU VIGNERON, le logo du domaine (lot 69, 06/10/2026)
   ----------------------------------------------------------------
   Voir CLAUDE.md, « LOT 69 : LE LOGO DU DOMAINE ». Ce module :
   - lit le logo du bureau (table `domaine_logo`), et en garde une copie de confort
     sur l'appareil (`bdv_logo_v1`). La BASE fait foi : un nouveau PC le relit ;
   - le pose en bas de la barre laterale (`.bureau-nav__logo`), dans une pastille claire ;
   - monte le bloc « Ton logo » dans Mes reglages, onglet « Mon domaine » (appele par
     bdv-domaine.js). Seul le MAITRE depose, change ou retire : la base refuse les autres,
     l'ecran ne fait que ne pas proposer le geste ;
   - donne l'image au devis (`BdvLogo.image()`, `BdvLogo.pret()`).

   L'IMAGE EST REFAITE PAR LE NAVIGATEUR AVANT D'ETRE ENVOYEE : relue, redessinee dans un
   canvas, reduite a 600 px au plus. Un PNG reste PNG (sa transparence compte), le reste
   devient JPEG. Une photo d'iPhone (HEIC) est convertie par Safari grace a `accept`.
   Un SVG est refuse : la base le refuserait de toute facon (premiers octets).
   Aucune donnee ne passe par une chaine HTML : tout est pose en DOM.
   ================================================================ */
(function () {
  'use strict';

  var CLE = 'bdv_logo_v1';          // prefixe bdv_ : part avec le reste a la deconnexion
  var MAX = 600;                    // la base refuse au-dela
  var MAX_SIGNES = 150000;          // idem
  var FLOU = 240;                   // sous cette hauteur, flou a 20 mm sur le papier
  var POIDS_MAX = 15 * 1024 * 1024; // le fichier choisi, avant reduction
  var ETAPE = 2400;                 // une image plus grande est d'abord ramenee a cette taille
  /* LES CONDITIONS, ECRITES UNE FOIS : affichees sous l'aide, et reprises par les messages
     d'erreur. Demande de Ted (06/10/2026) : « trop lourde » seul etait trop vague. */
  var CONDITIONS = [
    ['Format', 'PNG ou JPEG. Une photo de téléphone est convertie toute seule. Pas de SVG ni de PDF.'],
    ['Poids du fichier', '15 Mo au plus.'],
    ['Taille', 'au moins 240 px de haut pour qu’il soit net sur le devis. Plus grand, il est réduit tout seul à 600 px.'],
    ['Idéal', 'un logo plus large que haut, détouré sur fond transparent.']
  ];
  var FORME = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

  var LOGO = null;        // { bureau, empreinte, image, largeur, hauteur } ou null
  var ETAT = 'inconnu';   // 'inconnu' | 'lu' | 'absent' (SQL pas passe) | 'panne'
  var MAITRE = null;      // true | false | null (on ne sait pas)
  var PROMESSE = null;
  var CIBLE = null;       // le bloc monte dans les reglages

  function el(id) { return document.getElementById(id); }
  function bureau() { return window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau(); }
  function api(chemin, o) { return BdvCompte.api(chemin, o); }

  /* ---------------- LA COPIE DE CONFORT ---------------- */
  function lireCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CLE) || 'null');
      if (c && c.bureau === bureau() && FORME.test(c.image || '')) return c;
    } catch (e) { /* stockage indisponible : on relira la base */ }
    return null;
  }
  function ecrireCache(c) {
    try { if (c) localStorage.setItem(CLE, JSON.stringify(c)); else localStorage.removeItem(CLE); } catch (e) { /* tant pis */ }
  }

  /* ---------------- LA LECTURE ---------------- */
  /* On demande d'abord l'empreinte seule (quelques octets) : l'image ne redescend que si
     elle a change depuis la copie de l'appareil. */
  async function lire() {
    var b = bureau();
    if (!b || !window.BdvCompte) { ETAT = 'panne'; return LOGO; }
    var c = lireCache();
    if (c && !LOGO) LOGO = c;
    try {
      var l = await api('/domaine_logo?select=empreinte,largeur,hauteur&bureau=eq.' + encodeURIComponent(b));
      if (!Array.isArray(l)) { ETAT = 'panne'; return LOGO; }
      if (!l.length) { LOGO = null; ecrireCache(null); ETAT = 'lu'; return null; }
      var r = l[0];
      if (!(c && c.empreinte === r.empreinte)) {
        var i = await api('/domaine_logo?select=image&bureau=eq.' + encodeURIComponent(b));
        var img = Array.isArray(i) && i[0] ? i[0].image : '';
        if (!FORME.test(img || '')) { ETAT = 'panne'; return LOGO; }
        c = { bureau: b, empreinte: r.empreinte, image: img, largeur: r.largeur, hauteur: r.hauteur };
        ecrireCache(c);
      }
      LOGO = c; ETAT = 'lu';
      return LOGO;
    } catch (e) {
      /* La table manque (lot 69 pas passe) : on se tait, rien n'est casse. */
      ETAT = (e && (e.status === 404 || /PGRST|42P01/.test(String(e.detail || '')))) ? 'absent' : 'panne';
      return LOGO;
    } finally {
      peindreRail();
    }
  }
  function charger() { PROMESSE = lire(); return PROMESSE; }
  function pret() { return PROMESSE || charger(); }

  async function lireMaitre() {
    var b = bureau();
    if (!b) { MAITRE = null; return null; }
    try { var r = await api('/rpc/est_maitre', { methode: 'POST', corps: { b: b } }); MAITRE = r === true; }
    catch (e) { MAITRE = null; }
    return MAITRE;
  }

  /* ---------------- LA BARRE LATERALE ---------------- */
  /* La case est AJOUTEE a la barre que bdv-nav.js a montee (une ligne de plus dans un
     fichier bloquant aurait depasse banc:poids). Elle se pose avant le bouton de repli. */
  function peindreRail() {
    var nav = el('bureauNav');
    if (!nav) return;
    var bloc = nav.querySelector('.bureau-nav__logo');
    if (!LOGO) { if (bloc) bloc.hidden = true; return; }
    if (!bloc) {
      bloc = document.createElement('div');
      bloc.className = 'bureau-nav__logo';
      var im = document.createElement('img');
      im.alt = '';   // decoratif : le nom du bureau est ecrit en tete de la barre
      im.decoding = 'async';
      bloc.appendChild(im);
      var avant = nav.querySelector('#bureauNavReplier');
      nav.insertBefore(bloc, avant || null);
    }
    var img = bloc.querySelector('img');
    if (img.getAttribute('src') !== LOGO.image) img.src = LOGO.image;
    bloc.hidden = false;
  }

  /* ---------------- L'IMAGE REFAITE ---------------- */
  function lireFichier(f) {
    return new Promise(function (ok, ko) {
      var u = URL.createObjectURL(f);
      var im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); ok(im); };
      im.onerror = function () { URL.revokeObjectURL(u); ko(new Error('illisible')); };
      im.src = u;
    });
  }
  /* LES MARGES TRANSPARENTES SONT RETIREES : un logo detoure livre dans un grand cadre vide
     sortirait minuscule dans ses 20 mm. On cherche le cadre des pixels visibles. */
  function dims(im) { return { w: im.naturalWidth || im.width, h: im.naturalHeight || im.height }; }
  /* UNE TRES GRANDE IMAGE EST D'ABORD RAMENEE A 2 400 px : Safari plafonne la memoire des
     canvas, et une reduction en une seule fois de 8 000 a 600 px donne un logo crenele. */
  function ramener(im) {
    var d = dims(im), k = Math.min(1, ETAPE / d.w, ETAPE / d.h);
    if (k >= 1) return im;
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(d.w * k)); cv.height = Math.max(1, Math.round(d.h * k));
    var cx = cv.getContext('2d');
    if (!cx) return im;
    cx.drawImage(im, 0, 0, cv.width, cv.height);
    return cv;
  }
  function cadreVisible(im) {
    var w = dims(im).w, h = dims(im).h;
    try {
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var cx = cv.getContext('2d'); cx.drawImage(im, 0, 0);
      var d = cx.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return { x: 0, y: 0, w: w, h: h };
      var m = 2;  // un souffle de deux pixels autour
      x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
      return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    } catch (e) { return { x: 0, y: 0, w: w, h: h }; }
  }
  function dessiner(im, cote, type, c, qualite) {
    c = c || { x: 0, y: 0, w: dims(im).w, h: dims(im).h };
    var w = c.w, h = c.h;
    var k = Math.min(1, cote / w, cote / h);
    var W = Math.max(1, Math.round(w * k)), H = Math.max(1, Math.round(h * k));
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var cx = cv.getContext('2d');
    if (!cx) return { image: '' };
    /* Un JPEG n'a pas de transparence : un fond blanc, celui du papier, plutot que du noir. */
    if (type === 'image/jpeg') { cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H); }
    cx.drawImage(im, c.x, c.y, c.w, c.h, 0, 0, W, H);
    return { image: cv.toDataURL(type, qualite || 0.9), largeur: W, hauteur: H, hauteurSource: h };
  }
  /* PNG garde sa transparence ; s'il est trop lourd, on reduit, puis on passe en JPEG. */
  /* Rend le logo prepare, ou { echec: 'poids' | 'redessin' } : les deux ne se disent pas
     pareil. « redessin » = le navigateur n'a rien rendu d'utilisable (canvas vide). */
  function preparer(im, typeSource) {
    var jpeg = [['image/jpeg', 600, 0.9], ['image/jpeg', 480, 0.85], ['image/jpeg', 360, 0.8], ['image/jpeg', 240, 0.7]];
    var essais = typeSource === 'image/png' ? [['image/png', 600], ['image/png', 480], ['image/png', 360]].concat(jpeg) : jpeg;
    var hSource = dims(im).h;
    var src = ramener(im), k = dims(im).h / Math.max(1, dims(src).h);
    var c = typeSource === 'image/png' ? cadreVisible(src) : null;
    var vu = false;
    for (var i = 0; i < essais.length; i++) {
      var r;
      try { r = dessiner(src, essais[i][1], essais[i][0], c, essais[i][2]); } catch (e) { r = { image: '' }; }
      if (!FORME.test(r.image || '')) continue;
      vu = true;
      if (r.image.length <= MAX_SIGNES) { r.hauteurSource = Math.round(r.hauteurSource * k) || hSource; return r; }
    }
    return { echec: vu ? 'poids' : 'redessin' };
  }

  function mo(n) { return (n / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo'; }
  function decrire(f) {
    var ext = (/\.([a-z0-9]{2,5})$/i.exec(f.name || '') || [])[1];
    var type = ext ? ext.toUpperCase() : (f.type || 'format inconnu');
    return type + ', ' + (f.size < 1048576 ? Math.max(1, Math.round(f.size / 1024)) + ' ko' : mo(f.size));
  }

  /* ---------------- LE BLOC DES REGLAGES ---------------- */
  function mk(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function dire(m, alerte) {
    var p = CIBLE && CIBLE.querySelector('.bdvl-mot');
    if (!p) return;
    p.textContent = m || '';
    p.classList.toggle('bdvr-aide--alerte', !!alerte);
  }

  function monter(cible) {
    CIBLE = cible;
    cible.textContent = '';
    var h = mk('h3', 'bdvd-sous', 'Ton logo'); h.id = 'bdvlTitre';
    cible.appendChild(h);
    cible.appendChild(mk('p', 'bdvr-aide', 'Il s’imprime en haut de tes devis, et se voit en bas de la barre de ton bureau.'));
    var cond = mk('ul', 'bdvl-conditions'); cond.setAttribute('aria-label', 'Ce que le logo doit respecter');
    CONDITIONS.forEach(function (x) {
      var li = mk('li'); li.appendChild(mk('b', null, x[0] + ' : ')); li.appendChild(document.createTextNode(x[1])); cond.appendChild(li);
    });
    cible.appendChild(cond);
    var ap = mk('div', 'bdvl-apercu'); ap.setAttribute('aria-labelledby', 'bdvlTitre');
    var im = mk('img'); im.alt = 'Ton logo, tel qu’il sortira sur le devis'; im.hidden = true;
    var vide = mk('p', 'bdvl-vide', 'Pas encore de logo : tes devis sortent avec le nom du domaine en tête.');
    ap.appendChild(im);
    cible.appendChild(ap); cible.appendChild(vide);
    var gestes = mk('div', 'bdvl-gestes');
    var fichier = mk('input'); fichier.type = 'file'; fichier.accept = 'image/png,image/jpeg';
    fichier.className = 'bdvl-fichier'; fichier.id = 'bdvlFichier'; fichier.setAttribute('data-sans-focus', '');
    var choisir = mk('label', 'bdvr-btn bdvl-choisir', 'Choisir mon logo'); choisir.htmlFor = 'bdvlFichier';
    var retirer = mk('button', 'bdvr-btn bdvr-btn--creux', 'Retirer le logo'); retirer.type = 'button';
    gestes.appendChild(fichier); gestes.appendChild(choisir); gestes.appendChild(retirer);
    cible.appendChild(gestes);
    var conf = mk('div', 'bdvl-conf'); conf.hidden = true; conf.setAttribute('role', 'group'); conf.setAttribute('aria-label', 'Retirer le logo');
    conf.appendChild(mk('p', 'bdvr-aide', 'Retirer le logo ? Tes prochains devis sortiront sans. Ceux déjà envoyés ne changent pas.'));
    var oui = mk('button', 'bdvr-btn', 'Oui, le retirer'); oui.type = 'button';
    var non = mk('button', 'bdvr-btn bdvr-btn--creux', 'Non, le garder'); non.type = 'button';
    conf.appendChild(oui); conf.appendChild(non);
    cible.appendChild(conf);
    var role = mk('p', 'bdvr-aide bdvl-role'); role.hidden = true;
    cible.appendChild(role);
    var mot = mk('p', 'bdvr-aide bdvl-mot'); mot.setAttribute('role', 'status');
    cible.appendChild(mot);

    fichier.addEventListener('change', function () {
      var f = fichier.files && fichier.files[0];
      fichier.value = '';
      if (f) deposer(f);
    });
    /* Le label sert de bouton : Entree et Espace l'activent au clavier. */
    choisir.tabIndex = 0;
    choisir.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fichier.click(); }
    });
    retirer.addEventListener('click', function () { conf.hidden = false; non.focus(); });
    non.addEventListener('click', function () { conf.hidden = true; retirer.focus(); });
    oui.addEventListener('click', function () { conf.hidden = true; enlever(); });
    peindreBloc();
  }

  function peindreBloc() {
    if (!CIBLE) return;
    var im = CIBLE.querySelector('.bdvl-apercu img'), vide = CIBLE.querySelector('.bdvl-vide');
    var choisir = CIBLE.querySelector('.bdvl-choisir'), retirer = CIBLE.querySelector('.bdvl-gestes .bdvr-btn--creux');
    var role = CIBLE.querySelector('.bdvl-role'), gestes = CIBLE.querySelector('.bdvl-gestes');
    var ap = CIBLE.querySelector('.bdvl-apercu');
    if (LOGO) { im.src = LOGO.image; im.hidden = false; ap.hidden = false; vide.hidden = true; }
    else { im.removeAttribute('src'); im.hidden = true; ap.hidden = true; vide.hidden = false; }
    if (ETAT === 'absent') {
      gestes.hidden = true; role.hidden = false;
      role.textContent = 'Le logo n’est pas encore disponible sur ton compte.';
      return;
    }
    var peut = MAITRE === true;
    gestes.hidden = !peut;
    choisir.textContent = LOGO ? 'Changer le logo' : 'Choisir mon logo';
    retirer.hidden = !LOGO;
    role.hidden = peut;
    role.textContent = MAITRE === false ? 'Seul le maître du bureau peut le changer.'
      : 'Je n’arrive pas à savoir si tu peux changer le logo. Vérifie ta connexion.';
  }

  async function deposer(f) {
    var quoi = decrire(f);
    if (/svg|pdf/i.test(f.type || '') || /\.(svg|pdf)$/i.test(f.name || '') || (f.type && !/^image\//.test(f.type))) {
      dire('Ce fichier (' + quoi + ') n’est pas une image PNG ou JPEG. Enregistre ton logo dans un de ces formats et réessaie.', true);
      return;
    }
    if (f.size > POIDS_MAX) {
      dire('Ton fichier pèse ' + mo(f.size) + ' : 15 Mo au plus. Exporte ton logo en plus petit (2 000 px de large suffisent) et réessaie.', true);
      return;
    }
    dire('Préparation du logo…');
    var im;
    try { im = await lireFichier(f); } catch (e) { dire('Je n’arrive pas à lire cette image (' + quoi + '). Enregistre-la en PNG ou JPEG et réessaie.', true); return; }
    var d = dims(im);
    if (!d.w || !d.h) { dire('Cette image n’a pas de taille lisible (' + quoi + '). Enregistre-la en PNG ou JPEG et réessaie.', true); return; }
    quoi += ', ' + d.w + ' × ' + d.h + ' px';
    var r = preparer(im, f.type === 'image/png' ? 'image/png' : 'image/jpeg');
    if (r.echec === 'redessin') { dire('Ton navigateur n’a pas réussi à préparer cette image (' + quoi + '). Enregistre-la en JPEG, ou essaie depuis un autre navigateur.', true); return; }
    if (r.echec) { dire('Même réduite à 240 px, cette image reste trop chargée pour un logo (' + quoi + '). Garde le logo seul, sans photo ni dégradé de fond, et réessaie.', true); return; }
    var b = bureau();
    try {
      var l = await api('/rpc/domaine_logo_poser', { methode: 'POST',
        corps: { p_bureau: b, p_image: r.image, p_largeur: r.largeur, p_hauteur: r.hauteur } });
      var x = Array.isArray(l) ? l[0] : null;
      if (!x || !x.empreinte) throw new Error('rien ecrit');
      LOGO = { bureau: b, empreinte: x.empreinte, image: r.image, largeur: r.largeur, hauteur: r.hauteur };
      ecrireCache(LOGO); ETAT = 'lu'; PROMESSE = Promise.resolve(LOGO);
      peindreBloc(); peindreRail();
      document.dispatchEvent(new CustomEvent('bdv:logo'));
      var petit = r.hauteurSource < FLOU;
      dire(petit
        ? 'Logo enregistré. Il est petit et risque d’être flou sur le devis : si tu en as une version plus grande, dépose-la.'
        : 'Logo enregistré, il est déjà sur tes prochains devis.', petit);
    } catch (e) {
      dire(e && e.status === 403 || /42501/.test(String(e && e.detail || ''))
        ? 'Seul le maître du bureau peut changer le logo.'
        : 'Le logo n’a pas été enregistré. Vérifie ta connexion et réessaie.', true);
    }
  }

  async function enlever() {
    try {
      await api('/rpc/domaine_logo_retirer', { methode: 'POST', corps: { p_bureau: bureau() } });
      LOGO = null; ecrireCache(null); PROMESSE = Promise.resolve(null);
      peindreBloc(); peindreRail();
      document.dispatchEvent(new CustomEvent('bdv:logo'));
      dire('Logo retiré. Tes prochains devis sortiront avec le nom du domaine en tête.');
      var c = CIBLE && CIBLE.querySelector('.bdvl-choisir'); if (c) c.focus();
    } catch (e) {
      dire('Le logo n’a pas été retiré. Vérifie ta connexion et réessaie.', true);
    }
  }

  async function rafraichir() {
    await Promise.all([charger(), lireMaitre()]);
    peindreBloc();
  }

  /* ---------------- AU DEMARRAGE ---------------- */
  /* La copie de l'appareil d'abord (pas d'attente), la base ensuite. La barre est montee au
     DOMContentLoaded par le script de la page, avant celui-ci. */
  function demarrer() {
    if (!document.getElementById('bureauNav')) return;
    LOGO = lireCache();
    peindreRail();
    charger();
  }
  /* Un script differe s'execute AVANT DOMContentLoaded : la barre n'est pas encore montee, et
     son `innerHTML` effacerait la pastille. On attend donc l'evenement, dont l'ecouteur de la
     page (pose pendant l'analyse, donc avant le notre) monte la barre en premier. */
  if (document.readyState === 'complete') demarrer();
  else document.addEventListener('DOMContentLoaded', demarrer);
  document.addEventListener('bdv:bureau', function () { LOGO = lireCache(); charger(); });

  window.BdvLogo = {
    image: function () { return LOGO && FORME.test(LOGO.image) ? LOGO.image : null; },
    pret: pret, charger: charger, monter: monter, rafraichir: rafraichir,
    _preparer: preparer, _forme: FORME, _conditions: CONDITIONS
  };
})();
