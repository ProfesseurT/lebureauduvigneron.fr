-- ===========================================================================
-- LOT 17, 13/09/2026 : LES DONNEES CHANGENT DE PROPRIETAIRE.
-- ===========================================================================
-- A coller dans l'editeur SQL Supabase (projet qukmncqqwomhmrdhvetj).
-- Recopie dans supabase/schema.sql, qui est la REFERENCE.
--
-- C'EST LE SEUL LOT DU CHANTIER QUI TOUCHE DES DONNEES REELLES. Six tables
-- changent de cle primaire, la colonne `id` disparait, `bureau` la remplace.
--
-- IL NE VOYAGE PAS SEUL. Le navigateur envoie encore `id` : entre ce script et
-- la mise en ligne du code du lot 17 bis, le bureau REFUSE D'ECRIRE. Les echecs
-- sont bruyants (PostgREST refuse une colonne inconnue), jamais silencieux, et
-- aucune donnee ne se perd. Mais ne pas laisser la fenetre ouverte : on passe ce
-- script et on met le code en ligne dans la foulee.
--
-- REJOUABLE. Chaque table est enveloppee dans un bloc garde qui ne fait rien si
-- la bascule est deja faite. Un script arrete au milieu se relance.
--
-- LA REGLE QUI GOUVERNE LE CODE, et qu'il faut lire avant de relire les
-- politiques : la securite par ligne dit ce qu'on A LE DROIT de lire, le bureau
-- courant dit ce qu'on DOIT lire. Ce ne sont pas les memes. Le jour ou quelqu'un
-- sera membre de deux bureaux, une lecture sans filtre de bureau melangerait les
-- deux sans lever la moindre erreur : deux domaines dans la meme ardoise. Toutes
-- les requetes du navigateur portent donc `bureau=eq.<courant>`, lectures ET
-- suppressions comprises, et pas seulement les ecritures.

-- ---------------------------------------------------------------------------
-- 0. LA VUE DU COURRIER PART D'ABORD
-- ---------------------------------------------------------------------------
-- `v_courrier` lit `reglages`, `suivi_clients`, `taches` et `profils` par leur
-- colonne `id`. Postgres REFUSE de supprimer une colonne dont une vue depend :
-- sans cette ligne, le script echoue a la premiere table. Elle est reconstruite
-- a la section 6, a l'identique pour celui qui la lit.
drop view if exists public.v_courrier;

-- ---------------------------------------------------------------------------
-- 1. LES ANCIENNES POLITIQUES PARTENT AVANT LES COLONNES
-- ---------------------------------------------------------------------------
-- Elles portent toutes sur `id`. Une politique qui depend d'une colonne empeche
-- de la supprimer, exactement comme la vue.
drop policy if exists "lire ses reglages"              on public.reglages;
drop policy if exists "creer ses reglages"             on public.reglages;
drop policy if exists "modifier ses reglages"          on public.reglages;
drop policy if exists "supprimer ses reglages"         on public.reglages;
drop policy if exists "lire son suivi"                 on public.suivi_clients;
drop policy if exists "creer son suivi"                on public.suivi_clients;
drop policy if exists "modifier son suivi"             on public.suivi_clients;
drop policy if exists "supprimer son suivi"            on public.suivi_clients;
drop policy if exists "lire ses ventes"                on public.ventes;
drop policy if exists "creer ses ventes"               on public.ventes;
drop policy if exists "modifier ses ventes"            on public.ventes;
drop policy if exists "supprimer ses ventes"           on public.ventes;
drop policy if exists "lire ses echanges"              on public.echanges;
drop policy if exists "creer ses echanges"             on public.echanges;
drop policy if exists "modifier ses echanges"          on public.echanges;
drop policy if exists "supprimer ses echanges"         on public.echanges;
drop policy if exists "lire ses taches"                on public.taches;
drop policy if exists "creer ses taches"               on public.taches;
drop policy if exists "modifier ses taches"            on public.taches;
drop policy if exists "supprimer ses taches"           on public.taches;
drop policy if exists "lire ses choix de calendrier"      on public.calendrier_choix;
drop policy if exists "creer ses choix de calendrier"     on public.calendrier_choix;
drop policy if exists "modifier ses choix de calendrier"  on public.calendrier_choix;
drop policy if exists "supprimer ses choix de calendrier" on public.calendrier_choix;

