/* Le Bureau du Vigneron, LE PANNEAU DE REGLAGES UNIQUE.

   Decision de Ted du 07/09/2026 : les reglages du bureau, ceux du tableau de bord et
   l'ecran « Ma base » n'en font plus qu'un. Un seul panneau, ecrit une fois, ouvert depuis
   les deux pages. Ce qui est corrige ici est corrige partout, et surtout : il n'y a plus
   deux endroits ou lire son objectif de chiffre d'affaires et se demander lequel dit vrai.

   TROIS REGLES QUI TIENNENT CE FICHIER

   1. Le module porte son markup ET son style.
      Le site et le tableau de bord ont chacun leur feuille et leur :root. Un panneau qui
      s'appuierait sur les classes du site (.voile, .ficheb, .reg__i) s'afficherait nu dans
      le tableau de bord. Tout est donc prefixe `bdvr-`, et le style est injecte d'ici. Il
      n'utilise QUE les 52 jetons declares dans les deux :root : les jetons d'espacement
      (--e-m) et --cork n'existent que cote site, les voir ici serait une regression muette.

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
  function pret(){ return !!(window.BdvCompte && BdvCompte.monId && BdvCompte.monId()); }

  /* ============================== LE STYLE ==============================
     Une seule regle a retenir avant d'y toucher : n'utiliser QUE les 52 jetons declares
     dans les deux :root du projet. --cork, --e-m, --serie-1 n'existent que d'un cote, et le
     panneau doit avoir la meme tete au bureau et dans le tableau de bord.

     La modale a ete refaite le 07/09/2026 : Ted l'a trouvee « en version verticale ».
     Elle l'etait pour deux raisons cumulees, et l'une cachait l'autre :
       1. `.bdvr-panneau--large` etait declaree AVANT `.bdvr-panneau`. A specificite egale
          c'est la derniere qui gagne, donc les 40rem battaient les 64rem et le panneau
          restait etroit quoi qu'on fasse. Le mecanisme a disparu : une seule largeur.
       2. Meme large, cinq sections empilees font un rouleau de deux mille pixels. D'ou les
          ONGLETS : une section a l'ecran, jamais de defilement du formulaire, et le pied
          reste colle en bas pour que « Enregistrer » soit toujours a portee de clic. */

  const STYLE = `
.bdvr-voile{position:fixed;inset:0;background:var(--bordeaux-veil);backdrop-filter:blur(2px);
  z-index:1000;display:flex;align-items:center;justify-content:center;padding:1.5rem}
/* Colonne : entete fixe, corps qui defile, pied colle. C'est ce qui garde « Enregistrer »
   visible quel que soit le contenu de l'onglet, y compris « Ma base » et ses tableaux. */
.bdvr-panneau{position:relative;display:flex;flex-direction:column;
  width:100%;max-width:62rem;max-height:90vh;background:var(--paper);
  border:var(--trait) solid var(--rule);border-radius:var(--r-nul);box-shadow:var(--ombre-dure)}
.bdvr-tete{flex:0 0 auto;padding:1.7rem 1.9rem 0;border-bottom:var(--trait) solid var(--rule)}
.bdvr-x{position:absolute;top:.7rem;right:.9rem;background:none;border:none;
  font-size:var(--t-h3);line-height:1;color:var(--muted);cursor:pointer;padding:.2rem .45rem}
.bdvr-x:hover{color:var(--bordeaux)}
.bdvr-titre{font-family:var(--font-titre);font-size:var(--t-h3);color:var(--ink-deep);margin:0}
.bdvr-sous{font-family:var(--font-corps);font-size:var(--t-petit);color:var(--muted);margin:.3rem 0 1.2rem}

/* LES ONGLETS. Etiquettes typographiques, pas des boutons a cadre : le panneau est un
   document de reglages, pas une barre d'outils. L'actif porte le filet dore du site. */
.bdvr-onglets{display:flex;flex-wrap:wrap;gap:0;margin-bottom:-1px}
.bdvr-onglet{background:none;border:none;border-bottom:var(--trait-fort) solid transparent;
  padding:.55rem .95rem;font-family:var(--font-corps);font-size:var(--t-mini);
  text-transform:uppercase;letter-spacing:var(--ls-large);color:var(--muted);cursor:pointer;
  transition:var(--tr-rapide)}
.bdvr-onglet:hover{color:var(--ink-deep)}
.bdvr-onglet.on{color:var(--bordeaux);border-bottom-color:var(--bordeaux)}
.bdvr-onglet:first-child{padding-left:0}

.bdvr-form{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}
.bdvr-corps{flex:1 1 auto;overflow-y:auto;padding:1.5rem 1.9rem}

/* Un onglet = un bloc. Le defaut est cache, et "data-off" (pose par gateVitisoft) l'emporte
   sur tout : un bloc retire parce que le vigneron n'a pas Vitisoft ne doit pas pouvoir
   reapparaitre par un clic d'onglet. */
.bdvr-bloc{display:none;border:none;margin:0;padding:0;min-width:0}
.bdvr-bloc--on{display:block}
.bdvr-bloc[data-off="oui"]{display:none}
.bdvr-legende{display:none}   /* le titre de section est desormais l'onglet lui-meme */

/* Deux colonnes pour les champs courts. Les champs longs et les blocs du moteur prennent
   toute la largeur : un tableau de ventes dans une demi-colonne est illisible. */
.bdvr-grille{display:grid;grid-template-columns:1fr 1fr;gap:1.3rem 1.6rem}
.bdvr-champ{min-width:0;display:flex;flex-direction:column}
.bdvr-champ--plein{grid-column:1/-1}
.bdvr-l{display:block;font-family:var(--font-corps);font-size:var(--t-petit);
  color:var(--ink);margin:0 0 .35rem}
.bdvr-i{width:100%;background:var(--white);border:var(--trait) solid var(--rule);
  border-radius:var(--r-nul);padding:.6rem .75rem;font-family:var(--font-corps);
  font-size:var(--t-corps);color:var(--ink-deep)}
.bdvr-i:focus{outline:var(--trait-accent) solid var(--bordeaux);outline-offset:1px}
.bdvr-i:disabled{background:var(--paper-deep);color:var(--muted)}
.bdvr-aide{font-family:var(--font-mono);font-size:var(--t-mini);color:var(--muted);
  line-height:var(--lh-normal);margin:.35rem 0 0}
.bdvr-aide--alerte{color:var(--danger-deep);font-weight:600}
.bdvr-chk{display:flex;align-items:flex-start;gap:.55rem;font-family:var(--font-corps);
  font-size:var(--t-petit);color:var(--ink);line-height:var(--lh-normal)}

/* LE BANDEAU DE SAUVEGARDE. Il ne repete pas le compteur de lignes, qui est deja dans les
   cartes juste en dessous : il porte le VERDICT, appareil contre compte. C'est le seul
   endroit de l'outil qui pouvait dire, le 07/09/2026, que 4 442 lignes n'existaient que
   sur un ordinateur. Il merite d'etre lu avant le reste, donc il est en haut. */
.bdvr-etat{border:var(--trait) solid var(--rule);border-left:var(--trait-fort) solid var(--bordeaux);
  background:var(--white);padding:.85rem 1rem;margin:0 0 1.3rem}
.bdvr-etat--alerte{border-left-color:var(--danger-deep)}
.bdvr-etat__verdict{font-family:var(--font-corps);font-size:var(--t-base);
  color:var(--ink-deep);margin:0}
.bdvr-etat--alerte .bdvr-etat__verdict{color:var(--danger-deep)}
.bdvr-etat__detail{font-family:var(--font-mono);font-size:var(--t-mini);color:var(--muted);
  margin:.3rem 0 0;line-height:var(--lh-normal)}
.bdvr-duo{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1rem}
.bdvr-hote{min-width:0}

.bdvr-pied{flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:.9rem 1.2rem;
  border-top:var(--trait) solid var(--rule);background:var(--paper-light);
  padding:1rem 1.9rem}
.bdvr-avis{flex:1 1 100%;order:-1;font-family:var(--font-mono);font-size:var(--t-mini);
  margin:0;padding:.5rem .7rem;border-radius:var(--r-nul)}
.bdvr-avis[data-ok="oui"]{background:var(--ok-bg);color:var(--ok)}
.bdvr-avis[data-ok="non"]{background:var(--danger-bg);color:var(--danger-deep)}
.bdvr-btn{background:var(--bordeaux);color:var(--on-dark);border:var(--trait) solid var(--bordeaux);
  border-radius:var(--r-nul);padding:.6rem 1.3rem;font-family:var(--font-corps);
  font-size:var(--t-petit);text-transform:uppercase;letter-spacing:var(--ls-large);
  cursor:pointer;transition:var(--tr-rapide)}
.bdvr-btn:hover{background:var(--bordeaux-deep);border-color:var(--bordeaux-deep)}
.bdvr-btn:disabled{opacity:.55;cursor:default}
.bdvr-btn--creux{background:transparent;color:var(--bordeaux)}
.bdvr-btn--creux:hover{background:var(--bordeaux);color:var(--on-dark)}
.bdvr-lien{margin-left:auto;font-family:var(--font-mono);font-size:var(--t-mini);
  color:var(--muted);text-decoration:underline}
.bdvr-lien:hover{color:var(--bordeaux)}

@media (max-width:820px){
  .bdvr-voile{padding:0}
  .bdvr-panneau{max-width:none;max-height:100%;height:100%;border:none}
  .bdvr-grille{grid-template-columns:1fr}
  .bdvr-tete{padding:1.3rem 1.1rem 0}
  .bdvr-corps{padding:1.2rem 1.1rem}
  .bdvr-pied{padding:.9rem 1.1rem}
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
    }catch(e){}
  }

  // Un seul point d'entree de rafraichissement, appele a l'ouverture ET par le moteur apres
  // un import (cf. ecranRafraichir() dans bdv-base.js).
  function rafraichirTout(){
    peindreBase();
    rafraichirMoteur();
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
        <label class="bdvr-chk"><input type="checkbox" id="bdvrNews"> Recevoir l'édition bimensuelle du Bureau du Vigneron</label>
        <p class="bdvr-aide">Deux fois par mois, ce qui bouge dans la filière et dans l'outil. Se désinscrit d'ici, en un clic.</p>
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
    Array.prototype.forEach.call(document.querySelectorAll('.bdvr-onglet'), function(o){
      const on = (o.dataset.cible === id);
      o.classList.toggle('on', on);
      o.setAttribute('aria-selected', on ? 'true' : 'false');
    });
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
    return BdvCompte.api('/reglages?select=objectif,exercice_debut&limit=1')
      .then(function(lignes){
        if(!Array.isArray(lignes)) return null;
        REGL = lignes[0] || {};
        REGL_LU = true;
        return REGL;
      }).catch(function(){ return null; });
  }

  // Ecriture partielle assumee : `on_conflict=id` + merge-duplicates ne touche QUE les
  // colonnes envoyees. Ecrire l'objectif d'ici n'efface donc ni la file deposee par le
  // tableau de bord, ni les libelles perso, ni le classement.
  function ecrireReglages(champs){
    if(!pret()) return Promise.reject(new Error('pas de compte'));
    const corps = Object.assign({ id: BdvCompte.monId(), maj_le: new Date().toISOString() }, champs);
    return BdvCompte.api('/reglages?on_conflict=id', {
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

  function verrous(){
    const b = el('bdvrEnregistrer');
    if(b) b.disabled = !PROFIL_LU;
    const a = el('bdvrAttente');
    if(a) a.hidden = PROFIL_LU;
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
    majOnglets();
  }

  function remplir(){
    const p = PROFIL || {};
    poser('bdvrPrenom',  p.prenom);
    poser('bdvrDomaine', p.domaine);
    poser('bdvrCp',      p.code_postal);
    poser('bdvrQui',     p.profil);
    poser('bdvrViti',    p.utilise_vitisoft);
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

  function compterLignesCompte(){
    if(!pret() || !BdvCompte.compter) return Promise.resolve(null);
    return BdvCompte.compter('/ventes?select=empreinte').catch(function(){ return null; });
  }

  function nb(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  /* Le bandeau d'etat de la sauvegarde. Il ne repete PAS le nombre de lignes, qui est deja
     dans les cartes juste en dessous : il porte le verdict, appareil contre compte. C'est le
     seul endroit de l'outil qui pouvait dire, le 07/09/2026, que 4 442 lignes n'existaient
     que sur un ordinateur. Il se lit en premier, donc il est en haut de l'onglet.
     Il se tait quand il ne sait pas : un compteur d'ecart qui peut mentir ne sert plus. */
  async function peindreBase(){
    const cadre = el('bdvrEtat'), verdictEl = el('bdvrBaseIci'), detailEl = el('bdvrBaseEcart');
    if(!verdictEl) return;
    const local = await compterLignesLocales();
    const distant = await compterLignesCompte();
    let alerte = false, verdict, detail;
    if(!local && !distant){
      verdict = 'Aucune ligne pour le moment.';
      detail  = 'Dépose ton export Vitisoft ci-dessous : le tableau de bord n\'a rien à lire tant que ta base est vide.';
    }else if(distant == null){
      verdict = 'Sauvegarde non vérifiable pour l\'instant.';
      detail  = nb(local) + ' ligne(s) sur cet appareil. Elles sont intactes : c\'est ton compte qui ne répond pas.';
    }else if(local > distant){
      alerte = true;
      verdict = 'Sauvegarde incomplète : ' + nb(local - distant) + ' ligne(s) n\'existent que sur cet appareil.';
      detail  = nb(local) + ' ligne(s) ici, ' + nb(distant) + ' sur ton compte. Redépose ton export pour compléter : '
              + 'en l\'état, un autre appareil n\'en verrait que ' + nb(distant) + '.';
    }else{
      verdict = 'Sauvegarde à jour.';
      detail  = nb(local) + ' ligne(s) ici, ' + nb(distant) + ' sur ton compte. Tu retrouveras ta base sur un autre appareil.';
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
      consent_news: !!el('bdvrNews').checked
    };
    const champs = {};
    Object.keys(vus).forEach(function(k){
      const avant = (k === 'consent_news') ? !!p[k] : (p[k] || null);
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
    if(!PROFIL_LU) chargerProfil().then(function(np){ if(np && encore()) remplir(); });
    if(!REGL_LU)   chargerReglages().then(function(nr){ if(nr && encore()) remplir(); });
  }

  function fermer(){
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
    ['bdv_crm_attente', 'bdv_signets_attente', 'bdv_profil_attente'].forEach(function(k){
      try{
        const v = JSON.parse(localStorage.getItem(k));
        if(Array.isArray(v)) n += v.length;
        else if(v && typeof v === 'object') n += Object.keys(v).length;
      }catch(e){}
    });
    return n;
  }

  function brancherSortie(bouton, zoneAvis){
    if(!bouton) return;
    let arme = null;   // null = pas encore verifie ; sinon le texte de la perte annoncee
    const dire = function(t){
      if(zoneAvis){ zoneAvis.textContent = t || ''; zoneAvis.hidden = !t; }
      else if(t) alert(t);
    };
    const partir = function(){
      if(window.BdvCompte && BdvCompte.deconnexion) BdvCompte.deconnexion();
      location.href = '/';
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
      const distant = await compterLignesCompte();
      const attente = ecrituresEnAttente();
      bouton.disabled = false;

      let alerte = '';
      if(local && distant == null){
        alerte = 'Impossible de vérifier ce que contient ton compte. Si la sauvegarde est '
               + 'incomplète et que tu vides ce navigateur maintenant, ce qui manque est perdu.';
      }else if(distant != null && local > distant){
        alerte = 'Ton compte ne contient que ' + nb(distant) + ' des ' + nb(local) + ' lignes de '
               + 'cet appareil : ' + nb(local - distant) + ' lignes n\'existent QUE ici. Redépose '
               + 'ton export avant de partir.';
      }else if(attente){
        alerte = attente + ' enregistrement(s) ne sont pas encore partis vers ton compte. '
               + 'Attends d\'être en ligne, ils partiront tout seuls.';
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
    compterLignesCompte: compterLignesCompte,
    profil: function(){ return PROFIL; },
    profilLu: function(){ return PROFIL_LU; },
    chargerProfil: chargerProfil
  };
})();
