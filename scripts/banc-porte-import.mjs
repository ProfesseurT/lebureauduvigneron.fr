/* ============================================================================
   scripts/banc-porte-import.mjs : le banc du guide d'import

     npm run banc:porte

   ECRIT LE 08/09/2026, avec le 6e ecran de la porte : celui qui, apres une
   inscription ou le vigneron a repondu OUI a la question Vitisoft, lui montre
   comment deposer sa base et lui donne l'adresse de Teddy s'il ne sait pas.

   CE QU'IL VERIFIE, et pourquoi chaque point a besoin d'un controle :

     1. Le guide n'apparait QUE sur « oui ». « non », « je ne sais pas » et
        l'absence de reponse entrent directement : parler d'export Vitisoft a
        quelqu'un qui vient de dire qu'il n'en a pas serait une promesse vide.

     2. La fiche part en base AVANT le guide. Si le guide s'intercalait avant
        l'envoi, un vigneron qui ferme la fenetre a cet instant perdrait ses
        cinq reponses.

     3. « Passer cette etape » n'y passe jamais, et n'ecrit rien.

     4. Le verrou pose depuis l'INTERIEUR d'un outil ne montre pas le guide.
        bdv-base.js ouvre la porte au moment ou le vigneron depose un fichier :
        lui expliquer comment deposer un fichier serait absurde. C'est ce que
        separe l'option guideImport, vraie dans ouvrir() seulement.

     5. La destination forcee ne fuit pas. « Deposer ma base maintenant » demande
        /mon-bureau/#base au lieu du bureau nu, et cette demande est consommee
        UNE fois : sans ca, un clic sur un bouton de compte, des jours plus tard,
        renverrait encore vers Ma base.

   IL DEMANDE jsdom :  npm install --save-dev jsdom
   Sans lui il s'arrete en le disant, et il ne rend jamais un faux OK.

   DEUX CHOSES QU'IL NE FAIT PAS, et il faut les savoir :

   - Aucun reseau. GoTrue et PostgREST sont remplaces par un double qui note les
     appels, et il repond une session immediate au /signup : l'etape du code a
     six chiffres est donc sautee. Ce banc verifie ce qui vient APRES les cinq
     questions, pas la confirmation d'adresse.

   - Aucune mise en page. jsdom ne calcule pas de pixels, et il ne laisse ni
     remplacer `location` ni observer une navigation. On lit donc l'INTENTION de
     sortie (BdvCompte.destinationDemandee), sauf dans le controle 2b qui passe
     par la vraie delegation de clic depuis /mon-bureau/, ou le renvoi vers #base
     n'est qu'un changement de fragment : celui-la, jsdom sait le faire.
     « Le bouton est-il atteignable sur un telephone » reste a verifier a l'oeil.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RACINE, 'src/js');

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = await import('jsdom')); }
catch (e) {
  console.error('\n  jsdom est absent, le banc ne peut pas tourner.');
  console.error('  Rien n\'a ete verifie. Installe-le :  npm install --save-dev jsdom\n');
  process.exit(2);
}
if (!fs.existsSync(path.join(JS, 'bdv-compte.js'))) {
  console.error('\n  src/js/bdv-compte.js est absent : le banc ne verifie rien.\n');
  process.exit(2);
}

let ok = 0, ko = 0;
const dit = (b, m, vu) => {
  if (b) { ok++; console.log('  ok    : ' + m); }
  else { ko++; console.log('  ECHEC : ' + m + (vu === undefined ? '' : '  -> ' + JSON.stringify(vu))); }
};
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const SOURCE = fs.readFileSync(path.join(JS, 'bdv-compte.js'), 'utf8');

function monter(adresse) {
  const dom = new JSDOM(
    '<!doctype html><html><body><a href="/compte/" data-bdv-compte>Créer mon compte</a></body></html>',
    {
      url: adresse || 'https://lebureauduvigneron.fr/',
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      // Muette : une navigation non implementee est attendue, elle ne doit pas noyer le rapport.
      virtualConsole: new VirtualConsole()
    }
  );
  const w = dom.window;
  const etat = { appels: [] };

  /* jsdom n'a NI fetch NI Response : la reponse est un objet a la main, avec juste ce que
     bdv-compte.js lui demande (ok, status, json, text, headers.get). Un `new Response` ici
     leve « is not a constructor », et le message part dans l'ecran d'erreur de la porte au
     lieu du rapport : deux heures perdues la premiere fois. */
  const reponse = (corps, status) => ({
    ok: status >= 200 && status < 300,
    status: status,
    json: () => Promise.resolve(corps ? JSON.parse(corps) : {}),
    text: () => Promise.resolve(corps || ''),
    headers: { get: () => null }
  });

  w.fetch = function (url, opt) {
    opt = opt || {};
    const u = String(url);
    etat.appels.push({ url: u, methode: opt.method || 'GET', corps: opt.body || null });
    if (u.indexOf('/auth/v1/signup') >= 0) {
      return Promise.resolve(reponse(JSON.stringify({
        access_token: 'jeton', refresh_token: 'refresh', expires_in: 3600,
        user: { id: '11111111-1111-1111-1111-111111111111', email: 'test@exemple.fr' },
        identities: [{ id: 'x' }]
      }), 200));
    }
    return Promise.resolve(reponse(null, 204));
  };

  const s = w.document.createElement('script');
  s.textContent = SOURCE;
  w.document.body.appendChild(s);
  etat.w = w;
  return etat;
}

