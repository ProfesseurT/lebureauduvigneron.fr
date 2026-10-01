# Cahier des charges : le script Vitisoft pour Le Bureau du Vigneron

Version du 28/09/2026. Rédigé pour l'équipe Solumatic qui développe les scripts Vitisoft.
Contact : Teddy Pereira.

## Pourquoi ce script

Le Bureau du Vigneron gère les affaires commerciales d'un domaine (prospection, devis, signature
du client). Quand une affaire est gagnée, le bureau fabrique un fichier de commande que le vigneron
importe dans Vitisoft avec le module « Import de commandes ». Vitisoft facture ensuite comme
d'habitude.

Il manque deux choses pour boucler la boucle, et un seul script peut les fournir :

1. **Retrouver la facture d'une affaire** dans l'export de ventes : la référence de la commande
   importée doit y apparaître.
2. **Connaître le catalogue et les tarifs** du domaine, pour que les devis du bureau partent avec
   les bons produits et les bons prix.

## 1. L'export de ventes : une 44e colonne

L'export de ventes actuel compte 43 colonnes, de « Date » à « Mobile ». Le bureau le lit **par
position** : une colonne insérée au milieu décale toutes les suivantes et fausse les chiffres sans
aucun message d'erreur.

**La règle impérative : la nouvelle colonne s'ajoute en 44e position, à la fin, après « Mobile ».
Aucune colonne existante ne bouge, ne change de nom ni de format.**

| Position | Titre | Contenu |
|---|---|---|
| 44 | Référence commande client | La valeur de `référence_commande_client` de la commande importée dont vient la facture. Vide pour une facture qui ne vient pas d'une commande importée. |

La référence est répétée sur chaque ligne de la facture, comme le sont déjà le numéro de facture et
le numéro client. Le format du reste du fichier ne change pas : séparateur `;`, encodage
Windows-1252, une ligne d'en-tête.

**Questions à trancher côté Solumatic :**
- La référence de la commande est-elle conservée quand la commande est transformée en facture ?
- Si plusieurs commandes sont transformées en une seule facture, quelle référence porter ?
  Proposition : les références séparées par une barre verticale `|`.

## 2. Le fichier catalogue et tarifs

Un fichier à part, produit en même temps que l'export de ventes.

- Format : CSV, séparateur `;`, encodage Windows-1252, une ligne d'en-tête, nombres écrits comme
  dans l'export de ventes actuel.
- **Une ligne par produit et par code tarif.** Un produit sans aucun tarif paramétré apparaît sur
  une ligne avec le code tarif vide.
- **Tous les produits actifs**, y compris ceux qui n'ont jamais été vendus (un nouveau millésime
  doit pouvoir être proposé avant sa première facture). Les produits inactifs peuvent être omis ou
  marqués `0` dans la colonne « Actif ».
- Lu lui aussi par position : même règle, les colonnes ne bougent plus une fois livrées, et toute
  colonne future s'ajoute à la fin.

| Position | Titre | Contenu |
|---|---|---|
| 1 | Numéro Produit | Le numéro produit Vitisoft, celui que l'import de commandes attend. |
| 2 | Produit | La désignation. |
| 3 | Famille de produit | Comme dans l'export de ventes. |
| 4 | Conditionnement | Comme dans l'export de ventes. |
| 5 | Appellation | Comme dans l'export de ventes. |
| 6 | Couleur | Comme dans l'export de ventes. |
| 7 | Millésime | Comme dans l'export de ventes. |
| 8 | Actif | `1` actif, `0` inactif. |
| 9 | Code tarif | Le code tarif Vitisoft. Vide si le produit n'a aucun tarif. |
| 10 | Prix unitaire HT | Le prix de ce produit pour ce code tarif, **droits d'accises inclus**. |
| 11 | Taux TVA | En pourcentage, par exemple `20`. |
| 12 | Mis à jour le | Date de dernière modification du tarif, `JJ/MM/AAAA`. |

## 3. La configuration d'import de commandes à poser une fois

Le fichier de commande fabriqué par le bureau suivra l'ordre ci-dessous. La configuration Vitisoft
(Configuration, Configuration générale, onglet Commandes, onglet Import de commandes) doit donc
porter ces numéros de colonne. **Confirmée par Ted le 01/10/2026** (lot 49, qui fabrique ce fichier :
`src/js/bdv-commande.js`, gardé par `npm run banc:commande`).

