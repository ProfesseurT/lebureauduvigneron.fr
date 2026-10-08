/* Captures des nouveaux clients (08/10/2026, lots 81 et 82) : « Mes clients » avec un client pas
   encore dans Vitisoft, le formulaire « Nouveau client » et son avertissement de nom proche, la
   fiche dans la boite et en pleine page. node scripts/cap-nouveaux.mjs 1440:light
   (playwright, hors verif) */
import { chromium } from 'playwright';
import { contexte, servir, EXE } from './decor-gagner.mjs';
const OUT = process.env.OUT || '/tmp/cap/';
const [L, th] = process.argv[2].split(':');
const port = 8750 + (+L < 700 ? 1 : 0) + (th === 'dark' ? 2 : 0);
const srv = await servir('./_site', port);
const nav = await chromium.launch({ executablePath: EXE });
const ctx = await contexte(nav, +L, th);
await ctx.addInitScript(() => {
  const T = window.__T; if (!T) return;
  const B = T.pistes[0].bureau;
  Object.assign(T.pistes[0], { nature: 'restaurant', ville: 'Angers', code_postal: '49000', adresse: '12 place des Halles', siret: '81234567800012', contact_fonction: 'Gérante' });
  T.pistes.push({ bureau: B, piste_id: 'p5', nom: 'Cave Leblanc', nature: 'caviste', ville: 'Saumur', code_postal: '49400', email: 'contact@cave-leblanc.fr', opposition: false },
                { bureau: B, piste_id: 'p6', nom: 'Bar du Port', nature: 'restaurant', ville: 'Nantes', opposition: true });
  T.suivi_clients = (T.suivi_clients || []).concat([{ bureau: B, client_id: 'p:p1', tags: ['Salon Angers'], rappel: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), rappel_titre: 'Envoyer la carte', statut: null }]);
  /* Le decor ne fait pas tourner le tirage du serveur : le suivi et le journal sont poses dans le
     miroir local, comme ils y seraient apres une lecture. */
  try {
    localStorage.setItem('bdv_crm_v1', JSON.stringify({ 'p:p1': { tags: ['Salon Angers'], rappel: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), rappel_titre: 'Envoyer la carte' } }));
    localStorage.setItem('bdv_echanges_v1', JSON.stringify({ 'p:p1': [{ echange_id: 'x9', client_id: 'p:p1', le: new Date(Date.now() - 2 * 86400000).toISOString(), type: 'appel', canal: 'appel', resume: 'Rencontrée au salon, veut une carte de 6 vins au verre.' }] }));
  } catch (e) {}
  T.echanges.push({ bureau: B, echange_id: 'x9', client_id: 'p:p1', le: new Date(Date.now() - 2 * 86400000).toISOString(), type: 'appel', canal: 'appel', resume: 'Rencontrée au salon, veut une carte de 6 vins au verre.' });
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
await p.waitForTimeout(3000);
await p.screenshot({ path: OUT + k + '-nv-liste.png' });
const nv = await p.evaluate(() => [...document.querySelectorAll('#annuCorps tr')].filter(t => /Vitisoft|contacté/.test(t.textContent)).map(t => t.getAttribute('data-id') + ' : ' + t.innerText.replace(/\s+/g, ' ').slice(0, 120)));
console.log('NOUVEAUX', JSON.stringify(nv));
await p.evaluate(() => { const d = document.querySelector('.annu__replis'); if (d) d.open = true; });
await p.selectOption('select[data-f="etat"]', 'nouveau').catch(e => err.push('filtre: ' + e.message));
await p.waitForTimeout(500);
await p.screenshot({ path: OUT + k + '-nv-filtre.png' });
await p.click('[data-a="nouveau"]'); await p.waitForTimeout(400);
await p.fill('[name="nv-nom"]', 'SARL Bistrot des Halles');
await p.click('#annuNouveau [data-a="nv-creer"]'); await p.waitForTimeout(500);
await p.screenshot({ path: OUT + k + '-nv-form-ecran.png' });
await p.locator('#annuNouveau').screenshot({ path: OUT + k + '-nv-form.png' });
console.log('FORM', await p.locator('#annuNouveau').innerText());
await p.click('#annuNouveau [data-a="nv-annuler"]'); await p.waitForTimeout(300);
await p.evaluate(() => { const d = document.querySelector('.annu__replis'); if (d) d.open = true; });
await p.selectOption('select[data-f="etat"]', 'nouveau'); await p.waitForTimeout(300);
await p.click('#annuCorps tr[data-id="p:p1"] a.annu__nom'); await p.waitForTimeout(2500);
await p.screenshot({ path: OUT + k + '-nv-fiche.png' });
console.log('FICHE', (await p.locator('#modale').innerText()).replace(/\s+/g, ' ').slice(0, 700));
const q = await page('#fiche=' + encodeURIComponent('p:p1'));
await q.screenshot({ path: OUT + k + '-nv-pleine.png', fullPage: true });
console.log('PLEINE', JSON.stringify(await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h1: (document.getElementById('bureauPiece') || {}).textContent, avis: (document.getElementById('bureauAvis') || {}).textContent }))));
const o = await page('#fiche=' + encodeURIComponent('p:p6'));
await o.screenshot({ path: OUT + k + '-nv-oppose.png' });
console.log('ERREURS', err.join(' | ') || 'aucune');
await nav.close(); srv.close(); process.exit(0);
