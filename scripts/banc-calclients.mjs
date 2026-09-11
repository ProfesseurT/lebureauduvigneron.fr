/* ============================================================================
   BANC DES RAPPELS CLIENTS DANS LE CALENDRIER, 11/09/2026
   ============================================================================
   Ecrit le jour ou le calendrier s'est mis a montrer les rappels poses sur des
   clients, a la demande de Ted. Il garde UNE chose, et c'est celle qui coute
   cher quand elle lache :

     LE CALENDRIER LIT CES RAPPELS, IL NE LES STOCKE PAS, ET IL NE LES COCHE PAS.

   Pourquoi ca compte. La verite d'un rappel vit dans `suivi_clients`, ecrite par
   bdv-crm.js. Le calendrier va l'y lire. S'il lui donnait une case a cocher, le
   geste passerait par `BdvTaches.basculerOccurrence()` et ecrirait une ligne
   « ech:client:706:2026-09-13 » dans la table des taches : une fausse tache, a
   cote du vrai rappel, qui repondrait « fait » pendant que le sous-main
   continuerait de reclamer le client. Deux endroits qui repondent « ce client
   est-il traite », et ils se contrediraient des le premier clic.

   C'EST EXACTEMENT CE QUI EST ARRIVE EN L'ECRIVANT. La vue liste avait bien son
   cas particulier ; la pastille de la grille, elle, prenait le bouton de coche
   commun, deux fonctions plus loin. Rien n'echouait, rien ne s'affichait de
   travers, et le defaut ne se voyait qu'en lisant le HTML produit. D'ou ce banc.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RACINE, 'src/js');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));

let ok = 0, ko = 0;
const dit = (b, m, det) => {
  if (b) { ok++; console.log('  ok    : ' + m); }
  else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + det : '')); }
};
const jour = (n) => {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
       + '-' + String(d.getDate()).padStart(2, '0');
};

/* Une obligation mensuelle pour que la grille ne soit jamais vide, et un rappel
   pose dans deux jours : il tombe donc dans le mois affiche, quel que soit le jour
   ou ce banc tourne. Deux jours et pas trente : un rappel du mois suivant ne serait
   pas dans la grille, et le banc passerait sur du vide. */
const ECH = [{ cle: 'drm', titre: 'DRM', famille: 'obligations', statut: 'obligation',
               recurrence: { type: 'mensuel', jour: 10 } }];

const dom = new JSDOM('<!doctype html><body>'
  + '<script id="bdvEcheances" type="application/json">' + JSON.stringify(ECH) + '<\/script>'
  + '<div id="calVues"></div><div id="calCorps"></div><div id="calTitre"></div>'
  + '<div id="calFiltre"></div><div id="calNote"></div><div id="bureauCalendrier"></div>'
  + '</body>', { url: 'https://lebureauduvigneron.fr/mon-bureau/',
                 runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
w.BdvCompte = { monId: () => 'moi', session: () => ({ user: { id: 'moi' } }),
                api: () => Promise.resolve([]) };
/* LE MIROIR DE LA FILE, et rien d'autre : ce module ne fait aucun appel reseau, il
   lit ce que BdvCrm a depose. Trois lignes, trois cas : un rappel avec motif, un
   rappel sans motif, et un client mis de cote. */
w.BdvCrm = { miroir: () => ({
  noms: { '706': 'VINOBILIS SRL', '34': 'Oenophil' },
  suivi: [
    { id: '706', rappel: jour(2), titre: 'Lui reparler du reassort', statut: 'relance' },
    { id: '34',  rappel: jour(3), titre: '', statut: '' },
    { id: '99',  rappel: jour(2), titre: 'deja traite', statut: 'traite' }
  ]
}) };

for (const f of ['bdv-echeances.js', 'bdv-almanach.js', 'bdv-taches.js', 'bdv-calendrier.js']) {
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(JS, f), 'utf8');
  try { w.document.body.appendChild(s); }
  catch (e) { console.log('  ECHEC : ' + f + ' leve -> ' + e.message); process.exit(1); }
}
await new Promise(r => setTimeout(r, 60));
w.BdvCalendrier.ouvrir();
await new Promise(r => setTimeout(r, 120));

const grille = () => w.document.getElementById('calCorps').innerHTML;

console.log('\n== 1. La grille du mois ==');
dit(grille().length > 200, 'le calendrier se peint');
dit(grille().indexOf('VINOBILIS SRL') >= 0,
  'le rappel pose sur un client est dans la grille, sous le NOM du client');
dit(grille().indexOf('data-client="oui"') >= 0,
  'il porte la marque de sa famille, qui est une matiere et pas une couleur');
dit(grille().indexOf('data-cal-coche="client:') < 0,
  'ET IL N\'A PAS DE CASE A COCHER : une coche ici ecrirait une fausse tache a cote du vrai rappel',
  'un bouton de coche a repris la pastille');
dit(grille().indexOf('data-cal-client="706"') >= 0,
  'la pastille mene a la fiche du client, qui est le seul endroit ou l\'on note ce qu\'il a dit');
dit(grille().indexOf('deja traite') < 0,
  'un client mis de cote n\'apparait pas : sa fiche fait foi');
dit(w.document.getElementById('calFiltre').innerHTML.indexOf('Mes clients') >= 0,
  'la famille est dans le filtre, elle s\'eteint comme les autres');

console.log('\n== 2. La vue liste ==');
w.BdvCalendrier.allerA('liste');
await new Promise(r => setTimeout(r, 120));
const h = grille();
dit(h.indexOf('data-cal-client="706"') >= 0, 'le rappel mene la aussi a la fiche');
dit(h.indexOf('data-cal-coche="client:') < 0, 'et il n\'y a pas de coche non plus');
dit(h.indexOf('Lui reparler du reassort') >= 0,
  'LE MOTIF SE LIT ICI : c\'est ce qu\'on s\'etait promis, et c\'est la qu\'il y a la place de l\'ecrire');
dit(h.indexOf('Oenophil') >= 0, 'un rappel sans motif s\'affiche quand meme');

console.log('\n== 3. Rien n\'est ecrit ==');
/* Le calendrier ne doit RIEN pousser en base en affichant ces lignes. On rend a
   nouveau, et on regarde la file d'attente des taches : un seul octet dedans
   voudrait dire qu'une fausse tache est partie. */
w.BdvCalendrier.allerA('mois');
await new Promise(r => setTimeout(r, 120));
dit(!w.localStorage.getItem('bdv_taches_attente'),
  'AFFICHER DES RAPPELS CLIENTS N\'ECRIT RIEN DANS LA TABLE DES TACHES',
  w.localStorage.getItem('bdv_taches_attente'));

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
console.log(ko ? '  LE CALENDRIER INVENTE DES TACHES\n' : '  LE CALENDRIER LIT LES RAPPELS, IL NE LES STOCKE PAS\n');
/* SORTIE EXPLICITE, la regle de tous les bancs jsdom : la page pose un minuteur de
   trente minutes sur la lune, qui tiendrait la boucle d'evenements ouverte pour
   toujours, et `npm run verif` s'arreterait la sans un mot. */
process.exit(ko ? 1 : 0);
