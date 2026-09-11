/* Le Bureau du Vigneron, synchronisation des donnees du vigneron avec Supabase.

   Decision de Ted du 04/09/2026 : les reglages, le suivi client ET les lignes de vente sont
   gardes sur le serveur et redistribues a la demande. Les questions juridiques, de securite
   et l'arbitrage avec l'associe sont reportees, rien n'etant deploye chez un client a cette date.

   TROIS REGLES QUI TIENNENT TOUT LE FICHIER

   1. IndexedDB reste la source de calcul, jamais le serveur.
      Le tableau de bord lit et calcule sur la base locale, exactement comme avant. Le serveur
      ne fait que garder une copie et la rendre sur un autre appareil. Ca veut dire qu'aucun
      ecran n'a besoin d'etre reecrit, et qu'une panne reseau ne casse rien de visible.

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

  function pret(){
    return !!(window.BdvCompte && BdvCompte.monId && BdvCompte.monId());
  }

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

    if(typeof dejaLa === 'number' && dejaLa >= 0){
      const distant = await compterVentes();
      if(distant != null && distant === dejaLa) return [];
    }

    const sorties = [];
    let apres = null;                 // l'empreinte de la derniere ligne recue
    for(;;){
      const borne = (apres == null) ? '' : '&empreinte=gt.' + encodeURIComponent(apres);
      const page = await BdvCompte.api(
        '/ventes?select=empreinte,brut&order=empreinte.asc&limit=' + PAGE + borne);
      if(!page || !page.length) break;
      page.forEach(function(l){ sorties.push({ h: l.empreinte, raw: l.brut }); });
      apres = page[page.length - 1].empreinte;
      if(surProgres) surProgres(sorties.length);
    }
    return sorties;
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
    return BdvCompte.api('/ventes?on_conflict=id,empreinte', {
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
    const moi = BdvCompte.monId();
    const uniques = dedoublonner(items);
    const doublons = items.length - uniques.length;
    let envoyees = 0, echecs = 0;
    for(let i = 0; i < uniques.length; i += LOT){
      const lot = uniques.slice(i, i + LOT).map(function(it){
        return { id: moi, empreinte: it.h, brut: it.raw, maj_le: new Date().toISOString() };
      });
      const r = await envoyerAvecReprise(lot);
      envoyees += r.envoyees;
      echecs   += r.echecs;
      if(surProgres) surProgres(Math.min(i + LOT, uniques.length), uniques.length);
    }
    return { envoyees: envoyees, echecs: echecs, doublons: doublons };
  }

  // Combien de lignes le compte contient-il vraiment. Sert au compteur d'ecart de « Ma base ».
  async function compterVentes(){
    if(!pret() || !BdvCompte.compter) return null;
    return await BdvCompte.compter('/ventes?select=empreinte');
  }

  /* ============================== LES REGLAGES ============================== */
  // Un seul enregistrement par vigneron. Remplace bdv_objectif_v5, bdv_exercice_v1,
  // bdv_persolabels_v4 et le classement de l'ecran Reglages, qui vivaient dans le
  // localStorage et disparaissaient avec le navigateur.

  async function lireReglages(){
    if(!pret()) return null;
    const lignes = await BdvCompte.api('/reglages?select=*&limit=1');
    return (lignes && lignes[0]) || null;
  }

  // Ecriture complete, jamais partielle : c'est un enregistrement unique, et l'appelant
  // connait toujours l'etat entier. `on_conflict=id` cree la ligne au premier appel.
  async function ecrireReglages(champs){
    if(!pret()) return false;
    const corps = Object.assign({ id: BdvCompte.monId(), maj_le: new Date().toISOString() }, champs);
    try{
      await BdvCompte.api('/reglages?on_conflict=id', {
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
    const lignes = await BdvCompte.api('/suivi_clients?select=client_id,statut,notes,rappel,rappel_titre,canal,tags');
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
      out[l.client_id] = c;
    });
    return out;
  }

  async function ecrireSuivi(clientId, fiche){
    if(!pret() || !clientId) return false;
    fiche = fiche || {};
    const corps = {
      id: BdvCompte.monId(),
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
      const r = await BdvCompte.api('/suivi_clients?on_conflict=id,client_id', {
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
      const r = await BdvCompte.api('/suivi_clients?client_id=eq.' + encodeURIComponent(clientId), {
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
      id: BdvCompte.monId(),
      file_travail: file || [],
      resume_ventes: resume || null,
      depose_le: new Date().toISOString()
    };
    try{
      await BdvCompte.api('/reglages?on_conflict=id', {
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
        '/echanges?select=echange_id,client_id,le,type,canal,resume' + filtre +
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
      id: BdvCompte.monId(),
      echange_id: String(entree.echange_id),
      client_id: String(entree.client_id),
      le: quandE,
      maj_le: entree.maj_le || quandE,
      type: entree.type || 'note',
      canal: entree.canal || null,
      resume: entree.resume || null
    };
    try{
      await BdvCompte.api('/echanges?on_conflict=id,echange_id', {
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
      await BdvCompte.api('/echanges?echange_id=eq.' + encodeURIComponent(echangeId), {
        methode: 'DELETE',
        entetes: { 'Prefer': 'return=minimal' }
      });
      return true;
    }catch(e){ return false; }
  }

  async function effacerTout(){
    if(!pret()) return false;
    try{
      await BdvCompte.api('/rpc/effacer_mes_donnees', { methode: 'POST', corps: {} });
      return true;
    }catch(e){ return false; }
  }

  window.BdvSync = {
    pret: pret,
    tirerVentes: tirerVentes,
    pousserVentes: pousserVentes,
    compterVentes: compterVentes,
    lireReglages: lireReglages,
    ecrireReglages: ecrireReglages,
    lireSuivi: lireSuivi,
    ecrireSuivi: ecrireSuivi,
    supprimerSuivi: supprimerSuivi,
    deposerFile: deposerFile,
    lireEchanges: lireEchanges,
    ecrireEchange: ecrireEchange,
    supprimerEchange: supprimerEchange,
    effacerTout: effacerTout
  };
})();
