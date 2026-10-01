/* LE FICHIER DE COMMANDE VITISOFT, lot 49, 01/10/2026.
   PUR : (devis, lignes) -> { nom, texte }. Aucun acces au DOM, aucune requete. Le
   telechargement est fait par bdv-devis.js ; ce fichier ne fait que FABRIQUER.

   LE FORMAT EST CELUI DE LA SECTION 3 DE CAHIER_script-vitisoft.md, confirme par Ted :
   38 colonnes lues PAR POSITION (24 au lot 49, plus 14 de livraison au lot 53), une rangee par ligne du devis, les colonnes 1 a 18
   repetees sur chaque rangee. Regles de la doc Vitisoft (Import de commandes) :
   point-virgule, point decimal, UTF-8, fin de ligne CR+LF, AUCUN guillemet, date
   AAAA-MM-JJ HH:MM:SS, premiere ligne = titres.

   TROIS CHOSES A NE PAS DEFAIRE :
   1. Colonne 1 et colonne 3 = le NUMERO DU DEVIS (D-AAAA-NNNN). Vitisoft refuse une
      commande deja integree (erreur 12) : re-telecharger ne cree rien deux fois, et la
      colonne 3 revient dans l'export de ventes (44e colonne) pour relier la facture.
   2. Colonne 23 = `pu_f_c`, le prix SIGNE (remises de ligne ET globale deduites), et
      colonne 24 = `final_c` = quantite x colonne 23, exact par construction (lot 47).
   3. Aucun champ ne porte `;`, `"`, ni retour a la ligne : la doc interdit les
      guillemets, donc un `;` dans un nom decalerait toutes les colonnes suivantes. On
      remplace `;` par `,` et on retire le reste, au lieu de refuser le fichier. */
(function () {
  var TITRES = ['numéro_commande', 'date_heure_commande', 'référence_commande_client', 'numéro_client',
    'adresse_email', 'société_facturation', 'nom_facturation', 'prénom_facturation', 'adresse1_facturation',
    'adresse2_facturation', 'code_postal_facturation', 'ville_facturation', 'pays_facturation',
    'téléphone_facturation', 'mobile_facturation', 'mode_de_facturation', 'code_tarif', 'commentaire',
    'numéro_ligne', 'numéro_produit', 'désignation', 'quantité', 'prix_unitaire', 'total_ht_ligne',
    /* LOT 53 : la livraison, A LA FIN (colonnes 25 a 38). Rien ne bouge avant. */
    'civilité_livraison', 'nom_livraison', 'prénom_livraison', 'adresse1_livraison', 'adresse2_livraison',
    'adresse3_livraison', 'code_postal_livraison', 'ville_livraison', 'pays_livraison', 'téléphone_livraison',
    'mobile_livraison', 'transporteur', 'commentaire_livraison', 'montant_livraison'];

  function champ(v) {
    return String(v == null ? '' : v).replace(/["“”]/g, '').replace(/;/g, ',')
      .replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  }
  function prix(c) {
    var n = Number(c);
    if (!isFinite(n) || n < 0 || Math.round(n) !== n) throw new Error('prix illisible');
    return Math.floor(n / 100) + '.' + String(n % 100).padStart(2, '0');
  }
  /* L'HEURE DE PARIS, et jamais `Number()` sur un format francais (regle du 10/09/2026) :
     locale en-GB, puis on ne garde que les chiffres de chaque morceau. */
  function parties(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) throw new Error('date illisible');
    var f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    var o = {};
    f.formatToParts(d).forEach(function (p) { if (p.type !== 'literal') o[p.type] = p.value.replace(/\D/g, ''); });
    return o;
  }
  function dateHeure(iso) {
    var p = parties(iso);
    return p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute + ':' + p.second;
  }
  function jourFr(iso) { var p = parties(iso); return p.day + '/' + p.month + '/' + p.year; }

  /* CE QUI EMPECHE UN FICHIER IMPORTABLE. La base refuse les memes cas (devis_accepter) ;
     l'ecran les dit AVANT, en nommant le vin ou le client. */
  function manques(d, lignes) {
    var m = [];
    var sans = (lignes || []).filter(function (l) { return !champ(l.num_produit); });
    if (sans.length) m.push({ quoi: 'produit', vins: sans.map(function (l) { return champ(l.designation) || 'un vin'; }) });
    var a = (d && d.acheteur) || {};
    if (!a.nouveau && !champ(d && d.num_client) && !champ(a.num_client) && !champ(a.email)) m.push({ quoi: 'client' });
    if (!(lignes || []).length) m.push({ quoi: 'vide' });
    return m;
  }

  /* LOT 53 : LA LIVRAISON, colonnes 25 a 38, repetees sur chaque rangee comme la tete.
     - A l'adresse du client (ou devis d'avant le lot) : bloc vide, Vitisoft reprend
       l'adresse de facturation.
     - Retrait au domaine : bloc vide, et « Enlèvement au domaine » en commentaire.
     - La date souhaitee n'a pas de colonne chez Vitisoft : elle va dans le commentaire.
     - montant_livraison vide quand il n'y a pas de port : avec un montant, Vitisoft exige un
       « Produit pour transport » dans sa configuration (erreur 7). */
  function livraison(d) {
    var mode = d.livraison_mode || 'client', a = (mode === 'adresse' && d.livraison) || {};
    var j = d.livraison_souhaitee ? jourFr(d.livraison_souhaitee + 'T12:00:00Z') : '';
    var com = mode === 'retrait' ? 'Enlèvement au domaine' + (j ? ', prévu le ' + j : '')
      : (j ? 'Livraison souhaitée le ' + j : '');
    var port = Number(d.port_c) || 0;
    return ['', a.nom, '', a.adresse1, a.adresse2, '', a.code_postal, a.ville,
      mode === 'adresse' ? (a.pays || 'France') : '', a.telephone, '',
      mode === 'retrait' ? '' : d.transporteur, com, port > 0 ? prix(port) : ''].map(champ);
  }

  function fabriquer(d, lignes) {
    if (!d || d.statut !== 'accepte' || !d.accepte_le) throw new Error('devis non accepte');
    if (manques(d, lignes).length) throw new Error('devis incomplet');
    var a = d.acheteur || {};
    var nouveau = !!a.nouveau;
    var tete = [
      d.numero, dateHeure(d.accepte_le), d.numero,
      nouveau ? '' : (d.num_client || a.num_client || ''),
      a.email, a.nom, (nouveau && a.contact_nom) || a.nom, '',
      a.adresse, '', a.code_postal, a.ville, a.pays, a.telephone, '',
      'HT', d.code_tarif || '',
      'Devis ' + d.numero + ' accepté le ' + jourFr(d.accepte_le)
    ].map(champ);
    var liv = livraison(d);
    var rangs = (lignes || []).slice().sort(function (x, y) { return x.rang - y.rang; });
    var rangees = [TITRES.join(';')].concat(rangs.map(function (l, i) {
      return tete.concat([String(i + 1), champ(l.num_produit), champ(l.designation), String(l.quantite),
        prix(l.pu_f_c), prix(l.final_c)]).concat(liv).join(';');
    }));
    return { nom: 'commande-' + champ(d.numero) + '.csv', texte: rangees.join('\r\n') + '\r\n' };
  }

  var api = { fabriquer: fabriquer, manques: manques, titres: TITRES.slice(), _champ: champ, _prix: prix, _dateHeure: dateHeure,
              _livraison: livraison };
  if (typeof window !== 'undefined') window.BdvCommande = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
