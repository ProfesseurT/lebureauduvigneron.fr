/* ============================================================================
   BANC DE « MES CLIENTS » ET DE LA FICHE EN PLEINE PAGE, 24/09/2026
   ============================================================================
       npm run banc:annuaire

   CE QU'IL GARDE, dans l'ordre des quatre lots :

   1. LA FICHE EN PLEINE PAGE. Le bouton « Agrandir » existe, mene a
      /mon-bureau/#fiche=<cle>, et les deux enveloppes (corps, cote) sont posees.
      En pleine page, `modeTiroir()` repond vrai (pas de piege, pas de vol de
      focus) et le contrat ARIA n'est PAS celui d'une modale.
   2. DEUX ONGLETS, UN SUIVI. L'evenement `storage` d'un autre onglet remplace la
      memoire de celui-ci : sans lui, le second a ecrire effacait le premier.
   3. L'ANNUAIRE. La liste se calcule sur les lignes, prend les coordonnees de la
      ligne la PLUS RECENTE, cherche par nom, ville, e-mail et telephone, filtre,
      trie, et ne montre que les clients qui passent.
   4. LES GESTES GROUPES. Etiqueter trois clients fait UNE ecriture ; retirer la
      derniere etiquette d'une fiche vide la supprime ; attribuer est REFUSE tant
      que le lot 33 n'est pas passe, et ne part alors pas du tout.
   5. LE CORPS DE L'ECRITURE. `proprietaire` ne part JAMAIS tant que la colonne
      n'a pas ete vue : l'envoyer avant le SQL ferait refuser toute ecriture du
      suivi. Et `crmVide()` compte le proprietaire.

   UN SEUL `eval` pour le moteur, les ecrans et l'annuaire : leurs globales sont
   en `let` et `const` (meme raison que banc-registre.mjs). bdv-sync.js, lui, est
   un module ferme : il passe dans son propre `eval`, apres, avec un faux compte.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
const R = path.join(RACINE, 'src/js') + '/';

let ko = 0, ok = 0;
const t = (nom, bon, det) => {
  if (bon) { ok++; console.log('  ok    : ' + nom); }
  else { ko++; console.log('  ECHEC : ' + nom + (det !== undefined ? '\n          ' + det : '')); }
};

const dom = new JSDOM(`<!doctype html><body>
  <section class="panel on" id="p-annuaire"></section>
  <div id="modale" class="bdv-ventes modale"></div>
  <div id="status"></div><div id="statusTxt"></div><div id="statusSpin"></div>
  <div id="busyov"></div><div id="busytxt"></div>
</body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w = dom.window;
w.Chart = function(){ this.destroy = () => {}; };
w.Papa = {};
/* Un faux serveur : il note chaque ecriture, et repond oui. */
w.__ECRITS = []; w.__SUPPR = [];
w.BdvSync = {
  pret: () => true,
  ecrireSuiviLot: async (l) => { w.__ECRITS.push(JSON.parse(JSON.stringify(l))); return true; },
  ecrireSuivi: async () => true,
  supprimerSuivi: async (id) => { w.__SUPPR.push(id); return true; },
  lot33: async () => null, lireVues: async () => null
};

/* Trois clients. C1 a change de nom et de ville : c'est la ligne la plus recente qui doit
   gagner. C2 est dormant (plus d'un an sans commande). C3 est a l'export. */
const L = [];
const pose = (id, nom, ville, cp, jour, total, canal, fact) => L.push({ numClient: id, client: nom, ville, cp, pays: 'France',
  numFacture: fact, produit: 'Cuvee Test', _qte: 6, _total: total, _canal: canal, _typeClient: 'Particulier', _vin: true, _j: jour });
pose('C1', 'Ancien nom', 'Angers', '49000', 20000, 100, 'Caveau', 'F1');
pose('C1', 'Domaine Neuf', 'Nantes', '44000', 20500, 300, 'Caveau', 'F2');
pose('C2', 'Cave Lointaine', 'Lyon', '69000', 19900, 900, 'Cavistes', 'F3');
pose('C3', 'Import Belge', 'Liège', '4000', 20490, 50, 'Export', 'F4');

