/* ================================================================
   LE BUREAU DU VIGNERON, les affaires dans « Ma journee »
   ----------------------------------------------------------------
   Ecrit le 28/09/2026, lot 35. Voir CLAUDE.md, « LES AFFAIRES ».

   CE MODULE NE FAIT QUE LIRE. Il est charge avec la page, parce que la journee
   en a besoin des l'ouverture ; la piece « Mes affaires » (bdv-affaires.js),
   elle, attend le premier clic et reste la SEULE a ecrire.

   Il porte deux choses et rien d'autre :
   1. les punaises du panneau : une affaire dont le rappel est passe ou du jour ;
   2. les affaires en cours d'un client, pour sa fiche.

   SA LECTURE PASSE PAR `amorcer()` de mon-bureau.njk, jamais au chargement du
   fichier : une lecture lancee a cote de la sequence tomberait avant que la cle
   du bureau soit connue, et rendrait une zone vide (regle du 17/09/2026).

   LE VIGNERON EMPATHIQUE L'A DIT EN PREMIER : « que ca me ressorte tout seul
   dans Ma journee le jour ou je dois rappeler. Si je dois aller le chercher, je
   n'irai pas. » Et une relance client passe AVANT une piste : ces punaises
   viennent apres les rappels clients et les taches dans la pile.
   ================================================================ */
(function () {
  'use strict';

  var EN_COURS = null;   // null = pas encore lu ; [] = lu, rien en cours
  var NOMS = {};         // piste_id -> nom

  function bureau() { return window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau(); }
  function jourIso(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* Deux requetes etroites : les affaires en cours (sans leurs notes), puis le nom
     des seules pistes qui en portent une. Rend `false` si la lecture a echoue,
     comme les autres etapes de l'amorcage. */
  async function charger() {
    var b = bureau();
    if (!b || !window.BdvCompte) return false;
    try {
      var aff = await BdvCompte.api('/affaires?select=affaire_id,titre,rappel,rappel_titre,piste_id,client_id,client_nom'
        + '&issue=eq.en_cours&bureau=eq.' + encodeURIComponent(b));
      if (aff == null) return false;
      var ids = aff.map(function (a) { return a.piste_id; }).filter(Boolean);
      var noms = {};
      if (ids.length) {
        var ps = await BdvCompte.api('/pistes?select=piste_id,nom&bureau=eq.' + encodeURIComponent(b)
          + '&piste_id=in.(' + ids.map(encodeURIComponent).join(',') + ')');
        (ps || []).forEach(function (p) { noms[p.piste_id] = p.nom; });
      }
      EN_COURS = aff; NOMS = noms;
      return true;
    } catch (e) {
      /* LE LOT 35 N'EST PEUT-ETRE PAS PASSE : `client_nom` n'existe pas encore.
         On relit sans lui plutot que de laisser la journee sans ses affaires. */
      if (e && /client_nom/.test(String(e.detail || ''))) {
        try {
          var a2 = await BdvCompte.api('/affaires?select=affaire_id,titre,rappel,rappel_titre,piste_id,client_id'
            + '&issue=eq.en_cours&bureau=eq.' + encodeURIComponent(b));
          if (a2 == null) return false;
          EN_COURS = a2;
          return true;
        } catch (x) { return false; }
      }
      return false;
    }
  }

  /* La piece repeint la journee apres chacun de ses gestes : elle pose ici ce
     qu'elle vient de relire, sans que la journee refasse une requete. */
  function poser(affaires, pistes) {
    EN_COURS = (affaires || []).filter(function (a) { return a.issue === 'en_cours'; });
    NOMS = {};
    Object.keys(pistes || {}).forEach(function (k) { NOMS[k] = pistes[k].nom; });
    if (window.bdvMajPanneau) { try { window.bdvMajPanneau(); } catch (e) {} }
  }

  function nomDe(a) {
    if (a.piste_id) return NOMS[a.piste_id] || a.titre;
    return a.client_nom || a.titre;
  }

  /* UNE punaise, et pas une par affaire : la pile en porte cinq au plus, et une
     affaire ne passe pas devant un client qui attend. A un seul on nomme, a
     plusieurs on compte (regle du 10/09/2026). */
  function punaises() {
    if (!EN_COURS) return [];
    var auj = jourIso();
    var dues = EN_COURS.filter(function (a) { return a.rappel && a.rappel <= auj; })
      .sort(function (x, y) { return x.rappel < y.rappel ? -1 : 1; });
    if (!dues.length) return [];
    var prem = dues[0];
    var retard = prem.rappel < auj;
    if (dues.length === 1) {
      return [{ cle: 'affaire:' + prem.affaire_id,
        tampon: retard ? 'affaire en retard' : 'affaire du jour',
        valeur: nomDe(prem),
        sous: prem.rappel_titre || 'une affaire à relancer',
        ton: retard ? 'vieux' : '',
        href: '/mon-bureau/#affaires' }];
    }
    return [{ cle: 'affaires',
      valeur: String(dues.length),
      libelle: 'affaires à relancer',
      sous: 'à commencer par ' + nomDe(prem),
      ton: retard ? 'vieux' : '',
      href: '/mon-bureau/#affaires' }];
  }

  function duClient(cle) {
    if (!EN_COURS || cle == null) return [];
    return EN_COURS.filter(function (a) { return a.client_id === String(cle); });
  }

  window.BdvAffairesJour = { charger: charger, poser: poser, punaises: punaises, duClient: duClient };
})();
