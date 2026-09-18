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
const FEUILLE = path.join(RACINE, 'src/css/style.css');
const MODULE = path.join(RACINE, 'src/js/bdv-equipe.js');

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) { console.error('  il manque jsdom :  npm install --save-dev jsdom'); process.exit(1); }
if (!fs.existsSync(PAGE)) {
  console.error('  la page construite manque :  npm run build  d\'abord');
  process.exit(1);
}

const BUREAU_A = 'b0000000-0000-0000-0000-000000000001';
const BUREAU_B = 'b0000000-0000-0000-0000-000000000002';
const MOI = '11111111-1111-1111-1111-111111111111';

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

const EQUIPE = [
  { personne: MOI, role: 'maitre', depuis: '2026-09-01T08:00:00Z',
    prenom: 'Ted', nom: 'Pereira', email: 'teddypereira88@gmail.com' },
  { personne: '2', role: 'simple', depuis: '2026-09-10T08:00:00Z',
    prenom: 'Romane', nom: 'Bouijoux', email: 'romane@solumatic.fr' },
  { personne: '3', role: 'maitre', depuis: '2026-09-12T08:00:00Z',
    prenom: 'Camila', nom: 'Vendramini', email: 'camila.vendramini@solumatic.fr' }
];
const ATTENTES = [
  { email: 'alice@domaine-essai.fr', role: 'simple', cree_le: '2026-09-14T08:00:00Z',
    expire_le: '2026-09-21T08:00:00Z', utilise_le: null }
];

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
  + '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">'
  + '<style>' + fs.readFileSync(FEUILLE, 'utf8') + '</style>'
  /* LA ZONE EST REMISE DANS SA GRILLE DE DOUZE COLONNES, et c'est le coeur de
     l'affaire : c'est de la que venait le defaut du 14/09/2026. Une page
     d'apercu qui poserait la zone sur une largeur libre ne pourrait PAS le
     montrer, et validerait exactement ce qui etait casse. */
  + '<style>body{background:var(--paper-deep);padding:2rem;margin:0}'
  + '.ap{max-width:1180px;margin:0 auto}'
  + '.ap__c{margin-bottom:2.5rem}'
  + '.ap__c h3{font-family:var(--font-mono);font-size:var(--t-mini);text-transform:uppercase;'
  + 'letter-spacing:var(--ls-large);color:var(--muted);margin:0 0 .2rem}'
  + '.ap__c p.ap__n{font-family:var(--font-mono);font-size:var(--t-micro);color:var(--muted);margin:0 0 .8rem}'
  + '.ap__plan{background:var(--paper)}</style>'
  + '</head><body><div class="ap">'
  + vues.map(v => '<div class="ap__c"><h3>' + v.titre + '</h3><p class="ap__n">' + v.note
      + '</p><div class="bureau-plan ap__plan">' + v.html + '</div></div>').join('')
  + '</div></body></html>';

fs.mkdirSync(path.join(RACINE, '_apercu'), { recursive: true });
fs.writeFileSync(path.join(RACINE, '_apercu/equipe.html'), page);
console.log('  ecrit : _apercu/equipe.html  (' + vues.length + ' etats)');

/* CE QUE LA MESURE PEUT DIRE SANS L'IMAGE : les mots vides. Un NaN, un undefined
   ou un « null » dans du texte rendu est un defaut qu'on ne voit pas en regardant
   vite. Meme controle que l'apercu de la fiche client. */
const texte = vues.map(v => v.html).join(' ').replace(/<[^>]+>/g, ' ');
const sales = ['NaN', 'undefined', 'null', '[object'].filter(m => texte.indexOf(m) >= 0);
console.log(sales.length ? '  ALERTE : ' + sales.join(', ') + ' dans le texte rendu'
                         : '  aucun mot vide dans le texte rendu');
if (sales.length) process.exit(1);
