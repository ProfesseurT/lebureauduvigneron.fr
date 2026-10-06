/* ============================================================================
   supabase/functions/signature : la porte de la page /signer/ (lot 55, 01/10/2026)
   ----------------------------------------------------------------------------
   Le client du vigneron ouvre le lien de signature SANS COMPTE. La page /signer/
   du site ne parle donc pas a PostgREST : elle parle a cette fonction, publique
   (verify_jwt desactive au deploiement), qui appelle deux fonctions de la base
   avec la cle de service :
     - `signature_lire(jeton)`  : ce que la page montre (etat, copie, totaux) ;
     - `signature_poser(...)`   : la signature, puis l'acceptation du devis.
   Ces deux fonctions ne sont executables par AUCUN role du navigateur. C'est
   tout le sens de ce detour : la doc Supabase deconseille d'ouvrir une fonction
   `security definer` a anon dans `public`.

   CETTE FONCTION NE DECIDE DE RIEN. Le jeton, l'etat du devis, l'expiration, la
   copie, les refus : tout est dans la base, qui fait foi. Ici on ne fait que
   - refuser ce qui n'a pas la forme d'un jeton avant de reveiller la base ;
   - relever l'adresse IP (premiere valeur de x-forwarded-for) et le navigateur.
     C'est un INDICE, pas une preuve : un client peut forger cet en-tete, et la
     page le dit (RGPD art. 13) ;
   - borner la taille de ce qu'on recoit ;
   - lire le STATUT du devis quand le lien dit « signe » ou « clos », et le telephone du
     domaine quand il dit aussi « expire » (voir `devenir`).

   AUCUN MAIL NE PART D'ICI (decision de Ted du 01/10/2026) : le lien part de la
   messagerie du vigneron, et la regle du SEUIL ne joue pas.

   DEPLOIEMENT : depuis ce dossier (suivi par git, contrairement a _deploiement/),
   APRES le commit, avec verify_jwt = false. Rien a recoller : elle n'importe rien.
   ============================================================================ */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/* Le jeton suffit a ouvrir, et rien d'autre n'ouvre : l'origine n'a pas besoin
   d'etre bornee pour proteger quoi que ce soit, et la page peut etre servie par
   le domaine definitif comme par l'adresse Vercel. */
const ENTETES = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};

function reponse(corps: unknown, code = 200) {
  return new Response(JSON.stringify(corps), {
    status: code,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...ENTETES },
  });
}

const JETON = /^[0-9a-f]{64}$/;
const EMPREINTE = /^[0-9a-f]{64}$/;

