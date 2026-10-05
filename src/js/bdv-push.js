/* ============================================================================
   /js/bdv-push.js : activer les notifications SUR CET APPAREIL (lot 59, 03/10/2026)
   ----------------------------------------------------------------------------
   Deuxieme lot du chantier des notifications (CLAUDE.md, « LES NOTIFICATIONS ET LEURS
   REGLAGES »). Il ne fait QUE brancher l'appareil : poser le recepteur /sw.js, demander
   la permission, ranger l'adresse d'envoi en base. Rien n'est envoye avant le lot 3.

   L'ABONNEMENT EST PAR APPAREIL, la grille des reglages est par compte. D'ou un bouton
   a part, « Activer sur cet appareil », et un etat qui dit la verite de CET ecran.

   LES ETATS, un code et une phrase, toujours les deux :
     sans-cle      la cle publique n'est pas encore posee dans ce fichier
     indisponible  ce navigateur ne sait pas recevoir de notifications
     ios-installer iPhone ou iPad, bureau pas installe sur l'ecran d'accueil : Apple
                   reserve les notifications aux applications installees
     refusees      la personne (ou le navigateur) a dit non : seul le reglage du
                   navigateur peut le defaire, aucun bouton du site ne le peut
     actives       abonne ici ET range en base pour ce compte
     inactives     tout le reste ; le bouton peut agir
   « actives » exige les DEUX moities. Un abonnement local sans ligne en base (lot 59 pas
   colle, appareil passe a un autre compte) n'envoie rien : le dire actif serait mentir.

   LA PERMISSION NE SE DEMANDE QUE SUR UN GESTE. Safari l'exige, et c'est ce qu'il faut :
   aucune fenetre de permission ne s'ouvre au chargement d'une page.
   ============================================================================ */
