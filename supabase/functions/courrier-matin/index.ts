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

   POUR QUE LA DERIVE SE VOIE, ET SANS COMPTER SUR PERSONNE.
   La ligne ci-dessous est ECRITE PAR UN SCRIPT, `npm run courrier:joindre`, et
   controlee par `npm run verif`. Ne pas la modifier a la main, ne pas la
   reformater : elle est lue par une expression exacte.

   empreinte de la fabrique deployee : sha256 d4c7a2486e7bb1bf, 945 lignes.

   POURQUOI ELLE N'EST PLUS TENUE A LA MAIN, 10/09/2026. Elle l'etait, et elle
   annoncait 512 lignes quand la fabrique en faisait 880. Pire : le depot
   portait encore l'ANCIEN verrou d'entree (comparaison de l'en-tete
   Authorization a la cle de service) alors que la production tournait deja
   avec le secret dedie. Le depot avait cesse d'etre la source de verite de ce
   qui tournait, et rien ne le disait. Un commentaire faux fait conclure a
   tort : il est pire que pas de commentaire. Donc c'est un banc, plus une
   convention.

   LA SIMPLIFICATION PAR URL EST VERIFIEE, ET REFUSEE QUAND MEME, 09/09/2026.
   L'idee etait `import 'https://lebureauduvigneron.fr/js/bdv-courrier.js'` :
   Deno gele la dependance au deploiement, donc pas de derive silencieuse, et
   il n'y aurait plus rien a joindre.
   [Certain] Le fichier EST bien servi : `/js/bdv-courrier.js` rend 200 sur
   l'adresse Vercel du projet, avec la version a jour et
   `cache-control: must-revalidate`. Techniquement, ca marche.
   REFUSE POUR UNE RAISON DECOUVERTE EN LE VERIFIANT. Ce jour-la,
   `lebureauduvigneron.fr` etait injoignable : le domaine n'avait jamais ete
   branche sur Vercel, il pointait encore chez le registraire. Si la fonction
   avait lu son contenu depuis le site, LE COURRIER DE 8 H NE SERAIT PAS PARTI,
   et le rapport aurait annonce une erreur d'import, pas un domaine. Le site et
   l'envoi du mail sont deux pannes qui doivent rester independantes : on ne
   met pas le premier dans le chemin du second.
   La vraie douleur, le redeploiement manuel penible, se regle par un script
   qui recolle et deploie, pas en deplacant la dependance sur le reseau.

   QUATRE GARDE-FOUS, dans cet ordre :
   1. Un secret DEDIE, `COURRIER_CLE`, dans l'en-tete `x-courrier-cle`.
   2. `?apercu=1` fabrique le mail et le REND, sans rien envoyer.
   3. La liste des destinataires autorises est ECRITE EN DUR plus bas. Tant
      qu'elle n'est pas vide, aucune autre adresse ne recoit quoi que ce soit,
      meme si elle figure dans la base.
   4. UN SEUL MAIL PAR COMPTE ET PAR JOUR, tenu par la cle primaire de
      `public.courrier_envois`. Voir supabase/lot10-courrier-envois.sql.

   LOT 4, LE 10/09/2026 : L'HEURE ET LE DOUBLON.
   Deux choses ont ete ajoutees, et ce sont les deux seules qui manquaient pour
   qu'une horloge puisse appeler cette fonction sans surveillance.

   L'HEURE SE DECIDE ICI, PAS DANS LE CRON. Le declencheur tourne TOUTES LES
   HEURES et cette fonction refuse de travailler si l'heure de Paris n'est pas
   `HEURE_ENVOI`. Un cron ecrit en UTC donnerait 8 h l'ete et 7 h l'hiver, et
   personne ne se souviendrait de le corriger au changement d'heure -- c'est
   exactement le piege deja documente pour `jourAParis()`.
   `?maintenant=1` deroge a cette regle, et c'est le seul moyen d'essayer un
   envoi a une heure quelconque.

   LE DOUBLON EST INTERDIT PAR LA BASE, PAS PAR CE FICHIER. La fonction ne
   verifie pas « ai-je deja envoye ? » avant d'ecrire : entre le verifier et le
   ecrire, un second appel passerait. Elle POSE une ligne (compte, jour) et
   regarde si Postgres l'a acceptee. Un refus veut dire « c'est deja fait », et
   il n'y a aucun intervalle ou deux appels peuvent gagner tous les deux.

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
/* LA LISTE EST OUVERTE, 10/09/2026, demande de Ted : le courrier part a TOUT
   compte inscrit, present et futur. Vide = aucun filtre par adresse.

   CE QUI REMPLACE LE FILTRE, ET POURQUOI C'EST MIEUX QU'UNE LISTE.
   Une liste en dur protegeait par accident : elle bloquait le premier vigneron
   parce qu'elle bloquait tout le monde. Elle ne disait pas POURQUOI, donc le
   jour ou on l'ouvre -- aujourd'hui -- la vraie raison de ne pas ecrire a un
   inconnu disparait avec elle, sans que personne ne la relise.
   Le garde-fou est donc deplace sur le FAIT qui manque vraiment : un courrier
   quotidien qui porte des noms de clients et des montants doit offrir un moyen
   d'arreter (RGPD, article 7-3). Tant que `URL_DESINSCRIPTION` est absente, la
   fonction REFUSE d'ecrire a une adresse qui n'a pas deja consenti en direct.
   Le jour ou cette adresse existe, on renseigne UN SECRET et la porte s'ouvre
   d'elle-meme, sans redeploiement et sans qu'on ait a se souvenir de rien. */
