/* Le Bureau du Vigneron, LE PANNEAU DE REGLAGES UNIQUE.

   Decision de Ted du 07/09/2026 : les reglages du bureau, ceux du tableau de bord et
   l'ecran « Ma base » n'en font plus qu'un. Un seul panneau, ecrit une fois, ouvert depuis
   les deux pages. Ce qui est corrige ici est corrige partout, et surtout : il n'y a plus
   deux endroits ou lire son objectif de chiffre d'affaires et se demander lequel dit vrai.

   TROIS REGLES QUI TIENNENT CE FICHIER

   1. Le module porte son markup ET son style.
      Un panneau qui s'appuierait sur les classes du site (.voile, .ficheb, .reg__i)
      s'afficherait nu. Tout est donc prefixe `bdvr-`, et le style est injecte d'ici.
      DEPUIS LE 21/09/2026 IL N'ECRIT QUE DES JETONS `--bdv-*`, ceux des deux themes
      (src/css/bdv-theme.css), plus les cinq `--z-*` de l'echelle des couches. L'ancienne
      regle, « uniquement les 52 jetons declares dans les deux :root », valait quand le
      tableau de bord etait une page a lui ; il ne l'est plus depuis le lot 2d du
      07/09/2026, et ce panneau ne s'ouvre plus que dans /mon-bureau/, la seule page qui
      porte le drapeau `theme_bureau`. Un jeton papier vu ici est desormais une
      regression muette : il ne se retourne pas en theme sombre.

   2. Un champ touche n'est plus jamais rerempli, et rien ne part avant d'avoir tout relu.
      Ces deux gardes viennent du panneau du bureau, ou ils ont ete payes cher : une reponse
      reseau arrivee apres l'ouverture effacait le prenom en cours de frappe, et un
      « Enregistrer » clique avant la lecture ecrasait le code postal et desinscrivait de la
      lettre en silence. Ils ne sont pas negociables, cf. TOUCHES et les deux verrous _LU.

   3. Ce qui a besoin du moteur du tableau de bord est CONTRIBUE par l'hote.
      Le classement des familles et l'etat detaille de la base (le CA, les offerts, le
      hors-vente) se calculent sur ROWS, qui n'existe que dans le tableau de bord. Le module
      ne fait pas semblant de savoir les produire : il ouvre des emplacements, l'hote les
      remplit s'il peut, et le bureau y affiche un renvoi honnete a la place. */
