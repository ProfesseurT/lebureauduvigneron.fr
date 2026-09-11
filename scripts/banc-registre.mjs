/* ============================================================================
   BANC DE « MON REGISTRE », ecrit le 11/09/2026 au lot 3 de la redecoupe.

   CE QU'IL GARDE. Le registre a absorbe l'ecran « Evolution dans le temps » : sa
   courbe et sa lecture experte apparaissent quand on repartit par mois ou par
   annee, et disparaissent sinon. Rien dans le depot ne verifiait ce basculement,
   ni le texte des cellules.

   POURQUOI UN SEUL `eval`. Le moteur declare ses globales en `let` et `const` :
   dans un eval, elles restent scopees a CET eval. Charger bdv-base.js puis
   bdv-ecrans.js dans deux appels donne « ROWS is not defined ». Les deux fichiers
   et le scenario partent donc ensemble, en une seule chaine.

   IL A DEJA SERVI. Au premier passage, il a attrape une regression que personne
   ne voyait : les mois du tableau croise revenaient en « 2026-03 » au lieu de
   « mars 2026 », parce que l'ancien tableau d'Evolution passait par periodLabel()
   et pas celui du registre. D'ou libAxe() dans bdv-ecrans.js.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
const R = path.join(RACINE, 'src/js') + '/';
const dom = new JSDOM(`<!doctype html><body>
  <div class="filterbar" id="filterbar"></div>
  <section class="panel" id="p-chercher"><div id="p-explorer"></div></section>
  <div id="status"></div><div id="statusTxt"></div><div id="statusSpin"></div>
  <div id="busyov"></div><div id="busytxt"></div>
</body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w = dom.window;
w.Chart = function(){ this.destroy=()=>{}; };
w.Papa = {};

const lignes = [];
for (let i=0;i<24;i++){
  const y = 2025+Math.floor(i/12), m = (i%12)+1;
  for (const [fam,canal,pu] of [['Rouge','Caveau',12],['Blanc','Export',9]]){
    lignes.push({famille:fam,couleur:fam,produit:'Cuvee '+fam,client:'Client '+(i%5),
      numClient:'C'+(i%5),numFacture:'F'+i+fam,codeTarif:'T1',millesime:String(y-1),
      appellation:'AOC Test',conditionnement:'75cl',cp:'44000',ville:'Nantes',pays:'France',
      _y:y,_m:m,_pu:pu,_q:50+i*3,_canal:canal});
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
  var SORTIE = {};
  exploAxis1='_mois'; exploAxis2='famille'; exploEx=null; exploFrom=null; exploTo=null;
  renderExplo();
  SORTIE.temps = document.getElementById('p-explorer').innerHTML;
  exploAxis1='famille'; exploAxis2='';
  renderExplo();
  SORTIE.hors = document.getElementById('p-explorer').innerHTML;
  window.__SORTIE = SORTIE;
`;

try {
  w.eval(fs.readFileSync(R+'bdv-base.js','utf8') + '\n' + fs.readFileSync(R+'bdv-ecrans.js','utf8') + '\n' + test);
} catch(e) {
  console.log('ECHEC a l\'execution : ' + e.message);
  console.log((e.stack||'').split('\n').slice(0,4).join('\n'));
  process.exit(1);
}

const S = w.__SORTIE, h1 = S.temps, h2 = S.hors;
let ko = 0;
const t = (nom, ok, det) => { if(!ok) ko++; console.log((ok?'  ok    : ':'  ECHEC : ')+nom+(ok||!det?'':'  -> '+det)); };
console.log('== Mon registre, axe de temps ==');
t('le titre dit « Mon registre »', h1.includes('Mon registre'));
t('la courbe est posee', h1.includes('id="chEvo"'));
t('le verdict de tendance est visible, hors du repli',
  h1.indexOf('Tendance de fond') > -1 && h1.indexOf('Tendance de fond') < h1.indexOf('La lecture experte'));
t('la saisonnalite est calculee (24 mois)', h1.includes('Saisonnalit'));
t('la concentration aussi (deux segments)', h1.includes('Concentration'));
t('la lecture experte est repliee', h1.includes('La lecture experte, en d'));
t('les vues rapides sont la', h1.includes('Vues rapides'));
t('le tableau croise est la', h1.includes('class="heat"'));
t('les periodes sont ecrites en clair', h1.includes('mars 2026') || h1.includes('janvier 2026'));
console.log('== Mon registre, axe hors temps ==');
t('pas de courbe', !h2.includes('id="chEvo"'));
t('pas de lecture experte', !h2.includes('La lecture experte'));
t('mais le resultat est bien la', h2.includes('class="rep"'));
t('et les vues rapides restent', h2.includes('Vues rapides'));
console.log('\n== VERDICT ==\n  ' + (ko ? ko + ' echec(s)' : '13 controles passes, 0 en echec'));
process.exit(ko ? 1 : 0);
