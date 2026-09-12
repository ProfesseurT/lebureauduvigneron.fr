/* ==========================================================================
   BANC DE LA BOITE A OUTILS, /outils/ — 12/09/2026
   ==========================================================================
   Cette page dit au visiteur, pour chaque outil, CE QU'IL COUTE et OU IL
   L'EMMENE. C'est sa seule promesse depuis qu'elle ne s'appelle plus « les
   outils gratuits », et une promesse tenue par la seule bonne volonte du
   prochain qui ajoute une carte n'est pas une promesse.

   IL LIT LA PAGE CONSTRUITE, `_site/outils/index.html`, et pas le gabarit :
   les donnees structurees passent par Nunjucks, et lire le gabarit c'est ne
   rien lire puis l'annoncer conforme.

   CE QU'IL GARDE, ET POURQUOI CHAQUE POINT A COUTE QUELQUE CHOSE :

   1. Chaque carte porte une etiquette de prix. Sans elle, la page redevient
      une grille uniforme pour des objets qui ne coutent pas la meme chose.
   2. Le nom de chaque carte est un TITRE qui porte le lien. Quand la carte
      entiere etait une balise `a`, son nom accessible faisait 385 signes.
   3. Les cartes et les donnees structurees disent la MEME chose. Deux listes
      dans un meme fichier, c'est une occasion d'en oublier une.
   4. Tout lien sortant annonce qu'il sort, a l'oeil ET a l'oreille.
   5. L'apercu de la vedette part CACHE. Sans JavaScript il affichait un titre
      et 276 px de vide.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, ko = 0;
const dit = (v, quoi, detail) => {
  if (v) { ok++; console.log('  OK   ' + quoi); }
  else { ko++; console.log('  ECHEC ' + quoi + (detail ? '\n        ' + detail : '')); }
};
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');

/* Un controle qui ne peut pas s'executer doit CRIER, jamais se taire. */
if (!fs.existsSync(path.join(RACINE, '_site/outils/index.html'))) {
  console.log('\n  ECHEC la page construite manque : lance `npm run build` avant ce banc.\n');
  process.exit(1);
}
const doc = new JSDOM(lire('_site/outils/index.html')).window.document;
const cartes = [...doc.querySelectorAll('.boite-vedette, .boite-carte')];

console.log('\n== 1. Il y a bien une boite, et elle n\'est pas vide ==');
dit(cartes.length >= 2, cartes.length + ' carte(s) trouvee(s)');
dit(!doc.querySelector('.bureau-outil, .bureau-outils'),
    'les anciennes classes .bureau-outil ont disparu',
    'Elles donnaient la meme carte a des objets de natures differentes. Leur CSS est parti avec elles : les remettre rendrait des cartes sans style.');

console.log('\n== 2. Chaque carte dit son prix et porte un titre qui est le lien ==');
for (const c of cartes) {
  const prix = c.querySelector('.boite-prix');
  const titre = c.querySelector('h2');
  const lien = titre && titre.querySelector('a[href]');
  const nom = titre ? titre.textContent.replace(/\s+/g, ' ').trim() : '(sans titre)';
  dit(!!prix && !!prix.textContent.trim(), 'prix affiche  : ' + nom,
      'Sans .boite-prix, le visiteur ne sait pas si l outil lui demande un compte, de l argent, ou rien.');
  dit(!!titre && !!lien, 'titre cliquable : ' + nom,
      'Le nom doit etre un h2 qui contient le lien. La carte reste cliquable par le calque ::after pose sur ce lien.');
  /* LE CONTROLE QUI COMPTE : la carte entiere ne doit PAS etre un lien. */
  dit(c.tagName.toLowerCase() !== 'a', 'la carte n est pas elle-meme un lien : ' + nom,
      'Mesure du 12/09/2026 : le nom accessible du lien montait alors a 385 signes, etiquette de prix et apercu compris.');
  if (lien) {
    const nomAccessible = (lien.getAttribute('aria-label') || lien.textContent).replace(/\s+/g, ' ').trim();
    dit(nomAccessible.length <= 80, 'nom accessible court (' + nomAccessible.length + ' signes) : ' + nom,
        'Au-dela, un lecteur d ecran annonce un paragraphe en guise de libelle de lien.');
  }
}

