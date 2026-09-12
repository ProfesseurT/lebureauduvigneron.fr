/* ==========================================================================
   BANC DES NUMEROS DE TELEPHONE, 11/09/2026
   ==========================================================================
   Ecrit le jour ou le bureau est devenu une application de telephone. Tant que
   l'outil se lisait sur un ordinateur, un numero mal decoupe etait un texte un peu
   sale ; sur un iPhone, c'est un bouton « Appeler » qui compose un faux numero.

   Le defaut repare, et il est de la pire famille : `parseTels()` rendait UN numero
   de vingt chiffres pour la cellule « 0612345678, 0494123456 », pendant que
   `formatTel()` affichait la saisie brute, donc les deux numeros JUSTES. L'ecran
   disait vrai, le lien composait faux, et rien ne levait d'erreur nulle part.

   D'ou les deux invariants que ce banc garde, et le second est le plus important :
   1. la cellule est decoupee sur tous les separateurs d'une saisie a la main ;
   2. LES CHIFFRES AFFICHES SONT TOUJOURS CEUX QUI SERONT COMPOSES. Un ecran qui
      ment sur un numero ne se rattrape pas : le vigneron a deja appele.

   Ce banc n'ouvre aucune page : il decoupe le bloc de `bdv-base.js` et l'evalue.
   Voir la lecon de `banc-registre.mjs`, un seul eval, sinon les `const` de tete
   restent enfermees dans leur propre portee.
   ========================================================================== */
import fs from 'node:fs';

let ok = 0, ko = 0;
function dit(v, quoi, detail) {
  if (v) { ok++; console.log('  OK   ' + quoi); }
  else { ko++; console.log('  ECHEC ' + quoi + (detail ? '\n        ' + detail : '')); }
}

const src = fs.readFileSync(new URL('../src/js/bdv-base.js', import.meta.url), 'utf8');
const d = src.indexOf('const SEP_TELS');
const f = src.indexOf('/* ======================= REGLAGES DU DOMAINE');
if (d < 0 || f < 0 || f < d) {
  console.log('  ECHEC le bloc des numeros est introuvable dans bdv-base.js');
  console.log('        (SEP_TELS ou le titre REGLAGES DU DOMAINE ont bouge)');
  process.exit(1);
}
const { parseTels, formatTel } = new Function(src.slice(d, f) + '\nreturn {parseTels, formatTel};')();

const un = (c, p) => { const r = parseTels(c, p); return r.length === 1 ? r[0].appel : null; };

console.log('\n== 1. Une cellule, un numero ==');
dit(un('0612345678') === '+33612345678', 'dix chiffres colles');
dit(un('06 12 34 56 78') === '+33612345678', 'espaces');
dit(un('06.12.34.56.78') === '+33612345678', 'points');
dit(un('06-12-34-56-78') === '+33612345678', 'tirets SANS espaces : un seul numero, pas cinq');
dit(un('612345678') === '+33612345678', 'zero de tete perdu a la saisie');
dit(un('0033612345678') === '+33612345678', '00 international');

console.log('\n== 2. Le + ne se cherche pas en tete de chaine ==');
dit(un('+33 6 12 34 56 78') === '+33612345678', '+ en tete');
dit(un('(+33) 6 12 34 56 78') === '+33612345678', '+ derriere une parenthese');
dit(un('Tel. +33 6 12 34 56 78') === '+33612345678', '+ derriere un libelle');
dit(un('+33 (0)4 94 12 34 56') === '+33494123456', 'zero de courtoisie apres l indicatif');

console.log('\n== 3. Une cellule, DEUX numeros ==');
for (const c of ['0612345678, 0494123456',
                 '0612345678 / 0494123456',
                 '0612345678 ; 0494123456',
                 '06 12 34 56 78 - 04 94 12 34 56',
                 '06 12 34 56 78 ou 04 94 12 34 56']) {
  const r = parseTels(c);
  dit(r.length === 2 && r[0].appel === '+33612345678' && r[1].appel === '+33494123456',
      'coupe ' + JSON.stringify(c), JSON.stringify(r.map(x => x.appel)));
}

console.log('\n== 4. On ne retient que le bloc qui est un numero ==');
dit(un('04 94 12 34 56 poste 12') === '+33494123456', 'un numero de poste ne se colle pas au numero');
dit(un('tel 2 : 06 12 34 56 78') === '+33612345678', 'un libelle numerote ne se colle pas non plus');
dit(parseTels('non renseigne').length === 0, 'du texte sans chiffres ne rend rien');
dit(parseTels('').length === 0, 'une cellule vide ne rend rien');
dit(parseTels('12').length === 0, 'trop court pour etre un numero');

console.log('\n== 5. On n inventE pas un indicatif francais pour un client etranger ==');
dit(un('0475 12 34 56', 'Belgique') !== '+33475123456',
    'un mobile belge ne devient pas un fixe en Ardeche', String(un('0475 12 34 56', 'Belgique')));
dit(un('+41 79 123 45 67', 'Suisse') === '+41791234567', 'un suisse en forme internationale passe tel quel');
dit(un('0612345678', 'France') === '+33612345678', 'un pays francais garde le repli');
dit(un('0612345678', '') === '+33612345678', 'un pays VIDE garde le repli : c est le cas courant');

console.log('\n== 6. L AFFICHE ET L APPEL NE DIVERGENT JAMAIS ==');
/* Le controle qui compte. Il ne regarde pas la mise en forme, il compare les
   CHIFFRES : ce que le vigneron lit doit etre ce que son telephone compose. */
const echantillon = ['0612345678', '06 12 34 56 78', '06.12.34.56.78', '0033612345678',
                     '(+33) 6 12 34 56 78', '+33 (0)4 94 12 34 56', '04 94 12 34 56 poste 12',
                     'tel 2 : 06 12 34 56 78', '0612345678, 0494123456',
                     '0475 12 34 56', '+41 79 123 45 67', '+971 50 123 4567'];
let divergences = [];
for (const c of echantillon) {
  for (const p of ['', 'France', 'Belgique', 'Suisse']) {
    for (const t of parseTels(c, p)) {
      const aff = t.affiche.replace(/\D/g, '');
      const app = t.appel.replace(/\D/g, '');
      // Un 0 national contre un 33 international sont la MEME serie de chiffres.
      const memes = aff === app
        || ('33' + aff.slice(1)) === app
        || aff === ('0' + app.slice(2));
      if (!memes) divergences.push(JSON.stringify(c) + ' [' + (p || 'sans pays') + '] affiche ' + t.affiche + ' compose ' + t.appel);
    }
  }
}
dit(divergences.length === 0, 'aucun numero affiche ne differe de celui qui sera compose',
    divergences.join('\n        '));

console.log('\n== 7. Le module lit bien le pays de la ligne ==');
dit(/parseTels\(o\.mobile,\s*o\.pays\)/.test(src) && /parseTels\(o\.fixe,\s*o\.pays\)/.test(src),
    'deriveRow passe le pays aux deux colonnes');

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  UN NUMERO AFFICHE N\'EST PAS CELUI QU\'ON COMPOSE\n'); process.exit(1); }
console.log('  CE QU\'ON LIT EST CE QU\'ON COMPOSE\n');
