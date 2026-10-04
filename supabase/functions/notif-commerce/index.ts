/* ============================================================================
   supabase/functions/notif-commerce : le mail des nouvelles de « Mon commerce »
   (lot 57, 03/10/2026)
   ----------------------------------------------------------------------------
   Demande de Ted : un devis SIGNE EN LIGNE par un client, ou une affaire
   GAGNEE ou PERDUE PAR UN COLLEGUE, et tout le bureau recoit un mail tout de
   suite, avec les details. Celui qui a fait le geste le recoit aussi : c'est sa
   confirmation (decision de Ted du 03/10/2026, apres le premier essai).

   QUI M'APPELLE. Le declencheur `affaires_notifier` (supabase/lot57-notifications.sql),
   par pg_net, une fois la fermeture validee. Personne d'autre : l'en-tete
   `x-notif-cle` doit porter le secret NOTIF_CLE, le meme que celui range dans
   `public.notif_reglage`. Sans lui, 401 et rien ne se passe.

   CETTE FONCTION NE DECIDE DE RIEN. La sorte (signe, gagnee, perdue), le texte
   des lignes, les destinataires : tout vient de `notif_detail()`, dans la base.
   Ici on ne fait que :
   - poser la ligne du journal AVANT d'envoyer (`notif_envois`, cle primaire =
     l'affaire et l'instant de sa fermeture). Si la ligne existe deja, on
     s'arrete : un mail par fermeture, et UN SEUL. Meme regle que
     `courrier_envois`, on POSE, on ne demande pas « deja envoye ? » ;
   - fabriquer le mail et le confier a Resend, une adresse a la fois (aucun
     destinataire ne voit les autres) ;
   - noter le resultat dans le journal.

   UN ECHEC NE SE REJOUE PAS TOUT SEUL. La ligne reste, avec son motif dans
   `echec`. Un refus de Resend ne dit pas si le mail est parti : mieux vaut un
   mail manquant qu'un mail double (regle 3 du lot 4 du courrier du matin).

   LE SEUIL. Ces mails vont aux MEMBRES du bureau, des vignerons qui ont un
   compte, jamais au client final. C'est du transactionnel, comme l'invitation :
   la regle du SEUIL ne joue pas. L'expediteur est celui du courrier du matin.

   DEPLOIEMENT : depuis ce dossier (suivi par git), APRES le commit, avec
   verify_jwt = false (pg_net n'a pas de jeton de session). Secrets :
   NOTIF_CLE, RESEND_API_KEY, URL_BUREAU, et depuis le lot 60 VAPID_PRIVATE (la
   cle privee des notifications, gardee par Ted, posee une fois).

   LOT 60 : le devis signe part AUSSI en notification (voir « LA NOTIFICATION »).
   La seule chose que la fonction tranche elle-meme, c'est « seulement le devis
   signe » : ce filtre ira en base avec les cases de la grille (lot 4).
   ============================================================================ */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY') ?? '';
const CLE          = Deno.env.get('NOTIF_CLE') ?? '';
const URL_BUREAU   = Deno.env.get('URL_BUREAU') || 'https://lebureauduvigneron.fr/mon-bureau/';
const EXPEDITEUR   = 'Le Bureau du Vigneron <bureau@courrier.lebureauduvigneron.fr>';

/* Un bureau n'a pas vingt membres. Au-dela, quelque chose ne va pas, et on
   n'envoie pas cinquante mails pour le decouvrir. */
const MAX_DEST = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reponse(corps: unknown, code = 200) {
  return new Response(JSON.stringify(corps), {
    status: code,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function entetes(extra: Record<string, string> = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
}

async function rpc(nom: string, corps: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: 'POST', headers: entetes(), body: JSON.stringify(corps),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${nom} : ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

/* La reservation. `ignore-duplicates` + `return=representation` : une ligne
   rendue veut dire « c'est moi qui l'ai posee », un tableau vide « elle
   existait deja ». C'est la cle primaire qui tranche, pas un select avant. */
async function reserver(cle: string, bureau: string, affaire: string, sorte: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/notif_envois`, {
    method: 'POST',
    headers: entetes({ Prefer: 'resolution=ignore-duplicates,return=representation' }),
    body: JSON.stringify({ cle, bureau, affaire_id: affaire, sorte }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`reservation : ${r.status} ${t.slice(0, 300)}`);
  const lignes = t ? JSON.parse(t) : [];
  return Array.isArray(lignes) && lignes.length > 0;
}

async function noter(cle: string, champs: Record<string, unknown>) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/notif_envois?cle=eq.${encodeURIComponent(cle)}`, {
      method: 'PATCH', headers: entetes({ Prefer: 'return=minimal' }), body: JSON.stringify(champs),
    });
  } catch { /* le journal rate ne change rien a ce qui est parti */ }
}

async function envoyer(a: string, sujet: string, html: string, texte: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EXPEDITEUR, to: [a], subject: sujet, html, text: texte }),
  });
  const corps = await r.text();
  if (!r.ok) throw new Error(`Resend : ${r.status} ${corps.slice(0, 200)}`);
}

