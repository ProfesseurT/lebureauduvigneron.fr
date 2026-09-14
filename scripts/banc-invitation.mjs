/* ============================================================================
   scripts/banc-invitation.mjs : LE LIEN D'INVITATION MARCHE SANS COMPTE

     npm run banc:invitation

   POURQUOI IL EXISTE. Le lien envoye par mail s'adresse, dans le cas le plus
   frequent, a quelqu'un qui n'a PAS de compte : c'est la demande de Ted du
   14/09/2026, mot pour mot (« si l'utilisateur n'a pas de compte encore ca devient
   tres complexe »). Or ce parcours etait mort, pour DEUX raisons independantes,
   dans deux fichiers sans rapport l'un avec l'autre :

     1. `#invitationBandeau` vivait dans `#bureauContenu`, qui porte `hidden` tant
        qu'il n'y a pas de session. Le bandeau etait rempli, puis demasque, dans un
        parent masque : invisible.
     2. `invitationEventuelle()` etait la derniere ligne de `BdvNav.monter()`, que
        /mon-bureau/ n'appelle QUE si une session existe. Sans compte, le module de
        l'invitation n'etait donc jamais charge.

   AUCUN BANC NE POUVAIT LES VOIR : la cause est dans un gabarit, l'effet dans un
   module charge a la demande, et les deux fichiers ne se citent pas. Seul un banc
   qui ouvre la PAGE CONSTRUITE sans session les attrape. C'est la meme lecon que
   le 11/09/2026 : un controle ecrit pour l'occasion valide toujours tout.

   IL DEMANDE jsdom :  npm install --save-dev jsdom
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RACINE, 'src/js');
const PAGE = path.join(RACINE, '_site/mon-bureau/index.html');

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = await import('jsdom')); }
catch (e) { console.error('  il manque jsdom :  npm install --save-dev jsdom'); process.exit(1); }

if (!fs.existsSync(PAGE)) {
  console.error('  il manque la page construite :  npm run build');
  process.exit(1);
}

let ok = 0, ko = 0;
function dit(vrai, quoi, detail) {
  if (vrai) { ok++; console.log('  ok    : ' + quoi); }
  else { ko++; console.log('  ECHEC : ' + quoi + (detail !== undefined ? '  ->  ' + detail : '')); }
}

const JETON = 'a'.repeat(64);
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

/* ==========================================================================
   1. LE BANDEAU N'EST PAS ENFERME DANS LA MOITIE CONNECTEE DE LA PAGE
   ==========================================================================
   Controle sur la PAGE CONSTRUITE et pas sur le gabarit : c'est le fichier que
   le navigateur recoit. Et il se lit par la chaine de parents, pas par l'ordre
   des lignes : `hidden` sur n'importe quel ancetre suffit a tout eteindre. */
console.log('\n== 1. Le bandeau se voit sans session ==');
{
  const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), { url: 'https://lebureauduvigneron.fr/mon-bureau/' });
  const d = dom.window.document;
  const bandeau = d.getElementById('invitationBandeau');
  dit(!!bandeau, 'le bandeau existe dans la page');

  const contenu = d.getElementById('bureauContenu');
  dit(!!contenu && contenu.hasAttribute('hidden'),
    'et `#bureauContenu` est bien masque tant qu\'il n\'y a pas de session');

  let masque = null;
  for (let n = bandeau && bandeau.parentElement; n; n = n.parentElement) {
    if (n.hasAttribute && n.hasAttribute('hidden')) { masque = n.id || n.tagName; break; }
  }
  dit(masque === null,
    'AUCUN DE SES PARENTS N\'EST MASQUE : le demasquer ne sert a rien si un ancetre l\'eteint',
    'masque par ' + masque);
}

/* ==========================================================================
   2. LE MODULE DE L'INVITATION PART SANS SESSION
   ==========================================================================
   jsdom ne va pas chercher les scripts qu'on ajoute, et c'est parfait ici : on
   ne veut pas EXECUTER bdv-equipe.js, on veut savoir si bdv-nav.js le DEMANDE.
   L'element pose dans <head> est la preuve, et elle ne depend d'aucun reseau. */
console.log('\n== 2. Sans compte, le module de l\'invitation est quand meme charge ==');
async function demande(adresse, cles) {
  const vc = new VirtualConsole();
  const dom = new JSDOM('<!doctype html><html><body><nav id="bureauNav"></nav>'
    + '<div class="invitation" id="invitationBandeau" hidden></div></body></html>',
    { url: adresse, runScripts: 'dangerously', virtualConsole: vc });
  const w = dom.window;
  Object.keys(cles || {}).forEach(k => { try { w.sessionStorage.setItem(k, cles[k]); } catch (e) {} });
  w.fetch = () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('[]'), json: () => Promise.resolve([]) });
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(JS, 'bdv-nav.js'), 'utf8');
  w.document.body.appendChild(s);
  await dormir(20);
  return [].map.call(w.document.querySelectorAll('script[src]'), x => x.getAttribute('src'));
}
{
  // AUCUNE session n'est posee : c'est exactement l'etat de l'invite qui arrive.
  const avec = await demande('https://lebureauduvigneron.fr/mon-bureau/?invitation=' + JETON);
  dit(avec.indexOf('/js/bdv-equipe.js') >= 0,
    'un jeton dans l\'adresse charge le module, meme sans session', JSON.stringify(avec));

  const enAttente = await demande('https://lebureauduvigneron.fr/mon-bureau/',
    { bdv_invitation_en_cours: JETON });
  dit(enAttente.indexOf('/js/bdv-equipe.js') >= 0,
    'ET UN JETON MIS DE COTE AUSSI : c\'est le cas du retour apres inscription, ou '
    + 'l\'adresse a ete nettoyee', JSON.stringify(enAttente));

  const sans = await demande('https://lebureauduvigneron.fr/mon-bureau/');
  dit(sans.indexOf('/js/bdv-equipe.js') < 0,
    'et sans invitation, rien n\'est charge : ce fichier ne doit peser sur personne',
    JSON.stringify(sans));
}

