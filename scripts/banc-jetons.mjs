/* ============================================================================
   scripts/banc-jetons.mjs : tokens.css dit-il la verite ?

     node scripts/banc-jetons.mjs

   Ne modifie rien. Sortie 0 seulement si la doctrine et le servi coincident.

   POURQUOI CE BANC EXISTE, ET CE QU'IL A TROUVE LE 18/09/2026.

   tokens.css s'annonce « source unique de verite pour le site ET le tableau de
   bord », et pose la regle : « aucune couleur, aucune taille, aucun rayon ecrit
   en dur ailleurs ». Deux choses etaient fausses le jour de l'audit.

   1. CE FICHIER N'EST CHARGE PAR RIEN. Aucun <link> ne le pointe, Eleventy ne le
      copie pas dans _site, il ne part pas chez Vercel. La vraie source est le
      bloc :root de src/css/style.css. tokens.css est un document de DOCTRINE, et
      c'est tres bien, mais une doctrine qu'aucun controle ne compare au reel
      derive le jour meme ou on la ferme.

   2. ELLE AVAIT TRENTE ET UN JETONS DE RETARD. --ardoise, --postit-jaune,
      --ombre-papier, --tr-choregraphie, les huit --serie-*, et vingt autres
      etaient servis au navigateur sans etre ecrits nulle part dans la doctrine.
      Les deux fichiers avaient ete touches le meme jour a neuf minutes d'ecart :
      ils etaient tenus a la main, en parallele, ce qui est la mecanique exacte
      d'une derive.

   ET UNE COLLISION, qui est la vraie raison d'etre de ce banc. --ombre-photo
   valait `0 20px 60px rgba(0,0,0,0.35)` dans style.css et
   `10px 10px 0 rgba(0,0,0,0.28)` dans bdv-ecrans.css. Deux ombres sous un seul
   nom. Comme bdv-nav.js pose bdv-ecrans.css APRES style.css, la seconde gagnait,
   et elle gagnait pour la page entiere : une regle du site qui aurait appele ce
   jeton aurait vu son ombre changer toute seule a la premiere ouverture d'un
   ecran de vente. Personne ne l'a vu parce que le site n'appelait ce jeton nulle
   part. C'est ce genre de piege que ce banc attrape, pas une panne visible.

   ET LA PARITE DES DEUX THEMES, AJOUTEE LE 21/09/2026.

   Depuis ce jour, /mon-bureau/ a deux themes et src/css/bdv-theme.css porte le
   meme jeu de jetons TROIS fois : une en clair, qui est la seule source ou un
   jeton naisse, et DEUX en sombre, parce qu'il faut suivre le reglage du
   telephone (le bloc @media) et obeir au bouton (le bloc [data-theme]).

   UN JETON DEFINI EN CLAIR ET OUBLIE EN SOMBRE, C'EST DU TEXTE INVISIBLE. Il ne
   leve aucune erreur, le CSS reste valide, la page se peint : simplement une
   encre reste #16181C sur un fond passe a #0B0C0E, et le vigneron lit du noir
   sur du noir. Et ca n'arrive QUE chez celui qui a le mauvais reglage, c'est-a-
   dire jamais chez celui qui developpe si son systeme est en clair.

   LE PIRE DES TROIS CAS EST LA DIVERGENCE DES DEUX BLOCS SOMBRES, et c'est le
   defaut classique de tout produit a deux themes : on corrige une couleur dans
   le bloc @media, on oublie le bloc [data-theme]. La couleur est alors JUSTE
   pour qui suit son telephone et FAUSSE pour qui a clique sur le bouton.
   Personne ne le voit, parce que personne ne teste les deux chemins : les deux
   mènent au meme mot « sombre », et on n'en essaie qu'un.

   CE QU'IL CONTROLE, DANS CET ORDRE :
     1. aucun jeton servi deux fois avec deux valeurs differentes ;
     2. tout jeton servi est ecrit dans tokens.css, a la meme valeur ;
     3. tout jeton de tokens.css est effectivement servi quelque part ;
     4. la parite des deux themes, en trois points :
        a. une MATIERE du bloc clair se retourne dans LES DEUX blocs sombres,
           et une ECHELLE ne se retourne dans aucun ;
        b. rien n'apparait dans un bloc sombre qui n'existe pas en clair ;
        c. les deux blocs sombres disent la meme chose, nom pour nom et valeur
           pour valeur.

   CE QU'IL NE CONTROLE PAS : que tokens.css soit SERVI. Il ne l'est pas, et
   c'est un arbitrage qui appartient a Ted, pas a un banc. Tant qu'il reste une
   doctrine, ce controle la maintient exacte. Le jour ou elle devient la feuille
   servie, ce banc reste valable sans une ligne de changement.
   ============================================================================ */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* LA DOCTRINE. */
