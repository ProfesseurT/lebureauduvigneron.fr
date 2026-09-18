/* ============================================================================
   scripts/banc-jetons.mjs : tokens.css dit-il la verite ?

     node scripts/banc-jetons.mjs

   Ne modifie rien. Sortie 0 seulement si la doctrine et le servi coincident.

   POURQUOI CE BANC EXISTE, ET CE QU'IL A TROUVE LE 18/09/2026.

   tokens.css s'annonce « source unique de verite pour le site ET le tableau de
   bord », et pose la regle : « aucune couleur, aucune taille, aucun rayon ecrit
   en dur ailleurs ». Deux choses etaient fausses le jour de l'audit.

   1. CE FICHIER N'EST CHARGE PAR RIEN. Aucun <link> ne le pointe, Eleventy ne le
      copie pas dans _site, il ne part pas chez Vercel. La vraie source est le
      bloc :root de src/css/style.css. tokens.css est un document de DOCTRINE, et
      c'est tres bien, mais une doctrine qu'aucun controle ne compare au reel
      derive le jour meme ou on la ferme.

   2. ELLE AVAIT TRENTE ET UN JETONS DE RETARD. --ardoise, --postit-jaune,
      --ombre-papier, --tr-choregraphie, les huit --serie-*, et vingt autres
      etaient servis au navigateur sans etre ecrits nulle part dans la doctrine.
      Les deux fichiers avaient ete touches le meme jour a neuf minutes d'ecart :
      ils etaient tenus a la main, en parallele, ce qui est la mecanique exacte
      d'une derive.

   ET UNE COLLISION, qui est la vraie raison d'etre de ce banc. --ombre-photo
   valait `0 20px 60px rgba(0,0,0,0.35)` dans style.css et
   `10px 10px 0 rgba(0,0,0,0.28)` dans bdv-ecrans.css. Deux ombres sous un seul
   nom. Comme bdv-nav.js pose bdv-ecrans.css APRES style.css, la seconde gagnait,
   et elle gagnait pour la page entiere : une regle du site qui aurait appele ce
   jeton aurait vu son ombre changer toute seule a la premiere ouverture d'un
   ecran de vente. Personne ne l'a vu parce que le site n'appelait ce jeton nulle
   part. C'est ce genre de piege que ce banc attrape, pas une panne visible.

   CE QU'IL CONTROLE, DANS CET ORDRE :
     1. aucun jeton servi deux fois avec deux valeurs differentes ;
     2. tout jeton servi est ecrit dans tokens.css, a la meme valeur ;
     3. tout jeton de tokens.css est effectivement servi quelque part.

   CE QU'IL NE CONTROLE PAS : que tokens.css soit SERVI. Il ne l'est pas, et
   c'est un arbitrage qui appartient a Ted, pas a un banc. Tant qu'il reste une
   doctrine, ce controle la maintient exacte. Le jour ou elle devient la feuille
   servie, ce banc reste valable sans une ligne de changement.
   ============================================================================ */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* LA DOCTRINE. */
const DOCTRINE = 'tokens.css';

/* LES FEUILLES REELLEMENT SERVIES AU NAVIGATEUR, dans l'ordre ou elles arrivent.
   style.css par le gabarit de base, les trois autres posees par bdv-nav.js et
   bdv-reglages.js a l'ouverture d'une piece du bureau. L'ordre compte : en cas
   de collision, c'est la DERNIERE posee qui gagne, et pour la page entiere. */
const SERVIES = [
  'src/css/style.css',
  'src/css/bdv-ecrans.css',
  'src/css/bdv-panneau.css',
  'src/css/bdv-calendrier.css',
];

let ERR = 0, NOTES = 0;
const ok   = m => console.log('  ok    : ' + m);
const ko   = m => { ERR++;   console.log('  ECHEC : ' + m); };
const note = m => { NOTES++; console.log('  note  : ' + m); };

/* ---------------------------------------------------------------------------
   Lecture des blocs :root.

   Les commentaires partent AVANT le comptage des accolades, et pas apres : un
   bloc de commentaire du depot se ferme sur une ligne de tirets, et il en
   contient parfois des accolades d'exemple. C'est le meme piege que celui que
   banc-rejeu.mjs s'est tendu a lui-meme sur le SQL.
   --------------------------------------------------------------------------- */
function jetonsDe(chemin) {
  const abs = path.join(RACINE, chemin);
  if (!fs.existsSync(abs)) { ko(chemin + ' est absent'); return {}; }
  const txt = fs.readFileSync(abs, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const out = {};
  let pos = 0;
  while (true) {
    const rel = txt.slice(pos).search(/(^|\n)\s*:root\s*\{/);
    if (rel < 0) break;
    let j = txt.indexOf('{', pos + rel), d = 0, k = j;
    for (; k < txt.length; k++) { if (txt[k] === '{') d++; else if (txt[k] === '}') { d--; if (!d) break; } }
    for (const m of txt.slice(j + 1, k).matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+)/gi)) out[m[1]] = m[2].trim();
    pos = k + 1;
  }
  return out;
}