| Colonne | Donnée Vitisoft | Remarque |
|---|---|---|
| 1 | numéro_commande | Le numéro du devis (D-AAAA-NNNN), unique. Vitisoft refuse un doublon (erreur 12). |
| 2 | date_heure_commande | `AAAA-MM-JJ HH:MM:SS`. |
| 3 | référence_commande_client | Le numéro du devis (D-AAAA-NNNN), celui qu'on retrouvera en 44e colonne : il mène à l'affaire. |
| 4 | numéro_client | Vide pour un nouveau client : Vitisoft le crée. |
| 5 | adresse_email | Toujours renseignée. |
| 6 | société_facturation | Raison sociale du client pro. |
| 7 | nom_facturation | Obligatoire pour un nouveau client. |
| 8 | prénom_facturation | |
| 9 | adresse1_facturation | |
| 10 | adresse2_facturation | |
| 11 | code_postal_facturation | |
| 12 | ville_facturation | |
| 13 | pays_facturation | |
| 14 | téléphone_facturation | |
| 15 | mobile_facturation | |
| 16 | mode_de_facturation | `HT` pour un professionnel. |
| 17 | code_tarif | Le code tarif choisi pour le client. |
| 18 | commentaire | « Devis D-AAAA-NNNN accepté le JJ/MM/AAAA ». |
| 19 | numéro_ligne | |
| 20 | numéro_produit | |
| 21 | désignation | |
| 22 | quantité | |
| 23 | prix_unitaire | **Le prix signé par le client**, remise déduite. |
| 24 | total_ht_ligne | |
| 25 | civilité_livraison | Toujours vide. |
| 26 | nom_livraison | Le destinataire, quand le vin part à une autre adresse. |
| 27 | prénom_livraison | Toujours vide. |
| 28 | adresse1_livraison | |
| 29 | adresse2_livraison | Le complément d'adresse. |
| 30 | adresse3_livraison | Toujours vide. |
| 31 | code_postal_livraison | |
| 32 | ville_livraison | |
| 33 | pays_livraison | |
| 34 | téléphone_livraison | |
| 35 | mobile_livraison | Toujours vide. |
| 36 | transporteur | Créé à la volée par Vitisoft s'il n'existe pas. Vide pour un retrait au domaine. |
| 37 | commentaire_livraison | « Livraison souhaitée le JJ/MM/AAAA », ou « Enlèvement au domaine » (avec la date prévue s'il y en a une). |
| 38 | montant_livraison | Les frais de port HT. Vide s'il n'y en a pas. |

**Colonnes 25 à 38, ajoutées le 01/10/2026 (lot 53), À LA FIN** : les 24 premières ne bougent pas.
Les colonnes 25 à 35 sont VIDES quand le vin part à l'adresse du client ou quand il vient le
chercher au domaine : Vitisoft reprend alors l'adresse de facturation. La configuration déjà posée
doit recevoir ces 14 numéros de colonne.

Réglages de la configuration : première ligne = titres (coché), mode de facturation par défaut `HT`,
format de date `AAAA-MM-JJ HH:MM:SS`, et un **« Produit pour transport »** renseigné : sans lui,
Vitisoft refuse toute commande qui porte des frais de port (erreur 7). Ce produit porte le taux de
TVA du port : 20 %, comme le devis. Le fichier respectera les règles de la doc (point-virgule, point
décimal, UTF-8, CR+LF, aucun guillemet) et sera contrôlé avec le vérificateur de la section 13 de
la doc avant chaque livraison.

**Une question :** avec un `prix_unitaire` renseigné, Vitisoft facture-t-il bien ce prix, ou
réapplique-t-il le tarif du client ? Le bureau a besoin que le prix signé soit celui facturé.

## 4. Comment le vigneron s'en sert

1. Il dépose l'export de ventes et le fichier catalogue dans son bureau, comme il dépose l'export
   aujourd'hui.
2. Pour une affaire gagnée, il télécharge le fichier de commande depuis le bureau et l'importe dans
   Vitisoft (Commandes/BL, menu Outils, Importer des commandes).
3. Il facture dans Vitisoft. Au dépôt suivant de l'export, le bureau relie la facture à l'affaire
   grâce à la 44e colonne.
