/* ============================================================================
   supabase/functions/courrier-matin/index.ts
   ============================================================================
   ENVOIE le courrier du matin. Elle ne le FABRIQUE pas : c'est
   src/js/bdv-courrier.js qui le fait, et ce fichier-la est le seul endroit ou
   le contenu du mail est ecrit. Ici on lit la base, on appelle la fabrique, on
   confie le resultat a Resend, et on rend un compte rendu.

   POURQUOI `import './bdv-courrier.js'` ET PAS UNE COPIE.
   `bdv-courrier.js` vit dans `src/js/`, la ou le navigateur et l'apercu le
   lisent. Il n'en existe AUCUNE copie dans ce dossier : il est joint au moment
   du deploiement, pas versionne deux fois. Deux copies auraient diverge au
   premier ajustement de texte, et le mail envoye ne ressemblerait plus a celui
   que montre `npm run courrier`.

   POUR QUE LA DERIVE SE VOIE. Le fichier joint doit etre exactement
   `src/js/bdv-courrier.js`. Empreinte de la version deployee le 09/09/2026 :
   sha256 caa1c170fb9294a3..., 512 lignes. Controle avant tout redeploiement :
       shasum -a 256 src/js/bdv-courrier.js | cut -c1-16
   Si l'empreinte a change, c'est normal : le contenu du mail a bouge. Mettre
   la nouvelle ici. Si elle n'a PAS change alors qu'on vient de modifier le
   mail, c'est qu'on a deploye l'ancien fichier.

   [Supposition] Une simplification possible, non retenue faute de pouvoir la
   verifier : `import 'https://lebureauduvigneron.fr/js/bdv-courrier.js'`.
   Deno gele la dependance au deploiement, donc pas de derive silencieuse, et
   il n'y aurait plus rien a joindre. Ni le conteneur ni WebFetch n'ont pu
   confirmer que cette URL est bien servie par Vercel. A tenter le jour ou
   quelqu'un peut l'ouvrir dans un navigateur, pas avant : une dependance non
   verifiee dans le chemin d'envoi est exactement ce qu'il ne faut pas y
   mettre.

   TROIS GARDE-FOUS, dans cet ordre :
   1. Un secret DEDIE, `COURRIER_CLE`, dans l'en-tete `x-courrier-cle`.
   2. `?apercu=1` fabrique le mail et le REND, sans rien envoyer.
   3. La liste des destinataires autorises est ECRITE EN DUR plus bas. Tant
      qu'elle n'est pas vide, aucune autre adresse ne recoit quoi que ce soit,
      meme si elle figure dans la base.

   POURQUOI UN SECRET DEDIE ET PAS LA CLE DE SERVICE, correction du 09/09/2026.
   La premiere version comparait l'en-tete Authorization a
   `SUPABASE_SERVICE_ROLE_KEY`. Deux defauts, le second plus grave que le
   premier :
   - Supabase expose maintenant DEUX generations de cles, les anciennes
     (`eyJ...`, anon et service_role) et les nouvelles (`sb_secret_...`). Selon
     l'age du projet, la variable injectee dans la fonction ne porte pas
     forcement celle que le tableau de bord affiche. La comparaison echouait
     sans qu'on puisse savoir laquelle des deux avait ete copiee, d'autant que
     les apercus tronques d'`anon` et de `service_role` sont identiques a
     l'oeil.
   - Surtout : ca obligeait a promener la CLE MAITRESSE du projet dans des
     lignes de commande, pour un simple essai. Un secret dedie ne donne accces
     qu'a cette fonction, il se revoque seul, et c'est lui que le declencheur
     de 8 h utilisera au lot 4.

   [Supposition] La comparaison ci-dessous n'est pas a temps constant. Sur un
   secret de 48 caracteres hexadecimaux derriere un `verify_jwt` de plateforme,
   l'attaque temporelle est theorique. A revoir si ce verrou devient le seul.
   ============================================================================ */

import './bdv-courrier.js';

