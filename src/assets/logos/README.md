# Logos partenaires / clients

Remplacer les SVG placeholders inline dans `references.njk` par les vrais fichiers une fois disponibles.

## Liste des logos attendus

| Fichier           | Marque               | Format recommandé | Statut      |
|-------------------|----------------------|-------------------|-------------|
| `vitisoft.png`    | Vitisoft             | PNG fond blanc    | TODO Teddy  |
| `viticode.png`    | Viticode             | PNG fond blanc    | TODO Teddy  |
| `esa-angers.png`  | ESA Angers           | PNG fond blanc    | TODO Teddy  |
| `solumatic.png`   | Solumatic            | PNG fond blanc    | TODO Teddy  |
| `viti-elevages.png` | Viti-Élevages      | PNG fond blanc    | TODO Teddy  |
| `vinca.png`       | VINCA                | PNG fond blanc    | TODO Teddy  |

## Comment remplacer

Dans `src/_includes/components/references.njk`, chaque `<div class="logo-item">` contient un SVG placeholder.
Remplacer le `<svg>` par :

```html
<img src="/assets/logos/vitisoft.png" alt="Vitisoft" height="38" loading="lazy">
```

## Spec technique

- Hauteur affichée : 38–40px (width: auto)
- Fond du fichier : blanc ou transparent (PNG)
- Le CSS applique `filter: grayscale(1)` au repos, `grayscale(0)` au hover
