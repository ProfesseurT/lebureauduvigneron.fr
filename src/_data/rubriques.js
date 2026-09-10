/* LES QUATRE RUBRIQUES DU SITE. Posees le 10/09/2026.

   Pourquoi ce fichier existe. Les articles portaient DEUX etiquettes depuis le
   depart : `pilier` (« Process 🔧 », « Marketing 📈 »…) qui etait la seule
   affichee, et `categorie` (« Réglementation », « Vendre & fidéliser »…) qui
   n'etait affichee nulle part. Et c'est la mauvaise qui etait montree :
   « Process » ramassait dix articles dont les tournees de livraison et la
   politique RSE, « Organisation » ramassait l'oenotourisme et la vente au
   domaine. Une classification qui met le commerce dans l'organisation n'aide ni
   le lecteur ni le moteur de recherche.

   Ted a tranche le 10/09/2026 : on part de `categorie`, et on regroupe les six
   valeurs en quatre rubriques. « Vente directe & Œnotourisme » rejoint « Vendre
   & fidéliser », « Outils & données » rejoint « Gérer & s'organiser ». Deux
   rubriques a un ou deux articles auraient fait deux pages maigres, et une page
   maigre ne se classe pas.

   `pilier` n'est plus lu par aucun gabarit. Il reste dans les entetes des vingt
   fichiers, sans effet, en attendant que Ted decide de l'effacer.

   COMMENT AJOUTER UN ARTICLE A UNE RUBRIQUE : on ne touche pas a ce fichier, on
   ecrit la bonne `categorie` dans l'entete de l'article. Ce fichier ne change
   que pour creer une rubrique ou en renommer une.

   ATTENTION AUX ADRESSES : `slug` fabrique l'adresse publique
   /articles/rubrique/<slug>/. Renommer un slug casse le lien que Google a
   indexe. Le nom affiche (`nom`, `titre`) se change librement, le slug non.

   L'ordre du tableau est l'ordre d'affichage sur /articles/, du plus fourni au
   moins fourni : les deux premiers ecrans d'une page recoivent la grande majorite
   de l'attention, autant y mettre les rubriques qui portent le plus d'articles.
*/
module.exports = [
  {
    slug: "vendre-fideliser",
    nom: "Vendre & fidéliser",
    titre: "Vendre son vin et fidéliser ses clients",
    categories: ["Vendre & fidéliser", "Vente directe & Œnotourisme"],
    descSeo: "Marketing, storytelling, segmentation clients, vente au domaine et œnotourisme : la méthode commerciale des vignerons qui vendent, sans budget pub.",
    intro: "Se faire connaître, vendre au domaine, garder ses clients : la partie commerciale du métier, celle qu'on apprend rarement à l'école de viti. Storytelling, plan marketing, segmentation, œnotourisme, vente à l'exploitation. Du terrain, pas de la théorie d'école de commerce."
  },
  {
    slug: "gerer-organiser",
    nom: "Gérer & s'organiser",
    titre: "Gérer et organiser son domaine",
    categories: ["Gérer & s'organiser", "Outils & données"],
    descSeo: "Réorganiser son domaine, gagner du temps sur l'administratif, optimiser ses tournées, lire ses données : l'organisation d'une exploitation viticole.",
    intro: "Le temps perdu ne se voit pas dans les comptes, et pourtant il s'y trouve. Remettre son fonctionnement à plat, savoir ce que coûte une gestion sans outil, optimiser ses tournées, lire ses chiffres, poser une politique RSE qui tienne."
  },
  {
    slug: "reglementation",
    nom: "Réglementation & obligations",
    titre: "Réglementation et obligations du vigneron",
    categories: ["Réglementation"],
    descSeo: "DAI, facturation électronique, étiquetage, certification de caisse : ce qui est vraiment obligatoire pour un vigneron, à quelle date, et comment le boucler.",
    intro: "DAI, facturation électronique, étiquetage, certification de caisse : les obligations tombent chaque année, et chaque année c'est la même course. Ce qui est vraiment obligatoire, à quelle date, et comment boucler proprement."
  },
  {
    slug: "se-lancer",
    nom: "Se lancer",
    titre: "Se lancer : négoce, distillerie",
    categories: ["Se lancer"],
    descSeo: "Créer une société de négoce ou une distillerie quand on est vigneron : statut juridique, régime fiscal, agréments douaniers et paperasse à anticiper.",
    intro: "Monter une activité à côté de sa production, c'est monter une deuxième entreprise. Ce que personne ne montre du lancement : le statut, le régime fiscal, les agréments douaniers, et la paperasse à anticiper avant la première bouteille."
  }
];
