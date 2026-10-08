/* ===========================================================================
   LE BUREAU DU VIGNERON — LES CANAUX DE CONTACT
   ===========================================================================
   La liste des moyens de communication, ecrite UNE FOIS et lue partout.

   Pourquoi ce fichier existe. Avant lui, la meme information etait recopiee a huit
   endroits : les trois gestes de la file, dans bdv-crm.js ET dans le tableau de bord ;
   le deducteur de canal de noter(), dans les deux fichiers aussi ; les boutons de type
   de la saisie, deux fois ; les libelles du fil, deux fois. Ces huit listes avaient
   deja commence a diverger : un « Message » enregistre depuis la fiche du bureau etait
   classe canal E-mail, le meme geste pose depuis la file etait classe Telephone.
   Personne ne voyait rien, et c'est exactement ce qui rend ce genre d'ecart couteux.

   Il se charge SANS `defer`, avant tout le reste. Le script en ligne du tableau de bord
   et celui de mon-bureau.njk s'executent pendant l'analyse du document, donc avant les
   modules differes : une liste lue au chargement depuis un fichier differe serait
   toujours vide. Le fichier pese quelques kilo-octets, le cout est nul.

   CE QUI EST STOCKE EN BASE, c'est la CLE du canal ('sms', 'caveau'), jamais son
   libelle. Un libelle stocke fige la formulation : le jour ou « Reçu au caveau » devient
   « Passe au caveau », la base porte deux orthographes du meme geste et rien ne permet
   de les rapprocher. Les valeurs historiques 'Téléphone' et 'E-mail', ecrites avant ce
   fichier, restent lisibles : voir ANCIENS.

   Ne pas confondre avec le CANAL DE VENTE du tableau de bord (`_canal`, normCanal),
   qui vient du fichier d'export et dit par quel circuit une bouteille a ete vendue.
   Ici on parle de la maniere dont on a parle a un client.
   =========================================================================== */
