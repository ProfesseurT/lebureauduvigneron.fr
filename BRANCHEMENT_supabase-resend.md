# Brancher Supabase et Resend

État au 01/09/2026, révisé le soir : le lot est passé de **email + code à six chiffres** à
**email + mot de passe**, décidé avec Ted. Le code de `src/js/bdv-compte.js` a été réécrit en
conséquence. Le projet Supabase `qukmncqqwomhmrdhvetj` existe, en **West EU (Ireland),
`eu-west-1`**, encore vide. Resend n'est pas créé. Ce fichier est la marche à suivre, dans
l'ordre. Chaque étape a son test : si le test ne passe pas, ne pas passer à la suivante.

Ce que le mot de passe change, en une phrase : le code à six chiffres n'est plus un moyen de
connexion, il ne sert plus qu'à confirmer une adresse à l'inscription et à reprendre un mot de
passe oublié. Conséquence directe et bienvenue, le plafond Resend de 100 messages par jour ne
peut plus empêcher un vigneron de se connecter (voir 4.5).

## 0. Ce que le code attend

`src/js/bdv-compte.js` appelle GoTrue et PostgREST directement, sans `supabase-js`. Il attend
exactement deux valeurs, lignes 21 et 22 :

    const SUPABASE_URL = '';
    const SUPABASE_ANON_KEY = '';

Une troisième constante, `MDP_MIN = 8`, doit rester alignée sur le réglage Supabase de la
section 3. Si les deux divergent, le refus vient du serveur et le message s'affiche en anglais.

Points de contact réseau, il n'y en a pas d'autres :

| Appel | Endpoint | Ce qu'il suppose |
| --- | --- | --- |
| `inscription()` | `POST /auth/v1/signup` `{email, password}` | inscriptions ouvertes, e-mail activé |
| `confirmerInscription()` | `POST /auth/v1/verify` `type: 'signup'` | gabarit **Confirm signup** en `{{ .Token }}` |
| `renvoyerConfirmation()` | `POST /auth/v1/resend` `type: 'signup'` | idem |
| `connexion()` | `POST /auth/v1/token?grant_type=password` | rien de particulier |
| `demanderReprise()` | `POST /auth/v1/recover` | gabarit **Reset password** en `{{ .Token }}` |
| `validerReprise()` | `POST /auth/v1/verify` `type: 'recovery'` | ouvre une session, ne change pas le mot de passe |
| `changerMdp()` | `PUT /auth/v1/user` `{password}` + Bearer | la session de reprise |
| `rafraichir()` | `POST /auth/v1/token?grant_type=refresh_token` | rien de particulier |
| `profil()` | `GET /rest/v1/profils?id=eq.<uid>` | table `profils`, RLS en lecture |
| `majProfil()` / `ecrireSiVide()` | `PATCH /rest/v1/profils?id=eq.<uid>` | RLS en écriture |

Trois pièges portés par le code, à connaître avant de déboguer l'écran :

1. **La reprise, c'est deux appels.** `verify type=recovery` ouvre une session, il ne change
   aucun mot de passe. C'est cette session qui autorise le `PUT /user` suivant. Un seul des
   deux appels laisse le vigneron connecté avec son ancien mot de passe intact.
2. **Une adresse déjà prise ne renvoie pas d'erreur.** [Probable] GoTrue répond `200` avec un
   utilisateur dont `identities` est un tableau vide, pour ne pas révéler qui est inscrit.
   `inscription()` teste ce cas ; sans lui, l'écran demanderait un code qui n'arrive jamais.
3. **Un compte créé mais jamais confirmé** reçoit `email_not_confirmed` à la connexion.
   `seConnecter()` rattrape ce code, renvoie un code de confirmation et affiche l'étape 2.
   Sans ce rattrapage, ce vigneron est enfermé dehors définitivement : rien dans l'écran ne lui
   permettrait de redemander le code.

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

