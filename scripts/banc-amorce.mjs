/* ============================================================================
   scripts/banc-amorce.mjs : le banc de l'amorcage du bureau

     npm run banc:amorce

   ECRIT LE 17/09/2026, apres le defaut que Ted a decrit ainsi : « quand je me
   connecte, rien ne s'affiche ». Trois zones affichaient leur message d'echec
   parce que les quatre lectures partaient EN MEME TEMPS, alors qu'elles sont
   toutes filtrees par un bureau courant que `chargerBureau()` n'avait pas
   encore ramene.

   CE QUE CE BANC GARDE, ET QU'AUCUN AUTRE NE PEUT VOIR :

     1. L'ORDRE. Les etapes s'enchainent, jamais en parallele. C'est la
        reparation elle-meme : la paralleliser « pour gagner 200 ms » ramene le
        defaut a l'identique, et il ne se voit que sur un appareil qui n'a pas
        encore sa cle de bureau, donc jamais sur le poste du developpeur.
     2. LE PLAFOND REND LA MAIN. Un voile qui ne se ferme pas est pire que le
        defaut qu'il repare : il enferme le vigneron dehors de chiffres que son
        appareil porte deja.
     3. `bureau` EST LA PREMIERE ETAPE DE LA VRAIE PAGE. Controle sur la page
        CONSTRUITE, parce que la liste vit dans son script inline.

   IL DEMANDE jsdom :  npm install --save-dev jsdom
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER = path.join(RACINE, 'src/js/bdv-amorce.js');
const PAGE = path.join(RACINE, '_site/mon-bureau/index.html');

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) {
  console.error('\n  jsdom est absent, le banc ne peut pas tourner.');
  console.error('  Rien n\'a ete verifie. Installe-le :  npm install --save-dev jsdom\n');
  process.exit(2);
}
if (!fs.existsSync(FICHIER)) {
  console.error('\n  src/js/bdv-amorce.js est absent : le banc ne verifie rien.\n');
  process.exit(2);
}

let ok = 0, ko = 0;
const dit = (b, m, det) => {
  if (b) { ok++; console.log('  ok    : ' + m); }
  else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + det : '')); }
};
const attendre = (ms) => new Promise(r => setTimeout(r, ms));

/* Le decor. `avecSession` decide si le voile doit paraitre : c'est la seule chose
   que le module demande a son environnement. */
function monter(avecSession) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window;
  w.BdvCompte = { session: () => (avecSession === false ? null : { user: { id: 'moi' } }) };
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(FICHIER, 'utf8');
  w.document.body.appendChild(s);
  return { w, A: w.BdvAmorce, voile: () => w.document.querySelector('.bdv-amorce') };
}

/* ==========================================================================
   1. LE VOILE PARAIT, ET IL DIT CE QU'IL FAIT
   ========================================================================== */
console.log('\n== 1. Le voile ==');
{
  const t = monter(true);
  let debloque;
  const p = t.A.lancer([
    { cle: 'bureau', texte: 'Ton bureau', faire: () => new Promise(r => { debloque = r; }) },
    { cle: 'suivi',  texte: 'Tes clients et tes rappels', faire: () => true }
  ], { plafondMs: 5000 });
  await attendre(0);
  const v = t.voile();
  dit(!!v, 'le voile est pose des le lancement');
  dit(v && v.getAttribute('role') === 'dialog' && v.getAttribute('aria-modal') === 'true',
    'il s\'annonce comme une modale');
  dit(v && v.querySelectorAll('.bdv-amorce__etape').length === 2,
    'une ligne par etape', v && v.querySelectorAll('.bdv-amorce__etape').length);
  dit(v && /Ton bureau/.test(v.textContent) && /Tes clients/.test(v.textContent),
    'chaque etape est nommee en toutes lettres, pas numerotee');
  const ligne = v && v.querySelector('[data-etape="bureau"]');
  dit(ligne && /--encours/.test(ligne.className), 'la premiere etape se dit en cours', ligne && ligne.className);
  /* L'ETAT NE SE DIT PAS QUE PAR LA COULEUR. Un mot cache le double, sinon la
     synthese vocale n'annonce rien du tout. Meme regle que la gravite du mot du jour. */
  dit(ligne && /en cours/.test(ligne.querySelector('.bdv-amorce__dit').textContent),
    'et il le dit AUSSI en toutes lettres, pour qui ecoute');
  debloque(true);
  await p;
}

