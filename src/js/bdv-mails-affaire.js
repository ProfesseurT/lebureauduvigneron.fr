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
   }
   ============================================================================ */
(function () {
  'use strict';

  var MODELES = [
    { k: 'devis', nom: 'Envoi du devis à signer' },
    { k: 'relance_devis', nom: 'Relance du devis' },
    { k: 'degustation', nom: 'Dégustation, échantillons' },
    { k: 'relance_degustation', nom: 'Relance après la dégustation' },
    { k: 'suite', nom: 'Suite à notre échange' },
    { k: 'libre', nom: 'Mail libre' }
  ];
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
  function creneaux(aujourdhui) {
    var d = versDate(aujourdhui) || versDate(new Date().toISOString());
    var d1 = ouvreApres(d, 1), d2 = ouvreApres(d1, 2);
    function dit(x, h) { return JOURS[x.getUTCDay()] + ' ' + (x.getUTCDate() === 1 ? '1er' : x.getUTCDate()) + ' ' + MOIS[x.getUTCMonth()] + ' à ' + h + ' h'; }
    return dit(d1, 10) + ' ou ' + dit(d2, 16);
  }
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
    return '';
  }

  /* LE CHOIX AUTOMATIQUE, et la phrase qui le justifie. Le premier cas qui s'applique gagne. */
  function choisir(ctx) {
    var dv = ctx.devis, auj = ctx.aujourdhui, m = mails(ctx);
    function dernier(modeles) { return m.filter(function (e) { return modeles.indexOf(e.modele) >= 0; })[0] || null; }
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
    if (ctx.dernierEchange) {
      var je = joursEntre(String(ctx.dernierEchange).slice(0, 10), auj);
      if (je != null && je >= 0 && je <= 2 && !(dm && String(dm.le) > String(ctx.dernierEchange)))
        return { k: 'suite', raison: 'tu as noté un échange ' + (je === 0 ? 'aujourd’hui' : je === 1 ? 'hier' : 'avant-hier') };
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
    }
    return l;
  }
  function defauts(k, ctx) { return blocs(k, ctx).filter(function (b) { return b.defaut && !b.off; }).map(function (b) { return b.k; }); }

  function sujet(k, ctx) {
    var dv = ctx.devis, dom = ctx.domaine ? ', ' + ctx.domaine : '';
    if (k === 'devis') return dv ? 'Devis ' + dv.numero + (version(dv) > 1 ? ', version ' + version(dv) : '') + dom : 'Notre devis' + dom;
    if (k === 'relance_devis') return dv ? 'Notre devis ' + dv.numero : 'Notre devis';
    if (k === 'degustation') return 'Une dégustation de nos vins' + dom;
    if (k === 'relance_degustation') return 'Suite à la dégustation';
    if (k === 'suite') return 'Suite à notre échange';
    return '';
  }

  function texte(k, ctx, coches) {
    var dv = ctx.devis, auj = ctx.aujourdhui, c = {};
    (coches || []).forEach(function (x) { c[x] = true; });
    var bl = blocs(k, ctx), permis = {};
    bl.forEach(function (b) { if (!b.off) permis[b.k] = true; });
    function a(x) { return c[x] && permis[x]; }
    var p = [ctx.contact ? 'Bonjour ' + ctx.contact + ',' : 'Bonjour,'];
    var appelTxt = 'Je peux vous appeler ' + creneaux(auj) + ' : dites-moi ce qui vous convient.';
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
      if (a('passage')) g.push('Vous êtes aussi le bienvenu au domaine pour une dégustation.');
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
    if (longueurMailto > MAX_MAILTO) l.push('Texte long : si ta messagerie le coupe, utilise « Copier le texte ».');
    return l;
  }

  function nom(k) { var m = MODELES.filter(function (x) { return x.k === k; })[0]; return m ? m.nom : ''; }

  window.BdvMailsAffaire = { MODELES: MODELES, MAX_MAILTO: MAX_MAILTO, dispo: dispo, choisir: choisir, blocs: blocs,
    defauts: defauts, sujet: sujet, texte: texte, avertir: avertir, nom: nom, creneaux: creneaux, _euros: euros, _dateLettre: dateLettre };
})();
