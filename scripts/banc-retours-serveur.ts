/* ============================================================================
   BANC SERVEUR DU LOT 90 (ce que Brevo renvoie), 09/10/2026. Deno + PostgreSQL 16 jetable.
   ============================================================================
   Fait tourner les VRAIES fonctions Edge `brevo-retours`, `brevo` et `mails-programmes` contre
   le VRAI SQL du lot 90 : chaque appel `rpc()` des fonctions devient une requete psql en
   service_role sur une base montee par le banc SQL du lot 89 + lot90-retours-brevo.sql. Seuls
   Brevo et l'authentification sont simules.

   COMMENT LE LANCER (Postgres ecoutant sur /tmp, port 55490, cf. banc-lot90-retours-brevo.sql) :
     deno run -A scripts/banc-retours-serveur.ts
   PG_PORT=xxxx pour un autre port. Derniere ligne : « BANC SERVEUR DU LOT 90 : N ok, 0 echec ».
   ============================================================================ */
const RACINE = new URL('..', import.meta.url).pathname;
const PORT = Deno.env.get('PG_PORT') ?? '55490';
const BASE = 'banc90srv';
let ok = 0, ko = 0;
function dit(b: boolean, m: string, det?: unknown) {
  if (b) { ok++; console.log('  ok    : ' + m); } else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + JSON.stringify(det) : '')); }
}

