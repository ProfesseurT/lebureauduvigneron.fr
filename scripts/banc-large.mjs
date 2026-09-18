/* ==========================================================================
   LE BANC DE LARGEUR, 18/09/2026
   ==========================================================================
   IL N'EST PAS DANS `npm run verif`, comme capture-telephone.mjs et pour la
   meme raison : il demande `playwright`, qui n'est pas une dependance du
   projet. Pour le lancer :

       npm i -D playwright && npx playwright install chromium
       npm run build && cp -r _site site
       node scripts/banc-large.mjs

   POURQUOI 1440 x 900 ET PAS AUTRE CHOSE. C'est l'ecran de Ted, releve dans son
   navigateur le 18/09/2026 (screen.width 1440, screen.height 900, dpr 2). Un
   audit d'occupation de l'espace fait a une autre largeur ne mesure pas le
   bureau qu'il regarde. Si l'ecran change, cette constante change avec lui, et
   la note du JOURNAL le dit.

   CE QU'IL MESURE, et qu'aucun autre controle du depot ne mesure : l'OCCUPATION.
   Pour chaque piece, la hauteur de l'entete du site, la hauteur du bandeau du
   bureau, la largeur de la barre des pieces, la largeur de la colonne de
   travail, et le blanc reellement perdu a gauche et a droite. Le blanc est
   calcule sur le contenu qui PORTE quelque chose (un fond, une bordure ou du
   texte), pas sur les boites vides qui s'etendent sans rien montrer : c'est la
   difference entre « la page fait 1440 » et « la page se sert de 1440 ».

   DEUX PIEGES PAYES EN L'ECRIVANT :

   1. LA MODALE « On raccorde ton bureau » COUVRE LE BUREAU hors ligne, et les
      sept pieces rendent alors la meme hauteur, celle de la page bloquee. Le
      banc prend la sortie que le vigneron prendrait, « Ouvrir quand meme ».
      Sans ce clic, il photographie une modale en croyant photographier un
      bureau.
   2. LES LIGNES DE VENTE NE SE CHARGENT PAS dans ce montage : l'entete annonce
      « 286 lignes » et les blocs disent « pas encore chargees ». La mise en
      page des pieces de vente n'est donc PAS mesurable ici, c'est une LIMITE a
      dire, pas un defaut a corriger. Les pieces du bureau, elles, le sont.
   ========================================================================== */
import { chromium } from 'playwright';
import { servir } from './capture-serveur.mjs';
import fs from 'node:fs';

const PORT = 8199;
const srv = await servir('./site', PORT);

/* ---------------------------------------------------------------------------
   LA BASE FABRIQUEE. On ecrit dans la VRAIE IndexedDB, avec la VRAIE forme de
   ligne ({h, raw:[43 chaines]}) et le vrai ordre de COLS, avant que la page
   charge : c'est `reloadFromDB()` du vrai moteur qui la relira.
--------------------------------------------------------------------------- */
const CLIENTS = [
  ['Domaine des Hauts Coteaux et Fils','C0412','contact@hauts-coteaux.fr','04 94 12 34 56','06 12 34 56 78, 06 98 76 54 32'],
  ['Cave du Vieux Pressoir','C0288','commande@vieux-pressoir-de-bourgogne.fr','','(+33) 6 11 22 33 44'],
  ['La Cave Saint-Vincent','C0155','cave.saint.vincent@orange.fr','04 75 01 02 03 poste 12',''],
  ['Vins & Terroirs Export','C0901','export@vins-terroirs.be','','0475 12 34 56'],
  ['Le Comptoir des Vignes','C0733','lecomptoir@gmail.com','','06 55 44 33 22'],
];
const CUVEES = [['Le Rosé','2024','Rosé'],['Le Rosé','2025','Rosé'],['Cuvée Les Terrasses','2021','Rouge'],['Blanc de Blancs','2023','Blanc']];
const CANAUX = ['Caveau','Cavistes','Export','Salon'];

function lignes(){
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
const LIGNES = lignes();

const AUJ = new Date();
const jour = k => { const d = new Date(AUJ); d.setDate(d.getDate()+k);
  return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); };


