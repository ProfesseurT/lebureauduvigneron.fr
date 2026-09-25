/* Capture de « Ma journee » garnie, plusieurs largeurs, deux themes, avec ou sans tiroir.
   Usage : node scripts/capture-journee.mjs <dossier-sortie> [etiquette] */
import { chromium } from 'playwright';
import { servir } from './capture-serveur.mjs';
import { lignesDeVente, garnirLeBureau, doublerLesBibliotheques, verifierLeBureauGarni } from './bureau-garni.mjs';
import fs from 'node:fs';

const OUT = process.argv[2] || 'captures';
const TAG = process.argv[3] || 'x';
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8201;
const srv = await servir('./site', PORT);
const LIGNES = lignesDeVente();
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const CAS = (process.env.CAS || '1440:0,1750:1,1100:0,390:0').split(',').map(s => { const [w, t] = s.split(':'); return { w: +w, tiroir: t === '1' }; });
const THEMES = (process.env.THEMES || 'light,dark').split(',');
const mesures = [];
for (const theme of THEMES) for (const c of CAS) {
  const ctx = await nav.newContext({ viewport: { width: c.w, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(t => { try { localStorage.setItem('bureau_theme_v1', t); } catch (e) {} }, theme);
  await ctx.route('**', r => { const u = r.request().url(); return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await garnirLeBureau(ctx, LIGNES);
  /* Le mot du jour : le decor commun ne porte pas de conseils. On en ajoute, comme la vraie page. */
  await ctx.addInitScript(() => { try {
    const f = JSON.parse(localStorage.getItem('bdv_file_v1'));
    Object.assign(f.resume, { mois:[98000,112000,87000,76000,91000,104000,142000,121000,69000,0,0,0], moisDebut:1, dernierMois:9, variationEuros:42800, objectifPct:89, atterrissage:1320000, exercice:'2026', du:'02/01/2026', au:'24/09/2026' });
    f.resume.conseils = [
      { sev:3, kind:'danger', ico:'\u26a0', cible:'clients', verdict:'45 clients en décrochage : 50 845 € de CA en moins vs l’exercice précédent à date égale.', action:'À rappeler en priorité, du plus gros montant perdu au plus petit. La liste est dans <b>Mon commerce</b>, filtre « Recul confirmé ».' },
      { sev:2, kind:'warn', cible:'produits', verdict:'Le Rosé 2024 : 312 bouteilles encore à écouler.', action:'Chapelle &amp; Fils en prenait 60 par an.' },
      { sev:1, kind:'ok', cible:'annee', verdict:'Objectif jouable.', action:'Atterrissage 1 120 000 €.' },
      { sev:1, kind:'info', cible:'annee', verdict:'Juillet est ton meilleur mois.', action:'Prépare ta relance en juin.' },
      { sev:1, kind:'info', verdict:'Deux salons en octobre.', action:'Vignobles en Scène le 16.' } ];
    localStorage.setItem('bdv_file_v1', JSON.stringify(f));
  } catch (e) {} });
  await doublerLesBibliotheques(ctx);
  const p = await ctx.newPage();
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/mon-bureau/`, { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  try { await p.getByRole('button', { name: /ouvrir quand m/i }).click({ timeout: 3000 }); } catch (e) {}
  await p.waitForTimeout(1000);
  await p.evaluate(() => window.BdvNav && BdvNav.afficher('journee'));
  await p.waitForTimeout(1000);
  try { await verifierLeBureauGarni(p); } catch (e) { console.error('DECOR :', e.message.slice(0, 300)); }
  /* Le profil n'arrive pas hors ligne : on pose les textes que la vraie page porte. */
  await p.evaluate(() => {
    const s = document.getElementById('bureauSalut'); if (s) s.textContent = 'Bonjour Ted.';
    const pl = document.getElementById('bureauPlaque'); if (pl) { pl.textContent = 'Solucorp · Vigneron'; pl.hidden = false; }
  });
  if (c.tiroir) {
    await p.evaluate(() => { const b = document.querySelector('#bureauFile .listb__l button, #bureauFile .listb__l .listb__nom'); if (b) b.click(); });
    await p.waitForTimeout(2500);
  }
  await p.waitForTimeout(400);
  const nom = `${TAG}-${theme}-${c.w}${c.tiroir ? '-tiroir' : ''}`;
  const cdp = await p.context().newCDPSession(p); globalThis.__cdp = cdp;
  const shot = async (path, full) => { const m = full ? await p.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight })) : null; const r = await cdp.send('Page.captureScreenshot', full ? { format:'png', captureBeyondViewport:true, clip:{x:0,y:0,width:m.w,height:m.h,scale:1} } : { format:'png' }); fs.writeFileSync(path, Buffer.from(r.data,'base64')); };
  await shot(`${OUT}/${nom}.png`, false);
  await shot(`${OUT}/${nom}-page.png`, true);
  const m = await p.evaluate(() => {
    const R = id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const mini = document.getElementById('bureauLuneMini');
    return { salut: R('bureauSalut'), lune: R('bureauLune'), mot: R('zoneMot'), panneau: R('zonePanneau'), ardoise: R('zoneArdoise'),
      miniVisible: !!(mini && !mini.hidden && getComputedStyle(mini).display !== 'none' && getComputedStyle(mini).visibility !== 'hidden' && +getComputedStyle(mini).opacity > 0.1),
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  /* Defilement : la lune de l'accueil sort, la mini doit revenir. */
  await p.evaluate(() => window.scrollTo(0, 700)); await p.waitForTimeout(600);
  m.miniApresDefilement = await p.evaluate(() => { const mini = document.getElementById('bureauLuneMini'); if (!mini || mini.hidden) return false; const s = getComputedStyle(mini); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.1; });
  await shot(`${OUT}/${nom}-defile.png`, false);
  mesures.push({ nom, ...m, erreurs: err });
  await ctx.close();
}
fs.writeFileSync(`${OUT}/${TAG}-mesures.json`, JSON.stringify(mesures, null, 1));
console.log(JSON.stringify(mesures.map(m => ({ n: m.nom, lune: m.lune, salut: m.salut, mini: m.miniVisible, miniDef: m.miniApresDefilement, deb: m.debord, err: m.erreurs.length })), null, 0));
await nav.close(); srv.close();
