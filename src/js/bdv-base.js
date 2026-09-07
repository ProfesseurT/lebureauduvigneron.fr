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
function savePersoLabels(){try{localStorage.setItem(PERSO_LABELS_KEY,JSON.stringify(persoLabels));}catch(e){}syncReglages();}

/* ======================= CONFIG (a ajuster par domaine) ======================= */

/* ---- Couleurs : le CSS est la seule source de verite ----------------------
   Les graphiques lisent les tokens declares dans :root plutot que de porter
   leur propre palette. Une seule charte, un seul endroit ou la changer.
   L'echelle --serie-1..8 est categorielle : elle ne contient aucun token
   d'etat, pour qu'une serie verte ne se lise pas comme un jugement. */
const cssToken=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function palSeries(n){const p=[];for(let i=1;i<=(n||8);i++){const c=cssToken('--serie-'+i);if(c)p.push(c);}return p;}
// Aplat sous une courbe : le meme voile de bordeaux que les barres de repartition.
const aireBordeaux=()=>cssToken('--bordeaux-voile');

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

// Valeurs de "Type Offert" = sorties gratuites ou pertes, jamais du CA.
const TYPES_OFFERT=['Offert','Echantillon','Degustation','Consommation Personnelle','Casse'];

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
let reactList=[],decroList=[]; // listes completes affichees (relance / decrochage), pour l'export
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
let explAxe1='famille', explAxe2='';   // explorateur libre de l'Apercu
let evoDim='codeTarif', evoStep='mois';   // vue Evolution : dimension + pas de temps
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
  const f = el('tbFile');
  if(f && typeof META !== 'undefined' && typeof ROWS !== 'undefined'){
    f.textContent = fmtNum(ROWS.length) + ' lignes'
      + (META.min ? ' · ' + fmtDate(META.min) + ' au ' + fmtDate(META.max) : '');
  }
  if(typeof navTo === 'function' && typeof ROWS !== 'undefined' && !ROWS.length) navTo('vide');
  if(window.BdvReglages && BdvReglages.rafraichir) BdvReglages.rafraichir();
  else if(typeof ouvrirPanneauReglages === 'function') ouvrirPanneauReglages();
}
function syncReglages(){
  if(!syncPret())return;
  BdvSync.ecrireReglages({
    objectif:objectif,
    exercice_debut:EX_START,
    perso_labels:persoLabels,
    classement:REG||null
  }).catch(function(){});
}
// Une fiche videe par le vigneron est SUPPRIMEE du serveur, pas gardee vide : sinon la table
// se remplit de fiches fantomes qu'aucun ecran ne montre plus.
function syncSuivi(id){
  if(!syncPret()||!id)return;
  const c=CRM[id];
  (c?BdvSync.ecrireSuivi(id,c):BdvSync.supprimerSuivi(id)).catch(function(){});
}
// Rapatriement au demarrage. Les lignes du serveur passent par dbAddMany comme n'importe quel
// import : meme deduplication, meme enrichissement hors empreinte, aucun chemin special.
async function tirerDuServeur(){
  if(!syncPret())return;
  try{
    const lignes=await BdvSync.tirerVentes(function(n){status('loading','Récupération de tes ventes, '+fmtNum(n)+' lignes...');});
    if(lignes.length){
      const r=await dbAddMany(lignes);
      if(r.added)status('success',fmtNum(r.added)+' ligne(s) récupérée(s) depuis ton compte.');
    }
    const reg=await BdvSync.lireReglages();
    if(reg){
      if(reg.objectif!=null){objectif=Number(reg.objectif)||null;try{if(objectif)localStorage.setItem(OBJ_KEY,String(objectif));}catch(e){}}
      if(reg.exercice_debut>=1&&reg.exercice_debut<=12){EX_START=reg.exercice_debut;try{localStorage.setItem(EX_KEY,String(EX_START));}catch(e){}}
      if(reg.perso_labels){persoLabels=reg.perso_labels;savePersoLabels();}
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
  Object.keys(suivi||{}).forEach(function(id){
    const distant=suivi[id]||{}, local=CRM[id];
    if(!local){CRM[id]=distant;return;}
    Object.keys(distant).forEach(function(k){
      if(local[k]==null||CHAMPS_BUREAU.indexOf(k)>=0)local[k]=distant[k];
    });
  });
  crmSave();
    }
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
function crmVide(c){return !c||(!c.statut&&!c.notes&&!c.rappel&&!c.canal&&!(c.tags&&c.tags.length));}
function crmRafraichirListe(){
  const p=el('p-clients');if(p&&p.classList.contains('on')&&typeof renderClients==='function')renderClients();
  // Le bureau sert la file deposee : un client traite ici doit en sortir tout de suite,
  // pas au prochain import.
  if(typeof deposerPourLeBureau==='function')deposerPourLeBureau();
}
const LIB_CHAMP={statut:'Statut',rappel:'Rappel',canal:'Canal',notes:'Notes'};
function crmSet(id,champ,valeur){
  const c=CRM[id]||{};
  if(valeur==='')delete c[champ];else c[champ]=valeur;
  if(crmVide(c))delete CRM[id];else CRM[id]=c;
  crmSave();syncSuivi(id);crmRafraichirListe();
  // Sans ce retour, on tape une note, rien ne bouge, et on conclut qu'il manque un
  // bouton d'enregistrement. L'enregistrement au blur n'est acceptable que s'il se voit.
  status('success',(LIB_CHAMP[champ]||'Suivi')+(valeur===''?' effacé.':' enregistré.'));
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
  crmSave();syncSuivi(id);crmRafraichirListe();
  status('success',tags.length?'Étiquettes enregistrées.':'Étiquettes effacées.');
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
  const e={echange_id:echId(),client_id:String(id),le:new Date().toISOString(),
           type:type||'note',canal:canal||null,resume:resume||null};
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
    if(ok){ if(e._apousser){delete e._apousser;echSave();} }
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
function rappelCell(iso){
  const auj=new Date().toISOString().slice(0,10);
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
function fmtMoney(n){return fmtNum(Math.round(n))+' €';}
function fmtPct(n,d){return (n>=0?'+':'')+fmtNum(n,d==null?1:d)+' %';}
function plur(n,mot){return n+' '+mot+(n>1?'s':'');}
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
function uiExplorer(){runBusy('Analyse…',renderExplo);}

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
  if(y<1990||y>2100||mo<1||mo>12)return null;
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
function parseTels(cell){
  if(!cell)return [];
  const out=[],vus=new Set();
  String(cell).split(/[|;\/]+/).forEach(part=>{
    let s=part.trim();
    if(!s)return;
    // On garde les chiffres et un eventuel + de tete, on jette le reste (espaces, points, parentheses).
    let plus=s.trim().startsWith('+');
    let d=s.replace(/[^\d]/g,'');
    if(!d)return;
    // « 00 » international equivaut a « + ».
    if(!plus&&d.startsWith('00')){plus=true;d=d.slice(2);}
    // « +33 (0)4 94... » : le zero de courtoisie apres l'indicatif francais est en trop.
    if(plus&&d.startsWith('330'))d='33'+d.slice(3);
    let appel;
    if(plus){appel='+'+d;}
    else if(d.length===10&&d.startsWith('0')){appel='+33'+d.slice(1);}   // numero francais standard
    else if(d.length===9&&!d.startsWith('0')){appel='+33'+d;}            // zero de tete perdu a la saisie
    else {appel=d;}                                                      // format inconnu : on n'invente pas
    if(appel.replace(/\D/g,'').length<8)return;                          // trop court pour etre un numero
    if(vus.has(appel))return;
    vus.add(appel);
    out.push({appel,affiche:formatTel(appel,s)});
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
  return propre||appel;
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
  if(e.key==='Escape'&&el('modale')&&el('modale').classList.contains('on')&&typeof fermerFiche==='function'){e.preventDefault();fermerFiche();}
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
  await reloadFromDB();
  const total=ROWS.length;
  const per=META.min&&META.max?(' sur la période '+fmtDate(META.min)+' au '+fmtDate(META.max)):'';
  // Un export deja importe qui revient enrichi (adresses e-mail) ne doit pas passer pour un echec.
  const enrichTxt=totEnrich?', '+fmtNum(totEnrich)+' ligne(s) complétée(s) avec les adresses e-mail':'';
  const couvTxt=COUV.total?' '+fmtNum(COUV.joignables)+' client(s) sur '+fmtNum(COUV.total)+' sont joignables ('
    +fmtNum(COUV.mail)+' par e-mail, '+fmtNum(COUV.tel)+' par téléphone).':'';
  const resume=totAdded+' ligne(s) ajoutée(s), '+totDup+' doublon(s) ignoré(s)'+enrichTxt+'. Base totale = '+fmtNum(total)+' lignes'+per+'.'+couvTxt;
  if(echecsSync)status('error','Attention, '+fmtNum(echecsSync)+' ligne(s) n\'ont pas pu être enregistrées sur ton compte. Elles sont bien sur cet appareil. '+resume);
  else status('success',resume);
  if(!BdvCompte.session()) await BdvCompte.porte({titre:'Tes chiffres sont prêts.'});
  // Le panneau, s'il est ouvert, doit montrer la base D'APRES l'import. Au bureau c'est le
  // SEUL rafraichissement : il n'y a pas de renderAll() la-bas, ni d'ecran a rouvrir.
  ecranRafraichir();
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
async function reloadFromDB(){
  const items=await dbGetAll();
  REG=await regLire();                    // les reglages doivent etre la AVANT de classer
  ROWS=items.map(it=>deriveRow(it.raw));
  computeMeta();
  // Sans reglage enregistre, on prepare les propositions pour l'ecran dedie, sans les appliquer.
  if(!REG||!REG.valide)PROPOSE=reglagesProposes();
}
let PROPOSE=null;
// Enregistre les reglages saisis par le vigneron et reclasse toute la base.
async function appliquerReglages(R){
  R.valide=true;delete R._profils;
  await regEcrire(R);
  REG=R;syncReglages();
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
function exCe(){return EX_START===1?'cette année':'cet exercice';}
function exMoisNom(i){return MOIS_PLEIN[i-1];}   // 1..12, mois civil
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
  syncReglages();
  ROWS.forEach(exDeriver);
  filters={ex:null,from:null,to:null,preset:'tous'};
  computeMeta();
  runBusy('Recalcul sur le nouvel exercice…',()=>{if(typeof buildFilterBar==='function')buildFilterBar();ecranRafraichir();});
}

// Transforme les 40 champs bruts en objet exploitable + classification vente/non-vente.
function deriveRow(raw){
  const o={};COLS.forEach((k,i)=>o[k]=raw[i]==null?'':raw[i]);
  o._date=parseDateFR(o.date);
  o._dayNum=o._date?Math.floor(Date.UTC(o._date.y,o._date.m-1,o._date.d)/86400000):null; // jour absolu, pour les intervalles en jours
  exDeriver(o);            // exercice comptable : _exY, _exM, _exPos (voir plus haut)
  o._total=parseNum(o.totalHT);
  o._pu=parseNum(o.puHT);
  o._qte=parseNum(o.quantite);
  o._emails=parseEmails(o.emails);        // adresses nettoyees de la ligne (0, 1 ou plusieurs)
  o._email=o._emails[0]||'';              // adresse principale, pour l'affichage
  o._tels=parseTels(o.mobile).concat(parseTels(o.fixe));  // mobile d'abord : on joint plus vite un portable
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
// Compatibilite : l'ancien nom reste utilise ailleurs dans le fichier.
function emailCell(id){return contactCell(id);}
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
// Cout estime d'une ligne offerte : prix produit, sinon prix famille, sinon 0 (jamais planter).
function coutOffertLigne(r,prix){
  const pu = prix.parProduit[r.numProduit] || prix.parFamille[norm(r.famille)] || 0;
  return pu * r._qte;
}
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

  html+=regle
    ? signal('ok','✔','Tes réglages sont enregistrés.','Les chiffres de tous les écrans les utilisent. Tu peux les modifier ici à tout moment.')
    : signal('info','ℹ','L\'outil fonctionne actuellement au jugé.',
        'Les regroupements ci-dessous sont des <b>propositions</b> déduites de ton fichier, pas des certitudes. Tant que tu ne les as pas validés, prends les chiffres de canaux et de typologie avec prudence.');

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
    <div class="expl-ctrls"><div class="field"><label>Premier mois de l'exercice</label>
      <select class="search" onchange="exAppliquer(this.value)">${MOIS_PLEIN.map((m,i)=>`<option value="${i+1}"${EX_START===i+1?' selected':''}>${m}</option>`).join('')}</select>
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
    return `<tr><td>${esc(f)}</td><td class="num">${fmtNum(s.n)}</td><td class="num">${fmtMoney(s.ca)}</td>
      <td><label class="chk"><input type="checkbox" ${B.horsCA[f]?'':'checked'} onchange="BROUILLON.horsCA[${JSON.stringify(f).replace(/"/g,'&quot;')}]=!this.checked;majImpact()"> oui</label></td></tr>`;}).join('')}
  </tbody></table></div></div>`;

  /* 2. Les sorties gratuites */
  const tos=Object.keys(B.gratuit);
  if(tos.length){
    html+=`<div class="section-label">2. Les sorties gratuites</div>
    <div class="card"><p class="mini-line">Ces valeurs viennent de ta colonne « Type Offert ». Coche celles qui sont réellement des sorties sans recette : elles ne compteront jamais dans le CA.</p>
    <div class="tablewrap"><table class="data"><thead><tr><th>Valeur</th><th class="num">Lignes</th><th>Sortie gratuite ou perte</th></tr></thead><tbody>
    ${tos.map(t=>{const n=ROWS.filter(r=>String(r.typeOffert||'').trim()===t).length;
      return `<tr><td>${esc(t)}</td><td class="num">${fmtNum(n)}</td>
        <td><label class="chk"><input type="checkbox" ${B.gratuit[t]?'checked':''} onchange="BROUILLON.gratuit[${JSON.stringify(t).replace(/"/g,'&quot;')}]=this.checked;majImpact()"> oui</label></td></tr>`;}).join('')}
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
    return `<option value="${c.k}" ${c.k===valeur?'selected':''}>${c.l} — rempli à ${Math.round(p.taux*100)} %, ${p.distinct} valeur(s)</option>`;
  }).join('');
  return `<select class="search" style="min-width:340px" onchange="changerChamp('${cle}',this.value)">${opts}</select>`;
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
    ${liste.map(e=>`<tr><td>${esc(e.v)}</td><td class="num">${fmtNum(e.n)}</td><td class="num">${fmtNum(e.clients.size)}</td>
      <td><span class="muted-cell">${formeValeur(e)}</span></td>
      <td><input class="search" style="min-width:170px" list="dl-${cible}" value="${esc(B[cible][e.v]||'')}"
        onchange="BROUILLON.${cible}[${JSON.stringify(e.v).replace(/"/g,'&quot;')}]=this.value.trim();majImpact()"></td></tr>`).join('')}
    </tbody></table></div>
    ${reste>0?`<p class="note">${reste} valeur(s) plus rares ne sont pas affichées, elles seront rangées dans « Autre / non renseigné ».</p>`:''}
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

  if(PAS_VITISOFT){
    html+=`<div class="pas-viti">
      <p class="pas-viti__titre">Cet outil ne lira pas tes fichiers.</p>
      <p>Tu as indiqué ne pas utiliser Vitisoft. Le tableau de bord est construit sur son format d'export et refusera tout autre fichier. Ce n'est pas une porte fermée : le reste du Bureau est ouvert, et gratuit.</p>
      <p class="pas-viti__liens"><a href="/outils/echeances/">Le compte à rebours réglementaire</a> · <a href="/mon-bureau/">Mon bureau</a> · <a href="/articles/">Les articles</a></p>
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
    html+=`<p class="note">${fmtNum(SANS_NUM)} ligne(s) sans numéro client. Elles sont suivies sous le nom du client, ce qui fonctionne, mais leur fiche de suivi se perdra si l'orthographe du nom change dans Vitisoft.</p>`;
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
      ${typesRows.map(([t,c])=>`<tr><td>${esc(t)}</td><td class="num">${fmtNum(c.n)}</td><td class="num">${fmtMoney(c.cout)}</td></tr>`).join('')}
      </tbody></table><p class="note">Ces sorties ne comptent jamais dans le CA. Estimation du manque à gagner, valorisée au prix de vente moyen réel de chaque produit.</p></div>`;
  }
  // Hors-vente par famille.
  const parFamHV={};
  horsVin.forEach(r=>{const f=(r.famille||'(non renseigné)').trim();const c=parFamHV[f]||(parFamHV[f]={n:0,ca:0});c.n++;c.ca+=r._total;});
  const hvRows=Object.entries(parFamHV).sort((a,b)=>Math.abs(b[1].ca)-Math.abs(a[1].ca));
  if(hvRows.length){
    html+=`<div class="card"><div class="card__title"><span>Hors-vente par famille</span></div>
      <table class="data"><thead><tr><th>Famille</th><th class="num">Lignes</th><th class="num">Montant HT</th></tr></thead><tbody>
      ${hvRows.map(([f,c])=>`<tr><td>${esc(f)}</td><td class="num">${fmtNum(c.n)}</td><td class="num">${fmtMoney(c.ca)}</td></tr>`).join('')}
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
      <button class="btn btn--danger" onclick="viderBase()">Vider la base</button>
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
async function viderBase(){
  // Le texte dit maintenant les DEUX cotes. Vider seulement le navigateur n'aurait plus aucun
  // sens : la prochaine ouverture rapatrierait tout depuis le compte, et le vigneron croirait
  // que le bouton ne marche pas.
  const surServeur=syncPret()?' et de ton compte':'';
  if(!confirm('Vider toute la base ? Cette action est définitive et efface les '+fmtNum(ROWS.length)+' lignes cumulées de cet appareil'+surServeur+'.'))return;
  if(syncPret())await BdvSync.effacerTout();
  await dbClear();
  // Le serveur a tout efface (ventes, suivi, journal, reglages) : l'appareil doit suivre,
  // sinon le prochain rapatriement REINSTALLE le suivi et le journal locaux sur un serveur
  // vide, et la suppression n'aura rien efface de ce que le vigneron voyait.
  CRM={};ECHANGES={};
  try{localStorage.removeItem(CRM_KEY);localStorage.removeItem(ECH_KEY);}catch(e){}
  ROWS=[];computeMeta();
  status('success','Base vidée.');
  ecranRafraichir();
}

/* La fonction refreshResume() a disparu avec l'ecran d'import plein page : le nombre de
   lignes en base s'affiche desormais dans la barre du haut et dans l'ecran « Ma base ». */

