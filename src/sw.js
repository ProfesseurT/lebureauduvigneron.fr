/* ============================================================================
   /sw.js : le recepteur des notifications du Bureau du Vigneron (lot 59, 03/10/2026)
   ----------------------------------------------------------------------------
   UN ORGANE A FONCTION UNIQUE (arbitrage du 11/09/2026, JOURNAL.md). Il fait trois
   choses et rien d'autre :
     1. a l'arrivee d'un message, il AFFICHE une notification ;
     2. au toucher de la notification, il OUVRE le bureau a la bonne page ;
     3. si le navigateur change l'adresse d'envoi, il la REMPLACE en base (lot 62).

   AUCUN ECOUTEUR « fetch », DONC AUCUN CACHE. Le bureau ne peut jamais etre servi
   dans une version perimee par ce fichier. `npm run banc:push` echoue si un ecouteur
   fetch, un cache, un importScripts ou un import apparait ici.

   IL AFFICHE TOUJOURS QUELQUE CHOSE. Safari avant 18.4 RETIRE l'abonnement d'un
   appareil qui recoit un message sans rien afficher. Un message illisible donne donc
   quand meme une notification, generique.

   CE QUE LE MESSAGE PORTE (contrat avec l'envoi du lot 3), en JSON :
     { "titre": "...", "corps": "...", "url": "/mon-bureau/#...", "tag": "..." }
   Ni nom de client ni montant : la notification s'affiche sur un ecran verrouille
   (decision du 11/09/2026). Le texte est fabrique par le serveur, pas ici.

   LE RETIRER UN JOUR, sans laisser d'appareil coince : NE PAS SUPPRIMER CE FICHIER.
   Un navigateur dont le recepteur rend 404 garde l'ancien. Le remplacer par une
   PIERRE TOMBALE de trois lignes qui se desinscrit :
     self.addEventListener('install', () => self.skipWaiting());
     self.addEventListener('activate', (e) => e.waitUntil(self.registration.unregister()));
   et la laisser en ligne plusieurs mois.
   ============================================================================ */

const TITRE_PAR_DEFAUT = 'Le Bureau du Vigneron';
const PAGE_PAR_DEFAUT = '/mon-bureau/';

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

/* Une adresse de NOTRE site, ou le bureau. Un message ne doit jamais pouvoir ouvrir
   un autre site au toucher. */
function adresseSure(u) {
  try {
    const a = new URL(String(u || PAGE_PAR_DEFAUT), self.location.origin);
    if (a.origin !== self.location.origin) return new URL(PAGE_PAR_DEFAUT, self.location.origin).href;
    return a.href;
  } catch (e) {
    return new URL(PAGE_PAR_DEFAUT, self.location.origin).href;
  }
}

function lireMessage(evenement) {
  let d = null;
  try { d = evenement.data ? evenement.data.json() : null; } catch (e) { d = null; }
  if (!d || typeof d !== 'object') d = {};
  return {
    titre: (typeof d.titre === 'string' && d.titre.trim()) ? d.titre.trim().slice(0, 80) : TITRE_PAR_DEFAUT,
    corps: (typeof d.corps === 'string') ? d.corps.trim().slice(0, 200) : 'Il y a du nouveau dans ton bureau.',
    url: adresseSure(d.url),
    tag: (typeof d.tag === 'string' && d.tag) ? d.tag.slice(0, 64) : undefined
  };
}

self.addEventListener('push', (e) => {
  const m = lireMessage(e);
  const options = { body: m.corps, icon: '/assets/icone-192.png', badge: '/assets/icone-192.png', data: { url: m.url } };
  if (m.tag) options.tag = m.tag;
  e.waitUntil(self.registration.showNotification(m.titre, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const cible = adresseSure(e.notification.data && e.notification.data.url);
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const f of fenetres) {
      if (f.url.indexOf(self.location.origin + '/mon-bureau/') === 0 && 'focus' in f) {
        try { if ('navigate' in f) await f.navigate(cible); } catch (x) { /* fenetre non controlee : on la montre telle quelle */ }
        return f.focus();
      }
    }
    return self.clients.openWindow(cible);
  })());
});

/* L'ADRESSE QUI CHANGE TOUTE SEULE (lot 62). Un navigateur peut renouveler l'adresse d'envoi
   d'un appareil sans rien demander. Sans ce qui suit, l'appareil deviendrait muet en silence.
   Le recepteur n'a pas de compte connecte : il prouve son droit en donnant l'ANCIENNE adresse,
   que personne d'autre ne connait, et la base la remplace (`push_remplacer`, lot 62). Une
   adresse retiree a distance n'est jamais recreee par ce chemin. Sans ancienne adresse (certains
   navigateurs ne la donnent pas), rien ne part : l'ecran des reglages dira « desactivees » et
   un clic suffira. L'adresse et la cle du projet sont publiques (les memes que bdv-compte.js,
   `npm run banc:push` verifie qu'elles le restent). */
const PROJET = 'https://qukmncqqwomhmrdhvetj.supabase.co';
const CLE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1a21uY3Fxd29taG1yZGh2ZXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTUwMzksImV4cCI6MjEwMzgzMTAzOX0.jGCPLploiALbFMPt1edpVOyyr0emk8DP8ZdvnPLSLEM';
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    const ancienne = e.oldSubscription;
    if (!ancienne || !ancienne.endpoint) return;
    let nouvelle = e.newSubscription;
    if (!nouvelle) {
      const cle = ancienne.options && ancienne.options.applicationServerKey;
      if (!cle) return;
      nouvelle = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cle });
    }
    const j = nouvelle.toJSON();
    await fetch(PROJET + '/rest/v1/rpc/push_remplacer', {
      method: 'POST',
      headers: { apikey: CLE_ANON, Authorization: 'Bearer ' + CLE_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_ancien: ancienne.endpoint, p_nouveau: j.endpoint, p_p256dh: j.keys && j.keys.p256dh, p_auth: j.keys && j.keys.auth })
    });
  })().catch(() => {}));
});
