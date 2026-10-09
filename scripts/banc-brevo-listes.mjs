/* ============================================================================
   BANC DES LISTES VERS BREVO, lot 89, 09/10/2026
   ============================================================================
   Ce qu'il garde :
   - le bouton n'existe que si Brevo est branche ;
   - une liste n'emporte QUE l'adresse et le mobile : ni nom, ni chiffre, ni note ;
   - le mobile vient de la colonne Mobile, jamais du fixe ; un 04 francais dans la colonne Mobile
     ne part pas ; un etranger sans indicatif ne part pas ; la ligne la plus recente l'emporte ;
   - un nouveau client en opposition ne part jamais ; son seul numero ne part que s'il est un 06/07 ;
   - recul confirme et etiquette « Gros client » (casse et accents libres) ecartes d'office,
     une case les remet ; un client a la fois en recul et gros ne part qu'avec les deux cases ;
   - le serveur lit la liste noire AVANT de creer la liste, n'envoie que email et SMS, ne pose
     aucun drapeau de liste noire, et s'arrete si le carnet ne se lit pas en entier ;
   - « Mes clients » et « Mon commerce » ont le bouton, et prennent la liste vue.
   Les fonctions de lecture d'adresse et de numero sont celles de bdv-base.js, extraites telles quelles.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
let ok = 0, ko = 0;
const dit = (b, m, det) => { if (b) { ok++; console.log('  ok    : ' + m); } else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + det : '')); } };
const pause = (n) => new Promise(r => setTimeout(r, n || 40));
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const B = 'b0000000-0000-0000-0000-000000000001';

/* Les vraies fonctions de bdv-base.js : des adresses aux numeros, et l'identite d'un client. */
const BASE = lire('src/js/bdv-base.js');
const morceau = (debut, fin) => { const i = BASE.indexOf(debut), j = BASE.indexOf(fin, i); if (i < 0 || j < 0) throw new Error('introuvable : ' + debut); return BASE.slice(i, j); };
const TELS = morceau('const RE_EMAIL=', '\n/* ======================= REGLAGES DU DOMAINE');
const IDENT = morceau('function clientKey(r)', '\nfunction buildEmailIndex');

