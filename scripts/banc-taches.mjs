/* ============================================================================
   scripts/banc-taches.mjs : le banc de Mes taches

     npm run banc:taches

   ECRIT AVEC LA PIECE, le 07/09/2026. Il ne regarde pas l'ecran : il verifie LA
   CHARGE ENVOYEE au serveur pour chaque geste. C'est la lecon de la journee,
   payee deux fois : les signets sont restes vides pendant des jours parce que
   `id` manquait dans le corps, et l'objectif de CA s'effacait parce qu'un geste
   envoyait des colonnes qu'il n'avait pas modifiees. Dans les deux cas l'ecran
   disait la verite du miroir local, donc ne disait rien.

   IL DEMANDE jsdom :  npm install --save-dev jsdom
   Sans lui il s'arrete en le disant, et il ne rend jamais un faux OK.

   LES FICHIERS SONT POSES COMME DE VRAIS <script> DE LA PAGE : deux `eval`
   separes ne partagent pas les `let` de premier niveau, alors que deux <script>
   classiques d'une meme page, si.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RACINE, 'src/js');

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch (e) {
  console.error('\n  jsdom est absent, le banc ne peut pas tourner.');
  console.error('  Rien n\'a ete verifie. Installe-le :  npm install --save-dev jsdom\n');
  process.exit(2);
}
for (const f of ['bdv-taches.js', 'bdv-echeances.js']) {
  if (!fs.existsSync(path.join(JS, f))) {
    console.error('\n  src/js/' + f + ' est absent : le banc ne verifie rien.\n');
    process.exit(2);
  }
}

let ok = 0, ko = 0;
const dit = (b, m, det) => {
  if (b) { ok++; console.log('  ok    : ' + m); }
  else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + det : '')); }
};

/* Une obligation MENSUELLE, pour que le banc ne depende pas du mois ou il tourne :
   le 10 du mois prochain existe toujours, et il est toujours a plus de zero jour.

   UNE DE CHAQUE FAMILLE, depuis le 08/09/2026, et c'est une correction de banc
   autant que de code. Ce bac d'essai n'a longtemps contenu QUE la DRM. Quand le
   lot 2 a ajoute les travaux, les salons et les temps forts au fichier de
   donnees, « Mes taches » est passee de 5 lignes a 28 et s'est mise a proposer
   de cocher « Taille de la vigne » comme une DRM. Le banc n'a rien vu : il ne
   contenait pas de travaux. UN JEU D'ESSAI PLUS PETIT QUE LA REALITE NE VERIFIE
   QUE CE QU'IL CONTIENT. */
const ECHEANCES = [
  { cle: 'drm', titre: 'DRM, declaration recapitulative mensuelle',
    famille: 'obligations', statut: 'obligation',
    recurrence: { type: 'mensuel', jour: 10 } },
  { cle: 'taille', titre: 'Taille de la vigne',
    famille: 'travaux', statut: 'repere',
    recurrence: { type: 'mensuel', jour: 12 } },
  { cle: 'salon', titre: 'Un salon',
    famille: 'rendezvous', statut: 'repere',
    recurrence: { type: 'mensuel', jour: 14 } },
  { cle: 'noel', titre: 'Campagne de fin d\'annee',
    famille: 'tempsforts', statut: 'repere',
    recurrence: { type: 'mensuel', jour: 16 } }
];

const CORPS = '<!doctype html><html><body>'
  + '<script id="bdvEcheances" type="application/json">' + JSON.stringify(ECHEANCES) + '<\/script>'
  + '<form id="tachesForm"><input id="tachesTitre"><input id="tachesDate" type="date">'
  + '<button type="submit">Ajouter</button></form>'
  + '<span id="tachesNote"></span><div id="tachesAFaire"></div><div id="tachesFaites"></div>'
  + '</body></html>';

