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
            filtre: '', ouverte: null, nouvelle: false, attente: null,
            vue: lireVue(), choix: null, trouves: [], devisDe: {}, lienDe: {}, closesDevis: {}, focusDevis: null, versionsHt: {} };

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
  function finPoint(t) { return /[.!?]$/.test(t) ? t : t + '.'; }
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
    /* Les refus du lot 56 (tour 2, N1). */
    if (/pistes_siret_unique/.test(tout)) return 'Ce SIRET est déjà dans ton bureau, sur une autre fiche : rien n’a été créé.';
    if (/ne veut plus etre contactee/.test(tout)) return 'Cette personne a demandé à ne plus être contactée : rien n’a été enregistré.';
    if (/opposition ne se leve pas/.test(tout)) return 'Cette personne a demandé à ne plus être contactée : ce choix ne se défait pas depuis le bureau.';
    if (/ne change pas de type/.test(tout)) return 'Une étape reste dans son type d’affaire.';
    if (/affaires_client_non_vide/.test(tout)) return 'Choisis le client de l’affaire.';
    if (/affaires_perdue_motif/.test(tout)) return 'Dis pourquoi ce n’est pas pour cette fois.';
    return 'Rien n’a été enregistré : la base a refusé, ou la connexion a lâché. Réessaie.';
  }
  /* N1 (tour 2, 02/10/2026) : UNE COLONNE INCONNUE, ET RIEN D'AUTRE. Le repli « sans
     SIRET ni adresse » servait le lot 39 pas encore passe ; il testait seulement le mot
     « siret », que le refus de doublon du lot 56 (`pistes_siret_unique`) contient aussi.
     Le doublon passait sans son SIRET, sous un faux motif. On ne retente que sur les
     codes de colonne inconnue : PGRST204 (PostgREST) et 42703 (Postgres). */
  function colonneInconnue(e, motif) {
    var d = String((e && e.detail) || '');
    return motif.test(d) && /PGRST204|42703|Could not find the|does not exist/.test(d);
  }
  function doublonSiret(e) { return /pistes_siret_unique/.test(String((e && e.detail) || '')); }
  /* N8 : « le 9 oct.. » ; une date abregee porte deja son point. */
  function point(x) { return /\.$/.test(x) ? x : x + '.'; }
  function pointB(x) { return /\.(<\/b>)?$/.test(x) ? x : x + '.'; }   // « 23 oct.</b> » finit deja la phrase
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
  /* B6 (01/10/2026) : PostgREST plafonne une reponse a 1 000 lignes (« Max rows », la
     valeur de Supabase). Au-dela, une liste tronquee se lisait comme une liste entiere, et
     une affaire en cours restee sans geste disparaissait derriere des affaires closes plus
     recentes. On lit donc PAR PAGES de 1 000, sur un ordre TOTAL (la cle de la table en
     dernier : un ordre qui n'est pas total fait sauter ou doubler des lignes d'une page a
     l'autre). Une page pleine en appelle une autre ; une page courte dit la fin. `null` des
     qu'une page n'est pas lisible : une liste a moitie lue n'est pas une liste. */
  var PAGE = 1000;
  var CLE_TABLE = { affaire_types: 'type_id', affaire_etapes: 'etape_id', pistes: 'piste_id', affaires: 'affaire_id' };
  async function lirePages(chemin) {
    var tout = [];
    for (var off = 0; off < 200 * PAGE; off += PAGE) {
      var r = await BdvCompte.api(chemin + '&limit=' + PAGE + '&offset=' + off);
      if (r == null) return null;
      if (!Array.isArray(r)) return r;
      tout = tout.concat(r);
      if (r.length < PAGE) break;
    }
    return tout;
  }
  function lire(table, ordre) {
    var cle = CLE_TABLE[table];
    var o = [ordre, cle ? cle + '.asc' : ''].filter(Boolean).join(',');
    return lirePages('/' + table + '?select=*&bureau=eq.' + encodeURIComponent(bureau())
      + (o ? '&order=' + o : ''));
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
      S.charge = true; S.erreur = false; S.panneauSale = true; S.luLe = new Date();
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
      var l = await lirePages('/devis?select=affaire_id,devis_id,numero,statut,total_ht_c,envoye_le,valable_jusqu,cree_le,date_devis'
        + '&bureau=eq.' + encodeURIComponent(bureau()) + '&statut=in.(envoye,accepte)&order=cree_le.desc,devis_id.asc');
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
    /* X4 (tour 3) : AU CENTIME, comme le devis, la commande et /signer/ : « 527 € » ici et
       « 526,80 € » partout ailleurs, c'etait deux ecritures du meme montant. */
    var n = Math.round(Number(c) || 0) / 100;
    /* S12 (01/10/2026) : espaces INSECABLES entre le nombre, « € » et « HT ». A 1440 le
       tiroir coupait « 376 » d'un cote et « € HT » de l'autre. */
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\s\u202f]/g, '\u00a0') + '\u00a0€\u00a0HT';
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
    return BdvAffairesJour.etat(a, t.sommeil_jours, aujourdhui, oppose(a));
  }
  /* N4 (tour 2, 02/10/2026) : L'AFFAIRE D'UNE PERSONNE QUI A DEMANDE A NE PLUS ETRE
     CONTACTEE. Elle ne se relance pas, ne se deplace pas, ne prend ni rappel ni devis :
     elle se classe. La base refuse le reste (lot 56, section 7). */
  function oppose(a) { var p = a && a.piste_id && S.pistes[a.piste_id]; return !!(p && p.opposition); }
  var MARQUE_OPP = 'Ne veut plus être contactée';
  function enCours() { return S.affaires.filter(function (a) { return a.issue === 'en_cours'; }); }
  function typesActifs() { return S.types.filter(function (t) { return !t.archive; }); }
  function visibles() {
    return enCours().filter(function (a) { return !S.filtre || a.type_id === S.filtre; });
  }

  /* ---------------- LE DESSIN ---------------- */
  function rendre() {
    peindreReglages();
    if (S.page) { peindrePage(); return; }
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
    /* M7 : REPEINDRE NE PERD PAS LE FOCUS. Un geste de la piece qui avait le focus (le
       bouton d'une ligne, un filtre, « Nouvelle affaire ») le retrouve sur son jumeau
       repeint ; sans ca, deux repeintes de suite (une relecture, puis le geste) le
       laissaient sur le corps de page. */
    var act = document.activeElement, garde = null;
    if (act && act !== document.body && c.contains(act) && act.getAttribute('data-aff')) {
      var li = act.closest('[data-affaire]');
      garde = (li ? '[data-affaire="' + li.getAttribute('data-affaire') + '"] ' : '') + '[data-aff="' + act.getAttribute('data-aff') + '"]'
        + (act.hasAttribute('data-type') ? '[data-type="' + act.getAttribute('data-type') + '"]' : '')
        + (act.hasAttribute('data-vue') ? '[data-vue="' + act.getAttribute('data-vue') + '"]' : '');
    }
    c.innerHTML = htmlPerime() + htmlEtat() + htmlTete()
      + (S.vue === 'kanban' ? htmlKanban() : htmlRelancer() + htmlListe())
      + htmlCloses();
    var nf = garde && c.querySelector(garde);
    if (nf) { try { nf.focus({ preventScroll: true }); } catch (x) {} }
    peindrePanneau();
  }

  /* M11 (01/10/2026) : UNE RELECTURE RATEE NE SE MONTRE PAS COMME UNE LISTE FRAICHE.
     La piece garde ce qu'elle savait (une absence n'est pas un zero), et le DIT, avec
     l'heure de la derniere lecture reussie et le geste qui reessaie. */
  function htmlPerime() {
    if (!S.erreur || !S.charge) return '';
    var h = S.luLe ? S.luLe.getHours() + '\u00a0h\u00a0' + String(S.luLe.getMinutes()).padStart(2, '0') : '';
    return '<p class="aff-avis aff-avis--souci aff-perime" role="status">Tes affaires n’ont pas pu être lues à nouveau'
      + (h ? ' : ce que tu vois date de ' + h : '') + '. '
      + '<button type="button" class="btn" data-aff="relire">Réessayer</button></p>';
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
      /* « AGRANDIR », 03/10/2026 : l'affaire en pleine page, dans un nouvel onglet, comme la
         fiche d'un client. A cote de la croix : fermer ou agrandir au meme endroit. */
      + '<a class="amod__agrandir" id="amodAgrandir" href="/mon-bureau/#affaires" target="_blank" rel="noopener" title="Agrandir dans un nouvel onglet" hidden><span class="hors-ecran">Agrandir l’affaire dans un nouvel onglet</span></a>'
      + '<div class="amod__tete" id="amodTete"></div>'
      + '<p class="aff-avis" id="amodAvis" role="status" aria-live="polite" hidden></p>'
      + '<div class="amod__corps" id="amodCorps"></div></div>';
    document.body.appendChild(MOD);
    brancherSur(MOD);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && MOD && !MOD.hidden) { e.preventDefault(); fermerPanneau(); }
    });
    /* S3 (01/10/2026) : EN MODALE, LE CLAVIER RESTE DANS LE PANNEAU. La boite porte
       `aria-modal="true"` sous 1320 px : elle DIT qu'il n'y a rien d'autre a l'ecran, et
       Tab doit le prouver (regle du 19/09/2026, la fiche client et le devis le font). En
       tiroir, sortir est voulu : la liste a cote reste le sujet. La liste des cibles se
       relit a chaque Tab, le panneau se repeint apres chaque geste ; on ecarte ce qui est
       masque (un bloc `hidden`, le contenu d'un `details` ferme, sauf son summary). */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !MOD || MOD.hidden) return;
      if (window.BdvTiroir && BdvTiroir.actif && BdvTiroir.actif()) return;
      var boite = MOD.querySelector('.tmod__boite');
      var cibles = [].slice.call(boite.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])'))
        .filter(function (n) {
          if (n.closest('[hidden]')) return false;
          var d = n.closest('details:not([open])');
          return !d || (n.tagName === 'SUMMARY' && n.parentNode === d);
        });
      if (!cibles.length) return;
      var prem = cibles[0], dern = cibles[cibles.length - 1], ici = document.activeElement;
      if (!boite.contains(ici)) { e.preventDefault(); (e.shiftKey ? dern : prem).focus(); return; }
      if (e.shiftKey && ici === prem) { e.preventDefault(); dern.focus(); }
      else if (!e.shiftKey && ici === dern) { e.preventDefault(); prem.focus(); }
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
    /* S2 (01/10/2026) : UN AVIS APPARTIENT A SON SUJET. « La Cave de Clisson est deja dans
       ta base... » restait affiche au-dessus d'une autre affaire, ou d'un client cree a la
       main. Un sujet neuf (ouverture, autre affaire) part avec un avis vide. */
    if (neuf || cle !== MOD_CLE) viderAvisPanneau();
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
      corps.setAttribute('data-affaire', a.affaire_id);
      /* Lot 57 : montrer l'affaire, c'est avoir vu ses nouvelles (devis signe, collegue). */
      if (window.BdvAffairesJour && BdvAffairesJour.vuAffaire) BdvAffairesJour.vuAffaire(a.affaire_id);
      peindreTete(a);
      corps.innerHTML = htmlEditeur(a);
      lireDevis(a);
      if (clientDe(a)) chargerClient(a, function () { repeindreClient(a); });
    }
    var ag = el('amodAgrandir');
    if (ag) { ag.hidden = !S.ouverte || !!S.nouvelle; if (S.ouverte) ag.href = '/mon-bureau/#affaire=' + encodeURIComponent(S.ouverte); }
    if (neuf) {
      /* M7 : le bouton d'ou l'on vient a deja ete repeint par `rendre()` quand on arrive
         ici. On garde donc AUSSI ce qu'il designait (`S.retour`, pose au clic), pour
         retrouver a la fermeture le bouton VIVANT qui le porte. */
      MOD_RETOUR = document.activeElement;
      MOD.hidden = false;
    }
    var enTiroir = false;
    /* M6 : on passe au tiroir la facon de fermer ce panneau. Si une AUTRE boite s'ouvre
       par-dessus (la fiche d'un client depuis Ma journee, une tache), le module la ferme
       d'abord : deux boites ouvertes, c'est un contrat ARIA faux des que l'une se ferme. */
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
  function viderAvisPanneau() {
    var av = el('amodAvis');
    if (av) { av.hidden = true; av.innerHTML = ''; av.classList.remove('aff-avis--souci'); }
  }
  /* LE BOUTON VIVANT QUI REND LE FOCUS, M7 (01/10/2026). `MOD_RETOUR` etait lu APRES la
     repeinte : il designait un noeud detache, et le focus tombait sur <body> a chaque
     fermeture (croix, Echap, apres creation, apres enregistrement). On cherche donc, dans
     l'ordre : le noeud d'origine s'il vit encore et se voit ; le bouton « ouvrir » de la
     ligne de l'affaire (liste ou kanban) ; « Nouvelle affaire » ; le titre de la piece. */
  function vivant(n) { return !!(n && n.isConnected && !n.closest('[hidden]') && typeof n.focus === 'function'); }
  function boutonRetour(r, d) {
    d = d || {};
    if (d.affaire) {
      var b = document.querySelector('#affCorps [data-affaire="' + d.affaire + '"] [data-aff="ouvrir"]');
      if (vivant(b)) return b;
    }
    if (vivant(r) && r !== document.body && !(MOD && MOD.contains(r))) return r;
    var n = document.querySelector('#affCorps [data-aff="nouvelle"]');
    if (vivant(n)) return n;
    var t = el('affTitre');
    if (t && !t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    return vivant(t) ? t : null;
  }
  function fermerPanneau(silence) {
    var etait = S.ouverte || S.nouvelle;
    S.ouverte = null; S.nouvelle = false; S.choix = null; S.clientPropose = null;
    if (MOD && !MOD.hidden) {
      MOD.hidden = true;
      MOD_CLE = '';
      viderAvisPanneau();
      if (window.BdvTiroir) window.BdvTiroir.retirer();   // le retrait de l'atelier s'en va avec le tiroir
      else document.body.style.overflow = '';
      var retour = { r: MOD_RETOUR, d: S.retour }; MOD_RETOUR = null; S.retour = null;
    }
    if (!silence && etait) { viderAttente(); rendre(); }
    /* Le focus se rend APRES la repeinte : rendu avant, il partait avec la ligne remplacee. */
    if (retour) { var n = boutonRetour(retour.r, retour.d); if (n) { try { n.focus(); } catch (x) {} } }
  }
  /* L'EN-TETE DU PANNEAU D'UNE AFFAIRE, peint seul quand un geste ne change que lui
     (« Je le rappelle demain ») : le formulaire en dessous garde ce qui est tape. */
  function peindreTete(a) {
    var tete = el('amodTete');
    if (!tete || !a) return;
    var e = etat(a), t = typeDe(a.type_id), et = etapeDe(a.etape_id);
    if (e.oppose) {
      tete.innerHTML = '<p class="amod__marques"><span class="aff-marque aff-marque--opposee">' + MARQUE_OPP + '</span></p>'
        + '<h2 class="tmod__titre" id="amodTitre">' + esc(sujet(a)) + '</h2>'
        + '<p class="amod__etat amod__etat--opposee"><b>' + esc(sujet(a)) + ' a demandé à ne plus être contacté.</b> Ne le rappelle pas, ne lui envoie rien.</p>';
      return;
    }
    tete.innerHTML = '<p class="amod__marques"><span class="tmod__tampon"' + (e.retard > 0 ? ' data-ton="retard"' : '') + '>'
      + esc(et ? et.nom : 'étape') + '</span>'
      + (estNouveau(a) ? ' ' + marqueNouveau() : '') + '</p>'
      + '<h2 class="tmod__titre" id="amodTitre">' + esc(sujet(a)) + '</h2>'
      + '<p class="tmod__sous">' + [a.titre && a.titre !== sujet(a) ? esc(a.titre) : '', t ? esc(t.nom) : '']
        .filter(Boolean).join(' · ') + '</p>'
      /* « Voir sa fiche » sous le nom, en lien : seul sur sa ligne il prenait 60 px. */
      + (clientDe(a) ? '<p class="amod__fiche"><button type="button" class="aff-vers" data-aff="voirFiche">Voir sa fiche</button></p>' : '')
      + '<p class="amod__etat">' + ligneEtape(a, e) + '<br>' + ligneRappel(a, e)
      + (devisDe(a) ? '<br>' + ligneDevis(a, false) : '') + '</p>'
      + htmlVentes(motifDe(a))
      /* Y1 (tour 4) : UN SEUL ORDRE des gestes dans tous les etats de l'affaire (en cours, en
         retard, reportee) : Appeler, Ecrire, puis « Nouveau devis » sur sa propre ligne et d'un
         autre dessin, puis la rangee de report sous « Je le rappelle : ». Les contacts vivent ICI,
         plus dans le formulaire : un report qui repeint la tete ne les deplace plus.
         X11 : le raccourci n'est montre que SOUS 700 px (bdv-bureau.css) ; au-dessus, le
         « Nouveau devis » du bas du panneau est deja dans l'ecran. Le meme geste. */
      + htmlContacts(a)
      /* LE CLIENT EN DIRECT (03/10/2026) : son numero et son adresse LUS dans ses ventes,
         « Ecrire » par le redacteur de sa fiche. */
      + (clientDe(a) ? '<p class="amod__contacts">' + htmlContactsClient(a) + '</p>' : '')
      + (a.issue === 'en_cours' ? '<p class="amod__raccourci"><button type="button" class="btn" data-aff="devisRaccourci">Nouveau devis</button></p>' : '')
      + htmlReport(a, e)
      + (clientDe(a) ? htmlNoter(a) + '<details class="aff-plus amod__hist" data-bloc="hist"><summary>Son historique</summary><div class="aff-plus__corps">'
        + htmlHistorique(a, 5) + '</div></details>' : '');
  }
  /* V6 (01/10/2026), demande du vigneron : « repousser une relance d'un pouce au chai ».
     Sous la boite d'etat d'une affaire A RELANCER (rappel passe ou du jour, ou endormie),
     trois gestes : Demain, Dans 7 jours, Autre date. Les deux premiers ECRIVENT le rappel
     tout de suite (c'est le geste demande, un appui) et le disent ; « Autre date » mene
     au champ de date du formulaire. Meme regle que la modale d'une tache : on ne propose
     de repousser que ce qui presse. Le motif du rappel est garde. */
  /* Y1 : Appeler puis Ecrire, en tete du panneau, dans tous les etats. */
  function htmlContacts(a) {
    var p = a && a.piste_id ? (S.pistes[a.piste_id] || {}) : null, l = '';
    if (p && p.telephone) l += '<a class="btn" href="tel:' + esc(String(p.telephone).replace(/[^\d+]/g, '')) + '">Appeler le ' + esc(p.telephone) + '</a>';
    if (p && p.email) l += '<a class="btn" href="mailto:' + esc(p.email) + '">Écrire à ' + esc(p.email) + '</a>';
    return l ? '<p class="amod__contacts">' + l + '</p>' : '';
  }
  function htmlReport(a, e) {
    if (!a || a.issue !== 'en_cours' || !e.aRelancer) return '';
    /* W6 (tour 2) : le libelle au-dessus, les trois boutons sur une ligne.
       T6 (tour 3) : « Autre date » n'ouvre PLUS un deuxieme champ de date : deux champs pour un
       meme rappel, l'un ici et l'autre 250 px plus bas, ne disaient pas lequel compte. Il mene
       au SEUL champ, « Je le rappelle le » du formulaire, l'amene sous les yeux, y pose le
       focus et ouvre le calendrier quand le navigateur le permet. */
    /* X10 (tour 3) : au chai on appelle D'ABORD, on repousse ensuite. Le numero passe donc
       avant les boutons de report (et quitte le formulaire, pour n'etre qu'a un endroit). */
    return '<div class="amod__report" role="group" aria-labelledby="amodReportT">'
      + '<p class="amod__report-t" id="amodReportT">Je le rappelle :</p>'
      + '<div class="amod__report-b">'
      + '<button type="button" class="btn" data-aff="reporter" data-jours="1">Demain</button>'
      + '<button type="button" class="btn" data-aff="reporter" data-jours="7">Dans 7 jours</button>'
      + '<button type="button" class="btn" data-aff="reporterDate" aria-controls="affEditRappel">Autre date</button></div></div>';
  }

  function htmlDemarrage() {
    return '<div class="aff-depart"><p class="aff-depart__t">Par quoi tu commences ?</p>'
      + '<p class="aff-aide">Coche les affaires que tu mènes. Tu pourras renommer chaque étape, en ajouter ou en retirer ensuite, dans Mes réglages, onglet « Mes affaires ».</p>'
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
    return '<p class="aff-endevis">En devis envoyé : <b>' + esc(eurosHT(t)) + '</b>, sur '
      + pluriel(l.length, 'affaire', 'affaires') + (x ? ' (dont ' + x + (x > 1 ? ' expirés' : ' expiré') + ', à relancer ou refaire)' : '') + '.</p>';
  }
  /* LA LIGNE « AUJOURD'HUI », 02/10/2026 (conseil : vigneron + expert commercial). Elle
     remplace la phrase « Ce que tu fais pour gagner un client », qui ne demandait rien. A
     un seul on nomme, a plusieurs on compte et on nomme le premier (le plus en retard,
     l'ordre du bloc « A relancer »). Le montant vient de `htmlEnDevis()` : devis ENVOYES
     seulement, jamais un total prevu. Rien a relancer et rien en devis : pas de ligne. */
  function htmlEtat() {
    var r = relancerTries();
    var rel = '';
    if (r.length) {
      var a = r[0], qui = '<button type="button" class="aff-etat__qui" data-aff="ouvrir" data-id="' + a.affaire_id + '"'
        + ' aria-haspopup="dialog" aria-controls="affaireModale">' + esc(sujet(a)) + '</button>';
      var quoi = a.rappel_titre ? ' (' + esc(a.rappel_titre) + ')' : '';
      rel = '<p class="aff-etat__t"><b>Aujourd’hui :</b> '
        + (r.length === 1 ? 'rappelle ' + qui + quoi : r.length + ' affaires à relancer, à commencer par ' + qui + quoi) + '.</p>';
    }
    var dv = htmlEnDevis();
    if (!rel && !dv) return '';
    return '<div class="aff-etat' + (rel ? ' aff-etat--presse' : '') + '">' + rel + dv + '</div>';
  }
  function relancerTries() {
    return visibles().filter(function (a) { return etat(a).aRelancer; })
      .sort(function (a, b) {
        var ra = etat(a).retard, rb = etat(b).retard;
        return (rb == null ? -1 : rb) - (ra == null ? -1 : ra);
      });
  }
  function htmlTete() {
    var ec = enCours();
    /* REFONTE DU 02/10/2026 (Ted : « revoir les boutons »). La bascule Liste / Kanban n'est
       plus une pastille : on la prenait pour un troisieme filtre. C'est un interrupteur a deux
       cases, a droite, contre « Nouvelle affaire ». */
    var vues = '<div class="aff-vues" role="group" aria-label="Disposition">'
      + [['liste', 'Liste'], ['kanban', 'Kanban']].map(function (v) {
        return '<button type="button" class="aff-vue" data-aff="vue" data-vue="' + v[0] + '" aria-pressed="'
          + (S.vue === v[0] ? 'true' : 'false') + '">' + v[1] + '</button>';
      }).join('') + '</div>';
    /* LE TYPE D'AFFAIRE SE CHOISIT DANS UNE LISTE, A TOUTES LES LARGEURS, 03/10/2026.
       Demande de Ted : « une deroulante du meme design que le reste du site pour choisir le
       pipe de vente a travailler ». Les pastilles sont parties : a six types elles passaient
       sur deux lignes, et un type a zero prenait autant de place qu'un type qui travaille.
       Libelle « Type d'affaire » (avis du vigneron : « pipe » ne se dit pas au chai, et
       « Mes types d'affaires » est deja le mot des reglages). Dessin : celui du selecteur de
       periode de l'en-tete (section 31 octies). Les types a zero restent : c'est la qu'on en
       choisit un pour y creer une affaire. */
    var liste = '<label class="aff-typeliste"><span class="aff-typeliste__l">Type d’affaire</span>'
      + '<span class="aff-typeliste__boite"><select data-aff-filtre>'
      + '<option value=""' + (S.filtre === '' ? ' selected' : '') + '>Toutes, ' + ec.length + ' en cours</option>'
      + typesActifs().map(function (t) {
        var n = ec.filter(function (a) { return a.type_id === t.type_id; }).length;
        return '<option value="' + t.type_id + '"' + (S.filtre === t.type_id ? ' selected' : '') + '>' + esc(t.nom) + ', ' + n + ' en cours</option>';
      }).join('') + '</select></span></label>';
    /* Un seul type : « Toutes » et ce type disent la meme chose, le filtre se cache (CSS). */
    var unSeul = typesActifs().length < 2;
    return '<div class="aff-tete' + (unSeul ? ' aff-tete--un' : '') + '">' + liste
      + '<div class="aff-tete__d">' + vues
      + '<button type="button" class="btn btn--bordeaux" data-aff="nouvelle"'
      + ' aria-haspopup="dialog" aria-controls="affaireModale">Nouvelle affaire</button></div></div>';
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
      /* V5 (01/10/2026), demande du vigneron : « pour un prospect au salon, le telephone
         est LA chose a noter ». Le contact se note EN CLAIR, l'adresse (qui ne sert qu'au
         devis) se replie, avec une fleche. Le repli s'ouvre tout seul quand l'annuaire l'a
         rempli : on ne cache pas ce qui vient d'etre pose. */
      + '<div class="aff-duo">' + champ('affTel', 'Téléphone', 'tel', 40, ' inputmode="tel" autocomplete="tel"')
        + champ('affEmail', 'Mail', 'email', 200, ' autocomplete="email"') + '</div>'
      /* W13 (tour 2) : contact et fonction cote a cote meme a 390 px (deux champs courts). */
      + '<div class="aff-duo aff-duo--serre">' + champ('affContact', 'Ton contact', 'text', 120, ' autocomplete="name"') + champ('affFonction', 'Sa fonction', 'text', 80) + '</div>'
      + '<details class="aff-plus aff-plus--adresse" id="affAdresseRepli"><summary>Son adresse et son SIRET (pour le devis)</summary><div class="aff-plus__corps">'
      + '<div class="aff-duo">' + champ('affSiret', 'SIRET (facultatif)', 'text', 17, ' inputmode="numeric" pattern="[0-9 .]*"') + champ('affAdresse', 'Adresse', 'text', 200, ' autocomplete="street-address"') + '</div>'
      + '<div class="aff-duo">' + champ('affCp', 'Code postal', 'text', 12, ' inputmode="numeric" autocomplete="postal-code"') + champ('affVille', 'Ville', 'text', 80, ' autocomplete="address-level2"') + '</div>'
      + champ('affSource', 'D’où il vient (salon, bouche à oreille…)', 'text', 120)
      + '</div></details>'
      + '<p class="aff-aide">C’est une fiche professionnelle : n’y note rien de personnel.</p></div>'
      /* L'AFFAIRE */
      + '<div class="aff-affaire">'
      + '<div class="aff-duo"><label class="aff-champ"><span>Type d’affaire</span><select id="affType"></select></label>'
      + '<label class="aff-champ"><span>Je le rappelle le</span><input id="affRappel" type="date" value="' + jourIso(dans7) + '" required></label></div>'
      /* W13 et V5 : les deux champs facultatifs se replient sous « Ajouter un detail », pour
         que « Creer l'affaire » remonte dans le premier ecran a 390 px. */
      + '<details class="aff-plus aff-plus--detail" id="affDetailRepli"><summary>Ajouter un détail (facultatif)</summary><div class="aff-plus__corps">'
      + '<label class="aff-champ"><span>L’affaire</span>'
      + '<input id="affIntitule" type="text" maxlength="120" autocomplete="off" placeholder="Le rosé, le mariage de juin, la carte des vins…"></label>'
      + '<label class="aff-champ"><span>Pour quoi faire</span>'
      + '<input id="affMotifRappel" type="text" maxlength="120" placeholder="Envoyer le tarif, passer déposer deux bouteilles…"></label></div></details></div>'
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
      /* V18 : « Pas encore dans Vitisoft », pas « Nouveau client », qui se lisait a cote de
         « Deja dans ta base » comme une contradiction. */
      + (c.genre === 'piste' ? ' ' + marqueNouveau() : (c.num ? ' <span class="aff-choisi__d">n° ' + esc(c.num) + '</span>' : ''))
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
      .filter(function (p) { return !p.client_id; })
      /* N3 (tour 2) : une personne en opposition RESTE dans la recherche, marquee, et ne se
         prend pas : sinon on la recreait en deux clics, telephone compris. */
      .map(function (p) { return { genre: 'piste', id: p.piste_id, nom: p.nom, ville: p.ville || '', num: '',
        siret: p.siret || '', oppose: !!p.opposition, cle: norm(p.nom + ' ' + (p.ville || '')) }; });
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
  /* T9 (tour 3) : LE NOM QUE L'ANNUAIRE DONNE N'EST PAS CELUI QU'ON ECRIT SUR UN DEVIS.
     « CAVE DU QUAI (CAVE DU QUAI - LE COMPTOIR NANTAIS) » allait tel quel sur le devis, sur
     /signer/ et dans la fiche que Vitisoft creera. On propose donc le nom SANS la parenthese
     d'enseignes et, s'il est tout en capitales, en casse de titre (« Cave du Quai ») ; les
     sigles de forme juridique restent en capitales (EARL, SCEA, SAS...). Le champ reste a
     corriger avant de creer ; la reconnaissance des noms proches compare le coeur du nom,
     elle ne voit pas la difference. */
  var PETITS_MOTS = ['de', 'du', 'des', 'la', 'le', 'les', 'et', 'au', 'aux', 'en', 'sur', 'sous', 'a', 'l', 'd'];
  function nomPropose(nom) {
    var x = String(nom || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim();
    if (!x) x = String(nom || '').trim();
    if (/[a-zà-ÿ]/.test(x)) return x;
    /* Le premier mot du nom (apres un sigle) garde sa majuscule s'il est un article :
       « La Cave de Clisson », « SCEA Les Terres » ; « EARL du Clos » garde son « du ». */
    var debut = true, rang = 0;
    return x.replace(/[^\s'’-]+/g, function (m) {
      var bas = m.toLowerCase(), k = norm(m), premier = debut, tete = rang++ === 0;
      if (FORMES_J.indexOf(k) >= 0 && k !== 'societe' && k !== 'ste') return m;
      debut = false;
      if (!tete && PETITS_MOTS.indexOf(k) >= 0 && !(premier && ['la', 'le', 'les', 'l', 'au', 'aux', 'a'].indexOf(k) >= 0)) return bas;
      return bas.charAt(0).toUpperCase() + bas.slice(1);
    });
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
  function motOppose(c) {
    return '« ' + esc(c.nom) + ' » a demandé à ne plus être contacté : on ne le recrée pas et on ne le rappelle pas.';
  }
  function htmlTrouve(c, geste) {
    var d = [c.num ? 'n° ' + c.num : '', c.ville].filter(Boolean).join(', ');
    if (c.oppose) return '<li class="aff-trouve aff-trouve--opposee"><span class="aff-trouve__nom">' + esc(c.nom) + '</span>'
      + ' <span class="aff-marque aff-marque--opposee">' + MARQUE_OPP + '</span>'
      + (d ? '<span class="aff-trouve__d">' + esc(d) + '</span>' : '') + '</li>';
    return '<li><button type="button" class="aff-trouve" data-aff="' + geste + '" data-genre="' + c.genre + '" data-id="' + esc(c.id) + '">'
      + '<span class="aff-trouve__nom">' + esc(c.nom) + '</span>'
      + (c.genre === 'piste' ? ' ' + marqueNouveau() : '')
      + (d ? '<span class="aff-trouve__d">' + esc(d) + '</span>' : '') + '</button></li>';
  }
  /* LES CLIENTS VITISOFT N'EXISTENT ICI QUE SI LE MOTEUR EST LA, M1 (01/10/2026).
     « A gagner » s'ouvre SANS le moteur des ventes : `ROWS` et `assurerLignes` vivent dans
     bdv-ecrans.js. Le garde `typeof assurerLignes` etait donc faux, rien n'etait demande,
     et la barre disait « Aucun de tes clients ne correspond » sans avoir rien lu : « Cave du
     Vieux Pressoir », client de l'export, devenait un doublon cree a la main.
     Desormais, des que le vigneron ouvre la barre (une nouvelle affaire, « Changer le
     client »), on charge le moteur (`BdvNav.chargerEcrans()`, le meme chargement que
     « Clients a suivre ») PUIS les lignes. C'est un geste, pas l'ouverture de la piece :
     la liste des affaires, elle, ne le demande jamais.
     QUATRE ETATS, et seul « pret » permet de dire « aucun ne correspond » :
       null      rien demande encore ;
       attente   le moteur ou les lignes arrivent ;
       pret      les lignes de cet appareil sont lues (il peut n'y en avoir aucune) ;
       echec     la lecture a lache : on ne SAIT pas, et on le dit.
     Sans Vitisoft il n'y a pas de clients d'export : rien a attendre. Une page sans
     chargeur (un banc, une page autonome) lit ce qu'elle a. */
  var LIGNES = { etat: null };
  function avecVitisoft() { return !(window.BdvNav && BdvNav.avecVitisoft && !BdvNav.avecVitisoft()); }
  function etatLignes() {
    if (lignes().length) return 'pret';
    if (!avecVitisoft()) return 'pret';
    if (typeof lignesPretes === 'function') { try { if (lignesPretes()) return 'pret'; } catch (e) {} }
    if (typeof assurerLignes !== 'function' && !(window.BdvNav && BdvNav.chargerEcrans)) return 'pret';
    return LIGNES.etat || 'attente';
  }
  function demanderLignes() {
    /* Un echec ne se relance pas a chaque touche : seulement par « Reessayer ». */
    if (etatLignes() === 'pret' || LIGNES.etat === 'attente' || LIGNES.etat === 'echec') return;
    LIGNES.etat = 'attente';
    var moteur = typeof assurerLignes === 'function' ? Promise.resolve() : BdvNav.chargerEcrans();
    Promise.resolve(moteur).then(function () {
      if (typeof assurerLignes !== 'function') throw new Error('moteur absent');
      return assurerLignes();
    }).then(function (ok) { LIGNES.etat = ok === false ? 'echec' : 'pret'; },
      function () { LIGNES.etat = 'echec'; })
      .then(function () {
        CACHE_CLI.n = -1;
        peindrePropositions(); rafraichirChangements(); signalerDoublon();
      });
  }
  function motSansClients() {
    demanderLignes();
    var e = etatLignes();
    if (e === 'attente') return 'Tes clients arrivent sur cet appareil… Je regarde aussi s’il est déjà dans ta base.';
    if (e === 'echec') return 'Tes clients Vitisoft n’ont pas pu être lus sur cet appareil : vérifie qu’il n’y est pas déjà avant de le créer. '
      + '<button type="button" class="aff-lien" data-aff="relireClients">Réessayer</button>';
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
    demanderLignes();
    var attend = etatLignes() !== 'pret';
    if (!v) { box.innerHTML = attend ? '<p class="aff-aide">' + motSansClients() + '</p>' : ''; demanderAnnuaire(''); return; }
    demanderAnnuaire(v);
    var l = chercherConnus(v);
    var h = '<p class="aff-propositions__t">Tes clients</p>'
      + (l.length ? '<ul class="aff-trouves">' + l.map(function (c) { return htmlTrouve(c, 'prendreClient'); }).join('') + '</ul>'
        + (attend ? '<p class="aff-aide">' + motSansClients() + '</p>' : '')
        : '<p class="aff-aide">' + motSansClients() + '</p>');
    if (norm(v).length >= 3 && window.BdvDomaine && BdvDomaine.chercher) {
      h += '<p class="aff-propositions__t">Dans l’annuaire officiel des entreprises</p>';
      if (ANNU.liste === null && !ANNU.mot) h += '<p class="aff-aide">Recherche dans l’annuaire…</p>';
      else if (ANNU.mot) h += '<p class="aff-aide">' + esc(ANNU.mot) + '</p>';
      else if (!ANNU.liste.length) h += '<p class="aff-aide">Rien trouvé dans l’annuaire.</p>';
      else h += '<ul class="aff-trouves">' + ANNU.liste.map(function (x, i) {
        var deja = parSiret(x.siret), meme = !deja && parNom(x.nom), opp = (deja && deja.oppose) || (meme && meme.oppose);
        if (opp) return '<li class="aff-trouve aff-trouve--opposee"><span class="aff-trouve__nom">' + esc(x.nom) + '</span>'
          + ' <span class="aff-marque aff-marque--opposee">' + MARQUE_OPP + '</span>'
          + '<span class="aff-trouve__d">' + esc([x.code_postal + ' ' + x.ville, 'SIRET ' + x.siret].join(', ')) + '</span></li>';
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
    if (c.oppose) { dire(motOppose(c), true); return; }
    viderAvisPanneau();
    S.choix.client = c; S.choix.nouveau = false; S.choix.completer = null; S.choix.confirme = null;
    peindreChoix();
    var dr = el('affDetailRepli'); if (dr) dr.open = true;
    var tt = el('affIntitule'); if (tt) tt.focus();
  }
  function ouvrirFiche(remplir) {
    S.choix.client = null; S.choix.nouveau = true; S.choix.confirme = null;
    viderAvisPanneau();
    /* C2 (01/10/2026) : `maxlength` ne coupe pas une valeur posee par script. Un nom
       d'annuaire de 121 signes faisait refuser la creation par la base (`pistes_nom`),
       avec le message generique. On coupe a la pose, a la longueur du champ. */
    function poser(id, v) {
      var n = el(id); if (!n) return;
      var x = String(v || ''), m = n.maxLength > 0 ? n.maxLength : 0;
      n.value = m && x.length > m ? x.slice(0, m).trim() : x;
    }
    ['affNom', 'affSiret', 'affAdresse', 'affCp', 'affVille'].forEach(function (id) { poser(id, ''); });
    Object.keys(remplir || {}).forEach(function (id) { poser(id, remplir[id]); });
    var repli = el('affAdresseRepli');
    if (repli) repli.open = ['affSiret', 'affAdresse', 'affCp', 'affVille'].some(function (id) { return !!(el(id) && el(id).value); });
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
    ouvrirFiche({ affNom: nomPropose(x.nom), affSiret: x.siret, affAdresse: x.adresse, affCp: x.code_postal, affVille: x.ville });
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
    ouvrirFiche({ affNom: nomPropose(x.nom), affSiret: x.siret, affAdresse: x.adresse, affCp: x.code_postal, affVille: x.ville });
    if (!x.actif) dire('Attention : l’annuaire dit que cette entreprise est fermée. Vérifie avant de créer.', true);
  }
  /* LA FICHE PREVIENT A LA FRAPPE : un SIRET deja connu (et la creation sera
     refusee), ou un nom deja porte (a verifier, les homonymes existent). Dans les
     deux cas on propose de prendre le client existant, en un geste. */
  function signalerDoublon() {
    var d = el('affDoublon'), nom = el('affNom'), sir = el('affSiret');
    if (!d || !nom) return;
    var s2 = chiffresDe(sir && sir.value);
    /* La fiche deja creee par un premier essai (M2) n'est pas un doublon d'elle-meme. */
    var soi = S.choix && S.choix.pisteCreee;
    var parS = parSiret(s2), parN = !parS && parNom(nom.value);
    if (parS && parS.id === soi) parS = null;
    if (parN && parN.id === soi) parN = null;
    var c = parS || parN;
    d.hidden = !c;
    d.classList.toggle('aff-doublon--bloque', !!parS || !!(c && c.oppose));
    if (c && c.oppose) { d.innerHTML = '<b>' + motOppose(c) + '</b>'; return; }
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
  /* `plus` porte les attributs d'un champ qui en a besoin : `inputmode` pour le clavier
     a chiffres du telephone (S9), `autocomplete` pour ce que le navigateur sait remplir. */
  function champ(id, libelle, type, max, plus) {
    return '<label class="aff-champ"><span>' + libelle + '</span><input id="' + id + '" type="' + type
      + '" maxlength="' + max + '"' + (/autocomplete=/.test(plus || '') ? '' : ' autocomplete="off"') + (plus || '') + '></label>';
  }
  function champNomme(nom, libelle, type, max, valeur, plus) {
    return '<label class="aff-champ"><span>' + libelle + '</span><input name="' + nom + '" type="' + type
      + '" maxlength="' + max + '" value="' + esc(valeur || '') + '"' + (/autocomplete=/.test(plus || '') ? '' : ' autocomplete="off"') + (plus || '') + '></label>';
  }

  function ligneRappel(a, e) {
    if (!a.rappel) return e && e.endormie
      ? '<b>Plus de nouvelles depuis ' + pluriel(e.jours, 'jour', 'jours') + '</b><br>Pas de rappel prévu'
      : 'Pas de rappel prévu';
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
    var txt = (e.jours === 0 ? 'Arrivée aujourd’hui' : pluriel(e.jours, 'jour', 'jours')) + ' dans « ' + esc(et ? et.nom : 'étape') + ' »';
    /* W4 (tour 2) : UNE SEULE DUREE. « Endormie depuis 20 jours : 50 jours dans ... » en
       portait deux, et on ne savait pas laquelle comptait. */
    if (e.endormie) return 'Dans « ' + esc(et ? et.nom : 'étape') + ' »';
    if (e.retard == null) {
      var reste = e.sommeil - e.jours;
      return txt + ' : sans rappel, à relancer dans ' + pluriel(reste, 'jour', 'jours');
    }
    return txt;
  }

  /* LA LIGNE, REDESSINEE AU LOT 40. Le nom ouvre le panneau (toute la ligne est
     cliquable, par le calque du bouton), l'etape est une etiquette, le rappel dit
     en mots ce qui presse. « Etape suivante » reste a portee de pouce. */
  /* SOUS L'ETIQUETTE D'ETAPE, LA DUREE SEULE : redire le nom de l'etape juste sous
     l'etiquette qui le porte faisait lire deux fois la meme chose. */
  function ligneDuree(a, e) {
    /* 02/10/2026 : « Depuis aujourd'hui » cotoyait « En retard de 3 jours » et semblait le
       contredire. On dit ce qu'on compte : le temps passe a CETTE etape. Endormie, la duree
       est dans la colonne du rappel (« Plus de nouvelles depuis... »), pas deux fois. */
    var depuis = e.jours === 0 ? 'Arrivée aujourd’hui' : 'À cette étape depuis ' + pluriel(e.jours, 'jour', 'jours');
    if (e.endormie) return '';
    if (e.retard == null) return depuis + '. Sans rappel, à relancer dans ' + pluriel(e.sommeil - e.jours, 'jour', 'jours');
    return depuis;
  }
  /* LE PREMIER GESTE D'UNE RANGEE SUIT L'ETAT DE L'AFFAIRE, 02/10/2026 (expert commercial :
     « une affaire ne passe pas a l'etape suivante parce qu'on clique, mais parce qu'on a
     parle au client »). En retard : Appeler, sinon Ecrire, sinon la reporter a demain. Sans
     nouvelles (endormie, donc sans rappel) : lui poser un rappel demain. Sinon, rien
     d'urgent. « Vers <etape> » reste a portee, en second, avec son delai d'annulation. */
  /* LES MEMES DONNEES DANS LES QUATRE VUES (vigneron, passe apres) : le numero d'un client
     Vitisoft n'est connu que quand le moteur des ventes est la, donc le geste changeait selon
     qu'on avait ouvert « Clients a suivre » avant. On ne lit que ce que la piece possede : la
     piste. Un client Vitisoft en retard mene a SA FICHE, qui porte son numero. */
  function contactDe(a) {
    var p = a.piste_id && S.pistes[a.piste_id];
    return p ? { tel: p.telephone ? String(p.telephone).replace(/[^\d+]/g, '') : '', mail: p.email || '' } : { tel: '', mail: '' };
  }
  function gesteUrgent(a, e, qui) {
    if (!e.aRelancer) return '';
    if (e.endormie) return '<button type="button" class="btn" data-aff="reporter" data-jours="1"'
      + ' aria-label="Rappeler « ' + esc(qui) + ' » demain">Le rappeler demain</button>';
    var c = contactDe(a);
    if (c.tel) return '<a class="btn" href="tel:' + esc(c.tel) + '" aria-label="Appeler « ' + esc(qui) + ' »">Appeler</a>';
    if (c.mail) return '<a class="btn" href="mailto:' + esc(c.mail) + '" aria-label="Écrire à « ' + esc(qui) + ' »">Écrire</a>';
    if (clientDe(a)) return '<button type="button" class="btn" data-aff="voirFiche"'
      + ' aria-label="Ouvrir la fiche de « ' + esc(qui) + ' » pour l’appeler">Voir sa fiche</button>';
    return '<button type="button" class="btn" data-aff="reporter" data-jours="1"'
      + ' aria-label="Reporter le rappel de « ' + esc(qui) + ' » à demain">Reporter à demain</button>';
  }
  function gesteVers(a, suite, qui, plein) {
    if (!suite) return '<span class="aff-ligne__fin">Dernière étape</span>';
    return '<button type="button" class="' + (plein ? 'btn' : 'aff-vers') + '" data-aff="suivante"'
      + ' aria-label="Passer « ' + esc(qui) + ' » à l’étape suivante, « ' + esc(suite.nom) + ' »">Vers ' + esc(suite.nom) + '</button>';
  }
  function marqueNouveau() {
    return '<span class="aff-marque aff-marque--nouveau">Nouveau client<span class="hors-ecran">, pas encore dans Vitisoft</span></span>';
  }
  function htmlAffaire(a, avecType) {
    var e = etat(a);
    var suite = etapeSuivante(a);
    var ouverte = S.ouverte === a.affaire_id;
    var t = typeDe(a.type_id), et = etapeDe(a.etape_id);
    var qui = sujet(a);
    if (e.oppose) return htmlAffaireOpposee(a, avecType);
    return '<li class="aff-ligne' + (e.endormie ? ' aff-ligne--dort' : '') + (e.retard > 0 ? ' aff-ligne--retard' : '')
      + (ouverte ? ' aff-ligne--ouverte' : '') + '" data-affaire="' + a.affaire_id + '">'
      + '<div class="aff-ligne__corps">'
      + '<p class="aff-ligne__t"><button type="button" class="aff-ligne__qui" data-aff="ouvrir"'
      + ' aria-haspopup="dialog" aria-controls="affaireModale" aria-expanded="' + (ouverte ? 'true' : 'false') + '">' + esc(qui) + '</button>'
      + (estNouveau(a) ? ' ' + marqueNouveau() : '')
      + (motifDe(a) ? ' ' + htmlMotif(motifDe(a)) : '') + '</p>'
      + (a.titre && a.titre !== qui ? '<p class="aff-ligne__titre">' + esc(a.titre) + '</p>' : '')
      + (devisDe(a) ? '<p class="aff-ligne__s aff-ligne__devis">' + ligneDevis(a, false) + '</p>' : '')
      + '</div>'
      + '<p class="aff-ligne__etape"><span class="aff-pastille">' + esc(et ? et.nom : 'étape') + '</span>'
      + '<span class="aff-ligne__s">' + [avecType && !S.filtre && t && typesActifs().length > 1 ? esc(t.nom) : '', ligneDuree(a, e)].filter(Boolean).join(' · ') + '</span></p>'
      + '<p class="aff-ligne__rappel aff-ligne__s">' + ligneRappel(a, e) + '</p>'
      + '<div class="aff-ligne__gestes">' + gesteUrgent(a, e, qui) + gesteVers(a, suite, qui, false)
      + '</div></li>';
  }

  /* La ligne d'une affaire en opposition : la marque A LA PLACE de la duree et du rappel,
     et aucun geste. Le nom ouvre le panneau, qui ne propose que de la classer. */
  function htmlAffaireOpposee(a, avecType) {
    var t = typeDe(a.type_id), et = etapeDe(a.etape_id), qui = sujet(a), ouverte = S.ouverte === a.affaire_id;
    return '<li class="aff-ligne aff-ligne--opposee' + (ouverte ? ' aff-ligne--ouverte' : '') + '" data-affaire="' + a.affaire_id + '">'
      + '<div class="aff-ligne__corps">'
      + '<p class="aff-ligne__t"><button type="button" class="aff-ligne__qui" data-aff="ouvrir"'
      + ' aria-haspopup="dialog" aria-controls="affaireModale" aria-expanded="' + (ouverte ? 'true' : 'false') + '">' + esc(qui) + '</button></p>'
      + (a.titre && a.titre !== qui ? '<p class="aff-ligne__titre">' + esc(a.titre) + '</p>' : '')
      + '</div>'
      + '<p class="aff-ligne__etape"><span class="aff-pastille">' + esc(et ? et.nom : 'étape') + '</span>'
      + (avecType && !S.filtre && t ? '<span class="aff-ligne__s">' + esc(t.nom) + '</span>' : '') + '</p>'
      + '<p class="aff-ligne__rappel aff-ligne__s"><span class="aff-marque aff-marque--opposee">' + MARQUE_OPP + '</span></p>'
      + '<div class="aff-ligne__gestes"></div></li>';
  }
  /* LE PANNEAU D'UNE AFFAIRE EN OPPOSITION : les notes a lire, et un seul geste. Ni etape,
     ni rappel, ni « Pour quoi faire », ni devis (« ne lui envoie rien »). Les devis deja
     faits restent dans la base et se relisent une fois l'affaire classee. */
  function htmlEditeurOppose(a) {
    return '<form class="aff-edit aff-edit--opposee" data-edit="' + a.affaire_id + '" novalidate>'
      + (a.notes ? '<div class="aff-champ"><span>Notes</span><p class="aff-notes-lues">' + esc(a.notes) + '</p></div>' : '')
      + '<div class="aff-conclure"><button type="button" class="btn btn--bordeaux" data-aff="classerOppose">Classer l’affaire : Pas pour cette fois</button></div>'
      + '</form>';
  }
  function htmlEditeur(a) {
    if (oppose(a)) return htmlEditeurOppose(a);
    var p = a.piste_id ? (S.pistes[a.piste_id] || {}) : null;
    var etapes = etapesDe(a.type_id).map(function (x) {
      return '<option value="' + x.etape_id + '"' + (x.etape_id === a.etape_id ? ' selected' : '') + '>' + esc(x.nom) + '</option>';
    }).join('');
    var liens = '';

    var motifs = MOTIFS.map(function (m) { return '<option value="' + m[0] + '">' + m[1] + '</option>'; }).join('');
    return '<form class="aff-edit" data-edit="' + a.affaire_id + '" novalidate>'
      + (liens ? '<div class="aff-edit__liens">' + liens + '</div>' : '')
      + '<div class="aff-duo"><label class="aff-champ"><span>Étape</span><select name="etape">' + etapes + '</select></label>'
      + '<label class="aff-champ"><span>Rappel prévu le</span><input name="rappel" id="affEditRappel" type="date" value="' + esc(a.rappel || '') + '"></label></div>'
      + '<label class="aff-champ"><span>Pour quoi faire</span><input name="rappel_titre" type="text" maxlength="120" value="' + esc(a.rappel_titre || '') + '"></label>'
      + '<label class="aff-champ"><span>Titre de l’affaire</span><input name="titre" type="text" maxlength="120" value="' + esc(a.titre || '') + '"></label>'
      + '<label class="aff-champ aff-champ--notes"><span>Notes</span><textarea name="notes" rows="3" maxlength="2000">' + esc(a.notes || '') + '</textarea></label>'
      + htmlChanger(a)
      + (p ? '<details class="aff-plus"><summary>Pas encore dans Vitisoft : ' + esc(p.nom || '') + '</summary><div class="aff-plus__corps">'
        + champNomme('p_nom', 'Le nom de l’établissement', 'text', 120, p.nom)
        /* B3 (01/10/2026) : une personne qui a demande a ne plus etre contactee n'a plus de
           coordonnees, et l'ecran ne propose plus de les ressaisir. La base les efface a
           l'opposition ; un champ vide qu'on remplit les ferait revenir. */
        + (p.opposition
          ? '<p class="aff-aide aff-opposee">Cette personne a demandé à ne plus être contactée : ses coordonnées sont effacées et ne se ressaisissent pas.</p>'
          : ('siret' in p ? champNomme('p_siret', 'SIRET', 'text', 17, p.siret, ' inputmode="numeric"') + champNomme('p_adresse', 'Adresse', 'text', 200, p.adresse) : '')
            + champNomme('p_contact_nom', 'Le nom de ton contact', 'text', 120, p.contact_nom)
            + champNomme('p_contact_fonction', 'Sa fonction', 'text', 80, p.contact_fonction)
            + champNomme('p_telephone', 'Téléphone', 'tel', 40, p.telephone)
            + champNomme('p_email', 'Mail', 'email', 200, p.email)
            + champNomme('p_ville', 'Ville', 'text', 80, p.ville)
            + champNomme('p_code_postal', 'Code postal', 'text', 12, p.code_postal, ' inputmode="numeric" autocomplete="postal-code"')
            + champNomme('p_source', 'D’où il vient', 'text', 120, p.source)
            + '<p class="aff-aide">Si cette personne te demande de ne plus la contacter, ses coordonnées s’effacent et son nom reste, pour que personne ne la rappelle.</p>'
            + '<p><button type="button" class="btn" data-aff="opposition">Ne plus la contacter</button></p>')
        + '</div></details>' : '')
      + '<div class="aff-form__pied"><button type="submit" class="btn btn--bordeaux">Enregistrer</button>'
      + '<p class="aff-aide aff-form__pied-mot" hidden></p></div>'
      + htmlDevis(a)
      /* W1 (tour 2) : UN SEUL BOUTON PLEIN. Le choix se voit enfonce (aria-pressed, une
         coche) ; tant qu'il attend sa confirmation, « Enregistrer » passe en retrait et dit
         quoi terminer, comme le pied du devis. */
      + '<div class="aff-conclure">'
      + '<button type="button" class="btn aff-conclure__choix" data-aff="gagnee" aria-pressed="false">Gagnée</button>'
      + '<button type="button" class="btn aff-conclure__choix" data-aff="perdue" aria-pressed="false">Pas pour cette fois</button>'
      + '<div class="aff-conclure__confirme" data-confirme="gagnee" hidden>'
      + '<p class="aff-aide">Tu confirmes que l’affaire est gagnée ? Elle quitte ta liste en cours.</p>'
      + '<button type="button" class="btn btn--bordeaux" data-aff="confirmerGagnee">Oui, gagnée</button>'
      + '<button type="button" class="btn" data-aff="conclureAnnuler">Annuler</button></div>'
      + '<div class="aff-conclure__confirme" data-confirme="perdue" hidden>'
      + '<label class="aff-champ"><span>Pourquoi ?</span><select name="motif">' + motifs + '</select></label>'
      + '<button type="button" class="btn btn--bordeaux" data-aff="confirmerPerdue">La classer</button>'
      + '<button type="button" class="btn" data-aff="conclureAnnuler">Annuler</button></div>'
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
    /* V3 (01/10/2026) : le devis existant passe AU-DESSUS de « Nouveau devis », en carte qui
       porte sa porte (« Ouvrir le devis D-... »), et son montant se dit en HT comme partout
       ailleurs dans le bureau. Un devis abandonne ou refuse reste en ligne courte. */
    return '<div class="aff-devis">'
      + '<ul class="aff-devis__liste" id="affDevisListe"' + (l ? '' : ' hidden') + '>' + l + '</ul>'
      + (ouverte ? '<button type="button" class="' + (devisCourt(a) ? 'aff-devis__lien' : 'btn') + '" data-aff="devis" aria-describedby="affDevisMot">Nouveau devis</button>' : '')
      + '<p class="aff-aide aff-devis__mot" id="affDevisMot" aria-live="polite"></p></div>';
  }
  /* LOT 67 (05/10/2026) : LE SUIVI DEPUIS L'AFFAIRE. UNE CARTE PAR DEVIS VIVANT (pas encore
     envoye, envoye, accepte), l'etat EN MOTS, UNE phrase qui dit le delai et le montant en jeu,
     et UN geste principal selon l'etat (decide par Ted, conseil vigneron + expert commercial) :
       pas encore envoye      -> « Préparer l'envoi » (le devis s'ouvre, l'envoi deja ouvert)
       envoye, valable        -> « Noter sa réponse » (arbitre par Ted : l'appel est en haut)
       envoye, expire         -> APPELER D'ABORD (arbitre par Ted), puis « Le remettre à date »
                                 (lot 65 : version N+1 datee du jour, l'ancien lien coupe, dit
                                 SOUS le bouton) ou « En faire un nouveau » si la base refuserait
       accepte, pas telecharge -> « Télécharger pour Vitisoft »
       accepte, telecharge    -> aucun geste, la phrase le dit.
     Les boutons de carte restent en contour : le seul bouton plein de la page est celui du
     moment, en haut. « Ouvrir le devis » reste en lien, « Voir la version 1 » pour une
     version 2 et plus. Abandonne ou refuse : ligne courte, le NUMERO seul barre, le mot et le
     motif lisibles. */
  function motifMot(c) { var m = MOTIFS.filter(function (x) { return x[0] === c; })[0]; return m ? String(m[1]).toLowerCase() : ''; }
  function devisVivant(d) { return d && (d.statut === 'enregistre' || d.statut === 'envoye' || d.statut === 'accepte'); }
  function versionD(d) { var v = Number(d && d.version); return v >= 1 ? v : null; }
  function telDe(a) {
    var c = cliDe(a), p = a && a.piste_id && S.pistes[a.piste_id];
    if (c && c.contacts && c.contacts.tel) return { tel: c.contacts.tel, vu: c.contacts.affiche || c.contacts.tel };
    if (!c && p && p.telephone) return { tel: String(p.telephone).replace(/[^\d+]/g, ''), vu: p.telephone };
    return null;
  }
  /* La base accepterait-elle « remettre a date » ? (lot 65 : colonne version presente,
     commande pas telechargee, pas signe puis annule ; l'ecran du devis reverifie.) */
  function remiseADatePossible(d) {
    return !!(d && 'version' in d && d.statut === 'envoye' && !(Number(d.commande_telechargements) > 0) && !d.accord_annule_le);
  }
  function suiviDevis(a, d) {
    var ouverte = a.issue === 'en_cours', j, r = { phrase: '', geste: null, appel: null, aide: '' };
    var ht = esc(eurosHT(d.total_ht_c)), v = versionD(d);
    /* Vigneron (lot 68) : une seule phrase pour la version ; l'ecart, s'il est connu, la remplace. */
    var ec = v > 1 ? ecartVersion(d) : '';
    var remplace = v > 1 ? (ec ? ' Version ' + v + ' :' + ec.replace(/^ /, ' ') : ' Version ' + v + ' du ' + esc(dateCourte(d.date_devis)) + ', elle remplace la version ' + (v - 1) + '.') : '';
    if (d.statut === 'enregistre') {
      r.marque = 'pas encore envoyé';
      r.phrase = 'Prêt depuis le ' + esc(dateCourte(jourLocal(d.cree_le) || d.date_devis)) + ', pas encore parti : ' + ht + '. Tant qu’il ne l’a pas reçu, ton client ne peut pas dire oui.';
      if (ouverte) r.geste = { action: 'envoi', mot: 'Préparer l’envoi' };
    } else if (d.statut === 'envoye' && expireD(d)) {
      j = joursDepuis(d.valable_jusqu);
      r.marque = 'expiré';
      r.phrase = 'Envoyé le ' + esc(dateCourte(d.envoye_le)) + ', expiré depuis ' + (j > 0 ? pluriel(j, 'jour', 'jours') : 'aujourd’hui') + ' (le ' + esc(dateCourte(d.valable_jusqu)) + ') : ' + ht + ' à reprendre.' + remplace;
      if (ouverte) {
        var t = telDe(a), redate = remiseADatePossible(d);
        var g = redate ? { action: 'corriger', mot: 'Le remettre à date' } : { action: 'refaire', mot: 'En faire un nouveau' };
        if (t) { r.appel = t; r.phrase += ' Appelle-le d’abord : « Je vous le prolonge tel quel, ou on ajuste quelque chose ? »'; }
        r.geste = g;
        r.aide = redate ? 'Il devient la version ' + ((v || 1) + 1) + ', datée d’aujourd’hui : l’ancien lien de signature ne marchera plus.'
          : 'Il reprend ses lignes sous un nouveau numéro, et celui-ci passe abandonné.';
      }
    } else if (d.statut === 'envoye') {
      j = joursDepuis(d.envoye_le);
      var reste = joursDepuis(d.valable_jusqu);
      r.marque = 'envoyé';
      /* « Envoyé le 6 oct.. » : la date abregee porte deja son point (vu par Ted, 06/10/2026). */
      r.phrase = finPoint('Envoyé le ' + esc(dateCourte(d.envoye_le)) + (j > 0 ? ', sans réponse depuis ' + pluriel(j, 'jour', 'jours') : '')) + ' '
        + (d.valable_jusqu ? 'Valable encore ' + pluriel(Math.max(0, -reste), 'jour', 'jours') + ', jusqu’au ' + esc(dateCourte(d.valable_jusqu)) + ' : ' : '') + ht + ' en jeu.' + remplace;
      if (ouverte) r.geste = { action: 'reponse', mot: 'Noter sa réponse' };
    } else {
      var quand = d.signe_le ? String(d.signe_le).slice(0, 10) : (d.accepte_le ? jourLocal(d.accepte_le) : null);
      r.marque = d.signe_le ? 'signé en ligne' : 'accepté';
      r.phrase = (d.signe_le ? 'Signé en ligne le ' : 'Accepté') + (d.signe_le ? esc(dateCourte(quand)) : quand ? ' le ' + esc(dateCourte(quand)) : '') + ' : ' + ht + ' gagnés.';
      if (d.commande_telechargee_le) r.phrase += ' Commande téléchargée le ' + esc(dateCourte(jourLocal(d.commande_telechargee_le))) + ' : si elle est dans Vitisoft, cette vente est faite.';
      else { r.phrase += ' Télécharge la commande pour la saisir dans Vitisoft.'; r.geste = { action: 'commande', mot: 'Télécharger pour Vitisoft' }; }
    }
    return r;
  }
  function htmlListeDevis(a) {
    var l = S.devisDe[a.affaire_id];
    if (!Array.isArray(l)) return '';
    var vivants = l.filter(devisVivant).length, principal = devisPrincipal(a);
    return l.map(function (d) {
      var id = esc(d.devis_id), v = versionD(d);
      if (!devisVivant(d)) {
        var mot = d.statut === 'refuse' ? 'refusé' + (motifMot(d.refuse_motif) ? ', ' + motifMot(d.refuse_motif) : '') : 'abandonné';
        return '<li class="aff-devis__court"><button type="button" class="aff-devis__un" data-aff="devisOuvrir" data-devis="' + id + '">'
          + '<s>' + esc(d.numero) + '</s> ' + esc(mot) + ', du ' + esc(dateCourte(d.date_devis)) + ', ' + esc(eurosHT(d.total_ht_c)) + '</button></li>';
      }
      var r = suiviDevis(a, d), g = '';
      /* Deux devis vivants : la carte de celui qui porte le montant de l'affaire le dit. */
      var compte = vivants > 1 && principal && principal.devis_id === d.devis_id && d.statut !== 'enregistre';
      if (r.appel) g += '<a class="btn" href="tel:' + esc(r.appel.tel) + '">L’appeler d’abord</a>';
      if (r.geste) g += '<button type="button" class="btn" data-aff="devisAgir" data-action="' + r.geste.action + '" data-devis="' + id + '"'
        + (r.aide ? ' aria-describedby="affDevisAide-' + id + '"' : '') + '>' + esc(r.geste.mot) + '</button>';
      /* Vigneron (lot 67, tour 2) : la phrase d'aide colle aux boutons qu'elle explique ; les liens viennent apres. */
      var li = '<button type="button" class="aff-devis__lien" data-aff="devisOuvrir" data-devis="' + id + '">Ouvrir le devis</button>';
      for (var k = 1; v && k < v; k++)
        li += '<button type="button" class="aff-devis__lien" data-aff="devisAgir" data-action="version" data-version="' + k + '" data-devis="' + id + '">Voir la version ' + k + '</button>';
      return '<li class="aff-devis__carte" data-devis-carte="' + id + '"><p class="aff-devis__tete"><b>Devis ' + esc(d.numero) + (v > 1 ? ', version ' + v : '') + '</b> '
        + '<span class="aff-marque">' + esc(r.marque) + '</span></p>'
        + '<p class="aff-devis__detail">' + r.phrase + (compte ? ' C’est lui qui compte pour l’affaire.' : '') + '</p>'
        + (g ? '<p class="aff-devis__gestes">' + g + '</p>' : '')
        + (r.aide ? '<p class="aff-aide aff-devis__aide" id="affDevisAide-' + id + '">' + esc(r.aide) + '</p>' : '')
        + htmlLienSignature(a, d)
        + '<p class="aff-devis__gestes aff-devis__liens">' + li + '</p>'
        + '</li>';
    }).join('');
  }
  /* LOT 71 (06/10/2026, demande de Ted) : LE LIEN DE SIGNATURE, A COPIER SUR LA CARTE. Seulement
     pour un devis envoye, pas expire, dont la base garde le jeton du lien vivant (liens crees a
     partir du lot 71). Le champ est en lecture seule : il se selectionne si la copie echoue. */
  function urlSignature(d) {
    var j = d && S.lienDe[d.devis_id];
    return /^[0-9a-f]{64}$/.test(String(j || '')) ? location.origin + '/signer/#' + j : '';
  }
  /* `S.lienDe[devis]` : le jeton ; « ancien » = un lien vivant cree AVANT le lot 71 (sans
     jeton garde, il ne peut pas se reafficher) ; « aucun » = pas de lien vivant. Absent : pas
     encore lu, ou SQL du lot 71 pas passe, et la carte se tait. Verifie chez Ted le 06/10/2026 :
     son seul devis envoye avait un lien d'avant le lot, d'ou le geste « nouveau lien ». */
  function htmlLienSignature(a, d) {
    if (!d || d.statut !== 'envoye' || expireD(d) || a.issue !== 'en_cours') return '';
    var u = urlSignature(d), id = esc(d.devis_id), etat = S.lienDe[d.devis_id];
    var mot = '<p class="aff-aide" id="affLienMot-' + id + '" aria-live="polite"></p>';
    if (!u && (etat === 'ancien' || etat === 'aucun')) {
      return '<div class="aff-devis__signer">'
        + '<p class="aff-aide">' + (etat === 'ancien'
          ? 'Le lien de signature déjà envoyé a été créé avant que le bureau garde les liens : il ne peut pas se réafficher. Crée un nouveau lien pour l’avoir ici. L’ancien ne marchera plus : renvoie le nouveau à ton client.'
          : 'Pas encore de lien de signature pour ce devis. Crée-le pour le copier dans ton mail.') + '</p>'
        + '<p class="aff-devis__gestes"><button type="button" class="btn" data-aff="devisLienCreer" data-devis="' + id + '">'
        + (etat === 'ancien' ? 'Créer un nouveau lien' : 'Créer un lien de signature') + '</button></p>' + mot + '</div>';
    }
    if (!u) return '';
    /* Demande de Ted (06/10/2026) : UN bouton, le lien complet ne s'affiche pas. */
    return '<div class="aff-devis__signer"><p class="aff-devis__gestes">'
      + '<button type="button" class="btn aff-devis__copier" data-aff="devisLienCopier" data-devis="' + id + '">'
      + '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>'
      + '<span class="aff-devis__copier-t">Copier le lien du devis</span></button></p>'
      + mot + '</div>';
  }
  function devisParId(id) {
    var d = null;
    Object.keys(S.devisDe).forEach(function (k) { (S.devisDe[k] || []).forEach(function (x) { if (x.devis_id === id) d = x; }); });
    return d;
  }
  function creerLienCarte(id) {
    var d = devisParId(id), dit = el('affLienMot-' + id);
    if (!d || S.lienEnCours) return;
    S.lienEnCours = true;
    if (dit) dit.textContent = 'Création du lien…';
    BdvCompte.api('/rpc/devis_lien_creer', { methode: 'POST', corps: { p_bureau: bureau(), p_devis: id } }).then(function (r) {
      S.lienEnCours = false;
      var j = typeof r === 'string' ? r : (Array.isArray(r) ? r[0] : r);
      if (!/^[0-9a-f]{64}$/.test(String(j || ''))) throw new Error('jeton');
      S.lienDe[id] = j;
      peindreListeDevis(d.affaire_id);
      var b = document.querySelector('[data-aff="devisLienCopier"][data-devis="' + id + '"]'), m2 = el('affLienMot-' + id);
      if (m2) m2.textContent = 'Nouveau lien créé : copie-le et envoie-le à ton client.';
      if (b) { try { b.focus(); } catch (e) {} }
    }).catch(function (e) {
      S.lienEnCours = false;
      var det = String((e && (e.detail || e.message)) || '');
      var m3 = el('affLienMot-' + id);
      if (m3) m3.textContent = 'Le lien n’a pas pu se créer : ' + (/expire/.test(det) ? 'le devis a expiré.'
        : /numero produit|sans numero ni e-mail/.test(det) ? 'ce devis ne ferait pas une commande importable dans Vitisoft. Ouvre le devis pour voir ce qui manque.'
        : e && !e.status ? 'ta connexion a coupé. Réessaie.' : 'la base l’a refusé. Ouvre le devis pour voir pourquoi.');
    });
  }
  function copierLien(id) {
    var d = devisParId(id);
    var u = urlSignature(d), dit = el('affLienMot-' + id);
    var b = document.querySelector('[data-aff="devisLienCopier"][data-devis="' + id + '"]');
    if (!u) return;
    function ok() {
      if (dit) dit.textContent = 'Lien copié : colle-le dans ton mail.';
      var t = b && b.querySelector('.aff-devis__copier-t');
      if (t) { t.textContent = 'Lien copié'; b.classList.add('aff-devis__copier--fait');
        setTimeout(function () { t.textContent = 'Copier le lien du devis'; b.classList.remove('aff-devis__copier--fait'); }, 2500); }
    }
    /* Sans presse-papier moderne : un champ cache, selectionne, copie. Jamais un faux « copié ». */
    function secours() {
      var z = document.createElement('textarea'), fait = false;
      z.value = u; z.setAttribute('readonly', ''); z.style.position = 'fixed'; z.style.opacity = '0'; z.style.left = '-9999px';
      document.body.appendChild(z);
      try { z.select(); fait = document.execCommand && document.execCommand('copy'); } catch (e) { fait = false; }
      z.remove();
      if (fait) ok();
      else if (dit) dit.textContent = 'Copie impossible dans ce navigateur : ouvre le devis, le lien y est.';
      if (b) { try { b.focus(); } catch (e) {} }
    }
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(u).then(ok, secours); return; } } catch (e) {}
    secours();
  }
  /* Le jeton des liens vivants de ces devis. Colonne absente (SQL du lot 71 pas passe) ou
     panne : rien, la carte se tait. */
  function lireLiens(id) {
    var l = S.devisDe[id];
    var ids = Array.isArray(l) ? l.filter(function (d) { return d.statut === 'envoye'; }).map(function (d) { return d.devis_id; }) : [];
    if (!ids.length) return Promise.resolve();
    return BdvCompte.api('/devis_liens?bureau=eq.' + encodeURIComponent(bureau()) + '&devis_id=in.(' + ids.map(encodeURIComponent).join(',')
      + ')&remplace_le=is.null&select=devis_id,jeton')
      .then(function (v) {
        if (!Array.isArray(v)) return;
        var change = false, vu = {};
        v.forEach(function (x) { if (x && x.devis_id) vu[x.devis_id] = x.jeton || 'ancien'; });
        ids.forEach(function (k) { var e = vu[k] || 'aucun'; if (S.lienDe[k] !== e) { S.lienDe[k] = e; change = true; } });
        if (change) peindreListeDevis(id);
      }, function () {});
  }
  /* Un devis attend-il un geste ? (la section remonte sous la frise, vigneron lot 67) */
  /* Un devis vivant court : « Nouveau devis » se fait discret (on le relance, on n'en refait
     pas un ; expert commercial, lot 67). */
  /* Vigneron (lot 67, tour 2) : UN seul aspect, d'une affaire a l'autre : des qu'un devis vit,
     « Nouveau devis » est un lien ; sans devis vivant, c'est le bouton. */
  function devisCourt(a) {
    var l = S.devisDe[a.affaire_id];
    return Array.isArray(l) && l.some(devisVivant);
  }
  function devisAttend(a) {
    var l = S.devisDe[a.affaire_id];
    return Array.isArray(l) && l.some(function (d) { return devisVivant(d) && !!suiviDevis(a, d).geste; });
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
      lireVersions(id);
      lireLiens(id);
    }, function () {});
  }
  /* LOT 68 : LES TOTAUX GARDES DES VERSIONS PRECEDENTES (SQL du lot 68), lus seulement s'il y a
     un devis corrige. Table absente ou panne : la carte se tait sur l'ecart. */
  function lireVersions(id) {
    var l = S.devisDe[id];
    var ids = Array.isArray(l) ? l.filter(function (d) { return versionD(d) > 1; }).map(function (d) { return d.devis_id; }) : [];
    if (!ids.length) return Promise.resolve();
    return BdvCompte.api('/devis_versions?bureau=eq.' + encodeURIComponent(bureau()) + '&devis_id=in.(' + ids.map(encodeURIComponent).join(',') + ')&select=devis_id,version,total_ht_c')
      .then(function (v) {
        if (!Array.isArray(v)) return;
        v.forEach(function (x) { S.versionsHt[x.devis_id + '|' + x.version] = Number(x.total_ht_c); });
        peindreListeDevis(id);
        var ul = el('affDevisListe'), a = S.affaires.filter(function (x) { return x.affaire_id === id; })[0];
        if (S.page === id && ul && a && el('pageAffaire') && el('pageAffaire').contains(ul)) ul.innerHTML = htmlListeDevis(a);
      }, function () {});
  }
  /* « 60,00 € HT de moins que la version 1 » : seulement si le total de la version d'avant a ete
     garde (lot 68). Jamais d'ecart invente. */
  function ecartVersion(d) {
    var v = versionD(d), avant = v > 1 ? S.versionsHt[d.devis_id + '|' + (v - 1)] : undefined;
    if (avant === undefined || isNaN(avant)) return '';
    var e = Math.round(Number(d.total_ht_c) || 0) - avant;
    return e === 0 ? ' même montant que la version ' + (v - 1) + '.'
      : ' ' + esc(eurosHT(Math.abs(e))) + (e < 0 ? ' de moins' : ' de plus') + ' que la version ' + (v - 1) + '.';
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
    /* LOT 67 : une carte porte plusieurs boutons du meme devis : on retrouve LE MEME (geste, version). */
    var act = document.activeElement, garde = act && ul.contains(act) && act.getAttribute('data-devis')
      ? '[data-aff="' + act.getAttribute('data-aff') + '"][data-devis="' + act.getAttribute('data-devis') + '"]'
        + (act.getAttribute('data-action') ? '[data-action="' + act.getAttribute('data-action') + '"]' : '')
        + (act.getAttribute('data-version') ? '[data-version="' + act.getAttribute('data-version') + '"]' : '') : null;
    ul.innerHTML = h;
    ul.hidden = !h;
    if (garde) { var n = ul.querySelector(garde); if (n) { try { n.focus({ preventScroll: true }); } catch (e) {} } }
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
    /* M7 : une affaire close vit dans un <details> replie ; un bouton cache ne prend pas le
       focus. On deplie ce qui le cache. */
    var dt = n && n.closest ? n.closest('details') : null;
    if (dt && !dt.open) dt.open = true;
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
  function ouvrirDevis(a, devisId, agir) {
    if (oppose(a) && a.issue === 'en_cours') return;
    if (!a) return;
    var mot = el('affDevisMot');
    if (mot) mot.textContent = '';
    var dv = devisId ? (S.devisDe[a.affaire_id] || []).filter(function (d) { return d.devis_id === devisId; })[0] : null;
    /* M10 (01/10/2026) : un devis demande qui n'est pas la (lecture tombee, devis disparu) le
       DIT ; rien de fait en silence. L'appelant ne le marque vu qu'en cas de succes. */
    if (devisId && !dv) { dire('Le devis n’a pas pu s’ouvrir : sa lecture n’a pas abouti. Réessaie dans un instant.', true); return Promise.resolve(false); }
    var id = a.affaire_id, qui = sujet(a), neuf = estNouveau(a), issue = a.issue, etD = a.issue === 'en_cours' ? etapeDevis(a) : null;
    /* LOT 51 : combien d'AUTRES devis de l'affaire sont encore en cours. « Il a dit non » ne
       propose de clore l'affaire que s'il n'y en a aucun (la base refuse sinon). */
    var autres = (S.devisDe[a.affaire_id] || []).filter(function (x) {
      return (!dv || x.devis_id !== dv.devis_id) && (x.statut === 'enregistre' || x.statut === 'envoye'); }).length;
    return chargerDevis().then(function (D) {
      viderAttente();
      fermerPanneau();
      var ouvert = D.ouvrir({
        bureau: bureau(), affaire: { affaire_id: id, issue: issue, rappel: a.rappel || null, rappel_titre: a.rappel_titre || null },
        etapeDevis: etD, sujet: qui, nouveau: neuf, devis: dv || null, autresEnCours: autres, opposee: oppose(a),
        agir: dv && agir ? agir : null,
        retour: function (devisId) {
          if (S.page) { rendre(); lireDevis({ affaire_id: id }).then(rendre); return; }
          if (issue !== 'en_cours') { rendre(); var b = focusSortie(id); if (b) { try { b.focus(); } catch (e) {} } return; }
          S.nouvelle = false; S.choix = null; S.ouverte = id; MOD_CLE = ''; S.retour = { affaire: id };
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
          var avant = issue;
          if (d && d.statut === 'accepte') issue = 'gagnee';
          /* LOT 51 : un refus qui clot l'affaire, une acceptation annulee qui la rouvre. */
          if (d && d.statut === 'refuse' && d.affaireClose) issue = 'perdue';
          if (d && d.affaireRouverte && issue === 'gagnee') issue = 'en_cours';
          charger().then(function (ok) { if (ok) rendre(); if (S.page) return lireDevis({ affaire_id: id }).then(rendre); });
          /* T4 (tour 3) : l'avis de la page disait encore « Affaire ouverte : ..., rappel le
             9 oct. » a cote de « Aucune affaire en cours », apres un devis qui avait clos
             l'affaire. Un geste du devis remplace l'avis : par ce que le geste a change a
             l'affaire, ou par rien. */
          if (issue !== avant) dire(esc(qui) + (issue === 'gagnee' ? ' : l’affaire est gagnée.'
            : issue === 'perdue' ? ' : l’affaire passe à « Pas pour cette fois ».' : ' : l’affaire est rouverte.'));
          else { var avP = el('affAvis'); if (avP) { avP.innerHTML = ''; avP.hidden = true; avP.classList.remove('aff-avis--souci'); } }
        }
      });
      return ouvert !== false;
    }, function () {
      var m = el('affDevisMot');
      if (m) { m.textContent = 'Le devis ne s’est pas ouvert : vérifie ta connexion et réessaie.'; montrer(m); }
      else dire('Le devis ne s’est pas ouvert : vérifie ta connexion et réessaie.', true);
      return false;
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
    demanderLignes();
    var attend = etatLignes() !== 'pret';
    var l = v ? chercherConnus(v).filter(function (c) {
      return a && !(c.genre === 'client' ? a.client_id === c.id : a.piste_id === c.id);
    }) : [];
    ul.innerHTML = !v ? '' : (l.length ? l.map(function (c) { return htmlTrouve(c, 'rattacher'); }).join('') : '')
      + (!l.length || attend ? '<li class="aff-aide">' + motSansClients() + '</li>' : '');
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
    } catch (e) { dire(raison(e), true); await relireSansEffacer(); return; }
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
  /* SUR « TOUTES », UN TABLEAU PAR TYPE QUI A DES AFFAIRES, 03/10/2026. Avant, le kanban
     demandait de choisir un type (arbitrage du lot 39) et montrait un ecran vide pendant que
     le bilan annoncait « 1 affaire en cours ». Avis du vigneron : « j'ouvre la piece pour
     travailler et elle me repond par une consigne ». Chaque type garde SES colonnes, rien de
     commun n'est invente ; les types sans affaire ne s'affichent pas dans cette vue. */
  function htmlTableau(t, titre) {
    var dans = enCours().filter(function (a) { return a.type_id === t.type_id; });
    var cols = etapesDe(t.type_id).map(function (et) {
      var ici = dans.filter(function (a) { return a.etape_id === et.etape_id; });
      return '<section class="aff-col' + (ici.length ? '' : ' aff-col--vide') + '" data-colonne="' + et.etape_id + '" aria-label="' + esc(et.nom) + ', ' + ici.length + '">'
        + '<h3 class="aff-col__t">' + esc(et.nom) + ', ' + ici.length + '</h3>'
        + (ici.length ? '<ul class="aff-col__liste">' + ici.map(htmlCarte).join('') + '</ul>' : '<p class="aff-col__rien">Rien ici pour l’instant</p>') + '</section>';
    }).join('');
    return (titre ? '<h3 class="aff-bloc__t aff-kanban__type">' + esc(t.nom) + ', ' + dans.length + ' en cours</h3>' : '')
      + (dans.length || titre ? '' : '<p class="aff-vide">Aucune affaire en cours dans « ' + esc(t.nom) + ' ».</p>')
      + '<div class="aff-kanban">' + cols + '</div>';
  }
  function htmlKanban() {
    var t = typeKanban();
    if (t) return '<div class="aff-bloc">' + htmlTableau(t, false) + '</div>';
    var ec = enCours();
    var avec = typesActifs().filter(function (x) { return ec.some(function (a) { return a.type_id === x.type_id; }); });
    if (!avec.length) return '<div class="aff-bloc"><p class="aff-vide">Rien en cours. « Nouvelle affaire » pour en ouvrir une.</p></div>';
    return '<div class="aff-bloc">' + avec.map(function (x) { return htmlTableau(x, true); }).join('') + '</div>';
  }
  function htmlCarte(a) {
    var e = etat(a), qui = sujet(a);
    if (e.oppose) {
      return '<li class="aff-carte aff-ligne--opposee' + (S.ouverte === a.affaire_id ? ' aff-carte--ouverte' : '') + '" data-affaire="' + a.affaire_id + '">'
        + '<p class="aff-ligne__t"><button type="button" class="aff-ligne__qui" data-aff="ouvrir" aria-haspopup="dialog"'
        + ' aria-controls="affaireModale" aria-expanded="' + (S.ouverte === a.affaire_id ? 'true' : 'false') + '">' + esc(qui) + '</button></p>'
        + '<p class="aff-marque aff-marque--opposee">' + MARQUE_OPP + '</p></li>';
    }
    /* L'etape ou la carte est deja n'est pas proposee : la liste disait « Repere » dans la
       colonne Repere. */
    var opts = '<option value="" selected>Choisir l’étape</option>' + etapesDe(a.type_id).filter(function (x) { return x.etape_id !== a.etape_id; }).map(function (x) {
      return '<option value="' + x.etape_id + '">' + esc(x.nom) + '</option>';
    }).join('');
    var ouverte = S.ouverte === a.affaire_id;
    return '<li class="aff-carte' + (e.endormie ? ' aff-ligne--dort' : '') + (e.retard > 0 ? ' aff-ligne--retard' : '')
      + (ouverte ? ' aff-carte--ouverte' : '') + '" data-affaire="' + a.affaire_id + '" draggable="true">'
      /* T8 (tour 3) : le nom est un bouton, et son calque `::after` couvre toute la carte. Chromium
         ne commence pas un glisser depuis un bouton, meme dans un element `draggable` : saisie en
         son milieu, la carte ne partait pas. Le bouton est donc `draggable` lui aussi ; l'image du
         glisser reste la carte entiere (dragstart). */
      + '<p class="aff-ligne__t"><button type="button" class="aff-ligne__qui" draggable="true" data-aff="ouvrir" aria-haspopup="dialog"'
      + ' aria-controls="affaireModale" aria-expanded="' + (ouverte ? 'true' : 'false') + '">' + esc(qui) + '</button></p>'
      + (a.titre && a.titre !== qui ? '<p class="aff-ligne__s">' + esc(a.titre) + '</p>' : '')
      + (estNouveau(a) ? '<p class="aff-carte__marque">' + marqueNouveau() + '</p>' : '')
      + (motifDe(a) ? '<p class="aff-carte__motif">' + htmlMotif(motifDe(a)) + '</p>' : '')
      + '<p class="aff-ligne__s">' + ligneRappel(a, e) + '</p>'
      + (devisDe(a) ? '<p class="aff-ligne__s aff-ligne__devis">Devis ' + ligneDevis(a, true) + '</p>' : '')
      + '<div class="aff-carte__gestes">' + (gesteUrgent(a, e, qui) || gesteVers(a, etapeSuivante(a), qui, true))
      /* 02/10/2026 : « Deplacer vers » et sa liste prenaient la moitie de la carte, pour un
         geste rare. Ils se replient derriere « Deplacer ». Le glisser reste. */
      + '<details class="aff-carte__dep"><summary>Déplacer<span class="hors-ecran"> « ' + esc(qui) + ' » vers une autre étape</span></summary>'
      + '<label class="aff-carte__dep-l"><span class="hors-ecran">Étape de « ' + esc(qui) + ' »</span>'
      + '<select class="aff-carte__deplacer" data-deplacer>' + opts + '</select></label></details>'
      + '</div></li>';
  }

  function htmlRelancer() {
    var r = relancerTries();
    /* `affRelancer` : la case « A relancer » du bilan commun y pose le focus (lot 45). */
    if (!r.length) return '<div class="aff-bloc"><h3 class="aff-bloc__t" id="affRelancer" tabindex="-1">À relancer</h3>'
      + '<p class="aff-vide">Rien à relancer aujourd’hui.</p></div>';
    return '<div class="aff-bloc aff-bloc--relancer"><h3 class="aff-bloc__t" id="affRelancer" tabindex="-1">À relancer : ' + r.length + '</h3>'
      + '<ul class="aff-liste">' + r.map(function (a) { return htmlAffaire(a, true); }).join('') + '</ul></div>';
  }
  function htmlListe() {
    var reste = visibles().filter(function (a) { return !etat(a).aRelancer && !oppose(a); });
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
      /* 03/10/2026 : le titre du groupe se dit comme en kanban, « Type, N en cours ». */
      var nt = enCours().filter(function (a) { return a.type_id === t.type_id; }).length;
      html += (S.filtre || types.length < 2 ? '' : '<h3 class="aff-bloc__t">' + esc(t.nom) + ', ' + nt + ' en cours</h3>') + blocs;
    });
    if (!visibles().length) html = '<p class="aff-vide">Rien en cours. Un caviste goûté au salon, un restaurant à rappeler ? « Nouvelle affaire » pour l’ouvrir.</p>';
    /* N4 : les affaires des personnes en opposition passent EN FIN, a part. */
    var opp = visibles().filter(oppose);
    if (opp.length) html += '<h3 class="aff-bloc__t">' + (opp.length > 1 ? 'Ne veulent plus être contactées : ' : 'Ne veut plus être contactée : ')
      + opp.length + '</h3><ul class="aff-liste">' + opp.map(function (a) { return htmlAffaire(a, true); }).join('') + '</ul>';
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
    /* LE BANDEAU DES AFFAIRES CLOSES, 02/10/2026. Ted : « il faut ameliorer le bouton des
       anciennes affaires ». C'etait une ligne de lien soulignee, lue comme une note de bas
       de page. C'est desormais un bandeau qui se voit comme un geste : un titre, le bilan
       en clair (gagnees, montant accepte), et a droite ce que fait le clic, « Voir » ou
       « Masquer » selon l'etat. La liste se deplie dessous, sans quitter la piece.
       X4 tient toujours : « 1 gagnée sur 2 » et le montant sont separes par un point
       median, l'espace qui le precede est insecable. */
    return '<details class="aff-plus aff-closes"' + (deplie ? ' open' : '') + '><summary class="aff-closes__tete">'
      + '<span class="aff-closes__texte"><span class="aff-closes__t">Affaires closes, 12 derniers mois</span>'
      + '<span class="aff-closes__bilan">' + g + '\u00a0gagnée' + (g > 1 ? 's' : '') + ' sur ' + c.length
      + (gN ? '\u00a0· ' + eurosHT(gHT) + ' en devis acceptés' : '') + '</span></span>'
      + '<span class="aff-closes__geste"><span class="aff-closes__voir">Voir et rouvrir</span><span class="aff-closes__masquer">Masquer</span></span>'
      + '</summary><ul class="aff-liste">'
      + c.map(function (a) {
        var m = MOTIFS.filter(function (x) { return x[0] === a.motif; })[0];
        return '<li class="aff-ligne" data-affaire="' + a.affaire_id + '"><div class="aff-ligne__corps">'
          + '<p class="aff-ligne__t"><span class="aff-ligne__qui">' + esc(sujet(a)) + '</span></p>'
          + '<p class="aff-ligne__s">' + (a.issue === 'gagnee' ? 'Gagnée' : 'Pas pour cette fois' + (m ? ' (' + m[1].toLowerCase() + ')' : ''))
          + ' le ' + dateCourte(jourLocal(a.close_le)) + '</p></div>'
          + '<div class="aff-ligne__gestes"><button type="button" class="btn" data-aff="devisClose" aria-controls="affDevisC-' + a.affaire_id + '"'
          + ' aria-expanded="' + (S.closesDevis[a.affaire_id] ? 'true' : 'false') + '">Ses devis</button>'
          /* T5 (tour 3) : une personne en opposition ne se rappelle plus, son affaire classee ne
             se rouvre pas (la base le refuse aussi, lot 56). Sa marque le dit a la place. */
          + (oppose(a) ? '<span class="aff-marque">' + esc(MARQUE_OPP) + '</span>'
            : '<button type="button" class="btn" data-aff="rouvrir">Rouvrir</button>') + '</div>'
          + '<ul class="aff-devis__liste" id="affDevisC-' + a.affaire_id + '"' + (S.closesDevis[a.affaire_id] ? '' : ' hidden') + '>'
          + (S.closesDevis[a.affaire_id] ? (htmlListeDevis(a) || (Array.isArray(S.devisDe[a.affaire_id]) ? '<li class="aff-aide">Aucun devis.</li>' : '')) : '')
          + '</ul></li>';
      }).join('') + '</ul></details>';
  }
  /* ================= LES TYPES D'AFFAIRES, DANS « MES REGLAGES » (02/10/2026) =================
     Demande de Ted : « les reglages des affaires arrivent maintenant dans reglages ». Le repli
     « Regler mes types d'affaires » quitte le bas de Mon commerce et devient l'onglet
     « Mes affaires » du panneau unique (bdv-reglages.js). Le bloc est BRANCHE par
     bdv-affaires-jour.js, qui part avec la page : ce fichier-ci n'arrive qu'au premier
     clic, il est charge a la demande quand l'onglet s'ouvre.
     PAS DE <form> ICI : le panneau EST un formulaire, et un formulaire dans un formulaire
     est jete par le navigateur. Chaque type est un bloc `.aff-type[data-type]` ; son
     enregistrement passe par le « Enregistrer » du pied du panneau (et donc par Entree),
     comme tout le reste des reglages. Retirer une etape, ne plus utiliser un type, ajouter
     un modele restent des gestes immediats, comme l'agenda.
     UN REPEINT N'EFFACE PAS CE QUI EST TAPE (M3) : les champs modifies sont repris. */
  var HOTE_REG = null;
  function champsDe(box) {
    var o = {};
    [].forEach.call(box.querySelectorAll('[name]'), function (n) { o[n.name] = n; });
    return o;
  }
  function boitesReg() { return HOTE_REG ? [].slice.call(HOTE_REG.querySelectorAll('.aff-type[data-type]')) : []; }
  function typeBouge(box) {
    var t = typeDe(box.getAttribute('data-type'));
    if (!t) return false;
    var E = champsDe(box);
    if (E.nom && E.nom.value.trim() !== t.nom) return true;
    if (E.sommeil && String(parseInt(E.sommeil.value, 10)) !== String(t.sommeil_jours)) return true;
    if (E.ajout && E.ajout.value.trim()) return true;
    return etapesDe(t.type_id).some(function (e) {
      var n = E['etape_' + e.etape_id]; var v = n ? n.value.trim() : '';
      return !!v && v !== e.nom;
    });
  }
  function direR(html, souci) {
    var n = HOTE_REG && HOTE_REG.isConnected && el('affRegAvis');
    if (!n) { dire(html, souci); return; }
    n.innerHTML = html || '';
    n.hidden = !html;
    n.classList.toggle('aff-avis--souci', !!souci);
  }
  function htmlTypes() {
    if (!S.charge) {
      return S.erreur
        ? '<p class="bdvr-aide">Tes types d’affaires n’ont pas pu être lus. <button type="button" class="bdvr-btn bdvr-btn--creux" data-aff="relireReg">Réessayer</button></p>'
        : '<p class="bdvr-aide">Lecture de tes types d’affaires…</p>';
    }
    var presents = S.types.map(function (t) { return norm(t.nom); });
    var manquants = MODELES.filter(function (m) { return presents.indexOf(norm(m.nom)) < 0; });
    return '<p class="bdvr-aide">Chaque type d’affaire a ses étapes, dans l’ordre où tu les mènes. Renomme, ajoute, puis « Enregistrer » en bas.</p>'
      + (S.types.length ? '' : '<p class="bdvr-aide">Tu n’as encore aucun type d’affaire. Choisis un modèle ci-dessous pour commencer.</p>')
      + S.types.map(function (t) {
        var ets = etapesDe(t.type_id);
        return '<div class="aff-type" data-type="' + t.type_id + '">'
          + '<div class="aff-duo"><label class="aff-champ"><span>Nom</span><input class="bdvr-i" name="nom" type="text" maxlength="60" value="' + esc(t.nom) + '"></label>'
          + '<label class="aff-champ"><span>Une affaire s’endort après (jours)</span><input class="bdvr-i" name="sommeil" type="number" min="1" max="365" value="' + t.sommeil_jours + '"></label></div>'
          + '<p class="aff-type__t">' + (t.archive ? 'Ne sert plus. ' : '') + 'Les étapes, dans l’ordre (' + ets.length + ' sur ' + MAX_ETAPES + ')</p>'
          + '<ol class="aff-type__etapes">' + ets.map(function (e, i) {
            var n = S.affaires.filter(function (a) { return a.etape_id === e.etape_id; }).length;
            return '<li class="aff-type__etape"><input class="bdvr-i" name="etape_' + e.etape_id + '" type="text" maxlength="60" value="' + esc(e.nom) + '" aria-label="Étape ' + (i + 1) + '">'
              + '<button type="button" class="bdvr-btn bdvr-btn--creux" data-aff="retirerEtape" data-etape="' + e.etape_id + '"'
              + (ets.length <= 1 ? ' disabled' : '') + '>Retirer' + (n ? ' (' + pluriel(n, 'affaire', 'affaires') + ')' : '') + '</button></li>';
          }).join('') + '</ol>'
          + (ets.length < MAX_ETAPES ? '<label class="aff-champ"><span>Ajouter une étape à la fin</span><input class="bdvr-i" name="ajout" type="text" maxlength="60"></label>' : '')
          + '<div class="aff-form__pied"><button type="button" class="bdvr-btn bdvr-btn--creux" data-aff="archiver">' + (t.archive ? 'Le remettre en service' : 'Ne plus l’utiliser') + '</button></div>'
          + '</div>';
      }).join('')
      + (manquants.length ? '<p class="aff-type__t">Ajouter un modèle</p><div class="aff-chips">'
        + manquants.map(function (m) { return '<button type="button" class="bdvr-btn bdvr-btn--creux" data-aff="ajoutModele" data-modele="' + m.cle + '">' + esc(m.nom) + '</button>'; }).join('')
        + '</div>' : '');
  }
  function peindreReglages() {
    var h = HOTE_REG;
    if (!h || !h.isConnected) return;
    var corps = el('affRegCorps');
    if (!corps) return;
    var garde = {};
    boitesReg().forEach(function (b) {
      [].forEach.call(b.querySelectorAll('input[name]'), function (n) {
        if (n.value !== n.defaultValue) garde[b.getAttribute('data-type') + '|' + n.name] = n.value;
      });
    });
    var act = document.activeElement, vise = null;
    if (act && corps.contains(act)) {
      var bx = act.closest('[data-type]');
      var pre = bx ? '[data-type="' + bx.getAttribute('data-type') + '"] ' : '';
      if (act.name) vise = pre + '[name="' + act.name + '"]';
      else if (act.getAttribute('data-aff')) {
        vise = pre + '[data-aff="' + act.getAttribute('data-aff') + '"]'
          + (act.hasAttribute('data-modele') ? '[data-modele="' + act.getAttribute('data-modele') + '"]' : '');
      }
      if (!vise && bx) vise = pre + 'input';
    }
    corps.innerHTML = htmlTypes();
    boitesReg().forEach(function (b) {
      [].forEach.call(b.querySelectorAll('input[name]'), function (n) {
        var k = b.getAttribute('data-type') + '|' + n.name;
        if (k in garde) n.value = garde[k];
      });
    });
    if (vise || (act && !act.isConnected)) {
      var nf = (vise && corps.querySelector(vise + ':not([disabled])')) || corps.querySelector('input, button:not([disabled])');
      if (nf) { try { nf.focus({ preventScroll: true }); } catch (x) {} }
    }
  }
  /* L'onglet s'ouvre : on pose le cadre une fois, puis on relit la base, sauf si le
     vigneron a deja tape quelque chose qu'il n'a pas enregistre. */
  async function ouvrirReglages(cible) {
    if (!cible) return;
    if (HOTE_REG !== cible || !el('affRegCorps')) {
      HOTE_REG = cible;
      cible.innerHTML = '<p class="aff-avis" id="affRegAvis" role="status" hidden></p><div class="aff-reglages" id="affRegCorps"></div>';
      brancherReglages(cible);
    }
    if (boitesReg().some(typeBouge)) return;
    peindreReglages();
    if (!pret()) return;
    await charger();
    peindreReglages();
  }
  function brancherReglages(c) {
    if (c.getAttribute('data-branche-aff')) return;
    c.setAttribute('data-branche-aff', '1');
    c.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-aff]');
      if (!b || !c.contains(b)) return;
      var quoi = b.getAttribute('data-aff');
      if (quoi === 'relireReg') { S.erreur = false; peindreReglages(); charger().then(function () { rendre(); }); return; }
      if (quoi === 'retirerEtape') { retirerEtape(b.getAttribute('data-etape')); return; }
      if (quoi === 'archiver') { var bx = b.closest('[data-type]'); if (bx) archiver(bx.getAttribute('data-type')); return; }
      if (quoi === 'ajoutModele') { creerModeles([b.getAttribute('data-modele')], true); return; }
    });
  }
  /* Le « Enregistrer » du pied du panneau : seuls les types qui ont bouge partent. Un
     echec se dit dans l'onglet, et la promesse est rejetee : le panneau refuse alors
     d'annoncer « C'est enregistre ». */
  async function enregistrerReglages() {
    var bx = boitesReg().filter(typeBouge);
    if (!bx.length) return;
    var ok = true;
    for (var i = 0; i < bx.length; i++) { if (!(await enregistrerType(bx[i]))) ok = false; }
    if (ok) direR(bx.length > 1 ? 'Types d’affaires enregistrés.' : 'Type d’affaire enregistré.');
    await charger(); rendre();
    if (!ok) throw new Error('types d’affaires');
  }

  /* ---------------- LES GESTES ---------------- */
  async function creerModeles(cles, ici) {
    var dit = ici ? direR : dire;
    var mods = MODELES.filter(function (m) { return cles.indexOf(m.cle) >= 0; });
    if (!mods.length) { dit('Coche au moins un type d’affaire.', true); return; }
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
      dit(ici ? 'Modèle ajouté : ' + esc(mods.map(function (m) { return m.nom; }).join(', ')) + '.' : '');
    } catch (e) { dit(raison(e), true); }
    await charger(); rendre();
  }

  /* M3 (01/10/2026) : UN ECHEC N'EFFACE PAS CE QUI EST TAPE. On relit la base (la liste
     et le bilan disent vrai), mais le panneau n'est PAS repeint : « Reessaie » doit avoir
     encore quelque chose a renvoyer. `charger()` marque le panneau sale ; on le demarque. */
  async function relireSansEffacer() {
    await charger();
    S.panneauSale = false;
    rendre();
  }
  /* Une valeur pour une colonne bornee : coupee a la longueur de la base (C2). */
  function borne(x, n) { x = x == null ? null : String(x).trim(); return x && x.length > n ? x.slice(0, n).trim() : (x || null); }

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
    if (!typeId) { dire('Crée d’abord un type d’affaire, dans Mes réglages, onglet « Mes affaires ».', true); return; }
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
      if (c.genre === 'client') { affaire.client_id = c.id; affaire.client_nom = borne(c.nom, 120); }
      else affaire.piste_id = c.id;
    } else {
      nom = borne(v('affNom'), 120);
      if (!nom) { dire('Il faut le nom de l’établissement.', true); el('affNom').focus(); return; }
      /* M1 : tant que les clients de l'export arrivent, on ne cree pas un client qui y est
         peut-etre deja. Ca dure une seconde ; un echec de lecture, lui, laisse creer. */
      if (!ch.pisteCreee && etatLignes() === 'attente') {
        dire('Tes clients arrivent encore sur cet appareil : un instant, je vérifie que « ' + esc(nom) + ' » n’y est pas déjà.', true);
        return;
      }
      var sir = String(v('affSiret') || '').replace(/[\s.]/g, '');
      if (sir && !/^\d{14}$/.test(sir)) { dire('Un SIRET a 14 chiffres.', true); ouvrirRepliDe('affSiret'); return; }
      /* N3 : une personne en opposition, au meme SIRET ou a un nom proche, ne se recree pas. */
      var opp = !ch.pisteCreee && ((parSiret(sir) || {}).oppose ? parSiret(sir) : (parNom(nom) || {}).oppose ? parNom(nom) : null);
      if (opp) { dire(motOppose(opp), true); signalerDoublon(); return; }
      var deja = !ch.pisteCreee && parSiret(sir);
      if (deja) { dire('Ce SIRET est déjà celui de « ' + esc(deja.nom) + ' ». Prends-le plutôt que d’en créer une deuxième fiche.', true); signalerDoublon(); return; }
      var nat = document.querySelector('input[name="affNature"]:checked');
      piste = { piste_id: ch.pisteCreee || uuid(), nom: nom, nature: nat ? nat.value : 'autre',
        contact_nom: v('affContact'), contact_fonction: v('affFonction'), telephone: v('affTel'),
        email: v('affEmail'), ville: v('affVille'), code_postal: v('affCp'), source: v('affSource'),
        siret: sir || null, adresse: v('affAdresse') };
      affaire.piste_id = piste.piste_id;
    }
    affaire.titre = borne(v('affIntitule') || nom, 120);
    var sansSiret = false, pisteFaite = false;
    try {
      /* Le client choisi est un nouveau client sans SIRET, reconnu dans l'annuaire :
         on complete sa fiche, champ vide par champ vide, jamais par-dessus une saisie. */
      if (ch.client && ch.completer && ch.client.genre === 'piste') {
        var p0 = S.pistes[ch.client.id] || {}, comp = {};
        Object.keys(ch.completer).forEach(function (k) { if (ch.completer[k] && !p0[k]) comp[k] = ch.completer[k]; });
        if (Object.keys(comp).length) {
          try { await modifier('pistes', 'piste_id', ch.client.id, comp); }
          catch (e) { if (!colonneInconnue(e, /siret|adresse/)) throw e; sansSiret = true; }
        }
      }
      /* M2 (01/10/2026) : LA FICHE PEUT EXISTER SANS SON AFFAIRE. Si la piste est passee
         et l'affaire non, on le DIT, et le second essai reprend la piste deja creee au lieu
         d'en fabriquer une deuxieme (`S.choix.pisteCreee`). */
      if (piste && ch.pisteCreee) {
        var maj = Object.assign({}, piste); delete maj.piste_id;
        try { await modifier('pistes', 'piste_id', piste.piste_id, maj); }
        catch (e) {
          if (!colonneInconnue(e, /siret|adresse/)) throw e;
          delete maj.siret; delete maj.adresse;
          await modifier('pistes', 'piste_id', piste.piste_id, maj);
        }
        pisteFaite = true;
      } else if (piste) {
        try { await creer('pistes', [piste]); }
        catch (e) {
          if (!colonneInconnue(e, /siret|adresse/)) throw e;
          sansSiret = !!(piste.siret || piste.adresse);
          delete piste.siret; delete piste.adresse;
          await creer('pistes', [piste]);
        }
        pisteFaite = true;
        if (S.choix) S.choix.pisteCreee = piste.piste_id;
      }
      await creer('affaires', [affaire]);
      /* M7 : le focus revient d'ou l'on est parti, « Nouvelle affaire ». */
      S.nouvelle = false; S.choix = null;
      dire(point('Affaire ouverte : ' + esc(nom) + ', rappel le ' + dateCourte(rappel))
        + (sansSiret ? ' Le SIRET et l’adresse n’ont pas été gardés : la base attend encore sa mise à jour (lot 39).' : ''));
    } catch (e) {
      /* N7 (tour 2) : DEPUIS LE LOT 56 PERSONNE NE SUPPRIME UNE PISTE (le DELETE est
         refuse a tout compte connecte). Le retrait de la fiche neuve ne servait plus : on
         dit ce qui est reste, et le second essai la reprend (`S.choix.pisteCreee`). */
      /* N1 : le SIRET est deja celui d'une fiche de ton bureau (un collegue l'a creee, ou
         elle n'etait pas encore lue ici). Rien n'est cree ; on relit, et on la nomme. */
      if (piste && !pisteFaite && doublonSiret(e)) {
        await relireSansEffacer();
        var pris = parSiret(piste.siret);
        dire(pris
          ? (pris.oppose ? motOppose(pris)
            : 'Ce SIRET est déjà dans ton bureau : « ' + esc(pris.nom) + ' ». Rien n’a été créé. '
              + '<button type="button" class="btn" data-aff="prendreClient" data-genre="' + pris.genre + '" data-id="' + esc(pris.id) + '">Prendre « ' + esc(pris.nom) + ' »</button>')
          : raison(e), true);
        signalerDoublon();
        return;
      }
      dire(pisteFaite
        ? 'La fiche de « ' + esc(nom) + ' » est créée, pas l’affaire : ' + raison(e).replace(/^Rien n’a été enregistré : /, '').replace(/ Réessaie\.$/, '') + ' Clique encore sur « Créer l’affaire » : je reprends cette fiche, sans la doubler.'
        : raison(e), true);
      await relireSansEffacer();
      return;
    }
    await charger(); rendre();
  }
  /* Un champ fautif dans un repli ferme : on ouvre le repli avant d'y poser le focus. */
  function ouvrirRepliDe(id) {
    var n = el(id); if (!n) return;
    var d = n.closest('details'); if (d) d.open = true;
    try { n.focus(); } catch (e) {}
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
      client_id: String(c.id), client_nom: borne(c.nom, 120), titre: borne(titre, 120), rappel: rappel, rappel_titre: motif };
    try {
      try { await creer('affaires', [affaire]); }
      catch (e) {
        /* Le lot 35 pas encore passe : la colonne du nom manque. On cree sans elle. */
        if (!colonneInconnue(e, /client_nom/)) throw e;
        delete affaire.client_nom;
        await creer('affaires', [affaire]);
      }
      S.nouvelle = false; S.clientPropose = null;
      dire(point('Affaire ouverte chez ' + esc(c.nom || c.id) + ', rappel le ' + dateCourte(rappel)));
    } catch (e) { dire(raison(e), true); await relireSansEffacer(); return; }
    await charger(); rendre();
  }

  /* W1 : le choix « Gagnee » ou « Pas pour cette fois » en cours, ou aucun (''). */
  function poserConclure(f, choix) {
    if (!f) return;
    if (choix) f.setAttribute('data-conclure-avant', choix);
    [].forEach.call(f.querySelectorAll('[data-confirme]'), function (n) { n.hidden = n.getAttribute('data-confirme') !== choix; });
    [].forEach.call(f.querySelectorAll('.aff-conclure__choix'), function (n) {
      n.setAttribute('aria-pressed', n.getAttribute('data-aff') === choix ? 'true' : 'false');
    });
    var pied = f.querySelector('.aff-form__pied'), env = pied && pied.querySelector('[type="submit"]'), mot = pied && pied.querySelector('.aff-form__pied-mot');
    if (env) { if (choix) env.setAttribute('aria-disabled', 'true'); else env.removeAttribute('aria-disabled'); }
    if (pied) pied.classList.toggle('aff-form__pied--retrait', !!choix);
    if (mot) {
      mot.hidden = !choix;
      mot.textContent = choix === 'gagnee' ? 'Termine d’abord\u00a0: «\u00a0Oui, gagnée\u00a0» ou «\u00a0Annuler\u00a0».'
        : choix ? 'Termine d’abord\u00a0: «\u00a0La classer\u00a0» ou «\u00a0Annuler\u00a0».' : '';
    }
  }
  function formEdit(id) { return document.querySelector('form.aff-edit[data-edit="' + id + '"]'); }

  /* M4 (01/10/2026) : « ENREGISTRER » DIT EXACTEMENT CE QUI EST PASSE. Tout se valide
     AVANT la premiere ecriture (le SIRET partait en erreur apres que l'affaire etait deja
     ecrite) ; puis l'affaire ; puis la fiche du nouveau client. Si la seconde tombe, on dit
     que l'affaire est enregistree et pas la fiche, au lieu de « Rien n'a ete enregistre ».
     B3 : la fiche d'une personne en opposition ne renvoie que son nom, elle ne se ressaisit
     pas (la base jetterait les coordonnees en silence, et l'ecran dirait « Enregistre »). */
  async function enregistrer(a) {
    await viderAttente();
    var f = formEdit(a.affaire_id);
    if (!f) return;
    function val(n) { var x = f.elements[n]; return x ? (x.value || '').trim() : ''; }
    var champs = { etape_id: val('etape') || a.etape_id, rappel: val('rappel') || null,
      rappel_titre: val('rappel_titre') || null, titre: borne(val('titre'), 120) || a.titre, notes: val('notes') || null };
    var pis = S.pistes[a.piste_id] || {};
    var p = null;
    if (a.piste_id && f.elements.p_nom) {
      p = {};
      if (pis.opposition) p.nom = borne(val('p_nom'), 120) || pis.nom;
      else {
        ['nom', 'contact_nom', 'contact_fonction', 'telephone', 'email', 'ville', 'code_postal', 'source']
          .forEach(function (k) { p[k] = val('p_' + k) || null; });
        p.nom = borne(p.nom, 120) || pis.nom;
        if (f.elements.p_siret) {
          var sir = val('p_siret').replace(/[\s.]/g, '');
          if (sir && !/^\d{14}$/.test(sir)) {
            dire('Un SIRET a 14 chiffres. Rien n’a été enregistré.', true);
            var ns = f.elements.p_siret; var dd = ns.closest('details'); if (dd) dd.open = true; try { ns.focus(); } catch (x) {}
            return;
          }
          p.siret = sir || null; p.adresse = val('p_adresse') || null;
        }
      }
    }
    try { await modifier('affaires', 'affaire_id', a.affaire_id, champs); }
    catch (e) { dire(raison(e), true); await relireSansEffacer(); return; }
    if (p) {
      try { await modifier('pistes', 'piste_id', a.piste_id, p); }
      catch (e) {
        dire('L’affaire est enregistrée, pas la fiche du client : ' + raison(e).replace(/^Rien n’a été enregistré : /, ''), true);
        await relireSansEffacer();
        return;
      }
    }
    S.ouverte = null;
    dire('Enregistré.');
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
    if (!cible || etapeId === a.etape_id || cible.type_id !== a.type_id || oppose(a)) return;
    var avant = a.etape_id, avantLe = a.etape_le;
    a.etape_id = etapeId; a.etape_le = new Date().toISOString();
    S.ouverte = a.affaire_id; S.nouvelle = false; S.panneauSale = true;
    S.retour = { affaire: a.affaire_id };
    S.attente = { id: a.affaire_id, avant: avant, avantLe: avantLe, apres: etapeId,
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
  /* M9 (01/10/2026) : l'ecran se recale TOUT DE SUITE sur l'etape d'avant, en memoire.
     Il comptait sur la relecture ; hors ligne elle tombait, et l'avis disait « l'affaire
     reste ou elle etait » sous une pastille qui montrait la nouvelle etape. */
  function annulerSuivante() {
    var at = S.attente;
    if (!at) return;
    clearTimeout(at.minuterie);
    S.attente = null;
    var a = S.affaires.filter(function (x) { return x.affaire_id === at.id; })[0];
    if (a) { a.etape_id = at.avant; a.etape_le = at.avantLe; }
    S.panneauSale = true;
    rendre();
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
        : issue === 'perdue' ? (oppose(a) ? 'Classée. Tu la retrouves dans « Les affaires closes ».'
          : 'Classée. Tu la retrouves dans « Les affaires closes », et tu peux la rouvrir.')
        : 'Rouverte : elle revient dans tes affaires en cours, sans date de rappel. Pense à en poser une.');
    } catch (e) { dire(raison(e), true); await relireSansEffacer(); return; }
    await charger(); rendre();
  }

  /* V6 : « Demain » ou « Dans 7 jours », un appui ecrit le rappel. On ne repeint que
     l'en-tete et le champ de date : des notes en cours de frappe dans le formulaire
     restent ou elles sont. */
  async function reporter(a, jours) {
    var d = new Date(); d.setDate(d.getDate() + jours);
    return reporterAu(a, jourIso(d), jours);
  }
  async function reporterAu(a, iso, jours) {
    if (oppose(a) || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return;
    await viderAttente();
    try {
      var r = await modifier('affaires', 'affaire_id', a.affaire_id, { rappel: iso });
      Object.assign(a, r[0] || { rappel: iso });
      /* X10 (tour 3) : le geste ECRIT tout de suite, et l'avis le dit : « Enregistrer » plein
         en dessous laissait croire que rien n'etait garde. */
      dire(point('Rappel posé ' + (jours === 1 ? 'demain' : 'le ' + dateCourte(iso)) + ' et enregistré' + (a.rappel_titre ? ' : ' + esc(a.rappel_titre) : '')));
    } catch (e) { dire(raison(e), true); await relireSansEffacer(); return; }
    var f = formEdit(a.affaire_id);
    if (f && f.elements.rappel) f.elements.rappel.value = iso;
    await relireSansEffacer();
    var aa = S.affaires.filter(function (x) { return x.affaire_id === a.affaire_id; })[0] || a;
    peindreTete(aa);
    /* le bouton touche vient d'etre repeint par peindreTete : on repose le focus sur celui qui le remplace */
    /* Le rappel pose, l'affaire ne presse plus et les boutons s'en vont : le focus va alors
       au champ de la date, qui dit la nouvelle valeur. Jamais au corps de page. */
    var cible = MOD && ((jours ? MOD.querySelector('[data-aff="reporter"][data-jours="' + jours + '"]') : null)
      || MOD.querySelector('form.aff-edit [name="rappel"]') || MOD.querySelector('.tmod__x'));
    if (cible && cible.focus) { try { cible.focus({ preventScroll: true }); } catch (x) {} }
  }

  async function opposition(a) {
    if (!a.piste_id) return;
    try {
      await modifier('pistes', 'piste_id', a.piste_id, { opposition: true });
      dire('Coordonnées effacées. Le nom reste, pour que personne ne la rappelle.');
    } catch (e) { dire(raison(e), true); }
    await charger(); rendre();
  }

  /* Rend true si tout est parti. Ne relit pas : l'appelant relit une fois pour tous. */
  async function enregistrerType(box) {
    var tid = box.getAttribute('data-type');
    var t = typeDe(tid);
    if (!t) return true;
    var E = champsDe(box);
    var nom = (E.nom.value || '').trim();
    var sommeil = parseInt(E.sommeil.value, 10);
    if (!nom) { direR('Un type d’affaire a besoin d’un nom.', true); return false; }
    if (!(sommeil >= 1 && sommeil <= 365)) { direR('« ' + esc(nom) + ' » : le délai va de 1 à 365 jours.', true); return false; }
    try {
      if (nom !== t.nom || sommeil !== t.sommeil_jours) await modifier('affaire_types', 'type_id', tid, { nom: nom, sommeil_jours: sommeil });
      var ets = etapesDe(tid);
      for (var i = 0; i < ets.length; i++) {
        var n = E['etape_' + ets[i].etape_id];
        var v = n ? n.value.trim() : '';
        if (v && v !== ets[i].nom) await modifier('affaire_etapes', 'etape_id', ets[i].etape_id, { nom: v });
      }
      var ajout = E.ajout ? E.ajout.value.trim() : '';
      if (ajout) {
        var dernier = ets.length ? ets[ets.length - 1].ordre : 0;
        await creer('affaire_etapes', [{ etape_id: uuid(), type_id: tid, nom: ajout, ordre: dernier + 1 }]);
        E.ajout.value = '';
      }
      /* Ce qui est parti n'est plus « tape et pas enregistre » : le repeint ne le reprend pas. */
      [].forEach.call(box.querySelectorAll('input[name]'), function (x) { x.defaultValue = x.value; });
      return true;
    } catch (e) { direR(raison(e), true); return false; }
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
      direR('Étape « ' + esc(e.nom) + ' » retirée' + (dedans.length
        ? ' : ' + pluriel(dedans.length, 'affaire déplacée', 'affaires déplacées') + ' vers « ' + esc(cible.nom) + ' ».' : '.'));
    } catch (x) { direR(raison(x), true); }
    await charger(); rendre();
  }

  async function archiver(tid) {
    var t = typeDe(tid);
    if (!t) return;
    try {
      await modifier('affaire_types', 'type_id', tid, { archive: !t.archive });
      if (!t.archive && S.filtre === tid) S.filtre = '';
      direR(t.archive ? 'Remis en service.' : 'Ce type n’apparaît plus dans tes choix. Ses affaires restent.');
    } catch (e) { direR(raison(e), true); }
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
    /* L'en-tete du panneau (« Je le rappelle : Demain ») vit hors du corps qui porte
       `data-affaire` : il parle de l'affaire ouverte. */
    var id = li ? li.getAttribute('data-affaire') : n.getAttribute('data-id') || (MOD && MOD.contains(n) ? S.ouverte : null);
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
      if (quoi === 'relireClients') { LIGNES.etat = null; demanderLignes(); peindrePropositions(); rafraichirChangements(); return; }
      if (quoi === 'demarrer') {
        var cles = [].slice.call(c.querySelectorAll('input[name="affModele"]:checked')).map(function (x) { return x.value; });
        creerModeles(cles); return;
      }
      if (quoi === 'filtre') { S.filtre = b.getAttribute('data-type') || ''; rendre(); return; }
      if (quoi === 'nouvelle') {
        viderAttente(); S.ouverte = null; S.nouvelle = true; S.choix = null; MOD_CLE = ''; S.retour = { nouvelle: true }; rendre();
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
        viderAvisPanneau();
        S.choix.client = null; S.choix.nouveau = false; S.choix.pisteCreee = null; peindreChoix();
        if (el('affCherche')) el('affCherche').focus();
        return;
      }
      if (quoi === 'rattacher' && a) { rattacher(a, b.getAttribute('data-genre'), b.getAttribute('data-id')); return; }
      if (quoi === 'ouvrir' && a) {
        viderAttente();
        if (S.ouverte === a.affaire_id) { fermerPanneau(); return; }
        S.nouvelle = false; S.choix = null; S.ouverte = a.affaire_id; S.retour = { affaire: a.affaire_id }; rendre();
        return;
      }
      if (quoi === 'suivante' && a) { suivante(a); return; }
      if (quoi === 'reporter' && a) { reporter(a, +b.getAttribute('data-jours') || 1); return; }
      if (quoi === 'reporterDate' && a) {
        var fr = formEdit(a.affaire_id), ch = fr && fr.elements.rappel;
        if (ch) {
          var calmeR = false;
          try { calmeR = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (x) {}
          try { ch.scrollIntoView({ block: 'center', behavior: calmeR ? 'auto' : 'smooth' }); } catch (x) {}
          try { ch.focus({ preventScroll: true }); } catch (x) {}
          try { if (ch.showPicker) ch.showPicker(); } catch (x) {}
        }
        return;
      }
      if (quoi === 'voirFiche' && a) { voirFiche(a); return; }
      if (quoi === 'noterEchange' && a) { noterEchange(a, b); return; }
      if (quoi === 'ecrireClient' && a) { ecrireClient(a); return; }
      /* PLEINE PAGE : « Autre date » et les deux fins menent au formulaire, deplie. */
      if ((quoi === 'pageAutreDate' || quoi === 'pageConclure') && a) {
        var dm = document.querySelector('#pageAffaire details[data-bloc="modifier"]');
        if (dm) dm.open = true;
        var fp = formEdit(a.affaire_id);
        if (!fp) return;
        var calmeP = false;
        try { calmeP = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (x) {}
        if (quoi === 'pageAutreDate') {
          var chp = fp.elements.rappel;
          if (chp) {
            try { chp.scrollIntoView({ block: 'center', behavior: calmeP ? 'auto' : 'smooth' }); } catch (x) {}
            try { chp.focus({ preventScroll: true }); } catch (x) {}
            try { if (chp.showPicker) chp.showPicker(); } catch (x) {}
          }
          return;
        }
        var ch2 = b.getAttribute('data-choix');
        poserConclure(fp, ch2);
        var vp = fp.querySelector('[data-confirme="' + ch2 + '"] [data-aff^="confirmer"]') || fp.querySelector('.aff-conclure');
        if (vp) {
          try { vp.scrollIntoView({ block: 'center', behavior: calmeP ? 'auto' : 'smooth' }); } catch (x) {}
          try { vp.focus({ preventScroll: true }); } catch (x) {}
        }
        return;
      }
      /* X11 : le raccourci de tete porte son propre nom, pour que « [data-aff=devis] » reste
         UN bouton (le vrai, en bas, celui que lisent les bancs et les harnais). */
      if ((quoi === 'devis' || quoi === 'devisRaccourci') && a) { ouvrirDevis(a, null); return; }
      if (quoi === 'devisOuvrir' && a) { ouvrirDevis(a, b.getAttribute('data-devis')); return; }
      if (quoi === 'devisLienCopier') { copierLien(b.getAttribute('data-devis')); return; }
      if (quoi === 'devisLienCreer') { creerLienCarte(b.getAttribute('data-devis')); return; }
      if (quoi === 'friseBasculer') {
        S.friseOuverte = !S.friseOuverte;
        var fr = b.closest('.page-aff__frise');
        if (fr) fr.classList.toggle('page-aff__frise--ouverte', S.friseOuverte);
        b.setAttribute('aria-expanded', S.friseOuverte ? 'true' : 'false');
        var fv = b.querySelector('.page-aff__frise-v'); if (fv) fv.textContent = S.friseOuverte ? 'Masquer' : 'Voir les étapes';
        return;
      }
      /* LOT 67 : le geste de la carte ouvre le devis LA OU il se fait. */
      if (quoi === 'devisAgir' && a) {
        var ac = b.getAttribute('data-action');
        ouvrirDevis(a, b.getAttribute('data-devis'), ac === 'version' ? { action: 'version', version: Number(b.getAttribute('data-version')) } : { action: ac });
        return;
      }
      if (quoi === 'devisClose' && a) {
        var ouvre = !S.closesDevis[a.affaire_id];
        S.closesDevis[a.affaire_id] = ouvre;
        b.setAttribute('aria-expanded', ouvre ? 'true' : 'false');
        var uc = el('affDevisC-' + a.affaire_id);
        if (uc) { uc.hidden = !ouvre; if (ouvre) { uc.innerHTML = htmlListeDevis(a); lireDevis(a); } }
        return;
      }
      if (quoi === 'gagnee' || quoi === 'perdue' || quoi === 'conclureAnnuler') {
        var f = b.closest('form');
        var choix = quoi === 'conclureAnnuler' || b.getAttribute('aria-pressed') === 'true' ? '' : quoi;
        poserConclure(f, choix);
        var vise = choix ? f.querySelector('[data-confirme="' + choix + '"] [data-aff^="confirmer"]')
          : f.querySelector('[data-aff="' + (quoi === 'conclureAnnuler' ? (f.getAttribute('data-conclure-avant') || 'perdue') : quoi) + '"]');
        if (vise) { try { vise.focus(); } catch (x) {} }
        return;
      }
      if (quoi === 'confirmerGagnee' && a) { conclure(a, 'gagnee'); return; }
      if (quoi === 'confirmerPerdue' && a) { conclure(a, 'perdue', b.closest('form').elements.motif.value); return; }
      if (quoi === 'rouvrir' && a) { if (!oppose(a)) conclure(a, 'en_cours'); return; }
      if (quoi === 'opposition' && a) { opposition(a); return; }
      if (quoi === 'classerOppose' && a) { conclure(a, 'perdue', 'autre'); return; }
    });
    c.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = ev.target;
      if (f.id === 'affForme') { creerAffaire(); return; }
      if (f.id === 'affFormeClient') { creerAffaireClient(); return; }
      if (f.classList.contains('aff-edit')) {
        /* W1 : pendant la confirmation, Entree n'enregistre pas par-dessous. */
        if (f.querySelector('.aff-form__pied--retrait')) return;
        var a = affaireDe(f); if (a) enregistrer(a); return;
      }
    });
    /* LE DOUBLON SE DIT A LA FRAPPE : une piste qui porte deja ce nom. On ne
       bloque rien, les homonymes existent ; on le signale. */
    /* « C'EST QUI ? » CHOISIT LE TYPE D'AFFAIRE A SA PLACE, 28/09/2026 : le vigneron
       voyait deux fois la meme question. Un importateur va au type qui parle
       d'import, un caviste ou un restaurant au type qui parle de caviste. Il peut
       toujours changer : on propose, on n'impose rien. */
    c.addEventListener('change', function (ev) {
      if (ev.target.hasAttribute && ev.target.hasAttribute('data-aff-filtre')) {
        S.filtre = ev.target.value || ''; rendre();
        var nf = el('affCorps') && el('affCorps').querySelector('[data-aff-filtre]');
        if (nf) { try { nf.focus({ preventScroll: true }); } catch (x) {} }
        return;
      }
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
      if (ev.target !== li && ev.dataTransfer.setDragImage) {
        var rc = li.getBoundingClientRect();
        try { ev.dataTransfer.setDragImage(li, Math.max(0, ev.clientX - rc.left), Math.max(0, ev.clientY - rc.top)); } catch (x) {}
      }
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
      /* Plusieurs tableaux sur « Toutes » (03/10/2026) : une carte ne change pas de type
         en glissant. La base le refuserait ; on ne le tente pas. */
      var cible = col.getAttribute('data-colonne');
      if (ad && etapesDe(ad.type_id).some(function (x) { return x.etape_id === cible; })) deplacer(ad, cible);
      else if (ad) dire('Une affaire ne change pas de type en glissant : elle reste dans le tableau de son type.');
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

  /* LOT 55 : « Ouvrir le devis » depuis la punaise ou le bandeau d'un devis signe en ligne.
     L'affaire est gagnee : on ouvre directement son devis, pas le panneau de l'affaire. */
  function lireDevisDemande() {
    try {
      var brut = sessionStorage.getItem('bdv_devis_ouvrir');
      if (!brut) return null;
      sessionStorage.removeItem('bdv_devis_ouvrir');
      var o = JSON.parse(brut);
      return o && o.affaire && o.devis ? o : null;
    } catch (e) { return null; }
  }

  async function ouvrir() {
    lireClientPropose();
    var demandee = lireAffaireDemandee();
    var devisDemande = lireDevisDemande();
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
    /* LOT 57 : une affaire CLOSE demandee (une nouvelle « Romane a gagne ... ») ne s'ouvre pas en
       panneau : elle se montre dans « Affaires closes », depliee avec ses devis, et prend le
       focus. Le filtre de type est leve s'il la cachait. */
    var close = demandee && !devisDemande && S.affaires.filter(function (a) { return a.affaire_id === demandee && a.issue !== 'en_cours'; })[0];
    if (close) { if (S.filtre && S.filtre !== close.type_id) S.filtre = ''; S.closesDevis[close.affaire_id] = true; }
    rendre();
    if (close) {
      if (window.BdvAffairesJour && BdvAffairesJour.vuAffaire) BdvAffairesJour.vuAffaire(close.affaire_id);
      var lc = document.querySelector('#affCorps .aff-closes [data-affaire="' + close.affaire_id + '"]');
      if (lc) {
        var dl = lc.closest('details'); if (dl) dl.open = true;
        /* La ligne visee se REPERE parmi les closes (meme dessin que le survol d'une tuile),
           jusqu'au prochain clic. */
        lc.classList.add('aff-ligne--visee');
        setTimeout(function () {
          document.addEventListener('click', function f() { lc.classList.remove('aff-ligne--visee'); document.removeEventListener('click', f, true); }, true);
        }, 0);
        lireDevis(close);
        try { lc.scrollIntoView({ block: 'center' }); } catch (e) {}
        var bc = lc.querySelector('[data-aff="devisClose"]'); if (bc) { try { bc.focus({ preventScroll: true }); } catch (e) {} }
      }
      return;
    }
    if (demandee) S.retour = { affaire: demandee };
    if (devisDemande) {
      var ad = S.affaires.filter(function (x) { return x.affaire_id === devisDemande.affaire; })[0];
      /* M10 : on ne marque le devis signe « vu » qu'une fois ouvert pour de vrai. */
      var okD = ad ? await (lireDevis(ad).then(function () { return ouvrirDevis(ad, devisDemande.devis); })) : false;
      if (okD) { if (window.BdvAffairesJour && BdvAffairesJour.vu) BdvAffairesJour.vu(devisDemande.devis); }
      else if (window.BdvAffairesJour && BdvAffairesJour.pasVu) BdvAffairesJour.pasVu(devisDemande.devis);
      if (!okD && !ad) dire('Le devis n’a pas pu s’ouvrir : son affaire n’a pas été retrouvée. Réessaie dans un instant.', true);
      return;
    }
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
    var dedans = !!(act && c.contains(act));
    rendre();
    var n = cle ? c.querySelector('[data-affaire="' + cle + '"] ' + (geste ? '[data-aff="' + geste + '"]' : 'button, select'))
      : (dedans && geste ? c.querySelector('[data-aff="' + geste + '"]') : null);
    if (n) { try { n.focus(); } catch (e) {} }
  });

  /* ================= LE CLIENT EN DIRECT, 03/10/2026 =================
     Demande de Ted : « si un client est selectionne dans l'affaire on doit pouvoir faire
     facilement des actions commerciales liees au client, pas une copie mais une action sur
     cette base en direct ». Rien n'est recopie dans l'affaire :
     - le numero et l'adresse se LISENT dans `ventes_lignes` (les lignes les plus recentes
       du client, par l'index `ventes_lignes_client`), et passent par `parseTels` /
       `parseEmails` du moteur, les MEMES que la fiche : un lien `tel:` ne compose jamais
       autre chose que ce que l'ecran affiche (regle du 11/09/2026) ;
     - « Noter un echange » ECRIT dans `echanges`, le journal de la fiche : la note se lit
       des deux cotes. Par `echAjouter()` quand le moteur est la (miroir + file de rejeu),
       sinon par `BdvSync.ecrireEchange()` ;
     - « Ecrire » ouvre le redacteur de SA fiche (decision de Ted) ;
     - l'historique se LIT dans `echanges` a chaque ouverture.
     Le rappel reste celui de l'AFFAIRE (decision de Ted) : la fiche garde le sien. */
  var CLI = {};   // par client : { contacts: {tel, affiche, mail} | null, echanges: [] | null, lu: bool }
  function cliDe(a) { var id = clientDe(a); return id ? (CLI[id] || (CLI[id] = { contacts: undefined, echanges: undefined })) : null; }
  function chargerMoteurSeul() {
    if (typeof parseTels === 'function') return Promise.resolve();
    return (window.BdvNav && BdvNav.chargerMoteur) ? BdvNav.chargerMoteur() : Promise.reject(new Error('moteur absent'));
  }
  function lireContacts(id) {
    return Promise.all([
      BdvCompte.api('/ventes_lignes?select=emails,fixe,mobile,pays,le_jour&bureau=eq.' + encodeURIComponent(bureau())
        + '&client_cle=eq.' + encodeURIComponent(id) + '&order=le_jour.desc&limit=20'),
      chargerMoteurSeul()
    ]).then(function (r) {
      var l = Array.isArray(r[0]) ? r[0] : [], tel = null, mail = '';
      for (var i = 0; i < l.length && (!tel || !mail); i++) {
        if (!tel) { var t = parseTels(l[i].mobile, l[i].pays).concat(parseTels(l[i].fixe, l[i].pays)); if (t.length) tel = t[0]; }
        if (!mail) { var m = parseEmails(l[i].emails); if (m.length) mail = m[0]; }
      }
      return { tel: tel ? tel.appel : '', affiche: tel ? tel.affiche : '', mail: mail };
    });
  }
  /* Une lecture ratee vaut `null` : l'ecran le dit, il n'affiche jamais « pas de numero ». */
  function chargerClient(a, apres) {
    var id = clientDe(a), c = cliDe(a);
    if (!id || !pret()) return Promise.resolve();
    var p1 = lireContacts(id).then(function (x) { c.contacts = x; }, function () { c.contacts = null; });
    /* bdv-sync.js arrive AVEC le moteur : sur « A gagner » il n'est pas encore la. */
    var p2 = chargerMoteurSeul().then(function () { return window.BdvSync && BdvSync.lireEchanges ? BdvSync.lireEchanges(id) : Promise.reject(); })
      .then(function (l) { c.echanges = fusionEchanges(id, l); }, function () { c.echanges = null; });
    return Promise.all([p1, p2]).then(function () { if (apres) apres(); });
  }
  /* Ce que le serveur rend, plus ce que cet appareil a ecrit et n'a pas encore pousse. */
  function fusionEchanges(id, l) {
    var vus = {}, out = [];
    (Array.isArray(l) ? l : []).forEach(function (e) { vus[e.echange_id] = 1; out.push(e); });
    try { if (typeof echDe === 'function') echDe(id).forEach(function (e) { if (!vus[e.echange_id]) out.push(e); }); } catch (x) {}
    return out.sort(function (a, b) { return String(b.le).localeCompare(String(a.le)); });
  }
  function libEch(e) {
    try { if (window.BdvCanaux) return BdvCanaux.libelleEntree(e); } catch (x) {}
    return String(e.canal || e.type || 'Note');
  }
  function auteur(e) {
    try { if (e.cree_par && window.BdvCompte && BdvCompte.nomAuteur) return BdvCompte.nomAuteur(e.cree_par); } catch (x) {}
    return '';
  }
  function htmlHistorique(a, max) {
    var c = cliDe(a);
    if (!c) return '';
    if (c.echanges === undefined) return '<p class="aff-aide">Lecture de son historique…</p>';
    if (c.echanges === null) return '<p class="aff-aide">Son historique n’a pas pu être lu. Il reste dans sa fiche.</p>';
    if (!c.echanges.length) return '<p class="aff-aide">Rien de noté pour l’instant. Note ton prochain appel ici : il apparaîtra aussi dans sa fiche.</p>';
    return '<ul class="aff-hist">' + c.echanges.slice(0, max || 5).map(function (e) {
      var qui = auteur(e), r = String(e.resume || '').split('\n')[0];
      return '<li><span class="aff-hist__d">' + esc(dateCourte(String(e.le).slice(0, 10))) + '</span><span><b>' + esc(libEch(e)) + '</b>'
        + (qui ? ' par ' + esc(qui) : '') + (r ? ' : ' + esc(r.length > 160 ? r.slice(0, 157) + '…' : r) : '') + '</span></li>';
    }).join('') + '</ul>' + (c.echanges.length > (max || 5) ? '<p class="aff-aide">Et ' + (c.echanges.length - (max || 5)) + ' de plus dans sa fiche.</p>' : '');
  }
  function htmlNoter(a) {
    if (!clientDe(a)) return '';
    var opts = '';
    try { if (window.BdvCanaux) BdvCanaux.liste.forEach(function (k) { opts += '<option value="' + esc(k.cle) + '"' + (k.cle === 'appel' ? ' selected' : '') + '>' + esc(k.label || k.libelle || k.cle) + '</option>'; }); } catch (x) {}
    return '<details class="aff-noter" data-bloc="noter"><summary>Noter un échange</summary><div class="aff-noter__corps">'
      + (opts ? '<label class="aff-champ"><span>Comment</span><select class="aff-noter__canal">' + opts + '</select></label>' : '')
      + '<label class="aff-champ"><span>Ce qui s’est dit</span><textarea class="aff-noter__txt" rows="3" maxlength="2000"></textarea></label>'
      + '<p><button type="button" class="btn" data-aff="noterEchange">Noter</button></p>'
      + '<p class="aff-aide">Noté aussi dans sa fiche.</p></div></details>';
  }
  function noterEchange(a, bouton) {
    var id = clientDe(a); if (!id) return;
    var bloc = bouton.closest('.aff-noter'), txt = bloc && bloc.querySelector('.aff-noter__txt'), sel = bloc && bloc.querySelector('.aff-noter__canal');
    var t = txt ? txt.value.trim() : '';
    if (!t) { dire('Écris ce qui s’est passé avant de noter.', true); if (txt) txt.focus(); return; }
    var cn = null;
    try { cn = window.BdvCanaux && sel ? BdvCanaux.canal(sel.value) : null; } catch (x) {}
    var type = cn ? cn.type : 'note', canal = cn ? cn.cle : null, e;
    if (typeof echAjouter === 'function') {
      e = echAjouter(id, type, canal, t);
      fini(true);
    } else {
      var q = new Date().toISOString();
      e = { echange_id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8), client_id: String(id), le: q, maj_le: q, type: type, canal: canal, resume: t };
      if (window.BdvCompte && BdvCompte.monId) e.cree_par = BdvCompte.monId();
      (window.BdvSync && BdvSync.ecrireEchange ? BdvSync.ecrireEchange(e) : Promise.resolve(false)).then(fini, function () { fini(false); });
    }
    function fini(ok) {
      if (!ok) { dire('La note n’est pas partie : vérifie ta connexion et réessaie. Ton texte est gardé.', true); return; }
      var c = cliDe(a);
      if (c && Array.isArray(c.echanges) && e) c.echanges.unshift(e);
      if (txt) txt.value = '';
      dire('Noté, aussi dans sa fiche.');
      repeindreClient(a);
    }
  }
  function ecrireClient(a) {
    var id = clientDe(a); if (!id) return;
    if (typeof window.bdvOuvrirFiche !== 'function') { dire('Le rédacteur ne s’ouvre pas d’ici. Ouvre sa fiche dans « Mes clients ».', true); return; }
    viderAttente();
    if (!S.page) fermerPanneau();
    Promise.resolve(window.bdvOuvrirFiche(id, 'message', null, { muet: true })).then(function (ok) {
      if (ok === false) dire(window.bdvOuvrirFiche.motInconnu || 'Sa fiche ne s’ouvre pas d’ici.', true);
      else if (ok === 'panne') dire(window.bdvOuvrirFiche.motPanne || 'Sa fiche n’a pas pu s’ouvrir.', true);
    });
  }
  /* Le panneau ne repeint que sa tete ; la page se repeint entiere (elle garde ce qui est tape). */
  function repeindreClient(a) {
    if (S.page) { rendre(); return; }
    if (MOD && !MOD.hidden && S.ouverte === a.affaire_id) {
      var ouvert = MOD.querySelector('.aff-noter[open]'), txt = ouvert && ouvert.querySelector('.aff-noter__txt');
      var garde = txt ? txt.value : null, hist = !!MOD.querySelector('.amod__hist[open]');
      peindreTete(a);
      if (ouvert) { var n = MOD.querySelector('.aff-noter'); if (n) { n.open = true; var t2 = n.querySelector('.aff-noter__txt'); if (t2 && garde) t2.value = garde; } }
      if (hist) { var h = MOD.querySelector('.amod__hist'); if (h) h.open = true; }
    }
  }
  /* Les contacts d'un client Vitisoft, LUS : « Appeler 06 12 34 56 78 », « Ecrire ». */
  function htmlContactsClient(a, plein) {
    var c = cliDe(a);
    if (!c) return '';
    var l = '';
    if (c.contacts === undefined) l += '<span class="aff-aide">Lecture de son numéro…</span>';
    else if (c.contacts === null) l += '<span class="aff-aide">Son numéro n’a pas pu être lu.</span>';
    else if (c.contacts.tel) l += '<a class="btn' + (plein === 'appeler' ? ' btn--bordeaux' : '') + '" href="tel:' + esc(c.contacts.tel) + '">Appeler le ' + esc(c.contacts.affiche || c.contacts.tel) + '</a>';
    else l += '<span class="aff-aide">Pas de numéro dans tes ventes.</span>';
    l += '<button type="button" class="btn' + (plein === 'ecrire' ? ' btn--bordeaux' : '') + '" data-aff="ecrireClient">Écrire</button>';
    return l;
  }

  /* ================= L'AFFAIRE EN PLEINE PAGE, 03/10/2026 =================
     /mon-bureau/#affaire=<id>, ouverte par « Agrandir » (a cote de la croix du panneau),
     comme la fiche client. Maquette validee par Ted le 03/10/2026, conseil : vigneron
     empathique + expert commercial. Un seul aplat d'accent (le geste qui presse), le seul
     montant est celui d'un devis envoye ou accepte, jamais de total « prevu ».
     Ce n'est PAS une deuxieme fiche client : trois lignes de ses ventes, son historique,
     et « Voir sa fiche complete » qui ouvre la vraie. */
  var PAGE_FICHE = { id: null, f: undefined };
  function fichePage(a) {
    var id = clientDe(a);
    if (!id) return null;
    if (PAGE_FICHE.id === id) return PAGE_FICHE.f;
    PAGE_FICHE = { id: id, f: undefined };
    if (!(window.BdvNav && BdvNav.chargerEcrans)) { PAGE_FICHE.f = null; return null; }
    BdvNav.chargerEcrans().then(function () {
      return typeof assurerLignes === 'function' ? assurerLignes() : null;
    }).then(function () {
      PAGE_FICHE.f = typeof ficheClient === 'function' ? (ficheClient(id) || null) : null;
    }, function () { PAGE_FICHE.f = null; }).then(function () { if (S.page) rendre(); });
    return undefined;
  }
  function devisPrincipal(a) {
    var l = S.devisDe[a.affaire_id];
    if (!Array.isArray(l) || !l.length) return null;
    return l.filter(function (d) { return d.statut === 'accepte'; })[0]
      || l.filter(function (d) { return d.statut === 'envoye'; })[0]
      || l.filter(function (d) { return d.statut === 'enregistre'; })[0] || null;
  }
  function joursDepuis(iso) {
    if (!iso) return null;
    var d = versDate(String(iso).slice(0, 10));
    return d ? Math.round((versDate(jourIso()) - d) / 86400000) : null;
  }
  function jourSemaine(iso) {
    var d = versDate(iso); if (!d) return dateCourte(iso);
    var j = joursDepuis(iso);
    return j != null && j >= 0 && j < 7 ? ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][d.getDay()] : 'le ' + dateCourte(iso);
  }
  /* LE MOMENT : une phrase, et le geste qui presse. Le premier cas qui s'applique gagne
     (ordre arbitre par Ted : un devis signe passe avant un rappel en retard). */
  function moment(a, e) {
    var dv = devisPrincipal(a), c = cliDe(a), piste = a.piste_id && S.pistes[a.piste_id];
    var joindre = (c && c.contacts && c.contacts.tel) || (piste && piste.telephone) ? 'appeler' : 'ecrire';
    if (dv && dv.statut === 'accepte' && dv.signe_le && !dv.commande_telechargee_le)
      return { t: '<b>Signé en ligne le ' + esc(dateCourte(String(dv.signe_le).slice(0, 10))) + '.</b> La commande n’est pas encore dans Vitisoft.', plein: 'devis', devis: dv, mot: 'Télécharger pour Vitisoft', action: 'commande', ton: 'bon' };
    if (e.relancer)
      return { t: (e.retard > 0 ? '<span class="aff-retard">Tu devais le rappeler ' + esc(jourSemaine(a.rappel)) + '</span>' : '<span class="aff-retard">C’est aujourd’hui</span>')
        + (a.rappel_titre ? ', pour ' + esc(minuscule(a.rappel_titre)) : '') + '.', plein: joindre, ton: 'retard' };
    if (dv && dv.statut === 'envoye' && !expireD(dv) && joursDepuis(dv.envoye_le) >= 7)
      return { t: 'Ton devis ' + esc(dv.numero) + ' est parti il y a ' + joursDepuis(dv.envoye_le) + ' jours, sans réponse. Relance-le.', plein: joindre, ton: 'retard' };
    /* LOT 67, arbitre par Ted : un devis expire, on APPELLE d'abord. Sans numero, le geste
       redevient celui du devis (le remettre a date, ou en faire un nouveau). */
    if (dv && expireD(dv)) {
      var sx = suiviDevis(a, dv), tx = telDe(a);
      return { t: 'Ton devis ' + esc(dv.numero) + ' a expiré le ' + esc(dateCourte(dv.valable_jusqu)) + '. ' + (tx ? 'Appelle-le avant de le remettre à date.'
          : sx.geste && sx.geste.action === 'corriger' ? 'Remets-le à date : il deviendra la version ' + ((versionD(dv) || 1) + 1) + ', et l’ancien lien de signature ne marchera plus.' : 'Fais-en un nouveau.'),
        plein: tx ? joindre : 'devis', devis: dv, mot: sx.geste ? sx.geste.mot : 'Ouvrir le devis expiré', action: sx.geste ? sx.geste.action : null, ton: 'retard' };
    }
    if (dv && dv.statut === 'enregistre')
      return { t: 'Ton devis ' + esc(dv.numero) + ' est prêt mais pas encore parti.', plein: 'devis', devis: dv, mot: 'Préparer l’envoi', action: 'envoi', ton: '' };
    if (e.endormie)
      return { t: '<span class="aff-retard">Plus de nouvelles depuis ' + pluriel(e.jours, 'jour', 'jours') + '.</span> Pose-lui un rappel.', plein: 'demain', ton: 'retard' };
    if (a.rappel) return { t: 'Prochain rappel ' + esc(jourSemaine(a.rappel)) + (a.rappel_titre ? ', pour ' + esc(minuscule(a.rappel_titre)) : '') + '.', plein: null, ton: '' };
    return { t: 'Aucun rappel posé. Note quand tu le rappelles.', plein: null, ton: '' };
  }
  function minuscule(s) { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); }
  function htmlGestesPage(a, m) {
    var p = a.piste_id && S.pistes[a.piste_id], l = '';
    if (m.plein === 'devis' && m.devis) l += '<button type="button" class="btn btn--bordeaux" data-aff="' + (m.action ? 'devisAgir' : 'devisOuvrir') + '"'
      + (m.action ? ' data-action="' + m.action + '"' : '') + ' data-devis="' + esc(m.devis.devis_id) + '">' + esc(m.mot) + '</button>';
    if (clientDe(a)) l += htmlContactsClient(a, m.plein);
    else if (p) {
      if (p.telephone) l += '<a class="btn' + (m.plein === 'appeler' ? ' btn--bordeaux' : '') + '" href="tel:' + esc(String(p.telephone).replace(/[^\d+]/g, '')) + '">Appeler le ' + esc(p.telephone) + '</a>';
      if (p.email) l += '<a class="btn' + (m.plein === 'ecrire' && !p.telephone ? ' btn--bordeaux' : '') + '" href="mailto:' + esc(p.email) + '">Écrire</a>';
    }
    /* LOT 67 (vigneron) : le devis vit dans SA carte, « Les devis ». Le haut ne redit plus
       « Ouvrir le devis » ; il propose « Nouveau devis » seulement quand il n'y en a aucun de vivant. */
    var dvE = devisPrincipal(a);
    if (!dvE && a.issue === 'en_cours') l += '<button type="button" class="btn page-aff__devis" data-aff="devisRaccourci">Nouveau devis</button>';
    var report = a.issue === 'en_cours' ? '<span class="page-aff__lib">Je le rappelle :</span>'
      + '<button type="button" class="btn' + (m.plein === 'demain' ? ' btn--bordeaux' : '') + '" data-aff="reporter" data-jours="1">Demain</button>'
      + '<button type="button" class="btn" data-aff="reporter" data-jours="7">Dans 7 jours</button>'
      + '<button type="button" class="btn" data-aff="pageAutreDate">Autre date</button>' : '';
    return '<div class="page-aff__gestes">' + l + '</div>' + (report ? '<div class="page-aff__gestes page-aff__report">' + report + '</div>' : '');
  }
  function htmlFrise(a, e) {
    var et = etapeDe(a.etape_id), liste = etapesDe(a.type_id), suite = etapeSuivante(a);
    /* LOT 68 (arbitre par Ted) : au telephone, la frise se replie en une ligne, « Étape :
       Échantillon envoyé (2 sur 3) » ; le detail se deplie. Les gestes restent visibles. */
    var rang = et ? liste.filter(function (x) { return x.ordre <= et.ordre; }).length : 0;
    var ouverte = !!S.friseOuverte;
    return '<section class="page-aff__frise' + (ouverte ? ' page-aff__frise--ouverte' : '') + '" aria-label="Les étapes">'
      + '<button type="button" class="page-aff__frise-b" data-aff="friseBasculer" aria-expanded="' + (ouverte ? 'true' : 'false') + '" aria-controls="pageAffEtapes">'
      + 'Étape : <b>' + esc(et ? et.nom : 'étape') + '</b>' + (rang ? ' (' + rang + ' sur ' + liste.length + ')' : '')
      + '<span class="page-aff__frise-v">' + (ouverte ? 'Masquer' : 'Voir les étapes') + '</span></button>'
      + '<ol class="page-aff__etapes" id="pageAffEtapes">'
      + liste.map(function (x) {
        var etat = !et ? '' : x.ordre < et.ordre ? 'fait' : x.etape_id === et.etape_id ? 'ici' : '';
        return '<li class="page-aff__et' + (etat ? ' page-aff__et--' + etat : '') + '"' + (etat === 'ici' ? ' aria-current="step"' : '') + '>'
          + '<span class="page-aff__pt" aria-hidden="true">' + (etat === 'fait' ? '✓' : etat === 'ici' ? '●' : '○') + '</span>'
          + esc(x.nom) + (etat === 'fait' ? '<span class="hors-ecran"> (passée)</span>' : '')
          + (etat === 'ici' ? '<small>' + (e.jours === 0 ? 'ici depuis aujourd’hui' : 'ici depuis ' + pluriel(e.jours, 'jour', 'jours')) + '</small>' : '')
          + '</li>';
      }).join('') + '</ol>'
      + (a.issue === 'en_cours' ? '<div class="page-aff__frise-d">' + gesteVers(a, suite, sujet(a), false)
        + '<button type="button" class="btn" data-aff="pageConclure" data-choix="gagnee">Gagnée</button>'
        + '<button type="button" class="btn" data-aff="pageConclure" data-choix="perdue">Pas pour cette fois</button></div>' : '')
      + '</section>';
  }
  /* LOT 67 : plus de gros montant ni de phrase au-dessus de la liste (le vigneron les lisait
     deux fois) : chaque carte dit le sien. TOUS LES DEVIS DE L'AFFAIRE restent visibles (demande
     de Ted, 03/10/2026). */
  function htmlDevisPage(a) {
    var l = S.devisDe[a.affaire_id], h = '';
    if (!Array.isArray(l)) return '<p class="aff-aide">Lecture des devis…</p>';
    if (l.length) h += '<ul class="aff-devis__liste page-aff__devisl" id="affDevisListe">' + htmlListeDevis(a) + '</ul>';
    else h += '<p>Pas encore de devis.</p>';
    if (a.issue === 'en_cours') h += '<p><button type="button" class="' + (devisCourt(a) ? 'aff-devis__lien' : 'btn') + '" data-aff="devis">Nouveau devis</button></p>';
    return h;
  }
  function htmlReperes(a, e) {
    var r = [], t = typeDe(a.type_id);
    if (a.issue === 'en_cours' && !e.endormie) {
      r.push('<div class="page-aff__rep"><span class="page-aff__n">' + (e.jours ? e.jours + ' j' : 'Aujourd’hui') + '</span><span>dans « ' + esc((etapeDe(a.etape_id) || {}).nom || 'étape') + ' »'
        + (e.retard == null && e.sommeil != null ? '. Sans rappel, à relancer dans ' + pluriel(Math.max(0, e.sommeil - e.jours), 'jour', 'jours') + '.' : '.') + '</span></div>');
    }
    var age = joursDepuis(a.ouverte_le || a.cree_le);
    if (age != null) {
      var med = medianeGagnees(a.type_id), cmp = '';
      if (med && age > med.jours) cmp = ' Tes affaires « ' + esc(t ? t.nom : '') + ' » gagnées se concluent en <b>' + pluriel(med.jours, 'jour', 'jours') + '</b> en général (' + med.n + ' gagnées sur 12 mois).';
      r.push('<div class="page-aff__rep"><span class="page-aff__n">' + (age ? age + ' j' : 'Aujourd’hui') + '</span><span>' + (age ? 'depuis l’ouverture.' : 'ouverte aujourd’hui.') + '' + cmp + '</span></div>');
    }
    return r.length ? '<div class="page-aff__reps">' + r.join('') + '</div>' : '';
  }
  var SEUIL_REPERE = 5;   // arbitre par Ted le 03/10/2026 : en dessous, la ligne se tait
  function closesDuType(typeId) {
    var il = new Date(); il.setFullYear(il.getFullYear() - 1);
    var borne = jourIso(il);
    return S.affaires.filter(function (x) { return x.type_id === typeId && x.issue !== 'en_cours' && (jourLocal(x.close_le) || '') >= borne; });
  }
  function medianeGagnees(typeId) {
    var d = closesDuType(typeId).filter(function (x) { return x.issue === 'gagnee' && x.close_le && (x.ouverte_le || x.cree_le); })
      .map(function (x) { return Math.round((new Date(x.close_le) - new Date(x.ouverte_le || x.cree_le)) / 86400000); })
      .filter(function (n) { return n >= 0; }).sort(function (p, q) { return p - q; });
    if (d.length < SEUIL_REPERE) return null;
    var m = d.length % 2 ? d[(d.length - 1) / 2] : Math.round((d[d.length / 2 - 1] + d[d.length / 2]) / 2);
    return { jours: m, n: d.length };
  }
  function htmlPreparer(a) {
    var c = closesDuType(a.type_id), t = typeDe(a.type_id);
    if (c.length < SEUIL_REPERE) return '';
    var g = c.filter(function (x) { return x.issue === 'gagnee'; }).length, cpt = {};
    c.forEach(function (x) { if (x.issue === 'perdue' && x.motif) cpt[x.motif] = (cpt[x.motif] || 0) + 1; });
    var mots = Object.keys(cpt).filter(function (k) { return cpt[k] >= 2; }).sort(function (p, q) { return cpt[q] - cpt[p]; })
      .map(function (k) { var m = MOTIFS.filter(function (x) { return x[0] === k; })[0]; return (m ? m[1].toLowerCase() : k) + ' (' + cpt[k] + ' fois)'; });
    return '<details class="page-aff__bloc" data-bloc="preparer" open><summary class="page-aff__h">Pour préparer ta réponse</summary>'
      + '<p>« ' + esc(t ? t.nom : '') + ' », sur 12 mois : <b>' + g + ' gagnée' + (g > 1 ? 's' : '') + ' sur ' + c.length + '</b>.'
      + (mots.length ? ' Quand tu perds, c’est d’abord : ' + esc(mots.join(', puis ')) + '.' : '') + '</p></details>';
  }
  function htmlDejaDit(a) {
    var id = clientDe(a), pid = a.piste_id;
    var l = S.affaires.filter(function (x) {
      if (x.affaire_id === a.affaire_id) return false;
      return (id && (String(x.client_id) === id || (x.piste_id && S.pistes[x.piste_id] && String(S.pistes[x.piste_id].client_id) === id))) || (pid && x.piste_id === pid);
    });
    if (!l.length) return '';
    return '<section class="page-aff__bloc"><h2 class="page-aff__h">Ce qu’il t’a déjà dit</h2><ul class="aff-hist">' + l.map(function (x) {
      var m = MOTIFS.filter(function (k) { return k[0] === x.motif; })[0];
      var quoi = x.issue === 'gagnee' ? '<b>Gagnée</b> le ' + esc(dateCourte(jourLocal(x.close_le))) + ' : ' + esc(x.titre)
        : x.issue === 'perdue' ? '<b>Pas pour cette fois</b> le ' + esc(dateCourte(jourLocal(x.close_le))) + (m ? ' : ' + esc(m[1].toLowerCase()) : '') + '. ' + esc(x.titre)
        : '<b>En cours aussi</b> : <a class="aff-lien" href="/mon-bureau/#affaire=' + encodeURIComponent(x.affaire_id) + '">' + esc(x.titre) + '</a>';
      return '<li><span>' + quoi + '</span></li>';
    }).join('') + '</ul></section>';
  }
  function htmlAvantAppel(a) {
    var id = clientDe(a);
    if (!id) {
      var p = a.piste_id && S.pistes[a.piste_id];
      if (!p) return '';
      var lignes = [p.contact_nom ? esc(p.contact_nom) + (p.contact_fonction ? ', ' + esc(p.contact_fonction) : '') : '',
        [p.adresse, [p.code_postal, p.ville].filter(Boolean).join(' ')].filter(Boolean).map(esc).join(', '),
        p.siret ? 'SIRET ' + esc(p.siret) : '', p.source ? 'Vient de : ' + esc(p.source) : ''].filter(Boolean);
      return '<section class="page-aff__bloc page-aff__bloc--avant"><h2 class="page-aff__h">Nouveau client, pas encore dans Vitisoft</h2>'
        + (lignes.length ? lignes.map(function (x) { return '<p>' + x + '</p>'; }).join('') : '<p class="aff-aide">Pas encore de coordonnées : complète sa fiche dans « Modifier l’affaire ».</p>')
        + (!p.email ? '<p class="aff-aide">Il manque son e-mail : sans lui, Vitisoft créera un doublon à l’import de la commande.</p>' : '') + '</section>';
    }
    var f = fichePage(a), l = [];
    var mv = motifDe(a);
    if (mv) l.push('<p><b>Ce que disent tes ventes :</b> ' + esc(mv.label) + (mv.enjeu ? ', ' + esc(mv.enjeu) : '') + '.</p>');
    if (f === undefined) l.push('<p class="aff-aide">Lecture de ses ventes…</p>');
    else if (f) {
      if (f.dernier) l.push('<p>Dernière commande le ' + esc(f.dernier.d + '/' + String(f.dernier.m).padStart(2, '0') + '/' + f.dernier.y) + (f.nbCommandes ? ', ' + pluriel(f.nbCommandes, 'commande', 'commandes') + ' en tout' : '') + '.</p>');
      var cuv = (f.cuvees || []).slice(0, 3).map(function (x) { return x[0]; }).filter(Boolean);
      if (cuv.length && f.nbCommandes > 1) l.push('<p>Il prend surtout : <b>' + esc(cuv.join(', ')) + '</b>. ' + (devisPrincipal(a) ? 'Vérifie qu’ils sont dans ton devis.' : 'Mets-les en tête du devis.') + '</p>');
      if (f.cadence && f.nbCommandes > 2 && f.dernier) {
        var pro = new Date(Date.UTC(f.dernier.y, f.dernier.m - 1, f.dernier.d) + Math.round(f.cadence) * 86400000);
        /* Une date attendue deja passee n'est pas une occasion, c'est une alerte. */
        l.push(pro.toISOString().slice(0, 10) >= jourIso()
          ? '<p>Il commande environ tous les ' + Math.round(f.cadence) + ' jours : prochaine commande attendue vers le ' + esc(dateCourte(pro.toISOString().slice(0, 10))) + ' (fin de l’export). Glisse ton offre avec.</p>'
          : '<p>Il commandait environ tous les ' + Math.round(f.cadence) + ' jours, et ton export ne montre rien depuis. <b>Demande-lui ce qui a changé</b> avant de parler de l’affaire. Si ton export est ancien, recharge-le avant d’appeler.</p>');
      }
    } else l.push('<p class="aff-aide">Ses ventes ne sont pas sur cet appareil : sa fiche les montre une fois ton export déposé.</p>');
    return '<section class="page-aff__bloc page-aff__bloc--avant"><h2 class="page-aff__h">Avant de l’appeler</h2>' + l.join('')
      + '<p><a class="aff-vers" href="/mon-bureau/#fiche=' + encodeURIComponent(id) + '" target="_blank" rel="noopener">Voir sa fiche complète<span class="hors-ecran"> (nouvel onglet)</span></a></p></section>';
  }
  function htmlPage(a) {
    var e = etat(a), t = typeDe(a.type_id), et = etapeDe(a.etape_id), m = a.issue === 'en_cours' ? moment(a, e) : null;
    var quoi = a.titre && a.titre !== sujet(a) ? '<span class="page-aff__quoi">' + esc(a.titre) + '</span>' : '';
    var sous = [quoi, 'ouverte le ' + esc(dateCourte(jourLocal(a.ouverte_le || a.cree_le)))]
      .concat(a.maj_le ? ['modifiée le ' + esc(dateCourte(jourLocal(a.maj_le)))] : []).filter(Boolean).join(' · ');
    var clos = a.issue !== 'en_cours' ? '<p class="page-aff__clos">' + (a.issue === 'gagnee' ? 'Affaire gagnée' : 'Pas pour cette fois') + ' le ' + esc(dateCourte(jourLocal(a.close_le))) + '.</p>' : '';
    return '<div class="page-aff" data-affaire="' + a.affaire_id + '">'
      + '<p><a class="page-aff__retour" href="/mon-bureau/#affaires">Retour à Mon commerce</a></p>'
      + '<header class="page-aff__tete"><p class="page-aff__marques"><span class="page-aff__etape">Étape : <b>' + esc(et ? et.nom : 'étape') + '</b></span>'
      + (t ? '<span>' + esc(t.nom) + '</span>' : '') + (estNouveau(a) ? marqueNouveau() : '') + '</p>'
      + '<h1 class="page-aff__nom" id="pageAffTitre">' + esc(sujet(a)) + '</h1><p class="page-aff__sous">' + sous + '</p>' + clos + '</header>'
      + (m ? '<section class="page-aff__moment' + (m.ton ? ' page-aff__moment--' + m.ton : '') + '"><p class="page-aff__phrase">' + m.t + '</p>' + htmlGestesPage(a, m) + '</section>' : '')
      + htmlFrise(a, e)
      + '<div class="page-aff__grille"><div class="page-aff__col">'
      + '<section class="page-aff__bloc page-aff__bloc--devis' + (devisAttend(a) ? ' page-aff__bloc--presse' : '') + '"><h2 class="page-aff__h">Les devis</h2>' + htmlDevisPage(a) + '</section>'
      /* Arbitre par Ted : « Repères » ne parait qu'a partir de 5 affaires closes du type. */
      + (a.issue === 'en_cours' && closesDuType(a.type_id).length >= SEUIL_REPERE ? '<section class="page-aff__bloc"><h2 class="page-aff__h">Repères</h2>' + htmlReperes(a, e) + '</section>' : '')
      + '<section class="page-aff__bloc"><h2 class="page-aff__h"><label for="pageAffNotes">Notes</label></h2>'
      + '<textarea id="pageAffNotes" class="page-aff__notes" rows="3" maxlength="2000">' + esc(a.notes || '') + '</textarea>'
      + '<p class="aff-aide" id="pageAffNotesMot" aria-live="polite">Enregistrées quand tu quittes le champ.</p></section>'
      + '<details class="page-aff__bloc page-aff__modif" data-bloc="modifier"><summary class="page-aff__h">Modifier l’affaire</summary>' + htmlEditeur(a) + '</details>'
      + '</div><div class="page-aff__col">'
      + htmlAvantAppel(a)
      + (clientDe(a) ? '<section class="page-aff__bloc page-aff__bloc--hist"><h2 class="page-aff__h">Son historique</h2><p class="aff-aide">Le même journal que sa fiche : ce que tu notes ici s’y retrouve, et l’inverse.</p>'
        + htmlHistorique(a, 8) + htmlNoter(a) + '</section>' : '')
      + htmlDejaDit(a) + htmlPreparer(a)
      + '</div></div></div>';
  }
  function peindrePage() {
    var box = el('pageAffCorps');
    if (!box) return;
    if (!S.charge) { box.innerHTML = '<p class="aff-vide">' + (S.erreur ? 'L’affaire n’a pas pu être lue. Recharge la page.' : 'Ouverture de l’affaire…') + '</p>'; return; }
    var a = S.affaires.filter(function (x) { return x.affaire_id === S.page; })[0];
    if (!a) { box.innerHTML = '<p class="aff-vide">Cette affaire n’existe pas dans ton bureau. <a href="/mon-bureau/#affaires">Retour à Mon commerce</a></p>'; return; }
    if (window.BdvAffairesJour && BdvAffairesJour.vuAffaire) BdvAffairesJour.vuAffaire(a.affaire_id);
    /* REPEINDRE NE PERD RIEN : les notes en cours de frappe, la note d'echange, les blocs
       ouverts, le focus et l'endroit ou l'on est dans la page. */
    var garde = {}, act = document.activeElement;
    var n0 = el('pageAffNotes'); if (n0 && n0.getAttribute('data-sale')) garde.notes = n0.value;
    var t0 = box.querySelector('.aff-noter__txt'); if (t0 && t0.value) garde.noter = t0.value;
    var ouverts = [].map.call(box.querySelectorAll('details[data-bloc][open]'), function (d) { return d.getAttribute('data-bloc'); });
    var fermes = [].map.call(box.querySelectorAll('details[data-bloc]:not([open])'), function (d) { return d.getAttribute('data-bloc'); });
    var focusSel = act && box.contains(act) ? (act.id ? '#' + act.id : act.getAttribute('data-aff') ? '[data-aff="' + act.getAttribute('data-aff') + '"]' + (act.getAttribute('data-jours') ? '[data-jours="' + act.getAttribute('data-jours') + '"]' : '') : null) : null;
    var y = window.scrollY;
    box.innerHTML = htmlPage(a);
    document.title = sujet(a) + ' · Mon commerce';
    [].forEach.call(box.querySelectorAll('details[data-bloc]'), function (d) {
      var k = d.getAttribute('data-bloc');
      if (ouverts.indexOf(k) >= 0) d.open = true; else if (fermes.indexOf(k) >= 0) d.open = false;
    });
    var n1 = el('pageAffNotes'); if (n1 && garde.notes != null) { n1.value = garde.notes; n1.setAttribute('data-sale', '1'); }
    var t1 = box.querySelector('.aff-noter__txt'); if (t1 && garde.noter) { t1.value = garde.noter; t1.closest('details').open = true; }
    var f = formEdit(a.affaire_id); if (f && f.elements.notes && n1) f.elements.notes.value = n1.value;
    if (focusSel) { var nf = box.querySelector(focusSel); if (nf) { try { nf.focus({ preventScroll: true }); } catch (x) {} } }
    window.scrollTo(0, y);
  }
  /* Les notes s'enregistrent en quittant le champ (arbitre par Ted le 03/10/2026), et
     le DISENT. Le champ « Notes » de « Modifier l'affaire » suit, sans quoi son
     « Enregistrer » remettrait l'ancien texte par-dessus. */
  function notesPage(champ) {
    var a = S.affaires.filter(function (x) { return x.affaire_id === S.page; })[0];
    if (!a || !champ.getAttribute('data-sale')) return;
    var v = champ.value.trim() || null, mot = el('pageAffNotesMot');
    if (mot) mot.textContent = 'Enregistrement…';
    modifier('affaires', 'affaire_id', a.affaire_id, { notes: v }).then(function (r) {
      Object.assign(a, (r && r[0]) || { notes: v });
      champ.removeAttribute('data-sale');
      var d = new Date();
      if (mot) mot.textContent = 'Enregistrées à ' + d.getHours() + ' h ' + String(d.getMinutes()).padStart(2, '0') + '.';
    }, function (e) { if (mot) mot.textContent = 'Pas enregistrées : ' + raison(e) + ' Ton texte est gardé.'; });
  }
  async function page(id) {
    S.page = id;
    var root = el('pageAffaire');
    if (!root) {
      root = document.createElement('main');
      root.id = 'pageAffaire';
      root.className = 'page-aff__racine';
      root.setAttribute('aria-labelledby', 'pageAffTitre');
      root.innerHTML = '<div id="pageAffCorps"></div>';
      /* L'avis de la piece (« Annuler », les erreurs) est DEPLACE ici, pas recopie : deux
         #affAvis, et `el()` ecrirait dans celui qu'on ne voit pas. */
      var av = el('affAvis');
      if (!av) { av = document.createElement('p'); av.className = 'aff-avis'; av.id = 'affAvis'; av.setAttribute('role', 'status'); av.setAttribute('aria-live', 'polite'); av.hidden = true; }
      root.insertBefore(av, root.firstChild);
      document.body.appendChild(root);
      brancherSur(root);
      ecouteursUniques();
      root.addEventListener('input', function (ev) {
        if (ev.target.id !== 'pageAffNotes') return;
        ev.target.setAttribute('data-sale', '1');
        var f = formEdit(S.page); if (f && f.elements.notes) f.elements.notes.value = ev.target.value;
      });
      root.addEventListener('focusout', function (ev) { if (ev.target.id === 'pageAffNotes') notesPage(ev.target); });
      window.addEventListener('beforeunload', function (ev) {
        var n = el('pageAffNotes'); if (n && n.getAttribute('data-sale')) { ev.preventDefault(); ev.returnValue = ''; }
      });
      /* La fiche du client (« Ecrire ») s'ouvre par-dessus la page : en la refermant, on
         relit son historique, ou le mail « considere comme envoye » vient d'arriver. */
      var mod = el('modale');
      if (mod && window.MutationObserver) new MutationObserver(function () {
        if (mod.classList.contains('on')) return;
        var a = S.affaires.filter(function (x) { return x.affaire_id === S.page; })[0];
        if (a && clientDe(a)) chargerClient(a, rendre);
      }).observe(mod, { attributes: true, attributeFilter: ['class'] });
    }
    rendre();
    if (!pret()) { dire('Ton bureau n’est pas encore raccordé. Recharge la page dans un instant.', true); return false; }
    await charger();
    var a = S.affaires.filter(function (x) { return x.affaire_id === id; })[0];
    rendre();
    if (!a) return !!S.charge;   // « Cette affaire n'existe pas » est deja a l'ecran
    lireDevis(a).then(function () { rendre(); });
    chargerClient(a, rendre);
    return true;
  }

  window.BdvAffaires = { ouvrir: ouvrir, etat: etat, page: page, _moment: moment, _listeDevis: htmlListeDevis, _devisAttend: devisAttend,
    reglages: { ouvrir: ouvrirReglages, enregistrer: enregistrerReglages }, _S: S, _chargerDevis: chargerDevis, MODELES: MODELES, _nomsProches: nomsProches, _nomPropose: nomPropose, _htmlCloses: htmlCloses, _deplacer: function (id, e) {
    var a = S.affaires.filter(function (x) { return x.affaire_id === id; })[0]; if (a) deplacer(a, e); } };
})();
