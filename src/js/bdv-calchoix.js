/* ===========================================================================
   LE BUREAU DU VIGNERON — LES CHOIX DE CALENDRIER
   ===========================================================================
   Lot 3 du chantier calendrier, 08/09/2026.

   CE QUE CE FICHIER PORTE. Les ECARTS du vigneron par rapport a la
   bibliotheque : le repere qu'il ne veut pas suivre, et celui qu'il decale.
   Rien d'autre. La bibliotheque vit dans src/_data/echeances.json, ses
   occurrences a lui sont des taches, et le calcul des dates est ailleurs.

   POURQUOI UN FICHIER A PART, ET PAS DANS bdv-calendrier.js. Ce module ecrit en
   base : miroir local, file d'attente, rejeu. C'est cent vingt lignes de
   plomberie qui n'ont rien a voir avec l'affichage, et bdv-calendrier.js est
   deja le plus gros module de la piece. La regle du bureau tient : un module
   ecrit dans UNE table, et une table est ecrite par UN module.

   UNE LIGNE N'EXISTE QUE S'IL Y A UN ECART. Suivi et non decale est l'etat par
   defaut du monde, il n'y a rien a stocker pour le dire. Rallumer un repere et
   remettre son decalage a zero SUPPRIME la ligne. Meme regle que decocher une
   obligation dans la table des taches, et meme motif : sans elle, la table se
   remplirait d'une ligne par occurrence et par compte, toutes neutres.

   LE PIEGE DEJA PAYE DEUX FOIS SUR CE SITE, cf. la panne des signets du
   07/09/2026 : `id` est pose au moment de l'ENVOI et JAMAIS chez l'appelant.
   Une ligne enfilee hors ligne sous un compte repartirait sinon sous celui-la
   jusqu'a la fin des temps. Et une SUPPRESSION en attente se rejoue comme une
   suppression, pas comme une ecriture vide.
   =========================================================================== */
