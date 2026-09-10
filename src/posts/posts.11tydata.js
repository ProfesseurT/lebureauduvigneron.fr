/* Donnee de repertoire Eleventy : s'applique a tous les fichiers de src/posts/.

   Pose le 10/09/2026, quand Ted a decide que le site ne devait plus tourner autour
   de lui. `article.njk` ecrivait « Par Teddy Pereira » EN DUR, pour les vingt
   articles, et aucun article ne portait de champ auteur : la signature etait une
   identite de gabarit et pas une donnee, donc un deuxieme auteur etait impossible
   sans toucher au code.

   Les vingt articles existants gardent cette signature : Ted les a ecrits, et les
   faire signer « la redaction » serait une fausse attribution, exactement la faute
   corrigee le meme jour sur les fiches partenaires.

   Un article ecrit par quelqu'un d'autre porte son propre `auteur:` dans son
   entete, qui gagne sur ce defaut. Rien d'autre a changer.

   `estArticle` a ete ajoute le meme jour, avec la refonte des articles. C'est le
   seul drapeau qui distingue un article d'une page dans la tete du document :
   `components/tete-seo.njk` s'en sert pour basculer `og:type` en « article » et
   pour emettre le balisage BlogPosting. Le tester sur l'adresse de la page ne
   marcherait pas, /articles/ commence par le meme chemin que ses articles ; le
   tester sur `layout` non plus, la valeur vue depuis le gabarit de base est
   toujours « base.njk ». */
module.exports = {
  auteur: "Teddy Pereira",
  estArticle: true
};
