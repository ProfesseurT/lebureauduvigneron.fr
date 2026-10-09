/* ================================================================
   LE BUREAU DU VIGNERON, ce que Brevo renvoie (lot 90, 09/10/2026)
   ----------------------------------------------------------------
   Arbitrages de Ted (CLAUDE.md « LOT 90 ») : Brevo previent le bureau en temps reel ; le
   bureau dit, en mots, qu'une adresse s'est desinscrite, ne marche plus, a crie au spam ou
   est bloquee ; il montre « ouvert le » et « a clique le » SEULEMENT pour un client qui a
   accepte le suivi (case de sa fiche, CNIL). Regles d'envoi (vigneron empathique) :
     - desinscrit des seules CAMPAGNES : on previent, le mail perso part ;
     - adresse morte, spam, bloquee, desinscrit des mails 1 a 1 : Brevo ne l'envoie pas (la
       fonction `brevo` refuse), par sa boite on previent.
   Ici, rien que de la LECTURE et l'ecran : la base ne connait que des EMPREINTES
   (sha256 de « <bureau>:<adresse en minuscules> »), calculees ici comme dans
   supabase/functions/_shared/empreinte.ts. Les deux doivent rester identiques.

   OU CA S'AFFICHE, sans que les ecrans aient a savoir comment :
     - `[data-retour-mail="<adresse>"]` (au-dessus du bouton d'envoi : fiche, affaire) ;
     - `[data-retours-fiche]` (data-mails = liste JSON) : marques, accord, derniers mails ;
     - `BdvRetours.marqueListe(mails)` : l'etiquette d'une ligne de « Mes clients » ;
     - `BdvRetours.peindreReglage(cible, maitre)` : le bloc de Mes envois, Brevo.
   Les deux premiers se remplissent seuls des qu'ils entrent dans la page.
   Sans le SQL du lot 90, ou sans Brevo branche : rien ne s'affiche, rien ne casse.
   ================================================================ */
