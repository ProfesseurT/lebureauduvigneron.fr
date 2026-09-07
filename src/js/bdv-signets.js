/* ===========================================================================
   LE BUREAU DU VIGNERON — LES SIGNETS
   ===========================================================================
   Ce que le vigneron met de cote, et ce qu'il a deja lu. C'est le premier
   service que le compte rend a quelqu'un qui n'utilise pas Vitisoft, donc la
   premiere raison pour lui d'en creer un.

   Ce module ne connait ni l'URL Supabase ni la cle anon : il passe par
   BdvCompte.api(), qui les porte deja et pose l'entete d'autorisation. Une
   seule copie de la configuration dans le site, c'est la regle.

   Trois etats, et un seul est vrai a la fois :
     absent   la ligne n'existe pas
     a_lire   mis de cote
     lu       lu, et garde en memoire pour pouvoir le griser dans les listes

   Le cache local n'est pas un stockage, c'est un miroir : il sert a peindre
   les boutons sans attendre le reseau. Le serveur fait foi a chaque
   chargement. Une ecriture qui echoue part dans une file d'attente et se
   rejoue plus tard, elle n'est jamais perdue ni affichee comme une panne.
   =========================================================================== */
(function () {
  'use strict';

  var CACHE_KEY   = 'bdv_signets_v1';
  var ATTENTE_KEY = 'bdv_signets_attente';

  var ETATS = {
    absent: { texte: 'Mettre de côté',  aide: 'Mettre cet article de côté' },
    a_lire: { texte: 'Mis de côté',     aide: 'Retirer de ma liste' },
    lu:     { texte: 'Déjà lu',         aide: 'Retirer de ma liste' }
  };

  // ---------------- LE MIROIR LOCAL ----------------
  function lireCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function ecrireCache(map) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function etatDe(ref) {
    var l = lireCache()[ref];
    return (l && l.etat) ? l.etat : 'absent';
  }

  function session() {
    return (window.BdvCompte && BdvCompte.session()) || null;
  }

  // ---------------- LA FILE D'ATTENTE ----------------
  // Une ecriture refusee par le reseau est mise de cote telle quelle et rejouee au prochain
  // chargement. Une meme reference ne s'empile pas : seul son dernier etat compte.
  function lireAttente() {
    try { return JSON.parse(localStorage.getItem(ATTENTE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function enfiler(ref, ligne) {
    var f = lireAttente();
    f[ref] = ligne;
    try { localStorage.setItem(ATTENTE_KEY, JSON.stringify(f)); } catch (e) {}
  }
  async function viderAttente() {
    var f = lireAttente();
    var refs = Object.keys(f);
    if (!refs.length || !session()) return;
    var restant = {};
    for (var i = 0; i < refs.length; i++) {
      var l = f[refs[i]];
      try {
        // Une SUPPRESSION en attente se rejoue comme une suppression. Elle repartait en
        // ecriture avec `etat: null`, que la base refuse (colonne NOT NULL) : la ligne ne
        // quittait donc jamais la file, et la premiere suppression ratee bloquait derriere
        // elle toutes les ecritures suivantes, indefiniment.
        if (!l || l.etat === null || l.etat === undefined) await retirer(refs[i]);
        else await pousser(l);
      }
      catch (e) { restant[refs[i]] = l; }
    }
    try {
      if (Object.keys(restant).length) localStorage.setItem(ATTENTE_KEY, JSON.stringify(restant));
      else localStorage.removeItem(ATTENTE_KEY);
    } catch (e) {}
  }

  // ---------------- LE SERVEUR ----------------
  // LA panne du 07/09/2026, et elle etait totale : ce module n'envoyait jamais `id`, la
  // colonne qui porte l'identifiant du compte. Elle est NOT NULL sans valeur par defaut, et
  // la politique RLS exige `auth.uid() = id`. Chaque enregistrement repartait donc en
  // « 23502 null value in column id », sans un seul message a l'ecran : le bouton changeait
  // d'etat parce que le miroir local, lui, acceptait tout, et la table `signets` est restee
  // vide. C'est le pire genre de panne, celle qui a l'air de marcher.
  //
  // L'identifiant est pose ICI et pas chez l'appelant, volontairement : la file d'attente
  // garde des lignes ecrites hors ligne, et une ligne enfilee sans identifiant serait rejouee
  // sans identifiant jusqu'a la fin des temps. Pose au moment de l'envoi, la file deja en
  // souffrance dans le navigateur du vigneron se repare toute seule au prochain chargement.
  function pousser(ligne) {
    var moi = BdvCompte.monId();
    // Pas de session : on echoue tout de suite pour que l'appelant enfile. Ne JAMAIS laisser
    // partir une requete sans identifiant, elle reviendrait en erreur serveur.
    if (!moi) return Promise.reject(new Error('pas de session'));
    // on_conflict explicite sur la cle primaire (id, ref), comme bdv-sync.js le fait pour les
    // reglages : poser deux fois le meme signet met la ligne a jour au lieu de tomber en
    // doublon. L'ecran n'a donc jamais a savoir si la ligne existait deja.
    return BdvCompte.api('/signets?on_conflict=id,ref', {
      methode: 'POST',
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      corps: [Object.assign({}, ligne, { id: moi })]
    });
  }
  function retirer(ref) {
    var moi = BdvCompte.monId();
    if (!moi) return Promise.reject(new Error('pas de session'));
    // Le filtre porte sur les DEUX colonnes de la cle. La politique RLS suffirait a proteger
    // les lignes des autres, mais une requete qui dit exactement ce qu'elle veut supprimer ne
    // depend pas d'une politique pour etre juste.
    return BdvCompte.api('/signets?id=eq.' + encodeURIComponent(moi)
      + '&ref=eq.' + encodeURIComponent(ref), { methode: 'DELETE' });
  }

  async function charger() {
    if (!session()) return;
    try {
      var lignes = await BdvCompte.api('/signets?select=ref,etat,titre,type,maj_le');
      if (!lignes) return;
      var map = {};
      lignes.forEach(function (l) { map[l.ref] = l; });
      ecrireCache(map);
      peindre();
      majBandeau();
    } catch (e) { /* le miroir precedent reste affiche, c'est mieux que rien */ }
  }

  // ---------------- L'AFFICHAGE ----------------
  // La pastille du bandeau est calculee par base.njk depuis le miroir, en script synchrone au
  // premier rendu. Quand le miroir change apres ce rendu (un clic, ou une lecture serveur qui
  // rend autre chose), il faut le lui dire : sinon la pastille reste sur l'ancien compte
  // jusqu'au prochain changement de page.
  function majBandeau() {
    try { if (window.bdvMajBandeau) window.bdvMajBandeau(); } catch (e) {}
  }

  function peindre() {
    var connecte = !!session();
    document.querySelectorAll('[data-signet]').forEach(function (btn) {
      var ref = btn.getAttribute('data-signet-ref');
      // Deconnecte, le bouton affiche toujours l'etat neutre : les signets de la personne
      // precedente sur ce navigateur ne sont pas les siens.
      var etat = connecte ? etatDe(ref) : 'absent';
      btn.setAttribute('data-etat', etat);
      btn.setAttribute('aria-pressed', etat === 'absent' ? 'false' : 'true');
      btn.setAttribute('title', ETATS[etat].aide);
      var t = btn.querySelector('[data-signet-texte]');
      if (t) t.textContent = ETATS[etat].texte;
    });
    document.querySelectorAll('[data-signet-lu]').forEach(function (btn) {
      var ref = btn.getAttribute('data-signet-ref');
      var lu = connecte && etatDe(ref) === 'lu';
      btn.setAttribute('data-etat', lu ? 'lu' : '');
      btn.setAttribute('aria-pressed', lu ? 'true' : 'false');
      var t = btn.querySelector('[data-signet-texte]');
      if (t) t.textContent = lu ? 'Lu' : "J'ai lu";
    });
  }

  // ---------------- LES GESTES ----------------
  async function ecrire(ref, etat, titre, type) {
    var map = lireCache();
    if (etat === null) { delete map[ref]; } else { map[ref] = { ref: ref, etat: etat, titre: titre, type: type }; }
    ecrireCache(map);
    peindre();                       // l'ecran repond tout de suite, le reseau suit
    majBandeau();
    try {
      if (etat === null) await retirer(ref);
      else await pousser({ ref: ref, etat: etat, titre: titre, type: type, maj_le: new Date().toISOString() });
    } catch (e) {
      enfiler(ref, { ref: ref, etat: etat, titre: titre, type: type, maj_le: new Date().toISOString() });
    }
  }

  // Sans compte, le clic n'est pas perdu : il ouvre la fenetre, et l'action s'execute
  // toute seule une fois le compte cree. C'est le meilleur moment pour le demander,
  // puisque la personne vient d'exprimer une envie precise.
  function avecCompte(action, titreFenetre) {
    if (session()) { action(); return; }
    if (!window.BdvCompte) return;
    BdvCompte.ouvrir({ titre: titreFenetre }).then(function (sess) {
      if (!sess) return;
      charger().then(action);
    });
  }

  function surClic(e) {
    var btn = e.target.closest && e.target.closest('[data-signet], [data-signet-lu]');
    if (!btn) return;
    e.preventDefault();
    var ref   = btn.getAttribute('data-signet-ref');
    var titre = btn.getAttribute('data-signet-titre') || '';
    var type  = btn.getAttribute('data-signet-type') || 'article';
    if (!ref) return;

    if (btn.hasAttribute('data-signet-lu')) {
      avecCompte(function () {
        ecrire(ref, etatDe(ref) === 'lu' ? null : 'lu', titre, type);
      }, 'Garde la trace de ce que tu as lu.');
      return;
    }
    avecCompte(function () {
      ecrire(ref, etatDe(ref) === 'absent' ? 'a_lire' : null, titre, type);
    }, 'Mets cet article de côté, retrouve-le quand tu veux.');
  }

  document.addEventListener('click', surClic);

  // Peint depuis le miroir sans attendre le reseau. Ensuite, dans CET ordre : on vide la file
  // d'attente AVANT de relire le serveur. L'inverse, qui tournait jusqu'au 07/09/2026, lancait
  // une lecture en meme temps que les ecritures en retard ; la reponse du serveur, plus vieille
  // que la file, ecrasait le miroir et le geste fait hors ligne disparaissait de l'ecran.
  peindre();
  viderAttente().then(charger);

  // Une session qui s'ouvre ou se ferme dans la page deja affichee. Sans ca, les boutons
  // gardaient l'etat d'avant jusqu'au prochain chargement, et apres une deconnexion ils
  // montraient encore les signets de la personne precedente sur ce navigateur.
  document.addEventListener('bdv:session', function () {
    peindre();
    if (session()) viderAttente().then(charger);
  });

  window.BdvSignets = {
    etat: etatDe,
    liste: function () {
      var map = lireCache();
      return Object.keys(map).map(function (k) { return map[k]; });
    },
    charger: charger,
    peindre: peindre
  };
})();
