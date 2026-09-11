/* ================================================================
   LE BUREAU DU VIGNERON, les ecrans de vente
   ----------------------------------------------------------------
   Sorti de src/outils/dashboard-vigneron.html le 07/09/2026, lot 0 de la
   fusion dans le bureau (voir PLAN_fusion-bureau.md). DEPLACEMENT PUR, comme
   la sortie de bdv-base.js le matin du meme jour : pas une fonction reecrite,
   pas un nom change, le meme ordre. Tout vit dans la meme portee globale
   qu'avant, et continue donc de voir les variables de bdv-base.js.

   L'ORDRE DE CHARGEMENT EST UNE CONDITION, PAS UNE PREFERENCE :
   ce fichier se charge APRES /js/bdv-base.js et SANS defer. Il lit des
   variables declarees la-dedans des son analyse. Lui mettre defer, ou le
   passer avant bdv-base.js, casse le tableau de bord au chargement.

   Au lot 2, /mon-bureau/ chargera ce fichier au premier clic sur un ecran de
   vente, pas a l'ouverture : il pese 2 500 lignes et tire Chart.js et le
   lecteur xlsx derriere lui. Personne ne doit payer ca pour lire une echeance.
   ================================================================ */

/* ================================================================
   LE BUREAU DU VIGNERON, tableau de bord des ventes v4
   Lecture d'un export Vitisoft (CSV windows-1252, separateur ;).
   Cumul persistant (IndexedDB), dedup par empreinte de ligne.
   4 expertises commerciales : reactivation RFM, decrochage YoY,
   rythme a date YoY, mix canal + prix moyen.
   100% front-end, aucune donnee envoyee.
   ================================================================ */

/* Le moteur de la base a demenage dans /js/bdv-base.js le 07/09/2026 : CONFIG, ETAT, le
   journal d'echanges, UTILS, les reglages du domaine, IndexedDB, l'import, la derivation en
   memoire et l'exercice comptable. Deplacement pur, aucune reecriture. Les variables et les
   fonctions restent dans la meme portee globale, tout ce qui suit continue de les voir.
   Il est charge juste avant ce script, sans defer : cet ordre est une condition, pas une
   preference. Voir l'entete de bdv-base.js. */

/* ======================= SELECTION / FENETRES ======================= */
// Lignes vin (CA reel) reduites a la selection temporelle courante.
function vinRows(){
  return ROWS.filter(r=>r._vin && dansSelection(r));
}
// Une ligne tombe-t-elle dans la selection courante ? Exercice puis plage libre, cumulables.
function dansSelection(r){
  if(filters.ex!=null && r._exY!==filters.ex)return false;
  if(filters.from!=null&&(r._dayNum==null||r._dayNum<filters.from))return false;
  if(filters.to!=null&&(r._dayNum==null||r._dayNum>filters.to))return false;
  return true;
}
// Vrai des qu'une plage libre est active. Les blocs comparatifs s'en servent pour dire
// au lecteur qu'ils ne suivent PAS sa plage : sans ca il croit comparer ce qu'il a choisi.
function plageLibre(){return filters.from!=null||filters.to!=null;}
// Bornes en clair. Une borne seule se lit « depuis le » ou « jusqu'au ».
function libelleBornes(a,b){
  const d=a!=null?fmtDate(dayToDate(a)):null, f=b!=null?fmtDate(dayToDate(b)):null;
  if(d&&f)return 'du '+d+' au '+f;
  if(d)return 'depuis le '+d;
  if(f)return "jusqu'au "+f;
  return '';
}
// Le perimetre en clair, pour les sous-titres d'ecran.
function libellePerimetre(){
  const ex=filters.ex!=null?(exMot()+' '+exLabel(filters.ex)):null;
  const pl=plageLibre()?libelleBornes(filters.from,filters.to):null;
  if(ex&&pl)return ex+', '+pl;
  return pl||ex||'toute la base';
}
// Somme d'un accesseur sur un tableau.

// Cadre des comparatifs « a date egale » : exercice courant, exercice precedent, et la
// position la plus avancee atteinte dans le courant. Tout se joue sur _exPos, jamais
// sur le mois civil : c'est ce qui rend un exercice aout-juillet comparable a lui-meme.
function yoyFrame(){
  const xs=META.exercices;if(xs.length<2)return null;
  const cur=xs[xs.length-1],prev=cur-1;
  if(!xs.includes(prev))return null;
  let cut=null,cutPos=-1;
  ROWS.forEach(r=>{if(r._vin&&r._date&&r._exY===cur&&r._exPos>cutPos){cutPos=r._exPos;cut=r._date;}});
  if(!cut)return null;
  return {cur,prev,cutPos,cutM:cut.m,cutD:cut.d,cutDate:cut};
}
// Une ligne est-elle avant le jour de coupe, mesure DANS SON PROPRE exercice ?
// Unique comparateur « a date egale » de l'outil. Remplace l'ancien inWindow(),
// qui codait en dur un depart au 1er janvier.
function avantCoupe(r,cutPos){return r._exPos!=null&&r._exPos<=cutPos;}

/* Conversions entre le champ <input type="date"> (ISO AAAA-MM-JJ) et le jour absolu
   (_dayNum), la seule unite dans laquelle l'outil compare deja des intervalles. */
function jourDepuisISO(v){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v==null?'':v).trim());
  if(!m)return null;
  return Math.floor(Date.UTC(+m[1],+m[2]-1,+m[3])/86400000);
}

/* Raccourcis de periode. Tous comptes depuis la DERNIERE DATE PRESENTE EN BASE, jamais
   depuis aujourd'hui : la base est un historique cumule. Un export charge en septembre
   pour des ventes arretees en juin afficherait sinon trois mois vides, et « 12 derniers
   mois » ne couvrirait que neuf mois de ventes reelles. */
function ancreFin(){return META.max?Math.floor(Date.UTC(META.max.y,META.max.m-1,META.max.d)/86400000):null;}
// Premier jour du mois situe n mois avant le mois de la derniere date en base.
// Date.UTC normalise un mois negatif, donc le passage d'annee est gratuit.
function jourMoisRecule(n){
  if(!META.max)return null;
  return Math.floor(Date.UTC(META.max.y,META.max.m-1-n,1)/86400000);
}

/* ======================= APP / NAV =======================
   NAV N'EST PLUS UNE NAVIGATION. Depuis le lot 2d du 07/09/2026, la barre du bureau
   est la seule navigation, et elle vit dans src/js/bdv-nav.js. Ce qui reste ici est la
   liste des ecrans que CE fichier sait rendre, avec leurs libelles : navTo() s'en sert
   pour nommer l'ecran courant, et demarrerEcransVente() pour refuser une adresse qui ne
   designe aucun ecran.

   LES IDENTIFIANTS DOIVENT RESTER LES MEMES QUE CEUX DE bdv-nav.js. C'est le seul lien
   entre les deux fichiers, et il n'est tenu par aucun mecanisme : `npm run banc` compare
   les deux listes et echoue si elles divergent. Ajouter un ecran, c'est donc l'ajouter
   aux deux endroits, dans le meme commit. */
const NAV=[
  // « Mon cap » depuis le 11/09/2026, lot 4 : le nom pose la question a laquelle la piece
  // repond, au lieu de nommer une periode. Et il ne varie plus avec l'exercice comptable.
  {id:'annee',   ico:'&#128200;', label:'Mon cap'},
  {id:'clients', ico:'&#128101;', label:'Mon commerce'},
  // « Mes cuvees » et plus « Mes produits » depuis le 11/09/2026 : la barre du bureau disait
  // deja « Mes cuvees », et le titre de l'ecran disait autre chose. Deux noms pour une piece.
  {id:'produits',ico:'&#127863;', label:'Mes cuvées'},
  // « Mon registre » et plus « Chercher » depuis le 11/09/2026, lot 3 : meme correction
  // qu'aux cuvees, la barre du bureau et l'ecran ne disaient pas la meme chose.
  {id:'chercher',ico:'&#128301;', label:'Mon registre'},
  // « Ma base » et « Réglages » ont fusionné le 07/09/2026. Ce ne sont plus deux écrans de
  // l'outil mais deux blocs du panneau partagé avec le bureau : une seule entrée, qui ouvre.
  {id:'reglages',ico:'⚙',        label:'Réglages', panneau:true}
];
// NAV_BUREAU a disparu au lot 2d. C'etait le pied du volet : quatre liens vers les autres
// pieces du bureau, pour ne pas etre enferme dans l'outil. On n'est plus enferme : ces
// pieces sont dans la barre du bureau, a cote de celles-ci, au meme rang.
/* ---------------- LE PANNEAU DE REGLAGES, PARTAGE AVEC LE BUREAU ----------------
   Les deux <div> sont DEPLACES dans le panneau, pas recopies : renderBase(),
   renderReglages() et bindZoneDepot() continuent d'ecrire au meme endroit, sans une ligne
   de changee. C'est ce qui rend cette fusion tenable sur un fichier de 4 400 lignes.

   `large` parce qu'on y verse une grille de compteurs et deux tableaux : le bureau, qui
   n'y met que du formulaire, garde le panneau etroit. */
let REG_BRANCHE=false;
function brancherPanneauReglages(){
  if(REG_BRANCHE||!window.BdvReglages)return;
  // Pas de barre haute, pas de bouton a brancher : au bureau c'est l'entete du bureau qui
  // porte « Me deconnecter », et il prend son garde-fou de son cote. Sortir ici plutot que
  // de passer un null a brancherSortie evite d'avoir a se demander, dans le module, quelle
  // page l'appelle.
  if(!el('tbSortir'))return;
  REG_BRANCHE=true;
  // PLUS DE BLOCS CONTRIBUES ICI. Depuis que bdv-base.js est charge par les deux pages, le
  // panneau monte lui-meme « Ma base » et « Le classement », deplace nos deux <div> chez lui,
  // et emmene leur feuille de style. Les deux modales sont donc identiques par construction
  // et non par recopie : il n'y a plus deux versions a tenir d'accord.
  // Le meme garde-fou de deconnexion qu'au bureau, ecrit une seule fois dans le module.
  BdvReglages.brancherSortie(el('tbSortir'),null);
}
function ouvrirPanneauReglages(){
  brancherPanneauReglages();
  if(window.BdvReglages)BdvReglages.ouvrir();
  else navTo('vide');   // module absent : au moins la zone de depot n'est pas hors d'atteinte
}
function openApp(ecranDepart){
  el('app').classList.add('on');
  el('tbFile').textContent=fmtNum(ROWS.length)+' lignes'+(META.min?' · '+fmtDate(META.min)+' au '+fmtDate(META.max):'');
  /* Le volet de gauche a disparu au lot 2d, avec son pied et avec le menu de secours de la
     barre haute. Ces trois-la existaient parce que cette page etait un lieu ou l'on entrait
     et dont il fallait pouvoir sortir. La barre du bureau tient ce role, elle est toujours
     la, et elle ne se replie jamais a zero : il n'y a plus de sortie a prevoir. */
  buildFilterBar();
  // Base vide : on ouvre quand meme, sur « Ma base ». renderAll() n'a rien a calculer et
  // certains ecrans se construisent mal sur zero ligne ; on ne l'appelle donc pas.
  if(!ROWS.length){ navTo('vide'); ouvrirPanneauReglages(); return; }
  // Ecran d'accueil : « Mon annee ». Ce qu'il y a A FAIRE vit dans /mon-bureau/ depuis le
  // 06/09/2026 ; ici on analyse, on ne travaille pas sa file.
  runBusy('Analyse de tes ventes…',()=>{renderAll();navTo(ecranDepart||'annee');});
}
/* ---------------- LE VOLET A DEMENAGE ----------------
   Le volet de navigation, sa preference de repli (cle bdv_volet_replie) et le raccourci
   crochet ouvrant vivent dans src/js/bdv-nav.js depuis le lot 1. La cle est la meme : ce
   n'est pas une reprise, c'est la meme preference, pour la meme barre. */

/* Chart.js dimensionne un canvas au moment ou il le cree. Un canvas cree
   pendant que la grille est encore en train de bouger nait a 0 de large et y
   reste. On observe donc la zone de contenu et on redimensionne apres coup :
   ca couvre le repli, le depli, le redimensionnement de la fenetre, et le
   temps que met la grille a se poser au premier rendu. */
let _tRedim=null;
function redimGraphiques(){
  clearTimeout(_tRedim);
  _tRedim=setTimeout(()=>{try{Object.values(charts).forEach(c=>c&&c.resize());}catch(e){}},120);
}
if(window.ResizeObserver){
  new ResizeObserver(redimGraphiques).observe(document.querySelector('.content'));
}
/* Le menu de secours de la barre haute a disparu au lot 2d. Il existait pour une raison
   precise : le volet se repliait a ZERO, et replier enfermait alors le vigneron dans
   l'ecran ou il se trouvait. La barre du bureau garde ses icones en se repliant, donc il
   n'y a plus rien a rattraper. C'etait la difference assumee du lot 1, et voici ce
   qu'elle achete : quatre fonctions et deux ecouteurs de document en moins. */

// Ne sort plus de l'application : le depot de fichier est un ecran comme un autre.
function showImport(){ ouvrirPanneauReglages(); }
function navTo(id){
  /* LE REPERAGE VIT DANS LA BARRE DU BUREAU. Trois endroits le portaient avant le lot 2d :
     le volet, le menu de secours et le libelle de la barre haute. Un seul le porte
     maintenant, et il n'est pas dans ce fichier. navTo est appele aussi de l'interieur des
     ecrans (un filtre, un lien de fiche) : sans cette ligne, la barre resterait sur la
     piece precedente alors que l'ecran a change. */
  if(window.BdvNav && BdvNav.marquerActif) BdvNav.marquerActif(id);
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('on',p.id==='p-'+id||p.id==='p-'+id+'-panel'));
  // Le filtre annees n'a pas de sens sur "Ma base" (toujours tout l'historique) : on le masque.
  el('filterbar').style.display = (id==='annee') ? 'flex' : 'none';
  /* MON REGISTRE SE REPEINT A L'ARRIVEE, depuis le 11/09/2026 : il porte une courbe, et
     renderAll() l'a peinte alors que le panneau etait masque, donc dans un canvas haut de
     zero pixel. Chart.js n'y dessine rien de visible et ne s'en plaint pas. Un seul clic,
     un seul recalcul : c'est moins cher que de surveiller la taille du conteneur. */
  if(id==='chercher'&&ROWS.length)renderExplo();
  window.scrollTo(0,0);
  // L'ecran s'ecrit dans l'adresse. Trois consequences voulues : le bureau peut pointer
  // droit sur « Mes clients », le bouton Retour du navigateur circule dans l'outil, et un
  // vigneron peut mettre un ecran en favori. replaceState et pas pushState au premier
  // rendu : ouvrir l'outil ne doit pas ajouter une entree d'historique par ecran traverse.
  try{
    if(location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  }catch(e){}
}
// Le bouton Retour du navigateur ramene sur l'ecran precedent plutot que de sortir de l'outil.
window.addEventListener('hashchange', function(){
  const id = (location.hash || '').replace('#','');
  if(id.indexOf('client=') === 0){
    if(el('app').classList.contains('on')) ouvrirFiche(decodeURIComponent(id.slice(7)));
    return;
  }
  // #base et #parametres sont les adresses d'avant la fusion, et le bureau pointe encore
  // dessus. Elles ouvrent le panneau plutot que de ne rien faire : une adresse mise en
  // favori par un vigneron n'a pas a mourir parce qu'on a reorganise nos ecrans.
  if(id === 'base' || id === 'parametres' || id === 'reglages'){
    if(el('app').classList.contains('on')) ouvrirPanneauReglages();
    return;
  }
  if(!id || !NAV.some(n => n.id === id)) return;
  if(el('app').classList.contains('on')) navTo(id);
});
/* La barre de periode. Trois familles de choix, separees par un filet, dans l'ordre ou
   on s'en sert : l'exercice entier (la maille des comparatifs), les fenetres glissantes,
   puis les dates a la main. Le perimetre effectif est reecrit en clair a droite, parce
   qu'un filtre qu'on ne voit plus est un chiffre qu'on lit de travers. */
function buildFilterBar(){
  const chip=(actif,action,txt)=>`<span class="chip ${actif?'on':''}" onclick="${action}">${txt}</span>`;
  const perso=filters.preset==='perso';
  let h=`<span class="filterbar__label">Période</span>`;
  h+=chip(filters.preset==='tous',"setExercice(null)","Tout l'historique");
  META.exercices.forEach(y=>h+=chip(filters.preset==='ex'+y,`setExercice(${y})`,esc(exLabel(y))));
  if(META.max){
    h+=`<span class="filterbar__sep"></span>`;
    h+=chip(filters.preset==='12m',"setPeriode('12m')",'12 derniers mois');
    h+=chip(filters.preset==='3m',"setPeriode('3m')",'3 derniers mois');
    h+=chip(filters.preset==='1m',"setPeriode('1m')",'Dernier mois');
  }
  h+=`<span class="filterbar__sep"></span>`;
  h+=chip(perso,"setPeriode('perso')",'Dates précises…');
  if(perso){
    const mn=isoDepuisDate(META.min),mx=isoDepuisDate(META.max);
    h+=`<span class="filterbar__dates">
      <label>du <input type="date" value="${isoDepuisJour(filters.from)}" min="${mn}" max="${mx}" onchange="setBorne('from',this.value)"></label>
      <label>au <input type="date" value="${isoDepuisJour(filters.to)}" min="${mn}" max="${mx}" onchange="setBorne('to',this.value)"></label>
    </span>`;
  }
  const rel=(filters.preset==='12m'||filters.preset==='3m'||filters.preset==='1m');
  h+=`<span class="filterbar__scope" title="${rel?'Fenêtre comptée depuis la dernière date présente en base, pas depuis aujourd\'hui.':''}">${esc(libellePerimetre())}${rel?' · depuis la fin de ta base':''}</span>`;
  el('filterbar').innerHTML=h;
}
// Un exercice entier. Il efface toute plage libre : les deux ensemble n'ont pas de sens
// pour le lecteur, qui ne saurait plus si le chiffre affiche est celui de l'exercice.
function setExercice(y){
  filters={ex:y,from:null,to:null,preset:y==null?'tous':('ex'+y)};
  buildFilterBar();runBusy('Analyse…',renderAll);
}
// Fenetres glissantes et bascule vers la saisie manuelle.
function setPeriode(p){
  const fin=ancreFin();
  filters={ex:null,from:null,to:null,preset:p};
  if(p==='12m'){filters.from=jourMoisRecule(11);filters.to=fin;}
  else if(p==='3m'){filters.from=jourMoisRecule(2);filters.to=fin;}
  else if(p==='1m'){filters.from=jourMoisRecule(0);filters.to=fin;}
  buildFilterBar();runBusy('Analyse…',renderAll);
}
// Bornes saisies au jour. On remet dans l'ordre plutot que de refuser : un vigneron qui
// tape la fin avant le debut veut voir l'intervalle, pas lire un message d'erreur.
function setBorne(quelle,v){
  const d=jourDepuisISO(v);
  if(quelle==='from')filters.from=d;else filters.to=d;
  if(filters.from!=null&&filters.to!=null&&filters.from>filters.to){
    const t=filters.from;filters.from=filters.to;filters.to=t;
  }
  filters.preset='perso';
  buildFilterBar();runBusy('Analyse…',renderAll);
}
function renderAll(){
  /* Mon annee : TROIS panneaux, et c'en etait quatre. Le panneau Canaux est parti dans
     « Mes cuvees » le 11/09/2026, lot 2 : le chemin de vente et le prix moyen repondent a
     « ce qui part, et a quel prix », qui est la question de cette piece-la. */
  renderCap();
  /* LES TROIS APPELS FANTOMES SONT PARTIS LE 11/09/2026 (lot 5). Le commentaire disait
     « calculent et memorisent » : ils ne calculaient rien. Les calculs sont dans les agents,
     que `agentClients()` appelle lui-meme pour composer la liste de « Mon commerce ». Ces
     trois-la ne faisaient que peindre des tableaux dans des conteneurs masques. */
  renderClients();renderProduits();
  renderExplo();renderReglages();renderBase();
  deposerPourLeBureau();   // le bureau sert cette file, le tableau de bord ne l'affiche plus
}

function destroyChart(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
function histCourtNote(){return (PROFIL&&PROFIL.moisCouverts&&PROFIL.moisCouverts<24)?` Historique court (${PROFIL.moisCouverts} mois) : comparatifs annuels à prendre avec prudence.`:'';}
function exComplet(){return EX_START===1?'année complète':'exercice complet';}
function incompleteNote(){const f=yoyFrame();return (f?`Comparaison à date égale : même rang dans chaque ${exMot()}, soit le ${String(f.cutD).padStart(2,'0')}/${String(f.cutM).padStart(2,'0')}. ${exLabel(f.cur)} arrêté au ${fmtDate(f.cutDate)}.`:'')+histCourtNote();}

/* ======================= AXES + MESURE (Apercu) ======================= */
function deptFromCP(cp){const s=String(cp||'').replace(/\D/g,'');return s.length>=2?s.slice(0,2):'';}
const AXES=[
  {key:'famille',label:'Famille',get:r=>r.famille},
  {key:'codeTarif',label:'Code tarif',get:r=>r.codeTarif},
  // Nom d'abord, et c'est voulu : c'est une ETIQUETTE lue par le vigneron, pas une identite.
  // L'identite passe par clientKey(), qui met le numero devant. Ne pas aligner l'une sur l'autre.
  {key:'client',label:'Client',get:r=>r.client||r.numClient},
  {key:'couleur',label:'Couleur',get:r=>r.couleur},
  {key:'_canal',label:'Canal de vente',get:r=>r._canal},
  {key:'appellation',label:'Appellation',get:r=>r.appellation},
  {key:'millesime',label:'Millésime',get:r=>r.millesime},
  {key:'conditionnement',label:'Conditionnement',get:r=>r.conditionnement},
  {key:'commercial',label:'Commercial',get:r=>r.commercial},
  {key:'vendeur',label:'Vendeur',get:r=>r.vendeur},
  {key:'origine',label:'Origine (acquisition)',get:r=>r.origine},
  {key:'triPerso1',label:'Campagne (tri perso)',get:r=>r.triPerso1},
  {key:'pays',label:'Pays',get:r=>r.pays},
  {key:'ville',label:'Ville',get:r=>r.ville},
  {key:'_dept',label:'Département',get:r=>deptFromCP(r.cp)},
  {key:'_annee',label:'Année',get:r=>exLabel(r._exY)},   // libelle ajuste dans usableAxes()
  {key:'_mois',label:'Mois',get:r=>r._date?(r._date.y+'-'+String(r._date.m).padStart(2,'0')):''}
];
const PERSO_KEYS=['persoProduit1','persoProduit2','persoProduit3','persoProduit4','persoProduit5','persoClient1','persoClient2','persoClient3','persoClient4','persoClient5','persoClient6','persoClient7','persoClient8','persoClient9'];
function defaultPersoLabel(key){const m=key.match(/^perso(Client|Produit)(\d)$/);return m?('Perso '+(m[1]==='Client'?'client':'produit')+' '+m[2]):key;}
function persoLabel(key){return (persoLabels[key]&&persoLabels[key].trim())?persoLabels[key].trim():defaultPersoLabel(key);}
// Un champ est exploitable s'il a plus d'une valeur non vide (sinon masque : vide ou constant).
function fieldUsable(get){const s=new Set();for(let i=0;i<ROWS.length;i++){const r=ROWS[i];if(!r._vin)continue;const v=get(r);if(v!==''&&v!=null){s.add(String(v));if(s.size>1)return true;}}return false;}
function usableAxes(){
  // Le libelle de l'axe temps suit le reglage : « Annee » sur un exercice civil, « Exercice » sinon.
  const std=AXES.filter(a=>fieldUsable(a.get)).map(a=>(a.key==='_annee'&&EX_START!==1)?Object.assign({},a,{label:'Exercice'}):a);
  const perso=PERSO_KEYS.filter(k=>fieldUsable(r=>r[k])).map(k=>({key:k,label:persoLabel(k),get:r=>r[k],perso:true}));
  return {std,perso,all:[...std,...perso]};
}
function axisDef(key){const {all}=usableAxes();return all.find(a=>a.key===key)||all[0]||AXES[0];}
// Hiérarchie des critères par nature (ordre d'affichage dans les listes déroulantes).
const AXIS_CATS=[
  {label:'Produit et vin',keys:['famille','couleur','appellation','millesime','conditionnement']},
  {label:'Client',keys:['client']},
  {label:'Commercial et prix',keys:['codeTarif','_canal','commercial','vendeur']},
  {label:'Géographie',keys:['pays','_dept','ville']},
  {label:'Acquisition',keys:['origine','triPerso1']},
  {label:'Temps',keys:['_annee','_mois']}
];
function axisOpt(a,sel){return `<option value="${a.key}"${sel===a.key?' selected':''}>${esc(a.label)}</option>`;}
// Construit des <optgroup> par nature à partir d'une liste d'axes std (+ perso).
function catOptions(std,perso,sel,withNone){
  let h=withNone?`<option value=""${sel===''?' selected':''}>(aucun)</option>`:'';
  const used=new Set();
  AXIS_CATS.forEach(cat=>{const items=cat.keys.map(k=>std.find(a=>a.key===k)).filter(Boolean);items.forEach(a=>used.add(a.key));if(items.length)h+=`<optgroup label="${cat.label}">`+items.map(a=>axisOpt(a,sel)).join('')+`</optgroup>`;});
  const rest=std.filter(a=>!used.has(a.key));
  if(rest.length)h+=`<optgroup label="Autres critères">`+rest.map(a=>axisOpt(a,sel)).join('')+`</optgroup>`;
  if(perso&&perso.length)h+=`<optgroup label="Champs perso Vitisoft">`+perso.map(a=>axisOpt(a,sel)).join('')+`</optgroup>`;
  return h;
}
function mesureVal(r){return uiMesure==='ca'?r._total:r._qte;}
function fmtMes(v){return uiMesure==='ca'?fmtMoney(v):fmtNum(v);}
function mesureLabel(){return uiMesure==='ca'?'CA HT':'Bouteilles / cols';}
function groupSum(rows,get){const m={};rows.forEach(r=>{let k=get(r);k=(k===''||k==null)?'(non renseigné)':String(k);m[k]=(m[k]||0)+mesureVal(r);});return m;}
function topEntries(m,n){const arr=Object.entries(m).sort((a,b)=>b[1]-a[1]);if(arr.length<=n)return arr;const top=arr.slice(0,n);top.push(['Autres',arr.slice(n).reduce((s,e)=>s+e[1],0)]);return top;}
function allEntries(m){return Object.entries(m).sort((a,b)=>b[1]-a[1]);}
function topKeys(m,n){const arr=Object.entries(m).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);return arr.length<=n?arr:arr.slice(0,n).concat(['Autres']);}
function isTimeAxis(k){return k==='_mois'||k==='_annee';}
function chronoEntries(m){return Object.entries(m).filter(([k])=>k!=='(non renseigné)'&&k!=='').sort((a,b)=>a[0]<b[0]?-1:(a[0]>b[0]?1:0));}
function axisKeys(key,m,n){return isTimeAxis(key)?chronoEntries(m).map(e=>e[0]):Object.entries(m).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);}
function barListHTML(entries){
  const max=entries.length?Math.max(...entries.map(e=>e[1]),0):0;
  const tot=entries.reduce((s,e)=>s+e[1],0);
  return `<div class="rep">`+entries.map(([k,v])=>{
    const w=max>0?Math.max(0,v/max*100):0, pct=tot>0?v/tot*100:0;
    return `<div class="rep__row"><div class="rep__bar"><div class="rep__fill" style="width:${w.toFixed(1)}%"></div><div class="rep__lbl">${esc(k)}</div></div><div class="rep__val">${fmtMes(v)} <span class="rep__pct">${fmtNum(pct,0)}%</span></div></div>`;
  }).join('')+`</div>`;
}
/* `repCard()` est morte le 11/09/2026 avec les « Repartitions detaillees » de l'apercu
   (par famille, par code tarif), devenues deux boutons « Vues rapides » de « Mon registre ».
   Une carte figee qui ne repond qu'a une question vaut moins qu'un menu qui en pose treize. */

