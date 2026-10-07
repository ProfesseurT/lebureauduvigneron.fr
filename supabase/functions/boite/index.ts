/* ============================================================================
   supabase/functions/boite : brancher la boite mail du vigneron (lot 76, 07/10/2026)
   ----------------------------------------------------------------------------
   Option B de la decision du 07/10/2026 (JOURNAL.md) : le bureau envoie par la boite
   du vigneron, en SMTP sur le port 465 (Supabase bloque 25 et 587 ; l'essai reel du
   07/10/2026 a envoye par smtp.gmail.com:465 en 1 510 ms).

   TROIS GESTES, appeles avec le jeton de session :
     - `reconnaitre` : d'apres l'adresse, quel fournisseur, quel serveur, et quel mot de
       passe donner. Un domaine personnel se reconnait a ses enregistrements MX.
     - `tester` : envoie un mail d'essai A L'ADRESSE ELLE-MEME, avec un code a 6 chiffres.
       Si le serveur l'accepte, le mot de passe est range dans Vault par `boite_ranger()`
       (cle de service) et la boite attend son code. C'est `boite_confirmer()`, appelee par
       le navigateur, qui la branche : RIEN N'EST BRANCHE SANS MAIL ARRIVE.
     - `envoyer` (lot 77) : un mail prepare dans un redacteur du bureau (une affaire, la fiche
       d'un client), envoye par la boite branchee quand le vigneron clique « Envoyer depuis ma
       boite ». Ce clic EST la validation. Un seul destinataire, texte simple (la signature y
       est deja), copie a soi si la case est cochee. Plafond : 200 par jour et par personne.
       Un refus du mot de passe passe la boite a « reconnecter » : le bureau repasse par la
       messagerie.

   LE MOT DE PASSE :
     - il traverse cette fonction une fois, n'est jamais journalise, jamais renvoye ;
     - aucun message d'erreur du serveur de mail ne sort d'ici (il pourrait le contenir) ;
     - il n'est range qu'APRES un envoi accepte : un mauvais mot de passe ne laisse rien.

   CE QUE CETTE FONCTION NE FAIT PAS : choisir un destinataire. Elle n'ecrit qu'a l'adresse
   qu'on branche. Elle ne peut servir de relais a personne. Et le plafond de la base (10
   essais par heure et par personne) est demande AVANT de toucher au serveur de mail, sinon
   elle servirait a deviner le mot de passe d'une boite.

   DEPLOIEMENT : APRES le SQL du lot 76 et APRES le commit, verify_jwt = true. Aucun secret
   a poser : SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis.
   ============================================================================ */
import nodemailer from 'npm:nodemailer@^9';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
function reponse(corps: unknown, code = 200) {
  return new Response(JSON.stringify(corps), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });
}

/* ---------------------------------------------------------------------------
   LES FOURNISSEURS. Verifies le 07/10/2026 (JOURNAL.md, lot 76) :
   [Certain] page officielle lue : Gmail et Workspace, OVH MX Plan, IONOS, Gandi, Free, Yahoo.
   [Probable] sources secondaires : Orange, SFR, Bouygues. L'essai tranche de toute facon.
   Les MURS ne passent pas par le 465 : Microsoft 365 et iCloud (587 seul documente),
   Outlook.com / Hotmail (plus de mot de passe depuis le 16/09/2024), La Poste et OVH E-mail
   Pro (587 seul). Ils restent sur la messagerie (option A) en attendant D.
   --------------------------------------------------------------------------- */
type Fournisseur = { cle: string; nom: string; serveur: string; motDePasse: string };
const GMAIL: Fournisseur = { cle: 'gmail', nom: 'Gmail', serveur: 'smtp.gmail.com',
  motDePasse: 'Un mot de passe d’application Google (16 lettres), pas ton mot de passe habituel. Il demande la validation en deux étapes. Il se crée sur myaccount.google.com/apppasswords.' };
