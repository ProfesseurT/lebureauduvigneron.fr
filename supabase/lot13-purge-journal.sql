-- ============================================================================
-- LOT 13  LE JOURNAL D'ENVOIS SE PURGE TOUT SEUL
-- ============================================================================
-- A COLLER APRES LE LOT 12, dans l'editeur SQL de Supabase.
--
-- POURQUOI CE LOT EXISTE, ET IL N'AURAIT PAS DU AVOIR A EXISTER.
-- La politique de confidentialite annonce, depuis le 11/09/2026, que le journal
-- des courriers envoyes est conserve UN AN puis efface. Au moment ou cette
-- phrase a ete ecrite, RIEN ne l'effacait : la table `courrier_envois` grossit
-- d'une ligne par compte et par jour, pour toujours.
--
-- Une duree de conservation annoncee et non tenue est le genre de manquement
-- qui se verifie en une requete, et qui coute plus cher qu'une duree absente :
-- c'est une declaration fausse, pas un oubli. Le texte de la page et ce lot
-- doivent donc partir ensemble, et si l'un des deux doit attendre, c'est la
-- page.
--
-- POURQUOI UN AN, ET PAS TROIS MOIS NI POUR TOUJOURS.
-- Ce journal ne sert qu'a une chose : empecher le meme courrier de partir deux
-- fois le meme jour. Passe minuit, une ligne n'a plus d'utilite fonctionnelle.
-- Ce qui reste apres, c'est une trace : pouvoir repondre a « vous m'avez ecrit
-- le 3 mars ». Un an couvre largement ce besoin, et au-dela la trace pese plus
-- lourd, en risque, que ce qu'elle rend.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. LA FONCTION DE PURGE
-- ---------------------------------------------------------------------------
-- `security definer` : la table `courrier_envois` a la securite par ligne
-- activee SANS AUCUNE politique, et ses droits sont revoques pour `anon` et
-- `authenticated` (lot 10). Personne ne peut y toucher -- pas meme le
-- declencheur horaire, qui ne s'authentifie pas en `service_role`.
-- `set search_path` obligatoire, meme raison qu'au lot 12.
create or replace function public.courrier_envois_purger()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  effacees int;
begin
  delete from public.courrier_envois
   where jour < (current_date - interval '1 year');
  get diagnostics effacees = row_count;
  return effacees;
end;
$$;

-- Personne n'appelle cette fonction a la main. Le planificateur tourne en
-- `postgres`, qui est proprietaire : il n'a besoin d'aucun droit accorde.
revoke all on function public.courrier_envois_purger() from public;

comment on function public.courrier_envois_purger() is
  'Efface les lignes de courrier_envois de plus d''un an. Tenue de la duree de '
  'conservation annoncee dans /politique-confidentialite/. Appelee par la tache '
  'planifiee courrier-envois-purge, tous les lundis.';

-- ---------------------------------------------------------------------------
-- 2. LA TACHE PLANIFIEE
-- ---------------------------------------------------------------------------
-- UNE FOIS PAR SEMAINE suffit : la limite est une annee, pas une minute. Une
-- purge quotidienne ferait le meme travail avec sept fois plus d'occasions de
-- tomber sur une panne.
-- 3 h 17 UTC un lundi, et pas 3 h 00 : on evite l'heure ronde ou tout le monde
-- planifie, et on reste loin des 8 h du courrier.
--
-- `unschedule` d'abord : selon la version de pg_cron, replanifier un nom deja
-- pris echoue au lieu de remplacer. Le `where` evite l'erreur au premier
-- passage, quand le nom n'existe pas encore.
select cron.unschedule(jobid)
  from cron.job where jobname = 'courrier-envois-purge';

select cron.schedule(
  'courrier-envois-purge',
  '17 3 * * 1',
  $job$ select public.courrier_envois_purger(); $job$
);

-- ---------------------------------------------------------------------------
-- 3. LES CONTROLES
-- ---------------------------------------------------------------------------
-- 3.1  La tache est posee. Attendu : une ligne, active = true.
select jobname, schedule, active from cron.job where jobname = 'courrier-envois-purge';

-- 3.2  La fonction tourne et n'efface rien aujourd'hui. Attendu : 0.
--      Le journal a deux jours d'age : s'il rend autre chose que 0, la
--      comparaison de dates est fausse et il faut s'arreter la.
select public.courrier_envois_purger() as attendu_0;

-- 3.3  Le journal est intact. Attendu : le nombre de lignes d'avant.
select count(*) as lignes_restantes, min(jour) as plus_ancienne
  from public.courrier_envois;

-- ---------------------------------------------------------------------------
-- LE FREIN
-- ---------------------------------------------------------------------------
-- select cron.unschedule('courrier-envois-purge');
