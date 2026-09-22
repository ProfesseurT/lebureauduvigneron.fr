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

   ET IL A MENTI DU 21/09/2026 AU 22/09/2026. Il ne posait que `style.css`.
   Depuis la scission du 21/09 au matin, cette feuille ne porte plus les regles
   du bureau : le panneau est devenu une pile de rangees a filet, repeinte sous
   `.bdv-coque` par la section 9 de `bdv-bureau.css`, et le liege de `style.css`
   ne sert plus qu'a la demonstration de la page d'accueil. L'apercu montrait
   donc encore le LIEGE, c'est-a-dire le dessin qu'on venait de remplacer, et il
   le montrait sans jetons. Il passe maintenant par `scripts/apercu-socle.mjs`,
   qui lit les feuilles sur la page CONSTRUITE, pose `bdv-coque` sur le corps de
   page et rend les DEUX themes. `npm run banc:apercus` le tient desormais.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { planche, ecrire, motsVides, chargerJsdom, exigerLaPageConstruite } from './apercu-socle.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRUT = exigerLaPageConstruite();
const JSDOM = await chargerJsdom();

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
        tampon: t.jours < 0 ? 'en retard' : (t.jours === 0 ? 'aujourd’hui' : (t.jours === 1 ? 'demain' : 'dans ' + t.jours + ' j')),
        valeur: t.titre,
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

const dom = new JSDOM(BRUT, {
  url: 'https://lebureauduvigneron.fr/mon-bureau/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(w) {
    w.localStorage.setItem('bdv_session', JSON.stringify({
      access_token: 'apercu', user: { id: 'moi', email: 'ted@exemple.fr' }
    }));
    const iso = (d) => new Date(d).toISOString().slice(0, 10);
    const gestes = [0, 0, 2, 9, 12].map(n => ({ le: new Date(Date.now() - n * 86400000).toISOString(), type: 'appel' }));
    /* LES TROIS GESTES SONT UNE DEPENDANCE DURE, et l'oubli a coute cher : le
       bandeau du bureau lit `BdvCrm.GESTES.ecarte.label` au chargement. Avec un
       `GESTES` vide, ce `undefined.label` jetait AVANT que le panneau ne soit
       peint, et cet apercu ecrivait depuis des jours une page a zero punaise sans
       se plaindre. Constate le 12/09/2026. Un banc muet est pire qu'un banc absent. */
    w.BdvCrm = {
      GESTES: {
        appel:   { label: 'Appelé',            court: 'Appelé',  type: 'appel',   canal: 'appel',     statut: 'relance', jours: 30, resume: 'Appel passé' },
        message: { label: 'Laissé un message', court: 'Message', type: 'message', canal: 'repondeur', statut: 'relance', jours: 7,  resume: 'Message laissé, sans réponse' },
        ecarte:  { label: 'Pas maintenant',    court: 'Écarté',  type: 'ecarte',  canal: null,        statut: null,      jours: 60, resume: 'Écarté de la file' }
      },
      isoLocal: iso, miroir: () => ETAT, file: () => [],
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

/* LA ZONE EST REMISE DANS SA GRILLE DE DOUZE COLONNES par l'enveloppe du socle.
   Une page d'apercu qui la poserait sur une largeur libre ne pourrait pas
   montrer le defaut du 14/09/2026, ou une `.zone` sans `grid-column` est tombee
   dans UNE colonne et s'est ecrite une lettre par ligne. Et c'est aussi ce qui
   decide de la largeur des post-it : la borne `--postit-l` se mesure ici. */
const page = planche({
  titre: 'Le panneau de « Ma journee », 10/09/2026, revu le 22/09/2026',
  intro: 'Une punaise porte UNE chose a faire, dans l\u2019ordre ou elle presse, avec les gestes '
       + 'qui la font disparaitre. Cinq au plus : a six, la sixieme part seule sur une deuxieme '
       + 'rangee. Rien n\u2019est redessine a la main, et les quatre feuilles du bureau sont '
       + 'posees dans l\u2019ordre ou le gabarit les lie.',
  vues: [{ titre: 'Une journee chargee',
           note: 'Un rappel en retard, un du jour, une obligation qui tombe, une tache en retard, '
               + 'une qui presse, et le compte de ce qui ne tient pas ici.',
           html: zone.outerHTML }]
});

ecrire('panneau.html', page);
console.log('  ' + zone.querySelectorAll('.postit').length + ' punaise(s)');
console.log('  etiquette : ' + d.getElementById('panneauNote').textContent);
if (motsVides([zone.outerHTML]).length) process.exit(1);
process.exit(0);
