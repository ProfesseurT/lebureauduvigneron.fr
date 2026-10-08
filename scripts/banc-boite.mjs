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
      if (chemin === '/rpc/boite_nommer') { if (base.boite) base.boite.nom_affiche = x.corps.p_nom; return Promise.resolve(!!base.boite); }
      if (chemin === '/rpc/boite_retirer') { base.boite = null; return Promise.resolve(true); }
      if (chemin === '/rpc/boite_logo') { if (o.logoRefus) return Promise.reject(new Error('500')); if (base.boite && x.corps.p_avec != null) base.boite.logo_dans_mails = x.corps.p_avec; return Promise.resolve(!!base.boite && x.corps.p_avec != null); }
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
  if (o.logo !== undefined) w.BdvLogo = { image: () => o.logo };
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
  dit(/tant qu’elle ne l’est pas, ta messagerie ouvre le mail/.test(d.getElementById('bdvsEtat').textContent), 'la phrase d\'etat du haut dit, AVANT le mot de passe, que la messagerie sert tant que la boite n\'est pas branchee');
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
  dit(/Tes mails partent de ta boîte julien@gmail\.com/.test(d.getElementById('bdvsEtat').textContent) && /ta messagerie prend le relais/.test(d.getElementById('bdvsEtat').textContent), 'branchee : la phrase d\'etat dit d\'ou partent les mails, et le relais');
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
  const tout = lire('supabase/functions/boite/index.ts');
  const f = tout.slice(tout.indexOf("if (action !== 'tester')"));
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

