-- ============================================================================
-- LOT 9  LA VUE DU COURRIER DU MATIN
-- ============================================================================
-- A COLLER DANS L'EDITEUR SQL DE SUPABASE, projet qukmncqqwomhmrdhvetj.
-- Pas par le MCP : depuis que `profils` contient des adresses de vignerons, la
-- decision du 01/09/2026 est que tout DDL repasse a la main. Ce fichier est
-- rejouable (create or replace, drop if exists), comme schema.sql.
--
-- POURQUOI UNE VUE, et l'argument n'est pas celui qu'on croit.
-- Sans elle, la fonction d'envoi fait TROIS lectures par compte : les reglages,
-- le suivi, les taches. A 500 vignerons, 1 500 allers-retours a 8 h du matin.
-- Avec elle, UNE requete pour tout l'envoi. C'est la raison principale.
-- La raison secondaire, mais reelle : la regle « un client deja suivi sort de la
-- file » cesse d'etre ecrite deux fois. Elle vit ici, et `ecarterLesSuivis()`
-- dans src/js/bdv-courrier.js SERA SUPPRIMEE au lot 3, quand la fonction
-- d'envoi lira cette vue. Deux endroits qui repondent « ce client est-il encore
-- a voir » se contrediraient au premier geste.
--
-- CE QUE LA VUE NE FAIT PAS, ET C'EST VOLONTAIRE.
-- Elle ne decide pas du contenu du mail. Elle ecarte deux choses qui sont des
-- FAITS (une tache faite, un signal sur un client deja suivi) et laisse passer
-- tout le reste, y compris les taches SANS DATE. La regle « une tache sans date
-- n'entre jamais dans le courrier » est une regle de PRESENTATION : elle vit
-- dans normTache() et elle est gardee par les controles 7, 8 et 9 de
-- `npm run courrier`. L'ecrire ici aussi ferait deux versions d'une meme regle,
-- et c'est exactement ce que ce fichier existe pour eviter.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. LA VUE
-- ---------------------------------------------------------------------------
drop view if exists public.v_courrier;

create view public.v_courrier
with (security_invoker = true)
as
with signaux_gardes as (
  -- Les signaux deposes par le tableau de bord, MOINS ceux dont le client a
  -- depuis recu un rappel ou a ete traite. Le depot est fige au dernier import ;
  -- le suivi, lui, est vivant. C'est tout l'objet de cette anti-jointure.
  -- `with ordinality` garde l'ordre du depot : le tableau de bord a classe ces
  -- signaux par importance, et re-trier ici jetterait ce travail.
  select r.id, jsonb_agg(s.valeur order by s.n) as signaux
    from public.reglages r
    cross join lateral jsonb_array_elements(
           coalesce(r.file_travail -> 'signaux', '[]'::jsonb)
         ) with ordinality as s(valeur, n)
   where not exists (
           select 1
             from public.suivi_clients sc
            where sc.id = r.id
              and sc.client_id = s.valeur ->> 'id'
              and (sc.rappel is not null or sc.statut = 'traite')
         )
   group by r.id
),
suivis_actifs as (
  -- Un rappel pose et pas encore traite. Sans rappel, une fiche de suivi n'a
  -- rien a dire un matin donne : elle sort le client de la file, c'est tout,
  -- et c'est deja fait par l'anti-jointure ci-dessus.
  select sc.id,
         jsonb_agg(jsonb_build_object(
           'client_id', sc.client_id,
           'statut',    sc.statut,
           'rappel',    sc.rappel,
           'canal',     sc.canal,
           'notes',     sc.notes
         ) order by sc.rappel) as suivis
    from public.suivi_clients sc
   where sc.rappel is not null
     and coalesce(sc.statut, '') <> 'traite'
   group by sc.id
),
taches_ouvertes as (
  -- Les taches PAS FAITES, datees ou non. `fait_le is null` est un fait, pas
  -- une regle de presentation : une tache faite n'a plus rien a dire a
  -- personne. Les taches sans date passent, et normTache() les ecarte.
  select t.id,
         jsonb_agg(jsonb_build_object(
           'tache_id', t.tache_id,
           'titre',    t.titre,
           'source',   t.source,
           'ref',      t.ref,
           'echue_le', t.echue_le,
           'fin_le',   t.fin_le,
           'fait_le',  t.fait_le
         ) order by t.echue_le nulls last) as taches
    from public.taches t
   where t.fait_le is null
   group by t.id
)
select r.id,
       p.email,
       r.depose_le,
       -- L'annuaire des noms, indispensable : un client sur qui un rappel est
       -- pose est SORTI des signaux par construction, et le mail n'aurait plus
       -- que son numero Vitisoft a afficher le jour ou ce rappel tombe.
       coalesce(r.file_travail -> 'noms', '{}'::jsonb) as noms,
       coalesce(sg.signaux, '[]'::jsonb)               as signaux,
       coalesce(sa.suivis,  '[]'::jsonb)               as suivis,
       coalesce(tc.taches,  '[]'::jsonb)               as taches,
       r.resume_ventes
  from public.reglages r
  left join public.profils p     on p.id  = r.id
  left join signaux_gardes sg    on sg.id = r.id
  left join suivis_actifs sa     on sa.id = r.id
  left join taches_ouvertes tc   on tc.id = r.id;