async function psql(args: string[], entree?: string) {
  const c = new Deno.Command('psql', { args: ['-h', '/tmp', '-p', PORT, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt', ...args],
    stdin: entree ? 'piped' : 'null', stdout: 'piped', stderr: 'piped', cwd: RACINE + 'supabase' });
  const p = c.spawn();
  if (entree) { const w = p.stdin.getWriter(); await w.write(new TextEncoder().encode(entree)); await w.close(); }
  const r = await p.output();
  return { code: r.code, out: new TextDecoder().decode(r.stdout).trim(), err: new TextDecoder().decode(r.stderr).trim() };
}
async function sql(q: string) {
  const r = await psql(['-d', BASE, '-c', q]);
  if (r.code !== 0) throw new Error(r.err);
  return r.out;
}

// ------------------------------------------------------------------ LA BASE
await psql(['-d', 'postgres', '-c', `drop database if exists ${BASE}`]);
await psql(['-d', 'postgres', '-c', `create database ${BASE}`]);
let r0 = await psql(['-d', BASE, '-f', 'banc-lot89-listes-brevo.sql']);
if (r0.code !== 0) { console.log(r0.err); Deno.exit(1); }
r0 = await psql(['-d', BASE, '-f', 'lot90-retours-brevo.sql']);
if (r0.code !== 0) { console.log(r0.err); Deno.exit(1); }
const B = 'b9100000-0000-0000-0000-000000000001';
const ADMIN = '91010000-0000-0000-0000-000000000001', SIMPLE = '91020000-0000-0000-0000-000000000002';
await sql(`
  grant select on public.brevo, public.brevo_bloquees, public.suivi_accords, public.brevo_retours, public.brevo_envois to service_role;
  insert into auth.users (id, email) values ('${ADMIN}', 'a91@clos.fr'), ('${SIMPLE}', 's91@clos.fr');
  insert into public.bureaux (bureau, nom) values ('${B}', 'Clos 91');
  insert into public.membres (bureau, personne, role) values ('${B}', '${ADMIN}', 'maitre'), ('${B}', '${SIMPLE}', 'simple');`);

// ------------------------------------------------------------------ LE FAUX REST : rpc -> psql
const SRF = new Set(['brevo_pour_envoi', 'brevo_destinataire', 'mails_a_partir', 'boite_pour_envoi']);
const lit = (v: unknown) => v === null || v === undefined ? 'null'
  : `'${(typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/'/g, "''")}'`;
async function rpcSql(nom: string, corps: Record<string, unknown>) {
  const args = Object.entries(corps).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
  const q = SRF.has(nom) ? `select coalesce(json_agg(t), '[]') from public.${nom}(${args}) t` : `select to_json(public.${nom}(${args}))`;
  const r = await psql(['-d', BASE, '-c', `set role service_role; ${q}`]);
  if (r.code !== 0) return new Response(JSON.stringify({ message: r.err }), { status: 400 });
  return new Response(r.out === '' ? 'null' : r.out, { status: 200, headers: { 'Content-Type': 'application/json' } });
}

// ------------------------------------------------------------------ LE FAUX BREVO
type Hook = { id: number; url: string; type: string; events: string[]; headers?: Array<{ key: string; value: string }> };
const brevo = {
  hooks: [] as Hook[], prochain: 10, envois: [] as Array<Record<string, unknown>>,
  bloques: [] as Array<Record<string, unknown>>, bloquesCount: null as number | null,
  contacts: [] as Array<Record<string, unknown>>, refuserPost: 0, posts: 0, supprimes: [] as number[],
};
const SUPA = 'https://projet.supabase.co';
const realFetch = globalThis.fetch;
globalThis.fetch = async (entree: RequestInfo | URL, init?: RequestInit) => {
  const url = String(entree instanceof Request ? entree.url : entree);
  const methode = (init?.method ?? 'GET').toUpperCase();
  const corps = init?.body ? JSON.parse(String(init.body)) : null;
  if (url.startsWith(SUPA + '/rest/v1/rpc/')) return rpcSql(url.slice((SUPA + '/rest/v1/rpc/').length), corps ?? {});
  if (url === SUPA + '/auth/v1/user') {
    const a = new Headers(init?.headers).get('Authorization') ?? '';
    const id = a === 'Bearer admin' ? ADMIN : a === 'Bearer simple' ? SIMPLE : null;
    return new Response(JSON.stringify(id ? { id } : {}), { status: id ? 200 : 401 });
  }
  const u = new URL(url);
  if (u.host === 'api.brevo.com') {
    const ch = u.pathname.replace('/v3', '');
    if (ch === '/webhooks' && methode === 'GET') return Response.json({ webhooks: brevo.hooks.filter((h) => h.type === (u.searchParams.get('type') ?? 'transactional')) });
    if (ch === '/webhooks' && methode === 'POST') {
      brevo.posts++;
      if (brevo.refuserPost && brevo.posts === brevo.refuserPost) return Response.json({ code: 'bad', message: 'non' }, { status: 400 });
      const h = { id: brevo.prochain++, ...corps };
      brevo.hooks.push(h);
      return Response.json({ id: h.id }, { status: 201 });
    }
    if (ch.startsWith('/webhooks/') && methode === 'DELETE') {
      const id = Number(ch.split('/')[2]);
      brevo.supprimes.push(id);
      brevo.hooks = brevo.hooks.filter((h) => h.id !== id);
      return new Response(null, { status: 204 });
    }
    if (ch === '/smtp/blockedContacts') {
      const off = Number(u.searchParams.get('offset') ?? 0), lim = Number(u.searchParams.get('limit') ?? 50);
      return Response.json({ count: brevo.bloquesCount ?? brevo.bloques.length, contacts: brevo.bloques.slice(off, off + lim) });
    }
    if (ch === '/contacts') {
      const off = Number(u.searchParams.get('offset') ?? 0), lim = Number(u.searchParams.get('limit') ?? 50);
      return Response.json({ count: brevo.contacts.length, contacts: brevo.contacts.slice(off, off + lim) });
    }
    if (ch === '/smtp/email') { brevo.envois.push(corps); return Response.json({ messageId: '<m' + brevo.envois.length + '@relay>' }, { status: 201 }); }
    if (ch === '/account') return Response.json({ email: 'compte@clos.fr', companyName: 'Clos', plan: [] });
    return new Response('?', { status: 404 });
  }
  return realFetch(entree, init);
};

// ------------------------------------------------------------------ LES FONCTIONS, VRAIES
Deno.env.set('SUPABASE_URL', SUPA);
Deno.env.set('SUPABASE_ANON_KEY', 'anon');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service');
Deno.env.set('NOTIF_CLE', 'n'.repeat(40));
const servis: Array<(r: Request) => Promise<Response>> = [];
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: (r: Request) => Promise<Response>) => { servis.push(h); return {}; };
await import(RACINE + 'supabase/functions/brevo-retours/index.ts');
await import(RACINE + 'supabase/functions/brevo/index.ts');
const [retours, fBrevo] = servis;
const { empreinte } = await import(RACINE + 'supabase/functions/_shared/empreinte.ts');

const appelBrevo = (qui: string, corps: Record<string, unknown>) => fBrevo(new Request(SUPA + '/functions/v1/brevo', {
  method: 'POST', headers: { Authorization: 'Bearer ' + qui, 'Content-Type': 'application/json' }, body: JSON.stringify({ bureau: B, ...corps }) }));
