/* ===========================================================================
   LE BUREAU DU VIGNERON — LE CALCUL DES ECHEANCES
   ===========================================================================
   Une seule logique de calcul, partagee par la page /outils/echeances/ et par
   la premiere ligne de /mon-bureau/. Deux copies auraient fini par diverger,
   et rien ne l'aurait signale.

   Le calcul se fait TOUJOURS dans le navigateur, jamais a la construction du
   site : une page construite en septembre et consultee en decembre afficherait
   sinon « dans 4 jours » pour une echeance passee depuis trois mois.

   Les donnees viennent de src/_data/echeances.json, injecte dans la page.
   =========================================================================== */
(function () {
  'use strict';

  var JOUR = 24 * 3600 * 1000;

  function minuit(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function aujourdhui() { return minuit(new Date()); }

  // Prochaine occurrence a venir. Pour une echeance unique deja passee on renvoie
  // sa date : une obligation entree en vigueur reste utile a afficher.
  function prochaine(r, ref) {
    if (r.type === 'unique') return minuit(new Date(r.date + 'T00:00:00'));
    if (r.type === 'mensuel') {
      var d = new Date(ref.getFullYear(), ref.getMonth(), r.jour);
      if (d < ref) d = new Date(ref.getFullYear(), ref.getMonth() + 1, r.jour);
      return d;
    }
    if (r.type === 'annuel') {
      var a = new Date(ref.getFullYear(), r.mois - 1, r.jour);
      if (a < ref) a = new Date(ref.getFullYear() + 1, r.mois - 1, r.jour);
      return a;
    }
    return null;
  }

  // Le ton dit l'urgence avant meme qu'on lise le nombre.
  function niveau(n) {
    if (n < 0) return 'passe';
    if (n === 0) return 'aujourdhui';
    if (n <= 7) return 'urgent';
    if (n <= 30) return 'proche';
    return 'loin';
  }
  function phrase(n) {
    if (n < 0) return 'En vigueur depuis le';
    if (n === 0) return "C'est aujourd'hui";
    if (n === 1) return 'Demain';
    return 'Dans ' + n + ' jours';
  }
  function enFrancais(d) {
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function courte(d) {
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // Liste triee : les echeances a venir d'abord, de la plus proche a la plus lointaine.
  // Celles deja en vigueur ferment la marche, elles informent sans plus alerter.
  function calculer(echeances) {
    var ref = aujourdhui();
    return (echeances || []).map(function (e) {
      var d = prochaine(e.recurrence, ref);
      var n = Math.round((d - ref) / JOUR);
      return { e: e, date: d, jours: n, niveau: niveau(n), phrase: phrase(n),
               dateLongue: enFrancais(d), dateCourte: courte(d) };
    }).sort(function (a, b) {
      if (a.jours < 0 && b.jours >= 0) return 1;
      if (b.jours < 0 && a.jours >= 0) return -1;
      return a.jours - b.jours;
    });
  }

  // La plus urgente encore a venir, ou null s'il n'y en a aucune.
  function laPlusPressante(echeances) {
    var l = calculer(echeances).filter(function (x) { return x.jours >= 0; });
    return l.length ? l[0] : null;
  }

  // Lit le bloc JSON pose dans la page. Absent, on renvoie un tableau vide plutot
  // que de lever : une page sans echeances doit s'afficher, pas planter.
  function depuisLaPage(id) {
    var el = document.getElementById(id || 'bdvEcheances');
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  window.BdvEcheances = {
    calculer: calculer,
    laPlusPressante: laPlusPressante,
    depuisLaPage: depuisLaPage,
    enFrancais: enFrancais,
    courte: courte
  };
})();
