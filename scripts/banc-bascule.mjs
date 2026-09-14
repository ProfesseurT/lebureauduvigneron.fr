/* ============================================================================
   scripts/banc-bascule.mjs : CHANGER DE BUREAU NE JETTE PAS DE TRAVAIL

     npm run banc:bascule

   POURQUOI IL EXISTE. `changerDeBureau()` vide le poste, et c'est indispensable :
   ce navigateur porte les lignes de vente du bureau qu'on quitte, et entrer dans
   un autre sans rien jeter melangerait deux ardoises. Mais le vidage emportait
   AUSSI les files de ce qui a ete note sans reseau et pas encore envoye.

   Quelqu'un note trois taches dans un rang, revient, bascule sur l'autre bureau :
   les trois disparaissent, sans un mot, sans une erreur. Defaut introduit le
   13/09/2026 et trouve le 14. Aucune relecture ne l'attrape : le code qui vide et
   le code qui remplit la file sont dans deux fichiers differents.

   CE QU'IL GARDE, et l'ordre compte autant que le refus : quand une file resiste,
   la base ne DOIT pas avoir ete modifiee. Ecrire `bureau_courant` puis refuser
   laisserait le compte sur le nouveau bureau et le navigateur sur l'ancien,
   c'est-a-dire le pire des deux etats.

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

const MOI = '11111111-1111-1111-1111-111111111111';
const BUREAU_A = 'b0000000-0000-0000-0000-000000000001';
const BUREAU_B = 'b0000000-0000-0000-0000-000000000002';

/* Le decor. `fetch` est faux et NOTE ce qu'on lui demande : c'est lui qui dit si la
   base a ete touchee. Sans cette trace, on ne saurait pas distinguer « la bascule a
   ete refusee » de « la bascule a ete refusee APRES avoir ecrit ». */
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

/* `monter` est ASYNCHRONE, et ce n'est pas un detail de confort : au chargement,
   bdv-compte.js rafraichit la session, ecrit la trace de visite et rejoue la file du
   PROFIL. Ces trois-la font des PATCH sur `profils` qui n'ont rien a voir avec la
   bascule, et le premier jet de ce banc les comptait comme si elles en venaient : il
   accusait la bascule d'ecrire deux fois et d'avoir mange la file du profil, qui
   avait simplement ete rejouee. On attend donc que l'arrivee du module se termine,
   puis on remet le decor a zero. Un banc qui ne separe pas l'init du geste mesure
   l'init. */
async function monter(opts) {
  opts = opts || {};
  const vc = new VirtualConsole();      // muet : jsdom ne sait pas naviguer, et ce n'est pas le sujet
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://lebureauduvigneron.fr/mon-bureau/',
    runScripts: 'dangerously',
    virtualConsole: vc
  });
  const w = dom.window;
  const etat = { ecritures: [] };

  w.localStorage.setItem('bdv_session', JSON.stringify({
    access_token: 'essai', refresh_token: 'essai',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: MOI, email: 'ted@essai.fr' }
  }));
  w.localStorage.setItem('bdv_proprietaire', MOI);
  w.localStorage.setItem('bdv_bureau_v1', BUREAU_A);
  // Ce que le vidage doit emporter : le miroir du bureau qu'on quitte.
  w.localStorage.setItem('bdv_crm_v1', '{"706":{"statut":"relance"}}');
  w.localStorage.setItem('bdv_taches_v1', '{"t1":{"titre":"rincer la cuve"}}');
  // Ce qui appartient a la PERSONNE et doit survivre.
  w.localStorage.setItem('bdv_profil_attente', '{"prenom":"Ted"}');
  Object.keys(opts.files || {}).forEach(function (k) {
    w.localStorage.setItem(k, JSON.stringify(opts.files[k]));
  });

  w.fetch = function (url, init) {
    etat.ecritures.push({ url: String(url), methode: (init && init.method) || 'GET' });
    return Promise.resolve({
      ok: true, status: 200,
      text: () => Promise.resolve('[]'),
      json: () => Promise.resolve([])
    });
  };

  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(JS, 'bdv-compte.js'), 'utf8');
  w.document.body.appendChild(s);

  await dormir(25);                 // l'init se termine
  etat.ecritures.length = 0;        // et ne compte pas dans ce qui suit
  // Reposee APRES l'init, qui vient de la rejouer et de l'effacer.
  w.localStorage.setItem('bdv_profil_attente', '{"prenom":"Ted"}');

  etat.w = w;
  etat.C = w.BdvCompte;
  etat.patch = () => etat.ecritures.filter(e => e.methode === 'PATCH');
  return etat;
}

/* ==========================================================================
   1. UNE FILE QUI RESISTE BLOQUE LA BASCULE
   ========================================================================== */
