/* ============================================================================
   bdv-courrier.js  LE COURRIER DU MATIN
   ============================================================================
   Ce fichier FABRIQUE le mail quotidien, et rien d'autre. Il ne lit aucune
   base, il n'envoie rien, il ne connait ni Supabase ni Resend. On lui donne
   les donnees d'un compte, il rend un sujet, un HTML et un texte.

   POURQUOI CETTE FORME. Au lot 3 il tourne dans une fonction Edge, cote
   serveur, sans navigateur. Toute lecture reseau ecrite ici obligerait a en
   tenir DEUX versions, une pour l'apercu et une pour l'envoi, qui
   divergeraient au premier changement de contenu. Il tourne donc dans trois
   mondes sans etre modifie : le navigateur (balise script), Node (l'apercu) et
   Deno (la fonction Edge). D'ou le bloc d'export en bas de fichier. Ne pas y
   introduire de `import` ni de `require` : ca fermerait deux des trois mondes.

   ============================================================================
   LE PAPIER CONTINU, 09/09/2026
   ============================================================================
   Demande de Ted : « on peut imaginer un courrier d'une vieille imprimante a
   bande ». Ce n'est pas un caprice, et c'est meme la coherence qui manquait :
   le SOUS-MAIN de son bureau est deja du papier continu a picots (.listbb dans
   style.css), dessine le 07/09/2026 pour exactement ce motif-la, « cette zone
   ne raconte rien, elle liste des dossiers a traiter ». Le mail liste la meme
   matiere : il porte la meme.

   MAIS « DIGESTE » ET « LISTING » S'OPPOSENT, et c'est l'arbitrage du lot.
   Un listing, c'est du monospace et des lignes du meme poids : c'est ce qui
   rend un mur de texte penible a parcourir. Ce qui rend un mail digeste, c'est
   la hierarchie. On garde donc la MATIERE du listing et on refuse son defaut :
   - les NOMS restent dans la police du corps, seuls les CHIFFRES et les DATES
     passent en mono. C'est deja la regle du sous-main : « mono pour les
     references et les retards ». Le mono qui compte est celui qui ALIGNE les
     montants, et c'est le vrai gain cache de l'idee de Ted ;
   - les en-tetes de section sont des bandes sombres en capitales espacees,
     comme `.listb th` ;
   - les bandes alternent a 1,23:1, volontairement faible : une bande guide
     l'oeil sur la ligne, elle ne doit pas se lire comme une couleur d'etat ;
   - et on COUPE. Cinq signaux au lieu de huit, un conseil au lieu de trois.
     Un mail de 8 h qu'on ne finit pas est un mail qu'on cesse d'ouvrir.

   LES PICOTS EN MESSAGERIE. La recette du site est un `radial-gradient` de
   pas fixe, 26 px, independant de la hauteur des lignes. [Certain] Outlook
   ignore les degrades : il n'y verra que du papier nu. C'est une degradation
   acceptable, parce que les deux FILETS de perforation, eux, sont de vraies
   bordures et tiennent partout : meme sans les trous, la bande se lit.
   ============================================================================ */
(function(racine){
'use strict';

/* ---- LES COULEURS SONT ECRITES EN DUR ICI, ET C'EST LA SEULE EXCEPTION -----
   `var(--bordeaux)` n'existe pas dans Outlook, et une feuille externe n'est
   pas chargee par la plupart des messageries. Chaque valeur porte le NOM du
   jeton dont elle est copiee : le jour ou un jeton change, on cherche son nom
   ici. Sans ces noms, cette liste devient un deuxieme nuancier orphelin.

   `--rule` est semi-transparent dans le site. Aplati ici sur `--paper` :
   rgba(30,37,54,0.18) sur #EFE7D6 donne #C9C4B9. */
var C = {
  paper:      '#EFE7D6',  /* --paper */
  paperLight: '#F5EFE0',  /* --paper-light, LE papier du listing */
  paperDeep:  '#DACDAF',  /* --paper-deep, la couleur des picots */
  white:      '#FFFFFF',  /* --white, la bande paire du listing */
  ink:        '#1E2536',  /* --ink */
  muted:      '#63523D',  /* --muted */
  bordeaux:   '#5A1525',  /* --bordeaux */
  bxDeep:     '#45101D',  /* --bordeaux-deep */
  ardoise:    '#241A12',  /* --ardoise, LES BANDES D'EN-TETE du listing */
  cork:       '#B89066',  /* --cork, ornement seul : les barres, jamais du texte */
  filet:      '#C9C4B9',  /* --rule, aplati sur --paper */
  danger:     '#A03530',  /* --danger-deep, et pas --danger : 4,00:1 ne passe pas AA */
  onDark:     '#EFE7D6'   /* --on-dark */
};
/* RECTIFIE. Les bandes d'en-tete portent `--ardoise`, comme `.listb th` dans le
   sous-main, et non `--bordeaux-deep` que j'avais mis en attendant de pouvoir
   lire la feuille. Le mail et le sous-main portent donc la meme encre, ce qui
   est tout l'objet du papier continu.
   Mesure refaite ici plutot que reprise de la charte : `--on-dark` sur
   `--ardoise` donne 13,86:1, et `--muted` sur `--paper-deep`, l'encre des
   bandes de motif, 4,75:1, donc AA. Les deux chiffres tombent sur ceux que la
   charte annonce. Le bordeaux profond reste pour le bouton, ou il est un
   ACCENT et pas un en-tete de colonne. */

/* Pas de Fraunces, pas d'Inter, pas de JetBrains Mono : une messagerie ne
   charge pas de police web. Ce sont exactement les replis declares dans les
   jetons, donc le mail tombe sur la deuxieme intention et pas au hasard. Et
   pour le listing ca tombe bien : Courier EST la police d'une imprimante. */
var F_TITRE = "Georgia,'Times New Roman',serif";
var F_CORPS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
var F_MONO  = "'Courier New',Courier,monospace";

/* Au-dela de ce nombre de jours, on n'affiche plus les signaux du tableau de
   bord. [Supposition] 60 jours est a regler a l'usage : un client detecte en
   recul il y a deux mois a soit ete traite, soit change de situation. Les
   taches et les rappels, eux, ne sont JAMAIS masques : ils sont lus en direct
   et ne peuvent pas etre perimes. */
var PEREMPTION_J = 60;
/* CINQ, ET PLUS HUIT, 09/09/2026. Le mail reel en montrait huit sur quarante
   deposes, plus trois conseils : trop long pour 8 h du matin. Le mail n'est pas
   le bureau, il y renvoie. */
var MAX_SIGNAUX = 5;
var MAX_CONSEILS = 1;
var HORIZON_J = 3;
/* LES ADRESSES E-MAIL DES CLIENTS NE PARTENT PAS DANS LE MAIL, 09/09/2026.
   Ted avait valide « noms et montants ». Les adresses etaient embarquees en
   plus, par effet de bord de contactTexte(), et ce n'etait pas un arbitrage.
   Deux raisons de les retirer, et la premiere n'est pas la confidentialite :
   l'outil dit lui-meme « appelle-le plutot que de lui ecrire » sur ces motifs,
   parce qu'a ce niveau d'historique un e-mail passe pour une relance de masse.
   Mettre l'adresse dans le mail invite a faire ce que le conseil deconseille.
   La seconde : ca divise par deux ce qui transite chez un tiers.
   Mettre a `false` pour les faire revenir : une ligne, et une decision. */
var CACHER_LES_EMAILS = true;

/* ======================= PETITS OUTILS =======================
   Recopies de bdv-base.js et pas importes : cote serveur, bdv-base.js n'existe
   pas. Ce sont des fonctions de mise en forme sans aucune regle metier. La
   duplication que le projet refuse porte sur les calculs, pas sur un espace
   insecable dans un montant. Si l'une change dans le moteur, elle change ici :
   elles doivent afficher le meme chiffre a l'identique. */
var MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
var JOURS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
/* Les abreviations de l'histogramme. RECOPIEES DE `MOIS_FR` dans bdv-base.js,
   points finaux retires pour la largeur de colonne. Ce sont celles du site, et
   pas une troncature : couper les noms longs a trois lettres donnait « JUI »
   pour juin ET pour juillet, vu sur la capture du 09/09/2026. Le francais ne
   se tronque pas a longueur fixe, il a ses abreviations d'usage. */
var MOIS_COURT = ['JANV','FÉVR','MARS','AVR','MAI','JUIN','JUIL','AOÛT','SEPT','OCT','NOV','DÉC'];

function esc(s){
  return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});
}
/* Les verdicts du tableau de bord portent du <b> et peuvent contenir un nom de
   client, donc du texte venu du fichier du vigneron. On echappe TOUT, puis on
   rend ses balises a la mise en forme, et a elle seule. */
