/* ============================================================================
   scripts/banc-signature.mjs : LA SIGNATURE EN LIGNE, lot 55 (01/10/2026)
   ============================================================================
       npm run banc:signature     (lit les SOURCES, pas _site : aucun build requis)

   1. LA PAGE /signer/ (src/signer.njk + src/js/bdv-signer.js), dans jsdom avec une
      fausse fonction `signature` : le jeton est lu apres le #, la copie s'affiche dans
      une iframe SANS script, le client est VOUVOYE, l'empreinte montree repart avec la
      signature, chaque refus de la base se dit sous le bon champ, et rien ne se dit
      « signe » sans que la fonction l'ait rendu.
   2. LA FONCTION EDGE (supabase/functions/signature/index.ts), lue : elle ne parle qu'aux deux
      fonctions de la base, garde la PREMIERE valeur de x-forwarded-for, borne ce qu'elle
      recoit, et n'envoie aucun mail.
   3. LE BUREAU (src/js/bdv-affaires-jour.js) : la punaise d'un devis signe tant que sa
      commande n'est pas telechargee, le bandeau une seule fois, « Ouvrir le devis ».
   La base, elle, est gardee par supabase/banc-lot55-signature.sql.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
let OK = 0, KO = 0;
const t = (nom, v, detail) => {
  if (v) { OK++; console.log('  ok    : ' + nom); }
  else { KO++; console.log('  ECHEC : ' + nom + (detail !== undefined ? '  ->  ' + detail : '')); }
};
const titre = s => console.log('\n== ' + s + ' ==');
const attendre = (ms) => new Promise(r => setTimeout(r, ms || 0));
process.on('unhandledRejection', (e) => { KO++; console.log('  ECHEC : promesse rejetee sans prise : ' + (e && e.message)); });

const JETON = 'ab'.repeat(32);
const PAPIER = '<!doctype html><html><head><title>Devis D-2026-0012</title></head><body><p>Muscadet, 12 bouteilles</p></body></html>';
const EMP = 'c0ffee'.repeat(10) + 'c0ff';

/* ---------------------------------------------------------------------------- */
const NJK = lire('src/signer.njk');
const CORPS = NJK.replace(/^---[\s\S]*?---/, '').replace(/\{#[\s\S]*?#\}/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
const SRC = lire('src/js/bdv-signer.js');

function page(o) {
  o = o || {};
  const dom = new JSDOM('<!doctype html><html><body>' + CORPS + '</body></html>',
    { runScripts: 'outside-only', url: 'https://lebureauduvigneron.fr/signer/' + (o.hash === undefined ? '#' + JETON : o.hash), pretendToBeVisual: true });
  const w = dom.window;
  const X = { w, doc: w.document, appels: [] };
  w.fetch = async (url, init) => {
    X.appels.push({ url: String(url), init: init || {}, corps: init && init.body ? JSON.parse(init.body) : null });
    await attendre(0);
    if (o.panne) throw new TypeError('Failed to fetch');
    const post = init && init.method === 'POST';
    const r = post ? (typeof o.post === 'function' ? o.post(X.appels[X.appels.length - 1].corps) : o.post) : o.get;
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(r)) };
  };
  w.eval(SRC);
  X.texte = () => X.doc.body.textContent.replace(/\s+/g, ' ');
  return X;
}
const A_SIGNER = { etat: 'a_signer', numero: 'D-2026-0012', vendeur: 'EARL Domaine Un', vendeur_email: 'contact@un.fr', client: 'Cave du Quai',
  total_ht_c: 15000, total_ttc_c: 18000, valable_jusqu: '2026-10-31', empreinte: EMP, papier: PAPIER };

