# Plan : le calendrier devient une pièce du bureau

Décidé le 08/09/2026 avec Ted. Quatre arbitrages tranchés avant la première ligne de code,
ils sont en tête de ce document parce que ce sont eux qui coûtent cher à changer plus tard.

## Ce que Ted a demandé, reformulé

1. Le raccourci « Le calendrier » de la barre du bureau **éjecte aujourd'hui hors du bureau**,
   vers `/outils/echeances/`, une page sans intercalaires. C'est le défaut de départ.
2. Il veut voir ses dates **en calendrier**, avec la possibilité de changer d'affichage.
3. Il veut garder **les intercalaires sur le côté**, donc la coque du bureau.
4. Il veut **créer ses propres occurrences**.
5. Nous, éditeurs, déposerons **un paquet d'occurrences déjà prêtes**.
6. Le vigneron doit pouvoir **synchroniser avec son agenda**.

## Les quatre arbitrages, tranchés le 08/09/2026

### 1. La frontière entre « Mes tâches » et « Le calendrier » est la DATE, pas la propriété

Ted : « on peut le faire dans les 2. Le calendrier donnera une date début et fin obligatoire,
les tâches non pas obligatoire. »

C'est une règle nette, et elle est meilleure que celle que j'avais proposée :

- **Une occurrence du calendrier porte toujours un début et une fin.** Sans date, elle
  n'existe pas. Une DRM commence et finit le 10. Une déclaration de récolte s'étale.
- **Une tâche peut n'avoir aucune date.** « Commander des bouchons » attend son heure.

Les deux pièces peuvent cocher, et **c'est sans danger à une seule condition** : elles
écrivent la même ligne. L'identifiant d'occurrence `ech:drm:2026-09-10` existe déjà dans
`bdv-taches.js` et ne bouge pas. Cocher la DRM dans le calendrier, c'est écrire cette
ligne-là ; la décocher dans Mes tâches, c'est supprimer cette ligne-là. Un seul stockage,
deux vitres.

**Ce qui casserait ça** : donner au calendrier son propre stockage de « fait ». Deux tables
qui répondent « est-ce que la DRM de septembre est faite » se contrediraient au premier
geste. Ne pas le faire.

### 2. L'abonnement vivant, pas le fichier téléchargé

Retenu : une adresse secrète par compte, que Google Agenda, Apple Calendrier et Outlook
relisent tout seuls. Une date corrigée par nous remonte chez tout le monde sans rien faire.

**Ce que ça coûte, et il faut le savoir avant** : c'est le premier bout de code SERVEUR de ce
dépôt. Aujourd'hui le site est entièrement statique. Il faudra une fonction Vercel, une clé
de service Supabase dans les variables d'environnement, et un jeton révocable par compte.
Détail en Lot 4.

### 3. La bibliothèque va jusqu'au commercial

Retenu : réglementaire, travaux du domaine, et temps forts de vente.

**Le risque que ça ouvre, et il est réel** : le commercial est déjà le territoire du
sous-main et du pseudo-CRM (`bdv-crm.js`), qui sait repousser un rappel de 30, 7 ou 60 jours.
Un « relancer les clients de l'an dernier » posé dans le calendrier ne sait pas faire ça.

**La ligne à tenir** : le calendrier porte des **campagnes**, le sous-main porte des
**clients**. « Campagne de fin d'année, du 15 novembre au 20 décembre » va au calendrier.
« Rappeler le domaine Machin » reste au sous-main. Le jour où le calendrier se met à nommer
un client, on a recréé le doublon que la règle 7 de CLAUDE.md interdit.

### 4. La page publique `/outils/echeances/` ne bouge pas

Elle reste en liste, gratuite, sans compte, référencée. C'est la porte d'entrée. Les vues au
choix, la création d'occurrences et la synchro sont dans le bureau : c'est la raison de créer
un compte.

**Conséquence sur la règle de CLAUDE.md** qui dit « les outils ouverts à toute la filière
gardent leur page sous `/outils/` ». Le calendrier devient le premier objet qui vit aux deux
endroits : une page publique en lecture, une pièce du bureau où l'on agit. Cette exception
s'écrit dans CLAUDE.md au Lot 1, sinon quelqu'un la « corrigera » de bonne foi.

## L'affichage : trois vues, et une quatrième écartée

