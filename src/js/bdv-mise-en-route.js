/* ============================================================================
   src/js/bdv-mise-en-route.js : LA MISE EN ROUTE DU BUREAU (09/10/2026)

   Demande de Ted : emmener le vigneron plus loin que prenom et genre, avec une
   barre de progression, et pouvoir reprendre quand on veut depuis Mes reglages.
   Conseil tenu le 09/10/2026 (vigneron, expert commercial, contradicteur), puis
   arbitrages de Ted :
     - on n'empeche JAMAIS d'entrer dans le bureau ; seule l'action a laquelle il
       manque une donnee est refusee (le devis sans fiche du domaine, l'envoi sans
       boite), et ce refus vit chez l'action, pas ici ;
     - une carte « Ta mise en route » en tete de Ma journee tant que ce n'est pas
       fini ; « Pas aujourd'hui » la cache pour la journee, elle revient demain ;
     - un bandeau et « Reprendre » en tete de Mes reglages, tant que ce n'est pas fini.

   LES QUATRE REGLES QUI TIENNENT CE FICHIER, et aucune n'est decorative :
   1. LA PROGRESSION SE CALCULE SUR L'ETAT REEL, a chaque lecture. Rien n'est coche
      a la main : une boite qui se debranche fait repasser son etape « a refaire ».
   2. AUCUN CHAMP N'EXISTE ICI. Chaque etape ouvre l'onglet de Mes reglages qui
      porte deja le reglage (BdvReglages.ouvrir), ou la piece qui le fait. Deux
      formulaires pour une meme donnee divergeraient au premier geste.
   3. UNE ABSENCE N'EST PAS UN ZERO. Une lecture ratee rend l'etape « inconnue » :
      elle n'est ni faite ni proposee. Sans profil ni role connus, on se tait.
   4. CHAQUE BARRE NE COMPTE QUE CE QUE LA PERSONNE PEUT FAIRE ELLE-MEME. Un membre
      invite n'a que trois etapes. Le courrier de 8 h, les notifications et
      l'equipe ne comptent jamais : un consentement n'est pas une tache (RGPD art. 7).
   ========================================================================== */