function monter(opts) {
  opts = opts || {};
  const dom = new JSDOM(CORPS, { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  const etat = { appels: [], horsLigne: !!opts.horsLigne };
  w.BdvCompte = {
    monId: () => opts.sansSession ? null : 'moi',
    session: () => opts.sansSession ? null : { user: { id: 'moi' } },
    api: (chemin, o) => {
      o = o || {};
      etat.appels.push({ chemin: chemin, methode: o.methode || 'GET', corps: o.corps });
      if (etat.horsLigne) return Promise.reject(new Error('reseau'));
      return Promise.resolve((o.methode || 'GET') === 'GET' ? (opts.lignes || []) : null);
    }
  };
  /* LE MIROIR DE LA FILE, quand le banc en demande un. « Mes taches » lit les rappels
     clients ICI, et n'ecrit jamais dedans : c'est `suivi_clients` qui fait foi, par
     bdv-crm.js. Un faux miroir suffit donc a tout verifier, y compris qu'aucune
     ecriture ne part vers /taches. */
  if (opts.crm) w.BdvCrm = { miroir: () => opts.crm };
  const poser = (js, nom) => {
    const s = w.document.createElement('script');
    s.textContent = js;
    try { w.document.body.appendChild(s); }
    catch (e) { console.log('  ECHEC : ' + nom + ' leve -> ' + e.message); process.exit(1); }
  };
  poser(fs.readFileSync(path.join(JS, 'bdv-echeances.js'), 'utf8'), 'bdv-echeances.js');
  poser(fs.readFileSync(path.join(JS, 'bdv-taches.js'), 'utf8'), 'bdv-taches.js');
  etat.w = w;
  etat.T = w.BdvTaches;
  etat.ecritures = () => etat.appels.filter(a => a.methode !== 'GET');
  return etat;
}
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

/* ==========================================================================
   1. UNE TACHE ECRITE A LA MAIN
   ========================================================================== */
console.log('\n== 1. Une tache ecrite a la main ==');
{
  const t = monter();
  await dormir(30);
  dit(typeof t.T === 'object', 'BdvTaches est expose');
  dit(t.appels.some(a => a.methode === 'GET' && a.chemin.indexOf('/taches?select=') === 0),
    'la page lit les taches du compte sans attendre l\'ouverture de la piece');

  t.appels.length = 0;
  t.T.ajouter('commander des bouchons', null);
  await dormir(30);
  const e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'POST', 'ajouter ecrit une fois, en POST', e.length);
  dit(e.length === 1 && e[0].chemin === '/taches?on_conflict=id,tache_id',
    'sur la cle (id, tache_id)', e.length && e[0].chemin);
  const l = e.length ? e[0].corps[0] : {};
  dit(l.id === 'moi', 'LA CHARGE PORTE L\'IDENTIFIANT DU COMPTE', JSON.stringify(l.id));
  dit(l.titre === 'commander des bouchons', 'et le titre saisi');
  dit(l.source === 'libre', 'la nature est « libre »', l.source);
  dit(l.fait_le === null, 'une tache neuve n\'est pas faite');
  dit(!!l.tache_id && l.tache_id.indexOf('ech:') !== 0,
    'son identifiant n\'usurpe pas celui d\'une obligation', l.tache_id);

  t.appels.length = 0;
  dit(t.T.ajouter('   ') === false && t.ecritures().length === 0,
    'un titre vide n\'ecrit rien');
}

/* ==========================================================================
   2. UNE OBLIGATION COCHEE
   ========================================================================== */
console.log('\n== 2. Une obligation du calendrier ==');
{
  const t = monter();
  await dormir(30);
  const obl = t.T.toutes().filter(x => x.source === 'echeance');
  dit(obl.length === 1, 'l\'obligation apparait dans la liste sans etre en base', obl.length);
  dit(obl.length === 1 && /^ech:drm:\d{4}-\d{2}-\d{2}$/.test(obl[0].tache_id),
    'son identifiant porte L\'OCCURRENCE, pas seulement la cle', obl.length && obl[0].tache_id);
  dit(obl.length === 1 && obl[0].fait_le === null, 'et elle n\'est pas faite');

  t.appels.length = 0;
  t.T.basculer(obl[0].tache_id);
  await dormir(30);
  let e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'POST', 'cocher ecrit une ligne', e.length);
  const l = e.length ? e[0].corps[0] : {};
  dit(l.id === 'moi', 'la charge porte l\'identifiant du compte');
  dit(l.source === 'echeance' && l.ref === 'drm', 'la nature et la cle de l\'obligation', l.source + '/' + l.ref);
  dit(!!l.fait_le, 'avec la date du geste');
  dit(!!l.echue_le, 'et la date de l\'occurrence', l.echue_le);

  t.appels.length = 0;
  t.T.basculer(obl[0].tache_id);
  await dormir(30);
  e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'DELETE',
    'DECOCHER UNE OBLIGATION SUPPRIME LA LIGNE, il n\'y a rien a retenir d\'une obligation pas faite',
    e.length && e[0].methode);
  dit(e.length === 1 && e[0].chemin.indexOf('id=eq.moi') > 0 && e[0].chemin.indexOf('tache_id=eq.') > 0,
    'et la requete nomme les DEUX colonnes de la cle', e.length && e[0].chemin);
  dit(t.T.toutes().filter(x => x.source === 'echeance' && x.fait_le).length === 0,
    'l\'obligation est revenue a faire');
}

/* ==========================================================================
   3. COCHER PUIS DECOCHER UNE TACHE ECRITE
   ========================================================================== */
