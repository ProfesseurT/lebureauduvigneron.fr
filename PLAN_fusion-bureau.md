# Plan : le bureau devient le lieu unique

Decide le 07/09/2026 avec Ted. Forme retenue : **une seule navigation a plat**. Le nom
« tableau de bord » disparait, ses ecrans montent au meme rang que « Ma journee ».
Chantier mene seul, sans y melanger les six autres chantiers de la feuille de route.

## L'etat de depart, mesure

- `src/mon-bureau.njk`, 1 080 lignes, charge DEJA `bdv-base.js`, `bdv-sync.js`,
  `bdv-reglages.js`, `bdv-canaux.js`, `bdv-crm.js`, `bdv-echeances.js` et PapaParse.
  Le moteur est donc deja commun aux deux pages depuis la sortie de `bdv-base.js`.
- `src/outils/dashboard-vigneron.html`, 3 221 lignes, garde encore pour lui seul :
  environ 615 lignes de mise en forme, 2 560 lignes de fabrication d'ecrans, une
  cinquantaine de lignes de structure, plus Chart.js et le lecteur xlsx.
- Collisions de noms de classes entre `src/css/style.css` (604 classes) et le bloc
  `<style>` du tableau de bord (252 classes) : **six seulement**, `btn`, `btn--ghost`,
  `card__title`, `hero`, `mono`, `note`. C'est ce qui rend la fusion realiste.

## Les quatre lots

### Lot 0 : sortir la mise en forme et les ecrans du fichier (rien ne change a l'ecran)

Deplacement pur, meme methode que la sortie de `bdv-base.js` : aucune reecriture, la portee
globale est conservee, l'ordre de chargement est une condition et pas une preference.

1. Le bloc `<style>` part dans `src/css/bdv-ecrans.css`.
2. Le script en ligne (lignes 653 a 3219) part dans `src/js/bdv-ecrans.js`, charge apres
   `bdv-base.js` et sans `defer`.
3. Les six noms de classes communs sont renommes du cote des ecrans, pas du cote du site :
   le site est lu par des lecteurs, les ecrans par un seul vigneron connecte.
4. `scripts/charte.mjs` est adapte dans le meme lot. Sinon `npm run charte:dash` passe sur
   un fichier vide de couleurs et declare tout conforme, panne deja rencontree.

Verification : les cinq controles de `CLAUDE.md` sur un export reel, plus `charte` et
`charte:dash`. Le chiffre d'affaires total doit etre identique au centime.

### Lot 1 : le bureau gagne sa barre de navigation (les ecrans de vente sont encore ailleurs)

Une seule barre, une seule liste : Ma journee, Mon exercice, Mes clients, Mes cuvees,
Chercher, Le compte a rebours, Mes reglages. « Ma journee » est le bureau d'aujourd'hui,
inchange. Les entrees de vente pointent encore vers l'ancienne page.

A trancher avant d'ecrire : barre a gauche, repliable, comme le volet actuel du tableau de
bord, ou barre en haut comme le site. Les ecrans de vente ont besoin de largeur et de
hauteur : un tableau a dix colonnes et deux cents lignes se lit mal sous un bandeau.

Verification : le bureau se rend comme avant, la barre navigue, rien de casse hors ligne.

### Lot 2 : les ecrans de vente s'affichent dans le bureau

1. Le bureau apprend a passer en pleine largeur sur les ecrans qui le demandent.
2. `bdv-ecrans.css` et `bdv-ecrans.js`, Chart.js et le lecteur xlsx ne sont charges qu'au
   premier clic sur un ecran de vente. Ouvrir le bureau pour lire une echeance ne doit pas
   couter le prix de tout l'outil.
3. `/outils/dashboard-vigneron/` devient une redirection vers le bureau, en conservant
   l'ecran demande. Les quatre liens internes de `mon-bureau.njk` et les favoris deja poses
   par un vigneron doivent continuer de tomber au bon endroit, fiche client comprise.

Verification : les cinq controles, plus l'ouverture d'une adresse ancienne de chaque forme.

### Lot 3 : le vocabulaire et le tiroir

1. Tout texte qui dit « le tableau de bord » comme un lieu ou l'on va est reecrit.
2. Le tiroir du bas ne garde que les outils ouverts a tous, pas les ecrans du vigneron.
3. `CLAUDE.md` recoit la regle : **un nouveau chantier entre par la barre de navigation du
   bureau, jamais par une nouvelle page autonome.** C'est la promesse de Ted du 07/09/2026,
   « quand on va attaquer ce plan, on fera pareil ».

## Ce qui reste ouvert

- La place de la barre, a gauche ou en haut. Bloque le lot 1.
- Le nom de l'ecran « Mon annee » : il suit deja l'exercice comptable et s'affiche
  « Mon exercice » quand l'exercice n'est pas l'annee civile. A l'unifier dans la barre.