const DOCTRINE = 'tokens.css';

/* LES FEUILLES REELLEMENT SERVIES AU NAVIGATEUR, dans l'ordre ou elles arrivent.
   style.css par le gabarit de base, les trois autres posees par bdv-nav.js et
   bdv-reglages.js a l'ouverture d'une piece du bureau. L'ordre compte : en cas
   de collision, c'est la DERNIERE posee qui gagne, et pour la page entiere. */
const SERVIES = [
  /* bdv-theme.css EN PREMIER parce qu'elle arrive en premier : elle est LIEE dans
     la tete du bureau, avant style.css, et pas posee par un script. Un theme pose
     apres le premier rendu fait clignoter la page, voir le bloc de tete de
     src/_includes/base.njk. Seul son bloc CLAIR entre ici : c'est la seule source
     ou un jeton naisse, et c'est donc la valeur que tokens.css doit dire. Les deux
     blocs sombres sont traites a part, par la section 4. */
  'src/css/bdv-theme.css',
  'src/css/style.css',
  'src/css/bdv-ecrans.css',
  'src/css/bdv-panneau.css',
  'src/css/bdv-calendrier.css',
];

/* LA FEUILLE DES DEUX THEMES, nommee a part parce que la section 4 la relit avec
   ses trois blocs, la ou les sections 1 a 3 n'en voient que le clair. */
const THEME = 'src/css/bdv-theme.css';

let ERR = 0, NOTES = 0;
const ok   = m => console.log('  ok    : ' + m);
const ko   = m => { ERR++;   console.log('  ECHEC : ' + m); };
const note = m => { NOTES++; console.log('  note  : ' + m); };

/* ---------------------------------------------------------------------------
   Lecture des blocs :root.

   Les commentaires partent AVANT le comptage des accolades, et pas apres : un
   bloc de commentaire du depot se ferme sur une ligne de tirets, et il en
   contient parfois des accolades d'exemple. C'est le meme piege que celui que
   banc-rejeu.mjs s'est tendu a lui-meme sur le SQL.

   ET `:root` N'EST PLUS FORCEMENT SEUL, 21/09/2026. Le bloc clair de
   src/css/bdv-theme.css s'ecrit `:root, [data-theme="light"]`, la forme sans
   `:root` etant ce qui permet a un CONTENEUR de forcer un theme sur son
   sous-arbre. La recherche accepte donc une liste de selecteurs APRES `:root`.

   ELLE N'ACCEPTE TOUJOURS PAS `:root[...]` NI `:root:not(...)`, ET C'EST VOULU :
   ce sont les deux blocs SOMBRES, et leurs valeurs ne doivent pas entrer ici.
   Sinon chaque couleur du theme serait « servie avec deux valeurs differentes »
   et la section 1 crierait trente fois sur une feuille parfaitement conforme.
   Ce qui est servi par defaut, c'est le clair ; le sombre est un retournement,
   et la section 4 le controle pour ce qu'il est.
   --------------------------------------------------------------------------- */
function jetonsDe(chemin) {
  const abs = path.join(RACINE, chemin);
  if (!fs.existsSync(abs)) { ko(chemin + ' est absent'); return {}; }
  const txt = fs.readFileSync(abs, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const out = {};
  let pos = 0;
  while (true) {
    const rel = txt.slice(pos).search(/(^|\n)\s*:root\s*(,[^{}]*?)?\{/);
    if (rel < 0) break;
    let j = txt.indexOf('{', pos + rel), d = 0, k = j;
    for (; k < txt.length; k++) { if (txt[k] === '{') d++; else if (txt[k] === '}') { d--; if (!d) break; } }
    for (const m of txt.slice(j + 1, k).matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+)/gi)) out[m[1]] = m[2].trim();
    pos = k + 1;
  }
  return out;
}

/* Deux ecritures de la meme valeur doivent compter pour une seule :
   `rgba(0,0,0,.28)` et `rgba(0, 0, 0, 0.28)` sont le meme gris. On compare donc
   une forme normalisee, jamais la chaine brute. */
const meme = v => v.toLowerCase()
                   .replace(/\s+/g, '')
                   .replace(/(^|[^0-9])\.(\d)/g, '$10.$2')
                   .replace(/;$/, '');

