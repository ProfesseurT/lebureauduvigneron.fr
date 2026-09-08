/* ============================================================================
   scripts/banc-sync.mjs : le banc du rapatriement des ventes

     npm run banc:sync

   ECRIT LE 08/09/2026, avec les deux corrections de performance. Il ne mesure
   pas un temps : il verifie CE QUI PART VERS LE SERVEUR, et surtout ce qui n'en
   part pas. Les deux corrections sont invisibles a l'ecran, un banc est donc le
   seul endroit ou elles peuvent se defendre.

     1. Autant de lignes ici que sur le compte : on ne telecharge RIEN.
     2. Pagination par curseur (`empreinte=gt.`) et jamais par decalage
        (`offset`), dont le cout devenait quadratique avec le volume.

   ET LE PLUS IMPORTANT : au moindre doute, rapatriement COMPLET. Compteur
   illisible, appelant qui ne sait pas ce qu'il a, ecart dans un sens ou dans
   l'autre. La regle de cette fonction est qu'elle n'a pas le droit de deviner,
   et c'est ce que la moitie de ces controles protege.

   IL DEMANDE jsdom :  npm install --save-dev jsdom
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
if (!fs.existsSync(path.join(JS, 'bdv-sync.js'))) {
  console.error('\n  src/js/bdv-sync.js est absent : le banc ne verifie rien.\n');
  process.exit(2);
}

let ok = 0, ko = 0;
const dit = (b, m, det) => {
  if (b) { ok++; console.log('  ok    : ' + m); }
  else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + det : '')); }
};

/* Le decor : un faux compte qui note chaque appel, et un faux serveur qui honore
   vraiment la borne `empreinte=gt.` et la limite. Un faux serveur qui rendrait
   toujours la meme page ferait boucler le rapatriement sans fin — c'est arrive
   pendant l'ecriture de la mesure, et ca ressemble a une panne du navigateur. */
function monter(opts) {
  opts = opts || {};
  const total = opts.total == null ? 2500 : opts.total;
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window;
  const LIGNES = [];
  for (let i = 0; i < total; i++) LIGNES.push({ empreinte: 'h' + String(i).padStart(6, '0'), brut: ['x'] });
  const etat = { appels: [], compteurs: 0, lignesRendues: 0 };
  w.BdvCompte = {
    monId: () => 'moi',
    session: () => ({ user: { id: 'moi' } }),
    compter: opts.compteurCasse
      ? () => Promise.resolve(null)
      : (chemin) => { etat.compteurs++; return Promise.resolve(total); },
    api: (chemin) => {
      etat.appels.push(chemin);
      const u = new URL('https://x.test' + chemin);
      const limite = parseInt(u.searchParams.get('limit') || '1000', 10);
      const gt = u.searchParams.get('empreinte');   // « gt.h000123 »
      let debut = 0;
      if (gt) {
        const borne = String(gt).replace(/^gt\./, '');
        debut = LIGNES.findIndex(l => l.empreinte > borne);
        if (debut < 0) debut = LIGNES.length;
      }
      const tranche = LIGNES.slice(debut, debut + limite);
      etat.lignesRendues += tranche.length;
      return Promise.resolve(tranche);
    }
  };
  if (opts.sansCompteur) delete w.BdvCompte.compter;
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(JS, 'bdv-sync.js'), 'utf8');
  w.document.body.appendChild(s);
  etat.w = w;
  etat.S = w.BdvSync;
  etat.lectures = () => etat.appels.filter(a => a.indexOf('/ventes?') === 0);
  return etat;
}

/* ==========================================================================
   1. AUTANT DES DEUX COTES : ON NE TELECHARGE RIEN
   ========================================================================== */
console.log('\n== 1. La base locale est deja complete ==');
{
  const t = monter({ total: 2500 });
  const lignes = await t.S.tirerVentes(null, 2500);
  dit(lignes.length === 0, 'le rapatriement rend un tableau vide', lignes.length);
  dit(t.compteurs === 1, 'il a compte une fois', t.compteurs);
  dit(t.lectures().length === 0, 'ET IL N\'A LU AUCUNE LIGNE : zero octet de donnees', t.lectures().length + ' lecture(s)');
  dit(t.lignesRendues === 0, 'le serveur n\'a rien eu a rendre', t.lignesRendues);
}