/* Va jusqu'a l'ecran des cinq questions.
   parBouton : on passe par la delegation de clic, comme un vigneron sur le site.
   Sinon on appelle porte() ou ouvrir() a la main, selon ce que le controle veut isoler. */
async function jusquauxQuestions(t, ouverture) {
  const w = t.w;
  if (ouverture === 'bouton') w.document.querySelector('[data-bdv-compte]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  else if (ouverture === 'verrou') w.BdvCompte.porte({ titre: 'Tes chiffres sont prêts.' });
  else t.promesse = w.BdvCompte.ouvrir({});
  await dormir(20);
  w.document.querySelector('#bdvEmail').value = 'test@exemple.fr';
  w.document.querySelector('#bdvMdp').value = 'Chateau2026!';
  w.document.querySelector('#bdvBtnInscription').click();
  await attendreEtape(t, 'profil');
}
const clic = (t, sel) => t.w.document.querySelector(sel).click();
/* On attend que l'ecran arrive, on ne parie pas sur un delai : jsdom enchaine les promesses
   du faux fetch a son rythme, et un sleep fixe rend le banc capricieux (paye pendant son
   ecriture : les cinq questions n'etaient pas encore la, et les clics partaient dans le vide). */
async function attendreEtape(t, nom) {
  for (let i = 0; i < 200; i++) {
    if (visibles(t).join() === nom) return true;
    await dormir(10);
  }
  return false;
}
async function attendre(condition) {
  for (let i = 0; i < 200; i++) { if (condition()) return true; await dormir(10); }
  return false;
}
const visibles = (t) => Array.from(t.w.document.querySelectorAll('[data-etape]')).filter(e => !e.hidden).map(e => e.dataset.etape);
const porteLa = (t) => !!t.w.document.querySelector('.bdv-porte');

/* ==========================================================================
   1. « oui » : le guide s'affiche, et il porte l'adresse de secours
   ========================================================================== */
console.log('\n== 1. Vitisoft = oui, entree depuis le site ==');
{
  const t = monter();
  await jusquauxQuestions(t, 'ouvrir');
  dit(visibles(t).join() === 'profil', 'les cinq questions sont affichees', visibles(t));
  t.w.document.querySelector('#bdvPrenom').value = 'Ted';
  t.w.document.querySelector('#bdvDomaine').value = 'Domaine Test';
  clic(t, '[data-choix="viti"] [data-valeur="oui"]');
  clic(t, '#bdvBtnProfil');
  await attendreEtape(t, 'import');
  dit(visibles(t).join() === 'import', 'le 6e ecran a remplace les questions', visibles(t));

  const ecran = t.w.document.querySelector('[data-etape="import"]');
  dit(ecran.textContent.indexOf('teddy@solumatic.fr') >= 0, 'l\'adresse de secours est dans l\'ecran');
  dit(ecran.querySelector('a').getAttribute('href') === 'mailto:teddy@solumatic.fr', 'elle est cliquable');
  dit(ecran.querySelectorAll('.bdv-porte__etapes li').length === 3, 'trois etapes, pas plus');

  const envois = t.appels.filter(a => a.url.indexOf('/profils') >= 0 && a.corps && a.corps.indexOf('utilise_vitisoft') >= 0);
  dit(envois.length === 1, 'la fiche part en base AVANT le guide, une seule fois', envois.length);
  dit(envois.length === 1 && JSON.parse(envois[0].corps).domaine === 'Domaine Test', 'le domaine saisi est bien dans l\'envoi');
}

/* ==========================================================================
   2. Les deux sorties du guide
   ========================================================================== */
console.log('\n== 2a. L\'intention de sortie, lue a la source ==');
{
  const t = monter();
  await jusquauxQuestions(t, 'ouvrir');
  clic(t, '[data-choix="viti"] [data-valeur="oui"]');
  clic(t, '#bdvBtnProfil');
  await attendreEtape(t, 'import');
  clic(t, '#bdvBtnImport');
  const session = await t.promesse;
  dit(!porteLa(t), 'la fenetre se ferme');
  dit(!!session, 'la session est rendue a l\'appelant, le vigneron reste connecte');
  dit(t.w.BdvCompte.destinationDemandee() === '/mon-bureau/#base', '« Deposer ma base » demande la piece Ma base');
}
{
  const t = monter();
  await jusquauxQuestions(t, 'ouvrir');
  clic(t, '[data-choix="viti"] [data-valeur="oui"]');
  clic(t, '#bdvBtnProfil');
  await attendreEtape(t, 'import');
  clic(t, '#bdvImportPlusTard');
  await t.promesse;
  dit(t.w.BdvCompte.destinationDemandee() === null, '« Plus tard » ne demande rien : le bouton du site decide');
}

console.log('\n== 2b. Le meme trajet, par la vraie delegation de clic ==');
{
  // Depuis /mon-bureau/, le renvoi vers /mon-bureau/#base n'est qu'un changement de
  // fragment : jsdom l'execute pour de vrai, et le fragment se lit apres coup.
  const t = monter('https://lebureauduvigneron.fr/mon-bureau/');
  await jusquauxQuestions(t, 'bouton');
  clic(t, '[data-choix="viti"] [data-valeur="oui"]');
  clic(t, '#bdvBtnProfil');
  await attendreEtape(t, 'import');
  clic(t, '#bdvBtnImport');
  await attendre(() => t.w.location.hash === '#base');
  dit(t.w.location.hash === '#base', 'le vigneron atterrit bien sur la piece Ma base', t.w.location.hash);
}

/* ==========================================================================
   3. Les reponses qui n'ouvrent aucun guide
   ========================================================================== */
console.log('\n== 3. « non », « je ne sais pas », et pas de reponse ==');
for (const cas of ['non', 'inconnu', null]) {
  const t = monter();
  await jusquauxQuestions(t, 'ouvrir');
  t.w.document.querySelector('#bdvPrenom').value = 'Ted';
  if (cas) clic(t, '[data-choix="viti"] [data-valeur="' + cas + '"]');
  clic(t, '#bdvBtnProfil');
  const session = await t.promesse;
  dit(!porteLa(t) && !!session && t.w.BdvCompte.destinationDemandee() === null,
    'reponse « ' + (cas || 'aucune') + ' » : aucun guide, on entre au bureau');
}

/* ==========================================================================
   4. « Passer cette etape »
   ========================================================================== */
console.log('\n== 4. Passer cette etape ==');
{
  const t = monter();
  await jusquauxQuestions(t, 'ouvrir');
  clic(t, '[data-choix="viti"] [data-valeur="oui"]');
  clic(t, '#bdvProfilPasser');
  await attendre(() => !porteLa(t));
  dit(!porteLa(t), 'on entre sans voir le guide, meme avec « oui » coche');
  dit(t.appels.filter(a => a.corps && a.corps.indexOf('utilise_vitisoft') >= 0).length === 0,
    'et rien n\'est ecrit : passer, c\'est passer');
}

/* ==========================================================================
   5. Le verrou pose depuis l'interieur d'un outil
   ========================================================================== */
console.log('\n== 5. Verrou interne : aucun guide, et rien qui traine ==');
{
  const t = monter('https://lebureauduvigneron.fr/mon-bureau/');
  await jusquauxQuestions(t, 'verrou');
  clic(t, '[data-choix="viti"] [data-valeur="oui"]');
  clic(t, '#bdvBtnProfil');
  await attendre(() => !porteLa(t));
  dit(!porteLa(t), 'la fenetre se ferme sans montrer le guide');
  dit(t.w.location.hash === '', 'et sans deplacer le vigneron : il reste sur son import', t.w.location.hash);
  dit(t.w.BdvCompte.destinationDemandee() === null, 'aucune destination ne reste en attente');
}

/* ==========================================================================
   6. Une ouverture n'herite pas du choix de la precedente
   ========================================================================== */
console.log('\n== 6. La destination forcee ne fuit pas ==');
{
  const t = monter();
  await jusquauxQuestions(t, 'ouvrir');
  clic(t, '[data-choix="viti"] [data-valeur="oui"]');
  clic(t, '#bdvBtnProfil');
  await attendreEtape(t, 'import');
  clic(t, '#bdvBtnImport');
  await t.promesse;
  dit(t.w.BdvCompte.destinationDemandee() === '/mon-bureau/#base', 'la demande se lit une fois');
  dit(t.w.BdvCompte.destinationDemandee() === null, 'et une seule : la deuxieme lecture est vide');
  // Deuxieme ouverture, cette fois sans toucher a Vitisoft : rien ne doit rester du tour d'avant.
  t.promesse = t.w.BdvCompte.ouvrir({});
  await attendre(() => porteLa(t));
  dit(t.w.BdvCompte.destinationDemandee() === null, 'et l\'ouverture suivante repart a zero');
}

console.log('\n  ' + ok + ' controles passes, ' + ko + ' en echec\n');
process.exit(ko ? 1 : 0);
