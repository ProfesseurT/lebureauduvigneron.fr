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
  function euros(c) {
    var n = Number(c);
    if (!isFinite(n)) return '';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n / 100);
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

  function fin(titre, phrase) {
    montrer('sigAttente', false);
    montrer('sigDevis', false);
    el('sigFinT').textContent = titre;
    el('sigFinP').textContent = phrase;
    montrer('sigFin', true);
  }
  function contact(d) {
    var v = d && d.vendeur ? d.vendeur : 'le domaine qui vous l’a envoyé';
    return 'Contactez ' + v + (d && d.vendeur_email ? ' (' + d.vendeur_email + ')' : '') + '.';
  }

  /* La feuille A4 rendue a sa vraie largeur, puis reduite a la place qu'on a. */
  function ajuster() {
    var f = el('sigFeuille'), w = el('sigFeuilleW');
    if (!f || !w || !f.contentDocument || !f.contentDocument.documentElement) return;
    var h = Math.max(f.contentDocument.documentElement.scrollHeight || 0, 1123);
    var k = Math.min(1, (w.clientWidth || A4) / A4);
    f.style.width = A4 + 'px';
    f.style.height = h + 'px';
    f.style.transform = 'scale(' + k + ')';
    f.style.transformOrigin = '0 0';
    w.style.height = Math.ceil(h * k) + 'px';
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
    f.addEventListener('load', ajuster);
    f.srcdoc = html;
    w.appendChild(f);
    setTimeout(ajuster, 600);
  }
  window.addEventListener('resize', ajuster);

  function peindre(d) {
    DEVIS = d;
    var et = d && d.etat;
    if (et === 'inconnu' || !et) {
      fin('Ce lien ne correspond à aucun devis',
        'Il a peut-être été coupé en deux par votre messagerie, ou remplacé par un lien plus récent. Ouvrez le dernier message reçu et recliquez dessus, ou contactez le domaine qui vous a envoyé le devis.');
      return;
    }
    if (et === 'expire') {
      fin('Ce devis a expiré', 'Le devis ' + (d.numero || '') + ' était valable jusqu’au ' + jour(d.valable_jusqu)
        + '. Il ne se signe plus en ligne. ' + contact(d));
      return;
    }
    if (et === 'clos') {
      fin('Ce devis n’est plus à signer', 'Le devis ' + (d.numero || '') + ' a été remplacé, retiré ou n’est plus disponible à la signature. ' + contact(d));
      return;
    }
    montrer('sigAttente', false);
    montrer('sigFin', false);
    montrer('sigDevis', true);
    var tot = ' Total ' + euros(d.total_ht_c) + ' HT, ' + euros(d.total_ttc_c) + ' TTC.';
    if (et === 'signe') {
      el('sigIntro').innerHTML = '';
      var b = document.createElement('b');
      b.textContent = 'Devis signé le ' + quand(d.signe_le) + ' par ' + (d.signe_nom || '') + (d.signe_qualite ? ' (' + d.signe_qualite + ')' : '') + '.';
      el('sigIntro').appendChild(b);
      el('sigIntro').appendChild(document.createTextNode(' ' + (d.vendeur || 'Le domaine') + ' a bien reçu votre accord sur le devis ' + (d.numero || '') + '.' + tot
        + ' Vous pouvez imprimer le devis pour vos dossiers.'));
      montrer('sigForm', false);
    } else {
      el('sigIntro').textContent = (d.vendeur || 'Le domaine') + ' vous a envoyé le devis ' + (d.numero || '')
        + (d.client ? ' pour ' + d.client : '') + '.' + tot
        + (d.valable_jusqu ? ' Valable jusqu’au ' + jour(d.valable_jusqu) + '.' : '') + ' Lisez-le, puis signez en bas de la page.';
      el('sigAuNomDe').textContent = d.client || 'votre entreprise';
      el('sigAuNomDe2').textContent = d.client || 'votre entreprise';
      montrer('sigForm', true);
    }
    el('sigEmpreinte').textContent = d.empreinte ? 'Empreinte numérique du devis : ' + empreinteLisible(d.empreinte)
      + '. Elle change si une seule lettre du devis change.' : '';
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
      fin('Ce devis ne peut pas être signé pour l’instant', 'Il manque une information de son côté. ' + contact(DEVIS));
      return;
    }
    peindre(d);
    var t = el('sigIntro');
    if (t) { t.setAttribute('tabindex', '-1'); try { t.focus(); } catch (e) {} }
  }

  function imprimer() {
    var f = el('sigFeuille');
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {}
  }

  function demarrer() {
    JETON = jetonDeLAdresse();
    el('sigForm').addEventListener('submit', signer);
    el('sigImprimer').addEventListener('click', imprimer);
    if (!JETON) {
      fin('Ce lien est incomplet', 'Il manque la fin de l’adresse. Ouvrez le message reçu et recliquez sur le lien, ou copiez-le en entier dans votre navigateur.');
      return;
    }
    lire();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
