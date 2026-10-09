/* Captures du lot 90 : ce que Brevo renvoie. Hors `verif` (playwright).
   node scripts/cap-retours.mjs 1440:light   (ou 390:dark)
   Decor : Brevo branche, retours branches ; commande@vieux-pressoir-de-bourgogne.fr (Cave du Vieux Pressoir) desinscrit des campagnes (avec deux
   mails partis, ouvert puis clique), julie@bistrot-halles.fr adresse morte, contact@exemple.fr
   en spam. */
import { chromium } from 'playwright';
import { contexte, ouvrirPage, servir, EXE } from './decor-gagner.mjs';
const OUT = process.env.OUT || '/tmp/cap/';
const [L, th] = process.argv[2].split(':');
const port = 8790 + (+L < 700 ? 1 : 0) + (th === 'dark' ? 2 : 0);
const srv = await servir('./_site', port);
const nav = await chromium.launch({ executablePath: EXE });
const ctx = await contexte(nav, +L, th);
await ctx.addInitScript(() => {
  const B = 'b0000000-0000-0000-0000-000000000001';
  const emp = async (a) => { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(B + ':' + a))); return [...h].map(o => o.toString(16).padStart(2, '0')).join(''); };
  const ACC = [];
  const il = (j, h, m) => { const d = new Date(); d.setDate(d.getDate() - j); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const avant = window.fetch;
  window.fetch = function (e, init) {
    const url = String((e && e.url) || e || '');
    const rep = o => Promise.resolve(new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (/rest\/v1\/brevo\?select=retours_etat/.test(url)) return rep([{ retours_etat: 'branches', retours_le: il(3, 9, 0), rattrape_le: il(3, 9, 1) }]);
    if (/rest\/v1\/brevo\?select=/.test(url)) return rep([{ etat: 'branche', compte_email: 'contact@closfertel.fr', compte_nom: 'Domaine du Clos Fertel', cle_fin: 'x7Qa', defaut_affaires: true, defaut_devis: true, defaut_programmes: true, branche_le: il(3, 9, 0) }]);
    if (/rest\/v1\/brevo_choix\?select=/.test(url)) return rep([{ chemin: 'bureau', expediteur: 'julien@closfertel.fr', expediteur_nom: 'Julien', copie_a_soi: true }]);
    if (/rest\/v1\/boites\?select=/.test(url)) return rep([{ adresse: 'julien@closfertel.fr', fournisseur: 'workspace', etat: 'branchee', utiliser: true, copie_a_soi: true, branchee_le: il(9, 9, 0) }]);
    if (/rest\/v1\/rpc\/est_maitre/.test(url)) return rep(true);
    if (/rest\/v1\/brevo_bloquees\?/.test(url)) return (async () => rep([
      { empreinte: await emp('commande@vieux-pressoir-de-bourgogne.fr'), source: 'campagne', motif: 'desinscrit', depuis: il(20, 9, 0) },
      { empreinte: await emp('julie@bistrot-halles.fr'), source: 'transactionnel', motif: 'morte', depuis: il(2, 11, 0) },
      { empreinte: await emp('contact@exemple.fr'), source: 'campagne', motif: 'spam', depuis: il(40, 9, 0) }]))();
    if (/rest\/v1\/suivi_accords\?/.test(url)) return rep(ACC.slice());
    if (/rest\/v1\/rpc\/suivi_accorder/.test(url)) { const c = JSON.parse(init.body); if (c.p_oui) ACC.push({ empreinte: c.p_empreinte, accepte_le: new Date().toISOString() }); else ACC.length = 0; return rep(true); }
    if (/rest\/v1\/rpc\/brevo_suivi/.test(url)) return (async () => { const e2 = await emp('commande@vieux-pressoir-de-bourgogne.fr'); const ok = ACC.length > 0; return rep([
      { empreinte: e2, envoi_le: il(1, 8, 30), sorte: 'affaires', evenement: null, le: null },
      ...(ok ? [{ empreinte: e2, envoi_le: il(6, 10, 5), sorte: 'devis', evenement: 'ouvert', le: il(6, 10, 47) }, { empreinte: e2, envoi_le: il(6, 10, 5), sorte: 'devis', evenement: 'clic', le: il(6, 11, 2) }]
          : [{ empreinte: e2, envoi_le: il(6, 10, 5), sorte: 'devis', evenement: null, le: null }])]); })();
    if (/functions\/v1\/brevo/.test(url)) return rep({ resultat: 'ok', expediteurs: [{ email: 'julien@closfertel.fr', nom: 'Julien', actif: true }] });
    return avant(e, init);
  };
});
const k = L + '-' + th;
// 1. La fiche de la Cave du Vieux Pressoir, en pleine page (comme cap-page-travail.mjs)
{
const p = await ctx.newPage();
const W = ms => p.waitForTimeout(ms);
p.on('pageerror', e => console.log('JS: ' + e.message));
await p.goto(`http://127.0.0.1:${port}/mon-bureau/#fiche=C0288`, { waitUntil: 'load' });
await W(6000);
try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 1500 }); await W(800); } catch (e) {}
await p.evaluate(() => { const r = document.querySelector('[data-retours-fiche]'); if (r) r.scrollIntoView({ block: 'center' }); }); await W(300);
await p.screenshot({ path: OUT + 'retours-' + k + '-fiche.png' });
await p.evaluate(() => { const c = document.querySelector('[data-ret="accord"]'); c.click(); }); await W(1200);
await p.evaluate(() => { const r = document.querySelector('[data-retours-fiche]'); if (r) r.scrollIntoView({ block: 'start' }); }); await W(300);
await p.screenshot({ path: OUT + 'retours-' + k + '-fiche-accord.png' });
await p.evaluate(() => { const d = document.querySelector('.fiche__redac'); if (d) { d.open = true; const a = document.querySelector('#msgZone [data-retour-mail]'); (a || d).scrollIntoView({ block: 'center' }); } }); await W(800);
await p.screenshot({ path: OUT + 'retours-' + k + '-message.png' });
const fiche = await p.evaluate(() => ({ bloc: (document.querySelector('[data-retours-fiche]') || {}).innerText, avis: (document.querySelector('#msgZone [data-retour-mail]') || {}).innerText,
  sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
console.log('FICHE', JSON.stringify(fiche));
await p.close();
}
const p = await ouvrirPage(ctx, port);
const W = ms => p.waitForTimeout(ms);
try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 3000 }); } catch (e) {}
await W(800);