function htmlLimite(s){
  return esc(s)
    .replace(/&lt;(\/?)b&gt;/g, '<$1b>')
    .replace(/&lt;(\/?)i&gt;/g, '<$1i>')
    .replace(/&lt;br\s*\/?&gt;/g, '<br>');
}
function sansBalise(s){ return String(s==null?'':s).replace(/<[^>]*>/g,''); }
function fmtNum(n,d){
  try{ return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d==null?0:d}).format(n); }
  catch(e){ return String(Math.round(n)); }
}
function fmtMoney(n){ return fmtNum(Math.round(n||0))+' €'; }
function plur(n,mot){ return n+' '+mot+(n>1?'s':''); }

/* `contact` est un bloc de coordonnees separees par des espaces, fabrique par
   contactTexte(). On ne garde que ce qui n'est pas une adresse e-mail.

   ET ON DISTINGUE TROIS CAS, pas deux. Premiere version : tout client dont la
   seule coordonnee etait une adresse affichait « SANS CONTACT ». C'est un
   MENSONGE, et il est pire que le probleme qu'on venait de regler : le
   vigneron lit « aucun contact enregistre », conclut qu'il faut aller en
   chercher un, alors qu'il en a un sous la main dans son bureau. Vu sur la
   version texte, pas devine.
   Rend { texte, etat } ou etat vaut 'tel', 'email-seul' ou 'rien'. */
function contactUtile(txt){
  var tout = String(txt||'').split(/\s+/).filter(Boolean);
  if(!tout.length) return { texte:'', etat:'rien' };
  var gardes = tout.filter(function(m){ return !CACHER_LES_EMAILS || m.indexOf('@') < 0; });
  if(gardes.length) return { texte:gardes.join(' ').trim(), etat:'tel' };
  return { texte:'', etat:'email-seul' };
}

/* Une date au format AAAA-MM-JJ, sans passer par l'objet Date : entre minuit
   et 2 h en France, un new Date() sur une chaine nue est lu en UTC et rend la
   veille. Meme piege que celui documente pour les rappels dans bdv-crm.js. */
function jour(iso){
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso||''));
  if(!m) return null;
  return { y:+m[1], m:+m[2], d:+m[3], n:Date.UTC(+m[1],+m[2]-1,+m[3])/86400000 };
}
function fmtJourLong(j){
  if(!j) return '';
  var nomJour = JOURS_FR[new Date(Date.UTC(j.y,j.m-1,j.d)).getUTCDay()];
  return nomJour+' '+j.d+' '+MOIS_FR[j.m-1];
}
function fmtJourCourt(j){
  if(!j) return '';
  return String(j.d).padStart(2,'0')+'/'+String(j.m).padStart(2,'0')+'/'+j.y;
}
function fmtRetard(n){
  if(n==null) return '';
  if(n===0) return "aujourd'hui";
  if(n===1) return 'depuis hier';
  if(n<0) return n===-1 ? 'demain' : 'dans '+plur(-n,'jour');
  return 'depuis '+plur(n,'jour');
}
/* La colonne « retard » d'un listing, en mono et courte, comme dans le
   sous-main : J+3, J-1, JOUR J. Elle s'aligne, elle se compare d'un coup
   d'oeil, et c'est ce que la version longue en prose ne permet pas. */
function fmtJ(n){
  if(n == null) return '';
  if(n === 0) return 'JOUR J';
  return n > 0 ? ('J+'+n) : ('J'+n);
}

/* ======================= CE QUE LE MAIL RACONTE ======================= */

var TITRES_MOTIF = {
  recul:   'ils achetaient, ils achètent moins',
  cadence: 'ils ont dépassé leur rythme',
  unique:  'venus une seule fois'
};
function titreMotif(k){ return TITRES_MOTIF[k] || String(k||'sans motif'); }

/* LE FILTRE QUI DISPARAIT QUAND LA VUE FILTRE.
   fileSignaux() ecarte deja les clients suivis, mais au moment du DEPOT, dans
   le navigateur. Un rappel pose depuis le telephone le lendemain ne ressort pas
   du depot de la veille. La vue `v_courrier` fait desormais cette anti-jointure
   en SQL : CETTE FONCTION EST DONC A SUPPRIMER, et elle ne survit que parce que
   le jeu d'essai de `npm run courrier` n'est pas filtre et porte le cas de
   test. Deux endroits qui repondent « ce client est-il encore a voir » se
   contrediront au premier geste. */
function ecarterLesSuivis(signaux, suivis){
  var vus = {};
  (suivis||[]).forEach(function(s){
    if(s && s.client_id && (s.rappel || s.statut==='traite')) vus[s.client_id] = true;
  });
  return (signaux||[]).filter(function(s){ return s && !vus[s.id]; });
}

/* Le nom d'un client suivi n'est pas dans les signaux : il en est sorti par
   construction. Il vient de l'annuaire depose a cote de la file. Sans lui, le
   mail afficherait un numero client Vitisoft brut. */
function nomDe(annuaire, id){
  var n = annuaire && annuaire[id];
  if(typeof n === 'string' && n.trim()) return n.trim();
  if(n && typeof n === 'object' && n.nom) return String(n.nom);
  return String(id||'');
}

