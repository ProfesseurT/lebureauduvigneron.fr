/* ===========================================================================
   LA FEUILLE DE L'ANNEE EN PDF, Lot C du 14/09/2026
   ===========================================================================
   IL N'EST PAS DANS `npm run verif`, ET C'EST VOULU, meme motif que les deux
   autres harnais de capture : il demande `playwright`, qui n'est pas une
   devDependency du projet.

       npm i -D playwright && npx playwright install chromium
       npm run build
       npm run pdf:calendrier            # ou : node scripts/pdf-calendrier.mjs --an 2028

   CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS. Il sert `_site` en local, ouvre
   /outils/calendrier-AAAA/, bascule en media `print` et IMPRIME la page. Il ne
   dessine rien. La feuille est celle qu'on voit a l'ecran, avec sa feuille de
   style d'impression : il n'y a pas un gabarit d'ecran et un gabarit de PDF a
   garder d'accord, et c'est la seule raison pour laquelle ce script tient en
   soixante lignes.

   POUR SORTIR L'ANNEE SUIVANTE : ajouter le nombre dans `annees:` en tete de
   src/outils/calendrier-annee.njk, `npm run build`, puis relancer ce script
   avec --an. Rien d'autre. C'est la promesse du chantier.

   TROIS PIEGES, ET ILS ONT TOUS ETE PAYES
   1. LE FOND DU CORPS SE PEINT SUR TOUTE LA PAGE. `body` porte `--paper` ;
      avec `printBackground`, il sortait en bande beige sous la feuille, sur
      plusieurs centimetres. Invisible a l'ecran. Neutralise dans le
      `@media print` de style.css, pas ici : un correctif pose dans le harnais
      ne protege pas le vigneron qui fait Fichier > Imprimer depuis son
      navigateur, et c'est LE cas d'usage principal.
   2. LA PAGE DOIT REMPLIR SON PAPIER. A l'echelle de l'ecran, les douze blocs
      laissaient un quart d'A3 blanc. `html { font-size }` dans le bloc
      d'impression dilate toute l'echelle en `rem` d'un seul chiffre. Mesure au
      14/09/2026 : 19 px tient sur UNE page, 20 px deborde. Ce script compte les
      pages et REFUSE d'ecrire un PDF de deux pages : une feuille a punaiser qui
      sort en deux morceaux n'est pas une feuille.
   3. LES POLICES GOOGLE NE SE CHARGENT PAS SANS RESEAU. Dans un conteneur
      coupe, le PDF sort en polices de repli et les retours a la ligne bougent
      de quelques pixels. La mesure du nombre de pages reste juste, l'allure
      non : regarder le PDF sur une machine qui a du reseau avant de le publier.
   =========================================================================== */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(RACINE, '_site');
const SORTIE = path.join(RACINE, '_apercu');

const iAn = process.argv.indexOf('--an');
const AN = iAn > -1 ? process.argv[iAn + 1] : '2027';

/* On refuse de mentir sur du vide : sans page construite, le PDF sortirait
   blanc et personne ne saurait que c'est le build qui manquait. */
const PAGE = path.join(SITE, 'outils', 'calendrier-' + AN, 'index.html');
if (!fs.existsSync(PAGE)) {
  console.error('ECHEC : ' + path.relative(RACINE, PAGE) + ' n\'existe pas.');
  console.error('  Lancer `npm run build`. Si l\'annee ' + AN + ' est nouvelle, l\'ajouter d\'abord');
  console.error('  dans `annees:` en tete de src/outils/calendrier-annee.njk.');
  process.exit(2);
}

const TYPES = { '.html': 'text/html;charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml' };

const serveur = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(SITE, u);
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  r.end(fs.readFileSync(f));
});
await new Promise((r) => serveur.listen(4392, r));

const pw = await import('playwright');
const chromium = pw.chromium || pw.default.chromium;
/* Sur une machine ou playwright a installe son propre chromium, il n'y a pas de
   chemin a donner : le `existsSync` choisit tout seul. */
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const nav = await chromium.launch(fs.existsSync(CHROME) ? { executablePath: CHROME } : {});
const p = await nav.newPage({ viewport: { width: 1440, height: 1000 } });

await p.goto('http://127.0.0.1:4392/outils/calendrier-' + AN + '/', { waitUntil: 'load' }).catch(() => {});
await p.waitForTimeout(900);

const occurrences = await p.$$eval('.calan__o', (n) => n.length);
const blocs = await p.$$eval('.calan__b', (n) => n.length);
if (blocs !== 12 || occurrences === 0) {
  console.error('ECHEC : ' + blocs + ' bloc(s) et ' + occurrences + ' occurrence(s) rendues.');
  console.error('  Le calcul du navigateur n\'a pas tourne. Douze blocs sont attendus.');
  await nav.close(); serveur.close(); process.exit(1);
}

fs.mkdirSync(SORTIE, { recursive: true });
const fichier = path.join(SORTIE, 'calendrier-du-vigneron-' + AN + '.pdf');
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: fichier, format: 'A3', landscape: true, printBackground: true,
  margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' } });

/* Compter les pages sans dependance : dans un PDF non compresse comme celui que
   rend Chromium, chaque page est un objet `/Type /Page` (jamais `/Pages`). */
const pages = (fs.readFileSync(fichier, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log(occurrences + ' occurrences, ' + blocs + ' blocs, ' + pages + ' page(s)');
console.log('  ' + path.relative(RACINE, fichier));

await nav.close();
serveur.close();

if (pages !== 1) {
  console.error('ECHEC : la feuille sort sur ' + pages + ' pages.');
  console.error('  Une feuille a punaiser ne se coupe pas en deux. Baisser `html { font-size }`');
  console.error('  dans le bloc @media print de src/css/style.css, puis relancer.');
  process.exit(1);
}
console.log('  UNE FEUILLE, PRETE A PUNAISER');
