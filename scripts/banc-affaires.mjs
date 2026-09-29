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
  t('une ligne de l\'annuaire au meme nom qu\'un client le dit', /porte déjà ce nom : « Le Bistrot »/.test(box().textContent));
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
}

console.log('\n== VERDICT ==');
console.log('  ' + OK + ' controle(s) passe(s), ' + KO + ' echec(s)');
console.log(KO ? '  MES AFFAIRES NE FONT PAS CE QU\'ELLES DISENT' : '  MES AFFAIRES FONT CE QU\'ELLES DISENT');
process.exit(KO ? 1 : 0);
