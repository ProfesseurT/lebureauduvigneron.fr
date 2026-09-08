# Journal du projet, lebureauduvigneron.fr

Ce fichier raconte ce qui a été décidé et pourquoi, session par session, la plus récente en haut.
Il ne remplace pas `CLAUDE.md`, qui dit les règles à ne jamais casser, ni
`BRANCHEMENT_supabase-resend.md`, qui est le mode d'emploi de la configuration Supabase et Resend.
Ici on garde la trace des arbitrages : ce qu'on a choisi, ce qu'on a écarté, et ce qu'on s'est
promis de regarder plus tard.

Note de datation : les commentaires écrits dans le code pendant la session du 04 au 06/09/2026
portent la date du 04/09, qui est le jour où la session a commencé. Le travail s'est étalé sur
trois jours. Ne pas s'en étonner en relisant.

---

## 08/09/2026. « Il faut que je me déconnecte et reconnecte pour voir mes données »

Ted, après avoir créé son compte et importé son export : rien ne s'affiche, aucune tuile de
« Ma journée » ne se met en route, et seule une déconnexion/reconnexion répare. Ce n'était pas
la reconnexion qui réparait : c'était le **rechargement de page** qu'elle provoquait au passage.
Et il fallait même une deuxième condition, invisible pour lui : avoir ouvert une pièce de vente
entre les deux.

### Trois manques enchaînés, un seul symptôme

1. **Personne ne faisait l'analyse après un import.** « Ma journée » ne calcule rien, par
   construction : elle lit une analyse toute prête dans `reglages.file_travail` et
   `reglages.resume_ventes`. Or ce dépôt ne se fait que dans `renderAll()` (bdv-ecrans.js),
   un fichier que le bureau ne charge qu'au **premier clic sur une pièce de vente**. Un import
   n'est pas un clic : les lignes partaient bien sur le compte, et rien ne les analysait.
2. **Et quand l'analyse existait, le bureau ne l'apprenait pas.** `bdvMajJournee()` relit le
   miroir local ; le dépôt, lui, vient d'être écrit sur le serveur. Seul `BdvCrm.charger()`,
   appelé au chargement de la page, va lire la table.
3. **Une session ouverte dans la page laissait le bureau mort.** Tout le module de « Ma
   journée » rend la main sur `if(!connecte) return;` — jusqu'à `window.bdvMajJournee`, qui
   n'existe alors même pas. Ça tenait uniquement à `surClicCompte()` qui posait
   `location.href = '/mon-bureau/'`. Depuis /mon-bureau/, c'est la **même page** : le
   navigateur n'y voit qu'un changement d'ancre et ne recharge rien.

### La réparation, et l'ordre qui est tout le sujet

`analyserPourLeBureau()` dans bdv-base.js, appelée à la fin d'un import et de là seulement :
charger le calcul s'il manque (`BdvNav.chargerEcrans()`, exposé pour ça) → déposer → **relire
le serveur** → repeindre. Retirer l'un des quatre pas ramène le défaut, sous une forme
différente chaque fois. `deposerPourLeBureau()` rend désormais sa promesse : sans elle la
relecture partait avant que le dépôt soit arrivé, une course qui se serait vue une fois sur
trois selon la latence.

**Ce qu'on a écarté** : appeler cette chaîne depuis `ecranRafraichir()`, qui tourne à chaque
réglage modifié — charger 83 ko et écrire en base pour un objectif de CA changé n'a aucun sens.
Et **sauter le dépôt quand `renderAll` existe** : ça cassait le deuxième import du bureau, où
`renderAll` existe depuis le premier, en laissant les tuiles sur l'analyse précédente. Une
écriture de plus sur une seule ligne coûte moins cher qu'une condition fausse.

Le bureau fermé sait maintenant se réveiller : il écoute `bdv:session`, reprend la destination
demandée par la porte (`/mon-bureau/#base` doit atterrir sur l'onglet Ma base), la pose dans
l'adresse **puis** recharge — `location.replace()` sur une simple ancre ne rechargerait pas
davantage, c'est exactement le piège réparé.

### Ce qui reste ouvert, et qui n'a pas été touché

Après « Vider la base », les **autres appareils** gardent le dépôt périmé : rien n'écrit une
analyse vide sur le compte à ce moment-là. Le poste qui vide, lui, se repeint correctement
(`BdvCrm.oublier()` + `ecranRafraichir()`). Signalé, pas réparé : recréer une ligne `reglages`
juste après un « tout effacer » demande un arbitrage qu'on n'a pas pris.

Aucun banc ajouté, décision de Ted. Vérifié à la main : les huit bancs existants passent, plus
deux contrôles jetables hors dépôt (le réveil du bureau dans jsdom, 11 contrôles ; l'ordre des
quatre pas de la chaîne, 8 contrôles).

---

## 08/09/2026. Le guide d'import, après « oui j'utilise Vitisoft »

Un sixième écran s'ajoute à la fenêtre de compte. Il n'apparaît que pour qui vient de répondre
**oui** à la question Vitisoft, juste après les cinq questions, et il dit trois choses : sortir
l'export de ses ventes depuis Vitisoft, le glisser dans « Ma base », et à qui écrire s'il ne sait
pas faire — `teddy@solumatic.fr`.

### Quatre emplacements possibles, Ted a choisi l'écran

Une carte dans le bureau qui reste jusqu'au premier import, une page à part `/importer-vitisoft/`,
les deux, ou un écran de plus dans la fenêtre. Ted a pris l'écran : il enchaîne pendant que le
vigneron est encore attentif, au lieu de le laisser retrouver un bandeau qu'il apprendra à ignorer.
Le revers assumé : rien ne le rappelle plus tard. Si les imports ne suivent pas, la carte de rappel
est le premier levier à ajouter, et les deux emplacements se cumulent sans se gêner.

### La règle qui décide, et pourquoi elle n'est pas « toujours »

Le guide ne s'affiche que si la porte a été ouverte par un **bouton du site** (`ouvrir()`, où
`guideImport` vaut vrai par défaut) et pas par un verrou posé depuis l'intérieur d'un outil
(`porte()` nue, appelée par `bdv-base.js` et `bdv-ecrans.js`). La raison est nette :
`bdv-base.js:918` ouvre la porte **au moment où le vigneron dépose un fichier**. Lui expliquer
comment déposer un fichier à cet instant-là serait ridicule. Les trois appels internes n'ont pas
eu une ligne à changer, ils n'appellent pas `ouvrir()`.

Deuxième condition, `utilise_vitisoft === 'oui'`. « Non » et « je ne sais pas » entrent
directement, et **« Passer cette étape » ne montre jamais le guide** : cette étape n'écrit rien,
donc on ne sait pas ce que le vigneron utilise, donc on ne lui promet rien.

Et le guide s'intercale **après** l'envoi de la fiche en base, jamais avant : quelqu'un qui ferme
la fenêtre sur le guide a déjà ses cinq réponses enregistrées.

### « Déposer ma base maintenant » ne mène pas au bureau, mais à la pièce

Le bouton du site ne demandait que `/mon-bureau/`. L'écran, lui, veut `/mon-bureau/#base`, là où
se trouve la zone de dépôt. D'où `destinationForcee` et `destinationDemandee()` au niveau du
module : un écran de la porte peut demander une adresse plus précise que le bouton qui l'a
ouverte, et cette demande passe devant, parce qu'elle est plus récente et plus précise.

Trois garde-fous, chacun tenu par un contrôle du banc. La demande est **consommée une seule fois**.
Elle est **remise à zéro à chaque ouverture** : sans ça, un choix fait pendant une inscription
renverrait encore vers « Ma base » au prochain clic sur un bouton de compte, des jours plus tard.
Et **les deux endroits qui redirigent la lisent** — la délégation de clic dans `bdv-compte.js` et
le `.then` de `/compte/?mode=connexion` dans `compte.njk`. En oublier un laissait la demande en
attente, prête à fuiter ailleurs.

### Ce qui reste à écrire, et que je ne peux pas inventer

L'étape 1 dit « dans Vitisoft, sors l'export de tes ventes au format CSV ». **Le chemin exact dans
le menu de Vitisoft n'y est pas**, parce que je ne l'ai pas. Une ligne à remplacer.

### Le banc, et les deux pièges de jsdom

`npm run banc:porte` (`scripts/banc-porte-import.mjs`), 23 contrôles, ajouté à `npm run verif`.
Il couvre les deux sorties du guide, les trois réponses qui ne l'ouvrent pas, « Passer cette
étape », le verrou interne, et la non-fuite de la destination.

Deux choses payées en l'écrivant, et notées dans l'en-tête du fichier. **jsdom n'a ni `fetch` ni
`Response`** : un `new Response(...)` lève « is not a constructor », et le message part dans
l'écran d'erreur de la porte au lieu du rapport — le banc annonce alors huit échecs qui n'ont rien
à voir avec le code testé. Et **jsdom ne laisse ni remplacer `location` ni observer une
navigation**, les deux propriétés étant non configurables : on lit donc l'intention de sortie, sauf
dans un contrôle qui monte la page sur `/mon-bureau/`, où le renvoi vers `#base` n'est plus qu'un
changement de fragment que jsdom exécute pour de vrai.

Ce que le banc ne voit pas : la mise en page. L'écran est plus long que les autres, et
« le bouton est-il atteignable sur un téléphone » reste un contrôle à faire à l'œil, une fois.

### Le blocage signalé par Ted, non reproduit

Ted signale un message rouge, sur l'étape des questions, qui lui dit que des cartouches ne sont pas
remplis et le renvoie à ce qu'il faut remplir. **Aucune version de ce site n'a jamais pu produire
ce message à cet endroit** : l'étape des questions n'a ni validation, ni élément d'erreur — les
cinq réponses sont toutes facultatives, et `git log -S` ne trouve aucune validation passée.
Vérifié aussi, et sain : la colonne `utilise_vitisoft`, son droit d'écriture, la règle de sécurité,
le déclencheur de création de fiche, la production Vercel à jour du dernier commit, et sa propre
inscription du jour passée de bout en bout à 14h08 avec les cinq réponses en base.

Les seuls messages rouges de la fenêtre vivent sur **l'écran d'accès** : l'adresse invalide, et le
refus de mot de passe qui liste ce qui manque au-dessus du bouton, avec la liste des règles cochées
juste sous le champ. Reste à faire confirmer par une capture avant de corriger quoi que ce soit.

---

## 08/09/2026. La lune du bandeau, et deux cycles qu'il ne faut pas confondre

Une lune calculée est posée dans l'en-tête du bureau, entre le bonjour et les actions : le dessin,
le nom de la phase, le pourcentage éclairé, la lune montante ou descendante, et la prochaine phase
en clair.

### Aucune lune n'est branchée à rien, et c'était le point de départ

Ted demandait une lune « connectée à la vraie lune pour être sûr à 100 % ». Il n'existe pas de flux
temps réel de la Lune, et c'est une bonne nouvelle pour un site statique : sa position se calcule.
`bdv-almanach.js` le faisait déjà pour les quatre instants du mois (Meeus, chapitre 49). Il ne
savait pas dire où en est la lune un mardi quelconque, ce dont l'en-tête a besoin tous les jours.

### On n'a pas interpolé entre deux nouvelles lunes

Compter les jours depuis la dernière nouvelle lune et diviser par 29,53 tient en cinq lignes. Écarté :
l'orbite n'est pas parcourue à vitesse constante, l'écart atteint six heures, soit deux à trois
points de pourcentage — et surtout un croissant dessiné du mauvais côté un jour sur trente. Un
croissant à l'envers, un vigneron le voit en levant les yeux. Retenu : la position réelle des deux
astres, Meeus chapitres 47, 25 et 48. Quarante lignes de plus, et un résultat vérifiable.

### Ce qui prouve que le calcul est juste

`scripts/banc-lune.mjs`, ajouté à `npm run verif`. Il ne vérifie pas une cohérence interne, il
confronte le calcul aux **exemples imprimés** de Meeus : 47.a, 25.b et 48.a sont retrouvés au
millième de degré. Deux contrôles vont plus loin :

- la déclinaison sort à ±28,4° sur 2026, et non ±23,4°. C'est le cycle de 18,6 ans des nœuds
  lunaires — 2025 était un grand arrêt — que le calcul retrouve seul, sans qu'on le lui ait donné.
- l'aire de la figure dessinée est mesurée et comparée à la fraction éclairée. C'est ce qui attrape
  une inversion croissant/gibbeuse, le seul défaut du dessin qui ne se verrait pas sur un écran sans
  avoir la vraie lune sous les yeux au même instant.

### Croissante et montante ne sont PAS la même chose

Le point de fond, et il ne se devine pas. **Croissante / décroissante** est la phase, 29,53 jours,
c'est ce que montrent les symboles du calendrier. **Montante / descendante** est la déclinaison,
27,32 jours : la lune passe chaque jour plus haut ou moins haut dans le ciel. Un vigneron en
biodynamie travaille sur la seconde. Les deux se décalent en permanence — une lune peut être
croissante et descendante le même jour, et le banc l'exige : 208 coïncidences sur 400 jours, ni 400
ni 0. Déduire l'une de l'autre pour économiser un calcul aurait été une faute de fond, invisible.
Le survol du bloc porte cette explication, parce que deux mots ne peuvent pas la dire.

### Le dessin n'est pas un caractère de police

Aucune police ne sait faire un croissant à 9 % ni le retourner. Deux arcs SVG : un demi-disque, et
une demi-ellipse retirée (croissant) ou ajoutée (gibbeuse), de demi-largeur `R × |1 − 2k|`. À 50 %
cette demi-largeur tombe à zéro, et SVG traite un rayon nul comme une droite : le terminateur d'un
quartier devient rectiligne sans cas particulier. `BdvAlmanach.chemin(k)` est dans l'almanach et non
dans le gabarit, pour une seule raison : une fonction de dessin cachée dans une page ne se teste pas.

### L'almanach passe dans le gabarit, en defer

Il n'était chargé qu'au premier clic sur le calendrier, par `RESSOURCES_CAL` de `bdv-nav.js`. La lune
de l'en-tête doit être là dès la première seconde et dans **toutes** les pièces, y compris « Ma
journée ». Donc dans `mon-bureau.njk`, et en `defer` : le budget documenté du bureau est de 32 ko
**bloquants**, un defer n'en consomme aucun. Il reste déclaré dans `RESSOURCES_CAL`, où il documente
la dépendance de la pièce et la rattraperait si le gabarit changeait ; le chargeur le reconnaît à son
adresse et n'en pose pas un second. Le banc du bureau observe donc désormais trois ressources au clic
sur le calendrier, et deux nouveaux contrôles tiennent la place laissée : l'almanach est déclaré, en
defer, et avant `bdv-nav.js`.

### Arbitrages de Ted

- L'interrupteur « Lune et fériés » du calendrier **n'éteint pas** celle du bandeau. Deux endroits,
  deux natures : cet interrupteur nettoie les cases d'un mois, la lune de l'en-tête est le décor du
  bureau. Un contrôle du banc interdit qu'on les branche ensemble « par cohérence ».
- Montante / descendante affichée **tout de suite**, et pas remise à un lot ultérieur.

### Ce qu'on s'est promis de regarder

- Le nœud lunaire et le périgée / apogée, qui comptent aussi en biodynamie, ne sont pas calculés.
- Le repeint est un intervalle de trente minutes, et non une minuterie posée sur minuit : un portable
  qui dort rate son rendez-vous de minuit sans moyen de le savoir, un intervalle repart au réveil.
- La lune n'est pas dans le tableau de bord, seulement dans le bureau.

---

## 09/09/2026, nuit. Le filtre des tâches, une régression du lot 2, et deux captures qui mentaient

Ted : « faut pouvoir choisir aussi dans les tâches les catégories à afficher ou pas ».

**Sa demande était le symptôme, pas la cause.** `obligations()` dans `bdv-taches.js` prend TOUT le
fichier de données. Tant qu'il portait cinq obligations, la règle 7 tenait toute seule. Le lot 2 y
a ajouté les travaux du domaine, les salons et les temps forts : « Mes tâches » est passée de 5
lignes à 28, et s'est mise à proposer de cocher « Taille de la vigne » comme une DRM.

**Le banc n'a rien vu parce que son bac d'essai ne contenait qu'une DRM.** Un jeu d'essai plus
petit que la réalité ne vérifie que ce qu'il contient. Il porte maintenant une occurrence de
chaque famille, et sept contrôles sur le filtre.

Les défauts du filtre ne sont pas ceux du calendrier, et c'est voulu : obligations et notes
allumées, repères de saison, salons et temps forts éteints. Le calendrier est une carte, on veut y
voir les vendanges ; une liste de choses à faire ne porte que ce qui se coche. Et le choix est
propre à chaque pièce : le partager voudrait dire qu'éteindre « Travaux » pour nettoyer sa liste
retire les vendanges de la grille.

### `tokens.css` n'est servi à personne, et deux contrôles ne l'ont pas dit

C'est la deuxième erreur du soir, et la plus grave. `tokens.css` est un document de RÉFÉRENCE : il
n'est lié par aucune page et n'est pas copié dans `_site`. Les vraies déclarations vivent dans le
`:root` de `style.css` et dans celui de `bdv-ecrans.css`.

J'y ai ajouté quatre couleurs de famille au lot 2. **Elles n'ont jamais existé dans le
navigateur.** Deux garde-fous ont regardé ailleurs :

1. `npm run charte` ne lit pas les feuilles chargées en JavaScript. Un `var()` écrit dans
   `bdv-calendrier.css` échappait au contrôle du site.
2. `charte:bureau`, lui, lit aussi `bdv-ecrans.css`, **qui déclare déjà `--serie-1` à
   `--serie-8`**. Le nom existait, le contrôle était content. Il ne pouvait pas savoir que la
   déclaration venait d'une autre feuille, avec d'autres valeurs, pour un autre usage.

Une collision de noms rend une déclaration manquante indétectable. C'est le seul cas où la charte
peut dire CONFORME sur du `var()` cassé. Le défaut n'est apparu que le jour où une règle est
descendue dans `style.css`, ce qui l'a fait entrer dans le périmètre du contrôle du site.

**Les huit séries existaient donc depuis le début**, avec leurs luminances documentées, pour les
courbes des écrans de vente. Je les avais déclarées absentes dans le journal du lot 2 : c'était
faux. Les familles du calendrier s'appellent maintenant `--fam-1` à `--fam-4`, un jeu séparé, et
c'est justifié par la mesure : sur `--paper-light`, `--serie-4` tombe à 2,37:1, `--serie-6` à
2,95:1, `--serie-8` à 1,94:1. Une échelle pour des aplats de graphique n'est pas une échelle pour
des filets de trois pixels sur du papier.

### Et mes captures montraient les bonnes couleurs

Parce que le harnais inlinait `tokens.css`. Trois captures envoyées à Ted montraient un écran que
le navigateur n'aurait jamais rendu. **Un harnais qui ne charge pas exactement ce que la page
charge n'illustre qu'une intention.** Sa liste de feuilles est maintenant celle de la page,
`style.css` plus les feuilles posées en JavaScript par la pièce, et rien d'autre.

`npm run verif` : conforme, 52 contrôles pour les tâches seules, 0 échec.

---

## 08/09/2026, nuit. Une tâche peut durer plusieurs jours

Ted : « la création d'une occurrence doit demander aussi une date de fin facultative : imagine
c'est un salon sur plusieurs jours. »

**Ça demandait une colonne, pas un champ de formulaire.** La table `taches` ne portait que
`echue_le`. D'où un deuxième SQL le même soir, `supabase/lot8-taches-fin.sql`.

### Le retard se compte sur la fin

