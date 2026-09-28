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
            filtre: '', ouverte: null, nouvelle: false, attente: null, reglagesOuverts: false };

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
  function sujet(a) {
    if (a.piste_id) { var p = S.pistes[a.piste_id]; return p ? p.nom : 'Piste'; }
    return a.client_id;
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
    c.innerHTML = htmlTete() + (S.nouvelle ? htmlNouvelle() : '') + htmlRelancer()
      + htmlListe() + htmlCloses() + htmlReglages();
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
    return '<div class="aff-tete"><div class="aff-chips" role="group" aria-label="Type d’affaire">' + chips + '</div>'
      + '<button type="button" class="btn btn--bordeaux" data-aff="nouvelle"'
      + ' aria-expanded="' + (S.nouvelle ? 'true' : 'false') + '">Nouvelle affaire</button></div>';
  }

  /* Une affaire de la famille « client » porte sur un client existant : elle se
     cree depuis sa fiche (lot suivant), pas depuis ce formulaire de piste. */
  function typesPourPiste() {
    return typesActifs().filter(function (t) { return t.famille !== 'client'; });
  }
  function htmlNouvelle() {
    var tp = typesPourPiste();
    var choisi = tp.filter(function (t) { return t.type_id === S.filtre; })[0] ? S.filtre : '';
    var natures = NATURES.map(function (n, i) {
      return '<label class="aff-radio"><input type="radio" name="affNature" value="' + n[0] + '"'
        + (i === 0 ? ' checked' : '') + '> ' + n[1] + '</label>';
    }).join('');
    var dans7 = new Date(); dans7.setDate(dans7.getDate() + 7);
    var options = tp.map(function (t) {
      return '<option value="' + t.type_id + '"' + (t.type_id === choisi ? ' selected' : '') + '>' + esc(t.nom) + '</option>';
    }).join('');
    return '<form class="aff-form" id="affForme" novalidate>'
      + '<p class="aff-form__t">Nouvelle affaire, avec un établissement que tu ne factures pas encore</p>'
      + '<label class="aff-champ"><span>Le nom de l’établissement</span>'
      + '<input id="affNom" type="text" maxlength="120" autocomplete="off" required></label>'
      + '<p class="aff-doublon" id="affDoublon" hidden></p>'
      + '<fieldset class="aff-groupe"><legend>C’est qui ?</legend><div class="aff-radios">' + natures + '</div></fieldset>'
      + '<div class="aff-duo"><label class="aff-champ"><span>Type d’affaire</span><select id="affType">' + options + '</select></label>'
      + '<label class="aff-champ"><span>Je le rappelle le</span><input id="affRappel" type="date" value="' + jourIso(dans7) + '" required></label></div>'
      + '<label class="aff-champ"><span>Pour quoi faire (facultatif)</span>'
      + '<input id="affMotifRappel" type="text" maxlength="120" placeholder="Envoyer le tarif, passer déposer deux bouteilles…"></label>'
      + '<details class="aff-plus"><summary>Plus de détails</summary><div class="aff-plus__corps">'
      + champ('affContact', 'Le nom de ton contact', 'text', 120)
      + champ('affFonction', 'Sa fonction', 'text', 80)
      + champ('affTel', 'Téléphone', 'tel', 40)
      + champ('affEmail', 'Mail', 'email', 200)
      + champ('affVille', 'Ville', 'text', 80)
      + champ('affCp', 'Code postal', 'text', 12)
      + champ('affSource', 'D’où il vient (salon, bouche à oreille…)', 'text', 120)
      + '<p class="aff-aide">C’est une fiche professionnelle : n’y note rien de personnel.</p>'
      + '</div></details>'
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
      + (a.titre && a.titre !== qui ? ' <span class="aff-ligne__titre">' + esc(a.titre) + '</span>' : '') + '</p>'
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
      + (p ? '<details class="aff-plus"><summary>La piste : ' + esc(p.nom || '') + '</summary><div class="aff-plus__corps">'
        + champNomme('p_nom', 'Le nom de l’établissement', 'text', 120, p.nom)
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

  async function creerAffaire() {
    var nom = (el('affNom').value || '').trim();
    var typeId = el('affType') && el('affType').value;
    var rappel = el('affRappel').value;
    if (!nom) { dire('Il faut le nom de l’établissement.', true); el('affNom').focus(); return; }
    if (!typeId) { dire('Crée d’abord un type d’affaire, dans « Régler mes types d’affaires ».', true); return; }
    if (!rappel) { dire('Choisis la date à laquelle tu le rappelles.', true); el('affRappel').focus(); return; }
    var premiere = etapesDe(typeId)[0];
    if (!premiere) { dire('Ce type d’affaire n’a aucune étape.', true); return; }
    var nat = document.querySelector('input[name="affNature"]:checked');
    function v(id) { var n = el(id); var x = n ? n.value.trim() : ''; return x || null; }
    var piste = { piste_id: uuid(), nom: nom, nature: nat ? nat.value : 'autre',
      contact_nom: v('affContact'), contact_fonction: v('affFonction'), telephone: v('affTel'),
      email: v('affEmail'), ville: v('affVille'), code_postal: v('affCp'), source: v('affSource') };
    var affaire = { affaire_id: uuid(), type_id: typeId, etape_id: premiere.etape_id,
      piste_id: piste.piste_id, titre: nom, rappel: rappel, rappel_titre: v('affMotifRappel') };
    try {
      await creer('pistes', [piste]);
      await creer('affaires', [affaire]);
      S.nouvelle = false;
      dire('Affaire ouverte : ' + esc(nom) + ', rappel le ' + dateCourte(rappel) + '.');
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
    viderAttente();
    var suite = etapeSuivante(a);
    if (!suite) return;
    var avant = a.etape_id;
    a.etape_id = suite.etape_id; a.etape_le = new Date().toISOString();
    S.ouverte = a.affaire_id;
    S.attente = { id: a.affaire_id, avant: avant, apres: suite.etape_id,
      minuterie: setTimeout(viderAttente, DELAI_ANNULER) };
    rendre();
    dire('Passée à « ' + esc(suite.nom) + ' ». Choisis la prochaine date de rappel. '
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
      if (quoi === 'nouvelle') { S.nouvelle = !S.nouvelle; rendre(); if (S.nouvelle && el('affNom')) el('affNom').focus(); return; }
      if (quoi === 'annulerNouvelle') { S.nouvelle = false; rendre(); return; }
      if (quoi === 'ouvrir' && a) { viderAttente(); S.ouverte = S.ouverte === a.affaire_id ? null : a.affaire_id; rendre(); return; }
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
      if (ev.target.name !== 'affNature') return;
      var sel = el('affType');
      if (!sel) return;
      var mot = { importateur: 'import', caviste: 'cavist', restaurant: 'cavist' }[ev.target.value];
      if (!mot) return;
      var o = [].filter.call(sel.options, function (x) { return norm(x.textContent).indexOf(mot) >= 0; })[0];
      if (o) sel.value = o.value;
    });
    c.addEventListener('input', function (ev) {
      if (ev.target.id !== 'affNom') return;
      var n = norm(ev.target.value), d = el('affDoublon');
      if (!d) return;
      var deja = n.length > 2 && Object.keys(S.pistes).some(function (k) { return norm(S.pistes[k].nom) === n; });
      d.hidden = !deja;
      d.textContent = deja ? 'Tu as déjà une piste à ce nom. Vérifie que ce n’est pas la même avant de la créer.' : '';
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

  async function ouvrir() {
    brancher();
    rendre();
    if (!pret()) { dire('Ton bureau n’est pas encore raccordé. Reviens dans un instant.', true); return; }
    await charger();
    rendre();
  }

  window.BdvAffaires = { ouvrir: ouvrir, etat: etat, _S: S, MODELES: MODELES };
})();
