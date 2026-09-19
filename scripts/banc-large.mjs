/* ==========================================================================
   LE BANC DE LARGEUR, 18/09/2026
   ==========================================================================
   IL N'EST PAS DANS `npm run verif`, comme capture-telephone.mjs et pour la
   meme raison : il demande `playwright`, qui n'est pas une dependance du
   projet. Pour le lancer :

       npm i -D playwright && npx playwright install chromium
       npm run build && cp -r _site site
       npm run banc:large

   IL A UNE ENTREE DANS package.json DEPUIS LE 19/09/2026, et il reste hors de
   `npm run verif`. Les deux vont ensemble : sortir de `verif` un banc qui
   demande une dependance absente est une decision ; le rendre introuvable sans
   connaitre son chemin n'en est pas une, c'est un oubli qui se paye en outil
   qu'on n'utilise plus.

   SON DECOR VIT DANS scripts/bureau-garni.mjs, avec capture-telephone.mjs.

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


/* ---------------------------------------------------------------------------
   LE BANC DE LARGEUR, 18/09/2026. Meme montage que capture-telephone.mjs, mais
   a 1440 x 900 : l'ECRAN DE TED, releve dans son navigateur (screen 1440x900,
   dpr 2). Il ne cherche pas des cibles trop petites, il mesure L'OCCUPATION :
   combien de pixels de la fenetre portent quelque chose, et combien sont du
   blanc.
--------------------------------------------------------------------------- */
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

await garnirLeBureau(ctx, LIGNES);

/* Les trois doublures de CDN. Sans elles, `chargerEcrans()` echoue et aucun ecran
   de vente ne se peint : les sept pieces rendent la meme hauteur et le harnais
   photographie une piece en croyant en photographier une autre. */
await doublerLesBibliotheques(ctx);
const p = await ctx.newPage();
const erreurs = [];
p.on('pageerror', e => erreurs.push('ERREUR JS : ' + e.message));
await p.goto(`http://127.0.0.1:${PORT}/mon-bureau/`, { waitUntil: 'load' });
await p.waitForTimeout(1500);
/* LA MODALE « On raccorde ton bureau » : hors ligne, elle couvre le bureau. On
   prend la sortie que le vigneron prendrait, « Ouvrir quand meme ». */
try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 4000 }); } catch(e) { console.log('(pas de modale de raccord)'); }
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
