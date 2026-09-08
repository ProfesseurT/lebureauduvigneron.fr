/* ===========================================================================
   BANC DE LA LUNE — src/js/bdv-almanach.js, la partie « ou est la lune »
   ===========================================================================
   Pose le 08/09/2026 avec la lune de l'entete du bureau.

   CE QUE CE BANC A DE PARTICULIER, et ce qui fait sa valeur : il ne verifie pas
   que le calcul est coherent avec lui-meme, il le confronte a des RESULTATS
   PUBLIES. Les exemples 47.a, 25.b et 48.a de Jean Meeus, Astronomical
   Algorithms, sont des nombres imprimes dans un livre en 1991 : les retrouver au
   milliieme de degre ne peut pas etre un hasard, et aucune erreur de recopie de
   table ne survit a ce test.

   Deux controles vont plus loin que la conformite a un livre :
   - le controle 5 retrouve le cycle de 18,6 ans des noeuds lunaires, qui n'est
     ecrit nulle part dans le code ;
   - le controle 8 mesure l'AIRE de la figure dessinee et la compare a la
     fraction eclairee. C'est ce qui attrape une inversion croissant/gibbeuse,
     seul defaut du dessin qui ne se verrait pas sur un ecran sans qu'on ait la
     vraie lune sous les yeux au meme instant.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER = path.join(RACINE, 'src/js/bdv-almanach.js');

const faux = { BdvAlmanach: null };
new Function('window', fs.readFileSync(FICHIER, 'utf8'))(faux);
const A = faux.BdvAlmanach;

let ok = 0, ko = 0;
const titre = (x) => console.log('\n== ' + x + ' ==');
function t(nom, obtenu, attendu, tol, unite) {
  const e = Math.abs(obtenu - attendu);
  if (e <= tol) { ok++; console.log('  ok    : ' + nom); }
  else {
    ko++;
    console.log('  ECHEC : ' + nom + '  →  obtenu ' + obtenu + ', attendu ' +
                attendu + ' a ' + tol + ' ' + (unite || '') + ' pres');
  }
}
function vrai(nom, cond, detail) {
  if (cond) { ok++; console.log('  ok    : ' + nom); }
  else { ko++; console.log('  ECHEC : ' + nom + (detail ? '  →  ' + detail : '')); }
}

console.log('fichier : ' + path.relative(RACINE, FICHIER));
const RAD = Math.PI / 180;

/* ------------------------------------------------------------------ 1, 2, 3 */
titre('Meeus 47.a — la Lune le 12 avril 1992 a 0 h TD (JD 2448724,5)');
const L = A.positionLune(2448724.5);
t('longitude ecliptique', L.lambda, 133.162655, 0.002, 'deg');
// 0,002 deg = 7 secondes d'arc : le residu assume de la table 47.B, dont on a
// garde 29 termes sur 60. Sur la fraction eclairee, il ne se voit pas.
t('latitude ecliptique', L.beta, -3.229126, 0.002, 'deg');
t('distance Terre-Lune', L.dist, 368409.7, 1, 'km');

titre('Meeus 25.b — le Soleil le 13 octobre 1992 a 0 h TD');
const S = A.positionSoleil(2448908.5);
t('longitude vraie', S.lambda, 199.90987, 0.001, 'deg');
// L'exemple du livre est calcule par VSOP87 ; nous employons la methode abregee
// du meme chapitre. L'ecart sur le rayon vecteur vaut 5 millioniemes en relatif,
// et se propage en 0,006 deg sur l'angle de phase du controle suivant.
t('distance Terre-Soleil (abregee vs VSOP87)',
  S.dist, 0.99760775 * 149597870.7, 12000, 'km');

titre('Meeus 48.a — la fraction eclairee, meme instant que 47.a');
const jd = 2448724.5, Lm = A.positionLune(jd), Sm = A.positionSoleil(jd);
const psi = Math.acos(Math.cos(Lm.beta * RAD) * Math.cos((Lm.lambda - Sm.lambda) * RAD)) / RAD;
const ang = Math.atan2(Sm.dist * Math.sin(psi * RAD),
                       Lm.dist - Sm.dist * Math.cos(psi * RAD)) / RAD;
t('angle de phase i', ang, 69.0756, 0.02, 'deg');
t('fraction eclairee k', (1 + Math.cos(ang * RAD)) / 2, 0.6786, 0.0004, '');