/* ---- UNE SEULE FORME POUR CE QUI TOMBE AUJOURD'HUI ----
   Un rappel client et une tache sont deux choses en base, et la MEME chose
   pour le vigneron a 8 h : quelque chose qui lui tombe dessus. Les deux sont
   normalises vers une seule forme, et une seule fonction les dessine. Deux
   dessinateurs auraient diverge au premier ajustement. */
function normRappel(s, annuaire, jAuj){
  if(!s || !s.rappel || s.statut === 'traite') return null;
  var jr = jour(s.rappel);
  if(!jr) return null;
  var meta = [];
  if(s.canal) meta.push(String(s.canal));
  meta.push('rappel du '+fmtJourCourt(jr));
  return { type:'rappel', titre:nomDe(annuaire, s.client_id), jour:jr,
           ecart:jAuj.n - jr.n, encours:false, meta:meta,
           note:sansBalise(s.notes).trim() };
}
/* DEUX REGLES, AUCUNE COSMETIQUE.
   1. UNE TACHE SANS DATE N'ENTRE JAMAIS DANS LE COURRIER. Le mail dit ce qui
      tombe aujourd'hui ; une tache non datee n'a aucune raison de tomber ce
      matin plutot qu'un autre, et la faire reparaitre chaque jour est le
      defaut qui fait decrocher un lecteur en dix jours.
   2. EN COURS N'EST PAS EN RETARD. Une tache qui porte une date de fin et qui
      court encore n'est pas en retard. L'annoncer en rouge est la meme faute
      que nommer un client deja traite, et elle coute la meme chose. */
function normTache(t, jAuj){
  if(!t || t.fait_le) return null;
  var jd = jour(t.echue_le);
  if(!jd) return null;
  var jf = jour(t.fin_le);
  var encours = !!(jf && jf.n >= jAuj.n && jd.n <= jAuj.n);
  var meta = [];
  if(t.source === 'echeance') meta.push('échéance du métier');
  meta.push(jf ? ('du '+fmtJourCourt(jd)+' au '+fmtJourCourt(jf))
               : fmtJourCourt(jd));
  return { type:'tache', titre:String(t.titre||'(sans titre)'), jour:jd,
           ecart:jAuj.n - jd.n, encours:encours, meta:meta, note:'' };
}
/* Melanges et pas separes : le vigneron ne trie pas sa matinee par table de
   base de donnees. Le plus en retard d'abord, et ce qui est EN COURS passe
   apres ce qui est vraiment en retard. */
function trierAFaire(suivis, taches, annuaire, jAuj){
  var tout = [];
  (suivis||[]).forEach(function(s){ var o=normRappel(s,annuaire,jAuj); if(o)tout.push(o); });
  (taches||[]).forEach(function(t){ var o=normTache(t,jAuj);           if(o)tout.push(o); });
  var echus = tout.filter(function(o){ return o.ecart >= 0; });
  var venir = tout.filter(function(o){ return o.ecart < 0 && o.ecart >= -HORIZON_J; });
  echus.sort(function(a,b){
    if(a.encours !== b.encours) return a.encours ? 1 : -1;
    return b.ecart - a.ecart;
  });
  venir.sort(function(a,b){ return a.jour.n - b.jour.n; });
  return { echus:echus, venir:venir };
}

/* ======================= LE PAPIER =======================
   Tout en tableaux et en styles de ligne. Aucune classe, aucune feuille :
   Gmail retire les balises style dans certains contextes, et Outlook ignore la
   moitie de ce qui reste. Aucun rayon, aucune ombre : c'est la charte, et ca
   tombe bien, les messageries les rendent mal. */

/* La bande d'en-tete d'une section, sur le modele de `.listb th` : encre claire
   sur fond sombre, mono, capitales tres espacees. C'est ce qui remplace les
   titres en Georgia de la premiere version : sur un listing, un titre est une
   bande, pas une ligne de revue. */
/* ---- LES TROUS DE PERFORATION, EN VRAIES CELLULES, 10/09/2026 ----
   Ils etaient un `radial-gradient` pose sur le fond du papier. [Certain] Gmail
   jette les degrades, Outlook aussi : le courrier arrivait sans trous, et c'est
   la premiere chose que Ted a vue manquer dans sa boite. Le commentaire de ce
   fichier annoncait la perte pour Outlook et la jugeait acceptable ; elle ne
   l'etait pas, parce que l'effet imprimante EST le dessin.

   Une image de fond hebergee n'est pas une option : les messageries bloquent
   les images par defaut, le trou ne s'afficherait qu'apres un clic, et le mail
   ne doit dependre d'aucune adresse du site -- l'envoi de 8 h et le site sont
   deux pannes qui restent independantes.

   Donc UN TROU PAR LIGNE, en cellules de tableau. Le pas n'est plus de 26 px
   fixes, il suit les lignes. C'est meme plus juste : une ligne de mail n'a pas
   de hauteur fixe, un pas fixe finirait par percer un texte en deux.
   `border-radius` fait le rond partout sauf sous Outlook, qui rendra un petit
   carre. Un carre dans la marge se lit encore comme une perforation. */
/* Un `div` et pas un tableau imbrique pour le rond : le trou est repete deux
   fois par ligne, soit une centaine de fois dans un courrier plein. La version
   en tableaux pesait 49 ko par compte, celle-ci 36. A 500 vignerons, c'est
   6 Mo d'envoi en moins par matin pour le meme dessin. */
var TROU = '<td width="18" valign="middle" align="center" bgcolor="'+C.paperLight+'"'
  + ' style="width:18px;background-color:'+C.paperLight+';padding:0;'
  +   'font-size:0;line-height:0;">'
  + '<div style="width:5px;height:5px;margin:0 auto;background-color:'+C.paperDeep+';'
  +   'border-radius:3px;font-size:0;line-height:0;">&nbsp;</div></td>';

function bande(gauche, droite){
  return ''
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
  +   ' style="border-collapse:collapse;background-color:'+C.ardoise+';">'
  + '<tr>'
  + TROU
  + '<td bgcolor="'+C.ardoise+'" style="background-color:'+C.ardoise+';'
  +   'padding:6px 10px;font-family:'+F_MONO+';font-size:11px;line-height:1.4;'
  +   'letter-spacing:0.10em;text-transform:uppercase;color:'+C.onDark+';">'+esc(gauche)+'</td>'
  + (droite
    ? '<td align="right" bgcolor="'+C.ardoise+'"'
      + ' style="background-color:'+C.ardoise+';padding:6px 10px;font-family:'+F_MONO+';font-size:11px;'
      + 'line-height:1.4;letter-spacing:0.10em;text-transform:uppercase;'
      + 'color:rgba(239,231,214,0.75);white-space:nowrap;">'+esc(droite)+'</td>'
    : '')
  + TROU
  + '</tr></table>';
}

/* Une ligne du listing. `pair` alterne la bande : 1,23:1 entre les deux,
   volontairement faible. La colonne de droite est en mono et alignee a droite,
   c'est elle qui fait le listing : les montants et les retards s'y empilent
   et se comparent sans etre lus un par un. */
