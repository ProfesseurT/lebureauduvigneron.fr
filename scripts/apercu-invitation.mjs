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

   ET IL MENTAIT DEPUIS LE 21/09/2026, CORRIGE LE 22/09/2026. Il ne posait que
   `style.css`. Depuis la scission du 21/09 au matin, TOUT le dessin du bandeau
   vit dans `src/css/bdv-poste.css` : `.invitation__titre`, `__note`, `__gestes`,
   `__souci` n'ont plus une seule declaration dans `style.css`. Cet apercu
   rendait donc le bandeau NU, exactement comme `apercu:equipe` rendait sa piece
   nue toute une journee sans que rien ne le dise. Il pose maintenant les quatre
   feuilles DANS L'ORDRE OU LE GABARIT LES LIE, la classe `bdv-coque` sur le
   corps de page, et les deux themes cote a cote : le bandeau est le SEUL ecran
   que voit un invite, et il le voit en sombre s'il a un telephone en sombre.
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

/* LES QUATRE FEUILLES DU BUREAU, DANS L'ORDRE OU LE GABARIT LES LIE.
   bdv-poste.css est liee ENTRE style.css et bdv-bureau.css, et c'est ce qui
   donne a la coque le dernier mot a specificite egale : inverser les deux
   retournerait la moitie des arbitrages du chantier des deux themes. */
const FEUILLES = ['src/css/style.css', 'src/css/bdv-theme.css',
                  'src/css/bdv-poste.css', 'src/css/bdv-bureau.css']
  .map(f => fs.readFileSync(path.join(RACINE, f), 'utf8')).join('\n');
const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Le bandeau d'invitation, les quatre états</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${FEUILLES}</style>
<style>
  /* LE HARNAIS, ET RIEN QUE LUI. */
  body{background:var(--bdv-fond);margin:0;padding:2rem 1rem}
  .ap__t{font-family:var(--font-titre);margin:2.5rem 0 .2rem;color:var(--bdv-encre-1)}
  .ap__q{margin:0 0 .8rem;color:var(--bdv-encre-3);max-width:62ch}
  .ap__duo{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;align-items:start;max-width:1400px}
  @media (max-width:900px){.ap__duo{grid-template-columns:1fr}}
  /* IL FAUT REDIRE LE FOND ET L'ENCRE, ET L'APERCU DE « L'EQUIPE » L'A PROUVE
     AU PREMIER PASSAGE LE 21/09/2026 : un conteneur « data-theme » retourne les
     JETONS de son sous-arbre, mais pas les proprietes deja CALCULEES au-dessus.
     La couleur que « body.bdv-coque » pose sur le corps de page est resolue
     avec les valeurs CLAIRES, et cette encre descend telle quelle dans le
     conteneur sombre. AUCUN ACCENT GRAVE ICI : ce bloc vit dans un litteral de
     gabarit, et un seul accent grave ferme la chaine. */
  .ap__b{padding:1rem;border-radius:8px;background:var(--bdv-fond);
         color:var(--bdv-encre-2);outline:1px solid var(--bdv-trait)}
  .ap__l{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;
         letter-spacing:.09em;color:var(--bdv-encre-4);margin:0 0 .5rem}
</style></head><body class="bdv-coque">
<h1 class="ap__t">Le bandeau d'invitation, 14/09/2026, revu le 22/09/2026</h1>
<p class="ap__q">C'est la première chose que voit quelqu'un qui ouvre le lien reçu par mail, et
souvent la seule qu'il lira. Rien n'est redessiné à la main : c'est le vrai module, avec les
quatre vraies feuilles du bureau, dans les deux thèmes.</p>
${morceaux.map(m => `<h2 class="ap__t">${m.titre}</h2><p class="ap__q">${m.quoi}</p>
<div class="ap__duo">${['light', 'dark'].map(t => `<div class="ap__b" data-theme="${t}">
<p class="ap__l">${t === 'light' ? 'clair' : 'sombre'}</p>
<div class="container--bureau">${m.html}</div></div>`).join('')}</div>`).join('\n')}
</body></html>`;

fs.mkdirSync(path.join(RACINE, '_apercu'), { recursive: true });
fs.writeFileSync(path.join(RACINE, '_apercu/invitation.html'), page);
console.log('  ecrit : _apercu/invitation.html  (' + Math.round(page.length / 1024) + ' ko)');
process.exit(0);
