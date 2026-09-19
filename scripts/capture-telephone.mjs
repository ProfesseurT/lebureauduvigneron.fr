/* ==========================================================================
   LE BANC DE CAPTURE TELEPHONE, 11/09/2026
   ==========================================================================
   IL N'EST PAS DANS `npm run verif`, ET C'EST VOULU : il demande `playwright`,
   qui n'est pas une devDependency du projet. Pour le lancer :

       npm i -D playwright && npx playwright install chromium
       npm run build && cp -r _site site
       npm run capture:telephone

   LE `cp -r _site site` N'EST PAS UN ORNEMENT : ce harnais sert `./site`, pas
   `_site`. La ligne manquait dans cet entete, et le harnais servait alors un
   dossier vide, ou pire, la construction de l'avant-veille. Corrige le
   19/09/2026, en meme temps que son entree dans package.json.

   SON DECOR VIT DANS scripts/bureau-garni.mjs, avec banc-large.mjs.

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
/* LE DECOR EST COMMUN AUX DEUX HARNAIS, 19/09/2026. Il etait copie mot pour mot
   dans banc-large.mjs et capture-telephone.mjs, defaut compris : les deux cles de
   stockage local y etaient ecrites sous une enveloppe que le code ne sait pas
   relire, et les deux harnais photographiaient un bureau sans sous-main, sans
   ardoise et sans une punaise. Un seul exemplaire, donc, et il ne peut plus
   diverger. La forme exacte des deux cles est en tete de scripts/bureau-garni.mjs.
   Ne pas remettre un decor local ici. */
import { lignesDeVente, garnirLeBureau, doublerLesBibliotheques,
         verifierLeBureauGarni } from './bureau-garni.mjs';
import fs from 'node:fs';

const PORT = 8199;
const srv = await servir('./site', PORT);

/* LA BASE FABRIQUEE, 286 lignes dans la VRAIE IndexedDB avec la vraie forme de
   ligne ({h, raw:[43 chaines]}) : c'est `reloadFromDB()` du vrai moteur qui la
   relira. Le detail vit dans scripts/bureau-garni.mjs. */
const LIGNES = lignesDeVente();

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1' });

await garnirLeBureau(ctx, LIGNES);

/* Les trois doublures de CDN. Sans elles, `chargerEcrans()` echoue et aucun ecran
   de vente ne se peint : les sept pieces rendent la meme hauteur et le harnais
   photographie une piece en croyant en photographier une autre. */
await doublerLesBibliotheques(ctx);