const scenario = `
  ROWS.length = 0;
  JSON.parse(${JSON.stringify(JSON.stringify(L))}).forEach(function(o){
    var d = new Date(o._j * 86400000);
    o._date = { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), t: d.getTime() };
    o._dayNum = o._j; o._exY = o._date.y;
    ROWS.push(o);
  });
  computeMeta();
  EMAILS['C3'] = ['achat@import.be'];
  var S = {};
  S.crmVideProprio = crmVide({ proprietaire: 'u1' });
  BdvAnnuaire.peindre();
  var E = BdvAnnuaire._etat();
  S.n = E.LISTE.length;
  var c1 = E.LISTE.filter(function(c){ return c.id === 'C1'; })[0];
  S.c1 = { nom: c1.nom, ville: c1.ville, cmd: c1.cmd, etat: c1.etat };
  S.c2etat = E.LISTE.filter(function(c){ return c.id === 'C2'; })[0].etat;
  S.lignes = document.querySelectorAll('#annuCorps tr.annu__l').length;
  S.premier = document.querySelector('#annuCorps tr.annu__l').getAttribute('data-id');
  S.lien = document.querySelector('#annuCorps a.annu__nom').getAttribute('href');
  S.ariaSort = document.querySelector('th[aria-sort="descending"] [data-cle]').getAttribute('data-cle');
  function tape(v){ var q = document.getElementById('annuQ'); q.value = v; E.ETAT.q = v; }
  E.ETAT.q = 'nantes'; BdvAnnuaire._maj(); S.qVille = BdvAnnuaire._etat().FILTREE.map(function(c){ return c.id; }).join(',');
  E.ETAT.q = 'achat@import'; BdvAnnuaire._maj(); S.qMail = BdvAnnuaire._etat().FILTREE.map(function(c){ return c.id; }).join(',');
  E.ETAT.q = ''; E.ETAT.etat = 'dormant'; BdvAnnuaire._maj(); S.dormants = BdvAnnuaire._etat().FILTREE.map(function(c){ return c.id; }).join(',');
  E.ETAT.etat = ''; E.ETAT.canal = 'Export'; BdvAnnuaire._maj(); S.export = BdvAnnuaire._etat().FILTREE.map(function(c){ return c.id; }).join(',');
  E.ETAT.canal = ''; E.ETAT.tri = 'nom'; E.ETAT.sens = 1; BdvAnnuaire._maj(); S.triNom = BdvAnnuaire._etat().FILTREE.map(function(c){ return c.id; }).join(',');
  E.ETAT.tri = 'ca'; E.ETAT.sens = -1; BdvAnnuaire._maj(); S.triCa = BdvAnnuaire._etat().FILTREE.map(function(c){ return c.id; }).join(',');
  window.__S = S;
  window.__x = function(code){ return eval(code); };
`;
/* LE MOTEUR DES VENTES DEMARRE SUR DOMContentLoaded (lot 44). Cette fenetre n'a pas
   d'ecran #app : on laisse passer l'evenement AVANT de charger les scripts. Sans cela, il
   tombait a la premiere attente d'une section suivante et arretait le banc. */
if (dom.window.document.readyState === 'loading')
  await new Promise(r => dom.window.document.addEventListener('DOMContentLoaded', r));
