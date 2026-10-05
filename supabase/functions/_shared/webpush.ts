/* ============================================================================
   supabase/functions/_shared/webpush.ts : envoyer une notification web
   (lot 60, sorti de notif-commerce au lot 61 pour servir aussi notif-horaire)
   ----------------------------------------------------------------------------

   AUCUNE BIBLIOTHEQUE. Le chiffrement du message (RFC 8291, « aes128gcm »,
   RFC 8188) et la signature VAPID (RFC 8292) sont faits ici avec WebCrypto, que
   Deno porte nativement. Raisons : jsr.io n'etait pas joignable pour verifier
   une bibliotheque, et 80 lignes relues valent mieux qu'une dependance qu'on n'a
   pas lue. `npm run banc:notif-push` DECHIFFRE ce que ce code chiffre avec la
   bibliotheque de reference de l'auteur de la RFC (http_ece), et verifie la
   signature avec la cle publique : si l'un des deux casse, le banc refuse.

   LA CLE PRIVEE est le secret VAPID_PRIVATE de cette fonction, pose UNE fois
   par Ted. La cle publique est la meme que dans src/js/bdv-push.js. Sans cle
   privee, rien ne part et le journal le dit : le mail, lui, part quand meme.

   UNE ADRESSE MORTE SE RETIRE LE JOUR MEME. Le service repond 404 ou 410 quand
   l'appareil a supprime le bureau ou s'est desabonne : on efface la ligne.
   --------------------------------------------------------------------------- */
export const VAPID_PUBLIQUE = 'BIXiV3oN6eZOSjaaLzKwgvS177ZOt9riEuulMr7EsT6lrsVWXCqyhHv9GSE6lh9o1tYaCd6uaMcwdLZL469jfD8';
/* Le « sujet » VAPID : comment le service d'envoi joint l'expediteur en cas d'abus.
   L'adresse du site suffit (RFC 8292, 2.1), aucune boite mail n'est exposee. */
export const VAPID_SUJET    = 'https://lebureauduvigneron.fr';
/* Deux jours : un Mac en veille ou un telephone sans reseau recoit au reveil. Au-dela, la
   nouvelle a ete vue dans le bureau ou dans le courrier de 8 h. */
export const PUSH_TTL = 172800;
export const MAX_APPAREILS = 50;

const enc = new TextEncoder();
function b64u(o: Uint8Array) {
  let s = ''; for (const x of o) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deB64u(s: string) {
  const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - String(s).length % 4) % 4));
  const o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o;
}
function joindre(...l: Uint8Array[]) {
  const o = new Uint8Array(l.reduce((n, x) => n + x.length, 0)); let i = 0;
  for (const x of l) { o.set(x, i); i += x.length; } return o;
}
async function hkdf(sel: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) {
  const k = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sel as BufferSource, info: info as BufferSource }, k, n * 8));
}

/* RFC 8291 : le message, chiffre pour CET appareil seulement. Un seul enregistrement. */
export async function chiffrer(message: Uint8Array, p256dh: string, auth: string) {
  const uaPub = deB64u(p256dh), secret = deB64u(auth);
  if (uaPub.length !== 65 || uaPub[0] !== 4 || secret.length < 16) throw new Error('cles de l\'appareil illisibles');
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const ua = await crypto.subtle.importKey('raw', uaPub as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const partage = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, as.privateKey, 256));
  const ikm = await hkdf(secret, partage, joindre(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sel, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sel, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt']);
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, k, joindre(message, new Uint8Array([2])) as BufferSource));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096, grand-boutiste
  return joindre(sel, rs, new Uint8Array([asPub.length]), asPub, chiffre);
}

/* RFC 8292 : un jeton signe par la cle privee, pour CE service d'envoi (aud). */
export async function jetonVapid(endpoint: string, privee: string, publique: string, sujet: string, maintenant = Date.now()) {
  const pub = deB64u(publique);
  const cle = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', d: privee, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: false,
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const tete = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corps = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(maintenant / 1000) + 12 * 3600, sub: sujet })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, enc.encode(tete + '.' + corps) as BufferSource));
  /* LA PAIRE EST CONTROLEE ICI, pas a l'import : Deno accepte une cle privee qui ne va pas
     avec la publique (Node la refuse). On relit donc la signature avec la cle publique ; si
     elle ne se verifie pas, c'est une erreur de copie du secret, et on le DIT. */
  const verif = await crypto.subtle.importKey('raw', pub as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verif, sig as BufferSource, enc.encode(tete + '.' + corps) as BufferSource)) {
    throw new Error('VAPID_PRIVATE ne va pas avec la cle publique');
  }
  return tete + '.' + corps + '.' + b64u(sig);
}


