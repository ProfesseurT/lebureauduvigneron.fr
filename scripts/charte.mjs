/* ============================================================================
   scripts/charte.mjs : controle de conformite a la charte graphique.

     node scripts/charte.mjs           le CSS du site
     node scripts/charte.mjs --bureau  le bureau et ses ecrans de vente

   Ne modifie rien. Sortie 0 seulement si tout est conforme.

   Le controle qui compte le plus est le dernier : il confronte chaque
   font-weight demande par le CSS aux graisses reellement chargees par le lien
   Google Fonts. Une regle qui demande du 700 sur une fonte chargee en 400 et
   500 ne leve aucune erreur, elle produit des contours epaissis par le
   navigateur, sur toutes les pages a la fois. C'est arrive sur environ 376
   passages en gras des articles, et personne ne l'a vu pendant des mois.
   ============================================================================ */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as csstree from 'css-tree';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* `--dash` a ete renomme `--bureau` le 07/09/2026 au lot 2d : le tableau de bord n'existe
   plus comme page, ses ecrans sont des pieces du bureau. L'ancien nom est encore accepte,
   parce qu'il est dans les habitudes et dans les commandes qu'on se recopie. */
const DASH = process.argv.includes('--bureau') || process.argv.includes('--dash');

/* CE QUE `--bureau` CONTROLE, ET POURQUOI C'EST UNE PAGE CONSTRUITE.

   Le tableau de bord n'est plus un fichier autonome, et depuis le lot 2d il n'est plus
   une page du tout : ses ecrans sont des pieces de /mon-bureau/. La cible est donc le
   bureau, et c'est sa version PRODUITE, _site/mon-bureau/index.html, parce que le
   gabarit src/mon-bureau.njk ne porte pas ses propres feuilles de style : elles sont
   dans le layout. Lire le gabarit, c'est ne rien lire, et l'annoncer CONFORME.

   Il faut donc `npm run build` avant. Sans le fichier, ce script s'arrete en le disant
   plutot que de controler autre chose : deux fois dans la journee du 07/09/2026, ce
   controle a annonce CONFORME sur du vide, et deux fois pour une raison differente. */
const CIBLE = DASH ? path.join(RACINE, '_site/mon-bureau/index.html')
                   : path.join(RACINE, 'src/css/style.css');
if (DASH && !fs.existsSync(CIBLE)) {
  console.error('\n  ' + path.relative(RACINE, CIBLE) + ' est absent : lance npm run build d\'abord.');
  console.error('  Rien n\'a ete controle.\n');
  process.exit(2);
}
const APRES = CIBLE;
/* La page produite porte deja son lien Google Fonts, recopie du layout : on le lit la,
   et pas dans le gabarit, pour la meme raison que ci-dessus. */
const LIEN_FONTS = DASH ? CIBLE : path.join(RACINE, 'src/_includes/base.njk');

console.log('cible : ' + path.relative(RACINE, CIBLE));

/* La liste des fichiers de src/js, declaree ICI parce que trois sections en ont besoin
   et que la premiere est la section 5. La section 8 garde sa propre variable, qui lui
   sert a autre chose : compter les litterales CSS embarquees fichier par fichier. */
/* Les gabarits inclus par la page. Ajoute le 07/09/2026 au lot 2c : la coque des ecrans
   de vente est partie dans _includes/components/ecrans-vente.njk, et le controle des
   icones a immediatement declare disparue la fleche « Mon bureau », qui n'avait pas
   bouge d'un pixel. Un controle qui ne suit pas les demenagements du depot finit par
   accuser le depot. */