**Un seul geste** depuis le 01/09/2026 : ouvrir `supabase/schema.sql`, tout copier, coller dans
l'éditeur SQL Supabase, exécuter. Les grants de durcissement, qui traînaient hors du dépôt, y sont
désormais versionnés, ainsi que le déclencheur de synchronisation de l'adresse (voir 7.6).

Le fichier est écrit pour être **rejouable sans erreur** : `create ... if not exists`,
`drop policy if exists` avant chaque `create policy`, `create or replace function`,
`drop trigger if exists`. Le rejouer après un passage partiel ne casse rien. C'est délibéré : un
script à moitié passé dans un onglet de navigateur est le pire état à déboguer, et c'est le seul
mode d'exécution disponible ici — [Certain] le MCP Supabase est en `read_only=true`, il ne passe
aucun DDL, et c'est voulu (section 8).

Ce que le fichier fait, dans l'ordre : la table `profils`, RLS activé, les deux politiques
(`select` et `update`, cette dernière avec un `with check` explicite qui interdit de réécrire
`id`), le retrait des droits `insert`/`delete`/`update` puis le regrant d'`update` colonne par
colonne, le déclencheur de création de fiche, et le déclencheur de synchronisation de l'adresse.

`id`, `email` et `cree_le` sont volontairement hors du grant. [Certain] Les deux déclencheurs sont
`security definer` : ils écrivent malgré ces `revoke`, et c'est le seul chemin autorisé vers ces
trois colonnes.

**Test.** Avec la clé anon, sans session, la table doit être muette :

    curl -s "https://qukmncqqwomhmrdhvetj.supabase.co/rest/v1/profils?select=*" -H "apikey: <ANON>"

Réponse attendue : `[]`. Toute autre réponse veut dire que la table des e-mails est publiquement
lisible. C'est le seul vrai risque de sécurité du lot, et il ne se voit nulle part dans l'interface.

**Second test, à passer dans un nouvel onglet de l'éditeur SQL** — il vérifie que le durcissement
a bien pris, ce que l'interface n'affiche pas :

    select grantee, privilege_type, column_name
      from information_schema.column_privileges
     where table_name = 'profils' and grantee in ('anon','authenticated')
     order by grantee, column_name;

    select tgname, tgenabled from pg_trigger
     where tgrelid = 'auth.users'::regclass and not tgisinternal;

Attendu : aucune ligne `update` pour `anon`, aucune ligne `update` sur `email`, `id` ou `cree_le`
pour `authenticated`, et **deux** déclencheurs sur `auth.users`,
`creer_profil_apres_inscription` et `synchroniser_email_apres_maj`, tous deux en `O`.

## 3. Configurer l'authentification

Authentication > Sign In / Providers > Email :

- fournisseur e-mail activé, **inscriptions autorisées**. Sans ça, `POST /signup` renvoie 422 et
  la porte affiche « Une erreur est survenue » pour tout le monde.
- **Confirm email : activé.** Décidé le 01/09/2026. Le coût est un e-mail par inscription et un
  écran de plus ; le gain est que `profils.email` ne contient que des adresses vérifiées, sans
  quoi la liste de diffusion se remplit d'adresses fausses ou d'adresses d'autrui — exactement
  la pollution que le durcissement des grants de la section 2 cherche à empêcher.
- **Minimum password length : 8.** Doit rester égal à `MDP_MIN` dans `bdv-compte.js`.
- **Aucune exigence de caractères** (pas de majuscule ni de symbole imposés). Le public est
  vigneron, souvent sur téléphone : une règle de complexité produit un mot de passe noté sur un
  carnet à côté de l'ordinateur, ce qui est un recul de sécurité, pas un progrès.
- [Certain] La protection contre les mots de passe déjà fuités (HaveIBeenPwned) est réservée au
  plan Pro. On s'en passe, et on ne compte pas dessus.
- longueur du code OTP : **6**. Le champ de saisie est en `maxlength="6"`. Toujours utile : le
  code sert encore à la confirmation et à la reprise.