type Cible = Record<string, any>;

/* Une cle privee qui ne va pas avec la publique leve « VAPID_PRIVATE ne va pas avec la cle
   publique » (controle dans jetonVapid) : une erreur de copie se lit dans le journal.
   UN SERVICE QUI NE REPOND PAS est abandonne au bout de 5 s : sans ce plafond, un seul
   service fige bloquait la fonction jusqu'a sa coupure, et le mail ne partait jamais
   (trouve par le verificateur du lot 60). `jeton` se passe pour n'en fabriquer qu'UN par
   service et par envoi : Apple demande de ne pas le renouveler plus d'une fois par heure. */
export const PUSH_DELAI_MS = 5000;
export async function pousser(a: Cible, message: Record<string, unknown>, publique: string, privee: string, jeton?: string) {
  const corps = await chiffrer(enc.encode(JSON.stringify(message)), String(a.p256dh), String(a.auth));
  if (!jeton) jeton = await jetonVapid(String(a.endpoint), privee, publique, VAPID_SUJET);
  const r = await fetch(String(a.endpoint), {
    method: 'POST', signal: AbortSignal.timeout(PUSH_DELAI_MS),
    headers: {
      Authorization: `vapid t=${jeton}, k=${publique}`,
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
      TTL: String(PUSH_TTL), Urgency: 'normal',
    },
    body: corps as BufferSource,
  });
  await r.body?.cancel();
  return r.status;
}


/* L'ENVOI A UNE LISTE D'APPAREILS, tous en meme temps (cinquante en file depasseraient
   les 15 s de pg_net), un jeton VAPID par service d'envoi (Apple demande de ne pas le
   renouveler plus d'une fois par heure ; `jetons` se partage entre plusieurs appels d'un
   meme passage, voir notif-horaire). Ne leve JAMAIS : rend ce qui est parti, ce qui
   a echoue, et les adresses mortes (404, 410) que l'appelant retire de la base. */
export async function envoyerAux(cibles: Cible[], message: Record<string, unknown>, privee: string,
                                 jetons = new Map<string, Promise<string>>()) {
  let partis = 0; const echecs: string[] = []; const mortes: string[] = [];
  const jetonDe = (endpoint: string) => {
    const o = new URL(endpoint).origin;
    if (!jetons.has(o)) jetons.set(o, jetonVapid(endpoint, privee, VAPID_PUBLIQUE, VAPID_SUJET));
    return jetons.get(o)!;
  };
  await Promise.allSettled((cibles || []).slice(0, MAX_APPAREILS).map(async (a: Cible) => {
    try {
      const code = await pousser(a, message, VAPID_PUBLIQUE, privee, await jetonDe(String(a.endpoint)));
      if (code >= 200 && code < 300) partis++;
      else if (code === 404 || code === 410) mortes.push(String(a.endpoint));
      else echecs.push(`${new URL(String(a.endpoint)).host} ${code}`);
    } catch (e) { echecs.push(String(e).slice(0, 120)); }
  }));
  return { partis, mortes, echec: echecs.length ? [...new Set(echecs)].join(' | ').slice(0, 600) : null };
}

/* L'HEURE A PARIS, jamais par toISOString (qui donne l'heure de Greenwich) : la regle du
   courrier du matin. Heure d'ete comprise, puisque c'est Intl qui la connait. */
export function heureAParis(d = new Date()) {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(d);
  return parseInt(h.replace(/\D/g, ''), 10);
}
/* LA NUIT, de 20 h a 7 h : aucune notification ne part (decision du vigneron, CLAUDE.md). */
export const SILENCE_DEBUT = 20, SILENCE_FIN = 7;
export function enSilence(d = new Date()) {
  const h = heureAParis(d);
  return h >= SILENCE_DEBUT || h < SILENCE_FIN;
}
