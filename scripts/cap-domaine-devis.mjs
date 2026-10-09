/* Capture du devis bloque par une fiche du domaine vide, et de la recherche faite DANS le devis
   (mise en route, lot 2, 09/10/2026). node scripts/cap-domaine-devis.mjs 1440:light (playwright, hors verif) */
import { contexte, ouvrirPage, servir, EXE } from './decor-gagner.mjs';
import { chromium } from 'playwright';
const OUT = process.env.OUT || '/tmp/capdom/';
const [L, th] = process.argv[2].split(':');
const port = 8900 + (+L < 700 ? 1 : 0) + (th === 'dark' ? 2 : 0);
const srv = await servir('./_site', port);
const nav = await chromium.launch({ executablePath: EXE });
const ctx = await contexte(nav, +L, th);
await ctx.addInitScript(() => {
  const avant = window.fetch;
  const rep = o => Promise.resolve(new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  window.fetch = function (e, init) {
    const url = String((e && e.url) || e || '');
    if (/recherche-entreprises/.test(url)) return rep({ results: [
      { siren: '123456789', nom_complet: 'EARL DOMAINE DES COTEAUX', etat_administratif: 'A', tva: ['FR32123456789'],
        siege: { siret: '12345678900017', numero_voie: '3', type_voie: 'RUE', libelle_voie: 'DES VIGNES', code_postal: '44190', libelle_commune: 'CLISSON' } },
      { siren: '987654321', nom_complet: 'SCEA LES HAUTS COTEAUX', etat_administratif: 'A', tva: null,
        siege: { siret: '98765432100011', libelle_voie: 'PLACE DE LA MAIRIE', code_postal: '84110', libelle_commune: 'VAISON-LA-ROMAINE' } }] });
    if (/rest\/v1\/domaine(\?|$)/.test(url) && !(init && init.method === 'POST')) return rep([]);
    return avant(e, init);
  };
});
const p0 = await ouvrirPage(ctx, port);
try { await p0.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 3000 }); } catch (e) {}
const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
await p.goto(`http://127.0.0.1:${port}/mon-bureau/#affaire=a1`, { waitUntil: 'load' });
await p.waitForTimeout(5000);
try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 1500 }); await p.waitForTimeout(800); } catch (e) {}
await p.locator('[data-aff="devis"], [data-aff="devisRaccourci"]').filter({ visible: true }).first().click();
await p.waitForTimeout(2500);
const k = L + '-' + th;
await p.screenshot({ path: OUT + k + '-1-bloque.png' });
await p.fill('#devDomQ', 'coteaux'); await p.click('[data-dev="domChercher"]'); await p.waitForTimeout(1200);
await p.screenshot({ path: OUT + k + '-2-resultats.png' });
console.log(k, JSON.stringify(await p.evaluate(() => ({ droite: [...document.querySelectorAll('.dmod__dom, .dmod__dom-champ, .dmod__phrase, #devisModale .tmod__boite, #devisModale .tmod__corps')].map(n => n.className + ':' + Math.round(n.getBoundingClientRect().right) + '/' + Math.round(n.getBoundingClientRect().left)), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  petites: [...document.querySelectorAll('.dmod__dom button, .dmod__dom input')].filter(e => e.getClientRects().length).map(e => { const b = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 20) || e.id, Math.round(b.height)]; }).filter(x => x[1] < 44) }))), 'ERREURS', JSON.stringify(err));
await nav.close(); srv.close && srv.close(); process.exit(0);
