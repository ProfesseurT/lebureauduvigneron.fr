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
