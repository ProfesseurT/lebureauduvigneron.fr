/* ============================================================================
   supabase/functions/notif-commerce : le mail des nouvelles de « Mon commerce »
   (lot 57, 03/10/2026)
   ----------------------------------------------------------------------------
   Demande de Ted : un devis SIGNE EN LIGNE par un client, ou une affaire
   GAGNEE ou PERDUE PAR UN COLLEGUE, et tout le bureau recoit un mail tout de
   suite, avec les details. Celui qui a fait le geste le recoit aussi : c'est sa
   confirmation (decision de Ted du 03/10/2026, apres le premier essai).

   QUI M'APPELLE. Le declencheur `affaires_notifier` (supabase/lot57-notifications.sql),
   par pg_net, une fois la fermeture validee. Personne d'autre : l'en-tete
   `x-notif-cle` doit porter le secret NOTIF_CLE, le meme que celui range dans
   `public.notif_reglage`. Sans lui, 401 et rien ne se passe.

   CETTE FONCTION NE DECIDE DE RIEN. La sorte (signe, gagnee, perdue), le texte
   des lignes, les destinataires : tout vient de `notif_detail()`, dans la base.
   Ici on ne fait que :
   - poser la ligne du journal AVANT d'envoyer (`notif_envois`, cle primaire =
     l'affaire et l'instant de sa fermeture). Si la ligne existe deja, on
     s'arrete : un mail par fermeture, et UN SEUL. Meme regle que
     `courrier_envois`, on POSE, on ne demande pas « deja envoye ? » ;
   - fabriquer le mail et le confier a Resend, une adresse a la fois (aucun
     destinataire ne voit les autres) ;
   - noter le resultat dans le journal.

   UN ECHEC NE SE REJOUE PAS TOUT SEUL. La ligne reste, avec son motif dans
   `echec`. Un refus de Resend ne dit pas si le mail est parti : mieux vaut un
   mail manquant qu'un mail double (regle 3 du lot 4 du courrier du matin).

   LE SEUIL. Ces mails vont aux MEMBRES du bureau, des vignerons qui ont un
   compte, jamais au client final. C'est du transactionnel, comme l'invitation :
   la regle du SEUIL ne joue pas. L'expediteur est celui du courrier du matin.

   DEPLOIEMENT : depuis ce dossier (suivi par git), APRES le commit, avec
   verify_jwt = false (pg_net n'a pas de jeton de session). Secrets :
   NOTIF_CLE (neuf), RESEND_API_KEY et URL_BUREAU (deja la).
   ============================================================================ */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY') ?? '';
const CLE          = Deno.env.get('NOTIF_CLE') ?? '';
const URL_BUREAU   = Deno.env.get('URL_BUREAU') || 'https://lebureauduvigneron.fr/mon-bureau/';
const EXPEDITEUR   = 'Le Bureau du Vigneron <bureau@courrier.lebureauduvigneron.fr>';

/* Un bureau n'a pas vingt membres. Au-dela, quelque chose ne va pas, et on
   n'envoie pas cinquante mails pour le decouvrir. */
const MAX_DEST = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reponse(corps: unknown, code = 200) {
  return new Response(JSON.stringify(corps), {
    status: code,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function entetes(extra: Record<string, string> = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
}

async function rpc(nom: string, corps: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: 'POST', headers: entetes(), body: JSON.stringify(corps),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${nom} : ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

/* La reservation. `ignore-duplicates` + `return=representation` : une ligne
   rendue veut dire « c'est moi qui l'ai posee », un tableau vide « elle
   existait deja ». C'est la cle primaire qui tranche, pas un select avant. */
async function reserver(cle: string, bureau: string, affaire: string, sorte: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/notif_envois`, {
    method: 'POST',
    headers: entetes({ Prefer: 'resolution=ignore-duplicates,return=representation' }),
    body: JSON.stringify({ cle, bureau, affaire_id: affaire, sorte }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`reservation : ${r.status} ${t.slice(0, 300)}`);
  const lignes = t ? JSON.parse(t) : [];
  return Array.isArray(lignes) && lignes.length > 0;
}

async function noter(cle: string, champs: Record<string, unknown>) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/notif_envois?cle=eq.${encodeURIComponent(cle)}`, {
      method: 'PATCH', headers: entetes({ Prefer: 'return=minimal' }), body: JSON.stringify(champs),
    });
  } catch { /* le journal rate ne change rien a ce qui est parti */ }
}

async function envoyer(a: string, sujet: string, html: string, texte: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EXPEDITEUR, to: [a], subject: sujet, html, text: texte }),
  });
  const corps = await r.text();
  if (!r.ok) throw new Error(`Resend : ${r.status} ${corps.slice(0, 200)}`);
}

