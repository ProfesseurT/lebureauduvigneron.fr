/* ============================================================================
   banc-tiroir.mjs, 23/09/2026

   LE TIROIR EST LA SEULE CHOSE DU BUREAU DONT LE SEUIL SOIT ECRIT DES DEUX
   COTES : une media query dans src/css/bdv-bureau.css, une constante dans
   src/js/bdv-ecrans.js. Une media query ne se lit pas depuis le JavaScript, et
   poser un temoin dans le CSS pour se faire lire aurait ete un jeton de plus a
   tenir a la main, c'est-a-dire la mecanique exacte de la derive que
   `npm run banc:jetons` existe pour attraper.

   CE QUI ARRIVE SI LES DEUX DIVERGENT, ET C'EST SILENCIEUX DES DEUX COTES :
   - le JS croit au tiroir avant le CSS : la classe est posee, le retrait n'est
     pas applique, et la fiche se peint en modale SANS son voile et SANS son
     piege a focus, c'est-a-dire une boite qui couvre la liste et qu'on peut
     quitter au clavier sans le voir ;
   - le CSS croit au tiroir avant le JS : la fiche se range a droite en gardant
     `aria-modal`, le defilement du corps de page reste bloque, et la liste est
     visible, annoncee comme absente, et figee.
   Aucun des deux ne leve, aucun ne se voit sur une capture prise a une seule
   largeur. D'ou ce banc, sur le modele de `npm run courrier:verif` : le depot a
   deja tranche cette question une fois, et la reponse etait un banc plutot
   qu'une convention.

   Il lit les SOURCES et pas la page construite : il n'y a rien a construire
   pour comparer deux nombres, et le faire dependre d'un build le rendrait
   inutilisable exactement les jours ou le build est casse.
   ========================================================================== */
import fs from 'node:fs';

const CSS    = 'src/css/bdv-bureau.css';
const NAV    = 'src/js/bdv-nav.js';      // LE module qui decide, depuis le lot 2
const FICHE  = 'src/js/bdv-ecrans.js';   // la fiche client
const TACHE  = 'src/js/bdv-taches.js';   // la modale d'une tache
let echecs = 0;
const t = (nom, ok, detail) => {
  console.log((ok ? '  OK   ' : '  ECHEC') + ' ' + nom + (ok || !detail ? '' : '\n         ' + detail));
  if (!ok) echecs++;
};

console.log('\nLE TIROIR : le seuil, le jeton, le contrat, et UN SEUL endroit qui decide\n');

const css   = fs.readFileSync(CSS, 'utf8');
const nav   = fs.readFileSync(NAV, 'utf8');
const fiche = fs.readFileSync(FICHE, 'utf8');
const tache = fs.readFileSync(TACHE, 'utf8');

/* -- 1. LES DEUX SEUILS. On prend la media query qui ENVELOPPE la section 22,
      pas la premiere du fichier : il y en a une quarantaine avant elle. */
const sec = css.split('22. LE TIROIR')[1] || '';
t('la section 22 du tiroir existe dans ' + CSS, sec.length > 0);

const mq = sec.match(/@media\s*\(min-width:\s*(\d+)px\)/);
t('elle est bornee par une media query de largeur minimale', !!mq);

const cst = nav.match(/var\s+TIROIR_SEUIL\s*=\s*(\d+)/);
t('TIROIR_SEUIL est declare dans ' + NAV, !!cst);

if (mq && cst) {
  t('les deux seuils sont le meme nombre',
    mq[1] === cst[1],
    'CSS ' + mq[1] + 'px contre JS ' + cst[1] + 'px. Voir le bloc de tete de ce banc pour ce que chacun des deux sens casse.');
}

/* -- 2. LE PLANCHER MESURE. Releve au navigateur le 23/09/2026 sur la page
      construite : rail 184, retraits 24 de chaque cote, et les requetes de
      conteneur du sous-main replient la liste en fiches sous 40 rem, 640 px.
      Un seuil pose plus bas fait replier la liste au moment ou l'on ouvre un
      client, c'est-a-dire qu'un geste de LECTURE changerait la mise en page de
      ce qu'on lit. Ce controle est ce qui empeche de baisser le seuil « pour
      que le tiroir marche aussi sur le portable », sans refaire le calcul. */
const RAIL = 184, RETRAITS = 48, REPLI = 640;
const jeton = fs.readFileSync('src/css/bdv-theme.css', 'utf8').match(/--bdv-tiroir:\s*(\d+)px/);
t('le jeton --bdv-tiroir est declare dans bdv-theme.css', !!jeton);

if (mq && jeton) {
  const seuil = +mq[1], largeur = +jeton[1];
  const reste = seuil - RAIL - RETRAITS - largeur;
  t('au seuil, la liste reste au-dessus du repli en fiches',
    reste >= REPLI,
    'a ' + seuil + 'px de fenetre il reste ' + reste + 'px a la liste, et elle se replie sous ' + REPLI + 'px.');
  console.log('         (marge mesuree au seuil : ' + (reste - REPLI) + ' px)');
}

