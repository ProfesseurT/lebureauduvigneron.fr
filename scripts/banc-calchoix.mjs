/* ============================================================================
   scripts/banc-calchoix.mjs : le banc des choix de calendrier

     npm run banc:calchoix

   ECRIT AVEC LE LOT 3, le 08/09/2026. Meme methode que banc-taches.mjs : il ne
   regarde pas l'ecran, il verifie LA CHARGE ENVOYEE au serveur pour chaque
   geste. C'est la lecon payee deux fois, aux signets puis aux reglages : l'ecran
   dit la verite du miroir local, donc il ne dit rien de ce qui part en base.

   Il verifie aussi le DECALAGE dans le calcul des dates, parce qu'un repere
   decale de trois semaines qui disparait du mois ou il tombe ne leve aucune
   erreur : il n'apparait simplement nulle part.

   IL DEMANDE jsdom :  npm install --save-dev jsdom
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
for (const f of ['bdv-calchoix.js', 'bdv-echeances.js']) {
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

function monter(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://lebureauduvigneron.fr/mon-bureau/',
    runScripts: 'dangerously', pretendToBeVisual: true
  });
  const w = dom.window;
  const etat = { appels: [], horsLigne: !!opts.horsLigne };
  w.BdvCompte = {
    monId: () => opts.sansSession ? null : 'moi',
    session: () => opts.sansSession ? null : { user: { id: 'moi' } },
    api: (chemin, o) => {
      o = o || {};
      etat.appels.push({ chemin, methode: o.methode || 'GET', corps: o.corps });
      if (etat.horsLigne) return Promise.reject(new Error('reseau'));
      return Promise.resolve((o.methode || 'GET') === 'GET' ? (opts.lignes || []) : null);
    }
  };
  const poser = (js, nom) => {
    const s = w.document.createElement('script');
    s.textContent = js;
    try { w.document.body.appendChild(s); }
    catch (e) { console.log('  ECHEC : ' + nom + ' leve -> ' + e.message); process.exit(1); }
  };
  poser(fs.readFileSync(path.join(JS, 'bdv-echeances.js'), 'utf8'), 'bdv-echeances.js');
  poser(fs.readFileSync(path.join(JS, 'bdv-calchoix.js'), 'utf8'), 'bdv-calchoix.js');
  etat.w = w;
  etat.C = w.BdvCalchoix;
  etat.E = w.BdvEcheances;
  etat.ecritures = () => etat.appels.filter(a => a.methode !== 'GET');
  return etat;
}
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

/* ==========================================================================
   1. NE PLUS SUIVRE UN REPERE
   ========================================================================== */
console.log('\n== 1. Ne plus suivre un repere ==');
{
  const t = monter();
  await dormir(30);
  dit(typeof t.C === 'object', 'BdvCalchoix est expose');
  dit(t.appels.some(a => a.methode === 'GET' && a.chemin.indexOf('/calendrier_choix?select=') === 0),
    'la page lit les choix du compte au chargement');

  dit(t.C.choix('taille').actif === true && t.C.choix('taille').decale === 0,
    'sans ligne, un repere est suivi et non decale : c\'est l\'etat par defaut du monde');

  t.appels.length = 0;
  t.C.eteindre('taille');
  await dormir(30);
  const e = t.ecritures();
  dit(e.length === 1 && e[0].methode === 'POST', 'eteindre ecrit une fois, en POST', e.length);
  dit(e.length === 1 && e[0].chemin === '/calendrier_choix?on_conflict=id,cle',
    'sur la cle (id, cle)', e.length && e[0].chemin);
  const l = e.length ? e[0].corps[0] : {};
  dit(l.id === 'moi', 'LA CHARGE PORTE L\'IDENTIFIANT DU COMPTE', JSON.stringify(l.id));
  dit(l.cle === 'taille' && l.actif === false, 'et dit que ce repere n\'est plus suivi');
  dit(t.C.choix('taille').actif === false, 'l\'ecran le sait tout de suite');
  dit(t.C.eteints().indexOf('taille') >= 0, 'et il est retrouvable pour etre rallume');
}

/* ==========================================================================
   2. RALLUMER SUPPRIME LA LIGNE
   ========================================================================== */
console.log('\n== 2. Rallumer supprime la ligne ==');
{
  const t = monter({ lignes: [{ cle: 'taille', actif: false, decale_de: 0 }] });
  await dormir(30);
  dit(t.C.choix('taille').actif === false, 'la ligne du serveur est lue');

  t.appels.length = 0;
  t.C.rallumer('taille');
  await dormir(30);
  const e = t.ecritures();
  /* UNE LIGNE NEUTRE NE DOIT PAS EXISTER. Suivi et non decale est l'etat par
     defaut : le stocker remplirait la table d'une ligne par occurrence et par
     compte, toutes sans information. Meme regle que decocher une obligation. */
  dit(e.length === 1 && e[0].methode === 'DELETE',
    'rallumer SUPPRIME la ligne au lieu d\'ecrire un etat neutre', e.length && e[0].methode);
  dit(e.length === 1 && e[0].chemin.indexOf('id=eq.moi') > 0 && e[0].chemin.indexOf('cle=eq.taille') > 0,
    'et la requete nomme les DEUX colonnes de la cle', e.length && e[0].chemin);
  dit(t.C.eteints().length === 0, 'il n\'est plus dans les eteints');
}