function texte(v: unknown, max: number) {
  return String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/* LA PREMIERE valeur de x-forwarded-for : celle du client vu par le premier
   relais. Les suivantes sont les relais eux-memes. */
function adresseIp(req: Request) {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const prem = xff.split(',')[0]?.trim() ?? '';
  const ip = prem || (req.headers.get('x-real-ip') ?? '').trim();
  return /^[0-9a-fA-F:.]{2,64}$/.test(ip) ? ip : null;
}

async function rpc(nom: string, corps: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(corps),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${nom} : ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

/* CE QUE LE DEVIS EST DEVENU (01/10/2026), pour les deux etats ou la page doit le DIRE :
   - `signe`, alors que le domaine a annule l'acceptation depuis : la base garde la preuve,
     donc `signature_lire` dit encore « signe », et le client lirait un accord qui n'existe
     plus ;
   - `clos`, parce que le domaine a accepte le devis pendant que le client signait (course) :
     sans le dire, le client lit « remplace ou retire », qui est faux.
   C'est un FAIT lu dans la base (le statut du devis), jamais une decision : l'etat reste celui
   que la base a rendu, et la page choisit sa phrase. Une lecture ratee ne rend rien, et la
   page garde la phrase d'avant. A remplacer par un champ de `signature_lire` le jour ou son
   SQL bougera : deux lectures de plus ici, seulement dans ces deux etats. */
async function hex256(t: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
}
async function lireTable(chemin: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' },
  });
  if (!r.ok) return null;
  const t = await r.text();
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}
async function devenir(j: string) {
  try {
    const l = await lireTable(`devis_liens?jeton_hash=eq.${await hex256(j)}&select=bureau,devis_id&limit=1`);
    const x = Array.isArray(l) ? l[0] : null;
    if (!x || !x.bureau || !x.devis_id) return null;
    const d = await lireTable(`devis?bureau=eq.${encodeURIComponent(x.bureau)}&devis_id=eq.${encodeURIComponent(x.devis_id)}&select=statut,signe_le,vendeur_tel:vendeur->>telephone&limit=1`);
    const y = Array.isArray(d) ? d[0] : null;
    if (!y || !y.statut) return null;
    const tel = typeof y.vendeur_tel === 'string' ? y.vendeur_tel.trim().slice(0, 40) : '';
    return { statut: String(y.statut), signe: !!y.signe_le, tel };
  } catch { return null; }
}
async function avecDevenir(j: string, r: unknown) {
  const o = r as Record<string, unknown> | null;
  if (o && typeof o === 'object' && (o.etat === 'signe' || o.etat === 'clos' || o.etat === 'expire')) {
    const v = await devenir(j);
    if (v && o.etat !== 'expire') { o.devis_statut = v.statut; o.devis_signe = v.signe; }
    /* W9 (02/10/2026) : le TELEPHONE du domaine, pour qu'un lien eteint ou expire dise comment
       le joindre. C'est le contact public deja imprime sur le devis (instantane `vendeur`), au
       meme titre que `vendeur_email` que la base rend deja : rien du devis lui-meme (ni
       client, ni montant, ni copie). Seulement s'il n'est pas deja dans la reponse. */
    if (v && v.tel && !o.vendeur_tel) o.vendeur_tel = v.tel;
  }
  return o;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: ENTETES });
  if (!SUPABASE_URL || !SERVICE_KEY) return reponse({ erreur: 'configuration' }, 500);

  try {
    if (req.method === 'GET') {
      const j = (new URL(req.url).searchParams.get('j') ?? '').trim().toLowerCase();
      if (!JETON.test(j)) return reponse({ etat: 'inconnu' });
      return reponse(await avecDevenir(j, await rpc('signature_lire', { p_jeton: j })));
    }

    if (req.method === 'POST') {
      const brut = await req.text();
      /* LOT 70 : la signature voyage en image PNG (150 000 signes au plus, la base le verifie). */
      if (brut.length > 160000) return reponse({ erreur: 'trop long' }, 413);
      let c: Record<string, unknown> = {};
      try { c = JSON.parse(brut); } catch { return reponse({ erreur: 'illisible' }, 400); }
      /* `null`, un nombre, une chaine ou un tableau se lisent en JSON : ce n'est pas un corps de
         signature pour autant. Sans ce garde, `c.j` levait plus bas et le journal notait une
         « panne » qui n'en etait pas une. */
      if (!c || typeof c !== 'object' || Array.isArray(c)) return reponse({ erreur: 'illisible' }, 400);
      const j = String(c.j ?? '').trim().toLowerCase();
      if (!JETON.test(j)) return reponse({ etat: 'inconnu' });
      const empreinte = String(c.empreinte ?? '').trim().toLowerCase();
      return reponse(await avecDevenir(j, await rpc('signature_poser', {
        p_jeton: j,
        p_nom: texte(c.nom, 200),
        p_qualite: texte(c.qualite, 200),
        p_accord: c.accord === true,
        p_empreinte: EMPREINTE.test(empreinte) ? empreinte : null,
        p_ip: adresseIp(req),
        p_agent: texte(req.headers.get('user-agent'), 400) || null,
        /* L'image et sa facon ne sont pas lues ici : la base refuse tout ce qui n'est pas un PNG. */
        p_trace: typeof c.trace === 'string' && c.trace.length <= 150000 ? c.trace : null,
        p_trace_mode: c.trace_mode === 'dessin' || c.trace_mode === 'manuscrit' ? c.trace_mode : null,
      })));
    }

    return reponse({ erreur: 'methode' }, 405);
  } catch (e) {
    /* Le detail reste dans le journal de la fonction ; la page ne recoit qu'un mot. */
    console.error('signature', String(e));
    return reponse({ erreur: 'panne' }, 502);
  }
});
