# Brancher Supabase et Resend

État au 01/09/2026 : le code est écrit et livré (commits `fb3e808` et `4391e39`). Le projet
Supabase `qukmncqqwomhmrdhvetj` existe, en **West EU (Ireland), `eu-west-1`**, encore vide. Resend
n'est pas créé. Ce fichier est la marche à suivre, dans l'ordre. Chaque étape a son test : si le
test ne passe pas, ne pas passer à la suivante.

## 0. Ce que le code attend

`src/js/bdv-compte.js` appelle GoTrue et PostgREST directement, sans `supabase-js`. Il attend
exactement deux valeurs, lignes 15 et 16 :

    const SUPABASE_URL = '';
    const SUPABASE_ANON_KEY = '';

Points de contact réseau, il n'y en a pas d'autres :

| Appel | Endpoint | Ce qu'il suppose |
| --- | --- | --- |
| `demanderCode()` | `POST /auth/v1/otp` avec `create_user: true` | inscriptions ouvertes, e-mail activé |
| `verifierCode()` | `POST /auth/v1/verify` avec `type: 'email'` | le mail contient un **code**, pas un lien |
| `rafraichir()` | `POST /auth/v1/token?grant_type=refresh_token` | rien de particulier |
| `profil()` | `GET /rest/v1/profils?id=eq.<uid>` | table `profils`, RLS en lecture |
| `majProfil()` / `ecrireSiVide()` | `PATCH /rest/v1/profils?id=eq.<uid>` | RLS en écriture |

Tant que les deux constantes sont vides, `porte()` renvoie `null` et l'outil s'ouvre sans compte.
C'est voulu : configuration absente vaut porte ouverte. Ça veut aussi dire qu'une faute de frappe
dans l'URL ne se voit pas comme une erreur, elle se voit comme une porte qui ne s'affiche plus.

## 1. Le projet Supabase

Projet `qukmncqqwomhmrdhvetj`, région **West EU (Ireland), `eu-west-1`**, compute nano.
URL : `https://qukmncqqwomhmrdhvetj.supabase.co`.

La région est définitive : [Certain] Supabase ne déplace pas un projet, il faut en recréer un et
migrer. Le choix de l'Irlande a été assumé le 01/09/2026 et le site a été reformulé en
conséquence, voir section 7.4. Ne pas rouvrir ce débat sans compter le coût de migration des
adresses déjà collectées.

À faire si ce n'est pas déjà fait :

1. Noter le mot de passe base de données dans le gestionnaire de mots de passe, il ne s'affiche
   qu'une fois.
2. Relever dans Settings > API : l'URL du projet et la clé `anon` (`publishable`).

## 2. Passer le schéma

Coller `supabase/schema.sql` tel quel dans l'éditeur SQL, puis exécuter. Il crée la table
`profils`, active RLS, pose deux politiques et le déclencheur qui crée la fiche à l'inscription.

Puis coller ce second bloc, qui n'est pas encore dans le dépôt et qui devrait y être :

    -- Aucune politique d'insertion ni de suppression n'existe : autant retirer le droit.
    revoke insert, delete on public.profils from anon, authenticated;

    -- La politique d'update autorise toutes les colonnes. Un compte peut donc réécrire son
    -- propre champ `email` avec l'adresse de quelqu'un d'autre, ce qui pollue la liste de
    -- diffusion sans laisser de trace. Le droit se restreint colonne par colonne.
    revoke update on public.profils from anon, authenticated;
    grant update (prenom, nom, domaine, code_postal, profil, outil_origine, consent_news, vu_le)
      on public.profils to authenticated;

**Test.** Avec la clé anon, sans session, la table doit être muette :

    curl -s "https://<ref>.supabase.co/rest/v1/profils?select=*" -H "apikey: <ANON>"

Réponse attendue : `[]`. Toute autre réponse veut dire que la table des e-mails est publiquement
lisible. C'est le seul vrai risque de sécurité du lot, et il ne se voit nulle part dans l'interface.

## 3. Configurer l'authentification

Authentication > Sign In / Providers > Email :

- fournisseur e-mail activé, inscriptions autorisées. Sans ça, `create_user: true` renvoie 422 et
  la porte affiche « Une erreur est survenue » pour tout le monde.
