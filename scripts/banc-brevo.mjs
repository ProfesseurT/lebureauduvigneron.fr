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
  dit(/rien ne part encore par Brevo/i.test(d.getElementById('bdvvCorps').textContent), 'l\'ecran dit que rien ne part encore par Brevo');
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
  dit(/rien ne part encore par Brevo/i.test(d.getElementById('bdvvCorps').textContent), 'branche, l\'ecran dit encore que rien ne part par Brevo');
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
  dit(!w.BdvBrevo.passe('affaires'), 'sans adresse choisie, rien ne passe par Brevo');
  dit(!w.BdvBrevo.passe('inconnue'), 'une sorte inconnue ne passe pas');
}
{
  const { w, d } = monter({ maitre: true, brevo: BRANCHE(), expRefus: true, choix: { chemin: 'bureau', expediteur: 'julien@clos.fr' } });
  await pause(150);
  dit(/désactivée/.test(d.getElementById('bdvvCorps').textContent) && !!d.getElementById('bdvvCle'), 'Brevo refuse la cle : l\'ecran le dit et le maitre peut la remplacer');
  dit(!w.BdvBrevo.passe('affaires'), 'cle refusee : rien ne passe par Brevo');
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

console.log('\n' + (ko ? 'BANC BREVO : ' + ko + ' ECHEC(S), ' + ok + ' ok' : 'BREVO SE BRANCHE COMME PREVU : ' + ok + ' controles'));
process.exit(ko ? 1 : 0);
