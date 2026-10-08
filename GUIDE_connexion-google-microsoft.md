# Option D : « Se connecter avec Google / Microsoft », le guide pas à pas

Écrit le 08/10/2026. Rien n'est codé. Ce guide dit ce que **Ted** doit faire avant qu'une ligne
de code ait un sens, dans l'ordre, avec ce que ça coûte et combien de temps ça prend.

Étiquettes : [Certain] = lu dans la documentation officielle ; [Probable] = déduit d'une source
officielle, pas écrit mot pour mot ; [Supposition] = à vérifier.

## Pourquoi l'option D existe

L'option B (le mot de passe de la boîte, lots 76 à 78) ne marche pas pour trois familles :

- **Microsoft 365 et Outlook.com** : Outlook.com personnel a coupé l'authentification par mot de
  passe le 16/09/2024 [Certain]. Pour Microsoft 365, l'envoi par mot de passe (SMTP AUTH) reste
  permis jusqu'en décembre 2026, puis il est **désactivé par défaut** pour les comptes existants
  (l'administrateur peut le rallumer), et les nouveaux comptes n'ont que la connexion moderne ;
  suppression définitive au second semestre 2027 [Certain, message MC786329, version du 27/01/2026].
- **iCloud** : envoi sur le port 587 avec un mot de passe d'application, aucune connexion moderne
  [Certain/Probable]. Supabase ne sort que sur le port 465 : **iCloud reste sur l'option A
  (la messagerie), même avec l'option D.**
- **Gmail** marche déjà en option B (mot de passe d'application). L'option D lui évite seulement
  ce mot de passe à créer.

Donc la vraie urgence de l'option D, c'est **Microsoft, avant fin décembre 2026**.

## Le choix technique, déjà tranché par les faits

- **Google** : passer par l'API Gmail (`users.messages.send`) avec la permission `gmail.send`,
  et **pas** par le SMTP en connexion moderne. `gmail.send` est une permission « sensible » :
  vérification gratuite, sans audit. Le SMTP demande `https://mail.google.com/`, permission
  « restreinte » qui exige un audit de sécurité payant (CASA) [Certain pour les catégories,
  Probable pour le besoin du SMTP].
- **Microsoft** : passer par Microsoft Graph (`sendMail`) avec la permission déléguée `Mail.Send`.
  Elle marche pour les comptes pro et personnels [Certain], sans accord de l'administrateur par
  défaut [Probable].

## Partie Google, étape par étape

1. **Créer un projet Google Cloud** (console.cloud.google.com), au nom de Solumatic ou du Bureau.
   Gratuit.
2. **Remplir l'écran de consentement (« Branding »)** : nom de l'application, e-mail de support,
   page d'accueil publique, politique de confidentialité **sur le même domaine**, liée depuis la
   page d'accueil et depuis l'écran de consentement [Certain].
   [Supposition] Prérequis à vérifier : `lebureauduvigneron.fr` doit servir le site (au 10/09/2026
   ce domaine n'était pas branché sur Vercel).
3. **Vérifier le domaine dans Google Search Console** (un enregistrement DNS) [Certain].
4. **Demander la vérification de la marque** (2 à 3 jours ouvrés) [Probable].
5. **Déclarer la permission `gmail.send` dans le Verification Center**, avec une justification
   et jusqu'à 3 liens [Certain].
6. **Tourner une vidéo** non répertoriée sur YouTube, **en anglais**, qui montre l'écran de
   consentement, l'identifiant du client (client ID) dans la barre d'adresse, et l'usage de
   chaque permission [Certain].
7. **Accepter la règle « Limited Use »** : les données lues ne servent qu'à ce que l'utilisateur
   demande [Certain].
8. **Attendre** : environ 10 jours pour une permission sensible [Probable]. Gratuit [Probable].

En attendant la vérification, le **mode test** : 100 utilisateurs déclarés à la main, et leur
connexion expire au bout de **7 jours** [Certain]. Bon pour essayer avec Ted, inutilisable pour
des clients. Une application non vérifiée affiche un écran d'avertissement et plafonne à
100 utilisateurs **pour toute la vie du projet** [Certain].

Plafonds d'envoi Gmail : 500 mails par jour pour un compte personnel, 2 000 pour Workspace
[Certain]. Le bureau en plafonne déjà 200 (lot 77).

## Partie Microsoft, étape par étape

1. **Inscrire Solumatic au Microsoft AI Cloud Partner Program** pour obtenir un
   **Partner One ID** (gratuit) [Certain].
2. **Créer l'application dans Microsoft Entra** (« inscriptions d'applications »), multi-tenant
   et comptes personnels, avec la permission déléguée `Mail.Send` [Certain].
3. **Vérifier l'éditeur** (« publisher verification ») : lier le Partner One ID, avec un domaine
   vérifié [Certain]. Gratuit [Certain].
4. **Pourquoi c'est obligatoire** : depuis novembre 2020, un utilisateur ne peut pas donner son
   accord à une application multi-tenant non vérifiée quand le consentement « risk-based step-up »
   est actif dans son entreprise [Certain].

[Supposition] Solumatic a peut-être déjà un Partner One ID (Vitisoft) : c'est la question 2 du
message à Solumatic. Si oui, l'étape 1 tombe.

## Ce que ça coûte et ce que ça demande en code, plus tard

- **Argent** : zéro des deux côtés [Probable pour Google, Certain pour Microsoft].
- **Une page rgpd à compléter** avant la mise en ligne : ce qui est gardé (le jeton de
  renouvellement, chiffré dans Vault, comme le mot de passe des lots 76 à 78), comment le retirer.
- **Du code** : une page de retour de connexion, une fonction Edge qui échange le code contre un
  jeton et le range dans Vault, et deux nouveaux chemins d'envoi (API Gmail, Graph) à côté du SMTP.
  Le geste du vigneron reste le même : « Envoyer depuis ma boîte ».

## L'ordre conseillé

1. Envoyer le message à Solumatic (brouillon proposé à Ted le 08/10/2026, à valider avant envoi).
2. Lancer **Microsoft d'abord** (la date de décembre 2026), Google ensuite.
3. Coder seulement quand les deux vérifications sont acceptées, ou au moins l'une.

## Sources

- developers.google.com/workspace/gmail/api/auth/scopes
- support.google.com/cloud/answer/13464321, 13463817, 15549945
- developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- support.google.com/mail/answer/22839 ; knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace
- learn.microsoft.com/en-us/graph/api/user-sendmail
- learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview
- mc.merill.net/message/MC786329
- techcommunity.microsoft.com/blog/exchange/updated-exchange-online-smtp-auth-basic-authentication-deprecation-timeline/4489835
- learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/deprecation-of-basic-authentication-exchange-online
