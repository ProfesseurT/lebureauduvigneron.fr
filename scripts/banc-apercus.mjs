/* ==========================================================================
   BANC DES APERCUS, 22/09/2026

     npm run build && npm run banc:apercus

   POURQUOI IL EXISTE, ET C'EST LA SEPTIEME FOIS QUE CE DEFAUT SE PAIE.
   Les apercus ne verifient rien, ils MONTRENT, et c'est ce qui les rend
   precieux : `apercu:mot` a trouve un lien invisible que les 78 controles du
   banc declaraient pose, `apercu:modale` a trouve une regle du projet enfreinte
   sur un ecran que 115 controles validaient, `apercu:fiche` MONTRAIT
   « domaine NaN € » pendant des jours.

   Un apercu qui pose moins de feuilles que la page qu'il montre ne montre donc
   RIEN DE VRAI, et il ne le dit pas. Le compte, au 22/09/2026 :

     apercu:equipe ....... une journee entiere de piece NUE (21/09)
     apercu:invitation ... bandeau NU, le seul ecran que voit un invite (21/09)
     apercu:amorce ....... trois feuilles sur quatre (21/09)
     apercu:modale ....... trois sur quatre, il manquait bdv-poste.css (22/09)
     apercu:fiche ........ trois sur cinq (22/09)
     apercu:ardoise ...... style.css SEULE, donc un ecran nu (22/09)
     apercu:mot .......... style.css SEULE (22/09)
     apercu:panneau ...... style.css SEULE (22/09)

   HUIT FOIS. Aucun apercu n'est dans `npm run verif`, et c'est voulu : ils
   montrent, ils ne verifient pas. Mais rien ne verifiait LES APERCUS
   eux-memes, et c'etait le trou. Ce banc-ci est dans `npm run verif`.

   LA REGLE QU'IL TIENT :

     > Un apercu charge exactement ce que charge la page qu'il montre. Les
     > quatre feuilles liees, dans l'ordre du gabarit, plus celles que du code
     > pose pour l'ecran qu'il montre, apres elles.

   IL NE COMPARE PAS DES NOMS DE FICHIERS ECRITS A LA MAIN, et c'est tout le
   sujet : ce serait une deuxieme liste a tenir, et une liste tenue a la main
   ment le jour ou on l'oublie. LA VERITE VIENT DE LA PAGE CONSTRUITE,
   `_site/mon-bureau/index.html`, relue a chaque passage ; les trois feuilles
   que du JavaScript pose, elles, ne sont dans aucun HTML et sont nommees une
   seule fois, dans `scripts/feuilles-bureau.mjs`, d'ou `scripts/charte.mjs`
   les lit aussi.

   CE QU'IL NE SAIT PAS FAIRE, ET IL FAUT LE SAVOIR : il lit le TEXTE des
   scripts, il ne les execute pas. Il dit qu'un apercu va chercher les feuilles
   la ou elles sont vraies ; il ne dit pas que l'image est belle. Ca, seuls les
   yeux le disent, et c'est pour ca que les apercus existent.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { RACINE, FEUILLES_JS, feuillesLiees, estFeuilleJs } from './feuilles-bureau.mjs';

let ok = 0, ko = 0;
const dit = (v, quoi, detail) => {
  if (v) { ok++; console.log('  OK    ' + quoi); }
  else { ko++; console.log('  ECHEC ' + quoi + (detail ? '\n        ' + detail : '')); }
};

/* L'EXCEPTION EST NOMMEE, AVEC SA RAISON, ET PAS OUBLIEE EN SILENCE. Une
   exception qu'on ne voit plus redevient un oubli : c'est la lecon des deux
   exemptions du plancher tactile de la sonde de rendu, comptees a part au lieu
   d'etre tues. */
const EXCEPTIONS = {
  'apercu-courrier.mjs':
    'un mail est AUTONOME : aucune messagerie ne charge de feuille externe, tout '
    + 'le dessin du courrier est en style de ligne dans src/js/bdv-courrier.js. '
    + 'Poser une feuille du bureau ici montrerait un courrier que personne ne recevra.'
};

console.log('\n== 1. LA VERITE VIENT DE LA PAGE CONSTRUITE ==');
let LIEES = [];
try { LIEES = feuillesLiees(); }
catch (e) { console.log('\n  ECHEC ' + e.message + '\n'); process.exit(1); }
console.log('  /mon-bureau/ lie, dans cet ordre :');
LIEES.forEach((f, i) => console.log('        ' + (i + 1) + '. ' + f));
dit(LIEES.length >= 2, 'la page construite lie au moins deux feuilles locales');
dit(LIEES.includes('src/css/style.css'),
    'style.css en fait partie',
    'Si elle n y est plus, ce banc lit autre chose que le bureau : verifier le gabarit avant de le croire.');
