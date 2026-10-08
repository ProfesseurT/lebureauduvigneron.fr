/* ============================================================================
   supabase/functions/google-retour : brancher sa boite « avec Google » (lot 86, 08/10/2026)
   ----------------------------------------------------------------------------
   Option D, Google seul (arbitrage de Ted du 08/10/2026). DEUX GESTES :
     - POST { action: 'commencer', bureau, retour } avec le jeton de session : la fonction tire
       un jeton « state » au hasard, en range l'EMPREINTE (`google_etat_poser`, 10 minutes, une
       seule fois, 10 par heure), et rend l'adresse de la page de Google ;
     - GET ?code=...&state=... : Google y renvoie le navigateur (verify_jwt = false). La
       fonction ne range rien : elle renvoie au bureau, sur la MEME adresse que celle de depart
       (la session vit dans le navigateur, par site), avec le code et l'etat ;
     - POST { action: 'finir', code, etat } avec le jeton de session : l'etat doit avoir ete
       pose par CETTE personne (contre la connexion forcee). Puis l'echange du code, la
       permission d'envoi verifiee, l'adresse lue dans le jeton d'identite (recu de Google en
       direct, en HTTPS), et le jeton de renouvellement range dans Vault (`boite_google_ranger`).

   Permissions demandees : `gmail.send` (envoyer en ton nom, rien lire) et l'adresse (openid
   email). Jamais `https://mail.google.com/` : elle exigerait un audit payant.

   Ce qui ne sort jamais d'ici : le code, les jetons, et les messages de Google.
   Secrets : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (Ted, une fois). Deploiement : APRES le SQL
   du lot 86, verify_jwt = false.
   ============================================================================ */
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
/* Ecrite en dur : elle doit etre EXACTEMENT celle declaree chez Google (Clients, URI de redirection). */
const REDIRECT = 'https://qukmncqqwomhmrdhvetj.supabase.co/functions/v1/google-retour';
const PORTEE = 'openid email https://www.googleapis.com/auth/gmail.send';
const SITES = ['https://lebureauduvigneron.fr', 'https://www.lebureauduvigneron.fr', 'https://lebureauduvigneron.vercel.app'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Cache-Control': 'no-store',
};
function reponse(corps: unknown, code = 200) {
  return new Response(JSON.stringify(corps), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });
}
/* Le retour au bureau : ?google=<issue>. Jamais autre chose qu'une des trois adresses. */
function revenir(site: string, issue: string) {
  const base = SITES.includes(site) ? site : SITES[0];
  return new Response(null, { status: 303, headers: { Location: base + '/mon-bureau/?google=' + encodeURIComponent(issue), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
async function empreinte(t: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
}
async function rpc(nom: string, corps: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corps),
  });
  const t = await r.text();
  if (!r.ok) { const e = new Error(`${nom} ${r.status}`) as Error & { corps?: string }; e.corps = t.slice(0, 300); throw e; }
  return t ? JSON.parse(t) : null;
}
async function quiAppelle(jwt: string) {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: jwt } });
    if (!r.ok) return null;
    const u = await r.json().catch(() => null);
    return u && u.id ? { id: String(u.id) } : null;
  } catch { return null; }
}
/* Le jeton d'identite vient de Google en direct, sur HTTPS : sa signature n'a pas a etre
   verifiee ici (documentation OpenID de Google). On n'en lit que l'adresse. */
function adresseDuJeton(idt: string): string | null {
  try {
    const p = idt.split('.')[1] ?? '';
    const j = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((p.length + 3) % 4)));
    const a = String(j.email ?? '').toLowerCase();
    if (j.email_verified !== true && j.email_verified !== 'true') return null;
    return /^[^@\s()<>,;:"\[\]\\]+@[^@\s()<>,;:"\[\]\\]+\.[a-z]{2,}$/i.test(a) && a.length <= 254 ? a : null;
  } catch { return null; }
}

async function commencer(req: Request) {
  if (!CLIENT_ID || !CLIENT_SECRET) return reponse({ erreur: 'La connexion avec Google n’est pas encore en place sur ce bureau.' }, 503);
  const jwt = req.headers.get('Authorization') ?? '';
  const moi = jwt.startsWith('Bearer ') ? await quiAppelle(jwt) : null;
  if (!moi) return reponse({ erreur: 'aucune session' }, 401);
  let corps: Record<string, unknown>;
  try { corps = await req.json(); } catch { return reponse({ erreur: 'corps illisible' }, 400); }
  const bureau = String(corps.bureau ?? '');
  const site = String(corps.retour ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(bureau)) return reponse({ erreur: 'bureau inconnu' }, 400);
  if (!SITES.includes(site)) return reponse({ erreur: 'adresse de retour inconnue' }, 400);
  const b = new Uint8Array(32); crypto.getRandomValues(b);
  const etat = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  let permis = false;
  try { permis = await rpc('google_etat_poser', { p_personne: moi.id, p_bureau: bureau, p_hash: await empreinte(etat), p_retour: site }) === true; }
  catch (e) {
    const c = String((e as { corps?: string }).corps ?? '');
    return reponse({ erreur: /pas membre/.test(c) ? 'Tu n’es pas membre de ce bureau.' : 'Le bureau n’a pas pu préparer la connexion.' }, 400);
  }
  if (!permis) return reponse({ erreur: 'Trop d’essais en une heure. Réessaie plus tard.' }, 429);
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', CLIENT_ID);
  u.searchParams.set('redirect_uri', REDIRECT);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', PORTEE);
  u.searchParams.set('access_type', 'offline');
  /* `consent` : Google redonne un jeton de renouvellement meme si l'acces a deja ete donne. */
  u.searchParams.set('prompt', 'consent select_account');
  u.searchParams.set('state', etat);
  const indice = String(corps.adresse ?? '').trim().toLowerCase();
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(indice) && indice.length <= 254) u.searchParams.set('login_hint', indice);
  return reponse({ url: u.toString() });
}

