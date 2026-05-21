/**
 * sync-notion.js
 * Pull les articles Notion (Statut = Publié) → src/posts/*.md
 * Exécuté avant chaque build Eleventy.
 * Si NOTION_TOKEN absent : skip silencieux, le build continue.
 */

const path = require('path');
const fs   = require('fs');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB_ID = process.env.NOTION_DB_ID;
const KEEP_DEMO    = process.env.KEEP_DEMO_POSTS === '1';

const POSTS_DIR  = path.join(__dirname, '../src/posts');
const ASSETS_DIR = path.join(__dirname, '../src/assets/posts');

// --- Guard : variables d'env manquantes ---
if (!NOTION_TOKEN || !NOTION_DB_ID) {
  console.warn('[sync-notion] NOTION_TOKEN ou NOTION_DB_ID absent — sync ignoré, build continue.');
  process.exit(0);
}

async function run() {
  let Client, NotionToMarkdown;
  try {
    ({ Client } = require('@notionhq/client'));
    ({ NotionToMarkdown } = require('notion-to-md'));
  } catch (e) {
    console.warn('[sync-notion] Dépendances manquantes (npm install requis) — sync ignoré.');
    process.exit(0);
  }

  const notion = new Client({ auth: NOTION_TOKEN });
  const n2m    = new NotionToMarkdown({ notionClient: notion });

  // Timeout de sécurité : si le sync dépasse 30s, on abandonne
  const timeout = setTimeout(() => {
    console.warn('[sync-notion] Timeout 30s dépassé — sync interrompu, build continue.');
    process.exit(0);
  }, 30000);

  try {
    // 1. Requête Notion : articles publiés
    const response = await notion.databases.query({
      database_id: NOTION_DB_ID,
      filter: {
        property: 'Statut',
        select: { equals: 'Publié' }
      },
      sorts: [{ property: 'Date publication', direction: 'descending' }]
    });

    const pages = response.results;
    console.log(`[sync-notion] ${pages.length} article(s) publié(s) trouvé(s).`);

    // 2. Préparer les dossiers
    if (!fs.existsSync(POSTS_DIR))  fs.mkdirSync(POSTS_DIR,  { recursive: true });
    if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

    // 3. Lister les fichiers à supprimer (sync miroir)
    const existing = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    const toKeep   = KEEP_DEMO ? ['exemple-qr-code-viti.md'] : [];
    const toDelete = existing.filter(f => !toKeep.includes(f));
    toDelete.forEach(f => fs.unlinkSync(path.join(POSTS_DIR, f)));

    // 4. Écrire chaque article
    for (const page of pages) {
      const props = page.properties;

      const titre      = props.Titre?.title?.[0]?.plain_text          || 'Sans titre';
      const slug       = props.Slug?.rich_text?.[0]?.plain_text        || slugify(titre);
      const pilier     = props.Pilier?.select?.name                    || '';
      const auteur     = props.Auteur?.select?.name                    || 'Teddy Pereira';
      const description= props.Description?.rich_text?.[0]?.plain_text || '';
      const dateRaw    = props['Date publication']?.date?.start        || new Date().toISOString().split('T')[0];

      // Convertir les blocs Notion en Markdown
      const mdBlocks = await n2m.pageToMarkdown(page.id);
      const mdBody   = n2m.toMarkdownString(mdBlocks)?.parent || '';

      // Image hero (premier fichier si présent)
      let heroLine = '';
      const heroFiles = props['Image hero']?.files;
      if (heroFiles && heroFiles.length > 0) {
        const imgUrl = heroFiles[0].file?.url || heroFiles[0].external?.url;
        if (imgUrl) {
          const imgPath = path.join(ASSETS_DIR, `${slug}.jpg`);
          await downloadFile(imgUrl, imgPath);
          heroLine = `hero: /assets/posts/${slug}.jpg`;
        }
      }

      const frontmatter = [
        '---',
        `title: "${titre.replace(/"/g, '\\"')}"`,
        `description: "${description.replace(/"/g, '\\"')}"`,
        `pilier: "${pilier}"`,
        `author: "${auteur}"`,
        `date: ${dateRaw}`,
        `layout: article.njk`,
        heroLine,
        '---'
      ].filter(Boolean).join('\n');

      const fileContent = `${frontmatter}\n\n${mdBody}`;
      fs.writeFileSync(path.join(POSTS_DIR, `${slug}.md`), fileContent, 'utf8');
      console.log(`[sync-notion] ✓ ${slug}.md`);
    }

    clearTimeout(timeout);
    console.log('[sync-notion] Sync terminé.');

  } catch (err) {
    clearTimeout(timeout);
    console.error('[sync-notion] Erreur :', err.message);
    process.exit(0); // Ne pas bloquer le build sur erreur Notion
  }
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const http  = require('http');
    const mod   = url.startsWith('https') ? https : http;
    const file  = fs.createWriteStream(dest);
    mod.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

run();
