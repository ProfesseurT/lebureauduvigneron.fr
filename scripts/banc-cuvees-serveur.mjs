/* ============================================================================
   scripts/banc-cuvees-serveur.mjs : la fiche d'une cuvee dit la meme chose,
   que ses chiffres viennent du serveur ou de l'appareil. LOT 32, 24/09/2026.

     npm run banc:cuvees-serveur

   POURQUOI IL EXISTE. Depuis le lot 26, la fiche d'une cuvee servie par le
   serveur affichait le titre « Conditionnements » et RIEN dessous :
   `agentProduits()` ecrivait `cond: {}` en dur, parce que `cuvees_resume()` ne
   rendait que le conditionnement DOMINANT. `npm run controle:cuvees` ne pouvait
   pas le voir : il compare les champs que le serveur rend, et un champ qu'il ne
   rend pas ne diverge jamais.

   CE QU'IL GARDE :
   1. la fiche servie par le serveur peint EXACTEMENT le meme bloc de
      conditionnements que la fiche calculee sur l'appareil ;
   2. un resume sans `conds` (range en cache avant le lot 32, ou SQL pas colle)
      CACHE le bloc au lieu de peindre un titre sur du vide ;
   3. plus aucun objet vide ecrit en dur a la place du champ.

   Meme montage que banc-cap-serveur.mjs : un seul `eval` pour bdv-base.js,
   bdv-ecrans.js et le scenario, sinon les `let` du moteur restent scopes a leur
   eval et le scenario ne les voit pas.
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

const dom = new JSDOM(`<!doctype html><body>
  <div class="filterbar" id="filterbar"></div>
  <div id="modale"></div>
  <div id="status"></div><div id="statusTxt"></div><div id="statusSpin"></div>
  <div id="busyov"></div><div id="busytxt"></div>
</body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w = dom.window;
w.Chart = function(){ this.destroy = () => {}; };
w.Papa = {};

/* Une cuvee en DEUX conditionnements, dans des volumes differents, et une en un
   seul. Une seule cuvee en un seul conditionnement ne distinguerait pas un bloc
   juste d'un bloc qui ne peint que le dominant. */
const lignes = [];
for (let i = 0; i < 14; i++) {
  const y = 2025 + Math.floor(i / 12), m = (i % 12) + 1;
  lignes.push({ produit: 'Le Miracle 2024', cond: 'Bouteille 0.75 L', q: 60 + i, pu: 20, y, m, i });
  if (i % 3 === 0) lignes.push({ produit: 'Le Miracle 2024', cond: 'Magnum 1.5 L', q: 6, pu: 45, y, m, i });
  lignes.push({ produit: 'Le Rose 2025', cond: 'Bouteille 0.75 L', q: 40, pu: 12, y, m, i });
}