C'est la seule vraie décision du lot. Un salon du 9 au 11 février n'est pas en retard le 10 :
il a lieu. Compter sur le début aurait mis en retard, dès son deuxième jour, tout ce qui dure.
Une période commencée mais pas finie affiche donc « En ce moment » et vaut zéro jour, exactement
comme les périodes de la bibliothèque.

### Trois cas de saisie tordue, tranchés dans le code plutôt que refusés

- **Deux dates à l'envers sont échangées.** « Du 11 au 9 » ne veut dire qu'une chose, et un
  formulaire qui refuse sans expliquer fait abandonner. L'échange se voit tout de suite dans la
  liste, donc il ne cache rien.
- **Une fin égale au début est effacée.** Un jour n'est pas une période, et la garder ferait
  afficher « du 9 au 9 ».
- **Une fin sans début devient le début.** Sinon la note ne saurait pas où se poser dans la
  grille.

Une contrainte en base tient les mêmes règles, pour le jour où une écriture ne viendra pas du
code.

### La colonne d'un côté, la durée de l'autre

La bibliothèque porte une `duree` en jours parce qu'une règle annuelle recalcule sa fin chaque
année. Une tâche porte deux vraies dates parce qu'elle ne se répète pas. Les deux disent la
même chose, et la conversion se fait à un seul endroit, quand le calendrier emballe la tâche en
règle synthétique.

Le champ est dans les **deux** formulaires, celui du calendrier et celui de « Mes tâches » :
c'est la même table, et un salon noté d'un côté doit pouvoir durer autant que de l'autre. Le
« + » d'une case vide la fin, parce qu'on clique sur un jour et que garder la fin de la note
précédente ferait un salon de trois jours à partir d'un clic sur le 12.

`npm run verif` : conforme, 45 contrôles pour les tâches seules, 0 échec.

---

## 08/09/2026, nuit. Activer ligne par ligne, et une fuite entre deux comptes que le banc a trouvée

Ted a choisi le reste du lot 3 plutôt que le remplissage de la bibliothèque, ce qui est le bon
ordre : sans l'activation ligne par ligne, soixante temps forts de plus étouffent la grille du
mois pour tout le monde, y compris pour celui qui ne fait ni salon ni œnotourisme.

### La table porte les écarts, pas la bibliothèque

`calendrier_choix` : `cle`, `actif`, `decale_de`, et c'est tout. Elle ne porte ni la
bibliothèque, qui vit dans le fichier de données, ni ses occurrences à lui, qui sont des
tâches.

**Une ligne n'existe que s'il y a un écart.** Suivi et non décalé est l'état par défaut du
monde : rallumer un repère et remettre son décalage à zéro supprime la ligne. Sans cette règle,
la table porterait une ligne par occurrence et par compte, toutes neutres. Même règle que
décocher une obligation, et même motif.

Une obligation ne s'éteint ni ne se décale. Le garde-fou est double : l'écran ne montre pas les
gestes, et `reglesActives()` les ignorerait de toute façon. Un jour quelqu'un écrira une ligne
à la main, ou par un vieux bouton oublié ; le calendrier ne doit pas pour autant cacher une DRM.

### Le décalage s'applique avant le filtre de fenêtre, et c'est tout le piège

Le poser après avoir décidé si l'occurrence tombe dans le mois donnerait une date juste dans
une fenêtre fausse : un repère décalé de trois semaines disparaîtrait du mois où il tombe, sans
erreur, et personne ne le chercherait là. Le banc garde les deux sens, celui qui entre dans le
mois depuis le mois d'avant et celui qui en sort.

### Ce qui est éteint doit pouvoir se rallumer, et c'est la moitié du travail

Un réglage qui se cache une fois posé n'est pas un réglage, c'est une perte : le vigneron
éteint un repère par curiosité et ne le retrouve plus jamais. La ligne « Un repère que tu ne
suis plus : Foire aux vins » est donc toujours là dès qu'il y en a un, elle les nomme, et
chaque nom **est** le bouton qui le rallume.

Elle repart des règles et pas du cache : une clé enregistrée pour une occurrence disparue du
fichier de données afficherait sinon une ligne fantôme que personne ne peut rallumer.

### LA FUITE ENTRE DEUX COMPTES, trouvée par le banc et pas par moi

`id` posé à l'envoi et jamais chez l'appelant protège d'une première fuite : une ligne enfilée
hors ligne ne repart pas sous un compte figé. C'est la leçon de la panne des signets du
07/09/2026, écrite dans `CLAUDE.md`, et je l'ai appliquée sans réfléchir plus loin.

**Elle cause exactement une seconde fuite, dans l'autre sens.** Ted éteint un repère hors
ligne, se déconnecte, un collègue se connecte sur le même navigateur, et le rejeu écrit le
choix de Ted **sur le compte du collègue**. Le geste qui protège de la première cause la
seconde, et aucune des deux ne lève d'erreur.

La file retient donc, à côté d'elle, qui l'a remplie. Une file étrangère se jette au lieu de se
rejouer. Une file sans propriétaire, celle d'un geste posé avant toute session, se reprend :
c'est le vigneron qui note dans le train avant d'ouvrir son compte. Deux contrôles gardent les
deux cas, parce qu'un garde-fou qui jette tout marcherait aussi bien au premier test.

Et le miroir se vide maintenant à **chaque** changement de session, pas seulement à la
déconnexion. Le garder en attendant la réponse du serveur montrait au suivant, pendant une
seconde ou deux, ce que le précédent ne suivait pas. Une seconde suffit à poser un geste.

**`bdv-taches.js` et `bdv-signets.js` ont la même forme, donc le même défaut.** Signalé à Ted,
pas corrigé : ce sont deux modules qui marchent, et le chantier du jour ne les touchait pas.
Une quinzaine de lignes par module sur le modèle de `bdv-calchoix.js`.

### Ce qui reste du lot 3

Les occurrences perso **récurrentes**, du genre « portes ouvertes, premier week-end de juin ».
Une tâche porte une date, pas une règle. C'est le seul cas qui justifie encore une table à lui,
et il n'est pas urgent.

`npm run verif` enchaîne désormais aussi `banc:calchoix` : 38 contrôles pour cette table seule,
0 échec.

---

## 08/09/2026, tard. Les tâches entrent dans le calendrier, et le lot 3 fond de moitié

Ted, trois puces : afficher les tâches datées dans le calendrier, pouvoir créer une occurrence
depuis le calendrier, créer une catégorie « Tâches ».

**Les trois ne font qu'une seule fonctionnalité, et elle est beaucoup plus petite que le lot 3
que j'avais planifié.** Une tâche datée EST une occurrence : elle a un titre et une date, il ne
lui manque qu'une règle de récurrence, et `unique` la lui donne. La table `taches` porte déjà
titre, échéance et date de réalisation.

Donc : **pas de table `calendrier_perso`, et il ne faut pas en créer une.** Elle donnerait deux
endroits qui répondent « qu'est-ce que j'ai à faire le 12 ». Ce qui reste vraiment au lot 3,
c'est l'activation des repères compte par compte et les occurrences perso **récurrentes**, que
la table des tâches ne sait pas porter.

### Les tâches passent par le même calcul, en règles synthétiques

`reglesDesTaches()` emballe chaque tâche datée dans la forme d'une ligne du fichier de données,
avec `recurrence: { type: 'unique', date: echue_le }`. Tout le reste du module les traite sans
le savoir : la grille, la vue année, la liste, le filtre. Zéro chemin de code en plus.

Une tâche se coche par **son** identifiant, jamais par un identifiant d'occurrence. Une tâche
est une ligne unique, elle ne revient pas tous les mois : lui fabriquer un `ech:…` créerait une
deuxième ligne à côté de la sienne, et la première resterait non cochée pour toujours.

Et le calendrier n'affiche que les tâches **datées**. Une tâche sans date n'a pas de place dans
une grille ; le calendrier en annonce le nombre et mène à « Mes tâches ». C'est la frontière que
Ted avait posée lui-même le matin.

### La cinquième famille n'a pas de couleur, et c'est la mesure qui l'a décidé

J'allais ajouter un `--serie-5`. **Il n'y a pas de place pour une cinquième série sur ce
papier.** La bande utilisable va de L* 15 à L* 56 : au-delà, un objet graphique passe sous les
3:1. Trois répartitions essayées, trois échecs :

| Essai | Écart de luminance minimum | Contraste le plus faible |
| --- | --- | --- |
| Les 4 actuelles + une 5e plus claire | 11,8 | **2,09:1** |
| 5 respacées, écart visé 11 | **0,8** | 3,15:1 |
| 5 respacées, la 5e au milieu | **6,6** | **2,68:1** |

Cinq séries dans 41 points de luminance, c'est dix points d'écart au mieux, et les extrémités
tombent sous le seuil dès qu'on écarte vraiment.

**La cinquième famille se distingue donc par la matière**, ce qui est la règle du plateau : le
calendrier est imprimé, les tâches sont écrites à la main dessus. Caveat, l'encre du site, un
filet pointillé. Ça se lit sans couleur, donc aussi en niveaux de gris et en vision
deutéranope, ce qu'une cinquième teinte n'aurait pas fait. Caveat était déjà chargée par le
lien Google Fonts du site, vérifié avant d'écrire la règle.

Corollaire à ne pas oublier : une sixième famille ne pourra pas non plus prendre une couleur.
Elle prendra une matière, ou elle n'existera pas.

### Un formulaire, et pas quarante-deux

Le « + » de chaque case ne crée rien : il pré-remplit la date du seul formulaire de la pièce et
y pose le curseur. Un formulaire par case, ce sont quarante-deux champs dans le document ; une
bulle qui s'ouvre sur la case, c'est une mécanique de fenêtre flottante à écrire, à placer et à
fermer au clavier. Un geste, aucune surface nouvelle.

Le formulaire emprunte `.tachesf` à « Mes tâches », volontairement : le même geste doit avoir la
même allure aux deux endroits. Et la date **ne se vide pas** après l'ajout, contrairement au
titre : on note souvent plusieurs choses pour le même jour.

Le « + » n'apparaît qu'au survol de la case **et au focus clavier**. Sans la seconde condition
il n'existerait que pour ceux qui ont une souris.

`npm run verif` : conforme, 93 contrôles au banc du bureau, 0 échec.

---

## 08/09/2026, soir. Le lot 2 : quatre familles, et un fond de carte qui se calcule

Ted a ouvert sa base Notion du calendrier et m'a dit d'aller y regarder : « par contre je
trouve qu'y'a trop de catégories, à voir pour réduire et faire qqch de cohérent ».

**Les catégories n'étaient pas le problème, elles en étaient le symptôme.** 257 lignes, 193
noms distincts, réparties sur deux années. Quatre mesures ont suffi à le montrer :

- **La DRM occupe 24 lignes.** Douze pour 2025 étiquetées « Administratif », douze pour 2026
  étiquetées « Réglementaire (Douanes) ». La même obligation, tapée à la main 24 fois, sous
  deux étiquettes différentes selon l'année. C'est une règle d'une ligne.
- **Les jours fériés y sont deux fois**, sous « Jour férié » et sous « Marketing (calendrier
  national) ».
- **Les 43 journées mondiales sont toutes en 2025**, zéro en 2026. Cette famille était déjà
  morte, et personne ne l'avait vu.
- **Le calendrier lunaire, 55 lignes**, les quatre phases tapées mois par mois pour 2026.

La taxonomie avait dérivé entre deux années parce que la base est retapée chaque année. Vingt-
neuf étiquettes ne sont pas maintenables, et la base le prouvait elle-même.

### Cinq familles, choisies sur ce que le vigneron en fait

Obligations (ça coûte une amende), Travaux (ce que je fais dehors), Rendez-vous (je m'inscris,
je me déplace), Temps forts (ce que je poste et ce que je vends), et le Fond de carte, qui
n'est pas une famille. Chacune répond à une question différente, donc un filtre dessus sert à
quelque chose. 29 étiquettes vers 5, et surtout 257 lignes à retaper chaque année vers 56.

### Le fond de carte se calcule, il ne se liste pas

Décision de Ted : lune, saisons et jours fériés en fond de grille, non cochables.

`bdv-almanach.js` : Meeus chapitre 49 pour les phases, chapitre 27 pour les saisons,
l'algorithme grégorien anonyme pour Pâques et ce qui en découle. **Validé avant d'être livré**,
contre les 50 phases de 2026 de la base Notion : 50 sur 50 au bon jour en heure locale.

**Et la cinquantième a donné raison au calcul contre la donnée.** La ligne Notion date la
pleine lune de juin 2026 du 29 ; le calcul dit le 30 à 01 h 57 heure de Paris, parce qu'elle
tombe à 23 h 57 en temps universel. La ligne était étiquetée « calendrier lunaire, Paris ».
C'est la donnée qui était fausse, et rien ne l'aurait jamais signalé.

Les saisons tombent à 6 à 13 minutes des éphémérides de référence, donc toujours au bon jour.
Pâques, l'Ascension et le lundi de Pentecôte sont exacts sur 2025, 2026 et 2027.

### Ce que le modèle a gagné, et ce qu'il n'a pas gagné

Trois champs : `famille`, `statut` (obligation ou repère), et `duree` en jours dans la
récurrence.

**Le plan prévoyait deux types de récurrence de plus, et aucun des deux n'a été écrit.**
`annuel-periode` n'existe pas : une période annuelle, c'est `annuel` avec une durée, et deux
types pour la même chose auraient donné deux chemins de code à garder d'accord. `hebdomadaire`
n'a aucun usage dans la bibliothèque. Le lot 2 était annoncé plus gros qu'il ne l'était.

**Une occurrence commencée mais pas finie est « la prochaine ».** Sans cette règle, un vigneron
qui ouvre son bureau le 15 janvier, en pleine taille, lit « Taille de la vigne, dans 320
jours ». La réponse juste est « en ce moment », et elle passe devant tout le reste.

### Quatre couleurs de série, mesurées avant d'être choisies

`CLAUDE.md` promettait huit tokens `--serie-1` à `--serie-8` depuis des semaines. Ils
n'existaient pas dans `tokens.css`. Quatre ont été créés, un par famille, **séparés en
luminance et pas seulement en teinte** : écart minimum 11,8 en vision normale et 11,2 en
simulation deutéranope, donc distinguables en niveaux de gris et pour un daltonien.

La quatrième, l'ocre, passe tout juste le seuil de 3:1 des objets graphiques sur
`--paper-light` et tombe à 2,3:1 sur `--paper-deep`. **C'est ce qui a décidé que le fond d'une
pastille de famille est `--paper-light` et rien d'autre**, y compris sous un bandeau. Une
décision de dessin prise par le calcul, contre ce que j'allais écrire.

### Deux défauts que seule la capture a montrés, encore

Ni la charte ni le banc n'en ont vu un seul.

1. **Les bandeaux ne se raccordaient pas.** Un intitulé faisait 19 px de haut, sa continuation
   4. Une période de soixante jours se lisait comme cinq rangées de rayures grises. La hauteur
   est maintenant figée pour les deux états, et la forme distingue les deux natures sans
   couleur : un jour porte un liseré à gauche, une période porte un soulignement qui court.
2. **La vue année était entièrement noire.** La taille, les travaux en vert, les vendanges et
   la vinification couvrent dix mois sur douze : en remplissant chaque jour traversé, l'année
   ne disait plus rien du tout, ce qui est exactement l'inverse de ce que cette vue existe
   pour faire. Un jour est plein quand quelque chose y **tombe** ; une période le **souligne**.

### La page publique

La phrase sur le report au jour ouvré est retirée, sur décision de Ted. Elle promettait un
calcul que le code ne fait pas.

Et la page ne montre plus que les **obligations**, ce qui est la promesse de son titre. Y
déverser les travaux, les salons et les temps forts en aurait fait une page longue qui ne
tient plus son titre, et aurait retiré au Bureau la seule chose qu'il offre de plus.

### Ce qui reste

Lot 3, les occurrences du vigneron et l'activation par compte. Lot 4, l'abonnement agenda.
Lot 5, le remplissage de la bibliothèque : 56 rendez-vous datés par an, et une soixantaine de
temps forts qui deviennent des règles annuelles. La table de correspondance des 29 étiquettes
Notion vers les 4 familles est dans `PLAN_calendrier.md`.

`npm run verif` : conforme, 244 contrôles au vert, 0 échec.

---

## 08/09/2026, fin de journée. Quatre défauts des réglages, quatre causes

Ted : « tu dois réparer la fonction réglages. Je viens de supprimer ma base, j'ai désactivé /
activé la coche Vitisoft pour voir les différences. » Quatre symptômes : les tableaux ne se
mettent pas à jour seuls, le sous-main doit disparaître, impossible de remettre la base, et les
messages de calcul passent derrière la modale.

**Quatre symptômes, quatre causes indépendantes.** Aucune n'était « la fonction réglages ». Et la
plus grosse n'avait rien à voir avec la coche Vitisoft : elle était là depuis la fusion du 07/09,
à *chaque* ouverture des réglages depuis le bureau.

### 1. « Ma base » était vide en permanence au bureau

`monterMoteur()` n'était appelé que depuis `construire()`. Au tableau de bord ça suffit, le
moteur part avec la page. Au bureau il arrive *après* le panneau, et plus personne ne rangeait
les deux blocs. `renderBase()` écrivait donc bien sa zone de dépôt, mais dans le `p-base` de la
coque des écrans de vente, resté `hidden` dans un conteneur masqué. Aucune erreur.

**Ce qui est instructif, c'est pourquoi le banc ne l'a pas vu** : sa section 2 charge le moteur
AVANT le panneau, l'ordre du tableau de bord et pas celui du bureau. Un banc doit reproduire
l'ordre d'arrivée de la vraie page, pas seulement ses pièces. D'où la section 3, qui monte les
deux dans l'ordre du bureau et vérifie où finit le div, pas ce qu'il contient.

### 2. L'ardoise et le sous-main gardaient leurs chiffres

Trois causes empilées. `viderBase()` effaçait les clés du moteur et oubliait celle de
`bdv-crm.js`, la seule que lisent le sous-main et l'ardoise. `peindreArdoise()` ne savait que
montrer la zone, jamais la cacher : ses deux `return` de tête sortaient sans y toucher. Et ces
zones étaient peintes au chargement de la page, puis plus jamais.

**Arbitrage demandé à Ted : quand le sous-main s'en va ?** Sa réponse : il n'existe pas si
Vitisoft est répondu « non », sinon il s'en va seulement si aucun export n'a jamais été déposé.
Un jour où tout est traité, la zone reste et dit « Rien à faire aujourd'hui. Profites-en. » On y
a ajouté une règle non demandée mais du même esprit : une lecture qui a *échoué* ne cache jamais
la zone, sinon une panne de réseau se lit « tu n'as rien à faire ».

### 3. Les messages du moteur passaient derrière la modale

`bdv-ecrans.css` n'était chargée qu'avec les écrans de vente, alors qu'elle habille les deux
seules choses que le moteur dise à l'écran. Un import lancé depuis le panneau posait donc un
bandeau **sans aucun style**, qui tombait dans le flux de la page. Et même habillé il était
dessous : le statut à 900, le voile d'attente à 1000, à égalité avec le voile du panneau.
L'échelle des couches est maintenant complète et ordonnée, et le panneau lit le jeton au lieu
d'écrire 1000 en dur.

### 4. Un drapeau qui ne savait que monter

`PAS_VITISOFT` ne redescendait jamais. D'où `adopterVitisoft()`, sur le modèle d'`adopterObjectif`.

### L'écart trouvé en chemin, et corrigé sur demande de Ted

