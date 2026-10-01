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
   - borner la taille de ce qu'on recoit.

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: ENTETES });
  if (!SUPABASE_URL || !SERVICE_KEY) return reponse({ erreur: 'configuration' }, 500);

  try {
    if (req.method === 'GET') {
      const j = (new URL(req.url).searchParams.get('j') ?? '').trim().toLowerCase();
      if (!JETON.test(j)) return reponse({ etat: 'inconnu' });
      return reponse(await rpc('signature_lire', { p_jeton: j }));
    }

    if (req.method === 'POST') {
      const brut = await req.text();
      if (brut.length > 4000) return reponse({ erreur: 'trop long' }, 413);
      let c: Record<string, unknown> = {};
      try { c = JSON.parse(brut); } catch { return reponse({ erreur: 'illisible' }, 400); }
      const j = String(c.j ?? '').trim().toLowerCase();
      if (!JETON.test(j)) return reponse({ etat: 'inconnu' });
      const empreinte = String(c.empreinte ?? '').trim().toLowerCase();
      return reponse(await rpc('signature_poser', {
        p_jeton: j,
        p_nom: texte(c.nom, 200),
        p_qualite: texte(c.qualite, 200),
        p_accord: c.accord === true,
        p_empreinte: EMPREINTE.test(empreinte) ? empreinte : null,
        p_ip: adresseIp(req),
        p_agent: texte(req.headers.get('user-agent'), 400) || null,
      }));
    }

    return reponse({ erreur: 'methode' }, 405);
  } catch (e) {
    /* Le detail reste dans le journal de la fonction ; la page ne recoit qu'un mot. */
    console.error('signature', String(e));
    return reponse({ erreur: 'panne' }, 502);
  }
});