const test = `
  ROWS.length = 0;
  JSON.parse(${JSON.stringify(JSON.stringify(lignes))}).forEach(function(o){
    var ts = Date.UTC(o.y, o.m - 1, 15);
    ROWS.push({ famille: 'Rouge', couleur: 'Rouge', produit: o.produit, client: 'Client ' + (o.i % 4),
      numClient: 'C' + (o.i % 4), numFacture: 'F' + o.i + o.produit + o.cond, codeTarif: 'T1',
      millesime: o.produit.slice(-4), appellation: 'AOC Test', conditionnement: o.cond,
      cp: '44000', ville: 'Nantes', pays: 'France',
      _vin: true, _date: { y: o.y, m: o.m, d: 15, t: ts }, _dayNum: Math.floor(ts / 86400000),
      _exY: o.y, _exM: o.m, _exPos: o.m - 1, _qte: o.q, _total: o.pu * o.q });
  });
  computeMeta();

  function blocCond(){
    var h = document.getElementById('modale').innerHTML;
    var i = h.indexOf('Conditionnements</div>');
    if (i < 0) return null;
    var j = h.indexOf('Qui l', i);
    return h.slice(i, j);
  }
  function ouvrir(nom){ document.getElementById('modale').innerHTML = ''; ouvrirProduit(nom); return blocCond(); }

  /* ---- 1. LE LOCAL ---- */
  cuvPoser(null);
  var A = agentProduits();
  var localMiracle = ouvrir('Le Miracle'), localRose = ouvrir('Le Rose');

  /* ---- 2. LA MEME VERITE, dans la forme que cuvees_resume() rend depuis le lot 32 ---- */
  function charge(avecConds){
    return { ok: true, caTotal: A.caTotal, nbMillesimes: A.nbMillesimes,
      repRachat: A.repRachat, repClients: A.repClients,
      exerciceCur: A.f ? A.f.cur : null, coupePos: A.f ? A.f.cutPos : null,
      liste: A.liste.map(function(c){
        var o = { nom: c.nom, ca: c.ca, btl: c.btl, clients: c.clients, part: c.part,
          cur: c.cur, prev: c.prev, delta: c.delta, top1: c.top1, nomTop: c.nomTop,
          rachat: c.rachat, prixMed: c.prixMed, prixBas: c.prixBas, prixHaut: c.prixHaut,
          nPrix: c.nPrix, condDom: c.condDom,
          millesimes: Object.keys(c.millesimes).map(function(m){
            var x = c.millesimes[m]; return { m: m, ca: x.ca, btl: x.btl, cur: x.cur, dernier: x.dernier }; }),
          parMois: c.parMois };
        /* PostgREST rend les numeriques de jsonb en CHAINES : on le reproduit. */
        if (avecConds) o.conds = Object.keys(c.cond).map(function(k){ return { c: k, btl: String(c.cond[k]) }; });
        return o;
      }) };
  }
  cuvPoser(charge(true));
  var srvMiracle = ouvrir('Le Miracle'), srvRose = ouvrir('Le Rose'), srvServi = agentProduits().serveur;

  /* ---- 3. UN RESUME D'AVANT LE LOT 32, sans le champ ---- */
  cuvPoser(charge(false));
  var ancienMiracle = ouvrir('Le Miracle'), ancienServi = agentProduits().serveur;
  var ancienHtml = document.getElementById('modale').innerHTML;
  cuvPoser(null);

  window.__S = { localMiracle: localMiracle, localRose: localRose, srvMiracle: srvMiracle,
    srvRose: srvRose, srvServi: srvServi, ancienMiracle: ancienMiracle,
    ancienServi: ancienServi, ancienHtml: ancienHtml };
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
const lignesDe = h => (h || '').split('rep__row').length - 1;

console.log('\n== 0. LE PLANCHER : on ne compare pas deux riens ==');
t('la fiche locale de Le Miracle peint deux conditionnements', lignesDe(S.localMiracle) === 2,
  lignesDe(S.localMiracle) + ' ligne(s)');
t('et elle nomme le magnum', /Magnum 1\.5 L/.test(S.localMiracle || ''));

console.log('\n== 1. LE SERVEUR PEINT LE MEME BLOC QUE L\'APPAREIL ==');
t('le resume est bien lu comme venant du serveur', S.srvServi === true);
t('Le Miracle : meme bloc, caractere pour caractere', S.srvMiracle === S.localMiracle,
  (S.srvMiracle || 'absent').slice(0, 160));
t('Le Rose : meme bloc, caractere pour caractere', S.srvRose === S.localRose,
  (S.srvRose || 'absent').slice(0, 160));

console.log('\n== 2. UN RESUME SANS LE CHAMP CACHE LE BLOC ==');
t('le resume d\'avant le lot 32 est toujours servi', S.ancienServi === true);
t('et la fiche ne porte plus le titre « Conditionnements » sur du vide',
  S.ancienMiracle === null && !/Conditionnements/.test(S.ancienHtml));
t('le reste de la fiche est toujours la', /Ses millésimes/.test(S.ancienHtml));

console.log('\n== 3. PLUS D\'OBJET VIDE ECRIT EN DUR ==');
const ecrans = fs.readFileSync(R + 'bdv-ecrans.js', 'utf8');
t('agentProduits ne pose plus « cond: {} » a la place du champ serveur',
  !/cond:\s*\{\}\s*,\s*achats/.test(ecrans));
const sql = fs.readFileSync(path.join(RACINE, 'supabase/lot32-cuvees-conditionnements.sql'), 'utf8');
t('le lot 32 rend bien le champ « conds »', /'conds',\s*conds/.test(sql));
t('et il efface le cache calcule sans lui', /delete from public\.resumes where cle = 'cuvees'/.test(sql));

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DES CUVEES SERVEUR REFUSE\n'); process.exit(1); }
console.log('  LA MEME FICHE, QUE LE CHIFFRE VIENNE DU SERVEUR OU DE L\'APPAREIL\n');
process.exit(0);
