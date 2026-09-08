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

  // La forme d'une occurrence, ecrite UNE fois. calculer() et etaler() la
  // partagent : deux fabrications du meme objet auraient fini par ne plus
  // porter les memes champs, et l'ecran qui lit le champ manquant n'affiche
  // rien du tout, sans erreur.
  function poser(e, d, ref) {
    var n = Math.round((d - ref) / JOUR);
    return { e: e, date: d, jours: n, niveau: niveau(n), phrase: phrase(n),
             dateLongue: enFrancais(d), dateCourte: courte(d) };
  }

  // Le Nieme jour d'un mois, RAMENE au dernier jour quand le mois est plus
  // court. Une echeance au 31 construite naivement pour fevrier tombe le 2 ou
  // le 3 mars : la date affichee serait fausse d'un mois entier, et le calcul
  // n'aurait leve aucune erreur.
  function jourDuMois(an, mois, jour) {
    var dernier = new Date(an, mois + 1, 0).getDate();
    return new Date(an, mois, Math.min(jour, dernier));
  }

  // Liste triee : les echeances a venir d'abord, de la plus proche a la plus lointaine.
  // Celles deja en vigueur ferment la marche, elles informent sans plus alerter.
  function calculer(echeances) {
    var ref = aujourdhui();
    return (echeances || []).map(function (e) {
      return poser(e, prochaine(e.recurrence, ref), ref);
    }).sort(function (a, b) {
      if (a.jours < 0 && b.jours >= 0) return 1;
      if (b.jours < 0 && a.jours >= 0) return -1;
      return a.jours - b.jours;
    });
  }

  // TOUTES les occurrences entre deux bornes, incluses, et pas seulement la
  // prochaine de chaque regle.
  //
  // POURQUOI CETTE FONCTION EST ICI ET PAS DANS LE MODULE DU CALENDRIER.
  // calculer() repond a « qu'est-ce qui tombe le plus tot », etaler() repond a
  // « qu'y a-t-il en octobre ». Ce sont deux questions, mais UNE SEULE lecture
  // des regles de recurrence. Ecrire la deuxieme ailleurs aurait remis dans le
  // site les deux copies que ce fichier existe justement pour eviter, et la
  // divergence se serait vue des mois plus tard, sur une date fausse dans une
  // grille, sans qu'aucun controle ne la signale.
  //
  // Ajouté le 08/09/2026, lot 1 du chantier calendrier. Les recurrences
  // `annuel-periode` et `hebdomadaire` du lot 2 s'ajoutent ICI, pas ailleurs.
  function etaler(echeances, du, au) {
    var ref = aujourdhui();
    var out = [];
    du = minuit(du); au = minuit(au);
    (echeances || []).forEach(function (e) {
      var r = e.recurrence || {}, d, a;
      if (r.type === 'unique') {
        d = minuit(new Date(r.date + 'T00:00:00'));
        if (d >= du && d <= au) out.push(poser(e, d, ref));
        return;
      }
      if (r.type === 'mensuel') {
        var c = new Date(du.getFullYear(), du.getMonth(), 1);
        while (c <= au) {
          d = jourDuMois(c.getFullYear(), c.getMonth(), r.jour);
          if (d >= du && d <= au) out.push(poser(e, d, ref));
          c = new Date(c.getFullYear(), c.getMonth() + 1, 1);
        }
        return;
      }
      if (r.type === 'annuel') {
        for (a = du.getFullYear(); a <= au.getFullYear(); a++) {
          d = jourDuMois(a, r.mois - 1, r.jour);
          if (d >= du && d <= au) out.push(poser(e, d, ref));
        }
      }
    });
    return out.sort(function (x, y) { return x.date - y.date; });
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
    etaler: etaler,
    laPlusPressante: laPlusPressante,
    depuisLaPage: depuisLaPage,
    enFrancais: enFrancais,
    courte: courte
  };
})();
