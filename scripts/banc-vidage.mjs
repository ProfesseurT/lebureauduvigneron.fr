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
/* LE LOT 30 REMPLACE LA FONCTION DU LOT 28, il ne la complete pas : c'est lui qui est
   servi. Les deux fichiers restent lus, le 28 parce qu'il porte l'incident du 18/09/2026
   et que sa forme ne doit pas revenir, le 30 parce que c'est la version en base. */
const sql30    = lire('supabase/lot30-vider-la-preuve-complete.sql');

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

/* LA PREUVE COUVRE LES CINQ TABLES, 23/09/2026. Le lot 28 vidait cinq tables et n'en
   recomptait qu'une : il ne pouvait pas lever sur un suivi client reste entier, c'est-a-dire
   sur la seule chose que le vigneron ne peut PAS reimporter. Le controle est ecrit en
   NEGATIF : on refuse qu'une table videe ne soit pas relue, pas une liste du jour. */
{
  const videes = (sql30.match(/delete from public\.(\w+)\s+where bureau = b/g) || [])
    .map(l => l.match(/public\.(\w+)/)[1]);
  const relues = (sql30.match(/select count\(\*\) into \w+\s+from public\.(\w+)\s+where bureau = b/g) || [])
    .map(l => l.match(/from public\.(\w+)/)[1]);
  const oubliees = videes.filter(t => relues.indexOf(t) < 0);
  if (videes.length && !oubliees.length)
    ok('les ' + videes.length + ' tables videes sont toutes relues avant de conclure');
  else ko('videe(s) sans etre relue(s) : ' + (oubliees.join(', ') || 'aucune table videe trouvee')
        + ' — la fonction ne peut pas lever sur un vidage partiel de ces tables-la');
  if (/raise exception[\s\S]{0,120}?manque/i.test(sql30))
    ok('et l\'erreur NOMME la table qui resiste, au lieu d\'un « ca n\'a pas abouti » a chercher');
  else ko('l\'erreur ne nomme pas la table qui resiste');
  /* `reste` ne doit pas changer de sens sous le meme nom : deux formes, deux noms. */
  /* LA VIRGULE DE FIN N'EST PAS DU ZELE : sans elle, la mutation « reste devient
     r_ventes + r_lignes » passait le controle au vert. Verifie en la remettant. */
  if (/'reste',\s*r_ventes\s*,/.test(sql30) && /'reste_total'/.test(sql30))
    ok('« reste » garde son sens d\'avant, le total des cinq tables a un nom a lui');
  else ko('« reste » a change de sens sous le meme nom');
}

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
  /* LE `const` A SAUTE LE 23/09/2026 : `preuve` est declaree avant le try, parce que le
     bilan de fin la relit pour chiffrer ce qui est parti. On demande donc l'AFFECTATION,
     pas la declaration : un banc qui fige une tournure interdit de l'ameliorer. */
  const iPreuve = c.search(/preuve\s*=\s*await BdvSync\.effacerTout\(\)/);
  const iArret  = c.search(/if\(!preuve\)/);
  const iLocal  = c.search(/await dbClear\(\)/);
  if (iPreuve >= 0 && iArret > iPreuve && iLocal > iArret)
    ok('l\'ordre est : demander la preuve, s\'arreter sans elle, et seulement apres vider le local');
  else ko('le local peut encore etre vide sans preuve que le compte l\'a ete');

  if (/if\(!preuve\)\{[\s\S]{0,400}?return;/.test(c))
    ok('sans preuve, la fonction RETOURNE : rien n\'est touche nulle part');
  else ko('sans preuve, la fonction continue');

  /* LE MESSAGE A CHANGE DE CANAL LE 23/09/2026, PAS DE SENS. `status()` efface un bandeau
     au bout de quelques secondes et passe SOUS le voile de vidage : le refus part par
     `vidageFin()`, qui reste a l'ecran jusqu'a ce que le vigneron ferme. Le texte, lui,
     n'a pas bouge d'un mot. */
  if (/vidageFin\([\s\S]{0,300}?(PAS été vidé|pas été vidé)/.test(c))
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
    /* LE BANC SUIVAIT LA FORME, PAS LE SENS, 19/09/2026. Il exigeait le littéral
       « ligne(s) de vente ». Le texte passe maintenant par plur(), qui écrit « 286
       lignes de vente » ou « 1 ligne de vente » : mieux dit, et le banc criait dessus.
       On demande donc ce qui compte vraiment : un NOMBRE, collé au mot, quelle que
       soit la forme du pluriel. Un banc qui fige une tournure interdit de l'améliorer. */
    [/\d[\s\u00a0\d]*ligne(s|\(s\))? de vente/, 'il chiffre les lignes de vente qui partent'],
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


/* --------------------------------------------------------------------------
   6. LE GESTE DIT QU'IL TRAVAILLE, ET IL NE S'ARRETE QUE SUR UNE PREUVE
   --------------------------------------------------------------------------
   Ajoutee le 23/09/2026, apres l'audit demande par Ted : « il faut forcement que
   l'interface montre une animation tant que ca travaille, meme dans les reglages,
   et une verification pour que l'animation s'arrete. »

   ECRITE EN NEGATIF. Elle ne decrit pas le voile qu'on vient d'ecrire, elle REFUSE
   les etats dans lesquels un vidage peut laisser le vigneron : un voile pose trop
   tard, un chemin de sortie qui le laisse tourner, un succes annonce sans preuve,
   un « je ne sais pas » pris pour un zero. Un banc qui recopie le code du jour ne
   garde que le code du jour.

   CE QU'ELLE NE PEUT PAS FAIRE, et il faut le savoir : elle ne prouve pas qu'un
   voile se VOIT. Elle lit du source et joue une fonction. Que le voile couvre le
   panneau de reglages, que son texte se lise dans les deux themes, cela se regarde
   sur une image, jamais ici.
   -------------------------------------------------------------------------- */
console.log('\n== 6. Le vidage se voit, et il ne s\'arrete que sur une preuve ==');
if (!vb) { ko('viderBase() introuvable, rien de la section 6 n\'a ete verifie'); }
else {
  const c = vb[0];

  /* 1. Le voile est pose AVANT la premiere ecriture, sinon il ne montre rien de ce
        qui compte : l'appel serveur est la plus longue des trois etapes. */
  const iVoile = c.search(/vidageMonter\(\)/);
  const iEff   = c.search(/await BdvSync\.effacerTout\(\)/);
  if (iVoile >= 0 && iEff > iVoile) ok('le voile est pose AVANT la premiere ecriture');
  else ko('le voile est pose apres avoir commence a effacer : la partie la plus longue ne montre rien');

  /* 2. Un seul point de sortie. Six chemins quittent cette fonction, dont deux qu'on
        n'ecrit pas (un jet de capPerimer, de computeMeta ou d'ecranRafraichir). */
  if (/\}finally\{|\} finally \{|\}\s*finally\s*\{/.test(c))
    ok('tout le travail est dans un try/finally : aucun chemin ne sort sans passer par la sortie');
  else ko('il n\'y a pas de finally : un jet inattendu laisse l\'animation tourner pour toujours');

  const fin = c.match(/finally\s*\{[\s\S]*$/);
  const cf  = fin ? fin[0] : '';

  /* 3 et 4. Le drapeau de re-entree : pose avant le premier await, rendu dans la sortie. */
  const iGarde = c.search(/if\(VIDAGE_EN_COURS\)\s*return;/);
  const iPose  = c.search(/VIDAGE_EN_COURS\s*=\s*true/);
  if (iGarde === 0 || (iGarde > 0 && iGarde < c.search(/await /)))
    ok('le garde de re-entree est en tete, avant le premier await');
  else ko('deux clics lancent deux vidages : le second annonce un succes sur quatre zeros');
  if (iPose > 0 && /VIDAGE_EN_COURS\s*=\s*false/.test(cf))
    ok('et le drapeau est RENDU dans la sortie, pas au fil des chemins');
  else ko('le drapeau reste leve sur un chemin : le bouton ne se rallume jamais');

  /* 5. Le panneau entier est neutralise, et rendu. Ce qui est dangereux n'est pas le
        bouton, c'est la zone de depot d'export de la carte d'a cote. */
  if (/vidagePanneau\(true\)/.test(c) && /vidagePanneau\(false\)/.test(cf))
    ok('le panneau est neutralise pendant le travail et rendu dans la sortie');
  else ko('le panneau reste utilisable : un export depose pendant le vidage melange deux bases');

  /* 6. dbClear a un filet, et l'echec local se DIT. C'est le pire etat du geste :
        compte vide, appareil plein, et pas un mot. */
  if (/try\{\s*\n?\s*await dbClear\(\);\s*\n?\s*\}catch/.test(c))
    ok('await dbClear() est sous un try : un echec local ne part plus en rejet silencieux');
  else ko('dbClear() n\'a pas de filet : le compte se vide, l\'appareil garde tout, et rien ne le dit');
  if (/catch\(e\)\{[\s\S]{0,600}?vidageFin\([\s\S]{0,200}?cet appareil ne l'est pas/.test(c))
    ok('et il NOMME les deux moities : laquelle est partie, laquelle ne l\'est pas');
  else ko('l\'echec local ne dit pas lequel des deux cotes a ete vide');

  /* 7. Le succes n'est pas atteignable sans la verification. */
  const iVerif = c.search(/await vidageVerifier\(\)/);
  const iSucces = c.search(/vidageFin\("C'est fait"/);
  if (iVerif >= 0 && iSucces > iVerif)
    ok('le bilan de succes vient APRES la verification, jamais a la place');
  else ko('un succes peut etre annonce sans que rien n\'ait ete relu');

  /* 8. Et la sortie repose une fin si personne ne l'a fait : c'est la demande de Ted
        prise a la lettre, aucun chemin ne laisse l'animation tourner. */
  if (/aria-busy/.test(cf) && /vidageFin\(/.test(cf))
    ok('la sortie repose une fin si aucun chemin ne l\'a fait : l\'animation ne peut pas rester coincee');
  else ko('un jet inattendu laisse le voile tourner sur un bureau a moitie vide, sans un mot');

  /* 9. Le bilan est chiffre, et les chiffres viennent du serveur. */
  const bilan = base.match(/function vidageBilan\([\s\S]*?\n\}/);
  if (bilan && /preuve\.ventes/.test(bilan[0]) && /preuve\.suivi/.test(bilan[0]) && /preuve\.echanges/.test(bilan[0]))
    ok('le bilan lit les trois compteurs que le serveur rend, au lieu de les jeter');
  else ko('la preuve chiffree du lot 28 est calculee, transmise, et perdue au dernier metre');

  /* 10. Le bouton relit le drapeau, parce que renderBase() le reecrit. */
  const rb = base.match(/function renderBase\(\)\{[\s\S]*?\n\}/);
  if (rb && /VIDAGE_EN_COURS\s*\?\s*' disabled'/.test(rb[0]))
    ok('renderBase() relit le drapeau : le bouton ne se rallume pas tout seul en plein await');
  else ko('un rendu tombe pendant le vidage rallume le bouton');
}

/* --------------------------------------------------------------------------
   6 bis. LA VERIFICATION A TROIS ETATS, ET ON LES JOUE
   --------------------------------------------------------------------------
   Le seul controle de cette section qui EXECUTE. Un « je ne sais pas » pris pour
   un zero, c'est le defaut du 18/09/2026 rejoue : un silence qui passe pour un
   succes. On joue donc les six situations, pas les deux qu'on a en tete.
   -------------------------------------------------------------------------- */
console.log('\n== 6 bis. Les trois etats de la verification ==');
const vv = base.match(/async function vidageVerifier\(\)\{[\s\S]*?\n\}/);
if (!vv) { ko('vidageVerifier() introuvable'); }
else {
  const jouer = (ici, laBas, connecte) => {
    const f = new Function('dbCount', 'syncPret', 'BdvSync',
      vv[0] + '\nreturn vidageVerifier();');
    return f(
      async () => { if (ici === 'leve') throw new Error('base fermee'); return ici; },
      () => connecte,
      { auMoinsUneVente: async () => { if (laBas === 'leve') throw new Error('reseau'); return laBas; } }
    );
  };
  const cas = [
    ['les deux cotes disent zero',              0,      false, true,  'vide'],
    ['hors ligne, l\'appareil dit zero',        0,      null,  false, 'vide'],
    ['le compte ne repond pas',                 0,      null,  true,  'inconnu'],
    ['le compte leve',                          0,      'leve',true,  'inconnu'],
    ['l\'appareil ne repond pas',               'leve', false, true,  'inconnu'],
    ['l\'appareil porte encore des lignes',     5,      false, true,  'reste'],
    ['le compte porte encore des lignes',       0,      true,  true,  'reste']
  ];
  let joues = 0;
  for (const [nom, ici, laBas, connecte, attendu] of cas) {
    let r;
    try { r = await jouer(ici, laBas, connecte); } catch (e) { r = { verdict: 'LEVE ' + e.message }; }
    if (r && r.verdict === attendu) { joues++; ok('  ' + nom + ' -> ' + attendu); }
    else ko('  ' + nom + ' -> ' + (r && r.verdict) + ', attendu ' + attendu);
  }
  if (joues === cas.length) ok('les sept situations ont ete jouees, et un null n\'est jamais devenu un zero');
}

console.log('\n== VERDICT ==');
if (ERR === 0) { console.log('  echecs : 0\n  TENU : le bouton refuse plutot que de mentir.\n'); process.exit(0); }
console.log('  echecs : ' + ERR + '\n  NON TENU\n');
process.exit(1);