-- ---------------------------------------------------------------------------
-- 2. LES DROITS
-- ---------------------------------------------------------------------------
-- `security_invoker = true` CI-DESSUS EST LA LIGNE LA PLUS IMPORTANTE DU
-- FICHIER. Sans elle, une vue Postgres s'execute avec les droits de son
-- PROPRIETAIRE : la securite par ligne des tables sous-jacentes ne s'applique
-- plus, et n'importe quel vigneron connecte lirait la file de travail, les
-- rappels et l'adresse e-mail de TOUS les autres. Ne jamais la retirer.
--
-- Avec elle : un vigneron ne voit que sa propre ligne, exactement comme sur les
-- tables. La fonction d'envoi du lot 3, elle, utilisera la cle `service_role`,
-- qui court-circuite la securite par ligne de toute facon : c'est la seule
-- raison pour laquelle elle pourra lire les 500 lignes d'un coup.
-- LE `revoke` PORTE SUR `authenticated` AUSSI, ET C'EST LA CORRECTION DU 09/09/2026.
-- Premier passage : j'avais ecrit `revoke ... from anon` puis `grant select to
-- authenticated`, en croyant que le grant DEFINISSAIT les droits. Faux. Supabase pose des
-- droits PAR DEFAUT sur le schema public : toute table ou vue nouvellement creee arrive avec
-- INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES et TRIGGER deja accordes a `authenticated`.
-- Le `grant select` etait donc redondant, et les six autres droits sont restes en place.
--
-- Inoffensif aujourd'hui, verifie : `information_schema.views.is_updatable` vaut NO, cette
-- vue porte des agregats et des jointures, Postgres refuse toute ecriture dessus. Mais c'est
-- un piege pose pour plus tard : le jour ou quelqu'un simplifie cette vue et la rend
-- modifiable, les six droits se reveillent.
--
-- How to apply, pour toute vue ou table future de ce projet : `revoke all` D'ABORD, sur anon
-- ET sur authenticated, puis accorder ce dont on a besoin. Ne jamais partir du principe qu'un
-- objet neuf arrive sans droits.
revoke all on public.v_courrier from anon, authenticated;
grant select on public.v_courrier to authenticated;

comment on view public.v_courrier is
  'Tout ce dont le courrier du matin a besoin, une ligne par compte. Ecarte les '
  'signaux des clients deja suivis et les taches faites. Ne decide RIEN du '
  'contenu du mail : voir src/js/bdv-courrier.js. security_invoker = true est '
  'obligatoire, sans quoi la securite par ligne ne s''applique plus.';

-- ---------------------------------------------------------------------------
-- 3. LES CONTROLES, a passer juste apres avoir colle ce qui precede
-- ---------------------------------------------------------------------------
-- 3.1  La vue rend bien une ligne par compte, et les comptes sont complets.
--      Attendu au 09/09/2026 : 2 lignes, les deux avec une adresse, 40 signaux
--      chacune, et 6 taches pour l'un, 1 pour l'autre.
--
-- select id,
--        email is not null            as a_une_adresse,
--        depose_le,
--        jsonb_array_length(signaux)  as nb_signaux,
--        jsonb_array_length(suivis)   as nb_suivis,
--        jsonb_array_length(taches)   as nb_taches,
--        jsonb_typeof(noms)           as type_annuaire,
--        resume_ventes is not null    as a_un_resume
--   from public.v_courrier;

-- 3.2  L'ANTI-JOINTURE MARCHE-T-ELLE VRAIMENT ? Ce controle est le seul qui
--      compte, et il ne peut pas etre passe tant qu'aucun rappel n'est pose :
--      il filtrerait sur du vide et passerait, ce qui est le piege deja paye
--      trois fois le 07/09/2026. Poser un rappel dans une fiche client, puis :
--
-- select v.id,
--        jsonb_array_length(v.signaux) as apres_filtre,
--        jsonb_array_length(coalesce(r.file_travail -> 'signaux','[]'::jsonb)) as deposes
--   from public.v_courrier v join public.reglages r on r.id = v.id;
--
--      `apres_filtre` doit etre STRICTEMENT INFERIEUR a `deposes` si le client
--      sur lequel le rappel a ete pose figurait dans la file. Egaux, deux
--      lectures possibles : soit ce client n'y figurait pas, soit la jointure
--      ne prend pas. Verifier laquelle avant de conclure.

-- 3.3  LA SECURITE PAR LIGNE TIENT-ELLE ? A passer depuis le terminal de Ted,
--      avec la cle anon et sans session : doit rendre une erreur ou [].
--      Ni le conteneur Cowork ni le shell du poste n'ont d'acces reseau a
--      *.supabase.co, ce controle ne peut pas etre passe d'ici.
--
--      curl -s "https://qukmncqqwomhmrdhvetj.supabase.co/rest/v1/v_courrier?select=id" \
--           -H "apikey: <CLE_ANON>"