`effacer_mes_donnees()` supprimait la **ligne entière** de `reglages` : vider sa base effaçait
donc aussi l'objectif, le mois d'exercice, les libellés et le classement. Invisible sur le poste
de celui qui clique (l'objectif reste dans son navigateur et repart en base au geste suivant),
total sur son deuxième appareil. Même forme de panne que « une écriture = une colonne ».

Ted a tranché : on corrige dans la foulée. Le SQL est dans `supabase/lot6-vider-la-base.sql`,
**à coller dans Supabase**, et tant qu'il n'est pas passé le défaut est encore en production.

### Ce qu'on s'est promis de regarder

Le report des échéances au premier jour ouvré, toujours ouvert depuis ce matin. Et le report du
constat : `banc:journee` ne vérifie aucun chiffre, seulement si une zone est visible ou cachée.
Les cinq contrôles à l'écran sur un export réel restent à faire.

---

## 08/09/2026, après-midi. Le calendrier entre dans le bureau

Ted : « on attaque la partie calendrier. L'outil doit s'intégrer comme le reste dans mon bureau.
Quand je clique sur le raccourci du bureau j'arrive ici (capture). »

**La capture montrait la page publique.** C'était le défaut, et il était plus simple que la
demande qui l'entourait : « Le calendrier » était le seul intercalaire de la barre à éjecter hors
du bureau, vers un écran sans intercalaires. Six autres pièces restaient dans le bureau, celle-là
partait. Tout le reste de la demande, les vues au choix, les occurrences à créer, la synchro
d'agenda, se construit par-dessus cette correction-là.

### Les quatre arbitrages, tranchés avant d'écrire

Détail dans `PLAN_calendrier.md`. Ce qui compte ici, c'est ce qu'ils écartent.

**1. La frontière entre « Mes tâches » et « Le calendrier » est la DATE, pas la propriété.** Ted :
« on peut le faire dans les 2. Le calendrier donnera une date début et fin obligatoire, les tâches
non pas obligatoire. » C'est mieux que ce que j'avais proposé, qui était de donner la propriété
des obligations à une seule des deux pièces.

Deux pièces qui cochent, ça ne redevient dangereux qu'à une condition : qu'elles écrivent deux
lignes. Elles écrivent la même, `ech:<clé>:<AAAA-MM-JJ>`, par une seule fonction, et
`bdv-taches.js` reste le seul fichier qui écrit dans la table des tâches. C'est la règle 7 bis de
`CLAUDE.md`.

`basculer()` n'y suffisait pas : elle cherche sa tâche dans `toutes()`, qui ne connaît que la
**prochaine** occurrence de chaque obligation. Le calendrier, lui, affiche octobre en septembre.
D'où `basculerOccurrence()`, qui construit la ligne elle-même.

**2. La synchro sera un abonnement vivant, pas un fichier téléchargé.** Une adresse secrète par
compte, relue toute seule par Google Agenda, Apple Calendrier et Outlook. Le coût est écrit dans
le plan et il n'est pas la fonction serveur : c'est que `bdv-echeances.js` est aujourd'hui une
fonction anonyme qui pose `window.BdvEcheances`, donc illisible hors d'un navigateur. Le lot 4
commencera par sortir le calcul dans un module partagé, sinon on recopie le calcul côté serveur et
on retombe exactement dans ce que l'en-tête de ce fichier interdit depuis le premier jour.

**3. La bibliothèque ira jusqu'au commercial.** Ce qui ouvre une collision avec le sous-main, qui
sait repousser un rappel de 30, 7 ou 60 jours. La ligne à tenir : le calendrier porte des
**campagnes**, le sous-main porte des **clients**. Le jour où le calendrier nomme un client, le
doublon de la règle 7 est de retour.

**4. La page publique ne bouge pas.** Elle reste en liste, gratuite, sans compte. Le calendrier
devient donc le premier objet du site à vivre à deux endroits, et l'exception est écrite dans
`CLAUDE.md` : sans ça, quelqu'un la « corrigera » de bonne foi en appliquant la règle du dessus.

### L'affichage : trois vues, et la quatrième écartée

Ted : « à toi de me trouver la meilleure option. »

**La vue mois n'était pas défendable avant l'arbitrage 3, et je l'ai proposée quand même parce que
cet arbitrage la rendait défendable.** Avec cinq échéances par an, une grille de mois est vide
vingt-huit jours sur trente et un, et une grille vide dit « cet outil ne sert à rien ». Avec la
bibliothèque complète, un vigneron aura trois à huit choses par mois. C'est ce qui la fait tenir.
Si l'arbitrage 3 tombe, cette vue tombe avec.

Son défaut propre est réglé sous la grille et pas dans la case : une case de mois fait cent pixels
de large, elle ne porte pas un intitulé, un public et une source. Le détail complet est en liste
sous la grille, la case ne fait que dire qu'il y a quelque chose.

**La vue année est celle qui vend l'outil.** Douze mini-mois, un point par occurrence. La DRM du
10 de chaque mois s'y lit d'un coup d'œil, ce qu'aucune autre vue ne montre.

**La semaine est écartée, et pas faute de temps.** Un agenda de semaine est une grille d'heures.
Aucune occurrence de ce calendrier n'en porte, et ce serait un emploi du temps vide.

### Trois défauts que seule la capture a montrés

Aucun n'a fait échouer la charte ni le banc. Le harnais est celui du 07/09/2026 : monter le module
en jsdom sur le vrai dépôt, assembler une page avec les vraies feuilles, capturer avec Playwright.

1. **La zone s'écrasait sur quarante pixels.** `.bureau-plan` est une grille de douze colonnes et
   ma zone n'en demandait aucune. Corrigé, mais surtout **déplacé** : la règle est dans
   `style.css` et pas dans la feuille de la pièce, parce que `seule()` montre le conteneur AVANT
   que la feuille chargée au clic soit posée. Dans la feuille de la pièce, la zone se serait
   écrasée pendant tout le chargement.
2. **Une barre de défilement apparaissait pour six pixels d'ombre.** `--ombre-dure` déborde du
   tableau, le cadre en `overflow-x: auto` croyait déborder. Le retrait à droite et en bas n'est
   pas de l'espacement, c'est la place de l'ombre.
3. **« Lire l'articleSource : Douane »**, en un seul mot. La page publique joint ses liens par
   « · » dans une chaîne HTML ; en construisant les nœuds un par un pour respecter la règle du
   bureau, on perd le séparateur sans rien casser.

### Un écart de contenu, signalé et pas corrigé

La page publique promet qu'« un dépôt qui tombe un samedi, un dimanche ou un jour férié se reporte
au premier jour ouvré suivant ». `prochaine()` ne le fait pas. La page promet un calcul que le
code ne fait pas. Soit on écrit le report, soit on retire la phrase ; laisser les deux est le pire
des trois états. À trancher au lot 2, c'est noté dans `CLAUDE.md`.

### Un défaut ancien réparé en passant

`lireAdresse()` n'acceptait comme adresse que les quatre pièces de vente, celles qui portent
`viti`. Un favori sur `/mon-bureau/#taches` ouvrait donc « Ma journée », sans erreur et sans que
personne ne comprenne pourquoi. Le filtre porte maintenant sur toutes les pièces sauf le panneau
de réglages, qui n'est pas une destination. `#echeances` reste un alias du calendrier, pour les
favoris déjà posés.

### Ce qui reste

Les lots 2 à 5 sont dans `PLAN_calendrier.md` : le modèle à deux dates et la bibliothèque, les
occurrences du vigneron, l'abonnement agenda, puis le paquet d'occurrences prêtes, qui est du
travail d'édition et peut avancer en parallèle.

`npm run verif` : conforme, 90 contrôles au banc du bureau, 0 échec.

---

## 08/09/2026, matin. « Ça tourne fluide et ça monte en puissance ? » — mesuré, puis corrigé

Ted : « peut-on optimiser la base pour que ça tourne de façon fluide et permette une
montée en puissance ? »

**La base n'était pas le sujet, et c'est la première chose que la mesure a dite.** Postgres
rend une page de 1 000 lignes en 87 ms. Ce qui coûtait, c'était de faire traverser ces
lignes au réseau à chaque premier clic.

### La courbe, avant

Vrai navigateur, site construit, faux Supabase, trois volumes :

| Lignes | 1er clic, appareil neuf | Transféré | 1er clic, base déjà locale | Bascules |
|---|---|---|---|---|
| 4 939 | 1,9 s | 1,8 Mo | 0,9 s | 23 à 121 ms |
| 15 000 | 4,4 s | 5,5 Mo | 1,3 s | 33 à 291 ms |
| 40 000 | 11,7 s | 14,7 Mo | 2,9 s | 23 à 57 ms |

Sans latence réseau dans la mesure : sur la 4G d'un domaine, 14,7 Mo c'est une minute.

**Le résultat rassurant, et il est structurel** : les bascules entre pièces restent entre
23 et 291 ms quel que soit le volume. Le modèle « tout en mémoire dans le navigateur »
tient jusqu'à 40 000 lignes. Il n'y avait pas d'architecture à refaire, et c'est ce qui a
permis de ne toucher qu'un fichier.

### Les deux corrections, et la ligne qu'elles ne franchissent pas

**On compte avant de lire.** Le compteur passe par `Content-Range`, il ne rapatrie aucune
donnée. Autant de lignes ici que sur le compte, il n'y a rien à aller chercher.

**Au moindre doute, rapatriement complet.** C'est la moitié du travail et tout l'enjeu :
la règle écrite dans cette boucle est qu'elle n'a pas le droit de deviner, après la panne
où la base de Ted était restée bloquée à 500 lignes sur 4 942. Compteur illisible,
appelant qui ne sait pas ce qu'il a, écart dans un sens ou dans l'autre : on lit tout.
Cinq contrôles du banc ne gardent que ça.

**Pagination par curseur.** Le plan d'exécution le disait sans ambiguïté : pour rendre la
5e page, `offset 4000` parcourait les 4 939 lignes, 4 998 blocs, 87 ms. Avec
`empreinte > la dernière reçue` : 3 blocs, 0,9 ms, et les deux conditions dans l'Index
Cond. Le coût par page devient constant au lieu de croître avec le volume.

Le journal d'échanges garde son décalage, volontairement : son tri est une date, que deux
entrées du même jour partagent. Un curseur sur une clé non unique saute des lignes en
silence, ce qui est bien pire que de relire quelques pages.

### La mesure après

| | Avant | Après |
|---|---|---|
| 4 939 lignes, le lendemain | 1 416 ms · 1 807 ko | **716 ms · 0 ko** |
| 40 000 lignes, le lendemain | — | **2 831 ms · 0 ko** |

Le premier import sur un appareil neuf ne bouge pas, et ne peut pas bouger : il faut bien
descendre la base une fois.

### Côté base

`ventes` portait 11 878 réécritures de lignes pour 4 939 lignes vivantes, et **zéro en
mode économique**. Une ligne fait 458 octets, une page 8 ko : à remplissage 100 %, une
page est pleine et une mise à jour doit en écrire une autre, plus les deux index.
`fillfactor = 90` laisse la place. Appliqué en base et consigné en section 15 de
`schema.sql`. Ne s'applique qu'aux pages écrites ensuite, il n'y a rien à forcer.

### Ce qui a été écarté, et pourquoi je l'écris

**Les 28 avertissements RLS de Supabase** (un appel de fonction réévalué par ligne) sont
réels dans l'absolu. Mesuré sur la requête de cet outil, le planificateur remonte déjà
l'appel dans la condition d'index : 0,128 ms. Un gain non constaté ne se vend pas. À
corriger un jour par propreté.

**Ne pousser que les lignes nouvelles à l'import** était le troisième item annoncé. Écarté
après lecture : `resolution=merge-duplicates` existe précisément pour qu'un export plus
récent enrichisse une ligne déjà connue (les colonnes e-mail d'août 2026). Ne pousser que
les empreintes inconnues supprimerait cet enrichissement. Le sujet reste ouvert, il
demande que `dbAddMany` dise ce qu'il a enrichi.

### Le chiffre pour le plan, pas pour le code

458 octets par ligne. 500 vignerons × 5 000 lignes = 2,5 M lignes = **1,1 Go**. Palier
gratuit Supabase 500 Mo, Pro 8 Go : le stockage n'est pas un mur avant plusieurs milliers
de clients. Le mur est le navigateur, vers 100 000 lignes — un vigneron n'y arrive pas, un
négociant si.

---

## 07/09/2026, nuit. Le bandeau nettoyé, et « Mes tâches »

Ted, sur une capture : « ça c'est pas beau. Le liseré gris autour, et l'hamburger, aucun
style. L'hamburger sert à ranger le bandeau, c'est nul. » Puis, dans le même message :
« il faut créer aussi un nouvel onglet : mes tâches. »

Trois décisions ont été prises AVANT d'écrire une ligne, et c'est la seule façon dont
celle-ci pouvait bien se passer.

### Le liseré et le hamburger : deux suppressions, pas deux redessins

Le liseré était le fond `--paper-deep` de `.bureau-nav`, plus un trait d'encre en haut de
la pile et un retrait à gauche. Il est parti en entier. Les intercalaires sortent
maintenant directement du papier de la page, comme les onglets d'un vrai classeur
dépassent de la feuille au lieu d'être posés sur une plaque.

Le bouton de repli est parti aussi : bouton, raccourci clavier, préférence
`bdv_volet_replie` et classe `--replie`. Motif, qui vaut pour tout bouton qu'on serait
tenté d'ajouter là : **personne ne clique pour gagner 170 pixels sur un écran qui en a
1670.** La largeur décide seule, en CSS : intercalaires complets, icônes seules sous
1180 px, barre horizontale sous 901 px. Il n'y a plus d'état à garder.

Une finition trouvée sur la capture et par rien d'autre : à 58 px, la pointe de la
languette mange la moitié de l'intercalaire et se fait couper au bord de la colonne, ce
qui donne une flèche tronquée. Étroit, les languettes sont franches.

### « Mes tâches » : le vrai risque du message, et l'arbitrage

Le bureau avait déjà TROIS endroits qui répondent « qu'est-ce que je dois faire » : le
sous-main (qui rappeler), le calendrier (DRM, DAI, récolte) et le panneau de post-it. Un
quatrième sans périmètre, et plus personne ne sait lequel dit vrai. Question posée à Ted,
trois options ; il a tranché : **les tâches écrites plus les obligations cochables, les
clients restent au sous-main.**

Le motif de cette frontière est écrit en règle 7 de `CLAUDE.md` : le sous-main repousse un
rappel de 30, 7 ou 60 jours selon le geste posé, une case à cocher ne sait pas faire ça.

**Les obligations ne sont pas stockées.** Elles sont calculées dans le navigateur par
`bdv-echeances.js`. Ce que la base porte, ce sont celles qui ont été cochées, et
l'occurrence est DANS l'identifiant : `ech:drm:2026-09-10`. Ce qui est fait, ce n'est pas
« la DRM », c'est la DRM du 10 septembre, et celle d'octobre arrive vierge toute seule,
sans tâche planifiée ni calcul côté serveur. Décocher une obligation supprime la ligne :
une obligation pas encore faite est l'état par défaut du monde, il n'y a rien à stocker
pour le dire.

Le second arbitrage, plus discret : la saisie du panneau n'écrit pas à travers un moteur.
`bdv-taches.js` fait 12 ko et part avec la page, donc la pièce n'a **rien** à charger au
clic, contrairement aux écrans de vente. Pas de voile d'attente, pas de retour en arrière
à prévoir.

### Le liège reçoit trois punaises, pas la liste entière

Ted voulait que les tâches alimentent les post-it. Elles passent devant les indicateurs :
un panneau qui annonce « 4 clients dans ton carnet » au-dessus d'une DRM qui tombe demain
a le bon contenu dans le mauvais ordre. Mais **trois au plus**, plus une punaise de
renvoi : un panneau de liège où l'on épingle tout n'est plus un panneau, c'est un mur.

Et `window.bdvMajPanneau` a été exposé pour que les tâches, qui arrivent du serveur après
le premier rendu, rappellent le liège. Sans ça une DRM qui tombe demain n'apparaissait au
panneau qu'au rechargement suivant. Même motif que `window.bdvMajBandeau` pour la pastille
des signets : c'est la donnée qui rappelle l'écran, jamais l'écran qui interroge en boucle.

### Ce qui a été vérifié

`scripts/banc-taches.mjs`, 38 contrôles, ajouté à `npm run verif`. Il ne regarde aucun
écran : il vérifie la charge envoyée pour chaque geste, y compris qu'une suppression en
file d'attente se rejoue en suppression et pas en écriture vide, et que la file ne garde
jamais l'identifiant de compte. Table `taches` créée en base par la migration
`lot5_taches`, RLS active, quatre politiques, `anon` sans aucun droit, zéro ligne.

Deux défauts trouvés par la CAPTURE et par rien d'autre, ce qui confirme la règle du
06/09 : le bouton « Ajouter » était en `btn--ghost`, dessiné pour un fond sombre, donc
illisible sur le papier de la zone (même piège que `.btn--light`) ; et « Il y a 2 jours »
disait quand c'était au lieu de dire ce qu'on doit faire, devenu « En retard de 2 jours ».

### Une note d'environnement, qui change la façon de travailler ici

`npm run build` échouait depuis le shell Cowork parce qu'Eleventy doit SUPPRIMER un fichier
pour le recopier, et que la suppression était refusée sur le dossier monté. Une fois
l'autorisation demandée et accordée, le build tourne, et `npm run verif` en entier avec
lui. Ce n'était pas une limite de l'outil, c'était un droit qui manquait.

---

## 07/09/2026, nuit. Audit de fonctionnement : ce qui écrit vraiment en base

Ted a posé la seule question qui compte après une refonte : « est-on sûr que tous les
mécanismes présents avant fonctionnent, et que les actions sont bien enregistrées ? »

La réponse ne pouvait pas venir d'une relecture. Elle est venue du **compte des lignes par
table**, en une requête. `ventes` 4 939, `echanges` 6, `suivi_clients` 4, `reglages` 1 ligne
complète, `profils` 1, et `signets` **zéro**. Cinq mécanismes prouvés par des lignes datées,
un non prouvé.

**Le cadre à garder en tête : `auth.users` ne contient qu'un seul compte, le sien.** Aucun de
ces mécanismes n'a jamais été exercé sur un autre navigateur. « Ça marche » ne veut donc dire
que « ça marche chez Ted, où toutes les données sont déjà en local ». Les deux pannes trouvées
ce soir sont exactement de celles que ce poste ne peut pas montrer.

### Panne 1 : l'objectif de chiffre d'affaires pouvait s'effacer tout seul

`syncReglages()` renvoyait les QUATRE colonnes de `reglages` à chaque geste. Or le panneau
écrit `objectif` et `exercice_debut` directement en base, sans passer par le moteur. Enchaîner
« j'enregistre mon objectif » puis « je change mon mois d'exercice » repoussait donc l'ancien
objectif, celui que le moteur avait encore en mémoire, par-dessus le neuf. Sans un message.

Le même envoi, appelé par `tirerDuServeur()` au démarrage via `savePersoLabels()` alors que
`REG` n'était pas encore lu, expédiait `classement: null` : le classement du compte était
effacé à chaque ouverture. C'est probablement pour ça que la colonne était vide en base.

**Arbitrage.** Deux réparations étaient possibles : faire écrire le panneau à travers le
moteur, ou découper l'écriture du moteur. La première a été écartée, et le motif vaut d'être
retenu : le panneau doit s'ouvrir sans attendre les 83 ko du moteur, donc son bouton
« Enregistrer » ne peut pas dépendre d'un fichier pas encore arrivé. C'est le découpage qui a
été retenu : quatre fonctions, une colonne chacune, plus deux fonctions d'adoption pour que le
moteur prenne la valeur enregistrée par le panneau sans la renvoyer. Écrit en règle 6 de
`CLAUDE.md`.

### Panne 2 : sur un appareil neuf, le panneau montrait une base vide

Ouvrir les réglages chargeait le moteur mais n'appelait pas `tirerDuServeur()` : seul
`demarrerEcransVente()` le faisait. `rafraichirMoteur()` ne relisait qu'IndexedDB, et relire
une base vide ne rend rien. « Ma base » et « Le classement » annonçaient donc zéro ligne sur
un compte qui en portait 4 939.

Le rapatriement est devenu un **tirage unique par visite**, gardé par une promesse partagée
et pas par un drapeau : les deux appels peuvent se croiser, et le second doit attendre le
premier au lieu de repartir en parallèle. `TIRAGE_AJOUTS` dit au panneau s'il doit relire la
base locale, ce qui règle au passage le cas des lignes arrivées d'un autre poste.

### Corrigé au passage

« Revenir au classement automatique » n'était pas envoyé en base : les regroupements restaient
sur le compte et le prochain appareil les réappliquait. Un classement abandonné part maintenant
en `null`, et pas en `{valide:false}`, pour que le rapatriement ne le reprenne pas comme un
classement valide.

### Le banc, et la leçon de son écriture

`scripts/banc-reglages.mjs`, 27 contrôles, ajouté à `npm run verif`. Il ne regarde aucun
écran : il vérifie **la charge envoyée** au serveur pour chaque geste. C'est ce que la
relecture visuelle ne peut pas voir, et c'est là qu'étaient les deux pannes, comme pour les
signets le matin même.

Deux pièges rencontrés en l'écrivant, tous les deux du même genre, celui d'un banc qui
condamne du code correct :

- **Deux `eval` séparés ne partagent pas les `let` de premier niveau**, alors que deux
  `<script>` classiques d'une même page, si. Chargé fichier par fichier, le banc déclarait
  `ROWS` et `TIRAGE_AJOUTS` introuvables et annonçait une panne inexistante. Les fichiers sont
  donc posés comme de vrais `<script>` (`runScripts: 'dangerously'`).
- **Le décor doit porter `#statusTxt` et `#statusSpin`**, pas seulement `#status` : sans eux
  `status()` lève et emporte le rapatriement entier, ce qui ressemble à s'y méprendre à un bug
  du rapatriement.

Vérification négative faite, parce qu'un banc qui n'a jamais échoué ne prouve rien : remis sur
l'ancien moteur, il sort en code 1.

### Reste ouvert

- **Les signets n'ont toujours aucune ligne en base.** Le correctif du matin est bien poussé,
  mais rien ne prouve qu'il passe : il faut un clic sur « Mettre de côté », puis un comptage.
- Le PATCH de `suivi_clients` dans `bdv-crm.js` filtre encore sur `client_id` seul et dépend
  de RLS pour être juste.
- `BdvSync.supprimerEchange` et `BdvSync.compterVentes` n'ont plus aucun appelant.

---

## 07/09/2026, en soirée. Deux bugs signalés par Ted, deux causes sans aucun rapport

Ted a signalé deux symptômes dans le même message : une entrée du journal qui naît
« corrigée », et la fiche client qui ne s'ouvre plus depuis « Mes clients ». Rien ne les
relie, et c'est le seul enseignement de la soirée qui vaut d'être retenu : deux symptômes
arrivés ensemble ne sont pas un indice de cause commune.

**Le faux « corrigé » : un défaut de colonne qui gagnait contre le navigateur.**
`echanges.maj_le` porte `default now()` en base. Les quatre endroits qui créent une entrée
envoyaient `le` et laissaient `maj_le` au défaut : la base l'horodatait donc à l'ARRIVÉE de
la requête. Mesuré sur les trois entrées touchées en production : 88, 111 et 278
millisecondes d'écart. L'écran, lui, fait exactement ce qu'on lui a demandé, il affiche
« corrigé le » dès que les deux dates diffèrent. Le règle de mémoire du 06/09 le disait
déjà — *maj_le est posé égal à `le` à l'écriture* — mais elle n'était appliquée nulle part,
parce qu'à l'époque seule la correction écrivait cette colonne.

Arbitrage : la correction est du côté de l'ÉCRITURE, aux quatre points d'entrée, et pas du
côté de l'affichage. On aurait pu tolérer un écart d'une seconde à la comparaison, c'était
plus court et c'était un mensonge : le journal aurait affirmé qu'une ligne n'a pas bougé
sans le savoir. Levier à retester si le faux « corrigé » revient : chercher un cinquième
point d'écriture avant d'accuser l'écran.

Corollaire trouvé en passant : `supabase/schema.sql` ne déclarait pas `maj_le` du tout. La
colonne avait été posée à la main en base le 06/09. Une base recréée depuis ce fichier
aurait refusé toute écriture d'échange dès ce soir, PostgREST ne connaissant pas la colonne.
Elle y est, avec son `add column if not exists` pour les bases déjà en place.

**La fiche client : un sélecteur descendant qui ne pouvait pas atteindre son propre porteur.**
`.bdv-ventes .modale.on{display:block}`. Or `#modale` PORTE `.bdv-ventes` — c'est l'un des
quatre éléments « hors page » qui la portent eux-mêmes, par construction, depuis le scope du
lot 2c. Un sélecteur descendant ne matche jamais son porteur : la fiche restait à
`display:none`, et le clic depuis « Mes clients » n'ouvrait rien du tout, sans une erreur,
sans un message dans la console.

Le même défaut frappait quatre autres règles que personne n'avait signalées, et qui étaient
muettes par nature : les trois états de `.status` (donc **plus aucun message d'erreur, de
chargement ni de succès dans les écrans de vente**) et `#busyov.on`, le voile d'attente de
l'import. Un bug qui supprime les messages d'erreur ne se plaint pas.

Les cinq règles sont recollées à leur porteur (`.bdv-ventes.modale.on`, sans espace) : même
élément, scope conservé, et `npm run charte` reste conforme **sans exception nouvelle** —
c'est ce qui a fait préférer cette forme à l'ajout des cinq sélecteurs dans
`SCOPE_EXCEPTIONS`. Une exception nommée en plus, c'est une règle de moins sous contrôle.

**Ce qui a été vérifié.** `npm run verif` : charte conforme, 76 contrôles du banc passés. Et
la seule vérification qui prouvait vraiment quelque chose : la feuille réelle chargée dans
un Chromium, sur le DOM réel des quatre éléments, avant et après. Avant : `modale: none`,
`status: none`, `busyov: none`. Après : `block`, `flex`, `flex`. Aucun contrôle du dépôt
n'attrapait ça, et aucun ne l'attrapera : la charte lit des sélecteurs, elle ne les fait pas
matcher. C'est un candidat pour le banc — un contrôle qui, pour chaque règle portée par
`.bdv-ventes`, vérifie que le premier bloc du sélecteur n'est pas l'un des quatre porteurs.

**Reste ouvert.** Trois entrées en base portent encore leur faux `maj_le` ; le SQL de
réparation est donné à Ted, borné à un écart de moins de cinq secondes pour ne pas effacer
une correction réelle. Et un vrai défaut de date, trouvé en chemin et pas corrigé ce soir :
un geste posé hors réseau met en attente `{cle, id, eid}` sans sa date, donc `bdv-crm.js`
refabrique `le` au moment du REJEU. Un appel passé mardi dans une cave sans réseau est daté
du jeudi où le navigateur a retrouvé du signal. Trois lignes à changer, mais c'est une
correction à part : elle touche la date de ce qui s'est passé, pas son affichage.

---

## 07/09/2026, tard. L'audit responsive : ce que la capture de Ted a révélé

Ted a envoyé une capture de son bureau en production avec une phrase juste : « il y a des
détails bizarres ». Il y en avait, et le principal était grave.

**Le listing du sous-main débordait de sa zone à TOUTES les largeurs, de 320 à 1920 px**, de
87 px hors de la zone et de 112 px hors du papier, et la page défilait à l'horizontale sur
cinq des quinze largeurs testées. Cause : j'avais dimensionné la colonne des gestes avec des
libellés de test courts (« Appelé / Message / Note ») alors que les vrais font 306 px à eux
trois (« Appelé / Laissé un message / Pas maintenant »).

**La leçon de fond, et elle vaut plus que la correction.** La largeur de la fenêtre ne dit
rien de la place disponible. Mesuré : la zone du sous-main fait 722 px sur une fenêtre de
1024 et 728 px sur une fenêtre de 1280. Presque rien ne les sépare, parce que la barre des
pièces prend 230 px et que l'atelier est plafonné. Tous mes points de rupture étaient donc
posés sur la mauvaise grandeur. La zone porte maintenant `container-type: inline-size` et le
listing bascule sur une requête de conteneur. Deux pièges vérifiés à la mesure : une requête
de conteneur compare la boîte de CONTENU, et une largeur en `em` se calcule sur le corps de
l'élément qui la porte, donc dix pixels sur un en-tête en `--t-micro`.

**Le budget de colonnes, mesuré au lieu d'estimé.** Cinq colonnes plus trois boutons à
libellé complet demandent 858 px ; le tableau n'en fait jamais plus de 934 et tombe à 640.
Trois décisions en découlent, chacune adossée à un nombre : les boutons portent un mot court
avec leur nom complet en `title` et `aria-label`, la référence passe sous le nom où elle ne
coûte aucun pixel de largeur puisque la rangée a déjà 44 px de plancher tactile, et le
montant sort du motif pour avoir sa colonne de nombres alignés à droite, ce qui est l'idiome
même d'un listing. **Aucune des cinq informations que Ted a dictées n'a été perdue.**

**Deux autres défauts trouvés en auditant, et personne ne les cherchait.**

Le contrôle de contraste de la charte ne vérifiait que les paires qu'on avait pensé à lui
déclarer. C'est ce trou qui a laissé passer, le matin même, un bandeau de mois en crème sur
`--danger` à 4,00:1 pour du texte de dix pixels qui en demande 4,50. Le contrôle **6 bis**
ne demande plus rien : il parcourt la feuille et prend chaque règle qui pose une encre ET un
fond en jetons. Il a trouvé du premier coup un bouton crème sur crème, 1:1, dans DEUX
feuilles, invisible seulement parce qu'une règle plus spécifique le recouvrait. Une rustine
qui masque un défaut le garde en vie : la source est corrigée, la rustine est partie.

L'anneau de focus de la barre était resté crème, choisi quand la barre était sombre. Sur le
carton kraft il donne 2,36:1, sous le seuil de 3:1 des indicateurs de focus : il ne se voyait
plus. Et dans le listing, l'anneau posé à trois pixels dehors voyait ses segments haut et bas
tomber pile sur les filets de la rangée. Les deux sont corrigés et vérifiés en posant le
focus au clavier dans un vrai navigateur, puis en LISANT la couleur calculée. À l'œil, sur
une capture, un anneau pâle se voit encore un peu.

**Trois détails de mise en page, tous vus à la mesure.** Le panneau donnait quatre colonnes
pour cinq post-it sur un portable de 1280, donc une deuxième rangée avec un post-it seul et
trois cases de liège nu ; le minimum passe de 190 à 160 px et les cinq tiennent. La liste des
échéances suivantes du calendrier faisait tomber « DAI, déclaration annuelle d'inventaire »
sur QUATRE lignes de 87 px dans une zone de 227 ; la date passe au-dessus du libellé, et à
côté dès qu'il y a la place, ce que dit la zone et pas la fenêtre. Et le sous-main passe de
huit colonnes sur douze à neuf, décidé par la mesure et non par le goût.

**Il reste un seul texte coupé** dans tout le bureau, à toutes les largeurs : un nom de
client de 33 caractères, avec ses points de suspension et son infobulle. C'est voulu.

Le banc passe de 73 à 76 contrôles. Le contrôle 6 bis et le plafond de tailles ont été
vérifiés en réinjectant une faute : les deux font passer le verdict à NON CONFORME.

---

## 07/09/2026, soir. La refonte de Ma journée : le bureau devient un plateau

Ted a dicté cinq points après avoir regardé les planches : les post-it comme une to-do
libre, le sous-main en design « beaucoup plus informatique parce que ça va parler de
fichiers clients », le calendrier à droite du sous-main, l'ardoise en dessous avec des KPI
redéfinissables, puis à lire / le classeur / le courrier, « chaque item aura son design qui
va avec », et la barre de gauche en « design papier intercalaire ».

**Ce qui a été fait, dans cet ordre, et pourquoi cet ordre.**

D'abord le garde-fou, avant le dessin. `charte.mjs` collectait les couleurs en dur, les
affichait, et ne passait jamais le résultat à `ko()` : une couleur magenta de test restait
CONFORME. Poser six matières derrière un contrôle qui ne mord pas n'avait pas de sens. Les
couleurs en dur font maintenant échouer, avec deux dispenses écrites et comptées, les
maquettes produit tierces et les textures de matière. Les `font-size` en dur ont un plafond
au lieu d'une porte fermée, parce que 95 valeurs ne se reprennent pas en une passe : le
plafond ne doit jamais remonter, et il a déjà baissé d'un cran.

Puis dix-sept jetons de matière et **la règle du plateau**, écrite noir sur blanc dans la
feuille et dans `CLAUDE.md` : un plateau, une lumière, deux ombres. C'est elle qui empêche
le liège, le papier continu, l'ardoise, le carton et l'enveloppe de faire brocante.

Puis les intercalaires, le plateau réordonné, le sous-main en listing, le calendrier à la
place du pense-bête, l'ardoise en ardoise, et les trois objets du bas.

**Ce que la mesure a corrigé dans mon propre dessin, trois fois.**

La planche des intercalaires proposait trois profondeurs de carton. Mesuré : 5,86:1 puis
4,89:1 puis 4,09:1 avec `--ardoise` pour encre. Le troisième échoue AA. Un seul ton de
carton donc, et la profondeur se dit par le filet d'ombre entre les languettes, ce qui est
d'ailleurs plus juste. Le gold a quitté la barre, 1,19:1 sur du kraft, et le bordeaux a
quitté l'ardoise pour la même raison dans l'autre sens : les deux couleurs ont échangé
leurs places, chacune là où elle se lit.

**Le doublon que l'ordre de Ted a réglé sans qu'il l'ait cherché.** Le pense-bête et le
compte à rebours disaient la même chose à deux endroits de la même page. En mettant le
calendrier à la place du pense-bête, le doublon disparaît. C'est la meilleure raison de ce
déplacement, meilleure que l'esthétique.

**Le nom.** Ted voulait « calendrier éditorial ». Refusé et expliqué : l'objet porte cinq
échéances réglementaires avec leurs sources officielles, personne ne cherche sa DRM sous un
nom de planification de contenu, et le jour où il voudra un vrai calendrier de publications
le nom serait pris. Renommé « Le calendrier » dans le bureau et « Le calendrier
réglementaire » sur la page publique. **Ce dernier point est en attente de sa réponse** :
la page est indexée et « compte à rebours réglementaire » est une expression qu'on tape.

**Cinq défauts réels trouvés en chemin, dont quatre étaient les miens.**

- Deux du dépôt : la ligne du sous-main était un `<button>` contenant trois `<button>`, et
  une ligne traitée recevait `pointer-events: none`, qui n'arrête que la souris, si bien
  qu'au clavier deux Entrée posaient deux gestes.
- Un du dépôt, trouvé en faisant tourner le bureau dans un vrai navigateur avec un réseau
  qui répond n'importe quoi : `bdv-crm.js` testait la vérité de la réponse serveur et non
  son type. Un objet au lieu d'un tableau, et `suivi.map` levait, ce qui arrêtait TOUTE la
  peinture : plus d'ardoise, plus de sous-main, un bureau vide sans un mot.
- Trois à moi, tous invisibles à la charte : un commentaire ouvert qui a avalé le bloc
  `.btn--geste` en entier, deux grilles séparées pour l'en-tête et les lignes du listing,
  et `display: block` sur ce qui était en fait une cellule de tableau. Les trois sont
  documentés dans `CLAUDE.md`, et le premier a maintenant son contrôle de charte.

**Ce qui reste, et ce n'est pas du dessin.** Trois chantiers fonctionnels que la refonte
prépare mais ne fait pas : la to-do libre des post-it a besoin d'un endroit où vivre, les
quatre chiffres de l'ardoise à choisir demandent un réglage à enregistrer, et le calendrier
des dates propres à Ted est le chantier 1 de la feuille de route. Le dessin tient sans eux.

Le banc passe de 65 à 73 contrôles : l'ordre des zones, la disparition du pense-bête, la
rangée de tableau, l'en-tête de colonnes, les cinq colonnes, la désactivation des boutons
après un geste, et la garde de type sur la réponse serveur.

---

## Session du 07/09/2026, fin d'après-midi : le bureau s'ouvre avec 32 ko au lieu de 125

Suite immédiate de la fusion, et c'est elle qui a rendu le problème visible. En sortant les
écrans de vente du chargement initial, on a mesuré ce qui restait : **398 ko à l'ouverture
de `/mon-bureau/`, dont 125 ko de JavaScript bloquant**, sur une page qui affiche « Ma
journée ».

Le moteur de la base, `bdv-base.js`, pesait 83 ko de ces 125, plus PapaParse en CDN. Or
« Ma journée » ne s'en sert pas : ses chiffres viennent du serveur par `bdv-crm.js`.

### La vérification qui compte, et pourquoi elle ne pouvait pas se faire au jugé

Retirer un fichier dont 161 variables globales sont visibles par tout le reste de la page
ne se décide pas à l'intuition. La méthode : extraire les 161 noms, puis chercher chacun
dans les six modules chargés au bureau et dans le script de la page.

Six noms ressortaient comme des dépendances possibles : `GESTES`, `CANAUX`, `dansNJours`,
`geste`, `objectif`, `signal`. **Les six étaient des faux positifs** : des constantes
redéclarées localement dans leur propre module, une chaîne de caractères `source: 'signal'`,
un nom de classe CSS `btn--geste`, un attribut `data-geste`. Le seul vrai lien était
`exMot()`, pour deux mots dans un libellé de la barre.

Conclusion inverse de l'intuition, et impossible à obtenir sans la lister.

### Deux mots qui coûtaient 83 ko

Le libellé de la deuxième pièce dit « Mon année » ou « Mon exercice » selon l'exercice
comptable du domaine, ce que `exMot()` sait et lui seul. C'était la seule raison de charger
le moteur à l'ouverture.

La clé de navigateur qu'il lit, `bdv_exercice_v1`, est maintenant lue aussi par
`bdv-nav.js`. **Une constante dupliquée, assumée et documentée des deux côtés** : la changer
d'un seul côté ferait dire « Mon exercice » à un domaine en année civile, sans erreur et
sans que personne ne le remarque. Le même piège que `HASH_COLS`, en beaucoup moins grave.
`exMot()` garde la priorité dès qu'il existe : le jour où le moteur change de façon de
décider, c'est lui qui a raison.

### Le banc a trouvé la deuxième panne de la journée

Trois boutons ouvrent le panneau de réglages : celui de la barre, celui de l'entête du
bureau, et l'adresse `#base`. Chacun appelait le module directement, ce qui allait très bien
tant que le moteur était déjà là.

Le banc l'a attrapé dans l'heure : **le bouton de la barre ouvrait le panneau sans demander
le moteur**, et « Ma base » comme « Le classement » restaient vides. Vides sans erreur, sans
message, et pour la seule raison qu'on avait cliqué sur un bouton plutôt que sur un autre.

Il y a donc maintenant UNE fonction, `BdvNav.ouvrirReglages()`, et les trois boutons passent
par elle. Le contrôle qui a trouvé la panne est resté dans le banc.

### Le résultat

`163 ko` de JavaScript local à l'ouverture au lieu de 398, dont `32 ko` bloquants au lieu de
125, et une requête de CDN en moins. Vérifié dans un vrai navigateur : à l'ouverture, ni le
moteur ni PapaParse ne sont demandés ; au clic sur « Mes réglages », le panneau apparaît
avec ses cinq onglets puis PapaParse, `bdv-sync` et `bdv-base` arrivent dans cet ordre.

Le panneau s'ouvre AVANT le moteur, volontairement : « Toi » et « Le courrier » n'en ont pas
besoin, et un panneau qui met une seconde à apparaître donne l'impression d'un clic raté.

`npm run banc` : 65 contrôles.

---

## Session du 07/09/2026, après-midi : le bureau devient le lieu unique

Ted a demandé que le tableau de bord cesse d'être « une page un peu électron libre » et
qu'il soit intégré au bureau. Le mot qu'il a employé était « un onglet, un tiroir du
bureau », et c'est ce mot qu'on a écarté en premier.

### L'arbitrage de départ

Un onglet du bureau contenant les cinq écrans du tableau de bord empile deux étages de
navigation : le bureau, puis dedans le tableau de bord, puis dedans ses écrans. C'est
exactement la sensation d'électron libre, rangée dans un placard. Trois formes ont été
posées, Ted a tranché pour la plus ambitieuse : **une seule navigation, à plat**. Le nom
« tableau de bord » ne désigne plus un lieu, ses écrans sont des pièces du bureau au même
rang que « Ma journée ».

Écarté : l'onglet « Mes ventes » contenant la navigation actuelle (moitié moins de travail,
mais deux étages), et le simple habillage commun de deux pages (une session, mais le
chargement trahit la page à part).

Barre **à gauche et repliable**, pas en haut : les écrans de vente portent des tableaux de
dix colonnes et deux cents lignes. Un bandeau horizontal leur prend de la hauteur en
permanence, une colonne n'en prend qu'une fois et elle se replie.

Chantier mené **seul**, sans y mêler les six chantiers de la feuille de route de la veille :
si quelque chose casse, il faut savoir lequel des deux a cassé.

### Les quatre lots, et ce qu'on a appris dans chacun

**Lot 0.** La mise en forme et les écrans sortent du fichier du tableau de bord vers
`bdv-ecrans.css` et `bdv-ecrans.js`. Déplacement pur, vérifié par reconstitution : le
fichier recomposé est identique au caractère près, mêmes 228 351 octets. La page passe de
3 221 à 135 lignes.

**Lot 1.** La barre du bureau, et `bdv-nav.js` qui porte la **liste unique des pièces**.
Avant lui, la liste existait à deux endroits qui ne se ressemblaient pas. La barre partage
la clé de préférence de repli et le raccourci clavier avec le volet des écrans de vente :
pour le vigneron c'est la même barre. Une différence assumée, qui a payé au lot 2d : ici le
repli laisse les icônes, là où le volet tombait à zéro.

**Lot 2.** En quatre temps. Le démarrage des écrans devient une fonction, parce qu'un
écouteur `DOMContentLoaded` ne se déclenche jamais quand le script est chargé au clic. La
coque devient un include partagé. Le chargement se fait au premier clic. L'ancienne adresse
devient une redirection qui traduit le fragment.

### Le vrai arbitrage technique du lot 2 : scope contre renommage

Six noms de classes sont communs entre `style.css` et `bdv-ecrans.css` : `btn`,
`btn--ghost`, `card__title`, `hero`, `mono`, `note`. Le plan du lot 0 annonçait de les
renommer côté écrans. **C'était faux, et l'annuler est la bonne décision du lot 2.**

Ces noms sont un **vocabulaire partagé** avec `bdv-base.js`, qui génère lui aussi des
`.btn` et des `.card__title`, et dont les blocs sont stylés par `bdv-panneau.css` sous
`.bdvr-panneau`. Renommer d'un côté seulement aurait donné deux noms pour la même chose
selon l'endroit où le bloc s'affiche. Les 373 sélecteurs sont donc portés par
`.bdv-ventes`, cinq exceptions nommées : les jetons et les quatre éléments hors page, qui
portent la classe eux-mêmes. C'est le motif déjà retenu pour `bdv-panneau.css`.

Corollaire à retenir : **le précédent existait déjà dans le dépôt**. Avoir cherché comment
`bdv-panneau.css` résolvait le même problème a évité une centaine de renommages inutiles.

### Cinq règles globales, et l'interlignage du site

`bdv-ecrans.css` stylait `html`, `body`, `a` et tous les titres. Sans danger tant qu'une
seule page la chargeait ; chargée dans le bureau, sa règle `body` aurait rabattu
l'interlignage du site de 1,7 à 1,5, sur toute la page, sans que rien ne le signale. Sorties
dans une feuille que seule la page autonome chargeait, disparue avec elle au lot 2d.

### Ce que les outils ont trouvé, et pas nous

`npm run banc`, **premier test automatisé du dépôt**, 56 contrôles sur la page produite. Il
a attrapé le bug pour lequel il a été écrit : la pièce active de la barre était rendue en
`<span>` non cliquable. Juste pour une barre qui rechargeait la page, faux dès qu'elle
navigue : revenir à « Ma journée » après un détour par « Mes clients » ne faisait plus rien,
sans un message et sans une erreur.

Une capture d'écran a montré ce qu'aucun contrôle ne voit : `.btn--light` est dessiné pour
se poser sur le bordeaux de l'ancienne barre haute. Dans le bureau, ces boutons tombent sur
du papier clair, où « Exporter PDF » et « Ouvrir ma base » se devinaient plus qu'ils ne se
lisaient. La charte vérifie des paires de couleurs nommées, jamais un bouton posé sur un
fond pour lequel il n'a pas été dessiné.

### Le contrôle qui rassurait sur du vide, trois fois dans la journée

`charte:dash` a annoncé CONFORME sur du vide trois fois le 07/09/2026, chaque fois pour une
raison différente : le CSS parti dans une feuille liée, les icônes parties dans un include,
puis la cible devenue un gabarit qui ne porte pas ses feuilles de style. La règle qui en
sort et qui vaut pour tout script de contrôle : **un contrôle qui ne peut pas s'exécuter
doit crier, jamais se taire.** Les deux scripts s'arrêtent maintenant en le disant si le
build manque ou si `jsdom` est absent.

`charte:dash` est devenu `charte:bureau` et cible `_site/mon-bureau/index.html`. Il lit
aussi les **deux feuilles chargées en JavaScript** que personne ne surveillait,
`bdv-ecrans.css` et `bdv-panneau.css` : elles ne sont dans aucun HTML et pourtant elles
s'appliquent. Nouvelle section : aucune règle de `bdv-ecrans.css` ne peut sortir de son
scope.

### Ce qui reste ouvert au terme de la session

- **Le RGPD parle encore d'une page qui n'existe plus** : neuf mentions dans `rgpd.njk`,
  dont « uniquement sur la page du tableau de bord » et « Depuis le tableau de bord, le
  bouton Vider la base ». C'est un texte juridique, il n'a pas été touché sans l'avis de Ted.
- **Deux anciennes versions du tableau de bord sont PUBLIÉES** : `dashboard-vigneron-v1` et
  `dashboard-vigneron-mockup`, accessibles en ligne, sans compte et sans redirection. Elles
  ne lisent pas la vraie base (aucun IndexedDB), donc pas de fuite, mais ce sont deux
  électrons libres de plus, qui promettent la même chose que le bureau.
- **Le tiroir du bureau est vide et masqué.** Il devait revenir avec les outils ouverts à
  tous, mais il n'y en a qu'un, le compte à rebours, et il est déjà dans la barre. À
  trancher : le supprimer, ou en faire un renvoi vers `/outils/`.
- Les icônes de la barre sont des emoji, elles gardent leurs couleurs propres sur le fond
  sombre. Ça vient des écrans de vente, mais sept en colonne, ça se voit plus que cinq.
- La largeur : les écrans de vente ont 1 440 px, plus 172 quand la barre est repliée. Si
  c'est étroit sur « Mes clients », c'est un `max-width` à ouvrir, pas une refonte.

---

## Session du 06/09/2026, en soirée : la feuille de route des six chantiers

Ted a posé six chantiers pour la suite. Ils sont notés ici avec ce que chacun suppose et ce qui
coince, pour que la reprise ne redécouvre pas les mêmes murs. Puis le premier a été attaqué : voir
« Le chantier CRM » plus bas.

### Les six chantiers, tels qu'ils ont été demandés

1. **Un agenda interactif**, avec création d'un calendrier éditorial, interactif et affiché sur le
   bureau. Outil gratuit.
2. **Un composeur de signature de mail poussé**, du niveau de ce que fait HubSpot, la signature
   s'ajoutant à tous les messages proposés par le tableau de bord.
3. **Le CRM enrichi** : tous les moyens de communication dans les choix possibles, et la
   possibilité de modifier une action déjà enregistrée.
4. **Une coche « considéré comme envoyé »** dans l'écran d'écriture de message, qui inscrit
   l'échange au CRM automatiquement.
5. **La fiche client et les conseils mis à jour en temps réel** selon les actions déjà faites, ce
   qui permet d'étoffer les phrases proposées.
6. **Un tableau de bord d'administration** pour Ted, pour tout suivre.

### Ce qui coince, chantier par chantier

**Le point dur, à trancher avant d'écrire quoi que ce soit : la signature de mail.** Un lien
`mailto:` ne transporte que du texte brut. Le composeur encode déjà son corps de message ainsi,
ligne 3205 du tableau de bord. Aucun logo, aucune couleur, aucun lien cliquable ne peut y
survivre, quel que soit le soin mis à composer la signature. Trois sorties possibles, il faut en
choisir une :

- une signature en texte seul, sobre, qui passe partout et se code en une soirée ;
- une signature riche que l'outil met dans le presse-papier, que le vigneron colle une fois pour
  toutes dans les réglages de sa messagerie, avec le mode d'emploi qui va avec ;
- l'abandon du `mailto:` pour un envoi réel, ce qui rouvre la clé d'envoi dans une page publique,
  la délivrabilité et la responsabilité de l'envoi, toutes trois écartées de propos délibéré
  jusqu'ici.

**Le tableau de bord d'administration entre en collision avec la promesse écrite ce matin.**
`src/compte.njk` dit noir sur blanc, depuis aujourd'hui, qu'aucune statistique agrégée n'est faite
sur les lignes de vente et qu'elles ne servent qu'à l'affichage du tableau de bord de leur
propriétaire. La sécurité en base va dans le même sens : chaque compte ne voit que ses lignes, il
faudrait un droit d'exception pour passer outre. Deux tableaux de bord d'administration sont
possibles, et ce ne sont pas les mêmes :

- celui qui **compte l'usage**, comptes créés, imports, écrans ouverts, erreurs, ne touche à aucune
  donnée de vente et ne casse rien ;
- celui qui **regarde le chiffre d'affaires des vignerons** casse la promesse le jour où il est
  écrit, pas le jour où il est utilisé.

Décider lequel. Si c'est le second, réécrire la page de compte avant, jamais après.

**La coche « considéré comme envoyé » ne doit pas être pré-cochée.** Le journal d'échanges ne vaut
que si ce qu'il contient s'est vraiment passé. Une coche déjà cochée le remplit d'envois qui n'ont
pas eu lieu, et le vigneron ne s'en aperçoit qu'au moment où il relance quelqu'un pour la deuxième
fois en croyant que c'est la première.

**Modifier une action déjà enregistrée fait perdre au journal son statut de trace.** À trancher :
soit la modification écrase, et le journal devient une note révisable ; soit elle laisse une
correction horodatée, et le journal reste une trace. La synchronisation complique le choix,
puisque le local gagne aujourd'hui sur le serveur pour le suivi client : la même action modifiée
sur deux appareils ne se départage pas proprement.

**Les conseils mis à jour en temps réel supposent un journal d'actions fiable.** Ce chantier vient
donc après les trois précédents, jamais avant. Et « étoffer les phrases » ne veut pas dire les
faire écrire par un modèle : la règle du projet reste des gabarits à blocs. Étoffer, ici, c'est
ajouter des blocs conditionnés à ce qui s'est passé, pas ouvrir la porte au texte généré. Même
piège d'accord grammatical qu'ailleurs, mêmes trois fonctions d'article à utiliser.

**L'agenda et le calendrier éditorial ne sont pas un outil de vente.** Ils n'ont rien à faire dans
le fichier autonome du tableau de bord, qui pèse déjà 242 Ko et se recharge en entier. Ils vivent
sur le bureau connecté, avec leur propre table en base, et ils s'adressent à tous les comptes
gratuits de la filière, pas aux seuls clients Vitisoft. C'est cohérent avec le cadre des trois
cercles posé ce matin.

### L'ordre proposé

CRM enrichi, puis coche d'envoi, puis conseils en temps réel : c'est une chaîne, chaque maillon a
besoin du précédent. L'agenda est indépendant et peut avancer en parallèle. La signature attend
l'arbitrage sur le `mailto:`. Le tableau de bord d'administration attend l'arbitrage sur la
promesse.

### Le chantier CRM, premier des six

**Décision de Ted sur la signature, prise dans la même séance** : signature riche déposée dans le
presse-papier, à associer à l'outil de création de message existant. Point à traiter le jour où on
y viendra : le bouton actuel ouvre un lien `mailto:`, qui ne peut pas porter la signature riche. Il
faudra donc soit un second bouton « copier le message complet », soit remplacer le `mailto:` par la
copie. Ce n'est pas tranché.

**Les treize canaux retenus**, en quatre groupes : le socle (Appel, Répondeur, SMS, E-mail, Note
interne), le terrain (Visite au domaine, Reçu au caveau, Salon ou dégustation), les messageries
(WhatsApp, LinkedIn, Visio), le papier et l'envoi (Courrier postal, Échantillon envoyé).

**La correction laisse une trace.** Le texte et le canal se modifient, `le` ne bouge jamais, et une
colonne `maj_le` dit quand la ligne a été réécrite. L'écran n'affiche « corrigé le » que si la ligne
a vraiment bougé : l'afficher partout ferait douter de tout le journal.

#### Ce que l'audit du code a révélé, et qui a changé le chantier

La liste des moyens de communication n'était pas recopiée à quatre endroits mais à **neuf**, sur
deux fichiers qui ne se parlent pas, le tableau de bord ayant sa propre copie du CRM. Et ces listes
avaient **déjà divergé** : un « Message » enregistré depuis la fiche était classé canal E-mail, le
même geste posé depuis la file était classé Téléphone. Deux lignes du même journal disaient deux
choses du même acte, et rien ne le signalait. C'est le troisième cas de la semaine du même piège,
le réglage recopié en dur.

Neuvième endroit trouvé en fin de passe : `CANAUX_SUIVI`, quatre canaux figés dans le tableau de
bord, **déclarée et appelée par personne**. Du code mort qui ressemblait à la liste qui fait foi.
Supprimée.

#### Ce qui a été écrit

- `src/js/bdv-canaux.js`, **nouveau**. La liste des canaux, écrite une fois. Chargé **sans
  `defer`** dans les deux pages : les scripts en ligne s'exécutent avant les modules différés, donc
  une liste lue au chargement depuis un fichier différé serait vide. C'est le même piège que le
  `if(window.BdvCrm)` en tête de `mon-bureau.njk`.
- `src/js/bdv-crm.js` : les gestes portent une clé de canal, `noter()` reçoit le canal au lieu de
  le deviner, `fil()` rapporte `maj_le`, et `corriger()` est nouvelle.
- `src/mon-bureau.njk` : choix du canal à la saisie, canal affiché dans le fil, correction en place
  dans la ligne avec sauvegarde du brouillon si la fiche se repeint entre-temps.
- `src/outils/dashboard-vigneron.html` : mêmes branchements, plus la colonne « Canal » du tableau
  des clients qui résout la clé au lieu de l'afficher brute.
- `src/css/style.css` et les styles internes du tableau de bord.
- Une migration : `maj_le` sur `echanges`, appliquée en base, et les trois lignes existantes
  alignées sur `le` pour qu'elles ne s'affichent pas comme corrigées.

#### Ce qui a été décidé contre la demande, et pourquoi

**Le stockage garde la clé du canal, pas son libellé.** Un libellé stocké fige la formulation : le
jour où « Reçu au caveau » devient « Passé au caveau », la base porte deux orthographes du même
geste et rien ne permet de les rapprocher. Les valeurs historiques `Téléphone` et `E-mail` restent
lisibles par une table de compatibilité, jamais réécrites.

**Les trois gestes rapides de la file restent trois.** Treize choix par ligne feraient de la file
le mur qu'elle est censée éviter. Les treize canaux vivent dans la fiche, là où on prend le temps
d'écrire.

**La correction n'est pas encore dans le fil du tableau de bord**, seulement dans celui du bureau.
Motif : là-bas le fil est peint en chaînes HTML et le journal passe par un miroir local avec file
de rejeu. C'est un second passage, pas un ajout de bouton.

#### Ce qui a été vérifié

- `node --check` passe sur les deux fichiers JavaScript et sur les blocs en ligne des deux pages.
- Aucune trace de `Téléphone` en dur, ni de `ACTIVITE_TYPE`, `TYPES_ECHANGE` ou `TYPE_SAISIE`.
- Politiques de la table `echanges` contrôlées en base avant d'écrire : modification et suppression
  existaient déjà, donc l'édition ne demandait aucune migration de sécurité.
- Contrôle de charte du site : **deux échecs, tous deux antérieurs à ce chantier**, et l'un des deux
  est un faux positif. `var(--tour)` est déclaré sans déclaration CSS parce qu'il est posé en
  JavaScript par `mon-bureau.njk` ligne 927, ce que le script de contrôle ne sait pas voir. L'autre
  est réel : deux `letter-spacing` en dur, `.la-une__label` et `.postit__v[data-mot]`.

### Reste ouvert

1. Signature de mail : le `mailto:` ne peut pas porter la signature riche retenue. Second bouton
   « copier le message complet », ou abandon du `mailto:` ?
2. Tableau de bord d'administration : compteurs d'usage seuls, ou lecture des données de vente ?
   Le second oblige à réécrire `src/compte.njk` d'abord.
3. Journal d'échanges : la modification écrase, ou corrige en laissant la trace ?
4. Où vit l'agenda, et quelle table en base le porte.
5. Quels moyens de communication entrent dans la liste du CRM, et lesquels ouvrent une action
   réelle (téléphone, message, courrier, visite, salon) plutôt qu'une simple étiquette.

---

## Session du 06/09/2026, le bureau connecté et la promesse réécrite

### Le cadre décidé

Le site devient d'abord une plateforme de contenu gratuit. Le compte apporte une couche en plus,
pas l'accès au contenu. Trois cercles :

- **Visiteur** : les articles restent lisibles sans compte, c'est le référencement et la porte
  d'entrée.
- **Compte gratuit, ouvert à toute la filière** (vignerons, cavistes, négociants, étudiants, pros
  de la filière), pas seulement aux clients Vitisoft : signets, historique, outils légers,
  l'édition, et les contenus réservés.
- **Compte plus Vitisoft** : le tableau de bord des ventes, qui reste fermé.

### Les arbitrages

**Les webinaires et les interviews sont réservés aux comptes, les articles restent ouverts.**
Choix de Ted contre ma recommandation, qui était de tout ouvrir. Son motif : le contenu coûteux à
produire doit être la raison de s'inscrire. Le garde-fou que j'y attache : chaque webinaire garde
une page publique indexable (titre, intervenant, description, extrait), seule la vidéo complète
étant derrière le compte. Une vidéo entièrement cachée n'amène aucune visite et ne convertit
personne, et elle rapporte beaucoup moins à l'intervenant qui a accepté de venir. Si les
inscriptions déçoivent, c'est là qu'il faut regarder en premier.

**Le compte s'ouvre à toute la filière.** Conséquence directe : la page `/compte/` ne peut plus
dire « réservé aux utilisateurs de Vitisoft », cette mention ne concerne plus que le tableau de
bord. Ça élargit aussi la base de ciblage pour les annonces Vitimedia.

**L'inscription reste à deux champs.** Email et mot de passe, rien d'autre. Les trois questions de
profil (métier, structure et code postal, Vitisoft oui ou non) viennent sur un écran 2 sautable,
après la confirmation d'adresse. Le reste s'enrichit plus tard, au moment où ça sert. Règle posée :
**on ne demande jamais un champ dont on ne peut pas montrer l'effet dans les cinq secondes**, sinon
c'est un formulaire commercial déguisé et ça se sent.

**Premier outil gratuit retenu : le compte à rebours réglementaire** (DAI, TVA, facturation
électronique, certification de caisse), qui renvoie aux articles existants. Écartés pour l'instant :
le calculateur de prix de revient, excellent en référencement mais à usage unique, et l'assistant
mentions d'étiquette, trop lourd à tenir à jour pour un premier outil.

**Les annonces Vitimedia ne descendent jamais dans le corps d'un article.** Trois emplacements
seulement : le bloc « Partenaires écosystème » en bas d'article, une carte dans le bureau, un encart
dans l'édition. Une carte par écran, nommée « partenaire », jamais déguisée en article.

### Ce qui a été réécrit, et pourquoi c'était urgent

La page `/compte/` promettait « Un email, un mot de passe. Rien d'autre ne nous parvient. » Cette
phrase était **déjà fausse** depuis le passage des ventes en base du 04/09, et le projet de profil
et d'annonces la rendait intenable. Elle est remplacée par une promesse qui dit les choses dans
l'ordre : ce que le compte apporte, les trois questions et à quoi elles servent, puis la frontière
qui compte, **les ventes ne servent jamais au ciblage**, et enfin la mention Vitisoft ramenée au
seul tableau de bord.

Ted a tranché sur le stockage : on l'assume à l'écrit, les données sont enregistrées sur le compte
et accessibles de partout, le mot « navigateur » disparaît des textes visibles. J'ai écrit
« enregistrées sur ton compte, hébergé en Europe » plutôt que « sur nos serveurs sécurisés » : les
serveurs sont ceux de Supabase en Irlande, et « sécurisés » est une affirmation que les mentions
légales ne soutiennent pas encore.

**Le renvoi automatique vers le tableau de bord après inscription a été retiré des boutons
génériques.** C'était le défaut le plus visible du nouveau cadre : on s'apprêtait à inviter toute la
filière à s'inscrire pour l'envoyer contre une porte fermée. Le titre de la fenêtre passe de « Ton
tableau de bord t'attend » à « Ton bureau t'attend » partout, sauf dans `dashboard-preview.njk`, qui
parle vraiment du tableau de bord et garde les deux.

### Audit d'expérience, et ce qu'il a trouvé

Passage du site en ligne au crible, parcours visiteur puis inscription.

**Le domaine ne répond pas.** Ni `lebureauduvigneron.fr`, ni `www`. Le site n'existe que sur
`lebureauduvigneron.vercel.app`. Tant que ça dure, chaque lien envoyé tombe dans le vide et le
référencement se construit sur l'adresse Vercel. À régler côté DNS IONOS, avant tout le reste.

**Trois défauts corrigés dans la foulée :**

- **Le bouton d'inscription du bandeau final était invisible.** `btn--bordeaux` sur
  `--bordeaux-deep`, contraste mesuré **1,17:1** : le libellé se lisait, la forme du bouton non.
  Corrigé en `.btn` nu, qui est déjà papier plein sur texte bordeaux. Règle à retenir : **sur fond
  sombre, le bouton plein est en papier, jamais en bordeaux**. Le cadre qui l'entourait était la
  boîte du formulaire Tally, restée en place après son retrait, et ressemblait à un champ qui
  n'avait pas chargé.
- **Deux mentions échouaient au contraste** sur ce même fond : l'étiquette « Gratuit » (opacité
  0,4, soit 2,9:1) et la ligne de réassurance (opacité 0,35, soit 2,67:1). Remontées à 0,7 et 0,62.
