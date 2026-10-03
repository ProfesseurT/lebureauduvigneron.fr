-- ===========================================================================
-- LOT 57 : LES NOUVELLES DE « MON COMMERCE » (03/10/2026)
-- ===========================================================================
-- Demande de Ted : quand un devis est SIGNE EN LIGNE par un client, ou qu'une affaire
-- est GAGNEE ou PERDUE PAR UN COLLEGUE, un point sur « Mon commerce », un point sur
-- « Mon bureau », une pastille dans l'en-tete, et un MAIL tout de suite a tout le bureau
-- (y compris a celui qui a fait le geste : c'est sa confirmation, decision de Ted du
-- 03/10/2026 apres le premier essai). Le bandeau vert des devis signes part.
--
-- A COLLER PAR TED DANS SUPABASE, APRES LE LOT 56. Rejouable.
-- PUIS, une seule fois, remplir le reglage de l'envoi (section 4, bloc a completer).
--
-- CE QUE FAIT CE LOT
--   1. `affaires.close_par` : QUI a clos l'affaire. Pose par la base, jamais par le
--      navigateur. Vide quand c'est la signature en ligne qui a gagne l'affaire (elle
--      passe par la cle de service, `auth.uid()` y vaut null).
--      `maj_par` ne suffisait pas : la signature en ligne ne le touche pas, il garde le
--      nom du dernier collegue qui a modifie l'affaire, et l'ecran aurait annonce
--      « Camila a gagne Cave du Port » pour un devis signe par le client.
--   2. `notif_envois` : un mail par fermeture, et UN SEUL. La cle primaire est le
--      garde-fou, comme `courrier_envois` (regle du 10/09/2026) : on POSE la ligne avant
--      d'envoyer, on ne demande pas « deja envoye ? ».
--   3. `notif_detail()` : tout ce que le mail dit, lu ici et nulle part ailleurs. La
--      fonction d'envoi ne decide de rien.
--   4. Le declencheur qui previent la fonction `notif-commerce` par pg_net, APRES la
--      fermeture. UNE PANNE DE L'ENVOI NE BLOQUE JAMAIS LA FERMETURE : tout l'appel est
--      dans un bloc qui avale l'erreur. Un mail manque, une affaire reste juste.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. QUI A CLOS
-- ---------------------------------------------------------------------------
alter table public.affaires add column if not exists close_par uuid references auth.users(id) on delete set null;

create or replace function public.affaires_close_par()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.issue = 'en_cours' then
    new.close_par := null;
  elsif tg_op = 'INSERT' or old.issue = 'en_cours' then
    new.close_par := auth.uid();
  else
    new.close_par := old.close_par;
  end if;
  return new;
end $$;
revoke all on function public.affaires_close_par() from public, anon, authenticated;

drop trigger if exists affaires_close_par on public.affaires;
create trigger affaires_close_par
  before insert or update on public.affaires
  for each row execute function public.affaires_close_par();

-- Lecture : la colonne suit les droits de table (le bureau lit ses affaires).
create index if not exists affaires_close on public.affaires (bureau, close_le) where issue <> 'en_cours';

-- ---------------------------------------------------------------------------
-- 2. LE JOURNAL DES MAILS
-- ---------------------------------------------------------------------------
create table if not exists public.notif_envois (
  cle            text primary key,
  bureau         uuid not null references public.bureaux(bureau) on delete cascade,
  affaire_id     uuid not null,
  sorte          text not null check (sorte in ('signe', 'gagnee', 'perdue')),
  demande_le     timestamptz not null default now(),
  envoye_le      timestamptz,
  destinataires  integer,
  echec          text
);
alter table public.notif_envois enable row level security;
revoke all on public.notif_envois from public, anon, authenticated;

