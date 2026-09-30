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

/* LOT 45 : DES CLIENTS A SUIVRE, DANS DEUX MOTIFS. Trois habitues de 2025 qui ne
   reviennent pas (recul) et deux reguliers muets depuis avril 2026 (retard de cadence) :
   le signal de Mon cap doit compter ce que la carte de « Clients a suivre » montre, une
   fois retires ceux qui ont une affaire, et il en faut un dans chaque motif. */
for (const [nom, mois] of [['Domaine Dormant', 11], ['Cave Partie', 10], ['Bar Silencieux', 9]]) {
  for (let m = 1; m <= mois; m++) {
    lignes.push({famille:'Rouge',couleur:'Rouge',produit:'Cuvee Rouge',client:nom,
      numClient:nom,numFacture:'X'+nom+m,codeTarif:'T1',millesime:'2024',
      appellation:'AOC Test',conditionnement:'75cl',cp:'44000',ville:'Nantes',pays:'France',
      _y:2025,_m:m,_pu:14,_q:80,_canal:'Caveau'});
  }
}
for (const [nom, q] of [['Cave Rythmee', 60], ['Epicerie Reguliere', 40]]) {
  for (let k = 0; k < 11; k++) {
    const y = 2025 + Math.floor((5 + k) / 12), m = ((5 + k) % 12) + 1;
    lignes.push({famille:'Rouge',couleur:'Rouge',produit:'Cuvee Rouge',client:nom,
      numClient:nom,numFacture:'R'+nom+k,codeTarif:'T1',millesime:'2024',
      appellation:'AOC Test',conditionnement:'75cl',cp:'44000',ville:'Nantes',pays:'France',
      _y:y,_m:m,_pu:14,_q:q,_canal:'Caveau'});
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
  window.__ecran = function(id){ ECRAN_COURANT = id; };
  window.__demarre = function(){ ECRANS_DEMARRES = true; };
  window.__peint = function(id){ ECRANS_PEINTS.add(id); };
  window.__peints = function(){ return Array.from(ECRANS_PEINTS); };
  window.__cadre = function(){ return capCadre(); };
  window.__pont = function(){ return computeBridge(); };
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
/* LOT 45, PARTIE C : le verdict « d'ou vient ta variation » est la PREMIERE carte du repli. */
t('les quatre mouvements de clientele sont DANS #pied-cap',
  h.indexOf('mouvement de clientèle') > h.indexOf('id="pied-cap"') && h.includes('Clients perdus'), 'hors du repli');
t('et en premiere carte, avant la tendance et l\'effet prix/volume',
  h.indexOf('mouvement de clientèle') < h.indexOf('chTrend') && h.indexOf('mouvement de clientèle') < h.indexOf('Effet prix contre effet volume'));
t('pas de repli dans le repli, plus de « pied-variation »',
  !h.includes('pied-variation') && (h.slice(h.indexOf('id="pied-cap"')).match(/<details/g) || []).length === 0);
t('plus de « juste en dessous »', !h.includes('juste en dessous'));
t('la tendance corrigee est DANS le repli',
  h.indexOf('chTrend') > h.indexOf('id="pied-cap"'), 'elle est hors du repli');
t('l\'effet prix contre volume aussi',
  h.indexOf('Effet prix contre effet volume') > h.indexOf('id="pied-cap"'), 'il est hors du repli');

/* ---------------------------------------------------------------------------
   LOT 45, PARTIE C, 29/09/2026 : LE TITRE DU REPLI ET LE BANDEAU.
   Le titre ne porte un montant QUE s'il est celui du bandeau a l'euro (deux calculs :
   capCadre et computeBridge). Ce banc le prouve sur ce que la piece AFFICHE : le
   montant du titre = « ce que dit le bandeau cette annee » moins « le precedent au
   meme jour ». Et il prouve que le titre se tait des qu'ils different. Par mutation.
   --------------------------------------------------------------------------- */
console.log('== lot 45 : le titre du repli dit la variation du bandeau ==');
const euros = (x) => +String(x).replace(/[^\d]/g, '');
{
  const d = w.document;
  const sub = (d.querySelector('#p-diagnostic .hero__sub') || {}).textContent || '';
  const mb = /: ([\d\s\u202f\u00a0]+)€ .*? contre ([\d\s\u202f\u00a0]+)€/.exec(sub);
  const summ = (d.querySelector('#pied-cap > summary') || {}).textContent || '';
  const mt = /^Ce qui explique ta variation, (\d{4}) vs (\d{4}) à date égale : ([+\-−])([\d\s\u202f\u00a0]+)€$/.exec(summ.trim());
  t('le titre porte un montant (les deux calculs tombent d\'accord sur ce decor)', !!mt, summ);
  /* L'annee en cours d'abord, comme le bandeau (verificateur, 29/09/2026). */
  const hl = /(\d{4}) vs (\d{4})/.exec((d.querySelector('#p-diagnostic .hero__label') || {}).textContent || '');
  t('les annees du titre dans l\'ordre du bandeau (l\'annee en cours d\'abord)',
    !!mt && !!hl && mt[1] === hl[1] && mt[2] === hl[2] && +mt[1] > +mt[2], (mt && mt[1] + ' vs ' + mt[2]) + ' / ' + (hl && hl[0]));
  const bandeau = mb ? euros(mb[1]) - euros(mb[2]) : NaN;
  const titreE = mt ? (mt[3] === '+' ? 1 : -1) * euros(mt[4]) : NaN;
  t('ce montant = cette annee moins le precedent, lus dans le bandeau, a l\'euro', mb && mt && titreE === bandeau && bandeau !== 0, titreE + ' / ' + bandeau + ' (' + sub + ')');
  const f = w.__cadre(), br = w.__pont();
  t('et le signe dit le sens', mt && ((bandeau > 0 && mt[3] === '+') || (bandeau < 0 && mt[3] !== '+')));
  t('un pont qui differe d\'un euro du bandeau : le titre se tait sur le montant',
    w.titreVariation(Object.assign({}, br, { delta: br.delta + 1.2 }), f) === 'Ce qui explique ta variation');
  t('un pont sur d\'autres exercices : aussi',
    w.titreVariation(Object.assign({}, br, { prev: br.prev - 1 }), f) === 'Ce qui explique ta variation');
  t('pas de pont : titre sans montant', w.titreVariation(null, f) === 'Ce qui explique ta variation');
  /* L'action « danger », reecrite : elle nomme la piece, l'onglet et les filtres. */
  const dg = w.bridgeCorps({ cur: br.cur, prev: br.prev, nw: 0, up: 100, down: -500, lost: -2000, delta: -2400, movers: [] });
  t('l\'action « danger » renvoie vers Mon commerce, onglet « Clients à suivre », et ses deux filtres',
    dg.includes('ils sont dans <b>Mon commerce</b>, onglet « Clients à suivre », filtres « Recul confirmé » et « Retard de cadence ».') && !dg.includes('juste en dessous'));
}

console.log('== lot 45 : « Voir dans Mon cap » ==');
{
  const d = w.document;
  const defiles = [];
  const hauts = [];
  /* Le service defile par scrollTo({top, behavior}) vers #pied-cap, navTo remonte par scrollTo(0,0). */
  w.scrollTo = (x) => { if (typeof x === 'object') defiles.push('pied-cap'); else hauts.push('haut'); };
  const vu = [];
  /* Le lien passe par BdvNav.afficher, qui ne sert pas la demande lui-meme : c'est navTo
     (apres son retour en haut) ou le dessin de la piece qui la servent. */
  w.BdvNav = { afficher: (id) => vu.push(id), ventesEnVue: () => true };
  w.__ecran('annee');
  d.getElementById('pied-cap').open = false;
  w.voirVariation();
  t('le lien demande Mon cap', vu[vu.length - 1] === 'annee', vu.join());
  t('il ne defile pas tout seul avant que navTo passe', !defiles.length && d.getElementById('pied-cap').open === false, defiles.join());
  /* Mon cap pas encore peint : la demande attend le dessin. */
  w.__ecran('clients');
  w.voirVariation();
  w.renderCap();   // Mon cap se peint en coulisse, un autre ecran devant
  t('piece pas encore a l\'ecran : rien ne s\'ouvre ni ne defile en coulisse', d.getElementById('pied-cap').open === false && !defiles.length, defiles.join());
  w.__ecran('annee'); w.renderCap();
  t('la piece peinte, le repli s\'ouvre et on y defile', d.getElementById('pied-cap').open === true && defiles[0] === 'pied-cap', defiles.join());
  /* Le resume du serveur repeint la piece (et referme le repli) : la demande est resservie. */
  defiles.length = 0; w.renderCap();
  t('un repeint juste apres la ressert : repli ouvert, defilement redemande', d.getElementById('pied-cap').open === true && defiles[0] === 'pied-cap', defiles.join());
  /* Le vigneron agit : la demande tombe. */
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab' }));
  defiles.length = 0; w.renderCap();
  t('apres un geste du vigneron, le repeint ne le rouvre plus', d.getElementById('pied-cap').open === false && !defiles.length);
  /* Mon cap deja peint, mais l'ouverture passe par navTo() plus tard (le moteur est
     asynchrone) : c'est navTo, APRES son retour en haut, qui sert la demande. */
  w.__ecran('clients'); w.__peint('annee'); defiles.length = 0;
  hauts.length = 0;
  w.voirVariation();
  t('demande posee hors de Mon cap : rien encore', d.getElementById('pied-cap').open === false);
  w.navTo('annee');
  t('navTo(\'annee\') la sert apres le retour en haut', d.getElementById('pied-cap').open === true && hauts.length === 1 && defiles[0] === 'pied-cap', hauts.join() + ' / ' + defiles.join());
  /* Retour / Suivant : demarrerEcransVente transmet haut:'historique' a navTo, qui remonte
     encore une image plus tard (apres la restauration du navigateur). */
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab' }));   // aucune demande « Voir dans Mon cap » en cours
  w.__demarre(); w.__ecran('clients'); w.__peint('annee');
  const sorts = []; w.scrollTo = (x) => sorts.push(typeof x === 'object' ? 'instant:' + x.top : 'haut');
  w.demarrerEcransVente({ ecran: 'annee', haut: 'historique' });
  await new Promise(r => setTimeout(r, 60));
  t('demarrerEcransVente transmet l\'historique : remontee, puis une seconde apres la restauration',
    sorts.join(',') === 'haut,instant:0', sorts.join(','));
  delete w.BdvNav;
}

/* ---------------------------------------------------------------------------
   LOT 45, PARTIE B DANS MON CAP : le signal compte ce que la carte montre, clients en
   affaire retires, dans les deux motifs ; et Mon cap se repeint quand ils bougent.
   --------------------------------------------------------------------------- */
console.log('== lot 45 : les signaux de Mon cap et les clients en affaire ==');
{
  const d = w.document;
  let SET = new Set(['Cave Partie', 'Cave Rythmee']);
  w.BdvAffairesJour = { duClient: () => [], clientsEnAffaire: () => SET };
  w.__ecran('annee');
  w.renderClients(); w.renderCap();
  const carte = (lbl) => { const c = [...d.querySelectorAll('#p-clients .motif-card')].find(x => x.querySelector('.motif-card__l').textContent === lbl);
    return c ? { n: euros(c.querySelector('.motif-card__n').textContent), m: euros(c.querySelector('.motif-card__s').firstChild.textContent) } : null; };
  const cap = () => d.getElementById('p-diagnostic').textContent;
  const cr = carte('Recul confirmé'), cc = carte('Retard de cadence');
  const sr = /(\d+) clients? en décrochage : ([\d\s\u202f\u00a0]+)€/.exec(cap());
  const sc = /(\d+|Un) clients? n'(?:ont|a) pas recommandé[^.]*\. (?:Ensemble, ils t'ont|Il t'a) acheté ([\d\s\u202f\u00a0]+)€/.exec(cap());
  t('les deux motifs ont perdu leur client en affaire', !!cr && !!cc && cr.n === 2 && cc.n === 1, JSON.stringify([cr, cc]));
  t('signal « décrochage » = carte « Recul confirmé » (nombre et montant)', !!sr && +sr[1] === cr.n && euros(sr[2]) === cr.m, sr && sr[0]);
  t('signal « cadence » = carte « Retard de cadence » (nombre et montant)', !!sc && (sc[1] === 'Un' ? 1 : +sc[1]) === cc.n && euros(sc[2]) === cc.m, sc && sc[0]);
  /* Le retrait vient APRES les ecarts : un client en recul ET en retard de cadence, en
     affaire, ne doit pas ressortir dans la cadence (il n'y est pas, sur la carte). */
  SET = new Set(['Domaine Dormant', 'Cave Partie', 'Bar Silencieux', 'Cave Rythmee']);
  w.renderClients(); w.renderCap();
  const cc2 = carte('Retard de cadence');
  const sc2 = /(\d+|Un) clients? n'(?:ont|a) pas recommandé[^.]*\. (?:Ensemble, ils t'ont|Il t'a) acheté ([\d\s\u202f\u00a0]+)€/.exec(cap());
  t('tous les reculs en affaire : pas de signal de décrochage, et la cadence = sa carte',
    !/en décrochage/.test(cap()) && !!cc2 && !!sc2 && (sc2[1] === 'Un' ? 1 : +sc2[1]) === cc2.n && euros(sc2[2]) === cc2.m, (sc2 && sc2[0]) + ' / ' + JSON.stringify(cc2));
  SET = new Set(['Cave Partie', 'Cave Rythmee']);
  w.renderClients(); w.renderCap();
  t('les renvois des signaux ne changent pas', cap().includes('La liste est dans Mon commerce, filtre « Recul confirmé ».') && cap().includes('La liste est dans Mon commerce, filtre « Retard de cadence ».'));
  /* Les affaires bougent, Mon cap est a l'ecran : il se repeint. */
  w.BdvNav = { ventesEnVue: () => true };
  w.__peint('annee');
  SET = new Set(['Cave Rythmee']);
  d.dispatchEvent(new w.CustomEvent('bdv:taches'));
  const sr2 = /(\d+) clients? en décrochage/.exec(cap());
  t('bdv:taches, Mon cap a l\'ecran : repeint, le décrochage compte de nouveau 3', !!sr2 && +sr2[1] === 3, sr2 && sr2[0]);
  /* Mon cap cache : invalide, pas repeint. */
  w.__ecran('clients'); w.__peint('annee');
  const avant = cap();
  SET = new Set(['Cave Rythmee', 'Bar Silencieux']);
  d.dispatchEvent(new w.CustomEvent('bdv:taches'));
  t('Mon cap cache : pas repeint, mais invalide pour son prochain affichage', cap() === avant && !w.__peints().includes('annee'), w.__peints().join(','));
  delete w.BdvNav; delete w.BdvAffairesJour;
}

console.log('\n== VERDICT ==\n  ' + (ko ? ko + ' echec(s)' : 'tous les controles passes, 0 en echec'));
process.exit(ko ? 1 : 0);
