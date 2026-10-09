/* ================================================================
   LE BUREAU DU VIGNERON, les listes vers Brevo (lot 89, 09/10/2026)
   ----------------------------------------------------------------
   Arbitrages de Ted (CLAUDE.md « LOT 89 ») : depuis « Mes clients » ou « Mon commerce », le
   bureau CREE une liste neuve et datee dans Brevo (adresse e-mail et mobile) ; le vigneron
   ecrit et envoie sa campagne DANS Brevo. Tout membre peut le faire.
   ECARTES D'OFFICE (une case les remet) : les clients en recul confirme, et ceux qui portent
   l'etiquette « Gros client ». ECARTES TOUJOURS : un nouveau client qui a demande a ne plus etre
   contacte, et (cote serveur) tout contact desinscrit du compte Brevo.
   Ici, rien d'autre que le CALCUL de la liste et son dessin : la fonction Edge `brevo`
   (action `liste`) cree la liste chez Brevo apres avoir lu sa liste noire.

   UN MOBILE, C'EST LA COLONNE « Mobile » de Vitisoft, et jamais le fixe : un SMS vers un fixe
   ne part pas. Un numero francais n'y est garde que s'il commence par 06 ou 07. Pour un nouveau
   client, le seul numero connu n'est garde que s'il est un mobile francais. On n'invente jamais
   d'indicatif : un numero sans indicatif connu ne part pas.
   ================================================================ */
