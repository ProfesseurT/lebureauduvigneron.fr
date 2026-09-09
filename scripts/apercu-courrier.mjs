/* ============================================================================
   apercu-courrier.mjs  VOIR LE MAIL SANS L'ENVOYER
   ============================================================================
       npm run courrier              tous les cas
       npm run courrier -- normal    un seul cas

   Fabrique le mail pour chaque cas du jeu d'essai et ecrit le resultat dans
   `_apercu/`. Ouvre ensuite `_apercu/index.html` : les quatre versions y sont
   cote a cote, avec leur sujet, leurs compteurs et leur version texte.

   POURQUOI CE SCRIPT EXISTE. Le contenu du mail va changer vingt fois, la
   machinerie d'envoi une seule. Tant que le contenu se juge ici, il se juge
   sans domaine d'envoi, sans cle Resend, sans quota, et sans qu'un mail parte
   chez qui que ce soit. Le premier envoi reel est le lot 3.

   IL NE LIT PAS LA VRAIE BASE, ET IL NE PEUT PAS. Ni le shell du poste ni le
   conteneur n'ont d'acces reseau a *.supabase.co, et de toute facon un jeu
   d'essai avec de vrais clients dedans partirait sur GitHub. Voir l'en-tete
   de scripts/fixtures/courrier-exemple.json.
   ============================================================================ */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require  = createRequire(import.meta.url);
const ICI      = dirname(fileURLToPath(import.meta.url));
const RACINE   = join(ICI, '..');
const SORTIE   = join(RACINE, '_apercu');

const BdvCourrier = require(join(RACINE, 'src/js/bdv-courrier.js'));
const JEU = JSON.parse(readFileSync(join(ICI, 'fixtures/courrier-exemple.json'), 'utf8'));

/* Les cles qui commencent par un souligne sont des commentaires du jeu d'essai. */
const CAS = Object.keys(JEU).filter(k => !k.startsWith('_'));
const demande = process.argv.slice(2).filter(a => !a.startsWith('-'));
const aFaire = demande.length ? demande : CAS;

for(const nom of aFaire){
  if(!JEU[nom]){
    console.error(`Cas inconnu : ${nom}. Cas disponibles : ${CAS.join(', ')}`);
    process.exit(1);
  }
}

mkdirSync(SORTIE, { recursive:true });

/* ======================= LES CONTROLES =======================
   Un apercu qu'on regarde a l'oeil ne verifie que ce qu'on pense a regarder.
   Ces cinq controles portent sur ce qui ne se voit PAS sur une capture, et
   chacun a une raison d'exister ecrite a cote. Ils font echouer le script :
   un controle qui ne peut pas crier ne sert a rien, c'est la lecon du
   07/09/2026 deja ecrite dans CLAUDE.md. */
