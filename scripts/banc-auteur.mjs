/* ============================================================================
   scripts/banc-auteur.mjs : ON SAIT QUI A ECRIT, ET ON SE TAIT QUAND C'EST INUTILE

     npm run banc:auteur

   POURQUOI IL EXISTE. Depuis le lot 17, chaque ligne porte `cree_par`, et depuis
   l'arbitrage de Ted du 13/09/2026 chacun n'ecrit que ses propres lignes, maitre
   compris. Les deux ensemble donnaient le pire des deux mondes : la base refusait
   une correction, et rien a l'ecran ne disait a qui appartenait la ligne.

   CE QUI EST FRAGILE ICI N'EST PAS D'AFFICHER UN NOM, C'EST DE SE TAIRE. Trois
   silences a tenir, et ils sont plus faciles a casser qu'a ecrire :

     - un bureau SEUL n'affiche jamais d'auteur. La grande majorite des comptes le
       sont : leur coller leur propre nom sur chaque ligne serait du bruit pur ;
     - MES lignes ne portent pas MON nom, meme a plusieurs. Une ligne sans nom veut
       dire « de moi », et les seuls noms affiches sont ceux qui expliquent un refus ;
     - un identifiant inconnu dit « ancien membre » et jamais un uuid brut.

   ET DEUX PIEGES DE STOCKAGE, tous les deux deja payes ailleurs dans ce projet :
   le cache doit porter SON bureau (sinon il sert les noms de l'autre apres une
   bascule), et sa cle ne doit PAS finir par `_attente` (sinon elle passerait pour
   du travail non envoye et bloquerait la bascule pour rien).

   IL DEMANDE jsdom :  npm install --save-dev jsdom
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RACINE, 'src/js');

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = await import('jsdom')); }
catch (e) { console.error('  il manque jsdom :  npm install --save-dev jsdom'); process.exit(1); }

let ok = 0, ko = 0;
function dit(vrai, quoi, detail) {
  if (vrai) { ok++; console.log('  ok    : ' + quoi); }
  else { ko++; console.log('  ECHEC : ' + quoi + (detail !== undefined ? '  ->  ' + detail : '')); }
}

const MOI     = '11111111-1111-1111-1111-111111111111';
const ROMANE  = '22222222-2222-2222-2222-222222222222';
const MARIE_L = '33333333-3333-3333-3333-333333333333';
const MARIE_D = '44444444-4444-4444-4444-444444444444';
const SANS    = '55555555-5555-5555-5555-555555555555';
const PARTI   = '99999999-9999-9999-9999-999999999999';
const BUREAU_A = 'b0000000-0000-0000-0000-000000000001';
const BUREAU_B = 'b0000000-0000-0000-0000-000000000002';

const SEUL = [{ personne: MOI, role: 'maitre', prenom: 'Ted', nom: 'Pereira', email: 'ted@essai.fr' }];
const APLUSIEURS = [
  { personne: MOI,     role: 'maitre', prenom: 'Ted',    nom: 'Pereira', email: 'ted@essai.fr' },
  { personne: ROMANE,  role: 'simple', prenom: 'Romane', nom: 'Blanc',   email: 'romane@essai.fr' },
  { personne: MARIE_L, role: 'simple', prenom: 'Marie',  nom: 'Lefevre', email: 'marie.l@essai.fr' },
  { personne: MARIE_D, role: 'simple', prenom: 'Marie',  nom: 'Dubois',  email: 'marie.d@essai.fr' },
  { personne: SANS,    role: 'simple', prenom: '',       nom: '',        email: 'cave.du.haut@essai.fr' }
];

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

/* Le decor. `fetch` repond la liste demandee a /rpc/equipe et note les appels : c'est
   lui qui dit si le cache a evite un aller-retour. Meme motif que banc-bascule, on
   attend la fin de l'init avant de compter quoi que ce soit. */
