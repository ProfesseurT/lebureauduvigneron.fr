/* ============================================================================
   scripts/temoin-commerce.mjs : ce que le VRAI moteur repond sur la base d'essai

     npm run temoin:commerce

   Il ne verifie rien. Il fait tourner `bdv-ecrans.js` tel quel sur la fixture
   des cas limites et ecrit sa reponse dans `scripts/fixtures/commerce-temoin.json`.
   Ce fichier est LA REFERENCE : le portage SQL doit rendre exactement ces
   nombres, et le banc compare les deux.

   POURQUOI LE VRAI MOTEUR ET PAS UNE REECRITURE. Une reference recalculee a la
   main ne prouve que mon accord avec moi-meme. Ici c'est le code qui tourne
   chez Ted qui repond, avec ses seuils, ses arrondis et ses cas particuliers.
   Si je me suis trompe en LISANT le JavaScript, la reference se trompe avec
   moi et le banc passe : c'est la limite de ce filet, et c'est pour ca que le
   second, sur la vraie base, existe aussi.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIGNES, REF, dateDe } from './fixtures/commerce-cas-limites.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
const R = path.join(RACINE, 'src/js') + '/';

const dom = new JSDOM(`<!doctype html><body>
  <div class="filterbar" id="filterbar"></div>
  <section class="panel" id="p-annee"><div id="p-diagnostic"></div></section>
  <div id="p-clients"></div>
  <div id="status"></div><div id="statusTxt"></div><div id="statusSpin"></div>
  <div id="busyov"></div><div id="busytxt"></div>
</body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w = dom.window;
w.Chart = function(){ this.destroy = () => {}; };
w.Papa = {};

/* Les lignes sont posees DEJA DERIVEES, exactement comme banc-cap.mjs. On ne
   teste pas ici la lecture d'un export : on teste les agents, et ils partent
   des champs derives. Le cote SQL recevra les memes valeurs, ce qui est tout
   l'interet : la fixture est le terrain commun, pas un point de depart que
   chacun interprete. */
const test = `
  ROWS.length = 0;
  JSON.parse(${JSON.stringify(JSON.stringify(LIGNES))}).forEach(function(o){
    var r = {
      client: o.nom, numClient: o.id, numFacture: o.facture,
      produit: o.produit, famille: 'Vin', couleur: 'Rouge', millesime: o.millesime,
      appellation: 'AOC Témoin', conditionnement: o.conditionnement, codeTarif: 'T1',
      ville: o.ville, cp: '44000', pays: 'France', origine: '', commercial: '', vendeur: '',
      _vin: !o.horsVente, _horsVin: !!o.horsVente, _offert: false,
      _canal: 'Caveau', _typeClient: o.typeClient,
      _dayNum: o.jour, _date: { y: 0, m: 0, d: 0, t: 0 },
      _exY: o.exY, _exM: o.exM, _exPos: o.exPos,
      _qte: o.qte, _total: o.total
    };
    var dt = new Date(o.jour * 86400000);
    r._date = { y: dt.getUTCFullYear(), m: dt.getUTCMonth()+1, d: dt.getUTCDate(), t: o.jour*86400000 };
    ROWS.push(r);
  });
  computeMeta();
  PROFIL = profilBase();

  function clientsDe(l){ return l.map(function(c){
    return { id: c.id, montant: Math.round(c.montant * 100) / 100 }; }); }

  var prod = agentProduits();
  var br = computeBridge();
  var cad = agentCadence();
  var dec = agentDecrochage();
  var pre = agentPremierAchat();

  window.__T = {
    profil: {
      nClients: PROFIL.nClients, nFactures: PROFIL.nFactures, nLignes: PROFIL.nLignes,
      intervalleMedianBase: PROFIL.intervalleMedianBase, refDay: PROFIL.refDay
    },
    bridge: br && { cur: br.cur, prev: br.prev,
      nw: Math.round(br.nw*100)/100, up: Math.round(br.up*100)/100,
      down: Math.round(br.down*100)/100, lost: Math.round(br.lost*100)/100,
      delta: Math.round(br.delta*100)/100,
      movers: br.movers.map(function(m){ return [m[0], Math.round(m[1]*100)/100]; }) },
    cadence: cad.ok && {
      refDay: cad.refDay,
      clients: cad.clients.map(function(c){ return {
        id: c.id, n: c.n, montant: Math.round(c.montant*100)/100,
        panier: Math.round(c.panier*10000)/10000,
        last: c.last, silence: c.silence,
        cadence: c.cadence, cadRef: c.cadRef,
        cv: c.cv == null ? null : Math.round(c.cv*1000000)/1000000,
        cls: c.cls, fiable: c.fiable, annuel: c.annuel, moisHab: c.moisHab,
        enRetard: c.enRetard, ampleur: Math.round(c.ampleur*1000000)/1000000,
        prochaine: c.prochaine, conf: c.conf }; }).sort(function(a,b){ return a.id<b.id?-1:1; }),
      enRetard: cad.enRetard.map(function(c){ return c.id; })
    },
    decrochage: {
      cur: dec.f && dec.f.cur, prev: dec.f && dec.f.prev, cutPos: dec.f && dec.f.cutPos,
      totPerdu: Math.round(dec.totPerdu*100)/100,
      ecartes: dec.ecartes, caEcarte: Math.round(dec.caEcarte*100)/100,
      decroche: dec.decroche.map(function(c){ return {
        id: c.id, cur: Math.round(c.cur*100)/100, prev: Math.round(c.prev*100)/100,
        perdu: Math.round(c.perdu*100)/100, pct: Math.round(c.pct*1000000)/1000000,
        cv: c.cv == null ? null : Math.round(c.cv*1000000)/1000000,
        seuil: Math.round(c.seuil*1000000)/1000000 }; })
    },
    produits: prod.ok ? {
      ok: true, caTotal: Math.round(prod.caTotal*100)/100,
      nbMillesimes: prod.nbMillesimes,
      repRachat: Math.round(prod.repRachat*1000000)/1000000,
      repClients: prod.repClients,
      liste: prod.liste.map(function(c){ return {
        nom: c.nom, ca: Math.round(c.ca*100)/100, btl: Math.round(c.btl*1000)/1000,
        clients: c.clients, part: Math.round(c.part*1000000)/1000000,
        cur: Math.round(c.cur*100)/100, prev: Math.round(c.prev*100)/100,
        delta: c.delta == null ? null : Math.round(c.delta*100)/100,
        top1: Math.round(c.top1*1000000)/1000000, nomTop: c.nomTop,
        rachat: Math.round(c.rachat*1000000)/1000000,
        prixMed: Math.round(c.prixMed*1000000)/1000000,
        prixBas: Math.round(c.prixBas*1000000)/1000000,
        prixHaut: Math.round(c.prixHaut*1000000)/1000000,
        nPrix: c.nPrix, condDom: c.condDom,
        millesimes: Object.keys(c.millesimes).sort().map(function(m){ return {
          m: m, ca: Math.round(c.millesimes[m].ca*100)/100,
          btl: Math.round(c.millesimes[m].btl*1000)/1000,
          cur: Math.round(c.millesimes[m].cur*100)/100,
          dernier: c.millesimes[m].dernier }; }),
        parMois: c.parMois.map(function(v){ return Math.round(v*100)/100; })
      }; }).sort(function(a,b){ return a.nom<b.nom?-1:1; })
    } : { ok: false },
    premier: pre.ok ? {
      ok: true, ref: pre.ref, observables: pre.observables,
      global: Math.round(pre.global*1000000)/1000000,
      bornes: pre.bornes, coupe: pre.coupe,
      total: Math.round(pre.total*100)/100,
      liste: pre.liste.map(function(c){ return {
        id: c.id, montant: Math.round(c.montant*100)/100, jour: c.jour, age: c.age,
        classe: c.classe, type: c.type,
        chance: Math.round(c.chance*1000000)/1000000,
        esperance: Math.round(c.esperance*1000000)/1000000 }; }),
      parClasse: pre.parClasse, parType: pre.parType
    } : { ok: false, raison: pre.raison, observables: pre.observables || null }
  };
`;

