-- ===========================================================================
-- LOT 59 : LES APPAREILS QUI RECOIVENT LES NOTIFICATIONS (03/10/2026)
-- ===========================================================================
-- Deuxieme lot du chantier des notifications (CLAUDE.md, « LES NOTIFICATIONS ET LEURS
-- REGLAGES »). Ici on ne fait que RANGER les appareils qui ont dit oui. Rien n'est envoye :
-- l'envoi est le lot 3 (le devis signe).
--
-- A COLLER PAR TED DANS SUPABASE, AVANT DE POUSSER LE CODE. Rejouable.
--
-- UNE LIGNE PAR APPAREIL, PAS PAR PERSONNE. L'iPhone et le Mac de Ted sont deux lignes :
-- chacun a sa propre adresse d'envoi (l'« endpoint »), donnee par Apple, Google, Mozilla
-- ou Microsoft. Cette adresse est la cle : un meme appareil ne peut pas etre inscrit deux
-- fois.
--
-- LE NAVIGATEUR N'ECRIT JAMAIS LA TABLE DIRECTEMENT. Deux fonctions seulement :
--   push_inscrire(...)  : pose l'appareil pour la personne connectee. Si l'adresse etait
--                         deja rangee pour QUELQU'UN D'AUTRE (poste partage, changement de
--                         compte sans deconnexion), elle change de main : l'appareil
--                         appartient a celui qui vient de dire oui, l'autre ne recevra plus
--                         rien sur un ecran qui n'est plus le sien.
--   push_retirer(adr)   : retire SON appareil, jamais celui d'un autre.
--
-- L'ADRESSE EST FILTREE A L'ENTREE. Au lot 3, le serveur ecrira a cette adresse. Une
-- adresse inventee (« https://n-importe-ou.fr ») ferait donc ecrire le serveur n'importe
-- ou. Seuls les quatre services d'envoi des navigateurs passent. Une absence n'est pas un
-- zero : ce qui ne ressemble pas a une adresse d'envoi se refuse ICI, une fois.
-- ===========================================================================

create table if not exists public.push_abonnements (
  endpoint  text primary key,
  personne  uuid not null references auth.users(id) on delete cascade,
  p256dh    text not null check (char_length(p256dh) between 40 and 200),
  auth      text not null check (char_length(auth) between 10 and 100),
  appareil  text check (char_length(appareil) <= 80),
  cree_le   timestamptz not null default now(),
  vu_le     timestamptz not null default now()
);
create index if not exists push_abonnements_personne on public.push_abonnements (personne);

alter table public.push_abonnements enable row level security;
revoke all on public.push_abonnements from public, anon, authenticated;
-- Le navigateur LIT ses propres appareils (pour dire « actives sur cet appareil ») et rien
-- d'autre. Il n'ecrit que par les deux fonctions.
grant select on public.push_abonnements to authenticated;
drop policy if exists push_lire_les_siens on public.push_abonnements;
create policy push_lire_les_siens on public.push_abonnements
  for select to authenticated using (personne = auth.uid());

-- Les quatre services d'envoi. Rien d'autre.
create or replace function public.push_adresse_valide(p text)
returns boolean language sql immutable as $$
  select p is not null and char_length(p) <= 1000 and p ~ (
    '^https://('
    || 'fcm\.googleapis\.com'
    || '|[a-z0-9-]+\.push\.apple\.com'
    || '|updates\.push\.services\.mozilla\.com'
    || '|[a-z0-9-]+\.notify\.windows\.com'
    || ')/[^[:space:][:cntrl:]]+$')
$$;
revoke all on function public.push_adresse_valide(text) from public, anon;

create or replace function public.push_inscrire(p_endpoint text, p_p256dh text, p_auth text, p_appareil text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_moi uuid := auth.uid();
begin
  if v_moi is null then raise exception 'connexion requise' using errcode = '28000'; end if;
  if not public.push_adresse_valide(p_endpoint) then
    raise exception 'adresse d''envoi refusee' using errcode = '22023';
  end if;
  insert into public.push_abonnements (endpoint, personne, p256dh, auth, appareil)
  values (p_endpoint, v_moi, p_p256dh, p_auth, left(nullif(btrim(p_appareil), ''), 80))
  on conflict (endpoint) do update
     set personne = excluded.personne, p256dh = excluded.p256dh, auth = excluded.auth,
         appareil = excluded.appareil, vu_le = now();
  -- Dix appareils au plus par personne : au-dela, les plus anciens sortent. Un vigneron
  -- n'a pas dix telephones ; ce sont des reinstallations dont l'adresse est deja morte.
  delete from public.push_abonnements x
   where x.personne = v_moi
     and x.endpoint not in (select y.endpoint from public.push_abonnements y
                             where y.personne = v_moi order by y.vu_le desc limit 10);
  return true;
end $$;
revoke all on function public.push_inscrire(text, text, text, text) from public, anon;
grant execute on function public.push_inscrire(text, text, text, text) to authenticated;

create or replace function public.push_retirer(p_endpoint text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'connexion requise' using errcode = '28000'; end if;
  delete from public.push_abonnements where endpoint = p_endpoint and personne = auth.uid();
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.push_retirer(text) from public, anon;
grant execute on function public.push_retirer(text) to authenticated;

-- Le role de service (l'envoi du lot 3) lit et nettoie tout.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, delete, update on public.push_abonnements to service_role;
  end if;
end $$;

-- CONTROLES (apres avoir colle)
--   select count(*) from public.push_abonnements;                                         -- 0
--   select has_table_privilege('authenticated', 'public.push_abonnements', 'insert');      -- false
--   select has_function_privilege('anon', 'public.push_inscrire(text,text,text,text)', 'execute'); -- false