async function monter(opts) {
  opts = opts || {};
  const vc = new VirtualConsole();
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://lebureauduvigneron.fr/mon-bureau/',
    runScripts: 'dangerously',
    virtualConsole: vc
  });
  const w = dom.window;
  const etat = { appels: [] };

  w.localStorage.setItem('bdv_session', JSON.stringify({
    access_token: 'essai', refresh_token: 'essai',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: MOI, email: 'ted@essai.fr' }
  }));
  w.localStorage.setItem('bdv_proprietaire', MOI);
  w.localStorage.setItem('bdv_bureau_v1', opts.bureau || BUREAU_A);
  Object.keys(opts.cles || {}).forEach(function (k) {
    w.localStorage.setItem(k, opts.cles[k]);
  });

  let gens = ('gens' in opts) ? opts.gens : SEUL;
  w.fetch = function (url, init) {
    const u = String(url);
    etat.appels.push({ url: u, methode: (init && init.method) || 'GET' });
    let corps = '[]';
    if (u.indexOf('/rpc/equipe') >= 0) corps = JSON.stringify(gens || []);
    return Promise.resolve({
      ok: true, status: 200,
      headers: { get: () => null },
      text: () => Promise.resolve(corps),
      json: () => Promise.resolve(JSON.parse(corps))
    });
  };

  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(JS, 'bdv-compte.js'), 'utf8');
  w.document.body.appendChild(s);

  await dormir(25);
  etat.appels.length = 0;

  etat.w = w;
  etat.C = w.BdvCompte;
  etat.equipeDemandee = () => etat.appels.filter(a => a.url.indexOf('/rpc/equipe') >= 0);
  return etat;
}

/* ==========================================================================
   1. UN BUREAU SEUL N'AFFICHE AUCUN AUTEUR
   ==========================================================================
   C'est le cas de presque tous les comptes, et c'est le silence le plus facile
   a casser en ajoutant une ligne d'affichage « pour faire complet ». */
console.log('\n== 1. Un bureau seul ne nomme personne ==');
{
  const t = await monter({ gens: SEUL });
  await t.C.trombinoscope();
  dit(t.C.quiEcrit(MOI) === null, 'mes propres lignes ne portent rien');
  dit(t.C.quiEcrit(ROMANE) === null,
    'ET MEME UN IDENTIFIANT ETRANGER NE SORT RIEN : a une personne, la colonne auteur '
    + 'n\'a aucun sens, quoi qu\'elle contienne', String(t.C.quiEcrit(ROMANE)));
  dit(t.C.quiEcrit(null) === null, 'ni un cree_par vide');
}

/* ==========================================================================
   2. A PLUSIEURS : LES AUTRES SONT NOMMES, MOI JAMAIS
   ========================================================================== */
console.log('\n== 2. A plusieurs, seuls les autres sont nommes ==');
{
  const t = await monter({ gens: APLUSIEURS });
  await t.C.trombinoscope();
  dit(t.C.quiEcrit(MOI) === null,
    'MES lignes ne portent toujours pas mon nom : une ligne sans nom veut dire « de moi »',
    String(t.C.quiEcrit(MOI)));
  dit(t.C.quiEcrit(ROMANE) === 'Romane', 'la ligne d\'une collegue porte son prenom',
    String(t.C.quiEcrit(ROMANE)));
}

/* ==========================================================================
   3. DEUX MEMES PRENOMS, ET C'EST COURANT DANS UNE FAMILLE DE VIGNERONS
   ========================================================================== */
console.log('\n== 3. Deux Marie ne deviennent pas la meme personne ==');
{
  const t = await monter({ gens: APLUSIEURS });
  await t.C.trombinoscope();
  dit(t.C.quiEcrit(MARIE_L) === 'Marie L.', 'la premiere Marie prend son initiale',
    String(t.C.quiEcrit(MARIE_L)));
  dit(t.C.quiEcrit(MARIE_D) === 'Marie D.', 'la seconde aussi, et elles different',
    String(t.C.quiEcrit(MARIE_D)));
  dit(t.C.quiEcrit(MARIE_L) !== t.C.quiEcrit(MARIE_D),
    'DEUX LIGNES DE DEUX PERSONNES NE DISENT JAMAIS LE MEME NOM : c\'est tout l\'objet '
    + 'd\'afficher un auteur');
  dit(t.C.quiEcrit(ROMANE) === 'Romane',
    'et un prenom unique reste nu : on n\'ajoute une initiale que quand il le faut');
}