/* ======================= APERCU (3 couches) ======================= */
/* « APERCU DES VENTES » A DISPARU LE 11/09/2026, lot 4, absorbee par renderCap().

   Ce n'etait plus un ecran, c'etait la moitie basse d'un autre : « Mon annee » affichait
   le panneau Diagnostic puis le panneau Apercu, l'un sous l'autre, avec DEUX titres, DEUX
   sous-titres, et le meme chiffre d'evolution ecrit de deux facons a quatre cents pixels
   d'ecart. C'est le doublon qui a ouvert toute la redecoupe.

   Ce qu'elle avait et que renderCap() a repris : le bandeau de comparaison a date (le
   verdict de la piece), les cinq compteurs de la periode affichee, la bascule CA /
   bouteilles, la courbe des mois, et le garde-fou anti-ecran-vide.

   drawApMonth() n'a pas bouge. */
// Serie mensuelle d'un exercice, rangee dans l'ordre DE L'EXERCICE (case 0 = mois d'ouverture).
function apMonthly(ex){const a=new Array(12).fill(0);for(const r of ROWS){if(!r._vin||r._exY!==ex||r._exM==null)continue;a[r._exM-1]+=mesureVal(r);}return a;}
function drawApMonth(){
  destroyChart('chApMonth');const ctx=el('chApMonth');if(!ctx)return;const xs=META.exercices;if(!xs.length)return;
  const cur=filters.ex!=null?filters.ex:xs[xs.length-1],prev=xs.includes(cur-1)?cur-1:null;
  const ds=[{label:exLabelCourt(cur),data:apMonthly(cur),borderColor:cssToken('--bordeaux'),backgroundColor:aireBordeaux(),fill:true,tension:.3,borderWidth:2,pointRadius:2}];
  if(prev)ds.push({label:exLabelCourt(prev),data:apMonthly(prev),borderColor:cssToken('--muted'),backgroundColor:'transparent',borderDash:[5,4],fill:false,tension:.3,borderWidth:1.5,pointRadius:0});
  charts.chApMonth=new Chart(ctx,{type:'line',data:{labels:exMoisLabels(),datasets:ds},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:!!prev,position:'bottom',labels:{boxWidth:10,font:{size:10}}},tooltip:{callbacks:{label:c=>c.dataset.label+' : '+fmtMes(c.parsed.y)}}},scales:{y:{ticks:{callback:v=>fmtNum(v)}}}}});
}
/* LA REPARTITION PAR COULEUR A CHANGE DE PIECE le 11/09/2026 : de l'apercu de « Mon annee »
   au pied replie de « Mes cuvees ».

   ELLE LIT TOUTE LA BASE, EN CA HT, et ne prend plus `rows` : meme raison que le pied de
   « Mon commerce ». La barre de periode et la bascule CA / bouteilles ne s'affichent que
   sur l'ecran « annee ». Passer par vinRows() et mesureVal() depuis ici aurait donne un
   camembert calcule sur deux reglages qu'on ne peut pas voir d'ou on le regarde. */
function drawCouleur(){
  destroyChart('chApDonut');const ctx=el('chApDonut');if(!ctx)return;
  const m={};
  ROWS.forEach(r=>{if(!r._vin)return;const k=(r.couleur===''||r.couleur==null)?'(non renseigné)':String(r.couleur);m[k]=(m[k]||0)+r._total;});
  const entries=allEntries(m).filter(e=>e[1]>0);
  const pal=palSeries(8);
  charts.chApDonut=new Chart(ctx,{type:'doughnut',data:{labels:entries.map(e=>e[0]),datasets:[{data:entries.map(e=>e[1]),backgroundColor:pal,borderWidth:1,borderColor:cssToken('--white')}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{boxWidth:10,font:{size:10}}},tooltip:{callbacks:{label:c=>c.label+' : '+fmtMoney(c.parsed)}}}}});
}
function setMesure(m){uiMesure=m;runBusy('Analyse…',renderAll);}
function axisGetByKey(k){const a=axisDef(k);return a?a.get:(r=>r[k]);}
function exploRows(){
  return ROWS.filter(r=>{
    if(!r._vin)return false;
    if(exploEx!=null&&r._exY!==exploEx)return false;
    if(exploFrom!=null&&(r._dayNum==null||r._dayNum<exploFrom))return false;
    if(exploTo!=null&&(r._dayNum==null||r._dayNum>exploTo))return false;
    for(const k in exploFilters){const v=exploFilters[k];if(!v)continue;const av=axisGetByKey(k)(r);if(String(av==null?'':av)!==v)return false;}
    return true;
  });
}
function distinctVals(getf){const s=new Set();for(let i=0;i<ROWS.length;i++){const r=ROWS[i];if(!r._vin)continue;const v=getf(r);if(v!==''&&v!=null)s.add(String(v));}return [...s].sort((a,b)=>a.localeCompare(b,'fr'));}
function setExploFilter(k,v){if(v==='')delete exploFilters[k];else exploFilters[k]=v;runBusy('Analyse…',renderExplo);}
function setExploEx(v){exploEx=(v===''?null:+v);runBusy('Analyse…',renderExplo);}
// Bornes de l'Explorer, saisies au jour. C'est ici que se traitent les « dates bien precises » :
// cet ecran n'a aucun moteur comparatif, donc une plage quelconque n'y fausse rien.
function setExploBorne(quelle,v){
  const d=jourDepuisISO(v);
  if(quelle==='from')exploFrom=d;else exploTo=d;
  if(exploFrom!=null&&exploTo!=null&&exploFrom>exploTo){const t=exploFrom;exploFrom=exploTo;exploTo=t;}
  runBusy('Analyse…',renderExplo);
}
function setExploAxis(w,v){if(w===1)exploAxis1=v;else exploAxis2=v;runBusy('Analyse…',renderExplo);}
// Retire un seul filtre depuis sa pastille, sans toucher aux autres.
function retirerFiltre(k){
  if(k==='__ex')exploEx=null;else if(k==='__plage'){exploFrom=null;exploTo=null;}else delete exploFilters[k];
  runBusy('Analyse…',renderExplo);
}
function resetExplo(){exploFilters={};exploEx=null;exploFrom=null;exploTo=null;runBusy('Analyse…',renderExplo);}
function toggleExploFilters(btn){exploShowFilters=!exploShowFilters;const m=el('moreFilters');if(m)m.classList.toggle('hidden');if(btn){btn.textContent=exploShowFilters?'Masquer les critères':'Affiner la sélection';btn.setAttribute('aria-expanded',String(exploShowFilters));}}
function optsExplo(sel,withNone){const {std,perso}=usableAxes();return catOptions(std,perso,sel,withNone);}
function renderExplo(){
  const p=el('p-explorer');if(!p)return;
  const {std,perso}=usableAxes();
  if(!axisDef(exploAxis1))exploAxis1='famille';
  const rows=exploRows(),base=ROWS.filter(r=>r._vin);
  const a1=axisDef(exploAxis1);

  let html=`<h2 class="panel__title">Mon registre</h2><div class="panel__sub">Choisis ce que tu veux voir, affine si besoin, le résultat se met à jour en dessous. Répartis par mois ou par ${EX_START===1?'année':'exercice'} et la courbe apparaît. Mesure : ${mesureLabel()}.</div>`;

  /* ---------- BARRE DE PILOTAGE, en haut ----------
     Quatre reglages seulement sont visibles en permanence : ils suffisent a repondre a la
     plupart des questions. Les dix-neuf facettes restent derriere un bouton, mais les filtres
     ACTIFS, eux, sont toujours affiches en pastilles : sans ca, le vigneron ne sait plus ce
     qu'il regarde et croit voir toute sa base alors qu'il en voit un quart. */
  html+=`<div class="pilote">
    <div class="pilote__row">
      <div class="field"><label>Répartir par</label><select onchange="setExploAxis(1,this.value)">${optsExplo(exploAxis1,false)}</select></div>
      <div class="field"><label>Croiser avec</label><select onchange="setExploAxis(2,this.value)">${optsExplo(exploAxis2,true)}</select></div>
      <div class="field"><label>${EX_START===1?'Année':'Exercice'}</label><select onchange="setExploEx(this.value)"><option value=""${exploEx==null?' selected':''}>Tous</option>${META.exercices.map(y=>`<option value="${y}"${exploEx===y?' selected':''}>${exLabel(y)}</option>`).join('')}</select></div>
      <div class="field field--dates"><label>Du au</label><div class="field--dates__pair">
        <input type="date" value="${exploFrom!=null?isoDepuisJour(exploFrom):''}" min="${META.min?isoDepuisDate(META.min):''}" max="${META.max?isoDepuisDate(META.max):''}" onchange="setExploBorne('from',this.value)">
        <span>→</span>
        <input type="date" value="${exploTo!=null?isoDepuisJour(exploTo):''}" min="${META.min?isoDepuisDate(META.min):''}" max="${META.max?isoDepuisDate(META.max):''}" onchange="setExploBorne('to',this.value)">
      </div></div>
      <div class="field"><label>Mesure</label><span class="toggle"><button class="${uiMesure==='ca'?'on':''}" onclick="setMesure('ca')">CA</button><button class="${uiMesure==='btl'?'on':''}" onclick="setMesure('btl')">Bouteilles</button></span></div>
    </div>`;

  // Ce qui est actif, en clair, et retirable d'un clic.
  const actifs=[];
  if(exploEx!=null)actifs.push({k:'__ex',lbl:EX_START===1?'Année':'Exercice',val:exLabel(exploEx)});
  if(exploFrom!=null||exploTo!=null)actifs.push({k:'__plage',lbl:'Dates',val:libelleBornes(exploFrom,exploTo)});
  Object.keys(exploFilters).forEach(k=>{
    const a=[...std,...perso].find(x=>x.key===k);
    actifs.push({k,lbl:a?a.label:k,val:exploFilters[k]});});

  html+=`<div class="pilote__row pilote__row--sec">
      <button class="btn btn--ghost btn--sm" onclick="toggleExploFilters(this)" aria-expanded="${exploShowFilters}">${exploShowFilters?'Masquer les critères':'Affiner la sélection'}</button>
      ${actifs.map(f=>`<button class="fchip" onclick="retirerFiltre('${f.k}')" title="Retirer ce filtre">
        <span class="fchip__l">${esc(f.lbl)}</span>${esc(f.val)}<span class="fchip__x">&times;</span></button>`).join('')}
      ${actifs.length>1?`<button class="btn btn--ghost btn--sm" onclick="resetExplo()">Tout effacer</button>`:''}
      <span class="pilote__count">${fmtNum(rows.length)} ligne(s) sur ${fmtNum(base.length)} · ${fmtMoney(sum(rows,r=>r._total))}</span>
    </div>`;

  // Les facettes : repliees par defaut, elles ne poussent plus le resultat hors de l'ecran.
  const fSel=a=>{const vals=distinctVals(a.get),cur=exploFilters[a.key]||'';return `<div class="field"><label>${esc(a.label)}</label><select onchange="setExploFilter('${a.key}',this.value)"><option value=""${cur===''?' selected':''}>(tous)</option>${vals.map(v=>`<option value="${esc(v)}"${cur===v?' selected':''}>${esc(v)}</option>`).join('')}</select></div>`;};
  const stdF=std.filter(a=>!isTimeAxis(a.key)),usedF=new Set();let facetHtml='';
  AXIS_CATS.forEach(cat=>{if(cat.label==='Temps')return;const items=cat.keys.map(k=>stdF.find(a=>a.key===k)).filter(Boolean);items.forEach(a=>usedF.add(a.key));if(items.length)facetHtml+=`<div class="facet-cat"><div class="facet-cat__lbl">${cat.label}</div><div class="expl-ctrls">`+items.map(fSel).join('')+`</div></div>`;});
  const restF=stdF.filter(a=>!usedF.has(a.key));
  if(restF.length)facetHtml+=`<div class="facet-cat"><div class="facet-cat__lbl">Autres critères</div><div class="expl-ctrls">`+restF.map(fSel).join('')+`</div></div>`;
  if(perso.length)facetHtml+=`<div class="facet-cat"><div class="facet-cat__lbl">Champs perso Vitisoft</div><div class="expl-ctrls">`+perso.map(fSel).join('')+`</div></div>`;
  html+=`<div id="moreFilters" class="pilote__facets ${exploShowFilters?'':'hidden'}">${facetHtml}</div>`;

  /* LES VUES RAPIDES remplacent les deux « repartitions detaillees » de l'apercu de « Mon
     annee » (par famille, par code tarif), parties le 11/09/2026. C'etaient deux
     croisements figes, affiches sans qu'on les demande. Ce sont maintenant deux boutons
     qui reglent le menu du dessus : meme resultat, et onze autres criteres a cote. */
  const VUES=[{k:'famille',l:'Par famille'},{k:'codeTarif',l:'Par code tarif'},
              {k:'_canal',l:'Par canal de vente'},{k:'_mois',l:'Par mois'},{k:'client',l:'Par client'}];
  const dispo=VUES.filter(v=>std.some(a=>a.key===v.k));
  if(dispo.length)html+=`<div class="pilote__row pilote__row--sec">
      <span class="pilote__count" style="margin:0">Vues rapides</span>
      ${dispo.map(v=>`<button class="btn btn--ghost btn--sm" onclick="setExploAxis(1,'${v.k}')">${v.l}</button>`).join('')}
    </div>`;
  html+=`</div>`;

  /* ---------- REPARTIR PAR UN TEMPS : LA COURBE ET LA LECTURE EXPERTE ----------
     Lot 3 du 11/09/2026. C'est tout ce que l'ecran « Evolution dans le temps » avait de
     plus que celui-ci, et il n'avait rien d'autre : segmenter, lire un tableau periode par
     periode et exporter etaient deja ici, en plus souple.

     LE PAS DE TEMPS N'EST PLUS UN REGLAGE. « Mensuel / Annuel » etait une bascule de
     l'ancien ecran ; c'est maintenant « Repartir par Mois » ou « Repartir par Annee », qui
     existait deja dans ce menu. Un reglage de moins pour exactement la meme chose.

     ET LA SELECTION S'APPLIQUE ENFIN AUX DEUX. L'ancien ecran ignorait la periode choisie
     en vue annuelle, et le disait dans une note en bas de tableau. Ici, les dates et les
     dix-neuf facettes valent pour la courbe comme pour le tableau : on voit ce qu'on a
     demande, sans exception a retenir. */
  let lecture=[],dessin=null;
  if(isTimeAxis(exploAxis1)){
    const a2=exploAxis2?axisDef(exploAxis2):null;
    const cle=r=>{const v=a1.get(r);return (v===''||v==null)?'':String(v);};
    const setP=new Set();rows.forEach(r=>{const k=cle(r);if(k)setP.add(k);});
    const periods=[...setP].sort();
    if(periods.length){
      const bySeg={},segTot={};
      rows.forEach(r=>{
        const k=cle(r);if(!k)return;
        let seg=a2?a2.get(r):'Total';seg=(seg===''||seg==null)?'(non renseigné)':String(seg);
        if(!bySeg[seg])bySeg[seg]={};
        bySeg[seg][k]=(bySeg[seg][k]||0)+mesureVal(r);
        segTot[seg]=(segTot[seg]||0)+mesureVal(r);
      });
      const segs=Object.keys(segTot).sort((x,y)=>segTot[y]-segTot[x]);
      const totByPeriod=periods.map(k=>segs.reduce((a,s)=>a+((bySeg[s]&&bySeg[s][k])||0),0));
      lecture=evoCommentaire(periods,segs,bySeg,segTot,totByPeriod,a2?a2.get:null,
                             exploAxis1==='_mois'?'mois':'annee',a2?a2.label:'');
      const dense=!!a2&&segs.length>12;
      dessin={periods:periods,segs:segs,bySeg:bySeg,multi:!!a2,dense:dense,totByPeriod:totByPeriod};
      // ETAGE 1 : un seul verdict, la tendance de fond. Les sept autres sont replies en bas.
      if(lecture.length)html+=`<div class="section-label">Ce que dit la courbe</div>`+lecture[0];
      html+=`<div class="card"><div class="card__title"><span>${a2?('Évolution par '+esc(a2.label.toLowerCase())):'Évolution du total'}</span></div><div class="chart-wrap"><canvas id="chEvo"></canvas></div>${dense?`<p class="note">${segs.length} segments : trop pour un graphe lisible, la courbe montre le total. Le détail par segment est dans le tableau ci-dessous.</p>`:''}</div>`;
    }
  }

  /* ---------- LE RESULTAT ---------- */
  html+=`<div class="card"><div class="card__title"><span>${esc(a1.label)}${exploAxis2?' croisé avec '+esc(axisDef(exploAxis2).label):''}</span><span><button class="btn btn--ghost btn--sm" onclick="exportExplo('xlsx')">Exporter Excel</button> <button class="btn btn--ghost btn--sm" onclick="exportExplo('csv')">CSV</button></span></div>`;
  if(!exploAxis2){
    let entries=isTimeAxis(exploAxis1)?chronoEntries(groupSum(rows,a1.get)):allEntries(groupSum(rows,a1.get));
    entries=entries.map(e=>[libAxe(exploAxis1,e[0]),e[1]]);
    html+=entries.length?barListHTML(entries):`<p class="note">Aucune donnée sur cette sélection.</p>`;
  }else{
    const a2=axisDef(exploAxis2);
    const rowKeys=axisKeys(exploAxis1,groupSum(rows,a1.get),8),colKeys=axisKeys(exploAxis2,groupSum(rows,a2.get),8);
    const rowSet=new Set(rowKeys),colSet=new Set(colKeys);
    const cell={},rowTot={},colTot={};let grand=0;
    rows.forEach(r=>{let rk=a1.get(r);rk=(rk===''||rk==null)?'(non renseigné)':String(rk);if(!rowSet.has(rk))rk='Autres';let ck=a2.get(r);ck=(ck===''||ck==null)?'(non renseigné)':String(ck);if(!colSet.has(ck))ck='Autres';const v=mesureVal(r);cell[rk]=cell[rk]||{};cell[rk][ck]=(cell[rk][ck]||0)+v;rowTot[rk]=(rowTot[rk]||0)+v;colTot[ck]=(colTot[ck]||0)+v;grand+=v;});
    const rk2=rowKeys.filter(k=>rowTot[k]),ck2=colKeys.filter(k=>colTot[k]);
    html+=`<div style="overflow-x:auto"><table class="heat"><thead><tr><th class="rowh">${esc(a1.label)} \ ${esc(a2.label)}</th>${ck2.map(c=>`<th>${esc(libAxe(exploAxis2,c))}</th>`).join('')}<th>Total</th></tr></thead><tbody>`;
    rk2.forEach(rkey=>{html+=`<tr><td class="rowh">${esc(libAxe(exploAxis1,rkey))}</td>${ck2.map(c=>`<td>${(cell[rkey]&&cell[rkey][c])?fmtMes(cell[rkey][c]):'-'}</td>`).join('')}<td>${fmtMes(rowTot[rkey])}</td></tr>`;});
    html+=`<tr><td class="rowh"><b>Total</b></td>${ck2.map(c=>`<td>${fmtMes(colTot[c])}</td>`).join('')}<td>${fmtMes(grand)}</td></tr>`;
    html+=`</tbody></table></div><p class="note">Mesure : ${mesureLabel()}. Toutes les valeurs affichées, sans regroupement.</p>`;
  }
  html+=`</div>`;

  /* ETAGE 3 : les sept autres signaux, replies. Les poser tous en haut, c'etait refaire
     « Mon annee » dans une piece de plus : sept verdicts avant de voir sa courbe. */
  if(lecture.length>1)html+=`<div class="card"><details class="msg--replie">
    <summary>La lecture experte, en détail</summary>${lecture.slice(1).join('')}</details></div>`;

  p.innerHTML=html;

  /* LE DESSIN VIENT APRES L'ECRITURE, toujours : le canvas doit exister. Et cette piece est
     peinte par renderAll() alors qu'elle est encore masquee, ou un canvas a une hauteur de
     zero ; c'est navTo() qui rappelle renderExplo() a l'arrivee, panneau visible. */
  if(dessin){
    if(dessin.dense){const tot={};dessin.periods.forEach((k,i)=>tot[k]=dessin.totByPeriod[i]);drawEvo(dessin.periods,['Total'],{Total:tot},false);}
    else drawEvo(dessin.periods,dessin.segs,dessin.bySeg,dessin.multi);
  }
}

function renamePerso(key,val){
  const v=(val||'').trim();
  if(v)persoLabels[key]=v; else delete persoLabels[key];
  savePersoLabels();
  renderCap();
}

/* ======================= VUE EVOLUTION (le film dans le temps) ======================= */
// Cle de période selon le pas de temps choisi : 'AAAA' (annuel) ou 'AAAA-MM' (mensuel).
/* `periodKey()` est partie avec l'ecran Evolution : elle lisait `evoStep`, et l'axe
   `_mois` de AXES fabrique la meme cle depuis toujours. periodLabel(), elle, reste : la
   courbe et la lecture experte s'en servent pour ecrire « mars 2026 » et pas « 2026-03 ».
*/
// Mois en toutes lettres : les abreges de MOIS_FR (« juil. ») ne se mettent pas dans une phrase.
function periodLabel(k){if(/^\d{4}-\d{2}$/.test(k)){const y=k.slice(0,4),m=+k.slice(5,7);return MOIS_FR[m-1]+' '+y;}return k;}
/* AFFICHER UNE CLE D'AXE. Pour un axe de temps, « 2026-03 » s'ecrit « mars 2026 » ; pour
   tous les autres, la cle est deja le mot. Ajoute le 11/09/2026 : en fusionnant l'ecran
   Evolution dans le registre, les mois du tableau croise revenaient en « 2026-03 », parce
   que l'ancien tableau passait par periodLabel() et pas celui-ci. Un banc jetable l'a
   attrape ; aucun controle du depot ne regardait ce texte-la. */
function libAxe(axe,k){return isTimeAxis(axe)?periodLabel(k):k;}
/* `evoRows()` et `evoDimGet()` sont parties avec l'ecran Evolution. La premiere disait
   « en vue annuelle, ignore la periode choisie », une exception que le registre n'a pas
   besoin d'avoir : ses filtres valent pour tout ce qu'il affiche, courbe comprise. */
/* ======================= LECTURE EXPERTE (commentaire auto de la vue Evolution) ======================= */
function _mean(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:0;}
function _stdev(a){if(a.length<2)return 0;const m=_mean(a);return Math.sqrt(_mean(a.map(x=>(x-m)*(x-m))));}
function _slope(a){const n=a.length;if(n<2)return 0;const mx=(n-1)/2,my=_mean(a);let num=0,den=0;for(let i=0;i<n;i++){num+=(i-mx)*(a[i]-my);den+=(i-mx)*(i-mx);}return den?num/den:0;}
/* ELLE REND UN TABLEAU DE SIGNAUX, et plus une chaine, depuis le 11/09/2026 (lot 3).

   Motif : « Mon registre » pose le PREMIER signal en verdict, bien visible, et replie les
   sept autres. Une chaine unique ne se coupe pas en deux. Le `section-label` est sorti
   d'ici pour la meme raison : c'est l'appelant qui sait sous quel titre il les range.

   ELLE NE LIT PLUS NI `evoStep` NI `evoDim`, qui etaient les reglages de l'ecran Evolution.
   Ces deux-la ont disparu avec lui : le pas de temps est devenu le choix « Repartir par
   Mois » ou « Repartir par Annee » du registre, et la dimension son « Croiser avec ».
   D'ou les deux parametres `pas` et `dimLabel`, qui disent la meme chose sans dependre
   d'un ecran. */
