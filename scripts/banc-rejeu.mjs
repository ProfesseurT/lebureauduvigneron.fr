/* ============================================================================
   scripts/banc-rejeu.mjs : le SQL du depot se rejoue-t-il sur une base NEUVE ?

     node scripts/banc-rejeu.mjs

   Ne touche a rien, ne se connecte a aucune base. Sortie 0 seulement si l'ordre
   de collage tient debout.

   POURQUOI CE BANC EXISTE, ET CE QU'IL A TROUVE LE 18/09/2026.
   supabase/schema.sql dit dans son en-tete : « Ecrit pour etre rejouable sans
   erreur. » Il ne l'etait pas. Rejoue sur un Postgres 16 vide, il rendait SIX
   erreurs, et la premiere tombait ligne 61, donc AVANT la creation de la
   moindre table de vente. Une base neuve, partie de ce fichier, n'avait ni
   `ventes`, ni `taches`, ni `bureaux`.

   Personne ne pouvait le voir : sur la base de production, qui avait deja recu
   les lots un par un, chacune des six lignes fautives trouvait son objet et
   passait. Le fichier n'etait faux QUE sur une base neuve, c'est-a-dire
   exactement le jour ou on en aurait eu besoin.

   LES SIX, ET CE QU'ELLES ONT EN COMMUN : toutes nomment un objet qui n'existe
   pas ENCORE. Un `grant` sur une colonne ajoutee 200 lignes plus bas. Deux
   `revoke` sur des fonctions qui ne vivaient que dans leur fichier de lot. Une
   vue qui lit une colonne jamais declaree ici. Deux `grant` sur cette vue.
   C'est une seule maladie : l'ordre.

   CE QUE CE BANC NE FAIT PAS. Il ne lit pas le SQL comme Postgres. Il traque
   quatre formes de reference, celles que le rejeu reel a fait echouer, et il
   se tait sur le reste. Un banc qui pretendrait tout comprendre mentirait plus
   souvent qu'il n'aiderait. Il a ete etalonne CONTRE un vrai Postgres 16 : sur
   le fichier d'avant il trouve les six, sur celui d'apres il n'en trouve
   aucune, et le rejeu reel dit la meme chose aux memes endroits.
   ============================================================================ */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SQL = path.join(RACINE, 'supabase');

/* L'ORDRE DE COLLAGE, ET C'EST LUI LA VRAIE DECLARATION.
   Ce tableau est la seule chose du depot qui dise dans quel ordre coller les
   fichiers pour refaire la base a partir de rien. Un lot ajoute et pas inscrit
   ici n'est pas « oublie par le banc » : il est absent de la procedure, et le
   banc le dit. Les fichiers d'essai (banc-*.sql) et les outils ponctuels
   (lot6-vider-la-base) n'en font pas partie : ils ne construisent rien. */
const ORDRE = [
  'schema.sql',
  'lot21-repere-synchronisation.sql',
  'lot22-socle-colonnes-typees.sql',
  'lot23-table-etroite.sql',
  'lot24-mon-cap.sql',
  'lot25-mon-commerce.sql',
  'lot26-mes-cuvees.sql',
  'lot27-cache-des-resumes.sql',
  'lot28-vider-sans-doute.sql',
];

/* Ce que Supabase fournit d'office et qu'aucun fichier du depot ne cree. */
const FOURNI_PAR_SUPABASE = new Set(['auth.users', 'auth.uid', 'auth.role', 'auth.email', 'auth.jwt',
                                     'gen_random_uuid', 'gen_random_bytes', 'digest', 'crypt', 'gen_salt']);

let ERR = 0;
const ko = (fichier, ligne, m) => { ERR++; console.log(`  ECHEC : ${fichier}:${ligne}  ${m}`); };

/* ---------------------------------------------------------------------------
   Decoupage en instructions.

   On coupe sur les `;` qui ne sont ni dans une chaine, ni dans un commentaire,
   ni dans un corps `$$ ... $$`. Sans le corps dollar-quote, chaque fonction
   plpgsql se decouperait en morceaux et le banc verrait des instructions qui
   n'existent pas.
   --------------------------------------------------------------------------- */
