# Ajouter une occurrence au calendrier

Tuto pour Ted, écrit le 08/09/2026. Tout se passe dans **un seul fichier** :

    src/_data/echeances.json

Rien à toucher ailleurs. Ni dans le code, ni dans les pages. Ce que tu écris là apparaît
d'un coup dans la pièce « Le calendrier » du bureau, sur la page publique
`/outils/echeances/`, dans le petit bloc de « Ma journée » et dans « Mes tâches ».

---

## Étape 1. Ouvrir le fichier

    ~/Projets/lebureauduvigneron.fr/src/_data/echeances.json

C'est une liste entre crochets `[ ]`. Chaque occurrence est un bloc entre accolades `{ }`,
et les blocs sont séparés par une virgule.

## Étape 2. Copier un bloc existant

Copie un bloc entier, colle-le juste après, et change son contenu. C'est plus sûr que d'en
écrire un de zéro : tu ne peux pas oublier une accolade.

**La virgule est le piège numéro un.** Il en faut une entre deux blocs, et il n'en faut
**pas** après le dernier. Une virgule en trop et le fichier ne se charge plus du tout.

## Étape 3. Remplir les huit champs

```json
{
  "cle": "tva-trimestre",
  "titre": "Déclaration de TVA trimestrielle",
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
| `cle` | Un nom court, sans accent ni espace, avec des tirets | **Il doit être unique.** C'est lui qui sert à retenir qu'un vigneron a coché cette obligation. Deux occurrences avec la même clé, et cocher l'une coche l'autre. |
| `titre` | Ce qui s'affiche en gros | Court : dans une case de calendrier il est coupé. |
| `qui` | Qui est concerné | Une phrase. C'est la question que le vigneron se pose en premier. |
| `detail` | La précision utile | Facultatif. Mets `"detail": null` si tu n'en as pas. |
| `recurrence` | Quand ça tombe | Voir l'étape 4. |
| `source` | L'adresse du texte officiel | Obligatoire. Aucune date sans sa source. |
| `sourceNom` | Le nom affiché du lien | « Douane », « impots.gouv.fr », « FranceAgriMer ». |
| `article` | Le lien vers ton article de blog | `null` si tu n'en as pas encore écrit. Sinon `"/posts/mon-article/"`. |

## Étape 4. Choisir la récurrence

**Trois formes seulement fonctionnent aujourd'hui.** Les périodes qui s'étalent sur
plusieurs jours et l'hebdomadaire arrivent au lot 2.

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

**Une seule fois, à une date fixe :**

```json
"recurrence": { "type": "unique", "date": "2027-09-01" }
```

La date s'écrit toujours année, mois, jour, séparés par des tirets.

Une occurrence unique déjà passée ne disparaît pas : elle s'affiche en bas, avec
« En vigueur depuis le… ». C'est voulu, une obligation entrée en vigueur reste utile à lire.

## Étape 5. Regarder le résultat

Dans ton terminal :

    cd ~/Projets/lebureauduvigneron.fr && npm start

Puis ouvre `http://localhost:8080/mon-bureau/#calendrier`.

Le calcul se fait dans le navigateur, jamais à la construction du site. Un simple
rechargement de page suffit après une modification de ce fichier, pas besoin de redémarrer.

## Étape 6. Vérifier, puis publier

    cd ~/Projets/lebureauduvigneron.fr && npm run verif

Puis, si c'est conforme :

    git add -A && git commit -m "Calendrier : nouvelle occurrence TVA trimestrielle" && git push origin main

Vercel publie tout seul au push. Tu confirmes la mise en production sur Vercel.

---

## Si le calendrier reste vide

C'est presque toujours le fichier JSON, et presque toujours une virgule.

Lance ceci, il te dira la ligne fautive :

    cd ~/Projets/lebureauduvigneron.fr && node -e "JSON.parse(require('fs').readFileSync('src/_data/echeances.json'));console.log('le fichier est bon')"

Une occurrence dont la récurrence est mal écrite est ignorée toute seule depuis le
08/09/2026 : elle ne s'affiche pas, mais elle n'emporte plus les autres avec elle. Si une
occurrence manque à l'écran sans message d'erreur, c'est là qu'il faut regarder.

---

## Ce que tu ne peux PAS encore faire

- **Créer une occurrence depuis l'écran, sans toucher au fichier.** C'est le lot 3.
- **Proposer une occurrence que le vigneron active ou non.** Aujourd'hui tout ce que tu
  ajoutes ici s'affiche chez tout le monde. Le tri entre obligations et repères activables
  est le lot 2.
- **Une occurrence qui dure plusieurs jours.** Lot 2.
- **Marquer une occurrence comme commerciale ou réglementaire pour la filtrer.** Lot 2.

Détail des lots dans `PLAN_calendrier.md`.
