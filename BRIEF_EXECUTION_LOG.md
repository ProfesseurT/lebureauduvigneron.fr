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

## 1b. ADDENDUM — PINBOARD 3 ÉTATS (2026-05-21)

**Brief source :** `_pipeline/01_BRIEF/briefs/2026-05-21_LP-pre-inscription_ADDENDUM-pinboard.md`

### Fichiers créés / modifiés (addendum)
| Fichier | Ce qui a changé |
|---------|-----------------|
| `src/_includes/components/demo-pinboard.njk` | Section complète : 8 note-cards positionnées, dashboard Vitisoft mock (sidebar, KPIs, 3 charts SVG), header étape/hint, footer ticks |
| `src/js/pinboard.js` | Machine à états 3 étapes : click/clavier, crossfade layers, positions chaos/organized, badges dynamiques |
| `src/css/style.css` | Section pinboard : board, note-cards (.note-card--yellow/kraft/white/cream), punaises, textures liège (radial-gradients + SVG noise), dashboard Vitisoft complet (sidebar gauche, main grid, charts, sidebar droite), responsive 3 breakpoints |
| `src/_includes/base.njk` | Ajout `Caveat:wght@400;500` aux Google Fonts (écriture manuscrite carte cahier) |
| `src/index.njk` | Ajout `{% include "components/demo-pinboard.njk" %}` entre manifeste et références |

### Critères d'acceptation — statut addendum
| Critère | Statut |
|---------|--------|
| Section entre Manifeste et Références | ✅ |
| État défaut `chaos` — 8 cartes dispersées | ✅ |
| Click 1 → grille 4×2, rotations à 0, transition 1.1s | ✅ |
| Click 2 → crossfade Vitisoft dashboard 0.9s | ✅ |
| Click 3 → retour chaos | ✅ |
| Caption + hint + numéro étape dynamiques | ✅ |
| Badge état disparaît en digital | ✅ |
| Dashboard : KPI rouge, donut, lignes, barres | ✅ |
| Clavier Enter/Espace = next state | ✅ |
| Pas de transition au chargement (`.ready` différé) | ✅ |
| Mobile < 768px : 4 cartes, height 500px | ✅ |
| Aucun framework JS ajouté | ✅ |

---

## 1c. ADDENDUM 02 — Todolist + Vitimedia (2026-05-21)

**Brief source :** `_pipeline/01_BRIEF/briefs/2026-05-21_LP-pre-inscription_ADDENDUM-02-todolist-vitimedia.md`

### Fichiers modifiés (addendum 02)
| Fichier | Ce qui a changé |
|---------|-----------------|
| `src/_includes/components/demo-pinboard.njk` | Ajout de 2 nouveaux blocs dans `<main>` du dashboard digital : `.vitisoft-todo` (grid-row:4) + `.vitimedia-zone` (grid-row:5) |
| `src/css/style.css` | Board height 760→920px desktop / 640→800px tablet / 500→640px mobile. `viti-main grid-template-rows` 3→5 lignes. Nouveaux blocs CSS : vitisoft-todo + vitimedia complets |

### Critères d'acceptation — addendum 02
| Critère | Statut |
|---------|--------|
| Todolist "À faire aujourd'hui" visible sous les charts | ✅ |
| 5 items : Dubreuil, cuve 4, TVA, Vidal, QR Gamay | ✅ |
| Cuve 4 cochée — strike-through + opacity réduite | ✅ |
| Bandeau "EMPLACEMENTS VITIMEDIA" + badge "★ DIFFUSION NATIVE" | ✅ |
| 3 encarts : Viti-Élevages (rouge), ESV (vert), ESA Angers (ink) | ✅ |
| Avatar 36×36px carré coloré avec initiales | ✅ |
| Bouton "En savoir +" sur chaque encart | ✅ |
| Hover encart : bordure bordeaux + élévation (CSS) | ✅ |
| Board height augmenté (920px / 800px / 640px) | ✅ |
| Mobile : 3 items todo visibles, 2 encarts visibles | ✅ |
| Autres états chaos + organized inchangés | ✅ |
| Build Eleventy propre (4 fichiers, 0 erreur) | ✅ |

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

---

## 1d. DASHBOARD PREVIEW "Mon Bureau" (2026-05-22)

**Brief source :** `_pipeline/01_BRIEF/briefs/2026-05-22_LP-dashboard-preview.md`

### Fichiers créés / modifiés
| Fichier | Ce qui a changé |
|---------|-----------------|
| `src/_includes/components/dashboard-preview.njk` | Section complète : top bar, sidebar 8 onglets, 8 panels (bureau / outils / bibliothèque / formations / comptoir / tournée / réseau / compte) |
| `src/js/dashboard-preview.js` | Onglets scopés à `.dashboard-mock`, flèches ↑↓ + Home/End + Enter/Espace, hook prénom localStorage/URL |
| `src/css/style.css` | Section `DASHBOARD PREVIEW` ajoutée avant le bloc RESPONSIVE existant (≈320 lignes) |
| `src/index.njk` | Ajout `{% include "components/dashboard-preview.njk" %}` entre tiroirs et articles-recent |
| `src/js/tiroirs.js` | Scope panels query à `.tiroirs-section` (1 ligne, voir Déviations) |