/* LE RETOUR DE GOOGLE (GET). On ne range RIEN ici : on renvoie le navigateur au bureau avec le
   code et l'etat, et c'est le bureau, avec la session du vigneron, qui finit (`finir`). Sans
   ca, quelqu'un pourrait commencer une connexion pour SON bureau, envoyer le lien a un
   vigneron, et recevoir l'acces a la boite Gmail de ce vigneron (connexion forcee). */
async function retour(url: URL) {
  const etat = url.searchParams.get('state') ?? '';
  if (!/^[0-9a-f]{64}$/.test(etat)) return revenir(SITES[0], 'expire');
  let site: string | null = null;
  try { site = await rpc('google_etat_voir', { p_hash: await empreinte(etat) }); } catch { return revenir(SITES[0], 'erreur'); }
  if (!site) return revenir(SITES[0], 'expire');
  if (url.searchParams.get('error')) {
    try { await rpc('google_etat_prendre', { p_hash: await empreinte(etat) }); } catch { /* rien */ }
    return revenir(site, 'annule');
  }
  const code = url.searchParams.get('code') ?? '';
  if (!code || code.length > 2000) return revenir(site, 'erreur');
  const base = SITES.includes(site) ? site : SITES[0];
  return new Response(null, { status: 303, headers: {
    Location: base + '/mon-bureau/?google=fin&g_code=' + encodeURIComponent(code) + '&g_etat=' + etat,
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

/* FINIR (POST, avec la session) : l'etat doit avoir ete pose par CETTE personne. */
async function finir(req: Request) {
  if (!CLIENT_ID || !CLIENT_SECRET) return reponse({ resultat: 'erreur' }, 503);
  const jwt = req.headers.get('Authorization') ?? '';
  const moi = jwt.startsWith('Bearer ') ? await quiAppelle(jwt) : null;
  if (!moi) return reponse({ erreur: 'aucune session' }, 401);
  const corps = await req.json().catch(() => ({})) as Record<string, unknown>;
  const etat = String(corps.etat ?? ''), code = String(corps.code ?? '');
  if (!/^[0-9a-f]{64}$/.test(etat) || !code || code.length > 2000) return reponse({ resultat: 'erreur' });
  let qui: { personne: string; bureau: string; retour: string } | null = null;
  try {
    const l = await rpc('google_etat_prendre', { p_hash: await empreinte(etat) });
    qui = Array.isArray(l) && l[0] ? l[0] : null;
  } catch { console.log('google: finir, etat illisible'); return reponse({ resultat: 'erreur' }); }
  if (!qui) { console.log('google: finir, etat expire ou deja pris'); return reponse({ resultat: 'expire' }); }
  if (qui.personne !== moi.id) { console.log('google: etat d un autre compte'); return reponse({ resultat: 'autre_compte' }); }
  let j: Record<string, unknown> = {};
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT }),
      signal: AbortSignal.timeout(10000),
    });
    j = await r.json().catch(() => ({}));
    if (!r.ok) { console.log('google: echange refuse ' + r.status + ' ' + String(j.error ?? '').slice(0, 40)); return reponse({ resultat: 'erreur' }); }
  } catch { console.log('google: echange sans reponse'); return reponse({ resultat: 'erreur' }); }
  /* L'ecran de Google laisse decocher une permission : sans `gmail.send`, rien a brancher. */
  const portee = String(j.scope ?? '').split(/\s+/);
  if (!portee.includes('https://www.googleapis.com/auth/gmail.send')) { console.log('google: case envoi non cochee'); return reponse({ resultat: 'permission' }); }
  const renouvellement = String(j.refresh_token ?? '');
  const adresse = adresseDuJeton(String(j.id_token ?? ''));
  if (!renouvellement || !adresse) { console.log('google: reponse incomplete' + (renouvellement ? '' : ' sans renouvellement') + (adresse ? '' : ' sans adresse verifiee')); return reponse({ resultat: 'erreur' }); }
  try {
    await rpc('boite_google_ranger', { p_personne: qui.personne, p_bureau: qui.bureau, p_adresse: adresse, p_jeton: renouvellement });
  } catch (e) {
    console.error('google: rangement impossible ' + String((e as Error).message));
    return reponse({ resultat: 'erreur' });
  }
  console.log('google: boite branchee');
  return reponse({ resultat: 'ok', adresse });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  if (req.method === 'GET') return await retour(url);
  if (req.method === 'POST') {
    const corps = await req.clone().json().catch(() => ({}));
    if (corps && corps.action === 'commencer') return await commencer(req);
    if (corps && corps.action === 'finir') return await finir(req);
    return reponse({ erreur: 'action inconnue' }, 400);
  }
  return reponse({ erreur: 'methode' }, 405);
});
