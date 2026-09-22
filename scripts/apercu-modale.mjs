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

   ET IL LUI MANQUAIT UNE FEUILLE SUR QUATRE JUSQU'AU 22/09/2026. Il posait
   bdv-theme.css, style.css et bdv-bureau.css, et PAS `bdv-poste.css`, la moitie
   bureau de l'ancienne style.css, scindee le 21/09 au matin. Les 310 regles
   qu'elle porte ne peignaient donc rien ici : boutons, champs, rangees. Le
   defaut est plus discret que celui des trois apercus qui ne posaient qu'une
   feuille, et c'est ce qui le rend dangereux : l'image ressemblait au produit.
   Il passe maintenant par `scripts/apercu-socle.mjs`, qui lit les feuilles sur
   la page CONSTRUITE au lieu d'en tenir une liste, et `npm run banc:apercus`
   le tient.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { planche, ecrire, motsVides, chargerJsdom, exigerLaPageConstruite,
         SANS_ENVELOPPE, ENVELOPPE_PLAN } from './apercu-socle.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* LES FEUILLES VIENNENT DU SOCLE, QUI LES LIT SUR LA PAGE CONSTRUITE, 22/09/2026.
   Ce fichier en tenait sa propre liste de trois : bdv-theme, style, bdv-bureau.
   Il en manquait une, `bdv-poste.css`, et rien ne pouvait le dire. */
const JS = path.join(RACINE, 'src/js');
const BRUT = exigerLaPageConstruite();
const JSDOM = await chargerJsdom();

const jour = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
};

const dom = new JSDOM(BRUT, {
  url: 'https://lebureauduvigneron.fr/mon-bureau/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(w) {
    /* Le compte est double AVANT que les modules ne partent : bdv-taches.js lit le
       serveur des le chargement de la page, pas a l'ouverture de la piece. */
    w.BdvCompte = {
      monId: () => 'moi',
      monBureau: () => 'b0000000-0000-0000-0000-000000000001',
      refusDeProprietaire: () => false,
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
/* ON GARDE LE `.tmod`, ET C'EST UNE CORRECTION DU 22/09/2026. Ce fichier ne
   prenait que `.tmod__boite`. Or TOUT le plancher tactile du telephone s'ecrit
   `.tmod__x, .tmod__g, .tmod__lien, .tmod__i, .tmod__d, .tmod .btn` sous
   620 px, plus `.bdv-coque .tmod .btn` de la section 18 de bdv-bureau.css :
   sans cet ancetre-la, aucune de ces regles ne s'appliquait dans l'apercu. La
   sonde de rendu y comptait quinze cibles sous 44 px a 390 px, dont
   « Enregistrer » et « C'est fait », les deux boutons qui ECRIVENT, alors que
   le produit les tient a 44 depuis le 19/09/2026. Un harnais qui ne monte pas
   l'ancetre invente des defauts, ce qui coute autant que d'en laisser passer.
   LE VOILE PART, LUI, et seulement lui : `.tmod__voile` est en `inset: 0` sur
   un parent qu'on vient de remettre dans le flux, il couvrirait la boite. */
function prendre(titre, note) {
  const m = d.getElementById('tacheModale');
  m.querySelectorAll('input').forEach(i => i.setAttribute('value', i.value));
  const modale = m.cloneNode(true);
  modale.removeAttribute('hidden');
  modale.removeAttribute('id');
  const voile = modale.querySelector('.tmod__voile');
  if (voile) voile.remove();
  vues.push({ titre, note, html: modale.outerHTML });
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
/* LA LISTE EST UNE VRAIE `.zone` : elle reprend son ancetre de plan, sans quoi
   elle ne recevrait ni sa grille de douze colonnes ni le fond de l'atelier. */
vues.push({ titre: 'La liste, d\u2019ou la modale s\u2019ouvre',
            note: 'Chaque ligne est devenue une porte : le titre ouvre, la case coche toujours',
            html: ENVELOPPE_PLAN(piece.querySelector('.zone').outerHTML) });

/* Le voile n'est pas repris : pose sur cette page il masquerait les etats les
   uns derriere les autres. Ce qu'on regarde ici, c'est la BOITE.
   ET LA BOITE N'EST PAS UNE ZONE : elle ne passe donc pas par l'enveloppe de
   plan du socle. La derniere vue, elle, en porte une a elle. */
const page = planche({
  titre: 'La modale d\u2019une tache, 12/09/2026, revue le 22/09/2026',
  intro: 'Trois natures de lignes, et elles n\u2019ont pas les memes droits : une tache ecrite se '
       + 'modifie, se coche, se repousse et se retire ; une obligation se coche et rien d\u2019autre ; '
       + 'un rappel client n\u2019ouvre pas la modale du tout. Rien n\u2019est redessine a la main, et '
       + 'les quatre feuilles du bureau sont posees dans l\u2019ordre ou le gabarit les lie.',
  enveloppe: SANS_ENVELOPPE,
  /* PAS DE minmax(30rem) : sur un ecran de 390 px cette grille imposait 480 px a
     la colonne, le document debordait de 122 px, et la mesure accusait la modale
     d'un defaut qui venait de la page d'apercu. Une page de controle qui ment sur
     la largeur ment sur tout ce qui en depend. */
  /* LE `.tmod` EST REMIS DANS LE FLUX, ET RIEN D'AUTRE NE BOUGE : il est en
     `position:fixed` dans le produit, et cinq modales fixes sur une planche se
     superposeraient. Ses retraits, ses plafonds de hauteur et tout ce qui
     touche au DESSIN restent ceux du produit. */
  css: '.ap__b .tmod{position:static;inset:auto;display:block;z-index:auto}'
     + '.ap__b .tmod__boite{max-height:none;height:auto;margin:0}'
     + '.ap__b .zone{margin:0}',
  vues: vues
});

ecrire('modale.html', page);
console.log('  ' + vues.length + ' etats x 2 themes');
/* On ne cherche pas « null » ici : le balisage de la modale porte des attributs
   qui le contiennent legitimement. */
if (motsVides(vues.map(v => v.html), ['NaN', 'undefined', 'Invalid Date', '[object']).length) process.exit(1);
process.exit(0);
