/* Le Bureau du Vigneron, LE MOTEUR DE LA BASE DE VENTES.

   Sorti de dashboard-vigneron.html le 07/09/2026, sur demande de Ted : le panneau de
   reglages doit montrer LA MEME CHOSE au bureau et dans le tableau de bord. Or « Ma base »
   et « Le classement » ne sont pas des affichages, ce sont des CALCULS sur les lignes de
   vente. Les montrer ailleurs voulait donc dire emmener le moteur ailleurs. Il n'y avait pas
   de troisieme voie : un instantane depose par le tableau de bord aurait affiche au bureau
   des chiffres que le bureau ne peut pas rafraichir, donc faux des le premier import.

   CE FICHIER EST UN DEPLACEMENT, PAS UNE REECRITURE. A ne pas oublier avant d'y toucher :

   1. Aucun emballage, volontairement. Pas d'IIFE, pas de 'use strict' ajoute, pas de
      namespace. Les `const`, `let` et `function` de premier niveau d'un script classique
      vivent dans la portee globale partagee par tous les scripts de la page : ROWS, META,
      REG, EX_START, filters, status(), fmtMoney() restent visibles depuis les 3 000 lignes
      restees dans le tableau de bord, sans qu'un seul appel ait ete reecrit. Emballer ce
      fichier casserait les 3 000 lignes d'un coup.

   2. Il se charge SANS `defer`, et AVANT le script du tableau de bord. Un script differe
      s'execute apres l'analyse du document, donc apres le script en ligne : les
      instructions de premier niveau de celui-ci liraient alors des variables pas encore
      declarees. L'ordre n'est pas une preference, c'est une condition.

   3. PapaParse doit etre charge avant lui (il l'est, en tete de page, sans defer).
      BdvCompte et BdvSync, eux, sont differes : ce n'est pas un probleme, ils ne sont
      appeles que depuis des corps de fonction, jamais au chargement.

   4. Les fonctions restees dans le tableau de bord et appelees d'ici (renderAll, openApp,
      navTo, kpiCard, signal...) resolvent A L'APPEL, pas au chargement. C'est ce qui rend
      le deplacement possible. La contrepartie : le jour ou ce fichier sera charge par une
      page qui ne les a pas, il faudra garder ces appels derriere un test d'existence.
      Cf. la suite du chantier : le bureau. */

/* =============== AIDES PARTAGEES, VENUES DU TABLEAU DE BORD ===============
   Deplacees ici le 07/09/2026, deuxieme temps du chantier : « Ma base » et « Le classement »
   s'en servent, il fallait donc qu'elles suivent le moteur pour que le bureau les rende a
   l'identique. Elles restent globales, le tableau de bord continue de les voir sans qu'un
   seul de ses appels ait bouge. Neuf lignes, aucune dependance a un ecran. */
