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

   ET IL A MENTI DU 21/09/2026 AU 22/09/2026. Il ne posait que `style.css`.
   Depuis la scission du 21/09 au matin, cette feuille ne porte plus les regles
   du bureau : l'ardoise, le mot du jour et les trois zones de lecture sont
   repeints sous `.bdv-coque` par `bdv-bureau.css`, qui lit les jetons de
   `bdv-theme.css`, et le reste vit dans `bdv-poste.css`. L'apercu rendait donc
   quatre zones NUES, avec toutes leurs `var()` dans le vide, et il ne le disait
   pas. Il passe maintenant par `scripts/apercu-socle.mjs`, qui lit les feuilles
   sur la page CONSTRUITE, pose `bdv-coque` sur le corps de page et rend les
   DEUX themes. `npm run banc:apercus` le tient desormais.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { planche, ecrire, motsVides, chargerJsdom, exigerLaPageConstruite } from './apercu-socle.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(RACINE, '_site/mon-bureau/index.html');
const BRUT = exigerLaPageConstruite();
const JSDOM = await chargerJsdom();

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
const JSONC = (BRUT.match(/id="bdvContenus"[^>]*>([\s\S]*?)<\/script>/) || [])[1] || '[]';
let LISTE = [];
try { LISTE = JSON.parse(JSONC) || []; } catch (e) {}
const CONTENUS_ESSAI = {
  aLire: LISTE.slice(3, 6).map(c => c.url),
  lus:   LISTE.slice(6, 9).map(c => c.url)
};

const dom = new JSDOM(BRUT, {
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

/* CHAQUE ZONE EST JUGEE A PART, ET DANS LES DEUX THEMES. L'ardoise et les trois
   zones de lecture partagent une rangee dans le vrai plan : elles sont donc
   donnees dans l'ordre du plan, chacune dans son ancetre reelle. */
const NOMS = {
  zoneArdoise: ['L\u2019ardoise', 'Quatre nombres nus, chacun avec son libelle et sa provenance. La regle « un chiffre affiche dit toujours d\u2019ou il vient » ne bouge pas.'],
  'zone--lecture': ['A lire', 'Ce que le vigneron a mis de cote.'],
  'zone--classeur': ['Le classeur', 'Ce qu\u2019il a deja lu.'],
  'zone--courrier': ['Le courrier', 'L\u2019enveloppe dechiree est partie au lot 3 : c\u2019est une carte, et les lignes sont au corps de 13 px.']
};
/* LES QUATRE ZONES DANS UN SEUL PLAN, ET C'EST LEUR VRAIE MISE EN PAGE. Le
   plan fait douze colonnes : l'ardoise, « A lire » et « Le classeur » tiennent
   quatre colonnes chacun et font une rangee, « Le courrier » en tient six et
   passe a la suivante. Les separer en quatre vues, essaye le 22/09/2026, a
   donne un resultat FAUX : trois zones de 4+4+6 colonnes dans un meme plan
   debordaient dans des colonnes implicites, et le courrier sortait coupe a
   droite. C'est aussi la raison d'etre de ce fichier depuis le 12/09/2026 :
   « le courrier ne se juge pas seul, il partage sa rangee avec A lire et Le
   classeur, et c'est cote a cote qu'on voit s'ils portent ou non le meme
   objet ».
   CE QUE CETTE PLANCHE NE PEUT PAS MONTRER, ET IL FAUT LE SAVOIR : les deux
   themes sont cote a cote, donc chaque colonne fait la moitie d'un ecran. Le
   plan y tient environ 660 px au lieu des 1140 px d'un 1440, et les titres s'y
   replient plus tot qu'en vrai. On juge ici les couleurs, les filets et la
   hierarchie ; une largeur se juge a `npm run banc:large`. */
const vues = [{ titre: 'L\u2019ardoise et la rangee de lecture',
                note: NOMS.zoneArdoise[1] + ' Les trois zones de lecture suivent, dans leur vraie '
                    + 'mise en page : quatre colonnes sur douze pour « A lire » et « Le classeur », '
                    + 'six pour « Le courrier », qui passe donc a la rangee suivante.',
                html: morceaux.map(z => z.outerHTML).join('') }];

const page = planche({
  titre: 'L\u2019ardoise et les trois zones de lecture, 12/09/2026, revu le 22/09/2026',
  intro: 'Rien n\u2019est redessine a la main : ce sont les vraies zones, peintes par le script '
       + 'de la page construite, avec les quatre feuilles du bureau dans l\u2019ordre ou le '
       + 'gabarit les lie, et dans les deux themes.',
  vues: vues
});

ecrire('ardoise.html', page);
console.log('  ' + d.querySelectorAll('.chiffre').length + ' case(s) sur l\'ardoise');
console.log('  ' + d.querySelectorAll('.zone--courrier .lettre').length + ' lettre(s) dans le courrier');
if (motsVides(vues.map(v => v.html)).length) process.exit(1);
process.exit(0);
