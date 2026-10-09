/* ============================================================================
   supabase/functions/brevo : brancher Brevo sur un bureau (lot 87, 08/10/2026)
   ----------------------------------------------------------------------------
   Arbitrages de Ted du 08/10/2026 (CLAUDE.md « BREVO ») : une cle API Brevo par bureau,
   collee par le maitre ; chaque personne choisit son adresse d'expediteur parmi celles que
   Brevo a validees.

   DEUX GESTES, appeles avec le jeton de session :
     - `brancher` (le maitre) : demande a Brevo le compte de la cle (GET /v3/account). Si Brevo
       l'accepte, la cle est rangee dans Vault par `brevo_ranger()` (cle de service). Une cle
       refusee ne laisse rien.
     - `expediteurs` (tout membre) : la liste des adresses d'envoi que Brevo connait
       (GET /v3/senders), pour que chacun choisisse la sienne. Chaque appel note si Brevo
       accepte encore la cle (`brevo_noter`).

   LA CLE :
     - [Certain, aide Brevo lue le 08/10/2026] elle ouvre tout le compte et ne se limite pas ;
     - elle traverse cette fonction, n'est jamais journalisee ni renvoyee ;
     - aucun texte de Brevo ne sort d'ici : on rend un mot du bureau.

   LOT 88 : `envoyer` (tout membre) fait partir UN mail ecrit dans un redacteur du bureau, au
   seul destinataire affiche, quand le vigneron clique. La base dit si ce mail-la part par
   Brevo (`brevo_pour_envoi`) ; si Brevo doit envoyer et ne peut pas, RIEN ne part, et on ne
   bascule pas sur la boite (decision de Ted du 08/10/2026). Plafond : 200 par jour et par
   personne, demande AVANT Brevo.

   LOT 89 : `liste` (tout membre) cree dans Brevo une liste NEUVE et datee, dans le dossier
   « Le bureau du vigneron », avec les adresses et les mobiles que le navigateur envoie (5 000
   au plus). AVANT d'y mettre qui que ce soit, la fonction lit tout le carnet du compte Brevo
   et ECARTE chaque contact desinscrit (mail ou SMS) : un desinscrit n'est jamais renvoye a
   Brevo, quelle que soit la facon dont Brevo traiterait un import. Si le carnet ne se lit pas
   en entier, rien ne part. `liste_etat` dit ou en est l'import chez Brevo.

   DEPLOIEMENT : APRES le SQL du lot 87 et APRES le commit, verify_jwt = true. Aucun secret a
   poser : SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis.
   ============================================================================ */

import { envoyerBrevo, MOTS_BREVO } from '../_shared/brevo.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BREVO = 'https://api.brevo.com/v3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
function reponse(corps: unknown, code = 200) {
  return new Response(JSON.stringify(corps), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });
}
const texte = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);

