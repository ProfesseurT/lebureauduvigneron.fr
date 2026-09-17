/* ============================================================================
   scripts/controle-commerce.mjs : fabrique la requete de comparaison

     npm run controle:commerce > /tmp/controle.sql

   Il n'ecrit rien en base et ne s'y connecte pas. Il lit le temoin du navigateur
   (`scripts/fixtures/commerce-temoin.json`) et rend UNE requete SQL a coller
   dans Supabase, qui compare ce temoin au retour de `commerce_resume()` sur le
   bureau d'essai, CLIENT PAR CLIENT et CHAMP PAR CHAMP.

   Zero ligne rendue = les deux cotes disent la meme chose.

   POURQUOI UN GENERATEUR ET PAS UN FICHIER SQL FIGE. Le temoin change des que le
   moteur change, et un fichier de comparaison ecrit a la main vieillirait sans
   prevenir : il continuerait de rendre zero ligne en comparant le serveur a un
   navigateur d'il y a trois semaines. Ici la comparaison est TOUJOURS celle du
   moteur tel qu'il est aujourd'hui.

   POURQUOI PAS UN BANC QUI SE CONNECTE TOUT SEUL. Il faudrait une cle de service
   dans le depot ou dans l'environnement. Un controle qui coute un secret ne vaut
   pas ce qu'il rapporte.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(fs.readFileSync(path.join(RACINE, 'scripts/fixtures/commerce-temoin.json'), 'utf8'));
const BUREAU = '00000000-0000-4000-8000-0000000e5541';

const nz = v => v == null ? 'null' : String(v);
const lignes = T.cadence.clients.map(c =>
  `('${c.id}',${c.n},${c.montant},${c.panier},${c.last},${c.silence},${nz(c.cadence)},`
  + `${c.cadRef},${nz(c.cv)},'${c.cls}',${c.enRetard},${c.ampleur},${nz(c.prochaine)},`
  + `'${c.conf}',${nz(c.moisHab)})`).join(',\n  ');

/* Les champs compares, et la tolerance de chacun. Les euros se comparent au
   centime, les rapports a la sixieme decimale : au-dela on comparerait du bruit
   de virgule flottante, et un banc qui echoue au hasard finit ignore. */
const CHAMPS = [
  ['n', 0], ['montant', 2], ['panier', 4], ['last', 0], ['silence', 0],
  ['cadence', 4], ['cadref', 4], ['cv', 6], ['ampleur', 6], ['prochaine', 4]
];
const TEXTES = ['cls', 'conf'];
const cmp = ([f, d]) => d === 0
  ? `n.${f}::numeric is distinct from s.${f}`
  : `round(n.${f}::numeric,${d}) is distinct from round(s.${f},${d})`;
const tous = [...CHAMPS.map(cmp), ...TEXTES.map(f => `n.${f} is distinct from s.${f}`),
              'n.enretard is distinct from s.enretard',
              'n.moishab is distinct from s.moishab'];

console.log(`/* Comparaison navigateur / serveur sur le bureau d'essai.
   Engendree par scripts/controle-commerce.mjs, a partir du temoin du
   ${new Date().toISOString().slice(0,10)}. ZERO LIGNE = les deux cotes sont d'accord. */
with nav(id,n,montant,panier,last,silence,cadence,cadref,cv,cls,enretard,ampleur,prochaine,conf,moishab) as (values
  ${lignes}
),
srv as (
  select e->>'id' as id, (e->>'n')::int as n, (e->>'montant')::numeric as montant,
         (e->>'panier')::numeric as panier, (e->>'last')::int as last,
         (e->>'silence')::int as silence, (e->>'cadence')::numeric as cadence,
         (e->>'cadRef')::numeric as cadref, (e->>'cv')::numeric as cv,
         e->>'cls' as cls, (e->>'enRetard')::boolean as enretard,
         (e->>'ampleur')::numeric as ampleur, (e->>'prochaine')::numeric as prochaine,
         e->>'conf' as conf, (e->>'moisHab')::int as moishab
    from jsonb_array_elements(public.commerce_resume('${BUREAU}')->'cadence') e
)
select coalesce(n.id, s.id) as client,
       case when s.id is null then 'absent du serveur'
            when n.id is null then 'en trop cote serveur'
            else concat_ws(', ',
${[...CHAMPS.map(([f,d]) => `              case when ${cmp([f,d])} then '${f} '||coalesce(n.${f}::text,'-')||' vs '||coalesce(s.${f}::text,'-') end`),
   ...TEXTES.map(f => `              case when n.${f} is distinct from s.${f} then '${f} '||coalesce(n.${f},'-')||' vs '||coalesce(s.${f},'-') end`),
   `              case when n.enretard is distinct from s.enretard then 'enRetard '||n.enretard||' vs '||s.enretard end`,
   `              case when n.moishab is distinct from s.moishab then 'moisHab '||n.moishab||' vs '||s.moishab end`].join(',\n')})
       end as ecart
  from nav n full join srv s on s.id = n.id
 where s.id is null or n.id is null or ${tous.join('\n    or ')}
 order by 1;`);
