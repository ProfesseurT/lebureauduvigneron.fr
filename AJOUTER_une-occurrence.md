# Ajouter une occurrence au calendrier

Tuto pour Ted. Écrit le 08/09/2026, mis à jour le même jour avec le lot 2.
Tout se passe dans **un seul fichier** :

    src/_data/echeances.json

Rien à toucher ailleurs. Ni dans le code, ni dans les pages. Ce que tu écris là apparaît
d'un coup dans la pièce « Le calendrier » du bureau, dans le petit bloc de « Ma journée » et
dans « Mes tâches ». Sur la page publique `/outils/echeances/`, seules les **obligations**
apparaissent : c'est la promesse de son titre, et c'est la raison de créer un compte.

---

## Étape 1. Copier un bloc existant

Ouvre le fichier, copie un bloc entier `{ … }`, colle-le juste après, change son contenu.
C'est plus sûr que d'en écrire un de zéro : tu ne peux pas oublier une accolade.

**La virgule est le piège numéro un.** Il en faut une entre deux blocs, et il n'en faut
**pas** après le dernier. Une virgule en trop et le fichier ne se charge plus du tout.

## Étape 2. Remplir les dix champs

```json
{
  "cle": "tva-trimestre",
  "titre": "Déclaration de TVA trimestrielle",
  "famille": "obligations",
  "statut": "obligation",
  "qui": "Les domaines au régime réel simplifié qui ont opté pour le trimestre.",
  "detail": "Sur impots.gouv.fr, espace professionnel. Le montant se règle en même temps.",
  "recurrence": { "type": "annuel", "mois": 4, "jour": 30 },
  "source": "https://www.impots.gouv.fr/",
  "sourceNom": "impots.gouv.fr",
  "article": null
}
```

| Champ | Ce que c'est | Attention |
| --- | --- | --- |
| `cle` | Un nom court, sans accent ni espace, avec des tirets | **Il doit être unique.** C'est lui qui sert à retenir qu'un vigneron a coché cette occurrence. Deux occurrences avec la même clé, et cocher l'une coche l'autre. |
| `titre` | Ce qui s'affiche en gros | Court : dans une case de calendrier il est coupé. |
| `famille` | Le tri et le filtre. Quatre valeurs ici, voir l'étape 3 | Une famille inconnue range l'occurrence dans les obligations. **Jamais `taches`** : cette cinquième famille vient de la table des tâches, pas de ce fichier. |
| `statut` | `obligation` ou `repere` | Voir l'étape 4. Ça change ce qu'on promet au vigneron. |
| `qui` | Qui est concerné | Une phrase. C'est la question que le vigneron se pose en premier. |
| `detail` | La précision utile | Facultatif. Mets `"detail": null` si tu n'en as pas. |
| `recurrence` | Quand ça tombe, et combien de temps ça dure | Voir l'étape 5. |
| `source` | L'adresse du texte officiel | Obligatoire pour une obligation. `null` pour un repère de saison. |
| `sourceNom` | Le nom affiché du lien | « Douane », « impots.gouv.fr », « FranceAgriMer ». `null` s'il n'y a pas de source. |
| `article` | Le lien vers ton article de blog | `null` si tu n'en as pas encore écrit. Sinon `"/posts/mon-article/"`. |

## Étape 3. Choisir la famille

Quatre familles, et elles trient par **ce que le vigneron en fait**, pas par ce que la chose
est. C'est ce qui rend le filtre utile : chacune répond à une question différente.

| `famille` | Ce que ça répond | Exemples |
| --- | --- | --- |
| `obligations` | Ça coûte une amende | DRM, DAI, déclaration de récolte, facturation électronique |
| `travaux` | Ce que je fais dehors | Taille, travaux en vert, vendanges, vinification |
| `rendezvous` | Je m'inscris, je me déplace | Wine Paris, ProWein, Vinitech, concours |
| `tempsforts` | Ce que je poste et ce que je vends | Saint-Valentin, foire aux vins, campagne de fin d'année |

Il existe une cinquième famille, **`taches`**, mais **elle ne s'écrit pas ici**. Ce sont les
notes datées que le vigneron prend lui-même, dans « Mes tâches » ou directement dans son
calendrier. Elles se reconnaissent à l'écran parce qu'elles sont écrites à la main sur le
calendrier imprimé, et pas à une couleur : le papier n'a pas la place d'une cinquième couleur
lisible.

**La ligne à ne pas franchir dans `tempsforts` :** le calendrier porte des **campagnes**, le
sous-main porte des **clients**. « Campagne de fin d'année, du 15 novembre au 20 décembre »
va ici. « Rappeler le domaine Machin » reste au sous-main, qui sait repousser un rappel.

## Étape 4. Obligation ou repère

- `"statut": "obligation"` — c'est écrit dans un texte, la date est la date, et le lien vers
  la source est **obligatoire**.
- `"statut": "repere"` — c'est un ordre de grandeur. La fiche affiche « Repère, pas une
  obligation » à la place de la source, et le vigneron le déplacera sur sa propre fenêtre.