/* ---- CE QUI TIENT L'ENVOI FERME, ET POURQUOI C'EST DANS LE CODE ----
   L'expediteur est `courrier.`, le sous-domaine qui porte AUSSI les codes de
   reprise de mot de passe. Si le courrier du matin fait classer ce
   sous-domaine en courrier commercial par Gmail ou Outlook, ce sont les codes
   qui n'arrivent plus, et le vigneron reste enferme dehors sans message
   d'erreur. La reputation d'un domaine ne se repare pas par un reglage : elle
   se construit et se repare en semaines.

   Donc l'ouverture aux vignerons ne peut PAS se faire par une case a cocher
   ni par une ligne en base. Elle demande de toucher a ce fichier, ce qui est
   exactement la ou cette decision doit se reprendre. Et le jour ou on y
   touche, il faut d'abord : sortir de `courrier.`, passer Resend au palier
   payant, et ecrire les textes legaux (le pied de page promet que les ventes
   restent dans le navigateur, `src/rgpd.njk` ne nomme aucun sous-traitant, et
   ce mail porte des noms de clients et des montants). */
const DESTINATAIRES_AUTORISES = [
  'teddy@solumatic.fr',
];
const EXPEDITEUR = 'Le Bureau du Vigneron <bureau@courrier.lebureauduvigneron.fr>';

/* Le plafond gratuit de Resend est de 100 mails par jour, et c'est le MEME
   quota que les codes d'inscription. On refuse d'en envoyer plus que ca en un
   passage : mieux vaut un envoi tronque qu'un vigneron qui ne peut pas
   reprendre son mot de passe a 8 h 05. */
const MAX_PAR_PASSAGE = 40;

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_KEY    = Deno.env.get('RESEND_API_KEY') ?? '';
/* Le verrou de declenchement. La cle de service, elle, sert UNIQUEMENT a lire
   la vue : elle ne quitte jamais Supabase et personne n'a a la manipuler. */
const CLE_DECLENCHEUR = Deno.env.get('COURRIER_CLE') ?? '';

// deno-lint-ignore no-explicit-any
const BdvCourrier = (globalThis as any).BdvCourrier;

/* Le jour a Paris, en AAAA-MM-JJ. Surtout pas `new Date().toISOString()` :
   entre minuit et 2 h en France, l'UTC rend la veille, et le mail annoncerait
   « depuis 1 jour » sur un rappel pose le matin meme. Meme piege que celui
   deja documente pour les rappels dans bdv-crm.js. */
function jourAParis(): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());   // fr-CA rend justement AAAA-MM-JJ
}

function reponse(corps: unknown, code = 200): Response {
  return new Response(JSON.stringify(corps, null, 2), {
    status: code,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/* ---- LA LECTURE : UNE SEULE REQUETE POUR TOUT L'ENVOI ----
   La vue `v_courrier` rend une ligne par compte, signaux deja filtres des
   clients suivis et taches faites deja ecartees. Sans elle, ce serait trois
   lectures par compte, soit 1 500 allers-retours a 8 h du matin pour 500
   vignerons. Elle est definie dans supabase/lot9-courrier-vues.sql. */
async function lireLesComptes() {
  const url = `${SUPABASE_URL}/rest/v1/v_courrier`
            + `?select=id,email,depose_le,noms,signaux,suivis,taches,resume_ventes`;
  const r = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!r.ok) throw new Error(`lecture de v_courrier : ${r.status} ${await r.text()}`);
  return await r.json() as Array<Record<string, unknown>>;
}

async function envoyerParResend(a: string, sujet: string, html: string, texte: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EXPEDITEUR, to: [a], subject: sujet, html, text: texte }),
  });
  const corps = await r.text();
  if (!r.ok) throw new Error(`Resend : ${r.status} ${corps}`);
  return JSON.parse(corps) as { id?: string };
}