- expiration du code : **600 secondes**. Le défaut est de 3600, une heure de validité pour un
  code à six chiffres est inutilement large.

Authentication > URL Configuration : Site URL = `https://lebureauduvigneron.fr`. Aucune Redirect
URL n'est nécessaire : le code reste dans la modale, aucun e-mail ne contient de lien cliquable.

### Le piège des gabarits

Par défaut, Supabase envoie un **lien**, pas un code. Il faut réécrire les gabarits pour qu'ils
contiennent `{{ .Token }}` et plus aucune trace de `{{ .ConfirmationURL }}`.

[Certain] `{{ .Token }}` est disponible dans **Confirm signup** comme dans **Reset password**.
C'est ce qui permet à tout le parcours de rester dans la modale : aucune page de retour à écrire,
aucun fragment d'URL à décoder, aucun lien à cliquer depuis un téléphone.

Deux gabarits à réécrire :

- **Confirm signup** : part à chaque création de compte, et à chaque `resend`.
- **Reset password** : part à chaque « Mot de passe oublié ». **C'est celui qu'on oublie**, et son
  oubli ne se voit qu'au premier vigneron qui perd son mot de passe — c'est-à-dire trop tard, et
  il ne le signalera pas.

**Magic Link** n'a plus à être touché : la connexion par code a été retirée du code le 01/09/2026.
Si le gabarit par défaut reste en place, aucun message n'en part.

Gabarit minimal, à décliner ensuite sur la charte. Le même corps convient aux deux, seule la
phrase d'introduction change (« Voici votre code de connexion » / « Voici votre code pour
choisir un nouveau mot de passe ») :

    <p>Bonjour,</p>
    <p>Voici votre code pour le Bureau du Vigneron :</p>
    <p style="font-size:28px;letter-spacing:6px;font-family:monospace"><b>{{ .Token }}</b></p>
    <p>Il est valable dix minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>

### Limites de débit

Authentication > Rate Limits, après avoir posé le SMTP à l'étape 4 :

- envoi d'e-mails : 30 par heure par défaut. Moins critique qu'avec la connexion par code, mais
  à relever quand même : 150 laisse de la marge sans ouvrir la porte à l'abus.
- un même compte ne peut demander un code que toutes les 60 secondes. Le bouton « Renvoyer le
  code » se heurte donc à un 429, déjà traduit en « Trop de tentatives » dans `erreurLisible()`.
  Rien à faire, juste à savoir avant de croire à un bug.
- les tentatives de connexion par mot de passe ont leur propre limite, indépendante de l'e-mail.
  Un vigneron qui se trompe cinq fois voit « Trop de tentatives » et non « mot de passe
  incorrect » : c'est le serveur qui parle, pas un bug de l'écran.

## 4. Resend

Le service e-mail intégré de Supabase ne sert à rien ici : 2 messages par heure, et il refuse
d'écrire à une adresse qui n'est pas membre de l'organisation. Il ne permet même pas un test avec
un vigneron pilote.

### 4.1 Deux sous-domaines, pas un

À créer dans Resend > Domains, région d'envoi **Ireland (eu-west-1)** :

- `courrier.lebureauduvigneron.fr` : confirmations d'inscription et reprises de mot de passe.
  Transactionnel.
- `edition.lebureauduvigneron.fr` : l'édition bimensuelle. Marketing.

Le plan gratuit accepte trois domaines, la séparation est donc gratuite. Elle sert à une seule
chose, et elle est décisive : le jour où un lecteur marque la newsletter comme indésirable, il
abîme la réputation de `edition.` et pas celle de `courrier.`. Un vigneron qui a perdu son mot de
passe et dont le code de reprise part en spam n'a plus aucun chemin de retour, et il ne saura
jamais pourquoi.

Ne jamais envoyer depuis le domaine racine `lebureauduvigneron.fr`.

#### État constaté le 01/09/2026 : Resend a été posé sur la racine