const OVH: Fournisseur = { cle: 'ovh', nom: 'OVH', serveur: 'ssl0.ovh.net', motDePasse: 'Le mot de passe de ta boîte OVH.' };
const IONOS: Fournisseur = { cle: 'ionos', nom: 'IONOS', serveur: 'smtp.ionos.fr', motDePasse: 'Le mot de passe de ta boîte IONOS.' };
const GANDI: Fournisseur = { cle: 'gandi', nom: 'Gandi', serveur: 'mail.gandi.net', motDePasse: 'Le mot de passe de ta boîte Gandi.' };
const PAR_DOMAINE: Record<string, Fournisseur> = {
  'gmail.com': GMAIL, 'googlemail.com': GMAIL,
  'orange.fr': { cle: 'orange', nom: 'Orange', serveur: 'smtp.orange.fr', motDePasse: 'Le mot de passe pour logiciels de messagerie tiers, s’il existe (Espace client, Connexion et sécurité), sinon ton mot de passe Orange.' },
  'wanadoo.fr': { cle: 'orange', nom: 'Orange', serveur: 'smtp.orange.fr', motDePasse: 'Le mot de passe pour logiciels de messagerie tiers, s’il existe (Espace client, Connexion et sécurité), sinon ton mot de passe Orange.' },
  'free.fr': { cle: 'free', nom: 'Free', serveur: 'smtp.free.fr', motDePasse: 'Le mot de passe de ta boîte Free.' },
  'sfr.fr': { cle: 'sfr', nom: 'SFR', serveur: 'smtp.sfr.fr', motDePasse: 'Le mot de passe de ta boîte SFR.' },
  'neuf.fr': { cle: 'sfr', nom: 'SFR', serveur: 'smtp.sfr.fr', motDePasse: 'Le mot de passe de ta boîte SFR.' },
  'bbox.fr': { cle: 'bbox', nom: 'Bouygues', serveur: 'smtp.bbox.fr', motDePasse: 'Le mot de passe de ta boîte Bbox.' },
  'yahoo.fr': { cle: 'yahoo', nom: 'Yahoo', serveur: 'smtp.mail.yahoo.com', motDePasse: 'Un mot de passe d’application Yahoo (Sécurité du compte, Connexions externes).' },
  'yahoo.com': { cle: 'yahoo', nom: 'Yahoo', serveur: 'smtp.mail.yahoo.com', motDePasse: 'Un mot de passe d’application Yahoo (Sécurité du compte, Connexions externes).' },
};
const MURS: Record<string, string> = {
  'outlook.fr': 'Outlook', 'outlook.com': 'Outlook', 'hotmail.fr': 'Hotmail', 'hotmail.com': 'Hotmail',
  'live.fr': 'Outlook', 'live.com': 'Outlook', 'msn.com': 'Outlook',
  'icloud.com': 'iCloud', 'me.com': 'iCloud', 'mac.com': 'iCloud', 'laposte.net': 'La Poste',
};
/* Un domaine personnel, par ses MX. Motifs verifies le 07/10/2026. */
const PAR_MX: Array<[RegExp, Fournisseur | string]> = [
  [/(^|\.)(google|googlemail)\.com\.?$/i, { ...GMAIL, cle: 'workspace', nom: 'Google Workspace' }],
  [/\.mail\.ovh\.net\.?$/i, OVH],
  [/(^|\.)(ionos|1and1)\.[a-z]+\.?$/i, IONOS],
  [/\.mail\.gandi\.net\.?$/i, GANDI],
  [/\.mail\.protection\.outlook\.com\.?$/i, 'Microsoft 365'],
];

async function reconnaitre(adresse: string) {
  const dom = adresse.split('@')[1] ?? '';
  if (MURS[dom]) return { statut: 'mur', nom: MURS[dom] };
  if (PAR_DOMAINE[dom]) return { statut: 'connu', ...PAR_DOMAINE[dom] };
  let mx: string[] = [];
  try {
    const r = await Promise.race([
      Deno.resolveDns(dom, 'MX'),
      new Promise<never>((_, ko) => setTimeout(() => ko(new Error('dns')), 4000)),
    ]);
    mx = (r as Array<{ exchange: string }>).map((x) => String(x.exchange || ''));
  } catch { mx = []; }
  for (const h of mx) {
    for (const [motif, f] of PAR_MX) {
      if (motif.test(h)) return typeof f === 'string' ? { statut: 'mur', nom: f } : { statut: 'connu', ...f };
    }
  }
  return { statut: 'inconnu', mx: mx.length > 0 };
}

