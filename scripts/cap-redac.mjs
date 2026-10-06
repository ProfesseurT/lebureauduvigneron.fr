/* Captures du redacteur de mails d'une affaire (lot 72, 06/10/2026).
   node scripts/cap-redac.mjs 1440:dark   (playwright, hors verif) */
import { chromium } from 'playwright';
import { contexte, ouvrirPage, servir, EXE } from './decor-gagner.mjs';
const OUT = process.env.OUT || '/tmp/cap/';
const [L, th] = process.argv[2].split(':');
const port = 8700 + (+L < 700 ? 1 : 0) + (th === 'dark' ? 2 : 0);
const srv = await servir('./_site', port);
const nav = await chromium.launch({ executablePath: EXE });
const ctx = await contexte(nav, +L, th);
const p = await ouvrirPage(ctx, port);
const W = ms => p.waitForTimeout(ms);
const k = L + '-' + th;
try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 3000 }); } catch (e) {}
await W(500);
await p.evaluate(() => { try{localStorage.setItem('bdv_aff_vue','liste')}catch(e){}; BdvNav.afficher('affaires'); }); await W(1500);
/* 1. le panneau d'une affaire NOUVEAU CLIENT (degustation il y a 9 jours) */
const lig = p.locator('#bureauAffaires button:visible', { hasText: /Bistrot des Halles/ }).first();
if (await lig.count()) { await lig.click(); await W(2000);
  await p.locator('#affaireModale [data-aff="ecrireMail"]').first().click(); await W(800);
  await p.screenshot({ path: OUT + k + '-redac-panneau.png' });
  const b = await p.locator('#affaireModale #affRedac').boundingBox();
  console.log('REDAC', JSON.stringify(await p.evaluate(() => { const d = document.querySelector('#affaireModale #affRedac'); return { pourquoi: (d.querySelector('.aff-redac__pourquoi')||{}).innerText, a: d.querySelector('.aff-redac__a').innerText,
    petites: [...d.querySelectorAll('button, a, summary, input, select, textarea')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return [e.tagName+(e.type?':'+e.type:'')+' '+(e.textContent||e.value||'').trim().slice(0,24),Math.round(r.width),Math.round(r.height)]}).filter(x=>x[2]<44 && !/checkbox/.test(x[0])) }; })), JSON.stringify(b));
  await p.locator('#affaireModale #affRedac').screenshot({ path: OUT + k + '-redac-bloc.png' });
  await p.locator('#affaireModale [data-aff="redacEnvoye"]').click(); await W(1200);
  const h = p.locator('#affaireModale .amod__hist summary'); if (await h.count()) { await h.click(); await W(300); }
  await p.locator('#affaireModale .amod__hist').screenshot({ path: OUT + k + '-redac-hist.png' });
  await p.locator('#affaireModale .tmod__x').click(); await W(500);
}
/* 2. la pleine page d'une affaire client avec un devis envoye (et son lien) */
const p2 = await ctx.newPage(); p2.__err = [];
p2.on('pageerror', e => p2.__err.push('JS: ' + e.message));
await p2.goto(`http://127.0.0.1:${port}/mon-bureau/#affaire=a1`, { waitUntil: 'load' });
await p2.waitForTimeout(5000);
try { await p2.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 1500 }); await p2.waitForTimeout(800); } catch (e) {}
await p2.locator('#pageAffaire [data-aff="ecrireMail"]').first().click(); await p2.waitForTimeout(800);
await p2.locator('#pageAffaire #affRedac').screenshot({ path: OUT + k + '-redac-page.png' });
console.log('PAGE', JSON.stringify(await p2.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  pourquoi: (document.querySelector('#pageAffaire .aff-redac__pourquoi')||{}).innerText, texte: (document.querySelector('#pageAffaire [data-redac="texte"]')||{}).value }))), p.__err.concat(p2.__err).join(' | '));
await nav.close(); srv.close();
