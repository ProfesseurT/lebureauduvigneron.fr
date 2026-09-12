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
      var lignes = await BdvCompte.api('/taches?select=tache_id,titre,source,ref,echue_le,fin_le,fait_le,maj_le');
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

  /* ---------------- LES FAMILLES AFFICHEES ICI ----------------
     REGRESSION CORRIGEE LE 08/09/2026, ET IL FAUT SAVOIR COMMENT ELLE EST
     ARRIVEE. Cette fonction prend TOUT le fichier de donnees. Jusqu'au lot 2 il
     portait cinq obligations, et la regle 7 de CLAUDE.md tenait toute seule.
     Le lot 2 y a ajoute les travaux du domaine, les salons et les temps forts
     commerciaux : « Mes taches » est passee de 5 lignes a 28, et s'est mise a
     proposer de cocher « Taille de la vigne » comme une DRM.

     PERSONNE NE L'A VU, et le banc non plus : son bac d'essai ne contient qu'une
     seule echeance, une DRM. Un jeu d'essai plus petit que la realite ne verifie
     que ce qu'il contient. Le banc en porte desormais une de chaque famille.

     LES DEFAUTS NE SONT PAS CEUX DU CALENDRIER, et c'est voulu. Le calendrier
     montre tout, c'est une carte : on veut y voir les vendanges. Une liste de
     choses a faire, non : elle ne porte que ce qui se coche vraiment, les
     obligations et ce que le vigneron a note. Les reperes de saison s'y
     rallument d'un clic pour qui les veut. */
  var FAM_KEY = 'bdv_taches_familles';
  var ETEINTES_PAR_DEFAUT = ['travaux', 'rendezvous', 'tempsforts'];

  function famillesEteintes() {
    try {
      var brut = JSON.parse(localStorage.getItem(FAM_KEY));
      return Array.isArray(brut) ? brut : ETEINTES_PAR_DEFAUT.slice();
    } catch (e) { return ETEINTES_PAR_DEFAUT.slice(); }
  }
  function familleAffichee(cle) { return famillesEteintes().indexOf(cle) < 0; }
  function basculerFamille(cle) {
    var off = famillesEteintes(), i = off.indexOf(cle);
    if (i >= 0) off.splice(i, 1); else off.push(cle);
    try { localStorage.setItem(FAM_KEY, JSON.stringify(off)); } catch (e) {}
    rendre();
  }
  /* La liste montree par le filtre : les quatre familles du fichier de donnees,
     plus « Mes notes », qui n'en vient pas. Elle est lue chez BdvEcheances pour
     ne pas exister a deux endroits. */
  function famillesDuFiltre() {
    var l = (window.BdvEcheances && BdvEcheances.familles) || [];
    return l.map(function (f) {
      return f.cle === 'taches'
        ? { cle: 'notes', label: 'Mes notes', quoi: 'Ce que j’ai écrit moi-même' }
        : f;
    });
  }

  function obligations() {
    if (!window.BdvEcheances) return [];
    var brut = BdvEcheances.depuisLaPage('bdvEcheances').filter(function (e) {
      return familleAffichee(e.famille || 'obligations');
    });
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
    if (!familleAffichee('notes')) return [];
    var map = lireCache(), auj = minuit(new Date()), out = [];
    Object.keys(map).forEach(function (k) {
      var l = map[k];
      if (!l || l.source === 'echeance') return;
      var j = null, encours = false;
      if (l.echue_le) {
        var d = minuit(new Date(l.echue_le + 'T00:00:00'));
        var f = l.fin_le ? minuit(new Date(l.fin_le + 'T00:00:00')) : d;
        if (isNaN(f)) f = d;
        if (!isNaN(d)) {
          /* LE RETARD SE COMPTE SUR LA FIN, PAS SUR LE DEBUT. Un salon du 9 au 11
             fevrier n'est pas en retard le 10 : il a lieu. Compter sur le debut
             aurait mis en retard, des le deuxieme jour, tout ce qui dure. */
          encours = (d <= auj && f >= auj && l.fin_le && +f !== +d);
          j = Math.round(((f < auj ? f : d) - auj) / JOUR);
          if (encours) j = 0;
        }
      }
      out.push({ tache_id: k, titre: l.titre || '', source: 'libre', ref: null,
                 echue_le: l.echue_le || null, fin_le: l.fin_le || null,
                 fait_le: l.fait_le || null, jours: j, enCours: encours });
    });
    return out;
  }

  /* ---------------- LES RAPPELS CLIENTS, LUS ET JAMAIS STOCKES ----------------
     Demande de Ted le 11/09/2026. Jusqu'ici cette piece portait DEUX natures et pas
     trois, et les clients restaient au sous-main : deux endroits qui repondent « qui
     dois-je appeler » se contredisent au premier geste pose d'un cote.

     CE QUI A CHANGE, ET POURQUOI LA REGLE TIENT TOUJOURS : ces lignes ne sont pas
     stockees ici, elles sont LUES dans le miroir de bdv-crm.js, dont la verite est
     `suivi_clients`. Et elles NE SE COCHENT PAS : elles menent a la fiche du client,
     qui est le seul endroit ou l'on note ce qu'il a dit. Il n'y a donc toujours qu'un
     seul endroit qui repond, et un seul geste qui ecrit.

     Ne pas leur donner de case a cocher « pour faire comme les autres » : ce serait
     rendre au calendrier et a cette piece le tri rapide qu'on vient de retirer du
     sous-main, et un client sortirait de la file sans qu'on sache ce qu'il a dit. */
  function rappelsClients() {
    if (!familleAffichee('clients')) return [];
    if (!window.BdvCrm || !BdvCrm.miroir) return [];
    var e = BdvCrm.miroir();
    if (!e) return [];
    var noms = e.noms || {}, auj = minuit(new Date());
    return (e.suivi || e.rappels || []).filter(function (l) {
      return l.rappel && l.statut !== 'traite';
    }).map(function (l) {
      var d = minuit(new Date(l.rappel + 'T00:00:00'));
      return {
        tache_id: 'client:' + l.id, titre: noms[l.id] || ('Client ' + l.id),
        source: 'client', ref: String(l.id), motif: l.titre || '',
        echue_le: l.rappel, fin_le: null, fait_le: null,
        jours: isNaN(d) ? null : Math.round((d - auj) / JOUR)
      };
    });
  }

  /* Sans date, une tache n'est ni en retard ni pressante : elle attend. Elle passe donc
     APRES tout ce qui porte une date, et pas avant, sinon une note ecrite en passant
     couvrirait une DRM qui tombe demain. */
  function rang(t) { return t.jours === null ? 99999 : t.jours; }
  function toutes() {
    return obligations().concat(libres(), rappelsClients())
      .sort(function (a, b) { return rang(a) - rang(b); });
  }

  /* ---------------- LES MOTS DU TEMPS ----------------
     Les memes que le calendrier, volontairement : le vigneron lit « Dans 3 jours »
     au meme endroit du sens, qu'il regarde ses obligations ou ses taches. */
  function quand(t) {
    if (t.enCours) return 'En ce moment';
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
    if (t.enCours) return 'aujourdhui';
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
  /* « du 9 au 11 fevrier » plutot que « 9 fevrier » : une periode dit sa fin, sinon
     le vigneron croit que son salon tient sur une journee. */
  function quandDate(t) {
    var a = dateCourte(t.echue_le);
    return t.fin_le ? ('du ' + a + ' au ' + dateCourte(t.fin_le)) : a;
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

  /* UNE TACHE PEUT DURER PLUSIEURS JOURS depuis le 08/09/2026. Ted : « imagine
     c'est un salon sur plusieurs jours ». La fin est FACULTATIVE, et sans elle
     la tache tombe un jour, comme avant.

     LES DEUX DATES SONT REMISES DANS L'ORDRE plutot que refusees. « Du 11 au 9 »
     ne veut dire qu'une chose, et un formulaire qui refuse sans expliquer fait
     abandonner. L'echange se voit tout de suite dans la liste, donc il ne cache
     rien.

     UNE FIN SANS DEBUT N'EXISTE PAS : elle ne saurait pas ou se poser dans la
     grille. Elle devient le debut, ce qui est la seule lecture possible. */
  function ajouter(titre, echueLe, finLe) {
    titre = String(titre || '').trim();
    if (!titre) return false;
    // Les trois regles sont ecrites une seule fois, dans normaliserDates() : la modale
    // les applique aussi, et un formulaire qui accepte « du 11 au 9 » a la creation mais
    // le refuse a la correction apprend deux comportements pour un seul geste.
    var dd = normaliserDates(echueLe, finLe);
    echueLe = dd.debut; finLe = dd.fin;
    var tid = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    var maintenant = new Date().toISOString();
    ecrire(tid, { tache_id: tid, titre: titre, source: 'libre', ref: null,
                  echue_le: echueLe, fin_le: finLe, fait_le: null,
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
                  echue_le: t.echue_le, fin_le: t.fin_le || null,
                  fait_le: t.fait_le ? null : maintenant, maj_le: maintenant });
  }
  function supprimer(tid) { ecrire(tid, null); }

  /* ---------------- MODIFIER UNE TACHE ECRITE ----------------
     Ajoutee le 12/09/2026 avec la modale. Jusqu'ici une tache mal notee ne se
     corrigeait qu'en la retirant et en la reecrivant : on y perdait sa date de
     creation, et si elle etait cochee, la preuve qu'elle avait ete faite.

     LES TROIS REGLES DE DATES SONT CELLES DE ajouter(), et elles sont desormais
     ecrites UNE fois, dans normaliserDates(). Un formulaire qui accepte « du 11 au
     9 » a la creation et le refuse a la modification apprend deux comportements
     pour un seul geste.

     UNE OBLIGATION EST REFUSEE ICI, et pas seulement absente du formulaire : son
     titre et sa date viennent du fichier de donnees, on ne renomme pas une DRM.
     Le garde-fou est dans la donnee, pas dans l'ecran ; cacher un bouton
     n'empeche rien. */
  function normaliserDates(echueLe, finLe) {
    echueLe = echueLe || null;
    finLe = finLe || null;
    if (finLe && !echueLe) { echueLe = finLe; finLe = null; }
    if (echueLe && finLe && finLe < echueLe) { var t = echueLe; echueLe = finLe; finLe = t; }
    if (echueLe && finLe === echueLe) finLe = null;   // un jour n'est pas une periode
    return { debut: echueLe, fin: finLe };
  }

  function modifier(tid, titre, echueLe, finLe) {
    var l = lireCache()[tid];
    if (!l || l.source === 'echeance') return false;
    titre = String(titre || '').trim();
    if (!titre) return false;
    var d = normaliserDates(echueLe, finLe);
    var ligneMaj = { tache_id: tid, titre: titre, source: 'libre', ref: null,
                     echue_le: d.debut, fin_le: d.fin, fait_le: l.fait_le || null,
                     maj_le: new Date().toISOString() };
    // La date de creation n'est pas renvoyee quand on ne l'a pas : l'upsert fusionne,
    // et une colonne absente garde la valeur du serveur. L'ecraser par null ferait
    // perdre l'age d'une tache a chaque correction de faute de frappe.
    if (l.cree_le) ligneMaj.cree_le = l.cree_le;
    ecrire(tid, ligneMaj);
    return true;
  }

  /* POSER LE DEBUT D'UNE TACHE, un seul chemin pour les deux boutons de report.
     repousser() compte a partir d'aujourd'hui, reporterAu() prend la date donnee ;
     au-dela de ce calcul elles font exactement la meme chose, et elles doivent
     continuer a la faire, notamment garder la duree d'une tache qui dure. */
  function poserDebut(tid, dateIso) {
    var t = libres().filter(function (x) { return x.tache_id === tid; })[0];
    if (!t || !dateIso) return false;
    var base = minuit(new Date(dateIso + 'T00:00:00'));
    if (isNaN(base)) return false;
    var fin = null;
    if (t.echue_le && t.fin_le) {
      var d0 = minuit(new Date(t.echue_le + 'T00:00:00'));
      var f0 = minuit(new Date(t.fin_le + 'T00:00:00'));
      if (!isNaN(d0) && !isNaN(f0)) {
        var f = new Date(base);
        f.setDate(f.getDate() + Math.round((f0 - d0) / JOUR));
        fin = iso(f);
      }
    }
    ecrire(tid, { tache_id: tid, titre: t.titre, source: 'libre', ref: null,
                  echue_le: iso(base), fin_le: fin, fait_le: null,
                  maj_le: new Date().toISOString() });
    return true;
  }

  function reporterAu(tid, jourIso) { return poserDebut(tid, jourIso); }

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

    /* UN CLIENT N'A PAS DE CASE, il a une pastille inerte. La rangee est une grille
       de trois colonnes : lui retirer sa premiere cellule decalerait tout le texte de
       la ligne, et l'oeil perdrait la colonne des titres. La pastille tient la place
       et porte la matiere de cette famille, le combine, comme dans le calendrier. */
    if (t.source === 'client') {
      var pu = document.createElement('span');
      pu.className = 'tache__puce';
      pu.setAttribute('aria-hidden', 'true');
      li.appendChild(pu);
    } else {
      var coche = document.createElement('button');
      coche.type = 'button';
      coche.className = 'tache__coche';
      coche.setAttribute('data-tache-coche', t.tache_id);
      coche.setAttribute('aria-pressed', t.fait_le ? 'true' : 'false');
      coche.title = t.fait_le ? 'Remettre à faire' : 'Marquer comme fait';
      coche.setAttribute('aria-label', coche.title);
      li.appendChild(coche);
    }

    /* LE CORPS OUVRE LA MODALE, depuis le 12/09/2026. C'est un <button> et pas un
       <span> qu'on ecoute : une ligne qui s'ouvre a la souris doit s'ouvrir au clavier,
       et un <li> avec un ecouteur de clic ne s'atteint pas au clavier. UN CLIENT GARDE
       SON <span> INERTE : il a deja son bouton « Ouvrir sa fiche », et sa fiche est le
       seul endroit ou l'on note ce qu'il a dit. */
    var ouvrable = t.source !== 'client';
    var corps = document.createElement(ouvrable ? 'button' : 'span');
    corps.className = 'tache__corps';
    if (ouvrable) {
      corps.type = 'button';
      corps.setAttribute('data-tache-ouvrir', t.tache_id);
      corps.title = 'Ouvrir cette tâche';
    }
    var titre = document.createElement('span');
    titre.className = 'tache__titre';
    titre.textContent = t.titre;
    corps.appendChild(titre);

    var bas = document.createElement('span');
    bas.className = 'tache__quand';
    var mots = [];
    if (t.echue_le) mots.push(quand(t), quandDate(t));
    if (t.source === 'echeance') mots.push('obligation');
    /* LE MOTIF DU RAPPEL SE LIT ICI. « Rappeler MARTIN » sans le pourquoi oblige a
       ouvrir la fiche pour savoir ce qu'on avait promis, et c'est exactement le
       voyage que ce motif existe pour eviter. */
    if (t.source === 'client') mots.push(t.motif || 'à rappeler');
    bas.textContent = mots.filter(Boolean).join(' · ');
    if (bas.textContent) corps.appendChild(bas);
    li.appendChild(corps);

    if (t.source === 'client') {
      // Le seul geste possible sur un client : ouvrir sa fiche. C'est la qu'on note ce
      // qu'il a dit, et c'est le meme ouvreur que le sous-main, expose par le bureau.
      var ac = document.createElement('button');
      ac.type = 'button';
      ac.className = 'tache__source';
      ac.setAttribute('data-tache-client', t.ref);
      ac.textContent = 'Ouvrir sa fiche';
      li.appendChild(ac);
    } else if (t.source === 'echeance') {
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

  /* Le filtre se monte une fois, a partir de la liste unique des familles, et se
     repeint a chaque rendu. Les etiquettes empruntent `.filtfam` au calendrier :
     le meme geste doit avoir la meme allure aux deux endroits, sinon il faut
     l'apprendre deux fois. */
  function monterFiltre() {
    var hote = el('tachesFiltre');
    if (!hote || hote.dataset.monte) return;
    hote.dataset.monte = '1';
    famillesDuFiltre().forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'filtfam';
      b.setAttribute('data-tache-famille', f.cle);
      b.setAttribute('data-fam', f.cle);
      b.title = f.quoi;
      b.textContent = f.label;
      hote.appendChild(b);
    });
  }
  function peindreFiltre() {
    var off = famillesEteintes();
    [].forEach.call(document.querySelectorAll('[data-tache-famille]'), function (b) {
      var on = off.indexOf(b.getAttribute('data-tache-famille')) < 0;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('filtfam--off', !on);
    });
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
    /* LA MODALE OUVERTE SE REMET A JOUR, MAIS SANS TOUCHER AUX CHAMPS. Le serveur repond
       plusieurs secondes apres l'ouverture ; reecrire un titre pendant qu'il se tape est
       la pire facon de rafraichir un ecran. Seul le chrome est repeint — le tampon de
       retard, le libelle du bouton, la ligne d'explication. Et c'est pose AVANT le test
       de sortie ci-dessous, parce que la modale s'ouvre aussi depuis le panneau, ou la
       piece « Mes taches » n'est pas forcement a l'ecran. */
    if (modOuverte() && MOD_ETAT && MOD_ETAT.mode !== 'neuve') {
      var vue = toutes().filter(function (x) { return x.tache_id === MOD_ETAT.tid; })[0];
      if (vue) {
        MOD_ETAT.fait_le = vue.fait_le || null;
        MOD_ETAT.jours = vue.jours;
        MOD_ETAT.echue_le = vue.echue_le || null;
        MOD_ETAT.fin_le = vue.fin_le || null;
        MOD_ETAT.enCours = !!vue.enCours;
      }
      peindreModale(false);
    }
    if (!el('tachesAFaire')) return;
    monterFiltre();
    peindreFiltre();
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
     mur. Le reste s'ouvre en un clic sur la punaise.

     REPRIS LE 10/09/2026, sur demande de Ted : « il faut le rendre bcp plus usefull,
     il y a des KPI qui servent a rien, il faut que ca soit cliquable ». Une punaise
     n'annonce plus un nombre : elle porte UNE chose a faire, et les deux gestes qui
     la font disparaitre. Le panneau devient une pile de travail qui se vide.

     AUCUN TON « aujourd'hui » N'A ETE AJOUTE, et c'est deliberе : l'etat « fait » a
     du recevoir un fond parce que sa punaise verte tombait a 2,25:1 sur le liege
     (voir style.css). Une troisieme couleur de punaise aurait rejoue exactement ce
     defaut. Ce qui presse le dit donc en TOUTES LETTRES dans le chiffre du post-it,
     « aujourd'hui », « demain », « en retard » : un mot se lit, une teinte se devine. */
  function punaises() {
    /* LES CLIENTS NE PASSENT PAS PAR ICI, ET C'EST UN DOUBLON REPARE LE 11/09/2026.

       Vu au banc sur le panneau : « Domaine de la Jayama » epingle DEUX FOIS, une fois
       en punaise de rappel (« en retard, depuis 6 jours », bouton « Appele ») et une
       fois en punaise de tache (« ta tache », boutons « Fait » et « Demain »). Depuis
       que « Mes clients » est une famille de cette piece, `toutes()` rend aussi les
       rappels clients, et le panneau les lisait des deux cotes.

       CE N'ETAIT PAS QU'UN DOUBLON D'AFFICHAGE. La punaise de tache proposait « Fait »
       et « Demain » sur un identifiant `client:C0170` : `basculer()` ne le trouve pas
       dans `libres()`, `repousser()` non plus, et les deux boutons ne faisaient donc
       rien du tout. Un bouton qui ne fait rien apprend a ne plus cliquer.

       LE PANNEAU EST LE SEUL A LIRE LES CLIENTS, et il les lit a la source, dans le
       miroir de bdv-crm.js : il sait dire « en retard », « aujourd'hui », « ton
       prochain rappel », et il pose « Appele », qui ecrit vraiment. La regle du projet
       tient : un seul endroit repond a « qui dois-je appeler ». La PIECE « Mes taches »,
       elle, continue de les lister, avec « Ouvrir sa fiche » et sans case a cocher. */
    var afaire = toutes().filter(function (x) { return !x.fait_le && x.source !== 'client'; });
    var presse = afaire.filter(function (x) { return x.jours !== null && x.jours <= 7; });
    var tete = presse.slice(0, 3);
    var out = tete.map(function (t) {
      var gestes = [{ cle: 'tache-fait', id: t.tache_id, mot: 'Fait' }];
      /* UNE OBLIGATION NE SE REPOUSSE PAS. Une DRM tombe le 10 du mois, et un bouton
         qui pretendrait la decaler d'un jour mentirait sur ce qui est negociable.
         Et on ne repousse que ce qui presse VRAIMENT : proposer « demain » sur une
         tache prevue dans six jours, c'est proposer de l'avancer. */
      if (t.source !== 'echeance' && t.jours < 1) {
        gestes.push({ cle: 'tache-demain', id: t.tache_id, mot: 'Demain' });
      }
      /* L'ECHEANCE EST UN TAMPON, LE TITRE EST LE MESSAGE. Corrige le 10/09/2026 apres
         une capture de Ted : « les gros mots AUJOURD'HUI et DEMAIN en gros, ca perd le
         message ». Il avait raison, et la cause est une nature forcee dans la mauvaise
         forme : le grand emplacement du post-it est un emplacement de CHIFFRE, et sur
         une chose a faire le chiffre n'est pas le message, le titre l'est. Une punaise
         de compte garde son chiffre en tete ; une punaise de chose a faire porte un
         tampon en capitales, puis ce qu'il y a a faire. */
      return {
        cle: 'tache:' + t.tache_id,
        tampon: t.jours < 0 ? 'en retard' : (t.jours === 0 ? 'aujourd’hui' : (t.jours === 1 ? 'demain' : 'dans ' + t.jours + ' j')),
        valeur: t.titre,
        sous: t.source === 'echeance' ? 'obligation' : 'ta tâche',
        ton: t.jours < 0 ? 'vieux' : '',
        href: '/mon-bureau/#taches',
        /* LA PUNAISE OUVRE LA MODALE plutot que de changer de piece, depuis le
           12/09/2026. Le `href` reste : c'est lui qui sert si le module n'a pas
           encore parle, et c'est la seule chose qu'un clic milieu peut ouvrir. */
        ouvre: t.tache_id,
        gestes: gestes
      };
    });
    var reste = afaire.length - tete.length;
    if (reste > 0) {
      // « 5 sans date » dit ou elles sont et pourquoi elles ne pressent pas ; « dans
      // Mes taches » ne disait que l'endroit, qu'on connait deja par le clic.
      var sansD = afaire.filter(function (x) { return x.jours === null; }).length;
      out.push({
        cle: 'taches-reste',
        valeur: String(reste), libelle: reste > 1 ? 'autres tâches' : 'autre tâche',
        sous: sansD ? (sansD > 1 ? sansD + ' sans date' : '1 sans date') : 'dans Mes tâches',
        href: '/mon-bureau/#taches'
      });
    }
    return out;
  }

  /* REPOUSSER A DEMAIN, DEPUIS LA PUNAISE. Ajoute le 10/09/2026.

     LA NOUVELLE DATE SE COMPTE A PARTIR D'AUJOURD'HUI, jamais de l'ancienne. Un
     « demain » qui rendrait le 4 septembre pour une tache du 3 laisserait la tache en
     retard apres le clic, et le bouton passerait pour casse alors qu'il aurait fait
     exactement ce qu'on lui a demande.

     LES OBLIGATIONS SONT REFUSEES ICI AUSSI, et pas seulement absentes du bouton :
     `libres()` ne les contient pas, donc un appel qui les viserait sort par `false`.
     Le garde-fou est dans la donnee, pas dans l'ecran.

     UNE TACHE QUI DURE GARDE SA DUREE : la fin se decale d'autant que le debut, sinon
     un salon de trois jours repousse a demain deviendrait un salon d'un jour. */
  function repousser(tid, n) {
    var base = minuit(new Date());
    base.setDate(base.getDate() + (n || 1));
    return poserDebut(tid, iso(base));
  }

  /* CE QUI A ETE FAIT AUJOURD'HUI. Sert au bilan du soir sur le panneau : une pile de
     travail qui se vide doit dire ce qu'elle a avale, sinon elle ne recompense rien.

     ON COMPARE DEUX MINUITS LOCAUX, et pas les dix premiers caracteres de `fait_le`.
     Cette colonne porte un horodatage UTC : entre minuit et deux heures du matin en
     France, sa tranche de date rend la VEILLE, et le bilan aurait annonce zero a
     quelqu'un qui vient de cocher. Meme piege que isoLocal() dans bdv-crm.js. */
  function faitsAujourdhui() {
    var auj = minuit(new Date());
    return toutes().filter(function (t) {
      if (!t.fait_le) return false;
      var d = new Date(t.fait_le);
      return !isNaN(d) && +minuit(d) === +auj;
    }).length;
  }


  /* ======================= LA MODALE D'UNE TACHE =======================
     Demandee par Ted le 12/09/2026 : « une modale qui s'ouvre pour creer la tache
     et la visualiser. Quand on clique dessus a partir de la zone des taches, ca
     ouvre la modale aussi et permet de la traiter, ou la repousser. »

     ELLE NE PORTE PAS LES TROIS NATURES DE LA MEME FACON, et c'est l'arbitrage du
     jour. La liste affiche trois sortes de lignes qui n'obeissent pas aux memes
     regles, et une modale uniforme aurait casse deux decisions deja prises :

       - UNE TACHE ECRITE : tout est modifiable. Elle se coche, se repousse, se
         retire, et son titre comme ses deux dates se corrigent.
       - UNE OBLIGATION : titre et date viennent du fichier de donnees. Elle ne
         propose que « C'est fait » et le renvoi vers ce que l'echeance exige. Une
         DRM NE SE REPOUSSE PAS : un bouton qui pretendrait la decaler d'un jour
         mentirait sur ce qui est negociable.
       - UN CLIENT : il n'entre pas ici du tout. Son seul geste reste « Ouvrir sa
         fiche », arbitrage de Ted du 11/09/2026 : c'est dans la fiche qu'on note
         ce qu'il a dit, et deux endroits qui repondent « qui dois-je appeler » se
         contrediraient des le premier geste pose d'un cote.

     TOUT GESTE FERME LA MODALE. Meme motif que les punaises du panneau : un geste
     qui laisse l'ecran identique apprend a ne plus cliquer. Le resultat se lit
     dans la liste, derriere, qui vient d'etre repeinte par ecrire().

     LE MARKUP EST CONSTRUIT ICI ET POSE SOUS <body>. Pas dans le gabarit : cette
     modale s'ouvre depuis TROIS endroits (la piece, le panneau, le calendrier), et
     le gabarit de l'un des trois n'est le bon domicile d'aucun des deux autres.
     Sous <body> directement, parce qu'un parent en `transform` ou en `overflow`
     reclasserait un `position: fixed` sans rien dire — le meme piege que les
     quatre elements hors page de bdv-nav.js.

     LES DONNEES DU VIGNERON NE PASSENT PAS PAR LA CHAINE HTML : celle-ci ne porte
     que le chrome, qui est ecrit ici et ne bouge jamais. Titres, motifs et valeurs
     de champs sont poses en textContent et en .value, plus bas. Regle du bureau.
     =================================================================== */
  var MOD = null;          // le noeud, monte une seule fois
  var MOD_ETAT = null;     // ce que la modale montre en ce moment
  var MOD_RETOUR = null;   // a qui rendre le focus en sortant

  var MOD_HTML =
    '<div class="tmod__voile" data-tache-fermer="oui"></div>' +
    '<div class="tmod__boite" role="dialog" aria-modal="true" aria-labelledby="tmodTitre">' +
      '<button class="tmod__x" type="button" data-tache-fermer="oui" aria-label="Fermer">&#215;</button>' +
      '<p class="tmod__tampon" id="tmodTampon" hidden></p>' +
      '<h2 class="tmod__titre" id="tmodTitre"></h2>' +
      '<p class="tmod__sous" id="tmodSous" hidden></p>' +
      '<form class="tmod__form" id="tmodForm" novalidate>' +
        '<div class="tmod__champ">' +
          '<label class="tmod__l" for="tmodNom">Qu’est-ce qu’il y a à faire ?</label>' +
          '<input class="tmod__i" id="tmodNom" type="text" maxlength="200" autocomplete="off" ' +
                 'placeholder="ex. commander des bouchons">' +
        '</div>' +
        '<div class="tmod__duo">' +
          '<div class="tmod__champ">' +
            '<label class="tmod__l" for="tmodDebut">Pour quand</label>' +
            '<input class="tmod__d" id="tmodDebut" type="date">' +
          '</div>' +
          '<div class="tmod__champ">' +
            '<label class="tmod__l" for="tmodFin">Jusqu’à quand</label>' +
            '<input class="tmod__d" id="tmodFin" type="date">' +
          '</div>' +
        '</div>' +
        '<p class="tmod__aide">Les deux dates sont facultatives. Sans date, la tâche attend ' +
          'sagement en bas de liste. La seconde ne sert qu’à ce qui dure plusieurs jours.</p>' +
        '<p class="tmod__erreur" id="tmodErreur" role="alert" hidden></p>' +
        '<div class="tmod__pied">' +
          '<button class="btn btn--bordeaux" type="submit" id="tmodValider">Enregistrer</button>' +
          '<button class="tmod__lien" type="button" data-tache-fermer="oui">Annuler</button>' +
        '</div>' +
      '</form>' +
      '<div class="tmod__bloc" id="tmodReports">' +
        '<p class="tmod__l" id="tmodReportL">Pas maintenant ?</p>' +
        '<div class="tmod__gestes">' +
          '<button class="tmod__g" type="button" id="tmodVite1" data-tache-report="1">Demain</button>' +
          '<button class="tmod__g" type="button" id="tmodVite7" data-tache-report="7">Dans 7 jours</button>' +
          /* LE « ou », LA DATE ET SON BOUTON SONT SOLIDAIRES. Vu a la capture du
             12/09/2026 : les cinq elements de cette rangee se repartissaient au fil de
             l'eau, et « Repousser » tombait seul a la ligne suivante, sous un champ de
             date qui restait, lui, en haut. Un bouton orphelin sous un champ vide ne dit
             plus a quoi il sert. Groupes, ils passent a la ligne ensemble ou pas du tout. */
          '<span class="tmod__ouj">' +
            '<span class="tmod__ou">ou</span>' +
            '<input class="tmod__d" id="tmodReportDate" type="date" ' +
                   'aria-label="Repousser à une date précise">' +
            '<button class="tmod__g" type="button" data-tache-report="date">Repousser</button>' +
          '</span>' +
        '</div>' +
      '</div>' +
      '<div class="tmod__bloc tmod__bloc--gestes" id="tmodGestes">' +
        '<button class="btn btn--bordeaux" type="button" data-tache-fait="oui" id="tmodFait">C’est fait</button>' +
        '<a class="tmod__lien" id="tmodExige" href="/mon-bureau/#calendrier">Ce que ça exige</a>' +
        '<button class="tmod__lien tmod__lien--x" type="button" data-tache-oter="oui" id="tmodSuppr">Retirer cette tâche</button>' +
      '</div>' +
    '</div>';

  function monterModale() {
    if (MOD) return MOD;
    MOD = document.createElement('div');
    MOD.className = 'tmod';
    MOD.id = 'tacheModale';
    MOD.hidden = true;
    MOD.innerHTML = MOD_HTML;
    document.body.appendChild(MOD);
    var f = el('tmodForm');
    if (f) f.addEventListener('submit', function (e) { e.preventDefault(); validerModale(); });
    return MOD;
  }

  function modOuverte() { return !!(MOD && !MOD.hidden); }

  function fermerModale() {
    if (!modOuverte()) return;
    MOD.hidden = true;
    MOD_ETAT = null;
    var r = MOD_RETOUR; MOD_RETOUR = null;
    // Le focus revient d'ou il venait, et seulement si ce noeud est encore dans la page :
    // une ligne cochee depuis la modale a pu etre repeinte entre-temps, et rendre le focus
    // a un noeud detache le renvoie au <body>, donc en haut de la page.
    if (r && r.isConnected && typeof r.focus === 'function') { try { r.focus(); } catch (e) {} }
  }

  function montrer(node, oui) { if (node) node.hidden = !oui; }

  /* La peinture est coupee en deux, et ce n'est pas du zele : `rendre()` repasse ici
     quand le serveur repond, et il ne doit JAMAIS reecrire les champs pendant que le
     vigneron tape dedans. Le chrome se repeint a chaque fois, les champs seulement a
     l'ouverture. */
  function peindreModale(avecChamps) {
    var s = MOD_ETAT; if (!s) return;
    var neuve = s.mode === 'neuve', ech = s.mode === 'echeance', fait = !!s.fait_le;

    var tampon = el('tmodTampon');
    var mot = neuve ? '' : (s.echue_le ? quand(s) : 'sans date');
    tampon.textContent = fait ? 'fait' : mot;
    montrer(tampon, !!tampon.textContent);
    tampon.setAttribute('data-ton', fait ? 'fait' : (ton(s) || ''));

    el('tmodTitre').textContent = neuve ? 'Une nouvelle tâche'
      : (ech ? s.titre : 'Ta tâche');

    var sous = el('tmodSous');
    if (neuve) {
      sous.textContent = 'Elle rejoindra ta liste, et ton calendrier si tu lui donnes une date.';
    } else if (ech) {
      sous.textContent = 'Obligation du calendrier, ' + quandDate(s)
        + '. Son titre et sa date viennent du calendrier officiel : ils ne se modifient pas, '
        + 'et elle ne se repousse pas.';
    } else if (fait) {
      sous.textContent = 'Cochée le ' + dateCourte(String(s.fait_le).slice(0, 10)) + '.';
    } else {
      sous.textContent = '';
    }
    montrer(sous, !!sous.textContent);

    montrer(el('tmodForm'), !ech);
    el('tmodValider').textContent = neuve ? 'Ajouter cette tâche' : 'Enregistrer';
    montrer(el('tmodErreur'), false);

    // Pas de report sur une obligation, ni sur une tache deja cochee : repousser ce qui
    // est fait n'a pas de sens, et le bouton remettrait la tache a faire sans le dire.
    montrer(el('tmodReports'), s.mode === 'libre' && !fait);
    /* ON NE REPOUSSE QUE CE QUI PRESSE, et c'est la regle deja ecrite pour les punaises
       du panneau : « proposer demain sur une tache prevue dans six jours, c'est proposer
       de l'avancer ». La capture du 12/09/2026 montrait exactement ce defaut ici — un
       salon dans douze jours, et un bouton « Demain » sous le titre « Pas maintenant ? ».
       Une tache pas encore due ne se repousse pas, elle se DEPLACE, et le champ de date
       fait ce travail-la. Les mots changent avec les boutons : un titre qui ne decrit
       plus ce qu'il surmonte est la moitie du defaut. */
    var presse = s.jours === null || s.jours <= 0;
    montrer(el('tmodVite1'), presse);
    montrer(el('tmodVite7'), presse);
    el('tmodReportL').textContent = presse ? 'Pas maintenant ?' : 'La déplacer ?';
    montrer(el('tmodGestes'), !neuve);
    el('tmodFait').textContent = fait ? 'Remettre à faire' : 'C’est fait';
    montrer(el('tmodExige'), ech);
    montrer(el('tmodSuppr'), s.mode === 'libre');

    if (!avecChamps || ech) return;
    el('tmodNom').value = s.titre || '';
    el('tmodDebut').value = s.echue_le || '';
    el('tmodFin').value = s.fin_le || '';
    el('tmodReportDate').value = '';
  }

  function ouvrirModale(s, declencheur) {
    monterModale();
    MOD_ETAT = s;
    MOD_RETOUR = declencheur || null;
    peindreModale(true);
    MOD.hidden = false;
    // Une obligation n'a pas de champ a remplir : le focus va sur son seul geste, sinon
    // il resterait sur le voile et la premiere tabulation repartirait du haut du document.
    var premier = s.mode === 'echeance' ? el('tmodFait') : el('tmodNom');
    if (premier) { try { premier.focus(); } catch (e) {} }
  }

  /* RECONSTRUIRE UNE OCCURRENCE QUE toutes() NE LISTE PAS. Elle ne connait que la
     PROCHAINE occurrence de chaque obligation ; le calendrier, lui, affiche octobre en
     septembre. Meme motif que basculerOccurrence() : la ligne se fabrique ici, pour que
     ce fichier reste le seul endroit qui sache ce qu'est une tache. */
  function depuisIdOccurrence(tid) {
    if (String(tid).slice(0, 4) !== 'ech:') return null;
    var reste = String(tid).slice(4);
    var jour = reste.slice(-10), cle = reste.slice(0, -11);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || !cle) return null;
    var d = minuit(new Date(jour + 'T00:00:00'));
    if (isNaN(d)) return null;
    var titre = cle;
    if (window.BdvEcheances) {
      var r = BdvEcheances.depuisLaPage('bdvEcheances').filter(function (e) {
        return e.cle === cle;
      })[0];
      if (r && r.titre) titre = r.titre;
    }
    var l = lireCache()[tid];
    return { tache_id: tid, titre: titre, source: 'echeance', ref: cle,
             echue_le: jour, fin_le: null, fait_le: (l && l.fait_le) || null,
             jours: Math.round((d - minuit(new Date())) / JOUR) };
  }

  function modaleNeuve(dateIso, declencheur) {
    ouvrirModale({ mode: 'neuve', tid: null, titre: '', ref: null,
                   echue_le: dateIso || null, fin_le: null, fait_le: null, jours: null },
                 declencheur);
    return true;
  }

  function modale(tid, declencheur) {
    var t = toutes().filter(function (x) { return x.tache_id === tid; })[0]
         || depuisIdOccurrence(tid);
    // UN CLIENT SORT ICI, et ce n'est pas un oubli d'ecran : sa fiche est le seul
    // endroit ou l'on note ce qu'il a dit. Le refus est dans la donnee.
    if (!t || t.source === 'client') return false;
    ouvrirModale({ mode: t.source === 'echeance' ? 'echeance' : 'libre',
                   tid: t.tache_id, titre: t.titre, ref: t.ref,
                   echue_le: t.echue_le || null, fin_le: t.fin_le || null,
                   fait_le: t.fait_le || null, jours: t.jours,
                   enCours: !!t.enCours }, declencheur);
    return true;
  }

  function modaleOccurrence(cle, titre, jourIso, declencheur) {
    if (!cle || !jourIso) return false;
    var d = minuit(new Date(jourIso + 'T00:00:00'));
    if (isNaN(d)) return false;
    var tid = idOccurrence(cle, d);
    var l = lireCache()[tid];
    ouvrirModale({ mode: 'echeance', tid: tid, titre: titre || cle, ref: cle,
                   echue_le: jourIso, fin_le: null, fait_le: (l && l.fait_le) || null,
                   jours: Math.round((d - minuit(new Date())) / JOUR) }, declencheur);
    return true;
  }

  function direErreur(mot) {
    var p = el('tmodErreur');
    if (!p) return;
    p.textContent = mot;
    montrer(p, !!mot);
  }

  function validerModale() {
    var s = MOD_ETAT;
    if (!s || s.mode === 'echeance') return false;
    var nom = el('tmodNom').value;
    var d1 = el('tmodDebut').value || null;
    var d2 = el('tmodFin').value || null;
    var ok = s.mode === 'neuve' ? ajouter(nom, d1, d2) : modifier(s.tid, nom, d1, d2);
    // Le seul refus possible est un titre vide, et il se dit : un bouton qui ne fait
    // rien sans expliquer fait chercher la panne ailleurs.
    if (!ok) { direErreur('Il manque le titre : dis ce qu’il y a à faire.'); el('tmodNom').focus(); return false; }
    fermerModale();
    return true;
  }

  function gesteReport(quoi) {
    var s = MOD_ETAT;
    if (!s || s.mode !== 'libre') return false;
    var ok;
    if (quoi === 'date') {
      var v = el('tmodReportDate').value;
      if (!v) { el('tmodReportDate').focus(); return false; }
      ok = reporterAu(s.tid, v);
    } else {
      ok = repousser(s.tid, quoi);
    }
    if (ok) fermerModale();
    return ok;
  }

  function gesteFait() {
    var s = MOD_ETAT;
    if (!s || s.mode === 'neuve') return false;
    // Une obligation passe par basculerOccurrence : basculer() la chercherait dans
    // toutes(), qui ne connait que la prochaine, et une DRM d'octobre ouverte depuis
    // le calendrier en septembre n'y est pas.
    if (s.mode === 'echeance') basculerOccurrence(s.ref, s.titre, s.echue_le);
    else basculer(s.tid);
    fermerModale();
    return true;
  }

  function gesteOter() {
    var s = MOD_ETAT;
    if (!s || s.mode !== 'libre') return false;
    supprimer(s.tid);
    fermerModale();
    return true;
  }

  /* ---------------- BRANCHEMENTS ---------------- */
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('[data-tache-coche]');
    if (c) { e.preventDefault(); basculer(c.getAttribute('data-tache-coche')); return; }
    var s = e.target.closest && e.target.closest('[data-tache-suppr]');
    if (s) { e.preventDefault(); supprimer(s.getAttribute('data-tache-suppr')); return; }
    var f = e.target.closest && e.target.closest('[data-tache-famille]');
    if (f) { e.preventDefault(); basculerFamille(f.getAttribute('data-tache-famille')); return; }
    /* Le meme ouvreur que le sous-main et que le calendrier, expose par le bureau. Trois
       endroits montrent un rappel client, UN SEUL sait ouvrir sa fiche. */
    /* LA MODALE. Ces quatre branches sont posees APRES la coche et le retrait :
       un clic sur la case a cocher d'une ligne ne doit pas aussi ouvrir la modale,
       et c'est le premier `return` rencontre qui le garantit. */
    var mo = e.target.closest && e.target.closest('[data-tache-ouvrir]');
    if (mo) { e.preventDefault(); modale(mo.getAttribute('data-tache-ouvrir'), mo); return; }
    var mn = e.target.closest && e.target.closest('[data-tache-neuve]');
    if (mn) {
      e.preventDefault();
      modaleNeuve(mn.getAttribute('data-tache-neuve') || null, mn);
      return;
    }
    var mx = e.target.closest && e.target.closest('[data-tache-fermer]');
    if (mx) { e.preventDefault(); fermerModale(); return; }
    var mr = e.target.closest && e.target.closest('[data-tache-report]');
    if (mr) {
      e.preventDefault();
      var q = mr.getAttribute('data-tache-report');
      gesteReport(q === 'date' ? 'date' : (parseInt(q, 10) || 1));
      return;
    }
    var mk = e.target.closest && e.target.closest('[data-tache-fait]');
    if (mk) { e.preventDefault(); gesteFait(); return; }
    var mz = e.target.closest && e.target.closest('[data-tache-oter]');
    if (mz) { e.preventDefault(); gesteOter(); return; }

    var cl = e.target.closest && e.target.closest('[data-tache-client]');
    if (cl) {
      e.preventDefault();
      if (typeof window.bdvOuvrirFiche === 'function') {
        window.bdvOuvrirFiche(cl.getAttribute('data-tache-client'));
      }
    }
  });

  /* ECHAP FERME, et seulement quand CETTE modale est ouverte. bdv-base.js ecoute deja
     Echap pour la fiche client ; deux ecouteurs qui ferment deux choses differentes ne se
     genent que si l'un d'eux agit quand l'autre est a l'ecran. Le test de MOD est ce
     garde-fou, et il ne coute rien. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modOuverte()) { e.preventDefault(); fermerModale(); }
  });

  function brancherForm() {
    var f = el('tachesForm');
    if (!f || f.dataset.branche) return;
    f.dataset.branche = '1';
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var champ = el('tachesTitre'), date = el('tachesDate'), fin = el('tachesFin');
      if (!ajouter(champ.value,
                   date && date.value ? date.value : null,
                   fin && fin.value ? fin.value : null)) { champ.focus(); return; }
      champ.value = '';
      if (date) date.value = '';
      if (fin) fin.value = '';
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

  /* ---------------- CE QUE LE CALENDRIER LIT ----------------
     Ajoute le 08/09/2026 sur demande de Ted : « afficher les taches datees dans
     le calendrier ».

     DATEES SEULEMENT, ET C'EST LA REGLE QU'IL A LUI-MEME POSEE : une occurrence
     du calendrier porte une date, une tache peut n'en avoir aucune. Une tache
     sans date n'a pas de place dans une grille ; elle attend en bas de « Mes
     taches », et le calendrier se contente d'en annoncer le nombre.

     ON NE REND PAS LES OBLIGATIONS ICI. Elles sont deja dans le calendrier par
     leur propre chemin, le fichier de donnees. Les rendre aussi par celui-ci les
     afficherait deux fois, et cocher l'une des deux copies laisserait l'autre
     non cochee : exactement le doublon que la regle 7 interdit. */
  function datees() {
    return libres().filter(function (t) { return !!t.echue_le; });
  }
  function sansDate() {
    return libres().filter(function (t) { return !t.echue_le && !t.fait_le; }).length;
  }

  window.BdvTaches = {
    ouvrir: ouvrir, rendre: rendre, charger: charger, punaises: punaises,
    ajouter: ajouter, basculer: basculer, supprimer: supprimer, toutes: toutes,
    repousser: repousser, reporterAu: reporterAu, modifier: modifier,
    faitsAujourdhui: faitsAujourdhui,
    modale: modale, modaleNeuve: modaleNeuve, modaleOccurrence: modaleOccurrence,
    fermerModale: fermerModale,
    estFaite: estFaite, basculerOccurrence: basculerOccurrence,
    datees: datees, sansDate: sansDate,
    familleAffichee: familleAffichee, basculerFamille: basculerFamille
  };
})();
