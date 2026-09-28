-- ============================================================================
-- LOT 36, 28/09/2026 : LES AFFAIRES A RELANCER DANS LE COURRIER DU MATIN.
-- A COLLER APRES LE LOT 35. REJOUABLE.
-- ============================================================================
-- La vue `v_courrier` gagne UNE colonne, `affaires`, posee EN DERNIER : un
-- `create or replace view` n'accepte d'ajouter des colonnes qu'a la fin. Tout le
-- reste est recopie tel quel de la version en production (lue le 28/09/2026).
--
-- CE QUE LA COLONNE PORTE, ET RIEN D'AUTRE : les affaires EN COURS qui ont un
-- rappel, avec le nom a afficher (celui de la piste, sinon le nom du client,
-- sinon le titre), le type, l'etape, la date et le motif du rappel. Ni notes, ni
-- coordonnees : le mail dit quoi faire, le bureau dit comment joindre.
-- Le tri par date et le filtre « tombe ce matin ou dans la semaine » restent
-- dans la fabrique (`bdv-courrier.js`), comme pour les rappels et les taches.
--
-- LA LIGNE DU LOT 35 EST REPRISE EN TETE : la vue lit `client_nom`, elle ne se
-- cree pas sans. Si le lot 35 est deja passe, cette ligne ne fait rien.
--
-- L'ORDRE COMPTE : ce SQL AVANT le deploiement de `courrier-matin`. Dans l'autre
-- sens la fonction relit sans les affaires et le dit dans son rapport
-- (`affaires_absentes`), mais le courrier part sans elles.
--
-- `security_invoker = true` N'EST PAS DECORATIF (voir schema.sql) : sans lui un
-- compte connecte lirait les adresses et les notes de tous les comptes.
-- ============================================================================
alter table public.affaires
  add column if not exists client_nom text
  check (client_nom is null or char_length(client_nom) <= 160);

create or replace view public.v_courrier with (security_invoker = true) as
with base as (
  select p.id as personne, p.email, p.jeton_emails, p.bureau_courant as bureau
    from public.profils p
   where p.consent_courrier and p.bureau_courant is not null
), signaux_gardes as (
  select b.personne, jsonb_agg(s.valeur order by s.n) as signaux
    from base b
    join public.reglages r on r.bureau = b.bureau
    cross join lateral jsonb_array_elements(
      coalesce(r.file_travail -> 'signaux', '[]'::jsonb)) with ordinality s(valeur, n)
   where not exists (
     select 1 from public.suivi_clients sc
      where sc.bureau = b.bureau
        and sc.client_id = (s.valeur ->> 'id')
        and (sc.rappel is not null or sc.statut = 'traite'))
   group by b.personne
), suivis_actifs as (
  select b.personne, jsonb_agg(to_jsonb(sc.*)) as suivis
    from base b join public.suivi_clients sc on sc.bureau = b.bureau
   where sc.rappel is not null and sc.statut is distinct from 'traite'
   group by b.personne
), taches_ouvertes as (
  select b.personne, jsonb_agg(to_jsonb(t.*)) as taches
    from base b join public.taches t on t.bureau = b.bureau
   where t.fait_le is null
   group by b.personne
), affaires_a_relancer as (
  select b.personne,
         jsonb_agg(jsonb_build_object(
           'affaire_id',   a.affaire_id,
           'nom',          coalesce(pi.nom, a.client_nom, a.titre),
           'titre',        a.titre,
           'type',         ty.nom,
           'etape',        et.nom,
           'rappel',       a.rappel,
           'rappel_titre', a.rappel_titre,
           'issue',        a.issue
         ) order by a.rappel) as affaires
    from base b
    join public.affaires a on a.bureau = b.bureau
    left join public.pistes         pi on pi.piste_id = a.piste_id and pi.bureau = a.bureau
    left join public.affaire_types  ty on ty.type_id  = a.type_id  and ty.bureau = a.bureau
    left join public.affaire_etapes et on et.etape_id = a.etape_id and et.bureau = a.bureau
   where a.issue = 'en_cours' and a.rappel is not null
   group by b.personne
)
select b.personne as id,
       b.email,
       b.jeton_emails,
       r.depose_le,
       coalesce(r.file_travail -> 'noms', '{}'::jsonb) as noms,
       coalesce(sg.signaux, '[]'::jsonb) as signaux,
       coalesce(sa.suivis,  '[]'::jsonb) as suivis,
       coalesce(tc.taches,  '[]'::jsonb) as taches,
       r.resume_ventes,
       coalesce(ar.affaires, '[]'::jsonb) as affaires
  from base b
  join public.reglages r on r.bureau = b.bureau
  left join signaux_gardes      sg on sg.personne = b.personne
  left join suivis_actifs       sa on sa.personne = b.personne
  left join taches_ouvertes     tc on tc.personne = b.personne
  left join affaires_a_relancer ar on ar.personne = b.personne;

revoke all on public.v_courrier from anon, authenticated;
grant select on public.v_courrier to authenticated;

-- CONTROLES, a lancer apres (ils ne modifient rien)
-- 1) La vue garde security_invoker :
--    select reloptions from pg_class where relname = 'v_courrier';
--    -> {security_invoker=true}
-- 2) La colonne est la, en dernier :
--    select column_name from information_schema.columns
--     where table_name = 'v_courrier' order by ordinal_position desc limit 1;
--    -> affaires
-- 3) anon n'a rien :
--    select privilege_type from information_schema.role_table_grants
--     where table_name = 'v_courrier' and grantee = 'anon';
--    -> 0 ligne
