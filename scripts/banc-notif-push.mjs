/* ============================================================================
   scripts/banc-notif-push.mjs : la notification du devis signe (lot 60, 03/10/2026)

     npm run banc:notif-push

   LE CHIFFREMENT EST VERIFIE PAR QUELQU'UN D'AUTRE. Le message est chiffre par le
   code de supabase/functions/notif-commerce/index.ts (WebCrypto, comme dans Deno),
   puis DECHIFFRE par http_ece, la bibliotheque de reference de l'auteur de la
   RFC 8188, avec une cle d'appareil fabriquee ici par le module crypto de Node :
   deux implementations qui ne partagent pas une ligne. Si l'une se trompe, le
   message ne se relit pas et le banc refuse.

   LA SIGNATURE VAPID est verifiee avec la cle publique, par Node.

   IL DEMANDE node 22.6 ou plus (lecture du TypeScript) et http_ece (devDependency).
   Sans eux il s'arrete en le disant : jamais de faux OK.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { execFileSync, execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
let ece;
try { ece = require('http_ece'); }
catch (e) { console.error('\n  http_ece est absent : rien n\'a ete verifie. npm install\n'); process.exit(2); }
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 6)) { console.error('\n  node ' + process.versions.node + ' ne lit pas le TypeScript : rien n\'a ete verifie.\n'); process.exit(2); }

let ok = 0, ko = 0;
const t = (m, b, detail) => { if (b) { ok++; console.log('  ok    : ' + m); } else { ko++; console.log('  ECHEC : ' + m + (detail ? '  -> ' + detail : '')); } };
const b64u = (b) => Buffer.from(b).toString('base64url');
const FONCTION = path.join(RACINE, 'supabase/functions/notif-commerce/index.ts');
const SRC_F = lire('supabase/functions/notif-commerce/index.ts');
/* Depuis le lot 61, le chiffrement et l'envoi vivent dans _shared/webpush.ts : on lit les deux. */
const SHARED = lire('supabase/functions/_shared/webpush.ts');
const SRC = SRC_F + '\n' + SHARED;

/* Fait tourner un morceau de code contre la VRAIE fonction, comme Deno le ferait. */
function essaiDe(code, env = {}) {
  return 'globalThis.Deno={env:{get:(k)=>(' + JSON.stringify(Object.assign({ NOTIF_BANC: '1' }, env)) + ')[k]??""}};'
    + 'const m=await import(' + JSON.stringify(FONCTION) + ');' + code;
}
const ARGS = (code, env) => ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', essaiDe(code, env)];
function dansLaFonction(code, env = {}) {
  return execFileSync(process.execPath, ARGS(code, env), { encoding: 'utf8', timeout: 20000, stdio: 'pipe' });
}
/* Version asynchrone : quand le faux service d'envoi tourne DANS ce processus, une attente
   synchrone le bloquerait et l'envoi ne recevrait jamais de reponse. */
function dansLaFonctionAsync(code, env = {}) {
  return new Promise((ok, ko) => execFile(process.execPath, ARGS(code, env), { encoding: 'utf8', timeout: 20000 },
    (e, sortie, err) => (e ? ko(Object.assign(e, { stderr: err })) : ok(sortie))));
}

/* ==========================================================================
   1. LE CHIFFREMENT, RELU PAR LA REFERENCE
   ========================================================================== */
console.log('\n== 1. Le message chiffre se relit avec http_ece ==');
const appareil = crypto.createECDH('prime256v1'); appareil.generateKeys();
const secret = crypto.randomBytes(16);
const p256dh = b64u(appareil.getPublicKey()), auth = b64u(secret);
const message = JSON.stringify({ titre: 'Un devis vient d\'être signé.', corps: 'é à ç, et un message un peu long. '.repeat(20) });
let corps = null;
try {
  corps = Buffer.from(dansLaFonction('const o=await m.chiffrer(new TextEncoder().encode(' + JSON.stringify(message) + '),'
    + JSON.stringify(p256dh) + ',' + JSON.stringify(auth) + ');console.log(Buffer.from(o).toString("base64"));').trim(), 'base64');
} catch (e) { t('la fonction chiffre', false, String(e).slice(0, 300)); }
if (corps) {
  t('en-tete aes128gcm : sel 16, taille 4096, cle de l\'expediteur 65 octets',
    corps.readUInt32BE(16) === 4096 && corps[20] === 65 && corps[21] === 4);
  let clair = null;
  try { clair = ece.decrypt(corps, { version: 'aes128gcm', privateKey: appareil, authSecret: secret }).toString('utf8'); }
  catch (e) { clair = 'ERREUR ' + e.message; }
  t('http_ece le dechiffre, octet pour octet, accents compris', clair === message, String(clair).slice(0, 80));
  const autre = crypto.createECDH('prime256v1'); autre.generateKeys();
  let vole = 'non';
  try { ece.decrypt(corps, { version: 'aes128gcm', privateKey: autre, authSecret: secret }); vole = 'oui'; } catch (e) {}
  t('un autre appareil ne peut PAS le lire', vole === 'non');
  t('sous 4 Ko, la limite des services d\'envoi', corps.length < 4096, String(corps.length));
}
try { dansLaFonction('await m.chiffrer(new Uint8Array(1),"abc","def");'); t('des cles d\'appareil illisibles sont refusees', false); }
catch (e) { t('des cles d\'appareil illisibles sont refusees', /illisibles/.test(String(e.stderr || e))); }