const webhook = (jeton: string | null, corps: unknown, b = B) => retours(new Request(SUPA + '/functions/v1/brevo-retours?b=' + b, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(jeton ? { 'x-bdv-jeton': jeton } : {}) }, body: JSON.stringify(corps) }));
const E = async (a: string) => await empreinte(B, a);

// ------------------------------------------------------------------ 1. BRANCHER
console.log('1. Brancher Brevo pose les retours et rattrape l historique');
brevo.hooks.push({ id: 1, url: SUPA + '/functions/v1/brevo-retours?b=' + B, type: 'transactional', events: ['opened'] });
brevo.hooks.push({ id: 2, url: 'https://autre-outil.fr/hook', type: 'transactional', events: ['opened'] });
brevo.bloques = [
  { email: 'Morte@Cave.fr', reason: { code: 'hardBounce', message: 'x' }, blockedAt: '2026-03-01T10:00:00Z' },
  { email: 'spam@cave.fr', reason: { code: 'contactFlaggedAsSpam' }, blockedAt: '2026-04-01T10:00:00Z' },
  { email: 'parti@cave.fr', reason: { code: 'unsubscribedViaEmail' }, blockedAt: null },
];
brevo.contacts = [{ email: 'promo@cave.fr', emailBlacklisted: true, attributes: {} }, { email: 'fidele@cave.fr', emailBlacklisted: false, attributes: {} }];
let r = await appelBrevo('simple', { action: 'retours_brancher' });
dit(r.status === 403, 'un simple membre ne branche pas les retours');
r = await appelBrevo('admin', { action: 'brancher', cle: 'xkeysib-' + 'a'.repeat(40) });
let j = await r.json();
dit(j.resultat === 'branche' && j.retours === 'branches', 'brancher Brevo branche aussi les retours', j);
dit(brevo.supprimes.includes(1) && !brevo.supprimes.includes(2), 'l ancien webhook du bureau part, celui d un autre outil reste', brevo.supprimes);
const nos = brevo.hooks.filter((h) => h.url.includes('brevo-retours'));
dit(nos.length === 2 && nos.some((h) => h.type === 'transactional') && nos.some((h) => h.type === 'marketing'), 'deux webhooks : mails 1 a 1 et campagnes', nos.map((h) => h.type));
const jeton = nos[0].headers?.find((h) => h.key === 'x-bdv-jeton')?.value ?? '';
dit(jeton.length >= 40 && nos[1].headers?.[0]?.value === jeton, 'le jeton part dans l en-tete, le meme pour les deux');
dit(!nos.some((h) => h.url.includes(jeton)), 'le jeton n est pas dans l adresse');
dit(nos.find((h) => h.type === 'transactional')!.events.includes('opened') && !nos.find((h) => h.type === 'marketing')!.events.includes('opened'),
  'les ouvertures ne sont demandees que pour les mails 1 a 1');
const enBase = await sql(`select retours_jeton from public.brevo where bureau = '${B}'`);
dit(/^[0-9a-f]{64}$/.test(enBase) && !enBase.includes(jeton), 'la base garde l empreinte du jeton, pas le jeton');
const bl = await sql(`select string_agg(source || ':' || motif, ',' order by source, motif) from public.brevo_bloquees where bureau = '${B}'`);
dit(bl === 'campagne:desinscrit,transactionnel:desinscrit,transactionnel:morte,transactionnel:spam', 'le rattrapage range l historique, motif par motif', bl);
dit(await sql(`select count(*) from public.brevo_bloquees where empreinte = '${await E('morte@cave.fr')}'`) === '1',
  'empreinte : majuscules et espaces ne changent rien');
dit(await empreinte(B.toUpperCase(), '  Cave@X.fr ') === await sql(`select encode(sha256(convert_to('${B}' || ':' || 'cave@x.fr', 'UTF8')), 'hex')`),
  'empreinte : la meme que la formule ecrite dans le SQL (bureau:adresse en minuscules)');

