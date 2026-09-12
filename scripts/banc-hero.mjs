/* ==========================================================================
   LE BANC DU HERO, 12/09/2026
   ==========================================================================
   IL N'EST PAS DANS `npm run verif`, POUR LA MEME RAISON QUE
   scripts/capture-telephone.mjs : il demande `playwright`, qui n'est pas une
   devDependency du projet. Pour le lancer :

       npm i -D playwright && npx playwright install chromium
       npm run build
       node scripts/banc-hero.mjs

   CE QU'IL MESURE, ET POURQUOI AUCUN AUTRE CONTROLE NE LE REMPLACE.

   Le hero pose du texte clair PAR-DESSUS UNE PHOTOGRAPHIE. Le contraste n'y est
   donc pas une propriete du CSS : il depend, pixel par pixel, de ce que la photo
   montre a cet endroit-la, du cadrage que le navigateur a choisi pour la fenetre
   courante, et du degrade pose entre les deux. `npm run charte` lit des regles
   CSS : il ne peut rien dire de tout ca, et il annoncera CONFORME sur un hero
   illisible. C'est exactement ce qui s'etait produit avant le 12/09/2026, ou le
   paragraphe et les deux boutons tombaient sur l'ecran allume de la photo, la
   zone la plus claire de l'image.

   LA METHODE, et c'est elle qui fait la valeur du banc. On photographie la page
   DEUX FOIS : une fois telle quelle, une fois le bloc de texte rendu invisible.
   La seconde capture donne le fond REELLEMENT PEINT sous chaque lettre, voile
   compris. Pour chaque element de texte on prend alors le pixel de fond le PLUS
   CLAIR de sa boite, pas la moyenne : c'est le pire cas, et c'est le seul qui
   compte, parce qu'une ligne illisible sur dix suffit a perdre un lecteur.

   TROIS PIEGES PAYES EN L'ECRIVANT. Les relire avant d'y toucher.

   1. `opacity` N'EST PAS UNE COULEUR DE TEXTE. Cinq elements du hero portent une
      opacite. La couleur qui arrive a l'oeil n'est pas `color`, c'est
      `opacity x color + (1 - opacity) x fond`. Compare le `color` brut au fond et
      on obtient des ratios flatteurs et faux.

   2. LE BOUTON PLEIN EST UN FAUX POSITIF, ET IL FAUT L'ECARTER NOMMEMENT. `.btn`
      porte son propre fond `--paper` : son texte bordeaux se lit sur du papier,
      a 11:1, et pas sur la photo. Le mesurer contre la photo donne 1,2:1 et un
      echec qui n'existe pas. Un banc qui crie sur du sain finit par ne plus etre
      lu. `.btn--ghost`, lui, est transparent : celui-la se mesure vraiment.

   3. DEUX LARGEURS, ET PAS UNE. Le voile est DIRECTIONNEL au-dessus de 900 px et
      FRANC en dessous. Ce sont deux reglages differents, donc deux mesures. Un
      banc qui ne controle que 1440 px valide un telephone qu'il n'a pas regarde.

   CE QU'IL NE VOIT PAS, et qu'il faut dire. Les polices Google ne se chargent pas
   dans un conteneur sans reseau : les captures sortent en polices de repli. Les
   hauteurs de ligne et les retours a la ligne peuvent donc differer de quelques
   pixels du vrai site. Le contraste, lui, ne depend pas de la fonte.
   ========================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(RACINE, '_site');
if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.error('\n  _site/index.html est absent : lance npm run build d\'abord.');
  console.error('  Rien n\'a ete controle.\n');
  process.exit(2);
}

/* Les elements mesures. `ignore` porte la raison, pour qu'on ne la redecouvre pas. */
const CIBLES = [
  { sel: '.hero__eyebrow' },
  { sel: '.hero h1' },
  { sel: '.hero__lead' },
  { sel: '.hero__desc' },
  { sel: '.hero__fineprint' },
  { sel: '.hero .btn--ghost' },
  { sel: '.hero .btn:not(.btn--ghost)', ignore: 'fond --paper propre, bordeaux sur papier = 11:1' },
];
const SEUIL = 4.5;

const TYPES = { '.html':'text/html;charset=utf-8', '.css':'text/css;charset=utf-8',
  '.js':'text/javascript;charset=utf-8', '.json':'application/json', '.png':'image/png',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.webp':'image/webp',
  '.woff2':'font/woff2', '.webmanifest':'application/manifest+json' };