/* ==========================================================================
   3. CE QUE L'INVITE SANS COMPTE LIT VRAIMENT
   ==========================================================================
   Le bandeau doit dire QUI invite, DANS QUOI, et surtout A QUELLE ADRESSE : c'est
   elle qui prerempli et verrouille l'inscription. Sans elle, l'invite cree un
   compte avec l'adresse de son choix et l'acceptation echoue APRES coup. */
console.log('\n== 3. Le bandeau dit l\'adresse invitee, et propose les deux chemins ==');
async function bandeau(session) {
  const vc = new VirtualConsole();
  const dom = new JSDOM('<!doctype html><html><body>'
    + '<div class="invitation" id="invitationBandeau" hidden></div></body></html>',
    { url: 'https://lebureauduvigneron.fr/mon-bureau/?invitation=' + JETON,
      runScripts: 'dangerously', virtualConsole: vc });
  const w = dom.window;
  if (session) {
    w.localStorage.setItem('bdv_session', JSON.stringify({
      access_token: 'essai', refresh_token: 'essai',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '11111111-1111-1111-1111-111111111111', email: 'ted@essai.fr' }
    }));
    w.localStorage.setItem('bdv_proprietaire', '11111111-1111-1111-1111-111111111111');
    w.localStorage.setItem('bdv_bureau_v1', 'b0000000-0000-0000-0000-000000000001');
  }
  w.fetch = function (url) {
    const u = String(url);
    let corps = '[]';
    if (u.indexOf('invitation_apercu') >= 0) {
      corps = JSON.stringify([{ bureau_nom: 'Domaine des Coteaux', invite_par_prenom: 'Romane',
                                email: 'nouvelle@domaine.fr', etat: 'valide' }]);
    }
    return Promise.resolve({
      ok: true, status: 200, headers: { get: () => null },
      text: () => Promise.resolve(corps), json: () => Promise.resolve(JSON.parse(corps))
    });
  };
  ['bdv-compte.js', 'bdv-equipe.js'].forEach(function (f) {
    const s = w.document.createElement('script');
    s.textContent = fs.readFileSync(path.join(JS, f), 'utf8');
    w.document.body.appendChild(s);
  });
  await dormir(40);
  await w.BdvEquipe.traiterInvitation();
  await dormir(10);
  return w;
}
{
  const w = await bandeau(false);
  const n = w.document.getElementById('invitationBandeau');
  dit(!n.hidden, 'le bandeau est demasque');
  dit(n.textContent.indexOf('Romane') >= 0, 'il dit qui invite', n.textContent.slice(0, 80));
  dit(n.textContent.indexOf('Domaine des Coteaux') >= 0, 'et dans quel bureau');
  dit(n.textContent.indexOf('nouvelle@domaine.fr') >= 0,
    'L\'ADRESSE INVITEE EST ECRITE EN TOUTES LETTRES : c\'est elle qui verrouille '
    + 'l\'inscription, et sans elle l\'acceptation echoue apres la creation du compte',
    n.textContent.slice(0, 160));
  dit(!!w.document.getElementById('invitationInscription'), 'le chemin « je cree mon compte » est la');
  dit(!!w.document.getElementById('invitationConnexion'), 'et celui « j\'ai deja un compte » aussi');
  dit(!w.document.getElementById('invitationOui'),
    'et PAS le bouton « Rejoindre » : on ne rejoint rien avant d\'avoir un compte');

  // Le jeton doit survivre au nettoyage de l'adresse, sinon l'inscription le perd.
  dit(w.sessionStorage.getItem('bdv_invitation_en_cours') === JETON,
    'le jeton est mis de cote avant que l\'adresse soit nettoyee');
  dit(String(w.location.href).indexOf('invitation=') < 0,
    'et l\'adresse ne le porte plus : un jeton ne reste pas dans la barre du navigateur');
}
{
  const w = await bandeau(true);
  const n = w.document.getElementById('invitationBandeau');
  dit(!!w.document.getElementById('invitationOui'),
    'avec une session, c\'est le bouton « Rejoindre » qui s\'affiche');
  dit(n.textContent.indexOf('nouvelle@domaine.fr') < 0,
    'et l\'adresse n\'est plus repetee : elle ne sert qu\'a preremplir une inscription');
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE LIEN D\'INVITATION NE MARCHE PAS SANS COMPTE\n'); process.exit(1); }
console.log('  LE LIEN D\'INVITATION MARCHE SANS COMPTE\n');
process.exit(0);