console.log('\n== 3. Cocher une tache ecrite ne la supprime pas ==');
{
  const t = monter();
  await dormir(30);
  t.T.ajouter('rappeler le comptable', null);
  const tid = t.T.toutes().filter(x => x.source === 'libre')[0].tache_id;

  t.appels.length = 0;
  t.T.basculer(tid);
  await dormir(30);
  let e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'POST' && !!e[0].corps[0].fait_le,
    'cocher pose une date de realisation');
  dit(e.length === 1 && e[0].corps[0].titre === 'rappeler le comptable',
    'et garde le titre : une ligne cochee reste lisible');

  t.appels.length = 0;
  t.T.basculer(tid);
  await dormir(30);
  e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'POST' && e[0].corps[0].fait_le === null,
    'decocher remet a faire, SANS supprimer : ce que le vigneron a ecrit lui appartient',
    e.length && e[0].methode);

  t.appels.length = 0;
  t.T.supprimer(tid);
  await dormir(30);
  e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'DELETE', 'retirer supprime bien la ligne');
}

/* ==========================================================================
   4. HORS LIGNE : RIEN N'EST PERDU, ET RIEN N'EST INVENTE
   ========================================================================== */
console.log('\n== 4. Hors ligne, puis rejeu ==');
{
  const t = monter({ horsLigne: true });
  await dormir(30);
  t.T.ajouter('acheter du sucre de chaptalisation', null);
  await dormir(30);
  const tid = t.T.toutes().filter(x => x.source === 'libre')[0].tache_id;
  dit(!!tid, 'le geste tient a l\'ecran malgre le reseau coupe');
  const file = JSON.parse(t.w.localStorage.getItem('bdv_taches_attente') || '{}');
  dit(!!file[tid], 'et il part dans la file d\'attente');
  dit(file[tid] && file[tid].id === undefined,
    'LA FILE NE GARDE PAS L\'IDENTIFIANT DU COMPTE : il est pose a l\'envoi, sinon une ligne enfilee sous un autre compte repartirait sur celui-la');

  // Le reseau revient : le rejeu doit envoyer la meme charge, et poser l'identifiant.
  t.horsLigne = false;
  t.appels.length = 0;
  t.T.supprimer(tid);
  await dormir(30);
  const e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'DELETE',
    'une suppression part en suppression, et pas en ecriture vide : c\'est ce defaut qui bloquait la file des signets');
}

/* ==========================================================================
   5. L'ORDRE, ET LES PUNAISES DU PANNEAU
   ========================================================================== */
console.log('\n== 5. L\'ordre et les punaises ==');
{
  const hier = new Date(); hier.setDate(hier.getDate() - 3);
  const dans2 = new Date(); dans2.setDate(dans2.getDate() + 2);
  const j = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const t = monter();
  await dormir(30);
  t.T.ajouter('sans date', null);
  t.T.ajouter('en retard', j(hier));
  t.T.ajouter('dans deux jours', j(dans2));
  await dormir(30);

  const noms = t.T.toutes().map(x => x.titre);
  dit(noms[0] === 'en retard', 'le retard passe devant tout', noms.join(' | '));
  dit(noms[noms.length - 1] === 'sans date',
    'et une tache sans date ferme la marche : elle ne doit pas couvrir une DRM qui tombe demain', noms.join(' | '));

  const p = t.T.punaises();
  dit(p.length <= 4, 'le liege recoit au plus trois taches, plus une punaise de renvoi', p.length);
  dit(p[0] && p[0].ton === 'vieux', 'le retard prend le ton du danger', p[0] && p[0].ton);
  dit(p.every(x => x.href === '/mon-bureau/#taches'), 'chaque punaise mene a la piece');
  /* LE TITRE EST EN TETE, L'ECHEANCE EST UN TAMPON. Change le 10/09/2026 sur une
     remarque de Ted devant sa vraie page : « les gros mots AUJOURD'HUI et DEMAIN en
     gros, ca perd le message ». Le grand emplacement du post-it porte desormais le
     TITRE, et l'echeance descend en etiquette au-dessus.
     Le jeu d'essai est piegeux et c'est assume : la tache s'appelle « en retard », ce
     qui est aussi le mot du tampon. On verifie donc les deux champs SEPAREMENT, sinon
     un test vert ne dirait pas laquelle des deux valeurs il a lue. */
  const enRetard = p.filter(x => x.valeur === 'en retard')[0];
  dit(!!enRetard, 'la ligne de tete porte le TITRE de la tache, pas son echeance',
    p.map(x => x.valeur).join(' | '));
  dit(enRetard && enRetard.tampon === 'en retard',
    'et l\'echeance descend en tampon au-dessus', enRetard && enRetard.tampon);
  dit(p.every(x => !x.gestes || x.libelle === undefined),
    'une punaise de chose a faire n\'a pas de libelle : le titre le remplace');
}

/* ==========================================================================
   6. LA DECONNEXION
   ========================================================================== */