console.log('doctrine : ' + DOCTRINE);
console.log('feuilles servies : ' + SERVIES.length + '\n');

const doctrine = jetonsDe(DOCTRINE);
const parFeuille = SERVIES.map(f => [f, jetonsDe(f)]);
for (const [f, j] of parFeuille) console.log('  ' + String(Object.keys(j).length).padStart(4) + ' jeton(s) dans :root  ' + f);
console.log('  ' + String(Object.keys(doctrine).length).padStart(4) + ' jeton(s) dans :root  ' + DOCTRINE);

/* --- 1. COLLISIONS ------------------------------------------------------- */
console.log('\n== 1. Un nom, une valeur ==');
const parNom = new Map();
for (const [f, j] of parFeuille)
  for (const [n, v] of Object.entries(j)) {
    if (!parNom.has(n)) parNom.set(n, []);
    parNom.get(n).push([f, v]);
  }
let collisions = 0, doublons = 0;
for (const [n, l] of parNom) {
  const valeurs = new Set(l.map(x => meme(x[1])));
  if (valeurs.size > 1) {
    collisions++;
    ko('--' + n + ' est servi avec ' + valeurs.size + ' valeurs differentes :');
    l.forEach(([f, v]) => console.log('            ' + f.padEnd(26) + v));
    console.log('            la derniere feuille posee gagne, et elle gagne pour la page entiere.');
  } else if (l.length > 1) doublons++;
}
if (!collisions) ok('aucun jeton servi avec deux valeurs differentes');
if (doublons) note(doublons + ' jeton(s) redeclare(s) a l\'identique dans plusieurs feuilles : '
                 + 'c\'est voulu tant que bdv-ecrans.css doit rester lisible seule, '
                 + 'mais chaque doublon est une derive qui attend.');

/* --- 2. LA DOCTRINE CONNAIT-ELLE TOUT CE QUI EST SERVI ? ----------------- */
console.log('\n== 2. Tout ce qui est servi est ecrit dans la doctrine ==');
const servis = {};
for (const [, j] of parFeuille) Object.assign(servis, j);
const absents = Object.keys(servis).filter(n => !(n in doctrine)).sort();
const ecarts  = Object.keys(servis).filter(n => n in doctrine && meme(servis[n]) !== meme(doctrine[n]));
if (absents.length) {
  ko(absents.length + ' jeton(s) servi(s) au navigateur et absent(s) de ' + DOCTRINE + ' :');
  console.log('            ' + absents.map(n => '--' + n).join(', '));
  console.log('            ecris-les la-bas AVEC la raison qui les fait exister, pas seulement leur valeur.');
} else ok('les ' + Object.keys(servis).length + ' jetons servis sont tous ecrits dans ' + DOCTRINE);
if (ecarts.length) {
  ko(ecarts.length + ' jeton(s) dont la doctrine ne dit plus la valeur servie :');
  ecarts.forEach(n => console.log('            --' + n + '\n              ' + DOCTRINE.padEnd(22) + doctrine[n]
                                + '\n              servi' .padEnd(23) + servis[n]));
} else ok('aucune valeur divergente entre la doctrine et le servi');

/* --- 3. LA DOCTRINE PARLE-T-ELLE DE CHOSES QUI N'EXISTENT PLUS ? -------- */
console.log('\n== 3. Rien dans la doctrine qui ne soit servi ==');
const fantomes = Object.keys(doctrine).filter(n => !(n in servis)).sort();
if (fantomes.length) note(fantomes.length + ' jeton(s) ecrit(s) dans ' + DOCTRINE + ' et servi(s) nulle part : '
                        + fantomes.map(n => '--' + n).join(', '));
else ok('aucun jeton fantome');

