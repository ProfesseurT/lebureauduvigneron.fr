# Consignes projet lebureauduvigneron.fr

Site Eleventy deploye sur Vercel au push sur `main`.

## LE BUREAU EST LE LIEU UNIQUE

Le tableau de bord des ventes a longtemps ete une page a part,
`src/outils/dashboard-vigneron.html`, qui portait l'essentiel du travail a elle seule. Ce
n'est plus vrai depuis la fusion du 07/09/2026. Cette page est aujourd'hui une simple
redirection, et ses ecrans sont des PIECES du bureau, `/mon-bureau/`, dans une seule barre
de navigation a plat.

**LA REGLE, demandee par Ted le 07/09/2026 : un nouveau chantier entre par la barre du
bureau, jamais par une nouvelle page autonome.** Elle vaut pour tout ce qui est destine au
vigneron connecte : un agenda, un composeur de signature, un ecran d'administration. Les
outils ouverts a toute la filiere, eux, gardent leur page sous `/outils/` : ils sont lus par
des gens qui n'ont pas de compte, et ils n'ont rien a faire dans le bureau de quelqu'un.

### L'EXCEPTION DU CALENDRIER, 08/09/2026 : un objet, DEUX endroits

Le calendrier reglementaire est le premier objet du site a vivre aux deux endroits a la
fois, et ce n'est pas un oubli de rangement.

- `/outils/echeances/` reste la PAGE PUBLIQUE, en vue liste, gratuite, sans compte,
  referencee. C'est la porte d'entree, et la premiere raison pour un inconnu de venir.
- `/mon-bureau/#calendrier` est la PIECE, avec ses trois vues, la coche des obligations,
  et bientot les occurrences que le vigneron cree lui-meme et la synchro de son agenda.
  C'est la difference qui justifie de creer un compte.

Le calcul est commun, `bdv-echeances.js`, et il n'y en aura jamais deux. Ce qui separe les
deux endroits, c'est ce qu'on peut y FAIRE, jamais ce qu'ils calculent.

Avant ce jour-la, l'intercalaire « Le calendrier » de la barre etait le SEUL a ejecter hors
du bureau, vers un ecran sans intercalaires. C'est le defaut que Ted a signale en ouvrant le
chantier. Ne pas le retablir en croyant appliquer la regle du dessus.

Concretement, une piece nouvelle s'ajoute dans `PIECES`, en tete de `src/js/bdv-nav.js`, et
son ecran dans la coque `src/_includes/components/ecrans-vente.njk`. Les identifiants
doivent etre les memes que ceux de `NAV` dans `src/js/bdv-ecrans.js` : rien ne le garantit
sauf `npm run banc`, qui compare les deux listes et echoue si elles divergent.

### LA PAGE DES OUTILS DIT LE PRIX AVANT LE NOM, 12/09/2026

`/outils/` n'est plus « les outils gratuits », c'est **les outils viticoles** : arbitrage de
Ted le jour ou Vitisoft, qui est payant, y est entre. La gratuite ne se promet donc plus en
bloc dans le titre, **elle se dit outil par outil** et c'est ce qui rend la page honnete.

**Tout outil ajoute a cette page porte une etiquette `.boite-prix`, posee en PREMIER enfant
de sa carte, avant le nom.** Elle dit deux choses et jamais une seule : ce que l'outil coute
(gratuit, compte requis, sur devis) et ou il emmene (ici, ou sur un autre domaine). Un outil
sans etiquette casse la seule promesse que la page tient encore.

Trois variantes existent, et il n'en faut pas une quatrieme sans raison mesuree :
`--libre` (papier profond), `--compte` (bordeaux) et `--devis`.

**`--devis` EST LE DRAPEAU DE VITISOFT, PAS L'ETIQUETTE DU PAYANT.** C'est le seul endroit
du site public ou `--viti-orange` ait le droit d'exister, et `tokens.css` le dit deja : « sauf
pour signaler explicitement un lien vers Vitisoft ». Mesure du 12/09/2026 : `#FF9F00` vaut
**1,79:1 sur `--paper-light`**, il ne tient meme pas les 3:1 d'un objet graphique. Donc jamais
de filet orange, jamais de texte orange : un APLAT sous `--ink-deep`, ou il vaut 8,82:1. Le
jour ou un deuxieme outil payant arrive, il prend une etiquette neutre. Peindre un prix avec
la couleur d'une marque, c'est apprendre au visiteur que orange veut dire cher.

Enfin, **toute carte qui sort du site porte `.boite-carte--tiers`**, qui remplace la fleche
droite par une fleche oblique, ET une mention `.hors-ecran` dans le nom du lien. Une fleche
ne s'annonce pas : `target="_blank"` ne se voit pas avant le clic pour qui regarde, et ne
s'entend pas du tout pour qui ecoute.

**UNE CARTE N'EST JAMAIS UNE BALISE `a`.** Le nom est un `h2` qui porte le lien, et un calque
`::after` en `z-index: 1` rend la carte cliquable en entier. Mesure du 12/09/2026 : avec la
carte entiere en lien, son nom accessible faisait 325 a 385 signes : un lecteur d'ecran
annoncait l'etiquette de prix, le descriptif, les puces et les trois echeances comme un seul
libelle. Le `z-index` n'est pas decoratif : sans lui, les enfants qui SUIVENT le titre dans
le HTML se peignent par-dessus le calque et cessent d'etre cliquables.

`npm run banc:outils` garde tout cela, sur la page CONSTRUITE, et compare en plus les cartes
aux donnees structurees de la page : un outil ajoute d'un cote sans l'autre fait echouer la
construction.

### LE PANNEAU SE CONSTRUIT AVANT LE MOTEUR, 08/09/2026

Quatre defauts signales par Ted le meme jour, apres avoir vide sa base puis decoche et
recoche Vitisoft. Ils n'avaient aucune cause commune, et le plus gros n'avait rien a voir
avec Vitisoft : **« Ma base » etait vide a CHAQUE ouverture des reglages depuis le bureau,
depuis la fusion du 07/09.**

`monterMoteur()` n'etait appele que depuis `construire()`. Au tableau de bord ca suffit, le
moteur part avec la page. **Au bureau c'est l'inverse** : le panneau s'ouvre tout de suite,
sans moteur, et le moteur arrive apres. Personne ne rangeait plus rien.

Le defaut est invisible a la lecture, et c'est ce qui le rend cher : `renderBase()` trouve
bien son `p-base`, qui existe dans la coque des ecrans de vente, et il ecrit dedans. Sauf
que ce div est reste `hidden`, dans `#bureauVentes` lui-meme masque. Ecran vide, aucune
erreur. **Le banc ne le voyait pas parce qu'il chargeait le moteur AVANT le panneau,
l'ordre du tableau de bord et pas celui du bureau.** La lecon est plus large que la
reparation : **un banc doit reproduire l'ORDRE D'ARRIVEE de la vraie page, pas seulement
ses pieces.** Section 3 de `banc-reglages.mjs`.

`monterMoteur()` est donc appele aussi en tete de `rafraichirMoteur()`. C'est sans effet la
deuxieme fois : `loger()` retrouve le div et le repose au meme endroit.

### Un drapeau qui ne sait que monter est un drapeau qu'on oublie de baisser

`PAS_VITISOFT` montait a `true` et n'en redescendait jamais. Recocher « oui » laissait donc
« cet outil ne lira pas tes fichiers » par-dessus la zone de depot jusqu'au rechargement.
D'ou `adopterVitisoft()` dans `bdv-base.js`, sur le modele exact de `adopterObjectif` : le
panneau a la reponse, le moteur l'adopte sans rien renvoyer en base. Les DEUX appelants
(`gateVitisoft()` et la lecture de profil de `bdv-ecrans.js`) passent par elle.

### Ce que le moteur dit a l'ecran doit passer DEVANT la modale

Deux causes cumulees, et la premiere cachait la seconde.

1. `bdv-ecrans.css` n'etait chargee qu'avec les ecrans de vente. Or elle habille les deux
   seules choses que le moteur dise a l'ecran, `.status` et `#busyov`, et le moteur peut
   parler sans qu'aucun ecran de vente n'ait ete ouvert : un import lance depuis le panneau
   de reglages. Sans feuille, le bandeau tombait **nu dans le flux de la page**, au bout du
   `<body>`, donc derriere la modale. La feuille est maintenant en tete de `MOTEUR` dans
   `bdv-nav.js`. Le reste de la feuille est inerte : tout est porte par `.bdv-ventes`.
2. Meme habille, il etait dessous. **L'echelle des couches est desormais complete et
   ordonnee** : `--z-modale: 400` < `--z-voile: 1000` < `--z-busy: 1050` < `--z-statut:
   1100`. Avant, le statut etait a 900 et le voile d'attente a 1000, a EGALITE avec le voile
   du panneau, donc tranche par l'ordre du document, ou le panneau gagne. Le panneau lit le
   jeton et n'ecrit plus 1000 en dur : **une echelle dont un barreau est ecrit en dur
   ailleurs est une echelle qu'on casse sans le voir.**

## Ou vivent les choses

Plus rien n'est autonome, et chercher une fonction dans une page avant de chercher dans
`src/js/` fait perdre du temps.

- `bdv-base.js` : le moteur. Base IndexedDB, empreintes de ligne, import, exercice comptable.
  **N'est PLUS charge a l'ouverture du bureau** depuis le 07/09/2026 : il pesait 83 ko
  bloquants pour une page qui ne s'en sert pas. Charge par `bdv-nav.js` sur l'un des deux
  gestes qui en ont besoin, ouvrir un ecran de vente ou ouvrir le panneau de reglages,
  toujours precede de PapaParse et de `bdv-sync.js`.
- `bdv-ecrans.js` : les cinq ecrans de vente. Charge au PREMIER CLIC sur une piece de vente,
  jamais a l'ouverture du bureau, et toujours APRES le moteur : il lit ses variables des son
  analyse. `npm run banc` verifie cet ordre, qui est une condition et pas une preference.
- `bdv-nav.js` : la liste unique des pieces du bureau, la barre, le chargement a la demande,
  et le SEUL point d'entree des reglages, `BdvNav.ouvrirReglages()`. Les trois boutons qui
  ouvrent le panneau passent par lui : sans ca, celui qui l'appelle sans demander le moteur
  ouvre un panneau dont « Ma base » et « Le classement » restent vides, sans erreur.
- `bdv-calendrier.js` : la piece « Le calendrier », ses trois vues, son filtre par famille et
  sa bascule. Chargee au PREMIER CLIC sur la piece, avec `bdv-calendrier.css` et
  `bdv-almanach.js`, et rien d'autre : elle ne demande ni le moteur, ni Chart.js, ni le lecteur
  xlsx, parce qu'elle ne lit aucune ligne de vente.
  **Elle ne calcule aucune date et n'ecrit dans aucune table.** Les recurrences sont dans
  `bdv-echeances.js`, la lune et les feries dans `bdv-almanach.js`, la coche passe par
  `BdvTaches.basculerOccurrence()`.
- `bdv-almanach.js` : la lune, les saisons et les jours feries, CALCULES et jamais listes.
  Meeus 49 pour les phases, Meeus 27 pour les saisons, l'algorithme gregorien anonyme pour
  Paques. Valide contre les 50 phases de 2026 de la base Notion : 50 sur 50 au bon jour, et
  la cinquantieme a donne raison au calcul contre la donnee (voir plus bas). Chargé AVANT
  `bdv-calendrier.js`, c'est une condition et pas une preference : la piece l'appelle des son
  premier rendu. `npm run banc` verifie cet ordre.
- `bdv-compte.js` la porte de compte, `bdv-reglages.js` le panneau de reglages partage, plus
  `bdv-sync.js`, `bdv-crm.js`, `bdv-signets.js`, `bdv-echeances.js`, `bdv-canaux.js`.

SEPT feuilles de style depuis le 21/09/2026, dont trois ne sont dans AUCUN HTML.

**Liees par le layout, pour tout le monde :** `style.css`, la feuille PUBLIQUE, et elle seule
depuis la scission du 21/09/2026.

**Liees par le layout, pour /mon-bureau/ SEULEMENT**, sous le drapeau de front matter
`theme_bureau`, et dans cet ordre, qui est une condition et pas une preference :
`bdv-theme.css` (les jetons des deux themes, AVANT `style.css` pour ne pas clignoter), puis
`style.css`, puis **`bdv-poste.css`** (la moitie bureau de l'ancienne `style.css`), puis
`bdv-bureau.css` (le dessin de la coque, qui recouvre le papier restant).

**DEPUIS LE 21/09/2026, `bdv-poste.css` PORTE SES PROPRES VALEURS DE THEME** et n'attend plus
qu'on la recouvre : elle n'est chargee que par le bureau, donc on y ecrit les jetons `--bdv-*` a
la source. `bdv-bureau.css` ne recouvre plus que ce qui reste dans `style.css`, plus la section
16 par-dessus `bdv-calendrier.css` pour une raison de chargement. La regle qui decide est
« UNE FEUILLE QUE SEUL LE BUREAU CHARGE SE REPEINT EN PLACE », plus bas dans ce fichier.

**Posees par du JavaScript, donc dans aucun HTML :** `bdv-ecrans.css` (par `bdv-nav.js`, portee
par `.bdv-ventes`), `bdv-panneau.css` (par `bdv-reglages.js`, portee par `.bdvr-panneau`),
`bdv-calendrier.css` (par `bdv-nav.js` au premier clic sur le calendrier, portee par `.bdv-cal`).

Les feuilles du bureau sont nommees A LA MAIN dans `scripts/charte.mjs`, y compris celles qui
portent deja un `<link>` : une feuille oubliee la echappe entierement au controle, rien ne le
signale, et le jour ou son `<link>` demenage elle sort du perimetre en silence.

## LE PANNEAU EST UNE PILE DE TRAVAIL, PAS UN TABLEAU DE BORD, 10/09/2026

Le panneau de liege de « Ma journee » a ete refait ce jour-la parce qu'il repondait six fois a
« combien » et jamais a « et maintenant, quoi ». **Une punaise porte UNE chose a faire, dans
l'ordre ou elle presse, avec les gestes qui la font disparaitre.** Un compteur qui ne se traduit
pas en geste n'a pas droit a une punaise : il va dans l'etiquette de la zone, `#panneauNote`.

Trois consequences a ne pas defaire :

1. **Le retard passe avant tout**, y compris avant une obligation legale qui tombe dans trois
   jours. Le filtre des rappels etait `rappel > aujourd'hui`, strictement l'avenir : une promesse
   pas tenue n'apparaissait NULLE PART. C'est le premier controle de la section 5 de
   `banc-journee.mjs`, et il doit rester le premier.
2. **Cinq punaises au plus.** Mesure sur 1200 px : a six, la sixieme part seule sur une deuxieme
   rangee. Ce qui ne tient pas ici n'est pas perdu, il est dans Mes taches ou au sous-main.
3. **Pas de troisieme couleur de punaise.** L'etat « fait » a du recevoir un FOND parce que sa
   punaise verte tombait a 2,25:1 sur le liege ; une teinte de plus rejouerait ce defaut. Ce qui
   presse le dit en toutes lettres dans le chiffre du post-it.

Et la regle qui tenait deja tient toujours : **aucun chiffre de VENTE ici.** L'ardoise mesure le
domaine, le panneau mesure le vigneron. C'est la seule chose qui autorise deux tableaux de
chiffres sur la meme page.

### DEUX NATURES DE PUNAISE, ET IL NE FAUT PAS LES REMELANGER, 10/09/2026

Ted, devant sa vraie page : « les gros mots AUJOURD'HUI et DEMAIN en gros, ca perd le
message. » Le grand emplacement du post-it, `.postit__v`, est dessine pour un CHIFFRE.

1. **La punaise de COMPTE** porte son chiffre en tete et un libelle qui dit de quoi on
   compte : « 3 / rappels en retard ».
2. **La punaise de CHOSE A FAIRE** porte son TITRE en tete, et l'echeance descend en
   `.postit__tampon`, une etiquette en capitales au-dessus. Elle n'a pas de libelle : le
   titre le remplace.

**A un seul, on nomme ; a plusieurs, on compte.** Un gros « 1 » n'apprend rien ; le nom du
client dit tout, et c'est lui qu'on appelle.

**La taille de la ligne de tete suit la LONGUEUR, pas la nature.** Trois paliers, mesures sur
un post-it de 160 px : 2 rem jusqu'a quatre signes (un chiffre), 1,4 rem jusqu'a seize, puis
`--t-lead` au-dela, sinon « Commander des bouchons » prend trois lignes. Un chiffre est court,
un titre ne l'est pas, et c'est la seule chose que le dessin ait besoin de savoir.

**Le lien vit sur la LIGNE DE TETE**, le libelle s'il existe et la valeur sinon. Jamais sur un
chiffre nu, qu'on ne songerait pas a cliquer.

### L'ECRAN DIT « ACTION », LE CODE DIT « GESTE », 10/09/2026

Demande de Ted : « on change gestes par actions et faits par accomplis ». Seuls les mots
d'ECRAN ont change - l'etiquette du panneau, le bilan, l'en-tete de colonne du sous-main.
`BdvCrm.GESTES`, `.postit__gestes` et `data-punaise` gardent leur nom : un renommage
traversant trois fichiers pour un mot d'ecran n'apporte qu'un risque, meme regle que `date`
dans `bdv-echeances.js`. **Le savoir en relisant, et ne pas "corriger" l'un vers l'autre.**

Le bouton « Fait » n'est PAS devenu « Accompli » : ce mot se lit comme un etat, pas comme un
ordre. Un compte se dit « 9 accomplis », un bouton se dit « Fait ».

### Un post-it n'est plus un `<a>`, et il ne doit plus le redevenir

Il porte des boutons de geste, et un element interactif dans un element interactif est interdit
par le HTML, le sous-main avait deja paye ce defaut avec ses trois boutons dans un `<button>`.
C'est le LIBELLE qui porte le lien, et son `::after` s'etend sur tout le papier ; les boutons
repassent au-dessus par leur `z-index`. Une seule cible pour la souris, deux arrets nets pour le
clavier. `banc-journee.mjs` refuse desormais tout `a button` dans le panneau.

### Un nombre negatif dans une phrase de futur, 10/09/2026

« Une echeance dans **-26 jour** », vu par Ted sur sa vraie page. Le test etait
`ECHEANCE.jours <= 7`, qui laisse passer les negatifs, et le pluriel se calculait sur
`jours > 1`, d'ou le singulier absurde.

**La lecon n'est pas le signe, c'est d'ou il vient.** `laPlusPressante()` garde
`jours >= 0 OU enCours` : un negatif ne passe QUE pour un evenement en cours, pas pour un
retard. La correction evidente, « en retard de 26 jours », aurait remplace une phrase fausse
par une autre. **Avant de corriger un affichage, remonter a la fonction qui a produit le
nombre** : elle dit ce que le nombre veut dire, l'ecran ne fait que le supposer.

Et le vocabulaire des echeances vient de `phrase()` dans `bdv-echeances.js`, jamais d'un
deuxieme jeu de mots ecrit dans l'ecran qui l'affiche. Sinon la meme obligation se dit de
deux facons a deux endroits de la meme page.

## LA REGLE DU PLATEAU, ET CE QU'ELLE GARDE ENCORE, 21/09/2026

**CETTE SECTION A CHANGE DE PERIMETRE LE 21/09/2026, ET IL FAUT LIRE LES DEUX MOITIES.**
Le mobilier qu'elle decrit n'existe plus dans le bureau connecte. Il existe toujours, a
l'identique, sur la page d'accueil du site public. La regle n'est donc ni morte ni
generale : elle vaut pour un endroit et pas pour l'autre, et c'est cet endroit-la qu'il
faut savoir avant de la citer.

### CE QUI RESTE VRAI : LA DEMONSTRATION DE LA PAGE D'ACCUEIL

Depuis la refonte du 07/09/2026, `src/_includes/components/demo-pinboard.njk` pose
plusieurs matieres sur un meme plateau : du liege pour le panneau, du papier continu a
picots pour le sous-main, un bloc a effeuiller pour le calendrier, de l'ardoise encadree de
bois pour les chiffres, du carton kraft pour les intercalaires de la barre, une pile, des
dos de classeur et une enveloppe pour les trois zones du bas. Elle montre les VRAIS
composants du bureau, avec leurs vraies classes, et ce sont les regles de
`src/css/style.css` qui les peignent.

**Ce qui empeche ce mobilier de faire collage de brocante n'est pas le gout, c'est une regle
en trois lignes, ecrite en tete de la section MATIERES de `src/css/style.css` :**

1. Un seul plateau, `--paper`, et une seule lumiere, venue du haut a gauche.
2. Deux ombres seulement. `--ombre-carte` pour un objet pose, qui a une epaisseur.
   `--ombre-dure` pour la signature du site, dure et sans flou. **Jamais une troisieme.**
3. Toute matiere ajoutee prend ses couleurs dans les jetons de matiere existants, et si elle
   en demande un nouveau, ce jeton nomme la MATIERE et pas l'endroit ou il sert.

**Ces trois lignes tiennent toujours pour le site public, et on ne touche pas a
`style.css`.** Le site est une brochure sur papier creme, il n'a qu'un theme et n'en veut
pas d'autre.

### CE QUI N'EST PLUS VRAI : LE BUREAU CONNECTE

Sous `.bdv-coque`, c'est-a-dire sur `/mon-bureau/` et nulle part ailleurs, **la metaphore
materielle est abandonnee depuis le 21/09/2026.** Le liege, les post-it epingles, le papier
a picots, le bloc a effeuiller, l'ardoise encadree, le carton kraft, la pile, les dos de
classeur et l'enveloppe sont RECOUVERTS par `src/css/bdv-bureau.css`. Aucune de leurs regles
n'a ete supprimee de `style.css` : elles servent encore l'accueil.

**La regle qui les remplace, dans le bureau, tient en une ligne : une carte, un trait de
1 px, une surface qui monte d'un cran, et la hierarchie portee par la typographie.**

**LE MOTIF N'EST PAS LE GOUT, C'EST LE THEME SOMBRE.** Une matiere se dessine avec des
couleurs qu'elle ne peut pas retourner : le liege est un brun clair, son encre un brun
fonce, et l'un sur l'autre ne tient que sur du papier. Un bureau qui s'ouvre a 6 h dans un
chai et a 23 h dans un bureau ne peut pas porter six matieres qui ont chacune leur propre
lumiere. La profondeur devient donc un TRAIT, qui n'a qu'une valeur par theme et se retourne
d'un jeton. La deuxieme regle du plateau, « deux ombres seulement », est d'ailleurs tenue
plus strictement qu'avant sous le scope : `bdv-bureau.css` ne pose AUCUNE `box-shadow`.

L'ordre des zones, lui, ne change pas d'une ligne : le panneau, le sous-main avec le
calendrier a sa droite, l'ardoise, le mot du jour, puis a lire / le classeur / le courrier.
C'est une demande de Ted du 07/09/2026 et non une preference de mise en page, `npm run banc`
le controle par `#bureauJournee > .zone`, et la maquette validee le 21/09 le confirme ligne
pour ligne : ce qui presse en haut, les chiffres plus bas.

### UNE ZONE QUI SAIT SE MONTRER DOIT SAVOIR SE CACHER, 08/09/2026

Ted a vide sa base et son chiffre d'affaires est reste affiche, sa file de rappels aussi,
jusqu'au rechargement. Trois causes, dans cet ordre de gravite :

1. **`viderBase()` oubliait le miroir de la file.** Il effacait `bdv_crm_v1` et
   `bdv_echanges_v1`, les cles du MOTEUR ; le sous-main et l'ardoise lisent `MIROIR_KEY`,
   la cle de `bdv-crm.js`. Elle survivait, donc le bureau peignait une base effacee.
   Le vidage passe par `BdvCrm.oublier()` et **jamais par un `removeItem` ecrit dans le
   moteur** : la cle appartient a son module, deux fichiers qui l'ecrivent, c'est un
   renommage silencieux qui attend son heure. `banc:reglages` refuse desormais le nom de
   cette cle dans `bdv-base.js`.
2. **`peindreArdoise()` ne savait que MONTRER la zone.** Ses `return` de tete sortaient
   sans y toucher. Au rechargement la zone repartait cachee par son attribut de depart,
   d'ou l'impression, juste, qu'il fallait recharger pour que ca disparaisse.
3. **Ces zones etaient peintes au chargement, puis plus jamais.** D'ou
   `window.bdvMajJournee`, appelee par `ecranRafraichir()` : c'est la donnee qui rappelle
   l'ecran, jamais l'ecran qui interroge en boucle. Meme motif que `window.bdvMajPanneau`.

**Quand le sous-main s'en va, decision de Ted :** il n'existe pas si Vitisoft est repondu
« non » (la file est deposee par le tableau de bord, qui ne lit qu'un export Vitisoft : la
promesse serait vide pour toujours, meme regle que les pieces de vente retirees de la
barre), sinon il s'en va seulement si **aucun export n'a jamais ete depose** (`deposeLe`).
Un jour ou tout est traite, la zone RESTE et dit « Rien a faire aujourd'hui. Profites-en. » :
c'est un message, pas un vide. **Une lecture qui a ECHOUE ne cache jamais la zone** : ca
transformerait une panne de reseau en « tu n'as rien a faire », le pire des deux.

L'arrivee du profil passe par UN seul chemin nomme, `profilLu()`, expose en
`window.bdvProfilLu` : c'est lui qui remet la barre et le plan d'accord.

#### ET UNE ZONE NEE APRES UN DEFAUT N'EST BRANCHEE SUR RIEN, 14/09/2026

Le mot du jour est arrive apres cette section. Il n'a jamais ete ajoute a la liste de
repeinture de `peindreIdentite()`, et il n'avait pas de garde `SANS_VITI` : quelqu'un qui
repondait « non » a Vitisoft voyait l'ardoise et le sous-main partir, et gardait un conseil
sur son chiffre d'affaires. Le meme defaut, six jours apres, sur la zone d'a cote.

**Toute zone ajoutee au plan de « Ma journee » se branche sur les TROIS chemins**, pas
seulement sur celui qui la fait apparaitre : `window.bdvMajJournee` (la base bouge),
`peindreIdentite()` (le profil arrive), et son propre garde en tete de fonction. Une zone
qui n'a que le premier marche parfaitement le jour ou on l'ecrit.

### UNE PHRASE ECRITE POUR UN ECRAN NE SE REPEINT PAS TELLE QUELLE DANS UN AUTRE, 14/09/2026

Les conseils du mot du jour viennent tels quels de `diagnosticSignals()`, et c'est la bonne
regle : on ne les reecrit pas. Mais ils sont ecrits pour le tableau de bord, **en HTML** :
les renvois sont en gras, « la liste est dans `<b>Mon commerce</b>` », et les noms de clients
passent par `esc()`. Le bureau les peint avec `textContent`. Le vigneron lisait donc les
balises en clair et « Chapelle &amp; Fils » a la place du nom de son client.

**Un texte qui voyage entre deux ecrans voyage avec son ENCODAGE.** Avant de reposer ailleurs
une phrase produite par un autre ecran, regarder comment l'ecran d'origine la peint. Trois
consommateurs existent deja pour ces memes phrases, et chacun a sa reponse : `htmlLimite()`
pour le mail HTML, `sansBalise()` pour le mail texte, `texteDuConseil()` pour le bureau.

Deux choses a ne pas defaire dans `texteDuConseil()` (script inline de `src/mon-bureau.njk`) :

1. **Les balises partent AVANT le decodage des entites**, jamais l'inverse. Dans l'autre sens,
   un `&lt;b&gt;` volontairement echappe deviendrait une vraie balise puis disparaitrait, au
   lieu de s'afficher comme le texte qu'il est.
2. **On ne passe pas par l'`innerHTML` d'un element jetable**, qui ferait les deux d'un coup.
   Ce serait rouvrir une porte d'injection sur du texte qui traverse la base, pour economiser
   dix lignes.

`sansBalise()` retire les balises et **ne decode pas les entites** : la version texte du
courrier du matin porte encore la moitie de ce defaut. Signale, non corrige, parce que ce
fichier part au deploiement avec une empreinte.

Le garde-fou est la section 6 de `npm run banc:journee`, ecrite en NEGATIF : elle refuse toute
balise et toute entite dans la zone, pas les deux cas du jour. Et sa fixture porte desormais
quatre conseils dont deux graves, avec une balise et une esperluette : celle d'avant en portait
UN, propre, en severite 2, c'est-a-dire le seul etat ou aucun de ces defauts ne se declenche.
**Troisieme fois que la meme lecon se paie : un jeu d'essai plus sage que la realite ne
verifie que ce qu'il contient.**

#### « LES CONSEILS GRAVES NE TOURNENT PAS » NE VEUT PAS DIRE « ILS NE BOUGENT PAS »

La regle etait appliquee au sens fort : `i` valait 0 des qu'un conseil etait grave, `MOT_I`
s'incrementait dans le vide, et le bouton « Le suivant » etait mort exactement les jours ou il
y a plusieurs choses a comparer. Ce qui ne doit pas tourner, c'est la ROTATION AUTOMATIQUE du
jour ; **un clic est un geste, pas une rotation.** Seul le point de depart change donc, zero
quand un conseil est grave et le jour de l'annee sinon, et le geste s'ajoute par-dessus dans
les deux cas.

Et la liste parcourue est ENTIERE. Elle etait reduite aux seuls graves : « 1 sur 2 » affiche
quand le tableau de bord en avait depose quatre, les deux autres inatteignables. Les conseils
arrivent DEJA tries par gravite puis par euros en jeu, donc un grave est en tete sans qu'on ait
rien a filtrer dans la zone.

#### LE CONSEIL MENE QUELQUE PART, ET LA CIBLE VIENT DE LA SOURCE

`diagnosticSignals()` pose une `cible` sur chaque signal : l'identifiant d'une piece de
`bdv-nav.js` (`clients`, `annee`, `produits`), **jamais une adresse ecrite en dur**, parce que
le libelle d'une piece change et que son identifiant tient l'adresse. Ne pas deduire la cible
du TEXTE du conseil cote bureau : ce serait un deuxieme endroit qui decide ou mene un signal,
et il divergerait au premier signal ajoute.

Le champ est ADDITIF : aucun texte ne bouge, donc le courrier du matin n'est pas concerne. Un
depot anterieur au 14/09/2026 n'a pas de cible, le conseil s'affiche alors sans lien, et le
prochain import comble le trou. Une absence ne casse rien.

C'est le VERDICT qui porte le lien, avec un calque `::after` en `z-index: 1` sur la carte, et
non la carte entiere en `<a>` : le nom accessible serait fait des DEUX phrases. Meme motif et
meme raison que les cartes de la page des outils. **Le bouton « Le suivant » reste DEHORS de
la carte** : un element interactif dans un element interactif est interdit par le HTML, et ce
projet l'a deja paye deux fois, au sous-main et au post-it.

#### UN LIEN POSE N'EST PAS UN LIEN VISIBLE

Le lien etait la, le banc le voyait, et a l'ecran rien ne disait qu'on pouvait cliquer : encre
heritee, pas de soulignement, donc un paragraphe comme un autre. **Un lien qu'on ne voit pas ne
vaut pas mieux que la phrase qui decrit le chemin.** Une fleche le dit, cachee a la synthese
vocale puisque le hors-ecran du lien annonce deja la destination en mots. Le verdict garde son
encre : un titre de deux lignes souligne se lit comme une rature.

Trouve par `npm run apercu:mot`, pas par les 78 controles du banc. Encore la regle du
11/09/2026 : la mesure trouve ce qu'on ne voit pas, la capture voit ce qu'on ne mesure pas.

#### LA GRAVITE NE SE DIT PLUS PAR LA SEULE COULEUR

Quatre fonds et quatre filets, et rien d'autre : ca ne se voit pas en niveaux de gris, pas en
vision deuteranope, et ca ne s'entend pas du tout. C'est WCAG 1.4.1, et c'est la meme contrainte
que la cinquieme famille du calendrier, qui a pris une MATIERE faute de couleur disponible. Ici
le signe existait deja : `ico` etait transporte du tableau de bord jusqu'a la zone et pose nulle
part. Il est pose, **sans couleur** (`--warn` et `--danger` ne tiennent pas AA sur ces papiers,
et un glyphe qui se distingue par sa FORME n'en a pas besoin), et un mot hors ecran dit la meme
chose a qui ecoute.

La zone porte `aria-live="polite"`, sans quoi un clic ne produit rien du tout a la synthese
vocale. Et le bouton se detruit lui-meme en repeignant : le focus est repose sur celui qui vient
de naitre, au CLIC seulement, jamais au premier rendu, sinon la page volerait le focus a
l'arrivee.

### Ecrire clair sur sombre : toujours mesurer d'abord

Trois decisions de cette refonte ont ete prises par le calcul de contraste, contre le dessin
que j'avais propose, et elles se seraient toutes vues a l'usage sans se voir sur une maquette :

- `--gold` sur du carton kraft donne **1,19:1** : il n'existe plus a l'oeil. Il a quitte la
  barre du bureau, remplace par le bordeaux, 4,93:1.
- Le bordeaux sur `--ardoise` ne se voit pas non plus. Il a quitte l'ardoise, remplace par le
  gold, 6,1:1. Les deux couleurs ont donc echange leurs places, chacune la ou elle se lit.
- `--on-dark-faint`, le creme a 35 %, tombe a **3,0:1** sur l'ardoise. Il est interdit pour du
  texte a lire, en particulier la ligne qui dit d'ou vient un chiffre.

La table de contraste de `npm run charte` ne controle que les paires qu'on a pensé a lui
declarer, et c'est ce trou qui a laisse passer un bandeau de mois a 4,00:1. Le controle
**6 bis**, ajoute le meme jour, ne demande plus rien a personne : il parcourt la feuille et
prend chaque regle qui pose a la fois une encre et un fond en jetons, une soixantaine sur le
site, une centaine sur le bureau. Il a trouve du premier coup un bouton qui posait du creme
sur du creme, 1:1, dans deux feuilles a la fois, invisible seulement parce qu'une regle plus
specifique le recouvrait. **Une rustine qui masque un defaut le garde en vie.**

Ce controle ne voit que la moitie du probleme, celle d'une regle qui pose les deux couleurs ;
il ne peut rien dire d'une encre heritee d'un parent. Une paire de ce genre se mesure donc
toujours a la main AVANT de l'ecrire, et s'ajoute a la table.

## LE BUREAU SUR TELEPHONE : TROIS REGLES, 11/09/2026

Passe responsive du 11/09/2026. Sous **700 px**, et seulement quand le corps de page porte
`bdv-poste` (session ouverte sur /mon-bureau/), le bureau n'est plus une page du site, c'est
une application.

1. **Le site public sort du bureau.** Son bandeau et son pied de page sont masques ; une
   seule porte ressort, `.bureau-sortie`. Ils fournissaient la moitie des cibles tactiles
   hors norme et environ 900 px de hauteur par piece. Sur ordinateur on ne touche a rien.
2. **La barre des pieces est en bas de l'ecran**, fixe, huit icones de 45 px minimum, avec
   `env(safe-area-inset-bottom)` et un retrait equivalent sous `.bureau-atelier` pour que la
   derniere zone ne passe pas derriere. Pas de mots sous les icones : « Le calendrier » ne
   tient pas dans 45 px, et une etiquette coupee est pire qu'une etiquette absente.
3. **Le plancher tactile est 44 px**, et on agrandit la CIBLE, pas le dessin. Une liste dont
   tous les mots doublent ne tient plus sur un telephone ; une liste dont les cibles doublent,
   si.

**Un plancher pose sans regarder ce qui tient a cote fabrique le defaut qu'il pretendait
corriger.** `min-width: 44px` sur les fleches du calendrier a fait deborder la page entiere
de 4 px. Toujours remesurer la RANGEE apres avoir agrandi un de ses elements.

### La grille du mois devient une carte, et la liste reste le contenu

Sept colonnes de 44 px, le numero du jour, une pastille de famille par occurrence, et un
appui sur la case emmene a la carte du jour dans la liste qui est deja sous la grille. **Pas
de bulle flottante** : ce serait un deuxieme endroit qui repond « qu'est-ce qui tombe ce
jour-la », et la regle 7 l'interdit.

Deux choses a ne pas defaire :

- **les regles des pastilles sont portees par `.calm__l`**, la liste d'une case du mois, et
  jamais par `.calo__b` seule : sans ce scope elles reduisent aussi « L'annee » et la frise,
  ou l'intitule a toute la place de s'ecrire ;
- **la pastille porte `pointer-events: none`.** Elle reste un `<button>` qui coche
  l'obligation : a 6 px dans une case de 44, un pouce qui vise la case marque une DRM comme
  faite sans l'avoir voulu. La vraie coche est dans la liste, a 44 px.

### Un bloc dont la feuille arrive plus tard est du contenu en attendant

`#busyov` et `#status` sont dans la page des le chargement, mais `bdv-ecrans.css` n'est
chargee qu'a l'ouverture d'une piece de vente : entre les deux, le verre de chargement et
« Analyse… le moteur travaille » s'affichaient en bas de toutes les pieces, sur ordinateur
compris. **Tout bloc pose d'avance doit etre cache par une feuille chargee partout**, pas par
celle qui l'habillera un jour.

## LE BUREAU EST UNE APPLICATION POSEE SUR UN ECRAN D'ACCUEIL, 11/09/2026

Ted va dire a des clients d'installer `/mon-bureau/` sur leur iPhone. Ce chantier est le
second du jour sur le telephone : la passe du matin a traite « Ma journee », « Mes taches »
et le calendrier, celle-ci traite l'INSTALLATION et les cinq ecrans de vente, qui n'avaient
recu aucune regle telephone.

### L'ORDRE N'EST PAS NEGOCIABLE : les sorties AVANT le manifeste

Declarer le mode plein ecran rend REELS, d'un seul coup, tous les culs-de-sac d'une page
sans bouton retour. Tant qu'il n'y avait pas de manifeste, « Sur l'ecran d'accueil » ne
produisait qu'un signet, la barre de Safari restait la, et son bouton retour rattrapait
tout. C'est pour ca que les quatre sorties ont ete fermees d'abord, et le manifeste pose
apres.

`npm run banc:app` garde les DEUX moities ensemble, et c'est sa raison d'etre : il echoue
si le manifeste est la sans les sorties, et si les sorties sont la sans le manifeste. Ces
deux-la ne voyagent pas separement.

### Les quatre sorties fermees

1. **Les articles.** « A lire », « Lu », « Nouveaux » et le « Lire l'article » d'une
   echeance menent a des pages du site, qui ne portent ni la barre des pieces ni
   `bdv-poste`. C'est le cul-de-sac le plus frequent parce que c'est celui que le bureau
   INVITE a prendre. Un ecouteur en bas de `monterBarre()` (`bdv-nav.js`) ouvre en
   `target="_blank"` tout lien de meme origine sortant de `/mon-bureau/`, **et seulement
   en plein ecran** : iOS pose alors sa propre vue avec un bouton « OK ». Le systeme
   fournit le retour que la page ne peut pas fournir, et l'article reste l'article.
   On ne peint PAS l'article en surimpression : ce serait un deuxieme endroit qui affiche
   un article, et il divergerait au premier changement de gabarit.
2. **La deconnexion** renvoyait sur `/`, la brochure. Elle renvoie sur `/mon-bureau/`, qui
   sait deja peindre l'etat deconnecte, et par `replace` pour ne pas laisser derriere soi
   une entree d'historique vers une session fermee.
3. **La porte du bureau deconnecte** ouvrait la modale en mode INSCRIPTION. Or une app iOS
   a son propre stockage, distinct de Safari : a la premiere ouverture le vigneron est
   toujours deconnecte, il reinscrivait son adresse et recevait « Un compte existe deja ».
   `data-bdv-mode="connexion"`.
4. **Le lien `/compte/` du panneau de reglages** reste ouvert, et c'est le seul :
   il sort vers une page publique ou la session n'est pas visible. La vraie correction est
   de rapatrier mot de passe, export et suppression dans le panneau. **Pas fait.**

Bonne nouvelle a ne pas re-verifier : la connexion se fait par adresse et **mot de passe**,
avec un code a six chiffres pour l'inscription et la reprise. Le piege classique du lien
magique, qui s'ouvre dans Safari et laisse l'app deconnectee pour toujours, **n'existe pas
ici**. C'est un choix de `bdv-compte.js` qui se revele payant.

### `viewport-fit=cover`, ou le code de zone sure etait MORT

Tous les `env(safe-area-inset-*)` du depot valaient zero, faute de `viewport-fit=cover`
dans le viewport. Le retrait ecrit sous la barre des pieces, avec le commentaire qui
explique pourquoi il existe, ne s'appliquait jamais. **Une protection ecrite, jamais
executee, et que le prochain lecteur aurait crue active.**

Et on n'ecrit JAMAIS `maximum-scale=1` ni `user-scalable=no` ici. La tentation est reelle :
ca reglerait d'un coup le zoom involontaire des champs de saisie. Ca supprimerait aussi le
zoom VOLONTAIRE, celui dont a besoin quelqu'un qui voit mal. Ce defaut se corrige dans le
CSS, en portant les saisies a 16 px, et nulle part ailleurs. `banc:app` refuse les deux
mots-cles.

### LE STOCKAGE N'A AUCUNE EXEMPTION, et c'etait la panne la plus probable

WebKit est explicite : une application posee sur l'ecran d'accueil a « le meme quota
d'origine et le meme quota global que dans un navigateur ». Elle n'echappe donc pas a
l'eviction du stockage ecrit par script.

Ce que ca voulait dire ici : la session vit dans `localStorage`, les lignes de vente dans
IndexedDB, et **une semaine sans ouvrir rendait le bureau deconnecte et la base vide.** Sur
un outil qu'on ouvre quand il y a quelque chose a faire, donc pas tous les jours, c'est la
panne la plus probable de toutes, et elle serait arrivee aux premiers clients installes.

`navigator.storage.persist()` est demande une fois au chargement, et **seulement pour
quelqu'un qui a deja une session** : le navigateur accorde sur l'engagement, et demander
une faveur de stockage a un visiteur de passage n'a aucun sens. Un refus n'est pas une
erreur, le bureau marche pareil, il se vide seulement plus tot : ca n'affiche rien et ca ne
bloque rien.

Volume mesure : environ 370 octets par ligne de vente, soit 2 a 5 Mo pour 5 000 lignes,
loin du plafond d'environ 50 Mo par origine. Le seuil se rapproche vers 40 000 lignes.

### UNE APPLICATION NE RECHARGE PAS SON DOCUMENT

`rafraichir()` n'etait appelee qu'au demarrage du module. Un onglet se ferme et se rouvre ;
une app d'ecran d'accueil reste en arriere-plan des jours et iOS la restaure **sans
recharger**. Le jeton vaut une heure : au retour, PostgREST repondait 401, et comme `api()`
avale l'erreur par la regle d'or, les compteurs redescendaient a vide et la synchronisation
s'arretait. **Le bureau avait l'air normal et n'ecrivait plus rien.**

`visibilitychange` et pas `focus` : c'est le seul evenement qu'iOS declenche de facon fiable
au retour d'une autre application, et revenir de l'app Telephone apres un appel client est
le geste le plus frequent du bureau sur un telephone. Garde-fou horaire obligatoire, sinon
un aller-retour toutes les dix secondes devient un appel reseau toutes les dix secondes.

## UN LIEN `tel:` QUI COMPOSE FAUX PENDANT QUE L'ECRAN AFFICHE JUSTE, 11/09/2026

Le pire defaut trouve ce jour-la, et il dormait depuis toujours. `parseTels()` ne coupait
une cellule que sur `|`, `;` et `/`. Sur une colonne Fixe/Mobile saisie a la main :

    « 0612345678, 0494123456 »        composait  06123456780494123456
    « 04 94 12 34 56 poste 12 »       composait  049412345612
    « tel 2 : 06 12 34 56 78 »        composait  20612345678
    « (+33) 6 12 34 56 78 »           perdait son + et devenait inappelable
    « 0475 12 34 56 » en Belgique     devenait +33 475 123 456, un fixe VALIDE en Ardeche

Et `formatTel()` rendait le mensonge invisible : hors `+33` a neuf chiffres, elle affichait
la SAISIE BRUTE au lieu de la forme appelee. **L'ecran disait vrai, le lien composait faux,
et rien ne levait d'erreur.** Tant qu'on lisait l'outil sur un ordinateur, c'etait un texte
un peu sale ; sur un iPhone, c'est un bouton « Appeler » et un appel qui n'aboutit pas, ou
pire un inconnu qu'on appelle en croyant joindre son client export.

Les cinq corrections, et la derniere est la seule qui soit structurelle :

1. separateurs elargis, le tiret **entoure d'espaces seulement** (`06-12-34-56-78` est UN
   numero, `06 12 34 56 78 - 04 94...` en fait deux) ;
2. le `+` se cherche DEVANT le premier chiffre, pas en tete de chaine ;
3. on ne retient que le PREMIER bloc de 8 a 15 chiffres, pas toute la cellule ;
4. le repli `+33` ne s'applique que si `pays` est vide ou francais, et `deriveRow()` passe
   donc la colonne. C'est la regle deja ecrite en commentaire, « sans jamais inventer un
   indicatif qu'on n'a pas », qui n'etait pas tenue ;
5. **`formatTel()` ne peut PLUS diverger** : si les chiffres affiches ne sont pas ceux de
   `appel`, elle affiche `appel`. C'est le controle 6 de `npm run banc:tels`, et c'est lui
   qui compte : les quatre premiers reparent des cas, celui-la interdit la classe entiere.

## LE BROUILLON DE LA FICHE, ou la decision du 11/09 qui se retournait contre elle-meme

Depuis ce jour-la, « Appele » n'ecrit plus rien au clic : c'est l'enregistrement de la note
qui pose la trace. La regle est bonne. Sur un telephone, il lui manquait un filet.

Le lien `tel:` fait QUITTER la page pour l'application Telephone. Si iOS recycle l'onglet
sous la pression memoire (et cette page tient tout `ROWS` en memoire vive), la page se
**recharge** : fiche fermee, note perdue. Et comme rien n'a ete pose au clic, **rien
n'existe** : l'appel a eu lieu, la ligne est toujours au sous-main, le rappel n'est pas
repousse, et il faut retrouver le client, rouvrir, retaper.

Trois choses a ne pas defaire dans `bdv-ecrans.js` :

1. **On sauve sur `visibilitychange`, pas sur `beforeunload`.** iOS ne declenche pas
   `beforeunload` quand on part vers une autre application.
2. **On reprend le TEXTE, jamais le GESTE EN ATTENTE.** Le texte est le travail du vigneron,
   le geste n'est qu'un defaut de l'outil. Ressusciter un `GESTE_ATTENDU` repousserait un
   rappel de trente jours sur la foi d'un brouillon, donc ecrirait en base quelque chose que
   personne n'a valide. Meme distinction que pour la date de rappel dans `noter()`.
3. **Fermer la fiche efface le brouillon, partir de l'application le garde.** Fermer est un
   geste, et « fermer sans rien ecrire ne laisse aucune trace » est une demande de Ted.
   Partir vers l'app Telephone n'est pas un geste de fermeture.

`sessionStorage` et pas `localStorage` : un brouillon n'a pas a survivre a la fermeture du
navigateur, et il ne doit pas se retrouver chez la personne suivante qui ouvre une session
sur le meme appareil. C'est la lecon de la file des choix de calendrier.
Et **on le DIT** en le reprenant : un texte qui revient tout seul sans un mot se lit comme
un bug, et le vigneron le reecrit par-dessus en croyant bien faire.

## `bdv-ecrans.css` N'AVAIT AUCUN POINT DE RUPTURE TELEPHONE, 11/09/2026

Cette feuille de 48 ko ne contenait pas une seule fois `max-width: 700px` ni `bdv-poste` :
ses points de rupture s'arretaient a 640. « Mon commerce », « Mon cap », « Mes cuvees »,
« Mon registre » et la fiche client restaient donc en version ordinateur retrecie, alors que
la passe du matin avait traite les trois autres pieces. Le bloc ajoute en bas de la feuille
porte quatre regles, et les trois premieres sont celles de `style.css`. La quatrieme est a
elle :

**`100dvh` ET PAS `100vh`.** Sur iOS, `100vh` vaut la hauteur SANS les barres du navigateur :
la fiche client, qui est plein ecran sur telephone, depassait la zone visible d'une centaine
de pixels, et son bouton « Enregistrer », place en pied, passait dessous. C'est-a-dire
precisement le bouton qui pose la trace de l'appel.

### UN TABLEAU SE COMPRIME AVANT DE DEBORDER

`.content` porte `overflow-x: hidden`. On croyait donc que les colonnes qui depassaient
etaient rasees ; **la mesure dit autre chose et c'est pire a corriger** : le tableau se
comprime pour tenir, et les six colonnes de « Mix canal et prix moyen » se serraient dans
368 px. Pas de defilement, pas de coupure, juste des colonnes illisibles. Le meme resultat
par un autre chemin.

Il a donc fallu DEUX regles, et la premiere seule ne servait a rien :

- la CARTE qui porte un tableau defile (`:has(> table.data)`), pour que le debordement
  reste dans son cadre et ne pousse jamais la page ;
- les en-tetes et les colonnes de nombres reprennent leur largeur naturelle
  (`white-space: nowrap`), sans quoi le tableau continue de se comprimer et ne defile pas.
  Les colonnes de TEXTE gardent le droit de se replier : leur imposer `max-content` ferait
  defiler un tableau sur trois ecrans de large des qu'un client porte une longue adresse.

### LA RANGEE SE REMESURE APRES AVOIR GROSSI UN DE SES ELEMENTS

Deja paye le matin sur les fleches du calendrier, repaye l'apres-midi sur moi : porter les
deux champs de dates a 16 px et 44 px a fait sortir `.filterbar__dates` a 438 px dans une
fenetre de 390. La `filterbar` se repliait deja, c'est le GROUPE a l'interieur qui ne se
repliait pas. Un plancher tactile se pose element par element, un debordement se mesure
rangee par rangee, et c'est pour ca que ca recommence.

### LA REGLE DES 44 px DU CALENDRIER VISAIT UN ELEMENT DECORATIF

`bdv-calendrier.css` portait bien la regle, avec le bon commentaire et les bonnes mesures.
Elle visait `.calf__m`, qui n'est pas un bouton de carte : c'est le signe de lune ou de
ferie du fond de carte, un `<span aria-hidden>` qu'on ne clique pas. **La mesure etait
juste, le selecteur non, et aucune des coches n'a jamais recu ses 44 px.**

Ce qui rend la chose grave plutot que penible : la pastille de la grille porte
`pointer-events: none` EXACTEMENT parce que « la vraie coche vit dans la liste du dessous,
a 44 px ». Elle n'y etait pas. **Sur iPhone, cocher une DRM n'avait aucune cible conforme,
dans aucune vue.** Et le `min-height` pose sur le glyphe gonflait au passage une case sur
trois de la grille du mois, ce qui n'etait que le symptome visible du meme defaut.

### UNE MESURE DIT QU'UNE PAGE NE DEBORDE PAS, UNE CAPTURE DIT QU'ELLE SE LIT

Le harnais de mesure a valide « 390 px de page pour 390 px de fenetre, zero cible sous
44 px, zero saisie sous 16 px ». La capture du meme etat montrait « Domaine / des / Hauts /
Coteaux » sur quatre lignes : rendre leur largeur aux colonnes de nombres avait comprime la
colonne de gauche, celle qui porte le NOM du client, celle qu'on cherche des yeux. D'ou un
plancher de 9 rem sur la premiere colonne.

**Les deux controles ne se remplacent pas, et l'ordre compte** : la mesure trouve ce qu'on
ne voit pas, la capture voit ce qu'on ne mesure pas.

### L'AUTO-AUDIT : ce que ce chantier a trouve DANS SON PROPRE TRAVAIL

Ted, avant de pousser : « audite-toi et corrige-toi. Tu n'as pas le droit de me pousser un
truc incoherent ou moche. » Il avait raison, et voici ce que le controle a trouve.

**Le premier constat est de methode.** Ce qui avait ete verifie, c'etait une page de test
ECRITE POUR L'OCCASION, avec du balisage recopie a la main. Elle ne pouvait valider que ce
qu'on avait pense a y mettre. Le vrai banc sert `_site`, pose 286 lignes de vente dans la
VRAIE IndexedDB et ouvre chaque piece par son vrai identifiant : il a trouve six defauts de
plus en un passage, dont trois etaient de ce chantier meme.

1. **`min-height` sur `.chip` etait INERTE.** `.chip` est un `<span>` sans `display`
   declare, donc en ligne, et `min-height` n'a aucun effet sur un element en ligne. Les
   chips de periode, qui pilotent TOUS les chiffres de l'ecran, sont restes a 21 px.
   **C'est la troisieme fois de la journee que la meme faute se produit** : `.calf__m` le
   matin, les selecteurs non portes le 07/09, celle-ci le soir. La regle qui en sort :
   **avant d'ecrire `min-height` sur une classe, verifier son `display`.** Et surtout,
   un banc qui ne mesure pas un type d'element ne peut pas signaler qu'une regle est morte
   dessus : le premier harnais ne regardait pas les `span`, donc il a valide une regle qui
   ne s'appliquait pas.

2. **`status('info')` n'existait pas.** `status()` pose `class="status <type>"`, et
   `bdv-ecrans.css` ne definit que trois etats, error, loading et success. Un quatrieme nom
   sort un bandeau SANS fond ni couleur, c'est-a-dire le bandeau nu deja paye le 08/09.
   **Ou le type existe dans la feuille, ou on prend celui qui existe.** Ne pas en inventer
   un quatrieme sans l'ecrire ET sans mesurer sa paire de contraste.

3. **Les deux champs d'ajout d'une tache etaient a 14 px et 11 px.** Ils avaient recu leurs
   44 px de hauteur le matin, jamais leur taille de TEXTE. Le bloc telephone ecrit le soir
   corrigeait les saisies de `bdv-ecrans.css` et laissait celles-la, qui vivent dans
   `style.css`. **Un meme defaut reparti sur deux feuilles se repare a moitie**, et la
   moitie oubliee est celle du geste le plus frequent : noter une tache debout dans un rang.

4. **Un `<summary>` est une cible, et ca ne se voit pas a la relecture.** « Suivi »,
   « Ecrire un message a ce client », « Qui pese quoi dans ton chiffre » : le troisieme
   etage de la regle des trois etages, celui qu'on deplie pour comprendre, faisait 17 px.
   Un `<summary>` ne ressemble pas a un bouton dans le code, et il avait echappe aux DEUX
   passes du jour.

5. **La bascule CA / Bouteilles faisait 25 px.** Elle ne change pas la mise en page, elle
   change L'UNITE DE TOUS LES CHIFFRES de « Mon cap » et « Mon registre » : la rater se lit
   comme un chiffre qui a bouge tout seul, pas comme un clic rate.

### « domaine NaN € », sur TOUTES les fiches clients, depuis longtemps

Le defaut le plus grave de la soiree, et il n'appartenait pas a ce chantier.

    const prixBase = prixVenteMoyen();          // rend un OBJET {parProduit, parFamille}
    ... fmtNum(prixBase, 2) ...                 // vaut NaN

Le garde `prixBase ?` ne rattrapait rien, un objet etant toujours vrai. Toutes les fiches
affichaient donc « 9,62 € en moyenne, domaine NaN € », sur l'ecran le plus consulte de
l'outil, et `npm run apercu:fiche` le MONTRAIT deja. **Un apercu se regarde, et on finit
par ne plus regarder.**

**La cause n'est pas l'appel, c'est le NOM.** « Prix de vente moyen » designait une carte de
prix par produit et par famille ; l'appelant a lu le nom et suppose un nombre. D'ou
`prixMoyenBouteilleDomaine()`, qui dit BOUTEILLE et DOMAINE et rend un scalaire. **Ne pas
les re-fusionner**, et la regle generale : *quand deux formes different, deux noms
different, et le nom porte la FORME autant que le sujet.*

Sa base de calcul est celle du client, `ca/btl` sur les lignes `_vin`, et pas le filtre plus
severe de `prixVenteMoyen()` : deux chiffres cote a cote dans la meme phrase doivent se
comparer.

**Le garde-fou est dans `npm run banc:registre`**, sections « La fiche client » : la fiche
est rendue, son TEXTE est passe au crible de `NaN`, `Infinity` et `undefined`, et le
controle a ete verifie EN REMETTANT LE DEFAUT. Un controle qui n'a jamais echoue ne garde
rien. La regle du depot le disait deja, « une case vide vaut mieux qu'une valeur inventee » :
NaN est pire que les deux.

### 434 px d'en-tete pour 844 px d'ecran, SIGNALE ET NON CORRIGE

**ROUVERT ET TRAITE LE 18/09/2026, MAIS SUR ORDINATEUR SEULEMENT.** Voir la section
« L'OCCUPATION DE L'ESPACE » plus bas : le bandeau passe de 209 a 71 px. La mesure des
434 px ci-dessous a ete prise a 390 px de large et **n'a pas ete refaite** : elle reste
ouverte, et les chiffres qui suivent sont ceux d'avant.

Mesure sur la vraie page : l'en-tete du bureau occupe **434 px, soit 51 % du premier
ecran**, et la barre des pieces 53 px en bas. Il reste **357 px de contenu visible sans
faire defiler**, et sur « Mon cap » ils sont pris par la barre d'exports et les chips de
periode. Le vigneron ouvre son bureau et ne voit encore rien de ce qu'il vient chercher.

Ce n'est pas un defaut, c'est un dessin, et il a ete decide ailleurs : le salut, les deux
boutons, la lune. **A rouvrir avec Ted, pas a trancher seul.** Ce qui est acquis, c'est le
chiffre : une piece qui ne repond qu'apres 434 px de decor ne repond pas.

### Ce qui reste ouvert sur le telephone, et qui n'a PAS ete fait

- **Rien n'annonce qu'un tableau defile.** Il defile, mais un pouce ne le devine pas.
- **Les libelles des huit icones de la barre n'existent que dans `title`**, donc pour
  personne sur un ecran tactile. La regle du matin l'assume (« une etiquette coupee est pire
  qu'une etiquette absente ») : a rouvrir avec Ted, pas a trancher seul.
- **Les montants mensuels de la fiche, les noms de lune et de ferie, l'avertissement de
  fenetre de `bdv-ecrans.js`** : tous dans des `title`, tous invisibles sur iPhone.
- **La vue « L'annee » du calendrier ne dit rien au doigt** : son contenu entier est dans
  des `title`, et sa seule cible est le titre du mois, a 24 px.
- **Un appui sur une case de grille au MILIEU d'une periode ne fait rien** : la carte porte
  le jour de DEBUT. 17 des 29 regles durent plus d'un jour.
- **Pas de balayage lateral pour changer de mois**, alors qu'aucun ecouteur tactile n'existe
  nulle part et que le terrain est donc libre.
- **`/compte/` depuis le panneau de reglages** (voir plus haut).
- **`bdv-taches.js` et `bdv-signets.js` n'ont toujours pas de proprietaire sur leur file
  hors ligne.** Signale le 08/09, et le telephone le rend urgent : la vigne est precisement
  l'endroit ou l'on est hors ligne.
- **Le repli de `jour()` dans `bdv-courrier.js` fait un `toISOString()`** et porte donc le
  decalage corrige ailleurs. Non touche VOLONTAIREMENT : ce fichier est joint au
  deploiement avec une empreinte, le modifier force un redeploiement de `courrier-matin`
  pour un defaut qui ne mord que sur l'apercu hors ligne.


## L'OCCUPATION DE L'ESPACE SE MESURE EN HAUTEUR, PAS EN LARGEUR, 18/09/2026

Ted, captures de HubSpot a l'appui : « je veux la meme occupation de l'espace pour le BVD ».
Sa premiere hypothese etait « trop de blanc sur les cotes ». **Elle etait fausse, et seule la
mesure pouvait le dire.** Son ecran fait 1440 x 900, releve dans son navigateur ; l'atelier est
plafonne a 1440 plus la barre, donc le plafond ne mord pas, et le blanc lateral fait **24 px de
chaque cote, 3 % de la largeur**.

Le gisement etait en hauteur : **268 px, soit 30 % de l'ecran, avant la premiere chose utile**,
dont 209 px de bandeau ne portant qu'une date, un salut, la lune et deux boutons.

**ET LE BANDEAU A ETE REMIS COMME AVANT LE SOIR MEME.** Il a ete resserre a 71 px, puis range
en deux lignes ; Ted a juge les deux sur sa vraie page, avec son prenom, sa plaque, son metier
et un resume a deux chiffres : « c'est un foutoir pas possible », puis « c'etait mieux avant ».
**Le bandeau est donc revenu a son dessin du 08/09/2026, a l'octet, et il n'est plus un sujet
de mise en page : le rouvrir demande Ted, pas une mesure.**

Ce qui reste acquis, et qu'il ne faut pas defaire en croyant finir le retour arriere : les
marges de l'atelier (voir plus bas), la barre des pieces a 156 px et la borne `--postit-l`.

**LA REGLE : la densite d'un CRM ne vient pas de sa largeur, elle vient de ce que chaque pixel
de hauteur porte quelque chose d'ACTIONNABLE.** HubSpot depense a peu pres la meme hauteur
d'entete que ce bureau ; il la depense en recherche, onglets, filtres et en-tetes de colonnes.
Avant de resserrer une mise en page, mesurer ce que les pixels contestes PORTENT, et pas
combien il y en a.

**ET LE COROLLAIRE S'EST VERIFIE CONTRE MOI DES LE SOIR MEME. Hors ligne, le profil n'arrive
pas : le banc photographiait « Te voila chez toi. », sans prenom, sans plaque, avec un resume
d'une ligne, c'est-a-dire l'etat le plus VIDE du bandeau. Les trois versions ont ete jugees sur
cette image-la, et la vraie page en portait huit fragments.** Un harnais qui ne montre que
l'etat vide valide une mise en page que personne ne verra ; `banc-large.mjs` pose desormais ces
textes a la main avant de photographier. Quatrieme fois que le depot paie un jeu d'essai plus
sage que la realite.

**L'AUTRE COROLLAIRE, TOUJOURS VRAI : resserrer un ecran qui affiche peu ne le
remplit pas, il le rend petit.** Ce qui a ete retire ici est du vide (retraits, ecarts, un `h1`
en `--t-h1` sur un salut, une lune empilee sur trois lignes) ; **aucune taille de texte n'a
bouge**. Le jour ou une piece paraitra encore vide apres ca, la question ne sera plus la mise en
page, ce sera ce qu'on y met.

### `scripts/banc-large.mjs` : le banc qui mesure l'occupation

Meme montage que `capture-telephone.mjs`, a **1440 x 900**, et hors de `npm run verif` pour la
meme raison, il demande `playwright`. **La largeur est celle de l'ecran de Ted, pas un rond :**
un audit d'occupation fait a une autre largeur ne mesure pas le bureau qu'il regarde.

Il calcule le blanc sur le contenu qui PORTE quelque chose, un fond, une bordure ou du texte,
jamais sur les boites vides qui s'etendent sans rien montrer : c'est la difference entre « la
page fait 1440 » et « la page se sert de 1440 ».

Ses deux limites sont dans son en-tete et il faut les lire avant de s'en servir : la modale
« On raccorde ton bureau » couvre le bureau hors ligne, il la ferme par « Ouvrir quand meme » ;
et **les lignes de vente ne se chargent pas dans ce montage**, donc la mise en page des cinq
pieces de vente n'y est PAS mesurable.

### Ce que ce lot n'a pas touche, et qu'il ne faut pas croire traite

- **Le panneau de liege fait 1140 x 180 px pour un seul post-it.** La plus grande surface du
  bureau, la moins remplie. Ce n'est pas un probleme de retraits, c'est le dessin du liege.
  **A rouvrir avec Ted, pas a trancher seul.**
- **Le telephone n'a pas ete remesure** : il a seulement ete verifie qu'il ne deborde pas
  (390/390 sur les sept pieces) et que le point de rupture 980 px replie le bandeau comme avant.

## Le responsive se juge sur la ZONE, pas sur la fenetre

Audit du 07/09/2026, apres une capture de Ted montrant des boutons qui sortaient du cadre.
Le listing du sous-main debordait de sa zone **a toutes les largeurs de 320 a 1920 px**, et
la page defilait a l'horizontale sur cinq d'entre elles. La cause n'etait pas un point de
rupture mal place, c'etait une facon de raisonner :

**La largeur de la fenetre ne dit rien de la place disponible.** Mesures reelles de la zone
du sous-main : 722 px sur une fenetre de 1024, **728 px sur une fenetre de 1280**, 848 sur
1440. Elle ne fait presque pas la difference entre 1024 et 1280, parce que la barre des
pieces prend 230 px et que l'atelier est plafonne. Un point de rupture pose sur la fenetre
se trompe donc de cible.

**Ce qu'on fait a la place.** La zone porte `container-type: inline-size` et le composant
bascule sur une requete de conteneur. Deux pieges verifies a la mesure :

1. **Une requete de conteneur compare la boite de CONTENU**, donc la zone moins ses
   retraits. Une zone de 728 px a 680 px de contenu, soit 42,5 rem : un seuil pose a 44 rem
   basculait en fiches le portable le plus repandu.
2. **Une largeur en `em` se calcule sur le corps de l'element qui la porte.** Sur un
   en-tete en `--t-micro`, dix pixels, une colonne de 14 em fait 140 px et non 224. Les
   largeurs de colonnes s'ecrivent en `rem` ou en pourcentage.

**Le budget de colonnes se mesure, il ne s'estime pas.** Cinq colonnes plus trois boutons a
libelle complet demandent 858 px ; le tableau du sous-main n'en fait jamais plus de 934 et
tombe a 640. D'ou trois decisions, chacune adossee a un nombre : les boutons portent un mot
court avec leur nom complet en `title` et `aria-label`, la reference passe sous le nom ou
elle ne coute aucun pixel de largeur, et le montant sort du motif pour avoir sa colonne de
nombres alignes a droite.

**Et un cadre qui peut deborder porte `overflow-x: auto`.** Un contenu trop large doit
defiler DANS son cadre, jamais pousser la page.

## L'anneau de focus a la couleur de la SURFACE, pas du composant

Deux fois le meme defaut le meme jour. La barre du bureau avait recu un anneau creme parce
qu'elle etait sombre ; devenue du carton kraft clair, le meme anneau est tombe de 14,74:1 a
**2,36:1**, sous le seuil de 3:1 des indicateurs de focus. Et dans le listing, l'anneau
standard du site se pose a trois pixels DEHORS : sur un bouton de 44 px dans une rangee de
50, ses segments haut et bas tombaient pile sur les filets de la rangee et disparaissaient
dedans.

Donc : quand une surface change de couleur, **relire l'anneau de focus de ce qu'elle
porte**, et le verifier en posant le focus au clavier dans un vrai navigateur puis en
LISANT la couleur calculee. A l'oeil, sur une capture, un anneau pale se voit encore un peu.

## Trois pieges de CSS qui ne cassent rien et effacent tout

Les trois se sont produits le 07/09/2026, aucun n'a fait echouer la charte, et chacun a
coute une capture d'ecran pour etre vu.

1. **Un commentaire ouvert au-dessus d'un bloc de regles avale le bloc.** La feuille parse,
   la charte reste CONFORME, et les elements concernes reprennent l'allure par defaut du
   navigateur. La section 3 bis de `npm run charte` refuse desormais tout commentaire qui
   contient un selecteur, une accolade et une declaration.
2. **`display: block` sur une cellule de tableau la sort de la mise en page du tableau.**
   Son fond se decale de quelques pixels et trace une bande claire en travers. Une regle
   `.machin` qui porte sur un `<td class="machin">` doit s'ecrire `td.machin`.
3. **Une largeur en `em` se calcule sur le corps de l'element qui la porte.** Sur un en-tete
   en `--t-micro`, dix pixels, une colonne de 14 em fait 140 px et non 224. Les largeurs de
   colonnes s'ecrivent en `rem` ou en pourcentage.

## DEUX COLLANTS A `top: 0` NE SE PARTAGENT PAS LE HAUT, 08/09/2026

`.nav`, l'entete du site, est `position: sticky; top: 0` avec un fond OPAQUE et
`--z-nav` (100). Tout ce qui se colle aussi a `top: 0` passe DESSOUS et disparait des
qu'on fait defiler. C'est ce qui cachait « Ma journee » et « Mes taches » dans la barre
des pieces du bureau, signale par Ted.

La regle : **tout element collant se decale de `--h-entete`**, le token qui porte la
hauteur de l'entete. Deux consequences, et la seconde s'oublie :

    top: calc(var(--h-entete) + var(--e-s));
    max-height: calc(100vh - var(--h-entete) - var(--e-s) - var(--e-m));

Sans la soustraction sur la hauteur, l'element descendu **depasse par le bas exactement
autant qu'il depassait par le haut** : le probleme change de bout, il ne disparait pas.
Avec `overflow-y: auto`, l'element garde alors son propre defilement et toutes ses
commandes restent atteignables sur un ecran court ou a fort zoom.

`--h-entete` porte un repli en CSS (4rem) et la **vraie hauteur mesuree** par
`mesurerEntete()` dans `bdv-nav.js`, au chargement, au redimensionnement et une fois les
polices arrivees. Ne pas figer un chiffre a la place : il se perimerait au premier
changement de l'entete, en silence, et seulement pour qui fait defiler.

**Reste a faire** : `.bdv-ventes table.data--sticky thead th` est encore a `top: 0`. Sur
un long tableau, la ligne d'en-tete se colle donc sous l'entete du site au lieu de sous
son propre bord. Meme cause, meme correction.

## Une seule commande avant de pousser

    npm run verif

Elle enchaine `build`, `charte`, `charte:bureau`, puis les quatorze bancs (`banc`,
`banc:journee`, `banc:reglages`, `banc:taches`, `banc:calchoix`, `banc:calclients`, `banc:sync`,
`banc:lune`, `banc:porte`, `banc:registre`, `banc:cap`, `banc:commerce`) et les deux controles du
courrier, et s'arrete au premier echec.

Les apercus ne sont PAS dans cette chaine, parce qu'ils ne verifient rien : ils MONTRENT, et
c'est a regarder avec des yeux. **Ce qui EST dans la chaine depuis le 22/09/2026, c'est
`npm run banc:apercus`, qui tient les apercus eux-memes** : il echoue si l'un d'eux pose d'autres
feuilles que la page qu'il montre. Voir « UN APERCU CHARGE CE QUE CHARGE LA PAGE QU'IL MONTRE ». `npm run apercu:panneau` pour le panneau de liege,
`npm run apercu:fiche` pour la fiche client dans ses quatre etats, `npm run apercu:modale`,
`npm run apercu:equipe`, et `npm run apercu:mot` pour le mot du jour dans ses quatre gravites.
Les ouvrir avant de livrer un changement de dessin : `npm run courrier` avait deja laisse passer
trois defauts que seule une capture a montres, et `apercu:mot` a trouve un lien invisible que
les 78 controles du banc declaraient pose.

Elle existe depuis le 07/09/2026 pour une raison precise : ce jour-la j'ai lance les quatre
a la main dans un `&&`, en passant chacun par `| tail -2` pour n'en lire que le verdict. Le
code de sortie d'un tuyau est celui de sa DERNIERE commande, donc celui de `tail`, qui
reussit toujours. Le banc a annonce un echec, la chaine a continue, et le commit est parti.
**Un enchainement de controles ne doit jamais passer par un tuyau.**

Note d'environnement : le depot est parfois monte a travers un pont reseau. L'ecriture
d'Eleventy peut alors n'etre visible qu'une seconde apres la fin du processus, et un banc
lance immediatement apres lit une page a moitie ecrite. Un echec isole qui ne se reproduit
pas au deuxieme essai vient de la, pas du code : le relancer suffit, mais il faut le
relancer, pas l'ignorer.

### UN BANC JSDOM DOIT SORTIR EXPLICITEMENT, 10/09/2026

`npm run banc:journee` n'est jamais sorti tout seul, et personne ne l'a vu pendant deux jours
parce qu'il affichait son verdict AVANT de rester en l'air. La page pose
`setInterval(peindreLune, 30 minutes)` au `DOMContentLoaded` : ce minuteur appartient a la fenetre
jsdom et tient la boucle d'evenements de node ouverte pour toujours. `npm run verif` s'arretait
la, sans message, **un enchainement de controles bloque se lit comme un controle qui reflechit**,
et c'est exactement pour ca que ca ne se voit pas.

Regle : **tout banc qui monte une page dans jsdom finit par `process.exit`**, avec le code de
sortie de son verdict. Un `setInterval`, un `setTimeout` long ou une animation de la page suffit a
le retenir, et aucun de ces trois n'est un defaut de la page.

### Claude ne lance plus de commande git dans ce depot, 10/09/2026

Le pont reseau qui monte le depot **interdit la suppression de fichiers**. Or une commande
git ordinaire, `git status` comprise, pose `.git/index.lock` et le retire en sortant : ici
elle le pose et n'a pas le droit de le retirer. Le verrou reste, et le `git add` suivant, le
mien comme celui de Ted, echoue sur « un autre processus git semble en cours ». Pire : le
`git push` qui suit repond « Everything up-to-date », qui se lit comme une reussite alors
que rien n'a ete commite.

Regle : depuis la session, tout git de LECTURE passe par `GIT_OPTIONAL_LOCKS=0`, qui lit
l'index sans le verrouiller. Aucun git d'ECRITURE, ni `add`, ni `commit`, ni `push` : c'est
Ted qui les lance, et c'est deja la regle du projet.

Si le verrou traine malgre tout, Ted le retire lui-meme :

    rm -f .git/index.lock

## `tokens.css` N'EST PAS SERVI AU NAVIGATEUR, et deux controles ne l'ont pas dit

Piege paye le 08/09/2026, et il est vicieux parce que deux garde-fous ont regarde ailleurs.

`tokens.css`, a la racine, est la REFERENCE. Il n'est lie par aucune page et n'est pas copie
dans `_site`. Les vraies declarations vivent dans le `:root` de `src/css/style.css` pour le
site et le bureau, et dans celui de `src/css/bdv-ecrans.css` pour les ecrans de vente.
**Un jeton ajoute a `tokens.css` seul n'existe pas dans le navigateur.**

Ce qui a rendu la chose invisible :

1. **`npm run charte` ne lit pas les feuilles chargees en JavaScript.** Seul `charte:bureau`
   les ajoute. Un `var()` ecrit dans `bdv-calendrier.css` echappait donc au controle du site.
2. **`charte:bureau`, lui, lisait AUSSI `bdv-ecrans.css`**, qui declare `--serie-1` a
   `--serie-8`. Le nom existait, le controle etait content. Il ne pouvait pas savoir que la
   declaration venait d'une autre feuille, avec d'autres valeurs, pour un autre usage.

**Une collision de noms rend une declaration manquante indetectable.** C'est le seul cas ou
la charte peut dire CONFORME sur du var() casse. Le defaut n'est apparu que le jour ou une
regle est descendue dans `style.css`, ce qui l'a fait entrer dans le perimetre du controle du
site.

Et le harnais de capture chargeait `tokens.css`, donc **les captures montraient les bonnes
couleurs alors que le navigateur en aurait montre d'autres**. Un harnais qui ne charge pas
exactement ce que la page charge ne verifie rien : il illustre une intention.

### CE QUI A ETE AJOUTE LE 18/09/2026 : la collision annoncee ici est arrivee

Cette section prevoyait le defaut depuis le 08/09 : « Une collision de noms rend une
declaration manquante indetectable. » **Elle s'est produite, et aucun controle ne l'a vue
pendant dix jours.**

`--ombre-photo` valait `0 20px 60px rgba(0,0,0,0.35)` dans `style.css` et
`10px 10px 0 rgba(0,0,0,0.28)` dans `bdv-ecrans.css`. Deux ombres sous un seul nom. Comme
`bdv-nav.js` pose la seconde feuille APRES la premiere, la sienne gagnait, et elle gagnait
pour la PAGE ENTIERE : une regle du site qui aurait appele ce jeton aurait vu son ombre
changer toute seule a la premiere ouverture d'un ecran de vente, sans qu'une ligne du site
ait bouge. Invisible parce que le site n'appelle ce jeton nulle part. Un piege qui attendait.

Et `tokens.css` avait **trente et un jetons de retard** sur ce qui etait reellement servi :
`--ardoise`, `--postit-jaune`, `--ombre-papier`, `--tr-choregraphie`, les huit `--serie-*`,
et vingt autres. Les deux fichiers etaient tenus a la main, en parallele. C'est la mecanique
exacte d'une derive, et rien ne la mesurait.

**`npm run banc:jetons` est desormais ce qui manquait.** Il echoue si :

1. un jeton est servi avec deux valeurs differentes, dans n'importe quelles feuilles ;
2. un jeton servi au navigateur n'est pas ecrit dans `tokens.css` ;
3. une valeur de `tokens.css` ne correspond plus a celle qui est servie.

**LA REGLE : un jeton ajoute a une feuille servie s'ecrit dans `tokens.css` DANS LA MEME
SESSION, avec la raison qui le fait exister, pas seulement sa valeur.** Le banc le rappelle,
il ne le fait pas a votre place.

`tokens.css` reste une DOCTRINE, pas une feuille servie. Le faire servir pour de bon, et
vider le `:root` de `style.css`, est un arbitrage qui appartient a Ted et qui a un
prealable strict : `scripts/charte.mjs` collecte les jetons dans le `:root` de sa cible, et
vider ce bloc lui ferait declarer une centaine de jetons « jamais declares ». **On apprend
d'abord au garde-fou a lire la nouvelle forme, on change la forme ensuite. Jamais l'inverse.**

## LE BUREAU A DEUX THEMES, LE SITE N'EN A QU'UN, 21/09/2026

Depuis ce jour, `/mon-bureau/` se peint en clair ou en sombre. **Le site public ne change
pas** : papier, encre, bordeaux, angle vif, un seul theme. Ce n'est pas une inegalite de
traitement, c'est la meme regle que partout ailleurs dans ce depot : le site est une brochure
qu'on lit, le bureau est un poste de travail qu'on ouvre a 6 h dans un chai et a 23 h dans un
bureau.

Les jetons vivent dans `src/css/bdv-theme.css`, liee par `/mon-bureau/` et par rien d'autre, via
le drapeau de front matter `theme_bureau` que seul `src/mon-bureau.njk` porte. **Cette feuille
ne porte AUCUNE regle de dessin, et elle ne doit jamais en porter** : un jeu de jetons qui se
met a peindre devient une cinquieme feuille du bureau, avec ses collisions de scope.

### LA REGLE DU PREFIXE `--bdv-`, ET LES TROIS COLLISIONS QUI L'ONT DECIDEE

**Tout jeton de theme porte le prefixe `--bdv-`.** Motif mesure, pas esthetique. Trois noms de
la maquette entraient en collision avec des jetons deja servis, et de la pire facon : MEME NOM,
AUTRE NATURE.

    --trait        vaut 1px dans style.css ET bdv-ecrans.css, la maquette en faisait une COULEUR
    --trait-fort   vaut 2px dans style.css,                   la maquette en faisait une COULEUR
    --r-rond       vaut 50% dans style.css,                   la maquette en faisait 9999px

La feuille de theme est chargee APRES style.css : sans prefixe, `border: var(--trait) solid`
serait devenu `border: #E4E3DE solid` **sur le site entier**, une bordure sans epaisseur, sans
une erreur nulle part. C'est exactement le defaut `--ombre-photo` documente plus haut, celui
pour lequel `npm run banc:jetons` existe, et qui a dormi dix jours. Le prefixe ferme la classe
entiere au lieu de fermer les trois cas connus.

### LES TROIS BLOCS, ET POURQUOI DEUX D'ENTRE EUX N'ONT PAS QUE `:root`

    :root, [data-theme="light"]                      le clair, COMPLET. LA SEULE SOURCE.
    @media (prefers-color-scheme: dark)
      :root:not([data-theme="light"])                le telephone. Ne cree rien, retourne.
    :root[data-theme="dark"], [data-theme="dark"]    le bouton. Identique au precedent.

**Tout jeton nait dans le bloc clair.** Un bloc sombre ne fait que retourner une valeur deja
nee : un jeton qui naitrait la ne vaudrait RIEN pour qui est en clair.

**La forme sans `:root` des blocs 1 et 3 n'est pas decorative, et c'est ce qu'on supprimerait
en premier en relisant.** Les proprietes personnalisees heritent, donc un CONTENEUR qui les
redeclare retourne tout son sous-arbre. Sans elle : pas d'apercu des deux themes dans une meme
capture, pas d'apercu d'impression clair sous une racine sombre, et surtout un sous-arbre force
en clair **heriterait des valeurs sombres** pour tout ce que `:root[...]` seul n'atteint pas. Il
s'afficherait a moitie retourne, sans erreur.

`color-scheme: var(--bdv-schema)` est pose sur `html` ET sur `[data-theme]`. Sans lui, la barre
de defilement, les `<input type="date">`, les `<select>`, les cases a cocher, le curseur de
texte et la selection restent dans l'autre famille : des morceaux de systeme clairs poses sur un
bureau sombre, qu'aucune regle de CSS ne rattrape.

### LA FEUILLE EST LIEE, PAS CHARGEE A LA DEMANDE

Les trois autres feuilles du bureau sont posees par `bdv-nav.js` au premier clic sur leur piece,
et c'est le bon reglage pour elles. **Un theme, lui, arrive toujours trop tard s'il arrive apres
le premier rendu** : la page se peint en clair puis bascule en sombre sous les yeux du vigneron,
et ce clignotement n'a aucun correctif apres coup. La feuille est donc liee, tot, et un script
en ligne de mille octets, **avant toute feuille**, pose `data-theme` sur la racine avant le
premier rendu. Il ne dessine rien et ne lit rien d'autre que le choix memorise.

Trois etats et pas deux : `"light"`, `"dark"`, et la cle ABSENTE, qui veut dire « comme mon
telephone » et qui est le defaut. **Ne pas introduire un `data-theme="auto"`** : ce serait un
troisieme cas a traiter dans chaque selecteur de la feuille, alors que l'absence se traite toute
seule par le bloc `@media`.

### LA CLE DE THEME NE COMMENCE PAS PAR `bdv_`, ET C'EST MESURE

`bureau_theme_v1`, sur le modele de `bureau_prenom` qui vit deja hors du prefixe.

Le reflexe etait `bdv_theme_v1`, parce que ce fichier dit que ce prefixe est ce qui fait partir
une cle a la deconnexion et au changement de compte. **C'est vrai, et c'est precisement pour ca
qu'il ne faut pas le prendre ici.** `viderLePoste()` balaie par prefixe toute cle `bdv_` de
`localStorage` ET de `sessionStorage`, et `oublierCetAppareil()` l'appelle sans liste `garder`.

Un choix de theme efface a chaque deconnexion est un DEFAUT, pas une protection : le vigneron
qui a choisi le sombre le reperd a chaque fois, et sur un telephone regle en clair il retrouve
un bureau blanc sans comprendre pourquoi. Un theme est un confort d'AFFICHAGE : il n'a rien a
reveler a la personne suivante qui ouvre ce navigateur. **Ne pas la renommer « par coherence »
avec le reste** : ce serait la faire effacer a chaque deconnexion, sans erreur et sans que
personne ne sache pourquoi son reglage ne tient pas.

Le lot du socle n'ecrit AUCUN bouton de bascule. Il expose `BdvTheme.poser(choix)`, avec
`poser('light')`, `poser('dark')` et `poser(null)` pour revenir au reglage du telephone : la
fonction ecrit la cle et repose l'attribut, dans cet ordre, pour qu'un seul appel suffise.

### CE QUE LE CONTROLE DE PARITE ATTRAPE, SECTION 4 DE `npm run banc:jetons`

**Un jeton defini en clair et oublie en sombre, c'est du TEXTE INVISIBLE.** Aucune erreur, le
CSS reste valide, la page se peint : une encre reste `#16181C` sur un fond passe a `#0B0C0E`. Et
ca n'arrive QUE chez celui qui a le mauvais reglage, donc jamais chez celui qui developpe si son
systeme est en clair.

Le banc echoue si :

a. une MATIERE du bloc clair n'est pas retournee dans les DEUX blocs sombres, ou si une ECHELLE
   l'est dans l'un d'eux ;
b. un jeton nait dans un bloc sombre sans exister en clair ;
c. les deux blocs sombres divergent, sur un nom ou sur une valeur.

**LE POINT (c) EST LE PLUS IMPORTANT, et c'est le defaut classique de tout produit a deux
themes** : on corrige une couleur dans le bloc `@media` et on oublie le bloc `[data-theme]`. La
couleur est alors juste pour qui suit son telephone et fausse pour qui a clique sur le bouton.
Personne ne le voit, parce que les deux chemins menent au meme mot « sombre » et qu'on n'en
essaie qu'un.

**LE POINT (a) NE DIT PAS « TOUT JETON DU CLAIR SE RETROUVE EN SOMBRE », ET C'EST VOULU.** Ce
serait faux : cinquante jetons en clair, trente en sombre, les vingt autres etant les ECHELLES.
Elles sont identiques dans les deux themes par decision, **un theme change des couleurs, il ne
change ni le rythme ni la taille du texte**, et un controle faux des son premier jour se
contourne au lieu de se lire. La regle est donc dans la VALEUR et jamais dans une liste de noms
tenue a la main, qui se perimerait au premier jeton ajoute : une longueur, une duree ou une
courbe est une echelle et ne se retourne nulle part ; tout le reste est une matiere et se
retourne dans les deux blocs. Le controle attrape donc aussi le cas inverse, un theme qui se
mettrait a changer le rythme.

Verifie en remettant le defaut, comme le veut la regle du depot. Une matiere retiree d'un seul
bloc sombre fait **2 echecs** (a et c), des deux blocs **1**, une echelle retournee **1**, un
jeton ne naissant qu'en sombre **2** (un par bloc), une valeur divergente **1**, et la
suppression entiere d'un bloc **1**.

### ET LE GARDE-FOU A DU APPRENDRE A LIRE LA NOUVELLE FORME, AVANT ELLE

`scripts/charte.mjs` ne connaissait qu'une ecriture de la racine, `:root` tout seul. Aucun des
trois blocs n'a cette forme, et il faisait **deux fautes silencieuses a la fois** :

1. **il criait sur du sain** : la section 4 dispense `:root` de la regle « aucune couleur en
   dur », donc les trente couleurs des deux blocs sombres auraient fait trente ECHEC sur une
   feuille conforme. Un controle qui crie sur du sain finit par ne plus etre lu ;
2. **il sortait le jeu entier du perimetre** : un selecteur qui n'est pas `:root` voit ses
   variables rangees en « declarees sur un composant, donc hors charte ».

Deux reconnaisseurs les separent, et la distinction n'est pas cosmetique. `estRacineBase`
reconnait la SOURCE a son `:root` **nu** dans la liste de selecteurs ; `estRacineTheme` reconnait
un RETOURNEMENT a sa condition. **Seule la source sert de reference aux contrastes de la
section 6** : ranger les trois blocs ensemble ferait mesurer le theme SOMBRE, puisqu'il est ecrit
en dernier, c'est-a-dire mesurer le theme que personne n'a demande.

`banc-jetons.mjs` a recu la meme lecon a l'envers : sa recherche accepte maintenant une LISTE de
selecteurs apres `:root`, **mais toujours pas** `:root[...]` ni `:root:not(...)`. Sinon chaque
couleur du theme serait « servie avec deux valeurs differentes » et sa section 1 crierait trente
fois. Ce qui est servi par defaut, c'est le clair.

**Et `bdv-theme.css` est nommee A LA MAIN dans `charte.mjs`**, comme les trois feuilles chargees
en JavaScript, bien qu'elle soit LIEE dans le HTML : le jour ou le `<link>` demenage, elle
resterait dans le perimetre au lieu d'en sortir en silence. Le dedoublonnage pose avec elle n'est
pas du zele : lue deux fois, une feuille verrait toutes ses declarations comptees en double, donc
le plafond de la section 4 et les echelles fermees de la section A mesureraient du vide.

### `tokens.css` PORTE LES DEUX VALEURS, ET LA FORME EST IMPOSEE PAR LE BANC

La DECLARATION porte la valeur CLAIRE, le commentaire a cote porte la SOMBRE. Ce n'est pas de la
mise en page : `banc:jetons` compare la declaration de la doctrine a ce qui est SERVI, et ce qui
est servi par defaut c'est le clair. Mettre la valeur sombre en declaration ferait mentir la
doctrine sur ce que le navigateur recoit. La parite des deux valeurs est gardee ailleurs, par la
section 4 du meme banc.

### NOTE D'ENVIRONNEMENT : `npm run build` NE PEUT PAS ABOUTIR DEPUIS LA SESSION

**CE N'EST PLUS VRAI AU 21/09/2026.** La construction aboutit depuis la session, `unlink`
compris : `[js] non publie : 60 Ko que personne ne charge` s'affiche, et `npm run verif` passe
en entier, par paquets. Ce qui suit est garde parce que la panne peut revenir avec le pont, et
parce que le symptome qu'elle produit (un `banc:poids` qui deborde sans que le bureau ait
grossi) se diagnostique en trente secondes quand on l'a deja lu.

Le crochet `eleventy.after` de `.eleventy.js` fait un `unlink` sur `_site/js/bdv-courrier.js` et
`_site/js/bdv-ics.js`, les deux fichiers qu'on ne publie pas. **Le pont reseau qui monte le
depot interdit la suppression de fichiers** (meme contrainte que celle deja documentee pour
`.git/index.lock`). La construction echoue donc en EPERM, apres avoir ecrit toutes les pages et
recopie `src/css` et `src/js`.

Consequence pratique, et il faut la connaitre avant de conclure a une regression : depuis la
session, `npm run verif` s'arrete a sa premiere etape, et les trente-six autres se lancent UNE
PAR UNE, sans tuyau. Deux d'entre elles lisent `_site/js/` et voient donc des fichiers non
degraisses : `npm run banc:poids` compte alors environ 33 ko de commentaires en trop dans
`bdv-nav.js` et depasse son plafond. **Ce n'est pas le poids du bureau, c'est le crochet qui n'a
pas pu tourner.** Sur le Mac de Ted, ou l'unlink est permis, la chaine entiere passe.

## LE DESSIN DE LA COQUE DU BUREAU, ET IL EST SCOPE, 21/09/2026

Lot 2 des deux themes. Le lot du matin avait pose cinquante jetons `--bdv-*` sans qu'aucune
regle ne les lise ; celui-ci est le premier a DESSINER. Il ne traite que la COQUE : le fond de
page, l'en-tete, la barre des pieces, la grille de l'atelier, les primitives partagees et le
bouton de bascule. **Le contenu des pieces garde son dessin actuel et sera donc incoherent avec
la coque tant que le lot suivant n'est pas ecrit. C'est assume, et les deux lots ne se poussent
qu'ensemble.**

### LA DECISION QUI COMMANDE TOUT : LE NOUVEAU DESSIN EST SCOPE

`.zone`, `.postit` et `.lettre` **ne sont pas des classes du bureau**. Ce sont aussi celles de
`src/_includes/components/demo-pinboard.njk`, la demonstration de la page d'accueil, et c'est
une regle ecrite ici depuis le 12/09/2026 : « quand une page du site montre le produit, elle
montre les VRAIS composants du bureau, avec leurs vraies classes », parce qu'une maquette
recopiee derive du produit des la premiere semaine.

Repeindre ces classes sans scope aurait donc repeint **la page d'accueil du site public**, qui
n'a pas de theme sombre et n'en veut pas. Arbitrage de Ted : **on scope maintenant, on rouvrira
la question quand les neuf pieces seront finies.**

Concretement :

- tout le nouveau dessin vit dans une feuille NOUVELLE, `src/css/bdv-bureau.css` ;
- **`src/css/style.css` n'est pas touchee, pas une ligne.** C'est ce qui rend ce lot sans risque
  pour le site public et pour la demonstration. Les matieres du plateau (liege, ardoise, papier
  a picots, carton kraft) ne sont pas supprimees, elles sont RECOUVERTES sous le scope ;
- le scope est **`.bdv-coque`, pose sur le corps de page** par le meme drapeau de front matter
  `theme_bureau` qui lie deja `bdv-theme.css`. La classe ne peut donc pas arriver sans sa
  feuille, ni la feuille sans sa classe, et une passe de `sed` sur `.bdv-coque` suffit a
  debrancher le dessin le jour ou on le decidera.

**PAS `.bdv-poste`, ET C'EST LA SEULE ERREUR EVIDENTE A NE PAS FAIRE.** Cette classe depend de
l'etat de SESSION : le bureau deconnecte la perd, et sa porte (« Ton bureau t'attend ») doit
suivre le meme dessin que le reste, sinon le vigneron change de produit en se connectant.

**LE CONTROLE EXISTE, section 10 bis de `npm run charte --bureau`**, ecrite sur le modele exact
de la section 10 qui garde `.bdv-ventes` depuis le 07/09/2026. Une seule regle qui sort de son
scope repeint l'accueil, ne leve rien, et ne se voit qu'en allant regarder l'accueil. Elle
n'exige pas que le selecteur COMMENCE par `.bdv-coque` mais que son PREMIER COMPOSE la porte :
`body.bdv-coque` et `body.bdv-poste.bdv-coque` sont justes et utiles, la seconde parce que la
barre basse a besoin de l'etat de session en plus du scope.

### L'EN-TETE PASSE DE 209 A 56 px, ET IL DEPLACE AU LIEU DE TASSER

La mesure du 18/09/2026 tenait toujours : **209 px de bandeau, 30 % du premier ecran d'un
1440 x 900 avant la premiere chose utile.** Ce soir-la le resserrement avait ete refuse par Ted
(« c'est un foutoir pas possible », puis « c'etait mieux avant »), et il avait raison : on avait
TOUT garde en le tassant sur deux lignes.

La maquette validee le 21/09 ne tasse rien, **elle deplace**. L'en-tete ne porte plus que ce qui
vaut pour les neuf pieces : le nom de la piece, la date, l'etat, les actions. Mesure apres :
**56 px**, plus le filet, sur les deux themes et aux deux largeurs.

**OU SONT PASSES LE SALUT, LA PLAQUE ET LA LUNE.** Ils sont descendus dans « Ma journee », dans
`.bureau-accueil`, en tete du plan. Un « Bonjour Teddy » et une phase de lune au-dessus de
« Mon registre » sont du decor ; au-dessus de la journee, c'est le sujet. Ils disparaissent donc
avec la piece quand on en ouvre une autre, et c'est `seule()` qui s'en charge, sans une ligne de
plus. **LE RESUME, LUI, RESTE DANS L'EN-TETE** : « 3 clients a rappeler, une echeance dans
5 jours » est un ETAT, et un etat se lit dans toutes les pieces.

**`.bureau-accueil` N'EST PAS UNE `.zone` ET NE DOIT PAS LE DEVENIR.** `npm run banc` controle
l'ordre des huit zones par `#bureauJournee > .zone`, et cet ordre est celui que Ted a dicte le
07/09/2026 : lui donner la classe ferait entrer un neuvieme nom dans cette liste. Il porte
`grid-column: 1 / -1`, la regle du 14/09/2026 pour tout bloc pose au-dessus des pieces.

**LE NOM DE LA PIECE EST LE `h1` DE LA PAGE**, et il s'ecrit a UN seul endroit,
`marquerActif()` dans `src/js/bdv-nav.js`, la fonction qui marque deja la barre. Deux endroits
qui repondent « ou suis-je » divergeraient au premier renommage de piece.

**CE QUI N'EST PAS DANS L'EN-TETE : l'ETAT DE SYNCHRONISATION.** La maquette le montre (« A
jour, il y a 4 min ») ; le depot n'a aucune source qui reponde a cette question, et un point vert
qui ne lit rien est un temoin qui ment. A rouvrir avec le lot qui portera la source.

### LE BOUTON DE BASCULE : TROIS ETATS ET PAS DEUX

44 x 44, dans l'en-tete, branche sur `window.BdvTheme` pose par le socle du matin. Le cycle est
**auto, clair, sombre, auto** : « comme mon telephone » est le DEFAUT, il ne pose aucun attribut,
et **le bouton doit pouvoir y revenir**. Un bouton a deux positions enferme pour toujours celui
qui a clique une fois : son bureau resterait clair la nuit parce qu'il a essaye le clair un
matin, et rien a l'ecran ne dirait que le reglage du systeme n'est plus suivi.

- **L'`aria-label` dit l'etat ET ce que fera le prochain appui.** Un dessin de lune ne s'entend
  pas, et un bouton qui ne dit que son etat oblige a appuyer pour savoir ou l'on va.
- **`data-etat` porte le glyphe visible**, en CSS. Un seul attribut pilote les deux.
- **On ne lit PAS `prefers-color-scheme` dans le bouton** : il dit ce qu'il COMMANDE. En mode
  « comme mon telephone », ce qui s'affiche depend du systeme, et l'annoncer obligerait a ecouter
  le media pour reecrire une etiquette qui apprendrait au vigneron ce qu'il sait deja.

### `color-scheme` EST ALLUME, ET IL ATTENDAIT EXACTEMENT CA

`html{ color-scheme: var(--bdv-schema) }` dormait en commentaire dans `bdv-theme.css` depuis le
matin, avec sa raison : l'allumer avant le decor aurait donne un bureau creme avec des morceaux
de systeme sombres poses dessus. Le decor existe, la ligne est posee. Elle n'a pas besoin de
scope : la feuille qui la porte n'est liee que par `theme_bureau`, donc le site public ne la
charge jamais. **La poser sur le corps de page ne marcherait pas** : la barre de defilement se
peint au niveau du DOCUMENT, c'est-a-dire exactement le morceau que le CSS ne rattrape pas.

**VERIFIE A LA CAPTURE, champ natif par champ natif, dans les deux themes** : les deux
`<input type="date">` de « Mes taches » (fond `#131519`, texte `#F3F4F6`, selecteur de date
sombre en sombre ; blanc et encre en clair), le champ de saisie de tache, la barre de defilement
du document, celle de la barre des pieces, le curseur de texte et la selection. Tous suivent, et
tous restent a 16 px et 44 px.

### LES CINQ JETONS AJOUTES SONT DES ECHELLES, DONC DANS LE BLOC CLAIR SEULEMENT

`--bdv-ls-etiq`, `--bdv-ls-serre`, `--bdv-cible`, `--bdv-h-tete`, `--bdv-rail`. Chacun existe
parce qu'une regle les ecrivait en dur. **Ils ne se retournent dans AUCUN bloc sombre**, et ce
n'est pas un oubli : la section 4 de `npm run banc:jetons` echoue si une longueur apparait dans
un bloc sombre. Un theme change des couleurs, il ne change ni le rythme ni la taille du texte.

### CE QUE LA CAPTURE A TROUVE ET QUE LES BANCS AVAIENT VALIDE

Sixieme fois que la meme lecon se paie : **la mesure trouve ce qu'on ne voit pas, la capture voit
ce qu'on ne mesure pas.** `charte`, `charte:bureau`, `banc`, `banc:jetons` et `banc:poids`
etaient VERTS sur les quatre defauts suivants.

1. **L'en-tete faisait 139 px avec un `min-height: 56px` parfaitement respecte.** `style.css`
   empile les deux boutons d'action EN COLONNE depuis le 08/09/2026, et je n'avais reecrit que
   `display` et `align-items`. **Une propriete qu'on ne reecrit pas reste celle de la cascade**,
   et c'est la faute la plus banale d'une feuille qui en recouvre une autre : on remplace ce
   qu'on voit dans sa propre regle, pas ce que porte celle d'en face.
2. **Le bouton de bascule montrait ses TROIS glyphes a la fois.**
   `.bdv-coque .bdv-bascule svg{display:block}` pese (0,2,1) contre (0,2,0) pour
   `.bdv-coque .bdv-bascule__g{display:none}` : le selecteur le plus GENERAL gagnait parce qu'il
   portait un nom d'element en plus. La regle de confort a ete supprimee.
3. **La largeur du rail s'appliquait aussi sur telephone.** `.bdv-coque .bureau-atelier` n'etait
   pas dans une requete de media, donc elle battait la regle de `style.css` qui passe l'atelier a
   une seule colonne sous 900 px : le travail tombait a 182 px dans une fenetre de 390, et les
   douze colonnes du plan mesuraient ZERO. **La regle etait juste, son perimetre non**, et aucun
   banc ne mesure une largeur.
4. **Les deux boutons de l'en-tete sortaient du cadre a 390 px, sans faire defiler la page**,
   donc sans se voir. L'en-tete du telephone est desormais une grille : le nom de la piece et la
   date empiles a gauche, les actions a droite, comme `.tel__ent` dans la maquette. « Mes
   reglages » y est masque, parce que c'est **deja la neuvieme cellule de la barre du bas** ;
   « Me deconnecter » reste, parce que c'est la seule facon de fermer sa session.

### ET UN VOILE N'EST PAS UN FOND : LA SECTION 6 BIS A ETE CORRIGEE

Elle mesurait `--bdv-encre-1` sur `--bdv-survol`, qui vaut `rgba(22,24,28,.05)`, et rendait
**1,00:1 sur une rangee qui tient 14,08:1 a l'ecran** : `ratio()` compose bien l'encre sur le
fond, mais il prend le fond pour opaque. Un fond translucide ne se mesure pas seul, ce qui porte
les lettres est la surface qui est DESSOUS, et seule la cascade sait laquelle. Ces paires sont
donc rangees dans les insolubles **et NOMMEES une par une**, avec la regle : une paire posee sur
un voile se mesure a la main contre la surface reelle. Les deux du depot l'ont ete, 14,08:1 et
11,0:1 au pire cas.

### CE QUI RESTE OUVERT, ET QUI N'EST PAS FAIT

- **Le contenu des pieces.** ~~Panneau de liege, post-it, sous-main, ardoise, calendrier, les
  cinq ecrans de vente, le panneau de reglages et la modale gardent leur dessin papier.~~
  **FERME EN PARTIE LE MEME JOUR, AU LOT 3** (section suivante) : « Ma journee », « Mes taches »
  et « Le calendrier » sont repeints. Restent en papier les cinq ecrans de vente
  (`bdv-ecrans.css`), le panneau de reglages (`bdv-panneau.css`), la fiche client et la modale de
  tache. En SOMBRE, ceux-la posent encore de l'encre foncee sur des cartes sombres.
- **Les pastilles de compte du rail.** La maquette en montre ; `PIECES` dans `bdv-nav.js` ne
  porte aucun compte, et en inventer un est du contenu. Aucune regle n'a ete ecrite pour elles :
  une regle dont aucune page ne porte la classe est du poids mort, et la section C de
  `npm run charte` la compte a l'octet.
- **Les libelles sous les icones de la barre basse.** La maquette en montre parce qu'elle ecrit
  « Journee » et « Dates » ; le depot ecrit « Ma journee » et « Le calendrier », et la regle du
  11/09/2026 tient toujours : une etiquette coupee est pire qu'une etiquette absente. Donner des
  noms courts aux pieces est un changement de `PIECES`, donc du contenu.
- **Le squelette de chargement.** Pas de regle ecrite, meme raison que les pastilles : il n'y a
  aucun etat de chargement dans le balisage de la coque a quoi l'accrocher.
- **L'etat de synchronisation dans l'en-tete** (voir plus haut).

## LE CONTENU DES TROIS PIECES SANS VITISOFT, 21/09/2026

Lot 3 des deux themes, et celui qui ferme le defaut annonce par le lot 2 : **en sombre, le
contenu des pieces posait de l'encre foncee sur des cartes sombres et ne se lisait pas.**
Perimetre : « Ma journee » et ses huit zones, « Mes taches », « Le calendrier ». Les cinq
ecrans de vente, le panneau de reglages, la fiche client et la modale de tache gardent leur
dessin papier et viennent au lot suivant.

**TOUT EST DANS `src/css/bdv-bureau.css`, SOUS LE MEME SCOPE `.bdv-coque`, ET
`src/css/style.css` N'A PAS BOUGE D'UNE LIGNE.** Meme arbitrage que le lot 2 : `.zone`,
`.postit` et `.lettre` sont aussi les classes de la demonstration de la page d'accueil.

### CE QUE CHAQUE ZONE DEVIENT

- **Le panneau** : une pile de rangees separees par un filet, plus un tableau de liege.
  `data-mot`, pose par `src/mon-bureau.njk` depuis le 10/09/2026, decide de la mise en page :
  **sans lui la ligne de tete est un CHIFFRE**, elle part dans la colonne de gauche a 28 px et
  le libelle prend la colonne du texte ; **avec lui c'est un TITRE**, il reste dans la colonne
  du texte a 17 px avec son tampon au-dessus. La regle des deux natures (« a un seul on nomme,
  a plusieurs on compte ») n'est pas seulement gardee, elle devient visible.
- **Le sous-main** : un tableau propre. Rangee de 44 px, separateur de 1 px, survol a 5 %,
  actions revelees a droite, nombres en chiffres tabulaires. Les picots, les bandes alternees
  et l'ombre de carte partent.
- **Le bloc calendrier** : l'objet a effeuiller devient un delai en grand, un titre, et trois
  lignes dessous.
- **L'ardoise** : quatre nombres nus, chacun avec son libelle en capitales et sa provenance. La
  regle « un chiffre affiche dit toujours d'ou il vient » ne bouge pas.
- **Le mot du jour** : une carte neutre. Le fond teinte par gravite part ; le signe garde sa
  forme et prend un cadre, et c'est lui plus le hors-ecran qui portent l'etat.
- **A lire / Le classeur / Le courrier** : la pile, les dos de carton et l'enveloppe dechiree
  partent, les lignes passent au corps de 13 px. Mesure avant/apres, meme decor, 1440 x 900 :
  206 -> 185, 225 -> 202, 349 -> 317 px. **La fusion en une seule zone, que montre la maquette,
  n'a PAS ete faite** : elle ferait passer les huit `.zone` de `#bureauJournee` a six, et cette
  liste de huit noms est l'ordre que Ted a dicte, controle par `npm run banc`. C'est une
  decision de contenu.
- **Mes taches** : les six filtres deviennent des chips, les deux listes des rangees a filet.
- **Le calendrier** : barre, selecteur segmente a trois vues, grille du mois, douze mini-mois,
  fiches de la liste.

**L'ORDRE DES HUIT ZONES N'A PAS CHANGE ET LE BANC NON PLUS.** Il est deja celui de la
maquette : ce qui presse en haut, les chiffres plus bas.

### LES QUATRE JETONS AJOUTES SONT DES MATIERES, DONC DANS LES TROIS BLOCS

`--bdv-fam-1` a `--bdv-fam-4`, les familles du calendrier. **Ils DOUBLENT `--fam-1..4` de
`tokens.css` au lieu de les reutiliser, et ce n'est pas du rangement** : `--fam-1` vaut
#4A1220, L* 15,4 ; il tient 13,09:1 sur le papier du site et **1,26:1 sur `--bdv-surface` en
sombre**, c'est-a-dire qu'il disparait. Le calendrier public de `/outils/echeances/` n'a qu'un
theme et garde les siens ; celui du bureau en a deux. Meme rapport que `--serie-*` et
`--fam-*` entre eux : deux metiers, deux echelles.

Ils sont **separes en LUMINANCE** et pas en teinte, la regle de la charte : L* 15,4 / 32,4 /
44,3 / 56,1 en clair, 84,9 / 72,1 / 59,5 / 49,9 en sombre. L'echelle s'inverse avec le fond,
l'ecart reste d'une douzaine de points. Ce sont des OBJETS graphiques, un filet de 3 px et une
pastille de 6 px, jamais du texte : le seuil est 3:1, le pire cas tient 3,15:1 en clair et
3,42:1 en sombre.

### CE QUE LA SECTION A DE `npm run charte` A REFUSE, ET CE QU'ELLE A FAIT ECRIRE

Les cinq familles d'echelles fermees etaient **exactement a leur borne** avant ce lot : 35
tailles, 0 rayon, 20 ombres, 9 epaisseurs de filet, 8 z-index. Une valeur de plus dans l'une
d'elles fait echouer le banc, et c'est voulu.

Consequence concrete, et elle a change le dessin : **les trois `box-shadow: inset` que ce lot
allait poser (l'anneau d'une pastille faite, les deux soulignements de la vue annee) auraient
ete la 21e, 22e et 23e recette d'ombre du bureau.** Elles sont donc ecrites en BORDURE, qui
dessine exactement le meme trait de 2 px sans rien ajouter a aucune echelle. **Un plafond qui
mord change le code avant d'echouer** : c'est tout ce qu'on lui demande.

### L'AUDIT DE CONTRASTE A L'ECRAN, ET POURQUOI LA FEUILLE NE POUVAIT PAS LE FAIRE

**SEPTIEME FOIS QUE LA MEME LECON SE PAIE.** `npm run charte` section 6 bis etait VERTE sur
vingt-trois paires illisibles, et elle avait raison de l'etre : elle ne regarde qu'une regle
qui pose a la fois une encre ET un fond. Aucune de ces vingt-trois ne le fait. Ce sont des
encres de `style.css` posees sur des fonds de `bdv-bureau.css`, ce qu'aucun controle de
feuille ne peut composer : il faudrait rejouer la cascade, c'est-a-dire etre un navigateur.

L'outil qui les a trouvees parcourt le RENDU de `.bureau-atelier`, remonte au premier fond
OPAQUE en composant les voiles au passage, et rend toute paire sous son seuil. Douze passages,
trois pieces par theme et par largeur : **27 paires au premier, zero au dernier.** Les quatre
qui manquent a l'appel etaient des pastilles de 6 px a `font-size: 0`, un faux positif ferme
par un plancher de 4 px.

Les cinq familles de defaut qu'il a sorties, et aucune ne se voyait a la lecture :

1. **`a { color: var(--bordeaux) }`, ligne 290 de `style.css`**, sur les trois liens du bureau
   qui n'ont pas de classe : 1,37:1. Le perimetre du correctif est
   `.bureau-atelier a:not([class])`, parce que tout lien qui porte une classe a deja sa regle.
2. **`body.bdv-poste .panneau .postit[data-ton]` pese (0,4,1) contre mes (0,4,0)** : un nom
   d'ELEMENT de plus, donc la punaise gardait son papier sur telephone, et un nom de client y
   passait a 1,03:1. **Meme famille que `flex-direction` au lot 2 : une regle d'en face qu'on
   n'a pas lue en entier.**
3. **La bande alternee du listing est ecrite DEUX fois**, sur la cellule pour le tableau et sur
   la RANGEE dans `@container sousmain (max-width: 40rem)`. Corriger la premiere laissait la
   seconde, donc une fiche sur deux illisible, et seulement sur telephone.
4. **Les cinquieme et sixieme familles du calendrier** etaient dessinees en `--ink` : leur
   intitule disparaissait de la grille. Elles gardent leur filet pointille et leur combine, qui
   sont ce qui les distingue sans couleur ; **elles perdent la main courante**, derniere
   metaphore materielle des trois pieces, et qui se devinait plus qu'elle ne se lisait.
5. **Les anneaux de focus du calendrier** etaient en bordeaux : 1,37:1 sur une case sombre,
   c'est-a-dire un focus clavier qui n'existe plus.

**ET LE CORRECTIF DU POINT 4 EN A FABRIQUE UN AUTRE**, trouve par le meme audit au passage
suivant : en donnant une taille aux occurrences ecrites a la main, il battait le `font-size: 0`
de la pastille du telephone, qui reprenait donc son texte a 12 px dans un point de 6 px.
**Un audit qu'on ne rejoue pas apres correction ne mesure que l'etat d'avant.**

### CE QUE L'OEIL A TROUVE ET QUE L'AUDIT NE POUVAIT PAS TROUVER

L'audit ne juge que du TEXTE. Trois defauts de ce lot n'en etaient pas :

1. **La quatrieme case vide de l'ardoise.** `repeat(4, 1fr)` laissait un rectangle de 180 px
   qui montrait le fond de la grille : il n'y a quatre chiffres que si `objectifPct` ou
   `atterrissage` est arrive dans le miroir. L'ancien dessin avait le meme trou, invisible
   parce que la case vide etait de la couleur de l'ardoise. `auto-fit` replie les pistes vides.
2. **Le soulignement de la vue annee**, en `--bdv-trait-fort`, 1,64:1. Dans cette vue il n'y a
   aucun intitule : ce trait est la SEULE chose qui dise qu'une periode passe par ce jour-la,
   donc c'est un objet graphique porteur d'information et son seuil est 3:1.
3. **Les actions cachees au repos sur telephone.** `@media (hover:hover) and (pointer:fine)` ne
   suffit pas : une fenetre d'ordinateur reduite a 390 px a une souris ET prend la mise en page
   du telephone, ou `style.css` remonte les gestes sur la premiere ligne. **Le perimetre etait
   la largeur, pas le pointeur.**

### LE POIDS MORT, ET IL FAUT L'ASSUMER

Rien n'a ete supprime de `style.css`. **22 115 octets de regles de dessin papier y restent, et
dans `bdv-calendrier.css`, entierement recouvertes sous `.bdv-coque`** (21 268 + 847, mesure
sur les 31 classes de composant que ce lot repeint). Servi au navigateur, apres minification :
`bdv-bureau.css` passe de 13 111 a 46 189 octets, `bdv-theme.css` de 2 774 a 3 014, et
`style.css` ne bouge pas, soit **+33 318 octets** pour `/mon-bureau/`.

Les deux compteurs de la section C de `npm run charte` ne bougent pas et c'est normal : C1
compte les regles dont AUCUNE classe n'existe nulle part (5 080 octets, a la borne), et le
thermometre 2 compte ce qui ne peut servir QU'au site public (56,9 ko). Une regle recouverte
n'est ni l'une ni l'autre : sa classe existe, et elle s'applique encore, elle est simplement
battue. ~~**La scission de `style.css` reste le chantier qui reglera ca, et ce lot l'a rendue
plus urgente, pas moins.**~~
**FAITE LE 21/09/2026, ET ELLE NE REGLE PAS CA.** Voir « LA FEUILLE DU SITE EST SCINDEE EN
DEUX » : les 22 115 octets recouverts sont des regles que la demonstration de l'accueil utilise,
donc elles sont restees du cote PUBLIC, et le bureau continue de les recouvrir. Ce que la
scission a sorti, ce sont les 74 105 octets que le bureau seul pouvait servir et que les douze
pages plates portaient. Les deux poids morts sont distincts, et il ne faut pas les confondre :
celui-ci se reglera le jour ou la demonstration cessera d'utiliser les vrais composants, ou le
jour ou elle les utilisera sous son propre scope.

### CE QUI RESTE OUVERT

- ~~**Les cinq ecrans de vente, le panneau de reglages, la fiche client et la modale de tache.**
  Toujours en papier, donc toujours mal lisibles en sombre. C'est le lot suivant.~~
  **FERME EN PARTIE LE MEME JOUR, AU LOT 4** (section suivante) : les cinq ecrans de vente et la
  fiche client sont repeints. Restent en papier le panneau de reglages (`bdv-panneau.css`) et la
  modale de tache.
- **La fusion des trois zones de lecture** en une bande « Ta lecture », que montre la maquette.
  Decision de contenu : elle change la liste des huit zones que `npm run banc` garde.
- **Le vide sous le sous-main.** `.bureau-plan` porte `align-items: start`, donc la carte du
  sous-main s'arrete a sa hauteur pendant que le bloc calendrier, a sa droite, descend plus
  bas. C'est le comportement d'avant, il se voit plus maintenant que les cartes ont un fond
  uni. A trancher avec Ted : etirer les deux, ou laisser.
- **La coche de « Mes taches » sur telephone.** `style.css` porte sa cible a 44 px par un
  retrait de 12 px et `background-clip: content-box` ; la BORDURE, elle, reste dessinee sur la
  boite entiere, donc le carre fait 44 px a l'ecran au lieu de 20. Defaut anterieur a ce lot,
  signale et non corrige : le reparer demande de deplacer la cible sur un pseudo-element, ce
  qui est une reecriture de la coche.
- **Le bouton « Lune et feries »** porte `.filtfam` sans `data-fam`, donc le liseré de la
  premiere famille. Il n'est pas une famille. Anterieur a ce lot.

## LES CINQ ECRANS DE VENTE ET LA FICHE CLIENT, 21/09/2026

Lot 4 des deux themes. Il ferme le defaut annonce par le lot 3 : **le bouton de bascule est
livre, donc un vigneron qui passe en sombre trouvait « Mon commerce », « Mon cap », « Mes
cuvees » et « Mon registre » illisibles.** Perimetre : `src/css/bdv-ecrans.css` et ce qu'elle
habille, les cinq ecrans de vente, la fiche client, les graphiques, les tableaux, le bandeau
`#status` et le voile `#busyov`.

### ON MODIFIE LA FEUILLE EN PLACE, ET C'EST LA DIFFERENCE AVEC LES LOTS 2 ET 3

Aux deux lots precedents il fallait RECOUVRIR `style.css` dans une feuille a part, parce que
`.zone`, `.postit` et `.lettre` sont aussi les classes de la demonstration de la page d'accueil.
**Ici, non.** `.bdv-ventes` n'existe que dans `src/mon-bureau.njk` et
`src/_includes/components/ecrans-vente.njk`, et `bdv-ecrans.css` n'est chargee que par le bureau,
par `bdv-nav.js`. On modifie donc la feuille DIRECTEMENT : on evite le poids mort accumule par
les deux lots precedents, et **on supprime les valeurs papier au lieu de les cacher**.

Mesure : **296 appels a un jeton papier avant, 49 apres**, et les 49 sont tous dans le rapport
imprimable, qui garde le papier expres. La section 10 de `npm run charte --bureau`, qui garde le
scope `.bdv-ventes` depuis le 07/09/2026, reste verte.

### LE `:root` DE `bdv-ecrans.css` A DISPARU, ET C'EST UNE MESURE QUI L'A DECIDE

Il portait 71 jetons. **Soixante etaient la copie mot pour mot du `:root` de `style.css`**, qui
est chargee par le gabarit de base sur toutes les pages, donc aussi sous cette feuille. Ils ne
servaient a rien d'autre qu'a se perimer en silence, ce qui est la mecanique exacte de la derive
que `npm run banc:jetons` attrape depuis le 18/09/2026, et qui avait coute `--ombre-photo`.

Les onze autres n'existaient que la :

    --serie-1 a --serie-8   -> --bdv-serie-1 a --bdv-serie-8 dans bdv-theme.css, DEUX valeurs
    --bordeaux-voile        -> --bdv-aire-accent, idem
    --ok-clair              -> partis. Ils n'existaient que pour le bloc de rythme de
    --danger-clair             « Mon cap », qui etait une carte SOMBRE sur du papier clair.

**Consequence a connaitre avant de relire** : `banc:jetons` ne rend plus aucune note. Il en
rendait une, « 60 jeton(s) redeclare(s) a l'identique dans plusieurs feuilles ». Ne pas remettre
un `:root` ici « pour que la feuille reste lisible seule » : elle n'est lisible que dans le
bureau, et le bureau charge `style.css` et `bdv-theme.css` avant elle.

### LES HUIT SERIES SONT LUES EN JAVASCRIPT, ET LE NOM EST UN CONTRAT

`palSeries()` dans `src/js/bdv-base.js` construit les noms a la main, `'--bdv-serie-'+i`, et
`aireBordeaux()` lit `--bdv-aire-accent`. **C'est le seul endroit du depot ou un jeton de CSS
soit appele par un nom ecrit en JavaScript** : renommer l'un sans l'autre rend une palette vide,
et Chart.js peint alors en noir par defaut, sans une erreur.

`getComputedStyle` est relu a CHAQUE appel, et c'est voulu : c'est ce qui fait qu'un graphique
redessine apres une bascule prend les nouvelles couleurs. **Ne pas mettre ces valeurs en cache
dans une constante de module.**

### LES SERIES SONT SEPAREES EN LUMINANCE, ET L'ORDRE ALTERNE

Elles sont categorielles. Les anciennes etaient dessinees pour du papier et trois tombaient sous
3:1 sur du blanc (`--serie-8` a 1,94:1) ; sur un fond sombre les huit vibraient.

Luminances relatives, dans l'ordre de declaration :

    clair    .022  .160  .045  .208  .075  .250  .115  .290
    sombre   .140  .425  .195  .515  .265  .615  .340  .720

**L'ordre alterne le bas et le haut de l'echelle**, parce que ce qui compte est l'ecart entre
deux series VOISINES dans un graphique. Ecart minimal entre voisines : 1,81 en clair, 1,71 en
sombre ; en vision deuteranope, 1,80 et 1,77. Pire contraste sur la surface qui les porte :
3,09:1 en clair, 3,31:1 en sombre. Ce sont des OBJETS graphiques, jamais du texte, donc 3:1.

**CE QUE CA NE REGLE PAS** : a huit niveaux dans une fenetre de 3:1, deux series NON voisines
peuvent se ressembler, la pire paire quelconque tient 1,13. C'est structurel. Chart.js garde donc
sa legende et ses infobulles : la couleur ne porte jamais seule le nom d'une serie. Et si une
neuvieme teinte devait entrer, **il faudrait rouvrir la fenetre de luminance, pas y glisser une
valeur de plus**.

### UN JETON DE CSS NE TRAVERSE PAS TOUT SEUL JUSQU'A UN GRAPHIQUE

Chart.js recoit des CHAINES de couleur a la construction et les garde. Avant ce lot, un vigneron
qui ouvrait « Mon cap » en clair puis appuyait sur le bouton gardait un graphique aux couleurs
claires au milieu d'un bureau sombre, **sans une erreur, jusqu'au prochain rechargement**.

`BdvTheme.appliquer()` (bloc de tete de `src/_includes/base.njk`) emet desormais `bdv:theme` sur
`document`, et `src/js/bdv-ecrans.js` l'ecoute pour `ecranInvalider()` puis repeindre l'ecran
courant. **DEUX SOURCES ET PAS UNE, et oublier la seconde est le defaut classique :**

1. le BOUTON, par `bdv:theme` ;
2. le REGLAGE DU TELEPHONE, par `matchMedia('(prefers-color-scheme: dark)')`, qui bascule seul au
   coucher du soleil. Sans cette ecoute, le bureau laisse a 21 h les graphiques peints a 18 h.
   On ne l'ecoute QUE si aucun choix n'est memorise dans `bureau_theme_v1`.

Le repeint passe par `requestAnimationFrame` : lire `getComputedStyle` dans le meme tour que la
pose de `data-theme` rend encore les valeurs d'AVANT.

Verifie dans un vrai navigateur en lisant la couleur que Chart.js RECOIT : `#9E2B47` avant,
`#F294A9` apres le bouton, `#F294A9` apres une bascule du systeme sans choix memorise.

### LE RAPPORT IMPRIMABLE GARDE LE PAPIER, ET CE N'EST PAS UN OUBLI

`#printReport` n'est jamais affiche a l'ecran et ne sort que par l'imprimante, et son
`@media print` force les fonds par `print-color-adjust: exact`. Le repeindre en jetons de theme
ferait sortir des pages NOIRES de l'imprimante de tout vigneron qui a choisi le sombre, encre
blanche comprise. **Le papier est le bon medium pour le papier.** Ses 49 appels a un jeton papier
viennent tous du `:root` de `style.css`, toujours chargee.

### `status()` N'A TOUJOURS QUE TROIS TYPES, ET ILS SONT MESURES

error, loading, success. Un quatrieme nom sort un bandeau sans fond ni couleur, et la regle du
19/09/2026 tient : ou le type existe dans la feuille, ou on prend celui qui existe. Paires
mesurees, clair puis sombre : **6,30 et 6,93:1** pour `error`, **13,99 et 9,73:1** pour
`loading`, **5,98 et 8,90:1** pour `success`. Le bandeau porte en plus un filet de 1 px de la
couleur de son etat.

### CE QUE LA CAPTURE A TROUVE, ET QUE TRENTE-SEPT BANCS VERTS N'AVAIENT PAS VU

**HUITIEME FOIS QUE LA MEME LECON SE PAIE.**

1. **La barre « 286 lignes » est restee creme sur un bureau noir.**
   `#bureauVentes .bdv-ventes .topbar` dans `style.css` pese **(1,2,0)** contre **(0,2,0)** pour
   la regle de ce lot : un IDENTIFIANT de plus. C'est mot pour mot la barre d'onglets du lot 2 et
   la punaise du lot 3, **une regle d'en face qu'on n'a pas lue en entier**.
   **SUPPRIMEES, ET PAS CORRIGEES SUR PLACE**, parce que c'etaient des RUSTINES : elles
   ramenaient au papier du bureau la barre bordeaux du tableau de bord d'origine, et
   `bdv-ecrans.css` la peint elle-meme depuis ce lot. Les corriger aurait de plus fait appeler
   un jeton `--bdv-*` depuis `style.css`, que `npm run charte` lit en mode SITE ou
   `bdv-theme.css` n'est pas chargee : **trois « var() sans declaration » sur du sain**, ce qui
   est exactement le genre de controle qu'on finit par ne plus lire. Et le commentaire qui les
   remplace ne les recopie PAS sous leur forme de regle : la section 3 bis de `npm run charte`
   refuse un commentaire qui contient une regle CSS.
2. **Deux couleurs en attribut `style` dans `bdv-ecrans.js`**, les barres de gain et de perte de
   « D'ou vient ta variation ». Elles valaient `--ok` et `--danger` : sur un fond sombre le vert
   tombait a 2,1:1. Elles ne se voient dans AUCUNE feuille, et la section 8 de `npm run charte`
   est le seul controle qui les regarde.
3. **`.kpi--hi` devenait une dalle rose.** `--bdv-accent` est un bordeaux profond en clair et un
   rose pale en sombre : l'aplat qui se lisait comme une action primaire devenait deux grands
   rectangles roses au milieu de « Mon cap ». Elle prend le lavis et garde son filet d'accent.
   C'est aussi la regle du seul accent a trois usages : **un chiffre mis en avant n'en est pas
   une.**

### ET LE HARNAIS S'EST MENTI A LUI-MEME DEUX FOIS

**UNE FOIS SUR LE DECOR, et c'est la cinquieme fois que ce fichier le raconte.**
`scripts/bureau-garni.mjs` pose 286 lignes dans IndexedDB, mais les ecrans de vente ne les
CHARGENT pas depuis l'amorcage leger du 18/09 : ils affichent « tes lignes ne sont pas encore
chargees » et attendent un clic. Les premieres captures montraient cinq ecrans vides, joliment
mis en page. **Le harnais clique desormais sur « Charger mes lignes et completer », et il LEVE si
aucune rangee n'est peinte.**

**UNE FOIS SUR L'ECRAN DE BASE VIDE.** Photographie dans un contexte a base vide, `#p-vide`
sortait SANS SA FEUILLE : sans reseau, l'amorcage ne conclut jamais, `chargerEcrans()` ne pose
donc jamais `bdv-ecrans.css`, et le titre retombait sur le `h1,h2,h3` de `style.css`, en `--ink`.
Ce faux defaut a servi : **le vrai `#p-vide` se regarde dans un bureau GARNI**, en forcant le
panneau affiche et rien d'autre.

### `npm run apercu:fiche` MONTRAIT UNE FICHE SANS COULEURS

Il recopiait `style.css` et `bdv-ecrans.css`, **pas `bdv-theme.css`**. Depuis ce lot la fiche ne
lit plus que des `--bdv-*` : l'apercu aurait montre une fiche dont toutes les `var()` tombent
dans le vide, et il aurait fallu ouvrir la vraie page pour s'en apercevoir. La feuille est
ajoutee, EN PREMIER comme dans le gabarit, et chaque etat est rendu DEUX FOIS cote a cote sous
deux conteneurs qui forcent l'un le clair et l'autre le sombre. C'est exactement ce que la forme
sans `:root` des blocs 1 et 3 de `bdv-theme.css` existe pour permettre.

### L'AUDIT DE CONTRASTE A DEUX RELAIS MAINTENANT

Celui du lot 3 parcourait le rendu et jugeait le TEXTE. Celui-ci ajoute un second relais qui
cherche les valeurs PAPIER encore posees, texte ou non, en comparant la couleur RENDUE a la
table des jetons papier. **C'est ce second relais qui a nomme la barre creme** : aucun calcul de
contraste de texte ne signale un fond qui n'en porte pas. Resultat final, 24 passages, six
ecrans par theme et par largeur : **zero paire sous le seuil, zero valeur papier.**

### LA BORNE DES TAILLES DE TEXTE EST DESCENDUE DE 35 A 32

Section A de `npm run charte --bureau`. Ce lot a repris treize `font-size` en dur dans les pas
`--bdv-f-*`. La regle du depot est qu'une borne DESCEND et ne remonte jamais.

### CE QUI RESTE OUVERT

- ~~**Le panneau de reglages** (`bdv-panneau.css`) et **la modale de tache** sont les DERNIERS
  morceaux de papier du bureau. Et ca se voit : sur une base vide, `openApp()` ouvre le panneau
  par-dessus l'ecran, donc une dalle creme sur un bureau noir.~~
  **FERME LE MEME JOUR, AU LOT 5** (section suivante), avec le voile d'amorcage et la porte de
  compte. Le chantier des deux themes est clos.
- **Les largeurs de colonne en dur** : `7rem` pour la valeur d'une barre de repartition, `9rem`
  pour la premiere colonne d'un tableau sur telephone. Ce sont des mesures de CONTENU, pas des
  pas d'echelle ; leur donner un jeton serait du rangement sans mesure derriere.
- **Le pire contraste d'un graphique tient exactement 3,09:1 en clair**, ce qui est au-dessus du
  seuil et mince.
- **Rien n'annonce toujours qu'un tableau defile** sur telephone, et les libelles restent dans
  des `title`. Anterieur a ce lot, signale le 11/09/2026, non traite.

## LE PANNEAU, LA MODALE, LE VOILE ET LA PORTE, 21/09/2026. LE CHANTIER EST CLOS.

Lot 5 des deux themes, et le dernier. Il ferme le defaut annonce par le lot 4 : **les trois
choses que le bureau pose PAR-DESSUS lui-meme etaient encore en papier, c'est-a-dire les trois
plus visibles.** Le panneau de reglages n'attendait meme pas qu'on le demande : sur une base
vide, `openApp()` l'ouvre tout seul par-dessus l'ecran, donc une dalle creme au milieu d'un
bureau noir, des la premiere ouverture.

Perimetre : le panneau de reglages et ses six onglets, la modale d'une tache, le voile
d'amorcage, la porte de compte. Le voile de calcul `#busyov` etait deja repeint au lot 4, avec
le reste de `bdv-ecrans.css` : verifie, rien a faire.

### LE PANNEAU A DEUX MOITIES, ET IL FAUT LES PRENDRE ENSEMBLE

C'est le piege d'entree de ce lot. Le style du panneau n'est pas dans un fichier, il est dans
**deux** :

1. `src/css/bdv-panneau.css`, 21 ko, les BLOCS du moteur (`.card`, `.kpi`, `.data`, `.btn`,
   `.dropzone`, `.signal`), portes sous `.bdvr-panneau` ;
2. la constante `STYLE` de `src/js/bdv-reglages.js`, le SQUELETTE : le voile, la boite, les six
   onglets, les champs, le pied. Injectee dans `<head>` a l'ouverture.

Repeindre la premiere seule aurait laisse la dalle creme exactement ou elle etait, puisque c'est
la seconde qui porte `background: var(--paper)`. **Les deux vont ensemble, et le commentaire de
tete de chacune renvoie a l'autre.**

### ON MODIFIE EN PLACE, COMME AU LOT 4, ET POUR LA MEME RAISON

`.bdvr-*` et les classes de ses blocs ne vivent que dans le bureau. Le « tableau de bord » n'est
plus une page depuis le lot 2d du 07/09/2026, donc le panneau ne s'ouvre plus que dans
`/mon-bureau/`, la seule page qui porte `theme_bureau`, donc la seule qui charge
`bdv-theme.css`. **Les valeurs papier sont SUPPRIMEES, pas cachees, et le poids mort n'augmente
pas d'un octet.**

Mesure : **75 regles reecrites, 0 appel a un jeton papier restant** dans `bdv-panneau.css` comme
dans le `STYLE` de `bdv-reglages.js`.

L'ancienne regle d'entete des deux fichiers, « n'utiliser QUE les 52 jetons declares dans les
deux `:root` du projet », est **perimee et remplacee** : on n'y ecrit plus que des `--bdv-*`,
plus les cinq `--z-*` de l'echelle des couches. Un jeton papier vu la est desormais une
regression muette, parce qu'il ne se retourne pas.

`bdv-panneau.css` **ne declarait aucun `:root`**, contrairement a `bdv-ecrans.css` : verifie
avant de toucher a quoi que ce soit, rien a supprimer.

### LA MODALE DE TACHE EST DANS `style.css`, DONC ON LA RECOUVRE

Elle est habillee par `src/css/style.css`, lignes 8144 a 8280, sous `.tmod*`. `style.css` sert
la page d'accueil : **on ne la modifie pas**, on la recouvre sous `.bdv-coque` dans la section 18
de `bdv-bureau.css`, exactement comme le lot 3 l'a fait pour le liege et les punaises. Meme
traitement pour le voile d'amorcage (`.bdv-amorce*`, section 19), qui vit la aussi.

**La porte de compte, elle, n'est dans aucune feuille** : `bdv-compte.js` injecte son CSS au
premier appel de `porte()`, et elle s'ouvre AUSSI depuis le site public. Elle garde donc son
papier la-bas et elle est recouverte ici, section 20.

### ET CELLE-LA DEMANDE (0,2,1), PAS (0,2,0)

**C'est la seule difference des trois, et elle aurait tue le bloc entier sans une erreur.** Le
style de la porte est injecte dans `<head>` a l'ouverture, donc APRES `bdv-bureau.css`. A
specificite egale, c'est lui qui gagne. `body.bdv-coque .bdv-porte__x` pese un nom d'element de
plus et passe devant. **Regle generale : un style injecte en JavaScript est toujours plus tard
qu'une feuille du gabarit, et l'egalite ne suffit pas.**

### LE BALAYAGE DE SPECIFICITE A ETE FAIT AVANT LA CAPTURE, ET IL A TROUVE

**Trois lots de suite avaient paye le meme defaut a l'image** : la barre d'onglets du telephone
restee creme, la punaise du panneau restee papier, la barre « 286 lignes » restee creme. Chaque
fois une regle d'en face plus lourde, ou une propriete que la nouvelle regle ne nommait pas.
Aucun banc ne l'a jamais vu.

`Claude outputs/lot5-specificite.mjs` confronte donc les regles de `style.css` qui visent une
classe du panneau ou de la modale a la specificite des nouvelles. **80 regles visent la modale,
16 le panneau.** Ce qu'il a trouve, avant la premiere capture :

1. **`h1,h2,h3,h4{color:var(--ink)}` pese (0,0,1) et gagnait quand meme**, parce que les regles
   de titre de la modale, du voile et de la zone de depot ne nommaient que `font-family` et
   `font-size`. Le titre d'une tache serait reste a #1E2536 sur #21252B, soit **1,05:1**.
   **Aucune mesure de feuille ne pouvait le dire : les deux moities de la paire sont dans deux
   fichiers.** Ferme en NOMMANT `color` partout.
2. **`.btn:hover` de `style.css` pose `transform` et `box-shadow`**, que personne ne nommait :
   les six boutons du panneau avancaient de deux pixels et posaient une ombre dure en encre du
   SITE au survol, y compris sur un bureau sombre, ou #0F1622 sur #131519 est une tache noire
   sans bord. La profondeur du bureau est un trait de 1 px : l'ombre est ANNULEE.
3. **`.bdv-coque .btn{min-height:36px}` de la section 8 battait `.tmod .btn{min-height:44px}`**
   de `style.css` : meme poids, posee plus tard. « ENREGISTRER » et « C'EST FAIT », les deux
   boutons qui ECRIVENT dans la modale, etaient retombes sous le plancher tactile sur telephone
   depuis le lot de la coque. Rendu.
4. **`.bdv-coque tbody td{height:44px}` ne nommait pas `height` cote panneau** : sur telephone,
   ou chaque cellule devient un bloc, une fiche de six cellules faisait 264 px pour six lignes
   de texte.

**Ces quatre-la sont le rendement de dix minutes de balayage.** Le faire avant la capture, et pas
apres, est la seule chose qui change entre ce lot et les trois precedents.

### DEUX DEFAUTS ANCIENS TROUVES EN PASSANT, ET CORRIGES

- **`.kpi--hi` n'avait pas de fond dans le panneau**, et ses deux enfants etaient ecrits en
  `--on-dark-soft`, c'est-a-dire du creme : le libelle et le sous-titre du chiffre mis en avant
  donnaient **1,08:1** sur la carte blanche, sur le papier comme sur le bureau. Le fond venait
  de l'ancien tableau de bord, ou la carte etait bordeaux, et il n'a jamais suivi. Il prend le
  meme dessin que dans les ecrans de vente.
- **Les quatre tons de `.signal` manquaient a `bdv-panneau.css`.** `bdv-base.js` ecrit
  `signal signal--` plus le ton, avec quatre valeurs ; seule la feuille des ecrans de vente les
  declarait. Dans le panneau, le filet de gauche de 4 px restait de la couleur du cadre et les
  quatre gravites se ressemblaient.

### LA ZONE DE DEPOT NE DIT PLUS « TU ES DESSUS » PAR UNE COULEUR

C'est la cible d'un glisser-deposer. Au moment ou le vigneron en a le plus besoin, il a le
curseur, la vignette de fichier et sa main entre l'oeil et la zone, et en sombre les ecarts de
teinte sont plus courts qu'en clair. L'etat de survol est donc double **deux fois** : le trait
passe de tirete a plein, ce qui est une FORME, et **le mot « lache ici » s'affiche sous
l'invite**. Regle du depot : chaque etat est double d'un glyphe ET d'un mot.

Meme traitement pour l'avis du pied du panneau et pour l'erreur de la modale, qui portaient leur
verdict par la seule couleur : un glyphe en `::before`, coche ou point d'exclamation.

### LE TEXTE DE CONFIRMATION DU VIDAGE EST UNE DEMANDE MOT POUR MOT DE TED

« attention tu vas perdre TOUT ce que t'as fait dans le bureau du vigneron, c'est pas remonte
dans Vitisoft ». Il est dans `viderBase()` de `src/js/bdv-base.js`, il n'a pas bouge d'un
caractere, et `npm run banc:vidage` le garde. **On repeint le bouton, on ne reecrit pas la
phrase.**

### `gateVitisoft()` ET `gateBaseVide()` GARDENT LEURS DEUX MARQUES

`data-off` et `data-off-vide` sont DISTINCTES et le restent : la premiere dit « tu n'as pas
Vitisoft », la seconde « ta base est vide ». Seule `.bdvr-bloc[data-off="oui"]` cache, et
`gateBaseVide()` pose les deux pour pouvoir retirer la sienne sans defaire l'autre. Ce lot n'a
touche a aucune des deux, et `npm run banc:vidage` le controle explicitement.

### L'ECHELLE DES COUCHES NE S'ECRIT PAS EN DUR, MEME QUAND ON TOMBE JUSTE

`.bdv-porte` portait `z-index: 1200`, c'est-a-dire la valeur de `--z-amorce` recopiee a la main.
Elle est devenue `var(--z-amorce, 1200)`. Le repli garde 1200 parce que cette feuille est aussi
servie a des pages du site. L'echelle complete et ordonnee reste : `--z-modale` 400 <
`--z-voile` 1000 < `--z-busy` 1050 < `--z-statut` 1100 < `--z-amorce` 1200.

### LES DEUX APERCUS NE CHARGEAIENT PAS `bdv-theme.css`

Meme defaut que `npm run apercu:fiche` au lot 4, et il aurait coute la meme chose : une page dont
toutes les `var()` tombent dans le vide, montree comme si c'etait le produit.
`npm run apercu:modale` et `npm run apercu:amorce` chargent desormais les TROIS feuilles dans
l'ordre du gabarit, `bdv-theme.css`, `style.css`, `bdv-bureau.css`, posent `bdv-coque` sur le
corps de page, et rendent chaque etat DEUX FOIS, sous un conteneur clair et un conteneur sombre.

**UN ACCENT GRAVE DANS LA CONSTANTE `STYLE` DE `bdv-reglages.js` FERME LE GABARIT.** Trois
commentaires ajoutes citaient un nom de jeton entre accents graves : le fichier est devenu
illisible par acorn, et le build l'a dit en UNE ligne, « illisible par acorn, laisse tel quel »,
sans echouer. Le minifieur laissait simplement le fichier entier non traite. **Les commentaires
de cette constante citent les noms entre guillemets francais, jamais entre accents graves.**

### CE QUE LA CAPTURE A TROUVE, ET QUE CINQUANTE BANCS VERTS N'AVAIENT PAS VU

**NEUVIEME FOIS.** Les deux boutons du pied du voile d'amorcage, « Reessayer » et « Ouvrir quand
meme », sont ecrits en `btn btn--geste` par `bdv-amorce.js`. `.bdv-coque .btn--geste` leur donne
le dessin d'une action de RANGEE : fond transparent, bordure transparente, revelee au survol.
C'est juste dans un listing ; c'est faux ici, ou ces deux boutons sont **la seule sortie d'un
voile qui couvre tout l'ecran**. Ils apparaissaient comme deux bouts de texte gris, dans les deux
themes.

**Aucun calcul ne pouvait le dire : le contraste du libelle est bon.** C'est l'AFFORDANCE qui
manquait, et seule l'image la montre. La regle qui les rend a (0,3,0) est bornee au pied du
voile : partout ailleurs le geste reste nu.

### L'AUDIT DE RENDU, QUATRE PASSAGES, NEUF ECRANS PAR PASSAGE

`Claude outputs/lot5-audit-contraste.mjs`, repris du lot 4 avec ses deux relais. Perimetre : la
modale, les six onglets du panneau, la porte et le voile, dans les deux themes et aux deux
largeurs. **Zero valeur papier, zero paire sous le seuil, aux quatre passages.**

Une correction du relais « papier » : `rgb(255,255,255)` est retire de sa table. En theme CLAIR,
`--bdv-surface`, `--bdv-surface-3` et `--bdv-encre-sur-accent` valent tous #FFFFFF, donc le blanc
n'y est pas une trace de papier, c'est la surface du produit. En sombre aucun jeton du bureau ne
vaut blanc, et le relais garde tout son mordant la ou il sert.

### LE COMPTE DE PAPIER RESTANT DANS LE BUREAU, TOUTES FEUILLES CONFONDUES

`Claude outputs/lot5-compter-papier.mjs` compte les appels a un jeton du site dans ce que le
bureau CHARGE, commentaires retires :

    bdv-theme.css ........  0
    bdv-bureau.css .......  0
    bdv-panneau.css ......  0
    bdv-reglages.js STYLE   0
    bdv-compte.js porte ..  0
    bdv-ecrans.css .......  91, TOUS dans le rapport imprimable, et c'est voulu
    bdv-calendrier.css ... 237, tous RECOUVERTS par la section 16 de bdv-bureau.css

**Les 91 sont la regle du lot 4** : `#printReport` ne sort que par l'imprimante, et le repeindre
ferait sortir des pages noires chez tout vigneron qui a choisi le sombre. Le papier est le bon
medium pour le papier.

~~**Les 237 sont le poids mort du lot 3**, et c'est le dernier chantier ouvert du dessin :
`bdv-calendrier.css` n'a pas ete modifiee, elle a ete recouverte, parce que sa vue liste
reutilise volontairement `.echeance` de `/outils/echeances/`.~~

**LES 237 SONT PASSES A 51 LE 21/09/2026, ET LE MOTIF DONNE ICI ETAIT FAUX.** Le partage de
`.echeance` avec `/outils/echeances/` est un partage de NOMS, pas de pages : les 128 regles de
`bdv-calendrier.css` sont toutes sous `.bdv-cal`, cette classe n'existe que dans
`src/mon-bureau.njk`, et la page publique ne charge que `style.css`. La feuille a donc ete
repeinte en place. Son recouvrement, lui, est reste, pour une raison de CHARGEMENT et pas de
partage : `bdv-nav.js` la pose au premier clic sur la piece, dont le balisage est deja dans la
page. Voir « UNE FEUILLE QUE SEUL LE BUREAU CHARGE SE REPEINT EN PLACE », plus bas.

### CE QUI RESTE OUVERT, APRES CINQ LOTS

- ~~**La scission de `style.css`.**~~ **FAITE LE 21/09/2026** (voir « LA FEUILLE DU SITE EST
  SCINDEE EN DEUX »), et c'est elle qui a permis de lever le recouvrement des sections 9 a 17
  le meme jour : 60 regles de `bdv-bureau.css` disparues, 345 valeurs papier de `bdv-poste.css`
  remplacees par leur jeton. Ce qui reste vrai de cette note : les 119 regles que la
  demonstration de l'accueil retient cote public ne peuvent toujours pas etre supprimees, et
  leur recouvrement reste.
- ~~**`bdv-calendrier.css` repeinte en place**, le jour ou la vue liste ne partagera plus
  `.echeance` avec la page publique.~~ **FAIT LE 21/09/2026, ET LA CONDITION POSEE ICI N'ETAIT
  PAS LA BONNE** : la page publique ne charge pas cette feuille, le partage ne porte que sur les
  noms de classe. 237 appels papier passes a 51. Ce qui l'a empeche de rendre son recouvrement
  est le MOMENT de son chargement, mesure a 329 ecarts par etat au banc de sortie.
- **La porte de compte garde deux dessins**, le papier pour le site et les jetons pour le
  bureau. C'est juste, mais ca veut dire que toute regle ajoutee a `bdv-compte.js` doit etre
  doublee dans la section 20 de `bdv-bureau.css`. Il n'y a aucun garde-fou qui le rappelle.
- **Le panneau ne se photographie pas sur une base VIDE sans reseau.** Le voile d'amorcage ne
  conclut jamais dans un conteneur hors ligne et se remonte a chaque navigation, donc le harnais
  ne voit jamais `openApp()` ouvrir le panneau tout seul. Le defaut de dessin est ferme, mais ce
  chemin-la reste non photographie.
- **Les points ouverts des lots 3 et 4 n'ont pas bouge** : la fusion des trois zones de lecture,
  le vide sous le sous-main, la coche de « Mes taches » sur telephone, le bouton « Lune et
  feries », et le fait que rien n'annonce qu'un tableau defile.

## LE SQL DU DEPOT SE REJOUE, ET C'EST UN BANC QUI LE DIT, 18/09/2026

`supabase/schema.sql` disait en tete « Ecrit pour etre rejouable sans erreur ». **Il ne
l'etait pas : six erreurs sur une base neuve, la premiere ligne 61**, donc avant la creation
de la moindre table de vente. Une base neuve partie de ce fichier n'avait ni `ventes`, ni
`taches`, ni `bureaux`.

Les six nommaient un objet qui n'existait pas encore : un `grant` sur une colonne ajoutee
200 lignes plus bas, deux `revoke` sur des fonctions qui ne vivaient que dans les lots 12 et
13, une vue qui lit une colonne du lot 12, et deux `grant` sur cette vue.

**Personne ne pouvait le voir.** Sur la production, qui avait recu les lots un par un,
chaque ligne fautive trouvait son objet et passait. Le fichier n'etait faux QUE sur une base
neuve, c'est-a-dire exactement le jour ou on en aurait eu besoin.

**LA REGLE : `scripts/banc-rejeu.mjs` porte la liste `ORDRE`, et cette liste EST la
procedure de reconstruction.** Un lot SQL ajoute et pas inscrit dedans n'est pas « oublie par
le banc » : il est absent de la procedure. Le banc ne se connecte a aucune base, il relit le
SQL et verifie que chaque objet nomme existe avant d'etre nomme.

**ET LA LECON DE METHODE, qui vaut au-dela du SQL :** les deux premiers defauts annonces ce
jour-la etaient FAUX, tous deux parce qu'ils avaient ete deduits de la lecture au lieu d'etre
rejoues. `create index if not exists` declare deux fois ressemble a une collision ; entre les
deux declarations, `drop column id` libere le nom, et tout se passe bien. Un Postgres vide et
huit minutes tranchent ce qu'une heure de lecture ne tranche pas.

## LE CSS EST MINIFIE AU BUILD, ET `src/` NE L'EST JAMAIS, 18/09/2026

`.eleventy.js` porte un hook `eleventy.after` qui reecrit `_site/css/*.css` avec `css-tree`,
deja dans le depot. Aucune dependance ajoutee. `style.css` passe de 63,5 a 20,1 Ko une fois
compressee : **43,4 Ko de moins sur chaque premiere visite d'une page publique.**

**LA REGLE : aucun script ne lit `_site/css/` ni `_site/js/`. On lit `src/`.** Les sept
`scripts/apercu-*.mjs` lisaient `_site/css/style.css` et ont ete repointes le meme jour.
`charte.mjs` lisait deja `src/` des deux cotes, y compris en mode bureau ou il resout les
`href` du HTML construit vers `src/`. C'est ce qui permet a la minification d'exister sans
qu'aucun garde-fou ne se mette a lire autre chose que ce qu'il croit lire.

La minification est CONSERVATRICE et elle doit le rester : `csstree.generate()` retire les
commentaires et les blancs, rien d'autre. Pas de fusion de regles, pas de couleurs
raccourcies, pas de reordonnancement. Sur une feuille dont un garde-fou lit les selecteurs un
par un, un minifieur malin casserait `charte.mjs` sans prevenir. Le hook recompte les regles,
les declarations et les `!important` des deux cotes, et laisse le fichier d'origine en place
au moindre ecart.

## LA FEUILLE DU SITE EST SCINDEE EN DEUX, 21/09/2026

`src/css/style.css` servait LES DEUX MONDES : les douze pages publiques et le bureau connecte.
Elle est coupee. La moitie bureau vit dans **`src/css/bdv-poste.css`**, liee par le seul drapeau
de front matter `theme_bureau`, **entre `style.css` et `bdv-bureau.css`**.

**310 regles, 1 060 declarations, 74 105 octets de source.** Mesure sur le SERVI, apres
minification : la feuille que chaque page plate telecharge a sa premiere visite passe de 148 661
a 117 955 octets, soit **30 706 octets de CSS bloquant en moins par page publique**. Le bureau
charge 149 062 octets au lieu de 148 661, soit **401 octets de plus** : ce sont les preludes de
`@media` et de `@container` reecrits autour des regles sorties d'un bloc mixte. C'est le prix
exact d'un deplacement qui ne reordonne rien, et il ne faut pas le cacher.

### L'ORDRE DU LIEN N'EST PAS NEGOCIABLE

`bdv-poste.css` est posee APRES `style.css` et AVANT `bdv-bureau.css`. Ses regles etaient DANS
`style.css`, donc avant le dessin de la coque qui les recouvre depuis le chantier des deux
themes. La poser apres `bdv-bureau.css` retournerait ce rapport de force a specificite egale,
**sans qu'une seule declaration ait change**.

### LE CRITERE DE TRI N'EST PAS « CETTE CLASSE PARLE DU BUREAU »

C'est **« quelle page charge cette regle »**. `src/_includes/components/demo-pinboard.njk` montre
sur l'accueil les VRAIS composants du bureau, decision du 12/09/2026 : **119 regles, 20 158
octets, restent donc dans `style.css` bien qu'elles portent des noms de bureau.** `.bureau-nav`
et ses enfants, `.bureau-atelier`, `.bureau-plan`, `.zone` et ses variantes `--panneau`,
`--ardoise`, `--lecture`, `--classeur`, `--courrier`, `.zone__tete`, `.zone__note`, `.postit__v`,
`__s`, `__tampon`, `__gestes`, `__g`, `.chiffre` et ses enfants, `.fiche-l` et ses enfants,
`.lettre__d`, `__t`, `__m`, `.card__title`.

**Cette liste n'a pas ete ecrite de memoire, et elle ne doit jamais l'etre.** Elle sort de
`"Claude outputs/lot6-pinboard.mjs"`, qui refait le tri deux fois, avec et sans la page
d'accueil, et rend la difference. Le jour ou la demonstration change de composants, c'est ce
script qu'on relance, pas la liste qu'on relit.

**La question de la demonstration de l'accueil, remise a plus tard par Ted, est donc reglee par
construction : ce qu'elle utilise est reste du cote public.**

### LE THERMOMETRE 3 EST CE QUI EMPECHE LA SCISSION DE SE DEFAIRE

Section C de `npm run charte`, et c'est un **ECHEC**, pas une note : il compte les octets de
`style.css` qui ne peuvent servir QU'au bureau. **Borne a 150 octets, mesure du jour 115**, soit
la seule regle sur laquelle j'ai doute, `.mono`, laissee cote public parce que c'est une
utilitaire de chasse fixe dont le nom peut atterrir demain sur n'importe quel gabarit. Une regle
de bureau reecrite dans `style.css` la semaine prochaine ne casse aucun pixel et ne leve aucune
erreur : elle remet simplement le poids sur les douze pages publiques. Seul un chiffre qui refuse
garde ca. **CETTE BORNE NE REMONTE JAMAIS.**

Le thermometre C2 echoue si une page publique se met a lier `bdv-poste.css`.

### CE QUE LE THERMOMETRE 2 NE FAIT PAS, ET IL FAUT LE SAVOIR

**La note des 56,9 ko n'a pas bouge, et c'est normal.** Elle compte ce qui ne peut servir QU'au
site public et part quand meme dans le bureau. Le bureau charge toujours `style.css` : il lui
faut la coque, les boutons, et les composants que la demonstration de l'accueil partage avec lui.
La scission a traite l'autre sens, celui que rien ne mesurait. **Ne pas annoncer les 56,9 ko
comme reglees.** Les faire tomber demanderait de sortir du bureau la coque partagee, qui est un
autre chantier, avec un autre arbitrage.

### LE DEPLACEMENT A ETE PROUVE PAR LA SORTIE, PAS PAR UNE EMPREINTE

CLAUDE.md porte la lecon du 15/09/2026 : une empreinte compare le depot au depot, comparer une
SORTIE a une sortie traverse tout le chemin. Ici le chemin est long : eleventy recopie, le
crochet `eleventy.after` minifie, et le navigateur assemble dans un ORDRE qui vient de changer.

`"Claude outputs/lot6-empreinte.mjs"` releve le style CALCULE de chaque element et de ses
`::before` / `::after` sur la page CONSTRUITE et servie : quatre pages publiques plus deux
autres, aux deux largeurs, et le bureau dans ses neuf pieces, dans les deux themes, panneau de
reglages et modale de tache compris. **45 etats, 141 187 elements et pseudo-elements, 139
proprietes chacun, 19 624 993 valeurs. ZERO ecart.**

Deux choses ont fait mentir ce banc avant qu'il ne serve, et elles sont dans son bloc de tete :

1. **Chromium rend `0px` pour un `margin: auto` dont la mise en page n'est pas resolue.** Deux
   passages sur la MEME construction sortaient deux valeurs differentes sur le cadre de la
   demonstration de l'accueil, une fois sur quatre. On force deux mises en page et deux trames
   d'attente avant de lire.
2. **Playwright essaie les routes de la DERNIERE posee a la premiere.** La route qui coupe le
   reseau, posee apres les trois doublures de CDN, les avalait : `chargerEcrans()` echouait, les
   quatre pieces de vente ne se peignaient plus, et le releve perdait 14 511 lignes en se
   declarant parfaitement stable. **Un banc qui compare moins se declare vert.** Il faut donc
   faire tourner le banc DEUX FOIS sur la meme construction avant de s'en servir, et exiger zero
   ecart : c'est ce temoin qui a trouve les deux.

Et il a ete verifie DANS L'AUTRE SENS, par mutation : un `word-spacing: 9px` pose sur les 332
regles de `bdv-poste.css` fait sortir **85 740 ecarts**. Un banc de non-regression qui n'a jamais
vu un ecart n'a pas encore prouve qu'il sait en voir un.

CE QU'IL NE COUVRE PAS, ET IL FAUT LE SAVOIR AVANT DE S'Y FIER : le decor de
`scripts/bureau-garni.mjs` ne garnit pas tout. « L'equipe » rend son etat SANS EQUIPIER, donc
`.equipe-ligne__*`, `.equipe-role`, `.invitation__*` ne sont vus par aucun releve. Une mutation
posee sur `.equipe-ligne__nom` est passee inapercue, et c'est comme ca que ce trou a ete trouve.
Le deplacement de ces regles reste sur la parole du tri, pas sur une mesure.

### L'OUTIL DE DECOUPE, ET POURQUOI IL NE REGENERE PAS LA FEUILLE

`"Claude outputs/lot6-tri.mjs"`. `css-tree` **ne garde pas les commentaires** : regenerer la
feuille aurait efface les POURQUOI, qui sont la moitie de la valeur de ce depot. On se sert donc
des offsets de l'arbre pour DECOUPER le texte source, et ce qui arrive dans `bdv-poste.css` est
octet pour octet ce qui part de `style.css`. Le script refuse de tourner une seconde fois : sur
une scission deja faite, il reecrirait le fichier de sortie avec son seul entete et ferait
disparaitre les 310 regles sans un mot.

## UNE FEUILLE QUE SEUL LE BUREAU CHARGE SE REPEINT EN PLACE, 21/09/2026

**LA REGLE, ET ELLE AURAIT EVITE LES QUATRE DEFAUTS DES CINQ LOTS DU THEME :**

> **Une feuille que SEUL le bureau charge se repeint EN PLACE. Une feuille PARTAGEE avec le
> site se recouvre, et alors on balaye les specificites d'en face AVANT de capturer.**

Le critere n'est pas « cette classe parle du bureau », c'est le meme que celui de la scission :
**quelle page charge cette feuille.** Au 21/09/2026 le partage est celui-ci.

| feuille | qui la charge | ce qu'on y fait |
|---|---|---|
| `bdv-theme.css` | /mon-bureau/ seul, liee | en place |
| `bdv-poste.css` | /mon-bureau/ seul, liee | en place |
| `bdv-bureau.css` | /mon-bureau/ seul, liee | en place |
| `bdv-ecrans.css` | /mon-bureau/ seul, par JS | en place, lot 4 |
| `bdv-panneau.css` | /mon-bureau/ seul, par JS | en place, lot 5 |
| `bdv-calendrier.css` | /mon-bureau/ seul, par JS | en place, MAIS son recouvrement reste, voir plus bas |
| `style.css` | les douze pages publiques ET le bureau | **on recouvre, on ne touche pas** |
| le CSS de `bdv-compte.js` | le bureau ET le site public | **on recouvre** |

### POURQUOI RECOUVRIR COUTE DEUX FOIS, ET LE SECOND PRIX EST LE VRAI

1. **Du poids mort.** La valeur papier part quand meme au navigateur a chaque ouverture, et
   elle ne peint jamais rien. Mesure avant ce lot : 555 appels a un jeton papier dans
   `bdv-poste.css`, 237 dans `bdv-calendrier.css`.
2. **Une course de specificite, et c'est elle qui a mordu quatre fois.** Recouvrir, c'est
   parier que sa regle pese plus lourd que celle d'en face ET qu'on a nomme toutes ses
   proprietes. **Les quatre defauts ont ete trouves A LA CAPTURE, jamais par un banc**, et
   c'est structurel : un banc de feuille lit les regles qu'on ECRIT, pas celles qu'on laisse
   passer, et il faudrait rejouer la cascade, c'est-a-dire etre un navigateur.

**LES QUATRE, AVEC LEURS POIDS. A relire avant d'ecrire un recouvrement.**

- **La barre d'onglets du telephone restee creme** (lot 2). Le recouvrement ne nommait que
  `flex-direction` et `gap` ; le fond `--paper-light` et ses deux degrades passaient dessous
  intacts. **Une propriete qu'on ne reecrit pas garde celle de la cascade**, et en sombre cette
  valeur-la est toujours du papier. Aucune question de poids : une omission.
- **Le bouton de bascule montrant ses trois glyphes** (lot 2).
  `.bdv-coque .bdv-bascule svg{display:block}` pese **(0,2,1)** contre **(0,2,0)** pour
  `.bdv-coque .bdv-bascule__g{display:none}` : le selecteur le plus GENERAL gagne parce qu'il
  porte un nom d'element en plus.
- **La punaise du panneau restee papier** (lot 3). `body.bdv-poste .panneau .postit[data-ton]`
  de `style.css` pese **(0,4,1)** contre **(0,4,0)** : encore un nom d'element. `--bdv-encre-1`
  sur `--warn-bg` donne **1,03:1**, c'est-a-dire un nom de client invisible.
- **La barre « 286 lignes » restee creme** (lot 4). `#bureauVentes .bdv-ventes .topbar` pese
  **(1,2,0)** contre **(0,2,0)** : un IDENTIFIANT de plus.
- **Le titre de modale a 1,05:1** (lot 5), et c'est le plus instructif.
  `h1,h2,h3,h4{color:var(--ink)}` pese **(0,0,1)** et gagnait quand meme, parce que la regle
  d'en face ne nommait que `font-family` et `font-size`. **Aucune mesure de feuille ne pouvait
  le dire : les deux moities de la paire sont dans deux fichiers.**
- **« Ton bureau t'attend. » a 1,28:1** (lot 9), et c'est la MEME regle, deux lots plus tard,
  dans le seul etat que le harnais ne savait pas produire. La lecon n'est donc pas « nommer
  `color` sur la modale », c'est **nommer `color` partout ou le bureau pose un titre**, et le
  VERIFIER dans un navigateur : `"Claude outputs/lot9-titres.mjs"` releve tout `h1` a `h4` de
  tous les etats du bureau dans les deux themes et dit lequel porte encore une encre du site.
  Apres le lot 9 : **un seul, le `h1` du hero, a 12,69:1, et il est voulu.**

### LE BALAYAGE SE FAIT AVANT LA CAPTURE, ET IL A DEUX SENS

`"Claude outputs/lot5-specificite.mjs"` l'a fait dans un sens : **qui BAT le recouvrement que
je viens d'ecrire.** Quatre defauts trouves en dix minutes, avant la premiere image.

`"Claude outputs/lot7-repeindre.mjs"` le fait dans l'autre : **qui prendrait la main si je
RETIRAIS un recouvrement.** Trois choses a savoir avant de s'en servir, et chacune a coute un
passage du banc de sortie :

1. **Les FAMILLES de proprietes, pas les noms.** `border` commande `border-left-color`, `gap`
   commande `row-gap`, `padding` commande `padding-left`. Une abreviation posee plus tard ecrase
   une propriete longue posee plus tot, a specificite egale. Le premier jet comparait les noms
   tels quels : il a laisse partir `.bdv-coque .bdv-cal .calo__b{border-left}` et les quatre
   couleurs de famille du calendrier sont retombees sur l'encre du texte. **1 260 ecarts.**
2. **La classe de BASE d'une variante.** `<button class="btn btn--geste">` porte les deux
   classes : `.bdv-coque .btn{border}` et `.btn--geste{border-color}` se disputent le meme pixel
   alors que leurs selecteurs n'ont pas une classe en commun. Meme chose pour `.cal__coche` et
   `.cal__coche--choix`. **8 667 ecarts** pour cette seule lacune.
3. **Le point fixe.** Un recouvrement qu'on GARDE redevient un concurrent pour les autres :
   on recalcule jusqu'a ce que plus rien ne bouge. Sans la boucle, le balayage ne voit que le
   premier tour.

**ET CE BALAYAGE NE SUFFIT PAS, IL NARROWS.** Sur les 45 paires que le banc de sortie a
refusees, il en trouvait 16 tout seul. Les 29 autres demandaient de savoir quel element porte
quelles classes, ce qu'aucune lecture de feuille ne sait : c'est le navigateur qui repond.
**Le balayage reduit la surface, le banc tranche. Dans cet ordre, et pas l'un sans l'autre.**

### LE MOMENT DU CHARGEMENT EST UNE CONDITION AUTANT QUE LE SCOPE

`bdv-calendrier.css` est chargee par le bureau SEUL. Elle remplit donc le critere, et elle a
bien ete repeinte en place. **Son recouvrement n'a pourtant pas pu etre leve.**

`bdv-nav.js` la pose au PREMIER CLIC sur la piece, alors que le balisage du calendrier est dans
la page depuis le chargement : son propre commentaire de tete le dit, « la piece est montree
avant d'etre habillee ». Descendre la valeur et retirer le recouvrement laisse donc le
calendrier NU entre le clic et l'arrivee de la feuille. Le banc de style calcule l'a chiffre :
**329 ecarts par etat sur « Ma journee » et « Mes taches »**, c'est-a-dire exactement les etats
ou la feuille n'est pas encore posee.

**LA REGLE COMPLETE EST DONC :** une feuille que seul le bureau charge se repeint en place ; son
recouvrement ne se leve que si elle arrive AUSSI TOT que celui qui la recouvre. Une feuille
LIEE par le gabarit (`bdv-poste.css`) remplit les deux conditions. Une feuille posee par du
code ne remplit que la premiere, et on la repeint quand meme : les deux ecritures disent alors
la MEME chose, ce qui n'est plus une course de specificite, quelle que soit celle qui gagne.

**ET LA NOTE DU LOT 5 SUR LE CALENDRIER ETAIT FAUSSE, IL FAUT LE SAVOIR.** Elle disait qu'on ne
pouvait pas repeindre `bdv-calendrier.css` parce que « sa vue liste reutilise volontairement
`.echeance` de `/outils/echeances/` ». C'est un partage de NOMS, pas un partage de pages : les
128 regles de cette feuille sont toutes sous `.bdv-cal`, `.bdv-cal` n'existe que dans
`src/mon-bureau.njk`, et `/outils/echeances/` ne charge que `style.css`. **Un partage de classes
n'est un obstacle que si une page publique charge la feuille. On le mesure, on ne le deduit
pas d'un nom.**

### CE QUE LE LOT A DEPLACE, EN CHIFFRES

**`src/css/bdv-poste.css`, repeinte en place et son recouvrement leve.** 345 valeurs papier
remplacees par leur jeton `--bdv-*`. **555 appels papier avant, 233 apres.** Les 233 qui restent
sont ceux qui PEIGNENT encore : « L'equipe » et l'invitation, que les cinq lots du theme n'ont
jamais eu dans leur perimetre, plus des tailles, des familles et des ecarts que le dessin de la
coque ne nomme pas. Les repeindre changerait l'ecran : ce n'est pas ce lot-ci.

**`src/css/bdv-calendrier.css`, repeinte en place, recouvrement garde.** 176 valeurs descendues,
**237 appels papier avant, 51 apres.**

**`src/css/bdv-bureau.css`, allegee.** **434 regles avant, 374 apres** : 60 regles disparaissent
en entier, 49 autres perdent 172 declarations. 53 401 octets servis avant, 44 215 apres.

**Le compte de ce qui RESTE dans `bdv-bureau.css`, et les trois raisons de rester :**

1. **la regle d'en face est dans `style.css`** : les 119 regles que la demonstration de l'accueil
   oblige a garder cote public ne peuvent pas etre modifiees, elles servent une page qui n'a
   qu'un theme ;
2. **c'est du dessin neuf** : la coque, le rail, la barre basse, la bascule, les primitives n'ont
   jamais eu de vis-a-vis a recouvrir ;
3. **retirer le recouvrement aurait change l'ecran**, et c'est mesure : 68 paires refusees par le
   balayage de specificite, plus la section 16 entiere pour la raison de chargement ci-dessus.

**Les octets servis, feuille par feuille.** Les trois feuilles non touchees sont donnees pour
qu'on voie que le site n'a rien paye :

| feuille servie | avant | apres |
|---|---|---|
| `style.css` | 117 955 | 117 955 |
| `bdv-poste.css` | 31 107 | 30 712 |
| `bdv-bureau.css` | 53 401 | **44 215** |
| `bdv-calendrier.css` | 13 642 | 13 906 |
| `bdv-ecrans.css` | 39 602 | 39 602 |
| `bdv-panneau.css` | 12 614 | 12 614 |
| `bdv-theme.css` | 3 660 | 3 660 |
| **total du bureau** | **271 981** | **262 664** |

**Les 264 octets de PLUS sur `bdv-calendrier.css` ne se cachent pas** : `--bdv-surface-2` est
plus long a ecrire que `--paper-deep`. C'est le prix d'une feuille qui dit desormais la verite au
lieu de dire du papier qu'on recouvre, et il est paye une fois par ouverture du calendrier.

**La borne des ombres de la section A de `npm run charte` est descendue de 15 a 14 cote site et
de 20 a 16 cote bureau** : les ombres papier que les deux feuilles servaient sans jamais les
peindre sont parties. Une borne DESCEND et ne remonte jamais.

### LE BANC DE SORTIE, ET IL A REFUSE TROIS FOIS AVANT D'ACCEPTER

`"Claude outputs/lot6-empreinte.mjs"` et `lot6-comparer.mjs`, repris du lot de la scission sans
une ligne de changement : **45 etats, 141 187 elements et pseudo-elements, 139 proprietes
chacun, 19 624 993 valeurs comparees. ZERO ecart** contre les DEUX releves d'avant.

Il a dit non trois fois, et chaque refus a appris quelque chose au balayage statique :
**8 606 ecarts** au premier passage (les familles de proprietes), **8 667** au deuxieme (la
classe de base d'une variante), **1 986** au troisieme (le moment du chargement de
`bdv-calendrier.css`). Un banc qui refuse est une information, pas un obstacle.

**ET IL A ETE VERIFIE PAR MUTATION AVANT D'ETRE CRU**, comme le veut la regle du depot : un
`word-spacing: 3px` glisse dans les 812 regles des trois feuilles touchees fait sortir
**129 012 ecarts**. Un banc de non-regression qui n'a jamais vu un ecart n'a pas encore prouve
qu'il sait en voir un.

**LES DEUX PIEGES DE SON EN-TETE SONT REELS, ET LE PREMIER S'EST REPRODUIT.** Le `margin: auto`
que Chromium rend a `0px` tant que la mise en page n'est pas resolue est sorti une fois sur le
cadre de la demonstration de l'accueil, **2 ecarts sur un passage**, sur un lot qui ne touche
aucune feuille que l'accueil charge. Le releve d'avant a donc ete fait DEUX FOIS et les deux ont
servi de reference. La route de coupure reseau posee AVANT les doublures de CDN, elle, n'a pas
bouge : c'est elle qui fait que les quatre pieces de vente se peignent.

### CE QUE LES CAPTURES ONT MONTRE

Les trois audits de rendu des lots 3, 4 et 5, rejoues : **zero valeur papier, zero paire sous
son seuil**, sur les neuf pieces, les six onglets du panneau, la modale, la porte et le voile,
dans les deux themes et aux deux largeurs.

Et une comparaison PIXEL avec les captures du lot 3 gardees dans « Claude outputs » :
`taches`, `calendrier` et `cal-annee` sont **identiques au pixel** en clair comme en sombre.
« Ma journee » differe de 9 665 pixels, tous dans une seule phrase : « 75 % eclairee » est
devenue « 77 % eclairee ». C'est la lune, qui est CALCULEE. Sur telephone, la barre basse des
captures du lot 3 est creme et la mienne est sombre : c'est le premier des quatre defauts
ci-dessus, corrige depuis, et ces images-la sont anterieures a sa correction.

### CE QUI RESTE OUVERT

- ~~**Les 233 appels papier de `bdv-poste.css` PEIGNENT encore**, « L'equipe » en tete, et le
  decor de `scripts/bureau-garni.mjs` rend cette piece SANS EQUIPIER.~~ **FAIT LE 21/09/2026 au
  lot suivant**, voir « UNE PIECE QU'UN HARNAIS REND VIDE N'EST PAS UNE PIECE VERIFIEE » plus
  bas. Il restait 58 paires sous leur seuil sur cette piece, toutes en sombre. Les 51 appels de
  `bdv-calendrier.css`, eux, peignent toujours.
- **Les 91 appels papier de `bdv-ecrans.css`** restent voulus : ils sont tous dans
  `#printReport`, qui ne sort que par l'imprimante.
- **Le recouvrement de la section 16 de `bdv-bureau.css`** ne partira que le jour ou
  `bdv-calendrier.css` sera LIEE par le gabarit au lieu d'etre posee au premier clic. C'est un
  arbitrage de chargement, pas de dessin : la feuille pese 13,9 ko servis pour une piece que
  tout le monde n'ouvre pas.
- **Le balayage de specificite ne sait pas quel element porte quelles classes.** Il a trouve 16
  des 45 paires que le banc a refusees. Lui apprendre a lire le DOM des neuf pieces le rendrait
  suffisant tout seul ; aujourd'hui il faut les deux.
- **Le thermometre 2 n'a pas bouge** : 56,9 ko de `style.css` voyagent toujours dans le bureau
  sans pouvoir s'y appliquer. Ce lot a traite l'autre sens. Ne pas l'annoncer comme regle.

## UNE PIECE QU'UN HARNAIS REND VIDE N'EST PAS UNE PIECE VERIFIEE, 21/09/2026

**LA REGLE, ET C'EST LA CINQUIEME FOIS QUE CE DEPOT LA PAIE :**

> **Un decor de harnais n'a pas d'utilisateur pour signaler qu'il ment. Avant de croire un
> releve, on compte CE QUI EST PEINT, pas ce qu'on a ecrit dans le decor. Et un decor que le
> harnais oublie de poser doit LEVER, pas se taire.**

### LE TROU, ET CE QU'IL A COUTE

`scripts/bureau-garni.mjs` garnissait huit pieces sur neuf. « L'equipe » sortait **sans un seul
equipier** de toutes les captures des lots 3 a 7 : liste vide, formulaire d'invitation masque,
invitations en attente masquees, lien de secours masque, pas une etiquette de role. Les trois
audits de contraste des lots 3, 4 et 5 ont donc mesure **zero paire** dessus, et les deux bancs
d'empreinte ont compare **du vide a du vide, et declare zero ecart**.

**POURQUOI ELLE SORTAIT VIDE, ET C'EST STRUCTUREL.** C'est la SEULE piece du bureau qui ne lit
rien du stockage local : son contenu vient de six appels a `BdvCompte.api()`, c'est-a-dire du
serveur. Le conteneur n'a pas de reseau, `lot6-empreinte.mjs` coupe en plus tout ce qui n'est
pas 127.0.0.1, les six appels tombaient, et `ouvrir()` affichait son ecran d'echec. Le decor
etait construit pour un bureau qui travaille SEUL, et cette piece-la ne parle que de travailler
a plusieurs.

**CE QUE L'ANGLE MORT A COUTE, MESURE LE 21/09/2026 AVANT CORRECTION**, harnais garni et theme
sombre : **58 paires sous leur seuil**, dont
« UTILISATEUR » a **1,20:1** (l'etat le plus frequent de la piece, litteralement absent de
l'ecran alors que « MAITRE » restait lisible),
la phrase « il ne s'affichera qu'une fois » du lien d'invitation a **1,00:1** (la seule phrase
qui dise qu'un secret non reproductible ne reviendra pas),
« Tu n'appartiens a aucun bureau » a **1,00:1**,
« Untel t'invite a travailler dans Tel domaine » a **1,00:1**,
toutes les adresses e-mail et toutes les aides a **2,44:1**.
Plus **152 valeurs papier** et **6 cibles tactiles sous 44 px**. Zero de tout cela en clair :
c'est un defaut qui n'existe QUE dans le theme que personne n'avait photographie ici.

### CE QUI FERME LE TROU

**`garnirLeBureau()` garnit « L'equipe » PAR DEFAUT.** Un decor qu'il faut penser a demander est
un decor qu'on oublie ; `{ equipe: false }` existe, et il faut savoir pourquoi on l'ecrit.

**ON DOUBLE LE SERVEUR, PAS LE CLIENT.** `garnirLEquipe()` remplace `window.fetch` pour les
seules adresses Supabase qu'il connait, et `bdv-compte.js` comme `bdv-equipe.js` tournent en
entier. Toute autre adresse est refusee par le meme `TypeError` qu'un reseau coupe, donc le
reste du decor ne bouge pas d'un pixel. Stubber `BdvCompte` aurait reconstruit un harnais plus
sage que la realite, c'est-a-dire le defaut qu'on repare.

**TROIS ETATS, PARCE QU'ILS N'AFFICHENT PAS LES MEMES BLOCS** : `maitre` (deux bureaux, trois
membres, deux invitations en attente dont une expiree), `simple` (ni selecteur, ni formulaire,
ni gestes, la note a la place) et `sans-bureau` (son propre ecran). Plus le lien de secours,
atteint par le VRAI geste : la fonction d'envoi rend `envoye:false`, comme quand Resend tousse.

**ET DEUX GARDE-FOUS QUI LEVENT.** `verifierLeBureauGarni()` demande a la page, par le vrai
chemin, combien d'equipiers `/rpc/equipe` rend, et refuse de rendre son rapport a zero.
`verifierLEquipeGarnie()` se passe la piece OUVERTE et compte les lignes, les etiquettes de
role, les invitations et la visibilite de chaque bloc selon l'etat demande. Le harnais s'arrete
AVANT la premiere image.

**UN SEUL DECOR POUR LES DEUX HARNAIS.** `scripts/apercu-equipe.mjs` importe desormais les
equipiers et les invitations de `bureau-garni.mjs`. Ils etaient ecrits deux fois, et c'est
exactement le dedoublement que le bloc de tete de `bureau-garni.mjs` raconte deja pour le decor
des ventes.

### ET L'APERCU MENTAIT AUSSI, DEPUIS LE MATIN MEME

`npm run apercu:equipe` ne posait que `style.css`. Depuis la scission du 21/09/2026 au matin,
`style.css` ne contient plus **une seule** regle `.equipe-*` : l'apercu rendait la piece
entierement NUE et l'a fait toute la journee sans que rien ne le dise. Il pose maintenant les
quatre feuilles du bureau **dans l'ordre ou le gabarit les lie**, le `bdv-coque` sur le corps de
page, et les deux themes COTE A COTE.

**ET IL A TROUVE UN DEFAUT DE PLUS AU PREMIER PASSAGE, COMME LA PREMIERE FOIS.** Un conteneur
`[data-theme="dark"]` retourne les JETONS de son sous-arbre, mais pas les proprietes deja
CALCULEES au-dessus : `body.bdv-coque{color:var(--bdv-encre-2)}` est resolu sur le `<body>`,
donc avec les valeurs CLAIRES, et cette encre descend telle quelle dans le conteneur sombre.
Les NOMS des equipiers, qui vivaient d'heritage, sortaient en #33383F sur fond sombre.
**Un conteneur qui force un theme redit donc TOUT ce que la coque pose sur le corps de page, le
fond ET l'encre.** Le nom d'equipier, lui, dit maintenant son encre au lieu de l'heriter.

### LE BANC DE SORTIE A UN PERIMETRE, ET C'EST NOUVEAU

Les deux lots precedents ne changeaient aucun pixel, donc `lot6-comparer.mjs` exigeait zero
ecart partout. Ce lot-ci CHANGE l'ecran, sur une piece et une seule.
`"Claude outputs/lot8-perimetre.mjs"` range donc chaque ecart dans trois seaux : DANS la zone et
son bandeau, sur leurs ANCETRES (la hauteur de la zone qui remonte), AILLEURS. **Le troisieme
doit etre vide, sans discussion.**

Resultat, contre DEUX releves de reference pris avec le harnais deja garni : **22 560 ecarts
dans la piece, 66 sur ses six ancetres dans les six etats ou elle est a l'ecran, ZERO
ailleurs** sur les huit autres pieces, le panneau, la modale et les six pages publiques.
Verifie par mutation : `word-spacing:3px` dans les 311 regles de la feuille SERVIE fait passer
le troisieme seau de 0 a **75 858**.

**LES DEUX CHEMINS DU PERIMETRE SONT EN DUR, et il faut le savoir** : le releve ne garde que le
chemin d'index depuis la racine, pas les noms de classe. `lot8-chemins.mjs` les relit sur la
page construite, et ils changent si l'ordre des blocs de `src/mon-bureau.njk` change.

### UN BANC DE STYLE CALCULE LIT AUSSI CE QUI N'EST PAS PEINT

Deux corrections ont ete ANNULEES par le banc, et les deux apprennent quelque chose :

- **`.calbloc__trous` est en `display:none`.** Ses quatre valeurs papier ne peignent pas un
  pixel, mais `getComputedStyle` REND les valeurs d'un element cache : les retirer a sorti
  **165 ecarts**. Un banc de style calcule ne sait pas distinguer « ce n'est pas peint » de
  « ce n'est plus la », et c'est tres bien ainsi, c'est ce qui lui permet d'attraper un defaut
  dans un etat qu'aucune capture ne montre.
- **`.listb tr` sous 700 px PEINT encore.** `.bdv-coque .listb tbody tr` ne couvre que le CORPS
  du tableau ; la rangee d'EN-TETE prend toujours le filet papier. Six ecarts, gardes.

### ET IL Y A DEUX ETATS QUE CE BANC NE SAIT PAS LIRE

`lot6-empreinte.mjs` releve le style calcule **au repos** : aucun de ses 45 etats n'est un
survol ni un focus clavier. Une declaration qui ne peint que dans ces etats-la lui est
invisible **dans les deux sens** : il ne peut ni la proteger, ni la condamner.

`"Claude outputs/lot8-etats-forces.mjs"` force les deux pseudo-etats par le protocole de
Chromium (`CSS.forcePseudoState`) et lit la couleur RENDUE. Il a trouve les deux SEULES valeurs
papier de `bdv-poste.css` qui peignaient encore hors de « L'equipe », et elles etaient graves :

| etat force | avant | apres |
|---|---|---|
| titre d'une tache au SURVOL, en sombre | **1,37:1** (seuil 4,5) | 8,34:1 |
| anneau de focus clavier d'une tache, en sombre | **1,37:1** (seuil 3) | 10,87:1 |

Un titre qui disparait quand la souris passe dessus, et un anneau de focus invisible sur la
piece la plus ouverte du bureau. Le poids : `button.tache__corps:hover .tache__titre` pese
(0,3,1) contre (0,2,0), et `button.tache__corps:focus-visible` (0,2,1) contre (0,2,0) pour
l'anneau unique. **Un nom d'element de plus, exactement comme les trois defauts de specificite
du lot 2.** C'est la regle du depot : quand une surface change de couleur, relire l'anneau de ce
qu'elle porte.

### CE QUI RESTE OUVERT APRES CE LOT

- **`.invitation` est restee dans `style.css`** alors qu'aucune page publique ne s'en sert. Elle
  est RECOUVERTE depuis `bdv-poste.css`, proprietes nommees une par une, parce que la doctrine
  interdit de toucher une feuille partagee. La section C3 de `npm run charte` ne la compte pas :
  elle ne repere que `.mono`. Lui apprendre a voir `.invitation` ferait descendre une borne.
- ~~**Le bureau DECONNECTE n'a jamais ete photographie en sombre.**~~ **FAIT LE 22/09/2026 au
  lot suivant**, voir « LE BUREAU DECONNECTE EST LE PREMIER ECRAN » plus bas. Le `h2` etait bien
  a **1,28:1**, et c'etait la DERNIERE fuite de `h1,h2,h3,h4{color:var(--ink)}` dans tout le
  bureau : le balayage des neuf pieces, du panneau, de la modale et des cinq etats de la porte,
  dans les deux themes, n'en trouve aucune autre.
- **Les appels papier qui restent dans `bdv-poste.css` sont 16 `--e-s`, 1 `--e-xs`, 3 `--t-mini`,
  1 `--t-micro`, 1 `--t-corps`, 2 `--font-mono`, 2 `--z-*`, plus les valeurs de `.calbloc__trous`
  et de `.listb tr`.** Aucun n'a d'equivalent exact dans l'echelle `--bdv-*` : `--e-s` vaut
  10,4 px entre 8 et 12, `--t-mini` 11,2 px, et `bdv-theme.css` ne declare AUCUNE famille de
  police. Les repeindre changerait l'ecran hors de « L'equipe ».

## LE BUREAU DECONNECTE EST LE PREMIER ECRAN, 22/09/2026

**LA REGLE, ET C'EST LA SIXIEME FOIS :**

> **Un harnais qui pose une session a chaque etat ne peut pas voir l'ecran de quelqu'un qui n'en
> a pas. Avant de croire un releve, on compte les ETATS qu'il sait produire, pas seulement le
> contenu de chacun.**

### LE TROU, ET IL ETAIT DEJA MESURE AVANT D'ETRE OUVERT

Les 45 etats de `lot6-empreinte.mjs` ont TOUS une session : `garnirLeBureau()` ecrit
`bdv_session` en tout premier, et tout le decor en depend. Le bureau DECONNECTE n'avait donc
jamais ete releve, jamais photographie en sombre, jamais passe a l'audit de contraste. C'est
pourtant :

- **le premier ecran de quelqu'un qui n'a pas encore de compte** ;
- **le seul ecran d'un invite** qui arrive par un lien d'invitation ;
- **l'ecran de la PREMIERE ouverture sur un iPhone**, parce qu'une app iOS a son propre
  stockage et que la session ouverte dans Safari n'y est pas. C'est la meme mesure qui a fait
  ajouter `data-bdv-mode="connexion"` au bouton le 11/09/2026.

### CE QUE L'ANGLE MORT A COUTE, MESURE LE 22/09/2026 AVANT CORRECTION

Perimetre : `#bureauInvite`, le bandeau d'invitation et la porte dans ses cinq etats, aux deux
largeurs et dans les deux themes, soit quatre configurations.

| | avant | apres |
|---|---|---|
| paires sous leur seuil | **1**, sur les 2 configurations sombres | 0 |
| valeurs papier | **4** | 0 |
| cibles tactiles sous 44 px | **32** | 0 |
| saisies sous 16 px | 0 | 0 |

**La paire, c'est `h2` « Ton bureau t'attend. » a 1,28:1**, et il faut le dire simplement : sur
une capture sombre, le titre du premier ecran du produit n'est PAS LA. Le detail est dans
`"Claude outputs/lot9-audit-avant.txt"` et `lot9-audit-apres.txt`, les images dans
`lot9-avant-*` et `lot9-apres-*`.

**Les 32 cibles se repartissent en trois gestes**, mesures sur le rendu : le bouton unique de
l'ecran d'invitation (289x36), les boutons pleins de la porte (376x37) et ses deux liens de
secours, « Mot de passe oublie ? » (141x15) et « Renvoyer le code » (113x15). Le second est le
SEUL chemin de quelqu'un qui ne peut plus entrer, et il faisait quinze pixels de haut.

### LES DEUX EXCEPTIONS DU PLANCHER TACTILE SONT NOMMEES, PAS OUBLIEES

La sonde de rendu a appris les deux exceptions du critere 2.5.8 de WCAG 2.2, et elle les COMPTE
a part au lieu de les taire : **un lien en ligne dans une phrase** (« politique de
confidentialite », « En creer un ») et **une case a cocher NATIVE enveloppee par son `<label>`**,
dont la taille est celle de l'agent utilisateur. Quarante cibles exemptees sur les quatre
configurations, toutes listees dans le rapport.

**ET IL A FALLU MESURER COMMENT CHROMIUM REND `display`** : un `<button>` a qui la feuille dit
`display:inline` ressort **`inline-block`** de `getComputedStyle`. Le premier jet de l'exception
ne testait que `inline` et ratait la ligne de bascule de la porte. On accepte donc toute la
famille `inline*`, MAIS on exige en plus du texte a cote, dans le meme parent : sans cette
seconde moitie, `inline-block` aurait exempte tous les boutons pleins du produit, c'est-a-dire
exactement ceux qu'on cherche.

### CE QUI FERME LE TROU DANS LE HARNAIS

**`scripts/bureau-garni.mjs` sait fermer le bureau.** `garnirLeBureauDeconnecte()` efface la
session au lieu de compter sur son absence (un contexte reutilise rendrait le harnais
silencieusement connecte), et double le SERVEUR, pas le client, comme pour « L'equipe » :

    /auth/v1/recover  -> 200 {} ............ « Mot de passe oublie ? » mene au code a 6 chiffres
    /auth/v1/verify   -> 200 + une session .. le code valide mene au nouveau mot de passe
    /auth/v1/signup   -> 200 sans jeton ..... `inscription()` rend { confirmer:true }
    /auth/v1/user     -> 200 {} ............. le PUT du nouveau mot de passe
    /rest/v1/rpc/invitation_apercu .......... le bandeau, ouvert a `anon`

Toute autre adresse Supabase est refusee par le MEME `TypeError` qu'un reseau coupe : le reste du
decor ne bouge pas d'un pixel.

**`ouvrirLaPorte()` PASSE PAR LE VRAI GESTE, ET LES TROIS CHEMINS NE DONNENT PAS LE MEME ECRAN.**
Le bouton de `.bureau-vide` ouvre en mode CONNEXION (decision du 11/09/2026) ; le bouton
« Je cree mon compte » du bandeau est le SEUL chemin qui passe `email`, donc le seul qui montre
le champ d'adresse impose et en lecture seule ; la bascule du pied montre l'autre moitie de
l'ecran d'acces. On ne leve jamais un `hidden` a la main, et `poserMode()` reecrit six choses a
chaque bascule : **chaque etat a son propre contexte**, une porte promenee dans trois etats n'est
plus celle qu'on croit photographier.

**ET DEUX GARDE-FOUS QUI LEVENT.** `verifierLeBureauDeconnecte()` refuse le releve si une session
traine, si `#bureauContenu` est visible, si le `h2` est vide, si le corps ne porte pas
`bdv-coque` ou s'il porte `bdv-poste` sans session. `verifierLaPorte()` refuse l'image si
l'etape affichee n'est pas celle demandee, si l'adresse imposee n'est pas en lecture seule, ou
si aucune regle de mot de passe satisfaite n'est peinte.

### ET DEUX APERCUS MENTAIENT ENCORE, DEPUIS LA SCISSION DU 21/09

Meme famille que `apercu:equipe`, meme jour d'origine, deux fichiers de plus :

- **`npm run apercu:invitation`** ne posait que `style.css`, ou il ne reste plus **une seule**
  regle `.invitation-*` : il rendait le bandeau entierement NU. C'est le seul ecran que voit un
  invite.
- **`npm run apercu:amorce`** posait trois feuilles sur quatre et oubliait `bdv-poste.css`, ou
  vivent les **21** regles `.bdv-amorce__*` du dessin. Il en reste **zero** dans `style.css`.

Les deux posent maintenant les quatre feuilles **dans l'ordre ou le gabarit les lie**,
`bdv-coque` sur le corps de page, et les deux themes cote a cote.

**ET UN APERCU NEUF, `npm run apercu:porte`**, parce que la porte n'en avait aucun alors qu'elle
est le premier ecran du produit. Cinq ecrans, TROIS colonnes : le site en papier a gauche, le
bureau dans ses deux themes a droite. C'est le seul harnais du depot qui montre les deux mondes
COTE A COTE, et c'est la seule facon de voir d'un coup d'oeil qu'un recouvrement n'a pas deborde.
Le style injecte par `bdv-compte.js` y est pose APRES les feuilles, comme dans le produit : le
poser avant ferait mentir l'apercu dans le sens le plus dangereux, celui qui declare vert un
recouvrement mort.

**UN ACCENT GRAVE DANS UN LITTERAL DE GABARIT FERME LA CHAINE.** Le commentaire de
`apercu-invitation.mjs` citait un nom de jeton entre accents graves, dans un litteral de gabarit :
`SyntaxError` immediate. Meme piege que la constante `STYLE` de `bdv-reglages.js`, autre
mecanisme, meme cause. **Les commentaires ecrits DANS un litteral de gabarit citent les noms
entre guillemets francais, jamais entre accents graves.**

### LA CORRECTION, ET OU ELLE VIT

`bdv-bureau.css`, **section 21 neuve** pour l'ecran d'invitation et **trois regles ajoutees a la
section 20** pour la porte. Rien dans `style.css` ni dans `bdv-compte.js` : les deux sont
partages avec le site, donc on RECOUVRE.

- `.bdv-coque .bureau-vide h2{color:var(--bdv-encre-1)}` : (0,2,1) contre (0,0,1).
- `.bdv-coque .bureau-vide .btn{min-height:var(--bdv-cible)}` : (0,3,0), parce que
  `.bdv-coque .btn{min-height:36px}` de la section 8 pese (0,2,0) et vit dans la MEME feuille.
- `body.bdv-coque .bdv-porte__btn` et `.bdv-porte__lien` : `body.bdv-coque` et pas `.bdv-coque`,
  parce que le style de la porte est injecte APRES les feuilles : il faut (0,2,1) pour passer
  devant, et c'est le motif de toute la section 20 depuis le lot 5.
- `body.bdv-coque .bdv-porte__bascule .bdv-porte__lien{display:inline;min-height:0}` : **et sans
  cette regle la precedente cassait la mise en page.** `.bdv-porte__lien` est `display:block`
  dans le style injecte SAUF dans la ligne de bascule, ou `.bdv-porte__bascule .bdv-porte__lien`
  (0,2,0) le remet en ligne au milieu d'une phrase. Mon selecteur a (0,2,1) aurait gagne contre
  elle et sorti « En creer un » de son texte. **Meme piege que la classe de BASE d'une variante
  au lot 7, et il se paie en mise en page, pas en couleur.**

### CE QUI RESTE EN PAPIER SUR CET ECRAN, ET C'EST ARBITRE

La page deconnectee ne porte **pas** `body.bdv-poste` : le bandeau marchand et le pied de page du
site sont a l'ecran, en bordeaux, et le hero `#bureauInviteHero` est le composant `.about-hero`
de /a-propos/ et de /la-redaction/. **116 valeurs papier**, et elles restent. Deux raisons, et la
seconde est la vraie :

1. **le contraste passe** : chacun de ces trois blocs porte son propre fond opaque, et le `h1`
   du hero est a **12,69:1** dans les deux themes ;
2. **repeindre le seul hero rendrait l'ecran MOINS coherent**, pas plus : une bande themee entre
   une barre bordeaux et un pied bordeaux. Le jour ou on voudra un bureau deconnecte entierement
   theme, c'est la coque partagee qu'il faudra sortir, et c'est un autre chantier avec un autre
   arbitrage.

**L'audit les compte donc dans un seau A PART**, jamais melange a celui du bureau : melanger les
deux ferait disparaitre un vrai defaut du bureau dans le bruit du site.

### LE BANC DE SORTIE, DEUX SEAUX, ET LE PREMIER PASSAGE A REFUSE

`"Claude outputs/lot9-empreinte.mjs"`, repris de `lot6-empreinte.mjs` sans une ligne de
changement sur ses 45 etats, plus **32 etats neufs** : les sept etats du bureau deconnecte dans
les deux themes et aux deux largeurs, la page `/outils/echeances/` (la SEULE page publique qui
partage `.bureau-vide` avec le bureau), et **la porte ouverte depuis `/compte/`**, aux deux
largeurs. **77 etats, 61 760 elements, 182 822 releves de 139 proprietes, 25 412 258 valeurs.**

    SEAU 1, le bureau deconnecte ............ 2 633 ecarts, et c'est le lot
    SEAU 2, les 45 etats a session, les sept pages publiques
            et la porte ouverte depuis /compte/ ... ZERO

Contre DEUX releves de reference, et verifie par mutation : un `word-spacing:3px` glisse dans les
**726 blocs** des deux feuilles SERVIES fait passer le seau 2 de 0 a **140 590**.

**LE PREMIER PASSAGE A SORTI 825 ECARTS HORS PERIMETRE, soit 25 par etat connecte, et c'est une
lecon.** `#bureauInvite` et `#bureauInviteHero` existent dans le DOM de TOUTES les pages du
bureau, connectees comprises : ils y portent `hidden`, donc ils ne peignent pas un pixel, mais
`getComputedStyle` REND les valeurs d'un element cache. C'est la lecon du lot 8 sur
`.calbloc__trous`, prise dans l'autre sens. **Le tri par cle d'etat ne suffisait pas : il faut
aussi les deux chemins d'element**, releves par `lot9-chemins.mjs` sur la page construite et a
reprendre le jour ou l'ordre des blocs de `src/mon-bureau.njk` change. La porte, elle, n'a pas de
chemin en dur : elle est ajoutee a la fin du `<body>` et sa place bouge, donc elle n'existe que
dans les etats du seau 1 et dans `porte-publique@…`.

### LA PREUVE QUI COMPTE LE PLUS : LA PORTE VUE DU SITE N'A PAS BOUGE

`porte-publique@1440` et `porte-publique@390` sont dans le SEAU 2, donc a zero ecart. Ce sont les
deux seuls etats du depot ou la porte s'ouvre sur une page qui ne porte pas `bdv-coque`, et
l'etat refuse de se relever si `/compte/` se met a porter cette classe. Aucun des 45 etats du lot
6 n'ouvrait la porte : jusqu'a ce lot, **rien ne mesurait le monde papier de cet ecran**.

### UNE SONDE DE RENDU, PLUS QUATRE COPIES

La sonde de contraste etait ecrite EN ENTIER dans `lot3-`, `lot4-`, `lot5-` puis
`lot8-audit-contraste.mjs`, soit quatre fois. Elle vit maintenant seule dans
`"Claude outputs/lot9-sonde-rendu.mjs"`. Ce n'est pas du rangement : le premier jet de la version
du lot 8 comptait **53** valeurs papier la ou il y en avait **11**, faute de garder
`border-*-color` quand la bordure a zero pixel, **et les trois copies precedentes portent encore
ce defaut**. Un decor, une sonde ou un banc copie porte ses defauts a l'identique, et les corriger
d'un cote ne corrige rien de l'autre.

### CE QUI RESTE OUVERT APRES CE LOT

- ~~**`apercu:panneau`, `apercu:modale`, `apercu:ardoise` et `apercu:mot` posent encore moins de
  feuilles que la page qu'ils montrent.**~~ **FAIT LE 22/09/2026**, avec `apercu:fiche` qui en
  posait trois sur cinq, voir « UN APERCU CHARGE CE QUE CHARGE LA PAGE QU'IL MONTRE » plus bas.
  Ce n'est plus une convention : `npm run banc:apercus` le tient, et il est dans `npm run verif`.
- **Le voile d'amorcage n'est toujours pas photographie sur une base VIDE sans reseau** : point
  ouvert du lot 5, inchange.
- **Les 116 valeurs papier du chrome du site sur l'ecran deconnecte** restent, avec l'arbitrage
  ci-dessus.
- **Les 91 appels papier de `bdv-ecrans.css`** et **les 51 de `bdv-calendrier.css`** restent, avec
  leurs motifs des lots 4 et 7.
- **Le thermometre 2 n'a pas bouge** : 56,9 ko de `style.css` voyagent toujours dans le bureau.

## UN APERCU CHARGE CE QUE CHARGE LA PAGE QU'IL MONTRE, 22/09/2026

**LA REGLE, ET C'EST UN BANC QUI LA TIENT DESORMAIS, PAS UNE CONVENTION :**

> **Un apercu charge exactement ce que charge la page qu'il montre : les feuilles LIEES par le
> gabarit, dans leur ordre, plus celles que du code pose pour l'ecran qu'il montre, apres elles.
> Et il porte le scope de cette page sur son corps.**

**CE DEFAUT S'EST PAYE HUIT FOIS**, et c'est ce qui a fait ecrire le banc :

    apercu:equipe ....... une journee entiere de piece NUE               21/09
    apercu:invitation ... bandeau NU, le seul ecran que voit un invite   21/09
    apercu:amorce ....... trois feuilles sur quatre                      21/09
    apercu:fiche ........ trois sur cinq                                 22/09
    apercu:modale ....... trois sur quatre, il manquait bdv-poste.css    22/09
    apercu:ardoise ...... style.css SEULE, donc un ecran nu              22/09
    apercu:mot .......... style.css SEULE                                22/09
    apercu:panneau ...... style.css SEULE                                22/09

Les cinq derniers datent de la scission du 21/09/2026 : depuis ce jour-la, `style.css` ne porte
plus les regles du bureau, elles vivent dans `bdv-poste.css` et `bdv-bureau.css`. **Un apercu qui
ne pose que `style.css` rend donc un ecran NU, et il ne le dit pas.** Les apercus ne verifient
rien, ils MONTRENT : c'est ce qui les rend precieux (`apercu:mot` a trouve un lien invisible que
les 78 controles du banc declaraient pose, `apercu:modale` une regle du projet enfreinte sur un
ecran que 115 controles validaient, `apercu:fiche` MONTRAIT « domaine NaN € » pendant des jours),
et c'est aussi ce qui les rend silencieux quand ils mentent.

### LA VERITE VIENT DE LA PAGE CONSTRUITE, JAMAIS D'UNE DEUXIEME LISTE

`scripts/apercu-socle.mjs` lit les feuilles LIEES sur `_site/mon-bureau/index.html`, `<link>` par
`<link>`, en ne gardant que les href locaux, et dans l'ORDRE du gabarit. Aucun apercu ne tient
plus de liste a lui : une liste tenue a la main ment le jour ou on l'oublie, et celle-ci avait
deja menti huit fois. Les trois feuilles posees par du JavaScript, elles, ne sont dans aucun HTML
et restent NOMMEES A LA MAIN, une seule fois, dans `scripts/feuilles-bureau.mjs`, d'ou
`scripts/charte.mjs` les lit aussi depuis ce jour : elles y etaient ecrites une deuxieme fois.

### CE QUE `npm run banc:apercus` REFUSE, ET IL EST DANS `npm run verif`

1. un apercu qui ne prend pas ses feuilles du socle, donc qui s'en refabrique une liste ;
2. une liste a lui ou il manque une feuille liee, ou qui les met dans le desordre ;
3. une feuille en plus qui ne soit pas l'une des trois posees par du code ;
4. un apercu qui ne pose pas le scope `bdv-coque`, ou qui ne rend pas les deux themes ;
5. un socle qui se remettrait a ecrire une liste en dur.

**L'EXCEPTION EST NOMMEE AVEC SA RAISON, ET ELLE EST CONTROLEE ELLE AUSSI.**
`apercu-courrier` ne pose AUCUNE feuille du bureau : un mail est autonome, aucune messagerie ne
charge de feuille externe, tout son dessin est en style de ligne dans `bdv-courrier.js`. Le banc
echoue le jour ou ce fichier se mettrait a en poser une. Une exception qu'on ne voit plus
redevient un oubli.

**VERIFIE PAR MUTATION, TROIS FOIS.** Une liste ecrite a la main dans `apercu-mot` sans
`bdv-poste.css` : 4 echecs, dont « Il manque : src/css/bdv-poste.css ». La meme liste complete
mais dans le desordre : 4 echecs, dont l'ordre. Une liste en dur remise dans le socle : 2 echecs.
Un controle qui n'a jamais echoue ne garde rien.

### ET LE HARNAIS PORTE L'ETAT DE LA VRAIE PAGE, PAS SEULEMENT SES FEUILLES

Deux mesures du 22/09/2026, et les deux disent la meme chose sous deux formes :

1. **`bdv-poste` manquait sur le corps de page.** Toutes les regles telephone s'ecrivent
   `body.bdv-poste ...` sous 700 px (regle du 11/09/2026, « le site public sort du bureau »).
   Sans cette classe, la sonde de rendu comptait a 390 px **quinze cibles sous 44 px sur la
   modale et quatre sur le panneau**, qui n'existent pas dans le produit. La planche du socle
   pose donc `bdv-coque bdv-poste`, et `poste: false` existe pour un ecran vu sans session.
2. **`apercu:modale` ne prenait que `.tmod__boite`, sans son `.tmod`.** Or tout le plancher
   tactile du telephone s'ecrit `.tmod__x, .tmod__g, .tmod__lien, .tmod__i, .tmod__d, .tmod .btn`,
   plus `.bdv-coque .tmod .btn` de la section 18 : sans cet ancetre, aucune ne s'applique. Les
   quinze cibles sont passees a **zero** en remontant d'un element.

**LA LECON : un harnais qui ne monte pas l'ETAT et l'ANCETRE de la vraie page invente des
defauts, ce qui coute autant que d'en laisser passer.** C'est le pendant exact de « une piece
qu'un harnais rend vide n'est pas une piece verifiee ».

### CE QUE LES DIX IMAGES ONT MONTRE

Cinq apercus, deux themes, sonde de rendu de `Claude outputs/lot9-sonde-rendu.mjs` (celle-la et
pas une autre : ses trois copies anterieures portent un defaut de comptage), a 1440 et a 390 px.

**ZERO paire sous son seuil, sur les dix images, aux deux largeurs.** C'est une bonne nouvelle et
elle se mesure aussi. Zero valeur papier sur le mot du jour, le panneau, la modale et la fiche ;
zero cible sous 44 px et zero saisie sous 16 px a 390 px, sauf ce qui suit.

**DEUX VALEURS PAPIER SUR L'ARDOISE, ET ELLES NE PEIGNENT RIEN.** `a.chiffre` prend
`color: var(--bordeaux)` de la regle `a{}` de `style.css` : `--bordeaux` sur `--bdv-surface` en
sombre vaut 1,37:1. Mesure element par element : les trois enfants qui portent du texte
(`.chiffre__l`, `.chiffre__v`, `.chiffre__s`) nomment tous leur encre, et les `::before` des
fleches en heritent, donc **aucune lettre n'est peinte en bordeaux aujourd'hui**. C'est la meme
situation que `.calbloc__trous` au lot 8, et le meme arbitrage : **non corrige**, parce que le
banc d'empreinte rend les valeurs calculees d'un element meme quand elles ne peignent pas, et que
la corriger sortirait des ecarts pour zero pixel change. **C'est un piege pose pour plus tard** :
le premier enfant ajoute dans `.chiffre` sans encre a lui sortira a 1,37:1 en sombre. Le
correctif, le jour ou on le prendra, est une declaration `color` dans
`.bdv-coque .chiffre` de `bdv-bureau.css`, et il se paie d'un passage du banc d'empreinte.

**CINQ CIBLES SOUS 44 px SUR LE PANNEAU A 390 px, ET C'EST LA SONDE QUI SE TROMPE.**
`a.postit__lien` mesure 268x21, mais son `::after` est en `inset: 0` sur un `.postit` de
281x109 : la cible reelle, c'est le papier entier. La sonde mesure le rectangle de l'element, pas
celui de son calque. A savoir avant de « corriger » une punaise.

### CE QUE CETTE PLANCHE NE PEUT PAS MONTRER

Les deux themes sont COTE A COTE, donc chaque colonne fait la moitie d'un ecran : le plan y tient
environ 660 px au lieu des 1 140 px d'un 1440. Les zones en quatre colonnes sur douze s'y
replient plus tot qu'en vrai, et l'en-tete du courrier deborde de sa zone. **On juge ici les
couleurs, les filets, la hierarchie et les etats ; une LARGEUR se juge a `npm run banc:large`**,
qui mesure a la largeur de l'ecran de Ted.

## JAMAIS UN SECOND LIEN GOOGLE FONTS, 18/09/2026, REVU LE 21/09/2026

**LE PREALABLE EST LEVE A MOITIE. LE LIEN N'EST TOUJOURS PAS SCINDE, ET ON NE LE SCINDE PAS
AUJOURD'HUI.**

Ce qui est FAIT depuis le 21/09/2026 : `style.css` est scindee en une feuille publique et une
feuille bureau, et `scripts/charte.mjs` controle chaque moitie contre son propre lien.
`npm run charte` lit les feuilles declarees dans `FEUILLES_SITE` contre le lien de
`src/_includes/base.njk` ; `npm run charte:bureau` lit la page construite du bureau, donc ses
feuilles a elle, `bdv-poste.css` comprise, contre le lien que cette page porte vraiment.

Ce qui N'EST PAS FAIT : le lien lui-meme. Tant qu'il n'y en a qu'un, **le danger d'origine est
intact** : `charte.mjs` lit le lien avec `/family=([^&]+)/g` applique au TEXTE ENTIER du fichier,
et pour un meme nom de famille **la derniere occurrence ecrase les precedentes**. Avec deux
liens :

- lien mince ecrit AVANT le plein : le garde-fou voit l'union des deux, declare CONFORME, et les
  pages publiques rendent en faux gras. **C'est l'incident des 376 passages en gras, reproduit a
  l'identique, avec le controle qui le couvre au lieu de l'attraper.**
- ordre inverse : Fraunces retombe a 400 et il crie au faux gras sur des titres qui vont bien.

**CE QUI RESTE A FAIRE AVANT DE SCINDER LE LIEN : apprendre a `charte.mjs` a lire le lien de SA
cible et de sa cible seule.** Aujourd'hui il lit un fichier entier ; il lui faudra lire le lien
de la page construite en mode site comme il le fait deja en mode bureau, ou refuser si le fichier
en porte deux.

### ET LA MESURE A RETOURNE LA PHRASE D'ORIGINE, 21/09/2026

La version du 18/09 disait : « `Caveat` ne sert que sur l'accueil, `JetBrains Mono` sur aucune
des douze pages plates ». **La premiere moitie est vraie, la seconde est fausse, et le gain est
du cote qu'on n'attendait pas.** Releve au navigateur, famille resolue element par element sur
seize pages publiques et sur les neuf pieces du bureau :

| famille | pages publiques | bureau |
|---|---|---|
| Inter | 1 392 | 4 784 |
| Fraunces | 208 | 60 |
| JetBrains Mono | 116 (accueil, articles, un article, une rubrique) | **0** |
| Caveat | 6 (accueil seul) | **0** |

**C'est le lien du BUREAU qui peut maigrir, pas celui du site.** Le bureau n'utilise plus une
seule fois la chasse fixe depuis que `bdv-bureau.css` a repeint la coque en Inter, et il n'a
jamais eu de manuscrit. Le site, lui, a besoin des quatre : `Caveat` pour le cahier de chai de la
demonstration, `JetBrains Mono` pour les etiquettes de rubrique et les metadonnees d'articles.

**LES OCTETS N'ONT PAS PU ETRE MESURES DEPUIS LA SESSION** : le pont de cette session refuse
`fonts.googleapis.com`. Ne pas recopier les « 60 a 90 Ko » de la version du 18/09, qui etaient
une estimation et qui portaient sur le mauvais cote. La mesure tient en une commande sur le Mac,
et elle doit etre faite AVANT d'ecrire un chiffre :

```
curl -sA "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Caveat:wght@400;500&display=swap" \
  | grep -o 'https://[^)]*woff2' | sort -u | xargs -n1 curl -sw '%{size_download} %{url_effective}\n' -o /dev/null
```

Piege connexe a savoir, et il n'a pas bouge : `--font-chiffre` n'est pas dans la table `FAMILLE`
de `charte.mjs`. Une graisse demandee dessus est rangee « famille systeme, hors controle » alors
qu'elle tire sur Inter. Retirer Inter 700 du lien ne leverait aucune alerte et remettrait du faux
gras sur l'accueil.

## UN GESTE DESTRUCTIF EXIGE UNE PREUVE, PAS UN SILENCE, 18/09/2026

Ted a vide sa base pour en remettre une autre. Le navigateur a vide sa copie locale, il a vu
un bureau vide, il a importe le nouvel export. Mesure le soir : **176 779 lignes sur le
compte, soit 171 569 ANCIENNES toujours la plus 5 210 nouvelles.** Deux bases melangees.

TROIS PIECES SE TENAIENT LA MAIN : la fonction SQL rendait `void`, `effacerTout()` avalait
l'exception et rendait `false`, `viderBase()` ne regardait pas ce retour. Chacune est un
petit relachement ; ensemble elles font un bouton qui efface ce que le vigneron VOIT et
laisse ce qu'il ne voit pas.

**LA REGLE : une fonction qui detruit rend ce qu'elle a detruit, et relit ce qui reste.** Si
ce n'est pas zero, elle LEVE. L'appelant exige cette preuve avant de toucher a quoi que ce
soit chez lui. Un `void` ne se verifie pas, et une exception avalee ressemble a un succes,
surtout sur une fonction `security definer` qui leve sur un non-maitre.

ET LA CORRECTION NE DEPEND PAS DU DIAGNOSTIC. J'avais annonce un depassement de delai sur le
DELETE : **faux**, 1 377 ms mesures sur un Postgres 16 avec les memes 171 569 lignes et le
meme declencheur par ligne. On ne sait toujours pas pourquoi le vidage a echoue chez Ted, et
on ne le saura jamais : l'erreur a ete avalee. C'est precisement pour ca que la preuve vaut
mieux qu'un diagnostic.

Controle : `npm run banc:vidage`, qui fait tourner `effacerTout()` sur les quatre reponses
possibles d'un serveur. Etalonne a 16 echecs sur la version d'avant.

## UN TEXTE DE CONFIRMATION NOMME CE QU'ON PERD, 18/09/2026

« Cette action est definitive » ne dit rien a personne. Ce qui parle : la liste de ce qui
part AVEC ses chiffres, et le fait que **rien de tout ca n'est remonte dans Vitisoft**. Les
notes de suivi, les echanges et le classement n'existent QUE dans le bureau.

Demande de Ted, mot pour mot : « attention tu vas perdre TOUT ce que t'as fait dans le bureau
du vigneron, c'est pas remonte dans Vitisoft ».

## ON NE PROPOSE PAS DE REGLER CE QU'ON N'A PAS ENCORE, 18/09/2026

Apres un vidage, `openApp()` ouvre le panneau parce que la base est vide, et on tombait sur
« Le classement » : deux selecteurs qui proposent de designer une colonne parmi celles de ses
lignes, sans lignes. `gateBaseVide()` ecarte cet onglet tant qu'il n'y a rien a classer et
ouvre sur « Ma base », la ou se depose l'export.

La marque est `data-off-vide`, DISTINCTE du `data-off` de `gateVitisoft` : deux gardes qui
ecrivent le meme attribut finissent par se defaire l'une l'autre.

## CHARGER SES LIGNES NE DOIT PAS DETRUIRE LE CACHE, 18/09/2026

`resumes_perimer_reg` partait sur TOUT `update` de `reglages`. Or `deposerPourLeBureau()`
ecrit `file_travail`, `resume_ventes` et `depose_le` apres chaque chargement des lignes, et
aucun resume n'en depend. **Les deux gestes que le vigneron enchaine naturellement, charger
puis regarder, se sabotaient l'un l'autre.** Mesure sur un HAR : `cap` et `commerce` calcules,
ranges, puis effaces avant d'avoir resservi.

CE QUI COMPTE : `classement` (d'ou `v_ventes` tire canal et typologie, donc « Mon commerce »
et « Mes cuvees »), `objectif` et `exercice_debut` (que lit `cap_resume`). Rien d'autre.

**LA REGLE : un declencheur de peremption nomme les colonnes dont le cache depend.** Jamais
la table entiere. Double garde : `update of ...` filtre les colonnes CITEES, la comparaison
`is not distinct from` dans la fonction filtre les valeurs REELLEMENT changees.

## UN ECRAN SANS DONNEES NE REND PAS DE VERDICT, 18/09/2026

« Personne a relancer. Aucun client ne recule, ne rompt son rythme ni ne reste sans suite.
Profites-en. » sur zero ligne lue. Un vigneron qui lit ca et referme son bureau repart
rassure a tort. **Une liste vide parce qu'on n'a rien lu n'est pas une liste vide.**

Tout bloc qui conclut doit d'abord verifier `lignesPretes()`. Le modele est le bloc voisin,
qui disait deja « Decomposition indisponible. Il faut deux annees comparables ».

Celui-ci a ete trouve parce que Ted l'a VU a l'ecran, pas parce qu'un banc l'a dit. Les
autres blocs qui concluent n'ont pas encore ete passes en revue.

## UN COMPTAGE EXACT NE SE PAIE PAS POUR RIEN, 18/09/2026

`tirerVentes()` demandait `compterVentes()` meme quand le miroir local etait VIDE. Ce
comptage sert a rentrer sans rien tirer quand les deux cotes ont le meme nombre de lignes :
sur un miroir vide il ne peut rien eviter. **7 692 ms mesures dans un HAR, payes avant la
premiere page**, sur les 50 s du bouton « charger les donnees manquantes ».

ET LE BANC M'A REPRIS : ma premiere version sautait le cas « les deux sont vides », que
`banc-sync.mjs` protege. La bonne forme garde la garantie et change le prix : `limit=1` au
lieu de `count=exact`. Le banc dit maintenant ce qu'il veut vraiment dire : ce qui doit
rester a zero, c'est le nombre de PAGES, pas le nombre de requetes.

## ON A MESURE LA PIECE ET JAMAIS LA SERRURE, 18/09/2026 LA NUIT

`public.resume(b, cle)`, la porte du cache du lot 27, rendait **400 sur ses trois cles**
depuis sa livraison. `insert ... on conflict (bureau, cle)` : le nom de colonne `cle` est
ambigu avec le parametre du meme nom, Postgres leve 42702, et la fonction meurt APRES avoir
calcule. **La table `resumes` etait vide. Le cache n'a jamais retenu une ligne.**

POURQUOI AUCUN BANC NE L'A VU : `controle-commerce.mjs` et `controle-cuvees.mjs` appellent
`commerce_resume()` et `cuvees_resume()` DIRECTEMENT, et prouvent champ par champ que le
calcul est juste. Aucun n'appelle `resume()`. On a prouve la piece et jamais la serrure.

**LA REGLE : un banc qui appelle la fonction de calcul ne prouve rien sur la fonction que le
navigateur appelle vraiment.** Quand une fonction en enveloppe une autre, c'est l'ENVELOPPE
qu'il faut appeler, avec les memes arguments et par le meme chemin que le client.

LA CORRECTION : `on conflict ON CONSTRAINT resumes_pkey`. Le nom d'une contrainte ne peut
pas etre ambigu. Qualifier le parametre ne suffit pas : la cible d'un `on conflict` n'accepte
que des noms de colonnes nus. Et RENOMMER le parametre casserait le navigateur, parce que
**PostgREST associe les cles du corps JSON aux NOMS des parametres** : `bdv-sync.js` envoie
`{"b":..., "cle":...}`.

## UN COMPTAGE EXACT N'EST PAS UNE QUESTION D'AMORCAGE, 18/09/2026

`GET /ventes?select=empreinte` avec `count=exact` rend **500, `57014 statement timeout`** sur
les 171 569 lignes : PostgREST fait un `count(*)` sur tout le jeu filtre, 205 Mo a parcourir.

Quand la question est « y a-t-il des lignes », on ne demande pas « combien ». `limit=1` sort
de l'index en quelques millisecondes. `BdvSync.auMoinsUneVente()` fait exactement ca, et rend
`null` quand elle ne sait pas.

## UNE ABSENCE N'EST PAS UN ZERO, 18/09/2026. LE CAS DU MIROIR VIDE.

Ted : « quand on clique sur mon commerce, ca ouvre mes reglages tout seul. »

`openApp()` fait `if(baseVide()){ navTo('vide'); ouvrirPanneauReglages(); return; }`, et
`baseVide()` rendait `LIGNES_EN_BASE === 0`, c'est-a-dire le compte des lignes rangees dans
IndexedDB **SUR CET APPAREIL**. Sur un navigateur qui n'a pas encore synchronise, ce compte
vaut zero pendant que le compte du vigneron en porte 171 569. Le bureau concluait « base
vide, va importer » et posait le panneau par-dessus l'ecran demande.

La suite en cascade : le panneau calcule son classement, ecrit les reglages, ce qui PERIME
les trois resumes du lot 27, qu'il faut recalculer. Les 10,9 s de `rpc/resume` du HAR sont
la consequence du bug, pas une lenteur separee.

**LA REGLE, et elle est deja ecrite dans bdv-sync.js a propos du repere : un compte qu'on
n'a pas pu lire, ou qu'on n'a pas encore lu, NE VAUT PAS ZERO. Il ne vaut rien, et on ne
conclut pas dessus.** Le commentaire de l'amorcage se croyait deja conforme (« distinguer
base vide de lignes pas encore chargees ») : il distinguait le mauvais couple, local vide
contre memoire vide, jamais local vide contre serveur plein.

Desormais `baseVide()` exige que le SERVEUR dise vide aussi, et le comptage serveur n'est
demande que quand le miroir est vide. Controle : `npm run banc:base-vide`, etalonne a trois
echecs sur l'ancienne version.

## L'ORDRE DE TRI DECIDE DU TEMPS SERVEUR, 18/09/2026

`empreinte` est un hachage cyrb53. Sa correlation avec l'ordre physique de `ventes` vaut
**0,001** : trier dessus fait chercher 1000 lignes eparpillees dans 205 Mo, a chaque page,
173 fois. Mesure sur le HAR de Ted : mediane d'attente serveur **449 ms** par page, 104 s
pour la synchro complete.

Apres `cluster public.ventes using ventes_pkey` : **171 ms** de mediane, **35 s** de synchro.
Facteur 3, sans une ligne de code.

**MAIS LE CLUSTER NE SE MAINTIENT PAS.** Les lignes inserees apres repartent a la fin du tas.
La correction durable est de paginer `tirerVentes()` sur `maj_le`, dont la correlation vaut
deja 0,898 et dont l'index existe ; c'est ce que fait deja la voie rapide du lot 21.
`banc-sync.mjs:198` exige `order=empreinte.asc` et devra changer avec.

## AVANT D'OPTIMISER UN TRANSPORT, MESURER LE TRANSPORT, 18/09/2026 AU SOIR

**CETTE SECTION CORRIGE CELLE QUI SUIT, ET ELLE LA CORRIGE EN ENTIER.** La section
« LES 88 Mo QUI TRAVERSENT LE RESEAU » ci-dessous a ete ecrite le meme jour, quelques
heures plus tot, et son chiffre principal est FAUX. Elle est gardee telle quelle parce
que l'erreur vaut d'etre lue.

CE QUI EST FAUX : les 88 Mo ne traversent pas le reseau. C'est la taille des donnees DANS
LA BASE, et je l'ai appelee « ce qui traverse le reseau ». Il y a un facteur dix entre les
deux.

LA MESURE. Dix mille lignes de `ventes.brut` agregees en un texte, rangees dans une table
temporaire pour forcer la compression TOAST : 4 565 872 octets en clair, 470 365 apres
pglz. **Facteur 9,71.** Et pglz est l'algorithme le PLUS FAIBLE de la famille : gzip fait
mieux sur ce texte. La doc Supabase dit par ailleurs que les charges texte sont compressees
au CDN. La synchronisation tire donc de l'ordre de 8 a 9 Mo, pas 88.

POURQUOI LE CHANTIER DU DICTIONNAIRE EST MORT. **gzip EST un dictionnaire.** LZ77 remplace
toute chaine deja vue par une reference arriere : 131 noms de produits recopies 171 569
fois, c'est exactement ce qu'il ecrase. Construire a la main, dans le navigateur, avec un
banc de preuve et un risque sur cinq ecrans, ce que le transport fait gratuitement et
mieux, c'est du travail propre au service d'une idee fausse.

OU EST LE VRAI GOULOT. `tirerVentes()` boucle en SEQUENTIEL sur un curseur `empreinte`,
`PAGE = 1000` parce que PostgREST plafonne la. **171 569 lignes font 172 allers-retours,
l'un apres l'autre.** Chaque page pese 45 Ko compresses et arrive en un souffle ; c'est
l'attente entre les pages qui coute, et elle ne depend d'aucun octet. Les deux leviers sont
le reglage « Max rows » du projet Supabase (Project Settings, API, 1000 par defaut) et le
parallelisme par tranches d'`empreinte` cote navigateur. Petits tous les deux.

**LA REGLE : avant d'optimiser un transport, mesurer LE TRANSPORT.** Pas la taille a la
source, pas la taille a l'arrivee : le fil, avec ses en-tetes. Un `Content-Encoding` lu
dans l'onglet Reseau aurait economise une journee entiere de raisonnement juste sur une
premisse fausse.

## LES 88 Mo QUI TRAVERSENT LE RESEAU SONT 131 NOMS DE PRODUITS, 18/09/2026

Mesure du 18/09, sur le bureau de Ted, 171 569 lignes : la synchronisation tire **88 Mo**,
540 octets par ligne. Ce n'est pas 205 Mo : ce chiffre-la etait la taille du TAS de la table,
jamais passee au `VACUUM`.

**Brancher le navigateur sur `ventes_lignes` ne ferait gagner AUCUN octet, et c'est
contre-intuitif.** La facture est faite du CONTENU des colonnes, pas de l'emballage. Le
tableau positionnel des 43 champs ne coute que 131 octets de ponctuation par ligne ; les
memes colonnes en JSON nomme en couteraient 699. **Un `select=*` sur `ventes_lignes` serait
PLUS GROS que ce qu'on telecharge aujourd'hui.** La table etroite est un progres pour le
SERVEUR, mesure par le lot 23, et pour la justesse. Pas pour le reseau du navigateur.

D'ou viennent les 88 Mo, colonne par colonne : `produit` 25 Mo pour **131 valeurs
distinctes**, `cuvee` 25 Mo pour les memes 131, `emails` 4,3 Mo et `client_nom` 3,2 Mo pour
**1 936 clients**. **Cinquante des quatre-vingt-huit megaoctets sont 131 noms de produits
recopies sur chacune des 171 569 lignes.** C'est la repetition, et elle seule.

La forme qui reglerait ca : une table de faits mince (jour, cle client, numero produit,
quantite, total, tarif) plus deux petites tables de libelles servies une fois. Mesure :
11 Mo de faits, 180 Ko pour les 1 936 clients, 55 Ko pour les 131 produits. **88 Mo vers
11 Mo, soit 87 % de moins.**

**TROIS PREALABLES avant d'y toucher, et ils ne sont pas optionnels :**

1. `maj_le` n'existe pas dans `ventes_lignes`. Sans elle, la voie rapide du lot 21 meurt et
   chaque ouverture repart sur un rapatriement complet.
2. `banc-sync.mjs` reconnait les lectures au prefixe `/ventes?`. **Il faut le reecrire AVANT**,
   sinon il cesse de proteger sans le dire.
3. Le mode devine n'est pas porte cote serveur : tant qu'un vigneron n'a pas valide son
   classement, `v_ventes` ne rend rien d'exploitable, et le navigateur doit garder
   `classerLigne()` de toute facon.

## Ce qui se CALCULE ne se saisit jamais, 08/09/2026

Regle nee du lot 2 du chantier calendrier, et elle vaut au-dela de lui.

La base Notion du calendrier portait 55 phases de lune, 12 jours feries et 4 saisons, tapes a
la main, pour la SEULE annee 2026. Trois defauts dans un seul geste : ces lignes sont a
retaper fin 2026 puis fin 2027 ; elles etaient deja en double, les feries figurant sous deux
etiquettes ; et l'une d'elles etait fausse.

**La pleine lune de juin 2026 y etait datee du 29. Elle tombe le 30 a 01 h 57, heure de
Paris.** La ligne portait l'etiquette « calendrier lunaire, Paris ». Une donnee saisie ne se
verifie pas toute seule ; un calcul, si, et il vaut pour 2030 comme pour 2026.

Donc : **une date qui se deduit d'une formule connue ne rentre pas dans un fichier de
donnees.** Lune, saisons, jours feries, et le report au jour ouvre le jour ou on l'ecrira.
Ce qui reste dans `src/_data/echeances.json`, ce sont les dates qu'aucune formule ne donne :
les textes officiels et les rendez-vous.

## Le calendrier : cinq familles, et le fond de carte n'en est pas une

Les familles trient par CE QUE LE VIGNERON EN FAIT, pas par ce que la chose est :
`obligations` (ca coute une amende), `travaux` (ce que je fais dehors), `rendezvous` (je
m'inscris, je me deplace), `tempsforts` (ce que je poste et ce que je vends), et `taches`
(ce que j'ai note moi-meme). La liste vit a UN seul endroit, `FAMILLES` en bas de
`src/js/bdv-echeances.js`.

### La cinquieme famille n'a PAS de couleur, et c'est une mesure qui l'a decide

Ted, 08/09/2026 : « afficher les taches datees dans le calendrier », « creer une occurrence a
partir du calendrier », « creer une nouvelle categorie Tache ».

**Il n'y a pas de place pour une cinquieme serie sur ce papier.** La bande utilisable va de
L* 15 a L* 56 : au-dela, un objet graphique passe sous les 3:1. Cinq series dans 41 points de
luminance, c'est dix points d'ecart au mieux, et les trois repartitions mesurees donnent soit
deux series a 0,8 point l'une de l'autre, soit une derniere a 2,68:1. Aucune ne passe.

La cinquieme famille se distingue donc par la MATIERE, ce qui est la regle du plateau : le
calendrier est imprime, les taches sont ECRITES A LA MAIN dessus. `--font-manuscrit`, l'encre
du site, un filet pointille. Ca se lit sans couleur, donc aussi en niveaux de gris et en
vision deuteranope, ce qu'une cinquieme teinte n'aurait pas fait.

**Corollaire a ne pas oublier :** une sixieme famille ne pourra pas non plus prendre une
couleur. Elle prendra une matiere, ou elle n'existera pas.

### Les choix du vigneron : `calendrier_choix`, et la file qui appartient a quelqu'un

Lot 3, 08/09/2026. La table porte les ECARTS par rapport a la bibliotheque : le repere qu'il
ne suit pas, et celui qu'il decale. `src/js/bdv-calchoix.js` en est le SEUL ecrivain.

**Une ligne n'existe que s'il y a un ecart.** Suivi et non decale est l'etat par defaut du
monde : rallumer un repere et remettre son decalage a zero SUPPRIME la ligne. Sans cette
regle, la table porterait une ligne par occurrence et par compte, toutes neutres. Meme regle
que decocher une obligation dans la table des taches.

**Une obligation ne s'eteint ni ne se decale**, et le garde-fou est double : l'ecran ne montre
pas les gestes, et `reglesActives()` les ignorerait de toute facon. Deplacer une DRM de trois
semaines donnerait une date fausse avec l'autorite d'un texte de loi.

**LE DECALAGE S'APPLIQUE A LA DATE CANDIDATE, ET AVANT LE FILTRE DE FENETRE.** Le poser apres
avoir decide si l'occurrence tombe dans le mois donnerait une date juste dans une fenetre
fausse : un repere decale de trois semaines disparaitrait du mois ou il tombe, sans erreur.
`npm run banc:calchoix` garde les deux sens, celui qui entre dans le mois et celui qui en sort.

#### LA FILE D'ATTENTE APPARTIENT A QUELQU'UN, et c'est un defaut trouve par le banc

`id` pose a l'envoi et jamais chez l'appelant protege d'une premiere fuite : une ligne enfilee
hors ligne ne repart pas sous un compte fige (panne des signets du 07/09/2026). **Mais il en
cause exactement une seconde**, et elle n'etait dans aucun plan : le vigneron eteint un repere
hors ligne, se deconnecte, quelqu'un d'autre se connecte sur le meme navigateur, et le rejeu
ecrit le choix du premier SUR LE COMPTE DU SECOND.

`bdv-calchoix.js` retient donc, a cote de la file, QUI l'a remplie. Une file etrangere se
jette au lieu de se rejouer. Une file sans proprietaire, celle d'un geste pose avant toute
session, se reprend : c'est le vigneron qui note dans le train avant d'ouvrir son compte.

**`bdv-taches.js` ET `bdv-signets.js` ONT LA MEME FORME ET DONC LE MEME DEFAUT.** Signale a
Ted le 08/09/2026, pas corrige : ce sont deux modules qui marchent, et le chantier du jour ne
les touchait pas. Le correctif fait une quinzaine de lignes par module, sur le modele de
`bdv-calchoix.js`.

### Les taches datees ne sont PAS dans le fichier de donnees

Elles sont fabriquees en regles synthetiques par `reglesDesTaches()` dans
`src/js/bdv-calendrier.js`, a partir de `BdvTaches.datees()`, puis passent par le MEME calcul
que les autres. La cle porte le prefixe `tache:`, qui sert a deux choses : reconnaitre une
tache au moment de cocher, et garantir qu'elle ne collisionne jamais avec une cle du fichier.

**Une tache se coche par SON identifiant, jamais par un identifiant d'occurrence.** Une tache
est une ligne unique, elle ne revient pas tous les mois : lui fabriquer un `ech:...` creerait
une deuxieme ligne a cote de la sienne, et la premiere resterait non cochee pour toujours.

**Il n'y a pas de table `calendrier_perso`, et il ne faut pas en creer une.** Le plan en
prevoyait une au lot 3 ; la table `taches` fait deja le travail, avec son titre, son echeance
et sa date de realisation. Une deuxieme table pour la meme chose donnerait deux endroits qui
repondent « qu'est-ce que j'ai a faire le 12 ». Ce qui reste au lot 3, c'est l'activation des
reperes de la bibliotheque compte par compte, et les occurrences perso RECURRENTES, que la
table des taches ne sait pas porter.

**UNE TACHE PEUT DURER PLUSIEURS JOURS depuis le 08/09/2026**, colonne `fin_le`, facultative.
Le retard se compte alors sur la FIN et pas sur le debut : un salon du 9 au 11 fevrier n'est
pas en retard le 10, il a lieu. Deux dates a l'envers sont ECHANGEES et pas refusees, une fin
egale au debut est effacee (un jour n'est pas une periode), une fin sans debut devient le
debut. Le calendrier convertit ensuite la paire en `duree`, la forme que le calcul connait
deja : la tache porte deux vraies dates parce qu'elle ne se repete pas, la regle porte une
duree parce qu'elle recalcule sa fin chaque annee.

**« MES TACHES » NE MONTRE PAS TOUT LE FICHIER DE DONNEES.** Regression du lot 2, corrigee le
meme jour : `obligations()` prenait TOUT `echeances.json`. Tant qu'il portait cinq obligations
la regle 7 tenait toute seule ; avec les travaux, les salons et les temps forts, la piece est
passee de 5 lignes a 28 et proposait de cocher « Taille de la vigne » comme une DRM.

La piece porte donc son propre filtre de familles, avec ses propres defauts, ENREGISTRES A
PART de ceux du calendrier : obligations et notes allumees, reperes de saison, salons et temps
forts eteints. Partager le choix avec le calendrier voudrait dire qu'eteindre « Travaux » pour
nettoyer sa liste retire les vendanges de la grille, qui est justement l'endroit ou on veut
les voir.

Le banc n'avait rien vu parce que son bac d'essai ne contenait qu'une DRM. **Un jeu d'essai
plus petit que la realite ne verifie que ce qu'il contient.** Il porte desormais une occurrence
de chaque famille.

**Le calendrier n'affiche que les taches DATEES.** Une tache sans date n'a pas de place dans
une grille : le calendrier en annonce le nombre et mene a « Mes taches ». C'est la frontiere
que Ted a posee lui-meme, une occurrence porte une date, une tache peut n'en avoir aucune.

Le fond de carte, lune et feries, n'est pas une famille : il ne se coche pas, il ne porte pas
de source, il ne s'inscrit pas dans les taches. Un seul interrupteur l'eteint. Les melanger
aurait noye huit dates qui comptent sous soixante-dix qui ne demandent rien.

**La ligne a tenir dans `tempsforts` :** le calendrier porte des CAMPAGNES, le sous-main porte
des CLIENTS. Le jour ou une occurrence du calendrier nomme un client, le doublon de la regle 7
est de retour.

**La page publique `/outils/echeances/` ne montre QUE les obligations**, c'est la promesse de
son titre. Y deverser les travaux et les temps forts en ferait une page longue qui ne tient
plus son titre, et retirerait au bureau la seule chose qu'il offre de plus.

## Un ecart de contenu ouvert, repere le 08/09/2026

REFERME LE MEME JOUR. La page promettait qu'« un depot qui tombe un samedi, un dimanche ou un
jour ferie se reporte au premier jour ouvre suivant », et `prochaine()` ne le faisait pas :
elle rend la date brute de la regle. Ted a tranche, la phrase est retiree.

**Ne pas la remettre sans ecrire le report.** Les jours feries sont desormais calculables,
`BdvAlmanach.feries()`, donc le report est a portee : c'est une demi-journee, pas un chantier.
Mais promettre un calcul qu'on ne fait pas reste le pire des trois etats.

## Regles de contenu

- Aucun tiret cadratin nulle part. Remplacer par une virgule, un point ou deux points.
- Le vigneron est tutoye dans l'interface, ses clients sont vouvoyes dans les messages generes.
- Un chiffre affiche doit toujours dire d'ou il vient. Une case vide vaut mieux qu'une valeur inventee.

### Qui parle, decide le 10/09/2026

- **Le « je » porte l'avis, la conviction, le vecu.** Ce que Ted pense, a vu, a compris. Une
  conviction n'a pas de pluriel.
- **Le « nous » porte les realisations de Solumatic.** Ce qui a ete construit, forme, livre,
  visite. Ted n'etait pas seul, et l'ecrire au singulier est faux.
- **Un « nous » doit rester chiffre sur la meme page.** Un pluriel jamais rattache a un nombre
  ni a un nom se lit comme du remplissage marketing, et se saute. Ted a choisi le nombre plutot
  que les noms.
- **Les guillemets sont reserves aux mots reellement prononces par la personne citee**, a la
  premiere personne. Une description ecrite par le Bureau n'en porte pas. Le modele du vrai
  temoignage est dans `conseil-temoignage.njk`.

## LE DETAIL D'UNE COMMANDE SE DEPLIE, IL NE S'OUVRE PAS PAR-DESSUS, 24/09/2026

Dans « Ses commandes » de la fiche client, un clic sur une ligne deplie la facture en dessous
(`detailCommande()` et `basculerCommande()` dans `bdv-ecrans.js`, `.cmd__*` dans
`bdv-ecrans.css`). Arbitrage de Ted : pas de modale dans la modale.

- **Le detail porte les MEMES lignes que le total** (`facture.detail`, rempli dans
  `ficheClient()` sur les seules lignes `_vin`). Y ajouter d'autres lignes ferait un detail qui
  ne tombe plus sur le montant affiche.
- **Un prix unitaire vide reste vide** (`pu: null`), jamais `parseNum('')`, qui vaut 0.
- **Pas d'`onclick` sur la ligne** (la section B1 de la charte le refuse) : le bouton de la date
  est le seul arret clavier, et un ecouteur DELEGUE sur `document` bascule toute ligne
  `#modale tr.cmd`. Poser l'ecouteur sur les lignes le ferait mourir au premier redessin.
- **Le tableau interieur est dans un `table.data`** : ses regles s'ecrivent
  `.bdv-ventes table.data table.cmd__t ...`, sinon celles du tableau exterieur gagnent.

## LE COMPLEMENT DES LIGNES PASSE PAR L'EN-TETE, 24/09/2026

La carte « Charger mes lignes et completer » posee en bas de « Mon cap », « Mon commerce » et
« Mes cuvees » est SUPPRIMEE. Demande de Ted : un bouton « Mettre a jour » dans l'en-tete, qui
clignote quand il faut l'activer. Il s'appelle `#bureauMaj`, vit dans `src/mon-bureau.njk`, et
son dessin est la section 3 bis de `bdv-bureau.css`.

- **Un seul endroit decide s'il se montre, `besoinMaj()` dans `bdv-ecrans.js`.** Ecran dans
  `ECRANS_A_COMPLETER`, lignes pas pretes, base pas vide. Il est reevalue par `navTo()`,
  `ecranPeindre()`, `assurerLignes()` et `completerEcran()`, et `marquerActif()` de `bdv-nav.js`
  le cache sur les pieces qui ne sont pas de vente.
- **`noteComplement()` ne dessine plus rien**, elle retient la phrase de l'ecran, qui devient le
  nom accessible du bouton. Ne pas lui refaire rendre du HTML « pour que l'ecran dise ce qui
  manque » : ce serait remettre la carte que Ted a demande de retirer.
- **Il n'existe que quand il sert.** Pas d'etat « A jour » : ce serait le temoin de
  synchronisation qui ne lit rien, interdit plus haut pour cet en-tete.
- **Il pulse TROIS fois, pas indefiniment** (WCAG 2.2.2, 4,2 s), par un anneau d'`outline` et
  jamais par une `box-shadow` (ce fichier n'en pose aucune, et l'echelle des ombres est fermee).
- `npm run banc:amorcage-leger` le garde : bouton visible, nom qui dit ce qui manque, carte absente.

## LA LUNE MONTE DANS LE BANDEAU, ET LA BARRE SE REPLIE, 24/09/2026

Demande de Ted : une lune plus grosse, qui reste ENTIERE quand on fait defiler, et une barre
laterale qu'on peut ranger.

- **Un seul element, deux lieux.** `#bureauLuneMini` vit dans le coin de l'en-tete au repos ;
  au-dessus de 900 px et en-tete retracte, `logerLune()` (dans `brancherRetraction()`,
  `src/mon-bureau.njk`) le DEPLACE dans `.nav`, puis le repose avant `#bureauPeriode`. Le
  glissement est un FLIP fait apres coup, saute si `prefers-reduced-motion`. **Ne pas en faire
  une deuxieme lune dans le bandeau** : `peindreLune()` le retrouve par son id, ou qu'il soit.
- **Pourquoi deplacer et pas glisser en CSS** : l'en-tete porte `z-index:2` pour se coller, donc
  tout ce qu'il contient se peint SOUS le bandeau (`--z-nav`, 100). Lui donner une couche au-dessus
  ajouterait une valeur a l'echelle fermee des z-index de la section A de la charte.
- **Dans le bandeau, les encres sont celles du SITE** (`--on-dark`, `--on-dark-soft`,
  `--bordeaux`) : le bandeau ne se retourne pas en sombre, des `--bdv-*` s'y retourneraient.
  Mesures dans la section 4 bis de `bdv-bureau.css`.
- **Le logo du bandeau suit la grille du bureau** (`padding-left: rail + --bdv-e-6`). Le remettre
  centre sur 1100 px refait chevaucher la lune et le logo entre 901 et ~1420 px.
- **Le repli est a 64 px, JAMAIS a zero** : c'est la condition posee le 07/09/2026 en supprimant
  le premier. Classe `bdv-rail-replie` sur le corps de page, posee AVANT le premier rendu par le
  script en tete de `mon-bureau.njk`, et par `poserRepli()` de `bdv-nav.js` au clic. Cle
  `bureau_rail_v1`, **hors du prefixe `bdv_`**, meme raison que `bureau_theme_v1`. Le nom de chaque
  piece reste dans le DOM, masque visuellement : c'est le nom accessible du lien.
- **Le bouton de repli est DISCRET depuis le 25/09/2026** (demande de Ted) : un chevron seul, 44 px de cible, sans filet ni libelle visible. Le libelle reste dans le DOM, masque visuellement : c'est son nom accessible.
- **« Mes clients » est range SOUS « Mon cap »** depuis le 25/09/2026 (demande de Ted). L'ordre est garde par `banc-bureau.mjs`.
- **Le bouton est HORS de `.bureau-nav__liste`** : ce n'est pas une piece, et les bancs comptent
  `.bureau-nav__ligne`. Il n'existe qu'a partir de 1181 px ; en dessous la largeur decide seule.
- **`banc:poids` est a 119,9 ko sur 120.** Les commentaires d'un script EN LIGNE partent au
  navigateur (le crochet du build ne degraisse que `_site/js/`) : un pourquoi long va dans ce
  fichier, pas dans `mon-bureau.njk`.

### LE CALENDRIER FLOTTE, ET LA LIGNE DU SOUS-MAIN SE CLIQUE EN ENTIER, 24/09/2026

- **Le bloc calendrier de « Ma journee » est collant** au-dessus de 900 px (section 24 de
  `bdv-bureau.css`), decale du bandeau et de l'en-tete retracte, et **il s'arrete a l'ardoise**.
  Premier jet faux, mesure a la capture : la zone elle-meme en `sticky` passait PAR-DESSUS
  l'ardoise, Chromium bornant un collant a son PARENT (tout le plan), pas a sa cellule de grille.
  La zone s'etire donc sur sa rangee et ne sert que de rail ; c'est `.zone__flotte`, la carte a
  l'interieur, qui colle. **Ne pas remettre `sticky` sur la zone.**
- **Toute la ligne du sous-main ouvre la fiche**, comme dans « Mon commerce ». Mais PAS comme
  dans « Mon commerce » techniquement : la ligne porte des boutons d'action, donc elle ne devient
  pas un `role="button"` (un interactif dans un interactif, deja paye au sous-main et au post-it).
  Le nom reste le SEUL bouton ; l'ecouteur de clic de `mon-bureau.njk` rend au nom tout clic tombe
  ailleurs sur la ligne, sauf sur un bouton, un lien, un champ, une ligne deja traitee, ou pendant
  une selection de texte. Un arret clavier par ligne, comme avant.

### LE MOT DU JOUR EST MONTE DANS LE BANDEAU D'ACCUEIL, 24/09/2026

Demande de Ted : entre « Bonjour » et la lune, dans un cadre. La section `#zoneMot` a DEMENAGE
dans `.bureau-accueil`, avec sa classe `zone zone--mot` et ses ids : `peindreMot()`, ses trois
chemins de repeinture et ses bancs n'ont pas bouge. **Consequence : elle n'est plus un enfant
direct de `#bureauJournee`, et l'ordre controle par `npm run banc` passe a SEPT zones**, plus un
controle qui exige le mot entre le salut et la lune. Le cadre est la section 25 de
`bdv-bureau.css` : la carte du bureau et un filet d'accent de 2 px, rien de neuf dans les
echelles. Sous 700 px il passe sous la lune, pleine largeur.

## « MES CLIENTS » ET LA FICHE EN PLEINE PAGE, 24/09/2026

Demande de Ted : une base « Mes clients » pour faire des listings, et une fiche client qu'on ouvre
en PLEINE PAGE pour vraiment travailler dessus. Tout le code de la piece est dans
`src/js/bdv-annuaire.js`, charge APRES `bdv-ecrans.js` (RESSOURCES de `bdv-nav.js`), le dessin
dans `bdv-ecrans.css` (`.annu*`), la pleine page dans la section 26 de `bdv-bureau.css`. Le banc
est `npm run banc:annuaire`, dans `npm run verif`.

### LA PIECE EST UN ANNUAIRE, PAS UN TRI

- **Identifiant `annuaire`, libelle « Mes clients », avant « Mon commerce ».** `clients` est deja
  l'identifiant de « Mon commerce » et tient ses adresses. `viti: true`.
- **« Mon commerce » repond a « qui relancer », « Mes clients » a « qui sont mes clients ».** Ne
  pas y poser un verdict ou un conseil : ce serait refaire « Mon commerce » a cote de lui-meme.
- **Vitisoft fait foi** : aucune ecriture de coordonnees ne part d'ici. **Seuls les clients des
  exports** : la liste se CALCULE sur ROWS (`ECRANS_TOUT_LOCAL`), elle ne se saisit pas.
- **Elle marche sans classement valide**, en mode devine, la ou les resumes serveur rendent null.
- **Nom, ville, CP, pays viennent de la ligne la PLUS RECENTE du client.** `ficheClient()` fait
  pareil depuis ce jour (elle prenait `lignes[0]`, c'est-a-dire l'ordre des empreintes, donc un
  nom tire au sort). Les deux doivent rester d'accord.
- **La selection multiple exporte, etiquette et attribue. Elle ne pose JAMAIS de rappel** : c'est
  la note qui pose la trace (regle du 11/09/2026). Decision de Ted.
- **Les gestes groupes passent par CRM, `crmSave()` puis `BdvSync.ecrireSuiviLot()`** (une
  requete par tranche de 200), et une fiche videe par le geste par `syncSuivi()` qui la supprime.
  Jamais une ecriture du suivi a cote.

### LA FICHE A TROIS CONTENANTS, ET TOUJOURS UN SEUL AUTEUR

Modale, tiroir (section 22), et pleine page depuis ce jour : `ficheHTML()` reste l'unique auteur.
La pleine page est un ONGLET a l'adresse `/mon-bureau/#fiche=<cle>`, ouvert par « Agrandir »
(`agrandirFiche()`, par `window.open` pour que la croix puisse fermer l'onglet) ou par Cmd + clic
sur un nom.

- **`ouvrirPageFiche()` (mon-bureau.njk) demarre ALLEGE** : deux etapes d'amorcage, le bureau puis
  la fiche. Ni « Ma journee », ni file, ni panneau. `monter()` tourne quand meme, il sort #modale,
  #busyov et .status hors de la page.
- **`modeTiroir()` repond VRAI en pleine page** : pas de piege a focus, pas de vol de focus. Le
  contrat ARIA est pose par `poserPage()` (role main, sans aria-modal), jamais par `BdvTiroir`.
- **Echap ne ferme pas une page.** La croix ferme l'onglet, ou retombe sur « Mes clients ».
- **`.fiche__corps` et `.fiche__cote` valent `display:contents`** hors pleine page : ils ne
  changent rien a la modale ni au tiroir. Ne pas leur donner de dessin la-bas.
- **`#fiche=` au clic simple ouvre la fiche SUR PLACE** (`bdvOuvrirFiche`), sans changer de piece.
  `#client=` garde son sens d'avant (« Mon commerce » puis la fiche) : il est dans des favoris.
  Un lien `target="_blank"` n'est jamais rabattu par l'interception de `bdv-nav.js`.
- **« Agrandir » ne perd pas le brouillon** : il le sauve avant d'ouvrir et referme sans l'oublier.

### DEUX ONGLETS, UN SUIVI

CRM et ECHANGES vivent en memoire et `crmSave()` ecrit l'objet ENTIER : sans rien, le second
onglet a ecrire effacait le premier. Deux canaux, qui ne repondent pas a la meme question :
l'evenement `storage` recopie la memoire de l'autre onglet (avant le serveur, c'est voulu), et le
BroadcastChannel `bdv-bureau` dit de RELIRE LE COMPTE, emis seulement apres la confirmation du
serveur, ecoute dans `bdv-crm.js` (l'onglet de la liste n'a pas forcement le moteur). Le message
porte `onglet` : un BroadcastChannel livre aussi aux autres objets du meme onglet.

### LE LOT 33 : TOUT LE BUREAU ECRIT SUR LA FICHE, ET ON NOMME QUI

**AMENDE LA REGLE DU 13/09/2026 « chacun n'ecrit que ses propres lignes » POUR `suivi_clients`
SEULEMENT.** Decision de Ted : tout membre du bureau modifie et supprime n'importe quelle fiche
client, et la base signe chaque geste dans `maj_par` (declencheur `suivi_signer`, jamais le
navigateur). `proprietaire` est facultatif et doit etre un membre du bureau (le declencheur
refuse sinon). Les etiquettes (`tags`) deviennent donc communes. `vues_clients` porte les vues
enregistrees, communes au bureau. `echanges`, `taches` et `calendrier_choix` gardent la regle du
13/09.

- **La fusion au chargement a change avec** (`tirerDuServeurUneFois`) : une fiche SANS
  `_apousser` prend la ligne du serveur entiere ; l'ancienne regle ne vaut plus que pour une
  fiche qui a un geste en attente. Sans ca, on ne voyait jamais l'etiquette posee par un
  collegue, ni celle qu'il avait retiree.
- **`crmVide()` compte `proprietaire`** : sans lui, attribuer un client neuf le supprimait.
- **Le navigateur marche AVANT le SQL.** `lireSuivi()` lit `select=*` et decouvre les colonnes ;
  `proprietaire` ne part en ecriture que si `BdvSync.lot33()` a repondu `true` (trois etats, et
  une attribution rejouee demande d'abord). Nommer la colonne avant le SQL ferait refuser TOUTE
  ecriture du suivi, c'est-a-dire vider les rappels du bureau pour une colonne pas encore creee.
- **« Personne » part en `null` EXPLICITE** : absent du corps, l'upsert ne touche pas la colonne
  et l'ancien proprietaire resterait. Tout autre geste n'envoie pas le proprietaire.

### LE BUDGET BLOQUANT : LES COMMENTAIRES DU SCRIPT EN LIGNE SONT EN NUNJUCKS

Le script ecrit dans `src/mon-bureau.njk` portait 50 ko de commentaires JavaScript, envoyes au
navigateur a chaque ouverture (le crochet du build ne degraisse que `_site/js/`). Ils sont
devenus des commentaires Nunjucks `{# ... #}`, retires a la construction : 119,9 ko bloquants
tombes a 74,3, plafond de `banc:poids` descendu a 80. **Dans ce script, un pourquoi s'ecrit en
`{# #}`, jamais en `//` ni en `/* */`.** Un commentaire Nunjucks ne doit pas contenir `#}`.

### LES ETIQUETTES, 25/09/2026 (deuxieme version)

Ted : « gros souci de gestion des etiquettes, aucun moyen de les utiliser correctement ».
Cause : `crmSetTags()` ne redessinait pas la fiche (etiquette posee invisible), le champ
n'enregistrait qu'en le quittant, et rien ne proposait les etiquettes deja en usage.

Regles :
- `crmSetTags()` reste LE seul chemin qui ecrit `tags`. Il redessine la fiche ouverte
  (`redessinerSuivi()` repeint aussi `#fichePastilles`) et dedoublonne sans les majuscules.
- `crmAjouterTag()` / `crmRetirerTag()` : une etiquette tapee autrement qu'au bureau
  (« vip ») reprend l'orthographe en usage (« VIP »). Meme regle dans l'etiquetage groupe.
- Fiche : pastilles (clic = « Mes clients » filtre sur elle, via `BdvAnnuaire.voirEtiquette`,
  en pleine page par `sessionStorage bdv_annu_tag` + rechargement), champ + bouton « Ajouter »,
  « Déjà utilisées au bureau » en un clic, filtrees a la frappe.
- « Mes clients » : l'etiquette d'une ligne filtre la liste ; le filtre ignore les majuscules ;
  « Gérer les étiquettes du bureau » renomme (vers un nom existant = REUNIR), supprime en
  deux clics (le bouton dit combien de clients il touche), sans fenetre du navigateur.
- Renommer/supprimer passent par `ecrireGroupe()`, donc par CRM puis le serveur : avant le
  SQL du lot 33, les fiches ecrites par un autre membre seront refusees et le message le dit.
- Banc : section 6 de banc-annuaire.mjs (le jsdom du banc n'execute pas les `onsubmit`).

### LA FICHE REDESSINEE, 25/09/2026 (valable dans les TROIS contenants)

Ted, capture de la pleine page : « tres destructure et pas forcement tres utilisable ».
- **En-tete** : numero, ville, « client depuis », suivi par, pastilles (typologie, canal,
  etiquettes), puis QUATRE actions (Appeler en `tel:`, Ecrire, Noter un echange, Planifier un
  rappel). Les actions n'ecrivent rien : elles emmenent au bloc qui ecrit (`ficheViser()`).
- **Chiffres** : CA de l'EXERCICE compare au precedent, le RANG (« 15e client sur 1 012 », plus
  jamais « top 88 % »), la cadence et la PROCHAINE COMMANDE ATTENDUE. Le delai se dit « (fin de
  l'export) » : il se compte depuis la derniere vente de la base (regle du 19/09).
- **Le conseil** : la phrase en gras devant, le reste sous « Pourquoi je dis ça ».
- **Onglets** (motif ARIA, fleches) : Commandes, Ce qu'il achete (formats et millesimes),
  A lui proposer, Infos Vitisoft (champs perso sous leurs libelles). Le choix tient tant qu'on
  reste sur le meme client (`FICHE_ONGLET`).
- **`motifDeduit()`** : une fiche ouverte sans motif prenait le conseil du PREMIER ACHAT, « n'est
  venu qu'une fois », meme pour un client a dix commandes. Le motif se deduit (premier, cadence,
  regulier) et le branchement `regulier` existe dans `conseilClient()`.
- **« Ecrire » depliait le suivi** : `viserDansLaFiche('message')` prenait le premier
  `details.msg--replie`, qui est le suivi. Il vise `details.fiche__redac`.
- Les etiquettes sont des pastilles retirables une a une ; tout passe par `crmSetTags()`.

### PIEGE D'OUTIL, 24/09/2026 : UNE COPIE DEPOSEE N'EST PAS FORCEMENT LA DERNIERE

Depuis la session, un fichier depose sur le Mac par `device_commit_files` juste apres avoir ete
modifie dans le conteneur est arrive DEUX FOIS dans sa version d'avant, sans erreur. Apres tout
depot, comparer les `md5sum` des deux cotes, ou editer directement sur le Mac.

## IL N'Y A QU'UNE FICHE CLIENT, ET ELLE NE S'ECRIT PAS TOUTE SEULE, 11/09/2026

Le bureau avait la sienne, 280 lignes dans `src/mon-bureau.njk` : prochaine action, coordonnees,
fil. Elle est partie ce jour-la, avec ses 150 lignes de style. Celle qui reste est celle des
ecrans de vente, `ouvrirFiche()` dans `bdv-ecrans.js`, et elle s'ouvre depuis les deux endroits.

**Ne pas en recreer une deuxieme, meme petite, meme « juste pour le bureau ».** Deux fiches pour un
meme client, ce sont deux endroits ou noter un appel, et celui qui remplit les deux perd la moitie
de son travail le jour ou il n'en ouvre qu'un.

### Trois choses a savoir avant d'y toucher

1. **`#modale` vit dans `src/mon-bureau.njk`, PAS dans la coque des ecrans de vente.** La coque est
   dans `#bureauVentes`, masque tant qu'aucune piece de vente n'a ete ouverte : la modale y etait,
   et ouverte depuis « Ma journee » elle se serait peinte dans du vide, sans une erreur. Meme piege
   que « Ma base » le 08/09. `npm run banc` le garde, et c'est le seul controle qui le voit.
2. **`ouvrirFicheClient()` ne change pas d'ecran.** Ni `openApp()`, ni `navTo()` : le vigneron
   reste sur « Ma journee ». Elle charge la base si elle manque (`tirerDuServeur()` puis
   `reloadFromDB()`, dans cet ordre) et rend **`false`** si le moteur ne connait pas ce client, ce
   qui arrive sur un appareil ou aucun export n'a jamais ete depose. C'est l'appelant qui le dit au
   vigneron, parce que c'est lui qui sait d'ou venait le clic.
3. **Le bureau a UN seul ouvreur, `window.bdvOuvrirFiche`.** Le sous-main, le panneau, le
   calendrier et « Mes taches » passent tous par lui. Un deuxieme, c'est un deuxieme endroit ou
   rattraper une panne de reseau, et ils divergeront au premier message d'erreur reecrit.

### LE SOUS-MAIN N'ECRIT PLUS AU CLIC, et c'est la demande centrale

« Appele » et « Message » n'ont jamais rien ecrit depuis ce jour-la : ils ouvrent la fiche a
l'endroit qui correspond, et le geste reste EN ATTENTE. C'est l'enregistrement de la note qui
repousse le rappel de 30 jours, une seule fois, avec la trace de ce qui s'est dit. Fermer la fiche
sans rien ecrire ne laisse AUCUNE trace, et la ligne est toujours dans le sous-main.

Le report ne s'applique que si le vigneron n'a pas pose sa date lui-meme entre-temps : sa date est
un choix, le report du geste n'est qu'un defaut.

Ce qu'on a perdu, et c'est assume : le tri rapide de quinze relances en quinze clics. Ne pas le
retablir « pour aller plus vite » sans rouvrir la question avec Ted : c'est exactement ce qu'il a
demande de supprimer.

**`BdvCrm.GESTES` N'EST PLUS LA SOURCE DES LIBELLES DE CES BOUTONS.** La liste `ACTIONS`, en tete
du script de `mon-bureau.njk`, porte le mot court, la phrase complete et l'endroit a ouvrir. Seul
« Ecarte » y reprend son libelle dans `GESTES`, parce que lui pose toujours son geste. Un libelle
tire d'une liste de gestes qu'on ne pose plus est un libelle qui ment.

**« Message » ouvre le redacteur, et ne veut plus dire « repondeur ».** Un appel tombe sur un
repondeur se note dans le bloc de suivi, canal Repondeur, comme n'importe quel autre echange.

### Le suivi se replie, MAIS IL EST OUVERT A L'ARRIVEE

Demande de Ted le 11/09/2026 : le bloc de suivi se plie comme le redacteur de message. Il porte
donc un `<details id="suiviRepli" open>`, et **le `open` n'est pas negociable sans rouvrir la
question avec lui** : « un client a une prochaine action, ou il n'en a pas » est l'information la
plus importante de la fiche, et c'est la regle des trois etages du bureau. Un suivi replie par
defaut cacherait ce qu'on vient chercher.

Deux consequences a ne pas defaire :

- **Le `<details>` ENVELOPPE `#suiviBloc`, il ne le remplace pas.** `redessinerSuivi()` reecrit
  l'interieur a chaque geste : le repli survit au redessin. L'inverse rouvrirait le bloc a chaque
  note enregistree.
- **Tout ce qui renvoie vers ce bloc le deplie d'abord** (`deplierSuivi()`) : l'ouverture par
  « Appele » et le retour de « Considere comme envoye ». Un renvoi vers un bloc ferme est un renvoi
  vers rien.

### Le bureau se repeint APRES la reponse du serveur, jamais avant

La fiche ecrit par `bdv-base.js` (`CRM`, `syncSuivi`), le sous-main lit le miroir de
`bdv-crm.js` : deux caches differents de la meme table. D'ou `window.bdvFicheAEcrit()`, appelee
dans `syncSuivi()` **quand le serveur a confirme**. Relire avant, c'est ramener l'ancienne date,
donc la ligne qu'on vient de traiter.

## UN RAPPEL PORTE SON MOTIF, ET IL NE DEMENAGE PAS, 11/09/2026

`suivi_clients.rappel_titre`, lot 14, facultatif. « Rappeler le 18 » ne dit pas POURQUOI, et trois
semaines plus tard la fiche demande d'appeler sans dire ce qu'on avait promis.

**L'AUTRE CHEMIN A ETE PESE ET REFUSE.** Ted avait d'abord choisi de faire du rappel une vraie
tache dans `taches`. Ce que ca deplacait : le sous-main, le panneau, la regle « un client deja
suivi sort de la file », la vue `v_courrier` et la fonction d'envoi de 8 h, plus la reprise des
rappels deja poses. A l'ecran, aucune difference. Ne pas y revenir sans cette liste sous les yeux.

- **Le motif vit et meurt avec la date.** `planifier()` efface l'un avec l'autre. Un motif sans
  date est une phrase orpheline qu'aucun ecran ne montre, et qui se recollerait au prochain rappel
  pose sur ce client.
- **Les quatre facons de poser la date passent par `poserRappel()`** et emportent le motif tape
  au-dessus. Deux `crmSet` a la suite persistent, synchronisent et redessinent deux fois, et au
  premier des deux rendus le champ de motif est deja efface par le redessin.
- **Toute colonne ajoutee a `suivi_clients` doit etre RELUE par `lireSuivi()`** dans
  `bdv-sync.js`. `ecrireSuivi()` renvoie la LIGNE ENTIERE a chaque geste : une colonne qu'on
  n'aurait pas relue repartirait a `null` au premier rappel repousse depuis le tableau de bord.
  Ce n'est pas la regle « une ecriture = une colonne » de `reglages`, c'est son inverse, et les
  deux tables ne se traitent donc pas pareil.

### LA SIXIEME FAMILLE : LUE, PAS STOCKEE, PAS COCHABLE

Les rappels clients apparaissent dans le calendrier et dans « Mes taches », famille `clients`.

1. **Ils ne sont jamais recopies.** `reglesDesRappels()` dans `bdv-calendrier.js` et
   `rappelsClients()` dans `bdv-taches.js` LISENT le miroir de `bdv-crm.js`. Aucune ligne n'est
   ecrite dans `taches`. `npm run banc:calclients` et la section 9 de `npm run banc:taches` le
   gardent.
2. **Ils ne se cochent pas**, nulle part, grille comprise. Le defaut a ete paye le jour meme : la
   vue liste avait son cas particulier, la pastille de la grille prenait le bouton de coche commun
   deux fonctions plus loin, et un clic aurait ecrit `ech:client:706:2026-09-13` dans la table des
   taches. Une fausse tache qui repond « fait » pendant que le sous-main reclame encore le client.
   **Rien n'echouait, rien ne s'affichait de travers.** Un cas particulier pose dans une vue se
   pose dans toutes.
3. **Elle n'a pas de couleur, et ne peut pas en avoir.** La bande utilisable s'arrete a L* 56 :
   cinq teintes n'y tenaient deja pas l'ecart. Elle prend une MATIERE, comme la cinquieme : ecrite
   a la main, plus un combine pose en `::before`. Le pictogramme est en CSS et pas dans le texte,
   pour que le nom du client reste un nom propre : c'est lui qui part dans l'infobulle, dans
   l'aria-label et dans la recherche du navigateur.

## LA MODALE D'UNE TACHE N'EST PAS LA MEME POUR LES TROIS NATURES, 12/09/2026

Demande de Ted : une modale pour creer une tache, la voir, la traiter, la repousser. Elle
s'ouvre depuis TROIS endroits : la ligne de la piece « Mes taches », la punaise du panneau,
et le titre d'une tache dans la vue LISTE du calendrier.

**La zone des taches affiche trois natures de lignes, et elles n'ont pas les memes droits.**

| | modifier | cocher | repousser | retirer |
|---|---|---|---|---|
| une tache ecrite | oui | oui | oui | oui |
| une obligation | **non** | oui | **non** | **non** |
| un rappel client | **la modale ne s'ouvre pas du tout** | | | |

Why: une DRM tombe le 10 du mois, son titre et sa date viennent du fichier de donnees ; un
bouton qui pretendrait la decaler mentirait sur ce qui est negociable. Et un client ne se
traite que dans sa fiche, ou l'on note ce qu'il a dit (regle du 11/09) : deux endroits qui
repondent « qui dois-je appeler » se contrediraient des le premier geste pose d'un cote.

How to apply :

- **Le refus est dans la donnee, pas dans l'ecran.** `modifier()`, `poserDebut()` et
  `modale()` refusent, respectivement, une obligation, une obligation et un client, meme
  appelees a la main. Cacher un bouton n'a jamais empeche un appel. Le banc les appelle
  directement pour le verifier.
- **`bdv-taches.js` reste le seul fichier qui ecrive dans la table des taches.** Le
  calendrier passe par `BdvTaches.modale()` et `BdvTaches.modaleOccurrence()`, jamais par
  une ligne construite chez lui. Meme motif que `basculerOccurrence()`.
- **`normaliserDates()` porte les trois regles de dates**, pour la creation comme pour la
  correction. Ne pas les reecrire ailleurs : un formulaire qui accepte « du 11 au 9 » a la
  creation et le refuse a la correction apprend deux comportements pour un seul geste.
- **`repousser()` et `reporterAu()` passent par `poserDebut()`.** Un seul chemin, donc une
  seule facon de garder la duree d'un salon de trois jours.

**ON NE REPOUSSE QUE CE QUI PRESSE.** Si la tache n'est pas encore due (`jours > 0`), les
boutons « Demain » et « Dans 7 jours » disparaissent et le bloc s'appelle « La deplacer ? ».
Why: sur une tache prevue dans douze jours, « Demain » l'AVANCE. La regle existait deja pour
les punaises du panneau, et la modale l'a enfreinte jusqu'a la capture du 12/09/2026.

**Dans la GRILLE du mois, la pastille reste la case a cocher.** La porte vers la modale n'est
que dans la vue liste : ailleurs, ouvrir une modale demanderait deux clics pour cocher ce qui
s'en coche un.

Le banc : `npm run banc:taches`, section 10. L'image : `npm run apercu:modale`, cinq etats
sur la vraie feuille de style. **Regarder l'image apres toute retouche de cette modale** -
le banc a valide 115 controles sur un ecran qui enfreignait une regle du projet.

## LE FLAMBEAU : le site doit survivre au depart de Ted, 10/09/2026

Ted a pose la contrainte : un jour il partira, et le site ne doit pas tourner autour de lui. Il
reste **une voix experte parmi d'autres**, jamais l'identite du site. C'est la meme regle que
« rien de vivant en production ne doit etre inconnu du depot », appliquee aux comptes et aux
roles au lieu du code.

Le piege a eviter est l'inverse du probleme : depersonnaliser sans creer le role transforme
« le site de Ted » en « le site de personne », et le second se lit plus mal que le premier. On
nomme donc des SIEGES, pas des absences.

### Ce qui depend encore d'une personne, par gravite

1. **Les comptes du projet sont sous un Gmail personnel**, `teddypereira88@gmail.com` : GitHub,
   Vercel, Supabase. C'est le SEUL point de cette liste qui devient irreparable apres un depart,
   les trois autres ne sont que du texte. **DETTE ACCEPTEE PAR TED le 10/09/2026**, en
   connaissance de cause, pour ne pas bloquer la refonte. A reprendre avant tout depart annonce.
   Le geste minimal si la migration parait lourde : ajouter un second administrateur sur les
   trois comptes, ce qui prend quelques minutes et eteint l'essentiel du risque.
2. **`teddy@solumatic.fr` est l'adresse du site**, a neuf endroits : `mentions-legales.njk`,
   `rgpd.njk` (quatre fois), `cgu.njk`, `footer-rich.njk`, `conseil-form.njk` et
   `src/js/bdv-compte.js`. Ted a choisi une adresse du Bureau pour les remplacer.
   **NE PAS LES BASCULER avant que la boite recoive vraiment** : une page legale qui pointe
   vers une boite morte est pire que celle qui pointe vers une boite personnelle. Noter que
   `courrier.lebureauduvigneron.fr` sert a EMETTRE via Resend, ce qui ne fait pas du domaine une
   boite qui recoit.
3. **La signature des articles etait en dur dans le gabarit.** Corrige le 10/09/2026, voir
   ci-dessous.
4. **`/teddy/` occupe l'entree « A propos » du menu**, l'avatar de Ted signe `manifeste.njk`, et
   `waitlist.njk` comme `compte.njk` se terminent par son nom en gage de confiance. A remanier
   en roles : une redaction qui signe, et une page qui liste les voix. Ted a choisi les ROLES
   D'ABORD, les noms ensuite : la structure se pose avec des fonctions et des emplacements
   vides, on ne nomme personne sans son accord.

### La signature d'un article est une donnee, pas une identite

`src/_includes/article.njk` lit maintenant `{{ auteur }}`. Le defaut vit dans
`src/posts/posts.11tydata.js`, donnee de repertoire Eleventy, et un article peut le remplacer
par son propre `auteur:`. Les vingt articles existants restent signes Teddy Pereira : il les a
ecrits, et les faire signer « la redaction » serait une fausse attribution.

### Ce qui manque encore, et que personne ne voit

`CLAUDE.md` et `JOURNAL.md` documentent tres bien les DECISIONS et les pieges. Aucun des deux ne
documente les OPERATIONS : comment on deploie, comment on ajoute un article, ou vivent les
comptes, comment on tourne une cle Resend ou Supabase. Un successeur heriterait d'un
raisonnement complet et d'aucun mode d'emploi. Un `EXPLOITATION.md` reste a ecrire, et c'est la
piece qui manque vraiment au flambeau.

## Le tableau de bord : ce qu'il ne faut jamais casser

### 1. `HASH_COLS` ne bouge jamais

`HASH_COLS` est declare dans `src/js/bdv-base.js` et repris dans `src/js/bdv-sync.js`. Plus
dans le fichier du tableau de bord.

Le vigneron cumule ses exports dans IndexedDB (`bdv_ventes_v4`). La deduplication repose sur
une empreinte `cyrb53` calculee sur les **40 premieres colonnes seulement**, jointes par le
caractere de controle `\x01` (invisible a la lecture, attention en edition).

Toute colonne ajoutee par une version plus recente de l'export Vitisoft se range **APRES**,
hors empreinte, et `rawEnrichit()` complete les lignes deja en base au lieu de les redoubler.

Augmenter `HASH_COLS` change toutes les empreintes : plus aucune ligne n'est reconnue, le
reimport duplique tout, et le chiffre d'affaires affiche double en silence. Verifie sur donnees
reelles : la base passe de 4939 a 9878 lignes et le total facture de 532 201 a 1 064 403 euros.

### 2. Les colonnes sont lues par POSITION

`verifierEntete()` compare la ligne d'en-tete a `ENTETES` a chaque import et **refuse** le
fichier en cas de decalage. Sans ce garde-fou, une colonne inseree au milieu par une future
version de Vitisoft rangerait des numeros de telephone dans le champ e-mail sans aucune erreur
visible. Tolere un export plus court (version anterieure) et plus long (colonnes inconnues).

Historique des colonnes : 40 jusqu'en juillet 2026, `Emails` en 41e le 25/08/2026,
`Fixe` et `Mobile` en 42e et 43e le 26/08/2026.

### 3. Migration IndexedDB

La base est en version 2 depuis l'ecran Reglages. Une montee de version est **a sens unique** :
un navigateur ayant migre ne peut plus ouvrir une base avec l'ancien code. En cas de probleme
en production, corriger en avant par un nouveau commit, jamais par un redeploiement de l'ancien.

### 4. Cuvee contre millesime

Toute analyse de tendance produit se fait au niveau **cuvee** (`cuveeBase()` retire le millesime
final), jamais au niveau produit-millesime. Sinon chaque changement de millesime declenche une
fausse alerte : « Le Rosé 2024 » chute de 53 677 euros pendant que « Le Rosé 2025 » monte de
56 474 euros, alors que la cuvee ne bouge presque pas.

Le millesime ne sert qu'a une seule question : reste-t-il du vieux stock a ecouler ?

### 5. Aucun seuil grave

Les utilisateurs de Vitisoft remplissent `Origine`, `Lieu de vente` et les champs `Perso` comme
ils veulent. Aucune liste de valeurs en dur ne peut etre juste ailleurs que chez celui qui l'a
ecrite : l'ecran Reglages decouvre les valeurs presentes, propose un regroupement, et le vigneron
tranche une fois. `classerLigne()` est le seul endroit qui decide.

Les seuils d'analyse (classes de montant, taux de retour, cadences) se calculent sur la base
chargee, en quantiles, jamais en constantes. Seuls restent en dur les seuils de fiabilite
statistique (`MIN_OBSERVABLES`, `MIN_CLASSE`, `MIN_REVENUS`), qui disent quand s'abstenir.

Nuance : le CONTENU des champs est libre, pas les EN-TETES. Le nom de la colonne, fixe par
Vitisoft, prime sur toute statistique. Se fier au champ le plus rempli designe « Vendeur »
comme canal de vente, ce qui est faux.

### 6. Une ecriture = une colonne

La table `reglages` porte plusieurs reglages sur UNE seule ligne par compte, et deux endroits
y ecrivent : le moteur (`bdv-base.js`) et le panneau (`bdv-reglages.js`). Comme
`on_conflict=id` avec `resolution=merge-duplicates` ne touche que les colonnes ENVOYEES,
chaque geste n'envoie que la sienne : `syncObjectif`, `syncExercice`, `syncLabels`,
`syncClassement`. Il n'existe plus de fonction qui envoie tout.

Pourquoi : le 07/09/2026, `syncReglages()` renvoyait les quatre colonnes a chaque geste.
Changer le mois d'exercice repoussait donc l'objectif que le moteur avait encore en memoire
par-dessus celui que le vigneron venait d'enregistrer dans le panneau. Et au demarrage, avant
que `REG` soit lu, le meme envoi effacait le classement du compte. Deux pertes de donnees
silencieuses pour une seule cause, invisibles sur le poste de Ted parce que tout y est deja en
local.

Corollaire : quand le panneau enregistre un reglage lui-meme, le moteur l'ADOPTE
(`adopterObjectif`, `adopterExercice`) sans le renvoyer en base. Il y est deja.

`npm run banc:reglages` verifie la charge envoyee pour chaque geste. Ne pas ajouter une
cinquieme colonne sans sa propre fonction et son controle.

### 7 bis. Le calendrier et Mes taches peuvent COCHER TOUS LES DEUX, 08/09/2026

Decision de Ted, et la frontiere entre les deux pieces n'est pas la propriete, c'est la DATE :
une occurrence du calendrier porte toujours un debut et une fin, une tache peut n'en porter
aucune.

**C'est sans danger a une seule condition, et elle n'est tenue que par une fonction :** les
deux ecrivent LA MEME LIGNE, `ech:<cle>:<AAAA-MM-JJ>`, par `BdvTaches.basculerOccurrence()`.
`bdv-taches.js` reste le seul fichier qui ecrive dans la table des taches. Donner au
calendrier son propre stockage de « fait », c'est deux endroits qui repondront
« la DRM de septembre est-elle faite » et qui se contrediront au premier geste.

`basculer()` ne suffisait pas : elle cherche sa tache dans `toutes()`, qui ne connait que la
PROCHAINE occurrence de chaque obligation. Le calendrier affiche octobre en septembre.

### 7. Mes taches porte deux natures QU'ELLE ECRIT, et une TROISIEME qu'elle lit

**AMENDEE LE 11/09/2026, lire la suite avant d'appliquer.** La piece porte les taches que le
vigneron ecrit lui-meme et les obligations du calendrier qu'il coche. Depuis le 11/09 elle
MONTRE aussi les rappels poses sur des clients, famille `clients` : elle ne les stocke pas, elle
ne les coche pas, et le seul geste possible dessus est d'ouvrir la fiche du client. La regle du
dessous tient donc toujours, et c'est precisement ce qui la rend tenable : il n'y a toujours
qu'un endroit qui ECRIT, et qu'un endroit qui repond « ce client est-il traite ».

**Les clients a rappeler restent au sous-main**, avec leurs gestes.

Pourquoi : deux endroits qui repondent « qui dois-je appeler » se contrediraient des le
premier geste pose d'un cote. Le sous-main lit une file deposee par le tableau de bord et
repousse un rappel de 30, 7 ou 60 jours selon le geste ; une case a cocher ne sait pas
faire ca, et une tache cochee ne dit pas au moteur que le client a ete traite.

Ne pas ramener les clients ici sans supprimer le sous-main dans le meme mouvement.

Les obligations ne sont PAS stockees : elles sont calculees par `bdv-echeances.js`.
Ce que la base porte, c'est celles qui ont ete cochees, avec l'OCCURRENCE dans
l'identifiant (`ech:drm:2026-09-10`), pour que celle du mois suivant arrive vierge sans
tache planifiee. Decocher une obligation supprime la ligne.

### 8. Quatre conteneurs se partagent la zone de travail

`bureauJournee`, `bureauTaches`, `bureauCalendrier` et `bureauVentes`. La fonction `seule()`
de `bdv-nav.js` les nomme TOUS LES QUATRE a chaque bascule. Ne jamais poser un `hidden` a la main dans une
branche : le defaut qu'on attend n'est pas « la piece ne s'affiche pas », c'est
« l'ancienne reste affichee dessous ».

### 9. On compte avant de lire, et on lit par curseur

**AMENDE LE 17/09/2026, lire la section 9 bis avant d'appliquer celle-ci.** Le
comptage n'est plus le premier geste : il ne sert que de repli, quand le repere de
synchronisation manque ou n'est pas lisible.

Le rapatriement des ventes (`tirerVentes`) compare d'abord DEUX NOMBRES : les lignes de
cet appareil et celles du compte. Le compteur passe par l'en-tete `Content-Range`, il ne
rapatrie aucune donnee. Autant des deux cotes, il ne telecharge rien.

Mesure du 08/09/2026, vrai navigateur : premier clic sur une piece de vente a 40 000
lignes, 11,7 s et 14,7 Mo avant, 2,8 s et zero octet apres.

**Au MOINDRE doute, rapatriement complet.** Compteur illisible, appelant qui ne sait pas
ce qu'il a, ecart dans un sens ou dans l'autre : on lit tout. Cette fonction n'a pas le
droit de deviner, c'est la regle qui l'a sauvee une fois deja.

Et la pagination porte sur la CLE, pas sur un decalage : `empreinte=gt.<la derniere recue>`
avec `order=empreinte.asc`. Le plan d'execution mesure la difference sur la 5e page :
`offset 4000` parcourait 4 939 lignes et 4 998 blocs en 87 ms, la borne fait 3 blocs en
0,9 ms.

Deux conditions a ne pas defaire : la cle de tri doit etre UNIQUE par compte (ici
`(id, empreinte)` est la cle primaire), et la borne doit porter la meme colonne que le
tri. Un curseur sur une cle non unique saute des lignes en silence. C'est pour ca que le
journal d'echanges, trie par date, garde son decalage : voir le commentaire dans
`bdv-sync.js`.

`npm run banc:sync` garde les deux corrections ET les cinq cas de doute.

### 9 bis. ET ON NE REDEMANDE QUE CE QUI A CHANGE, 17/09/2026

Ted a essaye le bureau avec sa base de FACTURATION, 171 569 lignes, et son bureau
mettait une minute a s'ouvrir. La base n'y etait pour rien : une page de 1 000 lignes
sort de Postgres en 4,8 ms. Journaux Supabase, pour UNE SEULE ouverture : **174
requetes GET sur `/ventes`, 299 ms en moyenne**, plus autant de preflights CORS.

**LA CAUSE ETAIT LE GARDE-FOU DE LA SECTION 9 LUI-MEME.** `dejaLa` vient de
`dbCount()`, qui compte TOUTE la base locale, tous bureaux confondus ;
`compterVentes()` compte les lignes d'UN bureau. Des que la personne appartient a deux
bureaux, les deux nombres ne peuvent plus coincider, l'egalite n'arrive jamais, et le
rapatriement complet repart a chaque ouverture. **Un garde-fou qui compare deux choses
differentes ne se declenche pas, et il ne se plaint pas non plus.** C'est la forme de
panne la plus chere du depot : celle qui marche exactement comme prevu et ne protege
rien.

Le module retient donc la date de mise a jour la plus recente qu'il ait recue, par
bureau, dans `bdv_ventes_repere_v1`, et ne demande que ce qui est plus recent. Rien de
neuf, c'est **une requete pour toute l'ouverture au lieu de 174**.

**LES QUATRE REGLES QUI TIENNENT CE REPERE, et aucune n'est decorative.**

1. **`maj_le` EST POSE PAR LE SERVEUR.** C'etait le navigateur jusqu'a ce jour, dans le
   corps de l'upsert. Une machine dont l'horloge avance de dix minutes posait un repere
   dans le futur, et toutes les lignes ecrites derriere restaient invisibles a cet
   appareil POUR TOUJOURS. Le declencheur `ventes_maj_le_serveur`
   (`supabase/lot21-repere-synchronisation.sql`) l'ecrase meme pour un navigateur qui
   tourne encore sur une version en cache. **Une date de synchronisation ne vient jamais
   d'une horloge qu'on ne controle pas.**
2. **Et elle ne bouge QUE si `brut` a change.** Sans cette condition, reimporter deux
   fois le meme export redaterait les 171 569 lignes, et l'ouverture suivante les ferait
   toutes redescendre : la minute supprimee, ramenee par la porte de derriere.
3. **LE CURSEUR EST EN `gte.` ET NON EN `gt.`.** Un lot d'import ecrit ses 500 lignes
   dans UNE transaction, donc toutes portent la meme date a la milliseconde. Une borne
   stricte sauterait la fin du groupe des qu'une page tombe au milieu. La borne large
   rend quelques lignes deja connues, ce qui ne coute rien, `dbAddMany` les reconnait a
   leur empreinte. **Plus une marge de cinq minutes sous le repere** : une ligne recoit
   sa date au DEBUT de sa transaction et n'est visible qu'a la FIN, et une lecture qui
   tombe entre les deux ne repasserait jamais dessus.
4. **LA POUSSEE NE RECALE LE REPERE QUE SI UN TIRAGE A ABOUTI DANS LA SESSION.** Les
   lignes qu'on envoie, on les a ; celles qu'un AUTRE poste aurait deposees pendant
   qu'on ne regardait pas, non. Sans tirage prealable, on ne touche a rien : ca coute un
   rapatriement de trop, et c'est le bon cote ou se tromper.

**Le repere s'oublie avec la base**, dans `effacerTout()` et dans `viderBase()`. Un
repere qui survit a un vidage annonce « tu es a jour » sur une base a zero ligne : plus
rien ne redescend, jamais. Et sa cle commence par `bdv_`, donc elle part avec le reste
au changement de compte et de bureau (voir CHANGER DE BUREAU VIDE LE POSTE) : un repere
qui traverserait un changement de bureau ferait passer pour a jour une base qui
appartient a un autre domaine.

**AU MOINDRE DOUTE, RAPATRIEMENT COMPLET**, la regle de la section 9 n'a pas bouge d'une
ligne et c'est elle qui rend tout ca tenable. Pas de repere, repere illisible, compteur
illisible, **lignes sans `maj_le`**, curseur qui n'avance pas : on retombe sur la boucle
par empreinte. Le cas « lignes sans date » n'est pas theorique, c'est l'etat du projet
tant que le SQL du lot 21 n'est pas passe.

`npm run banc:sync` section 6, neuf controles, dont quatre sur les refus. Verifie en
remettant le defaut : passer le curseur en `gt.` fait echouer quatre controles.

## LE SERVEUR CALCULE QUAND CA CHANGE, PAS QUAND ON REGARDE. LOTS 26 ET 27, 18/09/2026

### LE CHIFFRE QUI A DECIDE

Les trois resumes, mesures sur les 171 569 lignes de Ted, **a chaque ouverture d'ecran** :

| | |
|---|---|
| `cap_resume` | 1 100 ms |
| `commerce_resume` | 3 800 ms |
| `cuvees_resume` | **5 735 ms** |

**Un logiciel de gestion ne recalcule pas son chiffre d'affaires chaque fois qu'on le
regarde. Il le calcule quand il CHANGE.**

    lecture du cache, par cle primaire : 0,77 ms

Sept mille fois plus rapide, et c'est la seule facon d'avoir un outil qui se comporte
normalement.

### CE QUE LE CACHE EXIGE, ET QUI EST TOUT LE SUJET

Un cache qui rend un chiffre perime est pire que pas de cache : il ment avec l'autorite
d'un chiffre de serveur. Trois decisions le tiennent :

1. **La peremption est un effacement, pas un drapeau.** Un resume perime qu'on garde
   « au cas ou » finit par s'afficher. **L'absence est le seul etat qu'on ne peut pas lire
   par erreur.**
2. **Le declencheur est au niveau de l'INSTRUCTION**, pas de la ligne. Un import ecrit ses
   500 lignes en une instruction : un effacement au lieu de cinq cents. Sur la base de
   Ted, 344 au lieu de 171 569.
3. **Une vente OU un reglage perime les TROIS resumes.** `classement` decide de
   `est_vente`, `exercice_debut` de `ex_annee` : les trois en dependent. Les perimer
   separement serait l'oubli programme du jour ou un quatrieme ecran arrivera.

Le premier calcul se paie une fois, et **`resumes_rechauffer()` le fait partir juste apres
l'import**, pendant que le vigneron lit son compte rendu : le seul moment de la journee ou
quelques secondes de serveur ne se voient pas.

### `public.resume(b, cle)` EST `security definer`, DONC ELLE GARDE SA PORTE

Elle ECRIT dans `resumes`, ce que le role connecte n'a pas le droit de faire. Le controle
d'acces est donc fait **dans la fonction, en premiere ligne**, et il est le meme que la
politique de lecture : appartenir au bureau. **Un `security definer` sans ce garde-fou
ouvre la table a tout le monde.**

### LOT 26 : « MES CUVEES », ET DEUX DEFAUTS QUI N'ETAIENT PAS DANS LE SQL

Porte comme les lots 24 et 25 : base d'essai, vrai moteur en temoin, comparaison champ par
champ. Dix-sept champs, cinq cuvees, zero ecart. **Les deux defauts trouves etaient
ailleurs :**

1. **Dans le navigateur.** `agentProduits()` range une ligne sans nom de produit sous
   « (sans nom) », puis, **onze lignes plus bas**, cherche cette meme cuvee sous la chaine
   vide pour calculer sa concentration. La cuvee affichait 0 % de dependance alors qu'elle
   tient a un seul client a 100 %. Deux replis differents pour la meme chose, dans la meme
   fonction.
2. **Dans la base d'essai, deux fois.** Elle ecrivait `produit: opts.produit || '...'`,
   donc la ligne posee expres pour tester le produit SANS NOM en recevait un : elle croyait
   tester ce cas et ne le testait pas. Et elle ne transmettait pas le conditionnement, donc
   les trois ventes en magnum arrivaient en 75 cl et polluaient la fourchette de prix
   qu'elles devaient justement en exclure.

**Une base d'essai qui n'attrape pas ses propres defauts n'attrapera pas ceux du portage.**
Troisieme fois que celle-ci se reprend.

### LA REGLE QUI SORT DE CES DEUX LOTS

**Porter un ecran le rend JUSTE. C'est le cache qui le rend RAPIDE. Les deux sont
necessaires, aucun ne suffit.** Le lot 26 seul aurait remplace 1 470 ms de navigateur par
5 735 ms de serveur : un portage qui ralentit.

## L'AMORCAGE NE CHARGE PLUS LA BASE, 18/09/2026

    « Je ne veux pas avoir a attendre huit ans des que je recharge ma page, pour que ca
      recolle les bouts. Y'a une BDD derriere qui est censee gerer les donnees et les
      redistribuer correctement. »

Il avait raison, et c'etait **la** faute d'architecture du chantier. Tout le reste
(politique de securite, repere, VACUUM, peinture paresseuse) grattait autour.

### CE QUI SE PASSAIT A CHAQUE OUVERTURE

1. rapatrier les 171 569 lignes du compte,
2. les ecrire dans IndexedDB,
3. les relire,
4. en deriver 171 569 objets,
5. **et seulement ensuite** ouvrir un ecran.

**Un logiciel de gestion ne recopie pas sa base de donnees sur le poste a chaque
ouverture. Il demande ce qu'il affiche.**

### CE QUE L'AMORCAGE FAIT MAINTENANT

| | |
|---|---|
| un `count()` local sur IndexedDB | quelques ms, pour savoir si la base est vide |
| les reglages du compte | quelques centaines d'octets |
| le resume de l'ecran ouvert | `cap_resume`, quelques centaines d'octets |

**Aucune lecture de `/ventes`. Aucune derivation.** Garde par
`npm run banc:amorcage-leger`, qui espionne les deux seules portes de la base et refuse
si l'une s'ouvre.

### LE COMPLEMENT EST DEMANDE, JAMAIS AUTOMATIQUE

Premiere version : l'ecran se peignait sur les chiffres du serveur puis chargeait les
lignes **en arriere-plan** pour completer. Le banc l'a refuse, et il avait raison :
**charger 171 569 lignes sans que personne l'ait demande reste charger 171 569 lignes.**
Le voile disparaissait, le navigateur ramait quand meme.

Les blocs non portes s'affichent donc derriere un bouton, avec la phrase qui dit ce qui
manque. **Ce n'est pas une elegance, c'est un aveu** : ces blocs-la ne sont pas encore
portes. Le bouton disparaitra a mesure qu'ils le seront.

### LE GARDE-FOU LE PLUS DANGEREUX DU LOT

`deposerPourLeBureau()` parcourt `ROWS` pour fabriquer le resume qui fait vivre « Ma
journee » et le courrier du matin. Avec `ROWS` vide a l'ouverture, **il aurait ecrit des
zeros sur le COMPTE** : le vigneron aurait vu son chiffre d'affaires disparaitre de son
bureau, et rien n'aurait echoue.

Meme danger que le message vert du 07/09 qui masquait 4 442 lignes perdues : **une
ecriture qui reussit avec de mauvaises donnees ne se plaint jamais.** Le depot part
maintenant depuis `assurerLignes()`, au premier moment ou il a de quoi dire vrai. Controle
n°4 du banc.

### DEUX PIEGES TROUVES EN CHEMIN

1. **`ROWS.length` ne repond plus a la question qu'on lui posait.** Il disait « la base
   est-elle vide ? » ; il dit maintenant « les ai-je derivees ? ». Confondre les deux
   envoyait le vigneron sur l'ecran « base vide » a chaque ouverture. D'ou `LIGNES_EN_BASE`,
   pose par le `count()`.
2. **Un drapeau qui peut mentir est un drapeau de trop.** Ma premiere version portait un
   booleen `LIGNES_PRETES` que seul `assurerLignes()` levait. Six controles de `banc:cap`
   l'ont refusee : ils remplissent `ROWS` directement, comme le fait un import, et se
   retrouvaient devant un ecran annoncant « tes lignes arrivent » alors qu'elles etaient la.
   `lignesPretes()` derive maintenant la reponse de `ROWS` lui-meme.

### CE QUI RESTE

« Mes cuvees », « Mon registre », le panneau de reglages, la fiche client et les exports
chargent la base **a leur ouverture**, avec le voile. Ce sont des gestes : le vigneron a
demande a voir cette piece-la, et il sait pourquoi il attend. Les porter fera disparaitre
ces attentes-la une par une.

## ON NE PEINT QUE L'ECRAN REGARDE, 18/09/2026

### LA MESURE QUI A TOUT DIT, ET ELLE N'A RIEN A VOIR AVEC LE SQL

Ted demandait « la suite », en pensant a l'ecran suivant. J'ai d'abord compte : **65
fonctions lisent `ROWS`**. Les porter une par une, c'est un chantier interminable ou chaque
lot ne fait gagner ZERO seconde jusqu'au dernier. Mauvaise forme.

Alors j'ai mesure l'amorcage, sur les 171 569 lignes, moteur reel :

| | ms |
|---|---|
| derivation des lignes | 1 350 |
| `computeMeta()` | 409 |
| `renderCap()` | 473 |
| `renderClients()` | **2 336** |
| `renderProduits()` | **1 849** |
| `renderReglages()` | 280 |
| `renderBase()` | 134 |
| `renderExplo()` | 0 |
| **amorcage complet** | **6 831** |

`renderAll()` peignait **SIX ecrans a chaque ouverture**, quel que soit celui ou le vigneron
atterrissait. **Quatre secondes et demie sur sept partaient a peindre des pieces que
personne ne regardait.** Ce n'est pas un calcul a optimiser, c'est du travail a ne pas faire.

    amorcage 6 831 ms -> 2 334 ms

C'est la meme faute que les trois ecrans fantomes du lot 5, en plus gros : la-bas on
peignait dans des conteneurs masques pour toujours, ici on peignait cinq pieces sur six
pour le cas ou.

### CE QUE CA DEPLACE, ET QU'IL FAUT ASSUMER

Le prix ne disparait pas : le premier clic sur « Mon commerce » coute 1 480 ms, celui sur
« Mes cuvees » 1 260 ms. **Payes au moment ou le vigneron a demande a voir la piece**, et
annonces par `runBusy` au lieu d'etre subis. Un aller-retour entre deux pieces ne recalcule
rien : la marque tombe quand la DONNEE bouge, pas quand on navigue.

### DEUX DEFAUTS DE MON PROPRE BANC, TROUVES PAR MUTATION

1. **Il regardait le mauvais endroit.** `renderCap()` ecrit dans `p-diagnostic`, qui vit a
   l'interieur de `p-annee` ; « Mon registre » dans `p-explorer` et pas `p-explo`. Ma
   premiere version declarait « Mon cap » non peint alors qu'il l'etait. **Un banc qui
   regarde a cote invente des defauts, ce qui coute autant que d'en laisser passer.**
2. **Il n'exercait pas le chemin le plus emprunte.** Il testait `navTo`, jamais
   `renderAll()`, qui est pourtant ce que `ecranRafraichir()` appelle apres chaque import et
   chaque reglage. Une mutation remettant la peinture des six ecrans **dans** `renderAll()`
   passait les treize controles. Section 4 bis ajoutee : la mutation fait maintenant echouer
   quatre controles.

Et `npm run verif` avait laisse passer tout le changement sans broncher, parce que **tous
les autres bancs appellent les peintres directement** : aucun ne regarde QUAND la peinture a
lieu. Un gain de soixante-six pour cent que rien ne garde sera repris par le premier
`renderAll()` qu'on remettra par commodite. D'ou `npm run banc:peinture`.

### CE QUI RESTE POUR TUER L'ATTENTE POUR DE BON

Il reste **2 334 ms**, et ils sont presque tous dans la derivation (1 350 ms) plus
`computeMeta()` (409 ms), c'est-a-dire dans le simple fait de charger la base. Pour les
supprimer il faut que PLUS RIEN ne lise `ROWS` a l'amorcage : la piece d'accueil,
`computeMeta`, `profilBase`, `buildEmailIndex` et `deposerPourLeBureau`. C'est la vraie fin
du chantier, et elle ne depend plus du nombre d'ecrans portes mais de cette poignee de
fonctions-la.

Les exports, la fiche client et le panneau de reglages, eux, **n'ont pas a etre portes** :
ce sont des gestes. Charger la base quand le vigneron clique sur « Exporter » est legitime.

## TROIS CAUSES EMPILEES POUR UNE SEULE PLAINTE, 17/09/2026 AU SOIR

Ted rouvre son bureau : « ca a foire une fois et la ca charge les lignes », capture a
l'appui, « Recuperation de tes ventes, 32 000 lignes... ». **La ligne qui compte n'est pas
« ca charge », c'est « ca a foire ».** Un amorcage qui echoue ne pose pas son repere, donc
le suivant repart de zero : les 32 000 lignes sont la CONSEQUENCE de l'echec.

Journaux Supabase : **quatre 500 a 8 100 ms sur `/rest/v1/ventes`** en huit minutes, tous
sur le meme appel, le comptage avec `Prefer: count=exact`. Huit secondes, c'est le delai
d'expiration de PostgREST.

### 1. La carte de visibilite etait froide

    relallvisible = 0  sur  relpages = 26 240

`ventes` venait d'etre remplie en masse et n'avait jamais ete passee au VACUUM : **aucune
page marquee visible, donc aucun parcours d'index seul possible**. Chaque comptage devait
lire le tas, et le tas fait 205 Mo a cause de `brut`.

| | avant VACUUM | apres |
|---|---|---|
| comptage borne, sous le vrai role connecte | Seq Scan, **3 543 ms** | Index Only Scan, **222 ms** |
| `Heap Fetches` | (tas entier) | **0** |

**Seize fois plus rapide, et rien a coder.** A refaire apres chaque gros import, tant que
`brut` est la :

    vacuum (analyze) public.ventes;

`ventes_lignes`, elle, etait deja a 100 % visible. C'est encore le meme sujet que les lots
22 et 23 : ce qui coute, c'est `brut` dans la ligne.

### 2. Le repere ne triait plus rien, et la voie rapide ne s'en apercevait pas

Les 171 569 lignes de Ted portent un `maj_le` compris entre **08:32:06 et 08:33:19** le
meme matin : une base importee d'un coup, en soixante-treize secondes. La marge de cinq
minutes du repere, qui existe pour ne pas couper un lot d'import au milieu, **couvre alors
la base entiere**.

La voie rapide ramenait donc les 171 569 lignes et **se declarait satisfaite**. Le comptage
pose APRES elle n'etait jamais atteint. Une voie rapide qui fait le travail de la voie
lente en se croyant rapide, et qui ne se plaint pas.

**Ce n'est pas un cas tordu : c'est le cas de toute base importee d'un coup**, donc de tout
nouveau compte.

La voie rapide sait maintenant renoncer : quand la borne ramene autant que le compte en
contient, elle rend `null`, et le comptage tranche.

#### Ma premiere version etait fausse, et le banc l'a dit

Je comparais la borne au **compte local** : ramener 1 500 lignes quand on en a 1 000 me
paraissait suspect. C'est pourtant exactement ce qu'il faut faire s'il en manque 1 500.
**« Beaucoup » et « tout » ne se confondent pas, et seul le total du serveur les
distingue.** Trois controles du banc ont refuse la premiere version.

La requete de plus est posee **apres** `combien === 0` : les ouvertures ou il n'y a rien de
neuf gardent leur requete unique, et elle n'arrive que lorsqu'on s'apprete de toute facon a
travailler.

### 3. Et « Mon commerce » partait a l'amorcage, ce qui etait ma faute

| | `cap_resume` | `commerce_resume` |
|---|---|---|
| ce qu'il rend | 8 nombres | 1 935 clients |
| poids | quelques octets | **642 ko** |
| duree sur la vraie base | 1,1 s | **3,8 s** |

Je l'avais lance a l'amorcage **par symetrie avec « Mon cap »**. La symetrie etait fausse :
c'etait quatre secondes de serveur et un demi-mega a chaque ouverture du bureau, y compris
les ouvertures ou le vigneron ne regarde jamais cet ecran. Et pendant le rapatriement, ces
quatre secondes se disputaient la meme connexion que le comptage qui expirait a huit.

**C'EST LA FAUTE DU LOT 22, REFAITE : une mesure n'est valable que pour le decor dans lequel
elle a ete prise.** « Lancer le resume a l'amorcage » etait bon pour huit nombres ; je l'ai
recopie pour six cent quarante-deux kilo-octets sans le remesurer.

Il part maintenant a l'ouverture de l'ecran, une fois par session, **sans faire attendre** :
le calcul local peint d'abord, le serveur repeint quand il repond.

## « MON COMMERCE » : LE FILET D'ABORD, LOT 25, 17/09/2026

### LE CONTROLE GRATUIT N'EXISTAIT PLUS

Au lot 24, la comparaison etait offerte : le navigateur depose deja ses chiffres dans
`reglages.resume_ventes`. Pour « Mon commerce », **rien n'est depose**. Aucun chiffre de
cet ecran ne remonte sur le compte, donc aucune comparaison n'existait, et la regle du
chantier (« tant qu'une ligne sort du controle, on ne retire aucun calcul du navigateur »)
n'avait plus rien a mordre.

### ET LA VRAIE BASE NE POUVAIT PAS SERVIR DE TERRAIN D'ESSAI

La base de facturation de Ted est un **abonnement mensuel** : 1 831 clients sur 1 935 sont
venus trois fois ou plus, 63 une seule fois, et **34 seulement sont observables a un an,
la ou `agentPremierAchat()` en exige 40**. Elle ecrase le moteur en VOLUME, ce qui est
precieux, et elle ne touche presque **aucun** des cas ou un portage se trompe : pas de
client a deux achats en nombre, pas de mediane sur un nombre pair d'intervalles, pas de
quantile pile sur sa borne.

**Porter contre elle, c'est mesurer la justesse d'une balance en pesant toujours le meme
sac.**

### LE FILET, EN DEUX MORCEAUX

1. `scripts/fixtures/commerce-cas-limites.mjs` : une base ecrite **a l'envers**. On part de
   la liste des pieges connus, et chaque client existe pour en toucher un. Chargee dans le
   bureau `ZZ-ESSAI-COMMERCE` par `supabase/lot25-bureau-essai.sql`, elle passe par le
   **meme chemin** que les vraies ventes (declencheur, table etroite, `est_vente`,
   `ex_annee`) : le portage est verifie avec sa derivation, pas seulement ses agregats.
   Aucune donnee reelle : **le depot ne doit pas se mettre a porter les noms et le chiffre
   d'affaires des clients de Ted.**
2. `npm run temoin:commerce` fait tourner le **vrai moteur** dessus et fige sa reponse ;
   `npm run controle:commerce` en fabrique la requete de comparaison, client par client.

**Resultat du 17/09/2026 : 73 clients, 14 champs chacun, zero ecart.**

### LES TROIS CONVENTIONS QUI NE SE VOIENT PAS

| Ce que fait le depot | Ce qu'il faut ecrire en SQL | Ce que coute l'autre |
|---|---|---|
| `median()` fait la **moyenne des deux valeurs centrales** sur un tableau pair | `percentile_cont(0.5)` | **Sept cadences sur douze** changent. C-PAIR-2 passe de 60 jours a 30, C-AVOIR de 185 a **six** : un client a six jours de cadence est en retard en permanence et ne sort plus de la liste d'appels |
| `stdev()` divise par **n** | `stddev_pop`, jamais `stddev` | Trois coefficients de variation changent, un client change de classe. Sur la vraie base de Ted : **trois clients sortent de la liste de decrochage**, la perte annoncee bouge de 703 € |
| les quartiles s'ecrivent `montants[floor(p * n)]` | un tableau indexe `floor(p*n)+1`, ni `percentile_cont` ni `percentile_disc` | `percentile_disc` prend l'indice un cran plus bas : sur cent clients, un client par borne change de classe, donc de taux de retour, donc de rang |

**Aucune de ces erreurs ne casse quoi que ce soit a l'ecran.** Les listes restent pleines,
les nombres restent plausibles. C'est la famille du signe des avoirs, 715 347 € parfaitement
credibles.

### DEUX DEFAUTS QUE LA FIXTURE S'EST FAITS A ELLE-MEME

Ecrits ici parce qu'ils disent comment elle se relit :

1. **Aucune ligne au jour de reference.** La vente la plus recente tombait trente jours
   avant `REF`, donc `profilBase()` posait `refDay` la, et les trois clients poses de part
   et d'autre de la frontiere du retard se retrouvaient tous du meme cote. **Le jour de
   reference n'est pas une date choisie, c'est la derniere vente de la base.**
2. **Les deux clients de la volatilite chutaient trop fort** pour distinguer les deux
   conventions : ils alertaient sous l'une comme sous l'autre. Un troisieme a ete resolu
   numeriquement pour tomber **entre** les deux seuils.

### LE BRANCHEMENT, MEME JOUR

`computeBridge()`, `agentCadence()` et `agentDecrochage()` lisent le serveur quand il a
repondu, et restent locaux sinon. Chacune declare sa source (`serveur: true` ou `false`).
`agentDormants()` en herite sans etre touchee, puisqu'elle passe par `agentCadence()`.

**Un seul point de peremption pour les DEUX resumes.** `capPerimer()` rafraichit maintenant
« Mon cap » ET « Mon commerce » : ils dependent des memes reglages (`classement` decide de
`est_vente`, `exercice_debut` de `ex_annee` et `ex_pos`). Les perimer separement, c'est
l'oubli programme du jour ou un troisieme ecran arrivera.

Les deux appels partent **ensemble**, pas l'un apres l'autre : ils ne dependent de rien
dans le navigateur ni l'un de l'autre.

#### Un ordre de tri qui n'existait que sur l'appareil de Ted

`Array.sort` est **stable**. Les mouvements de meme montant sortaient donc dans l'ordre ou
leurs clients apparaissent dans IndexedDB, **un ordre que rien ne peut reproduire** ailleurs.
Le pied d'ecran n'affiche que les dix premiers : une egalite au dixieme rang change qui
s'affiche, d'un appareil a l'autre. Les deux cotes trient maintenant par montant absolu
**puis par nom**.

#### Le banc a laisse passer une mutation, et c'est ce qui l'a rendu bon

`npm run banc:commerce-serveur` peint l'ecran deux fois et exige le meme HTML au caractere
pres : 32 controles, tous verts. **Oublier `comNb()` sur `caPotentiel` n'en faisait echouer
aucun.** La raison : ce champ n'est lu par AUCUN ecran, donc il ne peut pas changer un pixel.

**Un controle qui ne regarde que ce qui s'affiche ne voit pas les champs qui ne s'affichent
pas, et ce sont justement ceux-la qui s'affichent un jour, six mois plus tard, en chaine de
caracteres.** PostgREST rend les numeriques de jsonb en chaines : « 1200 » + « 800 » fait
« 1200800 », sans lever. Un controle de TYPES a ete ajoute, sur tout ce que le serveur rend,
et il attrape la mutation.

Au passage : **`caPotentiel` est calcule pour chaque client, somme, porte jusqu'a
`agentDormants()`, et lu par personne.** Meme famille que l'evenement `bdv:bureau` sans
ecouteur et que les trois ecrans fantomes. A supprimer, quand Ted le dira.

### CE QUI N'EST PAS FAIT

**`agentPremierAchat()` n'est pas porte.** Sur la base de Ted il REFUSE de repondre, et il a
raison : un taux de retour sur 34 personnes ne dit rien. On ne peut donc le verifier que sur
la base fabriquee. **Le porter quand meme, ce serait poser a l'ecran des taux que personne
n'a jamais pu confronter au reel.**

**Et l'ecran lit encore `ROWS` pour tout le reste** : le pied « qui pese quoi », les
libelles, le tri. Ce lot pose le filet et le portage ; il ne supprime pas l'attente.

## « MON CAP » CALCULE PAR LE SERVEUR, LOT 24, 17/09/2026

### LE CONTROLE QUI REND TOUT LE CHANTIER DEFENDABLE, ET IL ETAIT DEJA LA

Le tableau de bord depose ses propres chiffres dans `reglages.resume_ventes` a chaque
import : calcules par le NAVIGATEUR, sur la vraie base du vigneron. **On tient donc
gratuitement la seule comparaison qui compte, navigateur contre serveur, sur des donnees
reelles.** `v_cap_controle` la fige, champ par champ.

Resultat du 17/09/2026 sur les 171 569 lignes de Ted : **treize champs sur treize
identiques**, dont les douze valeurs mensuelles une a une, l'atterrissage a l'euro
(1 627 963) et la variation au dixieme (-2,3 %).

**TANT QU'UNE LIGNE SORT DE `v_cap_controle` AVEC `identique = false`, ON NE RETIRE AUCUN
CALCUL DU NAVIGATEUR.** C'est la regle du chantier, et c'est elle qui empeche de remplacer
des chiffres justes par des chiffres plausibles.

    select champ, cote_navigateur, cote_serveur from public.v_cap_controle where not identique;

La vue ne vaut que si le depot est RECENT : un resume depose avant un import compare deux
bases differentes. `depose_le` est rendu pour qu'on en juge.

### LES QUATRE PIEGES PORTES A L'IDENTIQUE

1. **L'ancre n'est jamais `now()`.** L'exercice courant est le dernier PRESENT EN BASE, et
   le jour de coupe est le `ex_pos` le plus avance qu'il porte. La base de Ted s'arrete au
   31/08/2026 : une requete qui daterait d'aujourd'hui comparerait huit mois de ventes a
   douze mois de calendrier.
2. **DEUX fenetres differentes, et elles ne se confondent pas.** La comparaison d'une annee
   sur l'autre se fait sur `ex_pos <= cut_pos`, au JOUR pres. L'atterrissage compare sur
   `ex_mois <= max_m`, au MOIS pres. C'est ce qu'ecrit le JavaScript, et prendre l'une pour
   l'autre deplace l'atterrissage de plusieurs dizaines de milliers d'euros sans rien
   casser.
3. **`ex_pos` est un entier composite**, mois dans l'exercice fois cent plus le jour. Il se
   compare comme un entier.
4. **Un mois sans vente vaut zero, il ne disparait pas.** Sinon le douzieme point du
   graphique serait le huitieme.

### UN SEUL BALAYAGE, ET `as materialized` N'EST PAS DECORATIF

La premiere version de `cap_resume()` lisait `v_ventes` **dix-sept fois**, dont douze pour
construire la serie mensuelle un mois a la fois : **3 755 ms**. Les deux exercices compares
sont materialises UNE fois et tout en sort : **1 141 ms**. Sans `as materialized`, Postgres
replonge dans la table a chaque usage du CTE et on revient au point de depart.

### LE BRANCHEMENT, MEME JOUR

`BdvSync.capResume()` appelle la fonction, `demarrerEcransVente()` la lance **en parallele**
du rapatriement des ventes (elle ne depend de rien qui soit dans le navigateur), et
`renderCap()` lit `capCadre()` / `capAtterrissage()`, qui rendent **la meme forme** que le
serveur ait repondu ou non.

**LE CALCUL LOCAL N'EST PAS SUPPRIME, IL DEVIENT LE REPLI.** Un serveur qui tousse ne doit
pas vider l'ecran : c'est la regle de tout le depot. Les deux fonctions posent `serveur:
true` ou `false` pour que le prochain lot sache ce qu'il regarde.

#### Les deux ecarts trouves EN BRANCHANT, pas avant

Le controle `v_cap_controle` rendait deja zero ligne : il ne compare **que les treize
champs que le navigateur depose**, et ni `bas`, ni `haut`, ni `methode` n'en font partie.
Les deux cotes divergeaient donc en silence sur ce qui s'affiche sous la fourchette.

1. **La fourchette en projection lineaire.** Le navigateur ecrivait « du realise a la
   projection » ; le serveur rendait deux fois la projection, soit une fourchette d'un
   seul point, qui n'informe de rien. Le navigateur avait raison : au pire, l'exercice
   finit ou il en est. **Serveur corrige.**
2. **Le nom de la methode.** Le navigateur disait « cale sur la saisonnalite de 2025 » des
   qu'un exercice precedent existait EN BASE, meme s'il etait a zero sur les mois connus,
   auquel cas le chiffre affiche etait lineaire. **Une note qui ment sur sa methode est
   pire que pas de note. Navigateur corrige.** La regle tenue des deux cotes : la methode
   est « saison » quand l'exercice precedent a du chiffre A DATE EGALE, pas quand il
   existe.

La lecon est la meme qu'au lot 22 : **un controle ne prouve que ce qu'il compare.** Treize
champs verts ne disaient rien des trois autres.

#### La peremption : un seul point de passage

Un resume d'avant l'import afficherait un chiffre perime **avec l'autorite d'un chiffre de
serveur**, et l'ecran ne pourrait plus se corriger tout seul : il croirait savoir. Trois
reglages changent ce que le serveur calcule (`classement` decide de `est_vente`,
`exercice_debut` decide de `ex_annee` et `ex_pos`, `objectif` sort tel quel), et **tous
passent par `syncUneColonne()`** : la peremption est posee la, une fois, plutot qu'a six
endroits d'ou elle manquerait au septieme. `handleFiles()`, `adopterObjectif()`,
`adopterExercice()` et `viderBase()` l'appellent en plus, parce qu'elles ne passent pas par
la.

`capRafraichir(apres)` met le resume **a null tout de suite** et n'en redemande un
qu'apres l'ecriture. Les deux moities comptent : sans la premiere, on garde un faux
chiffre en attendant ; sans la seconde, on fait recalculer l'ANCIEN classement et on le
range comme s'il etait neuf.

#### Le banc

`scripts/banc-cap-serveur.mjs`, 33 controles. Le controle central peint « Mon cap » deux
fois, une fois en local et une fois avec la meme verite mise en forme comme le serveur la
rend, et exige **le meme HTML au caractere pres**. Il prouve la TRADUCTION (un champ mal
nomme, une unite prise pour une autre, un `bas` et un `haut` inverses) ; il ne prouve pas
que le SQL calcule les memes nombres, ca reste le travail de `v_cap_controle`. Un banc en
jsdom n'a pas de Postgres.

### CE QUI N'EST PAS FAIT

**Ce lot ne supprime pas encore l'attente.** Quatre choses de « Mon cap » lisent toujours
`ROWS` : les compteurs « sur la periode affichee » (la barre de periode est un reglage
d'ecran que le serveur ne connait pas), les signaux du diagnostic, la courbe de tendance et
la decomposition prix/volume. Tant que ces quatre-la sont locaux, **ouvrir « Mon cap »
charge encore la base**. Ce lot prouve la chaine de bout en bout, il ne fait pas encore
gagner de seconde.

## LE CALCUL REMONTE AU SERVEUR, 17/09/2026. LOTS 22 ET 23.

Decide par Ted le 17/09/2026, en abandonnant le hors-ligne. **La regle 1 de
`bdv-sync.js`, « IndexedDB reste la source de calcul », est donc caduque**, et avec elle
la regle d'or du module de compte : a partir de ce chantier, une panne Supabase veut dire
zero chiffre. Ted l'a accepte explicitement.

### La mesure qui a tout decide, et l'erreur de methode qui a coute un lot

| | temps |
|---|---|
| CA et bouteilles par client, sur `brut` en JSON | 6 949 ms |
| **apres le lot 22**, colonnes typees POSEES SUR `ventes` | 6 333 ms |
| les memes lignes, dans une table SANS `brut` | 667 ms |

Le lot 22 n'a presque rien change, et c'est ma faute : **les 344 ms annonces la veille
etaient mesures sur une table d'essai qui ne portait pas `brut`.** J'ai presente comme
« le gain des colonnes typees » ce qui etait « le gain des colonnes typees DANS UNE LIGNE
ETROITE ». La cause est physique : chaque ligne porte un demi-kilo-octet de JSON, range
AVANT les colonnes typees, et Postgres doit le traverser pour les atteindre. Lire trois
colonnes revient a lire les 264 Mo de la table.

**LA REGLE QUI EN SORT, ET ELLE DEPASSE CE CHANTIER : une mesure n'est valable que pour
le decor dans lequel elle a ete prise, et ce decor s'ecrit A COTE DU CHIFFRE.** Un
« 344 ms » sans son decor est un chiffre faux qui a l'air vrai, exactement ce que ce
depot passe son temps a traquer ailleurs.

### Ce qui existe maintenant

- **`public.ventes_lignes`**, table etroite, les 43 colonnes typees, 112 Mo. Tenue a jour
  par le declencheur `ventes_lignes_suivre` sur `ventes` : **rien a redeployer dans le
  navigateur.** Personne n'y ecrit, pas meme le maitre du bureau ; le declencheur est
  `security definer` et c'est le seul chemin, ce qui rend la divergence impossible.
  **LES 43 COLONNES Y SONT, pas seulement les utiles du jour** : le registre croise sur
  n'importe laquelle, colonnes perso comprises, et le canal se lit dans celle que le
  vigneron a DESIGNEE. Une colonne oubliee ici, c'est un axe qui disparait sans message.
- **`public.v_ventes`**, vue `security_invoker`, qui porte ce que `classerLigne()` et
  `exDeriver()` calculent dans le navigateur. **AUCUNE LOGIQUE N'EST REECRITE** : le
  classement du vigneron est deja en base, dans `reglages.classement`, et ce ne sont que
  des tables de correspondance. Postgres y cherche, il ne decide rien.
- **`bdv_nombre`, `bdv_jour`, `bdv_cuvee`, `bdv_champ`**, portees a l'identique depuis le
  JavaScript, bizarreries comprises.

### Le defaut le plus cher du lot 22, et il etait invisible

`substring(x from motif)` rend **le premier groupe parenthese** quand le motif en
contient un, et pas le motif entier. Le signe etait hors du groupe : `-0,02` etait lu
`0,02`. La base de Ted porte **1 144 lignes negatives, ses avoirs, pour -357 673,63 €**.
Le chiffre d'affaires sortait a **8 677 677,25 €** au lieu de **7 962 329,99 €**, soit
715 347 € de trop, et parfaitement credible. Trouve en comparant la fonction au
JavaScript sur les vraies valeurs, PAS en la relisant.

### Le mode devine n'est PAS porte, et c'est volontaire

Quand le vigneron n'a pas valide son classement, le navigateur devine. Deviner aussi cote
serveur, ce sont deux devinettes qui divergeront. `v_ventes` rend donc
`classement_valide = false` et laisse `est_vente` a `null` : l'appelant sait qu'il ne peut
pas se servir de ces colonnes, au lieu de lire un faux qui a l'air vrai.

### Ou en est la vitesse

| sur 171 569 lignes | temps |
|---|---|
| le balayage seul de `ventes_lignes` | **40 ms** (contre 5 921 ms sur `ventes`) |
| CA et bouteilles par mois d'exercice | **609 ms** |
| idem + factures et clients distincts | **1 108 ms** |

Le `count(distinct)` est ce qui reste : il force un tri sur disque. A reprendre si les
ecrans en demandent trop.

### LES TROIS PIEGES A NE PAS OUBLIER EN PORTANT UN CALCUL

1. **Les quantiles et les medianes.** Le JavaScript prend l'element a `floor(p × n)`,
   sans interpolation : c'est `percentile_disc`, PAS `percentile_cont`. Et il y a DEUX
   medianes differentes dans le depot, `median()` (moyenne des deux centraux) et le
   `med()` local d'`agentProduits` (l'element central). Porter l'une pour l'autre decale
   des seuils d'alerte sans rien casser.
2. **L'ecart-type est en POPULATION** (`stddev_pop`), pas en echantillon.
3. **Jamais `now()`.** Les comparaisons « a date egale » se calent sur la derniere vente
   de la base (`refDay`, `cutPos`), jamais sur aujourd'hui. `ex_pos` est le mois DANS
   l'exercice fois cent plus le jour, et il se compare comme un entier.

**ET LA REGLE QUI TIENT TOUT LE CHANTIER : le serveur doit dire le meme chiffre que le
navigateur, au centime, AVANT qu'on retire le moindre calcul.** Sans ca on remplace des
chiffres justes par des chiffres plausibles, ce qui est la seule chose que cet outil n'a
pas le droit de faire.

## UNE LIGNE DE VENTE NE RECOPIE PAS SES COLONNES, 17/09/2026

Ted, apres l'amorcage : « Ma journee s'affiche direct. Par contre Mon commerce non, Mon cap
non, Mes cuvees non, Mon registre non. J'ai meme pas de message pour me dire que ca
mouline. »

**MESURE SUR SA BASE, 171 569 lignes, moteur reel dans jsdom :**

| | avant | apres |
|---|---|---|
| derivation des lignes | 2 698 ms | 1 474 ms |
| `computeMeta()` | 971 ms | 369 ms |
| memoire des seules colonnes | **268 Mo** | **10 Mo** |

**LA CAUSE N'ETAIT PAS UNE FONCTION LENTE, C'ETAIT UN VOLUME D'OBJETS.**
`deriveRow()` faisait `COLS.forEach((k,i)=>o[k]=raw[i])`, soit **quarante-trois** colonnes
recopiees dans un objet nomme, pour chaque ligne : sept millions et demi d'ecritures de
proprietes, et 268 Mo dont la plupart des colonnes ne sont lues par aucun ecran. Le prix ne
s'arretait pas la : sous cette pression memoire, `computeMeta()`, qui ne fait que parcourir,
mettait presque une seconde.

**Les colonnes sont donc des ACCESSEURS poses une fois sur `LIGNE_PROTO`**, et la ligne ne
garde que son tableau brut dans `_r`. `r.produit` s'ecrit et se lit exactement pareil :
**aucun ecran n'a change d'une virgule.** C'est meme plus rapide a LIRE, 14 ms contre 147 ms
pour trois colonnes sur toutes les lignes, parce que 171 569 objets a 43 proprietes font
sortir V8 de ses formes optimisees alors qu'un prototype unique l'y garde.

**CE QUE CA INTERDIT, ET IL FAUT LE SAVOIR AVANT D'ECRIRE** : `Object.keys(r)`, `{...r}` et
`Object.assign({}, r)` ne rendent PAS les colonnes, seulement les champs derives. Verifie le
17/09/2026 : aucun des trois n'existe dans le depot, et c'est ce qui rend le changement sur.
Qui veut toutes les colonnes lit `r._r`, comme le fait deja l'empreinte. `enumerable: true`
est pose quand meme, pour qu'un `for...in` ecrit sans y penser continue de les voir.

### Et le calcul rend la main, sinon le message n'existe pas

Le deuxieme reproche de Ted etait aussi grave que le premier. Deux causes :

1. **`runBusy()` ne pose son voile qu'au-dessus de `BUSY_MIN` lignes DEJA CHARGEES.** Au
   premier clic, `ROWS` est vide : le voile ne parait pas, et c'est exactement le moment ou
   l'attente est la plus longue.
2. **Meme pose, il n'aurait rien montre.** Tout le travail tenait dans un seul tour de
   boucle. **Un message qu'on n'a pas laisse le temps de peindre n'existe pas**, et ca ne se
   repare pas avec un texte de plus : ca se repare en rendant la main.

`deriverParPaquets()` decoupe donc par 8 000 lignes, environ 80 ms, avec un `souffler()`
entre deux paquets, et annonce ou il en est. Et **l'ouverture des ecrans de vente passe par
l'amorcage**, comme le demarrage du bureau : le moteur d'abord (310 ko qui n'existent pas
encore au moment du clic), les ventes ensuite. On ne fabrique pas un deuxieme voile d'attente,
il se superposerait au premier et redirait en moins bien ce qu'il sait deja faire.

**Une etape peut preciser sa propre ligne** pendant qu'elle travaille (« Analyse de tes
ventes, 96 000 lignes sur 171 569 »). Sur une base de cette taille ce n'est pas du confort :
sans chiffre qui avance, six secondes d'attente ne se distinguent pas d'un plantage.

### La file de l'amorcage, et le defaut qu'elle a ferme

Le premier jet posait un drapeau `enCours` et rendait la main tout de suite quand un
amorcage tournait deja. **Un clic sur « Mon cap » pendant que le bureau finissait de se
raccorder n'aurait donc rien ouvert du tout**, sans un mot : la promesse se resolvait
aussitot avec un bilan vide, et l'appelant croyait avoir fini. **Un appel qui ne fait rien
doit etre impossible, pas discret.** Les amorcages s'enchainent maintenant dans l'ordre ou on
les demande.

`npm run banc:volume` garde la forme qui a produit le gain, et **pas un seuil en
millisecondes** : un seuil echoue au hasard selon la machine, et un banc qui echoue au hasard
finit ignore. Il affiche le temps pour qu'on le voie changer, et verifie que les colonnes ne
sont pas recopiees, qu'elles se lisent quand meme, et que le calcul respire. Verifie en
remettant la recopie.

### CE QUI RESTE, ET C'EST LE VRAI CHANTIER

**Le navigateur n'a rien a faire de 81 Mo de lignes brutes pour afficher huit chiffres.** Les
cinq ecrans de vente ne montrent que des regroupements, du CA par mois, par cuvee, par client,
par canal, que Postgres calcule en quelques millisecondes sur 171 569 lignes. Tout ce qui
precede repousse le mur, il ne le supprime pas : **a 400 000 lignes il sera de retour**, et
la regle 1 de `bdv-sync.js` (« IndexedDB reste la source de calcul ») devra etre rouverte avec
Ted, avec ce qu'elle achete (le hors-ligne, aucun ecran a reecrire) et ce qu'elle coute.

## LE BUREAU SE RACCORDE DANS UN ORDRE, ET IL LE DIT, 17/09/2026

Ted, capture a l'appui : « quand je me connecte, rien ne s'affiche ». Le sous-main disait
« Ta file n'a pas pu etre lue », le panneau « ton journal n'est pas encore lisible », et
l'ardoise etait absente.

**CE N'ETAIT PAS LA LENTEUR, C'ETAIT UNE COURSE PERDUE.** Les quatre lectures partaient EN
MEME TEMPS au `DOMContentLoaded`. Or depuis le lot 17 elles sont toutes filtrees par le
bureau courant, range dans `bdv_bureau_v1`, et **cette cle est ABSENTE a la premiere
ouverture qui suit une connexion** : `chargerBureau()` va la chercher pendant que
`BdvCrm.charger()` rend deja `null`, par construction, parce qu'il refuse de lire sans
savoir quel bureau lire.

**ET L'EVENEMENT QUI DEVAIT RATTRAPER CA N'AVAIT AUCUN ECOUTEUR.** `bdv:bureau` est emis
depuis le lot 17 et documente dans ce fichier comme « reveille les modules qui n'avaient
rien pu lire ». Mesure du 17/09/2026 : **zero `addEventListener('bdv:bureau')` dans tout le
depot.** Il ne reveillait personne, et le bureau restait sur ses trois messages d'echec
jusqu'au rechargement de la page. C'est la meme famille que le `min-height` sur un `span`
et que les `env(safe-area-inset-*)` sans `viewport-fit=cover` : **une protection ecrite,
jamais executee, et que le prochain lecteur croit active.**

### Pourquoi on n'a pas simplement branche l'evenement

Ca fermait CE cas et laissait la classe entiere ouverte. Rien n'empecherait la prochaine
zone d'oublier le meme evenement, et **le defaut ne se voit que sur un appareil qui n'a pas
encore sa cle de bureau, c'est-a-dire jamais sur le poste de celui qui developpe.** Ce qu'il
fallait, c'est un ORDRE D'ARRIVEE ecrit a un seul endroit.

`src/js/bdv-amorce.js` tient le voile et la sequence ; `amorcer()`, dans le script inline de
`src/mon-bureau.njk`, tient la LISTE. **L'ordre de cette liste EST la dependance** : le
bureau, puis le suivi, le journal, les signets, le profil. Ne pas la paralleliser « pour
gagner 200 ms », le gain se paierait en zones vides.

### Les quatre regles, et aucune n'est decorative

1. **LES ETAPES SONT SEQUENTIELLES.** Voir ci-dessus. C'est la reparation elle-meme.
2. **LE VOILE REND LA MAIN AU BOUT DE QUINZE SECONDES, TOUJOURS.** Arbitrage de Ted, et
   l'autre branche a ete pesee : un voile qui attend le raccordement complet enferme le
   vigneron DEHORS de chiffres que son appareil porte deja. **Un bureau ouvert qui dit ce
   qui manque vaut toujours mieux qu'un bureau ferme qui a raison.**
3. **CE QUI N'A PAS REPONDU CONTINUE DE TOURNER.** Le plafond ferme le voile, il n'annule
   rien : les etapes aboutissent souvent une seconde plus tard et la page se complete par
   ses propres rappels.
4. **UNE ETAPE RATEE SE DIT PAR SON NOM.** « Tes clients et tes rappels n'ont pas repondu »
   se comprend et se raconte au telephone ; « erreur de chargement » ne se comprend pas.
   Meme motif que le rapport de la fonction du courrier : ce qui echoue est NOMME.

**Une etape a echoue si elle leve OU si elle rend exactement `false`.** Ce `false` n'est pas
un detail de style : `BdvCrm.charger()` rend `null` quand la lecture echoue et un etat quand
elle aboutit, y compris sur une base vide. C'est l'appelant qui traduit son « je ne sais
pas », parce qu'il est le seul a savoir ce que rend sa fonction.

**Le voile parait a CHAQUE connexion** (choix de Ted) avec un plancher de 450 ms, la seule
attente artificielle du projet : depuis le repere de synchronisation, une ouverture reussie
prend deux cent millisecondes, et un voile plein ecran qui apparait et disparait dans cet
intervalle se lit comme un defaut d'affichage, pas comme un chargement.

### Ce que le banc a valide et que la capture a refuse

`npm run banc:amorce`, 27 controles, verifie en remettant le defaut : passer la boucle en
parallele en fait echouer neuf, inverser la liste de la page en fait echouer un. Il a
pourtant laisse passer QUATRE defauts que `npm run apercu:amorce` a montres du premier coup :

- trois libelles d'ecran sans leurs accents (« Tes reglages ») ;
- un titre a `--t-lead` qui se lisait comme une phrase de plus, passe a `--t-h3` ;
- **la carte ne defilait pas et n'avait pas de hauteur maximale** : cinq etapes, la phrase
  d'echec et deux boutons ne tiennent pas dans un telephone en paysage, et ce sont
  precisement les boutons qui rendent la main. `max-height: calc(100dvh - ...)` et
  `overflow-y: auto`, meme lecon que la fiche client le 11/09/2026 ;
- quand TOUT rate, la phrase recitait les cinq etapes. Enumerer sert quand il manque une ou
  deux choses au milieu de ce qui marche ; **quand il ne reste rien, l'enumeration EST le
  bruit.** Le message devient « Ton compte n'a pas repondu ».

**Cinquieme fois que la meme lecon se paie : la mesure trouve ce qu'on ne voit pas, la
capture voit ce qu'on ne mesure pas.** Regarder `_apercu/amorce.html` apres toute retouche
de ce voile.

### La regle qui en sort, et elle depasse ce chantier

**Toute lecture faite au demarrage du bureau entre dans la liste de `amorcer()`, jamais a
cote.** Une zone nouvelle qui lancerait sa propre lecture au `DOMContentLoaded` rejouerait le
defaut du jour a l'identique, et seulement chez quelqu'un qui vient de se connecter. Le
controle qui le garde est la section 6 de `banc:amorce` : elle lit la fenetre qui va de
l'ouverture du `DOMContentLoaded` jusqu'a l'appel de la sequence, sur la page CONSTRUITE, et
elle refuse toute lecture reseau posee avant.

### L'AUTRE MOITIE DE LA MESURE : `est_membre(bureau)` LIGNE PAR LIGNE, 17/09/2026

Meme journee, meme base, cause independante. La politique de lecture de `ventes` etait
`using (est_membre(bureau))`. La fonction est bien `stable`, mais elle prend une
COLONNE en argument : Postgres ne peut donc pas la sortir de la boucle, et il l'appelle
**une fois par ligne**. Sur le comptage des 171 569 lignes, mesure sous le vrai role
`authenticated` :

| | avant | apres |
|---|---|---|
| comptage exact | 2 487 ms | 236 ms |
| blocs lus | 343 467 | 192 |
| page de 1 000 lignes | 43,7 ms | 4,8 ms |

La forme qui marche est un test que le planificateur peut hacher une bonne fois :

    using ( bureau in (select m.bureau from public.membres m
                        where m.personne = (select auth.uid())) )

**La regle : une politique de securite par ligne ne passe JAMAIS une colonne a une
fonction.** Elle compare la colonne a un ENSEMBLE calcule une fois. Le plan le dit en un
mot, `hashed SubPlan` d'un cote, `Filter: est_membre(bureau)` de l'autre, et c'est le
seul endroit ou ca se voit : aucun banc, aucun ecran, aucun journal ne signale une
politique qui coute cher. Les autres tables portent la meme forme et n'ont rien coute
jusqu'ici parce qu'elles tiennent en vingt lignes ; **a reprendre le jour ou l'une
d'elles grossit**.


### 10. Vider la base n'efface pas les REGLAGES, 08/09/2026

`effacer_mes_donnees()`, la fonction appelee par « Vider la base », faisait un `DELETE` sur
la LIGNE ENTIERE de la table `reglages`. Cette ligne porte deux natures :

- ce qui **decrit la base** : `file_travail`, `resume_ventes`, `depose_le`, deposes par le
  tableau de bord. Ca part avec les ventes, c'en est le reflet.
- ce que le **vigneron a choisi** : `objectif`, `exercice_debut`, `perso_labels`,
  `classement`. Il n'a pas efface ses reglages, il a efface sa base.

La ligne n'est donc plus supprimee, elle est mise a jour. Le SQL est dans
`supabase/lot6-vider-la-base.sql`, **a coller dans Supabase** : le fichier ne s'applique pas
tout seul, et tant qu'il n'est pas passe le defaut est encore la en production.

Ce defaut etait invisible sur le poste de celui qui cliquait : l'objectif reste dans son
navigateur (`bdv_objectif_v5`), l'ardoise continuait de l'afficher, et le premier geste
suivant le renvoyait en base. **Il ne perdait donc rien chez lui, et tout sur son deuxieme
appareil.** C'est la meme forme de panne que « une ecriture = une colonne » : silencieuse
la ou on la cherche, visible seulement ailleurs.

### 11. UN IMPORT DOIT ANALYSER, PUIS RELIRE, PUIS REPEINDRE, 08/09/2026

`analyserPourLeBureau()` (bdv-base.js), appelee a la fin de `handleFiles()` et **de la
seulement**. Quatre pas, dans cet ordre, et aucun n'est decoratif :

1. charger `bdv-ecrans.js` s'il manque (`BdvNav.chargerEcrans()`) : c'est lui qui sait
   calculer la file et le resume, et le bureau ne le charge qu'au premier clic sur une piece
   de vente. Un import n'est pas un clic.
2. deposer (`deposerPourLeBureau()`), **attendu** : la fonction rend sa promesse pour ca.
3. relire le serveur (`BdvCrm.charger()`), qui pose le depot dans le miroir local.
4. repeindre (`window.bdvMajJournee()`), qui lit ce miroir.

Le defaut repare : Ted importait et devait se deconnecter/reconnecter pour voir ses chiffres.
Ce n'etait pas la reconnexion, c'etait le rechargement de page. Enlever un pas ramene le
defaut sous une autre forme, et **sauter le depot quand `renderAll` existe** casse le
deuxieme import du bureau. Ne pas appeler cette chaine depuis `ecranRafraichir()` : celle-la
tourne a chaque reglage modifie.

Corollaire pour toute page qui rend la main sur `if(!connecte) return;` : elle DOIT ecouter
`bdv:session`. Une session ouverte dans la page ne recharge rien quand la destination est la
page elle-meme : `location.href` sur la meme adresse, ancre comprise, n'est qu'un changement
d'ancre pour le navigateur. `/mon-bureau/` le fait maintenant, en reprenant la destination
demandee (`BdvCompte.destinationDemandee()`), en la posant par `history.replaceState()` puis
en rechargeant.

**Reste ouvert** : apres « Vider la base », les autres appareils gardent le depot perime.

## La charte graphique : une seule pour le site et l'outil

`tokens.css`, a la racine, est la source unique. Le site et le tableau de bord declarent
le meme bloc `:root`. Aucune couleur, aucune taille, aucun rayon ecrit en dur ailleurs.

**UN JETON D'ETAT N'EST PAS UNE COULEUR DE TEXTE TANT QU'ON NE L'A PAS MESURE SUR LE VRAI
PAPIER, 12/09/2026.** `--warn` figurait dans la table de `scripts/charte.mjs` face au seul
`--warn-bg`, un fond appele nulle part. Face aux papiers reels il donne 4,40:1 sur `--paper`
et 3,43:1 sur `--paper-deep` : un compte a rebours est parti en production sous le seuil, et
la charte a repondu CONFORME. `--warn-deep` porte les lettres depuis, `--warn` reste une
couleur de filet et de pastille. **La lecon est la meme qu'au 07/09 : une paire nouvelle qui
n'entre pas dans la table de `charte.mjs` n'est controlee par rien.**

Trois regles portent l'identite, et ce sont elles qu'on casse en premier sans y penser :

1. **Aucun rayon de bordure.** L'angle vif est un parti pris, pas un oubli : la texture
   d'imprime vient de la et du filet. Seuls sont ronds les elements ronds par nature.
2. **Aucune ombre floue.** La signature est `--ombre-dure`, une ombre sans flou, decalee.
3. **Les tokens d'etat ne servent jamais d'accent.** `--ok`, `--danger`, `--warn` et
   `--info` disent un etat. Une serie de graphique verte se lirait « bon » : les couleurs
   de serie existent pour ca, ancrees sur le bordeaux et les terres du site, et separees en
   LUMINANCE pour rester distinguables en niveaux de gris et en vision deuteranope. Pas
   seulement en teinte.

   **LES HUIT SERIES EXISTENT, dans `src/css/bdv-ecrans.css`**, et pas dans `tokens.css`.
   Elles sont categorielles, dessinees pour les COURBES et les APLATS des ecrans de vente,
   avec leurs luminances documentees. Je les ai crues absentes le 08/09/2026 et j'en ai
   cree quatre autres sous le meme nom : deux valeurs pour un meme jeton, et la derniere
   feuille chargee gagnait, au hasard de l'ordre des clics.

   **Les familles du calendrier sont `--fam-1` a `--fam-4`, un jeu SEPARE**, et pas par
   gout du rangement : sur `--paper-light`, `--serie-4` tombe a 2,37:1, `--serie-6` a
   2,95:1 et `--serie-8` a 1,94:1. Une echelle dessinee pour des aplats de graphique n'est
   pas une echelle pour des filets de trois pixels sur du papier. Deux metiers, deux
   echelles.

   **Il n'y a pas la place pour une CINQUIEME famille sur ce papier** : la bande utilisable
   s'arrete a L* 56, et cinq teintes dans 41 points de luminance ne tiennent pas l'ecart.
   Une cinquieme categorie prend une MATIERE, pas une teinte : c'est ce qu'on a fait pour
   les taches, ecrites a la main sur le calendrier imprime.

L'orange `#E87722` est la couleur de Vitisoft, la maison mere. Il n'apparait sur ce site
que pour signaler un lien vers Vitisoft.

Piege : dans le tableau de bord, environ trente valeurs ressemblent a des couleurs
hexadecimales hors du bloc `<style>`. Certaines n'en sont pas. `&#128200;` et ses voisines
sont des entites HTML d'emoji. La section 9 de `npm run charte:dash` les compare a la liste
`ENTITES_ATTENDUES` figee dans `scripts/charte.mjs`, justement pour attraper celui qui les
prendra pour des couleurs. Ajouter une icone se declare a la main dans cette liste, et c'est
voulu.

Deuxieme piege : `#FFF` a deux roles opposes, surface de carte et texte sur fond sombre.
Le premier est `--white`, le second est `--on-dark`, qui vaut le papier. Sur un fond
bordeaux, du blanc pur est plus dur que le papier du site.

## Ce que le dashboard ne fait pas, volontairement

- **Les donnees de vente sont stockees sur le compte, plus seulement dans le navigateur.**
  Decision du 04/09/2026, assumee : reglages, suivi client et lignes de vente vivent en base
  (Supabase, Irlande) et sont redistribues a la demande, l'IndexedDB locale n'en etant plus que
  le miroir de travail. La promesse « rien ne quitte ton navigateur » est morte : tout texte
  d'interface qui la repete encore est un defaut de contenu, a corriger.
  **Ce qui reste vrai et se defend** : les lignes de vente ne servent QU'a l'affichage du tableau
  de bord de leur proprietaire. Aucun ciblage publicitaire, aucune statistique agregee, aucune
  transmission a un partenaire, jamais. C'est ce que `src/compte.njk` promet noir sur blanc depuis
  le 06/09/2026. Le ciblage des annonces Vitimedia se fait sur le profil declare (metier, region,
  Vitisoft oui/non, canaux de vente), jamais sur l'export.
  Regle d'or du module de compte (`src/js/bdv-compte.js`) : le compte ne conditionne jamais la
  lecture des donnees locales. Si Supabase est en panne ou le reseau coupe, l'outil s'ouvre quand
  meme des lors qu'une session a deja ete ouverte une fois sur ce navigateur.
- **Aucun envoi d'e-mail.** Le compositeur remplit un lien `mailto:`, c'est la messagerie du
  vigneron qui envoie. Pas de cle API dans une page publique, pas de responsabilite d'envoi.
- **Aucune generation de texte par un modele.** Les messages sont des gabarits a blocs remplis
  avec les donnees du client. Sept squelettes pour l'instant : si le besoin de varier grandit,
  ecrire plusieurs variantes par bloc et les choisir par une empreinte stable du numero client,
  jamais au hasard, pour que le meme client recoive toujours le meme message.

## Ce qui est charge quand

Le bureau ouvre avec 32 ko de JavaScript bloquant : `bdv-canaux.js` et `bdv-nav.js`. Tout le
reste est differe ou attend un geste. Avant le 07/09/2026 c'etait 125 ko bloquants, dont un
moteur de 83 ko que « Ma journee » n'utilise pas.

Avant de reposer un `<script>` dans `src/mon-bureau.njk`, verifier qu'il sert VRAIMENT a
« Ma journee ». La methode qui a servi a retirer le moteur : lister les noms globaux du
fichier, puis chercher chacun dans les modules charges au bureau, et lire les resultats un
par un. Sur les 161 globales du moteur, six ressemblaient a des dependances et les six
etaient des faux positifs : des chaines de caracteres, des noms de classe CSS, des
attributs `data-`. La verification au jugé aurait conclu l'inverse.

## Verifier avant de livrer

Deux scripts. `scripts/charte.mjs` a besoin de `css-tree`, `scripts/banc-bureau.mjs` de
`jsdom`, tous deux en devDependency.

    npm run verif           les quatre d'un coup, arret au premier echec

Ou, un par un, quand on veut lire le detail :

    npm run build           OBLIGATOIRE avant les suivants
    npm run charte          conformite du CSS du site
    npm run charte:bureau   conformite du bureau et de ses ecrans de vente
    npm run banc            le bureau fait-il ce qu'il dit
    npm run banc:journee    le plan de travail se vide-t-il quand la base se vide

`charte:dash` reste accepte comme ancien nom de `charte:bureau`.

**`charte:bureau` et `banc` lisent la page CONSTRUITE, `_site/mon-bureau/index.html`, et pas
le gabarit.** Le gabarit ne porte pas ses feuilles de style, elles sont dans le layout : le
lire, c'est ne rien lire puis l'annoncer conforme. Les deux scripts s'arretent en le disant
si le build manque. Ce piege s'est referme trois fois dans la journee du 07/09/2026, chaque
fois pour une raison differente. La regle qui en sort : **un controle qui ne peut pas
s'executer doit crier, jamais se taire.**

Ce que `charte` regarde : les couleurs, les rayons, les familles de police et les tailles
encore ecrits en dur avec leur selecteur, les couleurs et les tailles faisant desormais
ECHOUER et non plus seulement s'afficher ; les commentaires qui avalent des regles ; les
tokens declares jamais appeles et les `var()` sans declaration ; la table des contrastes des
paires texte sur fond, avec le verdict AA, PLUS les paires qu'il decouvre lui-meme dans la
feuille ; les entites HTML numeriques, comparees a une liste FIGEE dans le script (ce
sont les icones, et un chercher-remplacer de couleurs les emporte sans prevenir) ; et que
**aucune regle de `bdv-ecrans.css` ne sort de son scope `.bdv-ventes`**. Cette derniere
existe parce que six noms de classes sont communs avec `style.css` : `btn`, `btn--ghost`,
`card__title`, `hero`, `mono`, `note`. Ne pas les renommer, c'est un vocabulaire partage
avec `bdv-base.js` ; c'est le scope qui les separe.

Ce que `banc` regarde : la barre du bureau, la bascule entre les pieces, les trois formes
d'adresse, l'interception des liens, le bouton Retour, la regle « sans Vitisoft, pas
d'ecrans de vente », et la correspondance des deux listes d'ecrans.

`banc:journee`, ecrit le 08/09/2026, existe parce que `banc` **n'execute aucun script de la
page** : il monte la barre a la main. Or les zones de « Ma journee » sont peintes par le
script INLINE de `src/mon-bureau.njk`, le seul morceau de code du bureau qu'aucun banc ne
touchait, et le defaut vivait exactement dans cet angle mort. Celui-la charge donc la page
CONSTRUITE **avec ses scripts**, et pose son faux `BdvCrm` par le crochet `beforeParse` de
jsdom : c'est la seule facon pour que le script inline le voie, puisqu'il peint pendant
l'analyse puis au `DOMContentLoaded`. Deux pieges deja payes en l'ecrivant :

- **Sans session en stockage local, le script sort par `if(!connecte) return;`** et ne
  peint rien. Un banc qui l'ignore verifie une page vide en annoncant que tout va bien.
- **`BdvCrm.charger()` rend toujours un etat quand la lecture a abouti**, meme sur une base
  vide ; `null` veut dire « la lecture a echoue ». Un faux qui rend `null` sur un compte
  neuf le fait passer pour une panne de reseau.

Le controle le plus important est celui qui confronte chaque `font-weight` demande par le
CSS aux graisses reellement chargees par le lien Google Fonts. C'est lui qui attrape le
faux gras : une regle qui demande du 700 sur une fonte chargee en 400 et 500 ne produit
pas une erreur, elle produit des contours epaissis par le navigateur, sur toutes les pages
a la fois, sans que rien ne le signale. C'est arrive, sur environ 376 passages en gras des
articles, et personne ne l'a vu.

Trois couleurs a surveiller, mesurees : `--muted` et `--cork` echouaient au WCAG AA comme
couleur de texte et ont ete corriges. `--danger` echoue encore sur le site (4,00:1 sur
papier) alors que `--danger-deep` existe et donne 6,01:1. Le tableau de bord l'utilise
deja, le site non.

## Verifier le tableau de bord sur donnees reelles

`npm run banc` couvre la navigation du bureau, jamais le rendu d'un chiffre : il n'execute
aucun script de la page et ne connait aucune donnee. Les cinq controles ci-dessous restent
donc a faire A L'ECRAN, avec un export reel, apres toute modification. `CONFORME` ne veut
dire que « la charte tient », et `LE BUREAU FAIT CE QU'IL DIT » que « les gestes
s'enchainent ». Ni l'un ni l'autre ne dit que les chiffres sont bons.

1. Le chiffre d'affaires total est inchange.
2. Un reimport du meme export donne 0 ligne ajoutee.
3. Les cinq ecrans se rendent sans erreur.
4. Les listes de clients ne contiennent aucun doublon.
5. Les textes generes se lisent a voix haute sans faute d'accord.

Le dernier point n'est pas un detail : les noms de cuvee portent deja un article, ce qui produit
« Votre Le Rosé 2024 » ou « ceux qui aiment du Miracle » si on concatene naivement. Trois helpers
existent selon la position dans la phrase : `avecArticle()`, `avecDe()` et `avecLe()`.

## Le courrier du matin, 09/09/2026

Un mail quotidien a 8 h qui porte les rappels echus et les signaux de la file. Lot 1 fait :
la fabrique et son apercu. Rien n'est encore envoye a personne.

### `bdv-courrier.js` FABRIQUE, et ne fait que ca

Il ne lit aucune base, il n'envoie rien, il ne connait ni Supabase ni Resend. On lui passe les
donnees d'un compte, il rend `{sujet, html, texte, vide, compteurs}`.

**Il doit tourner dans TROIS mondes sans etre modifie** : le navigateur (balise script), Node
(l'apercu `npm run courrier`) et Deno (la fonction serveur du lot 3). D'ou le bloc d'export en
bas de fichier.

**Ne jamais y ecrire un `import` ni un `require`** : ca fermerait deux des trois mondes, et il
faudrait alors tenir deux versions du contenu du mail, qui divergeraient au premier changement
de texte. C'est la meme regle que pour le CRM : le calcul est a UN endroit, et ce qui l'entoure
change.

**Il ne decide pas s'il faut envoyer.** Il le DIT, par `vide`. L'appelant tranche.

### Les couleurs en dur dans `bdv-courrier.js` : la seule exception a la charte

`var(--bordeaux)` n'existe pas dans Outlook, et une feuille de style externe n'est pas chargee
par la plupart des messageries. Un mail est donc entierement en style de ligne, en valeurs
brutes, et il n'y a pas de contournement.

**La regle de remplacement : chaque valeur porte le NOM du jeton dont elle est copiee**, en
commentaire, a cote. Le jour ou un jeton change, on cherche son nom dans ce fichier. Sans ces
noms, le bloc `C` devient un deuxieme nuancier orphelin, et c'est exactement ce que la charte
existe pour empecher.

Trois consequences a ne pas defaire :
- ni Fraunces ni Inter, une messagerie ne charge pas de police web. Georgia et la pile
  systeme, qui sont les replis declares dans `--font-titre` et `--font-corps`.
- `--danger-deep` et pas `--danger` : 4,00:1 sur papier ne passe pas AA.
- `--rule` est aplati en `#C9C4B9`. Un rgba sur une bordure de tableau n'est pas fiable en
  messagerie.

### LE COURRIER PORTE LES TACHES, ET DEUX REGLES VIENNENT AVEC, 09/09/2026

Virage decide avec Ted : le mail n'est plus « les clients a voir », c'est SA JOURNEE. Taches
echues et rappels sont MELANGES dans le bloc « Ce matin », le plus en retard d'abord.
Melanges et pas separes : le vigneron ne trie pas sa matinee par table de base de donnees.
Motif mesure : `suivi_clients` etait a zero ligne pendant que `taches` en portait treize,
dont quatre posees dans l'heure. La matiere qui bouge vraiment d'un jour a l'autre, c'est
celle-la.

Consequence de forme : rappels et taches sont normalises vers UNE seule forme
(`normRappel()`, `normTache()`) et UNE seule fonction les dessine (`ligneAFaire()`). Deux
dessinateurs auraient diverge au premier ajustement, comme les neuf listes de canaux avant
`bdv-canaux.js`.

**1. UNE TACHE SANS DATE N'ENTRE JAMAIS DANS LE COURRIER.** Le mail dit ce qui tombe
aujourd'hui. Une tache non datee n'a, par definition, aucune raison de tomber ce matin
plutot qu'un autre : la faire apparaitre chaque jour est precisement le defaut qui fait
decrocher un lecteur en dix jours. Elle reste dans le bureau, ou elle est a sa place.

**2. EN COURS N'EST PAS EN RETARD.** Une tache qui porte une date de fin et qui court encore
n'est pas en retard. L'annoncer en rouge est la meme faute que nommer un client deja traite :
le mail perd sa credibilite d'un seul coup, et on ne la regagne pas. Les taches en cours
passent APRES celles qui sont vraiment en retard, et portent « en cours », pas « depuis ».

Les trois controles 7, 8 et 9 de `npm run courrier` gardent ces deux regles.

### `ecarterLesSuivis()` DOIT DISPARAITRE AU LOT 2

`fileSignaux()` ecarte deja les clients suivis, mais **au moment du depot**, dans le
navigateur. Un rappel pose depuis le telephone le lendemain ne ressort pas du depot de la
veille : sans deuxieme passage, le mail nommerait un client deja traite.

Au lot 2 cette regle passe dans une **vue Postgres**, et la fonction est SUPPRIMEE. Elle ne
doit pas survivre a la vue : deux endroits qui repondent « ce client est-il encore a voir » se
contrediront au premier geste.

### `grant` NE DEFINIT PAS LES DROITS, IL LES AJOUTE, 09/09/2026

[Certain] Supabase pose des droits PAR DEFAUT sur le schema public. Toute table ou vue
nouvellement creee arrive avec INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES et TRIGGER deja
accordes a `authenticated` et `service_role`. Un `grant select to authenticated` seul est
donc REDONDANT, et il laisse les six autres droits en place.

Trouve en controlant `v_courrier` juste apres sa creation : j'avais ecrit
`revoke all ... from anon` puis `grant select ... to authenticated`, et `authenticated` se
retrouvait avec tout. Inoffensif ce jour-la, `is_updatable` valant NO sur une vue a agregats,
mais c'est un piege pose pour le jour ou la vue sera simplifiee.

How to apply: pour tout nouvel objet, **`revoke all` d'abord, sur `anon` ET sur
`authenticated`**, puis accorder le strict necessaire. Et apres chaque creation, controler avec
`information_schema.role_table_grants` plutot que de supposer.

### ET UN REVOKE SUR `public` NE RETIRE PAS UN DROIT NOMINATIF, 13/09/2026

Le symetrique de la regle du dessus, paye sur les FONCTIONS. Le lot 13 croyait fermer sa
fonction de purge avec `revoke all on function ... from public;`. Ca n'a rien retire :
Supabase n'accorde pas l'execution par PUBLIC, il l'accorde NOMMEMENT a `anon`,
`authenticated` et `service_role` sur toute fonction creee dans le schema public. Mesure
sur un PostgreSQL 16 jetable qui reproduit ce reglage :

    a la creation                                       anon=oui  connecte=oui
    apres `revoke ... from public`                      anon=OUI  connecte=OUI
    apres `revoke ... from public, anon, authenticated` anon=non  connecte=non

`courrier_envois_purger()` est donc restee appelable SANS SESSION, avec la seule cle
publique du site, pendant deux jours. Elle efface les lignes de plus d'un an du journal
des envois, c'est-a-dire la preuve que `src/rgpd.njk` promet de garder un an.

**Tout revoke de fermeture nomme les trois roles**, comme le fait deja la section 10 de
`schema.sql`. Et `service_role` et `postgres` gardent leur droit quand un planificateur
appelle la fonction : les retirer arreterait la tache en silence.

### Un droit accorde COLONNE PAR COLONNE ne se lit pas dans la meme vue, 13/09/2026

`information_schema.role_table_grants` ne montre PAS un `grant update (nom) on ...`. Le
controle de fin du lot 15 affirmait le contraire et aurait fait conclure a un grant rate.
Un droit de table se lit dans `role_table_grants`, un droit de colonne dans
`information_schema.column_privileges`. Les deux questions se posent separement.

**Et le controle de securite de Supabase se lance apres tout lot SQL** (`get_advisors`,
type `security`). C'est lui qui a trouve les deux points ci-dessus, deux jours et quatre
jours apres les lots qui les avaient poses. Savoir y lire les faux positifs : `est_membre`
et `est_maitre` y apparaissent comme executables par les comptes connectes, et elles n'ont
pas le choix, une fonction appelee dans une politique s'execute avec les droits de celui
qui lit.

## LE BUREAU EST LE PROPRIETAIRE, PLUS LA PERSONNE, 13/09/2026

Depuis le lot 17, une ligne de vente, une note client, un echange, une tache et un choix de
calendrier appartiennent a un BUREAU. Les six tables portent `bureau` et `cree_par` la ou
elles portaient `id`. Le detail du chantier est dans `PLAN_multi-utilisateurs.md`.

### La securite par ligne dit ce qu'on A LE DROIT de lire, le bureau courant dit ce qu'on DOIT lire

**C'est la regle la plus facile a perdre du chantier, parce que l'oublier ne casse rien
aujourd'hui.** Une requete sans `bureau=eq.` fonctionne parfaitement tant que la personne
n'a qu'un seul bureau. Le jour ou elle en a deux, la meme requete melange deux domaines
dans la meme ardoise, sans lever la moindre erreur et sans qu'aucun ecran ne change d'allure.

Mesure du 13/09/2026, sur un PostgreSQL d'essai : un compte membre de deux bureaux lit
**57 lignes de vente sans filtre et 50 avec**.

Donc : **toute requete du navigateur nomme son bureau, les LECTURES et les SUPPRESSIONS
autant que les ecritures.** Une suppression qui ne nomme que sa cle metier effacerait la
meme tache, le meme repere ou la meme fiche dans TOUS les bureaux de la personne.

Le garde-fou est la section 5 de `npm run banc:sync` : elle joue les onze appels du module,
compteur compris, et echoue en nommant la requete fautive. Verifiee en remettant le defaut.

### Le bureau courant vit dans `bdv_bureau_v1`, et ce prefixe n'est pas decoratif

`BdvCompte.monBureau()` est synchrone et lit le stockage local, comme `monId()` : les
vingt-huit appels du projet en dependent. La cle commence par `bdv_`, donc
`oublierCetAppareil()` l'efface avec le reste a la deconnexion et au changement de compte.
**Ne jamais la renommer hors de ce prefixe** : ce serait rouvrir la fuite entre deux comptes
sur un poste partage, fermee le 07/09/2026.

Sans bureau connu, `pret()` est faux dans tous les modules et **rien ne part** : ni lecture
ni ecriture. C'est le cas du tout premier chargement qui suit la mise en ligne, ou personne
n'a encore la cle. `BdvCompte.chargerBureau()` va la chercher et previent par l'evenement
`bdv:bureau`.

### Chacun n'ecrit que ses propres lignes, et le maitre n'y echappe pas

**AMENDE LE 24/09/2026 POUR `suivi_clients`** : tout le bureau y ecrit et la base signe (`maj_par`). Voir « MES CLIENTS » ET LA FICHE EN PLEINE PAGE, lot 33.

Arbitrage de Ted du 13/09/2026. Sur `suivi_clients`, `echanges`, `taches` et
`calendrier_choix`, seul `cree_par` peut modifier ou supprimer. Consequences a connaitre
avant de croire a un bug :

- la premiere personne qui touche une fiche client la verrouille pour les autres ;
- **le maitre du bureau ne peut pas corriger la fiche creee par un simple utilisateur** ;
- le refus n'est pas poli, c'est une erreur franche de PostgreSQL sur l'upsert.
  `BdvCompte.refusDeProprietaire(err)` la reconnait, et les modules la traduisent en
  francais. Un message anglais avec un code 403 qui remonte a l'ecran est un defaut.

`ventes` et `reglages` suivent l'autre regle : tout le bureau LIT, le maitre seul ECRIT. Un
import de travers ne se trompe pas d'une ligne, il double le chiffre d'affaires du domaine.

**Ce choix vit entierement dans les politiques, pas dans la forme des donnees.** L'ouvrir au
bureau entier le jour ou il genera coute un `drop policy` et un `create policy`, sans
migration et sans toucher au navigateur.

### `v_courrier` depend de colonnes qu'on renomme, et Postgres le refuse

Une vue qui lit une colonne EMPECHE de la supprimer. Le lot 17 supprime donc la vue en tete
de script et la reconstruit a la fin, **a l'identique pour celui qui la lit** : memes neuf
colonnes, meme ordre, donc pas une ligne a changer dans `courrier-matin`. Elle garde
`with (security_invoker = true)`, sans quoi elle s'executerait avec les droits de son
proprietaire et tout compte connecte lirait les adresses, les jetons de desinscription et
les notes clients de tous les autres.

### Ce qui N'A PAS bascule, et qu'il ne faut pas basculer par symetrie

`profils` et `signets` appartiennent toujours a la PERSONNE. Une fiche de compte et ce qu'on
met de cote a lire ne sont pas des donnees de domaine. `chargerProfil()` dans
`bdv-reglages.js` est donc la seule lecture du fichier qui interroge encore `monId()`.

### Reste ouvert

`bdv-signets.js` n'a toujours pas de proprietaire sur sa file hors ligne, defaut signale le
08/09/2026. Les signets restent attaches a la PERSONNE, le risque est donc celui d'origine,
deux comptes sur un poste partage, et pas celui du bureau. Celle des taches a ete fermee le
13/09/2026, sur le modele de `bdv-calchoix.js` : la file retient le BUREAU.

## CHANGER DE BUREAU VIDE LE POSTE, 13/09/2026

**C'est le geste le plus dangereux du chantier, et le danger ne vient pas des droits : il
vient de la MEMOIRE LOCALE.** Ce navigateur porte les lignes de vente du bureau qu'on
quitte, dans IndexedDB, plus le miroir du suivi client, les taches, les choix de calendrier
et l'objectif. Changer de bureau sans rien jeter, et `tirerVentes()` compare le nombre de
lignes d'ICI avec celui du NOUVEAU bureau, trouve un ecart, rapatrie tout, et AJOUTE les
lignes du second aux lignes du premier. Deux domaines melanges dans une seule ardoise, un
chiffre d'affaires faux, et pas une erreur nulle part.

**Tout changement de bureau passe donc par `BdvCompte.changerDeBureau()`**, jamais par une
ecriture directe de `profils.bureau_courant`. Elle ecrit en base d'abord (si on n'est pas
membre, la base refuse et rien n'a ete casse ici), vide le poste comme a la deconnexion mais
GARDE la session (`viderLePoste([SESSION_KEY, PROPRIO_KEY])`), repose la cle du bureau, puis
recharge la page. Le rechargement n'est pas de la prudence : vider le disque n'enleve rien de
la memoire vive, et les ecrans ont deja lu les chiffres du bureau precedent. Meme
raisonnement, et memes mots, que le changement de compte du 07/09/2026.

L'acceptation d'une invitation passe par le MEME chemin, pour la meme raison.

## LA PIECE « L'EQUIPE », 13/09/2026

Neuvieme piece de la barre, avant-derniere, juste devant les reglages : on y va quand on
invite quelqu'un ou quand on change de bureau, pas tous les jours. Pas `viti` : travailler a
plusieurs ne demande aucun export.

**L'INVITATION EST UN LIEN, PAS UN MAIL.** La regle du SEUIL, plus haut dans ce fichier, veut
qu'au premier destinataire qui n'est pas Ted on sorte du sous-domaine `courrier.`, qu'on
passe Resend au palier payant et qu'on ecrive les textes legaux. Un lien ne declenche aucun
des trois. `inviter()` rend deja le jeton : le jour ou l'envoi par mail arrivera, il se
posera par-dessus sans rien changer.

**Le jeton ne s'affiche qu'une fois, et l'ecran le DIT.** La base n'en garde que l'empreinte.
Un lien perdu se remplace en reinvitant la meme adresse, ce qui annule le precedent.

**Cacher un bouton n'est pas une securite.** Les sept fonctions du lot 18 verifient chacune
qui appelle avant d'ecrire. L'ecran masque seulement les gestes qui finiraient en refus.

**Le selecteur de bureau est DANS la piece, pas dans la barre.** La barre n'affiche que le
NOM du bureau courant, et seulement a partir de deux bureaux : un selecteur a une seule ligne
est un ecran mort. Et un geste qui vide le poste et recharge la page ne se pose pas dans une
navigation, sous la souris de quelqu'un qui passe.

**`.btn--ghost` EST INTERDIT SUR LE PAPIER.** Il pose `color: var(--paper)` : il est fait
pour les sections sombres, et sur fond clair il est parfaitement invisible. Defaut paye le
11/09/2026 sur la page de desinscription. Le bouton secondaire du bureau est `.btn--geste`.
Je m'appretais a repayer ce defaut deux fois dans cette piece.

### UNE `.zone` QUI NE DIT PAS SA LARGEUR TOMBE DANS UNE COLONNE SUR DOUZE, 14/09/2026

`.bureau-plan` est une grille de douze colonnes. Une `.zone` posee dedans sans
`grid-column` occupe donc UNE colonne, environ soixante pixels, et tout son texte s'ecrit
**une lettre par ligne**. C'est l'etat dans lequel la piece « L'equipe » est partie en
production, et les dix-huit controles de `npm run verif` etaient verts : aucun ne regarde
une largeur. C'est Ted qui l'a vu.

**Toute zone nouvelle porte `grid-column: span 12` et son conteneur nomme**, comme
`.zone--taches` et le sous-main. Le conteneur n'est pas decoratif : le repli de la ligne se
juge sur la largeur de SA zone, jamais sur celle de la fenetre (regle du 07/09/2026, une
zone fait 722 px dans une fenetre de 1024 et 728 px dans une fenetre de 1280).

**Et tout bloc pose au-dessus des pieces porte `grid-column: 1 / -1`**, meme s'il vit hors
grille aujourd'hui : le bandeau d'invitation s'est replie a soixante pixels le jour ou la
page d'apercu l'a mis dans un `.bureau-plan`. Un bloc qui casse des qu'on le deplace est un
piege pose pour plus tard.

**`justify-self` sur une etiquette.** Sans lui, elle prend toute sa cellule de grille, et
sur telephone « MAITRE » devenait un bandeau de bord a bord qu'on prend pour un bouton.

### UN INVITE N'A PAS DE DOMAINE, 14/09/2026

Defaut signale par Ted : « ca dedouble le bureau que tu as deja ». Le lot 15 donnait un
bureau solo a CHAQUE compte. C'etait juste quand tout le monde etait independant ; pour un
salarie qu'on invite, ce bureau vide encombre le selecteur, et c'est lui qui obligeait a
interdire de quitter son dernier bureau.

**`creer_profil()` regarde s'il existe une invitation en attente pour cette adresse** au
moment de l'inscription, et ne cree alors aucun bureau. C'est la seule facon de le savoir
sans rien demander au navigateur, et la plus sure : le client ne peut pas mentir sur une
invitation qu'il n'a pas.

**Consequence assumee : on peut n'appartenir a AUCUN bureau.** Le garde du lot 18 est
retire, remplace par un ecran qui le dit et propose d'en ouvrir un (`creer_bureau`).
Interdire de partir, c'est enfermer quelqu'un chez son ancien patron. Le garde du DERNIER
MAITRE, lui, reste : aucun ecran ne rattrape un bureau que plus personne ne peut administrer.

### L'INVITATION PART PAR MAIL, ET LE SEUIL EST AMENDE, 14/09/2026

Ted a choisi `equipe@courrier.lebureauduvigneron.fr`, donc le meme sous-domaine que le
courrier du matin. **La regle du SEUIL, plus haut, avait ete ecrite pour le RECAP
QUOTIDIEN** : un mail qui revient tous les matins, que les messageries classent volontiers
en commercial. Une invitation est transactionnelle, elle part une fois, elle est attendue,
elle nomme la personne qui invite. Le risque pour la reputation n'est pas le meme. Les trois
conditions du seuil restent entieres pour le RECAP.

**Ce que l'envoi ouvre, et qu'il fallait fermer dans le meme mouvement : un bouton qui
envoie un mail a une adresse quelconque est un relais a courrier indesirable**, et il porte
le nom de domaine du Bureau du Vigneron. D'ou un plafond de vingt invitations par jour, PAR
BUREAU **et** PAR PERSONNE (le premier seul se contourne en creant des bureaux, le second
seul se contourne a plusieurs), plus un plafond de dix bureaux par compte. **Les plafonds
sont dans la BASE et pas dans la fonction d'envoi** : c'est la base qui fait foi, et elle
protege aussi l'appel direct a `/rest/v1/rpc/inviter`.

**La fonction `invitation` ne verifie AUCUN droit de son cote.** Elle rappelle
`rpc/inviter` avec le jeton de session de l'appelant : est-il maitre, l'adresse est-elle
valide, le plafond est-il atteint, tout reste dans la base. Elle ne lit meme pas la cle de
service. Ce qu'elle sait faire de plus que le navigateur, c'est parler a Resend.

**Le jeton ne revient au navigateur QUE si l'envoi a echoue.** Le mail parti, le secret ne
s'affiche plus nulle part. L'envoi rate, l'invitation existe quand meme et vaut sept jours :
rendre le lien evite de perdre le geste parce que Resend a tousse.

### LA QUESTION « AS-TU DEJA UN COMPTE ? » SE POSE DANS LE BANDEAU

Un bouton unique « Me connecter » envoyait quelqu'un sans compte se cogner a un ecran de
connexion. Deux boutons nets, et **l'adresse invitee est dite puis IMPOSEE au formulaire**
(`porte({ mode, email })`, champ en lecture seule avec sa note). Sans elle, l'invite cree un
compte avec l'adresse de son choix et l'acceptation echoue APRES coup, une fois le compte
cree, c'est-a-dire au pire moment.

Ce que ca coute : qui tient le lien apprend l'adresse invitee. Il tient deja un jeton de
244 bits. Ce qui protege reste entier : accepter demande le lien ET d'etre connecte avec
cette adresse.

### `npm run apercu:equipe`

Ecrit apres ce defaut, et pour qu'il ne se reproduise pas : il monte la piece dans la PAGE
CONSTRUITE, avec les vraies feuilles, dans sa vraie grille de douze colonnes, et rend
`_apercu/equipe.html` en cinq etats fois DEUX THEMES. **Il ne verifie rien, il MONTRE** : il
n'est pas dans `npm run verif`, il s'ouvre et se regarde. Une page d'apercu qui poserait la
zone sur une largeur libre ne pourrait pas montrer ce defaut, et validerait exactement ce qui
etait casse.

Il a lui-meme trouve le piege du bandeau ci-dessus, au premier passage. **Et il a trouve un
defaut de plus a chacune de ses deux reprises** : voir « UNE PIECE QU'UN HARNAIS REND VIDE
N'EST PAS UNE PIECE VERIFIEE », 21/09/2026. Il a aussi passe une journee entiere a rendre la
piece NUE, parce qu'il ne posait que `style.css` et que la scission du matin en avait sorti
toutes les regles `.equipe-*`. **Une page d'apercu se relit le jour ou une feuille bouge.**

### CE QUE LA PIECE EST DEVENUE LE 21/09/2026

Repeinte aux jetons `--bdv-*`, en place, dans `src/css/bdv-poste.css`. Les deux etiquettes de
role restent doubles de leur MOT, et les deux se lisent maintenant : « UTILISATEUR » prend la
surface et l'encre courante, « MAITRE » prend l'accent et sa seule encre (7,27:1 en clair,
8,65:1 en sombre). En papier, « UTILISATEUR » tenait 1,20:1 sur le bureau sombre, c'est-a-dire
qu'il n'etait pas la, alors que « MAITRE », pose sur `--bordeaux`, restait lisible : **une
piece ou l'un des deux etats disparait dit que tout le monde est maitre.**

Trois cibles remontent a 44 px, et ce sont les trois actions decisives : « Envoyer
l'invitation », « Ouvrir mon bureau » (la SEULE sortie de qui n'a aucun bureau) et
« Rejoindre ». `.bdv-coque .btn` pose 36 px, ce qui est juste dans une barre dense et faux a
cote d'un champ de 44.

**Et `.btn--ghost` n'est pas revenu** : la piece n'utilise que `.btn` et `.btn--geste`. Son
equivalent sombre ne rejoue pas le defaut du 11/09/2026 non plus, `.bdv-coque .btn--ghost` de
`bdv-bureau.css` lui rendant `--bdv-encre-3` au lieu de la couleur du papier.

### LE SEUIL : le premier destinataire qui n'est pas Ted

En phase de test, Ted a garde `courrier.` comme sous-domaine d'envoi et le palier Resend
gratuit. C'est tenable a deux comptes qui sont les siens.

**La reputation d'un domaine n'est pas un reglage** : elle se construit et se repare en
semaines. Si le recap quotidien fait classer `courrier.` en courrier commercial, ce sont les
codes de reprise de mot de passe qui n'arrivent plus, et le vigneron reste enferme dehors sans
message d'erreur.

Donc, au premier destinataire qui n'est pas Ted, et STRICTEMENT AVANT l'envoi :
1. sortir le recap de `courrier.` ;
2. passer au palier Resend payant. Le gratuit plafonne a 100 par jour, et c'est le meme quota
   que les codes d'inscription ;
3. ecrire les textes legaux. Le pied de page promet que les ventes restent dans le navigateur,
   et `src/rgpd.njk` ne nomme aucun sous-traitant. Le mail porte des noms de clients et des
   montants : ces deux textes deviennent faux.

**Le garde-fou est dans le code, pas dans une note** : tant que l'expediteur est `courrier.`,
la fonction d'envoi refuse tout destinataire hors d'une liste ecrite en dur. Ouvrir demande de
toucher au code, ce qui est la que la decision doit se reprendre.

### La cle `service_role` ne sort pas de Supabase

La fonction d'envoi du lot 3 devra lire les donnees de TOUS les comptes, donc utiliser la cle
`service_role`, qui court-circuite entierement la securite par ligne. C'est le premier
composant du projet a pouvoir le faire. Elle reste dans les secrets Supabase : jamais dans le
depot, jamais chez Vercel, jamais dans un fichier du site.

## UN GESTE QUI ECHOUE DOIT LE DIRE, DES DEUX COTES, 09/09/2026

Il y a DEUX chemins pour poser un rappel, et un seul sait avouer un echec.

`bdv-crm.js`, la file du bureau, applique la regle : `ecrireSuivi()` leve
`new Error('aucune session')` plutot que de rendre la main, `geste()` remet la ligne a l'ecran
si rien n'est parti, et le dit.

`bdv-base.js`, la fiche du tableau de bord, ne l'applique pas :

```js
function syncSuivi(id){
  if(!syncPret()||!id)return;                                    // sortie muette 1
  const c=CRM[id];
  (c?BdvSync.ecrireSuivi(id,c):BdvSync.supprimerSuivi(id)).catch(function(){});  // sortie muette 2
}
```

Puis `crmSet()` annonce « Rappel enregistre. » sur la foi du seul `crmSave()` dans le
`localStorage`. Le message dit vrai sur le navigateur et faux sur le compte, et rien ne
distingue les deux cas a l'ecran.

A LIRE AVEC SA CORRECTION. Le 09/09/2026 j'ai cru constater cet incident : Ted disait avoir
pose des rappels et `suivi_clients` etait vide. Erreur de ma part, il avait pose des TACHES,
une autre fonction et une autre table. AUCUN incident n'a ete constate sur ce chemin. La
faiblesse du code, elle, est reelle et lue dans le code : en `return=minimal` une session
morte et un succes sont indistinguables, et le suivi n'avait aucune file de rejeu. C'est du
durcissement, pas une reparation.

Et la lecon vaut au-dela : **une table vide n'est pas la preuve d'une panne**. Verifier
QUELLE fonction a ete utilisee avant de diagnostiquer quelle table est vide.

How to apply: **aucun `.catch(function(){})` vide sur une ecriture dont l'issue est montree a
l'ecran.** Un message de succes ne se pose qu'apres l'ecriture serveur, ou alors il dit
explicitement que la synchronisation reste a faire. Un rappel qui ne vit que dans le navigateur
est perdu au changement d'appareil, et la base fait foi.

## ON NE DÉPLOIE QUE DEPUIS LE DÉPÔT, ET UN BANC LE VÉRIFIE, 10/09/2026

Il n'y a pas de CLI Supabase sur le poste. La fonction `courrier-matin` est donc déployée depuis le
conteneur, à partir de copies qui vivent là-bas, pendant que le dépôt vit sur le Mac. Deux endroits,
aucun lien mécanique entre les deux.

Ce qu'on a payé le 10/09/2026 : le `index.ts` **commité** portait encore l'ancien verrou d'entrée
(comparaison de l'en-tête `Authorization` à la clé de service) alors que la production tournait
depuis la veille avec le secret dédié `COURRIER_CLE`. **Le dépôt avait cessé d'être la source de
vérité de ce qui tourne, et rien ne le disait.** L'empreinte inscrite dans l'en-tête annonçait
512 lignes quand la fabrique en faisait 880.

How to apply :

1. **Avant tout déploiement**, `npm run courrier:joindre`. Il recopie `src/js/bdv-courrier.js` dans
   `_deploiement/courrier-matin/` et tamponne l'empreinte dans l'en-tête de `index.ts`.
2. **On déploie ce dossier-là, et rien d'autre.** Pas une copie du conteneur, pas un fichier
   recollé à la main.
3. **L'empreinte ne s'écrit jamais à la main.** `npm run verif` appelle `courrier:verif`, qui échoue
   si elle ne correspond plus. Un commentaire faux fait conclure à tort : il est pire que pas de
   commentaire. Donc c'est un banc, plus une convention.
4. **Un correctif déployé sans être commité n'existe pas.** Le déploiement suit le commit, jamais
   l'inverse.

## UNE ADRESSE QUI PEUT MOURIR EST UN RÉGLAGE, PAS UNE CONSTANTE, 10/09/2026

Le bouton « Ouvrir mon bureau » est la seule action du courrier du matin. Il pointait vers
`https://lebureauduvigneron.fr/mon-bureau/`, valeur de repli de `batir()`, et **ce domaine n'a
jamais été branché sur Vercel** : il résout encore vers IONOS et ne sert aucun certificat. Le
premier vrai courrier est parti avec un bouton mort.

Ce qui rend cette panne mauvaise n'est pas le lien cassé, c'est qu'**elle ne remonte pas**. L'envoi
réussit, le rapport dit « envoyé », et c'est le vigneron qui tombe sur une erreur de navigateur.

How to apply :

- L'adresse du bureau est le secret Supabase **`URL_BUREAU`**, passé à `batir()` par la fonction
  d'envoi. Au branchement du domaine, on change une variable : ni code, ni redéploiement.
- Le repli dans le code reste l'adresse **définitive**, pour que ce soit le réglage temporaire qui
  se voie dans les secrets, et pas l'inverse.
- **Toute adresse que le mail fait cliquer figure dans le rapport de la fonction**, à chaque appel,
  `?apercu=1` compris. C'est le seul moyen de s'apercevoir qu'elle est fausse avant le destinataire.
- Règle générale : quand un envoi réussit alors que ce qu'il transporte est cassé, le garde-fou ne
  peut pas être dans le code de l'envoi. Il doit être dans ce que l'envoi RACONTE.

## LE SITE N'ENTRE PAS DANS LE CHEMIN D'ENVOI DU MAIL, 10/09/2026

Tentation vérifiée puis refusée : faire lire `bdv-courrier.js` à la fonction Edge depuis le site,
par `import 'https://lebureauduvigneron.fr/js/bdv-courrier.js'`, pour n'avoir plus rien à recoller.
Le fichier **est** bien servi, 200 et à jour, donc techniquement ça marche.

Refusé parce que le jour où on l'a vérifié, le domaine était injoignable : le courrier de 8 h ne
serait pas parti, et le rapport aurait annoncé une erreur d'import, pas un domaine.

How to apply : **le site et l'envoi du mail sont deux pannes qui doivent rester indépendantes.** Une
gêne de confort dans la chaîne de déploiement se règle par un script, pas en ajoutant une dépendance
réseau dans un chemin qui doit fonctionner à 8 h sans personne devant.

## RIEN DE VIVANT EN PRODUCTION NE DOIT ETRE INCONNU DU DEPOT, 10/09/2026

Deux fois le meme jour, sur deux organes differents :

- le `index.ts` commite de `courrier-matin` portait encore l'ancien verrou d'entree alors que la
  production tournait avec `COURRIER_CLE` : un correctif deploye sans etre commite ;
- les deux gabarits d'e-mail de l'authentification, les seuls ecrits que le produit envoie a ses
  utilisateurs, ne vivaient nulle part dans le depot. Ni `npm run charte` ni `npm run verif` ne les
  voyaient, et leur couleur en dur ne portait pas le nom de son jeton.

Ce qui rend cette classe de panne mauvaise : **elle ne se manifeste jamais au moment ou elle est
creee.** Elle attend qu'on relise, qu'on redeploie, ou qu'un jeton change.

How to apply :

1. **Tout ce qui vit dans un tableau de bord tiers a un fichier de reference dans le depot.**
   Fonctions Edge, gabarits d'e-mail, vues SQL, reglages qui portent du texte ou une couleur.
2. **L'ordre est : on modifie le fichier, on relit, puis on colle dans le tableau de bord.** Jamais
   l'inverse. Une modification faite directement dans l'interface est invisible pour toujours.
3. **Un correctif deploye sans etre commite n'existe pas.** Le deploiement suit le commit.
4. Quand le fichier de reference n'est lu par aucun programme, il porte en tete ce qu'il est, ou il
   est deploye, et la correspondance entre ses valeurs en dur et les jetons de la charte. Sinon
   c'est une copie qui derive, et une copie qui derive est pire que pas de copie.

## Le courrier du matin, lot 4 : l'heure et le doublon, 10/09/2026

Ces trois regles portent le declenchement automatique. Elles ne se voient pas dans l'interface,
et une seule d'entre elles casse le mail de facon irreparable si on la defait.

### 1. UN SEUL MAIL PAR COMPTE ET PAR JOUR, ET C'EST LA BASE QUI LE TIENT

La cle primaire `(compte, jour)` de `public.courrier_envois` EST le garde-fou. La fonction ne
verifie pas « ai-je deja envoye ? » avant d'ecrire : entre le verifier et le ecrire d'un tel code,
un second appel passe. Elle POSE la ligne et regarde si Postgres l'a acceptee.

Ne jamais remplacer ce mecanisme par un `select` suivi d'un `insert`, meme si ca se lit mieux. Et
ne jamais ecrire la trace APRES l'envoi : la reservation vient avant l'appel a Resend, sinon une
relance pendant que Resend repond envoie deux mails.

Un mail double n'est pas un petit defaut. C'est celui qui apprend a ne plus ouvrir le mail,
exactement comme la tache sans date qui reparait chaque matin.

### 2. L'HEURE SE DECIDE DANS LA FONCTION, PAS DANS LE CRON

Le declencheur passe TOUTES LES HEURES et c'est `index.ts` qui compare l'heure de Paris a
`HEURE_ENVOI`. Un cron ecrit en UTC donnerait 8 h l'ete et 7 h l'hiver, et personne ne se
souviendrait de le corriger au changement d'heure. Meme piege que celui deja documente pour
`jourAParis()`.

Consequence a ne pas prendre pour un defaut : 23 passages par jour ne font rien et rendent **200**,
pas une erreur. Un 4xx ferait 23 lignes rouges quotidiennes dans le journal de la fonction, et une
vraie panne s'y noierait.

### 3. UNE RESERVATION EN ECHEC NE SE REJOUE PAS TOUTE SEULE

Quand Resend refuse, la ligne du jour RESTE POSEE avec son motif dans `echec`. Elle n'est pas
effacee, donc aucun passage suivant ne retente.

Arbitrage, et l'alternative a ete pesee : effacer la ligne pour permettre une nouvelle tentative
reintroduit le doublon qu'on vient d'interdire, parce qu'un refus de Resend ne dit PAS si le mail
est parti -- une reponse perdue ressemble a un refus. On prefere un mail manquant, qui coute un
jour, a un mail double, qui coute un lecteur. La reprise se demande a la main, `?rejouer=1`, qui
n'efface que les lignes portant un `echec`.

### Les deux derogations, et pourquoi elles sont dans l'URL

`?maintenant=1` ignore l'heure. `?rejouer=1` efface les echecs du jour. Aucune des deux n'est
utilisee par le declencheur : ce sont des gestes de Ted, depuis son terminal. Le plafond
`MAX_PAR_PASSAGE` est verifie AVANT la reservation, et pas apres : reserver la journee d'un compte
qu'on ne va pas servir lui interdirait son mail jusqu'au lendemain.

## CE QU'UNE MESSAGERIE JETTE, ET LA REGLE QUI VA AVEC, 10/09/2026

Trois defauts trouves le meme apres-midi, tous dans le PREMIER vrai courrier recu dans une
vraie boite. Aucun n'etait visible dans `npm run courrier` : l'apercu enferme chaque mail dans
un cadre etroit, et il rend le HTML dans un navigateur, pas dans Gmail. **On validait un
dessin qu'on n'a jamais recu.** C'est le defaut de methode a retenir avant les trois autres.

### 1. Un fond va sur la CELLULE, en `bgcolor` ET en `background-color`

Jamais sur la seule balise `<table>`, jamais en propriete raccourcie `background`. Gmail a
jete le fond des bandes de section : creme clair sur creme clair, illisible, et l'alternance
des lignes disparue avec. Les jauges et l'histogramme tenaient, eux : ils portaient deja
`bgcolor`. La regle etait ecrite dans `bdv-courrier.js`, au-dessus de `barre()`, et n'avait
pas ete appliquee partout. **Une regle appliquee a moitie ne protege rien.**

### 2. Aucun degrade, et aucune image hebergee

`radial-gradient` est ignore par Gmail comme par Outlook : les trous de perforation
n'arrivaient pas. Le remplacement evident, une image de fond, est REFUSE pour deux raisons
qui valent pour tout futur ornement : les messageries bloquent les images par defaut, donc le
dessin n'apparaitrait qu'apres un clic ; et le mail ne doit dependre d'aucune adresse du site,
parce que l'envoi de 8 h et le site sont deux pannes qui restent independantes.
Ce qui reste : des cellules de tableau. Un trou par ligne, `border-radius` pour le rond, un
carre sous Outlook, et c'est tres bien.

### 3. Une largeur se borne, meme quand la consigne dit « toute la largeur »

« Le papier occupe toute la largeur » vaut pour le FOND, pose sur le `body`. Le contenu tient
dans la colonne pour laquelle il a ete dessine, 560 px ici. Sans borne, un Gmail ouvert en
grand etale le courrier sur 1800 px : les montants a un metre des noms, l'histogramme etire.
`width="560"` en attribut pour Outlook, qui ignore `max-width`, et
`width:100%;max-width:560px` en style pour tous les autres. **Jamais l'un sans l'autre**,
sinon un telephone de 390 px deborde.

### How to apply, avant de toucher au dessin du courrier

1. `npm run courrier` juge le CONTENU et l'ordre, pas le rendu en messagerie. Ne jamais
   conclure « c'est bon » sur cet apercu seul.
2. Photographier le rendu a 1280 px et a 400 px avant tout envoi. C'est le seul controle qui
   attrape une largeur non bornee.
3. Puis un envoi reel dans une vraie boite. C'est le seul qui attrape ce que la messagerie
   jette. Les deux premiers ne le remplacent pas.

### 4. UN CHIFFRE DE TRAVAIL SE MET DANS LE RAPPORT, 10/09/2026

Regle tiree du defaut le plus dangereux de la journee, et il etait de moi.
`heureAParis()` formatait en `fr-FR`, qui rend « 14 h » et pas « 14 ». `Number('14 h')` vaut
NaN, et **NaN n'est egal a rien** : la comparaison `heure !== HEURE_ENVOI` etait TOUJOURS
vraie. Le declencheur horaire aurait repondu « hors heure » vingt-quatre fois par jour, en
code 200, sans jamais envoyer un courrier -- pendant des semaines, sans une ligne rouge.
C'est exactement la panne que le lot 4 existe pour empecher, ecrite dans le lot 4.

**Aucun controle hors ligne ne pouvait la voir** : ni Node ni le banc ne formatent avec l'ICU
de Deno. Ce qui l'a attrapee, c'est `heure_paris` expose dans le compte rendu, qui valait
`null`.

How to apply : toute valeur dont depend une DECISION du programme -- une heure, un seuil, une
adresse, un compteur -- se met dans le rapport, meme si elle n'interesse personne un jour
normal. Ca ne coute rien, et c'est le seul filet quand le comportement depend d'un
environnement qu'on ne peut pas reproduire. Meme motif que `url_bureau` : un bouton mort ne
fait echouer aucun envoi, donc rien ne le signale.

Et pour les dates et heures : ne jamais faire `Number()` sur un `Intl.DateTimeFormat` en
locale francaise. Locale `en-GB`, ET retrait de tout ce qui n'est pas un chiffre.

## UN CONSENTEMENT QU'ON AFFIRME DOIT EXISTER QUELQUE PART, 11/09/2026

Le pied du courrier du matin a dit pendant deux jours : « Tu recois ce courrier parce que tu l'as
demande dans les reglages de ton bureau. » Le bloc « Le courrier » des reglages ne portait qu'une
case, celle de l'edition bimensuelle. **Le courrier du matin n'avait aucun interrupteur** : il
partait a tout compte present dans la vue.

La phrase n'etait pas une approximation, c'etait une declaration fausse sur un consentement, dans
un mail quotidien qui porte des noms de clients et des montants. C'est exactement la phrase qu'un
vigneron mecontent citerait, et elle etait de notre main.

**Les trois regles qui en sortent.**

1. **Une phrase de pied de mail est une affirmation verifiable.** Avant d'ecrire « tu l'as
   demande », montrer la colonne qui le stocke. Si elle n'existe pas, la phrase ne s'ecrit pas.
2. **Le consentement se verifie dans la REQUETE, jamais dans l'expediteur.** `v_courrier` se
   termine par `where p.consent_courrier`. Une regle posee dans la vue protege tout appelant
   present et futur, y compris celui qui la lira dans six mois sans avoir lu index.ts. Une liste
   d'exceptions dans le code de l'expediteur, elle, s'oublie.
3. **Un booleen de consentement se double d'une date.** Le RGPD 7-1 met la charge de la preuve
   sur nous. Un booleen dit l'etat d'aujourd'hui, pas l'histoire, et le jour ou quelqu'un ecrit
   « je n'ai jamais demande ca », la seule reponse qui tient est une date. La date est posee par
   un DECLENCHEUR et pas par l'appelant : il y a trois chemins qui touchent ces cases, et il
   suffit qu'un seul l'oublie pour que la preuve manque sur la ligne contestee.

## UNE DUREE ANNONCEE SANS TACHE QUI L'APPLIQUE EST UNE DECLARATION FAUSSE, 11/09/2026

En corrigeant `src/rgpd.njk`, j'ai ecrit que le journal des envois est « conserve un an, puis
efface ». Rien ne l'effacait : `courrier_envois` grossit d'une ligne par compte et par jour, pour
toujours. J'ai ecrit la phrase avant d'avoir la tache.

Une duree de conservation annoncee et non tenue se verifie en une requete, et elle coute plus cher
qu'une duree absente : c'est une declaration fausse, pas un oubli. Le lot 13 pose la purge.

**La regle : toute phrase de la politique de confidentialite qui decrit un COMPORTEMENT
(« conserve un an », « efface immediatement », « ne quitte jamais ton appareil ») se relit comme
une specification. Soit le code la tient deja, soit les deux partent ensemble, soit la phrase ne
s'ecrit pas.** Et si l'un des deux doit attendre, c'est la page.

## UN BOUTON DE DESINSCRIPTION SE REGARDE, IL NE SE RELIT PAS, 11/09/2026

La page `/mes-emails/` a ete ecrite avec `class="btn btn--ghost"` sur le bouton « Ne plus rien
recevoir ». Cette classe pose `color: var(--paper)` : elle est faite pour les sections sombres.
Sur le fond clair de la page, **le bouton etait parfaitement invisible**. Le code se relisait
bien ; c'est la capture d'ecran qui l'a montre.

Un bouton de desinscription invisible est le pire defaut possible sur cette page, et c'est celui
que personne ne signale : on ne rale pas contre un bouton qu'on ne voit pas, on rale contre le
mail qu'on continue de recevoir. Meme famille que les fonds de mail manges par Gmail, meme
methode : **capturer avant de livrer, aux deux largeurs, et regarder l'image**.

## UNE COLONNE LUE ET PAS DEMANDEE NE LEVE AUCUNE ERREUR, 13/09/2026

Le courrier du matin n'est parti ni le 12 ni le 13. Aucune ligne rouge, aucun 4xx, aucune
ligne dans `courrier_envois`. Du silence, qui est exactement le seul symptome que le lot 4
annoncait.

**La cause : `jeton_emails` etait LU par `index.ts` et jamais DEMANDE a PostgREST.** La liste
`?select=` datait du lot 3, le 09/09 ; le lot 12 a ajoute le jeton a la vue le 11/09 sans la
toucher. PostgREST ne rend que les colonnes nommees : la colonne n'arrivait pas `null`, elle
n'arrivait pas. `c.jeton_emails` valait `undefined`, le lien de preferences ne se fabriquait
plus, et le garde-fou 3bis refusait TOUS les comptes en repondant 200.

Ce qui le prouve, et ce qui doit servir de methode la prochaine fois : `consent_courrier_le`
est date de 10 h 04 le 11/09, donc APRES l'envoi de 8 h 05 du meme jour. **La chaine avec
consentement et jeton n'avait jamais abouti une seule fois.** Un envoi reussi la veille d'un
lot ne prouve rien sur le lot.

**La regle : une colonne lue et pas demandee est une faute qui ne se voit nulle part.** Ni a
la relecture, ni dans un journal, ni dans un code HTTP. Le seul endroit ou elle s'attrape est
un controle qui compare les deux listes du meme fichier. La liste s'appelle maintenant
`CHAMPS`, en tete de `lireLesComptes()`, et `npm run courrier:verif` echoue si `index.ts` lit
un `c.<nom>` qui n'y figure pas. Verifie en remettant le defaut, comme le veut la regle du
depot : un controle qui n'a jamais echoue ne garde rien.

### La lecture de la vue a droit a UNE reprise, et elle seule

Le 13/09 a 8 h 05, la meme requete a rendu **504 en 30 millisecondes** : un refus immediat de
la passerelle, pas une expiration. La requete s'execute en 0,3 ms et les donnees pesent 3 ko
par compte, la base n'y est donc pour rien. C'etait la PREMIERE requete REST depuis 22 h 47 la
veille, et ce sera le cas tous les matins : **le controle de l'heure sort AVANT de lire**,
donc les 23 autres passages ne sollicitent jamais PostgREST. Le seul appel qui le reveille est
celui qui doit reussir.

Deux essais, deux secondes d'ecart. **Reprendre ICI ne contredit pas la regle 3 du lot 4** :
aucune reservation n'est posee a ce stade et rien n'est parti chez Resend, donc aucun doublon
n'est possible. L'interdiction de rejeu protege un lecteur contre un mail double ; cette
reprise protege une journee contre un reveil rate. Ne pas les confondre, et ne pas etendre la
reprise apres la reservation.

Et le nombre d'essais va dans le rapport, `essais_lecture` : sans lui, la reprise masquerait
en silence le fait que le premier appel echoue tous les matins. Regle 4, encore.

## UNE PIECE DU BUREAU A TROIS ETAGES, ELLE N'EST PAS UNE PILE, 11/09/2026

Constat qui a ouvert la redecoupe : « Mon annee » portait **26 blocs**, parce que la fusion du
07/09 y avait empile quatre anciens ecrans (Diagnostic, Apercu, Evolution, Canaux) sans jamais en
alleger aucun. Trois blocs y etaient meme ecrits deux fois. Ted l'a dit ainsi : « c'est le
fouilli, on ne fait que scroller ».

**La regle, pour toute piece du bureau et pour tout bloc qu'on y ajoute :**

1. **Un verdict en haut.** Une phrase, un chiffre, et le geste qu'ils reclament. Rien d'autre.
2. **La liste ou l'on agit au milieu.** C'est ce pour quoi le vigneron a ouvert la piece.
3. **Ce qui explique, replie en bas**, dans un `<details class="msg--replie">`. Le style existe
   deja dans `src/css/bdv-ecrans.css`. Replie par defaut, titre visible et cliquable.

Un bloc qui n'entre dans aucun des trois n'a pas sa place dans cette piece. C'est la seule chose
qui empeche de refabriquer « Mon annee » ailleurs, un bloc a la fois, sans que personne ne s'en
apercoive.

**Corollaire : une piece repond a UNE question.** Mon commerce, ce sont les gens. Mes cuvees, ce
sont les vins. Mon cap, c'est le total. Un bloc se range par la question qu'il pose, pas par la
nature de sa donnee.

### Et le libelle d'une piece n'est pas son identifiant

Renommer une piece, c'est changer son `label` dans `bdv-nav.js` et son entree dans `NAV` de
`bdv-ecrans.js`. **Jamais son `id`.** L'identifiant tient l'adresse `/mon-bureau/#<id>`, donc les
signets du vigneron et tous les liens qu'il a copies, et c'est lui que `npm run banc` compare
entre les deux fichiers. « Mes clients » est devenu « Mon commerce » le 11/09/2026 : l'adresse est
restee `#clients`.

**Et l'ordre de la barre est controle.** `scripts/banc-bureau.mjs` porte la liste des huit
libelles, dans l'ordre. Renommer une piece sans y toucher fait echouer le banc, et c'est voulu :
on ne change pas la barre par accident.

### Un chiffre dont on ne peut pas voir le perimetre est un chiffre faux

`navTo()` n'affiche la barre de periode (`filterbar`) que sur l'ecran « annee ». Un bloc deplace
depuis cet ecran vers un autre ne doit donc plus lire `filters`, ni passer par `mesureVal()` : il
suivrait un reglage pose ailleurs, invisible la ou il s'affiche, parfois des semaines plus tot.
Il lit toute la base, en CA HT, et il le dit dans sa note. Applique au pied de « Mon commerce ».

## QUAND DEUX ECRANS FUSIONNENT, C'EST LE TEXTE DES CELLULES QUI TRAHIT, 11/09/2026

Lot 3 de la redecoupe. « Evolution dans le temps » est entre dans « Mon registre ». Les deux
affichaient un tableau periode par periode, et les deux le remplissaient avec les memes cles.
Mais l'un passait ses en-tetes par `periodLabel()` et l'autre non : apres la fusion, les mois
s'ecrivaient « 2026-03 » au lieu de « mars 2026 ».

La charte ne regarde pas ce texte. Les bancs de structure verifient qu'un bloc est present, pas
ce qu'il y a ecrit dedans. **Aucun controle du depot ne voyait la regression.**

La regle : **quand un bloc change d'ecran, comparer ce qu'il AFFICHAIT avec ce qu'il affiche**,
cellule par cellule, et pas seulement verifier qu'il est toujours la. Les deux endroits ou ca se
joue d'habitude : le formatage des cles (dates, montants, pourcentages) et les libelles qui
citaient l'ecran d'origine.

### Ecrire un banc qui monte le moteur : un seul `eval`

`bdv-base.js` declare ses globales en `let` et `const`. Dans un `eval`, elles restent scopees a
CET eval. Charger `bdv-base.js` puis `bdv-ecrans.js` en deux appels donne « ROWS is not
defined », sans que rien n'ait echoue avant. Les deux fichiers et le scenario de test partent
ensemble, en une seule chaine. Voir `scripts/banc-registre.mjs`.

## UN NOM BIEN CHOISI SUPPRIME DU CODE, 11/09/2026

Lot 4 de la redecoupe. La piece de bilan s'appelait « Mon annee » ou « Mon exercice » selon le
mois d'ouverture du domaine. Pour ecrire ce libelle sans charger le moteur, `bdv-nav.js` relisait
la cle d'exercice du navigateur de son cote : une cle dupliquee, avec quinze lignes de commentaire
pour expliquer pourquoi c'etait dangereux et pourquoi on le faisait quand meme.

Elle s'appelle « Mon cap ». Le nom pose la question a laquelle la piece repond au lieu de nommer
une periode, il tient sur les deux exercices, et il ne depend plus d'aucun reglage. La duplication,
sa fonction et ses quinze lignes de commentaire ont disparu avec lui.

**Avant d'ecrire du code pour faire varier un libelle, chercher le nom qui n'a pas besoin de
varier.** C'est presque toujours le meilleur nom, et c'est toujours le moins cher.

## DEUX CHAMPS DE SAISIE POUR UNE VALEUR, C'EST UN CHAMP DE TROP, 11/09/2026

L'objectif de CA annuel se saisissait dans « Mon annee » ET dans « Mes reglages », onglet « Tes
ventes ». Meme cle, meme ecriture en base, deux formulaires. Celui de la piece ne se repeignait
qu'au rendu de l'ecran : apres une saisie dans les reglages, il pouvait afficher l'ancien montant
jusqu'au prochain calcul.

La regle : **un reglage se saisit dans les reglages, et nulle part ailleurs.** Un ecran qui a
besoin de le montrer affiche sa VALEUR et dit ou la changer. Vaut pour tout ce qui vit dans
`profils` : objectif, mois d'exercice, libelles perso, preferences de courrier.

## UN BOUTON QU'ON N'AFFICHE PLUS NE SE PLAINT JAMAIS, 11/09/2026

Lot 5 de la redecoupe. La fusion du 07/09 avait masque trois ecrans (`p-reactivation`,
`p-premier`, `p-decrochage`) dont les listes etaient parties dans « Mon commerce ». Quatre
boutons d'export vivaient dedans, avec des colonnes que rien d'autre ne produit : cadence,
rythme, date de prochaine commande attendue, CA de l'exercice precedent. Ils sont devenus
inatteignables ce jour-la, et **aucun controle n'a rien dit**, parce qu'il n'y a rien a signaler
quand un bouton n'est pas dessine.

La regle, quand on masque ou fusionne un ecran : **lister ce qu'il portait d'ACTIONNABLE**, pas
seulement ce qu'il affichait. Un tableau perdu se remarque, un bouton perdu ne se remarque pas.

Corollaire technique, verifie le meme jour : **un export ne doit jamais lire une liste qu'un
ecran a remplie en se peignant.** Les quatre exports lisaient `premierList`, `reactList` et
`decroList`, garnies par les fonctions de rendu. Un export construit comme ca rend un fichier
VIDE, sans erreur, le jour ou son ecran n'est plus peint. Ils appellent maintenant leur agent
directement.

### Et un scenario de banc trop sage ne teste rien

`banc-commerce.mjs` a d'abord echoue sur cinq controles pour une seule raison : ses clients de
demonstration achetaient tous les mois, en croissance. Personne a rappeler, donc pas de liste,
donc pas de boutons. **Un banc d'ecran doit fabriquer la situation que l'ecran est fait pour
montrer**, pas une base en bonne sante.

## QUAND UNE PIECE BOUGE, RELIRE CE QUE LES TEXTES DISENT, 11/09/2026

Verification de cloture de la redecoupe, par capture d'ecran. Trois signaux de « Mon cap »
renvoyaient encore le vigneron « a l'onglet Decrochage », « a l'onglet Reactivation » et « a
l'onglet Canaux ». Ces trois ecrans avaient ete supprimes pendant le chantier.

Le code marchait. La charte etait CONFORME. Les quatorze bancs etaient verts. Et la phrase
envoyait le lecteur vers un endroit qui n'existe plus.

**Un renvoi est du contenu, pas du code : rien ne le verifie.** Apres avoir deplace, renomme ou
supprime un ecran, chercher dans tout le fichier les textes qui le NOMMENT : « l'onglet X »,
« voir X », « detail dans X ». Un renvoi doit citer la piece telle qu'elle s'appelle dans la barre,
et si possible le filtre exact : « la liste est dans Mon commerce, filtre Recul confirme ».

### La capture reste le seul controle qui lit les phrases

Le harnais : une page autonome avec les vraies feuilles et le vrai moteur, des ventes fabriquees,
les pieces peintes puis photographiees avec Playwright. Deux limites, le conteneur de capture
n'ayant pas de reseau : pas de Google Fonts (substituts systeme) et pas de Chart.js (un tracage de
secours prend sa place). Elle vaut pour la mise en page et les textes, jamais pour la typographie
ni pour la fidelite des graphiques.

## LA PAGE D'ACCUEIL : APRES LA PROMESSE, LA PREUVE, 12/09/2026

**Rien ne s'intercale entre le hook et `demo-pinboard`.** C'est la regle d'ordre de l'accueil, et
elle a un chiffre derriere elle. Avant ce jour, l'ordre etait : hero, articles, podcast,
partenaires, manifeste, compteurs, demonstration, inscription. Mesure sur la page produite, fenetre
de 1440 x 900 : 6 077 px en tout, et la demonstration du bureau commencait a 3 802 px, soit **4,2
ecrans de defilement**. Le visiteur traversait trois articles, un podcast qui n'existe pas encore,
deux partenaires reels etales sur trois cartes, un manifeste qui redit les 2 000 bureaux deja dits
dans le h1, et trois compteurs qui annoncent que tout demarre, AVANT de voir ce qu'on fait.

La page vendait un media. Le produit est un bureau. Le pinboard est le seul objet de cette page qui
MONTRE le produit, et c'est aussi le meilleur objet du site.

L'ordre est maintenant : **hero, demo-pinboard, manifeste, articles-une, filiere-bande, compteurs,
waitlist**. La demonstration commence a 839 px, soit 0,9 ecran. Le raisonnement complet et
l'alternance des fonds sont commentes en tete de `src/index.njk` : c'est la qu'il faut lire avant
de deplacer une section.

Un cas ou la regle ne s'applique plus : le jour ou la page portera une VRAIE preuve sociale, des
temoignages de vignerons qui s'en servent. Elle passerait alors juste apres la demonstration. Pas
avant : une promesse, une preuve, puis ce que les autres en disent.

### `compteurs-honnetes` reste juste avant l'inscription, et ce n'est pas un oubli

Il dit « 3 podcasts en route, N articles, 8 partenaires en discussion » : c'est un aveu de
demarrage, et il est bon qu'il y soit. Le mettre plus haut reviendrait a prevenir qu'il n'y a rien
avant d'avoir montre qu'il y a quelque chose.

## DU TEXTE SUR UNE PHOTO N'A PAS DE CONTRASTE, IL EN A UN PAR ENDROIT, 12/09/2026

**Un voile plat ne protege rien.** Le hero posait `--bordeaux-veil`, 0,70 sur toute la largeur, et
centrait son texte. Deux consequences, et la charte ne pouvait voir ni l'une ni l'autre :

1. la photo devenait marron. Le bureau, le cahier ouvert, le verre, les caisses : tout ce qui fait
   l'argument de la page etait eteint uniformement ;
2. le texte etant centre et la piece etant photographiee de face, le paragraphe et les deux boutons
   tombaient **sur l'ecran allume**, la zone la plus claire de l'image. Le contraste y etait le
   pire de toute la page, a l'endroit exact ou on avait pose les lettres.

La regle : **le voile est directionnel, et le texte est borne pour ne jamais sortir de sa zone
franche.** `--voile-hero-fort` tient le texte a gauche, `--voile-hero-doux` libere la photo a
droite, `--voile-pied` raccorde le bas au papier de la section suivante. `.hero__bloc` borne le
texte a 600 px, la zone franche va jusqu'a 60 % : la marge entre les deux est voulue, elle existe
parce qu'a 56 % la derniere lettre d'une ligne pleine tombait pile sur le debut du degrade.

**Sous 900 px, le voile redevient franc sur toute la largeur.** Le reglage directionnel repond a un
probleme de largeur ; sur un telephone le texte traverse la fenetre, et le meme reglage qui protege
le contraste en grand le detruirait en petit.

### `npm run charte` ne peut rien dire de tout ca, et `scripts/banc-hero.mjs` le mesure

La charte lit des regles CSS. Le contraste d'un texte sur une photo depend, pixel par pixel, de ce
que la photo montre a cet endroit et du cadrage que le navigateur a choisi pour la fenetre
courante. `scripts/banc-hero.mjs` photographie la page deux fois, une fois telle quelle et une fois
le bloc de texte rendu invisible, puis compare chaque texte au **pixel de fond le plus clair** de sa
boite, pas a la moyenne : une ligne illisible sur dix suffit a perdre un lecteur.

Il demande `playwright`, qui n'est pas une devDependency : il n'est donc pas dans `npm run verif`,
comme `scripts/capture-telephone.mjs`. Le mode d'emploi est dans son en-tete.

Trois choses a savoir avant d'y toucher, et elles y sont ecrites : `opacity` n'est pas une couleur
de texte, `.btn` plein est un faux positif nomme (il porte son propre fond `--paper`), et il faut
mesurer aux DEUX largeurs, parce que ce sont deux reglages de voile differents.

## L'ETAPE 03 DE LA DEMONSTRATION MONTRE LE BUREAU, PAS VITISOFT, 12/09/2026

**Le produit de la page d'accueil est Le Bureau du Vigneron.** Pendant des mois, la troisieme
etape du pinboard etait une reproduction du tableau de bord de VITISOFT : sa barre de titre, ses
sept menus, son donut de familles, ses KPI, sa courbe, VINCA. La demonstration racontait donc
« papier en vrac, papier range, puis Vitisoft », et un visiteur qui allait au bout comprenait
qu'on lui vendait le logiciel de la maison mere. Signale par Ted : « il faut que ca reprenne le
detail du bureau, pas de Vitisoft reinvente. »

**La regle : quand une page du site montre le produit, elle montre les VRAIS composants du
bureau, avec leurs vraies classes.** `.bureau-nav`, `.bureau-plan`, `.zone--panneau`, `.postit`,
`.zone--ardoise`, `.chiffre`, `.fiche-l`, `.lettre`. Leur CSS vit dans `src/css/style.css`, que
toutes les pages chargent : reproduire un ecran a la main coute une maquette a maintenir, et cette
maquette derive du vrai produit des la premiere semaine. C'est exactement ce qui s'etait passe.

**Ne jamais redessiner un ecran qui existe.** Pour le VOIR sans compte, `npm run apercu:ardoise`
et `npm run apercu:panneau` montent la vraie page dans jsdom avec un faux CRM et ecrivent un
fichier autonome. C'est la source, et c'est de la que vient le balisage recopie dans
`demo-pinboard.njk`.

### La continuite du liege est le coeur de la demonstration

Le panneau du bureau EST un tableau de liege avec des punaises, et `tokens.css` le dit noir sur
blanc : « Le papier a note. Deux teintes, celles du panneau de la page d'accueil. » Le liege ne
disparait donc jamais entre les trois etapes, il devient l'outil. **Les cinq post-it de l'etape 03
reprennent nommement cinq des huit papiers de l'etape 01** : M. Dubreuil et sa facture, la TVA du
15, les Caves Bertrand, le QR nutritionnel, la cuve 4. Changer un papier a l'etape 01 sans changer
son post-it casse la demonstration sans casser la page.

### L'ordre des zones dit qui a le droit a quoi

Le panneau d'abord, l'ardoise ensuite, la rangee de lecture en bas. C'est l'ordre du vrai bureau,
dicte par Ted le 07/09/2026, et il tombe juste ici pour une deuxieme raison : le panneau, le
classeur, le courrier et les articles mis de cote sont ouverts a toute la filiere ; l'ardoise
demande un export Vitisoft. La partie gratuite passe devant, et **l'ardoise porte sa mention dans
son propre `zone__note`** : « tes ventes, si tu es sur Vitisoft ». Meme regle que le hero, celle du
10/09 : personne ne decouvre la restriction apres son inscription.

### Sur telephone, l'etape 03 ne montre que le panneau

Mesure du 12/09/2026 : 1 194 px de contenu pour un cadre de 420. Reduire assez pour tout faire
tenir donnerait des lettres de six pixels, c'est-a-dire une capture illisible presentee comme une
demonstration. La barre, l'ardoise et la rangee de lecture sortent du champ ; les cinq post-it
defilent horizontalement au lieu de s'empiler, parce que cinq post-it empiles font 750 px et que le
visiteur en verrait deux.

### Ce qui a ete supprime avec, et qu'il ne faut pas ressusciter

Environ 450 lignes de CSS (`.viti-*`, `.vitisoft-todo-*`, `.vitimedia-*`) ont ete SUPPRIMEES de
`src/css/style.css`, pas commentees : une maquette d'un produit tiers laissee dans la feuille finit
par revenir. Elle est dans git. Le bloc « Partenaires ecosysteme » part avec : ses trois
emplacements decides le 06/09/2026 sont le bas d'article, une carte dans Mon bureau et un encart
dans l'edition, jamais la page d'accueil. Les jetons `--vitimedia-rouge` et `--vitimedia-fonce`
restent declares, ils serviront la.

La carte « VINCA · IA » de l'etape 01 est devenue « Question en suspens », et elle ne porte plus la
reponse. Deux defauts pour un : VINCA est un produit de Vitisoft, et une question deja repondue
n'a rien a faire dans l'etape qui s'appelle « chaos administratif ».

## LE TIROIR : LE DETAIL A DROITE DE LA LISTE, 23/09/2026

Demande de Ted : « j'imagine bien avoir a droite un ecran qui represente la tache qu'on
selectionne, pareil pour Mon commerce quand je selectionne un client, au lieu d'avoir une
modale ». Lot 1 sur 2 : la FICHE CLIENT. « Mes taches » vient au lot suivant et heritera du
meme composant, c'est la condition posee en ouvrant le chantier.

**LA MODALE RESTE LE DEFAUT, ET C'EST TOUT LE DESSIN.** Rien de ce lot ne touche au
comportement d'aujourd'hui : `.modale{position:fixed;inset:0}` de `bdv-ecrans.css` continue
de decider partout, et le tiroir n'existe qu'au-dessus d'un seuil, sous une classe que le
JavaScript pose. **En dessous, pas une declaration du lot ne s'applique**, donc aucune
regression n'est possible sur telephone ni sur un portable etroit, qui sont les deux endroits
ou ce depot a paye le plus cher. Verifie a la capture : a 1319 px l'ecran est celui d'avant,
au pixel.

### IL N'Y A TOUJOURS QU'UNE FICHE CLIENT

C'est la condition qui a ete posee AVANT d'ecrire une ligne, et elle vient de la regle du
11/09/2026 : « ne pas en recreer une deuxieme, meme petite, meme juste pour le bureau ».
Aucune ligne du lot ne fabrique de HTML. `ficheHTML()` reste le seul auteur de la fiche,
`#modale` reste le seul endroit ou elle se pose. **Ce qui change est le CONTENANT, et il
change en CSS.** Le JavaScript ne fait que dire dans quel mode on est et reparer le contrat
que ce mode casse.

### LE SEUIL EST MESURE, ET IL EST ECRIT DEUX FOIS

Releve au navigateur sur la page construite, rail a 184 px, retraits du travail a 24 px de
chaque cote :

| fenetre | contenu utile | tiroir a 32vw | reste a la liste |
|---|---|---|---|
| 2560 | 2328 | 820 (plafond) | 1508 |
| 2296 | 2064 | 735 | 1329  (**la vraie fenetre de Ted**) |
| 1920 | 1688 | 614 | 1074 |
| 1440 | 1208 | 461 | 747 |
| 1320 | 1088 | 422 | 666 |
| 1280 | 1048 | pas de tiroir | (sous le seuil) |

Les requetes de conteneur du sous-main replient la liste en fiches sous **40 rem, 640 px**.
Le tiroir ne doit donc PAS exister sous 1292 px de fenetre : ouvrir un client replierait la
liste sous l'oeil de celui qui l'ouvre, et **un geste de LECTURE ne change pas la mise en
page de ce qu'on lit**. Le seuil est a 1320, ce qui laisse 26 px de marge sur ce plancher.

**LA LARGEUR EST PROPORTIONNELLE, ET ELLE NE L'ETAIT PAS AU PREMIER JET.** Elle valait
420 px fixes, mesures sur un ecran de 1440 ou ils font 35 % de la largeur. La capture de Ted
a montre sa VRAIE fenetre, relevee a **2296 px** : le tiroir n'y faisait plus que **18 %**,
les quatre chiffres de la fiche se serraient en deux colonnes etroites, le conseil tombait
en lignes de quatre mots. Son mot : « c'est pas utilisable, tu peux vraiment prendre 1/3 ».
**Un nombre fixe ne peut pas repondre a deux ecrans qui vont du simple au double.**

**Il est ecrit dans la media query de la section 22 de `bdv-bureau.css` ET dans
`TIROIR_SEUIL` de `bdv-ecrans.js`**, parce qu'une media query ne se lit pas depuis le
JavaScript. Ce que chaque sens de divergence produit, et les deux sont silencieux :

- le JS en avance sur le CSS : la classe est posee, le retrait ne l'est pas, et la fiche se
  peint en modale **sans son voile et sans son piege a focus**, c'est-a-dire une boite qui
  couvre la liste et qu'on quitte au clavier sans le voir ;
- le CSS en avance sur le JS : la fiche se range a droite en gardant `aria-modal`, le
  defilement du corps reste bloque, et la liste est visible, **annoncee comme absente, et
  figee**.

`npm run banc:tiroir` interdit aux deux de diverger, et il est dans `npm run verif`. Meme
reponse qu'a l'empreinte du courrier le 10/09/2026 : un banc plutot qu'une convention.
Verifie en remettant le defaut, trois fois : seuil divergent, tiroir trop large, piege a
focus laisse en place. Un controle qui n'a jamais echoue ne garde rien.

### UN TIROIR N'EST PAS UNE MODALE, ET LE DIRE NE SUFFIT PAS

Trois choses qu'une modale impose doivent etre DEFAITES, sinon la liste est visible et morte.
Aucune des trois ne se voit sur une capture, et c'est ce qui les rend cheres.

1. **`aria-modal` ment.** Il annonce qu'il n'y a rien d'autre a l'ecran ; une synthese vocale
   cesse alors de lire la liste, qui est pourtant le sujet. L'attribut est RETIRE et non pose
   a `false` : c'est la valeur par defaut, l'ecrire n'apporte rien et se relit comme un oubli.
   `role` passe de `dialog` a `complementary`.
2. **Le piege a focus s'en va avec elle.** Il a ete pose le 19/09/2026 parce que la boite
   DISAIT qu'il n'y avait rien d'autre a l'ecran et que Tab prouvait le contraire. En tiroir
   elle ne le dit plus : enfermer le clavier dans la fiche interdirait d'atteindre le client
   suivant autrement qu'a la souris. **Le meme raisonnement, pris dans l'autre sens.**
3. **Le defilement du corps de page est rendu.** `document.body.style.overflow='hidden'` est
   tout l'inverse de ce qu'on vient d'ouvrir le tiroir pour obtenir.

Et **le focus n'est vole qu'en modale**. Une modale s'ouvre PAR-DESSUS : le focus doit y
entrer. Un tiroir s'ouvre A COTE : le vigneron lit son client et continue de descendre sa
liste, et lui arracher le focus l'obligerait a revenir en arriere apres chaque clic.

`Echap` ferme dans les deux modes sans une ligne de plus : l'ecouteur de `bdv-base.js` teste
la classe `on` de `#modale`, qui ne change pas.

### ON NE DEPLACE PAS `#modale` DANS LE DOM, ET C'EST UN ARBITRAGE

La faire entrer dans `.bureau-atelier` pour en faire une vraie troisieme colonne serait plus
elegant : elle vivrait dans le flux et se collerait comme le rail. Mais le controle « la
modale de la fiche client est hors de #bureauVentes » de `scripts/banc-bureau.mjs` la cherche
par sa POSITION dans le texte du HTML construit, entre deux marqueurs. **Un deplacement le
laisserait passer au vert en ayant cesse de tester ce qu'il croit tester**, et ce depot dit
qu'un controle dans cet etat est pire que pas de controle. Le tiroir pousse donc par un
retrait pose sur ce qui est a sa gauche : meme pixel a l'ecran, pas une balise touchee.

**LE RETRAIT EST POSE SUR L'ATELIER ET SUR LA LIGNE DE L'EN-TETE.** Sur l'atelier seul,
« Mes reglages » et « Me deconnecter », qui sont cales a droite de l'en-tete, passeraient
SOUS le tiroir : les deux seules sorties de la session, recouvertes par un panneau de lecture.
Mesure a 1320, 1366, 1440, 1680 et 1920 : le bouton s'arrete exactement au bord du tiroir.

### UN TABLEAU SE COMPRIME AVANT DE DEBORDER, ET LE TIROIR REFAIT LE COUP DU TELEPHONE

Lecon du 11/09/2026 : `.content` porte `overflow-x:hidden`, donc on croit que les colonnes
qui depassent sont rasees. La mesure dit autre chose, et c'est pire : **le tableau se
COMPRIME pour tenir**. Pas de defilement, pas de coupure, juste des colonnes illisibles.

Ouvrir le tiroir retire 420 px a la liste, c'est-a-dire qu'il refait exactement ce que faisait
le passage sur telephone, **a une largeur ou personne ne l'avait mesure**. Les deux regles de
defilement existent deja dans `bdv-ecrans.css`, avec le voile et l'ombre qui ANNONCENT le
defilement ; elles etaient seulement bornees a `max-width:700px`. Elles sont portees au cas
du tiroir, section 22.6.

**ET PAS A TOUTES LES LARGEURS, CE QUI AURAIT PARU PLUS PROPRE.** `overflow-x:auto` fait
passer `overflow-y` de `visible` a `auto` par la regle du CSS, ce qui casse le
`position:sticky` d'un en-tete de tableau. Le depot en porte un, `table.data--sticky`, dont le
point ouvert du 08/09/2026 n'est toujours pas traite. On ne touche donc qu'au seul etat ou la
place manque, et le bureau ne bouge pas d'un pixel quand le tiroir est ferme.

### CE QUE LES HARNAIS ONT APPRIS, ET LES DEUX FAISAIENT MENTIR LA MESURE

**DIXIEME FOIS QUE CE FICHIER RACONTE LA MEME FAMILLE DE DEFAUT**, et cette fois c'est le
harnais de mesure qui l'a portee, pas le produit.

1. **`bdv-ecrans.css` n'est pas liee dans le HTML.** C'est `bdv-nav.js` qui la pose, au
   premier clic sur une piece de vente. Un harnais qui retire les scripts ne la charge donc
   jamais, et `.modale{position:fixed}` avec elle : le tiroir sortait en `position:static`,
   colle a gauche, et le releve annoncait un bord gauche a 0. C'est la regle du 22/09/2026,
   « un apercu charge ce que charge la page qu'il montre », dans le seul cas ou la feuille
   n'est pas dans le HTML pour le dire.
2. **Le retrait est en TRANSITION**, 300 ms. Deux trames d'attente lisaient un padding a
   mi-course : le releve donnait -64 px de liste a 1440 la ou le calcul en annonce -420, et
   **ce chiffre-la n'existe a aucun moment ou quelqu'un regarde l'ecran**. On attend la fin
   de la transition, on ne la devine pas.
3. Et un test peut echouer sur du sain : `getBoundingClientRect().right` inclut le RETRAIT,
   donc la ligne de l'en-tete garde son bord droit au meme endroit pendant que son contenu se
   decale. Le premier jet declarait « Me deconnecter » recouvert aux cinq largeurs. **On
   mesure le bouton, pas la boite.**

Les quatre outils sont dans `Claude outputs/` : `lot-tiroir-largeurs.mjs` (les largeurs de
l'atelier), `lot-tiroir-poussee.mjs` (ce que le tiroir prend, a huit largeurs, avec le seuil
teste a 1319 et 1320), `lot-tiroir-contraste.mjs` et `lot-tiroir-capture.mjs`.

### LE CHANGEMENT DE FOND A ETE MESURE, PAS SUPPOSE

La boite passe de `--bdv-surface-3` a `--bdv-surface` : **tous les textes de la fiche changent
donc de paire de contraste**, et aucune feuille ne peut le dire, les encres venant d'ailleurs.
Sonde de rendu sur la vraie fiche, celle que `npm run apercu:fiche` produit, dans les deux
themes et dans les deux modes : **zero paire sous son seuil**, tiroir comme modale.

### CE QUI RESTE OUVERT

- ~~**« Mes taches » n'est pas fait.**~~ **FAIT LE MEME JOUR, AU LOT 2**, section suivante.
- **Le tiroir recouvre le pied de page du site** quand la piece est courte. Il est `fixed` et
  va jusqu'en bas, c'est le dessin attendu d'un panneau lateral ; a rouvrir avec Ted si ca le
  gene a l'usage.
- **Rien n'annonce encore qu'un tableau defile** en mode tiroir sur ordinateur : le voile et
  l'ombre de `bdv-ecrans.css` sont dans le bloc telephone. Point ouvert du 11/09/2026, elargi
  par ce lot.
- **La fiche ne se recharge pas d'un client a l'autre au clavier.** Le tiroir rend possible
  d'enchainer les clients, mais rien n'a encore ete ajoute pour passer au suivant sans la
  souris. C'est le geste que Ted a decrit en ouvrant le chantier.


### LOT 2, LE MEME JOUR : LA MODALE D'UNE TACHE

« ok same pour les taches », demande de Ted apres avoir vu le lot 1.

**LE PIEGE D'ENTREE : LES DEUX BOITES NE PARTAGENT RIEN.** La fiche client vit dans
`#modale`, un div du gabarit rempli par `bdv-ecrans.js`. La modale d'une tache est fabriquee
de toutes pieces par `bdv-taches.js`, dans son propre element ajoute au `<body>`. Ni le meme
div, ni la meme feuille, ni le meme fichier.

Le point ouvert du lot 1 disait « elle devra passer par le MEME CONTENANT ». **C'etait la
mauvaise formulation, et l'appliquer aurait ete une faute.** Faire entrer la tache dans
`#modale` lui donnerait en prime la classe `.bdv-ventes`, qui scope tout le dessin des ecrans
de vente : on aurait echange un probleme de coherence contre un habillage qui change sous
elle. Et `bdv-taches.js` doit rester le SEUL fichier qui ecrive dans la table des taches,
regle du 08/09/2026.

**CE QUI EST PARTAGE EST LA DECISION, PAS LE DIV.** Ted a demande le meme COMPORTEMENT, pas
le meme element.

### `BdvTiroir`, EN BAS DE `bdv-nav.js`, ET C'EST LE SEUL ENDROIT QUI DECIDE

Le danger n'est pas d'avoir deux boites, c'est d'avoir **deux endroits qui decident** : deux
seuils qui divergent au premier reglage, deux contrats ARIA dont un seul est defait, deux
classes posees sur le corps de page qui se retirent l'une l'autre. **Aucun des trois ne se
voit a l'ecran**, et ce fichier documente cette famille de panne a une douzaine d'endroits.

`bdv-nav.js` est le module de la coque et porte deja le SEUL point d'entree des reglages,
pour exactement la meme raison. **Il est charge SANS `defer` alors que `bdv-taches.js` l'est
AVEC, donc il s'execute avant lui** ; `bdv-ecrans.js` arrive plus tard encore, au premier clic
sur une piece de vente. Les deux appelants le trouvent, toujours.

Il expose trois choses et rien d'autre : `actif()`, `poser(boite)`, `retirer()`. **On lui
passe la BOITE et pas la modale** : c'est elle qui porte `aria-modal` et `role`.

Quatre controles de `npm run banc:tiroir` gardent cette unicite, et ils sont le coeur du lot :
un seul `matchMedia` de seuil dans tout le depot, un seul `TIROIR_SEUIL`, les deux boites qui
passent par `poser` et `retirer`, et `bdv-a-tiroir` posee **nulle part ailleurs** que dans le
module. Verifies en remettant le defaut : une tache qui se refabrique un seuil, une tache qui
pose la classe elle-meme, le CSS qui oublie la tache, les champs de date laisses cote a cote.

### CE QUE LA TACHE DEFAIT EN MOINS, ET CE QU'ELLE GARDE EN PLUS

Elle n'a **pas** de piege a focus : seule la fiche client en pose un, depuis le 19/09/2026.
Le module ne s'en occupe donc pas, et c'est la fiche qui sait le retirer.

**Le focus, lui, a une exception, et elle est du CONTENU.** La regle du tiroir est de ne pas
le voler : le vigneron garde sa liste sous les yeux et continue de la descendre. Mais une
tache **NEUVE** est un formulaire vide qu'on vient d'ouvrir pour ecrire dedans : ne pas y
poser le curseur ferait taper le titre dans le vide. Une tache qu'on relit, une obligation
qu'on coche : non. `s.mode === 'neuve'` est le seul cas.

### DEUX REGLES RECOPIEES DU TELEPHONE, DEUX FOIS LA MEME FAUTE

**C'est le defaut de ce lot, il etait de moi, et c'est la mesure qui l'a trouve les deux
fois.** J'ai repris du bloc telephone de `bdv-poste.css` deux regles qui y sont justes, sans
les redemontrer a la largeur du tiroir.

**1. `grid-template-columns:1fr` sur `.tmod__duo`**, pour empiler les deux champs de date. Le
raisonnement etait « un `<input type="date">` natif ne se comprime pas, il deborde ». Mesure
du 23/09/2026, boite par boite de 360 a 620 px en forcant les deux colonnes : **le duo ne
deborde jamais et le contenu n'est jamais tronque**. A 360 px de boite, la plus etroite
testee, un champ fait encore 147 px et affiche « 09/20/2026 » en entier. La regle ne servait
a rien, et elle coutait : chez Ted, dans un tiroir de 735 px, elle empilait deux champs qui
avaient 687 px pour se tenir cote a cote.

**2. `margin-left:0` sur « Retirer cette tache »**, et celle-la etait pire.

Mesure a 1440 dans le tiroir : `margin-left:auto` tient parfaitement dans 372 px. Les deux
boutons restent sur la meme ligne, le lien se cale a 24 px du bord droit, et **il reste 156 px
entre les deux**. La rapprocher les collait l'un a l'autre : **le geste qui DETRUIT a douze
pixels du geste qui valide**, dans un panneau ou l'on clique vite.

**LA LECON EST PLUS DURE QUE « REMESURER », PARCE QUE LA FAUTE S'EST PRODUITE DEUX FOIS DANS
LE MEME LOT : une regle ecrite pour un autre point de rupture ne se REPREND pas, elle se
REDEMONTRE.** Tant qu'on n'a pas la mesure qui la justifie ICI, elle n'existe pas. Les deux
fois, la regle importait une contrainte qui n'existait pas, et defaisait un dessin qui avait
raison : l'une a colle le geste qui detruit au geste qui valide, l'autre a empile deux champs
dans un panneau deux fois trop large pour ca.

**A SIGNALER, ET HORS PERIMETRE :** si le duo tient a 360 px, la regle du bloc telephone
merite d'etre remesuree elle aussi. Elle date du 12/09/2026, et les saisies y sont a 16 px
alors qu'elles sont plus petites ici : c'est peut-etre ce qui la justifie encore. Non verifie.

### CE QUI A ETE MESURE, ET CE QUI NE CHANGE PAS

Sonde de rendu sur le VRAI balisage, celui de `npm run apercu:modale`, deux etats (une tache en
retard avec son formulaire et ses reports, une DRM qui n'a droit ni a l'un ni a l'autre), deux
themes, deux largeurs : **rien ne sort du tiroir, zero paire sous son seuil**. Les trois
natures et leurs trois jeux de droits du 12/09/2026 sont intacts.

**Les cibles sous 44 px de cette modale sont IDENTIQUES en tiroir et en modale** : 8 dans
l'etat « tache en retard », 3 dans l'etat « obligation ». Ce n'est donc pas une regression du
lot, c'est l'etat d'avant sur ordinateur, le plancher tactile n'etant impose que sous 700 px.
**Signale, non corrige** : l'elargir demanderait de rouvrir le dessin de la modale sur toutes
les largeurs, ce qui n'est pas ce lot.

### CE QUI RESTE OUVERT APRES LE LOT 2

- **La croix de la modale d'une tache n'est pas collante**, contrairement a celle de la fiche.
  Mesure : le contenu du pire etat fait environ 680 px dans un tiroir de 766, donc elle ne
  defile pas aujourd'hui. Sur un ecran court elle partirait avec le haut. Non corrige parce
  que le cas n'existe pas encore ; `Echap` ferme de toute facon.
- **Passer d'un client ou d'une tache au suivant au clavier n'existe pas.** Le tiroir le rend
  possible, rien ne l'implemente. C'est le geste que Ted a decrit en ouvrant le chantier, et
  c'est le seul morceau de sa demande qui reste entier.
- Les points ouverts du lot 1 n'ont pas bouge : le tiroir recouvre le pied de page du site sur
  une piece courte, et rien n'annonce qu'un tableau defile en mode tiroir sur ordinateur.


### ET LE GARDE-FOU A DU APPRENDRE A LIRE LA NOUVELLE FORME, APRES ELLE

`npm run banc:jetons` a **refuse le lot**, et il avait raison de refuser. Son detecteur
d'echelle ne connaissait que la forme « un nombre suivi d'une unite » : il a range
`clamp(400px,32vw,820px)` en MATIERE, donc exige qu'il se retourne dans les deux blocs
sombres, c'est-a-dire qu'il a **crie sur du sain**. Et un controle qui crie sur du sain finit
par ne plus etre lu, ce que ce fichier dit deja a propos de `charte.mjs` et des trois blocs de
theme.

**C'EST LA REGLE DU DEPOT PRISE A L'ENVERS**, celle qui est ecrite noir sur blanc a propos de
`tokens.css` : « on apprend d'abord au garde-fou a lire la nouvelle forme, on change la forme
ensuite. Jamais l'inverse. » Ici la forme a change d'abord.

`EST_ECHELLE` sait maintenant qu'une fonction de calcul dont TOUS les termes sont des mesures
est une echelle. **La regle reste dans la VALEUR et pas dans une liste de noms**, qui se
perimerait au premier jeton ajoute. Le garde sur les couleurs n'est pas du zele : `color-mix()`
et `clamp()` acceptent les memes parentheses, et une matiere calculee doit continuer de se
retourner dans les deux blocs sombres.

Verifie par trois mutations : une matiere retiree d'un bloc sombre crie toujours, une matiere
CALCULEE non retournee crie, et une echelle calculee qu'on retournerait crie aussi.

## UN GESTE QUI DETRUIT SE VOIT, ET IL NE S'ARRETE QUE SUR UNE PREUVE, 23/09/2026

Ted, deux captures du bouton a l'appui : « j'ai l'impression que c'est pas propre. Il faut
forcement que l'interface montre une animation tant que ca travaille et que ca vide toute la
base, meme dans les reglages et tout. Il devra y avoir une verification pour que l'animation
s'arrete. »

**CE QUI SE PASSAIT.** Entre la confirmation et le message final il y avait l'appel serveur
(1,4 s mesure sur 171 569 lignes, plus le reseau), le vidage d'IndexedDB, puis une repeinture
complete du bureau et du panneau. **Rien a l'ecran pendant tout ce temps.** Le bouton restait
cliquable, et la ZONE DE DEPOT D'EXPORT de la carte d'a cote aussi.

### CE QUE L'AUDIT A TROUVE, ET LE PIRE N'ETAIT PAS L'ABSENCE D'ANIMATION

1. **`await dbClear()` n'avait aucun filet.** Son rejet sortait de `viderBase()` en silence :
   compte vide, appareil plein, pas un message, et `oublierRepere()` deja appele a l'interieur
   d'`effacerTout()`. C'est l'asymetrie du 18/09/2026 prise dans l'autre sens, et elle etait
   MUETTE. Si le vigneron reimporte la-dessus, les deux bases se remelangent.
2. **La preuve chiffree du lot 28 etait jetee.** Le serveur rend le compte de ce qu'il a
   efface, table par table ; `viderBase()` ne lisait que `vide`. Un vidage annonce sur zero
   ligne est le symptome exact d'un melange de bases, et sans chiffre il ne se voit pas.
3. **Rien ne relisait l'appareil.** `dbClear()` se resout sur `tx.oncomplete` : ca prouve
   qu'une transaction a abouti, pas que le magasin est vide.
4. **Le lot 28 ne recomptait qu'une table sur cinq.** Il vidait `ventes`, `ventes_lignes`,
   `suivi_clients`, `echanges` et `resumes`, et relisait `ventes` seule. Il ne pouvait donc pas
   lever sur un suivi client reste entier, c'est-a-dire sur **la seule chose que le vigneron ne
   peut pas reimporter**. Ferme par le lot 30, qui recompte les cinq et NOMME celle qui resiste.
5. **Aucun garde de re-entree.** Un second clic relancait tout : le second vidage rend
   `vide: true` avec quatre zeros et recouvre le bilan du premier.

**UNE BONNE NOUVELLE MESUREE, a ne pas re-verifier.** On croit volontiers que `#status` et
`#busyov` sont invisibles depuis le panneau : ils sont ecrits dans `ecrans-vente.njk`, donc
dans `#bureauVentes`, masque tant qu'aucune piece de vente n'a ete ouverte. C'est faux :
`sortirHorsPage()` dans `bdv-nav.js` les deplace sous `<body>` A L'OUVERTURE de la page,
exactement pour ca. Le deduire de l'arborescence fait perdre une heure.

### LES CINQ REGLES DU GESTE

1. **LE VOILE EST POSE APRES LE `confirm()`, ET RETIRE DANS UN SEUL `finally`.** Avant, il ne
   serait jamais peint : un dialogue natif bloque le rendu, et il resterait sous la boite. Six
   chemins quittent `viderBase()`, dont deux qu'on n'ecrit pas (un jet de `capPerimer()`, de
   `computeMeta()` ou d'`ecranRafraichir()`). Le `finally` repose une fin si aucun chemin ne
   l'a fait : **un voile qui tourne sur un bureau a moitie vide est pire que pas de voile**, il
   donne a un effacement interrompu l'apparence d'un travail en cours.
2. **LA VERIFICATION A TROIS ETATS, JAMAIS DEUX.** `dbCount()` doit rendre 0 ET
   `auMoinsUneVente()` doit rendre `false`. Zero arrete en succes, un reste arrete en ECHEC
   NOMME, un `null` arrete en « non verifie ». **Un « je ne sais pas » pris pour un zero, c'est
   le defaut du 18/09/2026 rejoue.** Meme regle en trois etats que le garde d'ouverture.
3. **LE PANNEAU ENTIER EST NEUTRALISE, PAS LE BOUTON.** `inert` sur `#bdvrVoile`. Ce qui est
   dangereux n'est pas un second clic sur « Vider la base », c'est la zone de depot d'export
   qui vit dans la MEME rangee. Et `aria-modal` du panneau est RENDU le temps du travail :
   tant qu'il vaut « true », tout ce qui vit hors du panneau est **muet a la synthese vocale**,
   et le voile serait vu sans etre entendu.
4. **LE GARDE DE RE-ENTREE EST UN DRAPEAU DE MODULE, PAS UN BOUTON GRISE.** `renderBase()`
   reecrit ce bouton et la sortie appelle `ecranRafraichir()` : un `disabled` pose sur le noeud
   se rallumerait tout seul en plein `await`. Le drapeau est la verite, **et c'est
   `renderBase()` qui repose l'etat du bouton en LISANT le drapeau a chaque rendu.**
5. **LE BILAN EST CHIFFRE ET IL NE S'EFFACE PAS.** `status()` masque un succes au bout de
   quatre secondes : le seul compte rendu d'un effacement definitif partirait avant d'avoir ete
   lu. Le voile porte sa phrase jusqu'a ce que le vigneron ferme.

### LE VOILE REUTILISE LES CLASSES DE L'AMORCAGE, ET CE N'EST PAS DE LA PARESSE

`.bdv-amorce*` est deja scope, deja mesure dans les deux themes, et chacun de ses etats se dit
par un GLYPHE et par un mot cache en plus de sa couleur. Ecrire un second voile aurait ajoute
une valeur a trois echelles fermees de `npm run charte --bureau` (les tailles, les filets, les
couches) et une paire de contraste de plus a mesurer, **pour redire moins bien ce que celui-ci
sait deja dire.** Les deux ne peuvent pas etre a l'ecran en meme temps : l'amorcage se ferme
avant que le bureau soit utilisable, le vidage demande un panneau ouvert.

**CE QUE LA MARQUE `.bdv-amorce--vidage` AJOUTE, ET RIEN D'AUTRE : du MOUVEMENT.** Le voile
d'amorcage dure deux secondes, un vidage de 171 569 lignes tient l'ecran six secondes ou plus,
et **un chapelet d'etapes immobiles pendant six secondes ne se distingue pas d'un plantage**.
Le rail s'arrete sur `aria-busy`, c'est-a-dire sur la verification, et **jamais sur un
minuteur** : une animation qu'on arrete au bout de n secondes ment le jour ou le travail en
prend n+1. `prefers-reduced-motion` la remplace par un trait plein, et le mouvement ne porte
jamais seul une information : les trois etapes la portent en mots.

### CE QUE LE BANC GARDE, ET CE QU'IL NE PEUT PAS GARDER

`npm run banc:vidage` a gagne une section 6 ecrite EN NEGATIF, plus une section 6 bis qui
EXECUTE `vidageVerifier()` sur les sept situations possibles. Verifiees en remettant le
defaut, quatorze mutations, chacune fait echouer le banc. Deux d'entre elles sont des lecons :

- **la mutation « `reste` devient `r_ventes + r_lignes` » passait au vert** tant que la regex
  du banc n'exigeait pas la virgule de fin. Un controle non mute est un controle non ecrit.
- **la section 3 a du apprendre la nouvelle forme AVANT que la forme ne change** : `preuve`
  n'est plus declaree avec `const`, et le refus ne part plus par `status()` mais par
  `vidageFin()`. Le texte, lui, n'a pas bouge d'un mot. C'est la regle du depot, « on apprend
  d'abord au garde-fou a lire la nouvelle forme ».

**IL NE PROUVE PAS QU'UN VOILE SE VOIT.** jsdom ne fait aucune mise en page et ne rejoue
aucune cascade. `npm run apercu:vidage` ecrit `_apercu/vidage.html`, cinq etats fois deux
themes, depuis les VRAIES fonctions de `bdv-base.js`. Audit de rendu a 1000 px, les deux
themes : **zero paire sous son seuil, zero cible sous 44 px.** Et c'est la planche qui a
montre ce qu'aucun banc ne disait : **le voile ne bougeait pas.**

### CE QUI RESTE OUVERT

- **Le voile d'amorcage ne prend pas la marque `--vidage`.** Il ne bouge pas non plus, et il
  dure deux secondes. A rouvrir avec Ted, pas a trancher seul : on ne repeint pas un ecran
  qu'on n'a pas regarde.
- **`lot29-index-et-fonctions-de-declencheur.sql` n'est pas dans la liste `ORDRE` de
  `scripts/banc-rejeu.mjs`.** Signale, non corrige : d'apres la regle de ce banc, il est donc
  absent de la procedure de reconstruction. A verifier avant de refaire une base de zero.
- **`npm run build` ne peut pas aboutir depuis la session**, la panne du pont est revenue :
  EPERM sur l'unlink de `_site/manifest.webmanifest`. Les pages et le HTML sont ecrits, les
  copies de `src/css` et `src/js` ne le sont pas. Contournement utilise ici : `cp` en place,
  qui tronque au lieu de supprimer. Les 37 etapes de `npm run verif` ont ete lancees UNE PAR
  UNE, sans tuyau, et sont toutes vertes.

## UN RESUME VIDE N'EST PAS UN RESUME, 23/09/2026

Ted, apres avoir rentre une base de 5 210 lignes : « j'ai des choses chelou, pas de chiffres,
des doubles negatifs. Je peux pas faire confiance au reste a partir de la. » Il avait raison,
et il y avait UNE cause pour l'essentiel, plus trois defauts d'affichage independants.

### LA CAUSE : `est_vente` EST NUL, ET LE BUREAU LE PREND POUR UN ZERO

`v_ventes.est_vente` vaut `null` tant que `reglages.classement` ne porte pas `valide: true`.
C'est la decision du lot 23, elle est bonne, et elle est ecrite plus haut : « le mode devine
n'est pas porte ». **Ce qui ne l'etait pas, c'est ce que les trois fonctions de resume rendent
DANS CET ETAT.** Mesure du 23/09/2026 sur le bureau de Ted, 5 210 lignes, ZERO vente cote
serveur :

    cap_resume      -> { exerciceNum: 2026, ca: null, dernierMois: null, ... }  objet a trous
    commerce_resume -> { bridge: {0,0,0,0,0}, decroche: null, ... }             objet a trous
    cuvees_resume   -> { ok: false, ... }                                       DIT NON

**`Number(null)` vaut 0, et un zero ne se distingue pas d'un vrai chiffre a l'ecran.** C'est la
lecon deja ecrite pour le repere de synchronisation et pour `baseVide()`, payee une troisieme
fois : UNE ABSENCE N'EST PAS UN ZERO.

### CE QUI L'A RENDUE VISIBLE : CINQ GARDES POUR UN SEUL OBJET

Chaque bloc posait SA condition avant d'utiliser le resume, et trois seulement tenaient :

    capCadre()        exigeait `caCoupePrecedent`   -> null    -> local   -> JUSTE
    capAtterrissage() se contentait d'`exerciceNum` -> present -> serveur -> 0 EUR
    computeBridge()   se contentait de `bridge`     -> present -> serveur -> 0 EUR
    agentCadence()    exigeait un TABLEAU           -> absent  -> local   -> JUSTE
    agentDecrochage() exigeait un TABLEAU           -> absent  -> local   -> JUSTE
    cuvPoser()        exigeait `ok`                 -> false   -> local   -> JUSTE

D'ou un ecran moitie serveur moitie navigateur : « Mon cap » annoncait **-26,1 % et 72 267 EUR**
dans son bandeau, **0 EUR, null mois connus et objectif menace -164 000 EUR** dans les trois
cartes juste dessous, et **objectif jouable, atterrissage 223 302 EUR** dans le conseil encore en
dessous. Trois reponses a une seule question, sur un seul ecran, sans une erreur nulle part.
Verite mesuree ce jour-la : realise 72 267 EUR sur 2 mois, exercice precedent 302 295 EUR,
97 831 EUR a date egale, atterrissage par saisonnalite 223 302 EUR, objectif 164 000 EUR, donc
**+59 302 EUR**. L'ecran disait l'inverse.

### LA REGLE : LE RESUME SE REFUSE A LA POSE, JAMAIS BLOC PAR BLOC A LA LECTURE

**Un seul endroit decide, donc tous les blocs retombent en local ENSEMBLE, et un bloc ecrit
demain herite du garde sans avoir a y penser.** Le critere est le chiffre qui JUSTIFIE le
resume : `ca` pour `capPoser`, `exerciceCur` pour `comPoser`, `ok` pour `cuvPoser`, qui l'avait
deja. Un resume qui ne le porte pas n'a rien calcule.

Le corollaire vaut au-dela de ce fichier : **quand un objet vient d'ailleurs, la question
« puis-je m'en servir ? » se pose une fois, a l'entree, et jamais a chaque usage.**

### ET LES CINQ GARDES DE LECTURE SONT RESTES, PARCE QU'ILS NE POSENT PAS LA MEME QUESTION

**A relire avant de « finir le menage » : les supprimer serait une regression.** Cette section a
d'abord ete ecrite « ne pas remettre un garde dans un bloc de lecture, ce serait le sixieme ».
Relu le 23/09/2026 au tour d'audit suivant : c'etait trop absolu, et applique a la lettre ca
cassait deux cas legitimes.

    capPoser()        « CET OBJET a-t-il calcule quelque chose ? »   garde d'OBJET
    capCadre()        « l'exercice PRECEDENT existe-t-il ? »         garde de CHAMP
    agentCadence()    « le serveur a-t-il porte CE bloc-la ? »       garde de CHAMP

Un garde d'objet repond a « puis-je me servir de ce resume », et il n'y en a qu'un, a l'entree.
Un garde de champ repond a « ce champ-la est-il renseigne », et il y en a autant que de champs
facultatifs. **Le defaut du 23/09 n'etait pas d'avoir plusieurs gardes, c'etait d'avoir plusieurs
gardes d'OBJET, tous differents.**

Concretement : `caCoupePrecedent` est null pour un domaine dont la base ne couvre qu'un seul
exercice, et `ca` ne l'est pas. Retirer le garde de `capCadre()` ferait afficher « contre 0 euro
le precedent au meme jour » a tout nouveau vigneron, par `Number(null)`. Le meme raisonnement
vaut pour les trois `Array.isArray` de « Mon commerce » : le serveur porte trois blocs dont un
seul est aujourd'hui rendu, et un tableau absent n'est pas un tableau vide.

**La question a se poser devant un garde : repond-il pour TOUT l'objet, ou pour un champ ?** Si
c'est pour tout l'objet, il doit etre unique et vivre a la pose.

`npm run banc:cap-serveur` section 3 et `npm run banc:commerce-serveur` section 5 posent la
charge REELLE relevee ce jour-la, champ pour champ, et exigent que l'ecran peint soit exactement
l'ecran local, sans le mot « null » nulle part. Verifies en remettant le defaut : trois echecs
d'un cote, un de l'autre.

### ET LE SERVEUR REFUSE AUSSI, LOT 31

`supabase/lot31-resume-refuse-sans-classement.sql` pose le garde dans `public.resume(b, cle)`,
la porte unique des trois ecrans depuis le lot 27 : sans classement valide, elle rend `null`
plutot qu'un objet a trous, AVANT meme de lire le cache. **Les deux verrous se doublent expres**
: celui-ci ferme la classe pour tout appelant futur, celui du navigateur tient meme si le SQL
n'est pas passe. Trois resumes vides etaient deja RANGES dans `resumes` pour le bureau de Ted,
ils ont ete supprimes le meme jour.

### LES TROIS DEFAUTS D'AFFICHAGE, INDEPENDANTS

1. **`fmtPct` posait le signe DEUX FOIS.** `signeDe(n) + fmtNum(n)` donne « - -26,1 % » sur un
   nombre negatif. Sa voisine `fmtDelta`, ecrite le meme jour, prenait bien `Math.abs` : le
   defaut n'a jamais touche les euros, seulement les pourcentages, **et c'est exactement ce qui
   l'a fait survivre**. Effet de bord voulu : « en repli de -12,3 % » devient « en repli de
   12,3 % ».
2. **Le compteur de la barre disait « 0 LIGNES » sur 5 210.** Il n'etait ecrit qu'a DEUX moments,
   `openApp()` et `ecranRafraichir()`, avec deux formules differentes. Depuis l'amorcage leger du
   18/09/2026 les lignes n'arrivent plus a l'ouverture mais au premier geste qui en a besoin :
   entre les deux, personne ne repassait dire combien il y en a. **Un seul endroit l'ecrit
   desormais, `majCompteurLignes()`, et `assurerLignes()` l'appelle en sortant.**
3. **« 31 millesimes en circulation » en comptait 6.** Le compteur additionne les couples
   cuvee x millesime, cote navigateur comme cote serveur (`sum(n_mil)` dans lot26), et les deux
   sont d'accord : **le calcul n'etait pas faux, le LIBELLE l'etait.** Il dit « References,
   couples cuvee x millesime en circulation ». Ne pas changer le calcul pour faire coller le
   mot : ce serait casser la parite prouvee par `npm run controle:cuvees` pour un probleme de
   vocabulaire.

### ET UN SIGNAL QUI ANNONCE UN NOMBRE DOIT MENER A CE NOMBRE

« Mon cap » annoncait « 90 clients en retard sur leur cadence, 165 831 EUR » et renvoyait vers un
filtre de « Mon commerce » qui en montre **56 pour 126 217 EUR**. Aucun des deux n'avait tort :
`agentClients()` ecarte les clients qui portent deja une raison plus solide (« un client
n'apparait qu'une seule fois »), et 45 + 56 + 743 = 844 le prouve. Mais **un renvoi qui annonce
un nombre et mene a un autre est un renvoi qui ne sert plus.** `diagnosticSignals()` applique
donc le meme ecart, et seulement lui : `agentPremierAchat()` n'est pas rejoue, il ne change pas
ces deux motifs-la et il coute cher.

### CE QUI N'ETAIT PAS UN DEFAUT, ET QU'IL FAUT SAVOIR AVANT DE CHERCHER

Le calcul LOCAL etait juste de bout en bout, rejoue ligne a ligne contre la base : 550 286 EUR de
cuvees (554 158 moins les 3 872 de la famille « Divers »), -26,1 %, les listes de clients. Les
1 382 lignes portant un type d'offert sont toutes a zero euro, donc le mode devine ne perd rien.
Les trois « cuvees » etranges viennent de la saisie Vitisoft, pas du calcul : `Terre Mere 21 bis`
et les deux `erreur double saisie, ne pas utiliser` ne finissent pas par quatre chiffres, donc
`cuveeBase()` en fait des cuvees a part entiere. Vraies cuvees : 10 sur 13 annoncees.

### CE QUI RESTE OUVERT

- ~~**`gateBaseVide()` masque l'onglet « Le classement » tant que la base LOCALE est vide.**~~
  **CETTE AFFIRMATION ETAIT FAUSSE, ET ELLE A ETE DEDUITE DE LA LECTURE AU LIEU D'ETRE REJOUEE.**
  `baseEstVide()` du panneau delegue a `baseVide()` de bdv-ecrans.js, qui a justement ete corrige
  le 18/09/2026 pour ne conclure « vide » que si le SERVEUR le dit aussi. Rejoue le 23/09/2026
  par `"Claude outputs/lot32-verif-gate.mjs"`, quatre cas : base locale pleine, appareil neuf
  serveur muet, appareil neuf serveur plein, vide des deux cotes. **Un seul rend « vide », et
  c'est le bon.** Le garde est juste, l'onglet est atteignable. C'est la meme faute de methode que
  les deux faux defauts SQL du 18/09 : un Postgres vide et huit minutes tranchent ce qu'une heure
  de lecture ne tranche pas.
- ~~**Rien ne dit au vigneron que son classement n'est pas valide**, ni ce qu'il y gagnerait.~~
  **FAIT LE MEME JOUR**, voir « UN ETAT DEGRADE SE DIT LA OU SON PRIX SE PAIE » plus bas.
- **`resumes_perimer()` et `resumes_perimer_reglages()` sont appelables par `anon`** en RPC, vu au
  controle de securite du jour. Ce sont des fonctions de declencheur : hors declencheur elles
  levent, faute de table de transition. Bruit, pas faille, mais a fermer avec le lot 16.


## UN ETAT DEGRADE SE DIT LA OU SON PRIX SE PAIE, 23/09/2026

Suite immediate de « UN RESUME VIDE N'EST PAS UN RESUME ». Une fois le melange repare, il restait
la vraie question : **pourquoi Ted a-t-il tenu un bureau entier au juge sans le savoir ?**

### L'AVEU EXISTAIT, ET IL ETAIT AU SEUL ENDROIT OU L'ON VA DEJA POUR CORRIGER

`renderReglages()` ecrit depuis le 19/09/2026 : « L'outil fonctionne actuellement au juge. Les
regroupements ci-dessous sont des propositions deduites de ton fichier, pas des certitudes. » La
phrase est juste, elle nomme, elle distingue meme trois etats (regle / illisible / au juge), ce
qui est exactement ce que ce depot demande.

**Elle vit dans l'onglet « Le classement » du panneau de reglages.** Pour la lire, il faut ouvrir
le panneau ET choisir cet onglet, c'est-a-dire faire les deux tiers du chemin qui mene a la
correction. Le vigneron qui regarde « Mon cap » ne la voit jamais.

**LA REGLE : un etat degrade se dit LA OU SON PRIX SE PAIE, pas la ou on le repare.** C'est le
symetrique exact de la lecon du 19/09/2026 sur `noteComplement()` : annoncer ce qui manque sans
poser le bouton qui le comble est une impasse ecrite en toutes lettres. Ici c'etait le bouton
sans l'annonce.

### CE QUI A ETE POSE, ET LES TROIS REFUS QUI COMPTENT PLUS QUE L'AFFICHAGE

Un bandeau `.signal--info` dans `#noteClassement`, en tete de la coque des ecrans de vente, peint
par `majNoteClassement()`. Il nomme ce qui est devine (les familles hors CA, les canaux), dit ce
que ca coute (« tout se refait sur cet appareil a chaque ouverture ») et porte le bouton qui mene
a l'onglet. **Le texte du panneau n'est PAS recopie** : deux endroits qui expliquent le meme etat
divergeraient au premier ajustement. Le panneau garde l'explication longue, le bandeau dit une
phrase et mene la-bas.

**Ce qui rend ce bandeau tenable, ce sont ses trois refus, et le premier est le plus important :**

1. **`classementIncertain()` : les reglages du COMPTE n'ont pas pu etre lus, donc on se tait.**
   Accuser un vigneron d'un reglage manquant parce que son reseau a lache, c'est lui faire refaire
   un classement qui existe deja sur son compte, et l'ecraser. Le panneau dit deja l'autre phrase,
   avec l'autre geste. **Un bandeau qui accuse a tort coute plus cher que pas de bandeau : il
   apprend a ignorer les bandeaux.**
2. **`lignesPretes()`** : `REGLAGES_NON_LUS` part a `false`, et ce `false`-la veut dire « personne
   n'a essaye », pas « la lecture a abouti ». La seule lecture des reglages du compte se fait dans
   `tirerDuServeur()`, donc dans le meme chemin que les lignes : les attendre, c'est attendre la
   reponse. **Un drapeau qui vaut `false` avant toute tentative n'est pas une reponse.**
3. **`baseVide()`** : sans lignes il n'y a rien a classer, et `gateBaseVide()` ecarte deja l'onglet
   dans ce cas. Proposer un geste impossible est pire que se taire.

Branche sur les TROIS chemins, regle du 14/09/2026 : `ecranPeindre()`, `renderAll()` et
`assurerLignes()`. Une zone qui n'a que le premier marche parfaitement le jour ou on l'ecrit.

### LE RENVOI MENE A L'ONGLET, ET L'ORDRE EST UNE CONDITION

`BdvNav.ouvrirReglages(onglet)` transmet jusqu'a `BdvReglages.ouvrir(onglet)`, qui traduit un
alias court (`classement`) en id de bloc. Le module reste **le seul point d'entree des reglages**,
regle du 07/09/2026 : on lui ajoute un parametre, on n'ecrit pas un deuxieme chemin a cote.

**`viserOnglet()` s'appelle APRES `rafraichirTout()`, jamais avant.** `gateBaseVide()` force
« Ma base » quand il n'y a rien a classer, et il a raison de le faire : poser l'onglet avant, c'est
se faire corriger sans le voir. `montrerOnglet()` retombe de toute facon sur le premier onglet
disponible si celui qu'on vise est ecarte.

### ET LA PHRASE DU PANNEAU DISAIT CE QU'ON PERD, JAMAIS CE QU'ON GAGNE

« Prends les chiffres de canaux et de typologie avec prudence » decrit une degradation et ne donne
aucune raison d'agir : valider ressemblait a une corvee sans contrepartie. La phrase ajoutee n'est
pas un argument de vente, elle est mesuree : tant que le classement n'est pas valide,
`v_ventes.est_vente` vaut null, les trois fonctions de resume ne calculent rien, et chaque
ouverture d'ecran refait le travail sur l'appareil.

### `npm run banc:classement`, 21 CONTROLES, DANS `npm run verif`

Il garde les trois refus, les trois chemins, la presence de `#noteClassement` dans la page
CONSTRUITE (un id absent ne leve rien : la zone reste vide et personne ne le remarque), et l'ordre
`rafraichirTout()` puis `viserOnglet()`. Verifie en remettant le defaut, trois mutations, trois
echecs cibles : le garde de l'incertitude retire, `renderAll()` debranche, l'onglet vise trop tot.


## UN CHAMP QUE LE SERVEUR NE REND PAS NE PEUT PAS DIVERGER, 24/09/2026

La fiche d'une cuvée affichait « Conditionnements » sans rien dessous depuis le lot 26 :
`cuvees_resume()` ne rendait que le conditionnement dominant, et `agentProduits()` posait
`cond: {}` en dur. Le contrôle de parité était vert, parce qu'il ne compare que ce que le serveur
rend. Lot 32 : le serveur rend `conds`, un tableau `[{c, btl}]`.

**LA REGLE : quand on porte un écran sur le serveur, lister ce que l'écran LIT, pas ce que le
serveur REND.** Tout champ lu et non rendu est soit porté, soit refusé explicitement (`null`, et
l'écran se tait). Jamais remplacé par un vide écrit en dur. Encore « une absence n'est pas un zéro ».

Le bloc se cache quand le champ manque (`condsDuServeur()` rend `null`) : c'est ce qui protège un
résumé rangé en cache avant le lot 32. Le lot 32 efface ce cache, mais le garde de l'écran ne dépend
pas de ce collage. `npm run banc:cuvees-serveur` garde les deux.

## « MA JOURNEE » QUI SE TRAVAILLE, ET L'AGENT VIGNERON, 25/09/2026

Section 27 de `bdv-bureau.css`, `peindreArdoise()` et `brancherLuneVue()` dans `src/mon-bureau.njk`.

- **Tout redessin d'une piece passe par l'agent `agents/vigneron-empathique.md`**, AVANT
  (il tranche sur les captures) et APRES (il revérifie). Demande de Ted. Il ne code pas.
- **La lune est DANS le bloc d'identite** (grille `salut / plaque / lune` a gauche, mot a droite).
  Le repli se juge par `@container journee` (le `.bureau-plan`), JAMAIS par la fenetre : le tiroir
  retire un tiers de place sans changer la fenetre. Ne pas remettre `.bureau-accueil` en flex.
  L'ordre du DOM (salut, mot, lune) ne bouge pas, `npm run banc` le controle.
- **Une seule lune a l'ecran** : `bdv-lune-vue` sur le corps de page masque la lunette du coin
  (visibilite, sa place reste) tant que la grande est vue. La marge haute de l'observateur est la
  hauteur de l'en-tete MESUREE au depart.
- **Le panneau est une grille de cartes** par `@container panneau` (2 col. >= 720, 3 >= 1500), dans
  l'ordre du document. Les gestes sont toujours dessines (panneau et sous-main) : le devoilement au
  survol de la section 9 est leve, ne pas le remettre.
- **L'ardoise ne calcule rien** : tout vient de `resumeVentes()`. Trois etats de mois (vendu, zero,
  a venir), la regle du courrier du matin. La note dit la PERIODE de l'export (`du`/`au`), plus la
  date du depot.
- **Le harnais** : `scripts/capture-journee.mjs` (playwright, hors `verif`) photographie « Ma
  journee » garnie a plusieurs largeurs et dans les deux themes, et mesure la lune et le debordement.
  Il pose le salut, la plaque et un resume complet a la main : hors ligne le profil n'arrive pas.

## LA LUNE RESPIRE DANS LE COIN, ET ELLE A SES MERS, 25/09/2026

Demande de Ted : de l'air autour de la lune « quand elle est au-dessus des fonctions »,
**pas dans le bandeau rouge**, et une lune plus texturee.

- **Le coin (section 4 ter de `bdv-bureau.css`)** : le pourcentage suit le nom sur la meme
  ligne, en 12 px. Deux lignes au lieu de trois, mesure a 1440 : **12,4 px d'air en haut et en
  bas** (4 avant), 17 px avant le filet. Le retrait gauche reste 12 px, il centre le disque sur
  l'axe des icones. **La section est placee AVANT les sections 8 et 23** : leurs regles qui
  cachent le texte (retracte, rail replie, 901-1180 px) pesent le meme poids et gagnent par
  l'ordre. Deplacee apres, elle rallumerait le texte dans un coin de 64 px.
- **Le bandeau rouge n'a pas bouge** : le scope `.bureau-tete` ne l'atteint pas.
- **Les mers** sont posees UNE fois, `{% set mersLune %}` en tete de `src/mon-bureau.njk`, et
  lues par les deux lunes (coin et accueil). Vraies mers de la face visible, nord en haut. Elles
  ne se retournent PAS quand la lune decroit (c'est la lumiere qui change de cote, pas la face).
  Peintes de la couleur de l'OMBRE, opacite sur le GROUPE : elles disparaissent d'elles-memes
  sur la partie sombre, sans masque par phase, et deux mers qui se chevauchent ne noircissent
  pas. Ne pas y mettre `fill-opacity` par forme.

## UNE TUILE QUI MENE QUELQUE PART SE CLIQUE EN ENTIER, 25/09/2026

Demande de Ted : toute la tuile cliquable, une couleur au survol, plus de lien souligne. Quatre
essais montres sur les vraies tuiles, dans les deux themes ; **choix C** : le fond monte a
`--bdv-surface-2` et **un filet bordeaux de 3 px a gauche**, le titre ne change pas de couleur.
Section 28 de `bdv-bureau.css`, bloc de fin de `bdv-ecrans.css`.

- **Le filet est un fond** (`linear-gradient` a deux arrets identiques, 3 px), pas une bordure
  (decalerait le contenu) ni une ombre (echelle fermee, et ce fichier n'en pose aucune).
- **Meme etat au clavier** par `:has(:focus-visible)`.
- **Pas de filet la ou le bord gauche porte deja un sens** : l'echeance (sa famille) et le
  signal des ecrans de vente (sa gravite). Seul le fond monte.
- **Sur un tableau, le filet va sur la premiere cellule** : un fond pose sur un `<tr>` se
  repete cellule par cellule dans certains moteurs.
- **Rendues cliquables en entier ce jour-la** : la tache (calque de `tache__corps`), l'echeance
  du calendrier (calque du titre, qui ouvre la modale), la rangee de « Mes clients » (calque du
  nom), le signal qui porte un renvoi. Toujours le meme motif : l'action principale etend un
  `::after`, les autres gestes repassent au-dessus par leur `z-index`. **Une tuile qui porte
  d'autres boutons ne devient jamais un `<a>`.** Verifie au navigateur : coin de chaque tuile
  cliquable, aucun bouton interieur recouvert, dans les deux themes.
- **Le mot du jour, le haut du bloc calendrier et la tache** ont un retrait compense par une
  marge negative, pose EN PERMANENCE : pose au survol seulement, la tuile bougerait sous la
  souris.
- Non traite : les deux lignes suivantes du bloc calendrier (10 oct., 16 oct.) ne menent nulle
  part, et les lignes des ecrans de vente n'ont pas ete essayees charge complete (le banc hors
  ligne ne les charge pas).

## LE SITE S'OUVRE DANS UN AUTRE ONGLET DEPUIS LE BUREAU, 25/09/2026

Demande de Ted : les liens du bandeau (Articles, Outils, Conseil terrain, La redaction) et du
pied de page faisaient quitter le bureau. `ouvrirLeSiteAilleurs()` dans `bdv-nav.js`, appelee au
montage : dans `/mon-bureau/` seulement (seul ce module le fait, et il n'est charge que la), tout
lien de `.nav` et `.footer-rich` qui mene ailleurs sur le site recoit `target="_blank"`, `rel` et
une mention `.hors-ecran` « (nouvel onglet) ». Restent dans l'onglet : `/mon-bureau/`, `tel:`,
`mailto:`, et ce qui dit deja sa cible. **Pose au montage et pas au clic** : le survol et le clic
du milieu font alors ce qu'on attend. Verifie au navigateur : clic sur Articles et Outils, un
onglet s'ouvre, le bureau reste en place ; sur /articles/ rien n'a change.
Ce n'est pas l'ecouteur du mode plein ecran (« Les quatre sorties fermees ») : lui ne vise que
l'app d'ecran d'accueil et reste tel quel ; il sort sans rien faire sur un lien qui a deja sa cible.

## LA BARRE DU BAS : QUATRE PIECES ET « PLUS », 25/09/2026

Demande de Ted. Sous 700 px la barre montre Ma journee, Mes taches, Le calendrier et Mes clients,
plus une case « Plus » (`#bureauNavPlus`, hors des `.bureau-nav__ligne` que les bancs comptent) qui
ouvre le reste au-dessus, avec les noms. **Le choix des quatre est en CSS, sur `data-piece`**
(section 29.8 de `bdv-bureau.css`), et aucune ligne n'est deplacee dans le DOM : l'ordre est celui
que `banc-bureau.mjs` controle. La case prend l'accent quand la piece ouverte est rangee derriere
elle (`:has`). Toucher une piece, a cote ou Echap referme.

## LE PASSE SE DIT SELON LA NATURE, 25/09/2026

`phrase()` de `bdv-echeances.js` recoit le `statut` : un repere passe dit « Passe », tout le reste
« En retard ». Plus jamais « En vigueur depuis le », qui cassait la phrase devant une periode.
Et « 1er » le premier du mois, par `premier()` dans le meme fichier. **Ce fichier est joint a
`agenda-ics` : toute retouche demande `npm run agenda:joindre` puis un redeploiement.**