/* ---------------------------------------------------------------------------
   LE BANC DE LARGEUR, 18/09/2026. Meme montage que capture-telephone.mjs, mais
   a 1440 x 900 : l'ECRAN DE TED, releve dans son navigateur (screen 1440x900,
   dpr 2). Il ne cherche pas des cibles trop petites, il mesure L'OCCUPATION :
   combien de pixels de la fenetre portent quelque chose, et combien sont du
   blanc.
--------------------------------------------------------------------------- */
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

await ctx.addInitScript(({ lignes, jour0, jour3, jourM5 }) => {
  const H = 3600;
  localStorage.setItem('bdv_session', JSON.stringify({
    access_token: 'faux', refresh_token: 'faux',
    expires_at: Math.floor(Date.now()/1000) + H, user: { id: 'moi', email: 'ted@exemple.fr' } }));
  localStorage.setItem('bdv_proprietaire', 'moi');
  localStorage.setItem('bureau_prenom', 'Teddy');
  // Le miroir de bdv-crm.js : c'est LUI que le sous-main et l'ardoise lisent.
  localStorage.setItem('bdv_file_v1', JSON.stringify({ le: Date.now(), etat: {
    deposeLe: new Date().toISOString(),
    resume: { ca: 1064403, lignes: lignes.length, clients: 5, dernier: jour0 },
    noms: { C0412:'Domaine des Hauts Coteaux et Fils', C0288:'Cave du Vieux Pressoir', C0155:'La Cave Saint-Vincent' },
    signaux: [
      { id:'C0412', nom:'Domaine des Hauts Coteaux et Fils', motif:'recul', ca:14280 },
      { id:'C0288', nom:'Cave du Vieux Pressoir', motif:'cadence', ca:9140 },
      { id:'C0155', nom:'La Cave Saint-Vincent', motif:'premier', ca:2310 } ],
    suivis: [
      { id:'C0412', nom:'Domaine des Hauts Coteaux et Fils', rappel: jourM5, rappel_titre:'Il voulait un devis pour le salon', statut:'relance' },
      { id:'C0288', nom:'Cave du Vieux Pressoir', rappel: jour0, statut:'afaire' },
      { id:'C0155', nom:'La Cave Saint-Vincent', rappel: jour3, statut:'relance' } ] } }));
  localStorage.setItem('bdv_taches_v1', JSON.stringify({ le: Date.now(), etat: [
    { tache_id:'t1', titre:'Commander des bouchons pour la mise', echue_le: jourM5, fait_le:null },
    { tache_id:'t2', titre:'Rappeler le courtier', echue_le: jour0, fait_le:null },
    { tache_id:'t3', titre:'Salon des vins de Loire', echue_le: jour3, fin_le:null, fait_le:null },
    { tache_id:'t4', titre:'Changer le filtre de la pompe', echue_le:null, fait_le:null } ] }));

  const dq = indexedDB.open('bdv_ventes_v4', 2);
  dq.onupgradeneeded = e => { const db = e.target.result;
    if (!db.objectStoreNames.contains('lignes')) db.createObjectStore('lignes', { keyPath:'h' });
    if (!db.objectStoreNames.contains('reglages')) db.createObjectStore('reglages'); };
  dq.onsuccess = e => { const db = e.target.result;
    const tx = db.transaction('lignes','readwrite'), st = tx.objectStore('lignes');
    lignes.forEach(l => st.put(l)); };
}, { lignes: LIGNES, jour0: jour(0), jour3: jour(3), jourM5: jour(-5) });

/* LES TROIS BIBLIOTHEQUES DE CDN. Le conteneur n'a pas de reseau : sans ces
   doublures, `chargerEcrans()` echoue et AUCUN ecran de vente ne se peint. C'est
   exactement ce qui s'est passe au premier essai, et le symptome etait trompeur :
   les sept pieces rendaient la meme hauteur, celle de « Ma journee », comme si la
   bascule n'avait pas eu lieu. Un harnais qui ne charge pas ce que la page charge
   n'illustre qu'une intention. */
