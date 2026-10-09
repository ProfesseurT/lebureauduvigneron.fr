/* ============================================================================
   BANC DE LA MISE EN ROUTE, 09/10/2026 (src/js/bdv-mise-en-route.js)
   ============================================================================
   Ce qu'il garde, et ce que chaque point coute s'il lache :
   - la progression se CALCULE : une boite qui se debranche fait repasser l'etape
     « a refaire », et cette etape passe avant la suivante ;
   - une lecture ratee n'est ni faite ni proposee (une absence n'est pas un zero),
     et sans role connu la carte se tait ;
   - un membre invite n'a que trois etapes ; sans Vitisoft, l'affaire remplace la base ;
   - aucun consentement (courrier, notifications) ne compte dans la barre ;
   - « Pas aujourd'hui » cache la carte pour la journee, jamais le bandeau des reglages ;
   - le module n'a AUCUN champ : chaque etape mene a l'onglet qui porte deja le reglage.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = await import(path.join(RACINE, 'node_modules/jsdom/lib/api.js'));
const SRC = fs.readFileSync(path.join(RACINE, 'src/js/bdv-mise-en-route.js'), 'utf8');

let ok = 0, ko = 0;
const dit = (b, m, det) => {
  if (b) { ok++; console.log('  ok    : ' + m); }
  else { ko++; console.log('  ECHEC : ' + m + (det !== undefined ? '  -> ' + det : '')); }
};

/* Un decor par situation. `s` dit ce que rendent le serveur et les modules voisins. */
async function monter(s) {
  const dom = new JSDOM('<!doctype html><body><p id="bureauSalut">Bonjour</p><section id="bureauMer" hidden></section>'
    + '<div class="bdvr-tete"><div id="bdvrOnglets"><button class="bdvr-onglet" data-cible="bdvrBlocClassement">Le classement</button></div></div>'
    + '<fieldset id="bdvrBlocClassement" data-onglet="Le classement"></fieldset></body>',
    { url: 'https://lebureauduvigneron.fr/mon-bureau/', runScripts: 'dangerously' });
  const w = dom.window;
  w.__appels = [];
  w.BdvCompte = {
    monBureau: () => 'b1', monId: () => 'u1',
    api: async (ch) => {
      w.__appels.push(ch);
      if (ch.startsWith('/rpc/est_maitre')) { if (s.role === 'panne') throw new Error('x'); return s.role === 'membre' ? false : true; }
      if (ch.startsWith('/profils')) return [{ prenom: s.prenom === undefined ? 'Ted' : s.prenom, utilise_vitisoft: s.viti || 'oui' }];
      if (ch.startsWith('/reglages')) { if (s.reglages === 'panne') throw new Error('x'); return [{ depose_le: s.depose || null, valide: !!s.valide }]; }
      if (ch.startsWith('/affaires')) return s.affaires || [];
      return [];
    }
  };
  w.BdvDomaine = { lue: () => s.domaine !== 'panne', complete: () => s.domaine === true, charger: async () => null };
  const B = { LU: s.boite !== 'panne', BOITE: s.boite === 'reconnecter' ? { etat: 'reconnecter' } : null };
  w.BdvBoite = { _etat: () => B, prete: () => s.boite === 'branchee', charger: async () => null };
  w.BdvSignature = { lue: () => true, perso: () => (s.sig ? { nom: 'Romane' } : null), charger: async () => null };
  w.__ouvert = null;
  w.BdvNav = { ouvrirReglages: (o) => { w.__ouvert = o; }, afficher: (p) => { w.__piece = p; } };
  const sc = w.document.createElement('script'); sc.textContent = SRC; w.document.body.appendChild(sc);
  await w.BdvMiseEnRoute.relire();
  return w;
}
const cles = (e) => e.liste.map((x) => x.cle).join(',');

