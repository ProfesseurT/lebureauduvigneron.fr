/* ===========================================================================
   LE BUREAU DU VIGNERON — MES TACHES
   ===========================================================================
   Demande par Ted le 07/09/2026. LE PERIMETRE A ETE TRANCHE AVANT D'ECRIRE UNE
   LIGNE, et il faut le garder : cette piece porte DEUX natures de choses a
   faire, pas trois.

     1. Ce que le vigneron ecrit lui-meme. Rien ne peut le calculer :
        « commander des bouchons », « rappeler le comptable ».
     2. Les obligations du calendrier (DRM, DAI, recolte, facturation), qu'on
        peut enfin cocher. Jusqu'ici le bureau les annoncait sans jamais
        pouvoir apprendre qu'elles etaient faites.

   ET PAS LES CLIENTS A RAPPELER. Ils restent au sous-main, avec leurs trois
   gestes qui repoussent le rappel (cf. bdv-crm.js). Les faire entrer ici
   donnerait deux endroits qui repondent « qui dois-je appeler » et qui se
   contrediraient des le premier geste pose d'un cote. Ne pas les ramener sans
   supprimer le sous-main dans le meme mouvement.

   CE QU'UNE OBLIGATION COCHEE VEUT DIRE. Une DRM revient tous les 10 du mois :
   ce qui est fait, ce n'est pas « la DRM », c'est LA DRM DU 10 SEPTEMBRE. La
   ligne porte donc l'occurrence dans son identifiant, `ech:drm:2026-09-10`, et
   celle d'octobre arrive vierge toute seule, sans tache planifiee ni calcul
   cote serveur. Decocher une obligation SUPPRIME la ligne : il n'y a rien a
   retenir d'une obligation pas encore faite.

   Le miroir local n'est pas un stockage, c'est un miroir. Le serveur fait foi a
   chaque chargement, et une ecriture refusee part dans une file d'attente qui
   se rejoue au prochain passage. Meme regle que les signets, meme piege evite :
   `id` est pose au moment de l'ENVOI et jamais chez l'appelant, sinon une ligne
   enfilee hors ligne repartirait sans identifiant de compte jusqu'a la fin des
   temps (cf. la panne des signets du 07/09/2026).
   =========================================================================== */
