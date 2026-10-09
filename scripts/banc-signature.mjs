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
  /* LOT 70 : jsdom n'a pas de canvas. Un faux contexte 2d suffit : il note ce qu'on y trace,
     et toDataURL rend un vrai debut de PNG (la base ne laisse passer que ca). */
  X.traces = [];
  const faux = { setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo(x, y) { X.traces.push([x, y]); }, stroke() {}, arc() {}, fill() {},
    fillRect() {}, fillText(t) { X.texteEcrit = t; }, measureText(t) { return { width: String(t).length * 20 }; } };
  w.HTMLCanvasElement.prototype.getContext = function () { return o.sansCanvas ? null : faux; };
  w.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,iVBORw0KGgo' + 'A'.repeat(400); };
  if (o.matchMedia) w.matchMedia = o.matchMedia;
  w.eval(SRC);
  X.manuscrit = () => { const r = X.doc.getElementById('sigModeMan'); r.checked = true; r.dispatchEvent(new w.Event('change', { bubbles: true })); };
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
  t('LOT 70 : le pad vide (facon par defaut) refuse avant de partir, « Un point ne suffit pas »', X.appels.length === 1
    && /Signez dans le cadre/.test(X.doc.getElementById('sigErreur').textContent) && X.doc.getElementById('sigPad').getAttribute('aria-invalid') === 'true');
  X.manuscrit();
  t('LOT 70 : en manuscrit, le cadre de dessin s\'efface et le nom tape s\'affiche en ecriture manuscrite',
    X.doc.getElementById('sigPadZone').hidden && !X.doc.getElementById('sigManZone').hidden && X.doc.getElementById('sigManApercu').textContent === 'Jean Dupont');
  soumettre(); await attendre(10);
  t('case non cochee : refuse avant de partir', X.appels.length === 1 && /Bon pour accord/.test(X.doc.getElementById('sigErreur').textContent));
  X.doc.getElementById('sigAccord').checked = true;
  soumettre(); await attendre(20);
  t('la signature part en POST avec le jeton, le nom, la qualite, l\'accord et l\'EMPREINTE MONTREE', X.appels.length === 2 && X.appels[1].init.method === 'POST'
    && corpsPost.j === JETON && corpsPost.nom === 'Jean Dupont' && corpsPost.qualite === 'Gérant' && corpsPost.accord === true && corpsPost.empreinte === EMP, JSON.stringify(corpsPost));
  t('LOT 70 : la signature part avec son IMAGE PNG et sa facon (« manuscrit »), le nom ecrit dans l\'image',
    /^data:image\/png;base64,iVBORw0KGgo/.test(corpsPost.trace) && corpsPost.trace_mode === 'manuscrit' && X.texteEcrit === 'Jean Dupont', JSON.stringify(corpsPost).slice(0, 200));
  t('signe : « Devis signé le 1er octobre 2026 à 14 h 05 par Jean Dupont (Gérant) », le formulaire part', /Devis signé le 1er octobre 2026 à 14 h 05 par Jean Dupont \(Gérant\)/.test(X.texte())
    && X.doc.getElementById('sigForm').hidden && X.doc.activeElement === X.doc.getElementById('sigIntro'), X.texte().slice(0, 300));
}
{
  const X = page({ get: A_SIGNER, post: { etat: 'a_signer', refus: 'empreinte' } });
  await attendre(10);
  X.manuscrit();
  X.doc.getElementById('sigNom').value = 'Jean Dupont'; X.doc.getElementById('sigQualite').value = 'Gérant'; X.doc.getElementById('sigAccord').checked = true;
  X.doc.getElementById('sigForm').dispatchEvent(new X.w.Event('submit', { bubbles: true, cancelable: true })); await attendre(20);
  t('empreinte refusee : la page recharge le devis au lieu de dire « signe »', X.appels.length === 3 && !X.appels[2].init.method && !/Devis signé/.test(X.texte()));
}
{
  const X = page({ get: A_SIGNER, post: { erreur: 'panne' } });
  await attendre(10);
  X.manuscrit();
  X.doc.getElementById('sigNom').value = 'Jean Dupont'; X.doc.getElementById('sigQualite').value = 'Gérant'; X.doc.getElementById('sigAccord').checked = true;
  X.doc.getElementById('sigForm').dispatchEvent(new X.w.Event('submit', { bubbles: true, cancelable: true })); await attendre(20);
  t('la fonction tombe : « Rien n’a été signé », jamais l\'inverse', /Rien n’a été signé/.test(X.doc.getElementById('sigErreur').textContent) && !/Devis signé/.test(X.texte()));
}

