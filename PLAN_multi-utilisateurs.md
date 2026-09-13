# Plan : travailler a plusieurs sur un meme bureau

Ouvert le 13/09/2026 avec Ted. Etat : **arbitrages pris, rien d'ecrit en base.**

Le besoin, dans ses mots : un compte maitre invite d'autres personnes a travailler sur
la meme base ; chacun peut etre maitre d'un bureau et simple utilisateur d'un autre ; on
doit pouvoir changer de bureau en cours de route.

## LE POINT QUI COMMANDE TOUT LE RESTE

Ce chantier n'est pas un chantier de droits, c'est un chantier de PROPRIETE.

Les huit tables portent aujourd'hui la meme ligne :

    id uuid ... references auth.users on delete cascade

Une ligne de vente n'appartient donc pas a un domaine, elle appartient a une PERSONNE, et
elle meurt avec son compte. Dans un bureau a plusieurs, un salarie qui supprime son compte
emporte le fichier client du domaine. Aucune politique de securite ne repare ca : c'est la
cle etrangere qu'il faut changer, pas la politique.

La forme d'arrivee, sur chaque table de donnees :

    bureau   uuid not null references public.bureaux on delete cascade,
    cree_par uuid references auth.users on delete set null

Le `set null` est le coeur de la reparation. Quelqu'un part, on perd le nom de celui qui a
ecrit la ligne, on ne perd pas la ligne.

## L'ETAT DE DEPART, MESURE LE 13/09/2026

- Huit tables dans `public`, TOUTES avec `id = auth.uid()` comme proprietaire :
  `profils`, `reglages`, `suivi_clients`, `ventes`, `signets`, `echanges`, `taches`,
  `calendrier_choix`. Plus la vue `v_courrier` et la table `courrier_envois`.
- Trente-deux politiques de securite par ligne, toutes de la forme `auth.uid() = id`.
- Une fonction `security definer` deja bornee a `auth.uid()` : `effacer_mes_donnees()`.
- Cote navigateur, **un seul entonnoir** : `BdvCompte.api()`, `src/js/bdv-compte.js`
  ligne 939. Vingt-huit appels, dans six fichiers (`bdv-sync` 13, `bdv-signets` 4,
  `bdv-calchoix` 3, `bdv-reglages` 3, `bdv-taches` 3, `bdv-crm` 2).
- Quatre endroits seulement ecrivent le proprietaire a la main, sous la forme
  `Object.assign({}, ligne, { id: moi })`.

C'est cet entonnoir unique qui rend le chantier faisable. Sans lui, il faudrait relire
vingt-huit appels un par un en esperant n'en oublier aucun.

**La colonne est RENOMMEE `bureau`, elle n'est pas reutilisee sous le nom `id`.** Un appel
oublie echoue alors bruyamment (PostgREST refuse une colonne inconnue) au lieu d'ecrire en
silence sous le mauvais proprietaire. Un renommage est ici un outil de relecture.

## LE MODELE, TROIS TABLES

**`bureaux`** : `bureau` (uuid), `nom`, `cree_le`, `cree_par`.

**`membres`** : `bureau`, `personne`, `role` (`maitre` ou `simple`), `depuis`, `invite_par`.
Cle primaire (bureau, personne). Une personne a autant de lignes que de bureaux ou elle
travaille : c'est cette table, et elle seule, qui rend le changement de bureau possible.

**`invitations`** : empreinte du jeton, `bureau`, `email`, `role`, `expire_le`, `utilise_le`.
Le jeton clair n'est jamais stocke, seule son empreinte l'est. Meme principe que
`jeton_emails`, en plus strict : usage unique et expiration.

## LES REGLES D'ECRITURE, TABLE PAR TABLE

Arbitrage de Ted du 13/09/2026 : **chacun voit tout, chacun n'ecrit que ses propres lignes.**

Cette phrase ne veut pas dire la meme chose sur les six tables, et c'est la premiere chose
a regler avant d'ecrire une ligne de SQL.

| Table | Nature | Qui ecrit |
|---|---|---|
| `echanges` | pile d'entrees datees | **son auteur seul.** La regle s'applique au mot pres : on ne recrit pas l'historique d'un collegue. |
| `suivi_clients` | UNE ligne par client | **tout le monde.** Voir la reserve ci-dessous. |
| `taches` | travail partage | **tout le monde**, avec `fait_par` sur la coche. |
| `ventes` | la base entiere | **maitre seul.** Un import de travers double le chiffre d'affaires du domaine. |
| `reglages` | objectif, exercice, classement | **maitre seul** (arbitrage : tout au bureau). |
| `calendrier_choix` | les reperes du domaine | tout le monde, avec `maj_par`. |
| `signets` | ma lecture | **reste attache a la PERSONNE**, hors bureau. |

### LA RESERVE, TRANCHEE PAR TED LE 13/09/2026

`suivi_clients` porte une seule ligne par client pour tout le bureau (statut, notes, rappel,
canal, tags). La regle « mes propres lignes » y a une consequence que Ted a assumee en
connaissance de cause : **le premier qui touche un client le verrouille pour les autres.**
Personne d'autre ne peut plus changer son statut, poser un rappel ni corriger la date. Idem
pour `taches` : une tache ecrite par Alice ne peut etre cochee que par Alice.

**Arbitrage : la regle s'applique partout, sans exception.** Le tableau du dessus est donc a
lire au pied de la lettre, y compris ses deux lignes « tout le monde », qui deviennent « son
auteur seul ».

