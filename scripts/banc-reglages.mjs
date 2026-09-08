/* ============================================================================
   scripts/banc-reglages.mjs : le banc des reglages

     npm run banc:reglages

   ECRIT LE 07/09/2026, apres l'audit de fonctionnement demande par Ted. Il ne
   verifie PAS un ecran : il verifie LA CHARGE ENVOYEE au serveur. C'est la seule
   chose que la relecture visuelle ne peut pas voir, et c'est exactement la que
   les deux pannes se trouvaient :

     1. syncReglages() renvoyait les QUATRE colonnes de `reglages` a chaque geste.
        Le panneau, lui, ecrit `objectif` et `exercice_debut` directement en base.
        Changer le mois d'exercice repoussait donc l'objectif que le moteur avait
        encore en memoire par-dessus celui que le vigneron venait d'enregistrer.
        Et au demarrage, avant que REG soit lu, le meme envoi effacait le
        classement du compte. Deux pertes de donnees, aucun message.

     2. Le panneau chargeait le moteur mais ne rapatriait pas le compte : sur un
        appareil neuf, « Ma base » annoncait 0 ligne sur un compte qui en portait
        des milliers.

   IL DEMANDE jsdom :  npm install --save-dev jsdom
   Sans lui il s'arrete en le disant, et il ne rend jamais un faux OK.

   LES FICHIERS SONT POSES COMME DE VRAIS <script> DE LA PAGE, et pas evalues un
   par un. Deux evaluations separees ne partagent pas les `let` de premier niveau,
   alors que deux <script> classiques d'une meme page, si. Un banc qui l'ignore
   declare en panne du code qui marche : c'est arrive pendant son ecriture.

   CE QU'IL NE FAIT PAS. Aucun reseau, aucune IndexedDB : BdvSync et BdvCompte
   sont remplaces par des doubles qui notent les appels, et le stockage local par
   un tableau. Il verifie l'enchainement et les charges, jamais un chiffre a
   l'ecran.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RACINE, 'src/js');

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) {
  console.error('\n  jsdom est absent, le banc ne peut pas tourner.');
  console.error('  Rien n\'a ete verifie. Installe-le :  npm install --save-dev jsdom\n');
  process.exit(2);
}
for (const f of ['bdv-base.js', 'bdv-reglages.js']) {
  if (!fs.existsSync(path.join(JS, f))) {
    console.error('\n  src/js/' + f + ' est absent : le banc ne verifie rien.\n');
    process.exit(2);
  }
}

let ok = 0, ko = 0;
const dit = (b, m) => { if (b) { ok++; console.log('  ok    : ' + m); } else { ko++; console.log('  ECHEC : ' + m); } };
const lire = (f) => fs.readFileSync(path.join(JS, f), 'utf8');

/* La barre de statut fait partie du decor : le bureau la possede vraiment, bdv-nav.js la
   sort sous <body> des l'ouverture. Sans #statusTxt, status() leve et emporte avec lui le
   rapatriement tout entier. */
const CORPS = '<!doctype html><html><body>'
  + '<div id="status"><span id="statusTxt"></span><span id="statusSpin"></span></div>'
  + '<button id="bureauReglages"></button></body></html>';

/* Le decor : ce qui remplace IndexedDB, plus une sonde. La sonde est declaree DANS un
   script de la page, donc son eval direct voit les `let` de premier niveau du moteur. */
const DECOR = 'var LOCAL = [];'
  + 'dbAddMany = async function(l){ var av = LOCAL.length; (l||[]).forEach(function(x){ if(!LOCAL.some(function(y){ return y.h === x.h; })) LOCAL.push(x); }); return { added: LOCAL.length - av }; };'
  + 'dbGetAll = async function(){ return LOCAL.map(function(x){ return { raw: x.brut || [] }; }); };'
  + 'regLire = async function(){ return REG; };'
  + 'regEcrire = async function(R){ REG = R; return true; };'
  + 'window.__sonde = function(expr){ return eval(expr); };';

const LIGNES_SERVEUR = 4939;