(function () {
  'use strict';

  /* LA CLE PUBLIQUE des notifications (VAPID). Pas secrete : elle dit aux services
     d'envoi « seuls les messages signes par la cle privee qui va avec sont de nous ».
     La cle privee, elle, n'est jamais dans le depot (secret de la fonction d'envoi). */
  const CLE_PUBLIQUE = 'BIXiV3oN6eZOSjaaLzKwgvS177ZOt9riEuulMr7EsT6lrsVWXCqyhHv9GSE6lh9o1tYaCd6uaMcwdLZL469jfD8';

  const RECEPTEUR = '/sw.js';

  const PHRASES = {
    'sans-cle': 'Les notifications ne sont pas encore ouvertes sur le Bureau du Vigneron.',
    'indisponible': 'Ce navigateur ne sait pas recevoir de notifications.',
    'ios-installer': 'Pas encore possible ici. Sur iPhone et iPad, il faut d\'abord installer le bureau : dans Safari, Partager, puis « Sur l\'écran d\'accueil ». Ouvre-le ensuite depuis son icône et reviens ici.',
    'refusees': 'Les notifications sont bloquées pour ce site dans les réglages du navigateur. Seul ce réglage peut les rouvrir.',
    'actives': 'Notifications actives sur cet appareil.',
    'inactives': 'Notifications désactivées sur cet appareil.',
    'hors-ligne': 'Connecte-toi pour activer les notifications.'
  };

  function etatDe(code) { return { code: code, texte: PHRASES[code] }; }

  function estIos() {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function estInstalle() {
    try { if (navigator.standalone === true) return true; } catch (e) {}
    try { return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); } catch (e) { return false; }
  }
  function sait() {
    return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  }

  /* Un nom d'appareil lisible, pour la liste future « tes appareils ». Rien de plus fin :
     ce n'est pas une empreinte. */
  function nomAppareil() {
    const ua = navigator.userAgent || '';
    const sys = /iPhone/.test(ua) ? 'iPhone' : (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) ? 'iPad'
      : /Android/.test(ua) ? 'Android' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Appareil';
    const nav = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    return nav ? sys + ', ' + nav : sys;
  }

  function octets(b64url) {
    const b64 = (b64url + '='.repeat((4 - b64url.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    const brut = atob(b64);
    const t = new Uint8Array(brut.length);
    for (let i = 0; i < brut.length; i++) t[i] = brut.charCodeAt(i);
    return t;
  }
  function memesOctets(a, b) {
    if (!a || !b) return false;
    const x = new Uint8Array(a), y = new Uint8Array(b);
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }

  function connecte() {
    return !!(window.BdvCompte && BdvCompte.session && BdvCompte.session() && BdvCompte.api);
  }

  async function abonnementLocal() {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg || !reg.pushManager) return null;
    return reg.pushManager.getSubscription();
  }

  async function rangeEnBase(endpoint) {
    const l = await BdvCompte.api('/push_abonnements?endpoint=eq.' + encodeURIComponent(endpoint) + '&select=endpoint');
    return Array.isArray(l) && l.length === 1;
  }

  /* L'etat de CET appareil, sans rien demander a personne. */
  async function etat() {
    if (!CLE_PUBLIQUE) return etatDe('sans-cle');
    if (estIos() && !estInstalle()) return etatDe('ios-installer');
    if (!sait()) return etatDe('indisponible');
    if (Notification.permission === 'denied') return etatDe('refusees');
    if (!connecte()) return etatDe('hors-ligne');
    try {
      const s = await abonnementLocal();
      if (!s || Notification.permission !== 'granted') return etatDe('inactives');
      // Une cle changee rend l'ancien abonnement muet : on le dit inactif, le bouton refera.
      const k = s.options && s.options.applicationServerKey;
      if (k && !memesOctets(k, octets(CLE_PUBLIQUE).buffer)) return etatDe('inactives');
      return (await rangeEnBase(s.endpoint)) ? etatDe('actives') : etatDe('inactives');
    } catch (e) {
      return etatDe('inactives');
    }
  }

  /* A APPELER DEPUIS UN CLIC, et seulement de la. */
  async function activer() {
    const avant = await etat();
    if (['sans-cle', 'indisponible', 'ios-installer', 'refusees', 'hors-ligne'].indexOf(avant.code) >= 0) return avant;
    const p = await Notification.requestPermission();
    if (p !== 'granted') return etatDe(p === 'denied' ? 'refusees' : 'inactives');
    const reg = await navigator.serviceWorker.register(RECEPTEUR, { scope: '/' });
    await navigator.serviceWorker.ready;
    let s = await reg.pushManager.getSubscription();
    const cle = octets(CLE_PUBLIQUE);
    if (s && s.options && s.options.applicationServerKey && !memesOctets(s.options.applicationServerKey, cle.buffer)) {
      try { await s.unsubscribe(); } catch (e) {}
      s = null;
    }
    if (!s) s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cle });
    const j = s.toJSON();
    await BdvCompte.api('/rpc/push_inscrire', {
      methode: 'POST',
      corps: { p_endpoint: j.endpoint, p_p256dh: j.keys && j.keys.p256dh, p_auth: j.keys && j.keys.auth, p_appareil: nomAppareil() }
    });
    return etat();
  }

  async function desactiver() {
    const s = sait() ? await abonnementLocal() : null;
    if (s) {
      // La base d'abord : si elle refuse, l'appareil reste abonne et l'etat le dira.
      if (connecte()) await BdvCompte.api('/rpc/push_retirer', { methode: 'POST', corps: { p_endpoint: s.endpoint } });
      await s.unsubscribe();
    }
    return etat();
  }

  /* LES APPAREILS DU COMPTE (lot 62) : une ligne par appareil inscrit, le plus recent en tete,
     avec `ici` pour celui sur lequel on lit. Lecture seule : la base ne rend que les siens. */
  async function appareils() {
    if (!connecte()) return [];
    const l = await BdvCompte.api('/push_abonnements?select=endpoint,appareil,cree_le,vu_le&order=vu_le.desc');
    let local = null;
    try { const s = sait() ? await abonnementLocal() : null; local = s && s.endpoint; } catch (e) {}
    return (Array.isArray(l) ? l : []).map(function (x) {
      return { endpoint: x.endpoint, appareil: x.appareil || 'Appareil', cree_le: x.cree_le, ici: !!local && x.endpoint === local };
    });
  }

  /* RETIRER UN APPAREIL A DISTANCE (un telephone perdu, vendu). La ligne part de la base : plus
     rien n'y sera envoye. Si c'est CET appareil, on le desabonne aussi ici. */
  async function retirer(endpoint) {
    const s = sait() ? await abonnementLocal().catch(function () { return null; }) : null;
    if (s && s.endpoint === endpoint) return desactiver();
    await BdvCompte.api('/rpc/push_retirer', { methode: 'POST', corps: { p_endpoint: endpoint } });
    return etat();
  }

  window.BdvPush = { etat: etat, activer: activer, desactiver: desactiver, appareils: appareils, retirer: retirer, PHRASES: PHRASES };
})();
