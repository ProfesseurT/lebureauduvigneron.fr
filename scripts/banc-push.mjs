/* ============================================================================
   scripts/banc-push.mjs : le banc des notifications de cet appareil (lot 59, 03/10/2026)

     npm run banc:push        (apres `npm run build`, il lit aussi _site)

   CE QU'IL TIENT
     1. /sw.js reste un organe a fonction unique : ni ecouteur fetch, ni cache, ni
        import. Il AFFICHE TOUJOURS une notification, meme pour un message illisible
        (Safari avant 18.4 retire l'abonnement d'un appareil qui recoit sans afficher).
        Au toucher, il n'ouvre jamais un autre site.
     2. bdv-push.js dit la verite de l'appareil, dans chacun de ses sept etats, et ne
        demande la permission que dans activer().
     3. Le panneau de reglages porte le bouton, hors « Enregistrer », et un echec se dit.
     4. La deconnexion coupe les notifications de l'appareil, jeton lu AVANT l'effacement.
   Aucun reseau : les navigateurs sont des doubles qui notent les appels.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) { console.error('\n  jsdom est absent : rien n\'a ete verifie.\n'); process.exit(2); }

let ok = 0, ko = 0;
const t = (m, b, detail) => { if (b) { ok++; console.log('  ok    : ' + m); } else { ko++; console.log('  ECHEC : ' + m + (detail ? '  -> ' + detail : '')); } };
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const sansCommentaires = (c) => c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ==========================================================================
   1. LE RECEPTEUR
   ========================================================================== */
