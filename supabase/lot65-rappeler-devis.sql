-- ============================================================================
-- LOT 65 : RAPPELER UN DEVIS ENVOYE, 05/10/2026
-- ============================================================================
-- A coller dans Supabase (SQL Editor) APRES lot64-objets.sql. Rejouable.
-- Il ne touche qu'aux objets des lots 47 a 55 (devis, copies, liens, signature).
--
-- Decisions de Ted du 05/10/2026 :
--   1. « RAPPELER » un devis envoye : le lien de signature ne marche plus, et le devis
--      redevient modifiable SOUS LE MEME NUMERO.
--   2. IMPOSSIBLE S'IL A ETE SIGNE : une preuve de signature existe, meme si
--      l'acceptation a ete annulee depuis (lot 51).
--   3. Le papier dit la VERSION (« D-2026-0007, version 2 ») et chaque version envoyee
--      garde sa copie : le numero ne change pas, et on sait toujours quel papier le
--      client a eu en main.
--
-- Deux refus en plus, poses ici et a faire valider par Ted :
--   - une commande deja TELECHARGEE pour Vitisoft (devis accepte puis annule) : Vitisoft
--     refuse un numero deja importe (erreur 12), le devis corrige ne pourrait jamais y
--     entrer. Celui-la se refait sous un nouveau numero ;
--   - une affaire close.
-- La version 2 est DATEE du jour du rappel (sa validite repart de ce jour) : un devis
-- expire peut ainsi etre corrige et renvoye. Une date de livraison souhaitee deja passee
-- est effacee (elle serait avant la nouvelle date du devis).
-- ============================================================================

-- 1. LES COLONNES DU DEVIS
alter table public.devis add column if not exists version smallint not null default 1;
alter table public.devis drop constraint if exists devis_version;
alter table public.devis add constraint devis_version check (version between 1 and 99);
alter table public.devis add column if not exists rappele_le  timestamptz;
alter table public.devis add column if not exists rappele_par uuid references auth.users(id) on delete set null;

-- 2. UNE COPIE PAR VERSION. La cle passe de (bureau, devis) a (bureau, devis, version) ;
--    les copies deja rangees sont la version 1.
alter table public.devis_copies add column if not exists version smallint not null default 1;
do $$
declare n text; k int;
begin
  select c.conname, array_length(c.conkey, 1) into n, k
    from pg_constraint c where c.conrelid = 'public.devis_copies'::regclass and c.contype = 'p';
  if k is distinct from 3 then
    if n is not null then execute format('alter table public.devis_copies drop constraint %I', n); end if;
    alter table public.devis_copies add constraint devis_copies_pkey primary key (bureau, devis_id, version);
  end if;
end $$;

