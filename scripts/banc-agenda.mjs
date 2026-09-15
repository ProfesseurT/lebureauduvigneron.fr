/* ===========================================================================
   BANC DE L'ABONNEMENT AGENDA — src/js/bdv-ics.js sur la VRAIE bibliotheque
   ===========================================================================
   Pose le 15/09/2026 avec le Lot E.

   CE QU'IL A DE PARTICULIER. La fonction Edge `agenda-ics` n'est testable que
   deployee : c'est pour cela que toute la mise en forme est sortie dans
   `src/js/bdv-ics.js`, et que ce banc la fait tourner ici, sur les 49
   occurrences reelles du fichier de donnees, a chaque `npm run verif`.

   LES DEUX CONTROLES QUI VALENT LE BANC A EUX SEULS :

   - LE REPLIAGE A L'OCTET. Aucun client ne leve d'erreur sur une ligne trop
     longue : Outlook la tronque, au milieu d'un mot, et le rendez-vous
     s'affiche ampute. Le controle mesure des OCTETS et verifie en plus qu'aucune
     ligne ne contient de caractere de remplacement, preuve qu'on n'a pas coupe
     un accent en deux.
   - AUCUNE FAMILLE PRIVEE NE PASSE. On injecte volontairement une tache et un
     rappel client dans l'entree, et on verifie qu'ils ne ressortent pas. C'est
     la promesse de confidentialite du lot, et elle ne doit pas dependre de la
     bonne volonte du prochain qui ajoutera une famille.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

new Function(lire('src/js/bdv-echeances.js'))();
new Function(lire('src/js/bdv-ics.js'))();
const E = globalThis.BdvEcheances, I = globalThis.BdvIcs;
if (!E || !I) { console.error('\n  ECHEC : le moteur ou la mise en forme ne se pose pas.\n'); process.exit(1); }

const BIBLIO = JSON.parse(lire('src/_data/echeances.json'));

let ok = 0, ko = 0;
const titre = (x) => console.log('\n== ' + x + ' ==');
function vrai(nom, cond, detail) {
  if (cond) { ok++; console.log('  ok    : ' + nom); }
  else { ko++; console.log('  ECHEC : ' + nom + (detail ? '\n          ' + detail : '')); }
}

/* La meme fenetre que la fonction : du 1er du mois en cours, sur 24 mois. */
const ajd = new Date();
const DU = new Date(ajd.getFullYear(), ajd.getMonth(), 1);
const AU = new Date(ajd.getFullYear(), ajd.getMonth() + 24, 0);
const fluxDe = (regles) => I.calendrier(E.etaler(regles, DU, AU));

/* ---------------------------------------------------------------------- 1 */
titre('1. Le flux se fabrique sur la vraie bibliotheque');
const regles = E.appliquerChoix(I.publiques(BIBLIO), null);
const flux = fluxDe(regles);
const lignes = flux.split('\r\n');
const evts = (flux.match(/BEGIN:VEVENT/g) || []).length;
vrai(BIBLIO.length + ' occurrences en bibliotheque, ' + regles.length + ' publiques, ' +
     evts + ' rendez-vous sur 24 mois', evts > 40, evts + ' rendez-vous');
vrai('le calendrier est ouvert et referme une seule fois',
     (flux.match(/BEGIN:VCALENDAR/g) || []).length === 1 &&
     (flux.match(/END:VCALENDAR/g) || []).length === 1);
vrai('autant de END:VEVENT que de BEGIN:VEVENT',
     evts === (flux.match(/END:VEVENT/g) || []).length);
vrai('les lignes sont separees par CRLF et le fichier finit par CRLF',
     flux.endsWith('\r\n') && !/[^\r]\n/.test(flux));

/* ---------------------------------------------------------------------- 2 */
titre('2. Le repliage, a l\'octet, sans couper un accent');
const enc = new TextEncoder();
const trop = lignes.filter((l) => enc.encode(l).length > 75);
vrai(lignes.length + ' lignes, aucune au-dessus de 75 octets', trop.length === 0,
     trop.slice(0, 2).map((l) => enc.encode(l).length + ' octets : ' + l.slice(0, 60)).join('\n          '));
const casse = lignes.filter((l) => l.indexOf('�') >= 0);
vrai('aucun caractere de remplacement : aucun accent coupe en deux', casse.length === 0,
     casse.slice(0, 2).join('\n          '));
/* Une ligne repliee se DEPLIE en retirant CRLF + l'espace. Le controle verifie
   que le tour complet rend le texte d'origine, accents compris. */
const longue = 'SUMMARY:' + 'Déclaration récapitulative mensuelle très accentuée '.repeat(4);
const deplie = I._outils.replier(longue).split('\r\n ').join('');
vrai('replier() puis deplier() rend exactement le texte d\'origine', deplie === longue,
     deplie.slice(0, 80));

