/* ============================================================================
   scripts/banc-programmes.mjs : la fonction qui fait partir les mails programmes (lot 84)
   ----------------------------------------------------------------------------
   Pas de Deno dans le banc : on LIT les sources. Ce qui est garde :
   1. `_shared/smtp.ts` recopie `ipPrivee`, `adressePublique`, `expediteur` et `pieceLogo` (lot 79) de
      `functions/boite/index.ts` A L'OCTET PRES (deux copies qui divergent, c'est une boite
      qu'on verifie d'une facon et qu'on utilise d'une autre) ;
   2. `mails-programmes` ferme sa porte par la cle NOTIF_CLE, avant toute lecture ;
   3. elle ne decide de rien : la base PREND les mails (`mails_a_partir`) et range le
      resultat (`mail_resultat`) ; un mail « incertain » n'est jamais renvoye ;
   4. elle ne renvoie jamais au navigateur ni au journal le message du serveur de mail.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');
let OK = 0, KO = 0;
const t = (nom, v, d) => { if (v) { OK++; console.log('  ok    : ' + nom); } else { KO++; console.log('  ECHEC : ' + nom + (d !== undefined ? '  →  ' + d : '')); } };

const BOITE = lire('supabase/functions/boite/index.ts');
const SMTP = lire('supabase/functions/_shared/smtp.ts');
const FN = lire('supabase/functions/mails-programmes/index.ts');
const SQL = lire('supabase/lot84-echanges-mails-programmes.sql');

/* Le corps d'une fonction, de sa declaration a l'accolade qui la ferme. */
function corps(src, nom) {
  const re = new RegExp('(?:async\\s+)?function\\s+' + nom + '\\s*\\(');
  const m = re.exec(src); if (!m) return null;
  /* On saute la liste des parametres (un type `{ ... }` y vit) avant de chercher le corps. */
  let p = m.index + m[0].length - 1, q = 0;
  for (; p < src.length; p++) { if (src[p] === '(') q++; else if (src[p] === ')' && --q === 0) break; }
  let i = src.indexOf('{', p), n = 0;
  for (let j = i; j < src.length; j++) { if (src[j] === '{') n++; else if (src[j] === '}' && --n === 0) return src.slice(m.index, j + 1); }
  return null;
}
console.log('\n== 1. Les copies de la fonction boite ==');
for (const nom of ['ipPrivee', 'adressePublique', 'expediteur', 'pieceLogo']) {
  const a = corps(BOITE, nom), b = corps(SMTP, nom);
  t(nom + ' existe des deux cotes', !!a && !!b);
  t(nom + ' est recopiee a l\'octet pres', a === b);
}
t('smtp.ts ne se connecte qu\'en 465 chiffre', /port:\s*465,\s*secure:\s*true/.test(SMTP));
t('smtp.ts verifie la connexion AVANT d\'envoyer', SMTP.indexOf('tr.verify()') > 0 && SMTP.indexOf('tr.verify()') < SMTP.indexOf('tr.sendMail('));
t('smtp.ts joint le logo a l\'envoi (lot 79)', /text: texte, \.\.\.pieceLogo\(b, texte\)/.test(SMTP));
t('boite joint le logo a l\'envoi (lot 79)', /text: corpsTexte, \.\.\.pieceLogo\(b, corpsTexte\)/.test(BOITE));
t('une coupure pendant l\'envoi rend « incertain »', /ESOCKET[\s\S]{0,120}incertain/.test(SMTP));

console.log('\n== 2. La porte ==');
const iCle = FN.indexOf("req.headers.get('x-notif-cle') !== CLE"), iLire = FN.indexOf("rpc('mails_a_partir'");
t('la cle NOTIF_CLE est verifiee', iCle > 0 && /CLE\.length < 32/.test(FN));
t('et AVANT de prendre le moindre mail', iCle > 0 && iLire > iCle);
t('seul POST passe', /req\.method !== 'POST'/.test(FN));

console.log('\n== 3. La base decide ==');
t('les mails sont pris par la base (mails_a_partir)', iLire > 0);
t('le resultat est range par la base (mail_resultat)', /rpc\('mail_resultat'/.test(FN));
t('la boite et le plafond sont lus en base, pour celui qui a programme', /rpc\('boite_pour_envoi', \{ p_personne: m\.personne/.test(FN) && /rpc\('boite_envoi_permis'/.test(FN));
t('le plafond est demande AVANT l\'envoi', FN.indexOf("rpc('boite_envoi_permis'") < FN.indexOf('envoyerSmtp(b,'));
t('un « incertain » est range comme tel, jamais comme un echec a reprendre', /issue === 'incertain' \? 'incertain'/.test(FN));
t('la fonction ne renvoie aucun mail elle-meme (pas de boucle de reprise)', !/for\s*\(\s*let\s+essai|retry|while\s*\(/.test(FN));
t('les mails partent un par un', /for \(const m of l\)/.test(FN) && !/Promise\.all/.test(FN));
t('un mot de passe refuse fait rebrancher la boite', /issue === 'refus'[\s\S]{0,120}boite_reconnecter/.test(FN));

console.log('\n== 4. Rien du serveur de mail ne sort ==');
t('le motif d\'echec vient d\'une liste de mots, pas du serveur', /MOTS\[issue\]/.test(FN) && !/p_echec:[^\n]*\.message/.test(FN));
t('la reponse ne porte que des compteurs', /const rapport = \{ pris: l\.length, partis: 0, echecs: 0, incertains: 0 \}/.test(FN) && /return reponse\(rapport\)/.test(FN));

console.log('\n== 5. Le SQL et la fonction disent la meme chose ==');
t('le SQL cree mails_a_partir et mail_resultat', /function public\.mails_a_partir/.test(SQL) && /function public\.mail_resultat/.test(SQL));
t('les deux ne sont executables que par le role de service', /revoke all on function public\.mails_a_partir[^;]*from public, anon, authenticated/.test(SQL)
  && /revoke all on function public\.mail_resultat[^;]*from public, anon, authenticated/.test(SQL));
t('la tache cron appelle /mails-programmes avec la cle', /mails-programmes/.test(SQL) && /x-notif-cle/.test(SQL));

console.log('\n== VERDICT ==');
console.log('  ' + OK + ' controle(s) passe(s), ' + KO + ' echec(s)');
console.log(KO ? '  LES MAILS PROGRAMMES NE SONT PAS TENUS' : '  LES MAILS PROGRAMMES SONT TENUS');
process.exit(KO ? 1 : 0);
