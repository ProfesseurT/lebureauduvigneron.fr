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
   entete, qui gagne sur ce defaut. Rien d'autre a changer. */
module.exports = {
  auteur: "Teddy Pereira"
};
