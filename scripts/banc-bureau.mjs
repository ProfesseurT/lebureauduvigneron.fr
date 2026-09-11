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
    repos() { return new Promise(r => setTimeout(r, 60)); }
  };
}

/* ======================= LA BARRE (lot 1) ======================= */
titre('La barre du bureau');
const B = bureau();
t('le module s\'expose', typeof B.window.BdvNav.monter === 'function');
t('la coque de l\'atelier existe dans le HTML produit',
  !!B.nav && !!B.doc.getElementById('bureauAtelier'));

const lignes = [...B.nav.querySelectorAll('.bureau-nav__ligne')];
t('huit pieces montees', lignes.length === 8, lignes.length + ' trouvee(s)');
/* L'ORDRE EST UN CONTROLE ET PAS UN DETAIL : il porte l'hypothese H2 du document
   de refonte, le vigneron vient pour ne rien oublier. Si quelqu'un le change, il
   doit le changer ICI aussi, donc en connaissance de cause. */
t('l\'ordre porte l\'hypothese du document',
  lignes.map(l => l.querySelector('.bureau-nav__nom').textContent).join(' | ')
  === 'Ma journée | Mes tâches | Le calendrier | Mon commerce | Mon cap | Mes cuvées | Mon registre | Mes réglages',
  lignes.map(l => l.querySelector('.bureau-nav__nom').textContent).join(' | '));
t('chaque piece porte un title', lignes.every(l => l.querySelector('[title]')));
t('les six pieces internes pointent DANS le bureau',
  [...B.nav.querySelectorAll('a.bureau-nav__item')]
    .map(a => a.getAttribute('href'))
    .filter(h => /^\/mon-bureau\/#/.test(h)).length === 6);
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

/* ---- le repli a ete SUPPRIME le 07/09/2026 ----
   Ces controles gardent la suppression, ils ne gardent pas un bouton. Motif ecrit
   en tete de bdv-nav.js : la largeur decide seule, et il ne reste aucun etat a
   relire. Ils echouent donc si quelqu'un reintroduit un bouton, un raccourci ou
   la classe de repli sans reintroduire un menu de secours avec. */
const atelier = B.doc.getElementById('bureauAtelier');
t('la barre n\'a plus de bouton de repli',
  B.doc.getElementById('bureauNavPlier') === null);
t('aucune classe de repli sur l\'atelier',
  !atelier.classList.contains('bureau-atelier--replie'));
t('la barre ne pose plus de preference de repli',
  B.window.localStorage.getItem('bdv_volet_replie') === null);
const frappe = (c) => c.dispatchEvent(new B.window.KeyboardEvent('keydown', { key: '[', bubbles: true, cancelable: true }));
frappe(B.doc.body);
t('le crochet ouvrant ne replie plus rien',
  !atelier.classList.contains('bureau-atelier--replie'));
t('les huit languettes restent toutes visibles',
  lignes.filter(l => !l.hidden).length === 8, lignes.filter(l => !l.hidden).length);

/* ---- sans Vitisoft : regle metier, pas cosmetique ---- */
B.window.BdvNav.sansVitisoft(true);
t('sans Vitisoft, les quatre pieces de vente disparaissent',
  lignes.filter(l => l.hidden).map(l => l.dataset.piece).sort().join(',') === 'annee,chercher,clients,produits');
t('sans Vitisoft, la journee, les taches, le calendrier et les reglages RESTENT',
  ['journee', 'taches', 'calendrier', 'reglages']
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
const idsBarre = B.window.BdvNav.pieces
  .filter(p => p.viti || p.id === 'reglages').map(p => p.id).sort();
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
  '/js/bdv-ecrans.js'
].join(' | ');
t('le moteur puis les ecrans, dans cet ordre',
  B.charges.join(' | ') === ATTENDU, B.charges.join(' | ') || '(aucune)');
/* On FILTRE les appels au demarrage des ecrans, au lieu de lire le tableau entier :
   depuis que Mes taches se branche aussi par la barre, `appels` porte les deux sortes
   et un controle cale sur un indice cassait des qu'une piece etait ajoutee. Il aurait
   dit « les ecrans ne demarrent pas » alors qu'ils demarraient tres bien. */
const ecransDemarres = () => B.appels.filter(a => a.ecran || a.client);
t('les ecrans sont demarres sur la bonne piece',
  JSON.stringify(ecransDemarres()) === '[{"ecran":"clients"}]', JSON.stringify(B.appels));

B.clic('produits');
await B.repos();
t('un second clic ne recharge RIEN', B.charges.length === 7, B.charges.length + ' ressources');
t('mais il navigue',
  JSON.stringify(ecransDemarres()[1]) === '{"ecran":"produits"}', JSON.stringify(ecransDemarres()));

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

M.clic('clients');
await M.repos();
t('ouvrir ensuite un ecran de vente ne recharge pas le moteur',
  M.charges.filter(c => c === '/js/bdv-base.js').length === 1,
  M.charges.filter(c => c === '/js/bdv-base.js').length + ' fois');
t('et il charge bien les ecrans par-dessus',
  M.charges.length === 7, M.charges.length + ' ressources');

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
await C.repos();
t('et demarre les ecrans dessus',
  JSON.stringify(C.appels) === '[{"ecran":"clients"}]', JSON.stringify(C.appels));

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
await H.repos();
t('un lien de fiche client ouvre la fiche',
  JSON.stringify(H.appels) === '[{"client":"JAYAMA"}]', JSON.stringify(H.appels));

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
J.clic('clients');
await J.repos();
J.window.history.back();
await new Promise(r => setTimeout(r, 30));
t('Retour depuis un ecran de vente ramene a « Ma journee » sans quitter le bureau',
  !J.journee.hidden && J.ventes.hidden,
  'hash : ' + J.window.location.hash);

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
    zones.join(' > ') === 'zone--panneau > zone--sousmain > zone--calendrier > zone--ardoise > zone--mot > zone--lecture > zone--classeur > zone--courrier',
    zones.join(' > '));
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
t('il est la troisieme zone de la ligne, entre le bonjour et les actions',
  L.doc.querySelector('.bureau-tete__ligne > .bureau-tete__lune + .bureau-tete__actions') !== null);
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