function instructions(txt) {
  const out = [];
  let i = 0, debut = 0, ligne = 1, ligneDebut = 1;
  while (i < txt.length) {
    const c = txt[i];
    if (c === '\n') { ligne++; i++; continue; }
    if (c === '-' && txt[i + 1] === '-') { while (i < txt.length && txt[i] !== '\n') i++; continue; }
    if (c === '/' && txt[i + 1] === '*') { i += 2; while (i < txt.length && !(txt[i] === '*' && txt[i + 1] === '/')) { if (txt[i] === '\n') ligne++; i++; } i += 2; continue; }
    if (c === "'") { i++; while (i < txt.length && txt[i] !== "'") { if (txt[i] === '\n') ligne++; i++; } i++; continue; }
    if (c === '"') { i++; while (i < txt.length && txt[i] !== '"') { if (txt[i] === '\n') ligne++; i++; } i++; continue; }
    const dollar = txt.slice(i).match(/^\$([a-zA-Z_]*)\$/);
    if (dollar) {
      const marque = dollar[0];
      const fin = txt.indexOf(marque, i + marque.length);
      const corps = txt.slice(i, fin === -1 ? txt.length : fin + marque.length);
      ligne += (corps.match(/\n/g) || []).length;
      i = fin === -1 ? txt.length : fin + marque.length;
      continue;
    }
    if (c === ';') { out.push({ sql: txt.slice(debut, i), ligne: ligneDebut }); i++; debut = i; ligneDebut = ligne; continue; }
    i++;
  }
  if (txt.slice(debut).trim()) out.push({ sql: txt.slice(debut), ligne: ligneDebut });
  return out;
}

/* Retire commentaires et corps dollar pour l'analyse d'une instruction. */
/* L'ORDRE DE CES QUATRE REMPLACEMENTS N'EST PAS INDIFFERENT, et c'est le premier
   piege que ce banc s'est tendu a lui-meme. Les blocs de commentaire du depot se
   ferment sur une ligne de tirets suivie de la fermeture de bloc. Si on retire
   les lignes `--` EN PREMIER, cette ligne part en entier, la fermeture du bloc
   avec elle, le bloc ne se ferme plus, et le `create table` qui suit disparait dans un
   commentaire qui ne s'arrete jamais. Le banc annoncait alors « 0 table declaree »
   sur un fichier qui en cree une, puis accusait le depot de ne pas la creer.
   Les blocs se retirent donc AVANT les lignes. */
