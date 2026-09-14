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
  /* L'INVITATION PART PAR MAIL, 14/09/2026, demande de Ted.
     ================================================================
     La fonction serveur `invitation` ne verifie AUCUN droit de son cote : elle
     rappelle `rpc/inviter` avec le jeton de session de celui qui clique, et c'est la
     base qui decide. Les refus arrivent donc en francais, ecrits dans le SQL pour le
     vigneron : « seul un maitre de ce bureau peut inviter », « cette personne est
     deja dans ce bureau », le plafond de vingt par jour.

     LE JETON NE REVIENT PLUS AU NAVIGATEUR quand le mail est parti, et c'est un
     progres sur le lien a copier : le secret ne s'affiche plus, ne traine pas dans
     une capture d'ecran et ne reste pas dans le presse-papier.

     IL REVIENT SI L'ENVOI A ECHOUE, et c'est la moitie qui compte : l'invitation
     EXISTE quand meme en base, elle vaut sept jours, et perdre le lien parce que
     Resend a tousse serait perdre le geste entier. */
  async function inviter(adresse, role) {
    dire('');
    var r;
    try {
      r = await BdvCompte.fonction('invitation',
        { bureau: BdvCompte.monBureau(), email: adresse, role: role });
    } catch (e) { dire((e && e.message) || raison(e), true); return; }

    var zone = el('equipeLien');
    if (r && r.envoye) {
      if (zone) zone.hidden = true;
      dire('Invitation envoyée à ' + adresse + '. Le lien vaut sept jours.');
    } else {
      var champ = el('equipeLienTexte');
      if (zone && champ && r && r.lien) {
        champ.value = r.lien;
        zone.hidden = false;
        champ.focus();
        champ.select();
        var q = el('equipeLienQui');
        if (q) q.textContent = adresse;
      }
      dire('L’invitation est créée, mais le mail n’est pas parti'
        + ((r && r.motif) ? ' (' + r.motif + ')' : '')
        + '. Copie le lien ci-dessous et envoie-le toi-même.', true);
    }
    await rendreInvitations();
  }

  /* ---------------- QUAND ON N'APPARTIENT A AUCUN BUREAU ----------------
     Etat possible depuis le lot 20 : quelqu'un qui s'est inscrit PAR une invitation
     n'a pas de bureau solo, et le jour ou on le retire il n'en a plus aucun. C'est
     un etat valide, pas une panne, et il doit se dire en toutes lettres avec une
     sortie. Sans cet ecran, tout le bureau serait muet : `pret()` est faux partout,
     donc aucune requete ne part, et rien n'expliquerait pourquoi. */
  function montrerAucunBureau() {
    var bloc = el('equipeAucun');
    if (bloc) bloc.hidden = false;
    ['equipeBureauBloc', 'equipeInviterForme', 'equipeAttentesBloc', 'equipeLien']
      .forEach(function (id) { var n = el(id); if (n) n.hidden = true; });
    var liste = el('equipeListe'); if (liste) liste.innerHTML = '';
    var note = el('equipeNoteSimple'); if (note) note.hidden = true;
    var partir = el('equipePartir'); if (partir) partir.hidden = true;
  }

  async function creerBureau(nom) {
    dire('');
    var b;
    try { b = await rpc('creer_bureau', { nom: nom }); }
    catch (e) { dire(raison(e), true); return; }
    if (typeof b !== 'string' || !b) { dire('Le bureau n’a pas pu être créé.', true); return; }
    // Meme chemin que le selecteur : on entre dans un bureau, donc on vide le poste.
    BdvCompte.poserBureau(null);
    await BdvCompte.changerDeBureau(b);
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

    var creer = el('equipeAucunCreer');
    if (creer) creer.addEventListener('click', function (ev) {
      ev.preventDefault();
      var nom = (el('equipeAucunNom') || {}).value || '';
      if (!nom.trim()) { dire('Il manque le nom de ton bureau.', true); return; }
      creerBureau(nom.trim());
    });

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
    var aucun = el('equipeAucun');
    if (aucun) aucun.hidden = true;
    /* SANS BUREAU MAIS AVEC UNE SESSION, ce n'est pas « pas pret », c'est un etat
       nomme. Le distinguer de « pas de session » est tout l'interet : l'un se dit,
       l'autre se tait. */
    if (!pret()) {
      if (window.BdvCompte && BdvCompte.session && BdvCompte.session()) montrerAucunBureau();
      return;
    }
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
    var adresse = String(inv.email || '');
    var connecte = !!(BdvCompte.session && BdvCompte.session());

    /* DEUX CHEMINS NETS, ET PAS UN BOUTON POUR LES DEUX, 14/09/2026.
       Un bouton « Me connecter » unique envoyait quelqu'un qui n'a pas de compte se
       cogner a un ecran de connexion. La question « as-tu deja un compte ? » se pose
       ICI, ou la personne connait la reponse, et pas trois ecrans plus loin.

       ET L'ADRESSE EST DITE, puis IMPOSEE au formulaire. Sans elle, l'invite cree un
       compte avec l'adresse de son choix, et l'acceptation echoue APRES coup sur
       « cette invitation a ete envoyee a une autre adresse », c'est-a-dire au pire
       moment : une fois le compte cree. */
    bandeau('<p class="invitation__titre">' + qui + ' t’invite à travailler dans '
      + '<strong>' + ou + '</strong>.</p>'
      + (connecte
        ? '<p class="invitation__note">Tu garderas aussi tes autres bureaux : tu passeras '
          + 'de l’un à l’autre quand tu veux.</p>'
          + '<button type="button" class="btn" id="invitationOui">Rejoindre ' + ou + '</button>'
        : '<p class="invitation__note">L’invitation a été envoyée à <strong>' + esc(adresse)
          + '</strong>. C’est avec cette adresse-là, et elle seule, que tu rejoindras '
          + ou + '.</p>'
          + '<p class="invitation__gestes">'
          + '<button type="button" class="btn" id="invitationInscription">Je crée mon compte</button>'
          + '<button type="button" class="btn btn--geste" id="invitationConnexion">J’ai déjà un compte</button>'
          + '</p>'));

    var oui = el('invitationOui');
    if (oui) oui.addEventListener('click', function () {
      oui.disabled = true;
      oui.textContent = 'Un instant…';
      accepter(jeton);
    });
    function porte(mode) {
      if (BdvCompte.ouvrir) BdvCompte.ouvrir({ mode: mode, email: adresse });
    }
    var neuf = el('invitationInscription');
    if (neuf) neuf.addEventListener('click', function () { porte('inscription'); });
    var deja = el('invitationConnexion');
    if (deja) deja.addEventListener('click', function () { porte('connexion'); });
  }

  /* La session peut s'ouvrir APRES l'affichage du bandeau : c'est meme le cas
     normal quand l'invite n'avait pas de compte. On repasse donc par le meme
     chemin a l'arrivee de la session, ce qui remplace le bouton « Me connecter »
     par « Rejoindre ». Meme motif que toutes les pages qui ecoutent bdv:session. */
  document.addEventListener('bdv:session', function () { traiterInvitation(); });

  window.BdvEquipe = { ouvrir: ouvrir, traiterInvitation: traiterInvitation };
})();