/* ---------------------------------------------------------------------------
   LA NOTIFICATION (lot 60, 03/10/2026). Le devis signe, et lui seul pour
   l'instant, part AUSSI en notification sur les appareils actives du bureau.

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
const VAPID_PUBLIQUE = 'BIXiV3oN6eZOSjaaLzKwgvS177ZOt9riEuulMr7EsT6lrsVWXCqyhHv9GSE6lh9o1tYaCd6uaMcwdLZL469jfD8';
const VAPID_PRIVEE   = Deno.env.get('VAPID_PRIVATE') ?? '';
/* Le « sujet » VAPID : comment le service d'envoi joint l'expediteur en cas d'abus.
   L'adresse du site suffit (RFC 8292, 2.1), aucune boite mail n'est exposee. */
const VAPID_SUJET    = 'https://lebureauduvigneron.fr';
/* Deux jours : un Mac en veille ou un telephone sans reseau recoit au reveil. Au-dela, la
   nouvelle a ete vue dans le bureau ou dans le courrier de 8 h. */
const PUSH_TTL = 172800;
const MAX_APPAREILS = 50;

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
async function chiffrer(message: Uint8Array, p256dh: string, auth: string) {
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
async function jetonVapid(endpoint: string, privee: string, publique: string, sujet: string, maintenant = Date.now()) {
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

/* Ce que porte la notification : ni nom de client ni montant (ecran verrouille). */
function messagePush(d: Detail) {
  return {
    titre: 'Un devis vient d\'être signé.',
    corps: 'Ouvre ton bureau pour télécharger la commande.',
    url: lienAffaire(String(d.affaire_id)),
    tag: 'signe-' + String(d.affaire_id).slice(0, 8),
  };
}

/* Une cle privee qui ne va pas avec la publique leve « VAPID_PRIVATE ne va pas avec la cle
   publique » (controle dans jetonVapid) : une erreur de copie se lit dans le journal.
   UN SERVICE QUI NE REPOND PAS est abandonne au bout de 5 s : sans ce plafond, un seul
   service fige bloquait la fonction jusqu'a sa coupure, et le mail ne partait jamais
   (trouve par le verificateur du lot 60). `jeton` se passe pour n'en fabriquer qu'UN par
   service et par envoi : Apple demande de ne pas le renouveler plus d'une fois par heure. */
const PUSH_DELAI_MS = 5000;
async function pousser(a: Detail, message: Record<string, unknown>, publique = VAPID_PUBLIQUE, privee = VAPID_PRIVEE, jeton?: string) {
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

async function oublierAppareil(endpoint: string) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/push_abonnements?endpoint=eq.${encodeURIComponent(endpoint)}`, {
      method: 'DELETE', headers: entetes({ Prefer: 'return=minimal' }), signal: AbortSignal.timeout(PUSH_DELAI_MS),
    });
  } catch { /* elle sera retiree au prochain envoi */ }
}

/* Rend { partis, echec } pour le journal. Ne leve jamais : la notification ne doit
   jamais empecher le mail ni la reponse. */
async function notifier(bureau: string, d: Detail) {
  if (d.sorte !== 'signe') return { partis: null, echec: null };
  if (!VAPID_PRIVEE) return { partis: 0, echec: 'VAPID_PRIVATE absente' };
  let cibles: Detail[] = [];
  try { cibles = (await rpc('push_cibles', { p_bureau: bureau })) || []; }
  catch (e) { return { partis: 0, echec: String(e).slice(0, 300) }; }
  const message = messagePush(d);
  let partis = 0; const echecs: string[] = [];
  /* Un jeton par service d'envoi (Apple, Google...), fabrique une fois. */
  const jetons = new Map<string, Promise<string>>();
  const jetonDe = (endpoint: string) => {
    const o = new URL(endpoint).origin;
    if (!jetons.has(o)) jetons.set(o, jetonVapid(endpoint, VAPID_PRIVEE, VAPID_PUBLIQUE, VAPID_SUJET));
    return jetons.get(o)!;
  };
  /* TOUS EN MEME TEMPS : cinquante appareils en file depasseraient les 15 s de pg_net. */
  await Promise.allSettled(cibles.slice(0, MAX_APPAREILS).map(async (a: Detail) => {
    try {
      const code = await pousser(a, message, VAPID_PUBLIQUE, VAPID_PRIVEE, await jetonDe(String(a.endpoint)));
      if (code >= 200 && code < 300) partis++;
      else if (code === 404 || code === 410) await oublierAppareil(String(a.endpoint));
      else echecs.push(`${new URL(String(a.endpoint)).host} ${code}`);
    } catch (e) { echecs.push(String(e).slice(0, 120)); }
  }));
  return { partis, echec: echecs.length ? [...new Set(echecs)].join(' | ').slice(0, 600) : null };
}

/* ---------------------------------------------------------------------------
   LA FABRIQUE DU MAIL. Couleurs en dur : une messagerie ne lit pas nos jetons.
   Chaque valeur porte le NOM du jeton dont elle est copiee (regle du courrier
   du matin). Fond sur la CELLULE en bgcolor ET background-color, largeur bornee
   a 560 px en attribut et en style, aucun degrade, aucune image.
   --------------------------------------------------------------------------- */
const C = {
  papier: '#EFE7D6',   // --paper
  carte:  '#FFFFFF',   // --white
  encre:  '#1E2536',   // --ink
  doux:   '#63523D',   // --muted
  filet:  '#C9C4B9',   // --rule, aplati (rgba non fiable en messagerie)
  accent: '#5A1525',   // --bordeaux
  ok:     '#2D6A2D',   // --ok
  perdu:  '#A03530',   // --danger-deep
};

function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function euros(c: unknown) {
  const n = Number(c);
  if (!Number.isFinite(n)) return '';
  return (n / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u202f\u00a0]/g, ' ') + ' €';
}

function quand(iso: unknown) {
  const d = new Date(String(iso ?? ''));
  if (isNaN(d.getTime())) return '';
  const f = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(d);
  return f.replace(/[\u202f\u00a0]/g, ' ').replace(/(\d{2}):(\d{2})$/, '$1 h $2');
}

/* Les motifs d'une affaire perdue : la MEME liste que MOTIFS de bdv-affaires.js et la
   contrainte de la base. Un code inconnu s'affiche tel quel plutot que de disparaitre. */
const MOTIFS: Record<string, string> = {
  prix: 'Le prix', fournisseur: 'Un fournisseur déjà en place', moment: 'Pas le bon moment',
  sans_reponse: 'Pas de réponse', indisponible: 'Date ou capacité indisponible', autre: 'Autre raison',
};

function nomVin(l: Record<string, unknown>) {
  return [l.designation, l.millesime, l.conditionnement].map((x) => String(x ?? '').trim()).filter(Boolean).join(', ');
}

type Detail = Record<string, any>;

function lienAffaire(id: string) {
  try {
    const u = new URL(URL_BUREAU);
    u.hash = 'affaire=' + id;
    return u.toString();
  } catch { return URL_BUREAU; }
}

function fabriquer(d: Detail) {
  const client = String(d.client || d.titre || 'Ton client');
  const dv = d.devis as Detail | null;
  const num = dv?.numero ? String(dv.numero) : '';
  const par = d.par ? String(d.par) : 'Un collègue';
  let sujet = '', phrase = '', couleur = C.accent, marque = '';
  if (d.sorte === 'signe') {
    sujet = `Devis ${num} signé par ${client}`.replace(/\s+/g, ' ');
    phrase = `${client} vient de signer ${num ? 'le devis ' + num : 'son devis'} en ligne. L'affaire est gagnée.`;
    couleur = C.ok; marque = 'Devis signé';
  } else if (d.sorte === 'gagnee') {
    sujet = `Affaire gagnée : ${client} (par ${par})`;
    phrase = `${par} a gagné l'affaire ${client}${d.titre && d.titre !== client ? ', « ' + d.titre + ' »' : ''}.`;
    couleur = C.ok; marque = 'Affaire gagnée';
  } else {
    sujet = `Affaire perdue : ${client} (par ${par})`;
    phrase = `${par} a classé l'affaire ${client} en « Pas pour cette fois ».`;
    couleur = C.perdu; marque = 'Affaire perdue';
  }

  const lignesInfo: Array<[string, string]> = [];
  lignesInfo.push(['Client', client]);
  if (d.type) lignesInfo.push(["Type d'affaire", String(d.type)]);
  const moment = quand(d.sorte === 'signe' && dv?.signe_le ? dv.signe_le : d.close_le);
  if (moment) lignesInfo.push(['Quand', moment]);
  if (d.sorte === 'perdue' && d.motif) lignesInfo.push(['Motif', MOTIFS[String(d.motif)] ?? String(d.motif)]);
  if (dv?.signataire?.nom) lignesInfo.push(['Signé par', [dv.signataire.nom, dv.signataire.qualite].filter(Boolean).join(', ')]);
  if (num) lignesInfo.push(['Devis', num]);
  if (dv && dv.total_ht_c != null) lignesInfo.push(['Montant', `${euros(dv.total_ht_c)} HT, ${euros(dv.total_ttc_c)} TTC`]);

  const vins: Detail[] = Array.isArray(dv?.lignes) ? dv!.lignes : [];
  const suite = d.sorte === 'perdue'
    ? 'Rien à faire de ton côté. Le motif est noté sur l\'affaire.'
    : d.sorte === 'signe'
      ? 'Prochaine étape : télécharger la commande et l\'importer dans Vitisoft. Le bouton est en tête du devis.'
      : 'Si un devis est accepté, la commande se télécharge depuis le devis, pour Vitisoft.';

  const url = lienAffaire(String(d.affaire_id));
  const bureau = String(d.bureau_nom || 'ton bureau');
  /* LOT 58 : le pied ne dit plus « tout le bureau le recoit », c'est faux depuis que chacun
     coupe ses mails. Il dit OU les couper, comme le courrier du matin. Une perdue n'arrive
     plus jamais ici (notif_detail la refuse) : sa branche reste pour les mails deja en file. */
  const pied = `Tu reçois ce message parce que tu es membre du bureau ${bureau} et que ce mail est coché dans tes réglages, onglet « Le courrier ». Tu peux l'y décocher.`;

  const rangees = lignesInfo.map(([k, v]) => `
          <tr>
            <td bgcolor="${C.carte}" style="background-color:${C.carte};padding:6px 0;font:13px Arial,Helvetica,sans-serif;color:${C.doux};width:130px;vertical-align:top;">${esc(k)}</td>
            <td bgcolor="${C.carte}" style="background-color:${C.carte};padding:6px 0;font:15px Arial,Helvetica,sans-serif;color:${C.encre};vertical-align:top;">${esc(v)}</td>
          </tr>`).join('');

  const tableVins = vins.length ? `
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:18px 24px 6px 24px;font:bold 13px Arial,Helvetica,sans-serif;color:${C.doux};text-transform:uppercase;letter-spacing:1px;">Les vins</td></tr>
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:0 24px 8px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${vins.map((l) => `
          <tr>
            <td bgcolor="${C.carte}" style="background-color:${C.carte};border-top:1px solid ${C.filet};padding:8px 8px 8px 0;font:14px Arial,Helvetica,sans-serif;color:${C.encre};">${esc(nomVin(l))}</td>
            <td bgcolor="${C.carte}" align="right" style="background-color:${C.carte};border-top:1px solid ${C.filet};padding:8px 8px;font:14px Arial,Helvetica,sans-serif;color:${C.doux};white-space:nowrap;">${esc(l.quantite)} x ${esc(euros(l.pu_f_c))}</td>
            <td bgcolor="${C.carte}" align="right" style="background-color:${C.carte};border-top:1px solid ${C.filet};padding:8px 0 8px 8px;font:bold 14px Arial,Helvetica,sans-serif;color:${C.encre};white-space:nowrap;">${esc(euros(l.final_c))}</td>
          </tr>`).join('')}
        </table>
      </td></tr>` : '';

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(sujet)}</title></head>
<body style="margin:0;padding:0;background-color:${C.papier};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.papier}" style="background-color:${C.papier};">
  <tr><td align="center" bgcolor="${C.papier}" style="background-color:${C.papier};padding:24px 12px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};border-top:4px solid ${couleur};padding:22px 24px 4px 24px;font:bold 12px Arial,Helvetica,sans-serif;color:${couleur};text-transform:uppercase;letter-spacing:1px;">${esc(marque)}</td></tr>
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:4px 24px 14px 24px;font:bold 20px Georgia,'Times New Roman',serif;color:${C.encre};line-height:1.3;">${esc(phrase)}</td></tr>
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:0 24px 6px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rangees}
        </table>
      </td></tr>
      ${tableVins}
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:14px 24px 6px 24px;font:14px Arial,Helvetica,sans-serif;color:${C.encre};line-height:1.5;">${esc(suite)}</td></tr>
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:12px 24px 26px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="${C.accent}" style="background-color:${C.accent};"><a href="${esc(url)}" style="display:inline-block;padding:13px 22px;font:bold 15px Arial,Helvetica,sans-serif;color:${C.carte};text-decoration:none;">Ouvrir l'affaire</a></td>
        </tr></table>
      </td></tr>
      <tr><td bgcolor="${C.papier}" style="background-color:${C.papier};padding:14px 24px;font:12px Arial,Helvetica,sans-serif;color:${C.doux};line-height:1.5;">${esc(pied)}</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const texte = [
    marque.toUpperCase(),
    '',
    phrase,
    '',
    ...lignesInfo.map(([k, v]) => `${k} : ${v}`),
    ...(vins.length ? ['', 'Les vins :', ...vins.map((l) => `- ${nomVin(l)} : ${l.quantite} x ${euros(l.pu_f_c)} = ${euros(l.final_c)}`)] : []),
    '',
    suite,
    '',
    `Ouvrir l'affaire : ${url}`,
    '',
    pied,
  ].join('\n');

  return { sujet, html, texte };
}