const p = await ctx.newPage();
const erreurs = [];
p.on('pageerror', e => erreurs.push('ERREUR JS : ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) erreurs.push('CONSOLE : ' + m.text()); });

await p.goto(`http://127.0.0.1:${PORT}/mon-bureau/`, { waitUntil: 'load' });
await p.waitForTimeout(1200);

/* ==========================================================================
   ON COMPTE LE BUREAU AVANT DE LE PHOTOGRAPHIER, 19/09/2026
   ==========================================================================
   CE HARNAIS A DEJA MENTI, et sans rien casser : les deux cles de stockage
   local etaient ecrites sous une enveloppe `{le, etat}` que ni `lireMiroir()`
   ni `lireCache()` ne savent relire. Aucune erreur JavaScript, des captures
   nettes, et un bureau SANS sous-main, SANS ardoise, SANS mot du jour et SANS
   une seule punaise. La mise en page validee ici n'etait celle de personne.

   La correction de forme ne suffit pas : elle se re-cassera au prochain
   renommage de champ, en silence, exactement de la meme facon. Ce qui garde,
   c'est de COMPTER ce que le decor doit produire a l'ecran et de s'arreter a
   zero. Un rapport faux vaut moins que pas de rapport.
   ========================================================================== */
await p.evaluate(() => window.BdvNav && BdvNav.afficher('journee'));
await p.waitForTimeout(1200);
try {
  await verifierLeBureauGarni(p);
} catch (e) {
  console.error('\n' + e.message + '\n');
  await nav.close(); srv.close();
  process.exit(1);
}

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
      // 2 bis. MEME CAS, 15/09/2026 : le titre d'une occurrence du calendrier
      //    porte un ::after en `inset` etendu de 11 px au-dessus et en dessous,
      //    parce qu'un `min-height` ici ajouterait 22 px a chacune des quarante
      //    cartes de la piece. Sa vraie cible fait 44 px, pas les 22 du texte.
      //    Voir le bloc de tete de bdv-calendrier.css.
      if (el.classList.contains('echeance__ouvrir')) return;
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
  /* NI SCRIPT NI STYLE, 19/09/2026 : le code source inline d'un <script> contient
     le mot `undefined` comme n'importe quel programme, et le scanner sortait donc
     une fausse alerte a CHAQUE passage. Une alerte permanente cesse d'etre lue, et
     le jour ou un vrai `undefined` s'affichera, il se perdra dans le bruit. */
  document.querySelectorAll('body *').forEach(el => {
    if (/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(el.tagName)) return;
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

/* ==========================================================================
   LA PLACE PERDUE, AJOUTE LE 15/09/2026
   ==========================================================================
   Ted, apres ses essais sur telephone : « y'a pas mal de place perdue quand
   t'es en iPhone ». Tout ce qui precede mesure ce qui DEBORDE. Rien ne mesurait
   ce qui est PERDU, et ce n'est pas la meme chose : une page peut tenir dans
   390 px en n'en donnant que 190 au texte, et ce banc disait OK.

   ON COMPTE LA CHAINE, PAS UNE MARGE ISOLEE. Pour l'element de texte le plus
   profond de chaque piece, on remonte jusqu'au corps de page en additionnant, a
   chaque etage, remplissage + bordure + marge des DEUX cotes. La somme est la
   largeur que le vigneron ne lit pas, et la chaine imprimee dit QUI la prend.
   C'est ce releve qui a montre que personne n'etait coupable tout seul : quatre
   etages de 20 a 50 px, aucun aberrant, 198 px au total sur « Mon cap ».
   ========================================================================== */
console.log('\n================= LA PLACE PERDUE A 390 PX =================');
for (const [id, nom] of PIECES) {
  await p.evaluate(i => window.BdvNav && BdvNav.afficher(i), id);
  await p.waitForTimeout(1400);
  const m = await p.evaluate(() => {
    const W = document.documentElement.clientWidth;
    let cible = null, best = -1;
    document.querySelectorAll('.bureau-atelier__travail *').forEach(el => {
      if (el.children.length) return;
      const t = (el.textContent||'').trim(); if (t.length < 12) return;
      const b = el.getBoundingClientRect(); if (b.width < 20 || b.height < 8) return;
      let prof = 0, q = el; while (q) { prof++; q = q.parentElement; }
      if (prof > best) { best = prof; cible = el; }
    });
    if (!cible) return null;
    const chaine = []; let total = 0, q = cible;
    while (q && q.tagName !== 'HTML') {
      const s = getComputedStyle(q);
      const c = ['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth','marginLeft','marginRight']
        .reduce((a,k) => a + (parseFloat(s[k]) || 0), 0);
      if (c >= 1) {
        chaine.push(q.tagName.toLowerCase()
          + (typeof q.className === 'string' && q.className ? '.' + q.className.trim().split(/\s+/)[0] : '')
          + ' ' + Math.round(c));
        total += c;
      }
      q = q.parentElement;
    }
    return { W, texte: Math.round(cible.getBoundingClientRect().width),
             mot: (cible.textContent||'').trim().replace(/\s+/g,' ').slice(0,28),
             perdu: Math.round(total), chaine };
  });
  if (!m) { console.log('\n--- ' + nom + ' --- rien de mesurable'); continue; }
  console.log('\n--- ' + nom + ' ---');
  console.log('  texte le plus profond : ' + m.texte + ' px de large sur ' + m.W + '  (« ' + m.mot + ' »)');
  console.log('  cadre avale           : ' + m.perdu + ' px, soit ' + Math.round(m.perdu / m.W * 100) + ' %');
  console.log('  la chaine             : ' + m.chaine.join('  |  '));
}

await nav.close(); srv.close();
