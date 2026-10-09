/* ================================================================
   LE BUREAU DU VIGNERON, la signature des mails
   ----------------------------------------------------------------
   Ecrit le 07/10/2026, lot 75. Voir CLAUDE.md, regle « Aucun envoi d'e-mail sans
   l'accord du vigneron », et JOURNAL.md du 07/10/2026 (« l'onglet Mes envois »).

   Ce module tient l'onglet « Mes envois » des reglages et fabrique la signature que
   le bureau pose a la fin de ses mails. Arbitrages de Ted :
   - UNE SIGNATURE PAR PERSONNE (table `signatures`) : nom, role, portable, et deux
     reponses : la mettre dans les mails du bureau ; ma messagerie signe-t-elle deja.
   - UN BLOC COMMUN AU DOMAINE (table `signature_domaine`), regle par le MAITRE seul
     (la base refuse les autres, fonction `signature_domaine_poser`) : nom du domaine,
     appellation, une ligne d'action, un lien, l'actualite et SA DATE DE FIN, le pied
     legal.
   - L'ACTUALITE DISPARAIT SEULE A SA DATE DE FIN, et jamais sous un mail de souci
     (`promo: false`).
   - LA MENTION LOI EVIN suit la promotion : des que la signature porte un lien ou une
     actualite. A faire valider par un juriste de Solumatic (JOURNAL du 07/10).
   - Six lignes au plus avant le pied legal. Ni reseaux sociaux, ni e-mail recopie, ni TVA.

   `composer()` est PUR : il recoit ses donnees, il ne lit ni la page ni le reseau. C'est
   lui que le banc joue, et lui seul decide de ce que dit la signature. `suffixe()` est ce
   que les redacteurs collent apres « Bien a vous, » : vide si la personne ne veut pas de
   signature, si sa messagerie signe deja, ou si rien n'est lu.

   LOT 75 N'ENVOIE RIEN. Le mail part toujours de la messagerie du vigneron (mailto). Le
   logo n'est pas dans la signature copiee : Gmail refuse une image rangee dans le mail
   (caniemail, image-base64), il arrivera heberge au lot 78.
   Aucune donnee du vigneron ne passe par une chaine HTML sans `esc()`.
   ================================================================ */