function inclusPar(fichier) {
  if (!fs.existsSync(fichier)) return [];
  const txt = fs.readFileSync(fichier, 'utf8');
  const out = [];
  for (const m of txt.matchAll(/\{%-?\s*include\s+["']([^"']+)["']/g)) {
    const f = path.join(RACINE, 'src/_includes', m[1]);
    if (fs.existsSync(f)) out.push(f);
  }
  return out;
}

const DOSSIER_JS_ = path.join(RACINE, 'src/js');
const fichiersJS_ = fs.existsSync(DOSSIER_JS_)
  ? fs.readdirSync(DOSSIER_JS_).filter(f => f.endsWith('.js')).map(f => path.join(DOSSIER_JS_, f))
  : [];

let ERR = 0, NOTES = 0;
const ok = m => console.log('  ok    : ' + m);
const ko = m => { ERR++; console.log('  ECHEC : ' + m); };
const note = m => { NOTES++; console.log('  note  : ' + m); };
const titre = t => console.log('\n== ' + t + ' ==');

/* ---------------------------------------------------------------------------
   Parsing
--------------------------------------------------------------------------- */
function parse(fichier) {
  const erreursHtml = [];
  let txt = fs.readFileSync(fichier, 'utf8');
  if (fichier.endsWith('.html')) {
    /* TOUS les blocs <style>, pas seulement le premier. Le tableau de bord en porte deux
       depuis que le verrou du compte est pose dans l'en-tete (04/09/2026), et la version qui
       ne lisait que le premier controlait UNE ligne en croyant controler le fichier entier :
       zero couleur en dur, zero jeton declare, et les 151 ECHEC qui en decoulaient tous.
       Un controle qui passe sur du vide est pire qu'un controle absent. */
    const blocs = [...txt.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]);

    /* Puis les feuilles LIEES par la page. Sans ca, depuis la sortie de
       /css/bdv-ecrans.css le 07/09/2026, ce controle lisait la seule ligne du verrou de
       compte et rendait le meme faux CONFORME qu'avant, pour une raison nouvelle. On ne
       suit que les href locaux : une feuille Google Fonts n'est pas notre charte. */
    const liees = [];
    for (const m of txt.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)) {
      const h = (m[0].match(/href=["']([^"']+)["']/i) || [])[1];
      if (!h || /^(https?:)?\/\//.test(h)) continue;
      const f = path.join(RACINE, 'src', h.replace(/^\//, ''));
      if (fs.existsSync(f)) liees.push(f);
      else erreursHtml.push('feuille liee introuvable : ' + h);
    }
    /* LES FEUILLES CHARGEES EN JAVASCRIPT. Elles ne sont pas dans le HTML, donc aucune
       lecture du document ne les trouvera, et pourtant elles s'appliquent a la page :
         - bdv-ecrans.css, posee par bdv-nav.js au premier clic sur une piece de vente ;
           elle porte huit jetons que le site n'a pas, dont --bordeaux-voile, appele par
           bdv-base.js. Sans elle, le controle les declare non declares, avec aplomb.
         - bdv-panneau.css, posee par bdv-reglages.js quand le panneau s'ouvre ;
         - bdv-calendrier.css, posee par bdv-nav.js au premier clic sur « Le calendrier »,
           ajoutee le 08/09/2026. Elle reutilise les classes `.echeance` de la page
           publique sous son scope `.bdv-cal` : oubliee ici, ses regles echapperaient
           entierement au controle, et personne ne le verrait.
       Nommees a la main : une feuille chargee par du code ne se devine pas, et une liste
       qui se devinerait toute seule finirait par ne plus rien surveiller. */
    if (DASH) {
      for (const f of ['src/css/bdv-ecrans.css', 'src/css/bdv-panneau.css',
                       'src/css/bdv-calendrier.css']) {
        const abs = path.join(RACINE, f);
        if (fs.existsSync(abs)) liees.push(abs);
        else erreursHtml.push('feuille chargee en JavaScript introuvable : ' + f);
      }
    }
    if (!blocs.length && !liees.length) erreursHtml.push('aucun CSS trouve dans ' + fichier + ' : ni bloc <style>, ni feuille liee');
    console.log('  CSS lu : ' + blocs.length + ' bloc(s) <style> + ' + liees.length + ' feuille(s) liee(s)'
      + (liees.length ? ' (' + liees.map(f => path.basename(f)).join(', ') + ')' : ''));
    txt = blocs.concat(liees.map(f => fs.readFileSync(f, 'utf8'))).join('\n');
  }
  const erreurs = erreursHtml;
  const ast = csstree.parse(txt, { positions: true, onParseError: e => erreurs.push(e.message + ' (ligne ' + e.line + ')') });
  const regles = [];
  const tokens = {};
  /* Une variable declaree sur un composant plutot que dans :root n'est PAS un jeton de charte,
     mais ce n'est pas une faute non plus : --tour vaut 0deg sur .postit, et mon-bureau.njk le
     repose punaise par punaise en JavaScript. Les compter a part evite de rendre un ECHEC sur
     une variable parfaitement declaree, la ou l'ECHEC doit rester reserve a la faute de frappe. */
  const locaux = {};
  const marche = (noeud, ctx) => {
    if (!noeud.children) return;
    noeud.children.forEach(ch => {
      if (ch.type === 'Atrule') {
        const c = ctx.concat('@' + ch.name + ' ' + (ch.prelude ? csstree.generate(ch.prelude) : ''));
        if (ch.block) marche(ch.block, c);
      } else if (ch.type === 'Rule') {
        const sel = csstree.generate(ch.prelude);
        const decls = [];
        ch.block.children.forEach(d => {
          if (d.type !== 'Declaration') return;
          decls.push({ prop: d.property, val: csstree.generate(d.value), ligne: d.loc ? d.loc.start.line : 0 });
          if (!d.property.startsWith('--')) return;
          if (sel === ':root') tokens[d.property] = csstree.generate(d.value);
          else locaux[d.property] = csstree.generate(d.value);
        });
        regles.push({ ctx: ctx.join(' >> '), sel, decls, ligne: ch.loc ? ch.loc.start.line : 0 });
      }
    });
  };
  marche(ast, []);
  return { txt, erreurs, regles, tokens, locaux };
}

const norme = s => s.replace(/\s*([,>+~])\s*/g, '$1').replace(/\s+/g, ' ').trim();

const B = parse(APRES);
if (B.erreurs.length) ko('le CSS ne parse pas : ' + B.erreurs[0]);

/* ---------------------------------------------------------------------------
   3 bis. UN COMMENTAIRE QUI AVALE DES REGLES
   ---------------------------------------------------------------------------
   Ajoute le 07/09/2026 parce que ca vient d'arriver, et que rien ne l'a vu. En
   inserant un bloc de regles j'ai laisse un `/* ---- TITRE ----` juste au-dessus
   de `.btn--geste { ... }` : le commentaire n'etait ferme que trente lignes plus
   bas, et il a mange le bloc entier. La feuille parse sans erreur, la charte
   restait CONFORME, et les boutons de geste avaient repris l'allure par defaut
   du navigateur, Arial 13 px sur 19 px de haut au lieu de 44.

   C'est la pire categorie de panne : elle ne casse rien, elle efface. Le
   controle est donc bete et sur : un commentaire qui contient un selecteur suivi
   d'une accolade et d'une declaration est un commentaire qui avale des regles.
   Une regle commentee doit etre supprimee, pas mise en conserve.
--------------------------------------------------------------------------- */
titre('3 bis. Commentaires qui avalent des regles');
{
  const brut = fs.readFileSync(APRES, 'utf8');
  const avales = [];
  const RE_COM = /\/\*[\s\S]*?\*\//g;
  const RE_REGLE = /[.#][A-Za-z][\w-]*[^{}]{0,200}\{[^{}]*[a-z-]+\s*:[^{}]*;/;
  let m;
  while ((m = RE_COM.exec(brut))) {
    if (RE_REGLE.test(m[0])) {
      const ligne = brut.slice(0, m.index).split('\n').length;
      avales.push([ligne, (m[0].match(RE_REGLE) || [''])[0].replace(/\s+/g, ' ').slice(0, 70)]);
    }
  }
  if (avales.length) avales.forEach(a =>
    ko('L' + a[0] + ' : un commentaire contient une regle CSS — « ' + a[1] + ' ». Il l\'avale.'));
  else ok('aucun commentaire ne contient de regle CSS');
}

titre('4. Valeurs en dur restantes');

const dur = { couleurs: [], textures: [], rayons: [], ls: [], durees: [], tailles: [] };
const RE_COULEUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/;

/* LES DEUX SEULES DISPENSES, ecrites ici pour qu'on puisse les compter.

   1. LES MAQUETTES PRODUIT. Le site montre Vitisoft et Vitimedia en maquette :
      ces blocs reproduisent la charte d'un autre, pas la notre. Ils sont deja
      dispenses de la regle du rayon, pour la meme raison.
   2. LES TEXTURES DE MATIERE. Un empilement de degrades qui imite le grain du
      liege n'a pas de couleur a tokeniser : il a une recette. Elle est comptee
      et affichee, mais elle ne fait pas echouer.

   Tout le reste, surface, encre, filet, ombre, doit passer par un jeton. Cette
   regle a ete posee le 07/09/2026 : elle etait ecrite dans le script mais le
   resultat n'etait jamais passe a ko(), et une couleur magenta de test est
   restee CONFORME. Un controle qui ne mord pas est un controle absent. */
const RE_MAQUETTE = /^\.(viti|vitisoft|vitimedia|dnav|dtool|dform|dchart|dcard|dkpi)[-_.]/;
const EST_TEXTURE = val => {
  /* Une recette de texture : au moins deux degrades, et rien d'autre que des
     degrades et des mots-cles. Un seul degre de degrade n'est pas une texture,
     c'est un fond, et un fond se tokenise. */
  const parts = (val.match(/(radial|linear|conic)-gradient\(/g) || []).length;
  return parts >= 2;
};

B.regles.forEach(r => {
  const sel = norme(r.sel);
  if (sel === ':root') return;
  r.decls.forEach(d => {
    if (RE_COULEUR.test(d.val)) {
      /* Une texture de matiere est un empilement de degrades : le grain du liege,
         la fibre du papier. Ses arrets ne se tokenisent pas un par un, mais elle
         reste comptee et affichee, jamais silencieuse. */
      if (d.prop === 'background-image' && EST_TEXTURE(d.val))
        dur.textures.push([sel, d.prop, d.val, d.ligne]);
      else dur.couleurs.push([sel, d.prop, d.val, d.ligne]);
    }
    if (d.prop === 'border-radius' && !/var\(|50%|^0$/.test(d.val)) dur.rayons.push([sel, d.val, d.ligne]);
    if (d.prop === 'letter-spacing' && !/var\(/.test(d.val) && d.val !== '0') dur.ls.push([sel, d.val, d.ligne]);
    if (/^transition(-duration)?$/.test(d.prop)) {
      const brut = (d.val.match(/(?<![\w.-])[0-9]*\.?[0-9]+m?s(?![\w-])/g) || []);
      brut.forEach(v => dur.durees.push([sel, v, d.ligne]));
    }
    if (d.prop === 'font-size' && !/var\(/.test(d.val)) dur.tailles.push([sel, d.val, d.ligne]);
  });
});

const couleursMaquette = dur.couleurs.filter(c => RE_MAQUETTE.test(c[0]));
const couleursFautives = dur.couleurs.filter(c => !RE_MAQUETTE.test(c[0]));
console.log('  couleurs en dur       : ' + dur.couleurs.length +
            '  (dont ' + couleursMaquette.length + ' en maquette produit tiers)');
couleursFautives.forEach(c => console.log('        L' + c[3] + '  ' + c[0] + ' { ' + c[1] + ': ' + c[2] + ' }'));
console.log('  textures de matiere   : ' + dur.textures.length + '  (recettes de degrades, dispensees)');
dur.textures.forEach(c => console.log('        L' + c[3] + '  ' + c[0]));
console.log('  rayons non ronds      : ' + dur.rayons.length);
dur.rayons.forEach(c => console.log('        L' + c[2] + '  ' + c[0] + ' { border-radius: ' + c[1] + ' }'));
console.log('  letter-spacing en dur : ' + dur.ls.length);
dur.ls.forEach(c => console.log('        L' + c[2] + '  ' + c[0] + ' { letter-spacing: ' + c[1] + ' }'));
console.log('  durees en dur         : ' + dur.durees.length);
dur.durees.forEach(c => console.log('        L' + c[2] + '  ' + c[0] + ' -> ' + c[1]));
console.log('  font-size en dur      : ' + dur.tailles.length +
            '  (dont ' + dur.tailles.filter(t => /px/.test(t[1])).length + ' en px, maquettes produit)');

/* Seuils : ce que la passe de corrections s'engage a tenir. */
/* Un letter-spacing NEGATIF n'est pas un ecartement d'etiquette, c'est le
   resserrement optique d'un grand titre. Les trois tokens ne le couvrent pas. */
const lsEcartement = dur.ls.filter(c => !String(c[1]).trim().startsWith('-'));
if (lsEcartement.length > 1) ko(lsEcartement.length + ' letter-spacing en dur hors table de correspondance');
else ok('letter-spacing : ' + lsEcartement.length + ' valeur en dur, plus ' +
        (dur.ls.length - lsEcartement.length) + ' resserrement(s) de titre, hors table');
const dureesReelles = dur.durees.filter(d => !/0\.01ms/.test(d[1]));
if (dureesReelles.length) ko(dureesReelles.length + ' duree(s) de transition en dur');
else ok('aucune duree de transition en dur hors prefers-reduced-motion');
if (couleursFautives.length) {
  couleursFautives.slice(0, 12).forEach(c =>
    ko('couleur en dur : ' + c[0] + ' { ' + c[1] + ' } L' + c[3] + ' — il lui faut un jeton'));
  if (couleursFautives.length > 12) ko('et ' + (couleursFautives.length - 12) + ' autre(s) couleur(s) en dur');
} else ok('aucune couleur en dur hors maquette produit et texture de matiere');

/* LES TAILLES DE POLICE : un plafond, pas une porte fermee. 95 valeurs en dur
   ne se reprennent pas en une passe, et la moitie vit dans les maquettes. Ce
   qu'on interdit, c'est que ca EMPIRE. Le jour ou le chantier des tailles se
   fait, on baisse ce nombre ; il ne doit jamais monter.

   Deux plafonds parce que deux cibles : le site seul, et le bureau qui charge en
   plus bdv-ecrans.css et bdv-panneau.css. Un seul chiffre ferait echouer l'un ou
   dispenserait l'autre. */
/* 94 et 122 depuis le 07/09/2026 : l'ardoise a rendu son `font-size: 1.5rem`
   pour --t-h3. Le plafond baisse avec chaque valeur reprise, il ne remonte
   jamais. */
const PLAFOND_TAILLES = DASH ? 122 : 94;
if (dur.tailles.length > PLAFOND_TAILLES)
  ko(dur.tailles.length + ' font-size en dur, le plafond est a ' + PLAFOND_TAILLES +
     ' — une nouvelle taille en dur a ete ajoutee, il lui faut un pas de l\'echelle');
else ok('font-size en dur : ' + dur.tailles.length + ' sous le plafond de ' + PLAFOND_TAILLES);

const rayonsHorsMaquette = dur.rayons.filter(r => !/^\.(viti|vitisoft|vitimedia)/.test(r[0]));
if (rayonsHorsMaquette.length) ko(rayonsHorsMaquette.length + ' rayon(s) hors maquette produit tiers');
else ok('les ' + dur.rayons.length + ' rayons restants sont tous dans les maquettes .viti* / .vitimedia*');

/* ---------------------------------------------------------------------------
   5. Tokens
--------------------------------------------------------------------------- */
titre('5. Tokens declares, tokens appeles');
const declares = new Set(Object.keys(B.tokens));
const appeles = new Set();
for (const m of B.txt.matchAll(/var\(\s*(--[\w-]+)/g)) appeles.add(m[1]);

/* Le tableau de bord lit ses couleurs de serie depuis le JS, pas depuis une
   regle CSS : sans ca, les huit --serie-* passeraient pour inutilisees. */
if (DASH) {
  /* cssToken() et palSeries() vivaient dans le <script> de la page. Depuis le lot 0 ils
     sont dans src/js/bdv-ecrans.js et src/js/bdv-base.js : il faut lire la page ET les
     fichiers de src/js, sinon les huit --serie-* repassent pour inutilisees. */
  const brut = [CIBLE].concat(inclusPar(CIBLE), fichiersJS_).map(f => fs.readFileSync(f, 'utf8')).join('\n');
  for (const m of brut.matchAll(/cssToken\('(--[a-z0-9-]+)'\)/g)) appeles.add(m[1]);
  if (/palSeries\(/.test(brut)) [...declares].filter(t => /^--serie-\d+$/.test(t)).forEach(t => appeles.add(t));
}

const jamaisAppeles = [...declares].filter(t => !appeles.has(t)).sort();
const jamaisDeclares = [...appeles].filter(t => !declares.has(t)).sort();

console.log('  tokens declares : ' + declares.size + ', tokens appeles : ' + appeles.size);
const declaresLocaux = new Set(Object.keys(B.locaux));
const absents = jamaisDeclares.filter(t => !declaresLocaux.has(t));
const surComposant = jamaisDeclares.filter(t => declaresLocaux.has(t));
if (absents.length) absents.forEach(t => ko('var(' + t + ') sans declaration'));
else ok('aucun var() sans declaration nulle part');
if (surComposant.length) note('declares sur un composant et non dans :root, donc hors charte : ' + surComposant.join(', '));
if (jamaisAppeles.length) { note('tokens declares jamais appeles : ' + jamaisAppeles.join(', ')); }
else ok('tous les tokens declares sont utilises');

/* ---------------------------------------------------------------------------
   6. Contrastes
--------------------------------------------------------------------------- */
titre('6. Contrastes des paires texte sur fond de la charte');

function resout(v, tokens, prof = 0) {
  if (prof > 12) return v;
  let change = false;
  const out = v.replace(/var\(\s*(--[\w-]+)\s*\)/g, (m, nom) => {
    if (tokens[nom] !== undefined) { change = true; return tokens[nom]; }
    return m;
  });
  return change ? resout(out, tokens, prof + 1) : out;
}
function rgba(c) {
  c = resout(c.trim(), B.tokens).trim();
  let m = c.match(/^#([0-9a-fA-F]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
            h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  m = c.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
}
const compose = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
function lum(c) {
  const s = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}
function ratio(fg, bg) {
  const f = compose(rgba(fg), rgba(bg)), b = rgba(bg).slice(0, 3);
  const a = lum(f), c = lum(b);
  return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
}

/* [ encre, fond, role, seuil, bloquant, remarque ]
   seuil 4.5 : texte courant (AA). 3.0 : composant non textuel porteur de sens.
   Sous 3.0 : pur decor, WCAG ne fixe rien, le seuil est celui de la charte.
   bloquant = false : la paire ne se produit nulle part dans le CSS, elle est
   affichee pour memoire et ne fait pas echouer le controle. */
const PAIRES = [
  ['var(--ink)',        'var(--paper)',         'texte courant sur papier',        4.5, true,  ''],
  ['var(--ink)',        'var(--paper-light)',   'texte sur carte',                 4.5, true,  ''],
  ['var(--ink)',        'var(--paper-deep)',    'texte sur bande en retrait',      4.5, true,  ''],
  ['var(--muted)',      'var(--paper)',         'texte secondaire sur papier',     4.5, true,  ''],
  ['var(--muted)',      'var(--paper-light)',   'texte secondaire sur carte',      4.5, true,  ''],
  ['var(--muted)',      'var(--paper-deep)',    'texte secondaire sur bande',      4.5, true,  ''],
  ['var(--bordeaux)',   'var(--paper)',         'accent sur papier',               4.5, true,  ''],
  ['var(--bordeaux)',   'var(--paper-light)',   'accent sur carte',                4.5, true,  ''],
  ['var(--bordeaux)',   'var(--paper-deep)',    'accent sur bande',                4.5, true,  ''],
  ['var(--cork-encre)', 'var(--paper)',         'liege encre sur papier',          4.5, true,  ''],
  ['var(--cork-encre)', 'var(--paper-light)',   'liege encre sur carte',           4.5, true,  ''],
  ['var(--cork-encre)', 'var(--paper-deep)',    'liege encre sur bande',           4.5, true,  ''],
  ['var(--on-dark)',    'var(--bordeaux-deep)', 'texte sur fond sombre',           4.5, true,  ''],
  ['var(--on-dark)',    'var(--ink)',           'texte sur encre',                 4.5, true,  ''],
  ['var(--on-dark)',    'var(--ink-deep)',      'texte sur encre profonde',        4.5, true,  ''],
  ['var(--on-dark-soft)','var(--bordeaux-deep)','texte attenue sur fond sombre',   4.5, true,  ''],
  ['var(--on-dark-faint)','var(--bordeaux-deep)','etiquette pale sur fond sombre', 4.5, false, '--on-dark-faint n\'est appele nulle part : ne doit jamais porter de texte'],
  ['var(--cork)',       'var(--ink-deep)',      'liege sur encre profonde (badge)',4.5, true,  ''],
  ['var(--danger)',     'var(--paper)',         'rouge sur papier',                4.5, false, 'hors des seize corrections : --danger echoue partout comme texte'],
  ['var(--danger)',     'var(--paper-light)',   'montant en retard sur carte',     4.5, false, 'hors des seize corrections, voir le rapport'],
  ['var(--danger-deep)','var(--paper-light)',   'rouge fonce sur carte (piste)',   4.5, false, 'la sortie proposee pour --danger'],
  ['var(--ok)',         'var(--ok-bg)',         'etat ok',                         4.5, false, '--ok-bg n\'est appele nulle part'],
  ['var(--danger)',     'var(--danger-bg)',     'etat danger',                     4.5, false, '--danger-bg n\'est appele nulle part'],
  ['var(--warn)',       'var(--warn-bg)',       'etat alerte',                     4.5, false, '--warn-bg n\'est appele nulle part'],
  ['var(--info)',       'var(--info-bg)',       'etat info',                       4.5, false, '--info-bg n\'est appele nulle part'],
  ['var(--cork)',       'var(--paper)',         'liege ORNEMENT sur papier',       1.5, true,  'decor seul : filets, guillemets, pastilles'],
  ['var(--rule-fort)',  'var(--paper)',         'filet de section (non textuel)',  1.25, true, ''],
  ['var(--rule)',       'var(--paper)',         'filet de carte (non textuel)',    1.10, true, ''],
  ['var(--paper-deep)', 'var(--paper)',         'alternance des bandes',           1.25, true, ''],
  /* LES PAIRES DE LA REFONTE DU 07/09/2026. Elles n'existaient pas dans cette
     table, donc rien ne les controlait, et c'est un calcul a la main qui a
     trouve la seule qui echouait : le creme sur --danger donne 4,00:1, pour un
     bandeau de mois ecrit en --t-micro, dix pixels, qui en demande 4,50. Une
     paire nouvelle qui n'entre pas ici n'est pas controlee : c'est la lecon. */
  ['var(--ardoise)',    'var(--cork)',          'intercalaire : encre sur carton', 4.5, true,  ''],
  ['var(--bordeaux-deep)','var(--cork)',        'icone d\'intercalaire',            3.0, true,  'trace non textuel, seuil des elements graphiques'],
  ['var(--on-dark)',    'var(--ardoise)',       'chiffre sur l\'ardoise',           4.5, true,  ''],
  ['var(--gold)',       'var(--ardoise)',       'etiquette sur l\'ardoise',         4.5, true,  ''],
  ['var(--on-dark-soft)','var(--ardoise)',      'source du chiffre sur l\'ardoise', 4.5, true,  ''],
  ['var(--on-dark-faint)','var(--ardoise)',     'creme pale sur l\'ardoise',        4.5, false, '3,0:1 : interdit pour du texte sur l\'ardoise, ecrit dans CLAUDE.md'],
  ['var(--on-dark)',    'var(--danger-deep)',   'bandeau de mois urgent',          4.5, true,  ''],
  ['var(--on-dark)',    'var(--bordeaux)',      'bandeau de mois du calendrier',   4.5, true,  ''],
  ['var(--danger-deep)','var(--white)',         'retard sur bande blanche',        4.5, true,  ''],
  ['var(--muted)',      'var(--white)',         'reference et motif sur bande blanche', 4.5, true, ''],
  ['var(--bordeaux)',   'var(--white)',         'nom de client sur bande blanche', 4.5, true,  ''],
  ['var(--cork-clair)', 'var(--cork)',          'arete eclairee du carton (non textuel)', 1.10, true, ''],
  ['var(--cork-encre)', 'var(--cork)',          'arete ombree du carton (non textuel)', 1.5, true, '']
];

let echecsContraste = 0;
console.log('  ' + 'paire'.padEnd(36) + 'ratio    seuil  AA  verdict');
PAIRES.forEach(([fg, bg, role, seuil, bloquant, remarque]) => {
  if (!rgba(fg) || !rgba(bg)) {   // token absent de cette cible : sans objet
    console.log('  ' + role.padEnd(36) + '     .        .    .   sans objet   ' +
                fg.replace(/var\(|\)/g, '') + ' / ' + bg.replace(/var\(|\)/g, ''));
    return;
  }
  const r = ratio(fg, bg);
  const passe = r >= seuil;
  if (!passe && bloquant) echecsContraste++;
  const aa = r >= 4.5 ? 'AA ' : (r >= 3 ? '/  ' : '-  ');
  console.log('  ' + role.padEnd(36) +
              r.toFixed(2).padStart(6) + '   ' + seuil.toFixed(2).padStart(5) + '  ' + aa + ' ' +
              (passe ? 'OK ' : (bloquant ? 'NON' : 'nc ')) + '   ' +
              fg.replace(/var\(|\)/g, '') + ' / ' + bg.replace(/var\(|\)/g, '') +
              (remarque ? '   (' + remarque + ')' : ''));
});
PAIRES.filter(p => !p[4] && rgba(p[0]) && rgba(p[1]) && ratio(p[0], p[1]) < p[3])
      .forEach(p => note('paire hors usage sous AA : ' + p[2] + ' (' + p[5] + ')'));
if (echecsContraste) ko(echecsContraste + ' paire(s) en usage sous le seuil');
else ok('toutes les paires en usage passent leur seuil');

/* ---------------------------------------------------------------------------
   6 bis. LES PAIRES QUE PERSONNE N'A DECLAREES
   ---------------------------------------------------------------------------
   La table ci-dessus ne controle que ce qu'on a pense a y ecrire. C'est ce trou
   qui a laisse passer, le 07/09/2026, un bandeau de mois en creme sur --danger
   a 4,00:1, pour du texte de dix pixels qui en demande 4,50 : la paire
   --on-dark / --danger n'etait pas dans la table, donc rien ne la regardait.

   Ce controle-ci ne demande rien a personne : il PARCOURT la feuille et prend
   chaque regle qui pose a la fois une encre et un fond, tous deux en jeton. Il
   en trouve une soixantaine. C'est la moitie du probleme, celle qui se voit :
   il ne peut rien dire d'une encre heritee d'un parent, qui demanderait de
   rejouer la cascade. La moitie qui se voit est deja celle qui casse.

   Seuil unique a 4,50. Le seuil de 3,00 des grands textes existe, mais aucune
   paire du depot n'en a besoin aujourd'hui, et un seuil qu'on n'utilise pas est
   un seuil qui finit par excuser une faute.
--------------------------------------------------------------------------- */
titre('6 bis. Paires trouvees dans la feuille, hors table');
{
  const SEUL_JETON = /^var\(--[\w-]+\)$/;
  const trouvees = [];
  const declarees = new Set(PAIRES.map(p => p[0] + '|' + p[1]));
  B.regles.forEach(r => {
    const sel = norme(r.sel);
    if (sel === ':root') return;
    let fg = null, bg = null;
    r.decls.forEach(d => {
      if (d.prop === 'color') fg = d.val.trim();
      if (d.prop === 'background' || d.prop === 'background-color') bg = d.val.trim();
    });
    if (!SEUL_JETON.test(fg || '') || !SEUL_JETON.test(bg || '')) return;
    trouvees.push([sel, fg, bg, r.ligne]);
  });
  const vues = new Map();
  trouvees.forEach(([sel, fg, bg, ligne]) => {
    const cle = fg + '|' + bg;
    if (!vues.has(cle)) vues.set(cle, { fg, bg, sel, ligne, n: 0 });
    vues.get(cle).n++;
  });
  let sous = 0, insolubles = 0;
  console.log('  ' + vues.size + ' paire(s) distincte(s) dans ' + trouvees.length + ' regle(s)');
  vues.forEach(v => {
    if (!rgba(v.fg) || !rgba(v.bg)) { insolubles++; return; }
    const r = ratio(v.fg, v.bg);
    if (r >= 4.5) return;
    sous++;
    ko('contraste ' + r.toFixed(2) + ':1 sous 4,50 — ' + v.sel + ' L' + v.ligne +
       ' pose ' + v.fg + ' sur ' + v.bg +
       (declarees.has(v.fg + '|' + v.bg) ? '' : ' (paire absente de la table)'));
  });
  if (insolubles) note(insolubles + ' paire(s) dont un jeton n\'est pas une couleur simple : non calculees');
  if (!sous) ok('les ' + (vues.size - insolubles) + ' paires trouvees dans la feuille passent AA');
}

/* ---------------------------------------------------------------------------
   7. Graisses demandees contre graisses chargees  (LE controle du faux gras)
--------------------------------------------------------------------------- */
titre('7. Graisses demandees par le CSS contre graisses chargees par Google Fonts');

const lien = fs.existsSync(LIEN_FONTS) ? fs.readFileSync(LIEN_FONTS, 'utf8').trim() : '';
if (!lien) { ko('lien Google Fonts introuvable : ' + LIEN_FONTS); }
console.log('  source du lien : ' + LIEN_FONTS + ' (instantane de src/_includes/base.njk)');

/* Graisses romaines reellement servies par le lien. */
const chargees = {};
for (const m of lien.matchAll(/family=([^&]+)/g)) {
  const bloc = decodeURIComponent(m[1]).replace(/\+/g, ' ');
  const [nom, axes] = bloc.split(':');
  const poids = new Set();
  if (!axes) poids.add(400);
  else {
    const noms = axes.split('@')[0].split(',');
    const iw = noms.indexOf('wght');
    const iItal = noms.indexOf('ital');
    (axes.split('@')[1] || '').split(';').forEach(tuple => {
      const vals = tuple.split(',');
      if (iItal >= 0 && vals[iItal] === '1') return;      // l'italique se compte a part
      const v = iw >= 0 ? vals[iw] : '400';
      // une plage 400..700 sert toutes les graisses intermediaires
      if (v.includes('..')) { const [a, b] = v.split('..').map(Number); for (let w = a; w <= b; w += 100) poids.add(w); }
      else poids.add(Number(v));
    });
  }
  chargees[nom.trim()] = [...poids].sort((a, b) => a - b);
}
Object.entries(chargees).forEach(([f, w]) => console.log('  charge : ' + f.padEnd(16) + w.join(', ')));

/* Token de famille -> nom Google */
const FAMILLE = { '--font-titre': 'Fraunces', '--font-corps': 'Inter',
                  '--font-mono': 'JetBrains Mono', '--font-manuscrit': 'Caveat' };

/* Famille declaree par selecteur, dans le meme bloc ou dans un autre bloc
   portant exactement le meme selecteur. */
const familleDe = new Map();
B.regles.forEach(r => {
  const sel = norme(r.sel);
  r.decls.forEach(d => {
    if (d.prop !== 'font-family') return;
    const m = d.val.match(/var\((--font-[\w-]+)\)/);
    if (m) familleDe.set(sel, m[1]);
    else if (/-apple-system|Segoe UI/.test(d.val)) familleDe.set(sel, 'systeme');
  });
});

/* Remontee : .bloc__element -> .bloc, puis .bloc__element:etat -> .bloc__element */
function resoutFamille(sel) {
  if (familleDe.has(sel)) return [familleDe.get(sel), 'declaree'];
  /* Selecteur descendant : si le dernier maillon ne declare rien, la famille
     vient de l'ancetre le plus proche qui en declare une. */
  const maillons = sel.split(/\s+(?![^(\[]*[)\]])/).filter(Boolean);
  if (maillons.length > 1 && !familleDe.has(maillons[maillons.length - 1])) {
    for (let i = maillons.length - 2; i >= 0; i--) {
      if (familleDe.has(maillons[i])) return [familleDe.get(maillons[i]), 'heritee de ' + maillons[i]];
    }
  }
  let s = sel;
  for (let i = 0; i < 6; i++) {
    const base = s.split(/[ >+~]/).pop().replace(/:[\w-]+(\([^)]*\))?$/, '').replace(/\[[^\]]*\]/g, '');
    if (familleDe.has(base)) return [familleDe.get(base), 'heritee de ' + base];
    const m = base.match(/^(\.[\w-]+?)(__[\w-]+)$/);
    if (m && familleDe.has(m[1])) return [familleDe.get(m[1]), 'heritee de ' + m[1]];
    if (m && familleDe.has(m[1] + '__card')) return [familleDe.get(m[1] + '__card'), 'heritee de ' + m[1] + '__card'];
    if (base === s) break;
    s = base;
  }
  return ['--font-corps', 'supposee (heritage de body)'];
}

const lignes = [];
B.regles.forEach(r => {
  const sel = norme(r.sel);
  r.decls.forEach(d => {
    if (d.prop !== 'font-weight') return;
    const w = Number(d.val);
    if (!w) return;
    const [tok, origine] = resoutFamille(sel);
    lignes.push({ sel, w, tok, origine, ligne: d.ligne });
  });
});

let fauxGras = 0, poidsAbsents = 0;
console.log('  ' + 'selecteur'.padEnd(42) + 'poids  famille          etat');
lignes.sort((a, b) => a.ligne - b.ligne).forEach(l => {
  const fam = FAMILLE[l.tok];
  let etat;
  if (!fam) etat = 'famille systeme, hors controle';
  else {
    const dispo = chargees[fam] || [];
    if (dispo.includes(l.w)) etat = 'charge';
    else {
      /* Appariement CSS : pour un poids demande, on retient le plus proche
         inferieur, sinon le plus proche superieur. Le navigateur ne
         synthetise du gras que si le poids demande est >= 600 ET que la
         fonte retenue est en dessous de 600. */
      const inf = dispo.filter(x => x <= l.w).pop();
      const sup = dispo.find(x => x >= l.w);
      const retenu = (l.w < 400 ? (inf ?? sup) : (inf ?? sup));
      if (l.w >= 600 && (retenu === undefined || retenu < 600)) {
        etat = 'FAUX GRAS : ' + l.w + ' demande, ' + retenu + ' disponible';
        fauxGras++;
      } else {
        etat = 'non charge, rendu a ' + retenu + ' sans synthese';
        poidsAbsents++;
      }
    }
  }
  const marque = /FAUX GRAS/.test(etat) ? '!! ' : '   ';
  console.log(marque + l.sel.slice(0, 40).padEnd(42) + String(l.w).padEnd(7) +
              (fam || l.tok).padEnd(17) + etat + '   [' + l.origine + ']');
});

console.log('  ' + lignes.length + ' declarations font-weight analysees');
if (fauxGras) ko(fauxGras + ' declaration(s) en faux gras synthetique');
else ok('aucun faux gras : toute graisse >= 600 trouve une fonte >= 600 chargee');
if (poidsAbsents) note(poidsAbsents + ' graisse(s) demandee(s) non chargee(s), rabattues sans synthese');

/* ---------------------------------------------------------------------------
   8. CSS embarque dans les modules JS (src/js/*.js)
   Un module comme bdv-compte.js injecte son propre <style> depuis un litteral
   de chaine : ce texte ne passe jamais par le parseur ci-dessus, donc jamais
   par ce controle, sauf a l'aller chercher expres. Repli de var(--x, ...) mal
   recopie, couleur en dur oubliee hors de tout var(), rayon en dur : c'est
   exactement le genre de derive silencieuse que ce script existe pour attraper.
--------------------------------------------------------------------------- */
titre('8. CSS embarque dans src/js/*.js');

const DOSSIER_JS = path.join(RACINE, 'src/js');
const fichiersJS = fs.existsSync(DOSSIER_JS)
  ? fs.readdirSync(DOSSIER_JS).filter(f => f.endsWith('.js')).map(f => path.join(DOSSIER_JS, f))
  : [];

/* Repere chaque appel var(...), y compris quand le repli contient lui-meme
   des parentheses (rgba(...) dans un box-shadow) : un decoupage par regex
   simple casse sur ce cas, il faut compter la profondeur. */
function appelsVar(val) {
  const out = [];
  const re = /var\(/g;
  let m;
  while ((m = re.exec(val))) {
    let i = m.index + 4, prof = 1;
    const debut = i;
    while (i < val.length && prof > 0) {
      if (val[i] === '(') prof++;
      else if (val[i] === ')') prof--;
      i++;
    }
    const inner = val.slice(debut, i - 1);
    const virgule = inner.indexOf(',');
    const nom = (virgule >= 0 ? inner.slice(0, virgule) : inner).trim();
    const repli = virgule >= 0 ? inner.slice(virgule + 1).trim() : null;
    out.push({ nom, repli, debut: m.index, fin: i });
  }
  return out;
}

const normVal = v => v.replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ').trim();

/* Deux valeurs de repli se valent si ce sont la meme couleur (ecart de
   formatage tolere : #fff == #FFFFFF, .7 == 0.70) ou la meme dimension
   simple ; sinon, egalite de texte stricte (piles de polices, ombres). */
function memeValeur(a, b) {
  const ra = rgba(a), rb = rgba(b);
  if (ra && rb) return JSON.stringify(ra) === JSON.stringify(rb);
  const na = a.match(/^(-?\d*\.?\d+)(px|rem|em|%|s|ms)?$/);
  const nb = b.match(/^(-?\d*\.?\d+)(px|rem|em|%|s|ms)?$/);
  if (na && nb) return parseFloat(na[1]) === parseFloat(nb[1]) && (na[2] || '') === (nb[2] || '');
  return normVal(a) === normVal(b);
}

function litteralesCss(fichier) {
  const src = fs.readFileSync(fichier, 'utf8');
  const RE = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  const out = [];
  let m;
  while ((m = RE.exec(src))) {
    const brut = m[1] ?? m[2] ?? m[3] ?? '';
    if (!brut.includes('{') || !brut.includes(':')) continue;
    const contenu = brut.replace(/\\(.)/g, '$1');
    const erreurs = [];
    const ast = csstree.parse(contenu, { onParseError: e => erreurs.push(e.message) });
    if (erreurs.length || !ast.children || !ast.children.some(ch => ch.type === 'Rule')) continue;
    out.push({ ast, ligne: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

let jsCouleursDur = 0, jsRayonsDur = 0, jsRepliFaux = 0, jsTokenAbsent = 0, litteralesLues = 0;

fichiersJS.forEach(fichier => {
  const rel = path.relative(RACINE, fichier);
  litteralesCss(fichier).forEach(({ ast, ligne }) => {
    litteralesLues++;
    ast.children.forEach(regle => {
      if (regle.type !== 'Rule' || !regle.block) return;
      regle.block.children.forEach(d => {
        if (d.type !== 'Declaration') return;
        const val = csstree.generate(d.value);
        const appels = appelsVar(val);

        appels.forEach(({ nom, repli }) => {
          if (!(nom in B.tokens)) { ko(rel + ' L' + ligne + ' : var(' + nom + ') sans declaration dans :root'); jsTokenAbsent++; return; }
          if (repli == null) return;
          const attendu = normVal(resout(B.tokens[nom], B.tokens));
          if (!memeValeur(normVal(repli), attendu)) {
            ko(rel + ' L' + ligne + ' : repli de var(' + nom + ') = "' + repli + '", attendu "' + attendu + '"');
            jsRepliFaux++;
          }
        });

        let sansVar = val;
        [...appels].reverse().forEach(({ debut, fin }) => { sansVar = sansVar.slice(0, debut) + sansVar.slice(fin); });
        if (RE_COULEUR.test(sansVar)) { ko(rel + ' L' + ligne + ' : couleur en dur hors var() dans ' + d.property + ': ' + val); jsCouleursDur++; }
        if (d.property === 'border-radius') {
          const reste = sansVar.trim();
          if (reste && !/^0(px|rem|em)?$/.test(reste) && !/50%/.test(val)) { ko(rel + ' L' + ligne + ' : border-radius en dur (' + val + ')'); jsRayonsDur++; }
        }
      });
    });
  });
});

console.log('  ' + litteralesLues + ' litterale(s) CSS lue(s) dans ' + fichiersJS.length + ' fichier(s) (' + fichiersJS.map(f => path.basename(f)).join(', ') + ')');
if (!jsCouleursDur && !jsRayonsDur && !jsRepliFaux && !jsTokenAbsent) ok('CSS embarque conforme : couleurs, rayons et reprises de tokens verifies');

/* ---------------------------------------------------------------------------
   9. Entites HTML numeriques du tableau de bord
--------------------------------------------------------------------------- */
/* Le piege que ce controle attrape : dans ce fichier, une trentaine de valeurs ressemblent a
   des couleurs hexadecimales hors du bloc <style>, et certaines n'en sont pas. `&#128200;` et
   ses voisines sont des emoji ecrits en entite HTML. Un chercher-remplacer de couleurs passe
   dessus sans prevenir, et les icones du menu du tableau de bord disparaissent en silence.

   La liste est FIGEE ici, comme HASH_COLS, et ne s'ajuste pas toute seule : ajouter une icone
   se declare a la main. C'est exactement le but. Une liste qui se met a jour d'elle-meme ne
   detecte plus rien. */
/* Liste elargie le 07/09/2026, lot 0 : les cinq icones du menu ont suivi les ecrans dans
   src/js/bdv-ecrans.js, et le controle voit desormais aussi src/js/bdv-base.js (&#9095; le
   sablier, &#9998; le crayon) et src/js/bdv-reglages.js (&#215; la croix de fermeture), que
   personne ne surveillait jusqu'ici. Les trois dernieres sont donc une COUVERTURE NOUVELLE,
   pas un ajout d'icone. */
/* &#8592; est partie au lot 2d avec le lien « Mon bureau » de la barre des ecrans : on
   n'a plus a revenir au bureau depuis un endroit qui EST le bureau. */
const ENTITES_ATTENDUES = ['&#127863;', '&#128101;', '&#128200;', '&#128204;', '&#128301;',
                           '&#9095;', '&#9998;', '&#215;',
                           ];
/* Les trois entites propres a la barre du bureau (le soleil, le sablier, la roue) ont
   disparu le 07/09/2026 : la barre porte desormais sept traces SVG monochromes, pas des
   emoji. Les quatre autres, qui etaient partagees avec le menu des ecrans de vente, sont
   encore dans la liste ci-dessus parce que NAV les declare toujours dans
   src/js/bdv-ecrans.js. ATTENTION : ce NAV n'affiche plus rien depuis que son volet a ete
   supprime au lot 2d, donc ces quatre icones sont du code mort en sursis. Le jour ou on les
   retire, il faut les retirer d'ici aussi, et ce controle n'aura plus grand-chose a
   surveiller que le crayon, le sablier de bdv-base et la croix du panneau. */

if (DASH) {
  titre('9. Entites HTML numeriques (les icones du tableau de bord)');
  /* La page ET les fichiers de src/js : depuis le lot 0, cinq des six icones d'origine ne
     sont plus dans la page. Un controle limite au HTML les declarerait disparues. */
  const brutHtml = [CIBLE].concat(inclusPar(CIBLE), fichiersJS_).map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const trouvees = (brutHtml.match(/&#\d+;/g) || []);
  const attendues = [...ENTITES_ATTENDUES];
  console.log('  ' + trouvees.length + ' entite(s) trouvee(s) pour ' + attendues.length + ' attendue(s)');
  const manquantes = attendues.filter(e => !trouvees.includes(e));
  const inconnues = [...new Set(trouvees.filter(e => !attendues.includes(e)))];
  if (manquantes.length) ko('entite(s) HTML disparue(s) : ' + manquantes.join(' ') + ' — un chercher-remplacer les a probablement emportees');
  if (inconnues.length) note('entite(s) non declaree(s) dans ENTITES_ATTENDUES : ' + inconnues.join(' ') + ' (a ajouter a la liste si elles sont voulues)');
  if (!manquantes.length && !inconnues.length) ok('les ' + trouvees.length + ' entites HTML numeriques sont intactes');
  /* Une entite tombee DANS le CSS est le symptome inverse : quelqu'un a pris une icone pour
     une valeur de style et l'a deplacee au lieu de la remplacer. */
  const dansStyle = ([...brutHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n').match(/&#\d+;/g) || []);
  if (dansStyle.length) ko(dansStyle.length + ' entite(s) HTML dans un bloc <style> : une icone a ete prise pour une valeur CSS');
  else ok('aucune entite HTML egaree dans le CSS');
}

/* ---------------------------------------------------------------------------
   10. Le scope de la feuille des ecrans de vente
--------------------------------------------------------------------------- */
/* Ce que ce controle attrape : une regle de src/css/bdv-ecrans.css ecrite sans son scope.
   Cette feuille est chargee DANS la page du bureau, qui a deja src/css/style.css. Six noms
   de classes sont communs aux deux (btn, btn--ghost, card__title, hero, mono, note) et il y
   en aura d'autres. Une regle hors scope ne casse rien tout de suite : elle repeint un
   bouton du site, ou rabat un interlignage, quelque part, un jour.

   Les exceptions sont NOMMEES ici et ne s'ajustent pas toutes seules : les jetons, les
   quatre elements hors page qui portent la classe eux-memes, et le bloc @media print qui
   pilote la page entiere pour l'export PDF. */
const SCOPE_VENTES = '.bdv-ventes';
const SCOPE_EXCEPTIONS = new Set([':root', '.status', '#busyov', '#printReport', '.modale']);
const FEUILLE_VENTES = path.join(RACINE, 'src/css/bdv-ecrans.css');

if (fs.existsSync(FEUILLE_VENTES)) {
  titre('10. Le scope de src/css/bdv-ecrans.css');
  const astV = csstree.parse(fs.readFileSync(FEUILLE_VENTES, 'utf8'));
  const fautives = [];
  let portees = 0;
  csstree.walk(astV, {
    visit: 'Rule',
    enter(node) {
      if (this.atrule && this.atrule.name === 'keyframes') return;
      if (this.atrule && this.atrule.name === 'media'
        && csstree.generate(this.atrule.prelude).includes('print')) return;
      if (node.prelude.type !== 'SelectorList') return;
      node.prelude.children.forEach(sel => {
        const txt = csstree.generate(sel);
        if (SCOPE_EXCEPTIONS.has(txt)) return;
        if (txt.startsWith(SCOPE_VENTES)) { portees++; return; }
        fautives.push(txt);
      });
    }
  });
  console.log('  ' + portees + ' selecteur(s) porte(s) par ' + SCOPE_VENTES
    + ', ' + SCOPE_EXCEPTIONS.size + ' exception(s) nommee(s)');
  if (fautives.length) {
    [...new Set(fautives)].slice(0, 12).forEach(f =>
      ko('regle hors scope : ' + f + ' — elle s\'appliquera a tout le site du bureau'));
    if (fautives.length > 12) ko('et ' + (fautives.length - 12) + ' autre(s)');
  } else ok('aucune regle ne sort du scope');
}

/* ---------------------------------------------------------------------------
   Verdict
--------------------------------------------------------------------------- */
titre('VERDICT');
console.log('  echecs : ' + ERR + '   notes : ' + NOTES);
if (ERR) { console.log('  NON CONFORME'); process.exit(1); }
console.log('  CONFORME');
process.exit(0);

