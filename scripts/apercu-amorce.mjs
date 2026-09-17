/* ============================================================================
   scripts/apercu-amorce.mjs : le voile d'amorcage, EN IMAGE

     npm run apercu:amorce      puis on ouvre _apercu/amorce.html

   IL NE VERIFIE RIEN, IL MONTRE. C'est la regle du 11/09/2026, payee trois fois
   depuis : la mesure trouve ce qu'on ne voit pas, la capture voit ce qu'on ne
   mesure pas. `npm run banc:amorce` valide 27 controles sur un voile qu'il ne
   regarde jamais ; ce fichier-la le donne a voir.

   IL MONTE LE VRAI MODULE dans jsdom et le pilote jusqu'a chacun de ses etats :
   le balisage vient donc de `bdv-amorce.js`, jamais d'une copie ecrite ici. Une
   page d'apercu qui recopierait le HTML a la main validerait un dessin que le
   produit n'affiche pas, ce qui est exactement le defaut du 11/09/2026.

   ET ELLE CHARGE LA VRAIE FEUILLE, `src/css/style.css`, pas `tokens.css` : ce
   dernier n'est servi a aucun navigateur, et un harnais qui le chargerait
   montrerait des couleurs que la page n'a pas. Piege paye le 08/09/2026.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER = path.join(RACINE, 'src/js/bdv-amorce.js');
const SORTIE = path.join(RACINE, '_apercu/amorce.html');

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) { console.error('\n  jsdom est absent : npm install --save-dev jsdom\n'); process.exit(2); }

const attendre = (ms) => new Promise(r => setTimeout(r, ms));

function monter() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window;
  w.BdvCompte = { session: () => ({ user: { id: 'moi' } }) };
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(FICHIER, 'utf8');
  w.document.body.appendChild(s);
  return w;
}

/* Les cinq etapes de la vraie page, dans leur vrai ordre et avec leurs vrais
   libelles. Les recopier est le seul endroit ou ce fichier duplique quelque chose,
   et c'est assume : une page d'apercu qui irait les lire dans le gabarit ne
   montrerait plus rien le jour ou le gabarit bouge d'une virgule. */
const ETAPES = [
  ['bureau',   'Ton bureau'],
  ['suivi',    'Tes clients et tes rappels'],
  ['journal',  'Ton journal récent'],
  ['lectures', 'Ce que tu as mis de côté'],
  ['profil',   'Tes réglages']
];

async function etat(nom, scenario) {
  const w = monter();
  const etapes = ETAPES.map(([cle, texte]) => ({ cle, texte, faire: scenario(cle) }));
  w.BdvAmorce.lancer(etapes, { plafondMs: 80 });
  await attendre(nom === 'encours' ? 10 : 260);
  const v = w.document.querySelector('.bdv-amorce');
  return v ? v.outerHTML : '<p>rien a montrer</p>';
}

const enCours = await etat('encours', (cle) => () => cle === 'bureau'
  ? new Promise(() => {})                 // la premiere n'a pas fini
  : Promise.resolve(true));
const rate = await etat('rate', (cle) => () => (cle === 'suivi' || cle === 'journal')
  ? Promise.resolve(false)                // deux lectures muettes
  : Promise.resolve(true));
const muet = await etat('muet', () => () => new Promise(() => {}));  // le serveur ne repond pas du tout

/* Le voile est en `position: fixed` : trois voiles dans une meme page se
   superposeraient. Chaque etat est donc pose dans un cadre qui retablit un
   contexte de positionnement, et le voile y devient absolu. */
const page = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Apercu : le voile d'amorcage</title>
<link rel="stylesheet" href="../src/css/style.css">
<style>
  body{ padding:2rem; background:var(--paper-deep,#E4DBC6); font-family:var(--font-corps); }
  h1{ font-family:var(--font-titre); }
  .cadre{ position:relative; height:34rem; margin:0 0 2rem; overflow:hidden;
          border:1px solid var(--rule); background:var(--paper); }
  .cadre .bdv-amorce{ position:absolute; }
  .lg{ font:600 0.8rem var(--font-corps); letter-spacing:.06em; text-transform:uppercase;
       color:var(--muted); margin:0 0 .5rem; }
</style></head><body>
<h1>Le voile d'amorcage</h1>
<p>Genere par <code>npm run apercu:amorce</code> depuis le vrai module. Il ne verifie rien : il se regarde.</p>
<p class="lg">1. Pendant le raccordement</p><div class="cadre">${enCours}</div>
<p class="lg">2. Deux lectures n'ont pas repondu</p><div class="cadre">${rate}</div>
<p class="lg">3. Le serveur est muet, le plafond a rendu la main</p><div class="cadre">${muet}</div>
</body></html>`;

fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, page, 'utf8');
console.log('\n  apercu:amorce     _apercu/amorce.html ecrit, trois etats. A OUVRIR ET A REGARDER.\n');
process.exit(0);
