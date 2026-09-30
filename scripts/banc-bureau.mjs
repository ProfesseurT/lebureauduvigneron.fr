/* ============================================================================
   scripts/banc-bureau.mjs : le banc du bureau

     npm run build && npm run banc

   PREMIER TEST AUTOMATISE DU DEPOT, ecrit le 07/09/2026 au lot 1 de la fusion,
   etendu au lot 2c. Jusqu'ici « CONFORME » ne voulait dire que « la charte
   graphique tient », jamais « ca marche ».

   IL DEMANDE jsdom :  npm install --save-dev jsdom
   Sans lui, le banc s'arrete en le disant, et il ne rend jamais un faux OK.
   C'est la lecon de charte:dash, qui a annonce CONFORME sur du vide deux fois en
   une journee : un controle qui ne peut pas s'executer doit crier, pas se taire.

   IL LIT LE HTML PRODUIT, `_site/mon-bureau/index.html`, et pas le gabarit :
   c'est ce fichier-la que le vigneron recoit. Lancer `npm run build` avant,
   sinon on controle la page d'hier.

   CE QU'IL NE FAIT PAS. Il n'execute aucun script de la page : le bureau en
   charge huit, dont trois depuis un CDN. Il monte la barre a la main et remplace
   le chargement des ecrans de vente par un faux reseau qui repond tout de suite.
   Il verifie donc l'enchainement des gestes, jamais le rendu d'un chiffre. Les
   cinq controles de CLAUDE.md sur un export reel restent a faire a l'ecran.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(RACINE, '_site/mon-bureau/index.html');
const MODULE = path.join(RACINE, 'src/js/bdv-nav.js');

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) {
  console.error('\n  jsdom est absent, le banc ne peut pas tourner.');
  console.error('  Rien n\'a ete verifie. Installe-le :  npm install --save-dev jsdom\n');
  process.exit(2);
}
if (!fs.existsSync(PAGE)) {
  console.error('\n  ' + path.relative(RACINE, PAGE) + ' est absent : lance npm run build d\'abord.\n');
  process.exit(2);
}

const HTML = fs.readFileSync(PAGE, 'utf8');
const NAV = fs.readFileSync(MODULE, 'utf8');

let ok = 0, ko = 0;
const t = (nom, cond, detail) => {
  if (cond) { ok++; console.log('  ok    : ' + nom); }
  else { ko++; console.log('  ECHEC : ' + nom + (detail ? '  →  ' + detail : '')); }
};
const titre = (x) => console.log('\n== ' + x + ' ==');

console.log('page  : ' + path.relative(RACINE, PAGE));
console.log('module: ' + path.relative(RACINE, MODULE));

/* Un bureau tout neuf, a l'adresse demandee. Le faux reseau resout chaque <link> et
   chaque <script> ajoute par le chargeur des ecrans : sans lui, le banc mesurerait la
   capacite de jsdom a joindre un CDN, ce qui n'apprend rien sur le bureau. */
function bureau(hash) {
  const dom = new JSDOM(HTML, {
    runScripts: 'outside-only', pretendToBeVisual: true,
    url: 'https://x.test/mon-bureau/' + (hash || '')
  });
  const { window } = dom;
  const doc = window.document;
  const charges = [];
  const vrai = doc.head.appendChild.bind(doc.head);
  doc.head.appendChild = function (n) {
    const r = vrai(n);
    if (n.tagName === 'LINK' || n.tagName === 'SCRIPT') {
      charges.push(n.getAttribute('href') || n.getAttribute('src'));
      // Dans l'ordre d'un vrai chargement : l'evenement arrive apres le tour de boucle.
      setTimeout(() => { if (n.onload) n.onload(); }, 0);
    }
    return r;
  };
  const appels = [];
  window.demarrerEcransVente = (d) => { appels.push(d || {}); };
  window.ouvrirPanneauReglages = () => { appels.push({ panneau: true }); };
  window.BdvReglages = {
    ouvrir: () => { appels.push({ panneau: true }); },
    rafraichir: () => { appels.push({ rafraichi: true }); },
    dire: (m) => { appels.push({ dit: m }); }
  };
  window.eval(NAV);
  window.BdvNav.monter(doc.getElementById('bureauNav'), 'journee');
  /* Mes taches est branchee par la barre a l'ouverture de la piece. Le double note
     l'appel : ce banc verifie l'enchainement des gestes, pas ce que le module ecrit,
     qui est le travail de scripts/banc-taches.mjs. */
  window.BdvTaches = { ouvrir: () => { appels.push({ taches: true }); } };
  /* Le calendrier, comme les taches : la barre l'ouvre, le double note l'appel. La
     difference est qu'il arrive par le chargeur, donc APRES le faux onload du script.
     On pose le double des maintenant : jsdom n'execute pas le fichier charge, et sans
     lui la branche trouverait `window.BdvCalendrier` indefini et ne dirait rien. */
  window.BdvCalendrier = { ouvrir: () => { appels.push({ calendrier: true }); } };
  return { window, doc, charges, appels,
    journee: doc.getElementById('bureauJournee'),
    taches: doc.getElementById('bureauTaches'),
    calendrier: doc.getElementById('bureauCalendrier'),
    ventes: doc.getElementById('bureauVentes'),
    nav: doc.getElementById('bureauNav'),
    clic(piece) {
      const l = doc.querySelector('.bureau-nav__ligne[data-piece="' + piece + '"]');
      const it = l && l.querySelector('.bureau-nav__item');
      if (!it) throw new Error('piece introuvable : ' + piece);
      it.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    },
    /* UNE ATTENTE FIXE EST UNE COURSE, PAS UN CONTROLE. Corrige le 15/09/2026.
       Ce banc echouait par intermittence sur « un lien de fiche client ouvre la
       fiche », et seulement DANS `npm run verif` : jamais lance seul, toujours
       apres `npm run build`, quand la machine est encore chargee. Soixante
       millisecondes suffisaient a froid et pas a chaud, et le rouge tombait sur
       une assertion qui n'avait rien a se reprocher.
       Un banc qui crie une fois sur trois sur du sain finit par ne plus etre lu,
       et ce jour-la on perd aussi les cent-neuf controles qui, eux, disent vrai.
       `repos()` sans argument garde l'ancien comportement ; avec une condition,
       il attend qu'elle soit vraie, jusqu'a deux secondes. */
    async repos(condition, budget = 2000) {
      if (typeof condition !== 'function') return new Promise(r => setTimeout(r, 60));
      const fin = Date.now() + budget;
      while (Date.now() < fin) {
        if (condition()) return;
        await new Promise(r => setTimeout(r, 10));
      }
      return condition();
    }
  };
}

/* ======================= LA BARRE (lot 1) ======================= */
titre('La barre du bureau');
const B = bureau();
t('le module s\'expose', typeof B.window.BdvNav.monter === 'function');
t('la coque de l\'atelier existe dans le HTML produit',
  !!B.nav && !!B.doc.getElementById('bureauAtelier'));

const lignes = [...B.nav.querySelectorAll('.bureau-nav__ligne')];
/* DIX PIECES DEPUIS LE 29/09/2026, lot 43 : « Mes affaires » est entree dans « Mon
   commerce », dont elle est l'onglet « A gagner », et la piece fusionnee a pris sa
   place juste apres le calendrier. Decision de Ted, voir CLAUDE.md. */
t('dix pieces montees (Mon commerce absorbe Mes affaires, 29/09/2026)', lignes.length === 10, lignes.length + ' trouvee(s)');
/* L'ORDRE EST UN CONTROLE ET PAS UN DETAIL : il porte l'hypothese H2 du document
   de refonte, le vigneron vient pour ne rien oublier. Si quelqu'un le change, il
   doit le changer ICI aussi, donc en connaissance de cause. */
t('l\'ordre porte l\'hypothese du document',
  lignes.map(l => l.querySelector('.bureau-nav__nom').textContent).join(' | ')
  === 'Ma journée | Mes tâches | Le calendrier | Mon commerce | Mon cap | Mes clients | Mes cuvées | Mon registre | L\'équipe | Mes réglages',
  lignes.map(l => l.querySelector('.bureau-nav__nom').textContent).join(' | '));
