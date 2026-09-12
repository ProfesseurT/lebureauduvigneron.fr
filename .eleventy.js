/* Configuration Eleventy — Le Bureau du Vigneron.

   Refonte des articles du 10/09/2026. Ce fichier gagne quatre outils, tous au
   service de la meme chose : une rubrique n'etait jusqu'ici qu'un mot ecrit dans
   l'entete de vingt fichiers, jamais une page. Elle en devient une.

   - `sansEmoji` retire le pictogramme colle au nom du pilier. « Process 🔧 » est
     une donnee de saisie, pas un libelle d'interface : un emoji en petites
     capitales interlettrees, ca ne se compose pas.
   - `ancre` fabrique un identifiant stable a partir d'un texte francais accentue.
   - `avecAncres` et `sommaire` lisent le HTML DEJA RENDU d'un article pour poser
     un identifiant sur chaque titre de section et en tirer la table des matieres.
     Fait par expression reguliere et pas par un module markdown-it : le depot n'a
     que trois dependances de developpement, et ce n'est pas le moment d'en ajouter
     une pour trente lignes.
   - `absolu` : les robots de partage et le balisage schema.org n'acceptent que des
     adresses completes. Un chemin relatif y est ignore en silence.
*/

const SITE = "https://lebureauduvigneron.fr";

/* Les quatre rubriques, definies une seule fois dans src/_data/rubriques.js.
   Requis directement ici : le dossier _data alimente les gabarits, pas ce
   fichier de configuration, et la collection en a besoin avant eux. */
const RUBRIQUES = require("./src/_data/rubriques.js");

/* Un identifiant d'ancre : sans accent, sans majuscule, sans ponctuation. */
function ancrer(txt) {
  return String(txt)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/* Les quatre plages qui couvrent les pictogrammes utilises dans les entetes,
   plus le selecteur de variante U+FE0F qui suit certains d'entre eux. */
function sansEmoji(txt) {
  return String(txt)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* Les titres de section du corps d'un article, dans l'ordre du document. */
function titresH2(html) {
  const out = [];
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/g;
  let m;
  while ((m = re.exec(String(html))) !== null) {
    const texte = m[1].replace(/<[^>]+>/g, "").trim();
    if (texte) out.push({ id: ancrer(texte), texte });
  }
  return out;
}

module.exports = function(eleventyConfig) {
  // Copier le CSS, JS et les assets tels quels
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/assets");
  /* LE MANIFESTE VA A LA RACINE, 11/09/2026. C'est lui qui fait la difference entre un
     raccourci et une application : sans lui, « Sur l'ecran d'accueil » sur un iPhone ne
     produit qu'un signet qui rouvre Safari avec sa barre, et AUCUNE notification n'est
     possible, Apple les conditionnant a une vraie application installee.
     Il n'est copie par aucune des trois lignes du dessus, et une regle oubliee ici ne
     leve aucune erreur : la page declare simplement un manifeste qui rend 404, et
     l'installation retombe sur le comportement de signet, en silence. */
  eleventyConfig.addPassthroughCopy({ "src/manifest.webmanifest": "manifest.webmanifest" });
  // Trier les posts du plus récent au plus ancien
  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md").reverse();
  });

  /* Les quatre rubriques, chacune avec ses articles ranges du plus recent au plus
     ancien. Une rubrique vide est ecartee : mieux vaut pas de page qu'une page qui
     annonce une rubrique et ne montre rien.

     Le rattachement se fait sur `categorie`, jamais sur `pilier` : voir l'entete
     de src/_data/rubriques.js pour la raison. Un article dont la `categorie` ne
     correspond a aucune rubrique n'apparait dans AUCUNE page de rubrique — il
     reste visible sur /articles/ par la collection `posts`, mais il perd son fil
     d'Ariane. Le controle en fin de fichier le signale au build. */
  eleventyConfig.addCollection("rubriques", function(collectionApi) {
    const posts = collectionApi.getFilteredByGlob("src/posts/*.md");
    const orphelins = posts.filter(function(p) {
      return !RUBRIQUES.some(function(r) { return r.categories.indexOf(p.data.categorie) !== -1; });
    });
    if (orphelins.length) {
      console.warn("[rubriques] " + orphelins.length + " article(s) sans rubrique : " +
        orphelins.map(function(p) { return p.inputPath + " (categorie: " + p.data.categorie + ")"; }).join(", "));
    }
    return RUBRIQUES.map(function(r) {
      const arts = posts
        .filter(function(p) { return r.categories.indexOf(p.data.categorie) !== -1; })
        .sort(function(a, b) { return b.date - a.date; });
      return Object.assign({}, r, { articles: arts });
    }).filter(function(r) { return r.articles.length > 0; });
  });

  /* La rubrique d'un article, depuis sa `categorie`. Utilise par le fil d'Ariane,
     l'etiquette de rubrique et le bloc « du meme rayon ». */
  eleventyConfig.addFilter("rubriqueDe", function(categorie) {
    return RUBRIQUES.filter(function(r) { return r.categories.indexOf(categorie) !== -1; })[0] || null;
  });

  // Date machine, pour les comparaisons faites dans le navigateur. Le filtre lisible
  // ci-dessous produit du francais, illisible par Date.parse().
  eleventyConfig.addFilter("dateISO", function(dateObj) {
    return new Date(dateObj).toISOString();
  });

  // Filtre de date lisible en français
  eleventyConfig.addFilter("dateReadable", function(dateObj) {
    const d = new Date(dateObj);
    return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  });

  /* Les voisins d'un article dans sa rubrique, le plus recent d'abord, lui-meme
     exclu. Trois par defaut. Ecrit comme un filtre et pas dans le gabarit parce
     que Nunjucks n'a pas de `selectattr` : un `{% set %}` pose dans une boucle
     ne survit pas a la boucle, et la version en gabarit rendait toujours vide. */
  eleventyConfig.addFilter("memeRubrique", function(posts, categorie, url, combien) {
    const r = RUBRIQUES.filter(function(x) { return x.categories.indexOf(categorie) !== -1; })[0];
    if (!r) return [];
    return posts.filter(function(p) {
      return r.categories.indexOf(p.data.categorie) !== -1 && p.url !== url;
    }).slice(0, combien || 3);
  });

  eleventyConfig.addFilter("sansEmoji", sansEmoji);
  eleventyConfig.addFilter("ancre", ancrer);

  /* Le meme HTML, chaque <h2> portant desormais son identifiant. */
  eleventyConfig.addFilter("avecAncres", function(html) {
    return String(html).replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/g, function(tout, attrs, dedans) {
      if (/\sid=/.test(attrs)) return tout;
      const texte = dedans.replace(/<[^>]+>/g, "").trim();
      return '<h2' + attrs + ' id="' + ancrer(texte) + '">' + dedans + '</h2>';
    });
  });

  eleventyConfig.addFilter("sommaire", titresH2);

  eleventyConfig.addFilter("absolu", function(chemin) {
    if (!chemin) return SITE + "/";
    if (/^https?:\/\//.test(chemin)) return chemin;
    return SITE + (chemin.startsWith("/") ? "" : "/") + chemin;
  });

  /* Coupe proprement a la fin d'un mot, pour une meta description qui doit tenir
     sous la limite d'affichage de Google sans finir sur une syllabe. */
  eleventyConfig.addFilter("court", function(txt, n) {
    const t = String(txt || "").trim();
    const max = n || 155;
    if (t.length <= max) return t;
    const coupe = t.slice(0, max);
    return coupe.slice(0, coupe.lastIndexOf(" ")).replace(/[,;:]$/, "") + "…";
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
