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
