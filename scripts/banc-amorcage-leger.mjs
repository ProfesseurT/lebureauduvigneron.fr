/* ============================================================================
   scripts/banc-amorcage-leger.mjs : L'AMORCAGE NE CHARGE PLUS LA BASE

     npm run banc:amorcage-leger

   ECRIT LE 18/09/2026, apres Ted : « Je ne veux pas avoir a attendre huit ans des
   que je recharge ma page, pour que ca recolle les bouts. Y'a une BDD derriere qui
   est censee gerer les donnees et les redistribuer correctement. »

   Il avait raison, et c'etait la faute d'architecture du chantier. L'ouverture
   rapatriait les 171 569 lignes du compte, les ecrivait dans IndexedDB, les
   relisait, en derivait 171 569 objets, et tout ca AVANT d'ouvrir quoi que ce
   soit. Un logiciel de gestion ne recopie pas sa base sur le poste a chaque
   ouverture ; il demande ce qu'il affiche.

   CE BANC TIENT LA REGLE : aucune lecture des lignes de vente au demarrage, ni
   sur le reseau, ni dans IndexedDB au-dela d'un comptage. Il ne mesure pas un
   temps : il verifie qu'un travail N'A PAS LIEU, ce qui ne depend d'aucune
   machine.

   ET IL TIENT LE GARDE-FOU LE PLUS DANGEREUX DU LOT : le depot pour « Ma
   journee » parcourt `ROWS`. Le laisser partir a vide ecraserait sur le COMPTE
   le resume qui fait vivre le bureau et le courrier du matin, en y mettant des
   zeros. Une ecriture qui reussit avec de mauvaises donnees ne se plaint jamais.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
const R = path.join(RACINE, 'src/js') + '/';

let ok = 0, ko = 0;
const t = (nom, bon, det) => {
  if (bon) { ok++; console.log('  ok    : ' + nom); }
  else { ko++; console.log('  ECHEC : ' + nom + (det !== undefined ? '  -> ' + det : '')); }
};

const ids = ['app','tbFile','filterbar','p-annee','p-diagnostic','p-clients','p-produits',
  'p-explo','p-explorer','p-reglages','p-base','p-vide','status','statusTxt','statusSpin',
  'busyov','busytxt'];
const dom = new JSDOM('<!doctype html><body>'
  + ids.map(i => `<section class="panel" id="${i}"></section>`).join('')
  + '<button id="bureauMaj" hidden></button>'
  + '</body>', { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w = dom.window;
w.Chart = function(){ this.destroy = () => {}; };
w.Papa = {};

/* Le faux compte. Il NOTE tout ce qu'on lui demande, et c'est tout l'objet du banc :
   une seule lecture de `/ventes` au demarrage suffit a faire echouer le controle. */
const appels = [];
const deposes = [];
w.BdvCompte = {
  monId: () => 'moi', monBureau: () => 'b1', refusDeProprietaire: () => false,
  session: () => ({ user: { id: 'moi' } }),
  porte: () => Promise.resolve(null),
  profil: () => Promise.resolve({ utilise_vitisoft: true }),
  compter: (chemin) => { appels.push('COMPTE ' + chemin); return Promise.resolve(171569); },
  api: (chemin, opts) => {
    appels.push(((opts && opts.methode) || 'GET') + ' ' + chemin);
    /* LES TROIS RESUMES PASSENT PAR `/rpc/resume`, avec la cle en argument, depuis
       qu'ils sont caches cote serveur. Le faux compte doit suivre, sinon il repond
       vide et le banc accuse le code d'un silence qui vient de lui. */
    if (chemin.indexOf('/rpc/resume') === 0 && opts && opts.corps && opts.corps.cle === 'cap')
      return Promise.resolve({ exerciceNum: 2026, precedentNum: 2025, caCoupe: 970959,
        caCoupePrecedent: 993895, variation: -2.3, coupeJour: '31/08/2026', complet: false,
        dernierMois: 8, ca: 970959, atterrissage: 1627963, bas: 1456438, haut: 1627963,
        methode: 'saison', exercice: '2026', moisDebut: 1 });
    if (chemin.indexOf('/reglages') === 0) return Promise.resolve([{ exercice_debut: 1, objectif: 1640000 }]);
    return Promise.resolve([]);
  }
};

const test = `
  /* IndexedDB absente de jsdom : on remplace les DEUX seules portes de la base par des
     espions. Si l'amorcage derive quoi que ce soit, \`dbGetAll\` le dira. */
  var LU = { count: 0, getAll: 0 };
  dbCount = function(){ LU.count++; return Promise.resolve(171569); };
  dbGetAll = function(){ LU.getAll++; return Promise.resolve([]); };
  window.__depots = [];
  if(window.BdvSync) {
    BdvSync.deposerFile = function(f, r){ window.__depots.push(r); return Promise.resolve(true); };
  }

  /* On attend que les promesses du resume soient retombees AVANT de lire l'ecran :
     capAuBesoin() peint une premiere fois sans le resume, puis repeint avec. Lire trop
     tot, c'est mesurer la premiere peinture et conclure que le serveur n'a pas repondu.
     Ma premiere version du banc faisait exactement ca, et accusait le code a tort. */
  window.__demarrage = demarrerEcransVente({ ecran: 'annee' })
    .then(function(){ return new Promise(function(r){ setTimeout(r, 200); }); })
    .then(function(){
      return { lu: LU, capPose: !!CAP, pretes: lignesPretes(),
               capHTML: document.getElementById('p-diagnostic').innerHTML,
               majVisible: !document.getElementById('bureauMaj').hidden,
               majNom: document.getElementById('bureauMaj').getAttribute('aria-label') || '',
               clientsHTML: document.getElementById('p-clients').innerHTML };
    });
`;