- longueur du code OTP : 6. Le champ de saisie est en `maxlength="6"`.
- expiration du code : 600 secondes. Le défaut est de 3600, une heure de validité pour un code à
  six chiffres est inutilement large.

Authentication > URL Configuration : Site URL = `https://lebureauduvigneron.fr`.

### Le piège des gabarits

Par défaut, Supabase envoie un **lien magique**, pas un code. Il faut réécrire les gabarits pour
qu'ils contiennent `{{ .Token }}` et plus aucune trace de `{{ .ConfirmationURL }}`.

Et il y a **deux** gabarits à réécrire, pas un :

- **Confirm signup** : c'est celui qui part quand l'adresse est inconnue, donc à la toute première
  connexion de chaque vigneron.
- **Magic Link** : c'est celui qui part quand l'adresse existe déjà, donc à toutes les suivantes.

N'en corriger qu'un donne le pire des symptômes : ça marche en test avec ta propre adresse déjà
inscrite, et ça envoie un lien inutilisable à chaque nouveau vigneron. Personne ne remonte le bug,
ils abandonnent.

Gabarit minimal, à décliner ensuite sur la charte :

    <p>Bonjour,</p>
    <p>Voici votre code de connexion au Bureau du Vigneron :</p>
    <p style="font-size:28px;letter-spacing:6px;font-family:monospace"><b>{{ .Token }}</b></p>
    <p>Il est valable dix minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>

### Limites de débit

Authentication > Rate Limits, après avoir posé le SMTP à l'étape 4 :

- envoi d'e-mails : 30 par heure par défaut, à relever. 150 laisse de la marge sans ouvrir la
  porte à l'abus.
- un même compte ne peut demander un code que toutes les 60 secondes. Le bouton « Renvoyer le
  code » se heurte donc à un 429, déjà traduit en « Trop de tentatives » dans `erreurLisible()`.
  Rien à faire, juste à savoir avant de croire à un bug.

## 4. Resend

Le service e-mail intégré de Supabase ne sert à rien ici : 2 messages par heure, et il refuse
d'écrire à une adresse qui n'est pas membre de l'organisation. Il ne permet même pas un test avec
un vigneron pilote.

### 4.1 Deux sous-domaines, pas un

À créer dans Resend > Domains, région d'envoi **Ireland (eu-west-1)** :

- `courrier.lebureauduvigneron.fr` : les codes de connexion. Transactionnel.
- `edition.lebureauduvigneron.fr` : l'édition bimensuelle. Marketing.

Le plan gratuit accepte trois domaines, la séparation est donc gratuite. Elle sert à une seule
chose, et elle est décisive : le jour où un lecteur marque la newsletter comme indésirable, il
abîme la réputation de `edition.` et pas celle de `courrier.`. Un vigneron qui ne reçoit plus son
code de connexion ne peut plus ouvrir son tableau de bord, et il ne saura jamais pourquoi.

Ne jamais envoyer depuis le domaine racine `lebureauduvigneron.fr`.

### 4.2 DNS

Resend affiche pour chaque domaine les enregistrements exacts à créer chez le registrar :
un MX pour les retours, un TXT SPF, un TXT DKIM. Les copier tels quels, ne rien inventer, ne rien
adapter. La vérification prend de quelques minutes à quelques heures.

Ne pas passer à l'étape suivante avant que Resend affiche le domaine `Verified`. Un SMTP posé sur
un domaine non vérifié n'échoue pas bruyamment, il envoie des messages qui finissent en spam.

### 4.3 Deux clés API

Resend > API Keys, une clé par usage, chacune restreinte à son domaine :

- `bdv-auth-smtp`, permission d'envoi, domaine `courrier.` : va dans le SMTP Supabase.
- `bdv-edition`, permission complète, domaine `edition.` : sert aux envois de newsletter et à la
  gestion des contacts.

Une clé unique pour les deux usages veut dire qu'une fuite du dépôt ou d'un outil tiers coupe
aussi les connexions.

### 4.4 SMTP dans Supabase

Authentication > Emails > SMTP Settings :

| Champ | Valeur |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la clé `bdv-auth-smtp` |
| Sender email | `codes@courrier.lebureauduvigneron.fr` |
| Sender name | `Le Bureau du Vigneron` |

**Test.** Demander un code sur une adresse personnelle, hors organisation Supabase. Le message
doit arriver en moins d'une minute, contenir six chiffres et aucun lien.