Vérification DNS depuis 1.1.1.1 et 8.8.8.8, le 01/09/2026 au soir. Ce qui existe :

| Nom | Valeur |
| --- | --- |
| `send.lebureauduvigneron.fr` MX | `10 feedback-smtp.eu-west-1.amazonses.com` |
| `send.lebureauduvigneron.fr` TXT | `v=spf1 include:amazonses.com ~all` |
| `resend._domainkey.lebureauduvigneron.fr` TXT | clé DKIM présente |
| `_dmarc.lebureauduvigneron.fr` TXT | `v=DMARC1; p=none;` |
| `courrier.lebureauduvigneron.fr` | **NXDOMAIN**, rien |
| `edition.lebureauduvigneron.fr` | **NXDOMAIN**, rien |

Bonne nouvelle au passage : [Certain] le courrier IONOS n'est pas menacé. Les MX
`mx00/mx01.ionos.fr` et le SPF `_spf-eu.ionos.com` sont sur la racine, Resend n'utilise que le
sous-domaine `send.` — deux enregistrements distincts, aucun conflit. Ne jamais toucher aux
enregistrements IONOS de la racine.

**Arbitrage repris le 01/09/2026 : on tient la séparation en deux sous-domaines**, et la racine
sort de Resend. Migration en 4.2bis.

### 4.2 DNS

Resend affiche pour chaque domaine les enregistrements exacts à créer chez le registrar :
un MX pour les retours, un TXT SPF, un TXT DKIM. Les copier tels quels, ne rien inventer, ne rien
adapter. La vérification prend de quelques minutes à quelques heures.

[Certain] **La clé DKIM est propre à chaque domaine.** Ne jamais recopier celle de la racine sur
`courrier.` ou `edition.` : le domaine ne se vérifiera pas, et l'erreur est invisible dans
l'interface du registrar.

[Probable] **Piège IONOS.** L'éditeur DNS d'IONOS complète tout seul avec le nom de la zone. Saisir
`send.courrier.lebureauduvigneron.fr` dans le champ « Nom » crée
`send.courrier.lebureauduvigneron.fr.lebureauduvigneron.fr`, qui ne se vérifiera jamais. Ne saisir
que la partie relative : `send.courrier`, `resend._domainkey.courrier`, et ainsi de suite. Cela se
contrôle de l'extérieur, avant même de regarder Resend :

    dig +short TXT resend._domainkey.courrier.lebureauduvigneron.fr

**DMARC : rien à créer sur les sous-domaines.** [Certain] Une politique DMARC posée sur le domaine
d'organisation s'applique à ses sous-domaines tant qu'aucune politique plus spécifique ne
l'écrase. `_dmarc.lebureauduvigneron.fr` en `p=none` couvre donc `courrier.` et `edition.`. C'est
le seul enregistrement Resend de la racine à **conserver**.

Ne pas passer à l'étape suivante avant que Resend affiche le domaine `Verified`. Un SMTP posé sur
un domaine non vérifié n'échoue pas bruyamment, il envoie des messages qui finissent en spam.

### 4.2bis État DNS au 01/09/2026, et ce qu'il reste

`courrier.lebureauduvigneron.fr` est **en place et vérifié**, contrôlé depuis 1.1.1.1, 8.8.8.8 et
le serveur autoritatif IONOS `ns1066.ui-dns.com` :

| Nom | Valeur |
| --- | --- |
| `send.courrier` MX | `10 feedback-smtp.eu-west-1.amazonses.com` |
| `send.courrier` TXT | `v=spf1 include:amazonses.com ~all` |
| `resend._domainkey.courrier` TXT | clé DKIM présente, distincte de celle de la racine |
| `_dmarc.courrier` | NXDOMAIN, et c'est correct : la racine couvre |

`edition.lebureauduvigneron.fr` n'existe pas encore. Ce n'est pas un reste de ce lot : c'est le
premier geste du lot newsletter, à faire avant le premier envoi de l'édition, jamais après.

