/* ============================================================================
   bdv-courrier.js  LE COURRIER DU MATIN
   ============================================================================
   Ce fichier FABRIQUE le mail quotidien, et rien d'autre. Il ne lit aucune
   base, il n'envoie rien, il ne connait ni Supabase ni Resend. On lui donne
   les donnees d'un compte, il rend un sujet, un HTML et un texte.

   POURQUOI CETTE FORME, et c'est la seule decision d'architecture du lot 1.
   Au lot 3 ce fichier tournera dans une fonction Edge, cote serveur, sans
   navigateur. Toute lecture reseau ecrite ici obligerait a en tenir DEUX
   versions, une pour l'apercu et une pour l'envoi, qui divergeraient au
   premier changement de contenu. La regle est deja ecrite pour le CRM dans
   CLAUDE.md : le calcul est a UN endroit, et ce qui l'entoure change.

   Il tourne donc dans trois mondes sans etre modifie : le navigateur (balise
   script), Node (l'apercu du lot 1) et Deno (la fonction Edge du lot 3).
   D'ou le bloc d'export en bas de fichier. Ne pas y introduire de `import`
   ni de `require` : ca fermerait deux des trois mondes.

   CE QU'IL PORTE, depuis le 09/09/2026 : les TACHES echues autant que les
   rappels. C'est un virage, decide avec Ted : le mail n'est plus « les
   clients a voir », c'est SA JOURNEE. Motif mesure : `suivi_clients` etait a
   zero ligne pendant que `taches` en portait treize, dont quatre posees dans
   l'heure. La matiere qui bouge vraiment d'un jour a l'autre, c'est celle-la.

   CE QU'IL NE FAIT PAS, VOLONTAIREMENT :
   - il ne decide pas s'il faut envoyer. Il le DIT (`vide`), l'appelant tranche.
   - il ne connait pas l'heure. On lui passe le jour, en texte.
   - il ne va pas chercher un nom de client ailleurs que dans l'annuaire recu.
   ============================================================================ */
(function(racine){
'use strict';

/* ---- LES COULEURS SONT ECRITES EN DUR ICI, ET C'EST LA SEULE EXCEPTION -----
   La charte du projet interdit d'ecrire une couleur ailleurs que dans les
   jetons. Un mail ne peut pas la respecter : `var(--bordeaux)` n'existe pas
   dans Outlook, et une feuille de style externe n'est pas chargee par la
   plupart des messageries. Tout doit etre en style de ligne, en valeur brute.

   La regle de remplacement : chaque valeur porte le NOM du jeton dont elle
   est copiee. Le jour ou un jeton change, on cherche son nom ici. Sans ces
   noms, cette liste devient un deuxieme nuancier orphelin.

   `--rule` est semi-transparent dans le site. Aplati ici sur `--paper`, parce
   qu'un rgba sur une bordure de tableau n'est pas fiable en messagerie :
   rgba(30,37,54,0.18) sur #EFE7D6 donne #C9C4B9. */
var C = {
  paper:      '#EFE7D6',  /* --paper */
  paperLight: '#F5EFE0',  /* --paper-light */
  paperDeep:  '#DACDAF',  /* --paper-deep */
  ink:        '#1E2536',  /* --ink */
  muted:      '#63523D',  /* --muted */
  bordeaux:   '#5A1525',  /* --bordeaux */
  bxDeep:     '#45101D',  /* --bordeaux-deep */
  filet:      '#C9C4B9',  /* --rule, aplati sur --paper */
  danger:     '#A03530',  /* --danger-deep, et pas --danger : 4,00:1 sur papier ne passe pas AA */
  onDark:     '#EFE7D6'   /* --on-dark */
};
/* Pas de Fraunces ni d'Inter : une messagerie ne charge pas de police web.
   Ce sont exactement les replis declares dans les jetons --font-titre et
   --font-corps, donc le mail tombe sur la deuxieme intention, pas au hasard. */
var F_TITRE = "Georgia,'Times New Roman',serif";
var F_CORPS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";

/* Au-dela de ce nombre de jours, on n'affiche plus les signaux du tableau de
   bord. [Supposition] 60 jours est un choix a regler a l'usage : un client
   detecte en recul il y a deux mois a soit ete traite, soit change de
   situation, et le repeter chaque matin est le defaut qui fait decrocher.
   Les rappels et les taches, eux, ne sont JAMAIS masques : ils sont lus en
   direct, ils ne peuvent pas etre perimes. */
var PEREMPTION_J = 60;
/* On ne deverse pas la file entiere dans un mail. Le mail ouvre le bureau. */
var MAX_SIGNAUX = 8;
var MAX_CONSEILS = 3;
/* Combien de jours a l'avance on annonce ce qui vient. Trois : au-dela, le
   vigneron lit une liste au lieu d'une journee. */
var HORIZON_J = 3;

/* ======================= PETITS OUTILS =======================
   Recopies de bdv-base.js et pas importes, parce que ce fichier doit tourner
   sans le moteur : cote serveur, bdv-base.js n'existe pas. Ce sont cinq
   fonctions de mise en forme sans aucune regle metier. La duplication qui
   compte, celle que le projet refuse, porte sur les calculs, pas sur un
   espace insecable dans un montant. Si l'une d'elles change dans le moteur,
   elle change ici : elles doivent afficher le meme chiffre a l'identique. */
var MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
var JOURS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

function esc(s){
  return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});
}
/* Les verdicts du tableau de bord portent deja du <b> et des <br>, et ils
   peuvent contenir un nom de client, donc du texte venu du fichier du
   vigneron. On echappe TOUT, puis on rend ses balises a la mise en forme,
   et a elle seule. Inserer ces chaines brutes marcherait aujourd'hui et
   casserait le mail le jour ou un nom de domaine contient un chevron. */
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

