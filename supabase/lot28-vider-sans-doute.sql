/* ============================================================================
   LOT 28, 18/09/2026 : VIDER SA BASE NE DOIT PAS POUVOIR MENTIR

   A COLLER DANS SUPABASE, editeur SQL. Ne touche a aucune donnee : cette page
   ne fait que remplacer une fonction.

   CE QUI EST ARRIVE A TED. Il a vide sa base pour en remettre une autre. Son
   navigateur a vide sa copie locale, il a vu un bureau vide, il a importe le
   nouvel export. Resultat mesure le soir meme : 176 779 lignes sur le compte,
   soit 171 569 anciennes TOUJOURS LA plus 5 210 nouvelles. Deux bases melangees,
   et aucun message pour le dire.

   LA CAUSE N'EST PAS DANS CETTE FONCTION : elle supprime bien ce qu'on lui
   demande, et un DELETE de 171 569 lignes avec son declencheur par ligne prend
   1,4 seconde, mesure sur un Postgres 16. La cause est que le NAVIGATEUR vidait
   sa copie locale SANS JAMAIS VERIFIER que le serveur avait vide la sienne.

   CE QUE CE LOT CHANGE, ET C'EST TOUT : la fonction rendait `void`. Elle rend
   maintenant le COMPTE de ce qu'elle a efface, table par table. Le navigateur
   peut donc exiger une preuve avant de toucher a quoi que ce soit chez lui.

   Une fonction qui ne rend rien ne peut pas etre verifiee. Celle-la le pouvait
   d'autant moins qu'elle est `security definer` : elle leve sur un non-maitre,
   et une exception avalee par l'appelant ressemble a un succes.
   ============================================================================ */

/* `returns void` devient `returns jsonb` : Postgres refuse de changer le type de
   retour d'une fonction existante, il faut donc la retirer d'abord. Sur une base
   neuve ce `drop` ne fait rien. */
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
  reste     int;
begin
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
  delete from public.resumes where bureau = b;

  /* LA PREUVE, ET C'EST LA RAISON D'ETRE DE CE LOT. On relit ce qui reste. Si ce
     n'est pas zero, on LEVE : mieux vaut que l'appelant sache que rien n'est sur
     plutot qu'il vide sa copie locale sur la foi d'un silence. */
  select count(*) into reste from public.ventes where bureau = b;
  if reste <> 0 then
    raise exception 'le vidage n''a pas abouti : % ligne(s) restent sur le compte', reste;
  end if;

  return jsonb_build_object(
    'vide',     true,
    'ventes',   n_ventes,
    'lignes',   n_lignes,
    'suivi',    n_suivi,
    'echanges', n_echange,
    'reste',    reste);
end
$$;

/* Le `drop` a emporte les droits avec la fonction : on les repose. */
revoke all on function public.vider_la_base_du_bureau(uuid) from public, anon;
grant execute on function public.vider_la_base_du_bureau(uuid) to authenticated;

/* -------------------------------------------------------------------------
   A CONTROLER APRES AVOIR PASSE CE SCRIPT

   La fonction doit exister, rendre du jsonb, et n'etre executable que par un
   compte connecte :

     select p.proname, pg_get_function_result(p.oid) as rend,
            has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
            has_function_privilege('anon',          p.oid, 'execute') as anon
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'vider_la_base_du_bureau';

   Attendu : rend = jsonb, authenticated = true, anon = false.
   ------------------------------------------------------------------------- */
