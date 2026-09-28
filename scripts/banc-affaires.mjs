/* ============================================================================
   scripts/banc-affaires.mjs : la piece « Mes affaires », 28/09/2026

   Monte src/js/bdv-affaires.js dans jsdom avec un FAUX SERVEUR en memoire qui
   rejoue ce que fait la base du lot 34 (signature, dates d'etape, cloture). Il
   garde ce que le vigneron empathique a exige avant la premiere ligne :

   1. une affaire avec un rappel a venir n'est JAMAIS « endormie » ;
   2. « Etape suivante » n'ecrit rien pendant le delai d'annulation, et
      « Annuler » n'ecrit rien du tout ;
   3. depuis la derniere etape il n'y a pas de bouton « Etape suivante » ;
   4. conclure demande une confirmation ;
   5. une affaire a relancer n'est pas repetee dans la liste ;
   et les regles du depot : toute requete nomme son bureau, aucun `onclick`
   dans le HTML produit, aucun tiret cadratin a l'ecran.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'src/js/bdv-affaires.js'), 'utf8');
const BUREAU = 'aaaaaaaa-0000-0000-0000-000000000001';

let OK = 0, KO = 0;
const t = (nom, v, detail) => {
  if (v) { OK++; console.log('  ok    : ' + nom); }
  else { KO++; console.log('  ECHEC : ' + nom + (detail !== undefined ? '  →  ' + detail : '')); }
};
const titre = s => console.log('\n== ' + s + ' ==');
const attendre = (ms) => new Promise(r => setTimeout(r, ms || 0));

function monter() {
  const dom = new JSDOM('<!doctype html><body><p id="affAvis" hidden></p><div id="affCorps"></div></body>',
    { runScripts: 'outside-only', url: 'https://lebureauduvigneron.fr/mon-bureau/#affaires' });
  const w = dom.window;
  const base = { affaire_types: [], affaire_etapes: [], pistes: [], affaires: [] };
  const cles = { affaire_types: 'type_id', affaire_etapes: 'etape_id', pistes: 'piste_id', affaires: 'affaire_id' };
  const requetes = [];
  const maintenant = () => new Date().toISOString();
  function signer(table, l, avant) {
    l.maj_le = maintenant();
    if (table === 'affaires') {
      if (!avant) { l.etape_le = maintenant(); l.ouverte_le = maintenant(); l.issue = l.issue || 'en_cours'; }
      else if (l.etape_id !== avant.etape_id) l.etape_le = maintenant();
      if (l.issue === 'en_cours') { l.close_le = null; l.motif = null; }
      else if (!avant || avant.issue === 'en_cours') l.close_le = maintenant();
      if (l.issue !== 'en_cours') { l.rappel = null; l.rappel_titre = null; }
    }
    return l;
  }
  w.BdvCompte = {
    monBureau: () => BUREAU,
    api: async (chemin, o) => {
      o = o || {};
      requetes.push({ chemin, methode: o.methode || 'GET', corps: o.corps });
      const [nomTable, qs] = chemin.slice(1).split('?');
      const p = new URLSearchParams(qs || '');
      const rows = base[nomTable];
      const filtre = (r) => [...p.entries()].every(([k, v]) =>
        !/^eq\./.test(v) || String(r[k]) === v.slice(3));
      if (!o.methode || o.methode === 'GET') return rows.filter(filtre).map(r => ({ ...r }));
      if (o.methode === 'POST') { o.corps.forEach(l => rows.push(signer(nomTable, { ...l }))); return null; }
      if (o.methode === 'PATCH') {
        const touches = rows.filter(filtre);
        touches.forEach(r => { const avant = { ...r }; Object.assign(r, o.corps); signer(nomTable, r, avant); });
        return touches.map(r => ({ ...r }));
      }
      if (o.methode === 'DELETE') { base[nomTable] = rows.filter(r => !filtre(r)); return null; }
    }
  };
  w.eval(SRC);
  return { w, doc: w.document, base, requetes, cles,
    clic(sel) { const n = w.document.querySelector(sel); if (!n) throw new Error('introuvable : ' + sel); n.click(); } };
}

/* ---------------------------------------------------------------------------- */
titre('Premiere ouverture : les modeles');
const B = monter();
await B.w.BdvAffaires.ouvrir();
t('sans type, la piece propose les modeles', /Par quoi tu commences/.test(B.doc.body.textContent));
t('« Caviste / restaurant » est coche d\'office',
  B.doc.querySelector('input[name="affModele"][value="caviste"]').checked);
