/* ============================================================================
   scripts/banc-notif-horaire.mjs : le matin, le soir, la nuit (lot 61, 05/10/2026)

     npm run banc:notif-horaire

   CE QU'IL TIENT
     1. Les obligations recopiees en base (lot61, notif_obligations) sont EXACTEMENT
        celles de src/_data/echeances.json au statut « obligation », regle comprise.
        Une obligation ajoutee au calendrier sans l'etre a la base fait echouer verif.
     2. La fonction notif-horaire, lancee POUR DE VRAI (Node joue Deno), contre une fausse
        base et un faux service d'envoi : la cle, l'heure, l'envoi chiffre, le journal,
        l'adresse morte retiree.
     3. La nuit de notif-commerce : rien ne part de 20 h a 7 h, heure de Paris, ete et
        hiver compris.
   Demande node 22.6 ou plus et http_ece, comme banc:notif-push. Jamais de faux OK.
   ============================================================================ */
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
let ece;
try { ece = require('http_ece'); } catch (e) { console.error('\n  http_ece est absent : rien n\'a ete verifie. npm install\n'); process.exit(2); }
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 6)) { console.error('\n  node trop ancien pour lire le TypeScript : rien n\'a ete verifie.\n'); process.exit(2); }

let ok = 0, ko = 0;
const t = (m, b, detail) => { if (b) { ok++; console.log('  ok    : ' + m); } else { ko++; console.log('  ECHEC : ' + m + (detail ? '  -> ' + detail : '')); } };
const b64u = (b) => Buffer.from(b).toString('base64url');

/* ==========================================================================
   1. LES OBLIGATIONS, MEME LISTE DES DEUX COTES
   ========================================================================== */
console.log('\n== 1. Les obligations de la base sont celles du calendrier ==');
const SQL = lire('supabase/lot61-notif-horaire.sql');
const bloc = (SQL.match(/function public\.notif_obligations\(\)[\s\S]*?values([\s\S]*?)\$\$;/) || [])[1] || '';
const enBase = [...bloc.matchAll(/\('([a-z-]+)',\s*'((?:[^']|'')+)',\s*'(\w+)',\s*(null(?:::int)?|\d+),\s*(null|\d+),\s*(null(?:::date)?|date '[\d-]+')\)/g)]
  .map((m) => ({ cle: m[1], court: m[2], type: m[3], mois: /\d/.test(m[4]) ? +m[4] : null, jour: /\d/.test(m[5]) ? +m[5] : null,
                 date: (m[6].match(/[\d-]{10}/) || [null])[0] }));
const data = JSON.parse(lire('src/_data/echeances.json'));
const liste = Array.isArray(data) ? data : (data.echeances || []);
const obligations = liste.filter((e) => e.statut === 'obligation');
t('le fichier compte des obligations, et la base autant', obligations.length > 0 && enBase.length === obligations.length, enBase.length + ' / ' + obligations.length);
for (const o of obligations) {
  const b = enBase.find((x) => x.cle === o.cle);
  const r = o.recurrence || {};
  const memeRegle = !!b && b.type === r.type
    && (r.type !== 'mensuel' || b.jour === r.jour)
    && (r.type !== 'annuel' || (b.mois === r.mois && b.jour === r.jour))
    && (r.type !== 'unique' || b.date === r.date)
    && ['mensuel', 'annuel', 'unique'].includes(r.type) && !r.duree;
  t('« ' + o.cle + ' » : meme regle en base (' + JSON.stringify(r) + ')', memeRegle, JSON.stringify(b));
}
t('chaque nom court tient sur un ecran verrouille (40 signes au plus)', enBase.every((b) => b.court.length <= 40));

/* ==========================================================================
   2. LA FONCTION, POUR DE VRAI
   ========================================================================== */
console.log('\n== 2. notif-horaire, de bout en bout, contre une fausse base ==');
const appareil = crypto.createECDH('prime256v1'); appareil.generateKeys();
const secret = crypto.randomBytes(16);
const paire = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = paire.privateKey.export({ format: 'jwk' });
const CLE = 'k'.repeat(40);

