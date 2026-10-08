/* ============================================================================
   supabase/functions/_shared/gmail.ts : envoyer par l'API Gmail (lot 86, 08/10/2026)
   ----------------------------------------------------------------------------
   Option D, Google seul (arbitrage de Ted du 08/10/2026, GUIDE_connexion-google-microsoft.md).
   Une boite branchee « avec Google » (`fournisseur = 'google_api'`) ne garde pas de mot de
   passe : Vault garde le JETON DE RENOUVELLEMENT que Google a donne (permission `gmail.send`
   seulement). A chaque envoi :
     1. le jeton de renouvellement donne un jeton d'acces d'une heure (oauth2.googleapis.com) ;
        un refus franc (`invalid_grant` : acces retire, mot de passe change, mode test expire au
        bout de 7 jours) rend `refus`, et l'appelant passe la boite a « reconnecter » ;
     2. le mail est fabrique par nodemailer (memes options que l'envoi SMTP : nom, logo en piece
        affichee), en texte brut RFC 822, SANS l'envoyer ;
     3. l'API Gmail l'envoie (`users.messages.send`). Gmail le range lui-meme dans Envoyes : pas
        de copie a soi, elle ferait un doublon dans la boite de reception.
   Comme pour le SMTP : une reponse qui ne vient pas laisse un doute (`incertain`), jamais
   « reessaie ». Aucun message de Google ne sort d'ici.
   Secrets : GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET (poses par Ted, une fois).
   ============================================================================ */
import nodemailer from 'npm:nodemailer@^9';

const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

export type IssueGmail = { resultat: 'parti' | 'refus' | 'passager' | 'incertain' | 'destinataire' | 'autre'; code?: number };

export function googlePret() { return !!(CLIENT_ID && CLIENT_SECRET); }

/* Le jeton d'acces. `refus` : Google ne reconnait plus l'acces (il faut se reconnecter). */
export async function jetonAcces(renouvellement: string): Promise<{ jeton?: string; refus?: boolean }> {
  if (!googlePret() || !renouvellement) return {};
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: renouvellement, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && typeof j.access_token === 'string') return { jeton: j.access_token };
    if (r.status === 400 && (j.error === 'invalid_grant' || j.error === 'unauthorized_client')) return { refus: true };
    return {};
  } catch { return {}; }
}

/* `options` : ce que l'envoi SMTP passerait a nodemailer (from, to, subject, text, html,
   attachments). Le `bcc` est ignore ici (Gmail range deja dans Envoyes). */
export async function envoyerGmail(renouvellement: string, options: Record<string, unknown>): Promise<IssueGmail> {
  const j = await jetonAcces(renouvellement);
  if (j.refus) return { resultat: 'refus' };
  if (!j.jeton) return { resultat: 'passager' };
  let raw = '';
  try {
    const { bcc: _bcc, ...sans } = options;
    const tr = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
    const info = await tr.sendMail(sans);
    raw = (info.message as unknown as { toString(enc: string): string }).toString('base64url');
  } catch { return { resultat: 'autre' }; }
  let r: Response;
  try {
    r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + j.jeton, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(20000),
    });
  } catch { return { resultat: 'incertain' }; }
  if (r.ok) return { resultat: 'parti' };
  const e = await r.json().catch(() => ({}));
  const raison = String(e?.error?.errors?.[0]?.reason ?? e?.error?.status ?? '');
  console.log('gmail: refus ' + r.status + ' ' + raison.slice(0, 60));
  if (r.status === 401 || (r.status === 403 && /insufficient|PERMISSION_DENIED/i.test(raison))) return { resultat: 'refus', code: r.status };
  if (r.status === 429 || (r.status === 403 && /rate|limit|quota/i.test(raison))) return { resultat: 'passager', code: r.status };
  if (r.status === 400 && /invalid/i.test(raison)) return { resultat: 'destinataire', code: r.status };
  /* Une panne de Google (5xx) ne dit pas si le mail est parti. */
  if (r.status >= 500) return { resultat: 'incertain', code: r.status };
  return { resultat: 'autre', code: r.status };
}
