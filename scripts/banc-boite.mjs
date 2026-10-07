/* ============================================================================
   BANC DE « BRANCHER SA BOITE », lot 76, 07/10/2026
   ============================================================================
   Ce qu'il garde :
   - le defaut est « Ma messagerie ouvre le mail » : rien a brancher, rien ne s'affiche ;
   - « Le bureau envoie pour moi » montre l'adresse (celle du compte a defaut), reconnait
     le fournisseur et dit quel mot de passe donner ; Outlook / iCloud : un mur calme, sans
     champ de mot de passe ;
   - rien n'est branche sans le code : l'essai mene au code, seul le bon code branche ;
   - le mot de passe ne part QUE vers la fonction `boite`, une fois, et quitte la page apres ;
   - branchee, l'ecran dit que l'envoi par le bureau arrive au lot suivant (aucune promesse
     fausse) ; retirer demande confirmation ;
   - toute requete nomme son bureau ; SQL absent : l'ecran le dit ;
   - la fonction Edge demande le plafond AVANT le serveur de mail, n'ecrit qu'a l'adresse
     branchee, et ne journalise jamais le mot de passe.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
let ok = 0, ko = 0;
const dit = (b, m, det) => { if (b) { ok++; console.log('  ok    : ' + m); } else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + det : '')); } };
const pause = (n) => new Promise(r => setTimeout(r, n || 30));
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const B = 'b0000000-0000-0000-0000-000000000001';
const MOI = 'a0000000-0000-0000-0000-000000000001';

function monter(o) {
  o = o || {};
  const dom = new JSDOM('<!doctype html><body><div id="hote"></div></body>', { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window;
  w.localStorage.setItem('bdv_session', JSON.stringify({ access_token: 'x', user: { id: MOI, email: 'julien@gmail.com' } }));
  const appels = [], fonctions = [], blocs = [];
  const base = { boite: o.boite || null };
  w.BdvReglages = { brancher: (x) => blocs.push(...x.blocs), profil: () => ({}) };
  w.BdvCompte = {
    monBureau: () => B, monId: () => MOI,
    api: (chemin, x) => {
      appels.push({ chemin, x });
      if (chemin.indexOf('/boites?select=') === 0) {
        if (o.absente) { const e = new Error('404'); e.status = 404; return Promise.reject(e); }
        return Promise.resolve(base.boite ? [base.boite] : []);
      }
      if (chemin.indexOf('/signatures') === 0 || chemin.indexOf('/signature_domaine') === 0) return Promise.resolve([]);
      if (chemin === '/rpc/est_maitre') return Promise.resolve(!!o.maitre);
      if (chemin === '/rpc/boites_du_bureau') return Promise.resolve(o.autres || []);
      if (chemin === '/rpc/boite_confirmer') {
        if (x.corps.p_code !== '654321') return Promise.resolve('faux');
        base.boite = Object.assign({}, base.boite, { etat: 'branchee', branchee_le: '2026-10-07T10:00:00Z', code_expire: null });
        return Promise.resolve('branchee');
      }
      if (chemin === '/rpc/boite_regler') { if (base.boite) Object.assign(base.boite, x.corps.p_utiliser == null ? {} : { utiliser: x.corps.p_utiliser }); return Promise.resolve(!!base.boite); }
      if (chemin === '/rpc/boite_retirer') { base.boite = null; return Promise.resolve(true); }
      return Promise.resolve([]);
    },
    fonction: (nom, c) => {
      fonctions.push({ nom, c });
      if (c.action === 'reconnaitre') {
        if (/outlook|icloud/.test(c.adresse)) return Promise.resolve({ statut: 'mur', nom: 'Outlook' });
        if (/gmail/.test(c.adresse)) return Promise.resolve({ statut: 'connu', cle: 'gmail', nom: 'Gmail', serveur: 'smtp.gmail.com', motDePasse: 'Un mot de passe d’application Google. Il se crée sur myaccount.google.com/apppasswords.' });
        return Promise.resolve({ statut: 'inconnu' });
      }
      if (c.action === 'tester') {
        if (c.mot_de_passe === 'mauvais') return Promise.resolve({ resultat: 'refus', fournisseur: 'gmail' });
        base.boite = { adresse: c.adresse, fournisseur: 'gmail', etat: 'a_confirmer', utiliser: true, copie_a_soi: true,
          code_expire: new Date(Date.now() + 900000).toISOString() };
        return Promise.resolve({ resultat: 'code' });
      }
      return Promise.resolve({});
    }
  };
  for (const f of ['src/js/bdv-signature.js', 'src/js/bdv-boite.js']) {
    const s = w.document.createElement('script'); s.textContent = lire(f); w.document.body.appendChild(s);
  }
  const hote = w.document.getElementById('hote');
  blocs.forEach(b => b.monter(hote));
  return { w, d: w.document, appels, fonctions, blocs, base };
}
const clic = (w, id) => w.document.getElementById(id).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const choisir = (w, id) => { const r = w.document.getElementById(id); r.checked = true; r.dispatchEvent(new w.Event('change', { bubbles: true })); };

console.log('\n== 1. Le defaut : ma messagerie ==');
{
  const { w, d, blocs } = monter();
  await pause(60);
  dit(blocs.length === 2 && blocs[1].hote === 'envois', 'deux blocs sur l\'onglet « Mes envois », la boite apres la signature');
  dit(d.getElementById('bdvbZone').previousElementSibling === d.getElementById('bdvsEtat'), 'la question vient juste sous la phrase d\'etat');
  dit(d.getElementById('bdvbMess').checked && !d.getElementById('bdvbBureau').checked, '« Ma messagerie ouvre le mail » est le defaut');
  dit(d.getElementById('bdvbForm').hidden && d.getElementById('bdvbCode').hidden, 'rien a brancher : aucun champ');
}

console.log('\n== 2. Le bureau envoie pour moi : reconnaitre, tester, le code ==');
{
  const { w, d, appels, fonctions } = monter();
  await pause(60);
  choisir(w, 'bdvbBureau'); await pause(60);
  dit(!d.getElementById('bdvbForm').hidden, 'le formulaire s\'ouvre');
  dit(d.getElementById('bdvbAdresse').value === 'julien@gmail.com', 'l\'adresse du compte, a defaut');
  dit(/prochaine mise à jour/.test(d.getElementById('bdvsEtat').textContent), 'la phrase d\'etat du haut dit, AVANT le mot de passe, que le bureau n\'envoie pas encore');
  dit(/seulement avec « Tester et brancher »/.test(d.getElementById('bdvbMdpAide').textContent), 'le mot de passe ne part qu\'avec « Tester et brancher », et l\'ecran le dit');
  dit(!!d.querySelector('#bdvbFourn a[href="https://myaccount.google.com/apppasswords"][target="_blank"]'), 'la page Google se touche, elle ne se retape pas');
  dit(/Gmail/.test(d.getElementById('bdvbFourn').textContent) && /application/.test(d.getElementById('bdvbFourn').textContent), 'le fournisseur est reconnu, et le mot de passe a donner est dit');
  d.getElementById('bdvbMdp').value = 'mauvais';
  clic(w, 'bdvbTester'); await pause(60);
  dit(/refusé/.test(d.getElementById('bdvbMot').textContent) && /mot de passe d’application/.test(d.getElementById('bdvbMot').textContent), 'un refus de Gmail dit qu\'il faut un mot de passe d\'application');
  dit(d.getElementById('bdvbCode').hidden, 'refuse : pas de code a taper');
  d.getElementById('bdvbMdp').value = 'abcd efgh ijkl mnop';
  clic(w, 'bdvbTester'); await pause(80);
  const t = fonctions.filter(f => f.c.action === 'tester').pop();
  dit(t && t.c.bureau === B && t.c.adresse === 'julien@gmail.com', 'l\'essai nomme son bureau et son adresse');
  dit(!d.getElementById('bdvbCode').hidden, 'le mail d\'essai parti : le champ du code s\'ouvre');
  dit(d.getElementById('bdvbMdp').value === '', 'le champ du mot de passe est vide apres l\'essai');
  dit(!appels.some(a => JSON.stringify(a.x || {}).indexOf('abcd efgh') >= 0), 'le mot de passe ne part JAMAIS vers la base, seulement vers la fonction');
  dit(appels.every(a => a.chemin.indexOf('/boites?') !== 0 || a.chemin.indexOf('bureau=eq.' + B) > 0), 'la lecture nomme son bureau');
  d.getElementById('bdvbCodeI').value = '111111';
  clic(w, 'bdvbBrancher'); await pause(60);
  dit(/pas le bon code/.test(d.getElementById('bdvbMot').textContent), 'un code faux se dit');
  d.getElementById('bdvbCodeI').value = '654 321';
  clic(w, 'bdvbBrancher'); await pause(80);
  dit(/est branchée/.test(d.getElementById('bdvbEtat').textContent), 'le bon code branche la boite');
  dit(/prochaine mise à jour/.test(d.getElementById('bdvsEtat').textContent), 'et l\'ecran dit que l\'envoi par le bureau n\'est pas encore la');
  dit(w.BdvBoite._etat().MDP === '', 'branchee, le mot de passe a quitte la memoire de la page');
  dit(d.getElementById('bdvbForm').hidden && d.getElementById('bdvbCode').hidden, 'branchee : ni formulaire ni code');
  dit(d.getElementById('bdvbCopie').checked, 'la copie a soi est cochee d\'office');
}

console.log('\n== 3. Les murs ==');
{
  const { w, d } = monter();
  await pause(60);
  choisir(w, 'bdvbBureau'); await pause(30);
  d.getElementById('bdvbAdresse').value = 'julien@outlook.fr';
  d.getElementById('bdvbAdresse').dispatchEvent(new w.Event('blur'));
  await pause(60);
  dit(/ne laisse pas le bureau/.test(d.getElementById('bdvbFourn').textContent) && /rien ne change/.test(d.getElementById('bdvbFourn').textContent), 'Outlook : un encadre calme, il reste sur sa messagerie');
  dit(d.getElementById('bdvbMdpZone').hidden && d.getElementById('bdvbTester').hidden, 'et aucun champ de mot de passe ne lui est demande');
  dit(d.getElementById('bdvbAideEssai').hidden && /partent de ta messagerie/.test(d.getElementById('bdvsEtat').textContent), 'ni aide orpheline, ni bandeau qui contredit l\'encadre');
  d.getElementById('bdvbAdresse').value = 'contact@domaine-inconnu.fr';
  d.getElementById('bdvbAdresse').dispatchEvent(new w.Event('blur'));
  await pause(60);
  dit(!d.getElementById('bdvbAutre').hidden, 'un fournisseur inconnu : le serveur se donne a la main');
}

console.log('\n== 4. Retirer, revenir a la messagerie, SQL absent ==');
{
  const boite = { adresse: 'julien@gmail.com', etat: 'branchee', utiliser: true, copie_a_soi: true, branchee_le: '2026-10-07T10:00:00Z' };
  const { w, d, appels } = monter({ boite, maitre: true, autres: [{ personne: 'x', adresse: 'camila@closfertel.fr', etat: 'branchee' }] });
  await pause(80);
  dit(d.getElementById('bdvbBureau').checked, 'une boite branchee et utilisee : le bureau envoie pour moi');
  dit(/camila@closfertel\.fr/.test(d.getElementById('bdvbAutres').textContent), 'le maitre voit d\'ou envoient ses collegues');
  clic(w, 'bdvbRetirer');
  dit(!d.getElementById('bdvbConfirme').hidden && d.activeElement.id === 'bdvbGarder', 'retirer demande confirmation, focus sur « Non, la garder »');
  dit(!appels.some(a => a.chemin === '/rpc/boite_retirer'), 'rien n\'est retire avant le oui');
  clic(w, 'bdvbOui'); await pause(80);
  dit(appels.some(a => a.chemin === '/rpc/boite_retirer' && a.x.corps.p_bureau === B), 'oui : la boite est retiree, au nom de son bureau');
  dit(d.getElementById('bdvbMess').checked && /effacé/.test(d.getElementById('bdvbMot').textContent), 'et l\'ecran revient a la messagerie en le disant');
}
{
  const boite = { adresse: 'julien@gmail.com', etat: 'branchee', utiliser: true, copie_a_soi: true, branchee_le: '2026-10-07T10:00:00Z' };
  const { w, d, appels } = monter({ boite });
  await pause(80);
  choisir(w, 'bdvbMess'); await pause(60);
  dit(appels.some(a => a.chemin === '/rpc/boite_regler' && a.x.corps.p_utiliser === false), 'revenir a ma messagerie s\'enregistre tout de suite, la boite reste branchee');
  dit(d.getElementById('bdvbEtat').hidden, 'et l\'etat de la boite se range');
}
{
  const { d } = monter({ absente: true });
  await pause(60);
  dit(!d.getElementById('bdvbAbsente').hidden && d.getElementById('bdvbCorps').hidden, 'SQL pas passe : l\'ecran le dit, rien a toucher');
}

console.log('\n== 5. La fonction Edge, la page, la RGPD ==');
{
  const f = lire('supabase/functions/boite/index.ts');
  dit(f.indexOf("rpc('boite_essai_permis'") > 0 && f.indexOf("rpc('boite_essai_permis'") < f.indexOf('createTransport'), 'le plafond est demande AVANT le serveur de mail');
  dit(/from: adresse, to: adresse,/.test(f) && !/to: corps/.test(f), 'l\'essai n\'ecrit qu\'a l\'adresse branchee (aucun relais)');
  dit(f.indexOf("rpc('boite_ranger'") > f.indexOf('sendMail'), 'le mot de passe n\'est range qu\'APRES un envoi accepte');
  dit(!/console\.(log|error)\([^)]*motDePasse/.test(f) && !/err\.message/.test(f.split('createTransport')[1] || ''), 'le mot de passe n\'est jamais journalise, et aucun message du serveur de mail ne sort');
  dit(/host: cible,/.test(f) && f.indexOf('adressePublique(serveur)') < f.indexOf('createTransport') && /servername: serveur/.test(f), 'on se connecte a une adresse PUBLIQUE resolue une fois (pas de serveur interne)');
  dit(/port: 465, secure: true/.test(f), 'SSL implicite sur le 465 (Supabase bloque 25 et 587)');
  const page = path.join(RACINE, '_site/mon-bureau/index.html');
  if (!fs.existsSync(page)) dit(false, 'la page construite existe (lancer npm run build)');
  else {
    const h = fs.readFileSync(page, 'utf8');
    dit(h.indexOf('/js/bdv-boite.js') > h.indexOf('/js/bdv-signature.js') && /bdv-boite\.js" defer/.test(h), 'la page charge le module apres la signature, en defer');
  }
  const r = lire('src/rgpd.njk');
  dit(/Vault/.test(r) && /chiffré/.test(r) && /Retirer ma boîte/.test(r), 'la page RGPD dit ce qu\'on garde de la boite, et comment l\'effacer');
}

console.log('\n' + (ko ? 'BANC DE LA BOITE : ' + ko + ' ECHEC(S) sur ' + (ok + ko) : 'BANC DE LA BOITE : ' + ok + ' controles, 0 echec'));
process.exit(ko ? 1 : 0);