const vu = { rpc: [], patch: [], suppr: [], push: [] };
const serveur = http.createServer((req, res) => {
  const morceaux = []; req.on('data', (x) => morceaux.push(x));
  req.on('end', () => {
    const corps = Buffer.concat(morceaux);
    if (req.url.startsWith('/rest/v1/rpc/notif_horaire_lots')) {
      vu.rpc.push(JSON.parse(corps.toString()));
      const port = serveur.address().port;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify([
        { personne: 'p1', jour: '2026-10-09', moment: 'matin', message: { titre: 'DRM à faire demain.', corps: 'Ouvre ton bureau pour t\'en occuper.', url: '/mon-bureau/', tag: 'matin-2026-10-09' },
          cibles: [{ endpoint: `http://127.0.0.1:${port}/push/vivant`, p256dh: b64u(appareil.getPublicKey()), auth: b64u(secret) },
                   { endpoint: `http://127.0.0.1:${port}/push/mort`, p256dh: b64u(appareil.getPublicKey()), auth: b64u(secret) }] }]));
    }
    if (req.url.startsWith('/rest/v1/push_journal')) { vu.patch.push({ url: req.url, corps: JSON.parse(corps.toString()) }); res.statusCode = 204; return res.end(); }
    if (req.url.startsWith('/rest/v1/push_abonnements')) { vu.suppr.push(decodeURIComponent(req.url)); res.statusCode = 204; return res.end(); }
    if (req.url.startsWith('/push/')) { vu.push.push({ url: req.url, h: req.headers, b: corps }); res.statusCode = req.url.endsWith('mort') ? 410 : 201; return res.end(); }
    res.statusCode = 404; res.end();
  });
});
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
const port = serveur.address().port;

/* Node joue Deno : `Deno.serve` range le gestionnaire, on l'appelle avec de vraies requetes. */
/* La cle publique est en dur dans _shared : pour signer avec une paire d'essai, on fait
   tourner une copie dont la cle publique est celle de l'essai. */