/* ==========================================================================
   2. L'ORDRE, ET C'EST LA REPARATION ELLE-MEME
   ========================================================================== */
console.log('\n== 2. Les etapes s\'enchainent, jamais en parallele ==');
{
  const t = monter(true);
  const trace = [];
  const lente = (cle, ms) => ({ cle, texte: cle, faire: () => {
    trace.push('debut:' + cle);
    return attendre(ms).then(() => { trace.push('fin:' + cle); });
  } });
  await t.A.lancer([lente('bureau', 30), lente('suivi', 5), lente('journal', 5)], { plafondMs: 5000 });
  dit(trace.join(' ') === 'debut:bureau fin:bureau debut:suivi fin:suivi debut:journal fin:journal',
    'chaque etape finit avant que la suivante commence', trace.join(' '));
  /* Le controle qui compte vraiment : en parallele, `debut:suivi` apparaitrait AVANT
     `fin:bureau`, et le suivi lirait sans savoir quel bureau lire. C'est exactement
     le defaut du 17/09/2026. */
  dit(trace.indexOf('fin:bureau') < trace.indexOf('debut:suivi'),
    'LE BUREAU EST RACCORDE AVANT QUE QUOI QUE CE SOIT LE LISE');
  dit(!t.voile(), 'tout a repondu : le voile s\'efface et rend la main');
}

/* ==========================================================================
   3. UNE ETAPE QUI RATE SE DIT PAR SON NOM
   ========================================================================== */
console.log('\n== 3. Ce qui echoue est nomme ==');
{
  const t = monter(true);
  /* LA PROMESSE NE SE RESOUT PAS TANT QUE LE VIGNERON N'A PAS TRANCHE, et c'est
     voulu : « Reessayer » rejoue les etapes ratees, donc rendre un bilan avant son
     clic serait rendre un bilan faux. On regarde donc le voile d'abord, on clique
     ensuite, et on attend apres. */
  const p = t.A.lancer([
    { cle: 'bureau', texte: 'Ton bureau', faire: () => true },
    { cle: 'suivi',  texte: 'Tes clients et tes rappels', faire: () => false },
    { cle: 'lectures', texte: 'Ce que tu as mis de cote', faire: () => { throw new Error('reseau'); } }
  ], { plafondMs: 5000 });
  await attendre(20);
  /* `false` ET une exception comptent tous les deux pour un echec. Le premier est le
     cas de BdvCrm.charger(), qui rend null sans jamais lever : sans lui, la seule
     panne qui compte vraiment passerait pour une reussite. */
  const v = t.voile();
  dit(!!v, 'le voile RESTE : il y a quelque chose a dire');
  dit(v && /Tes clients et tes rappels/i.test(v.textContent),
    'et il dit LEQUEL, en toutes lettres et pas en code d\'erreur');
  dit(v && !!v.querySelector('[data-amorce-rejouer]'), 'un bouton Reessayer est propose');
  dit(v && !!v.querySelector('[data-amorce-passer]'), 'et un bouton pour ouvrir quand meme');
  v.querySelector('[data-amorce-passer]').click();
  const bilan = await p;
  dit(bilan.rates.join(',') === 'suivi,lectures', 'le bilan nomme les deux etapes ratees', bilan.rates.join(','));
  dit(!t.voile(), '« Ouvrir quand meme » rend la main');
}

/* ==========================================================================
   4. LE PLAFOND REND TOUJOURS LA MAIN
   ==========================================================================
   Arbitrage de Ted du 17/09/2026. L'autre branche a ete pesee : un voile qui
   attend le raccordement complet enferme le vigneron DEHORS de ses propres
   chiffres le jour ou le serveur tousse, alors que son appareil les porte deja. */
console.log('\n== 4. Le plafond ==');
{
  const t = monter(true);
  let jamais = false;
  const p = t.A.lancer([
    { cle: 'bureau', texte: 'Ton bureau', faire: () => new Promise(() => { jamais = true; }) }
  ], { plafondMs: 60 });
  await attendre(160);
  const v = t.voile();
  dit(jamais, 'l\'etape a bien ete lancee et ne repond pas');
  dit(!!v && !!v.querySelector('[data-amorce-passer]'),
    'le voile a rendu la main au plafond, avec de quoi ouvrir');
  const ligne = v && v.querySelector('[data-etape="bureau"]');
  dit(ligne && /--rate/.test(ligne.className), 'l\'etape muette est marquee comme sans reponse');
  v.querySelector('[data-amorce-passer]').click();
  const bilan = await p;
  dit(bilan.rates.join(',') === 'bureau', 'le bilan la nomme', bilan.rates.join(','));
}