/* ---------------------------------------------------------------------------
   LA FABRIQUE DU MAIL. Couleurs en dur : une messagerie ne lit pas nos jetons.
   Chaque valeur porte le NOM du jeton dont elle est copiee (regle du courrier
   du matin). Fond sur la CELLULE en bgcolor ET background-color, largeur bornee
   a 560 px en attribut et en style, aucun degrade, aucune image.
   --------------------------------------------------------------------------- */
const C = {
  papier: '#EFE7D6',   // --paper
  carte:  '#FFFFFF',   // --white
  encre:  '#1E2536',   // --ink
  doux:   '#63523D',   // --muted
  filet:  '#C9C4B9',   // --rule, aplati (rgba non fiable en messagerie)
  accent: '#5A1525',   // --bordeaux
  ok:     '#2D6A2D',   // --ok
  perdu:  '#A03530',   // --danger-deep
};

function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function euros(c: unknown) {
  const n = Number(c);
  if (!Number.isFinite(n)) return '';
  return (n / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u202f\u00a0]/g, ' ') + ' €';
}

function quand(iso: unknown) {
  const d = new Date(String(iso ?? ''));
  if (isNaN(d.getTime())) return '';
  const f = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(d);
  return f.replace(/[\u202f\u00a0]/g, ' ').replace(/(\d{2}):(\d{2})$/, '$1 h $2');
}

/* Les motifs d'une affaire perdue : la MEME liste que MOTIFS de bdv-affaires.js et la
   contrainte de la base. Un code inconnu s'affiche tel quel plutot que de disparaitre. */
const MOTIFS: Record<string, string> = {
  prix: 'Le prix', fournisseur: 'Un fournisseur déjà en place', moment: 'Pas le bon moment',
  sans_reponse: 'Pas de réponse', indisponible: 'Date ou capacité indisponible', autre: 'Autre raison',
};

function nomVin(l: Record<string, unknown>) {
  return [l.designation, l.millesime, l.conditionnement].map((x) => String(x ?? '').trim()).filter(Boolean).join(', ');
}

type Detail = Record<string, any>;

function lienAffaire(id: string) {
  try {
    const u = new URL(URL_BUREAU);
    u.hash = 'affaire=' + id;
    return u.toString();
  } catch { return URL_BUREAU; }
}