(function(){
  'use strict';

  const PREFIXE = 'bdvr';
  let monte = false;              // le panneau est-il deja dans le document
  let PROFIL = null, PROFIL_LU = false;
  let REGL = null,   REGL_LU = false;
  let TOUCHES = {};               // champs touches par le vigneron, cf. regle 2
  let RETOUR_FOCUS = null;
  let SUR_PROFIL = null;          // l'hote veut savoir quand le profil change
  let ONGLET = null;              // l'onglet visible, cf. montrerOnglet()
  const BLOCS = [];               // emplacements contribues par l'hote, cf. regle 3

  function el(id){ return document.getElementById(id); }
  // Le bureau conditionne l'ecriture depuis le lot 17, au meme titre que la session.
  // `chargerProfil()` ci-dessous est la seule exception du fichier : la fiche `profils`
  // appartient toujours a la PERSONNE, pas au bureau. Elle se lit donc par `monId()`.
  function pret(){
    return !!(window.BdvCompte && BdvCompte.monId && BdvCompte.monId()
      && BdvCompte.monBureau && BdvCompte.monBureau());
  }

  /* ============================== LE STYLE ==============================
     Une seule regle a retenir avant d'y toucher : n'utiliser QUE des jetons `--bdv-*`.
     Ni couleur, ni taille, ni rayon, ni duree en dur. Les cinq `--z-*` sont la seule
     exception, et ils sont une ECHELLE ORDONNEE (--z-modale 400 < --z-voile 1000 <
     --z-busy 1050 < --z-statut 1100 < --z-amorce 1200) : elle a deja ete payee une fois
     par un bandeau de statut qui passait derriere ce panneau, le 08/09/2026. On ne
     l'ecrit jamais en dur, ici ni ailleurs.

     REPEINT LE 21/09/2026, AU LOT 5 DES DEUX THEMES. Le panneau posait une dalle creme
     au milieu d'un bureau noir, et il n'attendait meme pas qu'on la demande : sur une
     base vide, `openApp()` l'ouvre tout seul par-dessus l'ecran. Le fond passe a
     `--bdv-surface-3`, l'ombre dure du site part au profit d'un trait de 1 px, l'anneau
     de focus prend `--bdv-anneau`, et les six onglets prennent l'accent du bureau.

     La modale a ete refaite le 07/09/2026 : Ted l'a trouvee « en version verticale ».
     Elle l'etait pour deux raisons cumulees, et l'une cachait l'autre :
       1. `.bdvr-panneau--large` etait declaree AVANT `.bdvr-panneau`. A specificite egale
          c'est la derniere qui gagne, donc les 40rem battaient les 64rem et le panneau
          restait etroit quoi qu'on fasse. Le mecanisme a disparu : une seule largeur.
       2. Meme large, cinq sections empilees font un rouleau de deux mille pixels. D'ou les
          ONGLETS : une section a l'ecran, jamais de defilement du formulaire, et le pied
          reste colle en bas pour que « Enregistrer » soit toujours a portee de clic. */

  const STYLE = `
.bdvr-voile{position:fixed;inset:0;background:var(--bdv-voile);backdrop-filter:blur(2px);
  /* Le jeton et pas 1000 en dur : le bandeau de statut du moteur et son voile d'attente se
     placent PAR RAPPORT a cette valeur (--z-busy, --z-statut), et une echelle dont un
     barreau est ecrit en dur ailleurs est une echelle qu'on casse sans le voir. */
  z-index:var(--z-voile);display:flex;align-items:center;justify-content:center;padding:var(--bdv-e-6)}
/* Colonne : entete fixe, corps qui defile, pied colle. C'est ce qui garde « Enregistrer »
   visible quel que soit le contenu de l'onglet, y compris « Ma base » et ses tableaux. */
/* LA PROFONDEUR EST UN TRAIT DE 1 px, PAS UNE OMBRE, 21/09/2026. « --ombre-dure » est
   la signature du site, 6px 6px 0 en encre : posee sur un bureau sombre elle donne un
   bloc noir sans bord sous la boite. La regle du plateau n'autorise que deux ombres dans
   tout le produit, et le bureau n'en pose aucune depuis le lot de la coque. */
.bdvr-panneau{position:relative;display:flex;flex-direction:column;
  width:100%;max-width:62rem;max-height:90vh;background:var(--bdv-surface-3);
  border:1px solid var(--bdv-trait);border-radius:var(--bdv-r);box-shadow:none}
.bdvr-tete{flex:0 0 auto;padding:var(--bdv-e-6) var(--bdv-e-6) 0;border-bottom:1px solid var(--bdv-trait)}
.bdvr-x{position:absolute;top:var(--bdv-e-2);right:var(--bdv-e-3);background:none;border:none;
  font-size:var(--bdv-f-5);line-height:1;color:var(--bdv-encre-4);cursor:pointer;padding:var(--bdv-e-1) var(--bdv-e-2)}
.bdvr-x:hover{color:var(--bdv-accent)}
.bdvr-titre{font-family:inherit;font-weight:600;font-size:var(--bdv-f-5);letter-spacing:var(--bdv-ls-serre);color:var(--bdv-encre-1);margin:0}
.bdvr-sous{font-family:inherit;font-size:var(--bdv-f-3);color:var(--bdv-encre-4);margin:var(--bdv-e-1) 0 var(--bdv-e-4)}

/* LES ONGLETS. Etiquettes typographiques, pas des boutons a cadre : le panneau est un
   document de reglages, pas une barre d'outils. L'actif porte le filet dore du site. */
.bdvr-onglets{display:flex;flex-wrap:wrap;gap:0;margin-bottom:-1px}
.bdvr-onglet{background:none;border:none;border-bottom:2px solid transparent;
  padding:var(--bdv-e-2) var(--bdv-e-3);font-family:inherit;font-size:var(--bdv-f-2);
  text-transform:uppercase;letter-spacing:var(--bdv-ls-etiq);color:var(--bdv-encre-4);cursor:pointer;
  transition:color var(--bdv-d-court) var(--bdv-courbe),border-color var(--bdv-d-court) var(--bdv-courbe)}
.bdvr-onglet:hover{color:var(--bdv-encre-1)}
/* L'ONGLET CHOISI SE DIT DEUX FOIS : par l'accent, et par un filet de 2 px sous le mot.
   Le filet est une FORME, il se lit en niveaux de gris et en vision deuteranope. */
.bdvr-onglet.on{color:var(--bdv-accent);border-bottom-color:var(--bdv-accent)}
.bdvr-onglet:first-child{padding-left:0}

.bdvr-form{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}
.bdvr-corps{flex:1 1 auto;overflow-y:auto;padding:var(--bdv-e-6) var(--bdv-e-6)}

/* Un onglet = un bloc. Le defaut est cache, et "data-off" (pose par gateVitisoft) l'emporte
   sur tout : un bloc retire parce que le vigneron n'a pas Vitisoft ne doit pas pouvoir
   reapparaitre par un clic d'onglet. */
.bdvr-bloc{display:none;border:none;margin:0;padding:0;min-width:0}
.bdvr-bloc--on{display:block}
.bdvr-bloc[data-off="oui"]{display:none}
.bdvr-legende{display:none}   /* le titre de section est desormais l'onglet lui-meme */

/* Deux colonnes pour les champs courts. Les champs longs et les blocs du moteur prennent
   toute la largeur : un tableau de ventes dans une demi-colonne est illisible. */
.bdvr-grille{display:grid;grid-template-columns:1fr 1fr;gap:var(--bdv-e-4) var(--bdv-e-6)}
.bdvr-champ{min-width:0;display:flex;flex-direction:column}
.bdvr-champ--plein{grid-column:1/-1}
.bdvr-l{display:block;font-family:inherit;font-size:var(--bdv-f-3);
  color:var(--bdv-encre-2);margin:0 0 var(--bdv-e-1)}
.bdvr-i{width:100%;background:var(--bdv-surface);border:1px solid var(--bdv-trait-fort);
  border-radius:var(--bdv-r);padding:var(--bdv-e-3) var(--bdv-e-3);font-family:inherit;
  font-size:var(--bdv-f-saisie);color:var(--bdv-encre-1)}
/* UN SEUL ANNEAU DE FOCUS DANS TOUT LE PRODUIT, et il a la couleur de la SURFACE.
   L'anneau bordeaux du site donne 1,37:1 sur une carte sombre, c'est-a-dire aucun
   focus clavier ; « --bdv-anneau » tient 7,44:1 en clair et 9,15:1 en sombre. */
.bdvr-i:focus{outline:2px solid var(--bdv-anneau);outline-offset:2px}
.bdvr-i:disabled{background:var(--bdv-surface-2);color:var(--bdv-encre-4)}
.bdvr-aide{font-family:inherit;font-size:var(--bdv-f-2);color:var(--bdv-encre-4);
  line-height:1.5;margin:var(--bdv-e-1) 0 0}
.bdvr-aide--alerte{color:var(--bdv-retard);font-weight:600}
.bdvr-chk{display:flex;align-items:flex-start;gap:var(--bdv-e-2);font-family:inherit;
  font-size:var(--bdv-f-3);color:var(--bdv-encre-2);line-height:1.5}
.bdvr-chk input{accent-color:var(--bdv-accent)}

/* LE BANDEAU DE SAUVEGARDE. Il ne repete pas le compteur de lignes, qui est deja dans les
   cartes juste en dessous : il porte le VERDICT, appareil contre compte. C'est le seul
   endroit de l'outil qui pouvait dire, le 07/09/2026, que 4 442 lignes n'existaient que
   sur un ordinateur. Il merite d'etre lu avant le reste, donc il est en haut. */
.bdvr-etat{border:1px solid var(--bdv-trait);border-left:3px solid var(--bdv-accent);
  border-radius:var(--bdv-r);background:var(--bdv-surface);padding:var(--bdv-e-3) var(--bdv-e-4);margin:0 0 var(--bdv-e-4)}
.bdvr-etat--alerte{border-left-color:var(--bdv-retard)}
.bdvr-etat__verdict{font-family:inherit;font-size:var(--bdv-f-3);
  color:var(--bdv-encre-1);margin:0}
.bdvr-etat--alerte .bdvr-etat__verdict{color:var(--bdv-retard)}
.bdvr-etat__detail{font-family:inherit;font-size:var(--bdv-f-2);color:var(--bdv-encre-4);
  margin:var(--bdv-e-1) 0 0;line-height:1.5}
.bdvr-duo{display:flex;flex-wrap:wrap;gap:var(--bdv-e-2);margin-top:var(--bdv-e-4)}
.bdvr-hote{min-width:0}

.bdvr-pied{flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:var(--bdv-e-3) var(--bdv-e-4);
  border-top:1px solid var(--bdv-trait);background:var(--bdv-surface-2);
  padding:var(--bdv-e-4) var(--bdv-e-6)}
.bdvr-avis{flex:1 1 100%;order:-1;font-family:inherit;font-size:var(--bdv-f-2);
  margin:0;padding:var(--bdv-e-2) var(--bdv-e-3);border-radius:var(--bdv-r)}
/* LE VERDICT SE DIT PAR UN MOT, UN GLYPHE ET UNE COULEUR, jamais par la couleur
   seule : « avis() » ecrit la phrase, le signe la double, la teinte la confirme.
   Meme regle que les cinq etapes du voile d'amorcage. */
.bdvr-avis::before{margin-right:var(--bdv-e-2);font-weight:600}
.bdvr-avis[data-ok="oui"]{background:var(--bdv-bon-lavis);color:var(--bdv-bon)}
.bdvr-avis[data-ok="oui"]::before{content:'\\2713'}
.bdvr-avis[data-ok="non"]{background:var(--bdv-retard-lavis);color:var(--bdv-retard)}
.bdvr-avis[data-ok="non"]::before{content:'\\0021'}
.bdvr-btn{background:var(--bdv-accent);color:var(--bdv-encre-sur-accent);border:1px solid var(--bdv-accent);
  border-radius:var(--bdv-r);padding:var(--bdv-e-3) var(--bdv-e-4);font-family:inherit;
  font-size:var(--bdv-f-2);text-transform:uppercase;letter-spacing:var(--bdv-ls-etiq);
  cursor:pointer;transition:background var(--bdv-d-court) var(--bdv-courbe),border-color var(--bdv-d-court) var(--bdv-courbe)}
.bdvr-btn:hover{background:var(--bdv-accent-fort);border-color:var(--bdv-accent-fort)}
.bdvr-btn:disabled{opacity:.55;cursor:default}
.bdvr-btn--creux{background:transparent;color:var(--bdv-accent)}
.bdvr-btn--creux:hover{background:var(--bdv-accent);color:var(--bdv-encre-sur-accent)}
.bdvr-lien{margin-left:auto;font-family:inherit;font-size:var(--bdv-f-2);
  color:var(--bdv-encre-4);text-decoration:underline}
.bdvr-lien:hover{color:var(--bdv-accent)}

@media (max-width:820px){
  .bdvr-voile{padding:0}
  .bdvr-panneau{max-width:none;max-height:100%;height:100%;border:none}
  .bdvr-grille{grid-template-columns:1fr}
  .bdvr-tete{padding:var(--bdv-e-4) var(--bdv-e-4) 0}
  .bdvr-corps{padding:var(--bdv-e-4) var(--bdv-e-4)}
  .bdvr-pied{padding:var(--bdv-e-3) var(--bdv-e-4)}
  .bdvr-lien{margin-left:0;flex:1 1 100%}
}`;

  function poserStyle(){
    if(el(PREFIXE + '-style')) return;
    const s = document.createElement('style');
    s.id = PREFIXE + '-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
    // La feuille des blocs du moteur (.card, .kpi-grid, .dropzone, .data...), portee sous
    // .bdvr-panneau. Injectee d'ici et pas declaree dans les pages : le panneau emmene son
    // style avec lui, donc les deux pages l'ont forcement, donc il a la meme tete des deux
    // cotes. C'est litteralement ce que « ca doit etre les memes » demande.
    const l = document.createElement('link');
    l.id = PREFIXE + '-feuille';
    l.rel = 'stylesheet';
    l.href = '/css/bdv-panneau.css';
    document.head.appendChild(l);
  }

  /* ============ LES DEUX BLOCS DU MOTEUR ============
     Fin du chantier du 07/09/2026. Tant que chaque page contribuait ses propres blocs, le
     panneau montrait autre chose selon l'endroit : le tableau de bord « Ma base » et le
     classement, le bureau des renvois polis. Depuis que bdv-base.js est charge des deux
     cotes, le panneau les monte LUI-MEME. Ils sont identiques par construction, plus par
     recopie : il n'y a plus deux versions a tenir d'accord. */
  function moteurPresent(){
    return typeof window.renderBase === 'function' && typeof window.renderReglages === 'function';
  }

  // Le tableau de bord a deja ces deux <div> dans sa page : on les DEPLACE, ce qui laisse
  // renderBase() et bindZoneDepot() ecrire au meme endroit qu'avant. Le bureau ne les a pas :
  // on les cree. Meme code de rendu, deux hebergements.
  function loger(idHote, idBloc){
    const hote = el(idHote);
    if(!hote) return;
    const deja = el(idBloc);
    if(deja){ deja.hidden = false; hote.appendChild(deja); return; }
    const d = document.createElement('div');
    d.id = idBloc;
    hote.appendChild(d);
  }

  function monterMoteur(){
    loger('bdvrHoteBase', 'p-base');
    loger('bdvrHoteClassement', 'p-reglages');
  }

  async function rafraichirMoteur(){
    if(!moteurPresent()) return;
    /* LE RANGEMENT D'ABORD, ET C'EST LA REPARATION DU 08/09/2026.

       monterMoteur() n'etait appele QUE depuis construire(). Au tableau de bord ca suffit :
       le moteur part avec la page, donc il est la quand le panneau se construit. AU BUREAU
       C'EST L'INVERSE, depuis que le moteur est charge a la demande : le panneau se
       construit d'abord, sans moteur, puis le moteur arrive et personne ne range plus rien.

       Le defaut n'a rien de visible pour qui lit le code : renderBase() trouve bien son
       `p-base`, qui existe dans la coque des ecrans de vente, et il ecrit dedans. Sauf que
       ce div est reste `hidden`, dans `#bureauVentes` qui est lui-meme masque. Le vigneron
       voyait donc un onglet « Ma base » avec son bandeau d'etat et RIEN dessous : pas de
       zone de depot, pas de bouton « Vider la base », aucune erreur. C'est le « impossible
       de remettre ma base » signale par Ted.

       Appele ici, loger() est sans effet la deuxieme fois : il retrouve le div et le repose
       au meme endroit. Le rangement suit donc le moteur, quel que soit l'ordre d'arrivee.
       Le banc ne le voyait pas parce qu'il chargeait le moteur AVANT le panneau, l'ordre du
       tableau de bord et pas celui du bureau. Section 3 de banc-reglages.mjs. */
    monterMoteur();
    try{
      // Le bureau, contrairement au tableau de bord, n'a rien lu au demarrage. DEUX lectures
      // sont donc necessaires ici, et dans cet ordre :
      //   1. le serveur, parce que sur un appareil neuf IndexedDB est vide et que relire une
      //      base vide ne rend rien : « Ma base » annoncait 0 ligne sur un compte plein.
      //      L'appel est un tirage UNIQUE par visite (cf. bdv-base.js), il ne double donc pas
      //      celui des ecrans de vente quand les deux sont ouverts.
      //   2. IndexedDB, si elle n'a pas encore ete lue OU si le tirage vient d'y ajouter des
      //      lignes venues d'un autre poste.
      if(typeof tirerDuServeur === 'function') await tirerDuServeur();
      const ajouts = (typeof TIRAGE_AJOUTS !== 'undefined') ? TIRAGE_AJOUTS : 0;
      if(typeof ROWS !== 'undefined' && (!ROWS.length || ajouts) && typeof reloadFromDB === 'function'){
        if(typeof TIRAGE_AJOUTS !== 'undefined') TIRAGE_AJOUTS = 0;
        await reloadFromDB();
      }
      renderBase();
      renderReglages();
      /* ET LE BANDEAU D'ETAT UNE SECONDE FOIS. rafraichirTout() l'a peint AVANT ce
         rapatriement, donc avec ce que l'appareil avait alors, c'est-a-dire rien sur un
         poste neuf : il annoncait « Aucune ligne pour le moment, depose ton export » a
         dix pixels au-dessus des cartes qui affichaient les 4 939 lignes qui venaient
         d'arriver. Un ecran qui se contredit lui-meme sur la meme hauteur d'ecran, c'est
         « tout est pete » pour celui qui le lit, et il a raison de le penser. */
      peindreBase();
    }catch(e){}
  }

  // Un seul point d'entree de rafraichissement, appele a l'ouverture ET par le moteur apres
  // un import (cf. ecranRafraichir() dans bdv-base.js).
  /* ===================== L'ABONNEMENT AGENDA (lot E) =====================
     Une seule ligne par compte dans `agenda_abonnement`, et la revocation est
     une SUPPRESSION de ligne : l'ancienne adresse rend 404 tout de suite.

     L'ADRESSE EST EN DUR ET PAS `location.origin`, et c'est une lecon deja
     payee par le courrier du matin le 09/09/2026 : sur une adresse de
     preversion Vercel, la reecriture `/agenda/:jeton` n'existe pas. Le lien
     copie serait mort, l'ecran n'afficherait aucune erreur, et c'est le
     vigneron qui tomberait dessus, trois jours plus tard, dans Google Agenda. */
  const AGENDA_BASE = 'https://lebureauduvigneron.fr/agenda/';
  let AGENDA_JETON = null;
  let AGENDA_LIGNE = null;   // la derniere ligne lue, pour repeindre sans perdre `vu_le`
  let AGENDA_ARME = false;   // la revocation demande deux clics

  /* 32 octets de hasard cryptographique, en base64url : 43 signes, dans les
     bornes du `check` de la table. TIRE PAR LE NAVIGATEUR, et surtout PAS
     derive de l'identifiant du compte : un jeton qui serait un hachage de `id`
     laisserait fabriquer l'adresse de n'importe qui a partir d'un identifiant. */
  function nouveauJeton(){
    const b = new Uint8Array(32);
    (window.crypto || window.msCrypto).getRandomValues(b);
    let bin = '';
    for(let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function motAgenda(t){ const e = el('bdvrAgendaMot'); if(e) e.textContent = t || ''; }

  function peindreAgenda(ligne){
    AGENDA_LIGNE = ligne || null;
    AGENDA_JETON = ligne && ligne.jeton ? ligne.jeton : null;
    AGENDA_ARME = false;
    const zone = el('bdvrAgendaZone'), creer = el('bdvrAgendaCreer');
    const copier = el('bdvrAgendaCopier'), abonner = el('bdvrAgendaAbonner');
    const revoquer = el('bdvrAgendaRevoquer'), vu = el('bdvrAgendaVu');
    if(!zone || !creer) return;
    const a = AGENDA_JETON ? AGENDA_BASE + AGENDA_JETON + '.ics' : '';
    zone.hidden = !AGENDA_JETON;
    creer.hidden = !!AGENDA_JETON;
    copier.hidden = !AGENDA_JETON;
    abonner.hidden = !AGENDA_JETON;
    revoquer.hidden = !AGENDA_JETON;
    revoquer.textContent = 'Révoquer ce lien';
    const avertir = el('bdvrAgendaAvertir');
    if(avertir) avertir.hidden = !AGENDA_JETON;
    if(AGENDA_JETON){
      el('bdvrAgendaLien').value = a;
      /* `webcal://` ouvre directement la fenetre d'abonnement du client de
         calendrier. L'adresse `https` reste affichee a cote : c'est elle qu'on
         colle dans « Ajouter par URL » quand le clic ne fait rien. */
      abonner.href = a.replace(/^https:/, 'webcal:');
      vu.textContent = ligne && ligne.vu_le
        ? 'Dernière lecture par ton agenda : ' + new Date(ligne.vu_le).toLocaleString('fr-FR')
        : 'Aucune lecture pour l\'instant. Les agendas relisent toutes les quelques heures.';
    }
  }

  async function rafraichirAgenda(){
    if(!el('bdvrBlocAgenda')) return;
    const moi = window.BdvCompte && BdvCompte.monId && BdvCompte.monId();
    if(!moi){ peindreAgenda(null); return; }
    try{
      const l = await BdvCompte.api('/agenda_abonnement?id=eq.' + encodeURIComponent(moi)
                                    + '&select=jeton,cree_le,vu_le');
      peindreAgenda(Array.isArray(l) && l.length ? l[0] : null);
    }catch(e){ /* Hors ligne : on laisse l'ecran tel qu'il est, on n'efface rien. */ }
  }

  async function creerAgenda(){
    const moi = window.BdvCompte && BdvCompte.monId && BdvCompte.monId();
    if(!moi){ motAgenda('Il faut être connecté.'); return; }
    motAgenda('Création…');
    try{
      /* `id` est pose ICI et jamais laisse au defaut : regle 6 de CLAUDE.md,
         la meme qui avait laisse la table des signets vide pendant deux jours. */
      await BdvCompte.api('/agenda_abonnement', {
        methode: 'POST', corps: { id: moi, jeton: nouveauJeton() }
      });
      await rafraichirAgenda();
      motAgenda('Lien créé. Colle-le dans ton agenda.');
    }catch(e){ motAgenda('La création a échoué. Réessaie dans un moment.'); }
  }

  async function revoquerAgenda(){
    const b = el('bdvrAgendaRevoquer');
    /* DEUX CLICS, ET PAS UNE FENETRE DE CONFIRMATION. Le panneau est deja une
       fenetre : en empiler une deuxieme, c'est le geste qu'on valide sans lire.
       Le bouton dit lui-meme ce qui va se passer, et un deuxieme clic le fait. */
    if(!AGENDA_ARME){
      AGENDA_ARME = true;
      b.textContent = 'Confirmer : couper l\'abonnement partout';
      motAgenda('Un deuxième clic révoque le lien. Un clic ailleurs annule.');
      return;
    }
    const moi = window.BdvCompte && BdvCompte.monId && BdvCompte.monId();
    if(!moi) return;
    motAgenda('Révocation…');
    try{
      await BdvCompte.api('/agenda_abonnement?id=eq.' + encodeURIComponent(moi), { methode: 'DELETE' });
      await rafraichirAgenda();
      motAgenda('Lien révoqué. L\'ancienne adresse ne rend plus rien.');
    }catch(e){ motAgenda('La révocation a échoué. Réessaie dans un moment.'); }
  }

  async function copierAgenda(){
    const i = el('bdvrAgendaLien');
    if(!i || !i.value) return;
    try{
      await navigator.clipboard.writeText(i.value);
      motAgenda('Adresse copiée.');
    }catch(e){
      /* Presse-papiers refuse (page non securisee, permission) : on selectionne
         le texte pour que le Ctrl+C manuel marche quand meme. */
      i.focus(); i.select();
      motAgenda('Copie automatique refusée : le texte est sélectionné, fais Ctrl+C.');
    }
  }

  function rafraichirTout(){
    peindreBase();
    rafraichirMoteur();
    rafraichirAgenda();
    gateBaseVide();
    BLOCS.forEach(function(b){ if(b.rafraichir){ try{ b.rafraichir(); }catch(e){} } });
  }

  // Le moteur annonce ses reussites et ses echecs par status(), qui ecrit dans une barre que
  // seul le tableau de bord possede. Au bureau, il parle ici.
  function dire(message, ok){
    if(!el('bdvrVoile')) return;
    avis(message, ok !== false);
  }

  /* ============================== LE MARKUP ==============================
     Ecrit ici et pas dans les deux pages : c'est tout l'objet de la fusion. Les libelles
     sont ceux du bureau, mot pour mot, parce qu'ils ont ete rediges et relus. */

  const MARKUP = `
<div class="bdvr-panneau" role="dialog" aria-modal="true" aria-labelledby="bdvrTitre">
  <div class="bdvr-tete">
    <button class="bdvr-x" id="bdvrFermer" type="button" aria-label="Fermer">&#215;</button>
    <h2 class="bdvr-titre" id="bdvrTitre">Mes réglages</h2>
    <p class="bdvr-sous">Tout est modifiable, tout le temps. Rien n'est obligatoire.</p>
    <div class="bdvr-onglets" id="bdvrOnglets" role="tablist"></div>
  </div>

  <form id="bdvrForm" class="bdvr-form" novalidate>
    <div class="bdvr-corps" id="bdvrCorps">

      <fieldset class="bdvr-bloc" id="bdvrBlocToi" data-onglet="Toi">
        <legend class="bdvr-legende">Toi</legend>
        <div class="bdvr-grille">
          <div class="bdvr-champ">
            <label class="bdvr-l" for="bdvrPrenom">Ton prénom</label>
            <input class="bdvr-i" type="text" id="bdvrPrenom" autocomplete="given-name">
            <p class="bdvr-aide">C'est ce nom-là qui te dit bonjour en haut de ton bureau.</p>
          </div>
          <div class="bdvr-champ">
            <label class="bdvr-l" for="bdvrDomaine">Ton domaine ou ta structure</label>
            <input class="bdvr-i" type="text" id="bdvrDomaine" autocomplete="organization">
            <p class="bdvr-aide">Gravé sous le bonjour, comme une plaque de porte.</p>
          </div>
          <div class="bdvr-champ">
            <label class="bdvr-l" for="bdvrCp">Ton code postal</label>
            <input class="bdvr-i" type="text" id="bdvrCp" inputmode="numeric" maxlength="5" autocomplete="postal-code">
          </div>
          <div class="bdvr-champ">
            <label class="bdvr-l" for="bdvrQui">Tu es</label>
            <select class="bdvr-i" id="bdvrQui">
              <option value="">Sans réponse</option>
              <option value="vigneron">Vigneron</option>
              <option value="caviste-negoce">Caviste ou négociant</option>
              <option value="etudiant">Étudiant ou école</option>
              <option value="pro-filiere">Pro de la filière</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div class="bdvr-champ bdvr-champ--plein">
            <label class="bdvr-l" for="bdvrViti">Tu utilises Vitisoft</label>
            <select class="bdvr-i" id="bdvrViti">
              <option value="">Sans réponse</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
              <option value="inconnu">Je ne sais pas</option>
            </select>
            <p class="bdvr-aide">« Non » retire de ton bureau les pièces qui lisent tes ventes, et avec elles les onglets Tes ventes, Ma base et Le classement : elles ne sauraient rien lire.</p>
          </div>
        </div>
      </fieldset>

      <fieldset class="bdvr-bloc" id="bdvrBlocVentes" data-onglet="Tes ventes">
        <legend class="bdvr-legende">Tes ventes</legend>
        <div class="bdvr-grille">
          <div class="bdvr-champ">
            <label class="bdvr-l" for="bdvrObjectif">Objectif de chiffre d'affaires annuel (HT)</label>
            <input class="bdvr-i" type="text" id="bdvrObjectif" inputmode="numeric" placeholder="ex. 500000">
            <p class="bdvr-aide">Il commande l'ardoise et l'alerte d'atterrissage. Vide : aucun objectif.</p>
          </div>
          <div class="bdvr-champ">
            <label class="bdvr-l" for="bdvrExercice">Mois d'ouverture de ton exercice</label>
            <select class="bdvr-i" id="bdvrExercice"></select>
            <p class="bdvr-aide">Le tableau de bord le reprendra à sa prochaine ouverture.</p>
          </div>
          <p class="bdvr-aide bdvr-champ--plein" id="bdvrVentesAttente" hidden>Ces deux réglages ne sont pas encore
            chargés depuis ton compte. Tant qu'ils ne le sont pas, on ne les touche pas : écrire
            par-dessus une valeur qu'on n'a pas lue, c'est l'effacer.</p>
        </div>
      </fieldset>

      <fieldset class="bdvr-bloc" id="bdvrBlocBase" data-onglet="Ma base">
        <legend class="bdvr-legende">Ma base</legend>
        <div class="bdvr-etat" id="bdvrEtat">
          <p class="bdvr-etat__verdict" id="bdvrBaseIci">Lecture de ta base…</p>
          <p class="bdvr-etat__detail" id="bdvrBaseEcart"></p>
        </div>
        <div class="bdvr-hote" id="bdvrHoteBase"></div>
        <div class="bdvr-duo" id="bdvrBaseActions"></div>
      </fieldset>

      <fieldset class="bdvr-bloc" id="bdvrBlocClassement" data-onglet="Le classement">
        <legend class="bdvr-legende">Le classement</legend>
        <div class="bdvr-hote" id="bdvrHoteClassement"></div>
      </fieldset>

      <fieldset class="bdvr-bloc" id="bdvrBlocCourrier" data-onglet="Le courrier">
        <legend class="bdvr-legende">Le courrier</legend>
        <!-- LA CASE DU COURRIER DU MATIN EST LA PREMIERE, et pas par ordre d'arrivee : c'est
             celle qui envoie un mail PAR JOUR, et celle qui porte des noms de clients et des
             montants. Elle passe donc devant celle qui envoie deux fois par mois des nouvelles
             de la filiere. Rangee dans l'ordre inverse, la plus engageante des deux se serait
             lue en second, apres qu'on a decide que ce bloc etait sans enjeu.
             Posee le 11/09/2026 : jusque-la ce bloc n'avait que la case de l'edition, et le
             courrier du matin partait SANS interrupteur -- alors que son pied affirmait qu'on
             l'avait demande ici meme. -->
        <label class="bdvr-chk"><input type="checkbox" id="bdvrCourrier"> Recevoir le courrier du matin</label>
        <p class="bdvr-aide">Chaque matin à 8 h, s'il y a quelque chose à dire : tes rappels du
          jour, tes tâches en retard et ta file de travail. Rien de nouveau, rien dans ta boîte.
          Il porte les noms de tes clients et tes montants, donc il ne part que si tu coches.</p>
        <label class="bdvr-chk"><input type="checkbox" id="bdvrNews"> Recevoir l'édition bimensuelle du Bureau du Vigneron</label>
        <p class="bdvr-aide">Deux fois par mois, ce qui bouge dans la filière et dans l'outil. Se désinscrit d'ici, en un clic.</p>
        <p class="bdvr-aide">Chaque envoi porte aussi un lien qui ramène à ces deux cases, sans
          mot de passe : s'arrêter doit être aussi simple que commencer, et depuis n'importe
          quel appareil.</p>
      </fieldset>

      <!-- L'AGENDA, POSE LE 15/09/2026 avec le lot E.
           L'AVERTISSEMENT EST AU-DESSUS DU BOUTON, ET PAS EN DESSOUS. Ce lien vaut mot de
           passe : qui l'a voit le calendrier, pour toujours, sans se connecter. Un
           avertissement place apres le bouton se lit apres qu'on a clique, c'est-a-dire
           trop tard. Et il dit aussi ce que le lien NE porte PAS, parce que c'est la
           question que se pose quelqu'un a qui on demande de coller une adresse chez
           Google : « qu'est-ce que je donne, exactement ». -->
      <fieldset class="bdvr-bloc" id="bdvrBlocAgenda" data-onglet="L'agenda">
        <legend class="bdvr-legende">L'agenda</legend>
        <p class="bdvr-aide">Tes échéances dans Google Agenda, Apple Calendrier ou Outlook, tenues
          à jour toutes seules. Une date que nous corrigeons arrive chez toi sans rien faire.</p>
        <p class="bdvr-aide"><b>Ce lien vaut mot de passe</b> : qui l'a voit ton calendrier, sans
          se connecter et pour toujours. Ne le publie pas. Il porte tes obligations, les travaux
          de la vigne, les salons et les temps forts, avec tes repères éteints et tes décalages.
          <b>Il ne porte ni tes tâches, ni tes clients à rappeler.</b></p>
        <div class="bdvr-champ bdvr-champ--plein" id="bdvrAgendaZone" hidden>
          <label class="bdvr-lab" for="bdvrAgendaLien">L'adresse de ton calendrier</label>
          <input class="bdvr-i" type="text" id="bdvrAgendaLien" readonly>
          <p class="bdvr-aide" id="bdvrAgendaVu"></p>
        </div>
        <p>
          <button type="button" class="bdvr-btn" id="bdvrAgendaCreer">Créer mon lien d'abonnement</button>
          <button type="button" class="bdvr-btn" id="bdvrAgendaCopier" hidden>Copier l'adresse</button>
          <a class="bdvr-lien" id="bdvrAgendaAbonner" hidden href="#">S'abonner maintenant</a>
        </p>
        <p class="bdvr-aide" id="bdvrAgendaMot" role="status"></p>
        <p>
          <button type="button" class="bdvr-lien" id="bdvrAgendaRevoquer" hidden>Révoquer ce lien</button>
        </p>
        <!-- CACHE TANT QU'IL N'Y A RIEN A REVOQUER, et c'est la capture qui l'a dit : dans
             l'etat vide, l'ecran avertissait des consequences de revoquer un lien qui
             n'existait pas encore. Un avertissement sans objet apprend a ne pas lire les
             avertissements. -->
        <p class="bdvr-aide" id="bdvrAgendaAvertir" hidden>Révoquer coupe l'abonnement chez
          <b>tous</b> ceux qui l'ont posé, y compris sur ton téléphone. Un nouveau lien se
          recrée aussitôt, mais il faudra le recoller partout.</p>
      </fieldset>

    </div>

    <div class="bdvr-pied">
      <p class="bdvr-avis" id="bdvrAvis" role="status" hidden></p>
      <button class="bdvr-btn" id="bdvrEnregistrer" type="submit">Enregistrer</button>
      <span class="bdvr-aide" id="bdvrAttente" hidden>Chargement de tes réglages…</span>
      <a class="bdvr-lien" href="/compte/">Mot de passe, export, suppression du compte</a>
    </div>
  </form>
</div>`;

  const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août',
                'septembre','octobre','novembre','décembre'];

  function construire(){
    if(monte) return;
    poserStyle();
    const voile = document.createElement('div');
    voile.className = 'bdvr-voile';
    voile.id = 'bdvrVoile';
    voile.hidden = true;
    voile.innerHTML = MARKUP;
    document.body.appendChild(voile);

    const sel = el('bdvrExercice');
    const o0 = document.createElement('option');
    o0.value = ''; o0.textContent = 'Année civile (janvier)';
    sel.appendChild(o0);
    MOIS.forEach(function(m, i){
      const o = document.createElement('option');
      o.value = String(i + 1); o.textContent = m;
      sel.appendChild(o);
    });

    el('bdvrFermer').addEventListener('click', fermer);
    voile.addEventListener('click', function(e){ if(e.target === voile) fermer(); });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && !voile.hidden) fermer();
    });
    // Regle 2 : un champ touche est marque des la premiere frappe, avant toute reponse reseau.
    el('bdvrForm').addEventListener('input', marquer);
    el('bdvrForm').addEventListener('change', marquer);
    el('bdvrForm').addEventListener('submit', enregistrer);

    /* L'agenda ne passe PAS par « Enregistrer » : creer et revoquer sont des
       gestes immediats, pas des champs a valider. Les poser dans le formulaire
       aurait fait d'un bouton de revocation un effet de bord d'un enregistrement
       qu'on croyait faire pour changer son prenom. */
    el('bdvrAgendaCreer').addEventListener('click', creerAgenda);
    el('bdvrAgendaCopier').addEventListener('click', copierAgenda);
    el('bdvrAgendaRevoquer').addEventListener('click', revoquerAgenda);
    el('bdvrBlocAgenda').addEventListener('click', function(e){
      // Un clic ailleurs dans le bloc desarme la revocation.
      // On repeint depuis la DERNIERE LIGNE LUE et pas depuis le seul jeton :
      // reconstruire un objet a la main effacait la date de derniere lecture.
      if(AGENDA_ARME && e.target !== el('bdvrAgendaRevoquer')) peindreAgenda(AGENDA_LIGNE);
    });

    // Les emplacements sont remplis une seule fois, a la construction : un bloc qui se
    // reconstruirait a chaque ouverture perdrait l'etat de ses propres champs.
    if(moteurPresent()) monterMoteur();
    BLOCS.forEach(monterBloc);
    // Apres le montage, jamais avant : un bloc arrive apres coup n'aurait pas eu son onglet.
    construireOnglets();
    monte = true;
  }

  // Trois emplacements, nommes : l'hote depose ou il veut sans connaitre nos identifiants.
  const HOTES = {
    'classement':   'bdvrHoteClassement',
    'base':         'bdvrHoteBase',
    'base-actions': 'bdvrBaseActions'
  };
  function monterBloc(b){
    const cible = el(HOTES[b.hote] || 'bdvrHoteBase');
    if(!cible || !b.monter) return;
    try{ b.monter(cible); }catch(e){}
  }

  function marquer(e){ if(e.target && e.target.id) TOUCHES[e.target.id] = true; }

  /* ============================== LES ONGLETS ==============================
     Refonte du 07/09/2026. Cinq sections empilees faisaient un rouleau de deux mille pixels,
     et Ted l'a dit en un mot : « en version verticale ». Une section a l'ecran, le pied colle
     en bas, et « Enregistrer » toujours a portee de clic.

     Les onglets sont FABRIQUES a partir des blocs, jamais listes a la main : ajouter un bloc
     au markup lui donne son onglet, et un bloc ecarte perd le sien. Deux listes a tenir
     d'accord, c'est une de trop. */
  function blocs(){
    return Array.prototype.slice.call(document.querySelectorAll('#bdvrForm .bdvr-bloc'));
  }

  function construireOnglets(){
    const barre = el('bdvrOnglets');
    if(!barre) return;
    barre.innerHTML = '';
    blocs().forEach(function(b){
      const o = document.createElement('button');
      o.type = 'button';                       // sinon il soumet le formulaire au clic
      o.className = 'bdvr-onglet';
      o.setAttribute('role', 'tab');
      o.dataset.cible = b.id;
      o.textContent = b.getAttribute('data-onglet') || b.id;
      o.addEventListener('click', function(){ montrerOnglet(b.id); });
      barre.appendChild(o);
    });
    majOnglets();
  }

  // Rend visible un onglet, et lui seul. Un bloc ecarte par gateVitisoft ne peut pas etre
  // choisi : on retombe sur le premier onglet encore ouvert.
  function montrerOnglet(id){
    const dispo = blocs().filter(function(b){ return b.getAttribute('data-off') !== 'oui'; });
    if(!dispo.length) return;
    if(!dispo.some(function(b){ return b.id === id; })) id = dispo[0].id;
    const change = (ONGLET !== id);
    ONGLET = id;
    blocs().forEach(function(b){ b.classList.toggle('bdvr-bloc--on', b.id === id); });
    /* ET L'ONGLET CHOISI SE RAMENE DANS LE CHAMP, 19/09/2026. Les six onglets
       tiennent desormais sur UNE rangee qui defile, au lieu de se replier sur
       trois et de manger 224 px des 844 de l'ecran. Mais un ruban qui defile sans
       que la selection le suive cache la moitie du panneau derriere un geste que
       rien n'annonce : mesure du jour, apres selection, « Le classement » n'etait
       visible qu'a 107 px sur 144, « Le courrier » et « L'agenda » a ZERO. On
       choisissait un onglet et l'onglet choisi n'etait pas a l'ecran.
       C'est exactement la faute deja faite sur la barre des pieces, au meme
       endroit du raisonnement. */
    let choisi = null;
    Array.prototype.forEach.call(document.querySelectorAll('.bdvr-onglet'), function(o){
      const on = (o.dataset.cible === id);
      o.classList.toggle('on', on);
      o.setAttribute('aria-selected', on ? 'true' : 'false');
      if(on) choisi = o;
    });
    if(choisi && choisi.scrollIntoView){
      try{ choisi.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'auto' }); }catch(e){}
    }
    // On ne remonte le corps QUE sur un vrai changement d'onglet : gateVitisoft appelle ce
    // chemin apres chaque enregistrement, et le defilement sauterait pour rien.
    if(change){ const c = el('bdvrCorps'); if(c) c.scrollTop = 0; }
  }

  function majOnglets(){
    blocs().forEach(function(b){
      const o = document.querySelector('.bdvr-onglet[data-cible="' + b.id + '"]');
      if(o) o.hidden = (b.getAttribute('data-off') === 'oui');
    });
    const premier = blocs()[0];
    montrerOnglet(ONGLET || (premier && premier.id));
  }

  function avis(texte, ok){
    const a = el('bdvrAvis');
    if(!a) return;
    a.textContent = texte || '';
    a.setAttribute('data-ok', ok ? 'oui' : 'non');
    a.hidden = !texte;
  }

  /* ====================== LECTURE DES DEUX TABLES ======================
     `profils` pour qui il est, `reglages` pour son objectif et son exercice. Deux appels
     independants, deux verrous independants : l'un peut avoir echoue sans l'autre, et un
     formulaire qui ne sait pas ce qu'il remplace n'a pas le droit d'ecrire. */

  function chargerProfil(){
    if(!pret() || !BdvCompte.api) return Promise.resolve(null);
    return BdvCompte.api('/profils?id=eq.' + encodeURIComponent(BdvCompte.monId()) + '&select=*')
      .then(function(lignes){
        // api() leve sur un refus et rend un tableau sur une lecture reussie, meme vide :
        // c'est ce qui separe « fiche absente » (fiche LUE, a remplir) de « lecture refusee ».
        if(!Array.isArray(lignes)) return null;
        PROFIL = lignes[0] || {};
        PROFIL_LU = true;
        if(SUR_PROFIL){ try{ SUR_PROFIL(PROFIL); }catch(e){} }
        return PROFIL;
      }).catch(function(){ return null; });
  }

  function chargerReglages(){
    if(!pret() || !BdvCompte.api) return Promise.resolve(null);
    // `limit=1` ne suffit plus : le jour ou quelqu'un est membre de deux bureaux, il
    // rendrait l'objectif de l'un ou de l'autre au hasard du plan d'execution.
    return BdvCompte.api('/reglages?select=objectif,exercice_debut'
      + '&bureau=eq.' + encodeURIComponent(BdvCompte.monBureau()) + '&limit=1')
      .then(function(lignes){
        if(!Array.isArray(lignes)) return null;
        REGL = lignes[0] || {};
        REGL_LU = true;
        return REGL;
      }).catch(function(){ return null; });
  }

  // Ecriture partielle assumee : `on_conflict=bureau` + merge-duplicates ne touche QUE les
  // colonnes envoyees. Ecrire l'objectif d'ici n'efface donc ni la file deposee par le
  // tableau de bord, ni les libelles perso, ni le classement.
  function ecrireReglages(champs){
    if(!pret()) return Promise.reject(new Error('pas de compte'));
    const corps = Object.assign({ bureau: BdvCompte.monBureau(), maj_le: new Date().toISOString() }, champs);
    return BdvCompte.api('/reglages?on_conflict=bureau', {
      methode: 'POST',
      corps: [corps],
      entetes: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
    });
  }

  /* ====================== REMPLISSAGE ET VERROUS ====================== */

  function poser(id, valeur){
    if(TOUCHES[id]) return;      // regle 2
    const n = el(id);
    if(!n) return;
    if(n.type === 'checkbox') n.checked = !!valeur;
    else n.value = (valeur == null) ? '' : String(valeur);
  }

  /* ============ « CHARGEMENT DE TES REGLAGES… » A MAINTENANT UNE FIN, 19/09/2026 ============
     Le message vit dans le pied du formulaire et son `hidden` n'etait rabaisse QUE par
     l'arrivee du profil. Quand le compte ne repondait pas, il restait a l'ecran pour
     toujours : le panneau annoncait un chargement qui ne se terminerait jamais, les six
     onglets restaient cliquables sur du vide, et rien ne disait ce qui manquait.

     LE MEME PLAFOND QUE LE VOILE D'AMORCAGE, et on va le CHERCHER chez lui plutot que de
     le recopier : `BdvAmorce.PLAFOND_MS`, quinze secondes, arbitrage de Ted du 17/09/2026.
     Deux attentes du meme bureau qui rendent la main a deux moments differents, ca
     s'apprend comme un defaut d'affichage. Le repli a quinze secondes ne sert que si
     bdv-amorce.js n'est pas charge dans la page.

     ET LE MEME MOTIF : une etape ratee se dit PAR SON NOM, et on propose le geste qui
     repare. « Erreur de chargement » ne se raconte pas au telephone. */
  function plafondMs(){
    try{
      const p = window.BdvAmorce && BdvAmorce.PLAFOND_MS;
      return (p > 0) ? p : 15000;
    }catch(e){ return 15000; }
  }
  const ATTENTE_REPOS = 'Chargement de tes réglages…';
  let ATTENTE_MINUTEUR = null;
  function desarmerAttente(){
    if(!ATTENTE_MINUTEUR) return;
    try{ clearTimeout(ATTENTE_MINUTEUR); }catch(e){}
    ATTENTE_MINUTEUR = null;
  }
  function armerAttente(){
    desarmerAttente();                 // jamais deux minuteries pour un seul message
    if(PROFIL_LU && REGL_LU) return;   // rien a attendre
    const a = el('bdvrAttente');
    if(a){ a.textContent = ATTENTE_REPOS; a.hidden = false; }
    ATTENTE_MINUTEUR = setTimeout(direAttenteRatee, plafondMs());
  }
  function direAttenteRatee(){
    ATTENTE_MINUTEUR = null;
    const a = el('bdvrAttente');
    if(!a || (PROFIL_LU && REGL_LU)) return;
    /* On NOMME ce qui n'est pas arrive. Le profil porte le prenom, le domaine et les deux
       consentements ; les reglages portent l'objectif et l'exercice. Les deux peuvent
       manquer separement, et le bouton « Enregistrer » ne se deverrouille qu'avec le
       profil : le dire evite de chercher pourquoi il reste gris. */
    const manque = [];
    if(!PROFIL_LU) manque.push('ta fiche');
    if(!REGL_LU)   manque.push('ton objectif et ton exercice');
    a.hidden = false;
    a.textContent = '';
    const p = document.createElement('span');
    p.textContent = 'Ton compte n’a pas répondu : ' + manque.join(' et ')
      + (manque.length > 1 ? ' n’ont pas pu être lus' : ' n’a pas pu être lu')
      + '. Rien ne peut être enregistré tant que c’est le cas. ';
    a.appendChild(p);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bdvr-btn';
    b.textContent = 'Réessayer';
    b.addEventListener('click', relancerLectures);
    a.appendChild(b);
  }
  function relancerLectures(){
    const encore = function(){ const v = el('bdvrVoile'); return v && !v.hidden; };
    armerAttente();
    if(!PROFIL_LU) chargerProfil().then(function(np){ if(np && encore()) remplir(); });
    if(!REGL_LU)   chargerReglages().then(function(nr){ if(nr && encore()) remplir(); });
  }

  function verrous(){
    const b = el('bdvrEnregistrer');
    if(b) b.disabled = !PROFIL_LU;
    const a = el('bdvrAttente');
    if(a){
      const toutLu = PROFIL_LU && REGL_LU;
      /* Tout est lu : le message redevient ce qu'il etait et disparait. Sans cette remise
         au repos, la phrase d'echec et son bouton resteraient dans le pied du formulaire
         apres un « Réessayer » qui a marche. */
      if(toutLu){ desarmerAttente(); a.textContent = ATTENTE_REPOS; a.hidden = true; }
      /* Encore dans le délai : on attend, et on le dit. Delai échu et lecture incomplète :
         c'est direAttenteRatee() qui tient l'affichage, verrous() n'y touche pas. */
      else if(ATTENTE_MINUTEUR) a.hidden = false;
    }
    ['bdvrObjectif','bdvrExercice'].forEach(function(id){
      const n = el(id); if(n) n.disabled = !REGL_LU;
    });
    const va = el('bdvrVentesAttente');
    if(va) va.hidden = !!REGL_LU;
  }

  // « Non » a Vitisoft = le tableau de bord ne lira rien. Les trois blocs qui n'existent
  // que pour lui disparaissent, plutot que d'annoncer par leur presence quelque chose qui
  // ne marchera pas. Le doute (vide, « inconnu ») les laisse visibles : on ne ferme pas une
  // porte sur une absence de reponse.
  /* ============ UNE BASE VIDE N'A PAS DE CLASSEMENT A REGLER ============
     Demande par Ted le 18/09/2026 : « quand je veux remettre une nouvelle base, qu'on ne
     me montre pas un reglage pas utilisable. »

     CE QU'IL VOYAIT. Apres un vidage, `openApp()` ouvre ce panneau parce que la base est
     vide. Il tombait sur « Le classement », qui propose de designer la colonne du canal
     de vente et celle de la typologie parmi celles de SES lignes. Sans lignes, ces
     selecteurs n'ont rien a proposer : deux listes vides et un bouton qui ne peut rien
     appliquer. On lui demandait de regler ce qu'il n'a pas encore.

     Ce qu'il lui faut a ce moment-la tient en un geste : deposer son export. Il vit dans
     « Ma base ». On ecarte donc « Le classement » tant qu'il n'y a pas une ligne a
     classer, exactement comme `gateVitisoft` ecarte ce qui ne le concerne pas, et par le
     meme attribut.

     `data-off` et pas `hidden`, pour la raison ecrite dans gateVitisoft : l'attribut
     l'emporte dans la feuille, et un bloc ecarte ne peut pas revenir d'un clic. */
  function baseEstVide(){
    /* On demande au moteur, et on ne conclut pas sans lui. `baseVide()` vit dans
       bdv-ecrans.js : si le moteur n'est pas la, on n'ecarte rien, parce qu'un panneau
       ampute par erreur est pire qu'un onglet inutile. */
    try{ return (typeof baseVide === 'function') ? baseVide() === true : false; }
    catch(e){ return false; }
  }

  function gateBaseVide(){
    const n = el('bdvrBlocClassement');
    if(!n) return;
    const vide = baseEstVide();
    /* On ne retire PAS `data-off` ici quand la base se remplit : c'est gateVitisoft qui
       en est proprietaire pour ce bloc, et deux fonctions qui ecrivent le meme attribut
       finissent par se defaire l'une l'autre. On pose la marque, et on la retire
       uniquement si c'est nous qui l'avions posee. */
    if(vide){ n.setAttribute('data-off','oui'); n.setAttribute('data-off-vide','oui'); }
    else if(n.getAttribute('data-off-vide') === 'oui'){
      n.removeAttribute('data-off-vide');
      if(!(PROFIL && PROFIL.utilise_vitisoft === 'non')) n.removeAttribute('data-off');
    }
    /* Et on arrive SUR « Ma base », la ou est la zone de depot. Sans cette ligne, le
       panneau s'ouvrirait sur le premier onglet encore debout, qui n'est pas forcement
       celui du geste attendu. */
    if(vide){ const b = el('bdvrBlocBase'); if(b) montrerOnglet(b.id); }
    majOnglets();
  }

  function gateVitisoft(){
    const sans = (PROFIL && PROFIL.utilise_vitisoft === 'non');
    // `data-off` et pas `hidden` : `hidden` se battrait avec la classe qui montre l'onglet
    // actif, et un bloc ecarte pourrait reapparaitre d'un clic. L'attribut, lui, l'emporte
    // dans la feuille, et il dit une autre chose que « pas l'onglet du moment ».
    ['bdvrBlocVentes','bdvrBlocBase','bdvrBlocClassement'].forEach(function(id){
      const n = el(id);
      if(!n) return;
      if(sans) n.setAttribute('data-off', 'oui');
      else n.removeAttribute('data-off');
    });
    /* ET LE MOTEUR SUIT, DANS LES DEUX SENS. Son drapeau PAS_VITISOFT montait a `true` et
       n'en redescendait jamais : recocher « oui » laissait « Ma base » afficher « cet outil
       ne lira pas tes fichiers » par-dessus la zone de depot, jusqu'au rechargement de la
       page. Meme motif qu'adopterObjectif : le panneau a la reponse, le moteur l'adopte. */
    if(typeof adopterVitisoft === 'function') adopterVitisoft(PROFIL && PROFIL.utilise_vitisoft);
    majOnglets();
  }

  function remplir(){
    const p = PROFIL || {};
    poser('bdvrPrenom',  p.prenom);
    poser('bdvrDomaine', p.domaine);
    poser('bdvrCp',      p.code_postal);
    poser('bdvrQui',     p.profil);
    poser('bdvrViti',    p.utilise_vitisoft);
    poser('bdvrCourrier', p.consent_courrier);
    poser('bdvrNews',    p.consent_news);
    const r = REGL || {};
    poser('bdvrObjectif', r.objectif);
    poser('bdvrExercice', r.exercice_debut);
    gateVitisoft();
    verrous();
  }

  /* ====================== MA BASE, PARTIE GENERIQUE ======================
     Le nombre de lignes ici, le nombre de lignes sur le compte, et l'ecart entre les deux.
     Calculable sans le moteur du tableau de bord, donc affiche dans les deux pages. C'est
     le compteur qui manquait le 07/09/2026, quand la base est restee a 500 lignes sur 4942
     toute une matinee sans qu'aucun ecran ne puisse le dire. */

  function compterLignesLocales(){
    return new Promise(function(res){
      if(!window.indexedDB) return res(0);
      let rq;
      try{ rq = indexedDB.open('bdv_ventes_v4'); }catch(e){ return res(0); }
      rq.onerror = function(){ res(0); };
      rq.onsuccess = function(e){
        const db = e.target.result;
        if(!db.objectStoreNames.contains('lignes')){ db.close(); return res(0); }
        try{
          const c = db.transaction('lignes', 'readonly').objectStore('lignes').count();
          c.onsuccess = function(){ const n = c.result || 0; db.close(); res(n); };
          c.onerror   = function(){ db.close(); res(0); };
        }catch(err){ db.close(); res(0); }
      };
    });
  }

  /* ============ LE COMPTAGE EXACT A ETE RETIRE, 19/09/2026 ============
     `compterLignesCompte()` demandait `BdvCompte.compter('/ventes?select=empreinte')`,
     c'est-a-dire un `count=exact` de PostgREST, c'est-a-dire un count(*) sur tout le jeu
     filtre. Sur les 171 569 lignes de Ted : 205 Mo a parcourir, et le serveur a rendu
     `57014 canceling statement due to statement timeout` le 18/09/2026.

     CE QUE CA DONNAIT A L'ECRAN, et c'est pire que la lenteur. La requete echouait donc
     TOUJOURS, le compteur d'ecart affichait en permanence « Sauvegarde non verifiable pour
     l'instant », et le garde-fou de deconnexion sortait a CHAQUE clic son avertissement
     « Impossible de verifier ce que contient ton compte ». Un avertissement qui parait
     toujours cesse d'etre lu, et c'est celui-la qui protege les donnees.

     ON POSE DONC LA QUESTION QUE LE SERVEUR SAIT ENCORE ENTENDRE : « y a-t-il au moins une
     ligne ». `BdvSync.auMoinsUneVente()` demande UNE ligne bornee par l'index, quelques
     millisecondes, et elle est deja ecrite pour la synchronisation et pour l'amorcage. Elle
     rend `true`, `false`, ou `null` quand on ne sait pas : un reseau muet n'est pas un
     compte vide, et cette nuance-la est tout ce qui reste du garde-fou.

     CE QU'ON PERD, ET IL FAUT LE DIRE : l'ECART chiffre entre l'appareil et le compte.
     « 4 442 lignes n'existent que sur cet ordinateur » n'est plus calculable. Ce qui reste
     detectable est le cas grave, celui du 07/09/2026 : un appareil qui porte des lignes en
     face d'un compte qui n'en porte AUCUNE. Un avertissement moins precis mais qui dit vrai
     vaut mieux qu'un avertissement precis qui ne parait jamais. */
  function compteAUneLigne(){
    if(!pret() || !window.BdvSync || !BdvSync.auMoinsUneVente) return Promise.resolve(null);
    try{ return Promise.resolve(BdvSync.auMoinsUneVente()).catch(function(){ return null; }); }
    catch(e){ return Promise.resolve(null); }
  }

  function nb(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  /* Le pluriel du panneau, 19/09/2026. Le moteur en a un, dans bdv-base.js, mais il n'est
     pas toujours charge quand le panneau parle : au bureau il n'arrive qu'au premier clic
     sur un ecran de vente. Meme forme, et `suite` porte l'accord que le nom seul ne donne
     pas (« ligne recuperee », « doublon ignore »). */
  function plur(n, mot, suite){
    return nb(n) + ' ' + mot + (n > 1 ? 's' : '') + (suite ? ' ' + suite + (n > 1 ? 's' : '') : '');
  }

  /* Le bandeau d'etat de la sauvegarde. Il ne repete PAS le nombre de lignes, qui est deja
     dans les cartes juste en dessous : il porte le verdict, appareil contre compte. C'est le
     seul endroit de l'outil qui pouvait dire, le 07/09/2026, que 4 442 lignes n'existaient
     que sur un ordinateur. Il se lit en premier, donc il est en haut de l'onglet.
     Il se tait quand il ne sait pas : un compteur d'ecart qui peut mentir ne sert plus. */
  async function peindreBase(){
    const cadre = el('bdvrEtat'), verdictEl = el('bdvrBaseIci'), detailEl = el('bdvrBaseEcart');
    if(!verdictEl) return;
    const local = await compterLignesLocales();
    // `true`, `false`, ou `null` quand on ne sait pas. Voir compteAUneLigne().
    const distant = await compteAUneLigne();
    let alerte = false, verdict, detail;
    if(!local && distant === false){
      verdict = 'Aucune ligne pour le moment.';
      detail  = 'Dépose ton export Vitisoft ci-dessous : le tableau de bord n\'a rien à lire tant que ta base est vide.';
    }else if(!local && distant === null){
      verdict = 'Rien sur cet appareil, et ton compte n\'a pas répondu.';
      detail  = 'Si tu as déjà déposé un export, ne le redépose pas tout de suite : recharge plutôt la page '
              + 'quand ta connexion sera revenue, ta base redescendra toute seule.';
    }else if(!local && distant === true){
      verdict = 'Ta base est sur ton compte, pas encore sur cet appareil.';
      detail  = 'Elle redescend toute seule à l\'ouverture. Si rien n\'arrive, recharge la page.';
    }else if(local && distant === false){
      alerte = true;
      verdict = 'Sauvegarde absente : ton compte ne porte aucune ligne.';
      detail  = plur(local, 'ligne') + ' n\'existent que sur cet appareil. Redépose ton export : '
              + 'en l\'état, un autre appareil ne verrait rien du tout.';
    }else if(distant === null){
      verdict = 'Sauvegarde non vérifiable pour l\'instant.';
      detail  = plur(local, 'ligne') + ' sur cet appareil. Elles sont intactes : c\'est ton compte qui ne répond pas.';
    }else{
      verdict = 'Sauvegarde en place.';
      detail  = plur(local, 'ligne') + ' sur cet appareil, et ton compte en porte aussi. Tu retrouveras ta base '
              + 'sur un autre appareil. L\'écart exact n\'est plus compté : la question faisait expirer le '
              + 'serveur sur une grosse base.';
    }
    verdictEl.textContent = verdict;
    if(detailEl) detailEl.textContent = detail;
    if(cadre) cadre.className = 'bdvr-etat' + (alerte ? ' bdvr-etat--alerte' : '');
  }

  /* ====================== ENREGISTREMENT ====================== */

  function nombreOuNull(v){
    const n = parseFloat(String(v).replace(/[^0-9.,-]/g, '').replace(',', '.'));
    return (isNaN(n) || n <= 0) ? null : n;
  }

  function enregistrer(e){
    e.preventDefault();
    if(!PROFIL_LU){ avis('Tes réglages ne sont pas encore chargés. Un instant.', false); return; }
    const btn = el('bdvrEnregistrer');
    const p = PROFIL || {};
    // Une chaine vide devient null, pas "" : effacer son prenom doit vraiment l'effacer.
    // Et SEULS les champs qui ont bouge partent : une colonne absente du corps n'est pas
    // touchee, donc on ne peut pas ecraser ce qu'on n'a pas relu.
    const vus = {
      prenom:      el('bdvrPrenom').value.trim() || null,
      domaine:     el('bdvrDomaine').value.trim() || null,
      code_postal: el('bdvrCp').value.trim() || null,
      profil:      el('bdvrQui').value || null,
      utilise_vitisoft: el('bdvrViti').value || null,
      consent_courrier: !!el('bdvrCourrier').checked,
      consent_news: !!el('bdvrNews').checked
    };
    const champs = {};
    Object.keys(vus).forEach(function(k){
      /* Les deux consentements se comparent en booleen et pas avec `|| null` : `false ||
         null` rend null, donc DECOCHER une case ne se voyait pas comme un changement et ne
         partait jamais. Le piege etait deja evite pour `consent_news` ; il fallait le dire
         pour deux, avant que la troisieme case ne le retrouve. */
      const boolean = (k === 'consent_news' || k === 'consent_courrier');
      const avant = boolean ? !!p[k] : (p[k] || null);
      if(vus[k] !== avant) champs[k] = vus[k];
    });

    const r = REGL || {};
    const nouv = {};
    if(REGL_LU){
      const obj = nombreOuNull(el('bdvrObjectif').value);
      const ex  = el('bdvrExercice').value ? parseInt(el('bdvrExercice').value, 10) : null;
      if(obj !== (r.objectif != null ? r.objectif : null)) nouv.objectif = obj;
      if(ex !== (r.exercice_debut || null)) nouv.exercice_debut = ex;
    }
    // Les blocs de l'hote enregistrent pour leur compte : le classement vit dans IndexedDB
    // et part par le chemin du tableau de bord, pas par ce formulaire.
    const hote = [];
    BLOCS.forEach(function(b){ if(b.enregistrer) hote.push(Promise.resolve().then(b.enregistrer)); });

    const bougeProfil = Object.keys(champs).length > 0;
    const bougeReglages = Object.keys(nouv).length > 0;
    if(!bougeProfil && !bougeReglages && !hote.length){ fermer(); return; }

    btn.disabled = true; btn.textContent = 'Enregistrement…';
    // allSettled, et pas all : les ecritures sont independantes. Avec all, un refus sur le
    // profil faisait annoncer « rien n'est parti » alors que l'objectif, lui, etait bien en
    // base, et l'ecran repartait sur une valeur que le serveur dementait.
    Promise.allSettled([
      bougeProfil ? BdvCompte.majProfil(champs) : Promise.resolve(),
      bougeReglages ? ecrireReglages(nouv) : Promise.resolve()
    ].concat(hote)).then(function(res){
      const profilOk = res[0].status === 'fulfilled';
      const reglagesOk = res[1].status === 'fulfilled';
      if(profilOk && bougeProfil){
        PROFIL = Object.assign({}, PROFIL, champs);
        gateVitisoft();
        if(SUR_PROFIL){ try{ SUR_PROFIL(PROFIL); }catch(e){} }
      }
      if(reglagesOk && bougeReglages){
        REGL = Object.assign({}, r, nouv);
        // Le moteur adopte la valeur enregistree SANS la renvoyer en base : elle y est deja.
        // Sans ces deux lignes, l'ardoise et l'alerte d'atterrissage gardaient l'ancien
        // objectif jusqu'au prochain rechargement, et le premier geste du moteur
        // (mois d'exercice, classement, libelles) repoussait cette vieille valeur par-dessus
        // la neuve. C'est la moitie manquante de « un seul endroit dit vrai ».
        if('objectif' in nouv && typeof adopterObjectif === 'function') adopterObjectif(nouv.objectif);
        if('exercice_debut' in nouv && typeof adopterExercice === 'function') adopterExercice(nouv.exercice_debut);
      }
      if(profilOk && reglagesOk){
        avis('C’est enregistré.', true);
        setTimeout(function(){ const v = el('bdvrVoile'); if(v && !v.hidden) fermer(); }, 900);
      }else if(!profilOk && !reglagesOk){
        avis('Rien n’est parti. Vérifie ta connexion et réessaie.', false);
      }else if(!bougeProfil || !bougeReglages){
        // Une seule moitie etait en jeu : pas de demi-succes a raconter.
        avis('Rien n’est parti. Vérifie ta connexion et réessaie.', false);
      }else{
        avis(profilOk ? 'Tes informations sont enregistrées, mais pas ton objectif. Réessaie.'
                      : 'Ton objectif est enregistré, mais pas tes informations. Réessaie.', false);
      }
      btn.disabled = !PROFIL_LU; btn.textContent = 'Enregistrer';
    });
  }

  /* ====================== OUVRIR, FERMER ====================== */

  function ouvrir(){
    construire();
    // Deja ouvert : on rafraichit et on ne touche NI au focus NI a TOUCHES. Le bouton
    // « Appliquer mes reglages » du classement est clique depuis l'interieur du panneau,
    // et un rappel d'ouverture y faisait sauter le curseur a l'autre bout du formulaire.
    const dejaLa = el('bdvrVoile') && !el('bdvrVoile').hidden;
    if(dejaLa){ rafraichirTout(); return; }
    RETOUR_FOCUS = document.activeElement;
    TOUCHES = {};
    remplir();
    avis('', true);
    el('bdvrVoile').hidden = false;
    document.body.style.overflow = 'hidden';
    el('bdvrPrenom').focus();
    rafraichirTout();
    // On rouvre sur ce qu'on a, puis on se corrige avec ce que le serveur dit. Tant que ces
    // lectures n'ont pas abouti, rien ne part : c'est le role des deux verrous.
    const encore = function(){ const v = el('bdvrVoile'); return v && !v.hidden; };
    // Le plafond part avec les lectures : au bout de quinze secondes, le message d'attente
    // cede la place a une phrase qui nomme l'echec et a un bouton. Voir armerAttente().
    armerAttente();
    if(!PROFIL_LU) chargerProfil().then(function(np){ if(np && encore()) remplir(); });
    if(!REGL_LU)   chargerReglages().then(function(nr){ if(nr && encore()) remplir(); });
  }

  function fermer(){
    desarmerAttente();
    const v = el('bdvrVoile');
    if(v) v.hidden = true;
    document.body.style.overflow = '';
    if(RETOUR_FOCUS && RETOUR_FOCUS.focus) RETOUR_FOCUS.focus();
    RETOUR_FOCUS = null;
  }

  /* ====================== LE BOUTON « ME DECONNECTER » ======================
     Ecrit ici parce qu'il est demande dans les deux pages, et qu'un garde-fou recopie est un
     garde-fou qu'on oubliera de corriger d'un cote.

     Le garde-fou n'est pas une politesse : se deconnecter EFFACE ce navigateur, et le seul
     endroit ou les lignes peuvent survivre est le compte. On compte donc les deux cotes
     avant d'effacer, et on refuse au premier clic si le compte en sait moins que le poste. */

  function ecrituresEnAttente(){
    let n = 0;
    /* ON NE NOMME PLUS LES FILES A LA MAIN, 19/09/2026. Cette liste en portait TROIS et le
       bureau en tient CINQ : les taches cochees hors reseau et les reperes de calendrier
       decales n'etaient pas comptes. Or se deconnecter EFFACE ce navigateur : le vigneron
       lisait « rien en attente », partait, et perdait ce qu'il avait note dans la vigne.
       `filesEnAttente()` balaie toutes les cles `bdv_*_attente` : c'est le meme garde-fou
       que la bascule de bureau, qui lui etait deja juste. Il saute volontairement la file
       du profil, qui est une ecriture de PERSONNE et pas de bureau ; ici elle compte, on
       la rajoute a la main. */
    const files = (window.BdvCompte && BdvCompte.filesEnAttente) ? BdvCompte.filesEnAttente() : [];
    files.forEach(function(f){ n += f.combien; });
    try{
      const v = JSON.parse(localStorage.getItem('bdv_profil_attente'));
      if(Array.isArray(v)) n += v.length;
      else if(v && typeof v === 'object') n += Object.keys(v).length;
    }catch(e){}
    return n;
  }

  function brancherSortie(bouton, zoneAvis){
    if(!bouton) return;
    let arme = null;   // null = pas encore verifie ; sinon le texte de la perte annoncee
    const dire = function(t){
      if(zoneAvis){ zoneAvis.textContent = t || ''; zoneAvis.hidden = !t; }
      else if(t) alert(t);
    };
    /* ON REPOSE LE VIGNERON DANS SON BUREAU, PAS SUR LA BROCHURE, 11/09/2026.
       Ce bouton renvoyait sur `/`, la page d'accueil marchande. Sur un ordinateur
       c'est seulement curieux : on se deconnecte et on se retrouve devant
       « Cree ton compte ». Dans une application posee sur un ecran d'accueil, il
       n'y a NI barre d'adresse NI bouton retour : le vigneron se retrouvait sur le
       site public, dans son app, et le seul chemin de retour etait une entree de
       menu hors ecran derriere un glissement lateral que rien n'annonce.
       `/mon-bureau/` sait deja peindre proprement l'etat deconnecte, et c'est
       l'adresse que l'icone de l'ecran d'accueil pointe. On y reste.
       `replace` et pas `href` : on ne laisse pas derriere soi une entree
       d'historique vers une page dont la session vient d'etre fermee. */
    const partir = function(){
      if(window.BdvCompte && BdvCompte.deconnexion) BdvCompte.deconnexion();
      location.replace('/mon-bureau/');
    };
    bouton.addEventListener('click', async function(){
      if(arme){
        if(confirm(arme + '\n\nPartir quand même et vider ce navigateur ?')) partir();
        return;
      }
      const libelle = bouton.textContent;
      bouton.disabled = true;
      bouton.textContent = 'Vérification…';
      const local = await compterLignesLocales();
      const distant = await compteAUneLigne();
      const attente = ecrituresEnAttente();
      bouton.disabled = false;

      /* L'ORDRE DES TROIS CAS EST CELUI DE LA GRAVITE, et le plus grave est le seul que la
         sonde bornee sache encore voir : un appareil qui porte des lignes en face d'un
         compte qui n'en porte aucune. Il passe donc devant le doute. 19/09/2026. */
      let alerte = '';
      if(local && distant === false){
        alerte = 'Ton compte ne porte AUCUNE ligne, alors que cet appareil en porte '
               + plur(local, 'ligne') + '. Se déconnecter vide ce navigateur : tout serait perdu. '
               + 'Redépose ton export avant de partir.';
      }else if(local && distant === null){
        alerte = 'Impossible de vérifier ce que contient ton compte. Si la sauvegarde est '
               + 'incomplète et que tu vides ce navigateur maintenant, ce qui manque est perdu.';
      }else if(attente){
        alerte = plur(attente, 'enregistrement')
               + (attente > 1 ? ' ne sont pas encore partis' : ' n\'est pas encore parti')
               + ' vers ton compte. Attends d\'être en ligne, ' + (attente > 1 ? 'ils partiront' : 'il partira')
               + ' tout seul' + (attente > 1 ? 's' : '') + '.';
      }

      if(alerte){
        dire(alerte);
        arme = alerte;
        bouton.textContent = 'Partir quand même';
        return;
      }
      bouton.textContent = libelle;
      if(!confirm('Te déconnecter ?\n\nCe navigateur sera vidé. Tes chiffres, tes notes et tes '
        + 'réglages restent sur ton compte et redescendront à ta prochaine connexion, ici ou '
        + 'ailleurs. Sans connexion, tu ne les verras plus sur ce poste.')) return;
      partir();
    });
  }

  /* ====================== CE QUE L'HOTE PEUT BRANCHER ====================== */

  function brancher(options){
    options = options || {};
    if(options.surProfil) SUR_PROFIL = options.surProfil;
    (options.blocs || []).forEach(function(b){
      BLOCS.push(b);
      if(monte) monterBloc(b);
    });
    // Un hote qui connait deja le profil (le bureau le lit pour saluer) evite un aller-retour
    // et surtout evite d'ouvrir le panneau verrouille sur une lecture deja faite ailleurs.
    if(options.profil){ PROFIL = options.profil; PROFIL_LU = true; }
  }

  // Les actions de « Ma base » sont posees par l'hote : deposer un export a besoin du
  // lecteur de CSV, vider la base a besoin de savoir ce qu'il y a a vider. Le bureau y met
  // des renvois, le tableau de bord y met les vraies commandes.
  function actionsBase(){ return el('bdvrBaseActions'); }

  window.BdvReglages = {
    ouvrir: ouvrir,
    fermer: fermer,
    brancher: brancher,
    brancherSortie: brancherSortie,
    actionsBase: actionsBase,
    peindreBase: peindreBase,
    rafraichir: rafraichirTout,
    dire: dire,
    moteurPresent: moteurPresent,
    compterLignesLocales: compterLignesLocales,
    /* `compterLignesCompte` a disparu le 19/09/2026 avec le comptage exact : aucun
       appelant dans le depot, et la question qu'elle posait faisait expirer le serveur.
       `compteAUneLigne` la remplace et rend true / false / null. */
    compteAUneLigne: compteAUneLigne,
    profil: function(){ return PROFIL; },
    profilLu: function(){ return PROFIL_LU; },
    chargerProfil: chargerProfil
  };
})();
