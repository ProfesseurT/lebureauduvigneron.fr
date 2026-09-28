/* ============================================================================
   BANC DES AFFAIRES DANS LE CALENDRIER ET « MES TACHES », lot 37, 28/09/2026
   ============================================================================
   Meme garde que banc-calclients.mjs, pour la meme raison :

     CES DEUX PIECES LISENT LES AFFAIRES, ELLES NE LES STOCKENT PAS, ET ELLES NE
     LES COCHENT PAS.

   La verite d'une affaire vit dans `affaires`, ecrite par bdv-affaires.js. Une
   case a cocher ici passerait par la table des taches et fabriquerait une fausse
   tache « affaire:... » a cote de la vraie affaire : deux endroits qui repondent
   « ou en est la Cave du Quai », et ils se contrediraient au premier clic.

   Il garde aussi trois regles venues du vigneron empathique :
   - a date egale, un client qui attend passe AVANT une affaire a gagner ;
   - « affaire » se lit en toutes lettres, pas seulement par un signe ;
   - une affaire n'a pas de punaise de tache : elle a la sienne.
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

/* Le meme decor que banc-calclients : une obligation pour que la grille ne soit
   jamais vide, et des dates a deux jours pour tomber dans le mois affiche. */
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
                monBureau: () => 'b0000000-0000-0000-0000-000000000001',
                refusDeProprietaire: () => false,
                api: () => Promise.resolve([]) };
/* Un rappel client ET une affaire le MEME jour : c'est la que l'ordre se juge. */
w.BdvCrm = { miroir: () => ({
  noms: { '706': 'VINOBILIS SRL' },
  suivi: [{ id: '706', rappel: jour(2), titre: 'Lui reparler du reassort', statut: 'relance' }]
}) };
let ouvert = 0;
w.BdvNav = { afficher: (id) => { if (id === 'affaires') ouvert++; } };

for (const f of ['bdv-echeances.js', 'bdv-almanach.js', 'bdv-taches.js', 'bdv-affaires-jour.js', 'bdv-calendrier.js']) {
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(JS, f), 'utf8');
  try { w.document.body.appendChild(s); }
  catch (e) { console.log('  ECHEC : ' + f + ' leve -> ' + e.message); process.exit(1); }
}

console.log('\n== 0. La famille ==');
const fams = () => w.BdvEcheances.familles.filter(f => f.cle === 'affaires').length;
dit(fams() === 1, '« Mes affaires » rejoint la liste unique des familles');
/* Recharger le fichier ne doit pas la doubler : le filtre montrerait deux fois la
   meme etiquette, et l'une des deux ne s'eteindrait jamais. */
const s2 = w.document.createElement('script');
s2.textContent = fs.readFileSync(path.join(JS, 'bdv-affaires-jour.js'), 'utf8');
w.document.body.appendChild(s2);
dit(fams() === 1, 'et une seule fois, meme si le fichier est relu');
const src = fs.readFileSync(path.join(JS, 'bdv-echeances.js'), 'utf8');
dit(src.indexOf("'affaires'") < 0,
  'bdv-echeances.js n\'est PAS touche : il est joint a agenda-ics, et l\'abonnement .ics n\'emporte pas les affaires');

/* La piece pose ce qu'elle a lu : c'est le chemin reel, pas un faux module. */
w.BdvAffairesJour.poser([
  { affaire_id: 'a1', piste_id: 'p1', titre: 'Cave du Quai', rappel: jour(2),
    rappel_titre: 'Passer deposer deux bouteilles', issue: 'en_cours' },
  { affaire_id: 'a2', piste_id: 'p2', titre: 'Sans date', rappel: null, issue: 'en_cours' },
  { affaire_id: 'a3', piste_id: 'p3', titre: 'Gagnee', rappel: jour(2), issue: 'gagnee' }
], { p1: { nom: 'Cave du Quai' }, p2: { nom: 'Bistrot sans date' }, p3: { nom: 'Deja gagnee' } });

