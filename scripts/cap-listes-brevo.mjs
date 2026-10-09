/* Captures des listes vers Brevo (lot 89, 09/10/2026) : « Mes clients » avec « Vers Brevo », le
   bloc ouvert (ecarts d'office), le resultat ; puis « Mon commerce ».
   node scripts/cap-listes-brevo.mjs 1440:light   (playwright, hors verif) */
import { chromium } from 'playwright';
import { contexte, servir, EXE } from './decor-gagner.mjs';
const OUT = process.env.OUT || '/tmp/cap/';
const [L, th] = process.argv[2].split(':');
const port = 8760 + (+L < 700 ? 1 : 0) + (th === 'dark' ? 2 : 0);
const srv = await servir('./_site', port);
const nav = await chromium.launch({ executablePath: EXE });
const ctx = await contexte(nav, +L, th);
await ctx.addInitScript(() => {
  const avant = window.fetch;
  window.fetch = function (e, init) {
    const url = String((e && e.url) || e || '');
    const rep = o => Promise.resolve(new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (/rest\/v1\/brevo\?select=/.test(url)) return rep([{ etat: 'branche', compte_email: 'contact@closfertel.fr', compte_nom: 'Domaine du Clos Fertel',
      cle_fin: 'x7Qa', defaut_affaires: true, defaut_devis: true, defaut_programmes: true, branche_le: new Date().toISOString(), erreur: null }]);
    if (/rest\/v1\/brevo_choix\?select=/.test(url)) return rep([{ chemin: 'bureau', expediteur: 'julien@closfertel.fr', expediteur_nom: 'Julien', copie_a_soi: true }]);
    if (/rest\/v1\/brevo_listes\?select=/.test(url)) return rep([{ id: 3, le: new Date(Date.now() - 3 * 86400000).toISOString(), nom: 'Mes clients, Salon Angers - 06/10/2026 09h12', envoyes: 84, ecartes: 2, process_id: 7701 }]);
    if (/functions\/v1\/brevo/.test(url)) {
      let c = {}; try { c = JSON.parse(init && init.body || '{}'); } catch (x) {}
      if (c.action === 'liste') return new Promise(r => setTimeout(() => r(new Response(JSON.stringify({ resultat: 'creee', nom: c.nom, envoyes: c.contacts.length - 2, ecartes: 2,
        avec_mail: c.contacts.filter(x => x.e).length - 2, avec_mobile: c.contacts.filter(x => x.s).length }), { status: 200, headers: { 'Content-Type': 'application/json' } })), 600));
      if (c.action === 'liste_etat') return rep({ resultat: 'etat', statut: 'completed', soucis: ['des mobiles déjà portés par un autre contact de Brevo'] });
      return rep({ resultat: 'ok', expediteurs: [] });
    }
    return avant(e, init);
  };
});
const k = L + '-' + th;
const err = [];
async function page(hash) {
  const p = await ctx.newPage();
  p.on('pageerror', e => err.push('JS: ' + e.message));
  await p.goto(`http://127.0.0.1:${port}/mon-bureau/${hash}`, { waitUntil: 'load' });
  await p.waitForTimeout(6000);
  try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 1500 }); await p.waitForTimeout(800); } catch (e) {}
  return p;
}
const p = await page('#annuaire');
await p.waitForTimeout(2500);
/* Deux etiquettes « Gros client » et un recul : on les pose dans le suivi local. */
await p.evaluate(() => {
  const ids = (window.BdvAnnuaire._etat().FILTREE || []).map(c => c.id).slice(0, 3);
  ids.forEach(id => { CRM[id] = Object.assign({}, CRM[id] || {}, { tags: ['Gros client'] }); });
});
const bouton = p.locator('[data-a="brevo"]');
console.log('BOUTON', await bouton.isVisible().catch(() => false));
await bouton.click();
await p.waitForTimeout(900);
await p.screenshot({ path: OUT + k + '-listes-ouvert.png' });
await p.locator('#annuBrevo').screenshot({ path: OUT + k + '-listes-bloc.png' });
console.log('BLOC', (await p.locator('#annuBrevo').innerText()).replace(/\n+/g, ' | '));
await p.click('#bdvblCreer');
await p.waitForTimeout(1500);
await p.locator('#annuBrevo').screenshot({ path: OUT + k + '-listes-cree.png' });
console.log('CREE', (await p.locator('#annuBrevo .bdvbl-mot').innerText()));
await p.click('#annuBrevo [data-process]').catch(e => err.push('etat: ' + e.message));
await p.waitForTimeout(600);
console.log('ETAT', (await p.locator('#annuBrevo .bdvbl-mot').innerText()));
console.log('LARGEUR', JSON.stringify(await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))));
const q = await page('#clients');
await q.waitForTimeout(2500);
const b2 = q.locator('#clientsVersBrevo');
console.log('BOUTON COMMERCE', await b2.isVisible().catch(() => false));
await b2.click().catch(e => err.push('commerce: ' + e.message));
await q.waitForTimeout(800);
await q.locator('#clientsBrevo').screenshot({ path: OUT + k + '-listes-commerce.png' }).catch(e => err.push('cap commerce: ' + e.message));
console.log('COMMERCE', (await q.locator('#clientsBrevo').innerText().catch(() => '')).replace(/\n+/g, ' | '));
console.log('ERREURS', err.join(' | ') || 'aucune');
await nav.close(); srv.close(); process.exit(0);