/* Une date au format AAAA-MM-JJ, sans passer par l'objet Date : entre minuit
   et 2 h en France, un new Date() sur une chaine nue est lu en UTC et rend la
   veille. Le meme piege est deja documente pour les rappels dans bdv-crm.js. */
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

/* ======================= CE QUE LE MAIL RACONTE ======================= */

/* Les trois motifs de la file, en clair. Les cles viennent des moteurs du
   tableau de bord ; un motif inconnu ne fait pas tomber le mail, il s'affiche
   tel quel. Un mail qui refuse de partir parce qu'un libelle manque est pire
   qu'un mail avec un libelle brut. */
var TITRES_MOTIF = {
  recul:   'Ils achetaient, ils achètent moins',
  cadence: 'Ils ont dépassé leur rythme',
  unique:  'Venus une seule fois'
};
function titreMotif(k){ return TITRES_MOTIF[k] || ('Signalés : '+String(k||'sans motif')); }

/* LE FILTRE QUI DISPARAIT AU LOT 2.
   fileSignaux() ecarte deja les clients suivis, mais il le fait au moment du
   DEPOT, dans le navigateur. Un rappel pose depuis le telephone le lendemain
   ne ressort pas du depot de la veille : sans ce deuxieme passage, le mail
   nommerait un client deja traite, ce qui est la faute la plus couteuse que
   cet outil puisse commettre.
   AU LOT 2 cette regle passe dans une vue Postgres et CETTE FONCTION EST
   SUPPRIMEE. Elle ne doit pas survivre a la vue : deux endroits qui repondent
   « ce client est-il encore a voir » se contrediront au premier geste. */
function ecarterLesSuivis(signaux, suivis){
  var vus = {};
  (suivis||[]).forEach(function(s){
    if(s && s.client_id && (s.rappel || s.statut==='traite')) vus[s.client_id] = true;
  });
  return (signaux||[]).filter(function(s){ return s && !vus[s.id]; });
}

/* Le nom d'un client suivi ne se trouve pas dans les signaux : il en est sorti
   par construction. Il vient de l'annuaire depose a cote de la file. Sans lui,
   le mail afficherait un numero client Vitisoft brut. */
function nomDe(annuaire, id){
  var n = annuaire && annuaire[id];
  if(typeof n === 'string' && n.trim()) return n.trim();
  if(n && typeof n === 'object' && n.nom) return String(n.nom);
  return String(id||'');
}

/* ---- UNE SEULE FORME POUR CE QUI TOMBE AUJOURD'HUI ----
   Un rappel client et une tache sont deux choses differentes en base, et la
   MEME chose pour le vigneron a 8 h du matin : quelque chose qui lui tombe
   dessus. Les deux sont donc normalisees vers une seule forme, et une seule
   fonction les dessine. Deux dessinateurs auraient diverge au premier
   ajustement, exactement comme les neuf listes de canaux avant
   bdv-canaux.js. */