await new Promise(r => setTimeout(r, 60));
w.BdvCalendrier.ouvrir();
await new Promise(r => setTimeout(r, 120));
const grille = () => w.document.getElementById('calCorps').innerHTML;

console.log('\n== 1. La grille du mois ==');
dit(grille().indexOf('Cave du Quai') >= 0, 'l\'affaire est dans la grille, sous le NOM de la piste');
dit(grille().indexOf('data-affaire="oui"') >= 0, 'elle porte sa marque, un signe et pas une couleur');
dit(grille().indexOf('data-cal-coche="affaire:') < 0 && grille().indexOf('data-cal-tache="affaire:') < 0,
  'ET ELLE N\'A PAS DE CASE A COCHER : une coche ecrirait une fausse tache a cote de la vraie affaire');
dit(grille().indexOf('data-cal-affaire="a1"') >= 0, 'la pastille mene a « Mes affaires »');
dit(grille().indexOf('Bistrot sans date') < 0, 'une affaire sans rappel n\'a pas de jour, elle n\'est pas dans la grille');
dit(grille().indexOf('Deja gagnee') < 0, 'une affaire close n\'y est pas');
dit(w.document.getElementById('calFiltre').innerHTML.indexOf('Mes affaires') >= 0,
  'la famille est dans le filtre, elle s\'eteint comme les autres');

const bouton = w.document.querySelector('[data-cal-affaire="a1"]');
if (bouton) bouton.click();
dit(ouvert === 1, 'un clic ouvre la piece « Mes affaires »', ouvert);

console.log('\n== 2. La vue liste ==');
w.BdvCalendrier.allerA('liste');
await new Promise(r => setTimeout(r, 120));
const h = grille();
dit(h.indexOf('Passer deposer deux bouteilles') >= 0, 'LE MOTIF DU RAPPEL SE LIT ICI');
dit(h.indexOf('Affaire à relancer') >= 0, '« affaire » en toutes lettres, pas seulement par le fanion');
dit(h.indexOf('data-cal-coche="affaire:') < 0, 'toujours pas de coche');
dit(h.indexOf('data-cal-ouvrir-ech="affaire:') < 0, 'et son titre n\'ouvre pas la modale des taches');

console.log('\n== 3. « Mes taches » ==');
const t = w.BdvTaches.toutes();
const ia = t.findIndex(x => x.source === 'affaire');
const ic = t.findIndex(x => x.source === 'client');
dit(ia >= 0, 'l\'affaire datee est dans la liste de « Mes taches »');
dit(t.filter(x => x.source === 'affaire').length === 1, 'et elle seule : ni la sans-date, ni la gagnee');
dit(ic >= 0 && ic < ia, 'A DATE EGALE, LE CLIENT QUI ATTEND PASSE AVANT L\'AFFAIRE', ic + ' / ' + ia);
dit(w.BdvTaches.modale('affaire:a1') === false, 'elle n\'ouvre pas la modale d\'une tache : elle avance dans sa piece');
const pun = w.BdvTaches.punaises().map(p => p.cle).join(',');
dit(pun.indexOf('affaire:') < 0, 'PAS DE PUNAISE DE TACHE pour une affaire : elle a la sienne', pun);
w.BdvTaches.basculerFamille('affaires');
dit(w.BdvTaches.toutes().filter(x => x.source === 'affaire').length === 0, 'la famille eteinte, l\'affaire sort de la liste');
w.BdvTaches.basculerFamille('affaires');

console.log('\n== 4. Rien n\'est ecrit ==');
w.BdvCalendrier.allerA('mois');
await new Promise(r => setTimeout(r, 120));
dit(!w.localStorage.getItem('bdv_taches_attente'),
  'AFFICHER DES AFFAIRES N\'ECRIT RIEN DANS LA TABLE DES TACHES',
  w.localStorage.getItem('bdv_taches_attente'));

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
console.log(ko ? '  LES AFFAIRES FABRIQUENT DES TACHES\n' : '  LES AFFAIRES SE LISENT, ELLES NE SE COCHENT PAS\n');
process.exit(ko ? 1 : 0);
