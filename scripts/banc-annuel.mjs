/* ===========================================================================
   BANC D'ANNUALITE — ce qui se perime doit crier, pas mentir
   ===========================================================================
   Pose le 14/09/2026, Lot A du chantier « calendrier marketing ».

   LE DEFAUT QU'IL EXISTE POUR ATTRAPER, et il n'est pas theorique : un
   calendrier ne tombe jamais en panne. Il continue d'afficher, avec le meme
   aplomb qu'une DRM, des dates qui ont cesse d'etre vraies. Trois lignes de la
   bibliotheque portaient une date fixe pour une fete qui n'en a pas, et leur
   propre champ `detail` disait « a verifier chaque annee ». Personne ne l'a
   jamais lu, parce qu'un champ `detail` ne reveille personne.

   CE BANC REVEILLE. Il est dans `npm run verif`, donc il BLOQUE le deploiement.
   Une date pourrie coute un `npm run verif` rouge, pas un client qui se deplace
   un jour ou le salon est ferme.

   LES CONTROLES
   1. Toute ligne `unique` porte `verifieLe`, et cette verification a moins de
      douze mois. C'est ce qui force la passe annuelle.
   2. Aucune ligne `unique` n'est pourrie. EXCEPTION ASSUMEE : une `unique` de
      la famille `obligations` a le DROIT d'etre passee. « Facturation
      electronique, obligation de recevoir » au 01/09/2026 est une date d'entree
      en vigueur, elle reste utile a afficher pour toujours. Un salon passe, non.
   3. Les dates mobiles calculees sont celles du calendrier reel, sur quatre ans.
      Ce controle confronte le moteur a des dates VERIFIABLES ailleurs, pas a
      lui-meme : c'est ce qui lui donne sa valeur.
   4. Le type `annuel-jour-semaine` ne sort jamais du mois vise, sur onze ans,
      douze mois, sept jours et six rangs. Un cinquieme jeudi qui n'existe pas
      doit retomber sur le quatrieme, jamais deborder sur decembre.
   5. Toute ligne du fichier de donnees est LISIBLE par le moteur. `lisible()`
      avale en silence une regle mal ecrite, et la ligne disparait du calendrier
      sans une erreur. Une faute de frappe ne doit pas couter une obligation.

   ET UN CONTROLE QUI REGARDE LOIN : la fete des meres francaise est le dernier
   dimanche de mai SAUF quand ce jour est celui de Pentecote, et elle bascule
   alors au premier dimanche de juin. Ca depend de Paques, que `bdv-echeances.js`
   ne calcule pas. Ca arrive six fois en trente-cinq ans, la premiere en 2034.
   On ne l'a donc pas encodee : on la DETECTE ici, dix ans a l'avance, avec la
   conduite a tenir ecrite dans le message.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* DEPUIS LE PASSAGE BI-RUNTIME du 15/09/2026, le module se pose sur `globalThis`
   et plus sur le `window` qu'on lui injectait : il faut donc l'evaluer, puis le
   relire la ou il s'est pose. Injecter un faux `window` ne servait plus a rien,
   et le banc aurait lu `null` en annoncant zero echec. */
new Function(fs.readFileSync(path.join(RACINE, 'src/js/bdv-echeances.js'), 'utf8'))();
const B = globalThis.BdvEcheances;
if (!B) { console.error('\n  ECHEC : bdv-echeances.js ne pose plus BdvEcheances.\n'); process.exit(1); }
const LIGNES = JSON.parse(fs.readFileSync(path.join(RACINE, 'src/_data/echeances.json'), 'utf8'));

let ok = 0, ko = 0, alertes = [];
const titre = (x) => console.log('\n== ' + x + ' ==');
function vrai(nom, condition, detail) {
  if (condition) { ok++; console.log('  ok    : ' + nom); }
  else { ko++; console.log('  ECHEC : ' + nom + (detail ? '\n          ' + detail : '')); }
}
const prevenir = (x) => { alertes.push(x); console.log('  averti: ' + x); };