-- LE REGLAGE DE L'ENVOI : l'adresse de la fonction et son secret. Une ligne, illisible
-- par tout compte du navigateur. Pas dans le code du declencheur : le texte d'une
-- fonction se lit dans le catalogue.
create table if not exists public.notif_reglage (
  id   boolean primary key default true check (id),
  url  text not null,
  cle  text not null check (char_length(cle) >= 32)
);
alter table public.notif_reglage enable row level security;
revoke all on public.notif_reglage from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. CE QUE DIT LE MAIL
-- ---------------------------------------------------------------------------
-- La sorte se decide ICI : perdue, ou signee en ligne, ou gagnee.
-- SIGNEE EN LIGNE = gagnee SANS auteur (`close_par` vide : la signature passe par la cle
-- de service) ET un devis accepte de l'affaire porte une signature. Pas de fenetre de
-- temps : c'est l'absence d'auteur qui dit « le client l'a fait », pas une horloge.
-- Les destinataires : TOUS les membres du bureau qui ont une adresse, celui qui a clos
-- compris (le mail lui sert de confirmation, decision de Ted du 03/10/2026).
-- Une affaire rouverte depuis rend null : il n'y a plus rien a annoncer.
create or replace function public.notif_detail(p_bureau uuid, p_affaire uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  a record; d record; v_sig_nom text; v_sig_qual text; v_sorte text; v_client text; v_type text; v_par text;
  v_bureau text; v_lignes jsonb; v_dest jsonb;
begin
  select x.* into a from public.affaires x where x.bureau = p_bureau and x.affaire_id = p_affaire;
  if not found or a.issue = 'en_cours' or a.close_le is null then return null; end if;

  select x.* into d from public.devis x
   where x.bureau = p_bureau and x.affaire_id = p_affaire and x.statut = 'accepte'
   order by x.accepte_le desc nulls last limit 1;

  v_sorte := case
    when a.issue = 'perdue' then 'perdue'
    when a.close_par is null and d.devis_id is not null and d.signe_le is not null then 'signe'
    else 'gagnee' end;

  -- Une signature EN LIGNE sans devis accepte n'existe pas ; une affaire gagnee par un
  -- collegue sans `close_par` (avant ce lot, ou par la base) ne s'annonce pas : on ne
  -- sait pas qui l'a fait, et le mail le dirait mal.
  if v_sorte <> 'signe' and a.close_par is null then return null; end if;

  select coalesce(nullif(btrim(a.client_nom), ''), nullif(btrim(p.nom), ''), a.titre)
    into v_client from (select 1) z left join public.pistes p
      on p.bureau = p_bureau and p.piste_id = a.piste_id;
  select t.nom into v_type from public.affaire_types t where t.bureau = p_bureau and t.type_id = a.type_id;
  select b.nom into v_bureau from public.bureaux b where b.bureau = p_bureau;
  if a.close_par is not null then
    select coalesce(nullif(btrim(pr.prenom), ''), split_part(pr.email, '@', 1)) into v_par
      from public.profils pr where pr.id = a.close_par;
  end if;

  if d.devis_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'designation', l.designation, 'millesime', l.millesime, 'conditionnement', l.conditionnement,
             'quantite', l.quantite, 'pu_f_c', l.pu_f_c, 'final_c', l.final_c) order by l.rang), '[]'::jsonb)
      into v_lignes from public.devis_lignes l where l.bureau = p_bureau and l.devis_id = d.devis_id;
    select x.nom, x.qualite into v_sig_nom, v_sig_qual from public.devis_signatures x
     where x.bureau = p_bureau and x.devis_id = d.devis_id order by x.signe_le desc limit 1;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'email', pr.email,
           'prenom', coalesce(nullif(btrim(pr.prenom), ''), split_part(pr.email, '@', 1))) order by pr.email), '[]'::jsonb)
    into v_dest
    from public.membres m join public.profils pr on pr.id = m.personne
   where m.bureau = p_bureau and pr.email is not null and pr.email like '%@%';

  return jsonb_build_object(
    'cle', p_affaire::text || ':' || to_char(a.close_le at time zone 'UTC', 'YYYYMMDDHH24MISSUS'),
    'sorte', v_sorte, 'bureau_nom', v_bureau,
    'affaire_id', a.affaire_id, 'titre', a.titre, 'motif', a.motif, 'close_le', a.close_le,
    'client', v_client, 'type', v_type, 'par', v_par,
    'devis', case when d.devis_id is null then null else jsonb_build_object(
       'devis_id', d.devis_id, 'numero', d.numero, 'total_ht_c', d.total_ht_c, 'total_ttc_c', d.total_ttc_c,
       'signe_le', d.signe_le, 'lignes', v_lignes,
       'signataire', case when v_sig_nom is null then null else jsonb_build_object('nom', v_sig_nom, 'qualite', v_sig_qual) end) end,
    'destinataires', v_dest);
end $$;
revoke all on function public.notif_detail(uuid, uuid) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.notif_detail(uuid, uuid) to service_role;
    grant select, insert, update on public.notif_envois to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. LE DECLENCHEUR QUI PREVIENT LA FONCTION D'ENVOI
-- ---------------------------------------------------------------------------
-- APRES la fermeture, et seulement au passage en_cours -> gagnee | perdue. pg_net
-- n'envoie la requete qu'une fois la transaction validee : la fonction lit donc une
-- affaire deja close. Sans reglage, rien ne part, et rien ne casse.
create or replace function public.affaires_notifier()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.issue = 'en_cours' or (tg_op = 'UPDATE' and old.issue <> 'en_cours') then return null; end if;
  begin
    select x.url, x.cle into r from public.notif_reglage x where x.id;
    if found then
      perform net.http_post(
        url := r.url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notif-cle', r.cle),
        body := jsonb_build_object('bureau', new.bureau, 'affaire_id', new.affaire_id),
        timeout_milliseconds := 15000);
    end if;
  exception when others then
    -- Un mail qui ne part pas ne doit JAMAIS empecher de clore une affaire.
    null;
  end;
  return null;
end $$;
revoke all on function public.affaires_notifier() from public, anon, authenticated;

drop trigger if exists affaires_notifier on public.affaires;
create trigger affaires_notifier
  after insert or update of issue on public.affaires
  for each row execute function public.affaires_notifier();

-- ---------------------------------------------------------------------------
-- A COMPLETER UNE FOIS PAR TED (bloc a part, a ne pas relancer ensuite) :
-- remplacer <NOTIF_CLE> par le secret genere pour la fonction, LE MEME que le secret
-- NOTIF_CLE pose dans les reglages de la fonction `notif-commerce`.
--
--   insert into public.notif_reglage (id, url, cle) values
--     (true, 'https://qukmncqqwomhmrdhvetj.supabase.co/functions/v1/notif-commerce', '<NOTIF_CLE>')
--   on conflict (id) do update set url = excluded.url, cle = excluded.cle;
-- ---------------------------------------------------------------------------

-- CONTROLES
--   select column_name from information_schema.columns where table_name = 'affaires' and column_name = 'close_par';
--   select has_function_privilege('authenticated', 'public.notif_detail(uuid, uuid)', 'execute');  -- false
--   select has_table_privilege('authenticated', 'public.notif_reglage', 'select');                -- false
--   select cle, sorte, envoye_le, destinataires, echec from public.notif_envois order by demande_le desc limit 5;
