/* Captures du lot 83 (08/10/2026) : « C'est le meme ? » et « Relies ces derniers jours » dans
   « Mes clients », relier et fusionner depuis la fiche d'un nouveau client, « Delier » sur la
   fiche Vitisoft. node scripts/cap-lien.mjs 1440:light (playwright, hors verif) */
import { chromium } from 'playwright';
import { contexte, servir, EXE } from './decor-gagner.mjs';
const OUT = process.env.OUT || '/tmp/cap/';
const [L, th] = process.argv[2].split(':');
const port = 8760 + (+L < 700 ? 1 : 0) + (th === 'dark' ? 2 : 0);
const srv = await servir('./_site', port);
const nav = await chromium.launch({ executablePath: EXE });
const ctx = await contexte(nav, +L, th);
await ctx.addInitScript(() => {
  const T = window.__T; if (!T) return;
  const B = T.pistes[0].bureau;
  T.pistes.push({ bureau: B, piste_id: 'p5', nom: 'SARL Cave du Vieux Pressoir', nature: 'caviste', ville: 'Saumur', email: 'contact@pressoir.fr', opposition: false, pas_vitisoft: [], cree_le: '2026-09-20T09:00:00Z' },
                { bureau: B, piste_id: 'p7', nom: 'Bistrot des Halles (salon)', ville: 'Angers', opposition: false, pas_vitisoft: [] },
                { bureau: B, piste_id: 'p9', nom: 'Hauts Coteaux, rencontre au salon', client_id: 'C0412', lie_le: new Date(Date.now() - 86400000).toISOString(), cree_le: '2026-09-28T09:00:00Z', opposition: false, pas_vitisoft: [] });
  const avant = window.fetch;
  window.fetch = function (e, init) {
    const url = String((e && e.url) || e || '');
    const m = url.match(/rest\/v1\/rpc\/(relier_a_vitisoft|delier_de_vitisoft|fusionner_nouveaux|piste_ecarter)/);
    if (!m) return avant(e, init);
    const c = JSON.parse((init && init.body) || '{}');
    const p = T.pistes.find(x => x.piste_id === c.p_piste);
    if (m[1] === 'relier_a_vitisoft') { p.client_id = c.p_client; p.lie_le = new Date().toISOString(); }
    if (m[1] === 'delier_de_vitisoft') { p.client_id = null; p.lie_le = null; }
    if (m[1] === 'piste_ecarter') { p.pas_vitisoft = (p.pas_vitisoft || []).concat([c.p_client]); }
    if (m[1] === 'fusionner_nouveaux') { T.pistes = T.pistes.filter(x => x.piste_id !== c.p_absorbe); }
    return Promise.resolve(new Response(JSON.stringify(m[1] === 'piste_ecarter' ? p.pas_vitisoft : { ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };
});
const k = L + '-' + th;
const err = [];
async function page(hash) {
  const p = await ctx.newPage();
  p.on('pageerror', e => err.push('JS: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) err.push('CONSOLE: ' + m.text()); });
  await p.goto(`http://127.0.0.1:${port}/mon-bureau/${hash}`, { waitUntil: 'load' });
  await p.waitForTimeout(6000);
  try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 1500 }); await p.waitForTimeout(800); } catch (e) {}
  return p;
}
const p = await page('#annuaire');
await p.waitForTimeout(2500);
const z = p.locator('#annuRappro');
console.log('RAPPRO', (await z.innerText().catch(() => '')).replace(/\s+/g, ' '));
await z.scrollIntoViewIfNeeded().catch(() => {});
await p.screenshot({ path: OUT + k + '-li-liste.png' });
await z.screenshot({ path: OUT + k + '-li-rappro.png' }).catch(e => err.push('rappro: ' + e.message));
// LA FICHE D'UN NOUVEAU CLIENT : relier
await p.evaluate(() => window.bdvOuvrirFiche('p:p5')); await p.waitForTimeout(2000);
await p.screenshot({ path: OUT + k + '-li-fiche-neuf.png' });
await p.evaluate(() => window.ficheLien('vitisoft')); await p.waitForTimeout(1500);
await p.locator('#ficheLien').scrollIntoViewIfNeeded();
await p.screenshot({ path: OUT + k + '-li-cherche.png' });
console.log('CHERCHE', (await p.locator('#ficheLien').innerText()).replace(/\s+/g, ' '));
await p.locator('#ficheLienRes .fiche__lien-choix').first().click(); await p.waitForTimeout(400);
await p.screenshot({ path: OUT + k + '-li-confirme.png' });
console.log('CONFIRME', (await p.locator('#ficheLien').innerText()).replace(/\s+/g, ' '), '| focus:', await p.evaluate(() => document.activeElement && document.activeElement.textContent));
await p.locator('#ficheLien .btn--primary').click(); await p.waitForTimeout(2500);
await p.screenshot({ path: OUT + k + '-li-relie.png' });
console.log('APRES', await p.evaluate(() => FICHE_ID), (await p.locator('#ficheLien').innerText().catch(() => '')).replace(/\s+/g, ' '));
// FUSION
await p.evaluate(() => window.bdvOuvrirFiche('p:p1')); await p.waitForTimeout(1500);
await p.evaluate(() => window.ficheLien('fusion')); await p.waitForTimeout(500);
await p.locator('#ficheLien').scrollIntoViewIfNeeded();
await p.screenshot({ path: OUT + k + '-li-fusion-cherche.png' });
await p.locator('#ficheLienRes .fiche__lien-choix').first().click().catch(e => err.push('fusion choix: ' + e.message)); await p.waitForTimeout(400);
await p.screenshot({ path: OUT + k + '-li-fusion.png' });
console.log('FUSION', (await p.locator('#ficheLien').innerText()).replace(/\s+/g, ' '));
// DELIER, en pleine page
const q = await page('#fiche=C0412');
await q.screenshot({ path: OUT + k + '-li-vitisoft.png' });
console.log('VITISOFT', (await q.locator('#ficheLien').innerText().catch(() => 'ABSENT')).replace(/\s+/g, ' '));
await q.locator('.fiche__lien-delier').click().catch(e => err.push('delier: ' + e.message)); await q.waitForTimeout(400);
await q.screenshot({ path: OUT + k + '-li-delier.png' });
console.log('PLEINE', JSON.stringify(await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))));
console.log('ERREURS', err.join(' | ') || 'aucune');
await nav.close(); srv.close(); process.exit(0);