function evoCommentaire(periods,segs,bySeg,segTot,totByPeriod,dimGet,pas,dimLabel){
  const n=periods.length;if(!n)return [];
  const grand=totByPeriod.reduce((s,v)=>s+v,0),avg=grand/n;
  const pw=pas==='annee'?exMot():'mois',pwpl=pas==='annee'?(exMot()+'s'):'mois';
  const dimLbl=dimGet?String(dimLabel||'').toLowerCase():'';
  const lbl=i=>periodLabel(periods[i]);
  const out=[];

  // 1. Tendance de fond
  if(n>=2){
    const first=totByPeriod[0],last=totByPeriod[n-1];
    const d=first?(last-first)/Math.abs(first)*100:null;
    const sl=_slope(totByPeriod),seuil=Math.max(1,Math.abs(avg)*0.02);
    const trend=sl>seuil?'orientée à la hausse':(sl<-seuil?'orientée à la baisse':'globalement stable');
    const k=d==null?'info':(d>=0?'ok':'warn'),ic=d==null?'≈':(d>=0?'↗':'↘');
    out.push(signal(k,ic,`Tendance de fond ${trend} : ${fmtMes(first)} en ${lbl(0)} vers ${fmtMes(last)} en ${lbl(n-1)}${d==null?'':' ('+fmtPct(d)+')'}.`,`Pente moyenne ${sl>=0?'+':'-'}${fmtMes(Math.abs(sl))} par ${pw} sur ${n} ${pwpl}. Moyenne par ${pw} : ${fmtMes(avg)}.`));
  }else{
    out.push(signal('info','≈',`Une seule ${pw} dans la sélection (${lbl(0)}) : ${fmtMes(grand)}.`,`Ajoute de l'historique pour dégager une tendance.`));
  }

  // 2. Pic / creux
  if(n>=2){
    let iMax=0,iMin=0;totByPeriod.forEach((v,i)=>{if(v>totByPeriod[iMax])iMax=i;if(v<totByPeriod[iMin])iMin=i;});
    const ratio=totByPeriod[iMin]>0?totByPeriod[iMax]/totByPeriod[iMin]:null;
    out.push(signal('info','◆',`Meilleur ${pw} : ${lbl(iMax)} (${fmtMes(totByPeriod[iMax])}). Plus faible : ${lbl(iMin)} (${fmtMes(totByPeriod[iMin])}).`,ratio?`Rapport de ${fmtNum(ratio,1)} entre le haut et le bas de la période.`:`Le point bas est à zéro ou négatif.`));
  }

  // 3. Momentum du dernier point
  if(n>=3){
    const last=totByPeriod[n-1],prev=totByPeriod[n-2];
    const dp=prev?(last-prev)/Math.abs(prev)*100:null,above=last>=avg;
    out.push(signal(dp==null?'info':(dp>=0?'ok':'warn'),dp>=0?'▲':'▼',`Dernier ${pw} (${lbl(n-1)})${dp==null?'':(dp>=0?' en accélération de ':' en repli de ')+fmtPct(dp)+' vs le '+pw+' précédent'}, ${above?'au-dessus':'en dessous'} de la moyenne (${fmtMes(avg)}).`,`Le dernier point ${above?'confirme plutôt':'contraste avec'} le niveau moyen : à surveiller sur le ${pw} suivant.`));
  }

  // 4. Concentration entre segments
  if(dimGet&&segs.length>=2){
    const shares=segs.map(x=>segTot[x]).filter(v=>v>0).sort((a,b)=>b-a);
    const tot=shares.reduce((s,v)=>s+v,0);
    if(tot>0){
      const top1=shares[0]/tot*100,top3=shares.slice(0,3).reduce((s,v)=>s+v,0)/tot*100;
      let cum=0,pareto=0;for(const v of shares){cum+=v;pareto++;if(cum/tot>=0.8)break;}
      const hhi=shares.reduce((s,v)=>s+Math.pow(v/tot*100,2),0);
      const niveau=hhi>2500?'très concentré':(hhi>1500?'modérément concentré':'plutôt réparti');
      out.push(signal(hhi>2500?'warn':'info','▤',`Concentration : répartition ${niveau}. Le 1er ${dimLbl} pèse ${fmtNum(top1,0)}% du total, le top 3 ${fmtNum(top3,0)}%.`,`${pareto} ${dimLbl}${pareto>1?'s':''} sur ${shares.length} font 80% du total. ${hhi>2500?'Dépendance à surveiller : un décrochage ferait mal.':'Base assez équilibrée.'}`));
    }
  }

  // 5. Moteurs / freins + contribution a la variation
  if(dimGet&&n>=2&&segs.length>=2){
    const deltas=segs.map(x=>{const o=bySeg[x];return {s:x,d:((o&&o[periods[n-1]])||0)-((o&&o[periods[0]])||0)};});
    const risers=deltas.filter(x=>x.d>0).sort((a,b)=>b.d-a.d),fallers=deltas.filter(x=>x.d<0).sort((a,b)=>a.d-b.d);
    const emerging=deltas.filter(x=>{const o=bySeg[x.s];return ((o&&o[periods[0]])||0)===0&&((o&&o[periods[n-1]])||0)>0;}).map(x=>x.s);
    const vanish=deltas.filter(x=>{const o=bySeg[x.s];return ((o&&o[periods[0]])||0)>0&&((o&&o[periods[n-1]])||0)===0;}).map(x=>x.s);
    const totDelta=totByPeriod[n-1]-totByPeriod[0];
    let parts=[];
    if(risers.length)parts.push(`tiré vers le haut par <b>${esc(risers[0].s)}</b> (+${fmtMes(risers[0].d)})`);
    if(fallers.length)parts.push(`pénalisé par <b>${esc(fallers[0].s)}</b> (-${fmtMes(Math.abs(fallers[0].d))})`);
    let act=[];
    if(risers.length&&totDelta>0)act.push(`${esc(risers[0].s)} explique ${fmtNum(risers[0].d/totDelta*100,0)}% de la hausse`);
    if(emerging.length)act.push(`nouveau${emerging.length>1?'x':''} : ${emerging.slice(0,3).map(esc).join(', ')}`);
    if(vanish.length)act.push(`disparu${vanish.length>1?'s':''} : ${vanish.slice(0,3).map(esc).join(', ')}`);
    if(parts.length)out.push(signal('info','⇅',`Le total est ${parts.join(', et ')}.`,act.length?act.join(' · ')+'.':`Compare les segments qui montent et ceux qui refluent dans le tableau.`));
  }

  // 6. Saisonnalite (vue mensuelle)
  if(pas==='mois'&&n>=6){
    const byM={},cM={};periods.forEach((p,i)=>{const mm=+p.slice(5,7);byM[mm]=(byM[mm]||0)+totByPeriod[i];cM[mm]=(cM[mm]||0)+1;});
    const avgM={};for(const mm in byM)avgM[mm]=byM[mm]/cM[mm];
    const arr=Object.keys(avgM).map(Number);let pk=arr[0],tr=arr[0];arr.forEach(mm=>{if(avgM[mm]>avgM[pk])pk=mm;if(avgM[mm]<avgM[tr])tr=mm;});
    const cv=avg?_stdev(totByPeriod)/Math.abs(avg)*100:0;
    out.push(signal('info','◷',`Saisonnalité : pic en ${MOIS_FR[pk-1]}, creux en ${MOIS_FR[tr-1]}. Variabilité ${cv>40?'forte':(cv>20?'modérée':'faible')} (CV ${fmtNum(cv,0)}%).`,`${cv>40?'Anticipe la trésorerie autour des creux et charge les actions commerciales avant les pics.':'Mois assez réguliers, peu d\'à-coups saisonniers.'}`));
  }

  // 7. Qualite : poids du non renseigne
  if(dimGet){
    const nr=segTot['(non renseigné)'];
    if(nr&&grand>0&&nr/grand>0.05)out.push(signal('warn','⚑',`${fmtNum(nr/grand*100,0)}% du total tombe dans « (non renseigné) » sur ${dimLbl}.`,`Fiabilise la saisie de ce champ dans Vitisoft pour une lecture nette.`));
  }
  return out;
}

/* « EVOLUTION DANS LE TEMPS » A DISPARU LE 11/09/2026, lot 3 de la redecoupe, et ses
   deux reglages `setEvoDim` / `setEvoStep` avec elle.

   CE N'ETAIT PAS UN DOUBLON, c'etait un recouvrement. Elle partageait avec « Mon registre »
   le tableau periode par periode et les exports, mais elle avait deux choses a elle : la
   COURBE et la LECTURE EXPERTE (huit signaux calcules : tendance et sa pente, pic et creux,
   momentum du dernier point, concentration par indice de Herfindahl, moteurs et freins,
   saisonnalite, poids du non renseigne). Le registre, lui, avait dix-neuf facettes, la
   plage de dates libre et le croisement de deux criteres quelconques.

   Ce sont ces deux choses-la, et elles seules, qui ont demenage dans renderExplo(). Le
   reste de cette fonction ne faisait que refaire, en moins souple, ce que le registre
   savait deja : `evoStep` est devenu « Repartir par Mois / Annee », `evoDim` est devenu
   « Croiser avec ». Deux reglages de moins, aucune fonction perdue.

   drawEvo() et evoCommentaire() n'ont PAS bouge : elles sont appelees depuis le registre,
   avec les memes cles de periode. C'est ce qui a rendu la fusion possible en une seule
   passe : `periodKey()` et l'axe `_mois` fabriquaient deja exactement le meme format. */
function drawEvo(periods,segs,bySeg,multi){
  destroyChart('chEvo');
  const ctx=el('chEvo');if(!ctx)return;
  const pal=palSeries(7);
  const labels=periods.map(p=>periodLabel(p));
  const datasets=segs.map((seg,i)=>({label:seg,data:periods.map(p=>(bySeg[seg]&&bySeg[seg][p])||0),borderColor:multi?pal[i%pal.length]:cssToken('--bordeaux'),backgroundColor:multi?pal[i%pal.length]:aireBordeaux(),borderWidth:2,tension:.25,fill:!multi,pointRadius:2,pointHoverRadius:4}));
  charts.chEvo=new Chart(ctx,{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:multi,position:'bottom',labels:{boxWidth:10,font:{size:10}}},tooltip:{callbacks:{label:c=>c.dataset.label+' : '+fmtMes(c.parsed.y)}}},scales:{y:{ticks:{callback:v=>fmtNum(v)}}}}});
}

/* ======================= DIAGNOSTIC (agents statistiques) ======================= */
// Objectif de CA annuel, memorise dans le navigateur.
/* `setObjectif()` est morte le 11/09/2026 avec le champ qui l'appelait. L'objectif se
   saisit dans « Mes réglages », onglet « Tes ventes », qui passe par `majObjectif()` du
   moteur : meme cle de navigateur, meme ecriture en base, et une seule fois. */

// AGENT A : atterrissage de l'annee en cours (projection fin d'annee).
function computeAtterrissage(){
  const xs=META.exercices;if(!xs.length)return null;
  const cur=xs[xs.length-1];
  const curRows=ROWS.filter(r=>r._vin&&r._exY===cur);
  if(!curRows.length)return null;
  // Mois ecoules DANS l'exercice (_exM), pas dans l'annee civile : sur un exercice
  // aout-juillet, un export arrete en septembre vaut 2 mois connus, pas 9.
  let maxM=0;curRows.forEach(r=>{if(r._exM>maxM)maxM=r._exM;});
  const done=sum(curRows,r=>r._total);
  if(maxM>=12)return{cur,complete:true,total:done};
  const prev=cur-1,hasPrev=xs.includes(prev);
  const linear=maxM?done*(12/maxM):done;
  let central,low,high,method;
  if(hasPrev){
    const prevYTD=sum(ROWS.filter(r=>r._vin&&r._exY===prev&&r._exM<=maxM),r=>r._total);
    const prevFull=sum(ROWS.filter(r=>r._vin&&r._exY===prev),r=>r._total);
    const seasonal=prevYTD>0?done/prevYTD*prevFull:linear;
    central=seasonal;low=Math.min(seasonal,linear);high=Math.max(seasonal,linear);method='saison';
  }else{central=linear;low=done;high=linear;method='lineaire';}
  return{cur,complete:false,months:maxM,done,central,low,high,method};
}

// AGENT B : serie mensuelle et indice de saisonnalite.
function monthlySeries(){
  const m={};ROWS.forEach(r=>{if(!r._vin||!r._date)return;const k=r._date.y*100+r._date.m;m[k]=(m[k]||0)+r._total;});
  return Object.keys(m).map(Number).sort((a,b)=>a-b).map(k=>({y:Math.floor(k/100),m:k%100,v:m[k]}));
}
function seasonalIndex(series){
  const byM={},cnt={};let tot=0,n=0;
  series.forEach(p=>{byM[p.m]=(byM[p.m]||0)+p.v;cnt[p.m]=(cnt[p.m]||0)+1;tot+=p.v;n++;});
  const avg=n?tot/n:0,idx={};
  for(let mm=1;mm<=12;mm++)if(cnt[mm]){const a=byM[mm]/cnt[mm];idx[mm]=avg?a/avg:1;}
  return{idx};
}

// AGENT C : decomposition effet prix / effet volume (N vs N-1 a date egale).
function computePriceVolume(){
  const f=yoyFrame();if(!f)return null;
  function agg(y){let ca=0,q=0;ROWS.forEach(r=>{if(!r._vin||!r._date)return;if(r._exY!==y)return;if(!avantCoupe(r,f.cutPos))return;ca+=r._total;q+=r._qte;});return{ca,q};}
  const A=agg(f.cur),B=agg(f.prev);
  if(A.q<=0||B.q<=0)return null;
  const P0=B.ca/B.q,P1=A.ca/A.q;
  return{cur:f.cur,prev:f.prev,P0,P1,volEff:(A.q-B.q)*P0,priceEff:(P1-P0)*A.q,delta:A.ca-B.ca};
}

// AGENT D : pont de contribution par client (nouveaux / hausse / baisse / perdus).
function computeBridge(){
  const f=yoyFrame();if(!f)return null;
  const by={};
  ROWS.forEach(r=>{if(!r._vin||!r._date)return;if(!avantCoupe(r,f.cutPos))return;if(r._exY!==f.cur&&r._exY!==f.prev)return;
    const id=clientKey(r);let c=by[id];if(!c)c=by[id]={nom:r.client||id,cur:0,prev:0};
    if(r._exY===f.cur)c.cur+=r._total;else c.prev+=r._total;});
  let nw=0,up=0,down=0,lost=0;const movers=[];
  Object.values(by).forEach(c=>{const d=c.cur-c.prev;
    if(c.prev<=0&&c.cur>0)nw+=c.cur;
    else if(c.cur<=0&&c.prev>0)lost+=(c.cur-c.prev);
    else if(d>=0)up+=d;else down+=d;
    if(Math.round(d)!==0)movers.push([c.nom,d]);});
  movers.sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  return{cur:f.cur,prev:f.prev,nw,up,down,lost,delta:nw+up+down+lost,movers};
}

// Synthese du bridge, en tete du Diagnostic. Quatre mouvements qui bouclent sur le total :
// chaque euro de variation est dans exactement une ligne, un client ne peut pas etre a la fois
// perdu et en baisse. C'est ce qui en fait une lecture fiable, et pas une opinion de plus.
function bridgeHero(){
  const br=computeBridge();
  if(!br){
    return `<div class="section-label">D'où vient ta variation</div>`+
      signal('info','ℹ','Décomposition indisponible.',`Il faut deux ${exMot()}s comparables dans la base pour savoir si ton chiffre bouge parce que tu gagnes des clients ou parce que tu en perds. Ajoute un export couvrant le précédent.`);
  }
  const gagne=br.nw+br.up, perdu=Math.abs(br.down+br.lost);
  const ratio=perdu>0?gagne/perdu:null;
  // Le verdict change de nature selon que la perte mange les gains ou non.
  let kind='ok',ico='✔',verdict,action;
  if(ratio!=null&&ratio<1.05&&ratio>0.95){
    kind='warn';ico='⇄';
    verdict=`Tu fais du surplace : ${fmtMoney(gagne)} gagnés, ${fmtMoney(perdu)} perdus.`;
    action=`Tout ton effort d'acquisition sert à compenser les départs. <b>Action : la question n'est pas de trouver plus de clients, c'est de garder ceux que tu as.</b>`;
  }else if(ratio!=null&&ratio<0.95){
    kind='danger';ico='▼';
    verdict=`Tu perds plus que tu ne gagnes : ${fmtMoney(perdu)} perdus contre ${fmtMoney(gagne)} gagnés.`;
    action=`<b>Action : traiter les départs avant de chercher de nouveaux clients.</b> Reconquérir coûte moins cher que conquérir.`;
  }else{
    verdict=`Tu gagnes plus que tu ne perds : ${fmtMoney(gagne)} contre ${fmtMoney(perdu)}.`;
    action=`Ta croissance est réelle, pas seulement un remplacement. <b>Action : regarde quand même la ligne des clients perdus, c'est le gisement le moins cher.</b>`;
  }
  const barre=(v,tot)=>tot>0?Math.max(2,Math.round(Math.abs(v)/tot*100)):0;
  const ech=Math.max(br.nw,Math.abs(br.lost),Math.abs(br.down),br.up,1);
  const ligne=(lbl,val,pos,sub)=>`<tr>
      <td>${lbl}${sub?`<span class="mini-line" style="display:block;margin:0">${sub}</span>`:''}</td>
      <td style="width:42%"><span style="display:block;height:9px;width:${barre(val,ech)}%;background:${pos?'var(--ok)':'var(--danger)'}"></span></td>
      <td class="num" style="color:${pos?'var(--ok)':'var(--danger-deep)'};white-space:nowrap">${pos?'+':'-'}${fmtMoney(Math.abs(val))}</td></tr>`;
  return `<div class="section-label">D'où vient ta variation, ${exLabelCourt(br.prev)} vs ${exLabelCourt(br.cur)} à date égale</div>`
    +signal(kind,ico,verdict,action)
    +`<div class="card"><div class="card__title"><span>Le détail, par mouvement de clientèle</span></div>
      <table class="data"><tbody>
      ${ligne('Clients nouveaux',br.nw,true,'ils n\'achetaient pas l\'an dernier')}
      ${ligne('Clients en hausse',br.up,true,'ils achètent plus qu\'avant')}
      ${ligne('Clients en baisse',br.down,false,'ils achètent encore, mais moins')}
      ${ligne('Clients perdus',br.lost,false,'ils achetaient l\'an dernier, plus rien cette année')}
      <tr><td><b>Variation totale</b></td><td></td><td class="num"><b>${br.delta>=0?'+':'-'}${fmtMoney(Math.abs(br.delta))}</b></td></tr>
      </tbody></table>
      <p class="note">Les quatre lignes bouclent sur le total : chaque euro gagné ou perdu est dans une seule d\'entre elles. Un client ne peut pas être à la fois perdu et en baisse.</p></div>`;
}

function drawTrend(labels,data){
  destroyChart('chTrend');const ctx=el('chTrend');if(!ctx)return;
  charts.chTrend=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Tendance corrigée',data,borderColor:cssToken('--bordeaux'),backgroundColor:aireBordeaux(),fill:true,tension:.3,pointRadius:2,borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmtMoney(c.parsed.y)+' (corrigé)'}}},scales:{y:{ticks:{callback:v=>fmtNum(v)}}}}});
}

/* ======================= CALIBRAGE + AGENT CADENCE ======================= */
// Jour absolu -> objet date {y,m,d,t} pour l'affichage.
// Delai lisible : jours, mois ou annees selon l'ampleur.
function fmtDelai(days){if(days==null)return 'n/d';if(days<45)return Math.round(days)+' j';const mo=days/30.44;return mo<18?fmtNum(mo,mo<3?1:0)+' mois':fmtNum(mo/12,1)+' ans';}
// Seuil de dependance RELATIF a la taille : peu de clients => concentration naturellement plus haute, plus toleree.
function seuilDependance(n){if(n<10)return 100;return Math.max(25,Math.min(75,60-Math.log10(n)*12));}
// Bloc "pourquoi" depliable (les chiffres qui fondent le conseil).
function pourquoi(inner){return `<details class="pourquoi"><summary>Pourquoi ce conseil</summary><div class="pourquoi__in">${inner}</div></details>`;}
// Badge de niveau de confiance quand la donnee est limite.
/* `confBadge()` est morte le 11/09/2026 avec l'ecran fantome de reactivation, le seul qui
   l'affichait. La colonne « Fiabilite » vit toujours dans l'export des clients a relancer,
   en toutes lettres : dans un fichier Excel, une pastille coloree ne sert a rien. */

// AGENT CADENCE : rythme d'achat par client, a partir de ses dates de facture distinctes.
function agentCadence(){
  const P=PROFIL||profilBase();const refDay=P.refDay;
  if(refDay==null||!P.nClients)return{ok:false,clients:[],enRetard:[],caPotentiel:0,refDay:null};
  const days=clientPurchaseDays();
  const info={};
  ROWS.forEach(r=>{if(!r._vin)return;const id=clientKey(r);const c=info[id]||(info[id]={montant:0,fact:new Set(),nom:r.client||id,moisCount:{}});c.montant+=r._total;c.fact.add(r.numFacture);if(r._date)c.moisCount[r._date.m]=(c.moisCount[r._date.m]||0)+r._total;});
  const clients=[];
  for(const id in days){
    const d=days[id],n=d.length,meta=info[id]||{montant:0,nom:id,fact:new Set(),moisCount:{}};
    const last=d[n-1],silence=refDay-last,panier=meta.fact.size?meta.montant/meta.fact.size:meta.montant;
    let cadence=null,cv=null,cls,fiable=false;
    if(n===1){cls='one-shot';}
    else if(n>=SEUILS.cadenceMinAchats){const gaps=[];for(let i=1;i<n;i++)gaps.push(d[i]-d[i-1]);cadence=median(gaps);const moy=gaps.reduce((s,v)=>s+v,0)/gaps.length;cv=moy>0?stdev(gaps)/moy:0;fiable=true;cls=cv<=SEUILS.regulariteCV?'regulier':'occasionnel';}
    else cls='peu'; // 2 achats : pas de cadence fiable, on bascule sur l'intervalle median de la base (cf. cadRef)
    const annuel=cadence!=null&&cadence>=300&&cadence<=430;
    let moisHab=null,mx=-1;for(const m in meta.moisCount){if(meta.moisCount[m]>mx){mx=meta.moisCount[m];moisHab=+m;}}
    const cadRef=cadence!=null?cadence:(P.intervalleMedianBase||0);
    const ampleur=cadRef>0?silence/cadRef:0;
    const enRetard=cadRef>0&&n>=2&&silence>cadRef*SEUILS.cadenceK;
    const prochaine=cadence!=null?last+cadence:null;
    const conf=fiable?(n>=5?'bonne':'moyenne'):'faible';
    clients.push({id,nom:meta.nom,n,montant:meta.montant,panier,last,silence,cadence,cadRef,cv,cls,fiable,annuel,moisHab,enRetard,ampleur,prochaine,caPotentiel:panier,conf});
  }
  const enRetard=clients.filter(c=>c.enRetard&&c.montant>0).map(c=>({...c,score:c.montant*Math.min(c.ampleur,5)})).sort((a,b)=>b.score-a.score);
  return{ok:true,refDay,clients,enRetard,caPotentiel:sum(enRetard,c=>c.caPotentiel)};
}

/* ======================= AGENTS MUTUALISES (aussi utilisés par le Diagnostic) ======================= */
// Dormance = "en retard sur sa propre cadence" (k x cadence du client, sinon k x intervalle median de la base).
/* ======================= EXPERTISE 5 : PREMIERS ACHATS SANS SUITE =======================
   Le moteur de cadence ne sait parler que des clients qui ont achete plusieurs fois.
   Or l'essentiel d'une base de domaine est constitue de gens venus une seule fois.
   Ce moteur-ci ne calcule aucune cadence : il compare l'anciennete du seul achat au
   delai que mettent, DANS CETTE BASE, les clients qui sont effectivement revenus.
   Aucun seuil grave : tout est mesure sur le fichier charge. */
