/* ===========================================================================
   LES ANNEES DU CALENDRIER TELECHARGEABLE. Lot D, 14/09/2026.
   ===========================================================================
   AJOUTER UNE ANNEE EST UN CHIFFRE DANS CETTE LISTE. C'est toute la promesse
   du chantier : le Blog du Moderateur retape cinq cents lignes chaque ete,
   nous ajoutons un nombre. `npm run build` construit la page datee, et
   `npm run pdf:calendrier -- --an 2028` sort la feuille.

   LA LISTE EST TRIEE, DE LA PLUS ANCIENNE A LA PLUS RECENTE, et ce n'est pas
   cosmetique : `/outils/calendrier/` sert la DERNIERE de cette liste. Un
   nombre pose dans le desordre y afficherait une annee passee, sans erreur.
   `scripts/banc-annuel.mjs` le verifie, et verifie aussi que la derniere
   n'est pas deja derriere nous : c'est le reveil annuel de tout ce chantier.

   POURQUOI CE FICHIER ET PAS UN ENTETE DE PAGE. Deux gabarits lisent cette
   liste : la page datee et l'adresse stable. Une liste recopiee dans les deux
   aurait fini par diverger, et l'adresse stable aurait servi une annee que
   personne n'avait construite.
   =========================================================================== */
/* CommonJS comme src/_data/rubriques.js : le depot n'a pas de "type": "module" et
   Node previent bruyamment a chaque lecture d'un ESM sans extension .mjs. */
module.exports = [2027];
