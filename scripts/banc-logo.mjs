/* ============================================================================
   BANC DU LOGO DU DOMAINE, lot 69, 06/10/2026
   ============================================================================
   Ce qu'il garde :
   - la BASE fait foi : un appareil neuf relit le logo ; l'image ne redescend que si
     son empreinte a change (copie de confort `bdv_logo_v1`) ;
   - seul le maitre voit les gestes ; un simple utilisateur lit « Seul le maitre » ;
   - un SVG est refuse avant d'aller en base ; un refus de la base se dit ;
   - la pastille se pose en bas de la barre, avant le bouton de repli, et part si le
     logo est retire ;
   - le devis n'imprime QUE une adresse data: PNG/JPEG, et un devis sans logo sort a
     l'octet pres comme avant ;
   - la page de signature reprend le logo DE LA COPIE, jamais d'ailleurs ;
   - le depot du logo ne marque pas la fiche du domaine comme modifiee.
   La reduction par canvas ne se joue pas ici (jsdom n'a pas de canvas) : elle se voit
   a la capture.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
let ok = 0, ko = 0;
const dit = (b, m, det) => { if (b) { ok++; console.log('  ok    : ' + m); } else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + det : '')); } };
const pause = (n) => new Promise(r => setTimeout(r, n || 30));
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

const B = 'b0000000-0000-0000-0000-000000000001';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const PNG2 = PNG.replace('YII=', 'YIA=');

function monterPage(base, maitre, cache) {
  const dom = new JSDOM('<!doctype html><body><nav id="bureauNav"><ul class="bureau-nav__liste"></ul><button id="bureauNavReplier"></button></nav><div id="hote"></div></body>',
    { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window;
  if (cache) w.localStorage.setItem('bdv_logo_v1', JSON.stringify(cache));
  const appels = [];
  w.BdvCompte = {
    monBureau: () => B,
    api: (chemin, o) => {
      appels.push({ chemin, o });
      if (chemin === '/rpc/est_maitre') return Promise.resolve(maitre);
      if (chemin === '/rpc/domaine_logo_poser') {
        if (!maitre) { const e = new Error('refus'); e.status = 403; e.detail = '42501'; return Promise.reject(e); }
        base.ligne = { image: o.corps.p_image, empreinte: 'e-' + o.corps.p_image.length, largeur: o.corps.p_largeur, hauteur: o.corps.p_hauteur };
        return Promise.resolve([{ empreinte: base.ligne.empreinte, largeur: 1, hauteur: 1 }]);
      }
      if (chemin === '/rpc/domaine_logo_retirer') { base.ligne = null; return Promise.resolve(true); }
      if (chemin.indexOf('/domaine_logo?select=empreinte') === 0) {
        if (base.absente) { const e = new Error('404'); e.status = 404; return Promise.reject(e); }
        return Promise.resolve(base.ligne ? [{ empreinte: base.ligne.empreinte, largeur: 1, hauteur: 1 }] : []);
      }
      if (chemin.indexOf('/domaine_logo?select=image') === 0) return Promise.resolve(base.ligne ? [{ image: base.ligne.image }] : []);
      return Promise.resolve([]);
    }
  };
  const s = w.document.createElement('script');
  s.textContent = lire('src/js/bdv-logo.js');
  w.document.body.appendChild(s);
  return { w, appels };
}

console.log('\n== 1. La base fait foi, la copie evite de retelecharger ==');
{
  const base = { ligne: { image: PNG, empreinte: 'E1' } };
  const { w, appels } = monterPage(base, true, null);
  await w.BdvLogo.pret(); await pause();
  dit(w.BdvLogo.image() === PNG, 'un appareil neuf (sans copie) relit le logo dans la base');
  dit(appels.some(a => a.chemin.indexOf('select=image') > 0), 'il telecharge l\'image une fois');
  const c = JSON.parse(w.localStorage.getItem('bdv_logo_v1'));
  dit(c && c.empreinte === 'E1' && c.bureau === B, 'la copie de confort est posee, avec le bureau et l\'empreinte');
  const pastille = w.document.querySelector('#bureauNav .bureau-nav__logo');
  dit(!!pastille && !pastille.hidden && pastille.nextElementSibling && pastille.nextElementSibling.id === 'bureauNavReplier',
    'la pastille se pose en bas de la barre, juste avant le bouton de repli');
  dit(pastille && pastille.querySelector('img').getAttribute('alt') === '', 'le logo de la barre est un decor (alt vide)');
}
{
  const base = { ligne: { image: PNG, empreinte: 'E1' } };
  const { w, appels } = monterPage(base, true, { bureau: B, empreinte: 'E1', image: PNG });
  await w.BdvLogo.pret(); await pause();
  dit(!appels.some(a => a.chemin.indexOf('select=image') > 0), 'meme empreinte : l\'image ne redescend pas');
}
{
  const base = { ligne: { image: PNG2, empreinte: 'E2' } };
  const { w } = monterPage(base, true, { bureau: B, empreinte: 'E1', image: PNG });
  await w.BdvLogo.pret(); await pause();
  dit(w.BdvLogo.image() === PNG2, 'empreinte changee (un collegue a change le logo) : la nouvelle image remplace la copie');
}
{
  const base = { ligne: null };
  const { w } = monterPage(base, true, { bureau: B, empreinte: 'E1', image: PNG });
  await w.BdvLogo.pret(); await pause();
  dit(w.BdvLogo.image() === null && w.localStorage.getItem('bdv_logo_v1') === null, 'logo retire ailleurs : la copie de l\'appareil part aussi');
  const p = w.document.querySelector('#bureauNav .bureau-nav__logo');
  dit(!p || p.hidden, 'et la pastille se cache');
}
{
  const base = { absente: true };
  const { w } = monterPage(base, true, { bureau: 'autre-bureau', empreinte: 'E1', image: PNG });
  await w.BdvLogo.pret(); await pause();
  dit(w.BdvLogo.image() === null, 'la copie d\'un AUTRE bureau n\'est jamais montree, meme base injoignable');
}
{
  const page = lire('src/js/bdv-logo.js');
  dit(/if \(document\.readyState === 'complete'\) demarrer\(\);\n  else document\.addEventListener\('DOMContentLoaded', demarrer\);/.test(page),
    'la pastille attend DOMContentLoaded : sinon la barre, montee apres, l\'efface');
}
{
  const base = { absente: true };
  const { w } = monterPage(base, true, null);
  await w.BdvLogo.pret(); await pause();
  dit(w.BdvLogo.image() === null, 'table absente (SQL pas passe) : pas de logo, rien ne casse');
}

console.log('\n== 2. Le bloc des reglages ==');
{
  const base = { ligne: null };
  const { w, appels } = monterPage(base, true, null);
  const hote = w.document.getElementById('hote');
  w.BdvLogo.monter(hote); await w.BdvLogo.rafraichir();
  dit(/Ton logo/.test(hote.textContent), 'le bloc a son titre');
  const li = [...hote.querySelectorAll('.bdvl-conditions li')].map(x => x.textContent);
  dit(li.length === 4 && /^Format : PNG ou JPEG/.test(li[0]) && /15 Mo au plus/.test(li[1]) && /240 px/.test(li[2]) && /600 px/.test(li[2]),
    'les conditions sont affichees : format, poids, taille, ideal', li.join(' | '));
  const gestes = hote.querySelector('.bdvl-gestes');
  dit(gestes && !gestes.hidden && /Choisir mon logo/.test(hote.querySelector('.bdvl-choisir').textContent), 'le maitre voit « Choisir mon logo »');
  dit(hote.querySelector('#bdvlFichier').getAttribute('accept') === 'image/png,image/jpeg', 'le champ demande PNG ou JPEG (Safari convertit les photos d\'iPhone)');
  dit(hote.querySelector('.bdvl-gestes .bdvr-btn--creux').hidden, 'sans logo, pas de « Retirer le logo »');
  dit(!hote.querySelector('.bdvl-apercu').hidden === false, 'sans logo, pas d\'apercu vide');
  /* Un SVG est refuse AVANT la base. */
  const f = new w.File(['<svg></svg>'], 'logo.svg', { type: 'image/svg+xml' });
  const input = hote.querySelector('#bdvlFichier');
  Object.defineProperty(input, 'files', { value: [f], configurable: true });
  input.dispatchEvent(new w.Event('change'));
  await pause();
  dit(/Ce fichier \(SVG, 1 ko\) n’est pas une image PNG ou JPEG/.test(hote.querySelector('.bdvl-mot').textContent), 'un SVG est refuse, et la phrase dit ce qu\'on a recu', hote.querySelector('.bdvl-mot').textContent);
  /* Un fichier de plus de 15 Mo est refuse avant d'etre lu, avec son poids. */
  const gros = new w.File([new Uint8Array(16 * 1024 * 1024)], 'logo.png', { type: 'image/png' });
  Object.defineProperty(input, 'files', { value: [gros], configurable: true });
  input.dispatchEvent(new w.Event('change')); await pause();
  dit(/Ton fichier pèse 16 Mo : 15 Mo au plus/.test(hote.querySelector('.bdvl-mot').textContent), 'un fichier de 16 Mo est refuse avec son poids', hote.querySelector('.bdvl-mot').textContent);
  const pdf = new w.File(['%PDF'], 'logo.pdf', { type: 'application/pdf' });
  Object.defineProperty(input, 'files', { value: [pdf], configurable: true });
  input.dispatchEvent(new w.Event('change')); await pause();
  dit(/\(PDF, 1 ko\) n’est pas une image PNG ou JPEG/.test(hote.querySelector('.bdvl-mot').textContent), 'un PDF est refuse');
  dit(!appels.some(a => a.chemin === '/rpc/domaine_logo_poser'), 'et rien ne part en base');
}
{
  const base = { ligne: { image: PNG, empreinte: 'E1' } };
  const { w } = monterPage(base, true, null);
  const hote = w.document.getElementById('hote');
  w.BdvLogo.monter(hote); await w.BdvLogo.rafraichir();
  dit(/Changer le logo/.test(hote.querySelector('.bdvl-choisir').textContent), 'avec un logo : « Changer le logo »');
  const retirer = hote.querySelector('.bdvl-gestes .bdvr-btn--creux');
  dit(!retirer.hidden, 'et « Retirer le logo »');
  retirer.click();
  const conf = hote.querySelector('.bdvl-conf');
  dit(!conf.hidden && w.document.activeElement && w.document.activeElement.textContent === 'Non, le garder',
    'retirer demande confirmation, le focus sur « Non, le garder »');
  conf.querySelector('.bdvr-btn:not(.bdvr-btn--creux)').click(); await pause();
  dit(base.ligne === null && w.BdvLogo.image() === null, '« Oui, le retirer » retire le logo');
  dit(/Logo retiré/.test(hote.querySelector('.bdvl-mot').textContent), 'et le dit');
}
{
  const base = { ligne: { image: PNG, empreinte: 'E1' } };
  const { w } = monterPage(base, false, null);
  const hote = w.document.getElementById('hote');
  w.BdvLogo.monter(hote); await w.BdvLogo.rafraichir();
  dit(hote.querySelector('.bdvl-gestes').hidden, 'un simple utilisateur ne voit aucun geste');
  dit(/Seul le maître du bureau peut le changer/.test(hote.textContent), 'il lit « Seul le maître du bureau peut le changer »');
  dit(!hote.querySelector('.bdvl-apercu').hidden, 'et il voit le logo');
}
{
  const base = { ligne: null };
  const { w } = monterPage(base, null, null);
  const hote = w.document.getElementById('hote');
  w.BdvCompte.api = ((orig) => (c, o) => c === '/rpc/est_maitre' ? Promise.reject(new Error('reseau')) : orig(c, o))(w.BdvCompte.api);
  w.BdvLogo.monter(hote); await w.BdvLogo.rafraichir();
  dit(hote.querySelector('.bdvl-gestes').hidden && /Vérifie ta connexion/.test(hote.textContent),
    'role inconnu (panne) : pas de geste, et une phrase qui dit pourquoi');
}

