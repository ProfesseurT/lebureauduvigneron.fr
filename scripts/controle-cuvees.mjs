/* ============================================================================
   scripts/controle-cuvees.mjs : fabrique la requete de comparaison des cuvees

     npm run controle:cuvees > /tmp/cuvees.sql

   Meme principe que `controle-commerce.mjs` : il lit le temoin du vrai moteur
   et rend UNE requete a coller dans Supabase, qui compare CUVEE PAR CUVEE et
   CHAMP PAR CHAMP. Zero ligne rendue = les deux cotes disent la meme chose.

   IL A SERVI DES LA PREMIERE EXECUTION : le navigateur rendait 0 % de
   dependance pour la cuvee « (sans nom) », le serveur 100 %, et c'est le
   serveur qui avait raison. `agentProduits()` rangeait cette ligne sous
   « (sans nom) » puis la cherchait sous la chaine vide onze lignes plus bas.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(fs.readFileSync(path.join(RACINE, 'scripts/fixtures/commerce-temoin.json'), 'utf8'));
const BUREAU = '00000000-0000-4000-8000-0000000e5541';

if (!T.produits || !T.produits.ok) {
  console.error('Le temoin ne porte pas de cuvees : lance d\'abord npm run temoin:commerce');
  process.exit(2);
}
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const lignes = T.produits.liste.map(c => '(' + [q(c.nom), c.ca, c.btl, c.clients, c.part,
  c.cur, c.prev, c.delta, c.top1, q(c.nomTop), c.rachat, c.prixMed, c.prixBas, c.prixHaut,
  c.nPrix, q(c.condDom), c.millesimes.length].join(',') + ')').join(',\n  ');

/* Les euros au centime, les rapports a la sixieme decimale : au-dela on comparerait du
   bruit de virgule flottante, et un banc qui echoue au hasard finit ignore. */
const NOMBRES = [['ca',2],['btl',3],['part',6],['cur',2],['prev',2],['delta',2],
                 ['top1',6],['rachat',6],['prixmed',6],['prixbas',6],['prixhaut',6]];
const ENTIERS = ['clients','nprix','nmil'];
const TEXTES  = ['nomtop','conddom'];
const cmp = ([f,d]) => `round(n.${f}::numeric,${d}) is distinct from round(s.${f},${d})`;
const tous = [...NOMBRES.map(cmp),
              ...ENTIERS.map(f => `n.${f} is distinct from s.${f}`),
              ...TEXTES.map(f => `n.${f} is distinct from s.${f}`)];

console.log(`/* Comparaison navigateur / serveur des cuvees, sur le bureau d'essai.
   Engendree par scripts/controle-cuvees.mjs, temoin du ${new Date().toISOString().slice(0,10)}.
   ZERO LIGNE = les deux cotes sont d'accord. */
with nav(nom,ca,btl,clients,part,cur,prev,delta,top1,nomtop,rachat,prixmed,prixbas,prixhaut,nprix,conddom,nmil) as (values
  ${lignes}
),
srv as (
  select e->>'nom' as nom, (e->>'ca')::numeric as ca, (e->>'btl')::numeric as btl,
         (e->>'clients')::int as clients, (e->>'part')::numeric as part,
         (e->>'cur')::numeric as cur, (e->>'prev')::numeric as prev,
         (e->>'delta')::numeric as delta, (e->>'top1')::numeric as top1,
         e->>'nomTop' as nomtop, (e->>'rachat')::numeric as rachat,
         (e->>'prixMed')::numeric as prixmed, (e->>'prixBas')::numeric as prixbas,
         (e->>'prixHaut')::numeric as prixhaut, (e->>'nPrix')::int as nprix,
         e->>'condDom' as conddom, jsonb_array_length(e->'millesimes') as nmil
    from jsonb_array_elements(public.cuvees_resume('${BUREAU}')->'liste') e
)
select coalesce(n.nom, s.nom) as cuvee,
       case when s.nom is null then 'absente du serveur'
            when n.nom is null then 'en trop cote serveur'
            else concat_ws(', ',
${[...NOMBRES.map(([f,d]) => `              case when ${cmp([f,d])} then '${f} '||coalesce(n.${f}::text,'-')||' vs '||coalesce(s.${f}::text,'-') end`),
   ...ENTIERS.map(f => `              case when n.${f} is distinct from s.${f} then '${f} '||coalesce(n.${f}::text,'-')||' vs '||coalesce(s.${f}::text,'-') end`),
   ...TEXTES.map(f => `              case when n.${f} is distinct from s.${f} then '${f} '||coalesce(n.${f},'-')||' vs '||coalesce(s.${f},'-') end`)].join(',\n')})
       end as ecart
  from nav n full join srv s on s.nom = n.nom
 where s.nom is null or n.nom is null or ${tous.join('\n    or ')}
 order by 1;`);