function sum(arr,fn){return arr.reduce((s,r)=>s+fn(r),0);}
function kpiCard(label,val,sub,hi){return `<div class="kpi${hi?' kpi--hi':''}"><div class="kpi__label">${esc(label)}</div><div class="kpi__val">${val}</div><div class="kpi__sub">${esc(sub||'')}</div></div>`;}
function signal(kind,ico,verdict,action){return `<div class="signal signal--${kind}"><div class="signal__ico">${ico}</div><div class="signal__body"><div class="signal__verdict">${verdict}</div><div class="signal__action">${action}</div></div></div>`;}
const MOIS_PLEIN=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const MOIS_FR=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
function dayToDate(dn){if(dn==null)return null;const dt=new Date(dn*86400000);const y=dt.getUTCFullYear(),m=dt.getUTCMonth()+1,d=dt.getUTCDate();return {y,m,d,t:y*10000+m*100+d};}
function isoDepuisDate(d){return d?(d.y+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0')):'';}
function isoDepuisJour(dn){return dn==null?'':isoDepuisDate(dayToDate(dn));}
// Deux fonctions et pas une : tirerDuServeur() vient d'appliquer les libelles LUS en base,
// il ne doit pas les y renvoyer. C'est cet aller-retour qui, en repartant avec les quatre
// colonnes, effacait le classement du compte a chaque ouverture.
function savePersoLabelsLocal(){try{localStorage.setItem(PERSO_LABELS_KEY,JSON.stringify(persoLabels));}catch(e){}}
function savePersoLabels(){savePersoLabelsLocal();syncLabels();}

/* ======================= CONFIG (a ajuster par domaine) ======================= */

/* ---- Couleurs : le CSS est la seule source de verite ----------------------
   Les graphiques lisent les tokens declares dans :root plutot que de porter
   leur propre palette. Une seule charte, un seul endroit ou la changer.
   L'echelle --bdv-serie-1..8 est categorielle : elle ne contient aucun token
   d'etat, pour qu'une serie verte ne se lise pas comme un jugement.

   LES NOMS ONT CHANGE LE 21/09/2026, AU LOT DES DEUX THEMES DES ECRANS DE
   VENTE, et c'est le seul endroit du depot ou un jeton de CSS soit lu par un
   nom ecrit en JavaScript. Les anciens `--serie-1..8` et `--bordeaux-voile`
   vivaient dans le `:root` de src/css/bdv-ecrans.css et n'avaient donc qu'UNE
   valeur, dessinee pour du papier. Les `--bdv-*` en ont deux, et c'est ce qui
   permet a un graphique de suivre le theme.

   `getComputedStyle` EST RELU A CHAQUE APPEL, ET C'EST VOULU : c'est ce qui
   fait qu'un graphique redessine APRES une bascule de theme prend les nouvelles
   couleurs. Ne pas mettre ces valeurs en cache dans une constante de module :
   le bureau garderait ses couleurs claires sur un fond sombre jusqu'au prochain
   rechargement. Ce qui declenche le redessin est ecrit dans src/js/bdv-ecrans.js,
   section « LE THEME CHANGE, LES GRAPHIQUES AUSSI ». */
const cssToken=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function palSeries(n){const p=[];for(let i=1;i<=(n||8);i++){const c=cssToken('--bdv-serie-'+i);if(c)p.push(c);}return p;}
// Aplat sous une courbe : le meme voile d'accent que les barres de repartition.
const aireBordeaux=()=>cssToken('--bdv-aire-accent');

// Les colonnes de l'export, dans l'ordre exact. On cable en dur (pas d'auto-détection).
// ATTENTION : les 40 premieres sont le socle historique. L'empreinte de dedup (voir HASH_COLS)
// ne porte QUE sur elles, pour que les bases deja constituees restent reconnues.
// Toute colonne ajoutee par une version plus recente de l'export vient APRES, jamais au milieu.
const COLS=['date','numFacture','produit','numProduit','famille','conditionnement',
  'persoProduit1','persoProduit2','persoProduit3','persoProduit4','persoProduit5',
  'appellation','couleur','millesime','puHT','totalHT','client','numClient','commercial',
  'quantite','codeTarif',
  'persoClient1','persoClient2','persoClient3','persoClient4','persoClient5','persoClient6','persoClient7','persoClient8','persoClient9',
  'pays','origine','ville','cp','vendeur','triPerso1','typeOffert','ordreDRM','depot','lieuVente',
  // --- ajoutees par les exports d'aout 2026, hors empreinte, dans l'ordre d'arrivee ---
  'emails',   // 41e, export du 25/08/2026
  'fixe',     // 42e, export du 26/08/2026
  'mobile'];  // 43e, export du 26/08/2026

// Noms exacts des colonnes dans l'en-tete du CSV, pour verifier qu'un nouvel export
// n'a pas insere une colonne au milieu. Le code lit les colonnes par POSITION :
// une insertion en cours de route decalerait tout en silence, et on se retrouverait
// avec des numeros de telephone dans le champ e-mail sans le moindre message d'erreur.
const ENTETES=['Date','Numéro Facture','Produit','Numéro Produit','Famille de produit','Conditionnement',
  'Perso produit 1','Perso produit 2','Perso produit 3','Perso produit 4','Perso produit 5',
  'Appellation','Couleur','Millésime','Prix unitaire HT','Prix total HT','Nom + Prénom Client','Numéro Client','Commercial',
  'Quantité','Code tarif',
  'Perso client 1','Perso client 2','Perso client 3','Perso client 4','Perso client 5','Perso client 6','Perso client 7','Perso client 8','Perso client 9',
  'Pays','Origine','Ville','Code postal','Vendeur','Tri perso facture 1','Type Offert','Ordre pour DRM','Dépôt','Lieu de vente',
  'Emails','Fixe','Mobile'];

// Nombre de champs entrant dans l'empreinte de ligne. NE JAMAIS AUGMENTER cette valeur :
// toutes les empreintes changeraient, plus aucune ligne deja en base ne serait reconnue,
// et un reimport dupliquerait la totalite des lignes (CA double, en silence).
const HASH_COLS=40;

// LISTE NOIRE des familles hors chiffre d'affaires (frais, remises, pub, divers, avoirs).
// Logique inversee : TOUT est une vente par defaut, on n'exclut que ce qui est ici.
// Comparaison normalisee (sans accents, insensible casse/espaces) et par INCLUSION PARTIELLE
// pour attraper les variantes. Un export Vitisoft est un export de ventes : la majorite des lignes SONT des ventes,
// quel que soit le nom de la famille (Rouge, Blanc, Rose, Champagne, Whisky, IGP...).
// (liste editable depuis l'ecran Colonnes, a venir.)
const FAMILLES_HORS_CA=['TRANSPORT','FRAIS DE PORT','REMISE','AVOIR','ARTICLES PUBLICITAIRES','PUBLICITAIRE','PLV','DIVERS'];

/* TYPES_OFFERT a ete retire le 19/09/2026. C'etait une liste en dur, « Offert,
   Echantillon, Degustation, Consommation Personnelle, Casse », que plus rien ne
   consultait depuis que le classement du vigneron decide seul, par `R.gratuit` dans
   classerLigne(). Elle n'a pas ete rebranchee mais supprimee : la regle 5 du projet
   (« Aucun seuil grave ») interdit precisement une liste de valeurs en dur, qui ne peut
   pas etre juste ailleurs que chez celui qui l'a ecrite. Le mode devine, lui, ne s'en
   servait deja pas : il prend toute valeur non vide pour une sortie gratuite. */

// Normalisation des canaux (Lieu de vente saisi a la main). Regroupement souple.
// Chaque regle : liste de fragments a chercher (insensible casse/accents/espaces).
const CANAUX=[
  {label:'Caveau',      match:['caveau']},
  {label:'Email',       match:['email','mail','courrier']},
  {label:'Site internet',match:['site internet','stripe','insta']},
  {label:'Telephone',   startsWith:['tel']},
  {label:'Salon',       startsWith:['salon']},
  {label:'Depot',       match:['depot']}
  // tout le reste => "Autre / non renseigne"
];

// Seuils des expertises (verdicts).
const SEUILS={
  rfmRecenceMois:12,   // filet de secours si aucune cadence fiable et aucun intervalle median de base
  rfmMinFreq:2,        // au moins X factures pour cibler la relance
  decrochagePct:-30,   // recul de reference (module ensuite par la volatilite propre du client)
  dependanceTop3:30,   // plancher, contextualise ensuite par la taille de la base
  cadenceK:1.5,        // "en retard" si le silence depasse k x la cadence du client
  cadenceMinAchats:3,  // nb d'achats minimum pour calculer une cadence fiable
  regulariteCV:0.5     // CV en dessous duquel un client est juge "regulier"
};

/* ======================= ETAT ======================= */
const DB_NAME='bdv_ventes_v4', STORE='lignes', STORE_REG='reglages';
let ROWS=[];                 // lignes derivees en memoire
let META={min:null,max:null,years:[],exercices:[]};
let PROFIL=null;             // profil de la base (calcule une fois apres import, cf. profilBase)
let SANS_NUM=0;              // lignes sans numero client, cf. computeMeta et clientKey
// `reactList` et `decroList` ont disparu le 11/09/2026 : les exports de relance et de
// decrochage appellent leur agent au lieu de relire ce qu'un ecran avait affiche.
// Selection temporelle active. Deux couches, volontairement distinctes :
//   ex        un exercice entier (null = tous). C'est la maille des comparatifs.
//   from/to   une plage libre en jour absolu (_dayNum), bornes incluses. Elle ne pilote
//             QUE le descriptif : un intervalle quelconque n'a pas de periode precedente
//             canonique, donc les moteurs comparatifs restent cales sur l'exercice et le disent.
//   preset    l'etiquette du raccourci choisi, pour reafficher le bon etat de la barre.
let filters={ex:null,from:null,to:null,preset:'tous'};
let charts={};
let BUSY_MIN=1500;   // en dessous, calcul synchrone (instantane) ; au dela, indicateur de chargement
let uiMesure='ca';           // 'ca' (CA HT) ou 'btl' (bouteilles/cols)
// explAxe1 et explAxe2 ont disparu le 19/09/2026 : reste de l'explorateur de l'Apercu,
// ecran supprime. Ne pas confondre avec exploAxis1 et exploAxis2, deux lignes plus bas,
// qui sont vivants et pilotent « Mon registre » (voir axisDef() dans bdv-ecrans.js).
// evoDim et evoStep ont disparu le 11/09/2026 avec l'ecran « Evolution dans le temps » :
// « Mon registre » porte la meme chose dans exploAxis1 (le pas de temps) et exploAxis2 (la
// dimension), avec ses filtres en plus.
let exploAxis1='famille', exploAxis2='', exploEx=null, exploFrom=null, exploTo=null, exploFilters={}, exploShowFilters=false;   // onglet Explorer
const OBJ_KEY='bdv_objectif_v5';
let objectif=null;try{const _o=parseFloat(localStorage.getItem(OBJ_KEY));objectif=(_o>0)?_o:null;}catch(e){objectif=null;}
const EX_KEY='bdv_exercice_v1';
// Mois d'ouverture de l'exercice comptable, 1 a 12. 1 = janvier, donc exercice cale sur
// l'annee civile : c'est le comportement historique de l'outil, et le defaut.
// Range a cote de l'objectif et des libelles perso, PAS dans les reglages du domaine :
// « Revenir au classement automatique » ne doit pas effacer le decoupage comptable.
let EX_START=1;try{const _e=parseInt(localStorage.getItem(EX_KEY),10);if(_e>=1&&_e<=12)EX_START=_e;}catch(e){EX_START=1;}
const PERSO_LABELS_KEY='bdv_persolabels_v4';
let persoLabels={};          // libelles perso personnalises {colonne d'origine: libelle}
try{persoLabels=JSON.parse(localStorage.getItem(PERSO_LABELS_KEY))||{};}catch(e){persoLabels={};}

/* ---------- Suivi CRM, pose par le vigneron lui-meme, jamais deduit des ventes ----------
   Cle = clientKey (numClient ou nom), comme partout ailleurs dans l'outil. Un enregistrement
   vide est retire de la structure : sinon un client touche puis « nettoye » par le vigneron
   resterait a vie dans le localStorage, invisible mais present. */
const CRM_KEY='bdv_crm_v1';
let CRM={};
try{CRM=JSON.parse(localStorage.getItem(CRM_KEY))||{};}catch(e){CRM={};}
function crmSave(){try{localStorage.setItem(CRM_KEY,JSON.stringify(CRM));}catch(e){}}
/* ============ DEUX ONGLETS, UN SEUL SUIVI, 24/09/2026 ============
   Depuis « Agrandir », une fiche peut vivre dans un onglet pendant que la liste vit dans
   un autre. Chacun garde CRM et ECHANGES EN MEMOIRE, lus une fois au chargement, et
   `crmSave()` ecrit l'objet ENTIER : sans rien de plus, l'onglet qui ecrit en second
   effacait en local ce que le premier venait de poser, et affichait l'ancien rappel.

   DEUX CANAUX, ET ILS NE REPONDENT PAS A LA MEME QUESTION.
   1. L'evenement `storage` recopie la memoire de l'autre onglet des qu'elle change. Il
      arrive AVANT la reponse du serveur, et c'est ce qu'on veut ici : ce qu'il corrige,
      c'est la copie locale, pas le compte.
   2. `bdv-bureau`, un BroadcastChannel, ne part qu'APRES la confirmation du serveur, la
      ou `bdvFicheAEcrit()` est deja appele. Il dit aux autres onglets de RELIRE LE COMPTE
      (le sous-main, le panneau), et relire avant la confirmation ramenerait l'ancienne
      date : c'est la regle du 11/09/2026, prise d'un onglet a l'autre.
   L'ecouteur du second est dans bdv-crm.js, parce que l'onglet de la liste n'a pas
   forcement charge ce moteur-ci. */
const BDV_CANAL=(function(){try{return ('BroadcastChannel' in window)?new BroadcastChannel('bdv-bureau'):null;}catch(e){return null;}})();
/* `onglet` : un BroadcastChannel livre AUSSI aux autres objets du meme onglet, donc a
   l'ecouteur de bdv-crm.js d'ici. Sans cette marque, l'onglet qui ecrit se repeignait deux fois. */
function prevenirLesOnglets(quoi,id){try{if(BDV_CANAL)BDV_CANAL.postMessage({quoi:quoi,id:id||null,onglet:window.BDV_ONGLET||null});}catch(e){}}
window.addEventListener('storage',function(e){
  if(e.key!==CRM_KEY&&e.key!==ECH_KEY)return;
  let v={};try{v=JSON.parse(e.newValue||'{}')||{};}catch(_){return;}
  if(e.key===CRM_KEY)CRM=v;else ECHANGES=v;
  try{ if(typeof FICHE_ID!=='undefined'&&FICHE_ID&&typeof redessinerSuivi==='function')redessinerSuivi(FICHE_ID); }catch(_){}
  if(typeof window.bdvCrmAChange==='function'){try{window.bdvCrmAChange();}catch(_){}}
});

/* ---------- Branchements vers le serveur (voir src/js/bdv-sync.js) ----------
   Aucun appelant n'attend ces fonctions, volontairement : elles partent en tache de fond et
   ne doivent jamais retarder un rendu ni une saisie. Un echec reseau est silencieux, la
   valeur reste dans IndexedDB et repartira a la prochaine occasion. C'est la regle 2 du
   module de synchronisation : rien d'ici ne peut empecher l'outil de fonctionner. */
function syncPret(){return !!(window.BdvSync&&BdvSync.pret());}

/* Rafraichir ce qui est affiche, sans savoir QUI affiche. Le moteur tourne desormais dans
   deux pages : le tableau de bord, qui a treize ecrans a redessiner, et le bureau, qui n'a
   que le panneau de reglages. Un seul endroit connait cette difference, plutot que quinze
   appels a renderAll() semes dans le fichier et qui leveraient au bureau. */
function ecranRafraichir(){
  if(typeof renderAll === 'function') renderAll();
  // Le compteur de la barre du haut. Il etait rafraichi par openApp(), qu'on appelait en fin
  // d'import : openApp() renvoyait aussi sur « Mon annee », ce qui refermait le panneau depuis
  // lequel on venait justement d'importer. On garde le compteur, on abandonne le saut d'ecran.
  /* UN SEUL ENDROIT L'ECRIT, 23/09/2026 : `majCompteurLignes()` dans bdv-ecrans.js.
     Il etait ecrit ici ET dans openApp(), avec deux formules differentes, et ni l'une
     ni l'autre ne repassait quand les lignes arrivaient apres coup. Le bureau, lui,
     n'a pas cette barre : d'ou le garde sur l'existence de la fonction. */
  if(typeof majCompteurLignes === 'function'){ try{ majCompteurLignes(); }catch(e){} }
  if(typeof navTo === 'function' && typeof ROWS !== 'undefined' && !ROWS.length) navTo('vide');
  /* ET « MA JOURNEE » AVEC, depuis le 08/09/2026. Le bureau peignait son ardoise et son
     sous-main au chargement de la page, et plus jamais : un import ou un vidage fait depuis
     le panneau de reglages laissait donc a l'ecran des chiffres qui n'existaient plus. Ted
     a vide sa base et a vu son chiffre d'affaires rester affiche derriere la modale. Meme
     motif que window.bdvMajPanneau : c'est la donnee qui rappelle l'ecran, et jamais
     l'ecran qui interroge en boucle. */
  if(typeof window.bdvMajJournee === 'function'){ try{ window.bdvMajJournee(); }catch(e){} }
  if(window.BdvReglages && BdvReglages.rafraichir) BdvReglages.rafraichir();
  else if(typeof ouvrirPanneauReglages === 'function') ouvrirPanneauReglages();
}

/* ============ L'ANALYSE POUR LE BUREAU, JUSTE APRES UN IMPORT ============
   Ajoutee le 08/09/2026. Le defaut repare, tel que Ted l'a decrit : « quand je cree mon
   compte et que j'importe mes donnees, il faut que je me deconnecte et reconnecte pour
   que ca affiche des donnees et que toutes les tuiles se mettent en route ».

   Ce n'etait pas la reconnexion qui reparait, c'etait le RECHARGEMENT qu'elle provoquait.
   Et il fallait meme une deuxieme condition : avoir ouvert une piece de vente entre les
   deux. Trois manques enchaines, et un seul symptome.

   1. « Ma journee » ne CALCULE rien, par construction (voir l'entete de bdv-crm.js) : elle
      lit une analyse toute prete dans `reglages.file_travail` et `reglages.resume_ventes`.
   2. Cette analyse n'est deposee que par renderAll(), dans bdv-ecrans.js, un fichier que le
      bureau ne charge qu'au premier clic sur une piece de vente. Un import n'est pas un
      clic : les lignes partaient bien sur le compte, mais RIEN ne les analysait.
   3. Et quand l'analyse finissait par exister, le bureau ne l'apprenait pas :
      bdvMajJournee() relit le miroir local, or le depot vient d'etre ecrit sur le serveur.
      Seul BdvCrm.charger(), appele au chargement de la page, va chercher la table.

   D'ou l'ordre ci-dessous, qui est tout le contenu de cette fonction : charger le calcul
   s'il manque, deposer, RELIRE le serveur, repeindre. Enlever l'une des quatre etapes
   ramene le defaut, et sous une forme differente a chaque fois.

   Elle n'est PAS appelee depuis ecranRafraichir() : celle-la tourne a chaque reglage
   modifie, et charger 83 ko plus une ecriture reseau pour un objectif de CA change n'a
   aucun sens. Son seul appelant est la fin d'un import, ou l'analyse a vraiment change.

   Jamais bloquante, jamais parlante : un reseau qui lache laisse le compte rendu de
   l'import a l'ecran, et l'analyse repartira au prochain. */
async function analyserPourLeBureau(){
  if(!syncPret())return;
  if(typeof deposerPourLeBureau!=='function'){
    // Au tableau de bord le calcul part avec la page et on ne passe jamais ici. Au bureau
    // on le demande a la barre, qui porte la liste des ressources et sait ne les charger
    // qu'une fois : c'est le meme chargement que le premier clic sur « Mon annee ».
    if(!(window.BdvNav&&BdvNav.chargerEcrans))return;
    try{ await BdvNav.chargerEcrans(); }catch(e){ return; }
    if(typeof deposerPourLeBureau!=='function')return;
  }
  /* Attendu, contrairement aux cinquante autres appels : la relecture qui suit doit lire CE
     depot, pas celui d'avant.

     Et on depose SANS SE DEMANDER si renderAll() vient de le faire, alors que c'est le cas
     au tableau de bord et au deuxieme import du bureau. Une ecriture de plus sur une seule
     ligne coute moins cher qu'une condition fausse : « sauter le depot quand renderAll
     existe » cassait justement le deuxieme import au bureau, ou renderAll existe depuis le
     premier, et laissait les tuiles sur l'analyse precedente. */
  try{ await deposerPourLeBureau(); }catch(e){ /* on repeint quand meme ce qu'on a */ }
  if(window.BdvCrm&&BdvCrm.charger){ try{ await BdvCrm.charger(); }catch(e){} }
  if(typeof window.bdvMajJournee==='function'){ try{ window.bdvMajJournee(); }catch(e){} }
}
/* UNE ECRITURE = UNE COLONNE.

   Cette fonction s'appelait syncReglages() et renvoyait les QUATRE colonnes a chaque geste.
   Or le panneau de reglages ecrit `objectif` et `exercice_debut` directement en base, sans
   passer par le moteur. Changer le mois d'exercice reexpediait donc l'objectif que le moteur
   avait encore en memoire, PAR-DESSUS celui que le vigneron venait d'enregistrer. Perdu,
   sans un mot. Et au demarrage, tirerDuServeur() appelait savePersoLabels() alors que REG
   n'etait pas encore lu : le classement du compte repartait donc en `null` a chaque
   ouverture. Deux pertes de donnees silencieuses pour une seule cause.

   `on_conflict=id` + merge-duplicates ne touche QUE les colonnes envoyees : n'envoyer que
   la sienne suffit a ce qu'aucun geste ne puisse en effacer un autre.

   NE PAS remettre une fonction qui envoie tout, meme « pour etre sur ». Une cinquieme
   colonne prend sa propre fonction. */
/* UN SEUL POINT DE PASSAGE POUR PERIMER « MON CAP ». Depuis le lot 24, le resume de
   l'ecran est calcule par le serveur a partir de `reglages` : `classement` decide de
   `est_vente`, `exercice_debut` decide de `ex_annee` et `ex_pos`, `objectif` sort tel
   quel. Changer l'un des trois sans redemander le resume, c'est afficher un chiffre
   perime AVEC L'AUTORITE D'UN CHIFFRE DE SERVEUR : l'ecran ne peut plus se corriger
   tout seul, il croit savoir.

   Les trois passent tous par ici, alors la peremption se pose ici, une fois, plutot
   qu'a six endroits d'ou elle finirait par manquer au septieme. `perso_labels` ne
   change rien au resume, mais un appel de trop coute une requete et un oubli coute un
   faux chiffre : le filtre est volontairement large. */
const CAP_REGLAGES = ['classement', 'exercice_debut', 'objectif'];
/* TROIS RESUMES DE SERVEUR MAINTENANT, ET UN SEUL POINT DE PEREMPTION. Depuis le lot 25
   « Mon commerce » en a un aussi, et il depend des MEMES reglages : `classement` decide
   de `est_vente`, `exercice_debut` decide de `ex_annee` et `ex_pos`. Les perimer
   separement, c'est l'oubli programme du jour ou un troisieme ecran arrivera.
   `objectif` ne sert qu'a « Mon cap », mais le redemander pour rien coute une requete
   et l'oublier coute un faux chiffre : le filtre reste volontairement large. */
function capPerimer(apres){
  if(typeof window === 'undefined') return;
  if(typeof window.bdvCapRafraichir === 'function') window.bdvCapRafraichir(apres);
  if(typeof window.bdvCommerceRafraichir === 'function') window.bdvCommerceRafraichir(apres);
  if(typeof window.bdvCuveesRafraichir === 'function') window.bdvCuveesRafraichir(apres);
}
function syncUneColonne(champs){
  if(!syncPret())return null;
  /* L'ECHEC N'EST PLUS AVALE, 19/09/2026. Le `.catch` vide rendait muet le reglage le
     plus lourd du bureau : le classement decide de ce que le serveur compte comme une
     vente. L'ecran affichait « Reglages enregistres », le compte n'avait rien recu, et le
     deuxieme appareil gardait le classement d'avant. Meme motif que syncSuivi(). */
  const envoi = BdvSync.ecrireReglages(champs).then(function(ok){
    if(!ok && syncPret()) status('error', "Ce réglage n'est enregistré que sur cet appareil : ton compte ne l'a pas reçu. Reviens dessus quand le réseau sera revenu.");
    return ok;
  }).catch(function(){ return false; });
  if(CAP_REGLAGES.some(function(c){ return c in champs; })) capPerimer(envoi);
  return envoi;
}
function syncObjectif(){syncUneColonne({objectif:objectif});}
function syncExercice(){syncUneColonne({exercice_debut:EX_START});}
function syncLabels(){syncUneColonne({perso_labels:persoLabels});}
// Un classement abandonne part en `null`, pas en `{valide:false}` : « revenir au classement
// automatique » doit s'effacer sur les AUTRES appareils aussi, et pas y arriver sous la forme
// d'un objet que tirerDuServeur() reappliquerait comme un classement valide.
function syncClassement(){syncUneColonne({classement:(REG&&REG.valide)?REG:null});}

/* Les deux reglages que le PANNEAU enregistre lui-meme, adoptes par le moteur sans repartir
   en base : c'est deja ecrit, et un aller-retour de plus rouvrirait la porte a l'ecrasement.
   Sans elles, l'ardoise gardait l'ancien objectif jusqu'au prochain rechargement complet. */
function adopterObjectif(v){
  const n=(v==null||v==='')?null:(Number(v)||null);
  objectif=(n&&n>0)?n:null;
  try{if(objectif)localStorage.setItem(OBJ_KEY,String(objectif));else localStorage.removeItem(OBJ_KEY);}catch(e){}
  // Sans promesse a attendre : le panneau n'appelle ces deux fonctions QU'APRES que son
  // ecriture a abouti. C'est la moitie du chemin que syncUneColonne ne voit pas passer.
  capPerimer();
  ecranRafraichir();
}
function adopterExercice(m){
  const n=parseInt(m,10);
  if(!(n>=1&&n<=12)||n===EX_START)return;
  EX_START=n;
  try{if(n===1)localStorage.removeItem(EX_KEY);else localStorage.setItem(EX_KEY,String(n));}catch(e){}
  // Meme recalcul que exAppliquer(), MOINS l'ecriture en base : le decoupage du temps change,
  // donc les trois champs derives de chaque ligne et la selection courante ne veulent plus
  // rien dire. buildFilterBar() n'existe qu'au tableau de bord, d'ou le garde.
  if(typeof ROWS!=='undefined'&&ROWS.length)ROWS.forEach(exDeriver);
  filters={ex:null,from:null,to:null,preset:'tous'};
  computeMeta();
  capPerimer();
  if(typeof buildFilterBar==='function')buildFilterBar();
  ecranRafraichir();
}
// Une fiche videe par le vigneron est SUPPRIMEE du serveur, pas gardee vide : sinon la table
// se remplit de fiches fantomes qu'aucun ecran ne montre plus.
/* LE SUIVI N'AVAIT AUCUNE FILE DE REJEU, et le commentaire de echPousser() qui justifiait
   cette absence disait qu'il etait « repousse a chaque modification ». C'est vrai, mais une
   modification n'arrive que si le vigneron retouche CETTE fiche : un rappel pose une fois et
   jamais retouche partait une seule fois, et si cette fois-la ratait, il ne quittait jamais
   le navigateur.
   Trouve le 09/09/2026 : `suivi_clients` etait a zero ligne alors que l'ecran avait confirme
   chaque rappel, et Ted etait bien connecte. Un rappel qui ne vit que dans un navigateur est
   perdu au changement d'appareil, et la base fait foi.
   Meme motif que echPousser() : un drapeau sur la fiche, et crmRejouer() vide la file a la
   prochaine synchronisation. Rien ici ne bloque une saisie : la regle 2 du module tient.

   TROU CONNU, non rebouche : si c'est une SUPPRESSION qui echoue, la fiche a deja quitte
   CRM et il n'y a plus rien a marquer. La suppression se represente au prochain vidage de
   la fiche, pas avant. Reboucher demanderait une deuxieme liste, en attente de
   suppression : a faire le jour ou ca se voit, pas avant. */
function syncSuivi(id){
  if(!id)return Promise.resolve(false);
  const c=CRM[id];
  if(!syncPret()){ if(c){c._apousser=true;crmSave();} return Promise.resolve(false); }
  return (c?BdvSync.ecrireSuivi(id,c):BdvSync.supprimerSuivi(id)).then(function(ok){
    const f=CRM[id];
    if(ok){ if(f&&f._apousser){delete f._apousser;crmSave();} }
    else if(f){ f._apousser=true;crmSave(); }
    /* LE BUREAU SE REPEINT ICI, ET APRES LA REPONSE DU SERVEUR. Ajoute le 11/09/2026,
       quand la fiche client est devenue le seul endroit ou l'on pose un rappel : le
       sous-main lit le miroir de bdv-crm.js, que cette ecriture-ci ne touche pas. Sans
       ce rappel, un client traite depuis sa fiche restait dans la file jusqu'au
       rechargement de la page.
       APRES et pas avant : BdvCrm.charger() relit le compte, et relire avant que
       l'ecriture ne soit arrivee ramenerait l'ancienne date, donc la ligne qu'on vient
       de traiter. La fonction n'existe que dans le bureau ; au tableau de bord autonome
       il n'y a rien a repeindre. */
    if(ok&&typeof window.bdvFicheAEcrit==='function'){try{window.bdvFicheAEcrit();}catch(e){}}
    if(ok)prevenirLesOnglets('suivi',id);
    return !!ok;
  }).catch(function(){
    const f=CRM[id];
    if(f){f._apousser=true;crmSave();}
    return false;
  });
}
/* Vide la file du suivi. Appelee par tirerDuServeurUneFois() juste AVANT de relire le suivi
   du serveur, et l'ordre est tout le sujet : pousser d'abord, lire ensuite. Dans l'autre
   sens, la fusion ecraserait le rappel qui attendait ici avec une version du serveur qui ne
   le connait pas encore. */
function crmRejouer(){
  if(!syncPret())return Promise.resolve([]);
  const ids=Object.keys(CRM).filter(function(id){return CRM[id]&&CRM[id]._apousser;});
  return Promise.all(ids.map(function(id){return syncSuivi(id);}));
}
/* Le drapeau `_apousser` ne part JAMAIS en base : BdvSync.ecrireSuivi() construit son corps
   a partir de champs nommes, il ne recopie pas la fiche. Et crmVide() l'ignore, donc une
   fiche qui ne porterait que lui reste consideree comme vide. */

/* Dire la verite sur une ecriture partie en tache de fond, sans bloquer la saisie. Ecrit une
   fois ici plutot que dans chaque appelant : deux versions de ce message auraient diverge. */
function crmDireSiPasParti(p,quoi){
  if(!p||!p.then)return;
  p.then(function(ok){
    // Pas de session, pas de reproche : le tableau de bord tourne aussi sans compte, et
    // dans ce cas le localStorage EST la destination, pas un pis-aller.
    if(!ok&&syncPret())status('error',quoi+" n'est enregistré que sur cet appareil : ton compte ne l'a pas reçu. Ça repartira à la prochaine synchronisation.");
  });
}
// Rapatriement au demarrage. Les lignes du serveur passent par dbAddMany comme n'importe quel
// import : meme deduplication, meme enrichissement hors empreinte, aucun chemin special.
/* TIRAGE UNIQUE PAR VISITE. Deux endroits le demandent maintenant : l'ouverture des ecrans
   de vente, et l'ouverture du panneau de reglages, qui montre « Ma base » et « Le classement »
   sans qu'aucun ecran de vente ait forcement ete affiche. Sur un appareil neuf, le panneau
   annoncait « 0 ligne » alors que le compte en portait des milliers.

   Une PROMESSE partagee, et pas un simple drapeau : les deux appels peuvent se croiser, et le
   second doit attendre le premier au lieu de repartir en parallele. En cas d'echec elle est
   remise a zero, pour que le geste suivant ait sa chance. */
let _tirage=null;
// Nombre de lignes que le dernier tirage a ajoutees a IndexedDB. Le panneau s'en sert pour
// savoir s'il doit relire la base : sans ca, un appareil qui avait deja des lignes n'affichait
// pas celles qui venaient d'arriver d'un autre poste.
let TIRAGE_AJOUTS=0;
function tirerDuServeur(){
  if(!syncPret())return Promise.resolve();
  if(_tirage)return _tirage;
  _tirage=tirerDuServeurUneFois().catch(function(){_tirage=null;});
  return _tirage;
}
async function tirerDuServeurUneFois(){
  try{
    /* Ce que cet appareil a DEJA. Passe au module de synchronisation, qui compare avec le
       compte avant de rapatrier quoi que ce soit : autant des deux cotes, il ne telecharge
       rien. C'est ce qui fait passer le premier clic de 11,7 s a 2,9 s sur 40 000 lignes.
       Un comptage local qui echoue rend `null`, et `null` veut dire « je ne sais pas », donc
       rapatriement complet : le doute ne se transforme jamais en economie. */
    let dejaLa = null;
    try{ dejaLa = await dbCount(); }catch(e){ dejaLa = null; }
    const lignes=await BdvSync.tirerVentes(function(n){status('loading','Récupération de tes ventes, '+fmtNum(n)+' lignes...');}, dejaLa);
    if(lignes.length){
      const r=await dbAddMany(lignes);
      TIRAGE_AJOUTS=r.added||0;
      if(r.added)status('success',plur(r.added,'ligne','récupérée')+' depuis ton compte.');
    }
    /* Le drapeau se pose ICI et nulle part ailleurs dans ce fichier : c'est la seule
       lecture des reglages du COMPTE. `regLire()` ne lit que le miroir local, et un
       miroir vide sur un navigateur neuf ne prouve rien. 19/09/2026. */
    let reg=null;
    try{ reg=await BdvSync.lireReglages(); marquerReglagesNonLus(false); }
    catch(e){ marquerReglagesNonLus(true); }
    if(reg){
      if(reg.objectif!=null){objectif=Number(reg.objectif)||null;try{if(objectif)localStorage.setItem(OBJ_KEY,String(objectif));}catch(e){}}
      if(reg.exercice_debut>=1&&reg.exercice_debut<=12){EX_START=reg.exercice_debut;try{localStorage.setItem(EX_KEY,String(EX_START));}catch(e){}}
      // Local SEUL : ce qu'on vient de lire en base n'a rien a y refaire.
      if(reg.perso_labels){persoLabels=reg.perso_labels;savePersoLabelsLocal();}
      if(reg.classement)await regEcrire(reg.classement);
    }
    // Le journal d'echanges suit le meme chemin que le suivi. Le serveur fait foi ici,
  // contrairement au suivi ou le local gagne : une entree ne se modifie jamais, donc deux
  // appareils ne peuvent pas se contredire, ils ne peuvent que s'additionner.
  if(BdvSync.lireEchanges){
    try{
      const lignes=await BdvSync.lireEchanges();
      const parClient={};
      (lignes||[]).forEach(function(e){(parClient[e.client_id]||(parClient[e.client_id]=[])).push(e);});
      // Fusion par identifiant : ce qui est parti d'ici et n'est pas encore revenu du
      // serveur ne doit pas disparaitre de l'ecran.
      Object.keys(ECHANGES).forEach(function(id){
        const connus=new Set((parClient[id]||[]).map(e=>e.echange_id));
        (ECHANGES[id]||[]).forEach(function(e){if(!connus.has(e.echange_id))(parClient[id]||(parClient[id]=[])).push(e);});
      });
      ECHANGES=parClient;echSave();
      echRejouer();
    }catch(e){ /* silencieux, comme tout le sync : on garde le miroir local */ }
  }
  // Pousser ce qui attendait ici AVANT de relire : dans l'autre sens, la fusion plus bas
  // ecraserait un rappel en attente avec une version du serveur qui l'ignore encore.
  await crmRejouer();
  const suivi=await BdvSync.lireSuivi();
    if(suivi&&Object.keys(suivi).length){
      // Le local gagne sur le serveur en cas de conflit : une note ecrite ici et pas encore
      // partie ne doit pas etre effacee par une version plus ancienne venue d'ailleurs.
      // Fusion CHAMP PAR CHAMP, et non fiche par fiche. « Le local gagne » avait du sens
  // quand cet ecran etait seul a ecrire ; depuis que /mon-bureau/ pose des gestes, une
  // simple note locale sur un client suffisait a jeter la fiche serveur entiere, donc a
  // annuler le rappel qu'un geste venait d'y ecrire. Le client revenait dans la file.
  // Regle retenue : le local gagne SAUF sur les champs que seul le bureau ecrit
  // (statut, rappel, canal), ou le serveur fait foi quand il porte quelque chose.
  const CHAMPS_BUREAU=['statut','rappel','canal'];
  /* 24/09/2026 : UNE FICHE QUI N'A RIEN EN ATTENTE PREND LA LIGNE DU SERVEUR, ENTIERE.
     Depuis le lot 33 tout le bureau ecrit sur la meme fiche (decision de Ted : « on nomme
     qui a fait l'action »). Les etiquettes et le proprietaire sont donc COMMUNS : garder
     la version locale d'une fiche dont rien n'est en attente, c'etait ne jamais voir
     l'etiquette posee par Romane, ni celle qu'elle a retiree. La regle d'avant ne vaut
     plus que pour une fiche qui porte `_apousser`, c'est-a-dire un geste fait ici et pas
     encore arrive : lui, on ne l'ecrase pas. */
  Object.keys(suivi||{}).forEach(function(id){
    const distant=suivi[id]||{}, local=CRM[id];
    if(!local||!local._apousser){CRM[id]=distant;return;}
    Object.keys(distant).forEach(function(k){
      if(local[k]==null||CHAMPS_BUREAU.indexOf(k)>=0)local[k]=distant[k];
    });
  });
  crmSave();
    }
  /* LA LISTE DES GENS DU BUREAU, EN DERNIER ET SANS ATTENDRE. Elle ne sert qu'a
     nommer l'auteur d'une ligne dans la fiche client : rien ne doit s'arreter si elle
     tarde, et rien ne doit l'attendre. Dans un bureau seul elle ne change rien du
     tout, `quiEcrit` se taisant des qu'il n'y a qu'une personne. */
  if(window.BdvCompte&&BdvCompte.trombinoscope)BdvCompte.trombinoscope().catch(function(){});
  }catch(e){ /* jamais bloquant */ }
  finally{ statusFin(); }
}
// Le nom lisible d'un client, y compris pour un identifiant qui ne figure dans aucune
// liste d'analyse. Cache construit une fois : la file relit des noms a chaque rendu.
let NOMS_CACHE=null;
function nomClient(id){
  if(!NOMS_CACHE){
    NOMS_CACHE={};
    ROWS.forEach(function(r){const k=clientKey(r);if(k&&!NOMS_CACHE[k])NOMS_CACHE[k]=r.client||k;});
  }
  return NOMS_CACHE[id]||id;
}
/* `proprietaire` compte depuis le 24/09/2026 : une fiche qui ne porte QUE son proprietaire
   est une fiche attribuee, pas une fiche vide. Sans lui, attribuer un client neuf le faisait
   passer par `supprimerSuivi()`, c'est-a-dire qu'on l'effacait en croyant l'attribuer. */
function crmVide(c){return !c||(!c.statut&&!c.notes&&!c.rappel&&!c.canal&&!c.proprietaire&&!(c.tags&&c.tags.length));}
function crmRafraichirListe(){
  const p=el('p-clients');if(p&&p.classList.contains('on')&&typeof renderClients==='function')renderClients();
  if(typeof window.bdvCrmAChange==='function'){try{window.bdvCrmAChange();}catch(e){}}
  // Le bureau sert la file deposee : un client traite ici doit en sortir tout de suite,
  // pas au prochain import.
  if(typeof deposerPourLeBureau==='function')deposerPourLeBureau();
}
const LIB_CHAMP={statut:'Statut',rappel:'Rappel',rappel_titre:'Motif du rappel',canal:'Canal',notes:'Notes'};
function crmSet(id,champ,valeur){
  const c=CRM[id]||{};
  if(valeur==='')delete c[champ];else c[champ]=valeur;
  if(crmVide(c))delete CRM[id];else CRM[id]=c;
  crmSave();const _p=syncSuivi(id);crmRafraichirListe();
  // Sans ce retour, on tape une note, rien ne bouge, et on conclut qu'il manque un
  // bouton d'enregistrement. L'enregistrement au blur n'est acceptable que s'il se voit.
  status('success',(LIB_CHAMP[champ]||'Suivi')+(valeur===''?' effacé.':' enregistré.'));
  // Ce message dit vrai sur CET appareil, et c'est tout ce qu'on sait a cet instant. Si le
  // compte ne l'a pas recu, le second message le corrige.
  crmDireSiPasParti(_p,'« '+(LIB_CHAMP[champ]||'Suivi')+' »');
  if(typeof FICHE_ID!=='undefined'&&FICHE_ID===id&&typeof redessinerSuivi==='function')redessinerSuivi(id);
}
// Ecrit plusieurs champs d'un coup. crmSet appelle a la suite persistait, synchronisait et
// redessinait TROIS fois pour un seul clic, avec un scintillement : aux deux premiers
// rendus la ligne etait encore dans la file, le rappel n'etant pose qu'au troisieme.
function crmSetPlusieurs(id,champs){
  const c=CRM[id]||{};
  Object.keys(champs||{}).forEach(function(k){
    const v=champs[k];
    if(v===''||v==null)delete c[k];else c[k]=v;
  });
  if(crmVide(c))delete CRM[id];else CRM[id]=c;
  crmSave();syncSuivi(id);crmRafraichirListe();
  // Pas de message ici : geste() annonce deja ce qu'il vient de faire, en mieux.
  if(typeof FICHE_ID!=='undefined'&&FICHE_ID===id&&typeof redessinerSuivi==='function')redessinerSuivi(id);
}
function crmSetTags(id,texte){
  const tags=texte.split(',').map(t=>t.trim()).filter(Boolean);
  const c=CRM[id]||{};
  if(tags.length)c.tags=tags;else delete c.tags;
  if(crmVide(c))delete CRM[id];else CRM[id]=c;
  crmSave();const _p=syncSuivi(id);crmRafraichirListe();
  status('success',tags.length?'Étiquettes enregistrées.':'Étiquettes effacées.');
  crmDireSiPasParti(_p,'Les étiquettes');
}
const STATUTS_SUIVI={
  a_faire:{label:'À faire',cls:'m-statut-afaire'},
  relance:{label:'Relancé',cls:'m-statut-relance'},
  traite:{label:'Traité',cls:'m-statut-traite'}
};
/* La liste des moyens de communication est dans /js/bdv-canaux.js, et nulle part
   ailleurs. Une constante CANAUX_SUIVI vivait ici, figee a quatre valeurs et appelee par
   personne : elle ne servait qu'a faire croire, a la relecture, qu'elle faisait foi. */

/* ======================= LE JOURNAL D'ECHANGES =======================
   Le suivi porte UNE note : ecrire quelque chose en septembre effacait ce qu'on avait
   note en aout. Le journal empile des entrees datees. C'est toute la difference entre un
   historique et un bloc-notes.

   Depuis le 06/09/2026, une entree peut etre CORRIGEE : on repare une faute de frappe ou
   un canal mal choisi. Ce qui ne bouge jamais, c'est `le`, la date de ce qui s'est passe,
   et la colonne `maj_le` dit quand le texte a ete reecrit. Une ligne dont `maj_le` vaut
   `le` n'a jamais ete retouchee, et l'ecran ne dit « corrigé le » que dans le cas
   contraire : l'afficher partout ferait douter de tout le journal.

   Meme motif que le suivi : un miroir dans le localStorage pour afficher sans attendre
   le reseau, le serveur pousse en tache de fond et ne bloque jamais un geste. */
const ECH_KEY='bdv_echanges_v1';
let ECHANGES={};
try{ECHANGES=JSON.parse(localStorage.getItem(ECH_KEY))||{};}catch(e){ECHANGES={};}
function echSave(){try{localStorage.setItem(ECH_KEY,JSON.stringify(ECHANGES));}catch(e){}}
// Du plus recent au plus ancien, toujours. C'est le seul ordre dans lequel on lit un suivi.
function echDe(id){return (ECHANGES[id]||[]).slice().sort((a,b)=>String(b.le).localeCompare(String(a.le)));}
// Identifiant fabrique ici, comme l'empreinte d'une ligne de vente : le meme geste pousse
// deux fois ne cree pas de doublon, et l'ecran affiche l'entree avant la reponse du serveur.
function echId(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
function echAjouter(id,type,canal,resume){
  if(!id)return null;
  // maj_le PORTE LA MEME VALEUR QUE le. La colonne a un defaut now() cote base : une
  // entree qui ne la porte pas se fait horodater a l'arrivee de la requete, et les cent
  // millisecondes du reseau suffisaient a faire afficher « corrigé le » sur une note
  // ecrite a l'instant. L'ecran ne compare que ces deux dates, il a raison de le faire :
  // c'est l'ecriture qui devait les poser ensemble.
  const quand=new Date().toISOString();
  const e={echange_id:echId(),client_id:String(id),le:quand,maj_le:quand,
           type:type||'note',canal:canal||null,resume:resume||null};
  /* L'AUTEUR SE POSE DES L'ECRITURE LOCALE, 25/09/2026. La base le pose aussi (defaut
     auth.uid()), mais seulement a la relecture : entre les deux, l'entree n'avait pas de
     `cree_par`, et `quiEcrit()` lit une absence comme un compte supprime. Ted voyait sa
     propre note signee « d'un ancien membre ». Ce champ ne part jamais en ecriture :
     ecrireEchange() construit son corps colonne par colonne. */
  if(window.BdvCompte&&BdvCompte.monId&&BdvCompte.monId())e.cree_par=BdvCompte.monId();
  (ECHANGES[id]||(ECHANGES[id]=[])).push(e);
  echSave();
  echPousser(e);
  return e;
}
// Une entree du journal ne se reecrit jamais : sans marque, un envoi rate ne serait
// JAMAIS retente, contrairement aux ventes (repoussees a chaque import) et au suivi
// (repousse a chaque modification). Le drapeau reste pose tant que le serveur n'a pas
// confirme, et echRejouer() vide la file au chargement suivant.
function echPousser(e){
  if(!syncPret()||!BdvSync.ecrireEchange){e._apousser=true;echSave();return;}
  BdvSync.ecrireEchange(e).then(function(ok){
    if(ok){ if(e._apousser){delete e._apousser;echSave();} prevenirLesOnglets('echange',e.client_id||e.clientId); }
    else { e._apousser=true;echSave(); }
  }).catch(function(){ e._apousser=true;echSave(); });
}
function echRejouer(){
  if(!syncPret())return;
  Object.keys(ECHANGES).forEach(function(id){
    (ECHANGES[id]||[]).forEach(function(e){ if(e._apousser)echPousser(e); });
  });
}
/* Les libelles et les icones du journal viennent de bdv-canaux.js, seul endroit ou la
   liste des moyens de communication est ecrite. Cette table-ci n'est qu'un repli pour le
   cas ou le fichier ne serait pas charge : mieux vaut un fil un peu pauvre qu'un fil vide.
   Avant, cette table et sa jumelle de bdv-crm.js avaient deja divergé l'une de l'autre. */
function libEchange(e){
  if(window.BdvCanaux)return{label:BdvCanaux.libelleEntree(e),ico:BdvCanaux.icoEntree(e)};
  return{label:String((e&&(e.canal||e.type))||''),ico:'&#9998;'};
}
/* Un canal stocke en base est une CLE ('appel', 'sms'), pas un libelle. La colonne
   « Canal » du tableau des clients doit donc le resoudre avant de l'afficher, sinon le
   vigneron y lit « repondeur » en minuscules au lieu de « Répondeur ». */
function libCanal(v){ return window.BdvCanaux?BdvCanaux.libelle(v):(v||''); }

/* Les trois gestes de la file. Chacun fait exactement trois choses : il ecrit une entree
   au journal, il pose un statut, et il REPOUSSE le rappel. Le troisieme point est le plus
   important : sans lui la ligne reviendrait le lendemain et la file deviendrait un mur.
   « Pas maintenant » n'a volontairement pas de champ dedie en base : un rappel repousse a
   soixante jours suffit a sortir la ligne de la file, et l'ecart laisse une trace au
   journal comme les autres gestes. */
const GESTES={
  appel:  {label:'Appelé',            type:'appel',  canal:'appel',    statut:'relance',jours:30,resume:'Appel passé'},
  message:{label:'Laissé un message', type:'message',canal:'repondeur',statut:'relance',jours:7, resume:'Message laissé, sans réponse'},
  ecarte: {label:'Pas maintenant',    type:'ecarte', canal:null,       statut:null,     jours:60,resume:'Écarté de la file'}
};
function dansNJours(n){return isoDepuisJour(Math.floor(Date.now()/86400000)+n);}
function geste(cle,id){
  const g=GESTES[cle];if(!g||!id)return;
  echAjouter(id,g.type,g.canal,g.resume);
  const champs={rappel:dansNJours(g.jours)};
  if(g.statut)champs.statut=g.statut;
  if(g.canal)champs.canal=g.canal;
  crmSetPlusieurs(id,champs);
  status('success',g.label+' · '+nomClient(id)+' revient dans '+plur(g.jours,'jour'));
}
function fmtDateIso(iso){if(!iso)return '';const [y,m,d]=iso.split('-').map(Number);return fmtDate({y,m,d});}
/* Le jour COURANT en heure locale, jamais par toISOString(). Defaut corrige le
   11/09/2026 : `new Date().toISOString().slice(0,10)` rend le jour UTC, alors que
   `iso` est un jour local venu de la colonne `rappel`. Entre minuit et deux heures
   du matin a Paris, les deux ne sont pas le meme jour : un rappel pose pour
   AUJOURD'HUI s'affichait en rouge comme un retard, et celui de la veille passait
   pour celui du jour. `bdv-crm.js` avait deja ecrit `isoLocal()` exactement pour ca,
   avec le commentaire qui l'explique ; ce fichier ne s'en servait pas, et les deux
   ecrans lisaient donc la meme donnee en repondant deux choses. */
function jourLocalISO(d){
  const x=d||new Date();
  return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
}
function rappelCell(iso){
  const auj=jourLocalISO();
  if(iso<auj)return `<span style="color:var(--danger-deep);font-weight:600">${fmtDateIso(iso)}</span>`;
  if(iso===auj)return `<span style="font-weight:600">${fmtDateIso(iso)}</span>`;
  return fmtDateIso(iso);
}

/* ======================= UTILS ======================= */
function el(id){return document.getElementById(id);}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function stripAccents(s){return (s==null?'':String(s)).normalize('NFD').replace(/[̀-ͯ]/g,'');}
function norm(s){return stripAccents(s).toLowerCase().replace(/\s+/g,' ').trim();}
function fmtNum(n,d){return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d==null?0:d}).format(n);}
/* L'ESPACE AVANT L'EURO EST INSECABLE, 19/09/2026. C'est le formateur de TOUS les
   montants du bureau : avec une espace ordinaire, le symbole partait seul a la ligne des
   qu'une colonne se resserrait, et on lisait « 171 569 » sur une ligne et « € » sur la
   suivante. Quatorze endroits de bdv-ecrans.js avaient du etre repris a la main faute de
   ce correctif-ci. U+00A0, et pas une entite HTML : ce qui sort d'ici part aussi dans des
   `textContent`, des exports CSV et des messages de `status()`, ou une entite s'afficherait
   telle quelle. */
function fmtMoney(n){return fmtNum(Math.round(n))+' €';}
/* ZERO EST UN TROISIEME ETAT, ET IL L'EST PARTOUT, 19/09/2026.
   Le signe et la couleur etaient decides par `>= 0` a huit endroits differents,
   ecrits a huit moments differents. Resultat : « +0 % » en vert dans l'ardoise,
   « +0 EUR » en vert dans « Mes cuvees », « -0 EUR » en rouge dans le tableau des
   mouvements, « Croissance saine : +0 EUR » en conseil. Corriger un endroit ne
   corrigeait pas les sept autres, et on l'a verifie deux fois dans la journee.
   Les deux fonctions ci-dessous sont maintenant le SEUL endroit ou l'on decide.
   Un zero n'a ni signe ni couleur de verdict : il n'annonce ni une bonne ni une
   mauvaise nouvelle, il dit qu'il ne s'est rien passe. */
function signeDe(n){return n>0?'+':(n<0?'-':'');}
function couleurDelta(n){return n>0?'var(--ok)':(n<0?'var(--danger-deep)':'inherit');}
function fmtDelta(n){return signeDe(n)+fmtMoney(Math.abs(n));}
/* LE SIGNE EST POSE UNE FOIS, ET UNE SEULE, 23/09/2026. Cette fonction ecrivait
   `signeDe(n) + fmtNum(n)` : pour un nombre negatif, `signeDe` posait le sien et
   `fmtNum` gardait le sien, d'ou le « - -26,1 % » que Ted a vu en tete de « Mon cap ».
   Sa voisine `fmtDelta`, ecrite le meme jour, prenait bien la valeur absolue : le
   defaut n'a jamais touche les euros, seulement les pourcentages, ce qui est
   exactement ce qui l'a fait survivre. Quatre appels dans le depot, dont le bandeau
   de « Mon cap » et l'ardoise de « Ma journee ».
   Effet de bord VOULU sur les phrases qui portent deja le sens : « en repli de
   -12,3 % » devient « en repli de 12,3 % ». */
function fmtPct(n,d){return signeDe(n)+fmtNum(Math.abs(n),d==null?1:d)+' %';}
/* PASSE PAR fmtNum, 19/09/2026. `plur()` ecrivait « 8000 lignes » la ou tout le reste du
   bureau ecrit « 8 000 » : le meme nombre changeait de forme selon la phrase qui le
   portait. L'effet de bord est voulu et large, toutes les occurrences du projet gagnent le
   separateur d'un coup.
   `suite` porte l'accord que le nom seul ne donne pas : on lui passe l'adjectif au
   singulier et deja au bon genre (« recuperee », « ignore »), il prend le meme « s » que le
   nom. C'est ce qui remplace les « ligne(s) recuperee(s) » du fichier. */
function plur(n,mot,suite){return fmtNum(n)+' '+mot+(n>1?'s':'')+(suite?' '+suite+(n>1?'s':''):'');}
function status(type,msg){const b=el('status');
  // Le tableau de bord porte cette barre dans son HTML ; le bureau ne l'a pas. Depuis que ce
  // moteur tourne aussi la-bas, status() doit savoir parler ailleurs plutot que de lever sur
  // un element absent : un import qui echoue en silence est exactement le defaut qu'on a
  // passe la journee du 07/09/2026 a reparer.
  if(!b){ if(window.BdvReglages && BdvReglages.dire) BdvReglages.dire(msg, type !== 'error'); return; }
  b.className='status '+type;el('statusTxt').textContent=msg;el('statusSpin').style.display=type==='loading'?'block':'none';b.style.display='flex';if(type!=='loading')setTimeout(()=>{b.style.display='none';},type==='error'?12000:4000);}
/* Referme le bandeau s'il est ENCORE en chargement, et ne touche a rien sinon.
   Un status('loading') ne disparait jamais tout seul, volontairement : personne ne sait
   combien de temps l'operation prend. La contrepartie, c'est que tout chemin qui en pose un
   doit en sortir, y compris le chemin « rien de nouveau ». Le 07/09/2026, tirerDuServeur()
   n'annoncait la fin que si des lignes avaient ete ajoutees : quand le compte ne rendait que
   des lignes deja connues, le bandeau tournait a l'ecran jusqu'au rechargement de la page, et
   Ted a legitimement cru que ses chiffres etaient en train de se construire sous ses yeux. */
function statusFin(){const b=el('status');if(b&&b.className.indexOf('loading')>=0)b.style.display='none';}
// Indicateur "le moteur travaille" : affiche la barre, laisse le navigateur la peindre, PUIS lance le calcul lourd.
function busy(on,msg){const b=el('busyov');if(!b)return;if(on){const t=el('busytxt');if(t)t.textContent=msg||'Analyse…';b.classList.add('on');}else b.classList.remove('on');}
function runBusy(msg,fn){if(!ROWS||ROWS.length<BUSY_MIN){fn();return;}busy(true,msg);const raf=window.requestAnimationFrame||(g=>setTimeout(g,16));raf(()=>raf(()=>{try{fn();}finally{busy(false);}}));}
// uiExplorer() a disparu le 19/09/2026 : plus un seul appelant dans le depot, gabarits
// et chaines de caracteres compris. « Mon registre » passe par setExploAxis().

// Nombre francais "14,58" -> 14.58 ; gere le negatif et l'espace milliers.
function parseNum(v){
  if(v==null||v==='')return 0;
  if(typeof v==='number')return v;
  let s=String(v).replace(/\s/g,'').replace(/€/g,'').replace(/%/g,'');
  if(s.indexOf(',')>-1&&s.indexOf('.')>-1)s=s.replace(/\./g,'').replace(',','.');
  else if(s.indexOf(',')>-1)s=s.replace(',','.');
  const n=parseFloat(s);return isNaN(n)?0:n;
}
// Date "JJ/MM/AAAA" -> objet {y,m,d,t} (t = timestamp jour, pour comparer).
function parseDateFR(v){
  if(!v)return null;
  const m=String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(!m)return null;
  const d=+m[1],mo=+m[2],y=+m[3];
  if(y<1990||y>2100||mo<1||mo>12||d<1||d>31)return null;
  return {y,m:mo,d,t:y*10000+mo*100+d};
}
// Empreinte de ligne (hash) sur les HASH_COLS premiers champs bruts. cyrb53, compact et robuste.
function cyrb53(str){
  let h1=0xdeadbeef,h2=0x41c6ce57;
  for(let i=0,ch;i<str.length;i++){ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507);h1^=Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507);h2^=Math.imul(h1^(h1>>>13),3266489909);
  return (h2>>>0).toString(16).padStart(8,'0')+(h1>>>0).toString(16).padStart(8,'0');
}