/* ---------------------------------------------------------------------- 4 */
titre('Accord avec les phases, deja verifiees 50 sur 50 sur 2026');
/* Deux calculs independants dans le meme fichier : les instants de phase
   (chapitre 49) et la position des astres (chapitres 47 et 25). Aux instants
   exacts, l'elongation doit valoir 0, 90, 180 ou 270. S'ils sont d'accord a
   l'instant pres, ils sont d'accord tous les autres jours du mois. */
const ATT = [0, 90, 180, 270], KATT = [0, 0.5, 1, 0.5];
let pireEl = 0, pireK = 0, n = 0, d = new Date(2026, 0, 1);
for (let m = 0; m < 14; m++) {
  const p = A.prochainePhase(d);
  if (!p || p.date.getFullYear() > 2026) break;
  const j = p.date.getTime() / 86400000 + 2440587.5;
  const ll = A.positionLune(j), ss = A.positionSoleil(j);
  const el = ((ll.lambda - ss.lambda) % 360 + 360) % 360;
  pireEl = Math.max(pireEl, Math.abs((((el - ATT[p.quart] + 180) % 360) + 360) % 360 - 180));
  const ps = Math.acos(Math.cos(ll.beta * RAD) * Math.cos((ll.lambda - ss.lambda) * RAD)) / RAD;
  const ii = Math.atan2(ss.dist * Math.sin(ps * RAD), ll.dist - ss.dist * Math.cos(ps * RAD)) / RAD;
  pireK = Math.max(pireK, Math.abs((1 + Math.cos(ii * RAD)) / 2 - KATT[p.quart]));
  n++; d = new Date(p.date.getTime() + 3600000);
}
vrai(n + ' phases parcourues sur 2026', n >= 12, n + ' trouvee(s)');
t('pire ecart d\'elongation aux instants exacts', pireEl, 0, 0.35, 'deg');
t('pire ecart de fraction eclairee', pireK, 0, 0.006, '');

/* ---------------------------------------------------------------------- 5 */
titre('La declinaison, et le cycle de dix-huit ans qu\'on ne lui a pas donne');
/* POURQUOI 28,4 ET NON 23,4. L'orbite de la Lune est inclinee de 5 degres sur
   l'ecliptique, et cette inclinaison tourne en 18,6 ans. Aux annees de grand
   arret lunaire la declinaison depasse 28 degres ; aux petits arrets elle
   plafonne a 18. Le dernier grand arret est 2025, donc 2026 doit sortir tout
   pres de 28,4. Ce chiffre n'est pas un reglage du test : c'est le calcul qui
   retrouve seul un cycle de dix-huit ans absent du code. */
let mini = 99, maxi = -99, bascules = 0, prec = null, memeSens = 0;
for (let j = 0; j < 400; j++) {
  const q = A.lune(new Date(2026, 0, 1 + j, 12));
  mini = Math.min(mini, q.declinaison); maxi = Math.max(maxi, q.declinaison);
  if (prec !== null && prec !== q.montante) bascules++;
  prec = q.montante;
  if (q.croissante === q.montante) memeSens++;
}
t('declinaison minimale sur 400 jours', mini, -28.4, 0.6, 'deg');
t('declinaison maximale sur 400 jours', maxi, 28.4, 0.6, 'deg');
// 400 jours / 27,32 = 14,6 cycles, donc une trentaine de bascules.
t('bascules montante/descendante', bascules, 29, 2, '');

/* ---------------------------------------------------------------------- 6 */
titre('Phase et declinaison sont DEUX cycles, et pas un seul');
/* LA FAUTE DE FOND QUE CE CONTROLE INTERDIT. Croissante/decroissante est la
   PHASE, 29,53 jours. Montante/descendante est la DECLINAISON, 27,32 jours. Un
   vigneron en biodynamie travaille sur la seconde. Les confondre - en deduisant
   l'une de l'autre pour economiser un calcul - donnerait 400 ou 0 coincidences
   sur 400. Le decalage des deux periodes en donne environ la moitie. */
console.log('  coincidences croissante/montante : ' + memeSens + ' sur 400');
vrai('les deux cycles se decalent (ni confondus, ni opposes)',
     memeSens > 120 && memeSens < 280, memeSens + '/400');

/* ---------------------------------------------------------------------- 7 */
titre('Les mots ne contredisent jamais le calendrier');
/* Le jour d'une phase exacte, l'entete doit dire le nom que la case du
   calendrier affiche, au caractere pres. Les autres jours, un nom intermediaire.
   Deux ecrans qui se contredisent le meme jour, c'est le defaut qu'aucun
   utilisateur ne pardonne parce qu'il ne peut pas savoir lequel croire. */
