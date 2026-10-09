/* ============================================================================
   BANC DE « BRANCHER BREVO », lot 87, 08/10/2026
   ============================================================================
   Ce qu'il garde :
   - non branche : le maitre voit les trois etapes et le champ de la cle ; un simple utilisateur
     ne voit aucun champ, seulement qui peut brancher ;
   - la cle ne part QUE vers la fonction `brevo`, jamais vers la base, et quitte la page apres ;
   - une cle refusee (ou une cle SMTP) se dit en mots du bureau, et rien n'est branche ;
   - branche : l'ecran dit que RIEN ne part encore par Brevo (aucune promesse fausse) ;
   - le maitre coche ce qui part par Brevo ; un simple utilisateur le lit sans le changer ;
   - chacun choisit son chemin et son expediteur, parmi les adresses VALIDEES chez Brevo ;
   - « Par ma boite » n'est possible qu'avec une boite branchee ;
   - `passe(sorte)` ne dit oui que si tout est sur : Brevo branche, sorte cochee, pas « Par ma
     boite », un expediteur choisi ;
   - retirer demande confirmation ; toute requete nomme son bureau ; SQL absent : l'ecran le dit ;
   - la fonction Edge verifie le maitre AVANT Brevo, ne renvoie jamais le texte de Brevo.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
let ok = 0, ko = 0;
const dit = (b, m, det) => { if (b) { ok++; console.log('  ok    : ' + m); } else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + det : '')); } };
const pause = (n) => new Promise(r => setTimeout(r, n || 40));
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const B = 'b0000000-0000-0000-0000-000000000001';
const MOI = 'a0000000-0000-0000-0000-000000000001';
const CLE = 'xkeysib-0123456789abcdef0123456789abcdef-AbCd';

function monter(o) {
  o = o || {};
  const dom = new JSDOM('<!doctype html><body><div id="hote"><section id="bdvbZone"></section></div></body>', { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window;
  const appels = [], fonctions = [], blocs = [];
  const base = { brevo: o.brevo || null, choix: o.choix || null };
  w.BdvReglages = { brancher: (x) => blocs.push(...x.blocs) };
  w.BdvBoite = { prete: () => !!o.boite, adresse: () => o.boite || '' };
  w.BdvCompte = {
    monBureau: () => B, monId: () => MOI,
    api: (chemin, x) => {
      appels.push({ chemin, x });
      if (chemin.indexOf('/brevo?select=') === 0) {
        if (o.absente) { const e = new Error('404'); e.status = 404; return Promise.reject(e); }
        return Promise.resolve(base.brevo ? [base.brevo] : []);
      }
      if (chemin.indexOf('/brevo_choix?select=') === 0) return Promise.resolve(base.choix ? [base.choix] : []);
      if (chemin === '/rpc/est_maitre') return Promise.resolve(!!o.maitre);
      if (chemin === '/rpc/brevo_regler') {
        if (!o.maitre) return Promise.reject(Object.assign(new Error('403'), { status: 403 }));
        for (const [k, c] of [['p_affaires', 'defaut_affaires'], ['p_devis', 'defaut_devis'], ['p_programmes', 'defaut_programmes']]) {
          if (x.corps[k] != null) base.brevo[c] = x.corps[k];
        }
        return Promise.resolve(true);
      }
      if (chemin === '/rpc/brevo_choisir') {
        base.choix = base.choix || { chemin: 'bureau', expediteur: null, expediteur_nom: null };
        if (x.corps.p_chemin != null) base.choix.chemin = x.corps.p_chemin;
        if (x.corps.p_expediteur != null) base.choix.expediteur = x.corps.p_expediteur || null;
        return Promise.resolve(true);
      }
      if (chemin === '/rpc/brevo_retirer') { base.brevo = null; return Promise.resolve(true); }
      return Promise.resolve([]);
    },
    fonction: (nom, c) => {
      fonctions.push({ nom, c });
      if (c.action === 'brancher') {
        if (/^xsmtpsib-/.test(c.cle)) return Promise.resolve({ resultat: 'cle_smtp', mot: 'C’est une clé SMTP. Il faut une clé API.' });
        if (c.cle !== CLE) return Promise.resolve({ resultat: 'refusee', mot: 'Brevo refuse cette clé.' });
        base.brevo = { etat: 'branche', compte_email: 'contact@clos.fr', compte_nom: 'Clos Fertel', cle_fin: 'AbCd',
          defaut_affaires: true, defaut_devis: true, defaut_programmes: true, branche_le: '2026-10-08T10:00:00Z' };
        return Promise.resolve({ resultat: 'branche', compte_email: 'contact@clos.fr', compte_nom: 'Clos Fertel' });
      }
      if (c.action === 'envoyer') {
        if (o.envoi === 'plafond') return Promise.resolve({ resultat: 'plafond', mot: '200 mails envoyés par Brevo aujourd’hui : la limite du jour est atteinte.' });
        if (o.envoi === 'panne') return Promise.reject(Object.assign(new Error('500'), { status: 500 }));
        if (o.envoi === 'refus') return Promise.resolve({ resultat: 'refus_cle', mot: 'Brevo refuse la clé du bureau.' });
        return Promise.resolve({ resultat: 'parti', de: 'julien@clos.fr', copie: true, par: 'brevo' });
      }
      if (c.action === 'expediteurs') {
        if (o.expRefus) return Promise.resolve({ resultat: 'refusee', mot: 'Brevo refuse cette clé : elle est désactivée.' });
        return Promise.resolve({ resultat: 'ok', expediteurs: [
          { email: 'contact@clos.fr', nom: 'Clos Fertel', actif: true },
          { email: 'julien@clos.fr', nom: 'Julien', actif: true },
          { email: 'neuf@clos.fr', nom: '', actif: false }] });
      }
      return Promise.resolve({});
    }
  };
  const s = w.document.createElement('script'); s.textContent = lire('src/js/bdv-brevo.js'); w.document.body.appendChild(s);
  const hote = w.document.getElementById('hote');
  blocs.forEach(b => b.monter(hote));
  return { w, d: w.document, appels, fonctions, blocs, base };
}
const clic = (w, id) => w.document.getElementById(id).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const changer = (w, id, v) => { const r = w.document.getElementById(id); if (r.type === 'checkbox' || r.type === 'radio') r.checked = v; else r.value = v; r.dispatchEvent(new w.Event('change', { bubbles: true })); };
const BRANCHE = () => ({ etat: 'branche', compte_email: 'contact@clos.fr', compte_nom: 'Clos Fertel', cle_fin: 'AbCd',
  defaut_affaires: true, defaut_devis: true, defaut_programmes: true, branche_le: '2026-10-08T10:00:00Z' });

console.log('\n== 1. Non branche ==');
{
  const { d, blocs } = monter({ maitre: true });
  await pause(80);
  dit(blocs.length === 1 && blocs[0].hote === 'envois', 'un bloc, sur l\'onglet « Mes envois »');
  dit(d.getElementById('bdvvZone').previousElementSibling === d.getElementById('bdvbZone'), 'Brevo vient juste apres « D\'ou partent tes mails »');
  dit(!!d.getElementById('bdvvCle') && d.getElementById('bdvvCle').type === 'password', 'le maitre a le champ de la cle, masque');
  dit(/Adresses IP autorisées/.test(d.getElementById('bdvvForm').textContent), 'l\'etape « debloquer les adresses IP » est dite avant de coller la cle');
  dit(/le bureau envoie tes mails par Brevo/.test(d.getElementById('bdvvCorps').textContent), 'l\'ecran dit ce que Brevo fera, sans rien promettre de plus');
}
{
  const { d } = monter({ maitre: false });
  await pause(80);
  dit(!d.getElementById('bdvvCle'), 'un simple utilisateur n\'a pas de champ de cle');
  dit(/maître du bureau peut brancher/.test(d.getElementById('bdvvCorps').textContent), 'il lit qui peut brancher');
}

console.log('\n== 2. Brancher ==');
{
  const { w, d, appels, fonctions } = monter({ maitre: true });
  await pause(80);
  clic(w, 'bdvvBrancher'); await pause();
  dit(/Colle d’abord/.test(d.getElementById('bdvvMot').textContent) && fonctions.length === 0, 'sans cle : rien ne part, et l\'ecran le dit');
  d.getElementById('bdvvCle').value = 'xsmtpsib-1234567890123456789012345';
  clic(w, 'bdvvBrancher'); await pause(80);
  dit(/clé SMTP/.test(d.getElementById('bdvvMot').textContent), 'une cle SMTP est reconnue et nommee');
  d.getElementById('bdvvCle').value = 'xkeysib-fausse-fausse-fausse-fausse';
  clic(w, 'bdvvBrancher'); await pause(80);
  dit(/refuse/.test(d.getElementById('bdvvMot').textContent) && !!d.getElementById('bdvvCle'), 'une cle refusee : rien n\'est branche, le champ reste');
  d.getElementById('bdvvCle').value = '  ' + CLE + '  ';
  clic(w, 'bdvvBrancher'); await pause(120);
  const f = fonctions.filter(x => x.c.action === 'brancher').pop();
  dit(f && f.nom === 'brevo' && f.c.bureau === B && f.c.cle === CLE, 'la cle part, sans espaces, vers la fonction brevo, avec son bureau');
  dit(!appels.some(a => JSON.stringify(a.x || {}).indexOf('0123456789abcdef') >= 0), 'la cle ne part JAMAIS vers la base');
  dit(!d.getElementById('bdvvCle'), 'branche : le champ de la cle a quitte la page');
  dit(/Brevo est branché sur Clos Fertel \(clé terminée par AbCd\)/.test(d.getElementById('bdvvCorps').textContent), 'la carte nomme le compte et la fin de la cle');
  dit(/Ce que le maître a coché ci-dessous part par Brevo/.test(d.getElementById('bdvvCorps').textContent), 'branche, l\'ecran dit que ce qui est coche part par Brevo');
  dit(fonctions.some(x => x.c.action === 'expediteurs'), 'branche, le bureau lit les adresses chez Brevo');
  dit(appels.filter(a => a.chemin.indexOf('/brevo') === 0).every(a => a.chemin.indexOf('bureau=eq.' + B) > 0), 'chaque lecture nomme son bureau');
}

console.log('\n== 3. Ce qui part par Brevo (le maitre) ==');
{
  const { w, d, appels, base } = monter({ maitre: true, brevo: BRANCHE() });
  await pause(100);
  dit(['affaires', 'devis', 'programmes'].every(s => d.getElementById('bdvvDefaut_' + s) && d.getElementById('bdvvDefaut_' + s).checked), 'les trois sortes, cochees');
  changer(w, 'bdvvDefaut_affaires', false); await pause(80);
  const r = appels.filter(a => a.chemin === '/rpc/brevo_regler').pop();
  dit(r && r.x.corps.p_bureau === B && r.x.corps.p_affaires === false && r.x.corps.p_devis === null && r.x.corps.p_programmes === null,
    'un clic n\'envoie QUE sa sorte, les autres restent a null');
  dit(base.brevo.defaut_affaires === false && base.brevo.defaut_devis === true, 'la base suit');
  dit(!!d.getElementById('bdvvRetirer'), 'le maitre peut retirer Brevo');
}
{
  const { d } = monter({ maitre: false, brevo: Object.assign(BRANCHE(), { defaut_affaires: false }) });
  await pause(100);
  dit(!d.getElementById('bdvvDefaut_devis'), 'un simple utilisateur n\'a pas les cases du bureau');
  dit(/Le maître a choisi pour Brevo : les devis et les commandes, les mails programmés\./.test(d.getElementById('bdvvCorps').textContent), 'il lit ce que le maitre a coche');
  dit(!d.getElementById('bdvvRetirer'), 'il ne peut pas retirer Brevo');
}

console.log('\n== 4. Mes mails a moi ==');
{
  const { w, d, appels, base } = monter({ maitre: false, brevo: BRANCHE() });
  await pause(120);
  const s = d.getElementById('bdvvExp');
  dit(!!s && s.tagName === 'SELECT', 'la liste des adresses de Brevo');
  const opts = s ? [...s.options] : [];
  dit(opts.some(x => x.value === 'neuf@clos.fr' && x.disabled), 'une adresse pas encore validee se voit, mais ne se choisit pas');
  dit(s && s.value === '', 'rien n\'est choisi a sa place');
  dit(d.getElementById('bdvvParBoite').disabled, 'sans boite branchee, « Par ma boite » ne se coche pas');
  changer(w, 'bdvvExp', 'julien@clos.fr'); await pause(80);
  const c = appels.filter(a => a.chemin === '/rpc/brevo_choisir').pop();
  dit(c && c.x.corps.p_expediteur === 'julien@clos.fr' && c.x.corps.p_nom === 'Julien' && c.x.corps.p_chemin === null, 'choisir son adresse envoie l\'adresse et son nom, pas le chemin');
  dit(w.BdvBrevo.passe('affaires') && w.BdvBrevo.passe('devis'), 'branche, coche, adresse choisie : ces mails passent par Brevo');
}
{
  const { w, d, base } = monter({ maitre: false, boite: 'julien@gmail.com', brevo: Object.assign(BRANCHE(), { defaut_programmes: false }),
    choix: { chemin: 'bureau', expediteur: 'julien@clos.fr', expediteur_nom: 'Julien' } });
  await pause(120);
  dit(!w.BdvBrevo.passe('programmes'), 'une sorte decochee par le maitre ne passe pas par Brevo');
  dit(!d.getElementById('bdvvParBoite').disabled && /julien@gmail\.com/.test(d.getElementById('bdvvMoi').textContent), 'avec une boite branchee, « Par ma boite » la nomme');
  changer(w, 'bdvvParBoite', true); await pause(80);
  dit(base.choix.chemin === 'boite' && !w.BdvBrevo.passe('affaires'), 'par ma boite : plus rien ne passe par Brevo pour moi');
}
{
  const { w } = monter({ maitre: false, brevo: BRANCHE() });
  await pause(120);
  dit(w.BdvBrevo.passe('affaires'), 'sans adresse choisie, le mail va QUAND MEME vers Brevo, qui dira pourquoi il ne part pas (pas de bascule sur la boite)');
  dit(!w.BdvBrevo.passe('inconnue'), 'une sorte inconnue ne passe pas');
}
{
  const { w, d } = monter({ maitre: true, brevo: BRANCHE(), expRefus: true, choix: { chemin: 'bureau', expediteur: 'julien@clos.fr' } });
  await pause(150);
  dit(/désactivée/.test(d.getElementById('bdvvCorps').textContent) && !!d.getElementById('bdvvCle'), 'Brevo refuse la cle : l\'ecran le dit et le maitre peut la remplacer');
  dit(w.BdvBrevo.passe('affaires'), 'cle refusee : le mail ne bascule PAS sur la boite, il va vers Brevo qui le refusera en le disant');
  dit(/ne passent pas par ta boîte à la place/.test(d.getElementById('bdvvCorps').textContent), 'cle refusee : l\'ecran dit que rien ne bascule sur la boite');
}

console.log('\n== 5. Retirer, et la base absente ==');
{
  const { w, d, base } = monter({ maitre: true, brevo: BRANCHE() });
  await pause(100);
  clic(w, 'bdvvRetirer'); await pause();
  dit(!d.getElementById('bdvvConfirme').hidden && base.brevo, 'retirer demande confirmation, rien n\'est efface avant');
  dit(w.document.activeElement && w.document.activeElement.id === 'bdvvGarder', 'le focus va sur « Non, le garder »');
  clic(w, 'bdvvOui'); await pause(120);
  dit(base.brevo === null && !!d.getElementById('bdvvCle'), 'retire : la cle est effacee, le champ revient');
}
{
  const { d } = monter({ maitre: true, absente: true });
  await pause(80);
  dit(!d.getElementById('bdvvAbsente').hidden && d.getElementById('bdvvCorps').hidden, 'SQL pas passe : l\'ecran le dit, sans formulaire');
}

console.log('\n== 6. La fonction Edge et la base ==');
{
  const f = lire('supabase/functions/brevo/index.ts');
  const iMaitre = f.indexOf("rpc('brevo_est_maitre'"), iBrevo = f.indexOf("brevo(cle, '/account')");
  dit(iMaitre > 0 && iBrevo > iMaitre, 'brancher verifie le maitre AVANT d\'appeler Brevo');
  const iRanger = f.indexOf("rpc('brevo_ranger'");
  dit(iRanger > iBrevo && /if \(r\.statut !== 200 \|\| !r\.corps\) return reponse\(motDuRefus/.test(f), 'la cle n\'est rangee qu\'apres un oui de Brevo');
  dit(!/r\.brut\b[^;]*reponse\(|mot: r\.brut|erreur: r\.brut/.test(f) && !/console\.(log|error)/.test(f), 'aucun texte de Brevo ne sort, rien n\'est journalise');
  dit(/rpc\('brevo_est_membre'[\s\S]*rpc\('brevo_cle'/.test(f), 'les expediteurs : membre verifie avant de lire la cle');
  const s = lire('supabase/lot87-brevo.sql');
  dit(/grant select \(bureau, etat, compte_email/.test(s) && !/grant select \([^)]*secret_id/.test(s), 'la base ne laisse pas lire secret_id');
  dit(/brevo_cle\(uuid\) to service_role;/.test(s), 'la cle ne se relit qu\'avec la cle de service');
  const n = lire('src/mon-bureau.njk');
  dit(n.indexOf('/js/bdv-brevo.js') > n.indexOf('/js/bdv-boite.js'), 'bdv-brevo.js est charge apres bdv-boite.js');
  const r = lire('scripts/banc-rejeu.mjs');
  dit(/'lot87-brevo\.sql'/.test(r), 'le lot 87 est dans la procedure de reconstruction');
}

console.log('\n== 7. Envoyer par Brevo (lot 88) ==');
{
  const { w, fonctions } = monter({ maitre: false, brevo: BRANCHE(), choix: { chemin: 'bureau', expediteur: 'julien@clos.fr', expediteur_nom: 'Julien', copie_a_soi: true } });
  await pause(120);
  const r = await w.BdvBrevo.envoyer('devis', { a: ' client@cave.fr ', sujet: 'Votre devis', texte: 'Bonjour' });
  const f = fonctions.filter(x => x.c.action === 'envoyer').pop();
  dit(f && f.nom === 'brevo' && f.c.bureau === B && f.c.sorte === 'devis' && f.c.adresse === 'client@cave.fr', 'l\'envoi part vers la fonction brevo, avec son bureau, sa sorte et l\'adresse nettoyee');
  dit(r.ok && /Mail envoyé par Brevo depuis julien@clos\.fr, avec une copie/.test(r.mot), 'parti : le mot dit Brevo, l\'adresse et la copie');
  dit(!!w.document.getElementById('bdvvCopie') && w.document.getElementById('bdvvCopie').checked, 'la case de la copie a soi, cochee');
}
{
  const { w } = monter({ brevo: BRANCHE(), choix: { chemin: 'bureau', expediteur: 'julien@clos.fr' }, envoi: 'plafond' });
  await pause(120);
  const r = await w.BdvBrevo.envoyer('affaires', { a: 'c@d.fr', sujet: 'x', texte: 'y' });
  dit(!r.ok && /Pas parti : 200 mails/.test(r.mot) && /Ton texte est gardé/.test(r.mot), 'plafond : pas parti, dit pourquoi, le texte reste');
}
{
  const { w } = monter({ brevo: BRANCHE(), choix: { chemin: 'bureau', expediteur: 'julien@clos.fr' }, envoi: 'panne' });
  await pause(120);
  const r = await w.BdvBrevo.envoyer('affaires', { a: 'c@d.fr', sujet: 'x', texte: 'y' });
  dit(!r.ok && r.resultat === 'incertain' && /Peut-être parti/.test(r.mot), 'pas de reponse : « peut-etre parti », on ne pousse pas a renvoyer');
}
{
  /* Le vrai bdv-boite.js : c'est lui qui choisit le chemin. */
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window, routes = [];
  w.BdvCompte = { monBureau: () => B, monId: () => MOI, api: () => Promise.resolve([]), fonction: () => Promise.resolve({}) };
  w.BdvBrevo = { passe: (s) => s === 'devis', envoyer: (s, o) => { routes.push(s); return Promise.resolve({ ok: true, mot: 'par Brevo' }); },
    expediteur: () => 'julien@clos.fr', nom: () => 'Julien' };
  const sc = w.document.createElement('script'); sc.textContent = lire('src/js/bdv-boite.js'); w.document.body.appendChild(sc);
  await pause(60);
  dit(w.BdvBoite.prete('devis') && !w.BdvBoite.prete('affaires'), 'sans boite : un devis coche part par Brevo, une affaire non cochee n\'a aucun chemin');
  const r1 = await w.BdvBoite.envoyer({ sorte: 'devis', a: 'c@d.fr', sujet: 'x', texte: 'y' });
  const r2 = await w.BdvBoite.envoyer({ sorte: 'affaires', a: 'c@d.fr', sujet: 'x', texte: 'y' });
  dit(r1.ok && routes.join() === 'devis' && !r2.ok && r2.resultat === 'pas_branchee', 'le devis part par Brevo ; l\'affaire ne part pas par Brevo, et pas de boite');
  dit(w.BdvBoite.libelle('devis') === 'Envoyer par Brevo' && w.BdvBoite.libelle('affaires') === 'Envoyer depuis ma boîte', 'le bouton dit par ou part le mail');
  dit(w.BdvBoite.adresse('devis') === 'julien@clos.fr' && w.BdvBoite.nom('devis') === 'Julien', '« De : » dit l\'adresse et le nom Brevo');
}
{
  const aff = lire('src/js/bdv-affaires.js'), ecr = lire('src/js/bdv-ecrans.js'), dev = lire('src/js/bdv-devis.js');
  dit(/BdvBoite\.envoyer\(\{ a: mail, sujet: r\.sujet \|\| '', texte: r\.texte \|\| '', sorte: so \}\)/.test(aff), 'le redacteur d\'une affaire passe sa sorte');
  dit(/BdvBoite\.envoyer\(\{a:z\.dataset\.mail,sujet:sujet,texte:texte,sorte:'affaires'\}\)/.test(ecr), 'la fiche client passe sa sorte');
  dit(/BdvBoite\.prete\('devis'\)/.test(dev), 'le devis demande le chemin des devis');
  dit(!/BdvBoite\.prete\(\)/.test(aff + ecr + dev), 'plus aucun appel sans sorte dans les redacteurs');
  const fx = lire('supabase/functions/brevo/index.ts');
  const iPour = fx.indexOf("rpc('brevo_pour_envoi'"), iPerm = fx.indexOf("rpc('brevo_envoi_permis'"), iEnv = fx.indexOf('await envoyerBrevo(');
  dit(iPour > 0 && iPerm > iPour && iEnv > iPerm, 'la fonction : le chemin, puis le plafond, puis Brevo');
  dit(!/boite_pour_envoi|envoyerSmtp|envoyerGmail/.test(fx), 'la fonction brevo ne bascule jamais sur la boite');
  const mp = lire('supabase/functions/mails-programmes/index.ts');
  dit(mp.indexOf("rpc('brevo_pour_envoi'") > 0 && mp.indexOf("rpc('brevo_pour_envoi'") < mp.indexOf("rpc('boite_pour_envoi'"), 'les mails programmes demandent Brevo avant la boite');
  dit(/pb\.etat === 'refusee' \|\| pb\.etat === 'sans_expediteur'\)\) \{ issue = 'brevo'/.test(mp) && /if \(issue === 'erreur'\) \{\n\s*const bl = await rpc\('boite_pour_envoi'/.test(mp), 'un mail programme bloque cote Brevo ne part pas par la boite');
  const sb = lire('supabase/functions/_shared/brevo.ts');
  dit(/to: \[\{ email: a \}\]/.test(sb) && /htmlContent: texteEnHtml\(texte\)/.test(sb) && /textContent: texte/.test(sb), 'un seul destinataire, le texte tel quel, l\'HTML exige par Brevo n\'en est que l\'habillage');
  dit(/if \(r\.status >= 500\) return \{ resultat: 'incertain'/.test(sb) && /catch \{\n\s*return \{ resultat: 'incertain' \};/.test(sb), 'panne de Brevo ou pas de reponse : « incertain », jamais renvoye');
  dit(/'lot88-envoi-brevo\.sql'/.test(lire('scripts/banc-rejeu.mjs')), 'le lot 88 est dans la procedure de reconstruction');
}

console.log('\n' + (ko ? 'BANC BREVO : ' + ko + ' ECHEC(S), ' + ok + ' ok' : 'BREVO SE BRANCHE COMME PREVU : ' + ok + ' controles'));
process.exit(ko ? 1 : 0);
