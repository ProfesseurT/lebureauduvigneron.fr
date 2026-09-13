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
const BUREAU = 'b0000000-0000-0000-0000-000000000001';
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
  /* `comptesChemins` est SEPARE de `appels` a dessein : les sections 1 a 3 verifient
     qu'AUCUNE lecture de ventes ne part, et un compteur range dans la meme liste les
     ferait echouer alors qu'il ne lit aucune donnee. C'est le compteur d'en-tete
     Content-Range, pas une lecture. */
  const etat = { appels: [], comptesChemins: [], compteurs: 0, lignesRendues: 0 };
  w.BdvCompte = {
    monId: () => 'moi',
    // Depuis le lot 17, `pret()` exige AUSSI un bureau : sans lui, pas une requete ne
    // part, et tous les controles de ce banc tombent a zero d'un coup.
    monBureau: () => opts.sansBureau ? null : BUREAU,
    refusDeProprietaire: () => false,
    session: () => ({ user: { id: 'moi' } }),
    compter: opts.compteurCasse
      ? () => Promise.resolve(null)
      : (chemin) => { etat.compteurs++; etat.comptesChemins.push(chemin); return Promise.resolve(total); },
    api: (chemin) => {
      etat.appels.push(chemin);
      /* LE FAUX SERVEUR NE CONNAIT QUE `/ventes`, et c'est un piege paye en ecrivant la
         section 5 : sur `/echanges`, qui pagine par decalage, il rendait la meme page de
         ventes a l'infini et le banc mourait sur un « Invalid array length ». Le mode
         muet rend un tableau vide, ce qui suffit quand on ne verifie que l'ADRESSE
         demandee et pas ce qu'elle rapporte. */
      if (opts.muet) return Promise.resolve([]);
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

/* ==========================================================================
   5. TOUTE REQUETE NOMME SON BUREAU, 13/09/2026
   ==========================================================================
   LE CONTROLE LE PLUS IMPORTANT DE CE BANC DEPUIS LE LOT 17, et le seul qui
   attrape la classe entiere de defauts au lieu d'un cas.

   La securite par ligne dit ce qu'on A LE DROIT de lire, le bureau courant dit
   ce qu'on DOIT lire. Une requete qui oublie `bureau=eq.` ne leve AUCUNE erreur
   et ne casse rien tant que la personne n'a qu'un bureau. Le jour ou elle en a
   deux, elle melange deux domaines dans la meme ardoise, ou elle efface la meme
   cle metier dans les deux. Mesure du 13/09/2026 sur un Postgres d'essai : 57
   lignes lues sans filtre, 50 avec.

   Aucune relecture ne garde ca. Un banc, si. */
console.log('\n== 5. Toute requete nomme son bureau ==');
{
  const t = monter({ total: 120, muet: true });
  await t.S.tirerVentes(null, 0);
  await t.S.compterVentes();
  await t.S.lireReglages();
  await t.S.ecrireReglages({ objectif: 1000 });
  await t.S.lireSuivi();
  await t.S.ecrireSuivi('706', { statut: 'relance' });
  await t.S.supprimerSuivi('812');
  await t.S.lireEchanges('706');
  await t.S.ecrireEchange({ echange_id: 'ec1', client_id: '706', type: 'appel' });
  await t.S.supprimerEchange('ec1');
  await t.S.deposerFile([], null);

  const toutes = t.appels.concat(t.comptesChemins);
  const sansBureau = toutes.filter(a => a.indexOf('/rpc/') !== 0
    && a.indexOf('bureau=eq.' + BUREAU) < 0
    && a.indexOf('on_conflict=bureau') < 0);
  dit(toutes.length >= 11, toutes.length + ' requetes observees, compteur compris');
  dit(sansBureau.length === 0,
    'aucune requete ne part sans nommer son bureau, le compteur inclus'
    + (sansBureau.length ? ' -> ' + sansBureau[0] : ''));

  // Et les upserts nomment le bureau dans leur cle de conflit, sinon PostgREST
  // ecraserait la ligne d'un autre bureau portant la meme cle metier.
  const upserts = t.appels.filter(a => a.indexOf('on_conflict=') >= 0);
  dit(upserts.length >= 4 && upserts.every(a => a.indexOf('on_conflict=bureau') >= 0),
    'tout upsert porte `bureau` en tete de sa cle de conflit');
}
{
  const t = monter({ total: 120, sansBureau: true, muet: true });
  const l = await t.S.tirerVentes(null, 0);
  const ecrit = await t.S.ecrireSuivi('706', { statut: 'relance' });
  dit(l.length === 0 && ecrit === false && t.appels.length === 0,
    'bureau inconnu : rien ne part, ni lecture ni ecriture');
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DU RAPATRIEMENT REFUSE\n'); process.exit(1); }
console.log('  ON COMPTE AVANT DE LIRE, ET ON LIT PAR CURSEUR\n');