/* ==========================================================================
   2. LA SIGNATURE VAPID
   ========================================================================== */
console.log('\n== 2. Le jeton VAPID ==');
const paire = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = paire.privateKey.export({ format: 'jwk' });
const pubBrute = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
const maintenant = Date.UTC(2026, 9, 3, 12, 0, 0);
let jeton = '';
try {
  jeton = dansLaFonction('console.log(await m.jetonVapid("https://web.push.apple.com/QGuQ",' + JSON.stringify(jwk.d) + ','
    + JSON.stringify(b64u(pubBrute)) + ',"https://lebureauduvigneron.fr",' + maintenant + '));').trim();
} catch (e) { t('la fonction signe', false, String(e).slice(0, 300)); }
const [h, c, s] = jeton.split('.');
const claims = c ? JSON.parse(Buffer.from(c, 'base64url').toString()) : {};
t('l\'en-tete dit ES256', h && JSON.parse(Buffer.from(h, 'base64url').toString()).alg === 'ES256');
t('aud = le service d\'envoi, sans chemin', claims.aud === 'https://web.push.apple.com');
t('exp a 12 h (moins de 24 h, la limite de la RFC 8292)', claims.exp === maintenant / 1000 + 12 * 3600);
t('sub = l\'adresse du site, aucune boite mail exposee', claims.sub === 'https://lebureauduvigneron.fr');
t('la signature se verifie avec la cle publique',
  !!s && crypto.verify('sha256', Buffer.from(h + '.' + c), { key: paire.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')));

/* ==========================================================================
   3. LE MESSAGE ET LA REGLE DE L'ECRAN VERROUILLE
   ========================================================================== */
console.log('\n== 3. Ce que dit la notification ==');
const msg = JSON.parse(dansLaFonction('console.log(JSON.stringify(m.messagePush({affaire_id:"11111111-2222-3333-4444-555555555555",client:"Cave du Port",titre:"Premiere commande",devis:{total_ht_c:124000,numero:"D-2026-0004"}})));'));
const tout = JSON.stringify(msg);
t('ni nom de client, ni titre, ni numero, ni montant', !/Cave du Port|Premiere|D-2026|1 ?240|124000/.test(tout), tout);
t('le contrat du recepteur : titre, corps, url, tag',
  Object.keys(msg).sort().join() === 'corps,tag,titre,url' && /^https:\/\/lebureauduvigneron\.fr\/mon-bureau\/#affaire=11111111-/.test(msg.url));
const pushJs = lire('src/js/bdv-push.js');
const clePage = (/const CLE_PUBLIQUE = '([^']*)';/.exec(pushJs) || [])[1];
const cleFonction = (/export const VAPID_PUBLIQUE = '([^']*)';/.exec(SHARED) || [])[1];
t('la fonction et la page portent LA MEME cle publique', !!clePage && clePage === cleFonction);

/* ==========================================================================
   4. UN VRAI ENVOI, VERS UN FAUX SERVICE D'ENVOI
   ========================================================================== */
console.log('\n== 4. L\'envoi, de bout en bout, sur un faux service ==');
{
  const recu = [];
  const serveur = http.createServer((req, res) => {
    const morceaux = []; req.on('data', (x) => morceaux.push(x));
    req.on('end', () => { recu.push({ h: req.headers, b: Buffer.concat(morceaux) }); res.statusCode = 201; res.end(); });
  });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const port = serveur.address().port;
  let code = null;
  try {
    code = Number((await dansLaFonctionAsync('console.log(await m.pousser({endpoint:"http://127.0.0.1:' + port + '/push/abc",p256dh:' + JSON.stringify(p256dh)
      + ',auth:' + JSON.stringify(auth) + '},{titre:"Un devis vient d\'être signé.",corps:"x",url:"/mon-bureau/",tag:"signe-1"},'
      + JSON.stringify(b64u(pubBrute)) + ',' + JSON.stringify(jwk.d) + '));')).trim());
  } catch (e) { t('pousser tourne', false, String(e.stderr || e).slice(0, 300)); }
  serveur.close();
  const r = recu[0] || { h: {}, b: Buffer.alloc(0) };
  t('le service a recu UN envoi, et pousser rend son code', recu.length === 1 && code === 201, String(code));
  t('en-tetes : aes128gcm, TTL de deux jours, autorisation vapid t= et k=',
    r.h['content-encoding'] === 'aes128gcm' && r.h.ttl === '172800'
    && (r.h.authorization || '') .startsWith('vapid t=') && (r.h.authorization || '').endsWith(', k=' + b64u(pubBrute)), JSON.stringify(r.h));
  const jt = ((r.h.authorization || '').match(/^vapid t=([^,]+),/) || [])[1] || '';
  const [jh, jc, js] = jt.split('.');
  t('le jeton envoye vise ce service (aud) et se verifie',
    !!js && JSON.parse(Buffer.from(jc, 'base64url').toString()).aud === 'http://127.0.0.1:' + port
    && crypto.verify('sha256', Buffer.from(jh + '.' + jc), { key: paire.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(js, 'base64url')));
  let lu = null;
  try { lu = JSON.parse(ece.decrypt(r.b, { version: 'aes128gcm', privateKey: appareil, authSecret: secret }).toString()); } catch (e) {}
  t('et l\'appareil relit exactement le message', lu && lu.titre === 'Un devis vient d\'être signé.' && lu.tag === 'signe-1');
}

/* ==========================================================================
   5. LA FONCTION, LUE
   ========================================================================== */
{
  let refuse = false;
  try { dansLaFonction('await m.pousser({endpoint:"http://127.0.0.1:9/x",p256dh:' + JSON.stringify(p256dh) + ',auth:' + JSON.stringify(auth) + '},{},'
    + JSON.stringify(m_pub()) + ',' + JSON.stringify(jwk.d) + ');'); } catch (e) { refuse = /Invalid keyData|DataError|ne va pas avec la cle publique/.test(String(e.stderr || e)); }
  t('une cle privee qui ne va pas avec la publique est refusee avant tout envoi', refuse);
}
function m_pub() { return (/export const VAPID_PUBLIQUE = '([^']*)';/.exec(SHARED) || [])[1]; }

console.log('\n== 5. L\'ordre et les garde-fous de la fonction ==');
const serve = SRC_F.slice(SRC_F.indexOf('Deno.serve('));
t('la notification part AVANT le mail, et n\'attend pas qu\'il y ait des destinataires du mail',
  serve.indexOf('await notifier(') > 0 && serve.indexOf('await notifier(') < serve.indexOf('if (!uniques.length)'));
t('elle ne part qu\'apres la reservation du journal (une fermeture, un envoi)', serve.indexOf('await reserver(') < serve.indexOf('await notifier('));
t('le devis signe seul, et la nuit il est differe (lot 61)', /if \(d\.sorte !== 'signe'\) return \{ partis: null, echec: null, differe: false \};/.test(SRC_F) && /if \(enSilence\(\)\) return \{ partis: null, echec: null, differe: true \};/.test(SRC_F));
t('chaque envoi a un plafond de 5 s, et ils partent tous en meme temps',
  /signal: AbortSignal\.timeout\(PUSH_DELAI_MS\)/.test(SHARED) && /export const PUSH_DELAI_MS = 5000;/.test(SHARED) && /await Promise\.allSettled\(\(cibles/.test(SHARED));
t('la paire de cles est controlee par une verification de la signature (Deno ne le fait pas a l\'import)',
  /crypto\.subtle\.verify\(/.test(SRC) && /VAPID_PRIVATE ne va pas avec la cle publique/.test(SRC));
t('urgence normale, et la reponse du service est liberee', /Urgency: 'normal'/.test(SRC) && /await r\.body\?\.cancel\(\);/.test(SRC));
t('une adresse morte (404, 410) est retiree de la base', /code === 404 \|\| code === 410\) mortes\.push/.test(SHARED) && /for \(const m of r\.mortes\) await oublierAppareil\(m\)/.test(SRC_F));
t('sans cle privee, rien ne part et le journal le dit', /if \(!VAPID_PRIVEE\) return \{ partis: 0, echec: 'VAPID_PRIVATE absente', differe: false \};/.test(SRC_F));
t('aucune bibliotheque importee : un seul import, le module partage du depot', (SRC.match(/^\s*import\s/gm) || []).length === 1 && /^import \{[^}]+\} from '\.\.\/_shared\/webpush\.ts';$/m.test(SRC_F) && !/from ['"](npm|jsr|https?):/.test(SRC));
t('le journal note les notifications', (SRC.match(/\.\.\.pj/g) || []).length === 3);
t('une signature de nuit est notee « differee » dans le journal (sinon le matin ne l\'annonce jamais)',
  /const pj = p\.differe \? \{ push_differe: true \} :/.test(SRC_F));
t('aucun tiret cadratin dans la fonction', SRC.indexOf('—') < 0);

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DE LA NOTIFICATION REFUSE\n'); process.exit(1); }
console.log('  LE MESSAGE SE RELIT CHEZ L\'APPAREIL ET SEULEMENT LA\n');
