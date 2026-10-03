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
/* LA REGLE « A RELANCER » VIT DANS bdv-affaires-jour.js DEPUIS LE LOT 45 : la piece
   l'appelle. Le module part avec la page, avant elle ; le harnais fait pareil. */
const SRCJ_REGLE = fs.readFileSync(path.join(RACINE, 'src/js/bdv-affaires-jour.js'), 'utf8');
const BUREAU = 'aaaaaaaa-0000-0000-0000-000000000001';

let OK = 0, KO = 0;
const t = (nom, v, detail) => {
  if (v) { OK++; console.log('  ok    : ' + nom); }
  else { KO++; console.log('  ECHEC : ' + nom + (detail !== undefined ? '  →  ' + detail : '')); }
};
const titre = s => console.log('\n== ' + s + ' ==');
/* L'avis vit au-dessus de la liste, ou dans le panneau quand il est ouvert (lot 40). */
const avis = X => ['affAvis', 'amodAvis', 'affRegAvis'].map(i => (X.doc.getElementById(i) || {}).textContent || '').join(' ');
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
        /^in\.\(/.test(v) ? v.slice(4, -1).split(',').indexOf(String(r[k])) >= 0 : (!/^eq\./.test(v) || String(r[k]) === v.slice(3)));
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
  w.eval(SRCJ_REGLE);
  w.eval(SRC);
  return { w, doc: w.document, base, requetes, cles,
    clic(sel) { const n = w.document.querySelector(sel); if (!n) throw new Error('introuvable : ' + sel); n.click(); },
    /* 03/10/2026 : le type d'affaire se choisit dans une liste, plus par des pastilles. */
    filtre(v) { const n = w.document.querySelector('#affCorps select[data-aff-filtre]'); if (!n) throw new Error('introuvable : liste du type');
      n.value = v; n.dispatchEvent(new w.Event('change', { bubbles: true })); } };
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
{ const tete = B.doc.querySelector('.aff-closes > summary.aff-closes__tete');
  t('elle rejoint les affaires closes, dans un bandeau (02/10/2026)', !!tete && /Affaires closes, 12 derniers mois/.test(tete.textContent)
    && (tete.querySelector('.aff-closes__bilan') || {}).textContent === '0\u00a0gagnée sur 1' && !!tete.querySelector('.aff-closes__voir') && !!tete.querySelector('.aff-closes__masquer'),
    tete && tete.textContent); }
t('les types d\'affaires ont quitte Mon commerce (02/10/2026)', !B.doc.getElementById('affCorps').querySelector('.aff-type, .aff-reglages') && !/Régler mes types/.test(B.doc.body.textContent));
B.clic('[data-aff="rouvrir"]');
await attendre(20);
t('et se rouvre', B.base.affaires[0].issue === 'en_cours');

titre('Les regles du depot');
t('toute requete nomme son bureau', B.requetes.every(r => r.methode === 'POST' || r.chemin.includes('bureau=eq.' + BUREAU)),
  B.requetes.filter(r => r.methode !== 'POST' && !r.chemin.includes('bureau=eq.')).map(r => r.chemin).join(' ; '));
t('toute ligne creee porte son bureau',
  B.requetes.filter(r => r.methode === 'POST').every(r => r.corps.every(l => l.bureau === BUREAU)));
B.clic('[data-aff="nouvelle"]');
/* Les types d'affaires vivent dans Mes reglages : on monte l'onglet comme le fait
   bdv-affaires-jour.js, dans un hote a part. */
const HOTE_R = B.doc.createElement('div'); B.doc.body.appendChild(HOTE_R);
await B.w.BdvAffaires.reglages.ouvrir(HOTE_R);
t('l\'onglet « Mes affaires » montre les types, sans <form> (le panneau en est deja un)',
  !!HOTE_R.querySelector('.aff-type[data-type]') && !HOTE_R.querySelector('form'));
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