console.log('\n== 6. La deconnexion ==');
{
  const t = monter();
  await dormir(30);
  t.T.ajouter('note privee', null);
  await dormir(30);
  dit(t.T.toutes().filter(x => x.source === 'libre').length === 1, 'une tache est la');
  t.w.BdvCompte.monId = () => null;
  t.w.BdvCompte.session = () => null;
  t.w.document.dispatchEvent(new t.w.Event('bdv:session'));
  await dormir(30);
  dit(t.T.toutes().filter(x => x.source === 'libre').length === 0,
    'la deconnexion vide le miroir : les taches du precedent ne sont pas les siennes');
  dit(t.T.toutes().filter(x => x.source === 'echeance').length === 1,
    'les obligations restent, elles ne sont pas des donnees de compte');
}

/* ==========================================================================
   7. UNE TACHE QUI DURE PLUSIEURS JOURS
   ==========================================================================
   Ajoute le 08/09/2026. Ted : « la creation d'une occurrence doit demander aussi
   une date de fin facultative : imagine c'est un salon sur plusieurs jours ».
   ========================================================================== */
console.log('\n== 7. Une tache qui dure plusieurs jours ==');
{
  const jour = (n) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
         + '-' + String(d.getDate()).padStart(2, '0');
  };

  const t = monter();
  await dormir(30);
  t.appels.length = 0;
  t.T.ajouter('Wine Paris', jour(30), jour(32));
  await dormir(30);
  let l = t.ecritures()[0].corps[0];
  dit(l.echue_le === jour(30) && l.fin_le === jour(32),
    'les deux dates partent en base', JSON.stringify([l.echue_le, l.fin_le]));

  /* LES DEUX DATES SONT REMISES DANS L'ORDRE, pas refusees. « Du 11 au 9 » ne veut
     dire qu'une chose, et un formulaire qui refuse sans expliquer fait abandonner.
     L'echange se voit tout de suite dans la liste, donc il ne cache rien. */
  t.appels.length = 0;
  t.T.ajouter('Salon a l\'envers', jour(40), jour(38));
  await dormir(30);
  l = t.ecritures()[0].corps[0];
  dit(l.echue_le === jour(38) && l.fin_le === jour(40),
    'des dates a l\'envers sont remises dans l\'ordre', JSON.stringify([l.echue_le, l.fin_le]));

  t.appels.length = 0;
  t.T.ajouter('Un seul jour', jour(50), jour(50));
  await dormir(30);
  l = t.ecritures()[0].corps[0];
  dit(l.fin_le === null,
    'une fin egale au debut n\'est pas une periode : elle est effacee', l.fin_le);

  /* Une fin SANS debut ne saurait pas ou se poser dans la grille. Elle devient le
     debut, ce qui est la seule lecture possible. */
  t.appels.length = 0;
  t.T.ajouter('Fin sans debut', null, jour(60));
  await dormir(30);
  l = t.ecritures()[0].corps[0];
  dit(l.echue_le === jour(60) && l.fin_le === null,
    'une fin sans debut devient le debut', JSON.stringify([l.echue_le, l.fin_le]));

  /* LE RETARD SE COMPTE SUR LA FIN, PAS SUR LE DEBUT. Un salon du 9 au 11 fevrier
     n'est pas en retard le 10 : il a lieu. Compter sur le debut aurait mis en
     retard, des le deuxieme jour, tout ce qui dure. */
  const u = monter();
  await dormir(30);
  u.T.ajouter('Salon en cours', jour(-1), jour(1));
  await dormir(30);
  const enCours = u.T.toutes().filter(x => x.titre === 'Salon en cours')[0];
  dit(enCours && enCours.enCours === true && enCours.jours === 0,
    'une periode commencee mais pas finie n\'est PAS en retard, elle est en cours',
    JSON.stringify([enCours && enCours.enCours, enCours && enCours.jours]));

  u.T.ajouter('Salon fini', jour(-10), jour(-8));
  await dormir(30);
  const fini = u.T.toutes().filter(x => x.titre === 'Salon fini')[0];
  dit(fini && fini.jours === -8 && !fini.enCours,
    'une periode finie hier est en retard depuis SA FIN, pas depuis son debut',
    fini && fini.jours);

  /* Cocher ne doit pas perdre la fin : la ligne est reecrite entiere. */
  u.appels.length = 0;
  u.T.basculer(u.T.toutes().filter(x => x.titre === 'Salon en cours')[0].tache_id);
  await dormir(30);
  const recoche = u.ecritures()[0].corps[0];
  dit(recoche.fin_le === jour(1),
    'cocher une periode garde sa date de fin', recoche.fin_le);
}