function normRappel(s, annuaire, jAuj){
  if(!s || !s.rappel || s.statut === 'traite') return null;
  var jr = jour(s.rappel);
  if(!jr) return null;
  var meta = [];
  if(s.canal) meta.push('prévu : '+s.canal);
  meta.push('rappel du '+fmtJourCourt(jr));
  return { type:'rappel', titre:nomDe(annuaire, s.client_id), jour:jr,
           ecart:jAuj.n - jr.n, encours:false, meta:meta,
           note:sansBalise(s.notes).trim() };
}
/* DEUX REGLES ICI, ET AUCUNE DES DEUX N'EST COSMETIQUE.

   1. UNE TACHE SANS DATE N'ENTRE JAMAIS DANS LE COURRIER. Le mail dit ce qui
      tombe aujourd'hui. Une tache qu'on n'a pas datee n'a, par definition,
      aucune raison de tomber ce matin plutot qu'un autre : la faire
      apparaitre chaque jour est precisement le defaut qui fait decrocher un
      lecteur en dix jours. Elle reste dans le bureau, ou elle est a sa place.

   2. EN COURS N'EST PAS EN RETARD. Une tache qui porte une date de fin et
      qui court encore n'est pas en retard, et l'annoncer en rouge est la meme
      faute que nommer un client deja traite : le mail perd sa credibilite
      d'un seul coup, et on ne la regagne pas. */
function normTache(t, jAuj){
  if(!t || t.fait_le) return null;      /* deja faite : elle n'a plus rien a dire */
  var jd = jour(t.echue_le);
  if(!jd) return null;                  /* sans date : jamais dans le courrier */
  var jf = jour(t.fin_le);
  var encours = !!(jf && jf.n >= jAuj.n && jd.n <= jAuj.n);
  var meta = [];
  if(t.source === 'echeance') meta.push('échéance du métier');
  meta.push(jf ? ('du '+fmtJourCourt(jd)+' au '+fmtJourCourt(jf))
               : ('à faire le '+fmtJourCourt(jd)));
  return { type:'tache', titre:String(t.titre||'(sans titre)'), jour:jd,
           ecart:jAuj.n - jd.n, encours:encours, meta:meta, note:'' };
}

/* Les deux piles de la journee, rappels et taches melanges. Melanges et pas
   separes, et c'est voulu : le vigneron ne trie pas sa matinee par table de
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

/* ======================= LES BRIQUES HTML =======================
   Tout en tableaux et en styles de ligne. Aucune classe, aucune feuille :
   Gmail retire les balises style dans certains contextes, et Outlook ignore
   la moitie de ce qui reste. Aucun rayon de bordure, aucune ombre : c'est la
   charte du site, et ca tombe bien, les messageries les rendent mal. */

function bloc(titre, contenuHtml){
  return ''
  + '<tr><td style="padding:22px 24px 0 24px;">'
  +   '<div style="font-family:'+F_TITRE+';font-size:17px;line-height:1.25;color:'+C.bordeaux+';margin:0 0 3px 0;">'+esc(titre)+'</div>'
  +   '<div style="height:2px;background:'+C.bordeaux+';width:38px;font-size:0;line-height:0;">&nbsp;</div>'
  + '</td></tr>'
  + '<tr><td style="padding:12px 24px 0 24px;font-family:'+F_CORPS+';font-size:15px;line-height:1.55;color:'+C.ink+';">'
  +   contenuHtml
  + '</td></tr>';
}

/* Une ligne de la journee, rappel ou tache. Le QUAND compte plus que le
   titre : c'est lui qui dit pourquoi cette ligne est la ce matin. */
function ligneAFaire(o){
  var quand;
  if(o.encours)        quand = '<span style="color:'+C.muted+';">en cours</span>';
  else if(o.ecart > 0) quand = '<span style="color:'+C.danger+';font-weight:600;">'+esc(fmtRetard(o.ecart))+'</span>';
  else if(o.ecart===0) quand = '<span style="font-weight:600;">'+esc(fmtRetard(o.ecart))+'</span>';
  else                 quand = '<span style="color:'+C.muted+';">'+esc(fmtRetard(o.ecart))+'</span>';
  return ''
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
  +   ' style="border-collapse:collapse;border-bottom:1px solid '+C.filet+';">'
  + '<tr><td style="padding:9px 0;font-family:'+F_CORPS+';font-size:15px;line-height:1.45;color:'+C.ink+';">'
  +   '<div><strong style="font-weight:600;">'+esc(o.titre)+'</strong> &nbsp;'+quand+'</div>'
  +   (o.meta.length ? '<div style="font-size:12px;color:'+C.muted+';padding-top:2px;">'+esc(o.meta.join(' · '))+'</div>' : '')
  +   (o.note ? '<div style="font-size:13px;color:'+C.ink+';padding-top:5px;font-style:italic;">'+esc(o.note)+'</div>' : '')
  + '</td></tr></table>';
}