function monter(o) {
  o = o || {};
  const dom = new JSDOM('<!doctype html><body><div id="z" hidden></div><button id="b">Vers Brevo</button></body>', { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window;
  const fonctions = [], appels = [];
  w.eval(TELS + '\n' + IDENT + '\nwindow.parseTels=parseTels;window.parseEmails=parseEmails;window.clientKey=clientKey;');
  w.ROWS = o.rows || [];
  w.EMAILS = o.emails || {};
  w.emailOf = (id) => (w.EMAILS[id] || [])[0] || '';
  w.CRM = o.crm || {};
  w.agentDecrochage = () => ({ decroche: (o.recul || []).map((id) => ({ id })) });
  w.lignesPretes = () => o.lignes !== false;
  w.bdvNouveaux = { get: (id) => (o.pistes || {})[id] || null, lie: (num) => (o.lies || {})[num] || null };
  w.BdvBrevo = { _etat: () => ({ LU: true, BREVO: o.sansBrevo ? null : { etat: 'branche' } }), charger: () => Promise.resolve() };
  w.BdvCompte = {
    monBureau: () => B,
    api: (chemin, x) => { appels.push({ chemin, x }); return Promise.resolve(o.histo || []); },
    fonction: (nom, c) => {
      fonctions.push({ nom, c });
      if (o.reponse === 'panne') return Promise.reject(Object.assign(new Error('500'), { status: 500 }));
      if (o.reponse === 'refus400') return Promise.reject(Object.assign(new Error('400'), { status: 400 }));
      if (o.reponse) return Promise.resolve(o.reponse);
      const n = (c.contacts || []).length;
      return Promise.resolve({ resultat: 'creee', nom: c.nom, envoyes: n - 1, ecartes: 1,
        avec_mail: c.contacts.filter((x) => x.e).length, avec_mobile: c.contacts.filter((x) => x.s).length });
    }
  };
  const s = w.document.createElement('script');
  s.textContent = lire('src/js/bdv-brevo-listes.js');
  w.document.body.appendChild(s);
  return { w, d: w.document, fonctions, appels };
}

const r = (id, o) => Object.assign({ numClient: id, client: 'Client ' + id, pays: 'France', _dayNum: 100 }, o);

console.log('\n1. Le bouton n\'existe que si Brevo est branche');
{
  const a = monter({ sansBrevo: true });
  dit(a.w.BdvBrevoListes.pret() === false, 'sans Brevo : pas pret');
  const b = monter();
  dit(b.w.BdvBrevoListes.pret() === true, 'Brevo branche : pret');
}

console.log('\n2. Ce qui part pour chaque client');
{
  const rows = [
    r('1', { mobile: '06 12 34 56 78' }),
    r('2', { mobile: '04 94 12 34 56' }),                          // un fixe dans la colonne Mobile
    r('3', { mobile: '+41 79 123 45 67', pays: 'Suisse' }),
    r('4', { mobile: '079 123 45 67', pays: 'Suisse' }),           // etranger sans indicatif
    r('5', { mobile: '06 00 00 00 01', _dayNum: 50 }), r('5', { mobile: '07 11 22 33 44', _dayNum: 90 }),
    r('6', { fixe: '06 99 99 99 99' }),                            // un 06 range dans le Fixe : on ne lit pas le fixe
    r('7', {}),
  ];
  const a = monter({ rows, emails: { '1': ['un@clos.fr'], '7': ['sept@clos.fr'] },
    pistes: { 'p:a': { email: 'Piste@Cave.fr', telephone: '06 55 44 33 22', pays: '' },
              'p:b': { email: '', telephone: '04 78 00 00 00' },
              'p:c': { email: 'non@cave.fr', telephone: '06 01 02 03 04', opposition: true } } });
  const c = a.w.BdvBrevoListes._calculer(['1', '2', '3', '4', '5', '6', '7', 'p:a', 'p:b', 'p:c']);
  const par = Object.fromEntries(c.bons.map((x) => [x.id, x]));
  dit(par['1'] && par['1'].e === 'un@clos.fr' && par['1'].s === '+33612345678', 'adresse et mobile 06 au format international', JSON.stringify(par['1']));
  dit(!par['2'], 'un 04 dans la colonne Mobile ne part pas (et sans adresse, le client non plus)');
  dit(par['3'] && par['3'].s === '+41791234567', 'un mobile etranger AVEC indicatif part');
  dit(!par['4'], 'un etranger sans indicatif ne part pas : on n\'invente pas l\'indicatif');
  dit(par['5'] && par['5'].s === '+33711223344', 'la ligne la plus recente donne le mobile', par['5'] && par['5'].s);
  dit(!par['6'], 'le fixe n\'est jamais lu comme mobile');
  dit(par['7'] && par['7'].e === 'sept@clos.fr' && !par['7'].s, 'une adresse sans mobile part seule');
  dit(par['p:a'] && par['p:a'].e === 'piste@cave.fr' && par['p:a'].s === '+33655443322', 'nouveau client : adresse en minuscules, 06 garde');
  dit(!par['p:b'], 'nouveau client : un fixe ne part pas');
  dit(!par['p:c'] && c.opposition === 1, 'nouveau client en opposition : ne part jamais, et compte a part');
  dit(c.sans === 4 && c.total === 10, 'les clients sans rien sont comptes', c.sans + '/' + c.total);
  const cles = new Set(); c.bons.forEach((x) => Object.keys(x).forEach((k) => cles.add(k)));
  dit([...cles].every((k) => ['id', 'e', 's', 'recul', 'gros'].includes(k)), 'aucun nom ni chiffre dans le calcul', [...cles].join(','));
}

console.log('\n3. Ecartes d\'office, et la case qui les remet');
{
  const em = { '1': ['a@x.fr'], '2': ['b@x.fr'], '3': ['c@x.fr'], '4': ['d@x.fr'], '5': ['e@x.fr'] };
  const a = monter({ emails: em, recul: ['2', '4'],
    crm: { '3': { tags: ['Gros Client'] }, '4': { tags: ['gros clients'] }, '5': { tags: ['Grôs client'] } } });
  const z = a.d.getElementById('z');
  a.w.BdvBrevoListes.ouvrir({ cible: z, source: 'clients', titre: 'Mes clients', ids: ['1', '2', '3', '4', '5'], bouton: a.d.getElementById('b') });
  await pause();
  const resume = () => z.querySelector('.bdvbl-resume').textContent;
  dit(!z.hidden && /^1 contact à mettre dans la liste/.test(resume()), 'par defaut : recul et gros (accents et casse libres) ecartes, 1 reste', resume());
  dit(/2 clients en recul confirmé/.test(z.textContent) && /3 clients avec l’étiquette « Gros client »/.test(z.textContent), 'les deux ecarts sont dits avec leur nombre', z.textContent.slice(0, 400));
  const cocher = (id) => { const c = a.d.getElementById(id); c.checked = true; c.dispatchEvent(new a.w.Event('change', { bubbles: true })); };
  cocher('bdvblRecul');
  dit(/^2 contacts à mettre dans la liste/.test(resume()), 'recul remis : le client a la fois en recul et gros reste dehors', resume());
  cocher('bdvblGros');
  dit(/5 contacts à mettre dans la liste/.test(resume()), 'les deux cases : tout le monde', resume());
  dit(a.d.activeElement && a.d.activeElement.id === 'bdvblGros', 'le focus reste sur la case cochee');
}

console.log('\n4. Creer la liste : ce qui part au serveur, et ce qu\'on dit');
{
  const a = monter({ emails: { '1': ['a@x.fr'], '2': ['b@x.fr'] }, rows: [r('2', { mobile: '0611111111' })],
    histo: [{ id: 1, le: '2026-10-09T08:00:00Z', nom: 'Salon', envoyes: 12, process_id: 77 }] });
  const z = a.d.getElementById('z');
  a.w.BdvBrevoListes.ouvrir({ cible: z, source: 'commerce', titre: 'Sa saison arrive', ids: ['1', '2'] });
  await pause();
  const nom = a.d.getElementById('bdvblNom');
  dit(/^Sa saison arrive - \d\d\/\d\d\/\d{4} \d\dh\d\d$/.test(nom.value), 'nom propose : source et date', nom.value);
  dit(/Salon/.test(z.textContent) && z.querySelector('[data-process="77"]'), 'les dernieres listes du bureau sont montrees');
  dit(a.appels.every((x) => !x.x || !x.x.methode), 'la page n\'ecrit rien en base elle-meme');
  a.d.getElementById('bdvblCreer').click();
  await pause();
  const f = a.fonctions.find((x) => x.c.action === 'liste');
  dit(f && f.nom === 'brevo' && f.c.bureau === B && f.c.source === 'commerce', 'un appel a la fonction brevo, action liste, avec le bureau et la source');
  dit(f && f.c.contacts.length === 2 && f.c.contacts.every((x) => Object.keys(x).every((k) => k === 'e' || k === 's')), 'chaque contact n\'emporte que e et s', f && JSON.stringify(f.c.contacts));
  dit(f && f.c.contacts[1].s === '+33611111111', 'le mobile part au format international');
  const mot = z.querySelector('.bdvbl-mot');
  dit(mot && !mot.hidden && /créée dans Brevo/.test(mot.textContent) && /1 désinscrit écarté/.test(mot.textContent) && /campagne/.test(mot.textContent), 'le resultat dit la liste, les desinscrits ecartes et la suite', mot && mot.textContent);
  dit(/Le bureau n’envoie rien|le bureau n’envoie rien/.test(z.textContent), 'l\'ecran dit que le bureau n\'envoie aucune campagne');

  z.querySelector('[data-process="77"]').click();
  await pause();
  const e = a.fonctions.find((x) => x.c.action === 'liste_etat');
  dit(e && e.c.process === 77, '« Ou en est-elle ? » demande l\'etat de l\'import');
}
{
  const a = monter({ emails: { '1': ['a@x.fr'] }, reponse: 'panne' });
  const z = a.d.getElementById('z');
  a.w.BdvBrevoListes.ouvrir({ cible: z, source: 'clients', titre: 'Mes clients', ids: ['1'] });
  a.d.getElementById('bdvblCreer').click();
  await pause();
  const mot = z.querySelector('.bdvbl-mot');
  dit(/Regarde dans Brevo/.test(mot.textContent) && !/Rien n’est parti/.test(mot.textContent) && /alerte/.test(mot.className), 'une reponse perdue ne pretend pas que rien n\'est parti', mot.textContent);
  dit(!a.d.getElementById('bdvblCreer').disabled, 'le bouton revient');
}
{
  const a = monter({ emails: { '1': ['a@x.fr'] }, reponse: { resultat: 'carnet_trop_long', mot: 'Le carnet Brevo est trop grand pour être relu à temps.' } });
  const z = a.d.getElementById('z');
  a.w.BdvBrevoListes.ouvrir({ cible: z, source: 'clients', titre: 'Mes clients', ids: ['1'] });
  a.d.getElementById('bdvblCreer').click();
  await pause();
  dit(/trop grand/.test(z.querySelector('.bdvbl-mot').textContent), 'le mot du serveur est rendu tel quel');
}
{
  const a = monter({ emails: {} });
  const z = a.d.getElementById('z');
  a.w.BdvBrevoListes.ouvrir({ cible: z, source: 'clients', titre: 'Mes clients', ids: ['1'] });
  dit(a.d.getElementById('bdvblCreer').disabled, 'personne de joignable : le bouton est inactif');
  const em = {}; const ids = []; for (let i = 0; i < 5001; i++) { em[String(i)] = ['c' + i + '@x.fr']; ids.push(String(i)); }
  const b = monter({ emails: em });
  const z2 = b.d.getElementById('z');
  b.w.BdvBrevoListes.ouvrir({ cible: z2, source: 'clients', titre: 'Mes clients', ids });
  b.d.getElementById('bdvblCreer').click();
  await pause();
  dit(!b.fonctions.length && /5 000/.test(z2.querySelector('.bdvbl-mot').textContent), 'plus de 5 000 : rien ne part, on le dit');
  const c = monter({ emails: { '1': ['a@x.fr'] }, lignes: false });
  const z3 = c.d.getElementById('z');
  c.w.BdvBrevoListes.ouvrir({ cible: z3, source: 'clients', titre: 'Mes clients', ids: ['1'] });
  dit(/pas toutes chargées/.test(z3.textContent), 'ventes pas chargees : l\'ecran previent que des contacts peuvent manquer');
  c.d.getElementById('bdvblFermer').click();
  dit(z3.hidden && z3.textContent === '', 'Fermer vide le bloc');
}

{
  const a = monter({ emails: { '1': ['a@x.fr'] }, reponse: 'refus400' });
  const z = a.d.getElementById('z');
  a.w.BdvBrevoListes.ouvrir({ cible: z, source: 'clients', titre: 'Mes clients', ids: ['1'] });
  a.d.getElementById('bdvblCreer').click();
  await pause();
  dit(/Rien n’est parti/.test(z.querySelector('.bdvbl-mot').textContent), 'un refus net (4xx) : rien n\'est parti');
}
{
  const a = monter({ emails: { '9': ['relie@x.fr'] }, lies: { '9': { opposition: true } } });
  const c = a.w.BdvBrevoListes._calculer(['9']);
  dit(!c.bons.length && c.opposition === 1, 'un nouveau client relie a Vitisoft garde son opposition');
}
{
  let vus = ['1', '2'];
  const a = monter({ emails: { '1': ['a@x.fr'], '2': ['b@x.fr'], '3': ['c@x.fr'] } });
  const z = a.d.getElementById('z');
  a.w.BdvBrevoListes.ouvrir({ cible: z, source: 'clients', titre: 'Mes clients', ids: () => vus });
  vus = ['1', '2', '3']; a.d.activeElement.blur(); a.w.BdvBrevoListes.rafraichir();
  dit(/^3 contacts/.test(z.querySelector('.bdvbl-resume').textContent), 'les filtres bougent : le bloc recompte');
  a.d.getElementById('bdvblNom').focus();
  vus = ['1']; a.w.BdvBrevoListes.rafraichir();
  a.d.getElementById('bdvblCreer').click();
  await pause();
  dit(!a.fonctions.length && /a changé/.test(z.querySelector('.bdvbl-mot').textContent) && /^1 contact/.test(z.querySelector('.bdvbl-resume').textContent),
    'liste changee pendant qu\'on tape : rien ne part, on montre les nouveaux nombres');
}

console.log('\n5. La fonction Edge');
{
  const f = lire('supabase/functions/brevo/index.ts');
  const corps = f.slice(f.indexOf('async function liste('), f.indexOf('/* Ou en est l\'import'));
  dit(corps.indexOf('listeNoire(') > 0 && corps.indexOf('listeNoire(') < corps.indexOf("'/contacts/lists'"), 'la liste noire est lue AVANT de creer la liste');
  dit(corps.indexOf("brevo_est_membre") > 0 && corps.indexOf("brevo_est_membre") < corps.indexOf('listeNoire('), 'le membre est verifie avant Brevo');
  dit(/\{ email: c\.e, attributes: c\.s \? \{ SMS: c\.s \} : \{\} \}/.test(corps) && /\{ attributes: \{ SMS: c\.s \} \}/.test(corps), 'n\'envoie que l\'adresse et l\'attribut SMS');
  dit(!/emailBlacklist|smsBlacklist/.test(corps), 'aucun drapeau de liste noire n\'est pose a l\'import');
  dit(/disableNotification: true/.test(corps) && /emptyContactsAttributes: false/.test(corps), 'import sans mail de notification et sans effacer d\'attribut');
  dit(/'trop' in noire/.test(corps) && corps.indexOf("'trop' in noire") < corps.indexOf("'/contacts/lists'"), 'carnet pas lu en entier : rien ne part');
  dit(/c\.emailBlacklisted !== true && c\.smsBlacklisted !== true/.test(f), 'desinscrit des mails OU des SMS : ecarte');
  dit(/action === 'liste' \? 400000/.test(f), 'la limite de taille est relevee pour la seule action liste');
  dit(/brevo_liste_permise/.test(corps), 'le plafond de 20 listes par jour est demande');
  dit(/total >= 0 && lus < total\) \? \{ trop: true as const \}/.test(f), 'carnet lu moins long que ce que Brevo annonce : rien ne part');
  dit(/noire\.sms\.has\(cleSms\(c\.s\)\)/.test(corps) && /sms\.add\(n\)/.test(f) && /const n = cleSms\(a\.SMS\)/.test(f), 'les numeros se comparent sous une meme forme');
  dit(!/r\.brut|\.message\b/.test(corps.replace(/motDuRefus\(r\.statut, r\.brut\)/g, '')), 'aucun texte de Brevo renvoye');
}

console.log('\n6. Les deux pieces ont le bouton');
{
  const an = lire('src/js/bdv-annuaire.js'), ec = lire('src/js/bdv-ecrans.js'), mb = lire('src/mon-bureau.njk');
  dit(/data-a="brevo"/.test(an) && /data-a="brevo-sel"/.test(an) && /id="annuBrevo"/.test(an), 'Mes clients : liste filtree et selection');
  dit(/BdvBrevoListes\.ouvrir\(\{ cible: z, source: 'clients'/.test(an) && /return FILTREE\.map/.test(an), 'Mes clients : la liste filtree est celle qui part');
  dit(/id="clientsVersBrevo"/.test(ec) && /source:'commerce'/.test(ec) && /function idsCommerceVisibles/.test(ec), 'Mon commerce : la liste vue');
  dit(/FILTRES\.clientsBody/.test(ec.slice(ec.indexOf('function idsCommerceVisibles'))), 'Mon commerce : recherche et « joignables » rejouees');
  dit(mb.indexOf('bdv-brevo.js') > 0 && mb.indexOf('bdv-brevo-listes.js') > mb.indexOf('bdv-brevo.js'), 'le script est charge apres bdv-brevo.js');
}

console.log('\nBANC DES LISTES BREVO : ' + ok + ' ok, ' + ko + ' echec(s)');
process.exit(ko ? 1 : 0);
