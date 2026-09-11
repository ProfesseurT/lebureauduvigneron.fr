/* ============================================================================
   BANC DE « MON COMMERCE », ecrit le 11/09/2026 au lot 5 de la redecoupe.

   CE QU'IL GARDE. Deux choses qu'aucun autre controle ne voit.

   1. LE VERDICT EST EN TETE, AVANT LA LISTE. « D'ou vient ta variation » et ses
      quatre lignes de mouvement de clientele sont arrivees ici au lot 1 ; elles
      doivent rester au-dessus de la liste, sinon la piece redevient un tableau de
      plus. Et elles s'affichent MEME quand il n'y a personne a rappeler : c'est
      ce jour-la qu'elles sont le plus utiles a lire.

   2. LES QUATRE EXPORTS DE LISTES COMPLETES SONT ATTEIGNABLES. Leurs boutons
      vivaient dans trois ecrans masques depuis la fusion du 07/09 : Ted ne
      pouvait plus les cliquer, et rien n'echouait, parce qu'un bouton qu'on
      n'affiche pas ne se plaint jamais. C'est exactement le genre de perte qu'un
      banc de structure ne rattrape pas tout seul.

   Meme harnais que banc-registre.mjs et banc-cap.mjs, et meme piege : UN SEUL
   `eval`, parce que les globales du moteur sont declarees en `let` et `const`.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
const R = path.join(RACINE, 'src/js') + '/';
const dom = new JSDOM(`<!doctype html><body>
  <div class="filterbar" id="filterbar"></div>
  <section class="panel" id="p-clients"></section>
  <div id="status"></div><div id="statusTxt"></div><div id="statusSpin"></div>
  <div id="busyov"></div><div id="busytxt"></div>
</body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w = dom.window;
w.Chart = function(){ this.destroy=()=>{}; };
w.Papa = {};

const lignes = [];
/* DIX-NEUF MOIS, ET PAS VINGT-QUATRE : 2025 entier puis 2026 arrete en juillet, comme la
   vraie base de Ted. Avec vingt-quatre mois l'exercice courant est COMPLET, computeAtterrissage()
   repond « annee cloturee », et ni l'atterrissage ni l'ecart a l'objectif ne s'affichent. Une
   piece qui s'appelle « Mon cap » se controle sur un exercice en cours. */
for (let i=0;i<19;i++){
  const y = 2025+Math.floor(i/12), m = (i%12)+1;
  for (const [fam,canal,pu] of [['Rouge','Caveau',12],['Blanc','Export',9]]){
    lignes.push({famille:fam,couleur:fam,produit:'Cuvee '+fam,client:'Client '+(i%5),
      numClient:'C'+(i%5),numFacture:'F'+i+fam,codeTarif:'T1',millesime:String(y-1),
      appellation:'AOC Test',conditionnement:'75cl',cp:'44000',ville:'Nantes',pays:'France',
      _y:y,_m:m,_pu:pu,_q:50+i*3,_canal:canal});
  }
}

/* DES CLIENTS QUI DECROCHENT, sinon la piece n'a rien a montrer. Les cinq clients du
   dessus achetent tous les mois et en croissance : personne a rappeler, liste vide, et le
   banc a d'abord echoue sur ses quatre exports pour cette seule raison. Trois habitues de
   2025 qui ne reviennent pas en 2026 suffisent a peupler les trois analyses. */
for (const [nom, mois] of [['Domaine Dormant', 11], ['Cave Partie', 10], ['Bar Silencieux', 9]]) {
  for (let m = 1; m <= mois; m++) {
    lignes.push({famille:'Rouge',couleur:'Rouge',produit:'Cuvee Rouge',client:nom,
      numClient:nom,numFacture:'X'+nom+m,codeTarif:'T1',millesime:'2024',
      appellation:'AOC Test',conditionnement:'75cl',cp:'44000',ville:'Nantes',pays:'France',
      _y:2025,_m:m,_pu:14,_q:80,_canal:'Caveau'});
  }
}

const test = `
  ROWS.length = 0;
  JSON.parse(${JSON.stringify(JSON.stringify(lignes))}).forEach(function(o){
    var t = Date.UTC(o._y, o._m-1, 15);
    o._vin = true;
    o._date = {y:o._y, m:o._m, d:15, t:t};
    o._dayNum = Math.floor(t/86400000);
    o._exY = o._y; o._exM = o._m; o._exPos = o._m-1;
    o._qte = o._q; o._total = o._pu * o._q;
    ROWS.push(o);
  });
  computeMeta();
  renderClients();
  window.__SORTIE = { com: document.getElementById('p-clients').innerHTML };
`;

try {
  w.eval(fs.readFileSync(R+'bdv-base.js','utf8') + '\n' + fs.readFileSync(R+'bdv-ecrans.js','utf8') + '\n' + test);
} catch(e) {
  console.log('ECHEC a l\'execution : ' + e.message);
  console.log((e.stack||'').split('\n').slice(0,4).join('\n'));
  process.exit(1);
}

const h = w.__SORTIE.com;
let ko = 0;
const t = (nom, ok, det) => { if(!ok) ko++; console.log((ok?'  ok    : ':'  ECHEC : ')+nom+(ok||!det?'':'  -> '+det)); };

console.log('== Mon commerce : la piece ==');
t('le titre dit « Mon commerce »', h.includes('>Mon commerce<'));
t('un seul titre de panneau', (h.match(/panel__title/g)||[]).length === 1);

console.log('== etage 1 : le verdict, avant la liste ==');
t('le verdict de variation est la', h.includes('D\'où vient ta variation'));
t('les quatre mouvements de clientele aussi', h.includes('mouvement de clientèle'));
t('ils sont AU-DESSUS de la liste',
  h.indexOf('mouvement de clientèle') < h.indexOf('Qui rappeler'),
  'le verdict est passe sous la liste');
t('la piece ne renvoie plus vers une autre pour les lire',
  !h.includes('de <b>Mon'), 'la phrase de renvoi vers « Mon annee » est revenue');

console.log('== etage 3 : ce qui explique, replie ==');
t('le pied est replie', h.includes('Qui pèse quoi dans ton chiffre'));
/* On repere le tableau du pied par sa colonne « CA HT », et pas par « Client » : la
   grande liste du dessus a elle aussi une colonne Client, et le test passait alors sur
   la mauvaise occurrence. */
t('le top clients est DANS le pied',
  h.indexOf('CA HT</th>') > h.indexOf('Qui pèse quoi'), 'il est hors du repli');

console.log('== les quatre listes completes sont atteignables ==');
[['exportReactList','relance'],['exportDecroList','decrochage'],
 ['exportPremierList','premiers achats prioritaires'],['exportReste','premiers achats, le reste']]
  .forEach(([fn,quoi]) => t('l\'export « '+quoi+' » a un bouton', h.includes(fn+'()')));
t('et la piece dit en quoi ils different de l\'export de la liste',
  h.includes('Sortir tes listes complètes'));

console.log('\n== VERDICT ==\n  ' + (ko ? ko + ' echec(s)' : '12 controles passes, 0 en echec'));
process.exit(ko ? 1 : 0);
