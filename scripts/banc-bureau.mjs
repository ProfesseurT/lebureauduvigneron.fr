/* ============================================================================
   scripts/banc-bureau.mjs : le banc de la barre du bureau

     npm run build && npm run banc

   PREMIER TEST AUTOMATISE DU DEPOT, ecrit le 07/09/2026 au lot 1 de la fusion.
   Jusqu'ici « CONFORME » ne voulait dire que « la charte graphique tient »,
   jamais « ca marche ». Ce banc ne comble pas tout le trou, il couvre une
   piece : la barre de navigation du bureau.

   IL DEMANDE jsdom, qui n'est pas une dependance du site :

     npm install --save-dev jsdom

   Sans lui, le banc s'arrete en le disant, et il ne rend jamais un faux OK.
   C'est la lecon de charte:dash, qui a annonce CONFORME sur du vide deux fois
   en une journee : un controle qui ne peut pas s'executer doit crier, pas
   se taire.

   IL LIT LE HTML PRODUIT, `_site/mon-bureau/index.html`, et pas le gabarit :
   c'est ce fichier-la que le vigneron recoit. Lancer `npm run build` avant,
   sinon on controle la page d'hier. Le serveur `npm start` ne suffit pas
   toujours : il ne recopie pas src/js sur tous les evenements de fichier.
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

console.log('page  : ' + path.relative(RACINE, PAGE));
console.log('module: ' + path.relative(RACINE, MODULE) + '\n');

/* runScripts:'outside-only' : on n'execute AUCUN script de la page. Le bureau en
   charge huit, dont trois depuis un CDN. On monte la barre a la main dans le vrai
   HTML, ce qui teste ce qu'on veut tester et rien d'autre. */
const dom = new JSDOM(HTML, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/mon-bureau/' });
const { window } = dom;
const doc = window.document;

/* Le moteur de la base n'est pas charge ici : exMot() manque, et la barre doit
   quand meme se monter en disant « Mon exercice ». C'est le repli prevu dans
   motExercice(), et c'est deja un controle. */
window.eval(NAV);
const B = window.BdvNav;
t('le module s\'expose', !!B && typeof B.monter === 'function');

const nav = doc.getElementById('bureauNav');
const atelier = doc.getElementById('bureauAtelier');
t('la coque de l\'atelier existe dans le HTML produit', !!nav && !!atelier);
if (!B || !nav) { console.log('\n  banc interrompu : rien a monter.'); process.exit(1); }

B.monter(nav, 'journee');

const lignes = [...nav.querySelectorAll('.bureau-nav__ligne')];
t('sept pieces montees', lignes.length === 7, lignes.length + ' trouvee(s)');

const labels = lignes.map(l => l.querySelector('.bureau-nav__nom').textContent);
t('l\'ordre est celui de la journee',
  labels.join(' | ') === 'Ma journée | Mon exercice | Mes clients | Mes cuvées | Chercher | Le compte à rebours | Mes réglages',
  labels.join(' | '));

const actif = nav.querySelector('.bureau-nav__item--actif');
t('« Ma journee » est la piece active', actif && actif.textContent.includes('Ma journée'));
t('la piece active n\'est pas un lien', actif && actif.tagName === 'SPAN', actif && actif.tagName);
t('la piece active porte aria-current', actif && actif.getAttribute('aria-current') === 'page');

const liens = [...nav.querySelectorAll('a.bureau-nav__item')].map(a => a.getAttribute('href'));
t('les quatre pieces de vente pointent encore sur l\'ancienne page (etat du lot 1)',
  liens.filter(h => h.startsWith('/outils/dashboard-vigneron/#')).length === 4, liens.join(' '));
t('le compte a rebours pointe sur son outil', liens.includes('/outils/echeances/'), liens.join(' '));

const reg = nav.querySelector('[data-bdv-nav-panneau]');
t('les reglages sont un bouton, pas un lien', reg && reg.tagName === 'BUTTON');
let ouvert = 0;
window.ouvrirPanneauReglages = () => { ouvert++; };
reg.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
t('le bouton des reglages ouvre le panneau partage', ouvert === 1, 'appels : ' + ouvert);

/* Le title est tout ce qui reste d'une piece quand la barre est repliee sur ses
   icones : une piece sans title devient un pictogramme muet. */
const sansTitle = lignes.filter(l => !l.querySelector('[title]'));
t('chaque piece porte un title', sansTitle.length === 0, sansTitle.length + ' sans title');

/* ---------------- le repli ---------------- */
const plier = doc.getElementById('bureauNavPlier');
t('le bouton de repli existe', !!plier);
t('deplie au depart', !atelier.classList.contains('bureau-atelier--replie'));
plier.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
t('un clic replie', atelier.classList.contains('bureau-atelier--replie'));
t('la preference est ecrite sur la cle PARTAGEE avec le volet des ecrans de vente',
  window.localStorage.getItem('bdv_volet_replie') === '1',
  String(window.localStorage.getItem('bdv_volet_replie')));
t('le libelle accessible annonce l\'action a venir, pas l\'etat present',
  plier.getAttribute('aria-label') === 'Déplier le menu', plier.getAttribute('aria-label'));
plier.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
t('un second clic deplie', !atelier.classList.contains('bureau-atelier--replie'));
t('la preference suit', window.localStorage.getItem('bdv_volet_replie') === '0');

/* ---------------- le raccourci clavier ---------------- */
const frappe = (cible) => cible.dispatchEvent(
  new window.KeyboardEvent('keydown', { key: '[', bubbles: true, cancelable: true }));
frappe(doc.body);
t('le crochet ouvrant replie', atelier.classList.contains('bureau-atelier--replie'));
const champ = doc.createElement('input');
doc.body.appendChild(champ);
frappe(champ);
t('le crochet ouvrant ne fait RIEN pendant une saisie',
  atelier.classList.contains('bureau-atelier--replie'),
  'la barre a bouge alors qu\'on tapait un crochet dans un champ');

/* ---------------- sans Vitisoft ----------------
   Regle metier, pas cosmetique : les ecrans de vente lisent un export Vitisoft.
   Sans lui on ne montre pas la porte. C'est ce que faisait `tiroirDash`. */
B.sansVitisoft(true);
const cachees = lignes.filter(l => l.hidden).map(l => l.dataset.piece);
t('sans Vitisoft, les quatre pieces de vente disparaissent',
  cachees.slice().sort().join(',') === 'annee,chercher,clients,produits', cachees.join(','));
t('sans Vitisoft, la journee, le compte a rebours et les reglages RESTENT',
  ['journee', 'echeances', 'reglages'].every(id => !lignes.find(l => l.dataset.piece === id).hidden));
B.sansVitisoft(false);
t('avec Vitisoft, tout revient', lignes.filter(l => l.hidden).length === 0);

/* ---------------- le tiroir ---------------- */
const tiroir = doc.getElementById('zoneTiroir');
t('le tiroir est masque et vide, ses deux entrees sont montees dans la barre',
  !!tiroir && tiroir.hidden && tiroir.querySelectorAll('a').length === 0);
t('plus un seul lien en dur vers le tableau de bord dans le tiroir',
  !HTML.includes('id="tiroirDash"'));

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LA BARRE NE FAIT PAS CE QU\'ELLE DIT'); process.exit(1); }
console.log('  LA BARRE FAIT CE QU\'ELLE DIT');
