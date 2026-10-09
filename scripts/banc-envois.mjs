/* ============================================================================
   BANC DE « MES ENVOIS » : LA SIGNATURE DES MAILS, lot 75, 07/10/2026
   ============================================================================
   Ce qu'il garde :
   - `composer()` est PUR et decide seul de ce que dit la signature : nom, role et
     domaine, telephone (le mien, sinon celui du domaine), action, lien, actualite ;
   - l'ACTUALITE disparait seule a sa date de fin, et jamais sous un mail de souci
     (`promo: false`) ;
   - la mention loi Evin suit la PROMOTION (un lien ou une actualite), jamais seule ;
   - le pied legal ne s'ecrit que s'il porte un SIREN ou une ville de RCS ;
   - `suffixe()` est vide si rien n'est lu, si la personne ne veut pas de signature,
     ou si sa messagerie signe deja (sinon le client en recoit deux) ;
   - le HTML copie echappe tout ce qui vient du vigneron ;
   - ce que la base refuserait est dit AVANT d'envoyer ;
   - l'onglet monte dans le panneau : un simple utilisateur lit le bloc commun sans
     pouvoir l'ecrire, l'apercu suit ce qui est TAPE ;
   - les DEUX redacteurs (fiche client, affaire) collent le suffixe ;
   - la page construite porte l'onglet et charge le module.
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
  const dom = new JSDOM('<!doctype html><body><div id="hote"></div></body>',
    { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window;
  const appels = [];
  const blocs = [];
  if (o.reglages !== false) w.BdvReglages = { brancher: (x) => { blocs.push(...x.blocs); }, profil: () => o.profil || { prenom: 'Teddy' } };
  if (o.fiche) w.BdvDomaine = { fiche: () => o.fiche, charger: () => Promise.resolve(o.fiche) };
  if (o.bureau !== false) w.BdvCompte = {
    monBureau: () => B, monId: () => MOI,
    api: (chemin, x) => {
      appels.push({ chemin, x });
      if (o.absente && chemin.indexOf('/signatures') === 0) { const e = new Error('404'); e.status = 404; return Promise.reject(e); }
      if (chemin.indexOf('/signatures?select=') === 0) return Promise.resolve(o.perso ? [o.perso] : []);
      if (chemin.indexOf('/signature_domaine?select=') === 0) return Promise.resolve(o.commun ? [o.commun] : []);
      if (chemin === '/rpc/est_maitre') return Promise.resolve(o.maitre === true);
      if (chemin.indexOf('/signatures?on_conflict=') === 0) return Promise.resolve(o.rienEcrit ? [] : [Object.assign({ bureau: B, personne: MOI }, x.corps)]);
      if (chemin === '/rpc/signature_domaine_poser') return Promise.resolve([{ bureau: B, nom_domaine: x.corps.p_nom }]);
      return Promise.resolve([]);
    }
  };
  const s = w.document.createElement('script');
  s.textContent = lire('src/js/bdv-signature.js');
  w.document.body.appendChild(s);
  return { w, appels, blocs };
}

const JOUR = '2026-10-07';
const PERSO = { nom: 'Teddy Pereira', role: 'Vigneron', telephone: '06 12 34 56 78', dans_mails: true, messagerie_signe: false };
const COMMUN = { nom_domaine: 'Domaine du Clos Fertel', appellation: 'Saumur-Champigny',
  action: 'Caveau ouvert du mardi au samedi', lien: 'https://closfertel.fr/boutique',
  actualite: 'Salon des Vins de Loire, stand B12', actualite_fin: '2026-10-20', pied_legal: true };
const FICHE = { raison_sociale: 'Clos Fertel', forme_juridique: 'EARL', siret: '12345678900012', rcs_ville: 'Saumur', telephone: '02 41 00 00 00' };

console.log('\n== 1. composer() : ce que dit la signature ==');
{
  const { w } = monter({ bureau: false });
  const S = w.BdvSignature;
  const s = S.composer({ perso: PERSO, commun: COMMUN, fiche: FICHE, jour: JOUR });
  const t = s.lignes.map(x => x.k + ':' + x.t);
  dit(t[0] === 'nom:Teddy Pereira', 'le nom en premier', t[0]);
  dit(t[1] === 'role:Vigneron, Domaine du Clos Fertel (Saumur-Champigny)', 'role, domaine et appellation sur une ligne', t[1]);
  dit(t[2] === 'tel:06 12 34 56 78', 'mon telephone avant celui du domaine', t[2]);
  dit(t.indexOf('lien:closfertel.fr/boutique') >= 0, 'le lien s\'affiche sans https:// ni barre finale');
  dit(s.actualite === 'Salon des Vins de Loire, stand B12', 'l\'actualite du moment, avant sa date de fin');
  dit(s.lignes.length <= 6, 'six lignes au plus avant le pied', s.lignes.length);
  dit(s.pied[0] === 'EARL Clos Fertel, SIREN 123 456 789, RCS Saumur', 'le pied legal : forme, raison sociale, SIREN groupe, RCS', s.pied[0]);
  dit(s.evin && s.pied[s.pied.length - 1] === S.EVIN, 'la mention loi Evin ferme le pied des qu\'il y a un lien ou une actualite');
  dit(s.texte.split('\n\n').length === 2, 'le texte : les lignes, une ligne vide, le pied');

  const sansTel = S.composer({ perso: Object.assign({}, PERSO, { telephone: '' }), commun: COMMUN, fiche: FICHE, jour: JOUR });
  dit(sansTel.lignes.some(x => x.k === 'tel' && x.t === '02 41 00 00 00'), 'sans portable, le telephone du domaine');

  const passe = S.composer({ perso: PERSO, commun: COMMUN, fiche: FICHE, jour: '2026-10-21' });
  dit(!passe.actualite && !passe.lignes.some(x => x.k === 'actu'), 'l\'actualite disparait seule le lendemain de sa fin');
  const dernier = S.composer({ perso: PERSO, commun: COMMUN, fiche: FICHE, jour: '2026-10-20' });
  dit(dernier.actualite !== '', 'elle vaut encore le jour de sa fin');
  const souci = S.composer({ perso: PERSO, commun: COMMUN, fiche: FICHE, jour: JOUR }, { promo: false });
  dit(!souci.actualite, 'jamais d\'actualite sous un mail de souci (promo: false)');

  const sansPromo = S.composer({ perso: PERSO, commun: { nom_domaine: 'Domaine X', pied_legal: true }, fiche: FICHE, jour: JOUR });
  dit(!sansPromo.evin && sansPromo.pied.indexOf(S.EVIN) < 0, 'sans lien ni actualite, pas de mention Evin');
  const sansPied = S.composer({ perso: PERSO, commun: Object.assign({}, COMMUN, { pied_legal: false }), fiche: FICHE, jour: JOUR });
  dit(sansPied.pied.length === 1 && sansPied.pied[0] === S.EVIN, 'pied legal decoche : seule la mention Evin reste');
  const sansSiren = S.composer({ perso: PERSO, commun: { pied_legal: true }, fiche: { raison_sociale: 'Clos Fertel' }, jour: JOUR });
  dit(sansSiren.pied.length === 0, 'une raison sociale sans SIREN ni RCS ne fait pas un pied legal');
  const vide = S.composer({ jour: JOUR });
  dit(vide.vide && vide.texte === '' && vide.html === '', 'sans nom, la signature est vide');
  const prenom = S.composer({ profil: { prenom: 'Camila' }, jour: JOUR });
  dit(prenom.lignes[0] && prenom.lignes[0].t === 'Camila', 'sans signature reglee, le prenom du profil');

  const piege = S.composer({ perso: { nom: 'Ted <b onclick="x()">&' }, commun: { action: '"<script>' }, jour: JOUR });
  dit(piege.html.indexOf('<b ') < 0 && piege.html.indexOf('<script') < 0 && piege.html.indexOf('&lt;b') > 0, 'le HTML copie echappe tout ce qui vient du vigneron');
  dit(/href="tel:\+33612345678"/.test(s.html), 'le telephone est un lien tel: international dans le HTML');
  dit(!/var\(/.test(s.html) && /#1E2536/.test(s.html), 'le HTML du mail est en styles de ligne, valeurs en dur');
}

console.log('\n== 2. Le lien et ce que la base refuserait ==');
{
  const { w } = monter({ bureau: false });
  const S = w.BdvSignature;
  dit(S._lienNormal('closfertel.fr/boutique') === 'https://closfertel.fr/boutique', 'un lien tape sans https le recoit');
  dit(S._lienNormal('http://a.fr') === 'http://a.fr', 'un lien http reste tel quel');
  dit(S._lienNormal('pas un lien') === '' && S._lienNormal('javascript:alert(1)') === '', 'ce qui n\'est pas une adresse web est refuse');
  const d1 = S._defauts(null, { actualite: 'Salon', actualite_fin: null }, JOUR);
  dit(d1.some(m => /jusqu’à quand/.test(m)), 'une actualite sans date de fin est refusee avant d\'envoyer');
  const d2 = S._defauts(null, { actualite: 'Salon', actualite_fin: '2026-10-01' }, JOUR);
  dit(d2.some(m => /passée/.test(m)), 'une date de fin passee est refusee');
  const d3 = S._defauts({ telephone: 'appelle-moi' }, null, JOUR);
  dit(d3.length === 1, 'un telephone en lettres est refuse');
  const d4 = S._defauts(null, { lienBrut: 'pas un lien', lien: '' }, JOUR);
  dit(d4.some(m => /adresse web/.test(m)), 'un lien qui n\'en est pas est refuse, avec un exemple');
  dit(S._defauts(PERSO, Object.assign({ lienBrut: 'closfertel.fr/boutique' }, COMMUN), JOUR).length === 0, 'une signature juste passe');
}

console.log('\n== 3. suffixe() : ce que collent les redacteurs ==');
{
  let m = monter({ perso: PERSO, commun: COMMUN, fiche: FICHE });
  dit(m.w.BdvSignature.suffixe() === '', 'avant la lecture, rien (une absence n\'est pas une signature)');
  await m.w.BdvSignature.charger(); await pause();
  const sx = m.w.BdvSignature.suffixe();
  dit(sx.indexOf('\n\nTeddy Pereira\n') === 0, 'lue : une ligne vide puis la signature', JSON.stringify(sx.slice(0, 30)));
  dit(m.w.BdvSignature.suffixe({ promo: false }).indexOf('Salon') < 0, 'sans actualite sous un mail de souci');
  dit(m.appels.every(a => a.chemin.indexOf('/signatures?select=') !== 0 || a.chemin.indexOf('bureau=eq.' + B) > 0), 'la lecture nomme son bureau');

  m = monter({ perso: Object.assign({}, PERSO, { messagerie_signe: true }), commun: COMMUN });
  await m.w.BdvSignature.charger();
  dit(m.w.BdvSignature.suffixe() === '', 'ma messagerie signe deja : le bureau ne met rien');
  m = monter({ perso: Object.assign({}, PERSO, { dans_mails: false }), commun: COMMUN });
  await m.w.BdvSignature.charger();
  dit(m.w.BdvSignature.suffixe() === '', 'je ne veux pas de signature : rien');
  m = monter({ perso: null, commun: COMMUN });
  await m.w.BdvSignature.charger();
  dit(m.w.BdvSignature.suffixe() === '', 'aucune signature reglee : rien (pas de signature devinee dans un mail)');
  m = monter({ absente: true });
  await m.w.BdvSignature.charger();
  dit(m.w.BdvSignature.suffixe() === '' && m.w.BdvSignature.lue() === false, 'SQL pas passe : rien, et le module le sait');
}

console.log('\n== 4. L\'onglet dans le panneau ==');
{
  const m = monter({ perso: PERSO, commun: COMMUN, fiche: FICHE, maitre: false });
  dit(m.blocs.length === 1 && m.blocs[0].hote === 'envois', 'le module branche UN bloc sur l\'hote « envois »');
  const hote = m.w.document.getElementById('hote');
  m.blocs[0].monter(hote);
  await m.blocs[0].rafraichir(); await pause();
  const d = m.w.document;
  dit(d.getElementById('bdvsNom').value === 'Teddy Pereira', 'ma signature est relue dans les champs');
  dit(d.getElementById('bdvsDomaine').readOnly && d.getElementById('bdvsPied').disabled, 'simple utilisateur : le bloc commun est en lecture seule');
  dit(/Réglé par un administrateur/.test(d.getElementById('bdvsQui').textContent), 'et l\'ecran dit qui le regle');
  dit(d.getElementById('bdvsMessBureau').checked, 'la question de la messagerie est repondue « non » par defaut');
  const nom = d.getElementById('bdvsNom');
  nom.value = 'Camila Rossi';
  nom.dispatchEvent(new m.w.Event('input', { bubbles: true }));
  dit(/Camila Rossi/.test(d.getElementById('bdvsApercu').textContent), 'l\'apercu suit ce qui est TAPE');
  dit(d.querySelectorAll('[data-bdvs-copier]').length === 3, 'trois boutons de copie (Gmail, Outlook, iPhone)');
  d.getElementById('bdvsMessSigne').checked = true;
  d.getElementById('bdvsMessSigne').dispatchEvent(new m.w.Event('change', { bubbles: true }));
  dit(/ne met rien/.test(d.getElementById('bdvsApercuMot').textContent), 'messagerie qui signe : l\'apercu dit que le bureau ne met rien');
  await m.blocs[0].enregistrer();
  const ec = m.appels.find(a => a.chemin.indexOf('/signatures?on_conflict=bureau,personne') === 0);
  dit(ec && ec.x.corps.bureau === B && ec.x.corps.messagerie_signe === true && ec.x.corps.dans_mails === false, 'l\'enregistrement nomme le bureau et la reponse');
  dit(!m.appels.some(a => a.chemin === '/rpc/signature_domaine_poser'), 'un simple utilisateur n\'ecrit jamais le bloc commun');
}
{
  const m = monter({ perso: PERSO, commun: COMMUN, fiche: FICHE, maitre: true });
  m.blocs[0].monter(m.w.document.getElementById('hote'));
  await m.blocs[0].rafraichir(); await pause();
  const d = m.w.document;
  dit(!d.getElementById('bdvsDomaine').readOnly, 'le maitre peut ecrire le bloc commun');
  const a = d.getElementById('bdvsActuFin');
  a.value = '';
  a.dispatchEvent(new m.w.Event('input', { bubbles: true }));
  let leve = false;
  try { await m.blocs[0].enregistrer(); } catch (e) { leve = true; }
  dit(leve && /jusqu’à quand/.test(d.getElementById('bdvsMot').textContent), 'une actualite sans fin : refus dit, et la promesse rejetee (le panneau n\'annonce pas « enregistre »)');
  dit(!m.appels.some(x => x.chemin === '/rpc/signature_domaine_poser'), 'et rien n\'est parti');
  a.value = '2026-12-31';
  a.dispatchEvent(new m.w.Event('input', { bubbles: true }));
  await m.blocs[0].enregistrer();
  dit(m.appels.some(x => x.chemin === '/rpc/signature_domaine_poser' && x.x.corps.p_bureau === B), 'corrige : le bloc commun part par la fonction de la base');
}
{
  const m = monter({ perso: PERSO, commun: COMMUN, maitre: true, rienEcrit: true });
  m.blocs[0].monter(m.w.document.getElementById('hote'));
  await m.blocs[0].rafraichir(); await pause();
  const nom = m.w.document.getElementById('bdvsNom');
  nom.value = 'X'; nom.dispatchEvent(new m.w.Event('input', { bubbles: true }));
  let leve = false;
  try { await m.blocs[0].enregistrer(); } catch (e) { leve = true; }
  dit(leve, 'une ecriture qui ne rend aucune ligne est un echec, jamais « enregistree »');
}
{
  const m = monter({ absente: true });
  m.blocs[0].monter(m.w.document.getElementById('hote'));
  await m.blocs[0].rafraichir(); await pause();
  const d = m.w.document;
  dit(!d.getElementById('bdvsAbsente').hidden && d.getElementById('bdvsCorps').hidden, 'SQL pas passe : l\'onglet le dit et cache les champs');
}

console.log('\n== 5. Branche sur la page et sur les deux redacteurs ==');
{
  const reg = lire('src/js/bdv-reglages.js');
  dit(/id="bdvrBlocEnvois" data-onglet="Mes envois"/.test(reg) && /'envois':\s*'bdvrHoteEnvois'/.test(reg), 'le panneau porte l\'onglet « Mes envois » et son hote');
  dit(/envois:\s*'bdvrBlocEnvois'/.test(reg), 'l\'onglet se vise par son nom court');
  const aff = lire('src/js/bdv-affaires.js');
  dit(/M\.texte\(r\.k, ctx, r\.coches\)\s*\+\s*\(window\.BdvSignature \? BdvSignature\.suffixe\(\{ promo: r\.k !== 'pas_pour_cette_fois' \}\)/.test(aff), 'le redacteur d\'une affaire colle la signature, sans actualite sous « Pas pour cette fois »');
  const ecr = lire('src/js/bdv-ecrans.js');
  dit(/'Bien à vous,'\);\s*\n[^\n]*\n\s*return corps\.join\('\\n'\)\+\(window\.BdvSignature\?BdvSignature\.suffixe\(/.test(ecr), 'le redacteur de la fiche client colle la signature apres « Bien a vous, »');
  const page = path.join(RACINE, '_site/mon-bureau/index.html');
  if (!fs.existsSync(page)) { dit(false, 'la page construite existe (lancer npm run build)'); }
  else {
    const h = fs.readFileSync(page, 'utf8');
    const iSig = h.indexOf('/js/bdv-signature.js'), iDom = h.indexOf('/js/bdv-domaine.js');
    dit(iSig > 0 && /bdv-signature\.js" defer/.test(h), 'la page charge le module, en defer');
    dit(iDom > 0 && iSig > iDom, 'apres bdv-domaine.js, dont il lit la fiche');
  }
  const rgpd = lire('src/rgpd.njk');
  dit(/signature/i.test(rgpd) && /Mes envois/.test(rgpd), 'la page RGPD dit ce que garde la signature');
}

console.log('\n' + (ko ? 'BANC DE MES ENVOIS : ' + ko + ' ECHEC(S) sur ' + (ok + ko) : 'BANC DE MES ENVOIS : ' + ok + ' controles, 0 echec'));
process.exit(ko ? 1 : 0);
