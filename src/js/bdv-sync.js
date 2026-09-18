/* Le Bureau du Vigneron, synchronisation des donnees du vigneron avec Supabase.

   Decision de Ted du 04/09/2026 : les reglages, le suivi client ET les lignes de vente sont
   gardes sur le serveur et redistribues a la demande. Les questions juridiques, de securite
   et l'arbitrage avec l'associe sont reportees, rien n'etant deploye chez un client a cette date.

   TROIS REGLES QUI TIENNENT TOUT LE FICHIER

   1. CADUQUE DEPUIS LE 18/09/2026. Elle disait : « IndexedDB reste la source de calcul,
      jamais le serveur. Le tableau de bord lit et calcule sur la base locale, exactement
      comme avant. Ca veut dire qu'aucun ecran n'a besoin d'etre reecrit, et qu'une panne
      reseau ne casse rien de visible. »

      Elle a tenu tant que les bases faisaient cinq mille lignes. A 171 569, elle voulait
      dire : recopier la base de donnees sur le poste, la relire et en deriver 171 569
      objets AVANT d'afficher un seul chiffre. Ted, capture a l'appui : « Y'a une BDD
      derriere qui est censee gerer les donnees et les redistribuer correctement. »

      LA REGLE QUI LA REMPLACE : **le serveur calcule, l'appareil affiche.** Les lignes ne
      descendent plus a l'ouverture ; elles descendent quand un ecran non porte les
      reclame, et ce chargement est annonce. Le hors-ligne est abandonne, Ted l'a accepte
      explicitement le 17/09.

      CE QUE CETTE REGLE A COUTE AVANT D'ETRE VUE : deux jours passes a optimiser les
      symptomes d'un choix d'architecture que personne ne remettait en cause, parce qu'il
      etait ecrit ici comme une regle. **Une regle ecrite dans le depot reste une decision,
      pas un fait.**

   2. Aucune fonction d'ici ne doit jamais empecher l'outil de s'ouvrir.
      Tout ce qui parle au reseau echoue en silence, renvoie un compte rendu, et laisse
      l'appelant continuer. Un vigneron ne doit jamais se retrouver enferme dehors de ses
      propres chiffres parce que notre serveur tousse.

   3. L'empreinte est la meme des deux cotes.
      `h`, le cyrb53 calcule sur les 40 premieres colonnes, sert de cle locale ET de cle
      serveur. Changer HASH_COLS rendrait meconnaissables les lignes deja en base, et le
      prochain import doublerait le chiffre d'affaires en silence, des deux cotes a la fois. */