const MIN_OBSERVABLES=40;  // en dessous, on ne calcule aucun taux : l'echantillon ne dit rien.
const MIN_CLASSE=15;       // effectif minimal pour publier le taux d'une classe.
function agentPremierAchat(){
  const jours=clientPurchaseDays();
  const ids=Object.keys(jours);
  if(!ids.length)return {ok:false,raison:'base vide'};
  const ref=META.max?Math.floor(Date.UTC(META.max.y,META.max.m-1,META.max.d)/86400000):null;
  if(ref==null)return {ok:false,raison:'aucune date exploitable'};

  // Fenetre d'observation : un an apres le premier achat. En dessous, « pas revenu »
  // veut surtout dire « pas encore eu le temps », et le taux ne signifie rien.
  const AN=365;
  const observables=ids.filter(id=>ref-jours[id][0]>=AN);
  if(observables.length<MIN_OBSERVABLES)
    return {ok:false,raison:'historique trop court',observables:observables.length};

  // Un SEUL parcours de la base pour tout ce dont l'ecran a besoin : le montant du premier
  // achat, le type de client, la cuvee dominante. Recalculer ligne par ligne pour chaque
  // client coutait une demi-seconde sur 5000 lignes, et bien plus sur une grosse base.
  const fiche={};
  ids.forEach(id=>{fiche[id]={premier:0,type:'',nom:id,ville:'',prod:{}};});
  ROWS.forEach(r=>{if(!r._vin)return;
    const id=clientKey(r);const f=fiche[id];if(!f)return;
    if(r._dayNum===jours[id][0])f.premier+=r._total;      // montant du tout premier jour d'achat
    if(!f.type&&r._typeClient)f.type=r._typeClient;
    if(f.nom===id&&r.client)f.nom=r.client;
    if(!f.ville&&r.ville)f.ville=r.ville;
    if(r.produit)f.prod[r.produit]=(f.prod[r.produit]||0)+r._total;});
  for(const id in fiche){const e=Object.entries(fiche[id].prod);
    fiche[id].cuvee=e.length?e.sort((a,b)=>b[1]-a[1])[0][0]:'';delete fiche[id].prod;}
  const premierMontant=id=>fiche[id]?fiche[id].premier:0;
  // Classes de montant du premier achat, en quartiles de la base : rien de grave,
  // un domaine qui vend au verre et un domaine qui vend en palettes auront leurs propres bornes.
  const montants=ids.map(premierMontant).filter(v=>v>0).sort((a,b)=>a-b);
  const q=p=>montants[Math.min(montants.length-1,Math.floor(p*montants.length))];
  const bornes=[q(0.25),q(0.5),q(0.75),q(0.9)];
  const classeDe=v=>{for(let i=0;i<bornes.length;i++)if(v<bornes[i])return i;return bornes.length;};
  const libClasse=i=>i===0?('moins de '+fmtMoney(bornes[0]))
    :i===bornes.length?('plus de '+fmtMoney(bornes[bornes.length-1]))
    :(fmtMoney(bornes[i-1])+' à '+fmtMoney(bornes[i]));

  // Taux de retour observe, par classe de montant et par typologie. On ne publie
  // un taux que s'il repose sur assez de monde, sinon on renvoie null et on le dit.
  function tauxPar(cle){
    const m={};
    observables.forEach(id=>{const k=cle(id);if(k==null||k==='')return;
      const g=m[k]||(m[k]={n:0,r:0});g.n++;if(jours[id].length>1)g.r++;});
    const out={};for(const k in m)out[k]={...m[k],taux:m[k].n>=MIN_CLASSE?m[k].r/m[k].n:null};
    return out;
  }
  const parClasse=tauxPar(id=>classeDe(premierMontant(id)));
  const parType=tauxPar(id=>fiche[id]?fiche[id].type:null);
  const global=observables.filter(id=>jours[id].length>1).length/observables.length;

  // Chance retenue pour un client : celle de sa classe de montant, affinee par sa
  // typologie quand les deux sont mesurables. A defaut, le taux global de la base.
  function chanceDe(cl,type){
    const a=parClasse[cl]&&parClasse[cl].taux, b=parType[type]&&parType[type].taux;
    if(a!=null&&b!=null)return Math.sqrt(a*b);   // moyenne geometrique, aucun des deux n'ecrase l'autre
    return a!=null?a:(b!=null?b:global);
  }
  const monos=ids.filter(id=>jours[id].length===1);
  const liste=monos.map(id=>{
    const j=jours[id][0], c=fiche[id]||{}, montant=premierMontant(id), cl=classeDe(montant);
    const type=c.type||'';
    const chance=chanceDe(cl,type);
    return {id,nom:c.nom||id,montant,jour:j,date:dayToDate(j),age:ref-j,ville:c.ville||'',
            cuvee:c.cuvee||'',classe:cl,libClasse:libClasse(cl),type,chance,
            esperance:montant*chance};
  }).sort((a,b)=>b.esperance-a.esperance);

  // Ou couper : le plus petit nombre de clients qui porte 80 % du potentiel total.
  const total=sum(liste,c=>c.esperance);
  let cum=0,coupe=0;
  for(;coupe<liste.length&&cum<total*0.8;coupe++)cum+=liste[coupe].esperance;
  return {ok:true,ref,global,liste,coupe:Math.max(1,coupe),total,
          prioritaires:liste.slice(0,Math.max(1,coupe)),reste:liste.slice(Math.max(1,coupe)),
          bornes,libClasse,parClasse,parType,observables:observables.length,
          classes:Object.keys(parClasse).map(k=>({i:+k,lib:libClasse(+k),...parClasse[k]})).sort((a,b)=>b.i-a.i),
          types:Object.keys(parType).map(k=>({lib:k,...parType[k]})).sort((a,b)=>(b.taux||0)-(a.taux||0))};
}
function agentDormants(){
  const ref=META.max;const cad=agentCadence();if(!cad.ok)return{ref:null,dormants:[],ca:0,base:!!(PROFIL&&PROFIL.intervalleMedianBase)};
  const dormants=cad.enRetard.filter(c=>c.n>=SEUILS.rfmMinFreq&&c.montant>0)
    .map(c=>({id:c.id,nom:c.nom,montant:c.montant,n:c.n,factures:{size:c.n},last:dayToDate(c.last),silence:c.silence,cadence:c.cadence,cadRef:c.cadRef,ampleur:c.ampleur,fiable:c.fiable,annuel:c.annuel,prochaine:c.prochaine,caPotentiel:c.caPotentiel,conf:c.conf}));
  return{ref,dormants,ca:sum(dormants,c=>c.montant),usedBaseInterval:!clientStatsHaveCadence(cad)};
}
function clientStatsHaveCadence(cad){return cad.clients.some(c=>c.cadence!=null);}
function agentDecrochage(){
  const f=yoyFrame();if(!f)return{f:null,decroche:[],totPerdu:0,ecartes:0,caEcarte:0};
  // Un client venu une seule fois dans TOUTE la base ne decroche pas : il n'est jamais monte.
  // Le signaler comme « en recul » melangeait 169 clients de passage aux 58 vrais habitues
  // qui ralentissent, et gonflait la perte annoncee d'euros qui n'ont jamais ete une relation.
  // Ces clients-la sont traites par l'ecran « 1er achat sans suite », qui est fait pour eux.
  const joursClient=clientPurchaseDays();
  const venuUneFois=id=>{const j=joursClient[id];return !j||j.length<=1;};
  // CA annuel complet par client sur toutes les annees, pour estimer la volatilite propre de chacun.
  const yearly={};
  ROWS.forEach(r=>{if(!r._vin||!r._date)return;const id=clientKey(r);(yearly[id]||(yearly[id]={}))[r._exY]=(yearly[id][r._exY]||0)+r._total;});
  const by={};
  ROWS.forEach(r=>{if(!r._vin||!r._date)return;if(!avantCoupe(r,f.cutPos))return;if(r._exY!==f.cur&&r._exY!==f.prev)return;const id=clientKey(r);let c=by[id];if(!c)c=by[id]={id,nom:r.client||id,cur:0,prev:0};if(r._exY===f.cur)c.cur+=r._total;else c.prev+=r._total;});
  const decroche=Object.values(by).map(c=>{
    const pct=c.prev>0?(c.cur-c.prev)/c.prev*100:0;
    // Volatilite : CV du CA annuel du client si >= 3 annees connues, sinon pas de volatilite fiable.
    const vals=Object.values(yearly[c.id]||{});
    const moy=vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:0;
    const cv=(vals.length>=3&&moy>0)?stdev(vals)/moy:null;
    // Seuil relatif : un client volatil doit chuter plus fort pour alerter.
    const seuil=cv!=null?SEUILS.decrochagePct*(1+Math.min(cv,1.5)):SEUILS.decrochagePct;
    return{...c,perdu:c.prev-c.cur,pct,cv,seuil};
  }).filter(c=>c.prev>0&&c.cur>=0&&c.pct<c.seuil).sort((a,b)=>b.perdu-a.perdu);
  const ecartes=decroche.filter(c=>venuUneFois(c.id));
  const retenus=decroche.filter(c=>!venuUneFois(c.id));
  return{f,decroche:retenus,totPerdu:sum(retenus,c=>c.perdu),
         ecartes:ecartes.length,caEcarte:sum(ecartes,c=>c.perdu)};
}
function agentConcentration(){
  const rows=ROWS.filter(r=>r._vin),ca=sum(rows,r=>r._total);if(ca<=0)return null;
  const by={};rows.forEach(r=>{const id=clientKey(r);by[id]=(by[id]||0)+r._total;});
  const parts=Object.values(by).sort((a,b)=>b-a);if(parts.length<3)return null;
  const part=parts.slice(0,3).reduce((s,v)=>s+v,0)/ca*100;
  const seuil=seuilDependance(parts.length);        // seuil relatif a la taille de la base
  const hhi=parts.reduce((s,v)=>s+Math.pow(v/ca,2),0)*10000; // indice Herfindahl (fait, 0-10000)
  return{part,clients:parts.length,seuil,alert:part>seuil,hhi};
}
function agentCanalMover(){
  const f=yoyFrame();if(!f)return null;
  function agg(y){const m={};let tot=0;ROWS.forEach(r=>{if(!r._vin||!r._date)return;if(r._exY!==y)return;if(!avantCoupe(r,f.cutPos))return;m[r._canal]=(m[r._canal]||0)+r._total;tot+=r._total;});return{m,tot};}
  const A=agg(f.cur),B=agg(f.prev),keys=[...new Set([...Object.keys(A.m),...Object.keys(B.m)])];
  let mv=null;keys.forEach(k=>{const pc=A.tot?(A.m[k]||0)/A.tot*100:0,pp=B.tot?(B.m[k]||0)/B.tot*100:0,dPts=pc-pp;if(mv==null||Math.abs(dPts)>Math.abs(mv.dPts))mv={k,dPts};});
  return{f,mover:mv};
}
function yoyTotals(){
  const f=yoyFrame();if(!f)return null;
  const cur=sum(ROWS.filter(r=>r._vin&&r._exY===f.cur&&avantCoupe(r,f.cutPos)),r=>r._total);
  const prev=sum(ROWS.filter(r=>r._vin&&r._exY===f.prev&&avantCoupe(r,f.cutPos)),r=>r._total);
  return{f,cur,prev,d:prev?(cur-prev)/Math.abs(prev)*100:null};
}
// Synthetise les verdicts de tous les agents en une liste priorisee (severite puis impact en euros).
function diagnosticSignals(){
  const S=[];
  const at=computeAtterrissage();
  if(at&&!at.complete){
    if(objectif){const gap=at.central-objectif;
      if(gap<0)S.push({sev:3,impact:Math.abs(gap),kind:'danger',ico:'⚑',verdict:`Objectif menacé : au rythme actuel il manquerait ${fmtMoney(Math.abs(gap))} pour tenir ${fmtMoney(objectif)}.`,action:`Atterrissage estimé ${fmtMoney(at.central)}. Active les leviers ci-dessous d'ici la fin d'année.`});
      else S.push({sev:1,impact:gap,kind:'ok',ico:'✔',verdict:`Objectif jouable : atterrissage estimé ${fmtMoney(at.central)}, soit ${fmtMoney(gap)} au-dessus de l'objectif.`,action:`Sécurise la trajectoire, ne relâche pas sur les clients à risque.`});
    }else S.push({sev:0,impact:0,kind:'info',ico:'ℹ',verdict:`Aucun objectif de CA fixé.`,action:`Saisis-le dans la trajectoire pour mesurer l'écart projeté.`});
  }
  const dec=agentDecrochage();
  if(dec.decroche.length)S.push({sev:3,impact:dec.totPerdu,kind:'danger',ico:'⚠',verdict:`${plur(dec.decroche.length,'client')} en décrochage : ${fmtMoney(dec.totPerdu)} de CA en moins vs ${exPrecedent()} à date égale.`,action:`À rappeler en priorité, du plus gros montant perdu au plus petit. La liste est dans <b>Mon commerce</b>, filtre « Recul confirmé ».`});
  const dor=agentDormants();
  if(dor.dormants.length){const t3=dor.dormants.slice(0,3).map(c=>esc(c.nom)+' ('+fmtMoney(c.montant)+')').join(', ');
    S.push({sev:2,impact:dor.ca,kind:'warn',ico:'↻',verdict:`${plur(dor.dormants.length,'client')} en retard sur leur cadence d'achat : ${fmtMoney(dor.ca)} de CA historique en sommeil.`,action:`À relancer en priorité : ${t3}. La liste est dans <b>Mon commerce</b>, filtre « Retard de cadence ».`});}
  const pv=computePriceVolume();
  if(pv){
    if(pv.priceEff<0&&Math.abs(pv.priceEff)>=Math.abs(pv.volEff))S.push({sev:2,impact:Math.abs(pv.priceEff),kind:'warn',ico:'€',verdict:`Érosion par le prix : ${fmtMoney(Math.abs(pv.priceEff))} de CA perdus (prix moyen ${fmtNum(pv.P0,2)} € vers ${fmtNum(pv.P1,2)} €).`,action:`Le recul vient surtout du prix, pas du volume. Revois remises et grille tarifaire.`});
    else if(pv.volEff<0&&Math.abs(pv.volEff)>Math.abs(pv.priceEff))S.push({sev:2,impact:Math.abs(pv.volEff),kind:'warn',ico:'▤',verdict:`Recul des volumes : ${fmtMoney(Math.abs(pv.volEff))} de CA en moins à prix constant.`,action:`Le sujet, c'est le nombre de bouteilles vendues. Pousse acquisition et réactivation.`});
    else if(pv.delta>=0)S.push({sev:1,impact:pv.delta,kind:'ok',ico:'✔',verdict:`Croissance saine : +${fmtMoney(pv.delta)}, portés ${pv.volEff>=pv.priceEff?'surtout par les volumes':'surtout par le prix'}.`,action:`Continue sur le levier qui marche.`});
  }
  const con=agentConcentration();
  if(con&&con.alert)S.push({sev:2,impact:0,kind:'warn',ico:'▦',verdict:`Dépendance : tes 3 premiers clients pèsent ${fmtNum(con.part,0)}% du CA, élevé pour une base de ${fmtNum(con.clients)} clients (seuil ${fmtNum(con.seuil,0)}%).`,action:`Un départ ferait mal. Élargis ta base de gros comptes pour diluer le risque.`});
  const cm=agentCanalMover();
  if(cm&&cm.mover&&Math.abs(cm.mover.dPts)>=2)S.push({sev:1,impact:0,kind:cm.mover.dPts>=0?'ok':'info',ico:cm.mover.dPts>=0?'↗':'↘',verdict:`Le canal ${cm.mover.k} ${cm.mover.dPts>=0?'progresse':'recule'} de ${fmtNum(Math.abs(cm.mover.dPts),1)} points de mix.`,action:`${cm.mover.dPts>=0?'Capitalise sur ce canal qui monte.':'Comprends pourquoi ce canal recule.'} Le détail est dans <b>Mes cuvées</b>, au pied de l'écran.`});
  const series=monthlySeries();
  if(series.length>=6){const byM={},cM={};series.forEach(p=>{byM[p.m]=(byM[p.m]||0)+p.v;cM[p.m]=(cM[p.m]||0)+1;});const avgM={};for(const m in byM)avgM[m]=byM[m]/cM[m];let tr=null;for(let m=1;m<=12;m++)if(avgM[m]!=null&&(tr==null||avgM[m]<avgM[tr]))tr=m;if(tr)S.push({sev:0,impact:0,kind:'info',ico:'◷',verdict:`Ton mois le plus creux est historiquement ${MOIS_FR[tr-1]}.`,action:`Anticipe la trésorerie et charge les actions commerciales juste avant.`});}
  S.sort((a,b)=>b.sev-a.sev||b.impact-a.impact);
  return S;
}

/* =========================== MON CAP ===========================================
   Ecrit le 11/09/2026, lot 4 de la redecoupe. Cette fonction remplace renderDiagnostic()
   ET renderApercu(), qui etaient deux panneaux empiles dans la meme piece, avec deux
   titres, deux sous-titres et le meme chiffre d'evolution ecrit deux fois.

   LA PIECE S'APPELLE « MON CAP » ET PLUS « MON ANNEE ». Ted voulait la supprimer ; elle
   est gardee mais elle passe de VINGT-SIX blocs a sept, parce que ces sept-la ne repondent
   a aucune autre question que « ou j'en suis sur l'ensemble ». Le nom pose la question au
   lieu de nommer une periode, et il ne varie plus avec l'exercice comptable : c'est
   `motExercice()` en moins dans bdv-nav.js, et surtout la cle `bdv_exercice_v1` qui n'a
   plus a y etre dupliquee.

   LES TROIS ETAGES, comme les trois autres pieces (voir CLAUDE.md) : le bandeau de
   comparaison en verdict, les chiffres et la courbe au milieu, ce qui explique replie.

   DEUX GRILLES DE COMPTEURS, ET LA DIFFERENCE EST VOULUE. « Ou en es-tu » porte des
   chiffres d'EXERCICE, qui ne bougent pas avec le filtre de periode : realise,
   atterrissage, ecart a l'objectif. « Sur la periode affichee » porte ceux de la selection
   en cours. Les melanger, c'etait laisser croire qu'un filtre change l'atterrissage.
   ============================================================================== */
function renderCap(){
  const p=el('p-diagnostic');if(!p)return;
  const rows=vinRows();
  const ca=sum(rows,r=>r._total);
  const factures=new Set(rows.map(r=>r.numFacture)).size;
  const btl=sum(rows,r=>r._qte);
  const clients=new Set(rows.map(r=>clientKey(r))).size;
  const panier=factures?ca/factures:0;
  const scope=libellePerimetre();
  const f=yoyFrame(),at=computeAtterrissage(),yt=yoyTotals();

  let html=`<h2 class="panel__title">Mon cap</h2><div class="panel__sub">Où tu en es, où tu finis ton ${exMot()}, et pourquoi. CA HT, hors transport, pub, remises, offerts et casse. Périmètre : ${scope}.</div>`;

  // Garde-fou anti-ecran-vide : des lignes en base, mais aucune vente detectee.
  if(!rows.length && ROWS.length){
    html+=signal('danger','⚠',
      `Aucune vente détectée, alors que la base contient ${fmtNum(ROWS.length)} lignes.`,
      `Certaines familles sont peut-être classées à tort en hors-vente (transport, remises, pub, divers). Le réglage des familles arrivera dans l'onglet Colonnes. En attendant, vérifie que tes noms de famille ne contiennent pas un mot de la liste noire.`);
    p.innerHTML=html;
    return;
  }

  /* ------------------------- ETAGE 1 : LE VERDICT -------------------------
     UN SEUL ENDROIT DIT L'EVOLUTION, depuis le 11/09/2026. Ce bandeau et le compteur
     « Evolution vs N-1 » du diagnostic affichaient le meme calcul et les deux memes
     montants. Le bandeau gagne : il dit en plus les deux totaux et l'atterrissage, et il
     se lit d'un coup d'oeil. Le compteur a ete retire de la grille. */
  if(f){
    const curW=sum(ROWS.filter(r=>r._vin&&r._exY===f.cur&&avantCoupe(r,f.cutPos)),r=>r._total);
    const prevW=sum(ROWS.filter(r=>r._vin&&r._exY===f.prev&&avantCoupe(r,f.cutPos)),r=>r._total);
    const d=prevW?(curW-prevW)/Math.abs(prevW)*100:null;
    const cls=d==null?'':(d>=0?'up':'down');
    html+=`<div class="hero">
      <div class="hero__label">Où en est ton ${exMot()}, ${exLabelCourt(f.cur)} vs ${exLabelCourt(f.prev)} à date</div>
      <div class="hero__val ${cls}">${d==null?'n/d':fmtPct(d)}</div>
      <div class="hero__sub">Au ${fmtDate(f.cutDate)} : ${fmtMoney(curW)} ${exCe()} contre ${fmtMoney(prevW)} le précédent au même jour.${(at&&!at.complete)?' Atterrissage estimé '+fmtMoney(at.central)+'.':''} ${incompleteNote()}</div>
    </div>`;
    if(plageLibre())html+=`<p class="note" style="margin:-.7rem 0 1.1rem">Ce comparatif reste calé sur ${exLabel(f.cur)} contre ${exLabel(f.prev)}, <b>pas sur la plage de dates choisie</b> : une plage quelconque n'a pas de période précédente équivalente. Les compteurs et la courbe ci-dessous, eux, suivent bien ta plage.</p>`;
  }

  // ------------------------- Les chiffres d'exercice -------------------------
  html+=`<div class="section-label">Où en es-tu</div><div class="kpi-grid">`;
  if(at&&!at.complete){
    html+=kpiCard('Réalisé '+exLabelCourt(at.cur),fmtMoney(at.done),at.months+' mois connus',true);
    html+=kpiCard('Atterrissage estimé',fmtMoney(at.central),'fourchette '+fmtMoney(at.low)+' à '+fmtMoney(at.high));
  }else if(at&&at.complete){html+=kpiCard(exLabel(at.cur)+', '+exComplet(),fmtMoney(at.total),exMot()+' clôturé'+(EX_START===1?'e':''),true);}
  if(objectif&&at&&!at.complete){const gap=at.central-objectif;html+=kpiCard('Écart vs objectif',(gap>=0?'+':'-')+fmtMoney(Math.abs(gap)),gap>=0?'objectif jouable':'objectif menacé');}
  html+=`</div>`;
  if(at&&!at.complete)html+=`<p class="note">Atterrissage ${at.method==='saison'?('calé sur la saisonnalité de '+exLabel(at.cur-1)):('linéaire (faute d\'un '+exMot()+' précédent en base)')}.</p>`;

  /* LE CHAMP « OBJECTIF DE CA ANNUEL » A ETE RETIRE D'ICI LE 11/09/2026, et il n'a pas
     demenage : il EXISTAIT DEJA dans « Mes réglages », onglet « Tes ventes », a cote du
     mois d'ouverture de l'exercice. Deux champs de saisie pour une seule valeur, dans deux
     ecrans differents, et celui-ci ne se repeignait qu'au rendu de la piece : de quoi voir
     deux montants differents pour le meme reglage. Il reste une phrase qui dit ou aller. */
  html+=`<p class="note">${objectif?`Objectif fixé à ${fmtMoney(objectif)}.`:`Aucun objectif de CA fixé.`} Il se règle dans <b>Mes réglages</b>, onglet « Tes ventes ».</p>`;

  // ------------------------- Ce qui presse -------------------------
  html+=`<div class="section-label">À regarder en priorité</div>`;
  const sigs=diagnosticSignals();
  if(sigs.length)sigs.forEach(x=>html+=signal(x.kind,x.ico,x.verdict,x.action));
  else html+=signal('ok','✔','Rien d\'urgent sur la base chargée.','Tes indicateurs sont au vert. Continue le suivi régulier.');

  /* ------------------------- ETAGE 2 : LA FORME ET LES CHIFFRES ------------------------- */
  html+=`<div style="margin:.2rem 0 1.1rem"><span class="toggle">
    <button class="${uiMesure==='ca'?'on':''}" onclick="setMesure('ca')">CA HT</button>
    <button class="${uiMesure==='btl'?'on':''}" onclick="setMesure('btl')">Bouteilles</button>
  </span></div>`;

  html+=`<div class="section-label">La forme de ton ${exMot()}</div>
    <div class="card"><div class="card__title"><span>${uiMesure==='ca'?'CA HT':'Bouteilles'} par mois${f?' · '+exLabelCourt(f.cur)+' vs '+exLabelCourt(f.prev):''}</span></div><div class="chart-wrap"><canvas id="chApMonth"></canvas></div></div>`;

  html+=`<div class="section-label">Sur la période affichée</div><div class="kpi-grid">
    ${kpiCard('CA HT',fmtMoney(ca),plur(rows.length,'ligne')+' de vente',true)}
    ${kpiCard('Bouteilles / cols',fmtNum(btl),'quantité vendue')}
    ${kpiCard('Panier moyen',fmtMoney(panier),'par facture')}
    ${kpiCard('Factures',fmtNum(factures),'factures distinctes')}
    ${kpiCard('Clients actifs',fmtNum(clients),'ont acheté sur la période')}
  </div>`;

  /* ------------------------- ETAGE 3 : CE QUI EXPLIQUE, REPLIE -------------------------
     LA COURBE DE TENDANCE EST DESSINEE AU PREMIER DEPLI, comme celles du pied de « Mes
     cuvees » : un <canvas> dans un <details> ferme a une hauteur de zero, et Chart.js s'y
     dessine a zero pixel sans rien dire. */
  const series=monthlySeries();
  const pv=computePriceVolume();
  let fond='';
  if(series.length>=6)fond+=`<div class="card"><div class="card__title"><span>Élan réel mois après mois, corrigé de la saisonnalité</span></div><div class="chart-wrap"><canvas id="chTrend"></canvas></div><p class="note">On neutralise tes pics et tes creux de saison pour voir ta vraie dynamique. Une pente qui monte, c'est du progrès hors effet calendaire.</p></div>`;
  else fond+=signal('info','ℹ','Pas assez de mois pour dégager une tendance.','Il faut au moins six mois de données datées dans la base.');
  if(pv){
    fond+=`<div class="card"><div class="card__title"><span>Effet prix contre effet volume, ${exLabelCourt(pv.cur)} vs ${exLabelCourt(pv.prev)} à date égale</span></div>
      <table class="data"><tbody>
      <tr><td>Effet volume (quantités vendues)</td><td class="num" style="color:${pv.volEff>=0?'var(--ok)':'var(--danger-deep)'}">${pv.volEff>=0?'+':'-'}${fmtMoney(Math.abs(pv.volEff))}</td></tr>
      <tr><td>Effet prix (prix moyen ${fmtNum(pv.P0,2)} € vers ${fmtNum(pv.P1,2)} € par bouteille)</td><td class="num" style="color:${pv.priceEff>=0?'var(--ok)':'var(--danger-deep)'}">${pv.priceEff>=0?'+':'-'}${fmtMoney(Math.abs(pv.priceEff))}</td></tr>
      <tr><td><b>Variation totale</b></td><td class="num"><b>${pv.delta>=0?'+':'-'}${fmtMoney(Math.abs(pv.delta))}</b></td></tr>
      </tbody></table><p class="note">À date égale. Effet volume = ce que font les quantités à prix constant ; effet prix = ce que fait ton prix moyen à volume constant.</p></div>`;
  }else fond+=signal('info','ℹ','Décomposition prix/volume indisponible.',`Il faut deux ${exMot()}s comparables dans la base.`);
  html+=`<div class="card"><details class="msg--replie" id="pied-cap">
    <summary>Ce qui explique ta variation</summary>${fond}</details></div>`;

  p.innerHTML=html;
  drawApMonth();
  const d=el('pied-cap');
  if(d)d.addEventListener('toggle',function(){
    if(!d.open||d.dataset.peint)return;
    d.dataset.peint='1';
    if(series.length>=6){const si=seasonalIndex(series),labels=[],data=[];series.forEach(pt=>{const idx=si.idx[pt.m]||1;labels.push(MOIS_FR[pt.m-1]+' '+String(pt.y).slice(2));data.push(idx?pt.v/idx:pt.v);});drawTrend(labels,data);}
  });
}

/* ======================= EXPERTISE 1 : REACTIVATION (RFM) ======================= */
function clientStats(){
  // Agrege par client (sur les lignes vin, toutes annees).
  const map={};
  ROWS.forEach(r=>{
    if(!r._vin||!r._date)return;
    const id=clientKey(r);
    let c=map[id];if(!c){c=map[id]={id,nom:r.client||id,factures:new Set(),montant:0,last:null};}
    c.factures.add(r.numFacture);
    c.montant+=r._total;
    if(!c.last||r._date.t>c.last.t)c.last=r._date;
  });
  return Object.values(map);
}
function monthsBetween(a,b){if(!a||!b)return 0;return (b.y-a.y)*12+(b.m-a.m);}
/* RENDER-REACTIVATION

   TROIS ECRANS FANTOMES, SUPPRIMES LE 11/09/2026 (lot 5). Depuis la fusion du 07/09, leurs
   trois conteneurs etaient `hidden` en dur dans la coque : plus aucune piece de la barre n'y
   menait, leurs listes avaient fusionne dans « Mon commerce ». Mais `renderAll()` appelait
   toujours les trois fonctions, qui fabriquaient a chaque rendu des tableaux HTML complets,
   avec leurs lignes, leurs colonnes et leurs boutons, ecrits dans des div que personne ne
   verrait jamais.

   LE CALCUL, LUI, N'EST PAS PERDU : il n'a jamais ete ici. Il vit dans `agentDormants()` et `agentCadence()`, que
   `agentClients()` appelle pour composer la liste unifiee de « Mon commerce ». Ces fonctions
   ne faisaient que peindre.
*/
/* ======================= MES PRODUITS =======================
   Piege central de cet ecran, verifie sur la base reelle : raisonner par produit-millesime
   fait crier au drame a chaque changement de millesime. « Le Rosé 2024 » chute de 53 677 €
   pendant que « Le Rosé 2025 » monte de 56 474 € : la cuvee, elle, ne bouge presque pas.
   Toutes les analyses de tendance se font donc au niveau CUVEE. Le millesime ne sert
   qu'a repondre a une autre question : reste-t-il du vieux stock a ecouler ? */
