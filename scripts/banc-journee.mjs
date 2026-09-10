/* ============================================================================
   scripts/banc-journee.mjs : le banc de « Ma journee »

     npm run build && npm run banc:journee

   ECRIT LE 08/09/2026, apres un defaut signale par Ted : il a vide sa base et
   son chiffre d'affaires est reste affiche sur l'ardoise, sa file de rappels
   dans le sous-main, jusqu'a ce qu'il recharge la page.

   POURQUOI IL EXISTE A COTE DE banc-bureau.mjs. Celui-la monte la barre a la
   main et n'execute AUCUN script de la page ; il verifie l'enchainement des
   gestes, jamais ce que le plan affiche. Or les zones de « Ma journee » sont
   peintes par le script INLINE de src/mon-bureau.njk, le seul morceau de code
   du bureau qu'aucun banc ne touchait. Le defaut vivait donc exactement dans
   l'angle mort.

   COMMENT IL S'Y PREND. Il charge la page CONSTRUITE dans jsdom en executant
   ses scripts, et pose son faux BdvCrm AVANT l'analyse (crochet beforeParse) :
   c'est la seule facon pour que le script inline le voie, puisqu'il se peint
   pendant l'analyse puis au DOMContentLoaded. Les <script src> ne sont pas
   charges par jsdom, donc BdvNav, BdvSignets et les autres restent absents, ce
   que le script inline gere deja par des gardes. On ne verifie donc ici QUE le
   plan de travail, et c'est le but.

   CE QU'IL NE FAIT PAS. Aucun reseau, aucun chiffre calcule sur un vrai export.
   Il verifie qu'une zone est visible ou cachee, jamais qu'un montant est juste.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(RACINE, '_site/mon-bureau/index.html');

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

let ok = 0, ko = 0;
const t = (nom, cond, detail) => {
  if (cond) { ok++; console.log('  ok    : ' + nom); }
  else { ko++; console.log('  ECHEC : ' + nom + (detail ? '  →  ' + detail : '')); }
};
const titre = (x) => console.log('\n== ' + x + ' ==');
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

console.log('page  : ' + path.relative(RACINE, PAGE));

/* Un etat de file comme le tableau de bord en depose un : un resume de ventes, un client a
   rappeler, et la date du depot. `deposeLe` est ce qui dit « un export a servi une fois ».  */
const ETAT_PLEIN = {
  resume: { ca: 532201, exercice: 'exercice 2026', variation: 4.2, clients: 128, panier: 415,
            conseils: [{ sev: 2, kind: 'info', ico: '!', verdict: 'Trois clients ont decroche.',
                         action: 'Rappelle-les cette semaine.' }] },
  deposeLe: new Date().toISOString(),
  signaux: {}, noms: {}
};

/* Un compte neuf : la lecture a bien abouti, il n'y a simplement rien dedans. */
const VIDE = { signaux: [], noms: {}, resume: null, deposeLe: null, suivi: [],
               reglages: { lus: true, objectif: null, exercice_debut: null } };

/* Le faux BdvCrm. `file()` rend une ligne des qu'il y a un resume : le sous-main a donc de
   quoi peindre dans l'etat plein, et rien dans l'etat vide. */
function fauxCrm(etatCourant) {
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  return {
    // Les trois gestes du sous-main : le listing en fabrique un bouton chacun.
    GESTES: {
      appel:   { label: 'Appelé', court: 'Appelé', jours: 30 },
      message: { label: 'Laissé un message', court: 'Message', jours: 7 },
      ecarte:  { label: 'Pas maintenant', court: 'Écarté', jours: 60 }
    },
    isoLocal: iso,
    aujourdhuiISO: () => iso(new Date()),
    miroir: () => etatCourant(),
    file: (e) => (e && e.resume) ? [{ id: 'JAYAMA', nom: 'Domaine Jayama', source: 'rappel',
                                      retard: 3, motif: 'a rappeler', montant: 1200 }] : [],
    /* charger() rend TOUJOURS un etat quand la lecture a abouti, meme si la ligne de
       reglages est vide : `null` veut dire « la lecture a echoue », et le bureau s'en sert
       pour dire « ta file n'a pas pu etre lue ». Un faux qui rend null sur une base vide
       ferait donc passer un compte neuf pour une panne de reseau, et le sous-main
       resterait a l'ecran pour le dire. Ce piege a coute une passe de ce banc. */
    charger: () => Promise.resolve(etatCourant() || VIDE),
    journal: () => Promise.resolve([]),
    fil: () => Promise.resolve([]),
    geste: () => Promise.resolve(true),
    rejouer: () => Promise.resolve(true)
  };
}

