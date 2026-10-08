/* ============================================================================
   BANC DE « MON COMMERCE », ecrit le 11/09/2026 au lot 5 de la redecoupe.

   CE QU'IL GARDE. Deux choses qu'aucun autre controle ne voit.

   1. LE RENVOI EST EN TETE, AVANT LA LISTE. « D'ou vient ta variation » et ses
      quatre lignes de mouvement de clientele sont reparties dans « Mon cap » au
      lot 45 (29/09/2026) : ici il reste UNE ligne, sans chiffre, et un lien qui y
      mene. Le tableau des quatre mouvements ne doit pas revenir dans la piece.

   2. LES QUATRE EXPORTS DE LISTES COMPLETES SONT ATTEIGNABLES. Leurs boutons
      vivaient dans trois ecrans masques depuis la fusion du 07/09 : Ted ne
      pouvait plus les cliquer, et rien n'echouait, parce qu'un bouton qu'on
      n'affiche pas ne se plaint jamais. C'est exactement le genre de perte qu'un
      banc de structure ne rattrape pas tout seul.

   Meme harnais que banc-registre.mjs et banc-cap.mjs, et meme piege : UN SEUL
   `eval`, parce que les globales du moteur sont declarees en `let` et `const`.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
const R = path.join(RACINE, 'src/js') + '/';
const dom = new JSDOM(`<!doctype html><body>
  <div class="filterbar" id="filterbar"></div>
  <section class="panel" id="p-clients"></section>
  <div id="status"></div><div id="statusTxt"></div><div id="statusSpin"></div>
  <div id="busyov"></div><div id="busytxt"></div>
</body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w = dom.window;
w.Chart = function(){ this.destroy=()=>{}; };
w.Papa = {};

const lignes = [];
/* DIX-NEUF MOIS, ET PAS VINGT-QUATRE : 2025 entier puis 2026 arrete en juillet, comme la
   vraie base de Ted. Avec vingt-quatre mois l'exercice courant est COMPLET, computeAtterrissage()
   repond « annee cloturee », et ni l'atterrissage ni l'ecart a l'objectif ne s'affichent. Une
   piece qui s'appelle « Mon cap » se controle sur un exercice en cours. */
for (let i=0;i<19;i++){
  const y = 2025+Math.floor(i/12), m = (i%12)+1;
  for (const [fam,canal,pu] of [['Rouge','Caveau',12],['Blanc','Export',9]]){
    lignes.push({famille:fam,couleur:fam,produit:'Cuvee '+fam,client:'Client '+(i%5),
      numClient:'C'+(i%5),numFacture:'F'+i+fam,codeTarif:'T1',millesime:String(y-1),
      appellation:'AOC Test',conditionnement:'75cl',cp:'44000',ville:'Nantes',pays:'France',
      _y:y,_m:m,_pu:pu,_q:50+i*3,_canal:canal});
  }
}

/* DES CLIENTS QUI DECROCHENT, sinon la piece n'a rien a montrer. Les cinq clients du
   dessus achetent tous les mois et en croissance : personne a rappeler, liste vide, et le
   banc a d'abord echoue sur ses quatre exports pour cette seule raison. Trois habitues de
   2025 qui ne reviennent pas en 2026 suffisent a peupler les trois analyses. */
for (const [nom, mois] of [['Domaine Dormant', 11], ['Cave Partie', 10], ['Bar Silencieux', 9]]) {
  for (let m = 1; m <= mois; m++) {
    lignes.push({famille:'Rouge',couleur:'Rouge',produit:'Cuvee Rouge',client:nom,
      numClient:nom,numFacture:'X'+nom+m,codeTarif:'T1',millesime:'2024',
      appellation:'AOC Test',conditionnement:'75cl',cp:'44000',ville:'Nantes',pays:'France',
      _y:2025,_m:m,_pu:14,_q:80,_canal:'Caveau'});
  }
}

/* LOT 45 : DEUX MOTIFS, ET UN CLIENT EN AFFAIRE DANS CHACUN, sinon un filtre faux passe
   (un retrait qui n'agirait que sur « Recul confirme » ne se verrait pas : defaut deja vu
   a la partie A). Deux habitues reguliers depuis juin 2025, muets depuis avril 2026 : ils
   ne reculent pas a date egale (rien avant juin 2025), ils rompent leur rythme. */
for (const [nom, q] of [['Cave Rythmee', 60], ['Epicerie Reguliere', 40]]) {
  for (let k = 0; k < 11; k++) {
    const y = 2025 + Math.floor((5 + k) / 12), m = ((5 + k) % 12) + 1;
    lignes.push({famille:'Rouge',couleur:'Rouge',produit:'Cuvee Rouge',client:nom,
      numClient:nom,numFacture:'R'+nom+k,codeTarif:'T1',millesime:'2024',
      appellation:'AOC Test',conditionnement:'75cl',cp:'44000',ville:'Nantes',pays:'France',
      _y:y,_m:m,_pu:14,_q:q,_canal:'Caveau'});
  }
}

