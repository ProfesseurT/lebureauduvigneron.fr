# Les gabarits d'e-mail de l'authentification

Les deux seuls e-mails transactionnels du produit : la confirmation d'inscription et la reprise de
mot de passe. Ils sont envoyés par Supabase, depuis `bureau@courrier.lebureauduvigneron.fr`.

## Ces fichiers sont la RÉFÉRENCE, le tableau de bord est la CIBLE

Le contenu réel vit dans **Supabase → Authentication → Emails**. Ces fichiers-ci ne sont lus par
aucun programme : ils existent pour que le dépôt sache ce qui est en production.

**Pourquoi ils ont été versés ici, le 10/09/2026.** Ils étaient les seuls écrits du produit à ne
vivre nulle part dans le dépôt. Ni `npm run charte` ni `npm run verif` ne les voyaient, et leur
couleur en dur ne portait pas le nom de son jeton. Le jour où un jeton change, personne ne les
trouve.

C'est la même maladie que celle soignée le même jour sur `courrier-matin` : **quelque chose de
vivant en production dont le dépôt ne sait rien.** Là-bas c'était un verrou d'entrée déployé sans
être commité. Ici, deux textes que le produit envoie à ses utilisateurs.

**Donc l'ordre est : on modifie le fichier, on relit, puis on colle dans le tableau de bord.**
Jamais l'inverse. Une modification faite directement dans Supabase est invisible pour toujours.

## Le jeton copié en dur

Une seule couleur, dans les deux fichiers :

| Valeur en dur | Jeton de la charte |
|---------------|--------------------|
| `#63523D`     | `--muted`          |

Même règle que le bloc `C` de `src/js/bdv-courrier.js`, et même raison : une messagerie ne charge
pas de feuille de style externe et ne connaît pas `var(--muted)`. La différence est qu'ici le
commentaire ne peut pas vivre à côté de la valeur sans partir dans le mail, donc il vit dans ce
tableau.

Le reste est en style de ligne sans couleur : pas de police web, pas de dégradé, pas d'image.

## Ce qui reste à vérifier sur ces deux textes

- **« Il expire dans dix minutes », écrit dans les deux.** À faire correspondre au réglage réel,
  Authentication → Sign In / Providers → Email. Le défaut de Supabase n'est pas dix minutes. Si le
  mail annonce plus court que le vrai, un vigneron revenu au bout de vingt minutes croit son code
  mort, en redemande un, et consomme un e-mail du quota de cent par jour pour rien.
- **Deux voix pour la même instruction.** L'inscription dit « la fenêtre restée ouverte sur ton
  écran », la reprise dit « la fenêtre du Bureau du Vigneron ». Les deux supposent qu'une fenêtre
  existe sur l'écran où le mail est lu, ce que le cas le plus banal démentit : inscription sur
  l'ordinateur, mail relevé sur le téléphone. Un message qui affirme quelque chose que la situation
  dément coûte plus cher qu'un message vague — c'est le même mécanisme que « SANS CONTACT » affiché
  pour un client qui a une adresse.

## Ce qu'ils ne contiennent pas, et c'est vérifié

Ni lien, ni `{{ .SiteURL }}`, ni `{{ .ConfirmationURL }}`. Uniquement `{{ .Token }}`, un code à six
chiffres tapé dans la page. Le site les valide par `/verify` avec `type: 'signup'` puis
`type: 'recovery'` (voir `src/js/bdv-compte.js`), sans jamais passer de redirection.

C'est pour cette raison que `Site URL` a pu rester sur `http://localhost:3000` sans que personne
s'en aperçoive : aucun de ces deux parcours ne le consomme. Le réglage a quand même été posé sur
l'adresse définitive, parce qu'un parcours futur qui passerait une redirection y retomberait en
silence.