/* ======================= COLONNES HORS EMPREINTE ======================= */
// Une ligne deja en base doit-elle etre remplacee par la version qui arrive ?
// Oui uniquement si la nouvelle apporte une information la ou l'ancienne n'en avait pas,
// sur les colonnes situees apres l'empreinte. On n'ecrase jamais une valeur par du vide.
function rawEnrichit(oldRaw,newRaw){
  if(!Array.isArray(oldRaw)||!Array.isArray(newRaw))return false;
  for(let i=HASH_COLS;i<COLS.length;i++){
    const a=String(oldRaw[i]==null?'':oldRaw[i]).trim();
    const b=String(newRaw[i]==null?'':newRaw[i]).trim();
    if(b&&b!==a)return true;
  }
  return false;
}

/* ======================= ADRESSES E-MAIL ======================= */
// La colonne Emails de l'export est saisie a la main cote logiciel. Constats sur base reelle :
// plusieurs adresses dans une meme cellule separees par un pipe, parfois par une espace,
// des majuscules, des doublons, et quelques adresses invalides (domaine sans extension).
// On nettoie ici une fois pour toutes, le reste du code ne voit qu'un tableau propre.
const RE_EMAIL=/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
function parseEmails(cell){
  if(!cell)return [];
  const out=[],vus=new Set();
  String(cell).split(/[|;,\s]+/).forEach(part=>{
    const e=part.trim().replace(/^[<("']+|[>)"'.,;]+$/g,'').toLowerCase();
    if(!e||!RE_EMAIL.test(e)||vus.has(e))return;
    vus.add(e);out.push(e);
  });
  return out;
}

/* ======================= NUMEROS DE TELEPHONE =======================
   Colonnes Fixe et Mobile, saisies a la main elles aussi. Constats sur base reelle :
   des numeros francais a 10 chiffres, des etrangers en +41 ou +971, des prefixes 00
   a la place du +, des espaces et des points de separation, des « +33 (0) » mixtes,
   et quelques cellules a deux numeros separes par une barre oblique.
   On produit deux formes : une forme AFFICHEE lisible et une forme APPELABLE
   utilisable dans un lien tel:, sans jamais inventer un indicatif qu'on n'a pas. */
/* SEPARATEURS d'une cellule qui porte PLUSIEURS numeros, elargis le 11/09/2026.
   Le tiret n'est reconnu qu'ENTOURE D'ESPACES : « 06-12-34-56-78 » est un seul numero,
   « 06 12 34 56 78 - 04 94 12 34 56 » en fait deux.
   Un separateur oublie ne fabrique pas un numero manquant, il fabrique un numero FAUX :
   « 0612345678, 0494123456 » composait les vingt chiffres d'un seul tenant pendant que
   l'ecran affichait les deux numeros justes, et rien ne levait d'erreur. */
const SEP_TELS=/\s*(?:[|;\/,]|\s-\s|\bou\b|\bet\b|\bpuis\b)\s*/i;
function parseTels(cell,pays){
  if(!cell)return [];
  const out=[],vus=new Set();
  /* Le repli sur la France ne vaut que pour un pays VIDE ou francais. Ailleurs, un
     mobile belge « 0475 12 34 56 » devenait +33 475 123 456, un fixe VALIDE en Ardeche :
     le vigneron appelait un inconnu en croyant joindre son client export, sans aucun
     signe que quoi que ce soit ait rate. C'est la regle deja ecrite au-dessus,
     « sans jamais inventer un indicatif qu'on n'a pas », qui n'etait pas tenue ici. */
  const fr=!pays||/^(fr|france)$/i.test(String(pays).trim());
  String(cell).split(SEP_TELS).forEach(part=>{
    const s=part.trim();
    if(!s)return;
    /* On ne retient que le PREMIER bloc qui ressemble a un numero, jamais toute la
       cellule : « 04 94 12 34 56 poste 12 » ne doit pas composer 049412345612, et
       « tel 2 : 06 12 34 56 78 » ne doit pas composer 20612345678. */
    const m=s.match(/\+?\s*(?:\d[\s.\-()]*){8,15}/);
    if(!m)return;
    const trouve=m[0];
    /* Le + se cherche DEVANT le premier chiffre, pas en tete de chaine : « (+33) 6 12... »
       et « Tel. +33 6 12... » commencent par autre chose, perdaient leur +, et
       « 33612345678 » sans + est compose par l'iPhone comme un numero national. */
    const avant=s.slice(0,m.index+trouve.search(/\d/));
    let plus=/\+\D*$/.test(avant);
    let d=trouve.replace(/\D/g,'');
    if(!d)return;
    // « 00 » international equivaut a « + ».
    if(!plus&&d.startsWith('00')){plus=true;d=d.slice(2);}
    // « +33 (0)4 94... » : le zero de courtoisie apres l'indicatif francais est en trop.
    if(plus&&d.startsWith('330'))d='33'+d.slice(3);
    let appel;
    if(plus){appel='+'+d;}
    else if(fr&&d.length===10&&d.startsWith('0')){appel='+33'+d.slice(1);}  // numero francais standard
    else if(fr&&d.length===9&&!d.startsWith('0')){appel='+33'+d;}           // zero de tete perdu a la saisie
    else {appel=d;}                                                      // format inconnu : on n'invente pas
    if(appel.replace(/\D/g,'').length<8)return;                          // trop court pour etre un numero
    if(vus.has(appel))return;
    vus.add(appel);
    out.push({appel,affiche:formatTel(appel,trouve)});   // trouve, pas s : on affiche le bloc qu'on compose
  });
  return out;
}
// Affichage lisible. Un numero francais se met en paires, c'est la convention du pays.
// Pour un numero etranger on NE reformate PAS : chaque pays a son propre decoupage et
// regrouper par deux depuis la fin decale l'indicatif (+41 79 devenait +417 9).
// On rend donc la saisie d'origine, simplement debarrassee des separateurs decoratifs.
function formatTel(appel,brut){
  if(/^\+33\d{9}$/.test(appel)){
    const n='0'+appel.slice(3);
    return n.replace(/(\d{2})(?=\d)/g,'$1 ').trim();
  }
  const propre=String(brut||'').replace(/[().]/g,' ').replace(/\s+/g,' ').trim();
  /* GARDE-FOU du 11/09/2026 : l'affichage ne peut plus DIVERGER de ce qui sera compose.
     Avant, cette fonction rendait la saisie brute quoi qu'il arrive, donc l'ecran montrait
     un numero juste pendant que le lien tel: en composait un faux. C'est le pire des deux
     etats : pas d'erreur, pas de soupcon, juste un appel qui n'aboutit pas.
     Si les chiffres ne correspondent pas, on affiche CE QU'ON COMPOSE. */
  return propre&&propre.replace(/\D/g,'')===appel.replace(/\D/g,'')?propre:appel;
}

/* ======================= REGLAGES DU DOMAINE =======================
   Dans Vitisoft, Origine, Lieu de vente et les champs Perso sont saisis librement :
   chaque domaine y met ce qu'il veut. Aucune liste de valeurs ecrite en dur ne peut
   donc etre juste ailleurs que chez celui qui l'a ecrite.
   Principe retenu : on ne suppose rien, on decouvre les valeurs reellement presentes,
   on PROPOSE un classement, le vigneron tranche une fois, et on memorise.
   Sans reglage enregistre, l'outil retombe sur les propositions automatiques :
   il fonctionne toujours, simplement avec l'aveu qu'il a deviné.
   Forme de REG :
     {champCanal, champType, horsCA:{famille:bool}, gratuit:{type:bool},
      canaux:{valeur:'libelle'}, types:{valeur:'libelle'}, valide:bool}
*/
let REG=null;
/* ================= LE DRAPEAU DU CLASSEMENT NON LU, 19/09/2026 =================
   SANS LES REGLAGES, LES CHIFFRES SONT CALCULES AU JUGE ET RIEN NE LE DISAIT. Quand la
   lecture des reglages du compte echoue au demarrage, deux choses retombent en silence :
     - `classerLigne()` passe en « mode devine » (plus bas dans ce fichier), donc les
       canaux de vente sortent d'une liste generique et toutes les typologies clients
       deviennent « Non type » ;
     - `EX_START` reste a 1, donc « Mon cap » compare des ANNEES CIVILES a quelqu'un dont
       l'exercice ouvre en aout.
   Les chiffres restent plausibles, et ils sont FAUX. Le cas n'est pas rare : la
   deconnexion efface la copie locale des reglages, donc il se produit a chaque
   reconnexion sur un navigateur qui vient d'etre vide.

   TROIS ETATS, ET PAS DEUX. `false` veut dire « le compte a repondu » : s'il n'a pas de
   classement enregistre, c'est une base neuve, et le mode devine est alors une reponse
   honnete qu'on annonce deja dans l'ecran du classement. `true` veut dire « le compte n'a
   PAS repondu » : il y a peut-etre un classement, on ne le sait pas, et c'est ce cas-la
   qu'il faut dire.

   COMMENT LE LIRE DEPUIS UN ECRAN. `classementIncertain()` rend vrai quand le classement
   affiche n'est pas celui du vigneron ET qu'on ne peut pas jurer qu'il n'en a pas. Les
   deux fonctions sont globales, comme tout ce fichier : bdv-ecrans.js les appelle
   directement, sans passer par un objet. */
let REGLAGES_NON_LUS=false;
function marquerReglagesNonLus(v){REGLAGES_NON_LUS=(v!==false);}
function classementIncertain(){return REGLAGES_NON_LUS===true&&!(REG&&REG.valide);}
const CHAMPS_CANDIDATS=[
  {k:'lieuVente',  l:'Lieu de vente'},
  {k:'origine',    l:'Origine'},
  {k:'codeTarif',  l:'Code tarif'},
  {k:'depot',      l:'Dépôt'},
  {k:'commercial', l:'Commercial'},
  {k:'vendeur',    l:'Vendeur'},
  {k:'triPerso1',  l:'Tri perso facture 1'},
  {k:'persoClient1',l:'Perso client 1'},{k:'persoClient2',l:'Perso client 2'},{k:'persoClient3',l:'Perso client 3'},
  {k:'persoClient4',l:'Perso client 4'},{k:'persoClient5',l:'Perso client 5'},{k:'persoClient6',l:'Perso client 6'},
  {k:'persoClient7',l:'Perso client 7'},{k:'persoClient8',l:'Perso client 8'},{k:'persoClient9',l:'Perso client 9'}
];
// Une valeur consideree comme vide : chaine blanche, ou zero seul (fréquent dans les champs perso).
function estVide(v){const s=String(v==null?'':v).trim();return !s||s==='0';}

// Profil d'un champ sur la base chargee : remplissage, dispersion, forme temporelle des valeurs.
// Sert a classer les champs du plus exploitable au moins exploitable, sans rien presumer du sens.
function profilChamp(cle){
  const vals={};let remplies=0;
  ROWS.forEach(r=>{
    const v=String(r[cle]==null?'':r[cle]).trim();
    if(estVide(v))return;
    remplies++;
    const e=vals[v]||(vals[v]={v,n:0,ca:0,jours:new Set(),clients:new Set(),min:Infinity,max:-Infinity});
    e.n++;e.ca+=r._total;
    if(r._dayNum!=null){e.jours.add(r._dayNum);e.min=Math.min(e.min,r._dayNum);e.max=Math.max(e.max,r._dayNum);}
    e.clients.add(clientKey(r));
  });
  const liste=Object.values(vals).sort((a,b)=>b.n-a.n);
  return {cle,remplies,taux:ROWS.length?remplies/ROWS.length:0,distinct:liste.length,liste};
}
// Forme d'une valeur : ponctuelle ou installee dans la duree. Cette lecture est FIABLE,
// elle ne repose que sur les dates. Elle ne dit rien du sens : « Ami » et « Ramatuelle »
// ont la meme forme. C'est pourquoi elle ne sert qu'a proposer, jamais a conclure.
function formeValeur(e){
  if(!e.jours.size)return 'indéterminée';
  const etendue=e.max-e.min+1;
  if(e.jours.size<=3&&etendue<=7)return 'ponctuelle';
  if(etendue>200&&e.jours.size>=10)return 'récurrente';
  if(e.clients.size===1)return 'un seul client';
  return 'intermittente';
}
// Proposition de libelle pour une valeur de canal. Purement indicative.
function proposerCanal(v,e){
  const k=norm(v);
  for(const c of CANAUX){
    if(c.startsWith&&c.startsWith.some(p=>k.startsWith(norm(p))))return c.label;
    if(c.match&&c.match.some(p=>k.includes(norm(p))))return c.label;
  }
  // Rien dans le vocabulaire connu. On ne fusionne surtout pas : deux caveaux dans deux
  // communes doivent rester deux lignes distinctes. On reprend donc la valeur telle quelle,
  // proprement capitalisee, et le vigneron regroupe lui-meme s'il le souhaite.
  // Seules les valeurs d'un seul jour sont rassemblees, un salon ponctuel se suffit rarement.
  if(formeValeur(e)==='ponctuelle')return 'Événement';
  return capit(v);
}
// « grimaud » devient « Grimaud », « SALON DU VIN » devient « Salon du vin ».
function capit(s){
  const t=String(s||'').trim();
  if(!t)return '';
  if(t===t.toUpperCase()&&t.length>3)return t.charAt(0)+t.slice(1).toLowerCase();
  return t.charAt(0).toUpperCase()+t.slice(1);
}
// Proposition de regroupement pour une typologie client : on rassemble par racine alphabetique
// (CAV, CAV1, CAV3 -> CAV ; CHR, CHR1, CHR2 -> CHR), ce qui colle aux codes tarif reels.
function proposerType(v){
  const s=String(v||'').trim().toUpperCase();
  const racine=s.replace(/[\s._-]*\d+$/,'');
  return racine||s;
}
// Reglages par defaut, entierement deduits du fichier charge. Aucun choix humain encore.
function reglagesProposes(){
  const profils={};CHAMPS_CANDIDATS.forEach(c=>profils[c.k]=profilChamp(c.k));
  // Choix des colonnes par defaut. Le CONTENU des champs est libre, mais pas leurs EN-TETES :
  // c'est Vitisoft qui fixe les colonnes, pas l'utilisateur. Le nom de la colonne est donc la
  // seule sémantique fiable dont on dispose, et il prime sur le taux de remplissage.
  // Se fier au champ le plus rempli donnerait « Vendeur » comme canal de vente, ce qui est faux.
  const utiles=CHAMPS_CANDIDATS.map(c=>profils[c.k]).filter(p=>p.distinct>=2&&p.distinct<=60);
  const dispo=k=>profils[k]&&profils[k].distinct>=2;
  const secours=(exclu)=>(utiles.filter(p=>p.cle!==exclu).sort((a,b)=>b.taux-a.taux)[0]||{cle:'lieuVente'}).cle;
  const champType=dispo('codeTarif')?'codeTarif':secours(null);
  const champCanal=dispo('lieuVente')&&champType!=='lieuVente'?'lieuVente'
                  :(dispo('origine')&&champType!=='origine'?'origine':secours(champType));
  const R={champCanal,champType,horsCA:{},gratuit:{},canaux:{},types:{},valide:false};
  // Familles : la liste noire historique sert de proposition, plus rien d'autre.
  const fams=new Set();ROWS.forEach(r=>{const f=String(r.famille||'').trim();if(f)fams.add(f);});
  fams.forEach(f=>{R.horsCA[f]=FAMILLES_HORS_CA.some(x=>norm(f).includes(norm(x)));});
  // Types offerts : toute valeur non vide etait consideree comme une sortie gratuite.
  const tos=new Set();ROWS.forEach(r=>{const t=String(r.typeOffert||'').trim();if(t)tos.add(t);});
  tos.forEach(t=>{R.gratuit[t]=true;});
  profils[champCanal].liste.forEach(e=>{R.canaux[e.v]=proposerCanal(e.v,e);});
  profils[champType].liste.forEach(e=>{R.types[e.v]=proposerType(e.v);});
  R._profils=profils;
  return R;
}
// Applique les reglages a une ligne. Tout passe par ici, plus aucune decision ailleurs.
function classerLigne(o){
  const R=REG;
  const fam=String(o.famille||'').trim();
  const to=String(o.typeOffert||'').trim();
  if(R&&R.valide){
    o._horsVin=!!R.horsCA[fam];
    o._offert=to?!!R.gratuit[to]:false;
    o._canal=R.canaux[String(o[R.champCanal]||'').trim()]||'Autre / non renseigné';
    o._typeClient=R.types[String(o[R.champType]||'').trim()]||'Non typé';
  }else{
    // Mode deviné : comportement historique, conserve tel quel.
    o._horsVin=FAMILLES_HORS_CA.some(f=>norm(fam).includes(norm(f)));
    o._offert=to!=='';
    o._canal=normCanal(o.lieuVente);
    o._typeClient='Non typé';
  }
  o._vente=!o._horsVin&&!o._offert;
  o._vin=o._vente;
  return o;
}

// Canal normalise a partir du lieu de vente brut.
function normCanal(raw){
  const k=norm(raw);
  if(!k)return 'Autre / non renseigne';
  for(const c of CANAUX){
    if(c.startsWith&&c.startsWith.some(p=>k.startsWith(norm(p))))return c.label;
    if(c.match&&c.match.some(p=>k.includes(norm(p))))return c.label;
  }
  return 'Autre / non renseigne';
}

/* ======================= INDEXEDDB ======================= */
function dbOpen(){
  return new Promise((res,rej)=>{
    // Version 2 : ajout du store des reglages. La montee de version ne touche pas au store
    // des lignes, les bases deja constituees sont conservees telles quelles.
    const rq=indexedDB.open(DB_NAME,2);
    rq.onupgradeneeded=e=>{const db=e.target.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'h'});
      if(!db.objectStoreNames.contains(STORE_REG))db.createObjectStore(STORE_REG);
    };
    rq.onsuccess=e=>res(e.target.result);
    rq.onerror=e=>rej(e.target.error);
  });
}
// Reglages du domaine : un seul enregistrement, cle fixe.
async function regLire(){
  const db=await dbOpen();
  return new Promise(res=>{
    const rq=db.transaction(STORE_REG,'readonly').objectStore(STORE_REG).get('v1');
    rq.onsuccess=()=>res(rq.result||null);rq.onerror=()=>res(null);
  });
}
async function regEcrire(obj){
  const db=await dbOpen();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE_REG,'readwrite');
    tx.objectStore(STORE_REG).put(obj,'v1');
    tx.oncomplete=()=>res(true);tx.onerror=e=>rej(e.target.error);
  });
}
// Ajoute des lignes {h, raw:[...40]} en ignorant les doublons (meme empreinte). Renvoie {added,dup}.
async function dbAddMany(items){
  const db=await dbOpen();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE,'readwrite'),st=tx.objectStore(STORE);
    let added=0,dup=0,enriched=0,i=0;
    function next(){
      if(i>=items.length){return;}
      const it=items[i++];
      const g=st.get(it.h);
      g.onsuccess=()=>{
        const old=g.result;
        if(old){
          // Ligne deja connue. Un export plus recent peut porter des colonnes hors empreinte
          // (aujourd'hui : les adresses e-mail). On complete au lieu d'ignorer betement.
          if(rawEnrichit(old.raw,it.raw)){st.put(it);enriched++;}
          else dup++;
        }
        else{st.add(it);added++;}
        next();
      };
      g.onerror=()=>{next();};
    }
    next();
    tx.oncomplete=()=>res({added,dup,enriched});
    tx.onerror=e=>rej(e.target.error);
  });
}
async function dbGetAll(){
  const db=await dbOpen();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE,'readonly'),rq=tx.objectStore(STORE).getAll();
    rq.onsuccess=()=>res(rq.result||[]);rq.onerror=e=>rej(e.target.error);
  });
}
async function dbClear(){
  const db=await dbOpen();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();
    tx.oncomplete=()=>res();tx.onerror=e=>rej(e.target.error);
  });
}
async function dbCount(){
  const db=await dbOpen();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE,'readonly'),rq=tx.objectStore(STORE).count();
    rq.onsuccess=()=>res(rq.result);rq.onerror=e=>rej(e.target.error);
  });
}

