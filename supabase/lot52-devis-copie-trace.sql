-- ============================================================================
-- LOT 52 : LA COPIE DU DEVIS ENVOYE, ET LA TRACE DU FICHIER DE COMMANDE, 01/10/2026
-- ============================================================================
-- A coller dans Supabase (SQL Editor) APRES lot51-devis-mentions-refus.sql. Rejouable.
--
-- Ce que Ted a choisi le 01/10/2026 (« Copie + trace ») :
--   1. LA COPIE. Au « Je l'ai envoye » (et a l'accord d'un devis envoye sans copie), le
--      navigateur fabrique le devis imprime COMPLET (HTML, feuilles de style incluses) et
--      l'envoie. La base le range dans `devis_copies`, UNE FOIS, et calcule ELLE-MEME son
--      empreinte (SHA-256) : l'empreinte ne vient jamais du navigateur. Une copie ne se
--      modifie ni ne se supprime. C'est la preuve de ce que le client a eu en main, et le
--      socle de la future signature (lot 48).
--      La copie vit dans une table A PART : `devis` est lu en liste (`select=*`) par la
--      piece des affaires, et 30 a 40 ko par devis y voyageraient pour rien.
--   2. UNE COPIE INVALIDE N'EMPECHE PAS L'ENVOI. Elle est ignoree (trop grosse, pas un
--      document, sans le numero du devis, avec un script) : le devis rendu n'a alors pas
--      d'empreinte, et l'ecran le DIT. Bloquer l'envoi pour une copie serait punir le
--      vigneron d'un defaut du bureau.
--   3. LA TRACE. `devis_noter_telechargement()` note le premier telechargement du
--      fichier de commande (date, qui) et les compte. Elle survit a une annulation de
--      l'accord : la commande est peut-etre deja dans Vitisoft, et c'est ce que l'ecran
--      rappelle.
-- ============================================================================

-- 1. LES COLONNES DU DEVIS (petites : elles voyagent avec la liste)
alter table public.devis add column if not exists papier_empreinte text;
alter table public.devis add column if not exists papier_le timestamptz;
alter table public.devis drop constraint if exists devis_papier_empreinte;
alter table public.devis add constraint devis_papier_empreinte
  check (papier_empreinte is null or papier_empreinte ~ '^[0-9a-f]{64}$');
alter table public.devis add column if not exists commande_telechargee_le  timestamptz;
alter table public.devis add column if not exists commande_telechargee_par uuid references auth.users(id) on delete set null;
alter table public.devis add column if not exists commande_derniere_le     timestamptz;
alter table public.devis add column if not exists commande_telechargements integer not null default 0;
alter table public.devis drop constraint if exists devis_commande_trace;
alter table public.devis add constraint devis_commande_trace
  check (commande_telechargements >= 0
         and (commande_telechargements = 0) = (commande_telechargee_le is null));

-- 2. LA COPIE, A PART. Lecture par le bureau, ecriture par la seule fonction d'envoi.
create table if not exists public.devis_copies (
  bureau     uuid not null,
  devis_id   uuid not null,
  papier     text not null,
  empreinte  text not null,
  cree_le    timestamptz not null default now(),
  cree_par   uuid references auth.users(id) on delete set null,
  primary key (bureau, devis_id),
  foreign key (bureau, devis_id) references public.devis(bureau, devis_id) on delete cascade,
  constraint devis_copies_empreinte check (empreinte = encode(sha256(convert_to(papier, 'UTF8')), 'hex')),
  constraint devis_copies_taille check (octet_length(papier) between 500 and 600000)
);
alter table public.devis_copies enable row level security;
drop policy if exists devis_copies_lire on public.devis_copies;
create policy devis_copies_lire on public.devis_copies for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
revoke all on public.devis_copies from public, anon, authenticated;
grant select on public.devis_copies to authenticated;