/* ==========================================================================
   8. CHOISIR LES FAMILLES AFFICHEES DANS LA LISTE
   ==========================================================================
   Demande de Ted le 08/09/2026, et correction de la regression ci-dessus.
   ========================================================================== */
console.log('\n== 8. Choisir les familles affichees ==');
{
  const t = monter();
  await dormir(30);
  t.T.ajouter('Une note a moi', null);
  await dormir(30);

  const titres = () => t.T.toutes().map(x => x.titre);
  /* LES DEFAUTS NE SONT PAS CEUX DU CALENDRIER, et c'est voulu. Le calendrier
     montre tout, c'est une carte. Une liste de choses a faire ne porte que ce
     qui se coche vraiment : les obligations et ce que le vigneron a note. */
  dit(titres().indexOf('DRM, declaration recapitulative mensuelle') >= 0,
    'par defaut, les obligations sont dans la liste');
  dit(titres().indexOf('Une note a moi') >= 0,
    'par defaut, les notes du vigneron aussi');
  dit(titres().indexOf('Taille de la vigne') < 0
    && titres().indexOf('Un salon') < 0
    && titres().indexOf('Campagne de fin d\'annee') < 0,
    'MAIS PAS LES REPERES DE SAISON, LES SALONS NI LES TEMPS FORTS : une liste de '
    + 'choses a faire n\'est pas le calendrier', JSON.stringify(titres()));

  t.T.basculerFamille('travaux');
  dit(titres().indexOf('Taille de la vigne') >= 0,
    'rallumer les travaux les fait entrer dans la liste');
  t.T.basculerFamille('travaux');
  dit(titres().indexOf('Taille de la vigne') < 0,
    'et les eteindre les ressort');

  t.T.basculerFamille('notes');
  dit(titres().indexOf('Une note a moi') < 0
    && titres().indexOf('DRM, declaration recapitulative mensuelle') >= 0,
    'eteindre « Mes notes » ne cache que les notes, pas les obligations',
    JSON.stringify(titres()));
  t.T.basculerFamille('notes');

  /* LE CHOIX EST PROPRE A CETTE PIECE. Le partager avec le calendrier voudrait
     dire qu'eteindre « Travaux » pour nettoyer sa liste retire les vendanges de
     la grille, qui est justement l'endroit ou on veut les voir. */
  dit(t.w.localStorage.getItem('bdv_taches_familles') !== null
    && t.w.localStorage.getItem('bdv_cal_familles') === null,
    'le choix des taches ne touche pas celui du calendrier');
}

/* ==========================================================================
   9. LES RAPPELS CLIENTS, LUS ET JAMAIS STOCKES
   ==========================================================================
   Demande de Ted le 11/09/2026. Jusque-la cette piece portait DEUX natures et pas
   trois, et la regle 7 de CLAUDE.md l'interdisait : deux endroits qui repondent
   « qui dois-je appeler » se contredisent au premier geste.

   CE QUI REND LA REGLE TENABLE, et c'est exactement ce que cette section garde :
   ces lignes ne sont pas stockees ici, elles sont LUES dans le miroir de la file,
   et elles NE SE COCHENT PAS. Si un jour une ecriture part vers /taches pour un
   rappel client, ou si une case a cocher apparait sur ces lignes, il y aura DEUX
   endroits qui disent « fait » pour le meme client, et ils se contrediront.
   ========================================================================== */