/* ---------------------------------------------------------------------- 3 */
titre('3. DTEND est EXCLUSIF, sinon la moitie des clients n\'affiche rien');
const unJour = BIBLIO.find((e) => e.cle === 'saint-vincent');
const bloc = I.evenement(E.etaler([unJour], DU, AU)[0]);
const ds = bloc.find((l) => l.startsWith('DTSTART')).split(':')[1];
const de = bloc.find((l) => l.startsWith('DTEND')).split(':')[1];
const versDate = (s) => new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
vrai('une occurrence d\'un jour finit le LENDEMAIN (' + ds + ' -> ' + de + ')',
     Math.round((versDate(de) - versDate(ds)) / 86400000) === 1);
const periode = BIBLIO.find((e) => e.recurrence && e.recurrence.duree > 1);
const bp = I.evenement(E.etaler([periode], DU, AU)[0]);
const d1 = bp.find((l) => l.startsWith('DTSTART')).split(':')[1];
const d2 = bp.find((l) => l.startsWith('DTEND')).split(':')[1];
vrai('« ' + periode.titre +' » dure ' + periode.recurrence.duree + ' jours et DTEND le confirme',
     Math.round((versDate(d2) - versDate(d1)) / 86400000) === periode.recurrence.duree);

/* ---------------------------------------------------------------------- 4 */
titre('4. Le flux est STABLE d\'une lecture a l\'autre');
/* Si DTSTAMP valait l'heure courante, deux lectures rendraient deux fichiers
   differents et certains clients re-notifieraient l'utilisateur a chaque
   synchronisation. Voir le piege 3 de bdv-ics.js. */
vrai('deux fabrications successives rendent le meme octet', fluxDe(regles) === flux);
vrai('aucun DTSTAMP ne porte l\'heure courante',
     !flux.split('\r\n').some((l) => l.startsWith('DTSTAMP:') && !/T000000Z$/.test(l)));

/* ---------------------------------------------------------------------- 5 */
titre('5. Aucune famille privee ne passe, meme injectee de force');
const espions = [
  { cle: 'tache-espionne', titre: 'Rappeler le domaine Machin', famille: 'taches',
    statut: 'repere', recurrence: { type: 'annuel', mois: DU.getMonth() + 1, jour: 15 } },
  { cle: 'client-espion', titre: 'Relancer Cave du Vieux Pressoir', famille: 'clients',
    statut: 'repere', recurrence: { type: 'annuel', mois: DU.getMonth() + 1, jour: 16 } },
];
vrai('publiques() les ecarte avant tout calcul', I.publiques(espions).length === 0);
/* Et la redondance : meme si elles arrivaient jusqu'a la mise en forme. */
const fluxSale = I.calendrier(E.etaler(BIBLIO.concat(espions), DU, AU));
vrai('calendrier() les ecarte une seconde fois',
     fluxSale.indexOf('Machin') < 0 && fluxSale.indexOf('Vieux Pressoir') < 0);
vrai('et les quatre familles publiques, elles, sont bien la',
     I.FAMILLES_PUBLIQUES.every((f) => flux.indexOf('CATEGORIES:' + f) >= 0));

/* ---------------------------------------------------------------------- 6 */
titre('6. L\'echappement RFC 5545');
const piege = I.evenement({
  debut: DU, fin: DU, duree: 1, famille: 'tempsforts',
  e: { cle: 'x', titre: 'Foire, salon; test\\fin\nsuite', famille: 'tempsforts', statut: 'repere' },
}).find((l) => l.startsWith('SUMMARY'));
vrai('virgule, point-virgule, contre-oblique et saut de ligne sont echappes',
     piege === 'SUMMARY:Foire\\, salon\\; test\\\\fin\\nsuite', piege);

/* ---------------------------------------------------------------------- 7 */
titre('7. Les choix du vigneron, appliques par le MEME code que l\'ecran');
const repere = BIBLIO.find((e) => e.statut === 'repere' && e.famille === 'tempsforts');
const obligation = BIBLIO.find((e) => e.statut === 'obligation');
const eteint = (cle) => (c) => c === cle ? { actif: false, decale: 0 } : { actif: true, decale: 0 };
vrai('un repere eteint disparait : ' + repere.titre,
     E.appliquerChoix([repere], eteint(repere.cle)).length === 0);
vrai('une obligation NE s\'eteint PAS : ' + obligation.titre,
     E.appliquerChoix([obligation], eteint(obligation.cle)).length === 1);
const decale = (c) => ({ actif: true, decale: 21 });
vrai('un repere se decale de trois semaines',
     E.appliquerChoix([repere], decale)[0].decale === 21);
vrai('une obligation NE se decale PAS',
     E.appliquerChoix([obligation], decale)[0].decale === undefined);

/* ---------------------------------------------------------------------- 8 */
titre('8. Ce que le vigneron verra');
const parFamille = {};
E.etaler(regles, DU, AU).forEach((o) => { parFamille[o.famille] = (parFamille[o.famille] || 0) + 1; });
console.log('  ' + Object.entries(parFamille).map(([k, v]) => k + ' ' + v).join(', '));
console.log('  poids du fichier : ' + Math.round(flux.length / 1024) + ' ko');

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  L\'ABONNEMENT AGENDA N\'EST PAS SUR'); process.exit(1); }
console.log('  L\'ABONNEMENT AGENDA DIT LA VERITE');