// ------------------------------------------------------------------ 2. LA PORTE
console.log('2. La porte du webhook');
r = await webhook(null, { event: 'hard_bounce', email: 'x@y.fr' });
dit(r.status === 401, 'sans jeton : 401');
r = await webhook('z'.repeat(43), { event: 'hard_bounce', email: 'x@y.fr' });
dit(r.status === 401, 'mauvais jeton : 401');
r = await webhook(jeton, { event: 'hard_bounce', email: 'x@y.fr' }, 'b9100000-0000-0000-0000-000000000009');
dit(r.status === 401, 'bon jeton, autre bureau : 401');
dit(await sql(`select count(*) from public.brevo_bloquees where empreinte = '${await E('x@y.fr')}'`) === '0', 'rien n est entre par une porte fermee');

// ------------------------------------------------------------------ 3. LES EVENEMENTS
console.log('3. Les evenements');
r = await webhook(jeton, { event: 'hard_bounce', email: 'neuve@cave.fr', 'message-id': '<inconnu@x>', ts_event: 1791500000 });
j = await r.json();
dit(r.status === 200 && j.notes === 1, 'un rejet definitif est note', j);
dit(await sql(`select motif || ':' || source from public.brevo_bloquees where empreinte = '${await E('neuve@cave.fr')}'`) === 'morte:transactionnel', 'adresse morte, mails 1 a 1');
r = await webhook(jeton, { event: 'unsubscribe', email: 'camp@cave.fr', camp_id: 12, list_id: [3] });
dit(r.status === 200 && await sql(`select motif || ':' || source from public.brevo_bloquees where empreinte = '${await E('camp@cave.fr')}'`) === 'desinscrit:campagne',
  'une desinscription de campagne se range cote campagnes');
r = await webhook(jeton, [{ event: 'delivered', email: 'a@b.fr' }, { event: 'soft_bounce', email: 'a@b.fr' }, { event: 'request', email: 'a@b.fr' }]);
j = await r.json();
dit(r.status === 200 && j.notes === 0 && j.ignores === 3, 'livre, rebond passager, demande : 200 et rien', j);
r = await webhook(jeton, { event: 'opened', email: 'pas-un-mail' });
dit(r.status === 200 && (await r.json()).ignores === 1, 'une adresse qui n en est pas une : ignoree');
dit(await sql(`select count(*) from information_schema.columns where table_schema = 'public' and table_name in ('brevo_bloquees','brevo_retours','suivi_accords') and column_name in ('email','adresse')`) === '0',
  'aucune adresse en base');

// ------------------------------------------------------------------ 4. ENVOYER
console.log('4. Envoyer par Brevo');
await sql(`set role authenticated; select set_config('request.jwt.claim.sub', '${SIMPLE}', false);
  select public.brevo_choisir('${B}', null, 'simple@clos.fr', 'Simple', true);`);
r = await appelBrevo('simple', { action: 'envoyer', sorte: 'affaires', adresse: 'Morte@cave.fr', sujet: 'Bonjour', texte: 'x' });
j = await r.json();
dit(j.resultat === 'bloque' && j.motif === 'morte' && brevo.envois.length === 0, 'adresse morte : rien ne part, le motif est dit', j);
r = await appelBrevo('simple', { action: 'envoyer', sorte: 'affaires', adresse: 'parti@cave.fr', sujet: 'Bonjour', texte: 'x' });
j = await r.json();
dit(j.resultat === 'bloque' && j.motif === 'desinscrit' && brevo.envois.length === 0, 'desinscrit des mails 1 a 1 : rien ne part');
r = await appelBrevo('simple', { action: 'envoyer', sorte: 'affaires', adresse: 'promo@cave.fr', sujet: 'Bonjour', texte: 'x' });
j = await r.json();
dit(j.resultat === 'parti' && brevo.envois.length === 1, 'desinscrit des seules campagnes : le mail perso part', j);
const env1 = brevo.envois[0] as { to: Array<Record<string, unknown>>; bcc?: Array<Record<string, unknown>> };
dit(env1.to[0].contactPixelTrackingConsent === false, 'sans accord du client : Brevo est prie de ne pas suivre', env1.to);
dit(env1.bcc?.[0]?.contactPixelTrackingConsent === false, 'la copie a soi n est jamais suivie');
dit(await sql(`select empreinte from public.brevo_envois where message_id = '<m1@relay>'`) === await E('promo@cave.fr'), 'le mail parti porte l empreinte du destinataire');
await sql(`set role authenticated; select set_config('request.jwt.claim.sub', '${SIMPLE}', false);
  select public.suivi_accorder('${B}', '${await E('fidele@cave.fr')}', true);`);
