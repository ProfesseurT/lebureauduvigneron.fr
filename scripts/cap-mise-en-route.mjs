/* Capture de « Ta mise en route » (09/10/2026) sur la vraie page construite, sans reseau.
   Le decor de bureau-garni.mjs, puis une doublure des lectures que fait le module
   (profil, role, reglages, affaires) et de l'etat de la boite, du domaine, de la signature.
   Usage : node scripts/cap-mise-en-route.mjs <dossier> ; CAS=admin,refaire,membre,sansviti,reglages */
import { chromium } from 'playwright';
import { servir } from './capture-serveur.mjs';
import { lignesDeVente, garnirLeBureau, doublerLesBibliotheques } from './bureau-garni.mjs';
import fs from 'node:fs';
const OUT = process.argv[2] || 'captures'; fs.mkdirSync(OUT, { recursive: true });
const PORT = 8213; const srv = await servir('./_site', PORT);
const LIGNES = lignesDeVente();
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const SC = {
  admin:    { role: true,  viti: 'oui', depose: '2026-10-02T08:00:00Z', valide: false, dom: true,  boite: 'rien' },
  refaire:  { role: true,  viti: 'oui', depose: '2026-10-02T08:00:00Z', valide: true,  dom: true,  boite: 'reconnecter' },
  membre:   { role: false, viti: 'oui', sig: false, boite: 'rien' },
  sansviti: { role: true,  viti: 'non', dom: true, affaires: [], boite: 'rien' },
  reglages: { role: true,  viti: 'oui', depose: '2026-10-02T08:00:00Z', valide: false, dom: true, boite: 'rien' }
};
const CAS = (process.env.CAS || 'admin,refaire,membre,sansviti,reglages').split(',');
const LARG = (process.env.LARG || '1440,390').split(',').map(Number);
const THEMES = (process.env.THEMES || 'light,dark').split(',');
const rapport = [];
for (const th of THEMES) for (const w of LARG) for (const cas of CAS) {
  const ctx = await nav.newContext({ viewport: { width: w, height: 900 } });
  await ctx.addInitScript(t => { try { localStorage.setItem('bureau_theme_v1', t); localStorage.removeItem('bdv_mer_pas_v1'); } catch (e) {} }, th);
  await ctx.route('**', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await garnirLeBureau(ctx, LIGNES); await doublerLesBibliotheques(ctx);
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/mon-bureau/`, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 3000 }); } catch (e) {}
  await p.waitForTimeout(800);
  await p.evaluate(() => window.BdvNav && BdvNav.afficher('journee')); await p.waitForTimeout(500);
  const etat = await p.evaluate(async (s) => {
    const avant = BdvCompte.api;
    BdvCompte.api = async (ch, o) => {
      if (ch.startsWith('/rpc/est_maitre')) return s.role;
      if (ch.startsWith('/profils')) return [{ prenom: 'Ted', utilise_vitisoft: s.viti }];
      if (ch.startsWith('/reglages?select=depose_le')) return [{ depose_le: s.depose || null, valide: !!s.valide }];
      if (ch.startsWith('/affaires?select=issue')) return s.affaires || [];
      return avant(ch, o);
    };
    BdvDomaine.lue = () => true; BdvDomaine.complete = () => !!s.dom;
    const B = { LU: true, BOITE: s.boite === 'rien' ? null : { etat: s.boite } };
    BdvBoite._etat = () => B; BdvBoite.prete = () => s.boite === 'branchee';
    BdvSignature.lue = () => true; BdvSignature.perso = () => (s.sig ? { nom: 'Romane' } : null);
    const sal = document.getElementById('bureauSalut'); if (sal) sal.textContent = s.role === false ? 'Bonjour Romane.' : 'Bonjour Ted.';
    const e = await BdvMiseEnRoute.relire().then(() => BdvMiseEnRoute.etat());
    return e && { fait: e.fait, total: e.total, suite: e.suite && e.suite.cle };
  }, SC[cas]);
  if (cas === 'reglages') { await p.evaluate(() => BdvNav.ouvrirReglages()); await p.waitForTimeout(1200); }
  await p.waitForTimeout(400);
  const nom = `mer-${cas}-${th}-${w}`;
  if (cas === 'reglages') await p.screenshot({ path: `${OUT}/${nom}.png` });
  else { const z = await p.$('#bureauMer:not([hidden])'); if (z) await p.screenshot({ path: `${OUT}/${nom}.png`, clip: await (async () => { const b = await z.boundingBox(); return { x: 0, y: Math.max(0, b.y - 90), width: w, height: Math.min(900, b.height + 200) }; })() }); else rapport.push(nom + ' : CARTE ABSENTE'); }
  const debord = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  rapport.push(`${nom} : ${JSON.stringify(etat)} debord=${debord} erreurs=${err.length ? err.join(' | ').slice(0, 200) : 0}`);
  await ctx.close();
}
console.log(rapport.join('\n')); await nav.close(); srv.close();
