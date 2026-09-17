/* ============================================================================
   scripts/banc-volume.mjs : le moteur sur une GROSSE base

     npm run banc:volume

   ECRIT LE 17/09/2026, apres l'essai de Ted sur sa base de facturation, 171 569
   lignes au lieu des 4 939 habituelles : « Mon commerce non, mon cap non, mes
   cuvees non, mon registre non. J'ai meme pas de message pour me dire que ca
   mouline. »

   MESURE DE DEPART, moteur reel, memes lignes :

                                   avant        apres
     derivation                    2 698 ms     1 474 ms
     computeMeta()                   971 ms       369 ms
     memoire des seules colonnes     268 Mo        10 Mo

   La cause n'etait pas une fonction lente, c'etait le VOLUME D'OBJETS : chaque
   ligne recopiait ses 43 colonnes dans un objet nomme, soit sept millions et demi
   d'ecritures de proprietes et 268 Mo, dont la plupart des colonnes ne sont lues
   par aucun ecran.

   CE BANC NE MESURE PAS UN TEMPS POUR LE COMPARER A UN SEUIL : un seuil en
   millisecondes echoue au hasard selon la machine, et un banc qui echoue au
   hasard finit ignore. Il verifie la FORME qui a produit le gain, laquelle ne
   depend d'aucune machine, et il AFFICHE le temps pour qu'on le voie changer.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RACINE, 'src/js/bdv-base.js');
let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) { console.error('\n  jsdom est absent : npm install --save-dev jsdom\n'); process.exit(2); }

let ok = 0, ko = 0;
const dit = (b, m, det) => {
  if (b) { ok++; console.log('  ok    : ' + m); }
  else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + det : '')); }
};

/* Une vraie ligne de la base de facturation, 43 colonnes. Un jeu d'essai plus sage
   que la realite ne verifie que ce qu'il contient : c'est la lecon du 08/09/2026,
   payee trois fois depuis. Les colonnes vides en font partie. */
const MODELE = ['13/01/2026', '202600291', 'Location mensuelle du logiciel Vitisoft', '52',
  'Locations + VPS', '', '', '', '', '', '', '', '', '0', '104,5', '104,5',
  'SASU Le Comptoir de Chateau Paquette', '2748', 'FVIV', '1', 'FVIV', 'PAQUETTE', '', 'FVIV',
  '', '', 'Mensuelle', '', '', '0', '', 'FVIV', 'FREJUS', '83600', '', '', '', '', '', '',
  'contact@chateaupaquette.fr', '0494408790', '0610981143'];

const N = Number(process.env.BANC_VOLUME_LIGNES || 171569);
const items = new Array(N);
for (let i = 0; i < N; i++) {
  const l = MODELE.slice(), j = i % 2000;
  l[0] = String(1 + (i % 28)).padStart(2, '0') + '/' + String(1 + (i % 12)).padStart(2, '0') + '/' + (2022 + (i % 5));
  l[1] = '20260' + i; l[16] = 'Client ' + j; l[17] = String(1000 + j);
  l[14] = String(10 + (i % 90)) + ',5'; l[15] = String(10 + (i % 90)) + ',5'; l[19] = String(1 + (i % 12));
  items[i] = { h: 'h' + i, raw: l };
}

const dom = new JSDOM(`<!doctype html><body><div id="status"></div><div id="statusTxt"></div>
<div id="statusSpin"></div><div id="busyov"></div><div id="busytxt"></div></body>`,
  { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w = dom.window;
w.Chart = function () { this.destroy = () => {}; };
w.Papa = {};
w.__items = items;

/* UN SEUL `eval`, comme banc-registre.mjs : le moteur declare ses globales en `let`
   et `const`, qui restent scopees a CET eval. Deux appels donnent « ROWS is not
   defined », sans que rien n'ait echoue avant. */
w.eval(fs.readFileSync(SRC, 'utf8') + `
;(function(){
  var L = globalThis.__items;
  var t1 = Date.now();
  ROWS = L.map(function(it){ return deriveRow(it.raw); });
  var t2 = Date.now();
  computeMeta();
  var t3 = Date.now();
  globalThis.__res = {
    derive: t2 - t1, meta: t3 - t2, lignes: ROWS.length,
    ca: Math.round(ROWS.reduce(function(s, r){ return s + (r._total || 0); }, 0)),
    // Les colonnes viennent-elles du prototype, ou ont-elles ete recopiees ?
    propres: Object.getOwnPropertyNames(ROWS[0]),
    colonnes: { client: ROWS[5].client, produit: ROWS[5].produit, famille: ROWS[5].famille,
                vide: ROWS[5].appellation, brut: Array.isArray(ROWS[5]._r) },
    parPaquets: typeof deriverParPaquets === 'function',
    souffle: typeof souffler === 'function'
  };
})();`);

const r = w.__res;

console.log('\n== Le moteur sur ' + r.lignes.toLocaleString('fr-FR') + ' lignes ==');
console.log('  derivation      ' + r.derive + ' ms');
console.log('  computeMeta()   ' + r.meta + ' ms');
console.log('  total           ' + (r.derive + r.meta) + ' ms      (reference du 17/09/2026 : 3 669 ms avant, 1 843 ms apres)');

console.log('\n== 1. Les colonnes ne sont plus recopiees ligne par ligne ==');
dit(r.propres.indexOf('produit') < 0 && r.propres.indexOf('client') < 0,
  'une ligne ne porte AUCUNE colonne en propre : elles viennent du prototype',
  r.propres.filter(n => n[0] !== '_').join(' ') || '(aucune)');
dit(r.propres.indexOf('_r') >= 0, 'elle garde le tableau brut, et lui seul');
dit(r.propres.indexOf('_total') >= 0 && r.propres.indexOf('_date') >= 0,
  'les champs DERIVES, eux, restent en propre : ils sont calcules, pas lus');

console.log('\n== 2. Et elles se lisent exactement comme avant ==');
/* Le controle qui compte : le gain ne vaut rien si une colonne rend autre chose.
   `r.produit` doit s'ecrire et se lire sans qu'aucun ecran change d'une virgule. */
dit(r.colonnes.client === 'Client 5', 'le nom du client se lit', r.colonnes.client);
dit(r.colonnes.produit === 'Location mensuelle du logiciel Vitisoft', 'le produit se lit', r.colonnes.produit);
dit(r.colonnes.famille === 'Locations + VPS', 'la famille se lit', r.colonnes.famille);
dit(r.colonnes.vide === '', 'une colonne VIDE rend la chaine vide, jamais undefined', JSON.stringify(r.colonnes.vide));
dit(r.ca > 0, 'le chiffre d\'affaires se calcule toujours', r.ca);

console.log('\n== 3. Le calcul rend la main au navigateur ==');
/* Sans respiration, le message « analyse en cours » est ecrit dans le document et
   n'apparait jamais : rien ne repeint entre son ecriture et la fin de la boucle.
   C'est le « j'ai meme pas de message » de Ted, et ca ne se repare pas avec un
   texte de plus, ca se repare en rendant la main. */
dit(r.parPaquets, 'la derivation passe par deriverParPaquets()');
dit(r.souffle, 'et une respiration existe pour laisser peindre entre deux paquets');

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DU VOLUME REFUSE\n'); process.exit(1); }
console.log('  LA LIGNE NE RECOPIE PAS SES COLONNES, ET LE CALCUL RESPIRE\n');
process.exit(0);