Deno.serve(async (req: Request) => {
  /* ---- GARDE-FOU 1 : la cle maitresse, et rien d'autre ----
     Cette fonction lit les donnees de TOUS les comptes. Elle ne doit pas etre
     declenchable par un vigneron connecte, ni par quiconque connait son URL. */
  const porte = req.headers.get('Authorization') ?? '';
  if (!SERVICE_KEY || porte !== `Bearer ${SERVICE_KEY}`) {
    return reponse({ erreur: 'Il faut la cle de service pour declencher le courrier.' }, 401);
  }
  if (!BdvCourrier || typeof BdvCourrier.batir !== 'function') {
    return reponse({ erreur: 'bdv-courrier.js n\'a pas ete joint au deploiement.' }, 500);
  }

  const params  = new URL(req.url).searchParams;
  const apercu  = params.get('apercu') === '1';
  const aujourdhui = params.get('jour') || jourAParis();

  if (!apercu && !RESEND_KEY) {
    return reponse({ erreur: 'Le secret RESEND_API_KEY est absent.' }, 500);
  }

  let comptes;
  try { comptes = await lireLesComptes(); }
  catch (e) { return reponse({ erreur: String(e) }, 502); }

  const rapport = {
    jour: aujourdhui,
    apercu,
    expediteur: EXPEDITEUR,
    comptes_lus: comptes.length,
    envoyes: 0,
    vides: 0,
    sans_adresse: 0,
    hors_liste: 0,
    plafonnes: 0,
    echecs: [] as Array<{ compte: string; pourquoi: string }>,
    detail: [] as Array<Record<string, unknown>>,
  };

  for (const c of comptes) {
    const id = String(c.id ?? '');
    const adresse = String(c.email ?? '').trim().toLowerCase();

    const mail = BdvCourrier.batir({
      aujourdhui,
      depose_le: c.depose_le,
      file_travail: { signaux: c.signaux, noms: c.noms },
      resume_ventes: c.resume_ventes,
      suivis: c.suivis,
      taches: c.taches,
    });

    /* Un mail vide ne part pas. C'est la fabrique qui le DIT (`vide`), et c'est
       ici qu'on tranche : un mail « rien a faire ce matin » envoye tous les
       jours apprend a ne plus l'ouvrir. */
    if (mail.vide) {
      rapport.vides++;
      rapport.detail.push({ compte: id, issue: 'vide', sujet: mail.sujet });
      continue;
    }
    if (!adresse) {
      rapport.sans_adresse++;
      rapport.detail.push({ compte: id, issue: 'sans adresse' });
      continue;
    }

    const autorise = !DESTINATAIRES_AUTORISES.length ||
                     DESTINATAIRES_AUTORISES.includes(adresse);

    /* ---- GARDE-FOU 2 : l'apercu n'envoie rien ----
       Il passe AVANT le filtre des destinataires, et c'est voulu : on veut
       pouvoir relire le mail de tous les comptes, y compris ceux a qui rien ne
       partira. Il rend le TEXTE et pas le HTML : le HTML pese 15 ko par
       compte, il noierait le compte rendu, et le dessin se juge deja sur
       `npm run courrier`. */
    if (apercu) {
      rapport.detail.push({
        compte: id, issue: 'apercu', autorise,
        sujet: mail.sujet, compteurs: mail.compteurs,
        html_octets: (mail.html || '').length,
        texte: mail.texte,
      });
      continue;
    }

    /* ---- GARDE-FOU 3 : la liste en dur ---- */
    if (!autorise) {
      rapport.hors_liste++;
      rapport.detail.push({ compte: id, issue: 'hors liste autorisee' });
      continue;
    }
    if (rapport.envoyes >= MAX_PAR_PASSAGE) {
      rapport.plafonnes++;
      continue;
    }

    try {
      const env = await envoyerParResend(adresse, mail.sujet, mail.html, mail.texte);
      rapport.envoyes++;
      rapport.detail.push({ compte: id, issue: 'envoye', sujet: mail.sujet,
                            compteurs: mail.compteurs, resend_id: env.id });
    } catch (e) {
      rapport.echecs.push({ compte: id, pourquoi: String(e) });
    }
  }

  /* Un echec d'envoi doit se VOIR. Le lot 4 posera un declencheur horaire :
     s'il rend 200 quoi qu'il arrive, un envoi casse passera des semaines
     inapercu. C'est la meme regle que pour les gestes du bureau. */
  return reponse(rapport, rapport.echecs.length ? 500 : 200);
});