/* ==========================================================================
   5. HORS SESSION : PAS DE VOILE, MAIS LES ETAPES TOURNENT
   ==========================================================================
   Le bureau deconnecte est une porte d'entree, pas un outil en train de
   charger. Et ne PAS lancer les etapes serait un changement de comportement
   hors session, que ce chantier n'a jamais demande. */
console.log('\n== 5. Sans session ==');
{
  const t = monter(false);
  let passe = 0;
  await t.A.lancer([
    { cle: 'bureau', texte: 'Ton bureau', faire: () => { passe++; } },
    { cle: 'suivi',  texte: 'Tes clients', faire: () => { passe++; } }
  ], { plafondMs: 5000 });
  dit(!t.voile(), 'aucun voile : personne n\'attend rien');
  dit(passe === 2, 'les deux etapes ont tourne quand meme', passe);
}

/* ==========================================================================
   6. SUR LA VRAIE PAGE : `bureau` EST LA PREMIERE ETAPE
   ==========================================================================
   La liste vit dans le script inline de src/mon-bureau.njk, qu'aucun banc de
   structure ne lit. Son ORDRE est la dependance : si `suivi` passe devant
   `bureau`, le defaut du 17/09/2026 revient a l'identique, et rien d'autre
   dans le depot ne le signalera. */
console.log('\n== 6. La page construite ==');
if (!fs.existsSync(PAGE)) {
  dit(false, 'la page construite est absente : lance `npm run build` d\'abord');
} else {
  const html = fs.readFileSync(PAGE, 'utf8');
  dit(/<script src="\/js\/bdv-amorce\.js"/.test(html), 'la page charge bdv-amorce.js');
  dit(/function amorcer\(\)/.test(html) && /\n\s*amorcer\(\);/.test(html),
    'et elle l\'appelle a l\'ouverture');
  const bloc = html.slice(html.indexOf('function amorcer()'));
  const cles = [...bloc.slice(0, bloc.indexOf('BdvAmorce.lancer')).matchAll(/cle:\s*'([a-z]+)'/g)].map(m => m[1]);
  dit(cles[0] === 'bureau', 'LA PREMIERE ETAPE EST `bureau`, tout le reste en depend', cles.join(' > '));
  dit(cles.length >= 4, 'les lectures du bureau sont toutes dans la liste', cles.join(' > '));
  /* ET RIEN NE LIT AVANT LA SEQUENCE. C'est le defaut du 17/09/2026 dans sa forme
     exacte : une lecture lancee au demarrage, a cote, avant que le bureau soit connu.
     On regarde donc la fenetre qui va de l'ouverture du DOMContentLoaded jusqu'a
     l'appel de la sequence, et elle doit etre vide de toute lecture reseau.

     Les autres appels de `BdvCrm.charger()` de la page ne sont PAS vises et ne doivent
     pas l'etre : ils repeignent apres un geste du vigneron (`geste()`,
     `bdvFicheAEcrit`), donc a un moment ou le bureau est connu depuis longtemps. */
  const iDom = html.indexOf("DOMContentLoaded', function()");
  const iAmorce = html.indexOf('amorcer();', iDom);
  const avant = (iDom >= 0 && iAmorce > iDom) ? html.slice(iDom, iAmorce) : '';
  const lectures = ['BdvCrm.charger()', 'BdvCrm.journal(', 'BdvSignets.charger()', 'chargerProfil()']
    .filter(n => avant.indexOf(n) >= 0);
  dit(iAmorce > iDom, 'la sequence est appelee depuis le demarrage de la page');
  dit(lectures.length === 0,
    'et AUCUNE lecture ne part avant elle', lectures.join(' '));
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DE L\'AMORCAGE REFUSE\n'); process.exit(1); }
console.log('  ON RACCORDE DANS L\'ORDRE, ET ON REND TOUJOURS LA MAIN\n');
process.exit(0);