- **Deux chiffres faux, affichés côte à côte avec leur démenti.** « 1 article publié » dans une
  section nommée « compteurs honnêtes », juste au-dessus d'une grille en montrant trois et d'une
  page en contenant vingt : le compteur est maintenant calculé sur la collection. Et « le premier
  épisode arrive en juillet 2026 », affiché en septembre. La date a été retirée plutôt
  qu'inventée, en attendant celle que Ted donnera.

**La fenêtre d'inscription, reprise.** C'est le seul écran que tout le monde traverse et c'était le
moins soigné. Elle parlait entièrement en JetBrains Mono, la police que la charte réserve aux
chiffres : elle avait l'air d'appartenir à un autre produit. Seul le champ du code la garde
désormais, c'est sa seule place justifiée. Le bouton plein était « Me connecter » alors que la
quasi-totalité du trafic arrive sans compte : « Créer mon compte » prend sa place, et la connexion
devient « J'ai déjà un compte, me connecter », qui lève l'ambiguïté. « Fermer » ne prend plus une
ligne de bouton pleine largeur au même rang que les deux actions, c'est une croix dans le coin,
cible tactile de 44 px. Enfin les règles de mot de passe sont annoncées **avant** la saisie, et la
phrase est générée depuis `MDP_REGLES` au lieu d'être recopiée : c'est la même famille de panne que
`MDP_MIN` désaccordé de son réglage serveur, un refus muet sur une règle jamais annoncée.

