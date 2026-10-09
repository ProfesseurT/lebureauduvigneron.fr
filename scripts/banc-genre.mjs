/* ============================================================================
   scripts/banc-genre.mjs : le genre et les accords, lot 92 (09/10/2026, demande de Ted)

     npm run banc:genre

   Ce qu'il garde :
     1. les accords de bdv-compte.js : masculin, feminin, et des mots EPICENES pour
        « je prefere ne pas le dire » (jamais de point median) ; une absence vaut 'n' ;
     2. CHACUN EST ACCORDE SELON SON GENRE : le 4e argument d'accord() l'emporte sur le
        genre de qui regarde ;
     3. la porte d'inscription : la question du genre est posee AVANT « Tu es », et y
        repondre re-accorde les metiers tout de suite ; la reponse part avec le profil ;
     4. les endroits qui doivent passer par ces accords le font (lecture du code : le role
        dans « L'equipe », la plaque, le bandeau du bureau, le titre de la fiche) ;
     5. le mot « maitre » ne s'affiche plus, et le SQL du lot 92 est dans la procedure.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) { console.error('\n  jsdom est absent, rien n\'a ete verifie.\n'); process.exit(2); }

let ok = 0, ko = 0;
const dit = (b, m) => { if (b) { ok++; console.log('  ok    : ' + m); } else { ko++; console.log('  ECHEC : ' + m); } };
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function monter() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = () => Promise.reject(new TypeError('pas de reseau'));
  w.eval(lire('src/js/bdv-compte.js'));
  return w;
}

console.log('\n== 1. Les accords ==');
{
  const w = monter(), C = w.BdvCompte;
  dit(C.genre() === 'n', 'sans reponse : « je prefere ne pas le dire »');
  dit(C.accord('Administrateur', 'Administratrice', 'Admin') === 'Admin', 'et les mots epicenes');
  let vu = null; w.document.addEventListener('bdv:genre', (e) => { vu = e.detail; });
  C.poserGenre('f');
  dit(C.genre() === 'f' && w.localStorage.getItem('bdv_genre_v1') === 'f' && vu === 'f', 'poserGenre range le genre (cle bdv_, qui part a la deconnexion) et le dit');
  dit(C.accord('Administrateur', 'Administratrice', 'Admin') === 'Administratrice', 'au feminin : Administratrice');
  dit(C.accord('Administrateur', 'Administratrice', 'Admin', 'm') === 'Administrateur', 'le genre de la personne decrite l\'emporte sur celui de qui regarde');
  C.poserGenre('x');
  dit(C.genre() === 'n', 'une valeur inconnue vaut « prefere ne pas le dire »');
  dit(C.libelleRole('maitre', 'f') === 'Administratrice' && C.libelleRole('maitre', 'm') === 'Administrateur' && C.libelleRole('maitre', 'n') === 'Admin',
    'le role administrateur s\'accorde');
  dit(C.libelleRole('simple', 'f') === 'Utilisatrice' && C.libelleRole('simple', 'n') === 'Membre', 'le role simple aussi');
  dit(C.libelleQui('vigneron', 'f') === 'Vigneronne' && C.libelleQui('caviste-negoce', 'f') === 'Caviste ou négociante' && C.libelleQui('vigneron', 'n') === 'Vigne et vin',
    '« Tu es » s\'accorde');
  dit(C.metier('vigneron', 'f') === 'Vigneronne' && C.metier('autre', 'f') === '' && C.metier('etudiant', 'm') === 'Étudiant', 'la plaque aussi, et « Autre » n\'y dit rien');
  dit(C.marque('f') === 'Le Bureau de la Vigneronne' && C.marque('m') === 'Le Bureau du Vigneron' && C.marque('n') === 'Le Bureau du Vigneron', 'le nom du bureau suit le genre, au feminin seulement');
  const tous = [];
  ['m', 'f', 'n'].forEach((g) => { tous.push(C.libelleRole('maitre', g), C.libelleRole('simple', g)); ['vigneron', 'caviste-negoce', 'etudiant', 'pro-filiere'].forEach((v) => tous.push(C.libelleQui(v, g), C.metier(v, g))); });
  dit(!tous.some((t) => /[·•]|\(e\)|\.e\b/.test(t)), 'aucun point median ni parenthese d\'accord, nulle part');
}

console.log('\n== 2. La porte d\'inscription ==');
{
  const w = monter(), d = w.document;
  w.BdvCompte.porte({ mode: 'inscription' });
  await dormir(20);
  const profil = d.querySelector('[data-etape="profil"]');
  dit(!!profil, 'l\'etape du profil existe');
  const labels = [...profil.querySelectorAll('.bdv-porte__label')].map((n) => n.textContent);
  dit(labels.indexOf('On t’écrit') >= 0 && labels.indexOf('On t’écrit') < labels.indexOf('Tu es'), 'la question du genre est posee avant « Tu es » (' + labels.join(' | ') + ')');
  dit(/Six questions/.test(profil.textContent), 'la note compte six questions');
  const vig = () => profil.querySelector('[data-choix="qui"] [data-valeur="vigneron"]').textContent;
  dit(vig() === 'Vigne et vin', 'sans reponse, « Tu es » parle en mots epicenes');
  profil.querySelector('[data-choix="genre"] [data-valeur="f"]').click();
  dit(vig() === 'Vigneronne', 'repondre « au feminin » re-accorde les metiers tout de suite');
  profil.querySelector('[data-choix="genre"] [data-valeur="f"]').click();
  dit(vig() === 'Vigne et vin', 'retirer sa reponse les remet en epicene');
  const src = lire('src/js/bdv-compte.js');
  dit(/const gen = choixDe\('genre'\);\s*if\(gen\) champs\.genre = gen;/.test(src), 'la reponse part avec le profil');
}

console.log('\n== 3. Les endroits qui passent par ces accords ==');
{
  const eq = lire('src/js/bdv-equipe.js');
  dit(/\+ role\(g\.role, gg\) \+/.test(eq) && /var gg = g\.genre \|\| 'n';/.test(eq), 'dans « L\'equipe », chaque role suit le genre de la personne qui le tient, et un genre absent vaut « n », jamais celui de qui regarde');
  dit(/\+ role\(l\.role, 'n'\) \+/.test(eq), 'une invitation (genre inconnu) prend la forme epicene');
  dit(!/'Administrateur'|'Utilisateur'/.test(eq), 'plus aucun role ecrit en dur');
  const mb = lire('src/mon-bureau.njk');
  dit(/BdvCompte\.metier\(p\.profil, p\.genre\)/.test(mb), 'la plaque passe par BdvCompte.metier');
  dit(/localStorage\.getItem\('bdv_genre_v1'\)==='f'/.test(mb), 'le bandeau dit « de la Vigneronne » des le premier rendu');
  dit(/<option value="simple">Membre<\/option>\s*<option value="maitre">Admin<\/option>/.test(mb), 'inviter propose les mots epicenes');
  const ec = lire('src/js/bdv-ecrans.js');
  dit((ec.match(/BdvCompte\.marque\(\)/g) || []).length >= 2, 'le titre de la fiche et la couverture du rapport suivent le nom du bureau');
  const sql = lire('supabase/lot92-genre.sql');
  dit(/add column if not exists genre text not null default 'n'/.test(sql) && /grant update \(genre\)/.test(sql) && /email text, genre text\)/.test(sql),
    'le SQL ajoute la colonne (defaut « n »), le droit de l\'ecrire, et le genre dans equipe()');
  dit(/'lot92-genre\.sql'/.test(lire('scripts/banc-rejeu.mjs')), 'et il est dans la procedure de reconstruction');
}

console.log('\n== 4. Le mot « maitre » ne s\'affiche plus ==');
{
  const site = path.join(RACINE, '_site');
  if (!fs.existsSync(site)) { dit(false, 'le site n\'est pas construit : lance npm run build'); }
  else {
    const pages = [];
    (function marche(dir) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) marche(p); else if (f.endsWith('.html')) pages.push(p); } })(site);
    const fautes = pages.filter((p) => /\bma[iî]tre(s)?\b/i.test(fs.readFileSync(p, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')));
    dit(fautes.length === 0, 'aucune page construite n\'affiche « maitre » (' + fautes.map((p) => path.relative(site, p)).join(', ') + ')');
  }
  const js = ['bdv-equipe.js', 'bdv-logo.js', 'bdv-brevo.js', 'bdv-boite.js', 'bdv-signature.js'].map((f) => lire('src/js/' + f)).join('\n');
  const chaines = js.match(/'[^'\n]*'/g) || [];
  dit(!chaines.some((c) => /Ma[iî]tre|ma[iî]tre du|un ma[iî]tre|le ma[iî]tre/.test(c)), 'aucune phrase des modules du bureau ne dit « maitre »');
  dit(/function motsEcran/.test(lire('src/js/bdv-compte.js')), 'les refus de la base sont traduits avant l\'ecran');
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LES ACCORDS NE TIENNENT PAS\n'); process.exit(1); }
console.log('  CHACUN EST ACCORDE SELON SON GENRE\n');
process.exit(0);
