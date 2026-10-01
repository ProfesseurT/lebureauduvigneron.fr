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
            vue: lireVue(), choix: null, trouves: [], devisDe: {}, closesDevis: {}, focusDevis: null };

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
    var n = (panneauVoulu() && el('amodAvis')) || el('affAvis');
    var autre = n && n.id === 'amodAvis' ? el('affAvis') : el('amodAvis');
    if (autre) { autre.hidden = true; autre.innerHTML = ''; }
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
      S.devisResume = await lireMontants();
      S.charge = true; S.erreur = false; S.panneauSale = true;
      /* La journee lit les memes affaires : on les lui pose, elle repeint son panneau. */
      if (window.BdvAffairesJour) BdvAffairesJour.poser(S.affaires, S.pistes, S.types);
      return true;
    } catch (e) { S.erreur = true; return false; }
  }

  /* ---------------- LE MONTANT DE L'AFFAIRE, LOT 50 (01/10/2026) ----------------
     Regle du 28/09/2026 : « le montant n'est un chiffre que s'il vient d'un document
     ENVOYE ». Il se LIT dans `devis` (statut envoye ou accepte), il n'est copie nulle part :
     aucune colonne de montant sur `affaires`, deux endroits qui portent le meme chiffre
     divergeraient. Le devis accepte l'emporte, sinon le dernier envoye.
     UNE ABSENCE N'EST PAS UN ZERO : lecture ratee ou SQL du lot 50 pas passe (la colonne
     `envoye_le` n'existe pas), `null`, et la piece se tait sur les montants. */
  async function lireMontants() {
    try {
      var l = await BdvCompte.api('/devis?select=affaire_id,devis_id,numero,statut,total_ht_c,envoye_le,valable_jusqu,cree_le'
        + '&bureau=eq.' + encodeURIComponent(bureau()) + '&statut=in.(envoye,accepte)&order=cree_le.desc');
      if (!Array.isArray(l)) return null;
      var m = {};
      l.forEach(function (d) {
        var deja = m[d.affaire_id];
        if (!deja || (d.statut === 'accepte' && deja.statut !== 'accepte')) m[d.affaire_id] = d;
      });
      return m;
    } catch (e) { return null; }
  }
  function devisDe(a) { return (S.devisResume && a && S.devisResume[a.affaire_id]) || null; }
  function expireD(d) { return !!(d && d.statut === 'envoye' && d.valable_jusqu && String(d.valable_jusqu) < jourIso()); }
  function eurosHT(c) {
    var n = Math.round((Number(c) || 0) / 100);
    return n.toLocaleString('fr-FR') + ' € HT';
  }
  /* « Devis D-2026-0007 envoyé, 1 240 € HT, valable jusqu'au 30/10 » : une ligne, le numero,
     le montant, et ce qui presse. `court` pour la carte du kanban. */
  function ligneDevis(a, court) {
    var d = devisDe(a);
    if (!d) return '';
    var etat = d.statut === 'accepte' ? 'accepté'
      : expireD(d) ? 'expiré le ' + dateCourte(d.valable_jusqu)
      : 'envoyé' + (court ? '' : ', valable jusqu’au ' + dateCourte(d.valable_jusqu));
    return (court ? '' : 'Devis ' + esc(d.numero) + ' ') + (expireD(d) ? '<b>' + esc(etat) + '</b>' : esc(etat))
      + ', ' + esc(eurosHT(d.total_ht_c));
  }
  /* L'ETAPE « DEVIS » DU TYPE, si elle existe plus loin que l'etape courante. Les etapes sont
     celles du vigneron : on ne devine que sur le mot, et on ne fait que PROPOSER. */
  function etapeDevis(a) {
    var et = etapeDe(a.etape_id);
    var cand = etapesDe(a.type_id).filter(function (x) { return /devis/.test(norm(x.nom)) && (!et || x.ordre > et.ordre); })[0];
    return cand ? { etape_id: cand.etape_id, nom: cand.nom } : null;
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
  /* LE CLIENT VITISOFT DE L'AFFAIRE, 29/09/2026 (lot 44) : celui dont on peut ouvrir la
     fiche. Une affaire sur un client existant le porte ; une piste le porte aussi une
     fois devenue cliente (`pistes.client_id`). Un nouveau client n'en a pas : il n'a
     pas encore de fiche. Sans Vitisoft non plus, il n'y a pas de fiche a ouvrir. */
  function clientDe(a) {
    if (!a) return null;
    if (window.BdvNav && BdvNav.avecVitisoft && !BdvNav.avecVitisoft()) return null;
    if (a.client_id) return String(a.client_id);
    var p = a.piste_id && S.pistes[a.piste_id];
    return p && p.client_id ? String(p.client_id) : null;
  }
  /* CE QUE DISENT SES VENTES, lot 45 (29/09/2026). Un client en affaire a quitte
     « Clients a suivre » : sa raison le suit ici, lue dans la liste du moteur
     (`bdvMotifClient`, bdv-ecrans.js). Rien en base, et le moteur n'est JAMAIS charge
     pour elle : sans lui, sans Vitisoft, ou pour un nouveau client, on se tait.
     `clientDe()` rend deja `null` pour les deux derniers cas (pas de numero Vitisoft). */
  function motifDe(a) {
    var id = clientDe(a);
    if (!id || typeof window.bdvMotifClient !== 'function') return null;
    try { return window.bdvMotifClient(id) || null; } catch (e) { return null; }
  }
  function htmlMotif(m) {
    return m ? '<span class="motif aff-motif ' + esc(m.cls) + '">' + esc(m.label) + '</span>' : '';
  }
  function sigMotifs() {
    return enCours().map(function (a) { var m = motifDe(a); return a.affaire_id + ':' + (m ? m.label : ''); }).join('|');
  }
  var SIG_MOTIFS = null;

  /* A RELANCER, ENDORMIE : LA REGLE VIT DANS bdv-affaires-jour.js (lot 45), une seule
     fois, parce que la punaise de Ma journee et le bilan de « Mon commerce » comptent
     avec elle. Ici on lui passe le delai du type, rien d'autre. `aRelancer` = rappel
     passe ou du jour, OU endormie : c'est le bloc « A relancer : N ». */
  function etat(a, aujourdhui) {
    var t = typeDe(a.type_id) || { sommeil_jours: 30 };
    return BdvAffairesJour.etat(a, t.sommeil_jours, aujourdhui);
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
    SIG_MOTIFS = sigMotifs();
    c.innerHTML = htmlTete() + htmlEnDevis()
      + (S.vue === 'kanban' ? htmlKanban() : htmlRelancer() + htmlListe())
      + htmlCloses() + htmlReglages();
    peindrePanneau();
  }

  /* ================= LE PANNEAU, 28/09/2026 (lot 40) =================
     Demande de Ted : « garder le meme delire que sur les autres menus, l'ecran
     sur le cote ». Une affaire ouverte, et une nouvelle affaire, ne se deplient
     plus dans la liste : elles s'ouvrent dans un panneau, A DROITE de la liste
     au-dessus de 1320 px (le tiroir), en MODALE en dessous. Exactement comme une
     tache ou la fiche d'un client.

     LA DECISION N'EST PAS ICI : elle vit dans `BdvTiroir`, en bas de
     `bdv-nav.js`, comme pour les deux autres (regle du 23/09/2026 : deux
     endroits qui decident, ce sont deux seuils qui divergent). On lui passe la
     BOITE. Le dessin reprend les classes `.tmod` de la modale d'une tache :
     meme papier, meme croix, meme tiroir, sans une regle de tiroir de plus.
     Ce fichier fabrique son propre element et reste le seul a ecrire dans les
     affaires (regle du lot 34). */
  var MOD = null, MOD_RETOUR = null, MOD_CLE = '';
  function panneauVoulu() { return !!(S.nouvelle || S.ouverte); }
  function monterPanneau() {
    if (MOD) return MOD;
    MOD = document.createElement('div');
    MOD.className = 'tmod amod';
    MOD.id = 'affaireModale';
    MOD.hidden = true;
    MOD.innerHTML = '<div class="tmod__voile" data-aff="fermerPanneau"></div>'
      + '<div class="tmod__boite amod__boite" role="dialog" aria-modal="true" aria-labelledby="amodTitre">'
      + '<button type="button" class="tmod__x" data-aff="fermerPanneau" aria-label="Fermer">×</button>'
      + '<div class="amod__tete" id="amodTete"></div>'
      + '<p class="aff-avis" id="amodAvis" role="status" aria-live="polite" hidden></p>'
      + '<div class="amod__corps" id="amodCorps"></div></div>';
    document.body.appendChild(MOD);
    brancherSur(MOD);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && MOD && !MOD.hidden) { e.preventDefault(); fermerPanneau(); }
    });
    return MOD;
  }
  function cleDuPanneau() {
    if (S.nouvelle) return 'n:' + S.nouvelle;
    return S.ouverte ? 'a:' + S.ouverte : '';
  }
  /* LE PANNEAU NE SE REPEINT QUE SI SON SUJET CHANGE, OU SI LA BASE A PARLE.
     `rendre()` repasse ici a chaque clic sur un filtre : repeindre le formulaire a
     chaque fois effacerait ce que le vigneron est en train de taper. */
  function peindrePanneau(force) {
    var cle = cleDuPanneau();
    if (!cle) { if (MOD && !MOD.hidden) fermerPanneau(true); return; }
    var a = S.ouverte && S.affaires.filter(function (x) { return x.affaire_id === S.ouverte; })[0];
    if (S.ouverte && !S.nouvelle && !a) { fermerPanneau(true); return; }
    monterPanneau();
    var neuf = MOD.hidden;
    if (!neuf && cle === MOD_CLE && !force && !S.panneauSale) return;
    MOD_CLE = cle; S.panneauSale = false;
    var tete = el('amodTete'), corps = el('amodCorps');
    if (S.nouvelle) {
      corps.removeAttribute('data-affaire');
      tete.innerHTML = '<h2 class="tmod__titre" id="amodTitre">Nouvelle affaire</h2>'
        + '<p class="tmod__sous">' + (S.nouvelle === 'client'
          ? 'Chez ' + esc((S.clientPropose || {}).nom || 'ce client') + '.'
          : 'Pour un client que tu as déjà, ou un nouveau.') + '</p>';
      corps.innerHTML = S.nouvelle === 'client' ? htmlNouvelleClient() : htmlNouvelle();
      if (S.nouvelle === true) apresNouvelle();
    } else {
      var e = etat(a), t = typeDe(a.type_id), et = etapeDe(a.etape_id);
      corps.setAttribute('data-affaire', a.affaire_id);
      tete.innerHTML = '<p class="amod__marques"><span class="tmod__tampon"' + (e.retard > 0 ? ' data-ton="retard"' : '') + '>'
        + esc(et ? et.nom : 'étape') + '</span>'
        + (estNouveau(a) ? ' <span class="aff-marque">Nouveau client</span>' : '') + '</p>'
        + '<h2 class="tmod__titre" id="amodTitre">' + esc(sujet(a)) + '</h2>'
        + '<p class="tmod__sous">' + [a.titre && a.titre !== sujet(a) ? esc(a.titre) : '', t ? esc(t.nom) : '']
          .filter(Boolean).join(' · ') + '</p>'
        + '<p class="amod__etat">' + ligneEtape(a, e) + '<br>' + ligneRappel(a, e)
        + (devisDe(a) ? '<br>' + ligneDevis(a, false) : '') + '</p>'
        + htmlVentes(motifDe(a));
      corps.innerHTML = htmlEditeur(a);
      lireDevis(a);
    }
    if (neuf) {
      MOD_RETOUR = document.activeElement;
      MOD.hidden = false;
    }
    var enTiroir = false;
    if (window.BdvTiroir) enTiroir = window.BdvTiroir.poser(MOD.querySelector('.tmod__boite'));
    else document.body.style.overflow = 'hidden';
    /* ON NE VOLE LE FOCUS QU'EN MODALE, sauf pour un formulaire NEUF, qu'on vient
       d'ouvrir pour ecrire dedans (meme exception que la tache neuve). */
    if (neuf && (!enTiroir || S.nouvelle)) {
      var premier = S.nouvelle
        ? (S.nouvelle === 'client' ? el('affTitreClient') : el('affCherche'))
        : MOD.querySelector('.tmod__x');
      if (premier) { try { premier.focus(); } catch (x) {} }
    }
  }
  /* « Ce que disent tes ventes : Recul confirme, 1 234 EUR perdus a date egale (...). » Le
     montant et sa nature sont ceux de la ligne de « Clients a suivre », mot pour mot. */
  function htmlVentes(m) {
    if (!m) return '';
    return '<p class="amod__ventes">Ce que disent tes ventes : ' + esc(m.label)
      + (m.enjeu ? ', ' + esc(m.enjeu) : '') + (m.detail ? ' (' + esc(m.detail) + ')' : '') + '.</p>';
  }
  function fermerPanneau(silence) {
    var etait = S.ouverte || S.nouvelle;
    S.ouverte = null; S.nouvelle = false; S.choix = null; S.clientPropose = null;
    if (MOD && !MOD.hidden) {
      MOD.hidden = true;
      MOD_CLE = '';
      if (window.BdvTiroir) window.BdvTiroir.retirer();   // le retrait de l'atelier s'en va avec le tiroir
      else document.body.style.overflow = '';
      var r = MOD_RETOUR; MOD_RETOUR = null;
      if (r && r.isConnected && typeof r.focus === 'function') { try { r.focus(); } catch (x) {} }
    }
    if (!silence && etait) { viderAttente(); rendre(); }
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

  /* « En devis envoyé : 12 340 € HT, sur 4 affaires (dont 1 expiré) » : ce que tu peux
     gagner, et rien d'autre. Seulement des devis ENVOYES d'affaires en cours, dans le filtre
     choisi. Pas de ligne du tout si rien n'est envoye, ou si les montants n'ont pas ete lus. */
  function htmlEnDevis() {
    if (!S.devisResume) return '';
    var l = visibles().map(devisDe).filter(function (d) { return d && d.statut === 'envoye'; });
    if (!l.length) return '';
    var t = 0, x = 0;
    l.forEach(function (d) { t += Number(d.total_ht_c) || 0; if (expireD(d)) x++; });
    return '<p class="aff-aide aff-endevis">En devis envoyé : <b>' + esc(eurosHT(t)) + '</b>, sur '
      + pluriel(l.length, 'affaire', 'affaires') + (x ? ' (dont ' + x + (x > 1 ? ' expirés' : ' expiré') + ', à relancer ou refaire)' : '') + '.</p>';
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
      + ' aria-haspopup="dialog" aria-controls="affaireModale">Nouvelle affaire</button></div>';
  }

  /* Une affaire de la famille « client » porte sur un client existant : elle se
     cree depuis sa fiche (lot suivant), pas depuis ce formulaire de piste. */
  function typesPourPiste() {
    return typesActifs().filter(function (t) { return t.famille !== 'client'; });
  }
  /* UNE SEULE BARRE POUR CHERCHER OU CREER LE CLIENT, 29/09/2026 (lot 41).
     Demande de Ted, sur capture : « il faut mixer la creation. Barre de recherche
     pour chercher un client existant ou creer. Si on tape un SIRET deja existant
     dans la base ou un nom qui existe deja, on previent. » Les trois boutons
     « Pour qui ? » du lot 39 faisaient choisir la METHODE avant de chercher.
     Maintenant on tape, et la liste propose, dans cet ordre :
       1. tes clients (exports Vitisoft et nouveaux clients deja crees) ;
       2. l'annuaire officiel des entreprises, chaque ligne deja connue MARQUEE ;
       3. « Creer ... a la main ».
     UNE AFFAIRE, UN CLIENT (arbitrage du 28/09). Un client cree ici est une piste
     en base, « Nouveau client, pas encore dans Vitisoft » a l'ecran.

     UN SIRET DEJA CONNU BLOQUE, UN NOM DEJA CONNU PREVIENT. Deux etablissements
     peuvent porter le meme nom ; deux fiches ne portent pas le meme SIRET sans
     etre la meme entreprise en double. */
  function htmlNouvelle() {
    if (!S.choix) S.choix = { client: null, nouveau: false };
    var natures = NATURES.map(function (n, i) {
      return '<label class="aff-radio"><input type="radio" name="affNature" value="' + n[0] + '"'
        + (i === 0 ? ' checked' : '') + '> ' + n[1] + '</label>';
    }).join('');
    var dans7 = new Date(); dans7.setDate(dans7.getDate() + 7);
    return '<form class="aff-form" id="affForme" novalidate>'
      + '<div class="aff-client" data-zone="cherche">'
      + '<label class="aff-champ"><span>Le client</span>'
      + '<input id="affCherche" type="search" autocomplete="off" placeholder="Nom, n° client, ville ou SIRET"'
      + ' aria-describedby="affChercheAide" aria-controls="affPropositions"></label>'
      + '<p class="aff-aide" id="affChercheAide">Tes clients d’abord, puis l’annuaire officiel des entreprises. S’il n’y est pas, tu le crées.</p>'
      + '<div class="aff-propositions" id="affPropositions" aria-live="polite"></div></div>'
      + '<p class="aff-choisi" id="affChoisi" hidden></p>'
      /* LA FICHE DU NOUVEAU CLIENT, remplie par l'annuaire ou a la main */
      + '<div class="aff-zone aff-fiche" data-zone="nouveau" hidden>'
      + '<div class="aff-fiche__tete"><span class="aff-marque">Nouveau client, pas encore dans Vitisoft</span>'
      + '<button type="button" class="aff-lien" data-aff="lacherNouveau">Chercher un autre client</button></div>'
      + '<label class="aff-champ"><span>Le nom de l’établissement</span>'
      + '<input id="affNom" type="text" maxlength="120" autocomplete="off" required></label>'
      + '<div class="aff-doublon" id="affDoublon" role="status" hidden></div>'
      + '<fieldset class="aff-groupe"><legend>C’est qui ?</legend><div class="aff-radios">' + natures + '</div></fieldset>'
      + '<div class="aff-duo">' + champ('affSiret', 'SIRET (facultatif)', 'text', 17) + champ('affAdresse', 'Adresse', 'text', 200) + '</div>'
      + '<div class="aff-duo">' + champ('affCp', 'Code postal', 'text', 12) + champ('affVille', 'Ville', 'text', 80) + '</div>'
      + '<details class="aff-plus"><summary>Son contact</summary><div class="aff-plus__corps">'
      + '<div class="aff-duo">' + champ('affContact', 'Le nom de ton contact', 'text', 120) + champ('affFonction', 'Sa fonction', 'text', 80) + '</div>'
      + '<div class="aff-duo">' + champ('affTel', 'Téléphone', 'tel', 40) + champ('affEmail', 'Mail', 'email', 200) + '</div>'
      + champ('affSource', 'D’où il vient (salon, bouche à oreille…)', 'text', 120)
      + '<p class="aff-aide">C’est une fiche professionnelle : n’y note rien de personnel.</p>'
      + '</div></details></div>'
      /* L'AFFAIRE */
      + '<div class="aff-affaire">'
      + '<label class="aff-champ"><span>L’affaire (facultatif)</span>'
      + '<input id="affIntitule" type="text" maxlength="120" autocomplete="off" placeholder="Le rosé, le mariage de juin, la carte des vins…"></label>'
      + '<div class="aff-duo"><label class="aff-champ"><span>Type d’affaire</span><select id="affType"></select></label>'
      + '<label class="aff-champ"><span>Je le rappelle le</span><input id="affRappel" type="date" value="' + jourIso(dans7) + '" required></label></div>'
      + '<label class="aff-champ"><span>Pour quoi faire (facultatif)</span>'
      + '<input id="affMotifRappel" type="text" maxlength="120" placeholder="Envoyer le tarif, passer déposer deux bouteilles…"></label></div>'
      + '<div class="aff-form__pied"><button type="submit" class="btn btn--bordeaux">Créer l’affaire</button>'
      + '<button type="button" class="btn" data-aff="annulerNouvelle">Annuler</button></div>'
      + '</form>';
  }
  /* Apres chaque peinture du formulaire : l'etat du choix en cours. */
  function apresNouvelle() {
    if (!el('affForme') || !S.choix) return;
    peindreChoix();
  }
  /* LE CHOIX EN COURS, EN TROIS ETATS : on cherche, un client connu est pris, ou
     la fiche d'un nouveau client est ouverte. */
  function peindreChoix() {
    var f = el('affForme'); if (!f || !S.choix) return;
    var c = S.choix.client, nv = S.choix.nouveau;
    f.querySelector('[data-zone="cherche"]').hidden = !!(c || nv);
    f.querySelector('[data-zone="nouveau"]').hidden = !nv;
    var p = el('affChoisi');
    p.hidden = !c;
    p.innerHTML = c ? '<span class="aff-choisi__l">Client</span> <b>' + esc(c.nom) + '</b>'
      + (c.genre === 'piste' ? ' <span class="aff-marque">Nouveau client</span>' : (c.num ? ' <span class="aff-choisi__d">n° ' + esc(c.num) + '</span>' : ''))
      + (c.ville ? ' <span class="aff-choisi__d">' + esc(c.ville) + '</span>' : '')
      + ' <button type="button" class="aff-lien" data-aff="lacherClient">Changer</button>' : '';
    /* La famille « client » (nouvelle cuvee chez un client) n'a pas de sens pour un
       client qu'on vient de creer : on ne la propose qu'a un client existant. */
    var sel = el('affType');
    var garde = sel.value || S.filtre;
    var liste = nv ? typesPourPiste() : typesActifs();
    sel.innerHTML = liste.map(function (t) {
      return '<option value="' + t.type_id + '"' + (t.type_id === garde ? ' selected' : '') + '>' + esc(t.nom) + '</option>';
    }).join('');
    if (!c && !nv) peindrePropositions();
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
        siret: p.siret || '', cle: norm(p.nom + ' ' + (p.ville || '')) }; });
    return clientsVitisoft().concat(nouveaux);
  }
  function chiffresDe(q) { var d = String(q || '').replace(/[\s.]/g, ''); return /^\d+$/.test(d) ? d : ''; }
  function chercherConnus(q) {
    var d = chiffresDe(q);
    var mots = norm(q).split(' ').filter(Boolean);
    if (!mots.length) return [];
    return clientsConnus().filter(function (c) {
      if (d.length >= 9 && c.siret && c.siret.indexOf(d) === 0) return true;
      return mots.every(function (m) { return c.cle.indexOf(m) >= 0; });
    }).slice(0, 6);
  }
  /* QUI, DANS LA BASE, EST DEJA CETTE ENTREPRISE ? Par le SIRET d'abord (sur, il
     ne se partage pas), par le nom sinon (a verifier : les homonymes existent). */
  function parSiret(siret) {
    if (!siret || siret.length !== 14) return null;
    return clientsConnus().filter(function (c) { return c.siret === siret; })[0] || null;
  }
  /* DEUX NOMS PROCHES, ET PAS SEULEMENT EGAUX, 29/09/2026 (lot 42). Capture de
     Ted : « SOLUMATIC » dans sa base, et l'annuaire qui rend « SOLUMATIC (MS
     FORMATION - VITIWIN - ...) ». L'egalite stricte ne les rapprochait pas, et le
     choisir creait un doublon. On compare donc le COEUR du nom : sans ce qui est
     entre parentheses (les enseignes que l'annuaire ajoute), sans la forme
     juridique (SARL, EARL...). Puis egalite, ou l'un contenu dans l'autre en mots
     entiers s'il fait au moins cinq signes (« Cave du Port » dans « Cave du Port
     de Nantes » ; « cave » seul dans « cave de la Loire », non). */
  var FORMES_J = ['sarl', 'sas', 'sasu', 'eurl', 'sa', 'earl', 'scea', 'gaec', 'sci', 'snc', 'sca', 'scv', 'gfa',
                  'ei', 'eirl', 'selarl', 'ste', 'societe'];
  function nomCoeur(nom) {
    return norm(String(nom || '').replace(/\([^)]*\)/g, ' ')).split(' ')
      .filter(function (m) { return m && FORMES_J.indexOf(m) < 0; }).join(' ');
  }
  function nomsProches(a, b) {
    var x = nomCoeur(a), y = nomCoeur(b);
    if (x.length < 3 || y.length < 3) return false;
    if (x === y) return true;
    var court = x.length <= y.length ? x : y, long = court === x ? y : x;
    return court.length >= 5 && (' ' + long + ' ').indexOf(' ' + court + ' ') >= 0;
  }
  function parNom(nom) {
    var l = clientsConnus();
    return l.filter(function (c) { return nomCoeur(c.nom) === nomCoeur(nom) && nomCoeur(nom).length >= 3; })[0]
      || l.filter(function (c) { return nomsProches(c.nom, nom); })[0] || null;
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
      Promise.resolve(assurerLignes()).then(function () { CACHE_CLI.n = -1; peindrePropositions(); rafraichirChangements(); })
        .catch(function () {});
      return 'Tes clients arrivent sur cet appareil…';
    }
    return 'Aucun de tes clients ne correspond.';
  }

  /* L'ANNUAIRE OFFICIEL SE DEMANDE APRES UNE PAUSE DE FRAPPE, et la reponse d'une
     frappe ancienne ne remplace jamais celle d'une frappe recente (numero de
     sequence). Passe par `BdvDomaine.chercher()`, la meme porte que la fiche du
     domaine : un changement de l'API ne se corrige qu'a un endroit. */
  var ANNU = { q: '', liste: null, mot: '', attente: null, seq: 0 };
  var PAUSE_ANNUAIRE = 450;
  function demanderAnnuaire(q) {
    clearTimeout(ANNU.attente);
    if (q === ANNU.q) return;
    ANNU.q = q; ANNU.liste = null; ANNU.mot = '';
    if (norm(q).length < 3 || !window.BdvDomaine || !BdvDomaine.chercher) return;
    var n = ++ANNU.seq;
    ANNU.attente = setTimeout(async function () {
      var r;
      try { r = await BdvDomaine.chercher(q); } catch (e) { r = { ok: false, mot: 'L’annuaire ne répond pas.' }; }
      if (n !== ANNU.seq) return;
      ANNU.liste = r.ok ? r.liste : []; ANNU.mot = r.ok ? '' : r.mot;
      peindrePropositions();
    }, PAUSE_ANNUAIRE);
  }
  function peindrePropositions() {
    var box = el('affPropositions'), q = el('affCherche');
    if (!box || !q) return;
    var v = q.value.trim();
    if (!v) { box.innerHTML = lignes().length || clientsConnus().length ? '' : '<p class="aff-aide">' + motSansClients() + '</p>'; demanderAnnuaire(''); return; }
    demanderAnnuaire(v);
    var l = chercherConnus(v);
    var h = '<p class="aff-propositions__t">Tes clients</p>'
      + (l.length ? '<ul class="aff-trouves">' + l.map(function (c) { return htmlTrouve(c, 'prendreClient'); }).join('') + '</ul>'
        : '<p class="aff-aide">' + motSansClients() + '</p>');
    if (norm(v).length >= 3 && window.BdvDomaine && BdvDomaine.chercher) {
      h += '<p class="aff-propositions__t">Dans l’annuaire officiel des entreprises</p>';
      if (ANNU.liste === null && !ANNU.mot) h += '<p class="aff-aide">Recherche dans l’annuaire…</p>';
      else if (ANNU.mot) h += '<p class="aff-aide">' + esc(ANNU.mot) + '</p>';
      else if (!ANNU.liste.length) h += '<p class="aff-aide">Rien trouvé dans l’annuaire.</p>';
      else h += '<ul class="aff-trouves">' + ANNU.liste.map(function (x, i) {
        var deja = parSiret(x.siret), meme = !deja && parNom(x.nom);
        return '<li><button type="button" class="aff-trouve' + (deja ? ' aff-trouve--deja' : '') + '" data-aff="prendreSiret" data-i="' + i + '">'
          + '<span class="aff-trouve__nom">' + esc(x.nom) + '</span>'
          + (deja ? ' <span class="aff-marque aff-marque--deja">Déjà dans ta base</span>' : '')
          + (x.actif ? '' : ' <span class="aff-marque">Fermée</span>')
          + '<span class="aff-trouve__d">' + esc([x.code_postal + ' ' + x.ville, 'SIRET ' + x.siret].join(', ')) + '</span>'
          + (meme ? ' <span class="aff-marque aff-marque--deja">Sans doute déjà dans ta base</span>'
            + '<span class="aff-trouve__d">Tu as déjà « ' + esc(meme.nom) + ' »' + (meme.ville ? ', à ' + esc(meme.ville) : '') + '.</span>' : '')
          + '</button>'
          + (S.choix && S.choix.confirme === i && meme ? htmlConfirme(meme, x) : '')
          + '</li>';
      }).join('') + '</ul>';
    }
    h += '<button type="button" class="aff-trouve aff-trouve--creer" data-aff="creerMain">'
      + '<span class="aff-trouve__nom">Créer « ' + esc(v) + ' »</span><span class="aff-trouve__d">Un nouveau client, à la main</span></button>';
    box.innerHTML = h;
  }
  function trouverConnu(genre, id) {
    return clientsConnus().filter(function (c) { return c.genre === genre && c.id === id; })[0];
  }
  function prendreClient(c) {
    if (!c) return;
    S.choix.client = c; S.choix.nouveau = false; S.choix.completer = null; S.choix.confirme = null;
    peindreChoix();
    var tt = el('affIntitule'); if (tt) tt.focus();
  }
  function ouvrirFiche(remplir) {
    S.choix.client = null; S.choix.nouveau = true;
    function poser(id, v) { var n = el(id); if (n) n.value = v || ''; }
    ['affNom', 'affSiret', 'affAdresse', 'affCp', 'affVille'].forEach(function (id) { poser(id, ''); });
    Object.keys(remplir || {}).forEach(function (id) { poser(id, remplir[id]); });
    peindreChoix();
    signalerDoublon();
    var n = el('affNom'); if (n) n.focus();
  }
  /* UNE LIGNE DE L'ANNUAIRE DEJA CONNUE PAR SON SIRET prend le client existant, et
     le dit : on ne cree pas une deuxieme fiche de la meme entreprise. */
  /* UN NOM PROCHE D'UN CLIENT DEJA CONNU NE CREE RIEN SANS QU'ON LE DISE : on
     demande « c'est la meme entreprise ? ». Oui : l'affaire porte sur le client
     existant, et s'il s'agit d'un nouveau client sans SIRET, l'annuaire COMPLETE sa
     fiche a la creation de l'affaire (jamais un client Vitisoft : Vitisoft fait
     foi sur ses coordonnees). Non : la fiche d'un nouveau client s'ouvre. */
  function htmlConfirme(meme, x) {
    var complete = meme.genre === 'piste' && !meme.siret;
    return '<div class="aff-confirme" role="group" aria-label="Même entreprise ?">'
      + '<p class="aff-confirme__q">C’est la même entreprise que « ' + esc(meme.nom) + ' » ?</p>'
      + (complete ? '<p class="aff-aide">Si oui, sa fiche prendra le SIRET et l’adresse de l’annuaire.</p>' : '')
      + '<div class="aff-confirme__gestes">'
      + '<button type="button" class="btn btn--bordeaux" data-aff="confirmeOui">Oui, c’est « ' + esc(meme.nom) + ' »</button>'
      + '<button type="button" class="btn" data-aff="confirmeNon">Non, en créer un nouveau</button></div></div>';
  }
  function confirmer(oui) {
    var i = S.choix && S.choix.confirme;
    var x = ANNU.liste && ANNU.liste[i];
    S.choix.confirme = null;
    if (!x) { peindrePropositions(); return; }
    var meme = parNom(x.nom);
    if (oui && meme) {
      prendreClient(meme);
      if (meme.genre === 'piste' && !meme.siret) {
        S.choix.completer = { siret: x.siret, adresse: x.adresse || null, code_postal: x.code_postal || null, ville: x.ville || null };
        dire('L’affaire portera sur « ' + esc(meme.nom) + ' ». Sa fiche prendra le SIRET ' + esc(x.siret) + ' à la création.');
      }
      return;
    }
    ouvrirFiche({ affNom: x.nom, affSiret: x.siret, affAdresse: x.adresse, affCp: x.code_postal, affVille: x.ville });
  }
  function prendreSiret(i) {
    var x = ANNU.liste && ANNU.liste[i];
    if (!x) return;
    var deja = parSiret(x.siret);
    if (deja) {
      prendreClient(deja);
      dire('« ' + esc(deja.nom) + ' » est déjà dans ta base avec ce SIRET : l’affaire portera sur lui.');
      return;
    }
    if (parNom(x.nom)) {
      S.choix.confirme = S.choix.confirme === i ? null : i;
      peindrePropositions();
      var oui = el('affPropositions') && el('affPropositions').querySelector('[data-aff="confirmeOui"]');
      if (oui) oui.focus();
      return;
    }
    ouvrirFiche({ affNom: x.nom, affSiret: x.siret, affAdresse: x.adresse, affCp: x.code_postal, affVille: x.ville });
    if (!x.actif) dire('Attention : l’annuaire dit que cette entreprise est fermée. Vérifie avant de créer.', true);
  }
  /* LA FICHE PREVIENT A LA FRAPPE : un SIRET deja connu (et la creation sera
     refusee), ou un nom deja porte (a verifier, les homonymes existent). Dans les
     deux cas on propose de prendre le client existant, en un geste. */
  function signalerDoublon() {
    var d = el('affDoublon'), nom = el('affNom'), sir = el('affSiret');
    if (!d || !nom) return;
    var s2 = chiffresDe(sir && sir.value);
    var parS = parSiret(s2), parN = !parS && parNom(nom.value);
    var c = parS || parN;
    d.hidden = !c;
    d.classList.toggle('aff-doublon--bloque', !!parS);
    d.innerHTML = !c ? '' : (parS
      ? '<b>Ce SIRET est déjà celui de « ' + esc(parS.nom) + ' ».</b> Une entreprise, une fiche : prends-la plutôt que d’en créer une deuxième.'
      : 'Un de tes clients s’appelle déjà « ' + esc(parN.nom) + ' »' + (parN.ville ? ', à ' + esc(parN.ville) : '') + '. Vérifie que ce n’est pas le même.')
      + ' <button type="button" class="btn" data-aff="prendreClient" data-genre="' + c.genre + '" data-id="' + esc(c.id) + '">Prendre « ' + esc(c.nom) + ' »</button>';
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
      + '<p class="aff-form__t hors-ecran">Nouvelle affaire chez ' + esc(c.nom || ('le client n°' + c.id)) + '</p>'
      /* LA RAISON DE « CLIENTS A SUIVRE » (lot 44) : lue a l'ecran, jamais ecrite en base.
         Seul le pretexte propose peut partir, dans le motif du rappel, s'il le garde. */
      + (c.raison ? '<p class="aff-aide">Dans tes clients à suivre : ' + esc(c.raison) + (c.enjeu ? ', ' + esc(c.enjeu) : '') + '.</p>' : '')
      + '<label class="aff-champ"><span>Ce que tu veux lui faire prendre</span>'
      + '<input id="affTitreClient" type="text" maxlength="120" autocomplete="off" placeholder="Le rosé, le magnum, la cuvée export…" required></label>'
      + '<div class="aff-duo"><label class="aff-champ"><span>Type d’affaire</span><select id="affTypeClient">' + options + '</select></label>'
      + '<label class="aff-champ"><span>Je le rappelle le</span><input id="affRappelClient" type="date" value="' + jourIso(dans7) + '" required></label></div>'
      + '<label class="aff-champ"><span>Pour quoi faire (facultatif)</span>'
      + '<input id="affMotifClient" type="text" maxlength="120" placeholder="Lui faire goûter, lui envoyer le tarif…"'
      + (c.pretexte ? ' value="' + esc(c.pretexte) + '"' : '') + '></label>'
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
    var txt = (e.jours === 0 ? 'Depuis aujourd’hui' : pluriel(e.jours, 'jour', 'jours')) + ' dans « ' + esc(et ? et.nom : 'étape') + ' »';
    if (e.endormie) return '<b>Endormie depuis ' + pluriel(e.jours - e.sommeil, 'jour', 'jours') + '</b> : ' + txt;
    if (e.retard == null) {
      var reste = e.sommeil - e.jours;
      return txt + ', s’endort dans ' + pluriel(reste, 'jour', 'jours') + ' sans rappel';
    }
    return txt;
  }

  /* LA LIGNE, REDESSINEE AU LOT 40. Le nom ouvre le panneau (toute la ligne est
     cliquable, par le calque du bouton), l'etape est une etiquette, le rappel dit
     en mots ce qui presse. « Etape suivante » reste a portee de pouce. */
  /* SOUS L'ETIQUETTE D'ETAPE, LA DUREE SEULE : redire le nom de l'etape juste sous
     l'etiquette qui le porte faisait lire deux fois la meme chose. */
  function ligneDuree(a, e) {
    var depuis = e.jours === 0 ? 'Depuis aujourd’hui' : 'Depuis ' + pluriel(e.jours, 'jour', 'jours');
    if (e.endormie) return '<b>Endormie depuis ' + pluriel(e.jours - e.sommeil, 'jour', 'jours') + '</b>';
    if (e.retard == null) return depuis + ', s’endort dans ' + pluriel(e.sommeil - e.jours, 'jour', 'jours') + ' sans rappel';
    return depuis;
  }
  function htmlAffaire(a, avecType) {
    var e = etat(a);
    var suite = etapeSuivante(a);
    var ouverte = S.ouverte === a.affaire_id;
    var t = typeDe(a.type_id), et = etapeDe(a.etape_id);
    var qui = sujet(a);
    return '<li class="aff-ligne' + (e.endormie ? ' aff-ligne--dort' : '') + (e.retard > 0 ? ' aff-ligne--retard' : '')
      + (ouverte ? ' aff-ligne--ouverte' : '') + '" data-affaire="' + a.affaire_id + '">'
      + '<div class="aff-ligne__corps">'
      + '<p class="aff-ligne__t"><button type="button" class="aff-ligne__qui" data-aff="ouvrir"'
      + ' aria-haspopup="dialog" aria-controls="affaireModale" aria-expanded="' + (ouverte ? 'true' : 'false') + '">' + esc(qui) + '</button>'
      + (estNouveau(a) ? ' <span class="aff-marque">Nouveau client</span>' : '')
      + (motifDe(a) ? ' ' + htmlMotif(motifDe(a)) : '') + '</p>'
      + (a.titre && a.titre !== qui ? '<p class="aff-ligne__titre">' + esc(a.titre) + '</p>' : '')
      + (devisDe(a) ? '<p class="aff-ligne__s aff-ligne__devis">' + ligneDevis(a, false) + '</p>' : '')
      + '</div>'
      + '<p class="aff-ligne__etape"><span class="aff-pastille">' + esc(et ? et.nom : 'étape') + '</span>'
      + '<span class="aff-ligne__s">' + (avecType && !S.filtre && t ? esc(t.nom) + ' · ' : '') + ligneDuree(a, e) + '</span></p>'
      + '<p class="aff-ligne__rappel aff-ligne__s">' + ligneRappel(a, e) + '</p>'
      + '<div class="aff-ligne__gestes">'
      + (suite
        ? '<button type="button" class="btn" data-aff="suivante" aria-label="Passer « ' + esc(qui) + ' » à l’étape suivante, « ' + esc(suite.nom) + ' »">Étape suivante</button>'
        : '<span class="aff-ligne__fin">Dernière étape</span>')
      + '</div></li>';
  }

  function htmlEditeur(a) {
    var p = a.piste_id ? (S.pistes[a.piste_id] || {}) : null;
    var etapes = etapesDe(a.type_id).map(function (x) {
      return '<option value="' + x.etape_id + '"' + (x.etape_id === a.etape_id ? ' selected' : '') + '>' + esc(x.nom) + '</option>';
    }).join('');
    var liens = '';
    if (p && p.telephone) liens += '<a class="btn" href="tel:' + esc(String(p.telephone).replace(/[^\d+]/g, '')) + '">Appeler le ' + esc(p.telephone) + '</a>';
    if (p && p.email) liens += '<a class="btn" href="mailto:' + esc(p.email) + '">Écrire à ' + esc(p.email) + '</a>';
    if (clientDe(a)) liens += '<button type="button" class="btn" data-aff="voirFiche">Voir sa fiche</button>';
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
      + htmlDevis(a)
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

  /* « NOUVEAU DEVIS », lot 47 (30/09/2026) : UN VRAI BOUTON, ET LA LISTE DES DEVIS.
     L'emplacement du lot 46 (`aria-disabled`, `btn--bientot`, la phrase « Bientot »)
     est parti : le devis existe. Place inchangee, sous « Enregistrer », au-dessus de
     « Gagnee » ; un client comme un nouveau client, jamais sur une affaire close.
     La liste dit chaque devis de l'affaire en une ligne, « D-2026-0007, 1 240,00 EUR
     TTC, 30/09/2026 », et le rouvre ; un devis abandonne a son numero barre et le mot.
     Un devis ENREGISTRE ne donne pas de montant a l'affaire (regle du 28/09/2026) :
     rien ici n'ecrit dans `affaires`. */
  /* UNE AFFAIRE CLOSE GARDE LA LISTE DE SES DEVIS (a relire, a imprimer), sans « Nouveau
     devis » : retour du verificateur du lot 47. */
  function htmlDevis(a) {
    if (!a) return '';
    var ouverte = a.issue === 'en_cours';
    var l = htmlListeDevis(a);
    return '<div class="aff-devis">'
      + (ouverte ? '<button type="button" class="btn" data-aff="devis" aria-describedby="affDevisMot">Nouveau devis</button>' : '')
      + '<ul class="aff-devis__liste" id="affDevisListe"' + (l ? '' : ' hidden') + '>' + l + '</ul>'
      + '<p class="aff-aide aff-devis__mot" id="affDevisMot" aria-live="polite"></p></div>';
  }
  function htmlListeDevis(a) {
    var l = S.devisDe[a.affaire_id];
    if (!Array.isArray(l) || !window.BdvDevisCalcul) return '';
    return l.map(function (d) {
      var ab = d.statut === 'abandonne' || d.statut === 'refuse';
      var mot = d.statut === 'accepte' ? ' accepté' : d.statut === 'envoye' ? (expireD(d) ? ' expiré' : ' envoyé le ' + dateFr(d.envoye_le)) : '';
      return '<li><button type="button" class="aff-devis__un" data-aff="devisOuvrir" data-devis="' + esc(d.devis_id) + '">'
        + (ab ? '<s>' + esc(d.numero) + '</s> ' + (d.statut === 'refuse' ? 'refusé' : 'abandonné') : esc(d.numero) + esc(mot))
        + ', ' + esc(BdvDevisCalcul.euros(d.total_ttc_c)) + ' TTC, ' + esc(dateFr(d.date_devis)) + '</button></li>';
    }).join('');
  }
  function dateFr(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }
  /* LES DEVIS D'UNE AFFAIRE, relus a chaque ouverture du panneau. Table absente (SQL
     du lot 47 pas encore passe) ou panne : la liste se tait, le bouton reste. */
  function lireDevis(a) {
    if (!a || !pret()) return Promise.resolve();
    var id = a.affaire_id;
    return Promise.all([
      BdvCompte.api('/devis?bureau=eq.' + encodeURIComponent(bureau()) + '&affaire_id=eq.' + encodeURIComponent(id) + '&order=cree_le.desc'),
      chargerCalcul()
    ]).then(function (r) {
      S.devisDe[id] = Array.isArray(r[0]) ? r[0] : [];
      peindreListeDevis(id);
    }, function () {});
  }
  function peindreListeDevis(id) {
    var a = S.affaires.filter(function (x) { return x.affaire_id === id; })[0];
    if (!a) return;
    var h = htmlListeDevis(a);
    /* La liste d'une affaire close, sous sa ligne dans « affaires closes ». */
    var uc = el('affDevisC-' + id);
    if (uc) uc.innerHTML = h || '<li class="aff-aide">Aucun devis.</li>';
    var corps = el('amodCorps'), ul = el('affDevisListe');
    if (!ul || !corps || corps.getAttribute('data-affaire') !== id) return;
    /* Repeindre la liste ne fait pas perdre le focus a la ligne qui l'avait. */
    var act = document.activeElement, garde = act && ul.contains(act) ? act.getAttribute('data-devis') : null;
    ul.innerHTML = h;
    ul.hidden = !h;
    if (garde) { var n = ul.querySelector('[data-devis="' + garde + '"]'); if (n) { try { n.focus({ preventScroll: true }); } catch (e) {} } }
    focusDevisAttendu(id);
  }
  /* RETOUR D'UN DEVIS : la ligne du devis (neuf ou rouvert) est ramenee dans la vue du
     panneau et recoit le focus ; tant qu'elle n'est pas lue, « Nouveau devis » le garde. */
  function focusDevisAttendu(id) {
    var voulu = S.focusDevis;
    if (!voulu || voulu.affaire !== id) return;
    var n = voulu.devis ? document.querySelector('#affaireModale [data-aff="devisOuvrir"][data-devis="' + voulu.devis + '"]') : null;
    if (n) S.focusDevis = null;
    n = n || document.querySelector('#affaireModale [data-aff="devis"]') || document.querySelector('#affaireModale [data-aff="devisOuvrir"]')
      || document.querySelector('#affaireModale .tmod__x');
    if (!n) return;
    try { n.focus({ preventScroll: true }); } catch (e) { try { n.focus(); } catch (x) {} }
    if (typeof n.scrollIntoView === 'function') { try { n.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
  }
  /* LA SORTIE DU DEVIS (croix, Echap, « Completer Mon domaine ») rend le focus a un
     element VIVANT : le bouton de la ligne qui avait ouvert l'affaire, sinon le titre
     de la piece. Jamais le corps de page. */
  function focusSortie(id) {
    var n = document.querySelector('#affCorps [data-affaire="' + id + '"] [data-aff="ouvrir"]')
      || document.querySelector('#affCorps [data-affaire="' + id + '"] [data-aff="devisClose"]');
    if (n) return n;
    var t = el('affTitre');
    if (t && !t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    return t;
  }

  /* LE CHARGEUR DU DEVIS, sur le modele de `poserCss` / `poserJs` de bdv-nav.js : la
     feuille, le calcul, puis la piece, AU CLIC et une seule fois (la promesse est
     retenue). Rien de tout cela n'est dans le code bloquant du bureau. Un echec rend
     la main : le clic suivant reessaie. */
  var _devis = null;
  function poserCss(href) {
    return new Promise(function (ok) {
      if (document.querySelector('link[href="' + href + '"]')) return ok();
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = l.onerror = function () { ok(); };
      document.head.appendChild(l);
    });
  }
  function poserJs(src) {
    return new Promise(function (ok, ko) {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      var t = document.createElement('script');
      t.src = src;
      t.onload = function () { ok(); };
      t.onerror = function () { t.remove(); ko(new Error('chargement impossible : ' + src)); };
      document.head.appendChild(t);
    });
  }
  function chargerCalcul() {
    return window.BdvDevisCalcul ? Promise.resolve() : poserJs('/js/bdv-devis-calcul.js');
  }
  function chargerDevis() {
    if (window.BdvDevis) return Promise.resolve(window.BdvDevis);
    if (_devis) return _devis;
    var p = poserCss('/css/bdv-devis.css').then(chargerCalcul)
      .then(function () { return window.BdvCommande ? null : poserJs('/js/bdv-commande.js'); })
      .then(function () { return window.BdvDevis ? null : poserJs('/js/bdv-devis.js'); })
      .then(function () { if (!window.BdvDevis) throw new Error('devis absent'); return window.BdvDevis; });
    _devis = p;
    p.catch(function () { if (_devis === p) _devis = null; });
    return p;
  }
  /* OUVRIR UN DEVIS : UNE SEULE BOITE A LA FOIS (regle du lot 44). L'etape en attente
     s'ecrit, le panneau d'affaire se retire (`BdvTiroir.retirer`), puis la piece du
     devis pose `#devisModale`. « Retour a l'affaire » rouvre ce panneau. On ne ferme
     rien tant que la piece n'est pas arrivee : un echec laisse le vigneron ou il etait. */
  function ouvrirDevis(a, devisId) {
    if (!a) return;
    var mot = el('affDevisMot');
    if (mot) mot.textContent = '';
    var dv = devisId ? (S.devisDe[a.affaire_id] || []).filter(function (d) { return d.devis_id === devisId; })[0] : null;
    if (devisId && !dv) return;
    var id = a.affaire_id, qui = sujet(a), neuf = estNouveau(a), issue = a.issue, etD = a.issue === 'en_cours' ? etapeDevis(a) : null;
    /* LOT 51 : combien d'AUTRES devis de l'affaire sont encore en cours. « Il a dit non » ne
       propose de clore l'affaire que s'il n'y en a aucun (la base refuse sinon). */
    var autres = (S.devisDe[a.affaire_id] || []).filter(function (x) {
      return (!dv || x.devis_id !== dv.devis_id) && (x.statut === 'enregistre' || x.statut === 'envoye'); }).length;
    return chargerDevis().then(function (D) {
      viderAttente();
      fermerPanneau();
      D.ouvrir({
        bureau: bureau(), affaire: { affaire_id: id, issue: issue, rappel: a.rappel || null, rappel_titre: a.rappel_titre || null },
        etapeDevis: etD, sujet: qui, nouveau: neuf, devis: dv || null, autresEnCours: autres,
        retour: function (devisId) {
          if (issue !== 'en_cours') { rendre(); var b = focusSortie(id); if (b) { try { b.focus(); } catch (e) {} } return; }
          S.nouvelle = false; S.choix = null; S.ouverte = id; MOD_CLE = '';
          S.focusDevis = { affaire: id, devis: devisId || null };
          rendre();
          focusDevisAttendu(id);
        },
        focusSortie: function () { return focusSortie(id); },
        /* LOT 49 : un devis ACCEPTE a passe l'affaire a Gagnee dans la base. On relit les
           affaires tout de suite (la liste, le bilan et Ma journee), et le retour suit
           le chemin d'une affaire close. */
        /* LOT 50 : l'envoi pose le rappel et peut changer l'etape, refaire abandonne l'ancien, et
           tout change le montant : on relit les affaires a chaque geste qui ecrit. */
        change: function (d) {
          S.devisDe[id] = null;
          if (d && d.statut === 'accepte') issue = 'gagnee';
          /* LOT 51 : un refus qui clot l'affaire, une acceptation annulee qui la rouvre. */
          if (d && d.statut === 'refuse' && d.affaireClose) issue = 'perdue';
          if (d && d.affaireRouverte && issue === 'gagnee') issue = 'en_cours';
          charger().then(function (ok) { if (ok) rendre(); });
        }
      });
    }, function () {
      var m = el('affDevisMot');
      if (m) { m.textContent = 'Le devis ne s’est pas ouvert : vérifie ta connexion et réessaie.'; montrer(m); }
    });
  }
  /* LA PHRASE EST RAMENEE DANS LA VUE, dans le panneau qui defile (modale ou tiroir) :
     sous « Enregistrer », elle tombait sous le bord a 1440 et coupee a 390. `nearest` :
     on ne bouge que ce qu'il faut. Instantane si le vigneron a coupe les mouvements. */
  function montrer(n) {
    if (!n || typeof n.scrollIntoView !== 'function') return;
    var calme = false;
    try { calme = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    try { n.scrollIntoView({ block: 'nearest', behavior: calme ? 'auto' : 'smooth' }); } catch (e) {}
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
    var nRel = dans.filter(function (a) { return etat(a).aRelancer; }).length;
    var cols = etapesDe(t.type_id).map(function (et) {
      var ici = dans.filter(function (a) { return a.etape_id === et.etape_id; });
      return '<section class="aff-col" data-colonne="' + et.etape_id + '" aria-label="' + esc(et.nom) + ', ' + ici.length + '">'
        + '<h3 class="aff-col__t">' + esc(et.nom) + ', ' + ici.length + '</h3>'
        + '<ul class="aff-col__liste">' + ici.map(htmlCarte).join('') + '</ul></section>';
    }).join('');
    return '<div class="aff-bloc">'
      + (nRel ? '<p class="aff-kanban__rel">Les affaires à relancer sont signalées en mots sur leur carte.</p>' : '')
      + (dans.length ? '' : '<p class="aff-vide">Aucune affaire en cours dans « ' + esc(t.nom) + ' ».</p>')
      + '<div class="aff-kanban">' + cols + '</div>'
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
      + '<p class="aff-ligne__t"><button type="button" class="aff-ligne__qui" data-aff="ouvrir" aria-haspopup="dialog"'
      + ' aria-controls="affaireModale" aria-expanded="' + (ouverte ? 'true' : 'false') + '">' + esc(qui) + '</button></p>'
      + (a.titre && a.titre !== qui ? '<p class="aff-ligne__s">' + esc(a.titre) + '</p>' : '')
      + (estNouveau(a) ? '<p class="aff-marque">Nouveau client</p>' : '')
      + (motifDe(a) ? '<p class="aff-carte__motif">' + htmlMotif(motifDe(a)) + '</p>' : '')
      + '<p class="aff-ligne__s">' + ligneRappel(a, e) + '</p>'
      + (devisDe(a) ? '<p class="aff-ligne__s aff-ligne__devis">Devis ' + ligneDevis(a, true) + '</p>' : '')
      + (e.endormie ? '<p class="aff-ligne__s"><b>Endormie depuis ' + pluriel(e.jours - e.sommeil, 'jour', 'jours') + '</b></p>' : '')
      + '<div class="aff-carte__gestes">'
      + '<select class="aff-carte__deplacer" data-deplacer aria-label="Déplacer « ' + esc(qui) + ' » vers une autre étape">' + opts + '</select>'
      + '</div></li>';
  }

  function htmlRelancer() {
    var r = visibles().filter(function (a) { return etat(a).aRelancer; })
      .sort(function (a, b) {
        var ra = etat(a).retard, rb = etat(b).retard;
        return (rb == null ? -1 : rb) - (ra == null ? -1 : ra);
      });
    /* `affRelancer` : la case « A relancer » du bilan commun y pose le focus (lot 45). */
    if (!r.length) return '<div class="aff-bloc"><h3 class="aff-bloc__t" id="affRelancer" tabindex="-1">À relancer</h3>'
      + '<p class="aff-vide">Rien à relancer aujourd’hui.</p></div>';
    return '<div class="aff-bloc aff-bloc--relancer"><h3 class="aff-bloc__t" id="affRelancer" tabindex="-1">À relancer : ' + r.length + '</h3>'
      + '<ul class="aff-liste">' + r.map(function (a) { return htmlAffaire(a, true); }).join('') + '</ul></div>';
  }
  function htmlListe() {
    var reste = visibles().filter(function (a) { return !etat(a).aRelancer; });
    var types = S.filtre ? [typeDe(S.filtre)].filter(Boolean) : typesActifs();
    var html = '';
    types.forEach(function (t) {
      var dans = reste.filter(function (a) { return a.type_id === t.type_id; });
      if (!dans.length) return;
      var blocs = etapesDe(t.type_id).map(function (et) {
        var ici = dans.filter(function (a) { return a.etape_id === et.etape_id; });
        if (!ici.length) return '';
        return '<h4 class="aff-etape">' + esc(et.nom) + ', ' + ici.length + '</h4>'
          + '<ul class="aff-liste">' + ici.map(function (a) { return htmlAffaire(a, false); }).join('') + '</ul>';
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
    var gHT = 0, gN = 0;
    c.forEach(function (a) { var d = a.issue === 'gagnee' && devisDe(a); if (d && d.statut === 'accepte') { gHT += Number(d.total_ht_c) || 0; gN++; } });
    var deplie = Object.keys(S.closesDevis).some(function (k) { return S.closesDevis[k]; });
    return '<details class="aff-plus aff-closes"' + (deplie ? ' open' : '') + '><summary>Voir et rouvrir les affaires closes depuis un an ('
      + g + ' gagnée' + (g > 1 ? 's' : '') + ' sur ' + c.length
      + (gN ? ', ' + eurosHT(gHT) + ' en devis acceptés' : '') + ')</summary><ul class="aff-liste">'
      + c.map(function (a) {
        var m = MOTIFS.filter(function (x) { return x[0] === a.motif; })[0];
        return '<li class="aff-ligne" data-affaire="' + a.affaire_id + '"><div class="aff-ligne__corps">'
          + '<p class="aff-ligne__t"><span class="aff-ligne__qui">' + esc(sujet(a)) + '</span></p>'
          + '<p class="aff-ligne__s">' + (a.issue === 'gagnee' ? 'Gagnée' : 'Pas pour cette fois' + (m ? ' (' + m[1].toLowerCase() + ')' : ''))
          + ' le ' + dateCourte(jourLocal(a.close_le)) + '</p></div>'
          + '<div class="aff-ligne__gestes"><button type="button" class="btn" data-aff="devisClose" aria-controls="affDevisC-' + a.affaire_id + '"'
          + ' aria-expanded="' + (S.closesDevis[a.affaire_id] ? 'true' : 'false') + '">Ses devis</button>'
          + '<button type="button" class="btn" data-aff="rouvrir">Rouvrir</button></div>'
          + '<ul class="aff-devis__liste" id="affDevisC-' + a.affaire_id + '"' + (S.closesDevis[a.affaire_id] ? '' : ' hidden') + '>'
          + (S.closesDevis[a.affaire_id] ? (htmlListeDevis(a) || (Array.isArray(S.devisDe[a.affaire_id]) ? '<li class="aff-aide">Aucun devis.</li>' : '')) : '')
          + '</ul></li>';
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
    var ch = S.choix || {};
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
    if (!ch.client && !ch.nouveau) {
      dire('Choisis le client dans la liste, ou crée-le.', true); if (el('affCherche')) el('affCherche').focus(); return;
    }
    if (ch.client) {
      var c = ch.client;
      nom = c.nom;
      if (c.genre === 'client') { affaire.client_id = c.id; affaire.client_nom = c.nom; }
      else affaire.piste_id = c.id;
    } else {
      nom = v('affNom');
      if (!nom) { dire('Il faut le nom de l’établissement.', true); el('affNom').focus(); return; }
      var sir = String(v('affSiret') || '').replace(/\s/g, '');
      if (sir && !/^\d{14}$/.test(sir)) { dire('Un SIRET a 14 chiffres.', true); el('affSiret').focus(); return; }
      var deja = parSiret(sir);
      if (deja) { dire('Ce SIRET est déjà celui de « ' + esc(deja.nom) + ' ». Prends-le plutôt que d’en créer une deuxième fiche.', true); signalerDoublon(); return; }
      var nat = document.querySelector('input[name="affNature"]:checked');
      piste = { piste_id: uuid(), nom: nom, nature: nat ? nat.value : 'autre',
        contact_nom: v('affContact'), contact_fonction: v('affFonction'), telephone: v('affTel'),
        email: v('affEmail'), ville: v('affVille'), code_postal: v('affCp'), source: v('affSource'),
        siret: sir || null, adresse: v('affAdresse') };
      affaire.piste_id = piste.piste_id;
    }
    affaire.titre = v('affIntitule') || nom;
    var sansSiret = false;
    try {
      /* Le client choisi est un nouveau client sans SIRET, reconnu dans l'annuaire :
         on complete sa fiche, champ vide par champ vide, jamais par-dessus une saisie. */
      if (ch.client && ch.completer && ch.client.genre === 'piste') {
        var p0 = S.pistes[ch.client.id] || {}, comp = {};
        Object.keys(ch.completer).forEach(function (k) { if (ch.completer[k] && !p0[k]) comp[k] = ch.completer[k]; });
        if (Object.keys(comp).length) {
          try { await modifier('pistes', 'piste_id', ch.client.id, comp); }
          catch (e) { if (!/siret|adresse/.test(String(e && e.detail || ''))) throw e; sansSiret = true; }
        }
      }
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
    S.ouverte = a.affaire_id; S.nouvelle = false; S.panneauSale = true;
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

  /* « VOIR SA FICHE », 29/09/2026 (lot 44). UNE SEULE BOITE A LA FOIS : le panneau et
     la fiche passent tous deux par `BdvTiroir`, on ferme donc le panneau (l'etape en
     attente part avec) avant de demander la fiche au SEUL ouvreur du bureau,
     `window.bdvOuvrirFiche`. Il rend une promesse : `false` si le moteur ne connait pas
     ce client sur cet appareil, 'panne' si le reseau a lache. On le DIT ici, parce que
     c'est d'ici qu'est parti le clic : son propre avis vit dans « Ma journee ». */
  function voirFiche(a) {
    var id = clientDe(a);
    if (!id) return;
    viderAttente();
    fermerPanneau();
    var ouvreur = window.bdvOuvrirFiche;
    if (typeof ouvreur !== 'function') {
      direVisible('Sa fiche ne s’ouvre pas d’ici. Tu la trouves dans « Clients à suivre » ou « Mes clients ».');
      return;
    }
    /* LES MOTS SONT CEUX DE L'OUVREUR (`motInconnu`, `motPanne`, mon-bureau.njk) : un seul
       texte pour dire la meme panne, ou qu'on ait clique. `muet` lui dit de ne pas ecrire
       aussi dans l'avis de « Ma journee », qu'on retrouverait au retour. */
    var panne = ouvreur.motPanne || 'Sa fiche n’a pas pu s’ouvrir : vérifie ta connexion et réessaie.';
    var r;
    try { r = ouvreur(id, null, null, { muet: true }); } catch (e) { r = 'panne'; }
    return Promise.resolve(r).then(function (ok) {
      if (ok === false) direVisible(ouvreur.motInconnu || 'Sa fiche ne s’ouvre pas d’ici.');
      else if (ok === 'panne') direVisible(panne);
    }, function () { direVisible(panne); });
  }
  /* UN AVIS HORS DE L'ECRAN N'EST PAS DIT, 29/09/2026 (lot 44). A 390 px, page descendue,
     `#affAvis` est au-dessus de ce qu'on voit : on l'amene au milieu de l'ecran (le haut
     passerait sous l'en-tete colle), sans animation si le vigneron les a coupees. Le
     panneau est ferme a ce moment-la : modale ou tiroir, c'est le meme avis de la page. */
  function direVisible(html) {
    dire(html, true);
    var n = (panneauVoulu() && el('amodAvis')) || el('affAvis');
    if (!n || n.hidden || typeof n.scrollIntoView !== 'function') return;
    var calme = false;
    try { calme = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    try { n.scrollIntoView({ block: 'center', behavior: calme ? 'auto' : 'smooth' }); } catch (e) {}
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
    brancherSur(c);
    ecouteursUniques();
  }
  /* Le corps de la piece ET le panneau : les memes ecouteurs delegues, poses une
     fois sur chacun. Le panneau vit hors de `#affCorps`, dans le <body>. */
  function brancherSur(c) {
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
        viderAttente(); S.ouverte = null; S.nouvelle = true; S.choix = null; MOD_CLE = ''; rendre();
        return;
      }
      if (quoi === 'annulerNouvelle' || quoi === 'fermerPanneau') { fermerPanneau(); return; }
      if (quoi === 'annulerSuivante') { annulerSuivante(); return; }
      if (quoi === 'vue') { viderAttente(); poserVue(b.getAttribute('data-vue')); rendre(); return; }
      if (quoi === 'prendreSiret') { prendreSiret(+b.getAttribute('data-i')); return; }
      if (quoi === 'prendreClient') { prendreClient(trouverConnu(b.getAttribute('data-genre'), b.getAttribute('data-id'))); return; }
      if (quoi === 'confirmeOui' || quoi === 'confirmeNon') { confirmer(quoi === 'confirmeOui'); return; }
      if (quoi === 'creerMain') { ouvrirFiche({ affNom: (el('affCherche') || {}).value || '' }); return; }
      if (quoi === 'lacherClient' || quoi === 'lacherNouveau') {
        S.choix.client = null; S.choix.nouveau = false; peindreChoix();
        if (el('affCherche')) el('affCherche').focus();
        return;
      }
      if (quoi === 'rattacher' && a) { rattacher(a, b.getAttribute('data-genre'), b.getAttribute('data-id')); return; }
      if (quoi === 'ouvrir' && a) {
        viderAttente();
        if (S.ouverte === a.affaire_id) { fermerPanneau(); return; }
        S.nouvelle = false; S.choix = null; S.ouverte = a.affaire_id; rendre();
        return;
      }
      if (quoi === 'suivante' && a) { suivante(a); return; }
      if (quoi === 'voirFiche' && a) { voirFiche(a); return; }
      if (quoi === 'devis' && a) { ouvrirDevis(a, null); return; }
      if (quoi === 'devisOuvrir' && a) { ouvrirDevis(a, b.getAttribute('data-devis')); return; }
      if (quoi === 'devisClose' && a) {
        var ouvre = !S.closesDevis[a.affaire_id];
        S.closesDevis[a.affaire_id] = ouvre;
        b.setAttribute('aria-expanded', ouvre ? 'true' : 'false');
        var uc = el('affDevisC-' + a.affaire_id);
        if (uc) { uc.hidden = !ouvre; if (ouvre) { uc.innerHTML = htmlListeDevis(a); lireDevis(a); } }
        return;
      }
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
      if (t.id === 'affCherche') { if (S.choix) S.choix.confirme = null; peindrePropositions(); return; }
      if (t.classList && t.classList.contains('aff-change-q')) { peindreChangement(t); return; }
      if (t.id === 'affNom' || t.id === 'affSiret') signalerDoublon();
    });
    /* Entree dans la recherche SIRET cherche, elle ne cree pas l'affaire. */
    c.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      if (ev.target.id === 'affCherche' || (ev.target.classList && ev.target.classList.contains('aff-change-q'))) ev.preventDefault();
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
  }
  function ecouteursUniques() {
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
  /* « VOIR SON AFFAIRE » DEPUIS « CLIENTS A SUIVRE », 29/09/2026 (lot 44) : le client a
     deja une affaire en cours, on l'ouvre plutot que d'en creer une deuxieme. Meme
     passage par sessionStorage, pour la meme raison que la fiche. */
  function lireAffaireDemandee() {
    try {
      var id = sessionStorage.getItem('bdv_affaire_ouvrir');
      if (!id) return null;
      sessionStorage.removeItem('bdv_affaire_ouvrir');
      return id;
    } catch (e) { return null; }
  }

  /* LE BILAN COMMUN DEMANDE UNE VUE, 29/09/2026 (lot 45) : « Affaires en cours » et
     « A relancer » menent a « Toutes » ; « A relancer » demande en plus la Liste et le
     focus sur son bloc. La Liste est posee EN MEMOIRE : `bdv_aff_vue` garde le choix
     du vigneron, un clic sur un chiffre ne le reecrit pas. */
  function lireVueDemandee() {
    try {
      var brut = sessionStorage.getItem('bdv_affaire_vue');
      if (!brut) return null;
      sessionStorage.removeItem('bdv_affaire_vue');
      return JSON.parse(brut) || null;
    } catch (e) { return null; }
  }

  async function ouvrir() {
    lireClientPropose();
    var demandee = lireAffaireDemandee();
    var vue = lireVueDemandee();
    if (vue) {
      S.filtre = vue.filtre || '';
      if (vue.vue === 'liste') S.vue = 'liste';
    }
    brancher();
    rendre();
    if (!pret()) { dire('Ton bureau n’est pas encore raccordé. Reviens dans un instant.', true); return; }
    await charger();
    if (demandee && !S.nouvelle && S.affaires.some(function (a) { return a.affaire_id === demandee && a.issue === 'en_cours'; })) {
      S.ouverte = demandee;
    }
    rendre();
    if (vue && vue.focus === 'relancer' && !S.nouvelle && !S.ouverte) {
      var h = el('affRelancer');
      if (h) { try { h.focus(); } catch (e) {} }
    }
  }

  /* « Clients a suivre » vient de se calculer (`bdv:clients`) : les raisons ont pu
     arriver ou changer. On repeint la piece seulement si une etiquette change, en
     rendant le focus au meme geste de la meme affaire. Le panneau, lui, ne se repeint
     que si son sujet change (peindrePanneau). */
  document.addEventListener('bdv:clients', function () {
    if (!S.charge || !S.types.length || !el('affCorps')) return;
    if (sigMotifs() === SIG_MOTIFS) return;
    var act = document.activeElement, c = el('affCorps');
    var li = act && c.contains(act) && act.closest ? act.closest('[data-affaire]') : null;
    var cle = li ? li.getAttribute('data-affaire') : null, geste = act && act.getAttribute ? act.getAttribute('data-aff') : null;
    rendre();
    if (cle) {
      var n = c.querySelector('[data-affaire="' + cle + '"] ' + (geste ? '[data-aff="' + geste + '"]' : 'button, select'));
      if (n) { try { n.focus(); } catch (e) {} }
    }
  });

  window.BdvAffaires = { ouvrir: ouvrir, etat: etat, _S: S, _chargerDevis: chargerDevis, MODELES: MODELES, _nomsProches: nomsProches, _deplacer: function (id, e) {
    var a = S.affaires.filter(function (x) { return x.affaire_id === id; })[0]; if (a) deplacer(a, e); } };
})();
