/* ==========================================================================
   LE BUREAU GARNI : LE DECOR COMMUN DES DEUX HARNAIS DE CAPTURE, 19/09/2026
   ==========================================================================
   POURQUOI CE FICHIER EXISTE. Le meme decor etait ecrit DEUX FOIS, mot pour
   mot, dans scripts/banc-large.mjs et scripts/capture-telephone.mjs : meme
   base de 286 lignes, memes cinq clients, meme miroir du CRM, memes taches.
   Copie a l'identique, il portait aussi le meme defaut a l'identique, et le
   corriger d'un cote n'aurait rien corrige de l'autre. Un decor de harnais
   n'a pas d'utilisateur pour signaler qu'il ment : il ment jusqu'a ce que
   quelqu'un relise les deux fichiers cote a cote. Il n'y en a donc plus qu'un.

   LE DEFAUT QU'IL VIENT DE COUTER, ET QUI JUSTIFIE TOUT LE RESTE DE CE FICHIER.
   Les deux harnais ecrivaient les deux cles de stockage local dans une forme
   que le code ne sait PAS relire :

     - `bdv_file_v1` etait ecrit sous une enveloppe `{le, etat}`. `lireMiroir()`
       de src/js/bdv-crm.js rend directement le `JSON.parse` : `resume`,
       `signaux` et `deposeLe` sortaient donc tous indefinis. Et `deposeLe`
       indefini fait repondre faux a `sousMainUtile()` dans src/mon-bureau.njk,
       qui CACHE la zone du sous-main. Le harnais photographiait un bureau sans
       sous-main, sans ardoise, sans mot du jour, et validait une mise en page
       que personne ne verra jamais.
     - la cle des fiches de suivi s'appelait `suivis`, alors que `file()` lit
       `suivi` (repli historique `rappels`).
     - un signal portait `ca` au lieu de `montant`.
     - `bdv_taches_v1` etait un TABLEAU sous enveloppe, alors que `libres()`
       fait `Object.keys(map)` sur une CARTE indexee par `tache_id`. Zero
       punaise au panneau, sans un mot.

   LA FORME EXACTE, RELUE DANS LE CODE LE 19/09/2026. Ne pas la deviner :
     `bdv_file_v1`   -> src/js/bdv-crm.js, `MIROIR_KEY`, `lireMiroir()`,
                        `ecrireMiroir()` et `file()`. AUCUNE enveloppe.
                        `signaux[]` = {id, nom, montant, lib, motif, detail, contact}
                        `suivi[]`   = {id, rappel, titre, statut, par},
                                      `rappel` en date LOCALE AAAA-MM-JJ, et une
                                      date FUTURE sort le client de la file.
                        `resume`    = {ca, variation, exercice, objectif,
                                       objectifPct, atterrissage, clients,
                                       panier, conseils}
                        `noms`      = carte client_id -> nom
                        `deposeLe`  = ISO complet
                        `perime` ne s'ecrit JAMAIS ici : c'est une marque posee a
                        la volee par `charger()` quand les deux lectures tombent.
     `bdv_taches_v1` -> src/js/bdv-taches.js, `CACHE_KEY`, `lireCache()`,
                        `ecrireCache()` et `libres()`. Une CARTE indexee par
                        `tache_id`, sans enveloppe, et chaque ligne REPORTE son
                        `tache_id` dans son champ. `source` vaut 'libre' ou
                        'echeance', et 'echeance' est ECARTEE par `libres()`.
                        `echue_le` et `fin_le` sont des jours AAAA-MM-JJ lus en
                        `new Date(x + 'T00:00:00')`, `fait_le` un ISO ou null.
                        Un autre exemple correct vit dans scripts/banc-bascule.mjs.
   ========================================================================== */

/* ---------------------------------------------------------------------------
   LES CINQ CLIENTS ET LES QUATRE CUVEES. Choisis longs et sales EXPRES : un nom
   de quarante signes, une adresse de courriel qui ne tient pas, un fixe avec un
   poste, deux mobiles dans la meme case. Un decor propre ne casse aucune mise en
   page, et ne prouve donc rien.
--------------------------------------------------------------------------- */
export const CLIENTS = [
  ['Domaine des Hauts Coteaux et Fils','C0412','contact@hauts-coteaux.fr','04 94 12 34 56','06 12 34 56 78, 06 98 76 54 32'],
  ['Cave du Vieux Pressoir','C0288','commande@vieux-pressoir-de-bourgogne.fr','','(+33) 6 11 22 33 44'],
  ['La Cave Saint-Vincent','C0155','cave.saint.vincent@orange.fr','04 75 01 02 03 poste 12',''],
  ['Vins & Terroirs Export','C0901','export@vins-terroirs.be','','0475 12 34 56'],
  ['Le Comptoir des Vignes','C0733','lecomptoir@gmail.com','','06 55 44 33 22'],
];
export const CUVEES = [['Le Rosé','2024','Rosé'],['Le Rosé','2025','Rosé'],['Cuvée Les Terrasses','2021','Rouge'],['Blanc de Blancs','2023','Blanc']];
export const CANAUX = ['Caveau','Cavistes','Export','Salon'];

