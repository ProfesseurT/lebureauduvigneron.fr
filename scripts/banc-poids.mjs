/* ==========================================================================
   LE BANC DU POIDS BLOQUANT, 19/09/2026
   ==========================================================================
       npm run banc:poids        (apres `npm run build`, il lit _site)

   LE DEFAUT QU'IL EXISTE POUR ATTRAPER, et il s'est deja produit. Les notes du
   projet annoncent « 32 ko bloquants » a l'ouverture du bureau. La mesure du
   19/09/2026 en donne 136 : `bdv-nav.js` est passe de 24 a 49 ko sans que le
   chiffre ecrit bouge d'un octet, et 85 ko de code sont ecrits directement dans
   la page. Personne n'a menti : AUCUN BANC NE PESAIT QUOI QUE CE SOIT. Un
   chiffre qu'aucun controle ne relit cesse d'etre vrai le jour ou on l'ecrit.

   CE QU'IL PESE, ET POURQUOI CES DEUX-LA SEULEMENT. Le navigateur s'arrete sur
   ce qui bloque l'analyse du document : un `<script src>` SANS `defer`, sans
   `async` et sans `type="module"` (qui differe tout seul), et tout code ecrit
   dans la page. Les scripts differes, eux, attendent la fin de l'analyse : ils
   pesent sur le reseau, pas sur le premier affichage. Ils sont donc COMPTES A
   PART et affiches, parce que le jour ou l'on cherchera ou gagner, c'est la
   liste complete qu'il faudra sous les yeux.

   LES DONNEES NE SONT PAS DU CODE, et elles sont quand meme montrees. Les
   `<script type="application/json">` du bureau (`bdvContenus`, `bdvEcheances`)
   ne s'executent pas, mais ce sont des octets que le document porte. Les
   compter dans le budget melangerait deux problemes qui ne se reglent pas de la
   meme facon ; ne pas les montrer les laisserait grossir sans temoin.

   LE BUDGET EST UN PLAFOND A FAIRE BAISSER, PAS UNE CIBLE.
   Il est pose JUSTE AU-DESSUS de la mesure du jour, et c'est delibere : un banc
   qui echoue des son premier jour ne sera pas lu, il sera contourne. Ce qu'il
   garde a partir de maintenant, c'est que le chiffre ne remonte plus tout seul.
   Chaque fois qu'un lot fait descendre la mesure, DESCENDRE LE PLAFOND AVEC
   ELLE, dans le meme commit : un plafond qu'on ne resserre jamais finit par ne
   plus rien tenir.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(RACINE, '_site');
const PAGE = path.join(SITE, 'mon-bureau', 'index.html');

/* LE PLAFOND, EN OCTETS. Mesure du 19/09/2026 : 136,0 ko (bdv-nav.js 49,1 ko +
   86,9 ko ecrits dans la page). Voir le bloc de tete : ce nombre DESCEND. */
/* 150 ko le matin du 19/09/2026, quand la mesure etait a 143 : un plafond pose juste
   au-dessus de l'existant, pour qu'il ne monte plus. Le retrait des commentaires du
   JavaScript a la construction, l'apres-midi meme, a fait tomber la mesure a 107 ko.
   Un plafond qui laisse 43 ko de mou ne garde plus rien : on le redescend a 120, et
   on le redescendra encore dans le meme commit que le prochain gain. CE CHIFFRE NE
   REMONTE JAMAIS. S'il faut de la place, c'est qu'il faut retirer du poids. */
const BUDGET = 120 * 1024;

let ok = 0, ko = 0;
const t = (nom, bon, det) => {
  if (bon) { ok++; console.log('  ok    : ' + nom); }
  else { ko++; console.log('  ECHEC : ' + nom + (det !== undefined ? '\n          ' + det : '')); }
};
const kilo = (n) => (n / 1024).toFixed(1) + ' ko';

if (!fs.existsSync(PAGE)) {
  console.error('\n  ECHEC : ' + path.relative(RACINE, PAGE) + ' est absent.'
    + '\n          Ce banc lit la page CONSTRUITE, pas le gabarit : `npm run build` d\'abord.\n');
  process.exit(1);
}
const html = fs.readFileSync(PAGE, 'utf8');

/* --------------------------------------------------------------------------
   LE RELEVE. Expression reguliere et pas jsdom : on ne veut pas EXECUTER la
   page pour la peser, on veut lire ce que le navigateur lit avant de
   l'executer. Meme methode que `titresH2()` dans .eleventy.js.
   -------------------------------------------------------------------------- */