for (const j of FEUILLES_JS) {
  dit(fs.existsSync(path.join(RACINE, j.fichier)),
      'la feuille posee par ' + j.posee + ' existe : ' + j.fichier);
  dit(!LIEES.includes(j.fichier),
      j.fichier + ' n est PAS liee par le gabarit (elle est posee par du code)',
      'Si elle est devenue LIEE, elle sort de la liste de feuilles-bureau.mjs : son moment de chargement a change, et le recouvrement qui en depend aussi.');
}

console.log('\n== 2. LE SOCLE NE TIENT AUCUNE LISTE EN DUR ==');
const socle = fs.readFileSync(path.join(RACINE, 'scripts/apercu-socle.mjs'), 'utf8');
/* ON NE LIT QUE LES CHAINES, ET LES COMMENTAIRES SONT RETIRES D'ABORD : un
   fichier a le droit de NOMMER une feuille en prose, et les blocs de tete de ce
   depot le font abondamment, avec des accents graves autour des noms. Il n'a
   pas le droit d'en tenir la LISTE. Le prefixe de chemin est retire,
   `../src/css/x.css` et `src/css/x.css` etant la meme feuille. */
const sansCommentaire = (txt) => txt.replace(/\/\*[\s\S]*?\*\//g, ' ')
                                    .replace(/^[ \t]*\/\/.*$/gm, ' ');
const citees = (txt) => [...sansCommentaire(txt)
    .matchAll(/['"`]([^'"`\n]*src\/css\/[a-z0-9.-]+\.css)['"`]/gi)]
  .map(m => 'src/css/' + m[1].split('src/css/').pop());
const enDur = citees(socle);
dit(enDur.length === 0,
    'apercu-socle.mjs ne nomme aucune feuille en dur',
    'Il en nomme : ' + enDur.join(', ') + '. Une liste ecrite a la main dans le socle se perime le jour ou le gabarit bouge, et les huit apercus se periment avec elle.');
dit(/feuillesLiees\s*\(/.test(socle),
    'il lit les feuilles liees sur la page construite');
dit(/<body class="' \+ \(opts\.poste === false \? 'bdv-coque' : 'bdv-coque bdv-poste'\)/.test(socle),
    'sa planche pose `bdv-coque` sur le corps de page, et `bdv-poste` avec lui',
    'Tout le dessin du bureau est scope par `bdv-coque` : sans elle, ni bouton, ni champ, ni zone. Et sans `bdv-poste`, aucune regle telephone ne s applique, puisqu elles s ecrivent toutes `body.bdv-poste` sous 700 px.');
dit(/data-theme="\s*'\s*\+\s*t|data-theme="' \+ t/.test(socle) || /\['light', 'clair'\]/.test(socle),
    'sa planche rend les DEUX themes cote a cote');

console.log('\n== 3. CHAQUE APERCU POSE CE QUE SA CIBLE CHARGE ==');
/* LE SOCLE N'EST PAS UN APERCU : il ne montre rien, il monte. */
const fichiers = fs.readdirSync(path.join(RACINE, 'scripts'))
  .filter(f => /^apercu-.*\.mjs$/.test(f) && f !== 'apercu-socle.mjs').sort();
dit(fichiers.length > 0, 'des scripts d apercu existent (' + fichiers.length + ')');

for (const nom of fichiers) {
  const src = fs.readFileSync(path.join(RACINE, 'scripts', nom), 'utf8');
  const cites = citees(src);
  console.log('\n  -- ' + nom);

  if (EXCEPTIONS[nom]) {
    /* L'EXCEPTION SE CONTROLE AUSSI. Le jour ou ce fichier se mettrait a poser
       une feuille du bureau, ce ne serait plus l'exception ecrite ici. */
    dit(cites.length === 0,
        'exception nommee, et elle tient : ' + nom + ' ne pose aucune feuille du bureau',
        'Il en pose : ' + cites.join(', '));
    console.log('        raison : ' + EXCEPTIONS[nom]);
    continue;
  }

  /* PRENDRE SES FEUILLES DU SOCLE VEUT DIRE LES IMPORTER DE LUI, pas seulement
     l'importer. Un fichier qui lui prend `ecrire` et se refabrique un `planche`
     a lui a exactement le defaut qu'on cherche, et la premiere version de ce
     banc le declarait conforme : verifie par mutation le 22/09/2026. */
  const imports = (sansCommentaire(src).match(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/apercu-socle\.mjs['"]/) || [])[1] || '';
  const noms = imports.split(',').map(x => x.trim());
  const parLeSocle = (noms.includes('cssBureau') || noms.includes('planche'))
    && /(cssBureau|planche)\s*\(/.test(src);
  dit(parLeSocle,
      'il prend ses feuilles du socle, donc de la page construite',
      'Sans le socle, il tient sa propre liste, et une liste tenue a la main ment le jour ou on l oublie. C est exactement ce que les huit defauts de l en-tete ont coute.');

  /* CE QU'IL POSE EN PLUS. Une feuille citee en dur dans un apercu n'est
     legitime que si c'est une feuille POSEE PAR DU CODE dans le produit : la
     page ne la lie pas, donc le socle ne peut pas la deviner. Citer une
     feuille LIEE, en revanche, c'est se refabriquer la liste qu'on vient de
     supprimer. */
  const fautives = cites.filter(f => !estFeuilleJs(f));
  dit(fautives.length === 0,
      'il ne redit aucune feuille que le gabarit lie deja',
      'Il redit : ' + fautives.join(', ') + '. Ces feuilles-la viennent de la page construite, pas d une liste.');

  /* ET SI L'APERCU TIENT QUAND MEME SA LISTE, ON LA COMPARE A LA PAGE. Sans
     cette moitie-la, le banc ne saurait dire que « ce fichier n'utilise pas le
     socle », jamais « il lui manque bdv-poste.css », c'est-a-dire le defaut du
     jour. Un banc doit nommer le defaut, pas le chemin qui y mene. */
  if (!parLeSocle) {
    const posees = cites.filter(f => LIEES.includes(f));
    const manquantes = LIEES.filter(f => !posees.includes(f));
    dit(manquantes.length === 0,
        'sa liste porte les ' + LIEES.length + ' feuilles que la page lie',
        'Il manque : ' + manquantes.join(', ') + '. Depuis la scission du 21/09/2026, style.css ne porte plus les regles du bureau : il rend donc un ecran NU, et il ne le dit pas.');
    const rang = posees.map(f => LIEES.indexOf(f));
    dit(rang.every((v, i) => i === 0 || v > rang[i - 1]),
        'et dans l ordre ou le gabarit les lie',
        'bdv-poste.css est liee ENTRE style.css et bdv-bureau.css : inverser deux feuilles retourne la moitie des arbitrages du chantier des deux themes, sans qu une declaration ait bouge.');
  }
  const enPlus = [...new Set(cites.filter(estFeuilleJs))];
  if (enPlus.length) console.log('        en plus, et c est legitime : ' + enPlus.join(', ')
    + '  (posee' + (enPlus.length > 1 ? 's' : '') + ' par du code dans le produit, donc apres les feuilles liees)');

  /* LE SCOPE ET LES DEUX THEMES. Si l'apercu passe par `planche`, c'est le
     socle qui repond, et la section 2 l'a deja controle une fois pour tous. */
  const parLaPlanche = noms.includes('planche') && /planche\s*\(/.test(src);
  /* SUR LE CORPS DE PAGE, OU SUR LA COLONNE DU BUREAU. `apercu:porte` montre
     les DEUX mondes cote a cote : la colonne du site doit sortir en PAPIER, et
     elle ne le peut que si la classe vit sur les deux colonnes du bureau et sur
     elles seules. Ce qu'on exige, c'est que le scope soit pose quelque part,
     pas ou il est pose. */
  dit(parLaPlanche || /class="[^"]*bdv-coque/.test(src),
      'il pose le scope `bdv-coque` sur ce qu il montre du bureau',
      'Tout le dessin du bureau est scope par cette classe : sans elle, ni bouton, ni champ, ni zone, ni rangee.');
  dit(parLaPlanche || (/data-theme/.test(src) && /['"]dark['"]/.test(src) && /['"]light['"]/.test(src)),
      'il rend les deux themes, clair et sombre',
      'Un bureau s ouvre a 6 h dans un chai et a 23 h dans un bureau. Un apercu qui ne montre qu un theme ne montre que la moitie du produit.');
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) {
  console.log('  UN APERCU MONTRE AUTRE CHOSE QUE LA PAGE QU IL PRETEND MONTRER\n');
  process.exit(1);
}
console.log('  CHAQUE APERCU CHARGE CE QUE CHARGE LA PAGE QU IL MONTRE\n');
process.exit(0);