titre('1. La page /signer/');
{
  const X = page({ hash: '' });
  await attendre(10);
  t('sans jeton : « Ce lien est incomplet », et rien n\'est demande', /Ce lien est incomplet/.test(X.texte()) && X.appels.length === 0);
}
{
  const X = page({ hash: '#j=' + JETON.toUpperCase(), get: { etat: 'inconnu' } });
  await attendre(10);
  t('le jeton se lit apres le # (avec ou sans « j= », en majuscules ou non) et part en GET', X.appels.length === 1 && X.appels[0].url.endsWith('?j=' + JETON));
  t('jeton inconnu : la phrase dit quoi faire, sans rien montrer d\'autre', /Ce lien ne correspond à aucun devis/.test(X.texte()) && X.doc.getElementById('sigDevis').hidden);
}
{
  const X = page({ panne: true });
  await attendre(10);
  t('panne : « Le devis n’a pas pu s’ouvrir », jamais un faux etat', /Le devis n’a pas pu s’ouvrir/.test(X.texte()));
}
{
  const X = page({ get: Object.assign({}, A_SIGNER, { etat: 'expire', papier: null }) });
  await attendre(10);
  t('expire : la date et le contact du domaine', /Ce devis a expiré/.test(X.texte()) && /31 octobre 2026/.test(X.texte()) && /contact@un\.fr/.test(X.texte()));
}
{
  const X = page({ get: Object.assign({}, A_SIGNER, { etat: 'clos', papier: null }) });
  await attendre(10);
  t('clos : « n’est plus à signer »', /n’est plus à signer/.test(X.texte()) && X.doc.getElementById('sigForm').hidden);
}
{
  let corpsPost = null;
  const X = page({ get: A_SIGNER, post: (c) => { corpsPost = c;
    if (c.nom.length < 2) return { etat: 'a_signer', refus: 'nom' };
    return Object.assign({}, A_SIGNER, { etat: 'signe', signe_le: '2026-10-01T12:05:00Z', signe_nom: c.nom, signe_qualite: c.qualite }); } });
  await attendre(10);
  const f = X.doc.getElementById('sigFeuille');
  t('a signer : le vendeur, le numero, le client, HT et TTC, et la validite', /EARL Domaine Un vous a envoyé le devis D-2026-0012 pour Cave du Quai/.test(X.texte())
    && /150,00\s€ HT/.test(X.texte()) && /180,00\s€ TTC/.test(X.texte()) && /Valable jusqu’au 31 octobre 2026/.test(X.texte()), X.texte().slice(0, 300));
  t('la copie s\'affiche dans une iframe sandbox SANS allow-scripts, son texte exact', !!f && f.getAttribute('sandbox') === 'allow-same-origin allow-modals'
    && !/allow-scripts/.test(f.getAttribute('sandbox')) && f.getAttribute('srcdoc') === PAPIER);
  t('l\'empreinte est montree', /Empreinte numérique du devis : c0ff eec0 ffee c0ff/.test(X.texte()), X.doc.getElementById('sigEmpreinte').textContent);
  t('on signe « au nom de » l\'entreprise, et la page dit « professionnels »', /au nom de Cave du Quai/.test(X.texte()) && /professionnels/.test(X.texte()));
  t('l\'information RGPD est donnee AVANT de signer : nom, fonction, date, empreinte, IP, navigateur',
    /adresse IP/.test(X.doc.getElementById('sigForm').textContent) && /navigateur/.test(X.doc.getElementById('sigForm').textContent)
    && /preuve de votre accord/.test(X.doc.getElementById('sigForm').textContent));
  t('le client est vouvoye : aucun « tu », « ton », « ta », « tes » dans la page', !/\b(tu|ton|ta|tes|toi)\b/i.test(X.texte()), (X.texte().match(/\b(tu|ton|ta|tes|toi)\b/i) || [])[0]);
  t('aucun tiret cadratin', !/—/.test(NJK + SRC));
  const form = X.doc.getElementById('sigForm');
  const soumettre = () => form.dispatchEvent(new X.w.Event('submit', { bubbles: true, cancelable: true }));
  soumettre(); await attendre(10);
  t('sans nom : refuse avant de partir, sous le champ, avec le focus', X.appels.length === 1 && /Indiquez votre nom/.test(X.doc.getElementById('sigErreur').textContent)
    && X.doc.activeElement === X.doc.getElementById('sigNom') && X.doc.getElementById('sigNom').getAttribute('aria-invalid') === 'true');
  X.doc.getElementById('sigNom').value = 'Jean Dupont';
  X.doc.getElementById('sigQualite').value = 'Gérant';
  soumettre(); await attendre(10);
  t('case non cochee : refuse avant de partir', X.appels.length === 1 && /Bon pour accord/.test(X.doc.getElementById('sigErreur').textContent));
  X.doc.getElementById('sigAccord').checked = true;
  soumettre(); await attendre(20);
  t('la signature part en POST avec le jeton, le nom, la qualite, l\'accord et l\'EMPREINTE MONTREE', X.appels.length === 2 && X.appels[1].init.method === 'POST'
    && corpsPost.j === JETON && corpsPost.nom === 'Jean Dupont' && corpsPost.qualite === 'Gérant' && corpsPost.accord === true && corpsPost.empreinte === EMP, JSON.stringify(corpsPost));
  t('signe : « Devis signé le 1er octobre 2026 à 14 h 05 par Jean Dupont (Gérant) », le formulaire part', /Devis signé le 1er octobre 2026 à 14 h 05 par Jean Dupont \(Gérant\)/.test(X.texte())
    && X.doc.getElementById('sigForm').hidden && X.doc.activeElement === X.doc.getElementById('sigIntro'), X.texte().slice(0, 300));
}
{
  const X = page({ get: A_SIGNER, post: { etat: 'a_signer', refus: 'empreinte' } });
  await attendre(10);
  X.doc.getElementById('sigNom').value = 'Jean Dupont'; X.doc.getElementById('sigQualite').value = 'Gérant'; X.doc.getElementById('sigAccord').checked = true;
  X.doc.getElementById('sigForm').dispatchEvent(new X.w.Event('submit', { bubbles: true, cancelable: true })); await attendre(20);
  t('empreinte refusee : la page recharge le devis au lieu de dire « signe »', X.appels.length === 3 && !X.appels[2].init.method && !/Devis signé/.test(X.texte()));
}
{
  const X = page({ get: A_SIGNER, post: { erreur: 'panne' } });
  await attendre(10);
  X.doc.getElementById('sigNom').value = 'Jean Dupont'; X.doc.getElementById('sigQualite').value = 'Gérant'; X.doc.getElementById('sigAccord').checked = true;
  X.doc.getElementById('sigForm').dispatchEvent(new X.w.Event('submit', { bubbles: true, cancelable: true })); await attendre(20);
  t('la fonction tombe : « Rien n’a été signé », jamais l\'inverse', /Rien n’a été signé/.test(X.doc.getElementById('sigErreur').textContent) && !/Devis signé/.test(X.texte()));
}
t('la page est hors index et hors collections', /noindex: true/.test(NJK) && /eleventyExcludeFromCollections: true/.test(NJK));

