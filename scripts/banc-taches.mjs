/* ============================================================================
   scripts/banc-taches.mjs : le banc de Mes taches

     npm run banc:taches

   ECRIT AVEC LA PIECE, le 07/09/2026. Il ne regarde pas l'ecran : il verifie LA
   CHARGE ENVOYEE au serveur pour chaque geste. C'est la lecon de la journee,
   payee deux fois : les signets sont restes vides pendant des jours parce que
   `id` manquait dans le corps, et l'objectif de CA s'effacait parce qu'un geste
   envoyait des colonnes qu'il n'avait pas modifiees. Dans les deux cas l'ecran
   disait la verite du miroir local, donc ne disait rien.

   IL DEMANDE jsdom :  npm install --save-dev jsdom
   Sans lui il s'arrete en le disant, et il ne rend jamais un faux OK.

   LES FICHIERS SONT POSES COMME DE VRAIS <script> DE LA PAGE : deux `eval`
   separes ne partagent pas les `let` de premier niveau, alors que deux <script>
   classiques d'une meme page, si.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RACINE, 'src/js');

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) {
  console.error('\n  jsdom est absent, le banc ne peut pas tourner.');
  console.error('  Rien n\'a ete verifie. Installe-le :  npm install --save-dev jsdom\n');
  process.exit(2);
}
for (const f of ['bdv-taches.js', 'bdv-echeances.js']) {
  if (!fs.existsSync(path.join(JS, f))) {
    console.error('\n  src/js/' + f + ' est absent : le banc ne verifie rien.\n');
    process.exit(2);
  }
}

let ok = 0, ko = 0;
const dit = (b, m, det) => {
  if (b) { ok++; console.log('  ok    : ' + m); }
  else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + det : '')); }
};

/* Une obligation MENSUELLE, pour que le banc ne depende pas du mois ou il tourne :
   le 10 du mois prochain existe toujours, et il est toujours a plus de zero jour. */
const ECHEANCES = [{
  cle: 'drm', titre: 'DRM, declaration recapitulative mensuelle',
  recurrence: { type: 'mensuel', jour: 10 }
}];

const CORPS = '<!doctype html><html><body>'
  + '<script id="bdvEcheances" type="application/json">' + JSON.stringify(ECHEANCES) + '<\/script>'
  + '<form id="tachesForm"><input id="tachesTitre"><input id="tachesDate" type="date">'
  + '<button type="submit">Ajouter</button></form>'
  + '<span id="tachesNote"></span><div id="tachesAFaire"></div><div id="tachesFaites"></div>'
  + '</body></html>';

