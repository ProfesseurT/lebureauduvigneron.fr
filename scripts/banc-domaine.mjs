/* ============================================================================
   BANC DE LA FICHE DU DOMAINE, lot 38, 28/09/2026
   ============================================================================
   Ce qu'il garde, et pourquoi chaque point coute cher s'il lache :
   - l'annuaire TROUVE, le vigneron CHOISIT : rien n'est ecrit sans son clic ;
   - le numero de TVA n'est JAMAIS fabrique : un domaine en franchise n'en a pas,
     et un numero invente finirait imprime sur un devis ;
   - le delai de paiement reste sous le plafond legal du vin (30 jours fin de mois) ;
   - une ecriture qui ne rend aucune ligne est un echec, pas un succes ;
   - un annuaire muet ne bloque rien : la fiche se remplit a la main ;
   - le panneau des reglages ne dit plus « C'est enregistre » quand un bloc a echoue.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));

let ok = 0, ko = 0;
const dit = (b, m, det) => {
  if (b) { ok++; console.log('  ok    : ' + m); }
  else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + det : '')); }
};

const dom = new JSDOM('<!doctype html><body><div id="hote"></div></body>',
  { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
const w = dom.window;
const B = 'b0000000-0000-0000-0000-000000000001';

/* L'annuaire, rejoue : la forme de reponse est celle lue le 28/09/2026 sur
   recherche-entreprises.api.gouv.fr (champs `siege`, `tva` en tableau). */
const REPONSES = {
  deux: { results: [
    { siren: '987654321', nom_complet: 'SCEA ANCIENNE', etat_administratif: 'F', tva: null,
      siege: { siret: '98765432100011', code_postal: '49700', libelle_commune: 'DOUE' } },
    { siren: '123456789', nom_complet: 'EARL DOMAINE OUVERT', etat_administratif: 'A', tva: ['FR32123456789'],
      siege: { siret: '12345678900017', code_postal: '44190', libelle_commune: 'CLISSON' } }] },
  avecTva: { results: [{ siren: '130025265', nom_complet: 'DOMAINE ESSAI', etat_administratif: 'A', tva: ['FR07130025265'],
    siege: { siret: '13002526500013', numero_voie: '20', type_voie: 'AVENUE', libelle_voie: 'DE SEGUR', code_postal: '75007', libelle_commune: 'PARIS' } }] },
  sansTva: { results: [{ siren: '123456789', nom_complet: 'VIGNERON EN FRANCHISE', etat_administratif: 'A', tva: null,
    siege: { siret: '12345678900017', numero_voie: '3', type_voie: 'CHEMIN', libelle_voie: 'DES VIGNES', code_postal: '44190', libelle_commune: 'CLISSON' } }] }
};
let prochaine = 'avecTva', urls = [], panne = false;
w.fetch = (u) => {
  urls.push(String(u));
  if (panne) return Promise.reject(new Error('reseau'));
  const corps = REPONSES[prochaine];
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(corps))) });
};
let ecrits = [], rendre = true;
w.BdvCompte = {
  monBureau: () => B,
  api: (chemin, o) => {
    if (o && o.methode === 'POST') { ecrits.push({ chemin, o }); return Promise.resolve(rendre ? [Object.assign({}, o.corps)] : []); }
    return Promise.resolve([]);
  }
};
let blocs = [];
w.BdvReglages = { brancher: (o) => { blocs = blocs.concat(o.blocs || []); } };

const s = w.document.createElement('script');
s.textContent = fs.readFileSync(path.join(RACINE, 'src/js/bdv-domaine.js'), 'utf8');
w.document.body.appendChild(s);
const pause = (n) => new Promise(r => setTimeout(r, n || 30));
const $ = (id) => w.document.getElementById(id);

