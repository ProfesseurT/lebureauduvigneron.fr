/* ============================================================================
   scripts/apercu-porte.mjs : LA PORTE DE COMPTE, EN IMAGE, 22/09/2026

     npm run build && npm run apercu:porte
     puis ouvrir _apercu/porte.html

   POURQUOI IL EXISTE. La porte est le PREMIER ecran de quelqu'un qui n'a pas
   encore de compte, le SEUL ecran d'un invite qui arrive par un lien, et
   l'ecran de la premiere ouverture de l'application sur un iPhone, parce
   qu'une app iOS a son propre stockage et que la session ouverte dans Safari
   n'y est pas. Elle n'avait aucun apercu : les 45 etats du banc d'empreinte
   des lots 6 a 8 ont TOUS une session, et les trois audits de contraste ne
   l'ont vue que depuis le bureau CONNECTE.

   IL MONTRE LES DEUX MONDES COTE A COTE, ET C'EST TOUT L'INTERET. La meme
   porte s'ouvre depuis les douze pages du site, ou elle doit rester en PAPIER,
   et depuis le bureau, ou elle est recouverte par la section 20 de
   bdv-bureau.css sous `body.bdv-coque`. Une colonne montre le papier, deux
   colonnes montrent le bureau dans ses deux themes. Une regle du bureau qui
   perdrait son scope se verrait ici, dans la premiere colonne.

   IL NE RECOPIE RIEN : c'est `src/js/bdv-compte.js` qui construit le balisage
   et qui injecte son style, et ce sont ses VRAIS boutons qui font passer d'une
   etape a l'autre. Le serveur GoTrue est double, comme dans le harnais de
   capture, et avec les memes reponses.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { cssBureau, TETE_POLICES, motsVides } from './apercu-socle.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
const JS = path.join(RACINE, 'src/js/bdv-compte.js');
const INVITE = 'alice@domaine-essai.fr';

/* LES QUATRE FEUILLES DU BUREAU, DANS L'ORDRE OU LE GABARIT LES LIE, LUES SUR
   LA PAGE CONSTRUITE par `apercu-socle.mjs` depuis le 22/09/2026 : ce fichier
   en tenait sa propre copie, et une liste tenue a la main ment le jour ou on
   l'oublie. La premiere colonne, celle du site, ne montre que le style PAPIER
   injecte par bdv-compte.js, puisqu'elle ne porte pas `bdv-coque` : c'est
   exactement ce que voit /compte/. */
const CSS_BUREAU = cssBureau();

/* LE SERVEUR DOUBLE, champ pour champ celui de scripts/bureau-garni.mjs :
     /auth/v1/recover  -> 200 {} .......... mene a l'etape du code
     /auth/v1/verify   -> 200 + session ... mene a l'ecran du nouveau mot de passe
   Toute autre adresse est refusee comme un reseau coupe. */
function doubler(w) {
  w.fetch = function (url) {
    const u = String(url);
    const rendre = (o) => Promise.resolve({ ok: true, status: 200,
      headers: { get: () => null },
      text: () => Promise.resolve(JSON.stringify(o)),
      json: () => Promise.resolve(o) });
    if (u.indexOf('/auth/v1/recover') >= 0) return rendre({});
    if (u.indexOf('/auth/v1/verify') >= 0) return rendre({
      access_token: 'reprise', refresh_token: 'reprise', expires_in: 3600,
      user: { id: 'invite', email: INVITE } });
    return Promise.reject(new TypeError('Failed to fetch'));
  };
}

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

async function monter(opts, pilote) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window;
  doubler(w);
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(JS, 'utf8');
  w.document.body.appendChild(s);
  await dormir(20);
  w.BdvCompte.porte(opts);
  await dormir(30);
  if (pilote) { await pilote(w); }
  const carte = w.document.querySelector('.bdv-porte__carte');
  if (!carte) throw new Error('la porte ne s\'est pas ouverte : BdvCompte.porte() a rendu null');
  /* LE STYLE INJECTE EST REPRIS TEL QUEL : c'est la moitie papier de la paire,
     celle que le bureau recouvre. Le recopier a la main serait le defaut que ce
     fichier existe pour eviter. */
  const injecte = [...w.document.head.querySelectorAll('style')].map(n => n.textContent).join('\n');
  return { html: carte.outerHTML, injecte: injecte };
}