/* ==========================================================================
   4. SANS PRENOM, ET SANS UUID A L'ECRAN
   ========================================================================== */
console.log('\n== 4. Personne ne voit jamais un identifiant ==');
{
  const t = await monter({ gens: APLUSIEURS });
  await t.C.trombinoscope();
  dit(t.C.quiEcrit(SANS) === 'cave.du.haut',
    'sans prenom, la partie gauche de l\'e-mail : elle est toujours la et se reconnait',
    String(t.C.quiEcrit(SANS)));
  dit(t.C.quiEcrit(PARTI) === 'ancien membre',
    'quelqu\'un retire du bureau devient « ancien membre » : son uuid reste sur ses '
    + 'lignes, mais `equipe` ne le rend plus', String(t.C.quiEcrit(PARTI)));
  dit(t.C.quiEcrit(null) === 'ancien membre',
    'et un compte supprime aussi : `on delete set null` met cree_par a null',
    String(t.C.quiEcrit(null)));
  const tout = [MOI, ROMANE, MARIE_L, MARIE_D, SANS, PARTI, null]
    .map(function (x) { return String(t.C.quiEcrit(x)); }).join(' ');
  dit(!/[0-9a-f]{8}-[0-9a-f]{4}/.test(tout),
    'AUCUNE SORTIE NE CONTIENT D\'UUID, jamais, quelle que soit l\'entree', tout);
}

/* ==========================================================================
   5. LE CACHE PORTE SON BUREAU
   ==========================================================================
   Le piege deja paye par `tirerVentes()` le 13/09/2026 : une copie prise dans un
   bureau et servie dans l'autre. Ici ca donnerait les noms des collegues du bureau
   qu'on vient de quitter, colles sur les lignes de celui ou l'on vient d'entrer. */
console.log('\n== 5. Un cache d\'un autre bureau n\'est jamais servi ==');
{
  const vieux = JSON.stringify({
    bureau: BUREAU_B, le: Date.now(),
    gens: { [ROMANE]: 'Romane' }, combien: 2
  });
  const t = await monter({ bureau: BUREAU_A, gens: SEUL, cles: { bdv_trombinoscope_v1: vieux } });
  dit(t.C.quiEcrit(ROMANE) === null,
    'le cache de l\'autre bureau ne repond pas, meme avant tout appel reseau',
    String(t.C.quiEcrit(ROMANE)));
  await t.C.trombinoscope();
  dit(t.equipeDemandee().length === 1,
    'ET LA LISTE A ETE REDEMANDEE : un cache du mauvais bureau doit etre ignore, pas '
    + 'juste masque', String(t.equipeDemandee().length));
  const ecrit = JSON.parse(t.w.localStorage.getItem('bdv_trombinoscope_v1'));
  dit(ecrit.bureau === BUREAU_A, 'et la copie ecrite porte le bureau courant', ecrit.bureau);
}

/* ==========================================================================
   6. LE CACHE EVITE UN ALLER-RETOUR PAR PAGE
   ========================================================================== */
console.log('\n== 6. Une liste fraiche ne se redemande pas ==');
{
  const frais = JSON.stringify({
    bureau: BUREAU_A, le: Date.now(),
    gens: { [ROMANE]: 'Romane', [MOI]: 'Ted' }, combien: 2
  });
  const t = await monter({ gens: APLUSIEURS, cles: { bdv_trombinoscope_v1: frais } });
  await t.C.trombinoscope();
  dit(t.equipeDemandee().length === 0, 'aucun appel reseau : la copie du jour suffit',
    JSON.stringify(t.equipeDemandee()));
  dit(t.C.quiEcrit(ROMANE) === 'Romane', 'et elle nomme quand meme');

  const vieilli = JSON.stringify({
    bureau: BUREAU_A, le: Date.now() - 2 * 86400000,
    gens: { [ROMANE]: 'Romane', [MOI]: 'Ted' }, combien: 2
  });
  const u = await monter({ gens: APLUSIEURS, cles: { bdv_trombinoscope_v1: vieilli } });
  const rendu = await u.C.trombinoscope();
  dit(!!rendu && rendu.gens[ROMANE] === 'Romane',
    'UNE COPIE PERIMEE EST RENDUE TOUT DE SUITE : un nom d\'un jour de retard vaut mieux '
    + 'qu\'un ecran qui attend le reseau');
  await dormir(15);
  dit(u.equipeDemandee().length === 1, 'et elle a ete relue en fond', JSON.stringify(u.equipeDemandee()));
}

