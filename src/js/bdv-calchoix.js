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
  function pret() { return !!(window.BdvCompte && BdvCompte.monId && BdvCompte.monId()); }

  function lireAttente() {
    try { return JSON.parse(localStorage.getItem(ATTENTE_KEY)) || {}; } catch (e) { return {}; }
  }
  function qui() { return (window.BdvCompte && BdvCompte.monId && BdvCompte.monId()) || null; }

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
    if (fileEtrangere()) { jeterAttente(); return; }
    var f = lireAttente(), cles = Object.keys(f);
    if (!cles.length || !pret()) return;
    var restant = {};
    for (var i = 0; i < cles.length; i++) {
      var l = f[cles[i]];
      try {
        if (l === null) await retirer(cles[i]);
        else await pousser(l);
      } catch (e) { restant[cles[i]] = l; }
    }
    try {
      if (Object.keys(restant).length) localStorage.setItem(ATTENTE_KEY, JSON.stringify(restant));
      else jeterAttente();
    } catch (e) {}
  }

  /* ---------------- LE SERVEUR ---------------- */
  function pousser(ligne) {
    var moi = BdvCompte.monId();
    if (!moi) return Promise.reject(new Error('pas de session'));
    return BdvCompte.api('/calendrier_choix?on_conflict=id,cle', {
      methode: 'POST',
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      corps: [Object.assign({}, ligne, { id: moi })]
    });
  }
  function retirer(cle) {
    var moi = BdvCompte.monId();
    if (!moi) return Promise.reject(new Error('pas de session'));
    // Le filtre nomme les DEUX colonnes de la cle. La politique RLS suffirait, mais
    // une requete qui dit exactement ce qu'elle supprime ne depend pas d'une politique.
    return BdvCompte.api('/calendrier_choix?id=eq.' + encodeURIComponent(moi)
      + '&cle=eq.' + encodeURIComponent(cle), { methode: 'DELETE' });
  }
  async function charger() {
    if (!pret()) return;
    try {
      var lignes = await BdvCompte.api('/calendrier_choix?select=cle,actif,decale_de,maj_le');
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
    if (ligne === null) delete map[cle]; else map[cle] = ligne;
    ecrireCache(map);
    prevenir();
    if (!pret()) { enfiler(cle, ligne); return; }
    (ligne === null ? retirer(cle) : pousser(ligne)).catch(function () { enfiler(cle, ligne); });
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

  window.BdvCalchoix = {
    ouvrir: ouvrir, charger: charger, choix: choix, eteints: eteints,
    eteindre: eteindre, rallumer: rallumer, basculer: basculer,
    decaler: decaler, recaler: recaler, toutRallumer: toutRallumer
  };
})();
