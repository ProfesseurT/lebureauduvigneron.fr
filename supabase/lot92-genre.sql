-- ============================================================================
-- LOT 92, 09/10/2026 : LE GENRE SUR LE PROFIL. A COLLER DANS SUPABASE, APRES LE LOT 89,
-- ET AVANT DE POUSSER LE CODE. REJOUABLE.
-- ============================================================================
-- Demande de Ted : l'experience se genre. Chacun dit comment on lui ecrit :
--   'm' au masculin, 'f' au feminin, 'n' prefere ne pas le dire (mots epicenes a l'ecran).
-- Les comptes existants partent sur 'n' : on n'invente le genre de personne.
-- Le numero 92 laisse 90 et 91 a la suite deja prevue pour Brevo.
--
-- CE QUE FAIT CE LOT
--   1. `profils.genre`, ecrit par la personne elle-meme (droit par colonne, comme
--      `consent_courrier`). La regle « modifier sa fiche » borne deja a SA ligne.
--   2. `equipe(b)` rend aussi le genre de chaque membre : dans « L'equipe », le role de
--      Romane s'accorde avec SON genre, pas avec celui de qui regarde. La fonction change
--      de forme, donc elle est supprimee puis recreee (un `create or replace` ne peut pas
--      ajouter une colonne rendue), avec les memes droits.
-- ============================================================================

alter table public.profils add column if not exists genre text not null default 'n';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profils_genre') then
    alter table public.profils add constraint profils_genre check (genre in ('m', 'f', 'n'));
  end if;
end $$;

grant update (genre) on public.profils to authenticated;

drop function if exists public.equipe(uuid);
create function public.equipe(b uuid)
returns table (personne uuid, role text, depuis timestamptz,
               prenom text, nom text, email text, genre text)
language sql stable security definer set search_path = public as $$
  select m.personne, m.role, m.depuis, p.prenom, p.nom, p.email, p.genre
    from public.membres m
    join public.profils p on p.id = m.personne
   where m.bureau = b and public.est_membre(b)
   order by (m.role = 'maitre') desc, m.depuis;
$$;

revoke all on function public.equipe(uuid) from public, anon;
grant execute on function public.equipe(uuid) to authenticated;

-- CONTROLE, a lire apres avoir colle : trois lignes attendues.
--   select column_name, data_type, column_default from information_schema.columns
--    where table_name = 'profils' and column_name = 'genre';
--   select privilege_type from information_schema.column_privileges
--    where table_name = 'profils' and column_name = 'genre' and grantee = 'authenticated';
--   select pg_get_function_result('public.equipe(uuid)'::regprocedure);