**Ce n'est pas une nuance de vocabulaire.** Une date de traitement affichée avec l'autorité
d'un texte de loi, c'est le genre de chose qui se retourne contre la maison. Dans le doute,
mets `repere`.

## Étape 5. Choisir la récurrence

**Trois formes, et une durée facultative.** La durée est en jours, elle vaut 1 si tu ne la
mets pas, et elle transforme une date en période.

**Tous les mois, le même jour :**

```json
"recurrence": { "type": "mensuel", "jour": 10 }
```

Un jour 31 dans un mois de trente jours est ramené au 30, automatiquement.

**Une fois par an :**

```json
"recurrence": { "type": "annuel", "mois": 12, "jour": 10 }
```

`mois` va de 1 à 12. 1 = janvier.

**Une période qui revient chaque année :**

```json
"recurrence": { "type": "annuel", "mois": 12, "jour": 1, "duree": 105 }
```

Du 1er décembre, pendant 105 jours. **Une période qui traverse le 31 décembre se calcule
toute seule**, puisqu'on compte des jours à partir d'un début. C'est pour ça qu'il n'y a pas
de date de fin à écrire.

**Une seule fois, à une date fixe :**

```json
"recurrence": { "type": "unique", "date": "2027-09-01", "duree": 3 }
```

La date s'écrit toujours année, mois, jour, séparés par des tirets. C'est la forme des
salons, dont les dates changent chaque année : eux, il faut les remettre à jour.

Une occurrence unique déjà passée ne disparaît pas : elle s'affiche en bas, avec
« En vigueur depuis le… ». Une période commencée mais pas finie affiche « En ce moment » et
passe devant tout le reste.

## Étape 6. Regarder le résultat

Dans ton terminal :

    cd ~/Projets/lebureauduvigneron.fr && npm start

Puis ouvre `http://localhost:8080/mon-bureau/#calendrier`.

Le calcul se fait dans le navigateur, jamais à la construction du site. Un simple
rechargement de page suffit après une modification de ce fichier, pas besoin de redémarrer.

## Étape 7. Vérifier, puis publier

    cd ~/Projets/lebureauduvigneron.fr && npm run verif

Puis, si c'est conforme :

    git add -A && git commit -m "Calendrier : nouvelle occurrence TVA trimestrielle" && git push origin main

Vercel publie tout seul au push. Tu confirmes la mise en production sur Vercel.

---

## Si le calendrier reste vide

C'est presque toujours le fichier JSON, et presque toujours une virgule.

Lance ceci, il te dira la ligne fautive :

    cd ~/Projets/lebureauduvigneron.fr && node -e "JSON.parse(require('fs').readFileSync('src/_data/echeances.json'));console.log('le fichier est bon')"

Une occurrence dont la récurrence est mal écrite est ignorée toute seule : elle ne s'affiche
pas, mais elle n'emporte plus les autres avec elle. Si une occurrence manque à l'écran sans
message d'erreur, c'est là qu'il faut regarder. Vérifie aussi que sa famille n'est pas
éteinte dans le filtre, en haut de la pièce.

---

## Ce que tu n'as PAS à écrire

**La lune, les saisons et les jours fériés sont calculés.** Ne les mets jamais dans ce
fichier. Ta base Notion en portait 71 lignes tapées à la main pour la seule année 2026, dont
une fausse : la pleine lune de juin y était datée du 29 alors qu'elle tombe le 30 à 01 h 57.
Le calcul est dans `src/js/bdv-almanach.js`, il vaut pour 2030 comme pour 2026, et le
vigneron l'éteint d'un clic s'il n'en veut pas.

## Ce que tu ne peux pas encore faire

- **Proposer un repère que le vigneron active ou non, compte par compte.** Aujourd'hui tout
  s'affiche chez tout le monde, et il éteint des familles entières, dans son navigateur. Lot 3.
- **Une occurrence perso qui revient tous les ans**, du genre « portes ouvertes, premier
  week-end de juin ». Le vigneron peut noter une date, pas encore une règle. Lot 3.
- **Une récurrence hebdomadaire.** Elle s'ajoutera le jour où une ligne en aura besoin.

## Ce que le vigneron peut faire, lui, sans toi

Depuis le 08/09/2026 il note ce qu'il veut directement dans son calendrier : le formulaire est
sous la grille, et le **+** d'une case remplit la date pour lui. Sa note part dans la table des
tâches, donc elle apparaît aussi dans « Mes tâches ». Sans date, elle y attend son heure et le
calendrier se contente d'en annoncer le nombre.

**Sa note peut durer plusieurs jours** : la seconde date du formulaire est facultative et sert
aux salons. Deux dates à l'envers sont remises dans l'ordre, et le retard se compte sur la fin,
pas sur le début : un salon du 9 au 11 n'est pas en retard le 10, il a lieu.

Détail des lots dans `PLAN_calendrier.md`.