try {
  w.eval(fs.readFileSync(R + 'bdv-base.js', 'utf8') + '\n' + fs.readFileSync(R + 'bdv-ecrans.js', 'utf8') + '\n'
    + fs.readFileSync(R + 'bdv-annuaire.js', 'utf8')
    + '\n' + scenario);
} catch (e) {
  console.log('ECHEC a l\'execution : ' + e.message);
  console.log((e.stack || '').split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}
const S = w.__S;

console.log('== 3. L\'annuaire ==');
t('trois clients, un par cle', S.n === 3, S.n);
t('le nom et la ville viennent de la ligne la PLUS RECENTE', S.c1.nom === 'Domaine Neuf' && S.c1.ville === 'Nantes', JSON.stringify(S.c1));
t('deux factures, deux commandes', S.c1.cmd === 2, S.c1.cmd);
t('plus d\'un an sans commande : dormant', S.c2etat === 'dormant', S.c2etat);
t('trois rangees peintes', S.lignes === 3, S.lignes);
t('le tri par defaut est la derniere commande, la plus recente en tete', S.premier === 'C1' && S.ariaSort === 'der', S.premier + ' / ' + S.ariaSort);
t('le nom est un VRAI lien vers la fiche en pleine page', S.lien === '/mon-bureau/#fiche=C1', S.lien);
t('la recherche trouve une ville', S.qVille === 'C1', S.qVille);
t('la recherche trouve une adresse e-mail', S.qMail === 'C3', S.qMail);
t('le filtre « dormants »', S.dormants === 'C2', S.dormants);
t('le filtre de canal', S.export === 'C3', S.export);
t('le tri par nom, de A a Z', S.triNom === 'C2,C1,C3', S.triNom);
t('le tri par CA de l\'exercice, le plus gros en tete, le dormant en dernier', S.triCa === 'C1,C3,C2', S.triCa);

console.log('== 5. crmVide compte le proprietaire ==');
t('une fiche qui ne porte que son proprietaire n\'est PAS vide', S.crmVideProprio === false);

/* ---- 4. les gestes groupes ---- */
console.log('== 4. Les gestes groupes ==');
await w.__x(`BdvAnnuaire.etiqueter(['C1','C2','C3'], 'VIP', true)`);
t('etiqueter trois clients fait UNE ecriture', w.__ECRITS.length === 1, w.__ECRITS.length);
t('les trois fiches y sont, avec l\'etiquette', w.__ECRITS[0] && w.__ECRITS[0].length === 3
  && w.__ECRITS[0].every(x => (x.fiche.tags || []).indexOf('VIP') >= 0), JSON.stringify(w.__ECRITS[0]));
t('la memoire locale porte l\'etiquette', w.__x(`(CRM['C2'].tags||[]).join()`) === 'VIP');
t('la ligne affiche l\'etiquette', w.__x(`document.querySelectorAll('#annuCorps .annu__tag').length`) === 3);
await w.__x(`BdvAnnuaire.etiqueter(['C2'], 'VIP', false)`);
t('retirer la derniere etiquette d\'une fiche la SUPPRIME (pas de fiche fantome)',
  w.__SUPPR.indexOf('C2') >= 0 && w.__x(`!CRM['C2']`), JSON.stringify(w.__SUPPR));
const avant = w.__ECRITS.length;
await w.__x(`BdvAnnuaire.attribuer(['C1'], 'u2')`);
t('attribuer sans le lot 33 est refuse, et rien ne part', w.__ECRITS.length === avant && w.__x(`!('proprietaire' in (CRM['C1']||{}))`));

/* ---- 1. la fiche ---- */
console.log('== 1. La fiche en pleine page ==');
const fiche = w.__x(`ficheHTML(ficheClient('C1'), '')`);
t('le bouton « Agrandir » mene a #fiche=', /class="fiche__agrandir" href="\/mon-bureau\/#fiche=C1" target="_blank"/.test(fiche));
t('les deux enveloppes sont posees', fiche.includes('class="fiche__corps"') && fiche.includes('class="fiche__cote"'));
t('le suivi est dans la colonne de cote', fiche.indexOf('fiche__cote') < fiche.indexOf('id="suiviRepli"'));
t('aucune valeur aberrante', !/NaN|Infinity|undefined/.test(fiche.replace(/<[^>]+>/g, ' ')));
t('hors pleine page, modeTiroir dit non', w.__x(`modeTiroir()`) === false);
w.document.body.classList.add('bdv-page-fiche');
t('en pleine page, modeTiroir dit oui (ni piege ni vol de focus)', w.__x(`modeTiroir()`) === true);
w.__x(`ouvrirFiche('C1','')`);
const boite = w.document.querySelector('#modale .modale__box');
t('en pleine page, la boite n\'est pas une modale', boite && !boite.hasAttribute('aria-modal') && boite.getAttribute('role') === 'main',
  boite && boite.outerHTML.slice(0, 120));
t('et le titre de l\'onglet porte le nom du client', /^Domaine Neuf/.test(w.document.title), w.document.title);
w.document.body.classList.remove('bdv-page-fiche');

/* ---- 2. deux onglets ---- */
console.log('== 2. Deux onglets, un suivi ==');
const autre = JSON.stringify({ C9: { rappel: '2026-10-01', tags: ['Salon'] } });
w.localStorage.setItem('bdv_crm_v1', autre);
w.dispatchEvent(new w.StorageEvent('storage', { key: 'bdv_crm_v1', newValue: autre }));
t('l\'evenement storage d\'un autre onglet remplace la memoire', w.__x(`CRM['C9'] && CRM['C9'].rappel`) === '2026-10-01');

/* ---- 6. les etiquettes, deuxieme version (25/09/2026) ---- */
console.log('== 6. Les etiquettes ==');
w.document.body.classList.remove('bdv-page-fiche');
w.__x(`Object.keys(CRM).forEach(function(k){ delete CRM[k]; }); CRM['C1']={tags:['VIP']}; CRM['C3']={tags:['VIP']}; BdvAnnuaire._maj()`);
w.__x(`fermerFiche(); ouvrirFiche('C2','')`);
const q6 = s => w.document.querySelector(s), qa6 = s => w.document.querySelectorAll(s);
t('fiche sans etiquette : une phrase dit a quoi elles servent', !!q6('#suiviBloc .etiqs__vide'));
t('les etiquettes du bureau sont proposees en un clic', Array.from(qa6('#suiviBloc .etiqs__s')).some(b => /VIP/.test(b.textContent)),
  q6('#suiviBloc') && q6('#suiviBloc').innerHTML.slice(0, 300));
t('il y a un vrai bouton « Ajouter »', !!q6('#suiviBloc .etiqs__form button[type="submit"]'));
w.__x(`crmAjouterTag('C2','vip')`);
t('« vip » reprend l\'orthographe du bureau', w.__x(`(CRM['C2'].tags||[]).join()`) === 'VIP', w.__x(`JSON.stringify(CRM['C2'])`));
t('la pastille apparait AUSSITOT dans le suivi', qa6('#suiviBloc .etiqs__p').length === 1);
t('et dans l\'en-tete de la fiche', /VIP/.test((q6('#fichePastilles') || {}).textContent || ''));
t('une etiquette deja posee ne se propose plus', !Array.from(qa6('#suiviBloc .etiqs__s')).some(b => /VIP/.test(b.textContent)));
w.__x(`crmAjouterTag('C2','VIP')`);
t('la reposer ne la double pas', w.__x(`CRM['C2'].tags.length`) === 1);
w.__x(`crmRetirerTag('C2','VIP')`);
t('la retirer l\'efface de la fiche et de la memoire', qa6('#suiviBloc .etiqs__p').length === 0 && w.__x(`!CRM['C2']`));
q6('#suiviBloc .etiqs__ajout').value = 'Salon';
/* Le jsdom de ce banc n'execute pas les attributs onsubmit : on appelle ce qu'il appelle,
   et on verifie qu'il l'appelle bien. */
t('le formulaire appelle etiqAjouter', /etiqAjouter\(/.test(q6('#suiviBloc .etiqs__form').getAttribute('onsubmit')));
w.__x(`etiqAjouter('C2', document.querySelector('#suiviBloc .etiqs__form'))`);
t('Entree dans le champ enregistre l\'etiquette', w.__x(`(CRM['C2']&&CRM['C2'].tags||[]).join()`) === 'Salon');
const champ = q6('#suiviBloc .etiqs__ajout'); champ.value = 'zz'; w.__x(`etiqFiltrer(document.querySelector('#suiviBloc .etiqs__ajout'))`);
t('la frappe filtre les propositions', Array.from(qa6('#suiviBloc .etiqs__s')).every(b => b.hidden));
t('le bloc « Gérer les étiquettes » est dans Mes clients', !!q6('#annuGerer .annu__gest'));
await w.__x(`BdvAnnuaire.renommerEtiquette('Salon','vip')`);
t('renommer vers un nom existant REUNIT les deux', w.__x(`CRM['C2'].tags.join()`) === 'VIP' && w.__x(`BdvAnnuaire.etiquettes().length`) === 1,
  w.__x(`JSON.stringify(BdvAnnuaire.etiquettes())`));
await w.__x(`BdvAnnuaire.renommerEtiquette('VIP','Grands comptes')`);
t('renommer touche TOUS les clients qui la portent', w.__x(`BdvAnnuaire.etiquettes().map(function(x){return x.t+':'+x.n}).join()`) === 'Grands comptes:3',
  w.__x(`JSON.stringify(BdvAnnuaire.etiquettes())`));
w.__x(`BdvAnnuaire._etat().ETAT.tag='grands comptes'; BdvAnnuaire._maj()`);
t('le filtre ne tient pas compte des majuscules', w.__x(`BdvAnnuaire._etat().FILTREE.length`) === 3);
q6('#annuCorps [data-a="tag-filtre"]').click();
t('cliquer l\'etiquette d\'une ligne filtre la liste', w.__x(`BdvAnnuaire._etat().ETAT.tag`) === 'Grands comptes');
await w.__x(`BdvAnnuaire.supprimerEtiquette('Grands comptes')`);
t('supprimer l\'etiquette la retire de tous', w.__x(`BdvAnnuaire.etiquettes().length`) === 0 && w.__x(`BdvAnnuaire._etat().ETAT.tag`) === '');
w.__x(`crmAjouterTag('C1','Salon'); ouvrirFiche('C1','')`);
w.__x(`etiqVoir('Salon')`);
t('la pastille de la fiche ouvre Mes clients filtre, fiche fermee', w.__x(`BdvAnnuaire._etat().ETAT.tag`) === 'Salon' && w.__x(`FICHE_ID`) == null
  && w.__x(`BdvAnnuaire._etat().FILTREE.map(function(c){return c.id}).join()`) === 'C1');

/* ---- 5. le corps de l'ecriture ---- */
console.log('== 5. Le corps de l\'ecriture du suivi ==');
const d2 = new JSDOM(`<!doctype html><body></body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w2 = d2.window;
w2.__REQ = []; w2.__LOT = 'absent';
w2.BdvCompte = {
  monId: () => 'u1', monBureau: () => 'b1',
  api: async (chemin, o) => {
    w2.__REQ.push({ chemin, corps: o && o.corps });
    if (/select=proprietaire/.test(chemin) && w2.__LOT === 'absent') { const e = new Error('Supabase a refuse (400)'); e.status = 400; throw e; }
    return (o && o.corps) || [];
  }
};
w2.eval(fs.readFileSync(R + 'bdv-sync.js', 'utf8'));
await w2.BdvSync.ecrireSuivi('C1', { tags: ['VIP'], proprietaire: 'u2' });
const ecr2 = w2.__REQ.filter(r => r.corps)[0];
t('une attribution demande d\'abord au compte si la colonne existe', /select=proprietaire/.test((w2.__REQ[0] || {}).chemin || ''), JSON.stringify(w2.__REQ[0]));
t('avant le lot 33, `proprietaire` ne part PAS', ecr2 && !('proprietaire' in ecr2.corps[0]), JSON.stringify(ecr2));
t('et l\'ecriture nomme son bureau', ecr2 && ecr2.corps[0].bureau === 'b1' && /on_conflict=bureau/.test(ecr2.chemin));
t('la sonde repond « non » sur une colonne absente', (await w2.BdvSync.lot33()) === false);
const d3 = new JSDOM(`<!doctype html><body></body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w3 = d3.window; w3.__REQ = [];
w3.BdvCompte = { monId: () => 'u1', monBureau: () => 'b1', api: async (c, o) => { w3.__REQ.push({ chemin: c, corps: o && o.corps }); return (o && o.corps) || []; } };
w3.eval(fs.readFileSync(R + 'bdv-sync.js', 'utf8'));
t('la sonde repond « oui » quand la colonne existe', (await w3.BdvSync.lot33()) === true);
t('et elle nomme son bureau', /bureau=eq\.b1/.test(w3.__REQ[0].chemin), w3.__REQ[0].chemin);
await w3.BdvSync.ecrireSuivi('C1', { proprietaire: null });
t('apres le lot 33, « Personne » part en null EXPLICITE', w3.__REQ[1] && w3.__REQ[1].corps[0].proprietaire === null, JSON.stringify(w3.__REQ[1]));
await w3.BdvSync.ecrireSuivi('C1', { tags: ['X'] });
t('et un geste qui ne touche pas au proprietaire ne l\'envoie pas', !('proprietaire' in w3.__REQ[2].corps[0]));
await w3.BdvSync.ecrireSuiviLot([{ id: 'C1', fiche: { tags: ['A'] } }, { id: 'C2', fiche: { tags: ['A'] } }]);
t('l\'ecriture groupee part en UNE requete, avec son bureau',
  w3.__REQ[3] && w3.__REQ[3].corps.length === 2 && /on_conflict=bureau,client_id/.test(w3.__REQ[3].chemin));
await w3.BdvSync.lireVues();
t('les vues se lisent dans le bureau courant', /\/vues_clients\?.*bureau=eq\.b1/.test(w3.__REQ[4].chemin), w3.__REQ[4].chemin);

/* ---- 7. un « je ne sais pas » du lot 33 ne tourne pas en boucle (29/09/2026, lot 44) ----
   Hors ligne, `lot33()` rend null. Avant, chaque dessin de fiche redemandait au serveur et
   la reponse redessinait la fiche, qui redemandait : onglet fige. Verifie par mutation
   (retour de l'ancien `_pret = null`, redessin sur un echec, relance sur `peindre()`,
   tentatives illimitees) : chaque fois un controle ci-dessous echoue.
   Les fenetres des sections d'avant sont FERMEES : leurs minuteries (le moteur des ventes
   demarre en differe) tomberaient pendant les attentes de celle-ci. */
/* ---- 8. « Nouvelle commande », lot 46 ---- */
console.log('== 8. « Nouvelle commande » sur la fiche, dans ses trois contenants ==');
{
  const q8 = s => w.document.querySelector(s);
  const ecritsAvant = w.__ECRITS.length, supprAvant = w.__SUPPR.length;
  const reseau = [], stockes = [], navs = [];
  const fetchAvant = w.fetch;
  /* Une reponse vide et pas un refus : un refus non rattrape arreterait le banc au lieu de le faire echouer. */
  w.fetch = function (u) { reseau.push(String(u)); return Promise.resolve({ ok: false, status: 503, json: async () => null, text: async () => '' }); };
  const P = w.Storage.prototype, setI = P.setItem, rmI = P.removeItem;
  P.setItem = function (k, v) { stockes.push('set:' + k); return setI.call(this, k, v); };
  P.removeItem = function (k) { stockes.push('rm:' + k); return rmI.call(this, k); };
  const navAvant = w.BdvNav;
  w.BdvNav = { afficher: (x) => { navs.push(x); } };
  const hashAvant = w.location.hash;
  const contenants = [
    ['en modale', () => { w.document.body.classList.remove('bdv-page-fiche'); delete w.BdvTiroir; }],
    ['en tiroir', () => { w.document.body.classList.remove('bdv-page-fiche'); w.BdvTiroir = { actif: () => true, poser: () => true, retirer: () => {} }; }],
    ['en pleine page', () => { delete w.BdvTiroir; w.document.body.classList.add('bdv-page-fiche'); }]
  ];
  for (const [nom, poser] of contenants) {
    w.__x(`fermerFiche()`);
    poser();
    w.__x(`ouvrirFiche('C1','')`);
    const b = q8('#modale .fiche__actions [data-bientot="commande"]');
    const mot = q8('#modale #ficheBientot');
    t(nom + ' : « Commande bientôt » est dans la rangee des actions, apres « Nouvelle affaire »',
      !!b && /^Commande\s+bientôt$/.test(b.textContent.trim()) && b.previousElementSibling && /Nouvelle affaire/.test(b.previousElementSibling.textContent),
      b && b.outerHTML);
    { const vu = b ? b.textContent.trim().replace(/\s+/g, ' ').toLowerCase() : '', nomA = b ? (b.getAttribute('aria-label') || '').toLowerCase() : '';
      t(nom + ' : son nom accessible commence par le texte visible (WCAG 2.5.3) et dit « nouvelle commande »',
        !!nomA && nomA.startsWith(vu) && /nouvelle commande/.test(nomA), nomA); }
    t(nom + ' : il dit « bientôt », aria-disabled="true" et PAS disabled', !!b && /bientôt/.test(b.textContent)
      && b.getAttribute('aria-disabled') === 'true' && !b.hasAttribute('disabled') && !b.disabled);
    t(nom + ' : pas dessine en bouton qui promet (ni plein, ni fantome)', !!b && b.classList.contains('btn--bientot')
      && !b.classList.contains('btn--primary') && !b.classList.contains('btn--ghost'));
    t(nom + ' : la ligne d\'explication est la, vide, juste sous la rangee, annoncee poliment', !!mot && mot.textContent === ''
      && mot.getAttribute('aria-live') === 'polite' && !mot.hidden && b && b.parentNode.nextElementSibling === mot && b.getAttribute('aria-describedby') === mot.id);
    stockes.length = 0;
    const defiles = [];
    w.Element.prototype.scrollIntoView = function (o) { defiles.push({ n: this, o: o || null }); };
    const calme = nom === 'en pleine page';
    if (calme) w.matchMedia = (q) => ({ matches: /prefers-reduced-motion: reduce/.test(q), addEventListener() {}, removeEventListener() {} });
    b.focus();
    t(nom + ' : le bouton prend le focus', w.document.activeElement === b);
    b.click();
    await new Promise(r => setTimeout(r, 20));
    if (calme) delete w.matchMedia;
    const txt = mot.textContent;
    t(nom + ' : un appui ouvre l\'explication, qui nomme le client', /^Bientôt : tu saisiras ici une commande pour Domaine Neuf, sans ouvrir d’affaire/.test(txt), txt);
    t(nom + ' : le vrai chemin (prete pour Vitisoft, pas envoyee) et le geste d\'en attendant',
      /prête pour Vitisoft\./.test(txt) && !/partira/.test(txt) && /En attendant, saisis-la dans Vitisoft\.$/.test(txt), txt);
    t(nom + ' : courte, trois lignes a 390 px (moins de 150 signes avec « Domaine Neuf »)', txt.length <= 150, txt.length);
    t(nom + ' : la phrase est ramenee dans la vue, au plus pres' + (calme ? ', sans animation (mouvements reduits)' : ', en douceur'),
      defiles.some(d => d.n === mot && d.o && d.o.block === 'nearest' && d.o.behavior === (calme ? 'auto' : 'smooth')), JSON.stringify(defiles.map(d => d.o)));
    t(nom + ' : ni date, ni « en un clic », ni tiret cadratin', !/\d|en un clic|—/.test(txt), txt);
    t(nom + ' : aucune ecriture, aucune requete, rien dans le stockage',
      w.__ECRITS.length === ecritsAvant && w.__SUPPR.length === supprAvant && reseau.length === 0 && stockes.length === 0,
      [w.__ECRITS.length - ecritsAvant, w.__SUPPR.length - supprAvant, reseau.join(' '), stockes.join(' ')].join(' / '));
    t(nom + ' : et aucune affaire ne part (ni piece ouverte, ni adresse changee)', navs.length === 0 && w.location.hash === hashAvant
      && q8('#modale').classList.contains('on'), navs.join() + ' ' + w.location.hash);
  }
  /* Hors pleine page AVANT de fermer : en pleine page, fermer la fiche ferme l'onglet. */
  w.document.body.classList.remove('bdv-page-fiche'); delete w.BdvTiroir;
  w.__x(`fermerFiche()`);
  w.fetch = fetchAvant; P.setItem = setI; P.removeItem = rmI; w.BdvNav = navAvant;

  /* Le dessin : sans ce rendu, style.css (`[aria-disabled]` : pointer-events:none,
     opacite 0.45) mangerait l'appui et rendrait le mot illisible dehors. */
  const css8 = fs.readFileSync(path.join(RACINE, 'src/css/bdv-ecrans.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const r8 = (css8.match(/\.bdv-ventes \.btn--bientot\[aria-disabled="true"\]\s*\{([^}]*)\}/) || [])[1] || '';
  t('bdv-ecrans.css rend l\'appui et l\'encre au bouton en attente', /pointer-events:\s*auto/.test(r8) && /opacity:\s*1\b/.test(r8) && /dashed/.test(r8), r8);
}

w.close(); w2.close(); w3.close();
console.log('== 7. Hors ligne : la fiche ne redemande pas le lot 33 en boucle ==');
const d4 = new JSDOM(`<!doctype html><body>
  <section class="panel on" id="p-annuaire"></section>
  <div id="modale" class="bdv-ventes modale"></div>
  <div id="status"></div><div id="statusTxt"></div><div id="statusSpin"></div>
  <div id="busyov"></div><div id="busytxt"></div>
</body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w4 = d4.window;
/* Le moteur des ventes demarre sur DOMContentLoaded et veut tout l'ecran (#app) : on laisse
   passer l'evenement AVANT de charger les scripts, cette fenetre ne teste que la fiche. */
const charge = (d) => d.window.document.readyState !== 'loading' ? Promise.resolve()
  : new Promise(r => d.window.document.addEventListener('DOMContentLoaded', r));
await charge(d4);
w4.Chart = function(){ this.destroy = () => {}; };
w4.Papa = {};
w4.__N33 = 0; w4.__DESSINS = 0; w4.__REPONSES = [null, null, null, null];
w4.BdvSync = { pret: () => true, ecrireSuiviLot: async () => true, ecrireSuivi: async () => true, supprimerSuivi: async () => true,
  lot33: async () => { w4.__N33++; return w4.__REPONSES.length ? w4.__REPONSES.shift() : null; }, lireVues: async () => null };
w4.eval(fs.readFileSync(R + 'bdv-base.js', 'utf8') + '\n' + fs.readFileSync(R + 'bdv-ecrans.js', 'utf8') + '\n'
  + fs.readFileSync(R + 'bdv-annuaire.js', 'utf8') + `
  FICHE_ID = 'C1';
  /* La vraie fiche redessine son suivi, qui rappelle blocFiche : on garde ce circuit. */
  redessinerSuivi = function(id){ window.__DESSINS++; if(window.__DESSINS < 50) BdvAnnuaire.blocFiche(id, {}); };
  window.__x4 = function(code){ return eval(code); };
`);
const tic = async (n) => { for (let i = 0; i < (n || 10); i++) await new Promise(r => setTimeout(r, 0)); };
const visible = () => { Object.defineProperty(d4.window.document, 'visibilityState', { value: 'visible', configurable: true });
  d4.window.document.dispatchEvent(new w4.Event('visibilitychange')); };
for (let i = 0; i < 5; i++) { w4.__x4(`BdvAnnuaire.blocFiche('C1', {})`); await tic(1); }
await tic();
t('cinq dessins de fiche hors ligne : UNE seule question au serveur', w4.__N33 === 1, 'lot33 appele ' + w4.__N33 + ' fois');
t('une reponse inconnue ne redessine rien (pas de boucle)', w4.__DESSINS === 0, w4.__DESSINS + ' redessins');
w4.__x4(`BdvAnnuaire.peindre()`); await tic();
for (let i = 0; i < 5; i++) { w4.__x4(`BdvAnnuaire.blocFiche('C1', {})`); await tic(1); }
t('ni ouvrir « Mes clients » ni d\'autres dessins ne reposent la question', w4.__N33 === 1, 'lot33 appele ' + w4.__N33 + ' fois');
visible(); await tic();
t('le retour sur l\'onglet retente UNE fois', w4.__N33 === 2, 'lot33 appele ' + w4.__N33 + ' fois');
visible(); await tic(); visible(); await tic();
w4.__x4(`BdvAnnuaire.etiqueter(['C1'], 'vip', true)`); await tic();
t('puis plus jamais, ni au retour, ni sur un geste d\'ecriture', w4.__N33 === 2, 'lot33 appele ' + w4.__N33 + ' fois');
t('toujours inconnu : aucun redessin, et « Suivi par » ne se montre pas',
  w4.__DESSINS === 0 && !/ficheProprio/.test(w4.__x4(`BdvAnnuaire.blocFiche('C1', {})`)), w4.__DESSINS + ' redessins');
t('toujours inconnu : l\'attribution reste fermee', w4.__x4(`BdvAnnuaire._etat().LOT33`) === null);

/* Un geste d'ecriture est l'autre porte de la nouvelle tentative, et un « oui » redessine. */
const d5 = new JSDOM(`<!doctype html><body><section class="panel on" id="p-annuaire"></section>
  <div id="modale" class="bdv-ventes modale"></div><div id="status"></div><div id="statusTxt"></div><div id="statusSpin"></div>
  <div id="busyov"></div><div id="busytxt"></div></body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w5 = d5.window;
await charge(d5);
w5.Chart = function(){ this.destroy = () => {}; }; w5.Papa = {};
w5.__N33 = 0; w5.__DESSINS = 0; w5.__REPONSES = [null, true];
w5.BdvSync = { pret: () => true, ecrireSuiviLot: async () => true, ecrireSuivi: async () => true, supprimerSuivi: async () => true,
  lot33: async () => { w5.__N33++; return w5.__REPONSES.length ? w5.__REPONSES.shift() : null; }, lireVues: async () => null };
w5.eval(fs.readFileSync(R + 'bdv-base.js', 'utf8') + '\n' + fs.readFileSync(R + 'bdv-ecrans.js', 'utf8') + '\n'
  + fs.readFileSync(R + 'bdv-annuaire.js', 'utf8') + `
  FICHE_ID = 'C1';
  redessinerSuivi = function(id){ window.__DESSINS++; };
  window.__x5 = function(code){ return eval(code); };
`);
const tic5 = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setTimeout(r, 0)); };
w5.__x5(`BdvAnnuaire.blocFiche('C1', {})`); await tic5();
w5.__x5(`BdvAnnuaire.etiqueter(['C1'], 'vip', true)`); await tic5();
t('un geste d\'ecriture retente la question une fois', w5.__N33 === 2, 'lot33 appele ' + w5.__N33 + ' fois');
t('et un « oui » redessine la fiche une fois', w5.__DESSINS === 1 && w5.__x5(`BdvAnnuaire._etat().LOT33`) === true, w5.__DESSINS + ' redessins');
w4.close(); w5.close();

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
console.log(ko ? '  « MES CLIENTS » NE TIENT PAS SES PROMESSES' : '  « MES CLIENTS » TIENT SES PROMESSES');
process.exit(ko ? 1 : 0);