/* ==========================================================================
   7. LA CLE NE PASSE PAS POUR DU TRAVAIL NON ENVOYE
   ==========================================================================
   Si elle finissait par `_attente`, `filesEnAttente()` la compterait comme une file
   a envoyer et REFUSERAIT toute bascule de bureau, pour une copie de ce que la base
   sait deja. Le lot 21 et le lot 23 se seraient casses l'un l'autre en silence. */
console.log('\n== 7. Le trombinoscope ne retient pas la bascule ==');
{
  const frais = JSON.stringify({
    bureau: BUREAU_A, le: Date.now(),
    gens: { [ROMANE]: 'Romane', [MOI]: 'Ted' }, combien: 2
  });
  const t = await monter({ gens: APLUSIEURS, cles: { bdv_trombinoscope_v1: frais } });
  dit(t.C.filesEnAttente().length === 0,
    'le cache n\'est pas vu comme une file a envoyer',
    JSON.stringify(t.C.filesEnAttente()));
  let leve = null;
  try { await t.C.changerDeBureau(BUREAU_B); } catch (e) { leve = e; }
  dit(leve === null, 'et la bascule passe', leve && leve.message);
  dit(t.w.localStorage.getItem('bdv_trombinoscope_v1') === null,
    'MAIS LE VIDAGE L\'EMPORTE : les noms du bureau quitte n\'ont rien a faire dans le suivant');
}

/* ==========================================================================
   8. LE REFUS DIT UN NOM, ET SE RABAT SANS MENTIR
   ========================================================================== */
console.log('\n== 8. Le refus d\'ecrire nomme celui a qui la ligne appartient ==');
{
  const t = await monter({ gens: APLUSIEURS });
  await t.C.trombinoscope();
  const avec = t.C.refusEnFrancais('Cette tâche a été écrite', ROMANE, 'Seul son auteur peut la modifier.');
  dit(avec.indexOf('Romane') >= 0, 'le nom est dans la phrase', avec);
  dit(avec.indexOf('auteur') >= 0, 'et elle dit a qui s\'adresser', avec);
  dit(!/\b(elle|lui) seul/.test(avec),
    'AUCUN PRONOM DE GENRE : la base ne porte pas le genre des gens et n\'a pas a le porter', avec);

  const sans = t.C.refusEnFrancais('Cette tâche a été écrite', PARTI, 'Seul son auteur peut la modifier.');
  dit(sans.indexOf('ancien membre') >= 0 || sans.indexOf('quelqu') >= 0,
    'un auteur introuvable ne fabrique pas de nom', sans);

  const u = await monter({ gens: SEUL });
  await u.C.trombinoscope();
  const gen = u.C.refusEnFrancais('Cette tâche a été écrite', ROMANE, 'Seul son auteur peut la modifier.');
  dit(gen.indexOf('quelqu') >= 0,
    'et sans trombinoscope utilisable, la phrase generique revient : elle reste vraie', gen);
}

/* ==========================================================================
   8 bis. LA MENTION AFFICHEE SE DIT EN FRANCAIS
   ==========================================================================
   « de Romane » se dit. « de ancien membre » ne se dit pas. L'elision ne peut pas
   vivre dans chaque ecran : elle serait juste a un endroit et fausse au suivant, et
   c'est exactement la classe de faute que personne ne signale mais que tout le monde
   voit. Les ecrans appellent donc `mentionAuteur`, jamais `quiEcrit`. */