-- Une copie ne bouge plus, meme pour un role qui contournerait les droits.
create or replace function public.devis_copies_figer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'copie du devis : elle ne se modifie ni ne se supprime' using errcode = '23514';
end
$$;
revoke all on function public.devis_copies_figer() from public, anon, authenticated;
drop trigger if exists devis_copies_figer on public.devis_copies;
create trigger devis_copies_figer before update or delete on public.devis_copies
  for each row when (pg_trigger_depth() = 0) execute function public.devis_copies_figer();

-- LE RANGEMENT, partage par l'envoi et l'accord. Rend l'empreinte, ou null si la copie est
-- ignoree. Jamais d'exception : une copie ratee ne fait pas echouer le geste.
create or replace function public.devis_ranger_copie(p_bureau uuid, p_devis uuid, p_numero text, p_papier text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare e text;
begin
  if p_papier is null or octet_length(p_papier) not between 500 and 600000
     or lower(left(btrim(p_papier), 15)) <> '<!doctype html>'
     or position(('Devis ' || p_numero) in p_papier) = 0
     or p_papier ~* '<\s*script' then
    return null;
  end if;
  if exists (select 1 from public.devis_copies c where c.bureau = p_bureau and c.devis_id = p_devis) then
    return (select c.empreinte from public.devis_copies c where c.bureau = p_bureau and c.devis_id = p_devis);
  end if;
  e := encode(sha256(convert_to(p_papier, 'UTF8')), 'hex');
  insert into public.devis_copies (bureau, devis_id, papier, empreinte, cree_par)
    values (p_bureau, p_devis, p_papier, e, auth.uid());
  update public.devis x set papier_empreinte = e, papier_le = now()
   where x.bureau = p_bureau and x.devis_id = p_devis and x.papier_empreinte is null;
  return e;
end
$$;
-- Appelee par les deux fonctions ci-dessous, jamais par le navigateur.
revoke all on function public.devis_ranger_copie(uuid, uuid, text, text) from public, anon, authenticated;

-- 3. LE GEL, REECRIT (corps du lot 51). Deux ajouts :
--    - l'empreinte se pose une fois et ne change plus ;
--    - un devis ACCEPTE laisse bouger sa trace de telechargement, et rien d'autre.
create or replace function public.devis_signer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare libres text[] := array['statut', 'signe_le', 'accepte_le', 'accepte_par', 'code_tarif',
  'abandonne_le', 'refuse_le', 'refuse_par', 'refuse_motif', 'accord_annule_le', 'accord_annule_par',
  'papier_empreinte', 'papier_le', 'commande_telechargee_le', 'commande_telechargee_par',
  'commande_derniere_le', 'commande_telechargements', 'maj_par', 'maj_le'];
  trace text[] := array['commande_telechargee_le', 'commande_telechargee_par',
  'commande_derniere_le', 'commande_telechargements', 'papier_empreinte', 'papier_le', 'maj_par', 'maj_le'];
begin
  if tg_op = 'INSERT' then
    new.cree_par := coalesce(auth.uid(), new.cree_par); new.cree_le := now();
  else
    new.cree_par := old.cree_par; new.cree_le := old.cree_le;
    if (new.bureau, new.affaire_id, new.annee, new.rang, new.numero, new.date_devis)
       is distinct from (old.bureau, old.affaire_id, old.annee, old.rang, old.numero, old.date_devis) then
      raise exception 'numero et date d''un devis ne changent jamais' using errcode = '23514';
    end if;
    if old.papier_empreinte is not null
       and (new.papier_empreinte, new.papier_le) is distinct from (old.papier_empreinte, old.papier_le) then
      raise exception 'copie du devis : son empreinte ne change plus' using errcode = '23514';
    end if;
    if old.statut = 'abandonne' then
      raise exception 'devis abandonne : il ne se modifie plus' using errcode = '23514';
    end if;
    if old.statut = 'refuse' then
      raise exception 'devis refuse : il ne se modifie plus' using errcode = '23514';
    end if;
    if old.statut = 'accepte'
       and (to_jsonb(new) - trace) is distinct from (to_jsonb(old) - trace)
       and not (new.statut in ('envoye', 'enregistre') and new.accepte_le is null
                and new.accord_annule_le is not null
                and new.accord_annule_le is distinct from old.accord_annule_le
                and (new.statut = 'envoye') = (old.envoye_le is not null)) then
      raise exception 'devis accepte : il ne se modifie plus' using errcode = '23514';
    end if;
    if old.statut <> 'enregistre'
       and (to_jsonb(new) - libres) is distinct from (to_jsonb(old) - libres) then
      raise exception 'devis fige : fais-en une nouvelle version' using errcode = '23514';
    end if;
  end if;
  if auth.uid() is not null then new.maj_par := auth.uid();
  elsif tg_op = 'UPDATE' then new.maj_par := old.maj_par; end if;
  new.maj_le := now();
  return new;
end
$$;
revoke all on function public.devis_signer() from public, anon, authenticated;

-- 4. ENVOYER : le corps du lot 50, plus la copie. Le septieme argument a une valeur par
--    defaut : un navigateur qui ne l'envoie pas marche comme avant.
drop function if exists public.devis_envoyer(uuid, uuid, date, date, text, uuid);
drop function if exists public.devis_envoyer(uuid, uuid, date, date, text, uuid, text);
create function public.devis_envoyer(
  p_bureau uuid, p_devis uuid, p_jour date default null,
  p_rappel date default null, p_rappel_titre text default null, p_etape uuid default null,
  p_papier text default null)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare d public.devis; af public.affaires; jour date; auj date;
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  select * into d from public.devis x
   where x.bureau = p_bureau and x.devis_id = p_devis for update;
  if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
  if d.statut = 'envoye' then return d; end if;
  if d.statut <> 'enregistre' then
    raise exception 'devis non envoyable : il n''est plus en cours' using errcode = '23514';
  end if;
  select * into af from public.affaires x
   where x.bureau = p_bureau and x.affaire_id = d.affaire_id for update;
  if af.issue <> 'en_cours' then raise exception 'affaire close' using errcode = '23514'; end if;

  auj := public.devis_jour(now());
  jour := coalesce(p_jour, auj);
  if jour > auj then raise exception 'date d''envoi dans le futur' using errcode = '23514'; end if;
  if jour < d.date_devis then raise exception 'date d''envoi avant le devis' using errcode = '23514'; end if;
  if p_rappel is not null and p_rappel < jour then
    raise exception 'rappel avant l''envoi' using errcode = '23514';
  end if;

  -- La copie AVANT le changement de statut : elle est le devis tel qu'il part.
  perform public.devis_ranger_copie(p_bureau, d.devis_id, d.numero, p_papier);

  update public.devis x set statut = 'envoye', envoye_le = jour, envoye_par = auth.uid()
   where x.bureau = p_bureau and x.devis_id = d.devis_id
  returning * into d;

  if p_rappel is not null or p_etape is not null then
    update public.affaires x
       set rappel = coalesce(p_rappel, x.rappel),
           rappel_titre = case when p_rappel is null then x.rappel_titre
             else left(coalesce(nullif(btrim(p_rappel_titre), ''), 'Relancer le devis ' || d.numero), 120) end,
           etape_id = coalesce(p_etape, x.etape_id)
     where x.bureau = p_bureau and x.affaire_id = af.affaire_id;
  end if;
  return d;
end
$$;
revoke all on function public.devis_envoyer(uuid, uuid, date, date, text, uuid, text) from public, anon, authenticated;
grant execute on function public.devis_envoyer(uuid, uuid, date, date, text, uuid, text) to authenticated;

-- 5. ACCEPTER : le corps du lot 50, plus la copie d'un devis ENVOYE qui n'en a pas encore
--    (envoye avant ce lot, ou copie ratee a l'envoi).
drop function if exists public.devis_accepter(uuid, uuid);
drop function if exists public.devis_accepter(uuid, uuid, text);
create function public.devis_accepter(p_bureau uuid, p_devis uuid, p_papier text default null)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare d public.devis; af public.affaires; n_sans integer; v_tarif text;
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  select * into d from public.devis x
   where x.bureau = p_bureau and x.devis_id = p_devis for update;
  if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
  if d.statut = 'accepte' then return d; end if;
  if d.statut not in ('enregistre', 'envoye') then
    raise exception 'devis non acceptable : il n''est plus en cours' using errcode = '23514';
  end if;

  select * into af from public.affaires x
   where x.bureau = p_bureau and x.affaire_id = d.affaire_id for update;
  if af.issue = 'perdue' then raise exception 'affaire close' using errcode = '23514'; end if;
  if exists (select 1 from public.devis x where x.bureau = p_bureau
               and x.affaire_id = d.affaire_id and x.statut = 'accepte') then
    raise exception 'affaire deja commandee' using errcode = '23514';
  end if;

  select count(*) into n_sans from public.devis_lignes x
   where x.bureau = p_bureau and x.devis_id = d.devis_id
     and nullif(btrim(coalesce(x.num_produit, '')), '') is null;
  if n_sans > 0 then
    raise exception 'ligne sans numero produit' using errcode = '23514';
  end if;
  if not coalesce((d.acheteur->>'nouveau')::boolean, false)
     and nullif(btrim(coalesce(d.num_client, d.acheteur->>'num_client', '')), '') is null
     and nullif(btrim(coalesce(d.acheteur->>'email', '')), '') is null then
    raise exception 'client sans numero ni e-mail' using errcode = '23514';
  end if;

  if d.client_cle is not null then
    select (array_agg(btrim(l.code_tarif) order by l.le_jour desc nulls last)
              filter (where nullif(btrim(l.code_tarif), '') is not null))[1]
      into v_tarif
      from public.ventes_lignes l
     where l.bureau = p_bureau and l.client_cle = d.client_cle;
  end if;

  -- Seulement un devis ENVOYE : un devis accepte sans envoi peut revenir enregistre (annulation)
  -- puis changer, et sa copie mentirait. Il n'a de toute facon pas ete remis au client.
  if d.papier_empreinte is null and d.statut = 'envoye' then
    perform public.devis_ranger_copie(p_bureau, d.devis_id, d.numero, p_papier);
  end if;

  update public.devis x
     set statut = 'accepte', accepte_le = now(), accepte_par = auth.uid(),
         code_tarif = left(v_tarif, 40)
   where x.bureau = p_bureau and x.devis_id = d.devis_id
  returning * into d;

  if af.issue = 'en_cours' then
    update public.affaires x set issue = 'gagnee'
     where x.bureau = p_bureau and x.affaire_id = af.affaire_id;
  end if;
  return d;
end
$$;
revoke all on function public.devis_accepter(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.devis_accepter(uuid, uuid, text) to authenticated;

-- 6. LA TRACE DU FICHIER DE COMMANDE
-- Refus : 42501 hors du bureau ; P0002 devis introuvable ; 23514 devis qui n'est pas accepte.
drop function if exists public.devis_noter_telechargement(uuid, uuid);
create function public.devis_noter_telechargement(p_bureau uuid, p_devis uuid)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare d public.devis;
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  select * into d from public.devis x
   where x.bureau = p_bureau and x.devis_id = p_devis for update;
  if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
  if d.statut <> 'accepte' then
    raise exception 'devis non accepte : pas de commande' using errcode = '23514';
  end if;
  update public.devis x
     set commande_telechargee_le  = coalesce(x.commande_telechargee_le, now()),
         commande_telechargee_par = case when x.commande_telechargee_le is null then auth.uid() else x.commande_telechargee_par end,
         commande_derniere_le     = now(),
         commande_telechargements = x.commande_telechargements + 1
   where x.bureau = p_bureau and x.devis_id = d.devis_id
  returning * into d;
  return d;
end
$$;
revoke all on function public.devis_noter_telechargement(uuid, uuid) from public, anon, authenticated;
grant execute on function public.devis_noter_telechargement(uuid, uuid) to authenticated;
