/* Le Bureau du Vigneron, module de compte.
   Porte d'entree commune a tous les outils : email + code a 6 chiffres, sans mot de passe,
   sans supabase-js. Appelle directement GoTrue (auth) et PostgREST (profils).

   Regle d'or : un vigneron ne doit jamais se retrouver enferme dehors de ses propres donnees.
   La session locale suffit a ouvrir l'outil ; le reseau ne sert qu'a l'ouvrir ou la rafraichir,
   jamais a conditionner l'affichage des donnees deja en IndexedDB. */
(function(){
  'use strict';

  // TODO Teddy : URL du projet Supabase et cle anon, a renseigner avant mise en ligne.
  // La cle anon est publique par construction (elle vit dans ce fichier JS, visible de
  // quiconque ouvre l'outil) : la securite tient entierement aux politiques RLS posees sur
  // les tables Supabase, jamais au secret de cette cle.
  const SUPABASE_URL = '';
  const SUPABASE_ANON_KEY = '';

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

  function erreurLisible(status, data){
    const brut = String((data && (data.error_code || data.code || data.msg || data.error_description || data.error)) || '').toLowerCase();
    if(status === 429 || brut.indexOf('rate') >= 0) return new Error("Trop de tentatives, réessaie dans quelques minutes.");
    if(brut.indexOf('expired') >= 0) return new Error("Ce code a expiré, demande-en un nouveau.");
    if(brut.indexOf('invalid') >= 0 || brut.indexOf('token') >= 0) return new Error("Code incorrect, vérifie et réessaie.");
    if(status === 400) return new Error("Adresse e-mail invalide.");
    return new Error("Une erreur est survenue, réessaie dans un instant.");
  }

  async function appelGoTrue(chemin, corps){
    const r = await fetch(SUPABASE_URL + '/auth/v1' + chemin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify(corps)
    });
    const data = await r.json().catch(function(){ return {}; });
    if(!r.ok) throw erreurLisible(r.status, data);
    return data;
  }

  async function demanderCode(email){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Adresse e-mail invalide.");
    await appelGoTrue('/otp', { email: email, create_user: true });
  }

  async function verifierCode(email, code, extra){
    const data = await appelGoTrue('/verify', { email: email, token: code, type: 'email' });
    const session = ecrireSession(data);
    majTrace(session, extra || {}).catch(function(){});
    return session;
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
      + '.bdv-porte__carte{max-width:440px;width:100%;background:var(--white,#FFFFFF);border-top:3px solid var(--bordeaux,#5A1525);box-shadow:var(--ombre-dure, 6px 6px 0 rgba(30,37,54,0.18));padding:2.2rem 2rem;text-align:left}'
      + '.bdv-porte__eyebrow{font-family:var(--font-mono,\'JetBrains Mono\',\'Courier New\',monospace);font-size:var(--t-mini,.7rem);text-transform:uppercase;letter-spacing:var(--ls-large,.15em);color:var(--bordeaux,#5A1525);margin-bottom:.6rem}'
      + '.bdv-porte__titre{font-family:var(--font-titre,\'Fraunces\',Georgia,\'Times New Roman\',serif);font-weight:400;font-size:1.5rem;color:var(--ink,#1E2536);margin-bottom:.6rem}'
      + '.bdv-porte__reassure{font-size:var(--t-base,.88rem);color:var(--muted,#63523D);margin-bottom:1.4rem;line-height:var(--lh-normal,1.5)}'
      + '.bdv-porte__note{font-size:var(--t-petit,.78rem);color:var(--muted,#63523D);margin-bottom:.9rem;line-height:var(--lh-normal,1.5)}'
      + '.bdv-porte__label{display:block;font-family:var(--font-mono,\'JetBrains Mono\',\'Courier New\',monospace);font-size:var(--t-mini,.7rem);text-transform:uppercase;letter-spacing:var(--ls-doux,.05em);color:var(--muted,#63523D);margin-bottom:.35rem}'
      + '.bdv-porte__input{width:100%;padding:.65rem .75rem;border:1px solid var(--rule-fort,rgba(30,37,54,.42));background:var(--paper-light,#F5EFE0);font-family:var(--font-corps,\'Inter\',-apple-system,BlinkMacSystemFont,system-ui,sans-serif);font-size:var(--t-corps,1rem);color:var(--ink,#1E2536);margin-bottom:.9rem;border-radius:var(--r-nul,0)}'
      + '.bdv-porte__input:focus{outline:2px solid var(--bordeaux,#5A1525);outline-offset:1px}'
      + '.bdv-porte__input--code{letter-spacing:.3em;font-family:var(--font-mono,\'JetBrains Mono\',\'Courier New\',monospace);text-align:center;font-size:1.2rem}'
      + '.bdv-porte__chk{display:flex;align-items:flex-start;gap:.5rem;font-size:var(--t-petit,.78rem);color:var(--muted,#63523D);margin-bottom:1.1rem;line-height:var(--lh-normal,1.5)}'
      + '.bdv-porte__btn{width:100%;padding:.7rem 1rem;background:var(--bordeaux,#5A1525);color:var(--on-dark,#EFE7D6);border:none;font-family:var(--font-mono,\'JetBrains Mono\',\'Courier New\',monospace);font-size:var(--t-mini,.7rem);text-transform:uppercase;letter-spacing:var(--ls-doux,.05em);font-weight:500;cursor:pointer;border-radius:var(--r-nul,0)}'
      + '.bdv-porte__btn:hover{background:var(--bordeaux-vif,#7A1525)}'
      + '.bdv-porte__btn:disabled{opacity:.6;cursor:default}'
      + '.bdv-porte__btn--secondaire{background:transparent;color:var(--bordeaux,#5A1525);border:1px solid var(--rule-fort,rgba(30,37,54,.42));margin-top:.6rem}'
      + '.bdv-porte__btn--secondaire:hover{background:var(--paper-light,#F5EFE0)}'
      + '.bdv-porte__lien{display:block;margin:.7rem auto 0;background:none;border:none;padding:0;color:var(--bordeaux,#5A1525);font-family:var(--font-mono,\'JetBrains Mono\',\'Courier New\',monospace);font-size:var(--t-mini,.7rem);text-decoration:underline;cursor:pointer}'
      + '.bdv-porte__erreur{color:var(--danger-deep,#A03530);font-size:var(--t-petit,.78rem);margin-top:.6rem}'
      + '.bdv-porte__legal{font-size:var(--t-mini,.7rem);color:var(--muted,#63523D);margin-top:1.4rem;font-family:var(--font-mono,\'JetBrains Mono\',\'Courier New\',monospace)}'
      + '.bdv-porte__legal a{color:var(--bordeaux,#5A1525)}';
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
        + '<p class="bdv-porte__eyebrow">Le Bureau du Vigneron</p>'
        + '<h2 id="bdvPorteTitre" class="bdv-porte__titre">' + esc(options.titre || 'Tes chiffres sont prêts.') + '</h2>'
        + '<p class="bdv-porte__reassure">On stocke ton email, rien d\'autre. Tes ventes ne quittent pas ton navigateur.</p>'
        + '<div data-etape="email">'
        + '<label class="bdv-porte__label" for="bdvEmail">Ton email</label>'
        + '<input class="bdv-porte__input" type="email" id="bdvEmail" autocomplete="email" placeholder="toi@domaine.fr">'
        + '<label class="bdv-porte__chk"><input type="checkbox" id="bdvNews"> Recevoir l\'édition bimensuelle du Bureau du Vigneron</label>'
        + '<button class="bdv-porte__btn" id="bdvBtnEmail" type="button">Recevoir mon code</button>'
        + (options.esquivable ? '<button class="bdv-porte__btn bdv-porte__btn--secondaire" id="bdvPlusTard" type="button">Plus tard</button>' : '')
        + '<p class="bdv-porte__erreur" id="bdvErreurEmail" hidden></p>'
        + '</div>'
        + '<div data-etape="code" hidden>'
        + '<p class="bdv-porte__note">Un code à 6 chiffres vient d\'être envoyé à <b id="bdvEmailAffiche"></b>.</p>'
        + '<label class="bdv-porte__label" for="bdvCode">Code reçu</label>'
        + '<input class="bdv-porte__input bdv-porte__input--code" type="text" id="bdvCode" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code">'
        + '<button class="bdv-porte__btn" id="bdvBtnCode" type="button">Valider</button>'
        + '<button class="bdv-porte__lien" id="bdvRenvoyer" type="button">Renvoyer le code</button>'
        + '<p class="bdv-porte__erreur" id="bdvErreurCode" hidden></p>'
        + '</div>'
        + '<p class="bdv-porte__legal">En continuant, tu acceptes la <a href="/politique-confidentialite/" target="_blank" rel="noopener">politique de confidentialité</a>.</p>'
        + '</div>';
      document.body.appendChild(overlay);

      const etapeEmail = overlay.querySelector('[data-etape="email"]');
      const etapeCode = overlay.querySelector('[data-etape="code"]');
      const champEmail = overlay.querySelector('#bdvEmail');
      const champNews = overlay.querySelector('#bdvNews');
      const btnEmail = overlay.querySelector('#bdvBtnEmail');
      const btnPlusTard = overlay.querySelector('#bdvPlusTard');
      const erreurEmail = overlay.querySelector('#bdvErreurEmail');
      const champCode = overlay.querySelector('#bdvCode');
      const btnCode = overlay.querySelector('#bdvBtnCode');
      const btnRenvoyer = overlay.querySelector('#bdvRenvoyer');
      const erreurCode = overlay.querySelector('#bdvErreurCode');
      const emailAffiche = overlay.querySelector('#bdvEmailAffiche');
      champEmail.focus();

      function montrerErreur(el, e){ el.textContent = e.message; el.hidden = false; }
      function masquerErreur(el){ el.hidden = true; }

      function esquiver(){
        reporterPorte();
        document.removeEventListener('keydown', surEchap);
        overlay.remove();
        resolve(null);
      }
      function surEchap(e){ if(e.key === 'Escape') esquiver(); }
      if(options.esquivable){
        btnPlusTard.addEventListener('click', esquiver);
        document.addEventListener('keydown', surEchap);
      }

      async function envoyerCode(){
        masquerErreur(erreurEmail);
        const email = champEmail.value.trim();
        btnEmail.disabled = true; btnEmail.textContent = 'Envoi…';
        try{
          await demanderCode(email);
          emailAffiche.textContent = email;
          etapeEmail.hidden = true; etapeCode.hidden = false;
          champCode.focus();
        }catch(e){
          montrerErreur(erreurEmail, e);
        }finally{
          btnEmail.disabled = false; btnEmail.textContent = 'Recevoir mon code';
        }
      }

      async function validerCode(){
        masquerErreur(erreurCode);
        btnCode.disabled = true; btnCode.textContent = 'Vérification…';
        try{
          const extra = champNews.checked ? { consent_news: true } : {};
          const session = await verifierCode(champEmail.value.trim(), champCode.value.trim(), extra);
          document.removeEventListener('keydown', surEchap);
          overlay.remove();
          resolve(session);
        }catch(e){
          montrerErreur(erreurCode, e);
          btnCode.disabled = false; btnCode.textContent = 'Valider';
        }
      }

      btnEmail.addEventListener('click', envoyerCode);
      champEmail.addEventListener('keydown', function(e){ if(e.key === 'Enter') envoyerCode(); });
      btnCode.addEventListener('click', validerCode);
      champCode.addEventListener('keydown', function(e){ if(e.key === 'Enter') validerCode(); });
      btnRenvoyer.addEventListener('click', function(){
        masquerErreur(erreurCode);
        demanderCode(champEmail.value.trim()).catch(function(e){ montrerErreur(erreurCode, e); });
      });
    });
  }

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }

  window.BdvCompte = {
    session: lireSession,
    demanderCode: demanderCode,
    verifierCode: verifierCode,
    rafraichir: rafraichir,
    deconnexion: deconnexion,
    profil: profil,
    majProfil: majProfil,
    porte: porte
  };

  if(lireSession()){
    rafraichir();
    majTrace(lireSession(), {}).catch(function(){});
  }
})();