function monter(opts) {
  opts = opts || {};
  const dom = new JSDOM(CORPS, { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  const etat = { appels: [], horsLigne: !!opts.horsLigne };
  w.BdvCompte = {
    monId: () => opts.sansSession ? null : 'moi',
    session: () => opts.sansSession ? null : { user: { id: 'moi' } },
    api: (chemin, o) => {
      o = o || {};
      etat.appels.push({ chemin: chemin, methode: o.methode || 'GET', corps: o.corps });
      if (etat.horsLigne) return Promise.reject(new Error('reseau'));
      return Promise.resolve((o.methode || 'GET') === 'GET' ? (opts.lignes || []) : null);
    }
  };
  const poser = (js, nom) => {
    const s = w.document.createElement('script');
    s.textContent = js;
    try { w.document.body.appendChild(s); }
    catch (e) { console.log('  ECHEC : ' + nom + ' leve -> ' + e.message); process.exit(1); }
  };
  poser(fs.readFileSync(path.join(JS, 'bdv-echeances.js'), 'utf8'), 'bdv-echeances.js');
  poser(fs.readFileSync(path.join(JS, 'bdv-taches.js'), 'utf8'), 'bdv-taches.js');
  etat.w = w;
  etat.T = w.BdvTaches;
  etat.ecritures = () => etat.appels.filter(a => a.methode !== 'GET');
  return etat;
}
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

/* ==========================================================================
   1. UNE TACHE ECRITE A LA MAIN
   ========================================================================== */
console.log('\n== 1. Une tache ecrite a la main ==');
{
  const t = monter();
  await dormir(30);
  dit(typeof t.T === 'object', 'BdvTaches est expose');
  dit(t.appels.some(a => a.methode === 'GET' && a.chemin.indexOf('/taches?select=') === 0),
    'la page lit les taches du compte sans attendre l\'ouverture de la piece');

  t.appels.length = 0;
  t.T.ajouter('commander des bouchons', null);
  await dormir(30);
  const e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'POST', 'ajouter ecrit une fois, en POST', e.length);
  dit(e.length === 1 && e[0].chemin === '/taches?on_conflict=id,tache_id',
    'sur la cle (id, tache_id)', e.length && e[0].chemin);
  const l = e.length ? e[0].corps[0] : {};
  dit(l.id === 'moi', 'LA CHARGE PORTE L\'IDENTIFIANT DU COMPTE', JSON.stringify(l.id));
  dit(l.titre === 'commander des bouchons', 'et le titre saisi');
  dit(l.source === 'libre', 'la nature est « libre »', l.source);
  dit(l.fait_le === null, 'une tache neuve n\'est pas faite');
  dit(!!l.tache_id && l.tache_id.indexOf('ech:') !== 0,
    'son identifiant n\'usurpe pas celui d\'une obligation', l.tache_id);

  t.appels.length = 0;
  dit(t.T.ajouter('   ') === false && t.ecritures().length === 0,
    'un titre vide n\'ecrit rien');
}

/* ==========================================================================
   2. UNE OBLIGATION COCHEE
   ========================================================================== */
console.log('\n== 2. Une obligation du calendrier ==');
{
  const t = monter();
  await dormir(30);
  const obl = t.T.toutes().filter(x => x.source === 'echeance');
  dit(obl.length === 1, 'l\'obligation apparait dans la liste sans etre en base', obl.length);
  dit(obl.length === 1 && /^ech:drm:\d{4}-\d{2}-\d{2}$/.test(obl[0].tache_id),
    'son identifiant porte L\'OCCURRENCE, pas seulement la cle', obl.length && obl[0].tache_id);
  dit(obl.length === 1 && obl[0].fait_le === null, 'et elle n\'est pas faite');

  t.appels.length = 0;
  t.T.basculer(obl[0].tache_id);
  await dormir(30);
  let e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'POST', 'cocher ecrit une ligne', e.length);
  const l = e.length ? e[0].corps[0] : {};
  dit(l.id === 'moi', 'la charge porte l\'identifiant du compte');
  dit(l.source === 'echeance' && l.ref === 'drm', 'la nature et la cle de l\'obligation', l.source + '/' + l.ref);
  dit(!!l.fait_le, 'avec la date du geste');
  dit(!!l.echue_le, 'et la date de l\'occurrence', l.echue_le);

  t.appels.length = 0;
  t.T.basculer(obl[0].tache_id);
  await dormir(30);
  e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'DELETE',
    'DECOCHER UNE OBLIGATION SUPPRIME LA LIGNE, il n\'y a rien a retenir d\'une obligation pas faite',
    e.length && e[0].methode);
  dit(e.length === 1 && e[0].chemin.indexOf('id=eq.moi') > 0 && e[0].chemin.indexOf('tache_id=eq.') > 0,
    'et la requete nomme les DEUX colonnes de la cle', e.length && e[0].chemin);
  dit(t.T.toutes().filter(x => x.source === 'echeance' && x.fait_le).length === 0,
    'l\'obligation est revenue a faire');
}

/* ==========================================================================
   3. COCHER PUIS DECOCHER UNE TACHE ECRITE
   ========================================================================== */
console.log('\n== 3. Cocher une tache ecrite ne la supprime pas ==');
{
  const t = monter();
  await dormir(30);
  t.T.ajouter('rappeler le comptable', null);
  const tid = t.T.toutes().filter(x => x.source === 'libre')[0].tache_id;

  t.appels.length = 0;
  t.T.basculer(tid);
  await dormir(30);
  let e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'POST' && !!e[0].corps[0].fait_le,
    'cocher pose une date de realisation');
  dit(e.length === 1 && e[0].corps[0].titre === 'rappeler le comptable',
    'et garde le titre : une ligne cochee reste lisible');

  t.appels.length = 0;
  t.T.basculer(tid);
  await dormir(30);
  e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'POST' && e[0].corps[0].fait_le === null,
    'decocher remet a faire, SANS supprimer : ce que le vigneron a ecrit lui appartient',
    e.length && e[0].methode);

  t.appels.length = 0;
  t.T.supprimer(tid);
  await dormir(30);
  e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'DELETE', 'retirer supprime bien la ligne');
}

