/* ============================================================================
   Le Bureau du Vigneron, L'AMORCAGE DU BUREAU. Ecrit le 17/09/2026.

   CE QUE TED A VU, ET QUI A OUVERT CE CHANTIER : « quand je me connecte, rien ne
   s'affiche ». Capture a l'appui, sur sa base de 171 569 lignes : le sous-main disait
   « Ta file n'a pas pu etre lue », le panneau « ton journal n'est pas encore lisible »,
   et l'ardoise etait absente. Ce n'etait pas la lenteur, c'etait une COURSE PERDUE.

   LA CAUSE, ET ELLE EST STRUCTURELLE. Depuis le lot 17, tout ce que le bureau lit est
   filtre par le bureau courant, range dans `bdv_bureau_v1`. Cette cle est ABSENTE a la
   toute premiere ouverture qui suit une connexion : `BdvCompte.chargerBureau()` va la
   chercher, et pendant ce temps `BdvCrm.charger()` rend `null` par construction, parce
   qu'il refuse de lire sans savoir quel bureau lire. Chaque zone partait donc en meme
   temps, arrivait trop tot, et affichait son message d'echec.

   `chargerBureau()` finit bien par aboutir, et il previent par l'evenement `bdv:bureau`.
   Mesure du 17/09/2026 : **aucun fichier du depot n'ecoutait cet evenement.** Il etait
   emis depuis le lot 17, documente dans CLAUDE.md comme « reveille les modules qui
   n'avaient rien pu lire », et il ne reveillait personne. Le bureau restait donc sur ses
   trois messages d'echec jusqu'au rechargement de la page, et c'est exactement ce que
   Ted decrivait.

   LA REPARATION N'EST PAS UN ECOUTEUR DE PLUS. Brancher `bdv:bureau` sur les quatre
   peintures aurait ferme CE cas-la, et laisse la classe entiere ouverte : rien
   n'empeche la prochaine zone d'oublier le meme evenement, et le defaut ne se voit que
   sur un appareil qui n'a pas encore sa cle, c'est-a-dire jamais sur le poste de celui
   qui developpe. Ce qu'il fallait, c'est UN ORDRE D'ARRIVEE, ecrit a un seul endroit :
   d'abord le compte, puis le bureau, puis ce qui en depend. Une zone ne peut plus se
   peindre avant que ce qu'elle lit soit raccorde, parce qu'on ne la laisse plus
   essayer.

   ============================ LES QUATRE REGLES ============================

   1. LES ETAPES SONT SEQUENTIELLES, ET C'EST TOUTE L'IDEE. Un `Promise.all` serait plus
      rapide et ramenerait le defaut du jour : le suivi partirait avant que le bureau
      soit connu. L'ordre de la liste EST la dependance. Ne pas le paralleliser « pour
      gagner 200 ms », le gain se paierait en zones vides.

   2. LE VOILE REND LA MAIN AU BOUT DE QUINZE SECONDES, TOUJOURS. Arbitrage de Ted du
      17/09/2026, et l'autre branche a ete pesee : un voile qui attend le raccordement
      complet enferme le vigneron DEHORS de ses propres chiffres le jour ou Supabase
      tousse, alors que son appareil les porte deja. On preferera toujours un bureau
      ouvert qui dit ce qui manque a un bureau ferme qui a raison.

   3. CE QUI N'A PAS REPONDU CONTINUE DE TOURNER. Le plafond ferme le voile, il
      n'annule rien : les etapes en cours aboutissent souvent une seconde plus tard, et
      la page se complete toute seule par ses propres rappels. Annuler serait jeter un
      aller-retour deja paye.

   4. UNE ETAPE RATEE SE DIT PAR SON NOM. « Tes clients et tes rappels n'ont pas
      repondu » se comprend ; « erreur de chargement » ne se comprend pas et ne se
      raconte pas au telephone. C'est le meme motif que le rapport de la fonction du
      courrier : ce qui echoue doit etre NOMME, pas compte.

   ================================ LE CONTRAT ================================

     BdvAmorce.lancer([{ cle, texte, faire }, ...])  ->  Promise<{ rates: [cle, ...] }>

   Une etape a REUSSI si `faire()` aboutit. Elle a ECHOUE si elle leve, ou si elle rend
   exactement `false`. Ce `false` n'est pas un detail de style : `BdvCrm.charger()` rend
   `null` quand la lecture echoue et un etat quand elle aboutit, y compris sur une base
   vide. L'appelant traduit donc lui-meme son « je ne sais pas » en `false`, parce qu'il
   est le seul a savoir ce que rend sa fonction. Un module qui deviendrait ce
   traducteur se tromperait au premier module suivant.
   ============================================================================ */