/* LA BASE FABRIQUEE. La VRAIE forme de ligne ({h, raw:[43 chaines]}) et le vrai
   ordre de COLS : c'est `reloadFromDB()` du vrai moteur qui la relira. */
export function lignesDeVente() {
  const out = []; let n = 0;
  for (let mois = 0; mois < 22; mois++) {
    const d = new Date(2024, 10 + mois, 12);
    for (const [nom, num, mail, fixe, mob] of CLIENTS) {
      for (const [cuvee, mill, coul] of CUVEES) {
        if ((n + mois) % 3 === 0) { n++; continue; }
        const q = 6 + ((n * 7) % 30), pu = 7 + ((n * 3) % 9);
        const raw = new Array(43).fill('');
        raw[0]  = ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();
        raw[1]  = 'F' + (10000 + n);
        raw[2]  = cuvee + ' ' + mill;
        raw[4]  = 'Vins tranquilles';
        raw[5]  = 'Bouteille 75 cl';
        raw[11] = 'AOP Côtes de Provence';
        raw[12] = coul; raw[13] = mill;
        raw[14] = String(pu); raw[15] = String(q * pu);
        raw[16] = nom; raw[17] = num;
        raw[19] = String(q);
        raw[30] = nom.includes('Export') ? 'Belgique' : 'France';
        raw[32] = 'Nantes'; raw[33] = '44000';
        raw[39] = CANAUX[n % CANAUX.length];
        raw[40] = mail; raw[41] = fixe; raw[42] = mob;
        out.push({ h: 'h' + n, raw }); n++;
      }
    }
  }
  return out;
}

/* Un jour en date LOCALE, decale de k jours. toISOString() rendrait l'UTC, et
   entre minuit et deux heures du matin en France un rappel « du jour » serait
   ecrit a la veille : c'est la meme regle que `isoLocal()` de bdv-crm.js. */
export function jour(k) {
  const d = new Date(); d.setDate(d.getDate() + k);
  return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
}

/* ---------------------------------------------------------------------------
   POSER LE DECOR AVANT QUE LA PAGE CHARGE.
--------------------------------------------------------------------------- */
/* `opts.equipe` nomme l'etat de « L'equipe » a poser, et il vaut 'maitre' par
   defaut : un harnais qui ne dit rien garnit la piece, parce que c'est l'oubli
   qui a coute cinq lots. `opts.equipe = false` la laisse nue, et il faut alors
   savoir pourquoi on le demande. */