/* Deux ecritures de la meme valeur doivent compter pour une seule :
   `rgba(0,0,0,.28)` et `rgba(0, 0, 0, 0.28)` sont le meme gris. On compare donc
   une forme normalisee, jamais la chaine brute. */
const meme = v => v.toLowerCase()
                   .replace(/\s+/g, '')
                   .replace(/(^|[^0-9])\.(\d)/g, '$10.$2')
                   .replace(/;$/, '');

console.log('doctrine : ' + DOCTRINE);
console.log('feuilles servies : ' + SERVIES.length + '\n');

const doctrine = jetonsDe(DOCTRINE);
const parFeuille = SERVIES.map(f => [f, jetonsDe(f)]);
for (const [f, j] of parFeuille) console.log('  ' + String(Object.keys(j).length).padStart(4) + ' jeton(s) dans :root  ' + f);
console.log('  ' + String(Object.keys(doctrine).length).padStart(4) + ' jeton(s) dans :root  ' + DOCTRINE);

/* --- 1. COLLISIONS ------------------------------------------------------- */
console.log('\n== 1. Un nom, une valeur ==');
const parNom = new Map();
for (const [f, j] of parFeuille)
  for (const [n, v] of Object.entries(j)) {
    if (!parNom.has(n)) parNom.set(n, []);
    parNom.get(n).push([f, v]);
  }
let collisions = 0, doublons = 0;
for (const [n, l] of parNom) {
  const valeurs = new Set(l.map(x => meme(x[1])));
  if (valeurs.size > 1) {
    collisions++;
    ko('--' + n + ' est servi avec ' + valeurs.size + ' valeurs differentes :');
    l.forEach(([f, v]) => console.log('            ' + f.padEnd(26) + v));
    console.log('            la derniere feuille posee gagne, et elle gagne pour la page entiere.');
  } else if (l.length > 1) doublons++;
}
if (!collisions) ok('aucun jeton servi avec deux valeurs differentes');
if (doublons) note(doublons + ' jeton(s) redeclare(s) a l\'identique dans plusieurs feuilles : '
                 + 'c\'est voulu tant que bdv-ecrans.css doit rester lisible seule, '
                 + 'mais chaque doublon est une derive qui attend.');

/* --- 2. LA DOCTRINE CONNAIT-ELLE TOUT CE QUI EST SERVI ? ----------------- */
console.log('\n== 2. Tout ce qui est servi est ecrit dans la doctrine ==');
const servis = {};
for (const [, j] of parFeuille) Object.assign(servis, j);
const absents = Object.keys(servis).filter(n => !(n in doctrine)).sort();
const ecarts  = Object.keys(servis).filter(n => n in doctrine && meme(servis[n]) !== meme(doctrine[n]));
if (absents.length) {
  ko(absents.length + ' jeton(s) servi(s) au navigateur et absent(s) de ' + DOCTRINE + ' :');
  console.log('            ' + absents.map(n => '--' + n).join(', '));
  console.log('            ecris-les la-bas AVEC la raison qui les fait exister, pas seulement leur valeur.');
} else ok('les ' + Object.keys(servis).length + ' jetons servis sont tous ecrits dans ' + DOCTRINE);
if (ecarts.length) {
  ko(ecarts.length + ' jeton(s) dont la doctrine ne dit plus la valeur servie :');
  ecarts.forEach(n => console.log('            --' + n + '\n              ' + DOCTRINE.padEnd(22) + doctrine[n]
                                + '\n              servi' .padEnd(23) + servis[n]));
} else ok('aucune valeur divergente entre la doctrine et le servi');

/* --- 3. LA DOCTRINE PARLE-T-ELLE DE CHOSES QUI N'EXISTENT PLUS ? -------- */
console.log('\n== 3. Rien dans la doctrine qui ne soit servi ==');
const fantomes = Object.keys(doctrine).filter(n => !(n in servis)).sort();
if (fantomes.length) note(fantomes.length + ' jeton(s) ecrit(s) dans ' + DOCTRINE + ' et servi(s) nulle part : '
                        + fantomes.map(n => '--' + n).join(', '));
else ok('aucun jeton fantome');

/* --- VERDICT ------------------------------------------------------------- */
console.log('\n== VERDICT ==');
console.log('  echecs : ' + ERR + '   notes : ' + NOTES);
if (ERR === 0) { console.log('  CONFORME : la doctrine dit ce que le navigateur recoit.\n'); process.exit(0); }
console.log('  NON CONFORME : ' + DOCTRINE + ' ne decrit plus ce que le navigateur recoit.\n');
process.exit(1);
