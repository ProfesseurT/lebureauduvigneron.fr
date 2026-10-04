-- ===========================================================================
-- LOT 60 : LA PREMIERE NOTIFICATION, LE DEVIS SIGNE (03/10/2026)
-- ===========================================================================
-- Troisieme lot du chantier des notifications (CLAUDE.md, « LES NOTIFICATIONS ET LEURS
-- REGLAGES »). Quand un client signe un devis en ligne, la fonction `notif-commerce`
-- envoie, en plus du mail, une notification a chaque appareil active du bureau.
--
-- A COLLER PAR TED DANS SUPABASE, PUIS POUSSER, PUIS REDEPLOYER `notif-commerce` AVEC SON
-- SECRET VAPID_PRIVATE. Rejouable.
--
-- CE QUE FAIT CE LOT
--   1. `push_cibles(bureau)` : les appareils actives des membres du bureau. Lue par la
--      fonction d'envoi seule (role de service), jamais par le navigateur.
--   2. Le journal `notif_envois` note aussi combien de notifications sont parties, et
--      pourquoi les autres ont echoue.
-- ===========================================================================

create or replace function public.push_cibles(p_bureau uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth)
                            order by a.vu_le desc), '[]'::jsonb)
    from public.push_abonnements a
   where a.personne in (select m.personne from public.membres m where m.bureau = p_bureau)
$$;
revoke all on function public.push_cibles(uuid) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.push_cibles(uuid) to service_role;
  end if;
end $$;

alter table public.notif_envois add column if not exists push_partis integer;
alter table public.notif_envois add column if not exists push_echec  text;

-- CONTROLES
--   select has_function_privilege('authenticated', 'public.push_cibles(uuid)', 'execute');  -- false
--   select column_name from information_schema.columns where table_name = 'notif_envois' and column_name like 'push_%';  -- 2 lignes