/* ======================= IMPORT ======================= */
// Echap ferme la fiche client, ou l'ecran d'import si aucune fiche n'est ouverte.
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!document.body.classList.contains('bdv-page-fiche')&&el('modale')&&el('modale').classList.contains('on')&&typeof fermerFiche==='function'){e.preventDefault();fermerFiche();}
});
// Deux zones de depot vivent dans la page depuis le 04/09/2026 : celle de l'ecran d'arrivee,
// et celle de l'ecran « Ma base », pour qu'ajouter un export ne fasse plus sortir de l'outil.
// Celle de « Ma base » est reconstruite a chaque rendu du panneau, donc elle doit pouvoir etre
// rebranchee autant de fois qu'il le faut : le drapeau `branchee` evite d'empiler les ecouteurs,
// ce qui declencherait handleFiles plusieurs fois sur un seul depot.
function bindZoneDepot(idZone,idChamp){
  const dz=el(idZone),fi=el(idChamp);
  if(!dz||!fi||dz.dataset.branchee==='1')return;
  dz.dataset.branchee='1';
  fi.addEventListener('change',e=>handleFiles(e.target.files));
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over');});
  dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
  dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');handleFiles(e.dataTransfer.files);});
  dz.addEventListener('click',()=>fi.click());
}
// bindImport() a disparu avec l'ecran plein page : la seule zone de depot vit dans
// « Ma base », et renderBase() la relie a chaque rendu.
async function handleFiles(list){
  const files=Array.from(list).filter(f=>f.name.toLowerCase().endsWith('.csv'));
  if(!files.length){status('error','Dépose un fichier .csv exporté depuis Vitisoft.');return;}
  let totAdded=0,totDup=0,totEnrich=0;
  const aPousser=[];
  for(const f of files){
    try{
      status('loading','Lecture de '+f.name+'...');
      const items=await readVitisoftCSV(f);
      const r=await dbAddMany(items);
      totAdded+=r.added;totDup+=r.dup;totEnrich+=(r.enriched||0);
      aPousser.push.apply(aPousser,items);
    }catch(err){status('error','Erreur sur '+f.name+' : '+err.message);return;}
  }
  // On envoie TOUTES les lignes lues, pas seulement les nouvelles. dbAddMany ne dit pas
  // lesquelles il a retenues, et le serveur fusionne les doublons de toute facon. Un reimport
  // renvoie donc des lignes deja connues : c'est du reseau pour rien, mais c'est sans risque,
  // alors qu'un suivi approximatif de « ce qui est nouveau » laisserait des trous en base.
  // UN SEUL compte rendu, a la fin, et il dit la verite sur les DEUX cotes.
  // Jusqu'au 07/09/2026 l'echec de sauvegarde etait annonce ICI, puis efface quelques
  // millisecondes plus tard par le message de succes pose dix lignes plus bas. Ted a donc vu
  // « tout va bien » alors que 4 442 lignes n'etaient jamais arrivees sur son compte, et ce
  // message vert est ce qui a rendu le trou indetectable pendant toute une matinee.
  let echecsSync=0;
  if(syncPret()&&aPousser.length){
    status('loading','Enregistrement sur ton compte...');
    const env=await BdvSync.pousserVentes(aPousser,function(fait,total){
      status('loading','Enregistrement sur ton compte, '+fmtNum(fait)+' / '+fmtNum(total)+'...');
    });
    echecsSync=env.echecs;
  }
  /* LES NOUVELLES LIGNES SONT EN BASE, LE RESUME DU SERVEUR NE LES CONNAIT PAS. Ici on
     n'attend rien : `pousserVentes` est deja resolu, donc le serveur a de quoi
     recalculer juste. On n'attend pas la REPONSE non plus, l'import a deja fait
     patienter assez longtemps ; d'ici l'`ecranRafraichir()` du bas, CAP est a null et
     l'ecran calcule en local, ce qui est plus lent mais jamais faux. */
  capPerimer();
  /* ET ON RECHAUFFE LE CACHE DU SERVEUR, sans l'attendre. Les declencheurs viennent
     d'effacer les trois resumes ; le prochain ecran ouvert paierait leur calcul. Ici le
     vigneron lit encore son compte rendu d'import : c'est le seul moment de la journee
     ou quelques secondes de serveur ne se voient pas. */
  if(syncPret() && BdvSync.rechaufferResumes) BdvSync.rechaufferResumes();
  await reloadFromDB();
  const total=ROWS.length;
  const per=META.min&&META.max?(' sur la période '+fmtDate(META.min)+' au '+fmtDate(META.max)):'';
  // Un export deja importe qui revient enrichi (adresses e-mail) ne doit pas passer pour un echec.
  const enrichTxt=totEnrich?', '+plur(totEnrich,'ligne','complétée')+' avec les adresses e-mail':'';
  // L'accord du verbe suit le nombre, comme l'accord du nom : « 1 client sur 3 sont
  // joignables » se lisait deja de travers du temps des « (s) ». 19/09/2026.
  const couvTxt=COUV.total?' '+plur(COUV.joignables,'client')+' sur '+fmtNum(COUV.total)
    +(COUV.joignables>1?' sont joignables (':' est joignable (')
    +fmtNum(COUV.mail)+' par e-mail, '+fmtNum(COUV.tel)+' par téléphone).':'';
  const resume=plur(totAdded,'ligne','ajoutée')+', '+plur(totDup,'doublon','ignoré')+enrichTxt+'. Base totale = '+fmtNum(total)+' lignes'+per+'.'+couvTxt;
  if(echecsSync)status('error','Attention, '+plur(echecsSync,'ligne')+(echecsSync>1?' n\'ont pas pu être enregistrées':' n\'a pas pu être enregistrée')+' sur ton compte. Elle'+(echecsSync>1?'s sont bien':' est bien')+' sur cet appareil. '+resume);
  else status('success',resume);
  if(!BdvCompte.session()) await BdvCompte.porte({titre:'Tes chiffres sont prêts.'});
  // Le panneau, s'il est ouvert, doit montrer la base D'APRES l'import. Au bureau c'est le
  // SEUL rafraichissement : il n'y a pas de renderAll() la-bas, ni d'ecran a rouvrir.
  ecranRafraichir();
  // Puis l'analyse que « Ma journee » sert sans la calculer. En dernier et sans await :
  // le compte rendu ci-dessus est deja a l'ecran, et le bureau se repeint quand elle
  // revient. Voir l'entete de analyserPourLeBureau() pour le pourquoi des quatre etapes.
  analyserPourLeBureau();
}
// Lit le CSV en windows-1252 (PAS UTF-8), separateur ; , renvoie [{h, raw:[...]}].
// Compare la ligne d'en-tete aux noms attendus. On tolere qu'un export soit plus COURT
// (une version anterieure du logiciel, sans les colonnes recentes) et plus LONG (des colonnes
// que ce dashboard ne connait pas encore, simplement ignorees). On refuse le decalage.
function verifierEntete(premiere){
  if(!premiere||!premiere.length)return {ok:false,message:'fichier vide'};
  const lus=premiere.map(c=>normEntete(c));
  // Un export sans ligne d'en-tete (1re cellule = une date) reste accepte : on ne peut rien verifier.
  if(parseDateFR(premiere[0]))return {ok:true,sansEntete:true};
  const communes=Math.min(lus.length,ENTETES.length);
  for(let i=0;i<communes;i++){
    if(lus[i]!==normEntete(ENTETES[i])){
      return {ok:false,message:'Colonne '+(i+1)+' inattendue : le fichier annonce « '+premiere[i]
        +' » là où « '+ENTETES[i]+' » est attendu. Cet export ne correspond pas au format connu, '
        +'rien n\'a été importé pour ne pas mélanger tes données.'};
    }
  }
  if(lus.length<ENTETES.length)return {ok:true,partiel:ENTETES.length-lus.length};
  return {ok:true,extra:lus.length-ENTETES.length};
}
// Comparaison d'en-tete tolerante : accents, casse, espaces multiples et BOM ne comptent pas.
function normEntete(s){
  return String(s==null?'':s).replace(/^\uFEFF/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();
}
function readVitisoftCSV(file){
  return new Promise((res,rej)=>{
    const rd=new FileReader();
    rd.onload=e=>{
      try{
        const buf=new Uint8Array(e.target.result);
        const text=new TextDecoder('windows-1252').decode(buf);
        const parsed=Papa.parse(text,{delimiter:';',skipEmptyLines:true});
        const rows=parsed.data;
        const items=[];
        // Verification de l'en-tete AVANT de lire quoi que ce soit. Les colonnes sont lues
        // par position : si Vitisoft en insere une au milieu dans une version future, tout
        // se decale en silence. On refuse plutot que de charger n'importe quoi.
        const ctrl=verifierEntete(rows[0]);
        if(!ctrl.ok){rej(new Error(ctrl.message));return;}
        rows.forEach((row,idx)=>{
          if(!row||!row.length)return;
          // Sauter la ligne d'en-tete (1ere cellule = "Date" ou pas une date).
          if(idx===0 && !parseDateFR(row[0]))return;
          if(!parseDateFR(row[0]))return; // ligne sans date valide (total, vide) => ignore
          const raw=[];for(let i=0;i<COLS.length;i++)raw.push(row[i]==null?'':String(row[i]));
          // Empreinte sur le socle historique uniquement : un export enrichi d'une colonne
          // supplementaire doit reconnaitre les lignes deja en base, pas les redoubler.
          items.push({h:cyrb53(raw.slice(0,HASH_COLS).join('')),raw});
        });
        res(items);
      }catch(err){rej(err);}
    };
    rd.onerror=()=>rej(new Error('lecture impossible'));
    rd.readAsArrayBuffer(file);
  });
}
function fmtDate(d){return d?String(d.d).padStart(2,'0')+'/'+String(d.m).padStart(2,'0')+'/'+d.y:'';}

/* ======================= DERIVATION EN MEMOIRE ======================= */
/* Rendre la main au navigateur, une fois, pour qu'il ait le droit de peindre.
   Sans ca, une boucle de 171 569 tours tient le fil d'execution du debut a la fin :
   le message « analyse en cours » est bien ECRIT dans le document, et il n'apparait
   jamais, parce que rien ne repeint entre son ecriture et la fin du calcul. C'est
   exactement ce que Ted decrivait : « j'ai meme pas de message pour me dire que ca
   mouline ». Un message qu'on n'a pas laisse le temps de s'afficher n'existe pas. */
function souffler(){ return new Promise(function(r){ setTimeout(r, 0); }); }

/* La derivation par paquets. PAQUET vaut 8 000 : mesure du 17/09/2026, c'est environ
   80 ms de calcul, donc une respiration a peu pres tous les trois battements d'ecran.
   Plus petit, on paie le va-et-vient pour rien ; plus gros, la barre de progression
   avance par a-coups et l'onglet se fige entre deux. */
const PAQUET = 8000;
async function deriverParPaquets(items, dire){
  const out = new Array(items.length);
  for(let i = 0; i < items.length; i += PAQUET){
    const fin = Math.min(i + PAQUET, items.length);
    for(let j = i; j < fin; j++) out[j] = deriveRow(items[j].raw);
    if(dire) dire('Analyse de tes ventes, ' + fmtNum(fin) + ' lignes sur ' + fmtNum(items.length) + '…');
    if(fin < items.length) await souffler();
  }
  return out;
}

/* `dire` est facultatif : il vient de l'amorcage quand l'ouverture passe par lui, et
   il manque partout ailleurs. Une relecture declenchee par un reglage ne doit pas
   poser de voile, elle est deja dans un runBusy. */
async function reloadFromDB(dire){
  if(dire) dire('Lecture de ta base sur cet appareil…');
  const items=await dbGetAll();
  REG=await regLire();                    // les reglages doivent etre la AVANT de classer
  ROWS=await deriverParPaquets(items, dire);
  if(dire){ dire('Mise en ordre de ' + fmtNum(ROWS.length) + ' lignes…'); await souffler(); }
  computeMeta();
  // Sans reglage enregistre, on prepare les propositions pour l'ecran dedie, sans les appliquer.
  if(!REG||!REG.valide)PROPOSE=reglagesProposes();
}
let PROPOSE=null;
// Enregistre les reglages saisis par le vigneron et reclasse toute la base.
async function appliquerReglages(R){
  R.valide=true;delete R._profils;
  await regEcrire(R);
  REG=R;syncClassement();
  REG=R;
  ROWS=ROWS.map(r=>classerLigne(r));
  computeMeta();
  runBusy('Application de tes réglages…',()=>{ecranRafraichir();});
  status('success','Réglages enregistrés. Toute la base a été reclassée.');
}
// Revient aux propositions automatiques.
async function oublierReglages(){
  if(!confirm('Revenir au classement automatique ? Tes regroupements seront perdus.'))return;
  await regEcrire({valide:false});
  await reloadFromDB();
  // APRES reloadFromDB, qui vient de relire REG : abandonner le classement est un geste comme
  // un autre, il doit partir en base. Sans cette ligne, les regroupements restaient sur le
  // compte et le prochain appareil les reappliquait.
  syncClassement();
  runBusy('Retour au classement automatique…',()=>{ecranRafraichir();});
}
/* ======================= EXERCICE COMPTABLE =======================
   Un exercice est nomme par son ANNEE D'OUVERTURE. Trois champs derives par ligne,
   calcules une fois, pour qu'aucun ecran n'ait plus a raisonner en mois civils :

     _exY    annee d'ouverture de l'exercice qui contient la date.
     _exM    rang du mois DANS l'exercice, 1 a 12 (1 = le mois d'ouverture).
     _exPos  rang mois/jour dans l'exercice, sous la forme _exM*100+jour.

   _exPos est le SEUL curseur des comparaisons « a date egale ». Il est monotone, et
   surtout insensible aux annees bissextiles, contrairement a un ecart en jours : un
   ecart en jours ferait comparer le 15 juin d'une annee au 14 juin d'une autre.

   EX_START=1 rend _exY identique a l'annee civile et _exPos identique a l'ancien
   mois*100+jour de inWindow(). C'est le test de non-regression de tout ce module :
   sur un exercice civil, aucun chiffre de l'outil ne doit bouger d'un centime. */
function exMoisDansExercice(m){return ((m-EX_START+12)%12)+1;}
function exAnnee(d){return EX_START===1?d.y:(d.m>=EX_START?d.y:d.y-1);}
function exDeriver(o){
  if(!o._date){o._exY=null;o._exM=null;o._exPos=null;return o;}
  o._exY=exAnnee(o._date);
  o._exM=exMoisDansExercice(o._date.m);
  o._exPos=o._exM*100+o._date.d;
  return o;
}
// Cale sur janvier, l'exercice EST l'annee civile : on l'ecrit « 2026 », sans jargon.
// Autrement il chevauche deux annees, et seul le double millesime est lisible.
function exLabel(y){return y==null?'':(EX_START===1?String(y):(y+'/'+(y+1)));}
function exLabelCourt(y){return y==null?'':(EX_START===1?String(y):(y+'/'+String(y+1).slice(2)));}
// Le mot juste dans une phrase, et sa forme avec demonstratif.
function exMot(){return EX_START===1?'année':'exercice';}
/* « année » est feminin, « exercice » est masculin, et le mot change selon le domaine. Ecrire
   `le ${exMot()} précédent` donnait donc « le année précédent » a tout domaine en annee
   civile, c'est-a-dire a la grande majorite. La faute s'affichait sur chaque ligne du tableau
   des clients, dans le diagnostic de « Mon annee », et dans deux messages de plus.

   C'est exactement le piege que les trois fonctions d'article de ce fichier existent pour
   eviter, applique cette fois a un mot du depot et non a un nom de cuvee. D'ou cette
   quatrieme : elle rend le groupe entier, article et accord compris, et il n'y a plus rien
   a accorder autour. */
function exPrecedent(){return EX_START===1?'l\u2019année précédente':'l\u2019exercice précédent';}
function exCe(){return EX_START===1?'cette année':'cet exercice';}
// exMoisNom() a disparu le 19/09/2026, sans appelant. Le nom d'un mois civil se prend
// directement dans MOIS_PLEIN, et l'ordre de l'exercice dans exMoisLabels() juste dessous.
// Les douze mois dans l'ordre de l'exercice, pour l'axe des graphiques mensuels.
function exMoisLabels(){const a=[];for(let i=0;i<12;i++)a.push(MOIS_FR[(EX_START-1+i)%12]);return a;}
// Bornes d'un exercice en jour absolu (_dayNum), pour les raccourcis de periode.
function exBornes(y){
  return {debut:Math.floor(Date.UTC(y,EX_START-1,1)/86400000),
          fin:Math.floor(Date.UTC(y+1,EX_START-1,1)/86400000)-1};
}
// Changement du mois d'ouverture. On ne retouche NI la base NI les empreintes : on
// recalcule les trois champs derives sur les lignes deja en memoire, et on repart de zero
// cote selection, parce qu'une selection calee sur l'ancien decoupage ne veut plus rien dire.
function exAppliquer(m){
  const n=parseInt(m,10);
  if(!(n>=1&&n<=12)||n===EX_START)return;
  EX_START=n;
  try{if(n===1)localStorage.removeItem(EX_KEY);else localStorage.setItem(EX_KEY,String(n));}catch(e){}
  syncExercice();
  ROWS.forEach(exDeriver);
  filters={ex:null,from:null,to:null,preset:'tous'};
  computeMeta();
  runBusy('Recalcul sur le nouvel exercice…',()=>{if(typeof buildFilterBar==='function')buildFilterBar();ecranRafraichir();});
}

/* ============ LA LIGNE NE RECOPIE PLUS SES 43 COLONNES, 17/09/2026 ============

   MESURE SUR LA BASE DE FACTURATION DE TED, 171 569 lignes, moteur reel :

                                  avant        apres
     derivation des lignes        2 698 ms     1 597 ms
     computeMeta()                  971 ms       387 ms
     memoire des seules colonnes    268 Mo        10 Mo

   `COLS.forEach((k,i)=>o[k]=raw[i])` recopiait QUARANTE-TROIS colonnes dans un objet
   nomme, pour chaque ligne. Sur 171 569 lignes ca fait sept millions et demi
   d'ecritures de proprietes et 268 Mo d'objets, dont la plupart des colonnes ne sont
   jamais lues par aucun ecran. Et le prix ne s'arretait pas la : sous cette pression
   memoire, `computeMeta()`, qui ne fait que parcourir, mettait presque une seconde.

   LES COLONNES SONT DONC DES ACCESSEURS POSES UNE FOIS SUR UN PROTOTYPE, et la ligne
   ne garde que le tableau brut. `r.produit` s'ecrit et se lit exactement pareil :
   AUCUN ecran n'a change d'une virgule. Mesure de lecture, trois colonnes sur toutes
   les lignes : 147 ms en recopie, 14 ms par le prototype. C'est meme plus rapide a
   lire, parce que 171 569 objets a 43 proprietes chacun font sortir V8 de ses formes
   optimisees, alors qu'un prototype unique l'y garde.

   CE QUE CA INTERDIT, ET IL FAUT LE SAVOIR AVANT D'ECRIRE : `Object.keys(r)`,
   `{...r}` et `Object.assign({}, r)` ne rendront PAS les colonnes, seulement les
   champs derives. Verifie le 17/09/2026 : aucun des trois n'existe dans le depot, et
   c'est ce qui rend ce changement sur. Une exportation qui voudrait toutes les
   colonnes lit `r._r`, le tableau brut, comme le fait deja l'empreinte.

   `enumerable: true` est pose quand meme : une boucle `for...in` sur une ligne
   continue de voir les colonnes, et c'est la forme la plus probable qu'on ecrirait
   sans y penser. */
const LIGNE_PROTO = {};
COLS.forEach(function(k,i){
  Object.defineProperty(LIGNE_PROTO, k, {
    get: function(){ const v = this._r[i]; return v == null ? '' : v; },
    enumerable: true
  });
});

// Transforme les 43 champs bruts en objet exploitable + classification vente/non-vente.
function deriveRow(raw){
  const o=Object.create(LIGNE_PROTO);o._r=raw;
  o._date=parseDateFR(o.date);
  o._dayNum=o._date?Math.floor(Date.UTC(o._date.y,o._date.m-1,o._date.d)/86400000):null; // jour absolu, pour les intervalles en jours
  exDeriver(o);            // exercice comptable : _exY, _exM, _exPos (voir plus haut)
  o._total=parseNum(o.totalHT);
  o._pu=parseNum(o.puHT);
  o._qte=parseNum(o.quantite);
  o._emails=parseEmails(o.emails);        // adresses nettoyees de la ligne (0, 1 ou plusieurs)
  o._email=o._emails[0]||'';              // adresse principale, pour l'affichage
  o._tels=parseTels(o.mobile,o.pays).concat(parseTels(o.fixe,o.pays));  // mobile d'abord : on joint plus vite un portable
  o._tel=o._tels.length?o._tels[0].appel:'';
  o._joignable=o._emails.length>0||o._tels.length>0;      // joignable par un canal au moins
  // Classification (vente, hors CA, offert, canal, typologie) : entierement deleguee
  // aux reglages du domaine, avec repli sur les propositions automatiques.
  return classerLigne(o);
}
function computeMeta(){
  let min=null,max=null;const ys=new Set(),xs=new Set();
  ROWS.forEach(r=>{if(!r._date)return;if(!min||r._date.t<min.t)min=r._date;if(!max||r._date.t>max.t)max=r._date;ys.add(r._date.y);if(r._exY!=null)xs.add(r._exY);});
  META={min,max,years:[...ys].sort((a,b)=>a-b),exercices:[...xs].sort((a,b)=>a-b)};
  // Combien de lignes n'ont pas de numero client et se rabattent sur le nom. Doit valoir zero
  // sur un export Vitisoft. Autre chose que zero veut dire que la cle de suivi de ces lignes la
  // est fragile, et l'ecran Ma base le dit au lieu de le taire.
  SANS_NUM=ROWS.filter(r=>!String(r.numClient||'').trim()).length;
  buildEmailIndex();     // adresses regroupees par client, avant le profil
  if(typeof RECO!=='undefined')RECO=null;
  if(typeof CLASSEMENT!=='undefined')CLASSEMENT=null;
  NOMS_CACHE=null;   // index de recommandation et classement : reconstruits a la demande
  PROFIL=profilBase();   // recalcule le profil a chaque changement de base
}

/* Index des adresses par client. L'export porte l'e-mail sur chaque ligne de facture,
   donc la meme adresse revient des dizaines de fois : on la remonte une bonne fois au client.
   Cle = numero client quand il existe (le libelle, lui, peut etre renomme dans le logiciel). */
let EMAILS={},TELS={},COUV={joignables:0,total:0,mail:0,tel:0};
/* LA seule definition de l'identite d'un client. Aucun ecran ne la recalcule a la main :
   avant le 04/09/2026, seize expressions la recopiaient, dont DEUX a l'envers (le nom avant le
   numero), a trois lignes d'ecart l'une de l'autre. Ca produisait deja des ecarts entre ecrans ;
   depuis que les fiches de suivi sont rangees sur le serveur sous cette cle, ca produirait des
   fiches orphelines qu'aucun ecran ne retrouverait.

   Le NUMERO passe avant le nom, et c'est tout l'enjeu : un vigneron qui corrige une orthographe
   dans Vitisoft ne doit pas perdre ses notes. Ted confirme que la colonne est toujours remplie.
   Le repli sur le nom reste quand meme, parce que rabattre tous les clients sans numero sur une
   seule cle les fusionnerait en un client unique, bien pire qu'une fiche perdue. SANS_NUM compte
   les lignes qui prennent ce repli, plutot que de laisser la chose invisible.

   PIEGE : cette ligne contient le motif que seize autres endroits utilisaient. Toute reecriture
   automatique doit la mettre de cote d'abord, sous peine de la rendre recursive. */
function clientKey(r){return r.numClient||r.client||'(inconnu)';}
function buildEmailIndex(){
  const m={},t={};
  ROWS.forEach(r=>{
    const id=clientKey(r);
    if(r._emails&&r._emails.length){const s=m[id]||(m[id]=new Set());r._emails.forEach(e=>s.add(e));}
    if(r._tels&&r._tels.length){const s=t[id]||(t[id]=new Map());r._tels.forEach(x=>s.set(x.appel,x));}
  });
  EMAILS={};for(const id in m)EMAILS[id]=[...m[id]];
  TELS={};for(const id in t)TELS[id]=[...t[id].values()];
  const tous=new Set();ROWS.forEach(r=>{if(r._vin)tous.add(clientKey(r));});
  let j=0,jm=0,jt=0;
  tous.forEach(id=>{const e=!!EMAILS[id],p=!!TELS[id];if(e||p)j++;if(e)jm++;if(p)jt++;});
  COUV={joignables:j,total:tous.size,mail:jm,tel:jt};
}
// Adresses connues d'un client (tableau, eventuellement vide).
function emailsOf(id){return EMAILS[id]||[];}
// Adresse principale d'un client, chaine vide si aucune.
function emailOf(id){const e=EMAILS[id];return e&&e.length?e[0]:'';}
// Numeros connus d'un client : [{appel, affiche}].
function telsOf(id){return TELS[id]||[];}
function telOf(id){const t=TELS[id];return t&&t.length?t[0].affiche:'';}
// Ce par quoi on peut joindre ce client, en texte, pour la recherche et le filtre.
function contactTexte(id){
  const p=[].concat(emailsOf(id));
  telsOf(id).forEach(t=>{p.push(t.appel,t.affiche.replace(/\s/g,''));});
  return p.join(' ').trim();   // chaine VIDE si aucun contact : le filtre « joignables » en depend
}
// Cellule contact d'un tableau : l'adresse et le numero, chacun cliquable.
function contactCell(id){
  const e=emailsOf(id), t=telsOf(id), l=[];
  if(e.length){
    const plus=e.length>1?` <span class="muted-cell">+${e.length-1}</span>`:'';
    l.push(`<a href="mailto:${esc(e[0])}">${esc(e[0])}</a>${plus}`);
  }
  if(t.length){
    const plus=t.length>1?` <span class="muted-cell">+${t.length-1}</span>`:'';
    l.push(`<a href="tel:${esc(t[0].appel)}" class="tel">${esc(t[0].affiche)}</a>${plus}`);
  }
  if(!l.length)return `<span class="muted-cell">non renseigné</span>`;
  return l.join('<br>');
}
// Tous les contacts secondaires d'un client, pour la derniere colonne des exports.
function autresContacts(id){
  return emailsOf(id).slice(1).concat(telsOf(id).slice(1).map(t=>t.affiche)).join(' | ');
}
// emailCell() a disparu le 19/09/2026. Son commentaire disait « l'ancien nom reste
// utilise ailleurs dans le fichier » : c'etait faux, aucun appelant nulle part. Le nom
// vivant est contactCell().
function median(arr){if(!arr.length)return 0;const a=[...arr].sort((x,y)=>x-y),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function stdev(arr){if(arr.length<2)return 0;const m=arr.reduce((s,v)=>s+v,0)/arr.length;return Math.sqrt(arr.reduce((s,v)=>s+(v-m)*(v-m),0)/arr.length);}
// Regroupe les dates de facture distinctes (jours absolus) par client, sur les lignes de vente.
function clientPurchaseDays(){
  const m={};
  ROWS.forEach(r=>{if(!r._vin||r._dayNum==null)return;const id=clientKey(r);(m[id]||(m[id]=new Set())).add(r._dayNum);});
  const out={};for(const id in m)out[id]=[...m[id]].sort((a,b)=>a-b);
  return out;
}
// PROFIL DE BASE : lit la forme de la base une fois, pour calibrer les agents (aucune constante gravee).
function profilBase(){
  const vente=ROWS.filter(r=>r._vin);
  if(!vente.length)return {nClients:0,nFactures:0,nLignes:0,moisCouverts:0,anneesCompletes:0,caTotal:0,panierMoyen:0,dims:{},intervalleMedianBase:0,saisonnalite:1,refDay:null};
  const clients=new Set(),factures=new Set(),moisSet=new Set(),parAn={};
  let ca=0,refDay=null;
  const caMois=new Array(13).fill(0);
  vente.forEach(r=>{
    clients.add(clientKey(r));factures.add(r.numFacture);ca+=r._total;
    if(r._date){moisSet.add(r._date.y*100+r._date.m);(parAn[r._exY]||(parAn[r._exY]=new Set())).add(r._date.m);caMois[r._date.m]+=r._total;}
    if(r._dayNum!=null&&(refDay==null||r._dayNum>refDay))refDay=r._dayNum;
  });
  // Exercices complets : douze mois distincts dans le MEME exercice, pas dans la meme annee civile.
  const anneesCompletes=Object.values(parAn).filter(s=>s.size>=12).length;
  // Dimensions : distinctes + taux de remplissage (sur les lignes de vente).
  const AX={famille:r=>r.famille,couleur:r=>r.couleur,canal:r=>r._canal,codeTarif:r=>r.codeTarif,appellation:r=>r.appellation,millesime:r=>r.millesime,conditionnement:r=>r.conditionnement,origine:r=>r.origine,pays:r=>r.pays,commercial:r=>r.commercial,vendeur:r=>r.vendeur};
  const dims={};
  for(const k in AX){const s=new Set();let fill=0;vente.forEach(r=>{const v=AX[k](r);if(v!==''&&v!=null){s.add(String(v));fill++;}});dims[k]={distinct:s.size,fill:vente.length?fill/vente.length:0};}
  // Intervalle median de la base : toutes les cadences consecutives des clients a >= 2 achats.
  const days=clientPurchaseDays();const gaps=[];
  for(const id in days){const d=days[id];for(let i=1;i<d.length;i++)gaps.push(d[i]-d[i-1]);}
  const intervalleMedianBase=median(gaps);
  // Saisonnalite : mois le plus fort / moyenne mensuelle (sur les mois ayant du CA).
  const moisAvecCA=caMois.slice(1).filter(v=>v>0);
  const moyMois=moisAvecCA.length?moisAvecCA.reduce((s,v)=>s+v,0)/moisAvecCA.length:0;
  const saisonnalite=moyMois>0?Math.max(...caMois.slice(1))/moyMois:1;
  return {nClients:clients.size,nFactures:factures.size,nLignes:vente.length,
    moisCouverts:moisSet.size,anneesCompletes,caTotal:ca,panierMoyen:factures.size?ca/factures.size:0,
    dims,intervalleMedianBase,saisonnalite,refDay};
}


/* ======================= MA BASE (etat de la base, hors-vin, offerts) ======================= */
// Prix de vente moyen REEL, par produit et par famille, sur les ventes payantes uniquement.
// Sert a valoriser les offerts / echantillons / casse (qui ont un PU de 0).
function prixVenteMoyen(){
  const prod={},fam={};
  ROWS.forEach(r=>{
    if(!r._vin || r._total<=0 || r._qte<=0)return;
    const p=prod[r.numProduit]||(prod[r.numProduit]={ca:0,q:0});p.ca+=r._total;p.q+=r._qte;
    const fk=norm(r.famille);const g=fam[fk]||(fam[fk]={ca:0,q:0});g.ca+=r._total;g.q+=r._qte;
  });
  const parProduit={},parFamille={};
  for(const k in prod)parProduit[k]=prod[k].q?prod[k].ca/prod[k].q:0;
  for(const k in fam)parFamille[k]=fam[k].q?fam[k].ca/fam[k].q:0;
  return {parProduit,parFamille};
}
/* LE PRIX MOYEN DE LA BOUTEILLE SUR TOUT LE DOMAINE, un NOMBRE, 11/09/2026.

   Ecrite parce que la fiche client passait `prixVenteMoyen()` a `fmtNum()`. Cette
   fonction-la rend un OBJET de deux tables de prix, et `fmtNum({...})` vaut NaN :
   toutes les fiches clients affichaient « 9,62 € en moyenne, domaine NaN € ».
   Le test `prixBase ?` ne rattrapait rien, un objet etant toujours vrai.

   DEUX NOMS QUI DISENT LA MEME CHOSE POUR DEUX FORMES DIFFERENTES, c'est la cause,
   pas le symptome : « prix de vente moyen » designait une carte de prix par produit
   et par famille, et l'appelant a lu le nom, pas la valeur. Celle-ci dit
   BOUTEILLE et DOMAINE dans son nom, et rend un scalaire. Ne pas les re-fusionner.

   LA BASE DE CALCUL EST CELLE DU CLIENT, et c'est ce qui rend la comparaison juste :
   `ficheClient()` fait `ca/btl` sur ses lignes `_vin`, sans autre filtre. On fait
   pareil sur toutes les lignes. Reprendre le filtre plus severe de `prixVenteMoyen`
   (total et quantite strictement positifs) donnerait deux chiffres qui ne se
   comparent pas, cote a cote, dans la meme phrase. */
function prixMoyenBouteilleDomaine(){
  let ca=0,q=0;
  ROWS.forEach(r=>{ if(!r._vin)return; ca+=r._total; q+=r._qte; });
  return q>0?ca/q:0;
}
// Cout estime d'une ligne offerte : prix produit, sinon prix famille, sinon 0 (jamais planter).
function coutOffertLigne(r,prix){
  const pu = prix.parProduit[r.numProduit] || prix.parFamille[norm(r.famille)] || 0;
  return pu * r._qte;
}
/* ======================= SUR LES `data-libelle` DES TABLEAUX DU PANNEAU =======================
   Poses le 19/09/2026 sur les cinq tableaux que ce fichier dessine dans le panneau. Sous
   700 px la feuille passe chaque ligne en une colonne, ce qui cache forcement le `<thead>` :
   on lisait cinq valeurs empilees sans savoir ce que chacune dit. Chaque `<td>` porte donc
   le texte du `<th>` de sa colonne, et `td::before{content:attr(data-libelle)}` le rend
   visible (regle a poser dans bdv-panneau.css). Un tableau ajoute ici sans ses libelles
   redevient illisible sur telephone, et rien ne le signale a l'ecran large. */

/* ======================= ECRAN REGLAGES =======================
   Quatre questions, dans l'ordre de leur impact sur les chiffres affiches.
   L'ecran travaille sur une copie de travail (BROUILLON) : rien n'est applique
   tant que le vigneron n'a pas cliqué sur le bouton d'enregistrement. */
let BROUILLON=null;
function renderReglages(){
  if(!ROWS.length){el('p-reglages').innerHTML='<p class="mini-line">Le classement se règle sur tes lignes de vente. Dépose un export, il apparaîtra ici.</p>';return;}
  if(!BROUILLON)BROUILLON=REG&&REG.valide?JSON.parse(JSON.stringify(REG)):(PROPOSE||reglagesProposes());
  if(!BROUILLON._profils)BROUILLON._profils=reglagesProposes()._profils;
  const B=BROUILLON, P=B._profils;
  const regle=!!(REG&&REG.valide);

  let html=`<div class="panel__sub">Dans ton logiciel, tu remplis Origine, Lieu de vente et les champs Perso comme tu veux. L'outil ne peut donc pas deviner ce que veulent dire tes valeurs. Il te propose une lecture, tu la corriges une fois, il s'en souvient.</div>`;

  /* TROIS PHRASES ET PAS DEUX, 19/09/2026. « Au juge » dit que le vigneron n'a pas encore
     regle ; il ne dit pas que son reglage existe et qu'on n'a pas pu le lire. Les chiffres
     sont faux dans les deux cas, mais le geste a faire n'est pas le meme : dans un cas on
     regle, dans l'autre on recharge. Meme forme que « Decomposition indisponible » dans
     bdv-ecrans.js : on NOMME ce qui manque, on ne compte pas. */
  html+=regle
    ? signal('ok','✔','Tes réglages sont enregistrés.','Les chiffres de tous les écrans les utilisent. Tu peux les modifier ici à tout moment.')
    : classementIncertain()
    ? signal('danger','⚠','Ton classement n\'a pas pu être lu.',
        'Ton compte n\'a pas répondu : l\'outil ne sait pas si tu as déjà rangé tes canaux et tes types de clients. En attendant il <b>devine</b>, et l\'exercice comptable est retombé sur l\'année civile. <b>Les chiffres de canaux, de typologie et de comparaison d\'exercice sont à prendre pour faux tant que cette phrase est là.</b> Recharge la page quand ta connexion sera revenue, plutôt que de tout re-régler ici : ce que tu enregistrerais maintenant écraserait ce qui est sur ton compte.')
    : signal('info','ℹ','L\'outil fonctionne actuellement au jugé.',
        'Les regroupements ci-dessous sont des <b>propositions</b> déduites de ton fichier, pas des certitudes. Tant que tu ne les as pas validés, prends les chiffres de canaux et de typologie avec prudence. '
        /* CE QU'ON Y GAGNE, AJOUTE LE 23/09/2026. La phrase disait ce qu'on perd et jamais
           ce qu'on gagne, donc valider ressemblait a une corvee sans contrepartie. Ce n'est
           pas un argument de vente : c'est mesure. Tant que le classement n'est pas valide,
           `v_ventes.est_vente` vaut null, les trois fonctions de resume ne calculent rien,
           et chaque ouverture d'ecran refait le travail sur l'appareil. */
        + '<b>Et ton compte ne peut rien calculer tant qu\'ils ne sont pas validés</b> : tous tes chiffres se refont sur cet appareil à chaque ouverture, au lieu d\'arriver déjà prêts.');

  /* 0. L'exercice comptable. Range avant les quatre sections de classification parce que
     ce n'est pas une question de contenu de champ mais de decoupage du temps : il commande
     les comparatifs de tous les ecrans, alors que les sections suivantes ne touchent qu'au
     classement des lignes. Enregistre a la volee, hors BROUILLON : ce reglage ne fait pas
     partie des reglages du domaine et ne doit pas partir avec eux. */
  const dernEx=META.exercices.length?META.exercices[META.exercices.length-1]:null;
  const bornes=dernEx!=null?exBornes(dernEx):null;
  html+=`<div class="section-label">Ton exercice comptable</div>
  <div class="card">
    <p class="mini-line">Si ta société ne clôture pas au 31 décembre, dis-le ici. Tous les écrans comparent alors des exercices entre eux et non des années civiles : « où en es-tu », l'atterrissage, le décrochage client et le mix canal se recalent sur ce découpage.</p>
    <div class="expl-ctrls"><div class="field"><label for="exMoisDebut">Premier mois de l'exercice</label>
      <select class="search" id="exMoisDebut" onchange="exAppliquer(this.value)">${MOIS_PLEIN.map((m,i)=>`<option value="${i+1}"${EX_START===i+1?' selected':''}>${m}</option>`).join('')}</select>
    </div></div>
    <p class="mini-line">${EX_START===1
      ?`Exercice calé sur l'année civile, du 1<sup>er</sup> janvier au 31 décembre. C'est le réglage par défaut.`
      :`Exercice du 1<sup>er</sup> ${MOIS_PLEIN[EX_START-1]} au dernier jour de ${MOIS_PLEIN[(EX_START+10)%12]}.${bornes?` Le dernier exercice de ta base est ${exLabel(dernEx)}, du ${fmtDate(dayToDate(bornes.debut))} au ${fmtDate(dayToDate(bornes.fin))}.`:''}`}</p>
    <p class="note">Ce réglage ne touche ni tes lignes ni les empreintes de déduplication : il ne change que la façon de découper le temps. Le changer recalcule immédiatement, sans réimport, et il survit à « Revenir au classement automatique ».</p>
  </div>`;

  /* 1. Ce qui compte dans le chiffre d'affaires */
  const fams=Object.keys(B.horsCA).sort((a,b)=>caFamille(b)-caFamille(a));
  html+=`<div class="section-label">1. Ce qui compte dans ton chiffre d'affaires</div>
  <div class="card"><p class="mini-line">Décoche une famille pour la sortir du CA (frais de port, remises, avoirs, articles publicitaires). Les montants ci-dessous sont ceux de ta base.</p>
  <div class="tablewrap"><table class="data"><thead><tr><th>Famille de produit</th><th class="num">Lignes</th><th class="num">Montant HT</th><th>Compte dans le CA</th></tr></thead><tbody>
  ${fams.map(f=>{const s=statFamille(f);
    return `<tr><td data-libelle="Famille de produit">${esc(f)}</td><td class="num" data-libelle="Lignes">${fmtNum(s.n)}</td><td class="num" data-libelle="Montant HT">${fmtMoney(s.ca)}</td>
      <td data-libelle="Compte dans le CA"><label class="chk"><input type="checkbox" ${B.horsCA[f]?'':'checked'} onchange="BROUILLON.horsCA[${JSON.stringify(f).replace(/"/g,'&quot;')}]=!this.checked;majImpact()"> oui</label></td></tr>`;}).join('')}
  </tbody></table></div></div>`;

  /* 2. Les sorties gratuites */
  const tos=Object.keys(B.gratuit);
  if(tos.length){
    html+=`<div class="section-label">2. Les sorties gratuites</div>
    <div class="card"><p class="mini-line">Ces valeurs viennent de ta colonne « Type Offert ». Coche celles qui sont réellement des sorties sans recette : elles ne compteront jamais dans le CA.</p>
    <div class="tablewrap"><table class="data"><thead><tr><th>Valeur</th><th class="num">Lignes</th><th>Sortie gratuite ou perte</th></tr></thead><tbody>
    ${tos.map(t=>{const n=ROWS.filter(r=>String(r.typeOffert||'').trim()===t).length;
      return `<tr><td data-libelle="Valeur">${esc(t)}</td><td class="num" data-libelle="Lignes">${fmtNum(n)}</td>
        <td data-libelle="Sortie gratuite ou perte"><label class="chk"><input type="checkbox" ${B.gratuit[t]?'checked':''} onchange="BROUILLON.gratuit[${JSON.stringify(t).replace(/"/g,'&quot;')}]=this.checked;majImpact()"> oui</label></td></tr>`;}).join('')}
    </tbody></table></div></div>`;
  }

  /* 3. Où est l'information de canal */
  html+=`<div class="section-label">3. Où mets-tu le canal de vente ?</div>
  <div class="card">
    <p class="mini-line">Choisis la colonne dans laquelle tu notes l'endroit ou la manière dont la vente s'est faite. Le taux de remplissage est calculé sur ta base.</p>
    ${selectChamp('champCanal',B.champCanal,P)}
    ${tableRegroupement('canaux',B.champCanal,P,B)}
  </div>`;

  /* 4. Typologie client */
  html+=`<div class="section-label">4. Comment distingues-tu tes types de clients ?</div>
  <div class="card">
    <p class="mini-line">Particuliers, cavistes, restaurants, export. Le code tarif est souvent la colonne la plus fiable, parce qu'elle vient du paramétrage et non de la saisie.</p>
    ${selectChamp('champType',B.champType,P)}
    ${tableRegroupement('types',B.champType,P,B)}
  </div>`;

  /* Impact et validation */
  html+=`<div class="section-label">Impact de tes choix</div>
  <div class="card"><div id="impactReg">${impactHtml()}</div>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1rem">
      <button class="btn btn--primary" onclick="appliquerReglages(BROUILLON)">Enregistrer et recalculer</button>
      ${regle?'<button class="btn btn--ghost" onclick="oublierReglages()">Revenir au classement automatique</button>':''}
      <button class="btn btn--ghost" onclick="BROUILLON=null;renderReglages()">Annuler mes modifications</button>
    </div>
    <p class="mini-line">Tes réglages et tes lignes de vente sont enregistrés sur ton compte, hébergé en Europe. Tu les retrouves depuis n'importe quel appareil.</p>
  </div>`;
  el('p-reglages').innerHTML=html;
}
function statFamille(f){const l=ROWS.filter(r=>String(r.famille||'').trim()===f);return{n:l.length,ca:sum(l,r=>r._total)};}
function caFamille(f){return statFamille(f).ca;}
// Selecteur de colonne source, annote du taux de remplissage et du nombre de valeurs.
function selectChamp(cle,valeur,P){
  const opts=CHAMPS_CANDIDATS.map(c=>{
    const p=P[c.k]||{taux:0,distinct:0};
    if(!p.distinct)return '';
    return `<option value="${c.k}" ${c.k===valeur?'selected':''}>${c.l} — rempli à ${Math.round(p.taux*100)} %, ${plur(p.distinct,'valeur')}</option>`;
  }).join('');
  /* PAS DE `style=` ICI, 19/09/2026. Un style en ligne bat toute feuille, y compris la
     requete de media : ce `min-width:340px` debordait l'ecran d'un telephone de 390 px et
     obligeait bdv-panneau.css a un `!important` pour le rattraper. `.search` porte deja sa
     largeur, et la feuille la ramene a 0 sous 700 px. */
  /* L'ETIQUETTE VOYAGE AVEC LE CHAMP, 19/09/2026. Ce menu est rendu deux fois, dans
     deux cellules de tableau, sans <label>, sans id et sans aria-label : au lecteur
     d'ecran il ne disait rien du tout. Il n'y a pas de place pour une etiquette
     visible dans une cellule, donc c'est aria-label qui la porte. */
  return `<select class="search" aria-label="Colonne de ton fichier pour ${esc(cle)}" onchange="changerChamp('${cle}',this.value)">${opts}</select>`;
}
function changerChamp(cle,val){
  BROUILLON[cle]=val;
  const P=BROUILLON._profils, cible=cle==='champCanal'?'canaux':'types';
  BROUILLON[cible]={};
  (P[val]?P[val].liste:[]).forEach(e=>{BROUILLON[cible][e.v]=cible==='canaux'?proposerCanal(e.v,e):proposerType(e.v);});
  renderReglages();
}
// Table de regroupement : une ligne par valeur presente, avec sa forme et son libelle modifiable.
function tableRegroupement(cible,champ,P,B){
  const p=P[champ];
  if(!p||!p.liste.length)return `<p class="note">Cette colonne est vide dans ta base, rien à regrouper.</p>`;
  const MAX=40, liste=p.liste.slice(0,MAX), reste=p.liste.length-liste.length;
  const libelles=[...new Set(Object.values(B[cible]))].sort();
  const dl=`<datalist id="dl-${cible}">${libelles.map(l=>`<option value="${esc(l)}">`).join('')}</datalist>`;
  return dl+`<div class="tablewrap" style="margin-top:.8rem"><table class="data"><thead><tr>
    <th>Valeur dans ton fichier</th><th class="num">Lignes</th><th class="num">Clients</th><th>Forme</th><th>Tu l'appelles</th></tr></thead><tbody>
    ${liste.map(e=>`<tr><td data-libelle="Valeur dans ton fichier">${esc(e.v)}</td><td class="num" data-libelle="Lignes">${fmtNum(e.n)}</td><td class="num" data-libelle="Clients">${fmtNum(e.clients.size)}</td>
      <td data-libelle="Forme"><span class="muted-cell">${formeValeur(e)}</span></td>
      <td data-libelle="Tu l'appelles"><input class="search" aria-label="Le nom que tu donnes a ${esc(e.v)}" list="dl-${cible}" value="${esc(B[cible][e.v]||'')}"
        onchange="BROUILLON.${cible}[${JSON.stringify(e.v).replace(/"/g,'&quot;')}]=this.value.trim();majImpact()"></td></tr>`).join('')}
    </tbody></table></div>
    ${reste>0?`<p class="note">${plur(reste,'valeur','plus rare')}${reste>1?' ne sont pas affichées, elles seront rangées':' n\'est pas affichée, elle sera rangée'} dans « Autre / non renseigné ».</p>`:''}
    <p class="note">La colonne « Forme » est lue sur les dates : une valeur présente un seul jour se comporte comme un événement, une valeur présente toute l'année comme un point de vente permanent. C'est une indication, pas une conclusion : l'outil ne sait pas ce que tes mots veulent dire.</p>`;
}
// Simulation en direct : ce que les choix courants changeraient, sans rien enregistrer.
function impactHtml(){
  const B=BROUILLON;if(!B)return '';
  let ca=0,hors=0,gratuit=0;
  const canaux=new Set(),types=new Set();
  ROWS.forEach(r=>{
    const fam=String(r.famille||'').trim(), to=String(r.typeOffert||'').trim();
    const hc=!!B.horsCA[fam], of=to?!!B.gratuit[to]:false;
    if(hc)hors+=r._total; else if(of)gratuit+=r._total; else ca+=r._total;
    canaux.add(B.canaux[String(r[B.champCanal]||'').trim()]||'Autre / non renseigné');
    types.add(B.types[String(r[B.champType]||'').trim()]||'Non typé');
  });
  const sansCanal=ROWS.filter(r=>!B.canaux[String(r[B.champCanal]||'').trim()]).length;
  const sansType=ROWS.filter(r=>!B.types[String(r[B.champType]||'').trim()]).length;
  const pc=n=>ROWS.length?Math.round(n/ROWS.length*100):0;
  return `<div class="kpi-grid">
    ${kpiCard('CA avec ces réglages',fmtMoney(ca),'hors frais et sorties gratuites',true)}
    ${kpiCard('Sorti du CA',fmtMoney(hors),'frais, remises, avoirs')}
    ${kpiCard('Sorties gratuites',fmtMoney(gratuit),'offerts, casse, dégustation')}
    ${kpiCard('Canaux distincts',fmtNum(canaux.size),`${pc(sansCanal)} % des lignes sans canal`)}
    ${kpiCard('Types de clients',fmtNum(types.size),`${pc(sansType)} % des lignes non typées`)}
  </div>`;
}
function majImpact(){const z=el('impactReg');if(z)z.innerHTML=impactHtml();}