/* ==========================================================================
   3. DECALER UN REPERE
   ========================================================================== */
console.log('\n== 3. Decaler un repere ==');
{
  const t = monter();
  await dormir(30);
  t.appels.length = 0;
  t.C.decaler('vendanges', 7);
  await dormir(30);
  let l = t.ecritures()[0].corps[0];
  dit(l.decale_de === 7 && l.actif === true,
    'decaler garde le repere suivi', JSON.stringify([l.decale_de, l.actif]));

  t.C.decaler('vendanges', 7);
  await dormir(30);
  dit(t.C.choix('vendanges').decale === 14, 'les decalages s\'additionnent',
    t.C.choix('vendanges').decale);

  t.appels.length = 0;
  t.C.recaler('vendanges');
  await dormir(30);
  dit(t.ecritures()[0].methode === 'DELETE',
    'remettre a zero un repere suivi supprime aussi la ligne', t.ecritures()[0].methode);

  /* LA BORNE N'EST PAS DECORATIVE. La table la porte en `check`, mais une charge
     hors bornes serait rejetee par le serveur APRES que l'ecran a dit oui : le
     miroir et la base divergeraient en silence. On borne donc des l'ecriture. */
  t.C.decaler('vendanges', 9000);
  await dormir(30);
  dit(t.C.choix('vendanges').decale === 180,
    'un decalage aberrant est ramene a la borne de la table, pas envoye tel quel',
    t.C.choix('vendanges').decale);
  t.C.recaler('vendanges');
  await dormir(30);
  t.C.decaler('vendanges', -9000);
  await dormir(30);
  dit(t.C.choix('vendanges').decale === -180, 'et dans l\'autre sens',
    t.C.choix('vendanges').decale);
}

/* ==========================================================================
   4. LE DECALAGE DEPLACE VRAIMENT LA DATE
   ========================================================================== */
console.log('\n== 4. Le decalage deplace vraiment la date ==');
{
  const t = monter();
  await dormir(30);
  const regle = { cle: 'taille', titre: 'Taille', famille: 'travaux', statut: 'repere',
                  recurrence: { type: 'annuel', mois: 12, jour: 1, duree: 10 } };
  const du = new Date(2026, 11, 1), au = new Date(2026, 11, 31);

  const sans = t.E.etaler([regle], du, au);
  dit(sans.length === 1 && sans[0].debut.getDate() === 1,
    'sans decalage, la periode commence le 1er decembre',
    sans.length && sans[0].debut.getDate());

  const avec = t.E.etaler([Object.assign({}, regle, { decale: 14 })], du, au);
  dit(avec.length === 1 && avec[0].debut.getDate() === 15,
    'decalee de quatorze jours, elle commence le 15', avec.length && avec[0].debut.getDate());
  dit(avec.length === 1 && avec[0].fin.getDate() === 24,
    'et sa fin suit, la duree ne change pas', avec.length && avec[0].fin.getDate());

  /* LE PIEGE : decaler APRES avoir filtre la fenetre. Une occurrence poussee dans
     le mois depuis le mois d'avant doit y apparaitre, et une occurrence poussee
     hors du mois doit en sortir. Un filtre applique a la date d'origine ferait
     les deux erreurs a la fois, sans lever. */
  const versLeMois = t.E.etaler(
    [Object.assign({}, regle, { decale: 5, recurrence: { type: 'annuel', mois: 11, jour: 28, duree: 1 } })],
    du, au);
  dit(versLeMois.length === 1 && versLeMois[0].debut.getMonth() === 11,
    'un repere pousse depuis novembre entre bien en decembre', versLeMois.length);

  const horsDuMois = t.E.etaler([Object.assign({}, regle,
    { decale: 40, recurrence: { type: 'annuel', mois: 12, jour: 1, duree: 1 } })], du, au);
  dit(horsDuMois.length === 0,
    'et un repere pousse au-dela du mois en sort', horsDuMois.length);
}

/* ==========================================================================
   5. HORS LIGNE, PUIS REJEU
   ========================================================================== */
console.log('\n== 5. Hors ligne, puis rejeu ==');
{
  const t = monter({ horsLigne: true });
  await dormir(30);
  t.C.eteindre('taille');
  await dormir(30);
  dit(t.C.choix('taille').actif === false, 'le geste tient a l\'ecran malgre le reseau coupe');

  const file = JSON.parse(t.w.localStorage.getItem('bdv_calchoix_attente') || '{}');
  dit(!!file.taille, 'et il part dans la file d\'attente');
  /* LE DEFAUT DES SIGNETS, 07/09/2026 : une ligne enfilee avec l'identifiant du
     compte repart sous CET identifiant, meme si quelqu'un d'autre se connecte
     entre-temps. `id` se pose a l'envoi, jamais chez l'appelant. */
  dit(file.taille && file.taille.id === undefined,
    'LA FILE NE GARDE PAS L\'IDENTIFIANT DU COMPTE : il est pose a l\'envoi',
    JSON.stringify(file.taille));

  t.C.rallumer('taille');
  await dormir(30);
  const f2 = JSON.parse(t.w.localStorage.getItem('bdv_calchoix_attente') || '{}');
  dit(f2.taille === null,
    'une suppression part en suppression, et pas en ecriture vide : c\'est le defaut qui bloquait la file des signets',
    JSON.stringify(f2.taille));
}