export async function garnirLeBureau(ctx, lignes, opts) {
  await ctx.addInitScript(({ lignes, jour0, jour3, jourM5, jourM2 }) => {
    const H = 3600;
    localStorage.setItem('bdv_session', JSON.stringify({
      access_token: 'faux', refresh_token: 'faux',
      expires_at: Math.floor(Date.now()/1000) + H, user: { id: 'moi', email: 'ted@exemple.fr' } }));
    localStorage.setItem('bdv_proprietaire', 'moi');
    localStorage.setItem('bureau_prenom', 'Teddy');

    /* LE MIROIR DE bdv-crm.js, SANS AUCUNE ENVELOPPE : `lireMiroir()` rend
       directement le JSON.parse. Un `{le, etat}` ici rend `deposeLe` indefini,
       `sousMainUtile()` repond faux, et TOUTE la zone du sous-main disparait. */
    localStorage.setItem('bdv_file_v1', JSON.stringify({
      deposeLe: new Date().toISOString(),
      resume: { ca: 1064403, variation: 4.2, clients: 5, panier: 812, objectif: 1200000 },
      noms: { C0412:'Domaine des Hauts Coteaux et Fils', C0288:'Cave du Vieux Pressoir',
              C0155:'La Cave Saint-Vincent', C0901:'Vins & Terroirs Export' },
      /* `montant` et pas `ca` : c'est le nom que lit `file()`. */
      signaux: [
        { id:'C0412', nom:'Domaine des Hauts Coteaux et Fils', motif:'recul', montant:14280 },
        { id:'C0288', nom:'Cave du Vieux Pressoir', motif:'cadence', montant:9140 },
        { id:'C0155', nom:'La Cave Saint-Vincent', motif:'premier', montant:2310 },
        { id:'C0901', nom:'Vins & Terroirs Export', motif:'recul', montant:5020 } ],
      /* `suivi` et pas `suivis`, et `titre` et pas `rappel_titre`. Les deux
         premieres dates sont ECHUES ou du jour, donc elles sortent au sous-main ;
         la troisieme est FUTURE, donc elle sort ce client de la file, et c'est
         voulu : un decor ou tout tombe le meme jour ne montre pas ce tri-la. */
      suivi: [
        { id:'C0412', rappel: jourM5, titre:'Il voulait un devis pour le salon', statut:'relance', par: null },
        { id:'C0288', rappel: jour0, titre:'', statut:'afaire', par: null },
        { id:'C0155', rappel: jour3, titre:'Rappeler apres le salon', statut:'relance', par: null } ],
      reglages: { lus: true, objectif: 1200000, exercice_debut: '2026-01-01' }
    }));

    /* LE CACHE DE bdv-taches.js : une CARTE indexee par `tache_id`, pas un
       tableau, sans enveloppe. `libres()` fait `Object.keys(map).forEach`, et
       chaque ligne doit REPORTER sa cle dans son champ `tache_id`. */
    localStorage.setItem('bdv_taches_v1', JSON.stringify({
      t1: { tache_id:'t1', titre:'Commander des bouchons pour la mise', source:'libre',
            ref:null, echue_le: jourM5, fin_le:null, fait_le:null,
            maj_le: new Date().toISOString(), cree_par:null },
      t2: { tache_id:'t2', titre:'Rappeler le courtier', source:'libre',
            ref:null, echue_le: jour0, fin_le:null, fait_le:null,
            maj_le: new Date().toISOString(), cree_par:null },
      t3: { tache_id:'t3', titre:'Salon des vins de Loire', source:'libre',
            ref:null, echue_le: jourM2, fin_le: jour3, fait_le:null,
            maj_le: new Date().toISOString(), cree_par:null },
      t4: { tache_id:'t4', titre:'Changer le filtre de la pompe', source:'libre',
            ref:null, echue_le:null, fin_le:null, fait_le:null,
            maj_le: new Date().toISOString(), cree_par:null }
    }));

    const dq = indexedDB.open('bdv_ventes_v4', 2);
    dq.onupgradeneeded = e => { const db = e.target.result;
      if (!db.objectStoreNames.contains('lignes')) db.createObjectStore('lignes', { keyPath:'h' });
      if (!db.objectStoreNames.contains('reglages')) db.createObjectStore('reglages'); };
    dq.onsuccess = e => { const db = e.target.result;
      const tx = db.transaction('lignes','readwrite'), st = tx.objectStore('lignes');
      lignes.forEach(l => st.put(l)); };
  }, { lignes, jour0: jour(0), jour3: jour(3), jourM5: jour(-5), jourM2: jour(-2) });

  /* ET « L'EQUIPE », QUE CE FICHIER NE POSAIT PAS JUSQU'AU 21/09/2026. Elle est
     garnie PAR DEFAUT : les sept lots precedents l'ont photographiee vide sans
     que personne le remarque, et un decor qu'il faut penser a demander est un
     decor qu'on oublie. Le detail est en bas de ce fichier. */
  const quelleEquipe = (opts && 'equipe' in opts) ? opts.equipe : 'maitre';
  if (quelleEquipe !== false) await garnirLEquipe(ctx, quelleEquipe);
}

/* ---------------------------------------------------------------------------
   LES TROIS DOUBLURES DE CDN. Le conteneur n'a pas de reseau : sans elles,
   `chargerEcrans()` echoue et AUCUN ecran de vente ne se peint. Les sept pieces
   rendent alors la meme hauteur, celle de « Ma journee », et le harnais
   photographie une piece en croyant en photographier une autre. Les graphiques
   restent des cadres vides : c'est une LIMITE a dire, pas un defaut a corriger.
--------------------------------------------------------------------------- */
export async function doublerLesBibliotheques(ctx) {
  await ctx.route('**/papaparse.min.js', r => r.fulfill({ contentType:'text/javascript', body:'window.Papa={parse:function(){return{data:[]}}};' }));
  await ctx.route('**/xlsx.full.min.js', r => r.fulfill({ contentType:'text/javascript', body:'window.XLSX={utils:{book_new:function(){return{}},json_to_sheet:function(){return{}},book_append_sheet:function(){}},writeFile:function(){}};' }));
  await ctx.route('**/chart.umd.min.js', r => r.fulfill({ contentType:'text/javascript', body:`
  window.Chart = function(ctx){ this.destroy=function(){}; this.update=function(){}; this.resize=function(){};
    try{ var c=ctx&&ctx.canvas?ctx.canvas:ctx; if(c&&c.getContext){ c.height=180; var g=c.getContext('2d');
      g.fillStyle='#EFE7D6'; g.fillRect(0,0,c.width,c.height); g.fillStyle='#8A8478'; g.font='12px sans-serif';
      g.fillText('(graphique, non trace hors ligne)',10,24);} }catch(e){} };
  window.Chart.register=function(){}; window.Chart.defaults={font:{},plugins:{legend:{}}};
` }));
}

