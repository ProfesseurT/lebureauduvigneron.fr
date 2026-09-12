/* ============================================================================
   scripts/apercu-modale.mjs : voir la modale d'une tache sans se connecter

     npm run build && npm run apercu:modale
     puis ouvrir _apercu/modale.html

   ECRIT LE 12/09/2026 avec la modale demandee par Ted. MOTIF, ET IL A DEJA ETE
   PAYE DEUX FOIS : un controle ecrit pour l'occasion valide ce qu'on a pense a y
   mettre, pas le travail. Le banc dit que la bonne charge part au serveur et que
   les bons blocs sont caches ; il ne peut pas dire qu'un bouton est illisible sur
   le papier, ni qu'un titre long fait quatre lignes. Cela, seule l'image le dit.

   CE QU'IL FAIT. Il monte la VRAIE page construite dans jsdom, y pose les VRAIS
   modules (jsdom ne suit pas les <script src>), ouvre la modale sur chacun de ses
   TROIS etats, et ecrit une page autonome ou les trois sont cote a cote, avec la
   vraie feuille de style recopiee dedans.

   CE QU'IL NE VERIFIE PAS : rien. Les controles sont dans scripts/banc-taches.mjs,
   section 10. Celui-ci ne sert qu'a regarder.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(RACINE, '_site/mon-bureau/index.html');
const FEUILLE = path.join(RACINE, '_site/css/style.css');
const JS = path.join(RACINE, '_site/js');

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) { console.error('\n  jsdom est absent : npm install --save-dev jsdom\n'); process.exit(2); }
if (!fs.existsSync(PAGE)) {
  console.error('\n  _site/mon-bureau/index.html est absent : lance npm run build d\'abord.\n');
  process.exit(2);
}

const jour = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
};

const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), {
  url: 'https://lebureauduvigneron.fr/mon-bureau/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(w) {
    /* Le compte est double AVANT que les modules ne partent : bdv-taches.js lit le
       serveur des le chargement de la page, pas a l'ouverture de la piece. */
    w.BdvCompte = {
      monId: () => 'moi',
      session: () => ({ user: { id: 'moi' } }),
      api: () => Promise.resolve([])
    };
  }
});
const w = dom.window, d = w.document;

/* LES VRAIS MODULES, poses a la main : jsdom ne suit pas les <script src>, et un
   faux module montrerait un ecran qui n'existe pas. C'est exactement le doublon que
   l'apercu du panneau assume, et qu'on evite ici. */
for (const f of ['bdv-echeances.js', 'bdv-taches.js']) {
  const s = d.createElement('script');
  s.textContent = fs.readFileSync(path.join(JS, f), 'utf8');
  d.body.appendChild(s);
}
await new Promise(r => setTimeout(r, 200));
const T = w.BdvTaches;
if (!T || !T.modale) { console.error('\n  BdvTaches.modale est absent.\n'); process.exit(1); }

/* UN TITRE LONG, ET C'EST VOULU. « Commander des bouchons » tient sur une ligne dans
   n'importe quel dessin ; ce qui casse un dessin, c'est le titre que quelqu'un ecrit
   vraiment un mardi soir. */
T.ajouter('Rappeler le comptable pour le dossier de TVA du trimestre', jour(-3), null);
T.ajouter('Salon des vins de Loire', jour(12), jour(14));
const ecrites = T.toutes().filter(x => x.source === 'libre');
const obligation = T.toutes().filter(x => x.source === 'echeance')[0];

const vues = [];
/* LE CLONE NE COPIE PAS CE QU'ON TAPE, et cet apercu l'a appris en une capture. La
   modale pose les valeurs en `.value` — ce qui est juste, c'est ce qu'un navigateur lit.
   Mais `cloneNode` ne recopie que les ATTRIBUTS : la premiere image montrait quatre
   modales vides, avec « ex. commander des bouchons » en gris a la place du titre. On
   aurait juge un ecran qui n'existe pas. Les attributs sont donc reportes avant le clone.
   C'est un defaut d'apercu, pas de modale : ne pas « corriger » bdv-taches.js pour lui. */
function prendre(titre, note) {
  const m = d.getElementById('tacheModale');
  m.querySelectorAll('input').forEach(i => i.setAttribute('value', i.value));
  const boite = m.querySelector('.tmod__boite').cloneNode(true);
  vues.push({ titre, note, html: boite.outerHTML });
}

