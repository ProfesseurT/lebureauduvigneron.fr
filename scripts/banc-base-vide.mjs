/* ============================================================================
   scripts/banc-base-vide.mjs : « base vide » ne se conclut pas d'un miroir vide.

     node scripts/banc-base-vide.mjs

   Ne modifie rien. Sortie 0 seulement si les quatre cas sont tenus.

   LE DEFAUT DU 18/09/2026, SIGNALE PAR TED SUR UN HAR COMPLET.
   « Quand on clique sur Mon commerce, ca ouvre mes reglages tout seul. »

   `openApp()` fait `if(baseVide()){ navTo('vide'); ouvrirPanneauReglages(); return; }`.
   Et `baseVide()` rendait `LIGNES_EN_BASE === 0`, c'est-a-dire le compte des lignes
   rangees dans IndexedDB SUR CET APPAREIL. Sur un navigateur qui n'a pas encore
   synchronise, ce compte vaut zero pendant que le compte du vigneron en porte cent
   soixante et onze mille. Le bureau concluait « base vide, va importer » et posait le
   panneau des reglages par-dessus l'ecran demande.

   Dans le HAR de Ted, la synchro rapatriait justement ses 173 pages au meme moment :
   le miroir etait vide parce qu'il se remplissait.

   C'EST LA MEME MALADIE QUE CELLE DU REPERE DE SYNCHRONISATION, ecrite en toutes
   lettres dans bdv-sync.js : **une absence n'est pas un zero.** Un compte qu'on n'a pas
   pu lire, ou qu'on n'a pas encore lu, ne vaut pas zero. Il ne vaut rien, et on ne
   conclut pas dessus.

   CE BANC NE MONTE PAS LE MOTEUR. Il rejoue la fonction seule, sur les quatre etats
   qu'elle peut rencontrer. C'est volontaire : le defaut est dans une decision de trois
   lignes, et un harnais complet le noierait dans mille autres.
   ============================================================================ */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER = path.join(RACINE, 'src/js/bdv-ecrans.js');

let ERR = 0;
const ok = m => console.log('  ok    : ' + m);
const ko = m => { ERR++; console.log('  ECHEC : ' + m); };

const src = fs.readFileSync(FICHIER, 'utf8');

/* On extrait la fonction telle qu'elle est ecrite, et on la rejoue. Lire le fichier
   plutot que recopier la logique ici : un banc qui recopie ce qu'il controle ne
   controle que lui-meme. C'est la lecon du 11/09 sur les controles ecrits pour
   l'occasion. */
const m = src.match(/function baseVide\(\)\{[\s\S]*?\n\}/);
if (!m) { console.log('  ECHEC : baseVide() introuvable dans bdv-ecrans.js'); process.exit(1); }
console.log('source : src/js/bdv-ecrans.js\n');
console.log(m[0].split('\n').map(l => '    ' + l).join('\n') + '\n');

function juger(etat) {
  const f = new Function('lignesPretes', 'ROWS', 'LIGNES_EN_BASE', 'LIGNES_DISTANTES',
    m[0] + '\nreturn baseVide();');
  return f(() => etat.pretes, etat.rows, etat.local, etat.distant);
}

console.log('== les quatre etats ==');

/* 1. LE CAS DE TED. Miroir vide, serveur plein, lignes pas encore derivees. */
if (juger({ pretes: false, rows: [], local: 0, distant: 171569 }) === false)
  ok('miroir vide + serveur plein  -> PAS vide  (le cas de Ted, 18/09)');
else
  ko('miroir vide + serveur plein  -> declare vide : le panneau des reglages s\'ouvrira tout seul');

/* 2. LE DOUTE. Le serveur n'a pas repondu. On ne conclut pas. */
if (juger({ pretes: false, rows: [], local: 0, distant: null }) === false)
  ok('miroir vide + serveur muet   -> PAS vide  (une absence n\'est pas un zero)');
else
  ko('miroir vide + serveur muet   -> declare vide : on conclut sur ce qu\'on ne sait pas');

/* 3. LA VRAIE BASE VIDE. Les deux disent zero : la, on peut le dire. */
if (juger({ pretes: false, rows: [], local: 0, distant: 0 }) === true)
  ok('miroir vide + serveur vide   -> vide      (le nouveau venu, qui doit importer)');
else
  ko('miroir vide + serveur vide   -> pas vide : le nouveau venu n\'aura pas son ecran d\'import');

/* 4. LES LIGNES SONT LA, EN MEMOIRE. C'est ROWS qui tranche, plus rien d'autre. */
if (juger({ pretes: true, rows: [1, 2, 3], local: 0, distant: 0 }) === false)
  ok('lignes derivees en memoire   -> PAS vide  (ROWS tranche seul)');
else
  ko('lignes derivees en memoire   -> declare vide alors que ROWS porte des lignes');

/* Le garde-fou de l'amorcage : la question au serveur ne doit etre posee QUE si le
   miroir est vide. Sinon c'est une requete de plus a chaque ouverture, pour rien. */
console.log('\n== le cout ==');
const amorce = /LIGNES_EN_BASE === 0 && window\.BdvSync[\s\S]{0,220}?compterVentes\(\)/.test(src);
if (amorce) ok('le comptage serveur n\'est demande que si le miroir est vide');
else ko('le comptage serveur est demande sans condition, ou il a disparu');

console.log('\n== VERDICT ==');
if (ERR === 0) { console.log('  echecs : 0\n  TENU : une absence de lignes locales ne vaut plus une base vide.\n'); process.exit(0); }
console.log('  echecs : ' + ERR + '\n  NON TENU\n');
process.exit(1);
