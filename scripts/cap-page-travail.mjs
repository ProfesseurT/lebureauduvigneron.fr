/* Captures de la page de travail (08/10/2026) : fiche et affaire en pleine page, barre et
   en-tete gardes, tiroir de l'affaire depuis la fiche. node scripts/cap-page-travail.mjs 1440:light
   (playwright, hors verif) */
import { chromium } from 'playwright';
import { contexte, servir, EXE } from './decor-gagner.mjs';
const OUT = process.env.OUT || '/tmp/cap/';
const [L, th] = process.argv[2].split(':');
const LARG = +(process.env.LARG || L);
const port = 8700 + (+L < 700 ? 1 : 0) + (th === 'dark' ? 2 : 0) + (LARG > 2000 ? 4 : 0);
const srv = await servir('./_site', port);
const nav = await chromium.launch({ executablePath: EXE });
const ctx = await contexte(nav, +L, th);
const k = LARG + '-' + th;
async function page(hash) {
  const p = await ctx.newPage(); const err = [];
  if (LARG > 1440) await p.setViewportSize({ width: LARG, height: 1100 });
  p.on('pageerror', e => err.push('JS: ' + e.message));
  await p.goto(`http://127.0.0.1:${port}/mon-bureau/${hash}`, { waitUntil: 'load' });
  await p.waitForTimeout(6000);
  try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 1500 }); await p.waitForTimeout(800); } catch (e) {}
  return { p, err };
}
const mesure = (p) => p.evaluate(() => {
  const r = s => { const n = document.querySelector(s); if (!n || !n.getClientRects().length) return null; const b = n.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
  return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h1: (document.getElementById('bureauPiece') || {}).textContent,
    rail: r('#bureauNav'), tete: r('.bureau-tete'), centre: r('.fiche__centre') || r('.page-aff__centre'), droite: r('.fiche__droite') || r('.page-aff__droite'),
    tiroir: r('#affaireModale .tmod__boite'), actif: [...document.querySelectorAll('#bureauNav [aria-current]')].length };
});
/* 1. la fiche */
const f = await page('#fiche=C0288');
await f.p.screenshot({ path: OUT + k + '-fiche.png' });
console.log('FICHE', JSON.stringify(await mesure(f.p)), f.err.join(' | '));
await f.p.evaluate(() => window.scrollTo(0, 450)); await f.p.waitForTimeout(400);
await f.p.screenshot({ path: OUT + k + '-fiche-defile.png' });
console.log('FICHE DEFILEE', JSON.stringify(await mesure(f.p)));
await f.p.evaluate(() => window.scrollTo(0, 0));
const na = f.p.locator('#modale .fiche__actions button', { hasText: 'Nouvelle affaire' });
if (await na.count()) { await na.click(); await f.p.waitForTimeout(2500);
  await f.p.screenshot({ path: OUT + k + '-fiche-tiroir.png' });
  console.log('TIROIR', JSON.stringify(await mesure(f.p)), JSON.stringify(await f.p.evaluate(() => ({ titre: (document.getElementById('amodTete') || {}).innerText }))), f.err.join(' | ')); }
/* 2. l'affaire */
const a = await page('#affaire=a1');
await a.p.screenshot({ path: OUT + k + '-affaire.png' });
console.log('AFFAIRE', JSON.stringify(await mesure(a.p)), a.err.join(' | '));
await nav.close(); srv.close();
