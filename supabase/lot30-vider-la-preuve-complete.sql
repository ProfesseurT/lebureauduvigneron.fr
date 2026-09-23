/* ============================================================================
   LOT 30, 23/09/2026 : LA PREUVE DU VIDAGE COUVRE LES CINQ TABLES

   A COLLER DANS SUPABASE, editeur SQL. Ne touche a aucune donnee : cette page
   ne fait que remplacer une fonction.

   CE QUE LE LOT 28 A LAISSE OUVERT, ET PERSONNE NE L'AVAIT VU. Il a fait rendre
   a `vider_la_base_du_bureau` le compte de ce qu'elle efface, table par table,
   puis relire ce qui reste avant de conclure. C'etait la bonne idee. Mais la
   relecture ne portait que sur `public.ventes` :

       select count(*) into reste from public.ventes where bureau = b;

   Les quatre autres tables que la fonction vide dans la meme transaction, elles,
   etaient supprimees puis JAMAIS RECOMPTEES : `ventes_lignes`, `suivi_clients`,
   `echanges` et `resumes`. La fonction ne pouvait donc pas lever sur un vidage
   partiel de ces quatre-la, et elle aurait rendu `vide: true` sur une base ou le
   suivi client serait reste entier.

   POURQUOI CA COMPTE PLUS QU'IL N'Y PARAIT. Le lot 28 existe parce qu'un vidage
   qui ment coute une base melangee. Or les notes de suivi et les echanges sont
   precisement ce que la confirmation promet de faire partir, et ce qui n'existe
   NULLE PART ailleurs : « ni tes notes, ni tes echanges, ni ton classement ne
   sont remontes dans Vitisoft ». Une preuve qui ne regarde qu'un cinquieme de ce
   qu'elle a efface est une preuve qui garantit la seule chose qu'on peut
   reimporter.

   ET `ventes_lignes` EST LE CAS LE PLUS PROBABLE DES QUATRE. Elle est tenue par
   le declencheur `ventes_lignes_suivre`, donc par une mecanique, et le lot 28
   disait deja en commentaire pourquoi il la supprimait explicitement : « si une
   seule ligne lui echappait, un jour, pour une raison qu'on ne connait pas
   encore, elle resterait la a porter des chiffres d'une base que le vigneron
   croit effacee ». Il la supprimait, et il ne verifiait pas.

   CE QUE CE LOT CHANGE, ET C'EST TOUT :
     1. les cinq tables sont recomptees, pas une seule ;
     2. le message d'erreur NOMME la table qui resiste, parce qu'un « le vidage
        n'a pas abouti » sans nom ne se diagnostique pas ;
     3. `reste` garde EXACTEMENT son sens d'avant, les lignes de vente restantes.
        Un nouveau champ `reste_total` porte la somme des cinq. Deux formes, deux
        noms : changer le sens de `reste` sous le meme nom, c'est la panne que ce
        depot passe son temps a traquer ailleurs.

   NE PAS renommer les champs rendus : `bdv-base.js` lit `ventes`, `suivi` et
   `echanges` pour chiffrer le bilan que le vigneron lit apres le vidage, et
   PostgREST associe les cles du corps JSON aux NOMS des parametres.
   ============================================================================ */

/* Le type de retour ne change pas, mais on garde le `drop` : sur une base qui
   porterait encore la version `void` d'avant le lot 28, Postgres refuserait le
   `create or replace`. Sur une base a jour, ce `drop` est sans effet visible. */
drop function if exists public.vider_la_base_du_bureau(uuid);