/* ==========================================================================
   4. HORS LIGNE : RIEN N'EST PERDU, ET RIEN N'EST INVENTE
   ========================================================================== */
console.log('\n== 4. Hors ligne, puis rejeu ==');
{
  const t = monter({ horsLigne: true });
  await dormir(30);
  t.T.ajouter('acheter du sucre de chaptalisation', null);
  await dormir(30);
  const tid = t.T.toutes().filter(x => x.source === 'libre')[0].tache_id;
  dit(!!tid, 'le geste tient a l\'ecran malgre le reseau coupe');
  const file = JSON.parse(t.w.localStorage.getItem('bdv_taches_attente') || '{}');
  dit(!!file[tid], 'et il part dans la file d\'attente');
  dit(file[tid] && file[tid].id === undefined,
    'LA FILE NE GARDE PAS L\'IDENTIFIANT DU COMPTE : il est pose a l\'envoi, sinon une ligne enfilee sous un autre compte repartirait sur celui-la');

  // Le reseau revient : le rejeu doit envoyer la meme charge, et poser l'identifiant.
  t.horsLigne = false;
  t.appels.length = 0;
  t.T.supprimer(tid);
  await dormir(30);
  const e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'DELETE',
    'une suppression part en suppression, et pas en ecriture vide : c\'est ce defaut qui bloquait la file des signets');
}

/* ==========================================================================
   5. L'ORDRE, ET LES PUNAISES DU PANNEAU
   ========================================================================== */
console.log('\n== 5. L\'ordre et les punaises ==');
{
  const hier = new Date(); hier.setDate(hier.getDate() - 3);
  const dans2 = new Date(); dans2.setDate(dans2.getDate() + 2);
  const j = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const t = monter();
  await dormir(30);
  t.T.ajouter('sans date', null);
  t.T.ajouter('en retard', j(hier));
  t.T.ajouter('dans deux jours', j(dans2));
  await dormir(30);

  const noms = t.T.toutes().map(x => x.titre);
  dit(noms[0] === 'en retard', 'le retard passe devant tout', noms.join(' | '));
  dit(noms[noms.length - 1] === 'sans date',
    'et une tache sans date ferme la marche : elle ne doit pas couvrir une DRM qui tombe demain', noms.join(' | '));

  const p = t.T.punaises();
  dit(p.length <= 4, 'le liege recoit au plus trois taches, plus une punaise de renvoi', p.length);
  dit(p[0] && p[0].ton === 'vieux', 'le retard prend le ton du danger', p[0] && p[0].ton);
  dit(p.every(x => x.href === '/mon-bureau/#taches'), 'chaque punaise mene a la piece');
  dit(p.some(x => x.libelle === 'en retard'), 'et elle porte le titre de la tache, pas un compte');
}

/* ==========================================================================
   6. LA DECONNEXION
   ========================================================================== */
console.log('\n== 6. La deconnexion ==');
{
  const t = monter();
  await dormir(30);
  t.T.ajouter('note privee', null);
  await dormir(30);
  dit(t.T.toutes().filter(x => x.source === 'libre').length === 1, 'une tache est la');
  t.w.BdvCompte.monId = () => null;
  t.w.BdvCompte.session = () => null;
  t.w.document.dispatchEvent(new t.w.Event('bdv:session'));
  await dormir(30);
  dit(t.T.toutes().filter(x => x.source === 'libre').length === 0,
    'la deconnexion vide le miroir : les taches du precedent ne sont pas les siennes');
  dit(t.T.toutes().filter(x => x.source === 'echeance').length === 1,
    'les obligations restent, elles ne sont pas des donnees de compte');
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DES TACHES REFUSE\n'); process.exit(1); }
console.log('  MES TACHES ECRIT CE QU\'ELLE DIT\n');
