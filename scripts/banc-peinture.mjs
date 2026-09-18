/* ============================================================================
   scripts/banc-peinture.mjs : ON NE PEINT QUE L'ECRAN REGARDE

     npm run banc:peinture

   ECRIT LE 18/09/2026, apres avoir mesure l'amorcage sur les 171 569 lignes de
   Ted et trouve que quatre secondes et demie sur sept partaient a peindre des
   ecrans que personne ne regardait.

                                  avant      apres
     derivation des lignes        1 350 ms   1 350 ms
     computeMeta()                  409 ms     409 ms
     peinture                     5 072 ms     575 ms
     ------------------------------------------------
     amorcage                     6 831 ms   2 334 ms

   Le prix ne disparait pas, il se deplace : le premier clic sur « Mon commerce »
   coute 1 480 ms, celui sur « Mes cuvees » 1 260 ms. Payes au moment ou le
   vigneron a demande a voir la piece, et annonces par `runBusy`.

   POURQUOI CE BANC EXISTE. `npm run verif` a continue de passer apres le
   changement, sans broncher : tous les bancs appellent `renderCap()` ou
   `renderClients()` DIRECTEMENT, donc aucun ne regarde QUAND la peinture a lieu.
   Un gain de soixante-six pour cent que rien ne protege sera repris par le
   premier `renderAll()` qu'on remettra par commodite.

   CE QU'IL OBSERVE, ET C'EST VOLONTAIRE : le CONTENU DES PANNEAUX, pas les
   appels. Un panneau vide est un ecran qu'on n'a pas peint, quelle que soit la
   mecanique interne. Un banc qui espionnerait les fonctions passerait le jour ou
   on renomme un peintre.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
const R = path.join(RACINE, 'src/js') + '/';

let ok = 0, ko = 0;
const t = (nom, bon, det) => {
  if (bon) { ok++; console.log('  ok    : ' + nom); }
  else { ko++; console.log('  ECHEC : ' + nom + (det !== undefined ? '  -> ' + det : '')); }
};

/* Une base modeste : ce banc mesure la STRUCTURE, pas un temps. Dix-neuf mois pour
   que « Mon cap » ait deux exercices comparables et peigne vraiment quelque chose. */
const lignes = [];
for (let i = 0; i < 19; i++) {
  const y = 2025 + Math.floor(i / 12), m = (i % 12) + 1;
  for (const fam of ['Rouge', 'Blanc']) lignes.push({
    famille: fam, couleur: fam, produit: 'Cuvee ' + fam, client: 'Client ' + (i % 5),
    numClient: 'C' + (i % 5), numFacture: 'F' + i + fam, codeTarif: 'T1',
    millesime: String(y - 1), appellation: 'AOC Test', conditionnement: '75cl',
    cp: '44000', ville: 'Nantes', pays: 'France', _y: y, _m: m, _q: 50 + i * 3 });
}

/* CE QU'IL FAUT OBSERVER N'EST PAS TOUJOURS LE PANNEAU DE LA BARRE. « Mon cap » ecrit
   dans `p-diagnostic`, qui vit A L'INTERIEUR de `p-annee` ; « Mon registre » dans
   `p-explorer` et pas `p-explo`. Ma premiere version de ce banc regardait `p-annee` et
   declarait « Mon cap » non peint alors qu'il l'etait : un banc qui regarde le mauvais
   endroit invente des defauts, ce qui est aussi couteux qu'en laisser passer. */
const CIBLES = { annee: 'p-diagnostic', clients: 'p-clients', produits: 'p-produits',
                 chercher: 'p-explorer', reglages: 'p-reglages', base: 'p-base' };
