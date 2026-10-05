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

   LOT 63 : J'ENVOIE AUSSI DES MAILS. Pour qui a coche la colonne « Mail » de ses alertes,
   le lot rendu porte `mail` (adresse, prenom, detail). Le mail donne le DETAIL (noms,
   numeros, montants), la notification non. Le journal du mail (notif_mail_journal) est pose
   en base avant que je recoive la liste, comme celui des notifications.

   DEPLOIEMENT : comme notif-commerce, avec verify_jwt = false (pg_net n'a pas de jeton
   de session). Secrets deja poses pour le projet : NOTIF_CLE, VAPID_PRIVATE,
   RESEND_API_KEY, URL_BUREAU.
   ============================================================================ */
import { envoyerAux, heureAParis, enSilence } from '../_shared/webpush.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLE          = Deno.env.get('NOTIF_CLE') ?? '';
const VAPID_PRIVEE = Deno.env.get('VAPID_PRIVATE') ?? '';
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY') ?? '';
const URL_BUREAU   = Deno.env.get('URL_BUREAU') || 'https://lebureauduvigneron.fr/mon-bureau/';
const EXPEDITEUR   = 'Le Bureau du Vigneron <bureau@courrier.lebureauduvigneron.fr>';

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

/* ---------------------------------------------------------------------------
   LE MAIL DU MATIN ET DU SOIR (lot 63). Memes regles que notif-commerce : couleurs en dur
   avec le NOM du jeton copie, fond sur la cellule, 560 px, aucune image.
   --------------------------------------------------------------------------- */
