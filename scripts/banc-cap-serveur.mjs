/* ============================================================================
   scripts/banc-cap-serveur.mjs : « Mon cap » dit-il LA MEME CHOSE selon qui a
   calcule ?

     npm run banc:cap-serveur

   LOT 24. Depuis ce lot, le bandeau et l'atterrissage de « Mon cap » viennent du
   SERVEUR quand il a repondu (`cap_resume()`), et du navigateur sinon. Deux
   chemins, un seul ecran : c'est exactement la situation ou un outil se met a
   servir deux chiffres differents selon l'heure et le reseau, sans que personne
   ne puisse dire lequel est le bon.

   CE QUE CE BANC PROUVE, ET CE QU'IL NE PROUVE PAS.

     Il prouve que la TRADUCTION est fidele : en donnant au serveur la verite que
     le navigateur vient de calculer, l'ecran doit se peindre a l'identique, au
     caractere pres. Un champ mal nomme, une unite (%) prise pour une autre
     (fraction), un arrondi pose au mauvais endroit, un `bas` et un `haut`
     inverses : tout cela se voit ici.

     Il NE prouve PAS que le SQL calcule les memes nombres que le JS sur la vraie
     base : ca, c'est le travail de la vue `public.v_cap_controle`, qui compare
     champ par champ le depot du navigateur au retour du serveur, et qui doit
     rendre zero ligne. Un banc en jsdom n'a pas de Postgres ; pretendre le
     contraire serait la meme faute de methode que le 344 ms du lot 22.

   LE PIEGE DU HARNAIS, deja paye trois fois : UN SEUL `eval`. Les globales du
   moteur sont declarees en `let` et `const`, qui restent scopees a cet eval.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
const R = path.join(RACINE, 'src/js') + '/';

let ok = 0, ko = 0;
const t = (nom, bon, det) => {
  if (bon) { ok++; console.log('  ok    : ' + nom); }
  else { ko++; console.log('  ECHEC : ' + nom + (det !== undefined ? '  -> ' + det : '')); }
};

const dom = new JSDOM(`<!doctype html><body>
  <div class="filterbar" id="filterbar"></div>
  <section class="panel" id="p-annee"><div id="p-diagnostic"></div></section>
  <div id="status"></div><div id="statusTxt"></div><div id="statusSpin"></div>
  <div id="busyov"></div><div id="busytxt"></div>
</body>`, { runScripts: 'outside-only', url: 'https://x.test/mon-bureau/' });
const w = dom.window;
w.Chart = function(){ this.destroy = () => {}; };
w.Papa = {};

/* DIX-NEUF MOIS, comme banc-cap.mjs : 2025 entier puis 2026 arrete en juillet. Avec
   vingt-quatre l'exercice est clos, l'atterrissage disparait, et la moitie de ce qu'on
   veut comparer n'est plus a l'ecran. */
const lignes = [];
for (let i = 0; i < 19; i++) {
  const y = 2025 + Math.floor(i / 12), m = (i % 12) + 1;
  for (const [fam, canal, pu] of [['Rouge','Caveau',12], ['Blanc','Export',9]]) {
    lignes.push({ famille: fam, couleur: fam, produit: 'Cuvee ' + fam, client: 'Client ' + (i % 5),
      numClient: 'C' + (i % 5), numFacture: 'F' + i + fam, codeTarif: 'T1', millesime: String(y - 1),
      appellation: 'AOC Test', conditionnement: '75cl', cp: '44000', ville: 'Nantes', pays: 'France',
      _y: y, _m: m, _pu: pu, _q: 50 + i * 3, _canal: canal });
  }
}

/* Le decor : on charge la base, on peint une premiere fois EN LOCAL, puis on fabrique
   la reponse du serveur A PARTIR DE CETTE VERITE LOCALE et on repeint. Si la traduction
   est fidele, les deux HTML sont le meme. */