/* -- 3. LE JETON EST UNE ECHELLE, DONC IL NE SE RETOURNE PAS. Une longueur qui
      apparaitrait dans un bloc sombre ferait deja echouer la section 4 de
      `npm run banc:jetons` ; on le redit ici parce que c'est le genre de ligne
      qu'on ajoute « par symetrie » en relisant la feuille de theme. */
const theme = fs.readFileSync('src/css/bdv-theme.css', 'utf8');
t('--bdv-tiroir n\'est declare qu\'une fois, dans le bloc clair',
  (theme.match(/--bdv-tiroir:/g) || []).length === 1);

/* -- 4. LE CONTRAT ARIA. Les trois defaits sont ce qui separe un tiroir d'une
      modale, et chacun se paie a la synthese vocale ou au clavier, jamais a
      l'image : aucune capture ne montre un `aria-modal` de trop. */
t('le mode tiroir retire aria-modal', /removeAttribute\(\s*['"]aria-modal['"]\s*\)/.test(nav));
t('le mode tiroir rend le defilement du corps de page',
  /document\.body\.style\.overflow\s*=\s*actif\s*\?\s*''/.test(nav));
t('le piege a focus de la fiche se retire en mode tiroir',
  /if\(modeTiroir\(\)\)return;/.test(fiche));
t('la fiche ne vole le focus qu\'en modale',
  /if\(!modeTiroir\(\)\)\{\s*const btn/.test(fiche));
t('la tache ne vole le focus qu\'en modale, sauf si elle est neuve',
  /if \(!enTiroir \|\| s\.mode === 'neuve'\)/.test(tache));

/* -- 4 bis. LA DECISION EST A UN SEUL ENDROIT, ET C'EST TOUT LE LOT 2.
      Ted a demande « ok same pour les taches ». Le danger n'est pas d'avoir deux
      boites, c'est d'avoir deux endroits qui DECIDENT : deux seuils qui divergent
      au premier reglage, deux contrats ARIA dont un seul est defait, deux classes
      posees sur le corps de page qui se retirent l'une l'autre. Aucun des trois ne
      se voit a l'ecran. Ce controle est ce qui interdit a un futur lot de
      recopier un `matchMedia` dans le fichier ou il travaille. */
t('un seul matchMedia de seuil dans tout le depot',
  (fiche + tache).indexOf('matchMedia(\'(min-width:') === -1
  && (nav.match(/matchMedia\('\(min-width:/g) || []).length === 1,
  'la fiche ou la tache s\'est refabrique un seuil a elle.');
t('un seul TIROIR_SEUIL declare',
  !/TIROIR_SEUIL\s*=\s*\d/.test(fiche) && !/TIROIR_SEUIL\s*=\s*\d/.test(tache));
t('les deux boites passent par BdvTiroir.poser',
  /BdvTiroir\.poser\(/.test(fiche) && /BdvTiroir\.poser\(/.test(tache));
t('les deux boites passent par BdvTiroir.retirer',
  /BdvTiroir\.retirer\(\)/.test(fiche) && /BdvTiroir\.retirer\(\)/.test(tache));
t('BdvTiroir recoit la BOITE et pas la modale',
  /poser\(m\.querySelector\('\.modale__box'\)\)/.test(fiche)
  && /poser\(MOD\.querySelector\('\.tmod__boite'\)\)/.test(tache),
  'c\'est la boite qui porte aria-modal et role, pas le voile qui l\'entoure.');

/* -- 4 ter. LE CSS HABILLE LES DEUX. Une seule des deux habillee, et le bureau a
      deux comportements pour le meme geste, ce qui est precisement ce que le lot
      2 existe pour fermer. */
t('la section 22 habille la fiche client', /#modale\.on\{/.test(sec));
t('la section 22 habille la modale d\'une tache', /\.tmod\{/.test(sec));
t('les deux perdent leur voile',
  /#modale\.on \.modale__bg\{[^}]*display:none/.test(sec)
  && /\.tmod__voile\{[^}]*display:none/.test(sec));
t('les deux champs de date de la tache se remettent l\'un sous l\'autre',
  /\.tmod__duo\{[^}]*grid-template-columns:1fr/.test(sec),
  'deux inputs date dans 372 px debordent, ils ne se compriment pas.');

/* -- 5. LA CLASSE PART A LA FERMETURE. Sans ca, le retrait de l'atelier reste
      pose sur une fiche fermee : une colonne vide de 420 px a droite du bureau,
      et rien pour dire pourquoi. */
t('bdv-a-tiroir n\'est posee et retiree que par le module',
  /classList\.toggle\(['"]bdv-a-tiroir['"]/.test(nav)
  && /classList\.remove\(['"]bdv-a-tiroir['"]\)/.test(nav)
  && !/classList\.(add|remove|toggle)\(['"]bdv-a-tiroir['"]/.test(fiche)
  && !/classList\.(add|remove|toggle)\(['"]bdv-a-tiroir['"]/.test(tache));

console.log('\n' + (echecs ? echecs + ' ECHEC(S)' : 'LE TIROIR TIENT SES DEUX MOITIES, ET LES DEUX BOITES N\'EN FONT QU\'UNE') + '\n');
process.exit(echecs ? 1 : 0);