/* Une ligne de signal. Le montant a sa propre colonne, alignee a droite : les
   montants ne sont pas de meme nature d'un motif a l'autre, donc chacun porte
   son libelle et rien n'est jamais additionne. Meme regle qu'a l'ecran. */
function ligneSignal(s){
  var lib = sansBalise(s.lib).trim();
  var detail = htmlLimite(s.detail||'').trim();
  var contact = sansBalise(s.contact).trim();
  var montant = (s.montant ? fmtMoney(s.montant) : '');
  return ''
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
  +   ' style="border-collapse:collapse;border-bottom:1px solid '+C.filet+';">'
  + '<tr>'
  +   '<td style="padding:9px 0;font-family:'+F_CORPS+';font-size:15px;line-height:1.45;color:'+C.ink+';">'
  +     '<div><strong style="font-weight:600;">'+esc(s.nom)+'</strong></div>'
  +     (detail  ? '<div style="font-size:13px;color:'+C.ink+';padding-top:3px;">'+detail+'</div>' : '')
  +     (contact ? '<div style="font-size:12px;color:'+C.muted+';padding-top:3px;">'+esc(contact)+'</div>'
                 : '<div style="font-size:12px;color:'+C.danger+';padding-top:3px;">Aucun contact enregistré.</div>')
  +   '</td>'
  +   '<td width="110" style="padding:9px 0 9px 10px;text-align:right;vertical-align:top;'
  +     'font-family:'+F_CORPS+';font-size:15px;line-height:1.45;color:'+C.ink+';white-space:nowrap;">'
  +     (montant ? '<div style="font-weight:600;">'+esc(montant)+'</div>' : '')
  /* Le libelle ne sort JAMAIS sans son montant. Vu a la capture du 09/09/2026 :
     « panier habituel » s'affichait seul sur un client a zero, un intitule qui ne
     legende rien. C'est la regle « un chiffre dit d'ou il vient » prise a l'envers,
     et une case vide vaut mieux. */
  +     (montant && lib ? '<div style="font-size:11px;color:'+C.muted+';">'+esc(lib)+'</div>' : '')
  +   '</td>'
  + '</tr></table>';
}