titre('Mes reglages, onglet « Mes affaires » (02/10/2026)');
{
  const box = () => HOTE_R.querySelector('.aff-type[data-type]');
  const tid = box().getAttribute('data-type');
  const nbAvant = B.base.affaire_etapes.filter(e => e.type_id === tid).length;
  /* M3 : un geste immediat (ajouter un modele) repeint l'onglet sans perdre ce qui est tape. */
  box().querySelector('input[name="ajout"]').value = 'Échantillons envoyés';
  const nomI = box().querySelector('input[name="nom"]'); const nomAvant = nomI.value; nomI.value = nomAvant + ' bis';
  const mod = HOTE_R.querySelector('[data-aff="ajoutModele"]');
  if (mod) { mod.click(); await attendre(30); }
  t('un repeint garde ce qui est tape et pas enregistre', box().querySelector('input[name="nom"]').value === nomAvant + ' bis'
    && box().querySelector('input[name="ajout"]').value === 'Échantillons envoyés');
  await B.w.BdvAffaires.reglages.enregistrer();
  await attendre(20);
  const tt = B.base.affaire_types.find(x => x.type_id === tid);
  t('« Enregistrer » du panneau enregistre le type qui a bouge', tt && tt.nom === nomAvant + ' bis'
    && B.base.affaire_etapes.filter(e => e.type_id === tid).length === nbAvant + 1, tt && tt.nom);
  t('et l\'etape ajoutee ne se rajoute pas une seconde fois', !box().querySelector('input[name="ajout"]').value);
  const nReq = B.requetes.length;
  await B.w.BdvAffaires.reglages.enregistrer();
  t('rien n\'a bouge : rien ne part', B.requetes.filter((r, i) => i >= nReq && r.methode !== 'GET').length === 0);
  box().querySelector('input[name="sommeil"]').value = '900';
  let rejet = false; try { await B.w.BdvAffaires.reglages.enregistrer(); } catch (e) { rejet = true; }
  t('un delai hors bornes est refuse, dit, et le panneau n\'annonce pas « enregistre »', rejet && /de 1 à 365 jours/.test(avis(B)));
  box().querySelector('input[name="sommeil"]').value = String(tt.sommeil_jours);
}

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
  /* 03/10/2026 : sur « Toutes », un tableau par type QUI A des affaires, jamais un ecran vide. */
  t('sur « Toutes », le kanban montre le tableau du type qui a une affaire', !/Choisis un type/.test(K.doc.body.textContent)
    && K.doc.querySelectorAll('.aff-kanban').length === 1 && /, 1 en cours/.test((K.doc.querySelector('.aff-kanban__type') || {}).textContent || ''),
    K.doc.querySelectorAll('.aff-kanban').length + ' tableau(x)');
  t('un type sans affaire n\'a pas de tableau sur « Toutes »', !K.doc.querySelector('[data-colonne="m1"]'));
  K.filtre('t1');
  t('un type choisi : une colonne par etape', K.doc.querySelectorAll('.aff-col').length === 3);
  t('la carte est dans sa colonne', !!K.doc.querySelector('[data-colonne="e1"] [data-affaire="a1"]'));
  /* V18 (01/10/2026) : l'etiquette dit ce qui manque, « Pas encore dans Vitisoft ». */
  /* 02/10/2026 : « Nouveau client » a l'oeil, et la synthese garde « pas encore dans Vitisoft ». */
  t('la carte dit « Nouveau client, pas encore dans Vitisoft »', /Nouveau client, pas encore dans Vitisoft/.test(K.doc.querySelector('[data-affaire="a1"]').textContent));
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
  /* T8 (tour 3) : la carte se saisit par son nom (le bouton dont le calque couvre la carte) */
  { const btn = K.doc.querySelector('[data-colonne="e2"] [data-affaire="a1"] .aff-ligne__qui');
    t('T8 : le nom (calque de toute la carte) est glissable lui aussi', !!btn && btn.getAttribute('draggable') === 'true');
    const donne = {}; let image = null;
    const ds = new K.w.Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(ds, 'dataTransfer', { value: { setData: (k, v) => { donne[k] = v; }, setDragImage: (n) => { image = n; }, effectAllowed: '' } });
    btn.dispatchEvent(ds);
    t('T8 : saisie par le nom, c\'est la CARTE qui part (son identifiant, et son image)', donne['text/plain'] === 'a1' && !!image && image.classList.contains('aff-carte'), JSON.stringify(donne));
    K.doc.dispatchEvent(new K.w.Event('dragend', { bubbles: true })); }
  /* T8 : deposee SUR une autre carte, la carte va dans la colonne de celle-ci */
  { const ul = K.doc.querySelector('[data-colonne="e3"] .aff-col__liste') || K.doc.querySelector('[data-colonne="e3"]');
    const autre = K.doc.createElement('li'); autre.className = 'aff-carte'; autre.setAttribute('data-affaire', 'zz'); autre.innerHTML = '<p class="aff-ligne__s"><b>texte</b></p>';
    ul.appendChild(autre);
    const dp = new K.w.Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dp, 'dataTransfer', { value: { getData: () => 'a1' } });
    autre.querySelector('b').dispatchEvent(dp);
    t('T8 : deposee sur une autre carte, elle prend la colonne de cette carte', !!K.doc.querySelector('[data-colonne="e3"] [data-affaire="a1"]'));
    const dp2 = new K.w.Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dp2, 'dataTransfer', { value: { getData: () => 'a1' } });
    K.doc.querySelector('[data-colonne="e2"]').dispatchEvent(dp2); }
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
  t('« Non, en creer un nouveau » ouvre la fiche remplie par l\'annuaire', !P.doc.querySelector('[data-zone="nouveau"]').hidden && P.doc.getElementById('affNom').value === 'Le Bistrot');
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
    && P.doc.getElementById('affNom').value === 'SARL Cave des Quais' && P.doc.getElementById('affSiret').value === '12345678901234' && P.doc.getElementById('affVille').value === 'Nantes');
  t('T9 : le nom propose reste modifiable avant la creation', !P.doc.getElementById('affNom').readOnly && !P.doc.getElementById('affNom').disabled);
  t('et ne propose plus la famille « client »', ![...P.doc.getElementById('affType').options].some(o => o.value === 'tc'));
  f().dispatchEvent(new P.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  const pi = P.base.pistes[0] || {};
  t('un nouveau client est cree avec son SIRET et son adresse', pi.siret === '12345678901234' && pi.adresse === '3 quai de la Fosse', JSON.stringify(pi));
  t('et l\'affaire porte sur lui', P.base.affaires.some(a => a.piste_id === pi.piste_id));

  // Le meme SIRET une deuxieme fois
  P.clic('[data-aff="nouvelle"]');
  await taper('12345678901234'); await attendre(520);
  t('taper un SIRET deja connu retrouve le client dans « Tes clients »', /SARL Cave des Quais/.test(P.doc.querySelector('#affPropositions .aff-trouves').textContent));
  t('et l\'annuaire le marque « Deja dans ta base »', /Déjà dans ta base/.test(box().textContent));
  P.clic('#affPropositions [data-aff="prendreSiret"][data-i="0"]');
  t('le choisir dans l\'annuaire PREND le client existant, sans fiche nouvelle',
    /SARL Cave des Quais/.test(P.doc.getElementById('affChoisi').textContent) && P.doc.querySelector('[data-zone="nouveau"]').hidden && /déjà dans ta base/.test(avis(P)));

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
  t('un SIRET deja connu previent, meme tape avec des espaces', /Ce SIRET est déjà celui de « SARL Cave des Quais »/.test(P.doc.getElementById('affDoublon').textContent));
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
  /* T9 (tour 3) : le nom de l'annuaire est propose proprement */
  const np = S2.w.BdvAffaires._nomPropose;
  t('T9 : sans la parenthese d\'enseignes, en casse de titre', np('CAVE DU QUAI (CAVE DU QUAI - LE COMPTOIR NANTAIS)') === 'Cave du Quai', np('CAVE DU QUAI (CAVE DU QUAI - LE COMPTOIR NANTAIS)'));
  t('T9 : l\'article de tete garde sa majuscule, les petits mots descendent', np('LA CAVE DE CLISSON') === 'La Cave de Clisson', np('LA CAVE DE CLISSON'));
  t('T9 : les sigles de forme juridique restent en capitales', np('EARL DU CLOS DES VIGNES') === 'EARL du Clos des Vignes' && np('SCEA LES TERRES') === 'SCEA Les Terres' && np('SAS CAVE NEUVE') === 'SAS Cave Neuve',
    [np('EARL DU CLOS DES VIGNES'), np('SCEA LES TERRES'), np('SAS CAVE NEUVE')].join(' / '));
  t('T9 : tirets et apostrophes', np('CAVE SAINT-VINCENT') === 'Cave Saint-Vincent' && np("L'ATELIER D'ANJOU") === "L'Atelier d'Anjou" && np("D'ICI ET D'AILLEURS") === "D'Ici et d'Ailleurs", np("L'ATELIER D'ANJOU"));
  t('T9 : un nom deja en casse mixte n\'est pas retouche (sauf la parenthese)', np('Cave du Port') === 'Cave du Port' && np('SOLUMATIC (MS FORMATION)') === 'Solumatic' && np('McCave (Nantes)') === 'McCave');
  t('T9 : le nom propose reste proche de celui de l\'annuaire', nv(np('SOLUMATIC (MS FORMATION - VITIWIN)'), 'SOLUMATIC (MS FORMATION - VITIWIN)') && nv(np('SARL CAVE DU PORT'), 'Cave du Port'));
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
  Q.filtre('t1');
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
  t('une affaire sur un client existant montre « Voir sa fiche »', !!bouton() && bouton().textContent === 'Voir sa fiche' && !!bouton().closest('.amod__fiche'));
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
  F.w.sessionStorage.setItem('bdv_affaire_client', JSON.stringify({ id: 'C5', nom: 'Bar du Coin', raison: 'Retard de cadence', enjeu: '1 200 € achetés au total', pretexte: 'Lui proposer sa commande habituelle' }));
  await F.w.BdvAffaires.ouvrir();
  t('la raison ET l\'enjeu de « Clients a suivre » sont ecrits dans le formulaire',
    /Dans tes clients à suivre : Retard de cadence, 1 200 € achetés au total\./.test(panneau().textContent), panneau().textContent.slice(0, 200));
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

/* ----------------------------------------------------------------------------
   LOT 45, 29/09/2026 : LA REGLE « A RELANCER » UNIQUE, LE BILAN COMMUN.
   La regle vit dans bdv-affaires-jour.js ; la piece l'appelle par `etat()`, la
   punaise de Ma journee et la case « A relancer » du bilan comptent avec elle.
   Le cas qui les faisait diverger : une affaire ENDORMIE SANS RAPPEL (le bloc la
   comptait, la punaise non). Le bilan n'est plus dans #affCorps.
   ---------------------------------------------------------------------------- */
titre('Lot 45 : une regle « a relancer », un bilan au-dessus des onglets');
{
  t('etat() de la piece appelle la regle de bdv-affaires-jour.js, et ne la redit pas',
    /return BdvAffairesJour\.etat\(a, t\.sommeil_jours, aujourdhui(, oppose\(a\))?\);/.test(SRC)
    && !/retard\s*==\s*null\s*&&\s*jours/.test(SRC) && !/ecartJours\(a\.rappel/.test(SRC) && !/retard\s*>=\s*0/.test(SRC));
  t('htmlBilan() a quitte la piece', !/htmlBilan/.test(SRC) && !/aff-bilan/.test(SRC));

  const H = monter();
  /* Le bilan vit hors de #affCorps : le harnais porte l'element et un double de la barre. */
  const bil = H.doc.createElement('div');
  bil.id = 'bureauComBilan'; bil.className = 'aff-bilan'; bil.hidden = true;
  H.doc.body.insertBefore(bil, H.doc.body.firstChild);
  const vus = [];
  H.w.BdvNav = { ongletCourant: () => 'gagner', avecVitisoft: () => false,
    afficher: (id, o) => { vus.push(id + ':' + ((o || {}).onglet || '')); H.w.BdvAffaires.ouvrir(); } };
  await H.w.BdvAffaires.ouvrir();
  H.clic('[data-aff="demarrer"]');
  await attendre(20);
  const tid = H.base.affaire_types[0].type_id;
  const et1 = H.base.affaire_etapes.filter(e => e.type_id === tid).sort((a, b) => a.ordre - b.ordre)[0].etape_id;
  const loin = new Date(Date.now() - 200 * 86400000).toISOString();
  const pr = (id, nom) => H.base.pistes.push({ piste_id: id, nom, bureau: BUREAU });
  pr('q1', 'Cave Endormie'); pr('q2', 'Cave En Retard'); pr('q3', 'Cave Tranquille');
  const af = (id, piste, rappel, etape_le) => H.base.affaires.push({ affaire_id: id, bureau: BUREAU, type_id: tid,
    etape_id: et1, piste_id: piste, titre: 'T' + id, issue: 'en_cours', rappel, etape_le, maj_le: new Date().toISOString() });
  af('e1', 'q1', null, loin);                         // endormie, SANS rappel
  af('e2', 'q2', '2020-01-01', new Date().toISOString()); // rappel passe
  af('e3', 'q3', null, new Date().toISOString());     // ni l'un ni l'autre
  H.w.localStorage.setItem('bdv_aff_vue', 'kanban');
  H.w.BdvAffaires._S.vue = 'liste';
  await H.w.BdvAffaires.ouvrir();
  const bloc = (H.doc.body.textContent.match(/À relancer : (\d+)/) || [])[1];
  t('le bloc compte l\'endormie sans rappel : « A relancer : 2 »', bloc === '2', bloc);
  t('la regle unique dit la meme chose (BdvAffairesJour.aRelancer)', H.w.BdvAffairesJour.aRelancer().length === 2);
  const pun = H.w.BdvAffairesJour.punaises();
  t('la punaise de Ma journee dit le meme mot et le meme nombre',
    pun.length === 1 && pun[0].valeur === '2' && pun[0].libelle === 'affaires à relancer', JSON.stringify(pun));
  H.w.BdvAffairesJour.peindreBilan();
  const n = (q) => ((bil.querySelector('[data-bilan="' + q + '"] .aff-bilan__n') || {}).textContent);
  t('la case « A relancer » du bilan = le bloc « A relancer : N »', n('relancer') === bloc, n('relancer') + ' / ' + bloc);
  t('sa sous-ligne dit ce qu\'elle compte',
    /promesse dépassée ou plus de nouvelles/.test((bil.querySelector('[data-bilan="relancer"]') || {}).textContent || ''));
  t('« Affaires en cours » compte les trois, au pluriel',
    n('affaires') === '3' && /affaires en cours/.test(bil.textContent));
  t('aucun bilan dans #affCorps, aucun montant dans le bilan',
    !H.doc.querySelector('#affCorps .aff-bilan') && !/€/.test(bil.textContent));
  t('chaque case est un bouton', [...bil.children].length === 2 && [...bil.children].every(b => b.tagName === 'BUTTON'));
  /* Le geste « A relancer » : Toutes, Liste EN MEMOIRE, focus sur le bloc. */
  H.w.BdvAffaires._S.filtre = tid;
  H.w.BdvAffaires._S.vue = 'kanban';
  bil.querySelector('[data-bilan="relancer"]').click();
  await attendre(30);
  t('« A relancer » ouvre « A gagner »', vus[vus.length - 1] === 'clients:gagner', vus.join(','));
  t('sur « Toutes », en Liste', H.w.BdvAffaires._S.filtre === '' && H.w.BdvAffaires._S.vue === 'liste');
  t('sans reecrire bdv_aff_vue', H.w.localStorage.getItem('bdv_aff_vue') === 'kanban', H.w.localStorage.getItem('bdv_aff_vue'));
  t('le focus est sur le bloc « A relancer : N »',
    H.doc.activeElement && H.doc.activeElement.id === 'affRelancer' && /À relancer : 2/.test(H.doc.activeElement.textContent),
    H.doc.activeElement && H.doc.activeElement.id);
  H.w.BdvAffaires._S.filtre = tid;
  bil.querySelector('[data-bilan="affaires"]').click();
  await attendre(30);
  t('« Affaires en cours » ouvre « A gagner » sur « Toutes »',
    vus[vus.length - 1] === 'clients:gagner' && H.w.BdvAffaires._S.filtre === '');
}
{
  /* LA PUNAISE D'UNE SEULE ENDORMIE : elle la nomme, et le dit. */
  const J2 = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  J2.window.eval(SRCJ_REGLE);
  const A2 = J2.window.BdvAffairesJour;
  A2.poser([{ affaire_id: 'z1', issue: 'en_cours', titre: 'z', piste_id: 'p1', rappel: null, type_id: 'T', etape_le: new Date(Date.now() - 20 * 86400000).toISOString() }],
    { p1: { nom: 'Cave Muette' } }, [{ type_id: 'T', sommeil_jours: 10 }]);
  const p = A2.punaises();
  t('une seule endormie sans rappel : une punaise qui la nomme',
    p.length === 1 && p[0].valeur === 'Cave Muette' && p[0].tampon === 'affaire endormie', JSON.stringify(p));
  A2.poser([{ affaire_id: 'z1', issue: 'en_cours', titre: 'z', piste_id: 'p1', rappel: null, type_id: 'T', etape_le: new Date(Date.now() - 20 * 86400000).toISOString() }],
    { p1: { nom: 'Cave Muette' } }, [{ type_id: 'T', sommeil_jours: 30 }]);
  t('le delai du type est lu : a 20 jours sur 30, pas de punaise', A2.punaises().length === 0);
  const reqs = [];
  J2.window.BdvCompte = { monBureau: () => 'b1', api: async (c) => { reqs.push(c);
    if (/^\/affaires/.test(c)) return [];
    if (/^\/affaire_types/.test(c)) return [];
    return []; } };
  await A2.charger();
  t('la lecture demande etape_le et type_id, puis le delai des types (sommeil_jours)',
    reqs.some(c => /^\/affaires\?select=[^&]*etape_le/.test(c) && /type_id/.test(c))
    && reqs.some(c => /^\/affaire_types\?select=type_id,sommeil_jours(,nom)?&bureau=eq\.b1/.test(c)), reqs.join(' ; '));
}

/* ----------------------------------------------------------------------------
   LOT 45, PARTIE B, 29/09/2026 : UN CLIENT, UNE FOIS. Un client en affaire sort de
   « Clients a suivre » ; sa raison le suit dans « A gagner » : etiquette `.motif` sur
   la ligne et la carte kanban, phrase « Ce que disent tes ventes » dans le panneau.
   Lue par `bdvMotifClient` (moteur des ventes), jamais chargee pour elle : sans
   moteur, sans Vitisoft, ou pour un nouveau client, rien. `bdv:clients` repeint la
   piece si une etiquette change ; le panneau ne change que si son sujet change.
   Verifie par mutation le 29/09/2026.
   ---------------------------------------------------------------------------- */
titre('Lot 45 : la raison du client suit son affaire');
{
  const F = monter();
  F.w.BdvTiroir = { actif: () => true, poser: () => true, retirer: () => {} };
  let viti = true;
  F.w.BdvNav = { avecVitisoft: () => viti };
  F.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste / restaurant', famille: 'conquete', sommeil_jours: 30, ordre: 0, archive: false });
  F.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 });
  F.base.pistes.push({ bureau: BUREAU, piste_id: 'pN', nom: 'Cave Neuve', opposition: false },
                     { bureau: BUREAU, piste_id: 'pC', nom: 'Cave Devenue Cliente', client_id: 'C9', opposition: false });
  const jour = new Date().toISOString();
  F.base.affaires.push(
    { bureau: BUREAU, affaire_id: 'aC', type_id: 't1', etape_id: 'e1', client_id: 'C7', client_nom: 'Chez Paul', titre: 'Le rosé', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour },
    { bureau: BUREAU, affaire_id: 'aX', type_id: 't1', etape_id: 'e1', client_id: 'C8', client_nom: 'Chez Rien', titre: 'Le blanc', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour },
    { bureau: BUREAU, affaire_id: 'aN', type_id: 't1', etape_id: 'e1', piste_id: 'pN', titre: 'Cave Neuve', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour },
    { bureau: BUREAU, affaire_id: 'aP', type_id: 't1', etape_id: 'e1', piste_id: 'pC', titre: 'Cave Devenue Cliente', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour });
  t('avant la lecture, clientsEnAffaire() rend null (on ne sait pas)', F.w.BdvAffairesJour.clientsEnAffaire() === null);
  await F.w.BdvAffaires.ouvrir();
  const enA = F.w.BdvAffairesJour.clientsEnAffaire();
  t('clientsEnAffaire() : les clients par leur numero ET la piste devenue cliente, pas la piste neuve',
    !!enA && enA.has('C7') && enA.has('C8') && enA.has('C9') && enA.size === 3, enA && [...enA].join(','));
  /* M1 (01/10/2026) : le moteur ne part QUE de la recherche d'un client (demanderLignes),
     jamais pour la raison d'une affaire ni a l'ouverture de la piece. */
  t('la piece ne charge jamais le moteur des ventes pour la raison',
    !/demarrerEcransVente/.test(SRC)
    /* 03/10/2026 : un second appel, et un seul, dans `fichePage()` : la pleine page d'une
       affaire client lit trois lignes de ses ventes (« Avant de l'appeler »). Jamais le panneau. */
    && (SRC.replace(/\/\*[\s\S]*?\*\//g, '').match(/BdvNav\.chargerEcrans\(\)/g) || []).length === 2
    && /function fichePage\(a\) \{[\s\S]{0,400}BdvNav\.chargerEcrans\(\)/.test(SRC)
    && /function demanderLignes\(\) \{[\s\S]{0,400}BdvNav\.chargerEcrans\(\)/.test(SRC)
    && !/async function ouvrir\(\) \{[\s\S]{0,1500}demanderLignes/.test(SRC));
  const lig = (id) => F.doc.querySelector('#affCorps [data-affaire="' + id + '"]');
  const eti = (id) => { const l = lig(id); return l ? [...l.querySelectorAll('.aff-motif')].map(n => n.textContent).join('|') : 'ABSENTE'; };
  t('moteur pas charge : aucune etiquette', !F.doc.querySelector('#affCorps .aff-motif'));

  const MOT = {
    C7: { label: 'Recul confirmé', cls: 'm-recul', montant: 1234, lib: 'perdus à date égale', detail: '2 000 € en 2025, 766 € en 2026 à date égale', enjeu: '1 234 € perdus à date égale' },
    C9: { label: 'Retard de cadence', cls: 'm-cadence', montant: 800, lib: 'achetés au total', detail: 'commande tous les 30 j, rien depuis 3 mois', enjeu: '800 € achetés au total' },
    pN: { label: 'NE DOIT PAS SORTIR', cls: 'm-recul' }
  };
  const vus = [];
  F.w.bdvMotifClient = (id) => { vus.push(id); return MOT[id] || null; };
  F.doc.dispatchEvent(new F.w.CustomEvent('bdv:clients'));
  t('bdv:clients : la ligne d\'un client en recul porte « Recul confirmé »', eti('aC') === 'Recul confirmé', eti('aC'));
  t('en toutes lettres, dans une etiquette .motif a l\'encre du motif',
    !!lig('aC').querySelector('.motif.aff-motif.m-recul'));
  t('la piste devenue cliente porte sa raison a elle (autre motif)', eti('aP') === 'Retard de cadence', eti('aP'));
  t('un client sans raison : pas d\'etiquette', eti('aX') === '', eti('aX'));
  t('un nouveau client : pas d\'etiquette, et on ne le demande meme pas', eti('aN') === '' && vus.indexOf('pN') < 0, vus.join(','));
  t('aucun montant sur la ligne', !/€/.test(lig('aC').textContent));

  /* Le panneau : la phrase, et elle ne bouge pas tant que le sujet reste le meme. */
  F.clic('#affCorps [data-affaire="aC"] [data-aff="ouvrir"]');
  const phrase = () => ((F.doc.querySelector('#affaireModale .amod__ventes') || {}).textContent || '');
  t('le panneau dit « Ce que disent tes ventes : Recul confirmé, 1 234 € perdus à date égale (...) »',
    phrase() === 'Ce que disent tes ventes : Recul confirmé, 1 234 € perdus à date égale (2 000 € en 2025, 766 € en 2026 à date égale).', phrase());
  t('la phrase est sous l\'etat de l\'affaire',
    !!F.doc.querySelector('#affaireModale .amod__etat + .amod__ventes'));
  MOT.C7 = Object.assign({}, MOT.C7, { label: 'Deuxième achat à jouer', cls: 'm-premier' });
  F.doc.dispatchEvent(new F.w.CustomEvent('bdv:clients'));
  t('bdv:clients repeint l\'etiquette de la ligne', eti('aC') === 'Deuxième achat à jouer', eti('aC'));
  t('mais pas le panneau ouvert sur le meme sujet', /Recul confirmé/.test(phrase()), phrase());
  F.clic('#affaireModale .tmod__x');
  F.clic('#affCorps [data-affaire="aX"] [data-aff="ouvrir"]');
  t('une affaire sans raison connue : pas de phrase', !F.doc.querySelector('#affaireModale .amod__ventes'));
  F.clic('#affaireModale .tmod__x');

  /* Le focus : repeindre sous le doigt le rend au meme geste de la meme affaire. */
  F.doc.querySelector('#affCorps [data-affaire="aP"] [data-aff="ouvrir"]').focus();
  MOT.C9 = Object.assign({}, MOT.C9, { label: 'Sa saison arrive' });
  F.doc.dispatchEvent(new F.w.CustomEvent('bdv:clients'));
  const act = F.doc.activeElement;
  t('apres un repeint sur bdv:clients, le focus est rendu au meme geste',
    eti('aP') === 'Sa saison arrive' && act && act.getAttribute('data-aff') === 'ouvrir' && act.closest('[data-affaire]').getAttribute('data-affaire') === 'aP',
    eti('aP') + ' / ' + (act && act.outerHTML.slice(0, 60)));
  const avant = F.doc.getElementById('affCorps').innerHTML;
  F.doc.dispatchEvent(new F.w.CustomEvent('bdv:clients'));
  t('rien n\'a change : pas de repeint', F.doc.querySelector('#affCorps [data-affaire="aP"] [data-aff="ouvrir"]') === act && F.doc.getElementById('affCorps').innerHTML === avant);

  /* La carte kanban. */
  F.w.BdvAffaires._S.vue = 'kanban'; F.w.BdvAffaires._S.filtre = 't1';
  await F.w.BdvAffaires.ouvrir();
  const carte = F.doc.querySelector('#affCorps .aff-carte[data-affaire="aC"]');
  t('la carte kanban porte l\'etiquette seule', !!carte && [...carte.querySelectorAll('.aff-motif')].map(n => n.textContent).join('|') === 'Deuxième achat à jouer' && !/€/.test(carte.textContent),
    carte && carte.textContent);
  t('et la carte du nouveau client n\'en porte pas', !F.doc.querySelector('#affCorps .aff-carte[data-affaire="aN"] .aff-motif'));
  /* Sans Vitisoft : pas de fiche, pas de raison. */
  viti = false;
  F.w.BdvAffaires._S.vue = 'liste';
  await F.w.BdvAffaires.ouvrir();
  t('sans Vitisoft : aucune etiquette', !F.doc.querySelector('#affCorps .aff-motif'));
  t('pas de tiret cadratin', !/—/.test(F.doc.body.textContent));
}

titre('Lot 47 : « Nouveau devis » est un vrai bouton, et la liste des devis de l\'affaire');
{
  const F = monter();
  const appels = { poser: [], retirer: 0, ordre: [] };
  F.w.BdvTiroir = { actif: () => true,
    poser: (b) => { appels.poser.push(b); appels.ordre.push('poser:' + (b.closest('#devisModale') ? 'devis' : 'affaire')); return true; },
    retirer: () => { appels.retirer++; appels.ordre.push('retirer'); } };
  F.w.BdvNav = { avecVitisoft: () => true };
  /* Le calcul (euros) est pose par le chargeur ; jsdom ne charge pas les <script src>,
     le harnais le pose donc lui-meme, comme la page le ferait au premier panneau. */
  F.w.eval(fs.readFileSync(path.join(RACINE, 'src/js/bdv-devis-calcul.js'), 'utf8'));
  const ouverts = [];
  F.w.BdvDevis = { ouvrir: (ctx) => { appels.ordre.push('ouvrir'); ouverts.push(ctx); } };
  F.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste / restaurant', famille: 'conquete', sommeil_jours: 30, ordre: 0, archive: false });
  F.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 });
  F.base.pistes.push({ bureau: BUREAU, piste_id: 'pN', nom: 'Cave Neuve', opposition: false });
  F.base.devis = [
    { bureau: BUREAU, devis_id: 'd7', affaire_id: 'aC', numero: 'D-2026-0007', statut: 'enregistre', total_ttc_c: 124000, total_ht_c: 103333, date_devis: '2026-09-30' },
    { bureau: BUREAU, devis_id: 'd3', affaire_id: 'aC', numero: 'D-2026-0003', statut: 'abandonne', total_ttc_c: 5000, total_ht_c: 4167, date_devis: '2026-09-12' },
    { bureau: BUREAU, devis_id: 'dX', affaire_id: 'aN', numero: 'D-2026-0009', statut: 'enregistre', total_ttc_c: 100, date_devis: '2026-09-29' },
    { bureau: BUREAU, devis_id: 'dG', affaire_id: 'aG', numero: 'D-2026-0004', statut: 'enregistre', total_ttc_c: 9900, total_ht_c: 8250, date_devis: '2026-09-20' }];
  const jour = new Date().toISOString();
  F.base.affaires.push(
    { bureau: BUREAU, affaire_id: 'aC', type_id: 't1', etape_id: 'e1', client_id: 'C7', client_nom: 'Chez Paul', titre: 'Le rosé', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour },
    { bureau: BUREAU, affaire_id: 'aN', type_id: 't1', etape_id: 'e1', piste_id: 'pN', titre: 'Cave Neuve', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour },
    { bureau: BUREAU, affaire_id: 'aG', type_id: 't1', etape_id: 'e1', client_id: 'C8', client_nom: 'Le Bistrot', titre: 'Le blanc', issue: 'gagnee', close_le: jour, etape_le: jour });
  await F.w.BdvAffaires.ouvrir();
  const panneau = () => F.doc.getElementById('affaireModale');
  const devis = () => panneau() && !panneau().hidden ? panneau().querySelector('[data-aff="devis"]') : null;
  let ouvrirAff = async (id) => { if (panneau() && !panneau().hidden) F.clic('#affaireModale .tmod__x'); F.clic('#affCorps [data-affaire="' + id + '"] [data-aff="ouvrir"]'); await attendre(20); };
  const stockes = [];
  const P = F.w.Storage.prototype, setI = P.setItem;
  P.setItem = function (k, v) { stockes.push('set:' + k); return setI.call(this, k, v); };

  await ouvrirAff('aC');
  const b = devis();
  t('affaire en cours chez un client : « Nouveau devis » est un vrai bouton', !!b && b.textContent.trim() === 'Nouveau devis' && b.classList.contains('btn'), b && b.outerHTML);
  t('plus d\'aria-disabled, plus de btn--bientot, plus de mot « bientôt »', !!b && !b.hasAttribute('aria-disabled') && !b.disabled
    && !b.classList.contains('btn--bientot') && !panneau().querySelector('.btn__bientot') && !/bientôt|Bientôt/.test(panneau().textContent));
  t('il n\'est pas un bouton plein : « Enregistrer » reste le geste principal', !!b && !b.classList.contains('btn--bordeaux'));
  { const f = panneau().querySelector('form.aff-edit'), kids = f ? [...f.children] : [];
    const iP = kids.findIndex(n => n.classList.contains('aff-form__pied')), iD = kids.findIndex(n => n.classList.contains('aff-devis')),
      iC = kids.findIndex(n => n.classList.contains('aff-conclure'));
    t('place : sous « Enregistrer », au-dessus de « Gagnée », dans son propre bloc', iP >= 0 && iD === iP + 1 && iC === iD + 1, [iP, iD, iC].join(','));
    t('« Enregistrer » reste le seul bouton plein du pied', f && f.querySelectorAll('.aff-form__pied .btn--bordeaux').length === 1 && !f.querySelector('.aff-form__pied [data-aff="devis"]')); }
  const lecture = F.requetes.filter(r => /^\/devis\?/.test(r.chemin)).pop();
  t('la liste des devis est lue pour CE bureau et CETTE affaire', !!lecture && lecture.chemin === '/devis?bureau=eq.' + BUREAU + '&affaire_id=eq.aC&order=cree_le.desc', lecture && lecture.chemin);
  const lis = [...panneau().querySelectorAll('#affDevisListe li')];
  t('le bloc liste les devis de l\'affaire, et seulement eux', lis.length === 2, lis.length);
  /* V3 et S11 (01/10/2026) : une carte qui porte sa porte, le montant en HT comme partout,
     chaque date nommee. */
  const sp = (x) => String(x || '').replace(/[\u00a0\u202f]/g, ' ');
  t('V3 : la carte du devis porte « Ouvrir le devis D-2026-0007 »', !!lis[0] && !!lis[0].querySelector('button.btn[data-aff="devisOuvrir"]')
    && lis[0].querySelector('button').textContent === 'Ouvrir le devis D-2026-0007', lis[0] && lis[0].innerHTML);
  t('S11 : chaque date est nommee, et le montant est en HT : « du 30/09/2026, pas encore envoyé, 1 033,33 € HT »',
    !!lis[0] && sp((lis[0].querySelector('.aff-devis__detail') || {}).textContent) === 'du 30/09/2026, pas encore envoyé, 1 033,33 € HT' && !/TTC/.test(panneau().querySelector('.aff-devis').textContent),
    lis[0] && JSON.stringify(sp(lis[0].textContent)));
  t('V3 : la liste des devis est AU-DESSUS de « Nouveau devis »', (() => { const blk = panneau().querySelector('.aff-devis'), k = blk ? [...blk.children] : [];
    return k.findIndex(n => n.id === 'affDevisListe') >= 0 && k.findIndex(n => n.id === 'affDevisListe') < k.findIndex(n => n.getAttribute('data-aff') === 'devis'); })());
  t('un devis abandonne : numero barre et le mot « abandonné »', !!lis[1] && !!lis[1].querySelector('s') && lis[1].querySelector('s').textContent === 'D-2026-0003'
    && /abandonné/.test(lis[1].textContent), lis[1] && lis[1].innerHTML);
  t('chaque devis est un bouton qui le rouvre', lis.every(li => li.querySelector('button[data-aff="devisOuvrir"]')));

  const ecr = F.requetes.filter(r => r.methode !== 'GET').length; stockes.length = 0;
  const avantOrdre = appels.ordre.length;
  b.click();
  await attendre(20);
  const o = ouverts[0];
  t('un appui ouvre le devis : la boite de l\'affaire est RETIREE avant que celle du devis se pose',
    JSON.stringify(appels.ordre.slice(avantOrdre)) === JSON.stringify(['retirer', 'ouvrir']) && panneau().hidden, JSON.stringify(appels.ordre.slice(avantOrdre)));
  t('le devis recoit le bureau, l\'affaire, le client, et aucun devis (neuf)', !!o && o.bureau === BUREAU && o.affaire.affaire_id === 'aC'
    && o.sujet === 'Chez Paul' && o.nouveau === false && o.devis === null, o && JSON.stringify(o));
  t('rien n\'est ecrit par l\'affaire : le devis enregistre ne donne pas de montant', F.requetes.filter(r => r.methode !== 'GET').length === ecr && stockes.length === 0,
    F.requetes.filter(r => r.methode !== 'GET').map(r => r.methode + ' ' + r.chemin).join(' ; ') + ' ' + stockes.join(' '));
  const vus = [];
  F.w.Element.prototype.scrollIntoView = function (op) { vus.push({ n: this, op }); };
  o.retour(null);
  t('« Retour à l’affaire » (devis pas enregistre) : focus sur « Nouveau devis » du panneau rouvert, jamais body',
    F.doc.activeElement === panneau().querySelector('[data-aff="devis"]'), F.doc.activeElement && F.doc.activeElement.outerHTML.slice(0, 80));
  await attendre(20);
  t('« Retour à l’affaire » rouvre son panneau, par BdvTiroir', !panneau().hidden && /Chez Paul/.test(panneau().querySelector('#amodTitre').textContent)
    && appels.ordre[appels.ordre.length - 1] === 'poser:affaire');
  F.clic('#affaireModale .tmod__x');
  F.clic('#affCorps [data-affaire="aC"] [data-aff="ouvrir"]');
  await attendre(20);
  panneau().querySelector('[data-aff="devis"]').click();
  await attendre(20);
  vus.length = 0;
  ouverts[ouverts.length - 1].retour('d7');
  await attendre(30);
  const ligneD7 = panneau().querySelector('[data-aff="devisOuvrir"][data-devis="d7"]');
  t('« Retour à l’affaire » apres un devis : SA ligne recoit le focus et est ramenee dans la vue du panneau',
    !!ligneD7 && F.doc.activeElement === ligneD7 && vus.some(v => v.n.getAttribute && v.n.getAttribute('data-devis') === 'd7'), F.doc.activeElement && F.doc.activeElement.outerHTML.slice(0, 80));
  const sortie = ouverts[ouverts.length - 1].focusSortie();
  t('croix, Echap, « Compléter Mon domaine » : la sortie designe un element VIVANT (le bouton de la ligne de l\'affaire)',
    !!sortie && sortie.isConnected && sortie.getAttribute('data-aff') === 'ouvrir' && !!sortie.closest('[data-affaire="aC"]'));
  F.base.affaires.find(a => a.affaire_id === 'aC').titre = 'Le rosé';
  { const S0 = F.w.BdvAffaires._S; const sauve = S0.affaires; S0.affaires = sauve.filter(a => a.affaire_id !== 'aC');
    F.filtre('');
    const s2 = ouverts[ouverts.length - 1].focusSortie();
    t('ligne disparue : la sortie tombe sur le titre de la piece, rendu focalisable', !!s2 && s2.id === 'affTitre' && s2.getAttribute('tabindex') === '-1');
    S0.affaires = sauve; F.filtre(''); }
  ouvrirAff = ouvrirAff;
  panneau().querySelector('[data-aff="devisOuvrir"][data-devis="d7"]').click();
  await attendre(20);
  { const o2 = ouverts[ouverts.length - 1];
    t('rouvrir un devis de la liste : c\'est CE devis qui s\'ouvre', !!o2.devis && o2.devis.devis_id === 'd7' && o2.devis.numero === 'D-2026-0007'); }

  await ouvrirAff('aN');
  t('nouveau client (piste) : « Nouveau devis » aussi, un devis se fait a un prospect', !!devis() && !devis().hasAttribute('aria-disabled'));
  devis().click();
  await attendre(20);
  { const o3 = ouverts[ouverts.length - 1];
    t('et le devis sait que c\'est un nouveau client', o3.nouveau === true && o3.sujet === 'Cave Neuve' && o3.affaire.affaire_id === 'aN'); }

  /* Une affaire close ne s'ouvre pas dans le panneau par l'ecran : on l'y force. */
  F.w.BdvAffaires._S.ouverte = 'aG';
  F.filtre('');
  t('le panneau d\'une affaire close est bien peint (temoin du controle suivant)', !panneau().hidden && /Le Bistrot/.test(panneau().querySelector('#amodTitre').textContent));
  await attendre(20);
  t('affaire close (gagnée) : pas de « Nouveau devis »', !devis());
  t('mais la liste de ses devis reste, rouvrable', !!panneau().querySelector('.aff-devis [data-aff="devisOuvrir"][data-devis="dG"]'),
    (panneau().querySelector('.aff-devis') || {}).innerHTML);
  panneau().querySelector('[data-aff="devisOuvrir"][data-devis="dG"]').click();
  await attendre(20);
  t('et le devis d\'une affaire close s\'ouvre avec son issue (lecture seule cote devis)', ouverts[ouverts.length - 1].devis.devis_id === 'dG'
    && ouverts[ouverts.length - 1].affaire.issue === 'gagnee');
  /* Le chemin de l'ecran : « Ses devis » dans les affaires closes. */
  const sesDevis = F.doc.querySelector('#affCorps [data-affaire="aG"] [data-aff="devisClose"]');
  { const css = fs.readFileSync(path.join(RACINE, 'src/css/bdv-bureau.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const m = css.match(/([^{}]*)\{\s*position:relative;\s*z-index:1;\s*\}/g) || [];
    t('la liste des devis d\'une ligne close passe AU-DESSUS du calque ::after du nom (lot 44)',
      m.some(r => /\.bdv-coque \.aff-ligne \.aff-devis__liste/.test(r)) && /\.aff-ligne__qui::after\{[^}]*inset:0/.test(css.replace(/\s+/g, '')));
    t('dans le panneau, le bloc .aff-devis n\'est dans aucune ligne a calque', !panneau().querySelector('.aff-devis').closest('.aff-ligne')); }
  t('dans « affaires closes », chaque affaire a « Ses devis »', !!sesDevis && sesDevis.getAttribute('aria-expanded') === 'false');
  sesDevis.click();
  await attendre(20);
  const uc = F.doc.getElementById('affDevisC-aG');
  { const sm = (F.doc.querySelector('.aff-closes .aff-closes__bilan') || {}).textContent || '';
    t('X4 : le resume des closes ne colle pas deux nombres par une virgule, et le montant est au centime ou absent',
      /gagnée sur \d+(\u00a0· \d[\d\u00a0]*,\d\d\u00a0€\u00a0HT en devis acceptés)?$/.test(sm) && !/sur \d+, \d/.test(sm), JSON.stringify(sm)); }
  { const A = F.w.BdvAffaires, avant = A._S.devisResume;
    const aG = A._S.affaires.find(a => a.affaire_id === 'aG');
    A._S.devisResume = Object.assign({}, avant || {}, { aG: { statut: 'accepte', total_ht_c: 52680 } });
    const d = F.doc.createElement('div'); d.innerHTML = A._htmlCloses();
    const sm2 = (d.querySelector('.aff-closes__bilan') || {}).textContent || '';
    A._S.devisResume = avant;
    t('X4 : avec un devis accepte, « 1 gagnée sur N · 526,80 € HT en devis acceptés », insecables, au centime',
      !!aG && /^1\u00a0gagnée sur \d+\u00a0· 526,80\u00a0€\u00a0HT en devis acceptés$/.test(sm2), JSON.stringify(sm2)); }
  t('« Ses devis » deplie la liste de l\'affaire close, lue pour ce bureau', !!uc && !uc.hidden && /Ouvrir le devis D-2026-0004/.test(uc.textContent) && /du 20\/09\/2026, pas encore envoyé, 82,50 € HT/.test(uc.textContent.replace(/[\u00a0\u202f]/g, ' '))
    && F.requetes.some(r => r.chemin === '/devis?bureau=eq.' + BUREAU + '&affaire_id=eq.aG&order=cree_le.desc'), uc && uc.textContent);
  uc.querySelector('[data-aff="devisOuvrir"]').click();
  await attendre(20);
  t('et le devis s\'y rouvre', ouverts[ouverts.length - 1].devis.devis_id === 'dG');
  t('aucun onclick, aucun tiret cadratin', !/\sonclick=/.test(panneau().innerHTML) && !/—/.test(panneau().textContent));
  P.setItem = setI;
}
{
  /* LE CHARGEUR QUI ECHOUE : le vigneron reste sur son affaire, on le lui dit, et le
     clic suivant reessaie (la promesse ratee n'est pas retenue). */
  const G = monter();
  const appels = { retirer: 0 };
  G.w.BdvTiroir = { actif: () => true, poser: () => true, retirer: () => { appels.retirer++; } };
  G.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste / restaurant', famille: 'conquete', sommeil_jours: 30, ordre: 0, archive: false });
  G.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 });
  G.base.affaires.push({ bureau: BUREAU, affaire_id: 'aC', type_id: 't1', etape_id: 'e1', client_id: 'C7', client_nom: 'Chez Paul', issue: 'en_cours', rappel: '2099-01-01', etape_le: new Date().toISOString() });
  const poses = [];
  const ajout = G.w.Node.prototype.appendChild;
  G.doc.head.appendChild = function (n) {
    const r = ajout.call(this, n);
    poses.push(n.tagName === 'LINK' ? n.getAttribute('href') : n.getAttribute('src'));
    setTimeout(() => { if (n.tagName === 'LINK') n.onload && n.onload(); else n.onerror && n.onerror(); }, 0);
    return r;
  };
  await G.w.BdvAffaires.ouvrir();
  G.clic('#affCorps [data-affaire="aC"] [data-aff="ouvrir"]');
  await attendre(20);
  const r0 = appels.retirer;
  G.clic('#affaireModale [data-aff="devis"]');
  await attendre(30);
  const mot = G.doc.getElementById('affDevisMot');
  t('le chargeur pose la feuille du devis puis le calcul, au clic', poses.indexOf('/css/bdv-devis.css') >= 0 && poses.indexOf('/js/bdv-devis-calcul.js', poses.indexOf('/css/bdv-devis.css')) > poses.indexOf('/css/bdv-devis.css'), poses.join(' , '));
  t('piece introuvable : « Le devis ne s’est pas ouvert... », le panneau reste ouvert',
    !!mot && mot.textContent === 'Le devis ne s’est pas ouvert : vérifie ta connexion et réessaie.' && !G.doc.getElementById('affaireModale').hidden && appels.retirer === r0, mot && mot.textContent);
  const n0 = poses.length;
  G.clic('#affaireModale [data-aff="devis"]');
  await attendre(30);
  t('le clic suivant reessaie (la promesse ratee n\'est pas retenue)', poses.length > n0, poses.slice(n0).join(' , '));
}
{
  /* Le dessin : « Commande bientot » de la fiche garde son rendu (style.css pose
     `pointer-events:none` et une opacite de 0.45 sur tout `[aria-disabled="true"]`). */
  /* Le dessin : sans ce rendu, style.css (`[aria-disabled]` : pointer-events:none,
     opacite 0.45) mangerait l'appui et rendrait le mot illisible dehors. */
  const css = fs.readFileSync(path.join(RACINE, 'src/css/bdv-bureau.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const regle = (css.match(/\.bdv-coque \.btn--bientot\[aria-disabled="true"\]\s*\{([^}]*)\}/) || [])[1] || '';
  t('bdv-bureau.css rend l\'appui et l\'encre au bouton en attente', /pointer-events:\s*auto/.test(regle) && /opacity:\s*1\b/.test(regle) && /dashed/.test(regle), regle);
  t('sous 700 px, sa cible fait 44 px (le panneau n\'y passe que sous 620)',
    /@media\s*\(max-width:\s*700px\)\s*\{\s*\.bdv-coque \.btn--bientot\s*\{\s*min-height:\s*var\(--bdv-cible\)/.test(css));
}

titre('T4 (tour 3) : un geste du devis ne laisse pas un avis perime');
{
  const F = monter();
  F.w.BdvTiroir = { actif: () => true, poser: () => true, retirer: () => {} };
  F.w.BdvNav = { avecVitisoft: () => true };
  F.w.eval(fs.readFileSync(path.join(RACINE, 'src/js/bdv-devis-calcul.js'), 'utf8'));
  const ouverts = [];
  F.w.BdvDevis = { ouvrir: (ctx) => { ouverts.push(ctx); } };
  F.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste', famille: 'conquete', sommeil_jours: 30, ordre: 0, archive: false });
  F.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 });
  F.base.devis = [];
  const jour = new Date().toISOString();
  F.base.affaires.push({ bureau: BUREAU, affaire_id: 'aQ', type_id: 't1', etape_id: 'e1', client_id: 'C9', client_nom: 'Cave du Quai', titre: 'Le rosé', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour });
  await F.w.BdvAffaires.ouvrir();
  F.clic('#affCorps [data-affaire="aQ"] [data-aff="ouvrir"]'); await attendre(20);
  F.clic('#affaireModale [data-aff="devis"]'); await attendre(20);
  const av = F.doc.getElementById('affAvis');
  av.innerHTML = 'Affaire ouverte : Cave du Quai, rappel le 9 oct.'; av.hidden = false;
  const o = ouverts[0];
  t('T4 : le devis a recu son contexte', !!o && typeof o.change === 'function');
  o.change({ statut: 'enregistre' }); await attendre(20);
  t('T4 : un geste qui ne change pas l\'issue efface l\'avis perime', av.hidden && !/Affaire ouverte/.test(av.textContent), av.textContent);
  av.innerHTML = 'Affaire ouverte : Cave du Quai, rappel le 9 oct.'; av.hidden = false;
  F.base.affaires[0].issue = 'perdue'; F.base.affaires[0].motif = 'prix'; F.base.affaires[0].close_le = jour;
  o.change({ statut: 'refuse', affaireClose: true }); await attendre(20);
  t('T4 : un refus qui clot l\'affaire remplace l\'avis par ce qui a change', !av.hidden && /Cave du Quai : l’affaire passe à « Pas pour cette fois »/.test(av.textContent) && !/Affaire ouverte/.test(av.textContent), av.textContent);
}

titre('Lot 50 : le montant de l\'affaire se LIT dans son devis envoye ou accepte');
{
  const F = monter();
  F.w.BdvNav = { avecVitisoft: () => true };
  F.w.eval(fs.readFileSync(path.join(RACINE, 'src/js/bdv-devis-calcul.js'), 'utf8'));
  F.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste / restaurant', famille: 'conquete', sommeil_jours: 30, ordre: 0, archive: false });
  F.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 },
    { bureau: BUREAU, etape_id: 'e2', type_id: 't1', nom: 'Devis envoyé', ordre: 2 });
  const jour = new Date().toISOString();
  F.base.affaires.push(
    { bureau: BUREAU, affaire_id: 'a1', type_id: 't1', etape_id: 'e1', client_id: 'C1', client_nom: 'Chez Paul', titre: 'Le rosé', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour },
    { bureau: BUREAU, affaire_id: 'a2', type_id: 't1', etape_id: 'e1', client_id: 'C2', client_nom: 'Le Quai', titre: 'Le blanc', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour },
    { bureau: BUREAU, affaire_id: 'a3', type_id: 't1', etape_id: 'e1', client_id: 'C3', client_nom: 'Sans devis', titre: 'Rien', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour },
    { bureau: BUREAU, affaire_id: 'a4', type_id: 't1', etape_id: 'e1', client_id: 'C4', client_nom: 'Accord', titre: 'Le rouge', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour });
  F.base.devis = [
    { bureau: BUREAU, affaire_id: 'a1', devis_id: 'd1', numero: 'D-2026-0011', statut: 'envoye', total_ht_c: 124000, envoye_le: '2026-09-30', valable_jusqu: '2099-01-01', cree_le: '2026-09-30T08:00:00Z' },
    { bureau: BUREAU, affaire_id: 'a2', devis_id: 'd2', numero: 'D-2026-0012', statut: 'envoye', total_ht_c: 50000, envoye_le: '2026-01-03', valable_jusqu: '2026-02-01', cree_le: '2026-01-02T08:00:00Z' },
    { bureau: BUREAU, affaire_id: 'a3', devis_id: 'd3', numero: 'D-2026-0013', statut: 'enregistre', total_ht_c: 999900, cree_le: '2026-09-30T08:00:00Z' },
    /* dans l'ordre de la lecture, cree_le decroissant : l'envoye plus recent arrive AVANT l'accepte */
    { bureau: BUREAU, affaire_id: 'a4', devis_id: 'd5', numero: 'D-2026-0015', statut: 'envoye', total_ht_c: 70000, envoye_le: '2026-09-29', valable_jusqu: '2099-01-01', cree_le: '2026-09-29T08:00:00Z' },
    { bureau: BUREAU, affaire_id: 'a4', devis_id: 'd4', numero: 'D-2026-0014', statut: 'accepte', total_ht_c: 30000, envoye_le: '2026-09-20', valable_jusqu: '2099-01-01', cree_le: '2026-09-20T08:00:00Z' }];
  await F.w.BdvAffaires.ouvrir();
  /* Lot 55 : la lecture des devis signes (bdv-affaires-jour.js) n'est pas celle des montants ;
     lot 57 : celle des nouvelles (signe_le=gte.) non plus. */
  const lec = F.requetes.filter(r => /^\/devis\?select=/.test(r.chemin) && !/signe_le=(not\.is\.null|gte\.)/.test(r.chemin));
  t('les montants sont lus UNE fois, pour CE bureau, devis envoyes ou acceptes seulement',
    lec.length >= 1 && lec.every(r => r.chemin.indexOf('bureau=eq.' + BUREAU) >= 0 && /statut=in\.\(envoye,accepte\)/.test(r.chemin)), lec.map(r => r.chemin).join(' ; '));
  const tx = F.doc.getElementById('affCorps').textContent;
  t('« En devis envoyé : 1 740,00 € HT, sur 2 affaires (dont 1 expiré, à relancer ou refaire) »',
    /En devis envoyé : 1[\s\u00a0\u202f]?740,00[\s\u00a0]€[\s\u00a0]HT, sur 2 affaires \(dont 1 expiré, à relancer ou refaire\)\./.test(tx), (tx.match(/En devis envoyé[^.]*\./) || [''])[0]);
  t('un devis enregistre (pas envoye) ne compte pas : ni 9 999 €, ni dans le total', !/9\s?999/.test(tx.replace(/[  ]/g, ' ')));
  const ligne = (id) => (F.doc.querySelector('#affCorps [data-affaire="' + id + '"]') || {}).textContent || '';
  t('la ligne dit le numero, « envoyé », la validite et le montant', /Devis D-2026-0011 envoyé, valable jusqu’au .*1\s?240,00 € HT/.test(ligne('a1').replace(/[  ]/g, ' ')), ligne('a1'));
  t('un devis expire le dit en gras', /expiré le/.test(ligne('a2')) && !!F.doc.querySelector('#affCorps [data-affaire="a2"] b'), ligne('a2'));
  t('le devis accepte l\'emporte sur un envoye plus recent', /D-2026-0014 accepté, 300,00 € HT/.test(ligne('a4').replace(/[  ]/g, ' ')), ligne('a4'));
  t('une affaire sans devis envoye ne porte aucun montant', !/€ HT/.test(ligne('a3')), ligne('a3'));
  const G = monter();
  G.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste', famille: 'conquete', sommeil_jours: 30, ordre: 0, archive: false });
  G.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 });
  G.base.affaires.push({ bureau: BUREAU, affaire_id: 'a1', type_id: 't1', etape_id: 'e1', client_id: 'C1', client_nom: 'Chez Paul', titre: 'x', issue: 'en_cours', rappel: '2099-01-01', etape_le: jour });
  /* pas de table devis : la lecture leve, comme avant le SQL du lot 50. Une absence n'est pas un zero. */
  await G.w.BdvAffaires.ouvrir();
  t('montants illisibles : la piece se tait, aucun « 0 € »', !/€ HT|En devis envoyé/.test(G.doc.getElementById('affCorps').textContent));
}

/* ---------------------------------------------------------------------------
   PASSE DU 01/10/2026 (devA) : ce que le verificateur mecanique, le verificateur de
   saisie, la base et le vigneron ont trouve dans « A gagner ». Chaque controle vise UN
   defaut nomme ; tous verifies en remettant le defaut (voir le rapport du lot).
   --------------------------------------------------------------------------- */
titre('Passe du 01/10/2026 : A gagner');
{
  const garnir = (X, extra) => {
    X.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste', famille: 'conquete', sommeil_jours: 30, ordre: 0, archive: false });
    X.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 },
                               { bureau: BUREAU, etape_id: 'e2', type_id: 't1', nom: 'Premier contact', ordre: 2 });
    (extra || []).forEach(a => X.base.affaires.push(Object.assign({ bureau: BUREAU, type_id: 't1', etape_id: 'e1', issue: 'en_cours',
      rappel: '2099-01-01', etape_le: new Date().toISOString() }, a)));
  };
  /* Un serveur qui tombe a la demande : `panne(fn)` decide, requete par requete. */
  const pannes = (X) => { const api = X.w.BdvCompte.api; let f = null;
    X.w.BdvCompte.api = async (c, o) => { if (f && f(c, o || {})) { const e = new Error('refus'); e.detail = 'panne du banc'; throw e; } return api(c, o); };
    return (fn) => { f = fn; }; };
  const pan = (X) => X.doc.getElementById('affaireModale');
  const av = (X) => (X.doc.getElementById('amodAvis') || {}).textContent || '';

  /* S2 */
  const A = monter(); garnir(A, [{ affaire_id: 'a1', piste_id: 'p1', titre: 'Cave du Port' }]);
  A.base.pistes.push({ bureau: BUREAU, piste_id: 'p1', nom: 'Cave du Port', opposition: false });
  await A.w.BdvAffaires.ouvrir();
  A.clic('[data-aff="nouvelle"]');
  A.doc.getElementById('affForme').dispatchEvent(new A.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(10);
  t('S2 : un avis s\'affiche dans le panneau (choisir le client)', /Choisis le client/.test(av(A)));
  A.clic('#affaireModale .tmod__x');
  A.clic('[data-aff="nouvelle"]');
  t('S2 : rouvert, le panneau part avec un avis VIDE', !/Choisis le client/.test(av(A)) && A.doc.getElementById('amodAvis').hidden);
  A.clic('#affaireModale .tmod__x');
  /* En tiroir le panneau reste ouvert d'un sujet a l'autre : l'avis ne suit pas. */
  A.w.BdvTiroir = { actif: () => true, poser: () => true, retirer: () => {} };
  A.clic('[data-aff="nouvelle"]');
  A.doc.getElementById('affForme').dispatchEvent(new A.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(10);
  A.clic('#affCorps [data-affaire="a1"] [data-aff="ouvrir"]');
  t('S2 : en tiroir, passer a une affaire laisse l\'avis de la nouvelle derriere', !pan(A).hidden && !/Choisis le client/.test(av(A)));
  A.clic('#affaireModale .tmod__x');
  delete A.w.BdvTiroir;

  /* M7 : la croix rend le focus au bouton VIVANT de la ligne */
  A.clic('#affCorps [data-affaire="a1"] [data-aff="ouvrir"]');
  A.clic('#affaireModale .tmod__x');
  const fo = A.doc.activeElement;
  t('M7 : la croix rend le focus au bouton de la ligne, pas au corps de page',
    !!fo && fo.isConnected && fo.getAttribute('data-aff') === 'ouvrir' && !!fo.closest('[data-affaire="a1"]'), fo && fo.outerHTML.slice(0, 80));

  /* V5, V18, S9 : le contact en clair, l'adresse repliee, des claviers de chiffres */
  A.clic('[data-aff="nouvelle"]');
  { const q = A.doc.getElementById('affCherche'); q.value = 'X'.repeat(130); q.dispatchEvent(new A.w.Event('input', { bubbles: true })); }
  A.clic('[data-aff="creerMain"]');
  t('C2 : un nom de 130 signes est coupe a 120 a la pose', A.doc.getElementById('affNom').value.length === 120, A.doc.getElementById('affNom').value.length);
  t('V5 : le telephone se note en clair, hors du repli', !!A.doc.getElementById('affTel') && !A.doc.getElementById('affTel').closest('details'));
  t('V5 : SIRET et adresse sont dans un repli ferme', !!A.doc.getElementById('affSiret').closest('details#affAdresseRepli') && !A.doc.getElementById('affAdresseRepli').open);
  t('S9 : SIRET et code postal ouvrent le clavier des chiffres', A.doc.getElementById('affSiret').getAttribute('inputmode') === 'numeric'
    && A.doc.getElementById('affCp').getAttribute('inputmode') === 'numeric' && A.doc.getElementById('affCp').getAttribute('autocomplete') === 'postal-code');
  A.clic('#affaireModale .tmod__x');

  /* M2 : la fiche est creee, pas l'affaire ; le second essai ne la double pas */
  const M = monter(); garnir(M); const pM = pannes(M);
  await M.w.BdvAffaires.ouvrir();
  M.clic('[data-aff="nouvelle"]');
  { const q = M.doc.getElementById('affCherche'); q.value = 'Cave Neuve'; q.dispatchEvent(new M.w.Event('input', { bubbles: true })); }
  M.clic('[data-aff="creerMain"]');
  M.doc.getElementById('affTel').value = '0600000000';
  pM((c, o) => o.methode === 'POST' && /^\/affaires/.test(c));
  M.doc.getElementById('affForme').dispatchEvent(new M.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  /* N7 (tour 2) : depuis le lot 56 personne ne supprime une piste ; la fiche reste et l'avis le dit. */
  t('N7 : affaire refusee, la fiche reste et l\'avis le dit, sans tenter de la supprimer',
    M.base.pistes.length === 1 && !M.base.affaires.length && /La fiche de « Cave Neuve » est créée, pas l’affaire/.test(av(M))
    && !M.requetes.some(r => r.methode === 'DELETE'), av(M));
  pM((c, o) => (o.methode === 'POST' && /^\/affaires/.test(c)) || o.methode === 'DELETE');
  M.doc.getElementById('affForme').dispatchEvent(new M.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  t('M2 : piste ecrite, affaire refusee, retrait impossible : l\'avis le DIT', /est créée, pas l’affaire/.test(av(M)) && M.base.pistes.length === 1 && !M.base.affaires.length, av(M));
  t('M2 : le formulaire garde ce qui est tape', !pan(M).hidden && M.doc.getElementById('affTel') && M.doc.getElementById('affTel').value === '0600000000');
  pM(null);
  M.doc.getElementById('affForme').dispatchEvent(new M.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  t('M2 : le second essai reprend la fiche, sans la doubler', M.base.pistes.length === 1 && M.base.affaires.length === 1
    && M.base.affaires[0].piste_id === M.base.pistes[0].piste_id, M.base.pistes.length + ' / ' + M.base.affaires.length);
  t('M7 : apres creation, le focus revient a « Nouvelle affaire », d\'ou l\'on est parti',
    !!M.doc.activeElement && M.doc.activeElement.getAttribute('data-aff') === 'nouvelle' && M.doc.activeElement.isConnected);

  /* M3, M4, B3 */
  const E = monter(); garnir(E, [{ affaire_id: 'a1', piste_id: 'p1', titre: 'Cave du Port' }, { affaire_id: 'a2', piste_id: 'p2', titre: 'Chez Opposé' }]);
  E.base.pistes.push({ bureau: BUREAU, piste_id: 'p1', nom: 'Cave du Port', opposition: false, siret: null, adresse: null },
                     { bureau: BUREAU, piste_id: 'p2', nom: 'Chez Opposé', opposition: true, siret: null, adresse: null });
  const pE = pannes(E);
  await E.w.BdvAffaires.ouvrir();
  E.clic('#affCorps [data-affaire="a1"] [data-aff="ouvrir"]');
  let f = E.doc.querySelector('#affaireModale form.aff-edit');
  f.elements.notes.value = 'Il veut le magnum';
  pE((c, o) => o.methode === 'PATCH' && /^\/affaires/.test(c));
  f.dispatchEvent(new E.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  f = E.doc.querySelector('#affaireModale form.aff-edit');
  t('M3 : un echec d\'enregistrement n\'efface pas ce qui est tape', !!f && f.elements.notes.value === 'Il veut le magnum', f && f.elements.notes.value);
  pE(null);
  const avantPatch = E.requetes.filter(r => r.methode === 'PATCH').length;
  f.elements.p_siret.value = '12AB';
  f.dispatchEvent(new E.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  t('M4 : un SIRET faux est refuse AVANT toute ecriture', E.requetes.filter(r => r.methode === 'PATCH').length === avantPatch && /Rien n’a été enregistré/.test(av(E)), av(E));
  f = E.doc.querySelector('#affaireModale form.aff-edit');
  f.elements.p_siret.value = '';
  pE((c, o) => o.methode === 'PATCH' && /^\/pistes/.test(c));
  f.dispatchEvent(new E.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  t('M4 : l\'affaire passe, la fiche tombe : l\'avis dit ce qui est passe', /L’affaire est enregistrée, pas la fiche du client/.test(av(E)), av(E));
  pE(null);
  E.clic('#affaireModale .tmod__x');
  E.clic('#affCorps [data-affaire="a2"] [data-aff="ouvrir"]');
  const fo2 = E.doc.querySelector('#affaireModale form.aff-edit');
  t('B3 : une personne en opposition : ni coordonnees a ressaisir, ni « Ne plus la contacter »',
    !fo2.elements.p_telephone && !fo2.elements.p_email && !fo2.querySelector('[data-aff="opposition"]') && !fo2.querySelector('input'));

  /* M9 : annuler hors ligne recale l'ecran tout de suite */
  const N = monter(); garnir(N, [{ affaire_id: 'a1', client_id: 'C1', client_nom: 'Chez Paul', titre: 'x' }]); const pN = pannes(N);
  await N.w.BdvAffaires.ouvrir();
  N.w.BdvAffaires._deplacer('a1', 'e2');
  pN((c, o) => !o.methode || o.methode === 'GET');
  N.clic('[data-aff="annulerSuivante"]');
  await attendre(20);
  t('M9 : « Annuler » sans reseau : le panneau remontre l\'etape d\'avant',
    /Repéré/.test((pan(N).querySelector('.tmod__tampon') || {}).textContent || '') && !N.base.affaires[0].etape_id.includes('e2'));

  /* M11 : une relecture ratee le dit */
  N.clic('#affaireModale .tmod__x');
  await N.w.BdvAffaires.ouvrir();
  t('M11 : liste deja chargee, relecture ratee : « n’ont pas pu être lues à nouveau », et Reessayer',
    /n’ont pas pu être lues à nouveau/.test(N.doc.getElementById('affCorps').textContent) && !!N.doc.querySelector('#affCorps .aff-perime [data-aff="relire"]'));
  pN(null);
  await N.w.BdvAffaires.ouvrir();
  t('M11 : relue, l\'avis s\'en va', !N.doc.querySelector('#affCorps .aff-perime'));

  /* V6 : repousser d'un appui */
  const R = monter(); garnir(R, [{ affaire_id: 'a1', client_id: 'C1', client_nom: 'Chez Paul', titre: 'x', rappel: '2020-01-01', rappel_titre: 'Le tarif' }]);
  await R.w.BdvAffaires.ouvrir();
  R.clic('#affCorps [data-affaire="a1"] [data-aff="ouvrir"]');
  t('V6 : une affaire a relancer offre Demain, Dans 7 jours, Autre date',
    ['1', '7'].every(j => pan(R).querySelector('[data-aff="reporter"][data-jours="' + j + '"]')) && !!pan(R).querySelector('[data-aff="reporterDate"]'));
  R.clic('#affaireModale [data-aff="reporter"][data-jours="1"]');
  await attendre(20);
  const dem = new Date(); dem.setDate(dem.getDate() + 1);
  const iso = dem.getFullYear() + '-' + String(dem.getMonth() + 1).padStart(2, '0') + '-' + String(dem.getDate()).padStart(2, '0');
  t('V6 : « Demain » ecrit le rappel en un appui, et garde son motif', R.base.affaires[0].rappel === iso && R.base.affaires[0].rappel_titre === 'Le tarif', R.base.affaires[0].rappel);
  t('V6 : le champ de date du formulaire suit', pan(R).querySelector('form.aff-edit').elements.rappel.value === iso);
  t('V6 : le focus ne tombe pas sur le corps de page', pan(R).contains(R.doc.activeElement));
  const fourni = new Date(); fourni.setDate(fourni.getDate() + 30);
  R.base.affaires.push({ bureau: BUREAU, affaire_id: 'a9', type_id: 't1', etape_id: 'e1', issue: 'en_cours', client_id: 'C9', client_nom: 'Pas pressé', rappel: '2099-01-01', etape_le: new Date().toISOString() });
  await R.w.BdvAffaires.ouvrir();
  R.clic('#affaireModale .tmod__x');
  R.clic('#affCorps [data-affaire="a9"] [data-aff="ouvrir"]');
  t('V6 : on ne propose de repousser que ce qui presse', !pan(R).querySelector('[data-aff="reporter"]'));

  /* X10 (tour 3) : « Rappel posé demain et enregistré », et « Appeler » AVANT le report. */
  { const Q = monter(); garnir(Q, [{ affaire_id: 'a1', piste_id: 'p1', titre: 'x', rappel: '2020-01-01', rappel_titre: 'Le tarif' }]);
    Q.base.pistes.push({ bureau: BUREAU, piste_id: 'p1', nom: 'Cave du Port', telephone: '06 11 22 33 44', email: 'cave@port.fr', opposition: false });
    await Q.w.BdvAffaires.ouvrir();
    Q.clic('#affCorps [data-affaire="a1"] [data-aff="ouvrir"]');
    const P = pan(Q), tels = () => [...P.querySelectorAll('a[href^="tel:"]')].filter(n => !n.hidden);
    /* Y1 (tour 4) : l'ORDRE des gestes du panneau, du haut vers le bas, dans chaque etat. */
    const ordre = () => [...P.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], [data-aff="devisRaccourci"], [data-aff="reporter"], [data-aff="reporterDate"]')]
      .filter(n => !n.closest('[hidden]')).map(n => /^tel:/.test(n.getAttribute('href') || '') ? 'appeler' : /^mailto:/.test(n.getAttribute('href') || '') ? 'ecrire'
        : n.getAttribute('data-aff') === 'devisRaccourci' ? 'devis' : 'report').filter((x, i, l) => x !== 'report' || l[i - 1] !== 'report').join(',');
    t('Y1 : en retard, Appeler, Ecrire, Nouveau devis, puis la rangee de report', ordre() === 'appeler,ecrire,devis,report', ordre());
    t('Y1 : « Nouveau devis » est seul sur sa ligne, hors du groupe de report', !!P.querySelector('.amod__raccourci') && !P.querySelector('.amod__report [data-aff="devisRaccourci"], .amod__contacts [data-aff="devisRaccourci"]')
      && P.querySelector('.amod__raccourci').children.length === 1);
    t('X10 : un seul « Appeler » visible pendant que l\'affaire presse', tels().length === 1, tels().length);
    Q.clic('#affaireModale [data-aff="reporter"][data-jours="1"]');
    await attendre(20);
    t('X10 : « Rappel posé demain et enregistré : Le tarif. »', /^Rappel posé demain et enregistré : Le tarif\.$/.test(av(Q)), av(Q));
    t('X10 : la boite d\'etat dit la nouvelle date (plus en retard)', !/retard/i.test((P.querySelector('.amod__etat') || {}).textContent || '') && !P.querySelector('[data-aff="reporter"]'), (P.querySelector('.amod__etat') || {}).textContent);
    t('X10 : l\'affaire ne presse plus, « Appeler » reste a l\'ecran, une seule fois, a la meme place', tels().length === 1 && !!tels()[0].closest('.amod__contacts'), tels().length);
    t('Y1 : reportee, le MEME ordre (Appeler, Ecrire, Nouveau devis), sans la rangee de report', ordre() === 'appeler,ecrire,devis', ordre());
    { const rc = P.querySelector('.amod__raccourci [data-aff="devisRaccourci"]'), bas = P.querySelector('.aff-devis [data-aff="devis"]');
      t('X11 : la tete du panneau porte un raccourci « Nouveau devis », AVANT le formulaire', !!rc && !!bas && !!(rc.compareDocumentPosition(P.querySelector('form.aff-edit')) & 4));
      const css = fs.readFileSync(path.join(RACINE, 'src/css/bdv-bureau.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      /* 02/10/2026 : montre a TOUTES les largeurs (a 1440 celui du bas tombait hors de l'ecran) ; celui du bas se cache. */
      t('X11 : ... montre a toutes les largeurs, et celui du bas se cache', /\n\.bdv-coque \.amod__raccourci\{ display:block;/.test(css) && /\.bdv-coque \.amod \.aff-devis > \.btn\[data-aff="devis"\]\{ display:none; \}/.test(css));
      const ouv = []; Q.w.BdvDevis = { ouvrir: (ctx) => { ouv.push(ctx); } };
      Q.w.eval(fs.readFileSync(path.join(RACINE, 'src/js/bdv-devis-calcul.js'), 'utf8'));
      rc.click(); await attendre(30);
      t('X11 : le raccourci fait le meme geste que le bouton du bas : un devis NEUF pour cette affaire', ouv.length === 1 && ouv[0].affaire && ouv[0].affaire.affaire_id === 'a1' && !ouv[0].devis, JSON.stringify(ouv.map(o => [o.affaire && o.affaire.affaire_id, !!o.devis]))); }
    { const css = fs.readFileSync(path.join(RACINE, 'src/css/bdv-bureau.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      t('Y1 : le raccourci a un autre dessin que les boutons de report (lavis et encre de l\'accent)',
        /\.bdv-coque \.amod__raccourci \.btn\{[^}]*background:var\(--bdv-accent-lavis\);[^}]*color:var\(--bdv-accent\);/.test(css)); } }
  /* Y1 : une affaire EN COURS qui ne presse pas : le meme ordre, et aucun contact en double. */
  { const Q = monter(); garnir(Q, [{ affaire_id: 'a2', piste_id: 'p2', titre: 'y' }]);
    Q.base.pistes.push({ bureau: BUREAU, piste_id: 'p2', nom: 'Cave du Haut', telephone: '06 99 88 77 66', email: 'haut@cave.fr', opposition: false });
    await Q.w.BdvAffaires.ouvrir();
    Q.clic('#affCorps [data-affaire="a2"] [data-aff="ouvrir"]');
    const P = pan(Q);
    const ordre = [...P.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], [data-aff="devisRaccourci"], [data-aff="reporter"]')].filter(n => !n.closest('[hidden]'))
      .map(n => /^tel:/.test(n.getAttribute('href') || '') ? 'appeler' : /^mailto:/.test(n.getAttribute('href') || '') ? 'ecrire' : n.getAttribute('data-aff') === 'devisRaccourci' ? 'devis' : 'report').join(',');
    t('Y1 : en cours, le MEME ordre : Appeler, Ecrire, Nouveau devis', ordre === 'appeler,ecrire,devis', ordre);
    t('Y1 : les contacts ne sont plus dans le formulaire (un seul endroit)', !P.querySelector('form.aff-edit a[href^="tel:"], form.aff-edit a[href^="mailto:"]')); }

  /* S3 : en modale, Tab reste dans le panneau ; en tiroir, il en sort */
  const T = monter(); garnir(T, [{ affaire_id: 'a1', client_id: 'C1', client_nom: 'Chez Paul', titre: 'x' }]);
  let tiroir = false;
  T.w.BdvTiroir = { actif: () => tiroir, poser: () => tiroir, retirer: () => {} };
  await T.w.BdvAffaires.ouvrir();
  T.clic('#affCorps [data-affaire="a1"] [data-aff="ouvrir"]');
  const boite = pan(T).querySelector('.tmod__boite');
  const cib = [...boite.querySelectorAll('button,input,select,textarea,summary')].filter(n => !n.closest('[hidden]') && !(n.closest('details:not([open])') && n.tagName !== 'SUMMARY'));
  cib[cib.length - 1].focus();
  T.doc.dispatchEvent(new T.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  t('S3 : en modale, Tab depuis le dernier revient au premier', T.doc.activeElement === cib[0], T.doc.activeElement && T.doc.activeElement.outerHTML.slice(0, 60));
  tiroir = true;
  cib[cib.length - 1].focus();
  const ev = new T.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  T.doc.dispatchEvent(ev);
  t('S3 : en tiroir, Tab n\'est pas retenu', !ev.defaultPrevented);

  /* M7 : une repeinte de la piece rend le focus au geste repeint (ici un filtre) */
  T.doc.querySelector('#affCorps select[data-aff-filtre]').focus();
  T.filtre('t1');
  t('M7 : apres un filtre, le focus est sur la liste repeinte', T.doc.activeElement && T.doc.activeElement.hasAttribute('data-aff-filtre')
    && T.doc.activeElement.value === 't1' && T.doc.activeElement.isConnected);
  T.filtre('');

  /* 03/10/2026 : la liste « Type d'affaire » remplace les pastilles, a toutes les largeurs. */
  const sel = T.doc.querySelector('#affCorps select[data-aff-filtre]');
  t('la liste porte « Toutes » puis chaque type, avec « en cours »', !!sel && sel.options.length === 1 + T.w.BdvAffaires._S.types.filter(x => !x.archive).length
    && /en cours/.test(sel.options[0].textContent), sel && sel.options.length);
  t('plus aucune pastille de type dans la tete', !T.doc.querySelector('#affCorps .aff-tete .aff-chips, #affCorps [data-aff="filtre"]'));
  t('la liste a un libelle visible', /Type d’affaire/.test((T.doc.querySelector('#affCorps .aff-typeliste__l') || {}).textContent || ''));
  sel.value = 't1'; sel.dispatchEvent(new T.w.Event('change', { bubbles: true }));
  t('choisir un type dans la liste filtre la piece', T.w.BdvAffaires._S.filtre === 't1'
    && T.doc.querySelector('#affCorps select[data-aff-filtre]').value === 't1');

  /* M8 : ouvrir CETTE affaire depuis ailleurs */
  T.clic('#affaireModale .tmod__x');
  T.w.BdvAffairesJour.ouvrirPiece('a1');
  t('M8 : ouvrirPiece(id) pose la demande', T.w.sessionStorage.getItem('bdv_affaire_ouvrir') === 'a1');
  await T.w.BdvAffaires.ouvrir();
  t('M8 : et la piece ouvre CETTE affaire', !pan(T).hidden && pan(T).querySelector('#amodCorps').getAttribute('data-affaire') === 'a1');

  { const po = T.doc.createElement('div'); po.setAttribute('data-cle', 'affaire:a7');
    po.innerHTML = '<a href="#affaires">x</a>'; T.doc.body.appendChild(po);
    T.w.sessionStorage.removeItem('bdv_affaire_ouvrir');
    po.querySelector('a').dispatchEvent(new T.w.MouseEvent('click', { bubbles: true, cancelable: true }));
    t('M8 : la punaise d\'UNE affaire demande cette affaire', T.w.sessionStorage.getItem('bdv_affaire_ouvrir') === 'a7');
    T.w.sessionStorage.removeItem('bdv_affaire_ouvrir'); po.remove(); }

  /* M10 : un devis demande qui ne s'ouvre pas le dit, et n'est pas marque vu */
  const D = monter(); garnir(D, [{ affaire_id: 'aG', client_id: 'C1', client_nom: 'Chez Paul', titre: 'x', issue: 'gagnee' }]);
  D.base.devis = [];
  D.w.BdvDevisCalcul = { euros: (c) => String(c) };
  D.w.localStorage.setItem('bdv_signes_vus_v1', JSON.stringify(['dPerdu']));
  D.w.sessionStorage.setItem('bdv_devis_ouvrir', JSON.stringify({ affaire: 'aG', devis: 'dPerdu' }));
  await D.w.BdvAffaires.ouvrir();
  t('M10 : le devis demande introuvable : « Le devis n’a pas pu s’ouvrir »', /Le devis n’a pas pu s’ouvrir/.test(avis(D)), avis(D));
  t('M10 : marque vu au clic, il est DEMARQUE : le bandeau reviendra', !/dPerdu/.test(D.w.localStorage.getItem('bdv_signes_vus_v1') || ''));
  D.base.devis = [{ bureau: BUREAU, devis_id: 'dOk', affaire_id: 'aG', numero: 'D-2026-0001', statut: 'accepte', total_ttc_c: 100, total_ht_c: 83, date_devis: '2026-09-30' }];
  D.w.BdvDevis = { ouvrir: async () => {} };
  D.w.sessionStorage.setItem('bdv_devis_ouvrir', JSON.stringify({ affaire: 'aG', devis: 'dOk' }));
  await D.w.BdvAffaires.ouvrir();
  await attendre(20);
  t('M10 : un devis ouvert, lui, est marque vu', /dOk/.test(D.w.localStorage.getItem('bdv_signes_vus_v1') || ''));

  /* B6 : au-dela de 1 000 lignes, on lit par pages */
  const P6 = monter(); garnir(P6);
  for (let i = 0; i < 1005; i++) P6.base.affaires.push({ bureau: BUREAU, affaire_id: 'z' + String(i).padStart(4, '0'), type_id: 't1', etape_id: 'e1', issue: 'en_cours', client_id: 'C' + i, client_nom: 'C' + i, rappel: '2099-01-01', etape_le: new Date().toISOString() });
  { const api = P6.w.BdvCompte.api; P6.w.BdvCompte.api = async (c, o) => { const r = await api(c, o); const q = new URLSearchParams(c.split('?')[1] || '');
      if ((!o || !o.methode || o.methode === 'GET') && Array.isArray(r)) { const off = +(q.get('offset') || 0), lim = Math.min(+(q.get('limit') || 1000), 1000); return r.slice(off, off + lim); }
      return r; }; }
  await P6.w.BdvAffaires.ouvrir();
  t('B6 : 1 005 affaires, toutes lues (deux pages)', P6.w.BdvAffaires._S.affaires.length === 1005, P6.w.BdvAffaires._S.affaires.length);
  t('B6 : la lecture porte un ordre total et une borne', P6.requetes.some(r => /^\/affaires\?/.test(r.chemin) && /order=[^&]*affaire_id\.asc/.test(r.chemin) && /offset=1000/.test(r.chemin)));
  await P6.w.BdvAffairesJour.charger();
  t('B6 : Ma journee lit aussi les 1 005', P6.w.BdvAffairesJour.datees().length === 1005, P6.w.BdvAffairesJour.datees().length);

  /* M1 : « A gagner » ouvert sans le moteur voit quand meme les clients de l'export */
  const V = monter(); garnir(V);
  let charge = 0, finir;
  V.w.BdvNav = { avecVitisoft: () => true, chargerEcrans: () => { charge++;
    V.w.assurerLignes = () => new Promise(ok => { finir = () => { V.w.ROWS = [{ numClient: 'C42', client: 'Cave du Vieux Pressoir', ville: 'Nantes', _dayNum: 1 }]; ok(true); }; });
    return Promise.resolve(); } };
  await V.w.BdvAffaires.ouvrir();
  t('M1 : ouvrir la piece ne charge pas le moteur', charge === 0);
  V.clic('[data-aff="nouvelle"]');
  { const q = V.doc.getElementById('affCherche'); q.value = 'Vieux Pressoir'; q.dispatchEvent(new V.w.Event('input', { bubbles: true })); }
  await attendre(10);
  const props = () => (V.doc.getElementById('affPropositions') || {}).textContent || '';
  t('M1 : chercher un client charge le moteur, une fois', charge === 1);
  t('M1 : en attendant, la barre ne dit pas « aucun ne correspond »', /arrivent/.test(props()) && !/Aucun de tes clients/.test(props()), props());
  V.clic('[data-aff="creerMain"]');
  V.doc.getElementById('affForme').dispatchEvent(new V.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(10);
  t('M1 : tant que les clients arrivent, on ne cree pas un nouveau client', !V.base.pistes.length && /arrivent encore/.test(av(V)), av(V));
  V.clic('[data-aff="lacherNouveau"]');
  finir(); await attendre(20);
  { const q = V.doc.getElementById('affCherche'); q.value = 'Vieux Pressoir'; q.dispatchEvent(new V.w.Event('input', { bubbles: true })); }
  await attendre(10);
  t('M1 : les lignes arrivees, le client de l\'export est propose', /Cave du Vieux Pressoir/.test(props()), props());

  /* S12, S7, S8, S13, S19, V13, V14 : le dessin */
  t('S12 : « € HT » insecable', /'\\u00a0€\\u00a0HT'/.test(SRC));
  const CSS = fs.readFileSync(path.join(RACINE, 'src/css/bdv-bureau.css'), 'utf8');
  const q5 = CSS.split('31 quinquies')[1] || '';
  t('S7 : sous 700 px, « Déplacer vers » a 16 px', /max-width:700px[\s\S]*\.aff-carte__deplacer\{ font-size:var\(--bdv-f-saisie\); \}/.test(q5));
  t('V14 : une colonne vide se replie a 48 px', /\.aff-col--vide\{ flex:0 0 var\(--bdv-e-12\)/.test(q5) && /aff-col--vide/.test(SRC));
  /* 02/10/2026 : sous 700 px les colonnes s'empilent ; plus de tableau a faire glisser, plus de phrase. */
  t('le kanban s\'empile sous 700 px, sans phrase de glisse', /max-width:700px[\s\S]*\.aff-kanban\{ flex-direction:column;/.test(q5) && !/aff-kanban__glisse/.test(q5));
  t('S8 : un repli porte son signe', /\.aff-plus > summary::before\{/.test(q5) && /\.aff-plus\[open\] > summary::before/.test(q5));
  t('S13 : le cadre d\'etat va jusqu\'au bord', /\.amod__etat\{ margin-right:calc\(-1 \* var\(--bdv-e-8\)\); \}/.test(q5));
  { const q8 = CSS.split('33 ter.')[1] || '';
    t('la liste du type : dessin du selecteur de periode, 44 px et 16 px sous 700 px', /appearance:none/.test(q8) && /\.aff-typeliste__boite::after\{/.test(q8)
      && /max-width:700px[\s\S]*min-height:var\(--bdv-cible\); height:var\(--bdv-cible\);\s*font-size:var\(--bdv-f-saisie\);/.test(q8)); }
  t('V6 : sous 700 px, « Enregistrer » colle en pied', /\.amod \.aff-edit \.aff-form__pied\{\s*position:sticky;/.test(q5));
  t('aucune ombre et aucun z-index dans la passe', !/box-shadow|z-index/.test(q5.slice(q5.indexOf('*/') + 2).split('/* ===')[0].replace(/\/\*[\s\S]*?\*\//g, '')));
}

/* ---------------------------------------------------------------------------
   TOUR 2 (02/10/2026, devE) : N1, N3, N4, N7, N8, W1, W4, W6, W7, W13. Chaque controle
   vise un defaut nomme du juge ou du contre-verificateur ; verifies par mutation.
   --------------------------------------------------------------------------- */
titre('Tour 2 : opposition, doublon de SIRET, conclure, reporter');
{
  const garnir = (X, extra) => {
    X.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste', famille: 'conquete', sommeil_jours: 30, ordre: 0, archive: false });
    X.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 },
                               { bureau: BUREAU, etape_id: 'e2', type_id: 't1', nom: 'Premier contact', ordre: 2 });
    (extra || []).forEach(a => X.base.affaires.push(Object.assign({ bureau: BUREAU, type_id: 't1', etape_id: 'e1', issue: 'en_cours',
      rappel: '2099-01-01', etape_le: new Date().toISOString() }, a)));
  };
  const pan = (X) => X.doc.getElementById('affaireModale');
  const av = (X) => (X.doc.getElementById('amodAvis') || {}).textContent || '';
  const vieux = new Date(Date.now() - 50 * 86400000).toISOString();
  const O = monter();
  garnir(O, [{ affaire_id: 'a1', piste_id: 'p1', titre: 'Cave du Port', rappel: '2020-01-01' },
             { affaire_id: 'a2', piste_id: 'p2', titre: 'Bistrot des Halles', rappel: null, etape_le: vieux, notes: 'Vu au salon' }]);
  O.base.pistes.push({ bureau: BUREAU, piste_id: 'p1', nom: 'Cave du Port', opposition: false },
                     { bureau: BUREAU, piste_id: 'p2', nom: 'Bistrot des Halles', opposition: true, siret: '11122233300011', ville: 'Nantes' });
  await O.w.BdvAffaires.ouvrir();
  const corps = () => O.doc.getElementById('affCorps');
  t('N4 : l\'affaire en opposition sort de « A relancer » (1, pas 2)', /À relancer : 1/.test(corps().textContent), corps().textContent.slice(0, 200));
  t('N4 : la regle commune ne la compte pas', O.w.BdvAffairesJour.aRelancer().length === 1);
  t('N4 : ni dans la punaise de Ma journee', !/Bistrot/.test(JSON.stringify(O.w.BdvAffairesJour.punaises())));
  O.base.affaires.find(a => a.affaire_id === 'a2').rappel = '2020-01-02';
  await O.w.BdvAffaires.ouvrir();
  t('N4 : meme avec un rappel reste, ni calendrier ni Mes taches (datees)', O.w.BdvAffairesJour.datees().every(d => d.affaire_id !== 'a2'));
  t('N4 : ... ni « A relancer »', /À relancer : 1/.test(corps().textContent));
  const ligne = corps().querySelector('[data-affaire="a2"]');
  t('N4 : la ligne dit « Ne veut plus être contactée », sans « Endormie » ni « Etape suivante »',
    !!ligne && /Ne veut plus être contactée/.test(ligne.textContent) && !/ndormie|sans bouger/.test(ligne.textContent) && !ligne.querySelector('[data-aff="suivante"]'));
  t('N4 : elle passe en fin de liste', [...corps().querySelectorAll('[data-affaire]')].pop() === ligne);
  O.clic('#affCorps [data-affaire="a2"] [data-aff="ouvrir"]');
  const P = pan(O);
  t('N4 : le panneau le dit en premier, avec les mots du juge',
    /Bistrot des Halles a demandé à ne plus être contacté\. Ne le rappelle pas, ne lui envoie rien\./.test(O.doc.getElementById('amodTete').textContent));
  t('N4 : ni report, ni date de rappel, ni « Pour quoi faire », ni « Nouveau devis », ni etape',
    !P.querySelector('[data-aff="reporter"],[data-aff="reporterDate"],[name="rappel"],[name="rappel_titre"],[data-aff="devis"],[name="etape"],[data-aff="suivante"]'));
  t('N4 : un seul geste, « Classer l’affaire : Pas pour cette fois », et les notes se lisent',
    P.querySelectorAll('#amodCorps button').length === 1 && !!P.querySelector('[data-aff="classerOppose"]') && /Vu au salon/.test(P.textContent));
  O.w.BdvAffaires._deplacer('a2', 'e2');
  t('N4 : on ne la deplace pas, meme par le code', O.base.affaires.find(a => a.affaire_id === 'a2').etape_id === 'e1' && !O.w.BdvAffaires._S.attente);
  O.clic('[data-aff="classerOppose"]');
  await attendre(20);
  const a2 = O.base.affaires.find(a => a.affaire_id === 'a2');
  t('N4 : classer l\'affaire la passe en « Pas pour cette fois »', a2.issue === 'perdue' && a2.motif === 'autre', a2.issue + ' ' + a2.motif);
  t('T5 : la phrase ne propose pas de la rouvrir', /Classée\./.test(O.doc.getElementById('affAvis').textContent + av(O)) && !/rouvrir/.test(O.doc.getElementById('affAvis').textContent + av(O)),
    O.doc.getElementById('affAvis').textContent + ' | ' + av(O));
  a2.close_le = new Date().toISOString();
  await O.w.BdvAffaires.ouvrir();
  { const cl = corps().querySelector('.aff-closes [data-affaire="a2"]');
    t('T5 : dans les affaires closes, pas de « Rouvrir » pour elle, sa marque a la place', !!cl && !cl.querySelector('[data-aff="rouvrir"]') && /Ne veut plus être contactée/.test(cl.textContent),
      cl ? cl.innerHTML.slice(0, 200) : 'pas de ligne close'); }
  { const nP = O.requetes ? O.requetes.length : 0;
    const bt = O.doc.createElement('button'); bt.setAttribute('data-aff', 'rouvrir'); corps().querySelector('.aff-closes [data-affaire="a2"]').appendChild(bt); bt.click(); bt.remove();
    await attendre(20);
    t('T5 : meme force, « Rouvrir » ne la rouvre pas', O.base.affaires.find(a => a.affaire_id === 'a2').issue === 'perdue'); }
  /* Le kanban : la carte sans liste de deplacement, et pas glissable. */
  O.base.affaires.find(a => a.affaire_id === 'a2').issue = 'en_cours';
  O.w.BdvAffaires._S.vue = 'kanban';
  await O.w.BdvAffaires.ouvrir();
  const carte = O.doc.querySelector('.aff-carte[data-affaire="a2"]');
  t('N4 : dans le kanban, ni liste « Déplacer vers » ni glisser', !!carte && !carte.querySelector('[data-deplacer]') && carte.getAttribute('draggable') !== 'true'
    && /Ne veut plus être contactée/.test(carte.textContent));
  const carte1 = O.doc.querySelector('.aff-carte[data-affaire="a1"]');
  /* 02/10/2026 : « Deplacer » replie la liste, qui ne propose plus l'etape ou la carte est deja. */
  t('la carte replie sa liste derriere « Déplacer », sans l\'etape actuelle',
    !!carte1 && /^Déplacer/.test(((carte1.querySelector('details.aff-carte__dep > summary') || {}).textContent) || '')
    && !!carte1.querySelector('details.aff-carte__dep select[data-deplacer]')
    && ![].some.call(carte1.querySelectorAll('select[data-deplacer] option'), o => o.value && o.value === O.base.affaires.find(a => a.affaire_id === 'a1').etape_id));
  O.w.BdvAffaires._S.vue = 'liste';

  /* N3 : la recherche la montre marquee, et la creer de nouveau est refuse. */
  await O.w.BdvAffaires.ouvrir();
  O.clic('[data-aff="nouvelle"]');
  { const q = O.doc.getElementById('affCherche'); q.value = 'Bistrot'; q.dispatchEvent(new O.w.Event('input', { bubbles: true })); }
  const props = () => (O.doc.getElementById('affPropositions') || {}).innerHTML || '';
  t('N3 : la recherche montre la personne en opposition, marquee', /Bistrot des Halles[\s\S]*Ne veut plus être contactée/.test(props()), props().slice(0, 300));
  t('N3 : et ne propose pas de la prendre', !O.doc.querySelector('#affPropositions [data-aff="prendreClient"][data-id="p2"]'));
  { const bt = O.doc.createElement('button'); bt.setAttribute('data-aff', 'prendreClient'); bt.setAttribute('data-genre', 'piste'); bt.setAttribute('data-id', 'p2');
    O.doc.getElementById('amodCorps').appendChild(bt); bt.click(); bt.remove(); }
  t('N3 : meme forcee (un bouton venu d\'ailleurs), la prendre est refuse et dit pourquoi',
    !O.w.BdvAffaires._S.choix.client && /a demandé à ne plus être contacté/.test(av(O)), av(O));
  O.clic('[data-aff="creerMain"]');
  O.doc.getElementById('affNom').value = 'BISTROT  des halles'; O.doc.getElementById('affNom').dispatchEvent(new O.w.Event('input', { bubbles: true }));
  const dbl = O.doc.getElementById('affDoublon');
  t('N3 : la fiche previent au meme nom, sans « Prendre »', !dbl.hidden && /a demandé à ne plus être contacté/.test(dbl.textContent) && !dbl.querySelector('button'));
  const nPistes = O.base.pistes.length;
  O.doc.getElementById('affForme').dispatchEvent(new O.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  t('N3 : « Creer » au meme nom est refuse, avec une phrase', O.base.pistes.length === nPistes && /a demandé à ne plus être contacté/.test(av(O)), av(O));
  O.doc.getElementById('affNom').value = 'Autre nom'; O.doc.getElementById('affSiret').value = '111 222 333 00011';
  O.doc.getElementById('affSiret').dispatchEvent(new O.w.Event('input', { bubbles: true }));
  O.doc.getElementById('affForme').dispatchEvent(new O.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(20);
  t('N3 : « Creer » au meme SIRET est refuse aussi', O.base.pistes.length === nPistes && /a demandé à ne plus être contacté/.test(av(O)), av(O));
  O.clic('#affaireModale .tmod__x');

  /* N1 : un SIRET pris par un collegue depuis la derniere lecture. */
  const N = monter(); garnir(N);
  await N.w.BdvAffaires.ouvrir();
  N.base.pistes.push({ bureau: BUREAU, piste_id: 'pX', nom: 'Cave du Collègue', opposition: false, siret: '99988877700011' });
  const api0 = N.w.BdvCompte.api;
  let mode = 'doublon';
  N.w.BdvCompte.api = async (c, o) => {
    o = o || {};
    if (o.methode === 'POST' && /^\/pistes/.test(c)) {
      const e = new Error('refus');
      e.detail = mode === 'doublon'
        ? '{"code":"23505","details":"Key (bureau, siret)=(x, 99988877700011) already exists.","message":"duplicate key value violates unique constraint \"pistes_siret_unique\""}'
        : '{"code":"PGRST204","message":"Could not find the \'siret\' column of \'pistes\' in the schema cache"}';
      if (mode === 'doublon' || (o.corps || []).some(l => 'siret' in l)) throw e;
    }
    return api0(c, o);
  };
  N.clic('[data-aff="nouvelle"]');
  { const q = N.doc.getElementById('affCherche'); q.value = 'Cave Neuve'; q.dispatchEvent(new N.w.Event('input', { bubbles: true })); }
  N.clic('[data-aff="creerMain"]');
  N.doc.getElementById('affSiret').value = '99988877700011';
  const posts = () => N.requetes.filter(r => r.methode === 'POST').length;
  N.doc.getElementById('affForme').dispatchEvent(new N.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(30);
  t('N1 : SIRET pris par un collegue : rien de cree, pas de second essai sans SIRET',
    N.base.pistes.length === 1 && !N.base.affaires.length && posts() === 0, N.base.pistes.length + ' / ' + posts());
  t('N1 : l\'avis nomme la fiche et propose de la prendre',
    /Ce SIRET est déjà dans ton bureau : « Cave du Collègue »/.test(av(N)) && !!N.doc.querySelector('#amodAvis [data-aff="prendreClient"][data-id="pX"]'), av(N));
  t('N1 : et n\'accuse plus le lot 39', !/lot 39/.test(av(N)));
  mode = 'colonne';
  N.doc.getElementById('affSiret').value = '12312312300011';
  N.doc.getElementById('affNom').value = 'Cave Neuve';
  N.doc.getElementById('affForme').dispatchEvent(new N.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(30);
  t('N1 : une colonne INCONNUE (lot 39 pas passe) : la fiche se cree sans SIRET, et on le dit',
    N.base.pistes.length === 2 && N.base.affaires.length === 1 && /attend encore sa mise à jour/.test(avis(N)), avis(N));
  t('N8 : un seul point apres la date abregee', !/\.\./.test(avis(N)) && /rappel le .+\./.test(avis(N)), avis(N));

  /* W1, W4, W6 */
  const W = monter();
  garnir(W, [{ affaire_id: 'a1', piste_id: 'p1', titre: 'Cave du Port', rappel: null, etape_le: vieux }]);
  W.base.pistes.push({ bureau: BUREAU, piste_id: 'p1', nom: 'Cave du Port', opposition: false });
  await W.w.BdvAffaires.ouvrir();
  const lw = W.doc.querySelector('#affCorps [data-affaire="a1"]').textContent;
  t('W4 : la ligne d\'une endormie porte UNE duree', /Plus de nouvelles depuis 50 jours/.test(lw) && (lw.match(/\d+ jours?/g) || []).length === 1, lw);
  /* 02/10/2026 : sans nouvelles, le premier geste pose un rappel ; « Vers <etape> » vient apres. */
  { const lig = W.doc.querySelector('#affCorps .aff-ligne[data-affaire="a1"]');
    const g = [].map.call(lig.querySelectorAll('.aff-ligne__gestes [data-aff]'), b => b.getAttribute('data-aff') + ':' + b.textContent.trim());
    t('endormie : « Le rappeler demain » puis « Vers <etape> »', g[0] === 'reporter:Le rappeler demain' && /^suivante:Vers /.test(g[1] || ''), g.join(' | '));
    const et = W.doc.querySelector('#affCorps .aff-etat');
    t('la ligne « Aujourd\'hui » nomme l\'affaire a relancer, et son nom ouvre le panneau',
      !!et && /Aujourd’hui : rappelle Cave du Port/.test(et.textContent) && !!et.querySelector('[data-aff="ouvrir"][data-id="a1"]'), et && et.textContent);
    t('un seul aplat d\'accent dans la barre : « Nouvelle affaire »', W.doc.querySelectorAll('#affCorps .aff-tete .btn--bordeaux').length === 1
      && !W.doc.querySelector('#affCorps .aff-vues .chip')); }
  W.clic('#affCorps [data-affaire="a1"] [data-aff="ouvrir"]');
  const tw = W.doc.getElementById('amodTete').textContent;
  t('W4 : l\'etat du panneau aussi', /Dans « Repéré »/.test(tw) && /Plus de nouvelles depuis 50 jours/.test(tw) && (tw.match(/50 jours/g) || []).length === 1, tw);
  const fw = W.doc.querySelector('#affaireModale form.aff-edit');
  W.clic('#affaireModale [data-aff="perdue"]');
  const pied = fw.querySelector('.aff-form__pied');
  t('W1 : le choix « Pas pour cette fois » se voit enfonce', fw.querySelector('[data-aff="perdue"]').getAttribute('aria-pressed') === 'true'
    && fw.querySelector('[data-aff="gagnee"]').getAttribute('aria-pressed') === 'false');
  t('W1 : pendant la confirmation, « Enregistrer » passe en retrait et dit quoi terminer',
    pied.classList.contains('aff-form__pied--retrait') && pied.querySelector('[type="submit"]').getAttribute('aria-disabled') === 'true'
    && /Termine d’abord\s: «\sLa classer\s» ou «\sAnnuler\s»/.test(pied.textContent));
  const nPatch = W.requetes.filter(r => r.methode === 'PATCH').length;
  fw.dispatchEvent(new W.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(10);
  t('W1 : et Entree n\'enregistre rien par-dessous', W.requetes.filter(r => r.methode === 'PATCH').length === nPatch);
  W.clic('#affaireModale [data-confirme="perdue"] [data-aff="conclureAnnuler"]');
  t('W1 : « Annuler » rend le pied et relache le choix', !pied.classList.contains('aff-form__pied--retrait')
    && !pied.querySelector('[type="submit"]').hasAttribute('aria-disabled') && fw.querySelector('[data-aff="perdue"]').getAttribute('aria-pressed') === 'false'
    && fw.querySelector('[data-confirme="perdue"]').hidden);
  t('W1 : un seul bouton plein pendant la confirmation', (() => { W.clic('#affaireModale [data-aff="perdue"]');
    return [...fw.querySelectorAll('.btn--bordeaux')].filter(b => !b.closest('[hidden]') && b.getAttribute('aria-disabled') !== 'true').length === 1; })());
  W.clic('#affaireModale [data-confirme="perdue"] [data-aff="conclureAnnuler"]');
  /* T6 (tour 3) : un seul champ de date pour un meme rappel */
  t('T6 : il n\'y a plus de second champ de date dans la rangee de report', !W.doc.getElementById('amodReportD') && !W.doc.getElementById('amodReportJour')
    && W.doc.querySelectorAll('#affaireModale input[type="date"]').length === 1);
  const rapF = W.doc.querySelector('#affaireModale form.aff-edit [name="rappel"]');
  const autre = W.doc.querySelector('#affaireModale [data-aff="reporterDate"]');
  t('T6 : « Autre date » nomme le champ du formulaire', !!rapF && autre.getAttribute('aria-controls') === rapF.id && rapF.id === 'affEditRappel');
  W.clic('#affaireModale [data-aff="reporterDate"]');
  t('T6 : un appui pose le focus sur le champ « Je le rappelle le », sans rien ecrire', W.doc.activeElement === rapF);
  rapF.value = '2099-03-04';
  fw.dispatchEvent(new W.w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(30);
  t('T6 : « Enregistrer » ecrit la date choisie', W.base.affaires[0].rappel === '2099-03-04', W.base.affaires[0].rappel);

  /* W13 : les deux champs facultatifs replies */
  W.clic('#affaireModale .tmod__x');
  W.clic('[data-aff="nouvelle"]');
  const rd = W.doc.getElementById('affDetailRepli');
  t('W13 : « L’affaire » et « Pour quoi faire » se replient sous « Ajouter un détail »',
    !!rd && !rd.open && rd.contains(W.doc.getElementById('affIntitule')) && rd.contains(W.doc.getElementById('affMotifRappel')));
  t('W13 : contact et fonction restent cote a cote', !!W.doc.getElementById('affContact').closest('.aff-duo--serre')
    && W.doc.getElementById('affContact').closest('.aff-duo--serre').contains(W.doc.getElementById('affFonction')));
  { const q = W.doc.getElementById('affCherche'); q.value = 'Cave du'; q.dispatchEvent(new W.w.Event('input', { bubbles: true })); }
  W.clic('#affPropositions [data-aff="prendreClient"][data-id="p1"]');
  t('W13 : un client connu pris, le repli s\'ouvre et le focus va a « L’affaire »', rd.open && W.doc.activeElement === W.doc.getElementById('affIntitule'));
  const CSS2 = fs.readFileSync(path.join(RACINE, 'src/css/bdv-bureau.css'), 'utf8');
  const sx = CSS2.split('31 sexies')[1] || '';
  t('W13 : la regle CSS tient le duo serre a deux colonnes', /\.aff-duo--serre\{[^}]*grid-template-columns:1fr 1fr/.test(sx));
  t('W1 : le choix enfonce porte sa coche en CSS', /\.aff-conclure__choix\[aria-pressed="true"\]::before\{/.test(sx));
  t('W6 : sous 700 px, les trois boutons de report partagent une ligne', /\.amod__report-b\{[^}]*display:grid/.test(sx));
  t('aucune ombre et aucun z-index dans la passe du tour 2', !/box-shadow|z-index/.test(sx.slice(sx.indexOf('*/') + 2).split('/* ===')[0].replace(/\/\*[\s\S]*?\*\//g, '')));
}

/* ---------------------------------------------------------------------------
   03/10/2026 : LE CLIENT EN DIRECT, ET L'AFFAIRE EN PLEINE PAGE (#affaire=).
   --------------------------------------------------------------------------- */
titre('03/10/2026 : le client en direct, l\'affaire en pleine page');
{
  const F = monter();
  const w = F.w, jour = new Date().toISOString();
  w.BdvNav = { avecVitisoft: () => true, chargerMoteur: () => Promise.resolve() };
  w.eval(fs.readFileSync(path.join(RACINE, 'src/js/bdv-devis-calcul.js'), 'utf8'));
  w.parseTels = (c) => c ? [{ appel: '+33612345678', affiche: '06 12 34 56 78' }] : [];
  w.parseEmails = (c) => c ? [c] : [];
  const ecrits = [];
  w.BdvSync = { lireEchanges: async () => [{ echange_id: 'x1', client_id: 'C1', le: '2026-09-25T10:00:00Z', type: 'appel', canal: 'appel', resume: 'Veut goûter le 2025' }],
    ecrireEchange: async (e) => { ecrits.push(e); return true; } };
  F.base.ventes_lignes = [{ bureau: BUREAU, client_cle: 'C1', mobile: '0612345678', fixe: '', emails: 'cave@ex.fr', pays: 'France', le_jour: '2026-07-01' }];
  F.base.affaire_types.push({ bureau: BUREAU, type_id: 't1', nom: 'Caviste', famille: 'client', sommeil_jours: 30, ordre: 0, archive: false });
  F.base.affaire_etapes.push({ bureau: BUREAU, etape_id: 'e1', type_id: 't1', nom: 'Repéré', ordre: 1 }, { bureau: BUREAU, etape_id: 'e2', type_id: 't1', nom: 'Devis', ordre: 2 });
  F.base.affaires.push({ bureau: BUREAU, affaire_id: 'a1', type_id: 't1', etape_id: 'e1', client_id: 'C1', client_nom: 'Chez Paul', titre: 'Le rosé', issue: 'en_cours', rappel: '2000-01-01', rappel_titre: 'Lui faire goûter', etape_le: jour, ouverte_le: jour });
  F.base.devis = [{ bureau: BUREAU, affaire_id: 'a1', devis_id: 'd1', numero: 'D-2026-0001', statut: 'enregistre', total_ht_c: 999900, cree_le: jour }];
  await w.BdvAffaires.ouvrir();
  F.clic('#affCorps [data-affaire="a1"] [data-aff="ouvrir"]');
  await attendre(40);
  const lc = F.requetes.filter(r => /^\/ventes_lignes\?/.test(r.chemin));
  t('le numero se LIT dans ses ventes, pour ce bureau et ce client', lc.length >= 1 && lc.every(r => /bureau=eq\./.test(r.chemin) && /client_cle=eq\.C1/.test(r.chemin)), lc.map(r => r.chemin).join(' ; '));
  const tete = F.doc.getElementById('amodTete');
  const tel = tete && tete.querySelector('a[href^="tel:"]');
  t('le panneau dit « Appeler le 06 12 34 56 78 » et compose le meme numero', !!tel && tel.getAttribute('href') === 'tel:+33612345678' && /06 12 34 56 78/.test(tel.textContent));
  t('« Ecrire » ouvre le redacteur de sa fiche, pas un mailto', !!tete.querySelector('[data-aff="ecrireClient"]') && !tete.querySelector('a[href^="mailto:"]'));
  t('son historique est a l\'ecran', /Veut goûter le 2025/.test(tete.textContent));
  t('« Agrandir » mene a #affaire=a1 dans un nouvel onglet', (() => { const ag = F.doc.getElementById('amodAgrandir'); return !!ag && !ag.hidden && /#affaire=a1$/.test(ag.getAttribute('href')) && ag.target === '_blank'; })());
  F.doc.querySelector('#amodTete .aff-noter__txt').value = 'Rappelé, 12 magnums';
  F.clic('#amodTete [data-aff="noterEchange"]');
  await attendre(40);
  t('« Noter » ecrit dans le journal de la fiche (echanges), pas une copie', ecrits.length === 1 && ecrits[0].client_id === 'C1' && /12 magnums/.test(ecrits[0].resume));
  t('la note apparait dans l\'historique', /12 magnums/.test(F.doc.getElementById('amodTete').textContent));

  /* La pleine page */
  F.clic('#affaireModale .tmod__x');
  const ok = await w.BdvAffaires.page('a1');
  await attendre(60);
  const pg = F.doc.getElementById('pageAffaire');
  const tx = pg ? pg.textContent.replace(/[  ]/g, ' ') : '';
  t('la page se monte, une seule fois l\'avis de la piece', ok === true && !!pg && F.doc.querySelectorAll('#affAvis').length === 1 && pg.contains(F.doc.getElementById('affAvis')));
  t('le moment : le rappel en retard passe avant un devis pas envoye', /Tu devais le rappeler/.test(tx) && !!pg.querySelector('.page-aff__moment a.btn--bordeaux[href^="tel:"]'));
  t('aucun montant en tete pour un devis pas envoye', !pg.querySelector('.page-aff__gros'));
  t('tous les devis de l\'affaire sont visibles', /D-2026-0001/.test(pg.querySelector('#affDevisListe').textContent));
  t('un seul aplat d\'accent dans la page', [...pg.querySelectorAll('.btn--bordeaux')].filter(n => !n.closest('details:not([open])')).length === 1);
  t('« Reperes » se tait sous 5 affaires closes du type', !/Pour préparer ta réponse/.test(tx));
  F.base.devis.push({ bureau: BUREAU, affaire_id: 'a1', devis_id: 'd2', numero: 'D-2026-0002', statut: 'accepte', signe_le: jour, total_ht_c: 120000, envoye_le: '2026-09-01', valable_jusqu: '2099-01-01', cree_le: jour });
  w.BdvAffaires._S.devisDe.a1 = F.base.devis.slice().reverse();
  const m = w.BdvAffaires._moment(F.base.affaires[0], w.BdvAffaires.etat(F.base.affaires[0]));
  t('un devis signe passe avant un rappel en retard (arbitre par Ted)', m.plein === 'devis' && /Signé en ligne/.test(m.t));
}

console.log('\n== VERDICT ==');
console.log('  ' + OK + ' controle(s) passe(s), ' + KO + ' echec(s)');
console.log(KO ? '  MES AFFAIRES NE FONT PAS CE QU\'ELLES DISENT' : '  MES AFFAIRES FONT CE QU\'ELLES DISENT');
process.exit(KO ? 1 : 0);
