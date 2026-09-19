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
export async function garnirLeBureau(ctx, lignes) {
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
      resume: (document.getElementById('bureauResume') || {}).textContent || ''
    };
  });

  const griefs = [];
  if (!c.zoneVisible) griefs.push('la zone du sous-main est CACHEE : `deposeLe` n\'est pas arrive jusqu\'a sousMainUtile(), donc bdv_file_v1 n\'est pas lisible par lireMiroir()');
  if (!c.sousMain) griefs.push('AUCUNE ligne au sous-main : `signaux` / `suivi` ne sont pas lus par BdvCrm.file()');
  if (!c.punaises) griefs.push('AUCUNE punaise au panneau : bdv_taches_v1 n\'est pas une carte indexee par tache_id, ou `source` n\'est pas \'libre\'');

  console.log('\n--- LE BUREAU EST-IL GARNI ? ---');
  console.log('  punaises au panneau   : ' + c.punaises);
  console.log('  lignes au sous-main   : ' + c.sousMain);
  console.log('  zone du sous-main     : ' + (c.zoneVisible ? 'visible' : 'CACHEE'));
  console.log('  ardoise               : ' + (c.ardoiseVisible ? 'visible' : 'cachee'));
  console.log('  mot du jour           : ' + (c.mot ? c.mot + ' signes' : 'vide'));
  console.log('  resume du bandeau     : ' + (c.resume.trim() || '(vide)'));

  if (griefs.length) {
    throw new Error('BUREAU VIDE : le harnais allait photographier un bureau qui ne montre rien.\n  - '
      + griefs.join('\n  - ')
      + '\n  La forme exacte des deux cles est en tete de scripts/bureau-garni.mjs.');
  }
  return c;
}
