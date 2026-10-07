/* ============================================================================
   src/js/bdv-mails-affaire.js : les mails tout faits d'une affaire, lot 72, 06/10/2026

   Demande de Ted : « un outil de creation d'email dans les affaires, comme pour les
   echanges (memes principes que les clients) », avec une bibliotheque de textes dont un
   qui porte le lien de signature du devis (grise s'il n'y en a pas).

   CE FICHIER NE FAIT QU'ECRIRE DU TEXTE. Il ne lit rien, n'ecrit rien, ne touche pas au
   DOM : on lui passe ce que l'affaire sait (`ctx`), il rend un objet, un texte, la liste
   des blocs et le modele a proposer, avec la raison du choix. C'est ce qui le rend
   verifiable par un banc sans navigateur. bdv-affaires.js le charge a la premiere
   ouverture d'un redacteur.

   Conseil (vigneron empathique + expert commercial, 06/10/2026), et ce qu'il ne faut pas
   defaire :
   - le modele est CHOISI pour le vigneron, et la raison est ecrite ;
   - une relance ne recopie pas le montant par defaut (elle sonnerait comme une facture) ;
   - jamais « expire » ni « dernier delai » dans un mail au client : « je peux vous le
     remettre a jour » ;
   - le montant et la date de validite se LISENT dans le devis vivant a chaque
     composition : un texte qui cite un devis remplace ment au client ;
   - toujours « HT » ; pas de montant si le devis n'a pas de total ;
   - vouvoiement, aucun reproche, aucun delai chiffre, une seule offre par mail ;
   - le lien de signature n'est JAMAIS invente : sans lien vivant, le bloc est grise et
     l'ecran propose le geste qui le cree.

   ctx = {
     contact: 'Jean Dupont' | '',      le nom de l'interlocuteur, s'il est connu
     domaine: 'Domaine X' | '',        le nom du domaine (Mon domaine)
     aujourdhui: 'AAAA-MM-JJ',
     devis: null | { numero, version, statut, total_ht_c, valable_jusqu, envoye_le,
                     url: '' | 'https://…/signer/#…', lienEtat: 'jeton'|'ancien'|'aucun'|undefined },
     journal: [{ type, modele, le }],   les mails et notes de l'affaire (plus recent d'abord)
     dernierEchange: 'AAAA-MM-JJ…' | null   le dernier echange NOTE (appel, visite…), pas un mail
     degustation: 'AAAA-MM-JJ…' | null      le dernier echange note « echantillon » ou « salon »
     LOT 73 :
     piste: true | false,              un nouveau client (pas encore dans Vitisoft)
     nature: 'caviste'|'restaurant'|'importateur'|'ce'|'particulier'|'autre'|'',  celle de la piste
     famille: 'conquete'|'evenement'|'client'|'',   la famille du type d'affaire
     etape: 'Rendez-vous' | '',  etape_le: 'AAAA-MM-JJ' | null,   l'etape en cours, depuis quand
     issue: 'en_cours'|'gagnee'|'perdue',  close_le: 'AAAA-MM-JJ' | null,  motif: 'prix'|… | null
     devis (en plus) : accepte_le, signe_le ('AAAA-MM-JJ' | null), livraison_mode, livraison_souhaitee
   }

   LOT 73 (07/10/2026) : six modeles de plus, premier contact, rendez-vous, evenement,
   reponse sur le prix, merci pour la commande, pas pour cette fois. Et le rappel a poser
   apres un mail se decide ICI (`rappel()`), plus dans bdv-affaires.js : un seul endroit
   sait quel mail se relance, et sous quel motif.
   ============================================================================ */