function monter(reglages) {
  const dom = new JSDOM(CORPS, { url: 'https://lebureauduvigneron.fr/mon-bureau/', pretendToBeVisual: true, runScripts: 'dangerously' });
  const w = dom.window;
  const etat = { envois: [], tirages: 0 };
  w.BdvSync = {
    pret: () => true,
    ecrireReglages: (c) => { etat.envois.push(c); return Promise.resolve(true); },
    ecrireSuivi: () => Promise.resolve(true),
    supprimerSuivi: () => Promise.resolve(true),
    lireSuivi: () => Promise.resolve({}),
    lireEchanges: () => Promise.resolve([]),
    lireReglages: () => Promise.resolve(reglages),
    tirerVentes: () => { etat.tirages++; return Promise.resolve(new Array(LIGNES_SERVEUR).fill(0).map((_, i) => ({ h: 'h' + i, brut: [] }))); }
  };
  w.BdvCompte = {
    monId: () => 'moi',
    session: () => ({ user: { id: 'moi' } }),
    profil: () => Promise.resolve({ utilise_vitisoft: 'oui' }),
    majProfil: () => Promise.resolve(true),
    api: (chemin) => Promise.resolve(String(chemin).indexOf('/profils') === 0 ? [{ prenom: 'Ted' }] : [reglages])
  };
  etat.poser = (js, nom) => {
    const s = w.document.createElement('script');
    s.textContent = js;
    try { w.document.body.appendChild(s); }
    catch (e) { console.log('  ECHEC : ' + nom + ' leve au chargement -> ' + e.message); process.exit(1); }
  };
  etat.w = w;
  etat.P = (expr) => w.__sonde(expr);
  return etat;
}

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

/* ==========================================================================
   1. UNE ECRITURE = UNE COLONNE
   ========================================================================== */
console.log('\n== 1. Une ecriture = une colonne ==');
{
  const t = monter({ objectif: 500000, exercice_debut: 4, perso_labels: { a: 'A' }, classement: { valide: true, familles: {} } });
  t.poser(lire('bdv-base.js'), 'bdv-base.js');
  t.poser(DECOR, 'decor');
  dit(true, 'bdv-base.js se charge seul, sans le tableau de bord autour');

  const seul = (nom, geste, colonne) => {
    t.envois.length = 0;
    // Le geste est tente, jamais suppose : sur un moteur d'avant la reparation la fonction
    // n'existe pas, et un banc qui s'effondre avec une pile d'appels apprend moins qu'une
    // ligne ECHEC qui nomme ce qui manque.
    try { t.P(geste); }
    catch (e) { dit(false, nom + ' : le geste leve -> ' + e.message); return; }
    const cles = t.envois.length === 1 ? Object.keys(t.envois[0]) : [];
    dit(t.envois.length === 1 && cles.length === 1 && cles[0] === colonne,
      nom + ' n\'envoie que ' + colonne + ' (recu : ' + JSON.stringify(cles) + ')');
  };
  seul('changer l\'objectif', 'objectif = 123456; syncObjectif();', 'objectif');
  seul('changer le mois d\'exercice', 'EX_START = 7; syncExercice();', 'exercice_debut');
  seul('renommer une famille', 'persoLabels = { x: "X" }; savePersoLabels();', 'perso_labels');
  seul('appliquer un classement', 'REG = { valide: true, familles: {} }; syncClassement();', 'classement');

  t.envois.length = 0;
  t.P('REG = { valide: false }; syncClassement();');
  dit(t.envois.length === 1 && t.envois[0].classement === null,
    'un classement abandonne part en null, pas en { valide: false }');

  t.envois.length = 0;
  t.P('adopterObjectif(750000);');
  dit(t.envois.length === 0, 'adopterObjectif ne renvoie rien au serveur');
  dit(t.P('objectif') === 750000, 'adopterObjectif met a jour la valeur du moteur');
  dit(t.w.localStorage.getItem('bdv_objectif_v5') === '750000', 'adopterObjectif ecrit le stockage local');
  t.P('adopterObjectif(null);');
  dit(t.w.localStorage.getItem('bdv_objectif_v5') === null, 'un objectif vide efface la cle locale');

  t.envois.length = 0;
  t.P('adopterExercice(9);');
  dit(t.envois.length === 0, 'adopterExercice ne renvoie rien au serveur');
  dit(t.P('EX_START') === 9, 'adopterExercice met a jour le mois d\'ouverture');
  dit(t.w.localStorage.getItem('bdv_exercice_v1') === '9', 'adopterExercice ecrit le stockage local');

  /* Le rapatriement ne doit RIEN renvoyer : c'est lui qui, en appelant savePersoLabels()
     avant que REG soit lu, effacait le classement du compte a chaque ouverture. */
  t.envois.length = 0;
  await t.P('tirerDuServeur()');
  dit(!t.envois.some(e => 'classement' in e), 'le rapatriement ne renvoie pas le classement en base');
  dit(t.P('objectif') === 500000, 'le rapatriement applique l\'objectif lu en base');
  dit(t.P('EX_START') === 4, 'le rapatriement applique le mois d\'exercice lu en base');

  await Promise.all([t.P('tirerDuServeur()'), t.P('tirerDuServeur()')]);
  dit(t.tirages === 1, 'trois demandes, un seul rapatriement (' + t.tirages + ')');
}