const test = `
  ROWS.length = 0;
  JSON.parse(${JSON.stringify(JSON.stringify(lignes))}).forEach(function(o){
    var t = Date.UTC(o._y, o._m-1, 15);
    o._vin = true;
    o._date = {y:o._y, m:o._m, d:15, t:t};
    o._dayNum = Math.floor(t/86400000);
    o._exY = o._y; o._exM = o._m; o._exPos = o._m-1;
    o._qte = o._q; o._total = o._pu * o._q;
    ROWS.push(o);
  });
  computeMeta();
  window.__AVANT = window.bdvClientsASuivre();
  window.__EVT = 0; document.addEventListener('bdv:clients', function(){ window.__EVT++; });
  renderClients();
  window.__APRES = window.bdvClientsASuivre();
  window.__PARTIEL = window.bdvClientsASuivre.partiel();
  window.__SORTIE = { com: document.getElementById('p-clients').innerHTML };
  (function(){ var evt = window.__EVT, avant = filtreMotif; filtreMotif = 'tous'; renderClients();
    window.__SORTIE.tous = document.getElementById('p-clients').innerHTML;
    filtreMotif = 'premier'; renderClients();
    window.__SORTIE.premier = document.getElementById('p-clients').innerHTML;
    filtreMotif = avant; renderClients(); window.__EVT = evt; })();
  window.__SORTIE.pied = piedCommerce();
  window.__PRE = PRETEXTES;
  /* Les globales en let du moteur ne sortent pas de cet eval : ces crochets y restent. */
  window.__ecran = function(id){ ECRAN_COURANT = id; };
  window.__peint = function(id){ ECRANS_PEINTS.add(id); };
  window.__peints = function(){ return Array.from(ECRANS_PEINTS); };
  window.__motifs = function(){ return CLIENTS.map(function(c){ return c.id + ':' + c.motif; }); };
  window.__filtre = function(m){ filtreMotif = m; };
`;

try {
  w.eval(fs.readFileSync(R+'bdv-base.js','utf8') + '\n' + fs.readFileSync(R+'bdv-ecrans.js','utf8') + '\n' + test);
} catch(e) {
  console.log('ECHEC a l\'execution : ' + e.message);
  console.log((e.stack||'').split('\n').slice(0,4).join('\n'));
  process.exit(1);
}

const h = w.__SORTIE.com;
let ko = 0;
const SRCE = fs.readFileSync(path.join(RACINE, 'src/js/bdv-ecrans.js'), 'utf8');
const t = (nom, ok, det) => { if(!ok) ko++; console.log((ok?'  ok    : ':'  ECHEC : ')+nom+(ok||!det?'':'  -> '+det)); };

console.log('== Mon commerce : la piece ==');
t('le titre dit « Mon commerce »', h.includes('>Mon commerce<'));
t('un seul titre de panneau', (h.match(/panel__title/g)||[]).length === 1);

