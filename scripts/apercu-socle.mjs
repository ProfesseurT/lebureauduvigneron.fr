/* ============================================================================
   scripts/apercu-socle.mjs : LE MONTAGE COMMUN DES APERCUS, 22/09/2026

   POURQUOI IL EXISTE. Le meme montage etait ecrit dans huit fichiers : lire les
   feuilles, poser le lien des polices, poser `bdv-coque` sur le corps de page,
   rendre chaque etat dans les DEUX themes, et chercher les mots vides. Copie a
   l'identique, il portait ses defauts a l'identique, et les corriger d'un cote
   n'en corrigeait aucun de l'autre : c'est mot pour mot ce que le bloc de tete
   de scripts/bureau-garni.mjs raconte pour le decor, et ce que lot9-sonde-rendu
   raconte pour la sonde de contraste, qui etait recopiee QUATRE fois et dont
   les trois copies anterieures portent encore un defaut de comptage.

   RELEVE DU 22/09/2026, AVANT CE FICHIER, feuilles posees par chaque apercu :

       apercu-ardoise    style.css SEULE
       apercu-mot        style.css SEULE
       apercu-panneau    style.css SEULE
       apercu-modale     3 sur 4 (il manquait bdv-poste.css)
       apercu-fiche      3 sur 5 (il manquait bdv-poste.css et bdv-bureau.css)

   Depuis la scission du 21/09/2026, `style.css` ne porte plus les regles du
   bureau : elles vivent dans `bdv-poste.css` et `bdv-bureau.css`. Les trois
   premiers rendaient donc des ecrans NUS, et ne le disaient pas.

   CE QU'IL NE FAIT PAS : il ne verifie rien. Les apercus MONTRENT, ils ne
   verifient pas, et aucun n'est dans `npm run verif`. Ce qui les tient, c'est
   `npm run banc:apercus`, qui compare ce qu'ils posent a ce que la page
   CONSTRUITE charge.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { RACINE, PAGE_BUREAU, feuillesLiees, estFeuilleJs } from './feuilles-bureau.mjs';

export { RACINE, PAGE_BUREAU };

/* LES QUATRE FEUILLES DU BUREAU, DANS L'ORDRE OU LE GABARIT LES LIE, ET ELLES
   NE SONT PAS ECRITES ICI : elles sont relues sur la page construite a chaque
   appel. Un apercu ne peut donc plus se perimer quand une feuille arrive ou
   demenage, et c'est la seule forme de garde-fou qui ne s'oublie pas. */
export const FEUILLES_BUREAU = feuillesLiees();

export const POLICES = 'https://fonts.googleapis.com/css2?'
  + 'family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400'
  + '&family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400'
  + '&family=JetBrains+Mono:wght@400;500;600&family=Caveat:wght@400;500&display=swap';

export const TETE_POLICES = '<link rel="preconnect" href="https://fonts.googleapis.com">'
  + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  + '<link href="' + POLICES + '" rel="stylesheet">';

/* LES FEUILLES EN PLUS VIENNENT APRES LES QUATRE, ET C'EST L'ORDRE DU PRODUIT :
   bdv-ecrans.css, bdv-panneau.css et bdv-calendrier.css sont posees par du code
   dans le `<head>`, donc APRES les feuilles du gabarit. Les poser avant ferait
   mentir l'apercu dans le sens le plus dangereux, celui qui declare vert un
   recouvrement mort. */
export function cssBureau(enPlus = []) {
  for (const f of enPlus) {
    if (!estFeuilleJs(f)) throw new Error('feuille inconnue du bureau : ' + f
      + ' (les feuilles posees en JavaScript sont nommees dans scripts/feuilles-bureau.mjs)');
  }
  return FEUILLES_BUREAU.concat(enPlus)
    .map(f => fs.readFileSync(path.join(RACINE, f), 'utf8')).join('\n');
}

export function exigerLaPageConstruite() {
  if (!fs.existsSync(PAGE_BUREAU)) {
    console.error('\n  _site/mon-bureau/index.html est absent : lance npm run build d\'abord.\n');
    process.exit(2);
  }
  return fs.readFileSync(PAGE_BUREAU, 'utf8');
}

export async function chargerJsdom() {
  try { return (await import('jsdom')).JSDOM; }
  catch (e) { console.error('\n  jsdom est absent : npm install --save-dev jsdom\n'); process.exit(2); }
}

/* LE HARNAIS, ET RIEN QUE LUI. Ces regles decrivent la planche, jamais l'ecran
   qu'on vient juger.

   IL FAUT REDIRE LE FOND ET L'ENCRE SUR CHAQUE COLONNE, et l'apercu de
   « L'equipe » l'a prouve au premier passage le 21/09/2026 : un conteneur
   `data-theme` retourne les JETONS de son sous-arbre, mais pas les proprietes
   deja CALCULEES au-dessus. La couleur que `body.bdv-coque` pose sur le corps
   de page est resolue avec les valeurs CLAIRES, et cette encre-la descend telle
   quelle dans le conteneur sombre : les noms des equipiers, qui vivaient
   d'heritage, sortaient en #33383F sur un fond sombre.

   ET LA COLONNE DU RAIL EST RETIREE, une seule fois et en le disant. La barre
   des pieces est peinte par bdv-nav.js, qu'aucun apercu ne charge : garder sa
   colonne de 184 px laisserait une gouttiere vide devant chaque etat et
   retrecirait d'autant ce qu'on vient regarder. C'est la seule chose que cette
   planche change au dessin, et elle ne touche a aucune couleur. */