function agentProduits(){
  const V=ROWS.filter(r=>r._vin);
  if(!V.length)return {ok:false};
  const f=yoyFrame();
  const cuvees={};
  V.forEach(r=>{
    const nom=cuveeBase(r.produit||'(sans nom)');
    const c=cuvees[nom]||(cuvees[nom]={nom,ca:0,btl:0,clients:new Set(),prixPar:{},
      cur:0,prev:0,millesimes:{},cond:{},parMois:new Array(13).fill(0),achats:{}});
    const id=clientKey(r);
    c.ca+=r._total;c.btl+=r._qte;c.clients.add(id);
    if(r._qte>0&&r._total>0){
      const cd=r.conditionnement||'?';
      (c.prixPar[cd]||(c.prixPar[cd]=[])).push(r._total/r._qte);
    }
    if(r._date)c.parMois[r._date.m]+=r._total;
    (c.achats[id]||(c.achats[id]=new Set())).add(r.numFacture);
    const mil=String(r.millesime||'').trim()||'sans millésime';
    const m=c.millesimes[mil]||(c.millesimes[mil]={ca:0,btl:0,cur:0,dernier:null});
    m.ca+=r._total;m.btl+=r._qte;
    if(r._dayNum!=null&&(m.dernier==null||r._dayNum>m.dernier))m.dernier=r._dayNum;
    c.cond[r.conditionnement||'?']=(c.cond[r.conditionnement||'?']||0)+r._qte;
    if(f&&r._date&&avantCoupe(r,f.cutPos)){
      if(r._exY===f.cur){c.cur+=r._total;m.cur+=r._total;}
      else if(r._exY===f.prev)c.prev+=r._total;}
  });
  const caTotal=sum(V,r=>r._total);
  const liste=Object.values(cuvees).map(c=>{
    // Concentration : quelle part du CA de cette cuvee tient a son plus gros acheteur ?
    const parClient={};
    V.forEach(r=>{if(cuveeBase(r.produit||'')!==c.nom)return;const id=clientKey(r);parClient[id]=(parClient[id]||0)+r._total;});
    const parts=Object.values(parClient).sort((a,b)=>b-a);
    const top1=c.ca>0&&parts.length?parts[0]/c.ca*100:0;
    const nomTop=Object.keys(parClient).sort((a,b)=>parClient[b]-parClient[a])[0];
    // Rachat : parmi ceux qui l'ont goutee, combien en ont repris ?
    const repris=Object.values(c.achats).filter(x=>x.size>1).length;
    const rachat=c.clients.size?repris/c.clients.size:0;
    // Conditionnement dominant : c'est le seul sur lequel une comparaison de prix a un sens.
    const condDom=Object.entries(c.cond).sort((a,b)=>b[1]-a[1])[0];
    const px=((condDom&&c.prixPar[condDom[0]])||[]).slice().sort((a,b)=>a-b);
    const q=x=>px.length?px[Math.min(px.length-1,Math.floor(x*px.length))]:0;
    return {...c,clients:c.clients.size,part:caTotal>0?c.ca/caTotal*100:0,
      top1,nomTop:nomTop?(ROWS.find(r=>clientKey(r)===nomTop)||{}).client||nomTop:'',
      rachat,prixMed:q(0.5),prixBas:q(0.1),prixHaut:q(0.9),nPrix:px.length,
      condDom:condDom?condDom[0]:'',
      delta:f?c.cur-c.prev:null};
  }).sort((a,b)=>b.ca-a.ca);
  // Reperes RELATIFS a ce domaine : aucun seuil grave.
  const med=arr=>{const a=arr.slice().sort((x,y)=>x-y);return a.length?a[a.length>>1]:0;};
  const repRachat=med(liste.map(c=>c.rachat));
  const repClients=med(liste.map(c=>c.clients));
  return {ok:true,liste,caTotal,f,repRachat,repClients,
    nbMillesimes:liste.reduce((n,c)=>n+Object.keys(c.millesimes).length,0)};
}
// Les alertes : chacune repose sur une comparaison a la base elle-meme, pas sur une constante.
function alertesProduits(A){
  const out=[],ref=META.max?Math.floor(Date.UTC(META.max.y,META.max.m-1,META.max.d)/86400000):null;
  A.liste.forEach(c=>{
    if(c.top1>=60&&c.clients>=2&&(c.ca*c.top1/100)>A.caTotal*0.005)
      out.push({t:'danger',rang:3,enjeu:c.ca*c.top1/100,famille:'dependance',cuvee:c.nom,
        ico:'⚠',titre:`${c.nom} tient à un seul client`,
        txt:`${fmtNum(c.top1,0)} % des ventes de cette cuvée viennent de ${esc(c.nomTop)}. S'il s'arrête, c'est ${fmtMoney(c.ca*c.top1/100)} qui disparaissent. <b>Action : élargir, en la proposant aux clients qui achètent les cuvées voisines.</b>`});
    if(c.rachat>A.repRachat&&c.clients<A.repClients&&c.clients>=8)
      out.push({t:'ok',rang:2,enjeu:c.ca,famille:'opportunite',ico:'↑',cuvee:c.nom,
        titre:`${c.nom} plaît, mais peu de gens y goûtent`,
        txt:`${fmtNum(c.rachat*100,0)} % de ceux qui l'ont prise en ont repris, contre ${fmtNum(A.repRachat*100,0)} % en moyenne chez toi, et elle n'a touché que ${fmtNum(c.clients)} clients. <b>Action : la mettre en avant, c'est la cuvée la plus sous-exploitée du portefeuille.</b>`});
    if(c.prixBas>0&&c.nPrix>=25&&c.prixHaut/c.prixBas>=1.8)
      out.push({t:'warn',rang:1,enjeu:c.ca,famille:'prix',ico:'€',cuvee:c.nom,
        titre:`${c.nom} se vend à des prix très différents`,
        txt:`De ${fmtNum(c.prixBas,2)} € à ${fmtNum(c.prixHaut,2)} € en ${esc(c.condDom)}, pour une médiane de ${fmtNum(c.prixMed,2)} €. <b>Action : vérifier si ces écarts sont des tarifs assumés ou des remises accordées au cas par cas.</b>`});
    // Vieux millesime encore en vente alors qu'un plus recent existe.
    const mils=Object.entries(c.millesimes).filter(([m])=>/^\d{4}$/.test(m)).sort((a,b)=>a[0].localeCompare(b[0]));
    if(mils.length>=2&&ref!=null){
      const dernier=mils[mils.length-1][0];
      const venteAnnee=mils.reduce((t,[,o])=>t+o.cur,0);
      const residuels=mils.slice(0,-1).filter(([m,o])=>{
        const part=venteAnnee>0?o.cur/venteAnnee:0;
        return o.cur>0&&o.dernier!=null&&ref-o.dernier<200&&part<0.15&&o.cur>A.caTotal*0.002;});
      if(residuels.length){
        const tot=residuels.reduce((t,[,o])=>t+o.cur,0);
        const noms=residuels.map(([m])=>m);
        out.push({t:'warn',rang:1,enjeu:tot,famille:'stock',ico:'⌛',cuvee:c.nom,
          titre:`${c.nom} : ${noms.length>1?'les millésimes '+noms.join(' et '):'le millésime '+noms[0]} se ${noms.length>1?'vendent':'vend'} encore alors que le ${dernier} est sorti`,
          txt:`${fmtMoney(tot)} écoulés cette année sur ${noms.length>1?'ces millésimes':'ce millésime'}, soit ${fmtNum(tot/venteAnnee*100,0)} % des ventes de la cuvée. <b>Action : si c'est du stock à finir, cible-le sur les clients qui ont déjà pris ce millésime plutôt que de le laisser concurrencer ton nouveau.</b>`});}
    }
  });
  // Tri par gravite puis par euros en jeu, et deux alertes au maximum par famille :
  // quatre fonds de cave d'affilee font perdre de vue la cuvee qui tient a un seul client.
  const parFamille={};
  return out.sort((a,b)=>(b.rang-a.rang)||(b.enjeu-a.enjeu))
            .filter(a=>{parFamille[a.famille]=(parFamille[a.famille]||0)+1;return parFamille[a.famille]<=2;});
}
/* ================= MES CUVEES : L'ETAGE 3, REPLIE =================
   Meme discipline que « Mon commerce », et elle est ecrite dans CLAUDE.md : un verdict en
   haut, la liste ou l'on agit au milieu, ce qui explique replie en bas.

   LES DEUX GRAPHES NE SONT DESSINES QU'AU PREMIER DEPLI, et c'est une precaution avant
   d'etre une economie. Un <canvas> dans un <details> ferme a une hauteur de ZERO : Chart.js
   s'y dessine a zero pixel, et rien ne garantit qu'il se rattrape a l'ouverture. Les poser
   sur l'evenement `toggle` supprime la question, et epargne deux graphes a qui n'ouvre pas.
   Le marqueur `data-peint` evite de les redessiner a chaque repli.
   ================================================================== */
function piedCuvees(CAN){
  if(!CAN||!CAN.tableaux)return '';
  return `<div class="card"><details class="msg--replie" id="pied-cuvees">
    <summary>Par quel chemin tu vends, et la couleur de ton chiffre</summary>
    ${CAN.tableaux}
    <div class="card"><div class="card__title"><span>Répartition par couleur</span></div><div class="chart-wrap"><canvas id="chApDonut"></canvas></div><p class="note">Sur toute ta base, en CA HT.</p></div>
  </details></div>`;
}
function brancherPiedCuvees(CAN){
  const d=el('pied-cuvees');if(!d)return;
  d.addEventListener('toggle',function(){
    if(!d.open||d.dataset.peint)return;
    d.dataset.peint='1';
    if(CAN&&CAN.A)drawCanal(CAN.A);
    drawCouleur();
  });
}

function renderProduits(){
  const A=agentProduits();
  // « Mes cuvees », comme la barre du bureau. L'ecran disait « Mes produits », et c'etait
  // le seul endroit du bureau ou une piece portait deux noms.
  let html=`<h2 class="panel__title">Mes cuvées</h2>`;
  if(!A.ok){html+=signal('info','ℹ','Aucune vente en base.','Ajoute un export pour voir ton portefeuille.');el('p-produits').innerHTML=html;return;}
  const top3=A.liste.slice(0,3).reduce((s,c)=>s+c.part,0);
  html+=`<div class="panel__sub">Ton portefeuille vu par <b>cuvée</b>, tous millésimes confondus. C'est le seul niveau où une tendance veut dire quelque chose : un millésime qui s'arrête pendant que le suivant démarre n'est pas une baisse, c'est une rotation.</div>`;

  html+=`<div class="kpi-grid">
    ${kpiCard(fmtNum(A.liste.length),'cuvées','au catalogue vendu',true)}
    ${kpiCard(fmtNum(A.nbMillesimes),'millésimes','en circulation dans ta base')}
    ${kpiCard(fmtNum(top3,0)+' %','du CA','porté par tes 3 premières cuvées')}
    ${kpiCard(fmtMoney(A.caTotal),'chiffre d\'affaires','toutes cuvées, tout l\'historique')}
  </div>`;

  /* ETAGE 1, LE VERDICT. Les alertes du portefeuille d'abord, parce que c'est le sujet de
     la piece, puis ce que disent les canaux : un chemin de vente qui monte ou qui recule,
     un prix moyen au caveau qui glisse. Trois natures, une seule section : ce sont toutes
     des choses a regarder avant d'ouvrir la liste. */
  const CAN=blocsCanaux();
  const al=alertesProduits(A);
  html+=`<div class="section-label">Ce qui mérite ton attention</div>`;
  if(!al.length)html+=signal('ok','✔','Rien d\'anormal sur ton portefeuille.','Aucune cuvée dépendante d\'un client unique, aucun écart de prix marqué, aucun millésime qui traîne.');
  else al.slice(0,6).forEach(a=>{html+=signal(a.t,a.ico,a.titre,a.txt+` <a href="#" onclick="event.preventDefault();ouvrirProduit(${JSON.stringify(a.cuvee).replace(/"/g,'&quot;')})">Voir la cuvée</a>`);});
  if(al.length>6)html+=`<p class="note">${al.length-6} autre(s) point(s) de vigilance, visibles en ouvrant les cuvées concernées.</p>`;
  html+=CAN.signaux;

  html+=`<div class="section-label">Toutes tes cuvées</div>
  <div class="card"><div class="tablewrap"><table class="data data--sticky"><thead><tr>
    <th>Cuvée</th><th class="num">CA</th><th class="num">Part</th>
    ${A.f?`<th class="num">${A.f.prev} → ${A.f.cur}</th>`:''}
    <th class="num">Clients</th><th class="num">Reprise</th><th class="num">Prix médian</th><th class="num">Millésimes</th></tr></thead><tbody>
    ${A.liste.map(c=>`<tr class="clic" tabindex="0" role="button" aria-label="Ouvrir ${esc(c.nom)}"
      onclick="ouvrirProduit(${JSON.stringify(c.nom).replace(/"/g,'&quot;')})"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();ouvrirProduit(${JSON.stringify(c.nom).replace(/"/g,'&quot;')});}">
      <td>${esc(c.nom)}</td>
      <td class="num">${fmtMoney(c.ca)}</td>
      <td class="num">${fmtNum(c.part,1)} %</td>
      ${A.f?`<td class="num" style="color:${c.delta>=0?'var(--ok)':'var(--danger-deep)'}">${c.delta>=0?'+':'-'}${fmtMoney(Math.abs(c.delta))}</td>`:''}
      <td class="num">${fmtNum(c.clients)}</td>
      <td class="num">${fmtNum(c.rachat*100,0)} %</td>
      <td class="num">${fmtNum(c.prixMed,2)} €</td>
      <td class="num">${fmtNum(Object.keys(c.millesimes).length)}</td>
    </tr>`).join('')}
    </tbody></table></div>
    <p class="note">« Reprise » = part des clients ayant acheté cette cuvée qui en ont repris au moins une deuxième fois. C'est la mesure la plus proche de « est-ce qu'elle plaît ».</p>
    <button class="btn btn--ghost btn--sm" onclick="exportProduits()" style="margin-top:.6rem">Exporter le portefeuille</button></div>`;
  html+=piedCuvees(CAN);   // etage 3 : replie, il ne pousse jamais la liste hors de l'ecran
  el('p-produits').innerHTML=html;
  brancherPiedCuvees(CAN);
}
function exportProduits(){
  const A=agentProduits();if(!A.ok)return;
  const aoa=[['Cuvee','CA','Part %','Evolution','Clients','Taux de reprise %','Prix median','Prix bas','Prix haut','Millesimes','Bouteilles','Plus gros client','Part du 1er client %']];
  A.liste.forEach(c=>aoa.push([c.nom,Math.round(c.ca),+c.part.toFixed(1),c.delta!=null?Math.round(c.delta):'',
    c.clients,+(c.rachat*100).toFixed(0),+c.prixMed.toFixed(2),+c.prixBas.toFixed(2),+c.prixHaut.toFixed(2),
    Object.keys(c.millesimes).join(' '),Math.round(c.btl),c.nomTop,+c.top1.toFixed(0)]));
  toXlsxOrCsv([{name:'Portefeuille',aoa}],'mes-cuvees');
}
// Fiche cuvee, meme mecanique que la fiche client.
function ouvrirProduit(nom){
  const A=agentProduits();if(!A.ok)return;
  const c=A.liste.find(x=>x.nom===nom);if(!c){status('error','Cuvée introuvable.');return;}
  FICHE_OUVERTE=document.activeElement;
  const m=el('modale');
  m.innerHTML=produitHTML(c,A);
  m.classList.add('on');m.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
  const b=m.querySelector('.modale__close');if(b)b.focus();
}
function produitHTML(c,A){
  const ref=META.max?Math.floor(Date.UTC(META.max.y,META.max.m-1,META.max.d)/86400000):null;
  const mils=Object.entries(c.millesimes).sort((a,b)=>b[1].ca-a[1].ca);
  const maxMil=mils.length?mils[0][1].ca:0;
  const conds=Object.entries(c.cond).sort((a,b)=>b[1]-a[1]);
  const moisMax=Math.max(...c.parMois);
  // Qui l'achete : les plus gros acheteurs de cette cuvee.
  const parClient={};
  ROWS.forEach(r=>{if(!r._vin||cuveeBase(r.produit||'')!==c.nom)return;
    const id=clientKey(r);const o=parClient[id]||(parClient[id]={id,nom:r.client||id,ca:0});o.ca+=r._total;});
  const acheteurs=Object.values(parClient).sort((a,b)=>b.ca-a.ca).slice(0,6);
  const conseils=[];
  if(c.top1>=60)conseils.push(`<b>Cette cuvée dépend d'un seul client</b> : ${fmtNum(c.top1,0)} % de ses ventes viennent de ${esc(c.nomTop)}. Élargis-la avant qu'il ne change d'avis.`);
  if(c.rachat>A.repRachat&&c.clients<A.repClients)conseils.push(`<b>Elle plaît plus qu'elle ne circule</b> : ${fmtNum(c.rachat*100,0)} % de reprise contre ${fmtNum(A.repRachat*100,0)} % en moyenne, pour seulement ${fmtNum(c.clients)} clients touchés.`);
  if(c.prixBas>0&&c.nPrix>=25&&c.prixHaut/c.prixBas>=1.8)conseils.push(`<b>Tes prix varient du simple au double</b> : de ${fmtNum(c.prixBas,2)} € à ${fmtNum(c.prixHaut,2)} € en ${esc(c.condDom)}. Vérifie que ce sont des tarifs voulus.`);
  if(c.delta!=null&&c.delta<0&&Math.abs(c.delta)>c.ca*0.15)conseils.push(`Elle recule de ${fmtMoney(Math.abs(c.delta))} à date égale, <b>tous millésimes confondus</b> : ce n'est donc pas un simple changement de millésime.`);
  if(!conseils.length)conseils.push(`Rien d'anormal sur cette cuvée : diffusion large, prix cohérents, pas de dépendance à un client unique.`);
  return `<div class="modale__bg" onclick="fermerFiche()"></div>
  <div class="modale__box" role="dialog" aria-modal="true" aria-label="Cuvée ${esc(c.nom)}">
    <button class="modale__close" onclick="fermerFiche()" aria-label="Fermer">&times;</button>
    <div class="fiche__head"><div>
      <h3 class="fiche__nom">${esc(c.nom)}</h3>
      <div class="fiche__meta">${fmtNum(Object.keys(c.millesimes).length)} millésime(s) · ${fmtNum(c.clients)} clients · ${fmtNum(c.part,1)} % de ton chiffre d'affaires</div>
    </div></div>
    <div class="fiche__kpis">
      ${ficheKpi(fmtMoney(c.ca),'chiffre d\'affaires',fmtNum(c.btl)+' bouteilles')}
      ${ficheKpi(fmtNum(c.prixMed,2)+' €','prix médian',c.condDom?'en '+c.condDom+', de '+fmtNum(c.prixBas,2)+' à '+fmtNum(c.prixHaut,2)+' €':'')}
      ${ficheKpi(fmtNum(c.rachat*100,0)+' %','en reprennent','moyenne du domaine '+fmtNum(A.repRachat*100,0)+' %')}
      ${c.delta!=null?ficheKpi((c.delta>=0?'+':'-')+fmtMoney(Math.abs(c.delta)),'à date égale',A.f?A.f.prev+' vs '+A.f.cur:''):ficheKpi('n/d','à date égale','deux années nécessaires')}
    </div>
    <div class="fiche__conseil">
      <div class="fiche__conseil-t">Ce que je ferais</div>
      ${conseils.map(x=>`<p>${x}</p>`).join('')}
    </div>
    <div class="fiche__cols">
      <div>
        <div class="section-label">Ses millésimes</div>
        <div class="rep">${mils.map(([m,o])=>`<div class="rep__row">
          <div class="rep__bar"><div class="rep__fill" style="width:${maxMil>0?(o.ca/maxMil*100).toFixed(1):0}%"></div><div class="rep__lbl">${esc(m)}</div></div>
          <div class="rep__val">${fmtMoney(o.ca)} <span class="rep__pct">${o.cur>0?'encore vendu':'épuisé'}</span></div></div>`).join('')}</div>
        <div class="section-label">Conditionnements</div>
        <div class="rep">${conds.map(([k,v])=>`<div class="rep__row">
          <div class="rep__bar"><div class="rep__fill" style="width:${conds[0][1]>0?(v/conds[0][1]*100).toFixed(1):0}%"></div><div class="rep__lbl">${esc(k)}</div></div>
          <div class="rep__val">${fmtNum(v)} btl</div></div>`).join('')}</div>
      </div>
      <div>
        <div class="section-label">Qui l'achète</div>
        <div class="tablewrap" style="max-height:220px;overflow-y:auto">
          <table class="data"><tbody>
          ${acheteurs.map(x=>`<tr class="clic" onclick="ouvrirFiche(${JSON.stringify(x.id).replace(/"/g,'&quot;')})"><td>${esc(x.nom)}</td><td class="num">${fmtMoney(x.ca)}</td><td class="num">${fmtNum(x.ca/c.ca*100,0)} %</td></tr>`).join('')}
          </tbody></table>
        </div>
        <p class="note">Clique sur un nom pour ouvrir sa fiche.</p>
        <div class="section-label">Quand elle se vend</div>
        <div class="fiche__mois">
          ${c.parMois.slice(1).map((v,i)=>`<div class="fiche__mois-c" title="${MOIS_FR[i]} : ${fmtMoney(v)}">
            <div class="fiche__mois-b" style="height:${moisMax>0?Math.max(2,v/moisMax*100):2}%"></div>
            <div class="fiche__mois-l">${MOIS_FR[i].slice(0,1)}</div></div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

/* ======================= FICHE CLIENT (modale) =======================
   Tout ce que la base sait d'un client, plus ce qu'on peut en deduire d'utile :
   ce qu'il achete, ce que ses semblables achetent et pas lui, quand il commande,
   et un message pre-ecrit avec ses propres donnees. Le message part par la messagerie du
   vigneron, en mailto : l'outil n'envoie rien lui-meme. */

// Nom de cuvee sans le millesime : « Le Rosé 2024 » et « Le Rosé 2025 » sont la meme cuvee.
// Sans ce nettoyage, l'outil recommanderait a un client le millesime precedent de ce qu'il boit deja.
function cuveeBase(produit){
  return String(produit||'').replace(/\s*(19|20)\d{2}\s*$/,'').trim()||String(produit||'').trim();
}
// Index cuvee <-> clients, construit une fois par base chargee.
let RECO=null;
function buildReco(){
  const parClient={},parCuvee={};
  ROWS.forEach(r=>{if(!r._vin||!r.produit)return;
    const id=clientKey(r),c=cuveeBase(r.produit);
    (parClient[id]||(parClient[id]=new Set())).add(c);
    (parCuvee[c]||(parCuvee[c]=new Set())).add(id);});
  RECO={parClient,parCuvee};
}
// Cuvees achetees par les clients qui achetent comme lui, et qu'il n'a jamais prises.
// Similarite de Jaccard : un client qui partage beaucoup pese plus qu'un client qui partage peu.
function recoPour(id,n){
  if(!RECO)buildReco();
  const mine=RECO.parClient[id];
  if(!mine||!mine.size)return [];
  const score={},voisins=new Set();
  mine.forEach(c=>RECO.parCuvee[c].forEach(o=>{if(o!==id)voisins.add(o);}));
  voisins.forEach(o=>{
    const his=RECO.parClient[o];let inter=0;
    mine.forEach(c=>{if(his.has(c))inter++;});
    const sim=inter/(mine.size+his.size-inter);
    his.forEach(c=>{if(!mine.has(c))score[c]=(score[c]||0)+sim;});});
  const tot=Object.values(score).reduce((a,b)=>a+b,0);
  return Object.entries(score).sort((a,b)=>b[1]-a[1]).slice(0,n)
    .map(([c,v])=>({cuvee:c,part:tot>0?v/tot:0,clients:RECO.parCuvee[c]?RECO.parCuvee[c].size:0}));
}

// Tout ce qu'on sait d'un client, rassemble en un objet.
function ficheClient(id){
  const lignes=ROWS.filter(r=>clientKey(r)===id);
  if(!lignes.length)return null;
  const ventes=lignes.filter(r=>r._vin);
  const base=lignes[0];
  const factures={};
  ventes.forEach(r=>{const f=r.numFacture||'?';
    const o=factures[f]||(factures[f]={num:f,date:r._date,jour:r._dayNum,total:0,btl:0,lignes:0,canal:r._canal});
    o.total+=r._total;o.btl+=r._qte;o.lignes++;});
  const listeF=Object.values(factures).sort((a,b)=>(b.jour||0)-(a.jour||0));
  const ca=sum(ventes,r=>r._total), btl=sum(ventes,r=>r._qte);
  const jours=[...new Set(ventes.map(r=>r._dayNum).filter(v=>v!=null))].sort((a,b)=>a-b);
  const interv=[];for(let i=1;i<jours.length;i++)interv.push(jours[i]-jours[i-1]);
  const parCuvee={};
  ventes.forEach(r=>{const c=r.produit||'(sans nom)';
    const o=parCuvee[c]||(parCuvee[c]={ca:0,btl:0});o.ca+=r._total;o.btl+=r._qte;});
  const parMois=new Array(13).fill(0);
  ventes.forEach(r=>{if(r._date)parMois[r._date.m]+=r._total;});
  const parAn={};
  ventes.forEach(r=>{if(r._exY!=null)parAn[r._exY]=(parAn[r._exY]||0)+r._total;});
  const offerts=lignes.filter(r=>r._offert);
  const pxRef=offerts.length?prixVenteMoyen():null;   // calcule une fois, pas une fois par ligne
  return {id,nom:base.client||id,ville:base.ville||'',cp:base.cp||'',pays:base.pays||'',
    type:base._typeClient||'',tarif:base.codeTarif||'',commercial:base.commercial||'',
    origine:base.origine||'',lieu:base.lieuVente||'',
    ca,btl,nbFactures:listeF.length,factures:listeF,
    // « Commandes » = jours d'achat distincts, comme partout ailleurs dans l'outil.
    // Deux factures editees le meme jour sont un seul passage, pas deux commandes.
    nbCommandes:jours.length,
    panier:jours.length?ca/jours.length:0,
    prixMoyen:btl>0?ca/btl:0,
    premier:jours.length?dayToDate(jours[0]):null,
    dernier:jours.length?dayToDate(jours[jours.length-1]):null,
    silence:jours.length&&META.max?Math.floor(Date.UTC(META.max.y,META.max.m-1,META.max.d)/86400000)-jours[jours.length-1]:null,
    cadence:interv.length?median(interv):null,
    cuvees:Object.entries(parCuvee).sort((a,b)=>b[1].ca-a[1].ca),
    parMois,parAn,
    offerts:offerts.length,coutOfferts:pxRef?sum(offerts,r=>coutOffertLigne(r,pxRef)):0,
    emails:emailsOf(id),tels:telsOf(id)};
}

// Le conseil : il depend du motif, mais il est ecrit avec les chiffres DU client.
function conseilClient(f,motif){
  const moisFort=(()=>{let m=0,v=-1;for(let i=1;i<=12;i++)if(f.parMois[i]>v){v=f.parMois[i];m=i;}return m;})();
  const nomMois=MOIS_FR[moisFort-1]||'';
  const rang=rangClient(f.ca);
  const parts=[];
  if(motif==='recul'){
    parts.push(`Ce client <b>achetait et achète moins</b>. C'est le signal le plus fiable de l'outil, parce qu'il compare deux périodes équivalentes.`);
    parts.push(`Il a commandé ${f.nbCommandes} fois pour ${fmtMoney(f.ca)}. <b>Appelle-le plutôt que de lui écrire</b> : à ce niveau d'historique, un e-mail passe pour une relance de masse.`);
  }else if(motif==='cadence'){
    const fiable=f.nbCommandes>=3;
    parts.push(`Ce client a un rythme : environ une commande tous les ${fmtDelai(f.cadence)}. Il n'a rien pris depuis ${fmtDelai(f.silence)}.`);
    if(!fiable)parts.push(`<b>Prudence</b> : ce rythme est déduit de ${plur(f.nbCommandes,'commande')} seulement, l'outil ne peut pas en dire beaucoup plus. Vérifie avant d'insister.`);
    parts.push(`<b>Le bon prétexte est le réassort</b>, pas la nouveauté. Propose-lui ce qu'il prend d'habitude, dans la quantité qu'il prend d'habitude.`);
  }else{
    parts.push(`Ce client n'est venu qu'une fois, le ${fmtDate(f.premier)}, pour ${fmtMoney(f.ca)}.`);
    parts.push(`<b>Il ne repassera pas au caveau tout seul.</b> Le seul message qui transforme, c'est celui qui lève l'obstacle : lui dire que tu livres, et à partir de combien de bouteilles.`);
  }
  if(rang<=10)parts.push(`Il fait partie de tes <b>${rang} % de meilleurs clients</b>. À traiter en personne, pas dans un envoi groupé.`);
  if(moisFort&&f.parMois[moisFort]>f.ca*0.5)parts.push(`Il commande surtout en <b>${nomMois}</b> : c'est le moment où le message a le plus de chances de tomber juste.`);
  if(!f.emails.length&&f.tels.length)parts.push(`Pas d'adresse e-mail connue, mais un numéro : <b>c'est un appel, pas un message</b>.`);
  if(!f.emails.length&&!f.tels.length)parts.push(`<b>Aucun contact enregistré.</b> Le premier travail est de récupérer une adresse ou un numéro dans ton logiciel.`);
  return parts;
}
// Position du client dans la base, en pourcentage (1 = tout en haut).
// Le classement est calcule une fois par base chargee, pas a chaque ouverture de fiche.
let CLASSEMENT=null;
function rangClient(ca){
  if(!CLASSEMENT){
    const m={};ROWS.forEach(r=>{if(!r._vin)return;const id=clientKey(r);m[id]=(m[id]||0)+r._total;});
    CLASSEMENT=Object.values(m).sort((a,b)=>b-a);
  }
  const t=CLASSEMENT;if(!t.length)return 100;
  // recherche dichotomique du premier montant inferieur ou egal
  let lo=0,hi=t.length;while(lo<hi){const mid=(lo+hi)>>1;if(t[mid]>ca)lo=mid+1;else hi=mid;}
  return Math.max(1,Math.round((lo+1)/t.length*100));
}
/* ======================= COMPOSITEUR DE MESSAGE =======================
   Le message n'est plus un texte fige : c'est une accroche liee au motif, plus des blocs
   que le vigneron coche. Deliberement, on ne deverse PAS l'inventaire complet des achats :
   un client qui recoit son releve de compte trouve ca froid, pas attentionne. On nomme
   deux ou trois references, avec les quantites reelles, et on s'arrete la. */

