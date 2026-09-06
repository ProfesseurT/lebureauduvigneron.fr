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
      try { await pousser(f[refs[i]]); }
      catch (e) { restant[refs[i]] = f[refs[i]]; }
    }
    try {
      if (Object.keys(restant).length) localStorage.setItem(ATTENTE_KEY, JSON.stringify(restant));
      else localStorage.removeItem(ATTENTE_KEY);
    } catch (e) {}
  }

  // ---------------- LE SERVEUR ----------------
  // `resolution=merge-duplicates` sur la cle (id, ref) : poser deux fois le meme signet
  // met la ligne a jour au lieu de tomber en doublon. L'ecran n'a donc jamais a savoir si
  // la ligne existait deja.
  function pousser(ligne) {
    return BdvCompte.api('/signets', {
      methode: 'POST',
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      corps: [ligne]
    });
  }
  function retirer(ref) {
    return BdvCompte.api('/signets?ref=eq.' + encodeURIComponent(ref), { methode: 'DELETE' });
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
    } catch (e) { /* le miroir precedent reste affiche, c'est mieux que rien */ }
  }

  // ---------------- L'AFFICHAGE ----------------
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

  // Peint depuis le miroir sans attendre le reseau, puis rafraichit depuis le serveur.
  peindre();
  charger();
  viderAttente();

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