console.log('== 1. Le vigneron avec Vitisoft ==');
let w = await monter({ domaine: true, depose: '2026-10-02', valide: false, boite: 'rien' });
let e = w.BdvMiseEnRoute.etat();
dit(cles(e) === 'qui,domaine,base,classement,mails', 'cinq etapes, dans l’ordre du parcours', cles(e));
dit(e.fait === 3 && e.total === 5, '3 sur 5', e.fait + '/' + e.total);
dit(e.suite && e.suite.cle === 'classement', 'la prochaine est le classement');
let z = w.document.getElementById('bureauMer');
dit(!z.hidden && /3 sur 5/.test(z.textContent) && /reste 5 min/.test(z.textContent), 'la carte dit le compte et le temps qui reste', z.textContent.slice(0, 80));
dit(z.querySelectorAll('.btn').length === 1, 'un seul bouton plein dans la carte');
dit(!/courrier|notification/i.test(cles(e)), 'aucun consentement dans la barre');

console.log('== 2. Une etape defaite passe avant la suivante ==');
w = await monter({ domaine: true, depose: '2026-10-02', valide: false, boite: 'reconnecter' });
e = w.BdvMiseEnRoute.etat();
dit(e.suite && e.suite.cle === 'mails' && e.suite.fait === 'refaire', 'la boite a reconnecter est proposee avant le classement');
z = w.document.getElementById('bureauMer');
dit(/1 à refaire/.test(z.textContent), '« 1 a refaire » ecrit en mots');
dit(z.querySelector('.mer__seg--refaire') !== null, 'le segment a refaire a sa forme a lui');
dit(/reste 3 min/.test(z.textContent), 'le temps compte 1 min pour reconnecter, pas 3', (z.textContent.match(/reste \d+ min/) || [''])[0]);

console.log('== 3. Une lecture ratee n’est ni faite ni proposee ==');
w = await monter({ domaine: 'panne', reglages: 'panne', boite: 'branchee' });
e = w.BdvMiseEnRoute.etat();
const inc = e.liste.filter((x) => x.fait === null).map((x) => x.cle).join(',');
dit(inc === 'domaine,base,classement', 'domaine, base et classement inconnus', inc);
dit(!e.suite, 'rien n’est propose quand seul l’inconnu reste');
dit(e.fait === 2, 'l’inconnu ne compte pas comme fait', e.fait);
dit(w.document.getElementById('bureauMer').hidden, 'une carte sans geste a proposer se tait');
dit(w.BdvMiseEnRoute._minutes([{ fait: null, min: '3 min' }, { fait: false, min: '2 min' }]) === 2, 'le temps qui reste ne compte pas l’inconnu');
w = await monter({ role: 'panne' });
dit(w.BdvMiseEnRoute.etat() === null && w.document.getElementById('bureauMer').hidden, 'sans role connu, la carte se tait');

console.log('== 4. Le membre invite ==');
w = await monter({ role: 'membre', boite: 'rien', sig: false });
e = w.BdvMiseEnRoute.etat();
dit(cles(e) === 'qui,signature,mails', 'trois etapes a lui', cles(e));
dit(!w.__appels.some((c) => c.startsWith('/reglages')), 'ni la base ni le classement ne sont lus pour lui');

console.log('== 5. Sans Vitisoft ==');
w = await monter({ viti: 'non', domaine: true, affaires: [{ issue: 'en_cours', rappel: null }], boite: 'rien' });
e = w.BdvMiseEnRoute.etat();
dit(cles(e) === 'qui,domaine,affaire,rappel,mails', 'l’affaire et son rappel remplacent la base', cles(e));
dit(e.suite && e.suite.cle === 'rappel', 'une affaire sans rappel : le rappel est la suite');

console.log('== 6. Fini, et « Pas aujourd’hui » ==');
w = await monter({ domaine: true, depose: '2026-10-02', valide: true, boite: 'branchee' });
dit(w.document.getElementById('bureauMer').hidden, 'cinq sur cinq : la carte disparait');
w = await monter({ domaine: true, depose: '2026-10-02', valide: false, boite: 'rien' });
w.document.querySelector('[data-mer="pas"]').click();
dit(w.document.getElementById('bureauMer').hidden, '« Pas aujourd’hui » cache la carte');
const pas = w.localStorage.getItem('bdv_mer_pas_v1');
const d = new w.Date();
dit(pas === d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), 'pour la journee seulement', pas);
dit(w.document.getElementById('bdvrMer') !== null, 'le bandeau des reglages reste');
dit(/Le classement/.test(w.document.getElementById('bdvrMer').textContent), 'le bandeau nomme l’onglet en mots');
dit(w.document.querySelector('.bdvr-onglet .mer__af') !== null, 'l’onglet porte sa marque');
w.localStorage.setItem('bdv_mer_pas_v1', '2000-01-01');
await w.BdvMiseEnRoute.relire();
dit(!w.document.getElementById('bureauMer').hidden, 'un autre jour, la carte revient');

