/* ============================================================================
   scripts/apercu-invitation.mjs : REGARDER le bandeau d'invitation

     npm run build && npm run apercu:invitation
     puis ouvrir _apercu/invitation.html

   ECRIT LE 14/09/2026, apres avoir trouve que ce bandeau ne s'affichait PAS du
   tout pour quelqu'un sans compte : il vivait dans un bloc masque, et son module
   n'etait meme pas charge. Deux causes, deux fichiers, et aucune capture pour les
   voir. Le banc prouve maintenant qu'il s'affiche ; celui-ci montre a quoi il
   ressemble, ce qu'aucun banc ne dira jamais.

   Il monte le VRAI module dans la page CONSTRUITE, avec sa vraie feuille de style,
   dans les quatre etats que le lien peut produire.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
const JS = path.join(RACINE, 'src/js');
const JETON = 'a'.repeat(64);

const CAS = [
  { cle: 'sansCompte', session: false,
    rep: [{ bureau_nom: 'Domaine des Coteaux', invite_par_prenom: 'Romane',
            email: 'nouvelle@domaine.fr', etat: 'valide' }],
    titre: '1. L’invité n’a pas encore de compte',
    quoi: 'Le cas le plus fréquent, et celui qui ne s’affichait pas du tout jusqu’au 14/09. L’adresse invitée est dite en toutes lettres : c’est elle qui préremplira et verrouillera l’inscription.' },
  { cle: 'avecCompte', session: true,
    rep: [{ bureau_nom: 'Domaine des Coteaux', invite_par_prenom: 'Romane',
            email: 'ted@essai.fr', etat: 'valide' }],
    titre: '2. L’invité a déjà un compte, et il est connecté',
    quoi: 'Un seul geste, et la phrase qui rassure : ses autres bureaux ne bougent pas.' },
  { cle: 'expiree', session: false,
    rep: [{ bureau_nom: 'Domaine des Coteaux', invite_par_prenom: 'Romane',
            email: 'nouvelle@domaine.fr', etat: 'expiree' }],
    titre: '3. Le lien a expiré',
    quoi: 'Sept jours passés. On nomme la personne à qui redemander, pas un code d’erreur.' },
  { cle: 'inconnu', session: false, rep: [],
    titre: '4. Le lien ne vaut rien',
    quoi: 'Jeton inconnu, ou invitation annulée depuis. Même règle : on dit quoi faire.' }
];

async function rendre(cas) {
  const dom = new JSDOM('<!doctype html><html><body>'
    + '<div class="invitation" id="invitationBandeau" hidden></div></body></html>',
    { url: 'https://x.test/mon-bureau/?invitation=' + JETON, runScripts: 'dangerously' });
  const w = dom.window;
  if (cas.session) {
    w.localStorage.setItem('bdv_session', JSON.stringify({
      access_token: 'essai', refresh_token: 'essai',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '11111111-1111-1111-1111-111111111111', email: 'ted@essai.fr' } }));
    w.localStorage.setItem('bdv_proprietaire', '11111111-1111-1111-1111-111111111111');
    w.localStorage.setItem('bdv_bureau_v1', 'b0000000-0000-0000-0000-000000000001');
  }
  w.fetch = function (url) {
    const corps = String(url).indexOf('invitation_apercu') >= 0 ? JSON.stringify(cas.rep) : '[]';
    return Promise.resolve({ ok: true, status: 200, headers: { get: () => null },
      text: () => Promise.resolve(corps), json: () => Promise.resolve(JSON.parse(corps)) });
  };
  ['bdv-compte.js', 'bdv-equipe.js'].forEach(function (f) {
    const s = w.document.createElement('script');
    s.textContent = fs.readFileSync(path.join(JS, f), 'utf8');
    w.document.body.appendChild(s);
  });
  await new Promise(r => setTimeout(r, 40));
  await w.BdvEquipe.traiterInvitation();
  await new Promise(r => setTimeout(r, 10));
  return w.document.getElementById('invitationBandeau').outerHTML.replace(' hidden', '');
}

const morceaux = [];
for (const c of CAS) morceaux.push({ ...c, html: await rendre(c) });

const css = fs.readFileSync(path.join(RACINE, 'src/css/style.css'), 'utf8');
const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Le bandeau d'invitation, les quatre états</title>
<style>${css}</style>
<style>
  /* LE HARNAIS, ET RIEN QUE LUI. */
  body{background:#F3F0E9;margin:0;padding:2rem 1rem;font-family:system-ui,sans-serif}
  .ap__t{font-family:Georgia,serif;margin:2.5rem 0 .2rem}
  .ap__q{margin:0 0 .8rem;color:#5A5346;max-width:62ch}
  .ap__boite{max-width:1000px;margin:0 auto 1rem}
</style></head><body>
<h1 class="ap__t">Le bandeau d'invitation, 14/09/2026</h1>
<p class="ap__q">C'est la première chose que voit quelqu'un qui ouvre le lien reçu par mail, et
souvent la seule qu'il lira. Rien n'est redessiné à la main : c'est le vrai module, avec la vraie
feuille de style.</p>
${morceaux.map(m => `<h2 class="ap__t">${m.titre}</h2><p class="ap__q">${m.quoi}</p>
<div class="ap__boite">${m.html}</div>`).join('\n')}
</body></html>`;

fs.mkdirSync(path.join(RACINE, '_apercu'), { recursive: true });
fs.writeFileSync(path.join(RACINE, '_apercu/invitation.html'), page);
console.log('  ecrit : _apercu/invitation.html  (' + Math.round(page.length / 1024) + ' ko)');
process.exit(0);