const ETATS = [];
let injecte = null;

async function ajouter(titre, quoi, opts, pilote, garde) {
  const r = await monter(opts, pilote);
  injecte = injecte || r.injecte;
  if (garde && r.html.indexOf(garde) < 0) {
    console.error('  ALERTE : l\'etat « ' + titre + ' » n\'a pas ete atteint ('
      + garde + ' absent du rendu)');
    process.exit(1);
  }
  ETATS.push({ titre, quoi, html: r.html });
}

await ajouter('1. Connexion',
  'Ce que le bouton « Créer mon compte ou me connecter » du bureau déconnecté ouvre depuis le 11/09/2026. C’est l’écran de la PREMIÈRE ouverture sur un iPhone : une app iOS a son propre stockage, donc la session ouverte dans Safari n’y est pas.',
  { mode: 'connexion', titre: 'Ton bureau t’attend.' }, null, 'bdvBtnConnexion');

await ajouter('2. Inscription',
  'L’autre moitié du même écran. Les quatre règles de mot de passe sont visibles AVANT la première frappe : un refus muet sur une règle qu’on n’avait pas annoncée est la panne la plus coûteuse de cet écran.',
  { mode: 'inscription' }, null, 'bdvBtnInscription');

await ajouter('3. Inscription, adresse imposée',
  'Le chemin d’un invité. L’adresse est remplie et en LECTURE SEULE, et l’écran dit pourquoi : l’acceptation vérifie que les deux correspondent, et un compte créé avec une autre adresse échouerait après coup, c’est-à-dire au pire moment.',
  { mode: 'inscription', email: INVITE }, null, 'bdvEmailImpose');

await ajouter('4. Le code à six chiffres',
  'Atteint par le vrai bouton « Mot de passe oublié ? ». Le même écran sert à confirmer une inscription et à reprendre un mot de passe ; seule la phrase change.',
  { mode: 'connexion' },
  async (w) => {
    w.document.getElementById('bdvEmail').value = INVITE;
    w.document.getElementById('bdvOublie').click();
    await dormir(60);
  }, 'bdvBtnCode');

await ajouter('5. Le nouveau mot de passe',
  'Le code a ouvert une session, il reste à poser le mot de passe. Les règles satisfaites portent une coche ET une couleur : le glyphe passe de « · » à « ✓ », donc la couleur ne fait que confirmer.',
  { mode: 'connexion' },
  async (w) => {
    w.document.getElementById('bdvEmail').value = INVITE;
    w.document.getElementById('bdvOublie').click();
    await dormir(60);
    w.document.getElementById('bdvCode').value = '123456';
    w.document.getElementById('bdvBtnCode').click();
    await dormir(80);
    const n = w.document.getElementById('bdvNouveauMdp');
    n.value = 'Vendange2026!';
    n.dispatchEvent(new w.Event('input', { bubbles: true }));
    await dormir(20);
  }, 'bdv-porte__regle--ok');

const colonne = (etat, quoi, theme) =>
  '<div class="ap__b"' + (theme ? ' data-theme="' + theme + '"' : '') + '>'
  + '<p class="ap__l">' + quoi + '</p><div class="ap__cadre">' + etat.html + '</div></div>';