try {
  w.eval(fs.readFileSync(R + 'bdv-sync.js', 'utf8') + '\n'
       + fs.readFileSync(R + 'bdv-base.js', 'utf8') + '\n'
       + fs.readFileSync(R + 'bdv-ecrans.js', 'utf8') + '\n' + test);
} catch (e) {
  console.log('ECHEC a l\'execution : ' + e.message);
  console.log((e.stack || '').split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}
const S = await w.__demarrage;

console.log('\n== 1. Aucune ligne de vente n\'est lue au demarrage ==');
const lectures = appels.filter(a => /\/ventes/.test(a));
/* LE CONTROLE CENTRAL. Une seule lecture de `/ventes` ici, et c'est le retour des
   171 569 lignes a chaque ouverture. */
t('aucune lecture de /ventes sur le reseau', lectures.length === 0, lectures.slice(0, 3).join(' | '));
t('aucune derivation : dbGetAll() n\'est pas appelee', S.lu.getAll === 0, S.lu.getAll + ' appel(s)');
/* Le comptage, lui, est la seule lecture locale permise : quelques millisecondes, et il
   repond a « la base est-elle vide ? », que `ROWS.length` ne sait plus dire. */
t('un seul comptage local, pour savoir si la base est vide', S.lu.count === 1, S.lu.count);
/* DEPUIS LE 24/09/2026, le complement ne se propose plus en bas de chaque ecran : il a
   UN bouton, dans l'en-tete, qui n'apparait que quand il sert. On verifie les deux
   moities : la carte a disparu de l'ecran, et le bouton de l'en-tete s'est montre avec
   un nom qui dit ce qui manque. */
t('et rien n\'est propose sans le dire : le bouton de mise a jour se montre',
  S.majVisible === true);
t('son nom accessible dit ce qui manque', /Mettre à jour\. Il manque ici/.test(S.majNom), S.majNom.slice(0, 80));
t('la carte « Charger mes lignes » a disparu de l\'ecran', !/Charger mes lignes/.test(S.capHTML));
t('les lignes ne sont donc PAS pretes', S.pretes === false);

console.log('\n== 2. Mais l\'ecran s\'ouvre quand meme, sur les chiffres du serveur ==');
t('le resume de « Mon cap » a ete demande', appels.some(a => /rpc\/resume/.test(a)));
t('il est pose', S.capPose === true);
t('et le bandeau est peint', /class="hero"/.test(S.capHTML), S.capHTML.slice(0, 80));
t('le chiffre du serveur est a l\'ecran', /970\s?959/.test(S.capHTML.replace(/&nbsp;/g, ' ')));
/* CE QUI N'EST PAS ENCORE CALCULABLE NE S'AFFICHE PAS A ZERO. Afficher « 0 facture,
   0 client » sous un bandeau qui annonce 970 959 euros, c'est mentir en attendant. */
t('les blocs qui lisent les lignes ne sont PAS dessines a zero',
  !/Sur la période affichée/.test(S.capHTML));
/* IL DIT CE QUI MANQUE, ET IL LE NOMME. « Certaines données ne sont pas disponibles »
   n'aide personne : le vigneron doit savoir si ce qui manque est ce qu'il venait voir. */
/* Depuis le 24/09/2026 la phrase vit dans le NOM du bouton de l'en-tete, plus dans
   une carte en bas d'ecran. Meme exigence, autre endroit. */
t('et le bouton nomme ce qui manque', /signaux/.test(S.majNom) && /prix\/volume/.test(S.majNom));
t('et dit que les chiffres affiches, eux, sont a jour', /sont à jour/.test(S.majNom));

console.log('\n== 3. Les autres pieces ne sont pas peintes ==');
t('« Mon commerce » reste vide tant qu\'on n\'y va pas',
  S.clientsHTML.trim().length === 0, S.clientsHTML.slice(0, 60));

console.log('\n== 4. Le depot pour « Ma journee » n\'ecrit PAS de zeros ==');
/* Le garde-fou le plus dangereux du lot. `resumeVentes()` parcourt ROWS ; deposer a
   vide remplacerait sur le compte le resume qui fait vivre le bureau et le courrier
   du matin. Le vigneron verrait son chiffre d'affaires disparaitre, sans une erreur. */
t('aucun depot tant que les lignes ne sont pas chargees', w.__depots.length === 0,
  JSON.stringify(w.__depots[0] || {}).slice(0, 80));

console.log('\n== 5. Les reglages, eux, sont bien lus ==');
/* Quelques centaines d'octets, et tout en depend : sans eux « Mon cap » afficherait
   l'exercice civil a quelqu'un qui ouvre le sien en aout. */
t('les reglages du compte sont demandes', appels.some(a => /\/reglages/.test(a)));

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  L\'AMORCAGE CHARGE ENCORE LA BASE\n'); process.exit(1); }
console.log('  L\'AMORCAGE NE CHARGE PLUS LA BASE\n');
process.exit(0);
