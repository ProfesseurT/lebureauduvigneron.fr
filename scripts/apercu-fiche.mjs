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
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const css = ['_site/css/style.css','_site/css/bdv-ecrans.css']
  .map(f => fs.readFileSync(path.join(RACINE,f),'utf8')).join('\n');

function section(titre, quoi, html){
  return `<h2 class="ap__t">${titre}</h2><p class="ap__q">${quoi}</p>
  <div class="bdv-ventes ap__boite">${html}</div>`;
}
const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>La fiche client, les quatre états</title>
<style>${css}</style>
<style>
  /* LE HARNAIS, ET RIEN QUE LUI. La modale est en position fixe dans la vraie page :
     ici on regarde quatre etats a la suite, donc on la repose dans le flux. Ces
     quelques lignes ne decrivent que la planche, jamais la fiche. */
  body{background:#F3F0E9;margin:0;padding:2rem 1rem;font-family:system-ui,sans-serif}
  .ap__t{font-family:Georgia,serif;margin:2.5rem 0 .2rem}
  .ap__q{margin:0 0 .8rem;color:#5A5346;max-width:60ch}
  .ap__boite{max-width:1020px;margin:0 auto 1rem}
  .ap__boite .modale__box{position:relative;margin:0;max-height:none}
</style></head><body>
<h1 class="ap__t">La fiche client, 11/09/2026</h1>
<p class="ap__q">Quatre états, dans l'ordre où on les rencontre. Rien n'est redessiné à la
main : c'est la vraie fiche, montée par le vrai moteur, avec les vraies feuilles de style.</p>
${section('1. Aucune action prévue','Le bloc neuf : le motif se tape avant la date, et les quatre façons de poser la date le lisent.',S.sansAction)}
${section('2. Un rappel posé, avec son motif','« À rappeler le… », la date modifiable, et en dessous ce qu’on s’était promis.',S.avecRappel)}
${section('3. Ouverte par « Appelé » depuis le sous-main','La phrase d’attente : rien n’est parti tant que rien n’est écrit.',S.appel)}
${section('4. Le rédacteur de message, déplié','Avec « Considéré comme envoyé », à côté d’« Ouvrir dans ma messagerie ».',S.message)}
</body></html>`;

fs.mkdirSync(path.join(RACINE,'_apercu'),{recursive:true});
fs.writeFileSync(path.join(RACINE,'_apercu/fiche.html'), page);
console.log('  ecrit : _apercu/fiche.html  (' + Math.round(page.length/1024) + ' ko)');
/* SORTIE EXPLICITE, meme regle que les bancs. Le DOMContentLoaded de jsdom finit par
   lancer demarrerEcransVente(), qui cherche un IndexedDB que node n'a pas : l'erreur
   arrive APRES l'ecriture du fichier, mais elle laisserait un code de sortie non nul,
   donc un « echec » dans une chaine qui n'a rien rate. */
process.exit(0);