const ennuis = [];
function verifier(cas, r, donnees){
  /* 1. La regle de contenu du projet : aucun tiret cadratin, nulle part.
        Invisible a la lecture, et c'est la faute la plus facile a commettre
        en ecrivant du texte pour un mail. */
  if(r.html.includes('—') || r.texte.includes('—')){
    ennuis.push(`${cas} : un tiret cadratin dans le mail. Le projet les interdit partout.`);
  }
  /* 2. Aucun var() dans un mail. Outlook ne connait pas les variables CSS :
        la couleur tomberait au noir par defaut, et ca ne se verrait pas ici,
        ou le navigateur, lui, les comprend. */
  if(r.html.includes('var(--')){
    ennuis.push(`${cas} : un var(--...) dans le mail. Une messagerie ne le comprend pas.`);
  }
  /* 3. Aucune balise script ne doit survivre a htmlLimite(). Le jeu d'essai
        en injecte une expres dans le cas « limites ». */
  if(/<script/i.test(r.html)){
    ennuis.push(`${cas} : une balise script est passee dans le mail.`);
  }
  /* 4. Un client qui a recu un rappel depuis le depot doit SORTIR de la file.
        C'est la faute la plus couteuse de tout ce chantier : nommer un client
        deja traite. Le cas « limites » pose ce piege sur C-0042. */
  const suivisAvecRappel = (donnees.suivis||[])
    .filter(s => s.rappel || s.statut === 'traite').map(s => s.client_id);
  for(const id of suivisAvecRappel){
    const signal = (donnees.file_travail?.signaux||[]).find(s => s.id === id);
    if(signal && r.html.includes(signal.nom) && r.compteurs.signaux > 0){
      /* Le nom peut apparaitre legitimement dans le bloc des rappels. On ne
         teste donc pas la presence du nom mais celle de son detail, qui
         n'existe que dans la ligne de signal. */
      if(signal.detail && r.html.includes(signal.detail.slice(0,30))){
        ennuis.push(`${cas} : ${signal.nom} a un rappel et reste dans la file. C'est le defaut a ne jamais laisser passer.`);
      }
    }
  }
  /* 6. Un libelle de montant ne sort jamais sans son montant. Trouve a la capture
        du 09/09/2026 : « panier habituel » s'affichait seul sur un client a zero. */
  for(const s of (donnees.file_travail?.signaux||[])){
    if(s && !s.montant && s.lib && r.html.includes(s.lib)){
      ennuis.push(`${cas} : le libelle « ${s.lib} » s'affiche sans montant. Une case vide vaut mieux.`);
    }
  }
  /* 7. UNE TACHE SANS DATE N'ENTRE JAMAIS DANS LE COURRIER. Le mail dit ce qui
        tombe aujourd'hui ; une tache non datee tomberait chaque matin, et c'est
        le defaut qui fait decrocher un lecteur en dix jours. */
  for(const t of (donnees.taches||[])){
    if(t && !t.echue_le && t.titre && r.html.includes(t.titre)){
      ennuis.push(`${cas} : la tache « ${t.titre} » n'a pas de date et se retrouve dans le mail.`);
    }
  }
  /* 8. Une tache DEJA FAITE n'a plus rien a dire. */
  for(const t of (donnees.taches||[])){
    if(t && t.fait_le && t.titre && r.html.includes(t.titre)){
      ennuis.push(`${cas} : la tache « ${t.titre} » est faite et reste affichee.`);
    }
  }
  /* 9. EN COURS N'EST PAS EN RETARD. Une tache datee d'hier qui court jusqu'a
        demain n'est pas en retard : l'annoncer en rouge est la meme faute que
        nommer un client deja traite, et le mail perd sa credibilite d'un coup. */
  const auj = BdvCourrier._outils.jour(donnees.aujourdhui);
  for(const t of (donnees.taches||[])){
    if(!t || t.fait_le || !t.echue_le || !t.fin_le) continue;
    const d = BdvCourrier._outils.jour(t.echue_le), f = BdvCourrier._outils.jour(t.fin_le);
    if(!d || !f || !auj) continue;
    if(d.n <= auj.n && f.n >= auj.n){
      const o = BdvCourrier._outils.normTache(t, auj);
      if(!o || !o.encours){
        ennuis.push(`${cas} : la tache « ${t.titre} » court encore et n'est pas marquee « en cours ».`);
      }
      /* Le mot « depuis » a cote de son titre voudrait dire « en retard ». */
      const i = r.texte.indexOf(t.titre);
      if(i >= 0 && /^[^\n]*depuis/.test(r.texte.slice(i))){
        ennuis.push(`${cas} : la tache « ${t.titre} » court encore et le mail la dit en retard.`);
      }
    }
  }
  /* 5. Un depot perime ne doit afficher aucun signal. */
  if(r.compteurs.perime && r.compteurs.signaux > 0){
    ennuis.push(`${cas} : depot perime (${r.compteurs.ageDepot} jours) et ${r.compteurs.signaux} signaux affiches.`);
  }
}

/* ======================= FABRICATION ======================= */
const faits = [];
for(const nom of aFaire){
  const d = JEU[nom];
  const r = BdvCourrier.batir(d);
  verifier(nom, r, d);
  writeFileSync(join(SORTIE, `${nom}.html`), r.html, 'utf8');
  writeFileSync(join(SORTIE, `${nom}.txt`), r.texte, 'utf8');
  faits.push({ nom, but:d._but || '', r });
}

/* ======================= LA PAGE D'INDEX =======================
   Chaque mail est dans un cadre isole, et c'est indispensable : les styles du
   mail sont poses sur sa propre balise body. Colles dans cette page, ils
   repeindraient la page elle-meme et on ne verrait plus ce qu'on juge. */
