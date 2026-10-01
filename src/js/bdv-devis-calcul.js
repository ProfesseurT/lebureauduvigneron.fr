/* ================================================================
   LE BUREAU DU VIGNERON, le calcul d'un devis (lot 47, 30/09/2026)
   ----------------------------------------------------------------
   Voir `Claude outputs/lot47-spec.md`, section C, et CLAUDE.md, LOT 47.

   DES FONCTIONS PURES, et rien d'autre : ni DOM, ni stockage, ni reseau. Le
   meme fichier sert la page (window.BdvDevisCalcul) et les bancs Node
   (module.exports). La MEME regle vit dans la RPC `devis_enregistrer`
   (supabase/lot47-devis.sql) : scripts/fixtures/devis-calculs.json est la table
   de cas que les deux doivent rendre au centime pres.

   LA REGLE DU COMMERCIAL, en CENTIMES ENTIERS, quantites entieres, remises en
   centiemes de pour cent (0 a 10000). Arrondi au plus proche, demi vers le haut :
     pu_l  = arrondi(pu   * (10000 - rl) / 10000)   prix apres remise de ligne
     pu_f  = arrondi(pu_l * (10000 - g)  / 10000)   prix unitaire SIGNE (col. 23 Vitisoft)
     net   = qte * pu_l ; final = qte * pu_f        (col. 24, exacte par construction)
     total_vins = somme des net ; total_ht = somme des final + port (lot 53)
     remise_globale = total_vins - somme des final (peut s'ecarter de g % de quelques
                                                    centimes : voulu, zero ecart Vitisoft)
     tva = arrondi(total_ht * tva_cb / 10000) SUR LE TOTAL ; ttc = total_ht + tva

   PAS UN SEUL FLOTTANT DANS UN MONTANT. La division est entiere et arrondie a la
   main ; au-dela de 2^53 (TVA de 200 lignes a 99 999,99 EUR x 99 999), le calcul
   passe en BigInt plutot que de perdre un centime en silence.
   ================================================================ */
(function (racine) {
  'use strict';

  /* a * b / d, arrondi au plus proche, demi vers le haut. a, b >= 0 entiers, d > 0. */
  function mulDiv(a, b, d) {
    var p = a * b;
    if (Number.isSafeInteger(p)) {
      var q = Math.floor(p / d), r = p - q * d;
      /* La division flottante peut se tromper d'une unite pres de 2^53 : on recale. */
      while (r < 0) { q -= 1; r += d; }
      while (r >= d) { q += 1; r -= d; }
      return 2 * r >= d ? q + 1 : q;
    }
    var P = BigInt(a) * BigInt(b), D = BigInt(d);
    var Q = P / D, R = P - Q * D;
    if (R * 2n >= D) Q += 1n;
    return Number(Q);
  }

  function ligne(pu, qte, rl, g) {
    var pu_l = mulDiv(pu, 10000 - (rl || 0), 10000);
    var pu_f = mulDiv(pu_l, 10000 - (g || 0), 10000);
    return { pu_l: pu_l, pu_f: pu_f, net: qte * pu_l, final: qte * pu_f };
  }

  /* lignes : [{ pu_c, qte, remise_cb }] ; g : remise globale (cb) ; tvaCb : 2000 ;
     portC : frais de port HT en centimes (lot 53, 0 par defaut). LE PORT ENTRE DANS LE
     TOTAL HT, la remise globale ne le touche pas, et la TVA (une fois, sur le total) le
     couvre : total_ht = somme des final + port ; remise_globale = total_vins - somme des final. */
  function devis(lignes, g, tvaCb, portC) {
    g = g || 0;
    tvaCb = tvaCb == null ? 2000 : tvaCb;
    var port = portC || 0;
    var sortie = [], vins = 0, fin = 0;
    (lignes || []).forEach(function (l) {
      var x = ligne(l.pu_c, l.qte, l.remise_cb || 0, g);
      sortie.push(x);
      vins += x.net;
      fin += x.final;
    });
    var ht = fin + port;
    var tva = mulDiv(ht, tvaCb, 10000);
    return { lignes: sortie, total_vins: vins, remise_globale: vins - fin, port: port, total_ht: ht, tva: tva, ttc: ht + tva };
  }

  /* LA SAISIE : « 8,50 » -> 850. Plus de deux decimales, un signe, du texte : null,
     JAMAIS un arrondi silencieux. Les espaces (y compris insecables) et un « EUR »
     final sont toleres, parce que c'est ce que l'ecran affiche. */
  function nettoyer(s) {
    return String(s == null ? '' : s).replace(/[\s  ]/g, '').replace(/€$/, '');
  }
  function centimes(s) {
    var t = nettoyer(s);
    var m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(t);
    if (!m) return null;
    var c = parseInt(m[1], 10) * 100 + (m[2] ? parseInt((m[2] + '0').slice(0, 2), 10) : 0);
    return Number.isSafeInteger(c) ? c : null;
  }
  /* « 12,5 » -> 1250 (centiemes de pour cent). Le format seulement : la borne
     0 a 100 % se dit a l'appelant, dans ses mots. */
  function remiseCb(s) {
    var t = nettoyer(s).replace(/%$/, '');
    if (t === '') return 0;
    var m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(t);
    if (!m) return null;
    var c = parseInt(m[1], 10) * 100 + (m[2] ? parseInt((m[2] + '0').slice(0, 2), 10) : 0);
    return Number.isSafeInteger(c) ? c : null;
  }

  /* « 1 234,56 EUR » : espace fine insecable (U+202F) entre les milliers,
     insecable (U+00A0) avant le symbole. */
  function euros(c) {
    c = Number(c) || 0;
    var signe = c < 0 ? '-' : '';
    c = Math.abs(c);
    var e = Math.floor(c / 100), r = c - e * 100;
    var txt = String(e).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
    return signe + txt + ',' + (r < 10 ? '0' : '') + r + '\u00a0€';
  }
  /* 500 -> « 5 », 1250 -> « 12,5 », 1234 -> « 12,34 ». */
  function pourcent(cb) {
    cb = Number(cb) || 0;
    var e = Math.floor(cb / 100), r = cb - e * 100;
    if (!r) return String(e);
    return e + ',' + (r % 10 ? (r < 10 ? '0' : '') + r : String(r / 10));
  }
  /* Le texte a remettre dans un champ : 850 -> « 8,50 ». */
  function saisie(c) {
    c = Number(c) || 0;
    var e = Math.floor(c / 100), r = c - e * 100;
    return e + ',' + (r < 10 ? '0' : '') + r;
  }

  var api = { mulDiv: mulDiv, ligne: ligne, devis: devis, centimes: centimes, remiseCb: remiseCb,
              euros: euros, pourcent: pourcent, saisie: saisie };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (racine) racine.BdvDevisCalcul = api;
})(typeof window !== 'undefined' ? window : null);