const DESTINATAIRES_AUTORISES: string[] = [];

/* Les adresses de Ted. Elles n'ont pas besoin d'un lien de desinscription : il
   a mis le systeme en place, il sait comment l'arreter, et il est le seul a
   pouvoir toucher au declencheur. Ce n'est PAS une liste d'autorisation, c'est
   la liste de ceux pour qui la question du consentement ne se pose pas. */
const CONSENTEMENT_ACQUIS = [
  'teddy@solumatic.fr',
  'teddypereira88@gmail.com',
];
const EXPEDITEUR = 'Le Bureau du Vigneron <bureau@courrier.lebureauduvigneron.fr>';

/* Le plafond gratuit de Resend est de 100 mails par jour, et c'est le MEME
   quota que les codes d'inscription. On refuse d'en envoyer plus que ca en un
   passage : mieux vaut un envoi tronque qu'un vigneron qui ne peut pas
   reprendre son mot de passe a 8 h 05. */
const MAX_PAR_PASSAGE = 40;

/* L'heure d'envoi, en heure de PARIS. Changer ce chiffre suffit a deplacer le
   courrier : le declencheur, lui, passe toutes les heures et n'a pas a le
   savoir. C'est pour ca qu'il n'a pas besoin d'etre un secret. */
const HEURE_ENVOI = 8;

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_KEY    = Deno.env.get('RESEND_API_KEY') ?? '';
/* Le verrou de declenchement. La cle de service, elle, sert UNIQUEMENT a lire
   la vue : elle ne quitte jamais Supabase et personne n'a a la manipuler. */
const CLE_DECLENCHEUR = Deno.env.get('COURRIER_CLE') ?? '';

/* ---- L'ADRESSE DU BUREAU, ET POURQUOI ELLE EST UN SECRET ET PAS UNE CONSTANTE
   Le bouton « Ouvrir mon bureau » est la SEULE action du mail. Une adresse
   morte dans ce bouton ne casse rien de visible cote serveur : l'envoi
   reussit, le rapport dit « envoye », et c'est le vigneron qui tombe sur une
   erreur de navigateur. C'est le pire genre de panne, celle qui ne remonte pas.

   Constate le 09/09/2026 : `lebureauduvigneron.fr` n'a jamais ete branche sur
   Vercel, et la fabrique retombait sur cette adresse par defaut. Le premier
   vrai mail portait donc un bouton mort.

   D'ou un secret et pas une constante : le jour ou le domaine est branche, on
   change UNE variable dans Supabase, sans toucher au code ni redeployer la
   fonction. Le repli reste l'adresse definitive, pour que ce soit le reglage
   temporaire qui soit visible dans les secrets, et pas l'inverse.
   A REGLER MAINTENANT sur l'adresse Vercel du projet, jusqu'au branchement. */