/* ==========================================================================
   LE GARDE-FOU : ON COMPTE CE QU'ON VIENT DE PEINDRE
   ==========================================================================
   C'EST LE VRAI LIVRABLE DU 19/09/2026, plus encore que la correction de forme.
   Un harnais qui accepte un bureau vide recommencera a mentir a la premiere
   derive de forme, et il mentira exactement comme il vient de le faire : sans
   rien casser, sans une erreur JavaScript, avec des captures d'ecran nettes
   d'un bureau qui n'existe pas.

   ON COMPTE CE QUE LE DECOR DOIT PRODUIRE, pas ce qu'on vient d'ecrire :
     - les PUNAISES du panneau (`#bureauPanneau .postit`), peintes depuis
       `BdvTaches.punaises()` et le miroir du CRM ;
     - les LIGNES DU SOUS-MAIN (`#bureauFile .listb__l`), peintes depuis
       `BdvCrm.file()` ;
     - la zone du sous-main VISIBLE, qui est ce que `deposeLe` commande.
   Zero d'un cote quelconque : on leve. Le harnais s'arrete AVANT de rendre son
   rapport, parce qu'un rapport faux vaut moins que pas de rapport.
   ========================================================================== */
export async function verifierLeBureauGarni(page) {
  const c = await page.evaluate(() => {
    const zone = document.getElementById('zoneSousMain');
    const panneau = document.getElementById('zonePanneau');
    const mot = document.getElementById('bureauMot');
    return {
      punaises: document.querySelectorAll('#bureauPanneau .postit').length,
      sousMain: document.querySelectorAll('#bureauFile .listb__l').length,
      zoneVisible: !!(zone && !zone.hidden),
      panneauVisible: !!(panneau && !panneau.hidden),
      ardoiseVisible: !!(document.getElementById('zoneArdoise')
        && !document.getElementById('zoneArdoise').hidden),
      mot: mot ? (mot.textContent || '').trim().length : 0,
      resume: (document.getElementById('bureauResume') || {}).textContent || '',
      /* L'ETAT D'EQUIPE DEMANDE, relu la ou garnirLEquipe l'a ecrit. Le garde-fou
         ne devine pas ce qu'il doit trouver, il le LIT. */
      etatEquipe: (function(){ try { return localStorage.getItem('bdv_harnais_equipe'); }
                               catch (e) { return null; } })(),
      bureauPose: (function(){ try { return !!localStorage.getItem('bdv_bureau_v1'); }
                               catch (e) { return false; } })()
    };
  });

  /* LE SERVEUR DOUBLE REPOND-IL ? On le demande a la page, par le VRAI chemin
     (`BdvCompte.api`), et pas en relisant ce qu'on vient d'ecrire. C'est le seul
     controle qui aurait attrape le trou des lots 3 a 7 : la piece n'etait pas
     mal peinte, elle n'avait simplement personne dedans, et aucun releve de
     « Ma journee » ne pouvait le voir. */
  c.equipiers = await page.evaluate(async () => {
    try {
      if (!(window.BdvCompte && BdvCompte.monBureau && BdvCompte.monBureau())) return 0;
      const g = await BdvCompte.api('/rpc/equipe', { methode: 'POST', corps: { b: BdvCompte.monBureau() } });
      return Array.isArray(g) ? g.length : 0;
    } catch (e) { return 0; }
  });

  const griefs = [];
  if (!c.zoneVisible) griefs.push('la zone du sous-main est CACHEE : `deposeLe` n\'est pas arrive jusqu\'a sousMainUtile(), donc bdv_file_v1 n\'est pas lisible par lireMiroir()');
  if (!c.sousMain) griefs.push('AUCUNE ligne au sous-main : `signaux` / `suivi` ne sont pas lus par BdvCrm.file()');
  if (!c.punaises) griefs.push('AUCUNE punaise au panneau : bdv_taches_v1 n\'est pas une carte indexee par tache_id, ou `source` n\'est pas \'libre\'');
  if (c.etatEquipe === null) griefs.push('« L\'equipe » n\'a PAS ete garnie : garnirLeBureau() a-t-il ete appele avec `{ equipe: false }` ? Cette piece est sortie vide de sept lots de captures, elle ne repart pas nue');
  if (c.etatEquipe && c.etatEquipe !== 'sans-bureau' && !c.bureauPose) griefs.push('aucun bureau courant pose alors que l\'etat « ' + c.etatEquipe + ' » en demande un');
  if (c.etatEquipe && c.etatEquipe !== 'sans-bureau' && !c.equipiers) griefs.push('le serveur double ne rend AUCUN equipier sur /rpc/equipe : « L\'equipe » se peindra sur son ecran d\'echec');

  console.log('\n--- LE BUREAU EST-IL GARNI ? ---');
  console.log('  punaises au panneau   : ' + c.punaises);
  console.log('  lignes au sous-main   : ' + c.sousMain);
  console.log('  zone du sous-main     : ' + (c.zoneVisible ? 'visible' : 'CACHEE'));
  console.log('  ardoise               : ' + (c.ardoiseVisible ? 'visible' : 'cachee'));
  console.log('  mot du jour           : ' + (c.mot ? c.mot + ' signes' : 'vide'));
  console.log('  resume du bandeau     : ' + (c.resume.trim() || '(vide)'));
  console.log('  etat de l\'equipe      : ' + (c.etatEquipe || 'AUCUN') + ', ' + c.equipiers + ' equipier(s)');

  if (griefs.length) {
    throw new Error('BUREAU VIDE : le harnais allait photographier un bureau qui ne montre rien.\n  - '
      + griefs.join('\n  - ')
      + '\n  La forme exacte des deux cles est en tete de scripts/bureau-garni.mjs.');
  }
  return c;
}

