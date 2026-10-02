/* ============================================================================
   BDV-SIGNER.JS  LA PAGE OU LE CLIENT SIGNE SON DEVIS (lot 55, 01/10/2026)
   ============================================================================
   Sert /signer/. Le jeton est apres le # : il ne part ni au serveur du site, ni
   dans un Referer. La page ne parle qu'a la fonction Edge `signature`, qui appelle
   la base avec la cle de service ; elle ne decide de RIEN, elle montre ce que la
   base rend.

   CE QUE LE CLIENT SIGNE, C'EST LA COPIE QU'IL VOIT. La page renvoie l'empreinte
   de la copie qu'elle a montree ; si elle ne correspond plus a celle du devis, la
   base refuse. La copie s'affiche dans une iframe SANS SCRIPT (`sandbox` sans
   allow-scripts) : meme origine pour la mesurer et l'imprimer, rien ne s'y execute.

   LE CLIENT EST VOUVOYE (regle du depot pour les clients du vigneron).
   ========================================================================= */
(function () {
  'use strict';

  var FONCTION = 'https://qukmncqqwomhmrdhvetj.supabase.co/functions/v1/signature';
  var A4 = 794;

  var JETON = '', DEVIS = null;

  function el(id) { return document.getElementById(id); }
  function montrer(id, oui) { var n = el(id); if (n) n.hidden = !oui; }

  function jetonDeLAdresse() {
    var h = String(location.hash || '').replace(/^#/, '').trim().toLowerCase();
    var m = /^(?:j=)?([0-9a-f]{64})$/.exec(h);
    return m ? m[1] : '';
  }
  /* « 1 648,50 € » : espace INSECABLE ORDINAIRE (U+00A0) entre les milliers et avant le
     symbole (juge W3, 02/10/2026). Intl.NumberFormat pose une espace FINE (U+202F) que la
     police de repli du telephone n'a pas toujours : le caviste lisait « 1648,50 € ». Toutes
     les polices ont U+00A0. */
  function euros(c) {
    var n = Number(c);
    if (!isFinite(n)) return '';
    n = Math.round(n);
    var signe = n < 0 ? '-' : '';
    n = Math.abs(n);
    var e = Math.floor(n / 100), r = n - e * 100;
    return signe + String(e).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + ',' + (r < 10 ? '0' : '') + r + '\u00a0€';
  }
  function jour(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    var t = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    return t.replace(/^1 /, '1er ');
  }
  function quand(horo) {
    var d = new Date(horo);
    if (isNaN(d.getTime())) return '';
    var j = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(d).replace(/^1 /, '1er ');
    var h = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(d);
    return j + ' à ' + h.replace(':', ' h ');
  }
  function empreinteLisible(e) { return String(e || '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1 '); }

  /* LE CONTACT DU DOMAINE EN DEUX LIENS (juge W9, 02/10/2026) : « Appeler le ... » et
     « Écrire à ... », chacun une fois, chacun une cible de 44 px. L'adresse n'est plus redite
     dans la phrase. `d` porte `vendeur_email` et `vendeur_tel` (ce que rend la fonction Edge,
     meme pour un lien eteint : le contact public du domaine, rien du devis). */
  function telLien(t) {
    var s = String(t || '').trim();
    var ch = s.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    return /^\+?\d{8,15}$/.test(ch) ? ch : '';
  }
  function liensContact(d) {
    var p = el('sigFinC');
    p.innerHTML = '';
    var mail = d && d.vendeur_email && /^[^\s@<>"]+@[^\s@<>"]+$/.test(d.vendeur_email) ? d.vendeur_email : '';
    var tel = d && telLien(d.vendeur_tel) ? String(d.vendeur_tel).trim() : '';
    function lien(href, txt) {
      var a = document.createElement('a');
      a.href = href;
      a.textContent = txt;
      a.style.display = 'inline-flex';
      a.style.alignItems = 'center';
      a.style.minHeight = '44px';
      p.appendChild(a);
    }
    if (tel) lien('tel:' + telLien(tel), 'Appeler le ' + tel);
    if (mail) lien('mailto:' + mail, 'Écrire à ' + mail);
    p.hidden = !(tel || mail);
  }
  function fin(titre, phrase, d) {
    montrer('sigAttente', false);
    montrer('sigDevis', false);
    el('sigFinT').textContent = titre;
    el('sigFinP').textContent = phrase;
    liensContact(d || null);
    montrer('sigFin', true);
  }
  function contact(d) {
    var v = d && d.vendeur ? d.vendeur : 'le domaine qui vous l’a envoyé';
    return 'Contactez ' + v + '.';
  }
  /* L'EN-TETE EST CELUI DU DOMAINE (juge V7) : son nom et le numero du devis, rien d'autre. */
  function entete(d) {
    if (d && d.vendeur) el('sigVendeur').textContent = d.vendeur;
    el('sigNumero').textContent = d && d.numero ? 'Devis ' + d.numero : '';
  }
  /* LE CADRE « BON POUR ACCORD » REMPLI A L'AFFICHAGE, apres signature (juge V7). La copie
     gardee ne change pas : son empreinte est celle qui a ete signee, et c'est le document de
     l'iframe, ici, qu'on complete pour le lecteur. La page le dit sous la feuille. */
  function remplirAccord(f) {
    var d = DEVIS;
    if (!f || !d || d.etat !== 'signe') return;
    var doc = null;
    try { doc = f.contentDocument; } catch (e) { doc = null; }
    if (!doc) return;
    var c = doc.querySelectorAll('.dpap__accord .dpap__case');
    if (c.length < 3) return;
    c[0].textContent = 'Date : ' + quand(d.signe_le);
    c[1].textContent = 'Nom et qualité du signataire : ' + (d.signe_nom || '') + (d.signe_qualite ? ', ' + d.signe_qualite : '');
    c[2].textContent = 'Signature et cachet : signé en ligne, case « Bon pour accord » cochée.';
  }
  /* X5 (tour 3) : LES VINS SE LISENT DANS LE RESUME, une ligne par vin en 16 px : « 12 × Le
     Rosé 2025, 75 cl, 106,80 € HT ». A 390 la feuille est reduite a 45 %, ses lettres font 6 px :
     le nombre de vins seul ne disait pas QUOI. Lu dans la copie montree (celle que l'empreinte
     garantit), jamais dans une deuxieme source : textContent seulement, aucun HTML recopie. */
  function compterVins(f) {
    var rangs = [];
    try { rangs = [].slice.call(f.contentDocument.querySelectorAll('.dpap__table tbody tr')); } catch (e) { rangs = []; }
    var n = rangs.length;
    var p = el('sigResVins');
    p.textContent = n ? (n === 1 ? '1 vin au devis :' : n + ' vins au devis :') : '';
    p.hidden = !n;
    var ul = el('sigResListe');
    if (!ul) return;
    ul.textContent = '';
    rangs.forEach(function (tr) {
      var td = tr.querySelectorAll('td');
      if (td.length < 3) return;
      var vin = td[0].cloneNode(true);
      [].forEach.call(vin.querySelectorAll('.dpap__code'), function (c) { c.remove(); });
      var nom = vin.textContent.replace(/\s+/g, ' ').trim();
      var qte = td[1].textContent.trim(), tot = td[td.length - 1].textContent.replace(/[\s\u202f]+/g, '\u00a0').trim();
      var li = document.createElement('li');
      li.textContent = qte + '\u00a0×\u00a0' + nom + ', ' + tot + '\u00a0HT';
      ul.appendChild(li);
    });
    ul.hidden = !ul.children.length;
  }

  /* LA FEUILLE A4 RENDUE A SA VRAIE LARGEUR, PUIS REDUITE A LA PLACE QU'ON A. La hauteur est
     celle du CONTENU de la feuille (juge W2, 02/10/2026) : on mesurait `scrollHeight`, qui ne
     descend jamais sous la hauteur deja donnee a l'iframe, plancher A4 de 1 123 px en plus, et
     la premiere mesure tombait sur l'iframe a sa largeur par defaut (300 px), ou le devis se
     repliait en une colonne tres haute. Resultat : 600 a 800 px de blanc sous le devis, et le
     caviste croyait la page finie. On pose la largeur A4 D'ABORD, puis on mesure le bas de
     `.dpap__feuille`. */
  function hauteurDuContenu(doc) {
    var n = doc.querySelector('.dpap__feuille') || doc.body;
    var h = n && n.getBoundingClientRect ? n.getBoundingClientRect().bottom : 0;
    var b = doc.body ? doc.body.getBoundingClientRect().bottom : 0;
    h = Math.max(h, b);
    return h > 0 ? Math.ceil(h) : (doc.documentElement.scrollHeight || 1);
  }
  function ajuster() {
    var f = el('sigFeuille'), w = el('sigFeuilleW');
    if (!f || !w || !f.contentDocument || !f.contentDocument.documentElement) return;
    f.style.width = A4 + 'px';
    var h = hauteurDuContenu(f.contentDocument);
    var k = Math.min(1, (w.clientWidth || A4) / A4);
    f.style.height = h + 'px';
    f.style.transform = 'scale(' + k + ')';
    f.style.transformOrigin = '0 0';
    /* + les bordures du cadre : la hauteur posee compte le cadre entier. */
    w.style.height = (Math.ceil(h * k) + Math.max(0, (w.offsetHeight || 0) - (w.clientHeight || 0))) + 'px';
  }
  function poserFeuille(html) {
    var w = el('sigFeuilleW');
    w.innerHTML = '';
    if (!html) { w.hidden = true; return; }
    var f = document.createElement('iframe');
    f.id = 'sigFeuille';
    f.title = 'Le devis ' + (DEVIS.numero || '');
    f.setAttribute('sandbox', 'allow-same-origin allow-modals');
    f.style.border = '0';
    f.style.display = 'block';
    f.style.width = A4 + 'px';
    /* Le cadre « Bon pour accord » se remplit AVANT la mesure : il change la hauteur. Puis la
       feuille est suivie : une police qui arrive tard ne la coupe pas. */
    f.addEventListener('load', function () {
      remplirAccord(f); ajuster(); compterVins(f);
      try {
        var RO = f.contentWindow && f.contentWindow.ResizeObserver, n = f.contentDocument.querySelector('.dpap__feuille');
        if (RO && n) new RO(function () { ajuster(); }).observe(n);
      } catch (e) {}
    });
    f.srcdoc = html;
    w.appendChild(f);
    setTimeout(ajuster, 600);
  }
  window.addEventListener('resize', ajuster);

  function peindre(d) {
    DEVIS = d;
    var et = d && d.etat;
    entete(d);
    if (et === 'inconnu' || !et) {
      fin('Ce lien ne correspond à aucun devis',
        'Il a peut-être été coupé en deux par votre messagerie, ou remplacé par un lien plus récent. Ouvrez le dernier message reçu et recliquez dessus, ou contactez le domaine qui vous a envoyé le devis.');
      return;
    }
    if (et === 'expire') {
      fin('Ce devis a expiré', 'Le devis ' + (d.numero || '') + ' était valable jusqu’au ' + jour(d.valable_jusqu)
        + '. Il ne se signe plus en ligne. ' + contact(d), d);
      return;
    }
    /* D7 : le domaine a accepte le devis pendant que le client signait (ou avant). La fonction
       Edge lit le statut du devis (`devis_statut`) : on le dit, au lieu de « remplace ». */
    if (et === 'clos' && d.devis_statut === 'accepte') {
      fin(d.devis_signe ? 'Ce devis a déjà été signé' : 'Ce devis a déjà été accepté par le domaine',
        'Le devis ' + (d.numero || '') + (d.devis_signe ? ' a déjà été signé en ligne' : ' a déjà été accepté par ' + (d.vendeur || 'le domaine'))
        + ' : il n’y a plus rien à signer. Pour toute question, contactez ' + (d.vendeur || 'le domaine') + '.', d);
      return;
    }
    if (et === 'clos') {
      fin('Ce devis n’est plus à signer', 'Le devis ' + (d.numero || '') + ' a été remplacé, retiré ou n’est plus disponible à la signature. ' + contact(d), d);
      return;
    }
    /* D6 : le lien a bien ete signe, mais le domaine a ANNULE l'acceptation depuis. La base garde
       la preuve, donc l'etat reste « signe » ; le statut du devis dit qu'il ne vaut plus. Sans ce
       garde, le client lisait « le domaine a bien recu votre accord » sur un accord annule. */
    if (et === 'signe' && d.devis_statut && (d.devis_statut !== 'accepte' || d.devis_signe === false)) {
      fin('Ce devis n’est plus valable', 'Vous aviez signé le devis ' + (d.numero || '') + (d.signe_le ? ' le ' + quand(d.signe_le) : '')
        + ', mais ' + (d.vendeur || 'le domaine') + ' a annulé son acceptation depuis : il ne vaut plus commande. Contactez '
        + (d.vendeur || 'le domaine') + ' pour savoir où il en est.', d);
      return;
    }
    montrer('sigAttente', false);
    montrer('sigFin', false);
    montrer('sigDevis', true);
    /* LE RESUME, LISIBLE SANS LA FEUILLE (juge V7) : a 390 px la copie est reduite a 45 %, ses
       lettres font 6 px. Le client, le total HT puis TTC, la validite et le nombre de vins se
       lisent ici en 16 px. Espaces insecables entre le nombre et son unite. */
    el('sigResClient').textContent = d.client ? 'Pour ' + d.client : '';
    el('sigResClient').hidden = !d.client;
    el('sigResTotal').textContent = 'Total ' + euros(d.total_ht_c) + '\u00a0HT, soit ' + euros(d.total_ttc_c) + '\u00a0TTC';
    el('sigResValid').textContent = d.valable_jusqu ? 'Valable jusqu’au ' + jour(d.valable_jusqu) : '';
    el('sigResValid').hidden = !d.valable_jusqu;
    if (et === 'signe') {
      el('sigIntro').innerHTML = '';
      var b = document.createElement('b');
      b.textContent = 'Devis signé le ' + quand(d.signe_le) + ' par ' + (d.signe_nom || '') + (d.signe_qualite ? ' (' + d.signe_qualite + ')' : '') + '.';
      el('sigIntro').appendChild(b);
      el('sigIntro').appendChild(document.createTextNode(' ' + (d.vendeur || 'Le domaine') + ' a bien reçu votre accord sur le devis ' + (d.numero || '') + '.'
        + ' Vous pouvez imprimer le devis pour vos dossiers.'));
      el('sigTitre').textContent = 'Devis signé';
      montrer('sigForm', false);
      montrer('sigAller', false);
    } else {
      el('sigIntro').textContent = (d.vendeur || 'Le domaine') + ' vous a envoyé le devis ' + (d.numero || '')
        + (d.client ? ' pour ' + d.client : '') + '. Lisez-le, puis signez avec le bouton «\u00a0Signer ce devis\u00a0».';
      el('sigAuNomDe').textContent = d.client || 'votre entreprise';
      el('sigAuNomDe2').textContent = d.client || 'votre entreprise';
      el('sigTitre').textContent = 'Signer le devis ' + (d.numero || '');
      montrer('sigForm', true);
      montrer('sigAller', true);
      surveillerForm();
    }
    el('sigEmpreinte').textContent = d.empreinte ? 'Empreinte numérique du devis : ' + empreinteLisible(d.empreinte)
      + '. Elle change si une seule lettre du devis change.'
      + (et === 'signe' ? ' Le cadre « Bon pour accord » est rempli ici à l’affichage ; la copie gardée par le domaine, celle de cette empreinte, n’a pas changé.' : '') : '';
    poserFeuille(d.papier || '');
  }

  function erreur(t, champ) {
    var n = el('sigErreur');
    n.textContent = t || '';
    n.hidden = !t;
    if (champ) { var c = el(champ); if (c) { c.setAttribute('aria-invalid', 'true'); try { c.focus(); } catch (e) {} } }
  }

  async function lire() {
    try {
      var r = await fetch(FONCTION + '?j=' + encodeURIComponent(JETON), { headers: { Accept: 'application/json' }, cache: 'no-store' });
      var d = await r.json();
      if (!r.ok || d.erreur) throw new Error(d.erreur || r.status);
      peindre(d);
    } catch (e) {
      fin('Le devis n’a pas pu s’ouvrir', 'Vérifiez votre connexion et rechargez la page. Si cela continue, contactez le domaine qui vous a envoyé le devis.');
    }
  }

  var EN_COURS = false;
  async function signer(ev) {
    ev.preventDefault();
    if (EN_COURS || !DEVIS || DEVIS.etat !== 'a_signer') return;
    ['sigNom', 'sigQualite', 'sigAccord'].forEach(function (i) { el(i).removeAttribute('aria-invalid'); });
    var nom = el('sigNom').value.trim(), qual = el('sigQualite').value.trim(), ok = el('sigAccord').checked;
    if (nom.length < 2) return erreur('Indiquez votre nom et prénom.', 'sigNom');
    if (qual.length < 2) return erreur('Indiquez votre fonction dans l’entreprise.', 'sigQualite');
    if (!ok) return erreur('Cochez « Bon pour accord » pour signer.', 'sigAccord');
    erreur('');
    EN_COURS = true;
    var b = el('sigSigner');
    b.setAttribute('aria-busy', 'true');
    b.textContent = 'Signature en cours…';
    var d = null;
    try {
      var r = await fetch(FONCTION, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ j: JETON, nom: nom, qualite: qual, accord: true, empreinte: DEVIS.empreinte })
      });
      d = await r.json();
      if (!r.ok || d.erreur) d = null;
    } catch (e) { d = null; }
    EN_COURS = false;
    b.removeAttribute('aria-busy');
    b.textContent = 'Je signe le devis';
    if (!d) return erreur('La signature n’est pas partie : vérifiez votre connexion et réessayez. Rien n’a été signé.');
    if (d.refus === 'nom') return erreur('Indiquez votre nom et prénom.', 'sigNom');
    if (d.refus === 'qualite') return erreur('Indiquez votre fonction dans l’entreprise.', 'sigQualite');
    if (d.refus === 'accord') return erreur('Cochez « Bon pour accord » pour signer.', 'sigAccord');
    if (d.refus === 'empreinte') {
      erreur('Le devis a changé depuis que vous l’avez ouvert. Il se recharge : relisez-le avant de signer.');
      return lire();
    }
    if (d.bloque) {
      fin('Ce devis ne peut pas être signé pour l’instant', 'Il manque une information de son côté. ' + contact(DEVIS), DEVIS);
      return;
    }
    peindre(d);
    var t = el('sigIntro');
    if (t) { t.setAttribute('tabindex', '-1'); try { t.focus(); } catch (e) {} }
  }

  /* « SIGNER CE DEVIS », COLLE EN BAS (juge V7) : il mene au formulaire et s'efface quand le
     formulaire est a l'ecran, pour ne jamais le couvrir. Sans IntersectionObserver, il reste. */
  var GARDE = null;
  function surveillerForm() {
    if (GARDE || typeof IntersectionObserver !== 'function') return;
    GARDE = new IntersectionObserver(function (e) {
      var vu = e.some(function (x) { return x.isIntersecting; });
      /* `visibility` et pas `hidden` : la barre garde sa place, rien ne saute sous le doigt
         quand le formulaire arrive ou repart. */
      var b = el('sigAller');
      if (b && DEVIS && DEVIS.etat === 'a_signer') b.style.visibility = vu ? 'hidden' : '';
    }, { threshold: 0 });
    GARDE.observe(el('sigForm'));
  }
  function allerSigner() {
    var f = el('sigForm');
    try { f.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { try { f.scrollIntoView(); } catch (x) {} }
    var n = el('sigNom');
    if (n) { try { n.focus({ preventScroll: true }); } catch (e) { try { n.focus(); } catch (x) {} } }
  }

  function imprimer() {
    var f = el('sigFeuille');
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {}
  }

  function demarrer() {
    JETON = jetonDeLAdresse();
    el('sigForm').addEventListener('submit', signer);
    el('sigImprimer').addEventListener('click', imprimer);
    el('sigAllerB').addEventListener('click', allerSigner);
    if (!JETON) {
      fin('Ce lien est incomplet', 'Il manque la fin de l’adresse. Ouvrez le message reçu et recliquez sur le lien, ou copiez-le en entier dans votre navigateur.');
      return;
    }
    lire();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