// Ses cuvees principales, avec la quantite reelle : « 12 bouteilles du Rosé 2024 ».
function detailAchats(f,n){
  return f.cuvees.slice(0,n).map(([nom,v])=>`${fmtNum(v.btl)} ${v.btl>1?'bouteilles':'bouteille'} ${avecDe(nom)}`);
}
// « PARIS 12 » saisi en capitales devient « Paris 12 » dans un objet d'e-mail.
function villeJolie(v){
  return String(v||'').toLowerCase().replace(/(^|[\s'-])([a-zàâäéèêëîïôöùûüç])/g,(m,a,b)=>a+b.toUpperCase());
}
// « de Le Rosé » se dit « du Rosé ». Petite grammaire, grand effet sur la credibilite.
function avecDe(nom){
  const t=String(nom||'').trim();
  if(/^le\s/i.test(t))return 'du '+t.slice(3);
  if(/^les\s/i.test(t))return 'des '+t.slice(4);
  if(/^la\s/i.test(t))return 'de la '+t.slice(3);
  if(/^l'/i.test(t))return "de l'"+t.slice(2);
  return 'de '+t;
}
// Apres « ceux qui aiment », il faut « le Miracle », pas « du Miracle ».
function avecLe(nom){
  const t=String(nom||'').trim();
  return /^(le |la |les |l')/i.test(t)?t.charAt(0).toLowerCase()+t.slice(1):'le '+t;
}
function listeFr(arr){
  if(!arr.length)return '';
  if(arr.length===1)return arr[0];
  return arr.slice(0,-1).join(', ')+' et '+arr[arr.length-1];
}
// Les blocs disponibles pour ce client. Chacun n'apparait que si la donnee existe.
function blocsMessage(f,motif){
  const b=[];
  const derniere=f.factures.length?f.factures[0]:null;
  const lignesDerniere=derniere?ROWS.filter(r=>r._vin&&clientKey(r)===f.id&&r.numFacture===derniere.num):[];
  const estPro=/^(CAV|CHR|RESTAU|EXPORT|PRO)/i.test(f.type||'')||f.btl>=60;
  if(f.cuvees.length)
    b.push({k:'achats',lbl:'Rappeler ce qu\'il a pris',defaut:true,
      txt:estPro
        ? `Vos commandes portaient sur ${listeFr(detailAchats(f,2))}.`
        : `Vous étiez reparti avec ${listeFr(detailAchats(f,2))}.`});
  if(lignesDerniere.length&&f.nbCommandes>1)
    b.push({k:'reassort',lbl:'Proposer le même réassort',defaut:motif==='cadence',
      txt:`Si vous le souhaitez, je vous prépare la même chose que la dernière fois : ${listeFr(lignesDerniere.slice(0,3).map(r=>`${fmtNum(r._qte)} ${avecDe(r.produit)}`))}.`});
  const reco=recoPour(f.id,1);
  if(reco.length&&f.cuvees.length)
    b.push({k:'nouveaute',lbl:'Suggérer une cuvée qu\'il ne connaît pas',defaut:motif!=='cadence',
      txt:`Une chose : beaucoup de ceux qui aiment ${avecLe(cuveeBase(f.cuvees[0][0]))} prennent aussi ${avecLe(reco[0].cuvee)}. Je peux vous en glisser quelques bouteilles pour goûter.`});
  b.push({k:'livraison',lbl:estPro?'Proposer une expédition':'Rappeler que tu livres',defaut:motif==='premier'&&!estPro,
    txt:estPro?`Je peux organiser l'expédition dès que vous me donnez le feu vert.`
           :`Je peux vous l'expédier directement, sans que vous ayez à repasser.`});
  const moisFort=(()=>{let m=0,v=-1;for(let i=1;i<=12;i++)if(f.parMois[i]>v){v=f.parMois[i];m=i;}return m;})();
  if(moisFort&&f.parMois[moisFort]>f.ca*0.4)
    b.push({k:'saison',lbl:'Mentionner sa saison d\'achat',defaut:false,
      txt:`Je sais que ${MOIS_PLEIN[moisFort-1]} est votre période, je prends un peu d'avance.`});
  return b;
}
function accrocheMessage(f,motif){
  // Un caviste qui a pris 500 bouteilles n'est pas « passé au caveau ». Le volume et le type
  // de client disent lequel des deux on a en face, et la phrase change en consequence.
  const pro=/^(CAV|CHR|RESTAU|EXPORT|PRO)/i.test(f.type||'')||f.btl>=60;
  if(motif==='premier')return pro
    ? `Nous avons honoré votre première commande le ${fmtDate(f.premier)}, et j'espère qu'elle vous a donné satisfaction.`
    : `Vous êtes passé chez nous le ${fmtDate(f.premier)}, et j'espère que le vin a été à la hauteur.`;
  if(motif==='cadence')return `Vous avez l'habitude de commander tous les ${fmtDelai(f.cadence)} environ, et cela fait ${fmtDelai(f.silence)} que nous n'avons pas eu de vos nouvelles.`;
  return `Je reprends contact : nos échanges se sont espacés cette année, alors que vous étiez un client régulier.`;
}
function sujetMessage(f,motif){
  const cuvee=f.cuvees.length?f.cuvees[0][0]:'nos vins';
  if(motif==='premier')return `${cuvee} vous suit${f.ville?' à '+villeJolie(f.ville):''}`;
  if(motif==='cadence')return `${cuvee}, on vous en remet ?`;
  return `Prendre de vos nouvelles`;
}
// Assemble le message a partir des blocs coches.
function composerMessage(f,motif,coches){
  const b=blocsMessage(f,motif).filter(x=>coches.indexOf(x.k)>=0);
  const corps=['Bonjour,','',accrocheMessage(f,motif)];
  if(b.length){corps.push('');corps.push(b.map(x=>x.txt).join(' '));}
  corps.push('','Dites-moi simplement ce qui vous ferait plaisir.','','Bien à vous,');
  return corps.join('\n');
}
function majMessage(){
  const z=el('msgZone');if(!z)return;
  const f=ficheClient(z.dataset.id),motif=z.dataset.motif;
  const coches=[...document.querySelectorAll('#msgBlocs input:checked')].map(i=>i.value);
  const ta=el('msgTexte');if(ta)ta.value=composerMessage(f,motif,coches);
  majLienMail();
}
function majLienMail(){
  const a=el('msgOuvrir'),ta=el('msgTexte'),z=el('msgZone');
  if(!a||!ta||!z)return;
  a.href=`mailto:${encodeURIComponent(z.dataset.mail)}?subject=${encodeURIComponent(el('msgSujet').value)}&body=${encodeURIComponent(ta.value)}`;
}
function copierMessage(btn){
  const ta=el('msgTexte');if(!ta)return;
  const fini=ok=>{btn.textContent=ok?'Copié':'Sélectionne et copie';setTimeout(()=>{btn.textContent='Copier le texte';},1800);};
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(ta.value).then(()=>fini(true)).catch(()=>{ta.select();fini(false);});
  }else{ta.select();fini(false);}
}
// Le bloc « Message » de la fiche client.
function messageHTML(f,motif){
  if(!f.emails.length&&!f.tels.length)return '';
  const blocs=blocsMessage(f,motif);
  const coches=blocs.filter(b=>b.defaut).map(b=>b.k);
  const sujet=sujetMessage(f,motif);
  const texte=composerMessage(f,motif,coches);
  const mail=f.emails[0]||'';
  return `<div class="msg" id="msgZone" data-id="${esc(f.id)}" data-motif="${esc(motif)}" data-mail="${esc(mail)}">
    <div class="section-label" style="margin-top:0">Le message</div>
    <div class="msg__blocs" id="msgBlocs">
      ${blocs.map(b=>`<label class="chk"><input type="checkbox" value="${b.k}" ${coches.indexOf(b.k)>=0?'checked':''} onchange="majMessage()"> ${esc(b.lbl)}</label>`).join('')}
    </div>
    <label class="msg__lbl">Objet</label>
    <input class="msg__sujet" id="msgSujet" type="text" value="${esc(sujet)}" oninput="majLienMail()">
    <label class="msg__lbl">Texte, modifiable avant envoi</label>
    <textarea class="msg__texte" id="msgTexte" rows="11" oninput="majLienMail()">${esc(texte)}</textarea>
    <div class="fiche__actions">
      ${mail?`<a class="btn btn--primary btn--sm" id="msgOuvrir" href="#">Ouvrir dans ma messagerie</a>`:''}
      <button class="btn btn--ghost btn--sm" onclick="copierMessage(this)">Copier le texte</button>
      ${f.tels.length?`<a class="btn btn--ghost btn--sm" href="tel:${esc(f.tels[0].appel)}">Appeler ${esc(f.tels[0].affiche)}</a>`:''}
    </div>
    ${mail?'':'<p class="note">Pas d\'adresse e-mail pour ce client : copie le texte ou appelle-le.</p>'}
  </div>`;
}

let FICHE_OUVERTE=null;
// L'identifiant du client dont la fiche est ouverte. Distinct de FICHE_OUVERTE, qui porte
// l'element a qui rendre le focus a la fermeture : comparer un element DOM a une chaine
// est toujours faux, et la fiche ne se redessinait donc jamais apres un geste.
let FICHE_ID=null;
function ouvrirFiche(id,motif){
  const f=ficheClient(id);
  if(!f){status('error','Client introuvable.');return;}
  // On ne memorise l'element focalise QUE si la fiche n'etait pas deja ouverte : un
  // redessin apres un geste garderait sinon un bouton du journal comme cible de retour.
  if(FICHE_ID!==id)FICHE_OUVERTE=document.activeElement;
  FICHE_ID=id;
  const m=el('modale');
  m.innerHTML=ficheHTML(f,motif||(CLIENTS.find(c=>c.id===id)||{}).motif||'');
  monterSelectCanal();
  m.classList.add('on');
  m.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
  const btn=m.querySelector('.modale__close');if(btn)btn.focus();
  majLienMail();   // le lien de messagerie se construit a partir des champs affiches
}
function fermerFiche(){
  const m=el('modale');m.classList.remove('on');m.setAttribute('aria-hidden','true');
  m.innerHTML='';document.body.style.overflow='';
  if(FICHE_OUVERTE&&FICHE_OUVERTE.focus)FICHE_OUVERTE.focus();
  FICHE_OUVERTE=null;FICHE_ID=null;
}
function ficheHTML(f,motif){
  const lib=MOTIFS[motif]?MOTIFS[motif].label:'';
  const cls=MOTIFS[motif]?MOTIFS[motif].cls:'';
  const conseils=conseilClient(f,motif||'premier');
  const s=CRM[f.id]||{};
  const maxCuvee=f.cuvees.length?f.cuvees[0][1].ca:0;
  const reco=recoPour(f.id,3);
  const prixBase=prixVenteMoyen();
  const moisMax=Math.max(...f.parMois);
  return `<div class="modale__bg" onclick="fermerFiche()"></div>
  <div class="modale__box" role="dialog" aria-modal="true" aria-label="Fiche de ${esc(f.nom)}">
    <button class="modale__close" onclick="fermerFiche()" aria-label="Fermer">&times;</button>

    <div class="fiche__head">
      <div>
        <h3 class="fiche__nom">${esc(f.nom)}</h3>
        <div class="fiche__meta">
          ${f.ville?esc(f.ville)+(f.cp?' '+esc(f.cp):'')+' · ':''}${f.pays?esc(f.pays)+' · ':''}client n°${esc(f.id)}
          ${f.tarif?' · tarif '+esc(f.tarif):''}${f.commercial?' · suivi par '+esc(f.commercial):''}
        </div>
      </div>
      ${lib?`<span class="motif ${cls}">${lib}</span>`:''}
    </div>

    <div class="fiche__contacts">
      ${f.emails.map(e=>`<a class="chipc" href="mailto:${esc(e)}">✉ ${esc(e)}</a>`).join('')}
      ${f.tels.map(t=>`<a class="chipc" href="tel:${esc(t.appel)}">☎ ${esc(t.affiche)}</a>`).join('')}
      ${(!f.emails.length&&!f.tels.length)?'<span class="muted-cell">aucun contact enregistré</span>':''}
    </div>

    <div class="fiche__kpis">
      ${ficheKpi(fmtMoney(f.ca),'chiffre d\'affaires','top '+rangClient(f.ca)+' % de tes clients')}
      ${ficheKpi(fmtNum(f.nbCommandes),f.nbCommandes>1?'commandes':'commande',
        (f.nbCommandes>1?'panier moyen '+fmtMoney(f.panier):'jamais revenu')
        +(f.nbFactures>f.nbCommandes?', '+fmtNum(f.nbFactures)+' factures':''))}
      ${ficheKpi(fmtNum(f.btl),'bouteilles',fmtNum(f.prixMoyen,2)+' € en moyenne'+(prixBase?', domaine '+fmtNum(prixBase,2)+' €':''))}
      ${ficheKpi(f.dernier?fmtDate(f.dernier):'n/d','dernier achat',f.silence!=null?'il y a '+fmtDelai(f.silence):'')}
    </div>

    <div class="fiche__conseil">
      <div class="fiche__conseil-t">Ce que je ferais</div>
      ${conseils.map(c=>`<p>${c}</p>`).join('')}
    </div>

    ${suiviHTML(f,s)}

    ${(f.emails.length||f.tels.length)?`<details class="msg msg--replie"><summary>Écrire un message à ce client</summary>${messageHTML(f,motif||'premier')}</details>`:''}

    <div class="fiche__cols">
      <div>
        <div class="section-label">Ce qu'il achète</div>
        <div class="rep">
          ${f.cuvees.slice(0,7).map(([c,v])=>`<div class="rep__row">
            <div class="rep__bar"><div class="rep__fill" style="width:${maxCuvee>0?(v.ca/maxCuvee*100).toFixed(1):0}%"></div><div class="rep__lbl">${esc(c)}</div></div>
            <div class="rep__val">${fmtMoney(v.ca)} <span class="rep__pct">${fmtNum(v.btl)} btl</span></div></div>`).join('')}
        </div>
        ${f.cuvees.length>7?`<p class="note">et ${f.cuvees.length-7} autre(s) référence(s).</p>`:''}
        ${reco.length?`<div class="section-label">Ce qu'il ne prend jamais</div>
          <div class="fiche__reco">
            ${reco.map(r=>`<div class="fiche__reco-l"><b>${esc(r.cuvee)}</b><span class="muted-cell">${fmtNum(r.clients)} de tes clients en prennent, dont ceux qui achètent comme lui</span></div>`).join('')}
          </div>
          <p class="note">Calculé sur les clients qui achètent les mêmes cuvées que lui, millésimes confondus.</p>`:''}
      </div>
      <div>
        <div class="section-label">Ses commandes</div>
        <div class="tablewrap" style="max-height:270px;overflow-y:auto">
          <table class="data"><thead><tr><th>Date</th><th class="num">Montant</th><th class="num">Btl</th><th>Où</th></tr></thead><tbody>
          ${f.factures.map(x=>`<tr><td>${fmtDate(x.date)}</td><td class="num">${fmtMoney(x.total)}</td><td class="num">${fmtNum(x.btl)}</td><td>${esc(x.canal||'')}</td></tr>`).join('')}
          </tbody></table>
        </div>
        <div class="section-label">Quand il commande</div>
        <div class="fiche__mois">
          ${f.parMois.slice(1).map((v,i)=>`<div class="fiche__mois-c" title="${MOIS_FR[i]} : ${fmtMoney(v)}">
            <div class="fiche__mois-b" style="height:${moisMax>0?Math.max(2,v/moisMax*100):2}%"></div>
            <div class="fiche__mois-l">${MOIS_FR[i].slice(0,1)}</div></div>`).join('')}
        </div>
        ${f.offerts?`<p class="note">${plur(f.offerts,'ligne')} offerte(s) ou perdue(s), ${fmtMoney(f.coutOfferts)} au prix de vente moyen.</p>`:''}
      </div>
    </div>
  </div>`;
}
/* ======================= LE SUIVI D'UN CLIENT =======================
   Refait a zero le 06/09/2026. Il y avait trois systemes empiles qui faisaient le meme
   travail : un bloc de reglages (statut, rappel, canal, notes), un journal avec ses
   propres boutons, et un redacteur de message deplie en permanence. Ted : « usine a gaz ».

   Ce que font tous les bons CRM, et qui tient en deux idees :

     1. UN CLIENT A UNE PROCHAINE ACTION, ou il n'en a pas. C'est l'information la plus
        importante de la fiche, elle est en haut, en clair, et elle se change en un clic.
        Un client sans prochaine action est un client qu'on va oublier.
     2. TOUT LE RESTE EST UN FIL. Un appel, un message, une note : ce sont des evenements
        dates, dans une seule liste. Pas de « note durable » d'un cote et de « journal »
        de l'autre : c'est la meme chose ecrite deux fois.

   Ce qui a disparu, et pourquoi :
     - le STATUT (a faire / relance / traite) : redondant. Un client a une prochaine
       action ou il n'en a pas, c'est le seul statut qui se verifie tout seul. Le champ
       reste en base, il n'est plus demande. Seul « traite » subsiste, sous le nom qu'il
       merite : « ne plus me le proposer ».
     - le CANAL PREFERE : une preference qu'on saisissait et que rien ne lisait. Le fil
       dit par quoi on a joint ce client la derniere fois, c'est plus fiable.
     - la separation NOTES / JOURNAL : une seule zone de saisie.
     - le redacteur de message : replie derriere un bouton. C'est un assistant de
       redaction, pas du suivi.

   Les notes deja ecrites ne sont pas perdues : elles s'affichent en tete du fil. */
/* Le canal du prochain enregistrement. Treize choix desormais, donc une liste deroulante
   et non plus trois boutons : treize boutons pousseraient le champ de saisie hors de
   l'ecran sur un telephone. La valeur par defaut vient de bdv-canaux.js. */
let ACTIVITE_CANAL=(window.BdvCanaux?BdvCanaux.DEFAUT:'appel');
function choisirCanal(v){ACTIVITE_CANAL=v;}
/* Le <select> est rempli en DOM apres l'insertion du HTML de la fiche : construire des
   <option> en chaine obligerait a echapper des libelles, et un jour l'un d'eux porterait
   une apostrophe qui casserait la fiche entiere. */
function monterSelectCanal(){
  const s=el('saisieCanal');
  if(s&&window.BdvCanaux)BdvCanaux.remplirSelect(s,ACTIVITE_CANAL);
}

function suiviHTML(f,s){
  return `<div class="msg" id="suiviBloc">${suiviCorps(f,s)}</div>`;
}

function suiviCorps(f,s){
  const arg=JSON.stringify(String(f.id)).replace(/"/g,'&quot;');
  const ech=echDe(f.id);
  const clos=s.statut==='traite';

  // ---- La prochaine action, en tete. Le reste de la fiche en decoule. ----
  let action;
  if(clos){
    action=`<span class="action__non">Client mis de côté.</span>
      <button class="btn btn--ghost btn--sm" onclick="rouvrir(${arg})">Le remettre dans ma file</button>`;
  }else if(s.rappel){
    const j=jourDepuisISO(s.rappel), auj=Math.floor(Date.now()/86400000);
    const retard=j!=null?auj-j:0;
    action=`<span class="action__oui${retard>0?' action__oui--retard':''}">`
      +(retard>0?`À rappeler depuis le ${fmtDateIso(s.rappel)}`
        :retard===0?`À rappeler aujourd'hui`
        :`À rappeler le ${fmtDateIso(s.rappel)}`)
      +`</span>`
      +`<input type="date" class="action__date" value="${esc(s.rappel)}" aria-label="Changer la date"
               onchange="crmSet(${arg},'rappel',this.value)">`
      +`<button class="btn btn--ghost btn--sm" onclick="crmSet(${arg},'rappel','')">Retirer</button>`;
  }else{
    action=`<span class="action__non">Aucune action prévue. Ce client va sortir de ta tête.</span>`
      +[7,30,90].map(n=>`<button class="btn btn--ghost btn--sm" onclick="planifier(${arg},${n})">Dans ${n} j</button>`).join('')
      +`<button class="btn btn--ghost btn--sm" onclick="clore(${arg})">Ne plus me le proposer</button>`;
  }

  let h=`<div class="section-label" style="margin-top:0">Suivi</div>
    <div class="action">${action}</div>`;

  // ---- La saisie : une seule, toujours au meme endroit. ----
  if(!clos){
    h+=`<div class="saisie">
      <textarea class="saisie__txt" id="saisieTxt" rows="2"
        placeholder="Qu'est-ce qui s'est passé avec ce client ?"></textarea>
      <div class="saisie__pied">
        <div class="saisie__types">
          <label class="saisie__etiq" for="saisieCanal">Par</label>
          <select class="saisie__canal" id="saisieCanal" onchange="choisirCanal(this.value)"></select>
        </div>
        <button class="btn btn--primary btn--sm" onclick="noter(${arg})">Enregistrer</button>
      </div>
    </div>`;
  }

  // ---- Les etiquettes, discretes. ----
  h+=`<input class="etiq" type="text" value="${esc((s.tags||[]).join(', '))}"
        placeholder="Étiquettes : VIP, difficile à joindre…" onchange="crmSetTags(${arg},this.value)">`;

  // ---- Le fil. Les anciennes notes ouvrent la marche, elles ne sont pas perdues. ----
  h+=`<div class="fil">`;
  if(s.notes){
    h+=`<div class="fil__l fil__l--note">
      <span class="fil__ico" aria-hidden="true">&#128204;</span>
      <span class="fil__quand">épinglé</span>
      <span class="fil__quoi">${esc(s.notes)}
        <button class="btn--lien" onclick="crmSet(${arg},'notes','')">retirer</button></span>
    </div>`;
  }
  if(!ech.length&&!s.notes){
    h+=`<p class="fil__vide">Rien encore. La première chose que tu écris s'inscrit ici, datée.</p>`;
  }else{
    h+=ech.slice(0,40).map(function(e){
      const t=libEchange(e);
      const d=new Date(e.le);
      const quand=isNaN(d)?'':d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
      return `<div class="fil__l">
        <span class="fil__ico" aria-hidden="true">${t.ico}</span>
        <span class="fil__quand">${esc(quand)}</span>
        <span class="fil__quoi">${e.resume?esc(e.resume):'<i>'+esc(t.label)+'</i>'}</span>
      </div>`;
    }).join('');
    if(ech.length>40)h+=`<p class="fil__vide">${plur(ech.length-40,'entrée')} plus ancienne(s) non affichée(s).</p>`;
  }
  h+=`</div>`;
  return h;
}

/* Enregistrer une activite, puis demander la suite. C'est le geste central : un CRM ne
   laisse jamais une fiche sans prochaine action apres qu'on y a touche. */
function noter(id){
  const champ=el('saisieTxt');if(!champ)return;
  const t=champ.value.trim();
  if(!t){status('error','Écris ce qui s\'est passé avant d\'enregistrer.');champ.focus();return;}
  // Le canal n'est plus DEDUIT du type. La deduction d'avant classait tout « message »
  // en E-mail ici, alors que le meme geste pose depuis la file du bureau etait classe
  // Telephone : deux lignes du meme journal disaient deux choses du meme acte.
  const c=window.BdvCanaux?BdvCanaux.canal(ACTIVITE_CANAL):null;
  echAjouter(id,c?c.type:'note',c?c.cle:null,t);
  champ.value='';
  const s=CRM[id]||{};
  redessinerSuivi(id);
  // Pas de rappel en cours : c'est le moment de le demander, pas plus tard.
  if(!s.rappel)status('success','Enregistré. Pose une date de rappel juste au-dessus.');
  else status('success','Enregistré.');
}
function planifier(id,jours){
  crmSet(id,'rappel',isoDepuisJour(Math.floor(Date.now()/86400000)+jours));
}
function clore(id){
  echAjouter(id,'ecarte',null,'Mis de côté');
  crmSetPlusieurs(id,{statut:'traite',rappel:''});
  redessinerSuivi(id);
  status('success','Ce client ne te sera plus proposé.');
}
function rouvrir(id){
  crmSetPlusieurs(id,{statut:''});
  redessinerSuivi(id);
}
// Redessine le bloc de suivi SEUL. Redessiner la fiche entiere ferait perdre le focus et
// le contenu en cours de frappe des autres champs.
function redessinerSuivi(id){
  const boite=el('suiviBloc');if(!boite||FICHE_ID!==id)return;
  const f=ficheClient(id);if(!f)return;
  boite.innerHTML=suiviCorps(f,CRM[id]||{});
  monterSelectCanal();
}

// Un geste pose depuis la fiche : meme effet que dans la file, plus le redessin de la
// fiche ouverte, sinon le vigneron ne voit pas ce qu'il vient d'ecrire.
// Conserve pour la compatibilite : plus aucun ecran ne l'appelle depuis que la fiche a
// sa propre zone de saisie, mais geste() reste le chemin unique si un bouton revient.
function gesteFiche(cle,id){geste(cle,id);redessinerSuivi(id);}
function ficheKpi(val,lbl,sub){
  return `<div class="fiche__kpi"><div class="fiche__kpi-v">${val}</div><div class="fiche__kpi-l">${esc(lbl)}</div><div class="fiche__kpi-s">${esc(sub||'')}</div></div>`;
}


/* ======================= CE QU'ON DEPOSE POUR LE BUREAU =======================
   Decision du 06/09/2026 : le poste de travail est /mon-bureau/, pas cet outil. Mais les
   moteurs qui savent QUI rappeler tournent ici, sur les lignes de vente.

   Alors le tableau de bord calcule et DEPOSE, le bureau lit et AGIT. Aucun calcul n'est
   recopie cote site : deux moteurs finiraient par diverger, et le bureau signalerait un
   client que cet outil ne signale plus.

   On ne depose QUE les signaux. Les rappels poses a la main, le bureau les lit lui-meme
   dans `suivi_clients`, en direct : deposes ici, ils seraient figes au dernier import et
   un rappel pose depuis le telephone n'apparaitrait jamais.

   PLAFOND : 40 clients. Au-dela ce n'est plus une file, c'est la liste des clients, et
   elle vit dans l'ecran d'a cote. */
const FILE_MAX=40;
function fileSignaux(){
  const base=(CLIENTS&&CLIENTS.length)?CLIENTS:agentClients();
  return base.filter(function(c){
    // Un client deja suivi sort de la file : le vigneron a decide de le revoir plus tard,
    // ou l'a traite. Sa decision prime sur le signal.
    const suivi=CRM[c.id];
    return !(suivi&&(suivi.rappel||suivi.statut==='traite'));
  }).slice(0,FILE_MAX).map(function(c){
    return {id:c.id,nom:c.nom,motif:c.motif,montant:c.montant||0,lib:c.lib||'',
            detail:c.detail||'',contact:contactTexte(c.id)||''};
  });
}

/* L'annuaire des clients SUIVIS. Indispensable et pas evident : un client sur lequel un
   rappel est pose sort de fileSignaux() par construction. Le jour ou son rappel tombe, le
   bureau a son identifiant et rien d'autre, et afficherait un numero client a la place
   d'un nom. L'annuaire ne porte que les clients qui ont une fiche de suivi, pas les
   milliers de la base. */
const ANNU_KEY='bdv_annuaire_v1';
function annuaireSuivis(){
  // L'annuaire est CUMULATIF et persistant. Un client suivi mais absent du dernier
  // export (base videe, export plus etroit) n'a plus de nom dans ROWS : sans memoire,
  // le bureau afficherait son numero Vitisoft brut le jour ou son rappel tombe.
  let out={};
  try{out=JSON.parse(localStorage.getItem(ANNU_KEY))||{};}catch(e){out={};}
  Object.keys(CRM).forEach(function(id){
    const n=nomClient(id);
    if(n&&n!==id)out[id]=n;
  });
  try{localStorage.setItem(ANNU_KEY,JSON.stringify(out));}catch(e){}
  return out;
}

/* Le resume des ventes, quatre chiffres pour l'en-tete du bureau. Meme regle : ils sont
   CALCULES ici, jamais recalcules la-bas. */
function resumeVentes(){
  if(!ROWS.length)return null;
  const xs=META.exercices;
  const cur=xs.length?xs[xs.length-1]:null;
  const curRows=cur!=null?ROWS.filter(r=>r._vin&&r._exY===cur):[];
  const ca=sum(curRows,r=>r._total);
  const factures=new Set();curRows.forEach(r=>{if(r.numFacture)factures.add(r.numFacture);});
  const clients=new Set();curRows.forEach(r=>clients.add(clientKey(r)));
  // La comparaison a date egale, et l'atterrissage projete. Un chiffre d'affaires seul
  // ne dit rien : ce qui compte, c'est s'il monte ou s'il descend, et ou il finira.
  const y=yoyTotals();
  const at=computeAtterrissage();
  /* LA SERIE MENSUELLE DE L'EXERCICE, ajoutee le 09/09/2026 pour l'histogramme
     du courrier du matin. `_exM` est le rang du mois DANS l'exercice, 1 a 12,
     donc cette serie est deja dans l'ordre de l'exercice et pas de l'annee
     civile : un domaine qui ouvre en avril aura avril en premiere case.
     On depose AUSSI `moisDebut` et `dernierMois`, et le second n'est pas du
     confort. Sans lui, un mois a venir et un mois a zero se dessinent
     pareil : une barre absente. Le courrier dirait « aucune vente en mars »
     d'un mois qui n'est pas arrive. `dernierMois` est le dernier mois qui
     PORTE des ventes, et le nom le dit : ce n'est pas exactement le nombre de
     mois ecoules si le mois en cours n'a encore rien vendu. */
  const parMois=new Array(13).fill(0);
  let dernierMois=0;
  curRows.forEach(r=>{
    if(r._exM>=1&&r._exM<=12){parMois[r._exM]+=r._total;if(r._exM>dernierMois)dernierMois=r._exM;}
  });
  return {
    exercice: cur!=null?exLabel(cur):null,
    mois: parMois.slice(1).map(v=>Math.round(v)),
    moisDebut: EX_START,
    dernierMois: dernierMois||null,
    ca: Math.round(ca),
    variation: (y&&y.d!=null)?Math.round(y.d*10)/10:null,
    variationEuros: y?Math.round(y.cur-y.prev):null,
    objectif: objectif||null,
    objectifPct: (objectif&&objectif>0)?Math.round(ca/objectif*100):null,
    atterrissage: (at&&!at.complete&&at.central!=null)?Math.round(at.central):null,
    clients: clients.size,
    panier: factures.size?Math.round(ca/factures.size):null,
    lignes: ROWS.length,
    du: META.min?fmtDate(META.min):null,
    au: META.max?fmtDate(META.max):null
  };
}

/* Les conseils, tels que le tableau de bord les formule DEJA dans son diagnostic. On ne
   les reecrit pas et on n'en invente pas : diagnosticSignals() les produit, tries par
   gravite puis par euros en jeu, et on depose les six premiers.

   Les conseils purement informatifs (severite 0) sont ecartes : « ton mois le plus creux
   est fevrier » est vrai toute l'annee, donc ce n'est pas un conseil du jour. */
function conseilsPourLeBureau(){
  try{
    return diagnosticSignals()
      .filter(function(x){ return x.sev>0; })
      .slice(0,6)
      .map(function(x){
        return {sev:x.sev,kind:x.kind,ico:x.ico,verdict:x.verdict,action:x.action};
      });
  }catch(e){ return []; }
}

/* Depot silencieux, jamais bloquant : le tableau de bord ne doit pas dependre du reseau
   pour s'afficher, c'est la regle d'or du projet.

   ELLE REND SA PROMESSE DEPUIS LE 08/09/2026, et l'appelant reste libre de l'ignorer.
   renderAll() l'appelle cinquante fois par session et ne l'attend pas, comme avant. Mais
   analyserPourLeBureau() (bdv-base.js), lui, doit RELIRE le serveur juste apres pour
   repeindre « Ma journee » : sans cette promesse il relisait la table avant que le depot
   y soit arrive, et le bureau repeignait l'analyse precedente. Une course invisible, qui
   se serait vue une fois sur trois selon la latence du reseau.

   Rendre `null` quand il n'y a rien a deposer est volontaire : l'appelant distingue
   « depose » de « rien a faire » sans avoir a refaire le test de session. */
function deposerPourLeBureau(){
  if(!syncPret()||!BdvSync.deposerFile)return null;
  try{
    const r=resumeVentes();
    if(r)r.conseils=conseilsPourLeBureau();
    return BdvSync.deposerFile({signaux:fileSignaux(),noms:annuaireSuivis()},r)
      .catch(function(){ return false; });
  }catch(e){ return null; }
}

/* ======================= ECRAN : MES CLIENTS =======================
   Une seule liste, un client une seule fois. Les trois moteurs restent des moteurs :
   ils detectent, ils ne sont plus des destinations. Un client detecte par deux d'entre eux
   recoit le motif le plus SPECIFIQUE, pas le plus grave : un recul mesure sur deux annees
   comparables est un fait, un retard de cadence est une prediction. Le fait l'emporte.
   Les montants ne sont pas de meme nature d'un motif a l'autre : chacun porte donc son
   libelle, et le total general n'est jamais additionne. */
let CLIENTS=[];
function agentClients(){
  const D=agentDecrochage(), R=agentDormants(), A=agentPremierAchat();
  const vus=new Set(), out=[];
  // 1. Recul confirme : on a la preuve chiffree de la baisse, sur deux annees comparables.
  D.decroche.forEach(c=>{
    if(vus.has(c.id))return;vus.add(c.id);
    out.push({id:c.id,nom:c.nom,motif:'recul',montant:c.perdu,
      lib:'perdu cette année',
      detail:`${fmtMoney(c.prev)} ${exPrecedent()}, ${fmtMoney(c.cur)} ${exCe()} à date égale`,
      chance:null});
  });
  // 2. Retard de cadence : le client a un rythme propre, et il l'a rompu.
  R.dormants.forEach(c=>{
    if(vus.has(c.id))return;vus.add(c.id);
    out.push({id:c.id,nom:c.nom,motif:'cadence',montant:c.montant,
      lib:'CA historique',
      detail:`commande tous les ${fmtDelai(c.cadence!=null?c.cadence:c.cadRef)}, silence depuis ${fmtDelai(c.silence)}`,
      chance:null});
  });
  // 3. Premier achat sans suite : aucune cadence calculable, mais un taux de retour mesure.
  if(A.ok)A.liste.forEach(c=>{
    if(vus.has(c.id))return;vus.add(c.id);
    out.push({id:c.id,nom:c.nom,motif:'premier',montant:c.montant,
      lib:'premier achat',
      detail:`venu une fois le ${fmtDate(c.date)}${c.cuvee?', '+c.cuvee:''}`,
      chance:c.chance,prioritaire:A.prioritaires.indexOf(c)>=0});
  });
  return out;
}
const MOTIFS={
  recul:  {label:'Recul confirmé',    cls:'m-recul',   aide:'Clients fidèles dont le chiffre baisse anormalement, à date égale. C\'est un fait mesuré.'},
  cadence:{label:'Retard de cadence', cls:'m-cadence', aide:'Clients qui avaient un rythme d\'achat régulier et qui l\'ont rompu. C\'est une prédiction.'},
  premier:{label:'Premier achat',     cls:'m-premier', aide:'Clients venus une seule fois. Le taux de retour est mesuré sur ta base, par montant et par type.'}
};
let filtreMotif='tous';
/* ================= MON COMMERCE : L'ETAGE 3, REPLIE =================
   Ecrit le 11/09/2026, lot 1 de la redecoupe du bureau.

   TROIS ETAGES, ET PAS UNE PILE. La piece s'ouvre sur un VERDICT (bridgeHero), continue
   par la LISTE ou l'on agit, et finit par ce qui explique sans rien demander. Ce
   troisieme etage est replie : visible, cliquable, mais il ne pousse pas la liste hors
   de l'ecran. C'est cette discipline qui evite de refabriquer « Mon annee » ailleurs.
   Tout bloc qui entrera ensuite dans cette piece devra se ranger dans un des trois.

   LE PERIMETRE EST TOUTE LA BASE, ET C'EST UN CHANGEMENT ASSUME. Ces deux tableaux
   venaient de l'apercu, ou ils suivaient la barre de periode. Or cette barre ne s'affiche
   QUE sur l'ecran « Mon annee » (voir navTo : `filterbar` y est le seul a passer en flex).
   Les poser ici en leur laissant lire `filters` aurait donne un top clients calcule sur un
   filtre INVISIBLE, pose dans une autre piece, parfois des semaines plus tot. Un chiffre
   dont on ne peut pas voir le perimetre est un chiffre faux.

   ET LA MESURE EST LE CA HT, toujours. La bascule CA / bouteilles est restee elle aussi
   dans « Mon annee » : passer par mesureVal() aurait fait suivre a ces tableaux un reglage
   qui n'a aucune commande visible ici.
   ==================================================================== */
function piedCommerce(){
  const rows=ROWS.filter(r=>r._vin);
  if(!rows.length)return '';
  const parCli={};
  rows.forEach(r=>{const id=clientKey(r);const o=parCli[id]||(parCli[id]={nom:r.client||id,ca:0});o.ca+=r._total;});
  const liste=Object.values(parCli).sort((a,b)=>b.ca-a.ca);
  const ca=liste.reduce((s,c)=>s+c.ca,0);
  if(!liste.length||ca<=0)return '';

  let dedans=`<table class="data"><thead><tr><th>Client</th><th class="num">CA HT</th><th class="num">Part</th></tr></thead><tbody>`
    +liste.slice(0,8).map(c=>`<tr><td>${esc(c.nom)}</td><td class="num">${fmtMoney(c.ca)}</td><td class="num">${fmtNum(c.ca/ca*100,0)}%</td></tr>`).join('')
    +`</tbody></table>`;

  if(liste.length>=3){
    const part3=liste.slice(0,3).reduce((s,c)=>s+c.ca,0)/ca*100, dep=part3>SEUILS.dependanceTop3;
    dedans+=signal(dep?'warn':'ok',dep?'⚠':'✔',
      `Le top 3 clients pèse ${fmtNum(part3,0)}% de ton CA, sur tout l'historique.`,
      dep?`<b>Dépendance forte à surveiller.</b> Un départ ferait mal. Élargis ta base de gros clients.`
         :`Répartition saine, pas de dépendance excessive sur les 3 premiers clients.`);
  }

  const br=computeBridge();
  if(br&&br.movers.length){
    dedans+=`<div class="card"><div class="card__title"><span>Plus gros mouvements par client, ${br.cur} vs ${br.prev} à date égale</span></div>
      <table class="data"><thead><tr><th>Client</th><th class="num">Effet</th></tr></thead><tbody>
      ${br.movers.slice(0,10).map(c=>`<tr><td>${esc(c[0])}</td><td class="num" style="color:${c[1]>=0?'var(--ok)':'var(--danger-deep)'}">${c[1]>=0?'+':'-'}${fmtMoney(Math.abs(c[1]))}</td></tr>`).join('')}
      </tbody></table><p class="note">Calculé à mois comparables entre les deux années.</p></div>`;
  }

  return `<div class="card"><details class="msg--replie">
    <summary>Qui pèse quoi dans ton chiffre</summary>
    <p class="note" style="margin-top:0">Sur tout l'historique de ta base, en CA HT. Ces tableaux expliquent, ils ne demandent rien.</p>
    ${dedans}</details></div>`;
}

function renderClients(){
  CLIENTS=agentClients();
  let html=`<h2 class="panel__title">Mon commerce</h2>`;

  /* ETAGE 1, LE VERDICT. Arrive de « Mon annee » le 11/09/2026, et il est EN TETE, avant
     meme le test de liste vide : « tu fais du surplace » reste vrai un jour ou il n'y a
     personne a rappeler, et c'est meme ce jour-la qu'il est le plus utile a lire. */
  html+=bridgeHero();

  if(!CLIENTS.length){
    html+=`<div class="section-label">Qui rappeler</div>`
      +`<div class="panel__sub">Les clients à qui il se passe quelque chose, réunis en une seule liste.</div>`
      +signal('ok','✔','Personne à relancer.','Aucun client ne recule, ne rompt son rythme ni ne reste sans suite. Profites-en.')
      +piedCommerce();
    el('p-clients').innerHTML=html;return;
  }
  const parMotif=m=>CLIENTS.filter(c=>c.motif===m);
  const nb=m=>parMotif(m).length, som=m=>sum(parMotif(m),c=>c.montant);
  /* LA PHRASE DE RENVOI VERS « MON ANNEE » A DISPARU, et computeBridge() avec elle : elle
     annoncait que ces clients composent les lignes « perdus » et « en baisse » d'un autre
     ecran. Ces deux lignes sont maintenant juste au-dessus. Renvoyer ailleurs serait faux. */
  html+=`<div class="section-label">Qui rappeler</div>`
    +`<div class="panel__sub">Un client n'apparaît qu'une seule fois, avec la raison la plus solide qui le concerne. Les trois analyses tournent toujours, elles sont devenues les filtres ci-dessous.</div>`;

  // Les trois motifs, en cartes cliquables. Chaque montant garde sa nature.
  html+=`<div class="motif-cards">${['recul','cadence','premier'].map(m=>`
    <button class="motif-card${filtreMotif===m?' on':''}" onclick="setMotif('${m}')" aria-pressed="${filtreMotif===m}">
      <span class="motif-card__n">${fmtNum(nb(m))}</span>
      <span class="motif-card__l">${MOTIFS[m].label}</span>
      <span class="motif-card__s">${fmtMoney(som(m))} <span class="muted-cell">${m==='recul'?'perdus':(m==='cadence'?'de CA historique':'de premiers achats')}</span></span>
    </button>`).join('')}
    <button class="motif-card${filtreMotif==='tous'?' on':''}" onclick="setMotif('tous')" aria-pressed="${filtreMotif==='tous'}">
      <span class="motif-card__n">${fmtNum(CLIENTS.length)}</span>
      <span class="motif-card__l">Tous</span>
      <span class="motif-card__s"><span class="muted-cell">montants de natures différentes, non additionnés</span></span>
    </button></div>`;

  const liste=(filtreMotif==='tous'?CLIENTS:parMotif(filtreMotif)).slice().sort((a,b)=>b.montant-a.montant);
  if(filtreMotif!=='tous')html+=`<p class="note" style="margin:.2rem 0 1rem">${MOTIFS[filtreMotif].aide}</p>`;
  html+=`<div class="card">
    <div class="toolbar"><span class="card__title" style="margin:0">${filtreMotif==='tous'?'Tous les clients à traiter':MOTIFS[filtreMotif].label}, du plus gros montant au plus petit</span>
      ${listTools('clientsBody','exportClients')}</div>
    <div class="tablewrap"><table class="data data--sticky"><thead><tr>
      <th>Client</th><th>Contact</th><th>Raison</th><th class="num">Montant</th><th class="num">Chance</th>
      <th>Statut</th><th>Rappel</th><th>Étiquettes</th><th>Canal</th></tr></thead><tbody id="clientsBody">
    ${liste.map(c=>{const s=CRM[c.id]||{};return `<tr class="clic" data-nom="${esc(norm(c.nom))}" data-mail="${esc(contactTexte(c.id))}"
        tabindex="0" role="button" aria-label="Ouvrir la fiche de ${esc(c.nom)}"
        onclick="ouvrirFiche(${JSON.stringify(c.id).replace(/"/g,'&quot;')},'${c.motif}')"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();ouvrirFiche(${JSON.stringify(c.id).replace(/"/g,'&quot;')},'${c.motif}');}">
      <td>${esc(c.nom)}<span class="why">${esc(c.detail)}</span></td>
      <td>${contactCell(c.id)}</td>
      <td><span class="motif ${MOTIFS[c.motif].cls}">${MOTIFS[c.motif].label}</span></td>
      <td class="num">${fmtMoney(c.montant)}<span class="why">${c.lib}</span></td>
      <td class="num">${c.chance!=null?fmtNum(c.chance*100,0)+' %':'<span class="muted-cell">n/d</span>'}</td>
      <td>${s.statut&&STATUTS_SUIVI[s.statut]?`<span class="motif ${STATUTS_SUIVI[s.statut].cls}">${STATUTS_SUIVI[s.statut].label}</span>`:'<span class="muted-cell">-</span>'}</td>
      <td>${s.rappel?rappelCell(s.rappel):'<span class="muted-cell">-</span>'}</td>
      <td>${(s.tags&&s.tags.length)?s.tags.map(esc).join(', '):'<span class="muted-cell">-</span>'}</td>
      <td>${s.canal?esc(libCanal(s.canal)):'<span class="muted-cell">-</span>'}</td>
    </tr>`;}).join('')}
    </tbody></table></div></div>`;
  html+=`<p class="note">La colonne « Chance » n'est renseignée que pour les premiers achats : c'est le seul motif dont le taux de retour soit mesurable sur ${PROFIL&&PROFIL.moisCouverts?PROFIL.moisCouverts:'la'} mois d'historique. Pour les deux autres, il faudrait respectivement 30 et 36 mois. Mieux vaut une case vide qu'un chiffre inventé.</p>`;
  /* LES TROIS LISTES COMPLETES, REBRANCHEES ICI LE 11/09/2026 (lot 5).

     Leurs boutons vivaient dans les trois ecrans fantomes, masques depuis la fusion du
     07/09 : Ted ne pouvait plus les atteindre, et personne ne s'en etait apercu parce que
     rien n'echoue quand un bouton n'est pas affiche. Arbitrage pris avec lui : les
     rebrancher plutot que les supprimer avec le reste du menage.

     ILS NE FONT PAS DOUBLON avec « Exporter la liste » de la liste ci-dessus. Celui-la sort
     CE QUI EST AFFICHE : la liste unifiee, un client une seule fois, avec la raison la plus
     solide qui le concerne. Ceux-ci sortent les listes ENTIERES de chaque analyse, avec les
     colonnes qui servent a travailler et que l'autre n'a pas : cadence, rythme, fiabilite et
     date de prochaine commande attendue pour la relance ; CA de l'exercice precedent, CA en
     cours et euros perdus pour le decrochage. L'e-mail est en deuxieme colonne dans les
     trois : le fichier part tel quel dans un outil d'emailing. */
  html+=`<div class="card"><div class="card__title"><span>Sortir tes listes complètes</span></div>
    <p class="note" style="margin-top:0">Le bouton « Exporter la liste » ci-dessus sort ce que tu vois : un client une seule fois, avec sa raison principale. Ces quatre-là sortent les listes entières de chaque analyse, avec leurs colonnes de travail.</p>
    <div style="display:flex;flex-wrap:wrap;gap:.5rem">
      <button class="btn btn--ghost btn--sm" onclick="exportReactList()">Clients à relancer</button>
      <button class="btn btn--ghost btn--sm" onclick="exportDecroList()">Clients en décrochage</button>
      <button class="btn btn--ghost btn--sm" onclick="exportPremierList()">Premiers achats, les prioritaires</button>
      <button class="btn btn--ghost btn--sm" onclick="exportReste()">Premiers achats, le reste</button>
    </div></div>`;

  html+=piedCommerce();   // etage 3 : replie, il ne pousse jamais la liste hors de l'ecran
  el('p-clients').innerHTML=html;
  FILTRES.clientsBody={q:'',joign:false};applyFilters('clientsBody');
}
function setMotif(m){filtreMotif=m;renderClients();navTo('clients');}
function exportClients(){
  const liste=(filtreMotif==='tous'?CLIENTS:CLIENTS.filter(c=>c.motif===filtreMotif)).slice().sort((a,b)=>b.montant-a.montant);
  if(!liste.length){status('error','Aucun client a exporter.');return;}
  const aoa=[['Client','E-mail','Telephone','Autres contacts','Raison','Montant','Nature du montant','Chance de retour %','Detail',
    'Statut','Rappel','Etiquettes','Canal prefere','Notes']];
  liste.forEach(c=>{const s=CRM[c.id]||{};aoa.push([c.nom,emailOf(c.id),telOf(c.id),autresContacts(c.id),MOTIFS[c.motif].label,
    Math.round(c.montant),c.lib,c.chance!=null?+(c.chance*100).toFixed(1):'',c.detail,
    s.statut&&STATUTS_SUIVI[s.statut]?STATUTS_SUIVI[s.statut].label:'',s.rappel||'',(s.tags||[]).join(', '),s.canal||'',s.notes||'']);});
  // Le fichier porte le nom de la piece, comme partout ailleurs : c'etait « Mes clients ».
  toXlsxOrCsv([{name:'Mon commerce',aoa}],'mon-commerce-'+filtreMotif);
}

