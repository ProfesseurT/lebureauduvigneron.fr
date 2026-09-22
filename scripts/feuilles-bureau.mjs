/* ============================================================================
   scripts/feuilles-bureau.mjs : QUI CHARGE QUOI, ET A UN SEUL ENDROIT, 22/09/2026

   POURQUOI CE FICHIER EXISTE. Le bureau charge sept feuilles. Quatre sont LIEES
   par le gabarit et arrivent avant le premier rendu ; trois sont posees par du
   JavaScript, au geste qui en a besoin. Cette liste-la etait ecrite a la main
   dans scripts/charte.mjs, et les scripts d'apercu en tenaient chacun une copie
   PARTIELLE : au 22/09/2026, cinq d'entre eux posaient moins de feuilles que la
   page qu'ils montrent, et trois n'en posaient qu'UNE. Ils rendaient donc des
   ecrans NUS sans le dire. Le depot a paye ce defaut SIX fois : apercu:equipe
   (une journee entiere), apercu:invitation, apercu:amorce, apercu:modale,
   apercu:fiche, et les trois de ce lot.

   LA REGLE QUE CE FICHIER SERT :

     > Un apercu doit charger exactement ce que charge la page qu'il montre,
     > et c'est un banc qui le tient, pas une convention.

   LES QUATRE FEUILLES LIEES NE SONT PAS ECRITES ICI, ELLES SONT LUES SUR LA
   PAGE CONSTRUITE. Une deuxieme liste tenue a la main ment le jour ou on
   l'oublie, et c'est exactement la lecon que ce depot repete. La verite est
   dans `_site/mon-bureau/index.html` : ce que le navigateur charge vraiment, et
   dans l'ORDRE ou il le charge, qui est une condition et pas une preference
   (bdv-poste.css est liee ENTRE style.css et bdv-bureau.css, et l'inverser
   retournerait la moitie des arbitrages du chantier des deux themes).

   LES TROIS FEUILLES POSEES EN JAVASCRIPT, elles, ne sont dans aucun HTML :
   aucune lecture du document ne les trouvera. Elles sont donc NOMMEES A LA
   MAIN, ici, une seule fois, et `scripts/charte.mjs` les lit d'ici depuis le
   22/09/2026 au lieu d'en porter sa propre copie.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAGE_BUREAU = path.join(RACINE, '_site/mon-bureau/index.html');

/* LES FEUILLES QUE DU CODE POSE, avec QUI les pose et QUAND : c'est ce qui
   decide si un apercu a besoin de l'une d'elles. Une feuille oubliee ici
   echappe entierement au controle de la charte, et rien ne le signale. */
export const FEUILLES_JS = [
  { fichier: 'src/css/bdv-ecrans.css',
    posee: 'bdv-nav.js, au premier clic sur une piece de vente',
    portee: '.bdv-ventes' },
  { fichier: 'src/css/bdv-panneau.css',
    posee: 'bdv-reglages.js, a l\'ouverture du panneau',
    portee: '.bdvr-panneau' },
  { fichier: 'src/css/bdv-calendrier.css',
    posee: 'bdv-nav.js, au premier clic sur « Le calendrier »',
    portee: '.bdv-cal' }
];

/* LES FEUILLES LIEES, LUES SUR LA PAGE CONSTRUITE. On ne garde que les href
   LOCAUX : le lien Google Fonts n'est pas une feuille de ce depot, et il est
   pose au milieu des quatre dans le gabarit.
   ELLE CRIE SI LE BUILD MANQUE, elle ne se tait pas : un controle qui ne peut
   pas s'executer doit crier, c'est la regle du 07/09/2026. */
export function feuillesLiees() {
  if (!fs.existsSync(PAGE_BUREAU)) {
    throw new Error('la page construite manque : lance « npm run build » d\'abord ('
      + path.relative(RACINE, PAGE_BUREAU) + ')');
  }
  const html = fs.readFileSync(PAGE_BUREAU, 'utf8');
  const sorties = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel=["']stylesheet["']/i.test(m[0])) continue;
    const href = (m[0].match(/href=["']([^"']+)["']/i) || [])[1];
    if (!href || /^(https?:)?\/\//.test(href)) continue;
    const rel = 'src/' + href.replace(/^\//, '');
    if (!fs.existsSync(path.join(RACINE, rel))) {
      throw new Error('feuille liee par la page et introuvable sur le disque : ' + rel);
    }
    if (!sorties.includes(rel)) sorties.push(rel);
  }
  if (!sorties.length) throw new Error('aucune feuille locale liee par ' + path.relative(RACINE, PAGE_BUREAU));
  return sorties;
}

export const estFeuilleJs = (f) => FEUILLES_JS.some(x => x.fichier === f);
