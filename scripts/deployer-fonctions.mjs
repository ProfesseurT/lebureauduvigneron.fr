#!/usr/bin/env node
/* DEPLOYER LES FONCTIONS SERVEUR, 20/09/2026.
   ============================================================================
   POURQUOI CE SCRIPT EXISTE, ET PAS UNE PHRASE DANS UN FICHIER.

   Trois pieges se paient en silence sur ce geste, et deux ont deja ete payes :

   1. `supabase functions deploy` cherche les fonctions dans
      `<dossier>/supabase/functions/<nom>/`. Or chez nous ce dossier ne contient
      QUE `index.ts` : les bibliotheques jointes (`bdv-courrier.js`, `biblio.ts`,
      `bdv-echeances.js`, `bdv-ics.js`) ne vivent que dans `_deploiement/`, et
      c'est `_deploiement/` qui fait foi. Un deploiement depuis la racine part
      donc SANS les bibliotheques que `index.ts` importe. Ce script monte un
      dossier de transit a la bonne forme, a partir de `_deploiement/` et de lui
      seul.

   2. `agenda-ics` DOIT partir avec `--no-verify-jwt`. Sans lui, Supabase exige
      un en-tete Authorization, Google Agenda n'en envoie aucun, et le vigneron
      lit « calendrier introuvable » sans plus de detail. Le 15/09/2026 ce defaut
      a coute une soiree. Le reglage est maintenant une DONNEE de ce script, plus
      une chose a se rappeler.

   3. On ne deploie jamais du code dont l'empreinte n'est pas a jour. Le script
      refuse de partir si `courrier:verif` ou `agenda:verif` echoue : sinon on
      envoie en production un fichier que le depot ne decrit plus.
   ========================================================================== */
import { execFileSync, execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJET = 'qukmncqqwomhmrdhvetj';

/* LE RESERVOIR DE VERITE. Une ligne par fonction : son dossier dans
   `_deploiement/`, et si elle s'ouvre sans jeton. Ajouter une fonction, c'est
   ajouter une ligne ici, pas se souvenir d'un drapeau. */
const FONCTIONS = [
  { nom: 'courrier-matin', sansJeton: false, verif: 'courrier:verif',
    quoi: 'le courrier du matin, envoye par la tache planifiee' },
  { nom: 'agenda-ics',     sansJeton: true,  verif: 'agenda:verif',
    quoi: "le flux d'agenda, lu par Google Agenda sans s'identifier" },
];

const demandees = process.argv.slice(2).filter(a => !a.startsWith('-'));
const pourDeVrai = process.argv.includes('--pour-de-vrai');
const liste = demandees.length
  ? FONCTIONS.filter(f => demandees.includes(f.nom))
  : FONCTIONS;

if (!liste.length) {
  console.error('\n  Fonction inconnue. Celles que je connais : '
    + FONCTIONS.map(f => f.nom).join(', ') + '\n');
  process.exit(1);
}

console.log('\n  DEPLOIEMENT DES FONCTIONS SERVEUR');
console.log('  ' + '='.repeat(60));

/* 1. LES EMPREINTES D'ABORD. */
console.log('\n  1. Les empreintes du depot');
for (const f of liste) {
  try {
    execSync('npm run --silent ' + f.verif, { cwd: RACINE, stdio: 'pipe' });
    console.log('     ok    ' + f.nom + ' : le depot et le dossier a deployer disent la meme chose');
  } catch (e) {
    console.error('\n     ECHEC ' + f.nom + " : l'empreinte n'est pas a jour.");
    console.error('           Lance d\'abord : npm run ' + f.verif.replace(':verif', ':joindre'));
    console.error('           Rien n\'a ete deploye.\n');
    process.exit(1);
  }
}

/* 2. LE DOSSIER DE TRANSIT, a la forme que la CLI attend. */
const TRANSIT = path.join(os.tmpdir(), 'bdv-deploiement');
console.log('\n  2. Le dossier de transit');
rmSync(TRANSIT, { recursive: true, force: true });
const CIBLE = path.join(TRANSIT, 'supabase', 'functions');
mkdirSync(CIBLE, { recursive: true });
for (const f of liste) {
  const src = path.join(RACINE, '_deploiement', f.nom);
  if (!existsSync(src)) {
    console.error('\n     ECHEC : ' + src + " n'existe pas. Rien n'a ete deploye.\n");
    process.exit(1);
  }
  cpSync(src, path.join(CIBLE, f.nom), { recursive: true });
  const n = execSync('ls -1 ' + JSON.stringify(path.join(CIBLE, f.nom)) + ' | wc -l')
    .toString().trim();
  console.log('     ok    ' + f.nom + ' : ' + n + ' fichier(s) copies depuis _deploiement/');
}

/* 3. LE DEPLOIEMENT. */
console.log('\n  3. Le deploiement');
if (!pourDeVrai) {
  console.log('\n     ESSAI A BLANC. Rien ne part. Voici ce qui partirait :\n');
  for (const f of liste) {
    console.log('       ' + f.nom + (f.sansJeton ? '   --no-verify-jwt' : '   (jeton exige, comme aujourd\'hui)'));
    console.log('         ' + f.quoi);
  }
  console.log('\n     Pour le faire pour de vrai : npm run deployer -- --pour-de-vrai\n');
  process.exit(0);
}

for (const f of liste) {
  const args = ['--yes', 'supabase@2.117.0', 'functions', 'deploy', f.nom,
                '--project-ref', PROJET, '--use-api'];
  if (f.sansJeton) args.push('--no-verify-jwt');
  console.log('\n     ' + f.nom + ' ...');
  try {
    execFileSync('npx', args, { cwd: TRANSIT, stdio: 'inherit' });
    console.log('     ok    ' + f.nom + ' est parti.');
  } catch (e) {
    console.error('\n     ECHEC sur ' + f.nom + '.');
    console.error('           Si le message parle de connexion : lance `npx supabase login`,');
    console.error('           puis relance cette commande.');
    console.error('           Les fonctions deja parties avant celle-ci le sont restees.\n');
    process.exit(1);
  }
}

console.log('\n  ' + '='.repeat(60));
console.log('  A VERIFIER MAINTENANT, et pas plus tard :');
if (liste.some(f => f.nom === 'agenda-ics'))
  console.log('    - ouvre ton lien d\'agenda dans le navigateur : il doit rendre un fichier,');
  console.log('      pas une erreur. Une erreur = le --no-verify-jwt n\'est pas passe.');
if (liste.some(f => f.nom === 'courrier-matin'))
  console.log('    - le prochain courrier du matin doit arriver a l\'heure habituelle.');
console.log('');