/* ==========================================================================
   2. UN ECART : RAPATRIEMENT COMPLET, PAR CURSEUR
   ========================================================================== */
console.log('\n== 2. Il manque des lignes ici ==');
{
  const t = monter({ total: 2500 });
  const progres = [];
  const lignes = await t.S.tirerVentes((n) => progres.push(n), 1200);
  dit(lignes.length === 2500, 'les 2 500 lignes sont rapatriees', lignes.length);
  dit(lignes[0].h === 'h000000' && lignes[2499].h === 'h002499',
    'de la premiere a la derniere, sans trou ni doublon', lignes[0].h + ' -> ' + lignes[2499].h);
  const vues = new Set(lignes.map(l => l.h));
  dit(vues.size === 2500, 'aucune ligne n\'est revenue deux fois', vues.size);
  dit(t.lectures().length === 4, 'trois pages pleines et une page vide pour finir', t.lectures().length);
  dit(progres.join(',') === '1000,2000,2500', 'la progression est honnete', progres.join(','));

  console.log('  -- la forme des requetes --');
  dit(t.lectures().every(a => a.indexOf('offset=') < 0),
    'AUCUNE requete ne porte offset : le cout par page est constant',
    t.lectures().filter(a => a.indexOf('offset=') >= 0).join(' '));
  dit(t.lectures()[0].indexOf('empreinte=gt.') < 0, 'la premiere page part sans borne');
  dit(t.lectures()[1].indexOf('empreinte=gt.h000999') > 0,
    'la deuxieme reprend APRES la derniere ligne recue', t.lectures()[1]);
  dit(t.lectures().every(a => a.indexOf('order=empreinte.asc') > 0),
    'le tri reste celui de la cle, sinon la borne ne veut plus rien dire');
}

/* ==========================================================================
   3. AU MOINDRE DOUTE, ON LIT TOUT
   ========================================================================== */
console.log('\n== 3. Le doute ne se transforme jamais en economie ==');
{
  const t = monter({ total: 300 });
  const l = await t.S.tirerVentes(null, undefined);
  dit(l.length === 300 && t.compteurs === 0,
    'appelant qui ne dit pas ce qu\'il a : on ne compte meme pas, on lit tout', l.length);
}
{
  const t = monter({ total: 300, compteurCasse: true });
  const l = await t.S.tirerVentes(null, 300);
  dit(l.length === 300, 'compteur illisible : on lit tout', l.length);
}
{
  const t = monter({ total: 300, sansCompteur: true });
  const l = await t.S.tirerVentes(null, 300);
  dit(l.length === 300, 'compte absent du module : on lit tout', l.length);
}
{
  const t = monter({ total: 300 });
  const l = await t.S.tirerVentes(null, 900);
  dit(l.length === 300, 'PLUS de lignes ici que sur le compte : on lit tout quand meme', l.length);
  // Ce cas est celui d'une sauvegarde incomplete : c'est la poussee qui repare, pas la
  // lecture, mais lire ne doit rien casser et surtout rien sauter.
}
{
  const t = monter({ total: 0 });
  const l = await t.S.tirerVentes(null, 0);
  dit(l.length === 0 && t.lectures().length === 0,
    'compte vide et appareil vide : rien a faire, et rien de fait');
}

/* ==========================================================================
   4. SANS SESSION
   ========================================================================== */
console.log('\n== 4. Sans session ==');
{
  const t = monter({ total: 300 });
  t.w.BdvCompte.monId = () => null;
  const l = await t.S.tirerVentes(null, 0);
  dit(l.length === 0 && t.lectures().length === 0, 'aucune requete ne part sans compte');
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DU RAPATRIEMENT REFUSE\n'); process.exit(1); }
console.log('  ON COMPTE AVANT DE LIRE, ET ON LIT PAR CURSEUR\n');
