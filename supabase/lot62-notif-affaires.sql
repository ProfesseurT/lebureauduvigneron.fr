-- ===========================================================================
-- LOT 62 : LES AFFAIRES DES COLLEGUES, LES APPAREILS, LE RENOUVELLEMENT (05/10/2026)
-- ===========================================================================
-- Cinquieme et dernier lot du chantier des notifications (CLAUDE.md, « LES NOTIFICATIONS ET
-- LEURS REGLAGES »).
--   1. Une notification quand un COLLEGUE gagne une affaire (case cochee par defaut, decision
--      de Ted) ou la perd (decochee par defaut). Jamais a celui qui a fait le geste : ce que
--      j'ai fait moi-meme n'est jamais une nouvelle (lot 57). Le mail, lui, ne change pas :
--      la gagnee garde son mail reglable, la perdue n'en a JAMAIS (decision de Ted).
--   2. `push_remplacer()` : quand un navigateur change tout seul l'adresse d'envoi d'un
--      appareil, son recepteur (/sw.js) la remplace ici, sans compte connecte. La preuve
--      qu'il en a le droit : il connait l'ancienne adresse, qu'aucun navigateur ne peut lire
--      pour un autre. Une adresse retiree a distance n'est jamais recreee par ce chemin.
--
-- A COLLER PAR TED DANS SUPABASE, APRES LE LOT 61. Rejouable. Puis pousser, puis
-- redeployer `notif-commerce`.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. LES DEUX CASES
-- ---------------------------------------------------------------------------
alter table public.profils add column if not exists notif_push_gagnee boolean not null default true;
alter table public.profils add column if not exists notif_push_perdue boolean not null default false;
grant update (notif_push_gagnee, notif_push_perdue) on public.profils to authenticated;

-- ---------------------------------------------------------------------------
-- 2. CE QUE DIT LE DETAIL : la perdue revient, sans destinataire de mail
-- ---------------------------------------------------------------------------
-- Identique au lot 58, sauf : une perdue rend son detail (pour la notification) avec une
-- liste de mails VIDE, et le detail porte `close_par` (pour ne pas notifier l'auteur).
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

  -- LOT 58 : seuls ceux qui ont laisse la case de cette sorte cochee. L'auteur du geste
  -- compris : s'il a decoche, il n'a pas non plus sa confirmation (decision de Ted).
  select coalesce(jsonb_agg(jsonb_build_object(
           'email', pr.email,
           'prenom', coalesce(nullif(btrim(pr.prenom), ''), split_part(pr.email, '@', 1))) order by pr.email), '[]'::jsonb)
    into v_dest
    from public.membres m join public.profils pr on pr.id = m.personne
   where m.bureau = p_bureau and pr.email is not null and pr.email like '%@%'
     and case v_sorte when 'signe' then pr.notif_mail_signe when 'gagnee' then pr.notif_mail_gagnee
                      else false end;  -- LOT 62 : une perdue n'a JAMAIS de destinataire de mail

  return jsonb_build_object(
    'cle', p_affaire::text || ':' || to_char(a.close_le at time zone 'UTC', 'YYYYMMDDHH24MISSUS'),
    'sorte', v_sorte, 'bureau_nom', v_bureau,
    'affaire_id', a.affaire_id, 'titre', a.titre, 'motif', a.motif, 'close_le', a.close_le,
    'client', v_client, 'type', v_type, 'par', v_par, 'close_par', a.close_par,
    'devis', case when d.devis_id is null then null else jsonb_build_object(
       'devis_id', d.devis_id, 'numero', d.numero, 'total_ht_c', d.total_ht_c, 'total_ttc_c', d.total_ttc_c,
       'signe_le', d.signe_le, 'lignes', v_lignes,
       'signataire', case when v_sig_nom is null then null else jsonb_build_object('nom', v_sig_nom, 'qualite', v_sig_qual) end) end,
    'destinataires', v_dest);
end $$;
revoke all on function public.notif_detail(uuid, uuid) from public, anon, authenticated;

-- Le declencheur reprend la perdue : c'est la notification qui en a besoin, pas le mail.
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
    -- Un envoi qui ne part pas ne doit JAMAIS empecher de clore une affaire.
    null;
  end;
  return null;
end $$;
revoke all on function public.affaires_notifier() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. LES APPAREILS, SELON LA SORTE, SAUF L'AUTEUR
-- ---------------------------------------------------------------------------
drop function if exists public.push_cibles(uuid, text);
create or replace function public.push_cibles(p_bureau uuid, p_sorte text default 'signe', p_sauf uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth)
                            order by a.vu_le desc), '[]'::jsonb)
    from public.push_abonnements a
    join public.profils pr on pr.id = a.personne
   where a.personne in (select m.personne from public.membres m where m.bureau = p_bureau)
     and a.personne is distinct from p_sauf
     and case p_sorte when 'signe'  then pr.notif_push_signe
                      when 'gagnee' then pr.notif_push_gagnee
                      when 'perdue' then pr.notif_push_perdue
                      else false end
$$;
revoke all on function public.push_cibles(uuid, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. LE RENOUVELLEMENT D'UNE ADRESSE, PAR LE RECEPTEUR
-- ---------------------------------------------------------------------------
create or replace function public.push_remplacer(p_ancien text, p_nouveau text, p_p256dh text, p_auth text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_personne uuid; v_appareil text; v_cree timestamptz;
begin
  if not public.push_adresse_valide(p_nouveau) then return false; end if;
  if p_ancien is null or p_ancien = p_nouveau then return false; end if;
  select a.personne, a.appareil, a.cree_le into v_personne, v_appareil, v_cree from public.push_abonnements a where a.endpoint = p_ancien;
  -- Inconnue (retiree a distance, ou jamais rangee) : rien n'est cree.
  if not found then return false; end if;
  -- La nouvelle adresse est deja rangee pour QUELQU'UN D'AUTRE : refus, rien ne bouge.
  -- (Sinon, connaitre sa propre adresse suffirait a prendre celle d'un collegue.)
  if exists (select 1 from public.push_abonnements x
              where x.endpoint = p_nouveau and x.personne <> v_personne) then
    return false;
  end if;
  delete from public.push_abonnements where endpoint = p_ancien;
  -- Deja rangee pour la meme personne : on garde la ligne telle quelle.
  -- La date d'ajout suit l'appareil : elle ne repart pas au remplacement.
  insert into public.push_abonnements (endpoint, personne, p256dh, auth, appareil, cree_le)
  values (p_nouveau, v_personne, p_p256dh, p_auth, v_appareil, v_cree)
  on conflict (endpoint) do nothing;
  return true;
end $$;
revoke all on function public.push_remplacer(text, text, text, text) from public;
grant execute on function public.push_remplacer(text, text, text, text) to anon, authenticated;

-- Le navigateur liste SES appareils (deja permis par le lot 59) et en retire un avec
-- push_retirer (lot 59 aussi) : rien a ajouter cote droits.

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.notif_detail(uuid, uuid) to service_role;
    grant execute on function public.push_cibles(uuid, text, uuid) to service_role;
  end if;
end $$;

-- CONTROLES
--   select column_name from information_schema.columns where table_name = 'profils' and column_name in ('notif_push_gagnee','notif_push_perdue');  -- 2
--   select has_function_privilege('anon', 'public.push_remplacer(text,text,text,text)', 'execute');  -- true