function fabriquer(d: Detail) {
  const client = String(d.client || d.titre || 'Ton client');
  const dv = d.devis as Detail | null;
  const num = dv?.numero ? String(dv.numero) : '';
  const par = d.par ? String(d.par) : 'Un collègue';
  let sujet = '', phrase = '', couleur = C.accent, marque = '';
  if (d.sorte === 'signe') {
    sujet = `Devis ${num} signé par ${client}`.replace(/\s+/g, ' ');
    phrase = `${client} vient de signer ${num ? 'le devis ' + num : 'son devis'} en ligne. L'affaire est gagnée.`;
    couleur = C.ok; marque = 'Devis signé';
  } else if (d.sorte === 'gagnee') {
    sujet = `Affaire gagnée : ${client} (par ${par})`;
    phrase = `${par} a gagné l'affaire ${client}${d.titre && d.titre !== client ? ', « ' + d.titre + ' »' : ''}.`;
    couleur = C.ok; marque = 'Affaire gagnée';
  } else {
    sujet = `Affaire perdue : ${client} (par ${par})`;
    phrase = `${par} a classé l'affaire ${client} en « Pas pour cette fois ».`;
    couleur = C.perdu; marque = 'Affaire perdue';
  }

  const lignesInfo: Array<[string, string]> = [];
  lignesInfo.push(['Client', client]);
  if (d.type) lignesInfo.push(["Type d'affaire", String(d.type)]);
  const moment = quand(d.sorte === 'signe' && dv?.signe_le ? dv.signe_le : d.close_le);
  if (moment) lignesInfo.push(['Quand', moment]);
  if (d.sorte === 'perdue' && d.motif) lignesInfo.push(['Motif', MOTIFS[String(d.motif)] ?? String(d.motif)]);
  if (dv?.signataire?.nom) lignesInfo.push(['Signé par', [dv.signataire.nom, dv.signataire.qualite].filter(Boolean).join(', ')]);
  if (num) lignesInfo.push(['Devis', num]);
  if (dv && dv.total_ht_c != null) lignesInfo.push(['Montant', `${euros(dv.total_ht_c)} HT, ${euros(dv.total_ttc_c)} TTC`]);

  const vins: Detail[] = Array.isArray(dv?.lignes) ? dv!.lignes : [];
  const suite = d.sorte === 'perdue'
    ? 'Rien à faire de ton côté. Le motif est noté sur l\'affaire.'
    : d.sorte === 'signe'
      ? 'Prochaine étape : télécharger la commande et l\'importer dans Vitisoft. Le bouton est en tête du devis.'
      : 'Si un devis est accepté, la commande se télécharge depuis le devis, pour Vitisoft.';

  const url = lienAffaire(String(d.affaire_id));
  const bureau = String(d.bureau_nom || 'ton bureau');
  /* LOT 58 : le pied ne dit plus « tout le bureau le recoit », c'est faux depuis que chacun
     coupe ses mails. Il dit OU les couper, comme le courrier du matin. Une perdue n'arrive
     plus jamais ici (notif_detail la refuse) : sa branche reste pour les mails deja en file. */
  const pied = `Tu reçois ce message parce que tu es membre du bureau ${bureau} et que ce mail est coché dans tes réglages, onglet « Le courrier ». Tu peux l'y décocher.`;

  const rangees = lignesInfo.map(([k, v]) => `
          <tr>
            <td bgcolor="${C.carte}" style="background-color:${C.carte};padding:6px 0;font:13px Arial,Helvetica,sans-serif;color:${C.doux};width:130px;vertical-align:top;">${esc(k)}</td>
            <td bgcolor="${C.carte}" style="background-color:${C.carte};padding:6px 0;font:15px Arial,Helvetica,sans-serif;color:${C.encre};vertical-align:top;">${esc(v)}</td>
          </tr>`).join('');

  const tableVins = vins.length ? `
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:18px 24px 6px 24px;font:bold 13px Arial,Helvetica,sans-serif;color:${C.doux};text-transform:uppercase;letter-spacing:1px;">Les vins</td></tr>
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:0 24px 8px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${vins.map((l) => `
          <tr>
            <td bgcolor="${C.carte}" style="background-color:${C.carte};border-top:1px solid ${C.filet};padding:8px 8px 8px 0;font:14px Arial,Helvetica,sans-serif;color:${C.encre};">${esc(nomVin(l))}</td>
            <td bgcolor="${C.carte}" align="right" style="background-color:${C.carte};border-top:1px solid ${C.filet};padding:8px 8px;font:14px Arial,Helvetica,sans-serif;color:${C.doux};white-space:nowrap;">${esc(l.quantite)} x ${esc(euros(l.pu_f_c))}</td>
            <td bgcolor="${C.carte}" align="right" style="background-color:${C.carte};border-top:1px solid ${C.filet};padding:8px 0 8px 8px;font:bold 14px Arial,Helvetica,sans-serif;color:${C.encre};white-space:nowrap;">${esc(euros(l.final_c))}</td>
          </tr>`).join('')}
        </table>
      </td></tr>` : '';

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(sujet)}</title></head>
<body style="margin:0;padding:0;background-color:${C.papier};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.papier}" style="background-color:${C.papier};">
  <tr><td align="center" bgcolor="${C.papier}" style="background-color:${C.papier};padding:24px 12px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};border-top:4px solid ${couleur};padding:22px 24px 4px 24px;font:bold 12px Arial,Helvetica,sans-serif;color:${couleur};text-transform:uppercase;letter-spacing:1px;">${esc(marque)}</td></tr>
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:4px 24px 14px 24px;font:bold 20px Georgia,'Times New Roman',serif;color:${C.encre};line-height:1.3;">${esc(phrase)}</td></tr>
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:0 24px 6px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rangees}
        </table>
      </td></tr>
      ${tableVins}
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:14px 24px 6px 24px;font:14px Arial,Helvetica,sans-serif;color:${C.encre};line-height:1.5;">${esc(suite)}</td></tr>
      <tr><td bgcolor="${C.carte}" style="background-color:${C.carte};padding:12px 24px 26px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="${C.accent}" style="background-color:${C.accent};"><a href="${esc(url)}" style="display:inline-block;padding:13px 22px;font:bold 15px Arial,Helvetica,sans-serif;color:${C.carte};text-decoration:none;">Ouvrir l'affaire</a></td>
        </tr></table>
      </td></tr>
      <tr><td bgcolor="${C.papier}" style="background-color:${C.papier};padding:14px 24px;font:12px Arial,Helvetica,sans-serif;color:${C.doux};line-height:1.5;">${esc(pied)}</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const texte = [
    marque.toUpperCase(),
    '',
    phrase,
    '',
    ...lignesInfo.map(([k, v]) => `${k} : ${v}`),
    ...(vins.length ? ['', 'Les vins :', ...vins.map((l) => `- ${nomVin(l)} : ${l.quantite} x ${euros(l.pu_f_c)} = ${euros(l.final_c)}`)] : []),
    '',
    suite,
    '',
    `Ouvrir l'affaire : ${url}`,
    '',
    pied,
  ].join('\n');

  return { sujet, html, texte };
}

