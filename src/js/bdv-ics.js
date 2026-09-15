/* ===========================================================================
   LE BUREAU DU VIGNERON — LA MISE EN FORME iCalendar
   ===========================================================================
   Pose le 15/09/2026, Lot E. Ce fichier ne CALCULE aucune date : il recoit les
   occurrences que `bdv-echeances.js` a calculees et les met au format .ics.

   POURQUOI IL N'EST PAS DANS LA FONCTION EDGE, alors qu'elle est son seul
   usage. Parce qu'une mise en forme enfermee dans du TypeScript Deno n'est
   testable que deployee, c'est-a-dire jamais. Ici, `scripts/banc-agenda.mjs`
   la fait tourner sur la VRAIE bibliotheque a chaque `npm run verif`, et
   verifie le repliage a l'octet, l'echappement, et qu'aucune famille privee ne
   passe. Un format de fichier se verifie ou il ment.

   TROIS PIEGES, ET LES TROIS SE PAIENT EN SILENCE

   1. LE REPLIAGE SE COMPTE EN OCTETS, PAS EN SIGNES. RFC 5545 section 3.1 : 75
      octets maximum par ligne, la suite prefixee d'une espace. « Declaration
      recapitulative mensuelle » avec ses accents pese plus que sa longueur.
      Compter des signes produit des lignes trop longues qu'Outlook tronque au
      milieu d'un mot, et le rendez-vous s'affiche ampute sans qu'aucune erreur
      ne soit levee. Et on ne coupe jamais au milieu d'un caractere : un octet
      de continuation UTF-8 vaut 0b10xxxxxx.

   2. `DTEND` EST EXCLUSIF EN JOURNEE ENTIERE. Une occurrence d'un seul jour
      finit le LENDEMAIN. L'ecrire egal a `DTSTART` rend un rendez-vous de duree
      nulle, que la moitie des clients n'affiche pas du tout.

   3. `DTSTAMP` NE DOIT PAS ETRE L'HEURE COURANTE. Avec `new Date()`, chaque
      relecture rend un fichier different : certains clients concluent que TOUT
      a change et re-notifient l'utilisateur a chaque synchronisation. Il est
      derive de la date de l'occurrence, donc le flux est identique d'une
      lecture a l'autre tant que rien n'a bouge. Le banc le verifie.

   PAS DE VALARM, ET C'EST VOULU. Un rappel sur une periode de cent cinq jours
   reveille le vigneron a minuit le premier jour de la taille. Les occurrences
   sont posees en journee entiere et en TRANSPARENT : elles remplissent l'agenda
   sans le bloquer, et c'est son client de messagerie qui decide s'il veut etre
   prevenu.
   =========================================================================== */
(function (racine) {
  'use strict';

  /* Les quatre familles publiques. TOUT LE RESTE EST ECARTE, quoi qu'il arrive
     dans le fichier de donnees. C'est le garde-fou de confidentialite du lot :
     une URL .ics est un mot de passe deguise en lien, et le jour ou quelqu'un
     ajoutera une famille personnelle a la bibliotheque, elle ne partira pas
     dans l'agenda de qui que ce soit. */
  var FAMILLES_PUBLIQUES = ['obligations', 'travaux', 'rendezvous', 'tempsforts'];

  function echapper(v) {
    return String(v == null ? '' : v)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  function replier(ligne) {
    var octets = new TextEncoder().encode(ligne);
    if (octets.length <= 75) return ligne;
    var morceaux = [], debut = 0, dec = new TextDecoder();
    while (debut < octets.length) {
      var large = debut === 0 ? 75 : 74;   // la continuation coute une espace
      var fin = Math.min(debut + large, octets.length);
      while (fin > debut && fin < octets.length && (octets[fin] & 0xc0) === 0x80) fin--;
      morceaux.push((debut === 0 ? '' : ' ') + dec.decode(octets.slice(debut, fin)));
      debut = fin;
    }
    return morceaux.join('\r\n');
  }

  function jour(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  }
  function plusUnJour(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }

  function evenement(o) {
    var e = o.e || {};
    var cle = String(e.cle || 'sans-cle');
    var texte = [];
    if (e.qui) texte.push(String(e.qui));
    if (e.detail) texte.push(String(e.detail));
    if ((e.statut || 'obligation') === 'repere') {
      texte.push('Repere de saison : il se deplace d\'une region a l\'autre. Ce n\'est pas une date de loi.');
    }
    texte.push('Le Bureau du Vigneron, lebureauduvigneron.fr/outils/echeances/');

    var l = [
      'BEGIN:VEVENT',
      'UID:' + cle + '-' + jour(o.debut) + '@lebureauduvigneron.fr',
      'DTSTAMP:' + jour(o.debut) + 'T000000Z',
      'DTSTART;VALUE=DATE:' + jour(o.debut),
      'DTEND;VALUE=DATE:' + jour(plusUnJour(o.fin)),
      'SUMMARY:' + echapper(e.titre || cle),
      'DESCRIPTION:' + echapper(texte.join('\n\n')),
      'CATEGORIES:' + echapper(e.famille || 'obligations'),
      'TRANSP:TRANSPARENT',
      'SEQUENCE:0'
    ];
    if (e.source) l.push('URL:' + echapper(e.source));
    l.push('END:VEVENT');
    return l;
  }

  function calendrier(occurrences) {
    var l = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Solumatic//Le Bureau du Vigneron//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Le Bureau du Vigneron',
      'X-WR-CALDESC:Obligations, travaux de la vigne, salons et temps forts de vente.',
      'X-WR-TIMEZONE:Europe/Paris',
      /* Douze heures : les dates de ce calendrier ne changent pas dans la
         journee, et un client qui relit toutes les heures ne trouverait
         jamais rien de neuf. */
      'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
      'X-PUBLISHED-TTL:PT12H'
    ];
    (occurrences || []).forEach(function (o) {
      if (FAMILLES_PUBLIQUES.indexOf(o.famille || 'obligations') < 0) return;
      l.push.apply(l, evenement(o));
    });
    l.push('END:VCALENDAR');
    return l.map(replier).join('\r\n') + '\r\n';
  }

  function publiques(regles) {
    return (regles || []).filter(function (e) {
      return FAMILLES_PUBLIQUES.indexOf(e.famille || 'obligations') >= 0;
    });
  }

  /* ---- LES TROIS MONDES ----
     Navigateur (aucun usage aujourd'hui, mais la forme reste la meme que ses
     voisins), Node pour le banc, Deno pour la fonction Edge.
     Ne pas remplacer ce bloc par un `export` : il fermerait les deux autres. */
  var api = {
    calendrier: calendrier, evenement: evenement, publiques: publiques,
    FAMILLES_PUBLIQUES: FAMILLES_PUBLIQUES,
    _outils: { echapper: echapper, replier: replier, jour: jour }
  };
  racine.BdvIcs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