const test = `
  ROWS.length = 0;
  JSON.parse(${JSON.stringify(JSON.stringify(lignes))}).forEach(function(o){
    var ts = Date.UTC(o._y, o._m - 1, 15);
    o._vin = true;
    o._date = { y: o._y, m: o._m, d: 15, t: ts };
    o._dayNum = Math.floor(ts / 86400000);
    o._exY = o._y; o._exM = o._m; o._exPos = o._m - 1;
    o._qte = o._q; o._total = o._pu * o._q;
    ROWS.push(o);
  });
  computeMeta();
  objectif = 400000;

  /* ---- 1. LE LOCAL, seul ---- */
  capPoser(null);
  renderCap();
  var htmlLocal = document.getElementById('p-diagnostic').innerHTML;
  var cadreLocal = capCadre(), attLocal = capAtterrissage();

  /* ---- 2. LA MEME VERITE, mise en forme comme cap_resume() la rend ----
     Les arrondis sont ceux du SQL : round() sur les euros, round(...,1) sur le
     pourcentage. Les poser ici, c'est verifier qu'ils ne cassent rien a l'ecran. */
  var f = yoyFrame(), y = yoyTotals(), a = computeAtterrissage();
  var charge = {
    exercice: String(f.cur), exerciceNum: f.cur, precedentNum: f.prev,
    coupeJour: fmtDate(f.cutDate), coupePos: f.cutPos,
    caCoupe: Math.round(y.cur), caCoupePrecedent: Math.round(y.prev),
    variation: y.d == null ? null : Math.round(y.d * 10) / 10,
    complet: !!a.complete, dernierMois: a.months,
    ca: Math.round(a.done), atterrissage: Math.round(a.central),
    bas: Math.round(a.low), haut: Math.round(a.high), methode: a.method
  };
  capPoser(charge);
  renderCap();
  var htmlServeur = document.getElementById('p-diagnostic').innerHTML;
  var cadreServeur = capCadre(), attServeur = capAtterrissage();

  /* ---- 3. Un serveur muet doit rendre la main au local, pas vider l'ecran ---- */
  capPoser(undefined); var apresMuet = capCadre();
  capPoser({}); var apresVide = capCadre();
  capPoser(null);

  /* ---- 3 bis. LE RESUME A TROUS, 23/09/2026 ----
     Le cas reel, releve sur la base de Ted : le classement n'est pas valide, donc
     v_ventes.est_vente vaut null, donc cap_resume rend un objet COMPLET dont un seul
     champ est renseigne. Un serveur muet, le harnais savait deja le voir ; un serveur
     bavard et vide, non, et c'est celui-la qui a peint 0 euro et null mois connus sous
     un bandeau qui annoncait 72 267 euros. La charge ci-dessous est copiee du retour
     reel, champ pour champ. */
  capPoser({ exercice: '2026/2027', exerciceNum: f.cur, precedentNum: f.prev,
             lignes: 5210, moisDebut: 7, objectif: 164000,
             mois: [0,0,0,0,0,0,0,0,0,0,0,0], moisPrecedent: [0,0,0,0,0,0,0,0,0,0,0,0],
             ca: null, caCoupe: null, caCoupePrecedent: null, dernierMois: null,
             atterrissage: null, bas: null, haut: null, complet: null,
             variation: null, variationEuros: null, coupeJour: null, coupePos: null,
             clients: 0, factures: 0, panier: null, methode: 'lineaire' });
  var cadreTrous = capCadre(), attTrous = capAtterrissage();
  renderCap();
  var htmlTrous = document.getElementById('p-diagnostic').innerHTML;
  capPoser(null);

  window.__S = {
    /* LE PLANCHER SE MESURE DANS LA PAGE, PAS DANS LE HARNAIS, 19/09/2026 : c'est
       le nombre de lignes que le MOTEUR a retenues, pas celui qu'on croit avoir
       pousse. Une ligne ecartee par computeMeta() ne se verrait pas autrement.
       PAS D'ACCENT GRAVE DANS CE BLOC : il vit dans un gabarit de chaine. */
    lignes: ROWS.length,
    htmlLocal: htmlLocal, htmlServeur: htmlServeur,
    cadreLocal: cadreLocal, cadreServeur: cadreServeur,
    attLocal: attLocal, attServeur: attServeur,
    apresMuetLocal: apresMuet && apresMuet.serveur === false,
    apresVideLocal: apresVide && apresVide.serveur === false,
    trousCadreLocal: cadreTrous && cadreTrous.serveur === false,
    trousAttLocal: attTrous && attTrous.serveur === false,
    htmlTrous: htmlTrous,
    aCapRafraichir: typeof capRafraichir === 'function',
    aFenetre: typeof window.bdvCapRafraichir === 'function'
  };
`;