/* Exporte pour le banc (scripts/banc-notif-mail.mjs). Deno.serve n'est lance
   que si le fichier tourne comme une fonction. */
export { fabriquer };

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function' && !Deno.env.get('NOTIF_BANC')) {
  Deno.serve(async (req) => {
    if (req.method !== 'POST') return reponse({ erreur: 'methode' }, 405);
    if (!SUPABASE_URL || !SERVICE_KEY) return reponse({ erreur: 'configuration' }, 500);
    if (!CLE || CLE.length < 32 || req.headers.get('x-notif-cle') !== CLE) return reponse({ erreur: 'cle' }, 401);
    let c: Record<string, unknown> = {};
    try { c = JSON.parse((await req.text()).slice(0, 2000)); } catch { return reponse({ erreur: 'illisible' }, 400); }
    const bureau = String(c?.bureau ?? ''), affaire = String(c?.affaire_id ?? '');
    if (!UUID.test(bureau) || !UUID.test(affaire)) return reponse({ erreur: 'identifiants' }, 400);

    let d: Detail | null;
    try { d = await rpc('notif_detail', { p_bureau: bureau, p_affaire: affaire }); }
    catch (e) { return reponse({ erreur: String(e) }, 500); }
    /* Rien a annoncer : affaire rouverte depuis, ou fermee sans auteur connu. 200, pas une panne. */
    if (!d || !d.cle) return reponse({ rien: true });

    let moi: boolean;
    try { moi = await reserver(String(d.cle), bureau, affaire, String(d.sorte)); }
    catch (e) { return reponse({ erreur: String(e) }, 500); }
    if (!moi) return reponse({ deja: true, cle: d.cle });

    const dest = (Array.isArray(d.destinataires) ? d.destinataires : [])
      .map((x: Detail) => String(x?.email ?? '').trim()).filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const uniques = [...new Set(dest)].slice(0, MAX_DEST);
    if (!uniques.length) {
      await noter(String(d.cle), { envoye_le: new Date().toISOString(), destinataires: 0 });
      return reponse({ cle: d.cle, sorte: d.sorte, destinataires: 0 });
    }
    if (!RESEND_KEY) {
      await noter(String(d.cle), { echec: 'RESEND_API_KEY absente' });
      return reponse({ erreur: 'RESEND_API_KEY absente' }, 500);
    }

    const m = fabriquer(d);
    let partis = 0; const echecs: string[] = [];
    for (const a of uniques) {
      try { await envoyer(a, m.sujet, m.html, m.texte); partis++; }
      catch (e) { echecs.push(String(e).slice(0, 200)); }
    }
    await noter(String(d.cle), {
      envoye_le: partis ? new Date().toISOString() : null,
      destinataires: partis,
      echec: echecs.length ? echecs.join(' | ').slice(0, 900) : null,
    });
    return reponse({ cle: d.cle, sorte: d.sorte, destinataires: partis, echecs: echecs.length, url_bureau: URL_BUREAU });
  });
}
