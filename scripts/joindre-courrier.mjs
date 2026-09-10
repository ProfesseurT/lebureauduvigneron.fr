/* ============================================================================
   scripts/joindre-courrier.mjs
   ============================================================================
   PREPARE le dossier a deployer pour la fonction `courrier-matin`, et TAMPONNE
   l'empreinte de la fabrique dans l'en-tete de `index.ts`.

   ----------------------------------------------------------------------------
   POURQUOI CE SCRIPT EXISTE, ET CE N'EST PAS POUR GAGNER DU TEMPS
   ----------------------------------------------------------------------------
   `bdv-courrier.js` vit dans `src/js/`, un seul exemplaire, lu par le
   navigateur et par l'apercu. La fonction Edge, elle, a besoin du fichier a
   cote d'elle au moment du deploiement. Ce recollage se faisait A LA MAIN.

   CE QUE CA A COUTE, constate le 10/09/2026. Le depot contenait une version de
   `index.ts` dont le verrou d'entree etait l'ANCIEN (comparaison de l'en-tete
   Authorization a la cle de service), alors que la fonction en production
   tournait avec le secret dedie `COURRIER_CLE`. Autrement dit : LE DEPOT
   N'ETAIT PLUS LA SOURCE DE VERITE DE CE QUI TOURNAIT. Et l'empreinte inscrite
   dans l'en-tete annoncait 512 lignes quand le fichier en faisait 880.

   Une convention que personne ne tient n'est pas une convention, c'est un
   commentaire faux, et un commentaire faux est pire que pas de commentaire :
   il fait conclure a tort. Donc plus personne ne tient cette ligne a la main.
   Ce script l'ecrit, et `--verifier` la controle dans `npm run verif`.

   ----------------------------------------------------------------------------
   DEUX MODES
   ----------------------------------------------------------------------------
   `npm run courrier:joindre`
       Recopie la fabrique dans `_deploiement/courrier-matin/`, tamponne
       l'empreinte dans `supabase/functions/courrier-matin/index.ts`, et affiche
       ce qu'il faut deployer. C'est le seul dossier a partir duquel on deploie.

   `npm run courrier:joindre -- --verifier`
       N'ECRIT RIEN. Compare l'empreinte inscrite dans `index.ts` a celle du
       fichier `src/js/bdv-courrier.js` present, et sort en erreur si elles
       different. Appele par `npm run verif` : si le contenu du mail a bouge
       sans que le recollage soit refait, le banc le dit avant le commit, et
       pas trois semaines plus tard devant un mail qui ne ressemble a rien.

   ----------------------------------------------------------------------------
   CE QU'IL NE FAIT PAS
   ----------------------------------------------------------------------------
   Il ne deploie pas. Le deploiement passe par Supabase, et il n'y a pas de CLI
   Supabase sur le poste : c'est un geste separe, fait sciemment. Ce script se
   contente de rendre ce geste REPRODUCTIBLE, en garantissant qu'on deploie
   exactement les fichiers du depot et rien d'autre.

   Il ne retire pas les commentaires. La premiere version le faisait pour
   alleger l'envoi. Un script qui reecrit du code pour l'alleger est un script
   qui peut casser du code : le gain etait de quelques kilo-octets, le risque
   etait un mail casse. Deno s'en moque.
   ============================================================================ */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE   = join(dirname(fileURLToPath(import.meta.url)), '..');
const FABRIQUE = join(RACINE, 'src/js/bdv-courrier.js');
const ENVOI    = join(RACINE, 'supabase/functions/courrier-matin/index.ts');
const SORTIE   = join(RACINE, '_deploiement/courrier-matin');

/* La ligne tamponnee. Le format est fixe et il est LU par --verifier : ne pas
   le reformater sans changer les deux endroits en meme temps. */
const MARQUE = /^([ \t]*empreinte de la fabrique deployee : sha256 )([0-9a-f]{16})(, )(\d+)( lignes\.)$/m;

const verifierSeulement = process.argv.includes('--verifier');

function empreinte(txt) {
  return createHash('sha256').update(txt, 'utf8').digest('hex').slice(0, 16);
}