### Déviations par rapport au brief
| Déviation | Justification |
|-----------|---------------|
| `tiroirs.js` modifié (1 ligne) | Sans ça, `panels = document.querySelectorAll('[role="tabpanel"]')` capturait les 8 panels du dashboard. Résultat : cliquer un tiroir cachait le panel dashboard actif. Correction minimale, comportement tiroirs inchangé. |
| `aria-orientation="vertical"` explicite sur sidebar | WCAG — tablist vertical doit l'indiquer pour les screen-readers |
| `disabled` + `aria-disabled="true"` sur boutons "Bientôt" | Meilleure pratique A11Y plutôt que juste désactiver via CSS |

### Critères d'acceptation — statut
| Critère | Statut |
|---------|--------|
| Bloc entre tiroirs et articles-recent | ✅ |
| Fond var(--ink) tranche visuellement | ✅ |
| Sidebar 8 items dans l'ordre exact | ✅ |
| Tableau de bord actif au chargement, 5 modules | ✅ |
| Clic onglet → changement instantané (pas de fade) | ✅ |
| "Mon réseau" cliquable → écran verrouillé "Bientôt" | ✅ |
| Chip "Présenté par" visible et labellisé | ✅ |
| Fiche Vitisoft avec mention transparence | ✅ |
| Prénom par défaut "Vigneron" | ✅ |
| Mobile : sidebar horizontale scrollable, grilles 1 col | ✅ CSS |
| Navigation clavier ↑↓ + Enter/Espace | ✅ |
| Build Eleventy propre — 0 warning, 0 erreur | ✅ |

### Problèmes rencontrés
- **Conflit ARIA tabpanel** : deux systèmes `[role="tablist"]` / `[role="tabpanel"]` sur la même page. tiroirs.js utilisait `document.querySelectorAll` non scopé. Résolu par scope à `.tiroirs-section`.

**Statut : PRÊT POUR PUSH TEDDY**

*Log généré automatiquement — 2026-05-22*

---

## 1e. DASHBOARD PREVIEW V2 — Corrections (2026-05-25)

**Brief source :** `_pipeline/01_BRIEF/briefs/2026-05-22_LP-dashboard-preview_V2.md`

### Fichiers modifiés
| Fichier | Ce qui a changé |
|---------|-----------------|
| `src/index.njk` | Nouvel ordre LP : dashboard-preview déplacé **avant** tiroirs ; references déplacé **après** tiroirs (swap des deux blocs) |
| `src/_includes/components/dashboard-preview.njk` | Corrections complètes V2 (voir détail ci-dessous) |
| `src/css/style.css` | Ajout classes `.dbtn` / `.dbtn--bordeaux` / `.dbtn--outline`, `.dform-esa` et sous-éléments, flex sur `.dlib-card` et `.dtournee-info` |

### Corrections détaillées dans dashboard-preview.njk
| Section | V1 (avant) | V2 (après) |
|---------|-----------|-----------|
| **Ordre LP** | dashboard après tiroirs | dashboard avant tiroirs |
| **Panel 01 — partenaire** | "Jardin & Vigne" (fictif) | "Vinilabel — étiquetage Loire" (réel) |
| **Panel 01 — boutons** | `<button onclick="console.log(...)">` | `<a href="#waitlist" class="dbtn ...">` |
| **Panel 02 — tags** | "Lead magnet" × 5 | Tags catégorie métier : Communication / Commercial / Productivité / Diagnostic / Conformité |
| **Panel 02 — descriptions** | Textes génériques | Promesses en 1 ligne per brief |
| **Panel 02 — boutons** | `<button onclick="...">` | `<a href="#waitlist" class="dbtn dbtn--bordeaux">` |
| **Panel 02 — locked** | `<button disabled>` | `<span>` (non-interactif, pas de lien) |
| **Panel 03 — cartes** | Pas de bouton | Bouton "Ouvrir →" `href="#waitlist"` sur chaque carte |
| **Panel 04 — formations** | 3 formations factices avec prix (297€, 397€, 197€) + atelier live tarifé | Unique carte ESA Angers, 5 modules, **aucun prix** |
| **Panel 05 — partenaires** | 4 fiches fictives (Œnoconseil, Vinea, Jardin, Vitisoft) | 6 partenaires réels Vitisoft (Viticode, CER France, Banque Pop., Vinilabel, FVI Anjou, TGS France) |
| **Panel 05 — filtres** | Œnologues / Compta / Étiquetage / Webdesign / ERP | Conformité / Comptabilité / Financement / Étiquetage / Syndicats / Communication |
| **Panel 05 — transparence** | Sur Vitisoft | Sur **Viticode** ("Édité par Solumatic") |
| **Panel 05 — bandeau** | Absent | Ajouté : "20+ partenaires" + lien #waitlist |
| **Panel 06 — boutons** | `<button onclick="...">` | `<a href="#waitlist">` sur chaque replay + bandeau |
| **Panel 07 — bouton** | `<button onclick="...">` | `<a href="#waitlist">` |
| **Panel 08 — liens RGPD** | `href="#" onclick="return false;"` | `href="#waitlist"` |

### Déviations par rapport au brief
Aucune. Toutes les règles V2 respectées à la lettre.

### Vérifications post-build
- `npm run build` → 0 erreur, 0 warning
- Aucune occurrence de "Lead magnet" dans `_site/index.html`
- Aucune occurrence de "297" / "€" dans les panels formations
- Aucune fiche fictive (Œnoconseil / Vinea / Jardin & Vigne) dans `_site/index.html`
- Ordre des sections confirmé : dashboard (l.528) → tiroirs (l.1018) → references (l.1386) → articles (l.1686) → waitlist (l.1704)
- Tous les CTA mock pointent vers `#waitlist` (balises `<a>`)

**Statut : PRÊT POUR PUSH TEDDY**

*Log généré automatiquement — 2026-05-25*
