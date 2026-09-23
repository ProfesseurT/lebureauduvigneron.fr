/* ============================================================================
   scripts/banc-classement.mjs : le bureau dit-il qu'il travaille au juge ?

     npm run banc:classement

   POURQUOI CE BANC EXISTE. Ted a tenu un bureau entier avec un classement jamais
   valide. Consequence mesuree le 23/09/2026 : `v_ventes.est_vente` a null sur ses
   5 210 lignes, donc AUCUN des trois resumes du serveur ne calculait quoi que ce
   soit, donc chaque ouverture refaisait tout sur son appareil. Rien a l'ecran ne
   le lui disait.

   L'aveu existait pourtant, ecrit le 19/09/2026 dans `renderReglages()` : « L'outil
   fonctionne actuellement au juge ». Il vivait dans l'onglet « Le classement » du
   panneau, c'est-a-dire a l'endroit ou l'on va deja pour corriger. **Une phrase
   juste, posee la ou personne n'a de raison de passer, ne dit rien a personne.**

   CE QUE CE BANC GARDE : que le bandeau se montre quand il faut, qu'il se TAISE
   quand on ne sait pas, et qu'il soit branche sur les trois chemins. Un bandeau qui
   accuse a tort coute plus cher que pas de bandeau du tout : il apprend a ignorer.

   LE PIEGE DU HARNAIS, deja paye quatre fois : UN SEUL `eval`. Les globales du
   moteur sont declarees en `let` et `const`, qui restent scopees a cet eval.
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

/* ==========================================================================
   0. LE BALISAGE EXISTE DANS LA PAGE CONSTRUITE, pas seulement dans le module.
   ==========================================================================
   `bdv-ecrans.js` ecrit dans un id nomme par la coque. Un id absent ne leve rien :
   la zone reste vide et personne ne le remarque. C'est ecrit en tete de
   ecrans-vente.njk, et c'est le genre de defaut que ce depot a deja paye. */
console.log('\n== 0. Le bandeau a bien une place dans la page construite ==');
const CONSTRUITE = path.join(RACINE, '_site/mon-bureau/index.html');
if (!fs.existsSync(CONSTRUITE)) {
  console.log('  ECHEC : _site/mon-bureau/index.html manque. Lance `npm run build` d\'abord.');
  process.exit(1);
}
const page = fs.readFileSync(CONSTRUITE, 'utf8');
t('l\'id noteClassement existe dans la coque des ecrans de vente',
  /id="noteClassement"/.test(page));
t('et il est AVANT la barre de periode, donc au-dessus de ce qu\'il commente',
  page.indexOf('id="noteClassement"') > 0
  && page.indexOf('id="noteClassement"') < page.indexOf('id="filterbar"'));