**Le danger n'est pas ce qui manque, c'est ce qui reste en trop.** La racine est encore vérifiée
dans Resend, donc encore sélectionnable comme expéditeur. Le jour du premier envoi de l'édition,
si `edition.` n'existe pas, Resend proposera la racine et l'envoi partira du domaine qui porte les
codes de reprise de mot de passe. Ce ne sera pas une faute d'inattention, ce sera le défaut de
l'interface. Le seul garde-fou fiable est de retirer la racine tout de suite, pas de compter s'en
souvenir dans quinze jours.

Reste à faire, dans cet ordre :

1. Clé API `bdv-auth-smtp`, permission d'envoi, restreinte à `courrier.` (section 4.3). La clé
   `bdv-edition` attend que `edition.` existe.
2. SMTP Supabase sur `codes@courrier.lebureauduvigneron.fr` (section 4.4).
3. Les deux tests d'envoi : inscription, puis mot de passe oublié. Le second est le seul qui
   prouve que le gabarit **Reset password** a été réécrit.
4. Les deux tests passés, **retirer le domaine racine de Resend**, puis supprimer chez IONOS
   `send.lebureauduvigneron.fr` MX, `send.lebureauduvigneron.fr` TXT et
   `resend._domainkey.lebureauduvigneron.fr`.
5. Ne jamais toucher à `_dmarc.lebureauduvigneron.fr`, ni au SPF `_spf-eu.ionos.com`, ni aux MX
   `mx00/mx01.ionos.fr` : c'est la boîte de Ted.

Contrôle depuis l'extérieur, plus rapide que de deviner si le tort vient d'IONOS ou de Resend :

    dig +short TXT resend._domainkey.courrier.lebureauduvigneron.fr
    dig +short MX  send.courrier.lebureauduvigneron.fr

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

**Test.** Créer un compte sur une adresse personnelle, hors organisation Supabase. Le message
doit arriver en moins d'une minute, contenir six chiffres et aucun lien. Puis « Mot de passe
oublié » sur cette même adresse : un second message, six chiffres, aucun lien. Le second test
est le seul qui prouve que le gabarit **Reset password** a bien été réécrit.

### 4.5 Le plafond, et pourquoi il mord beaucoup moins

Plan gratuit : 3 000 messages par mois, **100 par jour**.

Avec la connexion par code, ce plafond était un risque de blocage : chaque connexion consommait
un e-mail, et le jour d'un envoi de l'édition bimensuelle la newsletter mangeait le quota, donc
plus personne ne pouvait ouvrir son tableau de bord. **Le mot de passe supprime ce risque.**
Resend ne voit plus qu'une inscription et un oubli de mot de passe, soit quelques messages par
semaine face à une newsletter bimensuelle.

Ce qui reste vrai : le jour d'un envoi, si l'édition dépasse le quota, une **inscription** ou un
**oubli de mot de passe** peut tomber avec elle. C'est un désagrément à retenter le lendemain, plus
un vigneron enfermé dehors. À arbitrer avant de dépasser 80 abonnés, sans urgence.

## 5. Brancher les deux constantes