async function monter(etatDepart) {
  let etat = etatDepart;
  const dom = new JSDOM(HTML, {
    url: 'https://lebureauduvigneron.fr/mon-bureau/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      /* UNE SESSION D'ABORD. Le script de la page sort par `if(!connecte) return;` : sans
         session en stockage local il ne peint rien du tout, et un banc qui l'ignore
         verifie une page vide en annoncant que tout va bien. */
      w.localStorage.setItem('bdv_session', JSON.stringify({
        access_token: 'banc', user: { id: 'moi', email: 'ted@exemple.fr' }
      }));
      w.BdvCrm = fauxCrm(() => etat);
    }
  });
  await dormir(120);
  return {
    w: dom.window,
    el: (id) => dom.window.document.getElementById(id),
    poserEtat: (e) => { etat = e; }
  };
}

/* ==========================================================================
   1. UNE BASE DEPOSEE : les deux zones vivent
   ========================================================================== */
titre('1. Un export a ete depose une fois');
{
  const b = await monter(ETAT_PLEIN);
  t('le sous-main porte un identifiant : sans lui, il ne peut pas etre cache',
    !!b.el('zoneSousMain'));
  t('le sous-main est visible', b.el('zoneSousMain') && b.el('zoneSousMain').hidden === false);
  t('et il porte bien une ligne', b.el('bureauFile').innerHTML.indexOf('Jayama') >= 0);
  /* « UNE ECHEANCE DANS -26 JOUR », vu par Ted sur sa vraie page le 10/09/2026. Le
     controle est ecrit en NEGATIF et sans fixture d'echeance expres : il attrape toute
     la classe de defauts, pas le seul cas de ce jour-la. Un futur ne porte jamais de
     signe moins, quelle que soit l'echeance que la page porte au moment du banc. */
  t('la phrase d\'accueil n\'annonce jamais un futur negatif',
    b.el('bureauResume').textContent.indexOf('dans -') < 0,
    b.el('bureauResume').textContent);
  t('l\'ardoise est visible', b.el('zoneArdoise').hidden === false);
  t('et elle porte le chiffre d\'affaires',
    b.el('bureauChiffres').textContent.indexOf('affaires') >= 0);
}

/* ==========================================================================
   2. VIDER LA BASE : les deux zones s'en vont, SANS RECHARGEMENT
   --------------------------------------------------------------------------
   C'est le defaut signale par Ted. peindreArdoise() ne savait que MONTRER la
   zone : ses deux `return` de tete sortaient sans y toucher, donc le dernier
   chiffre connu restait a l'ecran. Au rechargement la zone repartait cachee par
   son attribut de depart, d'ou l'impression, juste, qu'il fallait recharger.
   ========================================================================== */
titre('2. La base est videe pendant que le bureau est ouvert');
{
  const b = await monter(ETAT_PLEIN);
  t('depart : les deux zones sont la',
    b.el('zoneArdoise').hidden === false && b.el('zoneSousMain').hidden === false);

  t('le moteur a un crochet pour repeindre la journee', typeof b.w.bdvMajJournee === 'function');
  // viderBase() efface le miroir (BdvCrm.oublier), puis appelle ce crochet.
  b.poserEtat(null);
  b.w.bdvMajJournee();
  await dormir(60);
  t('l\'ardoise disparait', b.el('zoneArdoise').hidden === true);
  t('et elle ne garde pas ses chiffres en reserve', b.el('bureauChiffres').innerHTML === '');
  t('le sous-main disparait', b.el('zoneSousMain').hidden === true);
  t('et il ne garde pas ses lignes en reserve',
    b.el('bureauFile').innerHTML.indexOf('Jayama') < 0);
  t('le mot du jour disparait aussi', b.el('zoneMot').hidden === true);
  t('la phrase d\'en-tete ne parle plus de clients a rappeler',
    b.el('bureauResume').textContent.indexOf('rappeler') < 0,
    b.el('bureauResume').textContent);
}

/* ==========================================================================
   3. AUCUN EXPORT JAMAIS DEPOSE : le sous-main ne promet rien
   --------------------------------------------------------------------------
   Reponse de Ted du 08/09/2026 a la question « quand la zone s'en va ? » :
   seulement si aucun export n'a jamais ete depose. Un jour ou tout est traite,
   la zone RESTE et dit « Rien a faire aujourd'hui. Profites-en. »
   ========================================================================== */