/* Pas de parenthese, chevron, virgule, point-virgule, deux-points, guillemet ni crochet :
   l'adresse controlee est exactement celle qui part (verificateur, lot 77). */
const ADRESSE = /^[^@\s()<>,;:"\[\]\\]+@[^@\s()<>,;:"\[\]\\]+\.[a-z]{2,}$/i;
const SERVEUR = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
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
  if (!r.ok) { const e = new Error(`${nom} ${r.status}`) as Error & { corps?: string }; e.corps = t.slice(0, 300); throw e; }
  return t ? JSON.parse(t) : null;
}
/* LE SERVEUR D'ENVOI DOIT ETRE SUR INTERNET (verificateur, lot 76). Sans ce filtre, un compte
   ferait ouvrir par cette fonction une connexion vers 127.0.0.1, un reseau prive ou l'adresse
   de metadonnees. On resout le nom UNE fois, on refuse tout ce qui n'est pas public, et on
   se connecte a CETTE adresse (le nom ne sert plus qu'au certificat) : une deuxieme
   resolution ne peut pas changer de cible entre le controle et la connexion. */
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

/* Six chiffres tires au hasard par le generateur cryptographique. */
function code6() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(b[0] % 1000000).padStart(6, '0');
}

/* ---------------------------------------------------------------------------
   ENVOYER (lot 77). `adresse` est ici le DESTINATAIRE ; l'expediteur est la boite branchee,
   lue dans la base, jamais dans la requete.
   --------------------------------------------------------------------------- */
