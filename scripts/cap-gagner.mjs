import { chromium } from 'playwright';
import { contexte, ouvrirPage, servir, EXE } from './decor-gagner.mjs';
const OUT = process.env.OUT || '/tmp/cap/';
const [L, th] = process.argv[2].split(':');
const port = 8500 + (+L < 700 ? 1 : 0) + (th === 'dark' ? 2 : 0);
const srv = await servir('./_site', port);
const nav = await chromium.launch({ executablePath: EXE });
const ctx = await contexte(nav, +L, th);
const p = await ouvrirPage(ctx, port);
const W = ms => p.waitForTimeout(ms);
const k = L + '-' + th;
try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 3000 }); } catch (e) {}
await W(600);
await p.evaluate(() => { try{localStorage.setItem('bdv_aff_vue','liste')}catch(e){}; BdvNav.afficher('affaires'); }); await W(1500);
await p.screenshot({ path: OUT + k + '-liste.png', fullPage: !process.env.VUE });
const mesure = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  petites: [...document.querySelectorAll('#bureauAffaires button, #bureauAffaires a, #bureauAffaires select, #bureauComBilan button')].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();return [e.textContent.trim().slice(0,30),Math.round(b.width),Math.round(b.height)]}).filter(x=>x[2]<44) }));
console.log(k, JSON.stringify(mesure));
// kanban
const kb = p.locator('#bureauAffaires button:visible', { hasText: /^Kanban/ }).first();
if (await kb.count()) { await kb.click(); await W(800);
  const ty = p.locator('#bureauAffaires button:visible', { hasText: /Caviste/ }).first(); if (await ty.count()) { await ty.click(); await W(800); }
  await p.screenshot({ path: OUT + k + '-kanban.png', fullPage: !process.env.VUE }); }
// nouvelle affaire
const na = p.locator('#bureauAffaires button:visible', { hasText: /Nouvelle affaire/ }).first();
if (await na.count()) { await na.click(); await W(900); await p.screenshot({ path: OUT + k + '-nouvelle.png' }); await p.keyboard.press('Escape'); await W(400); }
// ouvrir une affaire
const nom = p.locator('#bureauAffaires .aff-ligne__nom, #bureauAffaires [data-ouvrir]').first();
if (await p.locator('#bureauAffaires button:visible', { hasText: /^Liste/ }).count()) { await p.locator('#bureauAffaires button:visible', { hasText: /^Liste/ }).first().click(); await W(600); }
const lig = p.locator('#bureauAffaires button:visible', { hasText: /Cave du Vieux Pressoir|Bistrot/ }).first();
if (await lig.count()) { await lig.click(); await W(900); await p.screenshot({ path: OUT + k + '-affaire.png' }); await p.keyboard.press('Escape'); await W(400); }
// reglages : en-tete
await p.evaluate(() => BdvNav.afficher('reglages')); await W(800);
const t1 = await p.evaluate(() => document.getElementById('bureauPiece').textContent);
await p.keyboard.press('Escape'); await W(500);
const t2 = await p.evaluate(() => ({ tete: document.getElementById('bureauPiece').textContent, actif: [...document.querySelectorAll('.bureau-nav__item--actif')].map(x=>x.textContent.trim()) }));
console.log('REGLAGES', t1, JSON.stringify(t2));
console.log('ERR', JSON.stringify(p.__err));
await nav.close(); srv.close && srv.close(); process.exit(0);