function bouton(url, libelle){
  return ''
  + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">'
  + '<tr><td style="background:'+C.bordeaux+';">'
  +   '<a href="'+esc(url)+'" style="display:inline-block;padding:12px 22px;font-family:'+F_CORPS+';'
  +     'font-size:15px;font-weight:600;color:'+C.onDark+';text-decoration:none;">'+esc(libelle)+'</a>'
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
  var signaux  = perime ? [] : ecarterLesSuivis(file.signaux, suivis);
  var conseils = (resume.conseils || []).filter(function(c){ return c && c.verdict; }).slice(0, MAX_CONSEILS);

  var compteurs = {
    echus:    journee.echus.length,
    venir:    journee.venir.length,
    signaux:  signaux.length,
    conseils: conseils.length,
    ageDepot: ageDepot,
    perime:   perime
  };
  /* Le mail est VIDE quand il n'a rien de neuf a dire. Il ne decide pas de ne
     pas partir : l'appelant tranche. Un conseil de diagnostic seul ne suffit
     pas a justifier un mail quotidien, il ne bouge pas d'un jour a l'autre. */
  var vide = (compteurs.echus + compteurs.venir + compteurs.signaux) === 0;

  /* ---- LE SUJET. Il doit dire ce qu'il y a dedans, sinon il ne sert qu'a
     faire du volume. Deux chiffres au maximum : au-dela, la messagerie coupe
     et le vigneron ne lit que la moitie. ---- */
  var bouts = [];
  if(compteurs.echus)   bouts.push(compteurs.echus+' à faire');
  if(compteurs.signaux) bouts.push(plur(compteurs.signaux,'client')+' à voir');
  if(!bouts.length && compteurs.venir) bouts.push(plur(compteurs.venir,'échéance')+' cette semaine');
  var sujet = 'Ton bureau, '+fmtJourLong(jAuj)+' : '+(bouts.length ? bouts.join(', ') : 'rien à faire ce matin');

  /* ---- LE CORPS ---- */
  var corps = '';

  if(compteurs.echus){
    corps += bloc('Ce matin', journee.echus.map(ligneAFaire).join(''));
  }
  if(compteurs.venir){
    corps += bloc('Les jours qui viennent', journee.venir.map(ligneAFaire).join(''));
  }

  if(signaux.length){
    /* Groupes par motif, dans l'ordre ou les motifs apparaissent. Un client
       detecte par deux moteurs ne porte qu'un motif, le plus specifique :
       c'est le tableau de bord qui a tranche, on ne retranche pas ici. */
    var ordre = [], parMotif = {};
    signaux.slice(0, MAX_SIGNAUX).forEach(function(s){
      var k = s.motif || '';
      if(!parMotif[k]){ parMotif[k] = []; ordre.push(k); }
      parMotif[k].push(s);
    });
    var dedans = ordre.map(function(k){
      return '<div style="font-family:'+F_CORPS+';font-size:12px;letter-spacing:0.10em;'
           + 'text-transform:uppercase;color:'+C.muted+';padding:10px 0 2px 0;">'+esc(titreMotif(k))+'</div>'
           + parMotif[k].map(ligneSignal).join('');
    }).join('');
    var reste = signaux.length - Math.min(signaux.length, MAX_SIGNAUX);
    if(reste > 0){
      dedans += '<div style="font-size:13px;color:'+C.muted+';padding-top:10px;">Et '
             + plur(reste,'autre')+' dans ton bureau.</div>';
    }
    /* D'OU VIENT LE CHIFFRE : la regle de contenu du projet, appliquee ici.
       Ces lignes datent du dernier import, pas de ce matin, et le mail le dit. */
    dedans += '<div style="font-size:12px;color:'+C.muted+';padding-top:12px;font-style:italic;">'
           + 'Cette liste a été calculée à ton dernier import, le '+esc(fmtJourCourt(jDepot))
           + (ageDepot > 7 ? ', il y a '+plur(ageDepot,'jour')+'.' : '.')
           + '</div>';
    corps += bloc('Ta file de travail', dedans);
  } else if(perime && (file.signaux||[]).length){
    corps += bloc('Ta file de travail',
        '<div style="font-size:14px;color:'+C.ink+';">Ta file n\'est plus affichée ici : elle a été calculée '
      + (jDepot ? 'le '+esc(fmtJourCourt(jDepot))+', il y a '+plur(ageDepot,'jour') : 'à une date inconnue')
      + '. Importe ton dernier export dans le bureau pour la rafraîchir.</div>');
  }

  if(conseils.length){
    var lc = conseils.map(function(c){
      return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
        + ' style="border-collapse:collapse;border-bottom:1px solid '+C.filet+';">'
        + '<tr><td style="padding:9px 0;font-family:'+F_CORPS+';font-size:14px;line-height:1.5;color:'+C.ink+';">'
        + '<div>'+htmlLimite(c.verdict)+'</div>'
        + (c.action ? '<div style="padding-top:4px;color:'+C.muted+';">'+htmlLimite(c.action)+'</div>' : '')
        + '</td></tr></table>';
    }).join('');
    corps += bloc('Ce que dit ton tableau de bord', lc);
  }

  if(vide){
    corps += bloc('Rien ce matin',
        '<div style="font-size:15px;">Aucune tâche échue, aucun rappel, aucun client signalé. Profites-en.</div>');
  }

  /* ---- L'ENVELOPPE ----
     Un seul bloc de 600 px, centre, sur le papier du site. Le fond exterieur
     est peint sur la balise body ET sur le tableau du dessus : certaines
     messageries jettent les styles du body. */
  var html = ''
  + '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">'
  + '<title>'+esc(sujet)+'</title></head>'
  + '<body style="margin:0;padding:0;background:'+C.paperDeep+';">'
  /* Le pre-en-tete : la ligne que la messagerie affiche a cote du sujet. Sans
     elle, elle affiche le premier texte trouve, donc « Le Bureau du Vigneron ». */
  + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'+esc(sujet)+'</div>'
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
  +   ' style="border-collapse:collapse;background:'+C.paperDeep+';">'
  + '<tr><td align="center" style="padding:24px 12px;">'
  + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"'
  +   ' style="border-collapse:collapse;width:600px;max-width:600px;background:'+C.paper+';">'
  /* En-tete */
  + '<tr><td style="background:'+C.bxDeep+';padding:16px 24px;">'
  +   '<div style="font-family:'+F_TITRE+';font-size:18px;color:'+C.onDark+';">Le Bureau du Vigneron</div>'
  +   '<div style="font-family:'+F_CORPS+';font-size:12px;letter-spacing:0.10em;text-transform:uppercase;'
  +     'color:rgba(239,231,214,0.75);padding-top:3px;">'+esc(fmtJourLong(jAuj))+'</div>'
  + '</td></tr>'
  + corps
  /* Le bouton */
  + '<tr><td style="padding:24px 24px 6px 24px;">'+bouton(urlBureau,'Ouvrir mon bureau')+'</td></tr>'
  /* Le pied */
  + '<tr><td style="padding:18px 24px 22px 24px;">'
  +   '<div style="border-top:1px solid '+C.filet+';padding-top:14px;font-family:'+F_CORPS+';'
  +     'font-size:11px;line-height:1.6;color:'+C.muted+';">'
  +     'Tu reçois ce courrier parce que tu l\'as demandé dans les réglages de ton bureau.'
  +     (d.urlDesinscription
        ? ' <a href="'+esc(d.urlDesinscription)+'" style="color:'+C.muted+';">Ne plus le recevoir</a>.'
        : '')
  +     '<br>Le Bureau du Vigneron, un service Solumatic.'
  +   '</div>'
  + '</td></tr>'
  + '</table></td></tr></table></body></html>';

  /* ---- LA VERSION TEXTE ----
     Elle n'est pas decorative : un mail sans partie texte part plus souvent
     dans les indesirables, et c'est aussi la seule version lisible dans un
     terminal, donc celle qu'on relit en developpant. */
  function ligneTexte(o){
    var q = o.encours ? 'en cours' : fmtRetard(o.ecart);
    var t = ['- '+o.titre+' ('+q+')'];
    if(o.meta.length) t.push('  '+o.meta.join(' · '));
    if(o.note)        t.push('  '+o.note);
    return t;
  }
  var t = [];
  t.push(sujet, '');
  if(compteurs.echus){
    t.push('CE MATIN');
    journee.echus.forEach(function(o){ t.push.apply(t, ligneTexte(o)); });
    t.push('');
  }
  if(compteurs.venir){
    t.push('LES JOURS QUI VIENNENT');
    journee.venir.forEach(function(o){ t.push.apply(t, ligneTexte(o)); });
    t.push('');
  }
  if(signaux.length){
    t.push('TA FILE DE TRAVAIL');
    signaux.slice(0,MAX_SIGNAUX).forEach(function(s){
      t.push('- '+s.nom+(s.montant ? ' : '+fmtMoney(s.montant)+(s.lib ? ' ('+sansBalise(s.lib)+')' : '') : ''));
      var dd = sansBalise(s.detail).trim(); if(dd) t.push('  '+dd);
      var cc = sansBalise(s.contact).trim(); t.push('  '+(cc || 'Aucun contact enregistré.'));
    });
    t.push('Calculée à ton dernier import, le '+fmtJourCourt(jDepot)+'.', '');
  }
  if(conseils.length){
    t.push('CE QUE DIT TON TABLEAU DE BORD');
    conseils.forEach(function(c){
      t.push('- '+sansBalise(c.verdict));
      if(c.action) t.push('  '+sansBalise(c.action));
    });
    t.push('');
  }
  if(vide) t.push('Aucune tâche échue, aucun rappel, aucun client signalé. Profites-en.', '');
  t.push('Ouvrir mon bureau : '+urlBureau);

  return { sujet:sujet, html:html, texte:t.join('\n'), vide:vide, compteurs:compteurs };
}

/* ---- LES TROIS MONDES ----
   Navigateur : la balise script pose BdvCourrier sur window.
   Node : l'apercu du lot 1 fait un require() de ce fichier.
   Deno, au lot 3 : globalThis.BdvCourrier apres un import de l'URL du fichier.
   Ne pas remplacer ce bloc par un `export` : il fermerait les deux autres. */
var api = { batir:batir, PEREMPTION_J:PEREMPTION_J, HORIZON_J:HORIZON_J,
            _outils:{ jour:jour, fmtMoney:fmtMoney, htmlLimite:htmlLimite,
                      normTache:normTache, normRappel:normRappel, trierAFaire:trierAFaire } };
racine.BdvCourrier = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
