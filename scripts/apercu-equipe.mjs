/* ============================================================================
   scripts/apercu-equipe.mjs : L'EQUIPE, EN IMAGE

     npm run build && npm run apercu:equipe
     puis ouvrir _apercu/equipe.html

   POURQUOI IL EXISTE. Le 14/09/2026, la piece « L'equipe » est partie en
   production avec une `.zone` qui ne disait pas sa largeur. `.bureau-plan` est
   une grille de douze colonnes : la zone est tombee dans UNE colonne, environ
   soixante pixels, et tout le texte s'est ecrit une lettre par ligne. Les
   dix-huit controles de `npm run verif` etaient verts. C'est Ted qui l'a vu.

   La lecon etait deja ecrite dans CLAUDE.md depuis le 11/09/2026 : « une mesure
   dit qu'une page ne deborde pas, une capture dit qu'elle SE LIT ». Ce fichier
   la rend applicable sans navigateur sur le poste.

   IL NE VERIFIE RIEN, IL MONTRE. Comme apercu:panneau et apercu:fiche, il n'est
   pas dans `npm run verif` : il s'ouvre et se regarde avec des yeux. Ce qu'il
   sait dire tout seul tient en une ligne, en bas : les mots vides.

   IL LIT LA PAGE CONSTRUITE, `_site/mon-bureau/index.html`, et la vraie feuille.
   Le balisage n'est donc jamais recopie a la main : une coque modifiee dans le
   gabarit se voit ici au build suivant. Un harnais qui recopie derive.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(RACINE, '_site/mon-bureau/index.html');
/* LES QUATRE FEUILLES DU BUREAU, DANS L'ORDRE OU LE GABARIT LES LIE, ET C'EST
   UNE CORRECTION DU 21/09/2026. Ce fichier ne posait que `style.css`. Depuis la
   scission du matin, `style.css` ne contient plus UNE SEULE regle `.equipe-*` :
   l'apercu rendait donc la piece entierement NUE, et il l'a fait toute la
   journee sans que rien ne le dise. C'est le meme defaut que celui du harnais de
   capture, dans un autre fichier : un apercu qui ne montre pas ce que le
   vigneron voit valide ce qu'il ne voit pas.
   L'ORDRE COMPTE AUTANT QUE LA LISTE : bdv-poste.css est liee ENTRE style.css et
   bdv-bureau.css, et c'est ce qui donne a la coque le dernier mot a specificite
   egale. Inverser les deux retournerait la moitie des arbitrages de ce lot.
   DEPUIS LE 22/09/2026, LA LISTE N'EST PLUS ECRITE ICI : `apercu-socle.mjs` la
   lit sur la page CONSTRUITE, et `npm run banc:apercus` echoue si un apercu
   s'en refabrique une a lui. Une liste tenue a la main ment le jour ou on
   l'oublie, et celle-ci avait deja menti une journee entiere. */
const MODULE = path.join(RACINE, 'src/js/bdv-equipe.js');

import { cssBureau, TETE_POLICES, chargerJsdom, exigerLaPageConstruite,
         motsVides } from './apercu-socle.mjs';

const JSDOM = await chargerJsdom();
exigerLaPageConstruite();

/* UN SEUL DECOR POUR LES DEUX HARNAIS, 21/09/2026. Les equipiers, les
   invitations en attente et les deux identifiants de bureau viennent de
   scripts/bureau-garni.mjs, c'est-a-dire du meme endroit que ceux de la capture
   Chromium. Ils etaient ecrits DEUX FOIS, et ce depot a deja paye ce
   dedoublement : c'est la premiere phrase du bloc de tete de bureau-garni.mjs,
   « copie a l'identique, il portait le meme defaut a l'identique, et le
   corriger d'un cote n'aurait rien corrige de l'autre ». */
import { EQUIPIERS, ATTENTES, BUREAU_A, BUREAU_B, MOI } from './bureau-garni.mjs';

/* Le decor : un faux compte et un faux serveur. Les reponses sont celles que
   rendent vraiment les fonctions du lot 18, champ pour champ. */
function monter(opts) {
  /* `dangerously` ET `beforeParse`, comme le banc de « Ma journee » : un script
     ajoute au document ne s'execute pas en `outside-only`, et le faux compte doit
     exister AVANT que le script en ligne de la page ne s'analyse, sinon il sort sur
     `if(!connecte) return;` et on photographie une page vide. La console virtuelle
     est muette : les scripts externes de la page ne sont pas charges, et leurs
     absences ne sont pas le sujet de cet apercu. */
  const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), {
    url: 'https://lebureauduvigneron.fr/mon-bureau/',
    runScripts: 'dangerously',
    beforeParse(w) { w.BdvCompte = compte(opts); }
  });
  const w = dom.window;
  w.BdvCompte = compte(opts);
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(MODULE, 'utf8');
  w.document.body.appendChild(s);
  return w;
}

