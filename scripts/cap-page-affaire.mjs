/* Captures de l'affaire en pleine page et du panneau avec le client en direct (03/10/2026).
   node scripts/cap-page-affaire.mjs 1440:dark   (playwright, hors verif) */
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
await W(500);
/* 1. le panneau d'une affaire client */
await p.evaluate(() => { try{localStorage.setItem('bdv_aff_vue','liste')}catch(e){}; BdvNav.afficher('affaires'); }); await W(1500);
const lig = p.locator('#bureauAffaires button:visible', { hasText: /Cave du Vieux Pressoir/ }).first();
if (await lig.count()) { await lig.click(); await W(2500);
  const h = p.locator('#affaireModale .amod__hist summary'); if (await h.count()) { await h.click(); await W(300); }
  await p.screenshot({ path: OUT + k + '-panneau.png' });
  console.log('PANNEAU', JSON.stringify(await p.evaluate(() => ({ tete: (document.getElementById('amodTete')||{}).innerText, agr: (document.getElementById('amodAgrandir')||{}).href }))));
}
/* 2. la pleine page */
const p2 = await ctx.newPage(); p2.__err = [];
p2.on('pageerror', e => p2.__err.push('JS: ' + e.message));
p2.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) p2.__err.push('CONSOLE: ' + m.text()); });
await p2.goto(`http://127.0.0.1:${port}/mon-bureau/#affaire=a1`, { waitUntil: 'load' });
await p2.waitForTimeout(5000);
try { await p2.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 1500 }); await p2.waitForTimeout(800); } catch (e) {}
await p2.screenshot({ path: OUT + k + '-page.png', fullPage: true });
const m = await p2.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  visibles: [...document.body.children].filter(e => e.getClientRects().length).map(e => e.id || e.className),
  petites: [...document.querySelectorAll('#pageAffaire button, #pageAffaire a, #pageAffaire summary')].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();return [e.textContent.trim().slice(0,30),Math.round(b.width),Math.round(b.height)]}).filter(x=>x[2]<44) }));
console.log(k, JSON.stringify(m));
/* 3. noter un echange depuis la page */
const nt = p2.locator('#pageAffaire .aff-noter summary').first();
if (await nt.count()) { await nt.click(); await p2.fill('#pageAffaire .aff-noter__txt', 'Rappelé, il prend 12 magnums.'); await p2.screenshot({ path: OUT + k + '-page-noter.png', fullPage: true }); await p2.click('#pageAffaire [data-aff="noterEchange"]'); await p2.waitForTimeout(1200);
  console.log('NOTE', JSON.stringify(await p2.evaluate(() => ({ avis: document.getElementById('affAvis').innerText, hist: [...document.querySelectorAll('#pageAffaire .aff-hist li')].map(x=>x.innerText).slice(0,3), T: (window.__T.echanges||[]).length })))); }
/* 4. notes : focusout */
await p2.fill('#pageAffNotes', 'Il veut une étiquette personnalisée.'); await p2.focus('#pageAffaire [data-aff="reporter"]'); await p2.waitForTimeout(1000);
console.log('NOTES', JSON.stringify(await p2.evaluate(() => ({ mot: document.getElementById('pageAffNotesMot').innerText, base: window.__T.affaires.filter(a=>a.affaire_id==='a1')[0].notes }))));
console.log('ERR', JSON.stringify(p.__err), JSON.stringify(p2.__err));
await nav.close(); srv.close && srv.close(); process.exit(0);
