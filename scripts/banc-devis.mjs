/* ============================================================================
   scripts/banc-devis.mjs : LE DEVIS, lot 47 (30/09/2026)
   ============================================================================
       npm run banc:devis        (lit les SOURCES, pas _site : aucun build requis)

   Ce qu'il garde, et ce que chaque point coute s'il lache :
   1. LES CALCULS, sur la table de cas partagee avec la RPC
      (scripts/fixtures/devis-calculs.json, ecrite par un script Python a part) :
      un centime d'ecart avec Vitisoft, et la facture ne rapproche plus le devis.
   2. LA PIECE, dans jsdom, avec un FAUX SERVEUR : chaque requete nomme son bureau ;
      un retour vide n'est JAMAIS « enregistre » ; aucun numero avant l'enregistrement ;
      un devis abandonne ne se modifie plus ; la provenance du prix est dite, et un
      prix change a la main part en 'saisi' ; fiche du domaine incomplete = blocage
      des l'ouverture ; SQL pas encore passe = la phrase dediee ; BdvTiroir pose et
      retire la boite ; ids uniques, prefixes `dev` ; ni onclick ni tiret cadratin.
   3. LE PAPIER (`htmlPapier`, pur) : numero, date, validite, conditions de
      `BdvDomaine.conditions()`, « droits d'accises inclus », penalites et 40 EUR,
      TVA 20 %, numero de TVA du domaine s'il existe, jamais de numero d'accises.
   4. LE POIDS : rien dans bdv-nav.js ni dans la page, tout est pose au clic.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { createHash } from 'node:crypto';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const SRC_CALC = lire('src/js/bdv-devis-calcul.js');
const SRC_DEVIS = lire('src/js/bdv-devis.js');
const SRC_DOMAINE = lire('src/js/bdv-domaine.js');
const SRC_AFF = lire('src/js/bdv-affaires.js');
const BUREAU = 'b4700000-0000-0000-0000-000000000047';

let OK = 0, KO = 0;
const t = (nom, v, detail) => {
  if (v) { OK++; console.log('  ok    : ' + nom); }
  else { KO++; console.log('  ECHEC : ' + nom + (detail !== undefined ? '  ->  ' + detail : '')); }
};
const titre = s => console.log('\n== ' + s + ' ==');
/* UNE PROMESSE REJETEE SANS PRISE EST UN ECHEC DIT, pas un banc qui s'arrete muet : c'est
   exactement ce que ferait un devis qui prend un retour vide pour un succes. */
process.on('unhandledRejection', (e) => { KO++; console.log('  ECHEC : promesse rejetee sans prise : ' + (e && e.message)); });
const pause = (ms) => new Promise(r => setTimeout(r, ms || 0));
/* UNE ATTENTE QUI NE DEVINE PAS (01/10/2026) : la boite s'est alourdie, et sur une machine
   chargee dix millisecondes ne suffisaient plus a voir aboutir un enregistrement. On attend
   le delai demande, PUIS que le faux serveur n'ait plus aucune requete en vol. */
let EN_VOL = 0;
const attendre = async (ms) => { await pause(ms); let n = 0; while (EN_VOL > 0 && n++ < 500) await pause(2); if (n) await pause(2); };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/* ---------------------------------------------------------------------------- */
titre('1. Les calculs, sur la table de cas partagee avec la RPC');
const require = createRequire(import.meta.url);
const C = require(path.join(RACINE, 'src/js/bdv-devis-calcul.js'));
const FIX = JSON.parse(lire('scripts/fixtures/devis-calculs.json'));
const cas = FIX.cas || [];
t('la table porte au moins 12 cas', cas.length >= 12, cas.length);
const noms = cas.map(c => c.nom).join(' | ');
t('elle couvre 0 et 100 %, les demis centimes, remise ligne + globale, 200 lignes, les grands montants',
  /0 %/.test(noms) && /100 %/.test(noms) && /demi/.test(noms) && /ligne .*globale/.test(noms)
  && cas.some(c => c.lignes.length === 200) && cas.some(c => c.attendu.total_ht * 2000 > Number.MAX_SAFE_INTEGER), noms);
