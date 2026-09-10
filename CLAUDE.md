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

Elle enchaine `build`, `charte`, `charte:bureau`, `banc`, `banc:journee`, `banc:reglages`,
`banc:taches` et `banc:sync`, et s'arrete au premier echec.

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

### 7. Mes taches porte DEUX natures, et pas trois

La piece « Mes taches » porte les taches que le vigneron ecrit lui-meme et les
obligations du calendrier qu'il coche. **Les clients a rappeler restent au sous-main**,
avec leurs trois gestes qui repoussent le rappel.

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