await ctx.route('**/papaparse.min.js', r => r.fulfill({ contentType:'text/javascript', body:'window.Papa={parse:function(){return{data:[]}}};' }));
await ctx.route('**/xlsx.full.min.js', r => r.fulfill({ contentType:'text/javascript', body:'window.XLSX={utils:{book_new:function(){return{}},json_to_sheet:function(){return{}},book_append_sheet:function(){}},writeFile:function(){}};' }));
await ctx.route('**/chart.umd.min.js', r => r.fulfill({ contentType:'text/javascript', body:`
  // Doublure de Chart.js : elle occupe la place et ne dessine rien. Les graphiques
  // sont donc des cadres vides sur les captures, et c'est une LIMITE a dire, pas un defaut.
  window.Chart = function(ctx){ this.destroy=function(){}; this.update=function(){}; this.resize=function(){};
    try{ var c=ctx&&ctx.canvas?ctx.canvas:ctx; if(c&&c.getContext){ c.height=180; var g=c.getContext('2d');
      g.fillStyle='#EFE7D6'; g.fillRect(0,0,c.width,c.height); g.fillStyle='#8A8478'; g.font='12px sans-serif';
      g.fillText('(graphique, non trace hors ligne)',10,24);} }catch(e){} };
  window.Chart.register=function(){}; window.Chart.defaults={font:{},plugins:{legend:{}}};
` }));
const p = await ctx.newPage();
const erreurs = [];
p.on('pageerror', e => erreurs.push('ERREUR JS : ' + e.message));
await p.goto(`http://127.0.0.1:${PORT}/mon-bureau/`, { waitUntil: 'load' });
await p.waitForTimeout(1500);
/* LA MODALE « On raccorde ton bureau » : hors ligne, elle couvre le bureau. On
   prend la sortie que le vigneron prendrait, « Ouvrir quand meme ». */
try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 4000 }); } catch(e) { console.log('(pas de modale de raccord)'); }
await p.waitForTimeout(1200);

const PIECES = [['journee','Ma journee'],['taches','Mes taches'],['calendrier','Le calendrier'],
                ['clients','Mon commerce'],['produits','Mes cuvees'],['annee','Mon cap'],['chercher','Mon registre']];
const rapport = [];
for (const [id, nom] of PIECES) {
  await p.evaluate(i => window.BdvNav && BdvNav.afficher(i), id);
  await p.waitForTimeout(1800);
  const m = await p.evaluate(() => {
    const R = s => { const e = document.querySelector(s); if (!e) return null;
      const b = e.getBoundingClientRect(); return { x: Math.round(b.x), w: Math.round(b.width), h: Math.round(b.height) }; };
    const V = document.documentElement.clientWidth;
    /* L'OCCUPATION REELLE : pour chaque bande de 10 px de large, le contenu
       visible le plus a droite. On prend le max sur toute la hauteur visible. */
    let droite = 0, gauche = V;
    document.querySelectorAll('main *, .bureau-atelier *, .bureau-tete *').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2 || b.top > 2000) return;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none') return;
      const aDuFond = st.backgroundColor !== 'rgba(0, 0, 0, 0)' || st.borderTopWidth !== '0px';
      const aDuTexte = el.children.length === 0 && (el.textContent || '').trim().length > 0;
      if (!aDuFond && !aDuTexte) return;
      if (b.right > droite) droite = b.right;
      if (b.left < gauche && b.left >= 0) gauche = b.left;
    });
    return {
      vue: V, hautPage: document.documentElement.scrollHeight,
      contenuDe: Math.round(gauche), contenuA: Math.round(droite),
      blancDroite: Math.round(V - droite), blancGauche: Math.round(gauche),
      entete: R('.nav') || R('header'), tete: R('.bureau-tete'),
      atelier: R('.bureau-atelier'), barre: R('.bureau-nav'), travail: R('.bureau-atelier__travail'),
    };
  });
  rapport.push([nom, m]);
  await p.screenshot({ path: `large-${id}.png` });
}
console.log(JSON.stringify(rapport, null, 1));
if (erreurs.length) console.log('ERREURS :', erreurs.slice(0, 5));
await nav.close(); srv.close();