const C = {
  papier: '#EFE7D6',   // --paper
  carte:  '#FFFFFF',   // --white
  encre:  '#1E2536',   // --ink
  doux:   '#63523D',   // --muted
  filet:  '#C9C4B9',   // --rule, aplati
  accent: '#5A1525',   // --bordeaux
};
function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
function euros(c: unknown) {
  const n = Number(c);
  if (!Number.isFinite(n)) return '';
  return (n / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ') + ' €';
}
function lien(id?: unknown) {
  try {
    const u = new URL(URL_BUREAU);
    if (id) u.hash = 'affaire=' + String(id);
    return u.toString();
  } catch { return URL_BUREAU; }
}

type Mail = Record<string, any>;
export function fabriquerHoraire(m: Mail, moment: string) {
  const rubriques: Array<{ titre: string; lignes: string[] }> = [];
  const ech = Array.isArray(m.echeances) ? m.echeances : [];
  const dev = Array.isArray(m.devis) ? m.devis : [];
  const rap = Array.isArray(m.rappels) ? m.rappels : [];
  if (ech.length) rubriques.push({ titre: 'Échéances qui coûtent une amende',
    lignes: ech.map((e: Mail) => `${e.court}, à faire ${e.quand}`) });
  if (dev.length) rubriques.push({ titre: 'Devis qui expirent demain sans réponse',
    lignes: dev.map((d: Mail) => `${d.numero}, ${d.client}${d.total_ht_c != null ? ', ' + euros(d.total_ht_c) + ' HT' : ''}`) });
  if (rap.length) rubriques.push({ titre: 'Rappels promis pour aujourd\'hui, pas faits',
    lignes: rap.map((r: Mail) => r.motif ? `${r.quoi} : ${r.motif}` : String(r.quoi)) });
  /* Une seule rubrique : le sujet la dit deja, l intertitre repeterait (le vigneron). */
  const seule = rubriques.length === 1;

  const sujet = String(m.sujet || (moment === 'soir' ? 'Tes rappels du jour' : 'Ce matin'));
  const bureau = String(m.bureau_nom || 'ton bureau');
  const bonjour = `Bonjour ${m.prenom || ''},`.replace(' ,', ',');
  const pied = `Tu reçois ce message parce que tu es membre du bureau ${bureau} et que ce mail est coché dans tes réglages, onglet « Le courrier », tableau « Mes alertes ». Tu peux l'y décocher.`;
  const url = lien();

  const blocs = rubriques.map((r) => (seule ? '' : `
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:16px 24px 6px 24px;font:bold 13px Arial,Helvetica,sans-serif;color:${C.doux};text-transform:uppercase;letter-spacing:1px;">${esc(r.titre)}</td></tr>`) + `
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:0 24px 6px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${r.lignes.map((l) => `
          <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};border-top:1px solid ${C.filet};padding:8px 0;font:15px Arial,Helvetica,sans-serif;color:${C.encre};">${esc(l)}</td></tr>`).join('')}
        </table>
      </td></tr>`).join('');

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(sujet)}</title></head>
<body style="margin:0;padding:0;background-color:${C.papier};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.papier}" style="background-color:${C.papier};">
  <tr><td align="center" bgcolor="${C.papier}" style="background-color:${C.papier};padding:24px 12px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};border-top:4px solid ${C.accent};padding:22px 24px 4px 24px;font:15px Arial,Helvetica,sans-serif;color:${C.encre};">${esc(bonjour)}</td></tr>
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:4px 24px 10px 24px;font:bold 20px Georgia,'Times New Roman',serif;color:${C.encre};line-height:1.3;">${esc(sujet)}.</td></tr>
      ${blocs}
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:16px 24px 26px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="${C.accent}" style="background-color:${C.accent};"><a href="${esc(url)}" style="display:inline-block;padding:13px 22px;font:bold 15px Arial,Helvetica,sans-serif;color:${C.carte};text-decoration:none;">Ouvrir mon bureau</a></td>
        </tr></table>
      </td></tr>
      <tr><td bgcolor="${C.papier}" style="background-color:${C.papier};padding:14px 24px;font:12px Arial,Helvetica,sans-serif;color:${C.doux};line-height:1.5;">${esc(pied)}</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const texte = [bonjour, '', sujet + '.', ...rubriques.flatMap((r) => ['', ...(seule ? [] : [r.titre.toUpperCase()]), ...r.lignes.map((l) => '- ' + l)]),
    '', `Ouvrir mon bureau : ${url}`, '', pied].join('\n');
  return { sujet, html, texte, vide: rubriques.length === 0 };
}

export const PAUSE_MAIL_MS = 600;
async function envoyerMail(a: string, f: { sujet: string; html: string; texte: string }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EXPEDITEUR, to: [a], subject: f.sujet, html: f.html, text: f.texte }),
  });
  const corps = await r.text();
  if (!r.ok) throw new Error(`Resend : ${r.status} ${corps.slice(0, 200)}`);
}
async function noterMail(l: Record<string, any>, champs: Record<string, unknown>) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/notif_mail_journal?personne=eq.${l.personne}&jour=eq.${l.jour}&moment=eq.${l.moment}`, {
      method: 'PATCH', headers: entetes({ Prefer: 'return=minimal' }), body: JSON.stringify(champs), signal: AbortSignal.timeout(5000),
    });
    await r.body?.cancel();
    return r.ok;
  } catch { return false; }
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

    let lots: Record<string, any>[] = [];
    try { lots = (await rpc('notif_horaire_lots', { p_moment: moment })) || []; }
    catch (e) { return reponse({ erreur: String(e) }, 500); }

    /* UN jeton VAPID par service d'envoi pour tout le passage, pas un par personne : Apple
       demande de ne pas le renouveler plus d'une fois par heure, et chaque signature coute. */
    const jetons = new Map<string, Promise<string>>();
    let personnes = 0, partis = 0, journal = 0;
    /* Sans cle VAPID, les notifications ne partent pas (le journal le dit) ; les mails,
       eux, partent quand meme. Et inversement sans cle Resend. */
    let mails = 0;
    const plafonnes = lots.reduce((n, l) => n + (Number(l.plafonnes) || 0), 0);
    lots = lots.filter((l) => l.personne);
    /* Les notifications partent toutes en meme temps ; les MAILS, un a la fois, avec une
       pause (Resend refuse au-dela de 2 par seconde, et un refus ne se rejoue pas : trouve par
       le verificateur du lot 63). */
    await Promise.allSettled(lots.map(async (l) => {
      if (l.message) {
        if (!VAPID_PRIVEE) { if (!await noter(l, { partis: 0, echec: 'VAPID_PRIVATE absente' })) journal++; }
        else {
          const r = await envoyerAux(l.cibles || [], l.message || {}, VAPID_PRIVEE, jetons);
          for (const m of r.mortes) await oublierAppareil(m);
          if (r.partis) personnes++;
          partis += r.partis;
          if (!await noter(l, { partis: r.partis, echec: r.echec })) journal++;
        }
      }
    }));
    let premier = true;
    for (const l of lots) {
      if (!l.mail) continue;
      /* Un echec ne se rejoue pas tout seul : mieux vaut un mail manquant qu'un mail double.
         Seule exception : un refus de debit (429), ou rien n'est parti, se retente UNE fois. */
      let champs: Record<string, unknown>;
      if (!RESEND_KEY) champs = { echec: 'RESEND_API_KEY absente' };
      else {
        if (!premier) await new Promise((ok) => setTimeout(ok, PAUSE_MAIL_MS));
        premier = false;
        const f = fabriquerHoraire(l.mail, String(l.moment));
        try { await envoyerMail(String(l.mail.email), f); mails++; champs = { envoye_le: new Date().toISOString() }; }
        catch (e) {
          if (/Resend : 429/.test(String(e))) {
            await new Promise((ok) => setTimeout(ok, 1500));
            try { await envoyerMail(String(l.mail.email), f); mails++; champs = { envoye_le: new Date().toISOString() }; }
            catch (e2) { champs = { echec: String(e2).slice(0, 300) }; }
          } else champs = { echec: String(e).slice(0, 300) };
        }
      }
      if (!await noterMail(l, champs)) journal++;
    }
    return reponse({ moment, lots: lots.length, personnes, notifications: partis, mails, plafonnes, journal_rate: journal });
  });
}