const page = '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<title>Apercu : la porte de compte</title>'
  + TETE_POLICES
  + '<style>' + CSS_BUREAU + '</style>'
  /* LE STYLE INJECTE PAR bdv-compte.js VIENT APRES LES FEUILLES, COMME DANS LE
     PRODUIT, et c'est toute la raison pour laquelle la section 20 de
     bdv-bureau.css pese (0,2,1) et pas (0,2,0) : a specificite egale, c'est lui
     qui gagnerait. Le poser ici AVANT les feuilles ferait mentir cet apercu
     dans le sens le plus dangereux, celui qui declare vert un recouvrement
     mort. */
  + '<style>' + injecte + '</style>'
  + '<style>'
  + 'body{background:#22262C;margin:0;padding:2rem 1rem;font-family:Inter,system-ui,sans-serif}'
  + '.ap{max-width:1500px;margin:0 auto}'
  + '.ap__t{font-family:Fraunces,Georgia,serif;color:#F3F4F6;margin:2.5rem 0 .2rem;font-size:1.3rem}'
  + '.ap__q{margin:0 0 1rem;color:#9CA3AC;max-width:80ch;font-size:.9rem;line-height:1.6}'
  + '.ap__trio{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;align-items:start}'
  + '@media (max-width:1100px){.ap__trio{grid-template-columns:1fr}}'
  /* CHAQUE COLONNE REDIT LE FOND ET L'ENCRE : un conteneur qui force un theme
     retourne les JETONS de son sous-arbre, mais pas les proprietes deja
     CALCULEES au-dessus. Lecon de l'apercu de « L'equipe », 21/09/2026. */
  + '.ap__b{padding:1rem;border-radius:8px;background:var(--bdv-fond,#F3F0E9);'
  + 'color:var(--bdv-encre-2,#33383F);outline:1px solid rgba(255,255,255,.14)}'
  + '.ap__b--site{background:#F3F0E9;color:#1E2536}'
  + '.ap__l{font-family:"JetBrains Mono",monospace;font-size:10px;text-transform:uppercase;'
  + 'letter-spacing:.09em;color:#8A8478;margin:0 0 .6rem}'
  /* LA CARTE EST SORTIE DE SON VOILE : `.bdv-porte` est en `position:fixed`, et
     trois voiles empiles sur une page d'apercu ne montreraient que le dernier.
     Le dessin de la CARTE est intact, c'est lui qu'on vient juger. */
  + '.ap__cadre{max-width:440px}'
  + '</style>'
  /* LE CORPS NE PORTE PAS `bdv-coque` : c'est la colonne du SITE qui doit
     sortir en papier, et elle ne le peut que si la classe vit sur les deux
     colonnes du bureau, et sur elles seules. */
  + '</head><body><div class="ap">'
  + '<h1 class="ap__t">La porte de compte, les cinq ecrans, 22/09/2026</h1>'
  + '<p class="ap__q">A gauche, ce que voit un visiteur du site : la porte en papier, celle que '
  + '<code>bdv-compte.js</code> injecte. Au milieu et a droite, la meme porte ouverte depuis '
  + '/mon-bureau/, ou la section 20 de bdv-bureau.css la recouvre, dans les deux themes. '
  + 'Le balisage et le style papier viennent du vrai module, et les etapes 4 et 5 sont '
  + 'atteintes par leurs vrais boutons.</p>'
  + ETATS.map(e => '<h2 class="ap__t">' + e.titre + '</h2><p class="ap__q">' + e.quoi + '</p>'
      + '<div class="ap__trio">'
      + '<div class="ap__b ap__b--site"><p class="ap__l">le site, papier</p>'
      + '<div class="ap__cadre">' + e.html + '</div></div>'
      + '<div class="bdv-coque">' + colonne(e, 'le bureau, clair', 'light') + '</div>'
      + '<div class="bdv-coque">' + colonne(e, 'le bureau, sombre', 'dark') + '</div>'
      + '</div>').join('')
  + '</div></body></html>';

fs.mkdirSync(path.join(RACINE, '_apercu'), { recursive: true });
fs.writeFileSync(path.join(RACINE, '_apercu/porte.html'), page);
console.log('  ecrit : _apercu/porte.html  (' + ETATS.length + ' ecrans x 3 colonnes, '
  + Math.round(page.length / 1024) + ' ko)');

/* CE QUE LA MESURE PEUT DIRE SANS L'IMAGE : les mots vides. Le controle vit
   dans le socle depuis le 22/09/2026 : il etait recopie dans quatre fichiers. */
if (motsVides(ETATS.map(e => e.html)).length) process.exit(1);

process.exit(0);