// Vrai seulement si le vigneron a repondu « non » a la question Vitisoft de l'inscription.
// Un refus qui ne propose rien est un refus rate : le bloc l'oriente au lieu de le planter.
let PAS_VITISOFT=false;
/* Le drapeau se pose ET SE RETIRE, depuis le 08/09/2026. Il ne montait qu'a `true` : Ted a
   decoche Vitisoft pour voir ce que ca changeait, l'a recoche, et « Ma base » a continue de
   lui annoncer « cet outil ne lira pas tes fichiers » au-dessus de sa zone de depot jusqu'au
   rechargement de la page.

   Meme forme que adopterObjectif et adopterExercice : le panneau de reglages a la reponse
   (il vient de l'ecrire en base), le moteur l'adopte sans rien renvoyer. Le garde sur
   `p-base` n'est pas une precaution de style : renderBase() ecrit dans ce div sans le
   chercher, et il n'existe pas sur une page qui n'a pas la coque des ecrans de vente. */
function adopterVitisoft(reponse){
  const sans=(reponse==='non');
  if(sans===PAS_VITISOFT)return;
  PAS_VITISOFT=sans;
  if(el('p-base'))renderBase();
}
/* majCompteurServeur() a vecu une demi-journee, le 07/09/2026. Il comparait les lignes de
   cet appareil a celles du compte, et il a servi : c'est ce qui manquait le matin meme,
   quand la base est restee a 500 lignes sur 4942 sans qu'aucun ecran ne puisse le dire.
   Il est mort le soir avec la fusion des reglages : le panneau partage affiche le meme
   ecart, au-dessus de ce bloc, et le bureau en profite aussi. Un seul compteur, corrige une
   seule fois. Voir peindreBase() dans bdv-reglages.js. */
