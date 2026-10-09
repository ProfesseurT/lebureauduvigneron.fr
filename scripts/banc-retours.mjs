/* ============================================================================
   BANC DE « CE QUE BREVO RENVOIE », lot 90, 09/10/2026 (ecran, JSDOM)
   ============================================================================
   Ce qu'il garde :
   - l'empreinte du navigateur est EXACTEMENT celle de la fonction Edge et du SQL
     (sha256 de « bureau:adresse en minuscules ») : sinon aucune adresse ne serait reconnue ;
   - une adresse n'est jamais envoyee a la base : seulement son empreinte ;
   - les mots du vigneron, jamais la couleur seule : desinscrit des campagnes = on previent et
     le mail perso part ; morte, spam, bloquee, desinscrit des mails 1 a 1 = Brevo ne l'enverra
     pas (par sa boite : on previent) ;
   - la fiche : la case d'accord ecrit par `suivi_accorder`, et sans accord, ni « ouvert » ni
     « pas encore ouvert » ; avec, la premiere ouverture et le premier clic ;
   - « Mes clients » : l'etiquette apparait une fois l'empreinte calculee, la liste se redessine
     une seule fois, et pas du tout si aucune adresse n'est marquee ;
   - Mes envois : brancher et relire sont pour l'administrateur ; l'echec se dit ; le reglage
     de consentement a faire dans Brevo est dit ;
   - SQL du lot 90 absent : rien ne s'affiche, rien ne casse.
   Lance : npm run banc:retours
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
let ok = 0, ko = 0;
const dit = (b, m, det) => { if (b) { ok++; console.log('  ok    : ' + m); } else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + det : '')); } };
const pause = (n) => new Promise(r => setTimeout(r, n || 40));
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const B = 'B0000000-0000-0000-0000-00000000000A';
const emp = (a) => crypto.createHash('sha256').update(B.toLowerCase() + ':' + a.trim().toLowerCase()).digest('hex');

function monter(o) {
  o = o || {};
  const dom = new JSDOM('<!doctype html><body><div id="hote"></div></body>', { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  Object.defineProperty(w, 'crypto', { value: crypto.webcrypto });
  w.TextEncoder = TextEncoder;
  const appels = [], fonctions = [];
  const base = { bloquees: o.bloquees || [], accords: o.accords || [], suivi: o.suivi || [], reg: o.reg === undefined ? { retours_etat: 'branches', retours_le: '2026-10-09T08:00:00Z', rattrape_le: '2026-10-09T08:01:00Z' } : o.reg };
  w.BdvBrevo = { _etat: () => ({ BREVO: o.sansBrevo ? null : { etat: 'branche' } }) };
  w.BdvBoite = { parBrevo: () => !!o.parBrevo };
  w.BdvCompte = {
    monBureau: () => B,
    api: (chemin, x) => {
      appels.push({ chemin, x });
      if (o.absente && (chemin.startsWith('/brevo_bloquees') || chemin.startsWith('/suivi_accords'))) return Promise.reject(Object.assign(new Error('404'), { status: 404 }));
      if (chemin.startsWith('/brevo_bloquees?')) return Promise.resolve(base.bloquees);
      if (chemin.startsWith('/brevo?select=retours_etat')) return Promise.resolve(base.reg ? [base.reg] : []);
      if (chemin.startsWith('/suivi_accords?')) {
        const m = /empreinte=in\.\(([^)]*)\)/.exec(chemin), l = m ? m[1].split(',') : [];
        return Promise.resolve(base.accords.filter(a => l.includes(a.empreinte)));
      }
      if (chemin === '/rpc/brevo_suivi') return Promise.resolve(base.suivi.filter(s => x.corps.p_empreintes.includes(s.empreinte)));
      if (chemin === '/rpc/suivi_accorder') {
        if (o.accordRefuse) return Promise.reject(new Error('500'));
        if (x.corps.p_oui) base.accords.push({ empreinte: x.corps.p_empreinte, accepte_le: '2026-10-09T09:00:00Z' });
        else base.accords = base.accords.filter(a => a.empreinte !== x.corps.p_empreinte);
        return Promise.resolve(true);
      }
      return Promise.resolve([]);
    },
    fonction: (nom, c) => {
      fonctions.push({ nom, c });
      if (o.fonction) return o.fonction(c, base);
      base.reg = { retours_etat: 'branches', retours_le: '2026-10-09T10:00:00Z', rattrape_le: '2026-10-09T10:00:00Z' };
      return Promise.resolve({ resultat: c.action === 'retours_relire' ? 'relu' : 'branches', complet: true });
    },
  };
  const s = w.document.createElement('script'); s.textContent = lire('src/js/bdv-retours.js'); w.document.body.appendChild(s);
  return { w, d: w.document, appels, fonctions, base };
}
const texte = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');

console.log('\n== 1. L\'empreinte ==');
{
  const { w } = monter();
  await pause();
  const e = await w.BdvRetours.empreinte('  Cave.Dupont+pro@Gmail.COM ');
  dit(e === emp('cave.dupont+pro@gmail.com'), 'la meme que la fonction Edge et le SQL (bureau en minuscules, adresse en minuscules, sans espaces)', e);
  dit(e !== emp('cavedupont+pro@gmail.com') && e !== emp('cave.dupont@gmail.com'), 'ni le point ni le « + » ne sont retires : ce serait une autre adresse');
  const ts = lire('supabase/functions/_shared/empreinte.ts');
  dit(/String\(bureau\)\.toLowerCase\(\) \+ ':' \+ String\(adresse \?\? ''\)\.trim\(\)\.toLowerCase\(\)/.test(ts), 'la fonction Edge ecrit la meme formule');
}

console.log('\n== 2. Au-dessus du bouton d\'envoi ==');
const BLOQ = [
  { empreinte: emp('morte@cave.fr'), source: 'transactionnel', motif: 'morte', depuis: '2026-03-01T10:00:00Z' },
  { empreinte: emp('promo@cave.fr'), source: 'campagne', motif: 'desinscrit', depuis: '2026-09-12T10:00:00Z' },
  { empreinte: emp('spam@cave.fr'), source: 'campagne', motif: 'spam', depuis: null },
  { empreinte: emp('spam@cave.fr'), source: 'campagne', motif: 'desinscrit', depuis: null },
];
{
  const { w, d, appels } = monter({ bloquees: BLOQ, parBrevo: true });
  await pause(60);
  const h = d.getElementById('hote');
  h.innerHTML = '<p id="a1" class="ret-avis" data-retour-mail="Morte@Cave.fr" data-retour-sorte="affaires" hidden></p>'
    + '<p id="a2" data-retour-mail="promo@cave.fr" hidden></p><p id="a3" data-retour-mail="spam@cave.fr" hidden></p><p id="a4" data-retour-mail="sain@cave.fr" hidden></p>';
  await pause(80);
  dit(!d.getElementById('a1').hidden && /Adresse qui ne marche plus depuis le 1 mars 2026 : Brevo ne l’enverra pas\./.test(texte(d.getElementById('a1'))), 'adresse morte, par Brevo : « Brevo ne l’enverra pas »', texte(d.getElementById('a1')));
  dit(d.getElementById('a1').classList.contains('ret-avis--bloque') && d.getElementById('a1').getAttribute('role') === 'note', 'bloquant : la forme ET le mot, et un role');
  dit(/Ne veut plus de campagnes depuis le 12 septembre 2026 : ce mail perso part quand même\./.test(texte(d.getElementById('a2'))), 'desinscrit des campagnes : le mail perso part, on le dit', texte(d.getElementById('a2')));
  dit(!d.getElementById('a2').classList.contains('ret-avis--bloque'), 'desinscrit des campagnes : pas la forme du blocage');
  dit(/^A classé ton mail en spam : Brevo/.test(texte(d.getElementById('a3'))), 'deux marques : la plus grave parle (spam avant desinscrit)', texte(d.getElementById('a3')));
  dit(d.getElementById('a4').hidden, 'une adresse saine : rien');
  dit(!appels.some(a => /cave\.fr/i.test(a.chemin + JSON.stringify(a.x || {}))), 'aucune adresse ne part vers la base');
}
{
  const { d } = monter({ bloquees: BLOQ, parBrevo: false });
  await pause(60);
  d.getElementById('hote').innerHTML = '<p id="a1" data-retour-mail="morte@cave.fr" hidden></p><p id="a3" data-retour-mail="spam@cave.fr" hidden></p>';
  await pause(80);
  dit(/: ce mail risque de te revenir\./.test(texte(d.getElementById('a1'))), 'par sa boite, adresse morte : on previent seulement', texte(d.getElementById('a1')));
  dit(/: envoie-le seulement s’il te l’a demandé\./.test(texte(d.getElementById('a3'))), 'par sa boite, spam : on previent fort');
}

console.log('\n== 3. La fiche ==');
{
  const e = emp('fidele@cave.fr');
  const { d, appels } = monter({ bloquees: BLOQ, suivi: [
    { empreinte: e, envoi_le: '2026-10-08T07:00:00Z', sorte: 'affaires', evenement: 'ouvert', le: '2026-10-08T07:14:00Z' },
    { empreinte: e, envoi_le: '2026-10-08T07:00:00Z', sorte: 'affaires', evenement: 'clic', le: '2026-10-08T07:20:00Z' },
    { empreinte: e, envoi_le: '2026-10-09T07:00:00Z', sorte: 'devis', evenement: null, le: null }] });
  await pause(60);
  d.getElementById('hote').innerHTML = '<div id="f" class="ret" data-retours-fiche data-mails=\'["fidele@cave.fr","morte@cave.fr"]\' hidden></div>';
  await pause(120);
  const f = d.getElementById('f');
  dit(!f.hidden && /Ses mails et Brevo/.test(texte(f)), 'le bloc apparait');
  dit(/morte@cave\.fr Adresse qui ne marche plus/.test(texte(f)), 'la marque suit l\'adresse, en mots');
  const c = f.querySelector('input[data-ret="accord"]');
  dit(c && !c.checked && c.getAttribute('data-emp') === e, 'la case d\'accord, decochee par defaut, porte l\'empreinte');
  dit(!/ouvert le|pas encore ouvert/.test(texte(f)) && /Parti par Brevo le 8 octobre à 9 h 00\./.test(texte(f)), 'sans accord : ni « ouvert » ni « pas encore ouvert »', texte(f));
  dit(/règle de la CNIL/.test(texte(f)), 'la raison est dite');
  c.checked = true; c.dispatchEvent(new d.defaultView.Event('change', { bubbles: true }));
  await pause(120);
  const ac = appels.find(a => a.chemin === '/rpc/suivi_accorder');
  dit(ac && ac.x.corps.p_oui === true && ac.x.corps.p_empreinte === e && ac.x.corps.p_bureau === B, 'cocher ecrit l\'accord, par empreinte');
  const f2 = d.getElementById('f');
  dit(/ouvert le 8 octobre à 9 h 14, a cliqué un lien le 8 octobre à 9 h 20/.test(texte(f2)), 'avec accord : premiere ouverture et premier clic', texte(f2));
  dit(/pas encore ouvert/.test(texte(f2)) && /Noté le 9 octobre 2026/.test(texte(f2)), 'un mail pas ouvert le dit ; l\'accord est date');
}
{
  const { d } = monter({ accordRefuse: true });
  await pause(60);
  d.getElementById('hote').innerHTML = '<div id="f" data-retours-fiche data-mails=\'["x@y.fr"]\' hidden></div>';
  await pause(100);
  const c = d.querySelector('input[data-ret="accord"]');
  c.checked = true; c.dispatchEvent(new d.defaultView.Event('change', { bubbles: true }));
  await pause(80);
  dit(!c.checked && /pas été enregistré/.test(texte(d.getElementById('f'))), 'un accord refuse par la base : la case se decoche et on le dit');
}
{
  const { d } = monter({ absente: true });
  await pause(60);
  d.getElementById('hote').innerHTML = '<div id="f" data-retours-fiche data-mails=\'["x@y.fr"]\' hidden></div><p id="a" data-retour-mail="x@y.fr" hidden></p>';
  await pause(100);
  dit(d.getElementById('f').hidden && d.getElementById('a').hidden, 'SQL absent : rien ne s\'affiche');
}
{
  const { d } = monter({ sansBrevo: true, reg: null });
  await pause(60);
  d.getElementById('hote').innerHTML = '<div id="f" data-retours-fiche data-mails=\'["x@y.fr"]\' hidden></div>';
  await pause(100);
  dit(d.getElementById('f').hidden, 'Brevo pas branche, rien a dire : pas de bloc');
}

console.log('\n== 4. « Mes clients » ==');
{
  const { w, d } = monter({ bloquees: BLOQ });
  await pause(60);
  let signaux = 0; d.addEventListener('bdv:retours', () => signaux++);
  dit(w.BdvRetours.marqueListe(['morte@cave.fr']) === '', 'premier passage : rien (empreinte pas encore calculee)');
  await pause(60);
  dit(signaux === 1, 'la liste est prevenue une fois', signaux);
  dit(/ret-marque--morte">Adresse qui ne marche plus</.test(w.BdvRetours.marqueListe(['morte@cave.fr'])), 'deuxieme passage : l\'etiquette, en mots');
  w.BdvRetours.marqueListe(['sain1@x.fr', 'sain2@x.fr']);
  await pause(60);
  dit(signaux === 1, 'des adresses saines ne redessinent pas la liste (pas de boucle)', signaux);
  const an = lire('src/js/bdv-annuaire.js');
  dit(/BdvRetours\.marqueListe\(c\.nouveau \? c\.mails : /.test(an) && /addEventListener\('bdv:retours'/.test(an), '« Mes clients » pose l\'etiquette et ecoute le signal');
}

console.log('\n== 5. Mes envois ==');
{
  const { d, fonctions } = monter({ reg: { retours_etat: null } });
  await pause(60);
  const h = d.getElementById('hote'); h.innerHTML = '';
  d.defaultView.BdvRetours.peindreReglage(h, true);
  dit(/Brancher les retours/.test(texte(h)), 'pas branche : l\'administrateur a le bouton');
  d.getElementById('bdvvRetoursGeste').dispatchEvent(new d.defaultView.MouseEvent('click', { bubbles: true }));
  await pause(120);
  dit(fonctions.length === 1 && fonctions[0].c.action === 'retours_brancher' && fonctions[0].c.bureau === B, 'le clic appelle la fonction, avec le bureau');
  dit(/Brevo prévient le bureau depuis le 9 octobre 2026/.test(texte(d.getElementById('bdvvRetours'))), 'puis l\'etat branche se lit');
  dit(/Consentement au suivi par contact/.test(texte(d.getElementById('bdvvRetours'))), 'le reglage a faire dans Brevo est dit a l\'administrateur');
}
{
  const { d } = monter({ reg: { retours_etat: 'branches', retours_le: '2026-10-09T08:00:00Z' } });
  await pause(60);
  const h = d.getElementById('hote'); h.innerHTML = '';
  d.defaultView.BdvRetours.peindreReglage(h, false);
  dit(!d.getElementById('bdvvRetoursGeste') && !/Consentement au suivi/.test(texte(h)), 'un simple membre lit l\'etat, sans bouton ni reglage');
}
{
  const { d } = monter({ reg: { retours_etat: 'echec' }, fonction: () => Promise.resolve({ resultat: 'refusee', mot: 'Brevo refuse cette clé.' }) });
  await pause(60);
  const h = d.getElementById('hote'); h.innerHTML = '';
  d.defaultView.BdvRetours.peindreReglage(h, true);
  dit(/n’a pas accepté de prévenir/.test(texte(h)) && /Réessayer/.test(texte(h)), 'un echec se dit, et se reessaie');
  d.getElementById('bdvvRetoursGeste').dispatchEvent(new d.defaultView.MouseEvent('click', { bubbles: true }));
  await pause(120);
  const m = d.getElementById('bdvvRetoursMot');
  dit(m && !m.hidden && /refuse cette clé/.test(m.textContent) && /alerte/.test(m.className), 'le refus de Brevo se dit en alerte');
}
{
  const { d } = monter({ reg: { retours_etat: 'branches', retours_le: '2026-10-09T08:00:00Z' },
    fonction: () => Promise.resolve({ resultat: 'relu', complet: false, mot: 'Brevo n’a pas tout donné à temps.' }) });
  await pause(60);
  const h = d.getElementById('hote'); h.innerHTML = '';
  d.defaultView.BdvRetours.peindreReglage(h, true);
  d.getElementById('bdvvRetoursGeste').dispatchEvent(new d.defaultView.MouseEvent('click', { bubbles: true }));
  await pause(120);
  dit(/pas tout donné/.test(texte(d.getElementById('bdvvRetoursMot'))), 'une relecture incomplete se dit');
}

{
  const { d } = monter({ absente: true });
  await pause(60);
  const h = d.getElementById('hote'); h.innerHTML = '';
  d.defaultView.BdvRetours.peindreReglage(h, true);
  dit(/Pas encore disponible/.test(texte(h)) && !d.getElementById('bdvvRetoursGeste'), 'SQL absent : Mes envois le dit, sans bouton');
}

console.log('\n== 6. Les branchements ==');
{
  const ec = lire('src/js/bdv-ecrans.js'), af = lire('src/js/bdv-affaires.js'), br = lire('src/js/bdv-brevo.js'), pg = lire('src/mon-bureau.njk');
  dit(/data-retours-fiche data-mails="\$\{esc\(JSON\.stringify\(f\.emails\)\)\}"/.test(ec) && /!muet&&f\.emails\.length\?`<div class="ret" data-retours-fiche/.test(ec), 'la fiche porte le bloc, pas pour un client en opposition');
  dit(/data-retour-mail="\$\{esc\(mail\)\}" data-retour-sorte="affaires"/.test(ec), 'le message de la fiche porte l\'avis');
  const mh = ec.slice(ec.indexOf('function messageHTML('), ec.indexOf('function messageHTML(') + 4000);
  dit(mh.indexOf('data-retour-mail') > 0 && mh.indexOf('data-retour-mail') < mh.indexOf('<div class="fiche__actions">'), 'l\'avis de la fiche est AU-DESSUS du bouton d\'envoi (vigneron)');
  dit(/data-retour-mail="' \+ esc\(mail\) \+ '" data-retour-sorte="' \+ esc\(so\)/.test(af), 'le redacteur d\'affaire porte l\'avis, avec sa sorte');
  dit(/BdvRetours\.peindreReglage\(c, MAITRE\)/.test(br) && /b\.etat !== 'refusee'/.test(br), 'Mes envois montre le bloc, pas avec une cle refusee');
  const i = pg.indexOf('bdv-retours.js'), j = pg.indexOf('bdv-brevo.js');
  dit(i > j && /<script src="\/js\/bdv-retours\.js" defer><\/script>/.test(pg), 'le script est differe et charge apres bdv-brevo.js');
}

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
if (ko) process.exitCode = 1;
