/* ============================================================================
   scripts/apercu-fiche.mjs : REGARDER la fiche client, sans compte et sans base

     npm run build && npm run apercu:fiche
     puis ouvrir _apercu/fiche.html

   ECRIT LE 11/09/2026, quand la fiche est devenue le seul endroit ou l'on
   travaille un client : le sous-main n'ecrit plus au clic, il ouvre celle-ci.
   Trois blocs y sont neufs, et aucun ne se voit sans un compte, un export et un
   rappel pose. On les regardait donc en production, ce qui est la plus mauvaise
   facon de juger un dessin, et c'est deja ce qui avait laisse passer un bouton
   de desinscription invisible le 11/09 au matin.

   CE QU'IL FAIT. Il monte le VRAI moteur et les VRAIS ecrans dans jsdom, avec
   des ventes fabriquees, demande la fiche de trois clients dans trois etats,
   et ecrit une page autonome. Les deux feuilles recopiees dedans sont celles
   que la page charge : style.css pour les jetons du site, bdv-ecrans.css pour
   la fiche. PAS tokens.css, qui n'est servi a aucun navigateur : un harnais qui
   ne charge pas exactement ce que la page charge ne verifie rien, il illustre
   une intention.

   CE QU'IL NE VERIFIE PAS. Rien du tout : il ne fait que montrer. Les controles
   de structure sont dans les bancs. Et il ne remplace pas un vrai navigateur
   pour la typographie : jsdom ne dessine pas.

   ET IL LUI MANQUAIT DEUX FEUILLES SUR CINQ JUSQU'AU 22/09/2026. Il posait
   bdv-theme.css, style.css et bdv-ecrans.css, et PAS `bdv-poste.css` ni
   `bdv-bureau.css`. La fiche s'ouvre dans /mon-bureau/, sous `body.bdv-coque`,
   et ces deux feuilles-la portent la coque, les boutons, les champs et les
   rangees qui l'entourent. Il ne posait pas non plus la classe `bdv-coque` : la
   moitie du dessin ne pouvait donc pas s'appliquer, et l'image ressemblait
   quand meme au produit, ce qui est la forme la plus dangereuse du defaut.
   Il passe maintenant par `scripts/apercu-socle.mjs`, qui lit les feuilles
   liees sur la page CONSTRUITE et n'accepte en plus que les feuilles posees par
   du code, ici `bdv-ecrans.css`, APRES elles, comme `bdv-nav.js` le fait dans
   le produit. `npm run banc:apercus` le tient.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { planche, ecrire, motsVides } from './apercu-socle.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
const R = path.join(RACINE, 'src/js') + '/';

const dom = new JSDOM(`<!doctype html><body>
  <div class="filterbar" id="filterbar"></div>
  <section class="panel" id="p-clients"></section>
  <div id="status"></div><div id="statusTxt"></div><div id="statusSpin"></div>
  <div id="busyov"></div><div id="busytxt"></div>
  <div id="modale" class="bdv-ventes modale" aria-hidden="true"></div>
</body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w = dom.window;
w.Chart = function(){ this.destroy=()=>{}; };
w.Papa = {};
// Les canaux sont charges par la page avant tout le reste : le <select> de la saisie et
// les libelles du fil les lisent au rendu.
w.eval(fs.readFileSync(R+'bdv-canaux.js','utf8'));

/* TROIS CLIENTS, TROIS ETATS, et ce sont les trois que Ted verra :
     - MARTIN : aucune action prevue. C'est le bloc neuf, avec son champ de motif.
     - LA PETITE MAISON : un rappel pose, avec son motif.
     - OENOPHIL : ouvert par « Appele », donc avec la phrase d'attente. */
const lignes = [];
const CLIENTS = [['C1','Domaine Martin'],['C2','La Petite Maison'],['C3','Oenophil']];
for (const [id,nom] of CLIENTS){
  for (let i=0;i<14;i++){
    const y = 2025+Math.floor(i/12), m = (i%12)+1;
    lignes.push({famille:'Rouge',couleur:'Rouge',produit:'Cuvée du Clos',client:nom,
      numClient:id,numFacture:'F'+id+i,codeTarif:'T1',millesime:'2024',
      appellation:'AOC Test',conditionnement:'75cl',cp:'44000',ville:'Nantes',pays:'France',
      emails:'contact@'+id.toLowerCase()+'.test',mobile:'06 12 34 56 78',
      _y:y,_m:m,_pu:12,_q:40+i*2,_canal:'Caveau'});
  }
}