Ce qui rend ce choix reversible, et c'est la raison de l'ecrire ici : **il vit entierement
dans les politiques de securite, pas dans la forme des donnees.** La colonne `cree_par` est
posee dans les deux cas. Ouvrir `suivi_clients` au bureau entier le jour ou le verrouillage
genera coutera un `drop policy` et un `create policy`, sans migration et sans toucher au
navigateur. Ne pas prendre ce choix pour une contrainte de structure.

## LES SIX VERROUS

**1. La recursion.** Une politique sur `membres` qui interroge `membres` fait echouer
Postgres avec « infinite recursion detected in policy ». Toutes les politiques passent donc
par une fonction `security definer`, `est_membre(bureau)` et `est_maitre(bureau)`, declarees
`stable` et `set search_path = public`, fermees a `anon`. Une seule verite pour les huit
tables, comme `bdv-echeances.js` pour le calcul des echeances.

**2. L'elevation de droit.** **Aucune politique d'update sur `membres`.** Sans ce vide, un
simple utilisateur se nomme maitre en une requete sur sa propre ligne. Les changements de
role passent par une fonction qui verifie d'abord `est_maitre()` sur CE bureau.

**3. Le dernier maitre.** La fonction refuse de rétrograder ou de retirer le dernier maitre
d'un bureau. Garde-fou en base, pas dans l'ecran : une contrainte tient meme quand
l'ecriture ne vient pas du code.

**4. Le jeton d'invitation.** Trente-deux octets tires au hasard, empreinte seule en base,
usage unique, expiration a sept jours, lie a l'adresse invitee. L'acceptation demande une
session : on accepte AVEC un compte, jamais anonymement.

**5. Le bureau courant.** Range dans `profils.bureau_courant` pour suivre d'un appareil a
l'autre. **La base ne le croit jamais** : chaque politique verifie l'appartenance sur le
bureau reel de la ligne. Un navigateur trafique qui reclame le bureau du voisin lit zero
ligne.

**6. La revocation immediate.** La liste des bureaux N'EST PAS mise dans le jeton de session.
Ce serait plus rapide, mais retirer quelqu'un ne prendrait effet qu'a l'expiration de son
jeton, jusqu'a une heure plus tard. La verification en table coute une jointure et retire
l'acces a la seconde.

Et un septieme, qui n'est pas une politique : `effacer_mes_donnees()` devient
`vider_la_base_du_bureau()`, reservee au maitre. Son nom actuel dit « mes donnees » a
quelqu'un qui s'appreterait a effacer celles de tout le domaine.

## LE COURRIER DU MATIN

Arbitrage de Ted : **chacun choisit dans ses preferences.**

Consequence : `consent_courrier` ne peut plus vivre sur `profils`, qui ne connait qu'une
personne. Le choix devient un couple (personne, bureau), et `courrier_envois`, aujourd'hui
cle sur (compte, jour), devient (personne, bureau, jour). `v_courrier` rend une ligne par
membre qui le demande, pas une par compte.

`jeton_emails` reste attache a la personne : quelqu'un qui se desabonne depuis son telephone
sans etre connecte doit voir ses bureaux et choisir. Le retrait ne doit jamais etre plus
difficile que le consentement (RGPD 7-3), et ca vaut aussi quand il y a deux bureaux.

## LA PREUVE : `banc-cloison.mjs`

La cle anon est publique, elle est lisible dans un fichier JavaScript du site. La securite
par ligne est le SEUL mur. Une politique mal ecrite sur les trente et quelques, et le
fichier client d'un domaine devient lisible par un autre.

Le banc cree deux vrais comptes, les met dans deux bureaux differents, et verifie par de
VRAIS appels HTTP avec de VRAIS jetons que chacun lit zero ligne de l'autre, table par
table et verbe par verbe (select, insert, update, delete). Il verifie en plus les trois
gestes interdits : se nommer maitre, retirer le dernier maitre, ecrire dans un bureau dont
on n'est pas membre.

Lecon du 11/09/2026, qui s'applique mot pour mot : un controle ecrit pour l'occasion valide
toujours tout, seul le vrai moteur sur la vraie page trouve les defauts.

## LES CINQ LOTS

**Lot 1, le socle invisible.** Les trois tables, `est_membre()` et `est_maitre()`, et la
migration : chaque compte existant devient maitre d'un bureau solo nomme d'apres son
domaine. Rien ne change a l'ecran, rien ne change dans le navigateur.

**Lot 2, la bascule.** Les six tables de donnees passent sur `bureau`, les politiques sont
reecrites, `BdvCompte.api()` envoie le bureau courant. **Le seul lot vraiment risque** : il
touche une base qui contient deja des donnees reelles. Il se repete d'abord sur une branche
Supabase. Le banc de cloison est ecrit AVANT, pas apres.

**Lot 3, changer de bureau.** Le selecteur dans la barre du bureau, `bureau_courant`, et le
rechargement complet du moteur au changement (une base en memoire qui garde les lignes du
bureau precedent est le defaut le plus previsible de ce lot).

**Lot 4, inviter.** Le jeton, l'envoi par l'Edge Function et Resend, l'ecran « l'equipe »,
l'acceptation.

**Lot 5, les traces.** `cree_par` et `maj_par` affiches, le journal des suppressions, et les
verrous du dernier maitre.

## CE QUI RESTE OUVERT

1. Un simple utilisateur peut-il importer un export de ventes ? La reponse proposee est non,
   parce qu'un import de travers touche la base entiere du domaine.
2. Que voit un invite AVANT d'accepter : le nom du bureau et celui qui invite, rien d'autre.
3. Que devient un bureau dont le maitre supprime son compte, s'il est seul dedans.
