/* ============================================================================
   supabase/functions/_shared/smtp.ts : envoyer un mail par la boite branchee (lot 84)
   ----------------------------------------------------------------------------
   Utilise par `mails-programmes`. Les trois fonctions `ipPrivee`, `adressePublique` et
   `expediteur` sont RECOPIEES de `supabase/functions/boite/index.ts`, a l'octet pres :
   `npm run banc:programmes` echoue si elles divergent. On ne les deplace pas hors de `boite`
   pour ne pas toucher a une fonction en production qui marche (lot 77).
   ============================================================================ */
import nodemailer from 'npm:nodemailer@^9';

/* LE SERVEUR D'ENVOI DOIT ETRE SUR INTERNET (verificateur, lot 76). */
function ipPrivee(ip: string) {
  if (/^(127|10|0)\./.test(ip) || /^192\.168\./.test(ip) || /^169\.254\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip) || /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./.test(ip)) return true;
  if (/^(22[4-9]|2[3-5][0-9])\./.test(ip) || /^198\.1[89]\./.test(ip) || /^192\.0\.0\./.test(ip)) return true;
  if (!ip.includes(':')) return false;
  /* En IPv6, seule l'adresse publique mondiale (2000::/3) passe, sans 6to4 (2002::/16) ni la
     plage de documentation (2001:db8::/32) : ni NAT64, ni ::a.b.c.d, ni local. */
  const v6 = ip.toLowerCase();
  if (!/^[23][0-9a-f]{0,3}:/.test(v6)) return true;
  if (/^2002:/.test(v6) || /^2001:0?db8:/.test(v6)) return true;
  return false;
}
async function adressePublique(hote: string): Promise<string | null> {
  if (/^[0-9.]+$/.test(hote) || hote.includes(':')) return null;
  const ips: string[] = [];
  for (const t of ['A', 'AAAA'] as const) {
    try {
      const r = await Promise.race([Deno.resolveDns(hote, t), new Promise<never>((_, ko) => setTimeout(() => ko(new Error('dns')), 4000))]);
      ips.push(...(r as string[]));
    } catch { /* pas de reponse de ce type */ }
  }
  if (!ips.length || ips.some(ipPrivee)) return null;
  return ips.find((x) => !x.includes(':')) ?? ips[0];
}
function expediteur(b: { adresse: string; nom?: string | null }) {
  const n = String(b.nom ?? '').replace(/[\u0000-\u001F\u007F@<>"\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return n ? { name: n, address: b.adresse } : b.adresse;
}

export type Boite = { adresse: string; serveur: string; identifiant: string; secret: string; copie_a_soi: boolean; nom?: string | null };
export type Issue = { resultat: 'parti' | 'refus' | 'passager' | 'injoignable' | 'incertain' | 'destinataire' | 'autre'; code?: number };

/* Meme ordre que `boite` : d'abord la connexion et le mot de passe (une erreur la prouve que
   rien n'est parti), puis l'envoi (une coupure la laisse un doute : « incertain »). */
export async function envoyerSmtp(b: Boite, a: string, sujet: string, texte: string): Promise<Issue> {
  const cible = await adressePublique(b.serveur);
  if (!cible) return { resultat: 'injoignable' };
  const tr = nodemailer.createTransport({
    host: cible, servername: b.serveur, port: 465, secure: true, tls: { servername: b.serveur },
    auth: { user: b.identifiant, pass: b.secret }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000,
  });
  try { await tr.verify(); } catch (e0) {
    const er = e0 as { code?: string; responseCode?: number };
    const rc0 = Number(er.responseCode || 0);
    if (rc0 === 535 || rc0 === 534 || rc0 === 530) return { resultat: 'refus', code: rc0 };
    if (er.code === 'EAUTH') return { resultat: 'passager' };
    return { resultat: 'injoignable' };
  }
  try {
    await tr.sendMail({
      from: expediteur(b), to: { name: '', address: a }, ...(b.copie_a_soi && a !== b.adresse ? { bcc: b.adresse } : {}),
      subject: sujet, text: texte,
    });
    return { resultat: 'parti' };
  } catch (e) {
    const err = e as { code?: string; responseCode?: number; command?: string };
    const rc = Number(err.responseCode || 0), cmd = String(err.command || '').toUpperCase();
    if (rc === 535 || rc === 534 || rc === 530) return { resultat: 'refus', code: rc };
    if (err.code === 'EAUTH') return { resultat: 'passager' };
    if (['ESOCKET', 'ECONNECTION', 'ETIMEDOUT', 'EDNS', 'ECONNREFUSED'].includes(String(err.code))) return { resultat: 'incertain' };
    if (cmd.startsWith('RCPT')) return { resultat: 'destinataire' };
    return { resultat: 'autre', code: rc || undefined };
  }
}