-- ---------------------------------------------------------------------------
-- 2. LA BASCULE, TABLE PAR TABLE
-- ---------------------------------------------------------------------------
-- Une fonction plutot que six blocs recopies : six copies d'un meme geste
-- divergent a la premiere correction, et c'est une regle du depot.
--
-- CE QU'ELLE FAIT, dans cet ordre, et l'ordre compte :
--   1. pose `bureau` et `cree_par` a cote de `id` ;
--   2. remplit les deux depuis `membres`, qui fait le lien personne -> bureau ;
--   3. REFUSE D'ALLER PLUS LOIN si une seule ligne n'a pas trouve son bureau.
--      C'est le garde-fou central : sans lui, une ligne orpheline verrait son
--      `bureau` rester nul, la contrainte tomberait, et on aurait perdu a qui
--      elle appartenait. Mieux vaut un script qui s'arrete qu'une ligne muette ;
--   4. supprime `id`, ce qui emporte avec lui la cle etrangere vers auth.users
--      et les index qui la portaient, refaits a la section 3 ;
--   5. repose la cle primaire sur (bureau, <cle metier>).
--
-- `cree_par` est en `on delete set null` : une personne part, on perd son nom
-- sur la ligne, on ne perd pas la ligne. C'est toute la raison de ce lot.
create or replace function public.basculer_vers_bureau(nom_table text, cle_metier text)
returns text language plpgsql as $$
declare restantes bigint;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name=nom_table and column_name='id') then
    return nom_table || ' : deja bascule, rien a faire';
  end if;

  execute format('alter table public.%I add column if not exists bureau uuid', nom_table);
  execute format('alter table public.%I add column if not exists cree_par uuid', nom_table);

  execute format(
    'update public.%I t set bureau = m.bureau, cree_par = coalesce(t.cree_par, t.id)
       from public.membres m where m.personne = t.id and t.bureau is null', nom_table);

  execute format('select count(*) from public.%I where bureau is null', nom_table) into restantes;
  if restantes > 0 then
    raise exception '% : % ligne(s) n''ont pas trouve leur bureau, rien n''a ete bascule',
      nom_table, restantes;
  end if;

  execute format('alter table public.%I drop constraint if exists %I', nom_table, nom_table || '_pkey');
  execute format('alter table public.%I drop column id', nom_table);
  execute format('alter table public.%I alter column bureau set not null', nom_table);
  execute format('alter table public.%I alter column cree_par set default auth.uid()', nom_table);
  execute format('alter table public.%I add constraint %I primary key (bureau%s)',
                 nom_table, nom_table || '_pkey',
                 case when cle_metier = '' then '' else ', ' || cle_metier end);
  execute format('alter table public.%I add constraint %I foreign key (bureau)
                    references public.bureaux on delete cascade',
                 nom_table, nom_table || '_bureau_fk');
  execute format('alter table public.%I add constraint %I foreign key (cree_par)
                    references auth.users on delete set null',
                 nom_table, nom_table || '_cree_par_fk');

  return nom_table || ' : bascule';
end $$;

select public.basculer_vers_bureau('reglages',         '');
select public.basculer_vers_bureau('ventes',           'empreinte');
select public.basculer_vers_bureau('suivi_clients',    'client_id');
select public.basculer_vers_bureau('echanges',         'echange_id');
select public.basculer_vers_bureau('taches',           'tache_id');
select public.basculer_vers_bureau('calendrier_choix', 'cle');

-- La fonction a fait son travail et n'a plus rien a faire dans la base : une
-- fonction qui sait renommer des cles primaires n'a pas a rester joignable.
drop function if exists public.basculer_vers_bureau(text, text);

-- ---------------------------------------------------------------------------
-- 3. LES INDEX, REFAITS SUR LE BUREAU
-- ---------------------------------------------------------------------------
-- Ils portaient tous `id` en tete et sont partis avec la colonne. Les refaire
-- n'est pas un confort : `echanges_client` est la seule lecture de la fiche
-- client, et `taches_a_faire` celle du panneau.
create index if not exists ventes_maj_le   on public.ventes   (bureau, maj_le);
create index if not exists echanges_client on public.echanges (bureau, client_id, le desc);
create index if not exists taches_a_faire  on public.taches   (bureau, echue_le) where fait_le is null;

-- Et un index qui n'existait pas : `cree_par` est desormais lu par TOUTES les
-- politiques d'ecriture des quatre tables de la famille A ci-dessous.
create index if not exists suivi_clients_cree_par    on public.suivi_clients    (cree_par);
create index if not exists echanges_cree_par         on public.echanges         (cree_par);
create index if not exists taches_cree_par           on public.taches           (cree_par);
create index if not exists calendrier_choix_cree_par on public.calendrier_choix (cree_par);

-- ---------------------------------------------------------------------------
-- 4. LES POLITIQUES, DEUX FAMILLES ET PAS UNE DE PLUS
-- ---------------------------------------------------------------------------
-- FAMILLE A, « chacun n'ecrit que ses propres lignes ». Arbitrage de Ted du
-- 13/09/2026, pris en connaissance de sa consequence : la premiere personne qui
-- touche une fiche client la verrouille pour les autres. Un collegue qui essaie
-- recoit une ERREUR FRANCHE, pas un refus poli : PostgreSQL rejette un
-- `on conflict do update` sur une ligne que la politique ne laisse pas modifier.
-- C'est bruyant, et c'est mieux qu'un enregistrement qui n'enregistre rien.
--
-- Ce choix vit ICI et nulle part ailleurs. L'ouvrir au bureau entier le jour ou
-- il genera coute deux lignes, `drop policy` et `create policy`, sans migration
-- et sans toucher au navigateur. Ne pas le prendre pour une contrainte de forme.
--
-- `cree_par` n'est PAS verifie a l'insertion par un `cree_par = auth.uid()` :
-- c'est le DEFAUT `auth.uid()` pose a la section 2 qui le remplit, et un compte
-- qui tenterait d'ecrire le nom d'un autre se heurterait au meme defaut. La
-- verification est sur la MODIFICATION, la ou elle protege vraiment.

-- suivi_clients
create policy "lire le suivi du bureau" on public.suivi_clients
  for select using (public.est_membre(bureau));
create policy "creer un suivi" on public.suivi_clients
  for insert with check (public.est_membre(bureau));
create policy "modifier son suivi" on public.suivi_clients
  for update using (public.est_membre(bureau) and cree_par = auth.uid())
          with check (public.est_membre(bureau) and cree_par = auth.uid());
create policy "supprimer son suivi" on public.suivi_clients
  for delete using (public.est_membre(bureau) and cree_par = auth.uid());

-- echanges. C'est ICI que la regle est la plus juste : un journal date ne se
-- reecrit pas, et surtout pas celui d'un collegue.
create policy "lire les echanges du bureau" on public.echanges
  for select using (public.est_membre(bureau));
create policy "creer un echange" on public.echanges
  for insert with check (public.est_membre(bureau));
create policy "modifier son echange" on public.echanges
  for update using (public.est_membre(bureau) and cree_par = auth.uid())
          with check (public.est_membre(bureau) and cree_par = auth.uid());
create policy "supprimer son echange" on public.echanges
  for delete using (public.est_membre(bureau) and cree_par = auth.uid());

-- taches
create policy "lire les taches du bureau" on public.taches
  for select using (public.est_membre(bureau));
create policy "creer une tache" on public.taches
  for insert with check (public.est_membre(bureau));
create policy "modifier sa tache" on public.taches
  for update using (public.est_membre(bureau) and cree_par = auth.uid())
          with check (public.est_membre(bureau) and cree_par = auth.uid());
create policy "supprimer sa tache" on public.taches
  for delete using (public.est_membre(bureau) and cree_par = auth.uid());

-- calendrier_choix
create policy "lire les choix de calendrier du bureau" on public.calendrier_choix
  for select using (public.est_membre(bureau));
create policy "creer un choix de calendrier" on public.calendrier_choix
  for insert with check (public.est_membre(bureau));
create policy "modifier son choix de calendrier" on public.calendrier_choix
  for update using (public.est_membre(bureau) and cree_par = auth.uid())
          with check (public.est_membre(bureau) and cree_par = auth.uid());
create policy "supprimer son choix de calendrier" on public.calendrier_choix
  for delete using (public.est_membre(bureau) and cree_par = auth.uid());

-- FAMILLE B, « le maitre seul ecrit ». Tout le bureau LIT.
--
-- `ventes` : un import de travers ne se trompe pas d'une ligne, il double le
-- chiffre d'affaires du domaine entier (mesure de CLAUDE.md : 4 939 lignes et
-- 532 201 euros deviennent 9 878 et 1 064 403). Ce geste appartient au maitre.
--
-- `reglages` : l'objectif, l'exercice et le classement sont AU BUREAU, arbitrage
-- de Ted du 13/09/2026. La meme ligne porte aussi la file de travail deposee par
-- le tableau de bord a chaque import, donc par le maitre.
--
-- PAS de `cree_par = auth.uid()` ici, et c'est deliberé : deux maitres doivent
-- pouvoir reimporter l'un par-dessus l'autre. Le mettre casserait le
-- `resolution=merge-duplicates` de tout second importateur.
create policy "lire les ventes du bureau" on public.ventes
  for select using (public.est_membre(bureau));