(function(){
  'use strict';

  // PostgREST plafonne une reponse a 1000 lignes par defaut. On pagine explicitement plutot
  // que de faire confiance a un reglage serveur qu'on ne controle pas.
  const PAGE = 1000;
  // Un export reel fait quelques milliers de lignes. Envoyer tout d'un bloc produit un corps
  // de plusieurs megaoctets, qui passe mal sur une connexion de domaine. On decoupe, et on
  // peut afficher une progression honnete au passage.
  const LOT = 500;

  /* ============ LE REPERE DE SYNCHRONISATION, 17/09/2026 ============

     MESURE DE DEPART, sur la vraie base de facturation de Ted, 171 569 lignes. Les
     journaux Supabase du 17/09 au matin disent, POUR UNE SEULE OUVERTURE du bureau :
     174 requetes GET sur `/ventes`, 299 ms en moyenne, et autant de preflights CORS.
     Cinquante secondes d'attente, a chaque ouverture, pour des lignes que l'appareil
     avait deja toutes.

     LA CAUSE N'ETAIT PAS LE VOLUME, C'ETAIT LE GARDE-FOU LUI-MEME. `dejaLa` vient de
     dbCount(), qui compte TOUTE la base locale, tous bureaux confondus ; `compterVentes()`
     compte les lignes d'UN bureau. Des que la personne appartient a deux bureaux, les
     deux nombres ne peuvent plus coincider, l'egalite n'arrive jamais, et le
     rapatriement complet repart a chaque ouverture. Un garde-fou qui compare deux choses
     differentes ne se declenche pas, et il ne se plaint pas non plus.

     CE QU'ON FAIT A LA PLACE : on retient la date de mise a jour la plus recente qu'on
     ait recue, et on ne demande que ce qui est plus recent. Rien de neuf, c'est UNE
     requete pour toute l'ouverture au lieu de 174.

     TROIS CONDITIONS, ET AUCUNE N'EST DECORATIVE.

     1. `maj_le` EST POSE PAR LE SERVEUR, jamais par le navigateur. C'etait l'inverse
        jusqu'a aujourd'hui, `new Date().toISOString()` dans le corps de l'upsert. Une
        machine dont l'horloge avance de dix minutes posait alors un repere dans le
        futur, et TOUTES les lignes normales ecrites derriere seraient restees invisibles
        a cet appareil, sans un mot. Le declencheur `ventes_maj_le_serveur` le garantit
        meme pour un navigateur qui tourne encore sur une version en cache et qui
        enverrait toujours la colonne.
     2. UNE MARGE DE CINQ MINUTES SOUS LE REPERE. Une ligne recoit sa date au DEBUT de sa
        transaction et n'est visible qu'a la FIN : une lecture qui tombe entre les deux la
        manquerait, et ne repasserait jamais dessus. La marge coute de relire quelques
        lignes, l'absence de marge coute de ne jamais les voir.
     3. AU MOINDRE DOUTE, RAPATRIEMENT COMPLET, exactement comme pour le compteur. Pas de
        repere, compteur illisible, lignes sans date, curseur qui n'avance pas : on
        retombe sur la boucle par empreinte, qui n'a pas bouge d'une ligne. Cette
        fonction n'a toujours pas le droit de deviner.

     LA CLE COMMENCE PAR `bdv_`, et ce n'est pas cosmetique : `oublierCetAppareil()`
     efface tout ce prefixe a la deconnexion et au changement de compte, et
     `changerDeBureau()` vide le poste de la meme facon. Un repere qui survivrait a un
     changement de bureau ferait passer pour a jour une base qui appartient a un autre
     domaine. La renommer hors de ce prefixe rouvrirait la fuite fermee le 07/09/2026. */
  const REPERE_KEY = 'bdv_ventes_repere_v1';
  const MARGE_MS   = 5 * 60 * 1000;

  /* Le repere est range PAR BUREAU. Un seul champ ferait croire la base a jour juste
     apres un changement de bureau, dans la seconde ou le poste n'a pas encore ete vide. */
  function reperes(){
    try{ return JSON.parse(localStorage.getItem(REPERE_KEY) || '{}') || {}; }
    catch(e){ return {}; }
  }
  function lireRepere(){
    try{ const v = reperes()[BdvCompte.monBureau()]; return (typeof v === 'string' && v) ? v : null; }
    catch(e){ return null; }
  }
  function poserRepere(iso){
    if(typeof iso !== 'string' || !iso) return;
    try{ const t = reperes(); t[BdvCompte.monBureau()] = iso;
         localStorage.setItem(REPERE_KEY, JSON.stringify(t)); }catch(e){}
  }
  /* Appelee par effacerTout(), et exposee pour tout appelant qui vide la base locale.
     Un repere qui survit a un vidage annonce « tu es a jour » sur une base a zero ligne :
     plus rien ne redescend, jamais, et le vigneron croit que le bouton a tout perdu. */
  function oublierRepere(){
    try{ const t = reperes(); delete t[BdvCompte.monBureau()];
         localStorage.setItem(REPERE_KEY, JSON.stringify(t)); }catch(e){}
  }

  /* Vrai des qu'un rapatriement a abouti dans cette session. Sert UNIQUEMENT a autoriser
     la poussee a avancer le repere : les lignes qu'on envoie, on les a deja, mais celles
     qu'un AUTRE poste aurait envoyees pendant qu'on ne regardait pas, non. Sans tirage
     prealable, on laisse donc le repere ou il est, quitte a relire une fois de trop. */
  let TIRAGE_ABOUTI = false;

  /* LE BUREAU EST AUSSI UNE CONDITION, 13/09/2026. Depuis le lot 17 une ligne
     appartient a un bureau, pas a une personne : sans bureau connu, on ne sait pas ou
     ecrire, et on prefere refuser franchement que d'envoyer une ligne sans proprietaire.
     Le cas se produit une fois, au tout premier chargement suivant la mise en ligne :
     BdvCompte.chargerBureau() va le chercher et previent par l'evenement `bdv:bureau`. */
  function pret(){
    return !!(window.BdvCompte && BdvCompte.monId && BdvCompte.monId()
      && BdvCompte.monBureau && BdvCompte.monBureau());
  }

  /* LA REGLE DE TOUT CE FICHIER DEPUIS LE LOT 17, et elle ne se devine pas a la lecture
     d'une seule requete : la securite par ligne dit ce qu'on A LE DROIT de lire, le
     bureau courant dit ce qu'on DOIT lire. Ce ne sont pas les memes. Mesure du
     13/09/2026 sur un Postgres d'essai : un compte membre de DEUX bureaux lit 57 lignes
     de vente sans filtre et 50 avec. Sans filtre, deux domaines se melangent dans la
     meme ardoise sans lever la moindre erreur, et le chiffre d'affaires affiche est faux.

     Donc `auBureau()` est colle a CHAQUE requete : les lectures et les suppressions
     autant que les ecritures. Une suppression sans filtre de bureau effacerait la meme
     cle metier dans TOUS les bureaux de la personne. */
  function auBureau(){ return '&bureau=eq.' + encodeURIComponent(BdvCompte.monBureau()); }

  /* ============================ LES LIGNES DE VENTE ============================ */

  /* Rend les lignes du serveur au format local {h, raw}, pret pour dbAddMany.
     `surProgres(recues)` est optionnel, appele apres chaque page.
     `dejaLa` est le nombre de lignes que cet appareil possede DEJA (dbCount()).

     ================= DEUX CORRECTIONS MESUREES, 08/09/2026 =================

     Mesure de depart, sur 4 939 lignes puis 15 000 et 40 000, dans un vrai navigateur :
     le premier clic sur une piece de vente retelechargeait la base ENTIERE a chaque
     visite. 1,8 Mo et 1,9 s a 4 939 lignes ; 14,7 Mo et 11,7 s a 40 000. Et sans aucune
     latence reseau dans la mesure : sur la 4G d'un domaine, c'est une minute.

     1. ON COMPTE AVANT DE LIRE. Le compteur passe par l'en-tete Content-Range, il ne
        rapatrie AUCUNE donnee. Autant de lignes ici que sur le compte : il n'y a rien a
        aller chercher, on rend un tableau vide. Mesure : 11,7 s -> 2,9 s a 40 000 lignes,
        et 14,7 Mo -> zero.

        CE N'EST PAS UNE SUPPOSITION, c'est une verification, et la nuance est tout le
        sujet : au MOINDRE doute on refait le rapatriement complet. Compteur illisible,
        appelant qui ne sait pas ce qu'il a, ecart dans un sens ou dans l'autre : on lit
        tout. La regle de cette fonction reste « elle n'a pas le droit de deviner ».

        L'ecart assume, et il est etroit : un AUTRE appareil qui enrichit une ligne
        existante sans changer le nombre de lignes (le cas des colonnes e-mail arrivees
        en aout 2026) ne serait pas vu par ce poste avant son prochain import. Sans effet
        sur les chiffres, qui ne lisent pas ces colonnes.

     2. PAGINATION PAR CURSEUR, plus par decalage. Le plan d'execution de Postgres le
        disait : pour rendre la 5e page de 1 000 lignes, `offset 4000` parcourait les
        4 939 lignes, 4 998 blocs, 87 ms. Le cout total devenait quadratique avec le
        volume. « Les lignes apres la derniere que j'ai recue » est une recherche dans
        l'index (id, empreinte), donc un cout CONSTANT par page.

        La cle (id, empreinte) est unique et RLS borne la lecture a un seul compte :
        `empreinte > la derniere` ne peut donc ni sauter ni repeter une ligne. Ne pas
        remplacer `order=empreinte.asc` par un autre tri sans changer la borne avec.

     LA SORTIE DE BOUCLE NE CHANGE PAS : on s'arrete sur une page VIDE, jamais sur une
     page plus courte que demandee. Le jour ou le plafond de lignes du projet Supabase
     passe sous PAGE, l'hypothese « moins que demande = fin des donnees » ferait
     redescendre la base tronquee, sans un mot. Depuis que se deconnecter efface ce
     navigateur, cette boucle est le SEUL moyen de retrouver ses ventes. */
  async function tirerVentes(surProgres, dejaLa){
    if(!pret()) return [];

    /* LA VOIE RAPIDE D'ABORD. Elle rend `null` quand elle refuse de repondre, et jamais
       un tableau vide par defaut : « je ne sais pas » et « il n'y a rien » ne doivent pas
       se ressembler ici, c'est toute la difference entre une ouverture rapide et une base
       tronquee en silence. */
    /* L'ORDRE N'A PAS BOUGE, ET C'EST VOULU : la voie rapide d'abord, le comptage
       ensuite. Ce qui a change est DANS la voie rapide, qui sait maintenant renoncer
       quand le repere ne discrimine plus rien. Deplacer le comptage devant aurait
       coute une requete de plus a chaque ouverture ou il n'y a rien de neuf, c'est-a-
       dire le cas normal, pour reparer un cas particulier. Le banc du rapatriement l'a
       refuse, a juste titre. */
    const depuis = lireRepere();
    if(depuis){
      const rapide = await tirerDepuis(depuis, surProgres, dejaLa);
      if(rapide){ TIRAGE_ABOUTI = true; return rapide; }
    }

    if(typeof dejaLa === 'number' && dejaLa >= 0){
      const distant = await compterVentes();
      if(distant != null && distant === dejaLa){ TIRAGE_ABOUTI = true; return []; }
    }

    const sorties = [];
    let apres = null;                 // l'empreinte de la derniere ligne recue
    let plusRecente = null;           // la date de mise a jour la plus haute rencontree
    for(;;){
      const borne = (apres == null) ? '' : '&empreinte=gt.' + encodeURIComponent(apres);
      const page = await BdvCompte.api(
        '/ventes?select=empreinte,brut,maj_le&order=empreinte.asc&limit=' + PAGE + borne + auBureau());
      if(!page || !page.length) break;
      page.forEach(function(l){
        sorties.push({ h: l.empreinte, raw: l.brut });
        if(l.maj_le && (plusRecente == null || l.maj_le > plusRecente)) plusRecente = l.maj_le;
      });
      apres = page[page.length - 1].empreinte;
      if(surProgres) surProgres(sorties.length);
    }
    /* Le repere ne se pose qu'apres une boucle ALLEE JUSQU'AU BOUT, donc apres la page
       vide qui la termine. Le poser au fil des pages ferait qu'un reseau coupe au milieu
       laisserait un repere en avance sur une base incomplete, et les lignes manquantes ne
       redescendraient plus jamais. Et il ne se pose pas du tout si le serveur n'a rendu
       aucune date : une colonne absente est un doute, pas un zero. */
    if(plusRecente){ poserRepere(plusRecente); TIRAGE_ABOUTI = true; }
    return sorties;
  }

  /* Ce qui a change depuis le repere, et rien d'autre. Rend `null` des qu'un doute
     apparait, et l'appelant retombe alors sur le rapatriement complet.

     LE CURSEUR EST EN `gte.` ET NON EN `gt.`, ET C'EST VOULU. Un lot d'import ecrit ses
     500 lignes dans UNE transaction, donc toutes portent exactement la meme date, celle
     du debut de la transaction. Une borne stricte sur cette date sauterait la fin du
     groupe des qu'une page tombe au milieu. La borne large rend donc quelques lignes deja
     connues, ce qui ne coute rien, dbAddMany les reconnait a leur empreinte.

     LA SORTIE DE BOUCLE NE CHANGE PAS NON PLUS : on s'arrete sur une page VIDE, jamais
     sur une page plus courte que demandee, meme raison qu'au-dessus. S'y ajoute le seul
     garde-fou propre a la borne large : une page pleine qui n'apporte AUCUNE ligne neuve
     et ne fait pas avancer la date voudrait dire qu'un groupe de lignes de meme date est
     plus gros qu'une page. On ne devine pas ce que ca donnerait, on rend `null`. */
  async function tirerDepuis(depuis, surProgres, dejaLa){
    const t = Date.parse(depuis);
    if(!(t > 0)) return null;
    const borne = new Date(t - MARGE_MS).toISOString();

    const combien = await compterDepuis(borne);
    if(combien == null) return null;      // compteur illisible : doute, donc tout
    if(combien === 0) return [];          // UNE requete pour toute l'ouverture

    /* ELLE RENONCE QUAND ELLE NE DISCRIMINE PLUS RIEN, 17/09/2026 au soir.

       Un repere ne sert a quelque chose que s'il ECARTE des lignes. Quand la borne en
       ramene AUTANT QUE LE COMPTE EN CONTIENT, elle n'ecarte rien : la « voie rapide »
       est alors un rapatriement complet qui se croit rapide. Elle rendait ses 171 569
       lignes en se declarant satisfaite, si bien que le comptage pose apres elle
       n'etait jamais atteint, et Ted retelechargeait sa base a chaque ouverture.

       CE N'EST PAS UN CAS TORDU, c'est le cas de toute base importee d'un coup. Celle
       de Ted a ete ecrite en SOIXANTE-TREIZE SECONDES, de 08:32:06 a 08:33:19 : la
       marge de cinq minutes, qui existe pour ne pas couper un lot d'import au milieu,
       couvre alors la base ENTIERE. Le repere ne ment pas, il ne trie simplement plus.

       LE BON DISCRIMINANT EST LE TOTAL DU SERVEUR, ET PAS LE COMPTE LOCAL. Ma premiere
       version comparait `combien` a ce que l'appareil porte deja, et le banc l'a
       refusee en trois controles : ramener 1 500 lignes quand on en a 1 000 est
       parfaitement legitime s'il en manque 1 500. « Beaucoup » et « tout » ne se
       confondent pas, et seul le total permet de les distinguer.

       CETTE REQUETE DE PLUS NE COUTE RIEN LA OU ELLE EST POSEE : elle est apres
       `combien === 0`, donc les ouvertures ou il n'y a rien de neuf gardent leur
       requete unique. Elle n'arrive que lorsqu'on s'apprete de toute facon a
       travailler. Elle coute 222 ms depuis que `ventes` est passe au VACUUM. */
    if(typeof dejaLa === 'number' && dejaLa >= 0){
      const total = await compterVentes();
      if(total != null && combien >= total){
        // Le repere ne trie rien. Autant de lignes des deux cotes : il n'y a rien a faire.
        if(total === dejaLa) return [];
        // Sinon on ne sait plus rien : `null`, donc rapatriement complet par le curseur.
        return null;
      }
    }

    const sorties = [];
    const vues = new Set();
    let curseur = borne, plusRecente = depuis;
    for(;;){
      const page = await BdvCompte.api('/ventes?select=empreinte,brut,maj_le&maj_le=gte.'
        + encodeURIComponent(curseur) + '&order=maj_le.asc,empreinte.asc&limit=' + PAGE + auBureau());
      if(!page || !page.length) break;
      let neuves = 0;
      let derniere = curseur;
      for(let i = 0; i < page.length; i++){
        const l = page[i];
        if(!l.maj_le) return null;        // une ligne sans date : on ne sait plus ou on en est
        if(!vues.has(l.empreinte)){ vues.add(l.empreinte); sorties.push({ h: l.empreinte, raw: l.brut }); neuves++; }
        if(l.maj_le > derniere) derniere = l.maj_le;
        if(l.maj_le > plusRecente) plusRecente = l.maj_le;
      }
      if(surProgres) surProgres(sorties.length);
      if(derniere === curseur && !neuves) break;
      if(derniere === curseur) return null;   // le curseur n'avance pas : voir l'en-tete
      curseur = derniere;
    }
    poserRepere(plusRecente);
    return sorties;
  }

  /* Combien de lignes ont bouge depuis la borne. Meme mecanique que compterVentes() :
     l'en-tete Content-Range, donc pas un octet de donnees. C'est cette requete, et elle
     seule, qui remplace les 174 d'avant les jours ou rien n'a change. */
  async function compterDepuis(borne){
    if(!pret() || !BdvCompte.compter) return null;
    return await BdvCompte.compter('/ventes?select=empreinte&maj_le=gte.'
      + encodeURIComponent(borne) + auBureau());
  }

  // Envoie des lignes {h, raw}. Les doublons sont ignores par le serveur grace a la cle
  // primaire (id, empreinte) : deux appareils qui importent le meme export en meme temps ne
  // peuvent pas creer de doublon, meme si les deux croient etre les premiers.
  //
  // `resolution=merge-duplicates` et pas `ignore-duplicates`, volontairement : un export plus
  // recent peut porter des colonnes hors empreinte (les adresses e-mail arrivees en aout 2026).
  // Ignorer le doublon garderait l'ancienne ligne incomplete, exactement ce que rawEnrichit()
  // evite en local. On ecrase donc la ligne par la version qui arrive.
  // LE PIEGE DU 07/09/2026, A NE JAMAIS REINTRODUIRE
  //
  // Deux lignes identiques dans un meme export portent la MEME empreinte. C'est sans
  // consequence en local, dbAddMany les compte en doublons et passe. Mais a l'envoi c'est
  // mortel : PostgreSQL refuse un INSERT ... ON CONFLICT DO UPDATE dont deux lignes visent la
  // meme cle, et il refuse TOUT le lot, avec
  //     21000 : ON CONFLICT DO UPDATE command cannot affect row a second time
  // Un seul doublon interne faisait donc perdre les 500 lignes qui l'accompagnaient. La base
  // de Ted est restee bloquee a 500 lignes sur 4942, deux imports de suite, sans rien dire.
  //
  // On garde la DERNIERE occurrence, par coherence avec resolution=merge-duplicates : ici
  // comme cote serveur, c'est la version la plus recente d'une ligne qui gagne.
  function dedoublonner(items){
    const vus = new Map();
    (items || []).forEach(function(it){ if(it && it.h) vus.set(it.h, it); });
    return Array.from(vus.values());
  }

  function envoyerLot(lot){
    return BdvCompte.api('/ventes?on_conflict=bureau,empreinte', {
      methode: 'POST',
      corps: lot,
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
    });
  }

  // Un lot refuse est recoupe en deux et reessaye, jusqu'a la ligne seule. Une ligne fautive
  // coute donc une ligne, et plus jamais les 499 qui voyageaient avec elle. Le dedoublonnage
  // ci-dessus supprime la cause connue ; ceci protege de toutes celles qu'on ne connait pas
  // encore, et c'est la moitie qui compte : une sauvegarde ne doit pas etre tout ou rien.
  async function envoyerAvecReprise(lot){
    try{
      await envoyerLot(lot);
      return { envoyees: lot.length, echecs: 0 };
    }catch(e){
      if(lot.length === 1) return { envoyees: 0, echecs: 1 };
      const milieu = Math.floor(lot.length / 2);
      const a = await envoyerAvecReprise(lot.slice(0, milieu));
      const b = await envoyerAvecReprise(lot.slice(milieu));
      return { envoyees: a.envoyees + b.envoyees, echecs: a.echecs + b.echecs };
    }
  }

  async function pousserVentes(items, surProgres){
    if(!pret() || !items || !items.length) return { envoyees: 0, echecs: 0, doublons: 0 };
    const bureau = BdvCompte.monBureau();
    const uniques = dedoublonner(items);
    const doublons = items.length - uniques.length;
    let envoyees = 0, echecs = 0;
    for(let i = 0; i < uniques.length; i += LOT){
      const lot = uniques.slice(i, i + LOT).map(function(it){
        /* PLUS DE `maj_le` ICI, 17/09/2026. C'etait l'horloge du navigateur qui datait
           les lignes du serveur. Le declencheur `ventes_maj_le_serveur` la pose
           desormais, et il ne bouge la date que si `brut` a VRAIMENT change : sans
           cette derniere condition, reimporter deux fois le meme export redaterait
           les 171 569 lignes et ferait tout redescendre a l'ouverture suivante. */
        return { bureau: bureau, empreinte: it.h, brut: it.raw };
      });
      const r = await envoyerAvecReprise(lot);
      envoyees += r.envoyees;
      echecs   += r.echecs;
      if(surProgres) surProgres(Math.min(i + LOT, uniques.length), uniques.length);
    }
    /* RECALER LE REPERE, SOUS UNE SEULE CONDITION. Les lignes qu'on vient d'envoyer
       portent une date toute neuve : sans ce recalage, la prochaine ouverture les
       redemanderait toutes, et l'import d'un gros export ramenerait exactement la minute
       d'attente que ce chantier supprime.

       La condition, c'est `TIRAGE_ABOUTI` : on n'avance le repere que si un rapatriement
       a abouti dans cette session. Avancer sans avoir lu sauterait les lignes qu'un autre
       poste du bureau aurait deposees entre-temps, et elles ne redescendraient plus
       jamais. Sans tirage prealable on ne touche a rien : ca coute un rapatriement de
       trop, ce qui est le mauvais cote ou se tromper, et c'est le bon.

       La date vient du SERVEUR, jamais d'ici : c'est tout l'objet de la bascule du
       17/09/2026, et se recaler sur l'horloge locale la defairait en trois lignes. */
    if(envoyees && TIRAGE_ABOUTI){
      try{
        const der = await BdvCompte.api('/ventes?select=maj_le&order=maj_le.desc&limit=1' + auBureau());
        if(der && der.length && der[0].maj_le) poserRepere(der[0].maj_le);
      }catch(e){ /* tant pis : on relira tout une fois, on ne sautera rien */ }
    }
    return { envoyees: envoyees, echecs: echecs, doublons: doublons };
  }

  // Combien de lignes le compte contient-il vraiment. Sert au compteur d'ecart de « Ma base ».
  /* Y A-T-IL AU MOINS UNE LIGNE ? AJOUTEE LE 18/09/2026, ET PAS UN COMPTAGE.
     `compterVentes()` demande a PostgREST un `count=exact`, c'est-a-dire un `count(*)`
     sur tout le jeu filtre : sur les 171 569 lignes de Ted, 205 Mo a parcourir, et le
     serveur a rendu `57014 canceling statement due to statement timeout`. Un comptage
     exact n'est pas une question qu'on pose a chaque ouverture.
     Or la seule question de l'amorcage est « ce compte porte-t-il quelque chose ». Une
     ligne suffit a y repondre, et elle sort de l'index en quelques millisecondes.
     Rend `null` quand on ne sait pas : un reseau muet n'est pas un compte vide. */
  async function auMoinsUneVente(){
    if(!pret()) return null;
    try{
      const l = await BdvCompte.api('/ventes?select=empreinte&limit=1' + auBureau());
      return Array.isArray(l) ? l.length > 0 : null;
    }catch(e){ return null; }
  }

  async function compterVentes(){
    if(!pret() || !BdvCompte.compter) return null;
    return await BdvCompte.compter('/ventes?select=empreinte' + auBureau());
  }

  /* ====================== LES CHIFFRES DE « MON CAP » ======================
     Lot 24, 17/09/2026. Le serveur rend en UN appel ce que l'ecran calculait sur
     171 569 lignes : chiffre d'affaires de l'exercice, comparaison a date egale,
     atterrissage, series mensuelles, panier, clients, factures.

     PROUVE AVANT D'ETRE BRANCHE. `v_cap_controle` compare, champ par champ, ce que
     rend cette fonction et ce que le NAVIGATEUR a depose dans `reglages.resume_ventes`
     a son dernier import. Treize champs sur treize identiques le 17/09/2026, sur la
     vraie base. Le jour ou un champ diverge, l'ecran doit reprendre son calcul local,
     pas afficher le chiffre du serveur.

     Rend `null` en cas d'echec, comme tout ce fichier : l'appelant retombe alors sur
     son calcul local, et personne ne voit un ecran vide. */
  /* ================= LES TROIS RESUMES PASSENT PAR LE CACHE, 18/09/2026 =================

     Ils appelaient chacun leur fonction de calcul. Mesure sur la base de Ted :
     `cap_resume` 1,1 s, `commerce_resume` 3,8 s, `cuvees_resume` 5,7 s. A CHAQUE
     ouverture d'ecran. Un logiciel de gestion ne recalcule pas son chiffre d'affaires
     a chaque fois qu'on le regarde : il le calcule quand il CHANGE.

     `public.resume(b, cle)` rend le resume range en table. Absent, elle le calcule, le
     range et le rend. Il n'est efface que lorsque les ventes ou les reglages bougent,
     par declencheur : le vigneron paie le calcul UNE FOIS apres chaque import.

                        avant        apres
       cap_resume       1 100 ms
       commerce_resume  3 800 ms     0,8 ms   (lecture par cle primaire)
       cuvees_resume    5 735 ms

     ET LE CALCUL SE RECHAUFFE TOUT DE SUITE APRES L'IMPORT, pendant que le vigneron
     regarde encore son compte rendu : c'est le seul moment ou attendre est normal. */
  async function resume(cle){
    if(!pret()) return null;
    try{
      const r = await BdvCompte.api('/rpc/resume', {
        methode: 'POST', corps: { b: BdvCompte.monBureau(), cle: cle } });
      return (r && typeof r === 'object' && !Array.isArray(r)) ? r : null;
    }catch(e){ return null; }
  }
  function capResume(){ return resume('cap'); }
  function commerceResume(){ return resume('commerce'); }
  function cuveesResume(){ return resume('cuvees'); }

  /* Rechauffer les trois d'un coup. Appelee apres un import, sans etre attendue : si
     elle echoue, le premier ecran ouvert refera le calcul, c'est tout. */
  async function rechaufferResumes(){
    if(!pret()) return false;
    try{
      await BdvCompte.api('/rpc/resumes_rechauffer', {
        methode: 'POST', corps: { b: BdvCompte.monBureau() } });
      return true;
    }catch(e){ return false; }
  }

  /* ============================== LES REGLAGES ============================== */
  // Un seul enregistrement par vigneron. Remplace bdv_objectif_v5, bdv_exercice_v1,
  // bdv_persolabels_v4 et le classement de l'ecran Reglages, qui vivaient dans le
  // localStorage et disparaissaient avec le navigateur.

  async function lireReglages(){
    if(!pret()) return null;
    const lignes = await BdvCompte.api('/reglages?select=*' + auBureau() + '&limit=1');
    return (lignes && lignes[0]) || null;
  }

  // Ecriture complete, jamais partielle : c'est un enregistrement unique, et l'appelant
  // connait toujours l'etat entier. `on_conflict=bureau` cree la ligne au premier appel.
  async function ecrireReglages(champs){
    if(!pret()) return false;
    const corps = Object.assign({ bureau: BdvCompte.monBureau(), maj_le: new Date().toISOString() }, champs);
    try{
      await BdvCompte.api('/reglages?on_conflict=bureau', {
        methode: 'POST',
        corps: [corps],
        entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
      });
      return true;
    }catch(e){ return false; }
  }

  /* ============================ LE SUIVI CLIENT ============================ */
  // Cle = le NUMERO client Vitisoft, seul. Decision du 04/09/2026 : la colonne est toujours
  // remplie dans un export, donc une fiche ne s'orpheline pas quand le vigneron corrige
  // l'orthographe d'un nom. Le nom ne sert plus qu'a l'affichage.

  // Rend la meme forme que la structure CRM locale :
  // {clientId: {statut, notes, rappel, rappel_titre, canal, tags}}
  async function lireSuivi(){
    if(!pret()) return {};
    const lignes = await BdvCompte.api('/suivi_clients?select=client_id,statut,notes,rappel,rappel_titre,canal,tags,cree_par' + auBureau());
    const out = {};
    (lignes || []).forEach(function(l){
      const c = {};
      if(l.statut) c.statut = l.statut;
      if(l.notes)  c.notes  = l.notes;
      if(l.rappel) c.rappel = l.rappel;
      /* LE MOTIF DU RAPPEL SE LIT ICI, ET C'EST OBLIGATOIRE, pas decoratif :
         ecrireSuivi() renvoie la LIGNE ENTIERE a chaque geste. Une colonne qu'on
         n'aurait pas relue repartirait a `null` au premier rappel repousse depuis
         le tableau de bord, et le motif tape au bureau disparaitrait sans un mot. */
      if(l.rappel_titre) c.rappel_titre = l.rappel_titre;
      if(l.canal)  c.canal  = l.canal;
      if(l.tags && l.tags.length) c.tags = l.tags;
      /* QUI A ECRIT CETTE FICHE, depuis le 14/09/2026. Ce champ ne repart JAMAIS en
         ecriture : `ecrireSuivi()` construit son corps colonne par colonne et ne
         l'inclut pas, et la base le pose elle-meme. Il ne compte pas non plus dans
         `crmVide()` : une fiche qui ne porterait que son auteur reste une fiche vide. */
      if(l.cree_par) c.cree_par = l.cree_par;
      out[l.client_id] = c;
    });
    return out;
  }

  async function ecrireSuivi(clientId, fiche){
    if(!pret() || !clientId) return false;
    fiche = fiche || {};
    const corps = {
      bureau: BdvCompte.monBureau(),
      client_id: String(clientId),
      statut: fiche.statut || null,
      notes:  fiche.notes  || null,
      rappel: fiche.rappel || null,
      rappel_titre: fiche.rappel_titre || null,
      canal:  fiche.canal  || null,
      tags:   fiche.tags   || [],
      maj_le: new Date().toISOString()
    };
    try{
      /* return=representation, et PAS minimal. BdvCompte.api() rend `null` SANS LEVER dans
         DEUX cas : session tombee, et reponse 2xx a corps vide. En minimal, une ecriture
         reussie et une session morte se ressemblent donc exactement, et cette fonction
         repondait `true` dans les deux cas. La regle est deja ecrite dans le projet : toute
         ecriture dont l'issue est exploitee demande la representation. */
      const r = await BdvCompte.api('/suivi_clients?on_conflict=bureau,client_id', {
        methode: 'POST',
        corps: [corps],
        entetes: { 'Prefer': 'resolution=merge-duplicates,return=representation' }
      });
      return Array.isArray(r) && r.length > 0;
    }catch(e){ return false; }
  }

  // Une fiche videe par le vigneron doit disparaitre du serveur, pas y rester vide. Sinon la
  // table gonfle de fiches fantomes qu'aucun ecran ne montre plus.
  async function supprimerSuivi(clientId){
    if(!pret() || !clientId) return false;
    try{
      /* Meme motif que ecrireSuivi. Difference a connaitre : ici un tableau VIDE est un
         succes, il n'y avait simplement rien a supprimer. C'est `null` qui trahit la
         session tombee. */
      const r = await BdvCompte.api('/suivi_clients?client_id=eq.' + encodeURIComponent(clientId) + auBureau(), {
        methode: 'DELETE',
        entetes: { 'Prefer': 'return=representation' }
      });
      return Array.isArray(r);
    }catch(e){ return false; }
  }

  /* ============================== TOUT EFFACER ============================== */
  // Appelle la fonction SQL, qui vide les trois tables du compte appelant en une transaction.
  // Bornee a auth.uid() cote serveur : elle ne peut rien effacer chez quelqu'un d'autre.
  // ---------------- LA FILE DEPOSEE POUR LE BUREAU ----------------
  // Le tableau de bord est le seul a savoir calculer qui rappeler. Il depose ici le
  // resultat, et /mon-bureau/ le sert sans rien recalculer. Un instantane, ecrase a
  // chaque analyse : ce n'est pas un historique, c'est l'etat du jour.
  //
  // La file porte des NOMS de clients. C'est deja le cas de `ventes.brut`, qui contient
  // les colonnes brutes de l'export : aucune frontiere nouvelle n'est franchie ici.
  async function deposerFile(file, resume){
    if(!pret()) return false;
    const corps = {
      bureau: BdvCompte.monBureau(),
      file_travail: file || [],
      resume_ventes: resume || null,
      depose_le: new Date().toISOString()
    };
    try{
      await BdvCompte.api('/reglages?on_conflict=bureau', {
        methode: 'POST',
        entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        corps: [corps]
      });
      return true;
    }catch(e){ return false; }
  }

  // ---------------- LE JOURNAL D'ECHANGES ----------------
  // Une entree par geste : appel passe, message laisse, note ecrite, relance ecartee.
  // Contrairement au suivi, une entree ne se modifie jamais : elle s'ajoute. C'est ce qui
  // fait la difference entre un historique et un bloc-notes qu'on ecrase.
  //
  // `echange_id` est fabrique par le navigateur, comme l'empreinte des lignes de vente.
  // Deux consequences voulues : le meme geste pousse deux fois ne cree pas de doublon, et
  // l'ecran peut afficher l'entree avant que le reseau ait repondu.
  async function lireEchanges(clientId){
    if(!pret()) return [];
    // Meme plafond que pour les ventes : PostgREST rend au plus 1000 lignes par appel.
    // Sans pagination, un vigneron actif verrait son journal silencieusement tronque au
    // bout de deux ou trois ans, et seulement sur son deuxieme appareil.
    const filtre = clientId ? '&client_id=eq.' + encodeURIComponent(clientId) : '';
    const out = [];   // PAGE est la constante du module, la meme que pour les ventes
    let debut = 0;
    for(;;){
      const page = await BdvCompte.api(
        '/echanges?select=echange_id,client_id,le,type,canal,resume,cree_par' + filtre + auBureau() +
        '&order=le.desc&limit=' + PAGE + '&offset=' + debut);
      if(!page || !page.length) break;
      out.push.apply(out, page);
      debut += page.length;
      /* LE DECALAGE RESTE ICI, ET C'EST VOLONTAIRE. tirerVentes() est passe au curseur le
         08/09/2026 parce que sa cle de tri, `empreinte`, est UNIQUE : « les lignes apres la
         derniere » ne peut alors ni sauter ni repeter une ligne. Ici le tri est `le`, une
         date d'echange, que deux entrees du meme jour partagent tres bien. Un curseur sur
         une cle non unique perd des lignes en silence, ce qui est bien pire que de relire
         quelques pages. Et le volume ne le justifie pas : un journal d'echanges compte des
         dizaines de lignes, pas des milliers. Le jour ou il en comptera, la borne devra
         porter le couple (le, echange_id), pas `le` seul. */
    }
    return out;
  }

  async function ecrireEchange(entree){
    if(!pret() || !entree || !entree.client_id || !entree.echange_id) return false;
    // `le` vient de l'entree du miroir, et `maj_le` la suit : l'entree porte sa propre
    // date de retouche, ou a defaut celle de son ecriture. Laisser maj_le absent
    // rendait la main au defaut now() de la base, donc a l'heure du REJEU : une entree
    // posee hors reseau et repoussee le lendemain s'affichait corrigee sans l'avoir ete.
    const quandE = entree.le || new Date().toISOString();
    const corps = {
      bureau: BdvCompte.monBureau(),
      echange_id: String(entree.echange_id),
      client_id: String(entree.client_id),
      le: quandE,
      maj_le: entree.maj_le || quandE,
      type: entree.type || 'note',
      canal: entree.canal || null,
      resume: entree.resume || null
    };
    try{
      await BdvCompte.api('/echanges?on_conflict=bureau,echange_id', {
        methode: 'POST',
        entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        corps: [corps]
      });
      return true;   // le dashboard s'appuie sur ce booleen pour vider sa file d'attente
    }catch(e){ return false; }
  }

  async function supprimerEchange(echangeId){
    if(!pret() || !echangeId) return false;
    try{
      await BdvCompte.api('/echanges?echange_id=eq.' + encodeURIComponent(echangeId) + auBureau(), {
        methode: 'DELETE',
        entetes: { 'Prefer': 'return=minimal' }
      });
      return true;
    }catch(e){ return false; }
  }

  /* « VIDER LA BASE » EST DEVENU UN GESTE DE MAITRE, ET IL A CHANGE DE NOM, 13/09/2026.
     `effacer_mes_donnees()` disait « mes donnees » a quelqu'un qui s'appretait a effacer
     celles de tout un domaine ; elle est supprimee cote base, un appel a l'ancien nom
     rend 404. La nouvelle verifie qui appelle AVANT d'effacer quoi que ce soit : un simple
     utilisateur recoit un refus, et rien n'est touche. */
  async function effacerTout(){
    if(!pret()) return false;
    try{
      await BdvCompte.api('/rpc/vider_la_base_du_bureau', {
        methode: 'POST', corps: { b: BdvCompte.monBureau() } });
      /* Le repere part avec les lignes. S'il restait, il annoncerait « rien de neuf » sur
         une base a zero ligne, plus rien ne redescendrait, et le vigneron qui a vide par
         erreur n'aurait aucun moyen de recuperer depuis un autre poste. */
      oublierRepere();
      return true;
    }catch(e){ return false; }
  }

  window.BdvSync = {
    pret: pret,
    tirerVentes: tirerVentes,
    pousserVentes: pousserVentes,
    compterVentes: compterVentes,
    auMoinsUneVente: auMoinsUneVente,
    capResume: capResume,
    commerceResume: commerceResume,
    cuveesResume: cuveesResume,
    rechaufferResumes: rechaufferResumes,
    lireReglages: lireReglages,
    ecrireReglages: ecrireReglages,
    lireSuivi: lireSuivi,
    ecrireSuivi: ecrireSuivi,
    supprimerSuivi: supprimerSuivi,
    deposerFile: deposerFile,
    lireEchanges: lireEchanges,
    ecrireEchange: ecrireEchange,
    supprimerEchange: supprimerEchange,
    effacerTout: effacerTout,
    oublierRepere: oublierRepere
  };
})();