/* ==========================================================================
   2. LE PANNEAU VOIT LA BASE, meme sans ecran de vente
   ========================================================================== */
console.log('\n== 2. Le panneau ouvert seul, sur un appareil neuf ==');
{
  const t = monter({ objectif: 500000, exercice_debut: 4 });
  t.poser(lire('bdv-base.js'), 'bdv-base.js');
  t.poser(DECOR, 'decor');
  t.poser(lire('bdv-reglages.js'), 'bdv-reglages.js');
  dit(typeof t.w.BdvReglages === 'object', 'BdvReglages est expose');
  dit(t.P('typeof TIRAGE_AJOUTS') === 'number', 'le compteur de lignes rapatriees est visible des deux fichiers');
  dit(t.P('LOCAL.length') === 0, 'depart : rien en local, ' + LIGNES_SERVEUR + ' lignes sur le compte');

  t.w.BdvReglages.ouvrir();
  await dormir(600);
  dit(t.tirages === 1, 'ouvrir le panneau rapatrie le compte (' + t.tirages + ' rapatriement)');
  dit(t.P('LOCAL.length') === LIGNES_SERVEUR, 'les lignes sont arrivees en base locale (' + t.P('LOCAL.length') + ')');
  dit(t.P('ROWS.length') === LIGNES_SERVEUR, '« Ma base » a de quoi compter : ROWS = ' + t.P('ROWS.length'));
  dit(t.P('objectif') === 500000, 'l\'objectif du compte est adopte par le moteur');
  dit(t.P('EX_START') === 4, 'le mois d\'ouverture du compte est adopte par le moteur');
  dit(t.envois.length === 0, 'ouvrir le panneau n\'ecrit rien en base (' + t.envois.length + ' envoi)');

  t.w.BdvReglages.ouvrir();
  await dormir(400);
  dit(t.tirages === 1, 'rouvrir ne rapatrie pas une seconde fois (' + t.tirages + ')');
}

/* ==========================================================================
   3. LE PANNEAU D'ABORD, LE MOTEUR ENSUITE : L'ORDRE DU VRAI BUREAU
   --------------------------------------------------------------------------
   ECRIT LE 08/09/2026, apres le « impossible de remettre ma base » de Ted.

   La section 2 ci-dessus pose bdv-base.js AVANT bdv-reglages.js. C'est l'ordre
   du tableau de bord, ou le moteur part avec la page. LE BUREAU FAIT L'INVERSE
   depuis que le moteur est charge a la demande : le panneau s'ouvre tout de
   suite, sans moteur, et le moteur arrive apres. C'est ce trou dans le banc qui
   a laisse passer la panne pendant une journee.

   Ce qu'elle attrape : monterMoteur() n'etait appele que depuis construire().
   Appele une fois, sans moteur, il ne rangeait rien, et personne ne le
   rappelait. renderBase() ecrivait donc bien son HTML, mais dans le `p-base` de
   la coque des ecrans de vente, reste `hidden` a l'interieur d'un conteneur
   masque. Aucune erreur, aucun message, et un onglet « Ma base » vide sous son
   bandeau d'etat.

   Le controle ne regarde donc pas un texte : il regarde OU se trouve le div, et
   s'il porte encore son `hidden`.
   ========================================================================== */
