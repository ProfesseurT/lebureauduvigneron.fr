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
carte entiere en lien, son nom accessible faisait 325 a 385 signes — un lecteur d'ecran
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

Quatre feuilles de style, dont trois ne sont dans AUCUN HTML : `style.css` (le site, liee par
le layout), `bdv-ecrans.css` (posee par `bdv-nav.js`, et portee par `.bdv-ventes` : voir plus
bas), `bdv-panneau.css` (posee par `bdv-reglages.js`, portee par `.bdvr-panneau`), `bdv-calendrier.css`
(posee par `bdv-nav.js` au premier clic sur le calendrier, portee par `.bdv-cal`). Les trois
feuilles chargees en JavaScript sont nommees A LA MAIN dans `scripts/charte.mjs` : une feuille
oubliee la echappe entierement au controle, et rien ne le signale.

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

## LA REGLE DU PLATEAU

Depuis la refonte du 07/09/2026, `Ma journee` pose plusieurs matieres sur un meme plateau :
du liege pour le panneau, du papier continu a picots pour le sous-main, un bloc a effeuiller
pour le calendrier, de l'ardoise encadree de bois pour les chiffres, du carton kraft pour les
intercalaires de la barre, une pile, des dos de classeur et une enveloppe pour les trois
zones du bas.

**Ce qui empeche ce mobilier de faire collage de brocante n'est pas le gout, c'est une regle
en trois lignes, ecrite en tete de la section MATIERES de `src/css/style.css` :**

1. Un seul plateau, `--paper`, et une seule lumiere, venue du haut a gauche.
2. Deux ombres seulement. `--ombre-carte` pour un objet pose, qui a une epaisseur.
   `--ombre-dure` pour la signature du site, dure et sans flou. **Jamais une troisieme.**
3. Toute matiere ajoutee prend ses couleurs dans les jetons de matiere existants, et si elle
   en demande un nouveau, ce jeton nomme la MATIERE et pas l'endroit ou il sert.

L'ordre des zones est une demande de Ted et non une preference de mise en page : le panneau,
le sous-main avec le calendrier a sa droite, l'ardoise, le mot du jour, puis a lire / le
classeur / le courrier. `npm run banc` le controle.

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

Deux apercus ne sont PAS dans cette chaine, parce qu'ils ne verifient rien : ils MONTRENT, et
c'est a regarder avec des yeux. `npm run apercu:panneau` pour le panneau de liege,
`npm run apercu:fiche` pour la fiche client dans ses quatre etats. Les ouvrir avant de livrer un
changement de dessin : `npm run courrier` avait deja laisse passer trois defauts que seule une
capture a montres.

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
sur la vraie feuille de style. **Regarder l'image apres toute retouche de cette modale** —
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

1. charger `bdv-ecrans.js` s'il manque (`BdvNav.chargerEcrans()`) — c'est lui qui sait
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
page elle-meme — `location.href` sur la meme adresse, ancre comprise, n'est qu'un changement
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
