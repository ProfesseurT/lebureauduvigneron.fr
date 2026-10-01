/* ============================================================================
   scripts/banc-commande.mjs : LA COMMANDE VITISOFT, lot 49 (01/10/2026)
   ============================================================================
       npm run banc:commande     (lit les SOURCES, pas _site : aucun build requis)

   1. LE FICHIER (`BdvCommande.fabriquer`, pur) : les 24 colonnes de la section 3 de
      CAHIER_script-vitisoft.md, dans l'ordre ; `;`, point decimal, CR+LF, AUCUN
      guillemet ; numero du devis en colonnes 1 et 3 ; prix SIGNE en colonne 23 et
      colonne 24 = quantite x colonne 23 ; heure de PARIS ; nouveau client sans
      numero ; un `;` dans un nom ne decale aucune colonne.
   2. LA PIECE, dans jsdom avec un faux serveur : « Le client a dit oui » demande
      confirmation (focus sur « Pas encore ») ; un formulaire modifie ne s'accepte pas ;
      un retour sans statut `accepte` n'est jamais un succes ; le fichier part apres
      l'accord ; ce qui rendrait le fichier inimportable est dit AVANT, sans bouton.
   3. LE BRANCHEMENT : bdv-affaires.js charge bdv-commande.js avec le devis, et relit
      les affaires quand un devis est accepte (l'affaire est passee Gagnee).
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const SRC_CALC = lire('src/js/bdv-devis-calcul.js');
const SRC_DEVIS = lire('src/js/bdv-devis.js');
const SRC_DOMAINE = lire('src/js/bdv-domaine.js');
const SRC_CMD = lire('src/js/bdv-commande.js');
const SRC_AFF = lire('src/js/bdv-affaires.js');
const BUREAU = 'b4900000-0000-0000-0000-000000000049';

let OK = 0, KO = 0;
const t = (nom, v, detail) => {
  if (v) { OK++; console.log('  ok    : ' + nom); }
  else { KO++; console.log('  ECHEC : ' + nom + (detail !== undefined ? '  ->  ' + detail : '')); }
};
const titre = s => console.log('\n== ' + s + ' ==');
process.on('unhandledRejection', (e) => { KO++; console.log('  ECHEC : promesse rejetee sans prise : ' + (e && e.message)); });
const attendre = (ms) => new Promise(r => setTimeout(r, ms || 0));
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

const require = createRequire(import.meta.url);
const K = require(path.join(RACINE, 'src/js/bdv-commande.js'));

const DEVIS = {
  bureau: BUREAU, devis_id: 'dv1', affaire_id: 'aC', numero: 'D-2026-0007', statut: 'accepte',
  date_devis: '2026-09-30', valable_jusqu: '2026-10-30', accepte_le: '2026-07-01T22:30:05+00:00',
  num_client: 'C7', code_tarif: 'CHR', remise_globale_cb: 500, total_vins_c: 15060, remise_globale_c: 744,
  total_ht_c: 14316, tva_c: 2863, total_ttc_c: 17179, paiement_mode: 'fdm', paiement_jours: 30, validite_jours: 30,
  acheteur: { nom: 'Chez Paul; Fils', nouveau: false, code_postal: '44000', ville: 'Nantes', pays: 'France', email: 'paul@x.fr', num_client: 'C7' },
  vendeur: { raison_sociale: 'EARL ESSAIS' }
};
const LIGNES = [
  { rang: 2, num_produit: 'P101', designation: 'Cuvée "B"\nRéserve', quantite: 6, pu_ht_c: 900, remise_cb: 1000, pu_l_c: 810, pu_f_c: 770, net_c: 4860, final_c: 4620 },
  { rang: 1, num_produit: 'P100', designation: 'Cuvée A', quantite: 12, pu_ht_c: 850, remise_cb: 0, pu_l_c: 850, pu_f_c: 808, net_c: 10200, final_c: 9696 }
];

/* ---------------------------------------------------------------------------- */
titre('1. Le fichier');
{
  const f = K.fabriquer(DEVIS, LIGNES);
  const rangees = f.texte.split('\r\n');
  t('nom : commande-D-2026-0007.csv', f.nom === 'commande-D-2026-0007.csv', f.nom);
  t('fin de ligne CR+LF partout, et une derniere', /\r\n$/.test(f.texte) && !/[^\r]\n/.test(f.texte) && rangees.pop() === '');
  t('une rangee de titres + une rangee par ligne du devis', rangees.length === 3, rangees.length);
  t('AUCUN guillemet dans le fichier', !/["“”]/.test(f.texte));
  const titres = rangees[0].split(';');
  const attendus = ['numéro_commande', 'date_heure_commande', 'référence_commande_client', 'numéro_client', 'adresse_email',
    'société_facturation', 'nom_facturation', 'prénom_facturation', 'adresse1_facturation', 'adresse2_facturation',
    'code_postal_facturation', 'ville_facturation', 'pays_facturation', 'téléphone_facturation', 'mobile_facturation',
    'mode_de_facturation', 'code_tarif', 'commentaire', 'numéro_ligne', 'numéro_produit', 'désignation', 'quantité',
    'prix_unitaire', 'total_ht_ligne'];
  t('les 24 titres de la section 3 du CAHIER, dans l\'ordre', JSON.stringify(titres) === JSON.stringify(attendus), titres.join('|'));
  t('le CAHIER porte bien ces 24 colonnes', attendus.every((x, i) => new RegExp('\\| ' + (i + 1) + ' \\| ' + x + ' \\|').test(lire('CAHIER_script-vitisoft.md'))));
  const r1 = rangees[1].split(';'), r2 = rangees[2].split(';');
  t('chaque rangee a exactement 24 colonnes, meme avec un « ; » dans le nom du client', r1.length === 24 && r2.length === 24, r1.length + '/' + r2.length);
  t('colonnes 1 et 3 = numero du devis', r1[0] === 'D-2026-0007' && r1[2] === 'D-2026-0007');
  t('colonne 2 = heure de PARIS, AAAA-MM-JJ HH:MM:SS (22:30 UTC le 1er juillet = 00:30 le 2)', r1[1] === '2026-07-02 00:30:05', r1[1]);
  t('heure d\'hiver aussi : 2026-12-31 23:30 UTC = 2027-01-01 00:30:00', K._dateHeure('2026-12-31T23:30:00Z') === '2027-01-01 00:30:00', K._dateHeure('2026-12-31T23:30:00Z'));
  t('colonne 4 = numero client, 5 = e-mail', r1[3] === 'C7' && r1[4] === 'paul@x.fr');
  t('le « ; » du nom devient une virgule (colonnes 6 et 7)', r1[5] === 'Chez Paul, Fils' && r1[6] === 'Chez Paul, Fils', r1[5]);
  t('colonne 16 = HT, 17 = code tarif', r1[15] === 'HT' && r1[16] === 'CHR');
  t('colonne 18 = « Devis D-2026-0007 accepté le 02/07/2026 »', r1[17] === 'Devis D-2026-0007 accepté le 02/07/2026', r1[17]);
  t('les lignes suivent le RANG du devis, numerotees 1, 2', r1[18] === '1' && r1[19] === 'P100' && r2[18] === '2' && r2[19] === 'P101');
  t('designation sans guillemet ni retour a la ligne', r2[20] === 'Cuvée B Réserve', r2[20]);
  t('colonne 23 = prix SIGNE (pu_f), point decimal : 8.08 et 7.70', r1[22] === '8.08' && r2[22] === '7.70', r1[22] + ' ' + r2[22]);
  t('colonne 24 = total de ligne : 96.96 et 46.20', r1[23] === '96.96' && r2[23] === '46.20');
  t('colonne 24 = quantite x colonne 23, au centime', [r1, r2].every(r => Math.round(Number(r[21]) * Number(r[22]) * 100) === Math.round(Number(r[23]) * 100)));
  t('somme des colonnes 24 = total HT du devis', (9696 + 4620) === DEVIS.total_ht_c);
  t('prix : 5 -> 0.05, 123456 -> 1234.56, 0 -> 0.00', K._prix(5) === '0.05' && K._prix(123456) === '1234.56' && K._prix(0) === '0.00');
  let leve = false; try { K._prix(12.5); } catch (e) { leve = true; }
  t('un prix qui n\'est pas un entier de centimes LEVE (jamais d\'arrondi silencieux)', leve);
  t('meme devis, meme fichier, au caractere pres', K.fabriquer(DEVIS, LIGNES).texte === f.texte);

  const neuf = Object.assign({}, DEVIS, { num_client: null, code_tarif: null,
    acheteur: { nom: 'Cave Neuve', nouveau: true, contact_nom: 'Jeanne Martin', adresse: '3 quai Neuf', code_postal: '44000', ville: 'Nantes', email: 'neuve@x.fr', telephone: '02 40 11 22 33', num_client: 'X9' } });
  const n1 = K.fabriquer(neuf, LIGNES).texte.split('\r\n')[1].split(';');
  t('nouveau client : colonne 4 VIDE, meme si un numero traine', n1[3] === '', n1[3]);
  t('nouveau client : societe = son nom, nom de facturation = le contact', n1[5] === 'Cave Neuve' && n1[6] === 'Jeanne Martin');
  t('nouveau client : adresse, CP, ville, telephone', n1[8] === '3 quai Neuf' && n1[10] === '44000' && n1[11] === 'Nantes' && n1[13] === '02 40 11 22 33');
  t('nouveau client sans contact : nom de facturation = son nom (obligatoire, erreur 3)',
    K.fabriquer(Object.assign({}, neuf, { acheteur: Object.assign({}, neuf.acheteur, { contact_nom: null }) }), LIGNES).texte.split('\r\n')[1].split(';')[6] === 'Cave Neuve');

  titre('1 bis. Ce qui empeche un fichier importable');
  const enreg = Object.assign({}, DEVIS, { statut: 'enregistre', accepte_le: null });
  let r = null; try { K.fabriquer(enreg, LIGNES); } catch (e) { r = e.message; }
  t('un devis non accepte ne fabrique pas de fichier', r === 'devis non accepte', r);
  const sans = [Object.assign({}, LIGNES[0], { num_produit: null, designation: 'Vin libre' }), LIGNES[1]];
  t('ligne sans code article : nommee', JSON.stringify(K.manques(DEVIS, sans)) === JSON.stringify([{ quoi: 'produit', vins: ['Vin libre'] }]), JSON.stringify(K.manques(DEVIS, sans)));
  r = null; try { K.fabriquer(DEVIS, sans); } catch (e) { r = e.message; }
  t('... et le fichier refuse de se fabriquer', r === 'devis incomplet');
  const anonyme = Object.assign({}, DEVIS, { num_client: null, acheteur: { nom: 'Anonyme', nouveau: false, email: null } });
  t('client existant sans numero ni e-mail : signale', K.manques(anonyme, LIGNES).some(m => m.quoi === 'client'));
  t('client existant sans numero MAIS avec e-mail : accepte', K.manques(Object.assign({}, anonyme, { acheteur: { nom: 'A', nouveau: false, email: 'a@x.fr' } }), LIGNES).length === 0);
  t('nouveau client sans numero : rien a signaler', K.manques(neuf, LIGNES).length === 0);
  t('aucune ligne : signale', K.manques(DEVIS, []).some(m => m.quoi === 'vide'));
  const src = sansCommentaires(SRC_CMD);
  t('le module est pur : ni document, ni fetch, ni BdvCompte', !/document\.|fetch\(|BdvCompte/.test(src));
  t('aucun flottant dans un prix : ni toFixed ni parseFloat', !/toFixed|parseFloat/.test(src));
}

/* ---------------------------------------------------------------------------- */
const FICHE = { bureau: BUREAU, raison_sociale: 'EARL ESSAIS', siret: '12345678900017', adresse: '3 rue', code_postal: '44190',
  ville: 'Clisson', paiement_mode: 'fdm', paiement_jours: 30, validite_jours: 30 };
function monter(o) {
  o = o || {};
  const dom = new JSDOM('<!doctype html><html><head></head><body class="bdv-coque"><button id="depart">x</button></body></html>',
    { runScripts: 'outside-only', url: 'https://lebureauduvigneron.fr/mon-bureau/#affaires', pretendToBeVisual: true });
  const w = dom.window;
  const X = { w, doc: w.document, requetes: [], mode: o.mode || 'ok', telecharges: [], changes: [] };
  const d = Object.assign({}, DEVIS, { statut: 'enregistre', accepte_le: null, code_tarif: null,
    cree_le: '2026-09-30T08:00:00+00:00', maj_le: '2026-09-30T08:00:00+00:00' }, o.devis || {});
  /* Designations ordinaires ici : le guillemet et le retour a la ligne sont testes sur le
     fichier (section 1), pas sur l'ecran du devis. */
  X.lignes = (o.lignes || LIGNES.map(l => Object.assign({}, l, { designation: l.num_produit === 'P101' ? 'Cuvée B' : l.designation })))
    .map(l => Object.assign({}, l));
  w.BdvTiroir = { actif: () => false, poser: () => false, retirer: () => {} };
  w.Element.prototype.scrollIntoView = function () {};
  w.URL.createObjectURL = (b) => { X.blob = b; return 'blob:x'; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { X.telecharges.push(this.download); };
  const refus = (status, detail) => { const e = new Error('refus'); e.status = status; e.detail = detail; return e; };
  w.BdvCompte = {
    monBureau: () => BUREAU,
    api: async (chemin, op) => {
      op = op || {};
      X.requetes.push({ chemin, corps: op.corps === undefined ? undefined : JSON.parse(JSON.stringify(op.corps)) });
      await attendre(0);
      if (/^\/domaine\?/.test(chemin)) return [Object.assign({}, FICHE)];
      if (chemin === '/rpc/devis_propositions') return [];
      if (/^\/devis_lignes\?/.test(chemin)) return X.lignes.map(x => ({ ...x }));
      if (chemin === '/rpc/devis_accepter') {
        if (op.corps.p_bureau !== BUREAU) throw refus(403, '{"code":"42501"}');
        if (X.mode === 'null') return null;
        if (X.mode === 'enregistre') return Object.assign({}, d);
        if (X.mode === 'panne') throw new TypeError('Failed to fetch');
        if (X.mode === 'sql') throw refus(404, '{"code":"PGRST202"}');
        if (X.mode === 'commandee') throw refus(400, '{"code":"23514","message":"affaire deja commandee"}');
        if (X.mode === 'produit') throw refus(400, '{"code":"23514","message":"ligne sans numero produit"}');
        return Object.assign({}, d, { statut: 'accepte', accepte_le: '2026-10-01T08:00:00+00:00', code_tarif: 'CHR' });
      }
      throw refus(404, 'route inconnue : ' + chemin);
    }
  };
  w.eval(SRC_DOMAINE); w.eval(SRC_CALC); w.eval(SRC_CMD); w.eval(SRC_DEVIS);
  X.ctx = { bureau: BUREAU, affaire: { affaire_id: 'aC', issue: 'en_cours' }, sujet: 'Chez Paul', nouveau: false, devis: d,
    retour: () => {}, focusSortie: () => w.document.getElementById('depart'), change: (x) => X.changes.push(x) };
  X.modale = () => w.document.getElementById('devisModale');
  X.avis = () => (w.document.getElementById('devAvis') || {}).textContent || '';
  X.q = (sel) => X.modale().querySelector(sel);
  X.clic = async (sel) => { const n = X.q(sel); if (!n) throw new Error('introuvable : ' + sel); n.click(); await attendre(10); };
  X.ouvrir = async () => { await w.BdvDevis.ouvrir(X.ctx); await attendre(5); };
  return X;
}

titre('2. La piece : « Le client a dit oui »');
{
  const X = monter(); await X.ouvrir();
  t('un devis enregistre montre « Le client a dit oui ? » et le bouton', /Le client a dit oui \?/.test(X.modale().textContent) && !!X.q('[data-dev="accepter"]'));
  t('la confirmation est cachee au depart', !!X.q('#devAccord') && X.q('#devAccord').hidden === true);
  await X.clic('[data-dev="accepter"]');
  t('un appui ouvre la confirmation, focus sur « Pas encore » (rien ne se fige a deux Entree)',
    X.q('#devAccord').hidden === false && X.doc.activeElement === X.q('[data-dev="pasEncore"]'));
  t('elle dit ce qui va se passer : fige, Gagnee, fichier', /ne se modifiera plus/.test(X.q('#devAccord').textContent) && /Gagnée/.test(X.q('#devAccord').textContent));
  t('aucune requete d\'accord avant la confirmation', !X.requetes.some(r => r.chemin === '/rpc/devis_accepter'));
  await X.clic('[data-dev="pasEncore"]');
  t('« Pas encore » referme et rend le focus au bouton', X.q('#devAccord').hidden === true && X.doc.activeElement === X.q('[data-dev="accepter"]'));
  await X.clic('[data-dev="accepter"]');
  await X.clic('[data-dev="confirmerAccord"]');
  const req = X.requetes.filter(r => r.chemin === '/rpc/devis_accepter');
  t('UNE requete devis_accepter, pour CE bureau et CE devis', req.length === 1 && req[0].corps.p_bureau === BUREAU && req[0].corps.p_devis === 'dv1', JSON.stringify(req));
  t('le titre dit « accepté »', /Devis D-2026-0007 accepté/.test(X.doc.getElementById('devTitre').textContent), X.doc.getElementById('devTitre').textContent);
  t('« Accepté le 01/10/2026 » sous le titre', /Accepté le 01\/10\/2026/.test(X.q('.tmod__sous').textContent));
  t('le fichier part tout seul apres l\'accord', JSON.stringify(X.telecharges) === '["commande-D-2026-0007.csv"]', JSON.stringify(X.telecharges));
  t('c\'est un CSV UTF-8', !!X.blob && /text\/csv;charset=utf-8/.test(X.blob.type));
  t('l\'avis dit accepte, gagnee, le nom du fichier et ou l\'importer',
    /accepté, affaire gagnée/.test(X.avis()) && /commande-D-2026-0007\.csv/.test(X.avis()) && /Importer des commandes/.test(X.avis()), X.avis());
  t('le devis est en lecture : plus de champ, plus d\'« Enregistrer »', !X.q('[data-dev="enregistrer"]') && !X.q('input'));
  t('« Télécharger la commande » recoit le focus', X.doc.activeElement === X.q('[data-dev="telecharger"]'));
  t('le mode d\'emploi et l\'erreur 12 sont ecrits', /Commandes\/BL, menu Outils, Importer des commandes/.test(X.modale().textContent) && /déjà intégrée/.test(X.modale().textContent));
  t('l\'affaire est prevenue avec le devis accepte', X.changes.length === 1 && X.changes[0].statut === 'accepte');
  await X.clic('[data-dev="telecharger"]');
  t('re-telecharger redonne le meme fichier', X.telecharges.length === 2 && X.telecharges[1] === 'commande-D-2026-0007.csv');
}
{
  const X = monter(); await X.ouvrir();
  const champ = X.modale().querySelector('[data-dev-champ="qte"]');
  champ.value = '7'; champ.dispatchEvent(new X.w.Event('input', { bubbles: true }));
  await X.clic('[data-dev="accepter"]');
  t('formulaire modifie et pas enregistre : refuse, avec la raison', /Enregistre d’abord tes changements/.test(X.avis()) && X.q('#devAccord').hidden === true, X.avis());
  t('... et rien ne part', !X.requetes.some(r => r.chemin === '/rpc/devis_accepter'));
}
for (const [mode, motif] of [['null', /n’est pas accepté/], ['enregistre', /n’est pas accepté/], ['panne', /ta connexion a coupé/],
                              ['sql', /pas encore disponible/], ['commandee', /déjà une commande/], ['produit', /code article/]]) {
  const X = monter({ mode }); await X.ouvrir();
  await X.clic('[data-dev="accepter"]'); await X.clic('[data-dev="confirmerAccord"]');
  t('retour « ' + mode + ' » : dit comme un echec, aucun fichier, le devis reste modifiable',
    motif.test(X.avis()) && X.telecharges.length === 0 && !!X.q('[data-dev="enregistrer"]') && !/accepté/.test(X.doc.getElementById('devTitre').textContent) && X.changes.length === 0, X.avis());
}
{
  const X = monter({ lignes: [Object.assign({}, LIGNES[0], { num_produit: null, designation: 'Vin libre' }), LIGNES[1]] }); await X.ouvrir();
  t('ligne sans code article : la phrase nomme le vin, et pas de bouton', /il manque pour : Vin libre/.test(X.modale().textContent) && !X.q('[data-dev="accepter"]'));
}
{
  const X = monter({ devis: { statut: 'accepte', accepte_le: '2026-10-01T08:00:00+00:00', code_tarif: 'CHR' } }); await X.ouvrir();
  t('rouvrir un devis accepte : « La commande Vitisoft », le bouton de telechargement, pas d\'accord',
    /La commande Vitisoft/.test(X.modale().textContent) && !!X.q('[data-dev="telecharger"]') && !X.q('[data-dev="accepter"]'));
  await X.clic('[data-dev="telecharger"]');
  t('et le telechargement marche sans accord', X.telecharges.length === 1 && !X.requetes.some(r => r.chemin === '/rpc/devis_accepter'));
}

titre('3. Le branchement');
{
  const a = sansCommentaires(SRC_AFF);
  t('bdv-affaires.js pose bdv-commande.js avant bdv-devis.js', /poserJs\('\/js\/bdv-commande\.js'\)[\s\S]*poserJs\('\/js\/bdv-devis\.js'\)/.test(a));
  t('un devis accepte fait relire les affaires et repeindre', /d\.statut === 'accepte'[\s\S]{0,500}charger\(\)\.then/.test(a));
  t('le retour suit le chemin d\'une affaire close', /issue = 'gagnee'/.test(a));
  const dv = sansCommentaires(SRC_DEVIS);
  t('bdv-devis.js n\'ecrit que par ses RPC connues', (dv.match(/rpc\('devis_[a-z_]+'/g) || []).every(x => /enregistrer|abandonner|accepter|envoyer|refuser|annuler_accord|propositions/.test(x)));
  t('aucun onclick, aucun tiret cadratin', ![SRC_CMD, SRC_DEVIS].some(s => /onclick|—/.test(s)));
  t('rien dans bdv-nav.js ni dans la page', !/bdv-commande/.test(lire('src/js/bdv-nav.js')) && !/bdv-commande/.test(lire('src/mon-bureau.njk')));
  t('le SQL du lot est inscrit dans la procedure de reconstruction', /'lot49-commande\.sql'/.test(lire('scripts/banc-rejeu.mjs')));
}

console.log('\n== VERDICT ==');
console.log('  ' + OK + ' controle(s) passe(s), ' + KO + ' echec(s)');
console.log(KO ? '  LA COMMANDE NE FAIT PAS CE QU\'ELLE DIT' : '  LA COMMANDE FAIT CE QU\'ELLE DIT');
process.exit(KO ? 1 : 0);
