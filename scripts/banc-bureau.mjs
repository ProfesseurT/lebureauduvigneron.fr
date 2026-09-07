/* ============================================================================
   scripts/banc-bureau.mjs : le banc du bureau

     npm run build && npm run banc

   PREMIER TEST AUTOMATISE DU DEPOT, ecrit le 07/09/2026 au lot 1 de la fusion,
   etendu au lot 2c. Jusqu'ici « CONFORME » ne voulait dire que « la charte
   graphique tient », jamais « ca marche ».

   IL DEMANDE jsdom :  npm install --save-dev jsdom
   Sans lui, le banc s'arrete en le disant, et il ne rend jamais un faux OK.
   C'est la lecon de charte:dash, qui a annonce CONFORME sur du vide deux fois en
   une journee : un controle qui ne peut pas s'executer doit crier, pas se taire.

   IL LIT LE HTML PRODUIT, `_site/mon-bureau/index.html`, et pas le gabarit :
   c'est ce fichier-la que le vigneron recoit. Lancer `npm run build` avant,
   sinon on controle la page d'hier.

   CE QU'IL NE FAIT PAS. Il n'execute aucun script de la page : le bureau en
   charge huit, dont trois depuis un CDN. Il monte la barre a la main et remplace
   le chargement des ecrans de vente par un faux reseau qui repond tout de suite.
   Il verifie donc l'enchainement des gestes, jamais le rendu d'un chiffre. Les
   cinq controles de CLAUDE.md sur un export reel restent a faire a l'ecran.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(RACINE, '_site/mon-bureau/index.html');
const MODULE = path.join(RACINE, 'src/js/bdv-nav.js');

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) {
  console.error('\n  jsdom est absent, le banc ne peut pas tourner.');
  console.error('  Rien n\'a ete verifie. Installe-le :  npm install --save-dev jsdom\n');
  process.exit(2);
}
if (!fs.existsSync(PAGE)) {
  console.error('\n  ' + path.relative(RACINE, PAGE) + ' est absent : lance npm run build d\'abord.\n');
  process.exit(2);
}

const HTML = fs.readFileSync(PAGE, 'utf8');
const NAV = fs.readFileSync(MODULE, 'utf8');

let ok = 0, ko = 0;
const t = (nom, cond, detail) => {
  if (cond) { ok++; console.log('  ok    : ' + nom); }
  else { ko++; console.log('  ECHEC : ' + nom + (detail ? '  →  ' + detail : '')); }
};
const titre = (x) => console.log('\n== ' + x + ' ==');

console.log('page  : ' + path.relative(RACINE, PAGE));
console.log('module: ' + path.relative(RACINE, MODULE));

/* Un bureau tout neuf, a l'adresse demandee. Le faux reseau resout chaque <link> et
   chaque <script> ajoute par le chargeur des ecrans : sans lui, le banc mesurerait la
   capacite de jsdom a joindre un CDN, ce qui n'apprend rien sur le bureau. */
function bureau(hash) {
  const dom = new JSDOM(HTML, {
    runScripts: 'outside-only', pretendToBeVisual: true,
    url: 'https://x.test/mon-bureau/' + (hash || '')
  });
  const { window } = dom;
  const doc = window.document;
  const charges = [];
  const vrai = doc.head.appendChild.bind(doc.head);
  doc.head.appendChild = function (n) {
    const r = vrai(n);
    if (n.tagName === 'LINK' || n.tagName === 'SCRIPT') {
      charges.push(n.getAttribute('href') || n.getAttribute('src'));
      // Dans l'ordre d'un vrai chargement : l'evenement arrive apres le tour de boucle.
      setTimeout(() => { if (n.onload) n.onload(); }, 0);
    }
    return r;
  };
  const appels = [];
  window.demarrerEcransVente = (d) => { appels.push(d || {}); };
  window.ouvrirPanneauReglages = () => { appels.push({ panneau: true }); };
  window.BdvReglages = {
    ouvrir: () => { appels.push({ panneau: true }); },
    rafraichir: () => { appels.push({ rafraichi: true }); },
    dire: (m) => { appels.push({ dit: m }); }
  };
  window.eval(NAV);
  window.BdvNav.monter(doc.getElementById('bureauNav'), 'journee');
  return { window, doc, charges, appels,
    journee: doc.getElementById('bureauJournee'),
    ventes: doc.getElementById('bureauVentes'),
    nav: doc.getElementById('bureauNav'),
    clic(piece) {
      const l = doc.querySelector('.bureau-nav__ligne[data-piece="' + piece + '"]');
      const it = l && l.querySelector('.bureau-nav__item');
      if (!it) throw new Error('piece introuvable : ' + piece);
      it.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    },
    repos() { return new Promise(r => setTimeout(r, 60)); }
  };
}

