/* ================================================================
   LE BUREAU DU VIGNERON, la piece « L'equipe »
   ----------------------------------------------------------------
   Ecrit le 13/09/2026, lot 19 du chantier multi-utilisateurs.

   CE FICHIER NE DECIDE D'AUCUN DROIT. Tout ce qu'il fait passe par sept
   fonctions de la base (lot 18), qui verifient chacune qui appelle AVANT
   d'ecrire. L'ecran cache les boutons qu'un simple utilisateur ne peut pas
   utiliser, mais cacher un bouton n'a jamais empeche un appel : c'est la base
   qui refuse, et c'est elle qui fait foi.

   L'INVITATION EST UN LIEN, PAS UN MAIL. Le maitre invite une adresse, la base
   rend un jeton UNE fois, et l'ecran l'affiche sous forme de lien a copier. Ce
   choix vient de la regle du SEUIL de CLAUDE.md : au premier destinataire qui
   n'est pas Ted, envoyer un mail obligerait a sortir du sous-domaine `courrier.`,
   a passer Resend au palier payant et a ecrire les textes legaux. Un lien ne
   declenche aucun des trois.

   LE JETON NE S'AFFICHE QU'UNE FOIS, et il faut le DIRE au moment ou il
   s'affiche : la base n'en garde que l'empreinte, personne ne pourra le
   retrouver, et un lien perdu se remplace en reinvitant la meme adresse.
   ================================================================ */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }
  function pret() {
    return !!(window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau());
  }
  function rpc(nom, corps) {
    return BdvCompte.api('/rpc/' + nom, { methode: 'POST', corps: corps || {} });
  }

  /* Le message d'une erreur de la base arrive dans `detail`, en JSON, sous la cle
     `message`. Sans ce depiautage l'ecran afficherait « Supabase a refuse /rpc/inviter
     (400) » a un vigneron, au lieu de « cette personne est deja dans ce bureau », qui
     est la phrase ecrite expres pour lui dans la fonction SQL. */
  function raison(e) {
    try {
      var d = JSON.parse(e && e.detail);
      if (d && d.message) return String(d.message);
    } catch (x) {}
    return (e && e.message) || 'Quelque chose n’a pas fonctionné.';
  }

  function dire(texte, mauvais) {
    var n = el('equipeAvis');
    if (!n) return;
    n.textContent = texte || '';
    n.hidden = !texte;
    n.classList.toggle('equipe-avis--souci', !!mauvais);
  }

  /* ---------------- L'ETAT ----------------
     MAITRE n'est PAS un droit, c'est un affichage. La base decide. */
  var MAITRE = false;
  var MOI = null;

  function nomDe(m) {
    var n = [m.prenom, m.nom].filter(Boolean).join(' ').trim();
    return n || m.email;
  }

  /* ---------------- DANS QUEL BUREAU SUIS-JE ----------------
     Le bloc reste masque tant qu'il n'y a qu'un bureau : un selecteur a une seule
     ligne est un ecran mort, et il apprend au vigneron a ne plus regarder ici.

     LE CHANGEMENT PASSE PAR BdvCompte.changerDeBureau(), et surtout pas par un
     simple appel a la base : ce navigateur porte encore les lignes de vente du
     bureau qu'on quitte, et entrer dans un autre sans vider le poste melangerait
     les deux ardoises sans lever la moindre erreur. */
  async function rendreBureaux() {
    var bloc = el('equipeBureauBloc'), choix = el('equipeBureauChoix');
    if (!bloc || !choix) return;
    var liste = await BdvCompte.mesBureaux();
    if (!liste || liste.length < 2) { bloc.hidden = true; return; }
    var ici = BdvCompte.monBureau();
    choix.innerHTML = liste.map(function (b) {
      return '<option value="' + esc(b.bureau) + '"' + (b.bureau === ici ? ' selected' : '') + '>'
        + esc(b.nom) + (b.role === 'maitre' ? ' \u2014 ma\u00eetre' : '') + '</option>';
    }).join('');
    bloc.hidden = false;
  }

  /* ---------------- QUI EST LA ---------------- */
  async function rendreEquipe() {
    var zone = el('equipeListe');
    if (!zone) return;
    var gens = await rpc('equipe', { b: BdvCompte.monBureau() });
    if (!Array.isArray(gens)) return;
    MOI = BdvCompte.monId();
    MAITRE = gens.some(function (g) { return g.personne === MOI && g.role === 'maitre'; });

    zone.innerHTML = gens.map(function (g) {
      var cestMoi = g.personne === MOI;
      var gestes = '';
      /* On ne se retrograde pas soi-meme depuis cette liste, et on ne se retire pas
         par le meme bouton que les autres : « partir » est un geste a part, en bas,
         parce qu'il ne ressemble pas a « retirer quelqu'un ». */
      if (MAITRE && !cestMoi) {
        gestes = '<button type="button" class="btn btn--geste" data-role="'
          + (g.role === 'maitre' ? 'simple' : 'maitre') + '" data-qui="' + esc(g.personne) + '">'
          + (g.role === 'maitre' ? 'Repasser en simple' : 'Nommer maître') + '</button>'
          + ' <button type="button" class="btn btn--geste" data-retirer="' + esc(g.personne) + '"'
          + ' data-nom="' + esc(nomDe(g)) + '">Retirer</button>';
      }
      /* LE NOM ET L'ADRESSE SONT DANS LA MEME COLONNE, empiles. En colonnes separees,
         l'adresse flottait au milieu de la ligne, loin du nom qu'elle designe : vu a la
         capture du 14/09/2026, et parfaitement invisible a la lecture du code. */
      return '<li class="equipe-ligne">'
        + '<span class="equipe-ligne__qui">'
        + '<span class="equipe-ligne__nom">' + esc(nomDe(g))
        + (cestMoi ? ' <span class="equipe-ligne__moi">(toi)</span>' : '') + '</span>'
        + '<span class="equipe-ligne__adresse">' + esc(g.email) + '</span>'
        + '</span>'
        + '<span class="equipe-role equipe-role--' + esc(g.role) + '">'
        + (g.role === 'maitre' ? 'Maître' : 'Utilisateur') + '</span>'
        + '<span class="equipe-ligne__gestes">' + gestes + '</span>'
        + '</li>';
    }).join('');

    var f = el('equipeInviterForme');
    if (f) f.hidden = !MAITRE;
    var note = el('equipeNoteSimple');
    if (note) note.hidden = MAITRE;
    var partir = el('equipePartir');
    if (partir) partir.hidden = false;
  }

  /* ---------------- LES INVITATIONS QUI ATTENDENT ----------------
     Un maitre seul les lit : la politique de securite de `invitations` le dit, et
     l'appel rendrait un tableau vide pour quelqu'un d'autre. On ne montre donc pas
     la zone du tout plutot qu'une liste vide qui ne se remplira jamais. */
  async function rendreInvitations() {
    var zone = el('equipeAttentes');
    var bloc = el('equipeAttentesBloc');
    if (!zone || !bloc) return;
    if (!MAITRE) { bloc.hidden = true; return; }

    var lignes = await BdvCompte.api('/invitations?select=email,role,cree_le,expire_le,utilise_le'
      + '&bureau=eq.' + encodeURIComponent(BdvCompte.monBureau())
      + '&utilise_le=is.null&order=cree_le.desc');
    if (!Array.isArray(lignes)) { bloc.hidden = true; return; }
    bloc.hidden = lignes.length === 0;
    zone.innerHTML = lignes.map(function (l) {
      var expiree = new Date(l.expire_le) < new Date();
      return '<li class="equipe-ligne">'
        + '<span class="equipe-ligne__qui">'
        + '<span class="equipe-ligne__nom">' + esc(l.email) + '</span>'
        + '<span class="equipe-ligne__adresse">'
        + (expiree ? 'lien expiré' : 'en attente')
        + '</span></span>'
        + '<span class="equipe-role equipe-role--' + esc(l.role) + '">'
        + (l.role === 'maitre' ? 'Maître' : 'Utilisateur') + '</span>'
        + '<span class="equipe-ligne__gestes">'
        + '<button type="button" class="btn btn--geste" data-annuler="' + esc(l.email) + '">Annuler</button>'
        + '</span></li>';
    }).join('');
  }

  /* ---------------- INVITER ---------------- */
  async function inviter(adresse, role) {
    dire('');
    var jeton;
    try {
      jeton = await rpc('inviter', { b: BdvCompte.monBureau(), courriel: adresse, r: role });
    } catch (e) { dire(raison(e), true); return; }
    if (typeof jeton !== 'string' || !jeton) { dire('Le lien n’a pas pu être créé.', true); return; }

    var lien = location.origin + '/mon-bureau/?invitation=' + encodeURIComponent(jeton);
    var zone = el('equipeLien');
    var champ = el('equipeLienTexte');
    if (zone && champ) {
      champ.value = lien;
      zone.hidden = false;
      champ.focus();
      champ.select();
    }
    var q = el('equipeLienQui');
    if (q) q.textContent = adresse;
    await rendreInvitations();
  }

  /* ---------------- LES GESTES DE LA LISTE ---------------- */
  async function surClic(ev) {
    var b = ev.target.closest && ev.target.closest('button');
    if (!b) return;

    if (b.dataset.role) {
      ev.preventDefault();
      try {
        await rpc('changer_role', { b: BdvCompte.monBureau(), personne_ciblee: b.dataset.qui, r: b.dataset.role });
        await rendreEquipe();
        dire('C’est fait.');
      } catch (e) { dire(raison(e), true); }
      return;
    }

    if (b.dataset.retirer) {
      ev.preventDefault();
      /* UNE CONFIRMATION, parce que le geste ne se rattrape pas tout seul : il faudra
         reinviter, et la personne devra reaccepter. Le nom est dans la question, pas
         seulement dans la ligne : on confirme QUI on retire. */
      if (!window.confirm('Retirer ' + b.dataset.nom + ' de ce bureau ?\n\n'
        + 'Ses notes et ses échanges restent dans le bureau. Il faudra une nouvelle '
        + 'invitation pour le faire revenir.')) return;
      try {
        await rpc('retirer_membre', { b: BdvCompte.monBureau(), personne_ciblee: b.dataset.retirer });
        await rendreEquipe();
        dire('C’est fait.');
      } catch (e) { dire(raison(e), true); }
      return;
    }

    if (b.dataset.annuler) {
      ev.preventDefault();
      try {
        await rpc('annuler_invitation', { b: BdvCompte.monBureau(), courriel: b.dataset.annuler });
        await rendreInvitations();
        dire('Invitation annulée. Le lien ne marche plus.');
      } catch (e) { dire(raison(e), true); }
      return;
    }
  }

  /* ---------------- PARTIR SOI-MEME ---------------- */
  async function partir() {
    if (!window.confirm('Quitter ce bureau ?\n\n'
      + 'Tu n’auras plus accès à ses ventes, à ses clients ni à ses tâches. '
      + 'Ce que tu y as écrit reste dans le bureau.')) return;
    try {
      await rpc('retirer_membre', { b: BdvCompte.monBureau(), personne_ciblee: BdvCompte.monId() });
    } catch (e) { dire(raison(e), true); return; }
    /* On ne rafraichit pas l'ecran : on vient de quitter le bureau qu'il affiche.
       Le bureau courant a ete range cote base, on repart donc d'une page neuve, et
       le poste est vide comme a tout changement de bureau. */
    var autres = await BdvCompte.mesBureaux();
    if (autres && autres.length) { BdvCompte.changerDeBureau(autres[0].bureau); }
    else { location.replace('/mon-bureau/'); }
  }

  /* ---------------- L'ECRAN ---------------- */
  var MONTE = false;

  function monter() {
    if (MONTE) return;
    MONTE = true;
    var l = el('equipeListe'); if (l) l.addEventListener('click', surClic);
    var a = el('equipeAttentes'); if (a) a.addEventListener('click', surClic);

    var f = el('equipeInviterForme');
    if (f) f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var adresse = (el('equipeAdresse') || {}).value || '';
      var role = (el('equipeRole') || {}).value || 'simple';
      if (!adresse.trim()) { dire('Il manque l’adresse.', true); return; }
      inviter(adresse.trim(), role);
    });

    var copier = el('equipeCopier');
    if (copier) copier.addEventListener('click', function () {
      var champ = el('equipeLienTexte');
      if (!champ) return;
      champ.select();
      /* `navigator.clipboard` n'existe pas partout et demande une origine sure ; le
         champ reste selectionne dans tous les cas, donc un Cmd+C marche meme si la
         copie automatique echoue. On ne promet donc jamais « copie » sans le savoir. */
      var fait = false;
      try { fait = document.execCommand && document.execCommand('copy'); } catch (e) {}
      if (!fait && navigator.clipboard) {
        navigator.clipboard.writeText(champ.value).then(function () {
          dire('Lien copié. Envoie-le à la personne invitée.');
        })['catch'](function () { dire('Sélectionne le lien et copie-le à la main.', true); });
        return;
      }
      dire(fait ? 'Lien copié. Envoie-le à la personne invitée.'
                : 'Sélectionne le lien et copie-le à la main.', !fait);
    });

    var p = el('equipePartir');
    if (p) p.addEventListener('click', function (ev) { ev.preventDefault(); partir(); });

    var aller = el('equipeBureauAller');
    if (aller) aller.addEventListener('click', async function () {
      var choix = el('equipeBureauChoix');
      if (!choix || !choix.value || choix.value === BdvCompte.monBureau()) return;
      aller.disabled = true;
      aller.textContent = 'Un instant\u2026';
      try { await BdvCompte.changerDeBureau(choix.value); }
      catch (e) {
        aller.disabled = false;
        aller.textContent = 'Y aller';
        dire(raison(e), true);
      }
    });
  }

  async function ouvrir() {
    monter();
    if (!pret()) return;
    dire('');
    var lien = el('equipeLien'); if (lien) lien.hidden = true;
    try {
      await rendreBureaux();
      await rendreEquipe();
      await rendreInvitations();
    } catch (e) { dire('La liste n’a pas pu être lue. Vérifie ta connexion.', true); }
  }

  /* ================================================================
     RECEVOIR UNE INVITATION
     ================================================================
     L'adresse est /mon-bureau/?invitation=<jeton>. Deux cas, et le second est le
     plus frequent : la personne invitee n'a pas encore de compte.

     L'APERCU SE LIT SANS SESSION, c'est pour ca que la fonction SQL est ouverte a
     `anon` : quelqu'un doit pouvoir savoir QUI l'invite et OU avant de decider de
     creer un compte. Elle ne dit pas si l'adresse correspond, la verification a
     lieu a l'acceptation.

     LE JETON SURVIT A LA CONNEXION dans `sessionStorage` et pas dans `localStorage` :
     une invitation est le geste d'un instant, elle n'a aucune raison de survivre a
     la fermeture du navigateur, et encore moins de se retrouver chez la personne
     suivante qui ouvre une session sur le meme poste. C'est la lecon du brouillon
     de la fiche client, 11/09/2026. */
  var JETON_KEY = 'bdv_invitation_en_cours';

  function jetonDeLAdresse() {
    try {
      var u = new URL(location.href);
      return u.searchParams.get('invitation') || null;
    } catch (e) { return null; }
  }

  function nettoyerLAdresse() {
    try {
      var u = new URL(location.href);
      u.searchParams.delete('invitation');
      history.replaceState(null, '', u.pathname + (u.search || '') + (u.hash || ''));
    } catch (e) {}
  }

  function bandeau(html) {
    var n = el('invitationBandeau');
    if (!n) return;
    n.innerHTML = html;
    n.hidden = false;
  }

  async function accepter(jeton) {
    try {
      var b = await rpc('accepter_invitation', { jeton: jeton });
      try { sessionStorage.removeItem(JETON_KEY); } catch (e) {}
      if (typeof b !== 'string' || !b) throw new Error('bureau inconnu');
      /* MEME CHEMIN QUE LE SELECTEUR, et pour la meme raison : ce navigateur porte
         encore les lignes de vente du bureau precedent. Entrer dans un bureau sans
         vider le poste melangerait les deux bases. */
      BdvCompte.poserBureau(null);
      await BdvCompte.changerDeBureau(b);
    } catch (e) {
      bandeau('<p class="invitation__souci">' + esc(raison(e)) + '</p>');
    }
  }

  async function traiterInvitation() {
    var jeton = jetonDeLAdresse();
    if (jeton) {
      try { sessionStorage.setItem(JETON_KEY, jeton); } catch (e) {}
      nettoyerLAdresse();
    } else {
      try { jeton = sessionStorage.getItem(JETON_KEY); } catch (e) { jeton = null; }
    }
    if (!jeton) return;

    var vu;
    try { vu = await BdvCompte.rpcPublic('invitation_apercu', { jeton: jeton }); }
    catch (e) { vu = null; }
    var inv = Array.isArray(vu) ? vu[0] : null;

    if (!inv) {
      try { sessionStorage.removeItem(JETON_KEY); } catch (e) {}
      bandeau('<p class="invitation__souci">Ce lien d’invitation n’est pas valable. '
        + 'Demande à la personne qui t’a invité d’en renvoyer un.</p>');
      return;
    }
    if (inv.etat !== 'valide') {
      try { sessionStorage.removeItem(JETON_KEY); } catch (e) {}
      bandeau('<p class="invitation__souci">Ce lien a ' + (inv.etat === 'utilisee'
        ? 'déjà servi' : 'expiré') + '. Demande à '
        + esc(inv.invite_par_prenom) + ' d’en renvoyer un.</p>');
      return;
    }

    var qui = esc(inv.invite_par_prenom), ou = esc(inv.bureau_nom);
    var connecte = !!(BdvCompte.session && BdvCompte.session());

    bandeau('<p class="invitation__titre">' + qui + ' t’invite à travailler dans '
      + '<strong>' + ou + '</strong>.</p>'
      + (connecte
        ? '<p class="invitation__note">Tu garderas aussi ton propre bureau : tu passeras '
          + 'de l’un à l’autre quand tu veux.</p>'
          + '<button type="button" class="btn" id="invitationOui">Rejoindre ' + ou + '</button>'
        : '<p class="invitation__note">Connecte-toi avec l’adresse à laquelle '
          + 'l’invitation a été envoyée, ou crée ton compte : '
          + 'tu rejoindras ' + ou + ' juste après.</p>'
          + '<button type="button" class="btn" id="invitationPorte">Me connecter</button>'));

    var oui = el('invitationOui');
    if (oui) oui.addEventListener('click', function () {
      oui.disabled = true;
      oui.textContent = 'Un instant…';
      accepter(jeton);
    });
    var porte = el('invitationPorte');
    if (porte) porte.addEventListener('click', function () {
      if (BdvCompte.ouvrir) BdvCompte.ouvrir({});
    });
  }

  /* La session peut s'ouvrir APRES l'affichage du bandeau : c'est meme le cas
     normal quand l'invite n'avait pas de compte. On repasse donc par le meme
     chemin a l'arrivee de la session, ce qui remplace le bouton « Me connecter »
     par « Rejoindre ». Meme motif que toutes les pages qui ecoutent bdv:session. */
  document.addEventListener('bdv:session', function () { traiterInvitation(); });

  window.BdvEquipe = { ouvrir: ouvrir, traiterInvitation: traiterInvitation };
})();
