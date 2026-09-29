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
/* L'avis vit au-dessus de la liste, ou dans le panneau quand il est ouvert (lot 40). */
const avis = X => ['affAvis', 'amodAvis'].map(i => (X.doc.getElementById(i) || {}).textContent || '').join(' ');
const attendre = (ms) => new Promise(r => setTimeout(r, ms || 0));

function monter() {
  const dom = new JSDOM('<!doctype html><body><h2 id="affTitre">Mes affaires</h2><p id="affAvis" hidden></p><div id="affCorps"></div></body>',
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
{ const q = B.doc.getElementById('affCherche'); q.value = 'Cave du Port'; q.dispatchEvent(new B.w.Event('input', { bubbles: true })); }
B.clic('[data-aff="creerMain"]');
t('« Creer » ouvre la fiche avec le nom tape dans la barre', B.doc.getElementById('affNom').value === 'Cave du Port');
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
t('l\'avis propose d\'annuler', !!B.doc.querySelector('[data-aff="annulerSuivante"]'));
t('et le champ de rappel est ouvert', !!B.doc.querySelector('form.aff-edit input[name="rappel"]'));
B.doc.querySelector('[data-aff="annulerSuivante"]').click();
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
t('on le dit', /affaire déplacée vers/.test(avis(B)));

titre('Une affaire chez un client, depuis sa fiche (lot 35)');
{
  const C = monter();
  C.base.affaire_types.push({ bureau: BUREAU, type_id: 'tc', nom: 'Nouvelle cuvée chez un client', famille: 'client', sommeil_jours: 45, ordre: 0, archive: false });
  C.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'ec1', type_id: 'tc', nom: 'Idée notée', ordre: 1 });
  C.w.sessionStorage.setItem('bdv_affaire_client', JSON.stringify({ id: 'C0412', nom: 'Cave du Vieux Pressoir' }));
  await C.w.BdvAffaires.ouvrir();
  t('le mot laisse par la fiche ouvre le formulaire du client', !!C.doc.getElementById('affFormeClient'));
  t('il nomme le client', /chez Cave du Vieux Pressoir/.test(C.doc.getElementById('affFormeClient').textContent));
  t('et le mot est consomme', C.w.sessionStorage.getItem('bdv_affaire_client') === null);
  C.doc.getElementById('affTitreClient').value = 'Le rosé';
  C.doc.getElementById('affFormeClient').dispatchEvent(new C.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  const ac = C.base.affaires[0] || {};
  t('l\'affaire porte le client et pas de piste', ac.client_id === 'C0412' && !ac.piste_id && C.base.pistes.length === 0);
  t('avec le nom du client comme etiquette', ac.client_nom === 'Cave du Vieux Pressoir');
  t('la liste affiche le nom, pas le numero', /Cave du Vieux Pressoir/.test(C.doc.getElementById('affCorps').textContent));
}

titre('Lot 39 : la bascule Liste / Kanban');
{
  const K = monter();
  K.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste / restaurant', famille: 'conquete', sommeil_jours: 30, ordre: 0, archive: false },
                            { bureau: BUREAU, type_id: 't2', nom: 'Mariage', famille: 'evenement', sommeil_jours: 15, ordre: 1, archive: false });
  K.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 },
                             { bureau: BUREAU, etape_id: 'e2', type_id: 't1', nom: 'Premier contact', ordre: 2 },
                             { bureau: BUREAU, etape_id: 'e3', type_id: 't1', nom: 'Tarif envoyé', ordre: 3 },
                             { bureau: BUREAU, etape_id: 'm1', type_id: 't2', nom: 'Demande reçue', ordre: 1 });
  K.base.pistes.push({ bureau: BUREAU, piste_id: 'p1', nom: 'Cave du Port', opposition: false });
  K.base.affaires.push({ bureau: BUREAU, affaire_id: 'a1', type_id: 't1', etape_id: 'e1', piste_id: 'p1', titre: 'Cave du Port', issue: 'en_cours',
                         rappel: '2099-01-01', etape_le: new Date().toISOString() });
  await K.w.BdvAffaires.ouvrir();
  t('la liste est la disposition par defaut', K.doc.querySelector('[data-aff="vue"][data-vue="liste"]').getAttribute('aria-pressed') === 'true');
  K.clic('[data-aff="vue"][data-vue="kanban"]');
  t('le choix se retient sur l\'appareil', K.w.localStorage.getItem('bdv_aff_vue') === 'kanban');
  t('sur « Toutes », le kanban demande un type', /Choisis un type d’affaire/.test(K.doc.body.textContent) && !K.doc.querySelector('.aff-kanban'));
  K.clic('[data-aff="filtre"][data-type="t1"]');
  t('un type choisi : une colonne par etape', K.doc.querySelectorAll('.aff-col').length === 3);
  t('la carte est dans sa colonne', !!K.doc.querySelector('[data-colonne="e1"] [data-affaire="a1"]'));
  t('la carte dit « Nouveau client »', /Nouveau client/.test(K.doc.querySelector('[data-affaire="a1"]').textContent));
  t('la carte se deplace aussi sans glisser (liste « Deplacer vers »)', !!K.doc.querySelector('[data-affaire="a1"] select[data-deplacer]'));
  const avant = K.requetes.filter(r => r.methode === 'PATCH').length;
  const sel = K.doc.querySelector('[data-affaire="a1"] select[data-deplacer]');
  sel.value = 'e3'; sel.dispatchEvent(new K.w.Event('change', { bubbles: true }));
  t('le deplacement n\'ecrit rien pendant le delai d\'annulation', K.requetes.filter(r => r.methode === 'PATCH').length === avant);
  t('la carte a change de colonne a l\'ecran', !!K.doc.querySelector('[data-colonne="e3"] [data-affaire="a1"]'));
  t('et l\'avis propose d\'annuler', !!K.doc.querySelector('[data-aff="annulerSuivante"]'));
  K.doc.querySelector('[data-aff="annulerSuivante"]').click();
  await attendre(20);
  t('« Annuler » n\'ecrit rien et la carte revient', K.requetes.filter(r => r.methode === 'PATCH').length === avant && !!K.doc.querySelector('[data-colonne="e1"] [data-affaire="a1"]'));
  // Le glisser-deposer : un faux transfert, jsdom n'en a pas.
  const ev = new K.w.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: { getData: () => 'a1' } });
  K.doc.querySelector('[data-colonne="e2"]').dispatchEvent(ev);
  t('deposer la carte sur une colonne la deplace', !!K.doc.querySelector('[data-colonne="e2"] [data-affaire="a1"]'));
  K.clic('[data-aff="vue"][data-vue="liste"]');   // un autre geste vide l'attente : l'ecriture part
  await attendre(20);
  t('et l\'ecriture part ensuite, vers la bonne etape', K.base.affaires[0].etape_id === 'e2', K.base.affaires[0].etape_id);
  t('aucun onclick, aucun tiret cadratin dans le kanban', !/\sonclick=/.test(K.doc.body.innerHTML) && !/—/.test(K.doc.body.textContent));
}

