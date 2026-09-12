/* ==========================================================================
   LE BANC DE CAPTURE TELEPHONE, 11/09/2026
   ==========================================================================
   IL N'EST PAS DANS `npm run verif`, ET C'EST VOULU : il demande `playwright`,
   qui n'est pas une devDependency du projet. Pour le lancer :

       npm i -D playwright && npx playwright install chromium
       npm run build
       node scripts/capture-telephone.mjs

   CE QU'IL FAIT, et pourquoi aucun autre controle ne le remplace. Il sert `_site`
   en local, pose une session et une base de 286 lignes de vente dans la VRAIE
   IndexedDB, ouvre chaque piece par son vrai identifiant, et releve quatre choses
   a 390 px : ce qui pousse la page, les cibles sous 44 px, les saisies sous 16 px,
   et les valeurs aberrantes affichees.

   TROIS PIEGES PAYES EN L'ECRIVANT, et chacun rendait l'inventaire FAUX sans rien
   casser. Les relire avant d'y toucher.

   1. LE LIBELLE D'UNE PIECE N'EST PAS SON IDENTIFIANT. Premier essai avec
      'cuvees', 'cap' et 'registre', qui n'existent pas : `afficher()` retombait
      sur « Ma journee » et les sept pieces rendaient la meme hauteur. Le symptome
      se lisait « la bascule ne marche pas », alors que le banc demandait des
      pieces inexistantes. Les identifiants sont ceux de PIECES dans bdv-nav.js :
      journee, taches, calendrier, clients, produits, annee, chercher.

   2. SANS DOUBLURE DES TROIS BIBLIOTHEQUES DE CDN, aucun ecran de vente ne se
      peint. Le conteneur n'a pas de reseau, `chargerEcrans()` echoue, et on
      photographie « Ma journee » en croyant photographier « Mon commerce ».
      Un harnais qui ne charge pas ce que la page charge n'illustre qu'une
      intention. Les graphiques sont donc des cadres vides : c'est une LIMITE a
      dire, pas un defaut a corriger.

   3. TROIS FAUX POSITIFS A ECARTER, et les ecarter compte autant que de trouver
      les vrais : un banc qui crie sur du sain finit par ne plus etre lu. Les
      pastilles du mois portent `pointer-events:none` EXPRES ; le libelle d'un
      post-it porte un ::after en inset:0, donc sa cible est tout le papier ; et
      un lien dans une phrase n'a pas a faire 44 px, la norme prevoit l'exception.

   ET LA MESURE NE REMPLACE PAS LA CAPTURE. Ce banc a valide « 390 px de page pour
   390 px de fenetre, zero cible sous 44 px » sur un etat ou le nom du client
   s'ecrivait « Domaine / des / Hauts / Coteaux » sur quatre lignes. Il faut les
   deux, dans cet ordre : la mesure trouve ce qu'on ne voit pas, la capture voit ce
   qu'on ne mesure pas. Les images sortent a cote, piece-*.png et vue-*.png.
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

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1' });

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
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) erreurs.push('CONSOLE : ' + m.text()); });

await p.goto(`http://127.0.0.1:${PORT}/mon-bureau/`, { waitUntil: 'load' });
await p.waitForTimeout(1200);

/* LES IDENTIFIANTS SONT CEUX DE `PIECES` DANS bdv-nav.js, ET PAS LES LIBELLES.
   Premier essai fait avec 'cuvees', 'cap' et 'registre', qui n'existent pas :
   `afficher()` retombait sur « Ma journee » et les trois pieces rendaient la meme
   hauteur. Le symptome ressemblait a « la bascule ne marche pas », alors que
   c'etait le banc qui demandait des pieces inexistantes. Le libelle d'une piece
   n'est pas son identifiant, c'est ecrit dans CLAUDE.md, et je l'ai quand meme
   refait. */
const PIECES = [['journee','Ma journee'],['taches','Mes taches'],['calendrier','Le calendrier'],
                ['clients','Mon commerce'],['produits','Mes cuvees'],['annee','Mon cap'],['chercher','Mon registre']];