titre('2. La fonction Edge');
{
  const F = lire('supabase/functions/signature/index.ts');
  const code = F.replace(/\/\*[\s\S]*?\*\//g, '');
  t('elle n\'appelle que signature_lire et signature_poser', (code.match(/rpc\('([a-z_]+)'/g) || []).sort().join() === "rpc('signature_lire',rpc('signature_poser'");
  t('aucun mail ne part d\'ici (ni Resend ni smtp)', !/resend|smtp|mailto/i.test(code));
  t('le jeton est verifie (64 hexadecimaux) avant d\'appeler la base', /\^\[0-9a-f\]\{64\}\$/.test(code) && /if \(!JETON\.test\(j\)\) return reponse\(\{ etat: 'inconnu' \}\)/.test(code));
  t('l\'IP est la PREMIERE valeur de x-forwarded-for', /x-forwarded-for[\s\S]*split\(','\)\[0\]/.test(code));
  t('ce qu\'elle recoit est borne (4000 octets, nom et qualite coupes)', /brut\.length > 4000/.test(code) && /texte\(c\.nom, 200\)/.test(code));
  t('l\'accord n\'est vrai que s\'il vaut true, pas une chaine', /p_accord: c\.accord === true/.test(code));
  t('la panne ne renvoie qu\'un mot, le detail reste au journal', /console\.error\('signature'/.test(code) && /erreur: 'panne'/.test(code));
}

titre('3. Le bureau : punaise et bandeau');
{
  const dom = new JSDOM('<!doctype html><html><body><p class="bureau-avis" id="bureauAvis" hidden></p><div class="postit" data-cle="x"></div></body></html>',
    { runScripts: 'outside-only', url: 'https://lebureauduvigneron.fr/mon-bureau/', pretendToBeVisual: true });
  const w = dom.window, req = [];
  let SIG = [{ devis_id: 'dv1', affaire_id: 'af1', numero: 'D-2026-0012', signe_le: '2026-10-01T12:05:00Z', total_ht_c: 15000, acheteur: { nom: 'Cave du Quai' } }];
  w.BdvCompte = { monBureau: () => 'B1', api: async (c) => { req.push(c); await attendre(0);
    if (/^\/devis\?/.test(c)) return SIG.map(x => Object.assign({}, x));
    if (/^\/affaires\?/.test(c)) return []; if (/^\/affaire_types\?/.test(c)) return []; return []; } };
  let piece = 0;
  w.BdvNav = { afficher: () => { piece++; } };
  w.eval(lire('src/js/bdv-affaires-jour.js'));
  await w.BdvAffairesJour.charger(); await attendre(10);
  const q = req.find(c => /^\/devis\?/.test(c)) || '';
  t('la lecture : devis acceptes, signes, commande pas telechargee, de CE bureau', /statut=eq\.accepte/.test(q) && /signe_le=not\.is\.null/.test(q) && /commande_telechargee_le=is\.null/.test(q) && /bureau=eq\.B1/.test(q), q);
  const p1 = w.BdvAffairesJour.punaisesSignes();
  t('un seul : la punaise NOMME le client et dit le geste', p1.length === 1 && p1[0].valeur === 'Cave du Quai' && p1[0].tampon === 'devis signé' && /télécharge la commande Vitisoft/.test(p1[0].sous), JSON.stringify(p1));
  const b = w.document.getElementById('bureauSigne');
  t('le bandeau parait, en bonne nouvelle, avant l\'avis, et dit quoi faire', !!b && !b.hidden && b.getAttribute('data-ok') === 'oui' && b.nextElementSibling === w.document.getElementById('bureauAvis')
    && /Cave du Quai a signé en ligne le devis D-2026-0012/.test(b.textContent));
  b.querySelector('[data-signe-ouvrir]').click();
  t('« Ouvrir le devis » demande CE devis et ouvre la piece', JSON.parse(w.sessionStorage.getItem('bdv_devis_ouvrir') || '{}').devis === 'dv1' && piece === 1);
  await w.BdvAffairesJour.relireSignes(); await attendre(5);
  t('vu une fois, le bandeau ne revient pas', w.document.getElementById('bureauSigne').hidden);
  SIG = SIG.concat([{ devis_id: 'dv2', affaire_id: 'af2', numero: 'D-2026-0013', signe_le: '2026-10-01T13:00:00Z', acheteur: { nom: 'Bistrot' } }]);
  await w.BdvAffairesJour.relireSignes(); await attendre(5);
  const p2 = w.BdvAffairesJour.punaisesSignes();
  t('deux : la punaise COMPTE, et le bandeau revient pour le neuf seulement', p2.length === 1 && p2[0].valeur === '2' && /devis signés/.test(p2[0].libelle)
    && !w.document.getElementById('bureauSigne').hidden && /Bistrot/.test(w.document.getElementById('bureauSigne').textContent), JSON.stringify(p2));
  w.document.querySelector('[data-signe-fermer]').click();
  t('« Plus tard » range le bandeau', w.document.getElementById('bureauSigne').hidden);
  SIG = [];
  await w.BdvAffairesJour.relireSignes();
  t('commande telechargee : plus de punaise', w.BdvAffairesJour.punaisesSignes().length === 0);
  w.BdvCompte.api = async () => { throw new TypeError('Failed to fetch'); };
  SIG = [{ devis_id: 'dv3' }];
  await w.BdvAffairesJour.relireSignes();
  t('une lecture ratee ne fabrique ni ne vide rien', w.BdvAffairesJour.punaisesSignes().length === 0);
}
{
  const NB = lire('src/mon-bureau.njk');
  const i = NB.indexOf('BdvAffairesJour.punaisesSignes()'), j = NB.indexOf('pile = pile.concat(BdvTaches.punaises())'), r = NB.indexOf("cle: 'crm-retard'");
  t('dans la pile, la punaise d\'un devis signe vient apres les retards et avant les taches', i > r && i < j && r > 0);
}

console.log('\n== VERDICT ==');
console.log('  ' + OK + ' controle(s) passe(s), ' + KO + ' echec(s)');
console.log(KO ? '  LA SIGNATURE NE FAIT PAS CE QU\'ELLE DIT' : '  LA SIGNATURE FAIT CE QU\'ELLE DIT');
process.exit(KO ? 1 : 0);