/* ==========================================================================
   L'EQUIPE : LE DECOR QUE CE HARNAIS N'AVAIT PAS, 21/09/2026
   ==========================================================================
   LE DEFAUT, ET C'EST LA CINQUIEME FOIS QUE CE DEPOT LE PAIE. Ce fichier
   garnissait huit pieces sur neuf. « L'equipe » sortait SANS UN EQUIPIER sur
   toutes les captures des lots 3 a 7 : `#equipeListe` vide, `equipeInviterForme`
   masque, `equipeAttentesBloc` masque, `equipeLien` masque, `equipe-role` nulle
   part. Les trois audits de contraste des lots 3, 4 et 5 ont donc mesure zero
   paire dessus, et les deux bancs d'empreinte ont compare du vide a du vide.
   La piece est restee en papier pendant les cinq lots du theme sans qu'un seul
   controle puisse le dire. UNE PIECE QU'UN HARNAIS REND VIDE N'EST PAS UNE
   PIECE VERIFIEE.

   POURQUOI ELLE SORTAIT VIDE. Elle ne lit RIEN du stockage local : son contenu
   vient de six appels a `BdvCompte.api()`, c'est-a-dire du serveur. Le
   conteneur n'a pas de reseau, et `lot6-empreinte.mjs` coupe en plus tout ce
   qui n'est pas 127.0.0.1. Les six appels tombaient, `ouvrir()` attrapait et
   affichait « La liste n'a pas pu etre lue ».

   CE QU'ON DOUBLE, ET CE QU'ON NE DOUBLE PAS. On double LE SERVEUR, pas le
   client : `window.fetch` repond aux adresses Supabase qu'on connait, et
   `src/js/bdv-compte.js` comme `src/js/bdv-equipe.js` tournent en entier, sans
   une ligne de complaisance. C'est le meme choix que les trois doublures de CDN
   ci-dessus. Stubber `BdvCompte` aurait reconstruit un harnais plus sage que la
   realite, et c'est precisement ce qu'on repare.

   TOUTE ADRESSE SUPABASE QU'ON NE CONNAIT PAS EST REFUSEE COMME AVANT, par un
   `TypeError` identique a celui d'un reseau coupe. Le reste du decor (les
   ventes, le miroir du CRM, les taches, le profil) continue donc de venir du
   stockage local, exactement comme dans les sept lots precedents : ce
   garnissage-ci AJOUTE une piece, il n'en deplace aucune autre.

   CE QUE CA CHANGE AILLEURS, ET IL FAUT LE SAVOIR AVANT DE COMPARER DEUX
   RELEVES : `/rpc/equipe` repond, donc le trombinoscope de bdv-compte.js se
   remplit, donc les noms d'auteur apparaissent dans « Mes taches » et dans la
   fiche client ; et `mesBureaux()` rend deux bureaux, donc la barre des pieces
   affiche le nom du bureau courant. Ces deux effets sont VRAIS pour un vigneron
   qui travaille a plusieurs. Un releve d'avant et un releve d'apres doivent
   donc etre pris avec le MEME garnissage, sinon on compare deux decors.
   ========================================================================== */