const PANNEAUX = Object.values(CIBLES).concat(['p-annee', 'p-explo']);
const dom = new JSDOM(`<!doctype html><body>
  <div id="app"></div><div id="tbFile"></div>
  <div class="filterbar" id="filterbar"></div>
  ${PANNEAUX.map(id => `<section class="panel" id="${id}"></section>`).join('\n  ')}
  <div id="p-diagnostic"></div>
  <div id="status"></div><div id="statusTxt"></div><div id="statusSpin"></div>
  <div id="busyov"></div><div id="busytxt"></div>
</body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w = dom.window;
w.Chart = function(){ this.destroy = () => {}; };
w.Papa = {};

const test = `
  ROWS.length = 0;
  JSON.parse(${JSON.stringify(JSON.stringify(lignes))}).forEach(function(o){
    var ts = Date.UTC(o._y, o._m-1, 15);
    o._vin = true; o._horsVin = false; o._offert = false;
    o._canal = 'Caveau'; o._typeClient = 'Caviste';
    o._date = { y:o._y, m:o._m, d:15, t:ts };
    o._dayNum = Math.floor(ts/86400000);
    o._exY = o._y; o._exM = o._m; o._exPos = o._m*100+15;
    o._qte = o._q; o._total = 12 * o._q;
    ROWS.push(o);
  });
  computeMeta();

  function remplis(){
    var out = {};
    ${JSON.stringify(PANNEAUX)}.forEach(function(id){
      var e = document.getElementById(id);
      out[id] = !!(e && e.innerHTML && e.innerHTML.trim().length > 20);
    });
    return out;
  }
  function vide(){ ${JSON.stringify(PANNEAUX)}.forEach(function(id){
    var e = document.getElementById(id); if(e) e.innerHTML = ''; }); }

  /* ---- 1. L'amorcage ---- */
  vide(); ECRAN_COURANT = null; ecranInvalider();
  navTo('annee');
  var apresAmorcage = remplis();

  /* ---- 2. On va voir « Mon commerce » ---- */
  navTo('clients');
  var apresClients = remplis();

  /* ---- 3. On y retourne : rien ne doit etre recalcule ---- */
  document.getElementById('p-clients').innerHTML = 'TEMOIN';
  navTo('annee'); navTo('clients');
  var secondePeinture = document.getElementById('p-clients').innerHTML;

  /* ---- 4. La donnee bouge : tout redevient a repeindre ---- */
  ecranInvalider();
  var marqueApresInvalidation = ECRANS_PEINTS.size;
  navTo('clients');
  var repeintApresDonnee = document.getElementById('p-clients').innerHTML !== 'TEMOIN';

  /* ---- 4 bis. renderAll(), le chemin de TOUT import ----
     Ecrit apres coup : la premiere version de ce banc n'exercait que navTo, et une
     mutation qui remettait la peinture des six ecrans DANS renderAll() passait les
     treize controles. Or renderAll() est ce que ecranRafraichir() appelle apres
     chaque import et chaque reglage : c'est le chemin le plus emprunte du fichier. */
  vide(); ecranInvalider(); ECRAN_COURANT = null;
  navTo('produits');            // le vigneron regarde « Mes cuvees »
  vide();                       // on efface pour ne voir que ce que renderAll peint
  renderAll();
  var apresRenderAll = remplis();

  /* ---- 5. Le panneau de reglages ---- */
  vide(); ecranInvalider();
  navTo('annee');
  var reglagesAvantOuverture = remplis()['p-reglages'] || remplis()['p-base'];
  ecranPeindre('reglages');
  var reglagesApresOuverture = remplis()['p-reglages'] || remplis()['p-base'];

  window.__S = {
    apresAmorcage: apresAmorcage, apresClients: apresClients,
    secondePeinture: secondePeinture,
    marqueApresInvalidation: marqueApresInvalidation,
    repeintApresDonnee: repeintApresDonnee,
    apresRenderAll: apresRenderAll,
    reglagesAvantOuverture: reglagesAvantOuverture,
    reglagesApresOuverture: reglagesApresOuverture,
    peintres: Object.keys(PEINTRES)
  };
`;

try {
  w.eval(fs.readFileSync(R + 'bdv-base.js', 'utf8') + '\n'
       + fs.readFileSync(R + 'bdv-ecrans.js', 'utf8') + '\n' + test);
} catch (e) {
  console.log('ECHEC a l\'execution : ' + e.message);
  console.log((e.stack || '').split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}
const S = w.__S;

console.log('\n== 1. L\'amorcage ne peint QU\'UNE piece ==');
t('« Mon cap » est peint', S.apresAmorcage['p-diagnostic']);
/* LE CONTROLE CENTRAL, et le seul qui garde les 4 497 ms. Chacun de ces quatre
   panneaux etait rempli a l'ouverture, pour rien. */
for (const [id, nom] of [['p-clients', 'Mon commerce'], ['p-produits', 'Mes cuvees'],
                         ['p-reglages', 'les reglages'], ['p-base', 'Ma base']]) {
  t(nom + ' n\'est PAS peint a l\'amorcage', !S.apresAmorcage[id]);
}

console.log('\n== 2. Mais il se peint quand on y va ==');
t('« Mon commerce » se peint a l\'arrivee', S.apresClients['p-clients']);
t('et « Mon cap » reste peint', S.apresClients['p-diagnostic']);

console.log('\n== 3. Et il ne se repeint pas pour rien ==');
/* Aller et revenir ne doit rien recalculer : le temoin pose a la main survit.
   Sans cette regle, naviguer entre deux pieces coute un calcul complet a chaque
   aller-retour, ce qui est pire que l'etat d'avant. */
t('un deuxieme passage ne repeint pas', S.secondePeinture === 'TEMOIN', S.secondePeinture.slice(0, 40));

console.log('\n== 4. Sauf si la donnee a bouge ==');
t('une invalidation efface toutes les marques', S.marqueApresInvalidation === 0,
  S.marqueApresInvalidation + ' marque(s) restante(s)');
t('et l\'ecran se repeint au passage suivant', S.repeintApresDonnee);

console.log('\n== 4 bis. renderAll() ne peint QUE la piece regardee ==');
/* C'est le controle qui manquait. Une mutation qui remet `Object.keys(PEINTRES)
   .forEach(ecranPeindre)` dans `renderAll()` doit faire echouer quatre controles. */
t('la piece regardee est repeinte', S.apresRenderAll['p-produits']);
for (const [id, nom] of [['p-diagnostic', 'Mon cap'], ['p-clients', 'Mon commerce'],
                         ['p-reglages', 'les reglages'], ['p-base', 'Ma base']]) {
  t(nom + ' n\'est PAS repeint par renderAll()', !S.apresRenderAll[id]);
}

console.log('\n== 5. Le panneau de reglages suit la meme regle ==');
t('il n\'est pas peint tant qu\'on ne l\'ouvre pas', !S.reglagesAvantOuverture);
t('et il se peint a l\'ouverture', S.reglagesApresOuverture);

console.log('\n== 6. Les peintres couvrent bien les pieces de la barre ==');
/* `NAV` et `PEINTRES` doivent rester d'accord : un ecran ajoute a la barre sans
   peintre s'afficherait vide, sans erreur, et seulement chez quelqu'un qui clique
   dessus. Meme famille que l'ecart NAV / bdv-nav.js que `npm run banc` garde deja. */
const nav = (fs.readFileSync(R + 'bdv-ecrans.js', 'utf8')
  .match(/\{id:'([a-z]+)'[^}]*\}/g) || []).map(m => /id:'([a-z]+)'/.exec(m)[1]);
const manquants = nav.filter(id => S.peintres.indexOf(id) < 0);
t('chaque piece de la barre a son peintre', manquants.length === 0, manquants.join(', '));

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DE LA PEINTURE REFUSE\n'); process.exit(1); }
console.log('  ON NE PEINT QUE CE QUI EST REGARDE\n');
process.exit(0);
