/* ============================================================================
   supabase/functions/mails-programmes : faire partir les mails programmes (lot 84, 08/10/2026)
   ----------------------------------------------------------------------------
   Demande de Ted : « on permet aussi de programmer un email », envoi automatique par la boite
   branchee (lot 77) a la date et a l'heure choisies.

   QUI L'APPELLE : la tache pg_cron « mails-programmes », toutes les 5 minutes, avec la cle
   NOTIF_CLE dans `x-notif-cle` (la meme que notif-commerce et notif-horaire, rangee dans
   `notif_reglage`). Aucune session : la fonction parle a la base avec la cle de service.

   CE QU'ELLE FAIT, ET RIEN D'AUTRE :
     1. `mails_a_partir()` : la base PREND les mails dus (statut « envoi », verrouilles), passe
        en « incertain » ceux restes bloques plus de 15 minutes, annule ceux d'une personne qui
        a demande a ne plus etre contactee ;
     2. pour chacun, la boite de celui qui l'a programme (`boite_pour_envoi`), le plafond de
        200 par jour (`boite_envoi_permis`), puis l'envoi en SMTP 465 (`_shared/smtp.ts`) ;
     3. `mail_resultat()` : parti (le mail entre dans le journal de l'affaire, signe par celui
        qui l'a programme, et le rappel se pose), pas parti (le motif, en francais), ou peut-etre
        parti (« incertain » : JAMAIS renvoye).
   LOT 88 : si le maitre a coche « les mails programmes » pour Brevo et que la personne n'a
   pas choisi « Par ma boite », le mail part par Brevo (`brevo_pour_envoi`, `_shared/brevo.ts`),
   avec le plafond Brevo (`brevo_envoi_permis`). Si Brevo doit envoyer et ne peut pas (cle
   refusee, pas d'adresse choisie), le mail est en ECHEC : il ne part pas par la boite a la place.
   LOT 90 : avant Brevo, l'adresse retenue (morte, spam, bloquee, desinscrite des mails 1 a 1)
   met le mail en ECHEC avec son motif ; le mail dit a Brevo si le client a accepte le suivi.
   L'empreinte du destinataire est notee avec le mail (`_shared/empreinte.ts`).
   UN MAIL NE PART QU'UNE FOIS : c'est la base qui le tient (statut « envoi » sous verrou),
   pas cette fonction. Un echec ne se rejoue pas tout seul : le vigneron le reprend.

   Les mails partent UN PAR UN : une boite qui recoit dix connexions d'un coup peut refuser
   (454). Vingt au plus par passage : 5 minutes plus tard, le passage suivant prend la suite.

   DEPLOIEMENT : APRES le SQL du lot 84 et APRES le commit, verify_jwt = false (pas de session :
   la cle NOTIF_CLE garde la porte). Aucun secret neuf.
   ============================================================================ */
