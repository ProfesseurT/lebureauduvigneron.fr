/* ==========================================================================
   BANC DE L'APPLICATION POSEE SUR UN ECRAN D'ACCUEIL, 11/09/2026
   ==========================================================================
   Ted va dire a des vignerons d'installer /mon-bureau/ sur leur iPhone. Ce banc
   garde les invariants sans lesquels ce geste ne produit pas ce qu'on lui annonce,
   ou pire, produit une application dont on ne peut plus ressortir.

   L'ORDRE EST LA CHOSE A RETENIR, et c'est pour ca que ce banc existe plutot qu'un
   paragraphe dans CLAUDE.md : declarer le mode plein ecran rend REELS, d'un seul
   coup, tous les culs-de-sac d'une page sans bouton retour. Les deux moities ne
   peuvent pas voyager separement. Ce banc echoue si le manifeste est la sans les
   sorties, ET si les sorties sont la sans le manifeste.

   IL LIT LA PAGE CONSTRUITE, `_site/mon-bureau/index.html`, et pas le gabarit : les
   balises de tete vivent dans le layout, lire le gabarit c'est ne rien lire puis
   l'annoncer conforme. C'est le piege qui s'est referme trois fois le 07/09/2026.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, ko = 0;
const dit = (v, quoi, detail) => {
  if (v) { ok++; console.log('  OK   ' + quoi); }
  else { ko++; console.log('  ECHEC ' + quoi + (detail ? '\n        ' + detail : '')); }
};
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');
const existe = f => fs.existsSync(path.join(RACINE, f));

/* Un controle qui ne peut pas s'executer doit CRIER, jamais se taire. */
if (!existe('_site/mon-bureau/index.html')) {
  console.log('\n  ECHEC la page construite manque : lance `npm run build` avant ce banc.\n');
  process.exit(1);
}
const page = lire('_site/mon-bureau/index.html');

console.log('\n== 1. Le manifeste est servi, et il est complet ==');
dit(existe('_site/manifest.webmanifest'),
    'le manifeste est copie a la racine de _site',
    'Eleventy ne copie que css, js et assets : sans la ligne de .eleventy.js, la page declare un manifeste qui rend 404, en silence.');
let man = null;
if (existe('_site/manifest.webmanifest')) {
  try { man = JSON.parse(lire('_site/manifest.webmanifest')); } catch (e) { }
  dit(!!man, 'le manifeste est du JSON valide');
}
if (man) {
  dit(man.display === 'standalone', 'display vaut standalone', String(man.display));
  dit(man.start_url === '/mon-bureau/', 'start_url ouvre le bureau', String(man.start_url));
  /* Un nom court de plus de douze signes est tronque sous l'icone, et « Le Bureau du
     Vign… » sur un ecran d'accueil ne se lit pas. */
  dit(typeof man.short_name === 'string' && man.short_name.length <= 12,
      'short_name tient sous une icone (12 signes au plus)', String(man.short_name));
  dit(!!man.theme_color && !!man.background_color, 'theme_color et background_color sont poses');
  const icones = man.icons || [];
  dit(icones.length >= 2, 'au moins deux icones declarees');
  dit(icones.some(i => i.purpose && i.purpose.includes('maskable')),
      'une icone masquable : Android rogne bien plus qu iOS');
  /* Une icone declaree et absente ne leve aucune erreur : le systeme retombe sur une
     vignette de la page, et personne ne s'en apercoit avant d'avoir installe. */
  const manquantes = icones.map(i => i.src).filter(src => !existe(path.join('_site', src)));
  dit(manquantes.length === 0, 'toutes les icones declarees existent vraiment', manquantes.join(', '));
}
dit(existe('_site/assets/apple-touch-icon.png'),
    'l icone iOS existe',
    'Sans elle, iOS pose sur l ecran d accueil une capture reduite du haut de la page.');

console.log('\n== 2. La tete de la page dit ce qu il faut a iOS ==');
dit(/<link[^>]+rel="manifest"/.test(page), 'la page lie le manifeste');
dit(/<link[^>]+rel="apple-touch-icon"/.test(page), 'la page declare l icone iOS');
dit(/name="apple-mobile-web-app-capable"\s+content="yes"/.test(page),
    'apple-mobile-web-app-capable est pose',
    'Safari ne lit PAS display:standalone du manifeste pour decider du plein ecran : il lit cette balise. La retirer parce qu elle est marquee obsolete ailleurs ferait retomber toutes les installations en simple signet, sans erreur.');
dit(/name="apple-mobile-web-app-title"/.test(page), 'le nom sous l icone est choisi');
dit(/name="theme-color"/.test(page), 'theme-color est pose');

console.log('\n== 3. viewport-fit=cover, sans quoi toute zone sure vaut zero ==');
const vp = (page.match(/<meta name="viewport" content="([^"]*)"/) || [])[1] || '';
dit(/viewport-fit=cover/.test(vp), 'le viewport porte viewport-fit=cover',
    'Sans lui, TOUS les env(safe-area-inset-*) du depot valent zero, y compris le retrait ecrit sous la barre des pieces : du code mort qu on croit actif. Lu : ' + vp);