console.log('\n== 6. Lot 77 : envoyer depuis ma boite ==');
{
  const boite = { adresse: 'julien@gmail.com', etat: 'branchee', utiliser: true, copie_a_soi: true, branchee_le: '2026-10-07T10:00:00Z' };
  const { w, fonctions } = monter({ boite });
  await pause(80);
  dit(w.BdvBoite.prete(), 'une boite branchee et utilisee est prete');
  const appel = w.BdvCompte.fonction;
  w.BdvCompte.fonction = (nom, c) => { fonctions.push({ nom, c }); return Promise.resolve(c.action === 'envoyer' ? { resultat: 'parti', de: 'julien@gmail.com', copie: true } : {}); };
  const r1 = await w.BdvBoite.envoyer({ a: 'cave@exemple.fr', sujet: 'Objet', texte: 'Texte' });
  const e = fonctions.filter(x => x.c.action === 'envoyer').pop();
  dit(r1.ok && /copie/.test(r1.mot) && e.c.bureau === B && e.c.adresse === 'cave@exemple.fr', 'l\'envoi nomme son bureau et son destinataire, et dit la copie');
  dit(!('de' in e.c) && !('from' in e.c), 'l\'expediteur n\'est jamais demande au navigateur (la base le lit)');
  w.BdvCompte.fonction = () => Promise.resolve({ resultat: 'refus' });
  const r2 = await w.BdvBoite.envoyer({ a: 'cave@exemple.fr', sujet: 'Objet', texte: 'Texte' });
  dit(!r2.ok && /Rebranche-la/.test(r2.mot) && /messagerie/.test(r2.mot), 'mot de passe refuse : rien n\'est perdu, la messagerie est proposee');
  dit(!w.BdvBoite.prete(), 'et la boite n\'est plus prete : le redacteur repasse par la messagerie');
  w.BdvCompte.fonction = () => Promise.reject(new Error('reseau'));
  w.BdvBoite._etat().BOITE.etat = 'branchee';
  const r3 = await w.BdvBoite.envoyer({ a: 'cave@exemple.fr', sujet: 'Objet', texte: 'Texte' });
  dit(r3.resultat === 'incertain' && /Envoyés avant de le renvoyer/.test(r3.mot), 'pas de reponse : « peut-etre parti », on ne pousse pas a renvoyer');
  w.BdvCompte.fonction = appel;
}
{
  const { w } = monter({ boite: { adresse: 'j@gmail.com', etat: 'branchee', utiliser: false } });
  await pause(80);
  dit(!w.BdvBoite.prete(), '« ma messagerie ouvre le mail » choisi : la boite ne sert pas');
}
{
  const tout = lire('supabase/functions/boite/index.ts');
  const env = tout.slice(tout.indexOf('async function envoyer('), tout.indexOf('Deno.serve('));
  dit(env.indexOf("rpc('boite_envoi_permis'") > 0 && env.indexOf("rpc('boite_envoi_permis'") < env.indexOf('createTransport'), 'envoyer : le plafond du jour avant le serveur de mail');
  dit(/from: expediteur\(b\), to: \{ name: '', address: a \},/.test(env) && /b\.copie_a_soi && a !== b\.adresse \? \{ bcc: b\.adresse \}/.test(env), 'envoyer : l\'expediteur vient de la base, la copie va a soi seulement');
  dit(/host: cible,/.test(env) && /rpc\('boite_reconnecter'/.test(env) && !/err\.message/.test(env), 'envoyer : adresse publique, boite a reconnecter si le mot de passe est refuse, aucun message du serveur renvoye');
  dit(!/err\.code === 'EAUTH' \|\| rc === 535/.test(env) && /if \(rc === 535 \|\| rc === 534 \|\| rc === 530\) \{\s*try \{ await rpc\('boite_reconnecter'/.test(env), 'seul un refus franc (530, 534, 535) passe la boite a reconnecter, pas un incident');
  dit(/\(action === 'envoyer' \? 25000 : 4000\)/.test(tout), 'un mail long (25 000 signes) peut partir');
  dit(/ADRESSE = \/\^\[\^@\\s\(\)<>,;:/.test(tout), 'une adresse ne porte ni parenthese, ni chevron, ni virgule : celle controlee est celle qui part');
  const aff = lire('src/js/bdv-affaires.js'), ecr = lire('src/js/bdv-ecrans.js');
  dit(/data-aff="redacEnvoyer">' \+ \(progVise\(r\) \? 'Envoyer maintenant' : 'Envoyer depuis ma boîte'\)/.test(aff) && /await redacEnvoye\(a, b, \{ parti: fige \+ res\.mot, rp: rpF \}\)/.test(aff), 'redacteur d\'une affaire : le bouton, puis le meme journal que « Considere comme envoye »');
  dit(/r\.parti = true;\s*var fige = r\.figeMot \|\| '', rpF = r\.rpFige;\s*if \(JOURNAL_ABSENT\)/.test(aff) && /r\.parti \? '<div class="aff-redac__gestes aff-redac__parti">/.test(aff) && /data-aff="redacAutre">Écrire un autre mail/.test(aff), 'parti : les boutons laissent place au resultat, pas de second envoi d\'un clic');
  dit(/De : ' \+ deBoite\(\)/.test(aff) && /De : \$\{deBoite\(\)\}/.test(ecr), 'la boite d\'envoi est dite AVANT le clic, dans les deux redacteurs');
  /* Demande de Ted (08/10/2026) : boite branchee, UN seul bouton. */
  dit(/\(boite \? '<button type="button" class="btn' \+ \(progVise\(r\) \? '' : ' btn--bordeaux'\) \+ ' aff-redac__envoyer"/.test(aff)
    && /: \(mail \? '<a class="btn btn--bordeaux" data-redac="ouvrir"/.test(aff) && /: boite \? ''\s*: '<div class="aff-redac__fin">'/.test(aff)
    && !/Parti de ta messagerie/.test(aff), 'redacteur d\'une affaire, boite branchee : ni messagerie, ni copie, ni « Considere comme envoye »');
  dit(/\$\{boite\?`<button class="btn btn--primary btn--sm" id="msgEnvoyer"[^`]*`\s*:`\$\{mail\?`<a class="btn btn--primary btn--sm" id="msgOuvrir"/.test(ecr)
    && /\$\{boite\?'':`<button class="btn btn--ghost btn--sm" onclick="messageEnvoye\(this\)">Considéré comme envoyé/.test(ecr), 'fiche client, boite branchee : le meme seul bouton');
  dit(/if \(opts && opts\.mail && issue === 'en_cours'\) \{\s*REDAC\[id\] = \{ k: 'devis', kAuto: false/.test(aff), 'retour du devis par « Envoyer le devis par email » : le redacteur s\'ouvre sur l\'envoi du devis');
  dit(/id="msgEnvoyer" onclick="envoyerMessage\(this\)">Envoyer depuis ma boîte/.test(ecr) && /if\(!res\.ok\)\{status\('error',res\.mot\);return;\}/.test(ecr), 'fiche client : le bouton, et un echec ne note rien');
}

console.log('\n== 7. Le nom que voient les clients (lot 78) ==');
{
  const boite = { adresse: 'julien@gmail.com', etat: 'branchee', utiliser: true, copie_a_soi: true, branchee_le: '2026-10-07T10:00:00Z' };
  const { d } = monter({ boite });
  await pause(100);
  dit(!d.getElementById('bdvbNom'), 'SQL du lot 78 pas passe : pas de champ, et la boite se lit quand meme');
}
{
  const boite = { adresse: 'julien@gmail.com', etat: 'branchee', utiliser: true, copie_a_soi: true, branchee_le: '2026-10-07T10:00:00Z', nom_affiche: null };
  const { w, d, appels, base } = monter({ boite });
  await pause(100);
  const i = d.getElementById('bdvbNom');
  dit(!!i && i.value === '' && /Vide : le nom de ta signature/.test(d.getElementById('bdvbNomAide').textContent), 'branchee : le champ, vide sans signature, et l\'aide dit ce que veut dire vide');
  dit(appels.some(a => a.chemin === '/boites?select=nom_affiche&bureau=eq.' + B), 'le nom se lit a part, au nom de son bureau');
  i.value = '  Julien,   Domaine du Clos ';
  i.dispatchEvent(new w.Event('input', { bubbles: true }));
  i.dispatchEvent(new w.Event('change', { bubbles: true })); await pause(60);
  const n = appels.filter(a => a.chemin === '/rpc/boite_nommer').pop();
  dit(n && n.x.corps.p_bureau === B && n.x.corps.p_nom === 'Julien, Domaine du Clos', 'le nom s\'enregistre en quittant le champ, resserre, au nom de son bureau');
  dit(/verront « Julien, Domaine du Clos »/.test(d.getElementById('bdvbMot').textContent) && base.boite.nom_affiche === 'Julien, Domaine du Clos', 'et l\'ecran dit ce que verront les clients');
  const avant = appels.length;
  i.value = 'service@banque.fr';
  i.dispatchEvent(new w.Event('change', { bubbles: true })); await pause(60);
  dit(appels.length === avant && /ne peut pas contenir @/.test(d.getElementById('bdvbMot').textContent), 'un nom qui ressemble a une adresse est refuse avant de partir');
  i.value = '';
  i.dispatchEvent(new w.Event('change', { bubbles: true })); await pause(60);
  const v = appels.filter(a => a.chemin === '/rpc/boite_nommer').pop();
  dit(v.x.corps.p_nom === null && /adresse seule/.test(d.getElementById('bdvbMot').textContent), 'vide : le nom part a null, et l\'ecran dit que l\'adresse sera seule');
}
{
  const tout = lire('supabase/functions/boite/index.ts');
  const ex = tout.slice(tout.indexOf('function expediteur('), tout.indexOf('async function envoyer('));
  dit(/\[\\u0000-\\u001F\\u007F@<>"\\\\\]/.test(ex) && /return n \? \{ name: n, address: b\.adresse \} : b\.adresse;/.test(ex), 'la fonction refiltre le nom (celui de la signature n\'est pas controle par la base) et laisse l\'adresse seule sans nom');
}

console.log('\n== 8. Le logo sous les mails, et le nom de la ligne « De : » (lot 79) ==');
{
  const boite = { adresse: 'julien@gmail.com', etat: 'branchee', utiliser: true, copie_a_soi: true, branchee_le: '2026-10-07T10:00:00Z' };
  const { d } = monter({ boite, logo: null });
  await pause(100);
  dit(!d.getElementById('bdvbLogo'), 'SQL du lot 79 pas passe : pas de case, et la boite se lit quand meme');
}
{
  const boite = { adresse: 'julien@gmail.com', etat: 'branchee', utiliser: true, copie_a_soi: true, branchee_le: '2026-10-07T10:00:00Z', nom_affiche: 'Julien, Domaine du Clos', logo_dans_mails: true };
  const { w, d, appels, base } = monter({ boite, logo: null });
  await pause(100);
  const c = d.getElementById('bdvbLogo');
  dit(!!c && c.checked, 'branchee : la case du logo, cochee comme en base');
  dit(appels.some(a => a.chemin === '/boites?select=logo_dans_mails&bureau=eq.' + B), 'la case se lit a part, au nom de son bureau');
  dit(/Mon domaine/.test(d.getElementById('bdvbLogoAide').textContent) && c.getAttribute('aria-describedby') === 'bdvbLogoAide', 'sans logo, l\'aide dit ou l\'ajouter, et la case la nomme');
  c.checked = false; c.dispatchEvent(new w.Event('change', { bubbles: true })); await pause(60);
  const r = appels.filter(a => a.chemin === '/rpc/boite_logo').pop();
  dit(r && r.x.corps.p_bureau === B && r.x.corps.p_avec === false && base.boite.logo_dans_mails === false, 'decocher part tout de suite, au nom de son bureau');
  dit(/sans logo/.test(d.getElementById('bdvbMot').textContent), 'et l\'ecran dit que les mails partiront sans logo');
  dit(w.BdvBoite.nom() === 'Julien, Domaine du Clos', 'BdvBoite.nom() rend le nom que voient les clients');
}
{
  const boite = { adresse: 'julien@gmail.com', etat: 'branchee', utiliser: true, copie_a_soi: true, branchee_le: '2026-10-07T10:00:00Z', nom_affiche: null, logo_dans_mails: true };
  const { w, d } = monter({ boite, logo: 'data:image/png;base64,iVBORw0KGgo=', logoRefus: true });
  await pause(100);
  dit(/seulement quand le bureau envoie depuis ta boîte/.test(d.getElementById('bdvbLogoAide').textContent), 'avec un logo, l\'aide dit quand il part');
  const c = d.getElementById('bdvbLogo');
  c.checked = false; c.dispatchEvent(new w.Event('change', { bubbles: true })); await pause(60);
  dit(c.checked === true && /pas été enregistré/.test(d.getElementById('bdvbMot').textContent), 'un refus remet la case et le dit');
  dit(w.BdvBoite.nom() === '', 'sans nom choisi ni signature : BdvBoite.nom() est vide (l\'adresse seule)');
}
{
  const aff = lire('src/js/bdv-affaires.js'), ecr = lire('src/js/bdv-ecrans.js');
  const parens = /\(n \? ' \(' \+ esc\(BdvBoite\.adresse\(\)\) \+ '\)' : ''\)/;
  dit(parens.test(aff) && /\(n\?' \('\+esc\(BdvBoite\.adresse\(\)\)\+'\)':''\)/.test(ecr), '« De : » dit le nom, puis l\'adresse entre parentheses, dans les deux redacteurs');
}

console.log('\n' + (ko ? 'BANC DE LA BOITE : ' + ko + ' ECHEC(S) sur ' + (ok + ko) : 'BANC DE LA BOITE : ' + ok + ' controles, 0 echec'));
process.exit(ko ? 1 : 0);