B.doc.querySelector('input[name="affModele"][value="importateur"]').checked = true;
B.clic('[data-aff="demarrer"]');
await attendre(20);
t('deux types crees', B.base.affaire_types.length === 2, B.base.affaire_types.length);
t('avec leurs huit etapes', B.base.affaire_etapes.length === 8, B.base.affaire_etapes.length);
t('les chips disent « en cours » a cote du nombre', /Toutes, 0 en cours/.test(B.doc.body.textContent));

titre('Nouvelle affaire');
B.clic('[data-aff="nouvelle"]');
t('le formulaire s\'ouvre', !!B.doc.getElementById('affForme'));
t('« C\'est qui ? » et pas « type d\'etablissement »', /C’est qui/.test(B.doc.getElementById('affForme').textContent));
B.doc.getElementById('affNom').value = 'Cave du Port';
B.doc.getElementById('affForme').dispatchEvent(new B.w.Event('submit', { bubbles: true, cancelable: true }));
await attendre(20);
t('une piste et une affaire ecrites', B.base.pistes.length === 1 && B.base.affaires.length === 1);
const aff = B.base.affaires[0];
t('l\'affaire est a la premiere etape de son type',
  aff.etape_id === B.base.affaire_etapes.filter(e => e.type_id === aff.type_id).sort((a, b) => a.ordre - b.ordre)[0].etape_id);
t('l\'affaire porte une piste et pas de client', !!aff.piste_id && !aff.client_id);
t('et son rappel dans une semaine', !!aff.rappel);

titre('L\'etat d\'une affaire : a relancer, endormie');
const etat = B.w.BdvAffaires.etat;
const vieux = new Date(Date.now() - 90 * 86400000).toISOString();
const typeId = aff.type_id;
t('rappel dans trois mois, 90 jours dans l\'etape : PAS endormie',
  etat({ type_id: typeId, etape_le: vieux, rappel: '2099-01-01' }).endormie === false);
t('sans rappel, 90 jours dans l\'etape : endormie',
  etat({ type_id: typeId, etape_le: vieux, rappel: null }).endormie === true);
t('rappel passe : a relancer, et pas endormie',
  (e => e.relancer && !e.endormie && e.retard > 0)(etat({ type_id: typeId, etape_le: vieux, rappel: '2020-01-01' })));
t('sans rappel, deux jours dans l\'etape : ni l\'un ni l\'autre',
  (e => !e.relancer && !e.endormie)(etat({ type_id: typeId, etape_le: new Date().toISOString(), rappel: null })));

titre('A relancer : en tete, et pas repetee');
B.base.affaires[0].rappel = '2020-01-01';
await B.w.BdvAffaires.ouvrir();
t('le bloc dit son nombre', /À relancer : 1/.test(B.doc.body.textContent));
t('le retard est ecrit en mots', /En retard de \d+ jours/.test(B.doc.body.textContent));
t('l\'affaire n\'apparait qu\'une fois',
  B.doc.querySelectorAll('[data-affaire="' + aff.affaire_id + '"]').length === 1,
  B.doc.querySelectorAll('[data-affaire="' + aff.affaire_id + '"]').length);

titre('Etape suivante, annulable');
const avantPatch = B.requetes.filter(r => r.methode === 'PATCH').length;
const etapeAvant = B.base.affaires[0].etape_id;
B.clic('[data-aff="suivante"]');
await attendre(20);
t('rien n\'est ecrit pendant le delai', B.requetes.filter(r => r.methode === 'PATCH').length === avantPatch);
t('l\'avis propose d\'annuler', !!B.doc.querySelector('#affAvis [data-aff="annulerSuivante"]'));
t('et le champ de rappel est ouvert', !!B.doc.querySelector('form.aff-edit input[name="rappel"]'));
B.doc.querySelector('#affAvis [data-aff="annulerSuivante"]').click();
await attendre(20);
t('annuler n\'ecrit rien', B.requetes.filter(r => r.methode === 'PATCH').length === avantPatch);
t('et l\'affaire reste a son etape', B.base.affaires[0].etape_id === etapeAvant);
B.clic('[data-aff="suivante"]');
await attendre(10);
B.doc.dispatchEvent(new B.w.Event('visibilitychange'));
Object.defineProperty(B.doc, 'visibilityState', { value: 'hidden', configurable: true });
B.doc.dispatchEvent(new B.w.Event('visibilitychange'));
await attendre(20);
t('la page qui se cache ecrit l\'etape en attente', B.base.affaires[0].etape_id !== etapeAvant);
Object.defineProperty(B.doc, 'visibilityState', { value: 'visible', configurable: true });