const demain = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
const test = `
  ROWS.length = 0;
  JSON.parse(${JSON.stringify(JSON.stringify(lignes))}).forEach(function(o){
    var t = Date.UTC(o._y, o._m-1, 15);
    o._vin = true;
    o._date = {y:o._y, m:o._m, d:15, t:t};
    o._dayNum = Math.floor(t/86400000);
    o._exY = o._y; o._exM = o._m; o._exPos = o._m-1;
    o._qte = o._q; o._total = o._pu * o._q;
    ROWS.push(o);
  });
  computeMeta();
  /* LES CONTACTS SONT POSES A LA MAIN. Ils sont construits par computeContacts() a
     partir des colonnes Emails/Fixe/Mobile de l'export, que ce jeu d'essai n'imite pas :
     sans eux, le bloc « Ecrire un message » ne s'affiche pas du tout, et c'est
     justement l'etat 4 qu'on vient regarder. */
  EMAILS['C1'] = ['contact@domaine-martin.test'];
  TELS['C1'] = [{appel:'+33612345678', affiche:'06 12 34 56 78'}];
  CRM['C2'] = { rappel: ${JSON.stringify(demain)}, rappel_titre: 'Lui reparler du réassort de la cuvée du Clos', statut: 'relance' };
  ECHANGES['C2'] = [{echange_id:'a1',client_id:'C2',le:'2026-09-02T09:00:00.000Z',
                     maj_le:'2026-09-02T09:00:00.000Z',type:'appel',canal:'appel',
                     resume:'Appelé, il rappelle son associé avant de commander.'}];
  var sortie = {};
  function poser(id, cible, geste){
    GESTE_ATTENDU = geste ? {id:id, cle:geste, jours:30, statut:'relance'} : null;
    ouvrirFiche(id, 'recul');
    if(cible === 'message'){
      var d = document.querySelector('#modale details.msg--replie');
      if(d) d.open = true;
    }
    return document.querySelector('#modale .modale__box').outerHTML;
  }
  sortie.sansAction = poser('C1', null, null);
  sortie.avecRappel = poser('C2', null, null);
  sortie.appel      = poser('C3', 'suivi', 'appel');
  sortie.message    = poser('C1', 'message', null);

  /* CINQUIEME ETAT, 14/09/2026 : LE MEME CLIENT DANS UN BUREAU A PLUSIEURS.
     Rien d'autre ne change que l'auteur des lignes, et c'est exactement ce qu'on
     vient regarder : « de Romane » doit se lire sans peser plus que l'heure, et ma
     propre ligne ne doit porter aucun nom. Le trombinoscope est pose a la main, la
     ou la vraie page le tient de la fonction equipe. */
  window.BdvCompte = { mentionAuteur: function(u){
    if(!u || u === 'moi') return null;
    var n = ({ romane: 'Romane', mariel: 'Marie L.' })[u];
    return n ? ('de ' + n) : 'd\u2019un ancien membre';
  } };
  CRM['C2'] = { rappel: ${JSON.stringify(demain)},
                rappel_titre: 'Lui reparler du réassort de la cuvée du Clos',
                statut: 'relance', cree_par: 'romane',
                notes: 'Ne jamais appeler avant 10h, il est au chai.' };
  ECHANGES['C2'] = [
    {echange_id:'a1',client_id:'C2',le:'2026-09-02T09:00:00.000Z',
     maj_le:'2026-09-02T09:00:00.000Z',type:'appel',canal:'appel',cree_par:'romane',
     resume:'Appelé, il rappelle son associé avant de commander.'},
    {echange_id:'a2',client_id:'C2',le:'2026-09-05T09:00:00.000Z',
     maj_le:'2026-09-05T09:00:00.000Z',type:'note',canal:null,cree_par:'mariel',
     resume:'Passé au caveau, reparti avec deux cartons de la cuvée du Clos.'},
    {echange_id:'a3',client_id:'C2',le:'2026-09-09T09:00:00.000Z',
     maj_le:'2026-09-09T09:00:00.000Z',type:'message',canal:'email',cree_par:'moi',
     resume:'Devis envoyé pour le réassort, 18 cartons.'},
    {echange_id:'a4',client_id:'C2',le:'2026-09-11T09:00:00.000Z',
     maj_le:'2026-09-11T09:00:00.000Z',type:'note',canal:null,cree_par:'ancien',
     resume:'Avait demandé une facture séparée pour le restaurant.'}
  ];
  sortie.equipe = poser('C2', null, null);
  window.__SORTIE = sortie;
`;

