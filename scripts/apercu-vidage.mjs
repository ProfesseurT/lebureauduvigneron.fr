/* ============================================================================
   scripts/apercu-vidage.mjs : LE VOILE DU VIDAGE, DANS SES CINQ ETATS

     npm run apercu:vidage        ecrit _apercu/vidage.html

   IL NE VERIFIE RIEN, IL MONTRE. `npm run banc:vidage` prouve l'ordre des
   appels, le point de sortie unique et les trois verdicts de la verification ;
   il ne peut pas prouver qu'un voile se VOIT. Un banc en jsdom ne fait aucune
   mise en page et ne rejoue aucune cascade. Que le voile couvre le panneau de
   reglages, que le bilan chiffre se lise dans les deux themes, que « Fermer »
   ressemble a un bouton : ca se regarde sur une image, et nulle part ailleurs.
   C'est la regle du 11/09/2026, payee huit fois depuis : la mesure trouve ce
   qu'on ne voit pas, la capture voit ce qu'on ne mesure pas.

   LE BALISAGE VIENT DU VRAI FICHIER. On extrait les fonctions du voile de
   `src/js/bdv-base.js` et on les joue, au lieu de recopier leur HTML ici : une
   maquette recopiee derive du produit des la premiere semaine, et ce depot a
   deja paye ce defaut sur l'etape 03 de la page d'accueil.

   ET LES FEUILLES VIENNENT DU SOCLE, donc de la page CONSTRUITE. Cinq apercus
   ont rendu des ecrans NUS pendant une journee entiere en ne posant que
   `style.css` apres la scission du 21/09/2026. `npm run banc:apercus` tient
   cette regle, il ne la rappelle pas.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cssBureau, TETE_POLICES, chargerJsdom } from './apercu-socle.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = path.join(RACINE, '_apercu/vidage.html');
const src = fs.readFileSync(path.join(RACINE, 'src/js/bdv-base.js'), 'utf8');

const JSDOM = await chargerJsdom();

/* On ne monte pas le moteur entier : il ouvre IndexedDB, lit une session et
   demande le reseau. On extrait les sept fonctions du voile et les deux
   utilitaires qu'elles appellent. Si l'une d'elles est renommee, ce fichier
   s'arrete en le disant, plutot que de montrer une planche a moitie vide. */
