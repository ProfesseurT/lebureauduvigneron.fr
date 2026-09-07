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

  function lireMiroir() {
    try { return JSON.parse(localStorage.getItem(MIROIR_KEY)) || null; }
    catch (e) { return null; }
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
    // On lit TOUT le suivi, pas seulement les rappels echus. Un rappel FUTUR doit sortir
    // le client de la file : sans lui, un client qu'on vient de rappeler revenait en
    // « signal » au rechargement suivant, puisque le depot du tableau de bord, lui, ne
    // change qu'au prochain import. C'etait le defaut le plus couteux de ce module.
    //
    // allSettled et pas all : les deux sources sont independantes. Si la lecture des
    // reglages echoue (colonnes pas encore creees en base, par exemple), les rappels,
    // eux, ont ete lus, et une file de rappels seuls reste une file utile.
    var r = await Promise.allSettled([
      api('/reglages?select=file_travail,resume_ventes,depose_le,objectif,exercice_debut&limit=1'),
      api('/suivi_clients?select=client_id,statut,rappel,canal')
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
    if (r[0].status !== 'fulfilled' && r[1].status !== 'fulfilled') return lireMiroir();
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
        return { id: l.client_id, rappel: l.rappel || '', statut: l.statut || '' };
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
      var l = await api('/echanges?select=echange_id,le,maj_le,type,canal,resume&client_id=eq.'
        + encodeURIComponent(clientId) + '&order=le.desc&limit=50');
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
    var r = await api('/echanges?on_conflict=id,echange_id', {
      methode: 'POST',
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      corps: [{
        id: BdvCompte.monId(), echange_id: echId(), client_id: String(clientId),
        le: new Date().toISOString(), type: type, canal: canal, resume: texte
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
    var r = await api('/echanges?id=eq.' + encodeURIComponent(BdvCompte.monId())
      + '&echange_id=eq.' + encodeURIComponent(echangeId), {
      methode: 'PATCH',
      entetes: { 'Prefer': 'return=representation' },
      corps: corps
    });
    if (r === null) throw new Error('correction refusee');
    if (!r.length) throw new Error('entree introuvable');
    return true;
  }

  // Poser ou retirer une date de rappel, sans passer par un geste tout fait.
  async function planifier(clientId, iso) {
    return ecrireSuivi(clientId, { rappel: iso || null });
  }

  // ---------------- ECRITURE ----------------
  // PATCH puis POST, jamais l'inverse : un upsert POST remettrait `notes` et `tags` a
  // leur defaut, et le vigneron perdrait ce qu'il a ecrit dans sa fiche client.
  async function ecrireSuivi(clientId, champs) {
    var corps = {};
    Object.keys(champs).forEach(function (k) { corps[k] = champs[k]; });
    corps.maj_le = new Date().toISOString();
    // BdvCompte.api() rend null SANS LEVER quand la session est tombee. Sans ce garde,
    // un geste pose apres expiration paraissait reussir, la ligne quittait l'ecran, et
    // rien n'etait ecrit nulle part : le geste etait definitivement perdu.
    if (!session()) throw new Error('aucune session');
    var faits = await api('/suivi_clients?client_id=eq.' + encodeURIComponent(clientId), {
      methode: 'PATCH',
      entetes: { 'Prefer': 'return=representation' },
      corps: corps
    });
    if (faits === null) throw new Error('ecriture refusee');
    if (faits.length) return true;
    corps.id = BdvCompte.monId();
    corps.client_id = String(clientId);
    var cree = await api('/suivi_clients?on_conflict=id,client_id', {
      methode: 'POST',
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      corps: [corps]
    });
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
    var r = await api('/echanges?on_conflict=id,echange_id', {
      methode: 'POST',
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      corps: [{
        id: BdvCompte.monId(), echange_id: eid || echId(), client_id: String(clientId),
        le: new Date().toISOString(), type: g.type, canal: g.canal, resume: g.resume
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
    var restant = [];
    for (var i = 0; i < f.length; i++) {
      var o = f[i];
      try { await appliquer(o.cle, o.id, o.eid, o.suiviFait); }
      catch (e) {
        // Le suivi etait deja passe : on ne le rejouera pas, seul le journal reste du.
        if (e && e.suiviFait) o.suiviFait = true;
        restant.push(o);
      }
    }
    reste(restant);
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
      var err = new Error('journal seul');
      err.suiviFait = true;
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
        + '&order=le.desc&limit=1000');
      return Array.isArray(l) ? l : null;
    } catch (e) { return null; }
  }

  // ---------------- LES REGLAGES, ECRITS DEPUIS LE BUREAU ----------------
  // Un upsert ne touche QUE les colonnes presentes dans le corps. Ecrire l'objectif
  // depuis le bureau ne peut donc pas effacer la file deposee par le tableau de bord,
  // ni les libelles perso, ni le classement. C'est ce qui rend ce raccourci sans danger.
  async function ecrireReglages(champs) {
    if (!session()) throw new Error('aucune session');
    var corps = Object.assign({ id: BdvCompte.monId(), maj_le: new Date().toISOString() }, champs);
    var r = await api('/reglages?on_conflict=id', {
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

  window.BdvCrm = {
    GESTES: GESTES,
    fil: fil,
    noter: noter,
    corriger: corriger,
    planifier: planifier,
    dansNJours: dansNJours,
    charger: charger,
    miroir: lireMiroir,
    file: file,
    geste: geste,
    rejouer: rejouer,
    journal: journal,
    ecrireReglages: ecrireReglages,
    isoLocal: isoLocal
  };
})();