const SHARED = lire('supabase/functions/_shared/webpush.ts');
const pubEssai = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]));
const copie = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-horaire-'));
fs.mkdirSync(path.join(copie, '_shared')); fs.mkdirSync(path.join(copie, 'notif-horaire'));
fs.writeFileSync(path.join(copie, '_shared/webpush.ts'), SHARED.replace(/export const VAPID_PUBLIQUE = '[^']*';/, "export const VAPID_PUBLIQUE = '" + pubEssai + "';"));
fs.copyFileSync(path.join(RACINE, 'supabase/functions/notif-horaire/index.ts'), path.join(copie, 'notif-horaire/index.ts'));
/* L'HEURE EST FIGEE : sans ca, le banc lance la nuit tomberait sur le silence. */
const horloge = (iso) => 'const __RD=Date;globalThis.Date=class extends __RD{constructor(...a){super(...(a.length?a:[' + JSON.stringify(iso) + ']));}'
  + 'static now(){return new __RD(' + JSON.stringify(iso) + ').getTime();}};';
const lancerCopie = (scenario, env, iso = '2026-10-09T05:30:00Z') => {
  const code = horloge(iso) + 'globalThis.Deno={env:{get:(k)=>(' + JSON.stringify(env) + ')[k]??""},serve:(h)=>{globalThis.__h=h;}};'
    + 'await import(' + JSON.stringify(path.join(copie, 'notif-horaire/index.ts')) + ');'
    + 'const out=[];for(const s of ' + JSON.stringify(scenario) + '){const r=await globalThis.__h(new Request("http://x/",{method:"POST",headers:s.h,body:s.b}));out.push({code:r.status,corps:await r.json()});}'
    + 'console.log(JSON.stringify(out));';
  return new Promise((ok, ko) => execFile(process.execPath, ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', code],
    { encoding: 'utf8', timeout: 30000 }, (e, so, se) => (e ? ko(new Error(se || e.message)) : ok(JSON.parse(so.trim())))));
};
const ENV = { SUPABASE_URL: `http://127.0.0.1:${port}`, SUPABASE_SERVICE_ROLE_KEY: 'service', NOTIF_CLE: CLE, VAPID_PRIVATE: jwk.d };
let r = null;
try {
  r = await lancerCopie([
    { h: { 'x-notif-cle': 'mauvaise' }, b: '{}' },
    { h: { 'x-notif-cle': CLE }, b: '{"moment":"matin"}' },
  ], ENV);
} catch (e) { t('la fonction tourne', false, String(e).slice(0, 400)); }
let nuit = null;
try { nuit = await lancerCopie([{ h: { 'x-notif-cle': CLE }, b: '{"moment":"matin"}' }], ENV, '2026-10-11T20:00:00Z'); }
catch (e) { nuit = null; }
try { fs.rmSync(copie, { recursive: true, force: true }); } catch (e) {}
serveur.close();
if (r) {
  t('sans la bonne cle : 401, et rien n\'est lu', r[0].code === 401 && vu.rpc.length === 1);
  t('l\'essai force le matin : un lot, une personne prevenue, une notification partie',
    r[1].code === 200 && r[1].corps.moment === 'matin' && r[1].corps.lots === 1 && r[1].corps.personnes === 1 && r[1].corps.notifications === 1, JSON.stringify(r[1]));
  t('la base est interrogee avec le moment, et rien d\'autre', JSON.stringify(vu.rpc[0]) === '{"p_moment":"matin"}');
  const v = vu.push.find((p) => p.url.endsWith('vivant'));
  let lu = null;
  try { lu = JSON.parse(ece.decrypt(v.b, { version: 'aes128gcm', privateKey: appareil, authSecret: secret }).toString()); } catch (e) {}
  t('l\'appareil relit le message du matin', !!lu && lu.titre === 'DRM à faire demain.' && lu.tag === 'matin-2026-10-09');
  t('TTL de deux jours et autorisation VAPID', v && v.h.ttl === '172800' && /^vapid t=.+, k=/.test(v.h.authorization || ''));
  t('l\'adresse morte (410) est retiree de la base', vu.suppr.some((u) => u.includes('endpoint=eq.http://127.0.0.1:' + port + '/push/mort')));
  t('un essai force a 22 h ne passe pas : silence, et la base n\'est meme pas interrogee',
    !!nuit && nuit[0].code === 200 && nuit[0].corps.silence === 22 && vu.rpc.length === 1, JSON.stringify(nuit));
  t('le journal note 1 parti, sans echec', vu.patch.length === 1 && vu.patch[0].corps.partis === 1 && vu.patch[0].corps.echec === null
    && /personne=eq\.p1&jour=eq\.2026-10-09&moment=eq\.matin/.test(vu.patch[0].url), JSON.stringify(vu.patch));
}

/* ==========================================================================
   3. L'HEURE ET LA NUIT
   ========================================================================== */
console.log('\n== 3. L\'heure de Paris et la nuit ==');
const essai = 'globalThis.Deno={env:{get:()=>"1"}};'
  + 'const w=await import(' + JSON.stringify(path.join(RACINE, 'supabase/functions/_shared/webpush.ts')) + ');'
  + 'const h=await import(' + JSON.stringify(path.join(RACINE, 'supabase/functions/notif-horaire/index.ts')) + ');'
  + 'const d=(s)=>new Date(s);'
  + 'console.log(JSON.stringify({'
  + 'ete730:w.heureAParis(d("2026-07-15T05:30:00Z")),hiver730:w.heureAParis(d("2026-12-15T06:30:00Z")),'
  + 'nuit2330:w.enSilence(d("2026-10-09T21:30:00Z")),nuit0630:w.enSilence(d("2026-10-09T04:30:00Z")),'
  + 'jour0700:w.enSilence(d("2026-10-09T05:00:00Z")),jour1959:w.enSilence(d("2026-10-09T17:59:00Z")),soir2000:w.enSilence(d("2026-10-09T18:00:00Z")),'
  + 'hiver2000:w.enSilence(d("2026-12-15T19:00:00Z")),'
  + 'm7:h.momentDe(7),m17:h.momentDe(17),m8:h.momentDe(8),force:h.momentDe(3,"soir"),faux:h.momentDe(3,"midi")}));';
const res = await new Promise((ok) => execFile(process.execPath, ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', essai],
  { encoding: 'utf8', timeout: 20000 }, (e, so) => ok(e ? null : JSON.parse(so.trim()))));
t('7 h 30 a Paris, ete comme hiver', !!res && res.ete730 === 7 && res.hiver730 === 7, JSON.stringify(res));
t('23 h 30 et 6 h 30 : silence ; 7 h 00 et 19 h 59 : pas de silence ; 20 h 00 : silence',
  !!res && res.nuit2330 && res.nuit0630 && !res.jour0700 && !res.jour1959 && res.soir2000 && res.hiver2000);
t('le matin a 7 h, le soir a 17 h, rien a 8 h ; un essai force un moment connu, jamais un autre',
  !!res && res.m7 === 'matin' && res.m17 === 'soir' && res.m8 === null && res.force === 'soir' && res.faux === null);

const F = lire('supabase/functions/notif-horaire/index.ts');
t('la fonction n\'appelle que notif_horaire_lots', (F.match(/rpc\('([a-z_]+)'/g) || []).join() === "rpc('notif_horaire_lots'");
t('un seul import, le module partage', (F.match(/^\s*import\s/gm) || []).length === 1 && /from '\.\.\/_shared\/webpush\.ts';/.test(F));
t('l\'horloge passe a la demie et reprend l\'adresse rangee, sans recopier la cle',
  /cron\.schedule\('notif-horaire', '30 \* \* \* \*'/.test(SQL) && /replace\(r\.url, '\/notif-commerce', '\/notif-horaire'\)/.test(SQL) && !/x-notif-cle', '[A-Za-z0-9]{20,}'/.test(SQL));
for (const f of ['supabase/functions/notif-horaire/index.ts', 'supabase/functions/_shared/webpush.ts', 'supabase/lot61-notif-horaire.sql'])
  t(f + ' : aucun tiret cadratin', lire(f).indexOf('—') < 0);

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DU MATIN ET DU SOIR REFUSE\n'); process.exit(1); }
console.log('  LE MATIN REGROUPE, LE SOIR SE TAIT PAR DEFAUT, LA NUIT SE TAIT TOUJOURS\n');