async function envoyer(jwt: string, corps: Record<string, unknown>, a: string) {
  const moi = await quiAppelle(jwt);
  if (!moi) return reponse({ erreur: 'aucune session' }, 401);
  const bureau = texte(corps.bureau, 40);
  if (!/^[0-9a-f-]{36}$/i.test(bureau)) return reponse({ erreur: 'bureau inconnu' }, 400);
  const sujet = texte(corps.sujet, 300);
  const corpsTexte = String(corps.texte ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').slice(0, 20000);
  if (!sujet && !corpsTexte.trim()) return reponse({ resultat: 'vide', erreur: 'Écris un objet ou un texte.' });

  let b: { adresse: string; serveur: string; identifiant: string; secret: string; copie_a_soi: boolean } | null = null;
  try {
    const l = await rpc('boite_pour_envoi', { p_personne: moi.id, p_bureau: bureau });
    b = Array.isArray(l) && l[0] ? l[0] : null;
  } catch { return reponse({ resultat: 'erreur', erreur: 'Le bureau n’a pas pu lire ta boîte.' }); }
  if (!b) return reponse({ resultat: 'pas_branchee' });

  const cible = await adressePublique(b.serveur);
  if (!cible) return reponse({ resultat: 'injoignable', serveur: b.serveur });

  let permis = false;
  try { permis = await rpc('boite_envoi_permis', { p_personne: moi.id, p_bureau: bureau }) === true; }
  catch { return reponse({ resultat: 'erreur', erreur: 'Le bureau n’a pas pu préparer l’envoi.' }); }
  if (!permis) return reponse({ resultat: 'plafond', erreur: 'Tu as envoyé 200 mails depuis le bureau aujourd’hui : la suite part de ta messagerie.' });

  try {
    const tr = nodemailer.createTransport({
      host: cible, servername: b.serveur, port: 465, secure: true, tls: { servername: b.serveur },
      auth: { user: b.identifiant, pass: b.secret }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000,
    });
    /* D'ABORD la connexion et le mot de passe, A PART : une erreur reseau ici prouve que rien
       n'est parti. Une erreur reseau pendant l'envoi qui suit, elle, laisse un doute, et on le
       dit au lieu d'inviter a renvoyer (verificateur, lot 77). */
    try { await tr.verify(); } catch (e0) {
      const er = e0 as { code?: string; responseCode?: number };
      const rc0 = Number(er.responseCode || 0);
      console.log('boite: connexion refusee ' + (er.code ?? '') + ' ' + rc0);
      if (rc0 === 535 || rc0 === 534 || rc0 === 530) {
        try { await rpc('boite_reconnecter', { p_personne: moi.id, p_bureau: bureau, p_erreur: 'mot de passe refuse (' + rc0 + ')' }); } catch { /* rien */ }
        return reponse({ resultat: 'refus' });
      }
      if (er.code === 'EAUTH') return reponse({ resultat: 'passager' });
      return reponse({ resultat: 'injoignable', serveur: b.serveur });
    }
    const info = await tr.sendMail({
      from: b.adresse, to: { name: '', address: a }, ...(b.copie_a_soi && a !== b.adresse ? { bcc: b.adresse } : {}),
      subject: sujet, text: corpsTexte,
    });
    console.log('boite: envoi parti');
    return reponse({ resultat: 'parti', de: b.adresse, copie: !!b.copie_a_soi, id: String(info.messageId || '').slice(0, 200) });
  } catch (e) {
    const err = e as { code?: string; responseCode?: number; command?: string };
    const rc = Number(err.responseCode || 0), cmd = String(err.command || '').toUpperCase();
    console.log('boite: envoi refuse ' + (err.code ?? '') + ' ' + rc + ' ' + cmd);
    /* Seul un refus FRANC du mot de passe passe la boite a « reconnecter » : un 454 « trop de
       connexions » (que nodemailer range aussi en EAUTH) n'est qu'un incident (verificateur). */
    if (rc === 535 || rc === 534 || rc === 530) {
      try { await rpc('boite_reconnecter', { p_personne: moi.id, p_bureau: bureau, p_erreur: 'mot de passe refuse (' + rc + ')' }); } catch { /* rien */ }
      return reponse({ resultat: 'refus' });
    }
    if (err.code === 'EAUTH') return reponse({ resultat: 'passager' });
    /* La connexion et le mot de passe venaient de passer : une coupure ici laisse un doute. */
    if (['ESOCKET', 'ECONNECTION', 'ETIMEDOUT', 'EDNS', 'ECONNREFUSED'].includes(String(err.code))) return reponse({ resultat: 'incertain' });
    if (cmd.startsWith('RCPT')) return reponse({ resultat: 'destinataire' });
    return reponse({ resultat: 'autre', code_smtp: rc || null });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reponse({ erreur: 'methode' }, 405);
  const jwt = req.headers.get('Authorization') ?? '';
  if (!jwt.startsWith('Bearer ')) return reponse({ erreur: 'aucune session' }, 401);
  let corps: Record<string, unknown>;
  try { corps = await req.json(); } catch { return reponse({ erreur: 'corps illisible' }, 400); }
  const action = String(corps.action ?? '');
  /* Un mail peut etre long (un devis, une signature) : 25 000 signes pour `envoyer`. */
  if (JSON.stringify(corps).length > (action === 'envoyer' ? 25000 : 4000)) return reponse({ resultat: 'trop_long', erreur: 'Ce mail est trop long pour partir du bureau.' }, 413);

  const adresse = texte(corps.adresse, 254).toLowerCase();
  if (!ADRESSE.test(adresse)) return reponse({ erreur: 'Cette adresse ne ressemble pas à une adresse mail.' }, 400);

  if (action === 'reconnaitre') return reponse(await reconnaitre(adresse));
  if (action === 'envoyer') return await envoyer(jwt, corps, adresse);
  if (action !== 'tester') return reponse({ erreur: 'action inconnue' }, 400);

  const moi = await quiAppelle(jwt);
  if (!moi) return reponse({ erreur: 'aucune session' }, 401);
  const bureau = texte(corps.bureau, 40);
  const motDePasse = String(corps.mot_de_passe ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(bureau)) return reponse({ erreur: 'bureau inconnu' }, 400);
  if (!motDePasse || motDePasse.length > 200) return reponse({ erreur: 'Il manque le mot de passe.' }, 400);
  const identifiant = texte(corps.identifiant, 254) || adresse;

  const f = await reconnaitre(adresse);
  if (f.statut === 'mur') return reponse({ resultat: 'mur', nom: f.nom });
  let serveur = '', fournisseur = 'autre';
  if (f.statut === 'connu') { serveur = (f as Fournisseur).serveur; fournisseur = (f as Fournisseur).cle; }
  else {
    serveur = texte(corps.serveur, 253).toLowerCase();
    if (!SERVEUR.test(serveur)) return reponse({ resultat: 'serveur', erreur: 'Indique le serveur d’envoi (SMTP) de ta boîte, par exemple smtp.mondomaine.fr.' });
  }

  const cible = await adressePublique(serveur);
  if (!cible) return reponse({ resultat: 'injoignable', serveur });

  /* LE PLAFOND, AVANT le serveur de mail. */
  let permis = false;
  try { permis = await rpc('boite_essai_permis', { p_personne: moi.id, p_bureau: bureau }) === true; }
  catch (e) {
    const c = String((e as { corps?: string }).corps ?? '');
    return reponse({ erreur: /pas membre/.test(c) ? 'Tu n’es pas membre de ce bureau.' : 'Le bureau n’a pas pu préparer l’essai.' }, 400);
  }
  if (!permis) return reponse({ resultat: 'plafond', erreur: 'Trop d’essais en une heure. Réessaie plus tard.' });

  const code = code6();
  try {
    const tr = nodemailer.createTransport({
      host: cible, servername: serveur, port: 465, secure: true, tls: { servername: serveur }, auth: { user: identifiant, pass: motDePasse },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
    });
    await tr.sendMail({
      from: adresse, to: adresse,
      subject: `Ton code pour brancher ta boîte : ${code}`,
      text: [
        'Bonjour,', '',
        'Le Bureau du Vigneron vérifie qu’il peut envoyer tes mails depuis cette boîte.', '',
        `Ton code : ${code}`, '',
        'Tape-le dans Mes réglages, onglet Mes envois. Il vaut 15 minutes.', '',
        'Tu n’as rien demandé ? Ignore ce mail : rien n’est branché sans ce code. Change quand même le mot de passe de ta boîte, quelqu’un le connaît.',
      ].join('\n'),
    });
  } catch (e) {
    const err = e as { code?: string; responseCode?: number; message?: string };
    const rc = Number(err.responseCode || 0);
    console.log('boite: essai refuse ' + fournisseur + ' ' + serveur + ' ' + (err.code ?? '') + ' ' + rc);
    if (err.code === 'EAUTH' || rc === 535 || rc === 534 || rc === 530) {
      return reponse({ resultat: 'refus', fournisseur });
    }
    if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS', 'ECONNREFUSED'].includes(String(err.code))) {
      return reponse({ resultat: 'injoignable', serveur });
    }
    /* Jamais le message du serveur : un serveur hostile pourrait y recracher le mot de passe
       (en base64, tel qu'il l'a recu). Le code SMTP suffit. */
    return reponse({ resultat: 'autre', code_smtp: rc || null });
  }

  try {
    await rpc('boite_ranger', { p_personne: moi.id, p_bureau: bureau, p_adresse: adresse, p_fournisseur: fournisseur,
      p_serveur: serveur, p_identifiant: identifiant, p_secret: motDePasse, p_code: code });
  } catch (e) {
    console.error('boite: rangement impossible ' + String((e as Error).message));
    return reponse({ erreur: 'Le mail d’essai est parti, mais le bureau n’a pas pu ranger la boîte. Réessaie.' }, 500);
  }
  console.log('boite: essai parti, a confirmer, ' + fournisseur);
  return reponse({ resultat: 'code', serveur, fournisseur });
});