/* RENDER-PREMIER-ACHAT

   TROIS ECRANS FANTOMES, SUPPRIMES LE 11/09/2026 (lot 5). Depuis la fusion du 07/09, leurs
   trois conteneurs etaient `hidden` en dur dans la coque : plus aucune piece de la barre n'y
   menait, leurs listes avaient fusionne dans « Mon commerce ». Mais `renderAll()` appelait
   toujours les trois fonctions, qui fabriquaient a chaque rendu des tableaux HTML complets,
   avec leurs lignes, leurs colonnes et leurs boutons, ecrits dans des div que personne ne
   verrait jamais.

   LE CALCUL, LUI, N'EST PAS PERDU : il n'a jamais ete ici. Il vit dans `agentPremierAchat()`, que
   `agentClients()` appelle pour composer la liste unifiee de « Mon commerce ». Ces fonctions
   ne faisaient que peindre.
*/
function lignesPremier(arr){
  const aoa=[['Client','E-mail','Telephone','Autres contacts','Premier achat','Type','Chance de revenir %','Date','Jours ecoules','Cuvee','Ville']];
  arr.forEach(c=>aoa.push([c.nom,emailOf(c.id),telOf(c.id),autresContacts(c.id),Math.round(c.montant),c.type||'',
    +(c.chance*100).toFixed(1),fmtDate(c.date),Math.round(c.age),c.cuvee,c.ville]));
  return aoa;
}
/* LES TROIS EXPORTS PRENNENT LEURS DONNEES A LA SOURCE depuis le 11/09/2026 (lot 5).

   Ils lisaient `premierList`, `reactList` et `decroList`, trois listes que les ecrans
   fantomes remplissaient en se peignant. Un export qui depend d'un ecran affiche est un
   export qui rend un fichier vide le jour ou l'ecran n'est plus affiche : c'est exactement
   ce qui leur serait arrive. Ils appellent maintenant leur agent, comme tout le reste. */
function exportPremierList(){
  const A=agentPremierAchat();
  if(!A.ok||!A.prioritaires.length){status('error','Aucun client a exporter.');return;}
  toXlsxOrCsv([{name:'A rappeler',aoa:lignesPremier(A.prioritaires)}],'premier-achat-prioritaires');
}
function exportReste(){
  const A=agentPremierAchat();if(!A.ok||!A.reste.length){status('error','Aucun client a exporter.');return;}
  toXlsxOrCsv([{name:'Le reste',aoa:lignesPremier(A.reste)}],'premier-achat-reste');
}

/* RENDER-DECROCHAGE

   TROIS ECRANS FANTOMES, SUPPRIMES LE 11/09/2026 (lot 5). Depuis la fusion du 07/09, leurs
   trois conteneurs etaient `hidden` en dur dans la coque : plus aucune piece de la barre n'y
   menait, leurs listes avaient fusionne dans « Mon commerce ». Mais `renderAll()` appelait
   toujours les trois fonctions, qui fabriquaient a chaque rendu des tableaux HTML complets,
   avec leurs lignes, leurs colonnes et leurs boutons, ecrits dans des div que personne ne
   verrait jamais.

   LE CALCUL, LUI, N'EST PAS PERDU : il n'a jamais ete ici. Il vit dans `agentDecrochage()`, que
   `agentClients()` appelle pour composer la liste unifiee de « Mon commerce ». Ces fonctions
   ne faisaient que peindre.
*/
/* ======================= EXPERTISE 4 : MIX CANAL + PRIX MOYEN ======================= */
/* ====== LES CANAUX, DANS « MES CUVEES » DEPUIS LE 11/09/2026 (lot 2) ======
   C'etait le quatrieme panneau empile dans « Mon annee ». Il repond a « a quel prix je
   vends, et par quel chemin » : la question des cuvees, pas celle du bilan.

   ELLE NE PEINT PLUS, ELLE RETOURNE SES MORCEAUX. renderProduits() pose les deux signaux
   a l'etage du verdict et les tableaux a l'etage replie ; un `innerHTML` dans un conteneur
   a elle ne pouvait plus servir. Les calculs, eux, n'ont pas bouge d'une ligne.

   `labels` est parti au passage : la variable etait construite et jamais lue. */
