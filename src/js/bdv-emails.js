/* ============================================================================
   BDV-EMAILS.JS  LA PAGE QUI PERMET D'ARRETER
   ============================================================================
   Sert /mes-emails/. On y arrive par le pied d'un courrier, avec un jeton dans
   l'adresse, et SANS ETRE CONNECTE. C'est le RGPD 7-3 qui l'impose : se retirer
   doit etre aussi simple que consentir. Une page de desinscription derriere un
   mot de passe n'en est pas une.

   CE QUE LE JETON OUVRE, EXACTEMENT : deux fonctions Postgres, `emails_lire` et
   `emails_ecrire`, qui ne rendent rien sans un jeton exact. Pas le bureau, pas
   les ventes, pas meme l'adresse en clair -- elle revient masquee, pour qu'une
   fuite de lien ne devienne pas une fuite d'adresse.

   IL N'Y A PAS DE CONFIRMATION AVANT DE COUPER, et c'est deliberé. Une
   desinscription qui demande « es-tu sur ? » est une desinscription qu'on peut
   rater. Le sens inverse, lui, ne coute rien a qui s'est trompe : il recoche.
   ========================================================================= */
(function(){
  'use strict';

  var PARAM = 'j';   // doit rester aligne sur PARAM_JETON d'index.ts

  function el(id){ return document.getElementById(id); }

  function montrer(id, oui){
    var n = el(id);
    if(n) n.hidden = !oui;
  }

  /* Un UUID, et rien d'autre. Ce n'est pas une securite -- c'est le serveur qui
     tranche -- mais ca evite d'envoyer n'importe quoi a PostgREST, qui repond
     alors par une erreur de type et pas par « jeton inconnu ». */
  function jetonDeLAdresse(){
    var m = new RegExp('[?&]' + PARAM + '=([^&#]+)').exec(location.search);
    if(!m) return '';
    var v = decodeURIComponent(m[1]).trim().toLowerCase();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) ? v : '';
  }

  function fmtDate(iso){
    if(!iso) return '';
    var d = new Date(iso);
    if(isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', { day:'numeric', month:'long', year:'numeric' }).format(d);
  }

  function avis(texte, bon){
    var n = el('mailsAvis');
    if(!n) return;
    n.textContent = texte || '';
    n.style.color = bon ? 'var(--vert, #2e7d32)' : 'var(--bordeaux, #8b2635)';
    n.hidden = !texte;
  }

  var JETON = '';

  function poserDepuis(id, quand, mot){
    var n = el(id);
    if(!n) return;
    var j = fmtDate(quand);
    n.textContent = j ? (' ' + mot + ' le ' + j + '.') : '';
    n.hidden = !j;
  }

  function remplir(p){
    el('mailsAdresse').textContent = p.email_masque || 'ton adresse';
    el('mailsRappels').checked = !!p.rappels;
    el('mailsEdition').checked = !!p.edition;
    /* La date dit CE QUE LA BASE SAIT, dans les deux sens : « demande le 11
       septembre » si la case est cochee, « arrete le 11 septembre » sinon. Une
       case a cocher muette sur son propre passe laisse le doute a celui qui
       jure n'avoir jamais rien demande, et c'est justement lui qui ecrit. */
    poserDepuis('mailsRappelsDepuis', p.rappels_le, p.rappels ? 'Demandé' : 'Arrêté');
    poserDepuis('mailsEditionDepuis', p.edition_le, p.edition ? 'Demandé' : 'Arrêté');
  }

  function charger(){
    return BdvCompte.rpcPublic('emails_lire', { jeton: JETON })
      .then(function(lignes){
        /* `returns table` rend un TABLEAU, vide si le jeton ne correspond a
           rien. Pas d'erreur HTTP dans ce cas, volontairement cote SQL : un
           jeton faux n'apprend rien de plus qu'un jeton vrai dont les deux
           cases seraient decochees. */
        var p = (Array.isArray(lignes) && lignes[0]) || null;
        if(!p){ montrer('mailsIntrouvable', true); return false; }
        remplir(p);
        montrer('mailsForm', true);
        return true;
      });
  }

  function ecrire(rappels, edition){
    var btn = el('mailsEnregistrer');
    var coupe = el('mailsToutCouper');
    btn.disabled = true; coupe.disabled = true;
    var motAvant = btn.textContent;
    btn.textContent = 'Enregistrement…';
    avis('', true);

    return BdvCompte.rpcPublic('emails_ecrire',
             { jeton: JETON, rappels: !!rappels, edition: !!edition })
      .then(function(ok){
        if(ok !== true){ montrer('mailsForm', false); montrer('mailsIntrouvable', true); return; }
        el('mailsRappels').checked = !!rappels;
        el('mailsEdition').checked = !!edition;
        /* ON RELIT APRES AVOIR ECRIT, et pas pour faire joli : c'est la seule
           facon d'afficher les dates que le declencheur vient de poser, et de
           montrer l'etat REEL de la base plutot que celui qu'on croit avoir
           envoye. Si la relecture echoue, les cases restent justes et le
           message aussi -- on ne transforme pas une ecriture reussie en
           message d'erreur. */
        return charger().catch(function(){}).then(function(){
          avis(!rappels && !edition
                 ? 'C\'est fait : tu ne recevras plus rien.'
                 : 'C\'est enregistré.', true);
        });
      })
      .catch(function(e){
        /* Un echec ici doit se voir. Quelqu'un qui croit s'etre desinscrit et
           qui recoit le courrier le lendemain matin n'ecrira pas pour demander
           si le reseau a flanche : il ecrira pour se plaindre. */
        avis('Ça n\'est pas parti (' + (e && e.status ? e.status : 'réseau') +
             '). Réessaie, ou écris à teddy@solumatic.fr : on le fait à la main.', false);
      })
      .then(function(){
        btn.disabled = false; coupe.disabled = false; btn.textContent = motAvant;
      });
  }

  function demarrer(){
    JETON = jetonDeLAdresse();
    montrer('mailsAttente', false);

    if(!JETON){ montrer('mailsIntrouvable', true); return; }
    if(!window.BdvCompte || !BdvCompte.rpcPublic){ montrer('mailsIntrouvable', true); return; }

    charger().catch(function(){
      montrer('mailsIntrouvable', true);
    });

    el('mailsForm').addEventListener('submit', function(ev){
      ev.preventDefault();
      ecrire(el('mailsRappels').checked, el('mailsEdition').checked);
    });

    el('mailsToutCouper').addEventListener('click', function(){
      ecrire(false, false);
    });
  }

  /* bdv-compte.js est charge en `defer` comme ce fichier, et il est ecrit AVANT
     dans la tete : l'ordre des `defer` est garanti, donc BdvCompte existe deja.
     `DOMContentLoaded` reste necessaire pour le HTML de la page, qui vient
     apres les deux. */
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();
