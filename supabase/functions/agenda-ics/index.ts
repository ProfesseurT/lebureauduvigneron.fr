/* ============================================================================
   supabase/functions/agenda-ics/index.ts
   ============================================================================
   REND l'abonnement agenda d'un compte, au format iCalendar. Elle ne CALCULE
   pas les dates : c'est `src/js/bdv-echeances.js` qui le fait, le meme fichier
   que la grille du bureau et que la page publique des echeances. Ici on lit un
   jeton, on retrouve le compte, on applique ses choix, et on met en forme.

   POURQUOI `import './bdv-echeances.js'` ET PAS UNE COPIE.
   Meme motif et meme forme que `courrier-matin` : le fichier vit dans
   `src/js/`, en un seul exemplaire, et il est JOINT au moment du deploiement
   par `npm run agenda:joindre`. Deux copies auraient diverge, et la divergence
   se serait vue des mois plus tard, dans l'agenda d'un client, sans que
   personne ne sache lequel des deux avait raison.

   DEUX EMPREINTES ET PAS UNE, et la deuxieme est celle qui servira le plus.
   Le code bouge rarement ; la bibliotheque bouge chaque fois que Ted ajoute
   une date ou confirme un salon. Une fonction deployee avec la bibliotheque de
   l'an dernier rendrait un calendrier faux sans lever la moindre erreur. Ces
   deux lignes sont ECRITES par `npm run agenda:joindre` et controlees par
   `npm run verif`. Ne pas les modifier a la main, ne pas les reformater :
   elles sont lues par une expression exacte.

   empreinte du code joint : sha256 4da4ce3cadb2b56d, 601 lignes.
   empreinte de la bibliotheque deployee : sha256 0ea3b12208a62048, 49 occurrences.

   ----------------------------------------------------------------------------
   CE QUE CE FLUX PORTE, ET CE QU'IL NE PORTERA JAMAIS
   ----------------------------------------------------------------------------
   UNE URL .ICS EST UN MOT DE PASSE DEGUISE EN LIEN. Google Agenda la garde sur
   ses serveurs, elle traine dans l'historique du navigateur, elle se recopie
   dans un mail au comptable, et elle ne s'expire jamais toute seule.

   Decision de Ted, 15/09/2026 : le flux ne porte QUE la bibliotheque, les
   quatre familles publiques. NI « Mes taches », NI les rappels clients. Une
   URL qui fuite ne livre donc rien que le site ne publie deja.

   LE GARDE-FOU EST DANS LE CODE ET PAS SEULEMENT DANS CETTE PHRASE : voir
   FAMILLES_PUBLIQUES plus bas. Le jour ou quelqu'un ajoutera une famille
   personnelle au fichier de donnees, elle sera ecartee d'office.

   ----------------------------------------------------------------------------
   TROIS PIEGES, ET LES TROIS SE PAIENT EN SILENCE
   ----------------------------------------------------------------------------
   1. IL FAUT DEPLOYER AVEC `--no-verify-jwt`. Par defaut une fonction Edge
      exige un en-tete Authorization. Google Agenda n'en envoie aucun : il
      recevrait 401 et afficherait « calendrier introuvable » sans plus de
      detail. C'est LE defaut qui fait perdre une soiree.
        supabase functions deploy agenda-ics --no-verify-jwt
   2. LE REPLIAGE DES LIGNES SE COMPTE EN OCTETS, PAS EN SIGNES. RFC 5545 : 75
      octets maximum. « Declaration recapitulative mensuelle » avec ses accents
      pese plus que sa longueur. Compter des signes produit des lignes trop
      longues qu'Outlook tronque au milieu d'un mot, et le rendez-vous s'affiche
      ampute sans qu'aucune erreur ne soit levee.
   3. `DTSTAMP` NE DOIT PAS ETRE L'HEURE COURANTE. Avec `new Date()`, chaque
      relecture rend un fichier different : certains clients concluent que TOUT
      a change et re-notifient l'utilisateur a chaque synchronisation. Il est
      donc derive de la date de l'occurrence, et le flux est identique d'une
      lecture a l'autre tant que rien n'a bouge.

   ----------------------------------------------------------------------------
   POURQUOI TOUTES LES ERREURS RENDENT 404
   ----------------------------------------------------------------------------
   Jeton absent, jeton inconnu, jeton revoque : la meme reponse. Un 401 sur un
   jeton inconnu et un 404 sur une adresse inconnue diraient a qui sonde le
   site « cette adresse existe, continue a chercher ». Ici rien ne distingue
   les deux cas.

   PAS DE VALARM, ET C'EST VOULU. Un rappel sur une periode de cent cinq jours
   reveille le vigneron a minuit le premier jour de la taille. Les occurrences
   sont posees en journee entiere et en TRANSPARENT : elles remplissent
   l'agenda sans le bloquer, et c'est son client de messagerie qui decide s'il
   veut etre prevenu.
   ============================================================================ */