T.modaleNeuve(null);            prendre('Créer', 'Ce qu’on voit en cliquant sur « Ajouter en détail… »');
T.modale(ecrites[0].tache_id);  prendre('Une tâche en retard', 'Tout est modifiable, elle se repousse, elle se retire');
T.modale(ecrites[1].tache_id);  prendre('Une tâche qui dure', 'Les deux dates, et le report qui gardera les trois jours');
T.modale(obligation.tache_id);  prendre('Une obligation', 'Ni modifiable ni repoussable : un seul geste, et le renvoi vers ce qu’elle exige');

/* ET LA LISTE ELLE-MEME, parce que c'est elle qu'on a modifiee sans la regarder :
   `.tache__corps` est devenu un <button>, et un bouton apporte par defaut un fond, un
   cadre, une police et un centrage. La regle CSS les retire ; seule l'image dit qu'elle
   les retire VRAIMENT. */
T.rendre();
const piece = d.getElementById('bureauTaches');
piece.hidden = false;
vues.push({ titre: 'La liste, d\u2019ou la modale s\u2019ouvre',
            note: 'Chaque ligne est devenue une porte : le titre ouvre, la case coche toujours',
            html: piece.querySelector('.zone').outerHTML, large: true });

/* Le voile n'est pas repris : pose sur cette page il masquerait les quatre etats les
   uns derriere les autres. Ce qu'on regarde ici, c'est la BOITE. */
const page = '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<title>Aperçu de la modale d’une tâche</title>'
  + '<link rel="preconnect" href="https://fonts.googleapis.com">'
  + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  + '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">'
  + '<style>' + fs.readFileSync(FEUILLE, 'utf8') + '</style>'
  + '<style>body{background:var(--paper-deep);padding:2rem;margin:0}'
  /* PAS DE minmax(30rem) : sur un ecran de 390 px cette grille imposait 480 px a la
     colonne, le document debordait de 122 px, et la mesure accusait la modale d'un
     defaut qui venait de la page d'apercu. Une page de controle qui ment sur la
     largeur ment sur tout ce qui en depend. */
  + '.ap{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:1fr;gap:2rem}'
  + '@media (min-width:70rem){.ap{grid-template-columns:1fr 1fr}}'
  + '.ap__c h3{font-family:var(--font-mono);font-size:var(--t-mini);text-transform:uppercase;'
  + 'letter-spacing:var(--ls-large);color:var(--muted);margin:0 0 .2rem}'
  + '.ap__c p.ap__n{font-family:var(--font-mono);font-size:var(--t-micro);color:var(--muted);margin:0 0 .8rem}'
  + '.ap__c .tmod__boite{max-height:none;box-shadow:var(--ombre-dure)}'
  + '.ap__c--large{grid-column:1/-1}'
  + '.ap__c--large .zone{background:var(--paper);padding:1.5rem;border:var(--trait) solid var(--rule)}</style>'
  + '</head><body><div class="ap">'
  + vues.map(v => '<div class="ap__c' + (v.large ? ' ap__c--large' : '') + '"><h3>' + v.titre
      + '</h3><p class="ap__n">' + v.note + '</p>' + v.html + '</div>').join('')
  + '</div></body></html>';

fs.mkdirSync(path.join(RACINE, '_apercu'), { recursive: true });
fs.writeFileSync(path.join(RACINE, '_apercu/modale.html'), page);
console.log('  ecrit : _apercu/modale.html  (' + vues.length + ' etats)');

/* CE QUE LA MESURE PEUT DIRE SANS L'IMAGE : les mots vides. Un NaN, un undefined ou
   un « null » dans du texte rendu est un defaut qu'on ne voit pas en regardant vite. */
const texte = vues.map(v => v.html).join(' ').replace(/<[^>]+>/g, ' ');
const sales = ['NaN', 'undefined', 'Invalid Date', '[object'].filter(m => texte.indexOf(m) >= 0);
console.log(sales.length ? '  ALERTE : ' + sales.join(', ') + ' dans le texte rendu'
                         : '  aucun NaN / undefined / Invalid Date dans le texte rendu');
process.exit(0);
