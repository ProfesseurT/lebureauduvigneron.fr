/* Decor du lot 44 (verificateur) : le serveur double des affaires, par-dessus garnirLeBureau. */
import { chromium } from 'playwright';
import { servir } from './capture-serveur.mjs';
import { lignesDeVente, garnirLeBureau, doublerLesBibliotheques, verifierLeBureauGarni, BUREAU_A } from './bureau-garni.mjs';
export { servir };
/* Le decor commun achete tous les mois, chez tous : « Personne a relancer ». On y fabrique
   des raisons, sans toucher au fichier commun : un recul, une cadence rompue, un deuxieme achat. */
export function lignesAvecSignaux() {
  const ann = r => +r.raw[0].slice(6), mois = r => +r.raw[0].slice(3, 5);
  let out = lignesDeVente().filter(l => !(l.raw[17] === 'C0288' && ann(l) === 2026 && mois(l) >= 5));
  out.forEach(l => { if ((l.raw[17] === 'C0412' || l.raw[17] === 'C0901') && ann(l) === 2026) { const q = Math.max(1, Math.round(+l.raw[19] * 0.35)); l.raw[19] = String(q); l.raw[15] = String(q * +l.raw[14]); } });
  const tpl = out[0].raw;
  [['Bistrot du Marché Neuf', 'C0999', '10/07/2026'], ['Épicerie Fine Lemoine', 'C0998', '02/07/2026']].forEach(([nom, num, d], i) => {
    const raw = tpl.slice(); raw[0] = d; raw[1] = 'F9' + i; raw[16] = nom; raw[17] = num; raw[19] = '24'; raw[15] = String(24 * +raw[14]); raw[40] = 'contact@exemple.fr'; raw[41] = ''; raw[42] = '06 00 00 00 0' + i;
    out.push({ h: 'hx' + i, raw });
  });
  return out;
}
export const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export async function contexte(nav, largeur, theme) {
  const tel = largeur < 700;
  const ctx = await nav.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: tel ? 2 : 1,
    userAgent: tel ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1' : undefined });
  await garnirLeBureau(ctx, process.env.DECOR_BRUT ? lignesDeVente() : lignesAvecSignaux());
  await doublerLesBibliotheques(ctx);
  if (!process.env.NOFAKE) await ctx.addInitScript(({ B, theme, HORS33 }) => {
    try { localStorage.setItem('bureau_theme_v1', theme); } catch (e) {}
    const jour = new Date().toISOString();
    const T = { affaire_types: [{ bureau: B, type_id: 't1', nom: 'Caviste / restaurant', famille: 'client', sommeil_jours: 30, ordre: 0, archive: false, cree_le: jour }],
      affaire_etapes: [{ bureau: B, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 }, { bureau: B, etape_id: 'e2', type_id: 't1', nom: 'Échantillon envoyé', ordre: 2 }, { bureau: B, etape_id: 'e3', type_id: 't1', nom: 'Commande', ordre: 3 }],
      pistes: [{ bureau: B, piste_id: 'p1', nom: 'Bistrot des Halles', telephone: '06 12 00 00 01', opposition: false }],
      affaires: [
        { bureau: B, affaire_id: 'a1', type_id: 't1', etape_id: 'e2', client_id: 'C0288', client_nom: 'Cave du Vieux Pressoir', titre: 'Le magnum de rosé pour Noël', issue: 'en_cours', rappel: new Date(Date.now()-3*86400000).toISOString().slice(0,10), rappel_titre: 'Lui faire goûter le 2025', etape_le: jour, maj_le: jour, cree_le: jour },
        { bureau: B, affaire_id: 'a3', type_id: 't1', etape_id: 'e1', client_id: 'C0412', client_nom: 'Domaine des Hauts Coteaux et Fils', titre: 'Le BIB pour le caveau', issue: 'en_cours', rappel: null, etape_le: new Date(Date.now()-60*86400000).toISOString(), maj_le: jour, cree_le: jour },
        { bureau: B, affaire_id: 'a2', type_id: 't1', etape_id: 'e1', piste_id: 'p1', titre: 'Carte des vins au verre', issue: 'en_cours', rappel: new Date(Date.now()+5*86400000).toISOString().slice(0,10), etape_le: jour, maj_le: jour, cree_le: jour } ] };
    window.__T = T; let n = 0;
    const avant = window.fetch;
    window.fetch = function (e, init) {
      const url = String((e && e.url) || e || '');
      if (/\/suivi_clients/.test(url)) window.__N33 = (window.__N33 || 0) + 1;
      const m = url.match(new RegExp('supabase\\.co/rest/v1/(affaire_types|affaire_etapes|pistes|affaires|affaire_notes' + (HORS33 ? '' : '|suivi_clients|vues_clients') + ')(\\?|$)'));
      if (!m) return avant(e, init);
      const t = m[1], meth = (init && init.method) || 'GET';
      const rep = o => Promise.resolve(new Response(o == null ? '' : JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      T[t] = T[t] || [];
      if (meth === 'GET') {
        let l = T[t];
        if (/issue=eq\.en_cours/.test(url)) l = l.filter(a => a.issue === 'en_cours');
        return rep(l);
      }
      if (meth === 'POST') { const c = JSON.parse(init.body || '[]'); (Array.isArray(c) ? c : [c]).forEach(x => { const k = t === 'pistes' ? 'piste_id' : 'affaire_id'; T[t].push(Object.assign({ [k]: 'n' + (++n), issue: 'en_cours', etape_le: jour, maj_le: jour, cree_le: jour }, x)); }); return rep(null); }
      if (meth === 'PATCH') { const c = JSON.parse(init.body || '{}'); const id = (url.match(/_id=eq\.([^&]+)/) || [])[1]; const r = T[t].filter(x => Object.values(x).includes(decodeURIComponent(id || ''))); r.forEach(x => Object.assign(x, c)); return rep(r); }
      return rep([]);
    };
  }, { B: BUREAU_A, theme, HORS33: !!process.env.HORS33 });
  return ctx;
}
export async function ouvrirPage(ctx, port) {
  const p = await ctx.newPage();
  p.__err = [];
  p.on('dialog', d => { p.__err.push('DIALOGUE ' + d.type() + ': ' + d.message()); d.accept().catch(() => {}); });
  p.on('pageerror', e => p.__err.push('JS: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) p.__err.push('CONSOLE: ' + m.text()); });
  await p.goto(`http://127.0.0.1:${port}/mon-bureau/`, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  await verifierLeBureauGarni(p);
  return p;
}
