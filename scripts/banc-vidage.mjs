/* ============================================================================
   scripts/banc-vidage.mjs : vider sa base ne peut plus mentir.

     node scripts/banc-vidage.mjs

   Ne modifie rien, ne touche aucune base. Sortie 0 seulement si les quatre
   promesses tiennent.

   L'INCIDENT DU 18/09/2026, ET IL A COUTE UNE BASE.
   Ted vide sa base pour en remettre une autre. Le navigateur vide sa copie
   locale, il voit un bureau vide, il importe le nouvel export. Mesure le soir
   meme sur son compte : 176 779 lignes, soit 171 569 ANCIENNES toujours la plus
   5 210 nouvelles. Deux bases melangees, et pas un message pour le dire.

   CE QUI L'A PERMIS, en trois pieces qui se tenaient la main :
     1. `vider_la_base_du_bureau` rendait `void`. Rien a verifier.
     2. `effacerTout()` avalait toute exception et rendait `false`.
     3. `viderBase()` ne regardait pas ce retour et vidait le local quand meme.

   Chacune prise seule est un petit relachement. Les trois ensemble font un
   bouton qui efface ce que le vigneron voit et laisse ce qu'il ne voit pas.

   CE QUE CE BANC EXIGE, ET IL LIT LE CODE PLUTOT QUE DE LE RECOPIER :
     1. `effacerTout()` rend `null` des que le vidage n'est pas prouve ;
     2. `viderBase()` s'ARRETE si le serveur n'a pas vide, sans toucher au local ;
     3. le texte de confirmation nomme ce qui part ET dit que Vitisoft ne
        rattrape rien ;
     4. une base vide n'affiche pas un classement qu'on ne peut pas regler.
   ============================================================================ */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');

let ERR = 0;
const ok = m => console.log('  ok    : ' + m);
const ko = m => { ERR++; console.log('  ECHEC : ' + m); };

const sync     = lire('src/js/bdv-sync.js');
const base     = lire('src/js/bdv-base.js');
const reglages = lire('src/js/bdv-reglages.js');
const sql      = lire('supabase/lot28-vider-sans-doute.sql');

/* --------------------------------------------------------------------------
   1. LE SERVEUR REND UNE PREUVE, ET IL LEVE S'IL N'A PAS FINI
   -------------------------------------------------------------------------- */
console.log('\n== 1. Le serveur ==');
if (/returns\s+jsonb/i.test(sql) && /vider_la_base_du_bureau/.test(sql))
  ok('vider_la_base_du_bureau rend du jsonb, pas void : il y a quelque chose a verifier');
else ko('la fonction ne rend rien de verifiable');

if (/select count\(\*\) into reste[\s\S]{0,400}?raise exception/i.test(sql))
  ok('elle relit ce qui reste et LEVE si ce n\'est pas zero');
else ko('elle ne verifie pas son propre travail : un vidage partiel passerait pour un succes');

if (/delete from public\.ventes_lignes/.test(sql))
  ok('la table etroite est nettoyee explicitement, pas seulement par le declencheur');
else ko('la table etroite n\'est nettoyee que par le declencheur : une ligne qui lui echappe reste');

/* --------------------------------------------------------------------------
   2. effacerTout() REND null DES QUE CE N'EST PAS PROUVE
   -------------------------------------------------------------------------- */
console.log('\n== 2. effacerTout() ==');
const fn = sync.match(/async function effacerTout\(\)\{[\s\S]*?\n  \}/);
if (!fn) { ko('effacerTout() introuvable'); }
else {
  const c = fn[0];
  if (/return null/.test(c) && !/return false/.test(c))
    ok('elle rend null quand le vidage n\'est pas prouve, jamais un booleen qui se lit de travers');
  else ko('elle rend encore un booleen : false et « pas vide » se confondent');

  if (/r\.vide\s*!==\s*true/.test(c))
    ok('elle exige `vide: true` du serveur avant de rendre quoi que ce soit');
  else ko('elle ne verifie pas le drapeau `vide` du serveur');

  if (/catch\(e\)\{ return null; \}/.test(c) || /catch\s*\([^)]*\)\s*\{\s*return null;?\s*\}/.test(c))
    ok('une exception devient null, et pas un silence');
  else ko('une exception est encore avalee sans rien dire a l\'appelant');
}

/* Et on la fait tourner, sur les quatre reponses possibles d'un serveur. */
const cas = [
  ['le serveur rend {vide:true}',        { vide: true, ventes: 10 }, true ],
  ['le serveur rend {vide:false}',       { vide: false },            false],
  ['le serveur rend null',               null,                       false],
  ['le serveur leve (droits, reseau)',   'LEVE',                     false],
];
let joues = 0;
for (const [nom, reponse, attenduOk] of cas) {
  const corps = fn ? fn[0] : '';
  const f = new Function('BdvCompte', 'pret', 'oublierRepere',
    corps + '\nreturn effacerTout();');
  const faux = {
    monBureau: () => 'b',
    api: async () => { if (reponse === 'LEVE') throw new Error('refus'); return reponse; }
  };
  let oubli = false;
  const r = await f(faux, () => true, () => { oubli = true; });
  const reussi = (r !== null && r !== undefined && r !== false);
  joues++;
  if (reussi === attenduOk) ok('  ' + nom + ' -> ' + (attenduOk ? 'preuve rendue' : 'null'));
  else ko('  ' + nom + ' -> ' + JSON.stringify(r) + ', attendu ' + (attenduOk ? 'une preuve' : 'null'));
  if (!attenduOk && oubli) ko('  ' + nom + ' : le repere a ete oublie alors que rien n\'a ete vide');
}
if (joues === 4) ok('les quatre reponses possibles du serveur ont ete jouees');

