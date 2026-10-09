/* ============================================================================
   _shared/empreinte.ts : l'empreinte d'une adresse (lot 90, 09/10/2026)
   ----------------------------------------------------------------------------
   AUCUNE ADRESSE N'ENTRE EN BASE pour les retours de Brevo : on y range son empreinte,
   sha256 de « <bureau>:<adresse en minuscules, sans espaces autour> », en hexadecimal.
   Le navigateur calcule LA MEME (src/js/bdv-retours.js, `empreinte`) pour lire. Changer
   l'une sans l'autre rendrait chaque adresse inconnue sans lever d'erreur : `banc:retours`
   compare les deux sur les memes exemples.
   On ne retire ni les points ni le « + » d'une adresse Gmail : ce serait une autre adresse.
   ============================================================================ */
export async function empreinte(bureau: string, adresse: string): Promise<string> {
  const t = new TextEncoder().encode(String(bureau).toLowerCase() + ':' + String(adresse ?? '').trim().toLowerCase());
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', t));
  return Array.from(h, (o) => o.toString(16).padStart(2, '0')).join('');
}

/* Deux textes egaux, sans dire par le temps de reponse ou ils different. */
export function egaux(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