-- 3. LE RANGEMENT : la copie de la version EN COURS du devis. Corps du lot 52, plus la version.
create or replace function public.devis_ranger_copie(p_bureau uuid, p_devis uuid, p_numero text, p_papier text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare e text; v smallint;
begin
  select x.version into v from public.devis x where x.bureau = p_bureau and x.devis_id = p_devis;
  if v is null or p_papier is null or octet_length(p_papier) not between 500 and 600000
     or lower(left(btrim(p_papier), 15)) <> '<!doctype html>'
     or position(('Devis ' || p_numero) in p_papier) = 0
     or p_papier ~* '<\s*script' then
    return null;
  end if;
  if exists (select 1 from public.devis_copies c where c.bureau = p_bureau and c.devis_id = p_devis and c.version = v) then
    return (select c.empreinte from public.devis_copies c where c.bureau = p_bureau and c.devis_id = p_devis and c.version = v);
  end if;
  e := encode(sha256(convert_to(p_papier, 'UTF8')), 'hex');
  insert into public.devis_copies (bureau, devis_id, version, papier, empreinte, cree_par)
    values (p_bureau, p_devis, v, p_papier, e, auth.uid());
  update public.devis x set papier_empreinte = e, papier_le = now()
   where x.bureau = p_bureau and x.devis_id = p_devis and x.papier_empreinte is null;
  return e;
end
$$;
revoke all on function public.devis_ranger_copie(uuid, uuid, text, text) from public, anon, authenticated;

-- 4. LE GEL, REECRIT (corps du lot 52). UN seul passage nouveau : le RAPPEL, reconnu a sa
--    forme exacte. Envoye vers enregistre, version + 1, envoi et empreinte effaces, date
--    qui avance ou reste, et rien d'autre que ces colonnes-la. Tout le reste ne change pas.
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
  rappel text[] := array['statut', 'version', 'rappele_le', 'rappele_par', 'envoye_le', 'envoye_par',
  'papier_empreinte', 'papier_le', 'date_devis', 'valable_jusqu', 'livraison_souhaitee', 'maj_par', 'maj_le'];
  est_rappel boolean := false;
begin
  if tg_op = 'INSERT' then
    new.cree_par := coalesce(auth.uid(), new.cree_par); new.cree_le := now();
    new.version := 1; new.rappele_le := null; new.rappele_par := null;
  else
    new.cree_par := old.cree_par; new.cree_le := old.cree_le;
    est_rappel := old.statut = 'envoye' and new.statut = 'enregistre'
      and new.version = old.version + 1
      and new.rappele_le is not null and new.rappele_le is distinct from old.rappele_le
      and new.envoye_le is null and new.envoye_par is null
      and new.papier_empreinte is null and new.papier_le is null
      and new.date_devis between old.date_devis and greatest(old.date_devis, public.devis_jour(now()))
      and (new.livraison_souhaitee is not distinct from old.livraison_souhaitee or new.livraison_souhaitee is null)
      and (to_jsonb(new) - rappel) = (to_jsonb(old) - rappel);
    if (new.bureau, new.affaire_id, new.annee, new.rang, new.numero)
       is distinct from (old.bureau, old.affaire_id, old.annee, old.rang, old.numero)
       or (new.date_devis is distinct from old.date_devis and not est_rappel) then
      raise exception 'numero et date d''un devis ne changent jamais' using errcode = '23514';
    end if;
    if new.version is distinct from old.version and not est_rappel then
      raise exception 'version d''un devis : elle ne change que par un rappel' using errcode = '23514';
    end if;
    if (new.rappele_le, new.rappele_par) is distinct from (old.rappele_le, old.rappele_par) and not est_rappel then
      raise exception 'rappel d''un devis : il ne se pose que par devis_rappeler' using errcode = '23514';
    end if;
    if old.papier_empreinte is not null and not est_rappel
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
    if old.statut <> 'enregistre' and not est_rappel
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

-- 5. RAPPELER. Refus : 42501 hors du bureau ; P0002 devis introuvable ; 23514 devis qui
--    n'est pas envoye, affaire close, devis signe, commande deja telechargee.
--    Un devis deja revenu « enregistre » est rendu tel quel (double clic).
drop function if exists public.devis_rappeler(uuid, uuid);
create function public.devis_rappeler(p_bureau uuid, p_devis uuid)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare d public.devis; af public.affaires; auj date;
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  select * into d from public.devis x
   where x.bureau = p_bureau and x.devis_id = p_devis for update;
  if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
  if d.statut = 'enregistre' then return d; end if;
  if d.statut <> 'envoye' then
    raise exception 'devis non rappelable : il n''est pas envoye' using errcode = '23514';
  end if;
  select * into af from public.affaires x
   where x.bureau = p_bureau and x.affaire_id = d.affaire_id for update;
  if af.issue <> 'en_cours' then raise exception 'affaire close' using errcode = '23514'; end if;
  if exists (select 1 from public.devis_signatures s where s.bureau = p_bureau and s.devis_id = d.devis_id) then
    raise exception 'devis signe : il ne se rappelle pas' using errcode = '23514';
  end if;
  if d.commande_telechargements > 0 then
    raise exception 'commande deja telechargee : refais-le sous un nouveau numero' using errcode = '23514';
  end if;
  if d.version >= 99 then raise exception 'trop de versions' using errcode = '23514'; end if;

  -- Le lien d'abord : plus personne ne signe la version qui part a la corbeille.
  update public.devis_liens x set remplace_le = now()
   where x.bureau = p_bureau and x.devis_id = d.devis_id and x.remplace_le is null;

  auj := public.devis_jour(now());
  update public.devis x
     set statut = 'enregistre', version = x.version + 1,
         rappele_le = now(), rappele_par = auth.uid(),
         envoye_le = null, envoye_par = null, papier_empreinte = null, papier_le = null,
         date_devis = greatest(auj, x.date_devis),
         valable_jusqu = case when x.valable_jusqu is null then null
                              else greatest(auj, x.date_devis) + (x.valable_jusqu - x.date_devis) end,
         -- Une livraison souhaitee avant la nouvelle date du devis n'a plus de sens (et la
         -- contrainte du lot 53 la refuserait) : elle est effacee, l'ecran le dit.
         livraison_souhaitee = case when x.livraison_souhaitee < greatest(auj, x.date_devis) then null
                                    else x.livraison_souhaitee end
   where x.bureau = p_bureau and x.devis_id = d.devis_id
  returning * into d;
  return d;
