# BRIEF_EXECUTION_LOG — LP pré-inscription Le Bureau du Vigneron
**Exécuté par :** Claude Code
**Date :** 2026-05-21
**Brief source :** `_pipeline/01_BRIEF/briefs/2026-05-21_LP-pre-inscription.md`

---

## 1. FICHIERS CRÉÉS / MODIFIÉS

### Modifiés
| Fichier | Ce qui a changé |
|---------|-----------------|
| `package.json` | Ajout `@notionhq/client` + `notion-to-md` en deps. Scripts `build` (sync Notion + eleventy), `dev` |
| `.eleventy.js` | Ajout passthrough `src/js/` |
| `src/_includes/base.njk` | Polices Playfair Display + JetBrains Mono. Footer remplacé par `components/footer-rich.njk`. NAV : CTA styled |
| `src/css/style.css` | Refonte complète : nouveaux tokens (--paper, --bordeaux, --cork, --rule...), Playfair sur headings, tous les composants LP |
| `src/index.njk` | Réécrit : structure LP via includes composants |

### Créés
| Fichier | Rôle |
|---------|------|
| `src/js/tiroirs.js` | Logique onglets vanilla JS (click + clavier flèches/Home/End + aria) |
| `src/_includes/components/hero.njk` | Bloc hero photo avec 2 CTAs |
| `src/_includes/components/manifeste.njk` | Texte manifeste Teddy + signature |
| `src/_includes/components/references.njk` | Logos wall (6 placeholders SVG) + 3 verbatims |
| `src/_includes/components/tiroirs.njk` | 5 onglets interactifs (Outils / Enseignement / Agenda / Téléchargements / Partenaires) |
| `src/_includes/components/articles-recent.njk` | 3 derniers articles si posts existent |
| `src/_includes/components/waitlist.njk` | Bloc Tally yPokbX (conservé à l'identique) |
| `src/_includes/components/footer-rich.njk` | Footer 3 colonnes + mention Solumatic |
| `src/assets/logos/placeholder.svg` | SVG générique pour logos clients |
| `src/assets/logos/README.md` | Instructions remplacement logos pour Teddy |
| `scripts/sync-notion.js` | Script pull Notion → posts Markdown (exécuté au build) |
| `.env.example` | Template variables d'env (NOTION_TOKEN, NOTION_DB_ID) |
| `.gitignore` | Exclut `_site/`, `node_modules/`, `.env` |

---

## 2. COMMANDES CÔTÉ TEDDY

### Première fois (installer les dépendances)
```
npm install
```
> Ce que ça fait : télécharge Eleventy + les packages Notion dans `node_modules/`. À faire une seule fois.

### Lancer en local (prévisualiser)
```
npm run dev
```
> Ouvre le site sur http://localhost:8080. Chaque modification de fichier recharge automatiquement.

### Build de production
```
npm run build
```
> Génère le dossier `_site/` prêt à déployer. Si `NOTION_TOKEN` est défini, sync les articles Notion d'abord.

### Build sans Notion (test rapide)
```
npm run build
```
> Si `NOTION_TOKEN` n'est pas défini, le sync est ignoré avec un avertissement et le build continue normalement.

---

## 3. ÉTAPES MANUELLES RESTANTES

### A. Logos clients (priorité haute)
1. Récupérer les fichiers PNG des logos : Vitisoft, Viticode, ESA Angers, Solumatic, Viti-Élevages, VINCA
2. Les déposer dans `src/assets/logos/`
3. Dans `src/_includes/components/references.njk`, remplacer chaque bloc `<svg>` par un `<img>` (voir `src/assets/logos/README.md` pour la procédure exacte)

### B. Verbatims clients (priorité haute)
- Fichier : `src/_includes/components/references.njk`
- Chercher `<!-- TODO Teddy : remplacer par de vrais témoignages clients validés -->`
- Remplacer les 3 verbatims placeholders par les vrais témoignages (accord client requis)

### C. Variables d'env Vercel (pour le sync Notion)
**Quand tu es prêt à connecter Notion :**

1. Va sur https://www.notion.so/profile/integrations
2. Clique **"New integration"** → nom : `Le Bureau du Vigneron Sync` → workspace Solumatic → clique Créer
3. Copie le token **"Internal Integration Secret"** (commence par `secret_...`)
4. Va sur https://vercel.com → ton projet → **Settings → Environment Variables**
5. Ajoute : `NOTION_TOKEN` = ce token (coller la valeur)
6. Crée une base Notion "Articles Bureau du Vigneron" avec les propriétés définies dans le brief (Titre, Slug, Statut, Pilier, Date publication, Auteur, Description, Image hero)
7. Ouvre la base → clique **"..."** en haut à droite → **"Add connections"** → ajoute `Le Bureau du Vigneron Sync`
8. Copie l'ID de la base depuis l'URL (les 32 caractères entre `notion.so/` et `?v=`)
9. Sur Vercel : ajoute `NOTION_DB_ID` = cet ID
10. Sur Vercel : clique **"Redeploy"** → le premier sync se fait automatiquement

> Si tu hésites sur une étape, screenshot ce que tu vois et envoie-moi, je te guide.

### D. DNS (hors scope brief, rappel)
- Pointer `lebureauduvigneron.fr` vers Vercel chez ton registrar
- Configurer la redirection `lebureauduvigneron.com` → `.fr`

### E. Image teddy-avatar.png
- Ajouter `src/assets/teddy-avatar.png` (photo de profil Teddy, 200×200px mini)
- Si absent : un placeholder rond avec la lettre "T" s'affiche automatiquement

---

## 4. POINTS D'ATTENTION

### Onglets tiroirs sur mobile
- En dessous de 900px : scroll horizontal sur les onglets
- En dessous de 600px : les sous-titres mono sont masqués (économie d'espace)
- Les stampes sont masquées sur mobile (même raison)

### Build sans npm install
Le script `sync-notion.js` fait un `require('@notionhq/client')` à l'exécution.
Si `npm install` n'a pas été lancé ET que `NOTION_TOKEN` est défini, le script loggue un avertissement et quitte proprement (le build continue).

### Vercel free tier
- Build doit rester < 45s. Le sync Notion a un timeout automatique à 30s.
- 1 cron gratuit/projet pour automatiser le redéploiement quotidien (optionnel, à activer plus tard dans Vercel Settings → Cron Jobs).

---

## 5. CRITÈRES D'ACCEPTATION — STATUT

| Critère | Statut |
|---------|--------|
| Hero photo `hero-bureau.jpg` visible | ✅ Conservé |
| Bloc Tiroirs : 5 onglets fonctionnels | ✅ Implémenté (JS vanilla) |
| Navigation clavier flèches | ✅ Implémenté (+ Home/End) |
| Accessibilité aria-selected / tabpanel | ✅ Implémenté |
| Mobile < 900px : scroll horizontal onglets | ✅ CSS |
| Références : 6 logos placeholders | ✅ SVG inline avec TODO |
| 3 verbatims placeholders | ✅ Données réalistes |
| Tally `yPokbX` conservé intact | ✅ |
| Footer 3 colonnes + mention Solumatic | ✅ |
| Playfair Display sur h1/h2 | ✅ |
| `npm run build` avec NOTION_TOKEN absent | ✅ Skip + warning |
| Aucun cassage `/teddy/` `/articles/` `/posts/exemple-qr-code-viti/` | ✅ Templates intacts |
| Pas de push sans accord Teddy | ✅ — diff disponible dans GitHub Desktop |

---

*Log généré automatiquement — 2026-05-21*
