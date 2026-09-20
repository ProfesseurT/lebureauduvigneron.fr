-- ============================================================================
-- LOT 29, 20/09/2026. Deux nettoyages sans risque, sortis de l'audit du 19/09.
-- ============================================================================
-- Aucun de ces deux gestes ne change ce que le bureau sait faire. Ils ferment
-- deux avertissements et preparent la base a grossir.
--
-- Ce lot est SUR : `if not exists` sur les index, et `revoke` sur des fonctions
-- que personne n'appelle depuis le navigateur. Rien ne peut casser un ecran.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. SEPT LIENS ENTRE TABLES N'AVAIENT PAS D'INDEX
-- ----------------------------------------------------------------------------
-- Chacune de ces colonnes dit « qui a cree ca » ou « quel bureau ». Sans index,
-- supprimer un compte oblige PostgreSQL a relire la table ENTIERE pour verifier
-- qu'aucune ligne n'y renvoie. A 5 000 lignes c'est invisible ; sur une base de
-- vigneron a 170 000 lignes, une suppression de compte peut expirer en cours de
-- route et laisser la moitie du travail fait.
--
-- Les sept ont ete releves dans la vraie base le 20/09/2026, pas devines.

create index if not exists idx_bureaux_cree_par        on public.bureaux (cree_par);
create index if not exists idx_invitations_invite_par  on public.invitations (invite_par);
create index if not exists idx_invitations_utilise_par on public.invitations (utilise_par);
create index if not exists idx_membres_invite_par      on public.membres (invite_par);
create index if not exists idx_profils_bureau_courant  on public.profils (bureau_courant);
create index if not exists idx_reglages_cree_par       on public.reglages (cree_par);
create index if not exists idx_ventes_cree_par         on public.ventes (cree_par);


-- ----------------------------------------------------------------------------
-- 2. TROIS FONCTIONS DE DECLENCHEUR ETAIENT ANNONCEES COMME APPELABLES
-- ----------------------------------------------------------------------------
-- Supabase les signale parce qu'elles sont techniquement joignables par
-- l'interface web. En pratique elles REFUSENT de s'executer si on les appelle
-- directement : une fonction de declencheur a besoin du contexte de la ligne
-- qui la declenche, et elle leve sans lui. La porte n'etait donc pas ouverte.
--
-- On la ferme quand meme, pour une seule raison : un avertissement permanent
-- qu'on sait faux finit par cacher un avertissement vrai. C'est la meme regle
-- que pour les bancs qui crient sur du sain.

revoke execute on function public.resumes_perimer()          from public, anon, authenticated;
revoke execute on function public.resumes_perimer_reglages()  from public, anon, authenticated;
revoke execute on function public.ventes_lignes_suivre()      from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3. LE CONTROLE, A PASSER JUSTE APRES
-- ----------------------------------------------------------------------------
-- Il doit rendre « 7 index poses » et « 0 fonction de declencheur ouverte ».

select '1. index poses'                as controle, count(*)::text as resultat
  from pg_indexes
 where schemaname='public'
   and indexname in ('idx_bureaux_cree_par','idx_invitations_invite_par',
                     'idx_invitations_utilise_par','idx_membres_invite_par',
                     'idx_profils_bureau_courant','idx_reglages_cree_par',
                     'idx_ventes_cree_par')
union all
select '2. declencheurs encore ouverts', count(*)::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('resumes_perimer','resumes_perimer_reglages','ventes_lignes_suivre')
   and has_function_privilege('anon', p.oid, 'EXECUTE');