function ligne(pair, gaucheHtml, droiteHtml){
  /* LE FOND VA SUR LES CELLULES, EN ATTRIBUT `bgcolor` ET EN STYLE, JAMAIS SUR
     LA SEULE BALISE <table>. Constate le 10/09/2026 dans un vrai Gmail : les
     bandes de section sont arrivees SANS fond, donc en creme clair sur creme
     clair, illisibles -- et l'alternance des lignes avait disparu avec. Les
     jauges et l'histogramme, eux, tenaient : ils portaient deja `bgcolor`.
     La regle etait ecrite au-dessus de barre() et n'avait pas ete appliquee
     partout. Une regle appliquee a moitie ne protege rien. */
  var fond = pair ? C.white : C.paperLight;
  return ''
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
  +   ' style="border-collapse:collapse;background-color:'+fond+';">'
  + '<tr>'
  + TROU
  + '<td bgcolor="'+fond+'" style="background-color:'+fond+';'
  +   'padding:7px 10px;border-bottom:1px solid '+C.filet+';font-family:'+F_CORPS+';'
  +   'font-size:14px;line-height:1.45;color:'+C.ink+';">'+gaucheHtml+'</td>'
  + '<td width="92" align="right" valign="top" bgcolor="'+fond+'"'
  +   ' style="background-color:'+fond+';padding:7px 10px 7px 4px;border-bottom:1px solid '+C.filet+';'
  +   'font-family:'+F_MONO+';font-size:13px;line-height:1.45;color:'+C.ink+';'
  +   'white-space:nowrap;">'+droiteHtml+'</td>'
  + TROU
  + '</tr></table>';
}

function ligneAFaire(o, pair){
  var j = fmtJ(o.ecart);
  var droite;
  if(o.encours)        droite = '<span style="color:'+C.muted+';">EN COURS</span>';
  else if(o.ecart > 0) droite = '<span style="color:'+C.danger+';font-weight:700;">'+esc(j)+'</span>';
  else if(o.ecart===0) droite = '<span style="font-weight:700;">'+esc(j)+'</span>';
  else                 droite = '<span style="color:'+C.muted+';">'+esc(j)+'</span>';
  var gauche = '<div>'+esc(o.titre)+'</div>'
    + (o.meta.length
      ? '<div style="font-family:'+F_MONO+';font-size:11px;color:'+C.muted+';padding-top:2px;">'
        + esc(o.meta.join('  ·  '))+'</div>'
      : '')
    + (o.note
      ? '<div style="font-size:12px;color:'+C.ink+';padding-top:4px;font-style:italic;">'+esc(o.note)+'</div>'
      : '');
  return ligne(pair, gauche, droite);
}

function ligneSignal(s, pair){
  var lib = sansBalise(s.lib).trim();
  var detail = htmlLimite(s.detail||'').trim();
  var contact = contactUtile(sansBalise(s.contact));
  var montant = (s.montant ? fmtMoney(s.montant) : '');
  var ligneContact;
  if(contact.etat === 'tel'){
    ligneContact = '<div style="font-family:'+F_MONO+';font-size:12px;color:'+C.ink+';padding-top:3px;">'
                 + esc(contact.texte)+'</div>';
  } else if(contact.etat === 'email-seul'){
    ligneContact = '<div style="font-family:'+F_MONO+';font-size:11px;color:'+C.muted+';padding-top:3px;">'
                 + 'ADRESSE SEULEMENT, DANS TON BUREAU</div>';
  } else {
    ligneContact = '<div style="font-family:'+F_MONO+';font-size:11px;color:'+C.danger+';padding-top:3px;">'
                 + 'SANS CONTACT</div>';
  }
  var gauche = '<div>'+esc(s.nom)+'</div>'
    + (detail ? '<div style="font-size:12px;color:'+C.muted+';padding-top:2px;">'+detail+'</div>' : '')
    + ligneContact;
  /* Le libelle ne sort JAMAIS sans son montant. Vu a la capture du 09/09/2026 :
     « panier habituel » s'affichait seul sur un client a zero, un intitule qui
     ne legende rien. Une case vide vaut mieux. */
  /* LE LIBELLE DU MONTANT N'EST PLUS SUR LA LIGNE, 09/09/2026. Il s'y repetait
     a l'identique sous chaque montant d'un meme groupe : « perdu cette annee »
     trois fois de suite, vu sur la capture. Dans un listing, un libelle repete
     a chaque ligne est du bruit. Il est monte dans la bande du motif, ou il est
     dit UNE fois. La regle de fond tient toujours : les montants ne sont pas de
     meme nature d'un motif a l'autre, donc chacun porte son libelle et rien
     n'est jamais additionne. Simplement, le porteur est le groupe. */
  var droite = (montant ? '<div style="font-weight:700;">'+esc(montant)+'</div>' : '');
  return ligne(pair, gauche, droite);
}

/* ======================= LES TOTAUX, EN BAS =======================
   Un listing finit par ses totaux, et c'est aussi pourquoi ce bloc est en bas :
   le mail est « ta journee », donc les actions d'abord. Le chiffre de
   l'exercice est du contexte, pas une action.

   AUCUNE IMAGE, ET CE N'EST PAS UN CHOIX DE STYLE. [Certain] Les messageries
   bloquent les images externes par defaut et Gmail supprime les images
   embarquees en `data:` : un graphique en image serait un rectangle vide a la
   premiere ouverture, pour la majorite des lecteurs. Tout est donc dessine en
   cases de tableau et en couleurs de fond, ce qui tient partout, Outlook
   compris. Ca tombe bien : une imprimante a bande dessinait ses histogrammes
   de la meme facon, en remplissant des cases. */

/* Une barre horizontale. `bgcolor` en attribut ET en style : Outlook ignore
   `background` sur une cellule dans certains contextes, il lit l'attribut. */
function barre(pct, couleur, hauteur){
  var p = Math.max(0, Math.min(100, Math.round(pct||0)));
  var h = hauteur || 10;
  var vide = 100 - p;
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
       + ' style="border-collapse:collapse;table-layout:fixed;">'
       + '<tr>'
       + (p > 0
         ? '<td width="'+p+'%" bgcolor="'+couleur+'" style="width:'+p+'%;background:'+couleur+';'
           + 'height:'+h+'px;font-size:0;line-height:0;">&nbsp;</td>'
         : '')
       + (vide > 0
         ? '<td width="'+vide+'%" bgcolor="'+C.paperDeep+'" style="width:'+vide+'%;background:'+C.paperDeep+';'
           + 'height:'+h+'px;font-size:0;line-height:0;">&nbsp;</td>'
         : '')
       + '</tr></table>';
}

function menu(txt){
  return '<div style="font-family:'+F_MONO+';font-size:10px;letter-spacing:0.06em;'
       + 'text-transform:uppercase;color:'+C.muted+';padding:6px 0 2px 0;">'+esc(txt)+'</div>';
}

/* LA JAUGE. Elle ne se dessine QUE s'il y a un objectif : sans lui, une barre
   n'a pas d'echelle, et une barre sans echelle ne dit rien. Dans ce cas on
   n'affiche que le chiffre et sa variation, ce qui est deja quelque chose. */