console.log('\n== 3. Le panneau ouvert AVANT que le moteur arrive (l\'ordre du bureau) ==');
{
  const t = monter({ objectif: 500000, exercice_debut: 4 });
  // La coque des ecrans de vente, reduite a ce qui compte ici : les deux div que le panneau
  // doit deplacer, masques comme ils le sont dans la vraie page.
  const coque = t.w.document.createElement('div');
  coque.id = 'bureauVentes';
  coque.hidden = true;
  coque.innerHTML = '<div id="p-base" hidden></div><div id="p-reglages" hidden></div>';
  t.w.document.body.appendChild(coque);

  t.poser(lire('bdv-reglages.js'), 'bdv-reglages.js');
  dit(typeof t.w.BdvReglages === 'object', 'le panneau se charge SEUL, sans moteur');
  dit(t.w.BdvReglages.moteurPresent() === false, 'et il sait qu\'il n\'a pas de moteur');

  t.w.BdvReglages.ouvrir();
  await dormir(200);
  dit(!!t.w.document.getElementById('bdvrHoteBase'), 'la modale est montee avec son emplacement « Ma base »');
  dit(t.w.document.getElementById('p-base').parentNode.id === 'bureauVentes',
    'sans moteur, le bloc de la base reste dans la coque : rien a ranger');

  // LE MOTEUR ARRIVE, comme le fait chargerMoteur() dans bdv-nav.js, puis on rafraichit.
  t.poser(lire('bdv-base.js'), 'bdv-base.js');
  t.poser(DECOR, 'decor');
  dit(t.w.BdvReglages.moteurPresent() === true, 'le moteur est la');
  t.w.BdvReglages.rafraichir();
  await dormir(600);

  const pb = t.w.document.getElementById('p-base');
  const pr = t.w.document.getElementById('p-reglages');
  dit(pb.parentNode.id === 'bdvrHoteBase',
    '« Ma base » est RANGEE dans la modale (trouvee dans : ' + pb.parentNode.id + ')');
  dit(pr.parentNode.id === 'bdvrHoteClassement',
    '« Le classement » est range dans la modale (trouve dans : ' + pr.parentNode.id + ')');
  dit(pb.hidden === false, 'et le bloc de la base n\'est plus masque');
  dit(pb.innerHTML.indexOf('dropzoneReg') >= 0,
    'la zone de depot de l\'export est bien dedans : la base est redeposable');
  dit(pb.innerHTML.indexOf('viderBase') >= 0, 'et le bouton « Vider la base » aussi');

  /* LE DRAPEAU VITISOFT DESCEND. Il ne montait qu'a `true` : recocher « oui » laissait le
     refus affiche par-dessus la zone de depot jusqu'au rechargement de la page. */
  t.P('adopterVitisoft("non");');
  dit(t.P('PAS_VITISOFT') === true, 'repondre « non » a Vitisoft leve le drapeau du moteur');
  dit(pb.innerHTML.indexOf('pas-viti') >= 0, 'et « Ma base » affiche le refus');
  t.P('adopterVitisoft("oui");');
  dit(t.P('PAS_VITISOFT') === false, 'repondre « oui » le REDESCEND');
  dit(pb.innerHTML.indexOf('pas-viti') < 0, 'et le refus disparait sans recharger la page');
  dit(pb.innerHTML.indexOf('dropzoneReg') >= 0, 'la zone de depot est revenue');
}

/* ==========================================================================
   4. VIDER LA BASE VIDE AUSSI L'ECRAN
   --------------------------------------------------------------------------
   Le sous-main et l'ardoise du bureau lisent `bdv_file_v1`, la cle de
   bdv-crm.js. viderBase() effacait `bdv_crm_v1` et `bdv_echanges_v1`, les cles
   du moteur, et oubliait celle-la : le bureau continuait donc de peindre un
   chiffre d'affaires tire d'une base effacee, jusqu'au rechargement.
   ========================================================================== */
console.log('\n== 4. Vider la base efface le miroir de la file, et repeint Ma journee ==');
{
  const t = monter({ objectif: 500000, exercice_debut: 4 });
  t.poser(lire('bdv-base.js'), 'bdv-base.js');
  t.poser(DECOR, 'decor');

  let oublis = 0, repeintures = 0;
  t.w.BdvCrm = { oublier: () => { oublis++; }, miroir: () => null };
  t.w.bdvMajJournee = () => { repeintures++; };
  t.w.confirm = () => true;
  t.w.BdvSync.effacerTout = () => Promise.resolve(true);
  t.P('dbClear = async function(){ LOCAL = []; return true; };');

  await t.P('viderBase()');
  dit(oublis === 1, 'viderBase() demande a bdv-crm.js d\'oublier son miroir (' + oublis + ')');
  dit(repeintures >= 1, '« Ma journee » est repeinte sans rechargement (' + repeintures + ')');
  dit(t.P('ROWS.length') === 0, 'et la base du moteur est bien vide');

  /* La cle appartient a bdv-crm.js : le moteur ne doit PAS l'ecrire lui-meme. Un removeItem
     ecrit dans bdv-base.js marcherait aujourd'hui et casserait au premier renommage. */
  dit(lire('bdv-base.js').indexOf('bdv_file_v1') < 0,
    'le moteur ne nomme jamais la cle du miroir : il passe par BdvCrm.oublier()');
  dit(lire('bdv-crm.js').indexOf('function oublier') > 0, 'et oublier() vit bien dans bdv-crm.js');
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DES REGLAGES REFUSE\n'); process.exit(1); }
console.log('  UNE ECRITURE = UNE COLONNE, ET LE PANNEAU VOIT LA BASE DANS LES DEUX ORDRES\n');