console.log('\n== 1. Le bloc ==');
dit(blocs.length === 1 && blocs[0].hote === 'domaine', 'le module contribue UN bloc a l\'onglet « Mon domaine »');
blocs[0].monter($('hote'));
await blocs[0].rafraichir();
dit(!!$('bdvdRaison') && !!$('bdvdQ') && !!$('bdvdPaiement'), 'la recherche, la fiche et les conditions sont dessinees');
dit($('bdvdPaiement').value === 'fdm' && $('bdvdJours').value === '30' && $('bdvdValidite').value === '30',
  'une fiche vierge propose 30 jours fin de mois et 30 jours de validite');
dit(!/onclick=/i.test($('hote').innerHTML), 'aucun onclick dans le dessin');

console.log('\n== 2. La recherche ==');
$('bdvdQ').value = '130 025 265 00013';
$('bdvdChercher').click(); await pause();
const u = urls[urls.length - 1] || '';
dit(u.indexOf('recherche-entreprises.api.gouv.fr/search?q=13002526500013') >= 0, 'un SIRET tape avec des espaces part en 14 chiffres', u);
dit(u.indexOf('per_page=5') >= 0, 'cinq resultats au plus');
dit(ecrits.length === 0 && $('bdvdRaison').value === '', 'CHERCHER N\'ECRIT RIEN, et ne remplit rien : le vigneron choisit');
w.document.querySelector('[data-bdvd-choisir="0"]').click();
dit($('bdvdRaison').value === 'DOMAINE ESSAI' && $('bdvdSiret').value === '13002526500013', 'son choix remplit la fiche');
dit($('bdvdAdresse').value === '20 AVENUE DE SEGUR' && $('bdvdCp').value === '75007' && $('bdvdVille').value === 'PARIS', 'avec l\'adresse du siege');
dit($('bdvdTva').value === 'FR07130025265', 'et le numero de TVA que l\'annuaire donne');

prochaine = 'sansTva';
$('bdvdQ').value = 'vigneron en franchise';
$('bdvdChercher').click(); await pause();
w.document.querySelector('[data-bdvd-choisir="0"]').click();
dit($('bdvdTva').value === '', 'LE NUMERO DE TVA N\'EST JAMAIS FABRIQUE : sans lui dans l\'annuaire, le champ reste vide', $('bdvdTva').value);
dit(/sans numéro de TVA/.test($('bdvdMot').textContent), 'et on le dit au vigneron');

prochaine = 'deux';
$('bdvdChercher').click(); await pause();
const lignes = [...w.document.querySelectorAll('.bdvd-ligne')];
dit(lignes.length === 2 && /EARL DOMAINE OUVERT/.test(lignes[0].textContent), 'LES ENTREPRISES OUVERTES D\'ABORD : une fermee n\'est jamais en tete');
dit(/^Fermée/.test(lignes[1].querySelector('.bdvd-nom').textContent) && lignes[1].querySelector('button').classList.contains('bdvr-btn--creux'),
  'une fermee le dit avant son nom, et son bouton est creux');
w.document.querySelector('[data-bdvd-choisir="0"]').click();
dit($('bdvdForme').value === 'EARL', 'le sigle en tete du nom remplit la forme juridique');
$('bdvdChercher').click(); await pause();
w.document.querySelector('[data-bdvd-choisir="1"]').click();
dit(/fermée/.test($('bdvdMot').textContent), 'choisir une fermee quand meme declenche un avertissement');
prochaine = 'sansTva';
$('bdvdChercher').click(); await pause();
w.document.querySelector('[data-bdvd-choisir="0"]').click();

panne = true;
$('bdvdChercher').click(); await pause();
dit(/à la main/.test($('bdvdMot').textContent), 'un annuaire muet ne bloque rien : on propose de remplir a la main');
panne = false;