(function () {
  'use strict';

  /* Dans l'ordre d'une affaire : on se presente, on se voit, on fait gouter, on chiffre,
     on relance, on remercie ou on se quitte bien. */
  var MODELES = [
    { k: 'premier_contact', nom: 'Premier contact' },
    { k: 'evenement', nom: 'Une demande pour un événement' },
    { k: 'rendez_vous', nom: 'Proposer un rendez-vous' },
    { k: 'degustation', nom: 'Dégustation, échantillons' },
    { k: 'relance_degustation', nom: 'Relance après la dégustation' },
    { k: 'suite', nom: 'Suite à notre échange' },
    { k: 'devis', nom: 'Envoi du devis à signer' },
    { k: 'relance_devis', nom: 'Relance du devis' },
    { k: 'objection_prix', nom: 'Réponse sur le prix' },
    { k: 'merci_commande', nom: 'Merci pour la commande' },
    { k: 'pas_pour_cette_fois', nom: 'Pas pour cette fois' },
    { k: 'libre', nom: 'Mail libre' }
  ];
  /* Le rappel que propose « Considere comme envoye », par modele : le motif ecrit sur
     l'affaire, dans combien de jours, et la phrase de la case. Conseil du 07/09/2026 (lot
     73) : UN MAIL QUI PROMET UNE SUITE POSE SON RAPPEL, sinon le bureau fait promettre au
     vigneron ce qu'il ne tiendra pas. Le merci et le « pas pour cette fois » sont dans
     `rappel()` : leur date depend de la livraison ou d'un bloc coche. */
  var RAPPELS = {
    premier_contact: ['Relancer le premier contact', 7],
    evenement: ['Relancer la demande d’événement', 7],
    rendez_vous: ['Confirmer le rendez-vous', 3],
    degustation: ['Relancer après la dégustation', 7],
    relance_degustation: ['Relancer après la dégustation', 7],
    objection_prix: ['Relancer après sa remarque sur le prix', 7],
    relance_devis: ['Relancer le devis', 7]
  };
  /* « au nom du Domaine X », « de la Maison Y », « de EARL Dupont » : l'article qu'un
     humain mettrait devant la raison sociale. */
  var ARTICLES = [[/^(domaine|château|chateau|clos|mas|vignoble|cellier|moulin)\b/i, 'du '], [/^(vignobles|caves)\b/i, 'des '],
    [/^(maison|cave|famille|cuverie|bergerie)\b/i, 'de la '], [/^(earl|scea|gaec|sarl|sas|sasu|sca|sci|eurl|sa)\b/i, 'de l’'], [/^[aeiouyhéèâ]/i, 'd’']];
  function deDomaine(dom) {
    var d = String(dom || '').trim();
    for (var i = 0; i < ARTICLES.length; i++) if (ARTICLES[i][0].test(d)) return ARTICLES[i][1] + d;
    return 'de ' + d;
  }
  /* Ou finissent les vins, selon la nature de la piste : l'accroche du premier contact. */
  var PLACE = { caviste: 'dans votre cave', restaurant: 'à votre carte', importateur: 'dans votre catalogue', ce: 'pour votre comité d’entreprise' };
  /* Au-dela, un lien mailto se fait couper par certaines messageries : l'ecran le dit. */
  var MAX_MAILTO = 1800;
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function versDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function joursEntre(a, b) {
    var x = versDate(a), y = versDate(b);
    return x && y ? Math.round((y - x) / 86400000) : null;
  }
  function dateLettre(s) {
    var d = versDate(s);
    return d ? (d.getUTCDate() === 1 ? '1er' : d.getUTCDate()) + ' ' + MOIS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() : '';
  }
  function euros(c) {
    var n = Number(c);
    if (!isFinite(n) || n <= 0) return '';
    var e = Math.floor(Math.round(n) / 100), cts = String(Math.round(n) % 100).padStart(2, '0');
    return String(e).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + cts + ' € HT';
  }
  /* Deux creneaux, jamais « quand vous voulez » (expert commercial) : le premier jour
     ouvre apres aujourd'hui a 10 h, et deux jours ouvres plus tard a 16 h. Le texte reste
     modifiable : ce sont des propositions, pas un agenda. */
  function ouvreApres(d, n) {
    var x = new Date(d.getTime());
    while (n > 0) { x = new Date(x.getTime() + 86400000); if (x.getUTCDay() !== 0 && x.getUTCDay() !== 6) n--; }
    return x;
  }
  /* Lot 73 : un restaurant est en service a 10 h ; on lui propose l'apres-midi, 15 h ou 16 h.
     Et le premier moment est a DEUX jours ouvres de l'envoi (vigneron, 07/10/2026) : un mail
     lu le soir ne doit pas proposer un rendez-vous deja passe. */
  function premierCreneau(aujourdhui) { return ouvreApres(versDate(aujourdhui) || versDate(new Date().toISOString()), 2); }
  function creneaux(aujourdhui, nature) {
    var d1 = premierCreneau(aujourdhui), d2 = ouvreApres(d1, 2), resto = nature === 'restaurant';
    function dit(x, h) { return JOURS[x.getUTCDay()] + ' ' + (x.getUTCDate() === 1 ? '1er' : x.getUTCDate()) + ' ' + MOIS[x.getUTCMonth()] + ' à ' + h + ' h'; }
    return dit(d1, resto ? 15 : 10) + ' ou ' + dit(d2, 16);
  }
  function plusJours(isoJour, n) { var d = versDate(isoJour); return d ? iso(new Date(d.getTime() + n * 86400000)) : ''; }
  function version(dv) { var v = Number(dv && dv.version); return v >= 1 ? v : 1; }
  function expire(dv, auj) { return !!(dv && dv.statut === 'envoye' && dv.valable_jusqu && String(dv.valable_jusqu) < auj); }
  function mails(ctx) { return (ctx.journal || []).filter(function (e) { return e && e.type === 'email'; }); }

  /* Ce qui empeche un modele : '' s'il est utilisable, la raison sinon. */
  function dispo(k, ctx) {
    var dv = ctx.devis, auj = ctx.aujourdhui;
    if (k === 'devis') {
      if (!dv) return 'pas de devis dans cette affaire';
      if (dv.statut === 'accepte') return 'le devis est déjà accepté';
      if (dv.statut !== 'envoye' && dv.statut !== 'enregistre') return 'pas de devis en cours';
      if (expire(dv, auj)) return 'le devis est arrivé à son terme : relance-le';
      return '';
    }
    if (k === 'relance_devis') return dv && dv.statut === 'envoye' ? '' : 'pas de devis envoyé';
    if (k === 'merci_commande') return dv && dv.statut === 'accepte' ? '' : 'pas de devis accepté';
    if (k === 'premier_contact' && ctx.piste === false) return 'c’est déjà ton client';
    if (k === 'pas_pour_cette_fois' && ctx.issue === 'gagnee') return 'l’affaire est gagnée';
    return '';
  }
  function jourDe(x) { return String(x || '').slice(0, 10); }
  /* Un mail de ces modeles ecrit depuis `depuis` (inclus) : on ne propose pas deux fois le meme. */
  function ecritDepuis(ctx, modeles, depuis) {
    return mails(ctx).some(function (e) { return modeles.indexOf(e.modele) >= 0 && (!depuis || jourDe(e.le) >= jourDe(depuis)); });
  }

  /* LE CHOIX AUTOMATIQUE, et la phrase qui le justifie. Le premier cas qui s'applique gagne. */
  function choisir(ctx) {
    var dv = ctx.devis, auj = ctx.aujourdhui, m = mails(ctx);
    function dernier(modeles) { return m.filter(function (e) { return modeles.indexOf(e.modele) >= 0; })[0] || null; }
    /* LOT 73 : une affaire qui s'arrete se quitte bien, une affaire gagnee se remercie. */
    if (ctx.issue === 'perdue') {
      if (!ecritDepuis(ctx, ['pas_pour_cette_fois'], ctx.close_le))
        return { k: 'pas_pour_cette_fois', raison: 'l’affaire s’arrête là : laisse-lui une bonne dernière impression' };
      return { k: 'libre', raison: 'l’affaire est close et ton mail de fin est parti' };
    }
    if (dv && dv.statut === 'accepte' && !ecritDepuis(ctx, ['merci_commande'], dv.signe_le || dv.accepte_le))
      return { k: 'merci_commande', raison: 'ton devis ' + dv.numero + (dv.signe_le ? ' a été signé en ligne' : ' est accepté') + ' et tu ne l’as pas encore remercié' };
    if (dv && dv.statut === 'enregistre')
      return { k: 'devis', raison: 'ton devis ' + dv.numero + ' est prêt mais pas encore parti' };
    if (dv && dv.statut === 'envoye') {
      var envoye = String(dv.envoye_le || '').slice(0, 10);
      var md = dernier(['devis', 'relance_devis']);
      var depuis = md && String(md.le).slice(0, 10) >= envoye ? String(md.le).slice(0, 10) : envoye;
      var j = joursEntre(depuis, auj);
      if (expire(dv, auj)) return { k: 'relance_devis', raison: 'ton devis ' + dv.numero + ' est arrivé à son terme le ' + dateLettre(dv.valable_jusqu) };
      if (!md || String(md.le).slice(0, 10) < envoye) {
        if (j == null || j < 7) return { k: 'devis', raison: 'ton devis ' + dv.numero + ' est figé : envoie-lui le lien de signature' };
      }
      if (j != null && j >= 7) return { k: 'relance_devis', raison: 'ton devis ' + dv.numero + ' est parti il y a ' + j + ' jours, sans réponse' };
    }
    /* La degustation : le dernier mail « Degustation », ou un echange note « Echantillon
       envoye » ou « Salon ou degustation » (ctx.degustation), s'il n'y a eu aucun mail depuis. */
    var dm = m[0], deg = dm && dm.modele === 'degustation' ? String(dm.le) : '';
    if (ctx.degustation && String(ctx.degustation) > deg && !(dm && String(dm.le) > String(ctx.degustation))) deg = String(ctx.degustation);
    if (deg) {
      var jd = joursEntre(deg.slice(0, 10), auj);
      if (jd != null && jd >= 7) return { k: 'relance_degustation', raison: 'ta proposition de dégustation date de ' + jd + ' jours' };
    }
    /* Une etape qui parle de rendez-vous, et aucun mail de rendez-vous depuis qu'on y est. */
    if (ctx.etape && /rendez|rdv|visite|rencontre/i.test(ctx.etape) && !ecritDepuis(ctx, ['rendez_vous'], ctx.etape_le))
      return { k: 'rendez_vous', raison: 'ton affaire est à l’étape « ' + ctx.etape + ' »' };
    if (ctx.dernierEchange) {
      var je = joursEntre(String(ctx.dernierEchange).slice(0, 10), auj);
      if (je != null && je >= 0 && je <= 2 && !(dm && String(dm.le) > String(ctx.dernierEchange)))
        return { k: 'suite', raison: 'tu as noté un échange ' + (je === 0 ? 'aujourd’hui' : je === 1 ? 'hier' : 'avant-hier') };
    }
    /* Rien d'ecrit, rien de note : le premier mail de l'affaire. */
    if (!m.length && !ctx.dernierEchange && !dv) {
      if (ctx.famille === 'evenement') return { k: 'evenement', raison: 'tu ne lui as pas encore écrit' };
      if (ctx.piste) return { k: 'premier_contact', raison: 'tu ne lui as encore jamais écrit' };
    }
    return { k: 'libre', raison: 'aucun modèle ne s’impose : écris ce que tu veux' };
  }

  /* Les blocs a cocher d'un modele. `off` : la raison pour laquelle il est grise ;
     `geste` : ce que l'ecran propose pour le rendre possible. */
  function blocs(k, ctx) {
    var dv = ctx.devis, auj = ctx.aujourdhui, l = [];
    function lien(defaut) {
      var b = { k: 'lien', lbl: 'Le lien pour signer en ligne', defaut: defaut, off: '', geste: '' };
      if (!dv || !dv.url) {
        b.defaut = false;
        if (dv && dv.statut === 'enregistre') { b.off = 'Le lien se crée quand tu fais partir le devis.'; b.geste = 'envoi'; }
        else if (dv && dv.lienEtat === 'ancien') { b.off = 'Le lien déjà envoyé a été créé avant que le bureau garde les liens : il ne peut pas se réafficher. Crée un nouveau lien (l’ancien ne marchera plus).'; b.geste = 'lien'; }
        else if (dv && dv.lienEtat === 'aucun') { b.off = 'Pas encore de lien de signature pour ce devis.'; b.geste = 'lien'; }
        else if (dv && dv.statut === 'envoye' && !expire(dv, auj)) b.off = 'Lecture du lien…';
        else b.off = 'Pas de lien de signature.';
      }
      return b;
    }
    var appel = { k: 'appel', lbl: 'Proposer deux moments pour un appel', defaut: false };
    var tarif = { k: 'tarif', lbl: 'Joindre ton tarif', defaut: false };
    if (k === 'devis') {
      l.push(lien(true));
      if (dv && euros(dv.total_ht_c)) l.push({ k: 'montant', lbl: 'Le montant HT', defaut: true });
      if (dv && dv.valable_jusqu) l.push({ k: 'validite', lbl: 'La date de validité', defaut: true });
      l.push(appel);
    } else if (k === 'relance_devis') {
      if (dv && dv.valable_jusqu && !expire(dv, auj)) l.push({ k: 'validite', lbl: 'La date de validité', defaut: true });
      if (!expire(dv, auj)) l.push(lien(true));
      if (dv && euros(dv.total_ht_c)) l.push({ k: 'montant', lbl: 'Rappeler le montant HT', defaut: false });
      appel.defaut = true; l.push(appel);
    } else if (k === 'degustation') {
      l.push({ k: 'echantillons', lbl: 'Proposer des échantillons', defaut: true });
      l.push({ k: 'passage', lbl: 'L’inviter au domaine', defaut: false });
      l.push(tarif);
      appel.defaut = true; l.push(appel);
    } else if (k === 'relance_degustation') {
      l.push({ k: 'proposer_devis', lbl: 'Proposer un devis', defaut: true });
      l.push(tarif);
      appel.defaut = true; l.push(appel);
    } else if (k === 'suite') {
      l.push({ k: 'echantillons', lbl: 'Proposer des échantillons', defaut: false });
      l.push(tarif);
      l.push(appel);
    } else if (k === 'premier_contact') {
      l.push({ k: 'echantillons', lbl: 'Proposer des échantillons', defaut: true });
      l.push({ k: 'passage', lbl: 'L’inviter au domaine', defaut: false });
      l.push(tarif);
      appel.defaut = true; l.push(appel);
    } else if (k === 'rendez_vous') {
      l.push({ k: 'au_domaine', lbl: 'Le recevoir au domaine plutôt que passer le voir', defaut: false });
      l.push({ k: 'gouter', lbl: 'Faire goûter les vins', defaut: true });
      l.push(tarif);
    } else if (k === 'evenement') {
      l.push({ k: 'questions', lbl: 'Demander la date et le nombre d’invités', defaut: true });
      l.push({ k: 'passage', lbl: 'L’inviter à goûter au domaine', defaut: true });
      l.push(appel);
    } else if (k === 'objection_prix') {
      l.push({ k: 'autre_cuvee', lbl: 'Proposer une cuvée à un prix plus doux', defaut: false });
      l.push({ k: 'quantite', lbl: 'Proposer un prix pour une plus grande quantité', defaut: false });
      appel.defaut = true; l.push(appel);
    } else if (k === 'merci_commande') {
      var retrait = dv && dv.livraison_mode === 'retrait';
      if (dv && !retrait && dv.livraison_souhaitee) l.push({ k: 'livraison', lbl: 'La date de livraison souhaitée', defaut: true });
    } else if (k === 'pas_pour_cette_fois') {
      l.push({ k: 'millesime', lbl: 'Lui donner des nouvelles au prochain millésime', defaut: true });
    }
    return l;
  }
  function defauts(k, ctx) { return blocs(k, ctx).filter(function (b) { return b.defaut && !b.off; }).map(function (b) { return b.k; }); }

  function evt(ctx) { return /mariage/i.test(String(ctx.typeNom || '')) ? 'votre mariage' : 'votre événement'; }
  function sujet(k, ctx, coches) {
    var dv = ctx.devis, dom = ctx.domaine ? ', ' + ctx.domaine : '';
    var c = coches || defauts(k, ctx), lieu = PLACE[ctx.nature] ? PLACE[ctx.nature].replace(/^(dans|à) /, 'pour ') : '';
    if (k === 'devis') return dv ? 'Devis ' + dv.numero + (version(dv) > 1 ? ', version ' + version(dv) : '') + dom : 'Notre devis' + dom;
    if (k === 'relance_devis') return dv ? 'Notre devis ' + dv.numero : 'Notre devis';
    if (k === 'degustation') return 'Une dégustation de nos vins' + dom;
    if (k === 'relance_degustation') return 'Suite à la dégustation';
    if (k === 'suite') return 'Suite à notre échange';
    if (k === 'premier_contact') {
      if (c.indexOf('echantillons') >= 0) return 'Des échantillons ' + (lieu || 'pour vous') + dom;
      if (c.indexOf('passage') >= 0) return 'Une dégustation au domaine' + dom;
      return 'Nos vins' + (lieu ? ' ' + lieu : '') + dom;
    }
    if (k === 'rendez_vous') return 'Se voir pour en parler' + dom;
    if (k === 'evenement') return 'Les vins de ' + evt(ctx) + dom;
    if (k === 'objection_prix') return dv ? 'Notre devis ' + dv.numero : 'Suite à votre retour';
    if (k === 'merci_commande') return 'Merci pour votre commande' + (dv ? ', devis ' + dv.numero : '');
    if (k === 'pas_pour_cette_fois') return ctx.motif === 'sans_reponse' ? 'Notre proposition' + dom : 'Merci pour votre retour';
    return '';
  }

  function texte(k, ctx, coches) {
    var dv = ctx.devis, auj = ctx.aujourdhui, c = {};
    (coches || []).forEach(function (x) { c[x] = true; });
    var bl = blocs(k, ctx), permis = {};
    bl.forEach(function (b) { if (!b.off) permis[b.k] = true; });
    function a(x) { return c[x] && permis[x]; }
    var p = [ctx.contact ? 'Bonjour ' + ctx.contact + ',' : 'Bonjour,'];
    var appelTxt = 'Je peux vous appeler ' + creneaux(auj, ctx.nature) + ' : dites-moi ce qui vous convient.';
    var tarifTxt = 'Vous trouverez notre tarif en pièce jointe.';
    var fin = 'Je reste à votre disposition.';
    if (k === 'devis' && dv) {
      var l1 = version(dv) > 1 ? 'Voici la version ' + version(dv) + ' de notre devis ' + dv.numero + '. Elle remplace la version précédente.'
        : 'Comme convenu, voici notre devis ' + dv.numero + '.';
      var det = [];
      if (a('montant')) det.push('Il s’élève à ' + euros(dv.total_ht_c) + '.');
      if (a('validite')) det.push('Il est valable jusqu’au ' + dateLettre(dv.valable_jusqu) + '.');
      p.push(l1 + (det.length ? ' ' + det.join(' ') : ''));
      if (a('lien')) p.push('Vous pouvez le lire et le signer en ligne, sans rien imprimer :\n' + dv.url);
      if (a('appel')) p.push(appelTxt);
    } else if (k === 'relance_devis' && dv) {
      var r = 'Je reviens vers vous au sujet de notre devis ' + dv.numero
        + (dv.envoye_le ? ', envoyé le ' + dateLettre(dv.envoye_le) : '') + '. Avez-vous eu le temps de le regarder ?';
      p.push(r);
      if (expire(dv, auj)) p.push('Il est arrivé à son terme le ' + dateLettre(dv.valable_jusqu) + ' : je peux vous le remettre à jour si vous le souhaitez.');
      else {
        var d2 = [];
        if (a('validite')) d2.push('Il reste valable jusqu’au ' + dateLettre(dv.valable_jusqu) + '.');
        if (a('montant')) d2.push('Pour rappel, il s’élève à ' + euros(dv.total_ht_c) + '.');
        if (d2.length) p.push(d2.join(' '));
        if (a('lien')) p.push('Pour le signer en ligne :\n' + dv.url);
      }
      if (a('appel')) p.push(appelTxt);
      fin = 'Un simple retour à ce message me suffit.';
    } else if (k === 'degustation') {
      p.push('Comme évoqué, j’aimerais vous faire goûter nos vins.');
      var g = [];
      if (a('echantillons')) g.push('Je peux vous déposer ou vous envoyer quelques échantillons : dites-moi ceux qui vous intéressent.');
      if (a('passage')) g.push('Je vous propose aussi de venir déguster au domaine.');
      if (g.length) p.push(g.join(' '));
      if (a('tarif')) p.push(tarifTxt);
      if (a('appel')) p.push(appelTxt);
    } else if (k === 'relance_degustation') {
      p.push('Je reviens vers vous après la dégustation de nos vins. Qu’en avez-vous pensé ?');
      if (a('proposer_devis')) p.push('Si l’un d’eux vous plaît, je vous prépare un devis avec les quantités qui vous conviennent.');
      if (a('tarif')) p.push(tarifTxt);
      if (a('appel')) p.push(appelTxt);
    } else if (k === 'suite') {
      p.push('Merci pour notre échange.');
      if (a('echantillons')) p.push('Je vous propose de goûter nos vins : je peux vous faire parvenir quelques échantillons.');
      if (a('tarif')) p.push(tarifTxt);
      if (a('appel')) p.push(appelTxt);
    } else if (k === 'premier_contact') {
      /* UN SEUL GESTE demande au client : l'appel, pour convenir des echantillons OU de la visite. */
      p.push((ctx.domaine ? 'Je vous contacte pour le compte ' + deDomaine(ctx.domaine) + '. ' : '')
        + 'Je pense que nos vins ont leur place ' + (PLACE[ctx.nature] || 'chez vous') + ', et le plus simple est de vous les faire goûter.');
      var quoi = a('echantillons') ? 'vous déposer quelques échantillons' : a('passage') ? 'venir déguster au domaine' : '';
      if (a('appel')) p.push('Je peux vous appeler ' + creneaux(auj, ctx.nature) + (quoi ? ', pour convenir d’un moment où ' + quoi : '') + '. Dites-moi ce qui vous convient.');
      else if (quoi) p.push('Je vous propose de ' + quoi + ' : dites-moi quand cela vous arrange.');
      if (a('tarif')) p.push(tarifTxt);
      fin = '';
    } else if (k === 'rendez_vous') {
      var gouter = a('gouter');
      p.push('Je vous propose de nous voir une vingtaine de minutes pour en parler' + (gouter ? ' et goûter nos vins ensemble' : '') + '.');
      p.push((a('au_domaine') ? 'Je peux vous recevoir au domaine ' : 'Je peux passer vous voir ')
        + creneaux(auj, ctx.nature) + ' : dites-moi ce qui vous convient, ou proposez-moi un autre moment.');
      if (gouter && !a('au_domaine')) p.push('J’apporterai quelques bouteilles.');
      if (a('tarif')) p.push(tarifTxt);
      fin = '';
    } else if (k === 'evenement') {
      p.push('Merci de penser à nos vins pour ' + evt(ctx) + '.');
      if (a('questions')) p.push('Pour vous faire une proposition juste, pouvez-vous me dire la date, le nombre d’invités et ce que vous pensez servir : l’apéritif, le repas, ou les deux ? Je vous aiderai à calculer les quantités pour ne manquer de rien.');
      if (a('passage')) p.push('Je vous propose aussi de venir goûter au domaine avant de choisir.');
      if (a('appel')) p.push(appelTxt);
      fin = '';
    } else if (k === 'objection_prix') {
      var envoyeDv = dv && (dv.statut === 'envoye' || dv.statut === 'enregistre');
      p.push('Merci pour votre retour sur le prix' + (envoyeDv ? ' de notre devis ' + dv.numero : '') + ', je le comprends.');
      p.push('Notre prix tient au travail fait à la vigne et au chai, et ' + (a('appel') ? 'c’est plus simple à expliquer de vive voix.' : 'j’aimerais prendre cinq minutes pour vous l’expliquer.'));
      if (a('autre_cuvee')) p.push('Je peux aussi vous proposer une autre de nos cuvées, à un prix plus doux' + (a('appel') ? ' : nous pourrons en parler à ce moment-là.' : '.'));
      if (a('quantite')) p.push('Je peux aussi revoir le prix pour une quantité plus importante' + (a('appel') ? ' : nous pourrons en parler à ce moment-là.' : ' : dites-moi le volume qui vous conviendrait.'));
      if (a('appel')) p.push(appelTxt);
      fin = '';
    } else if (k === 'merci_commande' && dv) {
      p.push((dv.signe_le ? 'Merci d’avoir signé notre devis ' : 'Merci pour votre accord sur notre devis ') + dv.numero + ' : votre commande est enregistrée.');
      if (dv.livraison_mode === 'retrait') p.push('Vous pourrez passer la retirer au domaine : je vous préviens dès qu’elle est prête.');
      else if (a('livraison')) p.push('Je retiens la livraison souhaitée le ' + dateLettre(dv.livraison_souhaitee) + ' et je vous tiens au courant.');
      else p.push('Je vous tiens au courant pour la livraison.');
      p.push('Quand vous aurez goûté, dites-moi comment nos vins sont accueillis : votre avis compte beaucoup pour moi.');
      fin = 'Merci encore pour votre confiance.';
    } else if (k === 'pas_pour_cette_fois') {
      var motifs = {
        prix: 'Je comprends que le prix ne convienne pas cette fois.',
        fournisseur: 'Je comprends que vous travailliez déjà avec un fournisseur.',
        moment: 'Je comprends que ce ne soit pas le bon moment.',
        indisponible: 'Je regrette de ne pas avoir pu répondre à votre demande cette fois.'
      };
      if (ctx.motif === 'sans_reponse') p.push('J’imagine que ce n’est pas le bon moment pour vous : je clos le sujet de mon côté, et je ne vous relancerai pas sur cette proposition.');
      else p.push(('Merci d’avoir pris le temps de regarder notre proposition. ' + (motifs[ctx.motif] || '')).trim());
      if (a('millesime')) p.push('Si vous le voulez bien, je vous donnerai des nouvelles à la sortie de notre prochain millésime.');
      fin = ctx.motif === 'sans_reponse' ? '' : 'Au plaisir de vous faire goûter nos vins une autre fois.';
    } else {
      p.push('');
      fin = '';
    }
    if (fin) p.push(fin);
    p.push('Bien à vous,');
    return p.join('\n\n');
  }

  /* Ce que l'ecran doit dire en plus, sous le texte. */
  function avertir(k, ctx, coches, longueurMailto) {
    var l = [];
    if ((coches || []).indexOf('tarif') >= 0) l.push('Pense à joindre ton tarif à ton mail : la messagerie ne le fait pas pour toi.');
    if (k === 'devis' && (coches || []).indexOf('lien') < 0) l.push('Sans le lien, joins le PDF du devis à ton mail.');
    if (k === 'premier_contact' && (coches || []).indexOf('echantillons') >= 0 && (coches || []).indexOf('passage') >= 0)
      l.push('Une seule offre par mail : les échantillons OU la visite au domaine. Le texte garde les échantillons.');
    if (k === 'objection_prix' && (coches || []).indexOf('autre_cuvee') >= 0 && (coches || []).indexOf('quantite') >= 0)
      l.push('Une seule offre par mail : garde l’autre cuvée OU le prix par quantité, ton client choisira mieux.');
    if (longueurMailto > MAX_MAILTO) l.push('Texte long : si ta messagerie le coupe, utilise « Copier le texte ».');
    return l;
  }

  /* Le rappel a poser apres ce mail : null s'il n'y en a pas, sinon { titre, iso, lbl,
     defaut, tache }. `tache` : l'affaire est close, elle n'a plus de rappel (regle du lot
     34), la promesse devient une tache datee de « Mes taches ». */
  function rappel(k, ctx, coches) {
    ctx = ctx || {};
    var auj = ctx.aujourdhui, close = !!(ctx.issue && ctx.issue !== 'en_cours'), dv = ctx.devis, c = coches || defauts(k, ctx);
    if (k === 'merci_commande') {
      var liv = dv && dv.livraison_mode !== 'retrait' && dv.livraison_souhaitee && String(dv.livraison_souhaitee) >= auj ? String(dv.livraison_souhaitee) : '';
      var isoM = liv ? plusJours(liv, 7) : plusJours(auj, 21);
      return { titre: 'Prendre de ses nouvelles après la livraison', iso: isoM, defaut: true, tache: close,
        lbl: 'Me rappeler de prendre de ses nouvelles ' + (liv ? 'le ' + dateLettre(isoM) + ', une semaine après la livraison' : 'dans 3 semaines') };
    }
    if (k === 'pas_pour_cette_fois') {
      if (c.indexOf('millesime') < 0) return null;
      return { titre: 'Lui présenter le nouveau millésime', iso: plusJours(auj, 182), defaut: true, tache: close,
        lbl: 'Me rappeler de lui présenter le nouveau millésime dans 6 mois' };
    }
    var r = RAPPELS[k];
    if (!r || close) return null;
    if (k === 'rendez_vous') {
      /* La VEILLE du premier moment propose : confirmer apres le rendez-vous ne sert a rien. */
      var p1 = premierCreneau(auj), veille = new Date(p1.getTime() - 86400000);
      while (veille.getUTCDay() === 0 || veille.getUTCDay() === 6) veille = new Date(veille.getTime() - 86400000);
      var isoV = iso(veille) > auj ? iso(veille) : auj;
      return { titre: r[0], iso: isoV, defaut: true, tache: false, lbl: 'Me rappeler de confirmer le rendez-vous le ' + dateLettre(isoV) + ', la veille du premier moment proposé' };
    }
    return { titre: k === 'relance_devis' && dv ? r[0] + ' ' + dv.numero : r[0], iso: plusJours(auj, r[1]), defaut: true, tache: false,
      lbl: 'Me rappeler de le relancer dans ' + r[1] + ' jours' };
  }
  function nom(k) { var m = MODELES.filter(function (x) { return x.k === k; })[0]; return m ? m.nom : ''; }

  window.BdvMailsAffaire = { MODELES: MODELES, MAX_MAILTO: MAX_MAILTO, dispo: dispo, choisir: choisir, blocs: blocs,
    defauts: defauts, sujet: sujet, texte: texte, avertir: avertir, nom: nom, rappel: rappel, creneaux: creneaux, _euros: euros, _dateLettre: dateLettre };
})();
