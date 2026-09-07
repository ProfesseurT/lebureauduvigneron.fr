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

## Session du 06/09/2026, en soirée : la feuille de route des six chantiers

Aucune ligne de code ce soir. Ted a posé six chantiers pour la suite. Ils sont notés ici avec ce
que chacun suppose et ce qui coince, pour que la reprise ne redécouvre pas les mêmes murs.

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

### Reste ouvert

1. Signature de mail : texte seul, presse-papier, ou envoi réel ? Rien ne s'écrit avant.
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
