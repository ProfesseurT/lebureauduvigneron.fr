/* ================================================================
   LE BUREAU DU VIGNERON, la piece « Mes affaires »
   ----------------------------------------------------------------
   Ecrit le 28/09/2026, lot 34. Voir CLAUDE.md, « LES AFFAIRES ».

   CE FICHIER EST LE SEUL QUI ECRIT dans `affaire_types`, `affaire_etapes`,
   `pistes` et `affaires`. Il ne decide d'aucun droit : la base refuse ce que
   l'ecran ne doit pas permettre (une etape qui porte encore une affaire, une
   septieme etape, un proprietaire hors du bureau) et signe chaque geste.

   CE QUE LE VIGNERON EMPATHIQUE A EXIGE AVANT LA PREMIERE LIGNE, 28/09/2026 :
   1. « Etape suivante » s'annule pendant quelques secondes, propose aussitot la
      prochaine date de rappel, et ne conclut JAMAIS l'affaire a sa place.
   2. Une affaire n'est « endormie » que si elle n'a AUCUN rappel a venir, et le
      delai s'ecrit en clair : « 12 jours dans Degustation, s'endort a 21 ».
   3. « A relancer » en tete avec son nombre, et ces affaires ne sont pas
      repetees dans la liste.
   4. Les retards s'ecrivent en mots, jamais par la seule couleur.
   5. « Gagnee » et « Pas pour cette fois » demandent confirmation, et une affaire
      close se rouvre.

   PAS DE FILE HORS LIGNE DANS CE LOT. Une ecriture qui echoue le DIT et l'ecran
   se recale sur la base : rien ne fait croire qu'un geste est enregistre.
   ================================================================ */