**Et une correction de ce que j'avais moi-même cassé le matin.** `.waitlist__sub` est italique,
centré, étroit, opacité 0,72 : conçu pour une phrase d'accroche. J'y avais mis quatre paragraphes
de promesse, ce qui donnait douze lignes d'italique centré, au passage le plus important de la
page. Ils passent en `.waitlist__sub--lecture`, à plat et alignés à gauche. Dans le même geste, la
fenêtre ne s'ouvre plus toute seule sur `/compte/` : elle recouvrait la promesse qu'on venait
d'écrire, personne ne l'aurait jamais lue.

**Un bug trouvé par une capture d'écran de Ted, et il vivait là depuis le début.** Sur `/compte/`
en état connecté, les trois boutons s'affichaient ensemble : « Créer mon compte ou me connecter »,
« Ouvrir mon tableau de bord » et « Me déconnecter ». La cause n'a rien à voir avec le travail du
jour. **L'attribut `hidden` perdait contre `.btn { display: inline-block }`** : la feuille par
défaut du navigateur pose `[hidden]{display:none}`, mais n'importe quelle règle du site qui fixe un
`display` la bat en spécificité. Le JavaScript faisait son travail, le CSS l'annulait en silence.
Corrigé par une règle globale `[hidden]{display:none !important}` en tête de `style.css`.
How to apply: à retenir pour tout composant à venir. Un élément masqué par `hidden` et portant une
classe qui fixe un `display` reste visible, sans erreur, sans trace en console. Le tableau de bord
a été vérifié dans la foulée : il n'utilise `hidden` sur aucun élément à classe, il n'est pas
touché.