(function(){
  'use strict';

  var PLAFOND_MS = 15000;
  /* UNE DUREE MINIMALE, ET CE N'EST PAS UN CAPRICE. Ted a choisi le 17/09/2026 que le
     voile paraisse a CHAQUE connexion, y compris quand tout repond vite. Depuis le
     repere de synchronisation, « vite » veut dire deux cent millisecondes : un voile
     plein ecran qui apparait et disparait dans cet intervalle ne se lit pas comme un
     temps de chargement, il se lit comme un defaut d'affichage. On le garde donc un
     demi-battement, ce qui le rend deliberé au lieu de le rendre nerveux.

     C'est la SEULE attente artificielle du projet, et elle ne s'applique qu'au succes :
     un echec a quelque chose a dire et reste affiche de toute facon. Ne pas l'allonger
     « pour faire serieux », et ne pas l'appliquer a autre chose. */
  var PLANCHER_MS = 450;
  var voile = null, lignes = {};
  /* UNE FILE, ET PAS UN DRAPEAU. Le premier jet posait `enCours` et rendait la main
     tout de suite quand un amorcage tournait deja. Ca voulait dire qu'un clic sur
     « Mon cap » pendant que le bureau finissait de se raccorder n'ouvrait RIEN, sans
     un mot : la promesse se resolvait aussitot, avec un bilan vide, et l'appelant
     croyait avoir fini. Un appel qui ne fait rien doit etre impossible, pas discret.
     Les amorcages s'enchainent donc, dans l'ordre ou on les demande. */
  var file = Promise.resolve();

  function session(){
    try{ return !!(window.BdvCompte && BdvCompte.session && BdvCompte.session()); }
    catch(e){ return false; }
  }

  /* ---------------------------------- LE VOILE ----------------------------------
     Construit en JavaScript et jamais pose d'avance dans la page. Un bloc pose
     d'avance doit etre cache par une feuille chargee PARTOUT, sinon il tombe nu dans
     le flux le temps que sa feuille arrive : c'est le defaut paye le 08/09/2026 par le
     bandeau de statut, et il n'y a aucune raison de le rejouer ici. */
  function monter(etapes){
    if(voile) return;
    voile = document.createElement('div');
    voile.className = 'bdv-amorce';
    voile.setAttribute('role', 'dialog');
    voile.setAttribute('aria-modal', 'true');
    voile.setAttribute('aria-labelledby', 'bdvAmorceTitre');
    var h = '<div class="bdv-amorce__carte">'
      + '<p class="bdv-amorce__titre" id="bdvAmorceTitre">On raccorde ton bureau</p>'
      + '<p class="bdv-amorce__sous">Encore un instant, tes chiffres arrivent.</p>'
      + '<ul class="bdv-amorce__liste" aria-live="polite">';
    etapes.forEach(function(e){
      h += '<li class="bdv-amorce__etape" data-etape="' + e.cle + '">'
        +  '<span class="bdv-amorce__puce" aria-hidden="true"></span>'
        +  '<span class="bdv-amorce__texte">' + e.texte + '</span>'
        +  '<span class="hors-ecran bdv-amorce__dit">en attente</span></li>';
    });
    h += '</ul><div class="bdv-amorce__pied"></div></div>';
    voile.innerHTML = h;
    document.body.appendChild(voile);
    lignes = {};
    etapes.forEach(function(e){
      lignes[e.cle] = voile.querySelector('[data-etape="' + e.cle + '"]');
    });
  }

  /* L'etat se dit DEUX FOIS : par la classe, qui peint, et par un mot cache qui se lit
     a la synthese vocale. Une pastille qui change de couleur ne s'entend pas, et c'est
     la meme regle que la gravite du mot du jour : jamais la couleur seule. */
  /* Une etape peut PRECISER sa ligne pendant qu'elle travaille : « Analyse de tes
     ventes, 96 000 lignes sur 171 569 ». C'est la difference entre un voile qui dit
     qu'il travaille et un voile qui dit ou il en est, et sur une base de cette taille
     ce n'est pas du confort : sans chiffre qui avance, une attente de six secondes ne
     se distingue pas d'un plantage. */
  function preciser(cle, texte){
    var li = lignes[cle];
    if(!li) return;
    var t = li.querySelector('.bdv-amorce__texte');
    if(t) t.textContent = texte;
  }

  function dire(cle, etat, mot){
    var li = lignes[cle];
    if(!li) return;
    li.className = 'bdv-amorce__etape bdv-amorce__etape--' + etat;
    var dit = li.querySelector('.bdv-amorce__dit');
    if(dit) dit.textContent = mot;
  }

  function demonter(){
    if(!voile) return;
    if(voile.parentNode) voile.parentNode.removeChild(voile);
    voile = null; lignes = {};
  }

  /* Le pied ne parait QUE si quelque chose a rate. Un bouton « Reessayer » affiche a
     chaque ouverture apprendrait qu'il y a toujours quelque chose a reessayer. */
  function pied(rates, etapes, resoudre, plafond){
    var p = voile && voile.querySelector('.bdv-amorce__pied');
    if(!p) return;
    var noms = rates.map(function(c){
      var e = etapes.filter(function(x){ return x.cle === c; })[0];
      return e ? e.texte.toLowerCase() : c;
    });
    /* QUAND TOUT A RATE, ON NE RECITE PAS LA LISTE. Trouve par `npm run apercu:amorce`
       le 17/09/2026, et par aucun des 27 controles du banc : cinq etapes enumerees dans
       une phrase, ca ne se lit pas, et ca ne dit rien de plus que « le serveur n'a pas
       repondu ». Enumerer sert quand il manque UNE ou DEUX choses au milieu de ce qui
       marche ; quand il ne reste rien, l'enumeration EST le bruit. */
    var tout = rates.length >= etapes.length;
    p.innerHTML = '<p class="bdv-amorce__manque">'
      + (tout
        ? 'Ton compte n’a pas répondu. Ton bureau s’ouvre avec ce qui est sur cet appareil.'
        : 'Ton bureau s’ouvre, mais '
          + (noms.length > 1 ? 'ces parties n’ont pas répondu' : 'cette partie n’a pas répondu')
          + ' : ' + noms.join(', ') + '. Ce qui est sur cet appareil reste lisible.')
      + '</p>'
      + '<button type="button" class="btn btn--geste" data-amorce-rejouer>Réessayer</button>'
      + '<button type="button" class="btn btn--geste" data-amorce-passer>Ouvrir quand même</button>';
    var rejouer = p.querySelector('[data-amorce-rejouer]');
    var passer  = p.querySelector('[data-amorce-passer]');
    /* Le focus part sur « Reessayer » parce que c'est le geste qu'on propose, et il ne
       part QUE maintenant : le poser a l'ouverture du voile volerait le focus a une
       page qui vient de s'ouvrir, ce que personne n'a demande. */
    if(rejouer) rejouer.focus();
    if(passer) passer.addEventListener('click', function(){ demonter(); resoudre({ rates: rates }); });
    if(rejouer) rejouer.addEventListener('click', function(){
      var aRefaire = etapes.filter(function(e){ return rates.indexOf(e.cle) >= 0; });
      demonter();
      executer(aRefaire, { plafondMs: plafond }).then(resoudre);
    });
  }

  /* ------------------------------- LA SEQUENCE ------------------------------- */
  /* `options.plafondMs` n'existe QUE pour le banc : quinze secondes d'attente reelle
     par controle rendraient le banc inutilisable, et un banc qu'on ne lance plus ne
     garde rien. La page, elle, ne passe jamais cette option. */
  function lancer(etapes, options){
    etapes = (etapes || []).filter(function(e){ return e && e.cle && typeof e.faire === 'function'; });
    if(!etapes.length) return Promise.resolve({ rates: [] });
    var suivant = file.then(function(){ return executer(etapes, options); });
    // La file ne doit jamais rester cassee : un amorcage rate n'empeche pas le suivant.
    file = suivant.then(function(){}, function(){});
    return suivant;
  }

  function executer(etapes, options){
    var plafond = (options && options.plafondMs > 0) ? options.plafondMs : PLAFOND_MS;

    /* PAS DE SESSION, PAS DE VOILE, MAIS LES ETAPES TOURNENT QUAND MEME. Le bureau
       deconnecte est une porte d'entree, pas un outil en train de charger : y poser un
       voile d'attente ferait croire a une panne a quelqu'un qui n'a simplement pas de
       compte. Les etapes, elles, partent comme avant ce fichier et rendent toutes leur
       « je ne sais pas » sans lever : ne pas les lancer du tout serait un changement de
       comportement hors session, et ce chantier n'en demande aucun. */
    if(!session()){
      return etapes.reduce(function(p, e){
        return p.then(function(){ return Promise.resolve(e.faire()).catch(function(){}); });
      }, Promise.resolve()).then(function(){ return { rates: [] }; });
    }

    monter(etapes);

    return new Promise(function(resoudre){
      var fini = false, rates = [], faites = {}, debut = Date.now();

      var minuteur = setTimeout(function(){
        if(fini) return;
        fini = true;
        /* REGLE 3 : on ne coupe rien. Les etapes qui n'ont pas repondu continuent, et
           la page se completera par ses propres rappels quand elles aboutiront. */
        var enRetard = etapes.filter(function(e){ return !faites[e.cle]; }).map(function(e){ return e.cle; });
        enRetard.forEach(function(c){ dire(c, 'rate', 'pas de réponse'); });
        pied(rates.concat(enRetard), etapes, function(b){ resoudre(b); }, plafond);
      }, plafond);

      (async function(){
        for(var i = 0; i < etapes.length; i++){
          var e = etapes[i];
          if(!fini) dire(e.cle, 'encours', 'en cours');
          var ok = true;
          /* Le `dire` remis a l'etape ne fait rien une fois le plafond passe : le voile
             n'est plus la, et une etape qui continue de tourner en arriere-plan n'a plus
             personne a qui parler. */
          var affiner = (function(cle){ return function(t){ if(!fini) preciser(cle, t); }; })(e.cle);
          try{ ok = (await e.faire(affiner)) !== false; }
          catch(err){ ok = false; }
          faites[e.cle] = true;
          if(!ok) rates.push(e.cle);
          if(!fini) dire(e.cle, ok ? 'fait' : 'rate', ok ? 'fait' : 'pas de réponse');
        }
        if(fini) return;            // le plafond a deja rendu la main, il a raison
        fini = true;
        clearTimeout(minuteur);
        if(!rates.length){
          var reste = PLANCHER_MS - (Date.now() - debut);
          var fermer = function(){ demonter(); resoudre({ rates: [] }); };
          if(reste > 0) setTimeout(fermer, reste); else fermer();
          return;
        }
        pied(rates, etapes, function(b){ resoudre(b); }, plafond);
      })();
    });
  }

  window.BdvAmorce = { lancer: lancer, PLAFOND_MS: PLAFOND_MS };
})();