function blocsCanaux(){
  let signaux='',tableaux='';
  const f=yoyFrame();
  // Fenetre : si YoY dispo, à date égale sur cur/prev. Sinon, toute la base.

  // Agregation part de CA + prix moyen par canal.
  function agg(ex){
    const m={};let tot=0;
    ROWS.forEach(r=>{
      if(!r._vin||!r._date)return;
      if(ex!=null && r._exY!==ex)return;
      if(f && ex!=null && !avantCoupe(r,f.cutPos))return;
      const k=r._canal;let c=m[k];if(!c){c=m[k]={ca:0,qte:0};}
      c.ca+=r._total;c.qte+=r._qte;tot+=r._total;
    });
    return {m,tot};
  }

  if(f){
    tableaux+=`<p class="note" style="margin-top:0">Part de CA par canal et prix moyen par bouteille, ${exLabelCourt(f.cur)} vs ${exLabelCourt(f.prev)} à date égale. ${incompleteNote()}</p>`;
    const A=agg(f.cur),B=agg(f.prev);
    const keys=[...new Set([...Object.keys(A.m),...Object.keys(B.m)])];
    const rows=keys.map(k=>{
      const a=A.m[k]||{ca:0,qte:0},b=B.m[k]||{ca:0,qte:0};
      const partCur=A.tot?a.ca/A.tot*100:0,partPrev=B.tot?b.ca/B.tot*100:0;
      const prixCur=a.qte?a.ca/a.qte:0,prixPrev=b.qte?b.ca/b.qte:0;
      return {k,caCur:a.ca,partCur,partPrev,dPts:partCur-partPrev,prixCur,prixPrev};
    }).sort((x,y)=>y.caCur-x.caCur);

    // Signal : plus gros mouvement de part.
    const mover=[...rows].filter(r=>Math.abs(r.dPts)>=1).sort((a,b)=>Math.abs(b.dPts)-Math.abs(a.dPts))[0];
    if(mover){
      const sens=mover.dPts>=0?'progresse':'recule';
      signaux+=signal(mover.dPts>=0?'ok':'warn',mover.dPts>=0?'↗':'↘',
        `Le canal ${mover.k} ${sens} de ${fmtNum(Math.abs(mover.dPts),1)} points de CA.`,
        `<b>Action : ${mover.dPts>=0?'capitaliser sur ce canal qui monte':'comprendre pourquoi ce canal décroche et réagir'}.</b>`);
    }
    // Alerte valeur : prix moyen caveau vs pro/export.
    const cav=rows.find(r=>r.k==='Caveau');
    if(cav&&cav.prixCur>0){
      signaux+=signal('info','ℹ',`Prix moyen au caveau : ${fmtMoney(cav.prixCur)} par bouteille (${exLabelCourt(f.cur)} à date).`,
        `La vente directe doit rester ton canal le plus cher. Si un canal pro ou export s'en rapproche, tu perds de la valeur. Vérifie l'écart dans le tableau.`);
    }

    tableaux+=`<div class="card"><div class="card__title"><span>Mix canal et prix moyen</span></div>
      <table class="data"><thead><tr><th>Canal</th><th class="num">Part ${exLabelCourt(f.prev)}</th><th class="num">Part ${exLabelCourt(f.cur)}</th><th class="num">Évol. (pts)</th><th class="num">Prix moyen ${exLabelCourt(f.prev)}</th><th class="num">Prix moyen ${exLabelCourt(f.cur)}</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${esc(r.k)}</td><td class="num">${fmtNum(r.partPrev,1)} %</td><td class="num">${fmtNum(r.partCur,1)} %</td><td class="num ${r.dPts>=0?'pos':'neg'}">${fmtNum(r.dPts,1)}</td><td class="num">${r.prixPrev?fmtMoney(r.prixPrev):'n/d'}</td><td class="num">${r.prixCur?fmtMoney(r.prixCur):'n/d'}</td></tr>`).join('')}
      </tbody></table></div>`;
    tableaux+=`<div class="card"><div class="card__title"><span>Part de CA par canal, ${exLabelCourt(f.cur)}</span></div><div class="chart-wrap"><canvas id="chCanal"></canvas></div></div>`;
    return {signaux:signaux,tableaux:tableaux,A:A};
  }else{
    /* PLUS DE `filters.ex` ICI DEPUIS LE 11/09/2026. La barre de periode ne s'affiche que
       sur l'ecran « annee » (voir navTo), donc un perimetre lu dans `filters` serait
       invisible depuis « Mes cuvees », et parfois vieux de plusieurs semaines. C'est toute
       la base, et le texte le dit. */
    const A=agg(null);
    const rows=Object.entries(A.m).map(([k,v])=>({k,ca:v.ca,part:A.tot?v.ca/A.tot*100:0,prix:v.qte?v.ca/v.qte:0})).sort((a,b)=>b.ca-a.ca);
    tableaux+=`<div class="card"><div class="card__title"><span>Mix canal et prix moyen</span></div>
      <p class="note" style="margin-top:0">Part de CA par canal et prix moyen par bouteille, sur toute ta base.</p>
      <table class="data"><thead><tr><th>Canal</th><th class="num">CA</th><th class="num">Part</th><th class="num">Prix moyen / btl</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${esc(r.k)}</td><td class="num">${fmtMoney(r.ca)}</td><td class="num">${fmtNum(r.part,1)} %</td><td class="num">${r.prix?fmtMoney(r.prix):'n/d'}</td></tr>`).join('')}
      </tbody></table>
      <p class="note">Ajoute un export couvrant l'année précédente pour voir l'évolution d'un canal à l'autre.</p></div>`;
    tableaux+=`<div class="card"><div class="card__title"><span>Part de CA par canal</span></div><div class="chart-wrap"><canvas id="chCanal"></canvas></div></div>`;
    return {signaux:signaux,tableaux:tableaux,A:A};
  }
}
function drawCanal(A){
  destroyChart('chCanal');
  const ctx=el('chCanal');if(!ctx)return;
  const rows=Object.entries(A.m).map(([k,v])=>[k,v.ca]).filter(r=>r[1]>0).sort((a,b)=>b[1]-a[1]);
  const pal=palSeries(7);
  charts.chCanal=new Chart(ctx,{type:'bar',data:{labels:rows.map(r=>r[0]),datasets:[{data:rows.map(r=>r[1]),backgroundColor:pal,borderRadius:0}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{callback:v=>fmtNum(v)}}}}});
}

/* « Ma base » et « L'ecran Reglages » ont suivi le moteur dans /js/bdv-base.js : ils
   calculent sur ROWS, et c'est justement pour les montrer au bureau qu'on les a sortis. */

async function reopen(){
  status('loading','Chargement de ta base...');
  await reloadFromDB();
  status('success',fmtNum(ROWS.length)+' lignes chargées.');
  if(!BdvCompte.session()) await BdvCompte.porte({titre:'Tes chiffres sont prêts.',esquivable:true});
  openApp();
}

/* ======================= EXPORTS (PDF rapport + Excel/CSV) ======================= */
function groupCA(rows,get){const m={};rows.forEach(r=>{let k=get(r);k=(k===''||k==null)?'(non renseigné)':String(k);m[k]=(m[k]||0)+r._total;});return m;}
function groupQ(rows,get){const m={};rows.forEach(r=>{let k=get(r);k=(k===''||k==null)?'(non renseigné)':String(k);m[k]=(m[k]||0)+r._qte;});return m;}
function prTable(entries,label,tot){const e=entries.filter(x=>x[1]!==0);const mx=e.length?Math.max.apply(null,e.map(x=>Math.abs(x[1]))):0;return `<table class="pr-t"><thead><tr><th>${esc(label)}</th><th class="n">CA HT</th><th class="n">Part</th><th class="pr-barh"></th></tr></thead><tbody>`+e.map(([k,v])=>{const w=mx>0?Math.max(2,Math.abs(v)/mx*100):0;return `<tr><td>${esc(k)}</td><td class="n">${fmtMoney(v)}</td><td class="n muted">${tot>0?fmtNum(v/tot*100,0)+'%':'-'}</td><td class="pr-bar"><span style="width:${w.toFixed(0)}%"></span></td></tr>`;}).join('')+`</tbody></table>`;}
function prKpi(l,v,sub,hero){return `<div class="pr-kpi${hero?' pr-kpi--hero':''}"><div class="pr-kpi__l">${esc(l)}</div><div class="pr-kpi__v">${v}</div><div class="pr-kpi__s">${esc(sub||'')}</div></div>`;}
function prSec(t){return `<div class="pr-seclabel">${esc(t)}</div>`;}
function buildReport(){
  const rows=ROWS.filter(r=>r._vin);
  const ca=sum(rows,r=>r._total),btl=sum(rows,r=>r._qte);
  const factures=new Set(rows.map(r=>r.numFacture)).size,clients=new Set(rows.map(r=>clientKey(r))).size;
  const panier=factures?ca/factures:0,at=computeAtterrissage(),yt=yoyTotals();
  const per=META.min?fmtDate(META.min)+' au '+fmtDate(META.max):'';
  let h=`<div class="pr">`;
  h+=`<div class="pr-cover"><div class="pr-cover__brand">Le Bureau du Vigneron</div><div class="pr-cover__title">Rapport de ventes</div><div class="pr-cover__sub">${per} · édité le ${new Date().toLocaleDateString('fr-FR')} · ${fmtNum(rows.length)} lignes analysées</div><div class="pr-cover__tag">Propulsé par Solumatic · lecture d'export Vitisoft · CA HT</div></div>`;

  const evV=(yt&&yt.d!=null)?fmtPct(yt.d):'n/d',evCls=(yt&&yt.d!=null)?(yt.d>=0?'up':'down'):'';
  const atV=at?(at.complete?fmtMoney(at.total):fmtMoney(at.central)):'n/d';
  const atS=at?(at.complete?exComplet():('fourchette '+fmtMoney(at.low)+' à '+fmtMoney(at.high))):('2 '+exMot()+'s requis');
  h+=`<div class="pr-hero">
    ${prKpi('CA HT',fmtMoney(ca),plur(rows.length,'ligne')+' de vente',true)}
    <div class="pr-kpi"><div class="pr-kpi__l">Évolution vs ${yt?exLabelCourt(yt.f.prev):'N-1'} à date</div><div class="pr-kpi__v ${evCls}">${evV}</div><div class="pr-kpi__s">${yt?(fmtMoney(yt.cur)+' vs '+fmtMoney(yt.prev)):'n/d'}</div></div>
    ${prKpi('Atterrissage estimé',atV,atS)}
  </div>`;

  h+=`<div class="pr-kpis">
    ${prKpi('Bouteilles / cols',fmtNum(btl),'quantité vendue')}
    ${prKpi('Panier moyen',fmtMoney(panier),'par facture')}
    ${prKpi('Factures',fmtNum(factures),'distinctes')}
    ${objectif?prKpi('Objectif',fmtMoney(objectif),(at&&!at.complete)?(((at.central-objectif)>=0?'+':'-')+fmtMoney(Math.abs(at.central-objectif))+' projeté'):'fixé'):prKpi('Clients actifs',fmtNum(clients),'sur la période')}
  </div>`;

  const sigs=diagnosticSignals();
  if(sigs.length)h+=prSec('À regarder en priorité')+`<div class="pr-signals">`+sigs.map(x=>`<div class="pr-sig pr-sig--${x.kind}"><div class="pr-sig__v">${x.verdict.replace(/<[^>]+>/g,'')}</div><div class="pr-sig__a">${x.action.replace(/<[^>]+>/g,'')}</div></div>`).join('')+`</div>`;

  const pv=computePriceVolume();
  if(pv)h+=prSec("D'où vient l'évolution · "+exLabelCourt(pv.cur)+' vs '+exLabelCourt(pv.prev))+`<div class="pr-pv">
    <div class="pr-pv__item"><span>Effet volume</span><b class="${pv.volEff>=0?'up':'down'}">${(pv.volEff>=0?'+':'-')+fmtMoney(Math.abs(pv.volEff))}</b></div>
    <div class="pr-pv__item"><span>Effet prix</span><b class="${pv.priceEff>=0?'up':'down'}">${(pv.priceEff>=0?'+':'-')+fmtMoney(Math.abs(pv.priceEff))}</b></div>
    <div class="pr-pv__item pr-pv__tot"><span>Variation totale</span><b>${(pv.delta>=0?'+':'-')+fmtMoney(Math.abs(pv.delta))}</b></div>
  </div>`;

  const cliMap={};rows.forEach(r=>{const id=clientKey(r);cliMap[id]=(cliMap[id]||0)+r._total;});
  h+=prSec('Qui et quoi font ton chiffre')+`<div class="pr-2col"><div><div class="pr-h3">Top clients</div>${prTable(allEntries(cliMap).slice(0,8),'Client',ca)}</div><div><div class="pr-h3">Top cuvées</div>${prTable(allEntries(groupCA(rows,r=>r.produit)).slice(0,8),'Cuvée',ca)}</div></div>`;

  h+=prSec('Répartitions')+`<div class="pr-2col"><div><div class="pr-h3">Par couleur</div>${prTable(allEntries(groupCA(rows,r=>r.couleur)),'Couleur',ca)}</div><div><div class="pr-h3">Par canal de vente</div>${prTable(allEntries(groupCA(rows,r=>r._canal)),'Canal',ca)}</div></div><div class="pr-2col"><div><div class="pr-h3">Par famille</div>${prTable(allEntries(groupCA(rows,r=>r.famille)),'Famille',ca)}</div><div><div class="pr-h3">Par code tarif</div>${prTable(allEntries(groupCA(rows,r=>r.codeTarif)),'Code tarif',ca)}</div></div>`;

  h+=`<div class="pr-foot"><span>Le Bureau du Vigneron · propulsé par Solumatic</span><span>Données lues localement depuis ton export Vitisoft, jamais transmises.</span></div>`;
  h+=`</div>`;
  return h;
}

function exportPDF(){
  if(!ROWS.length){status('error','Charge un export avant de générer le rapport.');return;}
  el('printReport').innerHTML=buildReport();
  status('loading','Choisis « Enregistrer au format PDF » dans la fenêtre d\'impression.');
  setTimeout(()=>{window.print();const st=el('status');if(st)st.style.display='none';},250);
}
function dl(name,type,data){try{const b=new Blob([data],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);status('success','Export généré : '+name);}catch(e){status('error','Export impossible sur ce navigateur.');}}
function exportExcel(){
  if(!ROWS.length){status('error','Charge un export avant d\'exporter.');return;}
  const rows=ROWS.filter(r=>r._vin),ca=sum(rows,r=>r._total);
  const dims=[['Famille',r=>r.famille],['Code tarif',r=>r.codeTarif],['Couleur',r=>r.couleur],['Canal',r=>r._canal],['Client',r=>r.client||r.numClient],['Cuvée',r=>r.produit]];
  if(typeof XLSX==='undefined'){
    const m=groupCA(rows,dims[0][1]);
    const lignes=['Famille;CA HT;Part %'].concat(allEntries(m).map(([k,v])=>`${k};${Math.round(v)};${ca>0?(v/ca*100).toFixed(1):0}`));
    dl('analyse-vitisoft.csv','text/csv;charset=utf-8','﻿'+lignes.join('\n'));return;
  }
  const wb=XLSX.utils.book_new();
  const yt=yoyTotals(),at=computeAtterrissage();
  const syn=[['Indicateur','Valeur'],['CA HT',Math.round(ca)],['Bouteilles',Math.round(sum(rows,r=>r._qte))],['Factures',new Set(rows.map(r=>r.numFacture)).size],['Clients actifs',new Set(rows.map(r=>clientKey(r))).size]];
  if(yt&&yt.d!=null)syn.push(['Évolution YoY à date (%)',+yt.d.toFixed(1)]);
  if(at&&!at.complete)syn.push(['Atterrissage estimé',Math.round(at.central)]);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(syn),'Synthèse');
  dims.forEach(([label,g])=>{const m=groupCA(rows,g),q=groupQ(rows,g);const aoa=[[label,'CA HT','Bouteilles','Part %']].concat(allEntries(m).map(([k,v])=>[k,Math.round(v),Math.round(q[k]||0),ca>0?+(v/ca*100).toFixed(1):0]));XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),label.slice(0,28));});
  const mm={};rows.forEach(r=>{if(!r._date)return;const k=r._date.y+'-'+String(r._date.m).padStart(2,'0');mm[k]=(mm[k]||0)+r._total;});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Mois','CA HT']].concat(Object.keys(mm).sort().map(k=>[k,Math.round(mm[k])]))),'Par mois');
  const sigs=diagnosticSignals();
  if(sigs.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Priorité (3=urgent)','Constat','Action','Impact €']].concat(sigs.map(x=>[x.sev,x.verdict.replace(/<[^>]+>/g,''),x.action.replace(/<[^>]+>/g,''),Math.round(x.impact||0)]))),'Diagnostic');
  XLSX.writeFile(wb,'analyse-vitisoft.xlsx');
  status('success','Export Excel généré : analyse-vitisoft.xlsx');
}

/* ======================= EXPORTS CONTEXTUELS ======================= */
// Filtre en direct d'une liste de clients. Deux criteres cumulables, memorises par tableau :
// le texte cherche (nom OU adresse e-mail) et la case « joignables seulement ».
const FILTRES={};
function applyFilters(tbodyId){
  const tb=el(tbodyId);if(!tb)return;
  const f=FILTRES[tbodyId]||(FILTRES[tbodyId]={q:'',joign:false});
  const k=norm(f.q);let vus=0;
  tb.querySelectorAll('tr').forEach(tr=>{
    const n=tr.getAttribute('data-nom')||'',m=tr.getAttribute('data-mail')||'';
    const okTxt=!k||n.includes(k)||m.includes(k);
    const okJoign=!f.joign||m!=='';
    const ok=okTxt&&okJoign;
    tr.style.display=ok?'':'none';if(ok)vus++;
  });
  const cpt=el(tbodyId+'Count');
  if(cpt)cpt.textContent=fmtNum(vus)+' affiché(s)';
}
function filterList(tbodyId,q){const f=FILTRES[tbodyId]||(FILTRES[tbodyId]={q:'',joign:false});f.q=q;applyFilters(tbodyId);}
function filterJoignables(tbodyId,on){const f=FILTRES[tbodyId]||(FILTRES[tbodyId]={q:'',joign:false});f.joign=!!on;applyFilters(tbodyId);}
// Barre d'outils commune aux listes de clients : recherche, case joignables, compteur.
function listTools(tbodyId,exportFn){
  return `<span style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
    <input class="search" type="text" placeholder="Filtrer par nom ou adresse e-mail" oninput="filterList('${tbodyId}',this.value)">
    <label class="chk"><input type="checkbox" onchange="filterJoignables('${tbodyId}',this.checked)"> joignables (e-mail ou téléphone)</label>
    <span class="muted-cell" id="${tbodyId}Count"></span>
    <button class="btn btn--ghost btn--sm" onclick="${exportFn}()">Exporter la liste</button></span>`;
}
// Export de la liste COMPLETE de relance (tous les clients en retard, pas seulement l'ecran).
function exportReactList(){
  const reactList=agentDormants().dormants;
  if(!reactList.length){status('error','Aucun client a exporter.');return;}
  // La colonne E-mail est en 2e position : le fichier part tel quel dans un outil d'emailing.
  const aoa=[['Client','E-mail','Telephone','Autres contacts','CA historique','Achats','Cadence (jours)','Rythme','Dernier achat','En retard (jours)','Prochaine attendue','Fiabilite']];
  reactList.forEach(c=>aoa.push([c.nom,emailOf(c.id),telOf(c.id),autresContacts(c.id),Math.round(c.montant),c.n,(c.cadence!=null?Math.round(c.cadence):Math.round(c.cadRef)),(c.annuel?'annuel':(c.fiable?'regulier/occasionnel':'indicatif')),fmtDate(c.last),Math.round(c.silence),(c.prochaine!=null?fmtDate(dayToDate(c.prochaine)):''),c.conf]));
  toXlsxOrCsv([{name:'Relance',aoa}],'clients-a-relancer');
}
// Export de la liste COMPLETE de decrochage.
function exportDecroList(){
  const decroList=agentDecrochage().decroche;
  if(!decroList.length){status('error','Aucun client a exporter.');return;}
  const aoa=[['Client','E-mail','Telephone','Autres contacts','CA annee precedente','CA annee en cours','Perdu','Evolution %']];
  decroList.forEach(c=>aoa.push([c.nom,emailOf(c.id),telOf(c.id),autresContacts(c.id),Math.round(c.prev),Math.round(c.cur),Math.round(c.perdu),+c.pct.toFixed(1)]));
  toXlsxOrCsv([{name:'Decrochage',aoa}],'clients-en-decrochage');
}
function forceCsv(sheets,base){const csv=sheets[0].aoa.map(row=>row.map(c=>{c=(c==null?'':String(c));return /[;\n"]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c;}).join(';')).join('\n');dl(base+'.csv','text/csv;charset=utf-8','﻿'+csv);}
function toXlsxOrCsv(sheets,base){
  if(typeof XLSX==='undefined'){forceCsv(sheets,base);return;}
  const wb=XLSX.utils.book_new();
  sheets.forEach(sh=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(sh.aoa),sh.name.slice(0,28).replace(/[\\\/?*\[\]:]/g,' ')));
  XLSX.writeFile(wb,base+'.xlsx');status('success','Export généré : '+base+'.xlsx');
}
// Exploration : pivot affiché + lignes filtrées
function exploExportSheets(){
  const rows=exploRows(),a1=axisDef(exploAxis1),sheets=[];
  if(!exploAxis2){
    const entries=isTimeAxis(exploAxis1)?chronoEntries(groupSum(rows,a1.get)):allEntries(groupSum(rows,a1.get));
    const tot=entries.reduce((sm,e)=>sm+e[1],0);
    sheets.push({name:a1.label,aoa:[[a1.label,mesureLabel(),'Part %']].concat(entries.map(([k,v])=>[k,Math.round(v),tot?+(v/tot*100).toFixed(1):0]))});
  }else{
    const a2=axisDef(exploAxis2);
    const rowKeys=axisKeys(exploAxis1,groupSum(rows,a1.get),8),colKeys=axisKeys(exploAxis2,groupSum(rows,a2.get),8);
    const rset=new Set(rowKeys),cset=new Set(colKeys),cell={},rt={},ct={};
    rows.forEach(r=>{let rk=a1.get(r);rk=(rk===''||rk==null)?'(non renseigné)':String(rk);if(!rset.has(rk))rk='Autres';let ck=a2.get(r);ck=(ck===''||ck==null)?'(non renseigné)':String(ck);if(!cset.has(ck))ck='Autres';const v=mesureVal(r);cell[rk]=cell[rk]||{};cell[rk][ck]=(cell[rk][ck]||0)+v;rt[rk]=(rt[rk]||0)+v;ct[ck]=(ct[ck]||0)+v;});
    const rk2=rowKeys.filter(k=>rt[k]),ck2=colKeys.filter(k=>ct[k]);
    const head=[a1.label+' / '+a2.label].concat(ck2,['Total']);
    const body=rk2.map(rk=>[rk].concat(ck2.map(c=>Math.round((cell[rk]&&cell[rk][c])||0)),[Math.round(rt[rk])]));
    body.push(['Total'].concat(ck2.map(c=>Math.round(ct[c])),[Math.round(rk2.reduce((sm,rk)=>sm+rt[rk],0))]));
    sheets.push({name:'Croisement',aoa:[head].concat(body)});
  }
  const heads=['Date','Facture','Client','Cuvée','Famille','Couleur','Millésime','Appellation','Canal','Code tarif','Quantité','CA HT'];
  const lignes=[heads].concat(rows.map(r=>[r.date,r.numFacture,r.client,r.produit,r.famille,r.couleur,r.millesime,r.appellation,r._canal,r.codeTarif,r._qte,Math.round(r._total)]));
  sheets.push({name:'Lignes filtrées',aoa:lignes});
  return sheets;
}
function exportExplo(fmt){if(!ROWS.length){status('error','Rien à exporter.');return;}const sh=exploExportSheets();fmt==='csv'?forceCsv(sh,'exploration-vitisoft'):toXlsxOrCsv(sh,'exploration-vitisoft');}
// Évolution : le tableau segment × période affiché
/* `evoExportSheets()` et `exportEvo()` sont parties avec l'ecran Evolution : le registre
   exporte deja le meme tableau par `exportExplo()`, avec en plus ses filtres. Deux boutons
   d'export qui produisent le meme fichier, c'est un bouton de trop. */

/* ======================= INIT ======================= */
// La porte passe devant depuis le 04/09/2026 : le tableau de bord n'est plus visitable sans
// compte. Le verrou pose dans l'en-tete cache deja tout, il ne se leve qu'ici.
//
// Trois choses a ne pas defaire :
//   1. DOMContentLoaded, et pas un appel direct. bdv-compte.js est charge en defer, donc
//      BdvCompte n'existe pas encore au moment ou ce script est lu par le navigateur.
//   2. Le verrou se leve dans tous les cas de sortie de porte(). Si la configuration Supabase
//      est absente, porte() renvoie null immediatement et l'outil s'ouvre : notre propre
//      infrastructure ne prend jamais les donnees du vigneron en otage.
//   3. La regle d'or tient. Une session deja ouverte une fois sur ce navigateur suffit a
//      entrer, meme reseau coupe, meme Supabase en panne : lireSession() ne parle a personne.
/* Lot 2a de la fusion, 07/09/2026 : CE DEMARRAGE EST DEVENU UNE FONCTION.

   Il vivait dans le corps d'un ecouteur DOMContentLoaded, ce qui allait tres bien tant que
   ce fichier etait servi par une page qui le chargeait a l'analyse. Le bureau, lui, ne le
   charge qu'au premier clic sur une piece de vente, donc APRES DOMContentLoaded : l'ecouteur
   ne se serait jamais declenche, et le tableau de bord serait reste une coque vide, sans
   une erreur pour le dire.

   La fonction prend un point de depart :
     demarrerEcransVente()                       lit l'adresse, comportement d'avant
     demarrerEcransVente({ecran:'clients'})      le bureau dit ou aller
     demarrerEcransVente({client:'1234'})        et sur quelle fiche s'arreter

   Elle est IDEMPOTENTE. Rappelee, elle ne relit ni le serveur ni la base : elle navigue.
   C'est ce qui permet a la barre du bureau de l'appeler a chaque clic sans se demander si
   c'est le premier. */
let ECRANS_DEMARRES = false;

async function demarrerEcransVente(depart){
  depart = depart || {};

  // Deja demarre : on ne recharge rien, on va ou on nous dit d'aller.
  if(ECRANS_DEMARRES){
    if(depart.client){ navTo('clients'); setTimeout(function(){ ouvrirFiche(depart.client); }, 60); }
    else if(depart.ecran === 'reglages') ouvrirPanneauReglages();
    else if(depart.ecran) navTo(depart.ecran);
    return;
  }
  ECRANS_DEMARRES = true;

  try{
    // Le meme titre que les seize autres portes du site. Le bureau ferme la sienne avant
    // que ce fichier soit charge, donc cette ligne ne sert plus qu'au cas ou la session
    // tomberait entre l'ouverture du bureau et le premier clic sur un ecran de vente.
    if(!BdvCompte.session()) await BdvCompte.porte({titre:'Ton bureau t\'attend.'});
  }catch(e){ /* jamais bloquer sur une porte cassee, voir le point 2 */ }
  document.documentElement.classList.remove('bdv-verrou');
  // Rapatriement AVANT l'ouverture : sinon le vigneron qui arrive sur un nouvel appareil
  // lirait « aucune ligne en base » une seconde avant que ses lignes n'apparaissent.
  // Attendu, contrairement aux poussees : ici l'affichage depend du resultat.
  await tirerDuServeur();
  await reloadFromDB();
  // Le panneau est branche AU DEMARRAGE, et pas seulement quand on l'ouvre : le bouton
  // « Me deconnecter » de la barre du haut y prend son garde-fou. Sans cette ligne il
  // restait muet jusqu'a ce qu'on ouvre les reglages, ce qui n'a aucun sens pour lui.
  brancherPanneauReglages();
  // L'outil s'ouvre TOUJOURS, avec ou sans lignes. Sans base, openApp() atterrit de lui-meme
  // sur « Ma base », qui porte la zone de depot. Plus d'ecran d'accueil a franchir : le
  // tableau de bord est une piece du bureau, on y entre, on n'y frappe pas.
  const brut = (location.hash || '').replace('#','');
  // /outils/dashboard-vigneron/#client=1234 ouvre l'ecran des clients ET la fiche. C'est
  // ce qui permet au bureau de pointer sur un client precis, et pas sur une liste ou il
  // faut le rechercher a la main. Le bureau, lui, le dit par l'argument plutot que par
  // l'adresse : il n'a pas besoin d'ecrire dans la barre du navigateur pour se parler.
  const clientHash = brut.indexOf('client=') === 0 ? decodeURIComponent(brut.slice(7)) : null;
  const versClient = depart.client || clientHash;
  const ecran = depart.ecran || (versClient ? 'clients' : brut);
  openApp(NAV.some(n => n.id === ecran) && ecran !== 'reglages' ? ecran : undefined);
  // Arriver sur #base, #parametres ou #reglages ouvre le panneau : c'est la que « Ma base »
  // et le classement vivent depuis la fusion, et c'est ce que le bureau met dans ses liens.
  if(ecran === 'base' || ecran === 'parametres' || ecran === 'reglages') ouvrirPanneauReglages();
  if(versClient && ROWS.length) setTimeout(function(){ ouvrirFiche(versClient); }, 60);
  // Lecture du profil en dernier, et sans await bloquant sur l'affichage : un reseau lent ne
  // doit pas retarder l'ouverture du tableau de bord de quelqu'un qui, lui, a bien Vitisoft.
  try{
    const p = await BdvCompte.profil();
    // Dans les DEUX sens, par la meme fonction que le panneau de reglages : un drapeau qui
    // ne sait que monter est un drapeau qu'on oublie de baisser, et c'est arrive.
    if(p) adopterVitisoft(p.utilise_vitisoft);
  }catch(e){ /* sans profil lisible, on ne montre rien : le doute ne se transforme pas en refus */ }
}

/* La page autonome du tableau de bord demarre toujours de la meme facon : a l'ouverture du
   document, sans point de depart, en lisant son adresse. Cet ecouteur disparaitra au lot 2d
   avec la page elle-meme. Le bureau, lui, appelle la fonction directement. */
document.addEventListener('DOMContentLoaded', function(){ demarrerEcransVente(); });

window.demarrerEcransVente = demarrerEcransVente;
