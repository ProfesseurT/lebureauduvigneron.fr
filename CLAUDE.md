# Consignes projet lebureauduvigneron.fr

Site Eleventy deploye sur Vercel au push sur `main`. L'essentiel du travail se concentre dans
un seul fichier autonome : `src/outils/dashboard-vigneron.html`, le tableau de bord des ventes.

## Regles de contenu

- Aucun tiret cadratin nulle part. Remplacer par une virgule, un point ou deux points.
- Le vigneron est tutoye dans l'interface, ses clients sont vouvoyes dans les messages generes.
- Un chiffre affiche doit toujours dire d'ou il vient. Une case vide vaut mieux qu'une valeur inventee.

## Le tableau de bord : ce qu'il ne faut jamais casser

### 1. `HASH_COLS` ne bouge jamais

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
sont des entites HTML d'emoji. `verif-dash.mjs` les compte avant et apres, justement pour
attraper celui qui les prendra pour des couleurs.

Deuxieme piege : `#FFF` a deux roles opposes, surface de carte et texte sur fond sombre.
Le premier est `--white`, le second est `--on-dark`, qui vaut le papier. Sur un fond
bordeaux, du blanc pur est plus dur que le papier du site.

## Ce que le dashboard ne fait pas, volontairement

- **Aucun appel reseau.** Tout est calcule dans le navigateur du vigneron, les donnees de ses
  clients ne sortent jamais. C'est la promesse du produit : ne pas la casser pour du confort.
- **Aucun envoi d'e-mail.** Le compositeur remplit un lien `mailto:`, c'est la messagerie du
  vigneron qui envoie. Pas de cle API dans une page publique, pas de responsabilite d'envoi.
- **Aucune generation de texte par un modele.** Les messages sont des gabarits a blocs remplis
  avec les donnees du client. Sept squelettes pour l'instant : si le besoin de varier grandit,
  ecrire plusieurs variantes par bloc et les choisir par une empreinte stable du numero client,
  jamais au hasard, pour que le meme client recoive toujours le meme message.

## Verifier avant de livrer

Trois scripts de controle sont dans `scripts/`. Ils ont besoin de `css-tree`, declare en
devDependency.

    npm run verif:site    conformite du CSS du site
    npm run verif:dash    conformite du tableau de bord

Ce qu'ils regardent : les couleurs, les rayons, les familles de police et les tailles
encore ecrits en dur avec leur selecteur ; les tokens declares jamais appeles et les
`var()` sans declaration ; la table des contrastes des paires texte sur fond, avec le
verdict AA ; et, pour le tableau de bord, que les entites HTML numeriques sont intactes.

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

Il n'y a pas de suite de tests dans le depot. La verification se fait en chargeant le fichier
dans jsdom, en injectant un export reel, et en appelant les fonctions de rendu. A controler
systematiquement apres une modification :

1. Le chiffre d'affaires total est inchange.
2. Un reimport du meme export donne 0 ligne ajoutee.
3. Les cinq ecrans se rendent sans erreur.
4. Les listes de clients ne contiennent aucun doublon.
5. Les textes generes se lisent a voix haute sans faute d'accord.

Le dernier point n'est pas un detail : les noms de cuvee portent deja un article, ce qui produit
« Votre Le Rosé 2024 » ou « ceux qui aiment du Miracle » si on concatene naivement. Trois helpers
existent selon la position dans la phrase : `avecArticle()`, `avecDe()` et `avecLe()`.
