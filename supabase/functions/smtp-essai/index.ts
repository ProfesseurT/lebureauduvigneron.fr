// smtp-essai : ESSAI JETABLE du 07/10/2026, a supprimer apres le test.
// Question : une Edge Function Supabase peut-elle envoyer un mail par SMTP en SSL
// implicite sur le port 465 (option B, voir JOURNAL.md du 07/10/2026) ?
//
// Elle n'envoie QU'A l'adresse de la boite elle-meme : aucun destinataire n'est lu dans
// la requete, donc elle ne peut servir de relais a personne.
// Secrets a poser dans Supabase (Edge Functions > Secrets) : SMTP_ESSAI_USER (adresse
// complete), SMTP_ESSAI_PASS (mot de passe d'application), SMTP_ESSAI_HOST (facultatif,
// smtp.gmail.com par defaut). Le mot de passe n'apparait jamais dans la reponse.
// Deployee avec verify_jwt = true.
import nodemailer from 'npm:nodemailer@^9';

const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async () => {
  const user = Deno.env.get('SMTP_ESSAI_USER') || '';
  const pass = Deno.env.get('SMTP_ESSAI_PASS') || '';
  const host = Deno.env.get('SMTP_ESSAI_HOST') || 'smtp.gmail.com';
  const r: Record<string, unknown> = { host, port: 465, user_pose: !!user, pass_pose: !!pass };

  // Etape 1 : la connexion TLS au port 465 passe-t-elle ? (separe « port bloque » de « refus »)
  const t0 = Date.now();
  try {
    const c = await Deno.connectTls({ hostname: host, port: 465 });
    const buf = new Uint8Array(512);
    const n = await Promise.race([
      c.read(buf),
      new Promise<null>((_, ko) => setTimeout(() => ko(new Error('pas de salut en 10 s')), 10000)),
    ]);
    r.etape1_salut = new TextDecoder().decode(buf.subarray(0, n || 0)).trim().slice(0, 120);
    r.etape1_ms = Date.now() - t0;
    try { c.close(); } catch (_) { /* rien */ }
  } catch (e) {
    r.etape1_erreur = String((e as Error)?.message || e).slice(0, 300);
    r.etape1_ms = Date.now() - t0;
    return json(r);
  }

  if (!user || !pass) { r.etape2 = 'secrets absents, envoi non tente'; return json(r); }

  // Etape 2 : authentification et envoi vers soi-meme.
  const t1 = Date.now();
  try {
    const tr = nodemailer.createTransport({ host, port: 465, secure: true, auth: { user, pass } });
    const info = await tr.sendMail({
      from: user, to: user,
      subject: 'Essai SMTP 465 depuis Supabase (Le bureau du vigneron)',
      text: 'Si tu lis ce mail, l\'option B fonctionne : envoi par le port 465 depuis une Edge Function.',
    });
    r.etape2_ok = true;
    r.etape2_reponse = String(info.response || '').slice(0, 200);
    r.etape2_acceptes = info.accepted;
  } catch (e) {
    const err = e as { code?: string; responseCode?: number; message?: string };
    r.etape2_ok = false;
    r.etape2_code = err.code; r.etape2_code_smtp = err.responseCode;
    r.etape2_erreur = String(err.message || e).replaceAll(pass || '\u0000', '***').slice(0, 300);
  }
  r.etape2_ms = Date.now() - t1;
  return json(r);
});