titre('3. Un bureau tout neuf, et un bureau a jour');
{
  const neuf = await monter(null);
  t('sans aucun depot, le sous-main n\'est pas la', neuf.el('zoneSousMain').hidden === true);
  t('et l\'ardoise non plus', neuf.el('zoneArdoise').hidden === true);

  // Une base deposee, mais plus rien a faire aujourd'hui : la zone reste, avec son message.
  const ajour = await monter({ resume: null, deposeLe: new Date().toISOString(), signaux: {}, noms: {} });
  t('une base deposee et une file vide : le sous-main RESTE',
    ajour.el('zoneSousMain').hidden === false);
  t('et il dit qu\'il n\'y a rien a faire',
    ajour.el('bureauFile').textContent.indexOf('Rien a faire') >= 0
    || ajour.el('bureauFile').textContent.indexOf('Rien à faire') >= 0,
    ajour.el('bureauFile').textContent.slice(0, 60));
  t('l\'ardoise, elle, s\'efface : elle n\'a aucun chiffre a montrer',
    ajour.el('zoneArdoise').hidden === true);
}

/* ==========================================================================
   4. SANS VITISOFT : les deux zones n'ont plus de raison d'etre
   --------------------------------------------------------------------------
   Decision de Ted du 08/09/2026. La file et le resume sont deposes par le
   tableau de bord, qui ne lit qu'un export Vitisoft : sans lui, la promesse est
   vide pour toujours. Meme regle que les pieces de vente retirees de la barre.
   ========================================================================== */
titre('4. Le vigneron repond « non » a Vitisoft');
{
  const b = await monter(ETAT_PLEIN);
  t('depart : les deux zones sont la',
    b.el('zoneArdoise').hidden === false && b.el('zoneSousMain').hidden === false);

  // Le panneau de reglages previent l'hote par surProfil ; ici on emprunte le meme chemin
  // que brancherReglages() lui donne, en repeignant l'identite sur un profil sans Vitisoft.
  t('le bureau expose de quoi rejouer l\'arrivee du profil',
    typeof b.w.bdvProfilLu === 'function');
  if (typeof b.w.bdvProfilLu === 'function') {
    b.w.bdvProfilLu({ prenom: 'Ted', utilise_vitisoft: 'non' });
    await dormir(60);
    t('l\'ardoise s\'en va', b.el('zoneArdoise').hidden === true);
    t('le sous-main s\'en va', b.el('zoneSousMain').hidden === true);
    b.w.bdvProfilLu({ prenom: 'Ted', utilise_vitisoft: 'oui' });
    await dormir(60);
    t('et repondre « oui » les fait revenir, sans rechargement',
      b.el('zoneArdoise').hidden === false && b.el('zoneSousMain').hidden === false);
  }
}

/* ==========================================================================
   5. LE PANNEAU DE LIEGE EST UNE PILE DE TRAVAIL, 10/09/2026
   --------------------------------------------------------------------------
   Demande de Ted : « il y a des KPI qui servent a rien, il faut que ca soit
   cliquable ». Le panneau n'etait couvert par AUCUN banc : c'est exactement
   pour ca que son pire defaut a vecu si longtemps sans etre vu.

   LE DEFAUT QUE CETTE SECTION EXISTE POUR EMPECHER DE REVENIR : le filtre des
   rappels etait `rappel > aujourd'hui`, strictement l'avenir. Une promesse
   faite pour le 3 septembre et pas tenue n'apparaissait nulle part sur le
   liege. Le premier controle ci-dessous est celui-la, et il doit rester le
   premier.
   ========================================================================== */