import './bdv-echeances.js';
import './bdv-ics.js';
import BIBLIOTHEQUE from './biblio.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/* Vingt-quatre mois, comme le plan du 08/09. On part du 1er du mois en cours et
   pas d'aujourd'hui : un vigneron qui s'abonne le 20 doit voir ce qui est tombe
   le 10, sinon sa DRM du mois semble avoir disparu. */
const MOIS_DEVANT = 24;

const BdvEcheances = (globalThis as any).BdvEcheances;

/* LA MISE EN FORME iCalendar VIT DANS `src/js/bdv-ics.js`, jointe comme le
   moteur. Elle n'est pas ici pour une raison simple : enfermee dans ce fichier
   TypeScript, elle ne serait testable que deployee, c'est-a-dire jamais.
   `scripts/banc-agenda.mjs` la fait tourner sur la vraie bibliotheque a chaque
   `npm run verif`, et verifie le repliage a l'octet, l'echappement, et qu'aucune
   famille privee ne passe. Un format de fichier se verifie ou il ment. */
const BdvIcs = (globalThis as any).BdvIcs;

/* ---------------------------------------------------------------------------
   LA BASE
--------------------------------------------------------------------------- */
function enTetes(): Record<string, string> {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' };
}

async function compteDuJeton(jeton: string): Promise<string | null> {
  const url = `${SUPABASE_URL}/rest/v1/agenda_abonnement?jeton=eq.${encodeURIComponent(jeton)}&select=id`;
  const r = await fetch(url, { headers: enTetes() });
  if (!r.ok) return null;
  const lignes = await r.json();
  return Array.isArray(lignes) && lignes.length ? String(lignes[0].id) : null;
}

async function choixDuCompte(id: string): Promise<Record<string, any>> {
  const url = `${SUPABASE_URL}/rest/v1/calendrier_choix?id=eq.${encodeURIComponent(id)}&select=cle,actif,decale_de`;
  const r = await fetch(url, { headers: enTetes() });
  if (!r.ok) return {};
  const lignes = await r.json();
  const map: Record<string, any> = {};
  if (Array.isArray(lignes)) for (const l of lignes) map[l.cle] = l;
  return map;
}

/* Sans attente et sans consequence : si la trace de lecture echoue, le vigneron
   doit quand meme recevoir son calendrier. Une statistique ne vaut pas une panne. */
function marquerLu(id: string): void {
  fetch(`${SUPABASE_URL}/rest/v1/agenda_abonnement?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...enTetes(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ vu_le: new Date().toISOString() }),
  }).catch(() => {});
}

/* ---------------------------------------------------------------------------
   L'ENTREE
--------------------------------------------------------------------------- */
const INTROUVABLE = () => new Response('Calendrier introuvable.\n', {
  status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Methode non autorisee.\n', { status: 405 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    /* Une fonction mal configuree ne doit pas rendre un calendrier vide : le
       vigneron croirait n'avoir aucune echeance. */
    return new Response('Service indisponible.\n', { status: 503 });
  }
  if (!BdvEcheances || typeof BdvEcheances.etaler !== 'function' ||
      !BdvIcs || typeof BdvIcs.calendrier !== 'function') {
    return new Response('Service indisponible.\n', { status: 503 });
  }

  const url = new URL(req.url);
  /* Le jeton arrive en parametre : la reecriture Vercel transforme
     /agenda/<jeton>.ics en ?jeton=<jeton>. On accepte aussi le dernier segment
     du chemin, pour que l'adresse Supabase directe reste utilisable en test. */
  const jeton = (url.searchParams.get('jeton') || url.pathname.split('/').pop() || '')
    .replace(/\.ics$/, '').trim();
  if (jeton.length < 32 || jeton.length > 64) return INTROUVABLE();

  const compte = await compteDuJeton(jeton);
  if (!compte) return INTROUVABLE();

  const choix = await choixDuCompte(compte);
  const choixDe = (cle: string) => {
    const l = choix[cle];
    return { actif: !l || l.actif !== false, decale: (l && parseInt(l.decale_de, 10)) || 0 };
  };

  /* LE FILTRE DE CONFIDENTIALITE PASSE AVANT LES CHOIX, et pas apres : une
     famille privee ne doit meme pas entrer dans le calcul. Il repasse une
     seconde fois dans `BdvIcs.calendrier`, et cette redondance est voulue. */
  const regles = BdvEcheances.appliquerChoix(BdvIcs.publiques(BIBLIOTHEQUE), choixDe);

  const ajd = new Date();
  const du = new Date(ajd.getFullYear(), ajd.getMonth(), 1);
  const au = new Date(ajd.getFullYear(), ajd.getMonth() + MOIS_DEVANT, 0);
  const occurrences = BdvEcheances.etaler(regles, du, au);

  marquerLu(compte);

  return new Response(req.method === 'HEAD' ? null : BdvIcs.calendrier(occurrences), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="bureau-du-vigneron.ics"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