(function () {
  'use strict';

  var CACHE_KEY   = 'bdv_taches_v1';
  var ATTENTE_KEY = 'bdv_taches_attente';
  var JOUR = 24 * 3600 * 1000;

  /* ---------------- LE MIROIR ET LA FILE ---------------- */
  function lireCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { return {}; }
  }
  function ecrireCache(map) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function session() { return (window.BdvCompte && BdvCompte.session()) || null; }
  function pret() { return !!(window.BdvCompte && BdvCompte.monId && BdvCompte.monId()); }

  function lireAttente() {
    try { return JSON.parse(localStorage.getItem(ATTENTE_KEY)) || {}; } catch (e) { return {}; }
  }
  function enfiler(tid, ligne) {
    var f = lireAttente();
    f[tid] = ligne;              // seul le dernier etat d'une tache compte
    try { localStorage.setItem(ATTENTE_KEY, JSON.stringify(f)); } catch (e) {}
  }
  async function viderAttente() {
    var f = lireAttente(), tids = Object.keys(f);
    if (!tids.length || !pret()) return;
    var restant = {};
    for (var i = 0; i < tids.length; i++) {
      var l = f[tids[i]];
      try {
        // Une SUPPRESSION en attente se rejoue comme une suppression. Rejouee en
        // ecriture elle recreerait la tache que le vigneron a retiree : le meme
        // defaut que les signets, ou une suppression repartait en `etat: null`.
        if (l === null) await retirer(tids[i]);
        else await pousser(l);
      } catch (e) { restant[tids[i]] = l; }
    }
    try {
      if (Object.keys(restant).length) localStorage.setItem(ATTENTE_KEY, JSON.stringify(restant));
      else localStorage.removeItem(ATTENTE_KEY);
    } catch (e) {}
  }

  /* ---------------- LE SERVEUR ---------------- */
  function pousser(ligne) {
    var moi = BdvCompte.monId();
    if (!moi) return Promise.reject(new Error('pas de session'));
    return BdvCompte.api('/taches?on_conflict=id,tache_id', {
      methode: 'POST',
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      corps: [Object.assign({}, ligne, { id: moi })]
    });
  }
  function retirer(tid) {
    var moi = BdvCompte.monId();
    if (!moi) return Promise.reject(new Error('pas de session'));
    // Le filtre nomme les DEUX colonnes de la cle. La politique RLS suffirait, mais une
    // requete qui dit exactement ce qu'elle supprime ne depend pas d'une politique.
    return BdvCompte.api('/taches?id=eq.' + encodeURIComponent(moi)
      + '&tache_id=eq.' + encodeURIComponent(tid), { methode: 'DELETE' });
  }
  async function charger() {
    if (!pret()) return;
    try {
      var lignes = await BdvCompte.api('/taches?select=tache_id,titre,source,ref,echue_le,fait_le,maj_le');
      if (!lignes) return;       // null = session tombee ou corps vide, on garde le miroir
      var map = {};
      lignes.forEach(function (l) { map[l.tache_id] = l; });
      ecrireCache(map);
      rendre();
    } catch (e) { /* le miroir precedent reste affiche, c'est mieux que rien */ }
  }

  /* ---------------- LES DEUX SOURCES, FUSIONNEES ----------------
     Les obligations ne sont PAS stockees : elles sont calculees par
     bdv-echeances.js, seule logique de calcul du site. Ce que la base porte,
     c'est uniquement celles qui ont ete cochees. Deposer les cinq obligations en
     base a la creation du compte aurait fige un calendrier qui change. */
  function minuit(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }
  function idOccurrence(cle, d) { return 'ech:' + cle + ':' + iso(d); }

  function obligations() {
    if (!window.BdvEcheances) return [];
    var brut = BdvEcheances.depuisLaPage('bdvEcheances');
    if (!brut.length) return [];
    var map = lireCache();
    // Une seule occurrence par obligation, la prochaine : c'est ce que calculer() rend.
    // Les obligations deja en vigueur (jours < 0) ne sont pas des taches, ce sont des
    // etats du monde : on ne coche pas « la facturation electronique est obligatoire ».
    return BdvEcheances.calculer(brut).filter(function (x) { return x.jours >= 0; })
      .map(function (x) {
        var tid = idOccurrence(x.e.cle, x.date);
        var l = map[tid];
        return {
          tache_id: tid, titre: x.e.titre, source: 'echeance', ref: x.e.cle,
          echue_le: iso(x.date), fait_le: (l && l.fait_le) || null,
          jours: x.jours, lien: '/outils/echeances/'
        };
      });
  }

  function libres() {
    var map = lireCache(), auj = minuit(new Date()), out = [];
    Object.keys(map).forEach(function (k) {
      var l = map[k];
      if (!l || l.source === 'echeance') return;
      var j = null;
      if (l.echue_le) {
        var d = minuit(new Date(l.echue_le + 'T00:00:00'));
        if (!isNaN(d)) j = Math.round((d - auj) / JOUR);
      }
      out.push({ tache_id: k, titre: l.titre || '', source: 'libre', ref: null,
                 echue_le: l.echue_le || null, fait_le: l.fait_le || null, jours: j });
    });
    return out;
  }

  /* Sans date, une tache n'est ni en retard ni pressante : elle attend. Elle passe donc
     APRES tout ce qui porte une date, et pas avant, sinon une note ecrite en passant
     couvrirait une DRM qui tombe demain. */
  function rang(t) { return t.jours === null ? 99999 : t.jours; }
  function toutes() {
    return obligations().concat(libres()).sort(function (a, b) { return rang(a) - rang(b); });
  }

  /* ---------------- LES MOTS DU TEMPS ----------------
     Les memes que le calendrier, volontairement : le vigneron lit « Dans 3 jours »
     au meme endroit du sens, qu'il regarde ses obligations ou ses taches. */
  function quand(t) {
    if (t.jours === null) return '';
    // « En retard de 2 jours » et pas « Il y a 2 jours » : la seconde formule dit quand
    // c'etait, la premiere dit ce qu'on doit faire. Une liste de taches parle du present.
    if (t.jours < 0) return t.jours === -1 ? 'En retard d’un jour' : 'En retard de ' + (-t.jours) + ' jours';
    if (t.jours === 0) return "C'est aujourd'hui";
    if (t.jours === 1) return 'Demain';
    return 'Dans ' + t.jours + ' jours';
  }
  function ton(t) {
    if (t.fait_le) return 'fait';
    if (t.jours === null) return '';
    if (t.jours < 0) return 'retard';
    if (t.jours === 0) return 'aujourdhui';
    if (t.jours <= 7) return 'urgent';
    return '';
  }
  function dateCourte(isoJour) {
    var d = new Date(isoJour + 'T00:00:00');
    return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  /* ---------------- LES GESTES ----------------
     L'ecran repond tout de suite, le reseau suit. Un geste qui attendrait la reponse
     donnerait l'impression d'un clic rate sur un reseau de cave. */
  function ecrire(tid, ligne) {
    var map = lireCache();
    if (ligne === null) delete map[tid]; else map[tid] = ligne;
    ecrireCache(map);
    rendre();
    if (!pret()) { enfiler(tid, ligne); return; }
    (ligne === null ? retirer(tid) : pousser(ligne)).catch(function () { enfiler(tid, ligne); });
  }

  function ajouter(titre, echueLe) {
    titre = String(titre || '').trim();
    if (!titre) return false;
    var tid = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    var maintenant = new Date().toISOString();
    ecrire(tid, { tache_id: tid, titre: titre, source: 'libre', ref: null,
                  echue_le: echueLe || null, fait_le: null,
                  cree_le: maintenant, maj_le: maintenant });
    return true;
  }

  function basculer(tid) {
    var t = toutes().filter(function (x) { return x.tache_id === tid; })[0];
    if (!t) return;
    var maintenant = new Date().toISOString();
    // DECOCHER UNE OBLIGATION SUPPRIME SA LIGNE. Une obligation pas faite est l'etat par
    // defaut du monde, il n'y a rien a stocker pour le dire ; garder une ligne a fait_le
    // nul remplirait la table d'occurrences vides que plus aucun ecran ne montre.
    if (t.fait_le && t.source === 'echeance') { ecrire(tid, null); return; }
    ecrire(tid, { tache_id: tid, titre: t.titre, source: t.source, ref: t.ref,
                  echue_le: t.echue_le, fait_le: t.fait_le ? null : maintenant,
                  maj_le: maintenant });
  }
  function supprimer(tid) { ecrire(tid, null); }

  /* ---------------- CE QUE LE CALENDRIER APPELLE ----------------
     Ajoute le 08/09/2026, lot 1 du chantier calendrier. La piece « Le
     calendrier » et cette piece-ci peuvent toutes les deux cocher une
     obligation, et c'est une demande de Ted. C'EST SANS DANGER A UNE SEULE
     CONDITION, et ces deux fonctions sont cette condition : les deux ecrivent
     LA MEME LIGNE, `ech:<cle>:<AAAA-MM-JJ>`, par le meme chemin. Le jour ou le
     calendrier se donnera son propre stockage de « fait », les deux pieces se
     contrediront au premier geste pose d'un cote.

     POURQUOI basculer() NE SUFFISAIT PAS. Elle cherche sa tache dans toutes(),
     qui ne connait que la PROCHAINE occurrence de chaque obligation. Le
     calendrier, lui, affiche octobre en septembre : il doit pouvoir cocher une
     DRM que toutes() n'a jamais listee. La ligne est donc construite ici, et
     pas chez l'appelant, pour que ce fichier reste le seul endroit qui ecrive
     dans la table des taches. */
  function estFaite(tid) {
    var l = lireCache()[tid];
    return !!(l && l.fait_le);
  }

  function basculerOccurrence(cle, titre, jourIso) {
    if (!cle || !jourIso) return false;
    var tid = idOccurrence(cle, minuit(new Date(jourIso + 'T00:00:00')));
    var maintenant = new Date().toISOString();
    // Decocher SUPPRIME la ligne, exactement comme dans basculer() : une
    // obligation pas faite est l'etat par defaut du monde, il n'y a rien a
    // stocker pour le dire.
    if (estFaite(tid)) { ecrire(tid, null); return false; }
    ecrire(tid, { tache_id: tid, titre: titre || cle, source: 'echeance', ref: cle,
                  echue_le: jourIso, fait_le: maintenant, maj_le: maintenant });
    return true;
  }

  /* ---------------- L'ECRAN ----------------
     Aucune donnee du vigneron ne passe par une chaine HTML : enveloppes construites
     ici, textes poses en textContent. Regle du bureau, pas une precaution de style. */
  function el(id) { return document.getElementById(id); }

  function ligne(t) {
    var li = document.createElement('li');
    li.className = 'tache';
    li.setAttribute('data-fait', t.fait_le ? 'oui' : 'non');
    var to = ton(t); if (to) li.setAttribute('data-ton', to);

    var coche = document.createElement('button');
    coche.type = 'button';
    coche.className = 'tache__coche';
    coche.setAttribute('data-tache-coche', t.tache_id);
    coche.setAttribute('aria-pressed', t.fait_le ? 'true' : 'false');
    coche.title = t.fait_le ? 'Remettre à faire' : 'Marquer comme fait';
    coche.setAttribute('aria-label', coche.title);
    li.appendChild(coche);

    var corps = document.createElement('span');
    corps.className = 'tache__corps';
    var titre = document.createElement('span');
    titre.className = 'tache__titre';
    titre.textContent = t.titre;
    corps.appendChild(titre);

    var bas = document.createElement('span');
    bas.className = 'tache__quand';
    var mots = [];
    if (t.echue_le) mots.push(quand(t), dateCourte(t.echue_le));
    if (t.source === 'echeance') mots.push('obligation');
    bas.textContent = mots.filter(Boolean).join(' · ');
    if (bas.textContent) corps.appendChild(bas);
    li.appendChild(corps);

    if (t.source === 'echeance') {
      // Le lien vers la piece qui porte les sources officielles : cocher une DRM sans
      // pouvoir relire ce qu'elle exige serait un piege. Depuis le 08/09/2026 c'est la
      // PIECE du bureau et plus la page publique : on ne sort pas du bureau pour lire
      // ce qu'une obligation exige.
      var a = document.createElement('a');
      a.className = 'tache__source';
      a.href = '/mon-bureau/#calendrier';
      a.textContent = 'Ce que ça exige';
      li.appendChild(a);
    } else {
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'tache__x';
      x.setAttribute('data-tache-suppr', t.tache_id);
      x.textContent = 'Retirer';
      x.title = 'Retirer cette tâche';
      li.appendChild(x);
    }
    return li;
  }

  function bloc(hote, titre, liste, vide) {
    if (!hote) return;
    hote.innerHTML = '';
    var h = document.createElement('h3');
    h.className = 'taches__titre';
    h.textContent = titre + (liste.length ? ' · ' + liste.length : '');
    hote.appendChild(h);
    if (!liste.length) {
      var p = document.createElement('p');
      p.className = 'taches__vide';
      p.textContent = vide;
      hote.appendChild(p);
      return;
    }
    var ul = document.createElement('ul');
    ul.className = 'taches__liste';
    liste.forEach(function (t) { ul.appendChild(ligne(t)); });
    hote.appendChild(ul);
  }

  function rendre() {
    /* Le panneau de liege est repeint AVANT le test de sortie : ses punaises viennent
       d'ici, et elles doivent se mettre a jour meme quand la piece Mes taches n'a
       jamais ete ouverte. C'est le cas normal, pas un cas limite : on arrive sur
       « Ma journee », et c'est la qu'on doit voir ce qui presse. */
    if (window.bdvMajPanneau) { try { window.bdvMajPanneau(); } catch (e) {} }
    /* ET ON PREVIENT LE RESTE DU BUREAU, par un evenement et pas par un appel.
       La piece « Le calendrier » arrive au premier clic, ce fichier part avec la
       page : un appel direct d'ici vers elle serait, la plupart du temps, un
       appel a quelque chose qui n'existe pas encore. L'evenement est pose AVANT
       le test de sortie ci-dessous, parce que le calendrier doit se repeindre
       meme quand la piece « Mes taches » n'a jamais ete ouverte. */
    try { document.dispatchEvent(new CustomEvent('bdv:taches')); } catch (e) {}
    if (!el('tachesAFaire')) return;
    var t = toutes();
    var afaire = t.filter(function (x) { return !x.fait_le; });
    // Les faites, les vingt dernieres et les plus recentes d'abord : la liste des choses
    // faites est une preuve, pas un archivage. Au-dela, elle repousse le reste de l'ecran.
    var faites = t.filter(function (x) { return x.fait_le; })
      .sort(function (a, b) { return String(b.fait_le).localeCompare(String(a.fait_le)); })
      .slice(0, 20);
    bloc(el('tachesAFaire'), 'À faire', afaire,
      'Rien à faire pour l’instant. Tes obligations du calendrier arrivent ici toutes seules.');
    bloc(el('tachesFaites'), 'Fait', faites, 'Rien de coché pour le moment.');
    var n = el('tachesNote');
    if (n) {
      var retard = afaire.filter(function (x) { return x.jours !== null && x.jours < 0; }).length;
      n.textContent = retard ? (retard > 1 ? retard + ' en retard' : '1 en retard') : '';
    }
  }

  /* ---------------- LES PUNAISES DU PANNEAU ----------------
     Ted : « mes taches alimentera les post it ». Trois au plus, et seulement ce qui
     presse : un panneau de liege ou l'on epingle tout n'est plus un panneau, c'est un
     mur. Le reste s'ouvre en un clic sur la punaise. */
  function punaises() {
    var afaire = toutes().filter(function (x) { return !x.fait_le; });
    var presse = afaire.filter(function (x) { return x.jours !== null && x.jours <= 7; });
    var out = presse.slice(0, 3).map(function (t) {
      return {
        valeur: t.jours < 0 ? 'en retard' : (t.jours === 0 ? 'aujourd’hui' : (t.jours === 1 ? 'demain' : 'dans ' + t.jours + 'j')),
        libelle: t.titre,
        sous: t.source === 'echeance' ? 'obligation' : 'ta tâche',
        ton: t.jours < 0 ? 'vieux' : '',
        href: '/mon-bureau/#taches'
      };
    });
    var reste = afaire.length - presse.slice(0, 3).length;
    if (reste > 0) out.push({
      valeur: String(reste), libelle: reste > 1 ? 'autres tâches' : 'autre tâche',
      sous: 'dans Mes tâches', href: '/mon-bureau/#taches'
    });
    return out;
  }

  /* ---------------- BRANCHEMENTS ---------------- */
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('[data-tache-coche]');
    if (c) { e.preventDefault(); basculer(c.getAttribute('data-tache-coche')); return; }
    var s = e.target.closest && e.target.closest('[data-tache-suppr]');
    if (s) { e.preventDefault(); supprimer(s.getAttribute('data-tache-suppr')); }
  });

  function brancherForm() {
    var f = el('tachesForm');
    if (!f || f.dataset.branche) return;
    f.dataset.branche = '1';
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var champ = el('tachesTitre'), date = el('tachesDate');
      if (!ajouter(champ.value, date && date.value ? date.value : null)) { champ.focus(); return; }
      champ.value = '';
      if (date) date.value = '';
      champ.focus();               // on en ecrit rarement une seule
    });
  }

  /* Appelee par la barre a chaque ouverture de la piece. Idempotente : le premier appel
     lit le serveur, les suivants repeignent. Elle ne bloque jamais l'affichage sur le
     reseau, contrairement au moteur des ventes : il n'y a rien a calculer ici. */
  var LU = false;
  function ouvrir() {
    brancherForm();
    rendre();
    if (!LU && pret()) { LU = true; viderAttente().then(charger); }
  }

  document.addEventListener('bdv:session', function () {
    LU = false;
    if (pret()) { LU = true; viderAttente().then(charger); }
    else { ecrireCache({}); rendre(); }   // les taches du precedent ne sont pas les siennes
  });

  /* PREMIERE LECTURE AU CHARGEMENT DE LA PAGE, et pas a l'ouverture de la piece. Le
     panneau de « Ma journee » affiche des punaises de taches : les attendre pour un clic
     sur « Mes taches » les aurait rendues vides chez quelqu'un qui n'ouvre jamais la
     piece, ce qui est exactement le vigneron a qui elles servent le plus. La file
     d'attente part d'abord, la lecture ensuite : l'inverse ecrase un geste fait hors
     ligne par une reponse serveur plus vieille que lui (panne des signets, 07/09/2026). */
  if (pret()) { LU = true; viderAttente().then(charger); } else { rendre(); }

  window.BdvTaches = {
    ouvrir: ouvrir, rendre: rendre, charger: charger, punaises: punaises,
    ajouter: ajouter, basculer: basculer, supprimer: supprimer, toutes: toutes,
    estFaite: estFaite, basculerOccurrence: basculerOccurrence
  };
})();