t('chaque piece porte un title', lignes.every(l => l.querySelector('[title]')));
t('les huit pieces internes pointent DANS le bureau (lot 43, 29/09/2026)',
  [...B.nav.querySelectorAll('a.bureau-nav__item')]
    .map(a => a.getAttribute('href'))
    .filter(h => /^\/mon-bureau\/#/.test(h)).length === 8);
t('aucune piece de la barre ne s\'appelle plus « Mes affaires »',
  !lignes.some(l => l.dataset.piece === 'affaires'));
/* LE CALENDRIER EST UNE ADRESSE DU BUREAU depuis le 08/09/2026, et ce controle est
   a l'envers de celui qu'il remplace. Il gardait l'inverse : que la piece pointe sur
   /outils/echeances/. C'etait le defaut signale par Ted, la seule piece de la barre
   qui ejectait hors du bureau. La page publique existe toujours, elle n'est
   simplement plus la destination de cet intercalaire. */
t('le calendrier ne sort plus du bureau',
  [...B.nav.querySelectorAll('a')].every(a => a.getAttribute('href') !== '/outils/echeances/')
  && [...B.nav.querySelectorAll('a')].some(a => a.getAttribute('href') === '/mon-bureau/#calendrier'));
t('les reglages sont un bouton, pas un lien',
  B.nav.querySelector('[data-bdv-nav-panneau]').tagName === 'BUTTON');

/* ---- le repli, SUPPRIME le 07/09/2026 et REMIS le 24/09/2026 ----
   Demande de Ted, sous une seule forme : les icones seules, jamais zero. Ces
   controles gardent les trois conditions de ce retour : un vrai bouton, aucune
   piece qui disparait quand on replie, et une cle hors du prefixe `bdv_` (un
   confort d'affichage survit a la deconnexion). L'ancienne preference du
   premier repli ne doit pas revenir. */
const atelier = B.doc.getElementById('bureauAtelier');
const replier = B.doc.getElementById('bureauNavReplier');
t('la barre porte un bouton de repli, et c\'est un bouton',
  replier !== null && replier.tagName === 'BUTTON');
t('le bouton de repli n\'est pas une piece de la barre',
  replier && !replier.closest('.bureau-nav__ligne'));
t('aucune classe de repli sur l\'atelier',
  !atelier.classList.contains('bureau-atelier--replie'));
t('l\'ancienne preference de repli ne revient pas',
  B.window.localStorage.getItem('bdv_volet_replie') === null);
{
  const avant = B.nav.querySelectorAll('.bureau-nav__ligne .bureau-nav__ico').length;
  replier.click();
  t('replier pose la classe sur le corps de page et le dit',
    B.doc.body.classList.contains('bdv-rail-replie')
    && replier.getAttribute('aria-expanded') === 'false'
    && replier.textContent.includes('Déplier'));
  t('replier garde le choix sous une cle hors du prefixe bdv_',
    B.window.localStorage.getItem('bureau_rail_v1') === 'replie');
  t('replie, chaque piece garde son icone et son nom (jamais a zero)',
    B.nav.querySelectorAll('.bureau-nav__ligne .bureau-nav__ico').length === avant
    && [...B.nav.querySelectorAll('.bureau-nav__ligne .bureau-nav__nom')].every(n => n.textContent.trim()));
  replier.click();
  t('deplier retire la classe et oublie la cle',
    !B.doc.body.classList.contains('bdv-rail-replie')
    && B.window.localStorage.getItem('bureau_rail_v1') === null
    && replier.getAttribute('aria-expanded') === 'true');
}
const frappe = (c) => c.dispatchEvent(new B.window.KeyboardEvent('keydown', { key: '[', bubbles: true, cancelable: true }));
frappe(B.doc.body);
t('le crochet ouvrant ne replie plus rien',
  !atelier.classList.contains('bureau-atelier--replie'));
t('les dix languettes restent toutes visibles',
  lignes.filter(l => !l.hidden).length === 10, lignes.filter(l => !l.hidden).length);

/* ---- sans Vitisoft : regle metier, pas cosmetique ---- */
B.window.BdvNav.sansVitisoft(true);
/* « MON COMMERCE » N'EST PLUS `viti` DEPUIS LE LOT 43 (29/09/2026) : sans Vitisoft elle
   reste, avec « A gagner » seul. Ce sont donc QUATRE pieces de vente qui partent. */
t('sans Vitisoft, les quatre pieces de vente disparaissent',
  lignes.filter(l => l.hidden).map(l => l.dataset.piece).sort().join(',') === 'annee,annuaire,chercher,produits',
  lignes.filter(l => l.hidden).map(l => l.dataset.piece).sort().join(','));
t('sans Vitisoft, la journee, les taches, le calendrier, Mon commerce et les reglages RESTENT',
  ['journee', 'taches', 'calendrier', 'clients', 'reglages']
    .every(id => !lignes.find(l => l.dataset.piece === id).hidden));
B.window.BdvNav.sansVitisoft(false);
t('avec Vitisoft, tout revient', lignes.filter(l => l.hidden).length === 0);

/* ---- le tiroir ---- */
/* Supprime au lot 3. Ses deux entrees sont dans la barre depuis le lot 1, et il n'y avait
   qu'un seul outil ouvert a tous a lui rendre, deja dans la barre lui aussi. Le controle
   reste, a l'envers : c'est ce qui empechera de le reintroduire par inadvertance en
   recopiant une ancienne version du gabarit. */
t('le tiroir a bien disparu du bureau',
  B.doc.getElementById('zoneTiroir') === null && !HTML.includes('zone--tiroir'));

/* ======================= LES ECRANS DE VENTE (lot 2c) ======================= */
titre('Les ecrans de vente dans le bureau');

/* LES REPERES DE LA COQUE, liste FIGEE comme ENTITES_ATTENDUES dans charte.mjs, et pour
   la meme raison : bdv-ecrans.js ecrit dans ces id, et un id disparu ne provoque aucune
   erreur visible. La zone reste vide, et personne ne le remarque avant de chercher un
   chiffre qui manque. Une liste qui se deduirait de la coque elle-meme ne detecterait
   plus rien. Elle est passee de trente-deux a vingt-six au lot 2d : le volet, son menu de
   secours et le bouton de deconnexion sont partis, la barre du bureau les porte. Puis a
   vingt-cinq le 11/09/2026 : `p-canaux` a disparu de la coque, les canaux sont entres dans
   « Mes cuvees » et blocsCanaux() retourne son HTML au lieu de peindre chez elle. Puis a
   vingt-quatre au lot 3 : `p-evolution` a suivi, la courbe et la lecture experte vivent
   maintenant dans « Mon registre ». Et a vingt-trois au lot 4 : `p-apercu` a disparu,
   renderCap() ecrit toute la piece dans `p-diagnostic`. Et a VINGT au lot 5 :
   `p-reactivation`, `p-premier` et `p-decrochage` etaient `hidden` en dur depuis la fusion
   du 07/09, et trois fonctions y peignaient encore des tableaux complets a chaque rendu. */
const REPERES = ['app', 'bowlclip', 'busyov', 'busytxt', 'filterbar', 'modale',
  'p-annee', 'p-base', 'p-chercher', 'p-clients', 'p-diagnostic', 'p-explorer',
  'p-produits', 'p-reglages', 'p-vide', 'printReport', 'status', 'statusSpin',
  'statusTxt', 'tbFile'];
const manquants = REPERES.filter(id => !B.doc.getElementById(id));
t('la coque des ecrans porte ses ' + REPERES.length + ' reperes',
  manquants.length === 0, 'manquant(s) : ' + manquants.join(', '));

/* Le seul lien entre bdv-nav.js et bdv-ecrans.js est la liste des identifiants d'ecran,
   et rien ne le tient. Ce controle est ce mecanisme : ajouter un ecran d'un cote sans
   l'autre echoue ici, au lieu d'echouer chez le vigneron par une piece qui ne mene
   nulle part. */
const ECRANS = fs.readFileSync(path.join(RACINE, 'src/js/bdv-ecrans.js'), 'utf8');
const bloc = ECRANS.slice(ECRANS.indexOf('const NAV=['), ECRANS.indexOf('];', ECRANS.indexOf('const NAV=[')));
const idsEcrans = [...bloc.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]).sort();
/* `ventes` (lot 43) : « Mon commerce » n'est plus `viti`, mais son onglet « Clients a
   suivre » reste un ecran de bdv-ecrans.js. */
const idsBarre = B.window.BdvNav.pieces
  .filter(p => p.viti || p.ventes || p.id === 'reglages').map(p => p.id).sort();
t('les identifiants d\'ecran sont les memes dans bdv-nav.js et bdv-ecrans.js',
  idsEcrans.join(',') === idsBarre.join(','),
  'ecrans : ' + idsEcrans.join(',') + '  /  barre : ' + idsBarre.join(','));

t('le volet, son menu de secours et la deconnexion ont quitte la coque',
  ['sidebar', 'volet', 'ici', 'iciMenu', 'tbSection', 'tbSortir']
    .every(id => !B.doc.querySelector('#bureauVentes #' + id)));
t('elle est portee par le wrapper de scope',
  !!B.doc.querySelector('#bureauVentes .bdv-ventes .app'));
t('les quatre elements hors page sont remontes sous body',
  ['status', 'busyov', 'printReport', 'modale']
    .every(id => B.doc.getElementById(id).parentNode === B.doc.body),
  ['status', 'busyov', 'printReport', 'modale']
    .filter(id => B.doc.getElementById(id).parentNode !== B.doc.body).join(','));

t('a l\'ouverture, « Ma journee » est affichee, les trois autres pieces masquees',
  !B.journee.hidden && B.taches.hidden && B.calendrier.hidden && B.ventes.hidden);
t('rien n\'est charge avant le premier clic', B.charges.length === 0, B.charges.join(' '));

/* MES TACHES, ajoutee le 07/09/2026. Trois conteneurs se partagent la zone de travail :
   le controle nomme les TROIS a chaque bascule, parce que le defaut qu'on attend ici
   n'est pas « la piece ne s'affiche pas », c'est « l'ancienne reste affichee dessous ». */
B.clic('taches');
t('un clic sur « Mes taches » n\'affiche QUE les taches',
  !B.taches.hidden && B.journee.hidden && B.ventes.hidden);
t('l\'adresse des taches suit', B.window.location.hash === '#taches', B.window.location.hash);
t('la piece est branchee a l\'ouverture',
  B.appels.some(a => a.taches), JSON.stringify(B.appels));
t('et rien n\'a ete charge pour ca : le module part avec la page',
  B.charges.length === 0, B.charges.join(' '));
B.clic('journee');
t('revenir a « Ma journee » remasque les taches',
  !B.journee.hidden && B.taches.hidden);

/* « Clients a suivre » retenu comme dernier onglet (lot 43) : sans cela, la barre ouvre
   « A gagner », qui ne charge pas le moteur, et les controles du chargement qui suivent
   n'auraient rien a mesurer. Le choix de l'onglet a sa section plus bas. */
B.window.localStorage.setItem('bdv_com_onglet', 'suivre');
B.clic('clients');
t('un clic sur « Mon commerce » masque la journee, les taches, et montre les ventes',
  B.journee.hidden && B.taches.hidden && !B.ventes.hidden);
t('l\'adresse suit', B.window.location.hash === '#clients', B.window.location.hash);
t('la piece cliquee devient la piece active',
  B.doc.querySelector('.bureau-nav__ligne[data-piece="clients"] .bureau-nav__item--actif') !== null);
await B.repos();
/* L'ORDRE EST UNE CONDITION, pas une preference : bdv-ecrans.js lit des variables de
   bdv-base.js des son analyse, et le moteur doit donc etre entierement la avant lui. Ce
   controle est ce qui empechera de « paralleliser pour aller plus vite » un jour. */
/* La feuille des ecrans est passee EN TETE le 08/09/2026 : elle habille le bandeau de
   statut et le voile d'attente, les deux seules choses que le moteur dise a l'ecran, et le
   moteur peut parler sans qu'aucun ecran de vente n'ait jamais ete ouvert (un import lance
   depuis le panneau de reglages). Une feuille n'a pas d'ordre d'execution a respecter, elle
   n'apporte aucune variable : la seule condition reste que bdv-ecrans.js vienne apres le
   moteur, et ce controle la garde. */
const ATTENDU = [
  '/css/bdv-ecrans.css',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
  '/js/bdv-sync.js',
  '/js/bdv-base.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  '/js/bdv-ecrans.js',
  '/js/bdv-annuaire.js'
].join(' | ');
t('le moteur puis les ecrans, dans cet ordre',
  B.charges.join(' | ') === ATTENDU, B.charges.join(' | ') || '(aucune)');
/* On FILTRE les appels au demarrage des ecrans, au lieu de lire le tableau entier :
   depuis que Mes taches se branche aussi par la barre, `appels` porte les deux sortes
   et un controle cale sur un indice cassait des qu'une piece etait ajoutee. Il aurait
   dit « les ecrans ne demarrent pas » alors qu'ils demarraient tres bien. */
const ecransDemarres = () => B.appels.filter(a => a.ecran || a.client);
t('les ecrans sont demarres sur la bonne piece',
  JSON.stringify(ecransDemarres()) === '[{"ecran":"clients","haut":true}]', JSON.stringify(B.appels));

B.clic('produits');
await B.repos();
t('un second clic ne recharge RIEN', B.charges.length === 8, B.charges.length + ' ressources');
t('mais il navigue',
  JSON.stringify(ecransDemarres()[1]) === '{"ecran":"produits","haut":true}', JSON.stringify(ecransDemarres()));

B.clic('journee');
t('revenir a « Ma journee » remontre la journee et masque les ventes',
  !B.journee.hidden && B.ventes.hidden);
t('et vide l\'adresse', B.window.location.hash === '', B.window.location.hash);

B.clic('reglages');
t('« Mes reglages » ouvre le panneau',
  B.appels.some(a => a.panneau));
t('« Mes reglages » ne change pas d\'ecran : le panneau s\'ouvre par-dessus',
  !B.journee.hidden && B.ventes.hidden);
t('et n\'ecrit rien dans l\'adresse', B.window.location.hash === '', B.window.location.hash);

/* ======================= LE CALENDRIER (08/09/2026) =======================
   Un bureau NEUF, et pas celui des essais precedents : les controles des ecrans de
   vente comptent les ressources chargees, et deux fichiers de plus dans le tableau
   les feraient echouer pour une raison qui n'a rien a voir avec eux. */
titre('Le calendrier, piece du bureau');

const CAL = bureau();
t('a l\'ouverture, le calendrier est masque et rien n\'est charge pour lui',
  CAL.calendrier !== null && CAL.calendrier.hidden && CAL.charges.length === 0);
/* LE FILTRE EST DANS LA PAGE, VIDE, et il se remplit au premier rendu depuis la
   liste unique des familles de bdv-echeances.js. Le conteneur, lui, doit exister
   dans le gabarit : monte a la volee, il echapperait a la charte du bureau. */
t('le conteneur du filtre et l\'interrupteur du fond de carte sont dans la page',
  CAL.doc.getElementById('calFiltre') !== null && CAL.doc.getElementById('calFond') !== null);
/* NOTER UNE TACHE DEPUIS LE CALENDRIER, 08/09/2026. Un SEUL formulaire pour toute la
   piece : le « + » de chaque case ne fait que pre-remplir sa date. Le controle porte
   sur l'unicite autant que sur la presence, parce que la tentation du formulaire par
   case reviendra, et qu'elle mettrait quarante-deux champs dans le document. */
t('le calendrier porte UN formulaire de note, et un seul',
  CAL.doc.querySelectorAll('#calForm').length === 1
  && CAL.doc.getElementById('calTitre') !== null
  && CAL.doc.getElementById('calDate') !== null);
/* La date est facultative : sans elle la note part dans « Mes taches » et attend. Un
   champ `required` ici forcerait a dater ce qui n'a pas de date, ce qui est
   exactement la frontiere que Ted a posee entre les deux pieces. */
t('la date de la note reste facultative',
  !CAL.doc.getElementById('calDate').hasAttribute('required'));
/* LA DATE DE FIN, 08/09/2026 : « imagine c'est un salon sur plusieurs jours ». Elle
   est dans les DEUX formulaires, celui du calendrier et celui de Mes taches : c'est la
   meme table, et un salon note d'un cote doit pouvoir durer autant que de l'autre. */
/* LE FILTRE DE FAMILLES EST DANS LES DEUX PIECES, 08/09/2026. Le conteneur doit
   exister dans le gabarit : monte a la volee, il echapperait a la charte. */
t('« Mes taches » porte son propre conteneur de filtre',
  CAL.doc.getElementById('tachesFiltre') !== null);
t('les deux formulaires proposent une date de fin, et elle est facultative',
  CAL.doc.getElementById('calFin') !== null
  && CAL.doc.getElementById('tachesFin') !== null
  && !CAL.doc.getElementById('calFin').hasAttribute('required')
  && !CAL.doc.getElementById('tachesFin').hasAttribute('required'));

CAL.clic('calendrier');
t('un clic n\'affiche QUE le calendrier',
  !CAL.calendrier.hidden && CAL.journee.hidden && CAL.taches.hidden && CAL.ventes.hidden);
t('l\'adresse du calendrier suit',
  CAL.window.location.hash === '#calendrier', CAL.window.location.hash);
t('la piece cliquee devient la piece active',
  CAL.doc.querySelector('.bureau-nav__ligne[data-piece="calendrier"] .bureau-nav__item--actif') !== null);
await CAL.repos();
/* QUATRE FICHIERS, ET PAS SEPT. Le calendrier ne lit aucune ligne de vente : lui faire
   tirer le moteur, Chart.js et le lecteur xlsx couterait 83 ko et plus pour afficher
   une grille de trente et un jours. Ce controle est ce qui empechera qu'on l'accroche
   au chargeur des ecrans de vente « parce que c'est deja ecrit ».

   ET L'ORDRE EST UNE CONDITION, pas une preference, comme pour le moteur et les
   ecrans de vente. La piece appelle BdvAlmanach.entre() des son premier rendu pour
   poser la lune et les feries, et BdvCalchoix.choix() pour savoir ce que le vigneron
   suit. Charges apres elle : le fond de carte serait vide, et les reperes eteints
   reapparaitraient une fraction de seconde avant de disparaitre. Deux defauts que
   rien ne signalerait. */
/* L'ALMANACH A QUITTE CETTE LISTE LE 08/09/2026, et il n'a pas disparu : le gabarit
   le porte en defer, parce que la lune de l'entete doit etre la dans TOUTES les
   pieces, des la premiere seconde. Il reste declare dans RESSOURCES_CAL, ou il
   documente la dependance de la piece et la rattraperait si le gabarit changeait ;
   le chargeur le reconnait a son adresse et n'en pose pas un second. C'est ce que
   ce controle observe : le comportement reel, trois ressources, pas la liste ecrite.
   Les deux controles qui suivent tiennent la place que celui-ci a laissee : l'ordre
   reste une condition, il est juste garanti ailleurs. */
t('le calendrier charge sa feuille, les choix, puis son module, et RIEN d\'autre',
  CAL.charges.join(' | ') === '/css/bdv-calendrier.css | /js/bdv-calchoix.js | /js/bdv-calendrier.js',
  CAL.charges.join(' | ') || '(aucune)');
t('l\'almanach n\'est pas charge deux fois',
  CAL.charges.filter(x => x === '/js/bdv-almanach.js').length === 0,
  CAL.charges.join(' | '));
t('la piece est ouverte apres le chargement',
  CAL.appels.some(a => a.calendrier), JSON.stringify(CAL.appels));

CAL.clic('journee');
t('revenir a « Ma journee » remasque le calendrier',
  !CAL.journee.hidden && CAL.calendrier.hidden);
CAL.clic('calendrier');
await CAL.repos();
t('un second passage ne recharge rien', CAL.charges.length === 3, CAL.charges.length + ' ressources');

/* L'ADRESSE FAIT FOI A L'ARRIVEE, et pas seulement pour les pieces de vente. Ce
   filtre exigeait `viti` jusqu'au 08/09/2026 : un favori sur /mon-bureau/#taches
   ouvrait « Ma journee », sans erreur et sans que personne ne comprenne pourquoi.
   Les deux pieces sans Vitisoft sont donc controlees ici. */
const FAV1 = bureau('#calendrier');
await FAV1.repos();
t('un favori sur #calendrier ouvre le calendrier',
  !FAV1.calendrier.hidden && FAV1.journee.hidden);
const FAV2 = bureau('#taches');
t('un favori sur #taches ouvre les taches',
  !FAV2.taches.hidden && FAV2.journee.hidden);
/* L'ancien nom de la piece reste une adresse valable : une adresse se met en favori,
   c'est tout l'interet d'en avoir une, et un favori qui tombe a cote n'affiche rien. */
const FAV3 = bureau('#echeances');
await FAV3.repos();
t('l\'ancien #echeances mene encore au calendrier',
  !FAV3.calendrier.hidden && FAV3.journee.hidden);

/* ======================= LE MOTEUR A LA DEMANDE ======================= */
titre('Le moteur de la base, charge au besoin');

const M = bureau();
t('a l\'ouverture du bureau, le moteur n\'est PAS charge',
  M.charges.length === 0, M.charges.join(' | '));

M.clic('reglages');
await M.repos();
/* « Et lui seul » veut dire : le moteur, sa feuille de statut, et RIEN des ecrans de vente.
   Ni Chart.js, ni le lecteur xlsx, ni les 2 500 lignes de bdv-ecrans.js. */
t('ouvrir les reglages charge le moteur, et lui seul',
  M.charges.join(' | ') === ['/css/bdv-ecrans.css',
    'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
    '/js/bdv-sync.js', '/js/bdv-base.js'].join(' | '), M.charges.join(' | '));
t('le panneau s\'ouvre AVANT le moteur : il ne fait pas attendre pour « Toi »',
  M.appels[0] && M.appels[0].panneau === true, JSON.stringify(M.appels[0]));
t('puis il se rafraichit quand le moteur est la',
  M.appels.some(a => a.rafraichi), JSON.stringify(M.appels));

/* LES TROIS BOUTONS DES REGLAGES passent par le meme point d'entree. C'est ce controle-ci
   qui a trouve la panne : le bouton de la barre ouvrait le panneau sans demander le
   moteur, et « Ma base » restait vide sans une erreur pour le dire. */
const R1 = bureau();
R1.doc.getElementById('bureauNavPlier');
R1.clic('reglages');
await R1.repos();
const R2 = bureau('#base');
await R2.repos();
t('le bouton de la barre et l\'adresse #base demandent tous deux le moteur',
  R1.charges.length === 4 && R2.charges.length === 4,
  'barre : ' + R1.charges.length + ', adresse : ' + R2.charges.length);
t('et tous deux rafraichissent le panneau une fois le moteur la',
  R1.appels.some(a => a.rafraichi) && R2.appels.some(a => a.rafraichi));

M.window.localStorage.setItem('bdv_com_onglet', 'suivre');
M.clic('clients');
await M.repos();
t('ouvrir ensuite un ecran de vente ne recharge pas le moteur',
  M.charges.filter(c => c === '/js/bdv-base.js').length === 1,
  M.charges.filter(c => c === '/js/bdv-base.js').length + ' fois');
t('et il charge bien les ecrans par-dessus',
  M.charges.length === 8, M.charges.length + ' ressources');

/* CE CONTROLE A CHANGE DE SENS LE 11/09/2026, lot 4, et c'est le but du lot.

   Il verifiait qu'un domaine en exercice decale lisait « Mon exercice » et pas « Mon
   annee », des le premier affichage. Pour cela, cette barre relisait `bdv_exercice_v1` de
   son cote, une cle dupliquee que son propre commentaire declarait dangereuse.

   La piece s'appelle « Mon cap ». Le nom tient sur les deux exercices, donc la barre n'a
   plus a savoir quel mois ouvre l'annee du domaine. Ce qu'on verifie maintenant, c'est
   exactement l'inverse : que le libelle NE BOUGE PAS quand la cle change. Si quelqu'un
   reintroduit un libelle variable ici, il devra reintroduire la lecture de la cle, et ce
   controle echouera. */
const nomCap = (ex) => {
  const D = new JSDOM(HTML, { runScripts: 'outside-only', pretendToBeVisual: true,
    url: 'https://x.test/mon-bureau/' });
  D.window.localStorage.setItem('bdv_exercice_v1', ex);
  D.window.eval(NAV);
  D.window.BdvNav.monter(D.window.document.getElementById('bureauNav'), 'journee');
  return D.window.document
    .querySelector('.bureau-nav__ligne[data-piece="annee"] .bureau-nav__nom').textContent;
};
t('la piece s\'appelle « Mon cap » en annee civile', nomCap('1') === 'Mon cap', nomCap('1'));
t('et « Mon cap » aussi sur un exercice ouvrant en avril, la cle n\'est plus lue ici',
  nomCap('4') === 'Mon cap', nomCap('4'));
t('la barre ne lit plus la cle d\'exercice',
  !NAV.includes('bdv_exercice_v1'),
  'bdv_exercice_v1 est encore cite dans bdv-nav.js');

/* ---- l'adresse d'arrivee fait foi ---- */
titre('L\'adresse d\'arrivee');
const C = bureau('#clients');
t('un favori sur #clients ouvre les clients, pas la journee',
  C.journee.hidden && !C.ventes.hidden);
await C.repos(() => C.appels.length > 0);
/* L'adresse est lue par suivreAdresse() : c'est le chemin de l'historique (Retour, Suivant,
   arrivee sur un favori), donc `haut` vaut 'historique' (remontee apres la restauration). */
t('et demarre les ecrans dessus, en remontant apres la restauration du navigateur',
  JSON.stringify(C.appels) === '[{"ecran":"clients","haut":"historique"}]', JSON.stringify(C.appels));
{
  /* Retour / Suivant : popstate vers une autre piece de vente, depuis une piece defilee. */
  const H2 = bureau('#annee');
  await H2.repos(() => H2.appels.some(a => a.ecran === 'annee'));
  H2.window.history.pushState(null, '', '#produits');
  H2.window.dispatchEvent(new H2.window.PopStateEvent('popstate'));
  await H2.repos(() => H2.appels.some(a => a.ecran === 'produits'));
  const dp = H2.appels.filter(a => a.ecran === 'produits').pop();
  t('Retour / Suivant (popstate) : afficher() demande haut:\'historique\'', !!dp && dp.haut === 'historique', JSON.stringify(dp));
}

const D = bureau('#client=DOMAINE%20X');
await D.repos();
t('#client=... ouvre la fiche du client, pas seulement la liste',
  JSON.stringify(D.appels) === '[{"client":"DOMAINE X"}]', JSON.stringify(D.appels));

await new Promise(r => setTimeout(r, 60));
const E = bureau('#base');
t('#base ouvre le panneau et laisse la journee affichee',
  E.appels.some(a => a.panneau) && !E.journee.hidden);

const F = bureau('#nimportequoi');
t('une adresse inconnue retombe sur « Ma journee » sans rien charger',
  !F.journee.hidden && F.ventes.hidden && F.charges.length === 0);

/* ---- les liens du bureau ---- */
titre('Les liens du bureau');
const G = bureau();
const faux = G.doc.createElement('a');
faux.href = '/mon-bureau/#annee';
faux.textContent = 'vers mon exercice';
G.doc.getElementById('bureauJournee').appendChild(faux);
faux.dispatchEvent(new G.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
t('un lien du bureau vers une piece est intercepte, sans rechargement',
  G.journee.hidden && !G.ventes.hidden && G.window.location.hash === '#annee',
  G.window.location.hash);

const H = bureau();
const fiche = H.doc.createElement('a');
fiche.href = '/mon-bureau/#client=JAYAMA';
H.doc.getElementById('bureauJournee').appendChild(fiche);
fiche.dispatchEvent(new H.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
await H.repos(() => H.appels.length > 0);
t('un lien de fiche client ouvre la fiche',
  JSON.stringify(H.appels) === '[{"client":"JAYAMA"}]', JSON.stringify(H.appels));

/* `#fiche=` (24/09/2026) ouvre la fiche LA OU L'ON EST, par le seul ouvreur du bureau,
   et ne change pas de piece. Et un lien `target="_blank"` (« Agrandir ») garde son onglet. */
const H2 = bureau();
H2.window.__ouvert = [];
H2.window.bdvOuvrirFiche = (id) => H2.window.__ouvert.push(id);
const fiche2 = H2.doc.createElement('a');
fiche2.href = '/mon-bureau/#fiche=JAYAMA';
H2.doc.getElementById('bureauJournee').appendChild(fiche2);
fiche2.dispatchEvent(new H2.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
t('un lien #fiche= ouvre la fiche sur place, sans changer de piece',
  H2.window.__ouvert.join() === 'JAYAMA' && !H2.journee.hidden && H2.ventes.hidden, H2.window.__ouvert.join());
const agrandir = H2.doc.createElement('a');
agrandir.href = '/mon-bureau/#fiche=JAYAMA'; agrandir.target = '_blank';
H2.doc.getElementById('bureauJournee').appendChild(agrandir);
const ev = new H2.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
agrandir.dispatchEvent(ev);
t('un lien qui demande un autre onglet n\'est pas rabattu dans celui-ci',
  H2.window.__ouvert.length === 1 && !ev.defaultPrevented);

const I = bureau();
const nouvelOnglet = I.doc.createElement('a');
nouvelOnglet.href = '/mon-bureau/#annee';
I.doc.getElementById('bureauJournee').appendChild(nouvelOnglet);
nouvelOnglet.dispatchEvent(new I.window.MouseEvent('click',
  { bubbles: true, cancelable: true, button: 0, metaKey: true }));
t('cmd-clic est laisse au navigateur : c\'est une demande d\'autre onglet',
  !I.journee.hidden && I.ventes.hidden);

/* ---- le bouton Retour ---- */
titre('Le bouton Retour');
const J = bureau();
J.window.localStorage.setItem('bdv_com_onglet', 'suivre');
J.clic('clients');
await J.repos();
J.window.history.back();
await new Promise(r => setTimeout(r, 30));
t('Retour depuis un ecran de vente ramene a « Ma journee » sans quitter le bureau',
  !J.journee.hidden && J.ventes.hidden,
  'hash : ' + J.window.location.hash);

/* ======================= MON COMMERCE EN DEUX ONGLETS (lot 43, 29/09/2026) =======================
   Decision de Ted : « Mes affaires » et « Mon commerce » font une piece. Ce que ces
   controles gardent : les deux onglets et leur ordre, le chargement a la demande de
   chacun (« A gagner » ne tire PAS le moteur), les adresses (#affaires, #clients,
   #client=), le dernier onglet repris par la barre, et la piece sans Vitisoft, qui
   reste avec « A gagner » seul. */
titre('Mon commerce, deux onglets (lot 43)');
{
  const K = bureau();
  K.window.BdvAffaires = { ouvrir: () => { K.appels.push({ affaires: true }); } };
  const barre = K.doc.getElementById('bureauComOnglets');
  const tabs = barre ? [...barre.querySelectorAll('[role="tab"]')] : [];
  const noms = tabs.map(x => x.textContent.trim()).join(' | ');
  const aff = K.doc.getElementById('bureauAffaires');
  t('la barre d\'onglets est dans la page, en tablist, « A gagner » puis « Clients a suivre »',
    !!barre && barre.getAttribute('role') === 'tablist' && noms === 'À gagner | Clients à suivre', noms);
  t('chaque onglet designe son panneau, et ce panneau existe',
    tabs.length === 2 && tabs[0].getAttribute('aria-controls') === 'bureauAffaires'
    && tabs[1].getAttribute('aria-controls') === 'p-clients'
    && tabs.every(x => K.doc.getElementById(x.getAttribute('aria-controls'))));
  t('hors de la piece, la barre d\'onglets est cachee', !!barre && barre.hidden);
  K.clic('clients');
  await K.repos(() => K.appels.some(a => a.affaires));
  t('sans onglet retenu, la barre des pieces ouvre « A gagner »',
    !aff.hidden && K.ventes.hidden && !barre.hidden
    && tabs[0].getAttribute('aria-selected') === 'true' && tabs[1].getAttribute('aria-selected') === 'false',
    K.window.location.hash);
  t('l\'adresse dit #affaires et la barre surligne « Mon commerce »',
    K.window.location.hash === '#affaires'
    && K.doc.querySelector('.bureau-nav__ligne[data-piece="clients"] .bureau-nav__item--actif') !== null,
    K.window.location.hash);
  t('« A gagner » charge bdv-affaires.js, et PAS le moteur des ventes',
    K.charges.join(' | ') === '/js/bdv-affaires.js', K.charges.join(' | '));
  t('la piece des affaires est ouverte', K.appels.some(a => a.affaires));
  t('le panneau affiche porte le role tabpanel et le nom de son onglet',
    aff.getAttribute('role') === 'tabpanel' && aff.getAttribute('aria-labelledby') === 'comOngletGagner');
  tabs[1].click();
  await K.repos(() => K.appels.some(a => a.ecran === 'clients'));
  t('« Clients a suivre » montre les ventes et demarre l\'ecran clients',
    aff.hidden && !K.ventes.hidden && !barre.hidden && tabs[1].getAttribute('aria-selected') === 'true'
    && K.appels.some(a => a.ecran === 'clients'), JSON.stringify(K.appels));
  t('et c\'est lui qui charge le moteur, au premier affichage',
    K.charges.includes('/js/bdv-base.js') && K.charges.includes('/js/bdv-ecrans.js'), K.charges.join(' | '));
  t('l\'adresse dit #clients', K.window.location.hash === '#clients', K.window.location.hash);
  t('le dernier onglet est retenu sous bdv_com_onglet',
    K.window.localStorage.getItem('bdv_com_onglet') === 'suivre');
  K.clic('journee');
  t('quitter la piece cache la barre d\'onglets', barre.hidden);
  K.clic('clients');
  await K.repos();
  t('revenir par la barre des pieces rouvre le dernier onglet ouvert',
    !K.ventes.hidden && aff.hidden && K.window.location.hash === '#clients', K.window.location.hash);
  tabs[1].focus();
  tabs[1].dispatchEvent(new K.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  t('fleche gauche : « A gagner », avec le focus et la tabulation',
    !aff.hidden && K.ventes.hidden && K.doc.activeElement === tabs[0]
    && tabs[0].tabIndex === 0 && tabs[1].tabIndex === -1);
  tabs[0].dispatchEvent(new K.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  t('fleche droite : retour a « Clients a suivre »',
    aff.hidden && !K.ventes.hidden && K.doc.activeElement === tabs[1]);
  K.clic('annee');
  await K.repos();
  t('un autre ecran de vente retire la barre d\'onglets', barre.hidden && !K.ventes.hidden);
}
{
  const onglet = (X) => (X.doc.querySelector('#bureauComOnglets [aria-selected="true"]') || {}).id;
  const surCommerce = (X) => X.doc.querySelector('.bureau-nav__ligne[data-piece="clients"] .bureau-nav__item--actif') !== null;
  const A1 = bureau('#affaires');
  await A1.repos();
  t('un favori sur #affaires ouvre « A gagner », la barre sur « Mon commerce »',
    !A1.doc.getElementById('bureauAffaires').hidden && A1.ventes.hidden
    && onglet(A1) === 'comOngletGagner' && surCommerce(A1)
    && !A1.charges.includes('/js/bdv-base.js'), A1.charges.join(' | '));
  const A2 = bureau('#clients');
  await A2.repos();
  t('un favori sur #clients ouvre « Clients a suivre »',
    A2.doc.getElementById('bureauAffaires').hidden && !A2.ventes.hidden
    && onglet(A2) === 'comOngletSuivre' && surCommerce(A2));
  const A3 = bureau('#client=JAYAMA');
  await A3.repos();
  t('#client= ouvre la fiche dans « Clients a suivre »',
    onglet(A3) === 'comOngletSuivre' && JSON.stringify(A3.appels) === '[{"client":"JAYAMA"}]',
    JSON.stringify(A3.appels));
  /* Un lien #affaires (la punaise de Ma journee, la fiche client) et un renvoi par son
     nom (BdvAffairesJour.ouvrirPiece, « Nouvelle affaire ») menent a « A gagner »,
     MEME quand le dernier onglet retenu est l'autre : ils nomment ce qu'ils veulent. */
  const A4 = bureau();
  A4.window.localStorage.setItem('bdv_com_onglet', 'suivre');
  const lien = A4.doc.createElement('a');
  lien.href = '/mon-bureau/#affaires';
  A4.doc.getElementById('bureauJournee').appendChild(lien);
  lien.dispatchEvent(new A4.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await A4.repos();
  t('un lien #affaires du bureau mene a « A gagner », sans rechargement',
    !A4.doc.getElementById('bureauAffaires').hidden && onglet(A4) === 'comOngletGagner'
    && surCommerce(A4) && A4.window.location.hash === '#affaires', A4.window.location.hash);
  const A5 = bureau();
  A5.window.localStorage.setItem('bdv_com_onglet', 'suivre');
  A5.window.BdvNav.afficher('affaires');
  await A5.repos();
  t('BdvNav.afficher(\'affaires\') (renvois, fiche client) mene a « A gagner »',
    !A5.doc.getElementById('bureauAffaires').hidden && onglet(A5) === 'comOngletGagner' && surCommerce(A5));
}
{
  const S1 = bureau();
  S1.window.localStorage.setItem('bdv_com_onglet', 'suivre');
  S1.window.BdvNav.sansVitisoft(true);
  S1.clic('clients');
  await S1.repos();
  const b1 = S1.doc.getElementById('bureauComOnglets');
  t('sans Vitisoft, « Mon commerce » s\'ouvre sur « A gagner » seul, sans barre d\'onglets',
    !S1.doc.getElementById('bureauAffaires').hidden && S1.ventes.hidden && b1.hidden
    && !S1.charges.includes('/js/bdv-base.js'), S1.charges.join(' | '));
  t('et le panneau n\'annonce pas un role d\'onglet orphelin',
    !S1.doc.getElementById('bureauAffaires').hasAttribute('role'));
  const S2 = bureau('#clients');
  await S2.repos();
  S2.window.BdvNav.sansVitisoft(true);
  t('un favori sur #clients retombe sur « A gagner » quand le profil dit « sans Vitisoft »',
    !S2.doc.getElementById('bureauAffaires').hidden && S2.ventes.hidden
    && S2.doc.getElementById('bureauComOnglets').hidden && S2.window.location.hash === '#affaires',
    S2.window.location.hash);
  S2.window.BdvNav.sansVitisoft(false);
  t('Vitisoft revenu, la barre d\'onglets revient', !S2.doc.getElementById('bureauComOnglets').hidden);
}
{
  const Q = bureau();
  Q.window.Storage.prototype.getItem = function () { throw new Error('refuse'); };
  Q.window.Storage.prototype.setItem = function () { throw new Error('refuse'); };
  let casse = null;
  try { Q.clic('clients'); } catch (e) { casse = e; }
  await Q.repos();
  t('stockage refuse : pas d\'erreur, « A gagner » s\'ouvre',
    casse === null && !Q.doc.getElementById('bureauAffaires').hidden, String(casse));
}

{
  /* LA COURSE DU MOTEUR (verificateur du lot 43, 29/09/2026). « Clients a suivre »
     demande le moteur, le vigneron revient sur « A gagner » avant qu'il arrive, puis
     le moteur finit et appelle navTo('clients'). On rejoue le VRAI navTo() de
     bdv-ecrans.js, extrait du fichier, avec des doubles pour ce qu'il lit autour. */
  const debut = ECRANS.indexOf('function navTo(id, opts){');
  const srcNavTo = ECRANS.slice(debut, ECRANS.indexOf('\n}\n', debut) + 2);
  const C = bureau();
  C.window.BdvAffaires = { ouvrir: () => {} };
  C.window.eval('var ECRAN_COURANT=null, PEINTRES={}, ECRANS_PEINTS=new Set();'
    + 'function el(i){return document.getElementById(i)||{style:{},classList:{contains:function(){return false;}}};}'
    + 'function majBoutonMaj(){} function majPeriodeTete(){} function ouvrirPiedCap(){} window.scrollTo=function(){ window.__defile=(window.__defile||0)+1; };'
    + srcNavTo + ';window.navTo=navTo;');
  C.window.BdvNav.afficher('clients', { onglet: 'suivre' });
  await C.repos();
  C.window.BdvNav.afficher('affaires');
  await C.repos();
  C.window.__defile = 0;
  C.window.navTo('clients');
  const sel = (C.doc.querySelector('#bureauComOnglets [aria-selected="true"]') || {}).id;
  t('le moteur qui finit apres le retour sur « A gagner » ne reecrit pas #clients dans l\'adresse',
    C.window.location.hash === '#affaires', C.window.location.hash);
  t('et « A gagner » reste affiche, son onglet choisi, la page non remontee',
    !C.doc.getElementById('bureauAffaires').hidden && C.ventes.hidden && sel === 'comOngletGagner'
    && C.window.__defile === 0, sel + ' / defile ' + C.window.__defile);
  /* Le bouton « Mettre a jour » suit l'ONGLET, pas l'id de la piece : sur « A gagner »
     il n'a rien a completer (capture du verificateur, bouton allume chez un vigneron
     sans Vitisoft). */
  const vus = [];
  C.window.bdvMajBoutonMaj = (e) => vus.push(e);
  C.window.BdvNav.afficher('clients', { onglet: 'suivre' });
  await C.repos();
  C.window.BdvNav.afficher('affaires');
  await C.repos();
  t('« Mettre a jour » n\'est pas demande pour l\'ecran clients sur « A gagner »',
    vus.length >= 2 && vus[0] === 'clients' && vus[vus.length - 1] !== 'clients', vus.join(','));
  C.window.BdvNav.afficher('clients', { onglet: 'suivre' });
  await C.repos();
  C.window.navTo('annee');
  t('coque des ventes a l\'ecran, navTo() ecrit toujours son adresse',
    C.window.location.hash === '#annee', C.window.location.hash);
}

/* ======================= LE BILAN COMMUN (lot 45, 29/09/2026) =======================
   Trois boutons au-dessus des deux onglets de « Mon commerce », peints par
   bdv-affaires-jour.js, montres par poserOnglets(). Visible sur les deux onglets,
   cache ailleurs ; sans Vitisoft pas de case clients ; affaires pas lues, aucune case
   d'affaire et aucun « 0 ». Et le calcul des trois cases a 390 px, sur la feuille. */
titre('Le bilan commun de Mon commerce (lot 45)');
{
  const AJSRC = fs.readFileSync(path.join(RACINE, 'src/js/bdv-affaires-jour.js'), 'utf8');
  const monte = (hash) => {
    const X = bureau(hash);
    X.window.BdvAffaires = { ouvrir: () => { X.appels.push({ affaires: true }); } };
    X.window.eval(AJSRC);
    return X;
  };
  /* WCAG 2.5.3 : pour chaque case, le texte VISIBLE (au telephone : chiffre et mot court ;
     a l'ordinateur : chiffre et mot, puis la sous-ligne), espaces normalises et sans
     casse, est contenu dans le nom accessible ; celui du telephone en tete. Le « : » de
     `hors-ecran` ne se voit pas : il n'est pas du texte visible. */
  const norm = (x) => String(x || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const vuDe = (k, cls) => { const x = k.querySelector(cls); if (!x) return ''; const c = x.cloneNode(true);
    c.querySelectorAll('.hors-ecran').forEach(h => h.remove()); return c.textContent; };
  const contientVu = (b) => [...b.querySelectorAll('[data-bilan]')].every(k => {
    const nom = norm(k.getAttribute('aria-label')), n = vuDe(k, '.aff-bilan__n');
    const tel = norm(n + ' ' + vuDe(k, '.aff-bilan__c')), ordi = norm(n + ' ' + vuDe(k, '.aff-bilan__l')), sous = norm(vuDe(k, '.aff-bilan__s'));
    return !!nom && nom.indexOf(tel) === 0 && nom.includes(ordi) && nom.includes(sous);
  });
  const cases = (b) => [...b.querySelectorAll('[data-bilan]')].map(x => x.getAttribute('data-bilan')).join(',');
  const K = monte();
  const bil = K.doc.getElementById('bureauComBilan');
  const barre = K.doc.getElementById('bureauComOnglets');
  t('#bureauComBilan est dans la page, juste au-dessus de la barre d\'onglets',
    !!bil && bil.nextElementSibling === barre);
  t('il est hors des deux panneaux et de toute zone (aucun @container affaires ne l\'atteint)',
    !!bil && !bil.closest('.zone--affaires') && !bil.closest('#bureauAffaires') && !bil.closest('#bureauVentes'));
  t('hors de la piece, il est cache', !!bil && bil.hidden);
  K.clic('clients');
  await K.repos(() => K.appels.some(a => a.affaires));
  t('« A gagner », affaires pas lues : visible, la seule case clients, et aucun chiffre',
    !bil.hidden && cases(bil) === 'clients' && !/\d/.test(bil.textContent)
    && /Clients à suivre :\s*comptés à l’ouverture de l’onglet/.test((bil.querySelector('.aff-bilan__l') || {}).textContent + ' ' + (bil.querySelector('.aff-bilan__s') || {}).textContent)
    && bil.querySelector('[data-bilan="clients"]').getAttribute('aria-label') === 'à suivre : Clients à suivre : comptés à l’ouverture de l’onglet'
    && contientVu(bil)
    && (bil.querySelector('.aff-bilan__c') || {}).textContent === 'à suivre',
    cases(bil) + ' / ' + bil.textContent);
  K.window.BdvAffairesJour.poser([{ affaire_id: 'a1', issue: 'en_cours', rappel: '2020-01-01', piste_id: 'p1' },
    { affaire_id: 'a2', issue: 'en_cours', rappel: null, piste_id: 'p2' }], { p1: { nom: 'A' }, p2: { nom: 'B' } }, []);
  t('affaires lues : trois cases, dans l\'ordre, chacune un bouton',
    cases(bil) === 'affaires,relancer,clients' && [...bil.children].every(x => x.tagName === 'BUTTON'), cases(bil));
  const nomDe = (q) => (bil.querySelector('[data-bilan="' + q + '"]') || { getAttribute: () => '' }).getAttribute('aria-label');
  const courtDe = (q) => ((bil.querySelector('[data-bilan="' + q + '"] .aff-bilan__c') || {}).textContent || '');
  t('le nom accessible garde la phrase entiere, le mot court est pour le telephone',
    nomDe('affaires') === '2 en cours : 2 affaires en cours' && nomDe('relancer') === '1 à relancer : 1 affaire à relancer, rappel passé ou affaire endormie'
    && contientVu(bil)
    && courtDe('affaires') === 'en cours' && courtDe('relancer') === 'à relancer', nomDe('affaires') + ' | ' + nomDe('relancer'));
  t('« Affaires en cours » et « A relancer » disent leur nombre, sans montant',
    /2\s*affaires en cours/.test(bil.textContent) && /1\s*à relancer/.test(bil.textContent) && !/€/.test(bil.textContent),
    bil.textContent);
  const tabs = [...barre.querySelectorAll('[role="tab"]')];
  tabs[1].click();
  await K.repos(() => K.appels.some(a => a.ecran === 'clients'));
  t('visible aussi sur « Clients a suivre »', !K.ventes.hidden && !bil.hidden);
  K.window.bdvClientsASuivre = () => 5;
  K.window.bdvClientsASuivre.partiel = () => true;
  K.doc.dispatchEvent(new K.window.CustomEvent('bdv:clients'));
  t('bdv:clients le repeint : le nombre de « Tous », et la sous-ligne sans lignes',
    /5\s*clients à suivre/.test(bil.textContent) && /sans les premiers achats pour l’instant/.test(bil.textContent)
    && nomDe('clients') === '5 à suivre : 5 clients à suivre, sans les premiers achats pour l’instant' && courtDe('clients') === 'à suivre' && contientVu(bil), bil.textContent);
  /* Zero PARCE QUE tous sont en affaire : une phrase, pas de chiffre. Un vrai zero garde le
     sien, au singulier et en bas de casse apres le chiffre (verificateur, 29/09/2026). */
  const caseC = () => { const k = bil.querySelector('[data-bilan="clients"]'); return k ? [...k.children].filter(x => !x.classList.contains('aff-bilan__c')).map(x => x.textContent).join(' ') : ''; };
  K.window.bdvClientsASuivre = () => 0;
  K.window.bdvClientsASuivre.partiel = () => false;
  K.window.bdvClientsASuivre.tousEnAffaire = () => true;
  K.doc.dispatchEvent(new K.window.CustomEvent('bdv:clients'));
  t('tous les clients a suivre en affaire : « Tous tes clients à suivre sont dans une affaire », sans chiffre',
    caseC().trim() === 'Tous tes clients à suivre sont dans une affaire' && courtDe('clients') === 'tous en affaire'
    && nomDe('clients') === 'tous en affaire : Tous tes clients à suivre sont dans une affaire' && contientVu(bil) && !/\d/.test(bil.querySelector('[data-bilan="clients"]').textContent), caseC());
  K.window.bdvClientsASuivre.tousEnAffaire = () => false;
  K.doc.dispatchEvent(new K.window.CustomEvent('bdv:clients'));
  t('un vrai zero, sans affaire : « 0 client à suivre »', /^0\s+client à suivre$/.test(caseC().trim()) && nomDe('clients') === '0 à suivre : 0 client à suivre' && contientVu(bil), caseC());
  K.window.bdvClientsASuivre = () => 5;
  K.window.bdvClientsASuivre.partiel = () => true;
  K.doc.dispatchEvent(new K.window.CustomEvent('bdv:clients'));
  const rel = bil.querySelector('[data-bilan="relancer"]');
  rel.focus();
  K.window.BdvAffairesJour.poser([{ affaire_id: 'a1', issue: 'en_cours', rappel: '2020-01-01', piste_id: 'p1' }], {}, []);
  t('repeint sous le doigt, le focus reste sur la meme case',
    K.doc.activeElement && K.doc.activeElement.getAttribute('data-bilan') === 'relancer' && /1\s*affaire en cours/.test(bil.textContent),
    bil.textContent);
  K.clic('journee');
  t('quitter la piece le cache', bil.hidden);
  K.clic('annee');
  await K.repos();
  t('un autre ecran de vente le cache aussi', bil.hidden && !K.ventes.hidden);
  let tous = 0;
  K.window.bdvMotifTous = () => { tous++; };
  K.clic('journee');
  K.window.BdvNav.afficher('affaires');
  await K.repos();
  bil.querySelector('[data-bilan="clients"]').click();
  await K.repos();
  t('la case clients ouvre « Clients a suivre », filtre « Tous »',
    tous === 1 && !K.ventes.hidden && (K.doc.querySelector('#bureauComOnglets [aria-selected="true"]') || {}).id === 'comOngletSuivre');
  bil.querySelector('[data-bilan="relancer"]').click();
  await K.repos();
  let dem = null;
  try { dem = JSON.parse(K.window.sessionStorage.getItem('bdv_affaire_vue')); } catch (e) {}
  t('la case « A relancer » ouvre « A gagner » et demande Toutes, la Liste, le focus',
    !K.doc.getElementById('bureauAffaires').hidden && dem && dem.filtre === '' && dem.vue === 'liste' && dem.focus === 'relancer'
    && K.window.localStorage.getItem('bdv_aff_vue') === null, JSON.stringify(dem));
}
{
  const AJSRC = fs.readFileSync(path.join(RACINE, 'src/js/bdv-affaires-jour.js'), 'utf8');
  const S = bureau();
  S.window.BdvAffaires = { ouvrir: () => {} };
  S.window.eval(AJSRC);
  const bil = S.doc.getElementById('bureauComBilan');
  S.window.BdvNav.sansVitisoft(true);
  S.clic('clients');
  await S.repos();
  t('sans Vitisoft, affaires pas lues : pas de bilan', bil.hidden);
  S.window.BdvAffairesJour.poser([{ affaire_id: 'a1', issue: 'en_cours', piste_id: 'p1' }], {}, []);
  const c = [...bil.querySelectorAll('[data-bilan]')].map(x => x.getAttribute('data-bilan')).join(',');
  t('sans Vitisoft, avec une affaire : les cases d\'affaire, pas de case clients', !bil.hidden && c === 'affaires,relancer', c);
  S.window.BdvAffairesJour.poser([], {}, []);
  t('sans Vitisoft et sans affaire en cours : pas de bilan', bil.hidden);
}
{
  /* LE CALCUL A 390 px, SUR LA FEUILLE ET LES JETONS. */
  const csstree = await import('css-tree');
  const css = fs.readFileSync(path.join(RACINE, 'src/css/bdv-bureau.css'), 'utf8');
  const jetons = fs.readFileSync(path.join(RACINE, 'tokens.css'), 'utf8');
  const px = (nom) => { const m = jetons.match(new RegExp('--' + nom + ':\\s*([\\d.]+)(px|em)')); return m ? +m[1] : NaN; };
  const regles = [];
  (function marcher(n, ctx) {
    (n.children ? n.children.toArray() : []).forEach(ch => {
      if (ch.type === 'Rule') {
        const decl = {};
        ch.block.children.forEach(d => { if (d.type === 'Declaration') decl[d.property] = csstree.generate(d.value).trim(); });
        regles.push({ sel: csstree.generate(ch.prelude), ctx, decl });
      } else if (ch.type === 'Atrule' && ch.block) marcher(ch.block, ctx.concat('@' + ch.name + ' ' + (ch.prelude ? csstree.generate(ch.prelude) : '')));
    });
  })(csstree.parse(css), []);
  const top = (sel) => regles.filter(r => r.sel === sel && !r.ctx.length).pop() || { decl: {} };
  const kase = top('.bdv-coque .aff-bilan__case').decl, rang = top('.bdv-coque .aff-bilan').decl;
  const trav = regles.filter(r => r.sel === '.bdv-coque .bureau-atelier__travail' && r.ctx.join() === '@media (max-width:700px)').pop();
  const pad = trav ? px(((trav.decl.padding || '').match(/--([\w-]+)\)\s+var\(--([\w-]+)/) || [])[2]) : NaN;
  const base = (((kase.flex || '').match(/([\d.]+)rem$/) || [])[1] || NaN) * 16;
  const gap = px(((rang.gap || '').match(/--([\w-]+)/) || [])[1]);
  const dispo = 390 - 2 * pad, besoin = 3 * base + 2 * gap;
  t('a 390 px, les trois cases tiennent sur une rangee (' + besoin + ' px pour ' + dispo + ')',
    rang['flex-wrap'] === 'wrap' && besoin <= dispo, 'flex ' + kase.flex + ', gap ' + rang.gap + ', marge ' + pad);
  t('aucune regle @container ne redessine le bilan, et une seule @media : sous 700 px',
    regles.filter(r => /aff-bilan/.test(r.sel) && r.ctx.length && r.ctx.join() !== '@media (max-width:700px)').length === 0,
    regles.filter(r => /aff-bilan/.test(r.sel) && r.ctx.length).map(r => r.ctx.join() + ' ' + r.sel).join(' ; '));
  /* Le mot le plus long ne doit pas forcer une case au-dela de sa base : capitales a
     0,75 em plus l'espacement, bas de casse a 0,6 em (estimations larges), marges et
     bordure comprises. Les mots sont ceux que le module ecrit. */
  const f1 = px('bdv-f-1'), ls = px('bdv-ls-etiq') * f1, marge = 2 * px('bdv-e-3') + 2;
  const AJ = fs.readFileSync(path.join(RACINE, 'src/js/bdv-affaires-jour.js'), 'utf8');
  const lib = ['affaires en cours', 'à relancer', 'clients à suivre', 'Tous tes clients à suivre sont dans une affaire'];
  const sous = ['rappel passé ou affaire endormie', 'comptés à l’ouverture de l’onglet', 'sans les premiers achats pour l’instant'];
  const larg = (mots, cap) => Math.max(...mots.join(' ').split(/\s+/).map(m => m.length * (cap ? 0.75 * f1 + ls : 0.6 * f1))) + marge;
  t('les libelles et sous-lignes sont bien ceux du module', lib.concat(sous).every(x => AJ.includes(x)));
  t('le mot le plus long ne force aucune case au-dela de ' + base + ' px',
    larg(lib, true) <= base && larg(sous, false) <= base, larg(lib, true).toFixed(0) + ' / ' + larg(sous, false).toFixed(0));
  t('chaque case est une cible de 44 px au moins, a toutes les tailles', kase['min-height'] === 'var(--bdv-cible)' && px('bdv-cible') >= 44);
  t('le bilan cache ne se dessine pas (display:none sur [hidden])',
    (top('.bdv-coque .aff-bilan[hidden]').decl.display || '') === 'none');

  /* SOUS 700 px (verificateur du lot 45, 29/09/2026) : le chiffre et un mot COURT, UNE
     rangee de 44 px. Le calcul, pire cas a trois chiffres : chiffre a 0,62 em de f-3,
     mot a 0,52 em de f-2 (estimations larges pour Inter), ecart e-1, marge interieure et
     bordure. A 390 px la rangee doit tenir ; a 320 px elle se replie sur deux rangees,
     chaque case sur une ligne, sans debordement. */
  const tel = (sel) => regles.filter(r => r.ctx.join() === '@media (max-width:700px)'
    && r.sel.split(',').map(x => x.trim()).includes('body.bdv-poste.bdv-coque ' + sel)).pop() || { decl: {} };
  const tb = tel('.aff-bilan').decl, tk = tel('.aff-bilan__case').decl, tl = tel('.aff-bilan__l').decl,
        ts = tel('.aff-bilan__s').decl, tc = tel('.aff-bilan__c').decl;
  const f2 = px('bdv-f-2'), f3 = px('bdv-f-3'), e1 = px('bdv-e-1'), e2 = px('bdv-e-2');
  const padT = 2 * px(((tk.padding || '').match(/--([\w-]+)\)\s*$/) || [])[1]) + 2;
  const largT = (chiffre, mot) => (chiffre ? chiffre.length * 0.62 * f3 + e1 : 0) + mot.length * 0.52 * f2 + padT;
  const rangee = (cs) => cs.reduce((a, c) => a + largT(c[0], c[1]), 0) + (cs.length - 1) * e2;
  const pire = [['123', 'en cours'], ['123', 'à relancer'], ['123', 'à suivre']];
  const tous = [['123', 'en cours'], ['123', 'à relancer'], [null, 'tous en affaire']];
  const nul = [['123', 'en cours'], ['123', 'à relancer'], [null, 'à suivre']];
  const nulLong = [['123', 'en cours'], ['123', 'à relancer'], [null, 'à suivre : à l’ouverture']];
  t('a 390 px, « 123 en cours », « 123 à relancer », « 123 à suivre » tiennent sur une rangee (' + rangee(pire).toFixed(0) + ' px pour ' + dispo + ')',
    !isNaN(padT) && rangee(pire) <= dispo && rangee(tous) <= dispo && rangee(nul) <= dispo,
    [pire, tous, nul].map(x => rangee(x).toFixed(0)).join(' / '));
  t('« à suivre : à l’ouverture » ne tiendrait pas (' + rangee(nulLong).toFixed(0) + ' px) : le cas null dit « à suivre » seul',
    rangee(nulLong) > dispo && AJ.includes("false, 'à suivre', 'Clients à suivre : comptés"));
  const dispo320 = 320 - 2 * pad, deux = rangee(pire.slice(0, 2)), maxCase = Math.max(...pire.map(c => largT(c[0], c[1])));
  t('a 320 px (' + dispo320 + ' utiles) la rangee ne tient pas (' + rangee(pire).toFixed(0) + ') : repli sur deux rangees, 44 + 8 + 44 = 96 px, sans debordement',
    rangee(pire) > dispo320 && deux <= dispo320 && maxCase <= dispo320 && rang['flex-wrap'] === 'wrap' && tk['white-space'] === 'nowrap' && !tb['flex-wrap'],
    deux.toFixed(0) + ' / ' + maxCase.toFixed(0) + ' / ' + JSON.stringify(tb));
  t('chaque case : une ligne, chiffre puis mot court, cible de 44 px, et plus de liste',
    tk['flex-direction'] === 'row' && tk['min-height'] === 'var(--bdv-cible)' && tb['flex-direction'] !== 'column', JSON.stringify(tk));
  t('sous 700 px le mot long et la sous-ligne partent, le mot court arrive ; sur l\'ordinateur, l\'inverse',
    tl.display === 'none' && ts.display === 'none' && tc.display === 'inline' && (top('.bdv-coque .aff-bilan__c').decl.display || '') === 'none');
  t('les mots courts sont ceux que le module ecrit', ['en cours', 'à relancer', 'à suivre', 'tous en affaire'].every(x => AJ.includes("'" + x + "'")));
}

/* ======================= « VOIR DANS MON CAP » ET L'ORDRE DES navTo (lot 45) =======================
   Verificateur, 29/09/2026 : la demande etait servie tout de suite, puis l'amorce rappelait
   navTo('annee') DEUX fois, et chaque navTo remonte la page. On rejoue le VRAI navTo() et
   le VRAI bloc de la demande, extraits du fichier, dans cet ordre : demande, puis deux
   navTo('annee'). Le defilement vers #pied-cap doit etre la DERNIERE chose demandee. */
titre('« Voir dans Mon cap » defile en dernier (lot 45)');
{
  const debut = ECRANS.indexOf('function navTo(id, opts){');
  const srcNavTo = ECRANS.slice(debut, ECRANS.indexOf('\n}\n', debut) + 2);
  const d0 = ECRANS.indexOf('let PIED_CAP_DEMANDE=');
  const srcDem = ECRANS.slice(d0, ECRANS.indexOf('window.voirVariation=voirVariation;', d0));
  /* jsdom ne met rien en page : les boites des deux collants et du repli sont posees a la
     main. Le bandeau du site a 60 px, l'en-tete du bureau a 115 px, le repli a 500 px. */
  const V = new JSDOM('<!doctype html><body><nav class="nav"></nav><header class="bureau-tete"></header><div id="filterbar"></div><div class="panel" id="p-annee"><details class="msg--replie" id="pied-cap"><summary>Ce qui explique ta variation</summary></details></div></body>',
    { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/#clients' });
  const vw = V.window, vd = vw.document, journal = [];
  const boite = { nav: 60, tete: 115 };
  vd.querySelector('.nav').getBoundingClientRect = () => ({ top: 0, bottom: boite.nav, height: boite.nav });
  vd.querySelector('.bureau-tete').getBoundingClientRect = () => ({ top: 0, bottom: boite.tete, height: boite.tete });
  vd.getElementById('pied-cap').getBoundingClientRect = () => ({ top: 500, bottom: 530, height: 30 });
  /* navTo remonte par scrollTo(0,0) ; le service defile par scrollTo({top, behavior}). */
  vw.scrollTo = (x) => journal.push(typeof x === 'object' ? 'defile:' + x.top + ':' + x.behavior : 'haut');
  vw.BdvNav = { ventesEnVue: () => true, marquerActif: () => {},
    /* Comme l'amorce : un navTo tout de suite, un second apres un tour de boucle. */
    afficher: (id) => { vw.navTo(id); setTimeout(() => vw.navTo(id), 5); } };
  /* On part de « Clients a suivre », comme le lien. */
  vw.eval('var ECRAN_COURANT="clients", PEINTRES={}, ECRANS_PEINTS=new Set(["annee","clients"]);'
    + 'function el(i){return document.getElementById(i);} function majBoutonMaj(){} function majPeriodeTete(){}'
    + srcNavTo + srcDem + ';window.navTo=navTo;window.voirVariation=voirVariation;');
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  vw.voirVariation();
  await attendre(80);
  const dernierHaut = journal.lastIndexOf('haut');
  t('deux navTo(\'annee\') : seul le premier, qui CHANGE d\'ecran, remonte la page', journal.filter(x => x === 'haut').length === 1 && journal[0] === 'haut', journal.join(','));
  t('le defilement vers #pied-cap est demande EN DERNIER, apres le retour en haut',
    /^defile:/.test(journal[journal.length - 1]) && journal.slice(dernierHaut + 1).every(x => /^defile:/.test(x)), journal.join(','));
  t('et le repli est ouvert', vd.getElementById('pied-cap').open === true);
  /* LE CALCUL LIT LES DEUX COLLANTS, et garde le plus bas : 500 - 115 - 16 = 369, en
     defilement instantane (la page est en scroll-behavior:smooth). */
  t('l\'ecart vient du bas REEL des collants (le plus bas des deux) : 369 px, instantane',
    journal.slice(dernierHaut + 1)[0] === 'defile:369:instant', journal.join(','));
  /* LE RECALAGE, UNE FOIS : l'en-tete se retracte (24 px), le bandeau disparait (0). */
  vw.voirVariation(); await attendre(80);
  journal.length = 0;
  vw.navTo('annee');
  boite.tete = 24; boite.nav = 0;
  await attendre(80);
  t('apres la retraction, un seul recalage, sur les nouvelles boites : 500 - 24 - 16 = 460',
    journal.join(',') === 'defile:369:instant,defile:460:instant', journal.join(','));
  await attendre(80);
  t('et plus rien ensuite', journal.length === 2, journal.join(','));
  /* Le vigneron agit avant le recalage : on ne reprend pas la main. */
  boite.tete = 115; boite.nav = 60;
  journal.length = 0;
  vw.navTo('annee');
  vd.dispatchEvent(new vw.KeyboardEvent('keydown', { key: 'ArrowUp' }));
  boite.tete = 24;
  await attendre(80);
  t('geste du vigneron avant le recalage : pas de recalage', journal.join(',') === 'defile:369:instant', journal.join(','));
  /* L'en-tete du bureau absent ou replie a zero : le bandeau du site seul fait la marge. */
  boite.tete = 0; boite.nav = 60;
  vw.voirVariation(); journal.length = 0; vw.navTo('annee');
  t('sans en-tete visible, le bandeau seul : 500 - 60 - 16 = 424', journal[0] === 'defile:424:instant', journal.join(','));
  /* LE DEFAUT DU 30/09/2026 : la molette, puis l'amorce qui rappelle navTo sur l'ecran deja
     affiche. Ni remontee, ni defilement : la page reste ou le vigneron l'a mise. */
  vd.dispatchEvent(new vw.WheelEvent('wheel', { deltaY: 120 }));
  await attendre(80);
  journal.length = 0;
  vw.navTo('annee'); vw.navTo('annee');
  await attendre(80);
  t('molette, puis navTo repete sur le meme ecran : aucun scrollTo, ni en haut ni vers le repli', journal.length === 0, journal.join(','));
  vw.navTo('annee', { haut: true });
  t('un clic volontaire sur la barre (haut) remonte quand meme', journal.join(',') === 'haut', journal.join(','));
  await attendre(40);
  t('et une seule fois (pas de seconde remontee hors historique)', journal.join(',') === 'haut', journal.join(','));
  journal.length = 0;
  vw.navTo('annee', { haut: 'historique' });
  t('Retour / Suivant : remontee tout de suite', journal.join(',') === 'haut', journal.join(','));
  await attendre(40);
  t('puis encore une image plus tard, en instantane, apres la restauration du navigateur',
    journal.join(',') === 'haut,defile:0:instant', journal.join(','));
  journal.length = 0;
  vw.navTo('produits');
  t('changer d\'ecran remonte la page', journal.join(',') === 'haut', journal.join(','));
  /* Un autre ecran annule aussi la demande. */
  vw.voirVariation(); await attendre(80);
  vw.navTo('clients'); journal.length = 0; vw.navTo('annee'); await attendre(80);
  t('partir sur un autre ecran annule la demande', !journal.some(x => /^defile:/.test(x)), journal.join(','));
}

/* LA BARRE ET LA COQUE DECIDENT DU « haut » (bdv-nav.js) : un clic sur la barre le
   demande toujours ; un afficher() programme sur une coque des ventes deja visible
   (« Voir dans Mon cap » depuis « Clients a suivre ») ne le demande pas. */
{
  const H = bureau();
  H.clic('annee');
  await H.repos(() => H.appels.some(a => a.ecran === 'annee'));
  const d1 = H.appels.filter(a => a.ecran).pop();
  H.window.BdvNav.afficher('clients', { onglet: 'suivre' });
  await H.repos(() => H.appels.filter(a => a.ecran).length >= 2);
  const d2 = H.appels.filter(a => a.ecran).pop();
  H.clic('clients');
  await H.repos(() => H.appels.filter(a => a.ecran).length >= 3);
  const d3 = H.appels.filter(a => a.ecran).pop();
  t('clic sur la barre : haut demande', d1 && d1.haut === true && d3 && d3.haut === true, JSON.stringify([d1, d3]));
  t('afficher() programme, coque deja visible : pas de haut', d2 && d2.ecran === 'clients' && d2.haut === false, JSON.stringify(d2));
}

/* ======================= L'ANCIENNE ADRESSE ======================= */
titre("L'ancienne adresse du tableau de bord");
const REDIR = path.join(RACINE, '_site/outils/dashboard-vigneron/index.html');
if (!fs.existsSync(REDIR)) {
  t('la page de redirection est publiee', false, path.relative(RACINE, REDIR) + ' est absent');
} else {
  const html = fs.readFileSync(REDIR, 'utf8');
  t('la page de redirection ne contient plus l\'outil',
    !html.includes('id="app"') && html.length < 4000, html.length + ' octets');
  t('elle offre un lien de secours si le script ne prend pas',
    html.includes('href="/mon-bureau/"'));

  /* On extrait le script de la page et on l'execute avec un faux `location` : jsdom ne
     sait pas suivre une navigation, et son location.replace n'est pas remplacable. Ce
     qu'on verifie n'est de toute facon pas la navigation mais la TRADUCTION de l'adresse,
     seule chose que cette page ait a faire correctement. */
  const codeRedir = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1];
  t('la page porte bien un script de redirection', !!codeRedir);
  function ou(hash) {
    let vers = null;
    const faux = { hash: hash || '', replace: (u) => { vers = u; } };
    new Function('location', codeRedir)(faux);
    return vers;
  }
  t('sans fragment, elle mene au bureau', ou() === '/mon-bureau/', String(ou()));
  t('#clients garde son ecran', ou('#clients') === '/mon-bureau/#clients', String(ou('#clients')));
  t('#annee garde son ecran', ou('#annee') === '/mon-bureau/#annee', String(ou('#annee')));
  t('#client=JAYAMA garde sa fiche',
    ou('#client=JAYAMA') === '/mon-bureau/#client=JAYAMA', String(ou('#client=JAYAMA')));
  t('#parametres et #reglages menent tous deux au panneau, devenu #base',
    ou('#parametres') === '/mon-bureau/#base' && ou('#reglages') === '/mon-bureau/#base',
    ou('#parametres') + ' / ' + ou('#reglages'));
  t('un fragment inconnu ne fabrique pas une adresse inconnue',
    ou('#nimportequoi') === '/mon-bureau/', String(ou('#nimportequoi')));
}

/* ---------------------------------------------------------------------------
   LE PLATEAU : L'ORDRE DES ZONES ET LEUR MATIERE
   ---------------------------------------------------------------------------
   Ajoute le 07/09/2026 avec la refonte. L'ordre des zones est une DEMANDE de
   Ted, pas une preference de mise en page, et il est facile de le casser sans
   s'en rendre compte en deplaçant un bloc du gabarit. Les trois defauts de
   balisage corriges au meme moment sont controles ici pour la meme raison :
   ils etaient invisibles a l'oeil et a la charte.
--------------------------------------------------------------------------- */
titre('Le plateau, dans l\'ordre de Ted');
{
  const dom = new JSDOM(HTML);
  const doc = dom.window.document;
  const zones = [...doc.querySelectorAll('#bureauJournee > .zone')]
    .map(z => [...z.classList].find(c => c.startsWith('zone--')));
  t('les zones sont dans l\'ordre dicte',
    zones.join(' > ') === 'zone--panneau > zone--sousmain > zone--calendrier > zone--ardoise > zone--lecture > zone--classeur > zone--courrier',
    zones.join(' > '));
  /* LE MOT DU JOUR EST MONTE DANS LE BANDEAU D'ACCUEIL le 24/09/2026, demande de Ted :
     entre le salut et la lune, et pas ailleurs. */
  {
    const acc = doc.getElementById('bureauAccueil');
    const kids = acc ? [...acc.children].map(e => e.id) : [];
    const iMot = kids.indexOf('zoneMot'), iSal = kids.indexOf('bureauSalut'), iLune = kids.indexOf('bureauLune');
    t('le mot du jour est dans le bandeau d\'accueil, entre le salut et la lune',
      iSal > -1 && iMot > iSal && iLune > iMot, kids.join(' > '));
  }
  /* Le titre AFFICHE, et pas le mot : les commentaires du gabarit expliquent
     justement pourquoi le pense-bete a disparu, et ils doivent pouvoir le dire. */
  t('le pense-bete n\'existe plus, le calendrier a pris sa place',
    !HTML.includes('zone--pensebete')
    && ![...doc.querySelectorAll('h2')].some(h => /pense-b/i.test(h.textContent))
    && (doc.querySelector('.zone--calendrier .zone__tete h2') || {}).textContent === 'Le calendrier',
    zones.join(' > '));
  /* Le bloc de « Ma journee » mene DANS le bureau depuis le 08/09/2026 : le calendrier
     est une piece, plus une page. Le clic est intercepte par bdv-nav.js, qui attrape
     tous les liens en /mon-bureau/# poses ailleurs que dans la barre. */
  t('le calendrier mene a la piece du calendrier et pas a un article',
    /a\.href = '\/mon-bureau\/#calendrier'/.test(HTML) && !/a\.href = ECHEANCE\.e\.article/.test(HTML));

  /* Le defaut : la ligne du sous-main etait un <button> qui contenait trois
     <button>. Le controle porte sur le CODE qui fabrique la ligne, parce que la
     ligne n'existe pas dans le HTML livre : elle est montee au chargement. */
  t('la ligne du sous-main est une rangee de tableau, pas un bouton',
    /createElement\('tr'\)[\s\S]{0,200}listb__l/.test(HTML) && !/className = 'tache'/.test(HTML));
  t('le sous-main a un vrai en-tete de colonnes',
    /createElement\('th'\)/.test(HTML) && /th\.scope = 'col'/.test(HTML));
  /* CINQ COLONNES, ET LA REFERENCE EST SOUS LE NOM. Ted a dicte Ref, Fichier
     client, Motif, Retard, Geste. La mesure a impose deux amenagements sans
     rien retirer : la reference passe sous le nom, dans la meme cellule, ou
     elle ne coute aucun pixel de largeur, et le montant sort du motif pour
     avoir sa colonne de nombres alignes a droite. Les cinq informations sont
     toutes la.

     LA DERNIERE S'APPELLE « ACTION » DEPUIS LE 10/09/2026, sur demande de Ted :
     le mot a change au panneau, et une meme page ne dit pas deux mots pour la
     meme chose. Seul le mot d'ECRAN a bouge ; `BdvCrm.GESTES` et les noms de
     classes disent toujours « geste », et ce banc en parle encore ailleurs. */
  t('les colonnes du listing sont celles-la',
    /\['Fichier client', 'Motif', 'Montant', 'Retard', 'Action'\]/.test(HTML));
  t('la reference du fichier vit sous le nom, elle n\'a pas disparu',
    /listb__fichier/.test(HTML) && /'réf\. ' \+ l\.id/.test(HTML));
  t('le montant a sa colonne, il n\'est plus collé au motif',
    /listb__montant/.test(HTML) && !/euros\(l\.montant\) \+ ' ' \+ \(l\.lib/.test(HTML));
  /* Le defaut de Ted : les trois boutons a libelle complet font 306 px mesures
     et debordaient de la zone a toutes les largeurs. Le mot court est sur le
     bouton, la phrase complete dans le title et l'aria-label.

     LA SOURCE DU LIBELLE A CHANGE LE 11/09/2026, et c'est le controle qui suit qui
     dit pourquoi : deux de ces trois boutons ne posent plus de geste, ils ouvrent la
     fiche. Un libelle tire de `BdvCrm.GESTES` decrirait donc un geste qu'ils ne font
     plus. Ils lisent la liste ACTIONS, qui porte l'endroit a ouvrir ; seul « Ecarte »
     y reprend son libelle dans GESTES, parce que lui pose toujours son geste. */
  t('les boutons de geste portent un mot court et leur nom complet en title',
    /b\.textContent = a\.court/.test(HTML)
    && /b\.title = a\.label/.test(HTML)
    && /aria-label', a\.label/.test(HTML));
  /* LE SOUS-MAIN N'ECRIT PLUS AU CLIC, demande de Ted du 11/09/2026. « Appele » et
     « Message » ouvrent la vraie fiche client, a l'endroit qui correspond, et rien ne
     part en base tant que le vigneron n'a pas ecrit ce qui s'est passe. Si ce controle
     tombe, c'est que le tri rapide d'avant est revenu : la fiche ne s'ouvre plus, et
     un client quitte la file sans qu'on sache ce qu'il a dit. */
  t('« Appele » et « Message » ouvrent la fiche au lieu de poser le geste au clic',
    /if\(act && !act\.direct\)\{\s*ouvrirFiche\(id, act\.cible, act\.cle\)/.test(HTML)
    && /cible: 'suivi'/.test(HTML) && /cible: 'message'/.test(HTML));
  t('« Ecarte » reste un geste sec, sans fiche',
    /cle: 'ecarte',\s+court: 'Écarté',\s+direct: true/.test(HTML));
  /* LA MODALE DOIT ETRE HORS DU BLOC MASQUE. Elle vivait au bas de la coque des
     ecrans de vente, donc dans `#bureauVentes`, masque tant qu'aucune piece de vente
     n'a ete ouverte : ouverte depuis « Ma journee », elle se peignait dans du vide,
     sans une erreur. Meme piege que « Ma base » le 08/09/2026, et il ne se voit qu'a
     l'ecran. Ce controle est le seul qui l'attrape. */
  t('la modale de la fiche client est hors de #bureauVentes',
    /<div id="modale"/.test(HTML)
    && HTML.indexOf('<div id="modale"') > HTML.indexOf('id="bureauVentes"')
    && !/id="bureauVentes"[\s\S]*?<div id="modale"[\s\S]*?<\/div>\s*<\/div><!-- \/\.bureau-atelier/.test(HTML));
  /* ET LA PETITE FICHE NE REVIENT PAS. Deux fiches pour un meme client, c'est deux
     endroits ou noter un appel : celui qui les remplit tous les deux perd la moitie
     de son travail le jour ou il n'en ouvre qu'un. */
  t('le bureau ne peint plus sa propre fiche client',
    !/id="voile"/.test(HTML) && !/ficheContenu/.test(HTML) && !/class="ficheb"/.test(HTML));

  /* Le defaut : `pointer-events: none` n'arrete que la souris. Au clavier, deux
     Entree posaient deux gestes. */
  t('un geste pose desactive les boutons de sa ligne, il ne les rend pas juste inertes',
    /x\.disabled = true/.test(HTML) && !/tache--partie/.test(HTML));

  /* Le defaut : une reponse serveur mal formee eteignait toute la peinture. */
  const crm = fs.readFileSync(path.join(RACINE, 'src/js/bdv-crm.js'), 'utf8');
  t('une reponse serveur qui n\'est pas un tableau ne casse plus la peinture',
    (crm.match(/Array\.isArray\(r\[[01]\]\.value\)/g) || []).length >= 3,
    (crm.match(/Array\.isArray\(r\[[01]\]\.value\)/g) || []).length + ' garde(s)');
}

/* ======================= LA LUNE DE L'ENTETE (08/09/2026) =======================
   Le calcul et le dessin sont eprouves par scripts/banc-lune.mjs. Ici on ne
   controle que le BRANCHEMENT, c'est-a-dire ce que banc-lune ne peut pas voir :
   le bloc existe dans la page produite, l'almanach y est declare, et il y est
   declare AVANT le module de la barre. */
titre("La lune de l'entete");
const L = bureau();
t('le bloc de la lune est dans le HTML produit',
  !!L.doc.getElementById('bureauLune')
  && !!L.doc.getElementById('bureauLuneClair')
  && !!L.doc.getElementById('bureauLuneNom')
  && !!L.doc.getElementById('bureauLuneNote')
  && !!L.doc.getElementById('bureauLuneSuite'));
/* Cache au depart. Un cadre vide en attendant un script en defer se remarque plus
   qu'une absence, et c'est la regle deja ecrite pour la plaque de porte. */
t('il est cache tant que rien ne l\'a peint',
  L.doc.getElementById('bureauLune').hasAttribute('hidden'));
/* ELLE A CHANGE DE PARENT LE 21/09/2026, ET LE CONTROLE AVEC.
   L'en-tete du bureau est passe de 209 a 56 px : il ne porte plus que ce qui vaut
   pour les neuf pieces (le nom de la piece, la date, l'etat, les actions). Le
   salut, la plaque et la lune sont descendus dans « Ma journee », dans
   `.bureau-accueil`, parce qu'une phase de lune au-dessus de « Mon registre » est
   du decor et qu'au-dessus de la journee c'est le sujet.
   CE QU'ON CONTROLE MAINTENANT, et c'est la meme chose sous un autre toit : la
   lune est DANS le bandeau d'accueil, a cote du salut, et le bandeau est dans
   « Ma journee » et nulle part ailleurs. La deuxieme moitie est ce qui compte :
   posee hors de `#bureauJournee`, elle resterait affichee sur les huit autres
   pieces, puisque `seule()` ne masque que les quatre conteneurs. */
t('la lune est dans le bandeau d\'accueil, a cote du salut',
  L.doc.querySelector('.bureau-accueil > .bureau-tete__lune') !== null
  && L.doc.querySelector('.bureau-accueil #bureauSalut') !== null);
t('et le bandeau d\'accueil vit dans « Ma journee », pas dans l\'en-tete',
  L.doc.querySelector('#bureauJournee > .bureau-accueil') !== null
  && L.doc.querySelector('.bureau-tete .bureau-tete__lune') === null);
/* ET IL N'EST PAS UNE `.zone` : l'ordre des huit zones est controle plus haut par
   `#bureauJournee > .zone`, et cet ordre est celui que Ted a dicte le 07/09/2026.
   Donner la classe au bandeau ferait entrer un neuvieme nom dans cette liste. */
t('le bandeau d\'accueil n\'est pas une zone du plateau',
  !L.doc.querySelector('.bureau-accueil').classList.contains('zone'));
/* L'ALMANACH DANS LE GABARIT, ET EN DEFER. Sans defer il entrerait dans le budget
   documente de 32 ko bloquants du bureau, que ce chantier n'a pas le droit
   d'augmenter. */
const BAL = L.doc.querySelector('script[src="/js/bdv-almanach.js"]');
t('l\'almanach est declare dans le gabarit', !!BAL);
t('et il y est en defer, donc hors du budget bloquant',
  !!BAL && BAL.hasAttribute('defer'));
/* L'ORDRE RESTE UNE CONDITION, il est seulement garanti ici plutot que dans la
   liste du calendrier : les defer s'executent dans l'ordre de declaration, donc
   BdvAlmanach existe avant que bdv-nav.js n'ouvre quoi que ce soit. */
const SRCS = [...L.doc.querySelectorAll('script[src]')].map(x => x.getAttribute('src'));
t('il est declare AVANT bdv-nav.js',
  SRCS.indexOf('/js/bdv-almanach.js') !== -1
  && SRCS.indexOf('/js/bdv-almanach.js') < SRCS.indexOf('/js/bdv-nav.js'),
  SRCS.join(' | '));
/* LA LUNE NE DOIT RIEN A L'INTERRUPTEUR « Lune et feries » du calendrier, et c'est
   un choix de Ted du 08/09/2026 : cet interrupteur nettoie les cases d'un mois, la
   lune de l'entete est le decor du bureau. Le jour ou quelqu'un les branchera
   ensemble « par coherence », ce controle le dira. */
const PEINTRE = HTML.slice(HTML.indexOf('function peindreLune'),
                           HTML.indexOf('function peindreLune') + 2600);
t('le peintre de la lune n\'appelle pas les choix du calendrier',
  !/BdvCalchoix|reglesActives/.test(PEINTRE));
t('il retourne le dessin quand la lune decroit, et pas autrement',
  /scale\(-1,1\)/.test(PEINTRE) && /removeAttribute\('transform'\)/.test(PEINTRE));

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BUREAU NE FAIT PAS CE QU\'IL DIT'); process.exit(1); }
console.log('  LE BUREAU FAIT CE QU\'IL DIT');
