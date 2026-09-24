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

## 24/09/2026. Le détail d'une commande dans la fiche client

Ted : « on aurait le détail de cette commande quand on clique dessus, dans une petite modale ? ».
Arbitrage de Ted : un DÉPLIANT sous la ligne, pas une modale. La fiche est déjà une modale ou un
tiroir, et une fenêtre par-dessus une fenêtre casse le clavier et cache la liste qu'on compare.
Chaque ligne de « Ses commandes » s'ouvre sur : numéro de facture, chaque vin avec son format,
quantité, prix unitaire et total. Ce sont exactement les lignes qui font le montant affiché
au-dessus, donc le détail tombe juste. Un prix unitaire absent de l'export reste une case vide,
jamais un « 0 € ». Un seul arrêt clavier par ligne (le bouton de la date), un seul écouteur
délégué, parce que la fiche est réécrite à chaque geste.

---

## 24/09/2026. Le calendrier flottant s'arrête à l'ardoise

Ted : « le calendrier est flottant mais s'arrête à l'ardoise bien entendu ». Mesure faite, il ne
s'arrêtait PAS : il glissait par-dessus l'ardoise en fin de liste, parce que le navigateur borne
un bloc collant à son parent et non à sa case de grille. Corrigé en deux étages : la zone
s'étire sur la rangée, la carte à l'intérieur (`.zone__flotte`) colle, et elle s'arrête au bas
du sous-main. Vérifié : en fin de défilement, le bas du calendrier tombe pile sur le bas du
sous-main, 16 px au-dessus de l'ardoise.

---

## 24/09/2026. Le mot du jour monte entre le salut et la lune

Ted : « les mots du jour interactifs, place-les en haut, entre la lune et Bonjour Ted, dans une
espèce de cadre stylé ». La zone déménage dans le bandeau d'accueil sans changer de balisage ni
de code, dans une carte à filet d'accent. L'ordre des zones gardé par `npm run banc` passe de
huit à sept, et un contrôle vérifie la nouvelle place.

Signalé, non corrigé : à 390 px, la note du sous-main (`#fileNote`) déborde de 120 px et fait
défiler la page en largeur. Et la grande lune du bandeau d'accueil reste un disque sombre en
clair (ses couleurs ne sont repeintes que sous `.bureau-tete`).

---

## 24/09/2026. La lune monte dans le bandeau, et la barre se replie

Ted, capture à l'appui : « pas fan de la lune comme ça, pas assez gros », puis, sur la
proposition de la fusionner avec le bandeau rouge au défilement : « ultra stylé ça, comme ça la
lune reste entière. Et on devra pouvoir ranger la barre latérale. »

- **La lune du coin grandit** : dessin de 20 à 32 px, centré sur l'axe des icônes du rail, nom
  en entier sur deux lignes (plus de « Lune gibbeuse crois… »), pourcentage dessous.
- **Au défilement, au-dessus de 900 px, elle monte dans le bandeau rouge**, à l'aplomb du rail,
  en crème, entière, et redescend quand on remonte. Un seul élément qui déménage
  (`logerLune()` dans `mon-bureau.njk`), jamais une deuxième lune.
- **Conséquence voulue** : dans le bureau, le logo du bandeau s'aligne sur le nom de la pièce au
  lieu d'être centré sur 1100 px. Sans ça, entre 901 et ~1420 px, la lune chevauchait le logo.
- **La barre se replie**, bouton en bas du rail, icônes seules à 64 px, jamais à zéro. Clé
  `bureau_rail_v1`, hors du préfixe `bdv_` (survit à la déconnexion, comme le thème). Le repli
  supprimé le 07/09 revient donc, sous la seule forme que la règle de l'époque autorisait.
- **Entre 901 et 1180 px la largeur décide seule** : la colonne passe à 64 px. Elle restait à
  184 px pour neuf icônes centrées, les noms étant déjà cachés par `style.css`.
- **Même passe, deux demandes de plus** : le bloc calendrier de Ma journée flotte à côté du sous-main
  pendant qu'on fait défiler, et toute la ligne d'un client du sous-main ouvre sa fiche (le nom
  reste le seul bouton, le clic ailleurs lui est rendu).
- `npm run banc` garde le nouveau repli (7 contrôles à la place des 3 qui gardaient sa
  suppression). `banc:poids` passe à **119,9 ko sur 120** : le commentaire de `logerLune()` a dû
  sortir du script en ligne pour tenir. La prochaine ligne de script en ligne fera déborder.

---

## 24/09/2026. L'en-tête flottant redessiné : « Le Cadre »

Ted : « mouais c'est vraiment bof, appelle un agent design ». Un agent design a dessiné trois
pistes (A « Le Registre », B « La Console », C « Le Cadre »), maquettes et contrastes à l'appui.
**Ted a choisi C.**

- L'en-tête et la barre des pièces prennent le même gris et font un cadre en L autour du travail.
  La lune s'installe dans le coin au-dessus des pièces (phase, puis pourcentage) ; le nom de la
  pièce tombe à l'aplomb des cartes.
- **La lune est corrigée** : la part éclairée était peinte en encre foncée, une lune presque pleine
  se lisait comme un disque noir. Deux jetons neufs, `--bdv-lune-clair` et `--bdv-lune-ombre`,
  dans les trois blocs de `bdv-theme.css` et dans `tokens.css`. Le grand bloc de Ma journée n'a
  pas été touché.
- Les états sont des pastilles teintées avec icône (calendrier orangé, téléphone bordeaux), et
  passent en forme chiffrée quand la place manque (téléphone, écrans moyens, en-tête rétracté,
  « Mettre à jour » affiché).
- « Mes réglages » prend une icône ; « Me déconnecter » aussi, visible seule sur téléphone.
  `brancherSortie()` réécrit maintenant le MOT du bouton, plus le bouton entier.
- Le CSS de la piste est posé en fin de `bdv-bureau.css` (section « Le Cadre », règles à (0,3,0)) ;
  la section 3 ter du matin est retirée. Deux corrections du jet de l'agent : les variantes
  sombres écrites hors du scope `.bdv-coque` (refusées par la charte) remplacées par les jetons,
  et un `z-index:-1` qui ajoutait une neuvième couche.
- Mesuré à 1440, 1500, 1300, 1181, 1000, 760 et 390 px, deux thèmes : hauteur 56 px au repos,
  44 px rétracté, aucune pastille rognée, aucun débordement.

## 24/09/2026. L'en-tête du bureau reste à l'écran, avec la lune et la période

Trois options proposées à Ted (A : en-tête collé ; B : A + bandeau du site retiré du bureau ;
C : A + la période qui remonte dans l'en-tête). **Il a choisi C.**

- L'en-tête est collé sous le bandeau du site sur ordinateur (il l'était déjà sur téléphone), et se
  tasse de 56 à 44 px au défilement : la date part, la lune ne garde que son dessin.
- **La lune remonte en version courte** (dessin, phase, pourcentage), peinte par le même calcul que
  le grand bloc de « Ma journée ». C'est un retour assumé sur la décision du 21/09. Sous 1280 px la
  phrase part, le dessin reste ; sur téléphone, le dessin seul.
- **Le résumé devient des liens** : l'échéance mène au calendrier, les clients à rappeler et les
  articles à Ma journée.
- **La période** : dans « Mon cap », quand la barre des dates passe sous l'en-tête, un sélecteur
  « Période » apparaît dans l'en-tête (`miroirPeriode()`, `majPeriodeTete()`). C'est un miroir, il
  appelle `setExercice()` et `setPeriode()`. Le collage de la barre du matin est retiré ; `clip` sur
  `.content` reste. Pas sur téléphone.
- Mesuré à la capture : 1440, 1100 et 390 px, deux thèmes, aucun débordement. À 1100 px le résumé
  se coupe plutôt que de pousser la page.

## 24/09/2026. « À regarder en priorité » rejoint le dépliant du cap

Demande de Ted : les signaux entrent dans le même dépliant que le bandeau et les trois cartes, et le
titre devient une invitation à cliquer : « Ouvre ton cap et tes priorités : -26,1 % à date,
atterrissage 223 302 €, 3 points à traiter » (ou « rien d'urgent »). Tant que les lignes ne sont
pas chargées, le titre ne compte pas les points : on ne compte pas ce qu'on n'a pas calculé.

## 24/09/2026. Le cap passe sous un dépliant

Demande de Ted, choix « bandeau + Où en es-tu » : le bloc « -26,1 % » et les trois cartes
(réalisé, atterrissage, écart à l'objectif) avec leurs notes passent dans un dépliant fermé
(`replierCap()` dans `bdv-ecrans.js`). « À regarder en priorité » remonte en tête. Le titre garde
les deux chiffres qui répondent à « où j'en suis » : « Ton cap 2026/27 : -26,1 % à date,
atterrissage 223 302 € ». Aucun graphique dedans, donc pas de piège de canevas à hauteur zéro.

## 24/09/2026. La barre de période de Mon cap reste à l'écran

Ted : « les dates restent flottantes, c'est pas utilisable sinon ». La barre est collée sous
l'entête du site (`top: var(--h-entete)`), sur ordinateur seulement : sur téléphone elle fait trois
rangées de chips et mangerait l'écran. La vraie cause qui empêchait tout collage : `.content`
portait `overflow-x: hidden`, qui en fait un cadre de défilement. Passé à `clip`, qui coupe pareil
sans créer de cadre. Vérifié dans un navigateur en faisant défiler : la barre reste en place à
1440 px, reste dans le flux à 390 px.

## 24/09/2026. « D'où vient ta variation » se replie dans Mon commerce

Demande de Ted. Le bloc passait avant « Qui rappeler », la liste pour laquelle on ouvre la pièce.
Il explique sans faire agir : troisième étage de la règle des trois étages, donc replié par défaut
(`replierVariation()` dans `bdv-ecrans.js`, même habit que les pieds de Mon cap et Mes cuvées).
Le total reste dans le titre du dépliant (« … à date égale : -25 564 € ») pour se lire sans ouvrir.
Le cas « décomposition indisponible » est replié de la même façon.

## 24/09/2026. Le bouton « Charger mes lignes et compléter » monte dans l'en-tête

Capture de Ted sur « Mon cap » : « ce bouton est clairement pas cool, il apparaît dans d'autres
bases ». La carte était posée en bas de trois écrans (Mon cap, Mon commerce, Mes cuvées), sous la
ligne de flottaison, avec trois phrases différentes.

**Ce qui change.**

- La carte disparaît des trois écrans. `noteComplement()` garde son nom et ses appelants mais ne
  dessine plus rien : elle retient la phrase de l'écran.
- Un seul bouton, `#bureauMaj`, « Mettre à jour », dans l'en-tête, à gauche de la bascule de thème.
  Il porte l'accent, il pulse trois fois en apparaissant, puis reste plein. Son nom accessible est
  la phrase de l'écran (« Il manque ici les signaux… »).
- `besoinMaj()` dans `bdv-ecrans.js` décide seul : écran de vente incomplet, lignes pas chargées,
  base pas vide. `bdv-nav.js` le cache en quittant une pièce de vente.
- Sur téléphone, l'icône seule en 44 × 44, et la date de l'en-tête se coupe au lieu de passer sous
  le bouton (débordement de 3 px mesuré à 390 px).

**Deux choix faits sans demander, à rouvrir si Ted n'est pas d'accord.**

1. **Le bouton n'existe que quand il sert.** Resté affiché une fois les lignes chargées, il devrait
   dire « à jour », et ce serait un témoin de synchronisation qui ne lit aucune source : CLAUDE.md
   l'interdit pour cet en-tête.
2. **Trois pulsations, pas un clignotement continu.** WCAG 2.2.2 : un mouvement de plus de cinq
   secondes doit pouvoir s'arrêter. 3 × 1,4 s = 4,2 s. `prefers-reduced-motion` le coupe.

**Vérifié** : les 40 étapes de `npm run verif` une par une, toutes vertes (`build` bloqué par le pont,
contourné comme d'habitude, et `banc:poids` rejoué après le dégraissage que le crochet n'a pas pu
faire). `banc:amorcage-leger` réécrit : il exige le bouton visible, son nom qui dit ce qui manque,
et l'absence de la carte. Capture des deux thèmes aux deux largeurs.

## 24/09/2026. La fiche d'une cuvée n'affichait aucun conditionnement

Capture de Ted sur « Le Miracle » : le titre « Conditionnements » et rien dessous.

**La cause.** Depuis le lot 26, `cuvees_resume()` calcule le volume par conditionnement mais ne
rend que le DOMINANT, celui qui porte la fourchette de prix. Côté navigateur, `agentProduits()`
remplissait le détail avec un objet vide écrit en dur. `npm run controle:cuvees` ne pouvait pas le
voir : il compare les champs que le serveur rend, et un champ qu'il ne rend pas ne diverge jamais.

**Deux corrections proposées, Ted a choisi la seconde** : le serveur rend le détail (lot 32), plutôt
que de recalculer la liste sur l'appareil. C'est le sens du chantier de portage.

- `supabase/lot32-cuvees-conditionnements.sql` : un champ additif `conds`, la fonction recopiée du
  lot 26, vérifiée identique à la production, et le cache `cuvees` effacé. Calcul rejoué en lecture
  seule sur la base de Ted : Le Miracle, 10 334 bouteilles de 75 cl et 159 magnums, soit les
  10 493 de la fiche.
- `bdv-ecrans.js` : `condsDuServeur()` traduit le champ, et **un résumé sans le champ cache le bloc**
  au lieu de peindre un titre sur du vide.
- `controle:cuvees` compare désormais `conds` ; `banc:cuvees-serveur`, 11 contrôles, dans `verif`,
  vérifié en remettant les deux défauts.
- `banc:rejeu` : les lots 31 et 32 ajoutés à `ORDRE`. Le 31 en manquait.

**À faire par Ted** : coller le lot 32 dans Supabase, puis pousser.

## 23/09/2026, le soir. « Je peux pas faire confiance au reste à partir de là »

Ted venait de rentrer une base de 5 210 lignes et a demandé un audit des calculs, captures à
l'appui : 31 millésimes pour 13 cuvées, pas de chiffres sur « Mon cap », des doubles négatifs.

**Il avait raison, et il y avait une seule cause pour l'essentiel.** `v_ventes.est_vente` vaut
`null` tant que le classement des familles n'est pas validé en base, ce qui est la décision du
lot 23 et qui est bonne. Ce qui ne l'était pas : dans cet état, `cap_resume` et `commerce_resume`
rendaient un objet **complet dont presque tous les champs sont nuls**, et `Number(null)` vaut
zéro. Seul `cuvees_resume` s'annonçait vide, avec `ok: false`, et c'est le seul des trois écrans
qui était juste. Ce n'est pas une coïncidence, c'est la démonstration.

Ce que ça donnait : « Mon cap » affichait **-26,1 % et 72 267 €** dans son bandeau, **0 €,
« null mois connus » et « objectif menacé, -164 000 € »** dans les trois cartes juste dessous, et
**« objectif jouable, atterrissage 223 302 € »** dans le conseil encore en dessous. Trois
réponses à une seule question, sur un seul écran. La vérité, rejouée contre la base : 72 267 €
réalisés sur deux mois, atterrissage 223 302 €, objectif 164 000 €, donc **+59 302 €**. L'écran
disait l'inverse de la réalité sur le seul chiffre que Ted regarde.

**Ce qui l'a rendue visible : cinq gardes différents pour un seul objet.** `capCadre()` exigeait
un chiffre comparatif et retombait en local ; `capAtterrissage()` se contentait d'un numéro
d'exercice et gardait le serveur. Deux blocs voisins, deux conditions, un écran moitié juste
moitié faux.

**L'arbitrage.** Ted a choisi de réparer le mélange d'abord plutôt que de valider son classement
pour débloquer son propre bureau : ça soigne tous les vignerons à venir, pas seulement lui. Le
garde se pose donc **à la pose du résumé, jamais bloc par bloc à la lecture** — un seul endroit
décide, et un bloc écrit demain en hérite sans y penser. Et le lot 31 double le verrou côté
serveur : `public.resume()` rend `null` plutôt qu'un objet à trous quand elle ne peut rien
calculer. Les deux se doublent exprès.

**Trois défauts d'affichage indépendants, corrigés dans la foulée.** `fmtPct` posait le signe
deux fois (« - -26,1 % ») là où sa voisine `fmtDelta`, écrite le même jour, prenait bien la
valeur absolue : le défaut n'a jamais touché les euros, et c'est ce qui l'a fait survivre. Le
compteur de la barre disait « 0 lignes » sur 5 210, parce qu'il n'était écrit qu'à l'ouverture et
après un import, jamais quand les lignes arrivent au premier geste qui en a besoin. Et les
« 31 millésimes » comptaient des couples cuvée × millésime : le calcul était juste des deux côtés,
c'est le libellé qui mentait, il dit maintenant « Références ».

**Un signal qui annonce un nombre doit mener à ce nombre.** « 90 clients en retard » renvoyait
vers une liste qui en montre 56, parce que la liste écarte ceux qui portent déjà une raison plus
solide. Aucun des deux n'avait tort, et c'est précisément ce qui rendait le renvoi inutilisable.
Le signal applique désormais le même écart.

**Le point ouvert, traité dans la foulée.** J'avais annoncé deux choses : que rien ne dit au
vigneron que son classement n'est pas validé, et que `gateBaseVide()` masque justement l'onglet
qui le répare. **La seconde était fausse**, et je l'avais déduite de la lecture au lieu de la
rejouer — la faute exacte que ce dépôt documente depuis le 18/09. Rejouée sur quatre cas :
`baseEstVide()` délègue à `baseVide()`, corrigé le 18/09 précisément pour ne conclure « vide » que
si le serveur le dit aussi. L'onglet est atteignable. Corrigé dans CLAUDE.md, qui portait
l'affirmation fausse pendant une heure.

**La première était vraie, et elle avait une cause intéressante.** L'aveu existait : « L'outil
fonctionne actuellement au jugé », écrit le 19/09 dans le panneau de réglages. Mais **dans
l'onglet « Le classement »**, c'est-à-dire à l'endroit où l'on va déjà pour corriger. Une phrase
juste, posée là où personne n'a de raison de passer, ne dit rien à personne. D'où la règle :
**un état dégradé se dit là où son prix se paie, pas là où on le répare** — le symétrique exact de
la leçon du 19/09 sur `noteComplement()`, qui annonce ce qui manque ET pose le bouton qui le
comble.

Un bandeau en tête des écrans de vente le dit donc en une phrase et mène à l'onglet. Ce qui a
demandé le plus de soin n'est pas ce qu'il affiche mais **ce qu'il refuse d'afficher** : il se tait
quand les réglages du compte n'ont pas pu être lus, parce qu'accuser quelqu'un d'un réglage
manquant pendant que son réseau a lâché, c'est lui faire écraser un classement qui existe. Un
bandeau qui accuse à tort coûte plus cher que pas de bandeau : il apprend à ignorer les bandeaux.
`npm run banc:classement`, 21 contrôles, dans `npm run verif`, vérifié par trois mutations.
---

## 23/09/2026, plus tard. Le bouton « Vider la base » ne disait pas qu'il travaillait

Ted, deux captures du bouton : « j'ai l'impression que c'est pas propre. Il faut forcément que
l'interface montre une animation tant que ça travaille, même dans les réglages. Il devra y avoir
une vérification pour que l'animation s'arrête. »

Il avait raison sur le symptôme, et l'audit a trouvé plus grave que le symptôme.

**Ce qu'on voyait :** entre la confirmation et le message final, rien. L'appel serveur (1,4 s
mesuré sur 171 569 lignes), le vidage local, puis la repeinture complète du bureau et du panneau,
écran figé. Le bouton restait cliquable et la zone de dépôt d'export, dans la même rangée,
restait active : déposer un export pendant que le DELETE tourne, c'est l'incident du 18/09 refait
par la porte d'à côté.

**Ce qu'on ne voyait pas, et c'est le vrai sujet.** `await dbClear()` n'avait aucun filet : son
rejet sortait de la fonction en silence, compte vide, appareil plein, pas un message, et le repère
de synchronisation déjà oublié à l'intérieur d'`effacerTout()`. L'asymétrie du 18/09 prise dans
l'autre sens, et muette. Et la preuve chiffrée que le lot 28 avait été écrit pour produire, le
compte de ce qui est effacé table par table, était calculée, transmise, puis jetée : `viderBase()`
ne lisait que `vide`.

**Et le lot 28 lui-même ne recomptait qu'une table sur cinq.** Il vide `ventes`, `ventes_lignes`,
`suivi_clients`, `echanges` et `resumes`, et relisait `ventes` seule. Il ne pouvait donc pas lever
sur un suivi client resté entier, c'est-à-dire sur la seule chose que le vigneron ne peut pas
réimporter. Le lot 30 recompte les cinq et nomme celle qui résiste.

### Les arbitrages

**Le voile couvre tout l'écran, pas seulement le panneau.** Choix de Ted. Ce qui le justifie n'est
pas l'effet : c'est que le geste porte aussi sur le compte, donc sur le bureau des autres membres.

**Il réutilise les classes du voile d'amorçage.** Ce dessin est déjà scopé, déjà mesuré dans les
deux thèmes, et chacun de ses états se dit par un glyphe et par un mot caché en plus de sa couleur.
En écrire un second aurait ajouté une valeur à trois échelles fermées de `charte --bureau` pour
redire moins bien la même chose. La seule chose que la marque `--vidage` ajoute, c'est du
mouvement : un rail qui court, arrêté par `aria-busy`, jamais par un minuteur.

**Le panneau entier est neutralisé, pas le bouton.** Le bouton n'était pas le danger ; la zone de
dépôt d'à côté l'était. Et `aria-modal` du panneau est rendu le temps du travail, sans quoi le
voile aurait été vu et pas entendu : un dialogue modal rend muet tout ce qui vit en dehors de lui.

**La vérification a trois états et pas deux.** Zéro arrête en succès, un reste arrête en échec
nommé, un « je ne sais pas » arrête en « non vérifié ». C'est la même règle que le garde
d'ouverture, et confondre le troisième avec le premier, c'est rejouer le 18/09.

### Ce que la planche a montré et que les bancs validaient

Quatorze mutations, chacune fait échouer `banc:vidage`. Les 37 étapes de `verif` sont vertes. Et
la première capture de `apercu:vidage` a montré la seule chose que Ted avait demandée et que
personne ne mesurait : **le voile ne bougeait pas.** Trois étapes immobiles pendant six secondes ne
se distinguent pas d'un plantage. Neuvième fois que ce fichier raconte la même leçon.

### À faire, dans l'ordre

1. Coller `supabase/lot30-vider-la-preuve-complete.sql` dans Supabase. Tant qu'il n'est pas passé,
   la preuve reste partielle : c'est exactement l'état décrit par la note du lot 6.
2. Ouvrir `_apercu/vidage.html` et regarder les cinq états dans les deux thèmes.
3. Signalé et non corrigé : `lot29-index-et-fonctions-de-declencheur.sql` n'est pas dans la liste
   `ORDRE` de `banc-rejeu.mjs`, donc absent de la procédure de reconstruction.
4. Non tranché : le voile d'amorçage ne bouge pas non plus. Il dure deux secondes, et on ne
   repeint pas un écran qu'on n'a pas regardé.

---

## 23/09/2026, la fin. Un nombre fixe ne répond pas à deux écrans

Ted, capture de son vrai bureau à l'appui : « non, là tu peux revoir la taille des écrans.
regarde, c'est pas utilisable. Tu peux vraiment prendre 1/3 de l'écran ».

**Sa capture a été mesurée avant d'être commentée**, et c'est elle qui a donné le chiffre qui
manquait : le rail y fait 233 px d'image pour 184 px réels, ce qui donne une échelle de 1,115
et une **fenêtre de 2296 px**. Le tiroir de 420 px n'y faisait que **18 %** de la largeur. Sur
l'écran de 1440 où je l'avais mesuré, il en fait 35 %. **Le même nombre ne peut pas répondre
aux deux.**

C'est la même famille que la règle du 07/09/2026 sur le responsive : la largeur de la fenêtre
ne dit rien de la place disponible, et une valeur posée sur une mesure prise ailleurs se
trompe de cible. Je l'avais écrite le matin même dans CLAUDE.md, et j'ai quand même posé un
nombre fixe.

La largeur devient `clamp(400px, 32vw, 820px)`. Les deux bornes sont mesurées, pas arrondies :
32vw laisse 666 px à la liste au seuil de 1320, donc 26 px au-dessus des 640 où elle se replie
en fiches ; 820 est la largeur où le conseil de la fiche atteint cent signes par ligne. Et
`vw` plutôt que `%`, parce que la même valeur sert de largeur au tiroir et de retrait à ce qui
le pousse : un pourcentage se calculerait sur deux boîtes différentes.

Chez Ted : **735 px, soit 32 %**. Les quatre chiffres de la fiche passent sur une ligne, le
conseil se lit d'un trait, les trois boutons de report ne se replient plus.

### La deuxième règle recopiée du téléphone, et c'est la même faute qu'il y a une heure

En capturant à sa largeur, j'ai vu les deux champs de date empilés dans un tiroir de 735 px.
C'était ma règle, reprise du bloc téléphone sur le raisonnement « un champ date ne se comprime
pas, il déborde ». **Mesure, boîte par boîte de 360 à 620 px : il ne déborde jamais et son
contenu n'est jamais tronqué.** À 360 px, la plus étroite testée, un champ fait encore 147 px
et affiche sa date en entier.

Deux fois dans le même lot, la même faute. La leçon écrite ce matin disait « on la remesure
avant de la reprendre ». Elle est devenue plus dure : **une règle d'un autre point de rupture
ne se reprend pas, elle se redémontre.** Tant qu'on n'a pas la mesure qui la justifie ici,
elle n'existe pas.

Le banc garde les deux sens désormais : il échoue si la largeur redevient fixe, si elle passe
en pourcentage, si le tiroir grossit au point de replier la liste au seuil, si le plafond
descend au point qu'il cesse de suivre l'écran, et si le duo est réempilé de force.

---

## 23/09/2026, la suite. « ok same pour les tâches », et ce que ça voulait dire

Ted, après avoir vu le lot 1 : « ok same pour les tâches ». Trois mots, et un piège dedans.

**Le point ouvert que j'avais écrit le matin même disait que la modale d'une tâche « devra
passer par le MÊME CONTENANT ». C'était la mauvaise formulation, et l'appliquer aurait été une
faute.** Les deux boîtes ne partagent rien : la fiche client vit dans `#modale`, un div du
gabarit ; la modale d'une tâche est fabriquée de toutes pièces par `bdv-taches.js` dans son
propre élément. La faire entrer dans `#modale` lui aurait donné la classe `.bdv-ventes`, qui
scope tout le dessin des écrans de vente : on aurait échangé un problème de cohérence contre un
habillage qui change sous elle.

**Ce que Ted a demandé, c'est le même COMPORTEMENT, pas le même élément.** Le danger n'est pas
d'avoir deux boîtes, c'est d'avoir deux endroits qui DÉCIDENT : deux seuils qui divergent au
premier réglage, deux contrats ARIA dont un seul est défait, deux classes posées sur le corps
de page qui se retirent l'une l'autre. Aucun des trois ne se voit à l'écran.

La décision vit donc maintenant dans `BdvTiroir`, en bas de `bdv-nav.js`, et nulle part
ailleurs. Le mécanisme a été **sorti** de `bdv-ecrans.js`, où le lot du matin l'avait écrit.
`bdv-nav.js` est chargé sans `defer` alors que `bdv-taches.js` l'est avec : il s'exécute avant
lui, et `bdv-ecrans.js` arrive plus tard encore. Les deux appelants le trouvent toujours.

### Le défaut de ce lot était de moi, et c'est la capture qui l'a trouvé

J'avais repris du bloc téléphone la règle qui colle « Retirer cette tâche » à gauche, **sans la
remesurer à la largeur du tiroir**. Mesure : `margin-left:auto` tient parfaitement dans 372 px,
et laisse **156 px** entre « C'est fait » et « Retirer cette tâche ». Ma règle les collait l'un
à l'autre, c'est-à-dire **le geste qui détruit à douze pixels du geste qui valide**, dans un
panneau où l'on clique vite. Retirée.

La leçon vaut pour la suite : une règle écrite pour un autre point de rupture répond à une
autre largeur. On la remesure avant de la reprendre, sinon on importe une contrainte qui
n'existe pas et on défait un dessin qui avait raison.

### Une exception assumée sur le focus

La règle du tiroir est de ne pas voler le focus : le vigneron garde sa liste sous les yeux.
Mais une tâche **neuve** est un formulaire vide qu'on vient d'ouvrir pour écrire dedans. Ne pas
y poser le curseur ferait taper le titre dans le vide. C'est le seul cas, et c'est du contenu,
pas de la mise en page.

### Ce qui reste, et c'est le morceau de la demande de Ted qui n'est pas fait

**Passer d'un client ou d'une tâche au suivant au clavier n'existe toujours pas.** Le tiroir le
rend possible, rien ne l'implémente. C'est le geste qu'il a décrit en ouvrant le chantier.

---

## 23/09/2026. La fiche client se lit à droite de la liste, plus par-dessus

Demande de Ted, en ouvrant la session : « j'imagine bien avoir à droite un écran qui
représente la tâche qu'on sélectionne, pareil pour Mon commerce quand je sélectionne un
client, au lieu d'avoir une modale ».

**Le conseil a été convoqué avant d'écrire une ligne, et il n'était pas d'accord avec
lui-même.** L'ergonome a rappelé que c'est exactement la plainte du 11/09 (« on a perdu le tri
rapide de quinze relances »). Le sceptique a soutenu que pour une tâche, qui est un titre et
deux dates, le panneau volerait 40 % de la largeur de la liste pour un gain nul. Son
contradicteur a tranché : si « Mon commerce » ouvre à droite et « Mes tâches » au milieu, le
bureau a **deux comportements pour le même geste**, et ça ne se rattrape jamais. Accord final :
un seul composant partagé, la fiche client d'abord parce que c'est là que ça se joue, les
tâches au lot suivant.

**Trois arbitrages ont été demandés à Ted, et il a pris les trois recommandations** : le
panneau POUSSE la liste plutôt que de la recouvrir ; sous le seuil on retombe sur la modale
d'aujourd'hui plutôt que d'inventer un troisième dessin ; et on commence par « Mon commerce »
pour le juger à l'usage avant de porter « Mes tâches ».

### Ce qui a décidé le seuil, et ce n'est pas un chiffre rond

Le mesureur du conseil avait répondu [Probable]. La mesure au navigateur a donné [Certain] :
l'atelier laisse **1208 px de contenu utile à 1440 px**, l'écran de Ted. Les requêtes de
conteneur du sous-main replient la liste en fiches sous 640 px. Avec un tiroir de 420, le
tiroir ne peut donc pas exister sous **1292 px de fenêtre**, sinon ouvrir un client replierait
la liste sous l'œil de celui qui l'ouvre. Seuil retenu : **1320**, 28 px de marge, et sous
1366 qui reste la résolution la plus répandue après celle de Ted.

### Ce qu'on a écarté, et pourquoi

**Faire de `#modale` une vraie troisième colonne de la grille.** C'était plus élégant : elle
aurait vécu dans le flux et se serait collée comme le rail. Mais le contrôle « la modale de la
fiche client est hors de #bureauVentes » de `banc-bureau.mjs` la cherche par sa POSITION dans
le texte du HTML construit. Le déplacement l'aurait laissé au vert **en ayant cessé de tester
ce qu'il croit tester**, et ce dépôt dit qu'un contrôle dans cet état est pire que pas de
contrôle. Le tiroir pousse donc par un retrait : même pixel, pas une balise touchée.

**Sortir les règles de défilement des tableaux du bloc téléphone.** Ça aurait paru plus propre
et ça aurait cassé en silence le `position:sticky` des en-têtes de tableau, parce que
`overflow-x:auto` fait passer `overflow-y` de `visible` à `auto`. Portées au seul cas du
tiroir.

### Le harnais a menti deux fois, et c'est la dixième fois de la même famille

`bdv-ecrans.css` n'est **pas liée dans le HTML** : c'est `bdv-nav.js` qui la pose au premier
clic sur une pièce de vente. Un harnais sans scripts ne la charge jamais, et
`.modale{position:fixed}` avec elle : le tiroir sortait collé à gauche. Et le retrait est en
**transition de 300 ms** : deux trames d'attente lisaient un padding à mi-course, soit -64 px
de liste là où le calcul en annonce -420, un chiffre qui n'existe à aucun moment où quelqu'un
regarde l'écran.

Un troisième point, plus petit et plus sournois : le premier jet du test déclarait « Me
déconnecter » recouvert aux cinq largeurs. Le code était juste ;
`getBoundingClientRect().right` inclut le retrait. **On mesure le bouton, pas la boîte.**

### Ce qui garde le lot

`npm run banc:tiroir`, dans `npm run verif`, vérifié en remettant trois fois le défaut. Il
interdit aux deux seuils de diverger, refuse un tiroir assez large pour replier la liste, et
contrôle les trois moitiés du contrat ARIA. Plus la sonde de contraste sur la vraie fiche,
dans les deux thèmes et les deux modes : **zéro paire sous son seuil**, alors que le lot change
le fond de la boîte et donc toutes ses paires.

### Ce qui reste, et Ted doit le savoir avant de juger

« Mes tâches » n'est pas fait, c'est le lot 2, et il devra passer par le **même** contenant.
Le tiroir recouvre le pied de page du site quand la pièce est courte. Et rien n'a encore été
ajouté pour passer d'un client au suivant **au clavier**, qui est pourtant le geste que Ted a
décrit en ouvrant le chantier.

---

## 22/09/2026, l'après-midi. Les aperçus montraient des écrans nus, et rien ne le disait

Relevé du matin, feuilles posées par chaque aperçu : `apercu-ardoise`, `apercu-mot` et
`apercu-panneau` ne posaient que `style.css`, `apercu-modale` trois feuilles sur quatre,
`apercu-fiche` trois sur cinq. Depuis la scission du 21/09 au matin, `style.css` ne porte plus
les règles du bureau : elles vivent dans `bdv-poste.css` et `bdv-bureau.css`. **Les trois
premiers rendaient donc des écrans NUS, et ne le disaient pas.** C'est exactement ce qui était
arrivé à `apercu:equipe`, qui a menti une journée entière, et à `apercu:invitation` et
`apercu:amorce`, rattrapés la veille. Huit fois le même défaut.

### Le contrôle d'abord, parce que c'est lui qui empêche la récidive

`scripts/banc-apercus.mjs`, branché dans `npm run verif`. Il ne compare pas des noms de fichiers
écrits à la main : **il dérive la vérité de la page CONSTRUITE**, `<link>` par `<link>`, dans
l'ordre du gabarit. Les trois feuilles que du JavaScript pose ne sont dans aucun HTML : elles
restent nommées à la main, mais **une seule fois**, dans `scripts/feuilles-bureau.mjs`, d'où
`scripts/charte.mjs` les lit maintenant au lieu d'en porter sa propre copie.

`apercu-courrier` est l'exception, et le banc la NOMME avec sa raison au lieu de l'oublier : un
mail est autonome, aucune messagerie ne charge de feuille externe. Le banc échoue le jour où ce
fichier se mettrait à poser une feuille du bureau.

**Vérifié par mutation, trois fois** : une liste à la main sans `bdv-poste.css` (4 échecs, dont
« Il manque : src/css/bdv-poste.css »), la même dans le désordre (4 échecs), une liste en dur
remise dans le socle (2 échecs).

### Un module partagé, parce que le montage était écrit huit fois

`scripts/apercu-socle.mjs` : les feuilles, le lien des polices, la planche à deux thèmes, le
scope sur le corps de page, et le contrôle des mots vides, qui était recopié dans quatre
fichiers. Les huit aperçus passent par lui.

### Ce que le harnais s'est appris à lui-même, et c'est la vraie leçon du jour

Deux fois, la sonde de rendu a accusé le produit d'un défaut qui venait de la planche :

- **il manquait `bdv-poste` sur le corps de page.** Toutes les règles téléphone s'écrivent
  `body.bdv-poste ...` sous 700 px. Sans cette classe, quinze cibles sous 44 px sur la modale et
  quatre sur le panneau, à 390 px, qui n'existent pas dans le produit ;
- **`apercu:modale` ne prenait que `.tmod__boite`, sans son `.tmod`**, alors que tout le plancher
  tactile du téléphone s'écrit `.tmod .btn`, `.tmod__lien`, `.tmod__g`… En remontant d'un
  élément, les quinze cibles passent à zéro.

**Un harnais qui ne monte pas l'ÉTAT et l'ANCÊTRE de la vraie page invente des défauts, ce qui
coûte autant que d'en laisser passer.**

### Les dix images, regardées

Cinq aperçus, deux thèmes, sonde de rendu du lot 9, à 1440 et à 390 px : **zéro paire sous son
seuil, partout**. C'est une bonne nouvelle, et elle se mesure aussi.

Deux valeurs papier sur l'ardoise, `a.chiffre` qui prend `--bordeaux` de la règle `a{}` de
`style.css`, soit 1,37:1 sur la surface sombre. Mesure élément par élément : les trois enfants
qui portent du texte nomment tous leur encre, donc **aucune lettre n'est peinte en bordeaux**.
Même situation que `.calbloc__trous` au lot 8, et **même arbitrage : non corrigé**, parce que le
banc d'empreinte rend les valeurs calculées d'un élément même quand elles ne peignent pas. C'est
un piège posé pour plus tard, et il est écrit dans `CLAUDE.md` avec son correctif d'une ligne.

Cinq cibles sous 44 px sur le panneau à 390 px : c'est la sonde qui se trompe, `.postit__lien`
fait 268x21 mais son `::after` couvre un post-it de 281x109. Elle mesure le rectangle de
l'élément, pas celui de son calque.

### Ce qui n'a pas bougé

**Aucun CSS n'a été touché.** Le banc d'empreinte par seaux n'a donc rien à dire sur ce lot, et
il n'a pas été rejoué. `npm run verif` passe en entier, par paquets, et `charte` comme
`charte:bureau` disent CONFORME.

---

## 22/09/2026. Le premier écran du produit, photographié enfin, et il n'était pas là

Hier soir on a rattrapé « L'équipe », que le harnais rendait vide. En écrivant le point ouvert
de ce lot-là, une phrase est sortie : **les 45 états du banc d'empreinte ont tous une session.**
Le bureau **déconnecté** n'avait donc jamais été photographié en sombre, ni audité, ni relevé.

C'est pourtant le premier écran de quelqu'un qui n'a pas de compte, le seul écran d'un invité
qui arrive par un lien, et, mesure que `CLAUDE.md` porte depuis le 11/09, l'écran de la
**première ouverture sur un iPhone**, puisqu'une app iOS a son propre stockage et que la session
ouverte dans Safari n'y est pas.

### Le harnais d'abord, encore, et c'est la sixième fois

`scripts/bureau-garni.mjs` sait maintenant **fermer** le bureau. `garnirLeBureauDeconnecte()`
efface la session au lieu de compter sur son absence, et double le **serveur** GoTrue, pas le
client : `/recover`, `/verify`, `/signup`, `/user`, plus l'aperçu d'invitation ouvert à `anon`.
`src/js/bdv-compte.js` tourne donc en entier, sans une ligne de complaisance, et toute autre
adresse Supabase est refusée par le même `TypeError` qu'un réseau coupé.

`ouvrirLaPorte()` passe par les **vrais** boutons, et les trois chemins ne donnent pas le même
écran : celui du bureau ouvre en mode connexion, celui du bandeau est le seul qui impose
l'adresse invitée en lecture seule, la bascule du pied montre l'inscription. « Mot de passe
oublié ? » puis le code mènent aux deux étapes profondes que **rien n'avait jamais dessinées sur
une image**. Deux garde-fous lèvent avant la première capture : l'un refuse si une session
traîne ou si `#bureauContenu` est visible, l'autre si l'étape affichée n'est pas celle demandée.

### Ce que l'angle mort a coûté, en chiffres, avant correction

Périmètre du bureau déconnecté, quatre configurations : **1 paire sous son seuil**, et c'est le
`h2` « Ton bureau t'attend. » à **1,28:1** en sombre, autrement dit, sur un téléphone en mode
sombre, **le titre du premier écran du produit n'est pas là**. Plus **4 valeurs papier** et
**32 cibles tactiles sous 44 px**. Après : zéro partout.

Les 32 cibles sont trois gestes, mesurés sur le rendu : le bouton unique de l'écran d'invitation
(289x36), les boutons pleins de la porte (376x37), et ses deux liens de secours, « Mot de passe
oublié ? » (141x15) et « Renvoyer le code » (113x15). Le second est le seul chemin de quelqu'un
qui ne peut plus entrer, et il faisait quinze pixels de haut.

### La cause, traitée, et elle est fermée

`h1,h2,h3,h4{color:var(--ink)}` de `style.css` pèse (0,0,1) et gagne contre toute règle du bureau
qui ne nomme pas `color`. Elle avait déjà fait tomber le titre de la modale au lot 5, à 1,05:1.
Deux titres, deux lots, même règle : j'ai donc écrit un balayage qui relève **tout `h1` à `h4` de
tous les états du bureau, dans les deux thèmes**, et dit lequel porte encore une encre du site.
Verdict : les neuf pièces, le panneau et la modale sont propres ; il ne restait que celui-là.
Après correction, un seul titre porte encore une encre du site, le `h1` du hero, à 12,69:1, et
c'est voulu.

### Ce qui reste en papier sur cet écran, et pourquoi je n'y touche pas

La page déconnectée ne porte pas `body.bdv-poste` : le bandeau marchand et le pied de page du
site sont à l'écran, en bordeaux, et le hero est le composant partagé de /a-propos/. 116 valeurs
papier. Elles restent, pour deux raisons : le contraste passe (chacun de ces blocs porte son
propre fond opaque, le `h1` du hero est à 12,69:1 dans les deux thèmes), et **repeindre le seul
hero rendrait l'écran moins cohérent**, une bande thémée entre une barre bordeaux et un pied
bordeaux. L'audit les compte à part, jamais mélangées : sinon un vrai défaut du bureau
disparaîtrait dans le bruit du site.

### Deux aperçus mentaient encore, et un troisième n'existait pas

Même famille qu'hier, même jour d'origine. `npm run apercu:invitation` ne posait que `style.css`,
où il ne reste plus une seule règle `.invitation-*` : il rendait le bandeau entièrement nu.
`npm run apercu:amorce` oubliait `bdv-poste.css`, où vivent les 21 règles du voile. Les deux
posent maintenant les quatre feuilles dans l'ordre du gabarit, avec les deux thèmes côte à côte.

Et j'ai ajouté `npm run apercu:porte`, qui n'existait pas : cinq écrans, **trois colonnes**, le
site en papier à gauche et le bureau dans ses deux thèmes à droite. C'est le seul harnais du
dépôt qui montre les deux mondes côte à côte, et c'est ce qui permet de voir d'un coup d'œil
qu'un recouvrement n'a pas débordé.

Un piège en chemin, et il est déjà dans `CLAUDE.md` sous un autre mécanisme : un accent grave
dans un commentaire écrit **à l'intérieur d'un littéral de gabarit** ferme la chaîne. Erreur de
syntaxe immédiate, exactement comme la constante `STYLE` de `bdv-reglages.js` le 21/09.

### Le banc de sortie, par seaux, et il a refusé au premier passage

77 états : les 45 de la veille, plus les sept états déconnectés dans les deux thèmes aux deux
largeurs, plus `/outils/echeances/` (la seule page publique qui partage `.bureau-vide` avec le
bureau), plus **la porte ouverte depuis `/compte/`**. 25 412 258 valeurs comparées.

Deux seaux : **2 633 écarts** sur le bureau déconnecté, qui sont le lot, et **zéro** sur tout ce
qui a une session, sur les sept pages publiques et sur la porte vue du site. Contre deux relevés
de référence. Vérifié par mutation : un `word-spacing` glissé dans les 726 blocs des deux
feuilles servies fait passer le second seau de 0 à **140 590**.

Le premier passage a sorti **825 écarts hors périmètre**, 25 par état connecté, et c'est la leçon
du jour : `#bureauInvite` existe dans le DOM de toutes les pages du bureau, il y porte `hidden`,
donc il ne peint pas un pixel, mais `getComputedStyle` rend les valeurs d'un élément caché.
C'est la leçon du lot 8 sur `.calbloc__trous`, prise dans l'autre sens. Le tri par état ne
suffisait pas, il fallait aussi les deux chemins d'élément.

### Et la sonde de contraste vit enfin dans un seul fichier

Elle était recopiée en entier dans quatre scripts d'audit. Ce n'est pas du rangement : le premier
jet de la version du lot 8 comptait 53 valeurs papier là où il y en avait 11, faute de garder
`border-*-color` quand la bordure a zéro pixel, **et les trois copies précédentes portent encore
ce défaut**. Un banc copié porte ses défauts à l'identique.

Elle a aussi appris les deux exceptions du critère 2.5.8 de WCAG 2.2, et elle les **compte à
part** au lieu de les taire : un lien en ligne dans une phrase, une case native dans son
`<label>`. En l'écrivant, une mesure de plus : Chromium rend `inline-block` pour un `<button>` à
qui la feuille dit `display:inline`. Le premier jet ne testait que `inline` et ratait la ligne de
bascule de la porte ; accepter toute la famille `inline*` sans exiger du texte à côté aurait
exempté tous les boutons pleins du produit, c'est-à-dire exactement ceux qu'on cherche.

### Ce qui reste ouvert

Quatre aperçus posent encore moins de feuilles que la page qu'ils montrent : `apercu:panneau`,
`apercu:modale`, `apercu:ardoise`, `apercu:mot`. Aucun n'est dans `npm run verif`, donc rien ne
le dira. Le voile d'amorçage n'est toujours pas photographié sur une base vide sans réseau. Et le
thermomètre 2 n'a pas bougé : 56,9 ko de `style.css` voyagent toujours dans le bureau.

---

## 21/09/2026, dans la nuit. Une pièce que le harnais rendait vide, et ce qu'elle cachait

Le bureau est passé en deux thèmes en cinq lots, puis nettoyé en deux lots de plus. Tout a été
capturé, mesuré, audité. **Sauf « L'équipe ».**

`scripts/bureau-garni.mjs`, le décor commun des harnais de capture, garnissait huit pièces sur
neuf. Celle-là sortait **sans un seul équipier** de toutes les images des lots 3 à 7 : liste
vide, formulaire d'invitation masqué, invitations en attente masquées, lien de secours masqué,
pas une étiquette de rôle. Les trois audits de contraste ont donc mesuré **zéro paire** dessus,
et les deux bancs d'empreinte ont comparé **du vide à du vide**, en déclarant zéro écart.

**C'est la cinquième fois que ce dépôt paie un harnais plus sage que la réalité**, et `CLAUDE.md`
le racontait déjà quatre fois. Ce lot a donc commencé par le harnais, pas par le CSS.

### Pourquoi celle-là et pas une autre

C'est la seule pièce du bureau qui ne lit **rien** du stockage local : son contenu vient de six
appels au serveur. Le conteneur n'a pas de réseau, le banc d'empreinte coupe en plus tout ce qui
n'est pas 127.0.0.1, les six appels tombaient, et la pièce affichait son écran d'échec. Le décor
avait été écrit pour un bureau qui travaille **seul**, et cette pièce-là ne parle que de
travailler à plusieurs. Personne n'avait eu à y penser, et rien ne le disait.

### Ce que l'angle mort a coûté, en chiffres, avant correction

Harnais garni, pièce ouverte, thème sombre, aux deux largeurs : **58 paires sous leur seuil**,
**152 valeurs papier**, **6 cibles tactiles sous 44 px**. Zéro de tout cela en clair : c'est un
défaut qui n'existe **que** dans le thème que personne n'avait photographié ici.

Les quatre qui font mal :

- **« UTILISATEUR » à 1,20:1.** L'étiquette du rôle le plus fréquent était littéralement absente
  de l'écran, alors que « MAÎTRE », posée sur `--bordeaux`, restait lisible. Une pièce où l'un
  des deux états disparaît dit que tout le monde est maître.
- **« Il ne s'affichera qu'une fois » à 1,00:1.** C'est la seule phrase qui prévienne qu'un
  secret non reproductible ne reviendra pas — la base n'en garde que l'empreinte. Un écran qui
  affiche ce secret sans pouvoir le dire est un piège.
- **« Tu n'appartiens à aucun bureau » à 1,00:1**, sur l'écran qui existe justement pour qu'on ne
  reste pas enfermé dehors sans explication.
- **« Untel t'invite à travailler dans Tel domaine » à 1,00:1**, la première phrase que lit
  quelqu'un qui arrive par un lien, et souvent la seule.

### Ce qui ferme le trou, et ça vaut plus que le lot

Le décor de l'équipe est posé **par défaut** : un décor qu'il faut penser à demander est un décor
qu'on oublie. Et c'est le **serveur** qui est doublé, pas le client : `window.fetch` répond aux
seules adresses Supabase connues, et les deux modules du produit tournent en entier. Doubler
`BdvCompte` aurait reconstruit un harnais plus sage que la réalité, c'est-à-dire le défaut qu'on
répare.

Trois états, parce qu'ils n'affichent pas les mêmes blocs : un maître avec deux bureaux et trois
membres, un simple utilisateur, et « aucun bureau ». Plus le lien de secours, atteint par le
**vrai geste** : la fonction d'envoi rend `envoyé:false`, comme quand Resend tousse.

Et deux garde-fous qui **lèvent** au lieu de se taire : l'un demande à la page, par le vrai
chemin, combien d'équipiers le serveur rend ; l'autre se passe la pièce ouverte et compte les
lignes, les étiquettes, les invitations et la visibilité de chaque bloc selon l'état demandé. Le
harnais s'arrête avant la première image.

### L'aperçu mentait aussi, depuis le matin même

`npm run apercu:equipe` ne posait que `style.css`. Depuis la scission du matin, `style.css` ne
contient plus **une seule** règle `.equipe-*` : l'aperçu rendait la pièce entièrement nue, et il
l'a fait toute la journée sans que rien ne le dise. Il pose maintenant les quatre feuilles du
bureau dans l'ordre où le gabarit les lie, le scope de la coque, et **les deux thèmes côte à
côte**.

**Et il a encore trouvé un défaut au premier passage, comme la première fois.** Un conteneur qui
force un thème retourne les jetons de son sous-arbre, mais pas les propriétés déjà **calculées**
au-dessus : l'encre du corps de page descendait en clair dans la colonne sombre, et les noms des
équipiers sortaient gris foncé sur fond noir. C'était un défaut de l'aperçu et pas du produit —
mais c'est exactement le genre de mensonge qui fait valider un écran cassé. Un conteneur qui
force un thème redit désormais tout ce que la coque pose sur le corps : le fond **et** l'encre.

### Le banc de sortie a un périmètre, et c'est nouveau

Les deux lots précédents ne changeaient aucun pixel. Celui-ci change l'écran, sur une pièce et
une seule. Le banc range donc chaque écart dans trois seaux : dans la zone et son bandeau, sur
leurs ancêtres (la hauteur de la zone qui remonte), ailleurs. **Le troisième doit être vide.**

**22 560 écarts dans la pièce, 66 sur ses six ancêtres dans les six états où elle est à l'écran,
zéro ailleurs** — les huit autres pièces, le panneau, la modale, les six pages publiques —
contre **deux** relevés de référence. Vérifié par mutation : 311 règles de la feuille servie
salies d'un `word-spacing`, et le troisième seau passe de 0 à **75 858**.

Deux corrections ont été **annulées par le banc**, et les deux apprennent quelque chose. La
perforation du bloc calendrier est en `display:none` : ses valeurs papier ne peignent pas un
pixel, mais `getComputedStyle` rend les valeurs d'un élément caché, et les retirer sortait 165
écarts. Et le filet des fiches du sous-main sur téléphone **peint encore** : la règle du bureau
ne couvre que le corps du tableau, pas la rangée d'en-tête.

### Deux états que ce banc ne saura jamais lire

Le relevé se fait **au repos** : aucun de ses 45 états n'est un survol ni un focus clavier. Un
troisième harnais force les deux pseudo-états par le protocole de Chromium, et il a trouvé les
deux seules valeurs papier qui peignaient encore hors de « L'équipe » :

| état forcé, en sombre | avant | après |
|---|---|---|
| le titre d'une tâche, au survol | **1,37:1** | 8,34:1 |
| l'anneau de focus clavier d'une tâche | **1,37:1** | 10,87:1 |

Un titre qui disparaît quand la souris passe dessus, et un anneau de focus invisible sur la pièce
la plus ouverte du bureau. Un nom d'élément de plus dans le sélecteur suffisait à leur faire
gagner la cascade, exactement comme les trois défauts de spécificité du lot 2.

### Ce qui reste ouvert, et c'est le prochain trou de harnais

**Le bureau déconnecté n'a jamais été photographié en sombre.** Sondé cette nuit : le titre
« Ton bureau t'attend. » tient **1,28:1**. La cause est la même que celle du titre de modale du
lot 5 — `h1,h2,h3,h4{color:var(--ink)}` de `style.css` peint tout titre du bureau que la feuille
de la coque ne nomme pas. Les 45 états de l'empreinte ont **tous** une session. Le défaut est
mesuré, il n'est pas corrigé : il est hors du périmètre que ce lot peut prouver.

Et `.invitation` est restée dans `style.css` alors qu'aucune page publique ne s'en sert. Elle est
**recouverte** depuis la feuille du bureau, propriétés nommées une par une, parce que la doctrine
interdit de toucher une feuille partagée. Le contrôle C3 de `npm run charte` ne sait pas la voir.

### La leçon, en une ligne

**Une pièce qu'un harnais rend vide n'est pas une pièce vérifiée.** Un décor de harnais n'a pas
d'utilisateur pour signaler qu'il ment : avant de croire un relevé, on compte ce qui est
**peint**, et un décor que le harnais oublie de poser doit lever, pas se taire.

---

## 21/09/2026, au soir. Le recouvrement est levé : on ne cache plus le papier, on le remplace

La scission de `style.css` du matin n'était pas une fin, c'était une condition. Pendant les cinq
lots des deux thèmes, le bureau a dû **recouvrir** les règles papier au lieu de les remplacer,
parce qu'elles vivaient dans `style.css` et que la démonstration de l'accueil s'en sert. Ce lot
supprime la cause, pas les symptômes.

**Ce que le recouvrement coûtait, et le second prix est le vrai.** Du poids mort, d'abord :
555 appels à un jeton papier dans `bdv-poste.css`, 237 dans `bdv-calendrier.css`, tous servis à
chaque ouverture et aucun ne peignant quoi que ce soit. Et surtout une course de specificité, qui
a mordu **quatre fois** : la barre d'onglets du téléphone restée crème, la punaise du panneau
restée papier, la barre « 286 lignes » restée crème, le titre de modale à 1,05:1. Les quatre ont
été trouvés **à la capture, jamais par un banc**, et c'est structurel : un banc de feuille lit
les règles qu'on écrit, pas celles qu'on laisse passer.

### Ce qui a bougé

`src/css/bdv-poste.css` est **repeinte en place** et son recouvrement est **retiré** : 345
valeurs papier remplacées par leur jeton `--bdv-*`, **555 appels papier avant, 233 après**.

`src/css/bdv-bureau.css` passe de **434 règles à 374** : 60 disparaissent en entier, 49 autres
perdent 172 déclarations. **53 401 octets servis avant, 44 215 après.** Le total du CSS que le
bureau télécharge passe de 271 981 à 262 664 octets. `style.css` ne bouge pas d'un octet : le
site public ne paie rien et ne gagne rien, ce lot ne le concerne pas.

`src/css/bdv-calendrier.css` est **repeinte en place aussi** : 237 appels papier passés à 51.

### La note du lot 5 sur le calendrier était fausse, et je l'ai mesurée au lieu de la croire

Elle disait qu'on ne pouvait pas repeindre `bdv-calendrier.css` parce que sa vue liste « partage
`.echeance` avec `/outils/echeances/` ». C'est un partage de **noms**, pas de pages : les 128
règles de cette feuille sont toutes sous `.bdv-cal`, cette classe n'existe que dans
`src/mon-bureau.njk`, et la page publique des échéances ne charge que `style.css`. Rien
n'empêchait de la repeindre.

**Ce qui l'empêche de rendre son recouvrement est autre chose, et c'est le moment du
chargement.** `bdv-nav.js` pose cette feuille au **premier clic** sur la pièce, alors que le
balisage du calendrier est dans la page depuis le début, et son propre commentaire de tête le dit
déjà : « la pièce est montrée avant d'être habillée ». Descendre la valeur et retirer le
recouvrement laisserait donc le calendrier nu entre le clic et l'arrivée de la feuille. Le banc
l'a chiffré : **329 écarts par état** sur « Ma journée » et « Mes tâches », c'est-à-dire
exactement les états où la feuille n'est pas encore posée.

La section 16 de `bdv-bureau.css` garde donc son recouvrement, et les deux feuilles disent
maintenant **la même chose**. Ce n'est plus une course de specificité : quelle que soit celle qui
gagne, la couleur est la bonne. C'est la moitié du gain, prise sans le risque.

### La règle que ce lot écrit dans CLAUDE.md

> Une feuille que **seul** le bureau charge se repeint **en place**. Une feuille **partagée** avec
> le site se recouvre, et alors on balaye les specificités d'en face **avant** de capturer.

Avec une condition de plus, que ce lot a découverte : le recouvrement ne se lève que si la
feuille d'en dessous arrive **aussi tôt** que celle qui la recouvre. Une feuille liée par le
gabarit remplit les deux conditions ; une feuille posée par du code ne remplit que la première.

Les quatre défauts sont écrits avec leurs poids, parce que c'est ça qui se relit : `(0,2,1)`
contre `(0,2,0)` pour un nom d'élément de plus, `(0,4,1)` contre `(0,4,0)` pour la punaise,
`(1,2,0)` contre `(0,2,0)` pour un identifiant, et `h1,h2,h3,h4{color}` à `(0,0,1)` qui gagne
quand la règle d'en face ne nomme que `font-family` et `font-size`.

### Le banc a dit non trois fois, et chaque refus a appris quelque chose

Le garde-fou est celui de la scission, repris sans une ligne de changement : le style **calculé**
de chaque élément et de ses `::before` / `::after`, sur la page construite et servie.
**45 états, 141 187 éléments, 139 propriétés chacun, 19 624 993 valeurs.**

Verdict final : **zéro écart**, contre les deux relevés d'avant. Mais il a refusé trois fois.

1. **8 606 écarts.** Mon balayage comparait les **noms** de propriétés. Or `border` commande
   `border-left-color` et `gap` commande `row-gap` : une abréviation posée plus tard écrase une
   propriété longue posée plus tôt. Les quatre couleurs de famille du calendrier étaient
   retombées sur l'encre du texte.
2. **8 667 écarts.** Un `<button class="btn btn--geste">` porte les **deux** classes :
   `.bdv-coque .btn{border}` et `.btn--geste{border-color}` se disputent le même pixel alors que
   leurs sélecteurs n'ont pas une classe en commun. Même chose pour `.cal__coche--choix`.
3. **1 986 écarts.** Le moment du chargement de `bdv-calendrier.css`, raconté plus haut.

**Et le banc a été vérifié par mutation avant d'être cru** : un `word-spacing: 3px` glissé dans
les 812 règles des trois feuilles touchées fait sortir **129 012 écarts**. Un banc de
non-régression qui n'a jamais vu un écart n'a pas encore prouvé qu'il sait en voir un.

Un mot sur ses deux pièges, tous les deux réels. Le `margin: auto` que Chromium rend à `0px` tant
que la mise en page n'est pas résolue est ressorti **une fois**, deux écarts sur le cadre de la
démonstration de l'accueil, sur un lot qui ne touche aucune feuille que l'accueil charge. J'ai
donc relevé l'état d'avant **deux fois** et comparé aux deux. La route de coupure réseau posée
avant les doublures de CDN, elle, n'a pas bougé.

### Ce que les yeux ont vu

Les trois audits de rendu des lots 3, 4 et 5 rejoués : **zéro valeur papier, zéro paire sous son
seuil**, sur les neuf pièces, les six onglets du panneau, la modale, la porte et le voile, dans
les deux thèmes et aux deux largeurs.

Et une comparaison pixel avec les captures du lot 3 gardées dans « Claude outputs » : « Mes
tâches », le calendrier et la vue année sont **identiques au pixel**, clair et sombre. « Ma
journée » diffère de 9 665 pixels, tous dans une seule phrase : « 75 % éclairée » est devenue
« 77 % éclairée ». C'est la lune, qui est calculée. Sur téléphone, la barre basse des captures du
lot 3 est crème et la mienne est sombre : c'est le premier des quatre défauts, corrigé depuis, et
ces images-là sont antérieures à sa correction.

`npm run verif` passe en entier, ses trente-sept étapes une par une. `npm run charte` et
`npm run charte:bureau` sont CONFORME. La borne des ombres de la section A descend de 15 à 14
côté site et de 20 à 16 côté bureau : les ombres papier que les deux feuilles servaient sans
jamais les peindre sont parties. Une borne descend et ne remonte jamais.

### Ce que je te laisse, et il faut le savoir avant de croire le lot fini

**Les 233 appels papier qui restent dans `bdv-poste.css` peignent encore.** Le plus visible est
**« L'équipe »** : `.equipe-*` et `.invitation__*` n'ont jamais été dans le périmètre d'aucun des
cinq lots du thème. Ils sont donc toujours en papier, et en sombre ils posent de l'encre foncée
sur des cartes sombres. Pire : le décor de `scripts/bureau-garni.mjs` rend cette pièce **sans
équipier**, donc **aucun relevé ne les voit** et aucun audit ne les signale. Le trou est déjà
documenté en tête du banc depuis ce matin. Les repeindre **changera** l'écran : c'est un lot à
part, il ne pouvait pas se faire sous la promesse de celui-ci.

Le reste est petit : les 91 appels papier de `bdv-ecrans.css` restent voulus, ils sont tous dans
le rapport imprimable ; le recouvrement de la section 16 partira le jour où on décidera de lier
`bdv-calendrier.css` au gabarit, ce qui est un arbitrage de chargement, pas de dessin ; et mon
balayage de specificité ne sait pas quel élément porte quelles classes, donc il trouve 16 des
45 paires que le banc a refusées. Lui apprendre à lire le DOM des neuf pièces le rendrait
suffisant tout seul. Aujourd'hui il faut les deux, et dans cet ordre.

---

## 21/09/2026, au petit matin. `style.css` est coupée en deux

Le chantier que les cinq lots des deux thèmes ont rendu urgent. `src/css/style.css` faisait
325 ko et 1 350 règles, et elle servait **les deux mondes** : les douze pages publiques et le
bureau connecté. `npm run charte` le mesurait depuis le 19/09 et le disait en note. La moitié
bureau vit maintenant dans `src/css/bdv-poste.css`.

**310 règles, 1 060 déclarations, 74 105 octets de source.** Mesure sur le servi, après
minification : la feuille que chaque page plate télécharge à sa première visite passe de 148 661
à 117 955 octets, soit **30 706 octets de CSS bloquant en moins par page publique**. Le bureau
charge 149 062 octets au lieu de 148 661, soit **401 octets de plus** : les préludes de `@media`
et `@container` réécrits autour des règles sorties d'un bloc mixte. C'est le prix d'un
déplacement qui ne réordonne rien, et il est dit.

### Le garde-fou a appris à lire la nouvelle forme AVANT elle, et ce n'est pas du zèle

`CLAUDE.md` pose la règle depuis le 08/09 : « on apprend d'abord au garde-fou à lire la nouvelle
forme, on change la forme ensuite. Jamais l'inverse. » Elle a été écrite pour ce jour-là.

`scripts/charte.mjs` ne connaissait qu'une cible unique en mode site. Elle est devenue une
**liste**, `FEUILLES_SITE`, et le mode bureau a gagné `bdv-poste.css` dans sa liste de feuilles
nommées à la main. La feuille a d'abord été créée **vide**, avec son `<link>`, et les deux
chartes ont été relancées : CONFORME des deux côtés, sur l'ancienne forme. C'est ça, la preuve
que la préparation n'a rien cassé. Les règles ne sont parties qu'après.

Chaque moitié est désormais contrôlée contre **son propre lien Google Fonts** : `npm run charte`
contre celui de `base.njk`, `npm run charte:bureau` contre celui que la page construite du bureau
porte vraiment. C'est le préalable que `CLAUDE.md` exigeait avant de toucher au lien lui-même.

### Le seul piège du lot, et il était annoncé

La démonstration de la page d'accueil montre les **vrais** composants du bureau, décision du
12/09. Le critère de tri n'est donc pas « cette classe parle du bureau » mais **« quelle page
charge cette règle »**. Une règle qu'une page publique peut atteindre reste, même si elle porte
un nom de bureau.

**119 règles, 20 158 octets, restent côté public à cause de la seule démonstration** :
`.bureau-nav` et ses enfants, `.bureau-atelier`, `.bureau-plan`, `.zone` et ses cinq variantes,
`.zone__tete`, `.zone__note`, `.postit__v`, `__s`, `__tampon`, `__gestes`, `__g`, `.chiffre`,
`.fiche-l`, `.lettre__d`, `__t`, `__m`, `.card__title`. Cette liste **n'a pas été écrite de
mémoire** : `Claude outputs/lot6-pinboard.mjs` refait le tri deux fois, avec et sans la page
d'accueil, et rend la différence. **La question de la démo, que tu avais remise à plus tard, se
règle donc toute seule : ce qu'elle utilise n'a pas bougé.**

Une seule règle m'a fait douter, et elle est restée côté public : `.mono`, 115 octets. C'est une
utilitaire de chasse fixe, pas un composant, et son nom peut atterrir demain sur n'importe quel
gabarit. Le bureau charge les deux feuilles : une règle restée du mauvais côté est du poids, une
règle partie à tort est une panne.

### Un déplacement pur, et prouvé par la sortie

Aucune déclaration réécrite, aucun sélecteur renommé, aucune valeur repeinte. `css-tree` ne garde
pas les commentaires : régénérer la feuille aurait effacé les POURQUOI. `Claude outputs/lot6-tri.mjs`
se sert donc des offsets de l'arbre pour **découper le texte source**, et ce qui arrive dans
`bdv-poste.css` est octet pour octet ce qui part de `style.css`.

La preuve n'est pas une empreinte de fichiers, c'est un relevé du style **calculé** sur la page
construite et servie, avant et après : quatre pages publiques plus deux autres, aux deux
largeurs, et le bureau dans ses neuf pièces, dans les deux thèmes, panneau de réglages et modale
de tâche compris. **45 états, 141 187 éléments et pseudo-éléments, 139 propriétés chacun,
19 624 993 valeurs comparées, ZÉRO écart.**

### Le banc de sortie a menti deux fois avant de servir, et c'est un témoin qui l'a dit

Deux passages sur la **même** construction avant de s'en servir, et exigence de zéro écart.
Ce témoin a trouvé les deux :

1. **Chromium rend `0px` pour un `margin: auto` dont la mise en page n'est pas résolue.** Une
   fois sur quatre, le cadre de la démonstration sortait `0px` au lieu de `170px`. Un banc qui
   invente deux écarts sur du code identique ne peut pas en signaler un vrai.
2. **Playwright essaie les routes de la dernière posée à la première.** La route qui coupe le
   réseau, posée après les trois doublures de CDN, les avalait : les quatre pièces de vente ne se
   peignaient plus, et le relevé perdait 14 511 lignes **en se déclarant parfaitement stable**.
   Un banc qui compare moins se déclare vert.

Et il a été vérifié dans l'autre sens, par mutation : un `word-spacing: 9px` posé sur les 332
règles de `bdv-poste.css` sort **85 740 écarts**. Un banc de non-régression qui n'a jamais vu un
écart n'a pas prouvé qu'il sait en voir un.

**Ce qu'il ne couvre pas, et c'est cette mutation qui l'a trouvé** : le décor de
`bureau-garni.mjs` rend « L'équipe » sans équipier. `.equipe-ligne__*`, `.equipe-role` et
`.invitation__*` ne sont donc vus par aucun relevé, et une mutation posée dessus est passée
inaperçue. Le déplacement de ces règles repose sur le tri, pas sur une mesure. À garnir le jour
où on touchera à l'équipe.

### Les trois chiffres qu'il ne faut pas confondre

- **Le thermomètre 2, 56,9 ko : il n'a pas bougé, et c'est normal.** Il compte ce qui ne peut
  servir QU'au site public et part quand même dans le bureau. Le bureau charge toujours
  `style.css` : il lui faut la coque, les boutons et les composants partagés. Ne pas l'annoncer
  comme réglé.
- **Le thermomètre 3, nouveau, et c'est un ÉCHEC, pas une note** : les octets de `style.css` qui
  ne peuvent servir QU'au bureau. Borne à 150, mesure du jour 115. C'est ce chiffre qui empêche
  la scission de se défaire en silence : une règle de bureau réécrite dans `style.css` ne casse
  aucun pixel et ne lève aucune erreur, elle remet juste le poids sur les douze pages plates.
- **`npm run banc:poids` ne bouge pas non plus : 112,3 ko avant, 112,3 ko après.** Il pèse les
  **scripts** qui bloquent l'affichage, pas les feuilles de style. Le gain de ce lot est sur les
  pages publiques, et il est réel, mais ce banc-là ne le voit pas. Il n'y a rien à corriger, il y
  a une confusion à ne pas faire.

### Le second lien Google Fonts attend, et la mesure a retourné la phrase d'origine

`CLAUDE.md` disait depuis le 18/09 : « `Caveat` ne sert que sur l'accueil, `JetBrains Mono` sur
aucune des douze pages plates ». Relevé au navigateur, famille résolue élément par élément sur
seize pages publiques et sur les neuf pièces du bureau : **la première moitié est vraie, la
seconde est fausse.** `JetBrains Mono` est utilisée 116 fois sur quatre pages publiques, et
**zéro fois dans le bureau** depuis que `bdv-bureau.css` a repeint la coque en Inter. `Caveat` :
6 fois sur l'accueil, zéro dans le bureau.

**C'est donc le lien du BUREAU qui peut maigrir, pas celui du site.** Il pourra perdre
`JetBrains Mono` et `Caveat`. Les octets n'ont pas pu être mesurés depuis la session, le pont
refuse `fonts.googleapis.com` : la commande qui les donne est dans `CLAUDE.md`, et il ne faut pas
recopier les « 60 à 90 ko » du 18/09, qui étaient une estimation portant sur le mauvais côté.

Et le lien ne se scinde pas aujourd'hui : `charte.mjs` lit encore le lien sur le TEXTE ENTIER de
sa source, où la dernière occurrence d'une famille écrase les précédentes. Avec deux liens, il
couvrirait l'incident des 376 passages en gras au lieu de l'attraper. Ce qui reste à faire est
écrit dans `CLAUDE.md`.

### Vérifié

`npm run verif` en entier, par paquets : 37 étapes, zéro échec. `npm run charte` et
`npm run charte:bureau` CONFORME. La minification du build recompte bien la nouvelle feuille
(342 ko de moins à servir contre 334 avant, la différence étant `bdv-poste.css` qui passe par le
même crochet). Le banc de sortie vert. Et la construction **aboutit** depuis la session
maintenant : la note d'environnement du 21/09 sur l'`unlink` interdit n'est plus vraie.

---

## 21/09/2026, la nuit, plus tard. Le panneau, la modale, le voile et la porte

Cinquième et dernier lot des deux thèmes. Il restait exactement deux morceaux de papier annoncés
la veille, et ils se voyaient : le panneau de réglages et la modale de tâche. Le premier était le
pire, parce qu'il n'attend pas qu'on le demande. Sur une base vide, `openApp()` l'ouvre tout seul
par-dessus l'écran : une dalle crème au milieu d'un bureau noir, dès la première ouverture. En
ouvrant le chantier on en a trouvé deux autres du même genre, le voile d'amorçage « On raccorde
ton bureau » et la porte de compte, et ils y sont passés avec.

### Le panneau a deux moitiés, et c'est le piège d'entrée

Le style du panneau n'est pas dans un fichier, il est dans deux : `src/css/bdv-panneau.css` pour
les blocs du moteur, et la constante `STYLE` de `src/js/bdv-reglages.js` pour le squelette, le
voile, la boîte, les six onglets, le pied. Repeindre la première seule aurait laissé la dalle
crème exactement où elle était, puisque c'est la seconde qui porte `background: var(--paper)`.
**Les deux vont ensemble**, et le commentaire de tête de chacune renvoie maintenant à l'autre.

Comme au lot 4, on modifie **en place**. `.bdvr-*` ne vit que dans le bureau depuis que le
tableau de bord n'est plus une page, donc les valeurs papier sont supprimées au lieu d'être
cachées, et le poids mort n'augmente pas. 75 règles réécrites, zéro jeton papier restant dans
les deux moitiés. Et `bdv-panneau.css` ne déclarait aucun `:root`, contrairement à
`bdv-ecrans.css` la veille : vérifié avant de toucher à quoi que ce soit.

La modale de tâche, elle, est habillée par `style.css`, lignes 8144 à 8280. On ne touche pas à
cette feuille : elle sert la démonstration de la page d'accueil. Elle est donc **recouverte**
sous `.bdv-coque` dans `bdv-bureau.css`, comme le liège et les punaises au lot 3. Même chose pour
le voile d'amorçage. La porte de compte n'est dans aucune feuille : `bdv-compte.js` injecte son
CSS, et elle s'ouvre aussi depuis le site public, donc elle garde son papier là-bas et elle est
recouverte ici.

### Et celle-là demande (0,2,1), pas (0,2,0)

C'est la seule différence des trois, et elle aurait tué le bloc entier sans une erreur. Le style
de la porte est injecté dans `<head>` à l'ouverture, donc **après** `bdv-bureau.css` : à
spécificité égale c'est lui qui gagne. `body.bdv-coque` pèse un nom d'élément de plus et passe
devant. Règle générale à retenir : un style injecté en JavaScript est toujours plus tard qu'une
feuille du gabarit, et l'égalité ne suffit pas.

### Le piège qui s'était payé trois fois a été cherché avant la capture

La barre d'onglets du téléphone restée crème, la punaise du panneau restée papier, la barre
« 286 lignes » restée crème : trois lots, trois fois une règle d'en face plus lourde ou une
propriété que la nouvelle ne nommait pas, et **trois fois trouvée à l'image**. On a donc écrit un
balayage, `Claude outputs/lot5-specificite.mjs`, qui confronte les 80 règles de `style.css` qui
visent une classe de la modale et les 16 qui visent une classe du panneau à la spécificité des
nouvelles. Dix minutes. Quatre trouvailles :

1. `h1,h2,h3,h4{color:var(--ink)}` pèse (0,0,1) et gagnait quand même, parce que les règles de
   titre ne nommaient que `font-family` et `font-size`. Le titre d'une tâche serait resté à
   1,05:1 sur la boîte sombre. **Aucune mesure de feuille ne pouvait le dire : les deux moitiés
   de la paire sont dans deux fichiers.**
2. `.btn:hover` de `style.css` pose `transform` et `box-shadow` que personne ne nommait : les six
   boutons du panneau avançaient de deux pixels et posaient une ombre dure en encre du site au
   survol, y compris sur fond noir, où c'est une tache sans bord.
3. `.bdv-coque .btn{min-height:36px}` battait `.tmod .btn{min-height:44px}` : les deux boutons
   qui écrivent dans la modale étaient sous le plancher tactile sur téléphone depuis le lot de la
   coque.
4. `.bdv-coque tbody td{height:44px}` n'était pas nommé côté panneau : sur téléphone, une fiche
   de six cellules faisait 264 px pour six lignes de texte.

Deux défauts plus anciens sont tombés en passant. `.kpi--hi` n'avait pas de fond dans le panneau
et ses deux enfants étaient écrits en `--on-dark-soft`, du crème : **1,08:1** sur la carte
blanche, sur le papier comme sur le bureau, depuis la fusion du 07/09. Et les quatre tons de
`.signal` manquaient à cette feuille, alors que `bdv-base.js` les écrit : les quatre gravités du
classement se ressemblaient.

### La zone de dépôt ne dit plus « tu es dessus » par une couleur

C'est la cible d'un glisser-déposer. Au moment où tu en as le plus besoin, tu as le curseur, la
vignette du fichier et ta main entre l'œil et la zone, et en sombre les écarts de teinte sont
plus courts qu'en clair. L'état est donc doublé deux fois : le trait passe de tireté à plein, ce
qui est une forme, et **le mot « lâche ici » s'affiche sous l'invite**. Même geste pour l'avis du
pied du panneau et pour l'erreur de la modale, qui portaient leur verdict par la seule couleur :
une coche ou un point d'exclamation en `::before`.

Le texte de confirmation du vidage, lui, n'a pas bougé d'un caractère. C'est une demande mot pour
mot de Ted, `npm run banc:vidage` le garde, et on repeint le bouton sans réécrire la phrase.
Pareil pour `data-off` et `data-off-vide` : deux marques distinctes, elles le restent.

### Un accent grave a rendu un fichier illisible par acorn, et le build l'a dit en une ligne

Trois commentaires ajoutés dans la constante `STYLE` de `bdv-reglages.js` citaient un nom de
jeton entre accents graves. Un accent grave ferme le gabarit : le fichier est devenu
insyntaxique, et le build a affiché **une** ligne, « illisible par acorn, laissé tel quel », sans
échouer. Le minifieur laissait simplement 68 ko non traités. Les commentaires de cette constante
citent maintenant les noms entre guillemets français.

### Ce que la capture a trouvé, et que cinquante bancs verts n'avaient pas vu

Neuvième fois. Les deux boutons du pied du voile d'amorçage, « Réessayer » et « Ouvrir quand
même », sont écrits en `btn btn--geste`, et `.bdv-coque .btn--geste` leur donne le dessin d'une
action de rangée : fond transparent, bordure transparente, révélée au survol. C'est juste dans un
listing. C'est faux ici, où ces deux boutons sont **la seule sortie d'un voile qui couvre tout
l'écran** : ils apparaissaient comme deux bouts de texte gris, dans les deux thèmes.

Aucun calcul ne pouvait le dire, le contraste du libellé est bon. C'est l'affordance qui
manquait, et seule l'image la montre.

Les deux aperçus ne chargeaient pas `bdv-theme.css`, exactement comme celui de la fiche la
veille : ils auraient montré une page dont toutes les `var()` tombent dans le vide.
`npm run apercu:modale` et `npm run apercu:amorce` chargent maintenant les trois feuilles dans
l'ordre du gabarit et rendent chaque état deux fois, en clair et en sombre.

### Le compte de papier restant, et ce qui reste ouvert

Dans ce que le bureau charge, commentaires retirés : **zéro** appel à un jeton papier dans
`bdv-theme.css`, `bdv-bureau.css`, `bdv-panneau.css`, le `STYLE` de `bdv-reglages.js` et la porte
de `bdv-compte.js`. Restent 91 dans `bdv-ecrans.css`, tous dans le rapport imprimable, qui garde
le papier exprès, et **237 dans `bdv-calendrier.css`**, tous recouverts par la section 16 de
`bdv-bureau.css`. Ces 237 sont le poids mort du lot 3 et le dernier chantier ouvert du dessin :
la feuille n'a pas été modifiée parce que sa vue liste réutilise volontairement `.echeance` de
`/outils/echeances/`.

Audit de rendu, quatre passages, neuf écrans par passage, les deux thèmes et les deux largeurs :
zéro valeur papier, zéro paire sous le seuil. `npm run verif` entier, `npm run charte` et
`npm run charte:bureau` CONFORMES.

**Le chantier des deux thèmes est clos.** Ce qui reste ouvert est la scission de `style.css`, que
les cinq lots ont rendue plus urgente et pas moins, `bdv-calendrier.css` à repeindre en place le
jour où sa vue liste ne partagera plus ses classes avec la page publique, et le fait que la porte
de compte garde deux dessins sans qu'aucun garde-fou ne rappelle de tenir les deux.

## 21/09/2026, la nuit. Les cinq écrans de vente et la fiche client

Le lot précédent avait repeint « Ma journée », « Mes tâches » et « Le calendrier », et laissé en
papier les cinq écrans qui lisent Vitisoft plus la fiche client. Ce n'était plus une incohérence
théorique : **le bouton de bascule est livré depuis ce matin**, donc un vigneron qui passe en
sombre trouvait « Mon commerce », « Mon cap », « Mes cuvées » et « Mon registre » illisibles, de
l'encre papier sur des cartes sombres. Ce lot ferme ça.

### On modifie la feuille en place, on ne la recouvre pas

Aux lots 2 et 3 il fallait recouvrir `style.css` dans une feuille à part, parce que `.zone`,
`.postit` et `.lettre` servent aussi la démonstration de la page d'accueil. **Ici, non.**
`.bdv-ventes` n'existe que dans `mon-bureau.njk` et `ecrans-vente.njk`, et `bdv-ecrans.css`
n'est chargée que par le bureau : on modifie donc la feuille DIRECTEMENT. On évite le poids mort
que les deux lots précédents ont accumulé, et surtout on peut SUPPRIMER les valeurs papier au
lieu de les cacher. 296 appels à un jeton papier avant, 49 après, et les 49 sont le rapport
imprimable, qui garde le papier exprès (voir plus bas).

### Le `:root` de `bdv-ecrans.css` a disparu, et la mesure l'a décidé

Il portait 71 jetons. **Soixante étaient la copie mot pour mot du `:root` de `style.css`**, qui
est chargée sur toutes les pages, donc aussi sous cette feuille : ils ne servaient qu'à se
périmer en silence. C'est la mécanique exacte de dérive que `npm run banc:jetons` a été écrit
pour attraper, et qui avait déjà coûté `--ombre-photo`, deux ombres sous un seul nom.

Les onze autres n'existaient que là. Les huit `--serie-1..8` et `--bordeaux-voile` sont devenus
`--bdv-serie-1..8` et `--bdv-aire-accent` dans `bdv-theme.css`, avec leur valeur sombre.
`--ok-clair` et `--danger-clair` sont partis : ils n'existaient que pour le bloc de rythme de
« Mon cap », qui était une carte SOMBRE posée sur du papier clair. Ce bloc prend maintenant la
surface des autres cartes, donc `--bdv-bon` et `--bdv-retard` suffisent.

Conséquence chiffrée : `banc:jetons` ne rend plus aucune note. Il en rendait une, « 60 jetons
redéclarés à l'identique dans plusieurs feuilles, chaque doublon est une dérive qui attend ».

### Les huit séries de graphique, et c'est la partie délicate

Elles sont catégorielles, elles étaient dessinées pour du papier, et trois d'entre elles
tombaient sous 3:1 sur du blanc (`--serie-8` à 1,94:1). Sur un fond sombre, les huit vibraient.

**Elles sont séparées en LUMINANCE et pas en teinte**, pour rester distinctes en niveaux de gris
et en vision deutéranope, et **l'ordre de déclaration alterne le bas et le haut de l'échelle** :
ce qui compte est l'écart entre deux séries VOISINES dans un graphique, pas entre la première et
la dernière. Luminances relatives, dans l'ordre : `.022 .160 .045 .208 .075 .250 .115 .290` en
clair, `.140 .425 .195 .515 .265 .615 .340 .720` en sombre. Écart minimal entre voisines 1,81 en
clair et 1,71 en sombre ; en vision deutéranope, 1,80 et 1,77. Pire contraste sur la surface qui
les porte : 3,09:1 en clair, 3,31:1 en sombre, et ce sont des objets graphiques, jamais du
texte, donc le seuil est 3:1.

**Ce que ça ne règle pas, et il faut le dire** : à huit niveaux dans une fenêtre de 3:1, deux
séries NON voisines peuvent se ressembler. La pire paire quelconque tient 1,13 en luminance.
C'est structurel, et c'est pour ça que Chart.js garde sa légende et ses infobulles : la couleur
ne porte jamais seule le nom d'une série.

### Un jeton de CSS ne traverse pas tout seul jusqu'à un graphique

`palSeries()` dans `bdv-base.js` lit les jetons par `getComputedStyle`, et Chart.js reçoit des
CHAÎNES de couleur qu'il garde. **Un vigneron qui ouvrait « Mon cap » en clair puis appuyait sur
le bouton gardait donc un graphique aux couleurs claires au milieu d'un bureau sombre**, sans
une erreur, jusqu'au prochain rechargement. Toute la page se retournait sauf les six canvas,
c'est-à-dire exactement ce qu'il était venu regarder.

`BdvTheme.appliquer()` émet maintenant un événement `bdv:theme`, et `bdv-ecrans.js` l'écoute
pour invalider et repeindre l'écran courant. **Deux sources et pas une** : le bouton, et le
réglage du téléphone par `prefers-color-scheme`, qui bascule seul au coucher du soleil sur un
iPhone en mode automatique. Sans la seconde, le bureau laisse en place à 21 h les graphiques
peints à 18 h. On n'écoute le média que si aucun choix n'est mémorisé.

Vérifié dans un vrai navigateur, en lisant la couleur que Chart.js REÇOIT : `#9E2B47` avant,
`#F294A9` après le bouton, `#F294A9` après une bascule du système sans choix mémorisé.

### Le rapport imprimable garde le papier, et ce n'est pas un oubli

`#printReport` n'est jamais affiché à l'écran, il ne sort que par l'imprimante, et
`print-color-adjust: exact` force ses fonds. Le repeindre en jetons de thème ferait sortir des
pages NOIRES de l'imprimante de tout vigneron qui a choisi le sombre, encre blanche comprise.
**Le papier est le bon medium pour le papier.** Ses 49 appels à un jeton papier restent, et ils
viennent tous du `:root` de `style.css`, qui est toujours chargée.

### Ce que la capture a trouvé, et que trois bancs verts n'avaient pas vu

**Huitième fois que la même leçon se paie.** `charte`, `charte:bureau`, `banc:jetons` et les
trente-sept bancs étaient verts sur les trois défauts suivants.

1. **La barre « 286 lignes » est restée crème sur un bureau noir.**
   `#bureauVentes .bdv-ventes .topbar` dans `style.css` pèse **(1,2,0)** contre **(0,2,0)** pour
   la règle que ce lot venait d'écrire : un IDENTIFIANT de plus. C'est mot pour mot la barre
   d'onglets du lot 2 et la punaise du lot 3, **une règle d'en face qu'on n'a pas lue en
   entier**, et aucun banc ne la mesure. **Supprimées, pas corrigées sur place** : c'étaient
   des rustines qui ramenaient au papier la barre bordeaux du tableau de bord d'origine, et
   `bdv-ecrans.css` la peint elle-même maintenant. Les corriger aurait fait appeler un jeton
   `--bdv-*` depuis `style.css`, que `npm run charte` lit en mode site, où `bdv-theme.css`
   n'est pas chargée : trois « var() sans déclaration » sur du sain.
2. **Deux couleurs écrites en attribut `style` dans `bdv-ecrans.js`**, les barres de gain et de
   perte de « D'où vient ta variation ». Elles valaient `--ok` et `--danger`, qui n'ont qu'une
   valeur : sur un fond sombre le vert tombait à 2,1:1. Elles ne se voient dans aucune feuille,
   et la section 8 de `npm run charte` est le seul contrôle qui les regarde.
3. **La vignette mise en avant devenait une dalle rose.** `--bdv-accent` est un bordeaux profond
   en clair et un rose pâle en sombre : l'aplat qui se lisait comme une action primaire devenait
   deux grands rectangles roses au milieu de « Mon cap ». Elle prend le lavis et garde son filet
   d'accent. C'est aussi la règle du seul accent à trois usages : un chiffre mis en avant n'en
   est pas une.

### Et le harnais s'est menti à lui-même deux fois

**Une fois sur le décor.** `scripts/bureau-garni.mjs` pose 286 lignes dans IndexedDB, mais les
écrans de vente ne les CHARGENT pas tout seuls depuis l'amorçage léger du 18/09 : ils affichent
« tes lignes ne sont pas encore chargées » et attendent un clic. Les premières captures
montraient donc cinq écrans vides, joliment mis en page. Le harnais clique désormais sur
« Charger mes lignes et compléter », **et il lève si aucune rangée n'est peinte**.

**Une fois sur l'écran de base vide.** Photographié dans un contexte à base vide, il sortait
SANS SA FEUILLE : sur une base vide le conteneur ne fait jamais aboutir l'amorçage, faute de
réseau, donc `chargerEcrans()` ne pose jamais `bdv-ecrans.css`. Le titre retombait sur le
`h1,h2,h3` de `style.css`, en `--ink`, illisible. **Ce faux défaut valait le détour** : il dit
que le vrai `#p-vide` doit se regarder dans un bureau garni, ce qu'il fait maintenant.

### `npm run apercu:fiche` montrait une fiche sans couleurs, et personne ne l'aurait su

Il recopiait `style.css` et `bdv-ecrans.css`, pas `bdv-theme.css`. Depuis ce lot la fiche ne lit
plus que des `--bdv-*` : l'aperçu aurait montré une fiche dont toutes les `var()` tombent dans le
vide. La feuille est ajoutée, et chaque état est maintenant rendu DEUX FOIS, côte à côte, sous
deux conteneurs qui forcent l'un le clair et l'autre le sombre. C'est exactement ce que la forme
sans `:root` des blocs 1 et 3 de `bdv-theme.css` existe pour permettre.

### Ce qui reste ouvert

- **Le panneau de réglages** (`bdv-panneau.css`) est toujours en papier, et ça se voit : sur la
  base vide, `openApp()` l'ouvre par-dessus l'écran, et c'est une dalle crème sur un bureau noir.
  C'est le lot suivant, et il est le dernier morceau de papier du bureau.
- **La modale de tâche**, même chose.
- **Les largeurs de colonne en dur** : `7rem` pour la valeur d'une barre de répartition, `9rem`
  pour la première colonne d'un tableau sur téléphone, `5,2 rem` devenu `7rem` faute de place.
  Ce sont des mesures de contenu, pas des pas d'échelle, et leur donner un jeton serait du
  rangement sans mesure derrière.
- **Le pire contraste d'un graphique tient exactement 3,09:1 en clair.** C'est au-dessus du
  seuil et c'est mince. Si une septième teinte doit entrer un jour dans l'échelle, il faudra
  rouvrir la fenêtre de luminance, pas y glisser une valeur de plus.

## 21/09/2026, le soir. Le contenu des trois pièces, et le papier s'en va

Le lot de la coque avait repeint le fond, l'en-tête, le rail et les primitives, et laissé le
CONTENU des pièces en papier. En sombre, ça posait de l'encre foncée sur des cartes sombres :
les montants du sous-main, les titres de tâches et les échéances du calendrier ne se lisaient
pas. C'était l'incohérence assumée du lot précédent. Celui-ci la ferme, sur les trois pièces
qui ne demandent pas Vitisoft : « Ma journée » et ses huit zones, « Mes tâches », « Le
calendrier ».

### La métaphore matérielle est abandonnée, et c'est tout le lot

Le liège et ses punaises, le papier continu à picots, le bloc à effeuiller, l'ardoise encadrée
de bois, le carton kraft, la pile, les dos de classeur et l'enveloppe : plus rien de tout ça
sous `.bdv-coque`. À la place, ce que la maquette validée pose partout ailleurs : une carte, un
trait de 1 px, une surface qui monte d'un cran, et la hiérarchie portée par la typographie.

**Le motif n'est pas le goût.** Une matière se dessine avec des couleurs qu'elle ne peut pas
retourner : le liège est un brun clair, son encre un brun foncé, et l'un sur l'autre ne tient
que sur du papier. Un bureau qui s'ouvre à 6 h dans un chai et à 23 h dans un bureau ne peut
pas porter six matières qui ont chacune leur propre lumière.

**Rien n'est supprimé de `src/css/style.css`, pas une ligne.** Tout est recouvert sous le scope,
comme au lot précédent, parce que `.zone`, `.postit` et `.lettre` sont aussi les classes de la
démonstration de la page d'accueil. La section « LA RÈGLE DU PLATEAU » de `CLAUDE.md` a été
réécrite plutôt que laissée telle quelle : elle décrivait un mobilier qui n'existe plus dans le
bureau, tout en restant vraie pour l'accueil. Elle dit maintenant les deux, dans cet ordre.

### Ce que chaque zone devient

Le panneau devient une pile de choses à faire. La règle des deux natures n'est pas seulement
gardée, elle devient visible : `data-mot`, posé par `mon-bureau.njk` depuis le 10/09, dit si la
ligne de tête est un chiffre ou un titre, et la grille les range dans deux colonnes différentes.
« 3 / rappels en retard » d'un côté, « EN RETARD / Domaine des Hauts Coteaux » de l'autre.

Le sous-main devient un tableau propre : rangée de 44 px, séparateur de 1 px, survol à 5 %,
actions révélées à droite. **Le défaut « MONTANTRETARD » vu à la capture était une conséquence
du lot précédent**, et pas un défaut d'espacement : les largeurs de colonnes de `style.css` sont
mesurées pour un en-tête de dix pixels sans écartement, la coque les a reposés à 12 px avec
`--bdv-ls-etiq`. « MONTANT » passe de 52 à 67 px dans une colonne de 72, il déborde, et
`nowrap` l'envoie par-dessus son voisin. Les cinq largeurs sont reprises en pourcentage.

L'ardoise devient quatre nombres nus avec leur libellé et leur provenance. Le mot du jour perd
son fond teinté et garde son signe de gravité, qui est ce qui porte l'état. Le bloc calendrier
perd sa perforation. Les trois zones de lecture se resserrent : 206 → 185, 225 → 202, 349 → 317
px, mesuré avant contre après sur le même décor. **La fusion en une seule bande « Ta lecture »,
que montre la maquette, n'a pas été faite** : elle ferait passer les huit zones de
`#bureauJournee` à six, et cette liste est l'ordre que Ted a dicté le 07/09. C'est une décision
de contenu, elle se prend avec lui. L'ordre, lui, n'a pas bougé d'une ligne : il est déjà celui
de la maquette.

### Quatre jetons de plus, et ils doublent des jetons existants

`--bdv-fam-1` à `--bdv-fam-4`, les familles du calendrier. Ils doublent `--fam-1..4` au lieu de
les réutiliser, et ce n'est pas du rangement : `--fam-1` vaut #4A1220, il tient 13,09:1 sur le
papier du site et **1,26:1 sur une carte sombre**, c'est-à-dire qu'il disparaît. Le calendrier
public n'a qu'un thème, celui du bureau en a deux. Séparés en luminance et pas en teinte, comme
le veut la charte : douze points de L* entre deux familles voisines, dans les deux thèmes.

### Le plafond des échelles a changé le dessin avant d'échouer

Les cinq familles de la section A de `npm run charte` étaient exactement à leur borne : 35
tailles, 0 rayon, 20 ombres, 9 épaisseurs de filet, 8 z-index. Les trois `box-shadow: inset` que
ce lot allait poser auraient été les 21e, 22e et 23e recettes d'ombre du bureau. Elles sont donc
écrites en bordure, qui dessine le même trait de 2 px sans rien ajouter à aucune échelle. **Un
plafond qui mord change le code avant d'échouer, et c'est tout ce qu'on lui demande.**

### L'audit de contraste à l'écran, et pourquoi la feuille ne pouvait pas le faire

Septième fois que la même leçon se paie. `npm run charte` section 6 bis était VERTE sur
vingt-trois paires illisibles, et elle avait raison de l'être : elle ne regarde qu'une règle qui
pose à la fois une encre ET un fond. Aucune des vingt-trois ne le fait. Ce sont des encres de
`style.css` posées sur des fonds de `bdv-bureau.css`, et composer ça demande de rejouer la
cascade, c'est-à-dire d'être un navigateur.

L'outil écrit pour ce lot parcourt le rendu, remonte au premier fond opaque en composant les
voiles au passage, et rend toute paire sous son seuil. Douze passages, trois pièces par thème et
par largeur : **27 paires au premier, zéro au dernier.**

Ce qu'il a sorti, et rien ne se voyait à la lecture : le `a { color: var(--bordeaux) }` du site
sur les trois liens du bureau qui n'ont pas de classe, à 1,37:1 ; la punaise de téléphone, dont
la règle d'en face pèse un nom d'élément de plus que la mienne et gardait donc son papier, à
1,03:1 sur un nom de client ; la bande alternée du listing, écrite DEUX fois, sur la cellule
puis sur la rangée dans la requête de conteneur, donc à moitié corrigée ; les cinquième et
sixième familles du calendrier, dessinées en `--ink`, qui disparaissaient de la grille ; les
anneaux de focus du calendrier, en bordeaux, c'est-à-dire un focus clavier qui n'existe plus.

**Et le correctif du quatrième en a fabriqué un autre**, trouvé par le même audit au passage
suivant : en donnant une taille aux occurrences écrites à la main, il battait le `font-size: 0`
de la pastille du téléphone, qui reprenait son texte à 12 px dans un point de 6 px. Un audit
qu'on ne rejoue pas après correction ne mesure que l'état d'avant.

### Ce que l'œil a trouvé et que l'audit ne pouvait pas trouver

L'audit ne juge que du texte. Trois défauts de ce lot n'en étaient pas.

La quatrième case vide de l'ardoise, un rectangle de 180 px qui montrait le fond de la grille :
il n'y a quatre chiffres que si l'objectif est arrivé dans le miroir. L'ancien dessin avait le
même trou, invisible parce que la case vide était de la couleur de l'ardoise.

Le soulignement de la vue année, en `--bdv-trait-fort`, 1,64:1. Dans cette vue il n'y a aucun
intitulé : ce trait est la seule chose qui dise qu'une période passe par ce jour-là. C'est donc
un objet graphique porteur d'information, son seuil est 3:1, et il prend `--bdv-encre-4`.

Les actions cachées au repos sur téléphone. `@media (hover:hover) and (pointer:fine)` ne suffit
pas : une fenêtre d'ordinateur réduite à 390 px a une souris ET prend la mise en page du
téléphone, où `style.css` remonte les gestes sur la première ligne. Le périmètre était la
largeur, pas le pointeur.

### Le décor du harnais garnissait trois zones de moins qu'il ne croyait

`scripts/bureau-garni.mjs` n'écrit ni `resume.conseils`, ni `bdv_signets_v1` : le mot du jour,
« À lire » et « Le classeur » étaient vides à la capture. C'est exactement l'avertissement de
`CLAUDE.md`, à trois zones près, et on allait juger le dessin de trois zones qu'on ne voyait
pas. Le complément est dans `Claude outputs/lot3-decor-sup.mjs`, partagé par les trois passes du
harnais pour qu'un décor recopié ne porte pas son défaut deux fois. **À remonter dans
`scripts/bureau-garni.mjs` au prochain lot qui y touchera.** Les quatre autres fichiers du
harnais sont à côté : `lot3-audit-contraste.mjs`, qui est le vrai livrable de la soirée,
`lot3-capture-contenu.mjs`, `lot3-capture-vues.mjs` et `lot3-mesure-zones.mjs`, qui sert le
« avant » depuis `git show HEAD:` pour que les mesures de resserrement soient comparables.

### Le poids mort, et il faut l'assumer

22 115 octets de règles de dessin papier restent dans `style.css` et `bdv-calendrier.css`,
entièrement recouvertes sous le scope. Servi au navigateur, après minification :
`bdv-bureau.css` passe de 13 111 à 46 189 octets, `bdv-theme.css` de 2 774 à 3 014, `style.css`
ne bouge pas. **+33 318 octets pour `/mon-bureau/`.**

Les deux compteurs d'octets de la section C de `npm run charte` ne bougent pas, et c'est
normal : ils comptent les règles dont aucune classe n'existe nulle part, et celles qui ne
peuvent servir qu'au site public. Une règle recouverte n'est ni l'une ni l'autre : sa classe
existe, elle s'applique encore, elle est simplement battue. **La scission de `style.css` reste
le chantier qui règlera ça, et ce lot l'a rendue plus urgente.**

### Ce qui reste ouvert

Les cinq écrans de vente, le panneau de réglages, la fiche client et la modale de tâche sont
toujours en papier, donc toujours mal lisibles en sombre. C'est le lot suivant.

Le vide sous le sous-main : `.bureau-plan` porte `align-items: start`, donc la carte s'arrête à
sa hauteur pendant que le bloc calendrier, à sa droite, descend plus bas. C'est le comportement
d'avant, il se voit plus maintenant que les cartes ont un fond uni. À trancher avec Ted.

La coche de « Mes tâches » sur téléphone fait 44 px de bordure au lieu de 20 : le plancher
tactile est posé en retrait intérieur, mais la bordure reste dessinée sur la boîte entière.
Antérieur à ce lot, signalé et non corrigé.

---

## 21/09/2026, la suite. Le dessin de la coque, et il est scope

Le lot du matin a pose cinquante jetons que personne ne lisait. Celui-ci est le premier a
dessiner. Il ne traite que la COQUE : le fond de page, l'en-tete, la barre des pieces, la grille
de l'atelier, les primitives partagees et le bouton de bascule clair / sombre. Le contenu des
pieces vient au lot suivant, et les deux ne se poussent qu'ensemble.

### L'arbitrage de Ted, et il commande tout le lot

`.zone`, `.postit` et `.lettre` ne sont pas des classes du bureau : ce sont aussi celles de la
demonstration de la page d'accueil, qui montre volontairement les VRAIS composants du bureau
(regle du 12/09). Les repeindre sans scope aurait donc change la page d'accueil du site public.

**Ted a tranche : on scope maintenant, on rouvrira la question quand les neuf pieces seront
finies.** Le nouveau dessin vit dans une feuille nouvelle, `src/css/bdv-bureau.css`, et
`src/css/style.css` n'est pas touchee, pas une ligne. Les matieres du plateau ne sont pas
supprimees, elles sont recouvertes sous le scope : c'est ce qui rend le lot reversible.

Le scope s'appelle `.bdv-coque` et il est pose sur le corps de page par le MEME drapeau njk que
celui qui lie la feuille des themes, `theme_bureau`. La classe ne peut pas arriver sans sa
feuille, ni la feuille sans sa classe. On a ecarte `.bdv-poste`, qui depend de l'etat de session :
le bureau deconnecte le perd, et sa porte doit suivre le meme dessin que le reste.

Le controle qui va avec est la section 10 bis de `npm run charte --bureau`, ecrite sur le modele
exact de celle qui garde `.bdv-ventes` depuis le 07/09. Sans elle, une seule regle qui fuit
repeint l'accueil et rien ne le dit.

### L'en-tete : 209 px, puis 56, et il deplace au lieu de tasser

Le 18/09 au soir, le bandeau avait ete resserre a 71 px puis range en deux lignes, et Ted avait
refuse les deux : « c'est un foutoir pas possible », puis « c'etait mieux avant ». Il avait
raison, et on comprend pourquoi maintenant : on avait TOUT garde en le tassant.

La maquette validee deplace. L'en-tete ne porte plus que ce qui vaut pour les neuf pieces, le nom
de la piece, la date, l'etat et les actions. Le salut, la plaque et la lune descendent dans « Ma
journee », ou ils sont a leur place : un « Bonjour Teddy » au-dessus de « Mon registre » est du
decor. Le resume reste en haut, parce que c'est un ETAT et qu'un etat se lit partout.

Mesure : **57 px de bandeau au lieu de 209**, aux deux largeurs et dans les deux themes. Sur
1440 x 900, la premiere zone de travail commence a 232 px au lieu de 314 : le panneau entier plus
la moitie du sous-main tiennent maintenant dans le premier ecran.

### Le bouton de bascule a trois etats, et c'est le seul point non negociable

Auto, clair, sombre, puis retour a auto. « Comme mon telephone » est le defaut, il ne pose aucun
attribut, et il faut pouvoir y revenir : un bouton a deux positions enferme pour toujours celui
qui a clique une fois, et son bureau resterait clair la nuit parce qu'il a essaye le clair un
matin. L'etiquette vocale dit l'etat ET ce que fera le prochain appui.

`color-scheme`, laisse en commentaire le matin avec sa raison, est allume. Verifie a la capture,
champ par champ : les deux dates de « Mes taches », le champ de saisie, la barre de defilement,
le curseur et la selection suivent le theme, et restent a 16 px et 44 px.

### Ce que la capture a trouve et que les cinq bancs avaient valide

Sixieme fois que la lecon se paie. Quatre defauts, tous verts au banc :

1. l'en-tete faisait 139 px avec un `min-height: 56px` parfaitement respecte, parce que
   `style.css` empile les boutons d'action en colonne et que je n'avais pas reecrit
   `flex-direction`. Une propriete qu'on ne reecrit pas reste celle de la cascade ;
2. le bouton de bascule montrait ses trois glyphes a la fois : `.bdv-bascule svg` pese un point
   de plus que `.bdv-bascule__g`, donc le `display:block` de confort battait le `display:none` ;
3. la largeur du rail s'appliquait aussi sur telephone, faute d'etre bornee a 901 px : le travail
   tombait a 182 px dans une fenetre de 390 et les douze colonnes du plan mesuraient zero ;
4. les deux boutons de l'en-tete sortaient du cadre a 390 px sans faire defiler la page, donc
   sans se voir.

### Et un voile n'est pas un fond

La section 6 bis de la charte a rendu 1,00:1 sur une rangee qui en tient 14,08. Elle mesurait une
encre sur `rgba(22,24,28,.05)`, le voile de survol a 5 %, en prenant le voile pour un aplat. Ces
paires sont desormais rangees dans les insolubles et NOMMEES une par une, avec la regle : une
paire posee sur un voile se mesure a la main contre la surface qui est dessous. Les deux du depot
l'ont ete.

### Les verdicts

`npm run verif` passe en entier, trente-sept etapes. `banc:poids` : **111,4 ko bloquants sur un
plafond de 120**, contre 108,2 avant le lot ; les 3,2 ko sont le branchement du bouton et la
retraction de l'en-tete, ecrits dans la page. La feuille de style ne compte pas dans ce budget,
qui ne pese que les scripts.

### Ce qui reste ouvert

Le contenu des pieces, qui est le lot suivant et qui, en sombre, pose encore de l'encre foncee
sur des cartes sombres. Les pastilles de compte du rail et les libelles sous les icones de la
barre basse, qui demandent tous deux de toucher a `PIECES` dans `bdv-nav.js`, donc au contenu.
Le squelette de chargement, faute d'un etat de chargement dans le balisage de la coque. Et
l'etat de synchronisation de l'en-tete, faute d'une source qui sache y repondre.

---

## 21/09/2026. Le bureau passe a deux themes : le socle, et rien que le socle

Les maquettes du bureau redessine sont validees, en deux themes, un clair et un sombre. **Ce
lot ne change RIEN a l'ecran.** Il pose le jeu de jetons et les garde-fous, avant qu'une seule
regle de dessin ne soit ecrite.

C'est l'ordre impose par `CLAUDE.md`, ecrit noir sur blanc le 18/09 a propos de tokens.css :
« on apprend d'abord au garde-fou a lire la nouvelle forme, on change la forme ensuite. Jamais
l'inverse. » Un jeu de cinquante jetons pose sans controle de parite, c'est cinquante occasions
d'oublier une valeur sombre, et un oubli de valeur sombre ne casse rien : ca peint du noir sur
du noir chez celui qui a ce reglage-la.

### La decision : deux themes pour le BUREAU, un seul pour le SITE

Le site public garde son identite papier, `--paper`, `--ink`, `--bordeaux`, l'angle vif et le
filet. Il n'a pas de theme sombre et n'en veut pas : ce serait changer la marque, pas le confort
de lecture. Le bureau, lui, n'est pas une page du site, c'est un poste de travail qu'on ouvre a
6 h dans un chai et a 23 h dans un bureau.

Consequence de rangement : la feuille `src/css/bdv-theme.css` n'est liee que par
`/mon-bureau/`, par un drapeau de front matter `theme_bureau` que seul ce gabarit porte.

### La regle du prefixe `--bdv-`, et les trois collisions qui l'ont decidee

Le renommage des cinquante jetons n'est pas une preference de nommage. Trois noms de la maquette
entraient en collision avec des jetons deja servis, et de la pire facon possible : **meme nom,
autre nature.**

| jeton | ce qu'il vaut deja | ce que la maquette en faisait |
|---|---|---|
| `--trait` | `1px` dans style.css ET bdv-ecrans.css | une COULEUR, `#E4E3DE` |
| `--trait-fort` | `2px` dans style.css | une COULEUR, `#CFCEC7` |
| `--r-rond` | `50%` dans style.css | `9999px` |

La feuille de theme etant chargee **apres** style.css, `border: var(--trait) solid`, ecrit
partout dans le site, serait devenu `border: #E4E3DE solid` : une bordure sans epaisseur, sur
toutes les pages que le bureau charge, **sans une seule erreur nulle part**.

C'est exactement le defaut `--ombre-photo` du 18/09, celui pour lequel `npm run banc:jetons` a
ete ecrit, et qui avait dormi dix jours. Le prefixe ne repare pas trois cas, il ferme la classe
entiere : aucun nom de cette feuille ne peut plus rencontrer un nom du site.

### Trois blocs, et deux d'entre eux n'ont pas que `:root`

    :root, [data-theme="light"]                      le clair, COMPLET, la seule source
    @media (prefers-color-scheme: dark)
      :root:not([data-theme="light"])                le reglage du telephone
    :root[data-theme="dark"], [data-theme="dark"]    le bouton

La forme **sans** `:root` des blocs 1 et 3 n'est pas decorative, et c'est le point qu'on
supprimerait le plus volontiers en relisant. Les proprietes personnalisees heritent : un
CONTENEUR qui les redeclare retourne tout son sous-arbre. Sans cette forme :

- pas moyen de montrer le clair et le sombre **cote a cote dans une meme capture**, donc pas
  moyen de juger les deux themes sur le meme ecran ;
- pas d'apercu d'impression clair au milieu d'une page sombre ;
- et un sous-arbre force en clair sous une racine sombre **heriterait des valeurs sombres**
  pour tout ce que `:root[...]` seul ne sait pas atteindre. Il s'afficherait a moitie retourne,
  sans erreur.

`color-scheme: var(--bdv-schema)` est pose sur `html` ET sur `[data-theme]`, pour la meme
raison en deux endroits : sans lui, la barre de defilement, les `<input type="date">`, les
`<select>`, les cases a cocher, le curseur de texte et la selection restent dans l'autre
famille. Ce sont des surfaces que le navigateur peint lui-meme et qu'aucune regle de CSS ne
rattrape.

### La cle de theme ne commence PAS par `bdv_`, et c'est mesure

Le reflexe etait `bdv_theme_v1`, parce que `CLAUDE.md` dit que ce prefixe est ce qui fait partir
une cle a la deconnexion et au changement de compte. Verification faite dans `bdv-compte.js` :
c'est vrai, et **c'est precisement pour ca qu'il ne faut pas le prendre ici.**
`viderLePoste()` balaie par prefixe toute cle `bdv_` de `localStorage` et de `sessionStorage`,
et `oublierCetAppareil()` l'appelle **sans liste `garder`** a la deconnexion.

Un choix de theme efface a chaque deconnexion, c'est un defaut, pas une protection : le vigneron
qui a choisi le sombre le reperd a chaque fois, et sur un telephone regle en clair il retrouve un
bureau blanc sans comprendre pourquoi. Un theme est un confort d'AFFICHAGE : il n'a rien a
reveler a la personne suivante, et aucune raison de partir avec la session.

La cle s'appelle donc **`bureau_theme_v1`**, sur le modele de `bureau_prenom` qui vit deja hors
du prefixe. Le commentaire du layout le dit en toutes lettres, parce que la prochaine main qui
passe voudra la « remettre en coherence » avec les autres.

Trois etats et pas deux : `"light"`, `"dark"`, et **la cle absente**, qui veut dire « comme mon
telephone » et qui est le defaut. Pas de `data-theme="auto"` ecrit en dur : ce serait un
troisieme cas a traiter dans chaque selecteur, alors que l'absence se traite toute seule par le
bloc `@media`.

### Pourquoi la feuille est LIEE et pas chargee a la demande

Les trois autres feuilles du bureau sont posees par `bdv-nav.js` au premier clic sur la piece
qui en a besoin. C'est le bon reglage pour elles : elles habillent une piece qu'on n'a pas
encore ouverte. **Un theme, lui, arrive toujours trop tard s'il arrive apres le premier
rendu** : la page se peint en clair, puis bascule en sombre sous les yeux du vigneron, et ce
clignotement n'a aucun correctif apres coup.

D'ou, en tete de `base.njk` et avant toute feuille, un script en ligne de mille octets qui ne
fait qu'une chose : lire le choix memorise et poser `data-theme` sur la racine. Il ne dessine
rien. Chaque acces au stockage est enveloppe, parce qu'il peut lever ou revenir vide, et la page
est correcte sans lui.

**Aucun bouton de bascule dans ce lot.** Il vient avec l'en-tete au lot suivant et se branchera
sur `BdvTheme.poser(choix)`, expose par ce script.

### Le controle de parite, et pourquoi il vaut plus que les cinquante jetons

`npm run banc:jetons` gagne une quatrieme section. Elle echoue si :

a. une **matiere** du bloc clair n'est pas retournee dans les **deux** blocs sombres, ou si une
   **echelle** l'est dans l'un d'eux ;
b. un jeton nait dans un bloc sombre sans exister en clair ;
c. les deux blocs sombres **divergent**, sur un nom ou sur une valeur.

**Le point (c) est celui qui compte, et c'est le defaut classique de tout produit a deux
themes** : on corrige une couleur dans le bloc `@media`, on oublie le bloc `[data-theme]`. La
couleur devient juste pour qui suit son telephone et fausse pour qui a clique sur le bouton.
Personne ne le voit, parce que les deux chemins menent au meme mot « sombre » et qu'on n'en
essaie qu'un.

**Le point (a) a du etre reecrit pour dire quelque chose de vrai.** La formulation evidente,
« tout jeton du clair se retrouve en sombre », est fausse : le bloc clair porte cinquante
jetons, les blocs sombres trente. Les vingt autres sont les ECHELLES, rayons, ecarts, tailles,
durees, courbe, et elles sont **identiques dans les deux themes par decision** : un theme change
des couleurs, il ne change ni le rythme ni la taille du texte. Un controle faux des son premier
jour se contourne au lieu de se lire.

La regle exacte est donc dans la VALEUR, jamais dans une liste de noms tenue a la main qui se
perimerait au premier jeton ajoute : une longueur, une duree ou une courbe est une echelle et ne
se retourne dans aucun bloc sombre ; tout le reste est une matiere et se retourne dans les deux.
Le controle attrape donc AUSSI le cas inverse, un theme qui se mettrait a changer le rythme.

**Verifie en remettant le defaut**, comme le veut la regle du depot :

| defaut remis | echecs |
|---|---|
| (a) une matiere retiree d'UN bloc sombre | **2** (le (a) et le (c), qui voit la divergence de nom) |
| (a) la meme retiree des DEUX blocs sombres | **1** |
| (a) une echelle retournee dans les deux blocs sombres | **1** |
| (b) un jeton ne naissant que dans les blocs sombres | **2**, un par bloc |
| (c) une couleur corrigee dans le seul bloc `@media` | **1** |
| le bloc du bouton entierement supprime | **1** |

### Ce que le garde-fou a fallu apprendre a lire, et les deux fautes qu'il faisait

`scripts/charte.mjs` ne connaissait qu'une ecriture de la racine, `:root` tout seul. Aucun des
trois blocs de la feuille de theme n'a cette forme, et le script faisait donc **deux fautes a la
fois, toutes les deux silencieuses** :

1. **il criait sur du sain.** La section 4 dispense `:root` de la regle « aucune couleur en
   dur ». Les deux blocs sombres n'etant pas `:root`, leurs trente couleurs auraient fait trente
   ECHEC sur une feuille parfaitement conforme. Un controle qui crie sur du sain finit par ne
   plus etre lu, c'est deja la lecon du 19/09 ;
2. **il sortait le jeu entier du perimetre.** Un selecteur qui n'est pas `:root` voit ses
   variables rangees en « declarees sur un composant, donc hors charte ». Les cinquante jetons
   du bureau seraient sortis du controle en silence, le jour meme ou on les pose.

Deux reconnaisseurs les separent maintenant, et la distinction n'est pas cosmetique :
`estRacineBase` reconnait la SOURCE a son `:root` **nu** dans la liste, `estRacineTheme`
reconnait un RETOURNEMENT a sa condition (`:root[...]`, `:root:not(...)`, `[data-theme...]`).
Seule la source sert de reference aux mesures de contraste de la section 6 : ranger les trois
blocs ensemble aurait fait mesurer le theme SOMBRE, puisqu'il est ecrit en dernier.

`banc-jetons.mjs` a recu la meme lecon a l'envers : sa recherche de `:root` accepte desormais
une liste de selecteurs, **mais toujours pas** `:root[...]` ni `:root:not(...)`. Sinon chaque
couleur du theme serait « servie avec deux valeurs differentes » et sa section 1 crierait trente
fois. Ce qui est servi par defaut, c'est le clair.

### tokens.css porte les deux valeurs, et la forme n'est pas un gout

La declaration porte la valeur CLAIRE, le commentaire a cote porte la valeur SOMBRE. Motif
mecanique : `banc:jetons` compare la declaration de la doctrine a ce qui est **servi**, et ce
qui est servi par defaut, c'est le clair. Mettre le sombre en declaration ferait mentir la
doctrine sur ce que le navigateur recoit. La forme lue par le banc n'a donc pas eu a changer, et
la parite des deux valeurs est gardee ailleurs, par la section 4.

### Ce que ce lot ne fait pas

- **Aucune regle de dessin, aucun bouton.** L'ecran est a l'octet ce qu'il etait ce matin.
- Les quarante-neuf jetons non encore appeles sortent en NOTE dans `npm run charte:bureau`
  (« tokens declares jamais appeles »). C'est exact et c'est voulu : ce lot est le socle, les
  regles qui les appellent viennent apres. La note doit disparaitre a mesure, pas etre
  excusee.

### La note d'environnement, et elle est pour Ted

**`npm run build` ne peut pas aboutir depuis la session, et ce n'est pas ce lot.** Le crochet
`eleventy.after` de `.eleventy.js` fait un `unlink` sur `_site/js/bdv-courrier.js` et
`_site/js/bdv-ics.js`, les deux fichiers qu'on ne publie pas, et le pont reseau qui monte le
depot **interdit la suppression de fichiers**. La construction echoue en EPERM apres avoir ecrit
toutes les pages. C'est la meme contrainte que celle deja documentee pour `.git/index.lock`.

Les trente-six autres etapes de `npm run verif` ont donc ete lancees **une par une**, sans
tuyau, et passent toutes a zero echec. `npm run verif` en entier reste a lancer par Ted, sur son
Mac, ou l'unlink est permis.

---

## 19/09/2026, la suite. Passer l'audit au vert

Ted, apres le rapport du matin : « tu vas travailler pour reduire les resultats de ton audit
aux feux verts partout. Tu reviens vers moi quand c'est termine. »

**La ligne que je me suis fixee, faute de pouvoir le lui demander** : je corrige tout ce qui est
un DEFAUT ou une REGLE DU PROJET NON TENUE (plancher tactile de 44 px, contraste de 4,5, une
ecriture qui doit rendre sa preuve, une zone qui doit savoir se cacher). Je ne touche pas a ce
qu'il a DECIDE (l'ordre des zones, le dessin du bandeau sur ordinateur, son echelle
typographique). Ce que lui seul peut faire, je le prepare.

Quatre commits, et `npm run verif` passe ses **37 etapes a zero echec** a la fin de chacun.

### La lecon de la journee, en une phrase

**Un correctif fait en deux moities par deux mains n'est pas un correctif.** Elle s'est
verifiee quatre fois, dans quatre formes differentes, et chaque fois le travail etait ecrit,
juste, et mort :

1. **Le joint jamais ecrit.** `bdv-base.js` posait 18 `data-libelle` sur les cellules des
   tableaux du panneau, `bdv-panneau.css` mettait le tableau en une colonne par ligne, et la
   regle `td::before{content:attr(data-libelle)}` qui relie les deux n'existait nulle part. Les
   deux fichiers se renvoyaient l'un a l'autre en commentaire. A l'ecran, une ligne du
   renommage donnait `Export` / `66` / `3` / `recurrente` / un champ, et personne ne pouvait
   savoir que 66 etait un nombre de lignes. **Un tableau qui ne deborde plus mais qu'on ne peut
   plus lire n'est pas un gain, c'est un echange.**
2. **Deux regles qui se battaient a 442 octets.** `align-items: flex-start` pour l'aplomb de la
   case a cocher, `align-items: center` pour sa cible de 44 px, meme specificite, la derniere
   ecrite gagnait. L'aplomb etait ecrit, et mort.
3. **Une regle posee au mauvais endroit de la cascade.** La requete telephone du champ
   « le nom de ton domaine » etait ecrite AVANT la regle de base, donc perdue a specificite
   egale. Elle a passe une capture entiere a ne rien faire.
4. **Un geste qui a deux chemins, un seul corrige.** `afficher()` avait recu son
   `marquerActif('reglages')`, pas l'ecouteur du bouton de la barre du bas. Et c'est le bouton
   que le vigneron touche.

Et la cinquieme, d'une autre nature : **le calage magnetique `scroll-snap` defaisait
`scrollIntoView`.** Le ruban visait juste, puis se reposait sur le point d'ancrage voisin. Les
deux correctifs de `marquerActif` etaient annules par une ligne de feuille de style. Entre un
glissement qui s'arrete joliment et une selection qui se voit, c'est la selection qui gagne.

**Rien de tout cela n'a ete trouve par un banc.** Les 37 etapes de `verif` etaient vertes a
chaque fois. Ce sont quatre campagnes de captures, regardees a l'oeil, qui les ont sorties.

### Ce qui est repare

**Robustesse.** Le garde-fou de la deconnexion appelle `filesEnAttente()` au lieu d'une liste de
trois noms ecrite a la main : les taches et les reperes de calendrier notes hors reseau etaient
perdus sans un mot. Un refus definitif (403, 401, « pas l'auteur ») ne retourne plus en file et
se dit : une tache cochee sur la ligne d'un collegue bloquait le changement de bureau **pour
toujours**, et rien dans l'interface n'en sortait. La file des signets a enfin un proprietaire.
Le jeton de session se renouvelle toutes les demi-heures. Une session morte ferme au lieu de
laisser un bureau qui a l'air connecte. La deconnexion vide aussi la memoire d'onglet : un
brouillon de fiche client passait d'une personne a l'autre sur un poste partage. Le sous-main
dit quand il montre l'etat de la derniere visite. « Vider la base » refuse de s'ouvrir plutot
que d'annoncer « 0 ligne » sur un compte qui en porte des milliers. Le panneau sort de son
attente au bout de 15 s avec un bouton « Reessayer ». Sans reglages lus, les ecrans disent que
les chiffres sont devines.

**Accessibilite, jamais regardee jusqu'ici.** Filtres de periode et lignes de tableau client
atteignables au clavier. Quatorze champs recoivent une etiquette. La fiche client piege le
focus. Le champ de trace d'appel retrouve un cerclage. Le seul saut de niveau de titre est
corrige.

**Telephone.** `bdv-panneau.css` recoit son premier bloc telephone : 44 px de cible partout,
16 px de saisie pour qu'iOS cesse de zoomer, et le tableau du classement tient dans 390 px avec
ses libelles. Les six onglets tiennent sur une rangee qui defile au lieu de trois : **132 px
rendus au contenu**, l'en-tete du panneau passe de 224 a 136 px. La barre du bas defile a 48 px
par cellule au lieu de 43, et la pièce active s'y ramene.

**Poids.** 415 ko de commentaires ne partent plus dans le navigateur, 60 ko ne sont plus publies
pour personne. Le bloquant tombe de **143 a 107 ko**, et `banc-poids` le tient sous 120.

**ZERO EST UN TROISIEME ETAT, ET MAINTENANT IL L'EST PARTOUT.** Le signe et la couleur d'une
variation etaient decides par `>= 0` a **quatorze endroits** ecrits a quatorze moments. D'ou
« +0 % » en vert, « -0 EUR » en rouge, « Croissance saine : +0 EUR », et « Tu gagnes plus que tu
ne perds : 0 EUR contre 0 EUR ». Corriger un endroit n'en corrigeait pas treize, et on l'a
verifie deux fois dans la journee avant de comprendre. `signeDe()`, `couleurDelta()` et
`fmtDelta()` sont desormais le seul endroit ou l'on decide.

**L'agenda.** `choixDuCompte()` demandait `calendrier_choix?id=...`, colonne disparue au lot 17 :
tous les reperes eteints ou decales par le vigneron etaient ignores **en silence** dans son
flux. Elle passe par le bureau courant, et une lecture ratee rend 503 au lieu de servir le
calendrier complet.

### Les garde-fous savent maintenant attraper tout ca

Le decor des deux harnais de capture vit dans `scripts/bureau-garni.mjs` : les deux ecrivaient
`bdv_file_v1` et `bdv_taches_v1` dans une forme que le code ne sait pas relire, et
photographiaient donc **un bureau vide** sans le savoir. Tout l'audit d'occupation du 18/09 a
ete fait la-dessus. `verifierLeBureauGarni()` leve desormais si le bureau photographie est
vide.

`scripts/charte.mjs` gagne trois sections, chacune prouvee en remettant le defaut :
**echelles fermees** (valeurs distinctes par famille, ce qui attrape enfin les `z-index` en dur,
les tailles, les ombres et les `50%`), **accessibilite de la page construite** (six controles qui
lisent le HTML et le JavaScript ensemble), **ce qui voyage et ce qui ne sert a rien** (octets de
regles mortes, de composants non inclus, et de style public qui voyage dans le bureau). Les
bornes B2, B6 et C1 sont a **zero ou a la mesure du jour**, et elles ne remontent jamais.
`scripts/banc-poids.mjs` est nouveau. Trois controles qui ne pouvaient pas echouer sont repares.
Et la charte ne compte plus un jeton cite dans un **commentaire** comme un appel : elle
declarait le site NON CONFORME pour `--ombre-photo`, retire la veille, sur la foi d'une phrase.

### Ce que je n'ai PAS touche, et pourquoi

**Deux reparations ont ete essayees puis annulees**, parce que les deux touchaient une decision
de Ted, gardee par un banc :
- une dixieme zone d'accueil en tete casse l'ordre des zones dicte le 07/09, garde par
  `banc-bureau` ;
- montrer le sous-main sans depot casse « sans aucun depot, le sous-main n'est pas la », garde
  deux fois par `banc-journee`.
Le defaut reste donc ouvert, et il est reel : **sur un compte neuf, plus rien n'invite a deposer
un export.** Les quatre zones qui en dependent se cachent toutes ensemble, et la seule phrase
qui invitait au geste vit DANS l'une d'elles, donc elle ne peut jamais se lire. C'est a Ted de
trancher, et la raison est ecrite dans `sousMainUtile()`.

Non touche aussi : le bandeau qui prend **62 % de l'ecran sur telephone** (522 px sur 844 ; la
decision du 18/09 au soir portait sur l'ordinateur, la question du telephone n'a jamais ete
posee), l'echelle typographique (**68 a 78 % du texte du bureau sous 12 px**), la gouttiere a
0 px des ecrans de vente contre 10 px des pieces de bureau (arbitrage ecrit du 15/09), et la
scission de `style.css`, dont 57 ko ne servent qu'au site public et voyagent quand meme.

---

## 19/09/2026. Audit complet de l'application, UX et systeme

Ted : « tu vas auditer entierement l'application. UX et system. Tu vas deployer tous les agents
necessaires. » Perimetre retenu avec lui : **le bureau connecte et la base Supabase**. Methode
imposee : **captures reelles**, pas lecture de code. Livrable : rapport, et correction immediate
de ce qui ne demande aucun arbitrage.

Six audits menes en parallele : UX grand ecran (1440x900), UX telephone (390 et 360 px),
architecture et dette, securite et schema Supabase, robustesse et etats d'erreur, charte et
accessibilite. Environ 150 constats, dont les 16 ci-dessous corriges le jour meme.

### Ce que l'audit a trouve de plus grave, et qui ne se voyait dans aucun banc

**1. L'abonnement agenda ne s'ecrivait jamais, et la revocation ne revoquait rien.**
`bdv-reglages.js` appelait `BdvCompte.api()` avec `method:` et `body:`. La fonction attend
`methode:` et `corps:`. Les deux mots inconnus etaient ignores : l'appel partait en simple
lecture, reussissait, et l'ecran affichait « Lien cree » sur une base ou rien n'avait ete ecrit.
Meme chose pour « Lien revoque. L'ancienne adresse ne rend plus rien » : l'ancienne adresse
continuait de servir le calendrier, pour toujours.
**C'est la troisieme fois que ce projet se fait avoir par une ecriture qui reussit sans ecrire**
(les signets restes vides, la colonne manquante du courrier, celle-ci). Les deux premieres
venaient d'un champ oublie ; celle-ci d'un nom de champ anglais dans une fonction francaise.
La lecon commune : **une ecriture qui ne rend pas la preuve de ce qu'elle a ecrit n'est pas une
ecriture, c'est une esperance.**

**2. Le garde-fou de la deconnexion ne comptait que trois files d'attente sur cinq.**
`ecrituresEnAttente()` nommait `bdv_crm_attente`, `bdv_signets_attente` et `bdv_profil_attente`
a la main. Les taches cochees hors reseau (`bdv_taches_attente`) et les reperes de calendrier
decales (`bdv_calchoix_attente`) n'etaient pas comptes. Or la deconnexion EFFACE le navigateur :
le vigneron lisait « rien en attente », partait, et perdait ce qu'il avait note dans la vigne.
**Le meme garde-fou existait deja, juste, vingt fichiers plus loin** : `BdvCompte.filesEnAttente()`
balaie toutes les cles `bdv_*_attente` et protege le changement de bureau. Deux gardes pour le
meme danger, et le bon protegeait le geste le moins grave. La liste ecrite a la main est
supprimee, le panneau appelle desormais la fonction qui balaie.

**3. Le classement des colonnes partait sans que personne ne regarde s'il arrivait.**
`syncUneColonne()` dans `bdv-base.js` avalait l'echec par un `.catch(function(){})` vide, et
l'ecran affichait juste apres « Reglages enregistres. Toute la base a ete reclassee. » Sur le
reglage qui decide de ce que le serveur compte comme une vente. Ecran vert, compte inchange, et
sur le deuxieme appareil le classement d'avant. Le modele a suivre etait dans le meme fichier,
vingt lignes plus haut : `syncSuivi()` le dit.

**4. « Mes cuvees » affichait le chiffre en 10 px et le mot en 26 px.**
Quatre appels a `kpiCard(libelle, valeur, note)` passaient leurs deux premiers arguments dans le
mauvais ordre. « 61 765 EUR » etait ecrit en etiquette et « chiffre d'affaires » en gros. Vu par
les deux audits UX, sur grand ecran comme sur telephone.

**5. Trois ecrans rendaient un verdict positif sur zero.**
« Tu gagnes plus que tu ne perds : **0 EUR contre 0 EUR** », suivi de « Ta croissance est
reelle » ; « **-0 EUR** » affiche deux fois en rouge dans le meme tableau ; « **+0 %** » en vert
dans l'ardoise de « Mon cap » et « Croissance saine : +0 EUR ».
Trois formes du meme defaut : **le signe et la couleur etaient decides par la nature de la
ligne, jamais par la valeur.** Zero est un troisieme etat, ni vert ni rouge, sans signe.

**6. « Mes cuvees » disait « Aucune vente en base » alors que la base en portait 286.**
L'ecran ne distinguait pas « rien a montrer » de « rien encore lu ». C'est le defaut du 18/09,
corrige sur « Mon commerce » et laisse ici. `lignesPretes()` existait deja pour ca.

### Les autres correctifs de la passe

- `parseDateFR()` verifiait l'annee et le mois, jamais le jour : `32/01/2026` etait accepte,
  affiche tel quel, et compte comme le 1er fevrier par les calculs d'intervalle.
- `lot28-vider-sans-doute.sql` etait absent de la liste `ORDRE` de `banc-rejeu.mjs`. Une base
  reconstruite depuis le depot aurait donc recu **l'ancien bouton « Vider la base »**, celui qui
  ne rend aucune preuve, c'est-a-dire l'incident du 18/09 remis en place par la procedure censee
  le garder.
- Deux barreaux de l'echelle des couches etaient ecrits en dur a cote de leur jeton
  (`z-index:400` alors que `--z-modale` existe, `z-index:100` alors que `--z-nav` existe).
- `bdv-canaux.js` etait le seul script du bureau sans `defer`, alors que son unique lecteur,
  `bdv-crm.js`, est lui-meme en `defer` et s'execute apres lui de toute facon.
- Deux renvois pointaient vers des endroits disparus : « Mon exercice » (la piece s'appelle
  « Mon cap » depuis le 11/09) et « l'onglet Colonnes » (il s'appelle « Le classement »).

### Ce que l'audit a trouve de bon, et qu'il ne faut pas casser

Les 15 tables Supabase ont **toutes** la protection par ligne activee, sans exception. Aucune
fuite de donnees de vignerons vers l'exterieur. Le jeton des invitations n'est pas lisible par
les comptes connectes. Aucune cle de service dans le depot. Sur 821 fonctions passees au crible
du depot entier, **cinq seulement** sont mortes : ce projet ne traine pas de cadavre. Et l'ecart
entre `tokens.css` et ce que le navigateur recoit est **a zero** sur les 120 jetons : le banc
ajoute le 18/09 a ferme la derive pour de bon.

### Ce qui reste, et qui demande un arbitrage

Le detail complet est dans les six rapports d'audit. Les points qui attendent une decision :
le bandeau qui prend **62 % de l'ecran sur telephone** (522 px sur 844, jamais mesure la : la
decision du 18/09 au soir portait sur l'ordinateur) ; la **barre du bas passee a 43 px** par
cellule depuis l'arrivee de la neuvieme piece, alors que le commentaire du code parle encore de
huit cellules a 45 px ; le **panneau de reglages sans aucune regle telephone** (cases a cocher a
15 px, champs a 14 px qui font zoomer iOS) ; **68 a 78 % du texte du bureau sous 12 px** ; et la
scission de `style.css`, dont 75 ko ne servent qu'au site public et voyagent quand meme.

Cote base : un **bureau d'essai sans membre** porte 160 ventes fictives en production et plus
personne ne peut y entrer ; `ventes_lignes` occupe **118 Mo pour 3 Mo de donnees** apres le grand
effacement ; et la **protection contre les mots de passe deja voles est eteinte** dans les
reglages Supabase, ce qui est un clic.

---

## 18/09/2026, le soir. L'occupation de l'espace du bureau

Ted, deux captures de HubSpot a l'appui, son pipeline et sa liste de contacts : « je veux la
meme occupation de l'espace pour le BVD », puis « tu vas vraiment faire comme HubSpot, y'a pas
des grosses marges comme ici. C'est relativement optimise au niveau de la place. Et ca reste
joli. »

### Sa premiere hypothese etait fausse, et c'est la mesure qui l'a dit

Il a repondu « la largeur : trop de blanc sur les cotes ». **Il n'y en a pas.** Releve dans son
navigateur : son ecran fait **1440 x 900**. L'atelier est plafonne a 1440 + la barre, donc sur
cet ecran-la le plafond ne mord pas, et le blanc lateral fait **24 px de chaque cote, 3 % de la
largeur**. Elargir n'aurait rien rendu du tout.

Ce qu'il voyait comme du blanc etait ailleurs, et en hauteur :

| | avant | apres |
|---|---|---|
| entete du site | 59 px | 59 px |
| bandeau du bureau | **209 px** | **71 px** |
| avant la premiere chose utile | **268 px, 30 % de l'ecran** | **130 px** |
| barre des pieces | 230 px | 200 px |
| colonne de travail | 1138 px | 1176 px |
| hauteur de « Ma journee » | 1919 px | 1670 px |

**La comparaison avec HubSpot ne portait pas sur la largeur.** HubSpot depense a peu pres autant
de hauteur d'entete, mais il la depense en barre de recherche, onglets, filtres et en-tetes de
colonnes : tout y est actionnable. Les 209 px du bandeau portaient une date, un salut, la lune,
et deux boutons.

### Ce qui a ete fait, en trois lots

1. **Le bandeau.** La pile de quatre paragraphes devient une rangee (`.bureau-tete__salut`), les
   deux actions passent en rangee, la lune tient sur une ligne et son disque descend de 38 a
   28 px. **Rien n'a ete retire** : le salut, la plaque, le resume, la lune et les deux boutons
   sont le dessin decide le 08/09, il tient. Ce qui portait la hauteur etait le `h1` en
   `--t-h1`, un clamp plafonne a 3,2 rem, soit **51 px** des 1024 px de large. Un salut n'est pas
   le titre d'un article : il prend `--t-h3`.
2. **L'air.** Retraits de l'atelier 32/48 vers 16/32, ecart de la grille 24 vers 16, retraits
   d'une zone 16/24/24 vers 10/16/16. **Aucune taille de texte n'a bouge** : ce qui a ete retire
   est du vide, pas de la lisibilite.
3. **La barre des pieces**, 230 vers 200 px. « Le calendrier », le plus long des neuf libelles,
   tient dedans avec son icone. Les 30 px vont au travail.

### Le banc qui l'a mesure, et qui manquait

`scripts/banc-large.mjs`, monte sur le modele de `capture-telephone.mjs` mais a **1440 x 900**,
l'ecran de Ted. Il ne compte ni les cibles ni les debordements : il mesure **l'occupation**, et
il calcule le blanc sur le contenu qui PORTE quelque chose, un fond, une bordure ou du texte,
jamais sur les boites vides qui s'etendent sans rien montrer.

Deux pieges payes en l'ecrivant, tous deux ecrits dans son en-tete : la modale « On raccorde ton
bureau » couvre le bureau hors ligne et fait rendre a toutes les pieces la meme hauteur, celle de
la page bloquee ; et les lignes de vente ne se chargent pas dans ce montage, donc **la mise en
page des pieces de vente n'est pas mesurable ici**. C'est une limite a dire, pas un defaut a
corriger.

### Ce qui a ete verifie

`charte`, `charte:bureau`, `banc`, `banc:journee`, `banc:taches`, `banc:app`, `banc:outils`,
`banc:jetons`, `banc:reglages` : tous verts. Et le telephone recapture a 390 px : **390/390 sur
les sept pieces, zero debordement**, le bandeau se replie comme avant et la barre reste en bas.
Le point de rupture 980 px n'a pas ete touche.

**`npm run verif` ne peut pas s'executer a travers le pont reseau** : le `npm run build` de tete
echoue sur `EPERM: operation not permitted, unlink '_site/manifest.webmanifest'`, la suppression
etant interdite sur ce montage. La chaine s'arrete donc au premier pas et ne controle rien. C'est
le comportement voulu, un controle qui ne peut pas s'executer doit crier ; les bancs ont ete
lances un par un a la place. **A relancer par Ted sur son Mac avant de pousser.**

### Deuxieme passe, le meme soir : les marges de HubSpot a la lettre

Ted : « tu vas faire ce que je te dis. Reprends la capture de HubSpot, tu vas faire pareil en
terme de marge. » Mesure faite sur sa capture, ou sa fenetre fait 1999 px de large :

| | HubSpot | en proportion | applique a 1440 px |
|---|---|---|---|
| barre laterale | 183 px | 9,2 % | 132 px |
| retrait exterieur, gauche et droite | 0 | 0 | **0** |
| ecart barre / contenu | 0 | 0 | **0** |
| retrait INTERIEUR du contenu | 34 px | 1,7 % | **24 px** |

Le plafond de largeur de l'atelier est **supprime** : HubSpot n'en a pas, son panneau va d'un
bord a l'autre. Resultat : colonne de travail **1284 px** contre 1138 avant la journee.

**Un seul ecart, et il est mesure, pas choisi : la barre fait 156 px et non 132.** Releve
languette par languette sur la page : « Le calendrier » demande 142 px de contenu, plus
l'encoche de l'intercalaire, soit 154. A 132, QUATRE libelles sur neuf sont coupes au bord de
la colonne, et descendre la police d'un cran de plus ne suffit pas (131 px, toujours coupe).
Les libelles de HubSpot tiennent dans 132 px parce qu'ils sont ecrits en police
proportionnelle ; ceux d'ici sont en chasse fixe, qui est le dessin du bureau. **156 px est la
premiere largeur ou les neuf tiennent.** Le libelle passe au passage a `--t-mini` et porte
`white-space: nowrap`, pour qu'un futur nom trop long DEBORDE au lieu de passer sur deux
lignes : sur deux lignes, la hauteur fixe de la languette saute, et avec elle l'encoche, qui
est dessinee par deux triangles de bordure valant chacun la moitie de cette hauteur.

Verifie : `npm run verif` en entier, code 0. Telephone recapture, 390/390 sur les sept pieces.
Sous 900 px le panneau de travail rend son retrait interieur a l'atelier, qui reprend le sien.

### Troisieme passe : un post-it a une largeur, et c'est un jeton

Ted : « on va juste remanier ce panneau, qui fait du coup des post-it trop large. Tu vas
definir une largeur de post-it max coherente et l'appliquer partout. »

**La cause tient en un mot de CSS.** Le panneau etait en
`repeat(auto-fit, minmax(160px, 1fr))` : `auto-fit` effondre les pistes vides et donne au
dernier papier toute la place restante. Tant que le bureau etait plafonne, ca ne se voyait
pas ; depuis qu'il va d'un bord a l'autre, UNE punaise seule s'etalait sur 1 168 px.

**`--postit-l: 190px`**, declare dans `tokens.css` ET dans le `:root` servi, la borne haute
de la piste. **190 est une mesure, pas un gout : c'est la plus grande valeur qui garde la
regle du 10/09/2026**, cinq punaises sur UNE rangee a 1280 px de fenetre. Le panneau y offre
1 008 px, cinq papiers de 190 avec leurs ecarts en demandent 992 ; a 200 ils en demandent
1 042, la grille retombe a quatre colonnes et la cinquieme punaise part seule, exactement le
defaut que la regle interdit. Verifie a 1440, 1280 et 1180 : une rangee. A 1024 : deux, et
la regle ne promet rien en dessous de 1280.

`justify-content: start` range les papiers a gauche : **un liege a le droit d'avoir de la
place libre, c'est meme sa fonction, alors qu'un papier etire n'est plus un papier.**

**Un piege de mesure paye ici, et il vaut pour tout ce panneau : l'arrivee est ANIMEE.**
`bdv-punaise-pose` dure 0,34 s en `backwards` ; mesurer les punaises tout de suite rend cinq
hauteurs differentes et fait conclure a plusieurs rangees alors qu'il n'y en a qu'une. Il
faut attendre la fin de l'animation avant de compter.

Le panneau de la page d'accueil n'est pas touche : ses papiers y font deja 146 a 148 px,
sous la borne.

### ET LE BANDEAU EST REVENU COMME AVANT. C'est Ted qui tranche, pas la mesure.

« C'etait mieux avant au debut de la demande. » Le bandeau est donc **restaure a l'octet dans
son dessin du 08/09/2026** : la pile date / salut / plaque / resume, le `h1` en `--t-h1`, les
deux actions empilees a droite, la lune sur trois lignes, les retraits de 48 et 32 px.

**Ce qui reste, et qu'il ne faut pas defaire en croyant finir le retour arriere :** les marges
de l'atelier, la barre a 156 px et `--postit-l`. Ted les a validees dans le meme fil.

**La lecon n'est pas « le resserrage etait faux », c'est que les trois versions ont ete jugees
sur une image ou le bandeau etait VIDE.** Voir la passe ci-dessous. Une mesure de hauteur ne
tranche pas un dessin : elle dit ce que ca coute, Ted dit ce que ca vaut.

Les deux passes ci-dessous sont donc **annulees**, et gardees parce qu'elles disent pourquoi.

### Quatrieme passe : le bandeau en deux lignes, parce qu'une file de huit ne se lit pas

Ted, capture de son VRAI bureau : « c'est tres moche la haut, c'est un foutoir pas possible. »
Il avait raison, et le defaut etait de la premiere passe du soir.

**Ce que le banc ne montrait pas.** Hors ligne, le profil n'arrive jamais : le banc
photographiait « Te voila chez toi. », sans prenom, sans plaque, avec un resume d'une ligne,
c'est-a-dire le bandeau le plus VIDE possible. Sur la page de Ted il y a un prenom, un
domaine, un metier et un resume a deux chiffres : **huit fragments a la file, tous de meme
poids**. Le banc pose desormais ces textes a la main avant de photographier, et c'est une
regle generale : **un harnais qui ne montre que l'etat vide valide une mise en page que
personne ne verra.** Quatrieme fois que le depot paie un jeu d'essai plus sage que la realite.

**Deux lignes, et une hierarchie.** Ligne 1, ce qui presse : le salut et le resume du jour.
Ligne 2, ce qui situe, en petites capitales : le jour et la plaque. La lune passe elle aussi
sur deux lignes, son nom au-dessus de ses deux precisions. Le bandeau se lit en deux regards
au lieu de huit, et il fait 67 px au lieu de 71.

Le wrapper `.bureau-tete__meta` porte la deuxieme ligne. Les deux identifiants n'ont pas
bouge : `peindreIdentite()` les prend par `getElementById`.

Deux details qui ne se voient qu'a l'image : le point de separation est pose par un
`::before` sur la plaque et **pas ecrit dans le texte**, parce que la plaque est absente tant
qu'aucun domaine n'est donne et qu'un point orphelin derriere une date se lit comme une
coquille ; et l'ecart de cette ligne est `--e-xs` et non `--e-s`, parce que la date porte
`--ls-large`, dont l'interlettre s'ajoute APRES la derniere lettre et poussait le point deux
fois plus loin du mot de gauche que du mot de droite.

**Signale, non corrige : le nom du bureau est ecrit DEUX FOIS a l'ecran**, dans la plaque
(« SOLUCORP · VIGNERON ») et au-dessus de la barre des pieces (« SOLUCORP »).

### Signale et non corrige

- **Le panneau de liege fait 1140 x 180 px pour porter un seul post-it.** C'est la plus grande
  surface du bureau et la moins remplie. Ce n'est pas un probleme de retraits, c'est le dessin du
  liege : a rouvrir avec Ted, pas a trancher seul.
- **La lune dit deux fois la meme chose** : « PREMIER QUARTIER » puis « Premier quartier
  aujourd'hui ». Mis sur une rangee, le doublon se voit.
- La colonne de la barre laisse un grand vide sous la neuvieme languette sur les pieces courtes.

---

## 18/09/2026, la nuit. Vider sa base ne peut plus mentir

Ted, après avoir mélangé deux bases : « ok termine le job, l'erreur n'est plus possible. Il
faut qu'à la suppression, on dit explicitement : attention tu vas perdre TOUT ce que t'as
fait dans le bureau du vigneron, c'est pas remonté dans Vitisoft. Et que ça soit réellement
supprimé. Quand on revient sur le bureau, y'aura pas de doute. Et surtout quand je veux
remettre une nouvelle base, qu'on ne me montre pas un réglage pas utilisable. »

### La mesure, et ma septième erreur de la journée

J'avais annoncé que le vidage serveur expirait, à cause du déclencheur par ligne sur 171 569
lignes. **Faux.** Monté sur un Postgres 16 local avec les 171 569 lignes et le même
déclencheur : le `DELETE` prend **1 377 ms**. Il n'a jamais expiré.

Je ne sais toujours pas pourquoi le vidage n'a pas eu lieu chez Ted, et je ne le saurai
probablement jamais : l'erreur a été avalée au moment où elle s'est produite.

**Et c'est exactement le point.** La correction ne doit pas dépendre du diagnostic. Trois
pièces se tenaient la main :

1. `vider_la_base_du_bureau` rendait `void`. Rien à vérifier.
2. `effacerTout()` avalait toute exception et rendait `false`.
3. `viderBase()` ne regardait pas ce retour et vidait le local quand même.

Chacune prise seule est un petit relâchement. Les trois ensemble font **un bouton qui efface
ce que le vigneron voit et laisse ce qu'il ne voit pas.**

### Ce qui change

**Le serveur rend une preuve.** Lot 28 : la fonction rend `{vide, ventes, lignes, suivi,
echanges, reste}`, nettoie explicitement `ventes_lignes` et `resumes` au lieu de compter sur
les déclencheurs, **relit ce qui reste et lève si ce n'est pas zéro**. Une fonction qui ne
rend rien ne peut pas être vérifiée, et celle-là le pouvait d'autant moins qu'elle est
`security definer` : elle lève sur un non-maître, et une exception avalée ressemble à un
succès.

**Le navigateur exige cette preuve.** `effacerTout()` rend l'objet du serveur ou `null`, et
`null` veut dire « le compte n'a pas été vidé », jamais « peut-être ». `viderBase()` demande
la preuve, **s'arrête sans elle**, et ne touche au local qu'après. Un vidage serveur raté
laisse maintenant le bureau exactement comme il était, avec un message qui le dit et qui
prévient : ne réimporte pas, les deux bases se mélangeraient.

**Le texte nomme ce qui part.** « Cette action est définitive » ne dit rien à personne. Ce
qui parle, c'est la liste avec ses chiffres, et la phrase que Ted a demandée :

> ATTENTION. Tu vas perdre TOUT ce que tu as fait dans Le Bureau du Vigneron :
>   176 779 ligne(s) de vente, 3 fiche(s) de suivi client, 2 échange(s) enregistré(s)
> RIEN DE TOUT ÇA N'EST REMONTÉ DANS VITISOFT. Tes notes de suivi, tes échanges et ton
> classement n'existent que dans le bureau : une fois effacés, ils ne se récupèrent nulle
> part.
> L'effacement porte sur cet appareil ET sur ton compte, donc aussi pour les autres
> personnes de ton bureau.

**Pas de doute au retour.** `LIGNES_EN_BASE`, `LIGNES_DISTANTES` et `_lignesChargees`
repassent à zéro après un vidage réussi. Sans ça, `baseVide()` relisait des valeurs d'avant
et le bureau hésitait entre « vide » et « pas encore chargée » sur une base qu'on venait de
vider en connaissance de cause.

**Et plus de réglage inutilisable.** Après un vidage, `openApp()` ouvre le panneau parce que
la base est vide, et Ted tombait sur « Le classement » : deux sélecteurs qui proposent de
désigner une colonne parmi celles de ses lignes, sans lignes. On lui demandait de régler ce
qu'il n'a pas encore. `gateBaseVide()` écarte cet onglet tant qu'il n'y a rien à classer et
ouvre sur « Ma base », là où se dépose l'export.

Détail qui compte : la marque est `data-off-vide`, distincte du `data-off` de `gateVitisoft`.
Deux gardes qui écrivent le même attribut finissent par se défaire l'une l'autre.

### Le banc, et il m'a repris aussi

`npm run banc:vidage`, 25 contrôles. Il lit le code plutôt que de le recopier, et il **fait
tourner `effacerTout()` sur les quatre réponses possibles d'un serveur** : `{vide:true}`,
`{vide:false}`, `null`, et une exception. Les trois dernières doivent rendre `null` et ne pas
oublier le repère.

Étalonné : **16 échecs sur la version d'avant**, zéro sur celle-ci.

Il m'a repris une fois au passage : sa première version cherchait la liste de ce qui part
dans le seul `confirm(...)`, alors qu'elle est assemblée quelques lignes au-dessus parce
qu'elle porte des chiffres. Il criait sur un texte parfaitement correct. **Un banc qui
regarde au mauvais endroit accuse le code.**

### Ce qui reste

- Le `cluster` n'est toujours pas durable, et il faudra le refaire après le réimport.
- `bdv-reglages.js:822` compte toujours `/ventes` sans filtre de bureau.
- Les autres blocs qui rendent un verdict sans avoir lu la base n'ont pas été passés en revue.

---

## 18/09/2026, tard dans la nuit. Le bouton lent, et un cache qu'on jetait à chaque ouverture

Ted, après le correctif SQL : « en première vue, il affiche quand même personne à relancer,
comme si y'avait rien. mais ça se transforme rapidement avec la bonne base. Le plus lent est
quand je clique sur le nouveau bouton charger les données manquantes. »

Nouveau HAR. Les trois résumés répondent **200** maintenant : `cap` 1 176 ms, `commerce`
3 122 ms, `cuvees` 7 951 ms. La porte s'ouvre. Mais trois choses restaient.

### 1. Sept secondes pour apprendre ce qu'on savait déjà

Le bouton « charger les données manquantes » coûte environ 50 secondes, et la première n'est
pas du rapatriement :

```
t+31,6s  [206]  7 692 ms   GET /ventes?select=empreinte&bureau=eq.…
t+39,3s → t+82,6s          les 173 pages, 41,8 s
```

Ces 7,7 secondes sont `compterVentes()`, appelé par `tirerVentes()` avant la boucle :

```js
if(typeof dejaLa === 'number' && dejaLa >= 0){
  const distant = await compterVentes();
  if(distant != null && distant === dejaLa){ return []; }
}
```

C'est un `count=exact` PostgREST, donc un `count(*)` sur les 171 569 lignes. Il sert à
constater que les deux côtés portent le même nombre de lignes et à rentrer sans rien tirer.
**Quand le miroir est vide, il ne peut rien éviter : on va tout tirer de toute façon.**

Corrigé, et le banc m'a repris au passage. Ma première version faisait `dejaLa > 0` et sautait
le cas « les deux sont vides », que `banc-sync.mjs` protège explicitement (« compte vide et
appareil vide : rien à faire, et rien de fait »). La bonne forme garde la garantie et change
le prix : `auMoinsUneVente()`, `limit=1`, une centaine de millisecondes au lieu de 7 692.

Et le banc a été amendé pour dire ce qu'il veut vraiment dire : ce qui doit rester à zéro,
c'est le nombre de **pages** tirées, pas le nombre de requêtes. Une sonde à 100 ms n'est pas
un rapatriement. Il vérifie maintenant les deux : aucune page, et la question a coûté une
sonde et pas un comptage.

### 2. Le cache était jeté à chaque ouverture qui charge la base

Un seul résumé sur trois était en cache après la session : `cuvees`. Pourtant les trois
avaient été calculés et rangés.

La chronologie du HAR le dit :

| | |
|---|---|
| t+9,7 s | `commerce` calculé, 3 122 ms, rangé |
| t+18,2 s | `cap` calculé, 1 176 ms, rangé |
| t+108,7 s | `POST /reglages` : le dépôt pour le bureau écrit `file_travail`, `resume_ventes`, `depose_le` |
| | **les trois résumés sont effacés** |
| t+177,5 s | `cuvees` calculé, 7 951 ms, rangé. Seul survivant. |

Le déclencheur `resumes_perimer_reg` partait sur **tout** `update` de `reglages`. Or
`deposerPourLeBureau()` écrit ces trois colonnes après chaque chargement des lignes, et aucun
résumé n'en dépend.

**Charger ses lignes détruisait donc le cache serveur, systématiquement.** Les deux gestes
que le vigneron enchaîne naturellement, charger puis regarder, se sabotaient l'un l'autre.

Ce qui compte vraiment : `classement`, dont `v_ventes` tire le canal et la typologie, donc
« Mon commerce » et « Mes cuvées » ; `objectif` et `exercice_debut`, que lit `cap_resume`.
Rien d'autre.

Corrigé par une double garde, testée sur un Postgres 16 local : `update of classement,
objectif, exercice_debut` sur le déclencheur filtre les colonnes citées, et une comparaison
`is not distinct from` dans la fonction filtre les valeurs réellement changées. Une
réécriture à l'identique ne périme plus rien non plus.

### 3. Le verdict sur une base qu'on n'a pas lue

« Personne à relancer. Aucun client ne recule, ne rompt son rythme ni ne reste sans suite.
Profites-en. » Affiché sur zéro ligne lue.

C'est pire qu'un écran vide : un vigneron qui lit ça et referme son bureau repart rassuré à
tort. Le bloc voisin faisait déjà la différence (« Décomposition indisponible. Il faut deux
années comparables »). Celui-ci la fait maintenant aussi : le verdict n'est rendu que si
`lignesPretes()`, sinon il dit que la liste n'est pas encore établie.

### Ce qui reste

- Le CLUSTER n'est toujours pas durable. Paginer sur `maj_le` reste la vraie correction.
- Les 173 pages à 42 s : c'est maintenant le seul gros poste du bouton. Le réglage « Max
  rows » du projet Supabase les ramènerait à 18 requêtes.
- `bdv-reglages.js:822` compte toujours `/ventes` sans filtre de bureau.
- Chercher les autres blocs qui rendent un verdict sans avoir lu : celui-ci a été trouvé
  parce que Ted l'a vu, pas parce qu'un banc l'a dit.

---

## 18/09/2026, la nuit. « Étonnant » : le cache des résumés n'a jamais fonctionné

Ted a renvoyé un HAR après le correctif du miroir vide, avec un mot : « étonnant ». L'écran
« Mon commerce » s'ouvre bien maintenant, il n'ouvre plus les réglages tout seul. Mais il
affiche **0 lignes** et deux blocs qui disent des choses fausses avec assurance :
« Personne à relancer. Aucun client ne recule. »

Deux requêtes échouent dans ce HAR, et elles expliquent tout.

### 1. `42702 column reference "cle" is ambiguous` — et c'est le pire de la journée

`POST /rpc/resume` rend **400** pour les trois clés. Pas seulement `commerce` : le HAR
précédent montre les mêmes 400 sur `cap` et `cuvees`. Je ne les avais pas regardés, j'avais
lu leurs 3,1 s et 7,7 s comme une lenteur.

La cause, dans `public.resume(b uuid, cle text)` du lot 27 :

```sql
insert into public.resumes (bureau, cle, charge) values (b, cle, r)
on conflict (bureau, cle) do update set ...
```

`cle` dans la cible du `on conflict` est ambigu avec le paramètre du même nom. **La fonction
meurt APRÈS avoir calculé.** Elle paie les 3 à 8 secondes, puis elle lève, puis PostgREST
rend 400, puis rien n'est mis en cache.

Vérifié dans la base : **`public.resumes` est VIDE. Zéro ligne.**

**Le cache du lot 27 n'a jamais retenu une seule ligne depuis sa livraison.** Les
« 1100/3800/5735 ms vers 0,77 ms » écrits dans le journal du même jour n'ont jamais eu lieu
en production. Chaque ouverture d'écran repaie le calcul complet, et finit en erreur.

**POURQUOI AUCUN BANC NE L'A VU, et c'est la leçon.** `controle-commerce.mjs` et
`controle-cuvees.mjs` appellent `commerce_resume()` et `cuvees_resume()` **directement**.
Ils prouvent, champ par champ, que le calcul est juste. Aucun n'appelle `resume()`, qui est
la porte. **On a mesuré la pièce et jamais la serrure.** Il a fallu un HAR de Ted pour voir
que la porte ne s'ouvrait pas.

### La correction, et les trois fausses pistes avant elle

Testée sur un Postgres 16 local, quatre variantes :

| | |
|---|---|
| qualifier le paramètre `values (b, resume.cle, r)` | **échoue** : l'ambiguïté est dans le `on conflict`, pas dans le `values` |
| donner un alias à la table à l'insert | **échoue** pareil |
| renommer le paramètre `cle` en `k` | marche, **mais casse l'appel du navigateur** : PostgREST associe les clés du corps JSON aux NOMS des paramètres, et `bdv-sync.js` envoie `{"b":…, "cle":…}` |
| **`on conflict on constraint resumes_pkey`** | **marche**, garde le nom du paramètre, garde l'atomicité |

Le nom d'une contrainte ne peut pas être ambigu : il ne désigne rien d'autre. La cible d'un
`on conflict` n'accepte que des noms de colonnes nus, donc tant que `cle` y figure, la
collision est inévitable.

Ma première correction était fausse et je l'ai su en la testant, pas en la relisant.

### 2. `57014 canceling statement due to statement timeout` sur le comptage

`GET /ventes?select=empreinte&bureau=eq.…` rend **500**. C'est le `count=exact` de PostgREST,
donc un `count(*)` sur les 171 569 lignes, 205 Mo à parcourir. Le serveur abandonne.

C'est la sonde que j'avais ajoutée quelques heures plus tôt pour corriger le miroir vide.
Elle posait la bonne question au mauvais prix.

Corrigé : la question n'est pas « combien » mais « y en a-t-il ». `select=empreinte&limit=1`
sort de l'index en quelques millisecondes. `auMoinsUneVente()` rend `true`, `false`, ou
`null` quand elle ne sait pas, et `baseVide()` ne conclut jamais sur un `null`.

### Ce que l'écran disait, et qui était faux

Sans lignes locales et sans résumé serveur, « Mon commerce » a quand même affiché
« Personne à relancer. Aucun client ne recule, ne rompt son rythme ni ne reste sans suite.
Profites-en. » sur une base à zéro ligne.

**Un écran qui n'a pas de données ne doit pas rendre un verdict.** Ce n'est pas corrigé, et
c'est le prochain point à regarder : chaque bloc doit distinguer « j'ai regardé, il n'y a
rien » de « je n'ai rien à regarder ». Le bloc voisin, lui, le fait bien :
« Décomposition indisponible. Il faut deux années comparables. »

---

## 18/09/2026, la nuit. Le HAR de Ted tranche trois choses d'un coup

Ted a enregistré un HAR complet, de l'ouverture du bureau jusqu'à la dernière vue, et il a
signalé au passage : « quand on clique sur mon commerce, ça ouvre mes réglages tout seul ».

Le fichier répond aux trois questions ouvertes de la journée.

### 1. Le CLUSTER a marché

| | avant | après |
|---|---|---|
| attente serveur, médiane | 449 ms | **171 ms** |
| synchro complète, 173 pages | 104 s | **35 s** |

La cause était bien celle-là : `empreinte` est un hachage, sa corrélation avec l'ordre
physique de la table vaut **0,001**. Trier dessus faisait chercher 1000 lignes éparpillées
dans 205 Mo, à chaque page, 173 fois. `cluster public.ventes using ventes_pkey` les a
rangées dans l'ordre où la synchro les lit.

**Ce n'est pas durable.** Les lignes insérées après le CLUSTER repartent à la fin du tas.
À refaire après un gros import, ou à corriger dans le code en paginant sur `maj_le`, dont
la corrélation vaut déjà 0,898. La voie rapide du lot 21 trie déjà comme ça.

### 2. La compression, et mes deux erreurs successives

`Content-Encoding: gzip`, confirmé. **24,4 Mo passent réellement sur le fil** pour 94 Mo
décodés, facteur 3,86.

Ce matin j'annonçais 205 Mo, c'était la taille du tas. Ce soir j'annonçais 8 à 9 Mo, en
extrapolant un facteur 9,7 mesuré avec pglz sur un bloc de 10 000 lignes. **Les deux étaient
faux, et pour la même raison : je n'avais pas regardé le fil.** gzip travaille page par page,
sa fenêtre ne traverse pas les 173 requêtes, donc il compresse moins bien qu'un bloc unique.

Et surtout : **4 % du temps part à recevoir les octets, 90 % à attendre le serveur.** Le
poids n'a jamais été le sujet. Le chantier du dictionnaire aurait optimisé les 4 %.

### 3. Le bug de Ted, et c'est une maladie connue du dépôt

`openApp()` fait :

```js
if(baseVide()){ navTo('vide'); ouvrirPanneauReglages(); return; }
```

et `baseVide()` rendait `LIGNES_EN_BASE === 0`, c'est-à-dire **le compte des lignes rangées
dans IndexedDB, sur cet appareil**. Sur un navigateur qui n'a pas encore synchronisé, ce
compte vaut zéro pendant que le compte du vigneron en porte 171 569.

Dans le HAR, la synchro rapatriait justement ses 173 pages au même moment. Le bureau a
conclu « base vide, va importer » et a posé le panneau des réglages par-dessus l'écran
demandé. Puis le panneau a calculé son classement et écrit les réglages sur le compte, ce
qui a périmé les trois résumés, qu'il a fallu recalculer : les deux `rpc/resume` du HAR,
**10,9 secondes à eux deux**, sont la conséquence du bug, pas une lenteur à part.

C'est mot pour mot la maladie écrite dans `bdv-sync.js` à propos du repère : **une absence
n'est pas un zéro.** Le commentaire de l'amorçage le disait même de cette ligne : « sans elle
on ne saurait pas distinguer base vide de lignes pas encore chargées ». Il distinguait le
mauvais couple : local vide contre mémoire vide, jamais local vide contre serveur plein.

Corrigé : on ne déclare la base vide que si le **serveur** la dit vide aussi. Le comptage
serveur n'est demandé que quand le miroir est vide, donc jamais dans le cas courant. Et si le
serveur ne répond pas, on ne conclut rien : l'écran s'ouvre, `assurerLignes()` fait son
travail.

`npm run banc:base-vide` rejoue les quatre états de la fonction. Étalonné : trois échecs sur
l'ancienne version, zéro sur la nouvelle.

### Un défaut de plus, repéré au passage, pas corrigé

`src/js/bdv-reglages.js:822` compte `/ventes?select=empreinte` **sans filtre de bureau**. Le
compteur d'écart du panneau additionne donc les lignes de TOUS les bureaux dont la personne
est membre. Sur un compte à un seul bureau ça ne se voit pas. Sur deux, il affiche un écart
qui n'existe pas. `compterVentes()` dans `bdv-sync.js` colle `auBureau()`, lui.

### Ce qui reste

- Rendre le CLUSTER inutile : paginer `tirerVentes()` sur `maj_le` comme le fait déjà la
  voie rapide. `banc-sync.mjs:198` exige `order=empreinte.asc` et devra changer avec.
- Le compteur d'écart sans bureau, ci-dessus.
- Les résumés serveur : 3,1 s pour `cap`, 7,7 s pour `cuvees` quand ils sont froids. À
  regarder une fois que le bug ne les périmera plus pour rien.

---

## 18/09/2026, tard. Les 88 Mo n'existent pas sur le fil, et le goulot n'est pas le poids

Ted a tranché : on fait les 87 % de réseau. J'ai commencé par mesurer les 43 colonnes, comme
prévu. Puis j'ai posé la question que j'aurais dû poser en premier ce matin : **est-ce que ces
88 Mo traversent vraiment le réseau en clair ?**

Non.

### La mesure

Dix mille lignes de `ventes.brut`, agrégées en un seul texte, stockées dans une table
temporaire pour forcer la compression TOAST de Postgres :

| | |
|---|---|
| en clair | 4 565 872 octets, soit **457 octets par ligne** |
| après pglz | 470 365 octets, soit **47 octets par ligne** |
| facteur | **9,71** |

[Certain] Et **pglz est l'algorithme le plus faible de la famille**, choisi par Postgres pour sa
vitesse, pas pour son taux. gzip fait nettement mieux sur ce genre de texte.

[Probable] La doc Supabase dit noir sur blanc : « Currently Supabase compresses text payloads at
the CDN ». La compression non faite côté serveur est un coût d'egress pour EUX, pas pour le
navigateur du vigneron.

**Donc la synchronisation ne tire pas 88 Mo. Elle en tire de l'ordre de 8 à 9.**

### Pourquoi mon chantier était condamné d'avance

[Certain] gzip **est** un dictionnaire. LZ77 remplace toute chaîne déjà vue par une référence
arrière. Les 131 noms de produits recopiés 171 569 fois, c'est le cas d'école qu'il écrase.

J'allais donc passer des semaines à construire, à la main et dans le navigateur, avec un banc
de preuve et un risque sur cinq écrans, **ce que le transport fait déjà gratuitement et mieux.**
Les 65 Mo d'économie que j'annonçais sont des octets qui ne sont jamais partis.

### Ce qui coûte vraiment, et je ne l'avais pas regardé

`bdv-sync.js`, `tirerVentes()` : la boucle est **strictement séquentielle**. Curseur sur
`empreinte`, une page, on attend, la suivante. `PAGE = 1000` parce que PostgREST plafonne à
1000 lignes par défaut, et le commentaire le dit.

**171 569 lignes ÷ 1000 = 172 allers-retours, l'un après l'autre.**

[Probable] À 150 ms d'aller-retour vers l'Irlande depuis un domaine français, plus le temps
serveur, c'est **25 à 60 secondes de pure attente sérialisée**, et pas un octet de cette
attente ne dépend du poids des pages. Chaque page pèse 45 Ko compressés : elle arrive en un
souffle, puis on attend la suivante.

**Le goulot est la latence, pas le poids.** Je me suis trompé de dimension toute la journée.

### Les deux leviers, et ils sont petits tous les deux

1. **Le réglage « Max rows » du projet Supabase**, Project Settings, API. Par défaut 1000.
   À 10 000, les 172 allers-retours tombent à 18. Un seul champ à changer, aucun code.
   Attention : c'est un réglage de PROJET, il s'applique à toutes les requêtes.
2. **Le parallélisme côté navigateur.** Le curseur sur `empreinte` interdit de paralléliser
   tel quel, mais `empreinte` est un hexadécimal de 16 caractères : on peut découper l'espace
   en 8 tranches par leur premier caractère et tirer les 8 en parallèle. 172 allers-retours
   sérialisés deviennent 22 vagues. Entièrement dans `bdv-sync.js`, sans toucher au serveur.

[Supposition] Le levier 1 est presque gratuit et probablement suffisant. Le 2 est la vraie
correction si le 1 ne suffit pas.

### La vérification qui manque, et je ne peux pas la faire

Les deux réseaux dont je dispose refusent les requêtes vers `supabase.co`, et le navigateur
intégré a lâché en route. **Je n'ai donc pas vu de mes yeux l'en-tête `Content-Encoding`.**

Ted le verra en trente secondes : ouvrir `/mon-bureau/`, F12, onglet Réseau, lancer une
synchronisation, cliquer une requête `ventes`. Comparer « Size » (ce qui passe sur le fil) et
« Content » (ce qui est décodé). Si le rapport est de 9 ou 10, tout ce qui est écrit ci-dessus
tient. S'il est de 1, alors la compression n'a pas lieu, et **activer la compression devient le
chantier, pas réécrire le modèle de données.**

### Ce que je n'ai pas fait, et pourquoi

Rien. Pas une ligne de code sur la synchronisation. Ni la colonne `maj_le` sur
`ventes_lignes`, ni la réécriture de `banc-sync.mjs`, ni le dictionnaire.

Les deux préalables que j'avais écrits ne servaient qu'au chantier qui vient de tomber. Les
poser aurait été du travail propre au service d'une idée fausse.

### La leçon, et c'est la cinquième de la journée

Ce matin j'ai annoncé cinq points, trois étaient faux. Ce soir j'en annonce un de plus, et
c'est le mien : **j'ai mesuré la taille des données dans la base et je l'ai appelée « ce qui
traverse le réseau ».** Ce n'est pas la même chose, et il y avait un facteur dix entre les deux.

La règle qui manquait : **avant d'optimiser un transport, mesurer le transport.** Pas la
source, pas la destination : le fil lui-même, avec ses en-têtes.

---

## 18/09/2026, fin de journée. L'audit du design system, et trois choses que j'avais dites de travers

Ted a demandé un audit de `/design:design-system` : comment améliorer le back pour que le
front soit le plus fluide possible. Le premier rapport tenait en cinq points. **Trois se
sont révélés faux à la vérification, et c'est l'enseignement principal de la session.**

### Ce que j'avais annoncé, et ce qui était vrai

| Ce que j'ai dit le matin | Ce qui est vrai |
|---|---|
| Deux index morts dans le lot 22 bloqueraient un rejeu | **Faux.** Le lot 23 retire les colonnes générées, ce qui emporte les index. Un rejeu dans l'ordre passe. |
| Trois noms d'index dédoublonnés, l'ordre déciderait | **Faux.** La bascule fait `drop column id`, ce qui libère les noms. Les bons index se recréent. |
| Brancher le navigateur sur `ventes_lignes` = 90 % du gain | **Faux, et c'est la plus grosse erreur.** Ça ne fait gagner aucun octet. |
| `tokens.css` est une source de vérité en retard | **Vrai**, et pire que dit : 31 jetons de retard, pas 20. |
| 302 Ko de CSS non minifié sur 38 pages | **Vrai.** C'est le vrai gisement. |

**La leçon, et elle est générale : j'ai raisonné sur le SQL au lieu de le rejouer.** Deux
des trois erreurs viennent de là. J'ai lu `create index if not exists` déclaré deux fois,
j'en ai déduit une collision, et je n'ai pas cherché ce qui se passait entre les deux
déclarations. Un Postgres 16 vide et huit minutes auraient suffi.

### Ce que le rejeu réel a trouvé à la place, et qui est sérieux

`supabase/schema.sql` dit en tête : « Écrit pour être rejouable sans erreur. » **Il ne
l'était pas. Six erreurs sur une base neuve, et la première ligne 61** — donc avant la
création de la moindre table de vente. Une base neuve partie de ce fichier n'avait ni
`ventes`, ni `taches`, ni `bureaux`.

Les six ont la même maladie : nommer un objet qui n'existe pas encore.

1. `grant update (… utilise_vitisoft)` ligne 61, colonne déclarée ligne 272.
2. et 3. Deux `revoke` sur `courrier_envois_purger()` et `profils_dater_consentements()`,
   qui ne vivaient que dans les lots 12 et 13, jamais recopiés ici.
4. La vue `v_courrier` lit `p.jeton_emails`, colonne du lot 12, absente elle aussi.
5. et 6. Les deux `grant` sur cette vue, qui n'avait donc pas pu être créée.

**Personne ne pouvait le voir.** Sur la base de production, qui avait reçu les lots un par
un, chaque ligne fautive trouvait son objet et passait. Le fichier n'était faux QUE sur une
base neuve, c'est-à-dire exactement le jour où on en aurait eu besoin.

Corrigé en réintégrant ce qui manquait des lots 10, 12 et 13 : la table `courrier_envois`,
les quatre colonnes de consentement, le déclencheur dateur, `courrier_envois_purger()`,
`emails_lire()` et `emails_ecrire()`. Le raisonnement de chaque objet reste dans son
fichier de lot, qui est ce qu'on colle au quotidien.

**Preuve :** rejeu sur un Postgres 16 vide, `schema.sql` puis les lots 21 à 27.
Zéro erreur, et le résultat est **identique à la production au caractère près** : 49 tables,
vues et index, 32 fonctions et 40 politiques, comparés un par un.

`npm run banc:rejeu` garde cet acquis. Il ne se connecte à aucune base : il relit le SQL et
vérifie que chaque objet nommé existe avant d'être nommé. Étalonné contre le vrai Postgres :
il trouve les mêmes défauts aux mêmes endroits.

### Les jetons : une collision qui attendait son heure

`--ombre-photo` valait `0 20px 60px rgba(0,0,0,0.35)` dans `style.css` et
`10px 10px 0 rgba(0,0,0,0.28)` dans `bdv-ecrans.css`. **Deux ombres sous un seul nom.**
Comme `bdv-nav.js` pose la seconde feuille APRÈS la première, c'est elle qui gagnait, et
elle gagnait pour la page entière : le jour où une règle du site aurait appelé ce jeton,
son ombre aurait changé toute seule à la première ouverture d'un écran de vente.

Sans conséquence aujourd'hui parce que le site n'appelle ce jeton nulle part. C'est un
piège qui attendait, pas une panne. La valeur voulue existait déjà sous son vrai nom,
`--ombre-dure-xl`, à l'identique.

Et `tokens.css`, qui s'annonce « source unique de vérité », **n'est chargé par rien** :
aucun `<link>`, pas copié dans `_site`, jamais parti chez Vercel. C'était une doctrine, et
elle avait 31 jetons de retard sur ce que le navigateur recevait.

`npm run banc:jetons` en fait un contrat : aucun jeton servi avec deux valeurs, tout jeton
servi écrit dans la doctrine, aucun jeton fantôme. Les 31 manquants y sont désormais, avec
la raison qui les fait exister.

**Ce qui reste un arbitrage pour Ted :** faut-il vraiment SERVIR `tokens.css` et vider le
`:root` de `style.css` ? Je ne l'ai pas fait, et pas par prudence molle : `scripts/charte.mjs`
collecte les jetons dans le `:root` de sa cible. Vider ce bloc lui ferait déclarer une
centaine de jetons « jamais déclarés » et le contrôle échouerait en bloc. **On apprend
d'abord au garde-fou à lire la nouvelle forme, on change la forme ensuite.** Jamais l'inverse.

### La minification, qui était le vrai sujet depuis le début

Aucune minification n'existait. `style.css` partait à 302 Ko bruts sur les 38 pages qui la
lient, mentions légales comprises.

Un hook `eleventy.after` dans `.eleventy.js`, vingt lignes, `css-tree` déjà dans le dépôt,
**zéro dépendance ajoutée.**

| | brut avant | brut après | brotli avant | brotli après |
|---|---|---|---|---|
| style.css | 302 Ko | 146 Ko | 63,5 Ko | **20,1 Ko** |
| les quatre feuilles | 410 Ko | 206 Ko | 90,7 Ko | 30,1 Ko |

**43,4 Ko de moins sur chaque première visite d'une page publique.**

Minification conservatrice et délibérément : `csstree.generate()` retire les commentaires et
les blancs, rien d'autre. Il ne fusionne pas les règles, ne raccourcit pas les couleurs, ne
réordonne rien. Sur une feuille dont un garde-fou lit les sélecteurs un par un, c'est
exactement ce qu'on veut. Le hook recompte les règles, les déclarations et les `!important`
des deux côtés, et laisse le fichier d'origine en place au moindre écart.

Il réécrit `_site`, jamais `src` : `charte.mjs` continue de lire des sources intactes. Les
sept aperçus, qui lisaient `_site/css/`, ont été repointés vers `src/css/` le même jour —
c'est plus juste de toute façon, et ça les met hors d'atteinte de toute étape de build.

### Les polices : rien fait, et c'est la décision

Quatre familles bloquent le rendu sur toutes les pages. `Caveat` ne sert que sur l'accueil,
`JetBrains Mono` sur aucune des douze pages plates. Il y a 60 à 90 Ko à récupérer.

**Et c'est inaccessible en l'état.** `charte.mjs` lit le lien Google Fonts avec
`/family=([^&]+)/g` appliqué au TEXTE ENTIER du fichier, et pour un même nom de famille la
dernière occurrence écrase les précédentes. Avec deux liens :

- le lien mince écrit avant le plein : le garde-fou voit l'union, déclare CONFORME, et les
  pages publiques rendent en faux gras. **C'est l'incident des 376 passages en gras de 2026,
  reproduit à l'identique, avec le contrôle qui le couvre au lieu de l'attraper.**
- l'ordre inverse : Fraunces retombe à 400 et il crie au faux gras sur des titres qui vont
  très bien.

L'ordre est donc imposé : on scinde `style.css` en une feuille publique et une feuille
bureau, on apprend à `charte.mjs` à contrôler chaque moitié contre son propre lien, et
**seulement ensuite** on scinde le lien. Ne jamais poser un second `<link>` avant ça.

### Et le gros morceau : 88 Mo qui traversent le réseau, et d'où ils viennent

J'avais dit 205 Mo. C'est faux : 205 Mo est la taille du TAS de la table, jamais passée au
`VACUUM`. **Sur le fil, c'est 88 Mo**, 540 octets par ligne, 171 569 lignes. Mesuré, pas estimé.

Et j'avais dit que brancher le navigateur sur `ventes_lignes` réglerait ça. **C'est faux, et
c'est contre-intuitif :** la facture est faite du CONTENU des colonnes, pas de l'emballage
JSON. Le tableau positionnel des 43 champs ne coûte que 131 octets de ponctuation ; les
mêmes colonnes en JSON nommé en coûteraient 699. **Un `select=*` sur `ventes_lignes` serait
plus gros que ce qu'on télécharge aujourd'hui.**

D'où viennent les 88 Mo, mesure par colonne :

| colonne | poids total | valeurs distinctes |
|---|---|---|
| `produit` | **25 Mo** | 131 |
| `cuvee` | **25 Mo** | 131 |
| `emails` | 4,3 Mo | 1 936 clients |
| `client_nom` | 3,2 Mo | 1 936 clients |
| `famille`, `ville`, `num_facture`, `conditionnement` | ~6,7 Mo | |

**50 des 88 Mo sont 131 noms de produits, recopiés sur chacune des 171 569 lignes.** C'est
la répétition, et elle seule, qui fait le poids. Rien d'autre.

La forme qui règle ça n'est pas `ventes_lignes` : c'est une table de faits mince (le jour,
la clé client, le numéro produit, la quantité, le total, le tarif) plus deux petites tables
de libellés, clients et produits, servies une fois.

| | poids sur le fil |
|---|---|
| aujourd'hui | **88 Mo** |
| table de faits mince | 11 Mo |
| libellés clients (1 936) | 180 Ko |
| libellés produits (131) | 55 Ko |
| **total après** | **11 Mo, soit 87 % de moins** |

**Je n'ai rien touché de tout ça, et c'est volontaire.** C'est un changement de forme des
données qui traverse cinq écrans, l'export XLSX et l'écran Réglages. Il demande l'accord de
Ted, et avant lui trois préalables :

1. `maj_le` n'existe pas dans `ventes_lignes`. Sans elle, la voie rapide du lot 21 meurt et
   chaque ouverture repart sur un rapatriement complet.
2. `banc-sync.mjs` reconnaît les lectures au préfixe `/ventes?`. Il faut le réécrire AVANT,
   sinon il ne protège plus rien.
3. Le mode deviné n'est pas porté côté serveur : tant qu'un vigneron n'a pas validé son
   classement, `v_ventes` ne rend rien d'exploitable, et le navigateur doit garder
   `classerLigne()` de toute façon.

### Ce qui a été touché

- `supabase/schema.sql` : +138 lignes, les lots 10, 12 et 13 réintégrés, la colonne
  `utilise_vitisoft` remontée avant le `grant` qui la nomme.
- `scripts/banc-rejeu.mjs` : nouveau, l'ordre de collage devient une déclaration vérifiée.
- `scripts/banc-jetons.mjs` : nouveau, `tokens.css` devient un contrat.
- `tokens.css` : 88 → 119 jetons, les 31 manquants avec leur raison.
- `src/css/bdv-ecrans.css` : collision `--ombre-photo` levée.
- `.eleventy.js` : la minification CSS au build.
- les sept `scripts/apercu-*.mjs` : repointés de `_site/css/` vers `src/css/`.
- `package.json` : les deux bancs, et dans `verif`.

`npm run verif` : 33 bancs, zéro échec.

### Ce que je me promets de regarder

- L'arbitrage `tokens.css` servi ou doctrine, qui appartient à Ted.
- La scission de `style.css`, préalable obligé au travail sur les polices. 90 % des règles
  de cette feuille ne s'appliquent à rien sur un article.
- La table de faits mince, si Ted veut les 87 %.
- `--font-chiffre` n'est pas dans la table `FAMILLE` de `charte.mjs` : une graisse demandée
  dessus est rangée « famille système, hors contrôle » alors qu'elle tire sur Inter. Retirer
  Inter 700 du lien ne lèverait aucune alerte et remettrait du faux gras sur l'accueil.

---

## 18/09/2026, plus tard. Le cache, ou la chose que j'aurais dû faire en premier

« Mes cuvées, j'ai l'impression que ça foire aussi. »

C'était vrai : cet écran dérivait ses 171 569 lignes pour en tirer une quarantaine de
cuvées. Un rapport de quatre mille contre un.

Je l'ai porté en SQL comme les deux précédents — base d'essai, vrai moteur en témoin,
comparaison champ par champ, dix-sept champs, zéro écart. **Et la fonction mettait
5 735 ms sur sa base.** Un portage qui remplace 1 470 ms de navigateur par 5 735 ms de
serveur n'est pas un progrès.

### Ce que j'avais manqué depuis le début

Les trois résumés se recalculaient **à chaque ouverture d'écran** : 1,1 s, 3,8 s, 5,7 s.
Un logiciel de gestion ne recalcule pas son chiffre d'affaires chaque fois qu'on le
regarde. Il le calcule quand il change.

Une table de résumés, effacée par déclencheur dès qu'une vente ou un réglage bouge,
recalculée à la première lecture qui suit. **0,77 ms.**

Le premier calcul se paie une fois, juste après l'import, pendant qu'il lit son compte
rendu : le seul moment où quelques secondes de serveur ne se voient pas.

### Deux défauts trouvés en comparant, aucun dans le SQL

`agentProduits()` range une ligne sans nom de produit sous « (sans nom) », puis onze lignes
plus bas la cherche sous la chaîne vide : la cuvée affichait 0 % de dépendance alors
qu'elle tient à un seul client à 100 %.

Et ma base d'essai, deux fois : elle donnait un nom à la ligne censée tester le produit
sans nom, et elle ne transmettait pas le conditionnement, donc les magnums polluaient la
fourchette de prix qu'ils devaient justement en être exclus. Troisième fois qu'elle se
reprend elle-même.

### La règle

**Porter un écran le rend juste. C'est le cache qui le rend rapide. Les deux sont
nécessaires, aucun ne suffit.** J'ai passé trois lots à rendre les chiffres vérifiables
avant de me demander à quelle fréquence ils avaient besoin d'être calculés.

---

## 18/09/2026, soir. Ted me remet en place, et il a raison

« Je ne veux pas avoir à attendre huit ans dès que je recharge ma page, pour que ça recolle
les bouts. Y'a une BDD derrière qui est censée gérer les données et les redistribuer
correctement. »

C'était **la** faute d'architecture. Tout ce que j'avais corrigé depuis deux jours grattait
autour : la politique de sécurité, le repère, le VACUUM, la peinture paresseuse. Le fond
restait que **l'outil recopiait sa base de données sur le poste à chaque ouverture** avant
d'afficher quoi que ce soit. Aucun logiciel de gestion ne fait ça.

L'amorçage ne lit plus une seule ligne de vente. Il fait un `count()` local, lit les
réglages, demande le résumé de l'écran ouvert. Quelques centaines d'octets.

### J'ai failli refaire la même erreur en la corrigeant

Ma première version peignait l'écran sur les chiffres du serveur **puis chargeait les lignes
en arrière-plan** pour compléter les blocs non portés. Le banc que je venais d'écrire l'a
refusée. Il avait raison : charger 171 569 lignes sans que personne l'ait demandé, c'est
toujours charger 171 569 lignes. Le voile disparaît, le navigateur rame quand même.

Les blocs non portés sont maintenant derrière un bouton qui dit ce qui manque. Ce n'est pas
une élégance, c'est un aveu.

### Le garde-fou qui m'a fait le plus peur

Le dépôt qui alimente « Ma journée » et le courrier du matin parcourt les lignes. Avec zéro
ligne chargée, il aurait écrit **des zéros sur le compte** : Ted aurait vu son chiffre
d'affaires disparaître de son bureau, sans une erreur nulle part. Même famille que le
message vert du 07/09 qui masquait 4 442 lignes perdues. Une écriture qui réussit avec de
mauvaises données ne se plaint jamais.

### Ce que je retiens

J'ai passé deux jours à optimiser les symptômes d'un choix d'architecture que je n'avais pas
remis en cause, parce que le dépôt le documentait comme une règle (« IndexedDB reste la
source de calcul »). Une règle écrite dans le dépôt reste une décision, pas un fait. **Il a
fallu que l'utilisateur s'énerve pour que je remonte au niveau où était le problème.**

---

## 18/09/2026. « La suite ? » — pas l'écran suivant

Ted demandait la suite en pensant à Mes cuvées. J'ai commencé par compter : **65 fonctions
lisent `ROWS`**. Les porter une par une, c'est un chantier interminable où chaque lot fait
gagner zéro seconde jusqu'au dernier. Mauvaise forme, donc mauvaise question.

### Ce que la mesure a dit

`renderAll()` peignait **six écrans à chaque ouverture**, quel que soit celui où il
atterrit. Sur ses 171 569 lignes : 6 831 ms d'amorçage, dont **4 497 à peindre des pièces
que personne ne regardait**. Mon commerce 2 336 ms, Mes cuvées 1 849 ms, les réglages et Ma
base 414 ms — tout ça derrière des panneaux masqués.

Ce n'est pas un calcul à optimiser, c'est du travail à ne pas faire. Même faute que les
trois écrans fantômes du lot 5, en plus gros.

**6 831 ms → 2 334 ms.** Le prix ne disparaît pas, il se déplace : le premier clic sur Mon
commerce coûte 1 480 ms, payés au moment où il a demandé à voir la pièce, et annoncés.

### Deux défauts de mon propre banc

J'ai écrit le banc qui garde ce gain, et il était faux deux fois.

**Il regardait à côté.** `renderCap()` écrit dans `p-diagnostic`, pas `p-annee` ; Mon
registre dans `p-explorer`, pas `p-explo`. Ma première version déclarait Mon cap non peint
alors qu'il l'était. Un banc qui regarde au mauvais endroit invente des défauts, ce qui
coûte autant que d'en laisser passer.

**Il n'exerçait pas le chemin le plus emprunté.** Il testait `navTo`, jamais `renderAll()`,
qui est pourtant ce qu'appelle chaque import et chaque réglage. Une mutation remettant la
peinture des six écrans dans `renderAll()` passait les treize contrôles. Corrigé : elle en
fait échouer quatre.

Et `npm run verif` avait laissé passer tout le changement sans broncher, parce que tous les
autres bancs appellent les peintres directement : aucun ne regarde *quand* la peinture a
lieu.

### Ce que je retiens sur la stratégie

Porter les écrans en SQL était la bonne idée pour la justesse, pas pour la vitesse. Les deux
plus gros gains de ce chantier n'ont rien à voir avec le portage : une règle de sécurité mal
écrite, un VACUUM manquant, et cinq écrans peints pour rien. **Le SQL a rendu les chiffres
vérifiables ; c'est la mesure du navigateur qui a rendu l'outil rapide.**

---

## 17/09/2026, très tard. Une plainte, trois causes, dont une à moi

« Ça a foiré une fois et là ça charge les lignes. » La ligne qui compte n'est pas « ça
charge » : un amorçage qui échoue ne pose pas son repère, donc le suivant repart de zéro.
Les 32 000 lignes qu'il voit sont la conséquence, pas la cause.

Journaux Supabase : **quatre 500 à 8 100 ms** en huit minutes, tous sur le comptage. Huit
secondes, c'est le délai d'expiration de PostgREST.

### La carte de visibilité était froide

`relallvisible = 0` sur 26 240 pages. `ventes` n'avait jamais été passée au VACUUM depuis
son remplissage, donc aucun parcours d'index seul n'était possible et chaque comptage lisait
les 205 Mo du tas. **3 543 ms → 222 ms, `Heap Fetches: 0`.** Seize fois, sans une ligne de
code. À refaire après chaque gros import tant que `brut` est là.

### Le repère ne triait plus rien

Ses 171 569 lignes portent toutes un `maj_le` entre 08:32:06 et 08:33:19 : une base importée
d'un coup, en soixante-treize secondes. La marge de cinq minutes du repère couvre alors la
base entière. **La voie rapide ramenait tout et se déclarait satisfaite**, si bien que le
comptage posé après elle n'était jamais atteint.

Ce n'est pas un cas tordu, c'est le cas de tout nouveau compte.

**Ma première correction était fausse**, et le banc l'a dit en trois contrôles : je comparais
la borne au compte local, ce qui confond « je télécharge beaucoup parce qu'il manque
beaucoup » et « je télécharge tout parce que le repère ne trie rien ». Seul le total du
serveur les distingue.

### Et « Mon commerce » partait à l'amorçage

`cap_resume` rend 8 nombres en 1,1 s. `commerce_resume` rend 1 935 clients, **642 ko, en
3,8 s**. Je l'avais lancé à l'amorçage par symétrie. Quatre secondes de serveur et un
demi-méga à chaque ouverture du bureau, y compris celles où il ne regarde jamais cet écran,
et en concurrence avec le comptage qui expirait.

**C'est la faute du lot 22, refaite le même jour : une mesure n'est valable que pour le
décor dans lequel elle a été prise.** J'ai recopié « lancer à l'amorçage » d'un cas à huit
nombres vers un cas à 642 ko sans le remesurer.

Il part maintenant à l'ouverture de l'écran, sans faire attendre.

### Ce que j'en retiens

Trois causes empilées derrière une seule plainte, et aucune des trois ne se voyait dans le
code. La première est dans les statistiques de Postgres, la deuxième dans la distribution
réelle d'une colonne, la troisième dans un chiffre que je n'avais pas remesuré. **Les
journaux et les plans d'exécution ont répondu à tout ; la relecture n'aurait rien donné.**

---

## 17/09/2026, tard. « Mon commerce » : deux heures de filet avant une ligne de portage

Ted a demandé le plus fiable, même si c'est long à mettre en place. C'était le bon
arbitrage, et voici ce que la mise en place a révélé avant même d'écrire le portage.

### Le contrôle gratuit n'existait plus

Au lot 24 la comparaison était offerte : le navigateur dépose déjà ses chiffres dans
`reglages.resume_ventes`. Pour « Mon commerce », **rien n'est déposé**. La règle du
chantier n'avait plus rien à mordre.

### Et la vraie base ne pouvait pas servir de terrain d'essai

Sa base de facturation est un abonnement mensuel : **1 831 clients sur 1 935 sont venus
trois fois ou plus**, 63 une seule fois, et **34 seulement sont observables à un an, là où
le moteur en exige 40**. Elle écrase le moteur en volume, ce qui est précieux, et elle ne
touche presque aucun des cas où un portage se trompe.

**Porter contre elle, c'est mesurer la justesse d'une balance en pesant toujours le même
sac.** J'ai donc écrit une base d'essai à l'envers : partir de la liste des pièges connus,
et donner à chacun son client. Elle est chargée dans un bureau `ZZ-ESSAI-COMMERCE`, invisible
de ses écrans, et elle passe par le même chemin que ses vraies ventes, déclencheur compris.

Elle ne contient **aucune donnée réelle**, et c'est délibéré : la première idée était de
tirer un extrait de sa base dans le dépôt, ce qui aurait mis 86 000 lignes de noms de clients
et de chiffre d'affaires dans git. Écarté.

### Les trois conventions invisibles

Le portage ne bute pas sur la logique, il bute sur trois conventions statistiques que le
JavaScript ne déclare nulle part :

- `median()` fait la **moyenne des deux valeurs centrales** sur un tableau pair, donc
  `percentile_cont`, pas `percentile_disc`. Vérifié par mutation : **sept cadences sur
  douze changent**. C-PAIR-2 passe de 60 jours à 30, C-AVOIR de 185 à **six**. Un client à
  six jours de cadence est en retard en permanence.
- `stdev()` divise par **n**, donc `stddev_pop`, pas le `stddev` de Postgres. Trois
  coefficients changent, un client change de classe. Sur sa vraie base : **trois clients
  sortent de la liste d'appels**, la perte annoncée bouge de 703 €.
- les quartiles du premier achat s'écrivent `montants[floor(p·n)]`, qui n'est **ni** l'un
  **ni** l'autre : `percentile_disc` prend un cran plus bas.

Aucune ne casse rien à l'écran. Même famille que le signe des avoirs.

### La fixture s'est attrapée elle-même, deux fois

Elle n'avait **aucune ligne au jour de référence** : la vente la plus récente tombait trente
jours plus tôt, donc tous les silences étaient trente jours trop courts et les trois clients
posés de part et d'autre de leur frontière se retrouvaient du même côté. Et les deux clients
de la volatilité chutaient trop fort pour distinguer les deux conventions. Corrigés, dont un
résolu numériquement pour tomber pile entre les deux seuils.

**Une base d'essai qui n'attrape pas ses propres défauts n'attrapera pas ceux du portage.**

### Le résultat

73 clients, 14 champs chacun, **zéro écart** entre le vrai moteur et le SQL, du premier coup
une fois les conventions posées. Et les trois mutations sont bien attrapées par la
comparaison.

### Le branchement, et deux choses trouvées en branchant

`computeBridge()`, `agentCadence()` et `agentDecrochage()` lisent le serveur quand il a
répondu, local sinon. Les deux appels partent en parallèle du rapatriement.

**Un ordre de tri qui n'existait que sur son appareil.** `Array.sort` est stable, donc deux
mouvements de même montant sortaient dans l'ordre où leurs clients apparaissent dans
IndexedDB, un ordre que rien ne peut reproduire. Le pied d'écran n'affiche que les dix
premiers : une égalité au dixième rang change qui s'affiche, d'un appareil à l'autre. Les
deux côtés trient maintenant par montant absolu puis par nom.

**Le banc a laissé passer une mutation.** 32 contrôles verts, et oublier `comNb()` sur
`caPotentiel` n'en faisait échouer aucun, parce que ce champ n'est lu par aucun écran. Un
contrôle qui ne regarde que ce qui s'affiche ne voit pas les champs qui ne s'affichent pas,
et ce sont ceux-là qui s'affichent un jour, en chaîne de caractères. J'ai ajouté un contrôle
de types sur tout ce que le serveur rend ; il attrape la mutation.

**Et j'ai trouvé du code mort au passage** : `caPotentiel` est calculé pour chaque client,
sommé, porté jusqu'à `agentDormants()`, et lu par personne. Je le signale, je ne le supprime
pas.

### Ce que je n'ai pas fait, et pourquoi

**« Premier achat sans suite » n'est pas porté.** Sur la base de Ted il refuse de répondre,
et il a raison : un taux de retour sur 34 personnes ne dit rien. Je ne peux donc le vérifier
que sur la base fabriquée. Le porter quand même, ce serait poser à l'écran des taux que
personne n'a jamais pu confronter au réel.

---

## 17/09/2026, soir. « Mon cap » branché, et les deux écarts que le contrôle vert cachait

### Le branchement

`renderCap()` lit maintenant `capCadre()` et `capAtterrissage()`, qui rendent **la même
forme** selon que le serveur a répondu ou non. L'appel part **en parallèle** du rapatriement
des ventes, dans `demarrerEcransVente()` : il ne dépend de rien qui soit dans le navigateur,
il n'a aucune raison d'attendre son tour.

Le calcul local **n'est pas supprimé**, il devient le repli. Un serveur qui tousse ne vide
pas l'écran.

### Ce que treize champs verts ne disaient pas

`v_cap_controle` rendait zéro ligne, et j'en ai conclu que les deux côtés étaient d'accord.
Ils ne l'étaient pas. La vue ne compare **que les treize champs que le navigateur dépose**,
et ni `bas`, ni `haut`, ni `methode` n'en font partie. En branchant, deux divergences sont
sorties, toutes les deux visibles à l'écran :

1. **La fourchette d'atterrissage en projection linéaire.** Le navigateur écrivait
   « fourchette [déjà réalisé] à [projection] » ; le serveur rendait deux fois la
   projection, donc une fourchette d'un seul point. Le navigateur avait raison : au pire,
   l'exercice finit où il en est. Serveur corrigé.
2. **Le nom de la méthode sous la fourchette.** Le navigateur annonçait « calé sur la
   saisonnalité de 2025 » dès qu'un exercice précédent existait en base, même à zéro sur
   les mois connus, auquel cas le chiffre affiché était linéaire. Navigateur corrigé.

**La leçon est celle du lot 22, reçue une deuxième fois : un contrôle ne prouve que ce
qu'il compare.** Un tableau tout vert m'a fait croire à un accord complet alors qu'il
portait sur les trois quarts du sujet.

### Le fichier du dépôt ne disait plus ce que la base faisait

En allant vérifier `bas` et `haut`, j'ai trouvé que `supabase/lot24-mon-cap.sql` **était en
retard sur la fonction réellement installée** : j'avais étendu `cap_resume()` en base
(jour de coupe, exercice précédent, quantités, fourchette) sans réécrire le fichier.
Personne n'aurait pu reconstruire la base à partir du dépôt. Remis d'aplomb, les deux textes
sont maintenant identiques. **Une fonction modifiée en base et pas dans le dépôt, c'est un
dépôt qui ment.**

### La péremption, posée à un seul endroit

Un résumé d'avant l'import afficherait un chiffre périmé **avec l'autorité d'un chiffre de
serveur**. Les trois réglages qui changent ce que le serveur calcule passent tous par
`syncUneColonne()` : la péremption est là, une fois, plutôt qu'à six endroits d'où elle
finirait par manquer au septième.

Et elle **attend l'écriture** avant de redemander : redemander avant que le nouveau
classement soit en base, c'est se faire recalculer l'ancien et le ranger comme s'il était
neuf. La mise à null, elle, est immédiate, donc entre le geste et la réponse l'écran calcule
en local. Se tromper du bon côté.

### Ce que ça ne fait pas

**Ça ne supprime toujours pas l'attente.** Quatre choses de « Mon cap » lisent encore
`ROWS` : les compteurs de la période affichée, les signaux, la courbe de tendance et la
décomposition prix/volume. Ouvrir « Mon cap » charge encore la base. Ce lot prouve la
chaîne de bout en bout, il ne fait pas gagner de seconde.

### Le banc

`scripts/banc-cap-serveur.mjs`, 33 contrôles. Il peint le panneau deux fois, en local et
avec la même vérité mise en forme comme le serveur la rend, et exige **le même HTML au
caractère près**. Vérifié par mutation : en inversant `bas` et `haut`, trois contrôles
tombent. Un banc qui ne peut pas échouer ne vaut rien.

---

## 17/09/2026, fin d'après-midi. « Mon cap » : treize chiffres sur treize

### Le test que je cherchais était déjà dans la base

Je me demandais comment comparer le serveur au navigateur sur de vraies données, sans
pouvoir faire tourner le navigateur de Ted. La réponse était là depuis le 09/09 : le tableau
de bord **dépose déjà ses propres chiffres** dans `reglages.resume_ventes` à chaque import.
Calculés par le navigateur, sur la vraie base. Il suffisait de les lire.

### Treize champs sur treize

| | navigateur | serveur |
|---|---|---|
| Chiffre d'affaires de l'exercice | 970 959 | 970 959 |
| Clients | 1 617 | 1 617 |
| Panier moyen | 87 | 87 |
| Variation à date égale | -2,3 % / -22 936 € | -2,3 % / -22 936 € |
| Atterrissage | 1 627 963 | 1 627 963 |
| Les douze valeurs mensuelles | 182173, 103364, 151782... | identiques, une à une |

`v_cap_controle` fige cette comparaison. **Tant qu'une ligne en sort, on ne retire aucun
calcul du navigateur.**

### Les deux fenêtres qu'il ne faut pas confondre

Le piège le plus sournois du portage. La comparaison d'une année sur l'autre se fait sur
`ex_pos`, donc **au jour près**. L'atterrissage, lui, compare sur `ex_mois`, donc **au mois
près**. C'est ce qu'écrit le JavaScript. Prendre l'une pour l'autre déplace l'atterrissage
de plusieurs dizaines de milliers d'euros, et rien ne casse.

Et l'ancre n'est jamais aujourd'hui : l'exercice courant est le dernier présent en base. La
base de Ted s'arrête au 31/08/2026 ; dater d'aujourd'hui comparerait huit mois de ventes à
douze mois de calendrier.

### Dix-sept balayages pour un écran

Première version de la fonction : 3 755 ms. Elle relisait la vue dix-sept fois, dont douze
pour construire la série mensuelle **un mois à la fois**. Les deux exercices comparés sont
maintenant matérialisés une seule fois : **1 141 ms**. `as materialized` n'est pas décoratif,
sans lui Postgres replonge dans la table à chaque usage.

### Ce qui n'est pas fait, et qu'il faut dire

**Le navigateur n'appelle pas encore cette fonction.** Elle est prouvée, elle n'est branchée
nulle part. Tant que `renderCap()` calcule en local, ce lot ne fait gagner aucune seconde à
Ted. C'est le prochain pas, et il ne se fait pas tant que `v_cap_controle` n'est pas vide.

---

## 17/09/2026, après-midi. Le calcul remonte au serveur : lots 22 et 23

Ted : « On va la prendre maintenant tout de suite, le hors-ligne c'est pas possible donc on
peut abandonner. Au travail. » **La règle 1 de `bdv-sync.js` tombe avec cette phrase**, et
avec elle la promesse qu'une panne Supabase laisse le bureau ouvert. Accepté explicitement.

### Trois mesures avant d'écrire une ligne

**Les dimensions sont minuscules** : 171 569 lignes, mais 1 936 clients, 131 produits,
80 mois, 17 familles. Les 81 Mo qui traversent le réseau deviennent une poignée de tableaux.

**Le classement est déjà sur le serveur.** Je craignais de devoir réécrire `classerLigne()`
en SQL, c'est le cœur de l'honnêteté de l'outil. `reglages.classement` ne contient que des
tables de correspondance : Postgres y cherche, il ne décide rien.

**Et le JSON brut est inexploitable** : 6 949 ms pour un simple regroupement par client.

### Le défaut qui aurait coûté 715 000 euros de chiffre d'affaires

En portant `parseNum()` en SQL, j'ai écrit `substring(s from '^[+-]?(...)')`. En Postgres,
`substring(x from motif)` rend **le premier groupe entre parenthèses**, pas le motif entier.
Le signe était dehors. `-0,02` était lu `0,02`.

La base porte **1 144 lignes négatives, les avoirs, pour -357 673,63 €**. Le CA sortait à
8 677 677,25 € au lieu de 7 962 329,99 €. Exactement deux fois les avoirs, et un total
parfaitement crédible. **Trouvé en comparant la fonction au JavaScript sur les vraies
valeurs, pas en la relisant.**

### Mon erreur de méthode, et c'est elle qui a coûté un lot entier

Le lot 22 a posé les colonnes typées **sur `ventes`**. Résultat : 6 333 ms au lieu de
6 949 ms. Presque rien.

La cause est physique : `brut` est resté dans la ligne, rangé avant les colonnes typées, et
Postgres doit le traverser pour les atteindre. Lire trois colonnes revient à lire les 264 Mo
de la table.

Or les 344 ms que j'avais annoncés la veille étaient mesurés sur une **table d'essai qui ne
portait pas `brut`**. J'ai présenté comme « le gain des colonnes typées » ce qui était « le
gain des colonnes typées dans une ligne étroite ». La règle qui en sort vaut pour tout le
dépôt : **une mesure n'est valable que pour le décor dans lequel elle a été prise, et ce
décor s'écrit à côté du chiffre.**

### Ce qui existe maintenant

`ventes_lignes`, table étroite de 112 Mo portant les 43 colonnes typées, tenue à jour par un
déclencheur sur `ventes` : **rien à redéployer dans le navigateur**. Et `v_ventes`, qui
ajoute vente/offert/canal/typologie/exercice en lisant les réglages.

| sur 171 569 lignes | avant | après |
|---|---|---|
| le balayage seul | 5 921 ms | **40 ms** |
| CA et bouteilles par mois d'exercice | (impossible) | **609 ms** |
| idem plus factures et clients distincts | (impossible) | **1 108 ms** |

Contrôles d'arithmétique qui tiennent : 163 377 lignes de vente plus 8 192 offertes font les
171 569 ; 253 709,596 bouteilles vendues plus 9 566,39 offertes font les 263 275,986 du
total ; le CA des offerts est exactement zéro.

### Pourquoi les 43 colonnes, et pas seulement les utiles

Le registre croise sur n'importe laquelle, colonnes perso comprises, et le canal se lit dans
celle que le vigneron **désigne** dans ses réglages : `codeTarif` chez l'un, `origine` chez
l'autre. Une colonne oubliée, c'est un axe qui disparaît sans message.

### Ce qui n'est PAS porté, volontairement

Le mode deviné, quand le vigneron n'a pas validé son classement. Deviner des deux côtés, ce
sont deux devinettes qui divergeront. La vue rend `classement_valide = false` et laisse
`est_vente` à nul : l'appelant sait qu'il ne peut pas s'en servir, au lieu de lire un faux
qui a l'air vrai.

### Ce qui reste

`brut` est encore là, et c'est encore lui que le navigateur envoie à l'import. Quand plus
rien ne le lira, il disparaît et la table redevient plus petite qu'avant le chantier. Ensuite
viennent les écrans, Mon cap d'abord.

---

## 17/09/2026, fin de matinée. Les écrans de vente : 268 Mo de colonnes recopiées pour rien

Ted, l'amorçage poussé : « Ma journée s'affiche direct. Par contre Mon commerce non, Mon cap
non, Mes cuvées non, Mon registre non. J'ai même pas de message pour me dire que ça mouline.
Il faut optimiser ça, de manière sévère. »

### Ce qu'on a mesuré avant de toucher à quoi que ce soit

Le vrai moteur, ses 171 569 lignes, dans jsdom :

| | avant | après |
|---|---|---|
| dérivation des lignes | 2 698 ms | 1 474 ms |
| `computeMeta()` | 971 ms | 369 ms |
| mémoire des seules colonnes | **268 Mo** | **10 Mo** |

**La cause n'était pas une fonction lente, c'était un volume d'objets.** Chaque ligne
recopiait ses **quarante-trois** colonnes dans un objet nommé : sept millions et demi
d'écritures de propriétés, 268 Mo, et la plupart de ces colonnes ne sont lues par aucun écran.
Sous cette pression mémoire, `computeMeta()`, qui ne fait que parcourir, mettait presque une
seconde à lui seul.

L'expérience qui l'a prouvé était un accident : en mesurant trois variantes dans le même
processus, la troisième est devenue plus lente que les deux premières. Trois copies de
171 569 lignes en mémoire. **Le ramasse-miettes disait ce que le chronomètre ne disait pas.**

### La correction, et pourquoi elle ne touche aucun écran

Les colonnes sont devenues des accesseurs posés une fois sur un prototype, et la ligne ne
garde que son tableau brut. `r.produit` s'écrit et se lit exactement pareil. C'est même plus
rapide à lire, 14 ms contre 147 ms pour trois colonnes sur toutes les lignes : 171 569 objets
à 43 propriétés font sortir le moteur JavaScript de ses formes optimisées, un prototype unique
l'y garde.

Ce que ça interdit : `Object.keys(r)`, `{...r}` et `Object.assign({}, r)` ne rendent plus les
colonnes. **Vérifié avant d'écrire une ligne : aucun des trois n'existe dans le dépôt.** C'est
la seule chose qui rendait ce changement défendable.

### « J'ai même pas de message » était un reproche aussi grave que le premier

Deux causes cumulées. `runBusy()` ne pose son voile qu'au-dessus d'un seuil de lignes **déjà
chargées** : au premier clic `ROWS` est vide, donc pas de voile, précisément au moment où
l'attente est la plus longue. Et même posé, il n'aurait rien montré : tout le travail tenait
dans un seul tour de boucle.

**Un message qu'on n'a pas laissé le temps de peindre n'existe pas.** Ça ne se répare pas avec
un texte de plus, ça se répare en rendant la main : dérivation par paquets de 8 000 lignes,
une respiration entre deux, et le compte qui avance. L'ouverture des écrans passe maintenant
par l'amorçage écrit le matin même, plutôt que par un deuxième voile qui se serait superposé
au premier.

### Un défaut de l'amorçage trouvé en le réutilisant

Le premier jet posait un drapeau et rendait la main tout de suite si un amorçage tournait
déjà. **Un clic sur « Mon cap » pendant que le bureau finissait de se raccorder n'aurait donc
rien ouvert**, sans un mot, avec un bilan vide qui dit « c'est fait ». Un appel qui ne fait
rien doit être impossible, pas discret. Remplacé par une file.

### Ce qui reste, et c'est le vrai chantier

**Le navigateur n'a rien à faire de 81 Mo de lignes brutes pour afficher huit chiffres.** Les
cinq écrans ne montrent que des regroupements, que Postgres calcule en quelques millisecondes.
Tout ce qui précède **repousse le mur, il ne le supprime pas** : à 400 000 lignes il revient.
La règle 1 de `bdv-sync.js`, « IndexedDB reste la source de calcul », devra être rouverte avec
Ted, avec ce qu'elle achète (le hors-ligne, aucun écran à réécrire) et ce qu'elle coûte.

---

## 17/09/2026, suite. « Quand je me connecte, rien ne s'affiche »

Le repère de synchronisation poussé, Ted rouvre son bureau et envoie une capture : le
sous-main dit « Ta file n'a pas pu être lue », le panneau « ton journal n'est pas encore
lisible », l'ardoise est absente. Et sa demande, mot pour mot : « il faudrait un système qui
à la connexion s'assure que tout soit raccordé, avec une modale qui dit que ça travaille
(pour pas qu'on attende dans le vent) et pour qu'on puisse travailler ensuite. »

### Ce n'était pas la lenteur, c'était une course perdue

Les journaux Supabase disaient pourtant que le repère marchait : 316 requêtes à 10 h 01 pour
la synchronisation complète, 74 à 10 h 02, **une seule à 10 h 03**. Le réseau n'était plus le
sujet. Le sujet, c'est que les quatre lectures du bureau partaient **en même temps** au
chargement de la page, alors qu'elles sont toutes filtrées par le bureau courant, rangé dans
`bdv_bureau_v1`. Cette clé est absente à la première ouverture qui suit une connexion :
`chargerBureau()` va la chercher pendant que `BdvCrm.charger()` rend déjà `null`, par
construction, parce qu'il refuse de lire sans savoir quel bureau lire.

### Le défaut qui fait le plus mal : un événement que personne n'écoutait

`bdv:bureau` existe depuis le lot 17. Il est émis par `bdv-compte.js` dès que la clé est
ramenée, et `CLAUDE.md` le décrit noir sur blanc comme « réveille les modules qui n'avaient
rien pu lire ». Mesure du jour : **zéro `addEventListener('bdv:bureau')` dans tout le dépôt.**

Il ne réveillait personne. Le bureau restait donc sur ses trois messages d'échec jusqu'au
rechargement de la page, depuis quatre jours, et personne ne l'avait vu parce que le poste de
développement a toujours sa clé. C'est la même famille que le `min-height` sur un `span` et
que les `env(safe-area-inset-*)` sans `viewport-fit=cover` : **une protection écrite, jamais
exécutée, et que le prochain lecteur croit active.**

### Ce qu'on a écarté : brancher l'événement

C'était la correction évidente, trois lignes. Elle fermait ce cas-là et laissait la classe
entière ouverte : rien n'empêcherait la prochaine zone d'oublier le même événement, et le
défaut ne se voit que chez quelqu'un qui vient de se connecter.

Retenu à la place : **un ordre d'arrivée écrit à un seul endroit.** Le bureau d'abord, puis
ce qui en dépend. Une zone ne peut plus se peindre avant que ce qu'elle lit soit raccordé,
parce qu'on ne la laisse plus essayer.

### Les deux arbitrages de Ted

**La modale paraît à chaque connexion**, pas seulement quand ça dépasse un seuil. Conséquence
qu'il faut assumer : depuis le repère, une ouverture réussie prend deux cents millisecondes,
et un voile plein écran qui apparaît et disparaît dans cet intervalle se lit comme un défaut
d'affichage. D'où un plancher de 450 ms, **la seule attente artificielle du projet**.

**Le voile rend la main au bout de quinze secondes**, toujours. L'autre branche a été pesée :
un voile qui attend le raccordement complet enferme le vigneron dehors de chiffres que son
appareil porte déjà. Un bureau ouvert qui dit ce qui manque vaut mieux qu'un bureau fermé qui
a raison. Ce qui n'a pas répondu continue de tourner : le plafond ferme le voile, il n'annule
rien.

### Le banc a validé 27 contrôles, la capture en a refusé quatre

`npm run banc:amorce` vérifie l'ordre, le plafond, les deux formes d'échec, le cas hors
session, et que `bureau` est bien la première étape de la vraie page construite. Vérifié en
remettant le défaut : passer la boucle en parallèle fait échouer neuf contrôles, inverser la
liste en fait échouer un.

Il a laissé passer quatre choses que `npm run apercu:amorce` a montrées du premier coup :
trois libellés d'écran sans leurs accents, un titre trop petit pour être un titre, **une carte
sans hauteur maximale ni défilement** (cinq étapes plus deux boutons ne tiennent pas dans un
téléphone en paysage, et ce sont les boutons qui rendent la main), et une phrase qui récitait
les cinq étapes quand tout avait raté. **Cinquième fois que la même leçon se paie.**

### Ce qui reste ouvert

- **Rien ne teste l'amorçage sur un vrai navigateur sans clé de bureau.** Le banc simule
  cette situation, il ne la reproduit pas. Le seul vrai essai, c'est une session neuve.
- Les points ouverts de ce matin tiennent toujours : première synchronisation longue,
  `dbAddMany` à deux requêtes par ligne, le calcul côté serveur.

---

## 17/09/2026, matin. Une minute pour ouvrir son bureau : la base n'y était pour rien

Ted a essayé le bureau avec sa base de **facturation**, 171 569 lignes au lieu des 4 939
habituelles. « La base rame assez fort. J'ai genre une minute pour que mon bureau s'ouvre. »

### Ce qu'on a mesuré avant de toucher à quoi que ce soit

Une page de 1 000 lignes sort de Postgres en **4,8 ms**. La base n'est pas lente. Ce sont les
journaux Supabase qui ont donné la réponse, pour **une seule ouverture** du bureau :

| Ce qui part | Nombre | Temps moyen |
|---|---|---|
| Comptage exact des ventes | 1 | 3 400 à 8 100 ms |
| Pages de 1 000 lignes | 174 | 299 ms |
| Préflights CORS | 174 | 1 ms |

Cinquante secondes d'allers-retours, plus le comptage. **La minute était faite de latence
réseau, pas de calcul.** Aucun index ne l'aurait réparée.

### Le défaut le plus cher était le garde-fou lui-même

La règle 9 de `CLAUDE.md` disait « on compte avant de lire » : si l'appareil a autant de lignes
que le compte, on ne télécharge rien. Elle était bonne, et elle ne se déclenchait jamais.
`dbCount()` compte **toute** la base locale, tous bureaux confondus ; `compterVentes()` compte
les lignes d'**un** bureau. Ted appartient à trois bureaux. Les deux nombres ne pouvaient donc
plus coïncider, et le rapatriement complet repartait à chaque ouverture, depuis le lot 17.

**Un garde-fou qui compare deux choses différentes ne se déclenche pas, et il ne se plaint pas
non plus.** C'est la forme de panne la plus chère du dépôt : celle qui marche exactement comme
écrit et ne protège rien. Elle a vécu quatre jours sans que rien ne la signale, parce qu'à
4 939 lignes le rapatriement complet coûte deux secondes et passe pour normal.

### Ce qu'on a fait, et ce qu'on a écarté

**Retenu : un repère de synchronisation.** Le module retient la date de mise à jour la plus
récente qu'il ait reçue, par bureau, et ne redemande que ce qui est plus récent. Rien de neuf,
c'est **une requête pour toute l'ouverture au lieu de 174**.

**Écarté : remonter le calcul côté serveur.** C'est l'architecture juste à terme, le navigateur
n'ayant rien à faire de 81 Mo de lignes brutes pour afficher huit chiffres. C'est aussi un
chantier de plusieurs sessions qui touche les cinq écrans de vente. Ted a choisi les gains
rapides d'abord. **À rouvrir**, et la mesure qui le justifiera est déjà là : 81 Mo de `brut`
traversent le réseau pour une ardoise qui affiche quatre nombres.

**Écarté aussi : monter le plafond de lignes par requête.** Le réglage existe (API settings,
Max rows) et diviserait par dix les allers-retours. Il ne sert plus à grand-chose une fois
qu'on ne redemande que le neuf, et il ne se voit dans aucun fichier du dépôt : un réglage
invisible qui change le comportement du produit est une dette, pas une optimisation. À garder
sous le coude pour la toute première synchronisation d'un gros compte, qui reste longue.

### Les quatre pièges du repère, et pourquoi chacun a coûté une décision

1. **L'horloge.** `maj_le` était posée par le **navigateur**. Une machine qui avance de dix
   minutes aurait posé un repère dans le futur, et toutes les lignes écrites derrière seraient
   restées invisibles à cet appareil **pour toujours**. Le serveur la pose maintenant, par un
   déclencheur et pas par un simple défaut de colonne : un navigateur qui tourne encore sur une
   version en cache continue d'envoyer la colonne, et un `default` ne s'applique pas dans ce
   cas. `supabase/lot21-repere-synchronisation.sql`.
2. **Le réimport.** La date ne bouge que si `brut` a vraiment changé. Sans ça, réimporter deux
   fois le même export redatait les 171 569 lignes et l'ouverture suivante les faisait toutes
   redescendre : la minute supprimée, ramenée par la porte de derrière.
3. **La borne large.** Un lot d'import écrit ses 500 lignes dans une transaction, donc toutes
   portent la même date à la milliseconde. Une borne stricte (`gt.`) saute la fin du groupe dès
   qu'une page tombe au milieu. C'est `gte.` plus une marge de cinq minutes, et quelques lignes
   déjà connues qui reviennent, ce qui ne coûte rien.
4. **La poussée.** Elle recale le repère, sinon l'import d'un gros export le ferait
   entièrement redescendre à l'ouverture suivante. Mais **seulement si un tirage a abouti dans
   la session** : avancer sans avoir lu sauterait les lignes qu'un autre poste du bureau aurait
   déposées entre-temps. Sans tirage préalable, on ne touche à rien. Ça coûte un rapatriement
   de trop, et c'est le bon côté où se tromper.

### L'autre moitié : une politique de sécurité appelée 171 569 fois

Cause indépendante, trouvée en lisant le plan d'exécution. La politique de lecture était
`using (est_membre(bureau))`. La fonction est bien `stable`, mais elle prend une **colonne** en
argument : Postgres ne peut pas la sortir de la boucle et l'appelle **une fois par ligne**.

| | avant | après |
|---|---|---|
| comptage exact | 2 487 ms | 236 ms |
| blocs lus | 343 467 | 192 |
| page de 1 000 lignes | 43,7 ms | 4,8 ms |

La forme qui marche compare la colonne à un ensemble calculé une fois
(`bureau in (select ... where personne = (select auth.uid()))`). **Aucun banc, aucun écran,
aucun journal ne signale une politique qui coûte cher** : ça ne se voit que dans le plan
d'exécution, et seulement si on pense à le regarder sous le vrai rôle `authenticated`.

### Ce qui reste ouvert

- **La première synchronisation d'un gros compte reste longue** : 172 allers-retours, une fois.
  Le repère ne sert qu'à partir de la deuxième ouverture.
- **`dbAddMany` fait deux requêtes IndexedDB par ligne, l'une après l'autre**, soit 343 000
  requêtes en file indienne pour la base de Ted. Ça ne se paie qu'à l'import, mais ça se paie.
- **Le calcul côté serveur**, voir plus haut.
- **Les autres tables portent la même forme de politique** que `ventes`. Elles tiennent en
  vingt lignes et n'ont donc rien coûté jusqu'ici. À reprendre le jour où l'une d'elles grossit.

---

## 15/09/2026, après-midi. La place perdue sur iPhone : ce n'était pas une marge, c'était une pile

Ted, après ses essais sur téléphone : « y'a pas mal de place perdue quand t'es en iPhone,
les marges sont assez grosses. Il faut peut-être réagencer la façon d'afficher. »

### Ce qu'on a mesuré avant de toucher à quoi que ce soit

La passe responsive du 11/09 avait traité ce qui DÉBORDE : cibles tactiles, barre des
pièces, grille du mois. Le cadre, lui, ne déborde pas. Il rétrécit, et un banc qui mesure
les débordements dit OK.

Un deuxième relevé a donc été écrit, `mesure-marges.mjs` : pour l'élément de texte le plus
profond de chaque pièce, il remonte jusqu'au corps de page et additionne remplissage,
bordure et marge à chaque étage. À 390 px, avant :

| pièce | avalé | part de l'écran |
|---|---|---|
| Ma journée | 103 px | 26 % |
| Mes tâches | 82 px | 21 % |
| Le calendrier | 167 px | 43 % |
| Mon commerce | 157 px | 40 % |
| Mes cuvées | 198 px | 51 % |
| Mon cap | 198 px | 51 % |
| Mon registre | 156 px | 40 % |

**Aucun étage n'était gros tout seul. C'est leur somme qui coûtait**, et personne ne la voit
en relisant une règle. Les quatre pièces de vente empilaient un étage de plus que les
autres, et deux d'entre elles une carte DANS une carte : 80 px, un cinquième de l'écran,
pour dessiner deux fois le même bord blanc sur blanc.

### Lot 1, le cadre, sous 700 px, pour les neuf pièces

Trois coupes, toutes sur les étages EXTÉRIEURS, jamais sur celui qui tient le texte :
l'atelier passe de 24 à 10 px de côtés, la zone de contenu des écrans de vente de 26 à
10, et la carte intérieure d'une carte perd ses côtés et garde sa hauteur. La zone n'est
pas touchée, elle était déjà passée à 16 px le 11/09.

Après : 76 / 55 / 140 / 93 / 93 / 93 / 92 px. **Les quatre pièces de vente passent de 40-51 %
à 24 %.** Aucune page ne déborde, aucune cible ne descend, zéro erreur JavaScript.

### Lot 2, le panneau perd son liège sous 700 px

Arbitrage de Ted. Le liège et le papier sont deux cadres de plus qui ne portent aucune
information : ils coûtaient 44 px de côtés pour dire « ceci est un panneau », ce que le
titre de la zone dit déjà en toutes lettres. Et la grille à deux colonnes étirait les
punaises à hauteur égale, avec une case de liège nu quand la rangée était incomplète.

Sous 700 px une punaise devient une ligne : tampon à gauche, les deux gestes à droite sur
la même ligne, titre et ligne manuscrite dessous, un filet de séparation. Restent le lien
étendu sur toute la ligne, les gestes à 44 px, et les deux états « en retard » et « fait »
qui gardent leur fond ET gagnent un filet de couleur à gauche, parce qu'un état ne tient
jamais à la seule couleur.

Mesuré sur les trois punaises de la capture de Ted : la zone passe de 477 à 369 px de haut,
le panneau de 364 à 256, et **une punaise de 137 px de large en passe à 335**. « Faire la
commande » tenait sur trois lignes, il tient sur une.

### Deux pièges payés ici, et les deux étaient invisibles à la relecture

1. **`.postit` est en `flex-direction: column` depuis le premier jour.** La règle qui
   remontait les gestes à droite de la première ligne a été écrite sans `flex-direction:
   row` : `order` et `margin-left:auto` fabriquaient une colonne bien rangée, et
   `align-items` centrait tout HORIZONTALEMENT. La règle marchait. Elle ne faisait
   simplement pas ce qu'elle disait, et seule la capture l'a vu.
2. **`align-items: baseline` contre une rangée de 44 px.** Le tampon fait 14 px de haut :
   calé sur la ligne de base, il se collait en haut de la rangée et ouvrait un trou de
   30 px juste avant le titre.

### Deuxième passe, même jour : « on peut encore manger les marges, voire les supprimer »

Le premier jet ne faisait que rétrécir chaque étage. Il en restait trois empilés sur le bureau
et trois sur les écrans de vente, **chacun avec son propre bord**.

**Une seule gouttière, et c'est la zone qui la porte.** Sous 700 px la zone perd ses côtés et
devient une bande pleine largeur : plus de bordure à gauche ni à droite, plus de retrait
d'atelier autour d'elle. Ce qui la délimite reste son filet de couleur en haut, son fond plus
clair que le papier de la page, et l'écart vertical du plan. Même chose pour la carte des
écrans de vente. Sur un téléphone, un cadre de carte de 390 px de large ne fait que répéter le
bord de l'écran.

**10 px et pas zéro, arbitrage de Ted sur capture.** Trois variantes ont été fabriquées et
photographiées côte à côte. Le ras du bord gagne encore 21 px et fait basculer des rangées
entières (les deux dates de « Mes tâches » passent côte à côte, les filtres tiennent à quatre
par rangée), mais le texte courant colle alors au bord de la vitre, et en paysage l'encoche
mange les extrémités. 10 px est le dernier palier où rien ne touche le bord.

**Les retraits de sécurité remplacent le remplissage de l'atelier.** Une zone pleine largeur
sans `env(safe-area-inset-left/right)` passe sous l'encoche en paysage. Même motif que la barre
des pièces, corrigé le 11/09.

| pièce | au départ | après la 1re passe | après la 2e |
|---|---|---|---|
| Ma journée | 26 % | 19 % | **5 %** |
| Mes tâches | 21 % | 14 % | **5 %** |
| Le calendrier | 43 % | 36 % | **20 %** |
| Mon commerce | 40 % | 24 % | **10 %** |
| Mes cuvées | 51 % | 24 % | **10 %** |
| Mon cap | 51 % | 24 % | **10 %** |
| Mon registre | 40 % | 24 % | **9 %** |

Hauteurs de page au passage : Le calendrier 5 415 → 4 638 px, Ma journée 2 110 → 1 881,
Mon cap 3 591 → 3 371.

### Un rabat de 4 px qui faisait déborder la page entière

`.zone--lecture::after` porte `right: -4px` : c'est le rabat qui fait la pile de la zone
« À lire ». Tant que l'atelier posait 24 px autour de la zone, ce dépassement tombait dans la
marge et ne se voyait pas. **Une zone pleine largeur n'a plus de marge où déborder** : la page
de « Ma journée » est passée à 394 px dans une fenêtre de 390.

Et aucun élément ne le signalait, parce qu'un pseudo-élément n'a pas de
`getBoundingClientRect()`. Le banc disait « page 394/390 » sans pouvoir nommer le coupable.
**Troisième fois que ce projet paie la même leçon : on ne change pas la largeur d'un conteneur
sans regarder ce qui dépasse de lui.**

### Le plancher tactile, soldé

**`echeance__ouvrir` passe de 22 à 44 px sans grandir d'un pixel.** Un `min-height` aurait
ajouté 22 px à chacune des quarante cartes du calendrier, soit près de 900 px : reprendre d'une
main ce que la passe sur les marges venait de rendre. C'est donc un rectangle invisible qui
s'étend de 11 px au-dessus et en dessous du texte, le motif de `.postit__lien::after`. Ce qu'il
recouvre a été vérifié : trois textes, aucune cible.

Conséquence : `getBoundingClientRect()` ne voit pas un pseudo-élément, donc le banc l'écarte
nommément, comme `.postit__lien` et pour la même raison.

**`.tache__corps` reçoit un `min-height: 44px`.** Le banc le mesurait à 43 px sur sept tâches :
à un cheveu du plancher, et c'est le hasard du contenu qui décidait de quel côté il tombait.

**Résultat : zéro défaut sur les sept pièces et la fiche client à 390 px.** Aucune page ne
déborde, aucune cible sous 44 px, aucune saisie sous 16 px, aucune erreur JavaScript. C'est la
première fois.

### Deux défauts ANTÉRIEURS, relevés au passage, pas corrigés

- **L'en-tête du bureau fait 434 px sur un écran de 844, soit 51 % du premier écran**, et
  il est au-dessus de CHAQUE pièce. C'est de loin la plus grosse perte verticale du bureau
  sur téléphone, et elle n'est pas dans le périmètre décidé ce jour.

---

## 15/09/2026, 11 h 50. La fonction est en ligne, et elle tourne

`agenda-ics` est deployee, ACTIVE, **vérification de jeton désactivée**. Le piège annoncé
depuis hier est donc fermé.

### Ce qui est prouvé, et comment

Je ne peux tester le flux depuis aucun des deux ateliers : le pare-feu de sortie autorise
npmjs mais **bloque `*.supabase.co`**, côté conteneur comme côté poste (403 sur le CONNECT).
Même famille de mur que l'installation du navigateur de capture, hier.

**La preuve est venue de la base.** Une requête posée depuis le volet navigateur, **sans
en-tête Authorization**, a fait avancer `vu_le` de la ligne d'abonnement. Deux fois, à
quarante secondes d'intervalle, avec deux jetons différents.

Puis le navigateur a déposé le fichier téléchargé dans le dossier du dépôt, et ça a permis
la vraie preuve : **le flux rendu par la fonction déployée est identique, à l'octet, à celui
que le dépôt produit ici.** 67 114 octets, 104 rendez-vous, sha256 `30be308a47358462` des
deux côtés.

**Cette méthode vaut plus que les empreintes, et il faut la retenir.** Une empreinte compare
le dépôt au dépôt : elle ne dit rien du déploiement. Une SORTIE comparée à une sortie
traverse tout le chemin. Le .ics téléchargé posé à côté de ce que rend le banc, et les deux
hachés : trente secondes, et la question est close.

### Une dette, et elle est écrite dans le fichier

Le poste n'a pas de CLI Supabase, et le connecteur ne lit pas de fichiers : il faut lui
redonner le contenu. Les blocs de commentaires ont donc été raccourcis pour tenir. **Le code
et la bibliothèque déployés sont les mêmes ; les commentaires, non.**

Conséquence, et elle est plus légère depuis la comparaison ci-dessus : ce qui diffère est
ce qui ne s'exécute pas. Mais les deux empreintes décrivent toujours le DÉPÔT et le dépôt
seul, et **c'est le déploiement qui doit garantir l'égalité des octets**. Le bloc est
consigné en tête de `supabase/functions/agenda-ics/index.ts`, avec la façon de le solder.

**Et elle se solde facilement** : `npx supabase` tourne sur le poste, vérifié aujourd'hui,
version 2.117.0. Avec un jeton d'accès personnel, un `supabase functions deploy agenda-ics
--no-verify-jwt` depuis `_deploiement/agenda-ics/` envoie les octets exacts, et le bloc
disparaît. La phrase de `joindre-courrier.mjs`, « il n'y a pas de CLI Supabase sur le poste »,
décrivait un choix de septembre, pas une impossibilité.

### Un jeton temporaire vit en base

Posé sur le compte `teddy@solumatic.fr` pour cette vérification, tiré au hasard, 43 signes.
Il est révocable d'un clic dans l'onglet « L'agenda » dès que le site est en ligne. À ne pas
oublier : un jeton d'essai qui reste est un jeton d'essai qui traîne.

`npm run verif` vert, 705 contrôles.

---

## 15/09/2026, suite. L'écran de l'agenda, et la fonction qui n'est pas partie

Ted : « c'est passé ». J'ai vérifié avant d'écrire la suite, et c'est à moitié vrai.

### Ce que la base dit, et ce qu'elle ne dit pas

`public.agenda_abonnement` existe, RLS active, **quatre politiques**, zéro ligne. Le SQL est
passé.

**La fonction `agenda-ics` n'est PAS déployée.** Le projet ne connaît que `courrier-matin` et
`invitation`.

**Et c'est ma faute, pas la sienne.** J'ai écrit hier soir `cd _deploiement/agenda-ics` puis
`supabase functions deploy`. Or l'en-tête de `scripts/joindre-courrier.mjs` le dit noir sur
blanc depuis le 10/09 : « il n'y a pas de CLI Supabase sur le poste : c'est un geste séparé,
fait sciemment ». J'ai lu ce fichier hier pour en copier la convention d'empreinte, et j'ai
recopié la convention sans lire la phrase d'à côté. Le déploiement passe par le tableau de
bord Supabase, ou par le connecteur.

### L'écran, écrit contre du réel

Un onglet « L'agenda » dans le panneau de réglages, à côté du courrier. Quatre gestes :
créer, copier, s'abonner, révoquer.

**Le jeton est tiré par le navigateur**, 32 octets de `crypto.getRandomValues` en base64url,
43 signes. Il n'est **pas** dérivé de l'identifiant du compte : un jeton qui serait un hachage
de `id` laisserait fabriquer l'adresse de n'importe qui à partir d'un identifiant.

**L'adresse de base est en dur et pas `location.origin`**, et c'est une leçon déjà payée par le
courrier du matin le 09/09 : sur une adresse de préversion Vercel, la réécriture
`/agenda/:jeton` n'existe pas. Le lien copié serait mort, l'écran n'afficherait aucune erreur,
et c'est le vigneron qui tomberait dessus trois jours plus tard, dans Google Agenda.

**Deux clics pour révoquer, et pas une fenêtre de confirmation.** Le panneau est déjà une
fenêtre : en empiler une deuxième, c'est le geste qu'on valide sans lire. Le bouton se
réécrit lui-même en « Confirmer : couper l'abonnement partout », et un clic ailleurs dans le
bloc le désarme.

**L'agenda ne passe pas par « Enregistrer ».** Créer et révoquer sont des gestes immédiats,
pas des champs à valider. Les poser dans le formulaire aurait fait d'une révocation l'effet de
bord d'un enregistrement qu'on croyait faire pour changer son prénom.

Et un lien `webcal://` à côté de l'adresse `https` : il ouvre directement la fenêtre
d'abonnement du client de calendrier. L'adresse reste affichée pour le cas, fréquent, où le
clic ne fait rien et où il faut la coller dans « Ajouter par URL ».

### Ce que seule l'image a dit, encore

Il a fallu écrire un harnais pour voir ce panneau : `apercu-panneau.mjs` montre le panneau
des punaises, pas celui des réglages. Les deux états rendus, vide et servi.

**Dans l'état vide, l'écran avertissait des conséquences de révoquer un lien qui n'existait
pas encore.** Trois lignes sur ce qui se passe quand on coupe un abonnement, au-dessus d'un
bouton « Créer ». Un avertissement sans objet apprend à ne pas lire les avertissements. Il est
maintenant lié à l'existence du lien.

`npm run verif` vert, 705 contrôles.

### Il reste un geste, et il n'est pas de moi

Déployer `agenda-ics` **avec la vérification de jeton désactivée**. Sans ça, Supabase exige un
en-tête Authorization, Google Agenda n'en envoie aucun, et le calendrier reste introuvable.

---

## 15/09/2026. Lot E : l'abonnement agenda, et un plan qui se trompait sur son propre coût

Le dos du chantier est écrit, vérifié, et prêt à déployer. Il reste l'écran qui donne le lien.

### Le plan du 08/09 se trompait deux fois, et les deux fois dans le même sens

**« C'est le premier bout de code SERVEUR de ce dépôt. »** Faux depuis le 08/09 :
`courrier-matin` et `invitation` tournent déjà en fonctions Edge, avec la clé de service déjà
posée. Aucun hébergement à choisir, aucun secret à générer.

**« Le vrai coût de ce lot, c'est le calcul. »** Ce coût était déjà payé, pour un autre
fichier. `bdv-courrier.js` se termine par `})(typeof globalThis !== 'undefined' ? globalThis :
this)`, la fonction Deno l'importe puis le lit sur `globalThis`, et `npm run courrier:joindre`
tamponne une empreinte sha256 contrôlée à chaque `npm run verif`. Rendre `bdv-echeances.js`
lisible par Deno a donc coûté **trois lignes** : la première, la dernière, et un garde-fou
`document` dans `depuisLaPage()`. Aucune ligne de calcul n'a bougé.

Un document de décision se périme par le haut, silencieusement. Celui-ci avait une semaine.

### Les trois arbitrages de Ted, 15/09/2026

**1. Le flux ne porte QUE la bibliothèque.** Ni « Mes tâches », ni les rappels clients.
Motif : une URL .ics est un mot de passe déguisé en lien. Google Agenda la garde sur ses
serveurs, elle traîne dans l'historique, elle se recopie dans un mail, et elle ne s'expire
jamais toute seule. Avec ce choix, une URL qui fuite ne livre rien que le site ne publie déjà.
C'est l'arbitrage 3 du 08/09 tenu jusqu'au bout : le calendrier porte des campagnes, le
sous-main porte des clients.

**Le garde-fou est dans le code, pas seulement dans cette phrase.** `FAMILLES_PUBLIQUES` filtre
deux fois, avant le calcul et à la mise en forme, et le banc injecte de force une tâche et un
rappel client pour vérifier qu'ils ne ressortent pas.

**2. Une adresse propre**, `lebureauduvigneron.fr/agenda/<jeton>`, par une réécriture Vercel.
Premier `vercel.json` du dépôt, huit lignes. Motif : le jour où la base change d'hébergeur,
les abonnements déjà posés chez les clients ne cassent pas.

**3. Un flux par personne**, pas par bureau. Clé primaire = identifiant du compte. Un membre
qui quitte un bureau emporte son jeton, on le révoque avec son accès, et les autres ne voient
pas leur abonnement couper.

### Ce qui a été sorti, et pourquoi à cet endroit-là

**`appliquerChoix()` quitte `bdv-calendrier.js` pour `bdv-echeances.js`.** Les douze lignes qui
éteignent et décalent les repères vivaient dans un module d'écran. Le serveur aurait dû les
réécrire, et le jour où un vigneron éteint un repère il aurait disparu de sa grille sans
disparaître de son agenda. Personne n'aurait su lequel des deux avait raison. La fonction prend
désormais `choixDe`, une fonction `cle -> {actif, decale}` : le navigateur passe
`BdvCalchoix.choix`, le serveur passe une fonction adossée aux lignes de `calendrier_choix`, et
aucun des deux ne connaît la forme de stockage de l'autre.

**La mise en forme iCalendar va dans `src/js/bdv-ics.js`, pas dans la fonction Edge.** Motif :
enfermée dans du TypeScript Deno, elle n'aurait été testable que déployée, c'est-à-dire jamais.
`scripts/banc-agenda.mjs` la fait tourner sur les 49 occurrences réelles à chaque
`npm run verif`. **19 contrôles**, dont les trois qui valent le banc :

- **le repliage se compte en OCTETS**, RFC 5545, 75 maximum. « Déclaration récapitulative
  mensuelle » avec ses accents pèse plus que sa longueur. Aucun client ne lève d'erreur sur une
  ligne trop longue : Outlook la tronque au milieu d'un mot. Le banc vérifie en plus qu'aucune
  ligne ne contient de caractère de remplacement, preuve qu'on n'a pas coupé un accent en deux.
- **`DTEND` est exclusif** en journée entière. Une occurrence d'un jour finit le lendemain ;
  écrite égale à `DTSTART`, la moitié des clients ne l'affiche pas du tout.
- **`DTSTAMP` n'est pas l'heure courante.** Avec `new Date()`, deux lectures rendent deux
  fichiers différents et certains clients re-notifient l'utilisateur à chaque synchronisation.
  Il est dérivé de la date de l'occurrence, et le banc vérifie que deux fabrications
  successives rendent le même octet.

### Deux empreintes, et la deuxième est celle qui servira

Le code bouge rarement. **La bibliothèque bouge chaque fois qu'une date est ajoutée ou qu'un
salon est confirmé**, et une fonction déployée avec la bibliothèque de l'an dernier rend un
calendrier faux sans lever la moindre erreur. `npm run agenda:joindre` tamponne donc deux
lignes, contrôlées par `npm run agenda:verif` dans `npm run verif`.

**Et ce garde-fou a servi avant même d'être fini.** En renommant la première marque, le
remplacement est tombé à côté et n'a rien fait, pendant que le script continuait d'afficher
l'empreinte qu'il venait de calculer. Le dossier de déploiement portait un nom de marque et le
script en cherchait un autre. `agenda:verif` l'a dit à la première exécution.

### Un piège qui coûte une soirée à qui ne le connaît pas

**Il faut déployer avec `--no-verify-jwt`.** Par défaut une fonction Edge exige un en-tête
Authorization. Google Agenda n'en envoie aucun : il reçoit 401 et affiche « calendrier
introuvable », sans autre détail. C'est écrit en tête de la fonction, dans le script de
recollage, et dans le message d'échec du contrôle.

Et toutes les erreurs rendent **404** : jeton absent, inconnu ou révoqué, la même réponse. Un
401 sur un jeton inconnu dirait à qui sonde le site « cette adresse existe, continue ».

### Un défaut hors périmètre, corrigé parce qu'il bloquait tout

`npm run verif` était ROUGE en arrivant ce matin, avant toute modification, sur
`banc-bureau.mjs` : « un lien de fiche client ouvre la fiche ». Lancé seul, le banc passait
trois fois sur trois ; dans `npm run verif`, juste après le build, il échouait. La cause est
une attente FIXE de soixante millisecondes, suffisante à froid et pas à chaud.

**Une attente fixe est une course, pas un contrôle.** `repos()` accepte maintenant une
condition et l'attend jusqu'à deux secondes. Sans argument, il garde l'ancien comportement :
un seul appel a changé. Motif de sortir du périmètre : un banc qui crie une fois sur trois sur
du sain finit par ne plus être lu, et ce jour-là on perd aussi les cent-neuf contrôles qui,
eux, disent vrai. Les treize autres `repos()` sans condition restent des courses potentielles,
signalé ici, non corrigé.

### Ce qui reste, et ce qui doit se passer dans l'ordre

1. Le SQL de `supabase/lot12-agenda-abonnement.sql`, à coller dans Supabase.
2. `npm run agenda:joindre`, puis le déploiement de la fonction avec `--no-verify-jwt`.
3. La mise en production Vercel, qui prend le `vercel.json`.
4. **L'écran des réglages**, un onglet « L'agenda » : créer le jeton, montrer l'adresse, la
   copier, la révoquer. Écrit APRÈS, et pas avant : un écran contre une table qui n'existe pas
   et une fonction qui n'est pas déployée ne se teste pas, il se suppose.

`npm run verif` vert, 705 contrôles.

---

## 14/09/2026, tard. Lot D : l'atterrissage, et l'adresse qui ne vieillit pas

La feuille est dans la boîte à outils. Mais le vrai travail de ce lot n'était pas la carte.

### Le défaut qui n'était pas dans le périmètre annoncé

Le Lot D disait « où elle vit ». En écrivant la carte, la question s'est posée autrement :
**quelle adresse y met-on ?**

`/outils/calendrier-2027/` vieillit. Le 1er janvier 2028, cette adresse pointe sur un
calendrier mort. Et elle ne sera pas écrite à un seul endroit : la carte de la boîte à
outils, les données structurées, le lien depuis la page des échéances, une newsletter, et
**l'adresse imprimée en bas de la feuille elle-même**, qui part sur un mur de chai pour un
an. Il faudrait repasser derrière chacun. C'est exactement la retape annuelle que tout ce
chantier existe pour supprimer, remise à l'endroit où on ne la regardait pas.

### Ce qui a été fait : deux adresses, deux publics

- **`/outils/calendrier-AAAA/`** reste l'adresse canonique de chaque feuille. C'est celle
  qu'un moteur indexe, et c'est ce qu'on tape en cherchant « calendrier du vigneron 2027 ».
- **`/outils/calendrier/`** sert **toujours la dernière année** de `src/_data/annees.js`.
  C'est l'adresse des humains : la carte, le lien, la newsletter, le bas de la feuille.

Elle n'est pas canonique, et c'est voulu : deux adresses qui rendent le même HTML, c'est du
contenu dupliqué. Un champ d'entête facultatif `canonique` a été ajouté à `tete-seo.njk`,
troisième du genre après `titre_seo` et `resume`, lu là et nulle part ailleurs. **L'année y
est calculée par `eleventyComputed`, jamais tapée** : l'écrire en dur aurait remis la retape
à l'endroit exact où ce lot la supprime.

Et comme un plan de site ne liste que des adresses canoniques, l'adresse stable en est
sortie (`eleventyExcludeFromCollections`). La page existe, elle ne s'annonce pas.

### Trois fichiers parce que deux pages rendent la même chose

`src/_data/annees.js` porte la liste, **triée**. `src/_includes/components/feuille-annee.njk`
porte le corps de la feuille et son script, sorti du gabarit daté parce que deux gabarits le
rendent maintenant. Deux copies du même HTML auraient divergé, et la divergence se serait vue
sur du papier, chez un client.

### Le contrôle 7, et c'est le réveil annuel de tout le chantier

`banc-annuel.mjs` vérifie deux choses sur cette liste, et les deux cassent en silence :

1. **Elle est triée.** `/outils/calendrier/` sert la DERNIÈRE de la liste. Un nombre posé
   dans le désordre y publierait une année ancienne, et la page se construirait parfaitement.
2. **La dernière année n'est pas derrière nous.** Le jour où elle l'est, l'adresse stable
   distribue un calendrier périmé à tous ceux qui l'ont imprimée. `npm run verif` échoue
   alors, avec la conduite à tenir : confirmer les salons et les vacances scolaires
   (contrôles 1 et 2), ajouter l'année, construire, sortir le PDF.

Et quand la dernière année est l'année en cours, il prévient : la feuille suivante se pose en
octobre-novembre, quand le vigneron sort des vendanges et pose son année.

### Ce que le banc de la boîte à outils a attrapé

`numberOfItems` valait toujours 4 pour cinq cartes. Écrit le 12/09 pour empêcher exactement
ça, il l'a fait du premier coup.

### Un effet de bord à trancher, et il est à Ted

La grille des cartes passe de trois à quatre, et elle est en `auto-fit` : selon la largeur,
Vitisoft se retrouve seul sur une deuxième ligne. Ce n'est pas cassé, et ça se lit même comme
une séparation entre les outils gratuits et celui sur devis. Mais ce n'était pas dessiné
ainsi. Rien n'a été touché à la grille : c'est ta page, et le choix t'appartient.

`npm run verif` vert, 686 contrôles.

---

## 14/09/2026, soir. Lot C : une feuille, l'année entière, et ce que seule l'image a dit

`/outils/calendrier-2027/` existe. Une page du site, et un PDF A3 paysage d'une seule page,
produit en imprimant cette page. Aucun dessin en double.

### L'antériorité, lue avant d'écrire

Le « Calendrier viticole 2025 » de Padawine existait déjà, avec un téléchargement Vitisoft.
Je l'ai lu. **C'est un autre objet et une autre voix** : un guide saisonnier illustré,
couverture d'astronaute générée, emoji à chaque ligne, « Que la Force du Vin soit avec
vous ». Rien à reprendre pour le Bureau, dont la doctrine visuelle est l'imprimé : angle
vif, filet, ombre dure, aucune couleur qui porte seule du sens.

Ce qui vaut d'être noté : **il n'a pas été refait pour 2026.** Le même objet, la même mort
au 31 décembre. C'est la troisième fois cette semaine que le motif apparaît.

### La décision de forme, et elle était mesurable

Le plan disait « la vue année, douze mini-mois ». J'ai commencé par là, puis j'ai arrêté.

**Une grille de 12 x 31 demande une hauteur de ligne FIXE** pour que les mois s'alignent
horizontalement. Or une occurrence porte un titre de quarante caractères. Deux sorties, les
deux mauvaises : la ligne grandit et les colonnes se désalignent, ou elle coupe le titre. Sur
un écran on survole à la souris et le titre revient. **Sur du papier, non.**

Retenu : **douze blocs, un par mois, quatre colonnes sur trois rangs.** Un bloc grandit avec
son contenu, et il porte le NOM des choses, qui est ce qu'on vient lire sur un mur. La grille
de jours reste la vue année du bureau, à l'écran, là où le survol existe.

**Ce qui traverse un mois sans y commencer se lit quand même**, en tête du bloc, en rappel
italique. Sans ça, un vigneron qui regarde février croit son mois vide alors que la taille
court depuis décembre.

### Trois défauts que seule l'image a montrés

Le harnais disait « 53 occurrences, 12 blocs ». Tout allait bien. Puis j'ai regardé le PDF.

1. **Une bande beige de plusieurs centimètres sous la feuille.** `body` porte `--paper`, et
   ce fond se peint sur toute la hauteur de la page imprimée. Invisible à l'écran, invisible
   dans les compteurs. Corrigé dans le `@media print` de `style.css`, **et pas dans le
   script** : un correctif posé dans le harnais ne protège pas le vigneron qui fait
   Fichier > Imprimer depuis son navigateur, et c'est le cas d'usage principal.
2. **Janvier n'avait pas de rappel « en cours ».** Une occurrence commencée l'année d'avant
   voyait sa boucle de rappel démarrer au mois 1 au lieu du mois 0. La taille de la vigne,
   qui court de décembre à mars, disparaissait de janvier. Une parenthèse mal placée.
3. **Des apostrophes échappées** s'écrivaient en clair : « je m\'inscris », « d\'une région à
   l\'autre ». Le contrôle de la charte ne lit pas le texte, le banc ne lit pas le rendu.

### La feuille doit remplir son papier

À l'échelle de l'écran, les douze blocs laissaient un quart d'A3 blanc, et les noms étaient
trop petits pour se lire depuis l'autre bout du chai. Toute l'échelle typographique du site
étant en `rem`, **un seul chiffre dans le bloc d'impression la dilate** : `html { font-size }`.
Mesure : **19 px tient sur une page, 20 px déborde.**

Et parce qu'une mesure qui n'est pas rejouée se périme, `scripts/pdf-calendrier.mjs`
**compte les pages du PDF et refuse d'en écrire un de deux pages.** Une feuille à punaiser ne
se coupe pas en deux. Le comptage se fait sans dépendance, en lisant les objets `/Type /Page`
du fichier.

### Deux choix de rangement qui ne sont pas décoratifs

**Le CSS est allé dans `src/css/style.css` et pas dans une feuille à lui.** Motif : `npm run
charte` n'inspecte que `style.css` et les feuilles liées par la page du bureau. Une
`bdv-calendrier-an.css` n'aurait été contrôlée par personne, et c'est exactement le genre
d'angle mort qu'on découvre deux mois plus tard sur un contraste raté.

**Aucun gabarit nu.** La coque `base.njk` porte la navigation et le pied, donc la feuille est
une VRAIE page du site, indexable, et pas un PDF orphelin. L'impression masque le reste.

### Ce qui reste, et c'est le Lot D

La feuille n'a **qu'un seul lien vers elle**, depuis `/outils/echeances/`. Elle n'a pas de
carte dans `/outils/` ni de page d'atterrissage : c'est le Lot D, et le banc `banc-outils`
impose une forme de carte précise qu'il faut écrire avec soin.

**Ajouter 2028 sera un chiffre** dans `annees:` en tête de `src/outils/calendrier-annee.njk`,
puis `npm run build` et `npm run pdf:calendrier -- --an 2028`. C'est la promesse du chantier,
et elle tient.

### Une limite à dire

`npx playwright install chromium` échoue dans l'atelier Cowork : le téléchargement du
navigateur n'est pas autorisé par le réseau. Le PDF de ce soir a donc été produit ailleurs,
et `playwright` a été retiré des dépendances aussitôt, pour tenir la règle des deux autres
harnais de capture. Sur ta machine, avec du réseau, `npm run pdf:calendrier` marchera.
Et de toute façon le vigneron, lui, fait Cmd+P.

`npm run verif` vert, 677 contrôles, charte CONFORME.

---

## 14/09/2026, suite. Lot B : la sélection vigneron, et deux salons qui étaient faux

Le garde-fou posé le matin a servi le jour même. Trois agents de recherche ont confronté à
leur source chaque date que nous affichions ou voulions afficher.

### Ce que la vérification a trouvé, et c'est le retour sur investissement du Lot A

**Deux salons sur quatre étaient faux d'une semaine.**

| Salon | Ce qu'on affichait | Ce que l'organisateur annonce |
| --- | --- | --- |
| Wine Paris et Vinexpo Paris 2027 | 8 au 10 février | **15 au 17 février** |
| ProWein Düsseldorf 2027 | 14 au 16 mars | **7 au 9 mars** |

Millésime Bio et Vinitech étaient justes. Les quatre portent maintenant `verifieLe` au
14/09/2026, donc le banc les laissera tranquilles jusqu'en septembre 2027.

Wine Paris est le salon le plus fréquenté par les vignerons français. Un vigneron qui
réserve son hôtel sur notre date se déplaçait la mauvaise semaine. **Ces deux lignes
disaient « dates à confirmer » dans leur champ `detail` depuis le 08/09.** Personne ne lit
un champ `detail`.

### La bibliothèque passe de 30 à 49 occurrences

**La règle d'entrée, et elle a fait tout le tri : pas de geste, pas de ligne.** Une date
n'entre que si on sait écrire ce que le vigneron en fait. C'est ce qui nous sépare du Blog
du Modérateur : eux donnent la date, nous donnons le geste.

Entrées, 19 lignes :

- **Temps forts calculés** : Saint-Vincent (22 janvier), Champagne Day (4e vendredi
  d'octobre, Comité Champagne), journée mondiale du malbec (17 avril), journée du sauvignon
  blanc (1er vendredi de mai), journée internationale du grenache (3e vendredi de
  septembre), Vignobles en Scène (3e week-end d'octobre), Journées du patrimoine (3e
  week-end de septembre). **Sept lignes, zéro retape annuelle**, toutes en
  `annuel-jour-semaine` ou `annuel`.
- **Vacances scolaires**, huit lignes, deux années scolaires.
- **Rendez-vous**, quatre lignes : Saint-Vincent tournante de Volnay, Salon des vins de
  Loire, Salon de l'agriculture, Dionysud.

### Trois arbitrages que j'ai pris seul et qui se défont facilement

**1. Les vacances scolaires sont UNE ligne par période, toutes zones confondues**, et pas
trois. Bande large, du premier jour de la zone la plus précoce au dernier de la plus
tardive. Motif : la question du caveau n'est pas « quelle est ma zone », c'est « quand y
a-t-il des familles sur la route ». Trois lignes par période auraient donné quinze lignes
par an pour une information que le vigneron n'utilise pas ainsi.

**2. Les vacances d'été sont écartées.** Une bande de 61 jours ne dit rien que personne ne
sache, et elle écrase la grille de juillet et d'août.

**3. Les salons export sont écartés** (Vinexpo Asia, Vinexpo Americas, tous deux confirmés
pour 2027). Ils sont réels, mais ils s'adressent à une minorité et chaque ligne inutile
enterre la DRM. À rouvrir si Ted le veut.

### Ce que j'ai refusé d'écrire, et pourquoi ça compte

- **La « journée mondiale du vin » n'existe pas.** Trois dates circulent (25 mai, 27
  juillet, 19 mai), aucune n'a d'organisme derrière. L'attribution du 27 juillet à l'OIV
  n'est confirmée nulle part sur le site de l'OIV. Ne pas la remettre.
- **Journée du rosé** : deux dates concurrentes (2e samedi de juin, dernier vendredi de
  juin), origine purement commerciale américaine, aucun ancrage français. Écartée malgré
  son intérêt commercial évident. **C'est l'arbitrage le plus discutable de ce lot**, et il
  appartient à Ted.
- **Chardonnay et merlot** : dates instables ou organisateur introuvable.
- **Cabernet sauvignon** : la règle réelle est « le jeudi précédant le Labor Day
  américain ». Notre moteur ne sait pas l'exprimer, et la coder en date fixe reproduirait
  exactement la faute qu'on vient de corriger sur la fête des mères.
- **Sitevi 2027** : deux agrégateurs annoncent le 30 novembre au 2 décembre 2027, le site
  de l'organisateur ne dit rien. Un agrégateur ne vaut pas confirmation.

### Deux réserves à porter au dossier

**Les vacances scolaires n'ont pas été lues dans le texte primaire.** Légifrance renvoie un
403 aux robots, et la page d'education.gouv.fr publie le calendrier en image. Les dates
viennent de trois sources secondaires concordantes qui citent les arrêtés du 22/10/2025 et
du 21/07/2026. Concordance totale, aucune divergence, mais ce n'est pas la même chose
qu'une lecture du Journal officiel. À revérifier à la main avant la sortie du PDF.

**Contradiction non tranchée sur la foire aux vins.** Notre ligne dit que les référencements
se décident « au printemps ». La recherche dit juillet-août, mais sur une source unique et
faible. Je n'ai rien changé : deux affirmations, aucune solide, c'est à Ted de dire laquelle
est vraie, il connaît des gens qui le savent.

### Le test du bruit, mesuré

C'était le risque du lot : 500 marronniers enterrent la DRM. Mesure sur 2027, occurrences
par mois : 7, 9, 8, 6, 8, 5, 3, 5, 8, 6, 6, 5. **Entre 3 et 9, moyenne 6,3.** Le plan du
Lot 2 disait qu'une grille de mois n'est défendable qu'entre trois et huit choses par mois.
On y est. Juillet à 3 est le mois le plus maigre, et c'est cohérent avec la vie du domaine.

`npm run verif` vert, 677 contrôles.

---

## 14/09/2026. Le calendrier marketing : ce qui se calcule, et ce qui se périme

Ted arrive avec le calendrier marketing 2027 du Blog du Modérateur, 17 pages, environ 500
marronniers, et la question « c'est facilement intégrable ? ».

### La mesure avant la réponse

Le PDF est un calendrier pour community managers de marques grand public, sponsorisé par un
éditeur de jeux concours. Échantillon réel de février et mai 2027 : journée mondiale du
parapluie, Pokémon Day, Star Wars Day, journée mondiale du houmous. Son novembre 2027 ne
contient pas le Beaujolais nouveau. Ce n'est pas un calendrier de filière.

**Mais il a servi de révélateur, et c'est pour ça qu'il compte.** Trois lignes de notre
bibliothèque portaient une date FIXE pour une fête qui n'en a pas, et leur propre champ
`detail` avouait « repère calé sur la date la plus fréquente, à vérifier chaque année ».
En 2027 les trois tombaient à côté :

| Repère | Ce qu'on affichait | La vraie date 2027 |
| --- | --- | --- |
| Fête des mères | 31 mai (un lundi) | dimanche 30 mai |
| Fête des pères | 21 juin | dimanche 20 juin |
| Black Friday | 27 novembre (un samedi) | vendredi 26 novembre |

Un vigneron qui cale sa campagne fête des mères sur un lundi a raté son week-end de vente.

### L'objection de Ted, et pourquoi elle a changé le plan

J'ai commencé par dire que verser ce PDF dans la bibliothèque ressusciterait le problème que
le Lot 2 avait supprimé : une liste de dates qui meurt le 31 décembre. Ted a répondu que la
réécriture annuelle ferait partie du jeu marketing.

**Il a raison sur l'intention et j'avais tort sur la mesure.** Découpe des 500 entrées par ce
qui les fait vivre : date fixe (règle `annuel`, jamais retapée), nième jour de semaine
(nouveau type, jamais retapée), calée sur Pâques (déjà calculée par `bdv-almanach.js`),
lunaire (Meeus, déjà là). Ce qui reste à retaper chaque automne, ce sont les salons, les
cérémonies et les vacances scolaires : une vingtaine à une quarantaine de lignes, pas 500.

**Et c'est l'asymétrie qui vaut le chantier.** Le Blog du Modérateur retape 500 lignes chaque
été pour sortir son PDF. Nous en retaperons trente, et le nôtre se GÉNÉRERA depuis
`src/_data/echeances.json`.

### Ce qui a été livré, Lot A

**1. Le quatrième type de récurrence, `annuel-jour-semaine`.** Mois, jour de semaine en
numérotation ISO (1 = lundi, 7 = dimanche), rang de 1 à 5 ou `"dernier"`. Plus un champ
facultatif `puis`, un décalage en jours appliqué après le calcul, et il existe pour une seule
raison réelle : **le Black Friday n'est pas le quatrième vendredi de novembre**, c'est le
lendemain du quatrième jeudi, et les deux diffèrent quand le 1er novembre tombe un vendredi.

`puis` appartient à la RÈGLE, `decale` appartient au COMPTE du vigneron. Deux champs, deux
propriétaires, et le fichier le dit en toutes lettres pour que personne ne les fusionne.

Les trois dates sont corrigées pour toujours, et le Beaujolais nouveau (troisième jeudi de
novembre) entre dans la bibliothèque. Elle passe de 29 à 30 occurrences.

**2. Le garde-fou d'annualité, `scripts/banc-annuel.mjs`, dans `npm run verif`.**

Le défaut qu'il existe pour attraper : un calendrier ne tombe jamais en panne, il continue
d'afficher des dates fausses avec le même aplomb qu'une DRM. Un champ `detail` qui dit « à
vérifier chaque année » ne réveille personne. Un `npm run verif` rouge, si.

Six contrôles, 20 assertions :

1. Toute ligne `unique` porte `verifieLe`, et cette vérification a moins de douze mois. C'est
   ce qui FORCE la passe annuelle. Les six lignes existantes portent `2026-09-08`, le jour où
   elles ont été écrites. Elles devront donc être confirmées avant septembre 2027.
2. Aucun rendez-vous pourri. **Exception assumée et codée** : une `unique` de la famille
   `obligations` a le droit d'être passée. « Facturation électronique, obligation de recevoir »
   au 01/09/2026 est une date d'entrée en vigueur, elle reste utile pour toujours. Un salon
   passé, non. Sans cette exception, le banc bloquait le déploiement sur une ligne légitime.
3. Les quatre dates mobiles confrontées au calendrier réel sur 2026 à 2029. Ce contrôle vaut
   parce qu'il compare le moteur à des dates vérifiables AILLEURS, pas à lui-même.
4. 5 544 combinaisons année, mois, jour, rang : jamais de débordement sur le mois suivant.
5. Toute ligne du fichier est lisible par le moteur. `lisible()` avale en silence une règle
   mal écrite, et la ligne disparaît du calendrier sans erreur.
6. La fête des mères contre la Pentecôte, quinze ans devant.

**Le calibrage du contrôle 6 mérite d'être lu.** La fête des mères française est le dernier
dimanche de mai SAUF quand ce jour est celui de Pentecôte, où elle bascule au premier
dimanche de juin. Ça dépend de Pâques, que `bdv-echeances.js` ne calcule pas. Ça arrive six
fois en trente-cinq ans, la première en 2034. Deux mauvaises réponses étaient possibles :
l'encoder (coupler deux modules pour un cas tous les six ans), ou l'ignorer. Une troisième
a été retenue : **la détecter, et ne faire ÉCHOUER que si la collision tombe cette année ou
la suivante.** Un banc qui bloque le déploiement pour un problème de 2034 serait désactivé
par le premier qui le croise, et ce jour-là on perdrait aussi les cinq autres contrôles.
Au-delà, il prévient. Il prévient donc aujourd'hui pour 2034 et 2039.

### L'arbitrage 2 de PLAN_calendrier.md est amendé

Il disait « l'abonnement vivant, PAS le fichier téléchargé ». Ted a tranché l'inverse : les
deux coexistent. Le PDF est un objet marketing, il se range sur le mur du chai et ne se met
jamais à jour. L'abonnement `.ics` est un outil, il suit les corrections et demande un compte.
**Le danger que l'arbitrage doit continuer de tenir** : que le PDF soit si complet qu'il
retire toute raison d'ouvrir un compte. Le PDF MONTRE l'année, le bureau seul permet d'agir
dessus.

**La capture d'adresses n'est pas dans ce chantier**, Ted : « on pourra pécho des mails avec
ça plus tard, mais c'est un autre chantier. » Le PDF se téléchargera librement. Motif :
`consent_news` est déjà une case cochée qui ne promet rien à personne (vérification du
10/09/2026). Une deuxième collecte sans programme d'envoi derrière serait la même faute en
plus gros.

### Ce que le banc réclame déjà, et qui n'est pas fait

- `vinitech-2026` se termine dans 80 jours. Poser l'édition suivante AVANT, pas après.
- Les quatre salons portent « dates à confirmer » et n'ont jamais été confrontés au site de
  l'organisateur. Le banc l'exigera avant septembre 2027.

### Les lots qui restent, décidés avec Ted le 14/09/2026

- **Lot B**, la sélection vigneron. Le vrai coût, et ce n'est pas du code. La famille
  `tempsforts` passe de 7 lignes à une quarantaine. **La règle d'entrée fait tout le tri :
  une ligne n'entre que si on sait écrire le GESTE du vigneron.** « Journée mondiale du
  parapluie » n'a pas de geste. C'est aussi ce qui nous sépare du Blog du Modérateur : eux
  donnent la date, nous donnons ce qu'on en fait. Manquent aussi les vacances scolaires par
  zone (source education.gouv.fr, jamais le PDF), le Salon de l'agriculture, la Saint-Vincent
  tournante.
- **Lot C**, le téléchargeable, généré. Une page `/outils/calendrier-2027/` construite par
  Eleventy depuis le fichier de données, avec sa feuille d'impression, et le PDF est cette
  page imprimée par Playwright, exactement le motif de `scripts/capture-telephone.mjs`. Rien
  n'est redessiné.
- **Lot D**, l'atterrissage, sans formulaire.
- **Lot E**, l'abonnement `.ics`, l'ancien Lot 4, inchangé et après.

### Sur la reprise du PDF du Blog du Modérateur

Signalé à Ted, non tranché par moi : les dates prises une par une sont des faits que personne
ne possède, mais la SÉLECTION et l'agencement sont le travail éditorial de HelloWork. Tant
que le PDF sert de déclencheur et de contrôle, rien à dire. Le jour où nous publions notre
propre calendrier annuel, notre sélection doit être la nôtre. De toute façon la leur est
mauvaise pour notre public, donc l'intérêt commercial et la prudence vont dans le même sens.

---

## 14/09/2026, audit. Le lien d'invitation ne marchait pas sans compte

Ted : « audit la fonction maintenant et améliore si ça mérite d'être amélioré / patché ou
nettoyé. »

### Le défaut qui comptait, et il n'était pas dans la fonction

Le lien envoyé par mail s'adresse, dans le cas le plus fréquent, à quelqu'un qui **n'a pas de
compte**. C'était la demande de Ted du 14/09 au matin, mot pour mot. Ce parcours était mort, pour
**deux causes indépendantes, dans deux fichiers sans rapport** :

1. `#invitationBandeau` vivait dans `#bureauContenu`, qui porte `hidden` tant qu'il n'y a pas de
   session. Le bandeau était rempli, puis démasqué, à l'intérieur d'un parent éteint. `hidden` sur
   un ancêtre suffit à tout éteindre : le démasquer ne sert à rien.
2. `invitationEventuelle()` était la dernière ligne de `BdvNav.monter()`, que `/mon-bureau/`
   n'appelle **que** si une session existe : le script de la page sort par un `return` avant son
   `DOMContentLoaded` quand personne n'est connecté. Le module de l'invitation n'était donc jamais
   chargé.

Aucun banc ne pouvait les voir : la cause est dans un gabarit, l'effet dans un module chargé à la
demande, et les deux fichiers ne se citent pas. Seul un banc qui ouvre la **page construite** sans
session les attrape. `banc-invitation.mjs`, 17 contrôles, vérifié en réinstallant chacune des deux
causes séparément (2 puis 1 contrôle tombent).

Le bandeau est maintenant frère des deux états de la page et enfant d'aucun, et
`invitationEventuelle()` part à l'initialisation du module, indépendamment de la barre.

### La fonction serveur, quatre corrections

Aucune ne change ce qu'elle fait. Elles changent ce qu'elle raconte quand ça se passe mal, et ce
qu'elle laisse passer.

**Le nom du bureau partait brut dans le sujet du mail.** `bureaux.nom` est du `text` sans
contrainte, et un maître le change par un simple `PATCH` : il peut porter des retours à la ligne.
Un retour à la ligne dans un en-tête, c'est l'injection d'en-tête SMTP. Compter sur Resend pour
nettoyer nos entrées serait exactement l'erreur que le projet refuse ailleurs. Un `propre()` coupe
les caractères de contrôle et borne la longueur. `esc()` continue son travail à l'affichage : les
deux ne protègent pas de la même chose.

**Deux lectures sont devenues une.** La fonction lisait `/bureaux` puis `/profils`, cette dernière
**sans filtre sur l'identifiant** : elle ne rendait la bonne fiche que parce que la politique de
sécurité l'y oblige. Une sécurité qui tient parce qu'une politique voisine est bien écrite est une
sécurité qu'on casse sans s'en apercevoir. `invitation_apercu` rend les mêmes champs en un appel,
et c'est **la même source que le bandeau d'arrivée** : le mail et l'écran ne peuvent plus se
contredire.

**Le refus de Resend n'était pas lu.** « Resend a refusé (403) » n'apprend rien à personne ; le
corps de la réponse dit « domain is not verified » ou « you can only send to your own address in
test mode ». C'était la panne la plus probable de tout le dispositif, et elle était invisible des
deux côtés : rien à l'écran, rien au journal, puisque la fonction n'écrivait aucune ligne de
journal. Elle en écrit maintenant, et **jamais le jeton ni le lien qui le contient** : un journal
se relit, se copie dans un ticket, et survit à l'invitation.

**Quinze secondes de limite sur l'envoi.** Sans elle, un Resend qui ne répond pas tient la
fonction jusqu'à la coupure de la plateforme, et le maître reste devant un bouton qui tourne alors
que son invitation existe déjà.

### Deux gestes d'écran

**Le bouton ne se cliquait pas deux fois, mais rien ne l'en empêchait.** Deux clics, ou un clic
d'impatience sur un réseau de cave, et `inviter` partait deux fois : la base crée deux invitations,
la seconde efface la première, **deux mails partent**, et l'invité reçoit deux liens dont le
premier répond « ce lien n'est pas valable ». Les deux comptent dans le plafond de vingt par jour.
Le verrou est dans l'écran et pas dans la base : c'est un geste, pas une règle de droit.

**« Créer le lien » est devenu « Envoyer l'invitation ».** Depuis le lot 20 ce bouton envoie un
mail. Un libellé qui annonce un lien à copier fait attendre un lien, et celui qui ne le voit pas
venir croit que le geste a raté, alors que l'invitation est partie. Le lien reste affiché, mais
seulement dans le cas où le mail n'est pas parti.

### Ce qui a été regardé et laissé tel quel

- `Access-Control-Allow-Origin: *` : la fonction exige un jeton de session valide, et un site tiers
  ne peut pas lire le stockage de lebureauduvigneron.fr. Restreindre casserait les déploiements de
  préversion pour un gain nul.
- Le plafond compte les invitations **créées**, pas envoyées : vingt échecs d'envoi bloquent la
  journée. C'est le bon sens pour un anti-relais, et le cas ne se produit que si Resend est cassé.
- Le jeton revient au navigateur quand l'envoi a échoué. C'est voulu : l'invitation existe en base
  et vaut sept jours, la perdre parce que Resend a toussé serait perdre le geste entier.

---

## 14/09/2026, suite. Travailler à plusieurs : les lots 21 à 23

Ted : « oui, et tu fais les choses bien sans t'arrêter, mais tu peux les séparer en lots.
ne t'arrête pas. »

### Lot 21. Changer de bureau jetait le travail non envoyé

`changerDeBureau()` vide le poste, et c'est indispensable : ce navigateur porte les lignes de
vente du bureau qu'on quitte, entrer dans un autre sans rien jeter mélangerait deux ardoises.
Mais le vidage emportait **aussi** les files de ce qui a été noté sans réseau et pas encore
envoyé. Quelqu'un note trois tâches dans un rang, revient, bascule : les trois disparaissent,
sans un mot et sans une erreur. Défaut introduit le 13/09 avec la bascule, trouvé le 14.

Deux gardes, et le second est celui qui compte. Chaque pièce qui tient une file s'annonce par
`avantDeQuitterLeBureau()`, et on lui demande de la vider avant de toucher à quoi que ce soit.
Puis on **relit** le stockage : s'il reste quelque chose, la bascule n'a pas lieu. Pas de base
modifiée, pas de poste vidé, un message.

La détection est **par suffixe** (`bdv_*_attente`) et pas par liste nommée, comme
`oublierCetAppareil()` efface par préfixe : la prochaine file ajoutée ailleurs sera couverte
sans que personne y pense. Une liste se périme, un suffixe non.

Le compte se fait **avant** `majProfil`. Dans l'autre ordre, un refus laisserait le compte sur
le nouveau bureau et le navigateur sur l'ancien, c'est-à-dire le pire des deux états.

### Lot 22. Renommer le bureau

Le nom se changeait nulle part. Bloc « Le nom de ce bureau » dans la pièce L'équipe, visible du
maître seul, `PATCH` avec `return=representation` pour que le refus se voie plutôt que de
passer pour un succès, et la barre du haut se met à jour sans attendre le rechargement.

### Lot 23. On sait qui a écrit, et on se tait quand c'est inutile

`cree_par` est posé sur chaque ligne depuis le lot 17 et n'était affiché nulle part. Avec la
règle arbitrée le 13/09 — chacun n'écrit que ses propres lignes, maître compris — ça donnait le
pire des deux mondes : Romane pose un rappel, on essaie de le corriger, la base refuse, et rien
à l'écran ne dit que ce rappel est le sien. **Un refus sans auteur est une panne ; un refus avec
l'auteur est une règle.**

Ce qui est difficile ici n'est pas d'afficher un nom, c'est de **se taire**. Trois silences :

1. Un bureau **seul** ne nomme personne. C'est presque tous les comptes : leur coller leur
   propre nom sur chacune de leurs lignes serait du bruit pur.
2. **Mes** lignes ne portent pas **mon** nom, même à plusieurs. Une ligne sans nom veut dire
   « de moi », et les seuls noms affichés sont ceux qui expliqueront un refus.
3. Un identifiant inconnu dit « ancien membre », jamais un uuid. Deux cas y tombent et disent
   la même chose au vigneron : quelqu'un retiré du bureau, et un compte supprimé.

La liste des gens se lit par `rpc/equipe` et **pas** par `profils`, dont la politique est
`auth.uid() = id` : personne ne lit la fiche de son collègue, et c'est volontaire, elle porte
`jeton_emails`. Une relecture par jour, la copie périmée servie tout de suite (un nom d'un jour
de retard vaut mieux qu'un écran qui attend), et une relecture forcée dès que la pièce L'équipe
change la composition du bureau.

Deux pièges de stockage, tous les deux déjà payés ailleurs dans ce projet : la clé de cache
porte **son** bureau, sinon elle servirait les noms de l'autre après une bascule ; et elle ne
finit **pas** par `_attente`, sinon `filesEnAttente()` la compterait comme du travail à envoyer
et refuserait toute bascule pour une copie de ce que la base sait déjà. Les lots 21 et 23 se
seraient cassés l'un l'autre en silence.

Aucun pronom de genre dans les phrases de refus : « elle seule peut la modifier » obligerait à
connaître le genre de chacun, que la base ne porte pas et n'a pas à porter. « Seul son auteur »
ne pose pas la question. Et `mentionAuteur()` fait l'élision une fois pour tous les écrans —
« de Romane » se dit, « de ancien membre » ne se dit pas — sinon la correction serait juste à un
endroit et fausse au suivant.

### Deux défauts trouvés en chemin, tous les deux antérieurs

**bdv-crm.js lisait trois tables sans filtre de bureau** depuis le lot 17 : `reglages`,
`suivi_clients` et `echanges`. La sécurité par ligne disait ce qu'on a le droit de lire, elle ne
dit pas ce qu'on doit lire : quelqu'un membre de deux bureaux voyait les deux mélangés sur la
fiche client et dans le courrier du matin. Même leçon que pour `tirerVentes()` le 13/09.

**Sur téléphone, le fil de la fiche client s'écrivait un mot par ligne.** La grille passe à deux
colonnes sous 640 px et seule l'heure était renvoyée en colonne 2 : le texte retombait en
colonne 1, large de 20 px. Présent depuis que ce media existe, jamais vu parce que personne
n'avait regardé le fil d'un client à 400 px. C'est exactement la raison pour laquelle les
aperçus existent depuis le 13/09.

### Ce que ça laisse ouvert

- Le courrier du matin n'est toujours pas réglable par personne **et par bureau** : la
  préférence est celle du compte, où qu'il travaille.
- Les invitations expirées ne sont jamais purgées.
- Vider la base d'un bureau partagé ne laisse aucune trace de qui l'a fait.

---

## 14/09/2026. Le mot du jour écrivait du HTML en toutes lettres

Ted : « le mot du jour ne se comporte pas bien. Tu devrais regarder les liens et variables,
plus design et bouton suivant. »

### Ce qui a été corrigé, lot 1 : la plomberie

**Les deux phrases du conseil arrivent en HTML, et la zone les écrit en texte.**
`diagnosticSignals()` écrit ses renvois en gras, « la liste est dans `<b>Mon commerce</b>` », et
passe les noms de clients par `esc()`. Peintes avec `textContent`, ces deux précautions se
retournent : le vigneron lisait les balises en clair, et « Chapelle &amp;amp; Fils » à la place du
nom de son client. Un `texteDuConseil()` déshabille maintenant les deux phrases, dans cet ordre :
balises d'abord, entités ensuite.

L'ordre n'est pas une commodité. Dans l'autre sens, un `&amp;lt;b&amp;gt;` volontairement échappé
deviendrait une vraie balise puis disparaîtrait, au lieu de s'afficher comme le texte qu'il est.

**Ce qui a été écarté :** passer par l'`innerHTML` d'un élément jetable, qui fait les deux d'un
coup en trois lignes. Ce serait rouvrir une porte d'injection sur du texte qui traverse la base,
pour économiser dix lignes de décodage.

**`sansBalise()` de `bdv-courrier.js` n'a PAS été appelée**, et la copie est assumée : ce fichier
n'est pas chargé au bureau, il part au déploiement de `courrier-matin` avec une empreinte, et il
lui manque de toute façon le décodage des entités. Voir le point ouvert plus bas.

**Le mot du jour ne savait pas se cacher sans Vitisoft.** La zone est née après le défaut du
08/09 et n'avait jamais été branchée sur la réponse du profil : l'ardoise et le sous-main
s'en allaient, un conseil sur le chiffre d'affaires restait affiché. `peindreMot()` entre dans
la liste de repeinture de `peindreIdentite()`, et porte son propre garde `SANS_VITI`, comme
l'ardoise. Elle rend aussi son contenu au lieu de le garder en réserve.

### La leçon de méthode, et c'est la vraie

**La fixture du banc portait UN conseil, propre, en sévérité 2.** C'est-à-dire exactement l'état
dans lequel aucun des défauts ne se déclenche : pas de balise, pas d'entité, pas de rotation
sollicitée. Vingt-deux contrôles verts sur une zone cassée, et c'est Ted qui l'a vue.

Elle porte maintenant quatre conseils copiés sur ce que `diagnosticSignals()` produit vraiment,
dont deux graves, une balise `<b>` et une esperluette. La règle du 08/09 se répète donc une
troisième fois : **un jeu d'essai plus sage que la réalité ne vérifie que ce qu'il contient.**

Section 6 de `npm run banc:journee`, écrite en négatif : elle n'attrape pas les deux cas du jour,
elle refuse toute balise et toute entité dans la zone. Plus six contrôles sur la fonction
elle-même, exposée en `window.bdvTexteDuConseil`, parce que lire la zone peinte ne prouve que ce
que la fixture contient. **Les trois contrôles ont été vérifiés en remettant le défaut**, comme
le veut la règle du dépôt.

Un piège en l'écrivant : le contrôle d'entité sur la zone peinte ne pouvait pas échouer, parce
qu'avec un conseil grave en tête le conseil qui porte l'esperluette n'est jamais atteint. Et on ne
peut pas le viser par la rotation, calée sur le jour de l'année : le contrôle échouerait un jour
sur quatre. D'où un second montage, avec une liste d'UN conseil, qui force l'index à zéro.

`npm run verif` : deux CONFORME, onze bancs, zéro échec.

### Lot 2 : le bouton, le lien, le signe, la voix

**« Les conseils graves ne tournent pas » avait été appliqué au sens fort.** `i` valait 0 dès
qu'un conseil était grave, `MOT_I` s'incrémentait dans le vide, et l'étiquette restait figée
sur « 1 sur 2 ». Le bouton marchait donc les jours où il ne sert à rien.

Ce qui ne doit pas tourner, c'est la rotation AUTOMATIQUE du jour : un décrochage à 8 000 €
reste en tête tant qu'il est vrai. Un clic est un geste, pas une rotation. Seul le point de
départ change désormais, zéro quand un conseil est grave et le jour de l'année sinon, et le
geste s'ajoute par-dessus dans les deux cas.

**Et la liste était amputée.** Elle se réduisait aux seuls conseils graves dès qu'il y en
avait un : le vigneron lisait « 1 sur 2 » alors que le tableau de bord en avait déposé quatre,
et les deux autres étaient inatteignables. Les conseils arrivent déjà triés par gravité puis
par euros en jeu, donc un grave est en tête sans qu'on ait rien à filtrer ici.

**Le conseil mène quelque part.** `diagnosticSignals()` pose maintenant une `cible` sur chaque
signal, l'identifiant d'une pièce de la barre et jamais une adresse écrite en dur. Le champ est
ADDITIF, aucun texte ne bouge, donc le courrier du matin n'est pas concerné. Un dépôt antérieur
n'a pas de cible : le conseil s'affiche alors sans lien, ce qui est l'état d'avant, et le
prochain import comble le trou.

C'est le VERDICT qui porte le lien, avec un calque `::after` sur la carte, comme les cartes de
la page des outils. La carte entière en `<a>` donnerait un nom accessible fait des deux
phrases. Et le bouton reste dehors de la carte : un élément interactif dans un élément
interactif est interdit par le HTML, et ce projet l'a déjà payé deux fois.

**La gravité ne se dit plus par la seule couleur.** `ico` était transporté depuis le tableau de
bord jusqu'à cette zone et posé nulle part. Il est posé, et un mot hors écran dit la même chose
à qui écoute. Le signe n'est pas coloré : `--warn` et `--danger` ne tiennent pas AA sur ces
papiers, et un glyphe qui se distingue par sa forme n'a pas besoin d'une teinte.

**Deux détails que seul le clavier et l'oreille voient.** La zone porte `aria-live="polite"` :
sans elle, un clic sur le bouton ne produisait rien du tout à la synthèse vocale. Et le bouton
se détruit lui-même en repeignant, donc le focus tombait sur le corps de page : il est reposé
sur le bouton qui vient de naître, et seulement au clic, jamais au premier rendu.

### Ce que la capture a trouvé et que le banc ne pouvait pas dire

**Le lien était posé et invisible.** Encre héritée, pas de soulignement : à l'écran, un
paragraphe comme un autre. Le banc le voyait, la capture montrait un bloc mort. Un lien qu'on
ne voit pas ne vaut pas mieux qu'une phrase qui décrit un chemin. Une flèche le dit maintenant,
cachée à la synthèse vocale puisque le hors écran annonce déjà la destination en mots.

D'où `npm run apercu:mot`, qui monte la vraie page quatre fois, une par gravité, plus le cas à
quatre conseils. Il ne vérifie rien, il MONTRE, donc il n'est pas dans `npm run verif`.
Mesuré à 1 280 px et à 390 px : aucun débordement, et la phrase la plus longue que le tableau
de bord produise tient à côté du signe.

### Ce qui a été signalé et NON corrigé

- **« Active les leviers ci-dessous d'ici la fin d'année »**, dans le conseil « Objectif menacé »
  de `bdv-ecrans.js`. Écrit pour l'écran du tableau de bord, où il y a effectivement des leviers
  en dessous. Dans le bureau il n'y a rien en dessous, et la phrase part aussi dans le courrier
  du matin. Lot 3, à valider séparément pour cette raison.
- **`sansBalise()` de `bdv-courrier.js` retire les balises et ne décode pas les entités.** La
  version TEXTE du courrier du matin écrit donc « Chapelle &amp;amp; Fils ». Non touché : ce fichier
  est joint au déploiement avec une empreinte, et le corriger force un redéploiement de
  `courrier-matin`.
- **Aucune date de fraîcheur sur la zone.** L'ardoise dit « au 21 août », le mot du jour dit
  « 1 sur 2 ». Un conseil calculé sur un export de trois semaines se présente comme le conseil du
  jour, et le courrier a une notion de dépôt périmé que le bureau n'a pas.

## 13/09/2026. Le courrier du matin ne partait plus, et il avait quatre raisons de ne pas partir

Ted, en ouverture : « fais moi un topo sur les regles en place en ce qui concerne les emails
automatiques quotidien ? » Le topo a montre autre chose : **aucune ligne dans `courrier_envois`
depuis le 11/09**. Deux matins sans courrier, sans une erreur nulle part.

### L'ARBITRAGE D'OUVERTURE, ET IL ETAIT DE TED

Le seul symptome visible etait un **504 sur la lecture de `v_courrier`**, ce matin a 8 h 05. Le
reflexe aurait ete de rattraper l'envoi du jour et de regarder ensuite. Ted a dit « va creuser le
504 » d'abord. C'etait le bon ordre : le 504 n'etait pas la cause, il n'etait meme pas la cause du
12/09, et un rattrapage lance tout de suite serait parti avec un mail sans lien de desinscription.

### LES QUATRE CAUSES, EMPILEES, ET CHACUNE MASQUAIT LA SUIVANTE

**1. Une colonne lue et jamais demandee.** `jeton_emails` est entre dans la vue au lot 12 le 11/09,
jamais dans la liste `?select=`, qui datait du lot 3. PostgREST ne rend QUE les colonnes nommees :
la colonne n'arrivait pas `null`, elle n'arrivait pas. Plus de lien de preferences, donc le
garde-fou 3bis refusait tous les comptes, en 200, et le refus tombant AVANT la reservation, le
journal des envois restait vierge. Deux jours de silence pour un mot manquant.

**2. La fabrique deployee avait deux jours de retard.** Trouve par la CAPTURE du mail recu, pas par
le code : le pied disait encore « tu l'as demande dans les reglages de ton bureau », phrase
supprimee le 11/09 par `d7e3596`. `bdv-courrier.js` n'avait pas bouge DANS LE DEPOT, et je lui ai
donc dit de ne pas le redeployer. **L'erreur est de moi** : la copie en production etait plus
vieille que le depot, et rien dans le projet ne le disait.

**3. Le secret `URL_BUREAU` n'avait jamais ete pose.** Le rapport affichait le repli du code,
`lebureauduvigneron.fr`, domaine jamais branche sur Vercel et qui ne sert aucun certificat. Les deux
liens du mail tombaient dans le vide. C'est le defaut du 10/09, jamais referme.

**4. Le 504.** Refus immediat de la passerelle, 30 millisecondes, alors que la requete s'execute en
0,3 ms sur 3 ko de donnees. C'etait la premiere requete REST depuis 22 h 47 la veille, et ce sera le
cas tous les matins : le controle de l'heure sort AVANT la lecture, donc les 23 autres passages ne
reveillent jamais PostgREST.

### LE DIAGNOSTIC QUI A TOUT OUVERT, ET IL NE VENAIT PAS DU CODE

`consent_courrier_le` est date de 10 h 04 le 11/09, **apres** l'envoi de 8 h 05 du meme jour. Donc
la chaine avec consentement et jeton n'avait jamais abouti une seule fois : il n'y avait pas de
regression a chercher, il y avait un chemin qui n'avait jamais marche. **Un envoi reussi la veille
d'un lot ne prouve rien sur le lot.**

### L'ARBITRAGE SUR LA REPRISE

Le lot 4 interdit le rejeu automatique. Decision prise quand meme d'ajouter **deux essais sur la
lecture de la vue**, deux secondes d'ecart, et la frontiere est nette : **la reservation**. Avant
elle, rien n'est pose et rien n'est parti chez Resend, donc aucun doublon n'est possible ; apres
elle, l'interdiction reste entiere. L'une protege un lecteur contre un mail double, l'autre protege
une journee contre un reveil rate. Ne pas etendre la reprise au-dela de ce point.

Le nombre d'essais part dans le rapport, `essais_lecture`. Sans lui, la reprise masquerait en
silence le fait que le premier appel echoue tous les matins, ce qui est exactement le defaut que la
regle 4 existe pour empecher.

### CE QUI A ETE VERIFIE, ET COMMENT

Le nouveau controle de `courrier:verif` a ete valide **en remettant le defaut** : ECHEC, code 1.
Un controle qui n'a jamais echoue ne garde rien.

L'etat final n'a pas ete laisse a demain. La fonction reellement deployee a ete **relue par le pont
MCP Supabase**, elle porte bien `CHAMPS`, `jeton_emails`, la reprise et le pied a jour. Puis un
`?apercu=1` declenche depuis la base, qui n'envoie rien, a rendu `url_bureau` et `url_preferences`
sur `lebureauduvigneron.vercel.app`, `comptes_lus: 2`, `essais_lecture: 1`.

Le rattrapage du jour est parti a 11 h 55, deux mails, mais avec l'ancienne fabrique : sans lien.
**Refus de vider les deux lignes du 13/09 pour en renvoyer une version propre** : Ted a prefere
attendre le 14 plutot que de recevoir deux fois le meme courrier. Le journal des envois n'a donc
jamais ete touche a la main.

### CE QUI RESTE OUVERT

- **Rien ne verifie ce qui TOURNE.** L'empreinte tamponnee dans `index.ts` garantit que le depot est
  coherent avec lui-meme, pas que la production lui ressemble. C'est la cause n° 2, et c'est la
  troisieme fois que ce projet la paie. Le pont MCP sait relire une fonction deployee
  (`get_edge_function`) : de quoi comparer l'empreinte annoncee a celle du fichier en ligne.
- **`URL_BUREAU` pointe sur Vercel, et c'est temporaire.** Au branchement du `.fr`, changer cette
  seule variable. Le repli du code reste l'adresse definitive, pour que ce soit le reglage
  provisoire qui se voie dans les secrets.
- **Le `.fr` n'est toujours pas branche.** Tant que ca dure, tout lien envoye par mail pointe sur
  une adresse Vercel.
- **`&mdash;` dans le pied du mail**, ligne 838 de `bdv-courrier.js`. La regle du depot dit aucun
  tiret cadratin nulle part. Signale, non corrige.
- **`?apercu=1` sort de la boucle AVANT le controle du jeton.** Il n'aurait donc jamais pu detecter
  la cause n° 1, et ne le pourra pas davantage. Trois lignes a deplacer.
- **Le pied du mail est en 10 px.** Son contraste est bon, 6,09:1 mesure, mais Ted n'a pas trouve le
  lien en regardant. A rouvrir avec lui, c'est un arbitrage de dessin.

---

## 12/09/2026, soir. La page d'accueil : le hook, le voile, et l'ordre des sections

Demande de Ted : « on va ameliorer la page d'accueil / landing avec le hook et le design afin de la
rendre vraiment bureau du vigneron. »

### L'ARBITRAGE D'OUVERTURE, ET IL EST ALLE CONTRE LA DEMANDE

Le hook n'etait pas le probleme. Il avait ete repris le 10/09, deux jours plus tot, avec trois
arbitrages ecrits et defendables, et le h1 « On a vu 2 000 bureaux de vignerons de l'interieur »
tient. Ce qui n'allait pas se mesurait ailleurs : **la demonstration du produit commencait a 4,2
ecrans de defilement**, derriere trois articles, un podcast qui n'existe pas, deux partenaires
etales sur trois cartes et un manifeste qui redit le h1. La page vendait un media alors que le
produit est un bureau.

Ted a tranche sur trois questions. Ampleur : hero ET ordre des sections, pas le hero seul. Visuel :
**garder la photo** et mieux la traiter, contre ma recommandation de passer a une surface de papier
dessinee dans les jetons. Sections vides : degonfler le podcast et les partenaires, et les
descendre, plutot que de les sortir de l'accueil.

**Le levier a retester si le resultat decoit** : la photo. C'est une piece de chateau, prise de
face, avec un ecran allume en plein centre. Elle impose un voile directionnel et un texte borne a
gauche pour que le contraste tienne. Un hero en papier, filets et post-it, dans les jetons du site,
n'aurait eu aucune de ces contraintes et aurait dit « bureau du vigneron » sans photographie de
bureau. L'option reste ouverte, et elle est moins chere a tenter maintenant que le reste est propre.

### CE QUI A CHANGE

**L'ordre.** hero, demo-pinboard, manifeste, articles-une, filiere-bande, compteurs, waitlist. La
demonstration passe de 3 802 px a 839 px, de 4,2 ecrans a 0,9. La page passe de 6 077 a 5 775 px.
La regle et le detail sont dans `CLAUDE.md` et en tete de `src/index.njk`.

**Le voile du hero.** Il etait plat a 0,70 sur toute la largeur, et le texte etait centre, donc pose
sur l'ecran allume de la photo : la zone la plus claire de l'image portait le paragraphe et les deux
boutons. Trois jetons remplacent le jeton unique, un par role, et le texte est borne a 600 px a
gauche. Sous 900 px le voile redevient franc, parce que le reglage directionnel repond a un probleme
de largeur qui n'existe pas sur un telephone.

**Le paragraphe du hero.** Il portait cinq idees en quatre lignes pleines. Il en garde deux, d'ou ca
vient et ce que ca fait. La gratuite et la restriction Vitisoft descendent sous les boutons, en
mention : l'arbitrage du 10/09 exigeait qu'elles soient dites HAUT, elles le sont toujours, au-dessus
de la ligne de flottaison.

**Le deuxieme bouton.** « Voir le bureau en image » envoyait a 4,2 ecrans. La demonstration est
maintenant la section suivante : le libelle devient « Voir a quoi il ressemble ↓ ».

**La bande filiere.** `podcast-teaser` et `voix-filiere` pesaient 1 235 px a elles deux, entre le
hook et la preuve, pour annoncer un podcast a venir et deux partenaires reels. Elles fusionnent en
une section de 789 px, placee apres la demonstration. Rien n'est dit de moins : le podcast est
annonce, les deux partenaires sont nommes et cliquables, les six autres sont annonces. Les trois
cartes deviennent trois lignes, parce qu'une grille de cartes annonce un catalogue et qu'il y a deux
partenaires. **Les deux composants d'origine sont gardes dans le depot**, avec leur CSS : le jour ou
l'episode 1 sort, le podcast redevient une vraie section, il ne faudra pas la reecrire.

**L'alternance des fonds.** Le nouvel ordre posait trois `--paper` a la suite puis deux
`--paper-deep` : un ventre clair, un ventre fonce. Le manifeste prend le fond fonce, les compteurs
le rendent. L'alternance redevient stricte : photo, papier, fonce, papier, fonce, papier, bordeaux.

### CE QUI A ETE VERIFIE

`npm run charte` et `charte:bureau` CONFORMES, 0 echec. `npm run banc`, 110 controles, 0 echec.

Et surtout **`scripts/banc-hero.mjs`, ecrit ici**, parce qu'aucun controle existant ne pouvait voir
le defaut de depart : la charte lit des regles CSS, et le contraste d'un texte sur une photo depend
des pixels. Il photographie la page deux fois, une fois telle quelle et une fois le bloc de texte
rendu invisible, et compare chaque texte au pixel de fond **le plus clair** de sa boite. Verdict a
1440 et a 390 px : le pire texte du hero est a 7,41:1, le meilleur a 12,63:1, seuil 4,5:1.

**Le banc a ete verifie a l'envers avant d'etre cru** : voile ramene a 0,08, 12 echecs, code de
sortie 1. Un banc qui n'echoue jamais ne prouve rien.

### DEUX PIEGES DE HARNAIS, PAYES ICI

**`loading="lazy"` et la capture pleine page ne s'entendent pas.** Les deux photos de partenaires
sont sorties vides de trois captures de suite, et j'ai failli les declarer cassees. Elles chargent
parfaitement : une capture `fullPage` ne fait pas entrer les images dans le champ, donc le
navigateur ne les demande jamais. Il faut parcourir la page AVANT de photographier. C'est le meme
genre de faux positif que les trois du banc telephone du 11/09 : un harnais qui ne reproduit pas ce
que fait un visiteur accuse le depot.

**Le bouton plein est un faux positif structurel du banc de contraste.** `.btn` porte son propre
fond `--paper` : son texte bordeaux se lit sur du papier, a 11:1, et pas sur la photo. Mesure contre
la photo, il rend 1,2:1 et un echec qui n'existe pas. Il est ecarte NOMMEMENT, avec sa raison ecrite
dans le banc, et pas silencieusement.

### LE SECOND TOUR : « PAS DE VITISOFT REINVENTE »

Ted, apres la premiere livraison : « j'ai un souci avec le pinboard. il faut que ca reprenne le
detail du bureau, pas de Vitisoft reinvente. »

Il avait raison, et le defaut etait plus gros que remonter la demonstration ne le laissait voir.
**L'etape 03 etait une reproduction du tableau de bord de Vitisoft** : barre de titre « VITISOFT »,
ses sept menus, son donut de familles, ses KPI, sa courbe verte et jaune, VINCA. La page d'accueil
du Bureau du Vigneron faisait donc, en trois clics, la demonstration du logiciel de la maison mere.
Remonter cette section a 0,9 ecran, comme je venais de le faire, ne faisait qu'amplifier l'erreur :
la premiere chose montree apres le hook etait le mauvais produit.

Et le vrai bureau etait la, construit, avec ses sept pieces, son ardoise et son panneau de liege.
On dessinait un ecran qui n'existe pas pendant qu'on avait le vrai sous la main.

**L'etape 03 pose desormais les VRAIS composants** : `.bureau-nav`, `.zone--panneau`, `.postit`,
`.zone--ardoise`, `.chiffre`, `.fiche-l`, `.lettre`. Rien n'est redessine, et rien n'est ajoute en
CSS pour les peindre : leur feuille est deja `src/css/style.css`, que cette page charge. Le
balisage a ete recopie depuis `npm run apercu:ardoise` et `npm run apercu:panneau`, qui montent la
vraie page dans jsdom : la source est le produit, pas mon idee du produit.

**La continuite du liege, et c'est la trouvaille de ce tour.** Le panneau du bureau EST un tableau
de liege avec des punaises, et les jetons le disent depuis toujours (« Le papier a note. Deux
teintes, celles du panneau de la page d'accueil »). Le liege ne disparait donc plus entre les
etapes : il se range, puis il devient l'outil. Les cinq post-it de l'etape 03 reprennent nommement
cinq des huit papiers de l'etape 01, M. Dubreuil, la TVA du 15, les Caves Bertrand, le QR, la cuve
4. Ce n'est plus une transition entre deux images, c'est la meme chose deux fois.

**Trois arbitrages pris seul, a relire s'ils genent.**

1. **L'ardoise reste, avec sa mention.** Elle demande un export Vitisoft, contrairement au panneau
   et a la rangee de lecture. La tentation etait de la retirer pour ne montrer que le gratuit. Elle
   reste parce que c'est un vrai morceau du bureau, et son `zone__note` porte « tes ventes, si tu es
   sur Vitisoft » a la place de sa date. Meme regle que le hero, celle du 10/09.
2. **La carte « VINCA · IA » de l'etape 01 devient « Question en suspens »**, sans reponse. VINCA
   est un produit de Vitisoft, et une question deja repondue n'avait rien a faire dans l'etape qui
   s'appelle « chaos administratif ».
3. **Les 450 lignes de CSS de la maquette sont supprimees, pas commentees.** Une maquette d'un
   produit tiers laissee dans la feuille revient. Elle est dans git, au commit precedent.

**Le libelle du pied renvoyait a une chose disparue.** « Faites defiler · Decouvrez les piliers » :
les piliers sont devenus les rubriques le 10/09, et ce texte designait un objet qui n'existe plus.
C'est le defaut type de `CLAUDE.md`, « quand une piece bouge, relire ce que les textes disent ».
Il dit maintenant ce qui suit vraiment : « Pourquoi ce bureau existe ».

**Ce que la capture a trouve et qu'aucune mesure n'aurait vu** : a 390 px, le bureau entier faisait
1 194 px de contenu dans un cadre de 420, avec la barre des pieces qui sortait par la droite. Le
reduire assez pour tout faire tenir aurait donne des lettres de six pixels. Le telephone ne montre
donc que le panneau, post-it en defilement horizontal.

Controles apres ce tour : charte CONFORME, charte:bureau CONFORME, banc 110/110, banc-hero
CONFORME.

### CE QUI RESTE OUVERT

**La barre de navigation sur telephone.** Signale, pas corrige, hors perimetre. A 390 px les liens
tiennent sur 712 px dans une bande de 342 px en `overflow-x: auto` : la page ne deborde pas, mais
« LA REDACTION » est coupee en « LA RE », et surtout **« Connexion » et « Creer mon compte » sont
entierement hors champ**. Sur une landing, le bouton principal est invisible au telephone, et rien
n'indique que la bande se fait defiler. A trancher : un menu, ou deux liens seulement plus le
bouton.

**Le CSS de `podcast-teaser` et `voix-filiere` reste en place** alors que leurs sections sont sorties
de l'accueil. `filiere-bande` reutilise le lecteur, donc rien n'est mort de ce cote, mais les regles
de cartes de `voix-filiere` ne servent plus a personne tant que les partenaires ne reviennent pas en
grille. A nettoyer le jour ou on tranche que le podcast ne redeviendra pas une section.

**La photo du hero**, voir l'arbitrage plus haut.

---

## 12/09/2026, suite. Une seule police pour tous les chiffres

Demande de Ted, après l'ardoise : « répercute cette police de chiffres sur tous les chiffres du
bureau et du site en entier. »

### IL N'EXISTE PAS DE SÉLECTEUR « UN CHIFFRE »

C'est le premier obstacle, et il décide de tout le reste. Une règle CSS vise un **élément**, pas
les caractères qu'il contient. Or la moitié des endroits où un chiffre apparaît sur ce site sont
des éléments qui mélangent mots et nombres : « 3 rubriques · 19 articles », « Dans 28 jours »,
« 7 min de lecture », « 500 € HT » au milieu d'un paragraphe. Leur changer la police changerait
celle des mots avec.

La liste a donc été **relevée et pas devinée** : un navigateur sur les 37 pages construites plus
les quatre aperçus du bureau, en gardant les éléments dont le **texte propre** est un nombre et
rien d'autre, et en lisant leur police calculée. Lire la feuille de style aurait donné une liste
plausible et fausse, parce qu'on ne voit pas dans le CSS ce que l'élément contient à l'arrivée.

### CE QUE LE RELEVÉ A DONNÉ

Neuf éléments portaient un nombre pur en Fraunces. Deux le portaient déjà dans la police du corps
mais en graisse 800. **Trois traitements pour un seul objet**, et personne ne pouvait s'en rendre
compte parce qu'ils ne sont jamais visibles sur le même écran.

Tous les autres étaient déjà en JetBrains Mono, et **ils y restent**. Ce n'est pas un oubli : le
mono est le registre des références que le courrier du matin s'est donné le 09/09, « le mono porte
les références, pas les montants ». C'est aussi lui qui aligne les colonnes des tableaux de vente,
et les en sortir les casserait. Les dates, les durées, les numéros d'article et les compteurs de
zone en font partie.

### CE QUI EST POSÉ

Un **jeton**, `--font-chiffre`, déclaré dans `style.css` et dans `bdv-ecrans.css`. La décision se
change à un endroit, pas dans les treize règles qui portent un nombre.

Un **bloc unique**, « LES CHIFFRES DU SITE », en bas de `style.css`, qui liste les neuf sélecteurs
et porte le motif en commentaire. Un bloc scopé équivalent dans `bdv-ecrans.css` et
`bdv-panneau.css` pour les écrans de vente, parce que la règle de ces feuilles est que rien n'en
sort.

Deux points de mécanique à ne pas défaire :

- `.score-inline__text .big` est repris **tel quel** dans le bloc, à deux crans de spécificité.
  Une règle à une seule classe ne l'aurait pas battu, et le chiffre serait resté en Fraunces sans
  que rien ne le signale.
- **La punaise est le cas particulier.** `.postit__v` porte tantôt un nombre, tantôt un titre de
  tâche depuis le 10/09. Le dessin le savait déjà : il pose `data-mot` dès que c'est un mot. On
  s'accroche à cet attribut plutôt que d'en inventer un deuxième, sinon la même distinction se
  dirait de deux façons à deux endroits. Vérifié dans les deux sens sur la vraie page : un « 2 »
  sans `data-mot` rend Inter 700 tabulaire, « Ranger le chai » avec `data-mot` reste Fraunces 600.

### DEUX DÉFAUTS TROUVÉS EN CHEMIN

**`npm run apercu:panneau` écrivait depuis des jours une page à ZÉRO punaise, sans se plaindre.**
Le bandeau du bureau lit `BdvCrm.GESTES.ecarte.label` au chargement, et le faux CRM du banc avait
un `GESTES` vide : ce `undefined.label` jetait avant que le panneau ne soit peint. Le script
écrivait quand même son fichier et annonçait « 0 punaise » sur une ligne qu'on ne lisait pas. Un
banc muet est pire qu'un banc absent, parce qu'on croit avoir regardé.

**Inter 700 n'était pas chargé.** Le lien Google demandait 400, 500 et 600. Le 700 de tous ces
chiffres serait tombé à 600, ou en faux gras, dans un vrai navigateur — et mes captures, qui
posaient la police variable complète, ne l'auraient jamais montré. C'est le contrôle 7 de la
charte qui l'a vu, celui qui compare les graisses demandées par le CSS aux graisses chargées par
Google. La graisse est ajoutée au gabarit et aux deux aperçus qui portent leur propre lien.

C'est la deuxième fois de la journée qu'un contrôle automatique attrape quelque chose qu'une
capture ne pouvait pas attraper. La capture voit ce qu'on ne mesure pas, la mesure voit ce qu'on ne
regarde pas, et il faut les deux.

### CE QUI RESTE OUVERT

- **`.dform-card__price` et toute la famille `.score-inline*` sont du CSS mort** : aucun gabarit ne
  les émet. Signalé, pas supprimé.
- **Les compteurs de l'accueil sont le changement le plus visible du lot.** « 3 / 19 / 8 » en
  clamp(3rem, 6vw, 5rem) passent d'un serif éditorial à un sans-serif appuyé. C'est cohérent avec
  le reste, mais c'est un changement de ton sur le premier écran du site : si Ted le regrette,
  c'est une ligne à retirer du bloc, `.compteur-item__nb`, et rien d'autre.

---

## 12/09/2026. L'ardoise, le courrier, et la police des chiffres

Demande de Ted, en trois mots : « améliore : ardoise, courrier, la police des chiffres affichés,
c'est pas bon. » Puis, après la première capture : « c'est le design du courrier qui me va pas,
la lettre est vraiment pas belle. »

### CE QUE LA CAPTURE A VU, ET QU'AUCUN CONTRÔLE NE VOYAIT

Aucun banc ne criait. La charte passait, les 110 contrôles du bureau passaient. Six défauts
n'existaient que sur l'image, et ils ont été trouvés en montant la vraie page dans jsdom avec
un faux CRM, puis en la photographiant avec les **vraies polices variables** du site. Le banc
est `scripts/apercu-ardoise.mjs`, ajouté ici, sur le modèle de `apercu-panneau.mjs`.

Le piège évité, et c'est celui du 08/09 rejoué : les polices de Google ne sont pas joignables
depuis le conteneur. Les charger en version **statique** aurait montré des chiffres qui
n'existent pas sur le site, Fraunces étant servi en variable avec ses axes `opsz` et `wght`.
Les fichiers variables ont donc été récupérés depuis le registre npm et posés en dur dans le
harnais. Une capture de police faite avec la mauvaise instance ne vaut rien.

### L'ARDOISE

**Les quatre chiffres n'étaient pas sur la même ligne.** Base à 71 px du haut de la case pour le
chiffre d'affaires, 58 px pour les trois autres. La cause est structurelle : le chiffre de tête
est en `--t-h2`, les trois autres en `--t-h3`, et quatre colonnes flex n'ont **aucun moyen de se
parler**. L'ardoise partage maintenant trois rangées, étiquette / chiffre / source, et chaque
case les reprend par `subgrid` au lieu d'ouvrir les siennes. Les quatre valeurs sont alors dans
la même rangée de la même grille, et `align-self: baseline` les pose sur une seule ligne
d'écriture quel que soit leur corps.

Le piège du partage : l'écart entre rangées du parent est le **filet de craie**, l'interstice de
la grille. Laissé à `var(--trait)`, il se serait mis à traverser l'ardoise horizontalement entre
l'étiquette et le chiffre, dans les quatre cases à la fois. Il est donc à zéro sur le parent et
remis à 0,2 rem dans chaque case. Sous 640 px le partage est abandonné : une colonne, un chiffre
par rangée, il n'y a plus rien à aligner.

**Le vide sous les cases passe de 16 / 30 / 30 / 30 px à 16 partout.** Les trois petites cases
n'étaient étirées que par la hauteur de la grande.

**Le filet d'or soulignait la CASE.** Mesuré à 36 px sous le chiffre et sur toute la largeur de
la case. Le commentaire du fichier disait pourtant, depuis le premier jour, « sur une ardoise on
souligne ». L'intention écrite et le dessin ne disaient pas la même chose, et personne ne l'avait
vu parce que personne n'avait regardé l'image. Le trait est maintenant porté par le chiffre
lui-même, qui a pour cela une largeur de contenu et non la largeur étirée de sa case.

**Deux règles mortes retirées.** `.zone--ardoise .ardoise` rouvrait la grille en `auto-fit` et
aurait écrasé le partage de rangées. `.chiffre[data-sens]` peignait un `border-left-color` sur un
élément qui porte `border: none` depuis toujours : **la variation du chiffre d'affaires n'était
signalée nulle part**, ni en vert ni en rouge, alors que le JavaScript posait consciencieusement
l'attribut à chaque peinture.

Arbitrage sur le remplacement : pas de couleur. `--ok` tombe à **2,6:1** sur `--ardoise`, sous le
plancher de 3:1 des éléments non textuels, et il n'existe pas de vert clair dans les jetons. Une
flèche ▲ ou ▼ devant la source dit le sens par la forme. C'est de toute façon la bonne règle :
une information portée par la seule couleur n'en est pas une.

### LA POLICE DES CHIFFRES

Cinq variantes montées sur la vraie ardoise et photographiées côte à côte.

- **Forcer `lining-nums` et `tabular-nums` sur Fraunces ne change rien.** Ses chiffres sont déjà
  alignés, les captures A et B étaient identiques. Cette piste, qui était la plus économique,
  est morte.
- **Le mono de JetBrains impose sa chasse** et décolle le symbole euro de deux espaces sur
  « 532 201  € ». On ne peut pas le rattraper sans changer le formateur de montants.
- **Fraunces est un serif de titre à fort contraste.** Sur fond sombre ses déliés s'amincissent
  optiquement et le chiffre perd sa masse. C'est ça que Ted voyait sans le nommer.

Retenu : **Inter 700 en `tabular-nums`**. Les étiquettes et les sources restent en JetBrains Mono,
c'est la même division que dans le courrier du matin, le mono porte les références et pas les
montants qu'on lit d'un coup d'œil. `tabular-nums` n'est pas décoratif ici : d'un passage à
l'autre le chiffre d'affaires change de chiffres sans changer de longueur, et sans chasse fixe il
danserait sous son propre filet d'or.

Écarté : Inter 600, trop discret sur ce fond. Écarté : Fraunces avec `WONK` coupé et `opsz`
bloqué, qui gagne en masse mais reste une lettre de titre.

### LE COURRIER

**Le rabat coupait le titre.** Un triangle de 34 px de haut sur toute la largeur, censé figurer un
rabat d'enveloppe. Le titre de la zone commence à 19 px. Il passait donc dans « Le courrier » et
dans sa note. Et un rabat qui descend au milieu d'une zone de 376 px est trop mou pour se lire
comme un rabat : on voyait une forme beige.

Remplacé par le **bord déchiré**, c'est-à-dire l'enveloppe déjà ouverte, qui est l'état dans lequel
on la regarde. Dix pixels de dents en masque conique répété, donc la dent garde sa taille à toutes
les largeurs de zone, et la bande s'arrête 9 px avant le titre : elle ne peut plus le rencontrer.
`overflow: hidden` est parti avec le triangle, il coupait le halo de focus des liens au ras de la
zone.

**Les trois zones du bas portaient la même ligne.** `.fiche-l` pour « À lire », « Le classeur » et
« Le courrier » : trois matières, un seul objet. Or elles ne répondent pas à la même question.
À lire dit « ce que j'ai mis de côté », le classeur dit « ce que j'ai lu », le courrier dit
**« ce qui est arrivé depuis mon dernier passage »**. Une date est ce qui lui manquait, et c'est
aussi ce qui en fait une lettre plutôt qu'une fiche : sur une lettre on lit d'abord la date.

`.lettre` porte donc la date d'arrivée en mono dans sa propre colonne alignée à droite, comme un
cachet dans la marge, puis le titre, puis le temps de lecture. La colonne évite que trois dates de
longueurs différentes décalent le fer des titres. Le filet est en pointillé et pas en trait plein
comme chez les deux voisines : c'est la perforation, et c'est le seul endroit du bureau qui en
porte. Sous 400 px la date remonte au-dessus du titre, la colonne aurait laissé moins de 200 px au
texte.

**Le `pilier` et ses emojis quittent le courrier.** `src/_data/rubriques.js` dit noir sur blanc,
depuis l'arbitrage du 10/09, que « pilier n'est plus lu par aucun gabarit ». Le bureau l'affichait
encore, avec ses 📈 et ses 🔧 en couleur au milieu d'un dessin de papier et d'encre.

La note de zone dit « depuis le 9 septembre » au lieu de « les 3 derniers », qui ne disait rien
d'autre que le nombre de lignes déjà visibles.

### CE QUI RESTE OUVERT

- ~~« À lire » et « Le classeur » affichent toujours le `pilier` et ses emojis.~~ **Fermé le
  12/09** : Ted a donné son feu vert dans la foulée. Le JSON `bdvContenus` porte maintenant
  `rubrique` au lieu de `pilier`, alimenté par un nouveau filtre `rubriqueNom`. Deux points
  d'arbitrage : c'est le nom de la **rubrique** qui est affiché et pas la `categorie` brute, parce
  que les six catégories se regroupent en quatre rubriques et que ce sont ces quatre-là que le
  vigneron voit déjà dans la navigation de /articles/ ; lui en montrer six ici lui ferait croire à
  deux classements. Et le filtre rend une chaîne et jamais `null`, parce que `rubriqueDe` rend
  `null` quand rien ne correspond et qu'un `null.nom` écrit dans un gabarit fait échouer le build
  entier. Vérifié sur les 19 articles de la collection : quatre rubriques, aucune chaîne vide,
  aucun emoji restant, et aucune ligne de méta sur deux lignes à 1240, 900, 430 ni 360 px.
- **`articles-une.njk` et `articles-recent.njk`, deux composants PUBLICS, affichent toujours le
  `pilier` et ses emojis.** Signalé, pas corrigé : c'est la page d'accueil, et changer ce qu'elle
  montre est une décision de Ted.
- **Les dernières parutions datent de mai.** Le courrier d'un bureau de septembre affiche donc
  « 28 MAI ». C'est honnête et c'est le vrai contenu du site, mais ça dit surtout qu'il n'y a pas
  eu de publication depuis.
- **L'ardoise reste une frise.** 1 126 px de large pour 127 px de haut. La hiérarchie tient
  maintenant à la largeur de la première case et au filet d'or ; si Ted la trouve encore plate, le
  levier suivant est de sortir le chiffre d'affaires de la grille et d'en faire un bloc à part.

---

## 12/09/2026. La modale d'une tâche, et pourquoi elle n'est pas la même pour tout le monde

Demande de Ted : « tu vas ajouter sur la partie tache : une modale qui s'ouvre pour créer la
tache et la visualiser. Quand on clique dessus à partir de la zone des taches, ça ouvre la modale
aussi et permet de la traiter, ou la repousser. »

### CE QUI A ÉTÉ POSÉ AVANT D'ÉCRIRE UNE LIGNE

La zone des tâches n'affiche pas une nature de ligne, elle en affiche **trois**, et elles
n'obéissent pas aux mêmes règles. Une modale uniforme « traiter ou repousser » aurait cassé deux
arbitrages pris cette semaine : une DRM ne se repousse pas, et un client ne s'ouvre que dans sa
fiche. Les quatre choix de Ted, posés avant le code :

1. **La ligne rapide reste**, la modale s'ajoute à côté par « Ajouter en détail… ». On en note
   rarement une seule, et le champ garde le focus après l'ajout. Écarté : remplacer le
   formulaire par un bouton, qui aurait coûté la saisie en rafale.
2. **La modale s'ouvre sur ses tâches et sur les obligations, jamais sur un client.** Une
   obligation s'y ouvre en lecture seule : titre et date viennent du fichier de données, un seul
   geste, « C'est fait », et le renvoi vers ce qu'elle exige. Un client garde « Ouvrir sa fiche »,
   décision du 11/09.
3. **Trois façons de repousser** : demain, dans sept jours, ou une date au choix.
4. **Trois portes** : la ligne de la pièce, la punaise du panneau, et le titre d'une tâche dans la
   vue liste du calendrier.

### LE REFUS EST DANS LA DONNÉE, PAS DANS L'ÉCRAN

`modifier()` et `poserDebut()` refusent une obligation même appelées à la main. Cacher un bouton
n'a jamais empêché un appel : le banc les appelle donc directement sur une DRM et vérifie qu'il ne
part rien vers le serveur. Même motif que le garde-fou de `repousser()` écrit le 10/09.

`modifier()` est neuve, et elle règle un trou : jusqu'ici une tâche mal notée ne se corrigeait
qu'en la retirant et en la réécrivant, ce qui perdait sa date de création et, si elle était
cochée, la preuve qu'elle avait été faite. Les trois règles de dates (une fin sans début devient
le début, deux dates à l'envers se remettent à l'endroit, un jour n'est pas une période) sont
passées dans `normaliserDates()`, écrite une fois pour la création et pour la correction.

`repousser()` et `reporterAu()` passent désormais par `poserDebut()`. Un seul chemin, donc une
seule façon de garder la durée d'un salon de trois jours.

### CE QUE L'IMAGE A TROUVÉ ET QUE 115 CONTRÔLES N'AVAIENT PAS VU

La leçon du 11/09 s'est encore vérifiée. Le banc validait tout ; la capture sur la vraie feuille
de style a montré quatre défauts.

**Le plus grave était une règle du projet enfreinte.** Sur un salon prévu dans douze jours, le
bloc « Pas maintenant ? » proposait « Demain ». Demain, c'était **l'avancer**. La règle existait
déjà, écrite pour les punaises du panneau : « proposer demain sur une tâche prévue dans six jours,
c'est proposer de l'avancer ». Une tâche pas encore due ne se repousse pas, elle se **déplace** :
les deux boutons rapides disparaissent, le champ de date reste, et le titre du bloc devient « La
déplacer ? ». Un titre qui ne décrit plus ce qu'il surmonte est la moitié du défaut.

**« Repousser » tombait seul à la ligne**, sous un champ de date resté en haut. Les cinq éléments
de la rangée se répartissaient au fil de l'eau. Le « ou », le champ et son bouton sont maintenant
solidaires : ils passent à la ligne ensemble ou pas du tout.

**Trois cibles sous le plancher tactile** sur 390 px : « Annuler » 42×11, « Retirer cette tâche »
113×11, « Ce que ça exige » 89×17, et les champs à 39-41 px de haut. Un lien typographique se lit
très bien et se vise très mal. Le dessin ne change pas ; la zone de clic descend à 44.

**L'aperçu lui-même mentait, deux fois.** Sa grille imposait 480 px de colonne sur un écran de
390, et le document débordait de 122 px : la mesure accusait la modale d'un défaut venu de la page
de contrôle. Et `cloneNode` ne recopie que les attributs : la première image montrait quatre
modales vides, avec le placeholder gris à la place du titre. On allait juger un écran qui n'existe
pas. Les deux sont corrigés dans `scripts/apercu-modale.mjs`, qui monte la vraie page avec les
vrais modules et écrit les cinq états côte à côte.

### LE GARDE-FOU NEUF A ÉTÉ VÉRIFIÉ EN ÉCHEC

`var presse = true` remis à la main : deux contrôles tombent, le banc refuse. Un contrôle qui n'a
jamais échoué ne garde rien.

### CE QUI RESTE OUVERT, ET QUI ATTEND L'ARBITRAGE DE TED

- **Dans la grille du mois, la pastille reste la case à cocher.** Lui faire ouvrir la modale
  demanderait deux clics pour cocher ce qui s'en coche un. Seule la vue liste a reçu la porte.
  À rouvrir d'un mot s'il préfère l'inverse.
- **« Retirer cette tâche » ne demande aucune confirmation**, exactement comme le « Retirer » de la
  liste. Cohérent, et destructif sans filet. Signalé, non corrigé.
- **Le titre de la modale dit « Ta tâche »** et non le titre réel, qui est juste en dessous dans le
  champ. C'est un intitulé de fiche, comme « Mes réglages ». À changer s'il le trouve creux.
- **Le formulaire du calendrier n'a pas reçu son bouton « Ajouter en détail… »** : la création y
  passe déjà par le « + » d'un jour, qui pré-remplit la date.

### CE QUI A ÉTÉ TOUCHÉ

`src/js/bdv-taches.js` (la modale, `modifier`, `poserDebut`, `reporterAu`, `normaliserDates`, la
porte sur chaque ligne, la punaise qui ouvre), `src/js/bdv-calendrier.js` (le titre ouvrable en vue
liste, deux portes), `src/mon-bureau.njk` (le bouton « Ajouter en détail… », la punaise),
`src/css/style.css` (la modale, le plancher tactile, la remise à plat du corps devenu bouton),
`scripts/banc-taches.mjs` (section 10, de 66 à 120 contrôles), `scripts/apercu-modale.mjs` (neuf,
`npm run apercu:modale`). `npm run verif` passe en entier.

---

## 12/09/2026. La page des outils cesse de faire semblant que tout se vaut

Demande de Ted : « reorganise la page : outils afin qu'elle soit beaucoup plus sexy : ajoute
viticode.fr (sachant que c'est nous) mais fait en sorte que ca soit utilisable et attractif. »
Puis, en cours de route : « on va ajouter un lien vers Vitisoft aussi du coup. »

### CE QUI N'ALLAIT PAS, ET CE N'ETAIT PAS L'HABILLAGE

La page portait deux cartes strictement identiques pour deux objets qui ne coutent pas la meme
chose au visiteur : le calendrier, qui s'ouvre sans rien donner, et le bureau, qui demande un
compte. Avec Viticode et Vitisoft, ca faisait quatre objets de quatre natures dans une grille
uniforme : deux qui restent sur le site, deux qui en sortent, trois gratuits, un payant.

**Une grille uniforme, la, ment par mise en page.** Rendre les cartes plus jolies sans regler ca
aurait produit une page plus belle et aussi malhonnete. La refonte porte donc sur la HIERARCHIE
avant l'esthetique : le prix et la destination se lisent AVANT le nom, sur chaque carte.

### LES ARBITRAGES

**Le calendrier passe en vedette, en grand.** C'est le seul outil de la page qui serve a quelque
chose en trois secondes, sans compte, sans logiciel, sans quitter le site. Ecarte : mettre le
bureau en vedette, ce qui aurait fait de la page un tunnel d'inscription et aurait coute la
credibilite que le calendrier lui donne. Levier a retester si les creations de compte chutent.

**La vedette porte un apercu VIVANT**, trois obligations qui comptent vraiment leurs jours, par
`bdv-echeances.js`, le meme moteur que la page qu'elle ouvre. C'est la seule chose de la page qui
prouve au lieu de dire, et c'est ce qui la rend « sexy » sans ajouter un seul ornement.

**Le lien avec Solumatic est ecrit noir sur blanc**, choix de Ted. Un visiteur qui decouvre tout
seul que les quatre outils sortent de la meme maison se sent manipule ; `/la-redaction/` le disait
deja, la page se serait contredite en le taisant. Ecarte : la mention discrete en pied de carte.

**Le titre change, et c'est Ted qui a tranche.** « Les outils » + etiquette « Gratuits » devenait
faux le jour ou Vitisoft entrait. On a d'abord retenu « La boite a outils du vigneron » avec la
gratuite portee par l'etiquette, puis Ted a decide de repositionner franchement : outils gratuits
-> **outils viticoles**. Le prix descend sur chaque carte, la page ne promet plus rien en bloc.
Consequence a accepter : on perd le referencement possible sur « outils gratuits vigneron ».

**Vitisoft ne devient PAS une carte comme les autres.** Il porte son orange, et c'est le seul
endroit du site public ou cet orange ait le droit d'exister : `tokens.css` l'autorise « pour
signaler explicitement un lien vers Vitisoft ». Mesure faite ce jour : `#FF9F00` vaut 1,79:1 sur
`--paper-light`, il ne tient meme pas les 3:1 d'un objet graphique. Donc **pas de filet orange,
pas de texte orange** : un aplat sous `--ink-deep`, ou il vaut 8,82:1. Le sens est dans le texte,
l'orange n'est qu'un drapeau. Et c'est le drapeau de VITISOFT, pas l'etiquette du payant : un
deuxieme outil payant prendrait une etiquette neutre, sinon la couleur d'une marque devient la
couleur d'un prix.

**Chaque carte porte une reserve**, c'est-a-dire ce que l'outil ne fait pas ou ce qu'il exige en
plus : l'export Vitisoft pour les ventes, la fiche Viticode qui vaut faux si on ne la met jamais
a jour, la demo Vitisoft sur rendez-vous sans essai en ligne. Sur la carte et pas en bas de page :
une limite qu'on lit apres avoir clique est une limite qu'on a cachee.

### LE DEFAUT TROUVE SUR LA PAGE RENDUE, ET PAS AVANT

Le cadre d'apercu s'intitulait « Ce qui tombe en ce moment ». Capture prise a trois largeurs sur
le vrai moteur : la troisieme ligne affichait **« Dans 245 jours »**. Un cadre qui annonce
l'urgence et montre huit mois se decredibilise tout seul, et aucune relecture du code ne l'aurait
signale, puisque le code etait juste. Titre corrige en « Les trois prochaines ». C'est la
troisieme fois que la capture sur le vrai moteur trouve ce qu'une relecture ne trouve pas.

### CE QUI A ETE VERIFIE

`npm run verif` en entier : 0 echec. `npm run charte` conforme, y compris sur le bloc CSS neuf.
Captures a 1280, 820 et 390 px : aucun debordement horizontal, l'apercu rend ses trois lignes aux
trois largeurs, la vedette se casse proprement en deux sous 820 px.

### CE QUI RESTE OUVERT

- **L'adresse de Vitisoft n'est pas verifiee.** `https://vitisoft.fr/` ne repond pas, seule
  `https://vitisoft.fr/Site/index.php` s'affiche. C'est cette adresse qui est posee dans la page.
  Si la racine est censee marcher, c'est un defaut du site Vitisoft, pas d'ici.
- **Les trois arguments de la carte Vitisoft** (2 000 domaines, DRM et DAE, facture electronique)
  sont tires de la page publique de vitisoft.fr. A relire par quelqu'un qui vend le produit.
- Les logos de `src/assets/logos/README.md` sont toujours en TODO. La page marche sans, mais un
  logo Viticode et un logo Vitisoft sur leurs cartes leur donneraient leur identite propre.
- `/la-redaction/` decrit encore Viticode d'une ligne. Un lien vers sa carte y aurait sa place.

### L'AUTO-AUDIT, DEMANDE PAR TED LE MEME JOUR : « audite-toi, travail de fond »

Methode de `feedback_auditer_son_propre_travail.md`, appliquee dans l'ordre. Les polices
Fraunces et Inter ont ete servies en local pendant la mesure : sans elles on mesure des
retours a la ligne qui n'existent pas. Cinq defauts reels, trois faux positifs de mon
propre harnais.

**Le nom accessible des liens faisait 325 a 385 signes.** Toute la carte etait une balise
`a` : un lecteur d'ecran annoncait l'etiquette de prix, le titre, le descriptif, les puces
et les trois echeances comme UN SEUL libelle de lien. La carte est devenue un `article`,
le nom un `h2` qui porte le lien, et un calque `::after` garde la carte cliquable en
entier. Noms accessibles apres : 27, 10, 44 et 44 signes. Effet de bord gagne au passage :
le plan de titres de la page etait `h1` + UN `h2`, il en compte quatre maintenant, un par
outil, ce qui est la seule facon de parcourir une page d'outils au clavier ou a l'oreille.

**Le compte a rebours « proche » etait sous le seuil AA.** `--warn` sur `--paper` donne
4,40:1 pour des lettres de 21,6 px, qui en demandent 4,50. Ajout de `--warn-deep` (#6E4E00,
6,20 / 6,65 / 4,84 sur les trois papiers), par symetrie avec `--danger-deep` qui existait
seul. La page des echeances passe avec, elle aussi : elle tenait a 4,71 uniquement parce
que sa carte est en `--paper-light`, et surtout **les deux comptes a rebours doivent porter
la meme couleur**, c'est le meme calcul et le meme mot.

**Et la charte ne regardait pas cette paire.** `--warn` n'y figurait que face a `--warn-bg`,
un fond appele nulle part. Face aux vrais papiers du site, personne ne l'avait jamais
calcule : `npm run charte` repondait CONFORME sur un texte sous le seuil. Huit paires
ajoutees a la table, dont les trois de `--warn-deep` et la ligne d'avertissement de
`--viti-orange` a 1,79:1. C'est la deuxieme fois que ce trou se referme au meme endroit.

**Sans JavaScript, le cadre d'apercu affichait un titre et 276 px de vide.** J'avais ecrit
le commentaire « un cadre vide est pire que pas de cadre » et ne l'avais applique qu'au cas
des donnees illisibles. Le cadre part `hidden` du HTML, le script le leve seulement quand
il a des lignes. Et la vedette se recolle en une colonne par `:has(.boite-apercu[hidden])`,
sans quoi, mesure faite, le texte restait cale sur 562 px avec 488 px de papier vide a sa
droite.

**Deux defauts que seule l'image a montres.** Le bandeau etait en `container` (760 px)
quand les cartes tenaient sur `container--wide` (1100) : le titre demarrait 170 px a droite
du bord des cartes. Et l'etiquette « gratuit », en `--paper-deep` sur une carte
`--paper-light`, ne se detachait que de 1,28:1 : **les deux outils gratuits chuchotaient
pendant que le seul payant criait en orange**, exactement l'inverse de ce que la page
raconte. Les trois etiquettes sont pleines maintenant. Ajoute a la meme passe : les filets
de reserve des trois cartes tombaient a 1101, 1124 et 1148 px, la rangee boitait.

**Les trois faux positifs, ecartes avec autant de soin.** Les cibles tactiles annoncees
« sous 44 px » etaient le rectangle du `a` en ligne, pas la zone cliquable, que le calque
etend a toute la carte : verifie par `elementFromPoint` sur six points de chaque carte.
L'ordre de tabulation annonce comme inverse venait de ce que mon harnais avait laisse le
focus sur la derniere carte avant de compter. Et « Fraunces non chargee » etait
`document.fonts.check` interroge sur une graisse que la page n'appelle pas : la mesure de
largeur prouve que Fraunces s'applique bien.

**Un banc pour que rien de tout ca ne revienne.** `npm run banc:outils`, 46 controles sur
la page CONSTRUITE : chaque carte a son etiquette de prix, aucune carte n'est elle-meme un
lien, aucun nom accessible ne depasse 80 signes, tout lien sortant annonce qu'il sort a
l'oeil ET a l'oreille, l'apercu part cache, le bandeau est cale comme le contenu. **Les six
garde-fous ont ete verifies en remettant le defaut** : ils levent de 1 a 6 echecs chacun.
Un controle qui n'a jamais echoue ne garde rien.

**Les donnees structurees.** La page n'en avait aucune qui lui soit propre : le fil
d'Ariane et l'`ItemList` des quatre outils sont poses, avec un prix de 0 declare pour les
gratuits et AUCUN prix pour Vitisoft, qui est sur devis. Le banc compare titre par titre et
adresse par adresse ce que disent les cartes et ce que dit la liste : un outil ajoute d'un
cote sans l'autre fait echouer la construction.

Hors perimetre, pour information : sous 768 px, `.nav__links` mesure 708 px dans 342 px
visibles. Rien n'est perdu, la barre defile lateralement (`overflow-x: auto`), mais elle ne
le dit pas : aucun degrade, aucune fleche. C'est un choix de dessin, pas un defaut, et il
n'a pas ete touche.


---

## 11/09/2026, nuit. Le bureau devient une application qu'on POSE sur un iPhone

Demande de Ted : « tu vas auditer la partie mon bureau, sur utilisation telephone. Je vais dire
a certains clients de l'installer comme une app sur leur iPhone. Il y a surement des liens a
faire sur les appels / messages pour une fiche client. On va donc aussi regarder pour les
notifications. »

Cinq audits lances en parallele, sur l'installation, les huit pieces au doigt, la fiche client,
le calendrier et le terrain des notifications. Puis les corrections, dans un ordre qui n'est pas
negociable.

### CE QUI A OUVERT LA SESSION : le plan de Ted ne marchait pas encore

Il n'y avait ni manifeste, ni icone d'application, ni service worker. Le geste « Partager, Sur
l'ecran d'accueil » ne produisait donc qu'un SIGNET : pas de plein ecran, une vignette floue de
la page en guise d'icone, et **aucune notification possible**, Apple les reservant aux
applications reellement installees. La moitie de la demande etait bloquee par cinq lignes de
balises qui n'existaient pas.

### L'ARBITRAGE CENTRAL : les sorties avant le manifeste

Poser le manifeste en premier aurait rendu REELS, d'un seul coup, tous les culs-de-sac d'une
page sans bouton retour. Tant qu'il n'y en avait pas, la barre de Safari restait la et son
bouton retour rattrapait tout. On a donc ferme les sorties d'abord, pose le manifeste ensuite,
et **ecrit un banc qui garde les deux moities ensemble** : `npm run banc:app` echoue si le
manifeste est la sans les sorties, et si les sorties sont la sans le manifeste. C'est la seule
facon de ne pas livrer la moitie qui casse.

### LE DEFAUT LE PLUS CHER, ET IL N'ETAIT PAS DANS LE PERIMETRE

`parseTels()` composait de faux numeros pendant que l'ecran affichait les bons. Une cellule
« 0612345678, 0494123456 » donnait un appel a vingt chiffres. Un « (+33) 6 12... » perdait son
indicatif. Un mobile belge devenait un fixe valide en Ardeche, donc on appelait un inconnu en
croyant joindre son client export.

Sur un ordinateur, c'etait un texte un peu sale dans une colonne. **Sur un iPhone, c'est le
bouton « Appeler ».** Ce chantier n'a pas cree ce defaut, il l'a rendu couteux, et c'est pour ca
qu'il est passe en premier : tout canal qu'on aurait ajoute par-dessus (SMS, WhatsApp) aurait
herite du meme numero casse, et on aurait multiplie par quatre des liens qui mentent.

La correction qui compte n'est pas une des quatre reparations de cas, c'est la cinquieme :
`formatTel()` ne PEUT plus diverger de `appel`. Les quatre premieres reparent ce qu'on a vu, la
derniere interdit la classe entiere. `npm run banc:tels`, 26 controles.

### L'AUTRE DEFAUT QUI N'ETAIT PAS DANS LE PERIMETRE : le stockage

WebKit dit noir sur blanc qu'une application posee sur l'ecran d'accueil n'a **aucune** exemption
d'eviction du stockage. La session vit dans `localStorage`, les ventes dans IndexedDB : **une
semaine sans ouvrir et le vigneron rouvrait son bureau deconnecte, base vide.** Sur un outil
qu'on ouvre quand il y a quelque chose a faire, donc pas tous les jours, c'etait la panne la
plus probable de toutes, et elle serait arrivee aux tout premiers clients installes.
La parade fait une ligne, `navigator.storage.persist()`, et elle n'etait nulle part.

Meme famille, meme silence : `rafraichir()` n'etait appelee qu'au chargement du document. Une
app d'ecran d'accueil ne recharge pas. Au retour d'un week-end, tout repondait 401, les
compteurs redescendaient a vide, la synchronisation s'arretait, **et le bureau avait l'air
normal.**

### CE QU'ON A ECARTE, ET POURQUOI

- **Peindre les articles en surimpression dans le bureau.** Ce serait un deuxieme endroit qui
  affiche un article, et il divergerait de la vraie page au premier changement de gabarit. On
  les ouvre hors de l'application, ou iOS pose sa propre vue avec un bouton « OK » : le systeme
  fournit le retour que la page ne peut pas fournir.
- **Un `scope` etroit dans le manifeste** (`/mon-bureau/`). Il aurait ejecte vers Safari tout
  lien vers un article, et le vigneron serait revenu par l'icone de son ecran d'accueil. La vue
  integree est meilleure : un bouton, on revient.
- **`maximum-scale=1` dans le viewport.** Ca reglait d'un coup le zoom involontaire des champs.
  Ca supprimait aussi le zoom volontaire, celui dont a besoin quelqu'un qui voit mal. Le defaut
  se corrige dans le CSS, en portant les saisies a 16 px. `banc:app` refuse les deux mots-cles
  pour que la tentation ne revienne pas.
- **`facetime:` sur la fiche client.** Ca marche, mais on ne lance pas une video sur un caviste,
  et ca echoue en silence pour tout correspondant Android. Ecarte, et note comme ecarte pour
  qu'on ne repose pas la question dans six mois.
- **Le fichier `.ics` telecharge**, comme PRODUIT et pas comme code. Une copie morte est un
  deuxieme endroit qui repond « quand tombe ma DRM », et il repond faux des que la date bouge.
  C'est la regle 7, avec l'autorite d'une entree d'agenda en plus. L'ecrivain ICS, lui, sera le
  meme module dans les deux cas : un seul ecrivain, deux livraisons possibles.
- **Toucher a `bdv-courrier.js`** pour son repli `toISOString()`, qui porte le meme decalage de
  date que celui corrige dans `bdv-base.js`. Le fichier est joint au deploiement avec une
  empreinte : le modifier force un redeploiement de `courrier-matin` pour un defaut qui ne mord
  que sur l'apercu hors ligne. Signale, pas corrige.

### L'ICONE : dessinee en geometrie, et il faut savoir pourquoi

Il n'existait aucun asset carre dans le depot, aucun logo, aucune marque. La seule identite
disponible est typographique, le nom en Fraunces italique. Une icone a partir de ca se dessine,
elle ne se recadre pas, et le conteneur n'a pas pu recuperer Fraunces.

Plutot qu'un monogramme dans une fonte approchante, qui aurait ete une fausse signature, le
verre est dessine en LIGNES DROITES, dans les trois couleurs de `tokens.css` : l'angle vif est
le parti pris du site, et il tient mieux qu'une courbe a 60 points sur un ecran d'accueil.
**Verifie a la taille reelle**, 60 px, et pas seulement en grand : c'est la seule taille qui
compte, et une icone qui se lit a 512 px ne prouve rien.

### LA LECON DE METHODE DE LA SESSION

Le harnais de mesure a valide « 390 px de page pour 390 px de fenetre, zero cible sous 44 px,
zero saisie sous 16 px ». La capture du MEME etat montrait « Domaine / des / Hauts / Coteaux »
sur quatre lignes.

**Une mesure dit qu'une page ne deborde pas. Une capture dit qu'elle se lit.** Les deux ne se
remplacent pas, et il faut les deux dans cet ordre : la mesure trouve ce qu'on ne voit pas, la
capture voit ce qu'on ne mesure pas. C'est la meme lecon que le bouton de desinscription
invisible du matin, et que les fonds de mail manges par Gmail la veille. Elle revient une fois
par jour depuis trois jours.

Et le harnais a attrape un defaut **que je venais de creer** : porter les champs de dates a
16 px et 44 px faisait sortir leur rangee a 438 px. La regle « remesurer la rangee apres avoir
grossi un de ses elements » avait ete ecrite le matin meme, pour les fleches du calendrier. Elle
n'a pas empeche de la refaire l'apres-midi, parce qu'un plancher tactile se pose element par
element pendant qu'un debordement se mesure rangee par rangee.

### LES NOTIFICATIONS : rien n'est construit, le terrain est leve

Ted a choisi « jusqu'au bout ». Rien n'a ete code : le chantier demande un service worker, des
cles VAPID, une table d'abonnements, une fonction Edge d'envoi et un declencheur, soit cinq
lots. Ce qui est acquis ce soir, c'est ce sans quoi aucun de ces cinq lots ne sert a rien : le
manifeste et l'installation.

Deux arbitrages sont poses et attendent Ted :

- **Le service worker sera un organe a fonction UNIQUE** : aucun ecouteur `fetch`, donc aucun
  cache, donc aucune possibilite de servir une version perimee du bureau. La specification
  n'exige qu'une inscription, pas un cache. Un banc devra l'interdire mecaniquement, sur le
  modele du controle « ni import ni require » de `joindre-courrier.mjs`. Et sa procedure de
  RETRAIT doit etre posee des le premier jour, parce qu'elle devient impossible plus tard : on
  ne supprime pas le fichier, on le remplace par une pierre tombale qui se desinscrit.
- **Le courrier de 8 h repond a « qu'est-ce que je fais aujourd'hui ». La notification repond a
  « qu'est-ce qui sera trop tard demain ».** Une chose qui n'a pas de « trop tard » n'est jamais
  une notification. Environ 50 notifications par an contre 365 courriers : c'est ce rapport de
  1 a 7 qui la rend credible. Et elle ne porte **ni nom de client ni montant**, parce qu'elle
  s'affiche sur un ecran verrouille pose sur une table, devant qui passe.

### A savoir avant de relire un article sur le sujet

Plusieurs guides dates 2026 affirment encore que la push web est indisponible dans l'Union
europeenne a cause du DMA. **C'est l'etat de fevrier 2024, avant le revirement d'Apple de mars
2024.** Quelqu'un qui relit ce dossier dans six mois et tombe sur un de ces articles conclura
que tout le chantier est mort-ne. Il ne l'est pas.

### L'AUTO-AUDIT DEMANDE PAR TED, ET IL A PAYE

Ted, avant de pousser : « audite-toi et corrige-toi. Tu n'as pas le droit de me pousser un
truc incoherent ou moche. »

Ce qui avait ete verifie jusque-la, c'etait une page de test ECRITE POUR L'OCCASION, avec du
balisage recopie a la main. Elle ne pouvait valider que ce qu'on avait pense a y mettre, et
elle avait donne un feu vert complet. Le vrai banc, lui, sert `_site`, pose 286 lignes de
vente dans la VRAIE IndexedDB et ouvre chaque piece par son vrai identifiant.

**Il a trouve six defauts de plus en un passage, dont trois etaient de ce chantier meme.**

- `min-height` sur `.chip` etait INERTE, faute de `display` : les chips de periode sont
  restes a 21 px. Troisieme fois de la journee que la meme faute se produit.
- `status('info')` n'existait pas dans la feuille : un bandeau sans fond ni couleur.
- Les deux champs d'ajout d'une tache etaient toujours a 14 px et 11 px : ils vivent dans
  `style.css`, et le bloc du soir ne corrigeait que `bdv-ecrans.css`.
- Les `<summary>` des blocs repliables faisaient 17 px, et avaient echappe aux DEUX passes.
- La bascule CA / Bouteilles faisait 25 px, alors qu'elle change l'unite de tous les
  chiffres de deux pieces.
- Et surtout : **« domaine NaN € » sur TOUTES les fiches clients**, `prixVenteMoyen()`
  rendant un objet passe a `fmtNum()`. Pre-existant, visible dans `npm run apercu:fiche`,
  jamais vu, parce qu'un apercu se regarde et qu'on finit par ne plus regarder.

**Le banc lui-meme a menti deux fois avant de dire vrai**, et c'est la lecon principale :

1. Premier essai avec les identifiants 'cuvees', 'cap' et 'registre', qui n'existent pas.
   `afficher()` retombait sur « Ma journee » et les sept pieces rendaient la meme hauteur.
   Le symptome se lisait « la bascule ne marche pas ». **Le libelle d'une piece n'est pas
   son identifiant**, c'est ecrit dans CLAUDE.md, et je l'ai quand meme refait.
2. Sans doublure des trois bibliotheques de CDN, `chargerEcrans()` echouait et AUCUN ecran
   de vente ne se peignait : on photographiait « Ma journee » en croyant photographier
   « Mon commerce ». Un harnais qui ne charge pas ce que la page charge n'illustre qu'une
   intention.

Et une troisieme fois, plus betement : le commentaire que j'ai ecrit DANS `banc-registre.mjs`
contenait une apostrophe inverse, qui refermait le litteral de gabarit qui l'entourait. Le
fichier ne se chargeait plus.

### Ce que je n'ai PAS corrige, et le chiffre pour en decider

L'en-tete du bureau occupe **434 px sur 844, soit 51 % du premier ecran**, et la barre des
pieces 53 px en bas : il reste **357 px de contenu visible sans faire defiler**. Sur « Mon
cap », ils sont pris par la barre d'exports et les chips de periode. Le vigneron ouvre son
bureau et ne voit encore rien de ce qu'il vient chercher.

Ce n'est pas un defaut, c'est un dessin, decide ailleurs : le salut, les deux boutons, la
lune. **A rouvrir avec Ted.** Ce qui est acquis, c'est le chiffre.

Meme traitement pour trois autres : les chips de periode prennent trois rangees une fois a
44 px ; les trois boutons d'export ouvrent « Mon commerce » et « Mon cap » alors qu'un
export ne marche meme pas dans une application posee sur l'ecran d'accueil ; et rien
n'annonce qu'un tableau defile.

### Compte

`npm run verif` : 511 controles, 16 bancs, 0 echec. Deux bancs nouveaux, `banc:tels` (26) et
`banc:app` (30), plus trois controles ajoutes a `banc:registre` sur la fiche client.
Et `scripts/capture-telephone.mjs`, HORS de la chaine parce qu'il demande playwright :
c'est lui qui a trouve tout ce qui precede. Rien n'est deploye : Ted pousse et met en prod
lui-meme.

---

## 11/09/2026, soir. Le bureau sur un telephone : la passe severe, premiere moitie

Demande de Ted : « il faut que ca soit utilisable sur un telephone comme sur un ordinateur.
J'ai l'impression que la partie ordinateur c'est plutot bien foutue, par contre au niveau du
telephone c'est un peu plus complique. Sois tres severe avec toi-meme. »

### On a commence par MESURER, et c'est la moitie du travail

Une impression ne se corrige pas, elle se verifie. Un banc de captures a ete monte AVANT
d'ecrire une ligne de CSS : il sert `_site` en local, injecte une session, trois rappels
clients, cinq taches et 260 lignes de ventes en IndexedDB, coupe le reseau, ouvre chaque
piece par sa vraie languette, et photographie a 360 et 390 px en relevant trois choses :
la hauteur de la page, ce qui deborde de son conteneur, et toute cible tactile sous 40 px.

**Trois pieges du banc, chacun paye une fois, et chacun aurait rendu l'inventaire faux :**

1. **Playwright execute le DERNIER gestionnaire de routes en premier.** Un `route('**')` pose
   apres un `route(supabase)` avale tout, et son `continue()` envoyait les appels Supabase
   sur le vrai reseau, ou ils echouaient. Le banc photographiait un bureau sans profil en
   annoncant qu'il en avait un. Un seul gestionnaire qui decide, desormais.
2. **Les polices sont servies EN LOCAL, et ce n'est pas un detail de confort.** Le conteneur
   n'a pas acces a Google Fonts : les captures se faisaient sur Georgia au lieu de Fraunces.
   Les chasses different, donc les retours a la ligne, donc les hauteurs, donc l'inventaire
   entier. Un audit responsive sur des polices de repli invente des defauts et en cache
   d'autres. PapaParse, Chart.js et xlsx sont servis pareil, sinon les pieces de vente ne
   montent jamais.
3. **C'est le `<a>` qu'il faut cliquer, pas le `<li>`.** Le gestionnaire de bdv-nav.js sort
   par `closest('a.bureau-nav__item')` : un clic sur la rangee ne fait rien, sans erreur, et
   le banc a photographie quatre fois « Ma journee » en annoncant quatre pieces
   differentes. Un banc qui se trompe de cible ment avec aplomb.

### Ce que la mesure a dit, a 390 px

| | avant | apres |
| --- | --- | --- |
| Ma journee | 4 730 px | 3 851 px |
| Le calendrier | 6 157 px | 5 054 px |
| Mes taches | 3 501 px | 3 090 px |
| cibles sous 40 px | 17 | 4, toutes fausses (voir plus bas) |
| grille du mois | 618 px dans 308, quatre colonnes sur sept | tient dans la colonne |
| intitules perdus | 7 par mois | 0 |

**Le premier defaut n'etait pas un defaut de mise en page, c'etait un defaut de PERIMETRE.**
Le site public entourait le poste de travail : son bandeau marchand au-dessus, tronque a
« LA RE », debordant de 555 px dans une fenetre de 342 ; son pied de page complet en
dessous, neuf liens et mentions legales, environ 900 px de brochure sous CHAQUE piece. A eux
deux ils fournissaient la moitie des cibles tactiles hors norme.

### Les trois arbitrages de Ted

- **Le decor sort du bureau sur telephone.** Une classe `bdv-poste` sur le corps de page,
  posee quand la session existe et RETIREE quand elle disparait, et deux regles sous 700 px.
  Une seule porte pour ressortir, `.bureau-sortie`, en pied de poste. Sur ordinateur on ne
  touche a rien : c'est sa consigne.
- **La barre des huit pieces passe en bas de l'ecran**, comme dans une application. **Ecart
  assume sur ce qui avait ete envisage** : cinq icones plus un bouton « Plus » etait la
  proposition, huit icones ont ete faites. La mesure a tranche : a 360 px, huit cellules font
  45 px, donc au-dessus du plancher. Un tiroir « Plus » cacherait trois pieces derriere un
  geste de plus pour resoudre un probleme de place qui n'existe pas.
- **La grille du mois devient une CARTE.** Sept colonnes de 44 px, le numero du jour, et une
  pastille de couleur de famille a la place de l'intitule. Un appui sur la case emmene a la
  carte du jour dans la liste qui etait deja sous la grille, celle qui porte le titre entier,
  la source officielle et les boutons. **Pas de bulle flottante** : ce serait un deuxieme
  endroit qui repond « qu'est-ce qui tombe ce jour-la ».

### Trois defauts trouves au passage, dont deux qui n'ont rien de responsive

1. **Un verre a moitie rempli et « Analyse… le moteur travaille » s'affichaient en bas de
   TOUTES les pieces, sur ordinateur comme sur telephone.** `#busyov` et `#status` sont dans
   la page des le chargement, mais la feuille qui les cache, `bdv-ecrans.css`, n'arrive qu'a
   l'ouverture d'une piece de vente. Entre les deux, c'est du contenu ordinaire. La regle qui
   les cache vit maintenant dans `style.css`, chargee partout, et elle est ecrite en negatif
   sur l'etat visible pour ne pas gener `.on`.
2. **« Domaine de la Jayama » etait epingle DEUX FOIS au panneau**, une fois en punaise de
   rappel et une fois en punaise de tache, depuis que « Mes clients » est une famille de
   « Mes taches ». Et la punaise de tache proposait « Fait » et « Demain » sur un identifiant
   `client:C0170` : ni `basculer()` ni `repousser()` ne le trouvent, les deux boutons ne
   faisaient rien du tout. `punaises()` ecarte desormais `source === 'client'` ; le panneau
   lit les clients a la source, ou il sait poser « Appele », qui ecrit vraiment.
3. **Un plancher tactile pose sans regarder ce qui tient a cote fabrique le defaut qu'il
   pretendait corriger.** `min-width: 44px` sur les fleches du calendrier a fait passer
   `.cal__nav` de 293 a 323 px dans 317, et la PAGE ENTIERE s'est mise a deborder de 4 px.
   Corrige en repliant la rangee et en ne donnant a « Aujourd'hui », deja large de 116 px,
   que la hauteur qui lui manquait.

### Un defaut introduit par cette passe, et attrape a la relecture

La pastille du calendrier reste un `<button>` qui COCHE l'obligation. A 6 px dans une case de
44, un pouce qui vise la case tombe une fois sur deux dessus et marque une DRM comme faite
sans l'avoir voulu. Elle a recu `pointer-events: none` : elle garde son libelle et son etat
dans l'arbre d'accessibilite, et la vraie coche vit dans la liste du dessous, a 44 px.

Et les regles des pastilles ont du etre reportees de `.calo__b` a **`.calm__l .calo__b`** :
ecrites sans scope, elles atteignaient AUSSI les occurrences de « L'annee » et de la frise,
ou l'intitule a toute la place de s'ecrire. Trois vues reduites en pastilles pour en reparer
une. Meme piege que le scope de `.bdv-ventes` le 07/09/2026, et il se paie de la meme facon :
en silence.

### Ce qui reste ouvert

- **Les quatre pieces de vente n'ont pas ete mesurees.** Le banc les ouvre, le moteur charge,
  mais la zone de travail reste vide — et c'est vrai a 1280 px aussi, donc le trou est dans
  le banc et pas dans le telephone. Piste non explorée : la difference tient a l'une des
  donnees semees, pas au code de la page. A reprendre.
- **Quatre cibles restent signalees a 390 px, et ce sont de fausses alertes** : ce sont les
  liens de tete des post-it, dont la zone cliquable est le papier entier par un `::after`
  etendu. Le detecteur mesure le `<a>`, pas sa surface reelle. A corriger dans le banc, pas
  dans la page.
- **La hauteur de « Mes taches » a baisse moins que les autres** : les cibles agrandies
  reprennent une partie de ce que le decor retire avait rendu. C'est le prix du plancher
  tactile, et il est bon a payer.
- Le banc de captures vit dans la session et **n'est pas dans le depot** : il demande
  Playwright et quatre bibliotheques recopiees en local. Tout ce qu'il faut pour le
  reconstruire est ecrit ci-dessus.

---

## 11/09/2026. UNE SEULE FICHE CLIENT, ET ELLE SE REMPLIT

Demande de Ted, mot pour mot : « je clique sur appelé / Message ou écarter. ça génère l'action. ou
alors je peux cliquer sur le nom et ça m'ouvre une petite modale. Je veux pu ça. la petite modale
disparait à jamais. Je veux que ça ouvre la vrai grosse fiche en modale dans les 2 cas, mais au bon
endroit dans les 2 cas aussi. parce que je veux que l'utilisateur puisse remplir quand il a
appelé. »

### Ce que le recensement a trouvé avant d'écrire une ligne

Il y avait **deux fiches client**, et personne ne l'avait écrit nulle part. La petite, 280 lignes
dans `src/mon-bureau.njk`, montrait la prochaine action, les coordonnées et le fil. La grosse,
dans `bdv-ecrans.js`, montre en plus les chiffres du client, ce qu'il achète, ce qu'il ne prend
jamais, et le rédacteur de message. Deux endroits pour noter un appel : celui qui remplit les deux
perd la moitié de son travail le jour où il n'en ouvre qu'un.

Trois obstacles, tous réels, aucun visible à la lecture :

1. **`#modale` vivait dans `#bureauVentes`**, masqué tant qu'aucune pièce de vente n'a été ouverte.
   Ouverte depuis « Ma journée », la fiche se serait peinte dans du vide, sans une erreur. C'est le
   piège déjà payé le 08/09 avec « Ma base », et le seul contrôle qui l'attrape est maintenant dans
   `banc-bureau.mjs`.
2. **La grosse fiche se fabrique à partir des lignes de vente**, et « Ma journée » ne charge pas le
   moteur depuis le 07/09 (32 ko au lieu de 125). Le premier clic de la session le charge donc.
   Arbitrage pris avec Ted : pas de préchargement en tâche de fond, une attente visible sur la
   ligne cliquée, et les clics suivants sont instantanés. On ne paye que si on s'en sert.
3. **La file se lit depuis un appareil où aucun export n'a jamais été déposé.** La petite fiche s'en
   moquait ; celle-ci ne peut pas. `ouvrirFicheClient()` rend `false` plutôt que d'ouvrir une fiche
   vide, et le bureau dit quoi faire.

### Les arbitrages

**Rien n'est écrit tant que le vigneron n'a pas écrit.** C'est le choix de Ted contre les deux
autres proposés. « Appelé » n'est plus un geste, c'est une porte : il ouvre la fiche sur le bloc de
suivi, canal Téléphone déjà choisi, curseur dans la zone de notes, et c'est l'enregistrement de la
note qui repousse le rappel de 30 jours. Fermer sans rien écrire ne laisse aucune trace, et la
ligne est toujours dans le sous-main.

Ce qu'on perd, et c'est assumé : le tri rapide de quinze relances en quinze clics. Ce qu'on gagne :
plus jamais un client qui quitte la file sans qu'on sache ce qu'il a dit.

**« Écarté » reste un geste sec, sans fiche.** C'est le bouton qui dit « je ne veux pas m'en
occuper » : lui ouvrir une fiche serait le contraire de ce qu'il veut dire. Signalé à Ted, à
rouvrir d'un mot s'il préfère l'autre.

**« Message » a changé de sens.** Il voulait dire « j'ai laissé un message sur le répondeur » ; il
ouvre maintenant le rédacteur, et c'est de là que part « Considéré comme envoyé ». Un appel tombé
sur un répondeur se note dans le bloc de suivi, canal Répondeur, comme n'importe quel autre
échange. Conséquence : les trois boutons ne tirent plus leur libellé de `BdvCrm.GESTES`, parce
qu'un libellé tiré d'une liste de gestes qu'on ne pose plus est un libellé qui ment.

**La punaise « Appeler X » du panneau passe par le même chemin.** Un appel noté depuis la punaise
et un appel noté depuis la ligne doivent écrire la même chose : c'était déjà la règle, elle tient.

### Le rappel porte son motif, et il ne déménage pas

Demande : « en plus des raccourcis de temps, je veux pouvoir choisir la date et donner un texte à
ce rappel (qui devient une tache finalement + calendrier) définir cette catégorie de tache
clients ».

Ted avait d'abord choisi de déplacer la vérité des rappels vers la table des tâches. Recommandation
faite et acceptée : **le chemin court.** Ce que le déménagement aurait touché : le sous-main, le
panneau, la règle « un client déjà suivi sort de la file », la vue Postgres `v_courrier` et la
fonction d'envoi de 8 h, plus la reprise des rappels déjà posés. À l'écran, aucune différence.

Donc : une colonne `rappel_titre` sur `suivi_clients` (lot 14), et le calendrier comme « Mes
tâches » vont LIRE ce rappel là où il est. Une chose à faire, un seul endroit qui la porte.

**La sixième famille n'a pas de couleur, et ne pouvait pas en avoir.** La bande utilisable du
papier s'arrête à L* 56 : cinq teintes n'y tenaient déjà pas l'écart de 3:1. Elle prend une
matière, comme la cinquième : écrite à la main, plus un combiné en tête. Ça se lit en niveaux de
gris et en vision deutéranope.

**Et elle ne se coche pas.** « Fait » pour un client, ce n'est pas une case, c'est ce qu'il a dit.
Ces lignes mènent à sa fiche. C'est ce qui permet de les montrer à trois endroits sans jamais avoir
deux réponses à « ce client est-il traité ».

### Le suivi se replie aussi

Demandé dans la foulée : « le suivi dans la fiche doit pouvoir se replier comme écrire un
message ». Fait, avec une nuance qui n'était pas dans la demande : **il est ouvert à l'arrivée**.
Le replier par défaut aurait caché la prochaine action, qui est l'information la plus importante de
la fiche et la règle des trois étages du bureau. Ce qu'on gagne quand même : sur un client au long
fil, le bloc se plie pour lire ce qu'il achète sans faire défiler trente entrées.

Le `<details>` enveloppe `#suiviBloc` au lieu de le remplacer, sinon le repli sauterait à chaque
note enregistrée, `redessinerSuivi()` réécrivant l'intérieur du bloc. Et tout ce qui renvoie vers
le suivi le déplie d'abord.

### Le défaut trouvé en vérifiant, et il était invisible

La vue liste du calendrier avait bien son cas particulier pour les clients. **La pastille de la
grille, elle, prenait le bouton de coche commun**, deux fonctions plus loin. Un clic dessus aurait
écrit une ligne `ech:client:706:2026-09-13` dans la table des tâches : une fausse tâche, à côté du
vrai rappel, qui aurait répondu « fait » pendant que le sous-main continuait de réclamer le client.

Rien n'échouait, rien ne s'affichait de travers. Il ne se voyait qu'en lisant le HTML produit.
D'où `npm run banc:calclients`, qui le garde, et `npm run apercu:fiche`, qui montre la fiche dans
ses quatre états sans compte ni base : trois blocs neufs ne se voyaient que sur la vraie page, et
on allait encore juger un dessin en production.

### APURER UN RAPPEL : la question de Ted en fin de session, et le trou qu'elle a trouvé

« Comment apurer un rappel client alors ? » Posée après coup, et elle tombe juste. Décision :
**on ne touche à rien pour l'instant.** Ce qui suit est le constat, à reprendre au prochain
chantier du sous-main.

Trois sorties existent, et une seule apure vraiment : « Ne plus me le proposer » (statut traité,
réversible), « Retirer » la date, et enregistrer une note après « Appelé », qui ne fait que
repousser de 30 jours.

Deux défauts, et le second vient de cette session :

1. **« Ne plus me le proposer » n'existe QUE dans la branche sans date.** Dès qu'un rappel est
   posé, le bouton disparaît : il faut Retirer, attendre le redessin, puis cliquer sur le bouton
   qui vient d'apparaître. Deux gestes pour une intention, et personne ne devine le premier.
2. **Écrire une note sans poser de date ne sort pas le client de la file.** Avant, ouvrir la fiche
   par le nom était rare ; depuis aujourd'hui c'est le geste normal, donc le cas est devenu
   fréquent. `noter()` écrit l'échange et rien d'autre : sans statut ni date, `BdvCrm.file()` garde
   le client, et il est encore là demain matin.

Le correctif proposé, non écrit : un bouton **« C'est réglé »** dans la branche « rappel posé »,
qui efface la date ET pose le statut, donc sort le client de la file sans le mettre au placard.
Trois mots pour trois intentions : une date pour « plus tard », « C'est réglé » pour « j'ai fini
avec lui cette fois », « Ne plus me le proposer » pour le geste dur.

**La question restée sans réponse, et il faut Ted pour la trancher :** après « C'est réglé », est-ce
que ce client peut revenir tout seul dans la file le jour où il décroche à nouveau, ou en est-il
sorti jusqu'à ce qu'on y remette une date ? Ma proposition était qu'il revienne. Ne pas l'écrire
sans son arbitrage : c'est le genre de choix qui se découvre trois semaines plus tard, quand un
client qu'on croyait traité réapparaît, ou pire, quand il ne réapparaît jamais.

### Ce qui reste ouvert

- **Apurer un rappel**, ci-dessus. Un bouton à écrire, un arbitrage à demander.
- **Le courrier du matin ne dit pas le motif du rappel.** `v_courrier` ne remonte pas
  `rappel_titre`, et `bdv-courrier.js` ne l'afficherait pas. Ça se fait, mais ça demande de
  rejouer la vue, `npm run courrier:joindre` et un redéploiement de la fonction Edge : c'est un lot
  à part, pas une ligne à glisser dans celui-ci.
- **Les liens `#client=` du panneau** ouvrent toujours « Mon commerce » puis la fiche, au lieu de
  l'ouvrir sur place. C'est la même fiche, donc ce n'est pas faux ; c'est juste un voyage inutile.
- **`.modale` porte `z-index:400` en dur** au lieu du jeton `--z-modale`. Une échelle dont un
  barreau est écrit en dur ailleurs est une échelle qu'on casse sans le voir.
- **« domaine NaN € »** apparaît dans le KPI des bouteilles quand `prixVenteMoyen()` n'a rien à
  calculer. Vu sur le banc d'essai, pas sur une vraie base. Un chiffre affiché doit dire d'où il
  vient, et une case vide vaut mieux qu'une valeur inventée.

---

## 11/09/2026. La redecoupe du bureau, lot 1 : « Mon commerce »

Demande de Ted, mot pour mot : « la page : mon annee me va pas. c'est le fouilli, on ne fait que
scroller pour avoir des informations. [...] ce bureau doit etre fait pour travailler. Propose moi
une autre organisation de l'intercalaire a gauche. [...] Mes clients : ca pourrait s'appeler :
Commerce. Mon annee .. a supprimer et refondre en d'autres menus. »

### Ce qu'on a trouve en recensant, et qui n'etait pas dans la demande

`renderAll()` empilait quatre anciens ecrans dans la seule piece « Mon annee » : Diagnostic,
Apercu, Evolution, Canaux. Recensement bloc par bloc : **26 blocs**, dont **trois ecrits deux
fois** et trois autres qui disent la meme chose autrement.

Le doublon qui a emporte la decision : le KPI « Evolution vs N-1 » du Diagnostic et le bandeau
« Ou en est ton annee, N vs N-1 a date » de l'Apercu affichent le meme calcul, le meme chiffre et
les memes deux montants, a quatre cents pixels l'un de l'autre. Une partie du scroll de Ted
n'etait pas de l'information, c'etait de la repetition.

Deuxieme trouvaille, celle qui commande le lot 3 : **« Evolution dans le temps » et « Mon
registre » sont le meme outil.** Choisir un critere, en croiser un second, lire un tableau,
exporter. La seule difference est que l'un a le critere « temps » fige d'avance.

### Les arbitrages

**On ne supprime PAS la piece de bilan, contre la demande initiale de Ted.** Il voulait la faire
disparaitre. Recommandation faite et acceptee : apres avoir renvoye dix-neuf blocs ailleurs, il en
reste sept qui ne repondent a aucune autre question que « ou j'en suis sur l'ensemble » (realise,
atterrissage, objectif, courbe des mois, tendance corrigee, effet prix contre volume). Les pousser
dans « Mon commerce » ne les rangerait pas, ca les cacherait. La piece est donc gardee, allegee de
26 blocs a 7, et renommee **« Mon cap »** : le nom pose une question au lieu de nommer une periode.
Levier a retester si Ted ne l'ouvre jamais : c'est que les trois chiffres du haut suffisaient, et
il faudra alors les remonter dans le bandeau et disperser le reste.

**« Mon commerce » et pas « Commerce ».** La barre ne nomme que des objets de bureau, tous au
possessif, et c'est une regle ecrite dans `bdv-nav.js`. Ted a tranche pour la forme possessive
plutot que de reecrire la regle.

**L'identifiant `clients` ne change pas, seul le libelle bouge.** Il tient l'adresse
`/mon-bureau/#clients`, donc les signets et les liens copies, et c'est lui que `npm run banc`
compare avec `NAV` dans `bdv-ecrans.js`. Renommer le libelle ne coute rien ; renommer
l'identifiant casserait les deux, pour zero gain visible.

**Le perimetre du pied de « Mon commerce » est toute la base, et c'est un changement assume.** Le
top clients et le signal de dependance venaient de l'Apercu, ou ils suivaient la barre de periode.
Or `navTo()` n'affiche `filterbar` que sur l'ecran « annee ». Les deplacer en leur laissant lire
`filters` aurait donne un chiffre calcule sur un filtre invisible, pose dans une autre piece,
parfois des semaines plus tot. Meme raison pour la mesure, figee au CA HT : la bascule
CA / bouteilles est restee, elle aussi, dans l'autre piece.

### La discipline des trois etages

C'est la regle qui vaut pour les trois lots suivants, et sans elle on reconstruit « Mon annee »
ailleurs : **un verdict en haut** (une phrase, un chiffre), **la liste ou l'on agit au milieu**,
**les tableaux qui expliquent replies en bas**. Le troisieme etage reutilise le `<details
class="msg--replie">` deja style dans `bdv-ecrans.css` : replie par defaut, mais son titre reste
visible et cliquable. Choix de Ted, formule ainsi : « replie par defaut mais visible pour le
deplier ».

### Ce qui a ete verifie

`npm run verif` en entier, apres avoir mis a jour l'ordre attendu dans `scripts/banc-bureau.mjs` :
deux chartes CONFORME, et 104 + 46 + 47 + 54 + 38 + 19 + 23 + 23 controles passes, zero echec.

### Piege rencontre

Le build a d'abord echoue sur `EPERM: operation not permitted, unlink '_site/css/...'`. Ce n'est
pas un defaut du depot : la session Claude n'avait pas le droit de supprimer dans le dossier, et
Eleventy remplace `_site` a chaque construction. Debloque par une autorisation ponctuelle. Sur la
machine de Ted, le cas ne se pose pas.

### Lot 2, « Mes cuvees », fait dans la foulee

Le panneau Canaux entier et la repartition par couleur sont entres dans la piece. Deux
suppressions de plus, sur le meme principe que le lot 1 :

- **« Top cuvees (7) » de l'Apercu**, qui etait les sept premieres lignes du tableau
  « Toutes tes cuvees », deja trie par CA.
- **`labels` dans renderCanaux**, une variable construite a chaque appel et jamais lue.

**`renderCanaux()` est devenue `blocsCanaux()`, et elle ne peint plus.** Elle retourne
`{signaux, tableaux, A}`, parce que ses morceaux ne vont plus au meme etage : les deux
signaux (le canal qui monte ou recule, le prix moyen au caveau) rejoignent le verdict en
haut, les tableaux vont dans le repli. Aucun calcul n'a change. `p-canaux` disparait de la
coque, et la liste figee des reperes du banc passe de 26 a 25.

**Le titre de l'ecran disait « Mes produits » pendant que la barre disait « Mes cuvees ».**
C'etait le seul endroit du bureau ou une piece portait deux noms. Corrige des deux cotes.

**Le piege du jour : un `<canvas>` dans un `<details>` ferme a une hauteur de zero.** Chart.js
s'y dessine a zero pixel, et rien ne garantit qu'il se rattrape a l'ouverture. Les deux graphes
du pied (part de CA par canal, repartition par couleur) sont donc dessines sur l'evenement
`toggle`, au PREMIER depli seulement, avec un marqueur `data-peint` pour ne pas recommencer a
chaque fois. Effet de bord heureux : qui n'ouvre pas le pied ne paye pas deux graphes.

Meme regle de perimetre qu'au lot 1, et pour la meme raison : `drawCouleur()` ne prend plus
`rows` et la branche sans comparatif de `blocsCanaux()` ne lit plus `filters.ex`. Tout lit la
base entiere, en CA HT, et le texte le dit sous chaque tableau.

`npm run verif` : deux chartes CONFORME, 354 controles, zero echec.

### Lot 3, « Mon registre » : la fusion, et une correction de ma part

**J'avais vendu ce lot sur un argument faux, et je l'ai dit avant de coder.** J'avais affirme
que croiser le temps avec un critere etait impossible des deux cotes. C'est inexact : « Mois »
et « Annee » etaient deja dans le menu « Repartir par » du registre, rubrique Temps. Je ne
l'avais pas verifie avant de l'affirmer.

**Et ce n'etaient pas le meme outil, mais deux outils qui se recouvrent.** Chacun avait quelque
chose que l'autre n'avait pas :

- Evolution : la COURBE, et une LECTURE EXPERTE de huit signaux calcules (tendance de fond et
  sa pente, meilleur et pire mois, momentum du dernier point, concentration par indice de
  Herfindahl, moteurs et freins, saisonnalite, poids du non renseigne).
- Le registre : dix-neuf facettes, la plage de dates libre, le croisement de deux criteres
  quelconques.

Ils ne partageaient vraiment que le tableau periode par periode et les exports.

**Arbitrage de Ted : la fusion reelle, pas le demenagement.** Le registre garde sa barre de
pilotage et gagne la courbe plus la lecture experte des qu'on repartit par mois ou par annee.
L'ecran Evolution disparait, avec `evoStep`, `evoDim`, `periodKey`, `evoRows`, `evoDimGet`,
`evoExportSheets` et `exportEvo`. `drawEvo()` et `evoCommentaire()` n'ont pas bouge d'un
calcul : ce sont les memes cles de periode des deux cotes, et c'est ce qui a rendu la fusion
possible en une passe.

**Deux gains qui n'etaient pas demandes.** Le pas de temps n'est plus un reglage a lui : c'est
le choix « Repartir par Mois / Annee », qui existait deja. Et la selection de periode s'applique
enfin a la courbe : l'ancien ecran l'ignorait en vue annuelle, et le disait dans une note en
bas de tableau, qu'il fallait avoir lue.

**`evoCommentaire()` rend maintenant un TABLEAU de signaux et plus une chaine.** Le premier,
la tendance de fond, est le verdict visible ; les sept autres sont replies sous « La lecture
experte, en detail ». Huit verdicts avant de voir sa courbe, c'etait refaire « Mon annee »
dans une piece de plus.

**Les deux repartitions de l'apercu (par famille, par code tarif) sont devenues des boutons.**
Une ligne « Vues rapides » sous la barre de pilotage : par famille, par code tarif, par canal,
par mois, par client. Meme resultat que les deux cartes figees, plus onze autres criteres a
cote.

### Le banc qui a servi le jour meme

`npm run banc:registre`, ajoute au depot et a `npm run verif`. Il monte le moteur et les ecrans
en jsdom, fabrique vingt-quatre mois de ventes, et verifie que la courbe et la lecture experte
apparaissent sur un axe de temps et disparaissent sinon.

**Piege a connaitre pour le prochain banc du meme genre : un seul `eval`.** Le moteur declare
ses globales en `let` et `const`, qui restent scopees a l'eval qui les execute. Charger
bdv-base.js puis bdv-ecrans.js en deux appels donne « ROWS is not defined ». Les deux fichiers
et le scenario partent ensemble, en une seule chaine.

**Il a attrape une regression au premier passage**, que ni la charte ni les onze autres bancs
ne voyaient : les mois du tableau croise revenaient en « 2026-03 » au lieu de « mars 2026 »,
parce que l'ancien tableau d'Evolution passait par `periodLabel()` et pas celui du registre.
D'ou `libAxe()`. Sans ce banc, Ted l'aurait trouve lui-meme apres le deploiement.

Effet de bord assume : l'export du registre garde les cles brutes (`2026-03`), la ou
`exportEvo` ecrivait « mars 2026 ». C'est mieux ainsi, une colonne de dates doit se trier.

`npm run verif` : deux chartes CONFORME, 367 controles, zero echec.

### Lot 4, « Mon cap » : la piece de bilan, de vingt-six blocs a sept

**Le doublon d'ouverture est enfin ferme.** `renderDiagnostic()` et `renderApercu()` etaient deux
panneaux empiles dans la meme piece, avec deux titres, deux sous-titres, et le meme chiffre
d'evolution ecrit de deux facons a quatre cents pixels d'ecart. Une seule fonction les remplace,
`renderCap()`. Le bandeau de comparaison garde l'evolution (il dit en plus les deux totaux et
l'atterrissage) ; le compteur « Evolution vs N-1 » est retire de la grille.

**Une decouverte en ouvrant : l'objectif de CA etait DEJA dans les reglages**, onglet « Tes
ventes », a cote du mois d'exercice. Je comptais l'y deplacer ; il n'y avait rien a deplacer, juste
un sixieme doublon a supprimer. Deux champs de saisie pour une seule valeur, dans deux ecrans, et
celui de « Mon annee » ne se repeignait qu'au rendu de la piece : de quoi lire deux montants
differents pour le meme reglage. Le champ est retire, `setObjectif()` est morte avec lui, et la
piece dit maintenant en une phrase ou aller le regler.

**Deux grilles de compteurs au lieu d'une, et la difference est le sujet.** « Ou en es-tu » porte
les chiffres d'EXERCICE, qui ne bougent pas avec le filtre de periode : realise, atterrissage,
ecart a l'objectif. « Sur la periode affichee » porte ceux de la selection. Les melanger, c'etait
laisser croire qu'un filtre change l'atterrissage.

**Le nom a supprime une duplication de cle.** La piece s'appelait « Mon annee » ou « Mon
exercice » selon le mois d'ouverture du domaine. Pour l'ecrire sans charger le moteur (83 ko pour
deux caracteres), `bdv-nav.js` relisait la cle d'exercice de son cote, avec un commentaire qui
declarait lui-meme le danger : « la changer d'un seul cote ferait dire Mon exercice a un domaine en
annee civile, sans erreur et sans que personne ne le remarque ». « Mon cap » tient sur les deux
exercices : `motExercice()` et le miroir de cle ont disparu.

**Et le controle du banc a change de sens, ce qui etait le but.** Il verifiait qu'un exercice
ouvrant en avril lisait « Mon exercice ». Il verifie maintenant que le libelle NE BOUGE PAS quand
la cle change, et que le nom de cette cle n'apparait plus nulle part dans `bdv-nav.js`. Qui
voudrait reintroduire un libelle variable devra reintroduire la lecture, et echouera ici.

**Nouveau banc, `npm run banc:cap`**, ajoute a `npm run verif`. Seize controles, dont celui qui
compte vraiment : le chiffre d'evolution n'est ecrit qu'une fois, et aucun `<input>` n'est revenu
dans la piece. C'est le doublon qui a ouvert toute la redecoupe ; rien dans le depot ne l'aurait vu
revenir.

Piege de calibrage, pour le prochain banc du meme genre : avec vingt-quatre mois de ventes,
l'exercice courant est COMPLET, `computeAtterrissage()` repond « annee cloturee », et ni
l'atterrissage ni l'ecart a l'objectif ne s'affichent. Le banc en fabrique dix-neuf, comme la vraie
base de Ted. Une piece qui s'appelle « Mon cap » se controle sur un exercice en cours.

`npm run verif` : deux chartes CONFORME, 385 controles, zero echec.

### Lot 5, le nettoyage : et ce qu'il a fait remonter

**Trois ecrans fantomes supprimes.** `p-reactivation`, `p-premier` et `p-decrochage` etaient
`hidden` en dur dans la coque depuis la fusion du 07/09 : plus aucune piece n'y menait, leurs
listes avaient fusionne dans « Mon commerce ». Mais `renderAll()` appelait toujours leurs trois
fonctions, qui fabriquaient a chaque rendu des tableaux HTML complets, lignes, colonnes et
boutons compris, ecrits dans des conteneurs que personne ne verrait. Le commentaire disait
« calculent et memorisent » : elles ne calculaient rien, les calculs sont dans les agents, que
`agentClients()` appelle lui-meme.

**Ce n'etait pas que du menage : quatre exports etaient perdus avec eux.** Leurs boutons vivaient
dans ces trois ecrans masques. Ted ne pouvait plus les cliquer depuis quatre jours, et rien
n'avait echoue, parce qu'un bouton qu'on n'affiche pas ne se plaint jamais.

Ils ne font pas doublon avec « Exporter la liste » de « Mon commerce », qui sort la liste unifiee,
un client une fois avec sa raison principale. Ceux-ci sortent les listes ENTIERES de chaque
analyse, avec les colonnes de travail que l'autre n'a pas : cadence, rythme, fiabilite et date de
prochaine commande attendue pour la relance ; CA de l'exercice precedent, CA en cours et euros
perdus pour le decrochage. L'e-mail est en deuxieme colonne dans les quatre, pour que le fichier
parte tel quel dans un outil d'emailing.

**Arbitrage de Ted : les rebrancher, pas les supprimer.** Ils sont sous la liste de « Mon
commerce », dans un bloc qui dit en une phrase en quoi ils different du bouton du dessus.

**Et ils prennent leurs donnees a la source, maintenant.** Ils lisaient `premierList`, `reactList`
et `decroList`, trois listes que les ecrans fantomes remplissaient en se peignant. Un export qui
depend d'un ecran affiche rend un fichier vide le jour ou l'ecran ne s'affiche plus : c'est
exactement ce qui les attendait. Ils appellent leur agent, comme tout le reste.

**Nouveau banc, `npm run banc:commerce`**, douze controles. Il garde deux choses qu'aucun autre
ne voyait : le verdict reste au-dessus de la liste, et les quatre exports restent atteignables.

Il a trouve deux defauts de banc avant de trouver un defaut de code, et les deux valent d'etre
notes :

- **Un scenario de test trop sage ne teste rien.** Cinq clients qui achetent tous les mois en
  croissance, c'est une piece vide : personne a rappeler, donc pas de liste, donc pas d'exports, et
  cinq controles en echec pour une seule raison. Il a fallu fabriquer trois habitues de 2025 qui ne
  reviennent pas en 2026.
- **Reperer un bloc par un texte qu'un autre bloc porte aussi.** Le controle « le top clients est
  DANS le pied » cherchait `<th>Client</th>`, que la grande liste du dessus porte egalement : il
  comparait deux positions dans le mauvais tableau. Il cherche maintenant `CA HT</th>`, qui
  n'existe que dans le pied.

Les reperes figes du banc passent de 23 a 20.

`npm run verif` : deux chartes CONFORME, 397 controles, zero echec.

### Verification de cloture : le code, puis le rendu

**Dans le code.** Trois trouvailles.

1. L'export de « Mon commerce » produisait encore un fichier `mes-clients-*.xlsx`, avec un onglet
   « Mes clients ». Corrige : le fichier porte le nom de la piece.
2. Deux fonctions rendues orphelines par la redecoupe, supprimees : `repCard()` (morte avec les
   « Repartitions detaillees » de l'apercu) et `confBadge()` (morte avec l'ecran fantome de
   reactivation).
3. **Six fonctions etaient DEJA mortes avant le chantier**, verifie en relisant le fichier au
   commit qui le precede : `clientStats`, `gesteFiche`, `monthsBetween`, `renamePerso`,
   `topEntries`, `topKeys`. Elles ne viennent pas de la refonte, elles ne sont pas touchees, et
   elles sont signalees a Ted. La distinction valait le detour : elle separe ce que j'ai casse de
   ce qui trainait deja.

**En vrai, par capture.** Une page autonome montee avec les vraies feuilles et le vrai moteur,
443 lignes de vente fabriquees sur 19 mois, les quatre pieces peintes et photographiees. Elle a
trouve un defaut que ni la charte, ni les quatorze bancs, ni la relecture n'avaient vu :

**TROIS SIGNAUX DE « MON CAP » RENVOYAIENT A DES ECRANS SUPPRIMES.** « Detail dans l'onglet
Decrochage », « liste complete dans l'onglet Reactivation », « detail dans l'onglet Canaux ». Les
trois avaient disparu pendant la redecoupe. Le code marchait, les bancs etaient verts, et la
phrase envoyait le vigneron nulle part. Ils nomment maintenant la piece ET le filtre : « la liste
est dans Mon commerce, filtre Recul confirme ».

C'est la lecon du chantier, et elle est dans CLAUDE.md : **quand une piece bouge, relire ce que les
textes DISENT, pas seulement ce que le code calcule.**

**Trois defauts preexistants signales, pas corriges** (ils ne viennent pas de la refonte) :

- les quatre compteurs de « Mes cuvees » ont titre et valeur INVERSES : « cuvees » en gros, « 6 »
  en petit au-dessus. Les arguments de `kpiCard()` sont passes a l'envers, sur les quatre cartes.
- « Ton mois le plus creux est historiquement janv.. », avec deux points : la phrase prend un
  abrege de `MOIS_FR`, ce que le commentaire de `periodLabel()` deconseille explicitement.
- le bandeau de « Mon commerce » titre « 2025 vs 2026 » quand tout le reste ecrit « 2026 vs
  2025 ». C'est `bridgeHero()`, qui passe `prev` avant `cur`.

**Limites de la capture, pour qui la refera** : le conteneur n'atteint ni Google Fonts ni le CDN de
Chart.js. Les fontes tombent sur les substituts systeme, un tracage de secours remplace Chart.js.
Elle vaut pour la MISE EN PAGE et les TEXTES, pas pour la typographie ni la fidelite des graphes.

### Ce qui reste ouvert

Les quatre lots de la redecoupe sont faits. « Mon annee » et ses vingt-six blocs sont devenus
quatre pieces a trois etages, et deux ecrans ont disparu (Apercu, Evolution) sans qu'aucune
fonction soit perdue.

Le lot 5 de nettoyage est fait lui aussi : le chantier est clos.

**Deux questions posees pendant la redecoupe et laissees ouvertes, a rouvrir un jour.** Les quatre
mouvements de clientele (nouveaux, hausse, baisse, perdus) et les trois motifs existants (recul,
cadence, premier achat) decoupent la meme population de deux facons differentes, dans un seul
ecran : en garder une, ou expliquer clairement la difference. Et les trois chiffres
du cap pourraient remonter dans le bandeau du haut, qui porte deja la date, la lune et la phrase
du jour.

---

## 11/09/2026. Le courrier demande la permission, et sait s'arreter

Demande de Ted, mot pour mot : « on va resoudre les 3 choses. lien de desinscription avec le choix :
emails de rappel / email bimensuel choisir ses preferences d'email / le footer d'email / courrier va
rester pour l'instant. / Corrige src/rgpd.njk ».

### Ce qu'on a trouve en ouvrant, et qui n'etait pas dans la demande

Le pied du courrier disait « tu l'as demande dans les reglages de ton bureau ». **C'etait faux.**
Le bloc « Le courrier » des reglages ne portait que la case de l'edition bimensuelle ; le courrier
du matin, lui, partait a tout compte present dans la vue, sans interrupteur. La demande portait sur
le lien qui manquait ; le trou reel etait le consentement qui n'existait pas.

C'est ce qui a decide la forme du lot 12 : ajouter un lien sans ajouter la case aurait produit une
page de desinscription qui coupe quelque chose que personne n'avait allume.

### Les deux decisions de Ted

1. **On entre par les deux chemins.** Un jeton dans le lien du mail, qui marche sans mot de passe,
   ET les memes cases dans les reglages pour qui est connecte. Le premier est celui qui compte :
   se retirer doit etre aussi simple que consentir (RGPD 7-3), et quelqu'un qui a perdu son acces
   doit pouvoir s'arreter quand meme.
2. **Le courrier du matin est eteint par defaut.** Un nouvel inscrit ne recoit rien tant qu'il n'a
   pas coche. C'est ce qui rend la phrase du pied vraie.

### Ce qu'on a ecarte

**L'identifiant du compte dans l'URL de desinscription.** `profils.id` est l'identifiant
d'authentification : il traine dans des jetons de session, des journaux, des exports. Un jeton
dedie se revoque d'un `update` sans toucher au compte, et il ne sert qu'a ca. Meme raisonnement
que `COURRIER_CLE` plutot que la cle de service.

**Un second secret `URL_DESINSCRIPTION`.** Il existait, vide. Deux secrets qui doivent designer le
meme deploiement sont deux secrets qui peuvent le designer differemment : le jour ou on branche le
domaine, on change `URL_BUREAU`, on oublie l'autre, et le mail part avec un bouton vivant et un
lien de desinscription mort. L'adresse des preferences se DEDUIT maintenant de celle du bureau.

**Une confirmation avant de couper.** Le bouton « Ne plus rien recevoir » agit tout de suite. Une
desinscription qui demande « es-tu sur ? » est une desinscription qu'on peut rater ; le sens
inverse, lui, ne coute rien a qui s'est trompe.

### Deux erreurs de ma main, toutes deux rattrapees avant livraison

**J'ai ecrit dans la politique de confidentialite que le journal des envois est conserve un an,
alors que rien ne l'effacait.** Une duree annoncee et non tenue est une declaration fausse, pas un
oubli. Le lot 13 pose la purge hebdomadaire. Regle consignee dans CLAUDE.md.

**Le bouton « Ne plus rien recevoir » etait invisible.** `btn--ghost` peint en couleur papier,
pour les sections sombres ; sur le fond clair de la page, il n'existait pas a l'oeil. Le code se
relisait bien. C'est la capture d'ecran qui l'a montre. Un bouton de desinscription invisible est
le pire defaut possible sur cette page, et personne ne l'aurait signale.

### Ce qui reste ouvert

- Le sous-domaine `courrier.` reste, decision de Ted, a revoir si la delivrabilite bouge.
- Rien ne limite le nombre d'appels aux deux fonctions publiques. A 128 bits d'entropie c'est hors
  d'atteinte, et le gain serait de basculer la case d'un inconnu. A revoir si ces fonctions servent
  un jour a autre chose.
- La region de Resend n'est pas verifiee. La politique dit desormais que le courrier du matin
  transite par eux avec son contenu : il faut regarder si le compte est bien en region europeenne.

---

## 10/09/2026, fin de journee. Le panneau de liege devient une pile de travail

Demande de Ted, mot pour mot : « il faut le rendre bcp plus usefull. il y a des KPI qui servent a
rien. il faut que ca soit cliquable et que les elements decides apparents servent a quelque chose.
je veux du dynamisme. »

### Le diagnostic, avant de toucher au code

Le probleme n'etait pas que certains chiffres etaient inutiles, c'est que **les six repondaient a
« combien » et aucun a « et maintenant, quoi »**. Quatre constats, tous verifies dans le code :

1. **Deux punaises disaient la meme chose.** « 5 gestes cette semaine » et « 1,3 geste par
   semaine » sortent du meme tableau, la seconde etant la premiere divisee par quatre. Deux
   punaises, un seul fait.
2. **Quatre des six ne se cliquaient pas.** Seules « autres taches » et « ta derniere analyse »
   portaient un lien.
3. **Le pire n'etait pas ce qu'il montrait, c'est ce qu'il cachait.** Le filtre des rappels etait
   `rappel > aujourd'hui`, strictement l'avenir. **Une promesse faite pour le 3 septembre et pas
   tenue n'apparaissait nulle part sur le liege.** Le chiffre le plus actionnable du bureau etait
   le seul absent.
4. **Le panneau ne bougeait jamais** : peint d'un coup, sans transition, identique a 8 h et a 18 h.

### Les arbitrages, tranches par Ted

- **Le panneau devient une pile de travail**, et pas un tableau de bord. Une punaise porte UNE
  chose a faire, dans l'ordre ou elle presse, avec les gestes qui la font disparaitre. Ecarte :
  « garder les six et tout rendre cliquable », qui n'aurait rien regle au fond, « 1,3 geste par
  semaine » reste inactionnable meme cliquable.
- **Le retard prend la premiere punaise, en rouge**, et disparait quand il n'y a rien en retard.
  Ecarte : le fondre dans « rappels a venir », ou il se serait noye dans le total.
- **Du dynamisme, trois sens sur quatre** : le contenu change dans la journee, ca bouge a l'ecran,
  on peut agir depuis la punaise. Ted n'avait pas coche « ca reagit sans recharger » ; c'est venu
  avec le troisieme, parce qu'un bouton « Fait » qui laisse la punaise en place apprend au
  vigneron que ses clics ne servent a rien.

### Ce qui a ete decide en cours de route, et pourquoi

- **Les compteurs ne sont pas jetes, ils sont declasses.** Gestes de la semaine, moyenne, faits du
  jour, carnet, fraicheur de l'analyse tiennent dans l'etiquette de la zone. Ils meritaient une
  ligne, pas une punaise chacun.
- **L'age de l'analyse ne revient qu'au-dela de quinze jours.** Cette punaise annoncait « du jour »
  tous les jours ou tout allait bien : elle occupait une place pour dire qu'il n'y avait rien a
  faire.
- **Le bilan du soir ne chasse jamais du travail.** Premiere capture : il prenait la cinquieme
  place et poussait dehors une tache ET la punaise de renvoi vers Mes taches, seule porte du
  panneau vers le reste. Il ne se montre que s'il reste une place.
- **Cinq punaises au plus, et le chiffre vient d'une capture.** A six, sur 1200 px, la sixieme
  part seule sur une deuxieme rangee avec quatre cases de liege nu a cote d'elle.
- **Un post-it n'est plus un `<a>`.** Il contenait des boutons, ce que le HTML interdit, le meme
  defaut que le sous-main avait deja paye. C'est le libelle qui porte le lien, et son `::after`
  couvre tout le papier : une seule cible pour la souris, deux arrets nets pour le clavier.
- **Aucune troisieme couleur de punaise.** L'etat « fait » avait deja du recevoir un FOND parce
  que sa punaise verte tombait a 2,25:1 sur le liege. Ce qui presse le dit donc en toutes lettres
  dans le chiffre du post-it, « aujourd'hui », « en retard », « dans 3j » : un mot se lit, une
  teinte se devine.

### Un defaut trouve par accident, et il bloquait `npm run verif`

**`npm run banc:journee` n'est jamais sorti tout seul, et personne ne le voyait** parce qu'il
affichait son verdict avant de rester en l'air. La page pose `setInterval(peindreLune, 30 minutes)`
au `DOMContentLoaded` : ce minuteur appartient a la fenetre jsdom et tient la boucle d'evenements
de node ouverte. La chaine de controles s'arretait la, sans un mot, **un enchainement bloque se lit
comme un controle qui reflechit.** C'etait deja vrai avant cette session, sur `HEAD`. Corrige par
un `process.exit` explicite en fin de banc, code de sortie du verdict.

### Ce qui a ete verifie

`npm run verif` complet, au vert de bout en bout (et il se termine, maintenant). Le panneau
n'etait couvert par AUCUN banc, c'est exactement pour ca que son pire defaut a vecu si longtemps.
Section 5 et 5 bis ajoutees a `banc-journee.mjs`, 16 controles, dont le premier porte sur le
retard et doit rester le premier. Deux captures, 1200 px et 420 px, relues avant de clore : la
premiere a fait tomber le bilan de la cinquieme place, la seconde a fait passer le panneau a deux
colonnes sur telephone (en une seule, cinq punaises font 2 300 px de haut, et il fallait franchir
le panneau en entier avant d'atteindre le sous-main).

### Deuxieme passe, sur la vraie page de Ted

Il a envoye une capture de son bureau reel, et elle a dit trois choses que le banc et
l'apercu ne pouvaient pas dire, parce qu'aucun des deux ne porte SA donnee.

1. **Ses cinq taches n'ont aucune date.** Elles tombent donc toutes dans le bloc « 5 autres
   taches » et aucune ne monte sur le liege : `punaises()` ne promeut que ce qui tombe dans
   les sept jours. Le panneau ne compte pas mal, il n'a rien de date a epingler.
2. **Le panneau ne voit pas ses quarante clients**, et c'est voulu : il lit `suivi`, les
   rappels poses A LA MAIN, pas les `signaux` deposes par le tableau de bord. Ses cinq
   rappels sont tous a venir, donc ni retard ni « aujourd'hui ».
3. **« Une echeance dans -26 jour »**, dans sa phrase d'accueil, et ce n'etait pas moi.

**Les deux arbitrages de Ted sur les deux premiers points : on ne change rien.** Une tache
sans date n'est pas du travail du jour, elle attend, et le panneau maigre est un signal
honnete. Les quarante restent au sous-main, qui est juste en dessous et les liste deja avec
leurs trois gestes : deux endroits qui repondent « qui j'appelle » finiraient par se
contredire, et c'est deja ecrit dans `CLAUDE.md`.

**Le troisieme etait un vrai defaut, et ma premiere correction etait fausse.** J'allais
ecrire « une echeance en retard de 26 jours ». Le code dit autre chose :
`laPlusPressante()` filtre sur `jours >= 0 OU enCours`, donc **un nombre negatif ne passe
que pour un evenement EN COURS** - chez lui, les vendanges, commencees il y a 26 jours et
qui durent encore. Son bloc calendrier l'affichait deja correctement, « En ce moment ».
J'aurais remplace une phrase fausse par une autre. Le vocabulaire vient maintenant de
`bdv-echeances.js`, sa fonction `phrase()`, plutot que d'un deuxieme jeu de mots invente
ici : la meme obligation ne doit pas se dire de deux facons sur la meme page.

Le controle ajoute au banc est ecrit **en negatif et sans fixture d'echeance** : « la phrase
d'accueil n'annonce jamais un futur negatif ». Il attrape la classe entiere, pas le cas du
jour, et il n'a besoin d'aucune donnee particuliere pour mordre.

### Troisieme passe : deux natures de punaise, pas une

Ted, devant sa vraie page : « les gros mots AUJOURD'HUI et DEMAIN en gros, ca perd le
message. Autant mettre l'information importante. » Il avait raison, et la cause etait plus
profonde qu'une hierarchie mal reglee : **j'avais force deux natures dans une seule forme.**

- **La punaise de COMPTE** : « 3 rappels en retard », « 5 autres taches », « 9 faits
  aujourd'hui ». Le chiffre EST le message, il garde le grand emplacement.
- **La punaise de CHOSE A FAIRE** : « DRM de septembre », « Domaine Jayama ». Le message est
  le titre. L'echeance descend en TAMPON, une etiquette en capitales posee au-dessus.

**Ce n'etait pas une permutation, et c'est ce qui m'a arrete d'abord.** Le grand emplacement
est dessine pour un chiffre, 2 rem en serif grasse : « Commander des bouchons » dedans fait
trois lignes. D'ou un troisieme palier de taille, qui suit **la longueur et pas la nature** -
un chiffre est court, un titre ne l'est pas, et c'est tout ce que le dessin a besoin de
savoir. Mesure faite dans un vrai navigateur apres coup : 22,4 px jusqu'a seize signes,
18,4 px au-dela.

**Le troisieme cas, que Ted n'avait pas signale et qui avait le meme defaut** : quand il n'y
a qu'UN rappel en retard, le gros « 1 » n'apprend rien a personne, alors que le nom du client
dit tout et que c'est lui qu'on appelle. Regle adoptee : **a un seul on nomme, a plusieurs on
compte**, et le plus vieux est nomme en dessous. Meme chose pour les rappels du jour. Et la
punaise « prochain rappel » etait deja de cette nature sans qu'on l'ait vu : « 9 oct. » en
gros et le client en petit. La date y est devenue le tampon.

**Le lien a suivi.** Il ne vit plus sur le libelle (les punaises de chose a faire n'en ont
plus) mais sur la LIGNE DE TETE, quelle qu'elle soit : le libelle s'il existe, la valeur
sinon. Jamais sur un chiffre nu, qu'on ne songerait pas a cliquer. `.postit__l--lien` est
devenu `.postit__lien`.

**Un piege evite de justesse dans le banc des taches** : la tache d'essai s'appelle « en
retard », ce qui est aussi le mot du tampon. Un seul controle sur les deux champs aurait ete
vert sans dire lequel il avait lu. Ils sont verifies separement. Et une section 5 ter a ete
ajoutee pour la forme « compte » a trois retards, qui n'existait dans aucun jeu d'essai : un
banc qui ne verifie qu'une branche sur deux laisse l'autre pourrir tranquillement.

### Le vocabulaire : « action » et « accompli »

Ted, en fin de session : « on change gestes par actions et faits par accomplis ».

**Le premier est un echange direct, le second ne l'est pas.** Le mot « fait » vit a deux
endroits de nature differente : un COMPTE (« 9 faits aujourd'hui ») et un BOUTON (« Fait »,
sur la punaise et dans Mes taches). « 9 accomplis aujourd'hui » se lit ; un bouton marque
« Accompli » se lit comme un etat et plus comme un ordre. **Le compte a change, le bouton
non**, et Ted arbitrera s'il veut aussi le bouton.

**L'en-tete de colonne du sous-main a suivi**, « Geste » devenu « Action » : le mot avait
change au panneau, et une meme page ne dit pas deux mots pour la meme chose.

**Les NOMS DE CODE ne bougent pas** : `BdvCrm.GESTES`, `.postit__gestes`,
`data-punaise="crm-appel"`, `tache-fait`. Un renommage traversant trois fichiers pour un mot
d'ecran n'apporterait qu'un risque - c'est la regle deja posee pour `date` dans
`bdv-echeances.js`. **A savoir en relisant : l'ecran dit « action », le code dit « geste ».**

Le controle ajoute au banc est ecrit **en negatif sur l'ancien mot** (« le panneau ne dit
plus geste nulle part ») : c'est ce qui attrape une punaise oubliee lors d'un ajout futur,
alors qu'un controle sur le nouveau mot ne verifierait que la ligne qu'on vient d'ecrire.

### Ce qui reste ouvert

- **Le bouton « Fait » n'est pas devenu « Accompli »**, faute d'un mot qui marche a la fois
  comme etat et comme ordre. A trancher avec Ted.
- **Le faux `BdvTaches` de `scripts/apercu-panneau.mjs` rejoue `punaises()` a l'identique.** C'est
  un doublon assume : jsdom ne charge pas les `<script src>`. Si l'ordre des punaises change dans
  `src/js/bdv-taches.js`, il faut le changer la aussi, sinon l'apercu montre un panneau qui
  n'existe plus.
- **La punaise de renvoi vers Mes taches saute les jours charges**, faute de place. Chaque punaise
  de tache mene deja a `#taches`, donc la porte existe ; a surveiller si Ted la cherche.
- **`npm run apercu:panneau`** ecrit `_apercu/panneau.html`, autonome, a ouvrir d'un double-clic.
  Le panneau a cinq etats et aucun ne se voit sans compte : on les regardait en poussant en
  production, ce qui est la plus mauvaise facon de juger un dessin.

---

## 10/09/2026, apres-midi. Le premier vrai courrier, et ce que la messagerie en avait jete

Trois defauts du dessin, tous trouves dans la meme heure, tous dans le PREMIER courrier
reellement recu dans une boite. Le point commun, et c'est le vrai enseignement : **aucun
n'etait visible dans `npm run courrier`.** L'apercu enferme chaque mail dans un cadre etroit et
le rend dans un navigateur. On validait un dessin qu'on n'a jamais recu.

### Les trois defauts

1. **Les bandes de section arrivaient sans fond.** Leur couleur etait posee sur la seule balise
   `<table>`, en propriete raccourcie `background` ; Gmail l'a jetee. Creme clair sur creme
   clair : « Ce matin », « Les jours qui viennent », « Ta file de travail » illisibles, et
   l'alternance beige/blanc des lignes disparue avec. Les jauges tenaient : elles portaient deja
   `bgcolor`. La regle etait ecrite dans le fichier et n'avait pas ete appliquee partout.
2. **La largeur n'etait pas bornee.** La consigne du 09/09, « le papier occupe toute la
   largeur », avait ete traduite par « le tableau fait 100 % ». Dans un Gmail ouvert en grand :
   1800 px, montants a un metre des noms, histogramme etire. Ce qui doit occuper toute la
   largeur, c'est le fond ; le contenu tient dans les 560 px pour lesquels il a ete dessine --
   c'est l'arithmetique de l'histogramme, 8,33 % de 560 px.
3. **Les trous de perforation n'arrivaient pas.** Ils etaient un `radial-gradient`. Gmail jette
   les degrades, Outlook aussi. Le commentaire du fichier l'annoncait pour Outlook et jugeait la
   perte acceptable : elle ne l'etait pas, l'effet imprimante EST le dessin.

### Les arbitrages, dont un refus

**L'image de fond hebergee est refusee**, et pas par gout : les messageries bloquent les images
par defaut, donc le trou n'apparaitrait qu'apres un clic, et le mail ne doit dependre d'aucune
adresse du site -- l'envoi de 8 h et le site restent deux pannes independantes. Donc des
cellules de tableau, un trou par ligne. Le pas ne fait plus 26 px fixes, il suit les lignes, et
c'est plus juste : une ligne de mail n'a pas de hauteur fixe, un pas fixe finit par percer un
texte en deux. Sous Outlook le trou sera un carre, faute de `border-radius`.

**Consequence de structure a connaitre** : l'encart de 18 px n'est plus porte par la cellule du
papier, il est porte par chaque bloc. Sinon les trous, qui tombent DANS cet encart, etaient hors
d'atteinte des lignes. Un bloc futur qui oublie son encart touchera les filets de perforation,
et ca se voit tout de suite.

**Poids** : 41,9 ko par compte au lieu de 29,8. Le trou a ete allege d'un tableau imbrique a un
simple `div` en cours de route, ce qui a recupere 7 ko sur 49 -- a 500 vignerons, 3,5 Mo d'envoi
en moins chaque matin pour un rendu identique au pixel.

### La methode qui a fini par marcher, et celle qui a coute une heure

Ce qui a marche : fabriquer le mail en local, le **photographier a 1280 px et a 400 px**, le lire
soi-meme, puis l'envoyer dans la boite de Ted par sa propre messagerie -- sans Resend, sans la
fonction, sans son terminal. Trois essais en vingt minutes.

Ce qui a coute une heure : deviner. « Ca marche pas » et « il se passe rien » ont ete lus comme
des pannes de terminal alors que le terminal marchait -- l'appel de 12 h 22 est dans le journal
de la fonction, il a recu un **504**, `curl` attendait une reponse qui ne venait jamais. Regle
tiree de la : **demander le texte exact affiche avant de proposer un contournement**, et lire
les journaux de la fonction avant de soupconner le poste.

### Le defaut le plus dangereux de la journee, et il etait de moi

`heureAParis()` formatait l'heure en `fr-FR`, qui rend « 14 h ». `Number('14 h')` vaut NaN, et
NaN n'est egal a rien : la comparaison `heure !== HEURE_ENVOI` etait **toujours vraie**.
L'horloge aurait repondu « hors heure » vingt-quatre fois par jour, en 200, sans jamais
envoyer un courrier. Des semaines de silence sans une seule ligne rouge -- la panne exacte que
le lot 4 existe pour empecher.

Ni Node ni le banc ne formatent avec l'ICU de Deno : aucun controle hors ligne ne pouvait la
voir. Ce qui l'a attrapee, c'est `heure_paris` expose dans le rapport, qui valait `null`. D'ou
la quatrieme regle ajoutee a CLAUDE.md : **toute valeur dont depend une decision du programme
se met dans le compte rendu**, meme si elle n'interesse personne un jour normal.

Corrige en `0e12447`. Fonction en version 9, `heure_paris` rend maintenant 14, `comptes_lus`
2, aucun echec. **La fonction est reparee et porte le bon dessin.**

Reste : l'horloge de 8 h, `URL_BUREAU` que Ted regle avec le branchement du domaine (assume :
il est seul destinataire, un bouton mort ne coute rien avant le premier vigneron), et
`ecarterLesSuivis()` a supprimer.

### LE PREMIER COURRIER EST PARTI TOUT SEUL, 11/09/2026 a 8 h 05

Rapport du passage : `heure_paris: 8`, `comptes_lus: 2`, **`envoyes: 2`**, `echecs: []`,
`deja_envoyes: 0`, `hors_liste: 0`, `sans_desinscription: 0`. Et dans `courrier_envois`, deux
lignes au 2026-09-11, reservees a 08:05:04 toutes les deux, chacune avec son `resend_id` et
aucun `echec`. Sujets : « 2 a faire, 5 clients a voir » et « 1 a faire, 5 clients a voir ».

Le passage de 7 h 05, juste avant, disait encore « hors heure ». La bascule s'est donc faite
sur le seul critere de l'heure de Paris, sans intervention.

Lot 4 termine. Le courrier du matin est en service.

### LA CHAINE EST PROUVEE DE BOUT EN BOUT, nuit du 10 au 11/09

Apres correction de la cle : neuf passages, zero rate, zero 401. Chaque heure, la fonction
repond 200 avec `issue: "hors heure"` et l'heure de Paris juste.

Deux details de ces passages ont verifie EN PRODUCTION deux choix qui n'avaient ete que
raisonnes :

- a 00 h 05, le rapport dit `heure_paris: 0` et non 24. C'est `hourCycle: 'h23'` qui tient, le
  cas exact pour lequel il avait ete choisi contre `hour12: false`.
- au meme passage, `jour` dit **2026-09-11**. Minuit cinq a Paris, c'est 22 h 05 UTC la veille :
  un code qui aurait lu la date en UTC aurait ecrit 2026-09-10. C'est precisement le piege que
  `jourAParis()` existe pour eviter, et il s'est verifie tout seul.

### L'HORLOGE FRAPPE, MAIS ELLE SE FAIT REFUSER, 17 h

Verification du premier declenchement reel, faite sans rien demander a Ted.

**Bonne nouvelle : toute la chaine tient.** `cron.job_run_details` montre les passages de 16 h 05
et 17 h 05, `status: succeeded`. pg_cron declenche, pg_net poste, la fonction recoit et repond.
Chaque maillon est prouve.

**Mauvaise nouvelle : elle repond 401.** « En-tete x-courrier-cle absente ou fausse. » Deux
passages, deux refus, et `courrier_envois` toujours vide.

**La cause, trouvee en mesurant la valeur plutot qu'en la lisant** : le secret inscrit dans la
tache fait **50 caracteres**, commence par `<` et finit par `>`. Le vrai secret en fait 48. Les
chevrons du gabarit (`'<COURRIER_CLE>'`) sont partis avec la valeur : le mot a ete remplace,
les chevrons sont restes.

REGLE, et c'est la deuxieme fois de la journee que ce piege coute une heure : **un gabarit ne
doit pas porter de delimiteurs qui ressemblent a de la valeur.** `<COURRIER_CLE>` et `TON-CODE`
ont tous les deux ete colles tels quels ou a moitie. Ecrire `colle-ton-secret-ici`, sans
chevrons ni majuscules, ne laisse rien a retirer.

**Ce que ce controle a evite** : demain a 8 h 05, l'horloge aurait frappe, la fonction aurait
repondu 401, aucun mail ne serait parti, et RIEN ne l'aurait signale. Ni erreur, ni ligne rouge.
Juste une boite vide et un journal `courrier_envois` sans ligne. C'est exactement la panne que
la regle 4 -- mettre les chiffres de travail dans le rapport -- existe pour rendre visible, et
c'est la premiere fois qu'elle sert avant le dommage plutot qu'apres.

### L'HORLOGE EST POSEE, 15 h

`supabase/lot11-courrier-horloge.sql`. pg_cron et pg_net installes, une tache
`courrier-du-matin`, rythme `5 * * * *`, active. Controle en base : la commande de la tache ne
contient PAS `maintenant=1` -- c'est le seul controle qui compte sur cette ligne, ce parametre
annule le test de l'heure et ferait partir le courrier vingt-quatre fois par jour.

Elle frappe toutes les heures et la fonction refuse 23 fois sur 24. Pas de cron a 8 h :
pg_cron travaille en UTC, ce qui donnerait 10 h a Paris l'ete et 9 h l'hiver.

**Ce qu'il faut regarder demain, et rien d'autre** : une ligne dans `courrier_envois` au jour
du 11/09. Une horloge qui ne se declenche pas ne produit aucune erreur, elle produit du
silence. Le frein est `select cron.unschedule('courrier-du-matin');`, garde en bas du fichier.

### Reste ouvert, par ordre

1. ~~La fonction en ligne ne repond plus depuis 12 h 10~~ REPARE, version 9 : `index.ts` a recu le contenu de la
   fabrique lors d'un copier-coller. Elle demarre en 23 ms puis n'ecoute rien, d'ou les 504 et
   les expirations. A reparer en recollant `_deploiement/courrier-matin/index.ts`.
2. Le dessin du courrier attend la validation de Ted sur l'essai 3.
3. L'horloge de 8 h. `pg_net` est installe depuis cet apres-midi, `pg_cron` ne l'est pas.
4. `ecarterLesSuivis()` a supprimer, la vue fait deja ce travail.

---

## 10/09/2026, suite. Refonte des articles : la liste, la page de lecture, et le socle de référencement

Écrit et commité, **pas encore poussé**. Le contrôle `npm run charte` passe : 0 échec, 8 notes.

### Le vrai défaut n'était pas le dessin des cartes, c'était la largeur

La grille de trois cartes vivait dans `.container`, large de 760 px. Chaque colonne faisait donc
(760 − 48 de marge − 48 de gouttières) / 3 = 213 px, moins 56 px de marge intérieure de carte :
**157 px de mesure utile**. Un titre de quatre-vingt-dix signes en Fraunces s'y casse sur six
lignes, trois mots par ligne. Aucun réglage de carte ne répare ça. Une fois la largeur rendue au
titre, la carte n'a plus de raison d'être — d'où la liste en une colonne, qui est d'ailleurs ce
qu'utilisent tous les éditeurs sérieux ; la grille de cartes est le réflexe des thèmes de blog.

### La taxonomie affichée était la mauvaise

Les articles portaient **deux** étiquettes depuis le départ : `pilier` (« Process 🔧 »,
« Marketing 📈 »…), seule affichée, et `categorie` (« Réglementation », « Vendre & fidéliser »…),
affichée nulle part. Et c'est la mauvaise qui était montrée : « Process » ramassait dix articles
dont les tournées de livraison et la politique RSE, « Organisation » ramassait l'œnotourisme et la
vente au domaine.

Ted a tranché : on part de `categorie`, et on regroupe ses six valeurs en **quatre rubriques**
(`src/_data/rubriques.js`). « Vente directe & Œnotourisme » rejoint « Vendre & fidéliser »,
« Outils & données » rejoint « Gérer & s'organiser » : deux rubriques à un ou deux articles
auraient fait deux pages maigres, et une page maigre ne se classe pas.

Résultat : Vendre & fidéliser 8, Gérer & s'organiser 5, Réglementation & obligations 4,
Se lancer 2. Total 19 — et pas 20 : `exemple-qr-code-viti.md` porte `permalink: false`, c'est un
brouillon.

`pilier` n'est plus lu par aucun gabarit. Il reste dans les en-têtes des vingt fichiers, sans
effet. **À décider : l'effacer ou non.**

### Les filtres sont des pages, pas du JavaScript

Quatre vraies pages `/articles/rubrique/<slug>/`, fabriquées par `src/rubriques.njk`. Un filtre en
JavaScript aurait donné le même confort et rien d'autre. Quatre pages donnent quatre adresses de
plus dans l'index, un deuxième étage au fil d'Ariane de chaque article, un filtre partageable, et
un filtre qui marche sans script.

**ATTENTION AUX ADRESSES** : le `slug` de `rubriques.js` fabrique l'adresse publique. Le renommer
casse ce que Google a indexé. Le nom affiché se change librement, le slug non.

### Le socle de référencement, qui n'existait pas du tout

`src/_includes/components/tete-seo.njk` rassemble toute la tête lisible par les moteurs. Avant :
aucun `canonical`, aucun `og:url`, aucune donnée structurée, et `og:type="website"` sur les vingt
articles.

Maintenant, et vérifié sur les 35 pages construites : `canonical` absolu partout, Open Graph
complet, `og:type="article"` sur les articles, `article:published_time` et `article:modified_time`,
et un **graphe JSON-LD unique** par page (Organization + WebSite, plus BlogPosting + BreadcrumbList
sur un article, plus CollectionPage + BreadcrumbList sur une rubrique). Les 35 blocs JSON-LD
parsent sans erreur.

Trois arbitrages dans ce fichier :

- **Un seul bloc `@graph`, pas plusieurs `<script>`.** Deux blocs décrivant la même entité
  obligent le moteur à deviner lequel fait foi.
- **`BreadcrumbList` est gardé, `FAQPage` et `HowTo` ne sont pas ajoutés.** Le fil d'Ariane est le
  seul résultat enrichi encore actif côté article ; les résultats enrichis FAQ ont été retirés de
  Google Search en mai 2026, HowTo en 2023.
- **L'auteur est une donnée, jamais un nom en dur.** Règle du flambeau : `"author"` sort du champ
  `auteur`, et la page de référence est `/la-redaction/` pour tout le monde.

`src/sitemap.njk` et `src/robots.njk` : il n'y en avait aucun. Le sitemap porte `lastmod` et
**rien d'autre** — Google ignore `changefreq` et `priority`. `lastmod` sort de la date de l'article,
jamais de la date du build : sinon les dix-neuf articles seraient « modifiés » chaque nuit et la
balise perdrait toute crédibilité pour l'ensemble du site. `robots.txt` n'a **aucun `Disallow`**, et
c'est voulu : une page qu'on veut désindexer doit être explorable pour que sa balise `noindex` soit
lue.

### La page de lecture : l'ordre des blocs

fil d'Ariane → rubrique → titre → chapô → signature et dates → image → sommaire → corps →
signets → qui écrit → du même rayon → plus ancien / plus récent → porte du compte.

Deux choix contre-intuitifs :

- **Le sommaire est dans le flux, pas en rail collant.** Le rail de gauche impose deux colonnes à
  toute la page, celui de droite se confond avec de la publicité, et dans les tests publiés les
  lecteurs ne *remarquent* pas un sommaire collant. Il n'apparaît qu'à partir de trois sections :
  un sommaire de deux lignes fait perdre du temps au lieu d'en faire gagner.
- **Le chapô est dans le bandeau, pas dans le corps**, et il vient de `description` : un seul texte
  à écrire, une seule promesse, aucun risque de divergence avec la méta description.

Les ancres des titres de section sont posées par un filtre (`avecAncres`) qui relit le HTML déjà
rendu, et le sommaire par un autre (`sommaire`) qui lit le même. Fait par expression régulière et
pas par un module markdown-it : le dépôt n'a que trois dépendances de développement.

`scroll-margin-top: 5rem` sur les `h2` et `h3` du corps. Sans lui, un saut depuis le sommaire cache
le titre visé derrière la barre de navigation collante.

### Deux défauts trouvés à la capture, et pas autrement

1. **Le compte d'articles s'affichait en italique de corps 1,1 rem au lieu de petites capitales**,
   et à 0,6 d'opacité réelle. La feuille porte depuis longtemps une règle sur le paragraphe du
   bandeau, de spécificité (0,1,1) ; une classe seule vaut (0,1,0) et perd. Les trois règles de
   `.artintro__*` sont donc écrites sous le sélecteur du bandeau. Et l'opacité est remise à 1
   explicitement : la transparence d'un texte se règle par le jeton de couleur, jamais deux fois.
2. **La carte « du même rayon » s'étirait sur 1 100 px** quand la rubrique n'avait qu'un voisin —
   « Se lancer » n'a que deux articles. `auto-fit` remplacé par trois colonnes fixes.

Le contrôle `charte` en a trouvé deux autres : sept tailles en dur ajoutées au-dessus du plafond
(rabattues sur les pas de l'échelle), et un commentaire qui **avalait une règle** parce qu'il citait
un sélecteur suivi d'accolades. Le garde-fou a bien mordu.

### Ce qui reste, et qui n'est pas fait

- **Dix-neuf titres sur vingt dépassent soixante signes**, et **les vingt descriptions dépassent
  cent soixante**. Tous sont donc tronqués dans les résultats Google. Les gabarits lisent déjà deux
  champs facultatifs, `titre_seo` et `resume`, qui gagnent sur `title` et `description` quand ils
  sont présents. **Aucun article n'en porte encore.**
- **Les adresses des articles sont `/posts/<slug>/`**, pas `/articles/<slug>/`. Un mot anglais dans
  une adresse française, et un chemin qui ne correspond pas au fil d'Ariane. Changer coûte des
  redirections : à décider avant que le référencement ne s'installe.
- **Les polices sont chargées depuis Google Fonts en feuille bloquante.** C'est le premier poste de
  gain sur le temps d'affichage. Les auto-héberger est un lot à part.
- **Aucun article ne porte d'image.** L'emplacement existe dans les deux gabarits (`image`,
  `image_alt`, `image_legende`) et ne dessine rien tant qu'il est vide.
- La barre de navigation déborde à 390 px de large : elle est antérieure à cette refonte.
- `.articles-page-header` et `.articles-page-grid` sont du CSS mort, appelés par aucun gabarit.

---

## 10/09/2026, suite. Lot 4 : l'heure de Paris et l'interdiction du doublon

Ecrit et commite, **pas encore deploye, et l'horloge n'est pas posee**. Ted a choisi l'essai a la
main d'abord : un defaut se voit tout de suite plutot qu'a 8 h le lendemain.

### Ce que le lot ajoute, et ou vit chaque regle

`supabase/lot10-courrier-envois.sql` cree `public.courrier_envois`, une ligne par compte et par
jour. RLS active et **aucune politique** : personne de connecte n'y lit quoi que ce soit, seule la
cle de service y accede, et un vigneron n'y apprendrait rien qu'il ne voie deja dans sa boite.

`supabase/functions/courrier-matin/index.ts` passe de 303 a 445 lignes. Trois choses :
le controle de l'heure de Paris, la reservation avant envoi, et deux derogations dans l'URL.

### L'arbitrage qui compte : la reservation vient AVANT l'envoi

Le reflexe est d'ecrire la trace apres avoir envoye. C'est faux ici : une relance pendant que
Resend repond enverrait deux mails. La ligne est donc posee avant l'appel, et c'est **Postgres**
qui refuse la seconde, pas un `if`. Entre le « verifier » et le « ecrire » d'un code qui
verifierait lui-meme, un second appel passe.

Corollaire assume : quand Resend refuse, la ligne reste en place et **rien ne retente**. Un refus
ne dit pas si le mail est parti -- une reponse perdue ressemble a un refus. Un mail manquant coute
un jour, un mail double coute un lecteur. La reprise se demande a la main, `?rejouer=1`.

### Ce que la session a appris en passant, et qui n'etait pas le sujet

**Le 401 du premier essai ne venait pas de la fonction.** Message `UNAUTHORIZED_INVALID_JWT_FORMAT`,
en anglais : c'est la passerelle Supabase qui a rejete l'appel avant de l'atteindre, parce que la
variable de la cle anon etait vide. Le verrou `x-courrier-cle` n'avait pas ete teste du tout. A
retenir pour la lecture des codes : un refus **en anglais** vient de la passerelle, un refus **en
francais** vient de la fonction.

**Ni le conteneur ni le shell pilote sur le Mac n'atteignent `*.supabase.co`.** Verifie des deux
cotes, code 000. Tout appel a la fonction passe donc par le terminal de Ted, aujourd'hui comme a la
recette. Ce n'est pas une gene, c'est une contrainte a inscrire dans le plan de chaque lot.

**`npm run courrier:joindre` echoue depuis le shell pilote**, EPERM a l'`unlink` : le bac a sable
interdit la suppression de fichiers dans le dossier monte, et le script vide son dossier de sortie
avant de le remplir. Il marche depuis le terminal de Ted. Les deux fichiers ont ete recopies a la
main cette fois, empreintes verifiees identiques.

**Il n'existe aucun controle hors ligne de `index.ts`.** Pas de Deno, pas de `tsc` sur le poste.
Le seul filet trouve est `node --experimental-strip-types --check`, qui valide la syntaxe et rien
d'autre : ni les types, ni les appels reseau, ni le comportement. Il est passe. Le vrai test reste
l'appel de Ted.

### Reste ouvert, dans l'ordre

1. `COURRIER_CLE` est masquee dans Supabase et irrecuperable. A **remplacer** par une nouvelle
   valeur, pas a retrouver.
2. Coller `lot10-courrier-envois.sql`, dont le controle 3.4 qui prouve l'anti-doublon.
3. Deployer la fonction depuis le tableau de bord, avec les deux fichiers de
   `_deploiement/courrier-matin/`.
4. Essai a la main avec `?maintenant=1`, puis relance immediate pour verifier que le second appel
   annonce `deja_envoyes: 1` et n'envoie rien.
5. Seulement apres : l'horloge. Ni `pg_cron` ni `pg_net` ne sont installes dans la base, il faudra
   choisir entre les deux et la page Cron du tableau de bord.
6. Le compte `teddypereira88@gmail.com` existe en base et n'est pas dans la liste autorisee : il
   apparaitra en `hors_liste` a chaque passage. C'est le garde-fou qui parle, pas un defaut.


---

## 10/09/2026. Le domaine n'a jamais été branché, et le dépôt avait cessé de dire la vérité

Parti pour une simplification de confort, arrivé sur deux choses qui comptent davantage. C'est le
genre de session où le résultat cherché est le moins intéressant des trois.

### Ce que je cherchais : ne plus embarquer une copie de la fabrique

La fonction d'envoi a besoin de `src/js/bdv-courrier.js` à côté d'elle au moment du déploiement.
L'idée était de la faire lire le fichier depuis le site : `import
'https://lebureauduvigneron.fr/js/bdv-courrier.js'`. Deno gèle la dépendance au déploiement, donc
pas de dérive silencieuse, et il n'y aurait plus rien à recoller.

**Vérifié, et ça marche** : `/js/bdv-courrier.js` rend 200 sur l'adresse Vercel du projet, avec la
version à jour et `cache-control: must-revalidate`.

**Refusé quand même, pour une raison découverte en le vérifiant.** Ce jour-là,
`lebureauduvigneron.fr` était injoignable. Si la fonction avait lu son contenu depuis le site, **le
courrier de 8 h ne serait pas parti**, et le rapport aurait annoncé une erreur d'import, pas un
domaine. Le site et l'envoi du mail sont deux pannes qui doivent rester indépendantes.

La vraie douleur, le recollage manuel, se règle par un script. Pas en déplaçant une dépendance sur
le réseau.

### Le domaine `.fr` n'a jamais été branché sur Vercel

`lebureauduvigneron.fr` résout vers 217.160.0.84, dont le nom inverse est
`217-160-0-84.elastic-ssl.ui-r.com` : IONOS, le registraire. Pas Vercel. Le projet Vercel ne liste
que ses trois adresses `*.vercel.app`, et `www` ne résout pas du tout. D'où
l'`ERR_SSL_PROTOCOL_ERROR` : un domaine parqué qui ne sert aucun certificat.

Ted confirme : **le `.fr` n'a jamais servi.** Donc rien n'est cassé, quelque chose n'a jamais été
branché — et il le branchera au moment de la mise en ligne. Les enregistrements du sous-domaine
`courrier.` sont, eux, bien en place chez IONOS : c'est par là que le premier courrier est parti.

**Mais le mail portait quand même un bouton mort.** `batir()` retombait sur
`https://lebureauduvigneron.fr/mon-bureau/` par défaut, et la fonction d'envoi ne lui passait
aucune adresse. Le bouton « Ouvrir mon bureau » est la seule action du mail.

Corrigé, et pas par une constante : **`URL_BUREAU` est un secret Supabase**, passé à la fabrique.
Le jour où le domaine est branché, on change une variable, sans toucher au code ni redéployer. Le
repli reste l'adresse définitive, pour que ce soit le réglage temporaire qui se voie dans les
secrets, et pas l'inverse.

Et surtout : **l'adresse est dans le rapport de la fonction**, à chaque appel, `?apercu=1` compris.
C'est le garde-fou qui manquait. Une adresse morte dans un bouton ne fait échouer aucun envoi : le
rapport dit « envoyé », et c'est le vigneron qui tombe sur une erreur de navigateur. C'est le pire
genre de panne, celle qui ne remonte pas.

### LE DÉPÔT AVAIT CESSÉ D'ÊTRE LA SOURCE DE VÉRITÉ DE CE QUI TOURNE

Découvert par accident, en relisant le diff de ma propre modification. Le `index.ts` **commité**
portait encore l'ANCIEN verrou d'entrée, la comparaison de l'en-tête `Authorization` à la clé de
service, alors que **la fonction en production tournait depuis la veille avec le secret dédié
`COURRIER_CLE`**. Le correctif avait été déployé sans être commité.

Deuxième symptôme de la même cause : l'empreinte inscrite dans l'en-tête annonçait
`sha256 caa1c170fb9294a3, 512 lignes` quand la fabrique en faisait **880**, empreinte
`c234a02d8eb38a7d`.

La cause est structurelle, pas une étourderie. Il n'y a pas de CLI Supabase sur le poste de Ted :
le déploiement se fait depuis le conteneur, à partir de copies qui vivent là-bas, pendant que le
dépôt vit sur son Mac. Deux endroits, aucun lien mécanique. La convention « mettre la nouvelle
empreinte ici » reposait sur quelqu'un qui y pense.

**Une convention que personne ne tient n'est pas une convention, c'est un commentaire faux. Et un
commentaire faux est pire que pas de commentaire : il fait conclure à tort.**

D'où `scripts/joindre-courrier.mjs`, deux modes :

- `npm run courrier:joindre` recopie la fabrique dans `_deploiement/courrier-matin/` (non
  versionné, refait à chaque fois) et **tamponne** l'empreinte dans l'en-tête de `index.ts`.
  Personne ne l'écrit plus à la main.
- `npm run courrier:verif` n'écrit rien et compare l'empreinte inscrite à celle du fichier présent.
  **Ajouté à `npm run verif`** : si le contenu du mail bouge sans que le recollage soit refait, le
  banc le dit avant le commit.

Le script refuse aussi un `import` ou un `require` dans la fabrique. Ce contrôle existe déjà dans
l'aperçu ; il est répété là où un fichier part vers la production, parce qu'un garde-fou se place
là où la faute coûte.

Il ne déploie pas, et ne retire pas les commentaires. La première version du recollage les retirait
pour alléger l'envoi : un script qui réécrit du code pour l'alléger est un script qui peut casser du
code, le gain était de quelques kilo-octets, le risque était un mail cassé.

### L'URL de site : ma mauvaise hypothèse, et ce qu'elle a quand même révélé

J'avais annoncé que si `Site URL` portait le `.fr`, les liens de confirmation d'inscription et de
reprise de mot de passe seraient morts. **Faux, et le code de Ted le prouve.** `bdv-compte.js`
appelle `/verify` avec `{ token: code, type: 'signup' }` puis `type: 'recovery'` : ce sont des
**codes à six chiffres tapés dans la page**, jamais des liens. Aucun `redirectTo` ni
`emailRedirectTo` dans tout `src/`. `Site URL` n'est consommé par aucun des deux parcours, et c'est
pour ça qu'ils fonctionnent aujourd'hui.

Ce que la vérification a montré à la place : **`Site URL` valait `http://localhost:3000`**, le
défaut de Supabase que personne n'avait changé, et la liste **Redirect URLs** était vide.

Inerte aujourd'hui, piège demain. Le jour où un parcours passe une redirection — lien magique,
fournisseur OAuth, reprise par lien plutôt que par code — Supabase retombe sur `Site URL` puisque
la liste d'autorisation est vide, et l'utilisateur atterrit sur sa propre machine. Cette panne ne
remonte pas davantage que le bouton mort : elle ressemble à un navigateur cassé.

Décision : poser `Site URL` sur l'adresse **définitive** tout de suite, `https://lebureauduvigneron.fr`.
Même raison que pour le repli de `URL_BUREAU` : une valeur juste au lancement et inerte d'ici là ne
demande aucun suivi, une valeur provisoire demande qu'on y repense. La liste `Redirect URLs` reste
vide tant que rien ne passe de redirection ; le jour où ça change, elle devient un prérequis.

### Les gabarits d'e-mail : la question fermée, et le vrai problème à côté

Les deux gabarits relus. **Ni lien, ni `{{ .SiteURL }}`, ni `{{ .ConfirmationURL }}` : uniquement
`{{ .Token }}`.** `localhost:3000` était donc entièrement inerte, et ma crainte de départ ne valait
rien. Question fermée.

Ce que la relecture a trouvé à la place, et qui compte davantage : **ces deux gabarits étaient les
seuls écrits du produit à ne vivre nulle part dans le dépôt.** Ni `npm run charte` ni
`npm run verif` ne les voyaient, et leur `#63523D` était un jeton copié en dur sans que rien ne dise
lequel. Le jour où `--muted` change, personne ne les trouve.

C'est la même maladie que celle du dépôt qui avait cessé d'être la source de vérité de la fonction
d'envoi, sur un autre organe. Versés dans `supabase/gabarits-email/`, texte inchangé au caractère
près, avec un LISEZ-MOI qui dit que le fichier est la référence et le tableau de bord la cible :
**on modifie le fichier, on relit, puis on colle.** Jamais l'inverse. Règle générale ajoutée à
`CLAUDE.md`.

**Deux défauts de contenu relevés, non corrigés — c'est le texte de Ted :**

- **« Il expire dans dix minutes », écrit dans les deux.** Le défaut Supabase n'est pas dix minutes.
  Si le mail annonce plus court que le vrai réglage, un vigneron revenu au bout de vingt minutes
  croit son code mort, en redemande un, et consomme un e-mail du quota de cent par jour pour rien.
  À faire correspondre au réglage, dans un sens ou dans l'autre.
- **Deux voix pour la même instruction.** L'inscription dit « la fenêtre restée ouverte sur ton
  écran », la reprise dit « la fenêtre du Bureau du Vigneron ». Les deux supposent qu'une fenêtre
  existe sur l'écran où le mail est lu, ce que le cas le plus banal démentit : inscription sur
  l'ordinateur, mail relevé sur le téléphone. Même mécanisme que « SANS CONTACT » affiché pour un
  client qui a une adresse : un message qui affirme ce que la situation dément coûte plus cher qu'un
  message vague.

### Ce qu'on s'est promis de regarder
- Au branchement du domaine : poser `URL_BUREAU` sur l'adresse définitive, et se souvenir que
  l'émission du certificat et la propagation ne se répètent pas. C'est l'étape qu'on ne peut pas
  répéter à blanc, donc pas celle à garder pour la dernière minute.
- `ecarterLesSuivis()` attend toujours sa suppression, maintenant que `v_courrier` fait
  l'anti-jointure en SQL.


## 08 au 09/09/2026. Le courrier du matin, et un geste qui mentait

Demande de Ted : « envoyer tous les jours un mail le matin avec toutes les recos à
l'utilisateur ». Ce qui suit est le cadrage, les quatre arbitrages qu'il a pris contre ma
recommandation, le lot 1 qui est en place, et un défaut d'écriture trouvé au passage.

### Ce qui a été mesuré avant de proposer quoi que ce soit

`suivi_clients` contenait **0 ligne** au 08/09. Deux comptes, 4 939 lignes de vente chacun,
dernier dépôt de la file le 08/09 à 16 h 26. Donc la seule matière qui bouge d'un jour à
l'autre, les rappels, n'existait pas encore en base.

C'est le mur de toute l'idée. `reglages.file_travail` ne se rafraîchit qu'à l'ouverture du
tableau de bord et à un import : un mail quotidien construit dessus renvoie la MÊME liste
chaque matin jusqu'au prochain import. Trois semaines sans import, vingt-et-un mails
identiques, et un lecteur qui décroche en dix jours.

### Ce qui a été retenu

Les rappels échus PLUS les signaux de la file. Pas les recos de cuvées : `recoPour()` et son
calcul de similarité ne sont déposés nulle part, ils vivent dans le navigateur, par client, à
la demande. Les mettre dans un mail imposerait un deuxième moteur côté serveur, ce que le
projet a déjà refusé pour le CRM.

### Les quatre arbitrages de Ted, dont trois contre ma recommandation

**1. `courrier.` reste le sous-domaine d'envoi.** Je recommandais un troisième sous-domaine,
`bureau.`, distinct de `courrier.` (transactionnel) et de `edition.` (la newsletter à venir).

Motif de Ted : phase de test, deux comptes qui sont les siens, « on monte des process et on
changera si il faut changer ».

Ce qu'il faut savoir en relisant : c'est le SEUL choix de la liste qu'un changement d'avis ne
rattrape pas. La réputation d'un domaine se construit et se répare en semaines, pas par un
réglage. Si le récap quotidien fait classer `courrier.` en courrier commercial par Gmail ou
Outlook, ce sont les **codes de reprise de mot de passe** qui n'arrivent plus, et le vigneron
reste enfermé dehors sans message d'erreur.

**Le levier à actionner si la délivrabilité se dégrade** : sortir le récap de `courrier.`. Et
le seuil au-delà duquel il ne faut plus attendre : le premier destinataire qui n'est pas Ted.

**2. Palier Resend gratuit.** Correct à deux comptes : 30 mails par mois contre 3 000. Le
point à ne pas oublier est que c'est le **même quota** que les codes d'inscription, plafonné à
100 par jour. À 100 inscrits, les 100 récaps partent à 8 h et le vigneron qui perd son mot de
passe à 8 h 05 n'a plus de code. C'est ce jour-là que le gratuit s'arrête.

**3. Tous les matins à 8 h.** Ted a d'abord choisi un récap hebdomadaire du lundi, puis est
revenu au quotidien dans le même échange. Le quotidien amplifie par sept le défaut de
répétition décrit plus haut, ce qui rend la péremption des signaux et la règle « rien de neuf,
pas d'envoi » indispensables et pas cosmétiques.

**4. Noms de clients et montants DANS le mail.** C'est le franchissement délibéré de la
« frontière à ne pas franchir » écrite le 01/09 : le compositeur reste en `mailto:` pour
qu'aucun nom de client ni montant ne transite chez un tiers.

Trois conséquences signalées, aucune corrigée à ce jour :
- le pied de page (« Vos ventes restent dans votre navigateur ») et `src/rgpd.njk`, qui ne
  nomme aucun sous-traitant, deviennent faux ;
- Resend conserve vraisemblablement le contenu des mails quelques jours dans ses journaux de
  dépannage. À vérifier chez eux, et signer un DPA ;
- la fonction d'envoi devra lire les données de TOUS les comptes avec la clé `service_role`,
  qui court-circuite entièrement la sécurité par ligne. C'est le premier composant du projet à
  pouvoir le faire. Cette clé reste dans les secrets Supabase, jamais dans le dépôt, jamais
  chez Vercel.

### L'ordre des lots, et pourquoi le lot 2 n'est pas le premier

| Lot | Ce qu'on fait | Ce qui part |
|---|---|---|
| 1 | La fabrique du mail et son aperçu à l'écran | rien, FAIT |
| 2 | La vue Postgres qui écarte les clients déjà suivis | rien |
| 3 | Clé Resend et garde-fou destinataires, envoi à Ted seul | 1 mail |
| 4 | Déclencheur horaire et contrôle « déjà envoyé aujourd'hui » | 1 par jour |

La vue ne servait à rien tant que `suivi_clients` était vide : elle aurait filtré sur zéro
ligne et le contrôle aurait passé sur du vide, le piège déjà payé trois fois le 07/09.

Les lots légaux (RGPD, pied de page, case à cocher, désinscription) sont **sortis du plan pour
la phase de test**, parce qu'à deux comptes qui sont les siens ils n'ont pas d'objet. Ils
redeviennent bloquants, et strictement avant l'envoi, au premier destinataire qui n'est pas
Ted. Même seuil que le garde-fou du lot 3 et que le sous-domaine.

### Le lot 1, ce qui a été écrit

Trois fichiers, aucun envoi, aucune lecture de base.

`src/js/bdv-courrier.js` fabrique le mail et rien d'autre. La seule décision d'architecture du
lot : il doit tourner dans trois mondes sans être modifié, le navigateur, Node pour l'aperçu,
et Deno pour la fonction serveur du lot 3. D'où le bloc d'export en bas de fichier, et
l'interdiction d'y écrire un `import` ou un `require`, qui fermerait deux des trois mondes.
Sans ça, deux versions du contenu à tenir d'accord, et elles divergeraient au premier
changement de texte.

`scripts/fixtures/courrier-exemple.json` porte quatre cas : le matin ordinaire, le matin vide,
un dépôt périmé, et les cas laids. Tout y est **inventé, et doit le rester** : le dépôt est
public, un vrai export ici partirait sur GitHub avec les clients du vigneron dedans.

`scripts/apercu-courrier.mjs`, soit `npm run courrier`, écrit `_apercu/index.html` avec les
quatre versions côte à côte, leur sujet, leurs compteurs et leur version texte. Ajouté à
`npm run verif`. `_apercu/` est dans `.gitignore`.

### Les choix de contenu, et celui qui contredit la charte

**Les couleurs sont écrites en dur dans `bdv-courrier.js`, et c'est la seule exception admise
à la charte.** `var(--bordeaux)` n'existe pas dans Outlook, et une feuille de style externe
n'est pas chargée par la plupart des messageries : tout doit être en style de ligne, en valeur
brute. La règle de remplacement est que **chaque valeur porte le nom du jeton dont elle est
copiée**. Sans ces noms, la liste devient un deuxième nuancier orphelin.

Le reste : ni Fraunces ni Inter, une messagerie ne charge pas de police web, donc Georgia et
la pile système, qui sont exactement les replis déclarés dans les jetons. `--danger-deep` et
pas `--danger`, qui tombe à 4,00:1 sur papier. Péremption des signaux à 60 jours, un chiffre à
régler à l'usage. Les rappels ne sont jamais masqués, eux : ils sont lus en direct.

### Le piège trouvé par la capture, et pas par la relecture

« panier habituel » s'affichait tout seul, sans chiffre au-dessus, sur un client dont le
montant était à zéro. C'est la règle « un chiffre dit d'où il vient » prise à l'envers : une
source sans son chiffre. Une case vide vaut mieux. Corrigé, et un sixième contrôle de l'aperçu
l'empêche de revenir en silence.

Confirmation de la leçon du 08/09 : les défauts de dessin ne se voient qu'en capture d'écran,
jamais en relisant le code.

## MA PROPRE ERREUR DE LECTURE, ET LES DEUX FAIBLESSES QUI RESTENT VRAIES

**Correction du 09/09/2026, à lire avant le paragraphe suivant.** Ted a dit avoir posé des
rappels, `suivi_clients` était à zéro ligne, et j'en ai conclu à une écriture cassée. C'était
une erreur de ma part : ce qu'il avait posé, ce sont des **tâches**, pas des rappels. Deux
fonctions différentes, deux tables différentes. `taches` portait bien ses 13 lignes, dont deux
créées à 13 h 00 et 13 h 01, et `reglages.depose_le` avait été réécrit à 12 h 59. Les écritures
partaient donc, la session était vivante, et **aucun incident n'a jamais été constaté sur le
suivi**.

La leçon, et elle vaut plus que le correctif : une table vide n'est pas la preuve d'une panne.
Avant de diagnostiquer, vérifier QUELLE fonction a été utilisée, pas seulement quelle table est
vide. J'ai écrit dans ce journal, dans `CLAUDE.md` et dans Notion un constat que je n'avais pas.

Ce qui suit reste vrai, mais c'est du **durcissement** et pas la réparation d'un incident : la
lecture du code a trouvé deux faiblesses réelles sur ce chemin.

La cause est dans `bdv-base.js`, ligne 307 :

```js
function syncSuivi(id){
  if(!syncPret()||!id)return;
  const c=CRM[id];
  (c?BdvSync.ecrireSuivi(id,c):BdvSync.supprimerSuivi(id)).catch(function(){});
}
```

**Deux sorties muettes sur trois lignes.** `syncPret()` faux : on rend la main sans rien dire.
L'écriture serveur qui échoue : `.catch(function(){})` avale l'erreur entière. Et
`crmSet()` annonce « Rappel enregistré. » juste après, sur la foi du seul `crmSave()` dans le
`localStorage`.

Donc le message dit vrai sur le navigateur et faux sur le compte, et rien ne distingue les deux
cas à l'écran.

**C'est une divergence entre les deux côtés du même geste**, la même famille que les neuf
copies de la liste des canaux avant `bdv-canaux.js`. La file du bureau, dans `bdv-crm.js`,
applique la règle : « un geste raté rend la ligne à l'écran et le dit », et `ecrireSuivi()` y
lève `new Error('aucune session')` plutôt que de rendre la main. La fiche du tableau de bord,
elle, ne l'applique pas. Deux chemins pour poser un rappel, un seul qui sait avouer un échec.

Conséquence qui dépasse le courrier : [Certain] un rappel qui ne vivrait que dans le navigateur
serait perdu le jour où Ted change d'appareil, et `projet_deconnexion_efface_le_poste.md` a déjà
posé que la base fait foi et que le navigateur n'est qu'une vitre. C'est ce risque-là qui
justifie le correctif, pas un incident.

Corrigé le 09/09/2026, trois retouches : `return=representation` sur les deux écritures du
suivi, un drapeau `_apousser` et un `crmRejouer()` calqués sur `echPousser()`, et un second
message à l'écran quand le compte n'a pas confirmé.

### Le virage : le courrier porte les tâches

Décidé le 09/09/2026, après la correction ci-dessus. `suivi_clients` était à zéro ligne
pendant que `taches` en portait treize, dont quatre posées dans l'heure. Autrement dit : la
moitié « ce matin » du courrier était bâtie sur la seule matière que Ted n'utilise pas encore,
et ignorait celle qu'il utilise tous les jours.

Le mail n'est donc plus « les clients à voir », c'est **sa journée**. Tâches échues et rappels
mélangés dans un seul bloc, le plus en retard d'abord. Mélangés et pas séparés : personne ne
trie sa matinée par table de base de données.

Deux règles sont venues avec, et aucune n'est cosmétique. Une tâche **sans date** n'entre
jamais dans le courrier, sinon elle y reparaît chaque matin, ce qui est le défaut qui fait
décrocher. Et **en cours n'est pas en retard** : « Vendanges de la parcelle du haut », du 07
au 12 septembre, ne doit pas s'afficher en rouge un 9 septembre. C'est la même faute que
nommer un client déjà traité, et elle coûte la même chose : la crédibilité du mail d'un seul
coup. Les deux sont gardées par les contrôles 7, 8 et 9 de `npm run courrier`, et vérifiées à
la capture d'écran.

### Lot 2 : la vue, et le bon argument pour elle

`supabase/lot9-courrier-vues.sql`, **à coller** dans l'éditeur SQL. Pas par le MCP : depuis
que `profils` porte des adresses de vignerons, la décision du 01/09 est que tout DDL repasse
à la main.

L'argument que j'avançais d'abord (ne pas écrire la règle du suivi à deux endroits) est le
plus faible des deux. Le vrai : **sans vue, la fonction d'envoi fait trois lectures par
compte**, soit 1 500 allers-retours à 8 h du matin pour 500 vignerons. Avec elle, une seule
requête pour tout l'envoi.

Ce que la vue écarte, et pourquoi ces deux-là seulement : les signaux dont le client a depuis
reçu un rappel ou a été traité, et les tâches faites. Ce sont des **faits**. Elle laisse
passer les tâches sans date, parce que « une tâche sans date n'entre jamais dans le courrier »
est une règle de **présentation**, qui vit dans `normTache()` et y reste. L'écrire aux deux
endroits serait exactement le défaut que cette vue existe pour supprimer.

`security_invoker = true` est la ligne la plus importante du fichier. [Certain] Sans elle, une
vue Postgres s'exécute avec les droits de son propriétaire : la sécurité par ligne des tables
ne s'applique plus, et n'importe quel vigneron connecté lirait la file de travail, les rappels
et l'adresse e-mail de tous les autres.

Vérifié avant de livrer le fichier, en lecture seule sur la vraie base : une ligne par compte,
40 signaux, l'annuaire et le résumé présents, et l'ordre du dépôt conservé (`with ordinality`,
sinon `jsonb_agg` perd le classement par importance qu'a fait le tableau de bord). L'anti-jointure
est prouvée avec une fiche de suivi **simulée** dans une CTE, sans rien écrire : les signaux
passent de 40 à 39. Elle reste à contrôler sur un vrai rappel, et le fichier dit pourquoi ce
contrôle-là ne peut pas se passer sur une table vide.

Mesure au passage : 9,1 ko de signaux par compte, donc environ 4,5 Mo pour 500 vignerons en
une requête. Ça passe. Les deux leviers si ça devient un mur sont écrits en section 3.4 du
fichier, à ne pas actionner avant d'avoir mesuré en situation.

`ecarterLesSuivis()` dans `bdv-courrier.js` reste en place jusqu'au lot 3 : le jeu d'essai
n'est pas filtré, et c'est lui qui porte le cas de test. Elle sera supprimée quand la fonction
d'envoi lira la vue.

### La vue est en base, et le contrôle a trouvé un piège

Collée par Ted le 09/09/2026. Contrôlée depuis la session : deux lignes, 40 signaux chacune,
6 tâches pour un compte et 1 pour l'autre, annuaire et résumé présents,
`reloptions = {security_invoker=true}`. Exactement ce que la simulation annonçait.

**Ce que le contrôle des droits a trouvé.** [Certain] Supabase pose des droits par défaut sur
le schéma public : `authenticated` s'est retrouvé avec INSERT, UPDATE, DELETE, TRUNCATE,
REFERENCES et TRIGGER sur la vue, en plus du SELECT. Mon `revoke all ... from anon` ne portait
que sur `anon`, et mon `grant select` était redondant : je croyais que le grant définissait les
droits, il ne fait que les ajouter.

Inoffensif ce jour-là, et vérifié plutôt que supposé : `is_updatable` vaut NO, la vue porte des
agrégats et des jointures, Postgres refuse toute écriture dessus. Mais c'est un piège posé pour
le jour où quelqu'un simplifiera cette vue. Corrigé par `revoke all ... from anon,
authenticated` puis le grant. La règle est passée dans `CLAUDE.md`, parce qu'elle vaudra pour
chaque objet créé ensuite.

### LOT 2 FAIT, et prouvé sur de vraies données

Ted a cliqué « Appelé » sur une ligne de son sous-main le 09/09/2026. Contrôlé depuis la
session, juste après :

- `suivi_clients` : 1 ligne, avec rappel. `echanges` : 1 ligne. Le geste a donc bien écrit ses
  **deux** choses de nature différente, comme la règle l'exige.
- **L'anti-jointure : 39 signaux gardés sur 40 déposés** sur son compte, 40 sur 40 sur l'autre,
  qui n'a aucun suivi. Le client traité sort de la file, et le mail ne le nommera pas.

C'était le seul contrôle qui ne pouvait pas se passer sur une table vide, et il est passé sur
un vrai rappel, pas sur une simulation. Le lot 2 est clos.

Note qui vaut pour la suite : un clic sur « Appelé » dans le sous-main est le chemin le plus
court pour fabriquer un rappel de test. Il pose 30 jours, écrit le journal, et passe par
`bdv-crm.js`, celui des deux chemins qui sait avouer un échec.

### LOT 3 : le premier courrier est parti

09/09/2026, 20 h 38. Un mail, un seul, à l'adresse de Ted. Resend l'a accepté,
identifiant `8e6fa168-cc33-43c2-bbe8-93e1899b5996`. Compte rendu : 2 comptes lus, 1 envoyé,
**1 « hors liste autorisée »**, 0 échec. Le garde-fou a donc travaillé pour de vrai : le second
compte n'a rien reçu.

Sujet reçu : « Ton bureau, mercredi 9 septembre : 3 à faire, 39 clients à voir ». **39 et pas
40** : l'anti-jointure du lot 2 travaille dans le mail réel.

`supabase/functions/courrier-matin/index.ts`, version 2 déployée. La fabrique
`src/js/bdv-courrier.js` est JOINTE au déploiement, commentaires allégés pour tenir dans le
paquet, code identique. C'est un écart assumé : il existe une seconde copie le temps du
déploiement. La sortie propre serait `import 'https://lebureauduvigneron.fr/js/bdv-courrier.js'`,
que Deno gèle au déploiement, mais ni le conteneur ni WebFetch n'ont pu confirmer que cette URL
est servie, et une dépendance non vérifiée n'a rien à faire dans le chemin d'envoi.

#### Le verrou a changé, et c'est une correction de conception

La v1 comparait l'en-tête `Authorization` à `SUPABASE_SERVICE_ROLE_KEY`. Ted a copié la bonne
clé, celle de la ligne `service_role`, et la comparaison a échoué quand même : [Certain] la
variable injectée dans la fonction ne porte pas la même chaîne que celle affichée par le
tableau de bord, qui expose désormais deux générations de clés (`eyJ...` héritées, et
`sb_secret_...`). Piège aggravant : les aperçus tronqués d'`anon` et de `service_role` sont
**identiques à l'œil**, impossible de savoir laquelle a été copiée.

Remplacé par un secret dédié, `COURRIER_CLE`, dans l'en-tête `x-courrier-cle`. Et le vrai
argument n'est pas la robustesse : la v1 obligeait à promener la **clé maîtresse du projet**
dans des lignes de commande pour un simple essai. Un secret dédié n'ouvre que cette fonction
et se révoque seul. C'est lui que le déclencheur du lot 4 utilisera.

Deux verrous en série au final : `verify_jwt` de la plateforme sur la clé publique, puis le
secret de la fonction. Vérifié en négatif : un `Invalid JWT` a bien refusé un envoi avant même
d'atteindre la fonction.

#### Trois défauts vus dans le mail réel, non corrigés

1. **Le mien.** Le sujet annonce « 40 clients à voir », le corps en liste 8, et la version
   TEXTE ne porte pas la ligne « Et 32 autres dans ton bureau » que la version HTML porte.
   Promettre 40 et montrer 8 sans le dire est le genre de chose qui fait douter du reste.
2. **« 40 » n'informe pas.** `fileSignaux()` dépose au maximum 40 signaux, donc le sujet dira
   40 presque tous les matins. Un nombre qui ne bouge jamais ne dit rien. Y mettre le nombre
   réellement affiché, ou le retirer du sujet.
3. **Le mail porte les ADRESSES E-MAIL des clients**, embarquées par `contactTexte()`. Ted
   avait validé « noms et montants » ; des coordonnées de personnes identifiables sont un cran
   au-dessus, et ce n'était pas une décision, c'était un effet de bord. Elles transitent chez
   Resend et restent dans ses journaux. À trancher avant qu'un vigneron reçoive ce mail.
   Ma recommandation : garder le téléphone, retirer l'e-mail. L'outil dit lui-même « appelle-le
   plutôt que de lui écrire » sur ces motifs, et une adresse dans le mail invite à faire
   exactement ce que le conseil déconseille.

### Deux pièges de méthode, payés dans la session

**Un bloc de commandes est collé en entier, toujours.** J'ai donné `npm run verif` dans un
bloc, puis `git add`, `git commit` et `git push` dans un second. Ted a collé les deux : les
commandes git se sont mises en file d'attente dans le terminal pendant que `verif` tournait, il
a fait Ctrl+C, et le commit est parti avec six bancs sur douze non passés. Les six ont été
contrôlés après coup et sont bons, mais c'était de la chance. Désormais : un seul bloc enchaîné
avec `&&`, et le `cd` du dépôt en première ligne.

**Le shell distant coupe vers 90 secondes.** `npm run verif` en entier n'y rentre pas, les
bancs jsdom prennent chacun jusqu'à une minute et demie. Un banc par appel.

### Ce qui reste ouvert

- **Le lot 2 attend toujours de la matière.** `suivi_clients` est à zéro ligne parce qu'aucun
  rappel n'a encore été posé. En revanche `taches` en porte 13, datées et vivantes : la
  question de savoir si le courrier du matin doit porter les TÂCHES plutôt que, ou en plus
  des, rappels est posée et non tranchée.
- **Une suppression ratée n'est pas rejouée** : la fiche a déjà quitté `CRM`, il n'y a plus
  rien à marquer. Écrit en commentaire dans `bdv-base.js`.
- **Cinq tâches d'échéance sont cochées « fait »**, dont « Véraison » échue en juillet 2027 et
  « Arrêté des stocks au 31 juillet ». Soit un essai de Ted, soit un défaut du chemin de
  coche. À lui demander avant de chercher.
- **L'annuaire des noms peut manquer une entrée.** `annuaireSuivis()` est cumulatif dans le
  `localStorage` du poste qui importe. Une fiche créée sur le téléphone, où aucun export n'a
  été importé, n'entre jamais dans l'annuaire déposé depuis le bureau : le mail afficherait
  alors un numéro client Vitisoft brut à la place du nom. Le cas `limites` du jeu d'essai
  reproduit ce défaut volontairement.
- `ecarterLesSuivis()` dans `bdv-courrier.js` **doit disparaître au lot 2**, remplacé par la
  vue Postgres. Deux endroits qui répondent « ce client est-il encore à voir » se
  contrediront au premier geste.

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

### Et la barre des pièces qui passait sous l'entête

Repéré par Ted dans la foulée, sur capture d'écran : les deux premières languettes,
« Ma journée » et « Mes tâches », disparaître dès qu'on fait défiler. `.nav` et
`.bureau-nav` étaient **toutes les deux collées à `top: 0`**, et `.nav` a un fond opaque
plus `--z-nav` (100) : elle gagne toujours.

La barre reste magnétique, elle se cale simplement sous l'entête. Deux détails qui font
la différence entre « déplacé » et « réparé » :

- la hauteur disponible est `100vh` **moins** l'entête, sinon la barre descendue dépasse
  par le bas exactement autant qu'elle dépassait par le haut, et « Mes réglages » devient
  injoignable sur un écran court ;
- `--h-entete` est **mesurée** par `bdv-nav.js` (chargement, redimensionnement, polices
  arrivées), avec un repli CSS de 4 rem. Un chiffre en dur se périmerait au premier
  changement de l'entête, sans un mot.

Mesuré dans Chromium sur trois hauteurs de fenêtre, défilement engagé : entête 0..59 px,
barre 69..421 px, les huit languettes dans la fenêtre. À 420 px de haut, la barre passe
sur son propre défilement et les huit restent atteignables.

**Reste ouvert** : `.bdv-ventes table.data--sticky thead th` est encore à `top: 0`. Sur un
long tableau de ventes, la ligne d'en-tête se colle sous l'entête du site. Même cause,
correction non faite.

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