const dom = new JSDOM(`<!doctype html><body>
  <div id="noteClassement"></div>
  <section class="panel" id="p-annee"><div id="p-diagnostic"></div></section>
  <section class="panel" id="p-clients"></section>
  <section class="panel" id="p-produits"></section>
  <section class="panel" id="p-chercher"><div id="p-explorer"></div></section>
  <div class="filterbar" id="filterbar"></div>
  <div id="status"></div><div id="statusTxt"></div><div id="statusSpin"></div>
  <div id="busyov"></div><div id="busytxt"></div>
</body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w = dom.window;
w.Chart = function(){ this.destroy = () => {}; };
w.Papa = {};

/* Le decor minimal : quelques lignes de vente derivees a la main, comme le font les
   autres bancs du depot. Le bandeau ne lit pas les chiffres, il lit trois etats. */
const test = `
  ROWS.length = 0;
  for (var i = 0; i < 6; i++) {
    var ts = Date.UTC(2026, i, 15);
    ROWS.push({ famille: 'Rouge', produit: 'Cuvee 2024', client: 'C' + i, numClient: 'C' + i,
      numFacture: 'F' + i, millesime: '2024', conditionnement: '75cl', pays: 'France',
      _vin: true, _date: { y: 2026, m: i + 1, d: 15, t: ts },
      _dayNum: Math.floor(ts / 86400000), _exY: 2026, _exM: i + 1, _exPos: i,
      _qte: 10, _total: 120 });
  }
  computeMeta();
  _lignesChargees = true;
  LIGNES_EN_BASE = 6; LIGNES_DISTANTES = null;

  var lu = function(){ return el('noteClassement').innerHTML; };
  var etats = {};

  /* 1. classement VALIDE : le bandeau n'existe pas, et il ne prend aucune place. */
  REG = { valide: true, horsCA: {}, gratuit: {}, canaux: {}, types: {} };
  marquerReglagesNonLus(false);
  majNoteClassement(); etats.valide = lu();

  /* 2. classement AU JUGE, lignes la : c'est le cas de Ted, et le bandeau doit parler. */
  REG = { valide: false, horsCA: {}, gratuit: {}, canaux: {}, types: {} };
  marquerReglagesNonLus(false);
  majNoteClassement(); etats.juge = lu();

  /* 3. reglages du COMPTE illisibles : on ne sait pas, donc on se tait. Le panneau, lui,
        dit deja autre chose et un autre geste : recharger, surtout ne rien enregistrer. */
  marquerReglagesNonLus(true);
  majNoteClassement(); etats.incertain = lu();

  /* 4. les lignes ne sont pas la : REGLAGES_NON_LUS vaut encore son false de depart, qui
        veut dire « personne n'a essaye » et pas « la lecture a abouti ». */
  marquerReglagesNonLus(false);
  _lignesChargees = false; var garde = ROWS.splice(0, ROWS.length);
  LIGNES_EN_BASE = null;
  majNoteClassement(); etats.sansLignes = lu();

  /* 5. base vraiment vide : rien a classer, le panneau ecarte deja son onglet. */
  _lignesChargees = true; LIGNES_EN_BASE = 0; LIGNES_DISTANTES = 0;
  majNoteClassement(); etats.baseVide = lu();

  garde.forEach(function(r){ ROWS.push(r); });
  computeMeta(); LIGNES_EN_BASE = 6; LIGNES_DISTANTES = null;

  window.__S = { etats: etats, aFonction: typeof bdvReglerClassement === 'function',
                 exposee: typeof window.bdvMajNoteClassement === 'function' };
`;

try {
  w.eval(fs.readFileSync(R + 'bdv-base.js', 'utf8') + '\n'
       + fs.readFileSync(R + 'bdv-ecrans.js', 'utf8') + '\n' + test);
} catch (e) {
  console.log('ECHEC a l\'execution : ' + e.message);
  console.log((e.stack || '').split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}
const S = w.__S, E = S.etats;

console.log('\n== 1. Il parle quand il faut, et il se tait le reste du temps ==');
t('classement valide : le bandeau est VIDE', E.valide === '', JSON.stringify(E.valide).slice(0, 80));
t('classement au juge : le bandeau parle', /au jugé/.test(E.juge), JSON.stringify(E.juge).slice(0, 80));
/* LE REFUS LE PLUS IMPORTANT DES TROIS. « Je ne sais pas » n'est pas « non » : accuser un
   vigneron d'un reglage manquant parce que SON RESEAU a lache, c'est lui faire refaire un
   classement qui existe deja sur son compte. Le panneau dit deja l'autre phrase. */
t('reglages du compte illisibles : le bandeau se TAIT', E.incertain === '',
  JSON.stringify(E.incertain).slice(0, 80));
t('lignes pas encore chargees : il se tait aussi', E.sansLignes === '',
  JSON.stringify(E.sansLignes).slice(0, 80));
t('base vraiment vide : rien a classer, il se tait', E.baseVide === '',
  JSON.stringify(E.baseVide).slice(0, 80));

console.log('\n== 2. Il dit ce qu\'on perd ET il pose le geste ==');
/* La lecon du 19/09/2026, dans les deux sens : annoncer ce qui manque sans le bouton qui
   le comble est une impasse ; poser le bouton sans l'annonce, c'est ce qu'on repare ici. */
t('il nomme ce qui est devine, pas seulement « mal regle »',
  /canaux/.test(E.juge) && /familles/.test(E.juge));
t('il dit ce que ca coute : tout se recalcule sur l\'appareil',
  /cet appareil/.test(E.juge));
t('il porte un bouton, et un seul', (E.juge.match(/<button/g) || []).length === 1);
t('le bouton passe par bdvReglerClassement()', /bdvReglerClassement\(\)/.test(E.juge));
t('et cette fonction existe', S.aFonction);
t('la repeinture est atteignable par la fenetre', S.exposee);

console.log('\n== 3. Les trois chemins, regle du 14/09/2026 ==');
/* Une zone qui n'a que le premier chemin marche parfaitement le jour ou on l'ecrit. */
const src = fs.readFileSync(R + 'bdv-ecrans.js', 'utf8');
const bloc = (nom) => {
  const i = src.indexOf('function ' + nom + '(');
  if (i < 0) return null;
  let p = src.indexOf('{', i), n = 0, j = p;
  for (; j < src.length; j++) {
    if (src[j] === '{') n++;
    else if (src[j] === '}') { n--; if (!n) break; }
  }
  return src.slice(i, j + 1);
};
for (const nom of ['ecranPeindre', 'renderAll', 'assurerLignes']) {
  const b = bloc(nom);
  t(nom + '() repeint le bandeau', !!b && /majNoteClassement\(/.test(b),
    b ? 'aucun appel dans le corps' : 'fonction introuvable');
}

console.log('\n== 4. Le renvoi mene a l\'onglet qui repare ==');
/* Un renvoi qui depose le vigneron devant six onglets lui laisse la moitie du travail. */
const nav = fs.readFileSync(R + 'bdv-nav.js', 'utf8');
const regl = fs.readFileSync(R + 'bdv-reglages.js', 'utf8');
t('BdvNav.ouvrirReglages accepte un onglet', /function ouvrirReglages\(onglet\)/.test(nav));
t('et le transmet au panneau', /ouvrirPanneauReglages\(onglet\)/.test(nav)
  && /BdvReglages\.ouvrir\(onglet\)/.test(nav));
t('ouvrirPanneauReglages le transmet aussi', /function ouvrirPanneauReglages\(onglet\)/.test(src)
  && /BdvReglages\.ouvrir\(onglet\)/.test(src));
t('BdvReglages.ouvrir sait viser un onglet nomme', /function ouvrir\(onglet\)/.test(regl)
  && /classement:\s*'bdvrBlocClassement'/.test(regl));
/* L'ORDRE EST UNE CONDITION : gateBaseVide() force « Ma base » quand il n'y a rien a
   classer, et il a raison. Poser l'onglet avant, c'est se faire corriger sans le voir. */
t('et il le vise APRES rafraichirTout(), jamais avant',
  /rafraichirTout\(\);\s*\n\s*viserOnglet\(onglet\);/.test(regl));

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BUREAU NE DIT PAS QU\'IL TRAVAILLE AU JUGE\n'); process.exit(1); }
console.log('  LE BUREAU DIT QUAND IL TRAVAILLE AU JUGE, ET OU LE REGLER\n');
process.exit(0);