function renderBase(){
  const vin=ROWS.filter(r=>r._vin);
  const horsVin=ROWS.filter(r=>r._horsVin && !r._offert);
  const offerts=ROWS.filter(r=>r._offert);
  const caVin=sum(vin,r=>r._total);
  const caHorsVin=sum(horsVin,r=>r._total);
  const prix=prixVenteMoyen();
  const coutOffert=sum(offerts,r=>coutOffertLigne(r,prix));

  // Plus de <h2> ici : le panneau porte deja la legende « Ma base » au-dessus de ce bloc,
  // et deux titres identiques a la suite se lisent comme un bug d'affichage.
  let html=`<div class="panel__sub">Ton export, l'état de ta base, et de quoi tout effacer. La sélection de période ne s'applique pas ici.</div>`;

  /* « Ma base » est le premier onglet du panneau, donc le premier endroit ou quelqu'un
     regarde. Si le classement n'a pas pu etre lu, il le lit ici avant les chiffres, et
     pas seulement dans l'onglet du classement ou il n'ira peut-etre jamais. 19/09/2026. */
  if(classementIncertain()){
    html+=signal('danger','⚠','Tes réglages n\'ont pas pu être lus.',
      'Ton compte n\'a pas répondu au démarrage. Les canaux de vente et les types de clients sont <b>devinés</b>, et l\'exercice comptable est retombé sur l\'année civile : les chiffres de tous les écrans sont plausibles et faux. Recharge la page quand ta connexion sera revenue.');
  }

  if(PAS_VITISOFT){
    html+=`<div class="pas-viti">
      <p class="pas-viti__titre">Cet outil ne lira pas tes fichiers.</p>
      <p>Tu as indiqué ne pas utiliser Vitisoft. Le tableau de bord est construit sur son format d'export et refusera tout autre fichier. Ce n'est pas une porte fermée : le reste du Bureau est ouvert, et gratuit.</p>
      <p class="pas-viti__liens"><a href="/outils/echeances/">Le calendrier réglementaire</a> · <a href="/mon-bureau/">Mon bureau</a> · <a href="/articles/">Les articles</a></p>
    </div>`;
  }

  if(!ROWS.length){
    html+=`<div class="card"><div class="card__title"><span>Ta base est vide</span></div>
      <p class="mini-line">Dépose ton export Vitisoft ci-dessous. Chaque nouvel export s'ajoute au précédent, les doublons sont ignorés, et rien ne t'oblige à tout importer d'un coup.</p></div>`;
  }

  // ZONE A : etat de la base (compteurs alignes, memes dimensions).
  const yearpills=META.exercices.length?`<div class="yearpills">${META.exercices.map(y=>`<span class="yearpill">${esc(exLabelCourt(y))}</span>`).join('')}</div>`:'n/d';
  const période=META.min?fmtDate(META.min)+' au '+fmtDate(META.max):'n/d';
  html+=`<div class="section-label">État de la base</div>
  <div class="kpi-grid kpi-grid--base">
    ${kpiCard('Lignes en base',fmtNum(ROWS.length),'toutes lignes cumulées',true)}
    ${kpiCard('Période couverte',période,'du premier au dernier export')}
    ${kpiCard(EX_START===1?'Années présentes':'Exercices présents',yearpills,plur(META.exercices.length,exMot()))}
    ${kpiCard('CA HT',fmtMoney(caVin),plur(vin.length,'ligne')+' de vente')}
    ${kpiCard('Hors-vente',fmtMoney(caHorsVin),'transport, pub, remises, divers')}
    ${kpiCard('Offerts / pertes',fmtMoney(coutOffert),plur(offerts.length,'ligne')+', prix de vente moyen')}
  </div>`;
  if(SANS_NUM){
    html+=`<p class="note">${plur(SANS_NUM,'ligne')} sans numéro client. Elles sont suivies sous le nom du client, ce qui fonctionne, mais leur fiche de suivi se perdra si l'orthographe du nom change dans Vitisoft.</p>`;
  }
  // Plus de compteur d'ecart ici : depuis la fusion du 07/09/2026, le panneau l'affiche
  // lui-meme juste au-dessus de ce bloc (peindreBase() dans bdv-reglages.js), et il est
  // partage avec le bureau. Deux compteurs disant la meme chose a dix lignes d'ecart, c'est
  // un de trop a tenir a jour.

  // ZONE B : details.
  html+=`<div class="section-label">Détails</div>`;
  const parType={};
  offerts.forEach(r=>{const t=String(r.typeOffert||'Autre').trim();const c=parType[t]||(parType[t]={n:0,cout:0});c.n++;c.cout+=coutOffertLigne(r,prix);});
  const typesRows=Object.entries(parType).sort((a,b)=>b[1].cout-a[1].cout);
  if(typesRows.length){
    html+=`<div class="card"><div class="card__title"><span>Bouteilles offertes, échantillons et casse</span></div>
      <table class="data"><thead><tr><th>Type</th><th class="num">Lignes</th><th class="num">Coût estimé (prix de vente moyen)</th></tr></thead><tbody>
      ${typesRows.map(([t,c])=>`<tr><td data-libelle="Type">${esc(t)}</td><td class="num" data-libelle="Lignes">${fmtNum(c.n)}</td><td class="num" data-libelle="Coût estimé">${fmtMoney(c.cout)}</td></tr>`).join('')}
      </tbody></table><p class="note">Ces sorties ne comptent jamais dans le CA. Estimation du manque à gagner, valorisée au prix de vente moyen réel de chaque produit.</p></div>`;
  }
  // Hors-vente par famille.
  const parFamHV={};
  horsVin.forEach(r=>{const f=(r.famille||'(non renseigné)').trim();const c=parFamHV[f]||(parFamHV[f]={n:0,ca:0});c.n++;c.ca+=r._total;});
  const hvRows=Object.entries(parFamHV).sort((a,b)=>Math.abs(b[1].ca)-Math.abs(a[1].ca));
  if(hvRows.length){
    html+=`<div class="card"><div class="card__title"><span>Hors-vente par famille</span></div>
      <table class="data"><thead><tr><th>Famille</th><th class="num">Lignes</th><th class="num">Montant HT</th></tr></thead><tbody>
      ${hvRows.map(([f,c])=>`<tr><td data-libelle="Famille">${esc(f)}</td><td class="num" data-libelle="Lignes">${fmtNum(c.n)}</td><td class="num" data-libelle="Montant HT">${fmtMoney(c.ca)}</td></tr>`).join('')}
      </tbody></table><p class="note">Frais et lignes hors CA, isolées pour ne pas fausser le chiffre d'affaires.</p></div>`;
  }

  // ZONE C : gestion (deux actions sobres cote a cote).
  html+=`<div class="section-label">Gestion</div>
  <div class="grid-2">
    <div class="card"><div class="card__title"><span>Ajouter un export</span></div>
      <div class="dropzone dropzone--compact" id="dropzoneReg">
        <div class="dz-icon">&#9095;</div><h3>Dépose ton export ici</h3>
        <p>Export Vitisoft (.csv) · ou clique pour choisir</p>
        <input type="file" id="fileInputReg" accept=".csv" multiple style="display:none">
      </div>
      <p class="mini-line">Chaque nouvel export s'ajoute, les doublons sont ignorés automatiquement. Réservé aux utilisateurs de Vitisoft.</p>
    </div>
    <div class="card"><div class="card__title"><span>Vider la base</span></div>
      <!-- LE BOUTON RELIT LE DRAPEAU, 23/09/2026. Ce rendu tourne a chaque renderAll(), donc
           aussi pendant le vidage : sans cette lecture, le bouton se reactiverait tout seul au
           milieu d'un await. Le drapeau est la verite, ce disabled n'est que l'affordance. -->
      <button class="btn btn--danger" onclick="viderBase()"${VIDAGE_EN_COURS?' disabled':''}>Vider la base</button>
      <p class="mini-line">Efface toutes les lignes cumulées, sur cet appareil comme sur ton compte. Action définitive.</p>
    </div>
  </div>`;

  el('p-base').innerHTML=html;
  // Le panneau vient d'etre reconstruit, la zone de depot qu'il contient est neuve.
  bindZoneDepot('dropzoneReg','fileInputReg');
  // Pas d'appel au compteur d'ecart ici, volontairement : renderBase() tourne a chaque
  // renderAll(), donc a chaque changement de periode. Le panneau compte quand il S'OUVRE,
  // seul moment ou quelqu'un le regarde, cf. ouvrir() dans bdv-reglages.js.
}
/* ============ LE VIDAGE SE VOIT, ET IL NE S'ARRETE QUE SUR UNE PREUVE, 23/09/2026 ============
   Ted, capture a l'appui : « il faut forcement que l'interface montre une animation tant que
   ca travaille et que ca vide toute la base, meme dans les reglages et tout. Il devra y avoir
   une verification pour que l'animation s'arrete. »

   CE QUI SE PASSAIT AVANT. Entre la confirmation et le message final il y avait l'appel
   serveur (1,4 s mesure sur 171 569 lignes, plus le reseau), le vidage d'IndexedDB, puis une
   repeinture complete du bureau et du panneau. Rien a l'ecran pendant tout ce temps. Le bouton
   restait cliquable, et la ZONE DE DEPOT D'EXPORT de la carte d'a cote aussi : deposer un
   export pendant que le DELETE serveur tourne, c'est l'incident du 18/09/2026 refait par la
   porte d'a cote.

   LE VOILE REUTILISE LES CLASSES DE `bdv-amorce.js`, ET CE N'EST PAS DE LA PARESSE. Ce dessin
   existe, il est scope, mesure dans les deux themes, et chacun de ses etats se dit par un
   GLYPHE et par un mot cache en plus de sa couleur. Ecrire un deuxieme voile aurait ajoute une
   valeur a trois echelles fermees de `npm run charte --bureau` (les tailles, les filets, les
   couches) et une paire de contraste de plus a mesurer, pour redire moins bien ce que celui-ci
   sait deja dire. Les deux voiles ne peuvent pas etre a l'ecran en meme temps : l'amorcage se
   ferme avant que le bureau soit utilisable, le vidage demande un panneau ouvert.

   TROIS ETATS ET PAS DEUX, POUR LA VERIFICATION. Zero arrete l'animation en succes, un reste
   l'arrete en ECHEC NOMME, et un « je ne sais pas » l'arrete en « non verifie ». Confondre le
   troisieme avec le premier rejouerait exactement le defaut du 18/09/2026, ou un silence
   passait pour un succes. C'est la meme regle en trois etats que le garde d'ouverture, dix
   lignes plus bas.
   ============================================================================================ */