Ted : « à toi de me trouver la meilleure option. »

### La vue mois, par défaut dans le bureau

La grille éditoriale. Sept colonnes, l'allure d'un almanach imprimé et pas d'un agenda
d'entreprise : filet, angle vif, ombre dure, la matière du plateau. Ce qui dure plusieurs
jours se lit en bandeau qui traverse les cases, ce qui tombe un jour se lit en ligne.

**Elle n'était pas défendable il y a une heure, et l'arbitrage 3 l'a rendue défendable.** Avec
cinq échéances par an, une grille de mois est vide vingt-huit jours sur trente et un, et une
grille vide dit « cet outil ne sert à rien ». Avec la bibliothèque complète, un vigneron qui
active ses repères aura trois à huit choses par mois. C'est ce qui fait tenir la grille.

### La vue année, celle que personne d'autre ne fait

Douze mini-mois sur un écran, un point par occurrence, coloré par nature. Elle répond en un
coup d'œil à « à quoi ressemble mon année », et c'est la question d'un vigneron en janvier ou
avant les vendanges. C'est la vue qui donne envie de montrer l'outil à un voisin.

### La vue liste, celle d'aujourd'hui

Le compte à rebours de la capture, inchangé. Elle reste la vue par défaut de la page publique,
et elle reste disponible dans le bureau : c'est la plus rapide à lire quand la question est
« qu'est-ce qui tombe le plus tôt ».

### La vue semaine, écartée

Un agenda de semaine est une grille d'heures. Les journées d'un vigneron ne se découpent pas
en créneaux de 9 h à 18 h dans cet outil, et aucune occurrence de la bibliothèque ne porte
d'heure. Ce serait un emploi du temps vide. Si le besoin apparaît un jour, il viendra avec des
rendez-vous, donc avec un vrai agenda, donc avec autre chose que ce chantier.

### Le filtre par nature

Quatre natures, et une cinquième pour lui : Douane, Fiscal et social, Vigne et cave,
Commercial, Mes dates. Le filtre vit dans la pièce, au-dessus des vues, et sa position est
mémorisée comme celle de la vue. Ce n'est pas la barre du bureau : les intercalaires du côté
restent les pièces du bureau, on n'y touche pas.

## Les cinq lots

### Lot 1 : le calendrier entre dans le bureau — FAIT le 08/09/2026

Sur les données d'aujourd'hui, sans une ligne de base de données. C'est le lot qui se juge à
l'écran, et il faut le juger avant d'écrire les suivants.

- `PIECES` de `src/js/bdv-nav.js` : `echeances` change de `href`, `/mon-bureau/#calendrier`,
  et le clic n'est plus laissé passer.
- `seule()` nomme un **quatrième** conteneur, `bureauCalendrier`. Ne pas oublier : la fonction
  les nomme tous à chaque bascule, c'est ce qui évite deux pièces empilées.
- La coque dans `src/mon-bureau.njk`, un nouveau module `src/js/bdv-calendrier.js` et sa
  feuille `src/css/bdv-calendrier.css`, chargés **au premier clic** comme les écrans de vente.
  Le bureau ouvre à 32 ko bloquants, ce chantier ne les augmente pas.
- Les trois vues, la bascule mémorisée dans le navigateur.
- Le calcul reste dans `bdv-echeances.js`, seule logique du site. Le nouveau module en est un
  lecteur, pas une deuxième copie.

**Les contrôles à mettre au niveau dans le même commit** : `scripts/banc-bureau.mjs` compte
huit pièces et vérifie explicitement, ligne 130, que le calendrier pointe encore vers
`/outils/echeances/`. Les deux assertions changent. Ne pas les contourner.

### Lot 2 : le modèle à deux dates, et la bibliothèque — FAIT le 08/09/2026, voir le bilan en fin de document

`src/_data/echeances.json` devient `src/_data/calendrier.json`, et chaque entrée gagne :

- `nature` : `douane`, `fiscal-social`, `vigne-cave`, `commercial`
- `statut` : `obligation`, toujours affichée pour tous, ou `repere`, à activer
- une `duree` en jours dans la récurrence

**Une occurrence calculée porte un début et une fin, une règle de récurrence porte une durée.**
C'est la même chose dite deux fois, et c'est voulu : une règle annuelle ne peut pas porter une
date de fin en dur, elle la recalcule à chaque année.

