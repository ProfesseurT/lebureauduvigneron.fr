/* ============================================================================
   scripts/apercu-panneau.mjs : voir le panneau de liege sans se connecter

     npm run build && npm run apercu:panneau
     puis ouvrir _apercu/panneau.html dans un navigateur

   ECRIT LE 10/09/2026, pendant la refonte du panneau demandee par Ted. Le
   panneau a maintenant cinq etats — du retard, une journee chargee, une pile
   vide, un bureau neuf, un export qui a vieilli — et aucun ne se voit sans un
   compte, des rappels en base et des taches. On les regardait donc en poussant
   en production, ce qui est la plus mauvaise facon de juger un dessin.

   CE QU'IL FAIT. Il monte la VRAIE page construite dans jsdom, avec un faux CRM
   et de fausses taches, laisse le script de la page peindre lui-meme, puis ecrit
   un fichier autonome (la feuille de style est recopiee dedans) qui s'ouvre d'un
   double-clic. Rien n'est redessine a la main : ce qu'on regarde est ce que le
   navigateur affichera.

   CE QU'IL NE FAIT PAS. Aucun reseau, aucun chiffre vrai, et il ne VERIFIE rien :
   les controles du panneau sont dans scripts/banc-journee.mjs, section 5. Celui-ci
   ne sert qu'a regarder.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(RACINE, '_site/mon-bureau/index.html');
const FEUILLE = path.join(RACINE, '_site/css/style.css');

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) {
  console.error('\n  jsdom est absent : npm install --save-dev jsdom\n');
  process.exit(2);
}
if (!fs.existsSync(PAGE)) {
  console.error('\n  _site/mon-bureau/index.html est absent : lance npm run build d\'abord.\n');
  process.exit(2);
}

const jour = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
};

/* UNE JOURNEE CHARGEE, et une de chaque nature : un rappel en retard, un rappel du
   jour, un a venir ; une obligation qui tombe, une tache en retard, une tache qui
   presse, des taches sans date, une tache faite. Un jeu d'essai plus petit que la
   realite ne montre que ce qu'il contient — la lecon du 08/09/2026. */
const ETAT = {
  resume: { ca: 532201, exercice: 'exercice 2026', variation: 4.2, clients: 128, panier: 415, conseils: [] },
  deposeLe: new Date().toISOString(),
  signaux: [],
  noms: { JAYAMA: 'Domaine Jayama', BELLEVUE: 'Château Bellevue', PIERRIER: 'Clos du Pierrier' },
  suivi: [
    { id: 'JAYAMA',   rappel: jour(-6), statut: 'relance' },
    { id: 'BELLEVUE', rappel: jour(0),  statut: 'relance' },
    { id: 'PIERRIER', rappel: jour(30), statut: 'relance' }
  ]
};
const TACHES = [
  { tache_id: 'ech:drm:x', titre: 'DRM de septembre',       source: 'echeance', jours: 0,    fait_le: null },
  { tache_id: 't1',        titre: 'Rappeler le comptable',  source: 'libre',    jours: -2,   fait_le: null },
  { tache_id: 't2',        titre: 'Commander des bouchons', source: 'libre',    jours: 3,    fait_le: null },
  { tache_id: 't3',        titre: 'Devis étiquettes',       source: 'libre',    jours: null, fait_le: null },
  { tache_id: 't4',        titre: 'Relire le dossier PAC',  source: 'libre',    jours: null, fait_le: null },
  { tache_id: 't5',        titre: 'Ranger le chai',         source: 'libre',    jours: null, fait_le: new Date().toISOString() }
];

/* Le faux BdvTaches rejoue punaises() a l'identique. C'est un DOUBLON assume et il
   faut le savoir : le vrai vit dans src/js/bdv-taches.js, que jsdom ne charge pas
   (les <script src> ne sont pas suivis). Si l'ordre des punaises change la-bas, il
   faut le changer ici — sinon l'apercu montre un panneau qui n'existe plus. */
function fauxTaches() {
  return {
    toutes: () => TACHES,
    faitsAujourdhui: () => TACHES.filter(t => t.fait_le).length,
    punaises() {
      const af = TACHES.filter(x => !x.fait_le);
      const tete = af.filter(x => x.jours !== null && x.jours <= 7).slice(0, 3);
      const out = tete.map(t => ({
        cle: 'tache:' + t.tache_id,
        valeur: t.jours < 0 ? 'en retard' : (t.jours === 0 ? 'aujourd’hui' : (t.jours === 1 ? 'demain' : 'dans ' + t.jours + 'j')),
        libelle: t.titre,
        sous: t.source === 'echeance' ? 'obligation' : 'ta tâche',
        ton: t.jours < 0 ? 'vieux' : '',
        href: '/mon-bureau/#taches',
        gestes: [{ cle: 'tache-fait', id: t.tache_id, mot: 'Fait' }]
          .concat(t.source !== 'echeance' && t.jours < 1 ? [{ cle: 'tache-demain', id: t.tache_id, mot: 'Demain' }] : [])
      }));
      const reste = af.length - tete.length;
      if (reste > 0) out.push({
        cle: 'taches-reste', valeur: String(reste),
        libelle: reste > 1 ? 'autres tâches' : 'autre tâche',
        sous: af.filter(x => x.jours === null).length + ' sans date',
        href: '/mon-bureau/#taches'
      });
      return out;
    }
  };
}

const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), {
  url: 'https://lebureauduvigneron.fr/mon-bureau/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(w) {
    w.localStorage.setItem('bdv_session', JSON.stringify({
      access_token: 'apercu', user: { id: 'moi', email: 'ted@exemple.fr' }
    }));
    const iso = (d) => new Date(d).toISOString().slice(0, 10);
    const gestes = [0, 0, 2, 9, 12].map(n => ({ le: new Date(Date.now() - n * 86400000).toISOString(), type: 'appel' }));
    w.BdvCrm = {
      GESTES: {}, isoLocal: iso, miroir: () => ETAT, file: () => [],
      charger: () => Promise.resolve(ETAT), journal: () => Promise.resolve(gestes),
      fil: () => Promise.resolve([]), geste: () => Promise.resolve(true), rejouer: () => Promise.resolve(true)
    };
    w.BdvTaches = fauxTaches();
  }
});

// Le journal part en parallele et repeint le panneau quand il arrive : on attend.
await new Promise(r => setTimeout(r, 900));
const d = dom.window.document;
const zone = d.getElementById('zonePanneau');
const page = '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
  + '<title>Aperçu du panneau</title>'
  + '<style>' + fs.readFileSync(FEUILLE, 'utf8') + '</style>'
  + '<style>body{background:var(--paper);padding:2rem;margin:0}'
  + '.bureau-plan{max-width:1120px;margin:0 auto}</style>'
  + '</head><body><div class="bureau-plan">' + zone.outerHTML + '</div></body></html>';

fs.mkdirSync(path.join(RACINE, '_apercu'), { recursive: true });
fs.writeFileSync(path.join(RACINE, '_apercu/panneau.html'), page);
console.log('  ecrit : _apercu/panneau.html');
console.log('  ' + zone.querySelectorAll('.postit').length + ' punaise(s)');
console.log('  etiquette : ' + d.getElementById('panneauNote').textContent);
process.exit(0);
