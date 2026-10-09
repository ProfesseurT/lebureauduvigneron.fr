/* ==========================================================================
   « MES CLIENTS », L'ANNUAIRE DU BUREAU, 24/09/2026
   ==========================================================================
   Demande de Ted : « j'ai un paquet de donnees sur les clients, mais pas de base
   Mes clients qui me permettrait de faire des listings ». Quatre lots dans un
   seul fichier, parce qu'ils lisent et ecrivent la meme chose :

     lot 2  la liste : recherche, filtres, tri, export ;
     lot 3  les etiquettes communes et les vues enregistrees ;
     lot 4  la selection multiple et le proprietaire d'un client.
     (le lot 1, la fiche en pleine page, vit dans bdv-ecrans.js et mon-bureau.njk)

   CE QUE CETTE PIECE N'EST PAS, ET IL FAUT LE SAVOIR AVANT DE LUI AJOUTER UN BLOC.
   « Mon commerce » repond a « qui dois-je relancer », et c'est une liste de TRI.
   Celle-ci repond a « qui sont mes clients », c'est un ANNUAIRE. Les deux ouvrent
   la MEME fiche. Un verdict, un conseil ou un bloc de relance pose ici referait
   « Mon commerce » a cote de lui-meme (regle « une piece repond a UNE question »).

   LES TROIS DECISIONS DE TED QUI COMMANDENT CE FICHIER :
     1. VITISOFT FAIT FOI sur les coordonnees : on les LIT, on ne les modifie pas.
        Aucune ecriture de nom, de ville ou de telephone ne part d'ici.
     2. LES CLIENTS DES EXPORTS, PLUS LES NOUVEAUX CLIENTS (amende le 08/10/2026, lot 81,
        decision de Ted) : la liste se CALCULE sur les lignes de vente, et y ajoute les
        `pistes` pas encore reliees a Vitisoft, marquees « Pas encore dans Vitisoft ».
        « Nouveau client » en cree une. Leurs coordonnees se corrigent sur leur fiche,
        pas ici, et Vitisoft reprend la main a leur premiere facture.
     3. TOUT LE BUREAU ECRIT, ET ON NOMME QUI A FAIT L'ACTION (lot 33 du SQL).

   LA SELECTION NE POSE PAS DE RAPPELS, et c'est une regle de Ted du 11/09/2026 :
   c'est la NOTE qui pose la trace d'un appel. Un rappel groupe serait pose sans
   note. La selection sert a exporter, etiqueter et attribuer, rien d'autre.

   ELLE SE CALCULE SUR LES LIGNES DE CET APPAREIL (ECRANS_TOUT_LOCAL) et pas sur un
   resume serveur. Ce n'est pas un oubli : chaque ligne de cette liste mene a une
   fiche, et la fiche a besoin des lignes. Les charger une fois sert donc aux deux.
   Et le calcul local marche MEME SANS CLASSEMENT VALIDE, la ou les trois resumes
   serveur rendent `null` (lot 31) : un annuaire vide parce qu'un reglage manque
   aurait ete le pire des trois etats.

   LE LOT 33 PEUT NE PAS ETRE PASSE. Tant que Ted n'a pas colle le SQL, la liste, la
   recherche, les filtres, le tri, l'export et les etiquettes marchent ; seuls
   l'attribution et les vues attendent, et l'ecran le DIT au lieu de cacher le bouton
   (regle « un etat degrade se dit la ou son prix se paie »).
   ========================================================================== */