(function () {
  'use strict';

  // `type` regroupe grossierement, et ne sert qu'a compter et a choisir une icone de
  // repli. `jours` est le report de rappel que ce canal suggere : un appel decroche
  // laisse tranquille un mois, un message sans reponse se relance dans la semaine.
  var CANAUX = [
    // ---- Telephone et ecrit : le socle, 90 % des gestes reels ----
    { cle: 'appel',       label: 'Appel',                ico: '☎', type: 'appel',    groupe: 'Téléphone et écrit', jours: 30 },
    { cle: 'repondeur',   label: 'Répondeur',            ico: '☎', type: 'message',  groupe: 'Téléphone et écrit', jours: 7 },
    { cle: 'sms',         label: 'SMS',                  ico: '✉', type: 'message',  groupe: 'Téléphone et écrit', jours: 7 },
    { cle: 'email',       label: 'E-mail',               ico: '✉', type: 'message',  groupe: 'Téléphone et écrit', jours: 10 },
    { cle: 'note',        label: 'Note interne',         ico: '✎', type: 'note',     groupe: 'Téléphone et écrit', jours: 0 },
    // ---- Sur le terrain : ce qui compte le plus chez un vigneron ----
    { cle: 'visite',      label: 'Visite au domaine',    ico: '⚑', type: 'visite',   groupe: 'Sur le terrain',     jours: 60 },
    { cle: 'caveau',      label: 'Reçu au caveau',       ico: '⚑', type: 'visite',   groupe: 'Sur le terrain',     jours: 45 },
    { cle: 'salon',       label: 'Salon ou dégustation', ico: '⚑', type: 'visite',   groupe: 'Sur le terrain',     jours: 21 },
    { cle: 'rdv',         label: 'Rendez-vous chez lui', ico: '⚑', type: 'visite',   groupe: 'Sur le terrain',     jours: 30 },
    // ---- Messageries ----
    { cle: 'whatsapp',    label: 'WhatsApp',             ico: '✉', type: 'message',  groupe: 'Messageries',        jours: 7 },
    { cle: 'linkedin',    label: 'LinkedIn',             ico: '✉', type: 'message',  groupe: 'Messageries',        jours: 14 },
    { cle: 'visio',       label: 'Visio',                ico: '☎', type: 'appel',    groupe: 'Messageries',        jours: 30 },
    // ---- Papier et envoi ----
    { cle: 'courrier',    label: 'Courrier postal',      ico: '✉', type: 'courrier', groupe: 'Papier et envoi',    jours: 21 },
    { cle: 'echantillon', label: 'Échantillon envoyé',   ico: '⚑', type: 'envoi',    groupe: 'Papier et envoi',    jours: 14 }
  ];

  // Ce que la base porte deja, ecrit avant l'existence de ce fichier. Ces valeurs ne
  // sont plus jamais ECRITES, seulement LUES : une entree d'hier doit rester lisible.
  var ANCIENS = {
    'Téléphone': 'appel',
    'Telephone': 'appel',
    'E-mail': 'email',
    'Email': 'email'
  };

  // Repli quand une entree ne porte pas de canal du tout : les toutes premieres
  // entrees du journal n'avaient qu'un `type`.
  var TYPES = {
    appel:    { label: 'Appel',    ico: '☎' },
    message:  { label: 'Message',  ico: '✉' },
    visite:   { label: 'Visite',   ico: '⚑' },
    courrier: { label: 'Courrier', ico: '✉' },
    envoi:    { label: 'Envoi',    ico: '⚑' },
    note:     { label: 'Note',     ico: '✎' },
    ecarte:   { label: 'Écarté',   ico: '⌛' }
  };

  var PAR_CLE = {};
  CANAUX.forEach(function (c) { PAR_CLE[c.cle] = c; });

  // Les groupes dans l'ordre de declaration, pas dans l'ordre alphabetique : le socle
  // en premier parce que c'est ce qu'on choisit quinze fois par jour.
  var GROUPES = [];
  CANAUX.forEach(function (c) {
    if (GROUPES.indexOf(c.groupe) === -1) GROUPES.push(c.groupe);
  });

  // Resout une valeur de colonne `canal` en canal connu. Rend null si on ne sait pas :
  // inventer un canal serait pire que de n'en afficher aucun.
  function canal(v) {
    if (!v) return null;
    var s = String(v);
    return PAR_CLE[s] || PAR_CLE[ANCIENS[s]] || null;
  }

  // Le libelle a montrer pour une entree du journal. Le canal fait foi quand il est
  // connu ; sinon le type ; sinon la valeur brute, qui vaut toujours mieux que « null ».
  function libelleEntree(e) {
    if (!e) return '';
    var c = canal(e.canal);
    if (c) return c.label;
    if (e.type && TYPES[e.type]) return TYPES[e.type].label;
    return String(e.canal || e.type || '');
  }
  function icoEntree(e) {
    if (!e) return TYPES.note.ico;
    var c = canal(e.canal);
    if (c) return c.ico;
    if (e.type && TYPES[e.type]) return TYPES[e.type].ico;
    return TYPES.note.ico;
  }
  // Pour la colonne « Canal » du tableau des clients, qui affiche `suivi_clients.canal`.
  function libelle(v) {
    var c = canal(v);
    return c ? c.label : (v ? String(v) : '');
  }
  function type(cle) {
    var c = PAR_CLE[cle];
    return c ? c.type : 'note';
  }
  function jours(cle) {
    var c = PAR_CLE[cle];
    return (c && c.jours) || 0;
  }

  /* LES PICTOS DE L'HISTORIQUE, LOT 84 (08/10/2026). Demande de Ted : « historique revisite
     avec des pictos en fonction des outils utilises ». Un dessin par canal, au trait, de la
     couleur du texte (`currentColor`), cache a la synthese vocale : le LIBELLE dit deja le
     canal en mots. Les dessins sont les notres, aucun logo de marque (ni WhatsApp ni LinkedIn :
     une bulle et une carte de visite). `icoEntree` garde ses caracteres, lus ailleurs en texte. */
  var TRAITS = {
    appel:       '<path d="M5 3h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    repondeur:   '<circle cx="6.5" cy="12" r="3.5"/><circle cx="17.5" cy="12" r="3.5"/><path d="M6.5 15.5h11"/>',
    bulle:       '<path d="M4 5h16v10H9l-5 4z"/>',
    email:       '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 6 9 7 9-7"/>',
    note:        '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    visite:      '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
    verre:       '<path d="M7 3h10l-1 7a4 4 0 0 1-8 0z"/><path d="M12 14v6M8 21h8"/>',
    carte:       '<rect x="3" y="6" width="18" height="12" rx="1"/><circle cx="8.5" cy="11" r="2"/><path d="M6 15.5c.8-1.2 4.2-1.2 5 0M14 10h4M14 13h3"/>',
    visio:       '<rect x="3" y="7" width="12" height="10" rx="1"/><path d="m15 11 6-3v8l-6-3"/>',
    courrier:    '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 13h6M9 16h4"/>',
    echantillon: '<path d="M10 3h4v4l1.5 2.5V21h-7V9.5L10 7z"/><path d="M8.5 13h7"/>',
    ecarte:      '<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>',
    programme:   '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>'
  };
  var PICTO_DE = { appel: 'appel', repondeur: 'repondeur', sms: 'bulle', whatsapp: 'bulle', linkedin: 'carte',
    email: 'email', note: 'note', visite: 'visite', rdv: 'visite', caveau: 'verre', salon: 'verre', visio: 'visio',
    courrier: 'courrier', echantillon: 'echantillon', message: 'email', envoi: 'echantillon', ecarte: 'ecarte', programme: 'programme' };
  function pictoEntree(e) {
    var c = e ? canal(e.canal) : null;
    var k = (c && PICTO_DE[c.cle]) || (e && PICTO_DE[e.canal]) || (e && PICTO_DE[e.type]) || 'note';
    return '<svg class="picto picto--' + k + '" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"'
      + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + TRAITS[k] + '</svg>';
  }

  // Un <select> groupe, construit en DOM et jamais en chaine HTML : les libelles sont
  // les notres, mais la regle du projet est qu'aucune valeur ne rentre dans un innerHTML
  // sans raison, et une exception ici deviendrait la regle ailleurs.
  function remplirSelect(sel, cleChoisie) {
    if (!sel) return sel;
    sel.textContent = '';
    GROUPES.forEach(function (g) {
      var og = document.createElement('optgroup');
      og.label = g;
      CANAUX.forEach(function (c) {
        if (c.groupe !== g) return;
        var o = document.createElement('option');
        o.value = c.cle;
        o.textContent = c.label;
        if (c.cle === cleChoisie) o.selected = true;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    return sel;
  }

  window.BdvCanaux = {
    liste: CANAUX,
    groupes: GROUPES,
    types: TYPES,
    canal: canal,
    libelle: libelle,
    libelleEntree: libelleEntree,
    icoEntree: icoEntree,
    pictoEntree: pictoEntree,
    type: type,
    jours: jours,
    remplirSelect: remplirSelect,
    // Le canal choisi par defaut a la saisie. Un seul endroit pour en changer d'avis.
    DEFAUT: 'appel'
  };
})();
