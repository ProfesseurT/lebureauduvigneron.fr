/* ============================================================================
   scripts/joindre-agenda.mjs
   ============================================================================
   PREPARE le dossier a deployer pour la fonction `agenda-ics`, et TAMPONNE les
   DEUX empreintes dans l'en-tete de `index.ts`.

   C'est le petit frere de `joindre-courrier.mjs`, et c'est un FRERE et pas un
   refactoring commun. Motif : `joindre-courrier.mjs` porte aussi la fabrique
   d'un `envoi.json` et une liste de destinataires qui n'ont aucun sens ici.
   Fondre les deux aurait produit un script a options dont la moitie ne sert
   jamais a l'un ni a l'autre, et qui casserait les deux d'un coup. Ce qui est
   partage, c'est la CONVENTION de la ligne d'empreinte, pas le code.

   ----------------------------------------------------------------------------
   POURQUOI DEUX EMPREINTES
   ----------------------------------------------------------------------------
   Le MOTEUR, `src/js/bdv-echeances.js`, bouge rarement.
   La BIBLIOTHEQUE, `src/_data/echeances.json`, bouge chaque fois qu'une date
   est ajoutee ou qu'un salon est confirme. Une fonction deployee avec la
   bibliotheque de l'an dernier rend un calendrier faux, sans erreur, dans
   l'agenda d'un client. C'est exactement le defaut que le lot A a passe la
   journee a rendre impossible ailleurs : il n'allait pas rentrer par ici.

   ----------------------------------------------------------------------------
   DEUX MODES
   ----------------------------------------------------------------------------
   `npm run agenda:joindre`
       Recopie le moteur et transforme la bibliotheque en module, dans
       `_deploiement/agenda-ics/`, tamponne les deux empreintes dans
       `supabase/functions/agenda-ics/index.ts`, et rappelle la commande de
       deploiement. C'est le seul dossier a partir duquel on deploie.

   `npm run agenda:verif`
       N'ECRIT RIEN. Compare les empreintes inscrites a celles des fichiers
       sources. Dans `npm run verif`.
   ============================================================================ */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* DEUX FICHIERS DE CODE, UNE SEULE EMPREINTE, sur leur concatenation : ce qui
   compte est « est-ce que ce qui tourne est ce que le depot dit », pas lequel
   des deux a bouge. Le message d'echec renvoie de toute facon a la meme
   commande. */
const CODE = ['src/js/bdv-echeances.js', 'src/js/bdv-ics.js'];
const BIBLIO = path.join(RACINE, 'src/_data/echeances.json');
const SOURCE = path.join(RACINE, 'supabase/functions/agenda-ics/index.ts');
const CIBLE  = path.join(RACINE, '_deploiement/agenda-ics');

const M_CODE = /^([ \t]*empreinte du code joint : sha256 )([0-9a-f]{16})(, )(\d+)( lignes\.)$/m;
const M_BIBLIO = /^([ \t]*empreinte de la bibliotheque deployee : sha256 )([0-9a-f]{16})(, )(\d+)( occurrences\.)$/m;

const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex').slice(0, 16);
const lignes = (t) => t.replace(/\n$/, '').split('\n').length;

const sources = CODE.map((f) => ({ nom: path.basename(f), texte: readFileSync(path.join(RACINE, f), 'utf8') }));
const biblioTexte = readFileSync(BIBLIO, 'utf8');
const occurrences = JSON.parse(biblioTexte).length;
let index = readFileSync(SOURCE, 'utf8');

const tout = sources.map((s) => s.texte).join('\n');
const shaM = sha(tout), nM = lignes(tout);
const shaB = sha(biblioTexte), nB = occurrences;

const verifier = process.argv.includes('--verifier');

function lire(re, quoi) {
  const m = index.match(re);
  if (!m) {
    console.error('\n  ECHEC  Pas de ligne d\'empreinte « ' + quoi + ' » dans');
    console.error('         supabase/functions/agenda-ics/index.ts.\n');
    process.exit(1);
  }
  return { sha: m[2], n: parseInt(m[4], 10) };
}

