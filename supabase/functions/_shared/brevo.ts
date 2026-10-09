/* ============================================================================
   _shared/brevo.ts : envoyer UN mail par l'API de Brevo (lot 88, 09/10/2026)
   ----------------------------------------------------------------------------
   Utilise par la fonction `brevo` (un clic dans un redacteur) et par `mails-programmes`.
   [Certain, doc Brevo lue le 09/10/2026] POST /v3/smtp/email ; `sender`, `to`, `subject` et
   `htmlContent` obligatoires, `textContent` facultatif ; 201 et `messageId` quand il part.

   UN SEUL destinataire, celui que le vigneron voit a l'ecran. Une copie cachee a soi si la
   personne l'a cochee : un mail parti par Brevo ne se range dans aucun dossier « Envoyes ».
   Le texte part tel quel ; la version HTML que Brevo exige n'en est que l'habillage (texte
   echappe, liens cliquables, retours a la ligne). Aucun texte de Brevo ne sort d'ici.

   LES ISSUES, et ce qu'elles veulent dire pour le vigneron :
     parti        : Brevo l'a pris (201) ;
     refus_cle    : Brevo refuse la cle (401, 403) ou l'adresse internet du bureau ;
     expediteur   : l'adresse d'expediteur n'est pas validee chez Brevo ;
     destinataire : l'adresse du client est refusee ;
     credits      : plus de credits d'envoi (402) ;
     passager     : Brevo demande d'attendre (429) : rien n'est parti ;
     incertain    : pas de reponse, ou une panne de Brevo (5xx) : peut-etre parti, on ne
                    renvoie pas ;
     erreur       : autre refus (4xx) : rien n'est parti.
   ============================================================================ */

/* `suivi` (lot 90) : le client a accepte le suivi des ouvertures et des clics (case de sa
   fiche). [Certain, doc Brevo lue le 09/10/2026] `contactPixelTrackingConsent` (vrai ou faux,
   par destinataire) ; Brevo ne le lit que si le compte a active le consentement par contact
   (Parametres, Contacts). Faux : ouvertures et clics anonymes, comptes en gros seulement.
   La copie cachee a soi : toujours faux. */
export type EnvoiBrevo = { cle: string; expediteur: string; nom: string | null; copie: boolean; suivi?: boolean };
export type IssueBrevo = { resultat: string; messageId?: string; code?: number; ip?: boolean };

function echapper(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/* Le texte simple habille en HTML : rien n'est ajoute, rien n'est retire. */
export function texteEnHtml(texte: string) {
  const e = echapper(texte).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1">$1</a>');
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1e2536">'
    + e.replace(/\r?\n/g, '<br>') + '</div>';
}

export async function envoyerBrevo(b: EnvoiBrevo, a: string, sujet: string, texte: string, tags: string[] = []): Promise<IssueBrevo> {
  const corps: Record<string, unknown> = {
    sender: b.nom ? { email: b.expediteur, name: b.nom } : { email: b.expediteur },
    to: [{ email: a, contactPixelTrackingConsent: b.suivi === true }],
    subject: sujet || '(sans objet)',
    htmlContent: texteEnHtml(texte),
    textContent: texte,
    tags: ['bureau-du-vigneron', ...tags].slice(0, 5),
  };
  if (b.copie && b.expediteur.toLowerCase() !== a.toLowerCase()) corps.bcc = [{ email: b.expediteur, contactPixelTrackingConsent: false }];
  let r: Response;
  try {
    r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': b.cle, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return { resultat: 'incertain' };
  }
  const t = await r.text().catch(() => '');
  if (r.status === 201 || r.status === 200) {
    let id = '';
    try { const j = JSON.parse(t); id = String(j.messageId || (Array.isArray(j.messageIds) ? j.messageIds[0] : '') || ''); } catch { id = ''; }
    return { resultat: 'parti', messageId: id.slice(0, 200), code: r.status };
  }
  const brut = t.slice(0, 500);
  if (r.status >= 500) return { resultat: 'incertain', code: r.status };
  if (r.status === 429) return { resultat: 'passager', code: r.status };
  if (r.status === 402) return { resultat: 'credits', code: r.status };
  if (r.status === 401 || r.status === 403) return { resultat: 'refus_cle', code: r.status, ip: /\bip\b|ip address/i.test(brut) };
  if (/sender/i.test(brut)) return { resultat: 'expediteur', code: r.status };
  if (/\bto\b|email/i.test(brut)) return { resultat: 'destinataire', code: r.status };
  return { resultat: 'erreur', code: r.status };
}

/* Les mots du bureau pour chaque issue (les memes pour un clic et pour un mail programme). */
export const MOTS_BREVO: Record<string, string> = {
  refus_cle: 'Brevo refuse la clé du bureau : un administrateur doit en coller une nouvelle dans Mes réglages, Mes envois.',
  ip: 'Brevo bloque les appels du bureau : dans Brevo, menu Sécurité, « Adresses IP autorisées », désactive le blocage.',
  expediteur: 'Ton adresse d’expéditeur n’est pas (ou plus) validée chez Brevo : choisis-en une autre dans Mes réglages, Mes envois.',
  destinataire: 'Brevo refuse l’adresse du destinataire. Vérifie-la.',
  credits: 'Le compte Brevo n’a plus de crédits d’envoi.',
  passager: 'Brevo demande d’attendre un peu. Réessaie dans un moment.',
  erreur: 'Brevo a refusé l’envoi.',
  refusee: 'Brevo refuse la clé du bureau : un administrateur doit en coller une nouvelle dans Mes réglages, Mes envois. Le mail n’est pas parti par ta boîte à la place.',
  sans_expediteur: 'Choisis d’abord ton adresse d’expéditeur chez Brevo, dans Mes réglages, Mes envois.',
  plafond: '200 mails envoyés par Brevo aujourd’hui : la limite du jour est atteinte.',
};

/* Lot 90 : pourquoi un mail par Brevo ne part pas vers cette adresse. Rien n'est parti. */
export const MOTS_BLOQUE: Record<string, string> = {
  morte: 'Cette adresse ne marche plus (Brevo l’a vue rejetée) : le mail n’est pas parti. Demande une autre adresse au client.',
  spam: 'Ce client a classé un de tes mails en spam : Brevo ne lui écrit plus, le mail n’est pas parti.',
  bloquee: 'Brevo bloque cette adresse : le mail n’est pas parti.',
  desinscrit: 'Ce client s’est désinscrit de tes mails : Brevo ne lui écrit plus, le mail n’est pas parti.',
};