console.log('\n== 3. Le devis ==');
const devis = lire('src/js/bdv-devis.js');
dit(/LOGO_PAPIER = \/\^data:image\\\/\(png\|jpeg\);base64,\[A-Za-z0-9\+\/\]\+=\{0,2\}\$\//.test(devis), 'le devis ne prend qu\'une adresse data: PNG/JPEG en base64');
dit(/o\.logo && LOGO_PAPIER\.test\(o\.logo\)/.test(devis), 'htmlPapier verifie le logo avant de l\'ecrire');
dit(/feuilles: f, logo: logoPapier\(\)/.test(devis) && /await BdvLogo\.pret\(\)/.test(devis), 'la copie gardee porte le logo, lu AVANT de figer');
{
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window;
  w.BdvDevisCalcul = undefined;
  const s1 = w.document.createElement('script'); s1.textContent = lire('src/js/bdv-devis-calcul.js'); w.document.body.appendChild(s1);
  const s2 = w.document.createElement('script'); s2.textContent = devis; w.document.body.appendChild(s2);
  const H = w.BdvDevis && w.BdvDevis.htmlPapier;
  if (!H) dit(false, 'htmlPapier est expose');
  else {
    const d = { numero: 'D-2026-0001', vendeur: { raison_sociale: 'EARL Essai' }, acheteur: { nom: 'Cave' }, date_devis: '2026-10-06', valable_jusqu: '2026-11-05' };
    const sans = H(d, [], { polices: [] });
    const nul = H(d, [], { polices: [], logo: null });
    dit(sans === nul && !/dpap__logo/.test(sans), 'sans logo, le papier est identique a celui d\'avant le lot');
    const avec = H(d, [], { polices: [], logo: PNG });
    dit(avec.indexOf('<img class="dpap__logo" src="' + PNG + '" alt="">') > 0, 'avec un logo, il est en tete du vendeur');
    dit(avec.indexOf('dpap__logo') < avec.indexOf('dpap__raison'), 'au-dessus du nom du domaine');
    const piege = H(d, [], { polices: [], logo: 'data:image/png;base64,AAA"><script>alert(1)</script>' });
    dit(!/dpap__logo/.test(piege) && !/<script>alert/.test(piege), 'une adresse piegee n\'entre jamais dans le papier');
    const svg = H(d, [], { polices: [], logo: 'data:image/svg+xml;base64,PHN2Zz4=' });
    dit(!/dpap__logo/.test(svg), 'un SVG n\'entre jamais dans le papier');
  }
}
dit(/\.dpap \.dpap__logo\{[^}]*max-height:20mm[^}]*max-width:60mm/.test(lire('src/css/bdv-devis-papier.css')), 'sur le papier : 20 mm de haut, 60 mm de large au plus');