(function () {
  'use strict';

  var MODELES = [
    { cle: 'caviste', nom: 'Caviste / restaurant', famille: 'conquete', sommeil: 30, defaut: true,
      etapes: ['Repéré', 'Premier contact', 'Dégustation faite', 'Tarif envoyé'] },
    { cle: 'importateur', nom: 'Importateur', famille: 'conquete', sommeil: 60,
      etapes: ['Contacté', 'Échantillons envoyés', 'Retour de dégustation', 'Offre envoyée'] },
    { cle: 'mariage', nom: 'Mariage', famille: 'evenement', sommeil: 15,
      etapes: ['Demande reçue', 'Visite du domaine', 'Devis envoyé', 'Acompte reçu'] },
    { cle: 'seminaire', nom: 'Séminaire', famille: 'evenement', sommeil: 15,
      etapes: ['Demande reçue', 'Devis envoyé', 'Visite ou appel', 'Bon de commande signé'] },
    { cle: 'cuvee', nom: 'Nouvelle cuvée chez un client', famille: 'client', sommeil: 45,
      etapes: ['Idée notée', 'Proposée', 'Tarif envoyé'] }
  ];
  var NATURES = [
    ['caviste', 'Caviste'], ['restaurant', 'Restaurant'], ['importateur', 'Importateur'],
    ['ce', 'CE'], ['particulier', 'Particulier'], ['autre', 'Autre']
  ];
  var MOTIFS = [
    ['prix', 'Le prix'], ['fournisseur', 'Un fournisseur déjà en place'],
    ['moment', 'Pas le bon moment'], ['sans_reponse', 'Pas de réponse'],
    ['indisponible', 'Date ou capacité indisponible'], ['autre', 'Autre raison']
  ];
  var MAX_ETAPES = 6;
  var DELAI_ANNULER = 6000;

  var S = { types: [], etapes: [], pistes: {}, affaires: [], charge: false, erreur: false,
            filtre: '', ouverte: null, nouvelle: false, attente: null, reglagesOuverts: false,
            vue: lireVue(), choix: null, trouves: [] };

  /* LA DISPOSITION, LISTE OU KANBAN, 28/09/2026 (lot 39). Elle se retient sur CET
     appareil : c'est une preference de lecture, pas une donnee du bureau. Le
     stockage peut manquer (navigation privee) : la liste reste alors la valeur. */
  function lireVue() {
    try { return localStorage.getItem('bdv_aff_vue') === 'kanban' ? 'kanban' : 'liste'; }
    catch (e) { return 'liste'; }
  }
  function poserVue(v) {
    S.vue = v === 'kanban' ? 'kanban' : 'liste';
    try { localStorage.setItem('bdv_aff_vue', S.vue); } catch (e) {}
  }

  /* ---------------- OUTILS ---------------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function bureau() { return window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau(); }
  function pret() { return !!bureau(); }
  /* LA DATE DU JOUR EST LOCALE, jamais `toISOString()`, qui rend l'heure de
     Londres et decale d'un jour entre minuit et deux heures. */
  function jourIso(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }
  function versDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  /* L'horodatage de la base (etape_le, close_le) est en UTC : on le ramene au
     jour LOCAL avant de compter, sinon une etape franchie a 23 h passe a demain. */
  function jourLocal(horo) {
    var d = horo ? new Date(horo) : null;
    return d && !isNaN(d) ? jourIso(d) : null;
  }
  function ecartJours(isoA, isoB) {
    var a = versDate(isoA), b = versDate(isoB);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  }
  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function dateCourte(iso) {
    var d = versDate(iso);
    if (!d) return '';
    return (d.getDate() === 1 ? '1er' : d.getDate()) + ' ' + MOIS[d.getMonth()];
  }
  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  /* LE MESSAGE D'UNE ERREUR DE LA BASE, EN FRANCAIS. Les refus des
     declencheurs et des cles etrangeres sont traduits un par un ; le reste dit
     seulement que rien n'est parti. Jamais « Supabase a refuse ... (409) ». */
  function raison(e) {
    var brut = String((e && e.detail) || '');
    var d = '';
    try { d = (JSON.parse(brut) || {}).message || ''; } catch (x) { d = brut; }
    var tout = d + ' ' + brut;
    if (/six etapes/.test(tout)) return 'Un type d’affaire a six étapes au plus.';
    if (/affaires_etape_fk|affaires_type_fk|affaires_piste_fk/.test(tout))
      return 'Des affaires y sont encore rangées : déplace-les d’abord.';
    if (/affaire_types_nom|affaire_etapes_nom/.test(tout)) return 'Ce nom existe déjà.';
    if (/proprietaire hors du bureau/.test(tout)) return 'Cette personne n’est pas dans ton bureau.';
    return 'Rien n’a été enregistré : la base a refusé, ou la connexion a lâché. Réessaie.';
  }
  function dire(html, souci) {
    var n = el('affAvis');
    if (!n) return;
    n.innerHTML = html || '';
    n.hidden = !html;
    n.classList.toggle('aff-avis--souci', !!souci);
  }

  /* ---------------- LA BASE ---------------- */
  function lire(table, ordre) {
    return BdvCompte.api('/' + table + '?select=*&bureau=eq.' + encodeURIComponent(bureau())
      + (ordre ? '&order=' + ordre : ''));
  }
  /* LA CREATION REND LA LIGNE, parce que la base en pose une partie (les dates
     d'etape, la signature). L'ecran repeint ce que la base a garde, en relisant. */
  function creer(table, lignes) {
    var b = bureau();
    if (!b) return Promise.reject(new Error('pas de bureau'));
    return BdvCompte.api('/' + table, {
      methode: 'POST',
      entetes: { 'Prefer': 'return=minimal' },
      corps: lignes.map(function (l) { return Object.assign({}, l, { bureau: b }); })
    });
  }
  /* LA MISE A JOUR PASSE PAR PATCH, et le filtre nomme TOUJOURS le bureau :
     sans lui, la meme cle viserait tous les bureaux de la personne (regle du
     13/09/2026). `return=representation` sert a verifier qu'une ligne a bien ete
     touchee : un PATCH que la base filtre en silence rend une liste vide. */
  async function modifier(table, cle, id, champs) {
    var b = bureau();
    if (!b) throw new Error('pas de bureau');
    var r = await BdvCompte.api('/' + table + '?bureau=eq.' + encodeURIComponent(b)
      + '&' + cle + '=eq.' + encodeURIComponent(id), {
      methode: 'PATCH',
      entetes: { 'Prefer': 'return=representation' },
      corps: champs
    });
    if (!r || !r.length) throw new Error('aucune ligne modifiee');
    return r;
  }
  function supprimer(table, cle, id) {
    var b = bureau();
    if (!b) return Promise.reject(new Error('pas de bureau'));
    return BdvCompte.api('/' + table + '?bureau=eq.' + encodeURIComponent(b)
      + '&' + cle + '=eq.' + encodeURIComponent(id), { methode: 'DELETE' });
  }

  async function charger() {
    if (!pret()) return false;
    try {
      var r = await Promise.all([
        lire('affaire_types', 'ordre.asc,cree_le.asc'),
        lire('affaire_etapes', 'ordre.asc'),
        lire('pistes'),
        lire('affaires', 'maj_le.desc')
      ]);
      if (r.some(function (x) { return x == null; })) { S.erreur = true; return false; }
      S.types = r[0]; S.etapes = r[1];
      S.pistes = {}; r[2].forEach(function (p) { S.pistes[p.piste_id] = p; });
      S.affaires = r[3];
      S.charge = true; S.erreur = false;
      /* La journee lit les memes affaires : on les lui pose, elle repeint son panneau. */
      if (window.BdvAffairesJour) BdvAffairesJour.poser(S.affaires, S.pistes);
      return true;
    } catch (e) { S.erreur = true; return false; }
  }

  /* ---------------- CE QUI SE CALCULE ---------------- */
  function typeDe(id) { return S.types.filter(function (t) { return t.type_id === id; })[0]; }
  function etapesDe(typeId) {
    return S.etapes.filter(function (e) { return e.type_id === typeId; })
      .sort(function (a, b) { return a.ordre - b.ordre; });
  }
  function etapeDe(id) { return S.etapes.filter(function (e) { return e.etape_id === id; })[0]; }
  function etapeSuivante(a) {
    var et = etapeDe(a.etape_id);
    return et ? etapesDe(a.type_id).filter(function (x) { return x.ordre > et.ordre; })[0] : null;
  }
  /* Un « nouveau client » est une piste que Vitisoft ne connait pas encore. */
  function estNouveau(a) { var p = a.piste_id && S.pistes[a.piste_id]; return !!(p && !p.client_id); }
  function sujet(a) {
    if (a.piste_id) { var p = S.pistes[a.piste_id]; return p ? p.nom : 'Piste'; }
    return a.client_nom || ('Client n°' + a.client_id);
  }
  /* A RELANCER : un rappel passe ou du jour. ENDORMIE : aucun rappel a venir, et
     plus longtemps dans l'etape que le delai du type. Une affaire qui a une date
     de rappel dans trois mois n'est PAS endormie : le client a dit « rappelez en
     janvier », et c'est exactement ce qu'on a note. */
  function etat(a, aujourdhui) {
    var t = typeDe(a.type_id) || { sommeil_jours: 30 };
    var auj = aujourdhui || jourIso();
    var retard = a.rappel ? ecartJours(a.rappel, auj) : null;
    var jours = ecartJours(jourLocal(a.etape_le), auj);
    jours = jours == null ? 0 : Math.max(0, jours);
    return {
      jours: jours, sommeil: t.sommeil_jours, retard: retard,
      relancer: retard != null && retard >= 0,
      endormie: retard == null && jours > t.sommeil_jours
    };
  }
  function enCours() { return S.affaires.filter(function (a) { return a.issue === 'en_cours'; }); }
  function typesActifs() { return S.types.filter(function (t) { return !t.archive; }); }
  function visibles() {
    return enCours().filter(function (a) { return !S.filtre || a.type_id === S.filtre; });
  }

  /* ---------------- LE DESSIN ---------------- */
  function rendre() {
    var c = el('affCorps');
    if (!c) return;
    if (!S.charge) {
      c.innerHTML = S.erreur
        ? '<p class="aff-vide">Tes affaires n’ont pas pu être lues. <button type="button" class="btn" data-aff="relire">Réessayer</button></p>'
        : '<p class="aff-vide">Ouverture de tes affaires…</p>';
      return;
    }
    if (!S.types.length) { c.innerHTML = htmlDemarrage(); return; }
    c.innerHTML = htmlTete() + (S.nouvelle === 'client' ? htmlNouvelleClient() : S.nouvelle ? htmlNouvelle() : '')
      + (S.vue === 'kanban' ? htmlKanban() : htmlRelancer() + htmlListe())
      + htmlCloses() + htmlReglages();
    if (S.nouvelle === true) apresNouvelle();
  }

  function htmlDemarrage() {
    return '<div class="aff-depart"><p class="aff-depart__t">Par quoi tu commences ?</p>'
      + '<p class="aff-aide">Coche les affaires que tu mènes. Tu pourras renommer chaque étape, en ajouter ou en retirer ensuite.</p>'
      + '<ul class="aff-depart__liste">'
      + MODELES.map(function (m) {
        return '<li class="aff-depart__li"><label class="aff-depart__l"><input type="checkbox" name="affModele" value="' + m.cle + '"'
          + (m.defaut ? ' checked' : '') + '> <span class="aff-depart__nom">' + esc(m.nom) + '</span></label>'
          + '<span class="aff-depart__etapes">' + m.etapes.map(esc).join(', ') + '</span></li>';
      }).join('')
      + '</ul><button type="button" class="btn btn--bordeaux" data-aff="demarrer">C’est parti</button></div>';
  }

  function htmlTete() {
    var ec = enCours();
    var chips = '<button type="button" class="chip" data-aff="filtre" data-type=""'
      + ' aria-pressed="' + (S.filtre === '' ? 'true' : 'false') + '">Toutes, ' + ec.length + ' en cours</button>'
      + typesActifs().map(function (t) {
        var n = ec.filter(function (a) { return a.type_id === t.type_id; }).length;
        return '<button type="button" class="chip" data-aff="filtre" data-type="' + t.type_id + '"'
          + ' aria-pressed="' + (S.filtre === t.type_id ? 'true' : 'false') + '">'
          + esc(t.nom) + ', ' + n + ' en cours</button>';
      }).join('');
    var vues = '<div class="aff-vues" role="group" aria-label="Disposition">'
      + [['liste', 'Liste'], ['kanban', 'Kanban']].map(function (v) {
        return '<button type="button" class="chip" data-aff="vue" data-vue="' + v[0] + '" aria-pressed="'
          + (S.vue === v[0] ? 'true' : 'false') + '">' + v[1] + '</button>';
      }).join('') + '</div>';
    return '<div class="aff-tete"><div class="aff-chips" role="group" aria-label="Type d’affaire">' + chips + '</div>'
      + vues
      + '<button type="button" class="btn btn--bordeaux" data-aff="nouvelle"'
      + ' aria-expanded="' + (S.nouvelle ? 'true' : 'false') + '">Nouvelle affaire</button></div>';
  }

  /* Une affaire de la famille « client » porte sur un client existant : elle se
     cree depuis sa fiche (lot suivant), pas depuis ce formulaire de piste. */
  function typesPourPiste() {
    return typesActifs().filter(function (t) { return t.famille !== 'client'; });
  }
  /* LA NOUVELLE AFFAIRE COMMENCE PAR « POUR QUI ? », 28/09/2026 (lot 39). Demande
     de Ted : rattacher un client qu'il a deja, ou en creer un, par le SIRET ou a la
     main. UNE AFFAIRE, UN CLIENT (arbitrage de Ted du meme jour : un devis, une
     signature et une commande Vitisoft vont a UN client).

     Un client cree ici n'existe pas encore dans Vitisoft : en base c'est une
     « piste », a l'ecran un « Nouveau client, pas encore dans Vitisoft ». Il y entrera
     a l'import de sa premiere commande. Les trois zones sont dans le HTML des le
     depart et se montrent ou se cachent : changer de choix ne perd rien de tape. */
  var MODES = [['existant', 'Un client que j’ai déjà'], ['siret', 'Un nouveau client, par son SIRET'],
               ['manuel', 'Un nouveau client, à la main']];
  function modeDefaut() { return clientsConnus().length ? 'existant' : 'manuel'; }
  function htmlNouvelle() {
    if (!S.choix) S.choix = { mode: modeDefaut(), client: null };
    var natures = NATURES.map(function (n, i) {
      return '<label class="aff-radio"><input type="radio" name="affNature" value="' + n[0] + '"'
        + (i === 0 ? ' checked' : '') + '> ' + n[1] + '</label>';
    }).join('');
    var modes = MODES.map(function (m) {
      return '<label class="aff-radio"><input type="radio" name="affPourQui" value="' + m[0] + '"'
        + (m[0] === S.choix.mode ? ' checked' : '') + '> ' + m[1] + '</label>';
    }).join('');
    var dans7 = new Date(); dans7.setDate(dans7.getDate() + 7);
    return '<form class="aff-form" id="affForme" novalidate>'
      + '<p class="aff-form__t">Nouvelle affaire</p>'
      + '<fieldset class="aff-groupe"><legend>Pour qui ?</legend><div class="aff-radios">' + modes + '</div></fieldset>'
      /* ZONE 1 : un client existant, de Vitisoft ou deja cree ici */
      + '<div class="aff-zone" data-zone="existant">'
      + '<label class="aff-champ"><span>Chercher le client</span>'
      + '<input id="affCherche" type="search" autocomplete="off" placeholder="Nom, n° client, ville"></label>'
      + '<p class="aff-choisi" id="affChoisi" hidden></p>'
      + '<ul class="aff-trouves" id="affTrouves" aria-live="polite"></ul></div>'
      /* ZONE 2 : la recherche dans l'annuaire officiel */
      + '<div class="aff-zone" data-zone="siret" hidden>'
      + '<div class="aff-cherche"><label class="aff-champ"><span>SIRET, SIREN ou nom de l’entreprise</span>'
      + '<input id="affSiretQ" type="search" autocomplete="off" inputmode="search"></label>'
      + '<button type="button" class="btn" data-aff="chercherSiret">Chercher</button></div>'
      + '<p class="aff-aide" id="affSiretMot">L’annuaire officiel des entreprises remplit la fiche. Tu relis avant de créer.</p>'
      + '<ul class="aff-trouves" id="affSiretTrouves" aria-live="polite"></ul></div>'
      /* ZONE 2 ET 3 : la fiche du nouveau client */
      + '<div class="aff-zone" data-zone="nouveau" hidden>'
      + '<p class="aff-marque">Nouveau client, pas encore dans Vitisoft</p>'
      + '<label class="aff-champ"><span>Le nom de l’établissement</span>'
      + '<input id="affNom" type="text" maxlength="120" autocomplete="off" required></label>'
      + '<p class="aff-doublon" id="affDoublon" hidden></p>'
      + '<fieldset class="aff-groupe"><legend>C’est qui ?</legend><div class="aff-radios">' + natures + '</div></fieldset>'
      + '<div class="aff-duo">' + champ('affSiret', 'SIRET (facultatif)', 'text', 17)
      + champ('affAdresse', 'Adresse', 'text', 200) + '</div>'
      + '<div class="aff-duo">' + champ('affCp', 'Code postal', 'text', 12) + champ('affVille', 'Ville', 'text', 80) + '</div>'
      + '<details class="aff-plus"><summary>Son contact</summary><div class="aff-plus__corps">'
      + champ('affContact', 'Le nom de ton contact', 'text', 120)
      + champ('affFonction', 'Sa fonction', 'text', 80)
      + champ('affTel', 'Téléphone', 'tel', 40)
      + champ('affEmail', 'Mail', 'email', 200)
      + champ('affSource', 'D’où il vient (salon, bouche à oreille…)', 'text', 120)
      + '<p class="aff-aide">C’est une fiche professionnelle : n’y note rien de personnel.</p>'
      + '</div></details></div>'
      /* L'AFFAIRE */
      + '<label class="aff-champ"><span>L’affaire (facultatif)</span>'
      + '<input id="affTitre" type="text" maxlength="120" autocomplete="off" placeholder="Le rosé, le mariage de juin, la carte des vins…"></label>'
      + '<div class="aff-duo"><label class="aff-champ"><span>Type d’affaire</span><select id="affType"></select></label>'
      + '<label class="aff-champ"><span>Je le rappelle le</span><input id="affRappel" type="date" value="' + jourIso(dans7) + '" required></label></div>'
      + '<label class="aff-champ"><span>Pour quoi faire (facultatif)</span>'
      + '<input id="affMotifRappel" type="text" maxlength="120" placeholder="Envoyer le tarif, passer déposer deux bouteilles…"></label>'
      + '<div class="aff-form__pied"><button type="submit" class="btn btn--bordeaux">Créer l’affaire</button>'
      + '<button type="button" class="btn" data-aff="annulerNouvelle">Annuler</button></div>'
      + '</form>';
  }
  /* Apres chaque peinture du formulaire : les zones et les types du choix en cours. */
  function apresNouvelle() {
    if (!el('affForme') || !S.choix) return;
    montrerMode(S.choix.mode);
    if (S.choix.client) peindreChoisi();
  }
  function montrerMode(mode) {
    S.choix.mode = mode;
    var f = el('affForme');
    if (!f) return;
    [].forEach.call(f.querySelectorAll('[data-zone]'), function (z) {
      var zone = z.getAttribute('data-zone');
      z.hidden = zone === 'nouveau' ? mode === 'existant' : zone !== mode;
    });
    /* La famille « client » (nouvelle cuvee chez un client) n'a pas de sens pour un
       client qu'on vient de creer : on ne la propose qu'a un client existant. */
    var sel = el('affType');
    var garde = sel.value || S.filtre;
    var liste = mode === 'existant' ? typesActifs() : typesPourPiste();
    sel.innerHTML = liste.map(function (t) {
      return '<option value="' + t.type_id + '"' + (t.type_id === garde ? ' selected' : '') + '>' + esc(t.nom) + '</option>';
    }).join('');
    if (mode === 'existant') peindreTrouves();
  }

  /* LES CLIENTS QUE LE VIGNERON A DEJA : ceux de ses exports (les lignes de vente de
     cet appareil, comme « Mes clients ») et ceux crees ici. Calcule une fois par
     nombre de lignes : 171 569 lignes ne se relisent pas a chaque touche. */
  var CACHE_CLI = { n: -1, liste: [] };
  function lignes() { try { return (typeof ROWS !== 'undefined' && ROWS) ? ROWS : []; } catch (e) { return []; } }
  function cleClient(r) {
    try { if (typeof clientKey === 'function') return clientKey(r); } catch (e) {}
    return r.numClient || r.client || '(inconnu)';
  }
  function clientsVitisoft() {
    var R = lignes();
    if (CACHE_CLI.n === R.length) return CACHE_CLI.liste;
    var m = {};
    for (var i = 0; i < R.length; i++) {
      var r = R[i], id = cleClient(r), c = m[id];
      if (!c) c = m[id] = { genre: 'client', id: String(id), num: String(r.numClient || ''), nom: '', ville: '', _vu: -1 };
      var j = r._dayNum == null ? -1 : r._dayNum;
      if (j >= c._vu) { c._vu = j; if (r.client) c.nom = String(r.client).trim(); if (r.ville) c.ville = String(r.ville).trim(); }
    }
    CACHE_CLI.liste = Object.keys(m).map(function (k) {
      var c = m[k]; c.nom = c.nom || c.id; c.cle = norm(c.nom + ' ' + c.num + ' ' + c.ville); delete c._vu; return c;
    }).sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
    CACHE_CLI.n = R.length;
    return CACHE_CLI.liste;
  }
  function clientsConnus() {
    var nouveaux = Object.keys(S.pistes).map(function (k) { return S.pistes[k]; })
      .filter(function (p) { return !p.opposition && !p.client_id; })
      .map(function (p) { return { genre: 'piste', id: p.piste_id, nom: p.nom, ville: p.ville || '', num: '',
        cle: norm(p.nom + ' ' + (p.ville || '') + ' ' + (p.siret || '')) }; });
    return clientsVitisoft().concat(nouveaux);
  }
  function chercherConnus(q) {
    var mots = norm(q).split(' ').filter(Boolean);
    if (!mots.length) return [];
    return clientsConnus().filter(function (c) {
      return mots.every(function (m) { return c.cle.indexOf(m) >= 0; });
    }).slice(0, 8);
  }
  function htmlTrouve(c, geste) {
    var d = [c.num ? 'n° ' + c.num : '', c.ville].filter(Boolean).join(', ');
    return '<li><button type="button" class="aff-trouve" data-aff="' + geste + '" data-genre="' + c.genre + '" data-id="' + esc(c.id) + '">'
      + '<span class="aff-trouve__nom">' + esc(c.nom) + '</span>'
      + (c.genre === 'piste' ? ' <span class="aff-marque">Nouveau client</span>' : '')
      + (d ? '<span class="aff-trouve__d">' + esc(d) + '</span>' : '') + '</button></li>';
  }
  /* Les lignes ne sont peut-etre pas encore sur l'appareil (la piece s'ouvre sans
     elles) : on les demande une fois, et on le dit. */
  var LIGNES_DEMANDEES = false;
  function motSansClients() {
    if (!lignes().length && typeof assurerLignes === 'function' && !LIGNES_DEMANDEES) {
      LIGNES_DEMANDEES = true;
      Promise.resolve(assurerLignes()).then(function () { CACHE_CLI.n = -1; peindreTrouves(); rafraichirChangements(); })
        .catch(function () {});
      return 'Tes clients arrivent sur cet appareil…';
    }
    return clientsConnus().length ? 'Aucun client ne correspond. Tu peux le créer : « Un nouveau client ».'
      : 'Aucun client pour l’instant : ils arrivent avec ton premier export Vitisoft. Tu peux créer un nouveau client.';
  }
  function peindreTrouves() {
    var ul = el('affTrouves'), q = el('affCherche');
    if (!ul || !q) return;
    var v = q.value.trim();
    if (!v) {
      ul.innerHTML = lignes().length || clientsConnus().length ? '' : '<li class="aff-aide">' + motSansClients() + '</li>';
      return;
    }
    var l = chercherConnus(v);
    ul.innerHTML = l.length ? l.map(function (c) { return htmlTrouve(c, 'prendreClient'); }).join('')
      : '<li class="aff-aide">' + motSansClients() + '</li>';
  }
  function trouverConnu(genre, id) {
    return clientsConnus().filter(function (c) { return c.genre === genre && c.id === id; })[0];
  }
  function peindreChoisi() {
    var p = el('affChoisi'), c = S.choix && S.choix.client;
    if (!p) return;
    p.hidden = !c;
    p.innerHTML = c ? 'Client : <b>' + esc(c.nom) + '</b>' + (c.genre === 'piste' ? ' (nouveau client)' : '')
      + ' <button type="button" class="btn" data-aff="lacherClient">Changer</button>' : '';
    var ch = el('affCherche'); if (ch) ch.closest('.aff-champ').hidden = !!c;
    var ul = el('affTrouves'); if (ul && c) ul.innerHTML = '';
  }

  /* LA RECHERCHE SIRET passe par `BdvDomaine.chercher()`, la meme que la fiche du
     domaine (API Recherche d'entreprises, gratuite et sans cle). Une seule porte vers
     l'annuaire : un changement de l'API ne se corrige qu'a un endroit. */
  async function chercherSiret() {
    var q = el('affSiretQ'), ul = el('affSiretTrouves'), mot = el('affSiretMot');
    if (!q || !ul) return;
    if (!window.BdvDomaine || !BdvDomaine.chercher) { mot.textContent = 'La recherche n’est pas disponible. Remplis la fiche à la main.'; return; }
    mot.textContent = 'Recherche dans l’annuaire…';
    var r = await BdvDomaine.chercher(q.value);
    if (!r.ok) { mot.textContent = r.mot; ul.innerHTML = ''; return; }
    S.trouves = r.liste;
    mot.textContent = r.liste.length ? 'Choisis la bonne ligne. Tu pourras corriger la fiche avant de créer.'
      : 'Rien trouvé. Vérifie le numéro, ou remplis la fiche à la main.';
    ul.innerHTML = r.liste.map(function (x, i) {
      return '<li><button type="button" class="aff-trouve" data-aff="prendreSiret" data-i="' + i + '">'
        + '<span class="aff-trouve__nom">' + esc(x.nom) + '</span>'
        + (x.actif ? '' : ' <span class="aff-marque">Fermée</span>')
        + '<span class="aff-trouve__d">' + esc([x.code_postal + ' ' + x.ville, 'SIRET ' + x.siret].join(', ')) + '</span></button></li>';
    }).join('');
  }
  function prendreSiret(i) {
    var x = S.trouves[i];
    if (!x) return;
    function poser(id, v) { var n = el(id); if (n) n.value = v || ''; }
    poser('affNom', x.nom); poser('affSiret', x.siret); poser('affAdresse', x.adresse);
    poser('affCp', x.code_postal); poser('affVille', x.ville);
    el('affSiretTrouves').innerHTML = '';
    el('affSiretMot').textContent = x.actif ? 'Fiche remplie depuis l’annuaire. Relis-la, puis crée l’affaire.'
      : 'Attention : l’annuaire dit que cette entreprise est fermée. Vérifie avant de créer.';
    signalerDoublon();
    el('affNom').focus();
  }
  function signalerDoublon() {
    var d = el('affDoublon'), nom = el('affNom'), sir = el('affSiret');
    if (!d || !nom) return;
    var n = norm(nom.value), s = String(sir && sir.value || '').replace(/\D/g, '');
    var p = Object.keys(S.pistes).map(function (k) { return S.pistes[k]; }).filter(function (p) {
      return (s.length === 14 && p.siret === s) || (n.length > 2 && norm(p.nom) === n);
    })[0];
    var c = !p && n.length > 2 && clientsVitisoft().filter(function (c) { return norm(c.nom) === n; })[0];
    d.hidden = !p && !c;
    d.textContent = p ? 'Tu as déjà un nouveau client « ' + p.nom + ' ». Choisis-le plutôt dans « Un client que j’ai déjà ».'
      : c ? 'Un client Vitisoft porte déjà ce nom. Vérifie que ce n’est pas le même.' : '';
  }
  /* UNE AFFAIRE CHEZ UN CLIENT, ouverte depuis sa fiche. Pas de piste : le client
     existe deja dans Vitisoft, on ne lui redemande ni son nom ni son adresse. Le
     type propose d'abord la famille « client » (nouvelle cuvee, nouveau format). */
  function htmlNouvelleClient() {
    var c = S.clientPropose || {};
    var tous = typesActifs();
    var pref = tous.filter(function (t) { return t.famille === 'client'; })[0] || tous[0];
    var dans7 = new Date(); dans7.setDate(dans7.getDate() + 7);
    var options = tous.map(function (t) {
      return '<option value="' + t.type_id + '"' + (pref && t.type_id === pref.type_id ? ' selected' : '') + '>' + esc(t.nom) + '</option>';
    }).join('');
    return '<form class="aff-form" id="affFormeClient" novalidate>'
      + '<p class="aff-form__t">Nouvelle affaire chez ' + esc(c.nom || ('le client n°' + c.id)) + '</p>'
      + '<label class="aff-champ"><span>Ce que tu veux lui faire prendre</span>'
      + '<input id="affTitreClient" type="text" maxlength="120" autocomplete="off" placeholder="Le rosé, le magnum, la cuvée export…" required></label>'
      + '<div class="aff-duo"><label class="aff-champ"><span>Type d’affaire</span><select id="affTypeClient">' + options + '</select></label>'
      + '<label class="aff-champ"><span>Je le rappelle le</span><input id="affRappelClient" type="date" value="' + jourIso(dans7) + '" required></label></div>'
      + '<label class="aff-champ"><span>Pour quoi faire (facultatif)</span>'
      + '<input id="affMotifClient" type="text" maxlength="120" placeholder="Lui faire goûter, lui envoyer le tarif…"></label>'
      + '<div class="aff-form__pied"><button type="submit" class="btn btn--bordeaux">Créer l’affaire</button>'
      + '<button type="button" class="btn" data-aff="annulerNouvelle">Annuler</button></div>'
      + '</form>';
  }
  function champ(id, libelle, type, max) {
    return '<label class="aff-champ"><span>' + libelle + '</span><input id="' + id + '" type="' + type
      + '" maxlength="' + max + '" autocomplete="off"></label>';
  }
  function champNomme(nom, libelle, type, max, valeur) {
    return '<label class="aff-champ"><span>' + libelle + '</span><input name="' + nom + '" type="' + type
      + '" maxlength="' + max + '" value="' + esc(valeur || '') + '" autocomplete="off"></label>';
  }

  function ligneRappel(a, e) {
    if (!a.rappel) return 'Aucun rappel prévu';
    var quoi = a.rappel_titre ? ' : ' + esc(a.rappel_titre) : '';
    if (e.retard > 0) return '<b>En retard de ' + pluriel(e.retard, 'jour', 'jours') + '</b>' + quoi;
    if (e.retard === 0) return '<b>À faire aujourd’hui</b>' + quoi;
    return 'Rappel le ' + dateCourte(a.rappel) + quoi;
  }
  /* LE DELAI DIT CE QU'IL COMPTE, 28/09/2026. « s'endort a 30 » ne disait pas
     30 quoi, et le vigneron le lisait meme sur une affaire qui a un rappel a
     venir, donc qui ne peut PAS s'endormir. On ne parle du sommeil que quand il
     peut arriver, et on le compte en jours restants ou ecoules. */
  function ligneEtape(a, e) {
    var et = etapeDe(a.etape_id);
    var txt = pluriel(e.jours, 'jour', 'jours') + ' dans « ' + esc(et ? et.nom : 'étape') + ' »';
    if (e.endormie) return '<b>Endormie depuis ' + pluriel(e.jours - e.sommeil, 'jour', 'jours') + '</b> : ' + txt;
    if (e.retard == null) {
      var reste = e.sommeil - e.jours;
      return txt + ', s’endort dans ' + pluriel(reste, 'jour', 'jours') + ' sans rappel';
    }
    return txt;
  }

  function htmlAffaire(a) {
    var e = etat(a);
    var suite = etapeSuivante(a);
    var ouverte = S.ouverte === a.affaire_id;
    var t = typeDe(a.type_id);
    var qui = sujet(a);
    return '<li class="aff-ligne' + (e.endormie ? ' aff-ligne--dort' : '') + (e.retard > 0 ? ' aff-ligne--retard' : '')
      + '" data-affaire="' + a.affaire_id + '">'
      + '<div class="aff-ligne__corps">'
      + '<p class="aff-ligne__t"><span class="aff-ligne__qui">' + esc(qui) + '</span>'
      + (a.titre && a.titre !== qui ? ' <span class="aff-ligne__titre">' + esc(a.titre) + '</span>' : '')
      + (estNouveau(a) ? ' <span class="aff-marque">Nouveau client</span>' : '') + '</p>'
      + '<p class="aff-ligne__s">' + (S.filtre || !t ? '' : esc(t.nom) + ', ') + ligneEtape(a, e) + '</p>'
      + '<p class="aff-ligne__s">' + ligneRappel(a, e) + '</p>'
      + '</div><div class="aff-ligne__gestes">'
      + (suite
        ? '<button type="button" class="btn" data-aff="suivante" aria-label="Passer à l’étape suivante, « ' + esc(suite.nom) + ' »">Étape suivante</button>'
        : '<span class="aff-ligne__fin">Dernière étape</span>')
      + '<button type="button" class="btn" data-aff="ouvrir" aria-expanded="' + (ouverte ? 'true' : 'false') + '">'
      + (ouverte ? 'Fermer' : 'Ouvrir') + '</button></div>'
      + (ouverte ? htmlEditeur(a) : '') + '</li>';
  }

  function htmlEditeur(a) {
    var p = a.piste_id ? (S.pistes[a.piste_id] || {}) : null;
    var etapes = etapesDe(a.type_id).map(function (x) {
      return '<option value="' + x.etape_id + '"' + (x.etape_id === a.etape_id ? ' selected' : '') + '>' + esc(x.nom) + '</option>';
    }).join('');
    var liens = '';
    if (p && p.telephone) liens += '<a class="btn" href="tel:' + esc(String(p.telephone).replace(/[^\d+]/g, '')) + '">Appeler le ' + esc(p.telephone) + '</a>';
    if (p && p.email) liens += '<a class="btn" href="mailto:' + esc(p.email) + '">Écrire à ' + esc(p.email) + '</a>';
    var motifs = MOTIFS.map(function (m) { return '<option value="' + m[0] + '">' + m[1] + '</option>'; }).join('');
    return '<form class="aff-edit" data-edit="' + a.affaire_id + '" novalidate>'
      + (liens ? '<div class="aff-edit__liens">' + liens + '</div>' : '')
      + '<div class="aff-duo"><label class="aff-champ"><span>Étape</span><select name="etape">' + etapes + '</select></label>'
      + '<label class="aff-champ"><span>Je le rappelle le</span><input name="rappel" type="date" value="' + esc(a.rappel || '') + '"></label></div>'
      + '<label class="aff-champ"><span>Pour quoi faire</span><input name="rappel_titre" type="text" maxlength="120" value="' + esc(a.rappel_titre || '') + '"></label>'
      + '<label class="aff-champ"><span>Titre de l’affaire</span><input name="titre" type="text" maxlength="120" value="' + esc(a.titre || '') + '"></label>'
      + '<label class="aff-champ"><span>Notes</span><textarea name="notes" rows="3" maxlength="2000">' + esc(a.notes || '') + '</textarea></label>'
      + htmlChanger(a)
      + (p ? '<details class="aff-plus"><summary>Nouveau client, pas encore dans Vitisoft : ' + esc(p.nom || '') + '</summary><div class="aff-plus__corps">'
        + champNomme('p_nom', 'Le nom de l’établissement', 'text', 120, p.nom)
        + ('siret' in p ? champNomme('p_siret', 'SIRET', 'text', 17, p.siret) + champNomme('p_adresse', 'Adresse', 'text', 200, p.adresse) : '')
        + champNomme('p_contact_nom', 'Le nom de ton contact', 'text', 120, p.contact_nom)
        + champNomme('p_contact_fonction', 'Sa fonction', 'text', 80, p.contact_fonction)
        + champNomme('p_telephone', 'Téléphone', 'tel', 40, p.telephone)
        + champNomme('p_email', 'Mail', 'email', 200, p.email)
        + champNomme('p_ville', 'Ville', 'text', 80, p.ville)
        + champNomme('p_code_postal', 'Code postal', 'text', 12, p.code_postal)
        + champNomme('p_source', 'D’où il vient', 'text', 120, p.source)
        + '<p class="aff-aide">Si cette personne te demande de ne plus la contacter, ses coordonnées s’effacent et son nom reste, pour que personne ne la rappelle.</p>'
        + '<p><button type="button" class="btn" data-aff="opposition">Ne plus la contacter</button></p>'
        + '</div></details>' : '')
      + '<div class="aff-form__pied"><button type="submit" class="btn btn--bordeaux">Enregistrer</button></div>'
      + '<div class="aff-conclure">'
      + '<button type="button" class="btn" data-aff="gagnee">Gagnée</button>'
      + '<button type="button" class="btn" data-aff="perdue">Pas pour cette fois</button>'
      + '<div class="aff-conclure__confirme" data-confirme="gagnee" hidden>'
      + '<p class="aff-aide">Tu confirmes que l’affaire est gagnée ? Elle quitte ta liste en cours.</p>'
      + '<button type="button" class="btn btn--bordeaux" data-aff="confirmerGagnee">Oui, gagnée</button></div>'
      + '<div class="aff-conclure__confirme" data-confirme="perdue" hidden>'
      + '<label class="aff-champ"><span>Pourquoi ?</span><select name="motif">' + motifs + '</select></label>'
      + '<button type="button" class="btn btn--bordeaux" data-aff="confirmerPerdue">La classer</button></div>'
      + '</div></form>';
  }

  /* CHANGER LE CLIENT D'UNE AFFAIRE, 28/09/2026 (lot 39) : on s'est trompe de fiche,
     ou le nouveau client est enfin dans Vitisoft. Toujours UN client : l'ancien est
     remplace, jamais ajoute. Un nouveau client se cree depuis « Nouvelle affaire ». */
  function htmlChanger(a) {
    return '<details class="aff-plus aff-changer"><summary>Changer le client de cette affaire</summary><div class="aff-plus__corps">'
      + '<label class="aff-champ"><span>Chercher le client</span><input class="aff-change-q" type="search" autocomplete="off" placeholder="Nom, n° client, ville"></label>'
      + '<ul class="aff-trouves aff-change-l" aria-live="polite"></ul>'
      + '<p class="aff-aide">Une affaire porte sur un seul client : celui-ci remplace « ' + esc(sujet(a)) + ' ».</p>'
      + '</div></details>';
  }
  function peindreChangement(inp) {
    var ul = inp.closest('.aff-plus__corps').querySelector('.aff-change-l');
    var a = affaireDe(inp);
    var v = inp.value.trim();
    var l = v ? chercherConnus(v).filter(function (c) {
      return a && !(c.genre === 'client' ? a.client_id === c.id : a.piste_id === c.id);
    }) : [];
    ul.innerHTML = !v ? '' : l.length ? l.map(function (c) { return htmlTrouve(c, 'rattacher'); }).join('')
      : '<li class="aff-aide">' + motSansClients() + '</li>';
  }
  function rafraichirChangements() {
    [].forEach.call(document.querySelectorAll('.aff-change-q'), function (i) { if (i.value.trim()) peindreChangement(i); });
  }
  async function rattacher(a, genre, id) {
    await viderAttente();
    var c = trouverConnu(genre, id);
    if (!c) return;
    var champs = genre === 'client'
      ? { client_id: c.id, client_nom: c.nom, piste_id: null }
      : { piste_id: c.id, client_id: null, client_nom: null };
    try {
      await modifier('affaires', 'affaire_id', a.affaire_id, champs);
      dire('L’affaire porte maintenant sur ' + esc(c.nom) + '.');
    } catch (e) { dire(raison(e), true); }
    await charger(); rendre();
  }

  /* ---------------- LE KANBAN, 28/09/2026 (lot 39) ----------------
     Une colonne par etape. Chaque type a SES etapes : sur « Toutes », le kanban
     demande de choisir un type (arbitrage de Ted), sauf s'il n'y en a qu'un.
     On deplace une carte en la glissant, OU par sa liste « Deplacer vers » : le
     glisser-deposer ne se fait ni au clavier ni partout au doigt. Le deplacement
     passe par le meme delai d'annulation que « Etape suivante ». Les affaires a
     relancer restent dans leur colonne, marquees en mots : les sortir ferait des
     trous dans le tableau. */
  function typeKanban() {
    if (S.filtre) return typeDe(S.filtre);
    var t = typesActifs();
    return t.length === 1 ? t[0] : null;
  }
  function htmlKanban() {
    var t = typeKanban();
    if (!t) return '<div class="aff-bloc"><p class="aff-vide">Choisis un type d’affaire au-dessus pour voir ses colonnes.</p></div>';
    var dans = enCours().filter(function (a) { return a.type_id === t.type_id; });
    var nRel = dans.filter(function (a) { var e = etat(a); return e.relancer || e.endormie; }).length;
    var cols = etapesDe(t.type_id).map(function (et) {
      var ici = dans.filter(function (a) { return a.etape_id === et.etape_id; });
      return '<section class="aff-col" data-colonne="' + et.etape_id + '" aria-label="' + esc(et.nom) + ', ' + ici.length + '">'
        + '<h4 class="aff-col__t">' + esc(et.nom) + ', ' + ici.length + '</h4>'
        + '<ul class="aff-col__liste">' + ici.map(htmlCarte).join('') + '</ul></section>';
    }).join('');
    var ouverte = S.ouverte && dans.filter(function (a) { return a.affaire_id === S.ouverte; })[0];
    return '<div class="aff-bloc">'
      + (nRel ? '<p class="aff-kanban__rel"><b>À relancer : ' + nRel + '</b>, signalées en mots sur leur carte.</p>'
        : '<p class="aff-vide">Rien à relancer aujourd’hui.</p>')
      + (dans.length ? '' : '<p class="aff-vide">Aucune affaire en cours dans « ' + esc(t.nom) + ' ».</p>')
      + '<div class="aff-kanban">' + cols + '</div>'
      + (ouverte ? '<div class="aff-kanban__detail" data-affaire="' + ouverte.affaire_id + '">'
        + '<p class="aff-form__t">' + esc(sujet(ouverte)) + (ouverte.titre && ouverte.titre !== sujet(ouverte) ? ', ' + esc(ouverte.titre) : '') + '</p>'
        + htmlEditeur(ouverte) + '</div>' : '')
      + '</div>';
  }
  function htmlCarte(a) {
    var e = etat(a), qui = sujet(a);
    var opts = etapesDe(a.type_id).map(function (x) {
      return '<option value="' + x.etape_id + '"' + (x.etape_id === a.etape_id ? ' selected' : '') + '>' + esc(x.nom) + '</option>';
    }).join('');
    var ouverte = S.ouverte === a.affaire_id;
    return '<li class="aff-carte' + (e.endormie ? ' aff-ligne--dort' : '') + (e.retard > 0 ? ' aff-ligne--retard' : '')
      + (ouverte ? ' aff-carte--ouverte' : '') + '" data-affaire="' + a.affaire_id + '" draggable="true">'
      + '<p class="aff-ligne__t"><span class="aff-ligne__qui">' + esc(qui) + '</span></p>'
      + (a.titre && a.titre !== qui ? '<p class="aff-ligne__s">' + esc(a.titre) + '</p>' : '')
      + (estNouveau(a) ? '<p class="aff-marque">Nouveau client</p>' : '')
      + '<p class="aff-ligne__s">' + ligneRappel(a, e) + '</p>'
      + (e.endormie ? '<p class="aff-ligne__s"><b>Endormie depuis ' + pluriel(e.jours - e.sommeil, 'jour', 'jours') + '</b></p>' : '')
      + '<div class="aff-carte__gestes">'
      + '<select class="aff-carte__deplacer" data-deplacer aria-label="Déplacer « ' + esc(qui) + ' » vers une autre étape">' + opts + '</select>'
      + '<button type="button" class="btn" data-aff="ouvrir" aria-expanded="' + (ouverte ? 'true' : 'false') + '">'
      + (ouverte ? 'Fermer' : 'Ouvrir') + '</button></div></li>';
  }

  function htmlRelancer() {
    var r = visibles().filter(function (a) { var e = etat(a); return e.relancer || e.endormie; })
      .sort(function (a, b) {
        var ra = etat(a).retard, rb = etat(b).retard;
        return (rb == null ? -1 : rb) - (ra == null ? -1 : ra);
      });
    if (!r.length) return '<div class="aff-bloc"><h3 class="aff-bloc__t">À relancer</h3>'
      + '<p class="aff-vide">Rien à relancer aujourd’hui.</p></div>';
    return '<div class="aff-bloc aff-bloc--relancer"><h3 class="aff-bloc__t">À relancer : ' + r.length + '</h3>'
      + '<ul class="aff-liste">' + r.map(htmlAffaire).join('') + '</ul></div>';
  }
  function htmlListe() {
    var reste = visibles().filter(function (a) { var e = etat(a); return !(e.relancer || e.endormie); });
    var types = S.filtre ? [typeDe(S.filtre)].filter(Boolean) : typesActifs();
    var html = '';
    types.forEach(function (t) {
      var dans = reste.filter(function (a) { return a.type_id === t.type_id; });
      if (!dans.length) return;
      var blocs = etapesDe(t.type_id).map(function (et) {
        var ici = dans.filter(function (a) { return a.etape_id === et.etape_id; });
        if (!ici.length) return '';
        return '<h4 class="aff-etape">' + esc(et.nom) + ', ' + ici.length + '</h4>'
          + '<ul class="aff-liste">' + ici.map(htmlAffaire).join('') + '</ul>';
      }).join('');
      html += (S.filtre ? '' : '<h3 class="aff-bloc__t">' + esc(t.nom) + '</h3>') + blocs;
    });
    if (!visibles().length) html = '<p class="aff-vide">Aucune affaire en cours. « Nouvelle affaire » pour en ouvrir une.</p>';
    return html ? '<div class="aff-bloc">' + html + '</div>' : '';
  }
  function htmlCloses() {
    var il = new Date(); il.setFullYear(il.getFullYear() - 1);
    var borne = jourIso(il);
    var c = S.affaires.filter(function (a) {
      return a.issue !== 'en_cours' && (!S.filtre || a.type_id === S.filtre)
        && (jourLocal(a.close_le) || '') >= borne;
    });
    if (!c.length) return '';
    var g = c.filter(function (a) { return a.issue === 'gagnee'; }).length;
    return '<details class="aff-plus aff-closes"><summary>Voir et rouvrir les affaires closes depuis un an ('
      + g + ' gagnée' + (g > 1 ? 's' : '') + ' sur ' + c.length + ')</summary><ul class="aff-liste">'
      + c.map(function (a) {
        var m = MOTIFS.filter(function (x) { return x[0] === a.motif; })[0];
        return '<li class="aff-ligne" data-affaire="' + a.affaire_id + '"><div class="aff-ligne__corps">'
          + '<p class="aff-ligne__t"><span class="aff-ligne__qui">' + esc(sujet(a)) + '</span></p>'
          + '<p class="aff-ligne__s">' + (a.issue === 'gagnee' ? 'Gagnée' : 'Pas pour cette fois' + (m ? ' (' + m[1].toLowerCase() + ')' : ''))
          + ' le ' + dateCourte(jourLocal(a.close_le)) + '</p></div>'
          + '<div class="aff-ligne__gestes"><button type="button" class="btn" data-aff="rouvrir">Rouvrir</button></div></li>';
      }).join('') + '</ul></details>';
  }
  function htmlReglages() {
    var presents = S.types.map(function (t) { return norm(t.nom); });
    var manquants = MODELES.filter(function (m) { return presents.indexOf(norm(m.nom)) < 0; });
    return '<details class="aff-plus aff-reglages"' + (S.reglagesOuverts ? ' open' : '') + '><summary>Régler mes types d’affaires</summary><div class="aff-plus__corps">'
      + S.types.map(function (t) {
        var ets = etapesDe(t.type_id);
        return '<form class="aff-type" data-type="' + t.type_id + '" novalidate>'
          + '<div class="aff-duo"><label class="aff-champ"><span>Nom</span><input name="nom" type="text" maxlength="60" value="' + esc(t.nom) + '"></label>'
          + '<label class="aff-champ"><span>Une affaire s’endort après (jours)</span><input name="sommeil" type="number" min="1" max="365" value="' + t.sommeil_jours + '"></label></div>'
          + '<p class="aff-type__t">' + (t.archive ? 'Ne sert plus. ' : '') + 'Les étapes, dans l’ordre (' + ets.length + ' sur ' + MAX_ETAPES + ')</p>'
          + '<ol class="aff-type__etapes">' + ets.map(function (e, i) {
            var n = S.affaires.filter(function (a) { return a.etape_id === e.etape_id; }).length;
            return '<li class="aff-type__etape"><input name="etape_' + e.etape_id + '" type="text" maxlength="60" value="' + esc(e.nom) + '" aria-label="Étape ' + (i + 1) + '">'
              + '<button type="button" class="btn" data-aff="retirerEtape" data-etape="' + e.etape_id + '"'
              + (ets.length <= 1 ? ' disabled' : '') + '>Retirer' + (n ? ' (' + pluriel(n, 'affaire', 'affaires') + ')' : '') + '</button></li>';
          }).join('') + '</ol>'
          + (ets.length < MAX_ETAPES ? '<label class="aff-champ"><span>Ajouter une étape à la fin</span><input name="ajout" type="text" maxlength="60"></label>' : '')
          + '<div class="aff-form__pied"><button type="submit" class="btn">Enregistrer ce type</button>'
          + '<button type="button" class="btn" data-aff="archiver">' + (t.archive ? 'Le remettre en service' : 'Ne plus l’utiliser') + '</button></div>'
          + '</form>';
      }).join('')
      + (manquants.length ? '<p class="aff-type__t">Ajouter un modèle</p><div class="aff-chips">'
        + manquants.map(function (m) { return '<button type="button" class="chip" data-aff="ajoutModele" data-modele="' + m.cle + '">' + esc(m.nom) + '</button>'; }).join('')
        + '</div>' : '')
      + '</div></details>';
  }

  /* ---------------- LES GESTES ---------------- */
  async function creerModeles(cles) {
    var mods = MODELES.filter(function (m) { return cles.indexOf(m.cle) >= 0; });
    if (!mods.length) { dire('Coche au moins un type d’affaire.', true); return; }
    var base = S.types.length;
    var types = mods.map(function (m, i) {
      return { type_id: uuid(), nom: m.nom, famille: m.famille, sommeil_jours: m.sommeil, ordre: base + i };
    });
    var etapes = [];
    mods.forEach(function (m, i) {
      m.etapes.forEach(function (n, j) {
        etapes.push({ etape_id: uuid(), type_id: types[i].type_id, nom: n, ordre: j + 1 });
      });
    });
    try {
      await creer('affaire_types', types);
      await creer('affaire_etapes', etapes);
      dire('');
    } catch (e) { dire(raison(e), true); }
    await charger(); rendre();
  }

  /* LA CREATION SELON « POUR QUI ? ». Un client existant : l'affaire porte son
     numero (et son nom en etiquette) ou la piste deja creee ; rien de nouveau n'est
     ecrit. Un nouveau client : une piste, puis l'affaire. Le SIRET et l'adresse
     partent seulement si la base les connait (lot 39) : sans ce SQL, la piste se
     cree sans eux et on le dit. */
  async function creerAffaire() {
    var mode = (S.choix && S.choix.mode) || 'manuel';
    var typeId = el('affType') && el('affType').value;
    var rappel = el('affRappel').value;
    function v(id) { var n = el(id); var x = n ? n.value.trim() : ''; return x || null; }
    if (!typeId) { dire('Crée d’abord un type d’affaire, dans « Régler mes types d’affaires ».', true); return; }
    if (!rappel) { dire('Choisis la date à laquelle tu le rappelles.', true); el('affRappel').focus(); return; }
    var premiere = etapesDe(typeId)[0];
    if (!premiere) { dire('Ce type d’affaire n’a aucune étape.', true); return; }
    var affaire = { affaire_id: uuid(), type_id: typeId, etape_id: premiere.etape_id,
      rappel: rappel, rappel_titre: v('affMotifRappel') };
    var piste = null, nom;
    if (mode === 'existant') {
      var c = S.choix.client;
      if (!c) { dire('Choisis le client dans la liste, ou crée un nouveau client.', true); if (el('affCherche')) el('affCherche').focus(); return; }
      nom = c.nom;
      if (c.genre === 'client') { affaire.client_id = c.id; affaire.client_nom = c.nom; }
      else affaire.piste_id = c.id;
    } else {
      nom = v('affNom');
      if (!nom) { dire('Il faut le nom de l’établissement.', true); el('affNom').focus(); return; }
      var sir = String(v('affSiret') || '').replace(/\s/g, '');
      if (sir && !/^\d{14}$/.test(sir)) { dire('Un SIRET a 14 chiffres.', true); el('affSiret').focus(); return; }
      var nat = document.querySelector('input[name="affNature"]:checked');
      piste = { piste_id: uuid(), nom: nom, nature: nat ? nat.value : 'autre',
        contact_nom: v('affContact'), contact_fonction: v('affFonction'), telephone: v('affTel'),
        email: v('affEmail'), ville: v('affVille'), code_postal: v('affCp'), source: v('affSource'),
        siret: sir || null, adresse: v('affAdresse') };
      affaire.piste_id = piste.piste_id;
    }
    affaire.titre = v('affTitre') || nom;
    var sansSiret = false;
    try {
      if (piste) {
        try { await creer('pistes', [piste]); }
        catch (e) {
          if (!/siret|adresse/.test(String(e && e.detail || ''))) throw e;
          sansSiret = !!(piste.siret || piste.adresse);
          delete piste.siret; delete piste.adresse;
          await creer('pistes', [piste]);
        }
      }
      await creer('affaires', [affaire]);
      S.nouvelle = false; S.choix = null;
      dire('Affaire ouverte : ' + esc(nom) + ', rappel le ' + dateCourte(rappel) + '.'
        + (sansSiret ? ' Le SIRET et l’adresse n’ont pas été gardés : la base attend encore sa mise à jour (lot 39).' : ''));
    } catch (e) { dire(raison(e), true); }
    await charger(); rendre();
  }

  async function creerAffaireClient() {
    var c = S.clientPropose || {};
    var titre = (el('affTitreClient').value || '').trim();
    var typeId = el('affTypeClient') && el('affTypeClient').value;
    var rappel = el('affRappelClient').value;
    if (!titre) { dire('Dis ce que tu veux lui faire prendre.', true); el('affTitreClient').focus(); return; }
    if (!rappel) { dire('Choisis la date à laquelle tu le rappelles.', true); el('affRappelClient').focus(); return; }
    var premiere = etapesDe(typeId)[0];
    if (!premiere) { dire('Ce type d’affaire n’a aucune étape.', true); return; }
    var motif = (el('affMotifClient').value || '').trim() || null;
    var affaire = { affaire_id: uuid(), type_id: typeId, etape_id: premiere.etape_id,
      client_id: String(c.id), client_nom: c.nom || null, titre: titre, rappel: rappel, rappel_titre: motif };
    try {
      try { await creer('affaires', [affaire]); }
      catch (e) {
        /* Le lot 35 pas encore passe : la colonne du nom manque. On cree sans elle. */
        if (!/client_nom/.test(String(e && e.detail || ''))) throw e;
        delete affaire.client_nom;
        await creer('affaires', [affaire]);
      }
      S.nouvelle = false; S.clientPropose = null;
      dire('Affaire ouverte chez ' + esc(c.nom || c.id) + ', rappel le ' + dateCourte(rappel) + '.');
    } catch (e) { dire(raison(e), true); }
    await charger(); rendre();
  }

  function formEdit(id) { return document.querySelector('form.aff-edit[data-edit="' + id + '"]'); }

  async function enregistrer(a) {
    await viderAttente();
    var f = formEdit(a.affaire_id);
    if (!f) return;
    function val(n) { var x = f.elements[n]; return x ? (x.value || '').trim() : ''; }
    var champs = { etape_id: val('etape') || a.etape_id, rappel: val('rappel') || null,
      rappel_titre: val('rappel_titre') || null, titre: val('titre') || a.titre, notes: val('notes') || null };
    try {
      await modifier('affaires', 'affaire_id', a.affaire_id, champs);
      if (a.piste_id && f.elements.p_nom) {
        var p = {};
        ['nom', 'contact_nom', 'contact_fonction', 'telephone', 'email', 'ville', 'code_postal', 'source']
          .forEach(function (k) { p[k] = val('p_' + k) || null; });
        if (!p.nom) p.nom = (S.pistes[a.piste_id] || {}).nom;
        if (f.elements.p_siret) {
          var sir = val('p_siret').replace(/\s/g, '');
          if (sir && !/^\d{14}$/.test(sir)) { dire('Un SIRET a 14 chiffres.', true); return; }
          p.siret = sir || null; p.adresse = val('p_adresse') || null;
        }
        await modifier('pistes', 'piste_id', a.piste_id, p);
      }
      S.ouverte = null;
      dire('Enregistré.');
    } catch (e) { dire(raison(e), true); }
    await charger(); rendre();
  }

  /* ETAPE SUIVANTE, ANNULABLE. L'ecriture part au bout de six secondes, ou tout de
     suite si un autre geste arrive ou si la page se cache : c'est ce delai qui
     rend « Annuler » vrai, sans remettre a zero les jours passes dans l'etape.
     Depuis la derniere etape il n'y a pas de bouton : conclure est un geste a part,
     avec sa confirmation. */
  function suivante(a) {
    var suite = etapeSuivante(a);
    if (suite) deplacer(a, suite.etape_id);
  }
  /* Tout deplacement d'etape (bouton, kanban, liste « Deplacer vers ») passe ici. */
  function deplacer(a, etapeId) {
    viderAttente();
    var cible = etapeDe(etapeId);
    if (!cible || etapeId === a.etape_id || cible.type_id !== a.type_id) return;
    var avant = a.etape_id;
    a.etape_id = etapeId; a.etape_le = new Date().toISOString();
    S.ouverte = a.affaire_id;
    S.attente = { id: a.affaire_id, avant: avant, apres: etapeId,
      minuterie: setTimeout(viderAttente, DELAI_ANNULER) };
    rendre();
    dire('Passée à « ' + esc(cible.nom) + ' ». Choisis la prochaine date de rappel. '
      + '<button type="button" class="btn" data-aff="annulerSuivante">Annuler</button>');
    var f = formEdit(a.affaire_id);
    if (f && f.elements.rappel) f.elements.rappel.focus();
  }
  function viderAttente() {
    var at = S.attente;
    if (!at) return Promise.resolve();
    clearTimeout(at.minuterie);
    S.attente = null;
    return modifier('affaires', 'affaire_id', at.id, { etape_id: at.apres })
      .catch(function (e) { dire(raison(e), true); return charger().then(rendre); });
  }
  function annulerSuivante() {
    var at = S.attente;
    if (!at) return;
    clearTimeout(at.minuterie);
    S.attente = null;
    dire('Annulé : l’affaire reste où elle était.');
    charger().then(rendre);
  }

  async function conclure(a, issue, motif) {
    await viderAttente();
    try {
      await modifier('affaires', 'affaire_id', a.affaire_id, { issue: issue, motif: motif || null });
      S.ouverte = null;
      dire(issue === 'gagnee'
        ? 'Bravo. L’affaire passe dans « Les affaires closes ». Quand tu factureras dans Vitisoft, la vente arrivera avec ton prochain export.'
        : issue === 'perdue' ? 'Classée. Tu la retrouves dans « Les affaires closes », et tu peux la rouvrir.'
        : 'Rouverte : elle revient dans tes affaires en cours, sans date de rappel. Pense à en poser une.');
    } catch (e) { dire(raison(e), true); }
    await charger(); rendre();
  }

  async function opposition(a) {
    if (!a.piste_id) return;
    try {
      await modifier('pistes', 'piste_id', a.piste_id, { opposition: true });
      dire('Coordonnées effacées. Le nom reste, pour que personne ne la rappelle.');
    } catch (e) { dire(raison(e), true); }
    await charger(); rendre();
  }

  async function enregistrerType(form) {
    var tid = form.getAttribute('data-type');
    var t = typeDe(tid);
    if (!t) return;
    var nom = (form.elements.nom.value || '').trim();
    var sommeil = parseInt(form.elements.sommeil.value, 10);
    if (!nom) { dire('Un type d’affaire a besoin d’un nom.', true); return; }
    if (!(sommeil >= 1 && sommeil <= 365)) { dire('Le délai va de 1 à 365 jours.', true); return; }
    try {
      await modifier('affaire_types', 'type_id', tid, { nom: nom, sommeil_jours: sommeil });
      var ets = etapesDe(tid);
      for (var i = 0; i < ets.length; i++) {
        var n = form.elements['etape_' + ets[i].etape_id];
        var v = n ? n.value.trim() : '';
        if (v && v !== ets[i].nom) await modifier('affaire_etapes', 'etape_id', ets[i].etape_id, { nom: v });
      }
      var ajout = form.elements.ajout ? form.elements.ajout.value.trim() : '';
      if (ajout) {
        var dernier = ets.length ? ets[ets.length - 1].ordre : 0;
        await creer('affaire_etapes', [{ etape_id: uuid(), type_id: tid, nom: ajout, ordre: dernier + 1 }]);
      }
      dire('Type d’affaire enregistré.');
    } catch (e) { dire(raison(e), true); }
    S.reglagesOuverts = true;
    await charger(); rendre();
  }

  /* RETIRER UNE ETAPE QUI PORTE DES AFFAIRES : elles vont a l'etape d'avant, ou a
     celle d'apres si c'etait la premiere, et on le DIT. La base refuserait de
     toute facon la suppression tant qu'une affaire y est rangee. */
  async function retirerEtape(etapeId) {
    var e = etapeDe(etapeId);
    if (!e) return;
    var ets = etapesDe(e.type_id);
    if (ets.length <= 1) return;
    var i = ets.indexOf(e);
    var cible = ets[i - 1] || ets[i + 1];
    var dedans = S.affaires.filter(function (a) { return a.etape_id === etapeId; });
    try {
      for (var k = 0; k < dedans.length; k++) {
        await modifier('affaires', 'affaire_id', dedans[k].affaire_id, { etape_id: cible.etape_id });
      }
      await supprimer('affaire_etapes', 'etape_id', etapeId);
      dire('Étape « ' + esc(e.nom) + ' » retirée' + (dedans.length
        ? ' : ' + pluriel(dedans.length, 'affaire déplacée', 'affaires déplacées') + ' vers « ' + esc(cible.nom) + ' ».' : '.'));
    } catch (x) { dire(raison(x), true); }
    S.reglagesOuverts = true;
    await charger(); rendre();
  }

  async function archiver(tid) {
    var t = typeDe(tid);
    if (!t) return;
    try {
      await modifier('affaire_types', 'type_id', tid, { archive: !t.archive });
      if (!t.archive && S.filtre === tid) S.filtre = '';
      dire(t.archive ? 'Remis en service.' : 'Ce type n’apparaît plus dans tes choix. Ses affaires restent.');
    } catch (e) { dire(raison(e), true); }
    S.reglagesOuverts = true;
    await charger(); rendre();
  }

  function affaireDe(n) {
    var li = n.closest('[data-affaire]');
    var id = li && li.getAttribute('data-affaire');
    return S.affaires.filter(function (a) { return a.affaire_id === id; })[0];
  }

  /* UN SEUL ECOUTEUR PAR EVENEMENT, DELEGUE sur le corps de la piece : il survit a
     chaque repeinte, et aucun `onclick` n'est ecrit dans le HTML (section B1 de la
     charte). */
  function brancher() {
    var c = el('affCorps');
    if (!c || c.getAttribute('data-branche')) return;
    c.setAttribute('data-branche', '1');
    c.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-aff]');
      if (!b || !c.contains(b)) return;
      var quoi = b.getAttribute('data-aff');
      var a = affaireDe(b);
      if (quoi === 'relire') { ouvrir(); return; }
      if (quoi === 'demarrer') {
        var cles = [].slice.call(c.querySelectorAll('input[name="affModele"]:checked')).map(function (x) { return x.value; });
        creerModeles(cles); return;
      }
      if (quoi === 'filtre') { S.filtre = b.getAttribute('data-type') || ''; rendre(); return; }
      if (quoi === 'nouvelle') {
        S.nouvelle = !S.nouvelle; S.choix = null; rendre();
        var premier = S.nouvelle && (S.choix && S.choix.mode === 'existant' ? el('affCherche') : el('affNom'));
        if (premier) premier.focus();
        return;
      }
      if (quoi === 'annulerNouvelle') { S.nouvelle = false; S.clientPropose = null; S.choix = null; rendre(); return; }
      if (quoi === 'vue') { viderAttente(); poserVue(b.getAttribute('data-vue')); rendre(); return; }
      if (quoi === 'chercherSiret') { chercherSiret(); return; }
      if (quoi === 'prendreSiret') { prendreSiret(+b.getAttribute('data-i')); return; }
      if (quoi === 'prendreClient') {
        S.choix.client = trouverConnu(b.getAttribute('data-genre'), b.getAttribute('data-id')) || null;
        peindreChoisi();
        var tt = el('affTitre'); if (tt) tt.focus();
        return;
      }
      if (quoi === 'lacherClient') { S.choix.client = null; peindreChoisi(); if (el('affCherche')) el('affCherche').focus(); peindreTrouves(); return; }
      if (quoi === 'rattacher' && a) { rattacher(a, b.getAttribute('data-genre'), b.getAttribute('data-id')); return; }
      if (quoi === 'ouvrir' && a) {
        viderAttente(); S.ouverte = S.ouverte === a.affaire_id ? null : a.affaire_id; rendre();
        /* Dans le kanban la fiche s'ouvre SOUS le tableau : on l'amene a l'ecran. */
        var det = S.vue === 'kanban' && S.ouverte && c.querySelector('.aff-kanban__detail');
        if (det && det.scrollIntoView) det.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      if (quoi === 'suivante' && a) { suivante(a); return; }
      if (quoi === 'gagnee' || quoi === 'perdue') {
        var f = b.closest('form');
        [].forEach.call(f.querySelectorAll('[data-confirme]'), function (n) {
          n.hidden = n.getAttribute('data-confirme') !== quoi;
        });
        return;
      }
      if (quoi === 'confirmerGagnee' && a) { conclure(a, 'gagnee'); return; }
      if (quoi === 'confirmerPerdue' && a) { conclure(a, 'perdue', b.closest('form').elements.motif.value); return; }
      if (quoi === 'rouvrir' && a) { conclure(a, 'en_cours'); return; }
      if (quoi === 'opposition' && a) { opposition(a); return; }
      if (quoi === 'retirerEtape') { retirerEtape(b.getAttribute('data-etape')); return; }
      if (quoi === 'archiver') { archiver(b.closest('form').getAttribute('data-type')); return; }
      if (quoi === 'ajoutModele') { S.reglagesOuverts = true; creerModeles([b.getAttribute('data-modele')]); return; }
    });
    c.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = ev.target;
      if (f.id === 'affForme') { creerAffaire(); return; }
      if (f.id === 'affFormeClient') { creerAffaireClient(); return; }
      if (f.classList.contains('aff-edit')) { var a = affaireDe(f); if (a) enregistrer(a); return; }
      if (f.classList.contains('aff-type')) { enregistrerType(f); return; }
    });
    /* LE DOUBLON SE DIT A LA FRAPPE : une piste qui porte deja ce nom. On ne
       bloque rien, les homonymes existent ; on le signale. */
    /* « C'EST QUI ? » CHOISIT LE TYPE D'AFFAIRE A SA PLACE, 28/09/2026 : le vigneron
       voyait deux fois la meme question. Un importateur va au type qui parle
       d'import, un caviste ou un restaurant au type qui parle de caviste. Il peut
       toujours changer : on propose, on n'impose rien. */
    c.addEventListener('change', function (ev) {
      if (ev.target.name === 'affPourQui') { montrerMode(ev.target.value); return; }
      if (ev.target.hasAttribute && ev.target.hasAttribute('data-deplacer')) {
        var ad = affaireDe(ev.target);
        if (ad) deplacer(ad, ev.target.value);
        return;
      }
      if (ev.target.name !== 'affNature') return;
      var sel = el('affType');
      if (!sel) return;
      var mot = { importateur: 'import', caviste: 'cavist', restaurant: 'cavist' }[ev.target.value];
      if (!mot) return;
      var o = [].filter.call(sel.options, function (x) { return norm(x.textContent).indexOf(mot) >= 0; })[0];
      if (o) sel.value = o.value;
    });
    c.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t.id === 'affCherche') { peindreTrouves(); return; }
      if (t.classList && t.classList.contains('aff-change-q')) { peindreChangement(t); return; }
      if (t.id === 'affNom' || t.id === 'affSiret') signalerDoublon();
    });
    /* Entree dans la recherche SIRET cherche, elle ne cree pas l'affaire. */
    c.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      if (ev.target.id === 'affSiretQ') { ev.preventDefault(); chercherSiret(); }
      else if (ev.target.id === 'affCherche' || (ev.target.classList && ev.target.classList.contains('aff-change-q'))) ev.preventDefault();
    });
    /* LE GLISSER-DEPOSER DU KANBAN. L'identifiant voyage dans le transfert ; la
       colonne d'arrivee decide de l'etape. Rien ne s'ecrit avant le delai. */
    function colonne(n) { return n && n.closest ? n.closest('[data-colonne]') : null; }
    c.addEventListener('dragstart', function (ev) {
      var li = ev.target.closest && ev.target.closest('.aff-carte');
      if (!li || !ev.dataTransfer) return;
      ev.dataTransfer.setData('text/plain', li.getAttribute('data-affaire'));
      ev.dataTransfer.effectAllowed = 'move';
      li.classList.add('aff-carte--prise');
    });
    c.addEventListener('dragend', function () {
      [].forEach.call(c.querySelectorAll('.aff-carte--prise, .aff-col--survol'), function (n) {
        n.classList.remove('aff-carte--prise'); n.classList.remove('aff-col--survol');
      });
    });
    c.addEventListener('dragover', function (ev) {
      var col = colonne(ev.target);
      if (!col) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
      col.classList.add('aff-col--survol');
    });
    c.addEventListener('dragleave', function (ev) {
      var col = colonne(ev.target);
      if (col && !col.contains(ev.relatedTarget)) col.classList.remove('aff-col--survol');
    });
    c.addEventListener('drop', function (ev) {
      var col = colonne(ev.target);
      if (!col || !ev.dataTransfer) return;
      ev.preventDefault();
      var id = ev.dataTransfer.getData('text/plain');
      var ad = S.affaires.filter(function (x) { return x.affaire_id === id; })[0];
      if (ad) deplacer(ad, col.getAttribute('data-colonne'));
    });
    /* « Annuler » vit dans l'avis, au-dessus du corps : son propre ecouteur. */
    var av = el('affAvis');
    if (av) av.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-aff="annulerSuivante"]')) annulerSuivante();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') viderAttente();
    });
    window.addEventListener('pagehide', viderAttente);
  }

  /* LA FICHE D'UN CLIENT LAISSE UN MOT ICI, « Nouvelle affaire », dans
     sessionStorage : la piece n'est pas forcement chargee au moment du clic, et la
     fiche peut vivre dans un autre onglet. Prefixe `bdv_` : il part a la
     deconnexion avec le reste. */
  function lireClientPropose() {
    try {
      var brut = sessionStorage.getItem('bdv_affaire_client');
      if (!brut) return;
      sessionStorage.removeItem('bdv_affaire_client');
      var c = JSON.parse(brut);
      if (c && c.id) { S.clientPropose = c; S.nouvelle = 'client'; }
    } catch (e) {}
  }

  async function ouvrir() {
    lireClientPropose();
    brancher();
    rendre();
    if (!pret()) { dire('Ton bureau n’est pas encore raccordé. Reviens dans un instant.', true); return; }
    await charger();
    rendre();
  }

  window.BdvAffaires = { ouvrir: ouvrir, etat: etat, _S: S, MODELES: MODELES, _deplacer: function (id, e) {
    var a = S.affaires.filter(function (x) { return x.affaire_id === id; })[0]; if (a) deplacer(a, e); } };
})();