try {
  w.eval(fs.readFileSync(R + 'bdv-base.js', 'utf8') + '\n'
       + fs.readFileSync(R + 'bdv-ecrans.js', 'utf8') + '\n' + test);
} catch (e) {
  console.log('ECHEC a l\'execution : ' + e.message);
  console.log((e.stack || '').split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}
const S = w.__S;

/* ==========================================================================
   0. LE PLANCHER : ON NE COMPARE PAS DEUX RIENS
   ==========================================================================
   Pose le 19/09/2026. Tout ce qui suit compare le calcul local au calcul
   serveur, et TOUT PASSE SUR RIEN : deux panneaux vides sont identiques
   caractere pour caractere, un atterrissage absent des deux cotes a bien les
   memes quatre champs, et le banc annonce trente controles passes sur un ecran
   qui n'a jamais ete peint. Un jsdom qui n'a pas charge bdv-ecrans.js, un
   `computeMeta()` qui ecarte les lignes du decor, un selecteur renomme : trois
   facons ordinaires d'arriver la, aucune ne casse quoi que ce soit.

   Les autres bancs du depot posent deja ce plancher : `banc-app` exige au moins
   deux icones, `banc-outils` au moins deux cartes, `banc-annuel` au moins une
   ligne `unique`. Celui-ci ne l'avait pas.
   ========================================================================== */
console.log('\n== 0. Le plancher : il y a bien quelque chose a comparer ==');
t('la base du decor a ete relue par le moteur (38 lignes attendues)',
  S.lignes === 38, S.lignes + ' ligne(s) dans ROWS');
t('le panneau « Mon cap » a vraiment ete peint, des deux cotes',
  S.htmlLocal.length > 200 && S.htmlServeur.length > 200,
  S.htmlLocal.length + ' / ' + S.htmlServeur.length + ' signes');
t('l\'exercice porte au moins un mois connu : l\'atterrissage a de quoi exister',
  !!S.attLocal && S.attLocal.months > 0, S.attLocal && S.attLocal.months);
t('le cadre de comparaison porte deux exercices, pas deux vides',
  !!S.cadreLocal && S.cadreLocal.cur != null && S.cadreLocal.prev != null,
  S.cadreLocal && (S.cadreLocal.cur + ' / ' + S.cadreLocal.prev));

console.log('\n== 1. Le meme ecran, quelle que soit la source ==');
/* LE CONTROLE CENTRAL. Pas « les nombres se ressemblent » : le PANNEAU ENTIER, au
   caractere pres. C'est le seul niveau ou un champ oublie ne peut pas se cacher. */
if (S.htmlLocal === S.htmlServeur) {
  t('le panneau « Mon cap » est identique, caractere pour caractere', true);
} else {
  const n = Math.min(S.htmlLocal.length, S.htmlServeur.length);
  let i = 0; while (i < n && S.htmlLocal[i] === S.htmlServeur[i]) i++;
  t('le panneau « Mon cap » est identique, caractere pour caractere', false,
    '\n            local   : ...' + S.htmlLocal.slice(Math.max(0, i - 60), i + 60)
    + '\n            serveur : ...' + S.htmlServeur.slice(Math.max(0, i - 60), i + 60));
}
t('le bandeau de comparaison est bien peint dans les deux cas',
  S.htmlLocal.includes('class="hero"') && S.htmlServeur.includes('class="hero"'));
t('et la fourchette d\'atterrissage aussi',
  S.htmlLocal.includes('fourchette') && S.htmlServeur.includes('fourchette'));

console.log('\n== 2. Champ par champ, pour nommer le coupable quand ca casse ==');
const cl = S.cadreLocal, cs = S.cadreServeur;
t('la source est bien declaree de chaque cote', cl.serveur === false && cs.serveur === true);
for (const k of ['cur', 'prev', 'jour']) {
  t('cadre.' + k + ' identique', cl[k] === cs[k], JSON.stringify(cl[k]) + ' / ' + JSON.stringify(cs[k]));
}
/* Les euros passent par un round() cote SQL : on compare a l'euro, pas au centime.
   Le pourcentage, lui, est arrondi au dixieme, qui est justement ce que fmtPct affiche. */
for (const k of ['curW', 'prevW']) {
  t('cadre.' + k + ' identique a l\'euro', Math.abs(cl[k] - cs[k]) < 1, cl[k] + ' / ' + cs[k]);
}
t('cadre.d identique au dixieme de point', Math.abs(cl.d - cs.d) < 0.05, cl.d + ' / ' + cs.d);

const al = S.attLocal, as_ = S.attServeur;
t('atterrissage : meme exercice', al.cur === as_.cur);
t('atterrissage : meme etat (en cours / clos)', al.complete === as_.complete);
t('atterrissage : meme nombre de mois connus', al.months === as_.months, al.months + ' / ' + as_.months);
for (const k of ['done', 'central', 'low', 'high']) {
  t('atterrissage.' + k + ' identique a l\'euro', Math.abs(al[k] - as_[k]) < 1, al[k] + ' / ' + as_[k]);
}
/* LA METHODE EST UN TEXTE AFFICHE, pas une variable interne : la note sous la
   fourchette dit « cale sur la saisonnalite de 2025 » ou « lineaire ». Une note qui
   ment sur sa methode est pire que pas de note. */
t('atterrissage.method identique', al.method === as_.method, al.method + ' / ' + as_.method);

console.log('\n== 3. Un serveur qui tousse ne vide pas l\'ecran ==');
/* La regle de tout le depot. Le calcul local reste le repli, et il doit se
   DECLARER comme tel : `serveur: false` est ce que lit le prochain lot. */
t('pas de reponse du tout : on retombe sur le calcul local', S.apresMuetLocal);
t('reponse vide ou tronquee : on retombe aussi', S.apresVideLocal);

/* UN RESUME A TROUS EST UN RESUME MUET, 23/09/2026. Le garde est pose a la POSE et
   pas a la lecture : les DEUX blocs doivent retomber en local ENSEMBLE, sinon on
   retrouve le demi-ecran du 23/09. Verifie en remettant le defaut : rendre a
   `capPoser` son ancienne forme fait echouer les quatre controles ci-dessous. */
t('resume a trous : le cadre retombe sur le calcul local', S.trousCadreLocal);
t('resume a trous : l\'atterrissage AUSSI, et c\'est tout le sujet', S.trousAttLocal);
t('resume a trous : l\'ecran peint est exactement l\'ecran local',
  S.htmlTrous === S.htmlLocal,
  S.htmlTrous === S.htmlLocal ? '' : 'l\'ecran differe de sa version locale');
t('resume a trous : le mot « null » n\'apparait nulle part a l\'ecran',
  !/\bnull\b/.test(S.htmlTrous),
  (S.htmlTrous.match(/.{0,40}\bnull\b.{0,40}/) || [''])[0]);

console.log('\n== 4. La peremption existe, et elle est atteignable ==');
t('capRafraichir() existe', S.aCapRafraichir);
t('et le moteur peut l\'appeler par window.bdvCapRafraichir', S.aFenetre);

/* ---------------------------------------------------------------------------
   5. LES SIX ENDROITS QUI PERIMENT LE RESUME.

   Ce controle-ci lit le SOURCE, pas l'execution : un resume perime ne se voit pas
   dans un jsdom sans serveur, il se voit le jour ou Ted importe 4 000 lignes et
   ou son chiffre d'affaires ne bouge pas. Le seul filet possible est de verifier
   que chaque geste qui change ce que le serveur calculerait passe bien par la
   peremption.
   --------------------------------------------------------------------------- */
console.log('\n== 5. Tout geste qui change le resultat le perime ==');
const base = fs.readFileSync(R + 'bdv-base.js', 'utf8');
const bloc = (nom) => {
  const i = base.indexOf('function ' + nom + '(');
  if (i < 0) return null;
  let p = base.indexOf('{', i), n = 0, j = p;
  for (; j < base.length; j++) {
    if (base[j] === '{') n++;
    else if (base[j] === '}') { n--; if (!n) break; }
  }
  return base.slice(i, j + 1);
};
t('syncUneColonne() perime quand le reglage compte pour le serveur',
  /capPerimer\(/.test(bloc('syncUneColonne') || ''));
t('et classement / exercice_debut / objectif sont bien les trois reglages surveilles',
  /CAP_REGLAGES\s*=\s*\['classement',\s*'exercice_debut',\s*'objectif'\]/.test(base));
for (const nom of ['handleFiles', 'adopterObjectif', 'adopterExercice', 'viderBase']) {
  const b = bloc(nom);
  t(nom + '() perime le resume', !!b && /capPerimer\(/.test(b),
    b ? 'aucun appel dans le corps' : 'fonction introuvable');
}
/* appliquerReglages, oublierReglages et exAppliquer passent par syncClassement /
   syncExercice, donc par syncUneColonne : c'est voulu, un seul point de passage. */
for (const [nom, via] of [['appliquerReglages', 'syncClassement'],
                          ['oublierReglages', 'syncClassement'],
                          ['exAppliquer', 'syncExercice']]) {
  const b = bloc(nom);
  t(nom + '() passe par ' + via + '(), donc par la peremption',
    !!b && new RegExp(via + '\\(').test(b));
}
/* LA PEREMPTION ATTEND L'ECRITURE. Redemander le resume avant que le nouveau
   classement soit en base, c'est se faire recalculer l'ANCIEN et le ranger comme
   s'il etait neuf. */
const ecrans = fs.readFileSync(R + 'bdv-ecrans.js', 'utf8');
t('capRafraichir() sait attendre une ecriture avant de redemander',
  /function capRafraichir\(apres\)/.test(ecrans) && /apres\.then\s*===\s*'function'/.test(ecrans));
t('et il met le resume a null TOUT DE SUITE, sans attendre',
  /function capRafraichir\(apres\)\{\s*\n?\s*capPoser\(null\);/.test(ecrans));

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DU CAP SERVEUR REFUSE\n'); process.exit(1); }
console.log('  LE MEME ECRAN, QUE LE CHIFFRE VIENNE DU SERVEUR OU DE L\'APPAREIL\n');
process.exit(0);
