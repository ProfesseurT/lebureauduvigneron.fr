/* ============================================================================
   supabase/functions/notif-horaire : les notifications du matin et du soir
   (lot 61, 05/10/2026)
   ----------------------------------------------------------------------------
   QUI M'APPELLE. La tache `notif-horaire` de pg_cron (supabase/lot61-notif-horaire.sql),
   chaque heure a la demie, avec la cle NOTIF_CLE dans `x-notif-cle` (la meme que pour
   notif-commerce). Sans elle : 401.

   QUAND JE TRAVAILLE. A 7 h 30 (« matin ») et 17 h 30 (« soir »), heure de Paris. Le
   reste du temps je reponds « hors heure » et je ne touche a rien. L'heure se lit ici
   et pas dans le cron, qui tourne en heure de Greenwich (regle du courrier du matin).
   Pour un essai, un corps { "moment": "matin" } force le moment ; le journal empeche
   quand meme d'envoyer deux fois le meme jour.

   JE NE DECIDE DE RIEN. Qui, quoi, combien d'appareils : tout vient de
   `notif_horaire_lots()`, qui POSE aussi le journal avant de me rendre la liste. Je
   chiffre, j'envoie, je note, je retire les adresses mortes.

   DEPLOIEMENT : comme notif-commerce, avec verify_jwt = false (pg_net n'a pas de jeton
   de session). Secrets deja poses pour le projet : NOTIF_CLE, VAPID_PRIVATE.
   ============================================================================ */
import { envoyerAux, heureAParis, enSilence } from '../_shared/webpush.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLE          = Deno.env.get('NOTIF_CLE') ?? '';
const VAPID_PRIVEE = Deno.env.get('VAPID_PRIVATE') ?? '';

export const HEURE_MATIN = 7, HEURE_SOIR = 17;

/* Le moment, d'apres l'heure de Paris, ou celui que l'essai impose. */
export function momentDe(heure: number, force?: unknown) {
  if (force === 'matin' || force === 'soir') return force;
  if (heure === HEURE_MATIN) return 'matin';
  if (heure === HEURE_SOIR) return 'soir';
  return null;
}

function reponse(corps: unknown, code = 200) {
  return new Response(JSON.stringify(corps), {
    status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
function entetes(extra: Record<string, string> = {}) {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json', ...extra };
}
async function rpc(nom: string, corps: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, { method: 'POST', headers: entetes(), body: JSON.stringify(corps) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${nom} : ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}
/* Rend false si le journal n'a pas ete note : la reponse le compte (journal_rate), un
   refus ne passe plus sans bruit. Ce qui est parti est parti quand meme. */
async function noter(l: Record<string, any>, champs: Record<string, unknown>) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/push_journal?personne=eq.${l.personne}&jour=eq.${l.jour}&moment=eq.${l.moment}`, {
      method: 'PATCH', headers: entetes({ Prefer: 'return=minimal' }), body: JSON.stringify(champs), signal: AbortSignal.timeout(5000),
    });
    await r.body?.cancel();
    return r.ok;
  } catch { return false; }
}
async function oublierAppareil(endpoint: string) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/push_abonnements?endpoint=eq.${encodeURIComponent(endpoint)}`, {
      method: 'DELETE', headers: entetes({ Prefer: 'return=minimal' }), signal: AbortSignal.timeout(5000),
    });
  } catch { /* retiree au prochain passage */ }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function' && !Deno.env.get('NOTIF_BANC')) {
  Deno.serve(async (req) => {
    if (req.method !== 'POST') return reponse({ erreur: 'methode' }, 405);
    if (!SUPABASE_URL || !SERVICE_KEY) return reponse({ erreur: 'configuration' }, 500);
    if (!CLE || CLE.length < 32 || req.headers.get('x-notif-cle') !== CLE) return reponse({ erreur: 'cle' }, 401);
    let c: Record<string, unknown> = {};
    try { c = JSON.parse((await req.text()).slice(0, 500) || '{}'); } catch { c = {}; }

    /* Un essai force ne passe JAMAIS la nuit : il solderait les signatures de 20 h a 22 h
       sans qu'aucun vrai matin ne les annonce (trouve par le verificateur). */
    if (enSilence()) return reponse({ silence: heureAParis() });
    const moment = momentDe(heureAParis(), c?.moment);
    if (!moment) return reponse({ hors_heure: heureAParis() });
    if (!VAPID_PRIVEE) return reponse({ erreur: 'VAPID_PRIVATE absente' }, 500);

    let lots: Record<string, any>[] = [];
    try { lots = (await rpc('notif_horaire_lots', { p_moment: moment })) || []; }
    catch (e) { return reponse({ erreur: String(e) }, 500); }

    /* UN jeton VAPID par service d'envoi pour tout le passage, pas un par personne : Apple
       demande de ne pas le renouveler plus d'une fois par heure, et chaque signature coute. */
    const jetons = new Map<string, Promise<string>>();
    let personnes = 0, partis = 0, journal = 0;
    await Promise.allSettled(lots.map(async (l) => {
      const r = await envoyerAux(l.cibles || [], l.message || {}, VAPID_PRIVEE, jetons);
      for (const m of r.mortes) await oublierAppareil(m);
      if (r.partis) personnes++;
      partis += r.partis;
      if (!await noter(l, { partis: r.partis, echec: r.echec })) journal++;
    }));
    return reponse({ moment, lots: lots.length, personnes, notifications: partis, journal_rate: journal });
  });
}