function esc(s){
  return String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
const index = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Apercu du courrier du matin</title>
<style>
  body{margin:0;background:#DACDAF;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1E2536}
  header{background:#45101D;color:#EFE7D6;padding:18px 24px}
  header h1{margin:0;font:400 20px/1.2 Georgia,serif}
  header p{margin:6px 0 0;font-size:12px;color:rgba(239,231,214,0.75)}
  .cas{margin:24px auto;max-width:1180px;background:#EFE7D6;border:1px solid #C9C4B9}
  .cas__t{padding:14px 18px;border-bottom:1px solid #C9C4B9}
  .cas__t h2{margin:0;font:400 17px/1.2 Georgia,serif;color:#5A1525}
  .cas__t .but{margin:6px 0 0;font-size:12px;color:#63523D}
  .cas__t .sujet{margin:10px 0 0;padding:8px 10px;background:#F5EFE0;border:1px solid #C9C4B9;font-size:13px}
  .cas__t .cpt{margin:8px 0 0;font-size:12px;color:#63523D}
  .cols{display:flex;flex-wrap:wrap;gap:0}
  .col{flex:1 1 560px;min-width:0}
  .col + .col{border-left:1px solid #C9C4B9}
  .col h3{margin:0;padding:8px 14px;font:400 11px/1 inherit;letter-spacing:0.10em;text-transform:uppercase;color:#63523D;background:#F5EFE0;border-bottom:1px solid #C9C4B9}
  iframe{display:block;width:100%;height:760px;border:0;background:#DACDAF}
  pre{margin:0;padding:14px;font:12px/1.55 'JetBrains Mono','Courier New',monospace;white-space:pre-wrap;overflow-x:auto;max-height:760px}
</style></head><body>
<header>
  <h1>Apercu du courrier du matin</h1>
  <p>Lot 1. Rien n'est envoye. Relancer avec <code>npm run courrier</code> apres chaque modification de bdv-courrier.js.</p>
</header>
${faits.map(f => `
<section class="cas">
  <div class="cas__t">
    <h2>${esc(f.nom)}</h2>
    ${f.but ? `<p class="but">${esc(f.but)}</p>` : ''}
    <p class="sujet"><strong>Sujet :</strong> ${esc(f.r.sujet)}</p>
    <p class="cpt">${f.r.compteurs.echus} rappel(s) echu(s) &middot; ${f.r.compteurs.venir} a venir &middot;
       ${f.r.compteurs.signaux} signal(aux) &middot; ${f.r.compteurs.conseils} conseil(s) &middot;
       depot vieux de ${f.r.compteurs.ageDepot == null ? 'date inconnue' : f.r.compteurs.ageDepot + ' j'}${f.r.compteurs.perime ? ', PERIME' : ''} &middot;
       ${f.r.vide ? 'VIDE : l\'appelant ne devrait pas envoyer' : 'a envoyer'}</p>
  </div>
  <div class="cols">
    <div class="col"><h3>Ce que voit le vigneron</h3><iframe src="${esc(f.nom)}.html" title="Mail, cas ${esc(f.nom)}"></iframe></div>
    <div class="col"><h3>Version texte</h3><pre>${esc(f.r.texte)}</pre></div>
  </div>
</section>`).join('')}
</body></html>`;
writeFileSync(join(SORTIE, 'index.html'), index, 'utf8');

/* ======================= LE VERDICT ======================= */
console.log('');
for(const f of faits){
  const c = f.r.compteurs;
  console.log(`  ${f.nom.padEnd(10)} ${f.r.vide ? 'VIDE ' : 'plein'}  ` +
    `${String(c.echus).padStart(2)} echus, ${String(c.venir).padStart(2)} a venir, ` +
    `${String(c.signaux).padStart(2)} signaux, ${String(c.conseils).padStart(2)} conseils` +
    (c.perime ? '   [depot perime]' : ''));
  console.log(`  ${''.padEnd(10)} sujet : ${f.r.sujet}`);
}
console.log('');
if(ennuis.length){
  console.error('LE COURRIER A UN DEFAUT :');
  for(const e of ennuis) console.error('  - '+e);
  process.exit(1);
}
console.log(`LE COURRIER TIENT. ${faits.length} cas ecrits dans _apercu/`);
console.log('Ouvre _apercu/index.html dans ton navigateur.');
console.log('');