console.log('== 7. Un geste mene a l’onglet existant, jamais a un champ d’ici ==');
w.document.querySelector('#bureauMer [data-mer="aller"]').click();
dit(w.__ouvert === 'bdvrBlocClassement', '« Le faire » ouvre l’onglet Le classement', w.__ouvert);
dit(!/<input|<select|<textarea|createElement\('input/.test(SRC), 'le module ne fabrique aucun champ');

console.log('== 8. L’envoi sans boite : une ligne, et le geste qui l’ouvre sur place ==');
{
  const AFF = fs.readFileSync(path.join(RACINE, 'src/js/bdv-affaires.js'), 'utf8');
  const ECR = fs.readFileSync(path.join(RACINE, 'src/js/bdv-ecrans.js'), 'utf8');
  const fa = /function inviterBoite\(oui\) \{[\s\S]*?\n  \}/.exec(AFF);
  const fe = /function inviterBoiteFiche\(\)\{[^\n]*\}/.exec(ECR);
  dit(!!fa && !!fe, 'les deux redacteurs portent la ligne (affaire et fiche client)');
  const essai = (etat, oui, f, nom) => {
    const d = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
    d.window.BdvBoite = { _etat: () => etat };
    d.window.eval(f + ';window.__r=' + nom + '(' + (oui === undefined ? '' : oui) + ');');
    return d.window.__r;
  };
  dit(essai({ LU: false }, true, fa[0], 'inviterBoite') === '', 'boite pas encore lue : on se tait');
  dit(essai({ LU: true, ABSENTE: true }, true, fa[0], 'inviterBoite') === '', 'SQL de la boite absent : on se tait');
  dit(essai({ LU: true }, false, fa[0], 'inviterBoite') === '', 'boite branchee (ou pas d’adresse) : rien');
  const l = essai({ LU: true, BOITE: null }, true, fa[0], 'inviterBoite');
  dit(/branche ta boîte/.test(l) && /data-mer="aller"/.test(l) && /data-onglet="envois"/.test(l), 'sinon : « branche ta boite », qui ouvre Mes envois', l);
  dit(/la reconnecter/.test(essai({ LU: true, BOITE: { etat: 'reconnecter' } }, true, fa[0], 'inviterBoite')), 'boite a reconnecter : la phrase le dit');
  dit(/branche ta boîte/.test(essai({ LU: true, BOITE: null }, undefined, fe[0], 'inviterBoiteFiche')), 'la fiche client dit la meme chose');
  dit(/inviterBoite\(mail && !boite\)/.test(AFF) && /mail&&!boite\?inviterBoiteFiche\(\)/.test(ECR), 'elle ne paraît que s’il y a une adresse et pas de boite');
  dit(/Ouvrir dans ma messagerie/.test(AFF), 'la messagerie reste : on ne bloque pas ce qui marche');
  const BASE = fs.readFileSync(path.join(RACINE, 'src/js/bdv-base.js'), 'utf8');
  dit(/e\.key==='Escape'&&!\(el\('bdvrVoile'\)&&!el\('bdvrVoile'\)\.hidden\)/.test(BASE), 'Echap dans Mes reglages ne ferme pas la fiche dessous (son brouillon partirait)');
  dit(/rv=el\('bdvrVoile'\);if\(rv&&!rv\.hidden\)return;/.test(ECR) && /var rv = document\.getElementById\('bdvrVoile'\); if \(rv && !rv\.hidden\) return;/.test(AFF),
    'le clavier appartient aux reglages ouverts par-dessus la fiche ou l’affaire');
}

console.log('\n== VERDICT ==\n  ' + ok + ' ok, ' + ko + ' echec(s)');
process.exit(ko ? 1 : 0);
