/* Capture de l'onglet « Mes envois » (lot 75). Hors `verif` : demande playwright.
   node scripts/cap-envois.mjs 1440:light   (ou 390:dark ...)   MAITRE=0 pour un simple utilisateur. */
import { chromium } from 'playwright';
import { contexte, ouvrirPage, servir, EXE } from './decor-gagner.mjs';
const OUT = process.env.OUT || '/tmp/cap/';
const [L, th] = process.argv[2].split(':');
const port = 8600 + (+L < 700 ? 1 : 0) + (th === 'dark' ? 2 : 0);
const srv = await servir('./_site', port);
const nav = await chromium.launch({ executablePath: EXE });
const ctx = await contexte(nav, +L, th);
const fin = new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10);
await ctx.addInitScript(({ maitre, fin }) => {
  const S = { perso: { nom: 'Teddy Pereira', role: 'Vigneron', telephone: '06 12 34 56 78', dans_mails: true, messagerie_signe: false },
    commun: { nom_domaine: 'Domaine du Clos Fertel', appellation: 'Saumur-Champigny', action: 'Caveau ouvert du mardi au samedi, 10 h-12 h 30 et 14 h 30-18 h',
      lien: 'https://closfertel.fr/boutique', actualite: 'Salon des Vins de Loire, Angers, stand B12', actualite_fin: fin, pied_legal: true } };
  const avant = window.fetch;
  window.fetch = function (e, init) {
    const url = String((e && e.url) || e || '');
    const rep = o => Promise.resolve(new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (/rest\/v1\/signatures\?select=/.test(url)) return rep([S.perso]);
    if (/rest\/v1\/signature_domaine\?select=/.test(url)) return rep([S.commun]);
    if (/rest\/v1\/rpc\/est_maitre/.test(url)) return rep(maitre);
    return avant(e, init);
  };
}, { maitre: process.env.MAITRE !== '0', fin });
const p = await ouvrirPage(ctx, port);
const W = ms => p.waitForTimeout(ms);
try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 3000 }); } catch (e) {}
await W(600);
await p.evaluate(() => BdvNav.ouvrirReglages('envois')); await W(1500);
const k = L + '-' + th + (process.env.MAITRE === '0' ? '-simple' : '');
await p.screenshot({ path: OUT + 'envois-' + k + '.png' });
// tout le contenu de l'onglet, en defilant la boite
const box = await p.evaluate(() => { const b = document.querySelector('#bdvrBlocEnvois'); const s = b && b.closest('.bdvr-corps, .bdvr-boite, form'); return !!b; });
const mesure = await p.evaluate(() => {
  const z = document.getElementById('bdvrHoteEnvois');
  const r = z ? z.getBoundingClientRect() : null;
  const petites = [...document.querySelectorAll('#bdvrHoteEnvois button, #bdvrHoteEnvois input, #bdvrHoteEnvois label.bdvr-chk')]
    .filter(e => e.getClientRects().length).map(e => { const b = e.getBoundingClientRect(); return [e.id || e.textContent.trim().slice(0, 24), Math.round(b.width), Math.round(b.height)]; }).filter(x => x[2] < 44);
  const deb = [...document.querySelectorAll('#bdvrHoteEnvois *')].filter(e => { const b = e.getBoundingClientRect(); return r && b.right > r.right + 1; }).map(e => e.className || e.tagName).slice(0, 5);
  return { hote: r && [Math.round(r.width), Math.round(r.height)], cols: getComputedStyle(document.getElementById('bdvsCorps')).gridTemplateColumns,
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, petites, deb,
    apercu: document.getElementById('bdvsApercu') && document.getElementById('bdvsApercu').innerText };
});
console.log(k, JSON.stringify(mesure));
// les vues en defilant le corps du panneau
for (let i = 1; i <= 4; i++) {
  const fini = await p.evaluate((i) => {
    const b = document.getElementById('bdvrBlocEnvois'); let s = b; while (s && s !== document.body) { const o = getComputedStyle(s).overflowY; if ((o === 'auto' || o === 'scroll') && s.scrollHeight > s.clientHeight) break; s = s.parentElement; }
    if (!s || s === document.body) return true; const av = s.scrollTop; s.scrollTop = av + s.clientHeight * 0.8; return s.scrollTop === av;
  }, i);
  if (fini) break;
  await W(300);
  await p.screenshot({ path: OUT + 'envois-' + k + '-' + i + '.png' });
}
console.log('ERR', JSON.stringify(p.__err));
await nav.close(); srv.close && srv.close(); process.exit(0);