Deux formes de récurrence à ajouter, et la première est celle qui remplit la grille :

- `annuel-periode`, du 1er août au 30 novembre
- `hebdomadaire`, un jour de la semaine, pour les repères commerciaux

**Un écart de contenu à corriger dans ce lot, repéré le 08/09/2026** : la page publique promet
noir sur blanc qu'« un dépôt qui tombe un samedi, un dimanche ou un jour férié se reporte au
premier jour ouvré suivant ». `prochaine()` dans `bdv-echeances.js` ne le fait pas. La page
promet un calcul que le code ne fait pas. Soit on écrit le report, soit on retire la phrase ;
laisser les deux est le pire des trois états.

### Lot 3 : ses occurrences à lui

Table `calendrier_perso` : `id`, `evt_id`, `titre`, `nature`, `debut`, `fin`, `recurrence`,
`note`. Plus une table `calendrier_choix` pour ce qu'il active ou désactive de la
bibliothèque, et le décalage qu'il applique à un repère.

**Les repères de saison se déplacent, les obligations non.** Une taille en février n'est pas
la même en Loire et dans l'Hérault. Un repère activé porte donc un décalage propre au compte ;
une obligation de la douane ne s'en laisse pas appliquer.

Règle Supabase à respecter, celle des signets et de la règle 6 de CLAUDE.md : `id` est posé au
moment de l'envoi et jamais chez l'appelant, et chaque geste n'envoie que sa colonne.

### Lot 4 : l'abonnement agenda

Une fonction Vercel, `/api/agenda/<jeton>.ics`, qui rend vingt-quatre mois d'occurrences.

**Le vrai coût de ce lot n'est pas la fonction, c'est le calcul.** `bdv-echeances.js` est
aujourd'hui une fonction anonyme qui pose `window.BdvEcheances` : elle ne s'exécute que dans
un navigateur. Le serveur ne peut pas la lire. Écrire le calcul une deuxième fois dans la
fonction, c'est exactement ce que l'en-tête de ce fichier interdit depuis le premier jour, et
la divergence se verrait des mois plus tard, sur un agenda tiers, chez un client. Le lot
commence donc par sortir le calcul dans un module partagé par les deux.

À décider dans ce lot, pas avant : le jeton est révocable, il ne donne accès qu'au calendrier,
et il ne doit jamais laisser deviner l'identifiant du compte.

### Lot 5 : le paquet d'occurrences prêtes

Le travail d'édition, pas de code. Il peut avancer en parallèle des lots 2 à 4, dans le fichier
de données.

Règle de contenu qui ne se négocie pas : **chaque obligation porte sa source officielle**, et
chaque repère de saison est présenté comme un repère déplaçable, jamais comme une obligation.
Une date de traitement fausse affichée avec l'autorité d'un texte de loi, c'est le genre de
chose qui se retourne contre la maison.

## Ce qu'on ne fait pas, et pourquoi

- **Pas de rendez-vous à l'heure.** Voir la vue semaine écartée.
- **Pas de lecture de l'agenda du vigneron.** La synchro va dans un sens, du bureau vers son
  agenda. Lire son Google Agenda demanderait une autorisation OAuth, donc un écran de consentement,
  donc une promesse de confidentialité de plus à tenir. Ce n'est pas le sujet du chantier.
- **Pas de notification par e-mail.** Le site n'envoie aucun e-mail par lui-même, c'est une
  décision de CLAUDE.md, et l'abonnement agenda rend le rappel au client de messagerie.

---

# LOT 2, FAIT le 08/09/2026

## Ce que la base Notion a appris, avant d'ecrire une ligne

`solumatic.notion.site/calendrier`, mesure du 08/09/2026 : **257 lignes, 193 noms distincts,
sur deux annees** (100 en 2025, 149 en 2026, 4 sans date).

**Ce n'est pas une bibliotheque de regles, c'est une liste de dates, et elle meurt le 31
decembre 2026.**

- La DRM occupe **24 lignes** : douze pour 2025 etiquetees « Administratif », douze pour 2026
  etiquetees « Reglementaire (Douanes) ». La meme obligation, deux etiquettes, 24 saisies.
  C'est une regle d'une ligne.
- Les jours feries y sont **deux fois**, sous « Jour ferie » et sous « Marketing (calendrier
  national) ».