/* `var` ET PAS `let`, ET C'EST MESURE. `renderBase()` lit ce drapeau, et il est ecrit
   PLUS HAUT dans le fichier que cette declaration. Un `let` de premier niveau reste en
   zone morte jusqu'a sa ligne : un rendu qui tomberait avant leverait une erreur, et
   `typeof` ne rattrape pas ce cas, il leve aussi. `var` est hisse, donc il vaut
   `undefined` avant sa ligne, ce qui est exactement la bonne reponse : le vidage ne
   tourne pas encore. */
var VIDAGE_EN_COURS = false;
let VIDAGE_VOILE = null;
let VIDAGE_LIGNES = null;

const VIDAGE_ETAPES = [
  { cle: 'compte',   texte: 'Ton compte' },
  { cle: 'appareil', texte: 'Cet appareil' },
  { cle: 'preuve',   texte: 'Vérification' }
];

/* Le voile est construit au moment ou il sert, et jamais pose d'avance dans la page : un bloc
   pose d'avance doit etre cache par une feuille chargee PARTOUT, sinon il tombe nu dans le flux
   le temps que sa feuille arrive. Defaut paye le 08/09/2026 par le bandeau de statut, et
   `bdv-amorce.js` porte deja ce commentaire pour la meme raison. */
function vidageMonter(){
  if(VIDAGE_VOILE) return;
  const v = document.createElement('div');
  /* LA MARQUE `--vidage` PORTE LA SEULE CHOSE QUI SEPARE CE VOILE DE CELUI DE
     L'AMORCAGE : il BOUGE. Ted a demande une animation, et un chapelet d'etapes
     immobiles n'en est pas une : sur une base de 171 569 lignes, six secondes
     d'ecran fige ne se distinguent pas d'un plantage. C'est la meme mesure que
     celle qui a fait ecrire « Analyse de tes ventes, 96 000 lignes sur 171 569 »
     le 17/09/2026. Le voile d'amorcage, lui, ne prend pas cette marque : il n'est
     pas dans le perimetre de ce lot, et on ne repeint pas un ecran qu'on n'a pas
     regarde. */
  v.className = 'bdv-amorce bdv-amorce--vidage';
  v.id = 'bdvVidage';
  /* `alertdialog` et pas `dialog` : ce qui se passe derriere est destructif et irreversible,
     et c'est le seul role que les lecteurs d'ecran annoncent avec cette urgence-la. */
  v.setAttribute('role', 'alertdialog');
  v.setAttribute('aria-modal', 'true');
  v.setAttribute('aria-labelledby', 'bdvVidageTitre');
  v.setAttribute('aria-busy', 'true');
  let h = '<div class="bdv-amorce__carte">'
    + '<p class="bdv-amorce__titre" id="bdvVidageTitre">On vide ta base</p>'
    + '<p class="bdv-amorce__sous" id="bdvVidageSous">Ne ferme pas cette page, ne dépose aucun export.</p>'
    /* Le rail est `aria-hidden` : ce qu'il dit est deja dit en mots par les trois
       etapes et par leur mot cache. Une deuxieme annonce du meme etat n'apprend rien
       et coupe la parole a la premiere. */
    + '<div class="bdv-amorce__rail" aria-hidden="true"><span></span></div>'
    + '<ul class="bdv-amorce__liste" aria-live="polite">';
  VIDAGE_ETAPES.forEach(function(e){
    h += '<li class="bdv-amorce__etape" data-etape="' + e.cle + '">'
      +  '<span class="bdv-amorce__puce" aria-hidden="true"></span>'
      +  '<span class="bdv-amorce__texte">' + e.texte + '</span>'
      +  '<span class="hors-ecran bdv-amorce__dit">en attente</span></li>';
  });
  h += '</ul><div class="bdv-amorce__pied"></div></div>';
  v.innerHTML = h;
  document.body.appendChild(v);
  VIDAGE_VOILE = v;
  VIDAGE_LIGNES = {};
  VIDAGE_ETAPES.forEach(function(e){
    VIDAGE_LIGNES[e.cle] = v.querySelector('[data-etape="' + e.cle + '"]');
  });
}
/* L'etat se dit DEUX FOIS : par la classe, qui peint, et par un mot cache que la synthese
   vocale lit. Une couleur ne s'entend pas, et elle ne se voit pas en niveaux de gris. */