titre('1 quater. Lot 70 : la signature dessinee, manuscrite, ou sur le telephone');
{
  let corps = null;
  const X = page({ get: A_SIGNER, post: (c) => { corps = c; return { etat: 'a_signer', refus: 'trace' }; } });
  await attendre(10);
  const pad = X.doc.getElementById('sigPad');
  pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 160 });
  Object.defineProperty(pad, 'clientWidth', { value: 300 }); Object.defineProperty(pad, 'clientHeight', { value: 160 });
  const P = (type, x, y) => { const e = new X.w.Event(type, { bubbles: true, cancelable: true }); e.clientX = x; e.clientY = y; e.pointerId = 1; e.button = 0; pad.dispatchEvent(e); };
  P('pointerdown', 20, 80); P('pointerup', 20, 80);
  X.doc.getElementById('sigNom').value = 'Jean Dupont'; X.doc.getElementById('sigQualite').value = 'Gérant'; X.doc.getElementById('sigAccord').checked = true;
  X.doc.getElementById('sigForm').dispatchEvent(new X.w.Event('submit', { bubbles: true, cancelable: true })); await attendre(10);
  t('un POINT dans le cadre ne signe pas : refuse avant de partir', X.appels.length === 1 && /Un point ne suffit pas/.test(X.doc.getElementById('sigErreur').textContent));
  P('pointerdown', 20, 80); P('pointermove', 80, 60); P('pointermove', 150, 100); P('pointermove', 220, 70); P('pointerup', 220, 70);
  t('un vrai trait se dessine, et l\'aide le dit', X.traces.length > 0 && /Votre signature est dans le cadre/.test(X.doc.getElementById('sigPadAide').textContent));
  X.doc.getElementById('sigForm').dispatchEvent(new X.w.Event('submit', { bubbles: true, cancelable: true })); await attendre(20);
  t('le dessin part en image PNG, facon « dessin »', !!corps && corps.trace_mode === 'dessin' && /^data:image\/png;base64,iVBORw0KGgo/.test(corps.trace));
  t('la base refuse l\'image (« trace ») : la page le dit, rien n\'est dit « signe »', /Votre signature n’a pas été reçue/.test(X.doc.getElementById('sigErreur').textContent) && !/Devis signé/.test(X.texte()));
  X.doc.getElementById('sigPadEffacer').click();
  X.doc.getElementById('sigForm').dispatchEvent(new X.w.Event('submit', { bubbles: true, cancelable: true })); await attendre(10);
  t('« Effacer » vide le cadre : il faut resigner', X.appels.length === 2 && /Un point ne suffit pas/.test(X.doc.getElementById('sigErreur').textContent));
}
{
  const X = page({ get: A_SIGNER, sansCanvas: true });
  await attendre(10);
  X.manuscrit();
  X.doc.getElementById('sigNom').value = 'Jean Dupont'; X.doc.getElementById('sigQualite').value = 'Gérant'; X.doc.getElementById('sigAccord').checked = true;
  X.doc.getElementById('sigForm').dispatchEvent(new X.w.Event('submit', { bubbles: true, cancelable: true })); await attendre(10);
  t('un navigateur qui ne sait pas faire l\'image : rien ne part, la page le dit', X.appels.length === 1 && /n’a pas pu être préparée/.test(X.doc.getElementById('sigErreur').textContent));
}
{
  const X = page({ get: Object.assign({}, A_SIGNER, { papier: '<!doctype html><html><body><div class="dpap__accord"><p class="dpap__case">Date :</p><p class="dpap__case">Nom</p><p class="dpap__case">Signature</p></div></body></html>' }) });
  await attendre(10);
  const f = X.doc.getElementById('sigFeuille'), fd = f && f.contentDocument;
  if (fd) { fd.open(); fd.write(f.getAttribute('srcdoc')); fd.close(); f.dispatchEvent(new X.w.Event('load')); }
  const c = X.doc.getElementById('sigCache');
  t('a signer : un vrai bouton « Signer en ligne » couvre le cadre « Bon pour accord », 44 px au moins', !!c && !c.hidden && c.tagName === 'BUTTON'
    && /Signer en ligne/.test(c.textContent) && parseInt(c.style.height, 10) >= 44 && c.parentNode === X.doc.getElementById('sigFeuilleW'));
  t('la copie elle-meme n\'est pas touchee (le cache est HORS de la feuille)', fd && !fd.getElementById('sigCache') && fd.querySelectorAll('.dpap__case')[2].textContent === 'Signature');
  c.click();
  t('le cache mene au formulaire, focus sur le nom', X.doc.activeElement === X.doc.getElementById('sigNom'));
  t('sans matchMedia (ecran tactile ou inconnu) : pas de QR code propose', X.doc.getElementById('sigTelZone').hidden);
}
{
  const X = page({ get: A_SIGNER, matchMedia: (q) => ({ matches: q === '(any-pointer: fine)' }) });
  await attendre(10);
  t('ordinateur sans ecran tactile : « Signer plutôt sur mon téléphone » est propose', !X.doc.getElementById('sigTelZone').hidden && X.doc.getElementById('sigQR').hidden);
  const q = lire('src/js/vendor/qrcode-generator.js');
  X.w.eval(q);
  X.doc.getElementById('sigTelB').click(); await attendre(20);
  t('le QR code s\'ouvre, le bouton dit qu\'il est ouvert', !X.doc.getElementById('sigQR').hidden && X.doc.getElementById('sigTelB').getAttribute('aria-expanded') === 'true'
    && X.doc.getElementById('sigQRErreur').hidden);
  const lib = X.w.qrcode(0, 'M'); lib.addData('https://lebureauduvigneron.fr/signer/#' + JETON); lib.make();
  t('le code porte le MEME lien, jeton compris', lib.getModuleCount() > 20);
  X.w.document.dispatchEvent(new X.w.Event('x'));
  const avant = X.appels.length;
  const sig = Object.assign({}, A_SIGNER, { etat: 'signe', signe_le: '2026-10-01T12:05:00Z', signe_nom: 'Jean Dupont', signe_qualite: 'Gérant', devis_statut: 'accepte', devis_signe: true });
  X.w.fetch = async (url) => { X.appels.push({ url: String(url), init: {} }); return { ok: true, status: 200, json: async () => sig }; };
  await attendre(4300);
  t('signe sur le telephone : cette page relit le devis et se met a jour toute seule', X.appels.length > avant && /Devis signé le 1er octobre 2026/.test(X.texte()), X.texte().slice(0, 160));
}
{
  const PNG = 'data:image/png;base64,iVBORw0KGgo' + 'A'.repeat(300);
  const X = page({ get: Object.assign({}, A_SIGNER, { etat: 'signe', signe_le: '2026-10-01T12:05:00Z', signe_nom: 'Jean Dupont', signe_qualite: 'Gérant', devis_statut: 'accepte', devis_signe: true,
    signe_trace: PNG, signe_trace_mode: 'dessin',
    papier: '<!doctype html><html><body><div class="dpap__accord"><p class="dpap__case">Date :</p><p class="dpap__case">Nom</p><p class="dpap__case">Signature</p></div></body></html>' }) });
  await attendre(10);
  const f = X.doc.getElementById('sigFeuille'), fd = f && f.contentDocument;
  if (fd) { fd.open(); fd.write(f.getAttribute('srcdoc')); fd.close(); f.dispatchEvent(new X.w.Event('load')); }
  const im = fd && fd.querySelector('.dpap__accord img');
  t('signe : la signature gardee s\'affiche dans le cadre, et plus de cache', !!im && im.getAttribute('src') === PNG && /Jean Dupont/.test(im.alt)
    && !(X.doc.getElementById('sigCache') && !X.doc.getElementById('sigCache').hidden));
}
{
  const X = page({ get: Object.assign({}, A_SIGNER, { etat: 'signe', signe_le: '2026-10-01T12:05:00Z', signe_nom: 'J', devis_statut: 'accepte', devis_signe: true,
    signe_trace: 'data:image/svg+xml;base64,PHN2Zz4=',
    papier: '<!doctype html><html><body><div class="dpap__accord"><p class="dpap__case">Date :</p><p class="dpap__case">Nom</p><p class="dpap__case">Signature</p></div></body></html>' }) });
  await attendre(10);
  const f = X.doc.getElementById('sigFeuille'), fd = f && f.contentDocument;
  if (fd) { fd.open(); fd.write(f.getAttribute('srcdoc')); fd.close(); f.dispatchEvent(new X.w.Event('load')); }
  t('une image qui n\'est pas un PNG ne s\'affiche jamais', fd && !fd.querySelector('img'));
}
t('la Fonction Edge transmet l\'image et sa facon, sans les juger (la base le fait)', /p_trace: typeof c\.trace === 'string' && c\.trace\.length <= 150000 \? c\.trace : null/.test(lire('supabase/functions/signature/index.ts'))
  && /p_trace_mode: c\.trace_mode === 'dessin' \|\| c\.trace_mode === 'manuscrit'/.test(lire('supabase/functions/signature/index.ts')));