/* Exporte pour le banc (scripts/banc-notif-mail.mjs). Deno.serve n'est lance
   que si le fichier tourne comme une fonction. */
export { fabriquer, chiffrer, jetonVapid, messagePush, pousser, VAPID_PUBLIQUE };

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function' && !Deno.env.get('NOTIF_BANC')) {
  Deno.serve(async (req) => {
    if (req.method !== 'POST') return reponse({ erreur: 'methode' }, 405);
    if (!SUPABASE_URL || !SERVICE_KEY) return reponse({ erreur: 'configuration' }, 500);
    if (!CLE || CLE.length < 32 || req.headers.get('x-notif-cle') !== CLE) return reponse({ erreur: 'cle' }, 401);
    let c: Record<string, unknown> = {};
    try { c = JSON.parse((await req.text()).slice(0, 2000)); } catch { return reponse({ erreur: 'illisible' }, 400); }
    const bureau = String(c?.bureau ?? ''), affaire = String(c?.affaire_id ?? '');
    if (!UUID.test(bureau) || !UUID.test(affaire)) return reponse({ erreur: 'identifiants' }, 400);

    let d: Detail | null;
    try { d = await rpc('notif_detail', { p_bureau: bureau, p_affaire: affaire }); }
    catch (e) { return reponse({ erreur: String(e) }, 500); }
    /* Rien a annoncer : affaire rouverte depuis, ou fermee sans auteur connu. 200, pas une panne. */
    if (!d || !d.cle) return reponse({ rien: true });

    let moi: boolean;
    try { moi = await reserver(String(d.cle), bureau, affaire, String(d.sorte)); }
    catch (e) { return reponse({ erreur: String(e) }, 500); }
    if (!moi) return reponse({ deja: true, cle: d.cle });

    /* LOT 60 : la notification part D'ABORD, et quoi qu'il arrive au mail. Elle ne suit pas les
       cases du mail : quelqu'un qui a coupe le mail du devis signe garde sa notification. */
    const p = await notifier(bureau, d);
    const pj = p.partis === null ? {} : { push_partis: p.partis, push_echec: p.echec };

    const dest = (Array.isArray(d.destinataires) ? d.destinataires : [])
      .map((x: Detail) => String(x?.email ?? '').trim()).filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const uniques = [...new Set(dest)].slice(0, MAX_DEST);
    if (!uniques.length) {
      await noter(String(d.cle), { envoye_le: new Date().toISOString(), destinataires: 0, ...pj });
      return reponse({ cle: d.cle, sorte: d.sorte, destinataires: 0, notifications: p.partis });
    }
    if (!RESEND_KEY) {
      await noter(String(d.cle), { echec: 'RESEND_API_KEY absente', ...pj });
      return reponse({ erreur: 'RESEND_API_KEY absente' }, 500);
    }

    const m = fabriquer(d);
    let partis = 0; const echecs: string[] = [];
    for (const a of uniques) {
      try { await envoyer(a, m.sujet, m.html, m.texte); partis++; }
      catch (e) { echecs.push(String(e).slice(0, 200)); }
    }
    await noter(String(d.cle), {
      envoye_le: partis ? new Date().toISOString() : null,
      destinataires: partis,
      echec: echecs.length ? echecs.join(' | ').slice(0, 900) : null,
      ...pj,
    });
    return reponse({ cle: d.cle, sorte: d.sorte, destinataires: partis, echecs: echecs.length, notifications: p.partis, url_bureau: URL_BUREAU });
  });
}