/* ======================= LA BARRE (lot 1) ======================= */
titre('La barre du bureau');
const B = bureau();
t('le module s\'expose', typeof B.window.BdvNav.monter === 'function');
t('la coque de l\'atelier existe dans le HTML produit',
  !!B.nav && !!B.doc.getElementById('bureauAtelier'));

const lignes = [...B.nav.querySelectorAll('.bureau-nav__ligne')];
t('sept pieces montees', lignes.length === 7, lignes.length + ' trouvee(s)');
/* L'ORDRE EST UN CONTROLE ET PAS UN DETAIL : il porte l'hypothese H2 du document
   de refonte, le vigneron vient pour ne rien oublier. Si quelqu'un le change, il
   doit le changer ICI aussi, donc en connaissance de cause. */
t('l\'ordre porte l\'hypothese du document',
  lignes.map(l => l.querySelector('.bureau-nav__nom').textContent).join(' | ')
  === 'Ma journée | Le calendrier | Mes clients | Mon année | Mes cuvées | Mon registre | Mes réglages',
  lignes.map(l => l.querySelector('.bureau-nav__nom').textContent).join(' | '));
t('chaque piece porte un title', lignes.every(l => l.querySelector('[title]')));
t('les quatre pieces de vente pointent DANS le bureau',
  [...B.nav.querySelectorAll('a.bureau-nav__item')]
    .map(a => a.getAttribute('href'))
    .filter(h => /^\/mon-bureau\/#/.test(h)).length === 4);
t('le calendrier pointe sur son outil',
  [...B.nav.querySelectorAll('a')].some(a => a.getAttribute('href') === '/outils/echeances/'));
t('les reglages sont un bouton, pas un lien',
  B.nav.querySelector('[data-bdv-nav-panneau]').tagName === 'BUTTON');

/* ---- le repli ---- */
const plier = B.doc.getElementById('bureauNavPlier');
const atelier = B.doc.getElementById('bureauAtelier');
t('deplie au depart', !atelier.classList.contains('bureau-atelier--replie'));
plier.dispatchEvent(new B.window.MouseEvent('click', { bubbles: true }));
t('un clic replie', atelier.classList.contains('bureau-atelier--replie'));
t('la preference est ecrite sur la cle PARTAGEE avec le volet des ecrans de vente',
  B.window.localStorage.getItem('bdv_volet_replie') === '1');
t('le libelle accessible annonce l\'action a venir, pas l\'etat present',
  plier.getAttribute('aria-label') === 'Déplier le menu', plier.getAttribute('aria-label'));
plier.dispatchEvent(new B.window.MouseEvent('click', { bubbles: true }));
t('un second clic deplie', !atelier.classList.contains('bureau-atelier--replie'));

const frappe = (c) => c.dispatchEvent(new B.window.KeyboardEvent('keydown', { key: '[', bubbles: true, cancelable: true }));
frappe(B.doc.body);
t('le crochet ouvrant replie', atelier.classList.contains('bureau-atelier--replie'));
const champ = B.doc.createElement('input'); B.doc.body.appendChild(champ);
frappe(champ);
t('le crochet ouvrant ne fait RIEN pendant une saisie',
  atelier.classList.contains('bureau-atelier--replie'),
  'la barre a bouge alors qu\'on tapait un crochet dans un champ');

/* ---- sans Vitisoft : regle metier, pas cosmetique ---- */
B.window.BdvNav.sansVitisoft(true);
t('sans Vitisoft, les quatre pieces de vente disparaissent',
  lignes.filter(l => l.hidden).map(l => l.dataset.piece).sort().join(',') === 'annee,chercher,clients,produits');
t('sans Vitisoft, la journee, le calendrier et les reglages RESTENT',
  ['journee', 'echeances', 'reglages'].every(id => !lignes.find(l => l.dataset.piece === id).hidden));
B.window.BdvNav.sansVitisoft(false);
t('avec Vitisoft, tout revient', lignes.filter(l => l.hidden).length === 0);

/* ---- le tiroir ---- */
/* Supprime au lot 3. Ses deux entrees sont dans la barre depuis le lot 1, et il n'y avait
   qu'un seul outil ouvert a tous a lui rendre, deja dans la barre lui aussi. Le controle
   reste, a l'envers : c'est ce qui empechera de le reintroduire par inadvertance en
   recopiant une ancienne version du gabarit. */
t('le tiroir a bien disparu du bureau',
  B.doc.getElementById('zoneTiroir') === null && !HTML.includes('zone--tiroir'));

/* ======================= LES ECRANS DE VENTE (lot 2c) ======================= */
titre('Les ecrans de vente dans le bureau');

/* LES REPERES DE LA COQUE, liste FIGEE comme ENTITES_ATTENDUES dans charte.mjs, et pour
   la meme raison : bdv-ecrans.js ecrit dans ces id, et un id disparu ne provoque aucune
   erreur visible. La zone reste vide, et personne ne le remarque avant de chercher un
   chiffre qui manque. Une liste qui se deduirait de la coque elle-meme ne detecterait
   plus rien. Elle est passee de trente-deux a vingt-six au lot 2d : le volet, son menu de
   secours et le bouton de deconnexion sont partis, la barre du bureau les porte. */
const REPERES = ['app', 'bowlclip', 'busyov', 'busytxt', 'filterbar', 'modale',
  'p-annee', 'p-apercu', 'p-base', 'p-canaux', 'p-chercher', 'p-clients', 'p-decrochage',
  'p-diagnostic', 'p-evolution', 'p-explorer', 'p-premier', 'p-produits', 'p-reactivation',
  'p-reglages', 'p-vide', 'printReport', 'status', 'statusSpin', 'statusTxt', 'tbFile'];
const manquants = REPERES.filter(id => !B.doc.getElementById(id));
t('la coque des ecrans porte ses ' + REPERES.length + ' reperes',
  manquants.length === 0, 'manquant(s) : ' + manquants.join(', '));

/* Le seul lien entre bdv-nav.js et bdv-ecrans.js est la liste des identifiants d'ecran,
   et rien ne le tient. Ce controle est ce mecanisme : ajouter un ecran d'un cote sans
   l'autre echoue ici, au lieu d'echouer chez le vigneron par une piece qui ne mene
   nulle part. */
const ECRANS = fs.readFileSync(path.join(RACINE, 'src/js/bdv-ecrans.js'), 'utf8');
const bloc = ECRANS.slice(ECRANS.indexOf('const NAV=['), ECRANS.indexOf('];', ECRANS.indexOf('const NAV=[')));
const idsEcrans = [...bloc.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]).sort();
const idsBarre = B.window.BdvNav.pieces
  .filter(p => p.viti || p.id === 'reglages').map(p => p.id).sort();
t('les identifiants d\'ecran sont les memes dans bdv-nav.js et bdv-ecrans.js',
  idsEcrans.join(',') === idsBarre.join(','),
  'ecrans : ' + idsEcrans.join(',') + '  /  barre : ' + idsBarre.join(','));

t('le volet, son menu de secours et la deconnexion ont quitte la coque',
  ['sidebar', 'volet', 'ici', 'iciMenu', 'tbSection', 'tbSortir']
    .every(id => !B.doc.querySelector('#bureauVentes #' + id)));
t('elle est portee par le wrapper de scope',
  !!B.doc.querySelector('#bureauVentes .bdv-ventes .app'));
t('les quatre elements hors page sont remontes sous body',
  ['status', 'busyov', 'printReport', 'modale']
    .every(id => B.doc.getElementById(id).parentNode === B.doc.body),
  ['status', 'busyov', 'printReport', 'modale']
    .filter(id => B.doc.getElementById(id).parentNode !== B.doc.body).join(','));

t('a l\'ouverture, « Ma journee » est affichee et les ventes masquees',
  !B.journee.hidden && B.ventes.hidden);
t('rien n\'est charge avant le premier clic', B.charges.length === 0, B.charges.join(' '));

B.clic('clients');
t('un clic sur « Mes clients » masque la journee et montre les ventes',
  B.journee.hidden && !B.ventes.hidden);
t('l\'adresse suit', B.window.location.hash === '#clients', B.window.location.hash);
t('la piece cliquee devient la piece active',
  B.doc.querySelector('.bureau-nav__ligne[data-piece="clients"] .bureau-nav__item--actif') !== null);
await B.repos();
/* L'ORDRE EST UNE CONDITION, pas une preference : bdv-ecrans.js lit des variables de
   bdv-base.js des son analyse, et le moteur doit donc etre entierement la avant lui. Ce
   controle est ce qui empechera de « paralleliser pour aller plus vite » un jour. */
const ATTENDU = [
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
  '/js/bdv-sync.js',
  '/js/bdv-base.js',
  '/css/bdv-ecrans.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  '/js/bdv-ecrans.js'
].join(' | ');
t('le moteur puis les ecrans, dans cet ordre',
  B.charges.join(' | ') === ATTENDU, B.charges.join(' | ') || '(aucune)');
t('les ecrans sont demarres sur la bonne piece',
  JSON.stringify(B.appels) === '[{"ecran":"clients"}]', JSON.stringify(B.appels));

B.clic('produits');
await B.repos();
t('un second clic ne recharge RIEN', B.charges.length === 7, B.charges.length + ' ressources');
t('mais il navigue',
  JSON.stringify(B.appels[1]) === '{"ecran":"produits"}', JSON.stringify(B.appels[1]));

B.clic('journee');
t('revenir a « Ma journee » remontre la journee et masque les ventes',
  !B.journee.hidden && B.ventes.hidden);
t('et vide l\'adresse', B.window.location.hash === '', B.window.location.hash);

B.clic('reglages');
t('« Mes reglages » ouvre le panneau',
  B.appels.some(a => a.panneau));
t('« Mes reglages » ne change pas d\'ecran : le panneau s\'ouvre par-dessus',
  !B.journee.hidden && B.ventes.hidden);
t('et n\'ecrit rien dans l\'adresse', B.window.location.hash === '', B.window.location.hash);

/* ======================= LE MOTEUR A LA DEMANDE ======================= */
titre('Le moteur de la base, charge au besoin');

const M = bureau();
t('a l\'ouverture du bureau, le moteur n\'est PAS charge',
  M.charges.length === 0, M.charges.join(' | '));

M.clic('reglages');
await M.repos();
t('ouvrir les reglages charge le moteur, et lui seul',
  M.charges.join(' | ') === ['https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
    '/js/bdv-sync.js', '/js/bdv-base.js'].join(' | '), M.charges.join(' | '));
t('le panneau s\'ouvre AVANT le moteur : il ne fait pas attendre pour « Toi »',
  M.appels[0] && M.appels[0].panneau === true, JSON.stringify(M.appels[0]));
t('puis il se rafraichit quand le moteur est la',
  M.appels.some(a => a.rafraichi), JSON.stringify(M.appels));

/* LES TROIS BOUTONS DES REGLAGES passent par le meme point d'entree. C'est ce controle-ci
   qui a trouve la panne : le bouton de la barre ouvrait le panneau sans demander le
   moteur, et « Ma base » restait vide sans une erreur pour le dire. */
const R1 = bureau();
R1.doc.getElementById('bureauNavPlier');
R1.clic('reglages');
await R1.repos();
const R2 = bureau('#base');
await R2.repos();
t('le bouton de la barre et l\'adresse #base demandent tous deux le moteur',
  R1.charges.length === 3 && R2.charges.length === 3,
  'barre : ' + R1.charges.length + ', adresse : ' + R2.charges.length);
t('et tous deux rafraichissent le panneau une fois le moteur la',
  R1.appels.some(a => a.rafraichi) && R2.appels.some(a => a.rafraichi));

M.clic('clients');
await M.repos();
t('ouvrir ensuite un ecran de vente ne recharge pas le moteur',
  M.charges.filter(c => c === '/js/bdv-base.js').length === 1,
  M.charges.filter(c => c === '/js/bdv-base.js').length + ' fois');
t('et il charge bien les ecrans par-dessus',
  M.charges.length === 7, M.charges.length + ' ressources');

/* Le libelle de la piece suit l'exercice comptable, et il doit etre juste DES LE PREMIER
   AFFICHAGE : un libelle qui change sous la souris une seconde apres le chargement se
   remarque plus qu'un libelle un peu generique. */
const EX = new JSDOM(HTML, { runScripts: 'outside-only', pretendToBeVisual: true,
  url: 'https://x.test/mon-bureau/' });
EX.window.localStorage.setItem('bdv_exercice_v1', '4');
EX.window.eval(NAV);
EX.window.BdvNav.monter(EX.window.document.getElementById('bureauNav'), 'journee');
t('un domaine dont l\'exercice commence en avril lit « Mon exercice », sans le moteur',
  EX.window.document.querySelector('.bureau-nav__ligne[data-piece="annee"] .bureau-nav__nom')
    .textContent === 'Mon exercice',
  EX.window.document.querySelector('.bureau-nav__ligne[data-piece="annee"] .bureau-nav__nom').textContent);

/* ---- l'adresse d'arrivee fait foi ---- */
titre('L\'adresse d\'arrivee');
const C = bureau('#clients');
t('un favori sur #clients ouvre les clients, pas la journee',
  C.journee.hidden && !C.ventes.hidden);
await C.repos();
t('et demarre les ecrans dessus',
  JSON.stringify(C.appels) === '[{"ecran":"clients"}]', JSON.stringify(C.appels));

const D = bureau('#client=DOMAINE%20X');
await D.repos();
t('#client=... ouvre la fiche du client, pas seulement la liste',
  JSON.stringify(D.appels) === '[{"client":"DOMAINE X"}]', JSON.stringify(D.appels));

await new Promise(r => setTimeout(r, 60));
const E = bureau('#base');
t('#base ouvre le panneau et laisse la journee affichee',
  E.appels.some(a => a.panneau) && !E.journee.hidden);

const F = bureau('#nimportequoi');
t('une adresse inconnue retombe sur « Ma journee » sans rien charger',
  !F.journee.hidden && F.ventes.hidden && F.charges.length === 0);

/* ---- les liens du bureau ---- */
titre('Les liens du bureau');
const G = bureau();
const faux = G.doc.createElement('a');
faux.href = '/mon-bureau/#annee';
faux.textContent = 'vers mon exercice';
G.doc.getElementById('bureauJournee').appendChild(faux);
faux.dispatchEvent(new G.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
t('un lien du bureau vers une piece est intercepte, sans rechargement',
  G.journee.hidden && !G.ventes.hidden && G.window.location.hash === '#annee',
  G.window.location.hash);

const H = bureau();
const fiche = H.doc.createElement('a');
fiche.href = '/mon-bureau/#client=JAYAMA';
H.doc.getElementById('bureauJournee').appendChild(fiche);
fiche.dispatchEvent(new H.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
await H.repos();
t('un lien de fiche client ouvre la fiche',
  JSON.stringify(H.appels) === '[{"client":"JAYAMA"}]', JSON.stringify(H.appels));

const I = bureau();
const nouvelOnglet = I.doc.createElement('a');
nouvelOnglet.href = '/mon-bureau/#annee';
I.doc.getElementById('bureauJournee').appendChild(nouvelOnglet);
nouvelOnglet.dispatchEvent(new I.window.MouseEvent('click',
  { bubbles: true, cancelable: true, button: 0, metaKey: true }));
t('cmd-clic est laisse au navigateur : c\'est une demande d\'autre onglet',
  !I.journee.hidden && I.ventes.hidden);

/* ---- le bouton Retour ---- */
titre('Le bouton Retour');
const J = bureau();
J.clic('clients');
await J.repos();
J.window.history.back();
await new Promise(r => setTimeout(r, 30));
t('Retour depuis un ecran de vente ramene a « Ma journee » sans quitter le bureau',
  !J.journee.hidden && J.ventes.hidden,
  'hash : ' + J.window.location.hash);

/* ======================= L'ANCIENNE ADRESSE ======================= */
titre("L'ancienne adresse du tableau de bord");
const REDIR = path.join(RACINE, '_site/outils/dashboard-vigneron/index.html');
if (!fs.existsSync(REDIR)) {
  t('la page de redirection est publiee', false, path.relative(RACINE, REDIR) + ' est absent');
} else {
  const html = fs.readFileSync(REDIR, 'utf8');
  t('la page de redirection ne contient plus l\'outil',
    !html.includes('id="app"') && html.length < 4000, html.length + ' octets');
  t('elle offre un lien de secours si le script ne prend pas',
    html.includes('href="/mon-bureau/"'));

  /* On extrait le script de la page et on l'execute avec un faux `location` : jsdom ne
     sait pas suivre une navigation, et son location.replace n'est pas remplacable. Ce
     qu'on verifie n'est de toute facon pas la navigation mais la TRADUCTION de l'adresse,
     seule chose que cette page ait a faire correctement. */
  const codeRedir = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1];
  t('la page porte bien un script de redirection', !!codeRedir);
  function ou(hash) {
    let vers = null;
    const faux = { hash: hash || '', replace: (u) => { vers = u; } };
    new Function('location', codeRedir)(faux);
    return vers;
  }
  t('sans fragment, elle mene au bureau', ou() === '/mon-bureau/', String(ou()));
  t('#clients garde son ecran', ou('#clients') === '/mon-bureau/#clients', String(ou('#clients')));
  t('#annee garde son ecran', ou('#annee') === '/mon-bureau/#annee', String(ou('#annee')));
  t('#client=JAYAMA garde sa fiche',
    ou('#client=JAYAMA') === '/mon-bureau/#client=JAYAMA', String(ou('#client=JAYAMA')));
  t('#parametres et #reglages menent tous deux au panneau, devenu #base',
    ou('#parametres') === '/mon-bureau/#base' && ou('#reglages') === '/mon-bureau/#base',
    ou('#parametres') + ' / ' + ou('#reglages'));
  t('un fragment inconnu ne fabrique pas une adresse inconnue',
    ou('#nimportequoi') === '/mon-bureau/', String(ou('#nimportequoi')));
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BUREAU NE FAIT PAS CE QU\'IL DIT'); process.exit(1); }
console.log('  LE BUREAU FAIT CE QU\'IL DIT');