titre('5. Le panneau : ce qui presse, et cliquable');
{
  const jourDecale = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  };
  /* Trois rappels et trois ages : un en retard de six jours, un pour aujourd'hui,
     un pour dans un mois. Un jeu d'essai plus petit que la realite ne verifie que
     ce qu'il contient — la lecon du 08/09/2026 sur « Mes taches ». */
  const AVEC_RAPPELS = Object.assign({}, ETAT_PLEIN, {
    noms: { JAYAMA: 'Domaine Jayama', BELLEVUE: 'Château Bellevue', PIERRIER: 'Clos du Pierrier' },
    signaux: [],
    suivi: [
      { id: 'JAYAMA',   rappel: jourDecale(-6), statut: 'relance' },
      { id: 'BELLEVUE', rappel: jourDecale(0),  statut: 'relance' },
      { id: 'PIERRIER', rappel: jourDecale(30), statut: 'relance' }
    ]
  });

  const b = await monter(AVEC_RAPPELS);
  await dormir(700);          // le chiffre monte de 0 a sa valeur en 0,42 s
  const p = b.el('bureauPanneau');
  const html = () => p.textContent;

  t('le panneau est visible', b.el('zonePanneau').hidden === false);
  t('IL DIT CE QUI EST EN RETARD (le defaut repare le 10/09/2026)',
    html().indexOf('en retard') >= 0, html().slice(0, 120));
  t('et il nomme le client le plus vieux',
    html().indexOf('Domaine Jayama') >= 0, html().slice(0, 200));
  t('il dit aussi ce qui tombe aujourd\'hui',
    html().indexOf('aujourd’hui') >= 0);
  t('le retard porte bien son compte, une fois le chiffre monte',
    !!p.querySelector('[data-cle="crm-retard"] .postit__v')
    && p.querySelector('[data-cle="crm-retard"] .postit__v').textContent === '1',
    p.querySelector('[data-cle="crm-retard"] .postit__v')
      ? p.querySelector('[data-cle="crm-retard"] .postit__v').textContent : 'punaise absente');

  t('la punaise du retard mene DROIT a la fiche du client, pas a une liste',
    !!p.querySelector('[data-cle="crm-retard"] a.postit__l--lien[href*="#client=JAYAMA"]'));
  t('la prochaine promesse est la, avec son nom',
    html().indexOf('Clos du Pierrier') >= 0 && html().indexOf('prochain rappel') >= 0);

  t('on peut AGIR depuis la punaise : le geste est un bouton, pas un lien',
    p.querySelectorAll('button[data-punaise="crm-appel"]').length > 0);
  t('et aucun bouton n\'est enferme dans un lien (le HTML l\'interdit)',
    p.querySelectorAll('a button, button button').length === 0);

  /* Les deux compteurs qui disaient la MEME chose : « 5 gestes cette semaine » et
     « 1,3 geste par semaine », la seconde etant la premiere divisee par quatre. */
  t('les compteurs ne mangent plus de punaise',
    html().indexOf('gestes par semaine') < 0 && html().indexOf('clients dans ton carnet') < 0,
    html().slice(0, 200));
  t('ils sont passes dans l\'etiquette de la zone',
    b.el('panneauNote').textContent.indexOf('au carnet') >= 0,
    b.el('panneauNote').textContent);
  t('la fraicheur de l\'analyse aussi, tant qu\'elle ne derange pas',
    b.el('panneauNote').textContent.indexOf('analyse du jour') >= 0,
    b.el('panneauNote').textContent);
}

/* ==========================================================================
   5 bis. LA PILE VIDE EST UN MESSAGE, LE BUREAU NEUF EST UN SILENCE
   --------------------------------------------------------------------------
   Deux etats qu'on confond facilement, et qui ne veulent pas dire la meme
   chose. Regle du 08/09/2026 : une zone qui sait se montrer doit savoir se
   cacher, mais elle ne doit pas se cacher quand elle a quelque chose a dire.
   ========================================================================== */
titre('5 bis. Rien a faire, contre rien du tout');
{
  const rienAFaire = await monter(ETAT_PLEIN);   // un export depose, aucun rappel
  await dormir(120);
  t('un export depose et rien qui presse : le panneau RESTE',
    rienAFaire.el('zonePanneau').hidden === false);
  t('et il dit que rien ne presse, plutot que d\'afficher six chiffres',
    rienAFaire.el('bureauPanneau').textContent.indexOf('ne presse') >= 0,
    rienAFaire.el('bureauPanneau').textContent.slice(0, 120));

  const neuf = await monter(null);
  await dormir(120);
  t('un bureau tout neuf : le panneau ne promet rien, il se cache',
    neuf.el('zonePanneau').hidden === true);
  t('et il ne garde pas de punaise en reserve',
    neuf.el('bureauPanneau').innerHTML === '');
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  MA JOURNEE NE FAIT PAS CE QU\'ELLE DIT\n'); process.exit(1); }
console.log('  MA JOURNEE SE VIDE QUAND LA BASE SE VIDE\n');

/* CE BANC NE SORTAIT JAMAIS TOUT SEUL, et personne ne le voyait parce qu'il
   affichait son verdict avant de rester en l'air. La page pose
   `setInterval(peindreLune, 30 minutes)` au DOMContentLoaded : ce minuteur
   appartient a la fenetre jsdom, il tient la boucle d'evenements de node
   ouverte, et `npm run verif` s'arretait la sans un mot d'erreur — un
   enchainement de controles bloque se lit comme un controle qui reflechit.

   On sort donc explicitement, et le code de sortie reste celui du verdict.
   Trouve le 10/09/2026 en ajoutant la section 5. */
process.exit(0);