(function () {
  'use strict';

  var CACHE_KEY   = 'bdv_calchoix_v1';
  var ATTENTE_KEY = 'bdv_calchoix_attente';
  var ATTENTE_QUI = 'bdv_calchoix_attente_qui';
  var BORNE = 180;          // la meme borne que le `check` de la table

  /* ---------------- LE MIROIR ET LA FILE ---------------- */
  function lireCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { return {}; }
  }
  function ecrireCache(map) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function pret() {
    return !!(window.BdvCompte && BdvCompte.monId && BdvCompte.monId()
      && BdvCompte.monBureau && BdvCompte.monBureau());
  }

  /* UN AVIS, PAR LE CANAL QUI EXISTE DEJA, 19/09/2026. Meme fonction, mot pour mot, que
     dans bdv-taches.js : `status()` est la barre du tableau de bord (bdv-base.js), et elle
     sait deja parler par `BdvReglages.dire()` quand la barre n'est pas dans la page, ce
     qui est le cas du bureau. On n'invente pas un troisieme canal. */
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
  /* Plusieurs refus definitifs dans une meme file ont presque toujours la meme cause :
     on dit le premier en entier, et on COMPTE les autres. */
  function resumeRefus(messages) {
    if (messages.length === 1) return messages[0];
    return messages[0] + ' ' + (messages.length - 1)
      + (messages.length === 2 ? ' autre geste a \u00e9t\u00e9 refus\u00e9 pour la m\u00eame raison.'
                               : ' autres gestes ont \u00e9t\u00e9 refus\u00e9s pour la m\u00eame raison.');
  }

  /* CE QUI EST DEFINITIF, ET CE QUI NE L'EST PAS, 19/09/2026. Meme regle que
     bdv-taches.js, et meme defaut ferme : la phrase francaise fabriquee dans pousser()
     etait jetee par son seul appelant, qui remettait la ligne en file. Elle y repartait a
     chaque ouverture, refusee a l'identique, et la file jamais vide interdisait ensuite
     tout changement de bureau.

     DEFINITIFS : le refus de proprietaire (marqueur `definitif`), 403 (la securite par
     ligne a refuse, le droit ne changera pas en retentant) et 401 (le jeton a ete refuse
     apres `rafraichir()`). TOUT LE RESTE RETOURNE EN FILE, y compris 400, 409, 422 et
     5xx : un 400 vient souvent d'une colonne pas encore creee en base, et la prochaine
     migration le repare. */
  function refusDefinitif(e) {
    if (!e) return false;
    if (e.definitif) return true;
    if (window.BdvCompte && BdvCompte.refusDeProprietaire
      && BdvCompte.refusDeProprietaire(e)) return true;
    return e.status === 401 || e.status === 403;
  }

  /* LE REFUS DIT EN FRANCAIS, ET MARQUE. La traduction remplacait l'erreur d'origine,
     `status` compris : l'appelant recevait une phrase et plus aucun moyen de savoir que
     ce refus etait sans appel. Le marqueur voyage donc AVEC la phrase. */
  function traduireRefus(e, par) {
    if (!(BdvCompte.refusDeProprietaire && BdvCompte.refusDeProprietaire(e))) return e;
    var refus = new Error(BdvCompte.refusEnFrancais('Ce rep\u00e8re a \u00e9t\u00e9 r\u00e9gl\u00e9',
      par, 'Seul son auteur peut le changer.'));
    refus.definitif = true;
    refus.status = e.status;
    return refus;
  }

  function lireAttente() {
    try { return JSON.parse(localStorage.getItem(ATTENTE_KEY)) || {}; } catch (e) { return {}; }
  }
  /* LA FILE APPARTIENT A UN BUREAU, PLUS A UNE PERSONNE, 13/09/2026.
     Le defaut ferme le 08/09/2026 etait : Ted eteint un repere hors ligne, se deconnecte,
     un collegue se connecte sur le meme navigateur, et le rejeu ecrit le choix de Ted sur
     le compte du collegue. Depuis le lot 17 le meme defaut existe dans une DIMENSION DE
     PLUS, et il n'a pas besoin de deux personnes : une seule qui eteint un repere hors
     ligne, change de bureau, et voit son choix atterrir dans l'autre domaine. Le
     proprietaire de la file est donc le bureau. */
  function qui() { return (window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau()) || null; }

  function enfiler(cle, ligne) {
    var f = lireAttente();
    f[cle] = ligne;          // seul le dernier etat d'un choix compte
    try {
      localStorage.setItem(ATTENTE_KEY, JSON.stringify(f));
      /* LA FILE SE SOUVIENT DE QUI L'A REMPLIE, et ce n'est pas la meme chose que
         d'y mettre l'identifiant du compte. La ligne, elle, n'en porte pas : il
         est pose a l'envoi (defaut des signets du 07/09/2026). Mais la file
         ELLE-MEME appartient a quelqu'un.

         LE DEFAUT QUE CA FERME, trouve par le banc le 08/09/2026 : Ted eteint un
         repere hors ligne, se deconnecte, un collegue se connecte sur le meme
         navigateur, et le rejeu ecrit le choix de Ted SUR LE COMPTE DU COLLEGUE.
         L'identifiant pose a l'envoi, qui protege de la premiere fuite, cause
         exactement la seconde. Une file d'un autre compte se jette, elle ne se
         rejoue pas.

         Hors ligne et sans compte, `qui()` est nul : la file n'appartient a
         personne encore, et le premier compte qui se connecte la reprendra. C'est
         voulu, c'est le cas du vigneron qui note dans le train avant d'ouvrir sa
         session. */
      localStorage.setItem(ATTENTE_QUI, qui() || '');
    } catch (e) {}
  }
  function jeterAttente() {
    try {
      localStorage.removeItem(ATTENTE_KEY);
      localStorage.removeItem(ATTENTE_QUI);
    } catch (e) {}
  }
  function fileEtrangere() {
    var moi = qui();
    if (!moi) return false;
    var proprio;
    try { proprio = localStorage.getItem(ATTENTE_QUI); } catch (e) { return false; }
    return !!proprio && proprio !== moi;
  }
  async function viderAttente() {
    /* UNE FILE ETRANGERE SE JETTE, MAIS PLUS EN SILENCE, 19/09/2026. Jeter est le bon
       geste pour la securite : ces reglages ne sont pas a ce bureau. Les jeter sans un mot
       ne l'est pas, parce que du travail disparait et que personne ne peut le savoir ni le
       refaire. */
    if (fileEtrangere()) {
      jeterAttente();
      avertir('Des r\u00e9glages de calendrier faits hors ligne depuis un autre bureau '
        + 'n\u2019ont pas pu \u00eatre enregistr\u00e9s : ils n\u2019appartenaient pas \u00e0 celui-ci.');
      return;
    }
    var f = lireAttente(), cles = Object.keys(f);
    if (!cles.length || !pret()) return;
    var restant = {}, refuses = [];
    for (var i = 0; i < cles.length; i++) {
      var l = f[cles[i]];
      try {
        if (l === null) await retirer(cles[i]);
        else await pousser(l);
      } catch (e) {
        // Le refus sans appel QUITTE la file : c'est le seul moyen qu'elle finisse par se
        // vider, et donc que le changement de bureau redevienne possible.
        if (refusDefinitif(e)) { refuses.push(e.message); continue; }
        restant[cles[i]] = l;
      }
    }
    try {
      if (Object.keys(restant).length) localStorage.setItem(ATTENTE_KEY, JSON.stringify(restant));
      else jeterAttente();
    } catch (e) {}
    /* On le dit, PUIS on relit la base : le miroir porte encore le reglage que la base a
       refuse, et la base fait foi. */
    if (refuses.length) { avertir(resumeRefus(refuses)); charger(); }
  }

  /* ---------------- LE SERVEUR ---------------- */
  function pousser(ligne) {
    var bureau = BdvCompte.monBureau();
    if (!bureau) return Promise.reject(new Error('pas de bureau'));
    return BdvCompte.api('/calendrier_choix?on_conflict=bureau,cle', {
      methode: 'POST',
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      corps: [Object.assign({}, ligne, { bureau: bureau })]
    }).catch(function (e) {
      var vieux = lireCache()[ligne.cle] || {};
      throw traduireRefus(e, ligne.cree_par || vieux.cree_par);
    });
  }
  function retirer(cle) {
    var bureau = BdvCompte.monBureau();
    if (!bureau) return Promise.reject(new Error('pas de bureau'));
    // Le filtre nomme les DEUX colonnes de la cle. Sans `bureau`, cette suppression
    // viserait le meme repere dans TOUS les bureaux de la personne.
    /* LA SUPPRESSION AUSSI SE TRADUIT, 19/09/2026 : rallumer le repere d'un collegue est
       refuse par la meme politique que le regler, et l'erreur brute remontait telle quelle
       jusqu'a l'ecran (« Supabase a refuse /calendrier_choix (403) »). */
    return BdvCompte.api('/calendrier_choix?bureau=eq.' + encodeURIComponent(bureau)
      + '&cle=eq.' + encodeURIComponent(cle), { methode: 'DELETE' })
      .catch(function (e) {
        var vieux = lireCache()[cle] || {};
        throw traduireRefus(e, vieux.cree_par);
      });
  }
  async function charger() {
    if (!pret()) return;
    try {
      var lignes = await BdvCompte.api('/calendrier_choix?select=cle,actif,decale_de,maj_le,cree_par'
        + '&bureau=eq.' + encodeURIComponent(BdvCompte.monBureau()));
      if (!lignes) return;   // null = session tombee ou corps vide, on garde le miroir
      var map = {};
      lignes.forEach(function (l) { map[l.cle] = l; });
      ecrireCache(map);
      prevenir();
    } catch (e) { /* le miroir precedent reste affiche, c'est mieux que rien */ }
  }

  /* ---------------- CE QUE LE CALENDRIER LIT ---------------- */
  function choix(cle) {
    var l = lireCache()[cle];
    return {
      actif: !l || l.actif !== false,
      decale: (l && parseInt(l.decale_de, 10)) || 0
    };
  }
  function eteints() {
    var map = lireCache(), out = [];
    Object.keys(map).forEach(function (k) {
      if (map[k] && map[k].actif === false) out.push(k);
    });
    return out;
  }

  /* ---------------- LES GESTES ----------------
     L'ecran repond tout de suite, le reseau suit. Un geste qui attendrait la reponse
     donnerait l'impression d'un clic rate sur un reseau de cave. */
  function ecrire(cle, ligne) {
    var map = lireCache();
    /* L'AUTEUR SURVIT A LA REECRITURE LOCALE, meme motif que dans « Mes taches » :
       `cree_par` est pose par la base et jamais par le navigateur, donc une ligne
       reconstruite ici le perdrait juste avant que la base refuse l'ecriture, et le
       message ne pourrait plus nommer celui a qui ce repere appartient. */
    if (ligne && map[cle] && map[cle].cree_par && !ligne.cree_par) {
      ligne = Object.assign({}, ligne, { cree_par: map[cle].cree_par });
    }
    if (ligne === null) delete map[cle]; else map[cle] = ligne;
    ecrireCache(map);
    prevenir();
    if (!pret()) { enfiler(cle, ligne); return; }
    (ligne === null ? retirer(cle) : pousser(ligne)).catch(function (e) {
      /* LE SEUL APPELANT JETAIT LE MESSAGE ET REMETTAIT LA LIGNE EN FILE, 19/09/2026.
         La phrase francaise fabriquee dans pousser() n'etait lue par personne : le
         vigneron ne voyait rien, le repere restait eteint a l'ecran, la ligne repartait a
         chaque ouverture, et la file jamais vide interdisait tout changement de bureau.
         Un refus sans appel se DIT, et la base est relue pour que l'ecran cesse de montrer
         une ecriture qui n'a pas eu lieu. */
      if (refusDefinitif(e)) { avertir(e.message); charger(); return; }
      enfiler(cle, ligne);
    });
  }

  /* On range TOUJOURS par ici, jamais par ecrire() directement : c'est le seul
     endroit qui sait qu'une ligne neutre ne doit pas exister. */
  function poser(cle, actif, decale) {
    if (!cle) return;
    decale = Math.max(-BORNE, Math.min(BORNE, parseInt(decale, 10) || 0));
    if (actif !== false && decale === 0) { ecrire(cle, null); return; }
    ecrire(cle, { cle: cle, actif: actif !== false, decale_de: decale,
                  maj_le: new Date().toISOString() });
  }

  function eteindre(cle) { var c = choix(cle); poser(cle, false, c.decale); }
  function rallumer(cle) { var c = choix(cle); poser(cle, true, c.decale); }
  function basculer(cle) { var c = choix(cle); poser(cle, !c.actif, c.decale); }
  function decaler(cle, jours) {
    var c = choix(cle);
    poser(cle, c.actif, c.decale + (parseInt(jours, 10) || 0));
  }
  function recaler(cle) { var c = choix(cle); poser(cle, c.actif, 0); }
  function toutRallumer() {
    var map = lireCache();
    Object.keys(map).forEach(function (k) {
      if (map[k] && map[k].actif === false) rallumer(k);
    });
  }

  /* ---------------- BRANCHEMENTS ----------------
     On previent par un evenement, jamais par un appel direct au calendrier : ce
     module part avec la piece, mais rien ne garantit l'ordre, et un appel a une
     fonction qui n'existe pas encore ne dit rien du tout. */
  function prevenir() {
    try { document.dispatchEvent(new CustomEvent('bdv:calchoix')); } catch (e) {}
  }

  var LU = false;
  function ouvrir() {
    if (!LU && pret()) { LU = true; viderAttente().then(charger); }
  }

  document.addEventListener('bdv:session', function () {
    LU = false;
    /* LE MIROIR SE VIDE A CHAQUE CHANGEMENT DE SESSION, et pas seulement a la
       deconnexion. Le garder en attendant la reponse du serveur montrerait au
       suivant, pendant une seconde ou deux, ce que le precedent ne suivait pas.
       Une seconde suffit a poser un geste. */
    ecrireCache({});
    if (fileEtrangere()) jeterAttente();
    prevenir();
    if (pret()) { LU = true; viderAttente().then(charger); }
  });

  if (pret()) { LU = true; viderAttente().then(charger); }

  /* LA FILE PART AVANT LA BASCULE, 14/09/2026. Changer de bureau vide le poste, et
     ce qui n'a pas ete envoye serait perdu sans un mot. On s'annonce donc ici : le
     module videra sa file quand on le lui demandera, et si quelque chose resiste,
     `changerDeBureau()` refuse de basculer plutot que de jeter du travail. */
  if (window.BdvCompte && BdvCompte.avantDeQuitterLeBureau) {
    BdvCompte.avantDeQuitterLeBureau(viderAttente);
  }

  window.BdvCalchoix = {
    ouvrir: ouvrir, charger: charger, choix: choix, eteints: eteints,
    eteindre: eteindre, rallumer: rallumer, basculer: basculer,
    decaler: decaler, recaler: recaler, toutRallumer: toutRallumer
  };
})();
