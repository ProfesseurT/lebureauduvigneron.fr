/* Captures du suivi des devis depuis l'affaire (lot 67, 05/10/2026).
   node scripts/cap-devis67.mjs 1440:light A   (playwright, hors verif)
   A : un devis envoye valable en version 2, un refuse, un abandonne.
   B : un devis expire (le client a un numero) et un devis pas encore envoye. */
import { chromium } from 'playwright';
import { contexte, ouvrirPage, servir, EXE } from './decor-gagner.mjs';
const OUT = process.env.OUT || '/tmp/cap67/';
const [L, th] = process.argv[2].split(':'), V = process.argv[3] || 'A';
const port = 8800 + (+L < 700 ? 1 : 0) + (th === 'dark' ? 2 : 0) + (V === 'B' ? 4 : 0);
const srv = await servir('./_site', port);
const nav = await chromium.launch({ executablePath: EXE });
const ctx = await contexte(nav, +L, th);
await ctx.addInitScript((V) => {
  const T = window.__T; if (!T) return;
  const iso = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const B = T.devis[0].bureau, base = { bureau: B, affaire_id: 'a1', remise_globale_c: 0, port_c: 0, total_vins_c: 124000, tva_c: 24800, total_ttc_c: 148800, papier_empreinte: null };
  T.devis = V === 'B'
    ? [Object.assign({}, base, { devis_id: 'd2', numero: 'D-2026-0047', statut: 'enregistre', total_ht_c: 56000, date_devis: iso(-2), cree_le: iso(-2) + 'T09:00:00Z', version: 1 }),
       Object.assign({}, base, { devis_id: 'd1', numero: 'D-2026-0042', statut: 'envoye', version: 1, total_ht_c: 124000, date_devis: iso(-40), envoye_le: iso(-40), valable_jusqu: iso(-3), cree_le: iso(-40) + 'T09:00:00Z' })]
    : [Object.assign({}, base, { devis_id: 'd1', numero: 'D-2026-0042', statut: 'envoye', version: 2, total_ht_c: 118000, date_devis: iso(-6), envoye_le: iso(-6), valable_jusqu: iso(24), cree_le: iso(-40) + 'T09:00:00Z', papier_empreinte: 'e2' }),
       Object.assign({}, base, { devis_id: 'd3', numero: 'D-2026-0031', statut: 'refuse', refuse_motif: 'prix', total_ht_c: 131000, date_devis: iso(-60), cree_le: iso(-60) + 'T09:00:00Z' }),
       Object.assign({}, base, { devis_id: 'd0', numero: 'D-2026-0009', statut: 'abandonne', total_ht_c: 98000, date_devis: iso(-70), cree_le: iso(-70) + 'T09:00:00Z' })];
  const avant = window.fetch;
  const rep = o => Promise.resolve(new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  window.fetch = function (e, init) {
    const url = String((e && e.url) || e || '');
    if (/rest\/v1\/domaine(\?|$)/.test(url)) return rep([{ raison_sociale: 'EARL Domaine des Essais', forme_juridique: 'EARL', siret: '12345678900012', siren: '123456789', tva: 'FR12123456789', adresse: '3 chemin des Vignes', code_postal: '44330', ville: 'Vallet', email: 'contact@essais.fr', telephone: '02 40 00 00 00', paiement_mode: 'fdm', paiement_jours: 30, validite_jours: 30 }]);
    if (/rpc\/devis_propositions/.test(url)) return rep([]);
    if (/rest\/v1\/devis_lignes/.test(url)) return rep([{ rang: 1, num_produit: 'P100', designation: 'Muscadet Sèvre et Maine sur lie', millesime: '2024', conditionnement: '75 cl', quantite: 120, pu_ht_c: 1000, remise_cb: 0, pu_l_c: 1000, net_c: 120000, final_c: 120000, source_prix: 'client' }]);
    if (/rest\/v1\/devis_liens/.test(url)) return rep([]);
    if (/rest\/v1\/devis_copies/.test(url)) return rep(/version=eq\.1/.test(url) ? [{ papier: '<!doctype html><html lang="fr"><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px"><h1>Devis D-2026-0042</h1><p>Muscadet 2024 x 120 : 1 240,00 € HT</p></body></html>', empreinte: 'a1b2c3d4e5f6a7b8c9d0', cree_le: new Date(Date.now() - 40 * 86400000).toISOString() }] : []);
    return avant(e, init);
  };
}, V);
const p0 = await ouvrirPage(ctx, port);
try { await p0.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 3000 }); } catch (e) {}
await p0.waitForTimeout(500);
const p = await ctx.newPage(); p.__err = [];
p.on('pageerror', e => p.__err.push('JS: ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) p.__err.push('CONSOLE: ' + m.text()); });
const k = L + '-' + th + '-' + V;
await p.goto(`http://127.0.0.1:${port}/mon-bureau/#affaire=a1`, { waitUntil: 'load' });
await p.waitForTimeout(5000);
try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 1500 }); await p.waitForTimeout(800); } catch (e) {}
await p.screenshot({ path: OUT + k + '-page.png', fullPage: true });
const sec = p.locator('#pageAffaire .page-aff__bloc--devis');
if (await sec.count()) await sec.screenshot({ path: OUT + k + '-devis.png' });
console.log(k, JSON.stringify(await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  ordre: [...document.querySelectorAll('#pageAffaire .page-aff__bloc')].map(b => [Math.round(b.getBoundingClientRect().top), (b.querySelector('.page-aff__h') || {}).textContent]),
  pleins: [...document.querySelectorAll('#pageAffaire .btn--bordeaux')].map(b => b.textContent.trim()),
  petites: [...document.querySelectorAll('#pageAffaire .page-aff__bloc--devis button, #pageAffaire .page-aff__bloc--devis a')].filter(e => e.getClientRects().length).map(e => { const b = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 30), Math.round(b.width), Math.round(b.height)]; }).filter(x => x[2] < 44) }))));
if (V === 'A') {
  const vb = p.locator('#pageAffaire [data-action="version"]').first();
  if (await vb.count()) { await vb.click(); await p.waitForTimeout(3000); await p.screenshot({ path: OUT + k + '-version1.png' });
    console.log('NOTE', JSON.stringify(await p.evaluate(() => (document.getElementById('devCopieNote') || {}).textContent))); }
}
console.log('ERREURS', JSON.stringify(p.__err));
await nav.close(); srv.close && srv.close(); process.exit(0);