try {
  w.eval(fs.readFileSync(R + 'bdv-base.js', 'utf8') + '\n'
       + fs.readFileSync(R + 'bdv-ecrans.js', 'utf8') + '\n' + test);
} catch (e) {
  console.log('ECHEC a l\'execution : ' + e.message);
  console.log((e.stack || '').split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}

const T = w.__T;
T._base = { lignes: LIGNES.length, ref: REF, refDate: dateDe(REF) };
const sortie = path.join(RACINE, 'scripts/fixtures/commerce-temoin.json');
fs.writeFileSync(sortie, JSON.stringify(T, null, 1) + '\n');

console.log('\n== Le moteur a repondu sur la base d\'essai ==');
console.log('  lignes                ' + LIGNES.length);
console.log('  clients profiles      ' + T.profil.nClients);
console.log('  intervalle median     ' + T.profil.intervalleMedianBase + ' jours');
console.log('  bridge                ' + (T.bridge ? T.bridge.prev + ' vs ' + T.bridge.cur : 'indisponible'));
if (T.bridge) console.log('    nouveaux ' + T.bridge.nw + '  hausse ' + T.bridge.up
  + '  baisse ' + T.bridge.down + '  perdus ' + T.bridge.lost + '  total ' + T.bridge.delta);
console.log('  cadence               ' + (T.cadence ? T.cadence.clients.length + ' clients, '
  + T.cadence.enRetard.length + ' en retard' : 'indisponible'));
console.log('  decrochage            ' + T.decrochage.decroche.length + ' retenus, '
  + T.decrochage.ecartes + ' ecartes, ' + T.decrochage.totPerdu + ' perdus');
console.log('  cuvees                ' + (T.produits.ok
  ? T.produits.liste.length + ' cuvees, CA total ' + T.produits.caTotal
    + ', reperes rachat ' + T.produits.repRachat + ' / clients ' + T.produits.repClients
  : 'REFUSE'));
console.log('  premier achat         ' + (T.premier.ok
  ? T.premier.liste.length + ' clients, ' + T.premier.observables + ' observables, bornes '
    + JSON.stringify(T.premier.bornes)
  : 'REFUSE : ' + T.premier.raison + ' (' + T.premier.observables + ' observables)'));
console.log('\n  temoin ecrit : scripts/fixtures/commerce-temoin.json\n');

/* SORTIE EXPLICITE. Charger `bdv-ecrans.js` declenche son propre demarrage, qui
   finit par appeler IndexedDB : absent de jsdom, donc une promesse rejetee qui
   remonte APRES que tout le travail utile est fait, et qui ferait echouer un
   script deja reussi. Ce n'est pas un defaut du moteur, c'est un module qui se
   comporte comme sur une page. On sort avant. */
process.exit(0);