console.log('\n== 8 bis. La mention affichee se dit en francais ==');
{
  const t = await monter({ gens: APLUSIEURS });
  await t.C.trombinoscope();
  dit(t.C.mentionAuteur(ROMANE) === 'de Romane', 'un nom prend « de »',
    String(t.C.mentionAuteur(ROMANE)));
  dit(t.C.mentionAuteur(PARTI) === 'd’un ancien membre',
    'et un auteur introuvable prend l\'elision, pas « de ancien membre »',
    String(t.C.mentionAuteur(PARTI)));
  dit(t.C.mentionAuteur(MOI) === null, 'mes lignes ne portent aucune mention');

  const u = await monter({ gens: SEUL });
  await u.C.trombinoscope();
  dit(u.C.mentionAuteur(ROMANE) === null, 'et un bureau seul n\'affiche aucune mention');

  const ecrans = fs.readFileSync(path.join(JS, 'bdv-ecrans.js'), 'utf8');
  const taches = fs.readFileSync(path.join(JS, 'bdv-taches.js'), 'utf8');
  dit(ecrans.indexOf('mentionAuteur') >= 0 && !/mots\.push\('de '/.test(taches),
    'LES ECRANS PASSENT PAR mentionAuteur : aucun d\'eux ne recolle « de » lui-meme');
}

/* ==========================================================================
   9. CE QUE LES REQUETES DEMANDENT
   ==========================================================================
   Un affichage d'auteur qui ne lit pas la colonne ne montre rien, et aucun banc de
   rendu ne le verrait : la ligne s'afficherait, sans nom, exactement comme une ligne
   a soi. Cette verification tient sur le texte des requetes, faute de base ici. */
console.log('\n== 9. Les lectures demandent bien la colonne ==');
{
  const attendu = [
    ['bdv-sync.js', '/suivi_clients?select=', 'le suivi client'],
    ['bdv-sync.js', '/echanges?select=', 'le journal des echanges'],
    ['bdv-taches.js', '/taches?select=', 'les taches'],
    ['bdv-crm.js', '/echanges?select=', 'le fil de la fiche client'],
    ['bdv-crm.js', '/suivi_clients?select=', 'le miroir du bureau'],
    ['bdv-calchoix.js', '/calendrier_choix?select=', 'les reperes du calendrier']
  ];
  attendu.forEach(function (a) {
    const src = fs.readFileSync(path.join(JS, a[0]), 'utf8');
    const i = src.indexOf(a[1]);
    const ligne = i < 0 ? '' : src.slice(i, src.indexOf('\n', i));
    /* `select=*` rend toutes les colonnes, `cree_par` compris : c'est la forme de la
       lecture du suivi depuis le 24/09/2026 (lot 33, voir lireSuivi()). */
    dit(i >= 0 && (ligne.indexOf('cree_par') >= 0 || ligne.indexOf(a[1] + '*') >= 0),
      a[2] + ' demande cree_par', ligne.trim().slice(0, 90));
  });
}

/* ==========================================================================
   10. L'AUTEUR SURVIT A LA REECRITURE LOCALE
   ==========================================================================
   Les gestes reconstruisent la ligne de zero et ne portent pas `cree_par` : la base
   le pose, jamais le navigateur. Sans report explicite, cocher la tache d'un collegue
   effacait son auteur du cache une milliseconde avant que la base refuse, et le
   message d'erreur ne pouvait plus nommer personne. */
console.log('\n== 10. Cocher la ligne d\'un autre n\'efface pas son nom ==');
{
  ['bdv-taches.js', 'bdv-calchoix.js'].forEach(function (f) {
    const src = fs.readFileSync(path.join(JS, f), 'utf8');
    const i = src.indexOf('function ecrire(');
    const bloc = i < 0 ? '' : src.slice(i, i + 1200);
    dit(bloc.indexOf('cree_par') >= 0,
      f + ' reporte l\'auteur de la ligne precedente dans la ligne reecrite');
  });
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  ON NE SAIT PAS QUI A ECRIT\n'); process.exit(1); }
console.log('  ON SAIT QUI A ECRIT, ET ON SE TAIT QUAND C\'EST INUTILE\n');
process.exit(0);