const URL_BUREAU = Deno.env.get('URL_BUREAU')
  ?? 'https://lebureauduvigneron.fr/mon-bureau/';

/* L'adresse ou un vigneron peut arreter de recevoir le courrier. Un secret et
   pas une constante, pour la meme raison qu'URL_BUREAU : le jour ou elle
   existe, on la renseigne et le courrier s'ouvre, sans toucher au code.
   TANT QU'ELLE EST VIDE, seules les adresses de CONSENTEMENT_ACQUIS recoivent.
   La fabrique sait deja dessiner le lien, elle attend qu'on lui en donne un --
   verifie le 10/09/2026 : `urlDesinscription` existe dans bdv-courrier.js et
   n'etait passee par personne. */
const URL_DESINSCRIPTION = Deno.env.get('URL_DESINSCRIPTION') ?? '';

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

/* L'heure a Paris, de 0 a 23. `hourCycle: 'h23'` et pas `hour12: false` : selon
   la version d'ICU, ce dernier rend « 24 » a minuit, et `24 !== 0` ferait rater
   un envoi de minuit si l'heure changeait un jour.

   DEFAUT CORRIGE LE 10/09/2026, ET IL AURAIT ETE MUET.
   La premiere version formatait en `fr-FR`, qui rend « 14 h » et pas « 14 ».
   `Number('14 h')` vaut NaN, et NaN n'est egal a RIEN : la comparaison
   `heure !== HEURE_ENVOI` etait donc TOUJOURS vraie. Le declencheur aurait
   repondu « hors heure » vingt-quatre fois par jour, en 200, sans jamais
   envoyer un seul courrier -- exactement la panne silencieuse que le lot 4
   existe pour empecher.
   Trouve parce que `heure_paris` est DANS le rapport et valait `null`. Un
   chiffre de travail expose dans le compte rendu ne coute rien et attrape ce
   qu'aucun controle hors ligne ne pouvait voir : ni Node ni le banc ne
   formatent avec l'ICU de Deno.
   D'ou les deux precautions : une locale qui ne colle pas d'unite, ET le
   retrait de tout ce qui n'est pas un chiffre. L'une des deux suffirait, les
   deux ensemble ne dependent d'aucune version d'ICU. */
function heureAParis(): number {
  const brut = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23',
  }).format(new Date());
  return Number(String(brut).replace(/[^0-9]/g, ''));
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

/* ---- LE JOURNAL DES ENVOIS : public.courrier_envois ----
   Trois acces, et un seul est subtil. Voir supabase/lot10-courrier-envois.sql
   pour la table, ses droits et le controle qui prouve l'anti-doublon. */
const JOURNAL = `${SUPABASE_URL}/rest/v1/courrier_envois`;