console.log('\n== 4. La page de signature ==');
const sig = lire('src/js/bdv-signer.js');
dit(/logoEnTete\(f\)/.test(sig) && /querySelector\('\.dpap__logo'\)/.test(sig), 'la page reprend le logo DE LA COPIE montree');
dit(/data:image\\\/\(png\|jpeg\);base64/.test(sig), 'et seulement une adresse data: PNG/JPEG');
const sigHtml = lire('src/signer.njk');
dit(/<img id="sigLogo" alt="" hidden/.test(sigHtml) && !/id="sigLogo"[^>]*display:block/.test(sigHtml), 'l\'emplacement existe, cache tant qu\'il n\'y a rien (pas de display qui battrait hidden)');

console.log('\n== 5. Le branchement ==');
const dom2 = lire('src/js/bdv-domaine.js');
dit(/closest\('#bdvdLogo'\)/.test(dom2), 'deposer un logo ne marque pas la fiche du domaine comme modifiee');
const page = lire('src/mon-bureau.njk');
dit(page.indexOf('bdv-logo.js" defer') > 0 && page.indexOf('bdv-logo.js') < page.indexOf('bdv-domaine.js'), 'bdv-logo.js est differe, et charge avant bdv-domaine.js');
const css = lire('src/css/bdv-bureau.css');
dit(/\.bdv-coque\.bdv-rail-replie \.bureau-nav__logo\{ display:none; \}/.test(css), 'barre repliee : pas de logo');
dit(/\.bdv-coque \.bureau-nav__logo\{ display:none; \}/.test(css) && /min-width:901px\)\{\n  \.bdv-coque \.bureau-nav__logo\{/.test(css), 'sous 901 px : pas de logo');
dit(/background:var\(--bdv-fond-logo\)/.test(css), 'la pastille prend le fond clair des deux themes');

console.log('\n  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
process.exit(ko ? 1 : 0);