const serveur = http.createServer((q, p) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(SITE, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { p.writeHead(404); return p.end('nope'); }
  p.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(p);
});
await new Promise(r => serveur.listen(4380, r));

const pw = await import('playwright');
const chromium = pw.chromium || pw.default.chromium;
/* Le chemin est celui du conteneur de travail. Sur une machine ou playwright a
   installe son propre chromium, retirer executablePath. */
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const nav = await chromium.launch(fs.existsSync(CHROME) ? { executablePath: CHROME } : {});

const lin = c => { c /= 255; return c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055) ** 2.4; };
const lum = ([r,g,b]) => 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
const ratio = (a,b) => { const [h,l] = [lum(a),lum(b)].sort((x,y)=>y-x); return (h+0.05)/(l+0.05); };

let ERR = 0;
for (const [nom, W, H] of [['grand ecran', 1440, 900], ['telephone', 390, 844]]) {
  const page = await nav.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:4380/', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(800);

  const mesures = await page.evaluate(sels => sels.map(s => {
    const e = document.querySelector(s);
    if (!e) return { sel: s, absent: true };
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    const col = cs.color.slice(cs.color.indexOf('(')+1, cs.color.indexOf(')'))
                        .split(',').slice(0,3).map(Number);
    return { sel: s, x: r.x, y: r.y, w: r.width, h: r.height,
             col, op: parseFloat(cs.opacity) };
  }), CIBLES.map(c => c.sel));

  /* LE FOND SEUL. `visibility: hidden` et non `display: none` : le second
     retirerait le bloc du flux, le hero se recentrerait, et on photographierait
     un fond qui n'est plus sous les lettres. */
  await page.evaluate(() => document.querySelectorAll('.hero__bloc')
                                    .forEach(e => e.style.visibility = 'hidden'));
  await page.waitForTimeout(250);
  const brut = await page.screenshot();
  await page.close();

  /* Lecture du PNG sans dependance : on repasse par le navigateur, qui sait
     decoder une image et rendre des pixels. Ajouter sharp ou jimp au projet pour
     lire quelques milliers de pixels ne se justifie pas. */
  const lecteur = await nav.newPage();
  await lecteur.setContent('<canvas id=c></canvas>');
  const pixels = await lecteur.evaluate(async ({ b64, boites }) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + b64; });
    const c = document.getElementById('c');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return boites.map(b => {
      if (b.absent || b.w < 1 || b.h < 1) return null;
      const x = Math.max(0, Math.round(b.x)), y = Math.max(0, Math.round(b.y));
      const w = Math.min(c.width - x, Math.round(b.w)), h = Math.min(c.height - y, Math.round(b.h));
      if (w < 1 || h < 1) return null;
      const d = ctx.getImageData(x, y, w, h).data;
      const out = [];
      for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i+1], d[i+2]]);
      return out;
    });
  }, { b64: brut.toString('base64'), boites: mesures });
  await lecteur.close();

  console.log('\n== ' + nom + ' ' + W + ' x ' + H + ' ==');
  mesures.forEach((m, i) => {
    const regle = CIBLES[i];
    if (m.absent) { console.log('  ECHEC : ' + m.sel + ' est absent de la page'); ERR++; return; }
    if (regle.ignore) { console.log('  ecarte: ' + m.sel.padEnd(28) + regle.ignore); return; }
    const px = pixels[i];
    if (!px) { console.log('  ECHEC : ' + m.sel + ' hors champ'); ERR++; return; }
    const pire = px.reduce((a, p) => lum(p) > lum(a) ? p : a, px[0]);
    const vu = m.col.map((c, k) => m.op * c + (1 - m.op) * pire[k]);
    const r = ratio(vu, pire);
    const ok = r >= SEUIL;
    if (!ok) ERR++;
    console.log('  ' + (ok ? 'ok    ' : 'ECHEC ') + ': ' + m.sel.padEnd(28) +
                'op=' + m.op.toFixed(2) + '  pire fond=' + pire.join(',') +
                '  ->  ' + r.toFixed(2) + ':1');
  });
}

await nav.close();
serveur.close();
console.log('\n== VERDICT ==');
console.log(ERR ? '  ' + ERR + ' echec(s) : du texte du hero passe sous ' + SEUIL + ':1'
                : '  CONFORME : tout le texte du hero tient ' + SEUIL + ':1 au pire pixel');
process.exit(ERR ? 1 : 0);