r = await appelBrevo('simple', { action: 'envoyer', sorte: 'affaires', adresse: 'fidele@cave.fr', sujet: 'Millesime', texte: 'x' });
const env2 = brevo.envois[1] as { to: Array<Record<string, unknown>> };
dit((await r.json()).resultat === 'parti' && env2.to[0].contactPixelTrackingConsent === true, 'avec accord : le suivi est demande');

// ------------------------------------------------------------------ 5. OUVERT, CLIQUE
console.log('5. Ouvertures et clics, avec et sans accord');
await webhook(jeton, { event: 'opened', email: 'promo@cave.fr', 'message-id': '<m1@relay>', ts_event: 1791500100 });
dit(await sql(`select count(*) from public.brevo_retours r join public.brevo_envois e on e.id = r.envoi where e.message_id = '<m1@relay>'`) === '0',
  'sans accord : l ouverture n est pas gardee');
await webhook(jeton, { event: 'unique_opened', email: 'fidele@cave.fr', 'message-id': '<m2@relay>', ts_event: 1791500100 });
await webhook(jeton, { event: 'opened', email: 'fidele@cave.fr', 'message-id': '<m2@relay>', ts_event: 1791509999 });
await webhook(jeton, { event: 'click', email: 'fidele@cave.fr', 'message-id': '<m2@relay>', link: 'https://x', ts_event: 1791500200 });
await webhook(jeton, { event: 'opened', email: 'simple@clos.fr', 'message-id': '<m2@relay>', ts_event: 1791500300 });
const vu = await sql(`select string_agg(r.evenement || '@' || extract(epoch from r.le)::bigint, ',' order by r.evenement)
  from public.brevo_retours r join public.brevo_envois e on e.id = r.envoi where e.message_id = '<m2@relay>'`);
dit(vu === 'clic@1791500200,ouvert@1791500100', 'avec accord : premiere ouverture et premier clic, la copie a soi ne compte pas', vu);

// ------------------------------------------------------------------ 6. RELIRE, ECHECS
console.log('6. Relire et echouer proprement');
brevo.bloques = [{ email: 'spam@cave.fr', reason: { code: 'contactFlaggedAsSpam' }, blockedAt: '2026-04-01T10:00:00Z' }];
brevo.bloquesCount = 5; // Brevo en annonce 5 et n'en donne qu'un : lecture incomplete
r = await appelBrevo('admin', { action: 'retours_relire' });
j = await r.json();
dit(j.complet === false && typeof j.mot === 'string', 'lecture incomplete : on le dit', j);
dit(await sql(`select count(*) from public.brevo_bloquees where bureau = '${B}' and source = 'transactionnel' and empreinte = '${await E('morte@cave.fr')}'`) === '1',
  'lecture incomplete : rien n est efface');
brevo.bloquesCount = null;
r = await appelBrevo('admin', { action: 'retours_relire' });
j = await r.json();
dit(j.complet === true && await sql(`select count(*) from public.brevo_bloquees where bureau = '${B}' and source = 'transactionnel' and empreinte = '${await E('morte@cave.fr')}'`) === '0',
  'lecture complete : une adresse debloquee chez Brevo part', j);
brevo.posts = 0; brevo.refuserPost = 2; // le premier passe, le second est refuse
const avant = brevo.hooks.length;
r = await appelBrevo('admin', { action: 'retours_brancher' });
j = await r.json();
dit(j.resultat === 'erreur' && typeof j.mot === 'string', 'Brevo refuse le second webhook : on le dit', j);
dit(brevo.hooks.filter((h) => h.url.includes('brevo-retours')).length === 0 && brevo.hooks.length === avant - 2, 'jamais a moitie : aucun webhook du bureau ne reste');
dit(await sql(`select coalesce(retours_etat, '') || ':' || coalesce(retours_jeton, 'null') from public.brevo where bureau = '${B}'`) === 'echec:null', 'la base dit l echec, sans jeton');
r = await webhook(jeton, { event: 'hard_bounce', email: 'q@q.fr' });
dit(r.status === 401, 'l ancien jeton ne passe plus');

console.log(`\nBANC SERVEUR DU LOT 90 : ${ok} ok, ${ko} echec`);
await psql(['-d', 'postgres', '-c', `drop database if exists ${BASE}`]);
Deno.exit(ko ? 1 : 0);