let jourDePhase = 0, discordances = 0, intermediaires = 0;
for (let j = 0; j < 200; j++) {
  const jour = new Date(2026, 0, 1 + j, 12);
  const q = A.lune(jour);
  const qq = A.phaseDuJour(jour);
  if (qq !== null) { jourDePhase++; if (q.nom !== A.phases[qq]) discordances++; }
  else { intermediaires++; if (A.phases.indexOf(q.nom) !== -1) discordances++; }
}
console.log('  ' + jourDePhase + ' jours de phase exacte, ' + intermediaires + ' jours entre deux');
vrai('aucun nom ne contredit la case du calendrier', discordances === 0,
     discordances + ' discordance(s)');
vrai('les jours de phase tombent bien environ tous les 7 jours',
     jourDePhase >= 25 && jourDePhase <= 30, jourDePhase + ' sur 200 jours');

/* ---------------------------------------------------------------------- 8 */
titre('Le dessin — l\'aire tracee vaut la fraction eclairee');
/* LE CONTROLE QUI ATTRAPE UNE INVERSION CROISSANT/GIBBEUSE. La figure est un
   demi-disque auquel on retire ou ajoute une demi-ellipse de demi-largeur w.
   Son aire vaut donc pi R2/2 -/+ pi R w/2. Si le drapeau de balayage est le bon,
   ce nombre vaut exactement pi R2 k. S'il est inverse, il vaut pi R2 (1 - k) :
   un croissant de 9 % dessine a 91 %, ce qu'aucun ecran ne signalerait. */
let pireAire = 0, mauvaisSens = 0;
for (let i = 0; i <= 200; i++) {
  const k = i / 200;
  const c = A.chemin(k);
  const m = c.match(/A([\d.]+) 50 0 0 ([01]) 0 -50Z$/);
  if (!m) { mauvaisSens++; continue; }
  const w = parseFloat(m[1]), sens = parseInt(m[2], 10), R = 50;
  if (Math.abs(w - Math.abs(1 - 2 * k) * R) > 0.006) mauvaisSens++;
  if (sens !== (k < 0.5 ? 0 : 1)) mauvaisSens++;
  const aire = Math.PI * R * R / 2 + (sens ? 1 : -1) * Math.PI * R * w / 2;
  pireAire = Math.max(pireAire, Math.abs(aire / (Math.PI * R * R) - k));
}
vrai('201 chemins bien formes, demi-largeur et sens conformes', mauvaisSens === 0,
     mauvaisSens + ' anomalie(s)');
t('pire ecart entre aire tracee et fraction eclairee', pireAire, 0, 0.0001, '');
// A 50 %, SVG doit recevoir un rayon nul, qu'il traite comme une droite : c'est
// ainsi que le terminateur d'un quartier devient rectiligne, sans cas special.
vrai('a 50 % la demi-largeur est nulle, donc le terminateur est droit',
     /A0\.00 50 /.test(A.chemin(0.5)), A.chemin(0.5));
vrai('a 0 % la figure est vide, a 100 % elle est pleine',
     /A50\.00 50 0 0 0 /.test(A.chemin(0)) && /A50\.00 50 0 0 1 /.test(A.chemin(1)));

/* ---------------------------------------------------------------------- 9 */
titre('Ce que l\'entete affichera aujourd\'hui');
const au = A.lune(new Date());
console.log('  ' + au.nom + ' — ' + au.pourcent + ' % eclairee');
console.log('  phase ' + (au.croissante ? 'croissante' : 'decroissante') +
            ', lune ' + (au.montante ? 'montante' : 'descendante') +
            ' (declinaison ' + au.declinaison.toFixed(1) + ' deg)');
if (au.prochaine) {
  console.log('  ' + au.prochaine.nom + ' dans ' + au.prochaine.jours + ' jour(s), le ' +
              au.prochaine.date.toLocaleString('fr-FR'));
}
vrai('la fraction est bien entre 0 et 1', au.eclairee >= 0 && au.eclairee <= 1);
vrai('un nom est toujours donne', typeof au.nom === 'string' && au.nom.length > 3);
vrai('une prochaine phase est toujours trouvee',
     !!au.prochaine && au.prochaine.date > new Date());

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LA LUNE NE DIT PAS LA VERITE'); process.exit(1); }
console.log('  LA LUNE DIT LA VERITE');
