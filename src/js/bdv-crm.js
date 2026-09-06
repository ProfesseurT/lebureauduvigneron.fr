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
    appel:   { label: 'Appelé',            type: 'appel',   canal: 'Téléphone', statut: 'relance', jours: 30, resume: 'Appel passé' },
    message: { label: 'Laissé un message', type: 'message', canal: 'Téléphone', statut: 'relance', jours: 7,  resume: 'Message laissé, sans réponse' },
    ecarte:  { label: 'Pas maintenant',    type: 'ecarte',  canal: null,        statut: null,      jours: 60, resume: 'Écarté de la file' }
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
      api('/reglages?select=file_travail,resume_ventes,depose_le&limit=1'),
      api('/suivi_clients?select=client_id,statut,rappel,canal')
    ]);
    var reglages = (r[0].status === 'fulfilled' && r[0].value) || [];
    var suivi    = (r[1].status === 'fulfilled' && r[1].value) || [];
    if (r[0].status !== 'fulfilled' && r[1].status !== 'fulfilled') return lireMiroir();
    var reg = reglages[0] || {};
    // file_travail porte {signaux, noms}. La forme historique (un simple tableau) est
    // acceptee : un depot fait par une version anterieure du tableau de bord ne doit pas
    // vider le bureau de quelqu'un qui n'a pas encore reimporte.
    var brut = reg.file_travail || {};
    var signaux = Array.isArray(brut) ? brut : (brut.signaux || []);
    var noms = (!Array.isArray(brut) && brut.noms) ? brut.noms : {};
    var etat = {
      signaux: signaux,
      noms: noms,
      resume: reg.resume_ventes || null,
      deposeLe: reg.depose_le || null,
      suivi: suivi.map(function (l) {
        return { id: l.client_id, rappel: l.rappel || '', statut: l.statut || '' };
      })
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

  async function ecrireEchange(clientId, g) {
    if (!session()) throw new Error('aucune session');
    await api('/echanges?on_conflict=id,echange_id', {
      methode: 'POST',
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      corps: [{
        id: BdvCompte.monId(), echange_id: echId(), client_id: String(clientId),
        le: new Date().toISOString(), type: g.type, canal: g.canal, resume: g.resume
      }]
    });
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
  async function rejouer() {
    var f = [];
    try { f = JSON.parse(localStorage.getItem(ATTENTE_KEY)) || []; } catch (e) { return; }
    if (!f.length || !session()) return;
    var restant = [];
    for (var i = 0; i < f.length; i++) {
      try { await appliquer(f[i].cle, f[i].id); }
      catch (e) { restant.push(f[i]); }
    }
    try {
      if (restant.length) localStorage.setItem(ATTENTE_KEY, JSON.stringify(restant));
      else localStorage.removeItem(ATTENTE_KEY);
    } catch (e) {}
  }

  async function appliquer(cle, clientId) {
    var g = GESTES[cle];
    if (!g) return;
    var champs = { rappel: dansNJours(g.jours) };
    if (g.statut) champs.statut = g.statut;
    if (g.canal) champs.canal = g.canal;
    await ecrireSuivi(clientId, champs);
    await ecrireEchange(clientId, g);
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
    return appliquer(cle, clientId)
      .then(function () { return true; })
      .catch(function () {
        // Le geste n'est pas parti : il est mis en attente ET la ligne revient a l'ecran.
        // Un vigneron qui voit une ligne disparaitre croit le client traite ; lui laisser
        // croire ca alors que rien n'a ete ecrit est la pire des issues.
        enfiler({ cle: cle, id: clientId });
        var e = lireMiroir();
        if (e) { e.signaux = signauxAvant; e.suivi = suiviAvant; ecrireMiroir(e); }
        return false;
      });
  }

  window.BdvCrm = {
    GESTES: GESTES,
    charger: charger,
    miroir: lireMiroir,
    file: file,
    geste: geste,
    rejouer: rejouer
  };
})();