- Les 43 journees mondiales sont **toutes en 2025**, zero en 2026. Famille deja morte.
- Le calendrier lunaire, **55 lignes**, les quatre phases tapees mois par mois pour 2026, et
  **une d'elles fausse** (pleine lune de juin datee du 29, elle tombe le 30 a 01 h 57).

Les 29 etiquettes n'etaient pas le probleme : elles en etaient le symptome d'une base retapee
a la main chaque annee.

## La correspondance des 29 etiquettes vers les 4 familles

A utiliser pour le lot 5. Les lignes du fond de carte ne sont PAS a reprendre : elles se
calculent.

| Etiquette Notion | Lignes | Devient |
| --- | --- | --- |
| Reglementaire (Douanes) | 15 | `obligations` |
| Administratif | 15 | `obligations` (doublons de la DRM a fusionner) |
| Metier (vigne) | 4 | `travaux` |
| Metier (phenologie) | 3 | `travaux` |
| Metier (vendanges) | 2 | `travaux` |
| Metier (chai) | 1 | `travaux` |
| Metier (risque climatique) | 1 | `travaux` |
| Salons | 13 | `rendezvous` |
| Salon pro | 9 | `rendezvous` |
| Salon particuliers | 7 | `rendezvous` |
| Concours | 7 | `rendezvous` |
| Salon (grand public) | 1 | `rendezvous` |
| Evenement pro (marche) | 1 | `rendezvous` |
| Evenements | 25 | `rendezvous` a trier, certains sont des temps forts |
| Webinaires Vitisoft | 2 | `rendezvous` |
| Journee mondiale / internationale | 43 | `tempsforts`, en regles `annuel` |
| Marketing (saisonnier) | 10 | `tempsforts` |
| Marketing (retail) | 7 | `tempsforts` |
| Marketing (oenotourisme) | 1 | `tempsforts` |
| Marketing (evenement culturel) | 1 | `tempsforts` |
| Marketing (vin primeur) | 1 | `tempsforts` |
| Marketing (B2B) | 1 | `tempsforts` |
| Vie vigneronne | 2 | `tempsforts` |
| Calendrier (organisation) | 2 | a jeter, c'est de l'organisation interne |
| Organisation | 1 | a jeter |
| Marketing (calendrier national) | 11 | **a jeter** : ce sont les jours feries, calcules |
| Jour ferie | 12 | **a jeter** : calcules |
| Calendrier Lunaire | 55 | **a jeter** : calcule (dont les 4 saisons) |
| Astronomie | 4 | **a jeter** sauf les eclipses, qui ne sont pas calculees |

**257 lignes tapees chaque annee deviennent 56.** Le reste est soit une regle qui ne se retape
jamais, soit un calcul.

## Ce qui a ete livre

- Trois champs de plus : `famille`, `statut` (`obligation` ou `repere`), et `duree` en jours
  dans la recurrence.
- `bdv-almanach.js` : lune, saisons, jours feries, calcules. Valide contre les 50 phases de
  2026 : 50 sur 50 au bon jour en heure locale.
- Le filtre par famille dans la piece, et l'interrupteur du fond de carte.
- Quatre tokens `--serie-1` a `--serie-4`, mesures : ecart de luminance minimum 11,8 en vision
  normale, 11,2 en simulation deuteranope.
- La page publique ne montre plus que les obligations, et sa phrase sur le report au jour
  ouvre est retiree.
- Le fichier de donnees passe de 5 a 29 occurrences : les 8 obligations, les 11 travaux, et
  quelques temps forts et rendez-vous en exemple.

## Ce que le lot 2 N'A PAS fait, et pourquoi

**Les deux types de recurrence annonces n'ont pas ete ecrits.** `annuel-periode` n'existe pas :
une periode annuelle, c'est `annuel` avec une `duree`, et deux types pour la meme chose
auraient donne deux chemins de code a garder d'accord. `hebdomadaire` n'a aucun usage dans la
bibliotheque. Le lot 2 etait annonce plus gros qu'il ne l'etait.

**L'activation par compte est reportee au lot 3.** Aujourd'hui le vigneron eteint des FAMILLES
entieres, dans son navigateur. Eteindre une ligne, et la retrouver d'un poste a l'autre,
demande la table `calendrier_choix` du lot 3.