/* ==========================================================================
   6. SANS SESSION, ET A LA DECONNEXION
   ========================================================================== */
console.log('\n== 6. Sans session, et a la deconnexion ==');
{
  const t = monter({ sansSession: true });
  await dormir(30);
  dit(t.appels.length === 0, 'aucune requete ne part sans compte', t.appels.length);
  t.C.eteindre('taille');
  await dormir(30);
  dit(t.ecritures().length === 0, 'et un geste hors compte n\'ecrit rien non plus');
  dit(t.C.choix('taille').actif === false, 'mais il tient a l\'ecran, et il attend');
}
{
  const t = monter({ lignes: [{ cle: 'taille', actif: false, decale_de: 0 }] });
  await dormir(30);
  dit(t.C.choix('taille').actif === false, 'un choix est en place');
  t.w.BdvCompte.monId = () => null;          // il se deconnecte
  t.w.document.dispatchEvent(new t.w.CustomEvent('bdv:session'));
  await dormir(30);
  /* Le compte a change : ce que le precedent ne suivait pas n'a aucune raison de
     rester cache chez le suivant. Meme regle que le miroir des taches. */
  dit(t.C.choix('taille').actif === true,
    'la deconnexion vide le miroir : les choix du precedent ne sont pas les siens');
}

/* ==========================================================================
   7. LA FILE D'UN AUTRE COMPTE NE SE REJOUE PAS
   ==========================================================================
   DEFAUT TROUVE PAR CE BANC LE 08/09/2026, et il n'etait pas dans le plan.
   `id` pose a l'envoi protege d'une premiere fuite : une ligne enfilee ne repart
   pas sous un compte fige. Mais il en cause exactement une seconde : Ted eteint
   un repere hors ligne, se deconnecte, un collegue se connecte sur le meme
   navigateur, et le rejeu ecrit le choix de Ted SUR LE COMPTE DU COLLEGUE.
   La file se souvient donc de qui l'a remplie, et une file etrangere se jette.
   ========================================================================== */
console.log('\n== 7. La file d\'un autre compte ne se rejoue pas ==');
{
  const t = monter({ horsLigne: true });
  await dormir(30);
  t.C.eteindre('taille');
  await dormir(30);
  dit(!!JSON.parse(t.w.localStorage.getItem('bdv_calchoix_attente') || '{}').taille,
    'un geste hors ligne attend dans la file');
  dit(t.w.localStorage.getItem('bdv_calchoix_attente_qui') === 'moi',
    'et la file se souvient du compte qui l\'a remplie',
    t.w.localStorage.getItem('bdv_calchoix_attente_qui'));

  t.horsLigne = false;
  t.w.BdvCompte.monId = () => 'un-collegue';   // quelqu'un d'autre se connecte
  t.appels.length = 0;
  t.w.document.dispatchEvent(new t.w.CustomEvent('bdv:session'));
  await dormir(40);
  dit(t.ecritures().length === 0,
    'LE CHOIX DE L\'UN NE PART PAS SUR LE COMPTE DE L\'AUTRE',
    JSON.stringify(t.ecritures()));
  dit(t.w.localStorage.getItem('bdv_calchoix_attente') === null,
    'la file etrangere est jetee, pas gardee pour plus tard');
  dit(t.appels.some(a => a.methode === 'GET'),
    'et le nouveau compte lit bien les siens');
}

{
  /* Le cas inverse doit continuer de marcher : la MEME personne qui retrouve du
     reseau rejoue sa file. Sans ce controle, le garde-fou ci-dessus pourrait
     tout jeter et personne ne s'en apercevrait. */
  const t = monter({ horsLigne: true });
  await dormir(30);
  t.C.eteindre('taille');
  await dormir(30);
  t.horsLigne = false;
  t.appels.length = 0;
  t.w.document.dispatchEvent(new t.w.CustomEvent('bdv:session'));
  await dormir(40);
  const e = t.ecritures();
  dit(e.length === 1 && e[0].corps[0].cle === 'taille' && e[0].corps[0].id === 'moi',
    'la meme personne, elle, rejoue sa file au retour du reseau',
    JSON.stringify(e.map(x => x.methode + ' ' + x.chemin)));
}

/* ==========================================================================
   VERDICT
   ========================================================================== */
console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) { console.log('  LES CHOIX DE CALENDRIER N\'ECRIVENT PAS CE QU\'ILS DISENT\n'); process.exit(1); }
console.log('  LES CHOIX DE CALENDRIER ECRIVENT CE QU\'ILS DISENT\n');