end
$$;
revoke all on function public.devis_rappeler(uuid, uuid) from public, anon, authenticated;
grant execute on function public.devis_rappeler(uuid, uuid) to authenticated;

-- 6. CE QUE VOIT LE CLIENT : corps du lot 55, la copie de la version EN COURS (par son
--    empreinte), et la version dans la reponse.
drop function if exists public.signature_lire(text);
create function public.signature_lire(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare l public.devis_liens; d public.devis; s public.devis_signatures; af public.affaires; dom jsonb; etat text; pap text;
begin
  if p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then return jsonb_build_object('etat', 'inconnu'); end if;
  select * into l from public.devis_liens x where x.jeton_hash = encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex');
  if not found then return jsonb_build_object('etat', 'inconnu'); end if;
  select * into d from public.devis x where x.bureau = l.bureau and x.devis_id = l.devis_id;
  select * into s from public.devis_signatures x where x.lien_id = l.lien_id;
  select * into af from public.affaires x where x.bureau = l.bureau and x.affaire_id = d.affaire_id;
  dom := d.vendeur;
  if s.lien_id is not null then etat := 'signe';
  elsif l.remplace_le is not null or d.statut <> 'envoye' or af.issue <> 'en_cours' then etat := 'clos';
  elsif d.valable_jusqu is not null and d.valable_jusqu < public.devis_jour(now()) then etat := 'expire';
  elsif public.devis_obstacle(l.bureau, d.devis_id) is not null then etat := 'clos';
  else etat := 'a_signer';
  end if;
  if etat in ('clos', 'expire') then
    return jsonb_build_object('etat', etat, 'numero', d.numero,
      'vendeur', coalesce(dom->>'raison_sociale', dom->>'nom', ''), 'vendeur_email', dom->>'email',
      'valable_jusqu', d.valable_jusqu);
  end if;
  select c.papier into pap from public.devis_copies c
   where c.bureau = l.bureau and c.devis_id = d.devis_id
     and c.empreinte = coalesce(s.papier_empreinte, d.papier_empreinte)
   order by c.version desc limit 1;
  return jsonb_build_object(
    'etat', etat,
    'numero', d.numero,
    'version', d.version,
    'vendeur', coalesce(dom->>'raison_sociale', dom->>'nom', ''),
    'vendeur_email', dom->>'email',
    'client', coalesce(d.acheteur->>'nom', ''),
    'total_ht_c', d.total_ht_c,
    'total_ttc_c', d.total_ttc_c,
    'valable_jusqu', d.valable_jusqu,
    'empreinte', d.papier_empreinte,
    'papier', pap,
    'signe_le', s.signe_le,
    'signe_nom', s.nom,
    'signe_qualite', s.qualite);
end
$$;
revoke all on function public.signature_lire(text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.signature_lire(text) to service_role;
  end if;
end $$;

-- CONTROLES, a lancer apres (ils ne modifient rien)
-- 1) select pronargs from pg_proc where proname = 'devis_rappeler';                       -> 2
-- 2) select array_length(conkey, 1) from pg_constraint
--     where conrelid = 'public.devis_copies'::regclass and contype = 'p';                 -> 3
-- 3) select has_function_privilege('anon', 'public.devis_rappeler(uuid, uuid)', 'execute'); -> false