// 2. Le redacteur de l'affaire du Bistrot des Halles (adresse morte)
await p.evaluate(() => { try { localStorage.setItem('bdv_aff_vue', 'liste'); } catch (e) {} BdvNav.afficher('affaires'); }); await W(1500);
await p.locator('#bureauAffaires button:visible', { hasText: /Bistrot des Halles/ }).first().click(); await W(1800);
await p.locator('#affaireModale [data-aff="ecrireMail"]').first().click(); await W(1000);
await p.locator('#affaireModale #affRedac').screenshot({ path: OUT + 'retours-' + k + '-affaire.png' });
console.log('AFFAIRE', JSON.stringify(await p.evaluate(() => (document.querySelector('#affaireModale [data-retour-mail]') || {}).innerText)));
await p.keyboard.press('Escape'); await W(600);

// 3. Mes clients
await p.evaluate(() => BdvNav.afficher('annuaire')); await W(2500);
await p.evaluate(() => { const m = document.querySelector('.ret-marque'); if (m) m.closest('tr').scrollIntoView({ block: 'center' }); }); await W(400);
await p.screenshot({ path: OUT + 'retours-' + k + '-clients.png' });
console.log('CLIENTS', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.ret-marque')].map(x => x.closest('tr').querySelector('.annu__nom').textContent + ' : ' + x.textContent))));

// 4. Mes envois
await p.evaluate(() => BdvNav.ouvrirReglages('envois')); await W(1800);
await p.evaluate(() => { const z = document.getElementById('bdvvRetours'); if (z) z.scrollIntoView({ block: 'center' }); }); await W(400);
await p.screenshot({ path: OUT + 'retours-' + k + '-envois.png' });
console.log('ENVOIS', JSON.stringify(await p.evaluate(() => (document.getElementById('bdvvRetours') || {}).innerText)));
console.log('ERR', JSON.stringify(p.__err));
await nav.close(); srv.close && srv.close(); process.exit(0);