t('le texte RGPD nomme la signature', /votre nom, votre fonction, votre signature/.test(NJK));

titre('1 bis. Les corrections du juge, 01/10/2026');
{
  /* D7 : clos parce que le DOMAINE a accepte : on le dit, pas « remplace ». */
  const X = page({ get: Object.assign({}, A_SIGNER, { etat: 'clos', papier: null, devis_statut: 'accepte', devis_signe: false }) });
  await attendre(10);
  t('D7 : accepte par le domaine : « Ce devis a déjà été accepté par le domaine », pas « remplacé »', /Ce devis a déjà été accepté par le domaine/.test(X.texte())
    && !/remplacé/.test(X.texte()) && !!X.doc.querySelector('#sigFinC a[href="mailto:contact@un.fr"]'), X.texte().slice(0, 200));
}
{
  const X = page({ get: Object.assign({}, A_SIGNER, { etat: 'clos', papier: null, devis_statut: 'accepte', devis_signe: true }) });
  await attendre(10);
  t('D7 : deja signe en ligne (un autre lien) : « Ce devis a déjà été signé »', /Ce devis a déjà été signé/.test(X.texte()));
}
{
  const X = page({ get: Object.assign({}, A_SIGNER, { etat: 'clos', papier: null }) });
  await attendre(10);
  t('D7 (temoin) : sans statut connu, la phrase d\'origine reste', /n’est plus à signer/.test(X.texte()));
}
{
  /* D6 : signe, puis l'acceptation annulee par le domaine. */
  const X = page({ get: Object.assign({}, A_SIGNER, { etat: 'signe', signe_le: '2026-10-01T12:05:00Z', signe_nom: 'Jean Dupont', devis_statut: 'envoye', devis_signe: false }) });
  await attendre(10);
  t('D6 : acceptation annulee depuis la signature : « Ce devis n’est plus valable », jamais « a bien reçu votre accord »', /Ce devis n’est plus valable/.test(X.texte())
    && /a annulé son acceptation/.test(X.texte()) && !/a bien reçu votre accord/.test(X.texte()), X.texte().slice(0, 240));
}
{
  const X = page({ get: Object.assign({}, A_SIGNER, { etat: 'signe', signe_le: '2026-10-01T12:05:00Z', signe_nom: 'Jean Dupont', signe_qualite: 'Gérant', devis_statut: 'accepte', devis_signe: true,
    papier: '<!doctype html><html><body><table class="dpap__table"><tbody><tr><td>A</td></tr><tr><td>B</td></tr></tbody></table><div class="dpap__accord"><p class="dpap__case">Date :</p><p class="dpap__case">Nom</p><p class="dpap__case">Signature</p></div></body></html>' }) });
  await attendre(10);
  t('D6 (temoin) : toujours accepte, « a bien reçu votre accord »', /a bien reçu votre accord/.test(X.texte()) && X.doc.getElementById('sigTitre').textContent === 'Devis signé');
  const f = X.doc.getElementById('sigFeuille');
  const fd = f && f.contentDocument;
  if (fd) { fd.open(); /* jsdom ne charge pas un srcdoc : on y pose le meme texte, puis le chargement. */ fd.write(f.getAttribute('srcdoc')); fd.close(); f.dispatchEvent(new X.w.Event('load')); }
  const cases = fd ? [...fd.querySelectorAll('.dpap__accord .dpap__case')].map(n => n.textContent) : [];
  t('V7 : signe, le cadre « Bon pour accord » est rempli A L\'AFFICHAGE (date, nom et qualite, signe en ligne)', cases.length === 3 && /^Date : 1er octobre 2026/.test(cases[0])
    && /Jean Dupont, Gérant/.test(cases[1]) && /signé en ligne/.test(cases[2]), JSON.stringify(cases));
  t('V7 : ... la page dit que la copie gardee n\'a pas change', /Le devis lui-même n’a pas été modifié : son empreinte reste la même/.test(X.texte()));
  t('V7 : le resume compte les vins de la copie', /2 vins au devis/.test(X.doc.getElementById('sigResVins').textContent) && !X.doc.getElementById('sigResVins').hidden);
  t('V7 : signe, plus de bouton « Signer ce devis »', X.doc.getElementById('sigAller').hidden);
}
{
  /* X5 (tour 3) : les vins se LISENT dans le resume, une ligne par vin, tires de la copie. */
  const R = (nom, mil, fmt, code, q, pu, tot) => '<tr><td class="dpap__vin"><b>' + nom + '</b> ' + mil + ', ' + fmt + '<br><span class="dpap__code">Code article ' + code + '</span></td>'
    + '<td class="dpap__n">' + q + '</td><td class="dpap__n">' + pu + '</td><td class="dpap__n"></td><td class="dpap__n">' + tot + '</td></tr>';
  const X = page({ get: Object.assign({}, A_SIGNER, { papier: '<!doctype html><html><body><table class="dpap__table"><tbody>'
    + R('Le Rosé', '2025', '75 cl', 'P1', '12', '8,90\u00a0€', '106,80\u00a0€') + R('Chapelle &amp; Fils', '2023', '150 cl', 'P2', '6', '22,00\u00a0€', '132,00\u00a0€')
    + '</tbody></table></body></html>' }) });
  await attendre(10);
  const f = X.doc.getElementById('sigFeuille'), fd = f && f.contentDocument;
  if (fd) { fd.open(); fd.write(f.getAttribute('srcdoc')); fd.close(); f.dispatchEvent(new X.w.Event('load')); }
  const ul = X.doc.getElementById('sigResListe');
  const li = ul ? [...ul.querySelectorAll('li')].map(n => n.textContent) : [];
  t('X5 : le resume nomme chaque vin : « 12 × Le Rosé 2025, 75 cl, 106,80 € HT »', li.length === 2 && li[0] === '12\u00a0×\u00a0Le Rosé 2025, 75 cl, 106,80\u00a0€\u00a0HT', JSON.stringify(li));
  t('X5 : sans le code article, sans HTML recopie (« & » lu comme du texte)', li[1] === '6\u00a0×\u00a0Chapelle & Fils 2023, 150 cl, 132,00\u00a0€\u00a0HT' && !ul.querySelector('b, span'), JSON.stringify(li));
  t('X5 : la liste vit DANS le resume, en 16 px (1rem herite de la section)', !ul.hidden && ul.closest('#sigResume') && /font-size:1rem/.test(X.doc.getElementById('sigResume').getAttribute('style')));
  t('LOT 70 : l\'intro dit ou l\'on signe (« en bas de la page »)', /Lisez-le, puis signez-le en bas de la page\./.test(X.doc.getElementById('sigIntro').textContent));
  t('X5 : « 2 vins au devis : » annonce la liste', X.doc.getElementById('sigResVins').textContent === '2 vins au devis :');
}
{
  const X = page({ get: A_SIGNER });
  await attendre(10);
  t('V7 : l\'en-tete est celui du DOMAINE : son nom et le numero du devis', X.doc.getElementById('sigVendeur').textContent === 'EARL Domaine Un' && X.doc.getElementById('sigNumero').textContent === 'Devis D-2026-0012');
  t('V7 : le resume en 16 px dit le client, le HT avant le TTC (espaces insecables), la validite', /font-size:1rem/.test(X.doc.getElementById('sigResume').getAttribute('style'))
    && X.doc.getElementById('sigResClient').textContent === 'Pour Cave du Quai' && /150,00\s€\u00a0HT, soit 180,00\s€\u00a0TTC/.test(X.doc.getElementById('sigResTotal').textContent)
    && /31 octobre 2026/.test(X.doc.getElementById('sigResValid').textContent), X.doc.getElementById('sigResTotal').textContent);
  const al = X.doc.getElementById('sigAller');
  t('V7 : « Signer ce devis » est colle en bas, 44 px, et visible tant qu\'on lit', !al.hidden && /position:sticky; bottom:0/.test(al.getAttribute('style')) && /min-height:44px/.test(X.doc.getElementById('sigAllerB').getAttribute('style')));
  X.doc.getElementById('sigAllerB').click();
  t('V7 : il mene au formulaire, focus sur le nom', X.doc.activeElement === X.doc.getElementById('sigNom'));
  t('V7 : chaque champ dit « (obligatoire) » et porte aria-required', ['sigNom', 'sigQualite'].every(i => X.doc.getElementById(i).getAttribute('aria-required') === 'true'
    && /\(obligatoire\)/.test(X.doc.querySelector('label[for="' + i + '"]').textContent)));
}
t('V7 : la page porte « sans_chrome », et le gabarit retire bandeau et pied SEULEMENT sous ce drapeau', /^sans_chrome: true$/m.test(NJK)
  && /\{% if not sans_chrome %\}(\{% if vitrine %\}\{% include "components\/vitrine-pied\.njk" %\}\{% else %\})?\{% include "components\/footer-rich\.njk" %\}(\{% endif %\})?\{% endif %\}/.test(lire('src/_includes/base.njk'))
  && (lire('src/_includes/base.njk').match(/\{% if not sans_chrome %\}/g) || []).length === 2);