function extraire(nom, forme) {
  const m = src.match(forme);
  if (!m) { console.error('\n  ' + nom + ' introuvable dans src/js/bdv-base.js : l\'apercu ne montrerait rien.\n'); process.exit(2); }
  return m[0];
}
const MORCEAUX = [
  extraire('el()',            /function el\(id\)\{[^\n]*\n/),
  extraire('fmtNum()',        /function fmtNum\([^\n]*\n/),
  extraire('plur()',          /function plur\([^\n]*\n/),
  extraire('VIDAGE_ETAPES',   /const VIDAGE_ETAPES = \[[\s\S]*?\];/),
  'var VIDAGE_VOILE = null, VIDAGE_LIGNES = null;',
  extraire('vidageMonter()',  /function vidageMonter\(\)\{[\s\S]*?\n\}/),
  extraire('vidageDire()',    /function vidageDire\([\s\S]*?\n\}/),
  extraire('vidagePreciser()',/function vidagePreciser\([\s\S]*?\n\}/),
  extraire('vidageFin()',     /function vidageFin\([\s\S]*?\n\}/),
  /* `vidageFin()` accroche `vidageDemonter` au bouton « Fermer » : l'oublier ici ne se
     voit pas sur la planche, ca leve dans la console de jsdom et la page sort quand meme. */
  extraire('vidageDemonter()',/function vidageDemonter\(\)\{[\s\S]*?\n\}/),
  extraire('vidageBilan()',   /function vidageBilan\([\s\S]*?\n\}/)
].join('\n');

function jouer(scenario) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window;
  const s = w.document.createElement('script');
  /* LE SCENARIO EST COLLE DANS LE MEME SCRIPT, et pas passe a `new Function`. Un
     `const` de premier niveau d'un script classique vit dans la portee du SCRIPT, pas
     sur `window` : une fonction fabriquee a cote ne verrait pas `VIDAGE_ETAPES` et
     leverait. Meme lecon que le bloc de tete de `banc-reglages.mjs`, « les fichiers
     sont poses comme de vrais <script> de la page, et pas evalues un par un ». */
  s.textContent = MORCEAUX + '\n;(' + scenario.toString() + ')();';
  w.document.body.appendChild(s);
  const v = w.document.getElementById('bdvVidage');
  return v ? v.outerHTML : '<p>rien a montrer</p>';
}

const PREUVE = { vide: true, ventes: 171569, lignes: 171569, suivi: 1936, echanges: 212 };

/* 1. PENDANT LE TRAVAIL. Le compte est parti, l'appareil est en cours, la
      verification attend. C'est l'etat que le vigneron voit le plus longtemps. */
const enCours = jouer(function () {
  vidageMonter();
  vidageDire('compte', 'fait', 'fait');
  vidagePreciser('compte', 'Ton compte, 171 569 lignes effacées');
  vidageDire('appareil', 'encours', 'en cours');
});

/* 2. LE BILAN CHIFFRE. Les trois compteurs viennent du serveur, et c'est la
      raison d'etre du lot 28 : un vidage annonce sur zero ligne est le symptome
      exact d'un melange de bases. */
const reussi = jouer(function () {
  vidageMonter();
  vidageDire('compte', 'fait', 'fait');
  vidagePreciser('compte', 'Ton compte, 171 569 lignes effacées');
  vidageDire('appareil', 'fait', 'fait');
  vidageDire('preuve', 'fait', 'vérifié');
  vidageFin("C'est fait", vidageBilan({ vide: true, ventes: 171569, lignes: 171569, suivi: 1936, echanges: 212 }, true), true);
});

/* 3. LE COMPTE A REFUSE. Rien n'a ete touche nulle part, et c'est ce que la
      phrase doit dire en premier. */
const refus = jouer(function () {
  vidageMonter();
  vidageDire('compte', 'rate', 'a échoué');
  vidageFin("Ton compte n'a PAS été vidé",
    "Rien n'a été touché sur cet appareil non plus : tes deux copies sont exactement dans "
    + "l'état d'avant. Vérifie ta connexion et réessaie. Si ça recommence, ne réimporte "
    + "rien : les deux bases se mélangeraient.", false);
});

/* 4. LES DEUX MOITIES SE CONTREDISENT. Le pire etat du geste, et celui qui
      n'avait aucun message avant le 23/09/2026. */
const asymetrie = jouer(function () {
  vidageMonter();
  vidageDire('compte', 'fait', 'fait');
  vidagePreciser('compte', 'Ton compte, 171 569 lignes effacées');
  vidageDire('appareil', 'rate', 'a échoué');
  vidageFin("Ton compte est vide, cet appareil ne l'est pas",
    "Ton compte a bien été vidé. Cet appareil n'a pas pu effacer sa copie, et elle est donc "
    + "seule au monde. NE RÉIMPORTE RIEN et n'ouvre pas tes écrans de vente : ferme cet onglet, "
    + "rouvre ton bureau, et relance le vidage.", false);
});

/* 5. NON VERIFIE. Le troisieme etat, celui qu'on serait tente de confondre avec
      le premier : un « je ne sais pas » n'est pas un zero. */
const inconnu = jouer(function () {
  vidageMonter();
  vidageDire('compte', 'fait', 'fait');
  vidageDire('appareil', 'fait', 'fait');
  vidageDire('preuve', 'rate', 'non vérifié');
  vidageFin("On n'a pas pu vérifier",
    "L'effacement a été demandé des deux côtés et rien n'a signalé d'erreur, mais la relecture "
    + "qui devait le prouver n'a pas répondu. NE RÉIMPORTE RIEN avant d'avoir rechargé ton "
    + "bureau et regardé ce qu'il reste.", false);
});

/* Le voile est en `position: fixed` : cinq voiles dans une meme page se
   superposeraient. Chaque etat est donc pose dans un cadre qui retablit un
   contexte de positionnement, et le voile y devient absolu. Meme montage que
   l'apercu du voile d'amorcage, pour la meme raison. */
const page = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Apercu : le voile du vidage</title>
${TETE_POLICES}
<style>${cssBureau()}</style>
<style>
  body{ padding:0; margin:0; }
  .th{ padding:2rem; background:var(--bdv-fond); }
  h1{ font-family:inherit; font-weight:600; font-size:var(--bdv-f-6);
      letter-spacing:var(--bdv-ls-serre); color:var(--bdv-encre-1); }
  .th p{ color:var(--bdv-encre-3); }
  .cadre{ position:relative; height:34rem; margin:0 0 2rem; overflow:hidden;
          border:1px solid var(--bdv-trait); border-radius:var(--bdv-r);
          background:var(--bdv-surface); }
  .cadre .bdv-amorce{ position:absolute; }
  .lg{ font-family:inherit; font-weight:600; font-size:var(--bdv-f-1);
       letter-spacing:var(--bdv-ls-etiq); text-transform:uppercase;
       color:var(--bdv-encre-4); margin:0 0 .5rem; }
</style></head><body class="bdv-coque bdv-poste">
${['light', 'dark'].map(function (t) { return `
<section class="th" data-theme="${t}">
<h1>Le voile du vidage, theme ${t === 'light' ? 'clair' : 'sombre'}</h1>
<p>Genere par <code>npm run apercu:vidage</code> depuis les vraies fonctions de <code>bdv-base.js</code>. Il ne verifie rien : il se regarde.</p>
<p class="lg">1. Pendant le travail</p><div class="cadre">${enCours}</div>
<p class="lg">2. C'est fait, et c'est chiffre</p><div class="cadre">${reussi}</div>
<p class="lg">3. Le compte a refuse, rien n'a bouge</p><div class="cadre">${refus}</div>
<p class="lg">4. Le compte est vide, l'appareil non</p><div class="cadre">${asymetrie}</div>
<p class="lg">5. On n'a pas pu verifier</p><div class="cadre">${inconnu}</div>
</section>`; }).join('')}
</body></html>`;

fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, page, 'utf8');
console.log('\n  apercu:vidage     _apercu/vidage.html ecrit, cinq etats fois deux themes. A OUVRIR ET A REGARDER.\n');
process.exit(0);
