/* ============================================================================
   scripts/charte.mjs : controle de conformite a la charte graphique.

     node scripts/charte.mjs           le CSS du site
     node scripts/charte.mjs --bureau  le bureau et ses ecrans de vente

   Ne modifie rien. Sortie 0 seulement si tout est conforme.

   TROIS SECTIONS AJOUTEES LE 19/09/2026, apres un audit qui a trouve a la main
   ce que ce script ne savait pas voir :
     A. les echelles fermees. On COMPTE les valeurs distinctes par famille
        (tailles, rayons, ombres, filets, z-index) au lieu de tolerer des
        declarations sous un plafond. Dix appels a 1.05rem sont UN pas
        d'echelle a baptiser, pas dix fautes.
     B. l'accessibilite de la page CONSTRUITE, HTML et JavaScript ensemble,
        parce que la moitie du bureau nait d'une chaine de caracteres au clic.
     C. ce qui voyage et ce qui ne sert a rien : les regles qui ne
        correspondent a aucun balisage, celles des composants qu'aucune page
        n'inclut, et la part de style.css qui part dans le bureau sans pouvoir
        s'y appliquer.

   Le controle le plus spectaculaire reste celui de la section 7 : il confronte chaque
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
    /* ET LA FEUILLE DES DEUX THEMES, 21/09/2026, QUI N'EST PAS CHARGEE EN JAVASCRIPT.
       src/css/bdv-theme.css est LIEE dans le HTML du bureau, donc la boucle ci-dessus
       la trouve deja par son <link>. Elle est quand meme nommee ici, pour deux raisons
       qui ne sont pas du zele : le jour ou le <link> demenage (dans un include, dans
       une balise construite par un script, dans un gabarit d'apercu), elle resterait
       dans le perimetre au lieu d'en sortir en silence ; et son absence du disque doit
       CRIER, comme pour les trois autres. C'est la meme regle que CLAUDE.md pose pour
       les feuilles chargees en JavaScript : une feuille oubliee ici echappe entierement
       au controle, et rien ne le signale.
       LE DEDOUBLONNAGE N'EST PAS DECORATIF : lue deux fois, une feuille verrait toutes
       ses declarations comptees en double, donc les plafonds de la section 4 et les
       echelles fermees de la section A mesureraient du vide. */
    if (DASH) {
      /* ET LA FEUILLE DU DESSIN DE LA COQUE, 21/09/2026, meme raison que
         bdv-theme.css juste au-dessus : elle est LIEE dans le HTML du bureau,
         donc la boucle des <link> la trouve deja, et elle est quand meme nommee
         ici pour que son absence du disque CRIE et pour qu'elle reste dans le
         perimetre le jour ou le <link> demenage. Le dedoublonnage ci-dessous
         empeche de la compter deux fois. */
      for (const f of ['src/css/bdv-ecrans.css', 'src/css/bdv-panneau.css',
                       'src/css/bdv-calendrier.css', 'src/css/bdv-theme.css',
                       'src/css/bdv-bureau.css']) {
        const abs = path.join(RACINE, f);
        if (!fs.existsSync(abs)) { erreursHtml.push('feuille du bureau introuvable : ' + f); continue; }
        if (!liees.includes(abs)) liees.push(abs);
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
  /* ET LE TROISIEME SEAU, 21/09/2026 : LES RETOURNEMENTS DE THEME.
     src/css/bdv-theme.css declare le meme jeu de jetons trois fois, une en clair et
     deux en sombre (voir son bloc de tete). Les ranger avec les jetons de charte les
     ferait s'ecraser entre eux, et comme les blocs sombres sont ecrits EN DERNIER,
     c'est la valeur SOMBRE qui aurait servi a toutes les mesures de contraste de la
     section 6 : un controle qui mesure le theme que personne n'a demande. Les ranger
     avec les `locaux` les sortirait purement et simplement de la charte, ce qui est
     l'inverse de ce qu'on veut d'un jeu de jetons. Ils ont donc leur seau : ils sont
     DECLARES (section 5 les connait) sans etre la valeur de reference (section 6
     mesure le clair, qui est la seule source ou tout jeton nait). */
  const themes = {};
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
          if (estRacineBase(sel)) tokens[d.property] = csstree.generate(d.value);
          else if (estRacineTheme(sel)) themes[d.property] = csstree.generate(d.value);
          else locaux[d.property] = csstree.generate(d.value);
        });
        regles.push({ ctx: ctx.join(' >> '), sel, decls, ligne: ch.loc ? ch.loc.start.line : 0 });
      }
    });
  };
  marche(ast, []);
  return { txt, erreurs, regles, tokens, locaux, themes };
}

const norme = s => s.replace(/\s*([,>+~])\s*/g, '$1').replace(/\s+/g, ' ').trim();