async function quiAppelle(jwt: string) {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: jwt } });
    if (!r.ok) return null;
    const u = await r.json().catch(() => null);
    return u && u.id ? { id: String(u.id) } : null;
  } catch { return null; }
}
async function rpc(nom: string, corps: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corps),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${nom} ${r.status}`);
  return t ? JSON.parse(t) : null;
}

/* Un appel a Brevo. Rend { statut, corps } ; statut 0 = Brevo n'a pas repondu a temps. */
async function brevo(cle: string, chemin: string) {
  try {
    const r = await fetch(`${BREVO}${chemin}`, {
      headers: { 'api-key': cle, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    const t = await r.text();
    let corps: unknown = null;
    try { corps = t ? JSON.parse(t) : null; } catch { corps = null; }
    return { statut: r.status, corps: corps as Record<string, unknown> | null, brut: t.slice(0, 500) };
  } catch {
    return { statut: 0, corps: null, brut: '' };
  }
}

/* Une ecriture chez Brevo (POST). Meme forme de reponse que `brevo()`. */
async function brevoPoster(cle: string, chemin: string, corps: unknown) {
  try {
    const r = await fetch(`${BREVO}${chemin}`, {
      method: 'POST',
      headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(20000),
    });
    const t = await r.text();
    let c: unknown = null;
    try { c = t ? JSON.parse(t) : null; } catch { c = null; }
    return { statut: r.status, corps: c as Record<string, unknown> | null, brut: t.slice(0, 500) };
  } catch {
    return { statut: 0, corps: null, brut: '' };
  }
}

/* Ce que veut dire un refus de Brevo, en mots du bureau.
   [Supposition] Brevo repond 401 a une cle inconnue, desactivee, ou appelee depuis une adresse
   internet qu'il bloque ; seul son texte les distingue. On le lit, on ne le renvoie jamais. */
function motDuRefus(statut: number, brut: string) {
  if (statut === 0) return { resultat: 'injoignable', mot: 'Brevo ne répond pas. Réessaie dans un moment.' };
  if (/\bip\b|ip address|adresse ip/i.test(brut)) return { resultat: 'ip',
    mot: 'Brevo bloque les appels du bureau. Dans Brevo, ouvre Sécurité, puis Adresses IP autorisées, et désactive le blocage des adresses inconnues.' };
  if (statut === 401 || statut === 403) return { resultat: 'refusee',
    mot: 'Brevo refuse cette clé : elle est fausse, désactivée ou supprimée. Crée une nouvelle clé API dans Brevo.' };
  return { resultat: 'erreur', mot: `Brevo n’a pas répondu comme prévu (code ${statut}). Réessaie dans un moment.` };
}

function creditsSms(compte: Record<string, unknown> | null) {
  const plan = compte && Array.isArray(compte.plan) ? compte.plan as Array<Record<string, unknown>> : [];
  const sms = plan.find((p) => String(p.type ?? '') === 'sms');
  const n = sms ? Number(sms.credits) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function brancher(moi: string, bureau: string, cle: string) {
  if (!(await rpc('brevo_est_maitre', { p_personne: moi, p_bureau: bureau }))) {
    return reponse({ erreur: 'Seul le maître du bureau branche Brevo.' }, 403);
  }
  if (/^xsmtpsib-/i.test(cle)) return reponse({ resultat: 'cle_smtp',
    mot: 'C’est une clé SMTP. Il faut une clé API : dans Brevo, SMTP et API, onglet Clés API, puis Générer une nouvelle clé API.' });
  if (cle.length < 20 || cle.length > 200 || /\s/.test(cle)) return reponse({ resultat: 'forme',
    mot: 'Ce texte ne ressemble pas à une clé API Brevo. Copie-la en entier, elle commence d’habitude par xkeysib-.' });
  const r = await brevo(cle, '/account');
  if (r.statut !== 200 || !r.corps) return reponse(motDuRefus(r.statut, r.brut));
  const email = texte(r.corps.email, 254);
  const nom = texte(r.corps.companyName, 120);
  await rpc('brevo_ranger', { p_personne: moi, p_bureau: bureau, p_cle: cle, p_email: email, p_nom: nom });
  return reponse({ resultat: 'branche', compte_email: email, compte_nom: nom, credits_sms: creditsSms(r.corps) });
}

async function expediteurs(moi: string, bureau: string) {
  if (!(await rpc('brevo_est_membre', { p_personne: moi, p_bureau: bureau }))) {
    return reponse({ erreur: 'pas membre de ce bureau' }, 403);
  }
  const cle = await rpc('brevo_cle', { p_bureau: bureau });
  if (!cle) return reponse({ resultat: 'pas_branche' });
  const r = await brevo(String(cle), '/senders');
  if (r.statut !== 200 || !r.corps) {
    const m = motDuRefus(r.statut, r.brut);
    if (m.resultat === 'refusee' || m.resultat === 'ip') {
      try { await rpc('brevo_noter', { p_bureau: bureau, p_etat: 'refusee', p_erreur: m.mot }); } catch { /* l'ecran le dit deja */ }
    }
    return reponse(m);
  }
  try { await rpc('brevo_noter', { p_bureau: bureau, p_etat: 'branche', p_erreur: null }); } catch { /* sans gravite */ }
  const liste = Array.isArray(r.corps.senders) ? r.corps.senders as Array<Record<string, unknown>> : [];
  const vus = new Set<string>();
  const out = [];
  for (const s of liste) {
    const email = texte(s.email, 254).toLowerCase();
    if (!email || vus.has(email)) continue;
    vus.add(email);
    out.push({ email, nom: texte(s.name, 80), actif: s.active === true });
  }
  out.sort((a, b) => Number(b.actif) - Number(a.actif) || a.email.localeCompare(b.email));
  return reponse({ resultat: 'ok', expediteurs: out.slice(0, 100) });
}

/* Pas de parenthese, chevron, virgule, point-virgule, deux-points, guillemet ni crochet :
   l'adresse controlee est exactement celle qui part (meme regle que la fonction `boite`). */
const ADRESSE = /^[^@\s()<>,;:"\[\]\\]+@[^@\s()<>,;:"\[\]\\]+\.[a-z]{2,}$/i;
const SORTES = ['affaires', 'devis'];

async function envoyer(moi: string, bureau: string, corps: Record<string, unknown>) {
  const sorte = String(corps.sorte ?? '');
  if (!SORTES.includes(sorte)) return reponse({ erreur: 'sorte inconnue' }, 400);
  const a = texte(corps.adresse, 254).toLowerCase();
  if (!ADRESSE.test(a)) return reponse({ resultat: 'destinataire', mot: 'Cette adresse ne ressemble pas à une adresse mail.' }, 400);
  const sujet = texte(corps.sujet, 300);
  const corpsTexte = String(corps.texte ?? '').replace(/\r\n/g, '\n').slice(0, 20000);
  if (!sujet && !corpsTexte.trim()) return reponse({ erreur: 'Écris un objet ou un texte.' }, 400);
  const l = await rpc('brevo_pour_envoi', { p_personne: moi, p_bureau: bureau, p_sorte: sorte });
  const b = Array.isArray(l) && l[0] ? l[0] : null;
  if (!b || b.etat !== 'ok') {
    const etat = b ? String(b.etat) : 'pas_branche';
    /* « pas_branche », « par_ma_boite », « pas_pour_cette_sorte » : ce mail ne passe pas par
       Brevo ; le navigateur le savait deja, il s'est trompe de chemin. Rien n'est parti. */
    return reponse({ resultat: etat, mot: MOTS_BREVO[etat] ?? 'Ce mail ne part pas par Brevo : rien n’est parti.' });
  }
  const id = await rpc('brevo_envoi_permis', { p_personne: moi, p_bureau: bureau, p_sorte: sorte });
  if (id == null) return reponse({ resultat: 'plafond', mot: MOTS_BREVO.plafond });
  const r = await envoyerBrevo({ cle: String(b.cle), expediteur: String(b.expediteur), nom: b.nom ? String(b.nom) : null, copie: b.copie !== false },
    a, sujet, corpsTexte, [sorte]);
  if (r.resultat === 'parti') {
    try { await rpc('brevo_envoi_noter', { p_id: id, p_message_id: r.messageId || null }); } catch { /* le mail est parti quand meme */ }
    return reponse({ resultat: 'parti', de: String(b.expediteur), copie: b.copie !== false, par: 'brevo' });
  }
  if (r.resultat === 'refus_cle') {
    const mot = r.ip ? MOTS_BREVO.ip : MOTS_BREVO.refus_cle;
    try { await rpc('brevo_noter', { p_bureau: bureau, p_etat: 'refusee', p_erreur: mot }); } catch { /* l'ecran le dit */ }
    return reponse({ resultat: 'refus_cle', mot });
  }
  if (r.resultat === 'incertain') return reponse({ resultat: 'incertain' });
  return reponse({ resultat: r.resultat, mot: MOTS_BREVO[r.resultat] ?? MOTS_BREVO.erreur, code: r.code });
}

/* ------------------------------------------------------------------ LOT 89 : LES LISTES */
const DOSSIER = 'Le bureau du vigneron';
const MAX_CONTACTS = 5000;
const PAGE = 1000;              // [Certain, doc Brevo] GET /v3/contacts : 1 000 par page au plus
const PAGES_MAX = 100;          // 100 000 contacts lus au plus
const DUREE_LECTURE = 60000;    // une minute pour lire le carnet, sinon rien ne part
const SMS = /^\+[1-9]\d{7,14}$/;
const chiffres = (v: unknown) => String(v ?? '').replace(/\D/g, '');
/* La cle de comparaison d'un numero : « 0033 6... », « +33 6... », « 33 6... » et « 06... »
   donnent la meme. Ecarter un peu trop est sans danger ; ne pas reconnaitre un desinscrit l'est. */
function cleSms(v: unknown) {
  let d = chiffres(v);
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = '33' + d.slice(1);
  return d;
}

/* La liste noire du compte : chaque contact desinscrit des mails OU des SMS, par son adresse
   et par son numero. Un contact qui l'est pour l'un est ecarte pour les deux. */
async function listeNoire(cle: string) {
  const emails = new Set<string>(), sms = new Set<string>();
  const debut = Date.now();
  let total = -1, lus = 0;
  for (let p = 0; p < PAGES_MAX; p++) {
    if (Date.now() - debut > DUREE_LECTURE) return { trop: true as const };
    const r = await brevo(cle, `/contacts?limit=${PAGE}&offset=${p * PAGE}&sort=asc`);
    if (r.statut !== 200 || !r.corps) return { refus: motDuRefus(r.statut, r.brut) };
    const l = Array.isArray(r.corps.contacts) ? r.corps.contacts as Array<Record<string, unknown>> : [];
    if (p === 0 && Number.isFinite(Number(r.corps.count))) total = Number(r.corps.count);
    lus += l.length;
    for (const c of l) {
      if (c.emailBlacklisted !== true && c.smsBlacklisted !== true) continue;
      const e = texte(c.email, 254).toLowerCase();
      if (e) emails.add(e);
      const a = (c.attributes && typeof c.attributes === 'object') ? c.attributes as Record<string, unknown> : {};
      const n = cleSms(a.SMS);
      if (n.length >= 8) sms.add(n);
    }
    /* Une page courte dit la fin du carnet, a condition d'avoir lu autant que Brevo en annonce :
       sinon un desinscrit pourrait rester non lu, et rien ne part. */
    if (l.length < PAGE) return (total >= 0 && lus < total) ? { trop: true as const } : { emails, sms };
  }
  return { trop: true as const };
}

/* Le dossier « Le bureau du vigneron » : retrouve, sinon cree. */
async function dossier(cle: string): Promise<number | null> {
  for (let p = 0; p < 30; p++) {
    const r = await brevo(cle, `/contacts/folders?limit=10&offset=${p * 10}`);
    if (r.statut !== 200 || !r.corps) return null;
    const l = Array.isArray(r.corps.folders) ? r.corps.folders as Array<Record<string, unknown>> : [];
    const vu = l.find((f) => String(f.name ?? '').trim() === DOSSIER);
    if (vu && Number.isFinite(Number(vu.id))) return Number(vu.id);
    if (l.length < 10) break;
  }
  const c = await brevoPoster(cle, '/contacts/folders', { name: DOSSIER });
  return (c.statut === 201 || c.statut === 200) && c.corps && Number.isFinite(Number(c.corps.id)) ? Number(c.corps.id) : null;
}

/* Les contacts envoyes par le navigateur, nettoyes : une adresse valide et/ou un mobile au
   format international. Ni nom, ni autre attribut. Seul le mobile d'un contact deja connu de
   Brevo peut etre mis a jour (celui de Vitisoft). */
function contactsPropres(v: unknown) {
  const out: Array<{ e: string; s: string }> = [];
  const ve = new Set<string>(), vs = new Set<string>();
  for (const x of Array.isArray(v) ? v : []) {
    const o = (x && typeof x === 'object') ? x as Record<string, unknown> : {};
    let e = texte(o.e, 254).toLowerCase();
    let s = texte(o.s, 20);
    if (e && (!ADRESSE.test(e) || ve.has(e))) e = '';
    if (s && (!SMS.test(s) || vs.has(cleSms(s)))) s = '';
    if (!e && !s) continue;
    if (e) ve.add(e);
    if (s) vs.add(cleSms(s));
    out.push({ e, s });
  }
  return out;
}

async function liste(moi: string, bureau: string, corps: Record<string, unknown>) {
  const source = String(corps.source ?? '');
  if (!['clients', 'commerce'].includes(source)) return reponse({ erreur: 'source inconnue' }, 400);
  const nom = texte(corps.nom, 100);
  if (!nom) return reponse({ erreur: 'Donne un nom à la liste.' }, 400);
  if (!Array.isArray(corps.contacts) || corps.contacts.length > MAX_CONTACTS) {
    return reponse({ resultat: 'trop', mot: 'Une liste part avec 5 000 contacts au plus. Resserre tes filtres.' });
  }
  const contacts = contactsPropres(corps.contacts);
  if (!contacts.length) return reponse({ resultat: 'vide', mot: 'Aucune adresse ni aucun mobile utilisable dans cette liste.' });
  if (!(await rpc('brevo_est_membre', { p_personne: moi, p_bureau: bureau }))) {
    return reponse({ erreur: 'pas membre de ce bureau' }, 403);
  }
  const cle = await rpc('brevo_cle', { p_bureau: bureau });
  if (!cle) return reponse({ resultat: 'pas_branche', mot: 'Brevo n’est pas branché sur ce bureau.' });
  if (!(await rpc('brevo_liste_permise', { p_personne: moi, p_bureau: bureau }))) {
    return reponse({ resultat: 'plafond', mot: '20 listes créées aujourd’hui par le bureau : la limite du jour est atteinte.' });
  }

  const noire = await listeNoire(String(cle));
  if ('refus' in noire && noire.refus) {
    const m = noire.refus;
    if (m.resultat === 'refusee' || m.resultat === 'ip') {
      try { await rpc('brevo_noter', { p_bureau: bureau, p_etat: 'refusee', p_erreur: m.mot }); } catch { /* l'ecran le dit */ }
    }
    return reponse({ resultat: m.resultat, mot: m.mot + ' Aucune liste n’a été créée.' });
  }
  if ('trop' in noire) {
    return reponse({ resultat: 'carnet_trop_long', mot: 'Le carnet Brevo est trop grand pour être relu à temps : le bureau n’a pas pu écarter les désinscrits, et n’a rien envoyé.' });
  }
  const garder = contacts.filter((c) => !(c.e && noire.emails.has(c.e)) && !(c.s && noire.sms.has(cleSms(c.s))));
  const retires = (corps.contacts as unknown[]).length - contacts.length;
  const ecartes = contacts.length - garder.length;
  if (!garder.length) return reponse({ resultat: 'tous_desinscrits', ecartes, mot: 'Tous ces contacts se sont désinscrits chez Brevo : aucune liste n’a été créée.' });

  const dos = await dossier(String(cle));
  if (dos == null) return reponse({ resultat: 'erreur', mot: 'Brevo n’a pas ouvert le dossier « ' + DOSSIER + ' ». Aucune liste n’a été créée. Réessaie dans un moment.' });
  const l = await brevoPoster(String(cle), '/contacts/lists', { name: nom, folderId: dos });
  const listeId = l.corps && Number.isFinite(Number(l.corps.id)) ? Number(l.corps.id) : null;
  if (!(l.statut === 201 || l.statut === 200) || listeId == null) {
    return reponse({ resultat: 'erreur', mot: l.statut === 0
      ? 'Brevo n’a pas répondu à temps. Regarde dans Brevo (Contacts, Listes) si la liste « ' + nom + ' » existe avant de réessayer.'
      : 'Brevo n’a pas créé la liste (ce nom existe peut-être déjà). Change le nom et réessaie.' });
  }
  const imp = await brevoPoster(String(cle), '/contacts/import', {
    jsonBody: garder.map((c) => c.e ? { email: c.e, attributes: c.s ? { SMS: c.s } : {} } : { attributes: { SMS: c.s } }),
    listIds: [listeId],
    updateExistingContacts: true,
    emptyContactsAttributes: false,
    disableNotification: true,
  });
  const process = imp.corps && Number.isFinite(Number(imp.corps.processId)) ? Number(imp.corps.processId) : null;
  if (imp.statut === 0) {
    /* Pas de reponse : Brevo a peut-etre pris les contacts. On note la liste, et on le dit. */
    try { await rpc('brevo_liste_noter', { p_personne: moi, p_bureau: bureau, p_nom: nom, p_source: source,
      p_liste_id: listeId, p_process_id: null, p_envoyes: garder.length, p_ecartes: ecartes }); } catch { /* rien */ }
    return reponse({ resultat: 'incertain', mot: 'La liste « ' + nom + ' » est créée dans Brevo, mais Brevo n’a pas répondu à temps pour les contacts. Regarde dans quelques minutes si elle se remplit (Contacts, Listes) avant de réessayer.' });
  }
  if (!(imp.statut === 202 || imp.statut === 200 || imp.statut === 201)) {
    return reponse({ resultat: 'import_refuse', mot: 'La liste « ' + nom + ' » est créée dans Brevo, mais Brevo a refusé les contacts : elle est vide. Supprime-la dans Brevo et réessaie.' });
  }
  let id: unknown = null;
  try {
    id = await rpc('brevo_liste_noter', { p_personne: moi, p_bureau: bureau, p_nom: nom, p_source: source,
      p_liste_id: listeId, p_process_id: process, p_envoyes: garder.length, p_ecartes: ecartes });
  } catch { /* la liste est chez Brevo quand meme */ }
  return reponse({ resultat: 'creee', nom, liste_id: listeId, process_id: process, id,
    envoyes: garder.length, avec_mail: garder.filter((c) => c.e).length, avec_mobile: garder.filter((c) => c.s).length, ecartes, retires });
}

/* Ou en est l'import chez Brevo. Les soucis sont des categories, jamais un texte de Brevo. */
const SOUCIS: Record<string, string> = {
  invalid_emails: 'des adresses que Brevo juge invalides',
  duplicate_email_id: 'des adresses en double',
  duplicate_phone_id: 'des mobiles déjà portés par un autre contact de Brevo',
  duplicate_contact_id: 'des contacts en double',
  duplicate_ext_id: 'des contacts en double',
  duplicate_whatsapp_id: 'des numéros en double',
  duplicate_landline_number_id: 'des numéros en double',
};
async function listeEtat(moi: string, bureau: string, corps: Record<string, unknown>) {
  const p = Number(corps.process);
  if (!Number.isInteger(p) || p <= 0) return reponse({ erreur: 'import inconnu' }, 400);
  if (!(await rpc('brevo_est_membre', { p_personne: moi, p_bureau: bureau }))) {
    return reponse({ erreur: 'pas membre de ce bureau' }, 403);
  }
  const cle = await rpc('brevo_cle', { p_bureau: bureau });
  if (!cle) return reponse({ resultat: 'pas_branche', mot: 'Brevo n’est pas branché sur ce bureau.' });
  const r = await brevo(String(cle), `/processes/${p}`);
  if (r.statut !== 200 || !r.corps) return reponse(motDuRefus(r.statut, r.brut));
  const statut = texte(r.corps.status, 20);
  const info = (r.corps.info && typeof r.corps.info === 'object') ? r.corps.info as Record<string, unknown> : {};
  const imp = (info.import && typeof info.import === 'object') ? info.import as Record<string, unknown> : {};
  const soucis = Array.from(new Set(Object.keys(SOUCIS).filter((k) => imp[k]).map((k) => SOUCIS[k])));
  return reponse({ resultat: 'etat', statut, soucis });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reponse({ erreur: 'methode' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return reponse({ erreur: 'configuration absente' }, 503);
  const jwt = req.headers.get('Authorization') ?? '';
  if (!jwt.startsWith('Bearer ')) return reponse({ erreur: 'aucune session' }, 401);
  let corps: Record<string, unknown>;
  try { corps = await req.json(); } catch { return reponse({ erreur: 'corps illisible' }, 400); }
  const action = String(corps.action ?? '');
  /* Un mail peut etre long (un devis, une signature) : 25 000 signes pour `envoyer`. */
  /* Une liste de 5 000 contacts tient sous 400 000 signes. */
  const limite = action === 'envoyer' ? 25000 : action === 'liste' ? 400000 : 2000;
  if (JSON.stringify(corps).length > limite) return reponse({ resultat: 'trop_long', erreur: 'trop long' }, 413);
  const moi = await quiAppelle(jwt);
  if (!moi) return reponse({ erreur: 'aucune session' }, 401);
  const bureau = texte(corps.bureau, 40);
  if (!/^[0-9a-f-]{36}$/i.test(bureau)) return reponse({ erreur: 'bureau inconnu' }, 400);
  try {
    if (action === 'envoyer') return await envoyer(moi.id, bureau, corps);
    if (action === 'liste') return await liste(moi.id, bureau, corps);
    if (action === 'liste_etat') return await listeEtat(moi.id, bureau, corps);
    if (action === 'brancher') return await brancher(moi.id, bureau, String(corps.cle ?? '').trim());
    if (action === 'expediteurs') return await expediteurs(moi.id, bureau);
    return reponse({ erreur: 'action inconnue' }, 400);
  } catch {
    return reponse({ erreur: 'Le bureau n’a pas pu parler à sa base. Réessaie dans un moment.' }, 500);
  }
});
