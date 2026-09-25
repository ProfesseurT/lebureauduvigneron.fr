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
     2. SEULS LES CLIENTS DES EXPORTS entrent dans la base : la liste se CALCULE
        sur les lignes de vente, elle ne se saisit pas. Pas de creation a la main.
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
    LISTE = Array.from(m.values()).map(function(c){
      c.nom = c.nom || c.id;
      c.canal = plusFrequent(c.canaux);
      c.type = plusFrequent(c.types);
      c.cmd = c.fact.size;
      c.silence = c.der == null ? null : JOUR_MAX - c.der;
      c.etat = c.der == null ? 'sans' : (c.silence <= DORMANT_J ? 'actif' : 'dormant');
      c.cle = norm([c.nom, c.num, c.ville, c.cp].join(' '));
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
        const mails = (emailsOf(c.id) || []).join(' ').toLowerCase();
        const chiffres = q.replace(/\D/g, '');
        const tels = (telsOf(c.id) || []).map(function(t){ return String(t.appel || '').replace(/\D/g, ''); }).join(' ');
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
    const sous = [c.num && c.num !== c.nom ? 'n°' + c.num : '', [c.cp, c.ville].filter(Boolean).join(' '), c.pays && !/^france$/i.test(c.pays) ? c.pays : '']
      .filter(Boolean).join(' · ');
    let action = '<span class="annu__vide">—</span>';
    if(s.statut === 'traite') action = '<span class="annu__vide">Mis de côté</span>';
    else if(s.rappel) action = '<span class="annu__rap' + (er === 'retard' ? ' annu__rap--retard' : '') + '">'
      + (er === 'retard' ? '<span class="hors-ecran">En retard : </span>' : '') + esc(fmtDateIso(s.rappel)) + '</span>'
      + (s.rappel_titre ? '<span class="annu__motif">' + esc(s.rappel_titre) + '</span>' : '');
    const ca = c.ca ? fmtMoney(c.ca) : '<span class="annu__vide">—</span>';
    const caP = c.caPrev ? fmtMoney(c.caPrev) : '<span class="annu__vide">—</span>';
    const der = c.derDate ? fmtDate(c.derDate) + (c.etat === 'dormant' ? ' <span class="annu__dormant">dormant</span>' : '') : '<span class="annu__vide">aucune</span>';
    return '<tr class="annu__l' + (coche ? ' is-coche' : '') + '" data-id="' + esc(c.id) + '">'
      + '<td class="annu__coche"><input type="checkbox" data-a="coche"' + (coche ? ' checked' : '') + ' aria-label="Sélectionner ' + esc(c.nom) + '"></td>'
      + '<td><a class="annu__nom" href="/mon-bureau/#fiche=' + esc(encId(c.id)) + '">' + esc(c.nom) + '</a>'
      + (sous ? '<span class="annu__sous">' + esc(sous) + '</span>' : '') + '</td>'
      + '<td>' + esc(c.canal || '') + '</td>'
      + '<td>' + der + '</td>'
      + '<td class="num">' + fmtNum(c.cmd) + '</td>'
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
      + '<select data-f="etat" aria-label="Activité">' + options([['actif', 'Actifs (moins d’un an)'], ['dormant', 'Dormants (plus d’un an)'], ['sans', 'Sans commande']], e.etat, 'Actifs et dormants') + '</select>'
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
          : '<span class="annu__note">' + (LOT33 === false ? 'L’attribution arrive avec la prochaine mise à jour de ton compte.' : 'L’attribution demande un bureau à plusieurs (pièce L’équipe).') + '</span>')
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
  }

  function peindre(){
    const p = P(); if(!p) return;
    brancher();
    if(!(ROWS && ROWS.length)){
      p.innerHTML = '<h2 class="panel__title titre-piece">Mes clients</h2><p class="panel__sub">Tes clients apparaîtront ici dès que ton premier export Vitisoft sera déposé.</p>';
      return;
    }
    construire();
    // Une selection qui designe un client disparu de la base (base videe, autre bureau) ne vaut rien.
    const ids = new Set(LISTE.map(function(c){ return c.id; }));
    Array.from(SEL).forEach(function(id){ if(!ids.has(id)) SEL.delete(id); });
    p.innerHTML = '<h2 class="panel__title titre-piece">Mes clients</h2>'
      + '<p class="panel__sub">Tous les clients de tes exports, ' + plur(LISTE.length, 'client') + '. '
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
      +     '<button type="button" class="btn btn--ghost btn--sm" data-a="exporter">Exporter la liste</button></div>'
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

  /* ------------------------------------------------------------------ ecriture groupee */
  /* LES GESTES GROUPES PASSENT PAR LA MEME MEMOIRE QUE LA FICHE : CRM, crmSave(), puis
     le serveur. Jamais une ecriture a cote : deux chemins qui ecrivent le suivi finiraient
     par se contredire sur une etiquette. L'ecriture part EN UNE FOIS, par tranches de
     LOT_ENVOI ; une fiche que le geste a videe passe, elle, par `syncSuivi()` qui sait la
     supprimer. */
  async function ecrireGroupe(ids, modifier, libelle){
    if(!ids.length) return;
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
    if(LOT33 !== true){ status('error', 'L’attribution arrive avec la prochaine mise à jour de ton compte.'); return; }
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
      aoa.push([c.nom, c.num, c.cp, c.ville, c.pays, c.canal, c.type, emailOf(c.id), telOf(c.id),
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
      else if(a === 'exporter'){ exporter(FILTREE, 'liste'); }
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
    });
    document.addEventListener('bdv:trombinoscope', function(){
      if(window.BdvCompte && BdvCompte.trombinoscope) BdvCompte.trombinoscope().then(function(t){ TROMBI = t; repeindreBarres(); majListe(); });
    });
  }

  /* Le moment ou la piece se montre : on peint tout de suite, et ce qui vient du compte
     (lot 33, trombinoscope, vues) repeint en arrivant. Rien ne fait attendre la liste. */
  let _pret = null;
  function preparer(){
    if(_pret) return _pret;
    const attentes = [];
    if(window.BdvSync && BdvSync.lot33) attentes.push(BdvSync.lot33().then(function(v){ LOT33 = v; }));
    if(window.BdvCompte && BdvCompte.trombinoscope) attentes.push(BdvCompte.trombinoscope().then(function(t){ TROMBI = t; }).catch(function(){}));
    _pret = Promise.all(attentes).then(function(){ if(LOT33 === null) _pret = null; });   // un « je ne sais pas » se redemande
    return _pret;
  }
  function ouvrir(){
    try{
      const t = sessionStorage.getItem('bdv_annu_tag');
      if(t){ sessionStorage.removeItem('bdv_annu_tag'); ETAT = Object.assign({}, ETAT_VIDE, { tag: t }); MONTRES = PAS; }
    }catch(e){}
    peindre();
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
       redessine a la reponse. Une seule fois par session. */
    if(LOT33 === null && !_pret) preparer().then(function(){
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

  window.bdvCrmAChange = function(){
    const p = P();
    if(p && p.classList.contains('on') && p.querySelector('.annu')){ repeindreBarres(); majListe(); }
  };

  window.BdvAnnuaire = { peindre: ouvrir, attribuer: attribuer, etiqueter: etiqueter, blocFiche: blocFiche, nomDe: nomDe,
    etiquettes: etiquettes, voirEtiquette: voirEtiquette, renommerEtiquette: renommer, supprimerEtiquette: supprimerEtiquette,
    _maj: function(){ majListe(); },
    _etat: function(){ return { ETAT: ETAT, LISTE: LISTE, FILTREE: FILTREE, SEL: SEL, LOT33: LOT33, VUES: VUES }; } };
})();