function vidageDire(cle, etat, mot){
  const li = VIDAGE_LIGNES && VIDAGE_LIGNES[cle];
  if(!li) return;
  li.className = 'bdv-amorce__etape bdv-amorce__etape--' + etat;
  const dit = li.querySelector('.bdv-amorce__dit');
  if(dit) dit.textContent = mot;
}
function vidagePreciser(cle, texte){
  const li = VIDAGE_LIGNES && VIDAGE_LIGNES[cle];
  if(!li) return;
  const t = li.querySelector('.bdv-amorce__texte');
  if(t) t.textContent = texte;
}
/* LE PLANCHER, 600 ms. Sur un compte qui porte trois lignes, les trois etapes defilent en
   cent millisecondes : un voile qui apparait et disparait dans cet intervalle se lit comme un
   defaut d'affichage, pas comme un travail. C'est la meme mesure et la meme raison que les
   450 ms du voile d'amorcage, et c'est la seule attente artificielle de ce geste. */
function vidagePlancher(t0){
  const reste = 600 - (Date.now() - t0);
  return reste > 0 ? new Promise(function(r){ setTimeout(r, reste); }) : Promise.resolve();
}
/* LA FIN. C'est ici, et nulle part ailleurs, que l'animation s'arrete : `aria-busy` tombe, le
   pied recoit sa seule sortie, et le bilan RESTE a l'ecran. `status()` efface un succes au
   bout de quatre secondes : le seul compte rendu d'un effacement definitif partirait avant
   d'avoir ete lu. */
function vidageFin(titre, phrase, reussi){
  if(!VIDAGE_VOILE) return;
  VIDAGE_VOILE.setAttribute('aria-busy', 'false');
  if(!reussi) VIDAGE_VOILE.setAttribute('aria-live', 'assertive');
  const t = el('bdvVidageTitre'); if(t) t.textContent = titre;
  const s = el('bdvVidageSous');  if(s) s.textContent = phrase;
  const p = VIDAGE_VOILE.querySelector('.bdv-amorce__pied');
  if(p){
    p.innerHTML = '<button class="btn btn--geste" type="button" id="bdvVidageFermer">Fermer</button>';
    const b = el('bdvVidageFermer');
    if(b){
      b.addEventListener('click', vidageDemonter);
      /* Le focus n'est vole qu'ICI, jamais pendant le travail : pousser le focus sur un voile
         qui va disparaitre oblige a revenir en arriere, et pendant le travail il n'y a rien a
         faire. A la fin il y a une chose a faire, et une seule. */
      try{ b.focus(); }catch(e){}
    }
  }
}
function vidageDemonter(){
  if(VIDAGE_VOILE && VIDAGE_VOILE.parentNode) VIDAGE_VOILE.parentNode.removeChild(VIDAGE_VOILE);
  VIDAGE_VOILE = null; VIDAGE_LIGNES = null;
}
/* LE PANNEAU ENTIER EST NEUTRALISE, PAS SEULEMENT LE BOUTON. Neutraliser la carte aurait
   ferme un second clic sur « Vider la base » ; ce qui est reellement dangereux est a cote,
   dans la meme rangee : la zone de depot d'export. Et un reglage enregistre pendant le vidage
   ecrirait sur un bureau en train de disparaitre.
   `aria-modal` du panneau est RENDU le temps du travail : tant qu'il vaut « true », tout ce
   qui vit hors du panneau est muet a la synthese vocale, et notre voile serait vu sans etre
   entendu. Il est repose a la sortie, dans le meme `finally`. */
function vidagePanneau(bloque){
  const v = el('bdvrVoile');
  if(!v) return;
  const p = v.querySelector('.bdvr-panneau');
  if(bloque){ v.setAttribute('inert', ''); if(p) p.setAttribute('aria-modal', 'false'); }
  else      { v.removeAttribute('inert'); if(p) p.setAttribute('aria-modal', 'true'); }
}
/* LA VERIFICATION, ET C'EST ELLE QUI AUTORISE L'ARRET. `dbClear()` se resout sur
   `tx.oncomplete` : ca prouve qu'une transaction a abouti, pas que le magasin est vide. On
   relit donc les DEUX cotes, avec les deux sondes que ce fichier utilise deja dix lignes plus
   bas : `dbCount()` coute une transaction en lecture, quelques millisecondes ; le compte
   repond par `auMoinsUneVente()`, qui demande UNE ligne et jamais un comptage, le comptage
   exact ayant rendu un `57014 statement timeout` le 18/09/2026.
   Un `null` n'est jamais un zero. Il rend « inconnu », et l'ecran le dit. */
async function vidageVerifier(){
  let ici = null, laBas = null;
  try{ ici = await dbCount(); }catch(e){ ici = null; }
  if(syncPret() && BdvSync.auMoinsUneVente){
    try{ laBas = await BdvSync.auMoinsUneVente(); }catch(e){ laBas = null; }
  }
  const verdict = (ici === 0 && (!syncPret() || laBas === false)) ? 'vide'
                : ((ici > 0 || laBas === true) ? 'reste' : 'inconnu');
  return { ici: ici, laBas: laBas, verdict: verdict };
}
/* LE BILAN EST CHIFFRE, ET LES CHIFFRES VIENNENT DU SERVEUR. `vider_la_base_du_bureau` rend
   depuis le 18/09/2026 le compte de ce qu'elle a efface, table par table ; jusqu'a aujourd'hui
   `viderBase()` ne lisait que `vide` et jetait le reste. Un vidage annonce sur zero ligne est
   le symptome exact du melange de bases : sans chiffre, il ne se voit pas. */
function vidageBilan(preuve, connecte){
  const bouts = [];
  if(preuve){
    if(preuve.ventes)   bouts.push(plur(preuve.ventes, 'ligne') + ' de vente');
    if(preuve.suivi)    bouts.push(plur(preuve.suivi, 'fiche') + ' de suivi');
    if(preuve.echanges) bouts.push(plur(preuve.echanges, 'échange', 'enregistré'));
  }
  const ou = connecte ? 'de ton compte et de cet appareil' : 'de cet appareil';
  return (bouts.length ? 'Parti ' + ou + ' : ' + bouts.join(', ') + '. '
                       : (connecte ? 'Ton compte et cet appareil sont vides. '
                                   : 'Cet appareil est vide. '))
    + (connecte ? "Rien de tout ça n'existe plus nulle part, Vitisoft n'en garde aucune trace. "
                : "Ton compte n'était pas joignable : sa copie est intacte, et la prochaine ouverture la redescendra. ")
    + 'Dépose ton nouvel export quand tu veux.';
}

/* ============ ON N'OUVRE PAS CE GESTE SUR UN CHIFFRE QU'ON N'A PAS, 19/09/2026 ============
   L'avertissement plus bas compte `ROWS`, c'est-a-dire les lignes CHARGEES EN MEMOIRE. Si
   le chargement du panneau a echoue, `ROWS` est vide et le texte annoncait « 0 ligne de
   vente » juste avant d'effacer les 171 569 du compte. Ted confirmait alors un geste
   irreversible dont on venait de lui sous-estimer le cout a zero.

   ON REFUSE D'OUVRIR PLUTOT QUE D'AFFICHER ZERO. C'est le seul arbitrage prudent : un
   vidage refuse a tort se reessaie dans dix secondes apres un rechargement, un vidage
   confirme a tort ne se rattrape nulle part. Le compte rendu du 18/09/2026 le dit deja
   pour le texte : « ni tes notes, ni tes echanges, ni ton classement ne sont remontes
   dans Vitisoft ».

   TROIS QUESTIONS, ET IL FAUT LES TROIS. On ne se contente pas de `ROWS.length` :
     1. Combien cet appareil en porte VRAIMENT (`dbCount()`, quelques millisecondes). S'il
        en porte et que `ROWS` est vide, le panneau parle d'une base qu'il n'a pas relue.
     2. Si les deux sont a zero, le compte en porte-t-il ? On demande UNE ligne
        (`auMoinsUneVente()`), jamais un comptage : le comptage exact sur 171 569 lignes a
        rendu un `57014 statement timeout` le 18/09/2026.
     3. Un « je ne sais pas » (null) n'est jamais un « c'est vide ». Il fait refuser.
   On ne laisse passer que le cas ou les trois disent zero, et la il n'y a rien a perdre. */
async function viderBase(){
  /* LE GARDE DE RE-ENTREE EST UN DRAPEAU DE MODULE, ET IL EST EN TETE. Un `disabled` pose sur
     le bouton ne suffit pas et ne peut pas suffire : `renderBase()` reecrit ce bouton, et la
     sortie de cette fonction appelle `ecranRafraichir()`. Le bouton se reactiverait donc tout
     seul au milieu d'un `await`. Le drapeau est la verite, le `disabled` n'est que l'affordance,
     et c'est `renderBase()` qui le repose en LISANT le drapeau a chaque rendu. */
  if(VIDAGE_EN_COURS) return;
  if(!ROWS.length){
    let ici=null;
    try{ ici=await dbCount(); }catch(e){ ici=null; }
    let laBas=null;
    if(syncPret() && BdvSync.auMoinsUneVente){
      try{ laBas=await BdvSync.auMoinsUneVente(); }catch(e){ laBas=null; }
    }
    if(ici!==0 || laBas!==false){
      const pourquoi = (ici===null)
        ? "La base de cet appareil n'a pas répondu."
        : (ici>0)
          ? "Cet appareil porte " + plur(ici,'ligne') + " que cet écran n'a pas encore relues."
          : (laBas===null)
            ? (syncPret()
                ? "Ton compte n'a pas répondu, donc on ne sait pas ce qu'il porte."
                : "Tu n'es pas connecté : on ne peut pas savoir ce que ton compte porte.")
            : "Ton compte porte des lignes que cet appareil n'a pas encore récupérées.";
      alert("On ne peut pas vider maintenant.\n\n" + pourquoi + "\n\n"
        + "Cet écran afficherait « 0 ligne de vente » et tu confirmerais un effacement "
        + "définitif dont on vient de te sous-estimer le coût. Recharge la page, attends "
        + "que ta base soit affichée, et recommence.");
      return;
    }
  }
  // Le texte dit maintenant les DEUX cotes. Vider seulement le navigateur n'aurait plus aucun
  // sens : la prochaine ouverture rapatrierait tout depuis le compte, et le vigneron croirait
  // que le bouton ne marche pas.
  /* LE TEXTE NOMME CE QUI PART, ET IL DIT QUE VITISOFT NE RATTRAPERA RIEN.
     Demande par Ted le 18/09/2026, apres avoir melange deux bases : « il faut qu'a la
     suppression, on dit explicitement : attention tu vas perdre TOUT ce que t'as fait
     dans le bureau du vigneron, c'est pas remonte dans Vitisoft ».
     Un « cette action est definitive » ne dit rien a personne. Ce qui parle, c'est la
     liste de ce qu'on perd, avec ses chiffres, et la phrase que le vigneron a besoin
     d'entendre : son travail de suivi n'existe QUE la. */
  const nSuivi = (typeof CRM === 'object' && CRM) ? Object.keys(CRM).length : 0;
  const nEch   = (typeof ECHANGES === 'object' && ECHANGES)
                 ? Object.keys(ECHANGES).reduce(function(t,k){ return t + (ECHANGES[k]||[]).length; }, 0) : 0;
  const quoi = [
    plur(ROWS.length, 'ligne') + ' de vente',
    nSuivi ? plur(nSuivi, 'fiche') + ' de suivi client' : null,
    nEch   ? plur(nEch, 'échange', 'enregistré')   : null
  ].filter(Boolean).join(', ');

  if(!confirm(
      'ATTENTION. Tu vas perdre TOUT ce que tu as fait dans Le Bureau du Vigneron :\n\n'
    + '  ' + quoi + '\n\n'
    + "RIEN DE TOUT ÇA N'EST REMONTÉ DANS VITISOFT. Tes notes de suivi, tes échanges et "
    + "ton classement n'existent que dans le bureau : une fois effacés, ils ne se "
    + "récupèrent nulle part.\n\n"
    + (syncPret()
        ? "L'effacement porte sur cet appareil ET sur ton compte, donc aussi pour les "
          + "autres personnes de ton bureau.\n\n"
        : "Ton compte n'est pas joignable : seul cet appareil serait vidé, et la prochaine "
          + "ouverture rapatrierait tout depuis le compte. Mieux vaut réessayer plus tard.\n\n")
    + 'Confirmer la suppression définitive ?')) return;

  /* LE VOILE EST POSE ICI, ET PAS AVANT. Un `confirm()` natif bloque le rendu du navigateur :
     pose plus haut, le voile ne serait jamais peint, puis resterait sous la boite de dialogue.
     Il ne couvre donc que le TRAVAIL, jamais la question. */
  const connecte = syncPret();
  const t0 = Date.now();
  VIDAGE_EN_COURS = true;
  vidageMonter();
  vidagePanneau(true);
  let preuve = null;
  try{
    /* ET ON NE TOUCHE A RIEN TANT QUE LE SERVEUR N'A PAS PROUVE QU'IL A VIDE.
       C'est le defaut qui a melange les deux bases de Ted : l'appareil se vidait, le
       compte gardait ses lignes, et le prochain import montait par-dessus. Desormais un
       vidage serveur rate ARRETE le geste, et le bureau reste exactement comme il etait.
       Mieux vaut un bouton qui refuse qu'un bouton qui ment. */
    if(connecte){
      vidageDire('compte','encours','en cours');
      preuve = await BdvSync.effacerTout();
      if(!preuve){
        vidageDire('compte','rate','a échoué');
        await vidagePlancher(t0);
        vidageFin("Ton compte n'a PAS été vidé",
          "Rien n'a été touché sur cet appareil non plus : tes deux copies sont exactement dans "
          + "l'état d'avant. Vérifie ta connexion et réessaie. Si ça recommence, ne réimporte "
          + "rien : les deux bases se mélangeraient.", false);
        return;
      }
      vidageDire('compte','fait','fait');
      vidagePreciser('compte','Ton compte, ' + plur(preuve.ventes || 0,'ligne') + ' effacée' + ((preuve.ventes||0)>1?'s':''));
    }else{
      vidageDire('compte','rate','pas joignable');
      vidagePreciser('compte','Ton compte, pas joignable');
    }

    vidageDire('appareil','encours','en cours');
    /* `dbClear()` N'AVAIT AUCUN FILET JUSQU'AU 23/09/2026, et c'est le pire etat de tout ce
       geste : la promesse de `viderBase()` partait en rejet silencieux, le compte etait vide,
       l'appareil gardait ses 171 569 lignes, rien ne s'affichait, et `oublierRepere()` avait
       DEJA ete appele a l'interieur de `effacerTout()`. Il faut donc nommer les deux moities
       separement : laquelle est partie, laquelle ne l'est pas. C'est la seule chose qui compte
       quand on rouvre, et c'est la regle de `banc:amorce`, « une etape ratee se dit par son nom ». */
    try{
      await dbClear();
    }catch(e){
      vidageDire('appareil','rate','a échoué');
      await vidagePlancher(t0);
      vidageFin("Ton compte est vide, cet appareil ne l'est pas",
        (connecte ? "Ton compte a bien été vidé. " : "")
        + "Cet appareil n'a pas pu effacer sa copie, et elle est donc seule au monde. "
        + "NE RÉIMPORTE RIEN et n'ouvre pas tes écrans de vente : ferme cet onglet, rouvre ton "
        + "bureau, et relance le vidage.", false);
      return;
    }
    /* ET LE REPERE DE SYNCHRONISATION, 17/09/2026. effacerTout() l'oublie deja quand elle
       reussit ; ici on couvre le cas ou elle a ECHOUE : le serveur garde alors ses lignes,
       l'appareil vient de perdre les siennes, et un repere survivant annoncerait « rien de
       neuf » sur une base vide. Plus rien ne redescendrait, jamais. */
    if(window.BdvSync&&BdvSync.oublierRepere)BdvSync.oublierRepere();
    // Le serveur a tout efface (ventes, suivi, journal, reglages) : l'appareil doit suivre,
    // sinon le prochain rapatriement REINSTALLE le suivi et le journal locaux sur un serveur
    // vide, et la suppression n'aura rien efface de ce que le vigneron voyait.
    CRM={};ECHANGES={};
    try{localStorage.removeItem(CRM_KEY);localStorage.removeItem(ECH_KEY);}catch(e){}
    /* ET LE MIROIR DE LA FILE, qui manquait ici jusqu'au 08/09/2026. Les deux cles effacees
       juste au-dessus sont celles du MOTEUR ; le sous-main et l'ardoise du bureau, eux,
       lisent MIROIR_KEY, la cle de bdv-crm.js. Elle survivait au vidage, donc le bureau
       continuait de peindre un chiffre d'affaires et une file de rappels tires d'une base
       effacee, jusqu'au rechargement de la page.

       On passe par oublier() et pas par un removeItem d'ici : la cle appartient a bdv-crm.js,
       et deux fichiers qui ecrivent la meme cle, c'est un renommage silencieux qui attend son
       heure. Meme regle que « bdv-taches.js est le seul a ecrire dans la table des taches ». */
    if(window.BdvCrm&&BdvCrm.oublier)BdvCrm.oublier();
    // Un resume de serveur survivant a un vidage afficherait un chiffre d'affaires sur une
    // base vide, et c'est exactement ce que le vigneron vient de demander de faire partir.
    capPerimer();
    ROWS=[];computeMeta();
    /* LE COMPTE LOCAL PASSE A ZERO, ET LE COMPTE DISTANT AUSSI. Sans ces deux lignes,
       `baseVide()` continuerait de lire les valeurs d'avant le vidage, et le bureau
       hesiterait entre « vide » et « pas encore chargee » sur une base qu'on vient
       justement de vider en connaissance de cause. « Quand on revient sur le bureau,
       y'aura pas de doute », Ted, 18/09/2026. */
    if(typeof LIGNES_EN_BASE !== 'undefined') LIGNES_EN_BASE = 0;
    if(typeof LIGNES_DISTANTES !== 'undefined') LIGNES_DISTANTES = 0;
    if(typeof _lignesChargees !== 'undefined') _lignesChargees = false;
    vidageDire('appareil','fait','fait');

    /* LA VERIFICATION. C'est elle, et rien d'autre, qui autorise l'arret de l'animation :
       ni la fin d'une promesse, ni l'absence d'erreur. Trois verdicts, jamais deux. */
    vidageDire('preuve','encours','en cours');
    const v = await vidageVerifier();
    await vidagePlancher(t0);
    if(v.verdict === 'vide'){
      vidageDire('preuve','fait','vérifié');
      vidageFin("C'est fait", vidageBilan(preuve, connecte), true);
    }else if(v.verdict === 'reste'){
      vidageDire('preuve','rate','il reste des lignes');
      vidageFin('Le vidage n\'est pas complet',
        ((v.ici > 0) ? 'Cet appareil porte encore ' + plur(v.ici,'ligne') + '. ' : '')
        + ((v.laBas === true) ? 'Ton compte porte encore des lignes. ' : '')
        + "NE RÉIMPORTE RIEN : un export déposé par-dessus mélangerait deux bases. Recharge ton "
        + "bureau et relance le vidage.", false);
    }else{
      vidageDire('preuve','rate','non vérifié');
      vidageFin("On n'a pas pu vérifier",
        "L'effacement a été demandé des deux côtés et rien n'a signalé d'erreur, mais la relecture "
        + "qui devait le prouver n'a pas répondu. NE RÉIMPORTE RIEN avant d'avoir rechargé ton "
        + "bureau et regardé ce qu'il reste.", false);
    }
  }finally{
    /* LE SEUL POINT DE SORTIE, ET C'EST TOUTE LA DEMANDE DE TED. Six chemins quittent cette
       fonction, dont deux qu'on n'a pas ecrits : un jet de `capPerimer()`, de `computeMeta()`
       ou d'`ecranRafraichir()`. Un voile qui tourne sur un bureau a moitie vide, sans un mot,
       est pire que pas de voile : il donne a un effacement interrompu l'apparence d'un travail
       en cours. Aucun chemin ne sort d'ici sans que l'animation soit arretee et qu'une phrase
       soit posee. */
    VIDAGE_EN_COURS = false;
    vidagePanneau(false);
    if(VIDAGE_VOILE && VIDAGE_VOILE.getAttribute('aria-busy') === 'true'){
      vidageFin("Le vidage s'est interrompu",
        "Une erreur inattendue l'a arrêté en cours de route, et on ne sait pas où. NE RÉIMPORTE "
        + "RIEN : recharge ton bureau et regarde ce qu'il reste avant de recommencer.", false);
    }
    try{ ecranRafraichir(); }catch(e){}
  }
}

/* La fonction refreshResume() a disparu avec l'ecran d'import plein page : le nombre de
   lignes en base s'affiche desormais dans la barre du haut et dans l'ecran « Ma base ». */