console.log('== etage 1 : le renvoi vers Mon cap, avant la liste (lot 45) ==');
{
  const d = w.document;
  const r = d.querySelector('#p-clients .renvoi-cap');
  const txt = r ? r.textContent : '';
  t('une ligne renvoie vers Mon cap, « Ce qui explique ta variation »',
    !!r && /D'où vient ta variation d'un an sur l'autre : c'est dans Mon cap, « Ce qui explique ta variation »\./.test(txt) && !!r.querySelector('b') && r.querySelector('b').textContent === 'Mon cap', txt);
  t('elle est AU-DESSUS de « Choisis ta liste de travail »', h.indexOf('renvoi-cap') >= 0 && h.indexOf('renvoi-cap') < h.indexOf('Choisis ta liste de travail'));
  const a = r && r.querySelector('a');
  t('avec le lien « Voir dans Mon cap », vers #annee', !!a && a.textContent === 'Voir dans Mon cap' && /#annee$/.test(a.getAttribute('href')) && /voirVariation\(\)/.test(a.getAttribute('onclick') || ''));
  t('le renvoi ne porte aucun chiffre', !/\d/.test(txt), txt);
  t('le tableau des quatre mouvements n\'est plus dans la piece',
    !h.includes('mouvement de clientèle') && !h.includes('Clients perdus') && !h.includes('Variation totale'));
  t('ni le verdict ni son ancien repli', !h.includes('pied-variation') && !h.includes('Tu gagnes plus') && !h.includes('Tu perds plus'));
  const vu = [];
  w.BdvNav = { afficher: (id, o) => vu.push(id) };
  w.voirVariation();
  t('« Voir dans Mon cap » ouvre la piece Mon cap', vu.join() === 'annee', vu.join());
  delete w.BdvNav;
}

console.log('== 06/10/2026 : « Qui pèse quoi » est parti dans Mon cap ==');
t('il n\'est plus dans Mon commerce', !h.includes('Qui pèse quoi') && !w.__SORTIE.tous.includes('Qui pèse quoi'));
t('piedCommerce() le rend toujours, replie, top clients dedans',
  w.__SORTIE.pied.includes('Qui pèse quoi dans ton chiffre') && w.__SORTIE.pied.indexOf('CA HT</th>') > w.__SORTIE.pied.indexOf('Qui pèse quoi'));
t('renderCap() le pose apres « Ce qui explique ta variation »',
  /id="pied-cap">[\s\S]*?<\/details><\/div>`;[\s\S]{0,600}html\+=piedCommerce\(\);/.test(SRCE));
{ const coque = fs.readFileSync(path.join(RACINE, 'src/_includes/components/ecrans-vente.njk'), 'utf8');
  t('plus de barre du haut nulle part (depot, PDF, Excel)',
    !/class="topbar"/.test(coque) && !/showImport\(\)|exportPDF\(\)|exportExcel\(\)/.test(coque) && /<span id="tbFile" hidden><\/span>/.test(coque)); }

/* 08/10/2026, la page de travail (demande de Ted) : en pleine page, « Nouvelle affaire » ne
   recharge plus rien, elle s'ouvre A DROITE de la fiche, en tiroir qui pousse la page. */
t('pleine page : « Nouvelle affaire » s\'ouvre a droite de la fiche, sans recharger',
  /if\(pageFiche\(\)\)\{[\s\S]{0,400}?affaireACote\(/.test(SRCE) && !/if\(pageFiche\(\)\)\{location\.href='\/mon-bureau\/#affaires'/.test(SRCE));
{ const d0 = new w.DOMParser().parseFromString('<table>'+h.slice(h.indexOf('<tbody id="clientsBody"'), h.indexOf('</tbody>')+8)+'</table>','text/html');
  const ls = [...d0.querySelectorAll('tr.suivre__l')];
  t('chaque client a son lien « nouvel onglet » vers sa fiche en pleine page',
    ls.length > 0 && ls.every(r => { const a = r.querySelector('a.suivre__onglet'); return a && a.target === '_blank' && /^\/mon-bureau\/#fiche=/.test(a.getAttribute('href')) && /nouvel onglet/.test(a.textContent); })); }
console.log('== 06/10/2026 : le titre invite a choisir une tuile ==');
t('« Qui rappeler » devient « Choisis ta liste de travail »', h.includes('Choisis ta liste de travail') && !h.includes('>Qui rappeler<'));
t('une phrase visible dit de toucher une tuile, avant les tuiles',
  h.includes('Touche une tuile') && h.indexOf('Touche une tuile') < h.indexOf('motif-cards'));

console.log('== les quatre listes completes, sous les tuiles ==');
const T = w.__SORTIE.tous;
[['exportReactList','relance'],['exportDecroList','decrochage'],
 ['exportPremierList','premiers achats prioritaires'],['exportReste','premiers achats, le reste']]
  .forEach(([fn,quoi]) => t('avec « Tous », l\'export « '+quoi+' » a un bouton sous les tuiles',
    T.includes(fn+'()') && T.indexOf(fn+'()') > T.indexOf('motif-cards') && T.indexOf(fn+'()') < T.indexOf('clientsBody')));
t('« Premier achat » ne montre que ses deux listes', w.__SORTIE.premier.includes('exportPremierList()') && w.__SORTIE.premier.includes('exportReste()') && !w.__SORTIE.premier.includes('exportDecroList()'));
t('le bloc du bas « Sortir tes listes complètes » est parti', !T.includes('Sortir tes listes complètes'));

/* ---------------------------------------------------------------------------
   LOT 44, 29/09/2026 : « EN FAIRE UNE AFFAIRE » SUR CHAQUE CLIENT A SUIVRE.
   Le geste reprend le chemin de « Nouvelle affaire » de la fiche (sessionStorage
   `bdv_affaire_client`, puis « A gagner »), et dit « Voir son affaire » quand le
   client en a deja une : BdvAffairesJour le sait, on ne cree pas de deuxieme.
   Verifie par mutation le 29/09/2026 : geste retire de la ligne, mot non pose,
   « A gagner » non ouvert, affaire en cours ignoree, bouton remis dans un
   <tr role=button> : chaque fois le controle vise echoue.
   --------------------------------------------------------------------------- */
console.log('== lot 44 : en faire une affaire ==');
{
  const d = w.document;
  const rangees = [...d.querySelectorAll('#clientsBody tr')];
  const gestes = [...d.querySelectorAll('#clientsBody tr .suivre__geste')];
  t('il y a des clients a suivre dans la liste', rangees.length >= 3, rangees.length);
  t('chaque ligne porte le geste « En faire une affaire »', rangees.length > 0
    && rangees.every(r => { const g = r.querySelector('.suivre__geste'); return g && /^En faire une affaire/.test(g.textContent); }),
    rangees.map(r => (r.querySelector('.suivre__geste') || {}).textContent).join(' | '));
  t('le geste est un bouton dessine (.btn, pas un geste nu ni creux)',
    gestes.length > 0 && gestes.every(g => g.tagName === 'BUTTON' && g.classList.contains('btn') && g.classList.contains('btn--light')));
  t('aucun element interactif dans un autre (ligne, lien, bouton)',
    !d.querySelector('#clientsBody [role="button"] button, #clientsBody [role="button"] a, #clientsBody tr[onclick], #clientsBody button button, #clientsBody button a, #clientsBody a button'));
  t('le nom reste le geste qui ouvre la fiche', rangees.every(r => /ouvrirFiche\(/.test((r.querySelector('button.suivre__nom') || { getAttribute: () => '' }).getAttribute('onclick') || '')));

  const appels = [];
  w.BdvNav = { afficher: (id) => appels.push(id) };
  const cible = rangees.find(r => /Domaine Dormant/.test(r.textContent)) || rangees[0];
  const idCible = cible.querySelector('.suivre__geste').getAttribute('data-id');
  w.sessionStorage.clear();
  /* jsdom en `outside-only` n'execute pas les `onclick` ecrits dans le HTML : on appelle
     ce que l'attribut appelle, et un controle plus bas lit l'attribut lui-meme. */
  const cliquer = (b) => w.ficheNouvelleAffaire(b);
  cliquer(cible.querySelector('.suivre__geste'));
  let mot = null; try { mot = JSON.parse(w.sessionStorage.getItem('bdv_affaire_client')); } catch (e) {}
  t('le clic laisse le client a la piece, comme la fiche (bdv_affaire_client)',
    !!mot && mot.id === idCible && !!mot.nom && mot.nom === cible.querySelector('.suivre__geste').getAttribute('data-nom'), JSON.stringify(mot));
  t('avec sa raison et un pretexte de rappel, lus a l\'ecran', !!mot && !!mot.raison && !!mot.pretexte, JSON.stringify(mot));
  /* L'enjeu est le montant que la LIGNE affiche deja, avec sa nature : rien de recalcule. */
  const montantLigne = cible.querySelectorAll('td')[3].textContent.replace(/\s+/g, ' ').trim();
  t('et l\'enjeu que la ligne affiche (montant et sa nature)', !!mot && !!mot.enjeu
    && mot.enjeu.replace(/\s+/g, '') === montantLigne.replace(/\s+/g, ''), (mot && mot.enjeu) + ' / ' + montantLigne);
  const pre = w.__PRE || {};
  t('les cinq pretextes existent et tiennent en moins de 40 signes',
    ['recul', 'cadence', 'deuxieme', 'saison', 'premier'].every(k => typeof pre[k] === 'string' && pre[k].length > 0 && [...pre[k]].length < 40),
    JSON.stringify(Object.fromEntries(Object.entries(pre).map(([k, v]) => [k, [...v].length]))));
  t('et ouvre « A gagner »', appels.length === 1 && appels[0] === 'affaires', JSON.stringify(appels));
  t('la fiche et la liste passent par la meme fonction',
    /ficheNouvelleAffaire\(this\)/.test(cible.querySelector('.suivre__geste').getAttribute('onclick') || ''));

  /* Le client a deja une affaire en cours : les affaires arrivent APRES la liste. */
  w.BdvAffairesJour = { duClient: (id) => id === idCible ? [{ affaire_id: 'aff-1', titre: 'Le rosé', client_id: id }] : [] };
  const g1 = d.querySelector('#clientsBody .suivre__geste[data-id="' + idCible + '"]');
  g1.focus();
  d.dispatchEvent(new w.CustomEvent('bdv:taches'));
  const g2 = d.querySelector('#clientsBody .suivre__geste[data-id="' + idCible + '"]');
  t('le libelle change EN PLACE : meme bouton, le focus clavier reste dessus', g2 === g1 && d.activeElement === g1,
    'bouton remplace : ' + (g2 !== g1) + ', focus sur ' + (d.activeElement && d.activeElement.tagName));
  t('le nom du client reste lu apres le libelle', /, /.test((g2.querySelector('.hors-ecran') || {}).textContent || ''));
  t('un client qui a deja une affaire : « Voir son affaire »', !!g2 && /^Voir son affaire/.test(g2.textContent), g2 && g2.textContent);
  t('les autres gardent « En faire une affaire »',
    [...d.querySelectorAll('#clientsBody .suivre__geste')].filter(g => g !== g2).every(g => /^En faire une affaire/.test(g.textContent)));
  w.sessionStorage.clear(); appels.length = 0;
  cliquer(g2);
  t('« Voir son affaire » ne propose pas d\'en creer une deuxieme', w.sessionStorage.getItem('bdv_affaire_client') === null);
  t('il demande a la piece d\'ouvrir CETTE affaire', w.sessionStorage.getItem('bdv_affaire_ouvrir') === 'aff-1' && appels[0] === 'affaires',
    w.sessionStorage.getItem('bdv_affaire_ouvrir') + ' ' + JSON.stringify(appels));
  /* LOT 45 : ce stub ne sait pas `clientsEnAffaire` (= affaires pas lues, null) : personne
     ne sort, et c'est justement le seul cas ou « Voir son affaire » sert encore (liste
     peinte avant l'arrivee des affaires, puis visible : on ne la repeint pas). */
  t('affaires pas lues (clientsEnAffaire absent) : personne ne quitte la liste',
    d.querySelectorAll('#clientsBody tr').length === rangees.length);
  t('pas de tiret cadratin dans les gestes', !/—/.test(d.getElementById('clientsBody').textContent));
}

/* LOT 45, 29/09/2026 : LE NOMBRE DU BILAN COMMUN. `bdvClientsASuivre()` rend `null`
   tant que la liste n'est pas calculee (jamais « 0 »), puis le nombre de la carte
   « Tous » ; renderClients() previent le bilan par `bdv:clients`. Mutation verifiee. */
console.log('== lot 45 : le nombre du bilan commun ==');
{
  const tous = [...w.document.querySelectorAll('#p-clients .motif-card')].find(c => /Tous/.test(c.querySelector('.motif-card__l').textContent));
  const nTous = tous ? +tous.querySelector('.motif-card__n').textContent.replace(/\D/g, '') : NaN;
  t('avant le calcul, bdvClientsASuivre() rend null, pas 0', w.__AVANT === null, String(w.__AVANT));
  t('apres renderClients(), le nombre de la carte « Tous »', w.__APRES === nTous && nTous > 0, w.__APRES + ' / ' + nTous);
  t('lignes chargees : pas « partiel »', w.__PARTIEL === false);
  t('renderClients() emet bdv:clients en sortant', w.__EVT === 1, String(w.__EVT));
}

/* ---------------------------------------------------------------------------
   LOT 45, PARTIE B, 29/09/2026 : UN CLIENT, UNE FOIS, L'AFFAIRE L'EMPORTE.
   Un client qui a une affaire en cours sort de « Clients a suivre » : cartes, « Tous »,
   liste, export, nombre du bilan. Affaires pas lues (`null`) : personne ne sort, pas de
   note. Liste VISIBLE quand les affaires bougent : on ne la repeint pas sous les yeux.
   Deux motifs, un client en affaire dans chacun. Verifie par mutation.
   --------------------------------------------------------------------------- */
console.log('== lot 45 : un client, une fois ==');
{
  const d = w.document;
  const cartes = () => Object.fromEntries([...d.querySelectorAll('#p-clients .motif-card')].map(c =>
    [c.querySelector('.motif-card__l').textContent, +c.querySelector('.motif-card__n').textContent.replace(/\D/g, '')]));
  const noms = () => [...d.querySelectorAll('#clientsBody tr')].map(r => r.getAttribute('data-nom'));
  const note = () => d.querySelector('#p-clients .note-affaire');
  const mot = w.__motifs();
  t('le decor porte deux motifs, et deux clients dans chacun',
    mot.filter(x => /:recul$/.test(x)).length >= 2 && mot.filter(x => /:cadence$/.test(x)).length >= 2, mot.join(','));
  w.__filtre('tous'); w.__ecran(null);
  let SET = null;
  w.BdvAffairesJour = { duClient: (id) => (SET && SET.has(id)) ? [{ affaire_id: 'aff-' + id, titre: 'x', client_id: id }] : [],
                        clientsEnAffaire: () => SET };
  w.renderClients();
  const n0 = noms().length;
  t('affaires pas lues (null) : tout le monde reste, pas de note', n0 === mot.length && !note() && cartes()['Tous'] === mot.length, n0 + ' / ' + mot.length);
  /* Liste CACHEE : les affaires arrivent, on repeint. */
  let evt = 0; d.addEventListener('bdv:clients', () => evt++);
  SET = new Set(['Cave Partie', 'Cave Rythmee']);
  d.dispatchEvent(new w.CustomEvent('bdv:taches'));
  const c1 = cartes();
  t('liste cachee : bdv:taches la repeint, les deux clients en affaire sortent',
    noms().length === n0 - 2 && !noms().includes('cave partie') && !noms().includes('cave rythmee'), noms().join(','));
  t('un dans chaque motif : « Recul confirmé » et « Retard de cadence » perdent chacun le leur',
    c1['Recul confirmé'] === mot.filter(x => /:recul$/.test(x)).length - 1 && c1['Retard de cadence'] === mot.filter(x => /:cadence$/.test(x)).length - 1, JSON.stringify(c1));
  t('la carte « Tous » = les rangees de la liste', c1['Tous'] === noms().length, c1['Tous'] + ' / ' + noms().length);
  t('le nombre du bilan = la carte « Tous », apres retrait', w.bdvClientsASuivre() === c1['Tous'], w.bdvClientsASuivre());
  t('et le bilan est prevenu (bdv:clients)', evt >= 1, evt);
  const nt = note();
  t('la note : « 2 clients a suivre sont deja dans une affaire... »',
    !!nt && /^2 clients à suivre sont déjà dans une affaire : tu les retrouves dans « À gagner », avec leur raison\./.test(nt.textContent), nt && nt.textContent);
  t('sous « Choisis ta liste de travail », avant les cartes', h.length > 0 && (() => { const x = d.getElementById('p-clients').innerHTML; return x.indexOf('Choisis ta liste de travail') < x.indexOf('note-affaire') && x.indexOf('note-affaire') < x.indexOf('motif-cards'); })());
  /* V16 (tour 2) : a 390 px le premier client doit tenir dans le premier ecran. L'aide, la
     note de l'export et la note « deja dans une affaire » vivent dans UN repli dont le titre
     dit l'essentiel ; le renvoi vers Mon cap a sa forme courte ; les cartes tiennent en une
     rangee. Mesure du tour 2 : premier client a 1 513 px avant, 728 px apres (ecran 844). */
  { const rep = d.querySelector('#p-clients details.suivre__apropos');
    t('V16 : la note « deja dans une affaire » est dans le repli « A savoir », dont le titre le dit',
      !!rep && rep.contains(nt) && /^À savoir : 2 clients déjà dans une affaire$/.test(rep.querySelector('summary').textContent), rep && rep.querySelector('summary').textContent);
    const cssV = fs.readFileSync(path.join(RACINE, 'src/css/bdv-ecrans.css'), 'utf8').split('TOUR 2 (02/10/2026, devE)')[1] || '';
    t('V16 : sous 700 px, le renvoi court, les cartes sur une rangee, sans sous-ligne',
      /#p-clients \.renvoi-cap__long\{display:none\}/.test(cssV) && /#p-clients \.motif-cards\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/.test(cssV)
      && /#p-clients \.motif-card__s\{display:none\}/.test(cssV) && !!d.querySelector('#p-clients .renvoi-cap .renvoi-cap__court'));
    t('V16 : le bandeau « au juge » replie son explication, le bouton reste dehors',
      /details class="juge__pourquoi"/.test(SRCE) && /juge__regler/.test(SRCE)); }
  const b = nt && nt.querySelector('button');
  t('avec le bouton « Les voir dans À gagner »', !!b && b.textContent === 'Les voir dans À gagner' && /voirEnAffaires\(\)/.test(b.getAttribute('onclick') || ''));
  const vu = []; w.BdvNav = { afficher: (id, o) => vu.push(id + ':' + ((o || {}).onglet || '')) };
  w.sessionStorage.clear(); w.voirEnAffaires();
  t('qui ouvre « À gagner » sur « Toutes »', vu.join() === 'clients:gagner' && w.sessionStorage.getItem('bdv_affaire_vue') === '{"filtre":""}', vu.join() + ' ' + w.sessionStorage.getItem('bdv_affaire_vue'));
  delete w.BdvNav;
  /* L'export sort ce que la liste montre. */
  let sortie = null; w.toXlsxOrCsv = (feuilles) => { sortie = feuilles; };
  w.exportClients();
  const lignesX = sortie ? sortie[0].aoa.slice(1).map(l => l[0]) : [];
  t('l\'export exclut les clients en affaire', lignesX.length === noms().length && !lignesX.includes('Cave Partie') && !lignesX.includes('Cave Rythmee'), lignesX.join(','));
  /* La raison, pour « A gagner » : dans la liste ENTIERE. */
  const m1 = w.bdvMotifClient('Cave Partie');
  t('bdvMotifClient() rend la raison d\'un client en affaire', !!m1 && m1.label === 'Recul confirmé' && m1.cls === 'm-recul' && /perdus à date égale$/.test(m1.enjeu) && !!m1.detail, JSON.stringify(m1));
  t('et rien pour un inconnu', w.bdvMotifClient('Personne') === null);
  w.BdvNav = { avecVitisoft: () => false };
  t('ni sans Vitisoft', w.bdvMotifClient('Cave Partie') === null);
  delete w.BdvNav;
  /* Au singulier. */
  SET = new Set(['Cave Rythmee']);
  d.dispatchEvent(new w.CustomEvent('bdv:taches'));
  t('au singulier : « 1 client a suivre est deja dans une affaire : tu le retrouves... sa raison »',
    !!note() && /^1 client à suivre est déjà dans une affaire : tu le retrouves dans « À gagner », avec sa raison\./.test(note().textContent), note() && note().textContent);
  /* Liste VISIBLE : on ne repeint pas sous les yeux. */
  w.__ecran('clients'); w.__peint('clients');
  const g = d.querySelector('#clientsBody .suivre__geste[data-id="Domaine Dormant"]');
  g.focus();
  const avant = noms().join(',');
  SET = new Set(['Cave Rythmee', 'Domaine Dormant']);
  d.dispatchEvent(new w.CustomEvent('bdv:taches'));
  t('liste visible : pas repeinte, le focus reste sur le meme bouton', d.activeElement === g && g.isConnected && noms().join(',') === avant);
  t('le libelle du lot 44 se met a jour en place : « Voir son affaire »', /^Voir son affaire/.test(g.textContent), g.textContent);
  t('et la piece se repeindra au prochain affichage', !w.__peints().includes('clients'), w.__peints().join(','));
  w.__ecran(null);
  /* Tous en affaire : zero PARCE QUE tous y sont (le bilan le dit sans chiffre). */
  SET = new Set(mot.map(x => x.split(':')[0]));
  d.dispatchEvent(new w.CustomEvent('bdv:taches'));
  t('tous en affaire : liste vide, bilan a 0 et « tous en affaire » vrai',
    noms().length === 0 && w.bdvClientsASuivre() === 0 && w.bdvClientsASuivre.tousEnAffaire() === true, noms().length + ' ' + w.bdvClientsASuivre());
  t('et la note remplace « Personne a relancer »', !!note() && !/Personne à relancer/.test(d.getElementById('p-clients').textContent));
  /* Retour a null : personne ne sort. */
  SET = null;
  d.dispatchEvent(new w.CustomEvent('bdv:taches'));
  t('affaires de nouveau illisibles (null) : tout le monde revient, pas de note', noms().length === n0 && !note(), noms().length);
  delete w.BdvAffairesJour;
}

/* ---------------------------------------------------------------------------
   LOT 45, VERIFICATEUR (29/09/2026) : LA NATURE S'ACCORDE AVEC LE MONTANT.
   « 12 600 € acheté au total » face a « perdus » : au pluriel des 2 € (arrondis comme
   on les affiche), au singulier en dessous. Une fonction, partout ou une nature suit un
   montant : liste, cartes, geste du lot 44, raison lue par « A gagner », export.
   `c.lib` reste brut : fileSignaux(), le courrier et Ma journee ne changent pas.
   --------------------------------------------------------------------------- */
console.log('== lot 45 : la nature s\'accorde avec le montant ==');
{
  const d = w.document;
  w.__filtre('tous'); w.renderClients();
  const ligne = (nom) => [...d.querySelectorAll('#clientsBody tr')].find(r => r.getAttribute('data-nom') === nom);
  const nature = (nom) => { const r = ligne(nom); return r ? r.querySelectorAll('td')[3].querySelector('.why').textContent : null; };
  t('la liste : « achetés au total » apres un montant de plusieurs euros', nature('cave rythmee') === 'achetés au total', nature('cave rythmee'));
  t('et « perdus à date égale »', nature('cave partie') === 'perdus à date égale', nature('cave partie'));
  const carteS = (lbl) => { const c = [...d.querySelectorAll('#p-clients .motif-card')].find(x => x.querySelector('.motif-card__l').textContent === lbl); return c ? c.querySelector('.muted-cell').textContent : null; };
  t('les cartes : « achetés par eux au total », « perdus à date égale »',
    carteS('Retard de cadence') === 'achetés par eux au total' && carteS('Recul confirmé') === 'perdus à date égale');
  const g = ligne('cave rythmee').querySelector('.suivre__geste');
  t('le geste du lot 44 porte l\'enjeu accorde', /achetés au total$/.test(g.getAttribute('data-enjeu')), g.getAttribute('data-enjeu'));
  const m = w.bdvMotifClient('Cave Rythmee');
  t('la raison lue par « A gagner » aussi (enjeu et nature)', !!m && /achetés au total$/.test(m.enjeu) && m.lib === 'achetés au total', JSON.stringify(m));
  let sortie = null; w.toXlsxOrCsv = (f) => { sortie = f; }; w.exportClients();
  const lx = sortie ? sortie[0].aoa.find(l => l[0] === 'Cave Rythmee') : null;
  t('l\'export aussi', !!lx && lx[6] === 'achetés au total', lx && lx[6]);
  t('au singulier sous 2 € : 1 € « perdu », 1,4 € « acheté », 1,6 € arrondi a 2 « achetés »',
    w.natureAccordee(1, 'perdus à date égale') === 'perdu à date égale' && w.natureAccordee(1.4, 'acheté au total') === 'acheté au total'
    && w.natureAccordee(1.6, 'acheté au total') === 'achetés au total' && w.natureAccordee(0, 'achetés par eux au total') === 'acheté par eux au total');
  /* Sous 2 € a l'ecran : une liste d'un client a 1 €, posee a la place de agentClients(). */
  const vraie = w.agentClients;
  w.agentClients = () => [{ id: 'Petit', nom: 'Petit Client', motif: 'cadence', montant: 1, lib: 'acheté au total', detail: 'd', chance: null }];
  w.renderClients();
  t('sous 2 € : la carte dit « acheté par eux au total », la ligne « acheté au total »',
    carteS('Retard de cadence') === 'acheté par eux au total' && nature('petit client') === 'acheté au total', carteS('Retard de cadence') + ' / ' + nature('petit client'));
  w.agentClients = vraie; w.renderClients();
  t('une nature qui n\'est pas un participe ne bouge pas', w.natureAccordee(500, 'premier achat récent') === 'premier achat récent');
  t('c.lib reste brut pour le courrier et Ma journee (fileSignaux)',
    w.fileSignaux().some(c => c.lib === 'acheté au total'), w.fileSignaux().map(c => c.lib).join('|'));
}

/* ---------------------------------------------------------------------------
   01/10/2026, JUGE V16 : UNE CARTE A ZERO S'EFFACE, « n/d » QUITTE L'ECRAN, ET SUR
   TELEPHONE LES CARTES VONT PAR DEUX.
   --------------------------------------------------------------------------- */
console.log('== 01/10/2026 : cartes a zero, « n/d », cartes par deux sur telephone ==');
{
  const d = w.document;
  w.__filtre('tous'); w.renderClients();
  const cartes = [...d.querySelectorAll('#p-clients .motif-card')];
  const n = (c) => +c.querySelector('.motif-card__n').textContent.replace(/\D/g, '');
  const zeros = cartes.filter(c => n(c) === 0), pleines = cartes.filter(c => n(c) > 0);
  t('le decor a des cartes a zero ET des cartes pleines', zeros.length > 0 && pleines.length > 0, zeros.length + '/' + pleines.length);
  t('chaque carte a zero porte motif-card--zero', zeros.every(c => c.classList.contains('motif-card--zero')));
  t('aucune carte pleine ne la porte (ni « Tous »)', pleines.every(c => !c.classList.contains('motif-card--zero')));
  const txt = d.getElementById('p-clients').textContent;
  t('« n/d » n\'est plus nulle part dans la piece', !/n\/d/.test(txt));
  const sansChance = [...d.querySelectorAll('#clientsBody tr')].map(r => r.querySelectorAll('td')[4]).filter(td => td && !/%/.test(td.textContent));
  t('une chance non mesuree laisse la case vide a l\'oeil, dite a la synthese vocale',
    sansChance.length > 0 && sansChance.every(td => td.querySelector('.hors-ecran') && td.querySelector('.hors-ecran').textContent === 'pas mesurée'), sansChance.length);
  const css = fs.readFileSync(path.join(RACINE, 'src/css/bdv-ecrans.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  t('la carte a zero est en retrait (encre --bdv-encre-3) et perd sa ligne de montant',
    /\.motif-card--zero:not\(\.on\) \.motif-card__l\{color:var\(--bdv-encre-3\)/.test(css) && /\.motif-card--zero \.motif-card__s\{display:none\}/.test(css));
  t('sous 700 px, deux cartes par rangee, cible de 44 px',
    /@media \(max-width:700px\)\{\s*\.bdv-ventes \.motif-cards\{grid-template-columns:1fr 1fr;[^}]*\}\s*\.bdv-ventes \.motif-card\{[^}]*min-height:var\(--bdv-cible\)/.test(css));
}

console.log('\n== VERDICT ==\n  ' + (ko ? ko + ' echec(s)' : 'tous les controles passes, 0 en echec'));
process.exit(ko ? 1 : 0);