const JOUR = 86400000;
const minuit = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const iso = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()]
  .map((n, i) => i ? String(n).padStart(2, '0') : n).join('-');
const AUJOURDHUI = minuit(new Date());
const AN = AUJOURDHUI.getFullYear();

/* ---------------------------------------------------------------------- 1 */
titre('1. Chaque ligne `unique` a ete verifiee il y a moins de douze mois');
const uniques = LIGNES.filter((e) => (e.recurrence || {}).type === 'unique');
vrai('il y a bien des lignes `unique` a controler', uniques.length > 0);
for (const e of uniques) {
  const v = e.verifieLe ? minuit(new Date(e.verifieLe + 'T00:00:00')) : null;
  if (!v || isNaN(v.getTime())) {
    vrai('`' + e.cle + '` porte un champ `verifieLe` bien ecrit', false,
      'Une date en dur sans date de verification est une date que personne ne reverra. ' +
      'Ajouter "verifieLe": "AAAA-MM-JJ" le jour ou la date est confirmee a la source.');
    continue;
  }
  const mois = (AUJOURDHUI - v) / JOUR / 30.44;
  vrai('`' + e.cle + '` verifie il y a ' + mois.toFixed(1) + ' mois', mois < 12,
    'Confirmer la date sur ' + (e.source || 'la source officielle') +
    ', puis remonter "verifieLe" a aujourd\'hui (' + iso(AUJOURDHUI) + ').');
  if (mois >= 10 && mois < 12) prevenir('`' + e.cle + '` sera perime dans ' +
    Math.ceil((12 - mois) * 30.44) + ' jour(s). La passe annuelle approche.');
}

/* ---------------------------------------------------------------------- 2 */
titre('2. Aucun rendez-vous perime, et les entrees en vigueur sont epargnees');
for (const e of uniques) {
  const r = e.recurrence;
  const debut = minuit(new Date(r.date + 'T00:00:00'));
  const fin = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + (r.duree > 0 ? r.duree : 1) - 1);
  const jours = Math.round((fin - AUJOURDHUI) / JOUR);
  if ((e.famille || 'obligations') === 'obligations') {
    vrai('`' + e.cle + '` est une obligation : sa date passee est legitime', true);
    continue;
  }
  vrai('`' + e.cle + '` n\'est pas pourri (' + iso(fin) + ')', jours >= -30,
    'Termine depuis ' + (-jours) + ' jours. Le calendrier l\'affiche encore comme un ' +
    'rendez-vous. Remplacer par l\'edition suivante, ou retirer la ligne.');
  /* NE PAS PREVENIR QUAND LA RELEVE EST DEJA POSEE. Une edition suivante, c'est
     une autre ligne de MEME TITRE qui se termine plus tard : « Vacances de la
     Toussaint » 2027 prend la suite de celle de 2026. Sans ce filtre, le banc
     reclame a chaque `npm run verif` un travail deja fait, et une alerte qu'on
     apprend a ignorer ne sert plus a rien le jour ou elle est vraie. */
  const releve = uniques.some(function (o) {
    if (o.cle === e.cle || o.titre !== e.titre) return false;
    const od = minuit(new Date(o.recurrence.date + 'T00:00:00'));
    return od > debut;
  });
  if (jours >= 0 && jours <= 90 && !releve) prevenir('`' + e.cle + '` se termine dans ' + jours +
    ' jour(s). Poser l\'edition suivante AVANT, pas apres.');
}

/* ---------------------------------------------------------------------- 3 */
titre('3. Les dates mobiles sont celles du calendrier reel');
/* Verifiees a la main contre un calendrier 2026-2029, et pour 2027 contre le
   calendrier marketing publie par le Blog du Moderateur en aout 2026. */
