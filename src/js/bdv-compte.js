/* Le Bureau du Vigneron, module de compte.
   Porte d'entree commune a tous les outils : email + mot de passe, sans supabase-js.
   Appelle directement GoTrue (auth) et PostgREST (profils).

   Le code a six chiffres n'est plus un moyen de connexion. Il ne sert plus qu'a deux choses :
   confirmer une adresse a l'inscription, et reprendre la main sur un mot de passe oublie. Dans
   les deux cas il reste dans la modale : aucun lien a cliquer, aucune page de retour, aucun
   fragment d'URL a decoder. C'est la raison pour laquelle les gabarits Supabase doivent porter
   {{ .Token }} et pas {{ .ConfirmationURL }}.

   Regle d'or : un vigneron ne doit jamais se retrouver enferme dehors de ses propres donnees.
   La session locale suffit a ouvrir l'outil ; le reseau ne sert qu'a l'ouvrir ou la rafraichir,
   jamais a conditionner l'affichage des donnees deja en IndexedDB. */
(function(){
  'use strict';

  // Projet qukmncqqwomhmrdhvetj, West EU (Ireland). Renseignes le 04/09/2026.
  // La cle anon est publique par construction (elle vit dans ce fichier JS, visible de
  // quiconque ouvre l'outil) : la securite tient entierement aux politiques RLS posees sur
  // les tables Supabase, jamais au secret de cette cle. La faire tourner ne protege rien,
  // corriger une politique RLS protege tout.
  // Cle `anon` historique et non la cle `sb_publishable_...` moderne : ce module appelle
  // GoTrue et PostgREST a la main, sans supabase-js, et c'est pour cette cle que tout a ete
  // ecrit et controle. Le passage a l'autre est une ligne, mais ce n'est pas gratuit a verifier.
  const SUPABASE_URL = 'https://qukmncqqwomhmrdhvetj.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1a21uY3Fxd29taG1yZGh2ZXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTUwMzksImV4cCI6MjEwMzgzMTAzOX0.jGCPLploiALbFMPt1edpVOyyr0emk8DP8ZdvnPLSLEM';

  // Doit rester aligne sur Authentication > Providers > Email > Minimum password length.
  // Si les deux divergent, le refus vient du serveur et le message est en anglais.
  const MDP_MIN = 8;

  // Doit rester aligne sur Authentication > Providers > Email > Password Requirements.
  // Regle choisie le 04/09/2026 : minuscule, majuscule, chiffre ET symbole obligatoires.
  // La liste des symboles est recopiee telle quelle de la documentation Supabase. Elle ne
  // contient PAS l'espace.
  //
  // Le piege francais : les sets de Supabase sont a-z et A-Z, sans accent. Un « a » accentue
  // ne compte donc ni comme minuscule, ni comme symbole, il ne compte pour rien. Un mot de
  // passe comme « Chateau2026 » ecrit avec l'accent passe la longueur mais rate le symbole,
  // et le vigneron n'a aucun moyen de le deviner. C'est toute la raison d'etre de la liste
  // cochee sous le champ : le refus ne doit jamais etre une devinette.
  const MDP_SYMBOLES = '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~';
  function mdpAUnSymbole(m){
    for(let i = 0; i < m.length; i++){ if(MDP_SYMBOLES.indexOf(m.charAt(i)) >= 0) return true; }
    return false;
  }
  const MDP_REGLES = [
    { cle:'long', texte: MDP_MIN + ' caractères ou plus', test: function(m){ return m.length >= MDP_MIN; } },
    { cle:'min',  texte:'une minuscule',                  test: function(m){ return /[a-z]/.test(m); } },
    { cle:'maj',  texte:'une majuscule',                   test: function(m){ return /[A-Z]/.test(m); } },
    { cle:'chi',  texte:'un chiffre',                      test: function(m){ return /[0-9]/.test(m); } },
    { cle:'sym',  texte:'un symbole comme ! ? * ou -',     test: mdpAUnSymbole }
  ];
  function mdpManquants(mdp){
    const m = String(mdp || '');
    return MDP_REGLES.filter(function(r){ return !r.test(m); });
  }
  // Rendue deux fois : sous le champ de l'ecran d'acces, et sous celui de l'ecran de reprise.
  function listeRegles(id, titre){
    return '<div class="bdv-porte__regles" id="' + id + '" hidden aria-live="polite">'
      + (titre ? '<p class="bdv-porte__regles-titre">' + esc(titre) + '</p>' : '')
      + MDP_REGLES.map(function(r){
          return '<p class="bdv-porte__regle" data-regle="' + r.cle + '">'
            + '<span class="bdv-porte__puce" aria-hidden="true">\u00b7</span>'
            + '<span>' + esc(r.texte) + '</span></p>';
        }).join('')
      + '</div>';
  }

  // Les trois questions posees juste apres l'inscription. Valeurs stockees en base, libelles
  // affiches : les deux ne bougent jamais ensemble, la valeur est un identifiant, pas du texte.
  const QUI = [
    { v:'vigneron',       t:'Vigneron' },
    { v:'caviste-negoce', t:'Caviste ou négociant' },
    { v:'etudiant',       t:'Étudiant ou école' },
    { v:'pro-filiere',    t:'Pro de la filière' },
    { v:'autre',          t:'Autre' }
  ];
  const VITI = [
    { v:'oui',     t:'Oui' },
    { v:'non',     t:'Non' },
    { v:'inconnu', t:'Je ne sais pas' }
  ];
  // Boutons plutot que des ronds natifs : la charte du site n'a pas de rayon et les ronds
  // systeme ne se stylent pas proprement. aria-pressed et pas role=radio, parce qu'un
  // radiogroup promet une navigation aux fleches que ces boutons n'ont pas.
  function groupeChoix(nom, options){
    return '<div class="bdv-porte__choix" data-choix="' + nom + '">'
      + options.map(function(o){
          return '<button type="button" class="bdv-porte__choix-btn" aria-pressed="false" data-valeur="'
            + esc(o.v) + '">' + esc(o.t) + '</button>';
        }).join('')
      + '</div>';
  }

  const SESSION_KEY = 'bdv_session';
  // A qui appartiennent les donnees posees dans CE navigateur. Sert au menage automatique
  // quand un autre compte se connecte sur le meme poste, cf. ecrireSession().
  const PROPRIO_KEY = 'bdv_proprietaire';
  const TRACE_KEY = 'bdv_trace_envoyee';
  const PROFIL_ATTENTE_KEY = 'bdv_profil_attente';
  const REPORT_KEY = 'bdv_porte_reportee';
  const REPORT_MS = 7 * 24 * 60 * 60 * 1000;

  function porteRecemmentEsquivee(){
    try{
      const t = Number(localStorage.getItem(REPORT_KEY));
      return t > 0 && (Date.now() - t) < REPORT_MS;
    }catch(e){ return false; }
  }
  function reporterPorte(){
    try{ localStorage.setItem(REPORT_KEY, String(Date.now())); }catch(e){}
  }

  function lireSession(){
    try{
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if(!(s && s.access_token && s.user)) return null;
      // Rattachement tardif : les navigateurs deja connectes avant le 07/09/2026 n'ont pas
      // de proprietaire enregistre. Sans ce rattrapage, le tout premier changement de compte
      // sur un de ces postes passerait sans menage, faute de savoir a qui etait le disque.
      try{ if(!localStorage.getItem(PROPRIO_KEY)) localStorage.setItem(PROPRIO_KEY, s.user.id); }catch(e){}
      return s;
    }catch(e){ return null; }
  }
  function ecrireSession(data){
    const s = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now()/1000) + (data.expires_in || 3600),
      user: { id: data.user.id, email: data.user.email }
    };
    // UN NAVIGATEUR NE PORTE LES DONNEES QUE D'UN SEUL COMPTE.
    //
    // Sans ce controle, le deuxieme utilisateur d'un poste partage ouvrait le tableau de bord
    // sur les ventes, les notes et l'objectif du premier. Et pire que de les voir : son
    // premier enregistrement les renvoyait sur SON compte, parce que rien dans le code local
    // ne rattache une note a un compte. La fuite ne demandait pas de negligence, juste deux
    // personnes et un ordinateur.
    let ancien = null;
    try{ ancien = localStorage.getItem(PROPRIO_KEY); }catch(e){}
    const change = !!(ancien && ancien !== s.user.id);
    if(change) oublierCetAppareil();
    try{ localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }catch(e){}
    try{ localStorage.setItem(PROPRIO_KEY, s.user.id); }catch(e){}
    // On recharge la page, et ce n'est pas de la prudence excessive : les ecrans ont deja lu
    // en memoire les reglages et les notes du compte precedent au moment ou la page s'est
    // affichee. Vider le disque ne les enleve pas de la memoire, et le premier enregistrement
    // les reecrirait sur le compte du nouvel arrivant. Une page neuve est la seule facon
    // honnete de repartir.
    if(change){ try{ location.reload(); }catch(e){} }
    return s;
  }
  function viderSession(){ try{ localStorage.removeItem(SESSION_KEY); }catch(e){} }

  /* ---------------- OUBLIER CE NAVIGATEUR ----------------
     Decision de Ted du 07/09/2026 : tout est en base, le compte fait foi, donc se deconnecter
     EFFACE ce poste, sans exception. Ce qui remplace l'ancienne promesse « rien ne quitte ton
     navigateur » : c'est maintenant l'inverse qui est promis, rien ne RESTE dans le navigateur.

     La contrepartie est assumee et doit etre dite a l'ecran : hors reseau, un vigneron
     deconnecte n'a plus ses chiffres tant qu'il ne s'est pas reconnecte. L'ancienne regle d'or
     (« une session ouverte une fois suffit a entrer, meme reseau coupe ») ne survit que pour
     qui reste connecte.

     On efface par PREFIXE et non par liste nommee. Une liste se perime : la prochaine cle
     `bdv_` ajoutee ailleurs dans le site serait oubliee ici, et survivrait a la deconnexion
     sur un poste partage. Le prefixe, lui, couvre ce qui n'est pas encore ecrit.

     Une seule chose n'est pas en base et disparait donc pour de bon : `bdv_annuaire_v1`, la
     memoire des noms des clients suivis. Elle se reconstruit a la premiere ouverture du
     tableau de bord, sauf pour un client suivi qui ne figure plus dans l'export : son nom
     redevient un numero Vitisoft. C'est le seul prix connu de ce menage. */
  function oublierCetAppareil(){
    try{
      const aJeter = [];
      for(let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if(k && k.indexOf('bdv_') === 0) aJeter.push(k);
      }
      aJeter.forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} });
    }catch(e){}
    // La base des lignes de vente. Supprimee entierement, pas videe store par store : une
    // base supprimee est recreee proprement par dbOpen() a la prochaine ouverture.
    try{ if(window.indexedDB) indexedDB.deleteDatabase('bdv_ventes_v4'); }catch(e){}
  }

  // L'ordre des tests compte : invalid_credentials contient "invalid", email_not_confirmed
  // contient "email". Le cas le plus precis passe toujours en premier.
  // L'erreur porte aussi .brut, le code GoTrue d'origine : l'ecran s'en sert pour reagir
  // (renvoyer un code de confirmation) sans avoir a lire le texte francais.
  function erreurLisible(status, data){
    const t = (String((data && (data.error_code || data.code)) || '') + ' '
      + String((data && (data.msg || data.error_description || data.error || data.message)) || '')).toLowerCase();
    let message;
    if(status === 429 || t.indexOf('rate') >= 0 || t.indexOf('over_email_send') >= 0)
      message = "Trop de tentatives, réessaie dans quelques minutes.";
    else if(t.indexOf('already') >= 0 || t.indexOf('exists') >= 0)
      message = "Un compte existe déjà avec cette adresse. Connecte-toi, ou utilise « Mot de passe oublié ».";
    // Les deux refus de GoTrue portent "at least" dans leur texte, celui de longueur comme
    // celui de complexite ("one character of each"). Le plus precis passe donc en premier :
    // sans ca, un mot de passe de douze caracteres sans symbole s'entend repondre qu'il est
    // trop court, et le vigneron tourne en rond devant le champ.
    else if(t.indexOf('of each') >= 0)
      message = "Mot de passe trop simple : il faut une minuscule, une majuscule, un chiffre et un symbole.";
    else if(t.indexOf('weak_password') >= 0 || t.indexOf('at least') >= 0)
      message = "Mot de passe trop court : " + MDP_MIN + " caractères minimum.";
    else if(t.indexOf('not_confirmed') >= 0)
      message = "Adresse pas encore confirmée. Un nouveau code vient de partir.";
    else if(t.indexOf('invalid_credentials') >= 0 || t.indexOf('invalid login') >= 0)
      message = "Adresse ou mot de passe incorrect.";
    else if(t.indexOf('expired') >= 0)
      message = "Ce code a expiré, demande-en un nouveau.";
    else if(t.indexOf('otp') >= 0 || t.indexOf('token') >= 0 || t.indexOf('invalid') >= 0)
      message = "Code incorrect, vérifie et réessaie.";
    else if(status === 400)
      message = "Adresse e-mail invalide.";
    else
      message = "Une erreur est survenue, réessaie dans un instant.";
    const err = new Error(message);
    err.brut = t;
    err.status = status;
    return err;
  }

  async function appelGoTrue(chemin, corps, methode, jeton){
    const entetes = { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY };
    if(jeton) entetes['Authorization'] = 'Bearer ' + jeton;
    const r = await fetch(SUPABASE_URL + '/auth/v1' + chemin, {
      method: methode || 'POST',
      headers: entetes,
      body: JSON.stringify(corps)
    });
    const data = await r.json().catch(function(){ return {}; });
    if(!r.ok) throw erreurLisible(r.status, data);
    return data;
  }

  function verifEmail(email){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Adresse e-mail invalide.");
  }
  // N'est appelee QUE a l'inscription et au changement de mot de passe. Volontairement pas a
  // la connexion : un compte cree avant un durcissement de la regle doit pouvoir entrer avec
  // le mot de passe qu'il a.
  function verifMdp(mdp){
    const manque = mdpManquants(mdp);
    if(!manque.length) return;
    throw new Error("Il faut encore " + manque.map(function(r){ return r.texte; }).join(', ') + ".");
  }

  // Deux issues possibles, selon "Confirm email" cote Supabase :
  //   { confirmer: true } confirmation active (notre choix) : pas de session, un code part.
  //   { session }         confirmation desactivee : session immediate.
  // Ne jamais supposer laquelle : un changement de reglage dans le tableau de bord Supabase
  // ne doit pas casser l'ecran.
  async function inscription(email, mdp){
    verifEmail(email);
    verifMdp(mdp);
    const data = await appelGoTrue('/signup', { email: email, password: mdp });
    if(data && data.access_token) return { session: ecrireSession(data) };
    // Adresse deja prise : GoTrue repond 200 avec un utilisateur sans identite plutot qu'une
    // erreur, pour ne pas reveler qui est inscrit. Sans ce test, l'ecran demanderait un code
    // qui n'arrivera jamais, et le vigneron attendrait devant un champ vide.
    if(data && Array.isArray(data.identities) && data.identities.length === 0){
      const err = new Error("Un compte existe déjà avec cette adresse. Connecte-toi, ou utilise « Mot de passe oublié ».");
      err.brut = 'user_already_exists';
      throw err;
    }
    return { confirmer: true };
  }

  async function confirmerInscription(email, code, extra){
    const data = await appelGoTrue('/verify', { email: email, token: code, type: 'signup' });
    const session = ecrireSession(data);
    majTrace(session, extra || {}).catch(function(){});
    return session;
  }

  async function renvoyerConfirmation(email){
    await appelGoTrue('/resend', { type: 'signup', email: email });
  }

  async function connexion(email, mdp, extra){
    verifEmail(email);
    const data = await appelGoTrue('/token?grant_type=password', { email: email, password: mdp });
    const session = ecrireSession(data);
    majTrace(session, extra || {}).catch(function(){});
    return session;
  }

  // Toujours 200, meme sur une adresse inconnue : GoTrue ne dit pas qui est inscrit. L'ecran
  // affiche donc "un code a ete envoye" dans les deux cas, et c'est correct.
  async function demanderReprise(email){
    verifEmail(email);
    await appelGoTrue('/recover', { email: email });
  }

  // Le code de reprise ouvre une session, il ne change pas le mot de passe. C'est cette
  // session qui autorise ensuite le PUT /user. Deux appels, jamais un.
  async function validerReprise(email, code){
    const data = await appelGoTrue('/verify', { email: email, token: code, type: 'recovery' });
    return ecrireSession(data);
  }

  async function changerMdp(nouveau){
    verifMdp(nouveau);
    const s = lireSession();
    if(!s) throw new Error("Session expirée, recommence depuis le début.");
    return appelGoTrue('/user', { password: nouveau }, 'PUT', s.access_token);
  }

  async function rafraichir(){
    const s = lireSession();
    if(!s || !s.refresh_token) return;
    try{
      const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if(!r.ok) return;
      const data = await r.json();
      ecrireSession(data);
    }catch(e){ /* echec silencieux, voir regle d'or */ }
  }

  // Se deconnecter EFFACE ce navigateur. L'appelant DOIT avoir prevenu et fait confirmer :
  // cette fonction ne pose aucune question, elle execute.
  function deconnexion(){ oublierCetAppareil(); }

  async function profil(){
    const s = lireSession();
    if(!s) return null;
    try{
      const r = await fetch(SUPABASE_URL + '/rest/v1/profils?id=eq.' + encodeURIComponent(s.user.id) + '&select=*', {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + s.access_token }
      });
      if(!r.ok) return null;
      const lignes = await r.json();
      return lignes[0] || null;
    }catch(e){ return null; }
  }

  async function majProfil(champs){
    const s = lireSession();
    // LEVE, et ne rend pas : un appelant qui attend cette promesse doit pouvoir
    // distinguer « ecrit » de « rien fait ». Rendre sans ecrire faisait afficher
    // « c'est enregistre » a quelqu'un dont la session avait expire, et sa saisie
    // etait perdue sans un mot.
    if(!s) throw new Error('aucune session');
    const r = await fetch(SUPABASE_URL + '/rest/v1/profils?id=eq.' + encodeURIComponent(s.user.id), {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + s.access_token,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      },
      body: JSON.stringify(champs)
    });
    if(!r.ok) throw new Error('majProfil a echoue (' + r.status + ')');
  }

  // vu_le (et consent_news si transmis) : au plus une fois par session navigateur, en tache
  // de fond, sans jamais bloquer l'ouverture de l'outil. outil_origine est ecrit a part, une
  // seule fois pour toujours : ce n'est pas la meme garantie, ca ne peut pas etre la meme
  // ecriture (voir ecrireSiVide).
  async function majTrace(session, extra){
    if(sessionStorage.getItem(TRACE_KEY) === '1') return;
    sessionStorage.setItem(TRACE_KEY, '1');
    try{
      await majProfil(Object.assign({ vu_le: new Date().toISOString() }, extra));
      const script = document.currentScript || document.querySelector('script[data-outil]');
      const outil = (script && script.dataset && script.dataset.outil) || 'inconnu';
      await ecrireSiVide('outil_origine', outil, session);
    }catch(e){
      // la tentative suivante rejouera l'ecriture plutot que de la perdre en silence.
      sessionStorage.removeItem(TRACE_KEY);
    }
  }

  // Ecrit champ=valeur seulement si la colonne est encore vide : idempotent, sans lecture
  // prealable. outil_origine ne doit valoir que la toute premiere porte franchie.
  async function ecrireSiVide(champ, valeur, session){
    const r = await fetch(SUPABASE_URL + '/rest/v1/profils?id=eq.' + encodeURIComponent(session.user.id) + '&' + champ + '=is.null', {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + session.access_token,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      },
      body: JSON.stringify((function(){ const o = {}; o[champ] = valeur; return o; })())
    });
    if(!r.ok) throw new Error('ecrireSiVide a echoue (' + r.status + ')');
  }

  // ---------------- ECRAN DE PORTE ----------------
  let stylesInjectes = false;
  function injecterStyles(){
    if(stylesInjectes) return;
    stylesInjectes = true;
    const css = '.bdv-porte{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:2rem;background:var(--bordeaux-veil, rgba(40,10,18,.7))}'
      + '.bdv-porte__carte{max-width:440px;width:100%;background:var(--white,#FFFFFF);border-top:3px solid var(--bordeaux,#5A1525);position:relative;box-shadow:var(--ombre-dure, 6px 6px 0 rgba(30,37,54,0.18));padding:2.2rem 2rem;text-align:left}'
      + '.bdv-porte__eyebrow{font-family:var(--font-corps,\'Inter\',-apple-system,BlinkMacSystemFont,system-ui,sans-serif);font-size:var(--t-mini,.7rem);text-transform:uppercase;letter-spacing:var(--ls-large,.15em);color:var(--bordeaux,#5A1525);margin-bottom:.6rem}'
      + '.bdv-porte__titre{font-family:var(--font-titre,\'Fraunces\',Georgia,\'Times New Roman\',serif);font-weight:400;font-size:1.5rem;color:var(--ink,#1E2536);margin-bottom:.6rem}'
      + '.bdv-porte__reassure{font-size:var(--t-base,.88rem);color:var(--muted,#63523D);margin-bottom:1.4rem;line-height:var(--lh-normal,1.5)}'
      + '.bdv-porte__note{font-size:var(--t-petit,.78rem);color:var(--muted,#63523D);margin-bottom:.9rem;line-height:var(--lh-normal,1.5)}'
      + '.bdv-porte__label{display:block;font-family:var(--font-corps,\'Inter\',-apple-system,BlinkMacSystemFont,system-ui,sans-serif);font-size:var(--t-mini,.7rem);text-transform:uppercase;letter-spacing:var(--ls-doux,.05em);color:var(--muted,#63523D);margin-bottom:.35rem}'
      + '.bdv-porte__input{width:100%;padding:.65rem .75rem;border:1px solid var(--rule-fort,rgba(30,37,54,.42));background:var(--paper-light,#F5EFE0);font-family:var(--font-corps,\'Inter\',-apple-system,BlinkMacSystemFont,system-ui,sans-serif);font-size:var(--t-corps,1rem);color:var(--ink,#1E2536);margin-bottom:.9rem;border-radius:var(--r-nul,0)}'
      + '.bdv-porte__input:focus{outline:2px solid var(--bordeaux,#5A1525);outline-offset:1px}'
      + '.bdv-porte__input--code{letter-spacing:.3em;font-family:var(--font-mono,\'JetBrains Mono\',\'Courier New\',monospace);text-align:center;font-size:1.2rem}'
      + '.bdv-porte__aide{font-size:var(--t-mini,.7rem);color:var(--muted,#63523D);margin:-.5rem 0 .9rem}'
      + '.bdv-porte__regles{margin:-.5rem 0 .9rem}'
      + '.bdv-porte__regles-titre{font-size:var(--t-mini,.7rem);color:var(--muted,#63523D);margin:0 0 .25rem}'
      + '.bdv-porte__regle{display:flex;gap:.4rem;align-items:baseline;font-size:var(--t-mini,.7rem);color:var(--muted,#63523D);margin:0;line-height:1.7}'
      + '.bdv-porte__regle--ok{color:var(--ok,#2D6A2D)}'
      + '.bdv-porte__puce{font-family:var(--font-corps,\'Inter\',-apple-system,BlinkMacSystemFont,system-ui,sans-serif);flex:0 0 .8rem}'
      + '.bdv-porte__chk{display:flex;align-items:flex-start;gap:.5rem;font-size:var(--t-petit,.78rem);color:var(--muted,#63523D);margin-bottom:1.1rem;line-height:var(--lh-normal,1.5)}'
      + '.bdv-porte__btn{width:100%;padding:.7rem 1rem;background:var(--bordeaux,#5A1525);color:var(--on-dark,#EFE7D6);border:none;font-family:var(--font-corps,\'Inter\',-apple-system,BlinkMacSystemFont,system-ui,sans-serif);font-size:var(--t-mini,.7rem);text-transform:uppercase;letter-spacing:var(--ls-doux,.05em);font-weight:500;cursor:pointer;border-radius:var(--r-nul,0)}'
      + '.bdv-porte__btn:hover{background:var(--bordeaux-vif,#7A1525)}'
      + '.bdv-porte__btn:disabled{opacity:.6;cursor:default}'
      + '.bdv-porte__btn--secondaire{background:transparent;color:var(--bordeaux,#5A1525);border:1px solid var(--rule-fort,rgba(30,37,54,.42));margin-top:.6rem}'
      + '.bdv-porte__btn--secondaire:hover{background:var(--paper-light,#F5EFE0)}'
      + '.bdv-porte__lien{display:block;margin:.7rem auto 0;background:none;border:none;padding:0;color:var(--bordeaux,#5A1525);font-family:var(--font-corps,\'Inter\',-apple-system,BlinkMacSystemFont,system-ui,sans-serif);font-size:var(--t-mini,.7rem);text-decoration:underline;cursor:pointer}'
      + '.bdv-porte__erreur{color:var(--danger-deep,#A03530);font-size:var(--t-petit,.78rem);margin-top:.6rem}'
      // La bascule vers l'autre etat, sous un filet : elle se lit comme une sortie, pas comme
      // une action de plus. Le bouton reste en ligne dans la phrase, contrairement aux autres
      // .bdv-porte__lien qui sont centres sur leur propre ligne.
      + '.bdv-porte__bascule{margin:1.1rem 0 0;padding-top:.9rem;border-top:1px solid var(--rule,rgba(30,37,54,.15));text-align:center;font-family:var(--font-corps,\'Inter\',-apple-system,BlinkMacSystemFont,system-ui,sans-serif);font-size:var(--t-petit,.78rem);color:var(--muted,#63523D)}'
      + '.bdv-porte__bascule .bdv-porte__lien{display:inline;margin:0;font-size:var(--t-petit,.78rem)}'
      + '.bdv-porte__legal{font-size:var(--t-mini,.7rem);color:var(--muted,#63523D);margin-top:1.4rem;font-family:var(--font-corps,\'Inter\',-apple-system,BlinkMacSystemFont,system-ui,sans-serif)}'
      + '.bdv-porte__legal a{color:var(--bordeaux,#5A1525)}'
      // Sortir n'est pas une action : la croix se range dans le coin, elle ne prend plus
      // une ligne de bouton pleine largeur au meme rang que « creer » et « se connecter ».
      + '.bdv-porte__choix{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 .9rem}'
      + '.bdv-porte__choix-btn{padding:.45rem .8rem;min-height:44px;background:var(--paper-light,#F5EFE0);border:1px solid var(--rule-fort,rgba(30,37,54,.42));color:var(--ink,#1E2536);font-family:var(--font-corps,\'Inter\',sans-serif);font-size:var(--t-petit,.78rem);cursor:pointer;border-radius:var(--r-nul,0)}'
      + '.bdv-porte__choix-btn:hover{border-color:var(--bordeaux,#5A1525)}'
      + '.bdv-porte__choix-btn[aria-pressed="true"]{background:var(--bordeaux,#5A1525);color:var(--on-dark,#EFE7D6);border-color:var(--bordeaux,#5A1525)}'
      + '.bdv-porte__croix{position:absolute;top:.4rem;right:.4rem;min-width:44px;min-height:44px;background:none;border:none;padding:0;font-size:1.4rem;line-height:1;color:var(--muted,#63523D);cursor:pointer}'
      + '.bdv-porte__croix:hover{color:var(--bordeaux,#5A1525)}';
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function porte(options){
    options = options || {};
    // Configuration absente vaut porte ouverte, jamais porte bloquee : meme logique que la
    // regle d'or, notre infrastructure ne prend jamais en otage les donnees du vigneron.
    if(!SUPABASE_URL || !SUPABASE_ANON_KEY) return Promise.resolve(null);
    // Un refus recent (bouton "Plus tard") n'est reproposable qu'au bout de sept jours, ou
    // immediatement sur un nouvel import (l'appelant ne passe alors pas esquivable:true).
    if(options.esquivable && porteRecemmentEsquivee()) return Promise.resolve(null);
    injecterStyles();
    // 'inscription' ou 'connexion'. Decide ce que MONTRE l'ecran d'acces, pas ce qu'il sait
    // faire : les deux actions restent atteignables en un clic par la ligne de bascule.
    // Defaut volontaire a l'inscription : presque tout le monde arrive ici sans compte, et
    // celui qui revient a desormais une entree « Connexion » a lui dans le menu du site.
    const modeInitial = (options.mode === 'connexion') ? 'connexion' : 'inscription';
    const TITRES = { inscription: 'Ouvre ton bureau.', connexion: 'Content de te revoir.' };
    return new Promise(function(resolve){
      const overlay = document.createElement('div');
      overlay.className = 'bdv-porte';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'bdvPorteTitre');
      overlay.innerHTML =
        '<div class="bdv-porte__carte">'
        + ((options.esquivable || options.fermable) ? '<button class="bdv-porte__croix" id="bdvCroix" type="button" aria-label="Fermer">\u00d7</button>' : '')
        + '<p class="bdv-porte__eyebrow">Le Bureau du Vigneron</p>'
        + '<h2 id="bdvPorteTitre" class="bdv-porte__titre"></h2>'
        // Etape 1 : acces. UN seul ecran, DEUX etats. L'etat affiche ne montre que ce qui le
        // concerne : celui qui vient se connecter ne lit pas les regles d'un mot de passe qu'il
        // possede deja, celui qui s'inscrit ne voit pas « mot de passe oublie ». Les deux
        // boutons restent dans la page, un seul est visible a la fois. Le 400 du serveur ne dit
        // pas si c'est le mot de passe qui est faux ou le compte qui n'existe pas : l'intention
        // doit donc venir de l'ecran, jamais d'une devinette.
        + '<div data-etape="acces">'
        + '<label class="bdv-porte__label" for="bdvEmail">Ton email</label>'
        + '<input class="bdv-porte__input" type="email" id="bdvEmail" autocomplete="email" placeholder="toi@domaine.fr">'
        + '<label class="bdv-porte__label" for="bdvMdp">Ton mot de passe</label>'
        // L'attribut autocomplete est repose par poserMode a chaque bascule, et c'est lui SEUL
        // qui decide si le gestionnaire de mots de passe propose de REMPLIR (current-password)
        // ou d'EN GENERER UN (new-password). Fige sur current-password jusqu'au 07/09/2026, il
        // proposait de remplir un compte inexistant a quelqu'un en train de s'inscrire.
        + '<input class="bdv-porte__input" type="password" id="bdvMdp" autocomplete="new-password">'
        // Annonce statique construite depuis MDP_REGLES, jamais recopiee : un refus muet
        // sur une regle qu'on n'avait pas annoncee est la panne la plus couteuse de cet ecran.
        + '<p class="bdv-porte__aide" id="bdvAide">Il te faut : ' + esc(MDP_REGLES.map(function(r){ return r.texte; }).join(', ')) + '.</p>'
        + listeRegles('bdvReglesAcces', 'Pour créer un compte, il faut :')
        + '<label class="bdv-porte__chk" id="bdvNewsLabel"><input type="checkbox" id="bdvNews"> Recevoir l\'édition bimensuelle du Bureau du Vigneron</label>'
        // Un seul de ces deux boutons est visible, et il est plein : le bouton principal de
        // l'ecran est toujours l'action de l'etat affiche. Plus de second bouton fantome au
        // meme rang, qui obligeait l'oeil a choisir entre deux propositions equivalentes.
        + '<button class="bdv-porte__btn" id="bdvBtnInscription" type="button">Créer mon compte</button>'
        + '<button class="bdv-porte__btn" id="bdvBtnConnexion" type="button">Me connecter</button>'
        + '<button class="bdv-porte__lien" id="bdvOublie" type="button">Mot de passe oublié ?</button>'
        + (options.esquivable ? '<button class="bdv-porte__btn bdv-porte__btn--secondaire" id="bdvPlusTard" type="button">Plus tard</button>' : '')
        + '<p class="bdv-porte__erreur" id="bdvErreurAcces" hidden></p>'
        // La bascule, separee du reste par un filet : ce n'est pas une action de l'ecran, c'est
        // la sortie vers l'autre etat. Elle est TOUJOURS visible ; c'est la seule chose qui
        // empeche l'ecran de rester muet devant quelqu'un qui n'est pas dans le bon etat.
        + '<p class="bdv-porte__bascule"><span id="bdvBasculeTexte"></span> '
        + '<button class="bdv-porte__lien" id="bdvBtnBascule" type="button"></button></p>'
        + '</div>'
        // Etape 2 : le code a six chiffres. Le meme ecran sert a confirmer une inscription et
        // a reprendre un mot de passe oublie ; seule la variable modeCode change.
        + '<div data-etape="code" hidden>'
        + '<p class="bdv-porte__note" id="bdvNoteCode"></p>'
        + '<label class="bdv-porte__label" for="bdvCode">Code reçu</label>'
        // maxlength volontairement large et pas cale sur une longueur precise. Le 05/09/2026
        // ce champ etait bloque a 6 alors que le reglage Supabase avait ete passe a 8 : le code
        // arrivait bien, et les deux derniers chiffres refusaient de s'ecrire, sans un seul
        // message d'erreur. Meme famille de panne que MDP_MIN desaccorde de son reglage serveur.
        // Ici on ne duplique plus le reglage du tout : le serveur tranche, l'ecran suit.
        + '<input class="bdv-porte__input bdv-porte__input--code" type="text" id="bdvCode" inputmode="numeric" pattern="[0-9]*" maxlength="10" autocomplete="one-time-code">'
        + '<button class="bdv-porte__btn" id="bdvBtnCode" type="button">Valider</button>'
        + '<button class="bdv-porte__lien" id="bdvRenvoyer" type="button">Renvoyer le code</button>'
        + '<p class="bdv-porte__erreur" id="bdvErreurCode" hidden></p>'
        + '</div>'
        // Etape 3 : uniquement apres une reprise. Le code a ouvert une session, il reste a
        // poser le nouveau mot de passe avant d'entrer.
        + '<div data-etape="nouveau" hidden>'
        + '<p class="bdv-porte__note">Code validé. Choisis un nouveau mot de passe.</p>'
        + '<label class="bdv-porte__label" for="bdvNouveauMdp">Nouveau mot de passe</label>'
        + '<input class="bdv-porte__input" type="password" id="bdvNouveauMdp" autocomplete="new-password">'
        + listeRegles('bdvReglesNouveau', 'Il faut :')
        + '<button class="bdv-porte__btn" id="bdvBtnNouveau" type="button">Enregistrer et entrer</button>'
        + '<p class="bdv-porte__erreur" id="bdvErreurNouveau" hidden></p>'
        + '</div>'
        // Etape 4 : les trois questions, uniquement apres une INSCRIPTION reussie. Jamais a la
        // connexion : quelqu'un qui revient n'a pas a repasser un formulaire. Chaque question est
        // sautable, et rien de ce qui est ici ne conditionne l'ouverture du compte.
        + '<div data-etape="profil" hidden>'
        + '<p class="bdv-porte__note">Ton compte est ouvert. Cinq questions rapides pour te montrer ce qui te concerne plutôt que tout le reste. Tu peux les passer.</p>'
        + '<label class="bdv-porte__label" for="bdvPrenom">Ton prénom</label>'
        + '<input class="bdv-porte__input" type="text" id="bdvPrenom" autocomplete="given-name">'
        + '<p class="bdv-porte__label">Tu es</p>'
        + groupeChoix('qui', QUI)
        + '<label class="bdv-porte__label" for="bdvDomaine">Ton domaine ou ta structure</label>'
        + '<input class="bdv-porte__input" type="text" id="bdvDomaine" autocomplete="organization">'
        + '<label class="bdv-porte__label" for="bdvCp">Ton code postal</label>'
        + '<input class="bdv-porte__input" type="text" id="bdvCp" inputmode="numeric" maxlength="5" autocomplete="postal-code">'
        + '<p class="bdv-porte__label">Tu utilises Vitisoft</p>'
        + groupeChoix('viti', VITI)
        + '<button class="bdv-porte__btn" id="bdvBtnProfil" type="button">Enregistrer et entrer</button>'
        + '<button class="bdv-porte__lien" id="bdvProfilPasser" type="button">Passer cette étape</button>'
        + '</div>'
        + '<p class="bdv-porte__legal">En continuant, tu acceptes la <a href="/politique-confidentialite/" target="_blank" rel="noopener">politique de confidentialité</a>.</p>'
        + '</div>';
      document.body.appendChild(overlay);

      const etapes = {
        acces: overlay.querySelector('[data-etape="acces"]'),
        code: overlay.querySelector('[data-etape="code"]'),
        nouveau: overlay.querySelector('[data-etape="nouveau"]'),
        profil: overlay.querySelector('[data-etape="profil"]')
      };
      const champEmail = overlay.querySelector('#bdvEmail');
      const champMdp = overlay.querySelector('#bdvMdp');
      const champNews = overlay.querySelector('#bdvNews');
      const btnConnexion = overlay.querySelector('#bdvBtnConnexion');
      const btnInscription = overlay.querySelector('#bdvBtnInscription');
      const btnOublie = overlay.querySelector('#bdvOublie');
      const btnPlusTard = overlay.querySelector('#bdvPlusTard');
      const btnCroix = overlay.querySelector('#bdvCroix');
      const erreurAcces = overlay.querySelector('#bdvErreurAcces');
      const noteCode = overlay.querySelector('#bdvNoteCode');
      const champCode = overlay.querySelector('#bdvCode');
      const btnCode = overlay.querySelector('#bdvBtnCode');
      const btnRenvoyer = overlay.querySelector('#bdvRenvoyer');
      const erreurCode = overlay.querySelector('#bdvErreurCode');
      const champNouveau = overlay.querySelector('#bdvNouveauMdp');
      const btnNouveau = overlay.querySelector('#bdvBtnNouveau');
      const erreurNouveau = overlay.querySelector('#bdvErreurNouveau');
      const titreEl = overlay.querySelector('#bdvPorteTitre');
      const aideMdp = overlay.querySelector('#bdvAide');
      const newsLabel = overlay.querySelector('#bdvNewsLabel');
      const btnBascule = overlay.querySelector('#bdvBtnBascule');
      const basculeTexte = overlay.querySelector('#bdvBasculeTexte');
      champEmail.focus();

      // 'inscription' ou 'connexion'. Repose par poserMode, lu par la touche Entree et par
      // l'affichage des regles de mot de passe.
      let mode = modeInitial;

      // 'signup' ou 'recovery'. Decide ce que valide l'etape 2 et ou elle mene ensuite.
      let modeCode = 'signup';
      // La session obtenue par inscription, gardee le temps des trois questions.
      let sessionFraiche = null;

      const champPrenom = overlay.querySelector('#bdvPrenom');
      const champDomaine = overlay.querySelector('#bdvDomaine');
      const champCp = overlay.querySelector('#bdvCp');
      const btnProfil = overlay.querySelector('#bdvBtnProfil');
      const btnProfilPasser = overlay.querySelector('#bdvProfilPasser');

      // Un seul choix retenu par groupe. Recliquer sur le meme le retire : une question
      // repondue par erreur doit pouvoir redevenir sans reponse.
      overlay.addEventListener('click', function(e){
        const btn = e.target.closest && e.target.closest('.bdv-porte__choix-btn');
        if(!btn) return;
        const actif = btn.getAttribute('aria-pressed') === 'true';
        btn.parentNode.querySelectorAll('.bdv-porte__choix-btn').forEach(function(b){
          b.setAttribute('aria-pressed', 'false');
        });
        btn.setAttribute('aria-pressed', actif ? 'false' : 'true');
      });
      function choixDe(nom){
        const b = overlay.querySelector('[data-choix="' + nom + '"] [aria-pressed="true"]');
        return b ? b.getAttribute('data-valeur') : null;
      }

      function versProfil(session){
        sessionFraiche = session;
        montrer('profil');
        champPrenom.focus();
      }

      async function enregistrerProfil(){
        const champs = {};
        const pre = champPrenom.value.trim(); if(pre) champs.prenom = pre;
        const qui = choixDe('qui');           if(qui) champs.profil = qui;
        const dom = champDomaine.value.trim();if(dom) champs.domaine = dom;
        const cp  = champCp.value.trim();     if(cp)  champs.code_postal = cp;
        const viti = choixDe('viti');         if(viti) champs.utilise_vitisoft = viti;
        if(!Object.keys(champs).length){ entrer(sessionFraiche); return; }
        occupe(btnProfil, 'Enregistrement…');
        try{
          await majProfil(champs);
        }catch(e){
          // Regle d'or : rien de notre infrastructure ne retient quelqu'un dehors. L'echec est
          // mis en file d'attente et rejoue au prochain chargement, il n'est jamais perdu ni
          // affiche comme une panne a quelqu'un dont le compte vient d'etre cree.
          try{ localStorage.setItem(PROFIL_ATTENTE_KEY, JSON.stringify(champs)); }catch(e2){}
        }finally{
          libre(btnProfil);
        }
        entrer(sessionFraiche);
      }

      function montrer(nom){
        Object.keys(etapes).forEach(function(k){ etapes[k].hidden = (k !== nom); });
      }
      function montrerErreur(el, e){ el.textContent = e.message; el.hidden = false; }
      function masquerErreur(el){ el.hidden = true; }
      function occupe(btn, texte){
        btn.dataset.repos = btn.textContent;
        btn.disabled = true;
        btn.textContent = texte;
      }
      function libre(btn){
        btn.disabled = false;
        if(btn.dataset.repos) btn.textContent = btn.dataset.repos;
      }

      function entrer(session){
        document.removeEventListener('keydown', surEchap);
        overlay.remove();
        resolve(session);
      }
      function esquiver(){
        // Seul le report « Plus tard » propose apres un import se souvient d'avoir ete refuse.
        // Une fermeture depuis un bouton du site ne memorise rien : sinon le meme bouton
        // resterait muet pendant sept jours, ce qui ressemblerait a une panne.
        if(options.esquivable) reporterPorte();
        document.removeEventListener('keydown', surEchap);
        overlay.remove();
        resolve(null);
      }
      function surEchap(e){ if(e.key === 'Escape') esquiver(); }
      if(options.esquivable || options.fermable){
        if(btnPlusTard) btnPlusTard.addEventListener('click', esquiver);
        if(btnCroix) btnCroix.addEventListener('click', esquiver);
        document.addEventListener('keydown', surEchap);
      }

      function extraConsent(){ return champNews.checked ? { consent_news: true } : {}; }

      function versCode(mode, phrase){
        modeCode = mode;
        noteCode.innerHTML = phrase;
        champCode.value = '';
        masquerErreur(erreurCode);
        montrer('code');
        champCode.focus();
      }

      async function seConnecter(){
        masquerErreur(erreurAcces);
        const email = champEmail.value.trim();
        occupe(btnConnexion, 'Connexion…');
        try{
          entrer(await connexion(email, champMdp.value, extraConsent()));
        }catch(e){
          // Compte cree mais jamais confirme : sans ce rattrapage le vigneron est enferme
          // dehors pour toujours, il n'a aucun moyen de redemander le code depuis l'ecran.
          if(e.brut && e.brut.indexOf('not_confirmed') >= 0){
            // On passe a l'etape 2 dans tous les cas, meme si le renvoi echoue : un 429 veut
            // dire qu'un code vient de partir, donc que le vigneron en a un dans sa boite.
            // L'enfermer sur cet ecran a cause d'une limite de debit serait absurde.
            let renvoye = true;
            try{ await renvoyerConfirmation(email); }catch(e2){ renvoye = false; }
            versCode('signup', renvoye
              ? 'Ton adresse n\'était pas encore confirmée. Un code à 6 chiffres vient d\'être envoyé à <b>' + esc(email) + '</b>.'
              : 'Ton adresse n\'est pas encore confirmée. Saisis le code déjà envoyé à <b>' + esc(email) + '</b>, ou attends une minute avant de le faire renvoyer.');
            return;
          }
          montrerErreur(erreurAcces, e);
        }finally{
          libre(btnConnexion);
        }
      }

      async function sInscrire(){
        masquerErreur(erreurAcces);
        const email = champEmail.value.trim();
        occupe(btnInscription, 'Création…');
        try{
          const issue = await inscription(email, champMdp.value);
          if(issue.session){
            majTrace(issue.session, extraConsent()).catch(function(){});
            versProfil(issue.session);
            return;
          }
          versCode('signup', 'Un code à 6 chiffres vient d\'être envoyé à <b>' + esc(email) + '</b>.');
        }catch(e){
          montrerErreur(erreurAcces, e);
        }finally{
          libre(btnInscription);
        }
      }

      async function oublie(){
        masquerErreur(erreurAcces);
        const email = champEmail.value.trim();
        occupe(btnOublie, 'Envoi…');
        try{
          await demanderReprise(email);
          versCode('recovery', 'Si un compte existe pour <b>' + esc(email) + '</b>, un code à 6 chiffres vient d\'y être envoyé.');
        }catch(e){
          montrerErreur(erreurAcces, e);
        }finally{
          libre(btnOublie);
        }
      }

      async function validerCode(){
        masquerErreur(erreurCode);
        const email = champEmail.value.trim();
        const code = champCode.value.trim();
        occupe(btnCode, 'Vérification…');
        try{
          if(modeCode === 'signup'){
            versProfil(await confirmerInscription(email, code, extraConsent()));
            return;
          }
          await validerReprise(email, code);
          montrer('nouveau');
          champNouveau.focus();
        }catch(e){
          montrerErreur(erreurCode, e);
        }finally{
          libre(btnCode);
        }
      }

      async function poserNouveauMdp(){
        masquerErreur(erreurNouveau);
        occupe(btnNouveau, 'Enregistrement…');
        try{
          await changerMdp(champNouveau.value);
          const session = lireSession();
          majTrace(session, extraConsent()).catch(function(){});
          entrer(session);
        }catch(e){
          montrerErreur(erreurNouveau, e);
        }finally{
          libre(btnNouveau);
        }
      }

      function renvoyer(){
        masquerErreur(erreurCode);
        const email = champEmail.value.trim();
        const p = (modeCode === 'signup') ? renvoyerConfirmation(email) : demanderReprise(email);
        p.catch(function(e){ montrerErreur(erreurCode, e); });
      }

      btnConnexion.addEventListener('click', seConnecter);
      btnInscription.addEventListener('click', sInscrire);
      btnOublie.addEventListener('click', oublie);
      btnCode.addEventListener('click', validerCode);
      btnRenvoyer.addEventListener('click', renvoyer);
      btnNouveau.addEventListener('click', poserNouveauMdp);
      btnProfil.addEventListener('click', enregistrerProfil);
      btnProfilPasser.addEventListener('click', function(){ entrer(sessionFraiche); });
      // La liste ne s'affiche qu'au focus ou a la saisie sur l'ecran d'acces : un vigneron qui
      // revient juste se connecter n'a pas a lire les regles d'inscription. Sur l'ecran de
      // reprise elle est visible tout de suite, il n'y a la que du nouveau mot de passe.
      const reglesAcces = overlay.querySelector('#bdvReglesAcces');
      const reglesNouveau = overlay.querySelector('#bdvReglesNouveau');
      function majRegles(boite, mdp, toujours){
        if(!boite) return;
        const v = String(mdp || '');
        boite.hidden = !(toujours || v.length);
        MDP_REGLES.forEach(function(r){
          const ligne = boite.querySelector('[data-regle="' + r.cle + '"]');
          if(!ligne) return;
          const ok = r.test(v);
          ligne.className = 'bdv-porte__regle' + (ok ? ' bdv-porte__regle--ok' : '');
          const puce = ligne.querySelector('.bdv-porte__puce');
          if(puce) puce.textContent = ok ? '\u2713' : '\u00b7';
        });
      }
      champMdp.addEventListener('input', function(){ if(mode === 'inscription') majRegles(reglesAcces, champMdp.value); });
      champMdp.addEventListener('focus', function(){ if(mode === 'inscription') majRegles(reglesAcces, champMdp.value, true); });
      champNouveau.addEventListener('input', function(){ majRegles(reglesNouveau, champNouveau.value, true); });
      majRegles(reglesNouveau, '', true);

      // Bascule d'un etat a l'autre SANS rien perdre : l'email et le mot de passe deja tapes
      // restent en place. Quelqu'un qui s'est trompe d'etat ne doit pas payer sa meprise en
      // retapant son adresse. Declaree ici et pas plus haut : elle lit reglesAcces, qui est
      // un const declare juste au-dessus.
      function poserMode(m){
        mode = (m === 'connexion') ? 'connexion' : 'inscription';
        const co = (mode === 'connexion');
        // Le titre passe par le bouton d'ouverture (data-bdv-titre) uniquement pour l'etat par
        // lequel on est entre. Apres une bascule il redevient neutre : « Ton bureau t'attend »
        // au-dessus d'un formulaire de connexion ne veut plus rien dire.
        titreEl.textContent = (mode === modeInitial && options.titre) ? options.titre : TITRES[mode];
        aideMdp.hidden = co;
        newsLabel.hidden = co;
        btnInscription.hidden = co;
        btnConnexion.hidden = !co;
        btnOublie.hidden = !co;
        // Voir le commentaire du champ : cette ligne fait toute la difference entre « remplir »
        // et « generer » dans le gestionnaire de mots de passe du vigneron.
        champMdp.setAttribute('autocomplete', co ? 'current-password' : 'new-password');
        basculeTexte.textContent = co ? 'Pas encore de compte ?' : 'Tu as déjà un compte ?';
        btnBascule.textContent = co ? 'En créer un' : 'Me connecter';
        masquerErreur(erreurAcces);
        if(co) reglesAcces.hidden = true;
        else majRegles(reglesAcces, champMdp.value);
      }
      btnBascule.addEventListener('click', function(){
        poserMode(mode === 'connexion' ? 'inscription' : 'connexion');
        (champEmail.value.trim() ? champMdp : champEmail).focus();
      });
      poserMode(modeInitial);

      champEmail.addEventListener('keydown', function(e){ if(e.key === 'Enter') champMdp.focus(); });
      // Entree valide l'action de l'etat AFFICHE, et pas systematiquement la connexion :
      // sinon une inscription faite au clavier repartait en « adresse ou mot de passe
      // incorrect », sur un compte qui n'existait effectivement pas encore.
      champMdp.addEventListener('keydown', function(e){
        if(e.key !== 'Enter') return;
        if(mode === 'connexion') seConnecter(); else sInscrire();
      });
      champCode.addEventListener('keydown', function(e){ if(e.key === 'Enter') validerCode(); });
      // Un code colle depuis une application de messagerie arrive souvent avec une espace, un
      // tiret ou un retour a la ligne. On ne garde que les chiffres, sinon GoTrue repond
      // « code incorrect » sur un code parfaitement juste.
      champCode.addEventListener('input', function(){
        const propre = champCode.value.replace(/\D+/g, '');
        if(propre !== champCode.value) champCode.value = propre;
      });
      champNouveau.addEventListener('keydown', function(e){ if(e.key === 'Enter') poserNouveauMdp(); });
    });
  }

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }

  // ---------------- ACCES BRUT A POSTGREST, POUR LES AUTRES MODULES ----------------
  // Expose pour que la synchronisation (bdv-sync.js) n'ait pas a recopier l'URL du projet,
  // la cle anon et la lecture de session. Une seule verite pour les trois : le jour ou la
  // cle tourne, un seul endroit change.
  // Renvoie null, sans lever d'erreur, si la configuration manque ou s'il n'y a pas de
  // session : l'appelant traite ce cas comme « pas de serveur », jamais comme une panne.
  async function api(chemin, options){
    if(!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    const s = lireSession();
    if(!s) return null;
    options = options || {};
    const entetes = Object.assign({
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + s.access_token,
      'Content-Type': 'application/json'
    }, options.entetes || {});
    const r = await fetch(SUPABASE_URL + '/rest/v1' + chemin, {
      method: options.methode || 'GET',
      headers: entetes,
      body: (options.corps === undefined) ? undefined : JSON.stringify(options.corps)
    });
    if(!r.ok){
      const detail = await r.text().catch(function(){ return ''; });
      const err = new Error('Supabase a refuse ' + chemin + ' (' + r.status + ')');
      err.status = r.status;
      err.detail = detail;
      throw err;
    }
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  // Compte les lignes d'une table SANS les rapatrier. PostgREST rend le total dans l'en-tete
  // Content-Range quand on demande `count=exact` : « 0-0/4942 ». On ne lit qu'une seule ligne,
  // donc c'est utilisable a chaque rendu d'ecran.
  //
  // Rend null quand le compte n'est pas lisible, JAMAIS un nombre approximatif : l'appelant
  // doit pouvoir se taire plutot qu'afficher une comparaison inventee. C'est tout l'interet
  // d'un compteur d'ecart : s'il peut mentir, il ne sert plus a rien.
  async function compter(chemin){
    if(!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    const s = lireSession();
    if(!s) return null;
    try{
      const r = await fetch(SUPABASE_URL + '/rest/v1' + chemin, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + s.access_token,
          'Range': '0-0',
          'Prefer': 'count=exact'
        }
      });
      if(!r.ok) return null;
      const cr = r.headers.get('Content-Range');   // « 0-0/4942 », ou « */0 » si la table est vide
      if(!cr) return null;
      const n = parseInt(String(cr).split('/')[1], 10);
      return isNaN(n) ? null : n;
    }catch(e){ return null; }
  }

  function monId(){ const s = lireSession(); return s ? s.user.id : null; }

  // ---------------- OUVERTURE DEPUIS N'IMPORTE QUEL BOUTON ----------------
  // Fermable par defaut : on arrive ici par un clic volontaire, pas par une interruption.
  function ouvrir(options){
    options = Object.assign({ fermable: true }, options || {});
    return porte(options);
  }

  // Tout element portant data-bdv-compte ouvre la fenetre par dessus la page en cours.
  // Son href reste une vraie adresse (/compte/), volontairement : le lien fonctionne sans
  // JavaScript, il reste partageable, et il s'ouvre normalement dans un nouvel onglet.
  // L'interception ne fait que remplacer un changement de page par une surimpression.
  //   data-bdv-titre : le titre affiche en haut de la fenetre, propre a ce bouton
  //   data-bdv-apres : l'adresse ou aller une fois entre. Absente, on reste sur place.
  //   data-bdv-mode  : « connexion » pour ouvrir directement sur l'ecran de connexion.
  //                    Absente, la fenetre s'ouvre sur l'inscription.
  function surClicCompte(e){
    if(!e.target || !e.target.closest) return;
    const cible = e.target.closest('[data-bdv-compte]');
    if(!cible) return;
    // Ctrl, cmd, maj ou clic du milieu : c'est une demande d'ouvrir ailleurs, on ne touche pas.
    if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
    e.preventDefault();
    const apres = cible.getAttribute('data-bdv-apres');
    if(lireSession()){ if(apres) location.href = apres; return; }
    ouvrir({
      titre: cible.getAttribute('data-bdv-titre') || undefined,
      mode: cible.getAttribute('data-bdv-mode') || undefined
    })
      .then(function(session){ if(session && apres) location.href = apres; });
  }
  document.addEventListener('click', surClicCompte);

  window.BdvCompte = {
    session: lireSession,
    inscription: inscription,
    confirmerInscription: confirmerInscription,
    renvoyerConfirmation: renvoyerConfirmation,
    connexion: connexion,
    demanderReprise: demanderReprise,
    validerReprise: validerReprise,
    changerMdp: changerMdp,
    rafraichir: rafraichir,
    deconnexion: deconnexion,
    profil: profil,
    majProfil: majProfil,
    porte: porte,
    ouvrir: ouvrir,
    api: api,
    compter: compter,
    oublierCetAppareil: oublierCetAppareil,
    monId: monId
  };

  // Un profil que le reseau avait refuse repart a la premiere occasion, et la file se vide
  // seulement quand l'ecriture a reussi.
  async function rejouerProfilEnAttente(){
    let champs = null;
    try{ champs = JSON.parse(localStorage.getItem(PROFIL_ATTENTE_KEY)); }catch(e){ return; }
    if(!champs) return;
    try{
      await majProfil(champs);
      localStorage.removeItem(PROFIL_ATTENTE_KEY);
    }catch(e){ /* on retentera au prochain chargement */ }
  }

  if(lireSession()){
    rafraichir();
    majTrace(lireSession(), {}).catch(function(){});
    rejouerProfilEnAttente();
  }
})();
