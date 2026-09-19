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

  /* LE NOM DE LA RUBRIQUE, ET PAS SON OBJET. Ajoute le 12/09/2026 pour le JSON de
     contenus du bureau. `rubriqueDe` rend `null` quand rien ne correspond, et un
     `null.nom` ecrit dans un gabarit fait echouer le build entier : ici on rend
     toujours une chaine, vide au pire. Les six categories se regroupent en quatre
     rubriques, c'est donc le nom de la RUBRIQUE qu'on affiche, celui que porte
     deja la navigation de /articles/, et pas la categorie brute. */
  eleventyConfig.addFilter("rubriqueNom", function(categorie) {
    var r = RUBRIQUES.filter(function(x) { return x.categories.indexOf(categorie) !== -1; })[0];
    return r ? r.nom : "";
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


  /* ==========================================================================
     LA MINIFICATION DES FEUILLES DE STYLE, POSEE LE 18/09/2026.
     ==========================================================================
     CE QUE CA RAPPORTE, MESURE SUR CE DEPOT : style.css passe de 302 a 146 Ko
     brut, et surtout de 63,5 a 20,1 Ko une fois compresse par le serveur. C'est
     43 Ko de moins sur CHAQUE premiere visite d'une page publique, parce que
     cette feuille est la seule liee par le gabarit de base, sur les 38 pages.
     Le gain tient apres compression parce que la moitie du fichier est du
     commentaire francais, que brotli ne reduit qu'au quart.

     POURQUOI UN HOOK `eleventy.after` ET PAS UN `addTransform`. Un transform ne
     voit que les fichiers produits par un gabarit, donc les 39 HTML. Le CSS
     passe par addPassthroughCopy et court-circuite ce pipeline : il n'existe
     aucun moment ou un transform pourrait l'attraper. Le hook, lui, tourne une
     fois la copie faite.

     CE QUE CA NE TOUCHE PAS, ET C'EST LE POINT IMPORTANT. On reecrit `_site`,
     jamais `src`. scripts/charte.mjs controle `src/css/style.css` en mode site,
     et resout les feuilles du bureau vers `src/` en mode bureau : il continue
     donc de lire des sources intactes, avec leurs commentaires, et il ne peut
     pas se mettre a mentir a cause de cette etape. Meme chose pour les sept
     apercus, repointes le meme jour vers `src/css/`.

     MINIFICATION CONSERVATRICE, ET DELIBEREMENT. csstree.generate() retire les
     commentaires et les blancs, et RIEN D'AUTRE : il ne fusionne pas les regles,
     ne raccourcit pas les couleurs, ne reordonne pas les declarations. Sur une
     feuille dont un garde-fou lit les selecteurs un par un, c'est exactement ce
     qu'on veut. Un minifieur malin casserait charte.mjs sans prevenir.

     LE CONTROLE EST FAIT ICI, PAS AILLEURS. Avant d'ecrire, on compte les regles
     et les declarations des deux cotes et on relit le resultat. Au moindre
     ecart, le fichier d'origine est laisse en place et le build le dit. Une
     optimisation qui echoue en silence est pire que pas d'optimisation.
     ========================================================================== */
  eleventyConfig.on("eleventy.after", async () => {
    const fsp = require("fs");
    const chemin = require("path");
    let csstree;
    try { csstree = require("css-tree"); }
    catch (e) { console.warn("[css] css-tree absent : feuilles laissees telles quelles"); return; }

    const dossier = chemin.join(__dirname, "_site", "css");
    if (!fsp.existsSync(dossier)) return;

    /* Compte ce qui doit etre conserve a l'identique : une regle perdue ou une
       declaration avalee se verrait a l'ecran, pas dans la taille du fichier. */
    const compter = (txt) => {
      let regles = 0, decls = 0, important = 0;
      const arbre = csstree.parse(txt, { positions: false });
      csstree.walk(arbre, (n) => {
        if (n.type === "Rule") regles++;
        if (n.type === "Declaration") { decls++; if (n.important) important++; }
      });
      return { regles, decls, important };
    };

    let gagne = 0;
    for (const nom of fsp.readdirSync(dossier).filter((f) => f.endsWith(".css"))) {
      const f = chemin.join(dossier, nom);
      const avant = fsp.readFileSync(f, "utf8");
      let apres;
      try {
        const arbre = csstree.parse(avant, { positions: false });
        apres = csstree.generate(arbre);
      } catch (e) {
        console.warn("[css] " + nom + " : illisible par css-tree (" + e.message + "), laissee telle quelle");
        continue;
      }
      if (apres.length >= avant.length) continue;   /* deja minifiee, ou rien a gagner */

      let a, b;
      try { a = compter(avant); b = compter(apres); }
      catch (e) { console.warn("[css] " + nom + " : recomptage impossible, laissee telle quelle"); continue; }

      if (a.regles !== b.regles || a.decls !== b.decls || a.important !== b.important) {
        console.warn("[css] " + nom + " : ECART apres minification ("
          + a.regles + "/" + a.decls + "/" + a.important + " contre "
          + b.regles + "/" + b.decls + "/" + b.important + "), feuille laissee telle quelle");
        continue;
      }
      fsp.writeFileSync(f, apres);
      gagne += avant.length - apres.length;
    }
    if (gagne > 0) console.log("[css] minifie : " + Math.round(gagne / 1024) + " Ko de moins a servir");
  });

  /* ==========================================================================
     LE JAVASCRIPT SERVI, POSE LE 19/09/2026.
     ==========================================================================
     MEME PRINCIPE QUE LE CROCHET DU CSS JUSTE AU-DESSUS, ET POUR LES MEMES
     RAISONS : `addPassthroughCopy("src/js")` court-circuite le pipeline des
     transforms, donc rien ne peut attraper ces fichiers avant qu'ils soient
     copies. On reecrit `_site`, JAMAIS `src`. charte.mjs, les sept apercus et
     les deux scripts de jointure (joindre-courrier.mjs, joindre-agenda.mjs)
     lisent tous des sources intactes, avec leurs commentaires : verifie le
     19/09, aucun d'eux ne regarde `_site/js/`.

     DEUX CHOSES, DANS CET ORDRE.

     1. DEUX FICHIERS QU'AUCUNE PAGE NE CHARGE, 58 ko publies pour rien.
        `bdv-courrier.js` (51,7 ko) et `bdv-ics.js` (6,4 ko) ne servent qu'aux
        fonctions Supabase, qui travaillent sur LEURS PROPRES COPIES, dans
        `_deploiement/`, recollees par `npm run courrier:joindre` et
        `npm run agenda:joindre`. Verifie le 19/09 : aucun `<script src>` de
        gabarit, aucun chargement dynamique dans src/js/, et l'import par URL
        publique a ete examine puis REFUSE le 09/09 (voir l'entete de
        supabase/functions/courrier-matin/index.ts). Ils sont donc retires du
        SERVI, et seulement du servi.

     2. LES COMMENTAIRES NE VOYAGENT PLUS. 375 ko de commentaires francais
        partaient dans le navigateur, dont une bonne part sur le chemin qui
        bloque l'affichage. Ce depot commente beaucoup, et c'est une qualite :
        ce n'est pas une raison pour la faire payer a la connexion de Ted.

     ET LA PRUDENCE, QUI EST TOUT LE SUJET. Retirer des commentaires d'un
     JavaScript a la main est la pire idee possible : un `//` dans une chaine,
     un `/` d'expression reguliere, un gabarit qui contient `/*`, et le fichier
     servi devient faux SANS QUE RIEN NE LEVE A LA CONSTRUCTION. On ne devine
     donc rien : c'est ACORN qui dit ou sont les commentaires, le meme analyseur
     que celui d'Eleventy, deja present par lui. Absent, on ne fait rien.

     TROIS GARDE-FOUS, ET AUCUN N'EST DECORATIF :
       a. chaque commentaire est remplace par une espace SUIVIE D'AUTANT DE
          RETOURS A LA LIGNE qu'il en contenait. L'espace empeche de souder deux
          jetons : coller un commentaire entre deux noms les souderait en un
          seul, et rien ne le dirait. Les retours gardent les insertions
          de point-virgule automatiques a leur place, et les numeros de ligne
          avec elles.
       b. on recompte l'ARBRE des deux cotes, par type de noeud. Un seul ecart,
          et le fichier d'origine reste en place. C'est le meme controle que
          celui du CSS, qui recompte regles et declarations.
       c. `node --check` sur CHAQUE fichier produit. S'il refuse, on remet
          l'original ET on fait echouer la construction : un JavaScript casse
          dans `_site` est une page blanche, pas une page moins jolie.

     LES COMMENTAIRES DE LICENCE SONT EPARGNES (`/*!`, `@license`, `@preserve`,
     `Copyright`) : ce depot n'en porte pas aujourd'hui, mais une bibliotheque
     deposee ici demain en porterait, et les retirer serait une faute.
     ========================================================================== */
  eleventyConfig.on("eleventy.after", async () => {
    const fsp = require("fs");
    const chemin = require("path");
    const { execFileSync } = require("child_process");

    const dossier = chemin.join(__dirname, "_site", "js");
    if (!fsp.existsSync(dossier)) return;

    /* ---- 1. CE QU'ON NE PUBLIE PAS ---- */
    let retire = 0;
    for (const nom of ["bdv-courrier.js", "bdv-ics.js"]) {
      const f = chemin.join(dossier, nom);
      if (!fsp.existsSync(f)) continue;
      retire += fsp.statSync(f).size;
      fsp.unlinkSync(f);
    }
    if (retire > 0) console.log("[js] non publie : " + Math.round(retire / 1024)
      + " Ko que personne ne charge (bdv-courrier.js, bdv-ics.js)");

    /* ---- 2. LES COMMENTAIRES ---- */
    let acorn;
    try { acorn = require("acorn"); }
    catch (e) { console.warn("[js] acorn absent : commentaires laisses en place"); return; }

    /* Le compte des noeuds par type, des deux cotes. Une instruction perdue se
       verrait a l'ecran, jamais dans la taille du fichier. */
    const histogramme = (arbre) => {
      const compte = Object.create(null);
      const voir = (n) => {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) { for (const x of n) voir(x); return; }
        if (typeof n.type === "string") compte[n.type] = (compte[n.type] || 0) + 1;
        for (const k of Object.keys(n)) {
          if (k === "type" || k === "start" || k === "end" || k === "loc" || k === "range") continue;
          voir(n[k]);
        }
      };
      voir(arbre);
      return Object.keys(compte).sort().map((k) => k + ":" + compte[k]).join(",");
    };

    /* Deux essais : ces fichiers sont des scripts classiques, mais un module
       depose ici demain ne doit pas etre laisse de cote en silence. */
    const analyser = (txt, commentaires) => {
      const opts = { ecmaVersion: "latest", locations: false };
      if (commentaires) opts.onComment = commentaires;
      try { return acorn.parse(txt, Object.assign({ sourceType: "script" }, opts)); }
      catch (e) {
        if (commentaires) commentaires.length = 0;
        try { return acorn.parse(txt, Object.assign({ sourceType: "module" }, opts)); }
        catch (e2) { return null; }
      }
    };

    const LICENCE = /^[!*]|@license|@preserve|@cc_on|copyright/i;
    let gagne = 0, traites = 0;

    for (const nom of fsp.readdirSync(dossier).filter((f) => f.endsWith(".js"))) {
      const f = chemin.join(dossier, nom);
      const avant = fsp.readFileSync(f, "utf8");

      const trouves = [];
      const arbreAvant = analyser(avant, trouves);
      if (!arbreAvant) {
        console.warn("[js] " + nom + " : illisible par acorn, laisse tel quel");
        continue;
      }
      const aRetirer = trouves.filter((c) => !LICENCE.test(String(c.text || "").trim()));
      if (!aRetirer.length) continue;

      /* Une espace pour ne pas souder deux jetons, puis autant de retours a la
         ligne que le commentaire en contenait. */
      let apres = "", curseur = 0;
      for (const c of aRetirer.slice().sort((a, b) => a.start - b.start)) {
        if (c.start < curseur) continue;              /* jamais imbriques, mais on se garde */
        const texte = avant.slice(c.start, c.end);
        apres += avant.slice(curseur, c.start) + " " + "\n".repeat((texte.match(/\n/g) || []).length);
        curseur = c.end;
      }
      apres += avant.slice(curseur);
      if (apres.length >= avant.length) continue;

      const arbreApres = analyser(apres, null);
      if (!arbreApres) {
        console.warn("[js] " + nom + " : relecture impossible apres coup, laisse tel quel");
        continue;
      }
      if (histogramme(arbreAvant) !== histogramme(arbreApres)) {
        console.warn("[js] " + nom + " : ECART d'arbre apres retrait, fichier laisse tel quel");
        continue;
      }

      fsp.writeFileSync(f, apres);
      /* LE DERNIER MOT REVIENT A NODE, PAS A NOUS. */
      try {
        execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
      } catch (e) {
        fsp.writeFileSync(f, avant);
        throw new Error("[js] " + nom + " : `node --check` REFUSE le fichier produit. "
          + "L'original a ete remis dans _site, et la construction s'arrete ici : un "
          + "JavaScript casse qui part en ligne est une page blanche.\n"
          + String((e.stderr || "").toString() || e.message).split("\n").slice(0, 6).join("\n"));
      }
      gagne += avant.length - apres.length;
      traites++;
    }
    if (gagne > 0) console.log("[js] commentaires retires de " + traites + " fichier(s) : "
      + Math.round(gagne / 1024) + " Ko de moins a servir");
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
