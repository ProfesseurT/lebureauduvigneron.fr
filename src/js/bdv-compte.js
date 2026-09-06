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

  const SESSION_KEY = 'bdv_session';
  const TRACE_KEY = 'bdv_trace_envoyee';
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
      return (s && s.access_token && s.user) ? s : null;
    }catch(e){ return null; }
  }
  function ecrireSession(data){
    const s = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now()/1000) + (data.expires_in || 3600),
      user: { id: data.user.id, email: data.user.email }
    };
    try{ localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }catch(e){}
    return s;
  }
  function viderSession(){ try{ localStorage.removeItem(SESSION_KEY); }catch(e){} }

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

  function deconnexion(){ viderSession(); }

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
    if(!s) return;
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
      + '.bdv-porte__legal{font-size:var(--t-mini,.7rem);color:var(--muted,#63523D);margin-top:1.4rem;font-family:var(--font-corps,\'Inter\',-apple-system,BlinkMacSystemFont,system-ui,sans-serif)}'
      + '.bdv-porte__legal a{color:var(--bordeaux,#5A1525)}'
      // Sortir n'est pas une action : la croix se range dans le coin, elle ne prend plus
      // une ligne de bouton pleine largeur au meme rang que « creer » et « se connecter ».
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
        + '<h2 id="bdvPorteTitre" class="bdv-porte__titre">' + esc(options.titre || 'Tes chiffres sont prêts.') + '</h2>'
        // Etape 1 : acces. Deux boutons distincts, volontairement. Un seul bouton obligerait a
        // deviner l'intention, et le 400 du serveur ne dit pas si c'est le mot de passe qui est
        // faux ou le compte qui n'existe pas.
        + '<div data-etape="acces">'
        + '<label class="bdv-porte__label" for="bdvEmail">Ton email</label>'
        + '<input class="bdv-porte__input" type="email" id="bdvEmail" autocomplete="email" placeholder="toi@domaine.fr">'
        + '<label class="bdv-porte__label" for="bdvMdp">Ton mot de passe</label>'
        + '<input class="bdv-porte__input" type="password" id="bdvMdp" autocomplete="current-password">'
        // Annonce statique construite depuis MDP_REGLES, jamais recopiee : un refus muet
        // sur une regle qu'on n'avait pas annoncee est la panne la plus couteuse de cet ecran.
        + '<p class="bdv-porte__aide">Nouveau compte : ' + esc(MDP_REGLES.map(function(r){ return r.texte; }).join(', ')) + '.</p>'
        + listeRegles('bdvReglesAcces', 'Pour créer un compte, il faut :')
        + '<label class="bdv-porte__chk"><input type="checkbox" id="bdvNews"> Recevoir l\'édition bimensuelle du Bureau du Vigneron</label>'
        // Presque tout le monde arrive ici sans compte : le bouton plein est celui qui en cree un.
        // Celui qui revient sait ce qu'il cherche et lit l'etiquette, l'inverse n'est pas vrai.
        + '<button class="bdv-porte__btn" id="bdvBtnInscription" type="button">Créer mon compte</button>'
        + '<button class="bdv-porte__btn bdv-porte__btn--secondaire" id="bdvBtnConnexion" type="button">J\'ai déjà un compte, me connecter</button>'
        + '<button class="bdv-porte__lien" id="bdvOublie" type="button">Mot de passe oublié ?</button>'
        + (options.esquivable ? '<button class="bdv-porte__btn bdv-porte__btn--secondaire" id="bdvPlusTard" type="button">Plus tard</button>' : '')
        + '<p class="bdv-porte__erreur" id="bdvErreurAcces" hidden></p>'
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
        + '<p class="bdv-porte__legal">En continuant, tu acceptes la <a href="/politique-confidentialite/" target="_blank" rel="noopener">politique de confidentialité</a>.</p>'
        + '</div>';
      document.body.appendChild(overlay);

      const etapes = {
        acces: overlay.querySelector('[data-etape="acces"]'),
        code: overlay.querySelector('[data-etape="code"]'),
        nouveau: overlay.querySelector('[data-etape="nouveau"]')
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
      champEmail.focus();

      // 'signup' ou 'recovery'. Decide ce que valide l'etape 2 et ou elle mene ensuite.
      let modeCode = 'signup';

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
            entrer(issue.session);
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
            entrer(await confirmerInscription(email, code, extraConsent()));
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
      champMdp.addEventListener('input', function(){ majRegles(reglesAcces, champMdp.value); });
      champMdp.addEventListener('focus', function(){ majRegles(reglesAcces, champMdp.value, true); });
      champNouveau.addEventListener('input', function(){ majRegles(reglesNouveau, champNouveau.value, true); });
      majRegles(reglesNouveau, '', true);

      champEmail.addEventListener('keydown', function(e){ if(e.key === 'Enter') champMdp.focus(); });
      champMdp.addEventListener('keydown', function(e){ if(e.key === 'Enter') seConnecter(); });
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
  function surClicCompte(e){
    if(!e.target || !e.target.closest) return;
    const cible = e.target.closest('[data-bdv-compte]');
    if(!cible) return;
    // Ctrl, cmd, maj ou clic du milieu : c'est une demande d'ouvrir ailleurs, on ne touche pas.
    if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
    e.preventDefault();
    const apres = cible.getAttribute('data-bdv-apres');
    if(lireSession()){ if(apres) location.href = apres; return; }
    ouvrir({ titre: cible.getAttribute('data-bdv-titre') || undefined })
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
    monId: monId
  };

  if(lireSession()){
    rafraichir();
    majTrace(lireSession(), {}).catch(function(){});
  }
})();