/* ---------------------------------------------------------------------------
   CE QUI COMPTE COMME « LA RACINE », 21/09/2026
   ---------------------------------------------------------------------------
   Jusqu'ici ce script ne connaissait qu'une seule ecriture, `:root` tout seul, et
   c'etait vrai tant qu'il n'y avait qu'un theme. src/css/bdv-theme.css en porte
   trois formes, et aucune n'est `:root` tout seul :

       :root, [data-theme="light"]                      le clair, la SOURCE
       :root:not([data-theme="light"])   (dans @media)  le reglage du telephone
       :root[data-theme="dark"], [data-theme="dark"]    le bouton

   Sans ces deux fonctions, le script faisait DEUX fautes a la fois, et les deux
   sont du genre qui ne casse rien :

   1. IL CRIAIT SUR DU SAIN. La section 4 dispense `:root` de la regle « aucune
      couleur en dur » parce qu'un jeton est, par definition, une couleur ecrite
      une fois. Les deux blocs sombres n'etant pas `:root`, leurs trente couleurs
      auraient fait trente ECHEC sur une feuille parfaitement conforme. Un controle
      qui crie sur du sain finit par ne plus etre lu, c'est deja la lecon du
      19/09/2026 sur --ombre-photo.
   2. IL CLASSAIT LE JEU ENTIER HORS CONTROLE. Un selecteur qui n'est pas `:root`
      voit ses variables rangees en `locaux`, « declarees sur un composant, donc
      hors charte ». Les cinquante jetons du bureau seraient sortis du perimetre en
      silence, le jour meme ou on les pose.

   La distinction entre les deux fonctions n'est pas cosmetique : la BASE est la
   seule source, celle ou tout jeton nait, et c'est elle qui sert de reference aux
   contrastes. Un bloc de THEME ne fait que retourner des valeurs deja nees.
   Reconnaitre la base a son `:root` NU dans la liste : `:root[...]` et `:root:not(...)`
   sont des retournements, ils portent une condition.
--------------------------------------------------------------------------- */
const coupeVirgules_ = sel => norme(sel).split(',').map(x => x.trim()).filter(Boolean);
const estRacineBase  = sel => coupeVirgules_(sel).some(x => x === ':root');
const estRacineTheme = sel => !estRacineBase(sel)
  && coupeVirgules_(sel).some(x => /^:root[:[]/.test(x) || /^\[data-theme[~^|$*]?=?/.test(x));
const estRacine      = sel => estRacineBase(sel) || estRacineTheme(sel);

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
  if (estRacine(sel)) return;
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
/* Les jetons retournes par un bloc de theme sont DECLARES, meme s'ils ne naissent
   pas dans le bloc de base : un var() qui les appelle a bien une declaration. Que
   le bloc de base les porte tous est le travail de `npm run banc:jetons`, section 4,
   qui echoue si un jeton sombre n'existe pas en clair. */
const declares = new Set([...Object.keys(B.tokens), ...Object.keys(B.themes)]);
const appeles = new Set();
/* LES COMMENTAIRES NE SONT PAS DES APPELS, 19/09/2026. Le 18/09 on a retire le jeton
   --ombre-photo et laisse, a sa place, un commentaire qui RACONTE la collision et cite
   `var(--ombre-photo)` dans sa phrase. Ce controle a alors declare le site NON CONFORME
   pour un jeton que plus aucune regle n'appelle : il lisait la prose comme du style.
   Un controle qui crie sur du sain finit par ne plus etre lu, donc on retire les blocs
   de commentaire AVANT de chercher les appels. Les declarations, elles, sont relevees
   ailleurs sur le texte entier : un jeton declare dans un commentaire n'existe pas pour
   le navigateur non plus, mais ce cas-la ne s'est jamais presente et le signaler ne
   coute rien. */
const sansCommentaires = B.txt.replace(/\/\*[\s\S]*?\*\//g, ' ');
for (const m of sansCommentaires.matchAll(/var\(\s*(--[\w-]+)/g)) appeles.add(m[1]);

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
  ['var(--cork-encre)', 'var(--cork)',          'arete ombree du carton (non textuel)', 1.5, true, ''],

  /* LES PAIRES DE LA BOITE A OUTILS, 12/09/2026. La lecon du 07/09 s'est
     verifiee une deuxieme fois, et au meme endroit : `--warn` etait dans cette
     table UNIQUEMENT face a `--warn-bg`, un fond qui n'est appele nulle part.
     Face aux vrais papiers du site, personne ne l'avait jamais calcule. Il
     donne 4,40:1 sur --paper et 3,43:1 sur --paper-deep : le compte a rebours
     « proche » de /outils/ est passe en production sous le seuil, et la charte
     a repondu CONFORME. C'est --warn-deep qui porte les lettres depuis.

     LES DEUX DERNIERES LIGNES NE SONT PAS DU TEXTE. --viti-orange est le seul
     endroit ou une couleur de marque tierce entre dans la page : elle n'a le
     droit d'exister qu'en APLAT sous --ink-deep. Sa ligne « non textuel » est
     marquee non bloquante et sert d'avertissement ecrit : a 1,79:1 elle ne
     tient meme pas les 3:1 d'un objet graphique, donc jamais de filet orange. */
  ['var(--warn)',       'var(--paper)',         'alerte sur papier',               4.5, false, '4,40:1 : --warn est une couleur de FILET, pas de texte. Pour des lettres, --warn-deep'],
  ['var(--warn)',       'var(--paper-deep)',    'alerte sur bande en retrait',     4.5, false, '3,43:1 : idem, ornement seulement'],
  ['var(--warn-deep)',  'var(--paper)',         'alerte ecrite sur papier',        4.5, true,  ''],
  ['var(--warn-deep)',  'var(--paper-light)',   'alerte ecrite sur carte',         4.5, true,  ''],
  ['var(--warn-deep)',  'var(--paper-deep)',    'alerte ecrite sur bande',         4.5, true,  ''],
  ['var(--on-dark)',    'var(--ink-deep)',      'etiquette de prix gratuite',      4.5, true,  ''],
  ['var(--ink-deep)',   'var(--viti-orange)',   'etiquette de prix Vitisoft',      4.5, true,  ''],
  ['var(--viti-orange)','var(--paper-light)',   'orange Vitisoft POSE sur la carte (non textuel)', 3.0, false, '1,79:1 : il ne tient pas meme le seuil graphique. Aplat uniquement, jamais un filet ni des lettres']
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
    if (estRacine(sel)) return;
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
  let sous = 0, insolubles = 0, voiles = 0;
  console.log('  ' + vues.size + ' paire(s) distincte(s) dans ' + trouvees.length + ' regle(s)');
  /* UN VOILE N'EST PAS UN FOND, 21/09/2026, et ce controle le mesurait comme
     s'il en etait un.

     CE QUI S'EST PASSE : `.bureau-nav__item:hover` pose `--bdv-encre-1` sur
     `--bdv-survol`, qui vaut `rgba(22,24,28,.05)`, le voile de survol a 5 % du
     nouveau dessin. `ratio()` compose bien l'ENCRE sur le fond, mais il prend le
     fond pour opaque : il a donc mesure une encre presque noire sur un fond
     presque noir, et rendu 1,00:1 sur une rangee qui tient 14,08:1 a l'ecran.

     UN FOND TRANSLUCIDE NE SE MESURE PAS SEUL, et ce n'est pas une tolerance :
     ce qui porte les lettres, c'est la surface qui est DESSOUS, et la cascade
     seule sait laquelle. Le calculer quand meme, c'est inventer un chiffre ;
     l'ignorer en silence, c'est le trou de la section 6 qu'on a paye le
     07/09/2026. On le range donc dans les insolubles, et on le DIT, avec la
     regle qui va avec : une paire posee sur un voile se mesure A LA MAIN contre
     la surface reelle et s'inscrit dans la table.

     MESURE FAITE LE 21/09/2026 pour la seule paire concernee : `--bdv-encre-1`
     sur `--bdv-survol` pose sur `--bdv-surface-2` donne 14,08:1 en clair, et
     `--bdv-encre-1` sur le voile blanc de 5,5 % pose sur le meme jeton en
     sombre donne 12,92:1. Les deux tres au-dessus de AA.

     ET LA SECONDE PAIRE QUE CE CHANGEMENT A SORTIE DU CALCUL, mesuree le meme
     jour pour ne pas laisser un trou derriere soi : `.demo-pinboard__state-badge`
     pose `--ink` (#1E2536) sur `--paper-light-voile`, un papier creme a 90 %
     pose sur une photo. Le fond compose est creme a 90 % quelle que soit
     l'image dessous, donc le PIRE cas (voile sur du noir) donne encore 11,0:1.
     Elle passait deja, elle passe toujours, et elle est desormais mesuree pour
     ce qu'elle est au lieu d'etre calculee comme un aplat. */
  vues.forEach(v => {
    const cb = rgba(v.bg);
    if (cb && cb[3] < 1) {
      voiles++;
      note('paire posee sur un VOILE translucide, non calculable ici : ' + v.sel +
           ' L' + v.ligne + ' pose ' + v.fg + ' sur ' + v.bg +
           ' — a mesurer a la main contre la surface qui est dessous');
      return;
    }
    if (!rgba(v.fg) || !cb) { insolubles++; return; }
    const r = ratio(v.fg, v.bg);
    if (r >= 4.5) return;
    sous++;
    ko('contraste ' + r.toFixed(2) + ':1 sous 4,50 — ' + v.sel + ' L' + v.ligne +
       ' pose ' + v.fg + ' sur ' + v.bg +
       (declarees.has(v.fg + '|' + v.bg) ? '' : ' (paire absente de la table)'));
  });
  if (insolubles) note(insolubles + ' paire(s) dont un jeton n\'est pas une couleur simple : non calculees');
  if (!sous) ok('les ' + (vues.size - insolubles - voiles) + ' paires trouvees dans la feuille passent AA'
    + (voiles ? ', ' + voiles + ' posee(s) sur un voile et mesuree(s) a la main' : ''));
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
   10 bis. Le scope de la feuille du dessin de la coque
--------------------------------------------------------------------------- */
/* MEME CONTROLE QUE LA SECTION 10, POUR LA MEME RAISON, ET C'EST CELUI-CI QUI
   COUTERAIT LE PLUS CHER S'IL MANQUAIT.

   src/css/bdv-bureau.css repeint `.zone`, `.btn`, `.chip`, `input`, `table` et
   les rangees. Or `.zone`, `.postit` et `.lettre` sont AUSSI les classes de
   src/_includes/components/demo-pinboard.njk, la demonstration de la page
   d'accueil : c'est une regle ecrite du depot (12/09/2026) qu'elle montre les
   VRAIS composants du bureau, avec leurs vraies classes, pour qu'aucune maquette
   ne derive du produit. Une seule regle de cette feuille ecrite sans son scope
   repeindrait donc la page d'accueil du site public, qui n'a pas de theme sombre
   et n'en veut pas. Ca ne casserait rien, ca ne leverait rien, et personne ne le
   verrait avant de regarder l'accueil.

   ON NE TESTE PAS `startsWith('.bdv-coque')`, ET C'EST VOULU. Le scope est pose
   sur le CORPS DE PAGE, donc trois ecritures sont justes et toutes utiles :
   `.bdv-coque .zone`, `body.bdv-coque` (le fond de la page) et
   `body.bdv-poste.bdv-coque .bureau-nav__item` (la barre basse, qui a besoin de
   l'etat de session en plus du scope). Ce qu'on exige, c'est que le PREMIER
   compose du selecteur porte la classe : c'est la seule forme qui garantit que
   la regle ne peut pas s'appliquer hors du bureau. */
const SCOPE_COQUE = 'bdv-coque';
const FEUILLE_COQUE = path.join(RACINE, 'src/css/bdv-bureau.css');

if (fs.existsSync(FEUILLE_COQUE)) {
  titre('10 bis. Le scope de src/css/bdv-bureau.css');
  const astC = csstree.parse(fs.readFileSync(FEUILLE_COQUE, 'utf8'));
  const horsScope = [];
  let dedans = 0;
  /* Le premier compose, c'est tout ce qui precede le premier combinateur. */
  const premier = txt => txt.split(/[\s>+~]+/)[0] || '';
  csstree.walk(astC, {
    visit: 'Rule',
    enter(node) {
      if (this.atrule && this.atrule.name === 'keyframes') return;
      if (node.prelude.type !== 'SelectorList') return;
      node.prelude.children.forEach(sel => {
        const txt = csstree.generate(sel);
        if (premier(txt).split('.').includes(SCOPE_COQUE)) { dedans++; return; }
        horsScope.push(txt);
      });
    }
  });
  console.log('  ' + dedans + ' selecteur(s) dont le premier compose porte .' + SCOPE_COQUE);
  if (horsScope.length) {
    [...new Set(horsScope)].slice(0, 12).forEach(f =>
      ko('regle hors scope : ' + f + ' — elle repeindrait la page d\'accueil du site public'));
    if (horsScope.length > 12) ko('et ' + (horsScope.length - 12) + ' autre(s)');
  } else ok('aucune regle du dessin de la coque ne sort de son scope');
}


/* ===========================================================================
   A. ECHELLES FERMEES : COMPTER LES VALEURS DISTINCTES, PAS LES DECLARATIONS
   ---------------------------------------------------------------------------
   La section 4 tolere les tailles de texte sous un plafond de DECLARATIONS.
   C'est la mauvaise unite, et l'audit du 19/09/2026 l'a montre : dix appels a
   `1.05rem` ne sont pas dix fautes, c'est UN pas d'echelle qu'on n'a pas
   baptise. Dix valeurs vues une fois chacune, en revanche, ce sont dix
   echelles qui cohabitent, et c'est ca qui se voit a l'ecran.

   On compte donc, par famille, le nombre de valeurs DISTINCTES qui cohabitent,
   et on le compare a une borne ecrite juste a cote. Une famille qui GAGNE une
   valeur fait echouer le controle, meme si le nombre de declarations baisse.

   CHAQUE BORNE CI-DESSOUS EST LA MESURE DU JOUR, PAS UN IDEAL. C'est un
   PLAFOND A FAIRE BAISSER : le jour ou une valeur est reprise dans un jeton,
   on descend le chiffre a la main. IL NE REMONTE JAMAIS. Une borne qu'on
   remonte pour faire passer le banc est une borne qui ne garde plus rien.

   Cette section attrape d'un coup quatre choses que rien ne regardait :
   les z-index en dur (la section 4 ne connait pas z-index), les tailles en
   dur comptees a la bonne unite, les ombres (la section 4 les compte comme des
   couleurs, pas comme une famille) et les `border-radius: 50%`, que la section
   4 dispense explicitement.
   =========================================================================== */
titre('A. Echelles fermees : combien de valeurs DISTINCTES cohabitent');
{
  /* `1.50rem`, `1.5rem` et `1.5REM` sont le meme pas d'echelle : on normalise
     les nombres avant de dedoublonner, sinon on compte du formatage. */
  const normeVal = v => resout(String(v), B.tokens)
    .toLowerCase()
    .replace(/\s*,\s*/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/(?<![\w.])(\d*\.?\d+)/g, m => String(parseFloat(m)))
    .trim();

  /* BORNES : la mesure du 19/09/2026. Plafond a faire BAISSER, jamais remonter.
     Deux chiffres par famille parce que deux cibles : le site seul (style.css)
     et le bureau, qui charge en plus bdv-ecrans.css, bdv-panneau.css et
     bdv-calendrier.css. Un seul chiffre dispenserait l'une des deux. */
  const FAMILLES = [
    /* nom                        unite                            site  bureau */
    /* 11 pas nommes dans l'echelle (--t-*), et 26 valeurs distinctes ecrites en
       dur a cote sur le site, 35 sur le bureau. L'ecart EST le chantier. */
    ['tailles de texte',          'font-size ecrites en dur',        26,  35],
    /* ZERO, et c'est tenable : tous les rayons du depot passent par un jeton.
       Une borne a zero veut dire qu'un seul `border-radius: 12px` ou
       `border-radius: 50%` de plus fait echouer le banc. C'est voulu. */
    ['rayons d\'arrondi',         'border-radius ecrits en dur',      0,   0],
    /* LA REGLE DU PLATEAU, ecrite en tete de la section MATIERES de style.css,
       n'autorise que DEUX ombres : --ombre-carte et --ombre-dure. Il y en a 15
       distinctes sur le site et 20 sur le bureau. La borne est la mesure du
       jour parce qu'un controle qui echoue des le premier jour ne sera pas lu ;
       la cible ecrite dans la charte, elle, reste 2. Ce chiffre descend. */
    ['ombres',                    'recettes d\'ombre posees',        15,  20],
    ['epaisseurs de filet',       'largeurs de bordure posees',       9,   9],
    /* Les niveaux de superposition sont deja presque tous tokenises (--z-*) :
       ce qui reste distinct, ce sont les `z-index: 1` et `2` poses a la main.
       Une borne serree ici attrape le `z-index: 9999` du prochain correctif
       presse, qui est exactement la facon dont un empilement se derobe. */
    ['niveaux de superposition',  'valeurs de z-index posees',        5,   8],
  ];

  const vals = {};
  FAMILLES.forEach(f => { vals[f[0]] = new Map(); });
  let declTailles = 0;
  const ajoute = (fam, val, sel, ligne) => {
    if (!val) return;
    const m = vals[fam];
    if (!m.has(val)) m.set(val, { n: 0, sel, ligne });
    m.get(val).n++;
  };

  B.regles.forEach(r => {
    const sel = norme(r.sel);
    r.decls.forEach(d => {
      const p = d.prop;
      if (p === 'font-size' && !estRacine(sel) && !/var\(/.test(d.val)) {
        declTailles++;
        ajoute('tailles de texte', normeVal(d.val), sel, d.ligne);
      }
      /* Le `50%` est ici, alors que la section 4 le dispense : un rond est un
         pas d'echelle comme un autre, et il n'y a aucune raison qu'il en
         existe deux ecritures. */
      if (p === 'border-radius' && !estRacine(sel) && !/var\(/.test(d.val)
          && !/^0(px|rem|em|%)?$/.test(d.val.trim()))
        ajoute('rayons d\'arrondi', normeVal(d.val), sel, d.ligne);
      /* Les ombres sont RESOLUES avant d'etre comptees : `var(--ombre-carte)`
         et la recette qu'il porte sont la meme ombre. Ce qu'on compte, ce sont
         les recettes qui arrivent reellement a l'ecran. */
      if (p === 'box-shadow' || p === 'text-shadow') {
        const v = normeVal(d.val);
        if (v && v !== 'none') ajoute('ombres', v, sel, d.ligne);
      }
      if (/^(border|border-(top|right|bottom|left|block|inline)(-start|-end)?|outline)(-width)?$/.test(p)) {
        const v = normeVal(d.val);
        const w = (v.match(/(?<![\w.-])\d*\.?\d+(px|rem|em)/) || [])[0];
        if (w) ajoute('epaisseurs de filet', w, sel, d.ligne);
      }
      if (p === 'z-index') {
        const v = normeVal(d.val);
        if (/^-?\d+$/.test(v)) ajoute('niveaux de superposition', v, sel, d.ligne);
      }
    });
  });

  const pasNommes = Object.keys(B.tokens).filter(t => /^--t-/.test(t)).length;
  console.log('  echelle de texte nommee : ' + pasNommes + ' pas (--t-*) dans :root');

  FAMILLES.forEach(([nom, quoi, bSite, bDash]) => {
    const borne = DASH ? bDash : bSite;
    const m = vals[nom];
    const total = [...m.values()].reduce((s, v) => s + v.n, 0);
    console.log('  ' + nom.padEnd(26) + String(m.size).padStart(3) + ' distincte(s)' +
                ('  sur ' + total + ' ' + quoi).padEnd(38) + 'borne ' + borne);
    if (m.size > borne) {
      const tri = [...m.entries()].sort((a, b) => a[1].n - b[1].n).slice(0, 6);
      ko(nom + ' : ' + m.size + ' valeurs distinctes, la borne est a ' + borne +
         ' — la famille a gagne une valeur. Les plus rares : ' +
         tri.map(([v, o]) => '« ' + v.slice(0, 40) + ' » (' + o.sel.slice(0, 30) + ' L' + o.ligne + ')').join(', '));
    }
  });
  if (!FAMILLES.some(([nom, , bS, bD]) => vals[nom].size > (DASH ? bD : bS)))
    ok('aucune famille n\'a gagne de valeur distincte depuis la derniere mesure');

  /* Les pas d'echelle a baptiser : une valeur en dur repetee assez souvent
     pour meriter un nom. Ce n'est pas un echec, c'est la liste de travail. */
  const repetes = [...vals['tailles de texte'].entries()].filter(([, o]) => o.n >= 4)
    .sort((a, b) => b[1].n - a[1].n);
  if (repetes.length)
    note(repetes.length + ' taille(s) en dur repetee(s) 4 fois ou plus, donc un pas d\'echelle a baptiser : ' +
         repetes.map(([v, o]) => v + ' x' + o.n).join(', '));
}



/* ===========================================================================
   B. ACCESSIBILITE DE LA PAGE CONSTRUITE, HTML ET JAVASCRIPT ENSEMBLE
   ---------------------------------------------------------------------------
   Ce script savait tout du style et rien de l'usage. Or la moitie du bureau
   n'existe pas dans un gabarit : elle nait d'une chaine de caracteres dans
   src/js/*.js, au clic. Un controle qui ne lit que le HTML produit ne voit
   donc RIEN du bureau, et un controle qui ne lit que le JS ne voit rien des
   articles. On lit les deux, dans le meme passage.

   LES COMMENTAIRES NE SONT PAS DU BALISAGE. Meme lecon qu'a la section 5 le
   19/09/2026 : trois `<select>` et un `<input type="date">` du depot vivent
   dans des commentaires qui EXPLIQUENT le code. Les compter, c'est declarer
   non conforme un depot sain, et un banc qui crie sur du sain finit par ne
   plus etre lu. On retire donc les blocs et les lignes de commentaire avant
   de chercher quoi que ce soit.

   Six contrôles. Quatre sont a zero aujourd'hui et echouent a la premiere
   occurrence. Deux ont un reste que l'audit du 19/09/2026 n'a pas repris et
   qui n'est PAS a ce script de corriger : ceux-la ont une borne a la mesure
   du jour, listee ligne par ligne, qui ne remonte jamais.
   =========================================================================== */
titre('B. Accessibilite de la page construite (HTML + JavaScript)');
{
  /* La cible : la page construite qui correspond a l'appel, plus TOUS les
     modules de src/js, parce qu'ils sont la matiere commune des deux. En
     --bureau on lit /mon-bureau/ ; sinon les pages publiques, /mon-bureau/
     exclu, pour que les deux appels ne rapportent pas deux fois la meme chose. */
  const listeHtml = dir => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? listeHtml(p) : (e.name.endsWith('.html') ? [p] : []);
    });
  };
  const bureauHtml = path.join(RACINE, '_site/mon-bureau/index.html');
  const pages = DASH ? (fs.existsSync(bureauHtml) ? [bureauHtml] : [])
                     : listeHtml(path.join(RACINE, '_site')).filter(f => f !== bureauHtml);

  if (!pages.length && !DASH) {
    note('aucune page construite dans _site/ : lance npm run build pour que la section B ait de la matiere');
  }

  /* Deparasitage. Sur le JS : blocs /* *\/ et lignes entieres //. On ne touche
     pas aux // en milieu de ligne, pour ne pas amputer un https://. Sur le
     HTML : les commentaires <!-- -->. Les sauts de ligne sont conserves, sinon
     les numeros de ligne rapportes ne designent plus rien. */
  const garderLignes = m => '\n'.repeat((m.match(/\n/g) || []).length);
  const lave = (txt, estJs) => {
    let t = txt.replace(/<!--[\s\S]*?-->/g, garderLignes);
    if (estJs) t = t.replace(/\/\*[\s\S]*?\*\//g, garderLignes).replace(/^[ \t]*\/\/.*$/gm, '');
    return t;
  };
  const SOURCES = pages.map(f => ({ rel: path.relative(RACINE, f), txt: lave(fs.readFileSync(f, 'utf8'), false), js: false }))
    .concat(fichiersJS_.map(f => ({ rel: path.relative(RACINE, f), txt: lave(fs.readFileSync(f, 'utf8'), true), js: true })));
  const ligneDe = (t, i) => t.slice(0, i).split('\n').length;
  console.log('  lu : ' + pages.length + ' page(s) construite(s) + ' + fichiersJS_.length + ' module(s) src/js');

  /* --- B1. onclick pose ailleurs que sur un bouton ou un lien --------------
     Un <div onclick> n'est ni focalisable ni actionnable au clavier. Trois
     exceptions nommees : <button> et <a>, qui le sont par nature ; <summary>,
     qui l'est aussi et que l'audit a explicitement mis hors cause ; et tout
     element porteur de tabindex, qui a donc ete rendu focalisable expres.
     QUATRIEME EXCEPTION, ET C'EST UN FAUX POSITIF CONNU : le voile de modale
     de bdv-ecrans.js porte `aria-hidden="true"` et un `onclick` qui ferme. Il
     est VOLONTAIREMENT hors de l'arbre d'accessibilite, et la fermeture au
     clavier passe par Escape (voir B4), pas par lui. */
  let b1 = 0;
  SOURCES.forEach(({ rel, txt }) => {
    for (const m of txt.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*\bonclick\s*=[^>]*)>/g)) {
      const tag = m[1].toLowerCase(), attrs = m[2];
      if (tag === 'button' || tag === 'a' || tag === 'summary') continue;
      if (/\btabindex\s*=/.test(attrs)) continue;
      if (/\baria-hidden\s*=\s*["']true/.test(attrs)) continue;
      b1++;
      ko('B1 ' + rel + ' L' + ligneDe(txt, m.index) + ' : onclick sur <' + tag +
         '> sans tabindex — inatteignable au clavier');
    }
  });
  if (!b1) ok('B1 aucun onclick hors <button>/<a> sans tabindex');

  /* --- B2. champ de saisie sans etiquette reliee --------------------------
     Dispenses : les types qui portent leur nom (hidden, submit, button, reset,
     image) ; un champ `hidden` ou `style="display:none"`, qui n'est pas
     atteignable et sert de declencheur derriere un bouton (le `#fileInputReg`
     de bdv-base.js) ; aria-label, aria-labelledby, title ; un `label for=`
     qui vise son id ; une etiquette ENVELOPPANTE.
     UNE BORNE, PAS UN ECHEC SEC : il reste des champs sans etiquette reliee
     dans le depot, listes ci-dessous ligne par ligne. Ce n'est pas a ce
     script de les corriger. Ce qu'il interdit, c'est qu'il y en ait UN DE
     PLUS. Le chiffre descend a chaque champ etiquete ; il ne remonte jamais. */
  /* 3 des deux cotes : les trois champs vivent dans src/js/bdv-base.js, donc
     dans les deux cibles. Mesure du 19/09/2026, plafond a faire baisser. */
  /* ZERO DES DEUX COTES, 19/09/2026. La borne etait a 3 parce qu'il restait trois
     champs sans etiquette dans bdv-base.js : le menu du premier mois d'exercice, le
     menu de colonne rendu deux fois par selectChamp(), et l'entree de renommage du
     classement. Les trois ont recu leur etiquette le jour meme. Une borne qui laisse
     du mou ne garde rien : le premier champ non etiquete ajoute doit faire echouer. */
  const BORNE_B2 = 0;
  let b2 = 0;
  console.log('  B2 champs sans etiquette reliee :');
  SOURCES.forEach(({ rel, txt }) => {
    const pourIds = new Set([...txt.matchAll(/<label\b[^>]*\bfor\s*=\s*["']([^"']+)["']/g)].map(m => m[1]));
    for (const m of txt.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
      const tag = m[1].toLowerCase(), attrs = m[2];
      const type = (attrs.match(/\btype\s*=\s*["']?([\w-]+)/) || [, 'text'])[1].toLowerCase();
      if (tag === 'input' && ['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
      if (/\bhidden\b(?!-)/.test(attrs) || /display\s*:\s*none/.test(attrs)) continue;
      if (/\baria-label\s*=|\baria-labelledby\s*=|\btitle\s*=/.test(attrs)) continue;
      const id = (attrs.match(/\bid\s*=\s*["']([^"']+)["']/) || [])[1];
      if (id && pourIds.has(id)) continue;
      /* Etiquette enveloppante : le <label> ouvert le plus proche en amont
         n'est pas encore referme. `<label class="chk"><input ...> joignables`
         de bdv-ecrans.js est exactement ce cas. */
      const avant = txt.slice(0, m.index);
      const ouvre = avant.lastIndexOf('<label'), ferme = avant.lastIndexOf('</label>');
      if (ouvre >= 0 && ouvre > ferme) continue;
      /* Cellule de tableau annotee : ce depot pose `data-libelle` sur chaque
         <td> pour que la table se replie en fiches sur telephone. Le libelle
         de colonne est donc ecrit a cote du champ. Association faible, pas
         absence d'etiquette : on la compte dans la borne et on la nomme. */
      const cell = avant.lastIndexOf('<td'), finCell = avant.lastIndexOf('</td>');
      const dansCellule = cell >= 0 && cell > finCell && /data-libelle/.test(avant.slice(cell, cell + 200));
      b2++;
      console.log('        ' + rel + ' L' + ligneDe(txt, m.index) + '  <' + tag + '> ' +
                  (dansCellule ? '(cellule annotee data-libelle) ' : '') +
                  m[0].replace(/\s+/g, ' ').slice(0, 90));
    }
  });
  if (b2 > BORNE_B2) ko('B2 ' + b2 + ' champ(s) sans etiquette reliee, la borne est a ' + BORNE_B2 +
                        ' — un champ non etiquete a ete ajoute');
  else ok('B2 ' + b2 + ' champ(s) sans etiquette reliee, sous la borne de ' + BORNE_B2);

  /* --- B3. outline: none sans remplacement de focus ------------------------
     Retirer le cerclage sans rien mettre a la place, c'est rendre le clavier
     aveugle. On exige qu'une regle :focus, :focus-visible ou :focus-within du
     meme BLOC pose quelque chose de visible.
     Le « meme bloc » et non « le meme selecteur » : le cas reel du depot est
     `.bdv-ventes .saisie__txt:focus{outline:none}`, dont le remplacement est
     sur `.bdv-ventes .saisie:focus-within`, l'encadrement du champ. Exiger le
     selecteur a l'identique aurait crie sur une correction faite le matin
     meme. On remonte donc du dernier maillon a son bloc BEM. */
  const classesDe = s => [...s.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map(m => m[1]);
  const dernierMaillon = s => s.split(/\s+|>|\+|~/).filter(Boolean).pop() || s;
  /* Une liste de selecteurs se coupe aux virgules DE PREMIER NIVEAU. Couper
     bêtement sur ',' dechire `:where(a, button, summary)` en morceaux qui ne
     sont plus des selecteurs, et l'un d'eux, `button`, s'est retrouve compte
     comme une ancre de focus valable pour tout le depot. */
  const coupeVirgules = s => {
    const out = []; let prof = 0, cur = '';
    for (const ch of s) {
      if (ch === '(' || ch === '[') prof++;
      else if (ch === ')' || ch === ']') prof--;
      if (ch === ',' && prof === 0) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
  };
  const blocDe = c => c.split('__')[0];
  const VISIBLE = /^(outline|outline-color|outline-offset|box-shadow|border|border-color|border-[a-z]+-color|border-width|background|background-color|color|text-decoration)$/;
  const ancresFocus = new Set();
  B.regles.forEach(r => {
    if (!/:focus/.test(r.sel)) return;
    if (!r.decls.some(d => VISIBLE.test(d.prop) && !/^none$|^0$/.test(d.val.trim()))) return;
    coupeVirgules(r.sel).forEach(s => {
      /* Selecteur par selecteur, et seulement ceux qui portent VRAIMENT le
         focus : dans `.x:hover, .y:focus {...}`, seul `.y` est une ancre. */
      if (!/:focus/.test(s)) return;
      const dm = dernierMaillon(norme(s));
      classesDe(dm).forEach(c => { ancresFocus.add(c); ancresFocus.add(blocDe(c)); });
      const el = dm.replace(/[:.\[][\s\S]*$/, '');
      if (el) ancresFocus.add(el);
    });
  });
  let b3 = 0;
  B.regles.forEach(r => {
    if (!r.decls.some(d => d.prop === 'outline' && /^(none|0)$/.test(d.val.trim()))) return;
    coupeVirgules(r.sel).forEach(s => {
      const dm = dernierMaillon(norme(s));
      const cl = classesDe(dm);
      const ancres = cl.length ? cl.flatMap(c => [c, blocDe(c)]) : [dm.replace(/[:.\[][\s\S]*$/, '')];
      if (ancres.some(a => a && ancresFocus.has(a))) return;
      b3++;
      ko('B3 L' + r.ligne + ' : ' + norme(s) + ' pose outline:none sans regle :focus visible sur le meme bloc');
    });
  });
  if (!b3) ok('B3 tout outline:none a son remplacement de focus');

  /* --- B4. role="dialog" sans echappement ---------------------------------
     Une boite modale qu'on ne peut pas fermer au clavier est un piege. La
     regle naive « un ecouteur Escape dans le meme fichier » est FAUSSE ici, et
     bdv-ecrans.js le dit en toutes lettres a sa ligne 2433 : l'ecouteur est
     unique, global, pose dans bdv-base.js, et il appelle `fermerFiche()`. En
     poser un deuxieme serait la faute. On accepte donc l'ecouteur d'un autre
     module A CONDITION qu'il nomme une fonction DEFINIE par le fichier qui
     construit la boite : c'est ce lien-la qui prouve la couverture, pas la
     simple presence du mot Escape quelque part dans le depot. */
  const RE_ESC = /['"]Escape['"]|keyCode\s*===?\s*27|which\s*===?\s*27/;
  const lignesEsc = [];
  SOURCES.forEach(({ rel, txt }) => txt.split('\n').forEach((l, i) => {
    if (RE_ESC.test(l)) lignesEsc.push({ rel, ligne: i + 1, ids: new Set(l.match(/[A-Za-z_$][\w$]*/g) || []) });
  }));
  let b4 = 0;
  console.log('  B4 boites modales et leur echappement :');
  SOURCES.forEach(({ rel, txt }) => {
    if (!/role\s*=\s*["']dialog["']/.test(txt)) return;
    if (RE_ESC.test(txt)) { console.log('        ' + rel + ' : dialog + Escape dans le meme fichier'); return; }
    const definies = new Set([...txt.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
    const relai = lignesEsc.find(e => e.rel !== rel && [...e.ids].some(id => definies.has(id)));
    if (relai) {
      console.log('        ' + rel + ' : dialog ferme par l\'ecouteur global de ' + relai.rel + ' L' + relai.ligne);
      return;
    }
    const i = txt.search(/role\s*=\s*["']dialog["']/);
    b4++;
    ko('B4 ' + rel + ' L' + ligneDe(txt, i) + ' : role="dialog" sans ecouteur Escape, ni ici ni relaye ailleurs');
  });
  if (!b4) ok('B4 toute role="dialog" a son echappement clavier');

  /* --- B5. image sans alt --------------------------------------------------
     `alt=""` est une reponse valable : il dit « decorative ». C'est l'ABSENCE
     d'attribut qui laisse un lecteur d'ecran lire l'URL du fichier. */
  let b5 = 0;
  SOURCES.forEach(({ rel, txt }) => {
    for (const m of txt.matchAll(/<img\b([^>]*)>/gi)) {
      if (/\balt\s*=/.test(m[1])) continue;
      b5++;
      ko('B5 ' + rel + ' L' + ligneDe(txt, m.index) + ' : <img> sans alt — ' + m[0].slice(0, 70));
    }
  });
  if (!b5) ok('B5 toutes les images portent un alt');

  /* --- B6. saut de niveau de titre ----------------------------------------
     Un h1 suivi d'un h3 laisse un trou dans le plan de la page : au lecteur
     d'ecran, un niveau a disparu. On ne compte QUE les sauts vers le bas du
     plan (h1 -> h3), pas les remontees, qui sont normales a la fin d'une
     section. On ne compte pas non plus les h1 multiples : la page du bureau en
     porte DEUX, celui de la porte et celui du bureau ouvert, dont un seul est
     affiche a la fois selon qu'on est connecte ou non. Ce n'est pas un defaut.
     BORNE, PAS ECHEC SEC, pour la meme raison qu'en B2 : il reste un saut dans
     le depot et sa correction n'appartient pas a ce fichier. */
  /* 4 sur le site, 0 sur le bureau. Les quatre sont la MEME faute, vue sur
     quatre pages : src/_includes/components/liste-articles.njk L27 ouvre ses
     entrees en <h3>, et sur les pages de rubrique le titre qui precede est le
     <h1> de src/rubriques.njk L37. Il manque un cran. Mesure du 19/09/2026. */
  /* ZERO DES DEUX COTES, 19/09/2026. La borne du site etait a 4 pour un seul defaut
     vu quatre fois : liste-articles.njk ouvrait ses entrees en <h3> alors que le
     titre precedent est le <h1> de rubriques.njk. Corrige en <h2> le jour meme. */
  const BORNE_B6 = 0;
  let b6 = 0;
  console.log('  B6 sauts de niveau de titre :');
  SOURCES.forEach(({ rel, txt }) => {
    let prec = null;
    for (const m of txt.matchAll(/<h([1-6])\b/gi)) {
      const n = Number(m[1]);
      if (prec !== null && n > prec + 1) {
        b6++;
        console.log('        ' + rel + ' L' + ligneDe(txt, m.index) + '  h' + prec + ' -> h' + n);
      }
      prec = n;
    }
  });
  if (b6 > BORNE_B6) ko('B6 ' + b6 + ' saut(s) de niveau de titre, la borne est a ' + BORNE_B6 +
                        ' — un titre a saute un cran');
  else ok('B6 ' + b6 + ' saut(s) de niveau de titre, sous la borne de ' + BORNE_B6);
}



/* ===========================================================================
   C. CE QUI VOYAGE ET CE QUI NE SERT A RIEN
   ---------------------------------------------------------------------------
   Ce script savait dire qu'une regle etait mal ecrite, jamais qu'elle ne
   correspondait a rien. On croise donc les feuilles avec le balisage REEL :
   les pages construites de _site/, les modules de src/js qui fabriquent le
   bureau au clic, les donnees de src/_data, et les gabarits de src/.

   LES CLASSES ASSEMBLEES EN VOL SONT LE PIEGE DE CE CONTROLE. `signal--danger`
   n'est ecrit nulle part : bdv-base.js ecrit `signal signal--${kind}`. Un
   controle naif declare la regle morte, on la supprime, et un etat d'alerte
   perd sa couleur en production. On cherche donc, quand le nom complet est
   introuvable, le PREFIXE jusqu'au dernier `--`. Les familles connues du
   depot : `signal--`, `pr-sig--`, `conf--`, `bdv-amorce__etape--`. Inventer un
   defaut coute aussi cher que d'en laisser passer un.

   Trois chiffres, et UN SEUL est un echec :
     1. les octets de regles dont aucune classe n'existe nulle part. 37 regles
        mortes ont ete supprimees le 19/09/2026 : ce chiffre doit rester bas,
        et sa borne ne remonte jamais.
     2 et 3. DEUX THERMOMETRES, PAS DES ECHECS. Ils mesurent l'etat d'un
        chantier ouvert, la SCISSION DE style.css, qui pese 320 ko et part
        entier dans le bureau. On les pose a la mesure du jour pour voir le
        chiffre BOUGER d'une construction a l'autre ; ce n'est pas une dette a
        reparer tout de suite, et les faire echouer aujourd'hui rendrait le
        banc inutilisable sans rien accelerer.
   =========================================================================== */
titre('C. Regles mortes, composants non inclus, feuille qui voyage');
{
  const lireSi = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const liste = (dir, ext) => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? liste(p, ext) : (e.name.endsWith(ext) ? [p] : []);
    });
  };
  const mots = txt => new Set(txt.match(/[A-Za-z_][\w-]*/g) || []);
  const fusion = (a, b) => { b.forEach(x => a.add(x)); return a; };

  /* --- 1. Quels gabarits d'includes sont reellement atteints -------------- */
  const tousNjk = liste(path.join(RACINE, 'src'), '.njk');
  const pagesNjk = tousNjk.filter(f => !f.includes(path.sep + '_includes' + path.sep));
  const LAYOUTS = ['base.njk', 'article.njk'].map(f => path.join(RACINE, 'src/_includes', f)).filter(fs.existsSync);
  const atteints = new Set();
  const file = pagesNjk.concat(LAYOUTS);
  while (file.length) {
    const f = file.pop();
    if (atteints.has(f)) continue;
    atteints.add(f);
    inclusPar(f).forEach(g => { if (!atteints.has(g)) file.push(g); });
  }
  const orphelins = tousNjk.filter(f => !atteints.has(f));

  /* --- 2. Le balisage qui part reellement en production ------------------- */
  const MARQUAGE = new Set();
  liste(path.join(RACINE, '_site'), '.html').forEach(f => fusion(MARQUAGE, mots(fs.readFileSync(f, 'utf8'))));
  fichiersJS_.forEach(f => fusion(MARQUAGE, mots(fs.readFileSync(f, 'utf8'))));
  liste(path.join(RACINE, 'src/_data'), '.js').forEach(f => fusion(MARQUAGE, mots(fs.readFileSync(f, 'utf8'))));
  [...atteints].forEach(f => fusion(MARQUAGE, mots(fs.readFileSync(f, 'utf8'))));
  const MOTS_ORPHELINS = new Set();
  orphelins.forEach(f => fusion(MOTS_ORPHELINS, mots(fs.readFileSync(f, 'utf8'))));

  /* Le bureau : sa page construite, ses modules, son gabarit et ses includes.
     La coque partagee (entete, pied) est dans la page construite, donc prise. */
  const BUREAU = new Set();
  const pageBureau = path.join(RACINE, '_site/mon-bureau/index.html');
  fusion(BUREAU, mots(lireSi(pageBureau)));
  const gabBureau = path.join(RACINE, 'src/mon-bureau.njk');
  fusion(BUREAU, mots(lireSi(gabBureau)));
  inclusPar(gabBureau).forEach(f => fusion(BUREAU, mots(fs.readFileSync(f, 'utf8'))));
  fichiersJS_.forEach(f => fusion(BUREAU, mots(fs.readFileSync(f, 'utf8'))));

  /* La classe assemblee en vol : a defaut du nom entier, le prefixe jusqu'au
     dernier `--`. Memorise, parce qu'un gros depot repose les memes classes
     des milliers de fois. */
  const cache = new Map();
  const presente = (cls, ens, cle) => {
    const k = cle + '\u0000' + cls;
    if (cache.has(k)) return cache.get(k);
    let v = ens.has(cls);
    if (!v) {
      const i = cls.lastIndexOf('--');
      if (i > 0) v = ens.has(cls.slice(0, i + 2));
    }
    cache.set(k, v);
    return v;
  };

  /* --- 3. Les regles, avec leur poids en octets --------------------------- */
  function reglesPesees(texte) {
    const out = [];
    let ast;
    try { ast = csstree.parse(texte, { positions: true, onParseError() {} }); }
    catch (e) { return out; }
    csstree.walk(ast, {
      visit: 'Rule',
      enter(node) {
        if (this.atrule && this.atrule.name === 'keyframes') return;
        if (!node.loc || node.prelude.type !== 'SelectorList') return;
        const sels = node.prelude.children.toArray().map(s => csstree.generate(s));
        out.push({ sels, octets: node.loc.end.offset - node.loc.start.offset,
                   ligne: node.loc.start.line });
      }
    });
    return out;
  }
  const classesDeSel = s => [...s.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map(m => m[1]);
  /* UN SELECTEUR EST INERTE quand il ne peut correspondre a rien : une de ses
     classes OBLIGATOIRES manque du balisage, ou bien un groupe d'ALTERNATIVES
     `:where()` / `:is()` a perdu toutes les siennes. Sans ce traitement des
     groupes, `:where(.nav,.hero,.waitlist,...)` serait declare inerte des que
     l'une des classes disparait, alors qu'il lui suffit d'une seule. C'est
     exactement le genre de faux positif qui fait supprimer une regle vivante. */
  const inerte = (sel, ens, cle) => {
    const re = /:(?:where|is|matches|any)\(([^()]*)\)/gi;
    const groupes = [...sel.matchAll(re)].map(m => m[1]);
    const obligatoires = classesDeSel(sel.replace(/:(?:where|is|matches|any)\(([^()]*)\)/gi, ' '));
    if (!obligatoires.length && !groupes.length) return null;
    const manquantes = obligatoires.filter(c => !presente(c, ens, cle));
    if (manquantes.length) return manquantes;
    for (const g of groupes) {
      const cg = classesDeSel(g);
      if (cg.length && cg.every(c => !presente(c, ens, cle))) return cg;
    }
    return null;
  };
  const TOUT = new Set(MARQUAGE);
  MOTS_ORPHELINS.forEach(m => TOUT.add(m));

  /* --- 4. Regles mortes et regles de composants non inclus ---------------- */
  let oMortes = 0, nMortes = 0, oOrph = 0, nOrph = 0;
  const exemplesMortes = [], exemplesOrph = [];
  reglesPesees(B.txt).forEach(r => {
    /* morte  : inerte meme en comptant les gabarits non inclus ; la classe
                n'existe NULLE PART, ni en production ni dans un composant range.
       orpheline : vivante seulement dans un composant de src/_includes/ que
                plus aucune page n'inclut. */
    const toutesMortes   = r.sels.every(s => inerte(s, TOUT, 't'));
    const toutesInertes  = r.sels.every(s => inerte(s, MARQUAGE, 'm'));
    if (toutesMortes) {
      oMortes += r.octets; nMortes++;
      if (exemplesMortes.length < 10) exemplesMortes.push('L' + r.ligne + ' ' + r.sels[0].slice(0, 46) + ' (' + r.octets + ' o)');
    } else if (toutesInertes) {
      oOrph += r.octets; nOrph++;
      if (exemplesOrph.length < 10) exemplesOrph.push('L' + r.ligne + ' ' + r.sels[0].slice(0, 46) + ' (' + r.octets + ' o)');
    }
  });

  const ko3 = n => (n / 1024).toFixed(1) + ' ko';
  /* BORNE 1 : la seule des trois qui fait echouer. Mesure du 19/09/2026, juste
     apres la suppression des 37 regles mortes. Elle ne remonte jamais. */
  /* 5 080 octets sur le site, 5 705 sur le bureau : la mesure du 19/09/2026,
     apres la suppression des 37 regles mortes de la matinee. Les 625 octets
     d'ecart sont quatre regles de src/css/bdv-ecrans.css que seul l'appel
     --bureau lit : `.bdv-ventes .btn--type` (L213 a L215) et
     `.bdv-ventes .fiche__msg` (L457), dont plus aucun module ne pose la classe.
     EN OCTETS ET NON EN NOMBRE DE REGLES : reformater une feuille change le
     nombre de regles, pas le poids de ce qui ne sert a rien. Borne a faire
     BAISSER a chaque suppression, elle ne remonte jamais. */
  /* 5 080 DES DEUX COTES, 19/09/2026. La borne du bureau etait a 5 705 : les
     625 octets d'ecart etaient quatre regles mortes de bdv-ecrans.css que seul
     l'appel --bureau voyait, `.btn--type` et ses deux etats, plus `.fiche__msg`.
     Elles sont parties, les deux cotes mesurent donc la meme chose.
     CE CHIFFRE NE REMONTE JAMAIS : il descend dans le meme commit que chaque
     suppression. */
  const BORNE_MORTES = 5080;
  console.log('  regles dont aucune classe n\'existe nulle part : ' + nMortes + ' regle(s), ' +
              ko3(oMortes) + ' (' + oMortes + ' o)   borne ' + ko3(BORNE_MORTES) + ' (' + BORNE_MORTES + ' o)');
  exemplesMortes.forEach(e => console.log('        ' + e));
  if (oMortes > BORNE_MORTES)
    ko('C1 ' + oMortes + ' octets de regles mortes, la borne est a ' + BORNE_MORTES +
       ' — une regle a perdu son balisage, ou une classe a ete renommee d\'un seul cote');
  else ok('C1 ' + oMortes + ' octets de regles mortes, sous la borne de ' + BORNE_MORTES);

  console.log('  regles de composants de src/_includes/ qu\'aucune page n\'inclut : ' +
              nOrph + ' regle(s), ' + ko3(oOrph));
  console.log('        composant(s) non inclus : ' +
              (orphelins.length ? orphelins.map(f => path.basename(f)).join(', ') : 'aucun'));
  exemplesOrph.forEach(e => console.log('        ' + e));
  note('THERMOMETRE 1 (n\'echoue pas) : ' + ko3(oOrph) + ' de style pour des composants hors page');

  /* --- 5. Ce qui ne peut servir qu'au site public et part dans le bureau --- */
  if (!fs.existsSync(pageBureau)) {
    note('THERMOMETRE 2 non calcule : _site/mon-bureau/index.html est absent (npm run build)');
  } else {
    const texteStyle = lireSi(path.join(RACINE, 'src/css/style.css'));
    let oPublic = 0, nPublic = 0, oTotal = 0;
    const exemples = [];
    reglesPesees(texteStyle).forEach(r => {
      oTotal += r.octets;
      /* vivante en production... et inerte partout dans le bureau. */
      const vivante = r.sels.some(s => !inerte(s, MARQUAGE, 'm'));
      const toutesPubliques = vivante && r.sels.every(s => inerte(s, BUREAU, 'b'));
      if (toutesPubliques) {
        oPublic += r.octets; nPublic++;
        if (exemples.length < 8) exemples.push('L' + r.ligne + ' ' + r.sels[0].slice(0, 46) + ' (' + r.octets + ' o)');
      }
    });
    console.log('  style.css : ' + ko3(oTotal) + ' de regles, dont ' + ko3(oPublic) +
                ' (' + nPublic + ' regle(s)) qui ne peuvent servir qu\'au site public');
    exemples.forEach(e => console.log('        ' + e));
    note('THERMOMETRE 2 (n\'echoue pas) : ' + ko3(oPublic) +
         ' de style.css voyagent dans le bureau sans pouvoir s\'y appliquer');
  }
}


/* ---------------------------------------------------------------------------
   Verdict
--------------------------------------------------------------------------- */
titre('VERDICT');
console.log('  echecs : ' + ERR + '   notes : ' + NOTES);
if (ERR) { console.log('  NON CONFORME'); process.exit(1); }
console.log('  CONFORME');
process.exit(0);

