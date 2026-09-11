/* ============================================================================
   BANC DE « MON CAP », ecrit le 11/09/2026 au lot 4 de la redecoupe.

   CE QU'IL GARDE. renderCap() a remplace renderDiagnostic() ET renderApercu(), qui
   etaient deux panneaux empiles dans la meme piece. Le controle central est
   celui du DOUBLON : le chiffre d'evolution ne doit etre ecrit qu'une fois, dans
   le bandeau, et plus aussi dans la grille de compteurs. C'est ce doublon-la qui
   a ouvert toute la redecoupe, et rien dans le depot ne l'aurait vu revenir.

   Il verifie aussi que le champ de saisie de l'objectif n'est PAS revenu : il
   existe deja dans « Mes reglages », onglet « Tes ventes ». Deux champs pour une
   valeur, c'est deux montants differents un jour ou l'autre.

   Meme harnais que scripts/banc-registre.mjs, et meme piege : UN SEUL `eval`,
   parce que les globales du moteur sont declarees en `let` et `const`.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
const R = path.join(RACINE, 'src/js') + '/';
const dom = new JSDOM(`<!doctype html><body>
  <div class="filterbar" id="filterbar"></div>
  <section class="panel" id="p-annee"><div id="p-diagnostic"></div></section>
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
  objectif = 400000;
  renderCap();
  window.__SORTIE = { cap: document.getElementById('p-diagnostic').innerHTML };
`;

try {
  w.eval(fs.readFileSync(R+'bdv-base.js','utf8') + '\n' + fs.readFileSync(R+'bdv-ecrans.js','utf8') + '\n' + test);
} catch(e) {
  console.log('ECHEC a l\'execution : ' + e.message);
  console.log((e.stack||'').split('\n').slice(0,4).join('\n'));
  process.exit(1);
}

const h = w.__SORTIE.cap;
let ko = 0;
const t = (nom, ok, det) => { if(!ok) ko++; console.log((ok?'  ok    : ':'  ECHEC : ')+nom+(ok||!det?'':'  -> '+det)); };
const compte = (m) => (h.match(new RegExp(m,'g'))||[]).length;

console.log('== Mon cap : la piece ==');
t('le titre dit « Mon cap »', h.includes('>Mon cap<'));
t('un seul titre de panneau', compte('panel__title') === 1, compte('panel__title')+' trouves');
t('le bandeau de comparaison est la', h.includes('class="hero"'));

console.log('== le doublon qui a ouvert la redecoupe ==');
t('l\'evolution n\'est ecrite QUE dans le bandeau',
  !h.includes('Évolution vs'), 'un compteur « Évolution vs » est revenu dans la grille');
t('et le bandeau la porte bien', h.includes('Où en est ton'));

console.log('== les deux grilles, et leur difference ==');
t('« Ou en es-tu » porte les chiffres d\'exercice', h.includes('Où en es-tu'));
t('« Sur la periode affichee » porte ceux de la selection', h.includes('Sur la période affichée'));
t('l\'atterrissage est dans la premiere', h.includes('Atterrissage estim'));
t('l\'ecart a l\'objectif aussi', h.includes('Écart vs objectif'));

console.log('== l\'objectif ne se saisit plus ici ==');
t('aucun champ de saisie dans la piece', !h.includes('<input'), 'un <input> est revenu');
t('mais la piece dit ou le regler', h.includes('Mes réglages'));

console.log('== les trois etages ==');
t('ce qui presse est visible', h.includes('À regarder en priorité'));
t('la courbe des mois est visible', h.includes('id="chApMonth"'));
t('ce qui explique est replie', h.includes('id="pied-cap"') && h.includes('Ce qui explique ta variation'));
t('la tendance corrigee est DANS le repli',
  h.indexOf('chTrend') > h.indexOf('id="pied-cap"'), 'elle est hors du repli');
t('l\'effet prix contre volume aussi',
  h.indexOf('Effet prix contre effet volume') > h.indexOf('id="pied-cap"'), 'il est hors du repli');

console.log('\n== VERDICT ==\n  ' + (ko ? ko + ' echec(s)' : '16 controles passes, 0 en echec'));
process.exit(ko ? 1 : 0);