function nu(sql) {
  return sql.replace(/\$([a-zA-Z_]*)\$[\s\S]*?\$\1\$/g, ' CORPS ')
            .replace(/\/\*[\s\S]*?\*\//g, ' ')
            .replace(/--[^\n]*/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
}

const court = n => n.replace(/^public\./, '').replace(/"/g, '').toLowerCase();

/* --------------------------------------------------------------------------- */
const relations = new Map();      // table ou vue -> Set de colonnes
const fonctions = new Set();
console.log('ordre de rejeu : ' + ORDRE.length + ' fichier(s)\n');

for (const fichier of ORDRE) {
  const chemin = path.join(SQL, fichier);
  if (!fs.existsSync(chemin)) { ko(fichier, 0, 'fichier absent : il est dans ORDRE mais pas dans supabase/'); continue; }
  const txt = fs.readFileSync(chemin, 'utf8');
  let vues = 0, tables = 0, fns = 0, verifs = 0;

  for (const { sql, ligne } of instructions(txt)) {
    const s = nu(sql);
    if (!s) continue;
    const bas = s.toLowerCase();

    /* ---- DECLARATIONS ---- */
    let m;
    if ((m = bas.match(/^create table (?:if not exists )?([a-z0-9_."]+) ?\(/))) {
      const nom = court(m[1]);
      const cols = new Set(relations.get(nom) || []);
      /* Les noms de colonnes sont les premiers mots de chaque ligne du corps. */
      const corps = s.slice(s.indexOf('(') + 1);
      for (const mot of corps.matchAll(/(?:^|,)\s*([a-z_][a-z0-9_]*)\s+(?!key\b|\()/gi)) {
        const c = mot[1].toLowerCase();
        if (!['primary', 'foreign', 'unique', 'constraint', 'check', 'references', 'on', 'not', 'default'].includes(c)) cols.add(c);
      }
      relations.set(nom, cols); tables++; continue;
    }
    if ((m = bas.match(/^alter table (?:if exists )?(?:only )?([a-z0-9_."]+) /))) {
      const nom = court(m[1]);
      const cols = relations.get(nom);
      if (!cols) { ko(fichier, ligne, `alter table sur « ${nom} », qui n'est cree nulle part avant`); continue; }
      for (const a of s.matchAll(/add column (?:if not exists )?([a-z_][a-z0-9_]*)/gi)) cols.add(a[1].toLowerCase());
      for (const d of s.matchAll(/drop column (?:if exists )?([a-z_][a-z0-9_]*)/gi)) cols.delete(d[1].toLowerCase());
      continue;
    }
    if ((m = bas.match(/^create (?:or replace )?(?:materialized )?view ([a-z0-9_."]+)/))) {
      const nom = court(m[1]);
      /* Les colonnes d'une vue : on ne les resout pas, on note qu'elle existe. */
      if (!relations.has(nom)) relations.set(nom, new Set());
      vues++;
      /* mais on VERIFIE ce que son corps lit, voir plus bas */
    }
    if ((m = bas.match(/^create (?:or replace )?function ([a-z0-9_."]+) ?\(/))) {
      fonctions.add(court(m[1])); fns++;
    }
    if ((m = bas.match(/^drop function (?:if exists )?([a-z0-9_."]+)/))) { /* tolere */ }

    /* LE DDL QUI NE SE LIT PAS. `basculer_vers_bureau` change la forme de six
       tables par `execute format('alter table public.%I ...')`. Aucun analyseur
       statique ne peut deviner ca : le nom de la table n'existe qu'au moment de
       l'appel. On lui apprend donc l'effet, tel qu'il est ecrit dans la fonction :
       elle ajoute `bureau` et `cree_par`, et elle retire `id`.
       Le jour ou cette fonction change, cette ligne doit changer avec elle. Sans
       elle, le banc criait sur `r.bureau` et `t.bureau`, colonnes bien reelles. */
    if ((m = bas.match(/^select (?:public\.)?basculer_vers_bureau\s*\(\s*'([a-z0-9_]+)'/))) {
      const cols = relations.get(court(m[1]));
      if (cols) { cols.add('bureau'); cols.add('cree_par'); cols.delete('id'); }
      else ko(fichier, ligne, `bascule de « ${m[1]} », qui n'est creee nulle part avant`);
      continue;
    }

    /* ---- REFERENCES A VERIFIER ---- */

    /* 1. grant/revoke nommant des COLONNES : « grant update (a, b) on public.T » */
    if ((m = s.match(/^(?:grant|revoke)\s+[a-z, ]*\(([^)]*)\)\s+on\s+([a-z0-9_."]+)/i))) {
      const nom = court(m[2]); const cols = relations.get(nom); verifs++;
      if (!cols) ko(fichier, ligne, `droit sur « ${nom} », qui n'est cree nulle part avant`);
      else for (const c of m[1].split(',').map(x => x.trim().toLowerCase()).filter(Boolean))
        if (!cols.has(c)) ko(fichier, ligne, `droit sur la colonne « ${nom}.${c} », qui n'est declaree nulle part avant`);
    }

    /* 2. grant/revoke sur une FONCTION */
    for (const f of s.matchAll(/\bon function\s+([a-z0-9_."]+)\s*\(/gi)) {
      const nom = court(f[1]); verifs++;
      if (!fonctions.has(nom) && !FOURNI_PAR_SUPABASE.has(nom))
        ko(fichier, ligne, `droit sur la fonction « ${nom}() », qui n'est definie nulle part avant`);
    }

    /* 3. grant/revoke sur une TABLE ou une VUE, sans colonnes nommees */
    if (!/\(/.test(s.split(/\bon\b/i)[0] || '') && (m = s.match(/^(?:grant|revoke)\s+(?!.*\bon function\b)[a-z, ]+?\s+on\s+(?:table\s+)?([a-z0-9_."]+)\s+(?:to|from)\b/i))) {
      const nom = court(m[1]); verifs++;
      if (!relations.has(nom)) ko(fichier, ligne, `droit sur « ${nom} », qui n'est cree nulle part avant`);
    }

    /* 4. Un corps de VUE qui lit une colonne d'une table, par son alias.
          On resout « from public.T x » et « join public.T y », puis on exige
          que chaque « x.col » soit une colonne connue de T. C'est cette regle
          qui a attrape `p.jeton_emails` dans v_courrier. */
    if (/^create (or replace )?(materialized )?view /i.test(s)) {
      const alias = new Map();
      for (const a of s.matchAll(/\b(?:from|join)\s+(public\.[a-z0-9_]+)(?:\s+(?:as\s+)?([a-z][a-z0-9_]*))?/gi)) {
        const t = court(a[1]);
        const al = (a[2] || '').toLowerCase();
        if (al && !['on', 'where', 'left', 'right', 'inner', 'full', 'cross', 'join', 'group', 'order', 'union', 'using', 'select'].includes(al)) alias.set(al, t);
        alias.set(t, t);
      }
      for (const u of s.matchAll(/\b([a-z][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/gi)) {
        const al = u[1].toLowerCase(), col = u[2].toLowerCase();
        const t = alias.get(al); if (!t) continue;
        const cols = relations.get(t); if (!cols || cols.size === 0) continue;
        verifs++;
        if (!cols.has(col)) ko(fichier, ligne, `la vue lit « ${al}.${col} » sur ${t}, colonne declaree nulle part avant`);
      }
    }
  }
  console.log(`  ${fichier}`);
  console.log(`      ${tables} table(s), ${vues} vue(s), ${fns} fonction(s) declarees, ${verifs} reference(s) verifiee(s)`);
}

console.log('\n== VERDICT ==');
console.log(`  relations connues : ${relations.size}   fonctions connues : ${fonctions.size}`);
if (ERR === 0) { console.log('  echecs : 0\n  REJOUABLE : chaque objet nomme existe avant d\'etre nomme.\n'); process.exit(0); }
console.log(`  echecs : ${ERR}\n  NON REJOUABLE : sur une base neuve, ce SQL s'arrete a la premiere ligne ci-dessus.\n`);
process.exit(1);