/* --------------------------------------------------------------------------
   3. viderBase() N'AVANCE PAS SANS LA PREUVE
   -------------------------------------------------------------------------- */
console.log('\n== 3. viderBase() ==');
const vb = base.match(/async function viderBase\(\)\{[\s\S]*?\n\}/);
if (!vb) { ko('viderBase() introuvable'); }
else {
  const c = vb[0];
  const iPreuve = c.search(/const preuve\s*=\s*await BdvSync\.effacerTout\(\)/);
  const iArret  = c.search(/if\(!preuve\)/);
  const iLocal  = c.search(/await dbClear\(\)/);
  if (iPreuve >= 0 && iArret > iPreuve && iLocal > iArret)
    ok('l\'ordre est : demander la preuve, s\'arreter sans elle, et seulement apres vider le local');
  else ko('le local peut encore etre vide sans preuve que le compte l\'a ete');

  if (/if\(!preuve\)\{[\s\S]{0,400}?return;/.test(c))
    ok('sans preuve, la fonction RETOURNE : rien n\'est touche nulle part');
  else ko('sans preuve, la fonction continue');

  if (/status\('error'[\s\S]{0,300}?(PAS été vidé|pas été vidé)/.test(c))
    ok('et elle le DIT, au lieu d\'annoncer un succes');
  else ko('un vidage rate ne produit pas de message d\'erreur');
}

/* --------------------------------------------------------------------------
   4. LE TEXTE DIT CE QU'ON PERD, ET QUE VITISOFT NE RATTRAPE RIEN
   -------------------------------------------------------------------------- */
console.log('\n== 4. Ce que le vigneron lit avant de cliquer ==');
/* LE TEXTE EST ASSEMBLE, PAS ECRIT D'UN BLOC : la liste de ce qui part se construit
   dans `quoi` quelques lignes au-dessus du `confirm`, parce qu'elle porte des chiffres.
   On lit donc TOUT le debut de viderBase() jusqu'au confirm, et pas le seul appel.
   Premiere version de ce banc : elle cherchait dans le seul `confirm(...)` et criait sur
   un texte parfaitement correct. Un banc qui regarde au mauvais endroit accuse le code. */
const conf = vb ? vb[0].match(/[\s\S]*?\)\)\s*return;/) : null;
if (!conf) { ko('le texte de confirmation n\'a pas la forme attendue'); }
else {
  const t = conf[0];
  const doit = [
    [/VITISOFT/i,                      'il nomme Vitisoft'],
    [/ligne\(s\) de vente/,            'il chiffre les lignes de vente qui partent'],
    [/suivi client/i,                  'il nomme les fiches de suivi'],
    [/échange|echange/i,               'il nomme les echanges'],
    [/ne se\s+.{0,20}récupèrent nulle part|récupèrent nulle part/i, 'il dit que ca ne se recupere nulle part'],
  ];
  doit.forEach(([re, quoi]) => re.test(t) ? ok(quoi) : ko('le texte ne dit pas : ' + quoi));
  if (/autres personnes de ton bureau/.test(t))
    ok('il previent que les autres membres du bureau perdent la meme chose');
  else ko('il ne dit pas que le vidage porte aussi pour les autres membres');
}

/* --------------------------------------------------------------------------
   5. UNE BASE VIDE N'AFFICHE PAS UN REGLAGE INUTILISABLE
   -------------------------------------------------------------------------- */
console.log('\n== 5. Le panneau sur une base vide ==');
if (/function gateBaseVide\(\)/.test(reglages))
  ok('un garde-fou dedie existe');
else ko('rien n\'ecarte le classement sur une base vide');

if (/gateBaseVide\(\);/.test(reglages.match(/function rafraichirTout\(\)\{[\s\S]*?\n  \}/)?.[0] || ''))
  ok('il tourne a chaque rafraichissement du panneau');
else ko('il existe mais personne ne l\'appelle');

const gbv = reglages.match(/function gateBaseVide\(\)\{[\s\S]*?\n  \}/);
if (gbv && /bdvrBlocClassement[\s\S]{0,400}?setAttribute\('data-off'/.test(gbv[0]))
  ok('« Le classement » est ecarte tant qu\'il n\'y a rien a classer');
else ko('« Le classement » reste propose sur une base vide');

if (gbv && /bdvrBlocBase[\s\S]{0,120}?montrerOnglet/.test(gbv[0]))
  ok('et le panneau s\'ouvre sur « Ma base », la ou se depose l\'export');
else ko('le panneau n\'ouvre pas sur la zone de depot');

if (gbv && /data-off-vide/.test(gbv[0]))
  ok('la marque est distincte de celle de gateVitisoft : les deux gardes ne se defont pas');
else ko('les deux gardes ecrivent le meme attribut et finiront par se contredire');

console.log('\n== VERDICT ==');
if (ERR === 0) { console.log('  echecs : 0\n  TENU : le bouton refuse plutot que de mentir.\n'); process.exit(0); }
console.log('  echecs : ' + ERR + '\n  NON TENU\n');
process.exit(1);