Au passage, les trois publics (« Vignerons · Étudiants vin · Pros filière ») sont désormais masqués
quand on est connecté : ils s'adressent à quelqu'un qui n'a pas encore de compte.

**Piège de test, revu une fois de plus** : Ted a d'abord vu l'ancien style, cadre du formulaire
Tally compris, alors que `_site` était à jour. C'était le cache du navigateur sur `style.css`, servi
sans empreinte dans l'URL. Un rechargement forcé règle le cas. Vérifier les dates de `src/` et
`_site/` reste le bon premier réflexe, mais quand elles concordent, le suspect suivant est le cache.

### Le bureau connecté, développé

Reproche de Ted, fondé : la session avait produit des correctifs et des promesses de texte, rien
de ce qu'il avait demandé. Reprise du besoin point par point, puis développement.

**Les trois questions** (`bdv-compte.js`). Un quatrième écran dans la fenêtre, affiché **après une
inscription réussie seulement**, jamais à la connexion : métier, structure et code postal, usage de
Vitisoft. Tout est sautable et rien ne conditionne l'ouverture du compte. Un enregistrement qui
échoue part en file d'attente locale et se rejoue au chargement suivant, plutôt que d'afficher une
panne à quelqu'un dont le compte vient d'être créé.
Why: `utilise_vitisoft` est du texte et pas un booléen. « Je ne sais pas » est une réponse fréquente
et utile, un booléen l'aurait écrasée sur `null`, qui veut déjà dire « n'a pas répondu ». Les deux
ne se confondent pas : l'un se redemande, l'autre non.

**Les signets** (`bdv-signets.js`, nouveau). Trois états, `absent` / `a_lire` / `lu`. Le module ne
connaît ni l'URL Supabase ni la clé anon : il passe par `BdvCompte.api()`. Le cache local est un
miroir d'affichage, jamais un stockage : le serveur écrase tout à chaque chargement.
How to apply: **un clic sur une punaise sans compte ouvre la fenêtre, et l'action s'exécute toute
seule une fois le compte créé.** C'est le meilleur moment du site pour demander un compte, la
personne vient d'exprimer une envie précise. Ne pas remplacer ça par un bouton générique.

**`/mon-bureau/`** avec quatre zones : le sous-main (à lire), le classeur (lu), le courrier (paru
depuis le dernier passage), les outils. Déconnecté, la page n'est pas une erreur mais une
invitation. Le menu gagne « Mon bureau » et une pastille comptant les articles en attente, lue dans
le même miroir local, en script synchrone comme le reste.
Why: la marque du courrier (`bdv_bureau_vu_le`) n'est déplacée que si la visite précédente a plus
de six heures. Sans ce délai, un simple rechargement viderait la liste qu'on est en train de lire.

**Le piège du `dump` Nunjucks a été évité de justesse** : la liste des contenus est injectée dans
la page en JSON, et un titre contenant une apostrophe ou un guillemet casserait le bloc. Le filtre
`dump` échappe correctement. Validé en relisant le JSON produit avec `JSON.parse`, 19 contenus.

**Un contrôle qui vaut d'être répété** : `npx @11ty/eleventy --output=$HOME/verif-eleventy` construit
le site hors du dépôt, sans toucher `_site` ni gêner le `npm start` de Ted. Le shell Cowork n'a pas
le droit de supprimer, donc un build dans `_site` échouerait sur `EPERM unlink` ; celui-là passe, et
il valide la syntaxe Nunjucks avant de livrer.

### Le compte à rebours réglementaire, et l'accueil du non-Vitisoft

**Premier outil gratuit ouvert à toute la filière**, `/outils/echeances/`. DRM, DAI, déclaration de
récolte, facturation électronique. Chaque échéance affiche dans combien de jours elle tombe, qui
elle concerne, un lien vers l'article du Bureau quand il existe, et **sa source officielle**.

**Les dates ont été vérifiées avant d'être écrites**, pas reprises de mémoire :
- DRM, le 10 du mois suivant, tous les mois, y compris à néant. Source douane.
- DAI, le 10 septembre pour les opérateurs en campagne viticole, dépôt via CIEL. Source douane.
- Déclaration de récolte, le 10 décembre, module VENDANGES. Source guide du viticulteur.
- Facturation électronique : réception obligatoire pour toutes les entreprises au 01/09/2026,
  émission des grandes entreprises et ETI à la même date, émission des PME, TPE, micro et
  indépendants au 01/09/2027. Sources impots.gouv.fr et Cegid.

**Deux décisions d'architecture :**
- Les échéances vivent dans `src/_data/echeances.json`, jamais dans le code. Une date qui change se
  corrige dans un fichier de données, par quelqu'un qui ne programme pas.
- **Le compte à rebours se calcule dans le navigateur, jamais à la construction du site.** Une page
  construite en septembre et consultée en décembre afficherait sinon un décompte faux, sans que
  rien ne le signale. C'est la même famille de panne que les réglages recopiés en dur.

