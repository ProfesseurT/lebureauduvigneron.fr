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
  let LARGE = false;              // l'hote y verse des tableaux, il faut de la place
  const BLOCS = [];               // emplacements contribues par l'hote, cf. regle 3

  function el(id){ return document.getElementById(id); }
  function pret(){ return !!(window.BdvCompte && BdvCompte.monId && BdvCompte.monId()); }

  /* ============================== LE STYLE ============================== */

  const STYLE = `
.bdvr-voile{position:fixed;inset:0;background:var(--bordeaux-veil);backdrop-filter:blur(2px);z-index:1000;
  display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem;overflow-y:auto}
.bdvr-panneau--large{max-width:64rem}
.bdvr-panneau{position:relative;width:100%;max-width:40rem;background:var(--paper);
  border:var(--trait) solid var(--rule);border-radius:var(--r-nul);
  box-shadow:var(--ombre-dure);padding:2rem 1.8rem 1.6rem}
.bdvr-x{position:absolute;top:.6rem;right:.7rem;background:none;border:none;
  font-size:var(--t-h3);line-height:1;color:var(--muted);cursor:pointer;padding:.2rem .4rem}
.bdvr-x:hover{color:var(--bordeaux)}
.bdvr-titre{font-family:var(--font-titre);font-size:var(--t-h3);color:var(--ink-deep);margin:0}
.bdvr-sous{font-family:var(--font-corps);font-size:var(--t-petit);color:var(--muted);
  margin:.3rem 0 1.4rem}
.bdvr-bloc{border:none;border-top:var(--trait) solid var(--rule);margin:0 0 1.3rem;padding:1.1rem 0 0}
.bdvr-legende{font-family:var(--font-corps);font-size:var(--t-mini);text-transform:uppercase;
  letter-spacing:var(--ls-large);color:var(--bordeaux);padding:0}
.bdvr-l{display:block;font-family:var(--font-corps);font-size:var(--t-petit);
  color:var(--ink);margin:.9rem 0 .3rem}
.bdvr-i{width:100%;background:var(--white);border:var(--trait) solid var(--rule);
  border-radius:var(--r-nul);padding:.55rem .7rem;font-family:var(--font-corps);
  font-size:var(--t-corps);color:var(--ink-deep)}
.bdvr-i:focus{outline:var(--trait-accent) solid var(--bordeaux);outline-offset:1px}
.bdvr-i:disabled{background:var(--paper-deep);color:var(--muted)}
.bdvr-i--court{width:7rem}
.bdvr-aide{font-family:var(--font-mono);font-size:var(--t-mini);color:var(--muted);margin:.35rem 0 0}
.bdvr-aide--alerte{color:var(--danger-deep);font-weight:600}
.bdvr-chk{display:flex;align-items:flex-start;gap:.5rem;font-family:var(--font-corps);
  font-size:var(--t-petit);color:var(--ink);line-height:var(--lh-normal)}
.bdvr-avis{font-family:var(--font-mono);font-size:var(--t-mini);margin:.9rem 0 0;
  padding:.5rem .7rem;border-radius:var(--r-nul)}
.bdvr-avis[data-ok="oui"]{background:var(--ok-bg);color:var(--ok)}
.bdvr-avis[data-ok="non"]{background:var(--danger-bg);color:var(--danger-deep)}
.bdvr-duo{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:.8rem}
.bdvr-pied{display:flex;flex-wrap:wrap;align-items:center;gap:1rem;
  border-top:var(--trait) solid var(--rule);margin-top:1.4rem;padding-top:1.1rem}
.bdvr-btn{background:var(--bordeaux);color:var(--on-dark);border:var(--trait) solid var(--bordeaux);
  border-radius:var(--r-nul);padding:.6rem 1.2rem;font-family:var(--font-corps);
  font-size:var(--t-petit);text-transform:uppercase;letter-spacing:var(--ls-large);cursor:pointer}
.bdvr-btn:hover{background:var(--bordeaux-deep);border-color:var(--bordeaux-deep)}
.bdvr-btn:disabled{opacity:.55;cursor:default}
.bdvr-btn--creux{background:transparent;color:var(--bordeaux)}
.bdvr-btn--creux:hover{background:var(--bordeaux);color:var(--on-dark)}
.bdvr-btn--danger{background:transparent;color:var(--danger-deep);border-color:var(--danger-deep)}
.bdvr-btn--danger:hover{background:var(--danger-deep);color:var(--on-dark)}
.bdvr-lien{font-family:var(--font-mono);font-size:var(--t-mini);color:var(--muted);
  text-decoration:underline}
.bdvr-lien:hover{color:var(--bordeaux)}
.bdvr-chiffre{font-family:var(--font-mono);font-size:var(--t-petit);color:var(--ink-deep);margin:.5rem 0 0}
.bdvr-hote{margin-top:.9rem}
@media (max-width:640px){
  .bdvr-voile{padding:0}
  .bdvr-panneau{max-width:none;min-height:100%;border:none}
}`;

  function poserStyle(){
    if(el(PREFIXE + '-style')) return;
    const s = document.createElement('style');
    s.id = PREFIXE + '-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  /* ============================== LE MARKUP ==============================
     Ecrit ici et pas dans les deux pages : c'est tout l'objet de la fusion. Les libelles
     sont ceux du bureau, mot pour mot, parce qu'ils ont ete rediges et relus. */

  const MARKUP = `
<div class="bdvr-panneau" role="dialog" aria-modal="true" aria-labelledby="bdvrTitre">
  <button class="bdvr-x" id="bdvrFermer" type="button" aria-label="Fermer">&#215;</button>
  <h2 class="bdvr-titre" id="bdvrTitre">Mes réglages</h2>
  <p class="bdvr-sous">Tout est modifiable, tout le temps. Rien n'est obligatoire.</p>

  <form id="bdvrForm" novalidate>
    <fieldset class="bdvr-bloc">
      <legend class="bdvr-legende">Toi</legend>
      <label class="bdvr-l" for="bdvrPrenom">Ton prénom</label>
      <input class="bdvr-i" type="text" id="bdvrPrenom" autocomplete="given-name">
      <p class="bdvr-aide">C'est ce nom-là qui te dit bonjour en haut de ton bureau.</p>

      <label class="bdvr-l" for="bdvrDomaine">Ton domaine ou ta structure</label>
      <input class="bdvr-i" type="text" id="bdvrDomaine" autocomplete="organization">

      <label class="bdvr-l" for="bdvrCp">Ton code postal</label>
      <input class="bdvr-i bdvr-i--court" type="text" id="bdvrCp" inputmode="numeric" maxlength="5" autocomplete="postal-code">

      <label class="bdvr-l" for="bdvrQui">Tu es</label>
      <select class="bdvr-i" id="bdvrQui">
        <option value="">Sans réponse</option>
        <option value="vigneron">Vigneron</option>
        <option value="caviste-negoce">Caviste ou négociant</option>
        <option value="etudiant">Étudiant ou école</option>
        <option value="pro-filiere">Pro de la filière</option>
        <option value="autre">Autre</option>
      </select>

      <label class="bdvr-l" for="bdvrViti">Tu utilises Vitisoft</label>
      <select class="bdvr-i" id="bdvrViti">
        <option value="">Sans réponse</option>
        <option value="oui">Oui</option>
        <option value="non">Non</option>
        <option value="inconnu">Je ne sais pas</option>
      </select>
      <p class="bdvr-aide">« Non » retire le tableau de bord du tiroir : il ne saurait rien lire.</p>
    </fieldset>

    <fieldset class="bdvr-bloc" id="bdvrBlocVentes">
      <legend class="bdvr-legende">Tes ventes</legend>
      <label class="bdvr-l" for="bdvrObjectif">Objectif de chiffre d'affaires annuel (HT)</label>
      <input class="bdvr-i" type="text" id="bdvrObjectif" inputmode="numeric" placeholder="ex. 500000">
      <p class="bdvr-aide">Il commande l'ardoise et l'alerte d'atterrissage. Vide : aucun objectif.</p>

      <label class="bdvr-l" for="bdvrExercice">Mois d'ouverture de ton exercice</label>
      <select class="bdvr-i" id="bdvrExercice"></select>
      <p class="bdvr-aide">Le tableau de bord le reprendra à sa prochaine ouverture.</p>
      <p class="bdvr-aide" id="bdvrVentesAttente" hidden>Ces deux réglages ne sont pas encore
        chargés depuis ton compte. Tant qu'ils ne le sont pas, on ne les touche pas : écrire
        par-dessus une valeur qu'on n'a pas lue, c'est l'effacer.</p>
    </fieldset>

    <fieldset class="bdvr-bloc" id="bdvrBlocBase">
      <legend class="bdvr-legende">Ma base</legend>
      <p class="bdvr-chiffre" id="bdvrBaseIci">Lecture de ta base…</p>
      <p class="bdvr-aide" id="bdvrBaseEcart"></p>
      <div class="bdvr-hote" id="bdvrHoteBase"></div>
      <div class="bdvr-duo" id="bdvrBaseActions"></div>
    </fieldset>

    <fieldset class="bdvr-bloc" id="bdvrBlocClassement">
      <legend class="bdvr-legende">Le classement</legend>
      <div class="bdvr-hote" id="bdvrHoteClassement"></div>
    </fieldset>

    <fieldset class="bdvr-bloc">
      <legend class="bdvr-legende">Le courrier</legend>
      <label class="bdvr-chk"><input type="checkbox" id="bdvrNews"> Recevoir l'édition bimensuelle du Bureau du Vigneron</label>
    </fieldset>

    <p class="bdvr-avis" id="bdvrAvis" role="status" hidden></p>
    <p class="bdvr-aide" id="bdvrAttente" hidden>Chargement de tes réglages…</p>
    <div class="bdvr-pied">
      <button class="bdvr-btn" id="bdvrEnregistrer" type="submit">Enregistrer</button>
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
    // Le tableau de bord y verse des grilles de compteurs et des tableaux : a 40rem ils
    // seraient illisibles. Le bureau, qui n'y met que du formulaire, garde la largeur etroite.
    if(LARGE) voile.querySelector('.bdvr-panneau').classList.add('bdvr-panneau--large');

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

    // Les emplacements de l'hote sont remplis une seule fois, a la construction : un bloc
    // qui se reconstruirait a chaque ouverture perdrait l'etat de ses propres champs.
    BLOCS.forEach(monterBloc);
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
    ['bdvrBlocVentes','bdvrBlocBase','bdvrBlocClassement'].forEach(function(id){
      const n = el(id); if(n) n.hidden = !!sans;
    });
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

  async function peindreBase(){
    const ici = el('bdvrBaseIci'), ec = el('bdvrBaseEcart');
    if(!ici) return;
    const local = await compterLignesLocales();
    const distant = await compterLignesCompte();
    ici.textContent = nb(local) + ' ligne(s) sur cet appareil'
      + (distant == null ? '' : ' · ' + nb(distant) + ' sur ton compte');
    if(!ec) return;
    if(!local && (distant == null || !distant)){
      ec.className = 'bdvr-aide';
      ec.textContent = 'Aucune ligne pour le moment. Dépose un export Vitisoft pour commencer.';
    }else if(distant == null){
      ec.className = 'bdvr-aide';
      ec.textContent = 'Impossible de vérifier ta sauvegarde pour le moment. Les lignes de cet appareil sont intactes.';
    }else if(local > distant){
      ec.className = 'bdvr-aide bdvr-aide--alerte';
      ec.textContent = 'Sauvegarde incomplète : ' + nb(local - distant) + ' ligne(s) n\'existent que sur cet appareil. '
        + 'Redépose ton export pour compléter. En l\'état, un autre appareil n\'en verrait que ' + nb(distant) + '.';
    }else{
      ec.className = 'bdvr-aide';
      ec.textContent = 'Sauvegarde à jour. Tu retrouveras ta base sur un autre appareil.';
    }
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
      if(reglagesOk && bougeReglages) REGL = Object.assign({}, r, nouv);
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
    if(dejaLa){
      peindreBase();
      BLOCS.forEach(function(b){ if(b.rafraichir){ try{ b.rafraichir(); }catch(e){} } });
      return;
    }
    RETOUR_FOCUS = document.activeElement;
    TOUCHES = {};
    remplir();
    avis('', true);
    el('bdvrVoile').hidden = false;
    document.body.style.overflow = 'hidden';
    el('bdvrPrenom').focus();
    peindreBase();
    // On rouvre sur ce qu'on a, puis on se corrige avec ce que le serveur dit. Tant que ces
    // lectures n'ont pas abouti, rien ne part : c'est le role des deux verrous.
    const encore = function(){ const v = el('bdvrVoile'); return v && !v.hidden; };
    if(!PROFIL_LU) chargerProfil().then(function(np){ if(np && encore()) remplir(); });
    if(!REGL_LU)   chargerReglages().then(function(nr){ if(nr && encore()) remplir(); });
    BLOCS.forEach(function(b){ if(b.rafraichir){ try{ b.rafraichir(); }catch(e){} } });
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
    if(options.large) LARGE = true;
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
    compterLignesLocales: compterLignesLocales,
    compterLignesCompte: compterLignesCompte,
    profil: function(){ return PROFIL; },
    profilLu: function(){ return PROFIL_LU; },
    chargerProfil: chargerProfil
  };
})();