t('elle est ecrite par un script Python a part, pas par le code qu\'elle controle',
  fs.existsSync(path.join(RACINE, 'scripts/fixtures/devis-calculs.py')) && /ROUND_HALF_UP/.test(lire('scripts/fixtures/devis-calculs.py'))
  && !/bdv-devis-calcul/.test(sansCommentaires(lire('scripts/fixtures/devis-calculs.py')).replace(/^#.*$/gm, '')));
/* LOT 53 : le calcul rend aussi `port` (0 sans port). La table de cas est d'avant le port :
   on la compare sans lui, et on verifie a part qu'il vaut 0 et ne change rien. */
/* LOT 54 : le calcul rend aussi `taux` (les bases par taux) et le taux de chaque ligne. */
const sansPort = (r) => { const x = Object.assign({}, r); delete x.port; delete x.taux;
  x.lignes = x.lignes.map(l => { const y = Object.assign({}, l); delete y.tva_cb; return y; }); return x; };
const ecarts = cas.filter(c => JSON.stringify(sansPort(C.devis(c.lignes, c.remise_globale_cb, 2000))) !== JSON.stringify(c.attendu));
t('sans port, le calcul rend port 0 et les memes centimes qu\'avant', cas.every(c => C.devis(c.lignes, c.remise_globale_cb, 2000).port === 0
  && JSON.stringify(sansPort(C.devis(c.lignes, c.remise_globale_cb, 2000, 0))) === JSON.stringify(c.attendu)));
t('avec port : HT = somme des final + port, la remise ne touche pas le port, TVA sur le tout',
  cas.every(c => { const a = C.devis(c.lignes, c.remise_globale_cb, 2000), b = C.devis(c.lignes, c.remise_globale_cb, 2000, 1999);
    return b.total_ht === a.total_ht + 1999 && b.remise_globale === a.remise_globale && b.tva === C.mulDiv(a.total_ht + 1999, 2000, 10000) && b.ttc === b.total_ht + b.tva; }));
t('chaque cas rend EXACTEMENT les centimes attendus (' + cas.length + ' cas)', ecarts.length === 0,
  ecarts.map(c => c.nom + ' : ' + JSON.stringify(Object.assign({}, C.devis(c.lignes, c.remise_globale_cb), { lignes: undefined }))).join(' ; '));
t('colonne 23 x quantite = colonne 24, sur toutes les lignes de la table',
  cas.every(c => C.devis(c.lignes, c.remise_globale_cb).lignes.every((l, i) => l.final === c.lignes[i].qte * l.pu_f)));
t('la remise globale est la DIFFERENCE total vins - total HT', cas.every(c => { const r = C.devis(c.lignes, c.remise_globale_cb); return r.remise_globale === r.total_vins - r.total_ht; }));
t('arrondi demi vers le haut, en entier : 1005 a 50 % = 503, 999 a 50 % = 500, 1 a 75 % = 0',
  C.mulDiv(1005, 5000, 10000) === 503 && C.mulDiv(999, 5000, 10000) === 500 && C.mulDiv(1, 2500, 10000) === 0);
t('au-dela de 2^53 le calcul reste exact (BigInt), il ne perd pas un centime',
  C.mulDiv(1799788206917650, 2000, 10000) === 359957641383530 && C.mulDiv(9007199254740991, 9999, 10000) === 9006298534815517);
const src = sansCommentaires(SRC_CALC);
t('aucun flottant dans un montant : ni parseFloat, ni toFixed, ni Math.round', !/parseFloat|toFixed|Math\.round/.test(src));
t('centimes("8,50") = 850, "8,5" = 850, "8" = 800, "1 234,56" = 123456',
  C.centimes('8,50') === 850 && C.centimes('8,5') === 850 && C.centimes('8') === 800 && C.centimes('1 234,56') === 123456);
t('centimes : plus de 2 decimales, texte, signe -> null (jamais d\'arrondi silencieux)',
  C.centimes('8,505') === null && C.centimes('abc') === null && C.centimes('-1') === null && C.centimes('') === null && C.centimes('8,5,0') === null);
t('remiseCb("12,5") = 1250, "100" = 10000, "0,01" = 1, "12,345" = null',
  C.remiseCb('12,5') === 1250 && C.remiseCb('100') === 10000 && C.remiseCb('0,01') === 1 && C.remiseCb('12,345') === null);
t('euros(123456) = « 1 234,56 € », espace fine insecable et insecable avant €',
  C.euros(123456) === '1 234,56 €' && C.euros(5) === '0,05 €' && C.euros(123456789) === '1 234 567,89 €', JSON.stringify(C.euros(123456)));
t('pourcent : 500 -> 5, 1250 -> 12,5, 1205 -> 12,05', C.pourcent(500) === '5' && C.pourcent(1250) === '12,5' && C.pourcent(1205) === '12,05');
t('le module est UMD : module.exports ET window.BdvDevisCalcul', /module\.exports\s*=\s*api/.test(src) && /racine\.BdvDevisCalcul\s*=\s*api/.test(src));

/* ----------------------------------------------------------------------------
   LE HARNAIS : la piece dans jsdom, le vrai bdv-domaine.js, un faux serveur.
   ---------------------------------------------------------------------------- */
const FICHE = { bureau: BUREAU, raison_sociale: 'EARL DOMAINE DES ESSAIS', forme_juridique: 'EARL', siret: '12345678900017',
  siren: '123456789', tva: 'FR32123456789', adresse: '3 rue des Vignes', code_postal: '44190', ville: 'Clisson',
  email: 'contact@essais.fr', telephone: '02 40 00 00 00', paiement_mode: 'fdm', paiement_jours: 30, validite_jours: 30 };
function props(n, source) {
  const l = [];
  for (let i = 0; i < n; i++) l.push({ num_produit: 'P' + (100 + i), designation: 'Cuvée ' + String.fromCharCode(65 + i), conditionnement: '75 cl',
    millesime: String(2015 + i), pu_ht_c: 850 + i * 100, derniere_qte: source === 'client' ? (i === 0 ? 12 : null) : null,
    derniere_vente: '2026-03-' + String(12 - (i % 10)).padStart(2, '0'), nb_ventes: 20 - i, source });
  return l;
}
const DOMAINE_ENTIER = [{ num_produit: 'P900', designation: 'Crémant de Loire', conditionnement: '75 cl', millesime: null,
  pu_ht_c: 1190, derniere_qte: null, derniere_vente: '2026-06-01', nb_ventes: 9, source: 'bureau' }];

function monter(o) {
  o = o || {};
  const dom = new JSDOM('<!doctype html><html><head></head><body class="bdv-coque bdv-poste"><p id="avant">liste</p><button id="depart">Nouveau devis</button></body></html>',
    { runScripts: 'outside-only', url: 'https://lebureauduvigneron.fr/mon-bureau/#affaires', pretendToBeVisual: true });
  const w = dom.window;
  const X = { w, doc: w.document, requetes: [], devis: [], lignes: {}, tiroir: { poser: [], retirer: 0 }, reglages: [], mode: o.mode || 'ok', domaine: o.domaine || 'ok',
    fiche: o.fiche === undefined ? Object.assign({}, FICHE) : o.fiche, props: o.props || props(10, 'client'), n: 0 };
  w.BdvTiroir = { actif: () => !!o.tiroir, poser: (b) => { X.tiroir.poser.push(b); return !!o.tiroir; }, retirer: () => { X.tiroir.retirer++; } };
  w.BdvNav = { ouvrirReglages: (onglet) => X.reglages.push(onglet) };
  /* LOT 52 : les feuilles servies, la copie rangee, l'empreinte calculee « par la base ». */
  X.copies = {}; X.copiesV = {};
  if (o.fetch) w.fetch = async (h) => { EN_VOL++; try { await pause(0); } finally { EN_VOL--; } X.fetchs = (X.fetchs || 0) + 1; if (o.fetch === 'ko') throw new TypeError('Failed to fetch');
    return { ok: true, text: async () => (o.fetch === 'script' ? '.x{}</style><script>alert(1)</script>' : '') + '.dpap{color:#000}/*' + h + '*/' }; };
  if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: globalThis.crypto, configurable: true });
  if (!w.TextEncoder) w.TextEncoder = TextEncoder;
  const sha = (txt) => createHash('sha256').update(txt, 'utf8').digest('hex');
  w.Element.prototype.scrollIntoView = function () {};
  const refus = (status, detail) => { const e = new Error('Supabase a refuse (' + status + ')'); e.status = status; e.detail = detail; return e; };
  w.BdvCompte = {
    monBureau: () => BUREAU,
    api: async (chemin, op) => { EN_VOL++; try { return await apiVrai(chemin, op); } finally { EN_VOL--; } }
  };
  async function apiVrai(chemin, op) {
      op = op || {};
      X.requetes.push({ chemin, methode: op.methode || 'GET', corps: op.corps === undefined ? undefined : JSON.parse(JSON.stringify(op.corps)) });
      await pause(0);
      if (/^\/domaine\?/.test(chemin)) {
        if (X.domaine === 'panne') throw new TypeError('Failed to fetch');
        if (X.domaine === 'sql') throw refus(404, '{"code":"PGRST205","message":"Could not find the table public.domaine"}');
        return X.fiche ? [Object.assign({}, X.fiche)] : [];
      }
      if (chemin === '/rpc/devis_propositions') {
        if (X.mode === 'sql-ouverture') throw refus(404, '{"code":"PGRST202","message":"Could not find the function"}');
        if (X.mode === 'panne-ouverture') return null;
        return op.corps.p_tout_le_domaine ? DOMAINE_ENTIER.map(x => ({ ...x })) : X.props.map(x => ({ ...x }));
      }
      if (/^\/devis_lignes\?/.test(chemin)) {
        const id = new URLSearchParams(chemin.split('?')[1]).get('devis_id').slice(3);
        return (X.lignes[id] || []).map(x => ({ ...x }));
      }
      if (chemin === '/rpc/devis_enregistrer') {
        if (X.mode === 'null') return null;
        if (X.mode === 'sans-numero') return {};
        if (X.mode === 'sql') throw refus(404, '{"code":"PGRST202","message":"Could not find the function public.devis_enregistrer"}');
        if (X.mode === 'panne') throw new TypeError('Failed to fetch');
        if (X.mode === 'refus') throw refus(400, '{"code":"23514","message":"un devis porte de 1 a 200 lignes"}');
        if (X.mode === 'incomplete') throw refus(400, '{"code":"23514","message":"fiche du domaine incomplete"}');
        const c = op.corps;
        if (c.p_bureau !== BUREAU) throw refus(403, '{"code":"42501"}');
        /* LOT 53 : sans le SQL du lot, la base ne connait pas le huitieme argument. */
        if (c.p_livraison !== undefined && !o.lot53) throw refus(404, '{"code":"PGRST202","message":"Could not find the function public.devis_enregistrer(p_livraison)"}');
        if (X.mode === 'liv-refus') throw refus(400, '{"code":"23514","message":"livraison : adresse incomplete"}');
        const lv = c.p_livraison || { mode: 'client' };
        const g = c.p_remise_globale_cb || 0;
        if (c.p_tva !== undefined && !o.lot54) throw refus(404, '{"code":"PGRST202","message":"Could not find the function public.devis_enregistrer(p_tva)"}');
        if (X.mode === 'tva-refus') throw refus(400, '{"code":"23514","message":"tva : numero de TVA du client manquant ou illisible"}');
        const tv = c.p_tva || { regime: 'france' }, fr = tv.regime === 'france';
        const r = C.devis(c.p_lignes.map(l => ({ pu_c: l.pu_ht_c, qte: l.quantite, remise_cb: l.remise_cb, tva_cb: fr ? (l.tva_cb == null ? 2000 : l.tva_cb) : 0 })), g, 2000, lv.port_c || 0, fr ? 2000 : 0);
        let d = c.p_devis ? X.devis.find(x => x.devis_id === c.p_devis) : null;
        if (c.p_devis && (!d || d.statut !== 'enregistre')) throw refus(400, '{"code":"23514","message":"devis fige : il ne se modifie plus"}');
        if (!d) {
          X.n++;
          d = { bureau: BUREAU, devis_id: 'dv' + X.n, affaire_id: c.p_affaire, numero: 'D-2026-' + String(X.n).padStart(4, '0'), statut: 'enregistre',
            date_devis: '2026-09-30', valable_jusqu: '2026-10-30', cree_le: '2026-09-30T08:00:00+00:00', maj_le: '2026-09-30T08:00:00+00:00' };
          if (c.p_version_de) { const v = X.devis.find(x => x.devis_id === c.p_version_de); if (v) { v.statut = 'abandonne'; d.version_de = v.devis_id; } }
          if (o.lot52) Object.assign(d, { papier_empreinte: null, papier_le: null, commande_telechargements: 0, commande_telechargee_le: null });
          if (o.lot65) Object.assign(d, { version: 1, rappele_le: null });
          X.devis.push(d);
        } else d.maj_le = '2026-09-30T09:15:00+00:00';
        Object.assign(d, { vendeur: Object.assign({}, X.fiche), acheteur: { nom: 'Chez Paul', nouveau: false, code_postal: '44000', ville: 'Nantes', num_client: 'C7' },
          paiement_mode: X.fiche.paiement_mode, paiement_jours: X.fiche.paiement_jours, validite_jours: X.fiche.validite_jours,
          remise_globale_cb: g, tva_cb: 2000, total_vins_c: r.total_vins, remise_globale_c: r.remise_globale, total_ht_c: r.total_ht,
          tva_c: r.tva, total_ttc_c: r.ttc, notes: c.p_notes, abandonne_le: null });
        if (o.lot54) Object.assign(d, { regime_tva: tv.regime, client_tva: tv.regime === 'ue' ? String(tv.client_tva).toUpperCase().replace(/[\s.\-]/g, '') : null,
          accises_incluses: fr ? true : !!tv.accises_incluses, tva_cb: fr ? 2000 : 0 });
        if (o.lot53) Object.assign(d, { livraison_mode: lv.mode || 'client', port_c: lv.port_c || 0, transporteur: lv.transporteur || null,
          livraison_souhaitee: lv.souhaitee || null, livraison: lv.mode === 'adresse' ? Object.assign({ pays: 'France' }, lv.adresse, { pays: (lv.adresse && lv.adresse.pays) || 'France' }) : null });
        X.lignes[d.devis_id] = c.p_lignes.map((l, i) => Object.assign({ rang: i + 1 }, l,
          { pu_l_c: r.lignes[i].pu_l, pu_f_c: r.lignes[i].pu_f, net_c: r.lignes[i].net, final_c: r.lignes[i].final }, o.lot54 ? { tva_cb: r.lignes[i].tva_cb } : {}));
        return { ...d };
      }
      if (chemin === '/rpc/devis_abandonner') {
        if (X.mode === 'null') return null;
        const d = X.devis.find(x => x.devis_id === op.corps.p_devis);
        if (!d) throw refus(404, '{"code":"P0002"}');
        d.statut = 'abandonne'; d.abandonne_le = '2026-09-30T10:00:00+00:00';
        return { ...d };
      }
      if (chemin === '/rpc/devis_envoyer') {
        if (X.mode === 'env-null') return null;
        if (X.mode === 'env-sql') throw refus(404, '{"code":"PGRST202","message":"Could not find the function public.devis_envoyer"}');
        if (X.mode === 'env-futur') throw refus(400, '{"code":"23514","message":"date d envoi dans le futur"}');
        const c = op.corps;
        const d = X.devis.find(x => x.devis_id === c.p_devis);
        if (!d || d.statut !== 'enregistre') throw refus(400, '{"code":"23514","message":"devis fige"}');
        if (c.p_papier !== undefined && !o.lot52) throw refus(404, '{"code":"PGRST202","message":"p_papier inconnu"}');
        if (c.p_papier && /^<!doctype html>/.test(c.p_papier) && c.p_papier.indexOf('Devis ' + d.numero) >= 0) {
          X.copies[d.devis_id] = c.p_papier; X.copiesV[d.devis_id] = (X.copiesV[d.devis_id] || []).concat([c.p_papier]); d.papier_empreinte = sha(c.p_papier); d.papier_le = '2026-10-01T09:00:00+00:00';
        }
        d.statut = 'envoye'; d.envoye_le = c.p_jour;
        return { ...d };
      }
      if (chemin === '/rpc/devis_refuser') {
        if (X.mode === 'ref-null') return null;
        if (X.mode === 'ref-sql') throw refus(404, '{"code":"PGRST202","message":"Could not find the function public.devis_refuser"}');
        if (X.mode === 'ref-autre') throw refus(400, '{"code":"23514","message":"autre devis en cours"}');
        const d = X.devis.find(x => x.devis_id === op.corps.p_devis);
        if (!d || ['enregistre', 'envoye'].indexOf(d.statut) < 0) throw refus(400, '{"code":"23514"}');
        Object.assign(d, { statut: 'refuse', refuse_le: '2026-10-01T09:00:00+00:00', refuse_motif: op.corps.p_motif });
        return { ...d };
      }
      if (chemin === '/rpc/devis_annuler_accord') {
        if (X.mode === 'ann-null') return null;
        if (X.mode === 'ann-encore') return { ...X.devis.find(x => x.devis_id === op.corps.p_devis), statut: 'envoye' };
        const d = X.devis.find(x => x.devis_id === op.corps.p_devis);
        if (!d || d.statut !== 'accepte') throw refus(400, '{"code":"23514"}');
        Object.assign(d, { statut: d.envoye_le ? 'envoye' : 'enregistre', accepte_le: null, accord_annule_le: '2026-10-01T10:00:00+00:00' });
        return { ...d };
      }
      if (/^\/devis_copies\?/.test(chemin)) {
        if (X.mode === 'copie-panne') throw new TypeError('Failed to fetch');
        const q = new URLSearchParams(chemin.split('?')[1]);
        if (q.get('bureau') !== 'eq.' + BUREAU) throw refus(403, '{"code":"42501"}');
        const id = q.get('devis_id').slice(3), e = q.get('empreinte');
        /* LOT 65 : une copie PAR VERSION, rendues de la plus ancienne a la plus recente (l'ordre
           que PostgREST peut prendre sans tri). Le filtre `empreinte` choisit la bonne. */
        const toutes = X.copiesV[id] || (X.copies[id] ? [X.copies[id]] : []);
        return toutes.filter(p => !e || e === 'eq.' + sha(p)).map(pap => ({ papier: X.copieAlteree ? pap + ' ' : pap, empreinte: sha(pap), cree_le: '2026-10-01T09:00:00+00:00' }));
      }
      if (chemin === '/rpc/devis_accepter') {
        const d = X.devis.find(x => x.devis_id === op.corps.p_devis);
        if (!d || ['enregistre', 'envoye'].indexOf(d.statut) < 0) throw refus(400, '{"code":"23514"}');
        Object.assign(d, { statut: 'accepte', accepte_le: '2026-10-01T11:00:00+00:00' });
        return { ...d };
      }
      if (chemin === '/rpc/devis_noter_telechargement') {
        const d = X.devis.find(x => x.devis_id === op.corps.p_devis);
        Object.assign(d, { commande_telechargements: (d.commande_telechargements || 0) + 1, commande_telechargee_le: '2026-10-01T11:01:00+00:00' });
        return { ...d };
      }
      /* LOT 65 : rappeler. Sans le SQL du lot, la fonction n'existe pas. */
      if (chemin === '/rpc/devis_rappeler') {
        if (!o.lot65) throw refus(404, '{"code":"PGRST202","message":"Could not find the function public.devis_rappeler"}');
        if (X.mode === 'rap-panne') throw new TypeError('Failed to fetch');
        if (X.mode === 'rap-signe') throw refus(400, '{"code":"23514","message":"devis signe : il ne se rappelle pas"}');
        if (X.mode === 'rap-null') return null;
        if (op.corps.p_bureau !== BUREAU) throw refus(403, '{"code":"42501"}');
        const d = X.devis.find(x => x.devis_id === op.corps.p_devis);
        if (!d || d.statut !== 'envoye') throw refus(400, '{"code":"23514"}');
        Object.assign(d, { statut: 'enregistre', version: (d.version || 1) + 1, rappele_le: '2026-10-05T09:00:00+00:00', envoye_le: null, papier_empreinte: null, papier_le: null });
        return { ...d };
      }
      /* LOT 55 : la signature en ligne. Sans le SQL du lot, la fonction n'existe pas. */
      if (chemin === '/rpc/devis_lien_creer') {
        if (!o.lot55) throw refus(404, '{"code":"PGRST202","message":"Could not find the function public.devis_lien_creer"}');
        if (op.corps.p_bureau !== BUREAU) throw refus(403, '{"code":"42501"}');
        const d = X.devis.find(x => x.devis_id === op.corps.p_devis);
        if (!d || d.statut !== 'envoye' || !d.papier_empreinte) throw refus(400, '{"code":"23514","message":"copie absente : pas de lien de signature"}');
        X.liens = (X.liens || 0) + 1;
        return (X.liens % 10).toString().repeat(64).replace(/^./, 'a');
      }
      if (/^\/devis_liens\?/.test(chemin)) {
        if (!o.lot55) throw refus(404, '{"code":"PGRST205","message":"Could not find the table public.devis_liens"}');
        return o.lienExistant ? [{ cree_le: '2026-10-01T08:30:00+00:00', cree_par: null }] : [];
      }
      if (/^\/devis_signatures\?/.test(chemin)) {
        return o.preuve ? [Object.assign({}, o.preuve)] : [];
      }
      throw refus(404, 'route inconnue du faux serveur : ' + chemin);
  }
  w.eval(SRC_DOMAINE);
  w.eval(SRC_CALC);
  w.eval(SRC_DEVIS);
  X.ctx = Object.assign({ bureau: BUREAU, affaire: { affaire_id: 'aC', issue: 'en_cours' }, sujet: 'Chez Paul', nouveau: false, devis: null,
    retour: (id) => { X.retours = (X.retours || 0) + 1; X.retourId = id; },
    focusSortie: () => w.document.getElementById('depart'), change: (d) => { X.changes = (X.changes || []).concat([d]); } }, o.ctx || {});
  X.modale = () => w.document.getElementById('devisModale');
  X.corps = () => w.document.getElementById('devCorps');
  X.avis = () => (w.document.getElementById('devAvis') || {}).textContent || '';
  X.clic = (sel) => { const n = X.modale().querySelector(sel); if (!n) throw new Error('introuvable : ' + sel); n.click(); };
  X.cocher = (cle, oui) => { const n = X.modale().querySelector('[data-dev-coche="' + cle + '"]'); if (!n) throw new Error('case introuvable : ' + cle);
    n.checked = oui !== false; n.dispatchEvent(new w.Event('change', { bubbles: true })); };
  X.taper = (n, v) => { n.value = v; n.dispatchEvent(new w.Event('input', { bubbles: true })); };
  X.champ = (cle, nom) => X.modale().querySelector('.dmod__ligne[data-cle="' + cle + '"] [data-dev-champ="' + nom + '"]');
  X.ouvrir = async (ctx) => { const p = w.BdvDevis.ouvrir(Object.assign({}, X.ctx, ctx || {})); await p; await attendre(5); };
  X.enregistrer = async () => { X.clic('[data-dev="enregistrer"]'); await attendre(10); };
  return X;
}
const CLE0 = 'P100|Cuvée A|75 cl|2015', CLE1 = 'P101|Cuvée B|75 cl|2016';

/* ---------------------------------------------------------------------------- */
titre('2. La piece : un devis neuf chez un client');
{
  const X = monter();
  await X.ouvrir();
  const m = X.modale();
  t('la boite #devisModale existe, en `tmod dmod`', !!m && m.className === 'tmod dmod' && !m.hidden);
  t('V4 : un devis est une SAISIE large, il ne passe PLUS par BdvTiroir (ni poser ni retirer)', X.tiroir.poser.length === 0 && X.tiroir.retirer === 0);
  t('V4 : il pose lui-meme le contrat d\'une modale (aria-modal, defilement du corps bloque)',
    m.querySelector('.tmod__boite').getAttribute('aria-modal') === 'true' && X.doc.body.style.overflow === 'hidden');
  t('la boite porte role="dialog" et un titre', m.querySelector('.tmod__boite').getAttribute('role') === 'dialog' && X.doc.getElementById('devTitre').textContent === 'Devis pour Chez Paul');
  t('le nom n\'est dit qu\'une fois en tete : ni « Pour Chez Paul » sous le titre, ni en gras dans « Pour qui »',
    !/Pour Chez Paul/.test(m.querySelector('.tmod__sous').textContent) && m.querySelectorAll('.dmod__qui b, .dmod__qui strong').length === 0
    && /\.dmod__qui\{[^}]*font-weight:400/.test(lire('src/css/bdv-devis.css').replace(/\s+/g, '')));
  t('« Retour à l’affaire » en haut, et il recoit le focus', !!X.doc.getElementById('devRetour') && X.doc.activeElement === X.doc.getElementById('devRetour')
    && m.querySelector('.tmod__boite').firstElementChild.nextElementSibling === X.doc.getElementById('devRetourL'));
  t('AUCUN numero avant l\'enregistrement', !/D-\d{4}-\d+/.test(m.textContent), m.textContent.match(/D-\d{4}-\d+/));
  const h3 = [...m.querySelectorAll('.dmod__bloc > h3')].map(h => h.textContent);
  t('LOT 66 : les blocs dans l\'ordre des trois etapes : Tes vins | Remise, Livraison, TVA, Conditions, Notes | Pour qui, Ce que tu proposes, Total',
    JSON.stringify(h3) === JSON.stringify(['Tes vins', 'Remise sur tout le devis', 'Livraison', 'TVA', 'Conditions', 'Notes', 'Pour qui', 'Ce que tu proposes', 'Total']), JSON.stringify(h3));
  const pied = m.querySelector('.dmod__pied');
  t('« Enregistrer le devis » vit dans le pied, avec le total, et le pied est le dernier bloc',
    !!pied && /Enregistrer le devis/.test(pied.textContent) && /Total HT/.test(pied.textContent) && X.corps().lastElementChild === pied);
  t('V3 : le pied dit le HT EN PREMIER, le TTC ensuite', !!pied && pied.textContent.indexOf('HT') >= 0 && pied.textContent.indexOf('HT') < pied.textContent.indexOf('TTC')
    && !!X.doc.getElementById('devPiedHt') && !!X.doc.getElementById('devPiedTtc'), pied && pied.textContent);
  t('la liste du client : « Ce qu’il t’a déjà pris »', /Ce qu’il t’a déjà pris/.test(X.corps().textContent));
  t('8 lignes proposees, puis « Voir les 2 autres »', m.querySelectorAll('.dmod__prop').length === 8 && /Voir les 2 autres/.test(X.corps().textContent),
    m.querySelectorAll('.dmod__prop').length);
  t('du plus recent au plus ancien', m.querySelector('.dmod__prop').textContent.indexOf('Cuvée A') >= 0 && /12\/03\/2026/.test(m.querySelector('.dmod__prop').textContent));
  X.clic('[data-dev="voirTout"]');
  t('« Voir les 2 autres » montre les 10', m.querySelectorAll('.dmod__prop').length === 10);
  const reqP = X.requetes.filter(r => r.chemin === '/rpc/devis_propositions');
  t('les propositions demandees pour CE bureau et CETTE affaire', reqP.length === 1 && reqP[0].corps.p_bureau === BUREAU && reqP[0].corps.p_affaire === 'aC' && reqP[0].corps.p_tout_le_domaine === false,
    JSON.stringify(reqP.map(r => r.corps)));
  t('les conditions sont celles de Mon domaine, avec « Changer dans Mon domaine »',
    /Paiement à 30 jours fin de mois\. Devis valable 30 jours\./.test(X.corps().textContent) && !!m.querySelector('[data-dev="domaine"]'));

  titre('2 bis. Les erreurs, dans les mots du vigneron');
  const avantE = X.requetes.length;
  await X.enregistrer();
  t('rien de coche : « Coche au moins un vin. », et rien ne part', X.avis() === 'Coche au moins un vin.' && X.requetes.length === avantE, X.avis());
  X.cocher(CLE0);
  X.cocher(CLE1);
  t('une case cochee devient une ligne, dans l\'ordre des coches', [...m.querySelectorAll('.dmod__ligne')].map(l => l.getAttribute('data-cle')).join(',') === CLE0 + ',' + CLE1);
  t('quantite par defaut : la derniere du client (12)', X.champ(CLE0, 'qte').value === '12', X.champ(CLE0, 'qte').value);
  t('sinon 6, jamais 0', X.champ(CLE1, 'qte').value === '6', X.champ(CLE1, 'qte').value);
  t('le prix propose est son dernier prix, au centime', X.champ(CLE0, 'prix').value === '8,50');
  const src0 = () => m.querySelector('.dmod__ligne[data-cle="' + CLE0 + '"] .dmod__src').textContent;
  t('la provenance est dite sous le prix : « Son dernier prix, le 12/03/2026 »', src0() === 'Son dernier prix, le 12/03/2026', src0());
  t('le prix porte sa provenance (aria-describedby)', (X.doc.getElementById(X.champ(CLE0, 'prix').getAttribute('aria-describedby')) || {}).textContent === src0());
  { const ids = [...X.doc.querySelectorAll('[id]')].map(n => n.id);
    t('deux lignes ouvertes : ids toujours uniques dans la page', new Set(ids).size === ids.length, ids.filter((x, i) => ids.indexOf(x) !== i).join(','));
    t('et tous prefixes « dev » dans la boite', [...m.querySelectorAll('[id]')].every(n => /^dev/.test(n.id)), [...m.querySelectorAll('[id]')].map(n => n.id).filter(i => !/^dev/.test(i)).join(',')); }
  const lt0 = () => m.querySelector('.dmod__ligne[data-cle="' + CLE0 + '"] [data-dev-lt]').textContent;
  t('le total de la ligne est affiche : 12 x 8,50 = 102,00 €', lt0() === '102,00 €', lt0());
  X.taper(X.champ(CLE1, 'qte'), '0');
  await X.enregistrer();
  t('quantite 0 : « Indique la quantité pour Cuvée B 2016, 75 cl. », et le curseur y va',
    X.avis() === 'Indique la quantité pour Cuvée B 2016, 75 cl.' && X.doc.activeElement === X.champ(CLE1, 'qte') && X.requetes.length === avantE + 0 + X.requetes.filter((r, i) => i >= avantE && r.chemin !== '/rpc/devis_enregistrer').length, X.avis());
  X.taper(X.champ(CLE1, 'qte'), '2,5');
  await X.enregistrer();
  { const q = X.champ(CLE1, 'qte'), err = q.nextElementSibling;
    t('l\'erreur est ECRITE SOUS LE CHAMP fautif, pas seulement en haut de la boite', !!err && err.classList.contains('dmod__err')
      && err.textContent === 'Indique la quantité pour Cuvée B 2016, 75 cl.' && err.closest('.aff-champ') === q.closest('.aff-champ'));
    t('le champ est marque aria-invalid et decrit par cette ligne', q.getAttribute('aria-invalid') === 'true'
      && (q.getAttribute('aria-describedby') || '').split(' ').indexOf(err.id) >= 0 && /^devErr/.test(err.id)); }
  X.taper(X.champ(CLE1, 'qte'), '2,5');
  t('saisie invalide : le total de la ligne dit « à corriger », jamais un montant qui ignore la valeur',
    m.querySelector('.dmod__ligne[data-cle="' + CLE1 + '"] [data-dev-lt]').textContent === 'à corriger');
  t('et le pied collant aussi, et le bloc Total', X.doc.getElementById('devPiedTtc').textContent === 'à corriger'
    && /Total TTCà corriger/.test(X.doc.getElementById('devTotal').textContent) && !/\d,\d\d\u00a0€/.test(X.doc.getElementById('devTotal').textContent));
  t('corriger le champ efface son erreur', !X.champ(CLE1, 'qte').hasAttribute('aria-invalid') && !m.querySelector('.dmod__err'));
  await X.enregistrer();
  t('quantite decimale : refusee de meme', /^Indique la quantité pour Cuvée B/.test(X.avis()));
  X.taper(X.champ(CLE1, 'qte'), '6');
  X.taper(X.champ(CLE1, 'prix'), 'abc');
  await X.enregistrer();
  t('prix illisible : « Indique un prix pour Cuvée B 2016, 75 cl. »', X.avis() === 'Indique un prix pour Cuvée B 2016, 75 cl.', X.avis());
  t('une seule ligne d\'erreur a la fois', m.querySelectorAll('.dmod__err').length === 1);
  X.taper(X.champ(CLE1, 'prix'), '9,555');
  await X.enregistrer();
  t('prix a trois decimales : refuse, jamais arrondi', /^Indique un prix pour Cuvée B/.test(X.avis()));
  X.taper(X.champ(CLE1, 'prix'), '9,00');
  t('prix change : « Prix changé à la main »', m.querySelector('.dmod__ligne[data-cle="' + CLE1 + '"] .dmod__src').textContent === 'Prix changé à la main');
  X.taper(X.champ(CLE1, 'remise'), '120');
  await X.enregistrer();
  t('remise de ligne a 120 : « Une remise va de 0 à 100 %. »', X.avis() === 'Une remise va de 0 à 100 %.', X.avis());
  X.taper(X.champ(CLE1, 'remise'), '10');
  X.taper(X.doc.getElementById('devRemise'), '150');
  t('remise globale hors borne pendant la frappe : « à corriger », pas un total sans remise', X.doc.getElementById('devPiedTtc').textContent === 'à corriger');
  X.taper(X.doc.getElementById('devRemise'), '-5');
  await X.enregistrer();
  t('remise globale negative : meme phrase', X.avis() === 'Une remise va de 0 à 100 %.', X.avis());
  t('aucun enregistrement n\'est parti pendant ces refus', !X.requetes.some(r => r.chemin === '/rpc/devis_enregistrer'));
  X.taper(X.doc.getElementById('devRemise'), '0');
  { const t0 = X.doc.getElementById('devTotal').textContent;
    t('X6 : sans remise globale ni port, UNE ligne « Total HT », pas « Total des vins HT » au meme montant',
      !/Total des vins HT/.test(t0) && /Total HT/.test(t0), t0); }
  X.taper(X.doc.getElementById('devRemise'), '5');
  const tot = X.doc.getElementById('devTotal').textContent;
  t('X6 : avec une remise globale, « Total des vins HT » revient au-dessus de la remise', /Total des vins HT/.test(tot), tot);
  t('le total dit « Remise sur tout le devis 5 % : -... », et dessous, en petit, comment elle s\'applique',
    /Remise sur tout le devis 5 % :-7,44/.test(tot) && X.doc.querySelector('#devTotal .dmod__tl-x').textContent === 'Appliquée à chaque prix unitaire, arrondie au centime.', tot);
  t('prix net (apres remise de ligne) sous le total d\'une ligne remisee : 9,00 a 10 % = 8,10, x 6 = 48,60',
    m.querySelector('.dmod__ligne[data-cle="' + CLE1 + '"] [data-dev-net]').textContent === 'Prix net 8,10\u00a0€'
    && m.querySelector('.dmod__ligne[data-cle="' + CLE1 + '"] [data-dev-lt]').textContent === '48,60\u00a0€'
    && m.querySelector('.dmod__ligne[data-cle="' + CLE0 + '"] [data-dev-net]').textContent === '');
  t('et, remise de ligne ET globale : « Les deux remises s’ajoutent... »', /Les deux remises s’ajoutent : la remise sur tout le devis s’applique après celles des lignes\./.test(tot));
  t('l\'ordre du total : vins HT, remise, HT, TVA 20 %, TTC', /Total des vins HT.*Remise sur tout le devis.*Total HT.*TVA 20 %.*Total TTC/.test(tot));
  t('« Prix HT, droits d’accises inclus. » est ecrit', /Prix HT, droits d’accises inclus\./.test(tot));
  /* 12 x 8,50 = 102,00 ; 6 x 9,00 a 10 % = 6 x 8,10 = 48,60 ; vins 150,60. Globale 5 % :
     8,50 -> 8,08 (x12 = 96,96) ; 8,10 -> 7,70 (x6 = 46,20) ; HT 143,16 ; TVA 28,63 ; TTC 171,79. */
  t('les montants suivent la regle : HT 143,16 €, TTC 171,79 € (colle en bas)', /Total HT143,16 €/.test(tot) && X.doc.getElementById('devPiedTtc').textContent === '171,79 €', tot + ' / ' + X.doc.getElementById('devPiedTtc').textContent);
  t('le brouillon est garde sur l\'appareil, sous bdv_devis_brouillon_<affaire>', !!X.w.localStorage.getItem('bdv_devis_brouillon_aC'));

  titre('2 ter. Un retour vide n\'est jamais « enregistre »');
  for (const [mode, phrase] of [['null', 'Le devis n’est pas enregistré. Réessaie dans un instant. Tes lignes sont gardées.'],
                                ['sans-numero', 'Le devis n’est pas enregistré. Réessaie dans un instant. Tes lignes sont gardées.'],
                                ['panne', 'Le devis n’est pas enregistré, ta connexion a coupé. Tes lignes sont gardées.'],
                                ['sql', 'Le devis n’est pas encore disponible sur ton compte.']]) {
    X.mode = mode;
    await X.enregistrer();
    t('retour « ' + mode + ' » : « ' + phrase + ' »', X.avis() === phrase && !/enregistré\.$/.test(X.avis()) && !/D-\d{4}/.test(m.textContent), X.avis());
  }
  t('et les lignes sont toujours la, le brouillon aussi', m.querySelectorAll('.dmod__ligne').length === 2 && !!X.w.localStorage.getItem('bdv_devis_brouillon_aC'));

  titre('2 quater. Enregistrer');
  X.mode = 'ok';
  X.taper(X.doc.getElementById('devNotes'), 'Livraison en octobre.');
  await X.enregistrer();
  const env = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').pop().corps;
  t('« Devis D-2026-0001 enregistré. »', X.avis() === 'Devis D-2026-0001 enregistré.', X.avis());
  t('le numero vient du serveur et s\'affiche dans le titre', /Devis D-2026-0001/.test(X.doc.getElementById('devTitre').textContent));
  t('le corps nomme le bureau, l\'affaire, et p_devis vide pour un neuf', env.p_bureau === BUREAU && env.p_affaire === 'aC' && env.p_devis === null);
  t('quantites, prix et remises partent en ENTIERS (centimes, centiemes de %)',
    env.p_lignes.every(l => Number.isInteger(l.quantite) && Number.isInteger(l.pu_ht_c) && Number.isInteger(l.remise_cb)) && env.p_remise_globale_cb === 500
    && env.p_lignes[0].pu_ht_c === 850 && env.p_lignes[1].pu_ht_c === 900 && env.p_lignes[1].remise_cb === 1000, JSON.stringify(env.p_lignes));
  t('provenance : le prix du client part en « client », le prix change en « saisi »',
    env.p_lignes[0].source_prix === 'client' && env.p_lignes[1].source_prix === 'saisi', env.p_lignes.map(l => l.source_prix).join(','));
  t('la designation, le millesime et le conditionnement partent separes', env.p_lignes[0].designation === 'Cuvée A' && env.p_lignes[0].millesime === '2015' && env.p_lignes[0].conditionnement === '75 cl' && env.p_lignes[0].num_produit === 'P100');
  t('le brouillon est efface apres l\'enregistrement', X.w.localStorage.getItem('bdv_devis_brouillon_aC') === null);
  t('l\'affaire est prevenue (sa liste de devis se relira)', (X.changes || []).length === 1);
  t('« Voir et imprimer » et « Abandonner ce devis » apparaissent', !!m.querySelector('[data-dev="apercu"]') && !!m.querySelector('[data-dev="abandonner"]'));
  { const pro = X.doc.getElementById('devProchaine'), corps = X.doc.getElementById('devCorps');
    t('X1 : apres l\'enregistrement, « Prochaine étape : Préparer l’envoi » sous l\'avis, AVANT le corps du devis',
      !!pro && !pro.hidden && /^Prochaine étape : l’envoyer\. Préparer l’envoi$/.test(pro.textContent.trim())
      && !!(pro.compareDocumentPosition(corps) & 4), pro && pro.outerHTML);
    X.clic('[data-dev="allerEnvoi"]');
    const evo = X.doc.getElementById('devEnvoi');
    t('X1 : son bouton ouvre le bloc d\'envoi, et la suite se retire', !!evo && !evo.hidden && pro.hidden);
    X.clic('[data-dev="pasEnvoye"]');
    X.clic('[data-dev="pasEnvoye"]');
    t('X1 : la suite n\'est jamais un deuxieme bouton plein (V8)',
      !X.doc.querySelector('[data-dev="allerEnvoi"]').classList.contains('btn--bordeaux'));
    X.taper(X.doc.getElementById('devNotes'), 'Livraison en octobre, le matin.');
    pro.hidden = false; X.clic('[data-dev="envoyer"]');
    t('X1 : tout nouvel avis (« Enregistre d’abord tes changements ») retire la suite', pro.hidden && /Enregistre d’abord/.test(X.avis()), X.avis()); }
  X.taper(X.champ(CLE0, 'qte'), '24');
  await X.enregistrer();
  const env2 = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').pop().corps;
  t('modifier : le meme devis (p_devis), le meme numero', env2.p_devis === 'dv1' && /D-2026-0001/.test(X.avis()) && X.devis.length === 1, X.avis());
  t('« Modifié le 30/09/2026 » sous le titre', /Modifié le 30\/09\/2026/.test(X.modale().querySelector('.tmod__sous').textContent));
  t('un devis ENREGISTRE ne touche jamais a l\'affaire (aucune requete sur affaires)', !X.requetes.some(r => /^\/affaires/.test(r.chemin)));

  titre('2 quinquies. Abandonner');
  const nAb = X.requetes.filter(r => r.chemin === '/rpc/devis_abandonner').length;
  X.clic('[data-dev="abandonner"]');
  t('« Abandonner ce devis » demande confirmation, rien ne part', !X.doc.getElementById('devConfirme').hidden && X.requetes.filter(r => r.chemin === '/rpc/devis_abandonner').length === nAb);
  X.clic('[data-dev="confirmerAbandon"]');
  await attendre(10);
  const ab = X.requetes.filter(r => r.chemin === '/rpc/devis_abandonner').pop();
  t('la confirmation abandonne, pour ce bureau', !!ab && ab.corps.p_bureau === BUREAU && ab.corps.p_devis === 'dv1');
  t('le numero est garde, barre, et le mot « abandonné » est ecrit', !!X.doc.querySelector('#devTitre s') && X.doc.querySelector('#devTitre s').textContent === 'D-2026-0001' && /abandonné/.test(X.doc.getElementById('devTitre').textContent));
  t('LECTURE SEULE : aucun champ, aucune case, aucun « Enregistrer »', X.corps().querySelectorAll('input, textarea, select').length === 0 && !m.querySelector('[data-dev="enregistrer"]') && !m.querySelector('[data-dev="abandonner"]'));
  t('et les lignes restent lisibles', /Cuvée A 2015, 75 cl/.test(X.corps().textContent) && /24\sx 8,50/.test(X.corps().textContent), X.corps().textContent.slice(0, 200));

  titre('2 sexies. Retour, Echap, et les regles du depot');
  const ids = [...X.doc.querySelectorAll('[id]')].map(n => n.id);
  t('ids uniques dans la page', new Set(ids).size === ids.length, ids.filter((x, i) => ids.indexOf(x) !== i).join(','));
  t('tous les ids de la boite commencent par « dev »', [...m.querySelectorAll('[id]')].concat([m]).every(n => /^dev/.test(n.id)));
  t('aucun onclick, aucun tiret cadratin', !/\sonclick=/i.test(m.innerHTML) && !/—/.test(m.textContent));
  const rAv = X.tiroir.retirer;
  X.clic('[data-dev="retour"]');
  t('« Retour à l’affaire » ferme la boite, rend le defilement, et rend la main a l\'affaire (sans BdvTiroir)', m.hidden && X.tiroir.retirer === rAv && X.retours === 1 && X.doc.body.style.overflow === '');
  const toutes = X.requetes.filter(r => r.methode === 'GET');
  t('chaque lecture nomme le bureau', toutes.length > 0 && toutes.every(r => r.chemin.indexOf('bureau=eq.' + BUREAU) >= 0), toutes.map(r => r.chemin).join(' ; '));
  const rpcs = X.requetes.filter(r => /^\/rpc\//.test(r.chemin));
  t('chaque fonction appelee nomme le bureau', rpcs.length > 0 && rpcs.every(r => r.corps && r.corps.p_bureau === BUREAU));
  await X.ouvrir({ devis: { ...X.devis[0] } });
  t('un devis abandonne se rouvre en lecture seule, sans demander de propositions',
    X.corps().querySelectorAll('input, textarea').length === 0 && X.requetes.filter(r => r.chemin === '/rpc/devis_propositions').length === 1);
  X.doc.dispatchEvent(new X.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  t('Echap ferme la boite et rend le defilement', X.modale().hidden && X.tiroir.retirer === rAv && X.doc.body.style.overflow === '');
  const lignesLues = X.requetes.filter(r => /^\/devis_lignes/.test(r.chemin));
  t('les lignes d\'un devis rouvert sont lues pour CE bureau et CE devis', lignesLues.length >= 2
    && lignesLues.every(r => r.chemin === '/devis_lignes?bureau=eq.' + BUREAU + '&devis_id=eq.dv1&order=rang'), lignesLues.map(r => r.chemin).join(' ; '));
}

/* ---------------------------------------------------------------------------- */
titre('3. Ce qui bloque, ce qui manque');
{
  const X = monter({ fiche: Object.assign({}, FICHE, { siret: null, adresse: '' }) });
  await X.ouvrir();
  t('fiche du domaine incomplete : bloque DES L\'OUVERTURE, et dit ce qui manque',
    /Il manque des infos sur ton domaine pour faire un devis : le SIRET et l’adresse\./.test(X.corps().textContent), X.corps().textContent);
  t('aucune proposition demandee, aucun champ a remplir', !X.requetes.some(r => /devis_/.test(r.chemin)) && !X.corps().querySelector('input'));
  /* Les reglages, tels qu'ils s'ouvrent : l'onglet « Toi » cache, « Mon domaine » visible. */
  X.doc.body.insertAdjacentHTML('beforeend', '<div id="bdvrVoile"><fieldset id="bdvrBlocToi" hidden><input id="bdvrPrenom"></fieldset>'
    + '<fieldset id="bdvrBlocDomaine"><input type="hidden" id="devCache"><input id="bdvdQ"><input id="bdvdRaison"></fieldset></div>');
  X.clic('[data-dev="domaine"]');
  t('« Compléter Mon domaine » : le focus va dans le premier champ de l\'onglet Mon domaine', X.doc.activeElement === X.doc.getElementById('bdvdQ'),
    X.doc.activeElement && (X.doc.activeElement.id || X.doc.activeElement.tagName));
  t('« Compléter Mon domaine » ferme le devis et ouvre l\'onglet Mon domaine des reglages',
    /Compléter Mon domaine/.test(X.modale().textContent) && X.modale().hidden && X.reglages[0] === 'bdvrBlocDomaine', JSON.stringify(X.reglages));
  const Y = monter({ fiche: null });
  await Y.ouvrir();
  t('pas de fiche du tout : les cinq champs sont nommes',
    /la raison sociale, le SIRET, l’adresse, le code postal et la ville\./.test(Y.corps().textContent), Y.corps().textContent);
}
{
  const X = monter({ mode: 'sql-ouverture' });
  await X.ouvrir();
  t('SQL pas encore passe (404 / PGRST202) : « Le devis n’est pas encore disponible sur ton compte. »',
    X.corps().textContent === 'Le devis n’est pas encore disponible sur ton compte.', X.corps().textContent);
  const Y = monter({ mode: 'panne-ouverture' });
  await Y.ouvrir();
  t('propositions illisibles (retour vide) : la panne est dite, avec « Réessayer »', /ta connexion a coupé/.test(Y.corps().textContent) && !!Y.modale().querySelector('[data-dev="relire"]'));
}
{
  const X = monter({ props: props(3, 'bureau'), ctx: { nouveau: true, sujet: 'Cave Neuve', affaire: { affaire_id: 'aN', issue: 'en_cours' } } });
  await X.ouvrir();
  t('nouveau client : « Nouveau client, pas encore dans Vitisoft »', /Nouveau client, pas encore dans Vitisoft/.test(X.corps().textContent));
  t('et « Tes vins vendus ces 12 derniers mois »', /Tes vins vendus ces 12 derniers mois/.test(X.corps().textContent));
  X.cocher(CLE0);
  t('la provenance : « Ton prix le plus courant », quantite 6',
    X.modale().querySelector('.dmod__src').textContent === 'Ton prix le plus courant' && X.champ(CLE0, 'qte').value === '6');
  await X.enregistrer();
  t('et ce prix part en « bureau »', X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').pop().corps.p_lignes[0].source_prix === 'bureau');
}
{
  const X = monter({ props: [] });
  await X.ouvrir();
  t('aucune vente : « Tu n’as encore rien vendu sur 12 mois. »', /Tu n’as encore rien vendu sur 12 mois\./.test(X.corps().textContent));
}
{
  const X = monter();
  await X.ouvrir();
  X.taper(X.doc.getElementById('devCherche'), 'cuvee 2017');
  t('« Chercher un vin » filtre la liste proposee', X.modale().querySelectorAll('.dmod__prop').length === 1 && /Cuvée C/.test(X.doc.getElementById('devProps').textContent));
  X.taper(X.doc.getElementById('devCherche'), 'cremant');
  await attendre(10);
  const dem = X.requetes.filter(r => r.chemin === '/rpc/devis_propositions' && r.corps.p_tout_le_domaine === true);
  t('absent de la liste du client : on cherche dans les ventes du domaine, une fois', dem.length === 1 && /Dans les ventes de ton domaine/.test(X.doc.getElementById('devProps').textContent)
    && /Crémant de Loire/.test(X.doc.getElementById('devProps').textContent), X.doc.getElementById('devProps').textContent);
  X.cocher('P900|Crémant de Loire|75 cl|');
  t('coche depuis le domaine : « Ton prix le plus courant »', X.modale().querySelector('.dmod__ligne .dmod__src').textContent === 'Ton prix le plus courant');
  t('et la liste ne dit pas « Aucun vin ne correspond » pour un vin qu\'on vient de cocher',
    !/Aucun vin ne correspond/.test(X.doc.getElementById('devProps').textContent) && /déjà dans le devis/.test(X.doc.getElementById('devProps').textContent), X.doc.getElementById('devProps').textContent);
  t('le champ de recherche garde le focus pendant la frappe (la liste se repeint, pas le champ)', X.doc.getElementById('devCherche').value === 'cremant');

  titre('3 bis. Le brouillon de l\'appareil');
  const cle = 'bdv_devis_brouillon_aC';
  t('une ligne cochee laisse un brouillon', !!X.w.localStorage.getItem(cle));
  X.clic('[data-dev="fermer"]');
  await X.ouvrir();
  const jj = new Date(); const dm = String(jj.getDate()).padStart(2, '0') + '/' + String(jj.getMonth() + 1).padStart(2, '0');
  t('a la reouverture : « Tu avais commencé un devis le ' + dm + '. Le reprendre ? »', X.corps().textContent.indexOf('Tu avais commencé un devis le ' + dm + '. Le reprendre ?') === 0, X.corps().textContent);
  t('« Reprendre » et « Repartir de zéro »', /Reprendre/.test(X.corps().textContent) && /Repartir de zéro/.test(X.corps().textContent));
  X.clic('[data-dev="reprendre"]');
  t('« Reprendre » rend les lignes', X.modale().querySelectorAll('.dmod__ligne').length === 1 && /Crémant de Loire/.test(X.doc.getElementById('devLignes').textContent));
  X.clic('[data-dev="fermer"]');
  await X.ouvrir();
  X.clic('[data-dev="zero"]');
  t('« Repartir de zéro » efface le brouillon', X.w.localStorage.getItem(cle) === null && X.modale().querySelectorAll('.dmod__ligne').length === 0);
  /* Le stockage peut manquer (navigation privee) : la piece marche quand meme. */
  const P = X.w.Storage.prototype, g0 = P.getItem, s0 = P.setItem;
  P.getItem = () => { throw new Error('bloque'); }; P.setItem = () => { throw new Error('bloque'); };
  X.clic('[data-dev="fermer"]');
  let casse = null;
  try { await X.ouvrir(); X.cocher(CLE0); } catch (e) { casse = e; }
  P.getItem = g0; P.setItem = s0;
  t('stockage refuse : rien ne casse (try/catch)', !casse && X.modale().querySelectorAll('.dmod__ligne').length === 1, String(casse));
}

/* ---------------------------------------------------------------------------- */
titre('4. Le papier (htmlPapier, pur)');
{
  const X = monter();
  await X.ouvrir();
  const D = X.w.BdvDevis;
  const d = { numero: 'D-2026-0007', date_devis: '2026-09-30', valable_jusqu: '2026-10-30', statut: 'enregistre', vendeur: Object.assign({}, FICHE),
    acheteur: { nom: 'Chez Paul', num_client: 'C7', code_postal: '44000', ville: 'Nantes', siret: '98765432100011' },
    paiement_mode: 'fdm', paiement_jours: 30, validite_jours: 30, remise_globale_cb: 500, total_vins_c: 15060, remise_globale_c: 744,
    total_ht_c: 14316, tva_c: 2863, total_ttc_c: 17179, notes: 'Livraison en octobre.' };
  const lg = [{ num_produit: 'P100', designation: 'Cuvée A', millesime: '2015', conditionnement: '75 cl', quantite: 12, pu_ht_c: 850, remise_cb: 0, net_c: 10200, pu_l_c: 850, pu_f_c: 808 },
              { num_produit: 'P101', designation: 'Cuvée B', millesime: '2016', conditionnement: '75 cl', quantite: 6, pu_ht_c: 900, remise_cb: 1000, net_c: 4860, pu_l_c: 810, pu_f_c: 770 }];
  const avant = X.doc.body.innerHTML;
  const h = D.htmlPapier(d, lg, {});
  const txt = new JSDOM(h).window.document.body.textContent;
  t('pur : le meme appel rend le meme document, et la page n\'a pas bouge', D.htmlPapier(d, lg, {}) === h && X.doc.body.innerHTML === avant);
  t('un document complet, en theme clair, avec sa feuille propre', /^<!doctype html>/.test(h) && /data-theme="light"/.test(h) && /\/css\/bdv-devis-papier\.css/.test(h) && /\/css\/bdv-theme\.css/.test(h));
  t('numero et date', /Devis D-2026-0007/.test(txt) && /Date du devis : 30\/09\/2026/.test(txt));
  t('« Devis valable jusqu’au 30/10/2026 »', /Devis valable jusqu’au 30\/10\/2026/.test(txt));
  const cond = X.w.BdvDomaine.conditions(d);
  t('les conditions sont celles de BdvDomaine.conditions() : « ' + cond + ' »', cond.length > 10 && txt.indexOf(cond + '.') >= 0);
  t('sans redite « Conditions de paiement : Paiement… »', !/Conditions de paiement : Paiement/.test(txt));
  const d2 = Object.assign({}, d, { paiement_mode: 'reception', paiement_jours: null });
  t('et elles suivent l\'instantane du devis (a reception)', new JSDOM(D.htmlPapier(d2, lg, {})).window.document.body.textContent.indexOf(X.w.BdvDomaine.conditions(d2)) >= 0);
  t('« Prix HT, droits d’accises inclus. »', /Prix HT, droits d’accises inclus\./.test(txt));
  t('les penalites de retard et l\'indemnite de 40 € (L441-10)', /Pénalités de retard : taux BCE majoré de 10 points\./.test(txt) && /40 € \(Code de commerce, L441-10\)/.test(txt));
  t('TVA 20 %, total HT et TTC', /TVA 20 %/.test(txt) && /Total HT143,16 €/.test(txt) && /Total TTC171,79 €/.test(txt));
  t('la remise sur tout le devis, si elle existe, et comment elle s\'applique', /Remise sur tout le devis 5 % :-7,44\u00a0€Appliquée à chaque prix unitaire, arrondie au centime\./.test(txt));
  { const tb = new JSDOM(h).window.document;
    const rangs = [...tb.querySelectorAll('.dpap__table tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent));
    const c = (s) => C.centimes(String(s).replace(/[^\d,]/g, ''));
    t('« Prix net » x quantite = « Total HT » sur CHAQUE ligne, et leur somme = total des vins',
      rangs.length === 2 && rangs.every(r => r.length === 6 && +r[1] * c(r[4]) === c(r[5])) && rangs.reduce((s, r) => s + c(r[5]), 0) === d.total_vins_c,
      JSON.stringify(rangs));
    const glob = D.htmlPapier(d, lg.map(l => Object.assign({}, l, { remise_cb: 0, net_c: l.quantite * l.pu_ht_c })), {});
    t('remise globale seule : pas de colonne « Prix net » (la remise reste une ligne des totaux)', !/Prix net/.test(glob) && /Remise sur tout le devis 5 %/.test(glob)); }
  t('pied de page imprime en police LITTERALE (les var() ne passent pas dans @page)',
    /@bottom-left\{content:"Devis D-2026-0007";font-family:'Inter'[^}]*font-size:8pt/.test(h) && !/@bottom[^}]*var\(/.test(h));
  t('une remise existe : la colonne « Prix net » (prix unitaire signe) est imprimee', /<th class="dpap__n">Prix net<\/th>/.test(h));
  const sansRemise = D.htmlPapier(Object.assign({}, d, { remise_globale_cb: 0 }), lg.map(l => Object.assign({}, l, { remise_cb: 0 })), {});
  t('sans aucune remise, pas de colonne « Prix net »', !/Prix net/.test(sansRemise));
  t('sur chaque page : le numero du devis et « Page N/M » (boites de marge @page)',
    /@bottom-left\{content:"Devis D-2026-0007"/.test(h) && /@bottom-right\{content:"Page " counter\(page\) "\/" counter\(pages\)/.test(h));
  t('totaux et mentions voyagent ensemble, et l\'en-tete du tableau se repete', /<div class="dpap__fin"><section class="dpap__totaux">[\s\S]*dpap__mentions[\s\S]*<\/section><\/div>/.test(h)
    && /\.dpap__fin\{\s*break-inside:avoid/.test(lire('src/css/bdv-devis-papier.css')) && /thead\{\s*display:table-header-group/.test(lire('src/css/bdv-devis-papier.css')));
  t('le vendeur : raison sociale, adresse, SIRET, n° de TVA du domaine', /EARL DOMAINE DES ESSAIS/.test(txt) && /3 rue des Vignes/.test(txt) && /44190 Clisson/.test(txt)
    && /SIRET 12345678900017/.test(txt) && /N° de TVA intracommunautaire FR32123456789/.test(txt));
  const sansTva = new JSDOM(D.htmlPapier(Object.assign({}, d, { vendeur: Object.assign({}, FICHE, { tva: null }) }), lg, {})).window.document.body.textContent;
  t('sans n° de TVA au domaine : aucun n\'est invente', !/TVA intracommunautaire/.test(sansTva) && !/FR\d{2}\d{9}/.test(sansTva));
  t('jamais de numero d\'accises', !/n° d.accises|numéro d.accises|entrepositaire/i.test(txt));
  t('le client : nom, SIRET, ville, n° client Vitisoft', /Chez Paul/.test(txt) && /SIRET 98765432100011/.test(txt) && /44000 Nantes/.test(txt) && /N° client C7/.test(txt));
  t('le detail : designation, millesime, conditionnement, code, quantite, PU HT, remise, total', /Cuvée A 2015, 75 cl/.test(txt) && /Code article P100/.test(txt)
    && /128,50\u00a0€8,50\u00a0€102,00\u00a0€/.test(txt) && /69,00\u00a0€10 %8,10\u00a0€48,60\u00a0€/.test(txt), txt.slice(txt.indexOf('Cuvée A'), txt.indexOf('Cuvée A') + 160));
  t('les notes', /Livraison en octobre\./.test(txt));
  t('echappe ce qu\'il imprime', !/<script>/.test(D.htmlPapier(Object.assign({}, d, { notes: '<script>x</script>' }), lg, {})));

  titre('4 bis. L\'apercu et l\'impression par un iframe cache');
  await X.enregistrer();                              // rien de coche : refuse, on en coche un
  X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="apercu"]');
  await attendre(10);
  const f = X.doc.getElementById('devFeuille');
  t('« Voir et imprimer » : la feuille en entier, et les deux boutons', !!f && /Imprimer ou enregistrer en PDF/.test(X.corps().textContent) && /Revenir au devis/.test(X.corps().textContent));
  t('la feuille montre le devis enregistre', !!f && /D-2026-0001/.test(f.contentDocument.body.textContent) && /Prix HT, droits d’accises inclus/.test(f.contentDocument.body.textContent));
  let imprime = 0;
  X.clic('[data-dev="imprimer"]');
  const fi = X.doc.getElementById('devImpression');
  if (fi) { fi.contentWindow.print = () => { imprime++; }; fi.contentWindow.focus = () => {}; }
  await attendre(60);
  t('l\'impression passe par un iframe cache, meme origine, rempli par htmlPapier', !!fi && fi.classList.contains('dmod__imprimeur') && fi.getAttribute('aria-hidden') === 'true'
    && /D-2026-0001/.test(fi.contentDocument.body.textContent));
  t('et c\'est SON contentWindow.print() qui part', imprime === 1, imprime);
  X.clic('[data-dev="revenir"]');
  t('« Revenir au devis » rend le devis', !!X.modale().querySelector('[data-dev="enregistrer"]'));
}

/* ---------------------------------------------------------------------------- */
titre('4 ter. Retour du verificateur : ce qui se voit, ce qui garde le focus');
{
  /* LE PIED COLLANT NE COUVRE NI LE CHAMP FAUTIF NI LE FOCUS. jsdom n'a pas de mise en
     page : on lui donne des boites, et on regarde ce que la piece fait defiler. */
  const X = monter();
  await X.ouvrir();
  const m = X.modale(), box = m.querySelector('.tmod__boite');
  let st = 0;
  Object.defineProperty(box, 'scrollTop', { get: () => st, set: (v) => { st = v; }, configurable: true });
  box.getBoundingClientRect = () => ({ top: 0, bottom: 800, height: 800 });
  const rect = (n, top, h) => { n.getBoundingClientRect = () => ({ top: top - st, bottom: top - st + h, height: h }); };
  rect(m.querySelector('.dmod__pied'), 700 + 0, 100);
  m.querySelector('.dmod__pied').getBoundingClientRect = () => ({ top: 700, bottom: 800, height: 100 });
  const cb = m.querySelector('.dmod__prop input');
  rect(cb, 720, 20);
  cb.focus();
  t('une case qui recoit le focus SOUS le pied collant est ramenee au-dessus de lui', st === 48, st);
  X.cocher(CLE0);
  X.taper(X.champ(CLE0, 'qte'), '0');
  m.querySelector('.dmod__pied').getBoundingClientRect = () => ({ top: 700, bottom: 800, height: 100 });
  st = 0;
  rect(X.champ(CLE0, 'qte').closest('.aff-champ'), 1500, 60);
  rect(X.champ(CLE0, 'qte'), 1520, 40);
  await X.enregistrer();
  const cq = X.champ(CLE0, 'qte').closest('.aff-champ').getBoundingClientRect();
  t('erreur : le focus est dans le champ, et le champ AVEC sa ligne d\'erreur est visible au-dessus du pied',
    X.doc.activeElement === X.champ(CLE0, 'qte') && cq.top >= 8 && cq.bottom <= 700 - 8 + 0.5, JSON.stringify(cq) + ' st=' + st);
  t('la feuille reserve aussi la hauteur du pied (scroll-padding-bottom)', /\.dmod__boite\{[^}]*scroll-padding-bottom:/.test(lire('src/css/bdv-devis.css').replace(/\s+/g, '')));
  X.taper(X.champ(CLE0, 'qte'), '6');
  X.mode = 'ok';
  await X.enregistrer();
  X.clic('[data-dev="apercu"]');
  t('l\'apercu ne garde pas l\'avis precedent (« ... enregistré. »)', X.avis() === '' && X.doc.getElementById('devAvis').hidden);
  t('en entrant dans l\'apercu, le focus va sur « Imprimer ou enregistrer en PDF », pas sur body',
    X.doc.activeElement === m.querySelector('[data-dev="imprimer"]'));
  t('sous 700 px, une phrase dit comment lire en grand', m.querySelector('.dmod__pdf').textContent === 'Pour lire en grand, enregistre-le en PDF.'
    && /\.dmod__pdf\{display:none;\}@media\(max-width:700px\)\{\.bdv-coque\.dmod__pdf\{display:block;\}/.test(lire('src/css/bdv-devis.css').replace(/\s+/g, '')));
  t('la feuille est centree dans son cadre', /\.dmod__feuille-i\{[^}]*margin:0auto/.test(lire('src/css/bdv-devis.css').replace(/\s+/g, '')));
  X.clic('[data-dev="revenir"]');
  m.querySelector('.dmod__pied').getBoundingClientRect = () => ({ top: 700, bottom: 800, height: 100 });
  st = 0;
  X.clic('[data-dev="abandonner"]');
  const oui = m.querySelector('[data-dev="confirmerAbandon"]');
  t('« Abandonner ce devis » : le focus va sur « Non, le garder », jamais sur le geste qui detruit',
    X.doc.activeElement === m.querySelector('[data-dev="garder"]') && X.doc.activeElement !== oui);
  X.clic('[data-dev="garder"]');
  X.clic('[data-dev="fermer"]');
  t('la croix rend le focus a un element VIVANT (celui que designe l\'affaire), jamais body', X.doc.activeElement === X.doc.getElementById('depart'),
    X.doc.activeElement && X.doc.activeElement.tagName);
  await X.ouvrir({ devis: { ...X.devis[0] } });
  X.clic('[data-dev="retour"]');
  t('« Retour à l’affaire » passe le devis ouvert, pour que l\'affaire ramene sa ligne', X.retourId === 'dv1', X.retourId);
}
{
  /* L'APERCU SORT DU TIROIR ETROIT, et la feuille est A4 reduite, sans defilement dans l'iframe. */
  const X = monter({ tiroir: true });
  await X.ouvrir();
  X.cocher(CLE0);
  await X.enregistrer();
  const box = X.modale().querySelector('.tmod__boite');
  const r0 = X.tiroir.retirer, p0 = X.tiroir.poser.length;
  X.clic('[data-dev="apercu"]');
  await attendre(20);
  t('« Voir et imprimer » garde la modale large, sans toucher a BdvTiroir',
    X.tiroir.retirer === r0 && box.getAttribute('role') === 'dialog' && box.getAttribute('aria-modal') === 'true' && box.classList.contains('dmod__boite--apercu'));
  const f = X.doc.getElementById('devFeuille');
  t('la feuille est rendue a la largeur A4 (794 px) et a la hauteur de son document, puis mise a l\'echelle',
    !!f && f.style.width === '794px' && /^\d+px$/.test(f.style.height) && /^scale\(/.test(f.style.transform), f && f.getAttribute('style'));
  t('et la feuille de la page ne la contraint plus par un aspect-ratio (qui faisait defiler l\'iframe)', !/aspect-ratio/.test(lire('src/css/bdv-devis.css')));
  X.clic('[data-dev="revenir"]');
  t('« Revenir au devis » ne repose aucun tiroir, la boite reste une modale', X.tiroir.poser.length === p0 && box.getAttribute('aria-modal') === 'true');
  X.clic('[data-dev="abandonner"]'); X.clic('[data-dev="confirmerAbandon"]'); await attendre(10);
  t('devis abandonne : « Devis D-… abandonné, pour X » (le mot ne s\'accorde pas au client)',
    /^Devis D-2026-0001 abandonné, pour Chez Paul$/.test(X.doc.getElementById('devTitre').textContent), X.doc.getElementById('devTitre').textContent);
}
{
  const X = monter({ domaine: 'panne' });
  await X.ouvrir();
  t('fiche du domaine ILLISIBLE (reseau) : phrase distincte, pas « il manque des infos »',
    X.corps().textContent === 'Je n’arrive pas à lire la fiche de ton domaine. Vérifie ta connexion et rouvre le devis.', X.corps().textContent);
  const Y = monter({ domaine: 'sql' });
  await Y.ouvrir();
  t('et de meme si la table du lot 38 manque', /Je n’arrive pas à lire la fiche de ton domaine/.test(Y.corps().textContent));
  const Z = monter();
  await Z.ouvrir();
  Z.cocher(CLE0);
  Z.mode = 'incomplete';
  Z.fiche.ville = null;
  await Z.enregistrer();
  await attendre(10);
  t('refus « fiche du domaine incomplete » : la fiche est RELUE et seuls les vrais manques sont dits',
    /Il manque des infos sur ton domaine pour faire un devis : la ville\./.test(Z.corps().textContent), Z.corps().textContent);
}
{
  const X = monter({ props: props(9, 'client') });
  await X.ouvrir();
  t('un seul vin de plus : « Voir l’autre vin », pas « Voir les 1 autres »', /Voir l’autre vin/.test(X.corps().textContent) && !/Voir les 1 /.test(X.corps().textContent));
}
{
  /* UNE AFFAIRE GAGNEE OU PERDUE : ses devis se relisent et s'impriment, rien ne se modifie. */
  const X = monter({ fiche: Object.assign({}, FICHE, { siret: null }), ctx: { affaire: { affaire_id: 'aG', issue: 'gagnee' } } });
  X.lignes.dG = [{ rang: 1, num_produit: 'P100', designation: 'Cuvée A', conditionnement: '75 cl', millesime: '2015', quantite: 6, pu_ht_c: 850, remise_cb: 0,
    source_prix: 'client', pu_l_c: 850, pu_f_c: 850, net_c: 5100, final_c: 5100 }];
  await X.ouvrir({ devis: { bureau: BUREAU, devis_id: 'dG', affaire_id: 'aG', numero: 'D-2026-0004', statut: 'enregistre', date_devis: '2026-09-20',
    valable_jusqu: '2026-10-20', vendeur: FICHE, acheteur: { nom: 'Le Bistrot' }, paiement_mode: 'fdm', paiement_jours: 30, validite_jours: 30,
    remise_globale_cb: 0, total_vins_c: 5100, remise_globale_c: 0, total_ht_c: 5100, tva_c: 1020, total_ttc_c: 6120 } });
  t('affaire close : le devis s\'ouvre en lecture seule (aucun champ, aucun « Enregistrer »), meme si la fiche a change depuis',
    X.corps().querySelectorAll('input, textarea').length === 0 && !X.modale().querySelector('[data-dev="enregistrer"]') && /Cuvée A 2015/.test(X.corps().textContent));
  t('mais « Voir et imprimer » reste', !!X.modale().querySelector('[data-dev="apercu"]'));
  t('et aucune proposition n\'est demandee', !X.requetes.some(r => r.chemin === '/rpc/devis_propositions'));
}

/* ---------------------------------------------------------------------------- */
titre('5. Charge au clic : rien dans le code bloquant');
{
  const nav = lire('src/js/bdv-nav.js');
  t('bdv-nav.js ne nomme pas le devis', !/bdv-devis|BdvDevis/.test(nav));
  const gabarits = ['src/mon-bureau.njk', 'src/_includes/base.njk'].map(lire).join('\n');
  t('le gabarit ne lie ni la piece, ni le calcul, ni les feuilles du devis', !/bdv-devis/.test(gabarits));
  const aff = sansCommentaires(SRC_AFF);
  t('bdv-affaires.js pose la feuille, le calcul et la piece au clic, dans cet ordre',
    /poserCss\('\/css\/bdv-devis\.css'\)\.then\(chargerCalcul\)/.test(aff) && /poserJs\('\/js\/bdv-devis-calcul\.js'\)/.test(aff) && /poserJs\('\/js\/bdv-devis\.js'\)/.test(aff));
  t('la promesse du chargeur est retenue (un seul chargement)', /if \(_devis\) return _devis;/.test(aff) && /_devis = p;/.test(aff));
  const feuilles = lire('scripts/feuilles-bureau.mjs');
  t('les deux feuilles sont declarees dans feuilles-bureau.mjs', /src\/css\/bdv-devis\.css/.test(feuilles) && /src\/css\/bdv-devis-papier\.css/.test(feuilles));
  const pkg = JSON.parse(lire('package.json'));
  const v = pkg.scripts.verif || '';
  t('« banc:devis » est dans verif, apres banc:domaine, suivi de banc:commande (lot 49), banc:signature (lot 55) puis banc:poids',
    pkg.scripts['banc:devis'] === 'node scripts/banc-devis.mjs' && v.indexOf('npm run banc:domaine && npm run banc:devis && npm run banc:commande && npm run banc:signature && npm run banc:poids') >= 0);
}

titre('6. Le dessin : que des jetons, 44 px, pas de @media print');
{
  const css = sansCommentaires(lire('src/css/bdv-devis.css'));
  const pap = sansCommentaires(lire('src/css/bdv-devis-papier.css'));
  t('aucune couleur en dur dans les deux feuilles', !/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(css + pap));
  t('tailles de texte et rayons par jetons seulement', !/font-size:\s*(?!var\()/.test(css + pap) && !/border-radius:\s*(?!var\()/.test(css + pap));
  t('ni ombre, ni z-index', !/box-shadow|z-index/.test(css + pap));
  t('PAS de @media print, ni de @page, dans la feuille de la page', !/@media\s+print|@page/.test(css));
  t('le @page A4 portrait vit dans la feuille du papier', /@page\s*\{\s*size:\s*A4 portrait/.test(pap));
  t('chaque regle de la boite est portee par .bdv-coque', css.split('}').map(r => r.split('{')[0].trim()).filter(s => s && !/^@/.test(s))
    .every(s => s.split(',').every(x => /^\.bdv-coque\s/.test(x.trim()))));
  t('le pied est collant en bas', /\.dmod__pied\{[^}]*position:sticky;[^}]*bottom:calc\(-1\*var\(--bdv-e-6\)\)/.test(css.replace(/\s+/g, '')));
  t('sous 700 px, boutons, champs et liens a 44 px', /@media\s*\(max-width:700px\)\{[^@]*\.dmod \.btn[^{]*\{\s*min-height:var\(--bdv-cible\)/.test(css));
  t('la case d\'une ligne est une cible de 44 px a toutes les largeurs', /\.dmod__coche\{[^}]*min-height:var\(--bdv-cible\)/.test(css.replace(/\s+/g, '')));
}

titre('7. Les ids du devis ne rencontrent aucun gabarit');
{
  const ids = [...new Set([...SRC_DEVIS.matchAll(/id="(dev[A-Za-z0-9]*)/g)].map(m => m[1]).concat(['devisModale', 'devImpression']))];
  const trouves = [];
  const marcher = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return marcher(p);
    if (/\.njk$/.test(e.name)) { const s = fs.readFileSync(p, 'utf8'); ids.forEach(id => { if (new RegExp('id=["\']' + id + '["\']').test(s)) trouves.push(id + ' dans ' + path.relative(RACINE, p)); }); }
  });
  marcher(path.join(RACINE, 'src'));
  t('ids releves dans la piece : ' + ids.length, ids.length >= 10);
  t('aucun n\'est deja pris par un gabarit .njk', trouves.length === 0, trouves.join(', '));
  const autres = ['src/js/bdv-affaires.js', 'src/js/bdv-ecrans.js', 'src/js/bdv-taches.js', 'src/js/bdv-reglages.js', 'src/js/bdv-domaine.js'].map(lire).join('\n');
  t('ni par un autre module du bureau', ids.every(id => !new RegExp('id="' + id + '"').test(autres)));
  t('aucun onclick, aucun tiret cadratin dans les sources du devis',
    ![SRC_DEVIS, SRC_CALC, lire('src/css/bdv-devis.css'), lire('src/css/bdv-devis-papier.css')].some(s => /onclick|—/.test(s)));
}

titre('8. Lot 50 : « Je l’ai envoyé », la relance, l’expiration, refaire');
{
  const X = monter({ ctx: { affaire: { affaire_id: 'aC', issue: 'en_cours', rappel: '2026-10-20', rappel_titre: 'Rappeler Paul' }, etapeDevis: { etape_id: 'e2', nom: 'Devis envoyé' } } });
  await X.ouvrir();
  const m = X.modale();
  X.cocher(CLE0); X.cocher(CLE1);
  X.taper(X.champ(CLE0, 'qte'), '12'); X.taper(X.champ(CLE1, 'qte'), '6');
  t('avant l\'enregistrement, pas de « Je l’ai envoyé »', !m.querySelector('[data-dev="envoyer"]'));
  await X.enregistrer();
  t('apres l\'enregistrement, « Je l’ai envoyé » apparait', !!m.querySelector('[data-dev="envoyer"]'), X.avis());
  X.taper(X.champ(CLE0, 'qte'), '13');
  const nE0 = X.requetes.filter(r => r.chemin === '/rpc/devis_envoyer').length;
  X.clic('[data-dev="envoyer"]');
  t('un formulaire modifie ne se note pas envoye : on le dit, rien ne part',
    /Enregistre d’abord/.test(X.avis()) && X.doc.getElementById('devEnvoi').hidden && X.requetes.filter(r => r.chemin === '/rpc/devis_envoyer').length === nE0, X.avis());
  await X.enregistrer();
  X.clic('[data-dev="envoyer"]');
  const box = X.doc.getElementById('devEnvoi');
  t('« Je l’ai envoyé » ouvre le bloc, focus sur « Pas encore »', !box.hidden && X.doc.activeElement === box.querySelector('[data-dev="pasEnvoye"]'));
  t('la relance est proposee une semaine apres l\'envoi (ou au dernier jour de validite)',
    X.doc.getElementById('devEnvoiRelance').value === (() => { const a = X.doc.getElementById('devEnvoiJour').value; const d = new Date(a + 'T12:00:00'); d.setDate(d.getDate() + 7); const r = d.toISOString().slice(0, 10); return r > '2026-10-30' ? '2026-10-30' : r; })(), X.doc.getElementById('devEnvoiRelance').value);
  t('le rappel deja pose est nomme : celui-ci le remplace (X9 : « du 20 oct. », pas 20/10/2026)', /remplace celui du 20\u00a0oct\. \(Rappeler Paul\)\./.test(box.textContent) && !/20\/10\/2026/.test(box.textContent), box.textContent);
  { const rel = X.doc.getElementById('devEnvoiRelance'), avant = rel.value, rp = X.doc.getElementById('devEnvoiRemplace');
    X.taper(rel, '2026-10-20');
    t('X9 : relance posee LE MEME JOUR que le rappel en place : la phrase se tait', rp.hidden && !/remplace celui/.test(box.textContent), rp.textContent);
    X.taper(rel, avant);
    t('X9 : une autre date, la phrase revient', !rp.hidden && /remplace celui du 20\u00a0oct\./.test(rp.textContent));
    const cr = X.doc.getElementById('devEnvoiRappel'); cr.checked = false; cr.dispatchEvent(new X.w.Event('change', { bubbles: true }));
    t('X9 : sans relance cochee, rien n\'est remplace : la phrase se tait', rp.hidden);
    cr.checked = true; cr.dispatchEvent(new X.w.Event('change', { bubbles: true })); }
  t('l\'etape « Devis envoyé » est proposee, cochee', !!X.doc.getElementById('devEnvoiEtape') && X.doc.getElementById('devEnvoiEtape').checked);
  t('et le bloc dit que le devis ne se modifiera plus', /ne se modifiera plus/.test(box.textContent));
  X.doc.getElementById('devEnvoiJour').value = '2099-01-01';
  X.clic('[data-dev="confirmerEnvoi"]'); await attendre(10);
  t('une date d\'envoi dans le futur est refusee avant de partir', /futur/.test(X.avis() + X.modale().textContent) && X.requetes.filter(r => r.chemin === '/rpc/devis_envoyer').length === nE0);
  X.doc.getElementById('devEnvoiJour').value = '2026-09-30';
  for (const [mode, re] of [['env-null', /L’envoi n’est pas noté.*pas figé/], ['env-sql', /pas encore disponible/], ['env-futur', /futur/]]) {
    X.mode = mode;
    X.clic('[data-dev="confirmerEnvoi"]'); await attendre(10);
    t('retour « ' + mode + ' » : le devis n\'est pas fige, et on le dit', re.test(X.avis()) && X.devis[0].statut === 'enregistre' && !!m.querySelector('[data-dev="enregistrer"]'), X.avis());
  }
  X.mode = 'ok';
  X.clic('[data-dev="confirmerEnvoi"]'); await attendre(10);
  const env = X.requetes.filter(r => r.chemin === '/rpc/devis_envoyer').pop().corps;
  t('l\'envoi part pour CE bureau, CE devis, la date, la relance, l\'etape',
    env.p_bureau === BUREAU && env.p_devis === 'dv1' && env.p_jour === '2026-09-30' && /^\d{4}-\d{2}-\d{2}$/.test(env.p_rappel) && env.p_etape === 'e2' && env.p_rappel_titre === null, JSON.stringify(env));
  t('« Devis D-2026-0001 noté envoyé le 30/09/2026. Relance prévue le ... »', /^Devis D-2026-0001 noté envoyé le 30\/09\/2026\. Relance prévue le \d{2}\/\d{2}\/\d{4}, dans Ma journée\.$/.test(X.avis()), X.avis());
  t('ENVOYE = LECTURE SEULE : aucun champ (hors confirmation repliee), aucun « Enregistrer », plus de « Je l’ai envoyé »',
    [...X.corps().querySelectorAll('input, textarea, select')].filter(n => !n.closest('[hidden]')).length === 0 && !m.querySelector('[data-dev="enregistrer"]') && !m.querySelector('[data-dev="envoyer"]'));
  t('le titre dit « envoyé », et « Refaire ce devis » est propose', /envoyé/.test(X.doc.getElementById('devTitre').textContent) && !!m.querySelector('[data-dev="refaire"]'));
  t('l\'affaire est prevenue, et son rappel devient « Relancer le devis D-2026-0001 »',
    (X.changes || []).slice(-1)[0].statut === 'envoye' && X.ctx.affaire.rappel_titre === 'Relancer le devis D-2026-0001' && X.ctx.affaire.rappel === env.p_rappel, X.ctx.affaire.rappel_titre);

  titre('8 bis. Refaire ce devis');
  const nEnr = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').length;
  X.clic('[data-dev="refaire"]'); await attendre(10);
  t('« Refaire » ouvre un NOUVEAU devis aux memes lignes, rien n\'est ecrit',
    !!m.querySelector('[data-dev="enregistrer"]') && m.querySelectorAll('.dmod__ligne input[data-dev-coche]:checked').length === 2
    && X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').length === nEnr && /Nouveau devis, avec les lignes du D-2026-0001/.test(X.avis()), X.avis());
  t('aucun numero tant qu\'il n\'est pas enregistre', !/D-2026-0002/.test(X.doc.getElementById('devTitre').textContent));
  await X.enregistrer();
  const env3 = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').pop().corps;
  t('l\'enregistrement porte p_version_de = l\'ancien, et p_devis vide', env3.p_version_de === 'dv1' && env3.p_devis === null, JSON.stringify({ v: env3.p_version_de, d: env3.p_devis }));
  t('le nouveau prend D-2026-0002, l\'ancien passe abandonne', /D-2026-0002/.test(X.avis()) && X.devis[0].statut === 'abandonne' && X.devis[1].version_de === 'dv1', X.avis());
  const env4 = (await (async () => { X.taper(X.champ(CLE0, 'qte'), '14'); await X.enregistrer(); return X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').pop().corps; })());
  t('une modification suivante ne renvoie plus p_version_de (PostgREST nomme les parametres)', !('p_version_de' in env4) && env4.p_devis === 'dv2', JSON.stringify(Object.keys(env4)));
}
{
  titre('8 ter. Un devis envoye dont la validite est passee');
  const X = monter();
  X.devis.push({ bureau: BUREAU, devis_id: 'dvX', affaire_id: 'aC', numero: 'D-2026-0009', statut: 'envoye', date_devis: '2026-01-02', valable_jusqu: '2026-02-01', envoye_le: '2026-01-03',
    vendeur: Object.assign({}, FICHE), acheteur: { nom: 'Chez Paul', nouveau: false, code_postal: '44000', ville: 'Nantes', num_client: 'C7' },
    remise_globale_cb: 0, tva_cb: 2000, total_vins_c: 1000, remise_globale_c: 0, total_ht_c: 1000, tva_c: 200, total_ttc_c: 1200, cree_le: '2026-01-02T08:00:00+00:00', maj_le: '2026-01-03T08:00:00+00:00' });
  X.lignes.dvX = [{ rang: 1, num_produit: 'P100', designation: 'Cuvée A', millesime: '2015', conditionnement: '75 cl', quantite: 1, pu_ht_c: 1000, remise_cb: 0, pu_l_c: 1000, pu_f_c: 1000, net_c: 1000, final_c: 1000, source_prix: 'client' }];
  await X.ouvrir({ devis: { ...X.devis[0] } });
  t('le titre dit « expiré », pas « envoyé »', /expiré/.test(X.doc.getElementById('devTitre').textContent) && !/envoyé/.test(X.doc.getElementById('devTitre').textContent), X.doc.getElementById('devTitre').textContent);
  t('et la phrase dit quoi faire : relancer ou refaire', /Il a expiré : ses prix ne tiennent plus, relance ou refais-le\./.test(X.modale().textContent));
  t('le refaire reste propose', !!X.modale().querySelector('[data-dev="refaire"]'));
}
{
  titre('8 quater. Sur une affaire close, un devis envoye se relit, il ne se refait pas');
  const X = monter({ ctx: { affaire: { affaire_id: 'aC', issue: 'perdue' } } });
  X.devis.push({ bureau: BUREAU, devis_id: 'dvY', affaire_id: 'aC', numero: 'D-2026-0010', statut: 'envoye', date_devis: '2026-09-30', valable_jusqu: '2099-01-01', envoye_le: '2026-09-30',
    vendeur: Object.assign({}, FICHE), acheteur: { nom: 'Chez Paul', nouveau: false }, remise_globale_cb: 0, tva_cb: 2000, total_vins_c: 1000, remise_globale_c: 0, total_ht_c: 1000, tva_c: 200, total_ttc_c: 1200,
    cree_le: '2026-09-30T08:00:00+00:00', maj_le: '2026-09-30T08:00:00+00:00' });
  X.lignes.dvY = [];
  await X.ouvrir({ devis: { ...X.devis[0] } });
  t('pas de « Refaire ce devis », pas de « Le client a dit oui »', !X.modale().querySelector('[data-dev="refaire"]') && !X.modale().querySelector('[data-dev="accepter"]'));
}

titre('9. Lot 51 : « Il a dit non »');
{
  const X = monter({ ctx: { affaire: { affaire_id: 'aC', issue: 'en_cours' }, autresEnCours: 0 } });
  await X.ouvrir();
  const m = X.modale();
  X.cocher(CLE0); X.taper(X.champ(CLE0, 'qte'), '12');
  t('avant l\'enregistrement, pas de « Il a dit non »', !m.querySelector('[data-dev="refuser"]'));
  await X.enregistrer();
  t('apres, « Il a dit non » est la, a cote d\'« Abandonner »', !!m.querySelector('[data-dev="refuser"]'), X.avis() + ' / ' + X.devis.length);
  const motifsDevis = [...m.querySelectorAll('#devRefusMotif option')].map(o => o.value + '=' + o.textContent);
  const motifsAff = [...SRC_AFF.match(/var MOTIFS = \[([\s\S]*?)\];/)[1].matchAll(/\['(\w+)', '([^']+)'\]/g)].map(x => x[1] + '=' + x[2]);
  t('les motifs du refus sont ceux d\'une affaire perdue, dans le meme ordre', motifsDevis.join('|') === motifsAff.join('|') && motifsDevis.length === 6, motifsDevis.join('|'));
  t('les motifs sont ceux de la base (devis_refuse_motif)', motifsAff.map(x => x.split('=')[0]).every(c => lire('supabase/lot51-devis-mentions-refus.sql').indexOf("'" + c + "'") >= 0));
  X.taper(X.champ(CLE0, 'qte'), '13');
  X.clic('[data-dev="refuser"]');
  t('un formulaire modifie ne se note pas refuse : on le dit', /Enregistre d’abord/.test(X.avis()) && X.doc.getElementById('devRefus').hidden, X.avis());
  await X.enregistrer();
  const nR = X.requetes.filter(r => r.chemin === '/rpc/devis_refuser').length;
  X.clic('[data-dev="refuser"]');
  const box = X.doc.getElementById('devRefus');
  t('la confirmation s\'ouvre, focus sur « Pas encore », rien ne part', !box.hidden && X.doc.activeElement === box.querySelector('[data-dev="pasRefus"]') && X.requetes.filter(r => r.chemin === '/rpc/devis_refuser').length === nR);
  t('« Passer l’affaire à Pas pour cette fois » est propose, coche', !!X.doc.getElementById('devRefusClore') && X.doc.getElementById('devRefusClore').checked);
  X.clic('[data-dev="pasRefus"]');
  t('« Pas encore » referme et rend le focus a « Il a dit non »', box.hidden && X.doc.activeElement === m.querySelector('[data-dev="refuser"]'));
  X.clic('[data-dev="refuser"]');
  X.doc.getElementById('devRefusMotif').value = 'prix';
  for (const [mode, re] of [['ref-null', /Le refus n’est pas noté.*n’a pas bougé/], ['ref-sql', /Noter un refus n’est pas encore disponible/], ['ref-autre', /autre devis en cours/]]) {
    X.mode = mode; X.clic('[data-dev="confirmerRefus"]'); await attendre(10);
    t('retour « ' + mode + ' » : le devis n\'a pas bouge, et on le dit', re.test(X.avis()) && X.devis[0].statut === 'enregistre', X.avis());
  }
  X.mode = 'ok';
  X.clic('[data-dev="confirmerRefus"]'); await attendre(10);
  const c = X.requetes.filter(r => r.chemin === '/rpc/devis_refuser').pop().corps;
  t('le refus part pour CE bureau, CE devis, le motif et la cloture', c.p_bureau === BUREAU && c.p_devis === 'dv1' && c.p_motif === 'prix' && c.p_clore === true, JSON.stringify(c));
  t('« Devis D-2026-0001 noté refusé. L’affaire passe à « Pas pour cette fois ». »', /^Devis D-2026-0001 noté refusé\. L’affaire passe à « Pas pour cette fois »\.$/.test(X.avis()), X.avis());
  t('le titre dit « refusé », le sous-titre le motif', /refusé/.test(X.doc.getElementById('devTitre').textContent) && /Refusé le 01\/10\/2026 : le prix\./.test(m.querySelector('.tmod__sous').textContent), m.querySelector('.tmod__sous').textContent);
  t('LECTURE SEULE, et pas de « Refaire » sur une affaire close', X.corps().querySelectorAll('input, textarea, select').length === 0 && !m.querySelector('[data-dev="refaire"]') && !m.querySelector('[data-dev="enregistrer"]'));
  t('l\'affaire est prevenue : refus ET cloture', (X.changes || []).slice(-1)[0].statut === 'refuse' && (X.changes || []).slice(-1)[0].affaireClose === true && X.ctx.affaire.issue === 'perdue');
}
{
  const X = monter({ ctx: { affaire: { affaire_id: 'aC', issue: 'en_cours' }, autresEnCours: 1 } });
  await X.ouvrir();
  X.cocher(CLE0); X.taper(X.champ(CLE0, 'qte'), '12');
  await X.enregistrer();
  X.clic('[data-dev="refuser"]');
  t('un autre devis en cours : pas de case, la phrase dit que l\'affaire reste ouverte',
    !X.doc.getElementById('devRefusClore') && /un autre devis en cours : elle reste ouverte/.test(X.doc.getElementById('devRefus').textContent));
  X.clic('[data-dev="confirmerRefus"]'); await attendre(10);
  t('le refus part sans cloture, et l\'affaire reste en cours', X.requetes.filter(r => r.chemin === '/rpc/devis_refuser').pop().corps.p_clore === false && X.ctx.affaire.issue === 'en_cours');
  t('sur une affaire ouverte, un devis refuse se REFAIT', !!X.modale().querySelector('[data-dev="refaire"]'));
  X.clic('[data-dev="refaire"]'); await attendre(10);
  t('« Refaire » d\'un refuse ouvre un nouveau devis aux memes lignes', !!X.modale().querySelector('[data-dev="enregistrer"]') && /Nouveau devis, avec les lignes du D-2026-0001/.test(X.avis()), X.avis());
}

titre('9 bis. Lot 51 : « Annuler l’acceptation »');
{
  const X = monter({ ctx: { affaire: { affaire_id: 'aC', issue: 'gagnee' } } });
  X.devis.push({ bureau: BUREAU, devis_id: 'dvA', affaire_id: 'aC', numero: 'D-2026-0020', statut: 'accepte', date_devis: '2026-09-30', valable_jusqu: '2099-01-01',
    envoye_le: '2026-09-30', accepte_le: '2026-10-01T08:00:00+00:00', vendeur: Object.assign({}, FICHE), acheteur: { nom: 'Chez Paul', nouveau: false, num_client: 'C7' },
    remise_globale_cb: 0, tva_cb: 2000, total_vins_c: 1000, remise_globale_c: 0, total_ht_c: 1000, tva_c: 200, total_ttc_c: 1200,
    cree_le: '2026-09-30T08:00:00+00:00', maj_le: '2026-10-01T08:00:00+00:00' });
  X.lignes.dvA = [{ rang: 1, num_produit: 'P100', designation: 'Cuvée A', millesime: '2015', conditionnement: '75 cl', quantite: 1, pu_ht_c: 1000, remise_cb: 0, pu_l_c: 1000, pu_f_c: 1000, net_c: 1000, final_c: 1000, source_prix: 'client' }];
  await X.ouvrir({ devis: { ...X.devis[0] } });
  const m = X.modale();
  { const cmd = m.querySelector('.dmod__commande'), qui = m.querySelector('#devQuiT');
    t('X2 : commande jamais telechargee, « La commande Vitisoft » est EN TETE du devis, avant « Pour qui »',
      !!cmd && !!qui && (cmd.compareDocumentPosition(qui) & 4) !== 0 && m.querySelectorAll('.dmod__commande').length === 1 && !!cmd.querySelector('[data-dev="telecharger"]')); }
  t('un devis accepte propose « Annuler l’acceptation »', !!m.querySelector('[data-dev="annulerAccord"]'));
  X.clic('[data-dev="annulerAccord"]');
  const box = X.doc.getElementById('devAnnul');
  t('la confirmation s\'ouvre, focus sur « Non, la garder »', !box.hidden && X.doc.activeElement === box.querySelector('[data-dev="garderAccord"]'));
  t('elle previent pour Vitisoft et dit ou revient le devis', /supprime-la aussi là-bas : sinon elle sera facturée/.test(box.textContent) && /repassera envoyé/.test(box.textContent), box.textContent);
  t('« Rouvrir l’affaire » est propose, coche', !!X.doc.getElementById('devAnnulRouvrir') && X.doc.getElementById('devAnnulRouvrir').checked);
  {
    const pleins = () => [...m.querySelectorAll('.btn--bordeaux')].filter(b => !b.closest('[hidden]') && b.getAttribute('aria-disabled') !== 'true');
    const tl = m.querySelector('[data-dev="telecharger"]');
    t('T7 : pendant la question, un seul bouton plein, « Oui, annuler l’acceptation »', pleins().length === 1 && pleins()[0].getAttribute('data-dev') === 'confirmerAnnul');
    t('T7 : « Télécharger la commande » en retrait, et sa description est la phrase de la question',
      tl.getAttribute('aria-disabled') === 'true' && !tl.classList.contains('btn--bordeaux') && tl.getAttribute('aria-describedby') === 'devAnnulDit' && !!X.doc.getElementById('devAnnulDit'));
    const avA = X.avis();
    tl.focus();
    X.clic('[data-dev="telecharger"]'); await attendre(5);
    t('T7 : un appui pendant la question ne telecharge rien et ramene a « Non, la garder »',
      !/téléchargé/.test(X.avis()) && X.avis() === avA && X.doc.activeElement === box.querySelector('[data-dev="garderAccord"]'), X.avis());
    X.clic('[data-dev="garderAccord"]');
    t('T7 : « Non, la garder » rend « Télécharger la commande » plein', tl.classList.contains('btn--bordeaux') && !tl.hasAttribute('aria-disabled'));
    X.clic('[data-dev="annulerAccord"]');
  }
  X.mode = 'ann-null'; X.clic('[data-dev="confirmerAnnul"]'); await attendre(10);
  t('retour vide : « toujours accepté », rien n\'a bouge', /toujours accepté/.test(X.avis()) && X.devis[0].statut === 'accepte', X.avis());
  X.mode = 'ann-encore'; X.clic('[data-dev="confirmerAnnul"]'); await attendre(10);
  t('un retour qui porte encore la date d\'accord n\'est pas une annulation', /toujours accepté/.test(X.avis()) && /accepté/.test(X.doc.getElementById('devTitre').textContent), X.avis());
  X.mode = 'ok'; X.clic('[data-dev="confirmerAnnul"]'); await attendre(10);
  const c = X.requetes.filter(r => r.chemin === '/rpc/devis_annuler_accord').pop().corps;
  t('l\'annulation part pour CE bureau, CE devis, et rouvrir', c.p_bureau === BUREAU && c.p_devis === 'dvA' && c.p_rouvrir === true, JSON.stringify(c));
  t('le devis est de nouveau envoye, l\'affaire rouverte, Vitisoft rappele', /envoyé/.test(X.doc.getElementById('devTitre').textContent)
    && X.ctx.affaire.issue === 'en_cours' && /Acceptation du devis D-2026-0020 annulée : il est de nouveau envoyé\. L’affaire est rouverte\. Pense à supprimer la commande dans Vitisoft/.test(X.avis()), X.avis());
  t('la trace s\'affiche : « Acceptation annulée le »', /Acceptation annulée le 01\/10\/2026/.test(m.querySelector('.tmod__sous').textContent));
  t('l\'affaire est prevenue (affaireRouverte)', (X.changes || []).slice(-1)[0].affaireRouverte === true);
  t('et le devis se re-accepte : « Le client a dit oui ? » revient', !!m.querySelector('[data-dev="accepter"]') || !!m.querySelector('#devCmdT'));
}

{
  /* X2 : une fois telechargee, la commande retrouve sa place apres les conditions */
  const X = monter({ lot52: true, ctx: { affaire: { affaire_id: 'aT', issue: 'gagnee' } } });
  X.devis.push({ bureau: BUREAU, devis_id: 'dvT', affaire_id: 'aT', numero: 'D-2026-0022', statut: 'accepte', date_devis: '2026-09-30', valable_jusqu: '2099-01-01',
    envoye_le: '2026-09-30', accepte_le: '2026-10-01T08:00:00+00:00', vendeur: Object.assign({}, FICHE), acheteur: { nom: 'Chez Paul', nouveau: false, num_client: 'C7' },
    remise_globale_cb: 0, tva_cb: 2000, total_vins_c: 1000, remise_globale_c: 0, total_ht_c: 1000, tva_c: 200, total_ttc_c: 1200,
    commande_telechargements: 1, commande_telechargee_le: '2026-10-01T09:00:00+00:00',
    cree_le: '2026-09-30T08:00:00+00:00', maj_le: '2026-10-01T08:00:00+00:00' });
  X.lignes.dvT = [{ rang: 1, num_produit: 'P100', designation: 'Cuvée A', millesime: '2015', conditionnement: '75 cl', quantite: 1, pu_ht_c: 1000, remise_cb: 0, pu_l_c: 1000, pu_f_c: 1000, net_c: 1000, final_c: 1000, source_prix: 'client' }];
  await X.ouvrir({ devis: { ...X.devis[0] } });
  const m = X.modale(), cmd = m.querySelector('.dmod__commande'), cond = m.querySelector('#devCondT');
  t('X2 : deja telechargee, la commande vient apres les conditions', !!cmd && !!cond && (cond.compareDocumentPosition(cmd) & 4) !== 0 && m.querySelectorAll('.dmod__commande').length === 1);
}
{
  /* T5 (tour 3) : l'affaire d'une personne en opposition ne se rouvre pas */
  const X = monter({ ctx: { affaire: { affaire_id: 'aO', issue: 'gagnee' }, opposee: true } });
  X.devis.push({ bureau: BUREAU, devis_id: 'dvO', affaire_id: 'aO', numero: 'D-2026-0021', statut: 'accepte', date_devis: '2026-09-30', valable_jusqu: '2099-01-01',
    envoye_le: '2026-09-30', accepte_le: '2026-10-01T08:00:00+00:00', vendeur: Object.assign({}, FICHE), acheteur: { nom: 'Chez Paul', nouveau: false, num_client: 'C7' },
    remise_globale_cb: 0, tva_cb: 2000, total_vins_c: 1000, remise_globale_c: 0, total_ht_c: 1000, tva_c: 200, total_ttc_c: 1200,
    cree_le: '2026-09-30T08:00:00+00:00', maj_le: '2026-10-01T08:00:00+00:00' });
  X.lignes.dvO = [{ rang: 1, num_produit: 'P100', designation: 'Cuvée A', millesime: '2015', conditionnement: '75 cl', quantite: 1, pu_ht_c: 1000, remise_cb: 0, pu_l_c: 1000, pu_f_c: 1000, net_c: 1000, final_c: 1000, source_prix: 'client' }];
  await X.ouvrir({ devis: { ...X.devis[0] } });
  X.clic('[data-dev="annulerAccord"]');
  t('T5 : opposition, la question n\'offre pas « Rouvrir l’affaire » et dit pourquoi', !X.doc.getElementById('devAnnulRouvrir')
    && /L’affaire reste close : cette personne a demandé à ne plus être contactée/.test(X.doc.getElementById('devAnnul').textContent));
  X.clic('[data-dev="confirmerAnnul"]'); await attendre(10);
  t('T5 : et l\'annulation part sans rouvrir', X.requetes.filter(r => r.chemin === '/rpc/devis_annuler_accord').pop().corps.p_rouvrir === false);
}

titre('9 ter. Lot 51 : les mentions et le bon pour accord sur le papier');
{
  const X = monter();
  const v = Object.assign({}, FICHE, { siret: '12345678900012', siren: '123456789', rcs_ville: 'Nantes', capital_eur: 7500 });
  const base = { numero: 'D-2026-0001', statut: 'enregistre', date_devis: '2026-09-30', valable_jusqu: '2026-10-30', acheteur: { nom: 'X' },
    total_vins_c: 100, remise_globale_c: 0, total_ht_c: 100, tva_c: 20, total_ttc_c: 120, remise_globale_cb: 0 };
  const h = X.w.BdvDevis.htmlPapier(Object.assign({}, base, { vendeur: v }), [], { conditions: 'Paiement à 30 jours fin de mois' }).replace(/[  ]/g, ' ');
  t('« RCS Nantes 123 456 789 » imprime avec le SIREN', /RCS Nantes 123 456 789/.test(h));
  t('« Capital de 7 500 € » imprime', /Capital de 7 500 €/.test(h), (h.match(/Capital[^<]*/) || [''])[0]);
  t('le cadre « Bon pour accord » : date, nom et qualite, signature et cachet', /Bon pour accord/.test(h) && /Date :/.test(h) && /Nom et qualité du signataire :/.test(h) && /Signature et cachet :/.test(h));
  const h2 = X.w.BdvDevis.htmlPapier(Object.assign({}, base, { vendeur: Object.assign({}, FICHE) }), [], { conditions: '' });
  t('sans RCS ni capital : rien d\'invente', !/RCS /.test(h2) && !/Capital de/.test(h2));
  const h3 = X.w.BdvDevis.htmlPapier(Object.assign({}, base, { statut: 'refuse', vendeur: v }), [], { conditions: '' });
  t('un devis refuse n\'a pas de bon pour accord', !/Bon pour accord/.test(h3));
  const css = lire('src/css/bdv-devis-papier.css').replace(/\/\*[\s\S]*?\*\//g, '');
  t('le cadre ne se coupe pas entre deux pages', /\.dpap\.dpap__accord\{[^}]*break-inside:avoid/.test(css.replace(/\s+/g, '')));
}

titre('10. Lot 52 : la copie exacte du devis envoye');
async function devisEnvoye(o) {
  const X = monter(o);
  await X.ouvrir();
  X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="envoyer"]');
  X.doc.getElementById('devEnvoiRappel').checked = false;
  X.clic('[data-dev="confirmerEnvoi"]'); await attendre(20);
  X.env = X.requetes.filter(r => r.chemin === '/rpc/devis_envoyer').pop().corps;
  return X;
}
{
  const X = await devisEnvoye({ lot52: true, fetch: 'ok' });
  const p = X.env.p_papier || '';
  t('a l\'envoi, la copie part avec : un document complet, au numero du devis', /^<!doctype html>/.test(p) && p.indexOf('Devis D-2026-0001') >= 0, p.slice(0, 80));
  t('les DEUX feuilles y sont en ligne, plus aucun lien vers /css/', (p.match(/<style>\.dpap\{color:#000\}/g) || []).length === 2
    && /bdv-theme\.css/.test(p) && /bdv-devis-papier\.css/.test(p) && !/<link rel="stylesheet" href="\/css\//.test(p));
  t('aucun script dans la copie', !/<\s*script/i.test(p));
  t('l\'avis dit qu\'une copie exacte est gardee', /Une copie exacte est gardée\./.test(X.avis()), X.avis());
  X.clic('[data-dev="apercu"]'); await attendre(30);
  const lec = X.requetes.filter(r => /^\/devis_copies\?/.test(r.chemin));
  t('l\'apercu relit LA COPIE, pour CE bureau et CE devis', lec.length === 1 && /bureau=eq\./.test(lec[0].chemin) && /devis_id=eq\.dv1/.test(lec[0].chemin), JSON.stringify(lec));
  const f = X.doc.getElementById('devFeuille'), note = X.doc.getElementById('devCopieNote');
  t('elle s\'affiche dans une iframe SANS SCRIPT (sandbox sans allow-scripts)', !!f && f.getAttribute('sandbox') === 'allow-same-origin allow-modals');
  t('la note dit la copie exacte, la date d\'envoi, et l\'empreinte verifiee',
    !!note && !note.hidden && /C’est la copie exacte du devis envoyé le \d{2}\/\d{2}\/\d{4} : elle ne se modifie plus\. Empreinte numérique [0-9a-f]{4} [0-9a-f]{4} [0-9a-f]{4} [0-9a-f]{4}, vérifiée\./.test(note.textContent), note && note.textContent);
  t('... sans souci', !note.classList.contains('dmod__copie--souci'));
  X.clic('[data-dev="imprimer"]'); await attendre(20);
  const imp = X.doc.getElementById('devImpressionCopie');
  t('l\'impression passe par une iframe a part, elle aussi sans script', !!imp && imp.getAttribute('sandbox') === 'allow-same-origin allow-modals' && !X.doc.getElementById('devImpression'));
  X.clic('[data-dev="revenir"]'); X.copieAlteree = true; X.w.BdvDevis._S().copie = null;
  X.clic('[data-dev="apercu"]'); await attendre(30);
  t('une copie qui ne correspond plus a son empreinte : on le DIT, en souci',
    /Attention : la copie ne correspond plus à son empreinte\./.test(X.doc.getElementById('devCopieNote').textContent)
    && X.doc.getElementById('devCopieNote').classList.contains('dmod__copie--souci'), X.doc.getElementById('devCopieNote').textContent);
  X.clic('[data-dev="revenir"]'); X.copieAlteree = false; X.w.BdvDevis._S().copie = null; X.mode = 'copie-panne';
  X.clic('[data-dev="apercu"]'); await attendre(30);
  t('copie illisible (connexion) : le devis est refait, et on le dit', /La copie gardée n’a pas pu être lue \(connexion\)/.test(X.doc.getElementById('devCopieNote').textContent)
    && !X.doc.getElementById('devFeuille').hasAttribute('sandbox'));
}
{
  const X = await devisEnvoye({ lot52: true, fetch: 'ko' });
  t('feuilles illisibles : l\'envoi part SANS copie et passe quand meme', !('p_papier' in X.env) && X.devis[0].statut === 'envoye');
  t('... et l\'avis le dit, en souci', /La copie du devis n’a pas pu être gardée\./.test(X.avis()) && X.doc.getElementById('devAvis').classList.contains('aff-avis--souci'), X.avis());
  X.clic('[data-dev="apercu"]'); await attendre(30);
  t('l\'apercu d\'un devis parti sans copie le dit', /Pas de copie gardée pour ce devis/.test(X.doc.getElementById('devCopieNote').textContent)
    && !X.requetes.some(r => /^\/devis_copies\?/.test(r.chemin)));
}
{
  const X = await devisEnvoye({ lot52: true, fetch: 'script' });
  t('une feuille servie qui porterait une balise de script ou de style : pas de copie', !('p_papier' in X.env) && /La copie du devis n’a pas pu être gardée/.test(X.avis()), X.avis());
}
{
  const X = await devisEnvoye({ fetch: 'ok' });
  t('SANS le SQL du lot 52 : rien de plus ne part (PostgREST refuserait le parametre)', !('p_papier' in X.env) && !X.fetchs && X.devis[0].statut === 'envoye', JSON.stringify(Object.keys(X.env)));
  t('... et l\'avis ne parle pas de copie', !/copie/i.test(X.avis()), X.avis());
  X.clic('[data-dev="apercu"]'); await attendre(30);
  t('... ni l\'apercu', X.doc.getElementById('devCopieNote').hidden);
}
{
  const X = monter({ lot52: true, fetch: 'ok' });
  await X.ouvrir(); X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="apercu"]'); await attendre(30);
  t('un devis enregistre : apercu refait, sans note ni sandbox', X.doc.getElementById('devCopieNote').hidden && !X.doc.getElementById('devFeuille').hasAttribute('sandbox'));
}

titre('11. Lot 53 : la livraison');
const tous = (X, sel) => [].slice.call(X.modale().querySelectorAll(sel));
const radio = (X, v) => { const n = X.modale().querySelector('[data-dev-livmode][value="' + v + '"]'); n.checked = true; n.dispatchEvent(new X.w.Event('change', { bubbles: true })); };
{
  const X = monter({ lot53: true });
  await X.ouvrir(); X.cocher(CLE0);
  t('la section Livraison est la, trois facons, « a l\'adresse du client » cochee', !!X.doc.getElementById('devLiv')
    && tous(X, '[data-dev-livmode]').length === 3 && X.modale().querySelector('[data-dev-livmode]:checked').value === 'client');
  t('par defaut : pas de champ d\'adresse, mais date, transporteur et port', !X.doc.getElementById('devLivNom')
    && !!X.doc.getElementById('devLivDate') && !!X.doc.getElementById('devLivTransp') && !!X.doc.getElementById('devLivPort'));
  await X.enregistrer(); await attendre(20);
  const c0 = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer')[0].corps;
  t('un devis sans rien de livraison, neuf : p_livraison NE PART PAS (compatible avant le SQL)', !('p_livraison' in c0), JSON.stringify(Object.keys(c0)));
  X.taper(X.doc.getElementById('devLivPort'), '15');
  t('le port s\'ajoute au total, sous la remise : TTC = (vins + 15) x 1,2', /Frais de port HT/.test(X.doc.getElementById('devTotal').textContent)
    && X.doc.getElementById('devPiedTtc').textContent === C.euros(Math.round((Number(X.champ(CLE0, 'qte').value) * 850 + 1500) * 1.2)), X.doc.getElementById('devPiedTtc').textContent);
  t('la phrase Vitisoft du produit de transport apparait avec le port', /Produit pour transport/.test(X.doc.getElementById('devLiv').textContent));
  X.taper(X.doc.getElementById('devLivPort'), '12,345');
  t('un port illisible : le total dit « a corriger »', X.doc.getElementById('devPiedTtc').textContent === 'à corriger');
  await X.enregistrer(); await attendre(20);
  t('... et l\'enregistrement refuse, sur le champ du port', /frais de port/.test(X.avis()) && X.doc.getElementById('devLivPort').getAttribute('aria-invalid') === 'true', X.avis());
  X.taper(X.doc.getElementById('devLivPort'), '15');
  radio(X, 'adresse');
  t('« a une autre adresse » : les champs d\'adresse apparaissent, pays France', !!X.doc.getElementById('devLivNom') && X.doc.getElementById('devLivPays').value === 'France');
  t('le focus reste sur le bouton choisi', X.doc.activeElement && X.doc.activeElement.value === 'adresse');
  await X.enregistrer(); await attendre(20);
  t('adresse vide : refus sur le destinataire, rien n\'est parti', /destinataire/.test(X.avis()) && X.doc.getElementById('devLivNom').getAttribute('aria-invalid') === 'true'
    && X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').length === 1, X.avis());
  X.taper(X.doc.getElementById('devLivNom'), 'Restaurant Le Quai'); X.taper(X.doc.getElementById('devLivA1'), '3 quai de la Fosse');
  X.taper(X.doc.getElementById('devLivCp'), '44000'); X.taper(X.doc.getElementById('devLivVille'), 'Nantes');
  X.taper(X.doc.getElementById('devLivTransp'), 'Kuehne'); X.taper(X.doc.getElementById('devLivDate'), '2099-01-15');
  await X.enregistrer(); await attendre(20);
  const c1 = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').pop().corps;
  t('p_livraison part, complet, port en CENTIMES entiers', c1.p_livraison && c1.p_livraison.mode === 'adresse' && c1.p_livraison.port_c === 1500
    && c1.p_livraison.transporteur === 'Kuehne' && c1.p_livraison.souhaitee === '2099-01-15' && c1.p_livraison.adresse.ville === 'Nantes', JSON.stringify(c1.p_livraison));
  t('enregistre : l\'avis le dit', /enregistré/.test(X.avis()), X.avis());
  radio(X, 'retrait');
  t('retrait : ni adresse, ni transporteur, ni port a l\'ecran', !X.doc.getElementById('devLivNom') && !X.doc.getElementById('devLivTransp') && !X.doc.getElementById('devLivPort')
    && !/Frais de port/.test(X.doc.getElementById('devTotal').textContent));
  radio(X, 'adresse');
  t('S5 : passer par « Il vient chercher » puis revenir GARDE le port et le transporteur tapes', X.doc.getElementById('devLivPort') && /^15(,00)?$/.test(X.doc.getElementById('devLivPort').value)
    && X.doc.getElementById('devLivTransp').value === 'Kuehne', X.doc.getElementById('devLivPort') && X.doc.getElementById('devLivPort').value);
  radio(X, 'retrait');
  await X.enregistrer(); await attendre(20);
  const c2 = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').pop().corps;
  t('retrait : ni port ni transporteur ne partent', c2.p_livraison.mode === 'retrait' && !('port_c' in c2.p_livraison) && !('transporteur' in c2.p_livraison) && !c2.p_livraison.adresse, JSON.stringify(c2.p_livraison));
  radio(X, 'client'); X.taper(X.doc.getElementById('devLivDate'), '');
  const port = X.doc.getElementById('devLivPort'), aideP = port && X.doc.getElementById(String(port.getAttribute('aria-describedby') || '').split(' ')[0]);
  t('S16 : « Frais de port HT » porte son aide « 0 si aucun », liee au champ', /Frais de port HT/.test(port.closest('label').textContent) && !!aideP && /0 si aucun/.test(aideP.textContent));
  await X.enregistrer(); await attendre(20);
  const c3 = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').pop().corps;
  t('revenir a l\'adresse du client sur un devis du lot 53 : p_livraison part quand meme (sinon la base garderait l\'ancien)', c3.p_livraison && c3.p_livraison.mode === 'client', JSON.stringify(c3));
}
{
  const X = monter({ lot53: true });
  await X.ouvrir(); X.cocher(CLE0);
  X.taper(X.doc.getElementById('devLivDate'), '2001-01-01');
  await X.enregistrer(); await attendre(20);
  t('une date de livraison avant le devis est refusee sur son champ', /avant le devis/.test(X.avis()) && X.doc.getElementById('devLivDate').getAttribute('aria-invalid') === 'true', X.avis());
}
{
  const X = monter({});
  await X.ouvrir(); X.cocher(CLE0);
  X.taper(X.doc.getElementById('devLivPort'), '10');
  await X.enregistrer(); await attendre(20);
  t('SANS le SQL du lot 53 : la phrase dediee, et les lignes gardees', /livraison sur le devis n’est pas encore disponible/.test(X.avis()) && !X.devis.length, X.avis());
}
{
  const X = monter({ lot53: true, mode: 'liv-refus' });
  await X.ouvrir(); X.cocher(CLE0); X.taper(X.doc.getElementById('devLivPort'), '10');
  await X.enregistrer(); await attendre(20);
  t('un refus de la base sur la livraison se dit comme tel', /La livraison n’est pas complète/.test(X.avis()), X.avis());
}
{
  const X = monter({ lot53: true });
  await X.ouvrir(); X.cocher(CLE0); radio(X, 'adresse');
  X.taper(X.doc.getElementById('devLivNom'), 'Le Quai');
  const br = JSON.parse(X.w.localStorage.getItem('bdv_devis_brouillon_aC') || 'null');
  t('le brouillon garde la livraison', br && br.liv && br.liv.mode === 'adresse' && br.liv.nom === 'Le Quai', JSON.stringify(br && br.liv));
}
{
  const d = { numero: 'D-2026-0099', statut: 'envoye', date_devis: '2026-09-30', valable_jusqu: '2026-10-30', vendeur: FICHE, acheteur: { nom: 'Chez Paul' },
    remise_globale_cb: 0, total_vins_c: 6000, remise_globale_c: 0, port_c: 1500, total_ht_c: 7500, tva_c: 1500, total_ttc_c: 9000,
    livraison_mode: 'adresse', livraison: { nom: 'Le Quai', adresse1: '3 quai', code_postal: '44000', ville: 'Nantes', pays: 'France' },
    livraison_souhaitee: '2026-10-15', transporteur: 'Kuehne', paiement_mode: 'fdm', paiement_jours: 30 };
  const X = monter({});
  const h = X.w.BdvDevis.htmlPapier(d, [{ designation: 'Vin', quantite: 6, pu_ht_c: 1000, remise_cb: 0, net_c: 6000 }], { conditions: '' });
  t('papier : « Frais de port HT 15,00 » entre les vins et le total HT', /Total des vins HT[\s\S]*Frais de port HT<\/span><span>15,00\u00a0€[\s\S]*Total HT/.test(h));
  t('papier : la livraison en une phrase, sous le client', /dpap__liv[\s\S]*À livrer à Le Quai, 3 quai, 44000 Nantes, souhaitée le 15\/10\/2026, par Kuehne\./.test(h), (h.match(/dpap__liv[^]*?<\/section>/) || [''])[0]);
  const ancien = X.w.BdvDevis.htmlPapier(Object.assign({}, d, { livraison_mode: undefined, port_c: undefined }), [], { conditions: '' });
  t('papier d\'un devis d\'avant le lot : ni bloc livraison, ni ligne de port', !/dpap__liv/.test(ancien) && !/Frais de port/.test(ancien));
  const rien = X.w.BdvDevis.htmlPapier(Object.assign({}, d, { livraison_mode: 'client', livraison: null, transporteur: null, port_c: 0, livraison_souhaitee: null }), [], { conditions: '' });
  t('papier « a l\'adresse du client » sans rien d\'autre : AUCUN bloc (le papier d\'avant, a l\'octet pres)', !/dpap__liv/.test(rien) && rien === ancien.replace('', ''));
  const ret = X.w.BdvDevis.htmlPapier(Object.assign({}, d, { livraison_mode: 'retrait', livraison: null, transporteur: null, port_c: 0, livraison_souhaitee: null }), [], { conditions: '' });
  t('papier retrait : « Il vient chercher au domaine. »', /Il vient chercher au domaine\./.test(ret));
}

titre('12. Lot 54 : la TVA autre que 20 %');
t('calcul : a l\'export le port est a 0 % (taux du port), meme si le taux par defaut des lignes est 20 %',
  C.devis([{ pu_c: 1000, qte: 6, tva_cb: 0 }], 0, 2000, 1500, 0).tva === 0 && C.devis([{ pu_c: 1000, qte: 6 }], 0, 2000, 1500, 2000).tva === 1500);
t('calcul : en France le port rejoint la base 20 %, meme si toutes les lignes sont a 5,5 %',
  C.devis([{ pu_c: 1000, qte: 6, tva_cb: 550 }], 0, 2000, 1500, 2000).tva === C.mulDiv(6000, 550, 10000) + C.mulDiv(1500, 2000, 10000));
const regime = (X, v) => { const n = X.modale().querySelector('[data-dev-regime][value="' + v + '"]'); n.checked = true; n.dispatchEvent(new X.w.Event('change', { bubbles: true })); };
const choisir = (X, cle, v) => { const n = X.champ(cle, 'tva'); n.value = v; n.dispatchEvent(new X.w.Event('input', { bubbles: true })); };
{
  const X = monter({ lot53: true, lot54: true });
  await X.ouvrir(); X.cocher(CLE0); X.cocher(CLE1);
  t('section TVA : trois regimes, « En France » coche, un choix 20 % / 5,5 % par ligne', !!X.doc.getElementById('devTva')
    && tous(X, '[data-dev-regime]').length === 3 && X.modale().querySelector('[data-dev-regime]:checked').value === 'france'
    && !!X.champ(CLE0, 'tva') && X.champ(CLE0, 'tva').value === '2000');
  await X.enregistrer(); await attendre(20);
  const c0 = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer')[0].corps;
  t('devis neuf tout a 20 % : ni p_tva ni taux de ligne ne partent (compatible avant le SQL)', !('p_tva' in c0) && c0.p_lignes.every(l => !('tva_cb' in l)), JSON.stringify(c0.p_lignes[0]));
  const q0 = Number(X.champ(CLE0, 'qte').value), q1 = Number(X.champ(CLE1, 'qte').value);
  choisir(X, CLE1, '550');
  const b20 = q0 * 850, b55 = q1 * 950, attendu = b20 + b55 + C.mulDiv(b20, 2000, 10000) + C.mulDiv(b55, 550, 10000);
  t('une ligne a 5,5 % : deux lignes de TVA, et le TTC calcule par taux', /TVA 20 % sur/.test(X.doc.getElementById('devTotal').textContent)
    && /TVA 5,5 % sur/.test(X.doc.getElementById('devTotal').textContent) && X.doc.getElementById('devPiedTtc').textContent === C.euros(attendu), X.doc.getElementById('devTotal').textContent);
  await X.enregistrer(); await attendre(20);
  const c1 = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').pop().corps;
  t('le taux part par ligne, et p_tva aussi', c1.p_lignes.map(l => l.tva_cb).join(',') === '2000,550' && c1.p_tva && c1.p_tva.regime === 'france', JSON.stringify(c1.p_lignes.map(l => l.tva_cb)));
  regime(X, 'export');
  const radios = () => [...X.modale().querySelectorAll('#devTvaAccises [data-dev-accises]')];
  t('export : plus de choix de taux sur les lignes, avertissement accise', !X.champ(CLE0, 'tva') && /suspension de droits/.test(X.doc.getElementById('devTva').textContent));
  t('V9 : la question des accises est un Oui / Non SANS reponse par defaut', radios().length === 2 && radios().every(r => r.type === 'radio' && !r.checked)
    && radios().map(r => r.value).join(',') === 'oui,non', radios().map(r => r.value + ':' + r.checked).join(','));
  t('export : TVA 0, la mention 262 I, et tant qu\'on n\'a pas repondu le devis demande au lieu d\'ecrire « hors accises »', /TVA0,00/.test(X.doc.getElementById('devTotal').textContent.replace(/\s/g, ''))
    && /article 262 I du CGI/.test(X.doc.getElementById('devTotal').textContent) && /Dis plus haut si tes prix comprennent les droits d’accises/.test(X.doc.getElementById('devTotal').textContent)
    && !/hors droits d’accises/.test(X.doc.getElementById('devTotal').textContent)
    && X.doc.getElementById('devPiedTtc').textContent === C.euros(b20 + b55), X.doc.getElementById('devTotal').textContent);
  t('le focus reste sur le regime choisi', X.doc.activeElement && X.doc.activeElement.value === 'export');
  const nAv = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').length;
  await X.enregistrer(); await attendre(20);
  t('V9 : sans reponse sur les accises, l\'enregistrement est refuse avant de partir', /Dis si tes prix comprennent les droits d’accises/.test(X.avis())
    && X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').length === nAv, X.avis());
  const accise = (v) => { const r = X.modale().querySelector('#devTvaAccises [data-dev-accises][value="' + v + '"]'); r.checked = true; r.dispatchEvent(new X.w.Event('change', { bubbles: true })); };
  accise('non');
  t('« Non » : « hors droits d\'accises »', /hors droits d’accises/.test(X.doc.getElementById('devTotal').textContent));
  accise('oui');
  t('« Oui » : « droits d\'accises inclus »', /droits d’accises inclus/.test(X.doc.getElementById('devTotal').textContent));
  await X.enregistrer(); await attendre(20);
  const c2 = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').pop().corps;
  t('export : lignes a 0, p_tva export avec les accises', c2.p_lignes.every(l => l.tva_cb === 0) && c2.p_tva.regime === 'export' && c2.p_tva.accises_incluses === true && !('client_tva' in c2.p_tva), JSON.stringify(c2.p_tva));
  regime(X, 'ue');
  X.taper(X.doc.getElementById('devTvaClient'), 'FR12345678901');
  await X.enregistrer(); await attendre(20);
  t('UE avec un numero FR : refus sur le champ', /commence par FR/.test(X.avis()) && X.doc.getElementById('devTvaClient').getAttribute('aria-invalid') === 'true', X.avis());
  X.taper(X.doc.getElementById('devTvaClient'), 'de 123 456 789');
  await X.enregistrer(); await attendre(20);
  const c3 = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').pop().corps;
  t('UE : numero envoye, regime ue', c3.p_tva.regime === 'ue' && /^de 123 456 789$/.test(c3.p_tva.client_tva) && /enregistré/.test(X.avis()), JSON.stringify(c3.p_tva) + ' ' + X.avis());
  regime(X, 'france');
  t('retour en France : les lignes retrouvent leur taux choisi', X.champ(CLE1, 'tva') && X.champ(CLE1, 'tva').value === '550');
  choisir(X, CLE1, '2000');
  await X.enregistrer(); await attendre(20);
  const c4 = X.requetes.filter(r => r.chemin === '/rpc/devis_enregistrer').pop().corps;
  t('revenir en France tout a 20 % sur un devis du lot 54 : p_tva part quand meme (sinon la base le garderait en UE)', c4.p_tva && c4.p_tva.regime === 'france', JSON.stringify(c4.p_tva));
}
{
  const X = monter({ lot53: true, lot54: true, fiche: Object.assign({}, FICHE, { tva: null }) });
  await X.ouvrir(); X.cocher(CLE0); regime(X, 'ue');
  t('UE sans numero de TVA du domaine : on le dit, avec le lien vers Mon domaine', /numéro de TVA intracommunautaire manque/.test(X.doc.getElementById('devTva').textContent)
    && !!X.modale().querySelector('#devTva [data-dev="domaine"]'));
  X.taper(X.doc.getElementById('devTvaClient'), 'DE123456789');
  await X.enregistrer(); await attendre(20);
  t('... et l\'enregistrement est refuse avant de partir', /manque dans Mon domaine/.test(X.avis()) && !X.requetes.some(r => r.chemin === '/rpc/devis_enregistrer'), X.avis());
}
{
  const X = monter({ lot53: true });
  await X.ouvrir(); X.cocher(CLE0); choisir(X, CLE0, '550');
  await X.enregistrer(); await attendre(20);
  t('SANS le SQL du lot 54 : la phrase dediee, rien d\'enregistre', /TVA autre que 20 % n’est pas encore disponible/.test(X.avis()) && !X.devis.length, X.avis());
}
{
  const X = monter({});
  const base = { numero: 'D-2026-0098', statut: 'envoye', date_devis: '2026-09-30', valable_jusqu: '2026-10-30', vendeur: FICHE, acheteur: { nom: 'Weinhaus', pays: 'Allemagne' },
    remise_globale_cb: 0, total_vins_c: 9330, remise_globale_c: 0, port_c: 0, total_ht_c: 9330, paiement_mode: 'fdm', paiement_jours: 30 };
  const L = [{ designation: 'Vin', quantite: 6, pu_ht_c: 1000, remise_cb: 0, net_c: 6000, final_c: 6000, tva_cb: 2000 },
             { designation: 'Jus de raisin', quantite: 10, pu_ht_c: 333, remise_cb: 0, net_c: 3330, final_c: 3330, tva_cb: 550 }];
  const fr = X.w.BdvDevis.htmlPapier(Object.assign({}, base, { regime_tva: 'france', tva_cb: 2000, accises_incluses: true, tva_c: 1383, total_ttc_c: 10713 }), L, { conditions: '' });
  t('papier mixte : colonne TVA, et deux lignes « TVA 20 % sur » / « TVA 5,5 % sur »', /<th class="dpap__n">TVA<\/th>/.test(fr) && /TVA 20 % sur 60,00/.test(fr) && /TVA 5,5 % sur 33,30/.test(fr) && /droits d’accises inclus/.test(fr), fr.match(/dpap__totaux[^]*?<\/section>/)[0]);
  const ue = X.w.BdvDevis.htmlPapier(Object.assign({}, base, { regime_tva: 'ue', client_tva: 'DE123456789', tva_cb: 0, accises_incluses: false, tva_c: 0, total_ttc_c: 9330 }),
    L.map(l => Object.assign({}, l, { tva_cb: 0 })), { conditions: '' });
  t('papier UE : les DEUX numeros, la mention 262 ter-I mot pour mot, TVA 0, hors accises', /N° de TVA intracommunautaire FR32123456789/.test(ue) && /N° de TVA intracommunautaire DE123456789/.test(ue)
    && /Exonération TVA, art\. 262 ter-I du code général des impôts\./.test(ue) && /<span>TVA<\/span><span>0,00/.test(ue) && /hors droits d’accises/.test(ue) && !/<th class="dpap__n">TVA/.test(ue));
  const ex = X.w.BdvDevis.htmlPapier(Object.assign({}, base, { regime_tva: 'export', tva_cb: 0, accises_incluses: true, tva_c: 0, total_ttc_c: 9330 }), L.map(l => Object.assign({}, l, { tva_cb: 0 })), { conditions: '' });
  t('papier export : mention 262 I, accises incluses si coche', /Exonération de TVA, article 262 I du CGI\./.test(ex) && /droits d’accises inclus/.test(ex));
  const ancien = X.w.BdvDevis.htmlPapier(Object.assign({}, base, { tva_c: 1866, total_ttc_c: 11196 }), L.map(l => { const y = Object.assign({}, l); delete y.tva_cb; return y; }), { conditions: '' });
  t('papier d\'un devis d\'avant le lot : « TVA 20 % » seule, comme avant', /<p><span>TVA 20 %<\/span><span>18,66/.test(ancien) && !/TVA 5,5/.test(ancien) && !/<th class="dpap__n">TVA/.test(ancien));
}

titre('13. Lot 55 : la signature en ligne, cote bureau');
{
  const X = monter({ lot52: true, lot55: true, fetch: 'ok' });
  await X.ouvrir();
  X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="envoyer"]');
  const cL = X.doc.getElementById('devEnvoiLien');
  t('a l\'envoi, la case « Avec un lien de signature en ligne » est cochee, et dit « professionnels »',
    !!cL && cL.checked && /Avec un lien de signature en ligne/.test(cL.closest('label').textContent) && /professionnels/.test(cL.closest('label').textContent));
  X.doc.getElementById('devEnvoiRappel').checked = false;
  X.clic('[data-dev="confirmerEnvoi"]'); await attendre(30);
  const env = X.requetes.findIndex(r => r.chemin === '/rpc/devis_envoyer'), lien = X.requetes.findIndex(r => r.chemin === '/rpc/devis_lien_creer');
  t('le lien se cree APRES l\'envoi (la copie d\'abord), pour CE bureau et CE devis', env >= 0 && lien > env
    && X.requetes[lien].corps.p_bureau === BUREAU && X.requetes[lien].corps.p_devis === X.devis[0].devis_id);
  const u = X.doc.getElementById('devLienUrl');
  t('le lien s\'affiche : /signer/# suivi du jeton de 64 caracteres', !!u && /^https:\/\/lebureauduvigneron\.fr\/signer\/#[0-9a-f]{64}$/.test(u.value), u && u.value);
  t('et l\'ecran dit qu\'il ne s\'affiche qu\'une fois, et sert a une seule signature', /ne s’affiche qu’une fois/.test(X.corps().textContent) && /une seule signature/.test(X.corps().textContent));
  t('l\'avis garde la phrase de l\'envoi et annonce le lien', /noté envoyé/.test(X.avis()) && /copie exacte est gardée/.test(X.avis()) && /message est prêt juste en dessous/.test(X.avis()), X.avis());
  let copie = '';
  X.w.navigator.clipboard = { writeText: async (t2) => { copie = t2; } };
  X.clic('[data-dev="messageCopier"]'); await attendre(5);
  t('le message a coller vouvoie le client, porte le numero et le lien, sans tiret cadratin',
    /Vous pouvez le signer en ligne/.test(copie) && copie.indexOf(u.value) > 0 && /D-2026-0001/.test(copie) && !/\u2014/.test(copie), copie);
  t('« Copier » dit ce qu\'il a fait', /Message copié/.test(X.doc.getElementById('devLienMot').textContent));
  X.clic('[data-dev="accepter"]'); X.clic('[data-dev="confirmerAccord"]'); await attendre(30);
  X.clic('[data-dev="annulerAccord"]'); X.clic('[data-dev="confirmerAnnul"]'); await attendre(30);
  t('une acceptation annulee eteint le lien : il ne s\'affiche plus, on propose d\'en creer un', X.devis[0].statut === 'envoye'
    && !X.doc.getElementById('devLienUrl') && !!X.modale().querySelector('[data-dev="lienCreer"]'), X.avis());
}
{
  const X = monter({ lot52: true, lot55: true, fetch: 'ok' });
  await X.ouvrir();
  X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="envoyer"]');
  X.doc.getElementById('devEnvoiLien').checked = false;
  X.clic('[data-dev="confirmerEnvoi"]'); await attendre(30);
  t('case decochee : aucun lien cree, et le devis propose « Créer un lien de signature »', !X.requetes.some(r => r.chemin === '/rpc/devis_lien_creer')
    && !!X.modale().querySelector('[data-dev="lienCreer"]'));
}
{
  const X = monter({ lot52: true, fetch: 'ok' });
  await X.ouvrir();
  X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="envoyer"]');
  X.clic('[data-dev="confirmerEnvoi"]'); await attendre(30);
  t('SANS le SQL du lot 55 : le devis est envoye, l\'avis garde la copie ET dit que la signature n\'est pas disponible',
    X.devis[0].statut === 'envoye' && /copie exacte est gardée/.test(X.avis()) && /signature en ligne n’est pas encore disponible/.test(X.avis()), X.avis());
}
{
  const X = monter({ lot52: true, lot55: true, fetch: 'ko' });
  await X.ouvrir();
  X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="envoyer"]');
  X.clic('[data-dev="confirmerEnvoi"]'); await attendre(30);
  t('copie ratee : pas de lien demande, et l\'avis le dit', !X.requetes.some(r => r.chemin === '/rpc/devis_lien_creer') && /pas de lien de signature/.test(X.avis()), X.avis());
}
{
  const dv = { devis_id: 'dvE', affaire_id: 'aC', numero: 'D-2026-0077', statut: 'envoye', date_devis: '2026-09-30', valable_jusqu: '2099-10-30', envoye_le: '2026-09-30',
    papier_empreinte: 'b'.repeat(64), papier_le: '2026-09-30T09:00:00+00:00', commande_telechargements: 0, vendeur: FICHE, acheteur: { nom: 'Chez Paul', num_client: 'C7' },
    remise_globale_cb: 0, total_vins_c: 1000, remise_globale_c: 0, total_ht_c: 1000, tva_cb: 2000, tva_c: 200, total_ttc_c: 1200 };
  const X = monter({ lot52: true, lot55: true, lienExistant: true });
  X.devis.push(dv); X.lignes.dvE = [{ rang: 1, num_produit: 'P1', designation: 'Vin', quantite: 1, pu_ht_c: 1000, remise_cb: 0, net_c: 1000, final_c: 1000 }];
  await X.ouvrir({ devis: Object.assign({}, dv) }); await attendre(20);
  t('un devis envoye qui a deja un lien : la date, « il ne se réaffiche pas », et « Créer un nouveau lien »',
    /Un lien de signature a été créé le 01\/10\/2026/.test(X.corps().textContent) && /ne se réaffiche pas/.test(X.corps().textContent)
    && /Créer un nouveau lien/.test(X.modale().querySelector('[data-dev="lienCreer"]').textContent) && !X.doc.getElementById('devLienUrl'));
  t('la lecture du lien nomme le bureau et ne demande pas l\'empreinte du jeton', X.requetes.some(r => /^\/devis_liens\?bureau=eq\./.test(r.chemin) && /remplace_le=is\.null/.test(r.chemin) && !/jeton/.test(r.chemin)));
}
{
  const dv = { devis_id: 'dvS', affaire_id: 'aC', numero: 'D-2026-0078', statut: 'accepte', date_devis: '2026-09-30', valable_jusqu: '2099-10-30', envoye_le: '2026-09-30',
    accepte_le: '2026-10-01T12:05:00+00:00', signe_le: '2026-10-01T12:05:00+00:00', papier_empreinte: 'c'.repeat(64), commande_telechargements: 0,
    vendeur: FICHE, acheteur: { nom: 'Chez Paul', num_client: 'C7' }, remise_globale_cb: 0, total_vins_c: 1000, remise_globale_c: 0, total_ht_c: 1000, tva_cb: 2000, tva_c: 200, total_ttc_c: 1200 };
  const X = monter({ lot52: true, lot55: true, preuve: { nom: 'Jean Dupont', qualite: 'Gérant', au_nom_de: 'Chez Paul', papier_empreinte: 'c'.repeat(64), ip: '203.0.113.7', agent: 'Mozilla/5.0' } });
  X.devis.push(dv); X.lignes.dvS = [{ rang: 1, num_produit: 'P1', designation: 'Vin', quantite: 1, pu_ht_c: 1000, remise_cb: 0, net_c: 1000, final_c: 1000 }];
  await X.ouvrir({ devis: Object.assign({}, dv), affaire: { affaire_id: 'aC', issue: 'gagnee' } }); await attendre(20);
  t('un devis signe en ligne : « signé » dans le titre', /signé/.test(X.doc.getElementById('devTitre').textContent), X.doc.getElementById('devTitre').textContent);
  t('la preuve : qui, en quelle qualite, au nom de qui, l\'empreinte identique, l\'IP nommee comme un indice',
    /Signé en ligne le 01\/10\/2026/.test(X.corps().textContent) && /Jean Dupont \(Gérant\), au nom de Chez Paul/.test(X.corps().textContent)
    && /la même que la copie gardée/.test(X.corps().textContent) && /203\.0\.113\.7 \(un indice, pas une identité\)/.test(X.corps().textContent));
  X.clic('[data-dev="annulerAccord"]');
  t('annuler l\'accord d\'un devis signe dit que la preuve reste et que le lien s\'eteint', /preuve reste gardée/.test(X.doc.getElementById('devAnnul').textContent));
}

titre('14. Les corrections du juge, 01/10/2026');
{
  const X = monter({ lot53: true, lot54: true });
  await X.ouvrir();
  const vins = X.corps().querySelector('#devLignes').closest('section');
  const ch = vins.querySelector('.dmod__cherche'), li = vins.querySelector('#devLignes');
  t('V15 : « Chercher un vin » est EN TETE du bloc, avant la liste du devis', !!ch && !!li && (ch.compareDocumentPosition(li) & 4) !== 0);
  X.cocher(CLE0);
  const ligne = X.modale().querySelector('.dmod__ligne[data-cle="' + CLE0 + '"]');
  const plus = ligne.querySelector('[data-dev="plus"]');
  t('V15 : remise et TVA sont dans le pli, ferme par defaut', !!plus && plus.getAttribute('aria-expanded') === 'false'
    && !!X.champ(CLE0, 'remise').closest('.dmod__repli') && !!X.champ(CLE0, 'tva').closest('.dmod__repli') && !ligne.classList.contains('dmod__ligne--plus'));
  t('V15 : la feuille ne replie qu\'en boite etroite, et seulement un pli ferme', /@container devis \(max-width:35\.9375rem\)\{[^@]*?\.dmod__ligne:not\(\.dmod__ligne--plus\) \.dmod__repli\{ display:none; \}/.test(lire('src/css/bdv-devis.css')));
  t('V4 : une ligne d\'en-tete de colonnes, cachee a la synthese vocale, et le tableau au-dessus de 50 rem', !!X.modale().querySelector('.dmod__lentete[aria-hidden="true"]')
    && /@container devis \(min-width:50rem\)/.test(lire('src/css/bdv-devis.css')));
  plus.click();
  t('V15 : « Remise ou autre TVA » ouvre le pli en place, et le dit', plus.isConnected && plus.getAttribute('aria-expanded') === 'true' && ligne.classList.contains('dmod__ligne--plus'));
  const nb = () => [...X.modale().querySelectorAll('.btn--bordeaux')].filter(n => !n.closest('[hidden]')).length;
  t('V8/LOT 66 : devis neuf, etape 1, UN seul bouton plein, « Suivant : les conditions »', nb() === 1 && X.modale().querySelector('[data-dev="suivant"]').classList.contains('btn--bordeaux')
    && X.modale().querySelector('[data-dev="suivant"]').textContent === 'Suivant : les conditions');
  X.clic('[data-dev="suivant"]'); X.clic('[data-dev="suivant"]');
  t('V8/LOT 66 : a l\'etape Verifier, UN seul bouton plein, « Enregistrer le devis »', nb() === 1 && X.modale().querySelector('[data-dev="enregistrer"]').classList.contains('btn--bordeaux')
    && X.modale().querySelector('[data-dev="suivant"]').hidden);
  await X.enregistrer(); await attendre(20);
  t('V8 : enregistre et pas modifie, le bouton plein passe a « Préparer l’envoi »', nb() === 1 && X.modale().querySelector('[data-dev="envoyer"]').classList.contains('btn--bordeaux')
    && !X.modale().querySelector('[data-dev="enregistrer"]').classList.contains('btn--bordeaux'));
  t('V1 : deux temps nommes, « Préparer l’envoi » puis « Figer le devis et ... », et trois etapes dites', /Préparer l’envoi/.test(X.modale().querySelector('[data-dev="envoyer"]').textContent)
    && /^Figer le devis et /.test(X.modale().querySelector('[data-dev="confirmerEnvoi"]').textContent) && X.modale().querySelectorAll('#devEnvT ~ ol.dmod__etapes > li').length === 3);
  const ordre = ['[data-dev="apercu"]', '#devEnvT', '#devCmdT', '[data-dev="abandonner"]'].map(q => X.corps().querySelector(q));
  t('V12 : l\'ordre du bas est Voir et imprimer, Envoyer, Le client a repondu, Abandonner', ordre.every(Boolean)
    && ordre.every((n, i) => i === 0 || (ordre[i - 1].compareDocumentPosition(n) & 4) !== 0));
  X.taper(X.champ(CLE0, 'qte'), '30');
  t('V8 : un changement pas enregistre se dit a cote de l\'envoi, et le bouton plein revient a « Enregistrer »', nb() === 1
    && X.modale().querySelector('[data-dev="enregistrer"]').classList.contains('btn--bordeaux') && !X.doc.getElementById('devEnvoiNote').hidden
    && /Modifié, pas encore enregistré/.test(X.doc.getElementById('devPiedMot').textContent));
  await X.enregistrer(); await attendre(20);
  X.clic('[data-dev="envoyer"]');
  t('V8 : une question ouverte plus haut met le pied en retrait, et le dit', !X.modale().querySelector('[data-dev="enregistrer"]').classList.contains('btn--bordeaux')
    && /Termine d’abord la question ouverte/.test(X.doc.getElementById('devPiedMot').textContent) && nb() === 1);
  X.clic('[data-dev="pasEnvoye"]');
  /* LE CLAVIER RESTE DANS LA BOITE (V4) */
  const box = X.modale().querySelector('.tmod__boite');
  const arr = [...box.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(n => !n.disabled && !n.closest('[hidden]'));
  arr[arr.length - 1].focus();
  X.modale().dispatchEvent(new X.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  t('V4 : Tab depuis le dernier arret revient au premier (la modale retient le clavier)', X.doc.activeElement === arr[0], X.doc.activeElement && X.doc.activeElement.outerHTML.slice(0, 80));
  X.modale().dispatchEvent(new X.w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  t('V4 : Maj+Tab depuis le premier va au dernier', X.doc.activeElement === arr[arr.length - 1]);
  X.clic('[data-dev="apercu"]'); await attendre(20);
  t('V18 : dans l\'apercu, un seul retour, « Revenir au devis » (« Retour à l’affaire » est cache)', X.doc.getElementById('devRetourL').hidden === true
    && !!X.modale().querySelector('[data-dev="revenir"]'));
  X.clic('[data-dev="revenir"]');
  t('V18 : revenu au devis, « Retour à l’affaire » reparait', X.doc.getElementById('devRetourL').hidden === false);
}
{
  /* D2 : une affaire GAGNEE a la main ne propose pas la signature en ligne (la base refuserait). */
  const dv = { devis_id: 'dvG', affaire_id: 'aC', numero: 'D-2026-0079', statut: 'envoye', date_devis: '2026-09-30', valable_jusqu: '2099-10-30', envoye_le: '2026-09-30',
    papier_empreinte: 'd'.repeat(64), papier_le: '2026-09-30T09:00:00+00:00', commande_telechargements: 0, vendeur: FICHE, acheteur: { nom: 'Chez Paul', num_client: 'C7' },
    remise_globale_cb: 0, total_vins_c: 1000, remise_globale_c: 0, total_ht_c: 1000, tva_cb: 2000, tva_c: 200, total_ttc_c: 1200 };
  for (const issue of ['gagnee', 'en_cours']) {
    const X = monter({ lot52: true, lot55: true });
    X.devis.push(Object.assign({}, dv)); X.lignes.dvG = [{ rang: 1, num_produit: 'P1', designation: 'Vin', quantite: 1, pu_ht_c: 1000, remise_cb: 0, net_c: 1000, final_c: 1000 }];
    await X.ouvrir({ devis: Object.assign({}, dv), affaire: { affaire_id: 'aC', issue } }); await attendre(20);
    if (issue === 'gagnee') t('D2 : affaire gagnee, aucun bloc ni bouton de signature en ligne', !X.doc.getElementById('devSigT') && !X.modale().querySelector('[data-dev="lienCreer"]'));
    else t('D2 (temoin) : affaire en cours, la signature en ligne est proposee', !!X.doc.getElementById('devSigT') && !!X.modale().querySelector('[data-dev="lienCreer"]'));
  }
}
{
  /* X7 (tour 3) : la question « Il a dit non » ouverte, UN seul geste actif. */
  const dv = { devis_id: 'dvR', affaire_id: 'aC', numero: 'D-2026-0081', statut: 'envoye', date_devis: '2026-09-30', valable_jusqu: '2099-10-30', envoye_le: '2026-09-30',
    papier_empreinte: 'd'.repeat(64), papier_le: '2026-09-30T09:00:00+00:00', commande_telechargements: 0, vendeur: FICHE, acheteur: { nom: 'Chez Paul', num_client: 'C7' },
    remise_globale_cb: 0, total_vins_c: 1000, remise_globale_c: 0, total_ht_c: 1000, tva_cb: 2000, tva_c: 200, total_ttc_c: 1200 };
  const X = monter({ lot52: true, lot55: true });
  X.devis.push(Object.assign({}, dv)); X.lignes.dvR = [{ rang: 1, num_produit: 'P1', designation: 'Vin', quantite: 1, pu_ht_c: 1000, remise_cb: 0, net_c: 1000, final_c: 1000 }];
  await X.ouvrir({ devis: Object.assign({}, dv), affaire: { affaire_id: 'aC', issue: 'en_cours' }, autresEnCours: 0 }); await attendre(20);
  const m = X.modale(), g = q => m.querySelector('[data-dev="' + q + '"]');
  const autres = ['accepter', 'lienCreer', 'refaire'];
  t('X7 (temoin) : les trois gestes existent sur un devis envoye d\'une affaire ouverte, actifs', autres.every(q => g(q) && !g(q).hasAttribute('aria-disabled')), autres.map(q => !!g(q)).join(','));
  X.clic('[data-dev="refuser"]');
  t('X7 : pendant « Il a dit non », « Oui, il accepte », « Créer un lien » et « Refaire » passent en retrait et disent pourquoi',
    autres.every(q => g(q).getAttribute('aria-disabled') === 'true' && g(q).getAttribute('aria-describedby') === 'devRefusAttente')
    && /attendent ta réponse\u00a0: «\u00a0Oui, il a dit non\u00a0» ou «\u00a0Pas encore\u00a0»\./.test(X.doc.getElementById('devRefusAttente').textContent), autres.map(q => g(q).getAttribute('aria-disabled')).join(','));
  const nL = X.requetes.filter(r => /lien/.test(r.chemin)).length;
  X.clic('[data-dev="accepter"]'); X.clic('[data-dev="lienCreer"]'); X.clic('[data-dev="refaire"]'); await attendre(10);
  t('X7 : un appui dessus ne fait rien d\'autre que ramener a la question (focus sur « Oui, il a dit non »)',
    (X.doc.getElementById('devAccord') ? X.doc.getElementById('devAccord').hidden : true)
    && !/Nouveau devis/.test(X.avis()) && X.requetes.filter(r => /lien/.test(r.chemin)).length === nL && !g('enregistrer'));
  t('X7 : ... le focus est sur « Oui, il a dit non »', X.doc.activeElement === g('confirmerRefus'));
  t('X7 : le guillemet fermant de « Pas pour cette fois » ne part jamais seul a la ligne', /cette\u00a0fois\u00a0»/.test(X.doc.getElementById('devRefus').textContent));
  t('X7 : le retrait se VOIT hors du bloc de reponse aussi (trait tirete, appui garde)',
    /\.bdv-coque \.dmod \.btn\[aria-describedby="devRefusAttente"\]\[aria-disabled="true"\]\{[^}]*pointer-events:auto;[^}]*dashed/.test(lire('src/css/bdv-devis.css').replace(/\/\*[\s\S]*?\*\//g, '')));
  X.clic('[data-dev="pasRefus"]');
  t('X7 : « Pas encore » rend les trois gestes', autres.every(q => !g(q).hasAttribute('aria-disabled') && !g(q).hasAttribute('aria-describedby')));
}
{
  /* S12 : la lecture d'une ligne ne se coupe pas entre le nombre et son unite. */
  const X = monter({});
  await X.ouvrir(); X.cocher(CLE0); X.cocher(CLE1); X.taper(X.champ(CLE1, 'remise'), '10');
  await X.enregistrer(); await attendre(10);
  X.clic('[data-dev="abandonner"]'); X.clic('[data-dev="confirmerAbandon"]'); await attendre(10);
  const txt = X.corps().textContent;
  t('S12 : « 24 x 8,50 € HT » et « remise 10 % », espaces insecables', /\d+ x /.test(txt) && /€ HT/.test(txt) && /remise 10 %/.test(txt), txt.slice(0, 220));
  const pap = X.w.BdvDevis.htmlPapier({ numero: 'D-2026-0001', statut: 'enregistre', date_devis: '2026-09-30', valable_jusqu: '2026-10-30', vendeur: FICHE, acheteur: { nom: 'X' },
    remise_globale_cb: 0, total_vins_c: 1000, remise_globale_c: 0, total_ht_c: 1000, tva_cb: 2000, tva_c: 200, total_ttc_c: 1200 }, [], { conditions: '' });
  t('S12 (garde) : le papier garde « TVA 20 % » a l\'octet pres (espace ordinaire)', /<span>TVA 20 %<\/span>/.test(pap));
}
t('D1 : sur le papier, un nom de vin ou une raison sociale sans espace se coupe au lieu de deborder',
  /\.dpap \.dpap__vin\{[^}]*overflow-wrap:anywhere/.test(lire('src/css/bdv-devis-papier.css')) && /\.dpap \.dpap__raison\{[^}]*overflow-wrap:anywhere/.test(lire('src/css/bdv-devis-papier.css')));
t('S6 : le libelle d\'une case prend la place qui reste et se replie, au lieu de pousser la case',
  /\.bdv-coque \.dmod__coche > span:not\(\[class\]\)\{ flex:1 1 0; min-width:0; \}/.test(lire('src/css/bdv-devis.css')));

titre('15. Tour 2 du juge (02/10/2026) : l\'envoi dit ce qu\'il note, le lien sous le doigt, les retraits');
{
  const MC = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const court = (d) => (d.getDate() === 1 ? '1er' : String(d.getDate())) + ' ' + MC[d.getMonth()];
  const auj = new Date(), dans7 = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() + 7), hier = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() - 1);
  const X = monter({ lot52: true, lot55: true, fetch: 'ok' });
  await X.ouvrir();
  X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="envoyer"]');
  const ph = () => X.doc.getElementById('devEnvoiPhrase').textContent;
  const bt = () => X.modale().querySelector('[data-dev="confirmerEnvoi"]').textContent;
  const jourC = X.doc.getElementById('devEnvoiJour');
  t('V1 : la date s\'appelle « Envoyé le », aide « Aujourd’hui par défaut. ... Change la date. », plus de « Déjà parti ? »',
    /^Envoyé le$/.test(jourC.closest('label').querySelector('span').textContent) && /^Aujourd’hui par défaut\. Tu l’as déjà envoyé un autre jour \? Change la date\.$/.test(X.doc.getElementById('devEnvoiJourAide').textContent)
    && !/Déjà parti/.test(X.modale().textContent));
  const attendue = 'Le bureau le note envoyé aujourd’hui, ' + court(auj) + ', et te rappelle de le relancer le ' + court(dans7) + (/\.$/.test(MC[dans7.getMonth()]) ? '' : '.') + ' Envoie ton mail juste après.';
  t('V1 : juste au-dessus du bouton, LA phrase avec les dates calculees (aujourd\'hui et la relance)', ph() === attendue
    && X.doc.getElementById('devEnvoiPhrase').nextElementSibling.querySelector('[data-dev="confirmerEnvoi"]') !== null, ph());
  t('V1 : avec la case du lien cochee, le bouton dit « Figer le devis et créer le lien »', bt() === 'Figer le devis et créer le lien', bt());
  const cL = X.doc.getElementById('devEnvoiLien');
  cL.checked = false; cL.dispatchEvent(new X.w.Event('change', { bubbles: true }));
  t('V1 : sans lien, le bouton s\'adapte : « Figer le devis et le noter envoyé »', bt() === 'Figer le devis et le noter envoyé', bt());
  cL.checked = true; cL.dispatchEvent(new X.w.Event('change', { bubbles: true }));
  const cR = X.doc.getElementById('devEnvoiRappel');
  cR.checked = false; cR.dispatchEvent(new X.w.Event('change', { bubbles: true }));
  t('V1 : sans rappel, la phrase ne promet pas de relance', !/relancer/.test(ph()) && /^Le bureau le note envoyé aujourd’hui, /.test(ph()), ph());
  cR.checked = true; cR.dispatchEvent(new X.w.Event('change', { bubbles: true }));
  jourC.value = iso(hier); jourC.dispatchEvent(new X.w.Event('change', { bubbles: true }));
  t('V1 : envoye hier, la phrase dit « le <date> » et ne demande plus d\'envoyer le mail', /^Le bureau le note envoyé le /.test(ph()) && ph().indexOf(court(hier)) > 0 && !/Envoie ton mail/.test(ph()), ph());
  jourC.value = iso(auj); jourC.dispatchEvent(new X.w.Event('change', { bubbles: true }));
  /* W11 : la preparation ouverte, la reponse du client est en retrait et dit pourquoi */
  const oui = X.modale().querySelector('.dmod__commande [data-dev="accepter"]'), non = X.modale().querySelector('.dmod__commande [data-dev="refuser"]');
  t('W11 : envoi ouvert, « Oui, il accepte » et « Non, il refuse » en retrait (aria-disabled), et le mot qui dit pourquoi est visible',
    oui.getAttribute('aria-disabled') === 'true' && non.getAttribute('aria-disabled') === 'true' && !X.doc.getElementById('devCmdAttente').hidden
    && oui.getAttribute('aria-describedby') === 'devCmdAttente' && /Termine d’abord l’envoi/.test(X.doc.getElementById('devCmdAttente').textContent));
  X.clic('.dmod__commande [data-dev="accepter"]'); X.clic('.dmod__commande [data-dev="refuser"]');
  t('W11 : un appui pendant l\'envoi n\'ouvre ni l\'accord ni le refus', X.doc.getElementById('devAccord').hidden && X.doc.getElementById('devRefus').hidden);
  t('W11 : la feuille les dessine en retrait sans les rendre inertes au doigt (pointer-events rendus)',
    /\.bdv-coque \.dmod__commande \.btn\[aria-disabled="true"\][^{]*\{[^}]*pointer-events:auto[^}]*border:1px dashed/.test(lire('src/css/bdv-devis.css')));
  const avant = X.requetes.length;
  X.clic('[data-dev="confirmerEnvoi"]'); await attendre(40);
  const rq = X.requetes.slice(avant).map(r => r.chemin).filter(c => /^\/rpc\//.test(c));
  t('ordre des appels inchange : devis_envoyer puis devis_lien_creer', rq.indexOf('/rpc/devis_envoyer') >= 0 && rq.indexOf('/rpc/devis_lien_creer') > rq.indexOf('/rpc/devis_envoyer'), rq.join());
  const env = X.requetes.filter(r => r.chemin === '/rpc/devis_envoyer').pop();
  t('V1 : la relance notee aujourd\'hui porte « Relancer le devis D-... (vérifie qu’il est bien parti) », moins de 80 signes',
    env.corps.p_rappel === iso(dans7) && env.corps.p_rappel_titre === 'Relancer le devis ' + X.devis[0].numero + ' (vérifie qu’il est bien parti)' && env.corps.p_rappel_titre.length < 80, env.corps.p_rappel_titre);
  const corps = X.corps(), bloc = X.doc.getElementById('devLienBloc');
  t('N2 : le lien cree est le PREMIER bloc de la boite, avant « Pour qui »', !!bloc && corps.firstElementChild === bloc
    && (bloc.compareDocumentPosition(X.doc.getElementById('devQuiT')) & 4) !== 0);
  t('N2 : dans ce bloc, « Copier le message avec le lien » vient avant le lien, et le focus est sur lui',
    !!bloc.querySelector('[data-dev="messageCopier"]') && (bloc.querySelector('[data-dev="messageCopier"]').compareDocumentPosition(X.doc.getElementById('devLienUrl')) & 4) !== 0
    && X.doc.activeElement === bloc.querySelector('[data-dev="messageCopier"]'));
  t('N2 : un seul champ de lien dans toute la boite (le bloc du bas ne le redit pas)', X.modale().querySelectorAll('#devLienUrl').length === 1
    && /en tête du devis/.test(X.doc.getElementById('devSigT').closest('section').textContent));
  t('V1 : apres le clic, « Pas parti aujourd’hui ? Décale la relance dans l’affaire » mene a l\'affaire',
    /Pas parti aujourd’hui \?/.test(bloc.textContent) && /Décale la relance dans l’affaire/.test(bloc.textContent) && !!bloc.querySelector('[data-dev="retour"]')
    && bloc.textContent.indexOf(court(dans7)) > 0, bloc.textContent.slice(0, 400));
  t('N2 : le bloc nomme le client a qui coller le message', /Colle-le dans ton mail à Chez Paul/.test(bloc.textContent));
}
{
  /* L'envoi note un AUTRE jour : le titre de relance par defaut (celui de la base) suffit. */
  const X = monter({ lot52: true, lot55: true, fetch: 'ok' });
  await X.ouvrir(); X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="envoyer"]');
  const j = X.doc.getElementById('devEnvoiJour'); const h = new Date(); h.setDate(h.getDate() - 1);
  j.value = h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
  X.clic('[data-dev="confirmerEnvoi"]'); await attendre(40);
  const env = X.requetes.filter(r => r.chemin === '/rpc/devis_envoyer').pop();
  t('V1 : note envoye hier, pas de « vérifie qu’il est bien parti » (titre par defaut de la base)', env && env.corps.p_rappel_titre === null, env && env.corps.p_rappel_titre);
}
{
  /* N6 : le refus des accises sous les DEUX choix, pas entre la pastille et son texte. */
  const X = monter({ lot52: true, lot53: true, lot54: true });
  await X.ouvrir(); X.cocher(CLE0);
  const r = X.modale().querySelector('[data-dev-regime][value="export"]'); r.checked = true; r.dispatchEvent(new X.w.Event('change', { bubbles: true }));
  X.clic('[data-dev="enregistrer"]'); await attendre(10);
  const fs = X.doc.getElementById('devTvaAccises'), err = fs && fs.querySelector('.dmod__err');
  const radios = fs ? [...fs.querySelectorAll('input[data-dev-accises]')] : [];
  t('N6 : le message est le DERNIER enfant du groupe, apres les deux choix, hors de tout libelle', !!err && fs.lastElementChild === err && !err.closest('label')
    && radios.length === 2 && radios.every(x => (x.closest('label').compareDocumentPosition(err) & 4) !== 0));
  t('N6 : le groupe est marque invalide et les deux choix portent le message en description', fs.getAttribute('aria-invalid') === 'true'
    && radios.every(x => (x.getAttribute('aria-describedby') || '').split(' ').indexOf(err.id) >= 0));
  radios[0].checked = true; radios[0].dispatchEvent(new X.w.Event('change', { bubbles: true }));
  t('N6 : une reponse efface le message et les descriptions', !fs.querySelector('.dmod__err') && !fs.hasAttribute('aria-invalid') && radios.every(x => !/devErr/.test(x.getAttribute('aria-describedby') || '')));
}
{
  /* W10, V4, V15 et le clavier du code postal */
  const X = monter({ lot52: true, lot53: true, lot54: true });
  await X.ouvrir(); X.cocher(CLE0);
  const li = X.modale().querySelector('.dmod__ligne[data-cle="' + CLE0 + '"]');
  const plus = li.querySelector('[data-dev="plus"]'), prix = X.champ(CLE0, 'prix'), qte = X.champ(CLE0, 'qte');
  t('W10 : « Remise ou autre TVA » vient APRES la quantite et le prix, dans la rangee du total de la ligne',
    (qte.compareDocumentPosition(plus) & 4) !== 0 && (prix.compareDocumentPosition(plus) & 4) !== 0 && plus.parentElement.classList.contains('dmod__lpied')
    && !!plus.parentElement.querySelector('.dmod__lt'));
  const nom = li.querySelector('.dmod__nom');
  t('V4 : le nom porte son texte complet en title (et la case son libelle entier), le prix sa provenance en title et en description',
    nom.getAttribute('title') === nom.textContent && prix.getAttribute('title') === X.doc.getElementById(prix.getAttribute('aria-describedby').split(' ')[0]).textContent && /Son dernier prix/.test(prix.title));
  const css = lire('src/css/bdv-devis.css');
  t('T2 : le nom porte deux morceaux, la designation puis le millesime et le format, et le texte reste le nom complet',
    !!nom.querySelector('.dmod__vin') && !!nom.querySelector('.dmod__fmt') && nom.querySelector('.dmod__vin').nextElementSibling === nom.querySelector('.dmod__fmt')
    && nom.textContent === nom.getAttribute('title'));
  const blocTab = (css.match(/@container devis \(min-width:50rem\)\{[\s\S]*?\n\}/) || [''])[0];
  t('T2 : en tableau, seule la DESIGNATION se coupe ; le format ne se coupe jamais ; le nom n\'est plus coupe en bloc',
    /\.dmod__ligne \.dmod__vin\{[^}]*text-overflow:ellipsis/.test(blocTab) && /\.dmod__ligne \.dmod__fmt\{[^}]*white-space:nowrap/.test(blocTab)
    && !/\.dmod__fmt\{[^}]*(text-overflow:ellipsis|overflow:hidden)/.test(blocTab) && !/\.dmod__ligne \.dmod__nom\{[^}]*(text-overflow|overflow:hidden|white-space:nowrap)/.test(blocTab)
    && /\.dmod__vin:only-child\{[^}]*-webkit-line-clamp:2/.test(blocTab));
  t('T2 : la lecture d\'un devis envoye ne coupe rien',
    /\.dmod__lignes--lues \.dmod__ligne \.dmod__vin,\s*\.bdv-coque \.dmod__lignes--lues \.dmod__ligne \.dmod__fmt\{[^}]*white-space:normal[^}]*overflow:visible[^}]*text-overflow:clip/.test(blocTab));
  t('V4 : en tableau, la provenance passe en infobulle',
     /@container devis \(min-width:50rem\)\{[\s\S]*?\.dmod__ligne \[data-dev-src\],\s*\.bdv-coque \.dmod__ligne \.dmod__lib\{[^}]*clip-path:inset\(50%\)/.test(css));
  t('V15/W10 : en carte etroite, le pli et le total partagent une rangee, la provenance tient sur une ligne',
    /@container devis \(max-width:35\.9375rem\)\{[^@]*\.dmod__lpied\{[^}]*grid-column:1 \/ -1;[^}]*display:flex/.test(css) && /\.dmod__lpied\{ display:contents; \}/.test(css)
    && /@container devis \(max-width:35\.9375rem\)\{[^@]*\.dmod__ligne \[data-dev-src\]\{[^}]*white-space:nowrap/.test(css));
  const ad = X.modale().querySelector('[data-dev-livmode][value="adresse"]'); ad.checked = true; ad.dispatchEvent(new X.w.Event('change', { bubbles: true }));
  const cp = X.doc.getElementById('devLivCp'), pays = X.doc.getElementById('devLivPays');
  t('V18 : le code postal ouvre le clavier chiffres quand le pays est la France ou vide', !!cp && cp.getAttribute('inputmode') === 'numeric');
  X.taper(pays, 'Belgique');
  t('V18 : un autre pays rend le clavier lettres (codes postaux avec lettres)', cp.getAttribute('inputmode') === 'text');
  X.taper(pays, 'France');
  t('V18 : revenu a la France, le clavier chiffres revient', cp.getAttribute('inputmode') === 'numeric');
}

titre('16. Lot 65 : rappeler un devis envoye');
{
  /* Sans le SQL du lot : rien ne change, « Refaire » reste. */
  const X = monter({ lot52: true, fetch: 'ok' });
  await X.ouvrir(); X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="envoyer"]'); X.clic('[data-dev="confirmerEnvoi"]'); await attendre(40);
  t('sans le SQL : pas de « Rappeler », « Refaire ce devis » reste', !X.modale().querySelector('[data-dev="rappeler"]') && !!X.modale().querySelector('[data-dev="refaire"]'));
}
{
  const X = monter({ lot52: true, lot65: true, fetch: 'ok' });
  await X.ouvrir(); X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="envoyer"]'); X.clic('[data-dev="confirmerEnvoi"]'); await attendre(40);
  const m = X.modale(), d = X.devis[0];
  t('envoye : « Corriger ce devis (version 2) » remplace « Refaire ce devis »', !!m.querySelector('[data-dev="rappeler"]') && m.querySelector('[data-dev="rappeler"]').textContent === 'Corriger ce devis (version 2)' && !m.querySelector('[data-dev="refaire"]'));
  t('son aide dit le lien coupe, le meme numero et la version 2', /lien de signature ne marchera plus/.test(X.doc.getElementById('devRappelAide').textContent)
    && /même numéro, en version 2/.test(X.doc.getElementById('devRappelAide').textContent));
  const avant = X.requetes.length;
  X.clic('[data-dev="rappeler"]');
  const bx = X.doc.getElementById('devRappel');
  t('un appui ouvre la confirmation, focus sur « Non, le garder », et rien ne part', !bx.hidden && X.doc.activeElement === bx.querySelector('[data-dev="garderRappel"]') && X.requetes.length === avant);
  t('la confirmation dit la version 2 datee d\'aujourd\'hui, la 1 gardee, et de prevenir le client',
    /version 2 datée d’aujourd’hui/.test(bx.textContent) && /La version 1 reste gardée/.test(bx.textContent) && /tu ne pourras pas revenir en arrière : il faudra renvoyer une version 2, même identique/.test(bx.textContent) && /préviens-le qu’elle ne vaut plus/.test(bx.textContent));
  X.clic('[data-dev="garderRappel"]');
  t('« Non, le garder » referme sans rien envoyer', bx.hidden && X.requetes.length === avant);
  X.clic('[data-dev="rappeler"]'); X.clic('[data-dev="confirmerRappel"]'); await attendre(40);
  const rq = X.requetes.filter(r => r.chemin === '/rpc/devis_rappeler');
  t('« Oui, le rappeler » appelle devis_rappeler pour CE bureau et CE devis', rq.length === 1 && rq[0].corps.p_bureau === BUREAU && rq[0].corps.p_devis === d.devis_id);
  t('le devis revient en saisie : pied « Enregistrer le devis », lignes reprises', !!m.querySelector('[data-dev="enregistrer"]') && m.querySelectorAll('.dmod__ligne[data-cle]').length === 1);
  t('le titre dit « version 2 », le sous-titre « Corrigé le », la 1 gardee', /, version 2/.test(X.doc.getElementById('devTitre').textContent) && /Corrigé le .* c’est la version 2, la version 1 est gardée/.test(m.querySelector('.tmod__sous').textContent),
    X.doc.getElementById('devTitre').textContent);
  t('l\'avis dit le lien qui ne marche plus et la version a renvoyer', /en correction : son lien de signature ne marche plus/.test(X.avis()) && /renvoie la version 2/.test(X.avis()), X.avis());
  t('l\'affaire est prevenue (ctx.change)', (X.changes || []).some(c => c.statut === 'enregistre' && c.version === 2));
  /* Renvoyer la version 2 : deux copies, l'apercu lit celle de la version 2 par son empreinte. */
  await X.enregistrer();
  X.clic('[data-dev="envoyer"]'); X.clic('[data-dev="confirmerEnvoi"]'); await attendre(40);
  t('la version 2 renvoyee laisse deux copies', (X.copiesV[d.devis_id] || []).length === 2 && /Version 2, remplace la version 1/.test(X.copiesV[d.devis_id][1]));
  X.clic('[data-dev="apercu"]'); await attendre(40);
  const lc = X.requetes.filter(r => /^\/devis_copies\?/.test(r.chemin)).pop();
  t('l\'apercu demande LA copie par son empreinte, et montre la version 2', !!lc && /&empreinte=eq\.[0-9a-f]{64}/.test(lc.chemin)
    && /Version 2, remplace la version 1/.test((X.w.BdvDevis._S().copie || {}).papier || ''), lc && lc.chemin);
  X.clic('[data-dev="revenir"]');
  const D = X.w.BdvDevis, lg = X.lignes[d.devis_id];
  const p2 = D.htmlPapier(Object.assign({}, d, { version: 2 }), lg, {}), p1 = D.htmlPapier(Object.assign({}, d, { version: 1 }), lg, {});
  t('le papier de la version 2 dit « Version 2 » sous le numero, et dans le pied de page', /<h1 class="dpap__h1">Devis [^<]+<\/h1><p>Version 2, remplace la version 1<\/p>/.test(p2) && /content:"Devis [^"]+, version 2"/.test(p2));
  t('le papier de la version 1 ne change pas (aucun mot « Version »)', !/Version|version \d/.test(p1) && p1 === D.htmlPapier(Object.assign({}, d, { version: undefined }), lg, {}));
}
{
  const X = monter({ lot52: true, lot65: true, fetch: 'ok' });
  await X.ouvrir(); X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="envoyer"]'); X.clic('[data-dev="confirmerEnvoi"]'); await attendre(40);
  X.mode = 'rap-signe'; X.clic('[data-dev="rappeler"]'); X.clic('[data-dev="confirmerRappel"]'); await attendre(40);
  t('refus « devis signe » : le dit, et propose de le refaire', /signé en ligne : il n’est plus modifiable\. Pour le changer, appuie sur « Refaire ce devis »/.test(X.avis()) && X.devis[0].statut === 'envoye', X.avis());
  X.mode = 'rap-panne'; X.clic('[data-dev="confirmerRappel"]'); await attendre(40);
  t('connexion coupee : le devis n\'a pas bouge, son lien marche toujours', /ta connexion a coupé\. Il n’a pas bougé, son lien marche toujours\./.test(X.avis()), X.avis());
  X.mode = 'rap-null'; X.clic('[data-dev="confirmerRappel"]'); await attendre(40);
  t('retour vide : un echec, jamais « rappelé »', !/en correction/.test(X.avis()) && !X.modale().querySelector('[data-dev="enregistrer"]'), X.avis());
}
{
  /* Commande deja telechargee (accepte, telecharge, annule) : pas de rappel. */
  const X = monter({ lot52: true, lot65: true, fetch: 'ok' });
  await X.ouvrir(); X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="envoyer"]'); X.clic('[data-dev="confirmerEnvoi"]'); await attendre(40);
  const d = X.devis[0];
  Object.assign(d, { commande_telechargements: 1, commande_telechargee_le: '2026-10-01T11:01:00+00:00', accord_annule_le: '2026-10-01T12:00:00+00:00' });
  X.w.BdvDevis.fermer(); await attendre(5);
  await X.ouvrir({ devis: Object.assign({}, d) }); await attendre(20);
  t('commande telechargee : pas de « Rappeler », « Refaire » et la raison', !X.modale().querySelector('[data-dev="rappeler"]') && !!X.modale().querySelector('[data-dev="refaire"]')
    && /commande a déjà été téléchargée pour Vitisoft : il n’est plus modifiable\. Pour le changer, appuie sur « Refaire ce devis »/.test(X.corps().textContent));
}
{
  /* Signe en ligne puis acceptation annulee : une preuve existe, pas de rappel. */
  const X = monter({ lot52: true, lot55: true, lot65: true, fetch: 'ok', preuve: { lien_id: 'l1', nom: 'Jean', signe_le: '2026-10-01T10:00:00+00:00' } });
  await X.ouvrir(); X.cocher(CLE0); await X.enregistrer();
  X.clic('[data-dev="envoyer"]'); X.clic('[data-dev="confirmerEnvoi"]'); await attendre(40);
  const d = X.devis[0]; d.accord_annule_le = '2026-10-01T12:00:00+00:00';
  X.w.BdvDevis.fermer(); await attendre(5);
  await X.ouvrir({ devis: Object.assign({}, d) }); await attendre(30);
  const q = X.requetes.filter(r => /^\/devis_signatures\?/.test(r.chemin));
  t('signe puis annule : la preuve est cherchee, et pas de « Rappeler »', q.length >= 1 && !X.modale().querySelector('[data-dev="rappeler"]')
    && /signé en ligne : il n’est plus modifiable\. Pour le changer, appuie sur « Refaire ce devis »/.test(X.corps().textContent));
}

titre('17. Lot 66 : le devis en pleine page et en trois etapes');
{
  const X = monter({ lot52: true, lot53: true, lot54: true });
  await X.ouvrir();
  const m = X.modale(), et = (n) => m.querySelector('.dmod__etape[data-etape="' + n + '"]');
  const nav = X.doc.getElementById('devEtapes'), bts = nav ? [...nav.querySelectorAll('.dmod__nav-b')] : [];
  t('trois etapes nommees, cliquables : Les vins, Conditions, Vérifier', bts.length === 3 && bts.map(b => b.querySelector('.dmod__nav-t').textContent).join('|') === 'Les vins|Conditions|Vérifier'
    && nav.getAttribute('aria-label') === 'Étapes du devis');
  t('devis neuf : etape 1 visible et marquee, 2 et 3 cachees', !et(1).hidden && et(2).hidden && et(3).hidden && bts[0].getAttribute('aria-current') === 'step' && !bts[1].hasAttribute('aria-current'));
  t('aucune case cochee d\'avance : on propose', ![...m.querySelectorAll('[data-dev-coche]')].some(c => c.checked) && m.querySelectorAll('.dmod__ligne[data-cle]').length === 0);
  t('le pied (total et Enregistrer) est hors des etapes, toujours visible', !X.corps().querySelector('.dmod__pied').closest('.dmod__etape'));
  X.cocher(CLE0);
  const avant = X.requetes.length;
  X.clic('[data-dev="suivant"]');
  t('« Suivant » montre l\'etape 2, la marque, et n\'ecrit RIEN', !et(2).hidden && et(1).hidden && bts[1].getAttribute('aria-current') === 'step' && X.requetes.length === avant);
  t('le focus va au titre de l\'etape (pour la synthese vocale)', X.doc.activeElement && X.doc.activeElement.classList.contains('dmod__etape-t') && /Étape 2 sur 3/.test(X.doc.activeElement.textContent));
  t('le bouton dit la suite : « Suivant : vérifier »', X.doc.getElementById('devSuivant').textContent === 'Suivant : vérifier');
  const resL = () => X.doc.getElementById('devRes_liv').textContent;
  t('livraison repliee par defaut, en une ligne : « À l’adresse du client, sans frais de port. »', resL() === 'À l’adresse du client, sans frais de port.' && X.doc.getElementById('devPli_liv').hidden);
  t('TVA et remise repliees, en une ligne', X.doc.getElementById('devRes_tva').textContent === 'En France, TVA 20 %.' && X.doc.getElementById('devRes_remise').textContent === 'Aucune remise sur tout le devis.'
    && X.doc.getElementById('devPli_tva').hidden && X.doc.getElementById('devPli_remise').hidden);
  const ch = m.querySelector('[data-dev="pli"][data-pli="liv"]');
  t('« Changer » dit ce qu\'il change (hors ecran) et ce qu\'il ouvre', /Changer\s+la livraison/.test(ch.textContent) && ch.getAttribute('aria-controls') === 'devPli_liv' && ch.getAttribute('aria-expanded') === 'false');
  ch.click();
  t('« Changer » ouvre la livraison en place, dit « Masquer », et pose le focus dans le choix', !X.doc.getElementById('devPli_liv').hidden && ch.getAttribute('aria-expanded') === 'true'
    && /Masquer/.test(ch.textContent) && X.doc.activeElement && X.doc.activeElement.hasAttribute('data-dev-livmode'));
  X.taper(X.doc.getElementById('devLivPort'), '15');
  t('la ligne suit la saisie, sans repeindre : « ... frais de port 15,00 € HT. »', /frais de port 15,00 € HT\.$/.test(resL()), resL());
  X.clic('[data-dev="suivant"]');
  const rc = X.doc.getElementById('devRecap');
  t('etape 3 : ce que tu proposes, le vin, sa quantite et son total', !et(3).hidden && rc.querySelectorAll('.dmod__recap-l li').length === 1 && /Cuvée A/.test(rc.textContent) && /\u00a0x /.test(rc.textContent));
  t('etape 3 : les trois conditions redites, et des liens pour les changer', /Livraison/.test(rc.textContent) && /frais de port 15,00/.test(rc.textContent) && /TVA/.test(rc.textContent)
    && !!rc.querySelector('[data-dev="etape"][data-vers="1"]') && !!rc.querySelector('[data-dev="etape"][data-vers="2"]'));
  rc.querySelector('[data-dev="etape"][data-vers="1"]').click();
  t('« Changer les vins » ramene a l\'etape 1', !et(1).hidden && et(3).hidden);
  /* Une erreur d'une autre etape y ramene, et ouvre son pli */
  bts[1].click();
  const ue = m.querySelector('[data-dev-regime][value="ue"]'); ue.checked = true; ue.dispatchEvent(new X.w.Event('change', { bubbles: true }));
  bts[2].click();
  X.clic('[data-dev="enregistrer"]'); await attendre(10);
  t('erreur de TVA depuis l\'etape 3 : retour a l\'etape 2, pli ouvert, focus sur le champ fautif', !et(2).hidden && et(3).hidden && !X.doc.getElementById('devPli_tva').hidden
    && X.doc.activeElement === X.doc.getElementById('devTvaClient') && X.doc.getElementById('devTvaClient').getAttribute('aria-invalid') === 'true', X.avis());
}
{
  /* Le client habituel : Enregistrer des l'etape 1, sans passer les etapes. */
  const X = monter({ lot52: true });
  await X.ouvrir(); X.cocher(CLE0);
  await X.enregistrer(); await attendre(20);
  const m = X.modale();
  t('enregistrer des l\'etape 1 marche, et mene a l\'etape 3 avec la suite (envoyer)', X.devis.length === 1 && !m.querySelector('.dmod__etape[data-etape="3"]').hidden
    && !!m.querySelector('.dmod__etape[data-etape="3"] [data-dev="envoyer"]'));
  X.w.BdvDevis.fermer(); await attendre(5);
  await X.ouvrir({ devis: Object.assign({}, X.devis[0]) }); await attendre(20);
  t('un devis enregistre rouvert s\'ouvre a l\'etape Vérifier', !X.modale().querySelector('.dmod__etape[data-etape="3"]').hidden && X.modale().querySelector('.dmod__etape[data-etape="1"]').hidden);
}
{
  /* Verificateur, tour 1 : « Préparer l'envoi » depuis une autre etape, et une question ouverte qu'on quitte. */
  const X = monter({ lot52: true });
  await X.ouvrir(); X.cocher(CLE0); await X.enregistrer(); await attendre(20);
  const m = X.modale(), et = (n) => m.querySelector('.dmod__etape[data-etape="' + n + '"]');
  m.querySelector('.dmod__nav-b[data-vers="1"]').click();
  X.doc.getElementById('devProchaine').hidden = false;
  X.clic('[data-dev="allerEnvoi"]');
  t('« Préparer l’envoi » depuis l\'etape 1 ramene a l\'etape 3, envoi ouvert et visible', !et(3).hidden && !X.doc.getElementById('devEnvoi').hidden && et(1).hidden);
  m.querySelector('.dmod__nav-b[data-vers="1"]').click();
  t('quitter l\'etape 3 referme la question ouverte, et un bouton plein reste', X.doc.getElementById('devEnvoi').hidden && !X.w.BdvDevis._S().envoi
    && [...m.querySelectorAll('.btn--bordeaux')].filter(n => !n.closest('[hidden]')).length === 1 && X.doc.getElementById('devPiedMot').hidden);
  /* Vigneron, tour 1 : un devis enregistre modifie ne part pas en silence */
  X.taper(X.champ(CLE0, 'qte'), '12');
  const r0 = X.retours || 0;
  X.clic('[data-dev="retour"]');
  t('changements pas enregistres : le premier « Retour » le dit et reste', (X.retours || 0) === r0 && /ne sont pas enregistrés/.test(X.avis()) && !m.hidden, X.avis());
  X.clic('[data-dev="retour"]');
  t('le second « Retour » part', (X.retours || 0) === r0 + 1);
}
{
  const X = monter({});
  await X.ouvrir();
  t('« Dans le devis » vide dit quoi faire', /Aucun vin pour l’instant : coche-le dans la liste, ou cherche-le\./.test(X.doc.getElementById('devLignes').textContent));
  const css = lire('src/css/bdv-devis.css').replace(/\s+/g, ' ');
  t('une seule sortie : la croix se cache quand « Retour à l’affaire » est la', /\.dmod__boite:has\(> \.dmod__retour-l:not\(\[hidden\]\)\) > \.tmod__x\{ display:none; \}/.test(css));
}
{
  const css = lire('src/css/bdv-devis.css').replace(/\s+/g, ' ');
  t('pleine page : la boite couvre l\'ecran, la colonne garde 62 rem', /\.bdv-coque \.dmod\{ padding:0; \}/.test(css) && /\.bdv-coque \.dmod__boite\{[^}]*max-width:none;[^}]*height:100%/.test(css)
    && /\.bdv-coque \.dmod__boite > \*\{ max-width:62rem;/.test(css));
  t('les etapes collent en haut, comme le pied en bas', /\.bdv-coque \.dmod__nav\{[^}]*position:sticky/.test(css));
}

console.log('\n== VERDICT ==');
console.log('  ' + OK + ' controle(s) passe(s), ' + KO + ' echec(s)');
console.log(KO ? '  LE DEVIS NE FAIT PAS CE QU\'IL DIT' : '  LE DEVIS FAIT CE QU\'IL DIT');
process.exit(KO ? 1 : 0);