console.log('\n== 1. Une file non envoyee bloque la bascule ==');
{
  const t = await monter({ files: { bdv_taches_attente: { t1: { titre: 'rincer la cuve' } } } });
  t.ecritures.length = 0;
  let leve = null;
  try { await t.C.changerDeBureau(BUREAU_B); } catch (e) { leve = e; }

  dit(!!leve, 'la bascule est refusee', leve && leve.message);
  dit(!!leve && /enregistr/.test(leve.message),
    'et le message parle de travail non enregistre, pas d\'une erreur technique',
    leve && leve.message);
  dit(t.patch().length === 0,
    'LA BASE N\'A PAS ETE TOUCHEE : refuser apres avoir ecrit laisserait le compte sur un '
    + 'bureau et le navigateur sur l\'autre',
    JSON.stringify(t.patch()));
  dit(t.w.localStorage.getItem('bdv_crm_v1') !== null,
    'et le poste n\'a pas ete vide');
  dit(t.w.localStorage.getItem('bdv_bureau_v1') === BUREAU_A,
    'le bureau courant du navigateur n\'a pas bouge');
}

/* ==========================================================================
   2. LA DETECTION EST PAR SUFFIXE, PAS PAR LISTE NOMMEE
   ==========================================================================
   C'est la moitie qui vieillit bien : la prochaine file `bdv_x_attente` ajoutee
   ailleurs dans le site sera couverte sans que personne y pense. Une liste de
   noms se perime au premier module suivant, et en silence. */
console.log('\n== 2. Une file inconnue bloque aussi ==');
{
  const t = await monter({ files: { bdv_futur_attente: { a: 1, b: 2 } } });
  let leve = null;
  try { await t.C.changerDeBureau(BUREAU_B); } catch (e) { leve = e; }
  dit(!!leve, 'une file qu\'aucune liste ne nomme bloque la bascule');
  dit(!!leve && /2 gestes/.test(leve.message),
    'et le message compte les gestes en attente', leve && leve.message);
}

/* ==========================================================================
   3. UNE FILE VIDE NE BLOQUE RIEN
   ==========================================================================
   Un banc qui ne verifie que des refus valide une base ou plus rien ne marche. */
console.log('\n== 3. Files vides : la bascule a lieu ==');
{
  const t = await monter({ files: { bdv_taches_attente: {}, bdv_calchoix_attente: {} } });
  t.ecritures.length = 0;
  let leve = null;
  try { await t.C.changerDeBureau(BUREAU_B); } catch (e) { leve = e; }

  dit(!leve, 'la bascule n\'est pas refusee', leve && leve.message);
  dit(t.patch().length === 1 && /profils/.test(t.patch()[0].url),
    'le bureau courant est ecrit en base, une seule fois',
    JSON.stringify(t.patch()));
  dit(t.w.localStorage.getItem('bdv_crm_v1') === null
      && t.w.localStorage.getItem('bdv_taches_v1') === null,
    'LE POSTE EST VIDE : sans ca, les lignes de vente des deux bureaux se melangent');
  dit(t.w.localStorage.getItem('bdv_session') !== null
      && t.w.localStorage.getItem('bdv_proprietaire') === MOI,
    'la session survit : c\'est la meme personne, ce n\'est plus le meme domaine');
  dit(t.w.localStorage.getItem('bdv_profil_attente') !== null,
    'et la file du PROFIL survit aussi : elle appartient a la personne, pas au bureau');
  dit(t.w.localStorage.getItem('bdv_bureau_v1') === BUREAU_B,
    'le navigateur pointe sur le nouveau bureau');
}

/* ==========================================================================
   4. LE MODULE QUI TIENT UNE FILE EST APPELE AVANT
   ========================================================================== */
console.log('\n== 4. On demande d\'abord aux modules de vider leur file ==');
{
  const t = await monter({ files: { bdv_taches_attente: { t1: { titre: 'x' } } } });
  let appele = 0;
  t.C.avantDeQuitterLeBureau(async function () {
    appele++;
    t.w.localStorage.removeItem('bdv_taches_attente');   // le module a reussi a envoyer
  });
  t.ecritures.length = 0;
  let leve = null;
  try { await t.C.changerDeBureau(BUREAU_B); } catch (e) { leve = e; }

  dit(appele === 1, 'le module inscrit est appele une fois', appele);
  dit(!leve, 'et la file une fois videe, la bascule a lieu', leve && leve.message);
}

/* ==========================================================================
   5. UN MODULE QUI ECHOUE NE FAIT PAS PERDRE LE TRAVAIL
   ==========================================================================
   Le reseau est coupe, `viderAttente()` leve, la file reste pleine. On ne doit
   surtout PAS basculer quand meme : c'est exactement le cas du vigneron dans son
   rang, et c'est celui pour lequel ce banc existe. */
console.log('\n== 5. Un module qui echoue : on ne bascule pas ==');
{
  const t = await monter({ files: { bdv_taches_attente: { t1: { titre: 'x' } } } });
  t.C.avantDeQuitterLeBureau(function () { return Promise.reject(new Error('reseau')); });
  t.ecritures.length = 0;
  let leve = null;
  try { await t.C.changerDeBureau(BUREAU_B); } catch (e) { leve = e; }

  dit(!!leve, 'la bascule est refusee');
  dit(t.w.localStorage.getItem('bdv_taches_attente') !== null,
    'LE TRAVAIL EST TOUJOURS LA, et c\'est tout l\'objet de ce banc');
  dit(t.patch().length === 0, 'et la base n\'a pas ete touchee');
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  CHANGER DE BUREAU PEUT JETER DU TRAVAIL\n'); process.exit(1); }
console.log('  CHANGER DE BUREAU NE JETTE PAS DE TRAVAIL\n');
process.exit(0);