function jauge(r){
  if(!r || r.ca == null) return '';
  var dedans = '';
  var variation = '';
  if(r.variation != null){
    var signe = r.variation > 0 ? '+' : '';
    var coul  = r.variation < 0 ? C.danger : C.ink;
    variation = '<span style="color:'+coul+';">'+esc(signe+fmtNum(r.variation,1)+' %')+'</span>'
              + (r.variationEuros != null
                ? '<span style="color:'+C.muted+';"> ('+esc((r.variationEuros>0?'+':'')+fmtMoney(r.variationEuros))+')</span>'
                : '');
  }
  dedans += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
         +  ' style="border-collapse:collapse;"><tr>'
         +  '<td style="font-family:'+F_MONO+';font-size:19px;color:'+C.ink+';">'+esc(fmtMoney(r.ca))+'</td>'
         +  '<td align="right" style="font-family:'+F_MONO+';font-size:12px;white-space:nowrap;">'+variation+'</td>'
         +  '</tr></table>';

  if(r.objectif){
    var pctFait = r.objectifPct != null ? r.objectifPct : Math.round(r.ca / r.objectif * 100);
    dedans += menu('réalisé, '+fmtNum(pctFait,0)+' % de l\'objectif');
    dedans += barre(pctFait, C.bordeaux, 12);
    /* L'ATTERRISSAGE EST UNE PROJECTION, ET LA BARRE DOIT LE DIRE. Deux barres
       et pas une : la premiere est un FAIT, la seconde une estimation. Les
       superposer, ou n'en faire qu'une, ferait lire la projection comme un
       acquis. Le libelle porte le mot « estime », la couleur est plus pale. */
    if(r.atterrissage != null){
      var pctAtt = Math.round(r.atterrissage / r.objectif * 100);
      dedans += menu('atterrissage estimé, '+fmtMoney(r.atterrissage)+', soit '+fmtNum(pctAtt,0)+' %');
      dedans += barre(pctAtt, C.cork, 8);
    }
    dedans += '<div style="font-family:'+F_MONO+';font-size:10px;color:'+C.muted+';padding-top:6px;">'
           +  esc('la barre pleine vaut ton objectif, '+fmtMoney(r.objectif))+'</div>';
  } else {
    dedans += '<div style="font-family:'+F_MONO+';font-size:10px;color:'+C.muted+';padding-top:4px;">'
           +  'Pas d\'objectif posé : pose-le dans tes réglages et cette ligne devient une jauge.</div>';
  }
  return dedans;
}

/* L'HISTOGRAMME DES DOUZE MOIS DE L'EXERCICE.
   `mois` est deja dans l'ordre de l'exercice et pas de l'annee civile : un
   domaine qui ouvre en avril a avril en premiere case. `moisDebut` sert a
   ecrire les initiales dans le bon ordre.

   UN MOIS A VENIR N'EST PAS UN MOIS A ZERO, et c'est tout l'objet de
   `dernierMois`. Sans lui, les deux se dessinent pareil, une barre absente, et
   le mail ferait lire « aucune vente en mars » d'un mois qui n'est pas arrive.
   Les mois a venir portent donc un fond, pas une barre, et l'initiale palie. */
function histogramme(r){
  if(!r || !r.mois || !r.mois.length) return '';
  var mois = r.mois, debut = r.moisDebut || 1, dernier = r.dernierMois || mois.length;
  var max = 0, total = 0, iMax = 0;
  mois.forEach(function(v,i){ total += v||0; if((v||0) > max){ max = v||0; iMax = i; } });
  if(max <= 0) return '';
  var H = 46;
  var cases = '', etiq = '';
  /* TROIS ETATS ET PAS DEUX, correction vue a la capture du 09/09/2026.
     Un mois ECOULE A ZERO et un mois A VENIR se dessinaient pareil, un trait
     de deux pixels : le mail faisait lire « rien vendu » d'un mois qui n'est
     pas arrive, et inversement. C'est le meme piege qu'« en cours n'est pas en
     retard », et il coute la meme chose.
       a venir ......... aucune marque, initiale palie
       ecoule a zero ... un trait de 2 px en --muted, initiale normale
       ecoule vendu .... la barre, --cork, et --bordeaux sur le plus haut mois
     Les trois se distinguent sans legende, et la legende le redit quand meme. */
  mois.forEach(function(v,i){
    var aVenir = (i+1) > dernier;
    var val = v || 0;
    var h, couleur, marque;
    if(aVenir){ marque = false; h = 0; couleur = ''; }
    else if(val <= 0){ marque = true; h = 2; couleur = C.muted; }
    else { marque = true; h = Math.max(3, Math.round(val / max * H)); couleur = (i === iMax) ? C.bordeaux : C.cork; }
    cases += '<td width="8.33%" valign="bottom" align="center"'
          +  ' style="width:8.33%;padding:0 2px;">'
          +  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
          +  ' style="border-collapse:collapse;"><tr>'
          +  '<td style="height:'+(H-h)+'px;font-size:0;line-height:0;">&nbsp;</td></tr>'
          +  (marque
            ? '<tr><td bgcolor="'+couleur+'" style="height:'+h+'px;background:'+couleur+';font-size:0;line-height:0;">&nbsp;</td></tr>'
            : '')
          +  '</table></td>';
    /* LES ABREVIATIONS DU SITE, PAS UNE TRONCATURE. Les initiales seules
       donnaient « A M J J A S » sur un exercice ouvrant en avril : deux A,
       deux J. Couper a trois lettres donnait « JUI » pour juin ET juillet.
       MOIS_COURT reprend les abreviations de `MOIS_FR` dans bdv-base.js, donc
       celles que le site emploie deja. Elles tiennent dans la colonne :
       8,33 % de 560 px font 46 px, quatre caracteres de Courier a 9 px en
       font 22. */
    var m = ((debut - 1 + i) % 12);
    etiq += '<td width="8.33%" align="center" style="width:8.33%;font-family:'+F_MONO+';font-size:9px;'
         +  'letter-spacing:0.04em;padding:3px 0 0 0;color:'+(aVenir ? C.paperDeep : C.muted)+';">'
         +  esc(MOIS_COURT[m])+'</td>';
  });
  /* D'OU VIENT L'ECHELLE. Un histogramme sans echelle ne dit rien : deux
     barres de meme hauteur sur deux mails differents ne valent pas la meme
     chose. La legende donne le plus haut mois, qui EST la hauteur de la barre
     la plus grande, et le total. */
  var legende = 'le plus haut mois, ' + MOIS_FR[(debut - 1 + iMax) % 12] + ', vaut '
              + fmtMoney(max) + '. Total de l\'exercice, ' + fmtMoney(total) + '.'
              + (dernier < mois.length ? ' Les mois à venir sont vides.' : '');
  return menu('le chiffre d\'affaires, mois par mois')
       + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
       + ' style="border-collapse:collapse;table-layout:fixed;">'
       + '<tr>'+cases+'</tr><tr>'+etiq+'</tr></table>'
       + '<div style="font-family:'+F_MONO+';font-size:10px;line-height:1.5;color:'+C.muted+';'
       + 'padding-top:6px;">'+esc(legende)+'</div>';
}