console.log('\n== 9. Les rappels clients ==');
{
  const j = (n) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')
         + '-' + String(d.getDate()).padStart(2,'0');
  };
  const miroir = {
    noms: { '706': 'VINOBILIS SRL', '34': 'Oenophil' },
    suivi: [
      { id: '706', rappel: j(-2), titre: 'Lui reparler du reassort', statut: 'relance' },
      { id: '34',  rappel: j(5),  titre: '', statut: '' },
      { id: '99',  rappel: j(1),  titre: 'deja traite', statut: 'traite' }
    ]
  };
  const t = monter({ crm: miroir });
  await dormir(30);

  const cl = t.T.toutes().filter(x => x.source === 'client');
  dit(cl.length === 2, 'les rappels poses sur des clients entrent dans la liste', cl.length);
  dit(cl.every(x => x.tache_id.indexOf('client:') === 0),
    'leur identifiant porte le prefixe client:, il ne peut pas heurter celui d\'une tache',
    cl.map(x => x.tache_id).join(' | '));
  dit(!cl.some(x => x.ref === '99'),
    'UN CLIENT MIS DE COTE N\'EST PAS UNE CHOSE A FAIRE : il ne remonte pas ici');
  dit(cl.filter(x => x.ref === '706')[0].titre === 'VINOBILIS SRL',
    'la ligne porte le NOM du client, pas son numero');
  dit(cl.filter(x => x.ref === '706')[0].motif === 'Lui reparler du reassort',
    'et le motif du rappel, qui dit ce qu\'on s\'etait promis');
  dit(t.T.toutes()[0].source === 'client' && t.T.toutes()[0].ref === '706',
    'un rappel en retard passe devant tout, comme une tache en retard',
    t.T.toutes()[0].titre);

  t.appels.length = 0;
  t.T.rendre();
  await dormir(30);
  dit(t.ecritures().length === 0,
    'AFFICHER DES RAPPELS CLIENTS N\'ECRIT RIEN DANS LA TABLE DES TACHES',
    JSON.stringify(t.ecritures()));
  const html = t.w.document.getElementById('tachesAFaire').innerHTML;
  dit(html.indexOf('data-tache-coche="client:') < 0,
    'UN CLIENT N\'A PAS DE CASE A COCHER : « fait » pour un client, c\'est ce qu\'il a dit, et ca s\'ecrit dans sa fiche');
  dit(html.indexOf('data-tache-client="706"') >= 0,
    'il a un bouton qui mene a sa fiche, et c\'est son seul geste');

  t.T.basculerFamille('clients');
  dit(t.T.toutes().filter(x => x.source === 'client').length === 0,
    'eteindre « Mes clients » les retire de la liste');
  dit(t.T.toutes().filter(x => x.source === 'echeance').length === 1,
    'et ne touche pas aux obligations');
  t.T.basculerFamille('clients');

  /* SANS MIROIR, RIEN. Le module de la file peut ne pas etre charge, ou le miroir
     etre vide au premier passage : la piece doit alors montrer ses taches, et pas
     lever. */
  const v = monter();
  await dormir(30);
  dit(v.T.toutes().filter(x => x.source === 'client').length === 0
    && v.T.toutes().length > 0,
    'sans file chargee, la piece montre ses taches sans broncher');
}

/* ==========================================================================
   10. LA MODALE D'UNE TACHE
   ==========================================================================
   Demandee par Ted le 12/09/2026. CE BANC NE REGARDE PAS SI C'EST JOLI : il
   verifie les deux choses qu'une capture ne montre pas.

   1. QUE LES TROIS NATURES N'OUVRENT PAS LA MEME MODALE. Une tache ecrite se
      modifie et se repousse ; une obligation ne se modifie ni ne se repousse ;
      un client n'ouvre pas cette modale du tout. Trois regles deja tranchees,
      qu'une modale uniforme aurait cassees en silence.

   2. QUE LE REFUS EST DANS LA DONNEE ET PAS DANS L'ECRAN. On appelle donc
      modifier() et reporterAu() SUR UNE OBLIGATION, a la main, comme le ferait
      un bouton mal branche : elles doivent refuser et n'ecrire nulle part.
      Cacher un bouton n'a jamais empeche un appel.
   ========================================================================== */
