module.exports = function(eleventyConfig) {
  // Copier le CSS, JS et les assets tels quels
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/outils");
  eleventyConfig.addPassthroughCopy("admin");

  // Trier les posts du plus récent au plus ancien
  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md").reverse();
  });

  // Filtre de date lisible en français
  eleventyConfig.addFilter("dateReadable", function(dateObj) {
    const d = new Date(dateObj);
    return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
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