function bouton(url, libelle){
  return ''
  + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">'
  + '<tr><td bgcolor="'+C.bordeaux+'" style="background-color:'+C.bordeaux+';">'
  +   '<a href="'+esc(url)+'" style="display:inline-block;padding:11px 20px;font-family:'+F_MONO+';'
  +     'font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:'+C.onDark+';'
  +     'text-decoration:none;">'+esc(libelle)+'</a>'
  + '</td></tr></table>';
}

/* ======================= L'ASSEMBLAGE ======================= */

function batir(d){
  d = d || {};
  var urlBureau = d.urlBureau || 'https://lebureauduvigneron.fr/mon-bureau/';
  var jAuj      = jour(d.aujourdhui) || jour(new Date().toISOString().slice(0,10));
  var file      = d.file_travail || {};
  var annuaire  = file.noms || {};
  var resume    = d.resume_ventes || {};
  var suivis    = d.suivis || [];
  var taches    = d.taches || [];
  var jDepot    = jour(String(d.depose_le||'').slice(0,10));
  var ageDepot  = jDepot ? (jAuj.n - jDepot.n) : null;
  var perime    = (ageDepot == null) || (ageDepot > PEREMPTION_J);

  var journee  = trierAFaire(suivis, taches, annuaire, jAuj);
  var tousSig  = perime ? [] : ecarterLesSuivis(file.signaux, suivis);
  var signaux  = tousSig.slice(0, MAX_SIGNAUX);
  var reste    = tousSig.length - signaux.length;
  var conseils = (resume.conseils || []).filter(function(c){ return c && c.verdict; }).slice(0, MAX_CONSEILS);

  var compteurs = {
    echus:    journee.echus.length,
    venir:    journee.venir.length,
    signaux:  signaux.length,
    reste:    reste,
    conseils: conseils.length,
    ageDepot: ageDepot,
    perime:   perime
  };
  /* Le mail est VIDE quand il n'a rien de neuf a dire. Il ne decide pas de ne
     pas partir : l'appelant tranche. */
  var vide = (compteurs.echus + compteurs.venir + tousSig.length) === 0;

  /* ---- LE SUJET ----
     LE NOMBRE ANNONCE EST CELUI QU'ON MONTRE, correction du 09/09/2026. La
     premiere version annoncait le total depose : `fileSignaux()` plafonnant a
     quarante, le sujet disait « 40 clients a voir » presque tous les matins.
     Un nombre qui ne bouge jamais n'informe pas, et promettre quarante pour en
     montrer huit fait douter du reste. */
  var bouts = [];
  if(compteurs.echus)   bouts.push(compteurs.echus+' à faire');
  if(compteurs.signaux) bouts.push(plur(compteurs.signaux,'client')+' à voir');
  if(!bouts.length && compteurs.venir) bouts.push(plur(compteurs.venir,'échéance')+' cette semaine');
  var sujet = 'Ton bureau, '+fmtJourLong(jAuj)+' : '+(bouts.length ? bouts.join(', ') : 'rien à faire ce matin');

  /* ---- LE CORPS ---- */
  var corps = '';

  if(compteurs.echus){
    corps += bande('Ce matin', compteurs.echus+' ligne'+(compteurs.echus>1?'s':''));
    corps += journee.echus.map(function(o,i){ return ligneAFaire(o, i%2===1); }).join('');
  }
  if(compteurs.venir){
    corps += bande('Les jours qui viennent', '');
    corps += journee.venir.map(function(o,i){ return ligneAFaire(o, i%2===1); }).join('');
  }

  if(signaux.length){
    corps += bande('Ta file de travail',
                   reste > 0 ? (signaux.length+' sur '+tousSig.length) : String(tousSig.length));
    /* ON GROUPE D'ABORD, ON DESSINE ENSUITE, et c'est une correction du
       09/09/2026 trouvee par le controle 6 de l'apercu. En dessinant au fil des
       lignes, le libelle de la bande etait celui du PREMIER signal du groupe :
       si ce premier-la portait un montant a zero, la bande annoncait
       « panier habituel » alors qu'aucune ligne du groupe ne montrait de
       montant. C'est exactement le defaut du 09/09 au matin, remonte d'un cran
       en le deplacant. La regle ne bouge pas : un libelle ne sort JAMAIS sans
       le chiffre qu'il legende. Ici, le chiffre est celui du groupe. */
    var groupes = [], parMotif = {};
    signaux.forEach(function(s){
      var k = s.motif || '';
      if(!parMotif[k]){ parMotif[k] = { motif:k, lignes:[] }; groupes.push(parMotif[k]); }
      parMotif[k].lignes.push(s);
    });
    var pair = false;
    groupes.forEach(function(g){
      /* Le libelle du groupe est celui du premier signal QUI PORTE un montant.
         Aucun montant dans le groupe, aucun libelle sur la bande. */
      var porteur = g.lignes.filter(function(s){ return s.montant; })[0];
      var libGroupe = porteur ? sansBalise(porteur.lib).trim() : '';
      corps += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
            + ' style="border-collapse:collapse;background-color:'+C.paperDeep+';"><tr>'
            + TROU
            + '<td bgcolor="'+C.paperDeep+'" style="background-color:'+C.paperDeep+';'
            + 'padding:4px 10px;font-family:'+F_MONO+';font-size:10px;'
            + 'letter-spacing:0.10em;text-transform:uppercase;color:'+C.muted+';">'
            + esc(titreMotif(g.motif))+'</td>'
            + (libGroupe
              ? '<td align="right" bgcolor="'+C.paperDeep+'"'
                + ' style="background-color:'+C.paperDeep+';padding:4px 10px;font-family:'+F_MONO+';font-size:10px;'
                + 'letter-spacing:0.10em;text-transform:uppercase;color:'+C.muted+';white-space:nowrap;">'
                + esc(libGroupe)+'</td>'
              : '')
            + TROU
            + '</tr></table>';
      g.lignes.forEach(function(s){ corps += ligneSignal(s, pair); pair = !pair; });
    });
    var pied = [];
    if(reste > 0) pied.push('Et '+plur(reste,'autre')+' dans ton bureau.');
    /* D'OU VIENT LE CHIFFRE : ces lignes datent du dernier import, pas de ce
       matin, et le mail le dit. */
    pied.push('Calculée à ton dernier import, le '+fmtJourCourt(jDepot)
              + (ageDepot > 7 ? ', il y a '+plur(ageDepot,'jour') : '')+'.');
    corps += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
          + ' style="border-collapse:collapse;"><tr><td style="padding:8px 28px;font-family:'+F_MONO+';'
          + 'font-size:11px;line-height:1.5;color:'+C.muted+';">'+esc(pied.join(' '))+'</td></tr></table>';
    /* padding 8px 28px : les 10 px de la ligne, plus les 18 px de l'encart. */
  } else if(perime && (file.signaux||[]).length){
    corps += bande('Ta file de travail', 'périmée');
    corps += ligne(false,
        '<div style="font-size:13px;">Ta file n\'est plus affichée ici : elle a été calculée '
      + (jDepot ? 'le '+esc(fmtJourCourt(jDepot))+', il y a '+plur(ageDepot,'jour') : 'à une date inconnue')
      + '. Importe ton dernier export dans le bureau pour la rafraîchir.</div>', '');
  }

  if(conseils.length){
    corps += bande('Ce que dit ton tableau de bord', '');
    corps += conseils.map(function(c,i){
      return ligne(i%2===1,
        '<div>'+htmlLimite(c.verdict)+'</div>'
        + (c.action ? '<div style="font-size:12px;color:'+C.muted+';padding-top:3px;">'+htmlLimite(c.action)+'</div>' : ''),
        '');
    }).join('');
  }

  if(vide){
    corps += bande('Rien ce matin', '');
    corps += ligne(false, '<div>Aucune tâche échue, aucun rappel, aucun client signalé. Profites-en.</div>', '');
  }

  /* ---- LES TOTAUX. Ils ne partent QUE si le resume porte un chiffre : un
     depot d'avant le 09/09/2026 n'a pas de serie mensuelle, et le mail doit
     s'en passer sans rien casser jusqu'au prochain import. ---- */
  var totaux = '';
  var laJauge = jauge(resume), lHisto = histogramme(resume);
  if(laJauge || lHisto){
    totaux = bande('Ton exercice', resume.exercice || '')
           + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
           + ' style="border-collapse:collapse;background:'+C.paperLight+';"><tr>'
           + '<td style="padding:10px 28px;border-bottom:1px solid '+C.filet+';">'
           + laJauge
           + (laJauge && lHisto ? '<div style="height:14px;font-size:0;line-height:0;">&nbsp;</div>' : '')
           + lHisto
           + '</td></tr></table>';
  }

  /* ---- L'ENVELOPPE : LE PAPIER CONTINU ----
     Les picots sont un fond du CONTENEUR et pas un element par ligne : leur pas
     est fixe, 26 px, independant de la hauteur des lignes, comme sur du vrai
     papier a picots. Recette reprise de `.listbb` dans style.css.
     [Certain] Outlook ignore les degrades et n'affichera que du papier nu. Les
     deux filets de perforation, eux, sont de vraies bordures et tiennent
     partout : meme sans les trous, la bande se lit. */
  /* Plus de degrade : les trous sont des cellules, voir TROU plus haut. Ce qui
     reste ici, c'est la couleur du papier, et elle tient partout. */
  var picots = 'background-color:'+C.paperLight+';';

  var html = ''
  + '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">'
  + '<title>'+esc(sujet)+'</title></head>'
  /* PLUS DE MARGES, 09/09/2026, demande de Ted. Le fond de la page EST le
     papier : il n'y a plus de bande de couleur autour de la feuille, donc plus
     rien qui ressemble a une carte posee sur un plateau. Les deux filets de
     perforation restent : ce ne sont pas des marges, c'est le bord du papier.

     REPRIS LE 10/09/2026, apres le premier vrai mail dans une vraie boite.
     « Occupe toute la largeur » avait ete lu comme « le TABLEAU fait 100 % ».
     Dans un Gmail ouvert en grand, le courrier s'est etale sur 1800 px : les
     montants a un metre des noms, l'histogramme etire, illisible. Et personne
     ne l'avait vu, parce que l'apercu enferme chaque mail dans un cadre etroit
     -- on validait un dessin qu'on n'a jamais recu.

     Ce qui occupe toute la largeur, c'est le FOND, pose sur le body. Le papier,
     lui, tient dans la colonne de 560 px pour laquelle il a ete dessine (voir
     l'arithmetique de l'histogramme, 8,33 % de 560 px). Rien ne flotte : la
     couleur autour de la feuille est la meme que la feuille. La regle de Ted
     est tenue, le dessin redevient celui des captures. */
  + '<body style="margin:0;padding:0;background:'+C.paperLight+';">'
  /* Le pre-en-tete : la ligne que la messagerie affiche a cote du sujet. Sans
     elle, elle affiche le premier texte trouve. */
  + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'+esc(sujet)+'</div>'
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
  +   ' style="border-collapse:collapse;background:'+C.paperLight+';">'
  + '<tr><td align="center" style="padding:0;">'

  /* Le papier, avec ses picots et ses deux filets de perforation. */
  /* `width="560"` en ATTRIBUT pour Outlook, qui ignore max-width, et
     `width:100%;max-width:560px` en style pour tous les autres : sur un
     telephone de 390 px la colonne se retracte au lieu de deborder. Les deux
     ensemble, jamais l'un sans l'autre. */
  + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"'
  +   ' style="border-collapse:collapse;width:100%;max-width:560px;'+picots+'">'
  /* L'ENCART DE 18 PX N'EST PLUS ICI. Il etait sur cette cellule, donc les
     trous, qui doivent tomber DANS cet encart, etaient hors d'atteinte des
     lignes. Chaque bloc porte desormais son propre encart : les lignes du
     listing par une cellule-trou de 18 px, les autres par leur padding. Si un
     bloc futur oublie l'un ou l'autre, il touchera les filets de perforation --
     et ca se voit tout de suite. */
  + '<tr><td style="padding:0;border-left:1px solid '+C.filet+';border-right:1px solid '+C.filet+';">'

  /* L'en-tete du listing : une ligne d'imprimante, pas un titre de revue. */
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
  +   ' style="border-collapse:collapse;"><tr>'
  + '<td style="padding:16px 0 4px 18px;font-family:'+F_MONO+';font-size:12px;letter-spacing:0.14em;'
  +   'text-transform:uppercase;color:'+C.bordeaux+';">Le Bureau du Vigneron</td>'
  + '<td align="right" style="padding:16px 18px 4px 0;font-family:'+F_MONO+';font-size:11px;'
  +   'color:'+C.muted+';white-space:nowrap;">'+esc(fmtJourLong(jAuj))+'</td>'
  + '</tr></table>'
  + '<div style="border-top:2px solid '+C.ink+';font-size:0;line-height:0;margin:0 18px 14px 18px;">&nbsp;</div>'

  + corps

  + totaux
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
  +   ' style="border-collapse:collapse;"><tr><td style="padding:20px 18px 4px 18px;">'
  + bouton(urlBureau,'Ouvrir mon bureau')
  + '</td></tr></table>'

  + '<div style="border-top:1px solid '+C.filet+';margin:16px 18px 0 18px;padding:12px 0 18px 0;'
  +   'font-family:'+F_MONO+';font-size:10px;line-height:1.6;color:'+C.muted+';">'
  +   'Tu reçois ce courrier parce que tu l\'as demandé dans les réglages de ton bureau.'
  +   (d.urlDesinscription
      ? ' <a href="'+esc(d.urlDesinscription)+'" style="color:'+C.muted+';">Ne plus le recevoir</a>.'
      : '')
  +   '<br>Le Bureau du Vigneron, un service Solumatic.'
  + '</div>'

  + '</td></tr></table>'
  + '</td></tr></table></body></html>';

  /* ---- LA VERSION TEXTE ----
     Pas decorative : un mail sans partie texte part plus souvent dans les
     indesirables, et c'est la seule version lisible dans un terminal. Elle
     porte la meme colonne de droite, alignee a la main : c'est du listing, le
     texte brut est son terrain naturel. */
  function colonne(gauche, droite){
    var g = String(gauche);
    if(!droite) return g;
    var large = 58;
    if(g.length > large) return g+'  '+droite;
    return g + ' '.repeat(large - g.length) + ' ' + droite;
  }
  var t = [];
  t.push(sujet);
  t.push('='.repeat(70), '');
  if(compteurs.echus){
    t.push('CE MATIN');
    journee.echus.forEach(function(o){
      t.push(colonne('  '+o.titre, o.encours ? 'EN COURS' : fmtJ(o.ecart)));
      if(o.meta.length) t.push('    '+o.meta.join('  ·  '));
      if(o.note)        t.push('    '+o.note);
    });
    t.push('');
  }
  if(compteurs.venir){
    t.push('LES JOURS QUI VIENNENT');
    journee.venir.forEach(function(o){
      t.push(colonne('  '+o.titre, fmtJ(o.ecart)));
      if(o.meta.length) t.push('    '+o.meta.join('  ·  '));
    });
    t.push('');
  }
  if(signaux.length){
    t.push('TA FILE DE TRAVAIL'+(reste>0 ? '  ('+signaux.length+' sur '+tousSig.length+')' : ''));
    var groupesT = [], parMotifT = {};
    signaux.forEach(function(s){
      var k = s.motif || '';
      if(!parMotifT[k]){ parMotifT[k] = { motif:k, lignes:[] }; groupesT.push(parMotifT[k]); }
      parMotifT[k].lignes.push(s);
    });
    groupesT.forEach(function(g){
      var porteurT = g.lignes.filter(function(s){ return s.montant; })[0];
      var lg = porteurT ? sansBalise(porteurT.lib).trim() : '';
      t.push(colonne('  -- '+titreMotif(g.motif).toUpperCase(), lg ? lg.toUpperCase() : ''));
      g.lignes.forEach(function(s){
        t.push(colonne('  '+s.nom, s.montant ? fmtMoney(s.montant) : ''));
        var dd = sansBalise(s.detail).trim(); if(dd) t.push('    '+dd);
        var cc = contactUtile(sansBalise(s.contact));
        t.push('    '+(cc.etat === 'tel' ? cc.texte
                     : cc.etat === 'email-seul' ? 'adresse seulement, dans ton bureau'
                     : 'SANS CONTACT'));
      });
    });
    /* LA LIGNE OUBLIEE DANS LA PREMIERE VERSION. Le sujet annoncait quarante
       clients, le texte en listait huit, et rien ne disait ou etaient les
       trente-deux autres. La version HTML portait cette ligne, pas celle-ci. */
    if(reste > 0) t.push('  Et '+plur(reste,'autre')+' dans ton bureau.');
    t.push('  Calculée à ton dernier import, le '+fmtJourCourt(jDepot)+'.', '');
  }
  if(conseils.length){
    t.push('CE QUE DIT TON TABLEAU DE BORD');
    conseils.forEach(function(c){
      t.push('  '+sansBalise(c.verdict));
      if(c.action) t.push('    '+sansBalise(c.action));
    });
    t.push('');
  }
  if(vide) t.push('Aucune tâche échue, aucun rappel, aucun client signalé. Profites-en.', '');
  /* LES TOTAUX EN TEXTE. Les barres sont faites de caracteres, ce qui n'est pas
     un pis-aller : c'est exactement ce qu'une imprimante a bande dessinait. */
  if(resume && resume.ca != null){
    t.push('TON EXERCICE'+(resume.exercice ? '  '+resume.exercice : ''));
    t.push(colonne('  chiffre d\'affaires', fmtMoney(resume.ca)));
    if(resume.variation != null){
      t.push(colonne('  variation', (resume.variation>0?'+':'')+fmtNum(resume.variation,1)+' %'));
    }
    if(resume.objectif){
      var pf = resume.objectifPct != null ? resume.objectifPct : Math.round(resume.ca/resume.objectif*100);
      var n = Math.max(0, Math.min(40, Math.round(pf/100*40)));
      t.push('  objectif '+fmtMoney(resume.objectif));
      t.push('  ['+'#'.repeat(n)+'.'.repeat(40-n)+'] '+fmtNum(pf,0)+' % réalisé');
      if(resume.atterrissage != null){
        var pa = Math.round(resume.atterrissage/resume.objectif*100);
        var na = Math.max(0, Math.min(40, Math.round(pa/100*40)));
        t.push('  ['+'+'.repeat(na)+'.'.repeat(40-na)+'] '+fmtNum(pa,0)+' % atterrissage estimé');
      }
    }
    if(resume.mois && resume.mois.length){
      var mx = 0, tot = 0;
      resume.mois.forEach(function(v){ tot += v||0; if((v||0)>mx) mx = v||0; });
      if(mx > 0){
        var deb = resume.moisDebut || 1, der = resume.dernierMois || resume.mois.length;
        t.push('', '  LE CHIFFRE D\'AFFAIRES, MOIS PAR MOIS');
        resume.mois.forEach(function(v,i){
          var nom = MOIS_COURT[(deb - 1 + i) % 12];
          var aVenir = (i+1) > der;
          var val = v || 0;
          var larg = (aVenir || val <= 0) ? 0 : Math.max(1, Math.round(val/mx*30));
          t.push('  '+nom.padEnd(5)+' |'+'#'.repeat(larg)
                 +(aVenir ? ' (à venir)' : val <= 0 ? ' rien vendu' : ' '+fmtMoney(val)));
        });
        t.push('  Le plus haut mois vaut '+fmtMoney(mx)+'. Total '+fmtMoney(tot)+'.');
      }
    }
    t.push('');
  }
  t.push('-'.repeat(70));
  t.push('Ouvrir mon bureau : '+urlBureau);

  return { sujet:sujet, html:html, texte:t.join('\n'), vide:vide, compteurs:compteurs };
}

/* ---- LES TROIS MONDES ----
   Navigateur : la balise script pose BdvCourrier sur window.
   Node : l'apercu fait un require() de ce fichier.
   Deno : globalThis.BdvCourrier apres l'import du fichier joint.
   Ne pas remplacer ce bloc par un `export` : il fermerait les deux autres. */
var api = { batir:batir, PEREMPTION_J:PEREMPTION_J, HORIZON_J:HORIZON_J,
            MAX_SIGNAUX:MAX_SIGNAUX, MAX_CONSEILS:MAX_CONSEILS,
            CACHER_LES_EMAILS:CACHER_LES_EMAILS,
            _outils:{ jour:jour, fmtMoney:fmtMoney, htmlLimite:htmlLimite, fmtJ:fmtJ,
                      contactUtile:contactUtile,
                      normTache:normTache, normRappel:normRappel, trierAFaire:trierAFaire } };
racine.BdvCourrier = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