t('V7 : un pied propre : mentions legales et confidentialite, en cibles de 44 px', /href="\/mentions-legales\/"[^>]*min-height:44px/.test(NJK) && /href="\/politique-confidentialite\/"[^>]*min-height:44px/.test(NJK));
t('la page est hors index et hors collections', /noindex: true/.test(NJK) && /eleventyExcludeFromCollections: true/.test(NJK));

titre('1 ter. Tour 2 du juge, 02/10/2026');
{
  const X = page({ get: Object.assign({}, A_SIGNER, { total_ht_c: 164850, total_ttc_c: 194779 }) });
  await attendre(10);
  t('W3 : les milliers portent l\'espace insecable ordinaire, que toutes les polices dessinent (« 1 648,50 € HT, soit 1 947,79 € TTC »)',
    X.doc.getElementById('sigResTotal').textContent === 'Total 1\u00a0648,50\u00a0€\u00a0HT, soit 1\u00a0947,79\u00a0€\u00a0TTC', JSON.stringify(X.doc.getElementById('sigResTotal').textContent));
  t('W3 : plus d\'Intl.NumberFormat pour les euros (il dependait du navigateur)', !/NumberFormat\('fr-FR', \{ style: 'currency'/.test(SRC));
  const ordre = ['sigFeuilleW', 'sigEmpreinte', 'sigAller', 'sigForm'].map(i => X.doc.getElementById(i));
  t('N5 : la barre « Signer ce devis » est APRES la feuille et JUSTE avant le formulaire (un collant bottom ne retient que ce qui est plus bas)',
    ordre.every(Boolean) && ordre.every((n, i) => i === 0 || (ordre[i - 1].compareDocumentPosition(n) & 4) !== 0) && ordre[2].nextElementSibling === ordre[3]
    && /position:sticky; bottom:0/.test(ordre[2].getAttribute('style')));
  t('N5 : la barre s\'efface par visibility des que le formulaire parait (seuil 0), et ne garde pas sa place (marge basse negative)', /b\.style\.visibility = vu \? 'hidden' : ''/.test(SRC)
    && /threshold: 0 \}/.test(SRC) && /id="sigAller" style="[^"]*margin:0 0 calc\(-1 \* \(44px \+ 1rem \+ 1px\)\) 0;/.test(NJK));
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  t('W2 : la feuille prend la hauteur de son CONTENU : largeur A4 posee avant la mesure, aucun plancher A4 (1123)',
    !/1123/.test(code) && /function ajuster\(\)[\s\S]*?f\.style\.width = A4 \+ 'px';\s*var h = hauteurDuContenu\(/.test(code) && /querySelector\('\.dpap__feuille'\)/.test(code)
    && /f\.style\.display = 'block';\s*f\.style\.width = A4 \+ 'px';/.test(code));
}
for (const etat of ['clos', 'expire']) {
  const X = page({ get: Object.assign({}, A_SIGNER, { etat, papier: null, vendeur_tel: '02 40 12 34 56' }) });
  await attendre(10);
  const fin = X.doc.getElementById('sigFin'), liens = [...fin.querySelectorAll('a')];
  t('W9 (' + etat + ') : l\'adresse du domaine UNE fois, et le telephone, en deux liens de 44 px',
    (fin.textContent.match(/contact@un\.fr/g) || []).length === 1 && liens.length === 2
    && liens[0].getAttribute('href') === 'tel:0240123456' && liens[0].textContent === 'Appeler le 02 40 12 34 56'
    && liens[1].getAttribute('href') === 'mailto:contact@un.fr' && liens[1].textContent === 'Écrire à contact@un.fr'
    && liens.every(a => a.style.minHeight === '44px'), fin.textContent.replace(/\s+/g, ' '));
}
{
  const X = page({ get: Object.assign({}, A_SIGNER, { etat: 'clos', papier: null, vendeur_email: null, vendeur_tel: 'n/a' }) });
  await attendre(10);
  t('W9 : un telephone illisible et pas d\'adresse : aucun lien, pas de bloc vide', X.doc.getElementById('sigFinC').hidden && !X.doc.querySelector('#sigFin a'));
}

titre('2. La fonction Edge');
{
  const F = lire('supabase/functions/signature/index.ts');
  const code = F.replace(/\/\*[\s\S]*?\*\//g, '');
  t('elle n\'appelle que signature_lire et signature_poser', (code.match(/rpc\('([a-z_]+)'/g) || []).sort().join() === "rpc('signature_lire',rpc('signature_poser'");
  t('aucun mail ne part d\'ici (ni Resend ni smtp)', !/resend|smtp|mailto/i.test(code));
  t('le jeton est verifie (64 hexadecimaux) avant d\'appeler la base', /\^\[0-9a-f\]\{64\}\$/.test(code) && /if \(!JETON\.test\(j\)\) return reponse\(\{ etat: 'inconnu' \}\)/.test(code));
  t('l\'IP est la PREMIERE valeur de x-forwarded-for', /x-forwarded-for[\s\S]*split\(','\)\[0\]/.test(code));
  t('ce qu\'elle recoit est borne (160 000 octets avec l\'image, nom et qualite coupes)', /brut\.length > 160000/.test(code) && /texte\(c\.nom, 200\)/.test(code));
  t('l\'accord n\'est vrai que s\'il vaut true, pas une chaine', /p_accord: c\.accord === true/.test(code));
  t('D3 : un corps JSON null ou un tableau rend 400 « illisible », jamais une exception', /if \(!c \|\| typeof c !== 'object' \|\| Array\.isArray\(c\)\) return reponse\(\{ erreur: 'illisible' \}, 400\)/.test(code));
  t('D6/D7 : GET et POST passent par avecDevenir, qui lit le statut du devis par l\'empreinte du jeton', (code.match(/reponse\(await avecDevenir\(j, await rpc\(/g) || []).length === 2
    && /devis_liens\?jeton_hash=eq\.\$\{await hex256\(j\)\}/.test(code) && /select=statut,signe_le/.test(code));
  t('D6/D7 : la lecture du statut ne casse rien : en cas d\'echec, la reponse part telle quelle', /catch \{ return null; \}/.test(code) && /if \(v && o\.etat !== 'expire'\) \{ o\.devis_statut/.test(code));
  t('W9 : un lien eteint ou expire recoit le TELEPHONE du domaine (instantane vendeur), rien du devis',
    /select=statut,signe_le,vendeur_tel:vendeur->>telephone/.test(code) && /o\.etat === 'expire'/.test(code) && /if \(v && v\.tel && !o\.vendeur_tel\) o\.vendeur_tel = v\.tel;/.test(code)
    && !/o\.(papier|client|total_ht_c|total_ttc_c|empreinte) =/.test(code));
  t('la panne ne renvoie qu\'un mot, le detail reste au journal', /console\.error\('signature'/.test(code) && /erreur: 'panne'/.test(code));
}

titre('2 bis. Le mail des nouvelles (fonction notif-commerce, lot 57)');
{
  const N = lire('supabase/functions/notif-commerce/index.ts');
  const code = N.replace(/\/\*[\s\S]*?\*\//g, '');
  t('elle refuse tout appel sans le secret NOTIF_CLE (32 signes au moins) dans x-notif-cle',
    /if \(!CLE \|\| CLE\.length < 32 \|\| req\.headers\.get\('x-notif-cle'\) !== CLE\) return reponse\(\{ erreur: 'cle' \}, 401\)/.test(code));
  t('elle ne decide de rien : deux fonctions de la base seulement, notif_detail et push_cibles (lot 60)', (code.match(/rpc\('([a-z_]+)'/g) || []).join() === "rpc('push_cibles',rpc('notif_detail'");
  t('elle POSE la ligne du journal AVANT d\'envoyer, et s\'arrete si elle existait',
    /Prefer: 'resolution=ignore-duplicates,return=representation'/.test(code)
    && code.indexOf('await reserver(') > 0 && code.indexOf('await reserver(') < code.indexOf('await envoyer(')
    && /if \(!moi\) return reponse\(\{ deja: true/.test(code));
  t('un destinataire a la fois, vingt au plus, adresses dedoublonnees', /const MAX_DEST = 20;/.test(code) && /\[\.\.\.new Set\(dest\)\]\.slice\(0, MAX_DEST\)/.test(code) && /to: \[a\]/.test(code));
  t('le resultat est note, et un echec ne se rejoue pas tout seul', /await noter\(String\(d\.cle\), \{[\s\S]*echec: echecs\.length/.test(code) && !/setTimeout|retry/i.test(code));
  t('le mail ne nomme aucune couleur sans son jeton', (N.match(/'#[0-9A-Fa-f]{6}',\s*\/\/ --[a-z-]+/g) || []).length === 8);
  t('aucun tiret cadratin', !/\u2014/.test(N));
  {
    const AFm = lire('src/js/bdv-affaires.js'), BJm = lire('src/js/bdv-affaires-jour.js');
    const ref = [...AFm.slice(AFm.indexOf('var MOTIFS = ['), AFm.indexOf('];', AFm.indexOf('var MOTIFS = ['))).matchAll(/\['([a-z_]+)', '([^']+)'\]/g)].map(m => m[1] + '=' + m[2]).sort().join('|');
    const nv = [...BJm.slice(BJm.indexOf('var MOTIFS_NV'), BJm.indexOf('};', BJm.indexOf('var MOTIFS_NV'))).matchAll(/([a-z_]+): '([^']+)'/g)].map(m => m[1] + '=' + m[2]).sort().join('|');
    const ma = [...N.slice(N.indexOf('const MOTIFS'), N.indexOf('};', N.indexOf('const MOTIFS'))).matchAll(/([a-z_]+): '([^']+)'/g)].map(m => m[1] + '=' + m[2]).sort().join('|');
    t('les motifs d\'une affaire perdue sont les memes dans la piece, les nouvelles et le mail', !!ref && ref === nv && ref === ma, ref + ' / ' + nv + ' / ' + ma);
  }
  const nodeTs = Number(process.versions.node.split('.')[0]) > 22 || (Number(process.versions.node.split('.')[0]) === 22 && Number(process.versions.node.split('.')[1]) >= 6);
  if (!nodeTs) console.log('  note  : node ' + process.versions.node + ' ne lit pas le TypeScript, la fabrique du mail n\'est pas executee ici');
  else {
    const { execFileSync } = await import('node:child_process');
    const essai = 'globalThis.Deno={env:{get:(k)=>k==="NOTIF_BANC"?"1":""}};'
      + 'const m=await import(' + JSON.stringify(path.join(RACINE, 'supabase/functions/notif-commerce/index.ts')) + ');'
      + 'const base={cle:"x",bureau_nom:"Domaine Un",affaire_id:"11111111-1111-1111-1111-111111111111",titre:"Premiere",client:"Cave du Port",type:"Caviste",close_le:"2026-10-03T08:12:00Z"};'
      + 'const dv={numero:"D-2026-0004",total_ht_c:124000,total_ttc_c:148800,signe_le:"2026-10-03T08:12:00Z",lignes:[{designation:"Le Rosé",millesime:"2025",conditionnement:"75 cl",quantite:60,pu_f_c:950,final_c:57000}],signataire:{nom:"Paul <b>Martin</b>",qualite:"Gérant"}};'
      + 'console.log(JSON.stringify([m.fabriquer({...base,sorte:"signe",par:null,devis:dv}),m.fabriquer({...base,sorte:"gagnee",par:"Camila",devis:null}),m.fabriquer({...base,sorte:"perdue",par:"Bruno",motif:"fournisseur",devis:null})]));';
    let r = null;
    try { r = JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', essai], { encoding: 'utf8' })); } catch (e) { r = null; }
    t('la fabrique tourne', Array.isArray(r) && r.length === 3);
    if (r) {
      const [sg, ga, pe] = r;
      t('signe (lot 64) : l\'objet commence par le fait, puis le client et le montant HT arrondi', sg.sujet === 'Devis signé · Cave du Port · 1 240 € HT', sg.sujet);
      t('lot 64 : un texte d\'apercu cache dit l\'action (telecharger la commande)', /<div style="display:none;[^"]*">Prochaine étape : télécharger la commande/.test(sg.html));
      t('signe : montants, vins, signataire, heure de Paris, et la suite (Vitisoft)', /1 240,00 € HT, 1 488,00 € TTC/.test(sg.texte)
        && /Le Rosé, 2025, 75 cl : 60 x 9,50 € = 570,00 €/.test(sg.texte) && /samedi 3 octobre à 10 h 12/.test(sg.texte)
        && /importer dans Vitisoft/.test(sg.texte), sg.texte);
      t('le nom du signataire est echappe dans le HTML', /Paul &lt;b&gt;Martin&lt;\/b&gt;/.test(sg.html) && !/Paul <b>/.test(sg.html));
      t('le bouton mene a l\'affaire', /href="https:\/\/lebureauduvigneron\.fr\/mon-bureau\/#affaire=11111111-1111-1111-1111-111111111111"/.test(sg.html));
      t('gagnee : le collegue est nomme', ga.sujet === 'Gagnée par Camila · Cave du Port' && /Camila a gagné l'affaire Cave du Port/.test(ga.texte));
      t('lot 58 : le pied dit ou couper ce mail, et plus « tout le bureau »', /onglet « Le courrier »\. Tu peux l'y décocher\./.test(sg.texte) && /onglet « Le courrier »\. Tu peux l'y décocher\./.test(ga.texte)
        && !/Tout le bureau le reçoit/.test(sg.texte + ga.texte)
        && !/Celui qui a fait le geste/.test(sg.html + ga.html + pe.html));
      t('perdue : le motif en mots, pas en code', pe.sujet === 'Perdue par Bruno · Cave du Port · un fournisseur déjà en place' && /Motif : Un fournisseur déjà en place/.test(pe.texte));
      t('largeur bornee a 560 px, en attribut et en style, fonds sur les cellules', /width="560"[^>]*max-width:560px/.test(sg.html) && /<td bgcolor="#FFFFFF" style="background-color:#FFFFFF/.test(sg.html));
    }
  }
}

titre('3. Le bureau : la punaise, et les nouvelles qui remplacent le bandeau (lot 57)');
{
  const dom = new JSDOM('<!doctype html><html><body><div class="bureau-atelier__travail"><div class="bureau-plan" id="bureauJournee"><section class="zone" id="zoneSousMain" hidden><p class="bureau-avis" id="bureauAvis" hidden></p></section></div><div id="bureauAffaires" hidden></div></div><div class="postit" data-cle="x"></div><ul><li class="bureau-nav__ligne" data-piece="clients"><a class="bureau-nav__item" href="/mon-bureau/#clients">Mon commerce</a></li></ul><p id="bureauResume"><a class="bureau-tete__etat bureau-tete__etat--commerce" href="/mon-bureau/#affaires">x</a></p></body></html>',
    { runScripts: 'outside-only', url: 'https://lebureauduvigneron.fr/mon-bureau/', pretendToBeVisual: true });
  const w = dom.window, req = [];
  const ilYa = (h) => new Date(Date.now() - h * 3600000).toISOString();
  let SIG = [{ devis_id: 'dv1', affaire_id: 'af1', numero: 'D-2026-0012', signe_le: ilYa(2), total_ht_c: 15000, acheteur: { nom: 'Cave du Quai' } }];
  let CLOS = [], CLOS_PANNE = false;
  w.BdvCompte = { monBureau: () => 'B1', monId: () => 'U1', nomAuteur: (id) => id === 'U2' ? 'Camila' : 'un ancien membre',
    trombinoscope: async () => ({}), api: async (c) => { req.push(c); await attendre(0);
    if (/^\/devis\?/.test(c)) return SIG.map(x => Object.assign({}, x));
    if (/^\/affaires\?/.test(c) && /close_par/.test(c)) { if (CLOS_PANNE) throw Object.assign(new Error('400'), { detail: 'column affaires.close_par does not exist' }); return CLOS.map(x => Object.assign({}, x)); }
    if (/^\/pistes\?/.test(c)) return [{ piste_id: 'p9', nom: 'Domaine Voisin' }];
    if (/^\/affaires\?/.test(c)) return []; if (/^\/affaire_types\?/.test(c)) return []; return []; } };
  let piece = 0;
  w.BdvNav = { afficher: () => { piece++; } };
  w.eval(lire('src/js/bdv-affaires-jour.js'));
  await w.BdvAffairesJour.charger(); await attendre(10);
  const q = req.find(c => /^\/devis\?/.test(c)) || '';
  t('la lecture : devis acceptes, signes, commande pas telechargee, de CE bureau', /statut=eq\.accepte/.test(q) && /signe_le=not\.is\.null/.test(q) && /commande_telechargee_le=is\.null/.test(q) && /bureau=eq\.B1/.test(q), q);
  const p1 = w.BdvAffairesJour.punaisesSignes();
  t('un seul : la punaise NOMME le client et dit le geste', p1.length === 1 && p1[0].valeur === 'Cave du Quai' && p1[0].tampon === 'devis signé' && /télécharge la commande Vitisoft/.test(p1[0].sous), JSON.stringify(p1));
  t('X3 : la punaise porte le bouton « Ouvrir le devis », geste de punaise vers CE devis', !!p1[0].gestes && p1[0].gestes.length === 1
    && p1[0].gestes[0].mot === 'Ouvrir le devis' && p1[0].gestes[0].cle === 'signe-ouvrir' && p1[0].gestes[0].id === 'signe:af1:dv1', JSON.stringify(p1[0].gestes));
  {
    let decroche = 0;
    w.document.addEventListener('click', (e) => { if (e.target.closest('[data-punaise]')) decroche++; });
    const bp = w.document.createElement('button'); bp.className = 'postit__g'; bp.setAttribute('data-punaise', 'signe-ouvrir'); bp.setAttribute('data-id', 'signe:af1:dv1');
    w.document.body.appendChild(bp); w.sessionStorage.removeItem('bdv_devis_ouvrir');
    const avantP = piece; bp.click(); bp.remove();
    t('X3 : un appui ouvre CE devis dans la piece, sans passer par l\'ecouteur commun des punaises (qui la decrocherait)',
      JSON.parse(w.sessionStorage.getItem('bdv_devis_ouvrir') || '{}').devis === 'dv1' && piece === avantP + 1 && decroche === 0);
    const lu = JSON.parse(w.localStorage.getItem('bdv_signes_vus_v1') || '[]');
    lu.splice(lu.indexOf('dv1'), 1); w.localStorage.setItem('bdv_signes_vus_v1', JSON.stringify(lu));
    await w.BdvAffairesJour.relireSignes(); await attendre(5);
  }
  const D = w.document, BAJ = w.BdvAffairesJour;
  t('lot 57 : le bandeau vert n\'existe plus', !D.getElementById('bureauSigne'));
  const qn = req.find(c => /signe_le=gte\./.test(c)) || '';
  t('lot 57 : les signatures des 30 derniers jours, de CE bureau, meme commande telechargee', /statut=eq\.accepte/.test(qn) && /bureau=eq\.B1/.test(qn) && !/commande_telechargee_le/.test(qn), qn);
  const n1 = BAJ.nouv();
  t('lot 57 : une nouvelle, on la NOMME, pour la piece A gagner, teinte « commerce »', !!n1 && n1[0] === 'Cave du Quai a signé le devis D\u20112026\u20110012'
    && n1[1] === 'affaires' && n1[2] === 'commerce' && n1[3] === '1' && /<path/.test(n1[4]), JSON.stringify(n1));
  const pt = D.querySelector('.bureau-nav__ligne[data-piece="clients"] .bureau-nav__point');
  t('lot 57 : un point sur « Mon commerce » du rail, avec son texte hors ecran', !!pt && pt.querySelector('.hors-ecran').textContent === ', une nouvelle');
  t('lot 57 : le nombre est range pour le bandeau du site', w.localStorage.getItem('bdv_notifs_n') === '1');
  CLOS = [{ affaire_id: 'af2', titre: 'Salon', issue: 'gagnee', close_le: ilYa(1), close_par: 'U2', piste_id: 'p9' },
          { affaire_id: 'af3', titre: 'Mariage Durand', issue: 'perdue', motif: 'prix', close_le: ilYa(3), close_par: 'U7', client_nom: null }];
  await BAJ.relireSignes(); await attendre(5);
  const qc = req.filter(c => /^\/affaires\?/.test(c) && /close_par/.test(c)).pop() || '';
  t('lot 57 : les affaires closes par un AUTRE (close_par non vide et different de moi), 30 jours', /close_par=not\.is\.null/.test(qc)
    && /close_par=neq\.U1/.test(qc) && /issue=in\.\(gagnee,perdue\)/.test(qc) && /close_le=gte\./.test(qc), qc);
  const lst = BAJ.nouvelles();
  t('lot 57 : trois nouvelles, la plus recente en tete, le collegue NOMME, un ancien membre devient « Un collègue »',
    lst.length === 3 && lst[0].titre === 'Camila a gagné Domaine Voisin' && lst[2].titre === 'Un collègue a perdu Mariage Durand', JSON.stringify(lst.map(x => x.titre)));
  t('lot 57 : la seconde ligne dit le motif d\'une perdue, jamais une redite du titre', /^Le prix, il y a 3 h$/.test(lst[2].sous), lst[2].sous);
  t('lot 57 : plusieurs, on COMPTE', BAJ.nouv()[0] === '3 nouvelles de ton commerce' && BAJ.nouv()[3] === '3');
  const pas = D.querySelector('.bureau-tete__etat--commerce');
  const ev0 = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  pas.dispatchEvent(ev0);
  const pop = D.getElementById('bdvNouv');
  t('lot 57 : le lien de la pastille n\'est pas suivi (pas de saut vers A gagner)', ev0.defaultPrevented);
  t('lot 57 : un clic sur la pastille ouvre la liste, sans suivre le lien', !!pop && !pop.hidden && pas.getAttribute('aria-expanded') === 'true'
    && pop.querySelectorAll('.bdv-nouv__l').length === 3 && pop.getAttribute('role') === 'dialog');
  t('lot 57 : chaque ligne a son « Ouvrir » nomme, et « Tout marquer comme vu » en pied',
    pop.querySelectorAll('.bdv-nouv__o').length === 3 && /Camila a gagné Domaine Voisin/.test(pop.querySelector('.bdv-nouv__o').getAttribute('aria-label'))
    && !!pop.querySelector('[data-nouv="tout"]'));
  pop.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  t('lot 57 : Echap la ferme', pop.hidden && pas.getAttribute('aria-expanded') === 'false');
  pas.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  const avantO = piece; w.sessionStorage.removeItem('bdv_devis_ouvrir');
  pop.querySelectorAll('.bdv-nouv__o')[1].click();
  t('lot 57 : « Ouvrir » un devis signe demande CE devis et ouvre la piece', JSON.parse(w.sessionStorage.getItem('bdv_devis_ouvrir') || '{}').devis === 'dv1'
    && w.sessionStorage.getItem('bdv_affaire_ouvrir') === 'af1' && piece === avantO + 1 && pop.hidden);
  BAJ.vuAffaire('af1');
  t('lot 57 : montrer l\'affaire, c\'est avoir vu ses nouvelles', BAJ.nouvelles().length === 2 && BAJ.nouvelles().every(x => x.affaire !== 'af1'));
  t('lot 57 : le point suit', D.querySelector('.bureau-nav__point .hors-ecran').textContent === ', 2 nouvelles' && w.localStorage.getItem('bdv_notifs_n') === '2');
  pas.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  pop.querySelector('[data-nouv="tout"]').click();
  t('lot 57 : « Tout marquer comme vu » : plus de pastille, plus de point, plus de nombre', BAJ.nouv() === null
    && !D.querySelector('.bureau-nav__point') && w.localStorage.getItem('bdv_notifs_n') === null && pop.hidden);
  CLOS = CLOS.concat([{ affaire_id: 'af2', titre: 'Salon', issue: 'perdue', close_le: ilYa(0.1), close_par: 'U2', piste_id: 'p9' }]);
  await BAJ.relireSignes(); await attendre(5);
  t('lot 57 : une affaire rouverte puis refermee est une NOUVELLE nouvelle', BAJ.nouvelles().length === 1 && BAJ.nouvelles()[0].titre === 'Camila a perdu Domaine Voisin');
  w.localStorage.removeItem('bdv_notifs_vues_v1');
  CLOS = [{ affaire_id: 'af8', titre: 'Vieux', issue: 'gagnee', close_le: ilYa(24 * 5), close_par: 'U2' }];
  SIG = [];
  await BAJ.relireSignes(); await attendre(5);
  t('lot 57 : la premiere fois sur un appareil, ce qui a plus de deux jours compte pour vu', BAJ.nouvelles().length === 0);
  CLOS_PANNE = true; SIG = [{ devis_id: 'dv4', affaire_id: 'af4', numero: 'D-2026-0020', signe_le: ilYa(0.5), acheteur: { nom: 'Cave Neuve' } }];
  await BAJ.relireSignes(); await attendre(5);
  t('lot 57 : avant le SQL (close_par absent), les devis signes s\'annoncent quand meme', BAJ.nouvelles().length === 1 && BAJ.nouvelles()[0].titre === 'Cave Neuve a signé le devis D\u20112026\u20110020');
  CLOS_PANNE = false;
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
  const PR = NB.slice(NB.indexOf('function peindreResume(){'), NB.indexOf('window.bdvMajResume = peindreResume;'));
  t('lot 57 : la pastille des nouvelles passe DEVANT dans l\'en-tete, avec son icone', /BdvAffairesJour\.nouv\(\); if\(nv\) m\.unshift\(nv\);/.test(PR)
    && /\(x\[4\] \|\| ICO\[x\[2\]\]\)/.test(PR) && PR.length > 100);
  const AF = lire('src/js/bdv-affaires.js');
  const pp = AF.slice(AF.indexOf('function peindrePanneau('), AF.indexOf('function peindreTete('));
  const pg = AF.slice(AF.indexOf('function peindrePage('), AF.indexOf('function peindrePage(') + 1200);
  t('lot 57 : le panneau ET la pleine page d\'une affaire la marquent vue', /BdvAffairesJour\.vuAffaire\(a\.affaire_id\)/.test(pp) && /BdvAffairesJour\.vuAffaire\(a\.affaire_id\)/.test(pg));
  const BA = lire('src/_includes/base.njk');
  t('lot 57 : « Mon bureau » du bandeau porte le point, lu dans le nombre range', /id="navPoint" hidden><span class="hors-ecran">/.test(BA)
    && /getElementById\('navPoint'\)[^;]*;\s*if\(q\) q\.hidden = !\(connecte && \+localStorage\.getItem\('bdv_notifs_n'\) > 0\)/.test(BA));
}

console.log('\n== VERDICT ==');
console.log('  ' + OK + ' controle(s) passe(s), ' + KO + ' echec(s)');
console.log(KO ? '  LA SIGNATURE NE FAIT PAS CE QU\'ELLE DIT' : '  LA SIGNATURE FAIT CE QU\'ELLE DIT');
process.exit(KO ? 1 : 0);