/* Les identifiants sont ceux de `scripts/apercu-equipe.mjs`, au caractere pres,
   pour que l'apercu jsdom et la capture Chromium montrent le meme bureau. MOI
   vaut 'moi' parce que c'est l'identifiant de la session posee plus haut, et
   que `rendreEquipe()` compare `g.personne` a `BdvCompte.monId()`. */
export const BUREAU_A = 'b0000000-0000-0000-0000-000000000001';
export const BUREAU_B = 'b0000000-0000-0000-0000-000000000002';
export const MOI = 'moi';

/* TROIS EQUIPIERS ET PAS DEUX : il en faut un qui soit MOI (ligne sans gestes,
   avec « (toi) »), un simple utilisateur et un second maitre, parce que les
   trois lignes ne portent pas les memes boutons ni la meme etiquette. Les noms
   sont longs et les adresses sales, comme les cinq clients plus haut : une
   adresse de trente-deux signes est ce qui fait deborder la colonne. */
export const EQUIPIERS = [
  { personne: MOI, role: 'maitre', depuis: '2026-09-01T08:00:00Z',
    prenom: 'Ted', nom: 'Pereira', email: 'teddypereira88@gmail.com' },
  { personne: 'p2', role: 'simple', depuis: '2026-09-10T08:00:00Z',
    prenom: 'Romane', nom: 'Bouijoux', email: 'romane@solumatic.fr' },
  { personne: 'p3', role: 'maitre', depuis: '2026-09-12T08:00:00Z',
    prenom: 'Camila', nom: 'Vendramini', email: 'camila.vendramini@solumatic.fr' }
];

/* DEUX INVITATIONS, ET LA SECONDE EST EXPIREE : `rendreInvitations()` ecrit
   « lien expire » au lieu de « en attente » quand `expire_le` est passe, et
   c'est un etat que personne n'avait jamais vu peint. */
export const ATTENTES = [
  { email: 'alice@domaine-essai.fr', role: 'simple',
    cree_le: '2026-09-18T08:00:00Z', expire_le: '2099-01-01T08:00:00Z', utilise_le: null },
  { email: 'jean-baptiste.delaunay@cave-cooperative-du-val.fr', role: 'maitre',
    cree_le: '2026-09-01T08:00:00Z', expire_le: '2026-09-08T08:00:00Z', utilise_le: null }
];

/* LES TROIS ETATS, PARCE QU'ILS N'AFFICHENT PAS LES MEMES BLOCS.
     maitre       : selecteur de bureaux, nom du bureau et Renommer, la liste
                    avec ses gestes, le formulaire d'invitation, les invitations
                    en attente, Quitter ce bureau.
     simple       : la liste SANS gestes, la note « seul un maitre peut inviter »,
                    Quitter. Ni selecteur (un seul bureau), ni nom, ni formulaire,
                    ni invitations. C'est la vue la moins regardee du lot 19.
     sans-bureau  : son propre ecran, `.equipe-aucun`, et rien d'autre. Etat
                    possible depuis le lot 20 : un invite n'a pas de bureau solo.
   Le nom de l'etat est ecrit dans le stockage local pour que le garde-fou plus
   bas sache ce qu'il doit trouver au lieu de le deviner. */
export const ETATS_EQUIPE = {
  'maitre':      { bureau: BUREAU_A, moi: 'maitre', bureaux: 2, attentes: ATTENTES },
  'simple':      { bureau: BUREAU_A, moi: 'simple', bureaux: 1, attentes: [] },
  'sans-bureau': { bureau: null,     moi: null,     bureaux: 0, attentes: [] }
};