titre('La derniere etape ne conclut pas toute seule');
const ets = B.base.affaire_etapes.filter(e => e.type_id === typeId).sort((a, b) => a.ordre - b.ordre);
B.base.affaires[0].etape_id = ets[ets.length - 1].etape_id;
await B.w.BdvAffaires.ouvrir();
t('pas de bouton « Etape suivante » a la derniere etape',
  !B.doc.querySelector('[data-affaire="' + aff.affaire_id + '"] [data-aff="suivante"]'));
t('elle le dit', /Dernière étape/.test(B.doc.body.textContent));

titre('Conclure demande confirmation');
if (!B.doc.querySelector('form.aff-edit')) B.clic('[data-affaire="' + aff.affaire_id + '"] [data-aff="ouvrir"]');
B.clic('[data-aff="perdue"]');
t('« Pas pour cette fois » montre d\'abord le motif, sans rien ecrire',
  B.base.affaires[0].issue === 'en_cours'
  && !B.doc.querySelector('[data-confirme="perdue"]').hidden);
B.doc.querySelector('select[name="motif"]').value = 'prix';
B.clic('[data-aff="confirmerPerdue"]');
await attendre(20);
t('la confirmation classe l\'affaire, avec son motif',
  B.base.affaires[0].issue === 'perdue' && B.base.affaires[0].motif === 'prix');
t('elle rejoint les affaires closes', /Voir et rouvrir les affaires closes depuis un an \(0 gagnée sur 1\)/.test(B.doc.body.textContent));
B.clic('[data-aff="rouvrir"]');
await attendre(20);
t('et se rouvre', B.base.affaires[0].issue === 'en_cours');

titre('Les regles du depot');
t('toute requete nomme son bureau', B.requetes.every(r => r.methode === 'POST' || r.chemin.includes('bureau=eq.' + BUREAU)),
  B.requetes.filter(r => r.methode !== 'POST' && !r.chemin.includes('bureau=eq.')).map(r => r.chemin).join(' ; '));
t('toute ligne creee porte son bureau',
  B.requetes.filter(r => r.methode === 'POST').every(r => r.corps.every(l => l.bureau === BUREAU)));
B.clic('[data-aff="nouvelle"]');
B.doc.querySelector('.aff-reglages').open = true;
const html = B.doc.body.innerHTML;
t('aucun onclick dans le HTML produit', !/\sonclick=/.test(html));
t('aucun tiret cadratin a l\'ecran', !/—/.test(B.doc.body.textContent));
t('ni NaN, ni undefined, ni null a l\'ecran', !/NaN|undefined|\bnull\b/.test(B.doc.body.textContent));

titre('Retirer une etape qui porte une affaire');
const cible = B.base.affaires[0].etape_id;
B.clic('[data-aff="retirerEtape"][data-etape="' + cible + '"]');
await attendre(20);
t('l\'etape est retiree', !B.base.affaire_etapes.some(e => e.etape_id === cible));
t('et l\'affaire est deplacee, pas perdue', B.base.affaires.length === 1 && B.base.affaires[0].etape_id !== cible);
t('on le dit', /affaire déplacée vers/.test(B.doc.getElementById('affAvis').textContent));

console.log('\n== VERDICT ==');
console.log('  ' + OK + ' controle(s) passe(s), ' + KO + ' echec(s)');
console.log(KO ? '  MES AFFAIRES NE FONT PAS CE QU\'ELLES DISENT' : '  MES AFFAIRES FONT CE QU\'ELLES DISENT');
process.exit(KO ? 1 : 0);
