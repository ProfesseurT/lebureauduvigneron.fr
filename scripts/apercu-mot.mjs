/* ============================================================================
   scripts/apercu-mot.mjs : voir LE MOT DU JOUR dans ses quatre gravites

     npm run build && npm run apercu:mot
     puis ouvrir _apercu/mot.html

   ECRIT LE 14/09/2026, lot 2. Ce que le banc ne peut pas dire : la zone est
   passee d'un bloc de deux paragraphes a une rangee signe + corps, et une
   mesure qui dit « rien ne deborde » ne dit pas « ca se lit ». Le depot a paye
   trois fois cette lecon.

   CE QU'IL FAIT. Il monte la VRAIE page construite dans jsdom, quatre fois, une
   par gravite, laisse le script de la page peindre lui-meme, et recolle les
   quatre zones dans un fichier autonome. Rien n'est redessine a la main.

   CE QU'IL NE FAIT PAS. Il ne verifie rien, il MONTRE. Il n'est donc pas dans
   `npm run verif` : il s'ouvre et se regarde.
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
const BRUT = fs.readFileSync(PAGE, 'utf8');

/* LES QUATRE CAS, ET LE PLUS LONG EST VOLONTAIRE. Le conseil des dormants nomme
   trois clients avec leurs montants : c'est la phrase la plus longue que le
   tableau de bord produise, et c'est elle qui dit si la colonne de texte tient a
   cote du signe. Les balises et l'esperluette sont la aussi : le deshabillage du
   lot 1 se REGARDE, il ne se croit pas sur parole. */
const CAS = [
  { titre: 'Grave, et il mene a Mon commerce', sev: 3, kind: 'danger', cible: 'clients', ico: '⚠',
    verdict: '3 clients en décrochage : 8 200 € de CA en moins vs 2025 à date égale.',
    action: 'À rappeler en priorité, du plus gros montant perdu au plus petit. La liste est dans <b>Mon commerce</b>, filtre « Recul confirmé ».' },
  { titre: 'A surveiller, la phrase la plus longue du tableau de bord', sev: 2, kind: 'warn', cible: 'clients', ico: '↻',
    verdict: "7 clients en retard sur leur cadence d'achat : 24 000 € de CA historique en sommeil.",
    action: 'À relancer en priorité : Chapelle &amp; Fils (3 100 €), Cave d&#39;Anjou (2 400 €), Maison Brun-Delaunay (1 900 €). La liste est dans <b>Mon commerce</b>, filtre « Retard de cadence ».' },
  { titre: 'Bonne nouvelle, et une phrase courte', sev: 1, kind: 'ok', cible: 'annee', ico: '✔',
    verdict: 'Croissance saine : +12 000 €, portés surtout par les volumes.',
    action: 'Continue sur le levier qui marche.' },
  { titre: 'Pour information, et SANS cible : un depot d’avant le 14/09', sev: 1, kind: 'info', ico: 'ℹ',
    verdict: 'Le canal Salon progresse de 3,4 points de mix.',
    action: 'Capitalise sur ce canal qui monte.' }
];

async function peindre(conseils) {
  const ETAT = {
    resume: { ca: 532201, exercice: 'exercice 2026', variation: 4.2, clients: 128, panier: 415, conseils },
    deposeLe: new Date().toISOString(), signaux: [], noms: {}, suivi: []
  };
  const dom = new JSDOM(BRUT, {
    url: 'https://lebureauduvigneron.fr/mon-bureau/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.localStorage.setItem('bdv_session', JSON.stringify({
        access_token: 'apercu', user: { id: 'moi', email: 'ted@exemple.fr' }
      }));
      w.BdvCrm = {
        /* Les trois gestes, comme apercu-ardoise.mjs les pose : le script de la page lit
           `GESTES.appel.label` des son demarrage, et un objet vide le fait lever avant
           d'avoir peint quoi que ce soit. */
        GESTES: {
          appel:   { label: 'Appelé',            court: 'Appelé',  jours: 30 },
          message: { label: 'Laissé un message', court: 'Message', jours: 7 },
          ecarte:  { label: 'Pas maintenant',    court: 'Écarté',  jours: 60 }
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
  await new Promise(r => setTimeout(r, 400));
  const z = dom.window.document.getElementById('zoneMot');
  if (!z) return '';
  z.hidden = false; z.removeAttribute('hidden');
  return z.outerHTML;
}

const blocs = [];
for (const c of CAS) {
  const html = await peindre([c]);
  blocs.push('<p class="apercu-mot__t">' + c.titre + '</p>' + html);
}
// Et le cas reel : quatre conseils d'un coup, donc le bouton et le compteur.
blocs.push('<p class="apercu-mot__t">Quatre conseils deposes : le compteur et le bouton</p>'
         + await peindre(CAS));

const POLICES = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600&family=Caveat:wght@400;500&display=swap';

const page = '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<title>Aperçu du mot du jour</title>'
  + '<link href="' + POLICES + '" rel="stylesheet">'
  + '<style>' + fs.readFileSync(FEUILLE, 'utf8') + '</style>'
  + '<style>body{background:var(--paper);padding:2rem;margin:0}'
  + '.apercu-mot__t{font-family:var(--font-mono);font-size:var(--t-mini);'
  + 'color:var(--muted);margin:1.6rem 0 .4rem;grid-column:1/-1}</style>'
  + '</head><body><main class="bureau"><div class="bureau-plan">'
  + blocs.join('')
  + '</div></main></body></html>';

fs.mkdirSync(path.join(RACINE, '_apercu'), { recursive: true });
fs.writeFileSync(path.join(RACINE, '_apercu/mot.html'), page);
console.log('  ecrit : _apercu/mot.html  (' + blocs.length + ' cas)');
process.exit(0);