console.log('\n== 10. La modale d\'une tache ==');
{
  const t = monter();
  await dormir(30);
  const w = t.w, doc = w.document;
  const el = (id) => doc.getElementById(id);
  const vu = (id) => { const n = el(id); return !!n && !n.hidden; };
  const jour = (n) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  };

  /* ---- une tache ecrite : tout est ouvert ---- */
  t.T.ajouter('commander des bouchons', jour(3));
  const tid = t.T.toutes().filter(x => x.source === 'libre')[0].tache_id;
  dit(t.T.modale(tid) === true, 'la modale s\'ouvre sur une tache ecrite');
  dit(vu('tacheModale'), 'le noeud est pose et visible');
  dit(el('tacheModale').parentNode === doc.body,
    'et pose SOUS <body> : un parent en transform reclasserait un position:fixed sans rien dire');
  dit(el('tmodNom').value === 'commander des bouchons', 'le titre est dans le champ', el('tmodNom').value);
  dit(el('tmodDebut').value === jour(3), 'la date aussi', el('tmodDebut').value);
  dit(vu('tmodForm'), 'le formulaire est la : une tache ecrite se corrige');
  dit(vu('tmodReports'), 'les reports sont la');
  dit(vu('tmodSuppr'), 'et le retrait');
  dit(!vu('tmodExige'), 'mais pas « ce que ca exige » : une note n\'exige rien');

  /* ---- une obligation : lecture seule, et un seul geste ---- */
  const obl = t.T.toutes().filter(x => x.source === 'echeance')[0];
  dit(t.T.modale(obl.tache_id) === true, 'la modale s\'ouvre aussi sur une obligation');
  dit(!vu('tmodForm'),
    'SON TITRE ET SA DATE NE SE MODIFIENT PAS : ils viennent du fichier de donnees');
  dit(!vu('tmodReports'),
    'UNE DRM NE SE REPOUSSE PAS : un bouton qui la decalerait mentirait sur ce qui est negociable');
  dit(!vu('tmodSuppr'),
    'et elle ne se retire pas : elle reviendrait le mois suivant de toute facon');
  dit(vu('tmodExige'), 'elle mene a ce que l\'echeance exige');
  dit(el('tmodTitre').textContent === obl.titre, 'son titre est affiche en clair', el('tmodTitre').textContent);

  /* ---- un client : la porte est fermee, et elle l'est dans la donnee ---- */
  const c = monter({ crm: { noms: { 706: 'Domaine Martin' },
    suivi: [{ id: 706, rappel: jour(1), titre: 'rappeler pour la livraison' }] } });
  await dormir(30);
  const cli = c.T.toutes().filter(x => x.source === 'client')[0];
  dit(!!cli, 'le rappel client est bien dans la liste');
  dit(c.T.modale(cli.tache_id) === false,
    'UN CLIENT N\'OUVRE PAS CETTE MODALE : sa fiche est le seul endroit ou l\'on note ce qu\'il a dit');
  dit(!c.w.document.getElementById('tacheModale'),
    'et rien n\'a meme ete monte pour lui');
  const htmlC = c.w.document.getElementById('tachesAFaire').innerHTML;
  dit(htmlC.indexOf('data-tache-ouvrir="client:') < 0,
    'sa ligne ne porte aucune porte vers la modale');

  /* ---- la ligne de la liste porte la porte ---- */
  t.T.rendre();
  const html = doc.getElementById('tachesAFaire').innerHTML;
  dit(html.indexOf('data-tache-ouvrir="' + tid + '"') >= 0,
    'la ligne d\'une tache ecrite porte de quoi ouvrir la modale');
  dit(html.indexOf('data-tache-ouvrir="' + obl.tache_id + '"') >= 0,
    'celle d\'une obligation aussi');
  dit(html.indexOf('<button type="button" class="tache__corps"') >= 0
      || html.indexOf('class="tache__corps" data-tache-ouvrir') >= 0
      || /<button[^>]*class="tache__corps"/.test(html),
    'et c\'est un <button> : ce qui s\'ouvre a la souris doit s\'ouvrir au clavier');

  /* ---- la punaise du panneau porte la meme porte ---- */
  const p = t.T.punaises().filter(x => String(x.cle).indexOf('tache:') === 0)[0];
  dit(!!p && p.ouvre === tid,
    'la punaise du panneau ouvre la modale de SA tache', p && p.ouvre);
  dit(!!p && p.href === '/mon-bureau/#taches',
    'et garde son lien dessous, pour le clic milieu et pour le module absent');

  /* ---- modifier : une seule ecriture, et rien de perdu ---- */
  t.T.modale(tid);
  t.appels.length = 0;
  dit(t.T.modifier(tid, 'commander des bouchons de liege', jour(5), null) === true,
    'modifier accepte une tache ecrite');
  await dormir(30);
  let e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'POST', 'et ecrit UNE fois, en POST', e.length);
  let l = e.length ? e[0].corps[0] : {};
  dit(l.titre === 'commander des bouchons de liege', 'le nouveau titre part', l.titre);
  dit(l.id === 'moi', 'la charge porte l\'identifiant du compte');
  dit(!!l.cree_le, 'LA DATE DE CREATION SURVIT : corriger une faute de frappe ne rajeunit pas une tache');
  dit(l.echue_le === jour(5) && l.fin_le === null, 'et la nouvelle date', l.echue_le);

  t.appels.length = 0;
  dit(t.T.modifier(tid, '   ') === false && t.ecritures().length === 0,
    'un titre vide ne modifie rien');
  dit(t.T.modifier(obl.tache_id, 'DRM renommee') === false,
    'UNE OBLIGATION NE SE RENOMME PAS, meme appelee a la main');
  await dormir(30);
  dit(t.ecritures().length === 0, 'et l\'appel refuse n\'ecrit nulle part',
    JSON.stringify(t.ecritures()));

  /* ---- modifier garde ce qui est fait ---- */
  t.T.basculer(tid);
  await dormir(30);
  t.appels.length = 0;
  t.T.modifier(tid, 'bouchons de liege', jour(5), null);
  await dormir(30);
  e = t.ecritures();
  dit(e.length === 1 && !!e[0].corps[0].fait_le,
    'corriger une tache COCHEE ne la remet pas a faire : la preuve du travail reste');

  /* ---- reporter a une date : la duree suit ---- */
  const s = monter();
  await dormir(30);
  s.T.ajouter('salon de Loire', jour(2), jour(4));   // trois jours
  const sid = s.T.toutes().filter(x => x.source === 'libre')[0].tache_id;
  s.appels.length = 0;
  dit(s.T.reporterAu(sid, jour(20)) === true, 'reporterAu accepte une tache ecrite');
  await dormir(30);
  e = s.ecritures();
  l = e.length ? e[0].corps[0] : {};
  dit(e.length === 1, 'et ecrit une seule fois', e.length);
  dit(l.echue_le === jour(20), 'le debut se pose a la date demandee', l.echue_le);
  dit(l.fin_le === jour(22),
    'UNE TACHE QUI DURE GARDE SA DUREE : un salon de trois jours reporte reste un salon de trois jours',
    l.fin_le);
  dit(l.fait_le === null, 'et repousser remet a faire');

  s.appels.length = 0;
  dit(s.T.reporterAu(obl.tache_id, jour(20)) === false,
    'UNE OBLIGATION NE SE REPOUSSE PAS, meme appelee a la main');
  dit(s.T.reporterAu(sid, '') === false, 'ni nulle part');
  await dormir(30);
  dit(s.ecritures().length === 0, 'et ces refus n\'ecrivent rien');

  /* ---- repousser passe par le meme chemin ---- */
  s.appels.length = 0;
  s.T.repousser(sid, 1);
  await dormir(30);
  e = s.ecritures();
  dit(e.length === 1 && e[0].corps[0].echue_le === jour(1),
    'LE « DEMAIN » SE COMPTE A PARTIR D\'AUJOURD\'HUI, jamais de l\'ancienne date',
    e.length && e[0].corps[0].echue_le);

  /* ---- une occurrence que toutes() ne liste pas ---- */
  const f = monter();
  await dormir(30);
  const loin = jour(200).slice(0, 8) + '10';
  dit(f.T.modaleOccurrence('drm', 'DRM, declaration recapitulative mensuelle', loin) === true,
    'la modale s\'ouvre sur une occurrence LOINTAINE, que toutes() n\'a jamais listee');
  const fw = f.w.document;
  dit(fw.getElementById('tmodFait').textContent.indexOf('fait') >= 0,
    'et propose de la cocher', fw.getElementById('tmodFait').textContent);
  f.appels.length = 0;
  f.T.basculerOccurrence('drm', 'DRM', loin);
  await dormir(30);
  e = f.ecritures();
  dit(e.length === 1 && e[0].corps[0].tache_id === 'ech:drm:' + loin,
    'cocher de la ecrit la ligne de CETTE occurrence-la', e.length && e[0].corps[0].tache_id);

  /* ---- ON NE REPOUSSE QUE CE QUI PRESSE ----
     La regle existait deja pour les punaises du panneau, et la modale l'a enfreinte
     jusqu'a la capture du 12/09/2026 : un salon dans douze jours, et un bouton
     « Demain » sous le titre « Pas maintenant ? ». Demain, c'etait l'AVANCER. */
  const r = monter();
  await dormir(30);
  r.T.ajouter('deja en retard', jour(-3));
  r.T.ajouter('un salon dans douze jours', jour(12), jour(14));
  const rw = r.w.document;
  const rvu = (id) => { const n = rw.getElementById(id); return !!n && !n.hidden; };
  const enRetard = r.T.toutes().filter(x => x.source === 'libre' && x.jours < 0)[0];
  const plusTard = r.T.toutes().filter(x => x.source === 'libre' && x.jours > 1)[0];

  r.T.modale(enRetard.tache_id);
  dit(rvu('tmodVite1') && rvu('tmodVite7'),
    'sur une tache en retard, « Demain » et « Dans 7 jours » sont proposes');
  dit(rw.getElementById('tmodReportL').textContent === 'Pas maintenant ?',
    'et le bloc s\'appelle « Pas maintenant ? »', rw.getElementById('tmodReportL').textContent);

  r.T.modale(plusTard.tache_id);
  dit(!rvu('tmodVite1') && !rvu('tmodVite7'),
    'SUR UNE TACHE PAS ENCORE DUE, « Demain » DISPARAIT : il l\'avancerait au lieu de la repousser');
  dit(rvu('tmodReports'), 'le champ de date, lui, reste : une tache a venir se DEPLACE');
  dit(rw.getElementById('tmodReportL').textContent === 'La déplacer ?',
    'et le titre du bloc le dit avec les bons mots', rw.getElementById('tmodReportL').textContent);

  /* ---- fermer ---- */
  t.T.modale(tid);
  dit(vu('tacheModale'), 'la modale est ouverte');
  t.T.fermerModale();
  dit(!vu('tacheModale'), 'fermerModale la ferme');
  t.appels.length = 0;
  t.T.rendre();
  await dormir(30);
  dit(t.ecritures().length === 0, 'OUVRIR ET FERMER N\'ECRIT RIEN : regarder n\'est pas un geste');
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LE BANC DES TACHES REFUSE\n'); process.exit(1); }
console.log('  MES TACHES ECRIT CE QU\'ELLE DIT\n');