console.log('\n== 3. Les liens sortants annoncent qu\'ils sortent ==');
for (const a of doc.querySelectorAll('.boite-carte h2 a[href^="http"]')) {
  const cible = a.getAttribute('href');
  dit(a.getAttribute('target') === '_blank', 'ouvre une nouvelle fenetre : ' + cible);
  dit((a.getAttribute('rel') || '').includes('noopener'), 'porte rel=noopener : ' + cible,
      'Sans lui, la page ouverte garde une poignee sur celle-ci par window.opener.');
  /* A L'OEIL LA FLECHE OBLIQUE, A L'OREILLE CETTE MENTION. Une fleche ne s annonce pas. */
  dit(!!a.querySelector('.hors-ecran'), 'le dit aussi dans le nom du lien : ' + cible,
      'La classe .hors-ecran met la mention « nouvelle fenetre » dans le nom accessible sans rien afficher.');
  dit(a.closest('.boite-carte').classList.contains('boite-carte--tiers'),
      'la carte est marquee --tiers (fleche oblique) : ' + cible);
}

console.log('\n== 4. Les cartes et les donnees structurees disent la meme chose ==');
const blocs = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => {
  try { return JSON.parse(s.textContent); } catch (e) { return null; }
});
dit(blocs.every(Boolean), 'tous les blocs ld+json sont du JSON valide');
const graphe = blocs.filter(Boolean).flatMap(b => b['@graph'] || [b]);
const liste = graphe.find(n => n['@type'] === 'ItemList');
dit(!!liste, 'la page declare une ItemList de ses outils',
    'Sans elle, un moteur voit quatre liens et aucune liste.');
if (liste) {
  const items = (liste.itemListElement || []).map(e => e.item || {});
  dit(items.length === cartes.length,
      'autant d entrees (' + items.length + ') que de cartes (' + cartes.length + ')',
      'Un outil ajoute a la page sans etre ajoute a la liste, c est une page qui ment aux moteurs sans que personne le voie.');
  dit(Number(liste.numberOfItems) === items.length,
      'numberOfItems (' + liste.numberOfItems + ') colle au nombre d entrees');
  for (const c of cartes) {
    const a = c.querySelector('h2 a');
    if (!a) continue;
    const nom = a.textContent.replace(/\s+/g, ' ').replace(/\s*—.*$/, '').trim();
    const href = a.getAttribute('href');
    const e = items.find(i => (i.name || '').trim() === nom);
    dit(!!e, 'la liste connait « ' + nom + ' »');
    if (e) {
      const memeCible = href.startsWith('http')
        ? e.url === href
        : (e.url || '').endsWith(href);
      dit(memeCible, 'la meme adresse pour « ' + nom + ' »', 'carte : ' + href + '   liste : ' + e.url);
    }
  }
  /* UN PRIX QU ON NE CONNAIT PAS NE SE DECLARE PAS. Vitisoft est sur devis :
     lui coller price 0 serait faux, et c est le genre de balisage qui fait
     sauter une page des resultats. */
  const surDevis = items.find(i => (i.name || '') === 'Vitisoft');
  dit(surDevis && !surDevis.offers, 'aucun prix declare pour l outil sur devis',
      'price: 0 sur un logiciel sur devis est un balisage faux.');
  const gratuits = items.filter(i => (i.name || '') !== 'Vitisoft');
  dit(gratuits.every(i => i.offers && String(i.offers.price) === '0'),
      'les outils gratuits declarent bien un prix de 0');
}
const fil = graphe.find(n => n['@type'] === 'BreadcrumbList');
dit(!!fil, 'la page declare son fil d Ariane');

console.log('\n== 5. L\'apercu de la vedette part cache ==');
const cadre = doc.getElementById('boiteApercuCadre');
dit(!!cadre, 'le cadre d apercu existe');
dit(cadre && cadre.hasAttribute('hidden'),
    'il porte `hidden` dans le HTML construit',
    'Sans JavaScript il affichait son titre et 276 px de vide. C est le script qui le leve, et seulement s il a des lignes.');
dit(cadre && cadre.querySelectorAll('.boite-apercu__ligne').length === 0,
    'et il est vide a la construction (c est le script qui le remplit)');

console.log('\n== 6. Le bandeau est cale comme le contenu ==');
const bandeau = doc.querySelector('.about-hero > div');
dit(bandeau && bandeau.classList.contains('container--wide'),
    'le bandeau prend container--wide, comme les cartes',
    'Avec `container` il se calait sur 760 px quand les cartes tenaient sur 1100 : le titre demarrait 170 px a droite du bord des cartes.');
dit(doc.querySelectorAll('.about-hero [style]').length === 0,
    'et il ne porte plus de style en ligne',
    'La couleur de .section__label sur fond sombre est une regle de la feuille depuis le 12/09/2026, plus une recopie par page.');

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LA BOITE A OUTILS NE TIENT PAS SA PROMESSE\n'); process.exit(1); }
console.log('  CHAQUE OUTIL DIT CE QU\'IL COUTE ET OU IL EMMENE\n');
process.exit(0);