if (verifier) {
  const m = lire(M_CODE, 'code joint');
  const b = lire(M_BIBLIO, 'bibliotheque');
  let ko = 0;
  if (m.sha !== shaM || m.n !== nM) {
    ko++;
    console.error('\n  ECHEC  Le CODE joint a derive.');
    console.error('         inscrit : ' + m.sha + ', ' + m.n + ' lignes');
    console.error('         reel    : ' + shaM + ', ' + nM + ' lignes');
  }
  if (b.sha !== shaB || b.n !== nB) {
    ko++;
    console.error('\n  ECHEC  La BIBLIOTHEQUE jointe a derive.');
    console.error('         inscrit : ' + b.sha + ', ' + b.n + ' occurrences');
    console.error('         reel    : ' + shaB + ', ' + nB + ' occurrences');
  }
  if (ko) {
    console.error('\n         Le depot n\'est plus la source de verite de ce qui tourne.');
    console.error('         Lancer `npm run agenda:joindre`, puis redeployer :');
    console.error('           supabase functions deploy agenda-ics --no-verify-jwt\n');
    process.exit(1);
  }
  console.log('  agenda:verif      empreintes a jour, code ' + shaM + ' (' + nM +
              ' lignes), bibliotheque ' + shaB + ' (' + nB + ' occurrences).');
  process.exit(0);
}

/* ---- le recollage ---- */
rmSync(CIBLE, { recursive: true, force: true });
mkdirSync(CIBLE, { recursive: true });

index = index
  .replace(M_CODE, (_m, a, _s, sep, _n, z) => a + shaM + sep + nM + z)
  .replace(M_BIBLIO, (_m, a, _s, sep, _n, z) => a + shaB + sep + nB + z);
writeFileSync(SOURCE, index, 'utf8');

writeFileSync(path.join(CIBLE, 'index.ts'), index, 'utf8');
for (const s of sources) writeFileSync(path.join(CIBLE, s.nom), s.texte, 'utf8');
/* LA BIBLIOTHEQUE DEVIENT UN MODULE, et pas un `import ... with { type: 'json' }`.
   Un module TypeScript se charge partout, sans dependre du support des attributs
   d'import de la version de Deno qui tournera chez Supabase dans deux ans. */
writeFileSync(
  path.join(CIBLE, 'biblio.ts'),
  '/* ECRIT PAR `npm run agenda:joindre`. NE PAS MODIFIER A LA MAIN.\n' +
  '   La source est src/_data/echeances.json. */\n' +
  /* RECOPIE TELLE QUELLE, INDENTATION COMPRISE. Une version compactee tiendrait
     sur la moitie de la place, et c'est ce qui a ete essaye le 15/09/2026. Mais
     un fichier deploye est un fichier qu'on relit un jour a cote de sa source
     pour comprendre pourquoi les deux different, et une ligne de 25 ko ne se
     relit pas. La place gagnee ne valait pas ca. */
  'export default ' + biblioTexte.replace(/\n$/, '') + ' as any[];\n',
  'utf8',
);

console.log('\n  _deploiement/agenda-ics/ est pret.');
console.log('    index.ts           code joint ' + shaM + ', ' + nM + ' lignes');
for (const s of sources) console.log('    ' + s.nom.padEnd(18) + ' un seul exemplaire dans le depot');
console.log('    biblio.ts          ' + nB + ' occurrences, empreinte ' + shaB);
console.log('\n  Pour deployer, DEPUIS CE DOSSIER et avec --no-verify-jwt :');
console.log('    supabase functions deploy agenda-ics --no-verify-jwt');
console.log('\n  SANS --no-verify-jwt, Supabase exige un en-tete Authorization,');
console.log('  Google Agenda n\'en envoie aucun, et le calendrier reste introuvable.\n');