const ATTENDU = {
  'fete-meres':         ['2026-05-31', '2027-05-30', '2028-05-28', '2029-05-27'],
  'fete-peres':         ['2026-06-21', '2027-06-20', '2028-06-18', '2029-06-17'],
  'black-friday':       ['2026-11-27', '2027-11-26', '2028-11-24', '2029-11-23'],
  'beaujolais-nouveau': ['2026-11-19', '2027-11-18', '2028-11-16', '2029-11-15']
};
for (const [cle, attendues] of Object.entries(ATTENDU)) {
  const ligne = LIGNES.find((e) => e.cle === cle);
  if (!ligne) { vrai('la ligne `' + cle + '` existe', false); continue; }
  const obtenues = B.etaler([ligne], new Date(2026, 0, 1), new Date(2029, 11, 31)).map((x) => iso(x.date));
  vrai(cle + ' : ' + obtenues.join(' '), obtenues.join(' ') === attendues.join(' '),
    'attendu ' + attendues.join(' '));
}

/* ---------------------------------------------------------------------- 4 */
titre('4. `annuel-jour-semaine` ne deborde jamais du mois vise');
let debordements = 0, essais = 0;
for (let an = 2026; an <= 2036; an++) {
  for (let mois = 1; mois <= 12; mois++) {
    for (let js = 1; js <= 7; js++) {
      for (const rang of [1, 2, 3, 4, 5, 'dernier']) {
        essais++;
        const l = B.etaler([{ cle: 'x', famille: 'tempsforts', statut: 'repere',
          recurrence: { type: 'annuel-jour-semaine', mois, jourSemaine: js, rang } }],
          new Date(an, 0, 1), new Date(an, 11, 31));
        if (l.length !== 1) { debordements++; continue; }
        const d = l[0].date;
        if (d.getMonth() + 1 !== mois || d.getFullYear() !== an) debordements++;
        if ((d.getDay() || 7) !== js) debordements++;
      }
    }
  }
}
vrai(essais + ' combinaisons annee/mois/jour/rang, toutes dans le bon mois et le bon jour',
  debordements === 0, debordements + ' debordement(s)');

/* ---------------------------------------------------------------------- 5 */
titre('5. Toute ligne du fichier de donnees est lisible par le moteur');
const muettes = LIGNES.filter((e) => B.calculer([e]).length === 0);
vrai(LIGNES.length + ' lignes, toutes calculables', muettes.length === 0,
  'Avalee(s) en silence par lisible() : ' + muettes.map((e) => e.cle).join(', ') +
  '. Une regle mal ecrite disparait du calendrier sans erreur.');