function compte(opts) {
  return {
    monId: () => MOI,
    monBureau: () => opts.sansBureau ? null : BUREAU_A,
    session: () => ({ user: { id: MOI } }),
    mesBureaux: () => Promise.resolve(opts.unSeulBureau
      ? [{ bureau: BUREAU_A, nom: 'Solucorp', role: 'maitre' }]
      : [{ bureau: BUREAU_A, nom: 'Solucorp', role: 'maitre' },
         { bureau: BUREAU_B, nom: 'Domaine Solugroup', role: 'simple' }]),
    refusDeProprietaire: () => false,
    rpcPublic: () => Promise.resolve([{ bureau_nom: 'Solucorp', invite_par_prenom: 'Teddy',
                                        email: 'romane@solumatic.fr', etat: 'valide' }]),
    ouvrir: () => {},
    api: (chemin) => {
      if (chemin.indexOf('/rpc/equipe') === 0) return Promise.resolve(opts.equipe);
      if (chemin.indexOf('/invitations') === 0) return Promise.resolve(opts.invitations || []);
      if (chemin.indexOf('/bureaux') === 0) return Promise.resolve([{ nom: 'Solucorp' }]);
      return Promise.resolve([]);
    }
  };
}

const EQUIPE = EQUIPIERS;

const vues = [];
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

/* 1. LE MAITRE, avec deux bureaux : tout est la, le selecteur compris. */
{
  const w = monter({ equipe: EQUIPE, invitations: ATTENTES });
  await w.BdvEquipe.ouvrir();
  await dormir(30);
  // Le lien qui ne s'affiche qu'une fois : on le montre, c'est l'ecran le plus
  // facile a rater puisqu'il n'apparait qu'apres un geste.
  const l = w.document.getElementById('equipeLien');
  l.hidden = false;
  w.document.getElementById('equipeLienQui').textContent = 'alice@domaine-essai.fr';
  w.document.getElementById('equipeLienTexte').value =
    'https://lebureauduvigneron.fr/mon-bureau/?invitation='
    + '2990143f50f7a1c4b8e9d0f3a6b7c8d9e0f1a2b3c4d5e6f70819a2b3c4d5e6f7';
  vues.push({ titre: 'Un maitre, dans un bureau partage',
              note: 'Selecteur, equipe, invitation, lien a copier, invitations en attente',
              html: w.document.querySelector('.zone--equipe').outerHTML });
}

/* 2. LE SIMPLE UTILISATEUR : ni formulaire, ni gestes, ni invitations. C'est la
      vue la moins regardee et la plus facile a casser. */
{
  const equipe = EQUIPE.map(g => g.personne === MOI ? { ...g, role: 'simple' } : g);
  const w = monter({ equipe: equipe, unSeulBureau: true });
  await w.BdvEquipe.ouvrir();
  await dormir(30);
  vues.push({ titre: 'Un simple utilisateur, un seul bureau',
              note: 'Pas de formulaire, pas de gestes, et pas de selecteur : un choix a une ligne est un ecran mort',
              html: w.document.querySelector('.zone--equipe').outerHTML });
}

/* 3. LE BANDEAU D'INVITATION, dans ses deux etats. C'est la premiere chose que
      voit quelqu'un qui arrive par un lien, et souvent la seule qu'il lira. */
{
  const w = monter({ equipe: EQUIPE });
  w.history.replaceState(null, '', '/mon-bureau/?invitation=essai');
  await w.BdvEquipe.traiterInvitation();
  await dormir(40);
  vues.push({ titre: 'Le bandeau d’invitation, deja connecte',
              note: 'Il vit AU-DESSUS des pieces : range dans « Ma journee », il disparaissait des qu’on changeait de piece',
              html: w.document.getElementById('invitationBandeau').outerHTML });
}

/* 4. AUCUN BUREAU. L'etat le moins regarde du lot 20, et celui ou quelqu'un se
      retrouve enferme dehors si l'ecran ne dit rien. */
{
  const w = monter({ equipe: [], sansBureau: true });
  await w.BdvEquipe.ouvrir();
  await dormir(30);
  vues.push({ titre: 'Quand on n\u2019appartient a aucun bureau',
              note: 'Possible depuis le lot 20 : un invite n\u2019a pas de bureau solo, et on peut le retirer du seul qu\u2019il avait',
              html: w.document.querySelector('.zone--equipe').outerHTML });
}

/* 5. LE BANDEAU POUR QUELQU'UN QUI N'A PAS ENCORE DE COMPTE. Deux chemins nets,
      et l'adresse dite : c'est le cas que Ted a trouve « tres complexe ». */
{
  const w = monter({ equipe: EQUIPE, sansSession: true });
  w.BdvCompte.session = () => null;
  w.history.replaceState(null, '', '/mon-bureau/?invitation=essai');
  await w.BdvEquipe.traiterInvitation();
  await dormir(40);
  vues.push({ titre: 'Le bandeau, pour quelqu\u2019un qui n\u2019a pas de compte',
              note: 'La question « as-tu deja un compte ? » se pose ici, pas trois ecrans plus loin, et l\u2019adresse invitee est dite',
              html: w.document.getElementById('invitationBandeau').outerHTML });
}