(function(){
  'use strict';

  const PAS = 100;                 // lignes peintes par tranche : 1 936 clients d'un coup font une page lente
  const LOT_ENVOI = 200;           // fiches par ecriture groupee
  const DORMANT_J = 365;           // au-dela d'un an sans commande, un client est dormant

  const ETAT_VIDE = { q:'', canal:'', type:'', pays:'', etat:'', rappel:'', tag:'', proprio:'', tri:'der', sens:-1 };
  const NATURES = [['caviste', 'Caviste'], ['restaurant', 'Restaurant'], ['importateur', 'Importateur'], ['ce', 'CE, entreprise'], ['particulier', 'Particulier'], ['autre', 'Autre']];
  function libNature(n){ const x = NATURES.filter(function(y){ return y[0] === n; })[0]; return x && n !== 'autre' ? x[1] : ''; }
  const NV = function(){ return window.bdvNouveaux || null; };
  let ETAT = Object.assign({}, ETAT_VIDE);
  let MONTRES = PAS;
  let LISTE = [];                  // tous les clients, calcules une fois par peinture
  let FILTREE = [];                // ce que les filtres laissent passer, dans l'ordre du tri
  let EX_CUR = null, EX_PREV = null, JOUR_MAX = 0;
  const SEL = new Set();
  let VUES = null;                 // null = pas lues, [] = aucune, false = indisponibles
  let LOT33 = null;
  let TROMBI = null;
  let BRANCHE = false;

  const P = function(){ return document.getElementById('p-annuaire'); };
  const aujourdhui = function(){ return Math.floor(Date.now() / 86400000); };
  const encId = function(id){ return encodeURIComponent(String(id)); };

  /* ------------------------------------------------------------------ calcul */
  function plusFrequent(m){
    let best = '', n = -1;
    Object.keys(m).forEach(function(k){ if(m[k] > n){ n = m[k]; best = k; } });
    return best;
  }

  function construire(){
    const ex = (typeof META !== 'undefined' && META && META.exercices) ? META.exercices : [];
    EX_CUR = ex.length ? ex[ex.length - 1] : null;
    EX_PREV = ex.indexOf(EX_CUR - 1) >= 0 ? EX_CUR - 1 : null;
    JOUR_MAX = 0;
    const m = new Map();
    (ROWS || []).forEach(function(r){
      if(r._dayNum != null && r._dayNum > JOUR_MAX) JOUR_MAX = r._dayNum;
      const id = clientKey(r);
      let c = m.get(id);
      if(!c){
        c = { id: id, num: String(r.numClient || ''), nom: '', ville: '', cp: '', pays: '',
              _vu: -1, canaux: {}, types: {}, fact: new Set(), ca: 0, caPrev: 0, der: null };
        m.set(id, c);
      }
      /* LES COORDONNEES DE LA LIGNE LA PLUS RECENTE, et pas de la premiere lue : un client
         qui a demenage ou corrige son nom dans Vitisoft doit apparaitre sous son nom
         d'aujourd'hui. Une valeur vide ne remplace jamais une valeur pleine. */
      const j = r._dayNum == null ? -1 : r._dayNum;
      if(j >= c._vu){
        c._vu = j;
        if(r.client) c.nom = String(r.client).trim();
        if(r.ville) c.ville = String(r.ville).trim();
        if(r.cp) c.cp = String(r.cp).trim();
        if(r.pays) c.pays = String(r.pays).trim();
      }
      if(!r._vin) return;
      const t = Number(r._total) || 0;
      if(EX_CUR != null && r._exY === EX_CUR) c.ca += t;
      if(EX_PREV != null && r._exY === EX_PREV) c.caPrev += t;
      if(r.numFacture) c.fact.add(String(r.numFacture));
      if(r._canal) c.canaux[r._canal] = (c.canaux[r._canal] || 0) + 1;
      if(r._typeClient) c.types[r._typeClient] = (c.types[r._typeClient] || 0) + 1;
      if(r._dayNum != null && (c.der == null || r._dayNum > c.der)){ c.der = r._dayNum; c.derDate = r._date; }
    });
    /* LES NOUVEAUX CLIENTS, 08/10/2026 (lot 81) : une piste pas encore reliee a Vitisoft.
       Ni commandes ni chiffre : ils trient en fin de liste sur la derniere commande. */
    const nv = NV();
    (nv ? nv.liste() : []).forEach(function(p){
      const id = 'p:' + p.piste_id;
      if(m.has(id)) return;
      m.set(id, { id: id, num: '', nom: String(p.nom || '').trim(), ville: p.ville || '', cp: p.code_postal || '', pays: p.pays || '',
        _vu: -1, canaux: {}, types: {}, fact: new Set(), ca: 0, caPrev: 0, der: null,
        nouveau: true, opposition: !!p.opposition, nature: libNature(p.nature), siret: p.siret || '',
        mails: p.email ? [String(p.email)] : [], tel: p.telephone ? String(p.telephone) : '' });
    });
    LISTE = Array.from(m.values()).map(function(c){
      c.nom = c.nom || c.id;
      c.canal = plusFrequent(c.canaux);
      c.type = plusFrequent(c.types);
      c.cmd = c.fact.size;
      c.silence = c.der == null ? null : JOUR_MAX - c.der;
      c.etat = c.nouveau ? 'nouveau' : (c.der == null ? 'sans' : (c.silence <= DORMANT_J ? 'actif' : 'dormant'));
      if(c.nouveau) c.type = c.nature || '';
      c.cle = norm([c.nom, c.num, c.ville, c.cp, c.siret || ''].join(' '));
      delete c.fact; delete c.canaux; delete c.types; delete c._vu;
      return c;
    });
  }

  /* Ce qui vient du SUIVI se relit a chaque rendu, jamais dans `construire()` : une
     etiquette posee ou un rappel pose depuis la fiche doit se voir tout de suite, sans
     recalculer 171 569 lignes. */
  function suivi(id){ return (typeof CRM !== 'undefined' && CRM[id]) || {}; }
  function etatRappel(s){
    if(!s.rappel || s.statut === 'traite') return 'aucun';
    const j = jourDepuisISO(s.rappel);
    return (j != null && j < aujourdhui()) ? 'retard' : 'prevu';
  }
  function moi(){ return (window.BdvCompte && BdvCompte.monId) ? BdvCompte.monId() : null; }
  function nomDe(uid){
    if(!uid) return '';
    if(uid === moi()) return 'Moi';
    return (TROMBI && TROMBI.gens && TROMBI.gens[uid]) || 'ancien membre';
  }
  /* LES ETIQUETTES DU BUREAU, avec le nombre de clients qui les portent, les plus
     utilisees d'abord : c'est l'ordre dans lequel la fiche les propose. */
  function etiquettes(){
    const m = new Map();
    Object.keys(typeof CRM !== 'undefined' ? CRM : {}).forEach(function(id){
      (CRM[id].tags || []).forEach(function(t){ m.set(t, (m.get(t) || 0) + 1); });
    });
    return Array.from(m, function(x){ return { t: x[0], n: x[1] }; })
      .sort(function(a, b){ return b.n - a.n || a.t.localeCompare(b.t, 'fr'); });
  }
  function porteurs(tag){
    return Object.keys(typeof CRM !== 'undefined' ? CRM : {}).filter(function(id){ return (CRM[id].tags || []).indexOf(tag) >= 0; });
  }
  function toutesLesEtiquettes(){
    const s = new Set();
    Object.keys(typeof CRM !== 'undefined' ? CRM : {}).forEach(function(id){ (CRM[id].tags || []).forEach(function(t){ s.add(t); }); });
    return Array.from(s).sort(function(a, b){ return a.localeCompare(b, 'fr'); });
  }
  function valeursDe(cle){
    const s = new Set();
    LISTE.forEach(function(c){ if(c[cle]) s.add(c[cle]); });
    return Array.from(s).sort(function(a, b){ return a.localeCompare(b, 'fr'); });
  }

  function passe(c){
    const e = ETAT, s = suivi(c.id);
    if(e.q){
      const q = norm(e.q);
      if(c.cle.indexOf(q) < 0){
        const mails = (c.nouveau ? c.mails : (emailsOf(c.id) || [])).join(' ').toLowerCase();
        const chiffres = q.replace(/\D/g, '');
        const tels = c.nouveau ? String(c.tel || '').replace(/\D/g, '')
          : (telsOf(c.id) || []).map(function(t){ return String(t.appel || '').replace(/\D/g, ''); }).join(' ');
        if(mails.indexOf(q) < 0 && !(chiffres.length >= 4 && tels.indexOf(chiffres) >= 0)) return false;
      }
    }
    if(e.canal && c.canal !== e.canal) return false;
    if(e.type && c.type !== e.type) return false;
    if(e.pays && c.pays !== e.pays) return false;
    if(e.etat && c.etat !== e.etat) return false;
    if(e.rappel && etatRappel(s) !== e.rappel) return false;
    if(e.tag && !(s.tags || []).some(function(t){ return t.toLowerCase() === e.tag.toLowerCase(); })) return false;
    if(e.proprio){
      const p = s.proprietaire || '';
      if(e.proprio === 'moi' ? p !== moi() : e.proprio === 'personne' ? !!p : p !== e.proprio) return false;
    }
    return true;
  }

  const TRIS = {
    nom:    function(c){ return c.nom.toLowerCase(); },
    ville:  function(c){ return (c.ville || '').toLowerCase(); },
    der:    function(c){ return c.der == null ? -1 : c.der; },
    cmd:    function(c){ return c.cmd; },
    ca:     function(c){ return c.ca; },
    caPrev: function(c){ return c.caPrev; },
    rappel: function(c){ const s = suivi(c.id); const j = s.rappel ? jourDepuisISO(s.rappel) : null; return j == null ? Infinity : j; }
  };
  function filtrer(){
    const f = TRIS[ETAT.tri] || TRIS.der, sens = ETAT.sens || -1;
    FILTREE = LISTE.filter(passe).sort(function(a, b){
      const x = f(a), y = f(b);
      if(x < y) return -sens; if(x > y) return sens;
      return a.nom.localeCompare(b.nom, 'fr');
    });
  }

  /* ------------------------------------------------------------------ dessin */
  function options(liste, choisi, tout){
    return '<option value="">' + esc(tout) + '</option>' + liste.map(function(v){
      const val = Array.isArray(v) ? v[0] : v, lib = Array.isArray(v) ? v[1] : v;
      return '<option value="' + esc(val) + '"' + (val === choisi ? ' selected' : '') + '>' + esc(lib) + '</option>';
    }).join('');
  }
  function libEx(y){
    if(y == null) return '';
    return (typeof EX_START !== 'undefined' && EX_START > 1) ? y + '-' + String(y + 1).slice(2) : String(y);
  }
  const COLONNES = [
    ['nom', 'Client'], ['canal', 'Canal', true], ['der', 'Dernière commande'], ['cmd', 'Commandes', false, 'num'],
    ['ca', 'CA', false, 'num'], ['caPrev', 'CA précédent', false, 'num'], ['rappel', 'Prochaine action'],
    ['tags', 'Étiquettes', true], ['proprio', 'Suivi par', true]
  ];
  function entete(){
    const tri = ETAT.tri, sens = ETAT.sens;
    return '<tr><th class="annu__coche"><input type="checkbox" data-a="tout" aria-label="Sélectionner toute la liste filtrée"></th>'
      + COLONNES.map(function(col){
          const cle = col[0];
          let lib = col[1];
          if(cle === 'ca') lib = 'CA ' + libEx(EX_CUR);
          if(cle === 'caPrev') lib = 'CA ' + libEx(EX_PREV);
          if(cle === 'caPrev' && EX_PREV == null) return '';
          if(cle === 'proprio' && !proprioVisible()) return '';
          const cls = col[3] === 'num' ? ' class="num"' : '';
          if(col[2]) return '<th' + cls + ' scope="col">' + esc(lib) + '</th>';
          const as = tri === cle ? (sens > 0 ? 'ascending' : 'descending') : 'none';
          return '<th' + cls + ' scope="col" aria-sort="' + as + '"><button type="button" class="annu__tri" data-a="tri" data-cle="' + cle + '">'
            + esc(lib) + '<span class="annu__fl" aria-hidden="true">' + (tri === cle ? (sens > 0 ? '▲' : '▼') : '') + '</span></button></th>';
        }).join('') + '</tr>';
  }
  function proprioVisible(){ return LOT33 === true && TROMBI && TROMBI.combien > 1; }

  function ligne(c){
    const s = suivi(c.id), er = etatRappel(s), coche = SEL.has(c.id);
    const sous = [c.num && c.num !== c.nom ? 'n°' + c.num : '', c.nature || '', [c.cp, c.ville].filter(Boolean).join(' '), c.pays && !/^france$/i.test(c.pays) ? c.pays : '']
      .filter(Boolean).join(' · ');
    const marque = (c.nouveau ? ' <span class="aff-marque aff-marque--nouveau">Pas encore dans Vitisoft</span>' : '')
      + (c.opposition ? ' <span class="aff-marque aff-marque--opposee">Ne veut plus être contacté</span>' : '')
      /* Lot 90 : adresse morte, desinscrite, spam (bdv-retours.js). */
      + (window.BdvRetours ? BdvRetours.marqueListe(c.nouveau ? c.mails : (typeof emailsOf === 'function' ? emailsOf(c.id) || [] : [])) : '');
    let action = '<span class="annu__vide">—</span>';
    if(s.statut === 'traite') action = '<span class="annu__vide">Mis de côté</span>';
    else if(s.rappel) action = '<span class="annu__rap' + (er === 'retard' ? ' annu__rap--retard' : '') + '">'
      + (er === 'retard' ? '<span class="hors-ecran">En retard : </span>' : '') + esc(fmtDateIso(s.rappel)) + '</span>'
      + (s.rappel_titre ? '<span class="annu__motif">' + esc(s.rappel_titre) + '</span>' : '');
    /* Un nouveau client n'a pas de chiffre : sa case reste vide (« aucune vente » pour qui
       ecoute), plutot qu'un tiret de plus sur une ligne qui dit deja « pas encore ». */
    const rien = c.nouveau ? '<span class="hors-ecran">aucune vente</span>' : '<span class="annu__vide">—</span>';
    const ca = c.ca ? fmtMoney(c.ca) : rien;
    const caP = c.caPrev ? fmtMoney(c.caPrev) : rien;
    const der = c.derDate ? fmtDate(c.derDate) + (c.etat === 'dormant' ? ' <span class="annu__dormant">dormant</span>' : '') : '<span class="annu__vide">' + (c.nouveau ? 'pas encore' : 'aucune') + '</span>';
    return '<tr class="annu__l' + (coche ? ' is-coche' : '') + '" data-id="' + esc(c.id) + '">'
      + '<td class="annu__coche"><input type="checkbox" data-a="coche"' + (coche ? ' checked' : '') + ' aria-label="Sélectionner ' + esc(c.nom) + '"></td>'
      + '<td><a class="annu__nom" href="/mon-bureau/#fiche=' + esc(encId(c.id)) + '">' + esc(c.nom) + '</a>' + marque
      + (sous ? '<span class="annu__sous">' + esc(sous) + '</span>' : '') + '</td>'
      + '<td>' + esc(c.canal || '') + '</td>'
      + '<td>' + der + '</td>'
      + '<td class="num">' + (c.nouveau ? '<span class="hors-ecran">aucune</span>' : fmtNum(c.cmd)) + '</td>'
      + '<td class="num">' + ca + '</td>'
      + (EX_PREV != null ? '<td class="num">' + caP + '</td>' : '')
      + '<td>' + action + '</td>'
      + '<td>' + (s.tags || []).map(function(t){ return '<button type="button" class="annu__tag" data-a="tag-filtre" data-t="' + esc(t) + '" title="Ne montrer que les clients « ' + esc(t) + ' »">' + esc(t) + '</button>'; }).join('') + '</td>'
      + (proprioVisible() ? '<td>' + esc(nomDe(s.proprietaire)) + '</td>' : '')
      + '</tr>';
  }

  function barreDesVues(){
    /* Rien tant que la table n'existe pas (SQL du lot 33) : on ne promet pas une
       fonction qui n'est pas encore la. Arbitrage de Ted, 25/09/2026. */
    if(VUES === false) return '';
    const liste = (VUES || []).map(function(v){ return [v.vue_id, v.nom]; });
    return '<label class="annu__lbl" for="annuVue">Vue</label>'
      + '<select id="annuVue" data-a="vue">' + options(liste, '', liste.length ? 'Choisir une vue enregistrée' : 'Aucune vue enregistrée') + '</select>'
      /* Cache tant qu'aucune vue n'est choisie : « Supprimer cette vue » a cote d'une liste
         qui dit « Choisir une vue » ne dit pas laquelle il supprimerait. */
      + '<button type="button" class="btn btn--ghost btn--sm" data-a="vue-suppr" hidden>Supprimer cette vue</button>'
      + '<span class="annu__sep" aria-hidden="true"></span>'
      + '<label class="annu__lbl" for="annuVueNom">Enregistrer les filtres sous</label>'
      + '<input id="annuVueNom" type="text" maxlength="60" placeholder="CHR dormants en Loire">'
      + '<button type="button" class="btn btn--ghost btn--sm" data-a="vue-enr">Enregistrer</button>';
  }

  function barreDesFiltres(){
    const e = ETAT;
    const proprios = [['moi', 'Moi'], ['personne', 'Personne']].concat(
      TROMBI && TROMBI.gens ? Object.keys(TROMBI.gens).filter(function(u){ return u !== moi(); })
        .map(function(u){ return [u, TROMBI.gens[u]]; }) : []);
    return '<select data-f="canal" aria-label="Canal">' + options(valeursDe('canal'), e.canal, 'Tous les canaux') + '</select>'
      + '<select data-f="type" aria-label="Typologie">' + options(valeursDe('type').filter(function(t){ return t !== 'Non typé'; }), e.type, 'Toutes les typologies') + '</select>'
      + '<select data-f="pays" aria-label="Pays">' + options(valeursDe('pays'), e.pays, 'Tous les pays') + '</select>'
      + '<select data-f="etat" aria-label="Activité">' + options([['actif', 'Actifs (commande depuis moins d’un an)'], ['dormant', 'Dormants (rien depuis plus d’un an)'], ['sans', 'Sans commande']]
          .concat(LISTE.some(function(c){ return c.nouveau; }) ? [['nouveau', 'Pas encore dans Vitisoft']] : []), e.etat, 'Tous les clients') + '</select>'
      + '<select data-f="rappel" aria-label="Prochaine action">' + options([['retard', 'Rappel en retard'], ['prevu', 'Rappel prévu'], ['aucun', 'Sans rappel']], e.rappel, 'Toute action') + '</select>'
      + '<select data-f="tag" aria-label="Étiquette">' + options(etiquettes().map(function(x){ return [x.t, x.t + ' (' + x.n + ')']; })
          .sort(function(a, b){ return a[0].localeCompare(b[0], 'fr'); }), e.tag, 'Toutes les étiquettes') + '</select>'
      + (proprioVisible() ? '<select data-f="proprio" aria-label="Suivi par">' + options(proprios, e.proprio, 'Suivis par tout le monde') + '</select>' : '')
      + '<button type="button" class="btn btn--ghost btn--sm" data-a="raz">Tout effacer</button>';
  }

  /* GERER LES ETIQUETTES DU BUREAU, 25/09/2026. Sans cet endroit, une faute de frappe
     (« Salon Bordaux ») restait pour toujours, et « VIP » et « Vip » vivaient cote a cote.
     Renommer vers un nom qui existe deja FUSIONNE les deux. Supprimer demande un second
     clic, sans fenetre du navigateur : le bouton dit lui-meme combien de clients il touche. */
  let GERER_OUVERT = false, GERER_EDIT = null, GERER_ARME = null;
  function blocGerer(){
    const l = etiquettes();
    if(!l.length) return '';
    return '<details class="annu__gest"' + (GERER_OUVERT ? ' open' : '') + '><summary>Gérer les étiquettes du bureau (' + l.length + ')</summary>'
      + '<ul class="annu__gl">' + l.map(function(x){
          const d = ' data-t="' + esc(x.t) + '"';
          if(GERER_EDIT === x.t) return '<li' + d + '><input type="text" class="annu__gin" maxlength="40" value="' + esc(x.t) + '" aria-label="Nouveau nom pour « ' + esc(x.t) + ' »">'
            + '<button type="button" class="btn btn--primary btn--sm" data-a="g-ok">Renommer</button>'
            + '<button type="button" class="btn btn--ghost btn--sm" data-a="g-annuler">Annuler</button>'
            + '<span class="annu__note">Un nom déjà utilisé réunit les deux étiquettes.</span></li>';
          return '<li' + d + '><span class="annu__tag annu__tag--fixe">' + esc(x.t) + '</span><span class="annu__gn">' + plur(x.n, 'client') + '</span>'
            + '<button type="button" class="btn btn--ghost btn--sm" data-a="g-voir">Voir</button>'
            + '<button type="button" class="btn btn--ghost btn--sm" data-a="g-renommer">Renommer</button>'
            + (GERER_ARME === x.t
                ? '<button type="button" class="btn btn--ghost btn--sm annu__garme" data-a="g-suppr">Confirmer : retirer de ' + plur(x.n, 'client') + '</button>'
                  + '<button type="button" class="btn btn--ghost btn--sm" data-a="g-annuler">Annuler</button>'
                : '<button type="button" class="btn btn--ghost btn--sm" data-a="g-suppr">Supprimer</button>')
            + '</li>';
        }).join('') + '</ul></details>';
  }
  function repeindreGerer(focus){
    const g = P() && P().querySelector('#annuGerer'); if(!g) return;
    g.innerHTML = blocGerer();
    if(focus){ const n = g.querySelector(focus); if(n){ n.focus(); if(n.select) n.select(); } }
  }
  function renommer(ancien, nouveau){
    nouveau = String(nouveau || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    if(!nouveau){ status('error', 'Donne un nom à l’étiquette.'); return; }
    if(nouveau === ancien){ GERER_EDIT = null; repeindreGerer(); return; }
    const autre = etiquettes().filter(function(x){ return x.t !== ancien && x.t.toLowerCase() === nouveau.toLowerCase(); })[0];
    if(autre) nouveau = autre.t;
    const ids = porteurs(ancien);
    GERER_EDIT = null;
    if(ETAT.tag === ancien) ETAT.tag = nouveau;
    return ecrireGroupe(ids, function(c){
      const vus = new Set();
      const t = (c.tags || []).map(function(x){ return x === ancien ? nouveau : x; })
        .filter(function(x){ const k = x.toLowerCase(); if(vus.has(k)) return false; vus.add(k); return true; });
      if(t.length) c.tags = t; else delete c.tags;
    }, autre ? 'Étiquette « ' + ancien + ' » réunie avec « ' + nouveau + ' »' : 'Étiquette « ' + ancien + ' » renommée en « ' + nouveau + ' »');
  }
  function supprimerEtiquette(tag){
    const ids = porteurs(tag);
    GERER_ARME = null;
    if(ETAT.tag === tag) ETAT.tag = '';
    return ecrireGroupe(ids, function(c){
      const t = (c.tags || []).filter(function(x){ return x !== tag; });
      if(t.length) c.tags = t; else delete c.tags;
    }, 'Étiquette « ' + tag + ' » supprimée');
  }

  /* Depuis une pastille de la fiche : « Mes clients », filtre sur cette etiquette. En pleine
     page, l'onglet n'a pas la piece chargee : on repart sur l'adresse, et le filtre attend
     dans la session de l'onglet. */
  function voirEtiquette(t){
    if(typeof pageFiche === 'function' && pageFiche()){
      try{ sessionStorage.setItem('bdv_annu_tag', t); }catch(e){}
      location.href = '/mon-bureau/#annuaire'; location.reload(); return;
    }
    ETAT = Object.assign({}, ETAT_VIDE, { tag: t }); MONTRES = PAS;
    if(typeof FICHE_ID !== 'undefined' && FICHE_ID && typeof fermerFiche === 'function') fermerFiche();
    const p = P();
    if(p && p.classList.contains('on') && p.querySelector('.annu')){
      const r = p.querySelector('.annu__replis'); if(r) r.open = true;
      const f = p.querySelector('.annu__filtres'); if(f) f.innerHTML = barreDesFiltres();
      caleRecherche(); majListe();
    }else if(window.BdvNav && BdvNav.afficher) BdvNav.afficher('annuaire');
    status('success', 'Clients portant l’étiquette « ' + t + ' ».');
  }

  function barreDeSelection(){
    const n = SEL.size;
    const membres = (TROMBI && TROMBI.gens) ? Object.keys(TROMBI.gens).map(function(u){ return [u, u === moi() ? 'Moi' : TROMBI.gens[u]]; }) : [];
    return '<p class="annu__nsel" aria-live="polite"><b>' + plur(n, 'client') + '</b> ' + (n > 1 ? 'sélectionnés' : 'sélectionné') + '</p>'
      + '<button type="button" class="btn btn--ghost btn--sm" data-a="exporter-sel">Exporter</button>'
      + (brevoPret() ? '<button type="button" class="btn btn--ghost btn--sm" data-a="brevo-sel">Vers Brevo</button>' : '')
      + '<span class="annu__sep" aria-hidden="true"></span>'
      + '<label class="annu__lbl" for="annuTag">Étiquette</label>'
      + '<input id="annuTag" type="text" maxlength="40" list="annuTags" placeholder="VIP, Salon Bordeaux…">'
      + '<datalist id="annuTags">' + etiquettes().map(function(x){ return x.t; }).map(function(t){ return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>'
      + '<button type="button" class="btn btn--ghost btn--sm" data-a="tag-plus">Ajouter</button>'
      + '<button type="button" class="btn btn--ghost btn--sm" data-a="tag-moins">Retirer</button>'
      + '<span class="annu__sep" aria-hidden="true"></span>'
      + (LOT33 === true && membres.length
          ? '<label class="annu__lbl" for="annuProprio">Suivi par</label>'
            + '<select id="annuProprio">' + options(membres, '', 'Personne') + '</select>'
            + '<button type="button" class="btn btn--ghost btn--sm" data-a="attribuer">Attribuer</button>'
          : '<span class="annu__note">' + (LOT33 === false ? 'Attribuer un client à un collègue n’est pas encore ouvert sur ton bureau.' : 'L’attribution demande un bureau à plusieurs (pièce L’équipe).') + '</span>')
      + '<button type="button" class="btn btn--ghost btn--sm annu__desel" data-a="desel">Tout désélectionner</button>';
  }

  function majListe(){
    const p = P(); if(!p || !p.querySelector('.annu')) return;
    filtrer();
    const corps = p.querySelector('#annuCorps');
    const vus = FILTREE.slice(0, MONTRES);
    corps.innerHTML = vus.length ? vus.map(ligne).join('')
      : '<tr><td colspan="10" class="annu__rien">Aucun client ne répond à ces filtres.</td></tr>';
    p.querySelector('#annuTete').innerHTML = entete();
    const tout = p.querySelector('[data-a="tout"]');
    if(tout){
      const cochables = FILTREE.length, coches = FILTREE.filter(function(c){ return SEL.has(c.id); }).length;
      tout.checked = cochables > 0 && coches === cochables;
      tout.indeterminate = coches > 0 && coches < cochables;
    }
    p.querySelector('#annuCompte').textContent = plur(FILTREE.length, 'client') + (FILTREE.length === LISTE.length ? '' : ' sur ' + fmtNum(LISTE.length));
    const plus = p.querySelector('[data-a="plus"]');
    plus.hidden = FILTREE.length <= MONTRES;
    plus.textContent = 'Afficher ' + Math.min(PAS, FILTREE.length - MONTRES) + ' de plus';
    const lot = p.querySelector('#annuLot');
    lot.hidden = SEL.size === 0;
    if(SEL.size) lot.innerHTML = barreDeSelection();
    /* Lot 89 : un bloc « Vers Brevo » ouvert suit les filtres et la selection. */
    if(window.BdvBrevoListes) BdvBrevoListes.rafraichir();
  }

  function peindre(){
    const p = P(); if(!p) return;
    brancher();
    construire();
    if(!LISTE.length){
      p.innerHTML = '<h2 class="panel__title titre-piece">Mes clients</h2><p class="panel__sub">Tes clients apparaîtront ici dès que ton premier export Vitisoft sera déposé. '
        + 'Un client qui n’est pas encore dans Vitisoft se crée avec « Nouveau client ».</p>'
        + '<div class="annu__haut"><span></span><button type="button" class="btn btn--primary btn--sm" data-a="nouveau">Nouveau client</button></div>'
        + '<div class="card annu__seul">' + blocNouveau() + '</div>';
      return;
    }
    // Une selection qui designe un client disparu de la base (base videe, autre bureau) ne vaut rien.
    const ids = new Set(LISTE.map(function(c){ return c.id; }));
    Array.from(SEL).forEach(function(id){ if(!ids.has(id)) SEL.delete(id); });
    p.innerHTML = '<h2 class="panel__title titre-piece">Mes clients</h2>'
      + '<p class="panel__sub">' + phraseCompte() + ' '
      + 'Les coordonnées viennent de Vitisoft et se corrigent là-bas ; les étiquettes, le suivi et les vues sont communs à ton bureau.</p>'
      + '<div class="card annu">'
      +   '<div class="annu__barre annu__cherche"><input type="search" class="annu__q" id="annuQ" data-f="q" value="' + esc(ETAT.q) + '" placeholder="Nom, n°, ville, e-mail, téléphone" aria-label="Chercher un client"></div>'
      /* LES FILTRES ET LES VUES SE REPLIENT, et ils sont ouverts a l'arrivee sur ordinateur.
         Sur telephone, huit listes deroulantes empilees font deux ecrans de reglages avant
         le premier client : la recherche reste dehors, le reste attend qu'on le demande. */
      +   '<details class="annu__replis"' + (window.innerWidth > 700 || ETAT.tag ? ' open' : '') + '><summary>Filtres et vues</summary>'
      +     '<div class="annu__barre annu__vues">' + barreDesVues() + '</div>'
      +     '<div class="annu__barre annu__filtres">' + barreDesFiltres() + '</div>'
      +     '<div class="annu__gerer" id="annuGerer">' + blocGerer() + '</div>'
      +   '</details>'
      +   '<div class="annu__barre annu__lot" id="annuLot" hidden></div>'
      +   '<div class="annu__haut"><p class="annu__compte" id="annuCompte" aria-live="polite"></p>'
      +     '<span class="annu__gestes"><button type="button" class="btn btn--ghost btn--sm" data-a="brevo"' + (brevoPret() ? '' : ' hidden') + '>Vers Brevo</button>'
      +     '<button type="button" class="btn btn--ghost btn--sm" data-a="exporter">Exporter la liste</button>'
      +     '<button type="button" class="btn btn--primary btn--sm" data-a="nouveau" aria-expanded="' + (NOUVEAU.ouvert ? 'true' : 'false') + '" aria-controls="annuNouveau">Nouveau client</button></span></div>'
      +   '<div class="bdvbl" id="annuBrevo" hidden></div>'
      +   blocNouveau()
      +   '<div id="annuRappro">' + blocRappro() + '</div>'
      +   '<div class="tablewrap annu__wrap"><table class="data data--sticky annu__t"><caption class="hors-ecran">Tes clients. Clique sur un nom pour ouvrir sa fiche, Cmd + clic pour l’ouvrir dans un nouvel onglet.</caption>'
      +     '<thead id="annuTete"></thead><tbody id="annuCorps"></tbody></table></div>'
      +   '<div class="annu__pied"><button type="button" class="btn btn--ghost btn--sm" data-a="plus" hidden></button></div>'
      + '</div>';
    majListe();
  }

  /* Repeint la barre des filtres sans toucher au champ de recherche qui a le focus : le
     reecrire a chaque frappe ferait perdre le curseur au milieu d'un mot. */
  function repeindreBarres(){
    const p = P(); if(!p || !p.querySelector('.annu')) return;
    const f = p.querySelector('.annu__filtres');
    const q = document.activeElement && document.activeElement.id === 'annuQ';
    if(f && !q) f.innerHTML = barreDesFiltres();
    const v = p.querySelector('.annu__vues'); if(v) v.innerHTML = barreDesVues();
    const g = p.querySelector('#annuGerer');
    if(g && !(document.activeElement && g.contains(document.activeElement) && document.activeElement.tagName === 'INPUT')) g.innerHTML = blocGerer();
  }

  function caleRecherche(){ const q = document.getElementById('annuQ'); if(q) q.value = ETAT.q || ''; }


  /* ------------------------------------------------------------------ nouveau client */
  /* « NOUVEAU CLIENT », 08/10/2026 (lot 81, decision de Ted) : un client qui n'est pas
     encore dans Vitisoft se cree ici, sans affaire. C'est une ligne de `pistes`.
     LES DEUX GARDES DE DOUBLON, les memes que dans les affaires (lot 41) : un SIRET deja
     connu BLOQUE (une entreprise, une fiche ; la base le refuse aussi), un nom proche
     PREVIENT, et « Creer quand meme » demande un second geste. Une personne qui a demande a
     ne plus etre contactee ne se recree pas (la base le refuse aussi). */
  const NOUVEAU = { ouvert: false, champs: {}, resultats: null, mot: '', alerte: false, proche: null };
  const CHAMPS_NV = [['nom', 'Nom de l’entreprise ou de la personne', 'text', 120, 'organization'], ['siret', 'SIRET (facultatif)', 'text', 17, ''],
    ['nature', 'Type', 'select'], ['contact_nom', 'Interlocuteur', 'text', 120, 'name'], ['contact_fonction', 'Sa fonction', 'text', 80, 'organization-title'],
    ['email', 'E-mail', 'email', 200, 'email'], ['telephone', 'Téléphone', 'tel', 40, 'tel'],
    ['adresse', 'Adresse', 'text', 200, 'street-address'], ['code_postal', 'Code postal', 'text', 12, 'postal-code'], ['ville', 'Ville', 'text', 80, 'address-level2']];
  function phraseCompte(){
    const n = LISTE.filter(function(c){ return c.nouveau; }).length;
    return 'Les clients de tes exports, ' + plur(LISTE.length - n, 'client')
      + (n ? ', et ' + plur(n, 'nouveau client') .replace('nouveau clients', 'nouveaux clients') + ' pas encore dans Vitisoft.' : '.');
  }
  const FORMES_NV = ['sarl', 'sas', 'sasu', 'sa', 'eurl', 'earl', 'scea', 'gaec', 'sci', 'scev', 'snc', 'ste', 'societe', 'ets', 'sca', 'eirl', 'ei', 'gfa', 'cuma'];
  function coeur(n){
    return norm(String(n || '').replace(/\([^)]*\)/g, ' ')).split(/[^a-z0-9]+/)
      .filter(function(w){ return w && FORMES_NV.indexOf(w) < 0; }).join(' ');
  }
  function proches(a, b){
    const x = coeur(a), y = coeur(b);
    if(x.length < 3 || y.length < 3) return false;
    if(x === y) return true;
    const court = x.length <= y.length ? x : y, long = court === x ? y : x;
    return court.length >= 5 && (' ' + long + ' ').indexOf(' ' + court + ' ') >= 0;
  }
  /* ------------------------------------------------------------------ rapprocher (lot 83) */
  /* « C'EST LE MEME ? », 08/10/2026 (decision de Ted). Un nouveau client qui ressemble a un
     client Vitisoft (meme e-mail, ou nom proche sans les formes juridiques) est propose ici.
     Oui le relie (la base deplace son suivi, son journal et ses affaires) ; Non est retenu
     pour tout le bureau (`pistes.pas_vitisoft`) et la question ne revient plus.
     Au-dessus, les liens poses ces sept derniers jours, tout seuls a l'import ou a la main :
     on les montre, parce qu'un lien automatique qu'on ne voit pas est un lien qu'on ne
     defait jamais. */
  const RAPPRO = { occupe: '', err: '', focus: false, vus: lireVus() };
  function lireVus(){ try{ return new Set(JSON.parse(localStorage.getItem('bdv_rappro_vus') || '[]')); }catch(e){ return new Set(); } }
  function ecrireVus(){ try{ localStorage.setItem('bdv_rappro_vus', JSON.stringify(Array.from(RAPPRO.vus).slice(-500))); }catch(e){} }
  function propositions(){
    const nv = NV(); if(!nv) return [];
    const lies = new Set((nv.lies ? nv.lies() : []).map(function(p){ return String(p.client_id); }));
    const vits = LISTE.filter(function(c){ return !c.nouveau && c.num && !lies.has(c.num); })
      .map(function(c){ return { c: c, k: coeur(c.nom), m: (typeof emailsOf === 'function' ? emailsOf(c.id) : []).map(function(x){ return String(x).toLowerCase(); }) }; });
    const out = [];
    nv.liste().forEach(function(p){
      if(p.opposition) return;
      const refus = new Set((p.pas_vitisoft || []).map(String));
      const mails = (p.email ? String(p.email).toLowerCase().split(/[\s;,]+/) : []).filter(Boolean);
      const k = coeur(p.nom);
      vits.forEach(function(v){
        if(refus.has(v.c.num)) return;
        const parMail = mails.length && v.m.some(function(x){ return mails.indexOf(x) >= 0; });
        if(parMail || (k.length >= 3 && proches(p.nom, v.c.nom))) out.push({ p: p, c: v.c, mail: !!parMail });
      });
    });
    return out.sort(function(a, b){ return (b.mail ? 1 : 0) - (a.mail ? 1 : 0) || a.p.nom.localeCompare(b.p.nom, 'fr'); });
  }
  function recents(){
    const nv = NV(); if(!nv || !nv.lies) return [];
    const limite = Date.now() - 7 * 86400000;
    return nv.lies().filter(function(p){ return p.lie_le && Date.parse(p.lie_le) >= limite && !RAPPRO.vus.has(p.piste_id + '>' + p.client_id); });
  }
  function nomVitisoft(num){ const c = LISTE.filter(function(x){ return x.num === String(num); })[0]; return c ? c.nom : 'n°' + num; }
  function blocRappro(){
    const props = propositions(), rec = recents();
    if(!props.length && !rec.length) return '';
    let h = '<section class="annu__rappro" aria-label="Nouveaux clients et Vitisoft">';
    if(rec.length){
      h += '<h3 class="annu__rappro-t">Reliés à Vitisoft ces derniers jours</h3><ul class="annu__rappro-l">'
        + rec.slice(0, 5).map(function(p){
          return '<li><span>« ' + esc(p.nom) + ' » est maintenant <b>' + esc(nomVitisoft(p.client_id)) + '</b>, n°' + esc(p.client_id) + '.</span>'
            + '<span class="annu__rappro-b"><button type="button" class="btn btn--ghost btn--sm" data-a="rp-voir" data-n="' + esc(p.client_id) + '">Voir la fiche</button>'
            + '<button type="button" class="btn btn--ghost btn--sm" data-a="rp-vu" data-k="' + esc(p.piste_id + '>' + p.client_id) + '">C’est bien lui, masquer</button></span></li>';
        }).join('') + '</ul>'
        + '<p class="note">Si ce n’est pas le même client, ouvre sa fiche et choisis « Délier ».</p>';
    }
    if(props.length){
      /* L'explication passe AU-DESSUS des boutons : sous la liste, au telephone, la barre du
         bas la cachait, et c'est elle qui dit que « Non » ne revient pas (vigneron empathique). */
      h += '<h3 class="annu__rappro-t">C’est le même client ?</h3>'
        + '<p class="note">Oui : son suivi, ses notes et ses affaires passent sur la fiche Vitisoft (tu pourras délier). Non : la question ne reviendra plus.</p>'
        + '<ul class="annu__rappro-l">'
        + props.slice(0, 5).map(function(x){
          const cle = x.p.piste_id + '>' + x.c.num, occ = RAPPRO.occupe === cle ? ' disabled aria-busy="true"' : '';
          const mv = (typeof emailOf === 'function' ? emailOf(x.c.id) : '') || '', mp = String(x.p.email || '').split(/[\s;,]+/)[0] || '';
          const ecarts = [];
          if(x.p.ville && x.c.ville && coeur(x.p.ville) !== coeur(x.c.ville)) ecarts.push(x.p.ville + ' d’un côté, ' + x.c.ville + ' de l’autre');
          if(mp && mv && !x.mail) ecarts.push('deux e-mails différents');
          return '<li><span class="annu__rappro-deux">'
            + '<span><span class="annu__rappro-cote">Nouveau client :</span> <b>' + esc(x.p.nom) + '</b>' + (x.p.ville ? ' · ' + esc(x.p.ville) : '') + (mp ? ' · ' + esc(mp) : '') + '</span>'
            + '<span><span class="annu__rappro-cote">Vitisoft n°' + esc(x.c.num) + ' :</span> <b>' + esc(x.c.nom) + '</b>' + (x.c.ville ? ' · ' + esc(x.c.ville) : '') + (mv ? ' · ' + esc(mv) : '')
            + (x.mail ? ' <span class="annu__rappro-pq">même e-mail</span>' : '') + '</span>'
            + (ecarts.length ? '<span class="annu__rappro-att"><b>Attention :</b> ' + esc(ecarts.join(', ')) + '.</span>' : '')
            + '</span>'
            + '<span class="annu__rappro-b"><button type="button" class="btn btn--primary btn--sm" data-a="rp-oui" data-p="' + esc(x.p.piste_id) + '" data-n="' + esc(x.c.num) + '"' + occ + '>'
            + (RAPPRO.occupe === cle ? 'Je relie…' : 'Oui, c’est le même') + '</button>'
            + '<button type="button" class="btn btn--ghost btn--sm" data-a="rp-non" data-p="' + esc(x.p.piste_id) + '" data-n="' + esc(x.c.num) + '"' + occ + '>Non</button></span></li>';
        }).join('') + '</ul>'
        + (props.length > 5 ? '<p class="note">Et ' + plur(props.length - 5, 'autre proposition') + ' : réponds à celles-ci, les suivantes viendront.</p>' : '');
    }
    if(RAPPRO.err) h += '<p class="annu__rappro-err" role="alert">' + esc(RAPPRO.err) + '</p>';
    return h + '</section>';
  }
  function repeindreRappro(focus){
    const z = P() && P().querySelector('#annuRappro'); if(!z) return;
    z.innerHTML = blocRappro();
    if(focus){ const b = z.querySelector(focus) || z.querySelector('button'); if(b) b.focus(); else { const q = document.getElementById('annuQ'); if(q) q.focus(); } }
  }
  async function rappro(a, b){
    RAPPRO.err = '';
    if(a === 'rp-voir'){ if(typeof window.bdvOuvrirFiche === 'function') window.bdvOuvrirFiche(b.getAttribute('data-n')); return; }
    if(a === 'rp-vu'){ RAPPRO.vus.add(b.getAttribute('data-k')); ecrireVus(); repeindreRappro('button'); return; }
    if(RAPPRO.occupe) return;
    const pid = b.getAttribute('data-p'), num = b.getAttribute('data-n'), p = NV() && NV().get('p:' + pid);
    if(!p) return;
    RAPPRO.occupe = pid + '>' + num; repeindreRappro();
    try{
      if(a === 'rp-oui'){
        /* Pas de bandeau par-dessus la liste : le bloc « Relies ces derniers jours » le montre. */
        await window.bdvClients.relier(pid, num);
      }else if(a === 'rp-non'){
        /* Par la base, qui ajoute : deux « Non » en meme temps ne s'effacent pas l'un l'autre. */
        const liste = await window.bdvClients.ecarter(pid, num);
        p.pas_vitisoft = Array.isArray(liste) ? liste : (p.pas_vitisoft || []).concat([String(num)]);
      }
      RAPPRO.occupe = '';
      /* Le focus ne retombe pas sur la page : il va au premier bouton du bloc (la proposition
         suivante), ou a la recherche si le bloc s'est vide. */
      if(a === 'rp-oui'){ RAPPRO.focus = true; await NV().charger(); } else repeindreRappro('button');
    }catch(e){
      RAPPRO.occupe = '';
      RAPPRO.err = (e && e.message) || 'Le geste n’a pas abouti.';
      repeindreRappro('button');
    }
  }

  function chiffres(v){ return String(v || '').replace(/\D/g, ''); }
  function lireChamps(){
    const b = document.getElementById('annuNouveau'); if(!b) return NOUVEAU.champs;
    CHAMPS_NV.forEach(function(c){ const i = b.querySelector('[name="nv-' + c[0] + '"]'); if(i) NOUVEAU.champs[c[0]] = i.value; });
    return NOUVEAU.champs;
  }
  function blocNouveau(){
    if(!NOUVEAU.ouvert) return '<div id="annuNouveau" class="annu__nouveau" hidden></div>';
    const v = NOUVEAU.champs;
    const champ = function(c){
      const id = 'nv-' + c[0];
      if(c[2] === 'select') return '<label class="annu__nchamp"><span>' + esc(c[1]) + '</span><select name="' + id + '">'
        + NATURES.map(function(n){ return '<option value="' + n[0] + '"' + ((v.nature || 'autre') === n[0] ? ' selected' : '') + '>' + esc(n[1]) + '</option>'; }).join('') + '</select></label>';
      return '<label class="annu__nchamp' + (c[0] === 'nom' || c[0] === 'adresse' ? ' annu__nchamp--plein' : '') + '"><span>' + esc(c[1]) + '</span>'
        + '<input name="' + id + '" type="' + c[2] + '" maxlength="' + c[3] + '"' + (c[4] ? ' autocomplete="' + c[4] + '"' : ' autocomplete="off"')
        + (c[0] === 'siret' ? ' inputmode="numeric"' : '') + ' value="' + esc(v[c[0]] || '') + '"></label>';
    };
    /* LE NOM ET LE SIRET D'ABORD, PUIS « CHERCHER » TOUT DE SUITE (vigneron empathique,
       08/10/2026) : l'aide dit « tape son nom, puis cherche », le bouton ne peut pas
       attendre neuf champs plus bas. */
    const champsTete = CHAMPS_NV.slice(0, 2).map(champ).join('');
    const champs = CHAMPS_NV.slice(2).map(champ).join('');
    let res = '';
    if(NOUVEAU.resultats && NOUVEAU.resultats.length){
      res = '<ul class="annu__ntrouve">' + NOUVEAU.resultats.map(function(x, i){
        const deja = LISTE.filter(function(c){ return c.siret && c.siret === x.siret; })[0];
        return '<li><span class="annu__ntrouve-nom">' + esc(x.nom) + (x.actif ? '' : ' <span class="aff-marque aff-marque--opposee">fermée</span>') + '</span>'
          + '<span class="annu__sous">' + esc([x.adresse, [x.code_postal, x.ville].filter(Boolean).join(' '), 'SIRET ' + x.siret].filter(Boolean).join(' · ')) + '</span>'
          + (deja ? '<span class="annu__note">Déjà dans ta base : « ' + esc(deja.nom) + ' ».</span> <a class="btn btn--ghost btn--sm" href="/mon-bureau/#fiche=' + esc(encId(deja.id)) + '">Ouvrir sa fiche</a>'
                  : '<button type="button" class="btn btn--ghost btn--sm" data-a="nv-prendre" data-i="' + i + '">Prendre</button>')
          + '</li>';
      }).join('') + '</ul>';
    }
    let prev = '';
    if(NOUVEAU.proche){
      const c = NOUVEAU.proche;
      prev = '<div class="annu__nproche" role="alert"><p>Un de tes clients s’appelle déjà « ' + esc(c.nom) + ' »' + (c.ville ? ', à ' + esc(c.ville) : '') + '. Vérifie que ce n’est pas le même.</p>'
        + '<a class="btn btn--ghost btn--sm" href="/mon-bureau/#fiche=' + esc(encId(c.id)) + '">Ouvrir sa fiche</a>'
        + '<button type="button" class="btn btn--ghost btn--sm" data-a="nv-creer" data-force="1">Créer quand même</button></div>';
    }
    return '<div id="annuNouveau" class="annu__nouveau" role="group" aria-labelledby="annuNouveauT">'
      + '<h3 class="annu__nouveau-t" id="annuNouveauT">Nouveau client, pas encore dans Vitisoft</h3>'
      + '<p class="annu__aide">Tape son nom ou son SIRET, puis « Chercher dans l’annuaire » pour remplir la fiche d’un coup. Tu peux aussi tout remplir à la main.</p>'
      + '<div class="annu__ngrille">' + champsTete + '</div>'
      + '<div class="annu__nbarre"><button type="button" class="btn btn--ghost btn--sm" data-a="nv-chercher">Chercher dans l’annuaire</button></div>'
      + res
      + '<div class="annu__ngrille annu__ngrille--suite">' + champs + '</div>'
      + '<p class="annu__nmot' + (NOUVEAU.alerte ? ' annu__nmot--alerte' : '') + '" aria-live="polite">' + esc(NOUVEAU.mot || '') + '</p>'
      + prev
      + '<div class="annu__npied"><button type="button" class="btn btn--primary btn--sm" data-a="nv-creer">Créer le client</button>'
      + '<button type="button" class="btn btn--ghost btn--sm" data-a="nv-annuler">Annuler</button></div>'
      + '</div>';
  }
  function repeindreNouveau(focus){
    const b = document.getElementById('annuNouveau'); if(!b) return;
    const tmp = document.createElement('div'); tmp.innerHTML = blocNouveau();
    b.replaceWith(tmp.firstChild);
    const bt = P() && P().querySelector('[data-a="nouveau"]'); if(bt) bt.setAttribute('aria-expanded', NOUVEAU.ouvert ? 'true' : 'false');
    if(focus){ const n = document.getElementById('annuNouveau'); const f = n && n.querySelector(focus); if(f) f.focus(); }
  }
  function direNv(m, alerte){ NOUVEAU.mot = m || ''; NOUVEAU.alerte = !!alerte; }
  async function chercherNv(){
    lireChamps();
    const q = chiffres(NOUVEAU.champs.siret).length >= 9 ? chiffres(NOUVEAU.champs.siret) : (NOUVEAU.champs.nom || '');
    if(!(window.BdvDomaine && BdvDomaine.chercher)){ direNv('L’annuaire n’est pas joignable d’ici : remplis la fiche à la main.', true); repeindreNouveau(); return; }
    direNv('Recherche dans l’annuaire…'); NOUVEAU.resultats = null; repeindreNouveau();
    const r = await BdvDomaine.chercher(q);
    if(!r.ok){ direNv(r.mot, true); NOUVEAU.resultats = null; }
    else if(!r.liste.length){ direNv('Rien trouvé dans l’annuaire pour « ' + q + ' ». Tu peux remplir la fiche à la main.'); NOUVEAU.resultats = []; }
    else { direNv(plur(r.liste.length, 'entreprise') + ' trouvée' + (r.liste.length > 1 ? 's' : '') + ' : prends la bonne.'); NOUVEAU.resultats = r.liste; }
    repeindreNouveau();
  }
  function prendreNv(i){
    const x = NOUVEAU.resultats && NOUVEAU.resultats[i]; if(!x) return;
    lireChamps();
    const nomPropre = (window.BdvAffaires && BdvAffaires._nomPropose) ? BdvAffaires._nomPropose(x.nom) : x.nom;
    Object.assign(NOUVEAU.champs, { nom: nomPropre || x.nom, siret: x.siret, adresse: x.adresse || '', code_postal: x.code_postal || '', ville: x.ville || '' });
    NOUVEAU.resultats = null; direNv('« ' + (nomPropre || x.nom) + ' » : vérifie la fiche, puis crée le client.');
    repeindreNouveau('[name="nv-contact_nom"]');
  }
  function bureauCourant(){ return window.BdvCompte && BdvCompte.monBureau ? BdvCompte.monBureau() : null; }
  function nouvelId(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(ch){ const r = Math.random() * 16 | 0; return (ch === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  let CREATION = false;
  async function creerNv(force){
    if(CREATION) return;
    const v = lireChamps();
    const nom = String(v.nom || '').replace(/\s+/g, ' ').trim();
    const siret = chiffres(v.siret);
    if(!nom){ direNv('Donne au moins son nom.', true); NOUVEAU.proche = null; repeindreNouveau('[name="nv-nom"]'); return; }
    if(siret && siret.length !== 14){ direNv('Un SIRET a 14 chiffres. Laisse le champ vide si tu ne l’as pas.', true); repeindreNouveau('[name="nv-siret"]'); return; }
    const mail = String(v.email || '').trim();
    if(mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)){ direNv('Cet e-mail ne semble pas complet.', true); repeindreNouveau('[name="nv-email"]'); return; }
    const parSiret = siret ? LISTE.filter(function(c){ return c.siret === siret; })[0] : null;
    if(parSiret){ direNv('Ce SIRET est déjà celui de « ' + parSiret.nom + ' ». Une entreprise, une fiche : ouvre la sienne.', true); NOUVEAU.proche = null; repeindreNouveau(); return; }
    const oppose = LISTE.filter(function(c){ return c.opposition && coeur(c.nom) === coeur(nom); })[0];
    if(oppose){ direNv('« ' + oppose.nom + ' » a demandé à ne plus être contacté : on ne le recrée pas.', true); NOUVEAU.proche = null; repeindreNouveau(); return; }
    if(!force){
      const p = LISTE.filter(function(c){ return !c.opposition && proches(c.nom, nom); })[0];
      if(p){ NOUVEAU.proche = p; direNv(''); repeindreNouveau('[data-force]'); return; }
    }
    const b = bureauCourant();
    if(!b || !(window.BdvCompte && BdvCompte.api)){ direNv('Ton bureau n’est pas encore raccordé : recharge la page, puis réessaie.', true); repeindreNouveau(); return; }
    const ligne = { bureau: b, piste_id: nouvelId(), nom: nom.slice(0, 120), nature: v.nature || 'autre', source: 'Mes clients' };
    [['contact_nom', 120], ['contact_fonction', 80], ['email', 200], ['telephone', 40], ['adresse', 200], ['code_postal', 12], ['ville', 80]].forEach(function(x){
      const t = String(v[x[0]] || '').replace(/\s+/g, ' ').trim(); if(t) ligne[x[0]] = t.slice(0, x[1]);
    });
    if(siret) ligne.siret = siret;
    CREATION = true; direNv('Création…'); repeindreNouveau();
    try{
      const r = await BdvCompte.api('/pistes', { methode: 'POST', entetes: { 'Prefer': 'return=representation' }, corps: [ligne] });
      const cree = Array.isArray(r) && r[0] ? r[0] : ligne;
      if(NV()) NV().poser(cree);
      NOUVEAU.ouvert = false; NOUVEAU.champs = {}; NOUVEAU.resultats = null; NOUVEAU.proche = null; direNv('');
      peindre();
      status('success', '« ' + cree.nom + ' » est dans tes clients, pas encore dans Vitisoft.');
      if(typeof window.bdvOuvrirFiche === 'function') window.bdvOuvrirFiche('p:' + cree.piste_id);
    }catch(e){
      const d = String((e && e.detail) || '') + ' ' + String((e && e.message) || '');
      direNv(/23505|siret/i.test(d) ? 'Ce SIRET est déjà celui d’un client de ton bureau.'
        : /23514|plus etre contact/i.test(d) ? 'Cette personne a demandé à ne plus être contactée : on ne la recrée pas.'
        : 'Le client n’a pas pu être créé : vérifie ta connexion et réessaie.', true);
      repeindreNouveau();
    }finally{ CREATION = false; }
  }

  /* ------------------------------------------------------------------ ecriture groupee */
  /* LES GESTES GROUPES PASSENT PAR LA MEME MEMOIRE QUE LA FICHE : CRM, crmSave(), puis
     le serveur. Jamais une ecriture a cote : deux chemins qui ecrivent le suivi finiraient
     par se contredire sur une etiquette. L'ecriture part EN UNE FOIS, par tranches de
     LOT_ENVOI ; une fiche que le geste a videe passe, elle, par `syncSuivi()` qui sait la
     supprimer. */
  async function ecrireGroupe(ids, modifier, libelle){
    if(!ids.length) return;
    retenter();   // un geste d'ecriture : la seule nouvelle question du lot 33 (voir preparer)
    const pleines = [], videes = [];
    ids.forEach(function(id){
      const c = Object.assign({}, CRM[id] || {});
      modifier(c);
      if(crmVide(c) && !Object.prototype.hasOwnProperty.call(c, 'proprietaire')){ delete CRM[id]; videes.push(id); }
      else { CRM[id] = c; pleines.push(id); }
    });
    crmSave();
    majListe(); repeindreBarres();
    let ok = true;
    for(let i = 0; i < pleines.length; i += LOT_ENVOI){
      const tranche = pleines.slice(i, i + LOT_ENVOI);
      const r = window.BdvSync && BdvSync.ecrireSuiviLot
        ? await BdvSync.ecrireSuiviLot(tranche.map(function(id){ return { id: id, fiche: CRM[id] }; }))
        : false;
      tranche.forEach(function(id){ if(CRM[id]){ if(r) delete CRM[id]._apousser; else CRM[id]._apousser = true; } });
      ok = ok && r;
    }
    for(const id of videes){ const r = await syncSuivi(id); ok = ok && r; }
    crmSave();
    if(ok){
      status('success', libelle + ' : ' + plur(ids.length, 'client') + '.');
      if(typeof prevenirLesOnglets === 'function') prevenirLesOnglets('suivi', null);
      if(typeof window.bdvFicheAEcrit === 'function'){ try{ window.bdvFicheAEcrit(); }catch(e){} }
    }else{
      status('error', libelle + ' : ton compte n’a pas tout reçu. C’est gardé sur cet appareil et ça repartira à la prochaine synchronisation.');
    }
    if(typeof deposerPourLeBureau === 'function') deposerPourLeBureau();
  }

  function etiqueter(ids, tag, ajouter){
    tag = String(tag || '').trim().replace(/,/g, ' ').slice(0, 40);
    if(!tag){ status('error', 'Écris l’étiquette à ' + (ajouter ? 'ajouter' : 'retirer') + '.'); return; }
    const deja = etiquettes().filter(function(x){ return x.t.toLowerCase() === tag.toLowerCase(); })[0];
    if(deja) tag = deja.t;
    return ecrireGroupe(ids, function(c){
      const t = (c.tags || []).filter(function(x){ return x.toLowerCase() !== tag.toLowerCase(); });
      if(ajouter) t.push(tag);
      if(t.length) c.tags = t; else delete c.tags;
    }, ajouter ? 'Étiquette « ' + tag + ' » ajoutée' : 'Étiquette « ' + tag + ' » retirée');
  }

  /* LE PROPRIETAIRE PART EN `null` EXPLICITE pour « Personne » : absent du corps, l'upsert
     ne toucherait pas a la colonne et l'ancien proprietaire resterait. C'est la seule
     valeur du suivi qui doit pouvoir s'ecrire vide. */
  function attribuer(ids, uid){
    if(LOT33 !== true){ status('error', 'Attribuer un client à un collègue n’est pas encore ouvert sur ton bureau.'); return; }
    return ecrireGroupe(ids, function(c){ c.proprietaire = uid || null; },
      uid ? 'Suivi par ' + nomDe(uid) : 'Plus personne ne suit');
  }

  /* ------------------------------------------------------------------ export */
  function exporter(liste, suffixe){
    const aoa = [['Client', 'N° client', 'Code postal', 'Ville', 'Pays', 'Canal', 'Typologie', 'E-mail', 'Téléphone',
      'Dernière commande', 'Commandes', 'CA ' + libEx(EX_CUR)].concat(EX_PREV != null ? ['CA ' + libEx(EX_PREV)] : [])
      .concat(['Prochaine action', 'Motif', 'Étiquettes', 'Suivi par'])];
    liste.forEach(function(c){
      const s = suivi(c.id);
      aoa.push([c.nom, c.nouveau ? 'pas encore dans Vitisoft' : c.num, c.cp, c.ville, c.pays, c.canal, c.type,
        c.nouveau ? (c.mails[0] || '') : emailOf(c.id), c.nouveau ? c.tel : telOf(c.id),
        c.derDate ? fmtDate(c.derDate) : '', c.cmd, Math.round(c.ca)].concat(EX_PREV != null ? [Math.round(c.caPrev)] : [])
        .concat([s.statut === 'traite' ? 'Mis de côté' : (s.rappel ? fmtDateIso(s.rappel) : ''), s.rappel_titre || '', (s.tags || []).join(', '), nomDe(s.proprietaire)]));
    });
    toXlsxOrCsv([{ name: 'Mes clients', aoa: aoa }], 'mes-clients-' + suffixe);
  }

  /* ------------------------------------------------------------------ vues */
  const CLES_VUE = ['q', 'canal', 'type', 'pays', 'etat', 'rappel', 'tag', 'proprio', 'tri', 'sens'];
  async function lireLesVues(){
    if(LOT33 === false){ VUES = false; return; }
    const v = window.BdvSync && BdvSync.lireVues ? await BdvSync.lireVues() : null;
    VUES = v == null ? (LOT33 === true ? [] : false) : v;
  }

  /* ------------------------------------------------------------------ gestes */
  function brancher(){
    if(BRANCHE) return;
    const p = P(); if(!p) return;
    BRANCHE = true;
    let minuteur = null;
    p.addEventListener('input', function(e){
      const f = e.target.getAttribute && e.target.getAttribute('data-f');
      if(f !== 'q') return;
      clearTimeout(minuteur);
      minuteur = setTimeout(function(){ ETAT.q = e.target.value; MONTRES = PAS; majListe(); }, 160);
    });
    p.addEventListener('change', function(e){
      const t = e.target;
      const f = t.getAttribute('data-f');
      if(f && f !== 'q'){ ETAT[f] = t.value; MONTRES = PAS; majListe(); return; }
      const a = t.getAttribute('data-a');
      if(a === 'coche'){
        const id = t.closest('tr').getAttribute('data-id');
        if(t.checked) SEL.add(id); else SEL.delete(id);
        t.closest('tr').classList.toggle('is-coche', t.checked);
        majListe();
      }else if(a === 'tout'){
        FILTREE.forEach(function(c){ if(t.checked) SEL.add(c.id); else SEL.delete(c.id); });
        majListe();
      }else if(a === 'vue'){
        const v = (VUES || []).filter(function(x){ return x.vue_id === t.value; })[0];
        if(!v) return;
        ETAT = Object.assign({}, ETAT_VIDE);
        CLES_VUE.forEach(function(k){ if(v.filtres && v.filtres[k] != null) ETAT[k] = v.filtres[k]; });
        MONTRES = PAS;
        const f2 = P().querySelector('.annu__filtres'); if(f2) f2.innerHTML = barreDesFiltres();
        caleRecherche();
        majListe();
        t.value = v.vue_id;
        const suppr = P().querySelector('[data-a="vue-suppr"]'); if(suppr) suppr.hidden = false;
      }
    });
    /* 02/10/2026 : la rangee entiere ouvre la fiche, par cet ecouteur et plus par un calque
       `::after` (voir bdv-ecrans.css). Le clic est rendu au lien du nom. */
    p.addEventListener('click', function(e){
      const tr = e.target.closest && e.target.closest('tr.annu__l');
      if(!tr || e.target.closest('button,a,input,select,textarea,label,summary')) return;
      if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if(window.getSelection && String(window.getSelection()).length) return;
      const a = tr.querySelector('.annu__nom'); if(a) a.click();
    });
    p.addEventListener('click', function(e){
      const b = e.target.closest && e.target.closest('[data-a]');
      if(!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
      const a = b.getAttribute('data-a');
      const ids = Array.from(SEL);
      if(a === 'tri'){
        const cle = b.getAttribute('data-cle');
        if(ETAT.tri === cle) ETAT.sens = -ETAT.sens;
        else { ETAT.tri = cle; ETAT.sens = (cle === 'nom' || cle === 'ville' || cle === 'rappel') ? 1 : -1; }
        majListe();
        const nb = P().querySelector('[data-a="tri"][data-cle="' + cle + '"]'); if(nb) nb.focus();
      }else if(a === 'plus'){ MONTRES += PAS; majListe(); }
      else if(a === 'raz'){ ETAT = Object.assign({}, ETAT_VIDE); MONTRES = PAS; repeindreBarres(); caleRecherche(); majListe(); }
      else if(a === 'desel'){ SEL.clear(); majListe(); }
      else if(a === 'nouveau'){ NOUVEAU.ouvert = !NOUVEAU.ouvert; if(!NOUVEAU.ouvert){ NOUVEAU.proche = null; direNv(''); } repeindreNouveau(NOUVEAU.ouvert ? '[name="nv-nom"]' : null); if(!NOUVEAU.ouvert) b.focus(); }
      else if(a === 'nv-annuler'){ NOUVEAU.ouvert = false; NOUVEAU.champs = {}; NOUVEAU.resultats = null; NOUVEAU.proche = null; direNv(''); repeindreNouveau();
        const bt = P().querySelector('[data-a="nouveau"]'); if(bt) bt.focus(); }
      else if(a === 'nv-chercher'){ chercherNv(); }
      else if(a === 'nv-prendre'){ prendreNv(Number(b.getAttribute('data-i'))); }
      else if(a === 'nv-creer'){ creerNv(b.hasAttribute('data-force')); }
      else if(a.indexOf('rp-') === 0){ rappro(a, b); }
      else if(a === 'exporter'){ exporter(FILTREE, 'liste'); }
      else if(a === 'brevo' || a === 'brevo-sel'){ versBrevo(a === 'brevo-sel', b); }
      else if(a === 'exporter-sel'){ exporter(LISTE.filter(function(c){ return SEL.has(c.id); }), 'selection'); }
      else if(a === 'tag-plus' || a === 'tag-moins'){ const i = document.getElementById('annuTag'); etiqueter(ids, i && i.value, a === 'tag-plus'); }
      else if(a === 'tag-filtre'){
        ETAT.tag = b.getAttribute('data-t'); MONTRES = PAS;
        const r = P().querySelector('.annu__replis'); if(r) r.open = true;
        const f = P().querySelector('.annu__filtres'); if(f) f.innerHTML = barreDesFiltres();
        majListe();
      }
      else if(a.indexOf('g-') === 0){
        const li = b.closest('li'); const t = li && li.getAttribute('data-t');
        if(a === 'g-voir'){ ETAT.tag = t; MONTRES = PAS; const f = P().querySelector('.annu__filtres'); if(f) f.innerHTML = barreDesFiltres(); majListe(); }
        else if(a === 'g-renommer'){ GERER_EDIT = t; GERER_ARME = null; repeindreGerer('.annu__gin'); }
        else if(a === 'g-annuler'){ GERER_EDIT = null; GERER_ARME = null; repeindreGerer(); }
        else if(a === 'g-ok'){ const i = li.querySelector('.annu__gin'); renommer(t, i && i.value); }
        else if(a === 'g-suppr'){
          if(GERER_ARME === t) supprimerEtiquette(t);
          else { GERER_ARME = t; GERER_EDIT = null; repeindreGerer('[data-a="g-suppr"]'); }
        }
      }
      else if(a === 'attribuer'){ const s = document.getElementById('annuProprio'); attribuer(ids, s && s.value); }
      else if(a === 'vue-enr'){
        const i = document.getElementById('annuVueNom'); const nom = i && i.value.trim();
        if(!nom){ status('error', 'Donne un nom à cette vue.'); if(i) i.focus(); return; }
        const filtres = {}; CLES_VUE.forEach(function(k){ if(ETAT[k] !== ETAT_VIDE[k]) filtres[k] = ETAT[k]; });
        BdvSync.ecrireVue(nom, filtres).then(function(v){
          if(!v){ status('error', 'La vue n’a pas pu être enregistrée.'); return; }
          status('success', 'Vue « ' + nom + ' » enregistrée pour tout le bureau.');
          return lireLesVues().then(repeindreBarres);
        });
      }else if(a === 'vue-suppr'){
        const s = document.getElementById('annuVue'); const id = s && s.value;
        const v = (VUES || []).filter(function(x){ return x.vue_id === id; })[0];
        if(!v){ status('error', 'Choisis d’abord la vue à supprimer.'); return; }
        BdvSync.supprimerVue(id).then(function(ok){
          status(ok ? 'success' : 'error', ok ? 'Vue « ' + v.nom + ' » supprimée.' : 'La vue n’a pas pu être supprimée.');
          return lireLesVues().then(repeindreBarres);
        });
      }
    });
    p.addEventListener('toggle', function(e){ if(e.target.classList && e.target.classList.contains('annu__gest')) GERER_OUVERT = e.target.open; }, true);
    p.addEventListener('keydown', function(e){
      if(!e.target.classList) return;
      if(e.target.classList.contains('annu__gin')){
        if(e.key === 'Enter'){ e.preventDefault(); const li = e.target.closest('li'); renommer(li.getAttribute('data-t'), e.target.value); }
        else if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); GERER_EDIT = null; repeindreGerer(); }
      }else if(e.target.id === 'annuTag' && e.key === 'Enter'){ e.preventDefault(); etiqueter(Array.from(SEL), e.target.value, true); }
      else if(e.key === 'Enter' && e.target.name && e.target.name.indexOf('nv-') === 0 && e.target.tagName === 'INPUT'){
        e.preventDefault(); if(e.target.name === 'nv-siret' || (e.target.name === 'nv-nom' && !NOUVEAU.champs.siret)) chercherNv(); else creerNv(false); }
    });
    /* Les nouveaux clients arrivent APRES la liste : on repeint en gardant ce qui est tape. */
    document.addEventListener('bdv:nouveaux', function(){
      const pp = P();
      if(!(pp && pp.classList.contains('on'))) return;
      if(NOUVEAU.ouvert) lireChamps();
      if(pp.querySelector('#annuCorps')){
        construire(); repeindreBarres(); majListe(); repeindreRappro(RAPPRO.focus ? 'button' : null); RAPPRO.focus = false;
        const sub = pp.querySelector('.panel__sub');
        if(sub) sub.textContent = phraseCompte() + ' Les coordonnées viennent de Vitisoft et se corrigent là-bas ; les étiquettes, le suivi et les vues sont communs à ton bureau.';
      }else peindre();
    });
    document.addEventListener('bdv:trombinoscope', function(){
      if(window.BdvCompte && BdvCompte.trombinoscope) BdvCompte.trombinoscope().then(function(t){ TROMBI = t; repeindreBarres(); majListe(); });
    });
  }

  /* Le moment ou la piece se montre : on peint tout de suite, et ce qui vient du compte
     (lot 33, trombinoscope, vues) repeint en arrivant. Rien ne fait attendre la liste. */
  /* UN « JE NE SAIS PAS » EST RETENU POUR LA SESSION, 29/09/2026, lot 44. Avant, une
     reponse nulle du lot 33 (hors ligne) remettait `_pret` a rien : `blocFiche()`
     redemandait, la reponse redessinait le suivi, qui rappelait `blocFiche()`... une
     boucle sans fin, onglet fige. Maintenant :
     - `_pret` n'est JAMAIS remis a rien : aucun dessin ne redemande ;
     - une reponse inconnue ne redessine rien (seul un `true` change la fiche) ;
     - UNE nouvelle tentative par session au plus, `retenter()`, sur un geste d'ecriture
       (`ecrireGroupe()`) ou au retour de visibilite de l'onglet, jamais sur un dessin.
     L'attribution reste fermee tant que LOT33 n'est pas `true` (`attribuer()`, lot 33), et
     `bdv-sync.js` repose de lui-meme la question avant d'ecrire un proprietaire. */
  let _pret = null, _repondu = false, _retente = false;
  function preparer(){
    if(_pret) return _pret;
    const attentes = [];
    if(window.BdvSync && BdvSync.lot33) attentes.push(BdvSync.lot33().then(function(v){ LOT33 = v; }).catch(function(){}));
    if(window.BdvCompte && BdvCompte.trombinoscope) attentes.push(BdvCompte.trombinoscope().then(function(t){ TROMBI = t; }).catch(function(){}));
    _pret = Promise.all(attentes).then(function(){ _repondu = true; });
    return _pret;
  }
  function retenter(){
    if(LOT33 !== null || !_repondu || _retente) return;
    if(!(window.BdvSync && BdvSync.lot33)) return;
    _retente = true;
    BdvSync.lot33().then(function(v){
      LOT33 = v;
      if(v !== true) return;                     // toujours inconnu, ou refuse : rien a repeindre
      const p = P();
      if(p && p.classList.contains('on') && p.querySelector('.annu')){ repeindreBarres(); majListe(); }
      if(typeof redessinerSuivi === 'function' && typeof FICHE_ID !== 'undefined' && FICHE_ID) redessinerSuivi(FICHE_ID);
    }).catch(function(){});
  }
  document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'visible') retenter(); });
  function ouvrir(){
    try{
      const t = sessionStorage.getItem('bdv_annu_tag');
      if(t){ sessionStorage.removeItem('bdv_annu_tag'); ETAT = Object.assign({}, ETAT_VIDE, { tag: t }); MONTRES = PAS; }
    }catch(e){}
    peindre();
    if(NV()) NV().charger();
    preparer().then(lireLesVues).then(function(){ repeindreBarres(); majListe(); }).catch(function(){});
  }

  /* LA FICHE, DANS SON BLOC DE SUIVI : qui suit ce client, et qui a fait le dernier geste.
     Appele par `suiviCorps()` de bdv-ecrans.js, qui reste l'unique auteur de la fiche :
     ce morceau ne s'affiche que la ou elle le pose. */
  function blocFiche(id, s){
    s = s || {};
    let h = '';
    /* Ouverte depuis « Ma journee » ou en pleine page, la fiche arrive avant que la piece
       ait demande au compte si le lot 33 est passe : on le demande ici, et la fiche se
       redessine a la reponse. Une seule fois par session : `_pret` n'est plus jamais
       remis a rien (lot 44), et seule une reponse `true` redessine. */
    if(LOT33 === null && !_pret) preparer().then(function(){
      if(LOT33 !== true) return;
      if(typeof redessinerSuivi === 'function' && typeof FICHE_ID !== 'undefined' && FICHE_ID === id) redessinerSuivi(id);
    });
    const t = TROMBI;
    if(LOT33 === true && t && t.combien > 1){
      const arg = JSON.stringify(String(id)).replace(/"/g, '&quot;');
      const membres = Object.keys(t.gens).map(function(u){ return [u, u === moi() ? 'Moi' : t.gens[u]]; });
      h += '<div class="action__proprio"><label class="action__lbl" for="ficheProprio">Suivi par</label>'
        + '<select id="ficheProprio" onchange="BdvAnnuaire.attribuer([' + arg + '],this.value)">'
        + options(membres, s.proprietaire || '', 'Personne') + '</select></div>';
    }
    const qui = (s.maj_par && window.BdvCompte && BdvCompte.mentionAuteur) ? BdvCompte.mentionAuteur(s.maj_par) : null;
    if(qui) h += '<p class="note action__auteur">Dernier geste sur cette fiche : ' + esc(qui.replace(/^de /, '').replace(/^d’un /, 'un ')) + '.</p>';
    return h;
  }

  /* LOT 89 : LA LISTE VERS BREVO. « Vers Brevo » prend la liste filtree (a cote d'« Exporter
     la liste ») ou la selection (dans la barre de selection). Le bouton n'existe que si Brevo
     est branche sur le bureau. Le nom propose dit d'ou vient la liste. */
  function brevoPret(){ return !!(window.BdvBrevoListes && BdvBrevoListes.pret()); }
  function titreBrevo(sel){
    if(sel) return 'Mes clients, sélection';
    const e = ETAT, l = [];
    const etats = { actif: 'actifs', dormant: 'dormants', sans: 'sans commande', nouveau: 'pas encore dans Vitisoft' };
    if(e.tag) l.push(e.tag);
    if(e.type) l.push(e.type);
    if(e.canal) l.push(e.canal);
    if(e.pays) l.push(e.pays);
    if(e.etat && etats[e.etat]) l.push(etats[e.etat]);
    if(e.q) l.push('« ' + e.q + ' »');
    return 'Mes clients' + (l.length ? ', ' + l.join(', ') : '');
  }
  function versBrevo(sel, bouton){
    const z = document.getElementById('annuBrevo');
    if(!z || !brevoPret()) return;
    /* Une fonction, pas une liste : le bloc la relit quand les filtres ou la selection bougent. */
    const ids = sel
      ? function(){ const vus = new Set(FILTREE.map(function(c){ return c.id; }));
          return FILTREE.filter(function(c){ return SEL.has(c.id); }).concat(LISTE.filter(function(c){ return SEL.has(c.id) && !vus.has(c.id); })).map(function(c){ return c.id; }); }
      : function(){ return FILTREE.map(function(c){ return c.id; }); };
    BdvBrevoListes.ouvrir({ cible: z, source: 'clients', titre: titreBrevo(sel), ids: ids, bouton: bouton });
  }
  /* Lot 90 : une marque est apparue (adresse morte, desinscrite) : la liste se redessine. */
  document.addEventListener('bdv:retours', function(){
    const p = P();
    if(p && p.classList.contains('on') && p.querySelector('.annu')) majListe();
  });
  /* Brevo lu, branche ou retire : le bouton apparait ou part, sans repeindre la piece. */
  document.addEventListener('bdv:brevo', function(){
    const p = P(); if(!p) return;
    const b = p.querySelector('[data-a="brevo"]'); if(b) b.hidden = !brevoPret();
    const lot = p.querySelector('#annuLot'); if(lot && SEL.size) lot.innerHTML = barreDeSelection();
    if(!brevoPret()){ const z = document.getElementById('annuBrevo'); const o = window.BdvBrevoListes && BdvBrevoListes._etat(); if(z && o && o.cible === z) BdvBrevoListes.fermer(); }
  });

  window.bdvCrmAChange = function(){
    const p = P();
    if(p && p.classList.contains('on') && p.querySelector('.annu')){ repeindreBarres(); majListe(); }
  };

  window.BdvAnnuaire = { peindre: ouvrir, attribuer: attribuer, etiqueter: etiqueter, blocFiche: blocFiche, nomDe: nomDe,
    proches: proches, etiquettes: etiquettes, voirEtiquette: voirEtiquette, renommerEtiquette: renommer, supprimerEtiquette: supprimerEtiquette,
    _maj: function(){ majListe(); },
    _etat: function(){ return { ETAT: ETAT, LISTE: LISTE, FILTREE: FILTREE, SEL: SEL, LOT33: LOT33, VUES: VUES }; } };
})();