Renseigner `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans `src/js/bdv-compte.js` et committer.

La clé anon est publique par construction, elle vit dans un fichier JS que n'importe qui peut
lire. La committer n'est pas une fuite, la sécurité tient entièrement aux politiques RLS de
l'étape 2. Si un jour un projet de préproduction apparaît, il faudra injecter les deux valeurs au
build depuis les variables d'environnement Vercel, via un `src/_data/`. Pas avant : un seul projet
ne justifie pas ce détour.

Ajouter au passage dans `.env.example`, pour la trace :

    # Projet Supabase (region West EU, Ireland). La cle anon est publique, elle est aussi en dur dans
    # src/js/bdv-compte.js. Elle est ici pour memoire, aucun script du depot ne la lit.
    SUPABASE_URL=
    SUPABASE_ANON_KEY=

    # Clefs Resend. Celles-ci sont secretes, ne jamais les committer.
    RESEND_API_KEY_AUTH=
    RESEND_API_KEY_EDITION=

## 6. Recette avant mise en ligne

À faire dans l'ordre, sur le site déployé, pas en local :

1. Adresse jamais vue, « Créer mon compte » : code reçu, six chiffres, aucun lien. Valide le
   gabarit **Confirm signup**.
2. Code saisi : la porte s'ouvre. Une fiche `profils` existe, avec `outil_origine =
   dashboard-vigneron`.
3. Déconnexion, puis « Me connecter » avec le bon mot de passe : la porte s'ouvre, **aucun
   e-mail ne part**. C'est tout l'intérêt du lot, et ça se vérifie dans le journal Resend.
4. Mauvais mot de passe : « Adresse ou mot de passe incorrect. » Pas « Code incorrect ».
5. **« Créer mon compte » sur cette adresse déjà inscrite** : « Un compte existe déjà avec cette
   adresse. » Surtout pas un écran de code qui attend indéfiniment. Valide le test `identities`.
6. Mot de passe de moins de 8 caractères à l'inscription : refusé en français, avant l'appel
   réseau.
7. **« Mot de passe oublié »**, code reçu, nouveau mot de passe posé, la porte s'ouvre. Puis
   déconnexion et connexion avec le **nouveau** mot de passe. Valide le gabarit **Reset
   password** et le fait que `changerMdp()` a bien été appelé après la session de reprise.
8. Ancien mot de passe après cette reprise : refusé.
9. Compte créé et fenêtre fermée sans saisir le code, puis « Me connecter » : un nouveau code
   part et l'étape 2 s'affiche. Valide le rattrapage `email_not_confirmed`.
10. Trois demandes de code en trente secondes : « Trop de tentatives, réessaie dans quelques
    minutes. »
11. `curl` avec la clé anon sans session sur `profils` : `[]`.
12. `PATCH` de `profils.email` avec un jeton valide : refusé. Valide le durcissement de l'étape 2.
13. Compte A qui tente un `PATCH` sur l'`id` du compte B : zéro ligne modifiée.
14. **Règle d'or.** Couper le réseau, recharger le tableau de bord avec une session déjà ouverte :
    l'outil s'ouvre, la base IndexedDB se lit, le chiffre d'affaires s'affiche. Si l'outil bloque,
    le lot est à refuser, quel que soit l'état du reste.
15. Le lien « politique de confidentialité » de la porte ouvre bien `/politique-confidentialite/`.

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

### 7.6 `profils.email` divergeait de `auth.users.email` — résolu le 01/09/2026

Apparu avec le mot de passe, parce que le code appelle maintenant `PUT /auth/v1/user`.

[Certain] Cet endpoint change le mot de passe, mais il accepte aussi un champ `email`. Or le
déclencheur `creer_profil` ne recopie l'adresse qu'**à l'insertion**, et la section 3 du schéma
interdit au compte de toucher `profils.email`. Un changement d'adresse côté GoTrue laissait donc
dans `profils` une adresse périmée que **rien** ne pouvait corriger — ni le client, faute de
droit, ni le déclencheur, qui ne se réveille pas sur `update`.

**Corrigé dans `supabase/schema.sql`, section 5** : un second déclencheur
`synchroniser_email_apres_maj`, `after update on auth.users`, conditionné par
`when (new.email is distinct from old.email)` pour ne pas réécrire la ligne à chaque connexion —
GoTrue met `auth.users` à jour bien plus souvent que l'adresse ne change.

Conséquence sur la décision précédente : **la liste de diffusion peut se lire sur
`profils.email`.** Le détour par une vue sur `auth.users`, envisagé avant ce correctif, n'a plus
de raison d'être. Cinq lignes de déclencheur valaient mieux qu'une vue plus une note de vigilance
à tenir dans le temps.

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