const page = '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<title>Aperçu de la pièce L’équipe</title>'
  + '<link rel="preconnect" href="https://fonts.googleapis.com">'
  + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  + TETE_POLICES
  + '<style>' + cssBureau() + '</style>'
  /* LA ZONE EST REMISE DANS SA GRILLE DE DOUZE COLONNES, et c'est le coeur de
     l'affaire : c'est de la que venait le defaut du 14/09/2026. Une page
     d'apercu qui poserait la zone sur une largeur libre ne pourrait PAS le
     montrer, et validerait exactement ce qui etait casse. */
  + '<style>body{background:var(--bdv-fond);padding:2rem;margin:0}'
  + '.ap{max-width:1180px;margin:0 auto}'
  + '.ap__c{margin-bottom:2.5rem}'
  + '.ap__c h3{font-family:var(--font-mono);font-size:12px;text-transform:uppercase;'
  + 'letter-spacing:.09em;color:var(--bdv-encre-4);margin:0 0 .2rem}'
  + '.ap__c p.ap__n{font-family:var(--font-mono);font-size:11px;color:var(--bdv-encre-4);margin:0 0 .8rem}'
  /* LES DEUX THEMES COTE A COTE, ET C'EST LE SEUL MOYEN DE LES JUGER SUR LE
     MEME ECRAN. `[data-theme]` sans `:root` existe dans bdv-theme.css POUR CA :
     un conteneur redeclare les jetons et retourne tout son sous-arbre, champs
     natifs compris (`color-scheme` est pose sur `[data-theme]` aussi). */
  + '.ap__duo{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;align-items:start}'
  + '@media (max-width:900px){.ap__duo{grid-template-columns:1fr}}'
  /* IL FAUT REDIRE `color`, ET CET APERCU L'A PROUVE AU PREMIER PASSAGE.
     `[data-theme="dark"]` retourne les JETONS de son sous-arbre, mais pas les
     proprietes deja CALCULEES au-dessus : `body.bdv-coque{color:var(--bdv-encre-2)}`
     est resolu sur le <body>, donc avec les valeurs CLAIRES, et cette encre-la
     descend telle quelle dans le conteneur sombre. Resultat au premier passage :
     les NOMS des equipiers, qui n'ont pas de couleur a eux et vivent
     d'heritage, sortaient en #33383F sur un fond sombre. C'est un defaut de
     l'APERCU et pas du produit (la vraie page pose `data-theme` sur `html`, et
     le releve Chromium du 21/09/2026 donne zero paire sous seuil), mais c'est
     exactement le genre de mensonge qui fait valider un ecran casse. Un
     conteneur qui force un theme redit donc TOUT ce que la coque pose sur le
     corps de page : le fond ET l'encre. */
  + '.ap__t{padding:1rem;border-radius:8px;background:var(--bdv-fond);'
  + 'color:var(--bdv-encre-2);outline:1px solid var(--bdv-trait)}'
  + '.ap__t > .ap__l{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;'
  + 'letter-spacing:.09em;color:var(--bdv-encre-4);margin:0 0 .5rem}'
  + '</style>'
  /* LE CORPS PORTE `bdv-coque`, ET SANS LUI L'APERCU EST UN MENSONGE : les 700
     regles du dessin du bureau sont toutes scopees par cette classe, que
     src/_includes/base.njk pose sur le <body> du seul /mon-bureau/. Sans elle,
     ni bouton, ni champ, ni zone, ni rangee : exactement la moitie de ce qu'on
     vient de repeindre. */
  + '</head><body class="bdv-coque"><div class="ap">'
  + vues.map(v => '<div class="ap__c"><h3>' + v.titre + '</h3><p class="ap__n">' + v.note
      + '</p><div class="ap__duo">'
      + ['light', 'dark'].map(t => '<div class="ap__t" data-theme="' + t + '">'
          + '<p class="ap__l">' + (t === 'light' ? 'clair' : 'sombre') + '</p>'
          + '<div class="bureau-plan">' + v.html + '</div></div>').join('')
      + '</div></div>').join('')
  + '</div></body></html>';

fs.mkdirSync(path.join(RACINE, '_apercu'), { recursive: true });
fs.writeFileSync(path.join(RACINE, '_apercu/equipe.html'), page);
console.log('  ecrit : _apercu/equipe.html  (' + vues.length + ' etats x 2 themes)');

/* CE QUE LA MESURE PEUT DIRE SANS L'IMAGE : les mots vides. Un NaN, un undefined
   ou un « null » dans du texte rendu est un defaut qu'on ne voit pas en regardant
   vite. Le controle vit dans le socle depuis le 22/09/2026 : il etait recopie
   dans quatre fichiers. */
if (motsVides(vues.map(v => v.html)).length) process.exit(1);
