/* Captures du lot 57, les nouvelles de « Mon commerce » (playwright, hors `npm run verif`).
     NOUV=1 node scripts/cap-nouv.mjs 1440:light      (ou 390:dark, etc.)
   Decor : scripts/decor-gagner.mjs avec NOUV=1 (un devis signe, une affaire gagnee par Romane,
   une perdue par Camila). Rend l'en-tete, la liste ouverte, et mesure pastille, points, cibles. */
import { chromium } from 'playwright';
import { contexte, ouvrirPage, servir, EXE } from './decor-gagner.mjs';
const OUT = process.env.OUT || '/tmp/cap/';
const [L, th] = process.argv[2].split(':');
const port = 8600 + (+L < 700 ? 1 : 0) + (th === 'dark' ? 2 : 0);
const srv = await servir('./_site', port);
const nav = await chromium.launch({ executablePath: EXE });
const ctx = await contexte(nav, +L, th);
const p = await ouvrirPage(ctx, port);
const W = ms => p.waitForTimeout(ms);
const k = L + '-' + th;
try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 3000 }); } catch (e) {}
await W(1500);
const m1 = await p.evaluate(() => {
  const pa = document.querySelector('.bureau-tete__etat--commerce');
  const pt = document.querySelector('.bureau-nav__ligne[data-piece="clients"] .bureau-nav__point');
  const np = document.getElementById('navPoint');
  const r = pa && pa.getBoundingClientRect(), rp = pt && pt.getBoundingClientRect();
  return { pastille: pa && pa.getAttribute('aria-label'), boite: r && [Math.round(r.width), Math.round(r.height)],
    point: !!pt && pt.getClientRects().length > 0 && [Math.round(rp.left), Math.round(rp.top), Math.round(rp.width)], dit: pt && pt.textContent,
    navPoint: np && !np.hidden && np.getClientRects().length > 0, n: localStorage.getItem('bdv_notifs_n'),
    signe: !!document.getElementById('bureauSigne') };
});
console.log(k, 'AVANT', JSON.stringify(m1));
await p.screenshot({ path: OUT + k + '-nouv-tete.png' });
await p.locator('.bureau-tete__etat--commerce').first().click(); await W(500);
const m2 = await p.evaluate(() => {
  const pop = document.getElementById('bdvNouv'); if (!pop) return null;
  const r = pop.getBoundingClientRect();
  return { visible: !pop.hidden, boite: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    lignes: [...pop.querySelectorAll('.bdv-nouv__l')].map(l => l.textContent.replace(/\s+/g, ' ').trim()),
    petites: [...pop.querySelectorAll('button')].map(b => { const q = b.getBoundingClientRect(); return [b.textContent.trim(), Math.round(q.width), Math.round(q.height)]; }).filter(x => x[2] < 44),
    focus: document.activeElement && document.activeElement.textContent, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
});
console.log(k, 'LISTE', JSON.stringify(m2));
await p.screenshot({ path: OUT + k + '-nouv-liste.png' });
await p.locator('#bdvNouv .bdv-nouv__o').first().click(); await W(1500);
const m3 = await p.evaluate(() => ({ piece: document.getElementById('bureauPiece') && document.getElementById('bureauPiece').textContent,
  panneau: (() => { const m = document.getElementById('affaireModale'); return m && !m.hidden && (document.getElementById('amodTitre') || {}).textContent; })(),
  devis: (() => { const d = document.getElementById('devisModale'); return !!d && !d.hidden; })(),
  reste: window.BdvAffairesJour.nouvelles().length, pastille: (document.querySelector('.bureau-tete__etat--commerce') || {}).textContent }));
console.log(k, 'APRES OUVRIR', JSON.stringify(m3));
await p.screenshot({ path: OUT + k + '-nouv-ouvert.png' });
console.log('ERR', JSON.stringify(p.__err));
await nav.close(); srv.close && srv.close(); process.exit(0);