export const CSS_PLANCHE = 'body{background:var(--bdv-fond);margin:0;padding:2rem 1rem}'
  + '.ap{max-width:1500px;margin:0 auto}'
  + '.ap__t{font-family:var(--font-titre);color:var(--bdv-encre-1);margin:2.5rem 0 .2rem;font-size:1.25rem}'
  + '.ap__q{margin:0 0 .9rem;color:var(--bdv-encre-3);max-width:74ch;font-size:.92rem;line-height:1.6}'
  + '.ap__duo{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;align-items:start}'
  + '@media (max-width:1100px){.ap__duo{grid-template-columns:1fr}}'
  + '.ap__b{padding:1rem;border-radius:8px;background:var(--bdv-fond);'
  + 'color:var(--bdv-encre-2);outline:1px solid var(--bdv-trait)}'
  + '.ap__l{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;'
  + 'letter-spacing:.09em;color:var(--bdv-encre-4);margin:0 0 .6rem}'
  + '.ap__b .bureau-atelier{grid-template-columns:minmax(0,1fr)}';

/* L'ENVELOPPE PAR DEFAUT EST L'ANCETRE REELLE DE LA PAGE, et ce n'est pas du
   zele : `.bdv-coque .bureau-atelier__travail > .bureau-plan` et
   `.bdv-coque .bureau-atelier a:not([class])` ne s'appliquent qu'a cette
   profondeur-la. Une zone posee sur une largeur libre ne peut pas montrer le
   defaut du 14/09/2026, ou une `.zone` sans `grid-column` est tombee dans UNE
   colonne sur douze et s'est ecrite une lettre par ligne. */
export const ENVELOPPE_PLAN = (html) => '<div class="bureau-atelier">'
  + '<div class="bureau-atelier__travail"><div class="bureau-plan">' + html + '</div></div></div>';

export const SANS_ENVELOPPE = (html) => html;

/* LES DEUX THEMES COTE A COTE, ET C'EST LE SEUL MOYEN DE LES JUGER SUR LE MEME
   ECRAN. La forme sans `:root` des blocs 1 et 3 de bdv-theme.css existe POUR
   CA : un CONTENEUR qui redeclare les jetons retourne tout son sous-arbre,
   champs natifs compris, puisque `color-scheme` est pose sur `[data-theme]`
   aussi. */
export function planche(opts) {
  const enveloppe = opts.enveloppe || ENVELOPPE_PLAN;
  const corps = opts.vues.map(v =>
    '<h2 class="ap__t">' + v.titre + '</h2>'
    + (v.note ? '<p class="ap__q">' + v.note + '</p>' : '')
    + '<div class="ap__duo">'
    + [['light', 'clair'], ['dark', 'sombre']].map(([t, nom]) =>
        '<div class="ap__b" data-theme="' + t + '"><p class="ap__l">' + nom + '</p>'
        + enveloppe(v.html) + '</div>').join('')
    + '</div>').join('');
  /* LE CORPS PORTE `bdv-coque`, ET SANS LUI L'APERCU EST UN MENSONGE : tout le
     dessin du bureau est scope par cette classe, que src/_includes/base.njk
     pose sur le <body> du seul /mon-bureau/. Sans elle, ni bouton, ni champ, ni
     zone, ni rangee.

     ET IL PORTE `bdv-poste`, QUI EST L'ETAT DE SESSION, PARCE QUE TOUS CES
     ECRANS-LA SONT CEUX D'UN VIGNERON CONNECTE. Mesure du 22/09/2026 : sans
     cette classe, AUCUNE des regles telephone ne s'applique, puisqu'elles
     s'ecrivent toutes `body.bdv-poste ...` sous 700 px (regle du 11/09/2026,
     « le site public sort du bureau »). La sonde de rendu declarait alors
     quinze cibles sous 44 px sur la modale et quatre sur le panneau, a 390 px,
     qui n'existent pas dans le produit : un harnais qui ne porte pas l'etat de
     la vraie page invente des defauts, ce qui coute autant que d'en laisser
     passer. `poste: false` existe pour un ecran vu SANS session, et il faut
     savoir pourquoi on l'ecrit. */
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + opts.titre + '</title>'
    + TETE_POLICES
    + '<style>' + cssBureau(opts.enPlus || []) + '</style>'
    + '<style>' + CSS_PLANCHE + (opts.css || '') + '</style>'
    + '</head><body class="' + (opts.poste === false ? 'bdv-coque' : 'bdv-coque bdv-poste') + '"><div class="ap">'
    + '<h1 class="ap__t">' + opts.titre + '</h1>'
    + (opts.intro ? '<p class="ap__q">' + opts.intro + '</p>' : '')
    + corps + '</div></body></html>';
}

export function ecrire(nom, page) {
  fs.mkdirSync(path.join(RACINE, '_apercu'), { recursive: true });
  fs.writeFileSync(path.join(RACINE, '_apercu/' + nom), page);
  console.log('  ecrit : _apercu/' + nom + '  (' + Math.round(page.length / 1024) + ' ko)');
}

/* CE QUE LA MESURE PEUT DIRE SANS L'IMAGE : les mots vides. Un NaN, un
   undefined ou un « null » dans du texte rendu est un defaut qu'on ne voit pas
   en regardant vite, et `apercu:fiche` a MONTRE « domaine NaN € » pendant des
   jours sans que personne ne le lise. */
export function motsVides(htmls, mots = ['NaN', 'undefined', 'null', '[object', 'Invalid Date']) {
  const texte = htmls.join(' ').replace(/<[^>]+>/g, ' ');
  const sales = mots.filter(m => texte.indexOf(m) >= 0);
  console.log(sales.length ? '  ALERTE : ' + sales.join(', ') + ' dans le texte rendu'
                           : '  aucun mot vide dans le texte rendu');
  return sales;
}