const bloquants = [], differes = [], donnees = [];
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html)) !== null) {
  const attrs = m[1], corps = m[2];
  const src  = (attrs.match(/\ssrc\s*=\s*["']([^"']+)["']/i) || [])[1] || null;
  const type = ((attrs.match(/\stype\s*=\s*["']([^"']+)["']/i) || [])[1] || '').toLowerCase();
  /* `module` est differe par defaut : le compter comme bloquant serait faux. */
  const differe = /\bdefer\b/i.test(attrs) || /\basync\b/i.test(attrs) || type === 'module';

  if (src) {
    /* Le poids d'un fichier externe est celui du fichier SERVI, dans _site, et
       pas celui de la source : la minification du CSS a montre que les deux
       peuvent diverger, et c'est le servi qui arrive chez le vigneron. */
    const local = src.startsWith('/') ? path.join(SITE, src.slice(1)) : null;
    const taille = (local && fs.existsSync(local)) ? fs.statSync(local).size : null;
    (differe ? differes : bloquants).push({ quoi: src, taille, externe: true });
    continue;
  }
  const taille = Buffer.byteLength(corps, 'utf8');
  if (type && !/javascript|ecmascript|module/.test(type)) {
    donnees.push({ quoi: (attrs.match(/\sid\s*=\s*["']([^"']+)["']/i) || [])[1] || type, taille });
  } else if (differe) {
    differes.push({ quoi: 'ecrit dans la page', taille });
  } else {
    bloquants.push({ quoi: 'ecrit dans la page', taille });
  }
}

const somme = (l) => l.reduce((a, x) => a + (x.taille || 0), 0);
const poids = somme(bloquants);

console.log('\n== CE QUI BLOQUE L\'AFFICHAGE DE « Mon bureau » ==');
bloquants.slice().sort((a, b) => (b.taille || 0) - (a.taille || 0))
  .forEach((x) => console.log('  ' + (x.taille == null ? '  ?    ' : kilo(x.taille).padStart(9)) + '  ' + x.quoi));
console.log('  ' + kilo(poids).padStart(9) + '  AU TOTAL');

console.log('\n== CE QUI ATTEND LA FIN DE L\'ANALYSE (defer, async, module) ==');
differes.slice().sort((a, b) => (b.taille || 0) - (a.taille || 0))
  .forEach((x) => console.log('  ' + (x.taille == null ? '  ?    ' : kilo(x.taille).padStart(9)) + '  ' + x.quoi));
console.log('  ' + kilo(somme(differes)).padStart(9) + '  AU TOTAL, hors budget');

if (donnees.length) {
  console.log('\n== LES DONNEES POSEES DANS LA PAGE (ne s\'executent pas, pesent quand meme) ==');
  donnees.slice().sort((a, b) => b.taille - a.taille)
    .forEach((x) => console.log('  ' + kilo(x.taille).padStart(9) + '  ' + x.quoi));
  console.log('  ' + kilo(somme(donnees)).padStart(9) + '  AU TOTAL, hors budget');
}

console.log('\n== LES CONTROLES ==');
/* LE PLANCHER, comme `banc-app` exige au moins deux icones. Un selecteur qui ne
   trouve plus rien pese zero, et zero passe sous n'importe quel budget : ce
   banc-la se declarerait vert le jour ou il aurait cesse de regarder. */
t('la page porte bien des scripts : le releve n\'est pas vide',
  bloquants.length + differes.length >= 2,
  bloquants.length + ' bloquant(s), ' + differes.length + ' differe(s). Le releve ne '
  + 'trouve plus rien : la page a change de forme, ou le chemin n\'est plus le bon.');
t('chaque script externe bloquant a bien ete pese',
  bloquants.every((x) => !x.externe || x.taille != null),
  bloquants.filter((x) => x.externe && x.taille == null).map((x) => x.quoi).join(', ')
  + ' : fichier introuvable dans _site. Un script qu\'on ne sait pas peser sort du '
  + 'budget en silence.');
t('le poids bloquant tient sous le plafond (' + kilo(BUDGET) + ')', poids <= BUDGET,
  'Mesure : ' + kilo(poids) + ', soit ' + kilo(poids - BUDGET) + ' de trop.\n          '
  + 'CE PLAFOND NE SE LEVE PAS POUR FAIRE PASSER UN LOT. Les deux sorties ordinaires '
  + 'sont de poser `defer` sur un script qui n\'a pas besoin de bloquer, ou de sortir '
  + 'de la page le code qui y est ecrit.');

console.log('\n== VERDICT ==');
console.log('  ' + kilo(poids) + ' bloquants sur un plafond de ' + kilo(BUDGET)
  + ' (' + Math.round(poids / BUDGET * 100) + ' %)');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DU POIDS REFUSE\n'); process.exit(1); }
console.log('  LE BUREAU S\'OUVRE SOUS SON BUDGET\n');
process.exit(0);