Contrôlé au 06/09/2026 : DRM et DAI à 4 jours (elles tombent le même jour, c'est le pic de charge
réel d'un vigneron début septembre), récolte à 95 jours, émission à 360 jours, réception affichée
comme déjà en vigueur depuis 5 jours.

**L'accueil du non-Vitisoft sur le tableau de bord.** Quelqu'un qui a répondu « non » à la question
Vitisoft voit maintenant un bloc qui le lui dit avant qu'il dépose un fichier, et qui l'oriente vers
le compte à rebours, son bureau et les articles.
Why: un refus qui ne propose rien est un refus raté. Sans ce bloc, cette personne déposait son
export, recevait une erreur de format et repartait en pensant que l'outil était cassé.
How to apply: la règle `[hidden]{display:none !important}` a dû être ajoutée aussi dans le CSS du
tableau de bord, pour la même raison que sur le site.

### La présentation du bureau, et la cohérence du bandeau

Trois directions maquettées et soumises à Ted sur un canevas : « le bureau du matin » (ce qui
presse d'abord), « le sous-main » (la métaphore prise au mot, feuilles posées et post-it manuscrit)
et « le classeur » (des intercalaires et une liste dense). **Ted a suivi ma recommandation : le
bureau du matin, avec les accents du sous-main.**

Why: un vigneron n'ouvre pas son bureau pour admirer son rangement, il l'ouvre entre deux tâches
pour savoir ce qui lui tombe dessus. Le sous-main est la plus belle des trois et la plus fidèle à
la marque, mais il tient à six fiches : à trente signets c'est un fouillis, et sur téléphone les
feuilles se remettent en colonne, donc l'effet disparaît là où sont la plupart des lecteurs. Le
classeur est le plus solide et le plus froid, c'est vers lui qu'il faudra glisser le jour où le
volume l'exigera, et le composant à onglets existe déjà dans le site.
How to apply: gardés du sous-main, la punaise sur chaque fiche et une ligne manuscrite en Caveat.
Le classeur reste la piste de repli quand les listes deviendront longues.

**`/mon-bureau/` réécrit** : en-tête bordeaux avec le jour, le prénom et un résumé en une phrase,
puis « ce qui presse » en pleine largeur (l'échéance la plus proche, et **le plus ancien signet non
lu**, celui qui risque de ne jamais l'être), puis deux colonnes, le sous-main d'un côté, les outils,
le classeur et le courrier de l'autre.

**Le calcul des échéances est sorti dans `src/js/bdv-echeances.js`**, partagé par la page du compte
à rebours et par le bureau.
Why: deux copies du même calcul auraient fini par diverger, et rien ne l'aurait signalé.

**Le bandeau, décision prise :** « Tableau de bord » sort du menu, « Outils » le remplace et mène à
une nouvelle page `/outils/`.
Why: le tableau de bord est réservé aux utilisateurs de Vitisoft. Il occupait une entrée de
navigation devant des gens qui ne l'ont pas, et le compte à rebours n'était atteignable depuis aucun
menu. Une fois connecté, « Mon compte » sort aussi et « Mon bureau » prend sa place en bouton :
cinq entrées dans les deux états, au lieu de six.

### Mixer le bureau et le tableau de bord

Demande de Ted : « mes clients me ferait arriver sur l'interface clients du tableau de bord ». Oui,
et c'est la partie la moins chère de la journée, parce que le tableau de bord savait déjà changer
d'écran, il ne savait juste pas qu'on pouvait le lui demander de l'extérieur.

**Ce qui a été posé :**
- `navTo()` écrit l'écran dans l'adresse (`#clients`), en `replaceState`. Trois effets voulus : le
  bureau pointe droit sur un écran, le bouton Retour du navigateur circule DANS l'outil au lieu
  d'en sortir, et un écran peut être mis en favori.
- Un écouteur `hashchange` rejoue le changement d'écran quand l'outil est déjà ouvert.
- À l'ouverture, `/outils/dashboard-vigneron/#clients` ouvre directement cet écran, **mais
  seulement s'il y a des lignes en base**. Sans données, l'écran de dépôt reste la bonne réponse :
  le lien ne se transforme jamais en page vide.
- La barre du tableau de bord dit « ← Mon bureau » au lieu de « ← Retour au site ».
- Le bureau affiche les quatre écrans en raccourcis, masqués pour qui a déclaré ne pas utiliser
  Vitisoft.
- `/mon-bureau/` passe de `.container` (760 px, le gabarit d'un article) à `.container--wide`
  (1100 px). C'était toute l'explication de l'espace perdu que Ted voyait sur sa capture.

**Le piège évité, à ne pas réintroduire** : l'écran de départ est un PARAMÈTRE d'`openApp()`, il ne
peut pas être posé par un `navTo()` juste après l'appel. `runBusy` diffère le rendu de deux frames
dès que la base est grosse, et son `navTo('annee')` écraserait le nôtre une fraction de seconde
plus tard. Le bug n'apparaîtrait que sur une grosse base, donc jamais en test et toujours chez le
vigneron.

**Décision d'architecture prise pour la suite** : le bureau ne recalcule JAMAIS un chiffre de
vente. Le tableau de bord calcule et dépose un résumé, le bureau l'affiche.
Why: deux copies du même calcul finiraient par diverger, et le bureau annoncerait un chiffre
d'affaires que le tableau de bord dément deux clics plus loin. Même famille que le calcul des
échéances, sorti dans `bdv-echeances.js` pour la même raison.
How to apply: le résumé va dans une colonne de `reglages`, pas dans le localStorage, pour que le
bureau ouvert sur le téléphone montre les chiffres du dernier import fait sur l'ordinateur.
Reste à écrire : la colonne, l'écriture côté tableau de bord, le bloc de quatre chiffres côté
bureau, et les rappels clients du jour (`suivi_clients.rappel`, qui ne demande aucun calcul).

**Règle de partage retenue** : le bureau ne duplique jamais un écran du tableau de bord, il y mène.
Le bureau porte des chiffres et des portes ; dès qu'il faut une liste, on est dans l'outil.

### L'écran d'import n'est plus une porte

Constat de Ted : « on tombe toujours sur la page d'upload, c'est pas full intégré, la page d'import
n'est pas un déclencheur, ça doit être une page de paramétrage ». Fondé. Le tableau de bord
s'ouvrait sur un formulaire de dépôt même avec 17 000 lignes en base : il ressemblait à un outil
dans lequel on entre en montrant patte blanche, pas à une pièce du bureau.

**Ce qui a changé :**
- **`#screenImport` est supprimé.** L'écran plein page n'existe plus, ni dans le HTML ni dans le
  flux. Avec lui disparaissent `bindImport()` et `refreshResume()`, qui n'avaient plus d'objet.
- **« Ma base » devient un écran du menu**, avec sa propre entrée entre « Chercher » et
  « Réglages ». Il portait déjà la zone de dépôt et le bouton « Vider la base » : il était rangé
  dans Réglages, il en sort.
- **L'outil s'ouvre toujours.** Base pleine, on arrive sur « Mon année » ou sur l'écran demandé par
  l'adresse. Base vide, `openApp()` atterrit de lui-même sur « Ma base », avec un mot qui explique
  quoi déposer. Sur zéro ligne, `renderAll()` n'est pas appelé : certains écrans se construisent
  mal sans données.
- **Le volet gagne un pied de navigation** : Mon bureau, Le compte à rebours, Les articles. Le
  tableau de bord n'est plus une application dont on sort, c'est une pièce dans laquelle on passe.
  Sur téléphone il se range en ligne dans la barre horizontale.
- **`.app.replie .topbar__home` repasse en `display:inline`.** Le lien vers le bureau était masqué
  quand le volet est replié pour gagner de la place, mais le volet replié emporte le pied de
  navigation avec lui : sans ce lien, il ne restait plus aucune sortie vers le reste du bureau.
- Le bloc du non-Vitisoft, qui vivait dans l'écran d'import supprimé, revit en tête de « Ma base ».

**Sauvegarde** : `dashboard-avant-remaniement.html` a été déposé dans le dossier de travail de la
session (hors du dépôt) avant l'opération. Il n'y survivra pas ; le vrai filet est le commit
précédent.

### Le pseudo-CRM : la file, le journal, les gestes

Ted a validé l'ordre proposé et est parti sans possibilité de valider la suite. Tout ce qui suit
a été décidé, écrit et audité en son absence.

**Le raisonnement, à garder** : l'outil savait déjà QUI rappeler, il l'écrivait noir sur blanc dans
ses verdicts. Ce qu'il ne savait pas, c'est SI ça avait été fait. Un constat repart de zéro à
chaque import, une file garde la mémoire des gestes. C'est toute la bascule.

**Ce qui a été écrit :**
- **Table `echanges`** (`supabase/schema.sql` section 13, et `supabase/lot4-a-coller.sql` pour Ted).
  Une entrée ne se modifie jamais, elle s'ajoute. `echange_id` est fabriqué par le navigateur,
  comme l'empreinte des ventes : le même geste poussé deux fois ne crée pas de doublon.
- **Écran « Ma journée »**, en tête du menu et écran d'ouverture par défaut. Trois sources : les
  rappels dus, les clients signalés jamais traités, rien d'autre. Plafond de 25 lignes.
- **Trois gestes** : Appelé (+30 j), Laissé un message (+7 j), Pas maintenant (+60 j). Chacun écrit
  au journal, pose un statut et REPOUSSE le rappel.
  Why: sans le report, la ligne reviendrait le lendemain et la file deviendrait un mur.
- **« Pas maintenant » n'a pas de colonne dédiée**, volontairement : un rappel repoussé suffit à
  sortir la ligne, et l'écart laisse une trace au journal comme les autres gestes. Zéro changement
  de schéma sur `suivi_clients`.
- **Journal dans la fiche client**, non modifiable et non supprimable depuis l'écran.
  Why: un historique qu'on peut réécrire ne vaut rien comme historique.
- **Les rappels dus remontent dans `/mon-bureau/`**, sans les noms : ils vivent dans Vitisoft, pas
  chez nous. Le bureau annonce le nombre, le tableau de bord montre qui.
- **`src/rgpd.njk` réécrite**, elle ne disait rien depuis juin.

### L'audit, et ce qu'il a trouvé

Deux agents lancés en parallèle sur le travail : un relecteur de code, un auditeur de cohérence
entre les promesses des pages et ce que fait le code. Les deux ont trouvé du réel.

**Un bloquant** : `FICHE_OUVERTE` porte l'élément DOM à qui rendre le focus, pas un identifiant
client. Mon `if(FICHE_OUVERTE===id)` était donc toujours faux et la fiche ne se redessinait jamais
après un geste : le vigneron aurait tapé sa note, vu le champ se vider, et rien apparaître.
Corrigé par une variable `FICHE_ID` distincte.

**Six sérieux, tous corrigés :**
1. `NOMS_CACHE` n'était vidé nulle part. Pire cas trouvé par l'agent : construit une fois alors que
   `ROWS` est vide, il devient `{}`, qui est *truthy*, et plus aucun nom ne s'affiche de la
   session. Ajouté à `computeMeta()`, avec les autres caches dérivés de `ROWS`.
2. Un clic sur un geste déclenchait **trois** `crmSet`, donc trois POST identiques et trois rendus
   complets, avec scintillement (la ligne restait dans la file aux deux premiers). D'où
   `crmSetPlusieurs()`.
3. Une entrée du journal dont l'envoi échouait n'était **jamais** retentée : le journal est
   immuable, donc rien ne le repoussait, contrairement aux ventes et au suivi. Vingt gestes posés
   sans réseau, puis un changement d'ordinateur, et tout était perdu. Drapeau `_apousser` et
   `echRejouer()` au rapatriement.
4. `lireEchanges` ne paginait pas : PostgREST plafonne à 1000 lignes, le journal aurait été
   silencieusement tronqué au bout de deux ou trois ans, et seulement sur le deuxième appareil.
5. « Vider la base » n'effaçait ni `CRM` ni `ECHANGES` sur l'appareil : le rapatriement suivant les
   **réinstallait** sur un serveur vide. La suppression n'effaçait donc rien de ce que le vigneron
   voyait dans ses fiches. C'était aussi une promesse fausse de la page de confidentialité.
6. `contactTexte()` est une chaîne de recherche (numéro deux fois, sans espaces), pas un affichage.
   Remplacé par `contactCell()`.

**L'audit de cohérence a trouvé pire que des bugs : des promesses fausses.**
- La page annonçait un ciblage « sur tes canaux de vente déclarés ». Aucun champ de ce genre n'est
  collecté, et la seule notion de canal qui existe **vient des lignes de vente** : la phrase
  contredisait frontalement, dans la même page, l'engagement central. Retirée.
- « Quatre questions » alors que le formulaire en pose cinq depuis l'ajout du prénom, et que la
  fenêtre elle-même en annonçait trois. Trois chiffres pour le même formulaire, tous les trois
  corrigés.
- `vu_le`, `outil_origine` et `cree_le` étaient collectés sans être déclarés. `vu_le` est une
  mesure de fréquentation nominative écrite depuis **toutes** les pages du site.
- Google Fonts (États-Unis, toutes les pages), cdnjs, jsDelivr et **Tally** (le formulaire de
  Conseil terrain, qui héberge nom et adresse) n'étaient pas déclarés. Ajoutés.
- L'annexe de sous-traitance était annoncée « disponible sur demande » alors que le dépôt dit
  lui-même qu'elle est reportée. Reformulée honnêtement.
- La désinscription automatique était promise et n'existe pas : `consent_news` n'est jamais écrit
  à `false`. Reformulée en désinscription manuelle, qui est ce qui existe.

### Ce que l'audit a laissé ouvert, et qui demande une décision de Ted

1. **`/outils/dashboard-vigneron-v1/` et `/outils/dashboard-vigneron-mockup/` sont construites et
   publiquement accessibles**, sans compte, sans lien depuis aucun menu. La v1 stocke l'export CSV
   complet en clair dans le localStorage. Ce n'est pas une fuite vers l'extérieur, mais c'est un
   contournement de la porte compte, et une vieille version qui ne porte aucune des promesses de
   la page de confidentialité. Je n'ai rien supprimé : ce sont ses fichiers, il n'était pas là.
2. **`src/cgu.njk` est un TODO vide**, et `mentions-legales.njk` n'a ni adresse, ni SIRET, ni
   capital. La page de confidentialité désigne un responsable de traitement dont l'adresse n'est
   nulle part.
3. **« Données hébergées en Europe »** au pied de chaque page est plus catégorique que la réalité :
   Vercel (États-Unis) sert les pages, Google Fonts est appelé à chaque chargement.
4. La colonne `profils.nom` existe, est accordée en écriture, et n'est remplie par aucun écran.
5. La suppression de compte n'est outillée nulle part, alors que la page annonce trente jours.

### La file passe du tableau de bord au bureau

Retour de Ted : « ça intervient dans le tableau de bord, ça doit venir alimenter la page du bureau
directement, tout sera lié et on évite les doublons ».

**L'arbitrage, et il conditionne tout** : la file a besoin des moteurs d'analyse, qui tournent sur
les lignes de vente, dans le tableau de bord. Le bureau est une page du site, il n'a ni les lignes
ni les moteurs. Recopier les calculs côté site aurait donné deux moteurs qui divergent, et un
bureau qui signale un client que l'outil ne signale plus.
Retenu : **le tableau de bord calcule et dépose, le bureau lit et agit.**

- `fileSignaux()`, `annuaireSuivis()` et `resumeVentes()` déposent dans
  `reglages.file_travail` (forme `{signaux, noms}`) et `reglages.resume_ventes`.
- `src/js/bdv-crm.js`, nouveau, lit ce dépôt plus le suivi en direct, fusionne, trie, porte les
  trois gestes et une file d'attente hors ligne.
- L'écran « Ma journée » a quitté le tableau de bord. Le journal reste dans la fiche client : ce
  n'est pas un doublon, c'est le détail d'un client.

**Ce que ça débloque, et qui n'était pas demandé** : la file s'utilise depuis un téléphone sur
lequel aucun export n'a jamais été importé.

**On ne dépose QUE les signaux.** Les rappels, le bureau les lit lui-même : déposés, ils seraient
figés au dernier import et un rappel posé depuis le téléphone n'apparaîtrait jamais.

### Le second audit, et ce qu'il a rattrapé

**Un bloquant, et il vidait l'intérêt du lot.** `charger()` ne lisait que les rappels ÉCHUS. Un
rappel FUTUR était donc invisible, et n'empêchait rien : un client rappelé le matin revenait dans
la file l'après-midi en « signal », puisque le dépôt du tableau de bord, lui, ne change qu'au
prochain import. Le vigneron rappelait deux fois. Corrigé en lisant tout le suivi : une fiche
existante sort le client de la file, quel que soit son rappel.

**Cinq sérieux :**
1. **Injection HTML.** Le nom du client était protégé, mais `contact` et `detail` étaient encore
   concaténés dans la chaîne HTML avant d'être réécrits. Un `<img src=x onerror=…>` dans un libellé
   de cuvée s'exécutait dès l'affectation de `innerHTML`, sur l'origine où vit le jeton de session.
   Plus aucune donnée du serveur ne rentre dans une chaîne HTML, dans ce fichier.
2. `Promise.all` faisait tomber les rappels quand la lecture des réglages échouait, alors que les
   deux sources sont indépendantes. Passé en `allSettled`.
3. **`BdvCompte.api()` rend `null` sans lever quand la session est tombée.** Un geste posé après
   expiration paraissait réussir, la ligne quittait l'écran, rien n'était écrit : perdu
   définitivement. Le `null` est maintenant traité comme un échec.
4. Un geste raté faisait disparaître la ligne en silence. Elle revient, et un avis le dit.
5. `rejouer()` n'était pas attendu avant `charger()` : les lignes déjà traitées revenaient.

**Et un défaut de fusion, hérité, que le déplacement a rendu grave.** `CRM=Object.assign({},suivi,
CRM)` faisait gagner le local **fiche entière**. Une simple note locale sur un client suffisait à
jeter la fiche serveur, donc à annuler le rappel qu'un geste venait d'y écrire depuis le bureau.
La fusion se fait maintenant champ par champ, et le serveur fait foi sur `statut`, `rappel` et
`canal`, que seul le bureau écrit.
How to apply: cette règle est à tenir. Tout nouveau champ écrit des deux côtés doit être ajouté à
`CHAMPS_BUREAU`.

**Trois mineurs corrigés** : dates calculées en heure locale et non en UTC (entre minuit et deux
heures du matin, un rappel du jour passait à la trappe) ; file d'attente dédupliquée par client ;
annuaire des noms rendu cumulatif et persistant, pour qu'un client absent du dernier export ne
s'affiche pas sous son numéro Vitisoft.

### Les deux blocs de la fiche client n'en font plus qu'un

Retour de Ted sur la fiche : « j'ai un suivi que je ne peux pas enregistrer, il doit fusionner
avec le suivi que tu viens de faire ». Deux problèmes en un, et le second explique le premier.

**Ça enregistrait déjà.** Les champs de « Ton suivi » se sauvent au `onchange`, donc dès qu'on
quitte le champ, et rien ne le disait. Aucun bouton, aucun message : on tape une note, rien ne
bouge, on conclut qu'il manque un bouton d'enregistrement. Rien n'a jamais été perdu.
How to apply: **tout enregistrement automatique doit se voir.** `crmSet` et `crmSetTags` appellent
maintenant `status('success', …)`. Un enregistrement au blur sans retour visible est un
enregistrement auquel personne ne croit.

**Et il y avait bien un doublon.** Les trois gestes du journal écrivent EXACTEMENT le statut, le
rappel et le canal que les trois menus du bloc du dessus proposaient de saisir à la main. Deux
endroits pour un seul état, c'est ainsi qu'on cesse de faire confiance à un outil.

Un seul bloc désormais, dans l'ordre où on s'en sert : l'état courant en une phrase lisible, les
trois gestes, les corrections à la main repliées dans un « Corriger à la main », les étiquettes et
les notes durables, puis le journal. `journalHTML` est devenu `journalCorpsHTML` et a perdu son
enveloppe et ses boutons, qui sont remontés en tête.

**Un piège évité** : la ligne d'état est réécrite par `majEtatSuivi()`, jamais en redessinant la
fiche. Redessiner ferait perdre le focus et le contenu en cours de frappe des autres champs.

**Un piège dans lequel je suis tombé** : le message d'enregistrement s'est d'abord posé à la fin de
`crmSetPlusieurs`, la fonction appelée par les gestes. Chaque « Appelé » annonçait donc
« Étiquettes enregistrées ». Corrigé, mais c'est le genre de décalage d'une accolade qu'une
relecture rapide ne voit pas.

### La fiche de suivi, refaite a zéro

Verdict de Ted sur la capture : « usine à gaz ». Fondé. Trois systèmes empilés faisaient le même
travail : un bloc de réglages (statut, rappel, canal, notes), un journal avec ses propres boutons,
et un rédacteur de message déplié en permanence. Demande explicite : tout effacer, s'inspirer des
bons CRM, recommencer.

**Les deux idées que partagent tous les bons CRM, et sur lesquelles la fiche est reconstruite :**

1. **Un client a une prochaine action, ou il n'en a pas.** C'est l'information la plus importante
   de la fiche : elle est en haut, en clair, et se change en un clic. Sans action prévue, la fiche
   le dit sans détour : « Aucune action prévue. Ce client va sortir de ta tête », avec trois
   raccourcis (7, 30, 90 jours).
2. **Tout le reste est un fil.** Un appel, un message, une note : des événements datés dans UNE
   liste. Une seule zone de saisie, toujours au même endroit, avec le type à côté.

**Ce qui a disparu, et pourquoi :**
- **Le statut** (à faire / relancé / traité). Redondant : un client a une prochaine action ou il
  n'en a pas, c'est le seul statut qui se vérifie tout seul. La colonne reste en base, plus rien ne
  la demande. Seul `traite` subsiste, sous le nom qu'il mérite : « Ne plus me le proposer ».
- **Le canal préféré.** Une préférence qu'on saisissait et que rien ne lisait. Le fil dit par quoi
  on a joint ce client la dernière fois, c'est plus fiable qu'une déclaration.
- **La séparation notes / journal.** C'était la même chose écrite deux fois. Les notes déjà
  écrites ne sont pas perdues : elles ouvrent le fil, épinglées, avec un lien pour les retirer.
- **Le rédacteur de message** est replié derrière « Écrire un message à ce client ». C'est un
  assistant de rédaction, pas du suivi.

**Le geste central** : on tape ce qui s'est passé, on choisit le type, on enregistre. Et si aucun
rappel n'est posé, le message d'après le demande immédiatement.
Why: un CRM ne laisse jamais une fiche sans prochaine action après qu'on y a touché. C'est la
seule discipline qui empêche un client de sortir de la tête.

**À tenir** : `redessinerSuivi()` ne redessine que le bloc de suivi, jamais la fiche entière. Un
`ouvrirFiche()` ferait perdre le focus et le texte en cours de frappe.

### Le bureau, refait a zéro lui aussi

Capture de Ted : quarante lignes identiques, toutes « Recul confirmé », empilées sur une colonne
étroite. Demande : effacer, recommencer, prendre toute la largeur, rendre les informations
cliquables, et présenter les choses pour qu'on retrouve ses affaires comme sur un bureau.

**Le vrai problème n'était pas la mise en page.** « 40 à traiter » n'est pas une journée, c'est un
mur, et un mur on cesse de le regarder. La file montre désormais **cinq lignes**, avec le reste à
un clic dans le tableau de bord.
How to apply: ne jamais remonter ce plafond pour « montrer plus ». Une file qu'on peut finir est
une file qu'on ouvre le lendemain.

**Sept zones nommées, toujours à la même place**, parce qu'on ne cherche pas ses affaires sur un
bureau : **le sous-main** (la file, la plus grande surface, c'est là qu'on travaille), **le
pense-bête** (l'échéance qui tombe), **l'ardoise** (les chiffres déposés), **à lire**, **le
classeur**, **le courrier**, et **le tiroir** (les outils, en bas, parce qu'on l'ouvre rarement).

**Tout est cliquable, et mène à la bonne page** :
- une ligne de la file ouvre **la fiche du client** dans le tableau de bord, pas une liste où il
  faudrait le rechercher. Nouveau format d'adresse : `/outils/dashboard-vigneron/#client=<id>`.
- l'échéance ouvre l'article correspondant, un chiffre de l'ardoise ouvre « Mon année ».
- les trois gestes restent dans la ligne, et leur clic ne suit pas le lien (`stopPropagation`).

**La grille tient sur douze colonnes.** Une grille en « 2fr 1fr » laissait des trous dès la
troisième zone, parce que le placement automatique ne sait pas où couper. En douze colonnes chaque
rangée tombe juste : 8+4, puis 4+4+4, puis 6+6. À 1100 px le sous-main passe pleine largeur et le
reste se range par deux ; à 700 px tout s'empile, **sans jamais changer l'ordre des zones**.

**Nettoyé** : les styles de l'ancienne page (`filel`, `presse`, `bureau-colonnes`,
`bureau-fiche`, `bureau-ecran`) ont été retirés de la feuille, pas seulement abandonnés.

### La fiche de suivi s'ouvre dans le bureau

Ted : « quand tu arrives sur les voir tous, j'ai plus rien ». Deux pistes proposées de son côté :
ouvrir la fiche client en surimpression depuis le bureau, ou garder un « Ma journée » dans le
tableau de bord.

**Retenu : la première, et elle rend la seconde inutile.** Le saut vers le tableau de bord était le
défaut de conception : on quittait le poste de travail pour retrouver une liste d'analyse, qui
n'est pas la même chose qu'une file.

- **« Voir les N autres » déplie la file sur place**, dans le bureau. Plus aucun saut.
- **Un clic sur une tâche ouvre la fiche de suivi en surimpression** : nom, coordonnées cliquables,
  prochaine action avec ses raccourcis, une zone de saisie, et le fil des échanges chargé à la
  demande. Un lien mène à la fiche complète du tableau de bord pour qui veut le détail.
- Une ligne de file est devenue un `<button>` et non un `<a>` : elle n'ouvre plus une page.

**La frontière tenue** : cette fiche montre ce que la BASE sait du client. Pas ses ventes, ses
cuvées ni ses factures : ces chiffres sont calculés par le tableau de bord, et le bureau ne
recalcule jamais rien. C'est la même règle depuis le début.

**Pourquoi PAS de « Ma journée » dans le tableau de bord** : ce serait le doublon qu'on a retiré il
y a deux lots, à maintenir en double, et l'écran « Mes clients » fait déjà ce travail avec ses
filtres par motif. Le bureau est le poste de travail, le tableau de bord est l'atelier d'analyse.

**Non diagnostiqué, et à ne pas oublier** : ce que Ted voyait exactement en arrivant sur
`#clients`. Le lien a disparu du bureau, mais si l'écran « Mes clients » se rend vide dans certains
cas, le défaut est toujours là, en dessous. À reproduire avec lui.

### Les chiffres et le mot du jour

Demande de Ted : des KPI et des conseils journaliers dans le bureau, « une amélioration au top ».

**Deux réflexes évités.** Empiler des chiffres, alors que c'est exactement ce qu'il a critiqué deux
fois. Et inventer des conseils, alors que le tableau de bord en **produit déjà** : `diagnosticSignals()`
assemble les verdicts de tous les agents, triés par gravité puis par euros en jeu, chacun avec sa
phrase de constat et sa phrase d'action. Ils n'étaient simplement jamais sortis de leur écran.

**Le mot du jour.** UN conseil, pas six, déposé avec la file. Les conseils informatifs (sévérité 0,
du type « ton mois le plus creux est février ») sont écartés : vrais toute l'année, donc jamais un
conseil du jour.
Why: « journalier » veut dire qu'il tourne. Un paragraphe qui ne bouge pas finit par faire partie
du décor et plus personne ne le lit. La rotation est calée sur le jour de l'année : stable dans la
journée, différente le lendemain, et rien à mémoriser côté serveur.
How to apply: **les conseils graves ne tournent pas.** Un décrochage à 8 000 € reste en tête tant
qu'il est vrai. Ne fait tourner que ce qui peut attendre.

**L'ardoise dit maintenant quelque chose.** Un chiffre d'affaires seul ne renseigne personne : le
premier chiffre porte sa variation vs l'exercice précédent **à date égale**, et son liseré passe au
vert ou au rouge. L'objectif dit ce qu'il reste à faire ; sans objectif fixé, c'est l'atterrissage
projeté qui prend sa place, plutôt qu'une case vide.
Le vert et le rouge ne servent QU'À ça dans le bureau : ailleurs, ils ne voudraient plus rien dire.

**La grille passe à huit zones**, et les rangées tombent toujours juste : sous-main (8) + mot du
jour (4), ardoise (8) + pense-bête (4), les trois piles de lecture (4+4+4), le tiroir (12).

### Le panneau, la personnalisation et les réglages depuis le bureau

Demande de Ted : un tableau de post-it avec de **vrais** KPI **en plus** de ce qui existe ; qu'on
lui parle par son prénom et le nom de son domaine, et sa question — « est-ce déjà intégré dans
l'onboarding ? » ; pouvoir modifier ses informations et le reste des réglages depuis le bureau.

**Réponse à sa question.** Oui, l'inscription collecte déjà cinq réponses : prénom, métier, domaine
ou structure, code postal, usage de Vitisoft. Mais **seul le prénom servait à quelque chose** (le
bonjour de l'en-tête), le nom du domaine était demandé et n'était affiché nulle part, et **aucun
écran ne permettait de revenir dessus** après l'inscription. L'objectif de CA et le mois d'exercice,
eux, ne se réglaient que dans un écran interne du tableau de bord.

**Le panneau de liège, et la règle qui l'autorise à exister.** Deux tableaux de chiffres sur une
même page, et l'un des deux cesse d'être lu. Ils ne coexistent qu'à une condition : **l'ardoise
mesure le domaine** (ce qui est rentré, où en est l'objectif), **le panneau mesure le vigneron**
(ce qu'il a fait, ce qu'il s'est promis, depuis quand ses chiffres n'ont pas bougé). Aucun chiffre
de vente sur le panneau, aucun chiffre d'activité sur l'ardoise.
Les cinq punaises : gestes cette semaine (comparés à la semaine passée **au même jour**, sinon tous
les mardis annoncent « -9 » pour la seule raison qu'on est mardi), moyenne sur quatre semaines,
rappels à venir avec la date du prochain, clients au carnet, âge de la dernière analyse — qui passe
en alerte au-delà de trente jours, parce qu'une ardoise de six semaines est fausse sans que rien ne
le dise.
Rien n'est recalculé : les gestes viennent du journal d'échanges, les rappels du suivi client, l'âge
de la date de dépôt.

**La plaque de porte.** Le bonjour suit l'heure, et le nom du domaine est gravé dessous, avec le
métier. Sans prénom ni domaine, la plaque devient une invitation à se présenter, qui ouvre les
réglages. Un cadre vide annonçant ce qui manque se remarque plus qu'une absence : la plaque
n'apparaît que s'il y a un nom.

**Les réglages, en surimpression depuis l'en-tête.** Deux tables dans une seule fenêtre : `profils`
pour qui il est, `reglages` pour son objectif et son mois d'exercice. Un upsert PostgREST ne touche
que les colonnes présentes dans le corps : écrire l'objectif depuis le bureau ne peut donc pas
effacer la file déposée par le tableau de bord, ni les libellés perso, ni le classement.

**Ce que l'audit a rattrapé, et qui aurait coûté cher.** Sept bloquants, dont trois du même genre :
- Le formulaire envoyait **les six colonnes du profil** à chaque enregistrement. Ouvrir la fenêtre
  avant la réponse réseau, puis cliquer « Enregistrer », écrivait des champs vides par-dessus les
  réponses de l'inscription — code postal effacé, métier effacé, et une **désinscription silencieuse
  de la lettre**. Désormais : verrou tant que le profil n'a pas été relu, et seuls les champs
  modifiés partent.
- Même mécanique côté `reglages` : saisir un objectif avant que `charger()` ait répondu remettait
  `exercice_debut` à nul. Le mécanisme de l'upsert protège les colonnes absentes, pas une colonne
  présente avec une mauvaise valeur.
- `majProfil()` **rendait sans écrire** quand la session avait expiré : l'écran affichait « c'est
  enregistré » sur une saisie perdue. Il lève, maintenant. Et les deux écritures partent en
  `allSettled` : avec `all`, un refus sur le profil faisait annoncer « rien n'est parti » alors que
  l'objectif, lui, était bien en base.

**Trois pannes muettes, plus anciennes, corrigées au passage :**
- `noter()` et `ecrireEchange()` utilisaient `Prefer: return=minimal`. PostgREST rend alors un corps
  vide, `BdvCompte.api()` rend `null`, et `null` était le signal d'échec : **toute note écrite était
  annoncée au vigneron comme un échec**. `return=representation` lève l'ambiguïté.
- `fil()` transformait toute panne en tableau vide : une table `echanges` absente affichait « rien
  encore » sur un client qui porte trente échanges. Rend `null` maintenant, et la fiche le dit.
- Le message d'erreur d'une note s'écrivait dans le sous-main, **derrière le voile** de la fiche
  ouverte : invisible sur le moment, et découvert plus tard hors contexte. La fiche a son propre avis.

**Deux corrections de fond sur les gestes, trouvées au second passage :**
- `echange_id` était refabriqué **à chaque tentative**, ce qui rendait le `on_conflict
  (id, echange_id)` inopérant : une réponse perdue après une écriture réussie donnait deux
  entrées au journal pour un seul appel passé. Il est fabriqué une fois, au moment du geste, et
  rejoué tel quel.
- Un geste écrit deux choses qui ne valent pas la même : le **suivi** (le rappel repoussé, la ligne
  qui quitte la file) et le **journal** (la mémoire de ce qui s'est dit). Le suivi passé et le
  journal tombé, le geste a bien eu lieu : la ligne doit rester partie et seule l'entrée du journal
  se rejoue. Les traiter en bloc faisait revenir la ligne à l'écran alors que le rappel était déjà
  repoussé en base, puis repartir à la lecture suivante — elle clignotait, et le message la
  contredisait.

**Et une promesse du code qui n'était pas tenue :** « il peint d'abord le miroir, puis se corrige
quand le réseau répond ». Le script en ligne s'exécute pendant l'analyse du document, donc avant les
modules chargés en `defer` : `window.BdvCrm` n'existait pas encore, et le premier dessin n'avait lieu
qu'après deux allers-retours réseau. Le miroir est peint au `DOMContentLoaded`, avant tout appel.

### Reste à faire sur l'expérience, par ordre d'impact

1. Le domaine.
2. Le premier écran ne montre aucun article : un « média de référence » doit montrer du contenu
   avant un formulaire. Hero à raccourcir, ou première carte à faire remonter.
3. Les cartes d'articles réservent 190 px pour une image qu'aucun des vingt articles ne possède.
   Soit des visuels, soit pas de place réservée.
4. Le titre de l'onglet est doublé sur l'accueil (« Le Bureau du Vigneron — Le Bureau du
   Vigneron ») : le gabarit ajoute le nom du site à un titre qui est déjà le nom du site.
5. `/articles/` n'a aucun filtre alors que chaque article porte un pilier et une catégorie.
6. Le bouton fantôme du hero (« Créer mon compte ») est posé sur l'écran de l'ordinateur de la
   photo, et s'y perd.
7. Les deux autres compteurs restent écrits en dur (« 3 podcasts en route », « 8 partenaires en
   discussion ») : eux, seul Ted peut les tenir à jour.

### Piège rencontré

**Une réécriture Python en mode texte convertit les fins de ligne sans le dire.** `src/teddy.njk` et
`src/articles.njk` étaient en CRLF : après un simple remplacement d'attribut, le diff annonçait 86
et 172 lignes modifiées au lieu d'une. Restauré. À vérifier au `git diff --stat` après toute
modification en lot, et pas seulement à la relecture du texte, qui ne montre rien.

### Reste ouvert

1. `/mon-bureau/` n'existe pas encore. Tant qu'il manque, un inscrit sans Vitisoft n'a nulle part
   où aller : la page `/compte/` lui affiche son état connecté et c'est tout.
2. L'écran 2 des trois questions est décidé mais pas écrit. La colonne « utilise Vitisoft » n'existe
   pas encore dans `profils`.
3. La table `signets` reste à créer, sur le motif de `suivi_clients`.
4. `src/rgpd.njk` ne nomme toujours aucun sous-traitant, et ne dit rien du profil ni des annonces.
   À faire avant le premier euro encaissé sur Vitimedia.
5. Les tirets cadratins interdits par la règle de contenu sont toujours là : `footer-rich.njk`,
   `base.njk`, `hero.njk` et l'ensemble des articles.
6. Commentaire à jour à vérifier dans le tableau de bord, ligne 2117 : « Objectif de CA annuel,
   mémorisé dans le navigateur » alors que l'objectif vit maintenant dans la table `reglages`.

---

## Session du 04 au 06/09/2026, les comptes et le passage en base

### Le virage

Le projet change de nature. Avant : un outil local, gratuit, qui promettait par écrit que rien ne
quittait le navigateur du vigneron, plus une liste d'attente Tally pour collecter des adresses.
Après : un compte obligatoire, l'inscription sur le site à la place du Tally, et les données du
vigneron gardées sur Supabase pour lui être rendues sur n'importe quel appareil.

### Les décisions prises, dans l'ordre

**L'inscription se fait sur le site, plus sur Tally.** Le formulaire `yPokbX` est retiré des deux
endroits où il vivait, `waitlist.njk` et `podcast-teaser.njk`. Le formulaire de conseil `nPg55B`
reste : ce n'est pas la liste d'attente, c'est le contact de l'offre payante.

**Une page `/compte/` ET une fenêtre ouvrable partout.** Le `href` des boutons reste une vraie
adresse, ce qui fait que le lien marche sans JavaScript, reste partageable et s'ouvre normalement
dans un nouvel onglet. L'interception ne remplace qu'un changement de page par une surimpression.

**Le tableau de bord est barré. Rien n'est visible sans compte**, pas même la zone de dépôt.
Décision de Ted contre ma recommandation. Je conseillais de garder « déposer d'abord, compte au
moment des résultats », qui convertit mieux parce qu'on demande après avoir prouvé. Si les
inscriptions déçoivent, c'est le premier levier à retester, et le code à changer est le bloc INIT
en fin de `dashboard-vigneron.html`.

**Les quarante-huit boutons `#waitlist` sont rebranchés.** Quarante-six vers la fenêtre de compte,
huit vers le formulaire de conseil (« Demander un devis », « Étudier mon dossier », « Devenir
partenaire »), et deux rendus non cliquables : « Exporter mes données » et « Supprimer mon compte »,
qui sont des étiquettes de la maquette. Envoyer quelqu'un qui clique « Supprimer mon compte » vers
un formulaire de création de compte était le pire enchaînement possible du site.

**L'import déménage dans « Ma base ».** Ajouter un export ne fait plus sortir de l'outil.

**Mention « Réservé aux utilisateurs de Vitisoft »**, sur l'écran d'arrivée, dans « Ma base », sur
`/compte/`, sur la page d'accueil, et dans les trois descriptions pour les moteurs de recherche.

**Les réglages, le suivi client et les lignes de vente vont en base.** Ted a écarté explicitement
le débat, avec trois arguments : rien n'est déployé chez un client, la promesse « rien ne quitte le
navigateur » était déjà cassée par la décision sur le suivi client prise le matin même, et les
questions juridiques, de sécurité et l'arbitrage avec son associé seront vues après.

**La promesse de confidentialité est retirée partout où elle traînait**, y compris le pied de page
et les descriptions pour les moteurs. Elle n'est **pas** remplacée par la promesse inverse : tant
que la synchronisation n'est pas éprouvée en vrai, écrire « tes données sont hébergées chez nous »
serait faux dans l'autre sens. Cette phrase s'écrit quand ça marche.

**Le mot de passe passe en complexité maximale** (minuscule, majuscule, chiffre et symbole).
Décision de Ted contre ma recommandation, qui était de n'exiger que huit caractères pour un public
vigneron souvent sur téléphone.

### L'architecture retenue pour la synchronisation

IndexedDB reste la source de calcul, le serveur ne fait que garder et rendre. C'est ce qui fait
qu'aucun des treize écrans n'a eu besoin d'être réécrit, et qu'une panne réseau ne casse rien de
visible. La table `ventes` ne porte que la ligne brute et son empreinte, jamais de colonne calculée :
une colonne dérivée en base créerait une seconde vérité qui divergerait dès que `classerLigne()`
changerait d'avis, sans que rien ne le signale.

Rien de la synchronisation ne peut empêcher l'outil de s'ouvrir. Toutes les écritures partent en
tâche de fond et échouent en silence. Seul le rapatriement au démarrage est attendu, parce que
l'affichage en dépend.

### Ce qui a été écrit

- `supabase/schema.sql` sections 6 à 10, **appliquées en base** par deux migrations. Trois tables
  (`reglages`, `suivi_clients`, `ventes`), RLS active, quatre politiques chacune, `anon` sans aucun
  droit dessus. Plus `effacer_mes_donnees()`, bornée au compte appelant.
- `src/js/bdv-sync.js`, nouveau.
- `src/compte.njk`, nouveau.
- `src/js/bdv-compte.js` : liste des conditions de mot de passe cochée à la saisie, ouverture depuis
  n'importe quel bouton, accès PostgREST exposé pour la synchronisation.
- `src/outils/dashboard-vigneron.html` : verrou d'entrée, import dans « Ma base », onze points
  d'accroche de synchronisation, clé client unifiée.
- Quarante-et-un fichiers modifiés au total, vingt articles compris.

### Ce qui a été vérifié

- Trois tables : RLS active, quatre politiques, `anon` sans droit. Contrôlé en base.
- Le contrôleur de sécurité Supabase remontait cinq avertissements. Quatre venaient du lot
  précédent, `creer_profil()` et `synchroniser_email_profil()` étant appelables depuis l'extérieur
  alors que ce sont des fonctions de déclencheur. Fermées. Le cinquième concerne
  `effacer_mes_donnees()` et c'est voulu.
- `node --check` passe sur les quatre fichiers JavaScript et sur les deux blocs de script du
  tableau de bord.
- Contrôle de charte du site : **conforme**.

### Les pièges rencontrés, à ne pas réapprendre

**La définition de `clientKey()` contient le motif qu'elle sert à remplacer.** Une réécriture
automatique naïve la transforme en `function clientKey(r){return clientKey(r);}`, une récursion
infinie qui gèle le navigateur au premier client affiché. La vérification avant écriture l'a
attrapée. Toute passe automatique doit mettre la définition de côté d'abord.

**Un réglage serveur recopié en dur dans le code finit par diverger, et la panne est muette.**
Deux fois dans la même session. `MDP_MIN` à 8 pendant que Supabase exigeait de la complexité : le
message d'erreur disait « mot de passe trop court » à quelqu'un dont le mot de passe faisait douze
caractères. Puis la longueur du code de confirmation, figée à 6 dans le champ pendant que Supabase
en envoyait 8 : les deux derniers chiffres refusaient de s'écrire, sans un seul message. Un
utilisateur dans ce cas n'écrit pas, il ferme l'onglet.

**Eleventy ne recopie pas les fichiers de `src/js/` quand ils sont modifiés à travers le pont
Cowork.** Ted a testé pendant une heure un champ corrigé, en exécutant l'ancienne version : la
source datait de 10h52, la copie servie de 09h10. Les fichiers `.html` étaient à jour, eux. Après
toute modification dans `src/js/`, redémarrer `npm start`, et un rechargement forcé du navigateur ne
suffit pas si `_site` est périmé.

**Resend ne fabrique pas les codes.** C'est un relais SMTP. La longueur du code se règle dans
Supabase, `Authentication` puis `Providers` puis `Email`, ligne `Email OTP Length`.

### Reste ouvert

1. Le test de bout en bout : créer un compte, importer, puis se connecter depuis une fenêtre de
   navigation privée et vérifier que les lignes reviennent. C'est ce test qui valide tout le lot.
2. Les questions juridiques, de sécurité et la discussion avec l'associé. Reportées explicitement.
   `src/rgpd.njk` ne nomme aucun sous-traitant, `src/mentions-legales.njk` ne nomme que Vercel.
   Ni Supabase ni Resend n'y figurent.
3. Le pont MCP Supabase est encore en configuration large. Avec les ventes en base, une requête peut
   remonter des noms de clients et des montants réels dans un contexte d'IA.
4. Retirer le domaine racine de Resend, une fois les deux envois testés.
5. `npm run charte:dash` dit NON CONFORME en permanence avec 54 échecs, et c'est le script qui a
   tort : les tokens qu'il déclare manquants sont tous déclarés. Tant que ça dure, ce contrôle
   n'alerte plus de rien.
6. `CLAUDE.md` annonce `npm run verif:site` et `verif:dash`, `package.json` déclare `charte` et
   `charte:dash`. L'un des deux est à corriger.
7. Les articles sont pleins de tirets cadratins, que la règle de contenu du projet interdit.
8. Les inscrits du Tally n'ont pas de compte. Le jour du basculement, l'envoi part de `edition.`,
   jamais de la racine.

### Les deux écarts assumés dans la synchronisation

- L'import renvoie toutes les lignes lues, pas seulement les nouvelles. `dbAddMany` ne dit pas
  lesquelles il a retenues et le serveur fusionne les doublons. C'est du réseau pour rien, mais
  c'est sans risque, alors qu'un suivi approximatif de « ce qui est nouveau » laisserait des trous.
- Le local gagne sur le serveur pour le suivi client. Une note écrite ici et pas encore partie ne
  doit pas être effacée par une version plus ancienne. Conséquence : une fiche supprimée sur un
  autre appareil peut ressusciter sur celui-ci.

---

## Sessions antérieures, reconstituées

### 03/09/2026

Position prise par Ted sur la collision entre le tableau de bord local et le projet serveur
« Monétisation Datas » de Solumatic : deux produits et deux promesses, Le Bureau gardant l'outil
local gratuit, le produit synchronisé se vendant sous marque Vitisoft. **Cette position n'a jamais
été actée avec son associé**, et la session du 04 au 06/09 la contredit en partie, puisque Le Bureau
synchronise désormais lui aussi.

### 01/09/2026

Le lot des comptes passe de « email plus code à six chiffres » à « email plus mot de passe », le
code ne servant plus qu'à confirmer une adresse et à reprendre un mot de passe oublié. Motif : la
connexion par code consommait un e-mail à chaque ouverture, donc le plafond gratuit de cent par jour
pouvait empêcher un vigneron d'accéder à ses propres données un jour d'envoi de newsletter.

Socle des comptes appliqué en base : table `profils`, RLS, droits colonne par colonne, deux
déclencheurs. Sous-domaine d'envoi `courrier.lebureauduvigneron.fr` créé et vérifié.

Séparation en deux sous-domaines d'envoi retenue : `courrier.` pour le transactionnel, `edition.`
pour la newsletter, et le domaine racine doit sortir de Resend. Motif : la réputation d'envoi, et
surtout le fait que la racine porte la boîte mail de Ted.
