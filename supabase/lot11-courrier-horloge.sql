-- ============================================================================
-- LOT 11  L'HORLOGE DU COURRIER DU MATIN
-- ============================================================================
-- A COLLER DANS L'EDITEUR SQL DE SUPABASE, projet qukmncqqwomhmrdhvetj.
-- Pas par le MCP : la decision du 01/09/2026 est que tout DDL repasse a la
-- main, et ce fichier porte en plus un SECRET, qui n'a rien a faire dans un
-- contexte d'agent.
--
-- CE QU'ELLE FAIT, ET CE QU'ELLE NE DECIDE PAS.
-- Elle frappe a la porte de la fonction `courrier-matin` TOUTES LES HEURES, a
-- la minute 5. Elle ne sait pas quelle heure il est a Paris et elle n'a pas a
-- le savoir : c'est `index.ts` qui compare l'heure de Paris a HEURE_ENVOI et
-- qui refuse de travailler 23 fois sur 24.
--
-- POURQUOI PAS UN CRON A 8 H. [Certain] pg_cron travaille en UTC. « 0 8 * * * »
-- donnerait 10 h a Paris l'ete et 9 h l'hiver, et personne ne s'en souviendrait
-- au changement d'heure. Un cron horaire plus un test dans le code est la seule
-- combinaison qui ne se derange pas deux fois par an.
--
-- POURQUOI LA MINUTE 5 ET PAS 0. A l'heure pile, tout le monde declenche. Cinq
-- minutes plus tard, la plateforme est calme. Ca ne change rien pour un mail
-- de 8 h, et ca evite une file d'attente pour rien.
--
-- LE SECRET EST DANS LA DEFINITION DE LA TACHE, et c'est un compromis assume.
-- `cron.job.command` est lisible par qui a acces a la base -- c'est-a-dire Ted.
-- L'alternative, Supabase Vault, ajoute une brique a surveiller pour proteger
-- une cle qui ne donne acces qu'a cette fonction et qui se revoque en changeant
-- une variable. A rouvrir le jour ou quelqu'un d'autre a acces a la base.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. LES DEUX EXTENSIONS
-- ---------------------------------------------------------------------------
-- pg_net etait deja installe le 10/09/2026 pour appeler la fonction a la main.
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Si `create extension pg_cron` est refuse, l'activer par le tableau de bord :
-- Database > Extensions > pg_cron. Puis repasser ce fichier.

-- ---------------------------------------------------------------------------
-- 2. L'HORLOGE
-- ---------------------------------------------------------------------------
-- REMPLACER <COURRIER_CLE> par le secret, et RIEN D'AUTRE dans ce bloc.
-- Ne pas ajouter `?maintenant=1` : ce parametre existe pour les essais a la
-- main et il ANNULE le controle de l'heure. Dans une horloge, il ferait partir
-- le courrier vingt-quatre fois par jour.
select cron.schedule(
  'courrier-du-matin',
  '5 * * * *',
  $job$
  select net.http_post(
    url := 'https://qukmncqqwomhmrdhvetj.supabase.co/functions/v1/courrier-matin',
    headers := jsonb_build_object(
      'Authorization',  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1a21uY3Fxd29taG1yZGh2ZXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTUwMzksImV4cCI6MjEwMzgzMTAzOX0.jGCPLploiALbFMPt1edpVOyyr0emk8DP8ZdvnPLSLEM',
      'x-courrier-cle', '<COURRIER_CLE>',
      'Content-Type',   'application/json'
    ),
    timeout_milliseconds := 30000
  );
  $job$
);

-- ---------------------------------------------------------------------------
-- 3. LES CONTROLES
-- ---------------------------------------------------------------------------
-- 3.1  La tache existe et elle est active. Attendu : une ligne, active = true,
--      schedule = '5 * * * *'.
select jobid, jobname, schedule, active from cron.job order by jobid;

-- 3.2  Dans l'heure qui suit, elle doit avoir tourne au moins une fois.
--      `status` doit dire 'succeeded'. Attention : succeeded veut dire que la
--      BASE a poste la demande, pas que le mail est parti -- pg_net est
--      asynchrone. Voir 3.3.
select jobid, runid, status, left(coalesce(return_message,''),200) as message,
       start_time
  from cron.job_run_details
 order by start_time desc
 limit 5;

-- 3.3  CE QUE LA FONCTION A REPONDU. C'est ici que se lit la verite : 200 avec
--      « hors heure » aux 23 mauvaises heures, et 200 avec « envoyes: 1 » a 8 h.
select id, status_code, left(content, 400) as reponse, created
  from net._http_response
 order by id desc
 limit 5;

-- 3.4  LE CONTROLE DU LENDEMAIN, celui qui compte. Une ligne au jour du matin
--      veut dire que le courrier est parti. AUCUNE ligne veut dire que rien
--      n'est parti, et c'est le seul symptome qu'on aura.
select compte, jour, reserve_le, resend_id, left(coalesce(echec,'—'),200) as echec
  from public.courrier_envois
 order by reserve_le desc
 limit 5;

-- ---------------------------------------------------------------------------
-- 4. LE FREIN, a garder sous la main
-- ---------------------------------------------------------------------------
-- Arrete l'horloge immediatement. La fonction reste deployee et appelable a la
-- main : on coupe le declenchement, pas l'outil.
-- select cron.unschedule('courrier-du-matin');
