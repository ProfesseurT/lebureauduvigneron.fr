/* ============================================================================
   scripts/apercu-ardoise.mjs : voir L'ARDOISE et LE COURRIER sans se connecter

     npm run build && npm run apercu:ardoise
     puis ouvrir _apercu/ardoise.html

   ECRIT LE 12/09/2026, sur demande de Ted (« ameliore : ardoise, courrier »).
   Meme motif que apercu-panneau.mjs : les deux zones ne se peignent qu'avec un
   compte et un export Vitisoft, donc on ne les regardait qu'en production.

   CE QU'IL FAIT. Il monte la VRAIE page construite dans jsdom, avec un faux CRM
   et de faux signets, laisse le script de la page peindre lui-meme, puis ecrit
   un fichier autonome (style.css recopie dedans). Rien n'est redessine a la
   main.

   CE QU'IL NE FAIT PAS. Il ne VERIFIE rien, il ne charge pas les polices
   Google (le fichier produit les demande au reseau comme la vraie page). Il ne
   sert qu'a regarder.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(RACINE, '_site/mon-bureau/index.html');
const FEUILLE = path.join(RACINE, '_site/css/style.css');

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) { console.error('\n  jsdom est absent : npm install --save-dev jsdom\n'); process.exit(2); }
if (!fs.existsSync(PAGE)) {
  console.error('\n  _site/mon-bureau/index.html est absent : lance npm run build d\'abord.\n');
  process.exit(2);
}

/* LE JEU D'ESSAI. Des montants a six chiffres, un pourcentage, un entier court et
   un montant a trois chiffres : c'est exactement la ou une police de chiffres se
   juge, quand les longueurs ne sont pas les memes d'une case a l'autre. */
const ETAT = {
  resume: {
    ca: 532201, exercice: 'exercice 2026', variation: 4.2,
    objectif: 650000, objectifPct: 82,
    clients: 128, panier: 415, conseils: []
  },
  deposeLe: new Date().toISOString(),
  signaux: [], noms: {}, suivi: []
};

/* Les URL viennent du VRAI fichier de contenus de la page : un signet vers une
   adresse inventee se peindrait sans titre ni pilier. */
const BRUT = fs.readFileSync(PAGE, 'utf8');
const JSONC = (BRUT.match(/id="bdvContenus"[^>]*>([\s\S]*?)<\/script>/) || [])[1] || '[]';
let LISTE = [];
try { LISTE = JSON.parse(JSONC) || []; } catch (e) {}
const CONTENUS_ESSAI = {
  aLire: LISTE.slice(3, 6).map(c => c.url),
  lus:   LISTE.slice(6, 9).map(c => c.url)
};

const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), {
  url: 'https://lebureauduvigneron.fr/mon-bureau/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(w) {
    w.localStorage.setItem('bdv_session', JSON.stringify({
      access_token: 'apercu', user: { id: 'moi', email: 'ted@exemple.fr' }
    }));
    /* DE QUOI REMPLIR LES TROIS ZONES DU BAS. Le courrier ne se juge pas seul :
       il partage sa rangee avec « A lire » et « Le classeur », et c'est cote a
       cote qu'on voit s'ils portent ou non le meme objet. */
    var SIGNETS = {};
    (CONTENUS_ESSAI.aLire || []).forEach(function(u){ SIGNETS[u] = { etat: 'a_lire' }; });
    (CONTENUS_ESSAI.lus || []).forEach(function(u){ SIGNETS[u] = { etat: 'lu' }; });
    w.localStorage.setItem('bdv_signets_v1', JSON.stringify(SIGNETS));
    w.BdvCrm = {
      GESTES: {
        appel:   { label: 'Appelé',            court: 'Appelé',  type: 'appel',   canal: 'appel',     statut: 'relance', jours: 30, resume: 'Appel passé' },
        message: { label: 'Laissé un message', court: 'Message', type: 'message', canal: 'repondeur', statut: 'relance', jours: 7,  resume: 'Message laissé, sans réponse' },
        ecarte:  { label: 'Pas maintenant',    court: 'Écarté',  type: 'ecarte',  canal: null,        statut: null,      jours: 60, resume: 'Écarté de la file' }
      },
      isoLocal: (d) => new Date(d).toISOString().slice(0, 10),
      miroir: () => ETAT, file: () => [],
      charger: () => Promise.resolve(ETAT), journal: () => Promise.resolve([]),
      fil: () => Promise.resolve([]), geste: () => Promise.resolve(true),
      rejouer: () => Promise.resolve(true)
    };
    w.BdvTaches = { toutes: () => [], faitsAujourdhui: () => 0, punaises: () => [] };
  }
});

await new Promise(r => setTimeout(r, 900));
const d = dom.window.document;
const morceaux = [d.getElementById('zoneArdoise')]
  .concat([...d.querySelectorAll('.zone--lecture, .zone--classeur, .zone--courrier')])
  .filter(Boolean);

if (!morceaux.length) { console.error('  aucune zone trouvee.'); process.exit(1); }
morceaux.forEach(z => { z.hidden = false; z.removeAttribute('hidden'); });

const POLICES = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=Inter:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500;600&family=Caveat:wght@400;500&display=swap';

const page = '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
  + '<title>Aperçu de l\'ardoise et du courrier</title>'
  + '<link href="' + POLICES + '" rel="stylesheet">'
  + '<style>' + fs.readFileSync(FEUILLE, 'utf8') + '</style>'
  + '<style>body{background:var(--paper);padding:2rem;margin:0}</style>'
  + '</head><body><main class="bureau"><div class="bureau-plan">'
  + morceaux.map(z => z.outerHTML).join('')
  + '</div></main></body></html>';

fs.mkdirSync(path.join(RACINE, '_apercu'), { recursive: true });
fs.writeFileSync(path.join(RACINE, '_apercu/ardoise.html'), page);
console.log('  ecrit : _apercu/ardoise.html');
console.log('  ' + d.querySelectorAll('.chiffre').length + ' case(s) sur l\'ardoise');
console.log('  ' + d.querySelectorAll('.zone--courrier .lettre').length + ' lettre(s) dans le courrier');
process.exit(0);