const rapport = [];
for (const [id, nom] of PIECES) {
  await p.evaluate(i => window.BdvNav && BdvNav.afficher(i), id);
  await p.waitForTimeout(1600);
  const m = await p.evaluate(() => {
    const d = document.documentElement, sortants = [], petites = [], zoome = [];
    const nomDe = el => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : '')
      + ' « ' + (el.getAttribute('placeholder') || el.textContent || '').trim().replace(/\s+/g,' ').slice(0,30) + ' »';
    const dansUnCadre = el => { let q = el.parentElement;
      while (q && q !== d) { const o = getComputedStyle(q).overflowX; if (o==='auto'||o==='scroll') return true; q = q.parentElement; } return false; };
    document.querySelectorAll('body *').forEach(el => {
      const b = el.getBoundingClientRect(); if (!b.width || !b.height) return;
      if (b.right > d.clientWidth + 1 && !dansUnCadre(el)) sortants.push(nomDe(el) + ' -> ' + Math.round(b.right));
    });
    document.querySelectorAll('a,button,select,input:not([type=checkbox]),.chip,.chipc,.cal__coche,label.chk,summary').forEach(el => {
      const b = el.getBoundingClientRect(); if (!b.width || !b.height) return;
      if (el.closest('[hidden]') || getComputedStyle(el).display === 'none') return;
      // DEUX FAUX POSITIFS A ECARTER, et les ecarter est aussi important que de
      // trouver les vrais : un banc qui crie sur du sain finit par ne plus etre lu.
      // 1. Un element qui ne recoit pas les clics n'est pas une cible. Les pastilles
      //    du mois portent `pointer-events:none` EXPRES, pour qu'un pouce qui vise la
      //    case ne coche pas une DRM a 6 px.
      if (getComputedStyle(el).pointerEvents === 'none') return;
      // 2. Le libelle d'un post-it porte un ::after en `position:absolute; inset:0` :
      //    la vraie cible est tout le papier, pas les 18 px du texte.
      if (el.classList.contains('postit__lien')) return;
      // 3. Un lien DANS UNE PHRASE n'a pas a faire 44 px : le grossir casserait
      //    l'interligne du paragraphe, et la norme prevoit elle-meme l'exception
      //    pour une cible en ligne dans du texte. « Voir la cuvee » est de ceux-la.
      if (el.tagName === 'A' && el.parentElement && getComputedStyle(el).display === 'inline'
          && el.parentElement.textContent.trim().length > el.textContent.trim().length + 20) return;
      if (b.height < 43.5) petites.push(nomDe(el) + ' h=' + b.height.toFixed(0));
    });
    document.querySelectorAll('input:not([type=checkbox]),textarea,select').forEach(el => {
      const b = el.getBoundingClientRect(); if (!b.width) return;
      const f = parseFloat(getComputedStyle(el).fontSize); if (f < 16) zoome.push(nomDe(el) + ' ' + f.toFixed(1) + 'px');
    });
    return { page: d.scrollWidth, vue: d.clientWidth, haut: d.scrollHeight,
      sortants: [...new Set(sortants)].slice(0,8), petites: [...new Set(petites)].slice(0,8), zoome: [...new Set(zoome)].slice(0,8) };
  });
  rapport.push([nom, m]);
  await p.screenshot({ path: `piece-${id}.png`, fullPage: true });
}

// LA FICHE CLIENT, ouverte comme le vigneron l'ouvre : depuis le sous-main.
await p.evaluate(() => window.BdvNav && BdvNav.afficher('journee'));
await p.waitForTimeout(800);
const ficheOk = await p.evaluate(() => !!(window.bdvOuvrirFiche && (window.bdvOuvrirFiche('C0412','suivi','appel'), true)));
await p.waitForTimeout(2500);
const mf = await p.evaluate(() => {
  const m = document.getElementById('modale');
  if (!m || !m.classList.contains('on')) return { ouverte: false };
  const d = document.documentElement, petites = [], zoome = [];
  const nomDe = el => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : '')
    + ' « ' + (el.getAttribute('placeholder') || el.textContent || '').trim().replace(/\s+/g,' ').slice(0,30) + ' »';
  m.querySelectorAll('a,button,select,input:not([type=checkbox]),textarea,.chipc,summary').forEach(el => {
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) return;
    if (b.height < 43.5) petites.push(nomDe(el) + ' h=' + b.height.toFixed(0));
  });
  m.querySelectorAll('input:not([type=checkbox]),textarea,select').forEach(el => {
    const f = parseFloat(getComputedStyle(el).fontSize); if (f < 16) zoome.push(nomDe(el) + ' ' + f.toFixed(1) + 'px');
  });
  const tel = [...m.querySelectorAll('a[href^="tel:"]')].map(a => a.getAttribute('href') + '  affiche « ' + a.textContent.trim() + ' »');
  return { ouverte: true, boite: m.querySelector('.modale__box').getBoundingClientRect().height,
    page: d.scrollWidth, vue: d.clientWidth, petites: [...new Set(petites)], zoome: [...new Set(zoome)], tel };
});
await p.screenshot({ path: 'piece-fiche.png', fullPage: true });