/* ---------------------------------------------------------------------- 6 */
titre('6. La fete des meres ne tombe pas un jour de Pentecote (quinze ans devant)');
function paques(an) {
  const a = an % 19, b = Math.floor(an / 100), c = an % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(an, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
const meres = LIGNES.find((e) => e.cle === 'fete-meres');
/* LE CALIBRAGE DE CE CONTROLE COMPTE AUTANT QUE LE CONTROLE. Il regarde quinze
   ans devant, mais il ne fait ECHOUER que si la collision tombe cette annee ou
   la suivante. Un banc qui bloque le deploiement pour un probleme de 2034 serait
   desactive par le premier qui le croise, et ce jour-la on perdrait aussi les
   cinq autres controles. Au-dela, il previent, et la prevention se lit dans le
   verdict a chaque `npm run verif`. */
const CONDUITE =
  'CONDUITE A TENIR : cette annee-la, la fete des meres bascule au PREMIER ' +
  'DIMANCHE DE JUIN. Poser pour cette annee-la une ligne `unique` qui remplace ' +
  'la regle, ou coder l\'exception en donnant a bdv-echeances.js le calcul de Paques.';
let collisions = [];
for (let an = AN; an <= AN + 15; an++) {
  const p = paques(an);
  const pentecote = new Date(an, p.getMonth(), p.getDate() + 49);
  const calculee = B.etaler([meres], new Date(an, 0, 1), new Date(an, 11, 31))[0];
  if (calculee && iso(calculee.date) === iso(pentecote)) collisions.push({ an, date: iso(pentecote) });
}
const urgentes = collisions.filter((c) => c.an <= AN + 1);
vrai('rien a corriger en ' + AN + ' ni en ' + (AN + 1), urgentes.length === 0,
  'Collision(s) : ' + urgentes.map((c) => c.an + ' (' + c.date + ')').join(', ') + '.\n          ' + CONDUITE);
const lointaines = collisions.filter((c) => c.an > AN + 1);
if (lointaines.length) prevenir('la fete des meres tombera un jour de Pentecote en ' +
  lointaines.map((c) => c.an).join(', ') + '. Rien a faire avant ' + (lointaines[0].an - 1) +
  '. ' + CONDUITE);

/* ---------------------------------------------------------------------- 7 */
titre('7. La feuille telechargeable sert une annee qui n\'est pas derriere nous');
/* C'EST LE REVEIL ANNUEL DE TOUT CE CHANTIER, et il tient en deux lignes.
   `/outils/calendrier/` sert la DERNIERE annee de src/_data/annees.js. Le jour
   ou cette derniere annee est passee, l'adresse stable distribue un calendrier
   perime a tous ceux qui l'ont imprimee, mise en newsletter ou lue au bas de la
   feuille. Rien ne leve d'erreur : la page se construit parfaitement, elle est
   juste fausse. Ici, elle fait echouer `npm run verif`.

   ET LA LISTE DOIT ETRE TRIEE, sinon `| last` ne rend pas ce qu'on croit. Un
   nombre pose dans le desordre publierait une annee ancienne a l'adresse
   stable, toujours sans erreur. */
const ANNEES = createRequire(import.meta.url)('../src/_data/annees.js');
vrai('src/_data/annees.js rend bien une liste non vide', Array.isArray(ANNEES) && ANNEES.length > 0);
if (Array.isArray(ANNEES) && ANNEES.length) {
  const triee = ANNEES.every((a, i) => i === 0 || ANNEES[i - 1] < a);
  vrai('la liste est triee, de la plus ancienne a la plus recente : [' + ANNEES.join(', ') + ']', triee,
    '`/outils/calendrier/` sert la DERNIERE de cette liste. Dans le desordre, elle servirait une annee passee.');
  const derniere = ANNEES[ANNEES.length - 1];
  vrai('la feuille servie a l\'adresse stable est celle de ' + derniere, derniere >= AN,
    'Nous sommes en ' + AN + ' et la feuille la plus recente est celle de ' + derniere + '.\n          ' +
    'C\'EST LA PASSE ANNUELLE : ajouter ' + (AN + 1) + ' dans src/_data/annees.js apres avoir\n          ' +
    'confirme les salons et les vacances scolaires (controles 1 et 2 ci-dessus), puis\n          ' +
    '`npm run build` et `npm run pdf:calendrier -- --an ' + (AN + 1) + '`.');
  if (derniere === AN) prevenir('la feuille de ' + (AN + 1) + ' n\'est pas encore posee. ' +
    'Le bon moment est octobre-novembre : le vigneron sort des vendanges et pose son annee.');
}

/* --------------------------------------------------------------------------- */
console.log('\n== CE QUI TOMBE DANS LES DOUZE PROCHAINS MOIS ==');
const dans12 = B.etaler(LIGNES, AUJOURDHUI, new Date(AN + 1, AUJOURDHUI.getMonth(), AUJOURDHUI.getDate()));
console.log('  ' + dans12.length + ' occurrences, ' +
  new Set(dans12.map((x) => x.e.cle)).size + ' regles distinctes');

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s), ' + alertes.length + ' alerte(s)');
if (alertes.length) alertes.forEach((a) => console.log('  a faire : ' + a));
if (ko) { console.log('  LE CALENDRIER PORTE DES DATES QUI NE SONT PLUS VRAIES'); process.exit(1); }
console.log('  LE CALENDRIER NE MENT PAS');
