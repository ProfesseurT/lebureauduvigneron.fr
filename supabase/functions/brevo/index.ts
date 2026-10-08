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

   CE LOT N'ENVOIE AUCUN MAIL. Le lot 88 ajoutera l'envoi.

   DEPLOIEMENT : APRES le SQL du lot 87 et APRES le commit, verify_jwt = true. Aucun secret a
   poser : SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis.
   ============================================================================ */

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reponse({ erreur: 'methode' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return reponse({ erreur: 'configuration absente' }, 503);
  const jwt = req.headers.get('Authorization') ?? '';
  if (!jwt.startsWith('Bearer ')) return reponse({ erreur: 'aucune session' }, 401);
  let corps: Record<string, unknown>;
  try { corps = await req.json(); } catch { return reponse({ erreur: 'corps illisible' }, 400); }
  if (JSON.stringify(corps).length > 2000) return reponse({ erreur: 'trop long' }, 413);
  const moi = await quiAppelle(jwt);
  if (!moi) return reponse({ erreur: 'aucune session' }, 401);
  const bureau = texte(corps.bureau, 40);
  if (!/^[0-9a-f-]{36}$/i.test(bureau)) return reponse({ erreur: 'bureau inconnu' }, 400);
  const action = String(corps.action ?? '');
  try {
    if (action === 'brancher') return await brancher(moi.id, bureau, String(corps.cle ?? '').trim());
    if (action === 'expediteurs') return await expediteurs(moi.id, bureau);
    return reponse({ erreur: 'action inconnue' }, 400);
  } catch {
    return reponse({ erreur: 'Le bureau n’a pas pu parler à sa base. Réessaie dans un moment.' }, 500);
  }
});
