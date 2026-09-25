/* ===========================================================================
   LE BUREAU DU VIGNERON — LA FILE DE TRAVAIL
   ===========================================================================
   Le poste de travail est /mon-bureau/. Ce module lui donne sa file et ses gestes.

   Il ne CALCULE rien. Le tableau de bord est le seul a savoir qui rappeler : ses
   moteurs tournent sur les lignes de vente, et il depose le resultat dans
   `reglages.file_travail`. Recopier ces calculs ici ferait deux moteurs qui
   divergent, et un bureau qui signale un client que l'outil ne signale plus.

   Deux sources, et elles n'ont pas le meme age :
     - les RAPPELS, lus en direct dans `suivi_clients`. Toujours a jour, y compris
       ceux poses depuis le telephone il y a dix minutes.
     - les SIGNAUX, lus dans la file deposee. Ils datent de la derniere analyse,
       donc du dernier import. C'est assume : un decrochage ne change pas d'avis
       en une journee.

   Consequence qui justifie tout : la file s'utilise depuis un appareil sur lequel
   aucun export n'a jamais ete importe.
   =========================================================================== */
(function () {
  'use strict';

  var MIROIR_KEY = 'bdv_file_v1';
  var ATTENTE_KEY = 'bdv_crm_attente';

  // Les trois gestes. Chacun ecrit au journal, pose un statut, et surtout REPOUSSE le
  // rappel : sans le report la ligne reviendrait demain, et la file deviendrait un mur.
  var GESTES = {
    // `canal` est une CLE de bdv-canaux.js, jamais un libelle. Ce qui part en base est
    // donc 'appel' et 'repondeur', et l'affichage resout la cle a la lecture. Avant, ces
    // deux gestes ecrivaient tous les deux le libelle 'Téléphone', et un message laisse
    // etait indistinguable d'un appel decroche dans la colonne Canal.
    // `court` est le mot ECRIT SUR LE BOUTON du sous-main, `label` reste le nom
    // complet du geste : c'est lui qui part dans le title et dans l'aria-label, et
    // c'est lui qu'on lit partout ailleurs. Mesure faite le 07/09/2026 dans un vrai
    // navigateur : les trois boutons a libelle complet font 306 px a eux seuls, et
    // le tableau du sous-main ne fait jamais plus de 934 px, souvent 640. Ils
    // debordaient de la zone a TOUTES les largeurs, de 320 a 1920. Les trois mots
    // courts font 183 px, ce qui laisse enfin de la place au motif.
    appel:   { label: 'Appelé',            court: 'Appelé',  type: 'appel',   canal: 'appel',     statut: 'relance', jours: 30, resume: 'Appel passé' },
    message: { label: 'Laissé un message', court: 'Message', type: 'message', canal: 'repondeur', statut: 'relance', jours: 7,  resume: 'Message laissé, sans réponse' },
    ecarte:  { label: 'Pas maintenant',    court: 'Écarté',  type: 'ecarte',  canal: null,        statut: null,      jours: 60, resume: 'Écarté de la file' }
  };

  function session() { return (window.BdvCompte && BdvCompte.session()) || null; }
  function api(chemin, options) { return BdvCompte.api(chemin, options); }

  /* LE BUREAU, DEPUIS LE LOT 17. Une note client, un echange et les reglages
     appartiennent au BUREAU et plus a la personne. Cette fonction LEVE plutot que de
     rendre null : une ecriture sans proprietaire ne doit pas partir, et l'appelant de ce
     fichier traite deja les exceptions (c'est ce qui remet la ligne au sous-main). */
  function bureau() {
    var b = window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau();
    if (!b) throw new Error('aucun bureau');
    return b;
  }
  function auBureau() { return '&bureau=eq.' + encodeURIComponent(bureau()); }

  // Le refus d'ecrire sur la ligne d'un collegue, dit en francais. Arbitrage de Ted du
  // 13/09/2026 : chacun n'ecrit que ses propres lignes, maitre compris.
  function traduireRefus(e, quoi, par) {
    if (BdvCompte.refusDeProprietaire && BdvCompte.refusDeProprietaire(e)) {
      var refus = new Error(BdvCompte.refusEnFrancais(quoi + ' a \u00e9t\u00e9 cr\u00e9\u00e9',
        par, 'Seul son auteur peut le modifier.'));
      /* LE MOTIF SURVIT A LA TRADUCTION, 19/09/2026. La phrase francaise remplacait
         l'erreur d'origine, `status` compris : la file ne pouvait plus voir que ce refus
         etait SANS APPEL, et elle gardait la ligne indefiniment. */
      refus.definitif = true;
      refus.status = e && e.status;
      return refus;
    }
    return e;
  }

  /* UN AVIS, PAR LE CANAL QUI EXISTE DEJA, 19/09/2026. Meme fonction, mot pour mot, que
     dans bdv-taches.js et bdv-calchoix.js : `status()` est la barre du tableau de bord
     (bdv-base.js), et elle sait deja parler par `BdvReglages.dire()` quand la barre n'est
     pas dans la page, ce qui est le cas du bureau. */
  function avertir(message) {
    if (!message) return;
    try {
      // Le test porte sur le TYPE : hors de bdv-base.js, `status` est la vieille propriete
      // texte du navigateur, qui existe toujours et n'est pas une fonction.
      if (typeof status === 'function') { status('error', message); return; }
    } catch (e) {}
    try {
      if (window.BdvReglages && BdvReglages.dire) BdvReglages.dire(message, false);
    } catch (e) {}
  }
  function resumeRefus(messages) {
    if (messages.length === 1) return messages[0];
    return messages[0] + ' ' + (messages.length - 1)
      + (messages.length === 2 ? ' autre geste a \u00e9t\u00e9 refus\u00e9 pour la m\u00eame raison.'
                               : ' autres gestes ont \u00e9t\u00e9 refus\u00e9s pour la m\u00eame raison.');
  }

  /* CE QUI EST DEFINITIF, ET CE QUI NE L'EST PAS, 19/09/2026. Meme regle que
     bdv-taches.js et bdv-calchoix.js, et meme defaut ferme : un geste refuse pour une
     raison qui ne changera jamais retournait en file, y repartait a chaque ouverture, et
     la file jamais vide interdisait ensuite tout changement de bureau.

     DEFINITIFS : le refus de proprietaire (marqueur `definitif` pose par traduireRefus()),
     403 (la securite par ligne a refuse) et 401 (le jeton a ete refuse, et le rejeu se
     fait apres `rafraichir()`). TOUT LE RESTE RETOURNE EN FILE, y compris 400, 409, 422 et
     5xx : un 400 vient souvent d'une colonne pas encore creee en base, et la prochaine
     migration le repare. */
  function refusDefinitif(e) {
    if (!e) return false;
    if (e.definitif) return true;
    if (window.BdvCompte && BdvCompte.refusDeProprietaire
      && BdvCompte.refusDeProprietaire(e)) return true;
    return e.status === 401 || e.status === 403;
  }
  /* Un refus qui se dit au vigneron doit etre une phrase. Ceux qui passent par
     traduireRefus() en portent deja une ; les autres n'ont que le message technique de
     `api()` (« Supabase a refuse /echanges (403) »), qu'on ne montre a personne. */
  function phraseRefus(e) {
    if (e && e.definitif && e.message) return e.message;
    return 'Un geste pos\u00e9 hors ligne n\u2019a pas pu \u00eatre enregistr\u00e9 : ton compte '
      + 'n\u2019a pas le droit d\u2019\u00e9crire dans ce bureau.';
  }

  function lireMiroir() {
    try { return JSON.parse(localStorage.getItem(MIROIR_KEY)) || null; }
    catch (e) { return null; }
  }
  /* OUBLIER LE MIROIR. Ajoute le 08/09/2026, appele par viderBase() dans bdv-base.js.
     Cette cle est la seule source du sous-main et de l'ardoise du bureau : tant que
     personne ne l'effacait, vider sa base laissait a l'ecran une file de rappels et un
     chiffre d'affaires calcules sur des lignes qui n'existaient plus, et seul un
     rechargement de la page les faisait disparaitre.

     Elle vit ICI parce que la cle vit ici. Un removeItem ecrit depuis le moteur aurait
     marche aujourd'hui et casse au premier renommage, sans un mot. */
  function oublier() {
    try { localStorage.removeItem(MIROIR_KEY); } catch (e) {}
    return null;
  }

  function ecrireMiroir(etat) {
    try { localStorage.setItem(MIROIR_KEY, JSON.stringify(etat)); } catch (e) {}
  }

  // Dates en heure LOCALE. toISOString() rend l'UTC : entre minuit et deux heures du
  // matin en France, il aurait donne la veille, un rappel du jour serait passe a la
  // trappe et les retards auraient ete decales d'un jour.
  function isoLocal(d) {
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  }
  function aujourdhuiISO() { return isoLocal(new Date()); }
  function dansNJours(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return isoLocal(d);
  }

  // ---------------- LECTURE ----------------
  // Un seul aller-retour par source, en parallele. Le bureau doit s'afficher vite :
  // il peint d'abord le miroir, puis se corrige quand le reseau repond.
  async function charger() {
    if (!session()) return null;
    /* SANS BUREAU ON NE LIT RIEN, ET ON LE DIT PAR null. Ajoute le 14/09/2026 avec le
       filtre `bureau` sur les deux lectures : `auBureau()` LEVE quand la cle n'est pas
       encore posee, et une exception ici laisserait l'ecran sur son miroir sans jamais
       reessayer. null est deja la valeur que cette fonction rend quand elle ne sait pas. */
    if (!(window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau())) return null;
    // On lit TOUT le suivi, pas seulement les rappels echus. Un rappel FUTUR doit sortir
    // le client de la file : sans lui, un client qu'on vient de rappeler revenait en
    // « signal » au rechargement suivant, puisque le depot du tableau de bord, lui, ne
    // change qu'au prochain import. C'etait le defaut le plus couteux de ce module.
    //
    // allSettled et pas all : les deux sources sont independantes. Si la lecture des
    // reglages echoue (colonnes pas encore creees en base, par exemple), les rappels,
    // eux, ont ete lus, et une file de rappels seuls reste une file utile.
    var r = await Promise.allSettled([
      api('/reglages?select=file_travail,resume_ventes,depose_le,objectif,exercice_debut' + auBureau() + '&limit=1'),
      api('/suivi_clients?select=client_id,statut,rappel,rappel_titre,canal,cree_par' + auBureau())
    ]);
    /* Array.isArray ET PAS SEULEMENT LA VERITE DE LA VALEUR. Trouve le 07/09/2026
       en faisant tourner le bureau dans un vrai navigateur avec un reseau qui
       repond n'importe quoi : l'API rendait un objet au lieu d'un tableau, le test
       de verite le laissait passer, et `suivi.map` levait. Une seule ligne de la
       page lancait l'exception, mais elle arretait toute la peinture : plus
       d'ardoise, plus de sous-main, un bureau vide sans un mot d'explication.
       Un serveur qui repond de travers doit vider une liste, pas eteindre la
       piece. */
    var reglages = (r[0].status === 'fulfilled' && Array.isArray(r[0].value)) ? r[0].value : [];
    var suivi    = (r[1].status === 'fulfilled' && Array.isArray(r[1].value)) ? r[1].value : [];
    /* LE MIROIR RENDU APRES UN ECHEC TOTAL DIT QU'IL EST PERIME, 19/09/2026.
       Les deux lectures sont tombees : ce qu'on rend ici est l'etat de la DERNIERE VISITE,
       pas celui du jour. Rendu nu, il etait indistinguable d'une lecture reussie pour tout
       le reste du bureau : le drapeau « lecture en echec » ne se levait pas, et la file de
       rappels de la semaine derniere s'affichait comme si elle etait du jour.

       LA MARQUE VOYAGE AVEC LA REPONSE ET N'EST PAS ECRITE DANS LE MIROIR. Elle dit l'age
       de CET appel, pas une propriete de ce qui est range sur le disque : une lecture qui
       reussit reconstruit l'etat de zero, donc la marque disparait toute seule et ne peut
       pas rester collee a un bureau qui va bien.

       QUI LA LIT : `peindreFile()` dans src/mon-bureau.njk, par `ETAT_FILE.perime`. Le
       gabarit n'appartient pas a ce chantier, la ligne exacte a ajouter est dans le
       rapport du 19/09/2026. */
    if (r[0].status !== 'fulfilled' && r[1].status !== 'fulfilled') {
      var vieil = lireMiroir();
      return vieil ? Object.assign({}, vieil, { perime: true }) : null;
    }
    // Une source tombee ne doit pas effacer ce que l'autre avait rapporte la veille. Le
    // miroir sert de fond : on n'ecrase que ce qu'on a vraiment relu. Sans ca, un refus
    // sur /reglages (colonnes pas encore creees, par exemple) vidait l'ardoise, le mot du
    // jour et l'age de l'analyse a chaque chargement, et faisait lire l'objectif comme nul.
    var vieux = lireMiroir() || {};
    var regOk = (r[0].status === 'fulfilled') && Array.isArray(r[0].value);
    var reg = reglages[0] || {};
    // file_travail porte {signaux, noms}. La forme historique (un simple tableau) est
    // acceptee : un depot fait par une version anterieure du tableau de bord ne doit pas
    // vider le bureau de quelqu'un qui n'a pas encore reimporte.
    var brut = reg.file_travail || {};
    var signaux = Array.isArray(brut) ? brut : (brut.signaux || []);
    var noms = (!Array.isArray(brut) && brut.noms) ? brut.noms : {};
    var etat = {
      signaux: regOk ? signaux : (vieux.signaux || []),
      noms: regOk ? noms : (vieux.noms || {}),
      resume: regOk ? (reg.resume_ventes || null) : (vieux.resume || null),
      deposeLe: regOk ? (reg.depose_le || null) : (vieux.deposeLe || null),
      // Les deux reglages que le bureau sait modifier. Le reste (libelles perso,
      // classement) reste dans le tableau de bord : ca ne se regle qu'en le regardant.
      // `lus` dit si la valeur vient du serveur : la fenetre des reglages refuse
      // d'ecrire tant qu'elle n'a pas relu, sinon elle proposerait un champ vide et
      // enregistrerait ce vide par-dessus une valeur posee au tableau de bord.
      reglages: regOk ? {
        lus: true,
        objectif: (reg.objectif != null) ? Number(reg.objectif) : null,
        exercice_debut: reg.exercice_debut || null
      } : (vieux.reglages || { lus: false, objectif: null, exercice_debut: null }),
      suivi: (r[1].status === 'fulfilled' && Array.isArray(r[1].value)) ? suivi.map(function (l) {
        /* `titre` est le MOTIF du rappel, depuis le 11/09/2026. Il descend jusqu'ici
           parce que trois ecrans le lisent : le sous-main, le panneau et le calendrier.
           « Rappeler le 18 » ne dit pas pourquoi, et trois semaines plus tard personne
           ne sait ce qui avait ete promis. */
        /* `par` est QUI a ecrit cette fiche, depuis le 14/09/2026. Il descend par le
           miroir pour la meme raison que le motif : la piece Mes taches fabrique ses
           lignes de client a partir d'ici, et un rappel qu'on ne peut pas corriger
           doit dire de qui il est. Dans un bureau seul, personne ne l'affiche. */
        return { id: l.client_id, rappel: l.rappel || '', titre: l.rappel_titre || '',
                 statut: l.statut || '', par: l.cree_par || null };
      }) : (vieux.suivi || vieux.rappels || [])
    };
    ecrireMiroir(etat);
    return etat;
  }

  // Les rappels d'abord, du plus en retard au plus recent : une promesse qu'on s'est
  // faite a soi-meme pese plus lourd qu'une opportunite reperee par un calcul.
  function file(etat) {
    if (!etat) return [];
    var auj = aujourdhuiISO();
    var out = [];
    var parId = {};
    (etat.signaux || []).forEach(function (s) { parId[s.id] = s; });
    var suiviPar = {};
    // Compatibilite : un miroir ecrit par la version precedente porte `rappels`.
    (etat.suivi || etat.rappels || []).forEach(function (l) { suiviPar[l.id] = l; });

    Object.keys(suiviPar).forEach(function (id) {
      var l = suiviPar[id];
      if (l.statut === 'traite') return;              // le vigneron l'a clos
      if (!l.rappel || l.rappel > auj) return;        // pas encore l'heure
      var s = parId[id] || {};
      out.push({
        id: id,
        nom: s.nom || (etat.noms || {})[id] || id,
        source: 'rappel',
        retard: joursEntre(l.rappel, auj),
        rappel: l.rappel,
        titre: l.titre || '',
        montant: s.montant || 0,
        lib: s.lib || '',
        motif: s.motif || '',
        detail: s.detail || '',
        contact: s.contact || ''
      });
    });

    (etat.signaux || []).forEach(function (s) {
      var l = suiviPar[s.id];
      // Un client deja suivi ne revient JAMAIS par la porte des signaux : sa fiche fait
      // foi, qu'il porte un rappel futur, un rappel echu (deja pris ci-dessus) ou le
      // statut « traite ».
      if (l) return;
      out.push({
        id: s.id, nom: s.nom, source: 'signal', retard: -1, rappel: '',
        montant: s.montant || 0, lib: s.lib || '', motif: s.motif || '',
        detail: s.detail || '', contact: s.contact || ''
      });
    });

    out.sort(function (a, b) {
      if (a.source !== b.source) return a.source === 'rappel' ? -1 : 1;
      if (a.source === 'rappel') return b.retard - a.retard;
      return (b.montant || 0) - (a.montant || 0);
    });
    return out;
  }

  function joursEntre(iso, ref) {
    if (!iso) return 0;
    var a = Date.parse(iso + 'T00:00:00Z'), b = Date.parse(ref + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.round((b - a) / 86400000);
  }

  // Le fil d'un client : ce qui s'est passe avec lui, du plus recent au plus ancien.
  // Lu a la demande, quand on ouvre sa fiche, jamais en bloc au chargement de la page.
  async function fil(clientId) {
    if (!session()) return [];
    try {
      var l = await api('/echanges?select=echange_id,le,maj_le,type,canal,resume,cree_par&client_id=eq.'
        + encodeURIComponent(clientId) + auBureau() + '&order=le.desc&limit=50');
      // null, et pas [] : api() rend null sans lever quand la session est tombee, et la
      // table `echanges` peut ne pas exister encore. Annoncer « rien encore » sur un
      // client qui porte trente echanges est un mensonge, pas un affichage vide.
      return Array.isArray(l) ? l : null;
    } catch (e) { return null; }
  }

  // Une note libre depuis le bureau. Le CANAL est celui que le vigneron a choisi dans la
  // liste, et il n'est plus DEDUIT du type : la deduction d'avant classait tout
  // « message » en E-mail ici, alors que le meme geste pose depuis la file etait classe
  // Telephone. Deux lignes du meme journal disaient deux choses differentes du meme acte.
  //
  // `canalCle` est une cle de bdv-canaux.js. Une valeur inconnue n'est pas inventee : on
  // n'ecrit alors aucun canal, et le type sert de repli d'affichage.
  async function noter(clientId, canalCle, texte) {
    if (!session()) throw new Error('aucune session');
    var C = window.BdvCanaux;
    var connu = C ? C.canal(canalCle) : null;
    var canal = connu ? connu.cle : null;
    var type = connu ? connu.type
      : ((C && C.types[canalCle]) ? canalCle : 'note');
    // return=REPRESENTATION, et pas minimal : api() rend null aussi bien pour un corps
    // vide que pour une session tombee. Avec minimal, PostgREST rend 201 sans corps, donc
    // null, donc toute note ECRITE etait annoncee au vigneron comme un echec. Une reponse
    // qui porte la ligne creee est la seule qui distingue les deux cas.
    // `maj_le` EST POSE EGAL A `le`, et ce n'est pas une redondance : la colonne a un
    // defaut now() cote base, donc une entree qui ne la porte pas se fait horodater a
    // l'ARRIVEE de la requete. Cent millisecondes de reseau suffisaient a rendre les
    // deux dates differentes, et l'ecran ne dit « corrigé le » que dans ce cas : chaque
    // note neuve s'affichait corrigee a la seconde ou elle etait ecrite. Toute nouvelle
    // ecriture d'echange pose les deux a la MEME valeur, celle-ci et pas new Date().
    var quand = new Date().toISOString();
    var r = await api('/echanges?on_conflict=bureau,echange_id', {
      methode: 'POST',
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      corps: [{
        bureau: bureau(), echange_id: echId(), client_id: String(clientId),
        le: quand, maj_le: quand, type: type, canal: canal, resume: texte
      }]
    });
    if (r === null) throw new Error('ecriture refusee');
    return true;
  }

  // ---------------- CORRIGER UNE ENTREE DEJA ECRITE ----------------
  // `le` n'est JAMAIS touche : c'est la date de ce qui s'est passe, et la reecrire ferait
  // glisser un appel de mardi au jeudi ou on s'est relu. Seuls le texte et le canal
  // changent, et `maj_le` dit quand. Sans cette colonne, une ligne corrigee six mois plus
  // tard se lirait comme la trace d'origine : le journal ne serait plus une memoire, mais
  // une note revisable sans preuve.
  //
  // PATCH sur la paire (id, echange_id), et pas sur echange_id seul : la politique de
  // securite borne deja chaque compte a ses lignes, mais un filtre qui s'appuie sur elle
  // pour etre correct est un filtre qui devient faux le jour ou la politique bouge.
  async function corriger(clientId, echangeId, champs) {
    if (!session()) throw new Error('aucune session');
    if (!echangeId) throw new Error('entree sans identifiant');
    var corps = {};
    if (Object.prototype.hasOwnProperty.call(champs || {}, 'resume')) corps.resume = champs.resume;
    if (Object.prototype.hasOwnProperty.call(champs || {}, 'canal')) {
      var C = window.BdvCanaux;
      var connu = C ? C.canal(champs.canal) : null;
      corps.canal = connu ? connu.cle : null;
      if (connu) corps.type = connu.type;
    }
    if (!Object.keys(corps).length) return false;
    corps.maj_le = new Date().toISOString();
    // representation, comme partout ailleurs : api() rend null aussi bien pour une session
    // tombee que pour un corps vide, et une correction ECRITE serait annoncee comme un
    // echec. Le vigneron reecrirait sa phrase une deuxieme fois pour rien.
    var r = await api('/echanges?bureau=eq.' + encodeURIComponent(bureau())
      + '&echange_id=eq.' + encodeURIComponent(echangeId), {
      methode: 'PATCH',
      entetes: { 'Prefer': 'return=representation' },
      corps: corps
    });
    if (r === null) throw new Error('correction refusee');
    if (!r.length) throw new Error('entree introuvable');
    return true;
  }

  /* Poser ou retirer une date de rappel, sans passer par un geste tout fait.
     LE MOTIF PART AVEC LA DATE, dans la meme ecriture. Retirer un rappel efface son
     motif : un motif sans date est une phrase orpheline que plus aucun ecran ne montre,
     et qui reapparaitrait collee au prochain rappel pose sur ce client. */
  async function planifier(clientId, iso, titre) {
    return ecrireSuivi(clientId, { rappel: iso || null, rappel_titre: iso ? (titre || null) : null });
  }

  // ---------------- ECRITURE ----------------
  // PATCH puis POST, jamais l'inverse : un upsert POST remettrait `notes` et `tags` a
  // leur defaut, et le vigneron perdrait ce qu'il a ecrit dans sa fiche client.
  /* QUI TIENT CETTE FICHE. Le delta qu'on ecrit ne porte pas `cree_par` (la base le
     pose, jamais nous), donc l'auteur se relit dans le miroir, ou il est descendu avec
     le reste du suivi. Absent du miroir, la phrase de refus reste generique. */
  function auteurDeLaFiche(clientId) {
    var m = lireMiroir();
    var l = ((m && (m.suivi || m.rappels)) || []).filter(function (x) {
      return String(x.id) === String(clientId);
    })[0];
    return l ? (l.par || null) : null;
  }

  async function ecrireSuivi(clientId, champs) {
    var corps = {};
    Object.keys(champs).forEach(function (k) { corps[k] = champs[k]; });
    corps.maj_le = new Date().toISOString();
    // BdvCompte.api() rend null SANS LEVER quand la session est tombee. Sans ce garde,
    // un geste pose apres expiration paraissait reussir, la ligne quittait l'ecran, et
    // rien n'etait ecrit nulle part : le geste etait definitivement perdu.
    if (!session()) throw new Error('aucune session');
    var faits = await api('/suivi_clients?client_id=eq.' + encodeURIComponent(clientId) + auBureau(), {
      methode: 'PATCH',
      entetes: { 'Prefer': 'return=representation' },
      corps: corps
    });
    if (faits === null) throw new Error('ecriture refusee');
    if (faits.length) return true;
    /* ZERO LIGNE TOUCHEE VEUT DIRE DEUX CHOSES DEPUIS LE LOT 17, et il faut les
       distinguer : la fiche n'existe pas encore (cas normal, on la cree juste apres), ou
       elle existe et appartient a un collegue, auquel cas la politique de securite ne la
       laisse pas modifier et la creation qui suit se heurte a la cle primaire. C'est de
       la que vient l'erreur traduite. */
    corps.bureau = bureau();
    corps.client_id = String(clientId);
    var cree;
    try {
      cree = await api('/suivi_clients?on_conflict=bureau,client_id', {
        methode: 'POST',
        entetes: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        corps: [corps]
      });
    } catch (e) { throw traduireRefus(e, 'Ce suivi client', auteurDeLaFiche(clientId)); }
    if (cree === null) throw new Error('creation refusee');
    return true;
  }

  function echId() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }

  // `eid` est fabrique UNE FOIS, au moment du geste, et rejoue tel quel. Regenere a chaque
  // tentative, il rendait le `on_conflict=(id, echange_id)` inoperant : une reponse perdue
  // apres une ecriture reussie donnait deux entrees au journal pour un seul appel passe.
  async function ecrireEchange(clientId, g, eid) {
    if (!session()) throw new Error('aucune session');
    // representation, pour la meme raison que noter() : avec minimal, une session tombee
    // et une ecriture reussie rendent toutes les deux null, et le geste serait annonce
    // comme fait alors que le journal n'a rien recu.
    // maj_le = le, meme motif que dans noter() : sans lui, le defaut now() de la base
    // horodate a l'arrivee de la requete et le geste s'affiche corrige aussitot.
    var quand = new Date().toISOString();
    var r = await api('/echanges?on_conflict=bureau,echange_id', {
      methode: 'POST',
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      corps: [{
        bureau: bureau(), echange_id: eid || echId(), client_id: String(clientId),
        le: quand, maj_le: quand, type: g.type, canal: g.canal, resume: g.resume
      }]
    });
    if (r === null) throw new Error('journal refuse');
  }

  // Ce qui n'a pas pu partir est mis de cote et rejoue au chargement suivant. Un geste
  // pose dans une cave sans reseau ne doit pas disparaitre.
  // Un client n'a qu'une operation en attente : seul son dernier geste compte. Sans
  // cela, dix clics dans une cave sans reseau creaient dix entrees au journal.
  function enfiler(op) {
    var f = [];
    try { f = JSON.parse(localStorage.getItem(ATTENTE_KEY)) || []; } catch (e) {}
    f = f.filter(function (o) { return o.id !== op.id; });
    f.push(op);
    try { localStorage.setItem(ATTENTE_KEY, JSON.stringify(f)); } catch (e) {}
  }
  function reste(f) {
    try {
      if (f.length) localStorage.setItem(ATTENTE_KEY, JSON.stringify(f));
      else localStorage.removeItem(ATTENTE_KEY);
    } catch (e) {}
  }
  async function rejouer() {
    var f = [];
    try { f = JSON.parse(localStorage.getItem(ATTENTE_KEY)) || []; } catch (e) { return; }
    if (!f.length || !session()) return;
    var restant = [], refuses = [];
    for (var i = 0; i < f.length; i++) {
      var o = f[i];
      try { await appliquer(o.cle, o.id, o.eid, o.suiviFait); }
      catch (e) {
        // Le suivi etait deja passe : on ne le rejouera pas, seul le journal reste du.
        if (e && e.suiviFait) o.suiviFait = true;
        /* UN REFUS DEFINITIF QUITTE LA FILE, ET SE DIT, 19/09/2026. Meme regle que
           bdv-taches.js : ce que la base ne voudra jamais ne doit pas revenir a chaque
           ouverture, sinon la file ne se vide plus et le changement de bureau devient
           impossible pour toujours, sans un mot a l'ecran. */
        if (refusDefinitif(e)) { refuses.push(phraseRefus(e)); continue; }
        restant.push(o);
      }
    }
    reste(restant);
    if (refuses.length) avertir(resumeRefus(refuses));
  }

  // Deux ecritures, et elles ne valent pas la meme chose. Le SUIVI est ce que le vigneron
  // voit : rappel repousse, ligne qui quitte la file. Le JOURNAL est la memoire de ce qui
  // s'est dit. Si le suivi passe et que le journal tombe, le geste a bien eu lieu : la
  // ligne doit rester partie, et seule l'entree du journal se rejoue. Traiter les deux
  // comme un bloc faisait revenir la ligne a l'ecran alors que le rappel etait deja
  // repousse en base, puis repartir a la lecture suivante : elle clignotait.
  async function appliquer(cle, clientId, eid, suiviFait) {
    var g = GESTES[cle];
    if (!g) return;
    if (!suiviFait) {
      var champs = { rappel: dansNJours(g.jours) };
      if (g.statut) champs.statut = g.statut;
      if (g.canal) champs.canal = g.canal;
      await ecrireSuivi(clientId, champs);
    }
    try {
      await ecrireEchange(clientId, g, eid);
    } catch (e) {
      /* LE MOTIF DU REFUS SURVIT, 19/09/2026. Cette erreur de remplacement jetait tout ce
         que la precedente disait : la file ne pouvait plus voir qu'un refus de journal
         etait DEFINITIF, et elle rejouait la meme entree a chaque ouverture, refusee a
         l'identique. On garde donc le marqueur, le code et la phrase. */
      var err = new Error(refusDefinitif(e) ? phraseRefus(e) : 'journal seul');
      err.suiviFait = true;
      err.definitif = refusDefinitif(e);
      err.status = e && e.status;
      throw err;
    }
  }

  // Le geste rend la main tout de suite : l'ecran retire la ligne, le reseau suit.
  // Un vigneron qui traite quinze relances ne doit jamais attendre entre deux clics.
  function geste(cle, clientId) {
    var g = GESTES[cle];
    if (!g || !clientId) return Promise.resolve(false);
    var etat = lireMiroir();
    var signauxAvant = etat ? (etat.signaux || []) : [];
    var suiviAvant = etat ? (etat.suivi || etat.rappels || []) : [];
    if (etat) {
      etat.suivi = suiviAvant.filter(function (r) { return r.id !== clientId; });
      etat.signaux = signauxAvant.filter(function (s) { return s.id !== clientId; });
      delete etat.rappels;
      ecrireMiroir(etat);
    }
    var eid = echId();
    return appliquer(cle, clientId, eid, false)
      .then(function () { return true; })
      .catch(function (err) {
        /* UN REFUS DEFINITIF NE RETOURNE PAS EN FILE, 19/09/2026. L'enfiler condamnait le
           vigneron a le voir echouer en silence a chaque ouverture, pour toujours. On le
           dit tout de suite, et la ligne revient a l'ecran si rien n'est parti. */
        if (refusDefinitif(err)) {
          avertir(phraseRefus(err));
          if (err && err.suiviFait) return true;   // le rappel EST repousse, seul le journal manque
          var e0 = lireMiroir();
          if (e0) { e0.signaux = signauxAvant; e0.suivi = suiviAvant; ecrireMiroir(e0); }
          return false;
        }
        enfiler({ cle: cle, id: clientId, eid: eid, suiviFait: !!(err && err.suiviFait) });
        // Le suivi est passe : le rappel EST repousse en base, la ligne doit rester
        // partie. Seule la trace au journal manque, et elle se rejouera toute seule.
        if (err && err.suiviFait) return true;
        // Rien n'est parti : la ligne revient a l'ecran. Un vigneron qui voit une ligne
        // disparaitre croit le client traite ; lui laisser croire ca alors que rien n'a
        // ete ecrit est la pire des issues.
        var e = lireMiroir();
        if (e) { e.signaux = signauxAvant; e.suivi = suiviAvant; ecrireMiroir(e); }
        return false;
      });
  }

  // ---------------- LE JOURNAL, EN BLOC ----------------
  // Pour COMPTER, pas pour afficher : le panneau du bureau a besoin du nombre de gestes
  // de la semaine, pas de leur contenu. On ne demande donc que la date et le type.
  //
  // Rend null, et pas [], quand la lecture echoue : une table `echanges` pas encore creee
  // et une semaine sans un seul geste ne sont pas la meme chose, et le bureau doit
  // pouvoir se taire dans le premier cas plutot que d'annoncer un zero faux.
  async function journal(depuisISO) {
    if (!session()) return null;
    try {
      var l = await api('/echanges?select=le,type&le=gte.' + encodeURIComponent(depuisISO)
        + auBureau() + '&order=le.desc&limit=1000');
      return Array.isArray(l) ? l : null;
    } catch (e) { return null; }
  }

  // ---------------- LES REGLAGES, ECRITS DEPUIS LE BUREAU ----------------
  // Un upsert ne touche QUE les colonnes presentes dans le corps. Ecrire l'objectif
  // depuis le bureau ne peut donc pas effacer la file deposee par le tableau de bord,
  // ni les libelles perso, ni le classement. C'est ce qui rend ce raccourci sans danger.
  async function ecrireReglages(champs) {
    if (!session()) throw new Error('aucune session');
    var corps = Object.assign({ bureau: bureau(), maj_le: new Date().toISOString() }, champs);
    var r = await api('/reglages?on_conflict=bureau', {
      methode: 'POST',
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      corps: [corps]
    });
    if (r === null) throw new Error('ecriture refusee');
    // Le miroir suit tout de suite : sans ca, rouvrir les reglages dans la minute
    // reafficherait l'ancienne valeur, et le vigneron croirait sa saisie perdue.
    var e = lireMiroir();
    if (e) { e.reglages = Object.assign({}, e.reglages, champs); ecrireMiroir(e); }
    return true;
  }

  /* LA FILE PART AVANT LA BASCULE, 14/09/2026. Changer de bureau vide le poste, et
     ce qui n'a pas ete envoye serait perdu sans un mot. On s'annonce donc ici : le
     module videra sa file quand on le lui demandera, et si quelque chose resiste,
     `changerDeBureau()` refuse de basculer plutot que de jeter du travail. */
  if (window.BdvCompte && BdvCompte.avantDeQuitterLeBureau) {
    BdvCompte.avantDeQuitterLeBureau(rejouer);
  }

  window.BdvCrm = {
    GESTES: GESTES,
    fil: fil,
    noter: noter,
    corriger: corriger,
    planifier: planifier,
    dansNJours: dansNJours,
    charger: charger,
    miroir: lireMiroir,
    oublier: oublier,
    file: file,
    geste: geste,
    rejouer: rejouer,
    journal: journal,
    ecrireReglages: ecrireReglages,
    isoLocal: isoLocal
  };

  /* UN AUTRE ONGLET A ECRIT, ET LE SERVEUR L'A CONFIRME, 24/09/2026. C'est bdv-base.js
     qui emet, depuis la fiche, juste apres `bdvFicheAEcrit()` : l'onglet de la liste
     relit donc le compte par le meme chemin que s'il avait ecrit lui-meme. L'ecouteur
     vit ici et pas dans le moteur, parce que « Ma journee » n'a pas forcement charge le
     moteur : c'est meme le cas le plus frequent. */
  try {
    if ('BroadcastChannel' in window) {
      window.BDV_ONGLET = window.BDV_ONGLET || (Date.now().toString(36) + Math.random().toString(36).slice(2));
      new BroadcastChannel('bdv-bureau').onmessage = function (e) {
        if (e && e.data && e.data.onglet && e.data.onglet === window.BDV_ONGLET) return;
        if (typeof window.bdvFicheAEcrit === 'function') { try { window.bdvFicheAEcrit(); } catch (e) {} }
        if (typeof window.bdvCrmAChange === 'function') { try { window.bdvCrmAChange(); } catch (e) {} }
      };
    }
  } catch (e) {}
})();