(function () {
  'use strict';

  var PERSO = null;        // ma ligne de `signatures`, ou null
  var COMMUN = null;       // la ligne de `signature_domaine`, ou null
  var LU = false;          // les deux lectures ont-elles abouti
  var ABSENTE = false;     // les tables manquent (SQL du lot 75 pas passe)
  var MAITRE = null;       // true | false | null
  var TOUCHE_P = false, TOUCHE_C = false;
  var CHARGE = null;       // la promesse de lecture en cours

  var EVIN = 'L’abus d’alcool est dangereux pour la santé, à consommer avec modération.';
  var MAX = { nom: 80, role: 60, tel: 30, nom_domaine: 80, appellation: 80, action: 100, lien: 120, actualite: 90 };

  function el(id) { return document.getElementById(id); }
  function bureau() { return window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau(); }
  function moi() { return window.BdvCompte && BdvCompte.monId && BdvCompte.monId(); }
  function net(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function jourIso(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dateLongue(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return '';
    var M = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    var j = parseInt(p[2], 10);
    return (j === 1 ? '1er' : String(j)) + ' ' + M[parseInt(p[1], 10) - 1];
  }
  function ecartJours(a, b) {
    var x = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
    var y = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
    return Math.round((y - x) / 86400000);
  }

  /* Un lien s'ecrit comme on le tape (« closfertel.fr/boutique ») ; la base le range
     avec son https://. Rend '' si ce n'est pas une adresse web. */
  function lienNormal(s) {
    s = net(s);
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    return /^https?:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(\/[^\s<>"]*)?$/i.test(s) ? s : '';
  }
  function lienAffiche(s) { return String(s || '').replace(/^https?:\/\//i, '').replace(/\/$/, ''); }
  function telLien(t) {
    var d = String(t || '').replace(/[^\d+]/g, '');
    if (/^0\d{9}$/.test(d)) d = '+33' + d.slice(1);
    return d;
  }
  function siren(f) {
    var s = String((f && (f.siren || (f.siret && String(f.siret).slice(0, 9)))) || '').replace(/\D/g, '');
    return s.length === 9 ? s.slice(0, 3) + ' ' + s.slice(3, 6) + ' ' + s.slice(6) : '';
  }

  /* ---------------- LA SIGNATURE, CALCULEE ----------------
     d = { perso, commun, fiche (Mon domaine), profil (Toi), jour (AAAA-MM-JJ) }
     opts.promo === false : pas d'actualite (un mail de souci, une affaire perdue).
     Rend { lignes, pied, texte, html, actualite, evin, vide }. */
  function composer(d, opts) {
    d = d || {}; opts = opts || {};
    var p = d.perso || {}, c = d.commun || {}, f = d.fiche || {}, pr = d.profil || {};
    var jour = d.jour || jourIso();
    var nom = net(p.nom) || net(pr.prenom);
    var dom = net(c.nom_domaine) || net(pr.domaine) || net(f.raison_sociale);
    var app = net(c.appellation);
    var role = net(p.role);
    var tel = net(p.telephone) || net(f.telephone);
    var action = net(c.action);
    var lien = c.lien ? lienNormal(c.lien) : '';
    var actu = (opts.promo !== false && net(c.actualite) && c.actualite_fin && String(c.actualite_fin) >= jour) ? net(c.actualite) : '';

    var l2 = dom ? dom + (app ? ' (' + app + ')' : '') : app;
    var ligne2 = role && l2 ? role + ', ' + l2 : (role || l2);
    var lignes = [];
    if (nom) lignes.push({ k: 'nom', t: nom });
    if (ligne2) lignes.push({ k: 'role', t: ligne2 });
    if (tel) lignes.push({ k: 'tel', t: tel });
    if (action) lignes.push({ k: 'action', t: action });
    if (lien) lignes.push({ k: 'lien', t: lienAffiche(lien), href: lien });
    if (actu) lignes.push({ k: 'actu', t: actu });

    var pied = [];
    if (c.pied_legal !== false) {
      var raison = net(f.raison_sociale), forme = net(f.forme_juridique);
      if (raison && forme && raison.toUpperCase().indexOf(forme.toUpperCase()) < 0) raison = forme + ' ' + raison;
      var s = siren(f);
      var leg = [raison, s ? 'SIREN ' + s : '', net(f.rcs_ville) ? 'RCS ' + net(f.rcs_ville) : ''].filter(Boolean);
      if (leg.length && (s || net(f.rcs_ville))) pied.push(leg.join(', '));
    }
    var evin = !!(lien || actu);
    if (evin) pied.push(EVIN);

    var vide = !lignes.length;
    var texte = vide ? '' : lignes.map(function (x) { return x.t; }).join('\n') + (pied.length ? '\n\n' + pied.join('\n') : '');

    /* LE HTML D'UN MAIL N'A PAS DE FEUILLE DE STYLE : tout en style de ligne, valeurs en
       dur, chacune avec le jeton dont elle est copiee (regle du courrier du matin, CLAUDE.md
       « Les couleurs en dur dans bdv-courrier.js »). */
    var html = '';
    if (!vide) {
      var C = { ink: '#1E2536' /* --ink */, muted: '#63523D' /* --muted */, bordeaux: '#5A1525' /* --bordeaux */ };
      var h = ['<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:' + C.ink + ';">'];
      lignes.forEach(function (x) {
        if (x.k === 'nom') h.push('<div style="font-size:14px;font-weight:bold;">' + esc(x.t) + '</div>');
        else if (x.k === 'tel') h.push('<div><a href="tel:' + esc(telLien(x.t)) + '" style="color:' + C.ink + ';text-decoration:none;">' + esc(x.t) + '</a></div>');
        else if (x.k === 'lien') h.push('<div><a href="' + esc(x.href) + '" style="color:' + C.bordeaux + ';">' + esc(x.t) + '</a></div>');
        else h.push('<div>' + esc(x.t) + '</div>');
      });
      if (pied.length) h.push('<div style="margin-top:8px;font-size:11px;color:' + C.muted + ';">' + pied.map(esc).join('<br>') + '</div>');
      h.push('</div>');
      html = h.join('');
    }
    return { lignes: lignes, pied: pied, texte: texte, html: html, actualite: actu, evin: evin, vide: vide };
  }

  function donnees() {
    return {
      perso: PERSO, commun: COMMUN,
      fiche: window.BdvDomaine && BdvDomaine.fiche ? BdvDomaine.fiche() : null,
      profil: window.BdvReglages && BdvReglages.profil ? BdvReglages.profil() : null,
      jour: jourIso()
    };
  }

  /* Ce que les redacteurs collent apres « Bien a vous, ». */
  function suffixe(opts) {
    if (!LU || !PERSO) return '';
    if (PERSO.dans_mails === false || PERSO.messagerie_signe === true) return '';
    var s = composer(donnees(), opts);
    return s.vide ? '' : '\n\n' + s.texte;
  }

  /* ---------------- LA LECTURE ET L'ECRITURE ---------------- */
  function charger() {
    var b = bureau(), m = moi();
    if (!b || !m || !window.BdvCompte) return Promise.resolve(null);
    if (CHARGE) return CHARGE;
    CHARGE = (async function () {
      try {
        var r = await Promise.all([
          BdvCompte.api('/signatures?select=*&bureau=eq.' + encodeURIComponent(b) + '&personne=eq.' + encodeURIComponent(m)),
          BdvCompte.api('/signature_domaine?select=*&bureau=eq.' + encodeURIComponent(b)),
          BdvCompte.api('/rpc/est_maitre', { methode: 'POST', corps: { b: b } }).catch(function () { return null; }),
          window.BdvDomaine && BdvDomaine.charger && !BdvDomaine.fiche() ? BdvDomaine.charger().catch(function () { return null; }) : null
        ]);
        PERSO = (Array.isArray(r[0]) && r[0][0]) || null;
        COMMUN = (Array.isArray(r[1]) && r[1][0]) || null;
        MAITRE = r[2] === true ? true : (r[2] === false ? false : null);
        LU = Array.isArray(r[0]) && Array.isArray(r[1]);
        ABSENTE = false;
      } catch (e) {
        LU = false;
        ABSENTE = !!e && (e.status === 404 || /PGRST|42P01/.test(String(e.detail || '')));
      }
      CHARGE = null;
      return LU;
    })();
    return CHARGE;
  }

  function lirePerso() {
    return {
      nom: net(el('bdvsNom') && el('bdvsNom').value) || null,
      role: net(el('bdvsRole') && el('bdvsRole').value) || null,
      telephone: net(el('bdvsTel') && el('bdvsTel').value) || null,
      dans_mails: !(el('bdvsMessSigne') && el('bdvsMessSigne').checked),
      messagerie_signe: !!(el('bdvsMessSigne') && el('bdvsMessSigne').checked)
    };
  }
  function lireCommun() {
    var actu = net(el('bdvsActu') && el('bdvsActu').value);
    return {
      nom_domaine: net(el('bdvsDomaine') && el('bdvsDomaine').value) || null,
      appellation: net(el('bdvsAppellation') && el('bdvsAppellation').value) || null,
      action: net(el('bdvsAction') && el('bdvsAction').value) || null,
      lien: lienNormal(el('bdvsLien') && el('bdvsLien').value) || null,
      lienBrut: net(el('bdvsLien') && el('bdvsLien').value),
      actualite: actu || null,
      actualite_fin: actu ? ((el('bdvsActuFin') && el('bdvsActuFin').value) || null) : null,
      pied_legal: !el('bdvsPied') || el('bdvsPied').checked
    };
  }

  /* Ce que la base refuserait, dit AVANT d'envoyer et dans les mots du vigneron. */
  function defauts(p, c, jour) {
    var d = [];
    jour = jour || jourIso();
    if (p) {
      if (p.nom && p.nom.length > MAX.nom) d.push('Ton nom tient en ' + MAX.nom + ' caractères.');
      if (p.role && p.role.length > MAX.role) d.push('Ton rôle tient en ' + MAX.role + ' caractères.');
      if (p.telephone && !/^[0-9 +().-]{6,30}$/.test(p.telephone)) d.push('Le téléphone ne s’écrit qu’avec des chiffres, des espaces et le signe +.');
    }
    if (c) {
      if (c.nom_domaine && c.nom_domaine.length > MAX.nom_domaine) d.push('Le nom du domaine tient en ' + MAX.nom_domaine + ' caractères.');
      if (c.appellation && c.appellation.length > MAX.appellation) d.push('L’appellation tient en ' + MAX.appellation + ' caractères.');
      if (c.action && c.action.length > MAX.action) d.push('La ligne pour faire venir tient en ' + MAX.action + ' caractères.');
      if (c.lienBrut && !c.lien) d.push('Le lien n’est pas une adresse web (exemple : closfertel.fr/boutique).');
      if (c.lien && c.lien.length > MAX.lien) d.push('Le lien tient en ' + MAX.lien + ' caractères.');
      if (c.actualite && c.actualite.length > MAX.actualite) d.push('L’actualité tient en une ligne, ' + MAX.actualite + ' caractères.');
      if (c.actualite && !c.actualite_fin) d.push('Indique jusqu’à quand ton actualité est vraie : elle disparaîtra seule ce jour-là.');
      if (c.actualite && c.actualite_fin && c.actualite_fin < jour) d.push('La date de fin de ton actualité est passée.');
    }
    return d;
  }

  async function enregistrer() {
    if (!TOUCHE_P && !TOUCHE_C) return;
    if (!el('bdvsNom')) return;
    var b = bureau();
    if (!b) throw new Error('sans bureau');
    var p = TOUCHE_P ? lirePerso() : null;
    var c = (TOUCHE_C && MAITRE === true) ? lireCommun() : null;
    var d = defauts(p, c);
    if (d.length) { dire(d.join(' '), true); throw new Error('signature invalide'); }
    if (p) {
      p.bureau = b;
      var l = await BdvCompte.api('/signatures?on_conflict=bureau,personne', {
        methode: 'POST', corps: p, entetes: { 'Prefer': 'resolution=merge-duplicates,return=representation' } });
      /* Une ecriture qui ne rend aucune ligne n'a rien ecrit (regle du lot 34). */
      if (!Array.isArray(l) || !l.length) { dire('Ta signature n’a pas été enregistrée. Réessaie.', true); throw new Error('rien ecrit'); }
      PERSO = l[0]; TOUCHE_P = false;
    }
    if (c) {
      var r = await BdvCompte.api('/rpc/signature_domaine_poser', { methode: 'POST', corps: {
        p_bureau: b, p_nom: c.nom_domaine, p_appellation: c.appellation, p_action: c.action, p_lien: c.lien,
        p_actualite: c.actualite, p_actualite_fin: c.actualite_fin, p_pied_legal: c.pied_legal } });
      if (!Array.isArray(r) || !r.length) { dire('La partie du domaine n’a pas été enregistrée. Réessaie.', true); throw new Error('rien ecrit'); }
      COMMUN = r[0]; TOUCHE_C = false;
    }
    dire('Signature enregistrée.');
    peindre();
  }

  /* ---------------- LA COPIE ----------------
     Safari exige que l'ecriture parte DANS le geste : le ClipboardItem se construit dans
     le clic, sans attente avant (webkit.org, « Async Clipboard API »). Repli : une zone
     editable hors ecran et `execCommand('copy')`. */
  function copier(sorte, s) {
    var texte = s.texte, html = s.html;
    function repli() {
      try {
        var z = document.createElement(sorte === 'texte' ? 'textarea' : 'div');
        z.style.position = 'fixed'; z.style.left = '-9999px'; z.style.top = '0';
        if (sorte === 'texte') z.value = texte; else { z.contentEditable = 'true'; z.innerHTML = html; }
        document.body.appendChild(z);
        if (sorte === 'texte') z.select();
        else { var r = document.createRange(); r.selectNodeContents(z); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
        var ok = document.execCommand && document.execCommand('copy');
        z.remove();
        return Promise.resolve(!!ok);
      } catch (e) { return Promise.resolve(false); }
    }
    try {
      if (sorte !== 'texte' && navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
        var item = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([texte], { type: 'text/plain' }) });
        return navigator.clipboard.write([item]).then(function () { return true; }, repli);
      }
      if (sorte === 'texte' && navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(texte).then(function () { return true; }, repli);
      }
    } catch (e) { /* le repli ci-dessous */ }
    return repli();
  }

  var ETAPES = {
    gmail: ['Dans Gmail, sur ordinateur : la roue dentée en haut à droite, puis « Voir tous les paramètres ».',
            'Onglet « Général », rubrique « Signature » : « Créer », donne-lui un nom, puis colle (Cmd + V sur Mac, Ctrl + V sur PC).',
            'Tout en bas de la page : « Enregistrer les modifications ».'],
    outlook: ['Dans Outlook : la roue dentée (Paramètres), puis « Comptes » et « Signatures ».',
              '« Nouvelle signature », donne-lui un nom, puis colle dans la zone.',
              'Choisis-la pour les nouveaux messages et les réponses, puis « Enregistrer ».'],
    texte: ['Sur l’iPhone : Réglages, puis Mail (dans « Apps » sur les iPhone récents), puis « Signature ».',
            'Efface ce qui y est et colle.',
            'C’est enregistré tout seul. Dans l’app Gmail : ton portrait, « Paramètres », ton compte, « Signature mobile ».']
  };

  /* ---------------- L'ECRAN ---------------- */
  function dire(m, alerte) {
    var p = el('bdvsMot');
    if (!p) return;
    p.textContent = m || '';
    p.classList.toggle('bdvr-aide--alerte', !!alerte);
  }
  function mk(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function champ(parent, id, libelle, opts) {
    opts = opts || {};
    var c = mk('div', 'bdvr-champ' + (opts.plein ? ' bdvr-champ--plein' : ''));
    var l = mk('label', 'bdvr-l', libelle); l.htmlFor = id;
    var i = mk('input', 'bdvr-i'); i.id = id; i.type = opts.type || 'text';
    if (opts.auto) i.autocomplete = opts.auto;
    if (opts.max) i.maxLength = opts.max;
    if (opts.place) i.placeholder = opts.place;
    if (opts.mode) i.inputMode = opts.mode;
    c.appendChild(l); c.appendChild(i);
    if (opts.aide) { var a = mk('p', 'bdvr-aide', opts.aide); a.id = id + 'Aide'; i.setAttribute('aria-describedby', a.id); c.appendChild(a); }
    parent.appendChild(c);
    return i;
  }
  function sousTitre(parent, texte) { parent.appendChild(mk('h3', 'bdvd-sous', texte)); }

  function monter(cible) {
    cible.textContent = '';
    /* L'ETAT D'ABORD, en une phrase (designer-vigneron) : c'est la question que pose
       quelqu'un qui ouvre cet onglet. Au lot 75 il n'y a qu'une reponse. */
    var etat = mk('p', 'bdvs-etat', 'Tes mails partent de ta messagerie : le bureau prépare le texte, ta messagerie l’ouvre, tu cliques sur Envoyer.');
    etat.id = 'bdvsEtat';
    cible.appendChild(etat);
    var mot = mk('p', 'bdvr-aide'); mot.id = 'bdvsMot'; mot.setAttribute('role', 'status');
    cible.appendChild(mot);
    var abs = mk('p', 'bdvr-aide bdvr-aide--alerte', 'La signature n’est pas encore disponible sur ce bureau.');
    abs.id = 'bdvsAbsente'; abs.hidden = true;
    cible.appendChild(abs);

    var corps = mk('div', 'bdvs-corps'); corps.id = 'bdvsCorps';
    var gauche = mk('div', 'bdvs-reglages');
    var droite = mk('div', 'bdvs-apercu-zone');

    sousTitre(gauche, 'Ta signature');
    var g = mk('div', 'bdvr-grille');
    champ(g, 'bdvsNom', 'Ton prénom et ton nom', { auto: 'name', max: MAX.nom });
    champ(g, 'bdvsRole', 'Ton rôle au domaine', { max: MAX.role, place: (window.BdvCompte && BdvCompte.accord ? BdvCompte.accord('Vigneron', 'Vigneronne', 'Responsable du domaine') : 'Vigneron'), aide: 'Le client sait à qui il parle.' });
    champ(g, 'bdvsTel', 'Ton téléphone direct', { type: 'tel', auto: 'tel', mode: 'tel', max: MAX.tel,
      aide: 'Le portable de préférence : un caviste qui hésite appelle. Vide, c’est celui du domaine.' });
    gauche.appendChild(g);

    var q = mk('div', 'bdvr-groupe bdvs-question');
    var qt = mk('p', 'bdvr-push-etat', 'Ta messagerie ajoute-t-elle déjà ta signature ?'); qt.id = 'bdvsQTitre';
    q.appendChild(qt);
    var lab1 = mk('label', 'bdvr-chk'); var r1 = mk('input'); r1.type = 'radio'; r1.name = 'bdvsMess'; r1.id = 'bdvsMessBureau';
    lab1.appendChild(r1); lab1.appendChild(document.createTextNode(' Non : le bureau la met à la fin de ses mails'));
    var lab2 = mk('label', 'bdvr-chk'); var r2 = mk('input'); r2.type = 'radio'; r2.name = 'bdvsMess'; r2.id = 'bdvsMessSigne';
    lab2.appendChild(r2); lab2.appendChild(document.createTextNode(' Oui : le bureau n’en met pas, sinon ton client en reçoit deux'));
    q.setAttribute('role', 'radiogroup'); q.setAttribute('aria-labelledby', 'bdvsQTitre');
    q.appendChild(lab1); q.appendChild(lab2);
    gauche.appendChild(q);

    sousTitre(gauche, 'Pour tout le domaine');
    var qui = mk('p', 'bdvr-aide'); qui.id = 'bdvsQui'; gauche.appendChild(qui);
    var gc = mk('div', 'bdvr-grille'); gc.id = 'bdvsCommun';
    champ(gc, 'bdvsDomaine', 'Nom du domaine', { max: MAX.nom_domaine, place: 'Domaine du Clos Fertel' });
    champ(gc, 'bdvsAppellation', 'Appellation ou région', { max: MAX.appellation, place: 'Saumur-Champigny' });
    champ(gc, 'bdvsAction', 'Une ligne pour faire venir', { plein: true, max: MAX.action,
      place: 'Caveau ouvert du mardi au samedi, 10 h-12 h 30 et 14 h 30-18 h',
      aide: 'Une seule : les horaires du caveau, la dégustation sur rendez-vous ou la boutique en ligne.' });
    champ(gc, 'bdvsLien', 'Un lien (ton site ou ta boutique)', { plein: true, type: 'url', max: MAX.lien, place: 'closfertel.fr/boutique', auto: 'url' });
    /* La date de fin colle a son actualite, et dit qu'elle est obligatoire (vigneron, lot 75). */
    var iActu = champ(gc, 'bdvsActu', 'L’actualité du moment', { plein: true, max: MAX.actualite,
      place: 'Salon des Vins de Loire, Angers, stand B12' });
    var iFin = champ(gc, 'bdvsActuFin', 'Jusqu’au (obligatoire si tu écris une actualité)', { type: 'date', plein: true });
    gauche.appendChild(gc);
    var aActu = mk('p', 'bdvr-aide', 'Écris seulement ce qui est vrai aujourd’hui. Elle disparaît seule à sa date de fin, et ne se met jamais sous un mail de mauvaise nouvelle.');
    aActu.id = 'bdvsActuAide'; iActu.setAttribute('aria-describedby', 'bdvsActuAide'); iFin.setAttribute('aria-describedby', 'bdvsActuAide');
    gauche.appendChild(aActu);
    var actuMot = mk('p', 'bdvr-aide'); actuMot.id = 'bdvsActuMot'; actuMot.hidden = true; gauche.appendChild(actuMot);
    var lp = mk('label', 'bdvr-chk'); var cp = mk('input'); cp.type = 'checkbox'; cp.id = 'bdvsPied';
    lp.appendChild(cp); lp.appendChild(document.createTextNode(' Le pied légal : raison sociale, SIREN et RCS, pris dans Mon domaine'));
    gauche.appendChild(lp);
    gauche.appendChild(mk('p', 'bdvr-aide', 'Dès que la signature porte un lien ou une actualité, le bureau ajoute « L’abus d’alcool est dangereux pour la santé, à consommer avec modération » : c’est de la publicité pour du vin (loi Évin).'));

    /* L'APERCU : un vrai petit mail, a la largeur d'un telephone (expert commercial :
       le caviste le lit d'un pouce). */
    sousTitre(droite, 'Ce que reçoit ton client');
    var ap = mk('div', 'bdvs-apercu'); ap.id = 'bdvsApercu'; ap.setAttribute('aria-live', 'polite');
    droite.appendChild(ap);
    var apMot = mk('p', 'bdvr-aide'); apMot.id = 'bdvsApercuMot'; droite.appendChild(apMot);

    sousTitre(droite, 'La mettre aussi dans ta messagerie');
    droite.appendChild(mk('p', 'bdvr-aide', 'Pour tes mails écrits sans le bureau. Copie-la, puis colle-la dans les réglages de ta messagerie.'));
    var bts = mk('div', 'bdvs-copies');
    [['gmail', 'Copier pour Gmail'], ['outlook', 'Copier pour Outlook'], ['texte', 'Copier pour l’iPhone']].forEach(function (x) {
      var b = mk('button', 'bdvr-btn bdvr-btn--creux', x[1]); b.type = 'button'; b.setAttribute('data-bdvs-copier', x[0]);
      bts.appendChild(b);
    });
    droite.appendChild(bts);
    var et = mk('div', 'bdvs-etapes'); et.id = 'bdvsEtapes'; et.setAttribute('aria-live', 'polite'); et.hidden = true;
    droite.appendChild(et);

    corps.appendChild(gauche); corps.appendChild(droite);
    cible.appendChild(corps);

    cible.addEventListener('input', function (e) { toucher(e.target); });
    cible.addEventListener('change', function (e) { toucher(e.target); });
    cible.addEventListener('click', function (e) {
      var bo = e.target.closest && e.target.closest('[data-bdvs-oui]');
      if (bo) {
        e.preventDefault();
        var r2 = el('bdvsMessSigne'); r2.checked = true; el('bdvsMessBureau').checked = false;
        toucher(r2);
        bo.remove();
        dire('C’est noté : le bureau ne mettra plus de signature. Pense à enregistrer.');
        return;
      }
      var b = e.target.closest && e.target.closest('[data-bdvs-copier]');
      if (!b) return;
      e.preventDefault();
      var sorte = b.getAttribute('data-bdvs-copier');
      var s = composer(donneesEcran());
      if (s.vide) { dire('Ta signature est vide : écris au moins ton nom.', true); return; }
      copier(sorte === 'texte' ? 'texte' : 'html', s).then(function (ok) { montrerEtapes(sorte, ok); });
    });
    peindre();
    charger().then(peindre);
  }

  function toucher(t) {
    if (!t || !t.id || t.id.indexOf('bdvs') !== 0) return;
    if (['bdvsNom', 'bdvsRole', 'bdvsTel', 'bdvsMessBureau', 'bdvsMessSigne'].indexOf(t.id) >= 0) TOUCHE_P = true;
    else TOUCHE_C = true;
    peindreApercu();
    peindreActu();
  }

  /* L'apercu suit ce qui est TAPE, pas ce qui est enregistre. */
  function donneesEcran() {
    var d = donnees();
    if (el('bdvsNom')) d.perso = Object.assign({}, PERSO || {}, lirePerso());
    if (el('bdvsDomaine') && MAITRE === true) d.commun = Object.assign({}, COMMUN || {}, lireCommun());
    return d;
  }

  function montrerEtapes(sorte, ok) {
    var z = el('bdvsEtapes'); if (!z) return;
    z.textContent = '';
    z.appendChild(mk('p', ok ? 'bdvs-copie-ok' : 'bdvr-aide bdvr-aide--alerte',
      ok ? 'Copiée. Maintenant :' : 'La copie n’a pas marché sur ce navigateur. Sélectionne la signature dans l’aperçu et copie-la à la main.'));
    if (ok) {
      var ol = mk('ol', 'bdvs-etapes__l');
      ETAPES[sorte].forEach(function (t) { ol.appendChild(mk('li', null, t)); });
      z.appendChild(ol);
      /* LA BOUCLE AVEC LA QUESTION DU HAUT (vigneron, lot 75) : collee dans la messagerie,
         la signature ne doit plus etre ajoutee par le bureau, sinon le client en recoit deux. */
      var oui = el('bdvsMessSigne');
      if (oui && !oui.checked) {
        z.appendChild(mk('p', 'bdvr-aide', 'Une fois collée dans ta messagerie, réponds « Oui » à la question du haut, sinon ton client en reçoit deux.'));
        var bo = mk('button', 'bdvr-btn bdvr-btn--creux', 'Passer sur Oui'); bo.type = 'button'; bo.setAttribute('data-bdvs-oui', '1');
        z.appendChild(bo);
      }
    }
    z.hidden = false;
  }

  function peindreActu() {
    var m = el('bdvsActuMot'); if (!m) return;
    var c = (el('bdvsDomaine') && MAITRE === true) ? lireCommun() : (COMMUN || {});
    var jour = jourIso(), t = '';
    if (c.actualite && c.actualite_fin) {
      var n = ecartJours(jour, String(c.actualite_fin));
      if (n < 0) t = 'Ton actualité a disparu des mails le ' + dateLongue(String(c.actualite_fin)) + ' : remplace-la ou efface-la.';
      else if (n <= 5) t = 'Ton actualité disparaît des mails le ' + dateLongue(String(c.actualite_fin)) + '. Tu veux la remplacer ?';
    }
    m.textContent = t; m.hidden = !t;
  }

  function peindreApercu() {
    var ap = el('bdvsApercu'); if (!ap) return;
    var d = donneesEcran();
    var s = composer(d);
    ap.textContent = '';
    ap.appendChild(mk('p', 'bdvs-apercu__t', 'Bonjour Madame Martin,'));
    ap.appendChild(mk('p', 'bdvs-apercu__t', 'Merci pour votre commande. Elle part chez vous jeudi.'));
    ap.appendChild(mk('p', 'bdvs-apercu__t', 'Bien à vous,'));
    var sig = mk('div', 'bdvs-apercu__sig');
    if (s.vide) sig.appendChild(mk('p', 'bdvs-apercu__vide', 'Ta signature apparaîtra ici quand tu auras écrit ton nom.'));
    s.lignes.forEach(function (x) {
      var p = mk('p', 'bdvs-sig bdvs-sig--' + x.k, x.t);
      sig.appendChild(p);
    });
    if (s.pied.length) {
      var pd = mk('p', 'bdvs-sig bdvs-sig--pied');
      s.pied.forEach(function (t, i) { if (i) pd.appendChild(document.createElement('br')); pd.appendChild(document.createTextNode(t)); });
      sig.appendChild(pd);
    }
    ap.appendChild(sig);
    var mm = el('bdvsApercuMot');
    if (mm) {
      var signe = el('bdvsMessSigne') && el('bdvsMessSigne').checked;
      mm.textContent = signe
        ? 'Ta messagerie signe déjà : le bureau ne met rien sous ses mails. Cet aperçu sert à la copier dans ta messagerie.'
        : 'Le bureau la met sous ses mails, en texte simple : c’est ta messagerie qui les envoie, et elle rendra peut-être le lien cliquable.';
    }
  }

  function peindre() {
    if (!el('bdvsNom')) return;
    var abs = el('bdvsAbsente'), corps = el('bdvsCorps');
    if (abs) abs.hidden = !ABSENTE;
    if (corps) corps.hidden = ABSENTE;
    if (ABSENTE) return;
    var pr = (window.BdvReglages && BdvReglages.profil && BdvReglages.profil()) || {};
    var f = (window.BdvDomaine && BdvDomaine.fiche && BdvDomaine.fiche()) || {};
    var p = PERSO || {}, c = COMMUN || {};
    if (!TOUCHE_P) {
      el('bdvsNom').value = p.nom || net(pr.prenom) || '';
      el('bdvsRole').value = p.role || '';
      el('bdvsTel').value = p.telephone || '';
      el('bdvsMessSigne').checked = p.messagerie_signe === true;
      el('bdvsMessBureau').checked = p.messagerie_signe !== true;
    }
    if (!TOUCHE_C) {
      el('bdvsDomaine').value = c.nom_domaine || net(pr.domaine) || net(f.raison_sociale) || '';
      el('bdvsAppellation').value = c.appellation || '';
      el('bdvsAction').value = c.action || '';
      el('bdvsLien').value = c.lien ? lienAffiche(c.lien) : '';
      el('bdvsActu').value = c.actualite || '';
      el('bdvsActuFin').value = c.actualite_fin || '';
      el('bdvsActuFin').min = jourIso();
      el('bdvsPied').checked = c.pied_legal !== false;
    }
    /* SEUL LE MAITRE ecrit le bloc commun : la base refuse les autres. On le dit, et les
       champs passent en lecture seule (pas `disabled` : ils restent lisibles et atteignables). */
    var maitre = MAITRE === true;
    ['bdvsDomaine', 'bdvsAppellation', 'bdvsAction', 'bdvsLien', 'bdvsActu', 'bdvsActuFin'].forEach(function (id) { el(id).readOnly = !maitre; });
    el('bdvsPied').disabled = !maitre;
    /* Les consignes d'ecriture ne servent qu'a qui ecrit (vigneron, lot 75). */
    ['bdvsActionAide', 'bdvsActuAide'].forEach(function (id) { if (el(id)) el(id).hidden = !maitre; });
    var lf = document.querySelector('label[for="bdvsActuFin"]');
    if (lf) lf.textContent = maitre ? 'Jusqu’au (obligatoire si tu écris une actualité)' : 'Jusqu’au';
    var qui = el('bdvsQui');
    if (qui) qui.textContent = maitre
      ? 'Commun à tout le bureau : chacun l’a sous son nom. Le pied légal se règle dans Mon domaine (raison sociale, SIREN, RCS).'
      : (MAITRE === false ? 'Réglé par un administrateur du bureau, pour tout le bureau. Pour changer une ligne, demande-lui.' : 'Commun à tout le bureau.');
    peindreApercu();
    peindreActu();
  }

  function rafraichir() { TOUCHE_P = false; TOUCHE_C = false; return charger().then(peindre); }

  function brancher() {
    if (!window.BdvReglages || !BdvReglages.brancher) return false;
    BdvReglages.brancher({ blocs: [{ hote: 'envois', monter: monter, rafraichir: rafraichir, enregistrer: enregistrer }] });
    return true;
  }
  if (!brancher()) document.addEventListener('DOMContentLoaded', brancher);
  /* La signature doit etre lue AVANT le premier mail redige, pas seulement a l'ouverture
     des reglages : on la lit des que le bureau est connu. */
  function lireTot() { if (bureau()) charger(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lireTot); else lireTot();
  document.addEventListener('bdv:bureau', lireTot);

  window.BdvSignature = { composer: composer, suffixe: suffixe, charger: charger, lue: function () { return LU; },
    perso: function () { return PERSO; }, commun: function () { return COMMUN; },
    _defauts: defauts, _lienNormal: lienNormal, EVIN: EVIN };
})();