create policy "importer des ventes" on public.ventes
  for insert with check (public.est_maitre(bureau));
create policy "corriger des ventes" on public.ventes
  for update using (public.est_maitre(bureau)) with check (public.est_maitre(bureau));
create policy "effacer des ventes" on public.ventes
  for delete using (public.est_maitre(bureau));

create policy "lire les reglages du bureau" on public.reglages
  for select using (public.est_membre(bureau));
create policy "creer les reglages" on public.reglages
  for insert with check (public.est_maitre(bureau));
create policy "modifier les reglages" on public.reglages
  for update using (public.est_maitre(bureau)) with check (public.est_maitre(bureau));
create policy "supprimer les reglages" on public.reglages
  for delete using (public.est_maitre(bureau));

-- Les droits de table n'ont pas change, mais on les repose : `revoke all`
-- d'abord, sur anon ET authenticated, puis le strict necessaire.
revoke all on public.reglages, public.ventes, public.suivi_clients,
              public.echanges, public.taches, public.calendrier_choix
  from anon, authenticated;
grant select, insert, update, delete
  on public.reglages, public.ventes, public.suivi_clients,
     public.echanges, public.taches, public.calendrier_choix
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. « VIDER LA BASE » DEVIENT UN GESTE DE MAITRE, ET IL CHANGE DE NOM
-- ---------------------------------------------------------------------------
-- `effacer_mes_donnees()` disait « mes donnees » a quelqu'un qui s'appretait a
-- effacer celles de tout un domaine. Le nom devient vrai, et la fonction verifie
-- qui appelle AVANT d'effacer quoi que ce soit.
--
-- La ligne de `reglages` SURVIT, comme depuis le 08/09/2026 : on ne vide que ce
-- qui est le reflet des ventes qu'on vient d'effacer, jamais ce que le vigneron
-- a choisi. Les signets, les taches et les choix de calendrier ne sont pas
-- touches non plus : cette fonction vide LA BASE DE VENTES, pas le bureau.
create or replace function public.vider_la_base_du_bureau(b uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if b is null or not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut vider sa base';
  end if;
  delete from public.echanges      where bureau = b;
  delete from public.ventes        where bureau = b;
  delete from public.suivi_clients where bureau = b;
  update public.reglages
     set file_travail = null, resume_ventes = null, depose_le = null, maj_le = now()
   where bureau = b;
end $$;

revoke all on function public.vider_la_base_du_bureau(uuid) from public, anon;
grant execute on function public.vider_la_base_du_bureau(uuid) to authenticated;

-- L'ancienne est SUPPRIMEE, pas laissee a cote. Elle interroge des colonnes qui
-- n'existent plus : la garder, c'est laisser un bouton qui tombe en erreur le
-- jour ou quelqu'un le presse. L'ancien code deploye recevra un 404 franc.
drop function if exists public.effacer_mes_donnees();

-- ---------------------------------------------------------------------------
-- 6. LA VUE DU COURRIER, RECONSTRUITE
-- ---------------------------------------------------------------------------
-- IDENTIQUE POUR CELUI QUI LA LIT : memes neuf colonnes, memes noms, meme ordre.
-- La fonction `courrier-matin` demande `id,email,jeton_emails,depose_le,noms,
-- signaux,suivis,taches,resume_ventes` et n'a pas une ligne a changer.
--
-- Ce qui change est la PLOMBERIE : la vue partait de `reglages` et joignait sur
-- `id`. Elle part maintenant de la PERSONNE, passe par son `bureau_courant`, et
-- lit les donnees de ce bureau. La colonne rendue s'appelle toujours `id` et
-- vaut toujours la personne : c'est elle que `courrier_envois` enregistre, et
-- c'est a elle qu'on ecrit.
--
-- CE QUI RESTE A FAIRE, ET QUI N'EST PAS ICI : l'arbitrage de Ted veut que
-- chacun choisisse dans ses preferences, donc que le consentement devienne un
-- couple (personne, bureau). Tant que chacun n'a qu'un bureau, ce que fait cette
-- vue et ce que veut l'arbitrage se confondent. Le jour du lot des invitations,
-- `consent_courrier` sort de `profils`.
--
-- `security_invoker = true` N'EST PAS DECORATIF. Sans lui, une vue s'execute
-- avec les droits de son proprietaire, qui traverse la securite par ligne : tout
-- compte connecte lirait alors les adresses, les jetons de desinscription et les
-- notes clients de TOUS les comptes. C'est le reglage que portait deja la vue
-- d'origine, verifie le 13/09/2026. Ne jamais le laisser tomber.
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
)
select b.personne as id,
       b.email,
       b.jeton_emails,
       r.depose_le,
       coalesce(r.file_travail -> 'noms', '{}'::jsonb) as noms,
       coalesce(sg.signaux, '[]'::jsonb) as signaux,
       coalesce(sa.suivis,  '[]'::jsonb) as suivis,
       coalesce(tc.taches,  '[]'::jsonb) as taches,
       r.resume_ventes
  from base b
  join public.reglages r on r.bureau = b.bureau
  left join signaux_gardes  sg on sg.personne = b.personne
  left join suivis_actifs   sa on sa.personne = b.personne
  left join taches_ouvertes tc on tc.personne = b.personne;