(function () {
  'use strict';

  var BLOQ = null;        // Map empreinte -> [{ source, motif, depuis }], ou null (pas lu)
  var ABSENT = false;     // table absente (SQL du lot 90 pas passe)
  var EMP = new Map();    // adresse (minuscules) -> empreinte
  var ATTENTE = new Set();
  var REG = null;         // { retours_etat, retours_le, rattrape_le } ou null
  var EN_COURS = false;
  var MOT_REG = '', MOT_REG_ALERTE = false;

  function bureau() { return window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau(); }
  function mk(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function norme(a) { return String(a == null ? '' : a).trim().toLowerCase(); }
  function jour(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function moment(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + ' à '
      + d.toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit' }).replace(':', ' h ');
  }
  function brevoBranche() {
    var e = window.BdvBrevo && BdvBrevo._etat ? BdvBrevo._etat() : null;
    return !!(e && e.BREVO);
  }
  function absente(e) { return !!e && (e.status === 404 || /PGRST|42P01|42883/.test(String(e.detail || e.message || ''))); }
  function signal() { try { document.dispatchEvent(new CustomEvent('bdv:retours')); } catch (e) {} }

  /* ---------------- L'EMPREINTE (la meme que _shared/empreinte.ts) ---------------- */
  async function empreinte(adresse, b) {
    b = String(b || bureau() || '').toLowerCase();
    var t = new TextEncoder().encode(b + ':' + norme(adresse));
    var h = new Uint8Array(await crypto.subtle.digest('SHA-256', t));
    return Array.prototype.map.call(h, function (o) { return ('0' + o.toString(16)).slice(-2); }).join('');
  }
  async function empreinteDe(adresse) {
    var a = norme(adresse);
    if (!a) return '';
    if (EMP.has(a)) return EMP.get(a);
    var e = await empreinte(a);
    EMP.set(a, e);
    return e;
  }

  /* ---------------- LIRE ---------------- */
  async function charger() {
    var b = bureau();
    if (!b || !window.BdvCompte) return;
    try {
      var l = await BdvCompte.api('/brevo_bloquees?select=empreinte,source,motif,depuis&limit=50000&bureau=eq.' + encodeURIComponent(b));
      var m = new Map();
      (Array.isArray(l) ? l : []).forEach(function (x) {
        if (!m.has(x.empreinte)) m.set(x.empreinte, []);
        m.get(x.empreinte).push({ source: x.source, motif: x.motif, depuis: x.depuis });
      });
      BLOQ = m; ABSENT = false;
    } catch (e) { BLOQ = null; ABSENT = absente(e); }
    try {
      var r = await BdvCompte.api('/brevo?select=retours_etat,retours_le,rattrape_le&bureau=eq.' + encodeURIComponent(b));
      REG = (Array.isArray(r) && r[0]) || null;
    } catch (e) { REG = null; }
    signal();
    repeindreReglage();
    remplirTout(document);
  }

  var GRAVITE = { spam: 4, morte: 3, bloquee: 2, desinscrit: 1 };
  /* Les marques d'une adresse deja connue, la plus grave d'abord ; null = pas encore calculee. */
  function marquesSync(adresse) {
    var a = norme(adresse);
    if (!a || !BLOQ) return [];
    if (!EMP.has(a)) return null;
    return (BLOQ.get(EMP.get(a)) || []).slice().sort(function (x, y) { return GRAVITE[y.motif] - GRAVITE[x.motif]; });
  }
  async function marques(adresse) {
    await empreinteDe(adresse);
    return marquesSync(adresse) || [];
  }
  /* Ce mail-la, par Brevo, est-il refuse ? (meme regle que `brevo_destinataire`) */
  function bloquante(m) { return m.motif !== 'desinscrit' || m.source === 'transactionnel'; }

  /* Les mots du vigneron (CLAUDE.md « LOT 90 »), jamais la couleur seule. */
  function mot(m) {
    if (m.motif === 'morte') return 'Adresse qui ne marche plus';
    if (m.motif === 'spam') return 'A classé ton mail en spam';
    if (m.motif === 'bloquee') return 'Bloquée par Brevo';
    return m.source === 'campagne' ? 'Ne veut plus de campagnes' : 'S’est désinscrit de tes mails';
  }
  function motLong(m) {
    return mot(m) + (m.depuis ? ' depuis le ' + jour(m.depuis) : '');
  }

  /* ---------------- L'ETIQUETTE D'UNE LIGNE DE « MES CLIENTS » ---------------- */
  var DIFFERE = null;
  function marqueListe(mails) {
    if (!BLOQ || !BLOQ.size) return '';
    var vues = [];
    (Array.isArray(mails) ? mails : []).forEach(function (a) {
      var ms = marquesSync(a);
      if (ms === null) { ATTENTE.add(norme(a)); return; }
      if (ms.length) vues.push(ms[0]);
    });
    if (ATTENTE.size && !DIFFERE) DIFFERE = setTimeout(calculerAttente, 0);
    if (!vues.length) return '';
    vues.sort(function (x, y) { return GRAVITE[y.motif] - GRAVITE[x.motif]; });
    return ' <span class="aff-marque ret-marque ret-marque--' + vues[0].motif + '">' + esc(mot(vues[0])) + '</span>';
  }
  async function calculerAttente() {
    var l = Array.from(ATTENTE); ATTENTE.clear(); DIFFERE = null;
    var trouve = false;
    for (var i = 0; i < l.length; i++) {
      await empreinteDe(l[i]);
      if ((marquesSync(l[i]) || []).length) trouve = true;
    }
    /* On ne redessine que si une marque est apparue : pas de boucle sur des listes saines. */
    if (trouve) signal();
  }

  /* ---------------- AU-DESSUS DU BOUTON D'ENVOI ---------------- */
  async function remplirAvis(n) {
    var a = n.getAttribute('data-retour-mail'), sorte = n.getAttribute('data-retour-sorte') || 'affaires';
    var ms = BLOQ ? await marques(a) : [];
    if (!n.isConnected) return;
    if (!ms.length) { n.hidden = true; n.textContent = ''; return; }
    var m = ms[0];
    var brevo = !!(window.BdvBoite && BdvBoite.parBrevo && BdvBoite.parBrevo(sorte));
    var suite;
    if (!bloquante(m)) suite = ' : ce mail perso part quand même.';
    else if (brevo) suite = ' : Brevo ne l’enverra pas.';
    else if (m.motif === 'morte') suite = ' : ce mail risque de te revenir.';
    else if (m.motif === 'spam') suite = ' : envoie-le seulement s’il te l’a demandé.';
    else if (m.motif === 'desinscrit') suite = ' : respecte son choix.';
    else suite = '.';
    n.textContent = '';
    n.appendChild(mk('b', null, motLong(m)));
    n.appendChild(document.createTextNode(suite));
    n.className = 'ret-avis' + (bloquante(m) ? ' ret-avis--bloque' : '');
    n.setAttribute('role', 'note');
    n.hidden = false;
  }

  /* ---------------- LE BLOC DE LA FICHE ---------------- */
  async function remplirFiche(n) {
    var mails = [];
    try { mails = JSON.parse(n.getAttribute('data-mails') || '[]'); } catch (e) { mails = []; }
    mails = mails.map(norme).filter(Boolean).slice(0, 10);
    var b = bureau();
    if (!b || !mails.length || ABSENT || !window.BdvCompte) { n.hidden = true; return; }
    var emps = [];
    for (var i = 0; i < mails.length; i++) emps.push(await empreinteDe(mails[i]));
    var acc = {}, suivi = [];
    try {
      var l = await BdvCompte.api('/suivi_accords?select=empreinte,accepte_le&bureau=eq.' + encodeURIComponent(b)
        + '&empreinte=in.(' + emps.join(',') + ')');
      (Array.isArray(l) ? l : []).forEach(function (x) { acc[x.empreinte] = x.accepte_le; });
    } catch (e) { if (absente(e)) { ABSENT = true; n.hidden = true; return; } }
    try { suivi = await BdvCompte.api('/rpc/brevo_suivi', { methode: 'POST', corps: { p_bureau: b, p_empreintes: emps } }) || []; }
    catch (e) { suivi = []; }
    if (!n.isConnected) return;
    n.textContent = '';
    var branche = brevoBranche() || !!REG;
    if (!branche && !suivi.length && !Object.keys(acc).length && !mails.some(function (a) { return (marquesSync(a) || []).length; })) { n.hidden = true; return; }

    n.appendChild(mk('p', 'ret__t', 'Ses mails et Brevo'));
    mails.forEach(function (a, k) {
      var e = emps[k], l = mk('div', 'ret__l');
      var ad = mk('p', 'ret__adr'); ad.appendChild(mk('b', null, a));
      (marquesSync(a) || []).forEach(function (m) {
        ad.appendChild(document.createTextNode(' '));
        ad.appendChild(mk('span', 'aff-marque ret-marque ret-marque--' + m.motif, motLong(m)));
      });
      l.appendChild(ad);
      var lab = mk('label', 'chk ret__accord'); var c = mk('input'); c.type = 'checkbox';
      c.setAttribute('data-ret', 'accord'); c.setAttribute('data-emp', e); c.checked = !!acc[e];
      lab.appendChild(c);
      var sp = mk('span', null, 'Il accepte que je voie quand il ouvre mes mails');
      if (acc[e]) { sp.appendChild(mk('br')); sp.appendChild(mk('small', null, 'Noté le ' + jour(acc[e]) + '.')); }
      lab.appendChild(sp);
      l.appendChild(lab);
      /* La raison, juste sous la premiere case et pas apres la liste (vigneron, lot 90). */
      if (k === 0) l.appendChild(mk('p', 'note ret__cnil', 'Coche seulement si ce client te l’a dit, de préférence par écrit. Sans son accord, Brevo ne suit pas ses ouvertures : c’est la règle de la CNIL.'));
      var envois = [], parId = {};
      (Array.isArray(suivi) ? suivi : []).forEach(function (s) {
        if (s.empreinte !== e) return;
        var k2 = s.envoi_le;
        if (!parId[k2]) { parId[k2] = { le: s.envoi_le, ev: {} }; envois.push(parId[k2]); }
        if (s.evenement) parId[k2].ev[s.evenement] = s.le;
      });
      if (envois.length) {
        var ul = mk('ul', 'ret__envois');
        envois.slice(0, 5).forEach(function (x) {
          var t = 'Parti par Brevo le ' + moment(x.le);
          var bout = [];
          if (x.ev.morte) bout.push('revenu : adresse qui ne marche plus');
          if (x.ev.spam) bout.push('classé en spam');
          if (x.ev.bloquee) bout.push('bloqué par Brevo');
          if (x.ev.desinscrit) bout.push('désinscrit depuis ce mail');
          if (acc[e]) {
            bout.push(x.ev.ouvert ? 'ouvert le ' + moment(x.ev.ouvert) : 'pas encore ouvert');
            if (x.ev.clic) bout.push('a cliqué un lien le ' + moment(x.ev.clic));
          }
          ul.appendChild(mk('li', null, t + (bout.length ? ', ' + bout.join(', ') : '') + '.'));
        });
        l.appendChild(ul);
      }
      n.appendChild(l);
    });
    n.hidden = false;
  }

  async function accorder(c) {
    var b = bureau(), e = c.getAttribute('data-emp'), oui = !!c.checked;
    c.disabled = true;
    try {
      var r = await BdvCompte.api('/rpc/suivi_accorder', { methode: 'POST', corps: { p_bureau: b, p_empreinte: e, p_oui: oui } });
      if (r !== true) throw new Error('rien');
    } catch (x) {
      c.checked = !oui;
      var p = c.closest('.ret__l'); if (p) { var m = mk('p', 'ret-avis ret-avis--bloque', 'Ce choix n’a pas été enregistré. Réessaie.'); m.setAttribute('role', 'alert'); p.appendChild(m); }
      c.disabled = false;
      return;
    }
    var f = c.closest('[data-retours-fiche]');
    if (f) remplirFiche(f); else c.disabled = false;
  }

  /* ---------------- MES ENVOIS : CE QUE BREVO RENVOIE ---------------- */
  function peindreReglage(cible, maitre) {
    if (!cible) return;
    var z = mk('div', 'bdvb-reglages'); z.id = 'bdvvRetours';
    z.appendChild(mk('p', 'bdvb-sous', 'Ce que Brevo renvoie au bureau'));
    if (!REG && !ABSENT) { z.appendChild(mk('p', 'bdvr-aide', 'Lecture…')); cible.appendChild(z); return; }
    if (ABSENT) { cible.appendChild(z); z.appendChild(mk('p', 'bdvr-aide', 'Pas encore disponible sur ce bureau.')); return; }
    var etat = REG && REG.retours_etat;
    if (etat === 'branches') {
      z.appendChild(mk('p', 'bdvb-ok', 'Brevo prévient le bureau depuis le ' + jour(REG.retours_le) + '.'));
      z.appendChild(mk('p', 'bdvr-aide', 'Une adresse qui ne marche plus, un client qui se désinscrit ou classe un mail en spam : la fiche du client le dit. Ses ouvertures et ses clics, seulement s’il a accepté (case de sa fiche).'
        + (REG.rattrape_le ? ' Historique relu le ' + jour(REG.rattrape_le) + '.' : '')));
    } else {
      if (etat === 'echec') z.appendChild(mk('p', 'bdvr-aide bdvr-aide--alerte', 'Brevo n’a pas accepté de prévenir le bureau.'));
      z.appendChild(mk('p', 'bdvr-aide', 'Brevo peut prévenir le bureau quand une adresse ne marche plus, quand un client se désinscrit ou classe un mail en spam et, s’il l’accepte, quand il ouvre tes mails.'));
      if (!maitre) z.appendChild(mk('p', 'bdvr-aide', 'Un administrateur du bureau peut le brancher ici.'));
    }
    if (maitre) {
      var g = mk('div', 'bdvb-gestes');
      var bt = mk('button', 'bdvr-btn' + (etat === 'branches' ? ' bdvr-btn--creux' : ''), etat === 'branches' ? 'Relire l’historique' : etat === 'echec' ? 'Réessayer' : 'Brancher les retours');
      bt.type = 'button'; bt.id = 'bdvvRetoursGeste'; bt.setAttribute('data-ret', etat === 'branches' ? 'relire' : 'brancher');
      bt.disabled = EN_COURS;
      g.appendChild(bt); z.appendChild(g);
      if (etat === 'branches') {
        /* [Certain, aide Brevo lue le 09/10/2026] sans ce reglage, Brevo suit tout le monde. */
        z.appendChild(mk('p', 'bdvr-aide', 'À faire une fois dans Brevo : Paramètres, Contacts, « Consentement au suivi par contact » sur Oui, et « Suivre les contacts dont le consentement est inconnu » sur Non. Sinon Brevo suit les ouvertures de tous tes clients, même sans leur accord.'));
      }
    }
    var mt = mk('p', 'bdvr-aide' + (MOT_REG_ALERTE ? ' bdvr-aide--alerte' : '')); mt.id = 'bdvvRetoursMot'; mt.setAttribute('role', 'status');
    mt.textContent = MOT_REG; mt.hidden = !MOT_REG;
    z.appendChild(mt);
    cible.appendChild(z);
  }
  function repeindreReglage() {
    var z = document.getElementById('bdvvRetours');
    if (!z || !z.parentNode) return;
    var p = z.parentNode, maitre = !!document.getElementById('bdvvRetoursGeste');
    var suivant = z.nextSibling;
    p.removeChild(z);
    var tmp = document.createDocumentFragment();
    peindreReglage(tmp, maitre);
    p.insertBefore(tmp, suivant);
  }
  async function geste(action) {
    if (EN_COURS) return;
    EN_COURS = true; MOT_REG = action === 'relire' ? 'Le bureau relit l’historique chez Brevo…' : 'Le bureau demande à Brevo de le prévenir…'; MOT_REG_ALERTE = false;
    repeindreReglage();
    var r = null;
    try { r = await BdvCompte.fonction('brevo', { action: action === 'relire' ? 'retours_relire' : 'retours_brancher', bureau: bureau() }); }
    catch (e) { r = { resultat: 'erreur', mot: e && e.status === 403 ? 'Seul un administrateur du bureau le règle.' : 'Brevo n’a pas pu être joint. Réessaie dans un moment.' }; }
    EN_COURS = false;
    if (r && (r.resultat === 'branches' || r.resultat === 'relu')) {
      MOT_REG = r.complet === false ? r.mot : (r.resultat === 'branches' ? 'C’est branché. L’historique est relu.' : 'Historique relu.');
      MOT_REG_ALERTE = r.complet === false;
    } else { MOT_REG = (r && r.mot) || 'Ça n’a pas marché. Réessaie dans un moment.'; MOT_REG_ALERTE = true; }
    await charger();
    repeindreReglage();
  }

  /* ---------------- LE REMPLISSAGE AUTOMATIQUE ---------------- */
  function remplirTout(racine) {
    if (!racine || !racine.querySelectorAll) return;
    var l = [];
    if (racine.matches && racine.matches('[data-retour-mail],[data-retours-fiche]')) l.push(racine);
    racine.querySelectorAll('[data-retour-mail],[data-retours-fiche]').forEach(function (n) { l.push(n); });
    l.forEach(function (n) {
      if (n.hasAttribute('data-retour-mail')) remplirAvis(n); else remplirFiche(n);
    });
  }
  function surveiller() {
    if (typeof MutationObserver !== 'function') return;
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) remplirTout(n); }); });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-ret="brancher"],[data-ret="relire"]') : null;
    if (t) geste(t.getAttribute('data-ret'));
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute('data-ret') === 'accord') accorder(t);
  });
  document.addEventListener('bdv:brevo', function () { charger(); });

  function demarrer() { surveiller(); if (bureau()) charger(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();

  window.BdvRetours = { empreinte: empreinte, charger: charger, marqueListe: marqueListe, marques: marques,
    peindreReglage: peindreReglage, _etat: function () { return { BLOQ: BLOQ, ABSENT: ABSENT, REG: REG, EMP: EMP }; } };
})();