export async function garnirLEquipe(ctx, nomEtat) {
  const etat = ETATS_EQUIPE[nomEtat || 'maitre'];
  if (!etat) throw new Error('etat d\'equipe inconnu : ' + nomEtat
    + '  (' + Object.keys(ETATS_EQUIPE).join(', ') + ')');

  /* L'EQUIPE DU BUREAU COURANT. Mon role change avec l'etat : c'est lui, et lui
     seul, qui commande MAITRE dans bdv-equipe.js, donc la moitie des blocs. */
  const gens = EQUIPIERS.map(g => g.personne === MOI && etat.moi
    ? { ...g, role: etat.moi } : g);

  const bureaux = [
    { bureau: BUREAU_A, role: etat.moi || 'simple', bureaux: { nom: 'Domaine des Hauts Coteaux' } },
    { bureau: BUREAU_B, role: 'simple', bureaux: { nom: 'Cave du Vieux Pressoir' } }
  ].slice(0, etat.bureaux);

  await ctx.addInitScript(({ etat, gens, bureaux, MOI }) => {
    /* LE BUREAU COURANT EST POSE DANS LE STOCKAGE, et pas rendu par `/profils` :
       `chargerBureau()` sort tout de suite quand la cle est deja la, donc on ne
       touche pas au profil, qui continue de ne pas arriver comme dans les sept
       lots precedents. Pour l'etat « sans-bureau », on ne pose RIEN : c'est
       l'absence de cette cle qui fait `pret()` faux et ouvre le bon ecran. */
    try {
      if (etat.bureau) localStorage.setItem('bdv_bureau_v1', etat.bureau);
      else localStorage.removeItem('bdv_bureau_v1');
      localStorage.setItem('bdv_harnais_equipe', etat.nom);
      /* Le trombinoscope est refait par /rpc/equipe : une copie perimee d'un
         autre bureau ferait apparaitre des noms qui ne sont pas dans la liste. */
      localStorage.removeItem('bdv_trombinoscope_v1');
    } catch (e) {}

    const JSN = (o) => new Response(JSON.stringify(o),
      { status: 200, headers: { 'Content-Type': 'application/json' } });

    /* LE SERVEUR DOUBLE. On ne repond QUE des adresses qu'on connait ; toute
       autre adresse Supabase est refusee par le meme TypeError qu'un reseau
       coupe, pour que rien d'autre dans le bureau ne change de comportement. */
    function repondre(chemin, init) {
      const corps = (() => {
        try { return JSON.parse((init && init.body) || '{}'); } catch (e) { return {}; }
      })();

      if (chemin.indexOf('/rest/v1/rpc/equipe') === 0) return gens;

      if (chemin.indexOf('/rest/v1/membres') === 0) {
        return bureaux.map(b => ({ bureau: b.bureau, role: b.role, bureaux: b.bureaux }));
      }
      if (chemin.indexOf('/rest/v1/bureaux') === 0) {
        const b = bureaux.filter(x => chemin.indexOf(x.bureau) >= 0)[0] || bureaux[0];
        return b ? [{ nom: b.bureaux.nom }] : [];
      }
      if (chemin.indexOf('/rest/v1/invitations') === 0) {
        /* La politique de securite ne rend ces lignes qu'a un maitre : le
           harnais ment moins que l'ecran s'il rend le tableau vide aux autres. */
        return etat.moi === 'maitre' ? etat.attentes : [];
      }
      /* L'APERCU D'UNE INVITATION est ouvert a `anon` : c'est lui qui peint le
         bandeau, et il repond meme sans session. */
      if (chemin.indexOf('/rest/v1/rpc/invitation_apercu') === 0) {
        return [{ bureau_nom: 'Domaine des Hauts Coteaux', invite_par_prenom: 'Teddy',
                  email: 'alice@domaine-essai.fr', etat: 'valide' }];
      }
      /* LE LIEN DE SECOURS. La fonction `invitation` rend `envoye:false` quand
         Resend a tousse, et c'est le SEUL chemin par lequel `#equipeLien`
         s'affiche. Le harnais prend donc cette sortie-la : sans elle, le bloc du
         lien n'est peint sur aucune image, et c'est exactement le genre de bloc
         qu'on laisse en papier pendant cinq lots. */
      if (chemin.indexOf('/functions/v1/invitation') === 0) {
        return { envoye: false, motif: 'le service d’envoi n’a pas répondu',
                 lien: 'https://lebureauduvigneron.fr/mon-bureau/?invitation='
                   + '2990143f50f7a1c4b8e9d0f3a6b7c8d9e0f1a2b3c4d5e6f70819a2b3c4d5e6f7' };
      }
      return undefined;
    }

    const vraiFetch = window.fetch.bind(window);
    window.fetch = function (entree, init) {
      const url = String((entree && entree.url) || entree || '');
      if (url.indexOf('supabase.co') < 0) return vraiFetch(entree, init);
      let chemin;
      try { chemin = new URL(url).pathname + new URL(url).search; } catch (e) { chemin = url; }
      const r = repondre(chemin, init);
      if (r === undefined) return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(JSN(r));
    };
  }, { etat: { ...etat, nom: nomEtat || 'maitre' }, gens, bureaux, MOI });
}