### 4.5 Le plafond qui va mordre

Plan gratuit : 3 000 messages par mois, **100 par jour**. Le mensuel est confortable, le
quotidien ne l'est pas. Le jour d'un envoi de l'édition bimensuelle, la newsletter consomme le
quota et les codes de connexion tombent avec elle. À 80 abonnés, il faut soit passer au plan
payant, soit envoyer la newsletter depuis un autre compte. À arbitrer avant le premier envoi, pas
après.

## 5. Brancher les deux constantes

Renseigner `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans `src/js/bdv-compte.js` et committer.

La clé anon est publique par construction, elle vit dans un fichier JS que n'importe qui peut
lire. La committer n'est pas une fuite, la sécurité tient entièrement aux politiques RLS de
l'étape 2. Si un jour un projet de préproduction apparaît, il faudra injecter les deux valeurs au
build depuis les variables d'environnement Vercel, via un `src/_data/`. Pas avant : un seul projet
ne justifie pas ce détour.

Ajouter au passage dans `.env.example`, pour la trace :

    # Projet Supabase (region Paris). La cle anon est publique, elle est aussi en dur dans
    # src/js/bdv-compte.js. Elle est ici pour memoire, aucun script du depot ne la lit.
    SUPABASE_URL=
    SUPABASE_ANON_KEY=

    # Clefs Resend. Celles-ci sont secretes, ne jamais les committer.
    RESEND_API_KEY_AUTH=
    RESEND_API_KEY_EDITION=

## 6. Recette avant mise en ligne

À faire dans l'ordre, sur le site déployé, pas en local :

1. Adresse jamais vue : code reçu, six chiffres, aucun lien. Valide le gabarit **Confirm signup**.
2. Même adresse une seconde fois : code reçu. Valide le gabarit **Magic Link**.
3. Code faux : « Code incorrect, vérifie et réessaie. »
4. Trois demandes en trente secondes : « Trop de tentatives, réessaie dans quelques minutes. »
5. `curl` avec la clé anon sans session sur `profils` : `[]`.
6. `PATCH` de `profils.email` avec un jeton valide : refusé. Valide le durcissement de l'étape 2.
7. Compte A qui tente un `PATCH` sur l'`id` du compte B : zéro ligne modifiée.
8. **Règle d'or.** Couper le réseau, recharger le tableau de bord avec une session déjà ouverte :
   l'outil s'ouvre, la base IndexedDB se lit, le chiffre d'affaires s'affiche. Si l'outil bloque,
   le lot est à refuser, quel que soit l'état du reste.
9. Le lien « politique de confidentialité » de la porte ouvre bien `/politique-confidentialite/`.
10. Une fiche `profils` existe bien, avec `outil_origine = dashboard-vigneron`.

## 7. Ce qui reste à arbitrer, et qui n'est pas de la configuration

Ces quatre points ne se règlent pas dans un tableau de bord. Ils demandent une décision.

### 7.1 Deux listes d'e-mails qui vont diverger

Il y a déjà deux collectes qui ne se parlent pas : le formulaire Tally du bloc newsletter
(`yPokbX`) et la case `consent_news` de la porte. Dans quinze jours, personne ne saura laquelle
fait foi, et un même vigneron sera dans les deux sous deux adresses différentes.

Le dépôt est un site statique, il n'y a pas de serveur pour synchroniser. Deux options :

- **Maintenant, sans code** : Resend Audiences fait foi. Avant chaque envoi, un `select email
  from profils where consent_news` exporté en CSV et importé dans l'audience. Deux minutes toutes
  les deux semaines, zéro dette technique.
- **Plus tard** : un Database Webhook Supabase sur `profils` qui appelle l'API contacts de Resend.
  Une brique de plus à surveiller, pour un gain de deux minutes par quinzaine. Pas maintenant.

### 7.2 On sait dire oui, on ne sait pas dire non

`consent_news` n'est jamais écrit à `false` : la porte le passe à `true` si la case est cochée, et
rien dans l'outil ne permet de revenir dessus. Le retrait du consentement doit être aussi simple
que son recueil (RGPD, article 7-3).

Position tenable en attendant : **l'audience Resend fait foi pour le consentement**, `consent_news`
n'est que le signal d'entrée. Le lien de désinscription des envois Resend suffit alors
juridiquement. Mais il faut l'écrire dans la politique de confidentialité, et prévoir une case
dans l'écran Réglages du tableau de bord au prochain lot.

### 7.3 La page de confidentialité ne mentionne rien

`src/rgpd.njk` ne parle ni de Supabase, ni de Resend, ni de Tally, ni de Vercel. Dès que la porte
est en ligne, elle est fausse par omission. À y ajouter : les sous-traitants et leur région, la
finalité de chaque collecte, la durée de conservation, le droit de retrait.

Le paragraphe qui vaut le plus cher est aussi celui qui vend : les lignes de vente ne quittent pas
le navigateur, et ça reste vrai après ce lot. Resend ne voit qu'une adresse e-mail, Supabase ne
stocke qu'une fiche de profil. Le dire noir sur blanc, avec la liste des colonnes.

### 7.4 « Données hébergées en France », tranché le 01/09/2026

Supabase en Irlande, Resend en Irlande : le récit est « hébergé en Europe », pas « en France ».
Deux formulations corrigées dans le dépôt le 01/09/2026 :

- `src/_includes/components/waitlist.njk` : « Données hébergées en Europe ».
- `src/_includes/components/footer-rich.njk` : « Données hébergées en Europe · Vos ventes restent
  dans votre navigateur », en remplacement de « Hébergé en France · Données souveraines ».

Cette seconde ligne était déjà fausse avant ce lot, et pas à cause de Supabase :
`src/mentions-legales.njk` déclare l'hébergeur du site comme Vercel Inc., 340 Pine Street, San
Francisco. Le footer promettait la France pendant que les mentions légales nommaient la
Californie, sur la même page à deux clics d'écart. La nouvelle formulation ne parle plus que des
**données**, ce qui est vrai et vérifiable, et laisse l'hébergement du site aux mentions légales.

Règle à tenir : toute promesse de localisation doit pouvoir être vérifiée sur la page mentions
légales sans se contredire.

### 7.5 La frontière à ne pas franchir

`CLAUDE.md` pose deux règles que Resend rend techniquement contournables du jour au lendemain :
aucune donnée de vente ne sort du navigateur, aucun e-mail n'est envoyé par l'outil.

Le compositeur de messages remplit un lien `mailto:`, c'est la messagerie du vigneron qui envoie.
Le brancher sur Resend serait quelques lignes. Ce serait aussi transmettre des noms de clients et
des montants à un tiers, rendre la politique de confidentialité fausse, et endosser la
responsabilité d'envoi. Si ce besoin remonte, il s'arbitre à part, avec le message produit et la
page de confidentialité, jamais au fil d'un lot technique.

## 8. Le serveur MCP Supabase

Optionnel, et à poser après le reste. L'URL proposée par le tableau de bord Supabase active
`account` et `branching` et n'active pas la lecture seule. À ne pas coller telle quelle.

URL retenue :

    https://mcp.supabase.com/mcp?project_ref=qukmncqqwomhmrdhvetj&read_only=true&features=docs%2Cdatabase%2Cdebugging%2Cdevelopment

Trois raisons :

- `read_only=true` : la doc Supabase dit « Don't connect to production ». Cette base contient des
  adresses de vignerons dès le premier jour. Les requêtes passent par un rôle Postgres en lecture
  seule.
- `account` retiré : ce groupe donne la création, la mise en pause et la suppression de projets au
  niveau de l'organisation. [Certain] `project_ref` le désactive de toute façon, il n'est là que
  par copier-coller.
- `branching` retiré : fonctionnalité payante non utilisée.

Le DDL de `supabase/schema.sql` se passe à la main dans l'éditeur SQL. C'est un coup unique, déjà
versionné, ça ne justifie pas d'ouvrir l'écriture à un agent.

Scope : `--scope local` plutôt que `--scope project`. Le scope projet écrit `.mcp.json` à la racine
du dépôt, donc dans git : tout clone pointe alors vers la base de production, et chaque session
d'agent future y est implicitement invitée.

Injection de prompt, pas théorique ici : `profils.email` est du texte fourni par l'utilisateur, et
l'objet même de la table est de se remplir de saisies d'inconnus. C'est le scénario documenté par
Supabase. Garder la validation manuelle des appels d'outils activée.
