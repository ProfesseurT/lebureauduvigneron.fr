/* ============================================================================
   /sw.js : le recepteur des notifications du Bureau du Vigneron (lot 59, 03/10/2026)
   ----------------------------------------------------------------------------
   UN ORGANE A FONCTION UNIQUE (arbitrage du 11/09/2026, JOURNAL.md). Il fait deux
   choses et rien d'autre :
     1. a l'arrivee d'un message, il AFFICHE une notification ;
     2. au toucher de la notification, il OUVRE le bureau a la bonne page.

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