function enTetesJournal(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

/* POSER LA RESERVATION AVANT D'ENVOYER, ET PAS LA TRACE APRES.
   Rend `true` si ce compte n'avait pas encore sa ligne du jour, donc si l'envoi
   nous appartient. Rend `false` si la ligne existait deja : quelqu'un, ou un
   passage precedent, a deja fait le travail.
   `resolution=ignore-duplicates` traduit en `on conflict do nothing`, et
   `return=representation` fait rendre la ligne ecrite -- donc RIEN quand rien
   n'a ete ecrit. C'est ce tableau vide qui porte toute l'information. */
async function reserver(compte: string, jour: string, sujet: string): Promise<boolean> {
  const r = await fetch(JOURNAL, {
    method: 'POST',
    headers: { ...enTetesJournal(),
               Prefer: 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify({ compte, jour, sujet }),
  });
  if (!r.ok) throw new Error(`journal, reservation : ${r.status} ${await r.text()}`);
  const lignes = await r.json() as unknown[];
  return Array.isArray(lignes) && lignes.length > 0;
}

async function marquer(compte: string, jour: string, champs: Record<string, unknown>) {
  const r = await fetch(`${JOURNAL}?compte=eq.${compte}&jour=eq.${jour}`, {
    method: 'PATCH',
    headers: enTetesJournal(),
    body: JSON.stringify(champs),
  });
  if (!r.ok) throw new Error(`journal, marquage : ${r.status} ${await r.text()}`);
}

/* `?rejouer=1` : efface les reservations du jour QUI PORTENT UN ECHEC, et
   elles seules. Une reservation reussie ne s'efface jamais, sinon le garde-fou
   ne vaut plus rien. Geste manuel : le declencheur ne l'utilise pas, et c'est
   pour ca qu'il ne peut pas doubler un mail apres une panne. */
async function rejouerLesEchecs(jour: string): Promise<number> {
  const r = await fetch(`${JOURNAL}?jour=eq.${jour}&echec=not.is.null`, {
    method: 'DELETE',
    headers: { ...enTetesJournal(), Prefer: 'return=representation' },
  });
  if (!r.ok) throw new Error(`journal, rejeu : ${r.status} ${await r.text()}`);
  const lignes = await r.json() as unknown[];
  return Array.isArray(lignes) ? lignes.length : 0;
}

Deno.serve(async (req: Request) => {
  /* ---- GARDE-FOU 1 : la cle maitresse, et rien d'autre ----
     Cette fonction lit les donnees de TOUS les comptes. Elle ne doit pas etre
     declenchable par un vigneron connecte, ni par quiconque connait son URL. */
  if (!CLE_DECLENCHEUR) {
    return reponse({ erreur: 'Le secret COURRIER_CLE est absent des reglages de la fonction.' }, 500);
  }
  if ((req.headers.get('x-courrier-cle') ?? '') !== CLE_DECLENCHEUR) {
    return reponse({ erreur: 'En-tete x-courrier-cle absente ou fausse.' }, 401);
  }
  if (!SERVICE_KEY) {
    return reponse({ erreur: 'SUPABASE_SERVICE_ROLE_KEY absente : impossible de lire la vue.' }, 500);
  }
  if (!BdvCourrier || typeof BdvCourrier.batir !== 'function') {
    return reponse({ erreur: 'bdv-courrier.js n\'a pas ete joint au deploiement.' }, 500);
  }

  const params     = new URL(req.url).searchParams;
  const apercu     = params.get('apercu') === '1';
  const maintenant = params.get('maintenant') === '1';
  const rejouer    = params.get('rejouer') === '1';
  const aujourdhui = params.get('jour') || jourAParis();
  const heure      = heureAParis();

  /* ---- L'HEURE, ET POURQUOI CE N'EST PAS UNE ERREUR ----
     Le declencheur passe 24 fois par jour et 23 de ces passages doivent ne
     rien faire. Ils rendent donc 200 : un 4xx ferait 23 lignes rouges par jour
     dans le journal de la fonction, et une vraie panne s'y noierait. */
  if (!apercu && !maintenant && heure !== HEURE_ENVOI) {
    return reponse({
      jour: aujourdhui, heure_paris: heure, heure_envoi: HEURE_ENVOI,
      issue: 'hors heure', rien_fait: true,
    });
  }

  if (!apercu && !RESEND_KEY) {
    return reponse({ erreur: 'Le secret RESEND_API_KEY est absent.' }, 500);
  }

  let rejoues = 0;
  if (rejouer && !apercu) {
    try { rejoues = await rejouerLesEchecs(aujourdhui); }
    catch (e) { return reponse({ erreur: String(e) }, 502); }
  }

  let comptes;
  try { comptes = await lireLesComptes(); }
  catch (e) { return reponse({ erreur: String(e) }, 502); }

  const rapport = {
    jour: aujourdhui,
    apercu,
    expediteur: EXPEDITEUR,
    /* L'adresse du bouton est DANS le rapport, et c'est le garde-fou qui
       manquait : un bouton mort ne fait echouer aucun envoi, donc rien ne le
       signale. La voir a chaque appel, `?apercu=1` compris, est le seul moyen
       de s'apercevoir qu'elle est fausse avant le vigneron. */
    url_bureau: URL_BUREAU,
    /* Regle 4 de CLAUDE.md : la valeur dont depend une decision va dans le
       rapport. Celle-ci decide qui recoit. */
    url_desinscription: URL_DESINSCRIPTION || null,
    heure_paris: heure,
    comptes_lus: comptes.length,
    envoyes: 0,
    deja_envoyes: 0,
    sans_desinscription: 0,
    rejoues,
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
      urlBureau: URL_BUREAU,
      urlDesinscription: URL_DESINSCRIPTION || null,
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

    /* ---- GARDE-FOU 3 : la liste en dur, vide depuis le 10/09/2026 ---- */
    if (!autorise) {
      rapport.hors_liste++;
      rapport.detail.push({ compte: id, issue: 'hors liste autorisee' });
      continue;
    }

    /* ---- GARDE-FOU 3bis : PAS DE MOYEN D'ARRETER, PAS D'ENVOI ----
       Ce courrier est quotidien et il porte des noms de clients et des
       montants. Sans lien de desinscription, l'envoyer a quelqu'un qui n'a pas
       consenti en direct est un manquement, pas une finition (RGPD 7-3).
       Ce refus est mecanique et il se leve tout seul : le jour ou le secret
       `URL_DESINSCRIPTION` porte une adresse, cette branche ne se declenche
       plus. C'est ce qui remplace la liste en dur, et c'est plus honnete
       qu'elle : elle bloquait tout le monde sans dire pourquoi. */
    if (!URL_DESINSCRIPTION && !CONSENTEMENT_ACQUIS.includes(adresse)) {
      rapport.sans_desinscription++;
      rapport.detail.push({ compte: id,
        issue: 'refuse : aucun lien de desinscription, et consentement non acquis en direct' });
      continue;
    }
    if (rapport.envoyes >= MAX_PAR_PASSAGE) {
      rapport.plafonnes++;
      continue;
    }

    /* ---- GARDE-FOU 4 : un seul mail par compte et par jour ----
       Le plafond passe AVANT, volontairement : on ne reserve pas une journee
       pour un mail qu'on ne va pas envoyer, sinon un passage plafonne
       interdirait l'envoi de tout le reste de la journee. */
    let reserve: boolean;
    try {
      reserve = await reserver(id, aujourdhui, mail.sujet);
    } catch (e) {
      rapport.echecs.push({ compte: id, pourquoi: String(e) });
      continue;
    }
    if (!reserve) {
      rapport.deja_envoyes++;
      rapport.detail.push({ compte: id, issue: 'deja envoye aujourd hui' });
      continue;
    }

    try {
      const env = await envoyerParResend(adresse, mail.sujet, mail.html, mail.texte);
      rapport.envoyes++;
      rapport.detail.push({ compte: id, issue: 'envoye', sujet: mail.sujet,
                            compteurs: mail.compteurs, resend_id: env.id });
      /* Le mail est parti. Si le marquage echoue, on ne rate rien de grave :
         la reservation, elle, est deja en base, donc le doublon reste
         impossible. On ne fait donc PAS echouer l'envoi pour ca. */
      try { await marquer(id, aujourdhui, { resend_id: env.id ?? null }); }
      catch { /* volontairement ignore, voir juste au-dessus */ }
    } catch (e) {
      rapport.echecs.push({ compte: id, pourquoi: String(e) });
      /* LA RESERVATION RESTE POSEE, et c'est un arbitrage.
         Un refus de Resend ne dit pas si le mail est parti : une reponse
         perdue ressemble a un refus. Effacer la ligne pour retenter
         reintroduirait le doublon qu'on vient d'interdire. Donc pas de reprise
         automatique -- la trace garde son motif, et la reprise se demande a la
         main avec `?rejouer=1`. */
      try { await marquer(id, aujourdhui, { echec: String(e).slice(0, 500) }); }
      catch { /* rien de mieux a faire, l'echec est deja dans le rapport */ }
    }
  }

  /* Un echec d'envoi doit se VOIR. Le lot 4 posera un declencheur horaire :
     s'il rend 200 quoi qu'il arrive, un envoi casse passera des semaines
     inapercu. C'est la meme regle que pour les gestes du bureau. */
  return reponse(rapport, rapport.echecs.length ? 500 : 200);
});