(function () {
  'use strict';

  var CLE_PAS = 'bdv_mer_pas_v1';   // « Pas aujourd'hui » : le jour, et rien d'autre
  var ETAT = null;                  // la derniere lecture, ou null tant qu'on ne sait pas
  var LECTURE = null;               // la lecture en cours, pour ne pas en lancer deux
  var OUVERT = false;               // la liste des etapes est-elle depliee
  var PROFIL = null;
  var VISER_BOITE = false;           // « branche ta boite » attend l'ouverture du panneau

  function el(id) { return document.getElementById(id); }
  function bureau() { return window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function jourLocal(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dateCourte(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  function api(chemin) { return BdvCompte.api(chemin); }

  /* ---------------- LES LECTURES ----------------
     Chacune rend une valeur, ou `null` quand elle n'a pas abouti. Jamais `false`
     pour « je ne sais pas » : c'est la regle 3. */
  async function lireRole(b) {
    try {
      var r = await BdvCompte.api('/rpc/est_maitre', { methode: 'POST', corps: { b: b } });
      return r === true ? 'admin' : (r === false ? 'membre' : null);
    } catch (e) { return null; }
  }
  async function lireReglages(b) {
    try {
      var l = await api('/reglages?select=depose_le,valide:classement->valide&bureau=eq.' + encodeURIComponent(b) + '&limit=1');
      if (!Array.isArray(l)) return null;
      var r = l[0] || {};
      return { depose: r.depose_le || null, valide: r.valide === true };
    } catch (e) { return null; }
  }
  async function lireAffaires(b) {
    try {
      var l = await api('/affaires?select=issue,rappel&bureau=eq.' + encodeURIComponent(b) + '&limit=200');
      if (!Array.isArray(l)) return null;
      return {
        une: l.length > 0,
        rappel: l.some(function (a) { return (a.issue === 'en_cours' && a.rappel) || a.issue === 'gagnee' || a.issue === 'perdue'; })
      };
    } catch (e) { return null; }
  }
  async function lireProfil() {
    if (PROFIL) return PROFIL;
    try {
      var l = await api('/profils?id=eq.' + encodeURIComponent(BdvCompte.monId()) + '&select=prenom,utilise_vitisoft');
      return Array.isArray(l) ? (l[0] || {}) : null;
    } catch (e) { return null; }
  }

  /* ---------------- LES ETAPES ----------------
     `fait` vaut true, false, 'refaire' ou null (inconnu). `ouvrir` dit ou mene le bouton. */
  function etapes(x) {
    var p = x.profil || {};
    var qui = { cle: 'qui', nom: 'Qui tu es', min: '1 min', onglet: 'bdvrBlocToi',
      ex: 'Ton prénom et si tu utilises Vitisoft : ton bureau te parle comme il faut.',
      fait: !!(p.prenom && String(p.prenom).trim()) && (p.utilise_vitisoft === 'oui' || p.utilise_vitisoft === 'non') };

    var boite = window.BdvBoite && BdvBoite._etat ? BdvBoite._etat() : null;
    var mailsFait = null;
    if (boite && boite.LU) {
      if (window.BdvBoite.prete && BdvBoite.prete('affaires')) mailsFait = true;
      else if (boite.BOITE && boite.BOITE.etat === 'reconnecter') mailsFait = 'refaire';
      else mailsFait = false;
    }
    var mails = { cle: 'mails', nom: 'Tes mails à ton nom', min: '3 min', onglet: 'envois',
      ex: 'Branche ta boîte : tes mails aux clients partent de ton adresse, et les réponses arrivent chez toi.',
      refaire: 'L’accès à ta boîte a été coupé : tes mails ne partent plus du bureau. Reconnecte-la, une minute.', minRefaire: '1 min',
      fait: mailsFait };

    if (x.role === 'membre') {
      var sig = window.BdvSignature && BdvSignature.lue && BdvSignature.lue() ? (BdvSignature.perso() || null) : undefined;
      var sigFait = sig === undefined ? null : !!(sig && (sig.nom || sig.messagerie_signe === true));
      return [qui,
        { cle: 'signature', nom: 'Ta signature', min: '2 min', onglet: 'envois',
          ex: 'Ton nom et ton numéro sous tes mails. Le bloc du domaine est déjà réglé.', fait: sigFait },
        mails];
    }

    var dom = null;
    if (window.BdvDomaine && BdvDomaine.lue && BdvDomaine.lue()) dom = BdvDomaine.complete();
    var domaine = { cle: 'domaine', nom: 'Ton domaine', min: '1 min', onglet: 'bdvrBlocDomaine',
      ex: 'Ce qui s’imprime en haut de tes devis. Ton SIREN suffit, l’annuaire remplit le reste.', fait: dom };

    var r = x.reglages, a = x.affaires;
    if (p.utilise_vitisoft === 'non') {
      return [qui, domaine,
        { cle: 'affaire', nom: 'Ta première affaire', min: '2 min', piece: 'affaires',
          ex: 'Le caviste ou le restaurant que tu veux décrocher cette saison.', fait: a ? a.une : null },
        { cle: 'rappel', nom: 'Son rappel', min: '30 s', piece: 'affaires',
          ex: 'Le jour où tu le rappelles : il remontera tout seul ce matin-là dans Ma journée.', fait: a ? a.rappel : null },
        mails];
    }
    return [qui, domaine,
      { cle: 'base', nom: 'Ta base Vitisoft', min: '3 min', onglet: 'base',
        ex: r && r.depose ? 'Déposée le ' + dateCourte(r.depose) + '. Tes clients à rappeler en sortent.'
          : 'Dépose ton export de ventes Vitisoft : tes clients à rappeler en sortent.',
        fait: r ? !!r.depose : null },
      { cle: 'classement', nom: 'Tes chiffres justes', min: '2 min', onglet: 'classement', ongletNom: 'Le classement',
        ex: 'Coche ce qui compte dans ton chiffre d’affaires. Tant que ce n’est pas fait, je le devine.',
        fait: r ? r.valide : null },
      mails];
  }

  /* La prochaine etape : d'abord une etape a refaire (elle a casse quelque chose qui
     marchait), sinon la premiere pas faite. Jamais une etape inconnue. */
  function prochaine(l) {
    for (var i = 0; i < l.length; i++) if (l[i].fait === 'refaire') return l[i];
    for (var j = 0; j < l.length; j++) if (l[j].fait === false) return l[j];
    return null;
  }
  function compte(l) {
    return l.filter(function (e) { return e.fait === true; }).length;
  }
  function minutes(l) {
    var t = 0;
    l.forEach(function (e) {
      if (e.fait === true || e.fait === null) return;
      var mm = e.fait === 'refaire' && e.minRefaire ? e.minRefaire : e.min;
      var m = /^(\d+)\s*min/.exec(mm); var s = /^(\d+)\s*s/.exec(mm);
      t += m ? +m[1] : (s ? +s[1] / 60 : 0);
    });
    return Math.max(1, Math.round(t));
  }

  /* ---------------- LA LECTURE COMPLETE ---------------- */
  function lire() {
    if (LECTURE) return LECTURE;
    var b = bureau();
    if (!b || !window.BdvCompte || !BdvCompte.api) return Promise.resolve(null);
    LECTURE = (async function () {
      var profil = await lireProfil();
      var role = await lireRole(b);
      if (!profil || !role) { ETAT = null; return null; }
      if (profil && !PROFIL) PROFIL = profil;
      var attentes = [];
      if (window.BdvBoite && BdvBoite.charger && BdvBoite._etat && !BdvBoite._etat().LU) attentes.push(BdvBoite.charger().catch(function () {}));
      if (role === 'membre') {
        if (window.BdvSignature && BdvSignature.charger && !BdvSignature.lue()) attentes.push(BdvSignature.charger());
      } else if (window.BdvDomaine && BdvDomaine.charger && !BdvDomaine.lue()) attentes.push(BdvDomaine.charger().catch(function () {}));
      var reg = null, aff = null;
      if (role === 'admin') {
        if (profil.utilise_vitisoft === 'non') aff = lireAffaires(b); else reg = lireReglages(b);
      }
      await Promise.all(attentes);
      var x = { profil: profil, role: role, reglages: reg ? await reg : null, affaires: aff ? await aff : null };
      var l = etapes(x);
      ETAT = { role: role, liste: l, fait: compte(l), total: l.length, suite: prochaine(l) };
      return ETAT;
    })().finally(function () { LECTURE = null; });
    return LECTURE;
  }

  /* ---------------- LE DESSIN ---------------- */
  function pasAujourdhui() {
    try { return localStorage.getItem(CLE_PAS) === jourLocal(); } catch (e) { return false; }
  }
  function fini(e) { return !e || (e.fait === e.total && !e.liste.some(function (x) { return x.fait === 'refaire'; })); }

  function htmlPas(e) {
    return '<div class="mer__pas" aria-hidden="true">' + e.liste.map(function (x) {
      return '<span class="mer__seg' + (x.fait === true ? ' mer__seg--fait' : x.fait === 'refaire' ? ' mer__seg--refaire' : '') + '"></span>';
    }).join('') + '</div>';
  }
  function htmlCompte(e) {
    var refaire = e.liste.filter(function (x) { return x.fait === 'refaire'; }).length;
    return '<span class="mer__compte">' + e.fait + ' sur ' + e.total
      + (refaire ? ', <span class="mer__compte-r">' + refaire + ' à refaire</span>' : '') + '</span>'
      + '<span class="mer__reste">reste ' + minutes(e.liste) + ' min</span>';
  }
  function libelleGeste(x) {
    if (x.fait === 'refaire') return 'La reconnecter';
    return x.cle === 'affaire' ? 'La créer' : 'Le faire';
  }
  function htmlListe(e) {
    var s = '<ol class="mer__etapes">';
    e.liste.forEach(function (x, i) {
      var etat = x.fait === true ? 'fait' : x.fait === 'refaire' ? 'refaire' : x.fait === null ? 'inconnu' : 'afaire';
      var marque = etat === 'fait' ? '<span class="hors-ecran">fait : </span>✓' : etat === 'refaire' ? '<span class="hors-ecran">à refaire : </span>!' : String(i + 1);
      var geste = '';
      if (etat === 'fait') geste = x.cle === 'qui' ? '' : '<button type="button" class="mer__lien" data-mer="aller" data-cle="' + x.cle + '">Revoir</button>';
      else if (etat !== 'inconnu') geste = '<button type="button" class="' + (x === e.suite ? 'btn btn--bordeaux' : 'mer__lien') + '" data-mer="aller" data-cle="' + x.cle + '">' + esc(libelleGeste(x)) + '</button>';
      s += '<li class="mer__etape mer__etape--' + etat + '"><span class="mer__marque">' + marque + '</span>'
        + '<div><p class="mer__nom">' + esc(x.nom) + (etat === 'fait' ? '' : ' <small>' + esc(etat === 'refaire' && x.minRefaire ? x.minRefaire : x.min) + '</small>') + '</p>'
        + '<p class="mer__ex">' + esc(etat === 'refaire' ? x.refaire : etat === 'inconnu' ? 'Je n’arrive pas à le vérifier pour l’instant.' : x.ex) + '</p></div>'
        + geste + '</li>';
    });
    s += '</ol>';
    s += '<p class="mer__sous">En plus, si tu veux <small>ne compte pas dans la barre</small></p>'
      + '<ul class="mer__plus">'
      + '<li><span>Le courrier de 8 h : ta liste du jour dans ta boîte.</span><button type="button" class="mer__lien" data-mer="aller" data-onglet="courrier">Le recevoir</button></li>'
      + '<li><span>Les notifications sur cet appareil : tu sais tout de suite quand un devis est signé.</span><button type="button" class="mer__lien" data-mer="aller" data-onglet="courrier">Les activer</button></li>'
      + (e.role === 'admin' ? '<li><span>Ton équipe : invite qui touche aux clients avec toi.</span><button type="button" class="mer__lien" data-mer="aller" data-piece="equipe">Inviter</button></li>' : '')
      + '</ul>';
    return s;
  }

  function peindreCarte() {
    var z = el('bureauMer');
    if (!z) return;
    var e = ETAT;
    /* Rien a proposer (il ne reste que de l'inconnu) : une carte sans geste n'a rien a dire. */
    if (!e || fini(e) || !e.suite || pasAujourdhui()) { z.hidden = true; z.innerHTML = ''; return; }
    var x = e.suite;
    var s = '<div class="mer__tete"><h2 class="mer__titre" id="merTitre">Ta mise en route</h2>' + htmlCompte(e) + '</div>' + htmlPas(e);
    if (e.role === 'membre') s += '<p class="mer__chapeau">Ton bureau est déjà réglé. Il te reste ce qui est à toi.</p>';
    s += '<ul class="mer__noms" aria-hidden="true">' + e.liste.map(function (y) {
      return '<li class="' + (y.fait === true ? 'mer__nom--fait' : y.fait === 'refaire' ? 'mer__nom--refaire' : y === x ? 'mer__nom--suite' : '') + '">'
        + (y.fait === true ? '✓ ' : y.fait === 'refaire' ? '! ' : '') + esc(y.nom) + '</li>';
    }).join('') + '</ul>';
    if (OUVERT) {
      s += htmlListe(e);
      s += '<div class="mer__gestes mer__gestes--bas"><button type="button" class="mer__lien" data-mer="plier" aria-expanded="true">Replier</button>'
        + '<button type="button" class="mer__lien" data-mer="pas">Pas aujourd’hui</button></div>';
    } else if (x) {
      var refaire = x.fait === 'refaire';
      s += '<div class="mer__corps"><div class="mer__txt' + (refaire ? ' mer__txt--refaire' : '') + '">'
        + '<p class="mer__suite">' + (refaire ? '! ' : '') + esc(refaire ? 'Ta boîte mail ne répond plus' : x.nom) + ' <small>' + esc(refaire ? x.minRefaire : x.min) + '</small></p>'
        + '<p class="mer__ex">' + esc(refaire ? x.refaire : x.ex) + '</p></div>'
        + '<div class="mer__gestes"><button type="button" class="btn btn--bordeaux" data-mer="aller" data-cle="' + x.cle + '">' + esc(libelleGeste(x)) + '</button>'
        + '<button type="button" class="mer__lien" data-mer="deplier" aria-expanded="false">Voir les ' + e.total + ' étapes</button>'
        + '<button type="button" class="mer__lien" data-mer="pas">Pas aujourd’hui</button></div></div>';
    }
    z.innerHTML = s;
    z.style.setProperty('--mer-n', String(e.total));
    z.hidden = false;
  }

  /* Le bandeau de Mes reglages : il reste tant que ce n'est pas fini, MEME apres « Pas
     aujourd'hui ». C'est la qu'on reprend quand on veut. */
  function peindreBandeau() {
    var tete = document.querySelector('.bdvr-tete');
    var b = el('bdvrMer');
    var e = ETAT;
    document.querySelectorAll('.mer__af').forEach(function (n) { n.remove(); });
    if (!tete || !e || fini(e) || !e.suite) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('div');
      b.id = 'bdvrMer';
      b.className = 'mer-bandeau';
      var avant = el('bdvrOnglets');
      tete.insertBefore(b, avant || null);
    }
    b.style.setProperty('--mer-n', String(e.total));
    var x = e.suite;
    var ou = x.onglet ? ' dans l’onglet ' + (x.ongletNom || nomOnglet(x.onglet)) : (x.piece === 'affaires' ? ' dans Mon commerce' : '');
    b.innerHTML = htmlPas(e)
      + '<p class="mer-bandeau__x"><b>Ta mise en route : ' + e.fait + ' sur ' + e.total + '.</b> '
      + (ou ? '<span class="mer-bandeau__ou">' + esc(ou.replace(/^ dans l’onglet /, 'Onglet ').replace(/^ dans /, '')) + '</span>' : '')
      + '<span class="mer-bandeau__suite">'
      + (x.fait === 'refaire' ? 'À refaire : ta boîte mail' : 'Prochaine étape : ' + esc(x.nom.toLowerCase()))
      + esc(ou) + ', ' + esc(x.fait === 'refaire' && x.minRefaire ? x.minRefaire : x.min) + '.</span></p>'
      + '<button type="button" class="btn btn--bordeaux" data-mer="aller" data-cle="' + x.cle + '">Reprendre</button>';
    /* L'onglet concerne porte une marque de FORME, jamais un point de couleur seul. */
    if (x.onglet) {
      var id = idOnglet(x.onglet);
      var o = document.querySelector('.bdvr-onglet[data-cible="' + id + '"]');
      if (o) {
        /* Un « ! » cerclé, une FORME, et les mots pour qui écoute : en toutes lettres, l'étiquette
           faisait passer « L'agenda » sur une deuxième ligne d'onglets. Le bandeau, juste au-dessus,
           nomme déjà l'onglet en mots. */
        var s = document.createElement('span');
        s.className = 'mer__af';
        /* « ! » pour ce qui est casse, le NUMERO de l'etape pour ce qui reste a faire : le
           « ! » est deja le signe du retard, il ferait peur sur une simple etape (vigneron). */
        var num = e.liste.indexOf(x) + 1;
        s.innerHTML = '<span aria-hidden="true">' + (x.fait === 'refaire' ? '!' : num) + '</span><span class="hors-ecran">, ' + (x.fait === 'refaire' ? 'à refaire' : 'étape ' + num + ' à faire') + '</span>';
        o.appendChild(s);
      }
    }
  }
  var ALIAS = { classement: 'bdvrBlocClassement', base: 'bdvrBlocBase', ventes: 'bdvrBlocVentes',
    affaires: 'bdvrBlocAffaires', envois: 'bdvrBlocEnvois', courrier: 'bdvrBlocCourrier' };
  function idOnglet(o) { return ALIAS[o] || o; }
  function nomOnglet(o) {
    var b = el(idOnglet(o));
    return (b && b.getAttribute('data-onglet')) || '';
  }

  function peindre() { peindreCarte(); peindreBandeau(); }
  function relire() { return lire().then(peindre, peindre); }

  /* ---------------- LES GESTES ---------------- */
  function aller(n) {
    var cle = n.getAttribute('data-cle');
    var x = cle && ETAT ? ETAT.liste.filter(function (y) { return y.cle === cle; })[0] : null;
    var onglet = n.getAttribute('data-onglet') || (x && x.onglet);
    var piece = n.getAttribute('data-piece') || (x && x.piece);
    if (piece) {
      if (window.BdvReglages && BdvReglages.fermer && el('bdvrVoile') && !el('bdvrVoile').hidden) BdvReglages.fermer();
      if (window.BdvNav && BdvNav.afficher) BdvNav.afficher(piece);
      return;
    }
    if (!onglet) return;
    var cible = idOnglet(onglet);
    /* Mes envois, ouvert pour brancher sa boite : le branchement se montre en premier. Apres
       l'ouverture du panneau (`bdv:reglages`), qui relit la boite : avant, il l'effacerait. */
    var dejaOuvert = el('bdvrVoile') && !el('bdvrVoile').hidden;
    VISER_BOITE = cible === 'bdvrBlocEnvois' && (cle === 'mails' || !cle);
    if (window.BdvNav && BdvNav.ouvrirReglages) BdvNav.ouvrirReglages(cible);
    else if (window.BdvReglages) BdvReglages.ouvrir(cible);
    if (dejaOuvert && VISER_BOITE) { VISER_BOITE = false; if (window.BdvBoite && BdvBoite.viser) BdvBoite.viser(); }
  }
  document.addEventListener('click', function (ev) {
    var n = ev.target && ev.target.closest && ev.target.closest('[data-mer]');
    if (!n) return;
    var a = n.getAttribute('data-mer');
    if (a === 'aller') { aller(n); return; }
    if (a === 'pas') {
      try { localStorage.setItem(CLE_PAS, jourLocal()); } catch (e) {}
      OUVERT = false;
      peindreCarte();
      var t = el('bureauSalut'); if (t && t.focus) { t.setAttribute('tabindex', '-1'); t.focus(); }
      return;
    }
    if (a === 'deplier' || a === 'plier') {
      OUVERT = a === 'deplier';
      peindreCarte();
      var r = el('bureauMer') && el('bureauMer').querySelector(OUVERT ? '[data-mer="plier"]' : '[data-mer="deplier"]');
      if (r) r.focus();
    }
  });

  /* ---------------- QUAND ON RELIT ----------------
     Le profil arrive (bdv-reglages.js emet `bdv:profil`), le panneau se ferme (un
     reglage a pu changer), la boite change d'etat, une affaire bouge, et au retour sur
     l'onglet. Jamais en boucle. */
  document.addEventListener('bdv:profil', function (e) { if (e && e.detail) PROFIL = e.detail; relire(); });
  document.addEventListener('bdv:reglages', function (e) {
    if (e && e.detail && e.detail.ouvert) {
      peindreBandeau(); setTimeout(peindreBandeau, 0);
      if (VISER_BOITE) { VISER_BOITE = false; setTimeout(function () { if (window.BdvBoite && BdvBoite.viser) BdvBoite.viser(); }, 0); }
    }
    else relire();
  });
  document.addEventListener('bdv:boite', function () { if (ETAT) relire(); });
  document.addEventListener('bdv:domaine', function () { relire(); });
  document.addEventListener('bdv:taches', function () { if (ETAT && PROFIL && PROFIL.utilise_vitisoft === 'non') relire(); });
  document.addEventListener('bdv:bureau', function () { PROFIL = null; relire(); });
  var DERNIERE = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - DERNIERE < 60000) return;
    DERNIERE = Date.now();
    relire();
  });
  function demarrer() { DERNIERE = Date.now(); relire(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();

  window.BdvMiseEnRoute = { lire: lire, relire: relire, etat: function () { return ETAT; },
    _etapes: etapes, _prochaine: prochaine, _minutes: minutes, _peindre: peindre };
})();