create or replace function public.vider_la_base_du_bureau(b uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n_ventes  int;
  n_lignes  int;
  n_suivi   int;
  n_echange int;
  n_resume  int;
  r_ventes  int;
  r_lignes  int;
  r_suivi   int;
  r_echange int;
  r_resume  int;
  manque    text;
begin
  /* Le controle d'acces est en PREMIERE LIGNE, et il y reste. Cette fonction est
     `security definer` : sans lui, elle ouvrirait la suppression a tout compte
     connecte, sur n'importe quel bureau. */
  if b is null or not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut vider sa base';
  end if;

  delete from public.echanges      where bureau = b;  get diagnostics n_echange = row_count;
  delete from public.suivi_clients where bureau = b;  get diagnostics n_suivi   = row_count;
  delete from public.ventes        where bureau = b;  get diagnostics n_ventes  = row_count;

  /* LA TABLE ETROITE EST NETTOYEE EXPLICITEMENT, ET PAS SEULEMENT PAR LE
     DECLENCHEUR. `ventes_lignes_suivre` la suit ligne a ligne et fait le travail
     dans le cas normal. Mais si une seule ligne lui echappait, un jour, pour une
     raison qu'on ne connait pas encore, elle resterait la a porter des chiffres
     d'une base que le vigneron croit effacee. Ici on ne suppose rien : on
     supprime, puis on compte ce qui reste. */
  delete from public.ventes_lignes where bureau = b;  get diagnostics n_lignes = row_count;

  update public.reglages
     set file_travail = null, resume_ventes = null, depose_le = null, maj_le = now()
   where bureau = b;

  /* Et les resumes du lot 27, explicitement eux aussi : le declencheur sur
     `ventes` les perime deja, mais un cache qui survivrait a un vidage
     afficherait un chiffre d'affaires sur une base a zero ligne. */
  delete from public.resumes where bureau = b;  get diagnostics n_resume = row_count;

  /* LA PREUVE, ET C'EST LA RAISON D'ETRE DE CE LOT. On relit les CINQ tables, et
     pas la seule table des ventes comme au lot 28. Si l'une d'elles n'est pas a
     zero, on LEVE en la NOMMANT : « le vidage n'a pas abouti » sans nom oblige a
     rouvrir la base pour savoir ou chercher, et personne ne le fait a 8 h du
     matin avec un vigneron au telephone. */
  select count(*) into r_ventes  from public.ventes        where bureau = b;
  select count(*) into r_lignes  from public.ventes_lignes where bureau = b;
  select count(*) into r_suivi   from public.suivi_clients where bureau = b;
  select count(*) into r_echange from public.echanges      where bureau = b;
  select count(*) into r_resume  from public.resumes       where bureau = b;

  manque := concat_ws(', ',
    nullif(concat('ventes: ',        r_ventes),  'ventes: 0'),
    nullif(concat('ventes_lignes: ', r_lignes),  'ventes_lignes: 0'),
    nullif(concat('suivi_clients: ', r_suivi),   'suivi_clients: 0'),
    nullif(concat('echanges: ',      r_echange), 'echanges: 0'),
    nullif(concat('resumes: ',       r_resume),  'resumes: 0'));

  if manque <> '' then
    raise exception 'le vidage n''a pas abouti, il reste des lignes dans %', manque;
  end if;

  /* `reste` GARDE SON SENS D'AVANT : les lignes de vente restantes. Le total des
     cinq tables arrive sous un nom a lui. Deux formes, deux noms. */
  return jsonb_build_object(
    'vide',        true,
    'ventes',      n_ventes,
    'lignes',      n_lignes,
    'suivi',       n_suivi,
    'echanges',    n_echange,
    'resumes',     n_resume,
    'reste',       r_ventes,
    'reste_total', r_ventes + r_lignes + r_suivi + r_echange + r_resume);
end
$$;

/* Le `drop` a emporte les droits avec la fonction : on les repose. Et on nomme
   les TROIS roles, jamais `public` seul : Supabase accorde l'execution
   NOMMEMENT a `anon`, `authenticated` et `service_role` sur toute fonction creee
   dans le schema public, et un `revoke ... from public` ne retire rien. Lecon du
   13/09/2026, payee par `courrier_envois_purger()`, restee appelable sans
   session pendant deux jours. */
revoke all on function public.vider_la_base_du_bureau(uuid) from public, anon, authenticated;
grant execute on function public.vider_la_base_du_bureau(uuid) to authenticated;

/* -------------------------------------------------------------------------
   A CONTROLER APRES AVOIR PASSE CE SCRIPT

   1. La fonction existe, rend du jsonb, et n'est executable que par un compte
      connecte :

      select p.proname, pg_get_function_result(p.oid) as rend,
             has_function_privilege('anon',          p.oid, 'execute') as anon_peut,
             has_function_privilege('authenticated', p.oid, 'execute') as connecte_peut
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'vider_la_base_du_bureau';

      Attendu : rend = jsonb, anon_peut = false, connecte_peut = true.

   2. Le controle de securite de Supabase, apres tout lot SQL :
      get_advisors, type security. `est_maitre` y apparait comme executable par
      les comptes connectes, et c'est un faux positif connu : une fonction
      appelee dans une politique s'execute avec les droits de qui lit.
   ------------------------------------------------------------------------- */