console.log('\n== 3. Ce que la base refuserait, dit avant ==');
const D = w.BdvDomaine._defauts;
dit(D({ paiement_mode: 'fdm', paiement_jours: 60, validite_jours: 30 }).join(' ').indexOf('30 jours') >= 0, '60 jours fin de mois : refuse, plafond legal du vin');
dit(D({ paiement_mode: 'nets', paiement_jours: 31, validite_jours: 30 }).length === 1, '31 jours nets : refuse aussi');
dit(D({ paiement_mode: 'reception', paiement_jours: null, validite_jours: 30 }).length === 0, 'a reception : accepte, sans jours');
dit(D({ siret: '1300252650001', paiement_mode: 'reception', validite_jours: 30 }).length === 1, 'un SIRET de 13 chiffres : refuse');
dit(D({ siret: '13002526500013', tva: 'FR07999999999', paiement_mode: 'reception', validite_jours: 30 }).length === 1, 'une TVA qui ne correspond pas au SIRET : refusee');
dit(D({ paiement_mode: 'fdm', paiement_jours: 30, validite_jours: 0 }).length === 1, 'une validite nulle : refusee');

console.log('\n== 4. L\'ecriture ==');
$('bdvdJours').value = '45'; $('bdvdJours').dispatchEvent(new w.Event('input', { bubbles: true }));
let leve = false; try { await blocs[0].enregistrer(); } catch (e) { leve = true; }
dit(leve && ecrits.length === 0, '45 jours ne partent pas en base, et l\'echec remonte au panneau');
$('bdvdJours').value = '30'; $('bdvdJours').dispatchEvent(new w.Event('input', { bubbles: true }));
await blocs[0].enregistrer();
const e0 = ecrits[0];
dit(e0 && e0.chemin === '/domaine?on_conflict=bureau', 'une ligne par bureau, ecrite en fusion');
dit(e0 && e0.o.corps.bureau === B && e0.o.corps.siren === '123456789', 'elle nomme son bureau et tire le SIREN du SIRET');
dit(e0 && /return=representation/.test(e0.o.entetes.Prefer), 'et demande la ligne ecrite en retour');
rendre = false;
$('bdvdVille').value = 'CLISSON-SUR-SEVRE'; $('bdvdVille').dispatchEvent(new w.Event('input', { bubbles: true }));
leve = false; try { await blocs[0].enregistrer(); } catch (e) { leve = true; }
dit(leve, 'UNE ECRITURE QUI NE REND AUCUNE LIGNE EST UN ECHEC, pas un « Enregistre »');
const n = ecrits.length;
rendre = true;
await blocs[0].enregistrer(); await blocs[0].enregistrer();
dit(ecrits.length === n + 1, 'sans modification, rien ne repart');

console.log('\n== 5. Ce que le devis lira ==');
dit(w.BdvDomaine.complete() === true, 'la fiche est complete : raison sociale, SIRET, adresse');
dit(w.BdvDomaine.conditions({ paiement_mode: 'fdm', paiement_jours: 30 }) === 'Paiement à 30 jours fin de mois', 'les conditions se lisent en clair');
dit(w.BdvDomaine.conditions({ paiement_mode: 'reception' }) === 'Paiement à réception de facture', 'a reception aussi');

console.log('\n== 6. Le panneau ne ment plus ==');
const reg = fs.readFileSync(path.join(RACINE, 'src/js/bdv-reglages.js'), 'utf8');
dit(/const hoteOk = res\.slice\(2\)\.every/.test(reg) && /if\(!hoteOk\)\{/.test(reg),
  'un bloc qui echoue empeche « C\'est enregistre » et la fermeture du panneau');
dit(/'domaine':\s*'bdvrHoteDomaine'/.test(reg) && /id="bdvrBlocDomaine" data-onglet="Mon domaine"/.test(reg), 'l\'onglet « Mon domaine » existe et recoit le bloc');

console.log('\n== VERDICT ==');
console.log('  ' + ok + ' controle(s) passe(s), ' + ko + ' echec(s)');
console.log(ko ? '  LA FICHE DU DOMAINE PEUT MENTIR\n' : '  LA FICHE DU DOMAINE DIT CE QUE LE VIGNERON A CHOISI\n');
process.exit(ko ? 1 : 0);