(function () {
  'use strict';

  var EN_COURS = false;
  var ETAT = null;      // { cible, source, titre, ids, calc, garderRecul, garderGros }

  function bureau() { return window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau(); }
  function mk(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function nb(n, un, plusieurs) {
    return (n === 0 ? 'aucun' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')) + ' ' + (n > 1 ? plusieurs : un);
  }
  function sansAccent(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /* Brevo est branche sur le bureau (meme refuse : le serveur dira pourquoi). */
  function pret() {
    var b = window.BdvBrevo && BdvBrevo._etat ? BdvBrevo._etat() : null;
    return !!(b && b.LU && b.BREVO);
  }

  /* ------------------------------------------------------------ les contacts d'un client */
  var MOBILE_FR = /^\+33[67]\d{8}$/;
  var INTER = /^\+[1-9]\d{7,14}$/;
  function mobileGarde(appel) {
    if (!INTER.test(appel || '')) return '';
    if (/^\+33/.test(appel) && !MOBILE_FR.test(appel)) return '';
    return appel;
  }
  /* Le mobile de chaque client demande, lu dans la colonne Mobile de la ligne la plus recente. */
  function mobilesVitisoft(ids) {
    var out = {}, jour = {};
    if (typeof ROWS === 'undefined' || !Array.isArray(ROWS) || typeof parseTels !== 'function' || typeof clientKey !== 'function') return out;
    for (var i = 0; i < ROWS.length; i++) {
      var r = ROWS[i];
      if (!r || !r.mobile) continue;
      var id = clientKey(r);
      if (!ids.has(id)) continue;
      var j = r._dayNum == null ? -1 : r._dayNum;
      if (out[id] && jour[id] > j) continue;
      var t = parseTels(r.mobile, r.pays);
      for (var k = 0; k < t.length; k++) {
        var m = mobileGarde(t[k].appel);
        if (m) { out[id] = m; jour[id] = j; break; }
      }
    }
    return out;
  }
  function piste(id) {
    var nv = window.bdvNouveaux;
    return nv && nv.get ? nv.get(id) : null;
  }
  function reculs() {
    var s = new Set();
    try {
      if (typeof agentDecrochage === 'function') (agentDecrochage().decroche || []).forEach(function (c) { s.add(c.id); });
    } catch (e) { /* sans calcul de recul, personne n'est ecarte a ce titre */ }
    return s;
  }
  function estGros(id) {
    var s = (typeof CRM !== 'undefined' && CRM && CRM[id]) || {};
    return (s.tags || []).some(function (t) { var n = sansAccent(t); return n === 'gros client' || n === 'gros clients'; });
  }

  /* LE CALCUL : pour chaque client, son adresse et son mobile, et la raison qui l'ecarte. */
  function calculer(ids) {
    var vit = new Set(ids.filter(function (id) { return String(id).indexOf('p:') !== 0; }));
    var mob = mobilesVitisoft(vit);
    var rec = reculs();
    var c = { total: 0, sans: 0, opposition: 0, recul: [], gros: [], bons: [] };   // bons : tous les joignables
    ids.forEach(function (id) {
      c.total++;
      var e = '', s = '';
      if (String(id).indexOf('p:') === 0) {
        var p = piste(id);
        if (!p) { c.sans++; return; }
        if (p.opposition) { c.opposition++; return; }
        var em = typeof parseEmails === 'function' ? parseEmails(p.email) : [];
        e = em[0] || '';
        var tl = typeof parseTels === 'function' ? parseTels(p.telephone, p.pays) : [];
        for (var k = 0; k < tl.length; k++) { if (MOBILE_FR.test(tl[k].appel)) { s = tl[k].appel; break; } }
      } else {
        /* Un nouveau client relie a Vitisoft garde sa demande de ne plus etre contacte. */
        var li = window.bdvNouveaux && bdvNouveaux.lie ? bdvNouveaux.lie(id) : null;
        if (li && li.opposition) { c.opposition++; return; }
        e = typeof emailOf === 'function' ? emailOf(id) : '';
        s = mob[id] || '';
      }
      if (!e && !s) { c.sans++; return; }
      /* Un client peut etre a la fois en recul et « Gros client » : il ne part que si les
         deux cases qui le concernent sont cochees. */
      var x = { id: id, e: e, s: s, recul: rec.has(id), gros: estGros(id) };
      if (x.recul) c.recul.push(x);
      if (x.gros) c.gros.push(x);
      c.bons.push(x);
    });
    return c;
  }
  function aEnvoyer() {
    return ETAT.calc.bons.filter(function (x) {
      return (!x.recul || ETAT.garderRecul) && (!x.gros || ETAT.garderGros);
    });
  }

  /* ------------------------------------------------------------ le dessin */
  function nomParDefaut(titre) {
    var d = new Date();
    var z = function (n) { return (n < 10 ? '0' : '') + n; };
    return (titre + ' - ' + z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + z(d.getHours()) + 'h' + z(d.getMinutes())).slice(0, 100);
  }

  function fermer() {
    if (ETAT && ETAT.cible) { ETAT.cible.textContent = ''; ETAT.cible.hidden = true; }
    var b = ETAT && ETAT.bouton;
    ETAT = null;
    if (b && document.body.contains(b)) b.focus();
  }

  function dire(t, alerte) {
    var p = ETAT && ETAT.cible && ETAT.cible.querySelector('.bdvbl-mot');
    if (!p) return;
    p.textContent = t || '';
    p.className = 'bdvr-aide bdvbl-mot' + (alerte ? ' bdvr-aide--alerte' : '');
    p.hidden = !t;
  }

  function peindre() {
    var z = ETAT.cible, c = ETAT.calc;
    z.textContent = '';
    z.hidden = false;
    var t = mk('h3', 'bdvd-sous', 'Créer une liste dans Brevo'); t.id = 'bdvblTitre'; t.tabIndex = -1;
    z.appendChild(t);
    z.appendChild(mk('p', 'bdvr-aide', 'Le bureau crée une liste neuve dans ton compte Brevo, avec l’adresse et le mobile de ces clients. Tu écris et tu envoies ta campagne dans Brevo : le bureau n’envoie rien.'));
    if (typeof lignesPretes === 'function' && !lignesPretes()) {
      z.appendChild(mk('p', 'bdvr-aide bdvr-aide--alerte', 'Tes ventes ne sont pas toutes chargées sur cet appareil : des adresses et des mobiles peuvent manquer. Attends la fin du chargement pour une liste complète.'));
    }
    var ul = mk('ul', 'bdvbl-compte');
    var envoi = aEnvoyer();
    var nm = envoi.filter(function (x) { return x.e; }).length, ns = envoi.filter(function (x) { return x.s; }).length;
    ul.appendChild(mk('li', '', nb(c.total, 'client', 'clients') + ' dans ta liste.'));
    if (c.sans) ul.appendChild(mk('li', '', nb(c.sans, 'client', 'clients') + ' sans adresse ni mobile : ' + (c.sans > 1 ? 'ils ne partent pas.' : 'il ne part pas.')));
    if (c.opposition) ul.appendChild(mk('li', '', nb(c.opposition, 'client a', 'clients ont') + ' demandé à ne plus être ' + (c.opposition > 1 ? 'contactés : ils ne partent jamais.' : 'contacté : il ne part jamais.')));
    z.appendChild(ul);

    if (c.recul.length) z.appendChild(caseEcart('bdvblRecul', ETAT.garderRecul,
      nb(c.recul.length, 'client', 'clients') + ' en recul confirmé, ' + (c.recul.length > 1 ? 'écartés' : 'écarté') + ' d’office : un client qui recule mérite un appel plutôt qu’une campagne.',
      'Les mettre quand même dans la liste'));
    if (c.gros.length) z.appendChild(caseEcart('bdvblGros', ETAT.garderGros,
      nb(c.gros.length, 'client', 'clients') + ' avec l’étiquette « Gros client », ' + (c.gros.length > 1 ? 'écartés' : 'écarté') + ' d’office.',
      'Les mettre quand même dans la liste'));

    var res = mk('p', 'bdvbl-resume');
    var b = mk('b', '', nb(envoi.length, 'contact', 'contacts') + ' à mettre dans la liste');
    res.appendChild(b);
    res.appendChild(document.createTextNode(envoi.length ? ' : ' + nb(nm, 'adresse', 'adresses') + ', ' + nb(ns, 'mobile', 'mobiles') + '.' : '.'));
    z.appendChild(res);
    z.appendChild(mk('p', 'bdvr-aide', 'Au moment de créer la liste, le bureau relit ton compte Brevo et écarte chaque contact qui s’y est désinscrit.'));

    var ch = mk('div', 'bdvr-champ bdvr-champ--plein');
    var l = mk('label', 'bdvr-l', 'Nom de la liste dans Brevo'); l.htmlFor = 'bdvblNom';
    var i = mk('input', 'bdvr-i'); i.id = 'bdvblNom'; i.type = 'text'; i.maxLength = 100; i.value = ETAT.nom;
    ch.appendChild(l); ch.appendChild(i); z.appendChild(ch);

    var g = mk('div', 'bdvb-gestes');
    var ok = mk('button', 'btn btn--primary btn--sm', envoi.length ? 'Créer la liste dans Brevo' : 'Personne à mettre dans la liste');
    ok.type = 'button'; ok.id = 'bdvblCreer'; ok.disabled = !envoi.length || EN_COURS;
    var no = mk('button', 'btn btn--ghost btn--sm', 'Fermer'); no.type = 'button'; no.id = 'bdvblFermer';
    g.appendChild(ok); g.appendChild(no); z.appendChild(g);
    var mot = mk('p', 'bdvr-aide bdvbl-mot'); mot.setAttribute('role', 'status'); mot.hidden = true; z.appendChild(mot);
    var h = mk('div', 'bdvbl-histo'); h.id = 'bdvblHisto'; z.appendChild(h);
    historique();
  }
  function caseEcart(id, coche, texte, libelle) {
    var d = mk('div', 'bdvbl-ecart');
    d.appendChild(mk('p', 'bdvr-aide', texte));
    var l = mk('label', 'chk');
    var c = mk('input'); c.type = 'checkbox'; c.id = id; c.checked = !!coche; c.disabled = EN_COURS;
    l.appendChild(c); l.appendChild(document.createTextNode(' ' + libelle));
    d.appendChild(l);
    return d;
  }

  /* Les trois dernieres listes du bureau, pour savoir ce qui est deja parti. */
  async function historique() {
    var h = document.getElementById('bdvblHisto');
    var b = bureau();
    if (!h || !b || !window.BdvCompte) return;
    var l = null;
    try { l = await BdvCompte.api('/brevo_listes?select=id,le,nom,envoyes,ecartes,process_id&bureau=eq.' + encodeURIComponent(b) + '&order=le.desc&limit=3'); }
    catch (e) { l = null; }
    h = document.getElementById('bdvblHisto');
    if (!h || !Array.isArray(l) || !l.length) return;
    h.textContent = '';
    h.appendChild(mk('p', 'bdvbl-histo__t', 'Dernières listes créées par le bureau'));
    var ul = mk('ul', 'bdvbl-histo__l');
    l.forEach(function (x) {
      var li = mk('li');
      var d = new Date(x.le);
      li.appendChild(mk('span', '', String(x.nom || '') + ', ' + (isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })) + ', ' + nb(Number(x.envoyes) || 0, 'contact', 'contacts')));
      if (x.process_id) {
        var bt = mk('button', 'btn btn--ghost btn--sm', 'Où en est-elle ?'); bt.type = 'button';
        bt.dataset.process = String(x.process_id);
        li.appendChild(document.createTextNode(' '));
        li.appendChild(bt);
      }
      ul.appendChild(li);
    });
    h.appendChild(ul);
  }

  var STATUTS = { queued: 'en attente chez Brevo', in_process: 'en cours de rangement', processing: 'en cours de rangement',
    completed: 'rangée', failed: 'refusée par Brevo', cancelled: 'annulée chez Brevo' };
  async function ouEnEst(process) {
    dire('Je demande à Brevo…');
    var r = null;
    try { r = await BdvCompte.fonction('brevo', { action: 'liste_etat', bureau: bureau(), process: Number(process) }); }
    catch (e) { r = null; }
    if (!r || r.resultat !== 'etat') { dire((r && r.mot) || 'Brevo n’a pas répondu. Réessaie dans un moment.', true); return; }
    var s = STATUTS[r.statut] || 'dans un état que le bureau ne connaît pas';
    var t = 'La liste est ' + s + '.';
    if (r.soucis && r.soucis.length) t += ' Brevo a mis de côté ' + r.soucis.join(', ') + ' : le détail est dans Brevo, menu Contacts, Importations.';
    dire(t, r.statut === 'failed');
  }

  async function creer() {
    if (EN_COURS || !ETAT) return;
    var avant = aEnvoyer().length;
    ETAT.calc = calculer(lesIds());
    var envoi = aEnvoyer();
    var champ = document.getElementById('bdvblNom');
    if (ETAT.perime || envoi.length !== avant) {
      ETAT.perime = false;
      ETAT.nom = champ ? champ.value : ETAT.nom;
      peindre();
      dire('Ta liste a changé avec tes filtres : vérifie les nombres, puis clique de nouveau sur « Créer la liste dans Brevo ».', true);
      return;
    }
    var nom = String(champ && champ.value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 100);
    if (!nom) { dire('Donne un nom à la liste.', true); if (champ) champ.focus(); return; }
    if (!envoi.length) return;
    if (envoi.length > 5000) { dire('Une liste part avec 5 000 contacts au plus. Resserre tes filtres.', true); return; }
    EN_COURS = true;
    var bt = document.getElementById('bdvblCreer');
    if (bt) { bt.disabled = true; bt.textContent = 'Création en cours…'; }
    var cases = ETAT.cible.querySelectorAll('input[type="checkbox"]');
    cases.forEach(function (x) { x.disabled = true; });
    dire('Le bureau relit ton compte Brevo, puis crée la liste. Ça peut prendre une minute.');
    var r = null;
    try {
      r = await BdvCompte.fonction('brevo', { action: 'liste', bureau: bureau(), source: ETAT.source, nom: nom,
        contacts: envoi.map(function (x) { var o = {}; if (x.e) o.e = x.e; if (x.s) o.s = x.s; return o; }) });
    } catch (e) {
      /* Une reponse perdue ne prouve pas que rien n'est parti : Brevo a peut-etre cree la liste. */
      r = { resultat: 'erreur', mot: e && e.status === 413 ? 'Cette liste est trop longue pour partir d’un coup. Resserre tes filtres.'
        : e && e.status >= 400 && e.status < 500 ? 'La liste n’a pas pu être créée. Rien n’est parti.'
        : 'Le bureau n’a pas eu la réponse de Brevo. Regarde dans Brevo (Contacts, Listes) si la liste « ' + nom + ' » existe avant de réessayer.' };
    }
    EN_COURS = false;
    if (!ETAT) return;
    bt = document.getElementById('bdvblCreer');
    if (r && r.resultat === 'creee') {
      ETAT.nom = nomParDefaut(ETAT.titre);
      peindre();
      var t = 'Liste « ' + r.nom + ' » créée dans Brevo : ' + nb(r.envoyes, 'contact', 'contacts')
        + ' (' + nb(r.avec_mail, 'adresse', 'adresses') + ', ' + nb(r.avec_mobile, 'mobile', 'mobiles') + ').';
      if (r.ecartes) t += ' ' + nb(r.ecartes, 'désinscrit écarté', 'désinscrits écartés') + '.';
      if (r.retires) t += ' ' + nb(r.retires, 'doublon ou adresse invalide retiré', 'doublons ou adresses invalides retirés') + '.';
      t += ' Brevo la range en quelques minutes, dans le dossier « Le bureau du vigneron » (Contacts, Listes). Tu peux y écrire ta campagne.';
      dire(t);
      var m = ETAT.cible.querySelector('.bdvbl-mot'); if (m) { m.tabIndex = -1; try { m.focus(); } catch (e) {} }
      return;
    }
    if (bt) { bt.disabled = false; bt.textContent = 'Créer la liste dans Brevo'; }
    ETAT.cible.querySelectorAll('input[type="checkbox"]').forEach(function (x) { x.disabled = false; });
    if (r && (r.resultat === 'refusee' || r.resultat === 'ip') && window.BdvBrevo && BdvBrevo.charger) BdvBrevo.charger();
    dire((r && r.mot) || 'La liste n’a pas pu être créée. Rien n’est parti. Réessaie dans un moment.', true);
  }

  function surClic(e) {
    var t = e.target; if (!t) return;
    if (t.id === 'bdvblCreer') creer();
    else if (t.id === 'bdvblFermer') fermer();
    else if (t.dataset && t.dataset.process) ouEnEst(t.dataset.process);
  }
  function surChange(e) {
    var t = e.target; if (!t || !ETAT) return;
    if (t.id === 'bdvblRecul' || t.id === 'bdvblGros') {
      if (t.id === 'bdvblRecul') ETAT.garderRecul = t.checked; else ETAT.garderGros = t.checked;
      var champ = document.getElementById('bdvblNom');
      if (champ) ETAT.nom = champ.value;
      peindre();
      var c = document.getElementById(t.id); if (c) c.focus();
    }
  }

  /* `ids` est la liste, ou une fonction qui la rend : la piece la relit quand ses filtres
     bougent, pour que ce qui part soit ce que l'ecran montre. */
  function lesIds() {
    var l = typeof ETAT.lesIds === 'function' ? ETAT.lesIds() : (ETAT.lesIds || []);
    var ids = [], vus = new Set();
    l.forEach(function (id) { if (!vus.has(id)) { vus.add(id); ids.push(id); } });
    return ids;
  }
  /* Les filtres de la piece ont change : on recompte. Si quelqu'un tape dans le bloc, on ne le
     repeint pas sous ses doigts : le recompte se fera au clic sur « Creer ». */
  function rafraichir() {
    if (!ETAT || !ETAT.cible || !document.body.contains(ETAT.cible) || ETAT.cible.hidden || EN_COURS) return;
    ETAT.calc = calculer(lesIds());
    if (ETAT.cible.contains(document.activeElement)) { ETAT.perime = true; return; }
    var champ = document.getElementById('bdvblNom'); if (champ) ETAT.nom = champ.value;
    peindre();
  }

  /* OUVRIR : `cible` est l'element ou se dessine le bloc ; `ids` la liste des clients, dans
     l'ordre de l'ecran ; `titre` le debut du nom propose ; `bouton` recoit le focus a la fermeture. */
  function ouvrir(o) {
    if (!o || !o.cible) return;
    if (ETAT && ETAT.cible && ETAT.cible !== o.cible) { ETAT.cible.textContent = ''; ETAT.cible.hidden = true; }
    ETAT = { cible: o.cible, source: o.source === 'commerce' ? 'commerce' : 'clients', titre: String(o.titre || 'Mes clients').slice(0, 70),
      bouton: o.bouton || null, garderRecul: false, garderGros: false, lesIds: o.ids };
    ETAT.calc = calculer(lesIds());
    ETAT.nom = nomParDefaut(ETAT.titre);
    if (!o.cible.dataset.bdvbl) {
      o.cible.dataset.bdvbl = '1';
      o.cible.addEventListener('click', surClic);
      o.cible.addEventListener('change', surChange);
    }
    peindre();
    var t = document.getElementById('bdvblTitre');
    if (t) { try { t.focus(); t.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }
  }

  window.BdvBrevoListes = { pret: pret, ouvrir: ouvrir, fermer: fermer, rafraichir: rafraichir, _calculer: calculer, _etat: function () { return ETAT; } };
})();
