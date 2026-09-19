/* ============================================================================
   scripts/banc-commerce-serveur.mjs : « Mon commerce » dit-il LA MEME CHOSE
   selon qui a calcule ?

     npm run banc:commerce-serveur

   MEME PRINCIPE QUE banc-cap-serveur.mjs, et meme limite. Il peint l'ecran deux
   fois sur la base des cas limites : une fois en local, une fois avec la MEME
   verite mise en forme comme `commerce_resume()` la rend, et il exige le meme
   HTML au caractere pres.

   CE QU'IL PROUVE : que la TRADUCTION est fidele. Un champ mal nomme, un nombre
   rendu en chaine par jsonb et jamais reconverti, un `bas` et un `haut`
   inverses, une liste triee dans l'autre sens : tout cela se voit ici.

   CE QU'IL NE PROUVE PAS : que le SQL calcule les memes nombres. Ca, c'est le
   travail de `npm run controle:commerce`, qui compare le temoin du vrai moteur
   au retour du serveur sur le bureau d'essai, client par client. Un banc en
   jsdom n'a pas de Postgres, et pretendre le contraire serait la meme faute de
   methode que le 344 ms du lot 22.

   LE PIEGE DU HARNAIS, deja paye : UN SEUL `eval`.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIGNES } from './fixtures/commerce-cas-limites.mjs';

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
  <section class="panel" id="p-annee"><div id="p-diagnostic"></div></section>
  <div id="p-clients"></div>
  <div id="status"></div><div id="statusTxt"></div><div id="statusSpin"></div>
  <div id="busyov"></div><div id="busytxt"></div>
</body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w = dom.window;
w.Chart = function(){ this.destroy = () => {}; };
w.Papa = {};

const test = `
  ROWS.length = 0;
  JSON.parse(${JSON.stringify(JSON.stringify(LIGNES))}).forEach(function(o){
    var dt = new Date(o.jour * 86400000);
    ROWS.push({
      client: o.nom, numClient: o.id, numFacture: o.facture,
      produit: o.produit, famille: 'Vin', couleur: 'Rouge', millesime: o.millesime,
      appellation: 'AOC Témoin', conditionnement: '75cl', codeTarif: 'T1',
      ville: o.ville, cp: '44000', pays: 'France', origine: '', commercial: '', vendeur: '',
      _vin: !o.horsVente, _horsVin: !!o.horsVente, _offert: false,
      _canal: 'Caveau', _typeClient: o.typeClient,
      _dayNum: o.jour,
      _date: { y: dt.getUTCFullYear(), m: dt.getUTCMonth()+1, d: dt.getUTCDate(), t: o.jour*86400000 },
      _exY: o.exY, _exM: o.exM, _exPos: o.exPos, _qte: o.qte, _total: o.total });
  });
  computeMeta();
  PROFIL = profilBase();

  /* ---- 1. LE LOCAL, seul ---- */
  comPoser(null);
  renderClients();
  var htmlLocal = document.getElementById('p-clients').innerHTML;
  var brLocal = computeBridge(), cadLocal = agentCadence(), decLocal = agentDecrochage();

  /* ---- 2. LA MEME VERITE, mise en forme comme jsonb la rend ----
     LES NOMBRES PARTENT EN CHAINES, et c'est le point. PostgREST rend les numeriques
     de jsonb en chaines de caracteres : un champ oublie par comNb() donnerait une
     concatenation la ou on attend une addition, et « 1200 » + « 800 » ferait
     « 1200800 » sans que rien ne leve. Le banc ne verrait pas ce defaut si la fixture
     donnait des nombres deja propres. */
  var S = function(v){ return v == null ? null : String(v); };
  var charge = {
    refJour: cadLocal.refDay, refJourTout: cadLocal.refDay,
    intervalleMedianBase: S(PROFIL.intervalleMedianBase),
    exerciceCur: brLocal.cur, exercicePrev: brLocal.prev, coupePos: decLocal.f.cutPos,
    bridge: { nw: S(brLocal.nw), up: S(brLocal.up), down: S(brLocal.down),
              lost: S(brLocal.lost), delta: S(brLocal.delta) },
    movers: brLocal.movers.map(function(m){ return [m[0], S(m[1])]; }),
    cadence: cadLocal.clients.slice().sort(function(a,b){ return a.id<b.id?-1:1; })
      .map(function(c){ return {
        id: c.id, nom: c.nom, n: c.n, montant: S(c.montant), panier: S(c.panier),
        last: c.last, silence: c.silence, cadence: S(c.cadence), cadRef: S(c.cadRef),
        cv: S(c.cv), cls: c.cls, fiable: c.fiable, annuel: c.annuel, moisHab: c.moisHab,
        enRetard: c.enRetard, ampleur: S(c.ampleur), prochaine: S(c.prochaine),
        conf: c.conf }; }),
    decroche: decLocal.decroche.map(function(c){ return {
        id: c.id, nom: c.nom, cur: S(c.cur), prev: S(c.prev), perdu: S(c.perdu),
        pct: S(c.pct), cv: S(c.cv), seuil: S(c.seuil) }; }),
    totPerdu: S(decLocal.totPerdu), ecartes: decLocal.ecartes, caEcarte: S(decLocal.caEcarte)
  };
  comPoser(charge);
  renderClients();
  var htmlServeur = document.getElementById('p-clients').innerHTML;
  var brServeur = computeBridge(), cadServeur = agentCadence(), decServeur = agentDecrochage();

  /* ---- 3. Un serveur muet doit rendre la main au local ---- */
  comPoser(undefined); var muet = computeBridge();
  comPoser({});       var vide = computeBridge();
  comPoser(null);

  window.__S = {
    /* LE PLANCHER SE MESURE DANS LA PAGE, PAS DANS LE HARNAIS, 19/09/2026 : le
       nombre de lignes que le MOTEUR a retenues, pas celui qu'on croit avoir
       pousse. Une ligne ecartee par computeMeta() ne se verrait pas autrement.
       PAS D'ACCENT GRAVE DANS CE BLOC : il vit dans un gabarit de chaine. */
    lignes: ROWS.length,
    htmlLocal: htmlLocal, htmlServeur: htmlServeur,
    brLocal: brLocal, brServeur: brServeur,
    cadLocal: cadLocal, cadServeur: cadServeur,
    decLocal: decLocal, decServeur: decServeur,
    muetLocal: muet && muet.serveur === false,
    videLocal: vide && vide.serveur === false,
    aRafraichir: typeof window.bdvCommerceRafraichir === 'function'
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

/* ==========================================================================
   0. LE PLANCHER : ON NE COMPARE PAS DEUX LISTES VIDES
   ==========================================================================
   Pose le 19/09/2026. Tout ce qui suit compare le calcul local au calcul
   serveur, et TOUT PASSE SUR RIEN. « meme nombre de clients : 0 / 0 » est vrai.
   « les quinze champs de chaque client sont identiques » est vrai sur zero
   client : la boucle `for (const id in A)` ne tourne pas une fois, `mauvais`
   reste vide, et le controle le plus cher du banc se declare passe sans avoir
   compare un seul nombre. Meme chose pour l'ordre des mouvements et pour la
   liste des decroches, qui s'appuient sur `every()` : vrai sur un tableau vide.

   Trois facons ordinaires d'arriver la, et aucune ne casse quoi que ce soit : un
   `computeMeta()` qui ecarte les lignes du decor, un seuil de cadence rendu plus
   severe, un champ de la fixture renomme. Le banc annonce alors trente-six
   controles passes sur un ecran qu'il n'a pas regarde.

   Les autres bancs du depot posent deja ce plancher : `banc-app` exige au moins
   deux icones, `banc-outils` au moins deux cartes, `banc-annuel` au moins une
   ligne `unique`. Celui-ci ne l'avait pas. Les nombres attendus ci-dessous sont
   ceux du decor du haut de ce fichier : s'il change, ils changent avec lui, et
   c'est justement le moment ou quelqu'un doit les relire.
   ========================================================================== */
console.log('\n== 0. Le plancher : il y a bien quelque chose a comparer ==');
t('la base du decor a ete relue par le moteur', S.lignes > 0, S.lignes + ' ligne(s) dans ROWS');
t('le panneau « Mon commerce » a vraiment ete peint, des deux cotes',
  S.htmlLocal.length > 200 && S.htmlServeur.length > 200,
  S.htmlLocal.length + ' / ' + S.htmlServeur.length + ' signes');
t('la cadence retient au moins deux clients a comparer',
  S.cadLocal.clients.length >= 2, S.cadLocal.clients.length + ' client(s)');
t('le bandeau retient au moins un mouvement a comparer',
  S.brLocal.movers.length >= 1, S.brLocal.movers.length + ' mouvement(s)');
t('le decrochage retient au moins un client a comparer',
  S.decLocal.decroche.length >= 1, S.decLocal.decroche.length + ' client(s)');

console.log('\n== 1. Le meme ecran, quelle que soit la source ==');
if (S.htmlLocal === S.htmlServeur) {
  t('le panneau « Mon commerce » est identique, caractere pour caractere', true);
} else {
  const n = Math.min(S.htmlLocal.length, S.htmlServeur.length);
  let i = 0; while (i < n && S.htmlLocal[i] === S.htmlServeur[i]) i++;
  t('le panneau « Mon commerce » est identique, caractere pour caractere', false,
    '\n            local   : ...' + S.htmlLocal.slice(Math.max(0, i - 70), i + 70)
    + '\n            serveur : ...' + S.htmlServeur.slice(Math.max(0, i - 70), i + 70));
}
t('le verdict des quatre mouvements est bien peint',
  S.htmlLocal.includes('D’où vient ta variation') || S.htmlLocal.includes('où vient ta variation'));
t('et la liste des clients a rappeler aussi', S.htmlLocal.includes('m-recul') || S.htmlLocal.includes('m-cadence'));

console.log('\n== 2. Les quatre mouvements, champ par champ ==');
t('la source est bien declaree de chaque cote',
  S.brLocal.serveur === false && S.brServeur.serveur === true);
for (const k of ['cur', 'prev']) t('bridge.' + k + ' identique', S.brLocal[k] === S.brServeur[k]);
for (const k of ['nw', 'up', 'down', 'lost', 'delta']) {
  t('bridge.' + k + ' identique a l\'euro', Math.abs(S.brLocal[k] - S.brServeur[k]) < 1,
    S.brLocal[k] + ' / ' + S.brServeur[k]);
}
/* LES QUATRE LIGNES BOUCLENT SUR LE TOTAL, des deux cotes. C'est la propriete qui rend
   ce bandeau lisible : un client ne peut pas etre a la fois perdu et en baisse. */
const boucle = b => Math.abs((b.nw + b.up + b.down + b.lost) - b.delta) < 0.01;
t('les quatre mouvements bouclent sur le total, cote local', boucle(S.brLocal));
t('et cote serveur aussi', boucle(S.brServeur));
t('la liste des mouvements a la meme longueur',
  S.brLocal.movers.length === S.brServeur.movers.length,
  S.brLocal.movers.length + ' / ' + S.brServeur.movers.length);
t('et le meme ordre, nom par nom',
  S.brLocal.movers.every((m, i) => m[0] === S.brServeur.movers[i][0]));

console.log('\n== 3. La cadence, client par client ==');
t('meme nombre de clients', S.cadLocal.clients.length === S.cadServeur.clients.length,
  S.cadLocal.clients.length + ' / ' + S.cadServeur.clients.length);
t('meme jour de reference', S.cadLocal.refDay === S.cadServeur.refDay);
{
  const parId = l => Object.fromEntries(l.map(c => [c.id, c]));
  const A = parId(S.cadLocal.clients), B = parId(S.cadServeur.clients);
  const champs = ['n', 'montant', 'panier', 'last', 'silence', 'cadence', 'cadRef',
                  'cv', 'cls', 'annuel', 'moisHab', 'enRetard', 'ampleur', 'prochaine', 'conf'];
  const mauvais = [];
  for (const id in A) for (const f of champs) {
    const a = A[id][f], b = B[id] && B[id][f];
    const egal = (typeof a === 'number' && typeof b === 'number')
      ? Math.abs(a - b) < 1e-6 : a === b;
    if (!egal) mauvais.push(id + '.' + f + ' ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b));
  }
  t('les quinze champs de chaque client sont identiques', mauvais.length === 0,
    mauvais.slice(0, 4).join(' | '));
}
t('la liste des retards a la meme longueur et le meme ordre',
  S.cadLocal.enRetard.length === S.cadServeur.enRetard.length
  && S.cadLocal.enRetard.every((c, i) => c.id === S.cadServeur.enRetard[i].id),
  S.cadLocal.enRetard.map(c => c.id).join(',') + ' / ' + S.cadServeur.enRetard.map(c => c.id).join(','));

console.log('\n== 4. Le decrochage ==');
t('meme nombre de clients retenus', S.decLocal.decroche.length === S.decServeur.decroche.length,
  S.decLocal.decroche.length + ' / ' + S.decServeur.decroche.length);
t('et le meme ordre, du plus gros montant perdu au plus petit',
  S.decLocal.decroche.every((c, i) => c.id === S.decServeur.decroche[i].id));
t('meme perte totale a l\'euro', Math.abs(S.decLocal.totPerdu - S.decServeur.totPerdu) < 1,
  S.decLocal.totPerdu + ' / ' + S.decServeur.totPerdu);
/* CE QUE L'ECRAN DIT DES ECARTES compte autant que la liste : un client venu une seule
   fois dans toute la base ne decroche pas, il n'est jamais monte. L'ecran le dit au
   vigneron plutot que de le taire. */
t('meme nombre de clients ecartes', S.decLocal.ecartes === S.decServeur.ecartes,
  S.decLocal.ecartes + ' / ' + S.decServeur.ecartes);
t('et meme montant ecarte', Math.abs(S.decLocal.caEcarte - S.decServeur.caEcarte) < 1);

/* --------------------------------------------------------------------------
   4 bis. AUCUN NOMBRE NE RESTE UNE CHAINE.

   Ecrit apres coup, parce que le banc a laisse passer une mutation : oublier
   `comNb()` sur `caPotentiel` ne faisait echouer aucun des trente-deux controles.
   La raison est que ce champ n'est lu par AUCUN ecran, donc il ne peut pas
   changer un pixel. Un controle qui ne regarde que ce qui s'affiche ne voit pas
   les champs qui ne s'affichent pas, et c'est justement ceux-la qui s'affichent
   un jour, six mois plus tard, en chaine de caracteres.

   PostgREST rend les numeriques de jsonb en CHAINES. « 1200 » + « 800 » fait
   « 1200800 », sans lever, sans rien casser a l'instant. Ce controle-ci ne
   regarde pas les valeurs, il regarde les TYPES, sur tout ce que le serveur rend.
   -------------------------------------------------------------------------- */
console.log('\n== 4 bis. Aucun nombre venu du serveur ne reste une chaine ==');
{
  const NOMBRES = {
    cadence: ['n', 'montant', 'panier', 'last', 'silence', 'cadence', 'cadRef',
              'ampleur', 'caPotentiel'],
    decroche: ['cur', 'prev', 'perdu', 'pct', 'seuil']
  };
  const fautifs = [];
  S.cadServeur.clients.forEach(c => NOMBRES.cadence.forEach(f => {
    if (c[f] != null && typeof c[f] !== 'number') fautifs.push('cadence.' + f + ' = ' + JSON.stringify(c[f]));
  }));
  S.decServeur.decroche.forEach(c => NOMBRES.decroche.forEach(f => {
    if (c[f] != null && typeof c[f] !== 'number') fautifs.push('decroche.' + f + ' = ' + JSON.stringify(c[f]));
  }));
  ['nw', 'up', 'down', 'lost', 'delta'].forEach(f => {
    if (typeof S.brServeur[f] !== 'number') fautifs.push('bridge.' + f + ' = ' + JSON.stringify(S.brServeur[f]));
  });
  S.brServeur.movers.forEach(m => {
    if (typeof m[1] !== 'number') fautifs.push('movers[' + m[0] + '] = ' + JSON.stringify(m[1]));
  });
  ['totPerdu', 'caEcarte'].forEach(f => {
    if (typeof S.decServeur[f] !== 'number') fautifs.push(f + ' = ' + JSON.stringify(S.decServeur[f]));
  });
  if (typeof S.cadServeur.caPotentiel !== 'number') fautifs.push('cadence.caPotentiel (le total)');
  t('tous les champs numeriques du serveur sont des nombres',
    fautifs.length === 0, fautifs.slice(0, 5).join(' | '));
}

console.log('\n== 5. Un serveur qui tousse ne vide pas l\'ecran ==');
t('pas de reponse du tout : on retombe sur le calcul local', S.muetLocal);
t('reponse vide ou tronquee : on retombe aussi', S.videLocal);
t('la peremption est atteignable par le moteur', S.aRafraichir);

/* --------------------------------------------------------------------------
   6. LA PEREMPTION, LUE DANS LE SOURCE.
   Un resume perime ne se voit pas dans un jsdom sans serveur : il se voit le jour
   ou Ted importe des lignes et ou sa liste d'appels ne bouge pas.
   -------------------------------------------------------------------------- */
console.log('\n== 6. Tout geste qui change le resultat perime LES DEUX resumes ==');
const base = fs.readFileSync(R + 'bdv-base.js', 'utf8');
const ecrans = fs.readFileSync(R + 'bdv-ecrans.js', 'utf8');
t('capPerimer() rafraichit « Mon cap » ET « Mon commerce »',
  /bdvCapRafraichir/.test(base) && /bdvCommerceRafraichir/.test(base));
t('comRafraichir() sait attendre une ecriture avant de redemander',
  /function comRafraichir\(apres\)/.test(ecrans));
t('et il met le resume a null TOUT DE SUITE',
  /function comRafraichir\(apres\)\{\s*\n?\s*comPoser\(null\);/.test(ecrans));
/* IL NE PART PLUS A L'AMORCAGE, et c'est le controle qui garde la correction du
   17/09 au soir : 3,8 s et 642 ko a chaque ouverture du bureau, y compris celles ou
   le vigneron ne regarde jamais cet ecran. Il part a l'ouverture de l'ecran, une fois,
   et sans faire attendre : le calcul local peint d'abord. */
t('le resume du commerce ne part PAS a l\'amorcage',
  !/comEnRoute/.test(ecrans));
t('il part a l\'ouverture de l\'ecran, une seule fois par session',
  /function renderClients\(\)\{\s*\n\s*comAuBesoin\(\);/.test(ecrans)
  && /if\(COM \|\| COM_DEMANDE\) return;/.test(ecrans));
/* Le drapeau ne doit PAS etre leve par `comRafraichir()`, qui le remet a zero : les
   enchainer ferait une boucle sans fin. Defaut ecrit puis corrige le meme soir. */
t('et il appelle le serveur lui-meme, sans passer par comRafraichir()',
  /COM_DEMANDE = true;[\s\S]{0,400}BdvSync\.commerceResume\(\)/.test(ecrans));
t('l\'ecran se peint AVANT la reponse : le calcul local d\'abord',
  !/await[\s\S]{0,40}commerceResume/.test(ecrans));
/* L'ordre des ex aequo est pose des deux cotes : `Array.sort` est stable, donc sans
   second critere le navigateur rendait l'ordre d'IndexedDB, que rien ne reproduit. */
t('les mouvements ex aequo sont departages par le nom, pas par l\'ordre d\'IndexedDB',
  /Math\.abs\(b\[1\]\)-Math\.abs\(a\[1\]\)\|\|\(a\[0\]<b\[0\]/.test(ecrans));

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DU COMMERCE SERVEUR REFUSE\n'); process.exit(1); }
console.log('  LE MEME ECRAN, QUE LE CHIFFRE VIENNE DU SERVEUR OU DE L\'APPAREIL\n');
process.exit(0);