/* ---------------------------------------------------------------------------
   4. LA PARITE DES DEUX THEMES
   ---------------------------------------------------------------------------
   Ce que cette section lit : les TROIS blocs de src/css/bdv-theme.css, pas le
   seul `:root` que lisent les sections 1 a 3.

     CLAIR    `:root, [data-theme="light"]`                   la source
     @media   `:root:not([data-theme="light"])` sous
              `@media (prefers-color-scheme: dark)`           le telephone
     BOUTON   `:root[data-theme="dark"], [data-theme="dark"]` le choix

   POURQUOI LE POINT (a) NE DIT PAS « TOUT JETON DU CLAIR SE RETROUVE EN SOMBRE ».
   Parce que ce serait faux, et qu'un controle faux des son premier jour se
   contourne au lieu de se lire. Le bloc clair porte cinquante jetons, les blocs
   sombres trente : les vingt autres sont les ECHELLES, rayons, ecarts, tailles
   de texte, durees et courbe. Elles sont IDENTIQUES dans les deux themes, et
   c'est une decision : un theme change des couleurs, il ne change ni le rythme
   ni la taille du texte.

   La regle exacte est donc dans la VALEUR, pas dans une liste de noms qu'il
   faudrait tenir a la main et qui se perimerait au premier jeton ajoute :
     . une valeur qui est une longueur, une duree ou une courbe est une ECHELLE.
       Elle ne doit se retourner dans AUCUN bloc sombre. Si elle s'y retourne,
       le theme s'est mis a changer le rythme, et ca se verra sur la mise en
       page entiere de qui a ce reglage.
     . tout le reste est une MATIERE, couleur ou famille de peinture. Elle doit
       se retourner dans LES DEUX blocs sombres, sinon elle garde sa valeur
       claire sur un fond sombre. C'est du texte invisible, sans erreur, et
       seulement chez celui qui a le mauvais reglage.
--------------------------------------------------------------------------- */
console.log('\n== 4. La parite des deux themes ==');
{
  const absTheme = path.join(RACINE, THEME);
  if (!fs.existsSync(absTheme)) {
    ko(THEME + ' est absent : la parite des themes n\'a rien a comparer');
  } else {
    /* On redecoupe le fichier en BLOCS avec leur cadre (@media, @supports...),
       parce que le seul selecteur ne suffit pas a distinguer le bloc du
       telephone du bloc du bouton : c'est le cadre qui les separe. Comme
       partout dans ce banc, les commentaires partent AVANT le comptage des
       accolades. */
    const brut = fs.readFileSync(absTheme, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const blocs = [];
    (function marche(t, cadre) {
      let pos = 0;
      while (true) {
        const o = t.indexOf('{', pos);
        if (o < 0) break;
        const sel = t.slice(pos, o).replace(/\s+/g, ' ').trim();
        let d = 0, k = o;
        for (; k < t.length; k++) { if (t[k] === '{') d++; else if (t[k] === '}') { d--; if (!d) break; } }
        const corps = t.slice(o + 1, k);
        if (sel.startsWith('@')) marche(corps, cadre.concat(sel.replace(/\s+/g, '')));
        else blocs.push({ sel, cadre: cadre.join(' '), corps });
        pos = k + 1;
      }
    })(brut, []);

    const declarations = corps => {
      const o = {};
      for (const m of corps.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+)/gi)) o[m[1]] = m[2].trim();
      return o;
    };
    const fusionne = liste => Object.assign({}, ...liste.map(b => declarations(b.corps)));
    const parts = sel => sel.split(',').map(x => x.trim()).filter(Boolean);

    const bClair  = blocs.filter(b => !b.cadre && parts(b.sel).includes(':root'));
    const bMedia  = blocs.filter(b => /prefers-color-scheme:dark/.test(b.cadre) && /\[data-theme/.test(b.sel));
    const bBouton = blocs.filter(b => !b.cadre && /\[data-theme="dark"\]/.test(b.sel));

    const CLAIR = fusionne(bClair), MEDIA = fusionne(bMedia), BOUTON = fusionne(bBouton);
    console.log('  bloc clair  : ' + String(Object.keys(CLAIR).length).padStart(3) + ' jeton(s)   ' + (bClair[0]  ? bClair[0].sel  : 'ABSENT'));
    console.log('  bloc @media : ' + String(Object.keys(MEDIA).length).padStart(3) + ' jeton(s)   ' + (bMedia[0]  ? bMedia[0].sel  : 'ABSENT'));
    console.log('  bloc bouton : ' + String(Object.keys(BOUTON).length).padStart(3) + ' jeton(s)   ' + (bBouton[0] ? bBouton[0].sel : 'ABSENT'));

    /* UN BLOC ABSENT N'EST PAS UNE PARITE PARFAITE, c'est un theme qui manque.
       Sans ce garde, supprimer le bloc du bouton rendrait toutes les comparaisons
       vides et le banc annoncerait CONFORME sur un bureau dont le bouton ne fait
       plus rien. C'est la regle du depot : un controle qui ne peut pas s'executer
       doit crier, jamais se taire. */
    if (!bClair.length)  ko('le bloc CLAIR de ' + THEME + ' est introuvable : la source des jetons a disparu');
    if (!bMedia.length)  ko('le bloc @media (prefers-color-scheme: dark) de ' + THEME + ' est introuvable : le reglage du telephone n\'est plus suivi');
    if (!bBouton.length) ko('le bloc [data-theme="dark"] de ' + THEME + ' est introuvable : le bouton de bascule ne peint plus rien');

    if (bClair.length && bMedia.length && bBouton.length) {
      /* Une ECHELLE se reconnait a sa valeur : longueur, duree, ou courbe de
         temps. Tout le reste est une matiere. On ne tient PAS une liste de noms :
         elle se perimerait au premier jeton ajoute, et un garde-fou qui se
         perime sans le dire est pire que pas de garde-fou. */
      const EST_ECHELLE = v => /^-?\d*\.?\d+(px|rem|em|ex|ch|%|ms|s|vh|vw|dvh|dvw)$/i.test(v.trim())
                            || /^-?\d*\.?\d+$/.test(v.trim())
                            || /^(cubic-bezier|steps|linear)\s*\(/i.test(v.trim())
                            || /^(ease|ease-in|ease-out|ease-in-out|step-start|step-end)$/i.test(v.trim());

      const OU = [['@media', MEDIA], ['[data-theme="dark"]', BOUTON]];
      let eA = 0, eB = 0, eC = 0;

      /* --- a. le clair vers le sombre ------------------------------------- */
      for (const n of Object.keys(CLAIR).sort()) {
        const v = CLAIR[n];
        if (EST_ECHELLE(v)) {
          const fautifs = OU.filter(([, m]) => n in m).map(([q]) => q);
          if (fautifs.length) {
            eA++;
            ko('--' + n + ' vaut ' + v + ', c\'est une ECHELLE, et le sombre la retourne dans ' + fautifs.join(' et ') + ' :');
            console.log('            un theme change des couleurs, il ne change ni le rythme ni la taille du texte.');
          }
        } else {
          const manque = OU.filter(([, m]) => !(n in m)).map(([q]) => q);
          if (manque.length) {
            eA++;
            ko('--' + n + ' vaut ' + v + ' en clair et n\'est retourne dans ' + manque.join(' ni ') + ' :');
            console.log('            il garde donc sa valeur CLAIRE sur un fond sombre. Aucune erreur, du TEXTE');
            console.log('            INVISIBLE, et seulement chez celui qui a ce reglage-la.');
          }
        }
      }

      /* --- b. le sombre vers le clair ------------------------------------- */
      for (const [q, m] of OU) {
        for (const n of Object.keys(m).sort()) {
          if (n in CLAIR) continue;
          eB++;
          ko('--' + n + ' nait dans le bloc sombre ' + q + ' et n\'existe pas dans le bloc clair :');
          console.log('            il ne vaut RIEN pour qui est en clair, et var(--' + n + ') y rendra la chaine vide.');
          console.log('            Tout jeton nait dans le bloc clair, les blocs sombres ne font que retourner.');
        }
      }

      /* --- c. les deux blocs sombres l'un contre l'autre ------------------- */
      for (const n of [...new Set([...Object.keys(MEDIA), ...Object.keys(BOUTON)])].sort()) {
        const a = MEDIA[n], b = BOUTON[n];
        if (a === undefined || b === undefined) {
          eC++;
          ko('--' + n + ' n\'est que dans UN des deux blocs sombres, ' + (a === undefined ? '[data-theme="dark"]' : '@media') + ' :');
          console.log('            juste pour qui suit son telephone, faux pour qui a clique sur le bouton, ou l\'inverse.');
        } else if (meme(a) !== meme(b)) {
          eC++;
          ko('--' + n + ' diverge entre les deux blocs sombres :');
          console.log('            @media               ' + a);
          console.log('            [data-theme="dark"]  ' + b);
          console.log('            une couleur corrigee d\'un seul cote : juste pour un chemin, fausse pour l\'autre,');
          console.log('            et personne ne le voit parce que personne ne teste les deux.');
        }
      }

      if (!eA) ok('a. toute matiere du clair est retournee dans les deux blocs sombres, aucune echelle ne l\'est');
      if (!eB) ok('b. aucun jeton ne nait dans un bloc sombre');
      if (!eC) ok('c. les deux blocs sombres disent la meme chose, nom pour nom et valeur pour valeur');
    }
  }
}

/* --- VERDICT ------------------------------------------------------------- */
console.log('\n== VERDICT ==');
console.log('  echecs : ' + ERR + '   notes : ' + NOTES);
if (ERR === 0) { console.log('  CONFORME : la doctrine dit ce que le navigateur recoit.\n'); process.exit(0); }
console.log('  NON CONFORME : ' + DOCTRINE + ' ne decrit plus ce que le navigateur recoit.\n');
process.exit(1);
