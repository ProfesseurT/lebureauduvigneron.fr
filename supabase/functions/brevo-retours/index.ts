/* ============================================================================
   supabase/functions/brevo-retours : ce que Brevo renvoie au bureau (lot 90, 09/10/2026)
   ----------------------------------------------------------------------------
   Arbitrage de Ted du 09/10/2026 : Brevo previent le bureau EN TEMPS REEL. Les deux webhooks
   d'un bureau sont crees par la fonction `brevo` (action `retours_brancher`) et appellent :
     POST <projet>/functions/v1/brevo-retours?b=<bureau>, en-tete `x-bdv-jeton: <jeton>`.

   LA PORTE : [Certain, doc Brevo lue le 09/10/2026] Brevo ne signe pas ses webhooks. Le jeton,
   tire au hasard (32 octets) pour CE bureau, est la seule cle : on compare son empreinte a
   celle rangee par `brevo_retours_poser`. Mauvais jeton ou bureau inconnu : 401, rien n'est lu.
   Le jeton ne passe pas dans l'adresse (les journaux gardent les adresses, pas les en-tetes).

   CE QU'ON GARDE (`brevo_retour_noter`), et RIEN d'autre : l'empreinte de l'adresse, jamais
   l'adresse ; le motif ; la date ; pour un mail parti du bureau, sa premiere ouverture et son
   premier clic SI le client a accepte le suivi. Objet, lien clique, adresse IP, appareil :
   jamais lus.

   LES EVENEMENTS (noms des charges Brevo) :
     mails 1 a 1 : hard_bounce, invalid_email -> morte ; blocked -> bloquee ; spam -> spam ;
                   unsubscribed -> desinscrit ; opened, unique_opened -> ouvert ; click -> clic.
     campagnes   : hard_bounce -> morte ; unsubscribe -> desinscrit ; spam -> spam.
   Tout autre evenement : 200 et rien. Une charge de campagne porte `camp_id`.
   Brevo peut renvoyer le meme evenement (livraison « au moins une fois ») : la base ne garde
   que le premier.
   Une panne de la base : 500, pour que Brevo reessaie. Jamais un texte de la base renvoye.

   DEPLOIEMENT : APRES le SQL du lot 90 et APRES le commit, verify_jwt = FALSE (Brevo n'a pas
   de session : le jeton garde la porte). Aucun secret a poser.
   ============================================================================ */
import { empreinte, egaux } from '../_shared/empreinte.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function reponse(corps: unknown, code = 200) {
  return new Response(JSON.stringify(corps), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
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
async function sha256hex(t: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
  return Array.from(h, (o) => o.toString(16).padStart(2, '0')).join('');
}

const TRANSAC: Record<string, string> = {
  hard_bounce: 'morte', invalid_email: 'morte', blocked: 'bloquee', spam: 'spam',
  unsubscribed: 'desinscrit', opened: 'ouvert', unique_opened: 'ouvert', click: 'clic',
};
const CAMPAGNE: Record<string, string> = { hard_bounce: 'morte', unsubscribe: 'desinscrit', unsubscribed: 'desinscrit', spam: 'spam' };
const ADRESSE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* La date de l'evenement : `ts_event` (secondes, UTC), sinon `date_event` ou `date`, sinon
   maintenant. La base ramene une date future a maintenant. */
function quand(o: Record<string, unknown>) {
  const ts = Number(o.ts_event ?? o.ts_epoch);
  if (Number.isFinite(ts) && ts > 1e9) return new Date(ts > 1e12 ? ts : ts * 1000).toISOString();
  for (const k of ['date_event', 'date']) {
    const d = Date.parse(String(o[k] ?? ''));
    if (Number.isFinite(d)) return new Date(d).toISOString();
  }
  return new Date().toISOString();
}

/* Ce qu'un evenement devient pour la base, ou null s'il ne nous regarde pas. */
function lire(o: Record<string, unknown>) {
  const ev = String(o.event ?? '').trim().toLowerCase();
  const campagne = o.camp_id != null && o.camp_id !== '';
  const evenement = (campagne ? CAMPAGNE : TRANSAC)[ev];
  if (!evenement) return null;
  const email = String(o.email ?? '').trim().toLowerCase();
  if (!email || email.length > 254 || !ADRESSE.test(email)) return null;
  const mid = String(o['message-id'] ?? o.message_id ?? '').trim().slice(0, 200);
  return { evenement, source: campagne ? 'campagne' : 'transactionnel', email, message_id: campagne ? null : (mid || null), le: quand(o) };
}

async function traiter(req: Request): Promise<Response> {
  if (req.method !== 'POST') return reponse({ erreur: 'methode' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return reponse({ erreur: 'configuration absente' }, 503);
  const bureau = new URL(req.url).searchParams.get('b') ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bureau)) return reponse({ erreur: 'porte' }, 401);
  const jeton = (req.headers.get('x-bdv-jeton') ?? '').trim();
  if (jeton.length < 32 || jeton.length > 100) return reponse({ erreur: 'porte' }, 401);
  let attendu: unknown;
  try { attendu = await rpc('brevo_retours_jeton', { p_bureau: bureau }); }
  catch { return reponse({ erreur: 'base' }, 500); }
  if (typeof attendu !== 'string' || !egaux(await sha256hex(jeton), attendu)) return reponse({ erreur: 'porte' }, 401);

  const t = await req.text();
  if (t.length > 1_000_000) return reponse({ erreur: 'trop long' }, 413);
  let c: unknown;
  try { c = JSON.parse(t); } catch { return reponse({ erreur: 'corps illisible' }, 400); }
  const liste = (Array.isArray(c) ? c : [c]).slice(0, 1000);
  let notes = 0, ignores = 0;
  for (const x of liste) {
    if (!x || typeof x !== 'object') { ignores++; continue; }
    const e = lire(x as Record<string, unknown>);
    if (!e) { ignores++; continue; }
    try {
      const r = await rpc('brevo_retour_noter', { p_bureau: bureau, p_message_id: e.message_id,
        p_empreinte: await empreinte(bureau, e.email), p_source: e.source, p_evenement: e.evenement, p_le: e.le });
      if (r === 'inconnu') return reponse({ erreur: 'porte' }, 401);
      if (r === 'note') notes++; else ignores++;
    } catch {
      console.error('brevo-retours: la base n a pas pris un evenement');
      return reponse({ erreur: 'base' }, 500);
    }
  }
  return reponse({ ok: true, notes, ignores });
}

Deno.serve(traiter);