/* ==========================================================================
   LE GARDE-FOU DE LA PIECE, ET IL SE PASSE APRES L'AVOIR OUVERTE
   ==========================================================================
   `verifierLeBureauGarni()` ne peut pas le faire : il tourne sur « Ma journee »,
   et `#equipeListe` ne se remplit qu'au premier `BdvNav.afficher('equipe')`.
   Celui-ci se passe donc SEPAREMENT, la piece ouverte, et il compte ce que
   l'etat demande. Zero ligne, zero etiquette de role, ou le bloc attendu
   masque : on leve, parce qu'une image d'une piece vide vaut moins que pas
   d'image du tout. C'est la lecon des cinq lots precedents.
   ========================================================================== */
export async function verifierLEquipeGarnie(page, nomEtat) {
  const etat = nomEtat || 'maitre';
  const c = await page.evaluate(() => {
    const vu = (id) => { const n = document.getElementById(id); return !!(n && !n.hidden); };
    return {
      lignes: document.querySelectorAll('#equipeListe .equipe-ligne').length,
      roles: document.querySelectorAll('#equipeListe .equipe-role').length,
      maitres: document.querySelectorAll('#equipeListe .equipe-role--maitre').length,
      attentes: document.querySelectorAll('#equipeAttentes .equipe-ligne').length,
      selecteur: vu('equipeBureauBloc'), nom: vu('equipeNomBloc'),
      inviter: vu('equipeInviterForme'), attentesBloc: vu('equipeAttentesBloc'),
      note: vu('equipeNoteSimple'), aucun: vu('equipeAucun'),
      partir: vu('equipePartir'), lien: vu('equipeLien'),
      avis: (document.getElementById('equipeAvis') || {}).textContent || ''
    };
  });

  const griefs = [];
  if (/n’a pas pu|n'a pas pu/.test(c.avis)) {
    griefs.push('la piece affiche son ecran d\'echec : le serveur double n\'a pas repondu. '
      + 'garnirLEquipe() a-t-il ete appele AVANT ctx.newPage() ?');
  }
  if (etat === 'sans-bureau') {
    if (!c.aucun) griefs.push('l\'ecran « aucun bureau » est masque alors que c\'est l\'etat demande');
    if (c.lignes) griefs.push('des equipiers sont peints dans un etat qui n\'a pas de bureau');
  } else {
    if (!c.lignes) griefs.push('AUCUN equipier : /rpc/equipe n\'a pas repondu, ou `personne` ne vaut pas ' + MOI);
    if (!c.roles) griefs.push('AUCUNE etiquette de role : c\'est elle qui porte l\'etat MAITRE / UTILISATEUR');
    if (!c.partir) griefs.push('« Quitter ce bureau » est masque : rendreEquipe() n\'est pas alle au bout');
  }
  if (etat === 'maitre') {
    if (!c.selecteur) griefs.push('le selecteur de bureaux est masque : mesBureaux() en rend moins de deux');
    if (!c.nom) griefs.push('le bloc du nom du bureau est masque : /bureaux n\'a pas repondu');
    if (!c.inviter) griefs.push('le formulaire d\'invitation est masque : mon role n\'est pas maitre');
    if (!c.attentesBloc || !c.attentes) griefs.push('aucune invitation en attente peinte');
  }
  if (etat === 'simple') {
    if (!c.note) griefs.push('la note « seul un maitre peut inviter » est masquee');
    if (c.inviter) griefs.push('le formulaire d\'invitation est OFFERT a un simple utilisateur');
    if (c.selecteur) griefs.push('un selecteur a une seule ligne est un ecran mort, il ne doit pas sortir');
  }

  console.log('\n--- L\'EQUIPE EST-ELLE GARNIE ? (' + etat + ') ---');
  console.log('  equipiers             : ' + c.lignes + ' (dont ' + c.maitres + ' maitre(s))');
  console.log('  invitations en attente: ' + c.attentes);
  console.log('  selecteur / nom       : ' + (c.selecteur ? 'visible' : 'masque')
    + ' / ' + (c.nom ? 'visible' : 'masque'));
  console.log('  inviter / note simple : ' + (c.inviter ? 'visible' : 'masque')
    + ' / ' + (c.note ? 'visible' : 'masque'));
  console.log('  lien de secours       : ' + (c.lien ? 'visible' : 'masque'));
  console.log('  ecran « aucun bureau »: ' + (c.aucun ? 'visible' : 'masque'));

  if (griefs.length) {
    throw new Error('L\'EQUIPE EST VIDE : le harnais allait photographier une piece qui ne montre rien.\n  - '
      + griefs.join('\n  - ')
      + '\n  Le decor et ses trois etats sont en bas de scripts/bureau-garni.mjs.');
  }
  return c;
}