titre('Lot 41 : UNE barre pour chercher ou creer le client');
{
  const P = monter();
  P.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste / restaurant', famille: 'conquete', sommeil_jours: 30, ordre: 0, archive: false },
                            { bureau: BUREAU, type_id: 'tc', nom: 'Nouvelle cuvée chez un client', famille: 'client', sommeil_jours: 45, ordre: 1, archive: false });
  P.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 },
                             { bureau: BUREAU, etape_id: 'c1', type_id: 'tc', nom: 'Idée notée', ordre: 1 });
  P.w.eval("var ROWS = [{ numClient: 'C7', client: 'Chez Paul', ville: 'Nantes', _dayNum: 3 }, { numClient: 'C8', client: 'Le Bistrot', ville: 'Angers', _dayNum: 4 }];");
  let appelsAnnuaire = 0;
  const ANNUAIRE = [{ nom: 'SARL CAVE DES QUAIS', siret: '12345678901234', adresse: '3 quai de la Fosse', code_postal: '44000', ville: 'Nantes', actif: true },
                    { nom: 'LE BISTROT', siret: '55555555500011', adresse: '1 rue', code_postal: '49000', ville: 'Angers', actif: true }];
  P.w.BdvDomaine = { chercher: async () => { appelsAnnuaire++; return { ok: true, liste: ANNUAIRE }; } };
  await P.w.BdvAffaires.ouvrir();
  P.clic('[data-aff="nouvelle"]');
  const f = () => P.doc.getElementById('affForme');
  const taper = async (v) => { const q = P.doc.getElementById('affCherche'); q.value = v; q.dispatchEvent(new P.w.Event('input', { bubbles: true })); };
  t('plus de boutons « Pour qui ? » : une seule barre', !P.doc.querySelector('input[name="affPourQui"]') && !!P.doc.getElementById('affCherche'));
  t('la fiche d\'un nouveau client est cachee au depart', P.doc.querySelector('[data-zone="nouveau"]').hidden);
  f().dispatchEvent(new P.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  t('sans client choisi, rien n\'est cree, et on le dit', P.base.affaires.length === 0 && /Choisis le client/.test(avis(P)));
  await taper('paul');
  const box = () => P.doc.getElementById('affPropositions');
  t('la barre propose d\'abord le client de l\'export', /Tes clients/.test(box().textContent) && /Chez Paul/.test(box().textContent));
  t('et toujours « Creer ... » en dernier', /Créer « paul »/.test(box().textContent));
  t('l\'annuaire attend une pause de frappe', appelsAnnuaire === 0 && /Recherche dans l’annuaire/.test(box().textContent));
  await taper('paule'); await taper('paul');
  await attendre(520);
  t('une seule demande a l\'annuaire pour trois frappes rapides', appelsAnnuaire === 1, appelsAnnuaire);
  t('les resultats de l\'annuaire suivent tes clients', /Dans l’annuaire officiel/.test(box().textContent) && /SARL CAVE DES QUAIS/.test(box().textContent));
  t('une ligne de l\'annuaire au nom d\'un client le dit', /Sans doute déjà dans ta base/.test(box().textContent) && /Tu as déjà « Le Bistrot »/.test(box().textContent));
  P.clic('#affPropositions [data-aff="prendreSiret"][data-i="1"]');
  P.clic('[data-aff="confirmeNon"]');
  t('« Non, en creer un nouveau » ouvre la fiche remplie par l\'annuaire', !P.doc.querySelector('[data-zone="nouveau"]').hidden && P.doc.getElementById('affNom').value === 'LE BISTROT');
  t('et la fiche previent encore du nom proche', !P.doc.getElementById('affDoublon').hidden);
  P.clic('[data-aff="lacherNouveau"]');
  t('un client existant se voit proposer aussi la famille « client »', [...P.doc.getElementById('affType').options].some(o => o.value === 'tc'));
  P.clic('#affPropositions [data-aff="prendreClient"]');
  t('le client choisi est nomme, et la barre s\'efface', /Chez Paul/.test(P.doc.getElementById('affChoisi').textContent) && P.doc.querySelector('[data-zone="cherche"]').hidden);
  P.doc.getElementById('affIntitule').value = 'Le rosé';
  f().dispatchEvent(new P.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  const a1 = P.base.affaires[0] || {};
  t('l\'affaire porte le client, sans piste creee', a1.client_id === 'C7' && a1.client_nom === 'Chez Paul' && !a1.piste_id && P.base.pistes.length === 0, JSON.stringify(a1));
  t('avec son titre', a1.titre === 'Le rosé');

  // Depuis l'annuaire
  P.clic('[data-aff="nouvelle"]');
  await taper('cave des quais'); await attendre(520);
  P.clic('#affPropositions [data-aff="prendreSiret"][data-i="0"]');
  t('une ligne de l\'annuaire ouvre la fiche remplie', !P.doc.querySelector('[data-zone="nouveau"]').hidden
    && P.doc.getElementById('affNom').value === 'SARL CAVE DES QUAIS' && P.doc.getElementById('affSiret').value === '12345678901234' && P.doc.getElementById('affVille').value === 'Nantes');
  t('et ne propose plus la famille « client »', ![...P.doc.getElementById('affType').options].some(o => o.value === 'tc'));
  f().dispatchEvent(new P.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  const pi = P.base.pistes[0] || {};
  t('un nouveau client est cree avec son SIRET et son adresse', pi.siret === '12345678901234' && pi.adresse === '3 quai de la Fosse', JSON.stringify(pi));
  t('et l\'affaire porte sur lui', P.base.affaires.some(a => a.piste_id === pi.piste_id));

  // Le meme SIRET une deuxieme fois
  P.clic('[data-aff="nouvelle"]');
  await taper('12345678901234'); await attendre(520);
  t('taper un SIRET deja connu retrouve le client dans « Tes clients »', /SARL CAVE DES QUAIS/.test(P.doc.querySelector('#affPropositions .aff-trouves').textContent));
  t('et l\'annuaire le marque « Deja dans ta base »', /Déjà dans ta base/.test(box().textContent));
  P.clic('#affPropositions [data-aff="prendreSiret"][data-i="0"]');
  t('le choisir dans l\'annuaire PREND le client existant, sans fiche nouvelle',
    /SARL CAVE DES QUAIS/.test(P.doc.getElementById('affChoisi').textContent) && P.doc.querySelector('[data-zone="nouveau"]').hidden && /déjà dans ta base/.test(avis(P)));

  // A la main : nom deja connu, SIRET deja connu, SIRET faux
  P.clic('[data-aff="lacherClient"]');
  await taper('Chez Paul');
  P.clic('[data-aff="creerMain"]');
  t('« Creer ... » ouvre la fiche avec le nom tape', P.doc.getElementById('affNom').value === 'Chez Paul');
  t('un nom deja connu previent, et propose de le prendre', /s’appelle déjà « Chez Paul »/.test(P.doc.getElementById('affDoublon').textContent)
    && !!P.doc.querySelector('#affDoublon [data-aff="prendreClient"]'));
  const nomI = P.doc.getElementById('affNom'); nomI.value = 'Chez Marcel'; nomI.dispatchEvent(new P.w.Event('input', { bubbles: true }));
  t('le nom change : l\'avertissement part', P.doc.getElementById('affDoublon').hidden);
  const sir = P.doc.getElementById('affSiret'); sir.value = '123 456 789 01234'; sir.dispatchEvent(new P.w.Event('input', { bubbles: true }));
  t('un SIRET deja connu previent, meme tape avec des espaces', /Ce SIRET est déjà celui de « SARL CAVE DES QUAIS »/.test(P.doc.getElementById('affDoublon').textContent));
  const avant = P.base.pistes.length;
  f().dispatchEvent(new P.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  t('et la creation est refusee : une entreprise, une fiche', P.base.pistes.length === avant && /déjà celui de/.test(avis(P)));
  sir.value = '1234';
  f().dispatchEvent(new P.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  t('un SIRET qui n\'a pas 14 chiffres est refuse', P.base.pistes.length === avant && /14 chiffres/.test(avis(P)));

  // Le lot 39 pas passe : la base refuse la colonne siret
  const vraie = P.w.BdvCompte.api;
  P.w.BdvCompte.api = async (chemin, o) => {
    if (o && o.methode === 'POST' && chemin === '/pistes' && o.corps.some(l => 'siret' in l))
      throw { detail: '{"message":"Could not find the \'siret\' column of \'pistes\' in the schema cache"}' };
    return vraie(chemin, o);
  };
  sir.value = '98765432109876';
  f().dispatchEvent(new P.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  t('sans le SQL du lot 39, le client se cree quand meme, et on le dit',
    P.base.pistes.some(p => p.nom === 'Chez Marcel') && /lot 39/.test(avis(P)));
  P.w.BdvCompte.api = vraie;

  // Changer le client d'une affaire
  const cible = P.base.affaires.find(a => a.client_id === 'C7');
  P.clic('[data-affaire="' + cible.affaire_id + '"] [data-aff="ouvrir"]');
  const cq = P.doc.querySelector('[data-affaire="' + cible.affaire_id + '"] .aff-change-q');
  cq.value = 'bistrot'; cq.dispatchEvent(new P.w.Event('input', { bubbles: true }));
  t('la recherche du changement ne repropose pas le client actuel', !/Chez Paul/.test(P.doc.querySelector('[data-affaire="' + cible.affaire_id + '"] .aff-change-l').textContent));
  P.clic('[data-affaire="' + cible.affaire_id + '"] [data-aff="rattacher"]');
  await attendre(20);
  const apres = P.base.affaires.find(a => a.affaire_id === cible.affaire_id);
  t('changer de client REMPLACE le client, un seul par affaire', apres.client_id === 'C8' && apres.client_nom === 'Le Bistrot' && !apres.piste_id);
  t('ni NaN, ni undefined, ni null a l\'ecran', !/NaN|undefined|\bnull\b/.test(P.doc.body.textContent));
}

titre('Lot 42 : un nom proche ne cree pas de doublon (capture de Ted, SOLUMATIC)');
{
  const S2 = monter();
  S2.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste / restaurant', famille: 'conquete', sommeil_jours: 30, ordre: 0, archive: false });
  S2.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 });
  S2.base.pistes.push({ bureau: BUREAU, piste_id: 'pS', nom: 'SOLUMATIC', opposition: false, siret: null, adresse: null, ville: null, code_postal: null });
  S2.w.BdvDomaine = { chercher: async () => ({ ok: true, liste: [
    { nom: 'SOLUMATIC (MS FORMATION - VITIWIN - MULTYSOFT - VITISOFT)', siret: '79899297000045', adresse: '1 rue des Tours', code_postal: '37170', ville: 'CHAMBRAY-LES-TOURS', actif: true },
    { nom: 'SEBASTIEN GARNIER', siret: '51229069300047', adresse: '', code_postal: '13100', ville: 'AIX', actif: false }] }) };
  await S2.w.BdvAffaires.ouvrir();
  S2.clic('[data-aff="nouvelle"]');
  const q = S2.doc.getElementById('affCherche'); q.value = 'Solumatic'; q.dispatchEvent(new S2.w.Event('input', { bubbles: true }));
  await attendre(520);
  const box = () => S2.doc.getElementById('affPropositions');
  t('la ligne « SOLUMATIC (MS FORMATION ...) » est reconnue comme SOLUMATIC', /Sans doute déjà dans ta base/.test(box().querySelector('[data-i="0"]').textContent));
  t('la ligne sans rapport ne l\'est pas', !/déjà dans ta base/.test(box().querySelector('[data-i="1"]').textContent));
  S2.clic('#affPropositions [data-aff="prendreSiret"][data-i="0"]');
  t('la choisir DEMANDE avant tout : c\'est la meme entreprise ?', /C’est la même entreprise que « SOLUMATIC »/.test(box().textContent)
    && S2.doc.querySelector('[data-zone="nouveau"]').hidden);
  S2.clic('[data-aff="confirmeOui"]');
  t('Oui : l\'affaire porte sur le client existant', /SOLUMATIC/.test(S2.doc.getElementById('affChoisi').textContent) && !S2.doc.getElementById('affChoisi').hidden);
  S2.doc.getElementById('affForme').dispatchEvent(new S2.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  t('AUCUN doublon cree', S2.base.pistes.length === 1, S2.base.pistes.length);
  t('l\'affaire porte sur la piste existante', S2.base.affaires.length === 1 && S2.base.affaires[0].piste_id === 'pS');
  t('et sa fiche a pris le SIRET et l\'adresse de l\'annuaire', S2.base.pistes[0].siret === '79899297000045' && S2.base.pistes[0].adresse === '1 rue des Tours', JSON.stringify(S2.base.pistes[0]));
  // Non : on cree bien un nouveau client
  S2.clic('[data-aff="nouvelle"]');
  const q2 = S2.doc.getElementById('affCherche'); q2.value = 'Solumatic'; q2.dispatchEvent(new S2.w.Event('input', { bubbles: true }));
  await attendre(520);
  t('une fois le SIRET pris, la ligne dit « Deja dans ta base »', /Déjà dans ta base/.test(box().querySelector('[data-i="0"]').textContent));
  const nv = S2.w.BdvAffaires._nomsProches;
  t('noms proches : les formes juridiques et les parentheses ne comptent pas',
    nv('SARL Cave du Port', 'CAVE DU PORT') && nv('SOLUMATIC', 'SOLUMATIC (MS FORMATION)') && nv('Cave du Port', 'Cave du Port de Nantes'));
  t('noms proches : un mot court seul ne rapproche pas', !nv('Cave', 'Cave de la Loire') && !nv('Le Bistrot', 'Chez Paul'));
}

titre('Lot 40 : le panneau sur le cote, comme une tache ou un client');
{
  const Q = monter();
  const appels = { poser: [], retirer: 0 };
  Q.w.BdvTiroir = { actif: () => true, poser: (b) => { appels.poser.push(b); return true; }, retirer: () => { appels.retirer++; } };
  Q.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste / restaurant', famille: 'conquete', sommeil_jours: 30, ordre: 0, archive: false });
  Q.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 },
                             { bureau: BUREAU, etape_id: 'e2', type_id: 't1', nom: 'Premier contact', ordre: 2 });
  Q.base.pistes.push({ bureau: BUREAU, piste_id: 'p1', nom: 'Cave du Port', opposition: false });
  Q.base.affaires.push({ bureau: BUREAU, affaire_id: 'a1', type_id: 't1', etape_id: 'e1', piste_id: 'p1', titre: 'Cave du Port', issue: 'en_cours',
                         rappel: '2099-01-01', etape_le: new Date().toISOString() });
  await Q.w.BdvAffaires.ouvrir();
  const panneau = () => Q.doc.getElementById('affaireModale');
  t('rien d\'ouvert : pas de panneau visible', !panneau() || panneau().hidden);
  t('la ligne ne dit plus « 0 jour »', !/\b0 jour\b/.test(Q.doc.getElementById('affCorps').textContent));
  const avantFocus = Q.doc.activeElement;
  Q.clic('[data-affaire="a1"] [data-aff="ouvrir"]');
  t('ouvrir une affaire montre le panneau', !!panneau() && !panneau().hidden);
  t('le panneau porte le nom et l\'etape', /Cave du Port/.test(panneau().textContent) && /Repéré/.test(panneau().textContent));
  t('l\'editeur est dans le panneau, plus dans la liste',
    !!panneau().querySelector('form.aff-edit') && !Q.doc.querySelector('#affCorps form.aff-edit'));
  t('la decision du tiroir passe par BdvTiroir.poser, avec la BOITE',
    appels.poser.length > 0 && appels.poser[0] && appels.poser[0].classList.contains('tmod__boite'));
  t('en tiroir, ouvrir une affaire ne vole pas le focus', Q.doc.activeElement === avantFocus || !panneau().contains(Q.doc.activeElement));
  t('la ligne ouverte est marquee', Q.doc.querySelector('#affCorps [data-affaire="a1"]').classList.contains('aff-ligne--ouverte'));
  Q.doc.dispatchEvent(new Q.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  t('Echap ferme le panneau, et le tiroir est retire', panneau().hidden && appels.retirer === 1);
  Q.clic('[data-aff="nouvelle"]');
  t('« Nouvelle affaire » s\'ouvre dans le panneau', !panneau().hidden && !!panneau().querySelector('#affForme') && !Q.doc.querySelector('#affCorps #affForme'));
  t('le formulaire neuf recoit le focus, meme en tiroir', panneau().contains(Q.doc.activeElement));
  const cq0 = Q.doc.getElementById('affCherche'); cq0.value = 'Chez Lulu'; cq0.dispatchEvent(new Q.w.Event('input', { bubbles: true }));
  Q.clic('[data-aff="creerMain"]');
  Q.clic('[data-aff="filtre"][data-type="t1"]');
  t('cliquer un filtre n\'efface pas ce qu\'on tape', Q.doc.getElementById('affNom') && Q.doc.getElementById('affNom').value === 'Chez Lulu');
  t('ni la fiche ouverte', !Q.doc.querySelector('[data-zone="nouveau"]').hidden);
  Q.doc.getElementById('affNom').value = '';
  Q.doc.getElementById('affForme').dispatchEvent(new Q.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  t('une erreur de saisie se dit DANS le panneau', /Il faut le nom/.test(Q.doc.getElementById('amodAvis').textContent));
  Q.doc.getElementById('affNom').value = 'Chez Lulu';
  Q.doc.getElementById('affIntitule').value = 'La carte des vins';
  Q.doc.getElementById('affForme').dispatchEvent(new Q.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  t('creer ferme le panneau', panneau().hidden);
  t('et garde le titre tape (l\'id ne se confond plus avec le titre de la piece)',
    Q.base.affaires.some(a => a.titre === 'La carte des vins'));
  t('le panneau ferme, le message revient au-dessus de la liste', /Affaire ouverte/.test(Q.doc.getElementById('affAvis').textContent));
  Q.clic('[data-affaire="a1"] [data-aff="ouvrir"]');
  Q.clic('#affaireModale [data-aff="fermerPanneau"].tmod__x');
  t('la croix ferme', panneau().hidden);
  t('aucun onclick dans le panneau', !/\sonclick=/.test(panneau().innerHTML));
}

/* ---------------------------------------------------------------------------
   LOT 44, 29/09/2026 : « VOIR SA FICHE » DEPUIS UNE AFFAIRE, ET LE CHEMIN INVERSE.
   Verifie par mutation le 29/09/2026, un defaut a la fois : bouton montre a un
   nouveau client, bouton montre sans Vitisoft, mauvais id passe a l'ouvreur,
   panneau laisse ouvert sous la fiche, retour `false` passe sous silence, affaire
   demandee par « Voir son affaire » non ouverte, pretexte non repris. Chaque fois
   le controle vise echoue.
   --------------------------------------------------------------------------- */
titre('Lot 44 : « Voir sa fiche » depuis une affaire');
{
  const F = monter();
  const trace = [];
  let retour = true;
  F.w.BdvTiroir = { actif: () => true, poser: () => true, retirer: () => { trace.push('retirer'); } };
  const optsVus = [];
  F.w.bdvOuvrirFiche = (id, cible, geste, opts) => { trace.push('fiche:' + id); optsVus.push(opts || null); return Promise.resolve(retour); };
  /* Les phrases vivent sur l'ouvreur (mon-bureau.njk) : le banc en pose des temoins. */
  F.w.bdvOuvrirFiche.motInconnu = 'TEMOIN-INCONNU';
  F.w.bdvOuvrirFiche.motPanne = 'TEMOIN-PANNE';
  const defiles = [];
  F.w.Element.prototype.scrollIntoView = function (o) { defiles.push({ id: this.id, o: o || null }); };
  let viti = true;
  F.w.BdvNav = { avecVitisoft: () => viti };
  F.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste / restaurant', famille: 'conquete', sommeil_jours: 30, ordre: 0, archive: false });
  F.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 });
  F.base.pistes.push({ bureau: BUREAU, piste_id: 'pN', nom: 'Cave Neuve', opposition: false },
                     { bureau: BUREAU, piste_id: 'pC', nom: 'Cave Devenue Cliente', client_id: 'C9', opposition: false });
  const jour = new Date().toISOString();
  F.base.affaires.push(
    { bureau: BUREAU, affaire_id: 'aC', type_id: 't1', etape_id: 'e1', client_id: 'C7', client_nom: 'Chez Paul', titre: 'Le rosé', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour },
    { bureau: BUREAU, affaire_id: 'aN', type_id: 't1', etape_id: 'e1', piste_id: 'pN', titre: 'Cave Neuve', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour },
    { bureau: BUREAU, affaire_id: 'aP', type_id: 't1', etape_id: 'e1', piste_id: 'pC', titre: 'Cave Devenue Cliente', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour });
  await F.w.BdvAffaires.ouvrir();
  const panneau = () => F.doc.getElementById('affaireModale');
  const bouton = () => panneau() && panneau().querySelector('[data-aff="voirFiche"]');
  const ouvrirAff = (id) => { if (panneau() && !panneau().hidden) F.clic('#affaireModale .tmod__x'); F.clic('#affCorps [data-affaire="' + id + '"] [data-aff="ouvrir"]'); };

  ouvrirAff('aC');
  t('une affaire sur un client existant montre « Voir sa fiche »', !!bouton() && bouton().textContent === 'Voir sa fiche' && bouton().classList.contains('btn'));
  ouvrirAff('aN');
  t('un nouveau client, pas encore dans Vitisoft, n\'a pas de fiche : pas de bouton', !bouton());
  ouvrirAff('aP');
  t('une piste devenue cliente (pistes.client_id) mene aussi a sa fiche', !!bouton());
  trace.length = 0;
  bouton().click();
  await attendre(10);
  t('le clic appelle le seul ouvreur, avec le numero du client de la piste', trace.includes('fiche:C9'), trace.join(' '));

  ouvrirAff('aC');
  trace.length = 0;
  bouton().click();
  await attendre(10);
  t('« Voir sa fiche » appelle bdvOuvrirFiche avec le bon numero', trace.filter(x => /^fiche:/.test(x)).join() === 'fiche:C7', trace.join(' '));
  t('une seule boite a la fois : le panneau est ferme, et son tiroir retire, AVANT la fiche',
    panneau().hidden && trace.indexOf('retirer') >= 0 && trace.indexOf('retirer') < trace.indexOf('fiche:C7'), trace.join(' '));
  t('une fiche ouverte ne laisse aucun message', F.doc.getElementById('affAvis').hidden);

  retour = false;
  ouvrirAff('aC'); bouton().click();
  await attendre(10);
  t('un retour « false » de l\'ouvreur est DIT au vigneron, avec les mots de l\'ouvreur',
    !F.doc.getElementById('affAvis').hidden && /TEMOIN-INCONNU/.test(avis(F)), avis(F));
  t('l\'ouvreur est appele « muet » : l\'avis de Ma journee ne double pas celui-ci',
    optsVus.length > 0 && optsVus.every(o => o && o.muet === true), JSON.stringify(optsVus));
  const dv = defiles[defiles.length - 1];
  t('l\'avis est amene a l\'ecran (page descendue a 390 px)', !!dv && dv.id === 'affAvis' && dv.o && dv.o.block === 'center', JSON.stringify(defiles));
  t('en douceur si le vigneron n\'a rien coupe', !!dv && dv.o && dv.o.behavior === 'smooth');
  F.w.matchMedia = (q) => ({ matches: /prefers-reduced-motion: reduce/.test(q), addEventListener() {}, removeEventListener() {} });
  retour = 'panne';
  ouvrirAff('aC'); bouton().click();
  await attendre(10);
  t('une panne de reseau aussi, avec les mots de l\'ouvreur', /TEMOIN-PANNE/.test(avis(F)), avis(F));
  const dv2 = defiles[defiles.length - 1];
  t('mouvements reduits : l\'avis vient sans animation', !!dv2 && dv2.o && dv2.o.behavior === 'auto', JSON.stringify(dv2));
  delete F.w.matchMedia;
  retour = true;
  const garde = F.w.bdvOuvrirFiche; delete F.w.bdvOuvrirFiche;
  ouvrirAff('aC'); bouton().click();
  await attendre(10);
  t('sans ouvreur dans la page, on le dit aussi', /ne s’ouvre pas d’ici/.test(avis(F)), avis(F));
  F.w.bdvOuvrirFiche = garde;

  viti = false;
  ouvrirAff('aC');
  t('sans Vitisoft, pas de « Voir sa fiche »', !bouton());
  viti = true;
  t('aucun onclick, aucun tiret cadratin', !/\sonclick=/.test(panneau().innerHTML) && !/—/.test(panneau().textContent));

  /* Le chemin inverse : « Voir son affaire » depuis Clients a suivre. */
  F.clic('#affaireModale .tmod__x');
  F.w.sessionStorage.setItem('bdv_affaire_ouvrir', 'aC');
  await F.w.BdvAffaires.ouvrir();
  t('« Voir son affaire » ouvre CETTE affaire dans le panneau', !panneau().hidden && /Chez Paul/.test(panneau().querySelector('#amodTitre').textContent));
  t('et le mot est consomme', F.w.sessionStorage.getItem('bdv_affaire_ouvrir') === null);
  F.clic('#affaireModale .tmod__x');
  F.w.sessionStorage.setItem('bdv_affaire_ouvrir', 'inconnue');
  await F.w.BdvAffaires.ouvrir();
  t('une affaire qui n\'est plus en cours n\'ouvre rien', panneau().hidden);

  /* « En faire une affaire » : la raison se lit, le pretexte se propose. */
  F.w.sessionStorage.setItem('bdv_affaire_client', JSON.stringify({ id: 'C5', nom: 'Bar du Coin', raison: 'Retard de cadence', enjeu: '1 200 € acheté au total', pretexte: 'Lui proposer sa commande habituelle' }));
  await F.w.BdvAffaires.ouvrir();
  t('la raison ET l\'enjeu de « Clients a suivre » sont ecrits dans le formulaire',
    /Dans tes clients à suivre : Retard de cadence, 1 200 € acheté au total\./.test(panneau().textContent), panneau().textContent.slice(0, 200));
  t('et son pretexte est propose dans « Pour quoi faire »', F.doc.getElementById('affMotifClient').value === 'Lui proposer sa commande habituelle');
  F.doc.getElementById('affTitreClient').value = 'Le magnum';
  F.doc.getElementById('affFormeClient').dispatchEvent(new F.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  const cree = F.base.affaires.find(a => a.client_id === 'C5') || {};
  t('le pretexte part dans le motif du rappel, aucun champ de plus', cree.rappel_titre === 'Lui proposer sa commande habituelle'
    && !('raison' in cree) && !('pretexte' in cree), JSON.stringify(cree));
}

/* L'ouvreur du bureau doit RENDRE sa reponse, sinon l'appelant ne peut rien dire : lu
   dans le gabarit, parce que ce banc ne monte pas mon-bureau.njk. Mutation verifiee. */
{
  const njk = fs.readFileSync(path.join(RACINE, 'src/mon-bureau.njk'), 'utf8');
  const i = njk.indexOf('function ouvrirFiche(id, cible, geste');
  const corps = i < 0 ? '' : njk.slice(i, njk.indexOf('window.bdvOuvrirFiche = ouvrirFiche', i));
  t('les phrases de panne vivent sur l\'ouvreur, et le texte d\'avant la fusion est parti',
    /ouvrirFiche\.motInconnu = MOT_INCONNU;/.test(njk) && /ouvrirFiche\.motPanne = MOT_PANNE;/.test(njk)
    && /MOT_INCONNU = 'Ce client n’est pas dans les ventes de cet appareil\. Dépose ton dernier export Vitisoft, puis réessaie\.'/.test(njk)
    && !/Ouvre « Mon commerce » une fois/.test(njk));
  t('« muet » fait taire l\'avis de Ma journee', /if\(muet \|\| !av\) return;/.test(corps) && /var muet = !!\(opts && opts\.muet\);/.test(corps));
  t('bdvOuvrirFiche rend sa promesse (true, false ou « panne »)',
    /return BdvNav\.chargerEcrans\(\)/.test(corps) && /return false;/.test(corps) && /return 'panne';/.test(corps) && /if\(ok\) return true;/.test(corps));
}

titre('Les affaires dans « Ma journee » (bdv-affaires-jour.js)');
{
  const J = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const SRCJ = fs.readFileSync(path.join(RACINE, 'src/js/bdv-affaires-jour.js'), 'utf8');
  let repeint = 0;
  J.window.bdvMajPanneau = () => { repeint++; };
  J.window.eval(SRCJ);
  const AJ = J.window.BdvAffairesJour;
  t('rien de lu, aucune punaise', AJ.punaises().length === 0);
  const auj = new Date(); const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const hier = new Date(Date.now() - 86400000), demain = new Date(Date.now() + 86400000);
  AJ.poser([{ affaire_id: 'x1', issue: 'en_cours', titre: 'x', piste_id: 'p1', rappel: iso(hier), rappel_titre: 'Envoyer le tarif' },
            { affaire_id: 'x2', issue: 'en_cours', titre: 'y', piste_id: 'p2', rappel: iso(demain) },
            { affaire_id: 'x3', issue: 'perdue', titre: 'z', piste_id: 'p3', rappel: iso(hier) }],
           { p1: { nom: 'Cave du Port' }, p2: { nom: 'Bistrot' }, p3: { nom: 'Perdue' } });
  t('poser repeint le panneau', repeint === 1);
  const p1 = AJ.punaises();
  t('une affaire en retard : une punaise qui la nomme', p1.length === 1 && p1[0].valeur === 'Cave du Port' && p1[0].tampon === 'affaire en retard' && p1[0].ton === 'vieux', JSON.stringify(p1));
  t('une affaire a venir ou close ne s\'epingle pas', !JSON.stringify(p1).includes('Bistrot') && !JSON.stringify(p1).includes('Perdue'));
  AJ.poser([{ affaire_id: 'x1', issue: 'en_cours', titre: 'x', piste_id: 'p1', rappel: iso(hier) },
            { affaire_id: 'x4', issue: 'en_cours', titre: 'Le rosé', client_id: 'C1', client_nom: 'Chez Paul', rappel: iso(auj) }],
           { p1: { nom: 'Cave du Port' } });
  const p2 = AJ.punaises();
  t('deux affaires dues : une seule punaise qui compte', p2.length === 1 && p2[0].valeur === '2' && p2[0].libelle === 'affaires à relancer', JSON.stringify(p2));
  t('la fiche du client retrouve son affaire', AJ.duClient('C1').length === 1 && AJ.duClient('C2').length === 0);
  /* LOT 44 : une affaire portee par une PISTE DEVENUE CLIENTE compte pour ce client. */
  AJ.poser([{ affaire_id: 'x5', issue: 'en_cours', titre: 'La carte', piste_id: 'p9' },
            { affaire_id: 'x6', issue: 'en_cours', titre: 'Rien', piste_id: 'p8' }],
           { p9: { nom: 'Cave Devenue', client_id: 'C9' }, p8: { nom: 'Toujours neuve' } });
  t('une piste devenue cliente : son affaire compte pour le client (poser)', AJ.duClient('C9').length === 1 && AJ.duClient('C9')[0].affaire_id === 'x5');
  t('une piste encore neuve ne compte pour personne', AJ.duClient('p8').length === 0 && AJ.duClient('undefined').length === 0);
  const reqJ = [];
  J.window.BdvCompte = { monBureau: () => 'b1', api: async (c) => { reqJ.push(c);
    if (/^\/affaires/.test(c)) return [{ affaire_id: 'x7', titre: 'T', piste_id: 'p7', client_id: null, rappel: null }];
    if (/^\/pistes/.test(c)) return [{ piste_id: 'p7', nom: 'Cave Lue', client_id: 'C77' }];
    return []; } };
  await AJ.charger();
  t('la lecture demande le client de la piste, et s\'en sert (charger)', reqJ.some(c => /\/pistes\?select=[^&]*client_id/.test(c)) && AJ.duClient('C77').length === 1, reqJ.join(' ; '));
}

console.log('\n== VERDICT ==');
console.log('  ' + OK + ' controle(s) passe(s), ' + KO + ' echec(s)');
console.log(KO ? '  MES AFFAIRES NE FONT PAS CE QU\'ELLES DISENT' : '  MES AFFAIRES FONT CE QU\'ELLES DISENT');
process.exit(KO ? 1 : 0);