revoke all on public.v_courrier from anon, authenticated;
grant select on public.v_courrier to authenticated;

-- ---------------------------------------------------------------------------
-- 7. A CONTROLER, DANS CET ORDRE
-- ---------------------------------------------------------------------------
-- a) Aucune table ne porte plus `id`, toutes portent `bureau` et `cree_par` :
--    select table_name, string_agg(column_name, ', ' order by column_name) as colonnes
--      from information_schema.columns
--     where table_schema='public' and column_name in ('id','bureau','cree_par')
--       and table_name in ('reglages','ventes','suivi_clients','echanges','taches','calendrier_choix')
--     group by table_name order by table_name;
--
-- b) AUCUNE LIGNE N'A ETE PERDUE. Les nombres attendus au 13/09/2026 :
--    ventes 9878, taches 20, suivi_clients 16, echanges 15, reglages 2,
--    calendrier_choix 1, et zero ligne sans bureau.
--    select 'ventes' t, count(*) n, count(*) filter (where bureau is null) sans_bureau from public.ventes
--    union all select 'taches', count(*), count(*) filter (where bureau is null) from public.taches
--    union all select 'suivi_clients', count(*), count(*) filter (where bureau is null) from public.suivi_clients
--    union all select 'echanges', count(*), count(*) filter (where bureau is null) from public.echanges
--    union all select 'reglages', count(*), count(*) filter (where bureau is null) from public.reglages
--    union all select 'calendrier_choix', count(*), count(*) filter (where bureau is null) from public.calendrier_choix
--    order by 1;
--
-- c) LE COURRIER DE DEMAIN PART ENCORE. La vue doit rendre une ligne par compte
--    consentant, avec son adresse et son jeton :
--    select id, email, (jeton_emails is not null) as jeton,
--           jsonb_array_length(suivis) as suivis, jsonb_array_length(taches) as taches
--      from public.v_courrier;
--
-- d) Et le controle de securite de Supabase, comme apres tout lot SQL.