/* UN CHIFFRE QUI N'EN EST PAS UN. `NaN`, `Infinity` et `undefined` affiches sont
   pires qu'une case vide : la regle du depot dit qu'un chiffre affiche doit dire
   d'ou il vient, et une case vide vaut mieux qu'une valeur inventee. Un banc de
   mise en page ne les cherche pas, alors qu'il a la page sous les yeux. */
const suspects = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.children.length) return;
    const t = (el.textContent || '').trim();
    if (/\bNaN\b|\bInfinity\b|\bundefined\b|\[object /.test(t))
      out.push((el.className || el.tagName) + ' « ' + t.replace(/\s+/g,' ').slice(0,70) + ' »');
  });
  return [...new Set(out)];
});
console.log('\n--- CHIFFRES QUI N EN SONT PAS ---\n  ' + (suspects.join('\n  ') || 'aucun'));

/* COMBIEN DE PIXELS AVANT LE PREMIER CHIFFRE. Une page qui ne deborde pas et
   dont toutes les cibles font 44 px peut quand meme etre mauvaise : si le haut de
   chaque piece est occupe par du decor et des boutons, le vigneron ouvre son
   bureau et ne voit rien de ce qu'il vient chercher. Sur 844 px de hauteur utile,
   c'est la seule mesure qui dit si la piece REPOND avant qu'on fasse defiler. */
const avant = await p.evaluate(() => {
  const r = [];
  for (const id of ['journee','taches','calendrier','clients','produits','annee','chercher']) {
    if (window.BdvNav) BdvNav.afficher(id);
    const tete = document.querySelector('.bureau-tete');
    const at = tete ? tete.getBoundingClientRect().height : 0;
    r.push([id, Math.round(at)]);
  }
  return r;
});
const zones = await p.evaluate(() => {
  const h = el => el ? Math.round(el.getBoundingClientRect().height) : 0;
  return { tete: h(document.querySelector('.bureau-tete')),
           barre: h(document.querySelector('.bureau-nav')),
           outils: h(document.querySelector('.bdv-ventes .toolbar, #bureauVentes .toolbar')) };
});
console.log('\n--- COMBIEN DE HAUT AVANT LE CONTENU (fenetre de 844 px) ---');
console.log('  en-tete du bureau : ' + zones.tete + ' px, soit ' + Math.round(zones.tete/844*100) + ' % du premier ecran');
console.log('  barre des pieces  : ' + zones.barre + ' px en bas, fixe');
console.log('  il reste donc     : ' + (844 - zones.tete - zones.barre) + ' px de contenu visible sans defiler');

// La VUE REELLE, sans fullPage : une capture longue ne montre pas ou tombe la barre fixe.
for (const id of ['journee','clients','annee']) {
  await p.evaluate(i => { const m = document.getElementById('modale'); if (m) m.classList.remove('on'); BdvNav.afficher(i); }, id);
  await p.waitForTimeout(1300);
  await p.evaluate(() => window.scrollTo(0,0));
  await p.screenshot({ path: `vue-${id}.png` });
}

console.log('\n================= LE VRAI BUREAU, 390 px, VRAI MOTEUR =================');
console.log('lignes de vente en base :', LIGNES.length);
for (const [nom, m] of rapport) {
  console.log('\n--- ' + nom + ' ---  page ' + m.page + '/' + m.vue + (m.page <= m.vue + 1 ? ' OK' : '  DEBORDE') + ', hauteur ' + m.haut);
  if (m.sortants.length) console.log('  SORT DU CADRE :\n    ' + m.sortants.join('\n    '));
  if (m.petites.length)  console.log('  CIBLES < 44 px :\n    ' + m.petites.join('\n    '));
  if (m.zoome.length)    console.log('  SAISIES < 16 px :\n    ' + m.zoome.join('\n    '));
  if (!m.sortants.length && !m.petites.length && !m.zoome.length) console.log('  rien a signaler');
}
console.log('\n--- LA FICHE CLIENT ---  ouverte :', mf.ouverte);
if (mf.ouverte) {
  console.log('  hauteur de la boite :', Math.round(mf.boite), 'px pour une fenetre de 844');
  console.log('  liens tel: :\n    ' + (mf.tel.join('\n    ') || 'aucun'));
  if (mf.petites.length) console.log('  CIBLES < 44 px :\n    ' + mf.petites.join('\n    ')); else console.log('  cibles : toutes a 44 px ou plus');
  if (mf.zoome.length)  console.log('  SAISIES < 16 px :\n    ' + mf.zoome.join('\n    ')); else console.log('  saisies : toutes a 16 px ou plus');
}
console.log('\n--- ERREURS JAVASCRIPT ---\n  ' + (erreurs.length ? erreurs.join('\n  ') : 'aucune'));
await nav.close(); srv.close();