let fabrique, envoi;
try {
  fabrique = readFileSync(FABRIQUE, 'utf8');
  envoi    = readFileSync(ENVOI, 'utf8');
} catch (e) {
  console.error('\n  ECHEC  Fichier introuvable : ' + e.path);
  console.error('         Lancer ce script depuis la racine du depot.\n');
  process.exit(1);
}

/* Comme `wc -l`, c'est-a-dire sans compter la ligne vide finale : le chiffre
   affiche doit etre celui que Ted lit s'il verifie a la main. Un compte qui
   differe de un du sien lui ferait croire a une derive qui n'existe pas. */
function compteLignes(txt) { return txt.replace(/\n$/, '').split('\n').length; }

const sha    = empreinte(fabrique);
const lignes = compteLignes(fabrique);

/* La fabrique ne doit contenir NI import NI require : elle doit tourner dans
   le navigateur, dans Node et dans Deno sans etre modifiee. Ce controle est
   deja dans l'apercu ; il est REPETE ici parce que c'est ici qu'un fichier
   part vers la production, et qu'un garde-fou se place la ou la faute coute. */
const interdits = fabrique
  .split('\n')
  .map((l, i) => ({ n: i + 1, l }))
  .filter(({ l }) => /^\s*(import\s|const\s+\w+\s*=\s*require\(|require\()/.test(l));
if (interdits.length) {
  console.error('\n  ECHEC  src/js/bdv-courrier.js contient un import ou un require :');
  interdits.forEach(({ n, l }) => console.error('         ligne ' + n + ' : ' + l.trim()));
  console.error('         Elle doit tourner dans les trois mondes sans etre modifiee.\n');
  process.exit(1);
}

const inscrite = MARQUE.exec(envoi);

/* ---------------------------------------------------------------- VERIFIER */
if (verifierSeulement) {
  if (!inscrite) {
    console.error('\n  ECHEC  Pas de ligne d\'empreinte dans supabase/functions/courrier-matin/index.ts.');
    console.error('         Lancer : npm run courrier:joindre\n');
    process.exit(1);
  }
  if (inscrite[2] !== sha || Number(inscrite[4]) !== lignes) {
    console.error('\n  ECHEC  Le contenu du mail a bouge sans que le recollage soit refait.');
    console.error('         index.ts annonce  : ' + inscrite[2] + ', ' + inscrite[4] + ' lignes');
    console.error('         la fabrique fait  : ' + sha + ', ' + lignes + ' lignes');
    console.error('         Lancer : npm run courrier:joindre\n');
    process.exit(1);
  }
  console.log('  courrier:joindre  empreinte a jour, ' + sha + ', ' + lignes + ' lignes.');
  process.exit(0);
}

/* ---------------------------------------------------------------- JOINDRE  */
let envoiTampon;
if (inscrite) {
  envoiTampon = envoi.replace(MARQUE, (_m, avant, _s, sep, _n, apres) =>
    avant + sha + sep + lignes + apres);
} else {
  console.error('\n  ECHEC  Pas de ligne d\'empreinte a tamponner dans index.ts.');
  console.error('         Elle doit exister, au format exact :');
  console.error('           empreinte de la fabrique deployee : sha256 0123456789abcdef, 880 lignes.\n');
  process.exit(1);
}
if (envoiTampon !== envoi) writeFileSync(ENVOI, envoiTampon);

/* Le dossier de sortie est REFAIT a chaque fois. Sans ca, un fichier laisse
   par un recollage precedent partirait avec le suivant, et c'est exactement
   la categorie de derive que ce script existe pour supprimer. */
rmSync(SORTIE, { recursive: true, force: true });
mkdirSync(SORTIE, { recursive: true });
writeFileSync(join(SORTIE, 'index.ts'), envoiTampon);
writeFileSync(join(SORTIE, 'bdv-courrier.js'), fabrique);

console.log('');
console.log('  Dossier a deployer : _deploiement/courrier-matin/');
console.log('    index.ts           ' + compteLignes(envoiTampon) + ' lignes');
console.log('    bdv-courrier.js    ' + lignes + ' lignes, sha256 ' + sha);
console.log('');
console.log('  Empreinte tamponnee dans supabase/functions/courrier-matin/index.ts.');
console.log('  Ces deux fichiers, et eux seuls, sont ce qui doit partir en production.');
console.log('');
