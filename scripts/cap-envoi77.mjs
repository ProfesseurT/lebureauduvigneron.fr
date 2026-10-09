/* Captures du lot 77 : « Envoyer depuis ma boite » dans le redacteur d'une affaire.
   node scripts/cap-envoi77.mjs 1440:light   (playwright, hors verif)
   BREVO=1 : lot 88, le maitre a coche les mails d'affaire pour Brevo (« Envoyer par Brevo »). */
import { chromium } from 'playwright';
import { contexte, ouvrirPage, servir, EXE } from './decor-gagner.mjs';
const OUT = process.env.OUT || '/tmp/cap/';
const [L, th] = process.argv[2].split(':');
const port = 8750 + (+L < 700 ? 1 : 0) + (th === 'dark' ? 2 : 0);
const srv = await servir('./_site', port);
const nav = await chromium.launch({ executablePath: EXE });
const ctx = await contexte(nav, +L, th);
await ctx.addInitScript(({ echec, brevo }) => {
  const avant = window.fetch;
  window.fetch = function (e, init) {
    const url = String((e && e.url) || e || '');
    const rep = o => Promise.resolve(new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (brevo && /rest\/v1\/brevo\?select=/.test(url)) return rep([{ etat: 'branche', compte_email: 'contact@closfertel.fr', compte_nom: 'Domaine du Clos Fertel', cle_fin: 'x7Qa', defaut_affaires: true, defaut_devis: true, defaut_programmes: true, branche_le: new Date().toISOString() }]);
    if (brevo && /rest\/v1\/brevo_choix\?select=/.test(url)) return rep([{ chemin: 'bureau', expediteur: 'julien@closfertel.fr', expediteur_nom: 'Julien, Domaine du Clos Fertel', copie_a_soi: true }]);
    if (brevo && /functions\/v1\/brevo/.test(url)) return new Promise(r => setTimeout(() => r(new Response(JSON.stringify(echec ? { resultat: 'refus_cle', mot: 'Brevo refuse la clé du bureau : le maître doit en coller une nouvelle dans Mes réglages, Mes envois.' } : { resultat: 'parti', de: 'julien@closfertel.fr', copie: true, par: 'brevo' }), { status: 200, headers: { 'Content-Type': 'application/json' } })), 600));
    if (/rest\/v1\/boites\?select=/.test(url)) return rep([{ adresse: 'julien@closfertel.fr', fournisseur: 'workspace', etat: 'branchee', utiliser: true, copie_a_soi: true, branchee_le: new Date().toISOString() }]);
    if (/functions\/v1\/boite/.test(url)) return new Promise(r => setTimeout(() => r(new Response(JSON.stringify(echec ? { resultat: 'refus' } : { resultat: 'parti', de: 'julien@closfertel.fr', copie: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })), 600));
    return avant(e, init);
  };
}, { echec: process.env.ECHEC === '1', brevo: process.env.BREVO === '1' });
const p = await ouvrirPage(ctx, port);
const W = ms => p.waitForTimeout(ms);
const k = L + '-' + th + (process.env.ECHEC === '1' ? '-echec' : '') + (process.env.BREVO === '1' ? '-brevo' : '');
try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 3000 }); } catch (e) {}
await W(500);
await p.evaluate(() => { try{localStorage.setItem('bdv_aff_vue','liste')}catch(e){}; BdvNav.afficher('affaires'); }); await W(1500);
const lig = p.locator('#bureauAffaires button:visible', { hasText: /Bistrot des Halles/ }).first();
await lig.click(); await W(2000);
await p.locator('#affaireModale [data-aff="ecrireMail"]').first().click(); await W(900);
await p.locator('#affaireModale #affRedac').screenshot({ path: OUT + 'envoi77-' + k + '-avant.png' });
console.log('BOUTONS', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('#affaireModale .aff-redac__gestes > *')].map(x => x.textContent.trim() + (x.classList.contains('btn--bordeaux') ? ' [plein]' : '')))));
await p.locator('#affaireModale [data-aff="redacEnvoyer"]').click(); await W(2500);
await p.screenshot({ path: OUT + 'envoi77-' + k + '-apres.png' });
console.log('MOT', JSON.stringify(await p.evaluate(() => (document.querySelector('#affaireModale .aff-redac__mot') || {}).textContent)));
console.log('ERR', JSON.stringify(p.__err));
await nav.close(); srv.close && srv.close(); process.exit(0);