console.log('\n== 1. /sw.js, un organe a fonction unique ==');
const SW = lire('src/sw.js');
const swCode = sansCommentaires(SW);
t('aucun ecouteur fetch', !/addEventListener\(\s*['"]fetch['"]/.test(swCode) && !/onfetch/.test(swCode));
t('aucun acces par crochets a self (qui contournerait les deux controles ci-dessus)', !/self\s*\[/.test(swCode));
t('aucun cache, aucun import', !/\bcaches\b/.test(swCode) && !/importScripts/.test(swCode) && !/^\s*import\b/m.test(swCode) && !/\bimport\(/.test(swCode));
t('la pierre tombale est decrite dans l\'en-tete', /PIERRE TOMBALE/.test(SW) && /unregister\(\)/.test(SW));

{
  const notes = [], ouverts = [], ecoute = {};
  const fenetres = [];
  const self = {
    location: { origin: 'https://lebureauduvigneron.fr' },
    addEventListener: (n, f) => { ecoute[n] = f; },
    skipWaiting: () => {},
    registration: { showNotification: (titre, o) => { notes.push({ titre, o }); return Promise.resolve(); } },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve(fenetres),
      openWindow: (u) => { ouverts.push(u); return Promise.resolve(); }
    }
  };
  vm.runInNewContext(SW, { self, URL, console });
  const pousser = async (data) => {
    let p = null;
    ecoute.push({ data, waitUntil: (x) => { p = x; } });
    await p;
  };
  await pousser({ json: () => ({ titre: 'Un devis vient d\'être signé.', corps: 'Ouvre ton bureau.', url: '/mon-bureau/#affaire=1', tag: 'signe' }) });
  await pousser({ json: () => { throw new Error('illisible'); }, text: () => '???' });
  await pousser(null);
  await pousser({ json: () => 'une chaine' });
  t('quatre messages, dont trois illisibles ou vides : quatre notifications affichees', notes.length === 4, String(notes.length));
  t('le message lisible donne son titre, son texte, sa page et son etiquette',
    notes[0] && notes[0].titre === 'Un devis vient d\'être signé.' && notes[0].o.body === 'Ouvre ton bureau.'
      && notes[0].o.data.url === 'https://lebureauduvigneron.fr/mon-bureau/#affaire=1' && notes[0].o.tag === 'signe');
  t('un message illisible donne une notification generique qui ouvre le bureau',
    notes[1] && notes[1].titre === 'Le Bureau du Vigneron' && notes[1].o.data.url === 'https://lebureauduvigneron.fr/mon-bureau/');

  const toucher = async (url) => {
    let p = null;
    ecoute.notificationclick({ notification: { close: () => {}, data: { url } }, waitUntil: (x) => { p = x; } });
    await p;
  };
  await toucher('https://exemple.fr/piege');
  t('une page d\'un autre site n\'est jamais ouverte : le bureau a la place', ouverts[0] === 'https://lebureauduvigneron.fr/mon-bureau/', ouverts[0]);
  let vu = null, montre = false;
  fenetres.push({ url: 'https://lebureauduvigneron.fr/mon-bureau/', navigate: (u) => { vu = u; return Promise.resolve(); }, focus: () => { montre = true; return Promise.resolve(); } });
  await toucher('/mon-bureau/#affaire=9');
  t('un bureau deja ouvert est repris et mene a la bonne page, sans nouvelle fenetre',
    vu === 'https://lebureauduvigneron.fr/mon-bureau/#affaire=9' && montre && ouverts.length === 1);
}

console.log('\n== 1 bis. L\'adresse qui change toute seule (lot 62) ==');
{
  const ecoute = {}, envois = [], abonnes = [];
  const self = {
    location: { origin: 'https://lebureauduvigneron.fr' },
    addEventListener: (n, f) => { ecoute[n] = f; }, skipWaiting: () => {},
    registration: { showNotification: () => Promise.resolve(),
      pushManager: { subscribe: (o) => { abonnes.push(o); return Promise.resolve({ toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/neuve2', keys: { p256dh: 'P', auth: 'A' } }) }); } } },
    clients: { claim: () => Promise.resolve() }
  };
  const fetch = (u, o) => { envois.push({ u, o }); return Promise.resolve({ ok: true }); };
  vm.runInNewContext(SW, { self, URL, console, fetch });
  const changer = async (ev) => { let p = null; ecoute.pushsubscriptionchange(Object.assign(ev, { waitUntil: (x) => { p = x; } })); await p; };
  const nouv = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/neuve', keys: { p256dh: 'P', auth: 'A' } }) };
  await changer({ oldSubscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/vieille' }, newSubscription: nouv });
  const e0 = envois[0];
  const cleCompte = (/const SUPABASE_ANON_KEY = '([^']+)';/.exec(lire('src/js/bdv-compte.js')) || [])[1];
  t('le recepteur ecoute pushsubscriptionchange', typeof ecoute.pushsubscriptionchange === 'function');
  t('il appelle push_remplacer avec l\'ancienne et la nouvelle adresse',
    !!e0 && e0.u === 'https://qukmncqqwomhmrdhvetj.supabase.co/rest/v1/rpc/push_remplacer'
    && JSON.parse(e0.o.body).p_ancien === 'https://fcm.googleapis.com/fcm/send/vieille' && JSON.parse(e0.o.body).p_nouveau === 'https://fcm.googleapis.com/fcm/send/neuve');
  t('avec la cle publique du projet, la meme que bdv-compte.js', !!e0 && !!cleCompte && e0.o.headers.apikey === cleCompte);
  await changer({ oldSubscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/v2', options: { applicationServerKey: new Uint8Array(65) } }, newSubscription: null });
  t('sans nouvelle adresse fournie, il se reabonne avec la meme cle', abonnes.length === 1 && abonnes[0].userVisibleOnly === true && envois.length === 2);
  await changer({ oldSubscription: null, newSubscription: nouv });
  t('sans ancienne adresse, rien ne part (il ne pourrait rien prouver)', envois.length === 2);
}

/* ==========================================================================
   2. BDV-PUSH.JS, LES SEPT ETATS
   ========================================================================== */
console.log('\n== 2. bdv-push.js dit la verite de cet appareil ==');
const PUSH = lire('src/js/bdv-push.js');
const CLE_ESSAI = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
t('la permission ne se demande que dans activer()',
  (PUSH.match(/requestPermission\(/g) || []).length === 1 && /async function activer\(\)[\s\S]*requestPermission\(/.test(PUSH)
  && !/async function etat\(\)[\s\S]*?requestPermission[\s\S]*?async function activer/.test(PUSH));

function decor(o) {
  o = Object.assign({ cle: CLE_ESSAI, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
    sw: true, push: true, permission: 'default', installe: false, connecte: true, abo: null, enBase: false, accorde: 'granted' }, o);
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window;
  const notes = { api: [], permission: 0, enregistre: [], abonne: [], desabonne: 0 };
  Object.defineProperty(w.navigator, 'userAgent', { get: () => o.ua });
  Object.defineProperty(w.navigator, 'standalone', { get: () => o.installe });
  w.matchMedia = () => ({ matches: o.installe });
  let abo = o.abo;
  const fabriquerAbo = (endpoint, cle) => ({
    endpoint, options: { applicationServerKey: cle },
    toJSON: () => ({ endpoint, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }),
    unsubscribe: () => { notes.desabonne++; abo = null; return Promise.resolve(true); }
  });
  const pm = {
    getSubscription: () => Promise.resolve(abo),
    subscribe: (opt) => { notes.abonne.push(opt); abo = fabriquerAbo('https://fcm.googleapis.com/fcm/send/neuf', opt.applicationServerKey.buffer); return Promise.resolve(abo); }
  };
  if (o.sw) Object.defineProperty(w.navigator, 'serviceWorker', { value: {
    getRegistration: () => Promise.resolve(abo || notes.enregistre.length ? { pushManager: pm } : undefined),
    register: (u, opt) => { notes.enregistre.push([u, opt]); return Promise.resolve({ pushManager: pm }); },
    ready: Promise.resolve({ pushManager: pm })
  } });
  if (o.push) w.PushManager = function () {};
  w.Notification = { get permission() { return o.permission; }, requestPermission: () => { notes.permission++; o.permission = o.accorde; return Promise.resolve(o.accorde); } };
  w.BdvCompte = {
    session: () => (o.connecte ? { access_token: 'j' } : null),
    api: (chemin, opt) => {
      notes.api.push([chemin, opt]);
      if (String(chemin).indexOf('/push_abonnements') === 0) return Promise.resolve(o.enBase ? [{ endpoint: 'x' }] : []);
      if (o.rpcEchoue) return Promise.reject(new Error('refuse'));
      if (String(chemin) === '/rpc/push_inscrire') o.enBase = true;
      if (String(chemin) === '/rpc/push_retirer') o.enBase = false;
      return Promise.resolve(true);
    }
  };
  if (o.abo === 'autre-cle') abo = fabriquerAbo('https://fcm.googleapis.com/fcm/send/ancien', new w.Uint8Array(65).fill(4).buffer);
  if (o.abo === 'meme-cle') abo = fabriquerAbo('https://fcm.googleapis.com/fcm/send/ancien', w.Uint8Array.from(Buffer.from(o.cle.replace(/-/g, '+').replace(/_/g, '/'), 'base64')).buffer);
  const s = w.document.createElement('script');
  s.textContent = PUSH.replace(/const CLE_PUBLIQUE = '[^']*';/, "const CLE_PUBLIQUE = '" + o.cle + "';");
  w.document.body.appendChild(s);
  return { w, notes, o };
}

let d = decor({ cle: '' });
t('cle pas encore posee : « sans-cle », et la phrase le dit', (await d.w.BdvPush.etat()).code === 'sans-cle');
t('la cle publique du depot est une vraie cle : 87 signes, 65 octets, un point de courbe non compresse',
  (() => { const m = /const CLE_PUBLIQUE = '([A-Za-z0-9_-]{87})';/.exec(PUSH); if (!m) return false;
    const b = Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64'); return b.length === 65 && b[0] === 4; })());
d = decor({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', push: false });
t('iPhone dans Safari : « ios-installer », pas « indisponible »', (await d.w.BdvPush.etat()).code === 'ios-installer');
d = decor({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', installe: true });
t('iPhone, bureau installe : on peut activer', (await d.w.BdvPush.etat()).code === 'inactives');
d = decor({ push: false });
t('navigateur sans notifications : « indisponible »', (await d.w.BdvPush.etat()).code === 'indisponible');
d = decor({ permission: 'denied' });
t('bloquees dans le navigateur : « refusees », et la phrase dit ou les rouvrir',
  (await d.w.BdvPush.etat()).code === 'refusees' && /réglages du navigateur/.test(d.w.BdvPush.PHRASES.refusees));
d = decor({ connecte: false });
t('pas connecte : « hors-ligne »', (await d.w.BdvPush.etat()).code === 'hors-ligne');
d = decor({ permission: 'granted', abo: 'meme-cle', enBase: false });
t('abonne ici mais absent de la base : « inactives », pas un mensonge', (await d.w.BdvPush.etat()).code === 'inactives');
d = decor({ permission: 'granted', abo: 'autre-cle', enBase: true });
t('abonne avec une autre cle que celle du site : « inactives »', (await d.w.BdvPush.etat()).code === 'inactives');
d = decor({ permission: 'granted', abo: 'meme-cle', enBase: true });
t('abonne ici ET range en base : « actives »', (await d.w.BdvPush.etat()).code === 'actives');
t('lire l\'etat ne demande jamais la permission', d.notes.permission === 0);

console.log('\n== 3. Activer, desactiver ==');
d = decor({});
let e = await d.w.BdvPush.activer();
const ins = d.notes.api.find(a => a[0] === '/rpc/push_inscrire');
t('activer : la permission est demandee une fois', d.notes.permission === 1);
t('le recepteur est pose a la racine, pour couvrir /mon-bureau/',
  d.notes.enregistre.length === 1 && d.notes.enregistre[0][0] === '/sw.js' && d.notes.enregistre[0][1].scope === '/');
t('l\'abonnement promet d\'afficher chaque message, avec la cle publique',
  d.notes.abonne.length === 1 && d.notes.abonne[0].userVisibleOnly === true && d.notes.abonne[0].applicationServerKey.length === 65);
t('l\'adresse, les deux cles et le nom de l\'appareil partent a push_inscrire',
  !!ins && ins[1].methode === 'POST' && ins[1].corps.p_endpoint === 'https://fcm.googleapis.com/fcm/send/neuf'
  && ins[1].corps.p_p256dh.length === 87 && ins[1].corps.p_auth.length === 22 && ins[1].corps.p_appareil === 'Mac, Safari', JSON.stringify(ins && ins[1]));
t('et l\'etat final est « actives »', e.code === 'actives', e.code);
e = await d.w.BdvPush.desactiver();
const ret = d.notes.api.find(a => a[0] === '/rpc/push_retirer');
t('desactiver : la base d\'abord, puis l\'appareil', !!ret && ret[1].corps.p_endpoint === 'https://fcm.googleapis.com/fcm/send/neuf' && d.notes.desabonne === 1);
t('et l\'etat final est « inactives »', e.code === 'inactives', e.code);
d = decor({ accorde: 'denied' });
e = await d.w.BdvPush.activer();
t('la personne dit non : « refusees », rien n\'est range', e.code === 'refusees' && !d.notes.api.some(a => a[0] === '/rpc/push_inscrire'));
d = decor({ cle: '' });
e = await d.w.BdvPush.activer();
t('sans cle, activer ne demande rien a personne', e.code === 'sans-cle' && d.notes.permission === 0 && d.notes.enregistre.length === 0);

console.log('\n== 3 bis. La liste des appareils, retirer a distance (lot 62) ==');
{
  const d = decor({ permission: 'granted', abo: 'meme-cle', enBase: true });
  const api0 = d.w.BdvCompte.api;
  d.w.BdvCompte.api = (chemin, opt) => String(chemin).indexOf('/push_abonnements?select=endpoint,appareil') === 0
    ? Promise.resolve([{ endpoint: 'https://web.push.apple.com/iphone', appareil: 'iPhone, Safari' }, { endpoint: 'https://fcm.googleapis.com/fcm/send/ancien', appareil: 'Mac, Safari' }])
    : api0(chemin, opt);
  const l = await d.w.BdvPush.appareils();
  t('deux appareils, et celui sur lequel on lit est reconnu', l.length === 2 && !l[0].ici && l[1].ici && l[1].appareil === 'Mac, Safari');
  await d.w.BdvPush.retirer('https://web.push.apple.com/iphone');
  t('retirer un AUTRE appareil : push_retirer pour lui, celui-ci reste abonne',
    d.notes.api.some((a) => a[0] === '/rpc/push_retirer' && a[1].corps.p_endpoint === 'https://web.push.apple.com/iphone') && d.notes.desabonne === 0);
  await d.w.BdvPush.retirer('https://fcm.googleapis.com/fcm/send/ancien');
  t('retirer CET appareil : la base, puis l\'abonnement local', d.notes.desabonne === 1);
}

/* ==========================================================================
   4. LE PANNEAU DE REGLAGES
   ========================================================================== */
console.log('\n== 4. Le bouton dans « Le courrier » ==');
for (const echec of [false, true]) {
  const dom = new JSDOM('<!doctype html><body><div id="status"><span id="statusTxt"></span></div></body>', { url: 'https://lebureauduvigneron.fr/mon-bureau/', pretendToBeVisual: true, runScripts: 'dangerously' });
  const w = dom.window, $ = (id) => w.document.getElementById(id);
  const appels = [];
  let code = 'inactives';
  w.BdvCompte = { monId: () => 'moi', monBureau: () => 'b', session: () => ({ user: { id: 'moi' } }), refusDeProprietaire: () => false,
    profil: () => Promise.resolve({}), majProfil: () => Promise.resolve(true),
    api: (c) => Promise.resolve(String(c).indexOf('/profils') === 0 ? [{ prenom: 'Ted' }] : [{}]) };
  w.BdvSync = { pret: () => true, lireReglages: () => Promise.resolve({}), ecrireReglages: () => Promise.resolve(true) };
  w.BdvPush = {
    etat: () => Promise.resolve({ code, texte: code === 'actives' ? 'Notifications actives sur cet appareil.' : 'Notifications désactivées sur cet appareil.' }),
    activer: () => { appels.push('activer'); if (echec) return Promise.reject(new Error('x')); code = 'actives'; return w.BdvPush.etat(); },
    desactiver: () => { appels.push('desactiver'); code = 'inactives'; return w.BdvPush.etat(); },
    appareils: () => Promise.resolve([{ endpoint: 'e1', appareil: 'iPhone <b>Safari</b>', ici: false }, { endpoint: 'e2', appareil: 'Mac, Safari', ici: true }]),
    retirer: (e) => { appels.push('retirer:' + e); return w.BdvPush.etat(); },
    PHRASES: {}
  };
  const s = w.document.createElement('script'); s.textContent = lire('src/js/bdv-reglages.js'); w.document.body.appendChild(s);
  w.BdvReglages.ouvrir('bdvrBlocCourrier');
  await dormir(80);
  const b = $('bdvrPushBouton');
  if (!echec) {
    t('le bloc se montre dans « Le courrier » quand bdv-push.js est la', !$('bdvrPush').hidden && !!$('bdvrPush').closest('#bdvrBlocCourrier'));
    t('le bouton n\'est pas un « Enregistrer » deguise (type=button)', b && b.type === 'button');
    t('etat lu : la phrase, puis le bouton qui dit ce qu\'il va faire',
      $('bdvrPushEtat').textContent === 'Notifications désactivées sur cet appareil.' && !b.hidden && b.textContent === 'Activer sur cet appareil');
    t('appareil muet : la phrase « Rien ne sonnera ici » se montre', !$('bdvrPushMuet').hidden);
    const lis = [...w.document.querySelectorAll('#bdvrPushListe li')];
    t('lot 62 : la liste des appareils, « (cet appareil) » sur le bon', !$('bdvrPushAppareils').hidden && lis.length === 2
      && lis[1].textContent.indexOf('Mac, Safari (cet appareil)') === 0);
    t('le nom vient de la base et s\'ecrit en texte, jamais en HTML', lis[0].querySelector('b') === null && lis[0].textContent.indexOf('iPhone <b>Safari</b>') === 0);
    lis[0].querySelector('button').click(); await dormir(30);
    t('« Retirer » appelle BdvPush.retirer pour CET appareil-la', appels.indexOf('retirer:e1') >= 0);
    appels.length = 0;
    b.click(); await dormir(40);
    t('active : la phrase se cache', $('bdvrPushMuet').hidden);
    t('un clic active, et le bouton devient « Désactiver »', appels.join() === 'activer' && b.textContent === 'Désactiver sur cet appareil'
      && $('bdvrPushEtat').textContent === 'Notifications actives sur cet appareil.');
    b.click(); await dormir(40);
    t('un second clic desactive', appels.join() === 'activer,desactiver' && b.textContent === 'Activer sur cet appareil');
  } else {
    b.click(); await dormir(40);
    t('un echec se dit, et le bouton ne reste pas sur « Un instant… »',
      /^Ça n'a pas marché\. /.test($('bdvrPushEtat').textContent) && !b.disabled && b.textContent === 'Activer sur cet appareil', $('bdvrPushEtat').textContent);
  }
}
{
  const dom = new JSDOM('<!doctype html><body><div id="status"><span id="statusTxt"></span></div></body>', { url: 'https://lebureauduvigneron.fr/mon-bureau/', pretendToBeVisual: true, runScripts: 'dangerously' });
  const w = dom.window;
  w.BdvCompte = { monId: () => 'moi', monBureau: () => 'b', session: () => ({ user: { id: 'moi' } }), refusDeProprietaire: () => false,
    profil: () => Promise.resolve({}), majProfil: () => Promise.resolve(true), api: () => Promise.resolve([{}]) };
  w.BdvSync = { pret: () => true, lireReglages: () => Promise.resolve({}), ecrireReglages: () => Promise.resolve(true) };
  const s = w.document.createElement('script'); s.textContent = lire('src/js/bdv-reglages.js'); w.document.body.appendChild(s);
  w.BdvReglages.ouvrir('bdvrBlocCourrier'); await dormir(60);
  t('sans bdv-push.js sur la page, le bloc reste cache', w.document.getElementById('bdvrPush').hidden);
}

/* ==========================================================================
   5. LA DECONNEXION, LA PAGE, LA CONSTRUCTION
   ========================================================================== */
console.log('\n== 5. Deconnexion, page, construction ==');
const COMPTE = lire('src/js/bdv-compte.js');
t('la deconnexion coupe les notifications EN PREMIER, avant d\'effacer la session',
  /function deconnexion\(\)\{ oublierNotifications\(\); arreterRenouvellement\(\); oublierCetAppareil\(\);/.test(COMPTE));
const oubli = (COMPTE.match(/function oublierNotifications\(\)\{[\s\S]*?\n  \}\n/) || [''])[0];
t('le jeton y est lu tout de suite, avant toute attente', /const s = lireSession\(\);\s*\n\s*if\(!\('serviceWorker' in navigator\)\) return;\s*\n\s*navigator\.serviceWorker\.getRegistration/.test(oubli));
t('et l\'appareil est desabonne sans attendre la base, requete en keepalive',
  /const local = abo\.unsubscribe\(\)/.test(oubli) && /keepalive: true/.test(oubli) && oubli.indexOf('abo.unsubscribe()') < oubli.indexOf('fetch('));
t('un autre compte qui se connecte sur ce poste coupe aussi les notifications du precedent',
  /if\(change\)\{ oublierNotifications\(\); oublierCetAppareil\(\); \}/.test(COMPTE));
const PAGE = lire('src/mon-bureau.njk');
t('le bureau charge bdv-push.js en differe', /<script src="\/js\/bdv-push\.js" defer><\/script>/.test(PAGE));
t('la construction pose /sw.js a la racine', /addPassthroughCopy\(\{ "src\/sw\.js": "sw\.js" \}\)/.test(lire('.eleventy.js')));
const construit = path.join(RACINE, '_site/sw.js');
t('et _site/sw.js est bien la, identique a la source', fs.existsSync(construit) && fs.readFileSync(construit, 'utf8') === SW);
for (const f of ['src/sw.js', 'src/js/bdv-push.js']) t(f + ' : aucun tiret cadratin', lire(f).indexOf('—') < 0);

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DES NOTIFICATIONS REFUSE\n'); process.exit(1); }
console.log('  LE RECEPTEUR AFFICHE TOUJOURS, L\'APPAREIL DIT LA VERITE\n');