/* Le zoom involontaire des champs se corrige dans le CSS, jamais ici. */
dit(!/maximum-scale|user-scalable/.test(vp),
    'le viewport ne bride PAS le zoom de l utilisateur',
    'maximum-scale supprimerait aussi le zoom volontaire, celui dont a besoin quelqu un qui voit mal.');

console.log('\n== 4. On peut RESSORTIR d une application sans bouton retour ==');
const nav = lire('src/js/bdv-nav.js');
dit(/navigator\.standalone|display-mode:\s*standalone/.test(nav),
    'bdv-nav.js sait qu il tourne en plein ecran');
dit(/a\.target\s*=\s*'_blank'/.test(nav),
    'les liens qui sortent du bureau ouvrent une vue avec un bouton OK',
    'Sinon un article ouvert depuis « A lire » est un cul-de-sac : ni barre d adresse, ni fleche retour, et la seule issue est de fermer l application.');
dit(/u\.protocol !== 'http:'/.test(nav),
    'tel: et mailto: ne sont pas captures par cette regle',
    'Un lien tel: ouvert dans un onglet ne composerait rien du tout.');
const reg = lire('src/js/bdv-reglages.js');
dit(/location\.replace\('\/mon-bureau\/'\)/.test(reg),
    'se deconnecter repose dans le bureau, pas sur la brochure',
    'Renvoyer sur / laissait le vigneron sur le site public, dans son app, sans chemin de retour visible.');
const njk = lire('src/mon-bureau.njk');
dit(/data-bdv-mode="connexion"/.test(njk),
    'la porte du bureau ouvre sur la CONNEXION',
    'Une app iOS a son propre stockage : a la premiere ouverture le vigneron est deconnecte. En mode inscription, il reinscrivait son adresse et recevait « Un compte existe deja ».');

console.log('\n== 5. Le stockage survit a une semaine sans ouvrir ==');
const compte = lire('src/js/bdv-compte.js');
dit(/navigator\.storage\.persist\(\)/.test(compte),
    'le mode persistant est demande',
    'WebKit est explicite : une app d ecran d accueil n a AUCUNE exemption d eviction. Sans persist(), une semaine sans ouvrir rend le bureau deconnecte et la base vide.');
dit(/visibilitychange/.test(compte) && /rafraichirSiPerime/.test(compte),
    'la session se rafraichit au RETOUR dans l application',
    'Le jeton vaut une heure et une app posee sur un ecran d accueil ne recharge pas le document : au retour, tout repondait 401 en silence.');

console.log('\n== 6. Le doigt : ce que le CSS doit porter ==');
const ce = lire('src/css/bdv-ecrans.css');
dit(/@media \(max-width: 700px\)/.test(ce),
    'bdv-ecrans.css porte enfin un bloc telephone',
    'Cette feuille n avait aucun point de rupture sous 640 px : les cinq ecrans de vente et la fiche client restaient en version ordinateur retrecie.');
dit(/\.msg__texte,?\s*[\s\S]{0,400}font-size: var\(--t-corps\)/.test(ce) || /--t-corps/.test(ce.split('LE TELEPHONE')[1] || ''),
    'les saisies passent a 16 px sous 700 px',
    'Sous 16 px, Safari iOS zoome la page a la mise au point et n en ressort pas seul.');
dit(/:has\(> table\.data\)/.test(ce),
    'les cartes a tableau defilent dans leur cadre',
    '.content porte overflow-x:hidden : une colonne qui depassait n etait pas repoussee, elle etait RASEE. Un debordement qui se cache est un chiffre faux.');
dit(/100dvh/.test(ce),
    'la fiche plein ecran est calee sur 100dvh',
    '100vh vaut la hauteur SANS les barres d iOS : le bouton « Enregistrer », qui pose la trace de l appel, passait dessous.');

const cal = lire('src/css/bdv-calendrier.css');
dit(/\.bdv-cal \.cal__coche,/.test(cal),
    'la regle des 44 px du calendrier vise les COCHES',
    'Elle visait .calf__m, le signe de lune, un span aria-hidden qu on ne clique pas. Et comme la pastille de la grille porte pointer-events:none, cocher une DRM n avait aucune cible conforme, dans aucune vue.');
dit(!/\.bdv-cal \.calf__m \{ min-height: 44px/.test(cal),
    'et elle ne vise plus le glyphe decoratif',
    'Un min-height sur ce span gonflait au passage une case sur trois de la grille du mois.');

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BUREAU NE S\'INSTALLE PAS COMME IL LE DIT\n'); process.exit(1); }
console.log('  LE BUREAU S\'INSTALLE, ET ON PEUT EN RESSORTIR\n');
process.exit(0);