try {
  w.eval(fs.readFileSync(R+'bdv-base.js','utf8') + '\n'
       + fs.readFileSync(R+'bdv-ecrans.js','utf8') + '\n' + test);
} catch(e) {
  console.error('ECHEC a l\'execution : ' + e.message);
  console.error((e.stack||'').split('\n').slice(0,5).join('\n'));
  process.exit(1);
}

const S = w.__SORTIE;

/* LA FICHE EST UN ECRAN DE VENTE : elle porte `.bdv-ventes`, la portee de
   bdv-ecrans.css, et elle vit dans le bureau, donc sous `bdv-coque`, que le
   socle pose sur le corps de page. La modale est en position fixe dans la vraie
   page ; ici on regarde cinq etats a la suite, donc on la repose dans le flux.
   Ces quelques lignes ne decrivent que la planche, jamais la fiche. */
const vues = [
  { titre: '1. Aucune action prevue',
    note: 'Le bloc neuf : le motif se tape avant la date, et les quatre facons de poser la date le lisent.',
    html: S.sansAction },
  { titre: '2. Un rappel pose, avec son motif',
    note: '« A rappeler le\u2026 », la date modifiable, et en dessous ce qu\u2019on s\u2019etait promis.',
    html: S.avecRappel },
  { titre: '3. Ouverte par « Appele » depuis le sous-main',
    note: 'La phrase d\u2019attente : rien n\u2019est parti tant que rien n\u2019est ecrit.',
    html: S.appel },
  { titre: '4. Le redacteur de message, deplie',
    note: 'Avec « Considere comme envoye », a cote d\u2019« Ouvrir dans ma messagerie ».',
    html: S.message },
  { titre: '5. Le meme client, dans un bureau a plusieurs',
    note: 'Qui a ecrit quoi. « de Romane », « de Marie L. », et ma propre ligne, la troisieme, ne '
        + 'porte aucun nom : sans nom veut dire de moi. La derniere est d\u2019une personne qui a '
        + 'quitte le bureau.',
    html: S.equipe }
];

const page = planche({
  titre: 'La fiche client, 11/09/2026, revue le 22/09/2026',
  intro: 'Cinq etats, dans l\u2019ordre ou on les rencontre. Rien n\u2019est redessine a la main : '
       + 'c\u2019est la vraie fiche, montee par le vrai moteur, avec les quatre feuilles liees du '
       + 'bureau et bdv-ecrans.css, posee apres elles comme bdv-nav.js le fait.',
  enPlus: ['src/css/bdv-ecrans.css'],
  enveloppe: (html) => '<div class="bdv-ventes">' + html + '</div>',
  css: '.ap__b .modale__box{position:relative;margin:0;max-height:none;max-width:none}',
  vues: vues
});

ecrire('fiche.html', page);
/* LE MOT VIDE QUI A COUTE LE PLUS CHER : « domaine NaN \u20ac » s'est affiche sur
   toutes les fiches pendant des jours, et cet apercu le MONTRAIT deja. On ne
   cherche pas « null » : le balisage en porte legitimement dans ses attributs. */
if (motsVides(vues.map(v => v.html), ['NaN', 'undefined', 'Invalid Date', '[object']).length) process.exit(1);
/* SORTIE EXPLICITE, meme regle que les bancs. Le DOMContentLoaded de jsdom finit par
   lancer demarrerEcransVente(), qui cherche un IndexedDB que node n'a pas : l'erreur
   arrive APRES l'ecriture du fichier, mais elle laisserait un code de sortie non nul,
   donc un « echec » dans une chaine qui n'a rien rate. */
process.exit(0);
