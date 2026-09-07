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

### Lot 0 : sortir la mise en forme et les ecrans du fichier — FAIT le 07/09/2026

Deplacement pur, meme methode que la sortie de `bdv-base.js` : aucune reecriture, la portee
globale est conservee, l'ordre de chargement est une condition et pas une preference.

1. Le bloc `<style>` part dans `src/css/bdv-ecrans.css`.
2. Le script en ligne (lignes 653 a 3219) part dans `src/js/bdv-ecrans.js`, charge apres
   `bdv-base.js` et sans `defer`.
3. `scripts/charte.mjs` est adapte dans le meme lot. Sinon `npm run charte:dash` passe sur
   un fichier vide de couleurs et declare tout conforme, panne deja rencontree.

**Ecart assume, decide en cours de route** : le renommage des six noms de classes communs
est REPORTE au lot 2. Il ne sert a rien tant que les deux feuilles ne se croisent pas dans
une meme page, et le faire ici aurait casse la seule garantie forte du lot 0, le
deplacement pur. Les six sont notes en tete de `src/css/bdv-ecrans.css`.

Verifie : reconstitution du fichier d'origine a partir des trois morceaux, identique au
caractere pres, meme empreinte, memes 228 351 octets. `charte` et `charte:dash` CONFORME,
zero echec, 67 tokens et 29 declarations de graisse retrouves. Les cinq controles de
`CLAUDE.md` sur un export reel restent a la charge de Ted, a l'ecran.

### Lot 1 : le bureau gagne sa barre de navigation — FAIT le 07/09/2026

Barre **a gauche, repliable**, comme le volet des ecrans de vente. Un bandeau horizontal
aurait pris de la hauteur en permanence a des tableaux de dix colonnes et deux cents
lignes ; une colonne ne prend de la largeur qu'une fois, et elle se replie.

- `src/js/bdv-nav.js` porte la LISTE UNIQUE des pieces et peint la barre. Une piece
  nouvelle entre la, jamais dans un gabarit.
- `src/mon-bureau.njk` : la coque de l'atelier, barre a gauche et travail a droite.
- `src/css/style.css` : `.bureau-atelier` et `.bureau-nav`.
- La preference de repli partage la cle `bdv_volet_replie` avec le volet des ecrans de
  vente, et le raccourci reste le crochet ouvrant. Replier au bureau replie aussi la-bas :
  pour le vigneron c'est la meme barre.
- Le repli laisse les ICONES, la ou le volet des ecrans de vente tombe a zero. C'est ce qui
  permettra de supprimer son menu de secours « ici » au lot 2.
- Le tiroir du bas est vide et masque : ses deux entrees sont montees dans la barre. Il
  revient au lot 3 avec les outils gratuits.
- `tiroirDash` est remplace par `BdvNav.sansVitisoft()` : sans Vitisoft, les quatre pieces
  de vente restent invisibles. C'est une regle metier, elle a suivi la barre.

Verifie : `npm run banc`, premier test automatise du depot, 26 controles. Plus `charte` et
`charte:dash` CONFORME, et le rendu regarde en 1500 px, replie, et en 390 px.

**Ajout assume** : `jsdom` entre en `devDependencies` pour faire tourner le banc. C'est du
developpement seulement, mais Vercel installe aussi les devDependencies pendant le build :
si le temps de build compte un jour, c'est la premiere chose a sortir.

### Lot 2 : les ecrans de vente s'affichent dans le bureau — FAIT le 07/09/2026

Mene en quatre temps, chacun verifiable seul :

**2a.** Le demarrage des ecrans devient une fonction, `demarrerEcransVente({ecran, client})`,
idempotente. Il vivait dans un ecouteur `DOMContentLoaded`, qui ne se declenche jamais quand
le script est charge au clic : la colonne serait restee vide, sans une erreur pour le dire.

**2b.** La coque des ecrans sort dans `_includes/components/ecrans-vente.njk`, incluse par
les deux pages. Deplacement pur, verifie : coque produite identique au caractere pres,
memes 4 901 octets, memes trente-deux id.

**2c.** Le chargement a la demande, la bascule, et LE SCOPE. Les 373 selecteurs de
`bdv-ecrans.css` sont portes par `.bdv-ventes`, cinq exceptions nommees. **Le renommage des
six classes communes est ANNULE, pas reporte** : ces noms sont un vocabulaire partage avec
`bdv-base.js`, qui genere lui aussi des `.btn` et des `.card__title`. Renommer d'un cote
seulement aurait donne deux noms pour la meme chose selon l'endroit d'affichage. Le scope
suit le motif deja retenu pour `bdv-panneau.css`.

**2d.** `/outils/dashboard-vigneron/` devient une page de redirection qui TRADUIT le
fragment (`#clients`, `#client=JAYAMA`, `#parametres` vers `#base`). En JavaScript et pas
par une regle de serveur : le fragment n'est jamais envoye au serveur. Le volet de gauche,
son menu de secours et le bouton de deconnexion quittent la coque, quatre fonctions et deux
ecouteurs de document avec eux.

Verifie : `npm run banc`, 56 controles. `charte` et `charte:bureau` CONFORME. Rendu regarde
sur un ecran de vente affiche dans le bureau.

**La largeur** : l'atelier garde son gabarit, les ecrans de vente ont donc 1 440 px, plus
172 px quand la barre est repliee. Si Ted trouve ca etroit sur « Mes clients », c'est un
`max-width` a ouvrir sur `.bureau-atelier`, pas une refonte.

### Lot 3 : le vocabulaire et le tiroir

1. Tout texte qui dit « le tableau de bord » comme un lieu ou l'on va est reecrit.
2. Le tiroir du bas ne garde que les outils ouverts a tous, pas les ecrans du vigneron.
3. `CLAUDE.md` recoit la regle : **un nouveau chantier entre par la barre de navigation du
   bureau, jamais par une nouvelle page autonome.** C'est la promesse de Ted du 07/09/2026,
   « quand on va attaquer ce plan, on fera pareil ».

## Ce qui reste ouvert

- **Le texte du panneau de reglages parle encore du tiroir** : « Non » retire le tableau de
  bord du tiroir, dit l'aide sous « Tu utilises Vitisoft ». Le tiroir est vide depuis le lot
  1 et le tableau de bord n'est plus un lieu. A reecrire au lot 3, avec le reste du
  vocabulaire.
- Les icones de la barre sont des emoji : elles gardent leurs couleurs propres sur le fond
  sombre, la ou tout le reste de la barre est en `--gold` et `--on-dark-soft`. Ca vient des
  ecrans de vente, ce n'est pas nouveau, mais ca se voit plus maintenant qu'elles sont sept
  en colonne. A trancher un jour : des emoji, ou un jeu de sept traces monochromes.