import { envoyerSmtp, type Boite } from '../_shared/smtp.ts';
import { envoyerBrevo, MOTS_BREVO, MOTS_BLOQUE } from '../_shared/brevo.ts';
import { empreinte } from '../_shared/empreinte.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLE          = Deno.env.get('NOTIF_CLE') ?? '';

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
  if (!r.ok) throw new Error(`${nom} ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

/* Ce que le vigneron lit sous le mail qui n'est pas parti. Jamais le message du serveur. */
const MOTS: Record<string, string> = {
  pas_branchee: 'Ta boîte n’est plus branchée (ou tu as choisi de passer par ta messagerie).',
  plafond: '200 mails envoyés depuis le bureau aujourd’hui : la limite du jour est atteinte.',
  refus: 'Ta boîte a refusé le mot de passe : rebranche-la dans Mes réglages, Mes envois.',
  passager: 'Ta boîte n’a pas accepté l’envoi sur le moment.',
  injoignable: 'Le serveur de ta boîte ne répondait pas.',
  destinataire: 'Ta boîte a refusé l’adresse du destinataire.',
  autre: 'Ta boîte a refusé l’envoi.',
  erreur: 'Le bureau n’a pas pu préparer l’envoi.',
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reponse({ erreur: 'methode' }, 405);
  if (!CLE || CLE.length < 32 || req.headers.get('x-notif-cle') !== CLE) return reponse({ erreur: 'cle' }, 401);

  let l: Array<{ bureau: string; mail_id: string; personne: string; destinataire: string | null; sujet: string | null; corps: string | null }> = [];
  try { l = (await rpc('mails_a_partir', { p_max: 20 })) ?? []; }
  catch (e) { console.error('mails-programmes: lecture ' + String((e as Error).message)); return reponse({ erreur: 'lecture' }, 500); }

  const rapport = { pris: l.length, partis: 0, echecs: 0, incertains: 0 };
  for (const m of l) {
    let issue = 'erreur', code: number | undefined, motBrevo = '';
    try {
      /* Lot 88 : Brevo d'abord, si c'est son chemin pour ce mail. Une base sans le lot 87/88
         rend une erreur ici : on retombe sur la boite, comme avant. */
      let pb: { etat: string; cle: string; expediteur: string; nom: string | null; copie: boolean } | null = null;
      try {
        const l = await rpc('brevo_pour_envoi', { p_personne: m.personne, p_bureau: m.bureau, p_sorte: 'programmes' });
        pb = Array.isArray(l) && l[0] ? l[0] : null;
      } catch { pb = null; }
      if (pb && (pb.etat === 'refusee' || pb.etat === 'sans_expediteur')) { issue = 'brevo'; motBrevo = MOTS_BREVO[pb.etat]; }
      else if (pb && pb.etat === 'ok') {
        if (!m.destinataire) issue = 'destinataire';
        else {
          const emp = await empreinte(m.bureau, m.destinataire);
          const dl = await rpc('brevo_destinataire', { p_bureau: m.bureau, p_empreinte: emp });
          const d = Array.isArray(dl) && dl[0] ? dl[0] : { bloque: null, suivi: false };
          const id = d.bloque ? null : await rpc('brevo_envoi_permis', { p_personne: m.personne, p_bureau: m.bureau, p_sorte: 'programmes', p_empreinte: emp });
          if (d.bloque) { issue = 'brevo'; motBrevo = MOTS_BLOQUE[String(d.bloque)] ?? MOTS_BLOQUE.bloquee; }
          else if (id == null) { issue = 'brevo'; motBrevo = MOTS_BREVO.plafond; }
          else {
            const r = await envoyerBrevo({ cle: pb.cle, expediteur: pb.expediteur, nom: pb.nom, copie: pb.copie !== false, suivi: d.suivi === true },
              m.destinataire, String(m.sujet ?? ''), String(m.corps ?? ''), ['programmes']);
            code = r.code;
            if (r.resultat === 'parti') { issue = 'parti'; try { await rpc('brevo_envoi_noter', { p_id: id, p_message_id: r.messageId || null }); } catch { /* parti quand meme */ } }
            else if (r.resultat === 'incertain') issue = 'incertain';
            else {
              issue = 'brevo';
              motBrevo = r.resultat === 'refus_cle' ? (r.ip ? MOTS_BREVO.ip : MOTS_BREVO.refus_cle) : (MOTS_BREVO[r.resultat] ?? MOTS_BREVO.erreur);
              if (r.resultat === 'refus_cle') { try { await rpc('brevo_noter', { p_bureau: m.bureau, p_etat: 'refusee', p_erreur: motBrevo }); } catch { /* rien */ } }
            }
          }
        }
      }
      if (issue === 'erreur') {
      const bl = await rpc('boite_pour_envoi', { p_personne: m.personne, p_bureau: m.bureau });
      const b: Boite | null = Array.isArray(bl) && bl[0] ? bl[0] : null;
      if (!b) issue = 'pas_branchee';
      else if (!m.destinataire) issue = 'destinataire';
      else if ((await rpc('boite_envoi_permis', { p_personne: m.personne, p_bureau: m.bureau })) !== true) issue = 'plafond';
      else {
        const r = await envoyerSmtp(b, m.destinataire, String(m.sujet ?? ''), String(m.corps ?? ''));
        issue = r.resultat; code = r.code;
        if (issue === 'refus') {
          try { await rpc('boite_reconnecter', { p_personne: m.personne, p_bureau: m.bureau, p_erreur: 'mot de passe refuse (' + code + ')' }); } catch { /* rien */ }
        }
      }
      }
    } catch (e) { console.error('mails-programmes: ' + String((e as Error).message)); issue = 'erreur'; }

    const resultat = issue === 'parti' ? 'parti' : issue === 'incertain' ? 'incertain' : 'echec';
    try {
      await rpc('mail_resultat', { p_bureau: m.bureau, p_mail: m.mail_id, p_resultat: resultat,
        p_echec: resultat === 'echec' ? (issue === 'brevo' ? motBrevo : (MOTS[issue] ?? MOTS.autre)) : resultat === 'incertain' ? 'La connexion a coupé pendant l’envoi : il est peut-être parti.' : null });
    } catch (e) { console.error('mails-programmes: resultat ' + String((e as Error).message)); }
    if (resultat === 'parti') rapport.partis++; else if (resultat === 'incertain') rapport.incertains++; else rapport.echecs++;
    console.log('mails-programmes: ' + resultat + ' ' + issue + (code ? ' ' + code : ''));
  }
  return reponse(rapport);
});
