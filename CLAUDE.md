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

Concretement, une piece nouvelle s'ajoute dans `PIECES`, en tete de `src/js/bdv-nav.js`, et
son ecran dans la coque `src/_includes/components/ecrans-vente.njk`. Les identifiants
doivent etre les memes que ceux de `NAV` dans `src/js/bdv-ecrans.js` : rien ne le garantit
sauf `npm run banc`, qui compare les deux listes et echoue si elles divergent.

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
- `bdv-compte.js` la porte de compte, `bdv-reglages.js` le panneau de reglages partage, plus
  `bdv-sync.js`, `bdv-crm.js`, `bdv-signets.js`, `bdv-echeances.js`, `bdv-canaux.js`.

Trois feuilles de style, dont deux ne sont dans AUCUN HTML : `style.css` (le site, liee par
le layout), `bdv-ecrans.css` (posee par `bdv-nav.js`, et portee par `.bdv-ventes` : voir plus
bas), `bdv-panneau.css` (posee par `bdv-reglages.js`, portee par `.bdvr-panneau`).

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

## Une seule commande avant de pousser

    npm run verif

Elle enchaine `build`, `charte`, `charte:bureau` et `banc`, et s'arrete au premier echec.

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

## Regles de contenu

- Aucun tiret cadratin nulle part. Remplacer par une virgule, un point ou deux points.
- Le vigneron est tutoye dans l'interface, ses clients sont vouvoyes dans les messages generes.
- Un chiffre affiche doit toujours dire d'ou il vient. Une case vide vaut mieux qu'une valeur inventee.

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

## La charte graphique : une seule pour le site et l'outil

`tokens.css`, a la racine, est la source unique. Le site et le tableau de bord declarent
le meme bloc `:root`. Aucune couleur, aucune taille, aucun rayon ecrit en dur ailleurs.

Trois regles portent l'identite, et ce sont elles qu'on casse en premier sans y penser :

1. **Aucun rayon de bordure.** L'angle vif est un parti pris, pas un oubli : la texture
   d'imprime vient de la et du filet. Seuls sont ronds les elements ronds par nature.
2. **Aucune ombre floue.** La signature est `--ombre-dure`, une ombre sans flou, decalee.
3. **Les tokens d'etat ne servent jamais d'accent.** `--ok`, `--danger`, `--warn` et
   `--info` disent un etat. Une serie de graphique verte se lirait « bon » : les huit
   couleurs de serie `--serie-1` a `--serie-8` existent pour ca, ancrees sur le bordeaux
   et les terres du site, et separees en LUMINANCE pour rester distinguables en niveaux
   de gris et en vision deuteranope. Pas seulement en teinte.

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

    npm run build           OBLIGATOIRE avant les trois suivants
    npm run charte          conformite du CSS du site
    npm run charte:bureau   conformite du bureau et de ses ecrans de vente
    npm run banc            le bureau fait-il ce qu'il dit

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
