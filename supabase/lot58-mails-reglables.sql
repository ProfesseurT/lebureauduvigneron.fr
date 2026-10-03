-- ===========================================================================
-- LOT 58 : LES MAILS DES NOUVELLES SE REGLENT, ET LA PERDUE N'EN ENVOIE PLUS (03/10/2026)
-- ===========================================================================
-- Decisions de Ted du 03/10/2026 (CLAUDE.md, « LES NOTIFICATIONS ET LEURS REGLAGES ») :
--   - une affaire PERDUE n'envoie JAMAIS de mail. Elle reste dans les nouvelles de
--     « Mon commerce » (pastille, points, liste), qui ne passent pas par ce lot ;
--   - le mail « devis signe en ligne » et le mail « affaire gagnee » restent, mais chacun
--     peut les couper pour lui-meme, dans l'onglet « Le courrier » des reglages ;
--   - l'interrupteur coupe AUSSI la confirmation que recoit l'auteur du geste. Pas de
--     deuxieme case.
--
-- A COLLER PAR TED DANS SUPABASE, APRES LE LOT 57, ET AVANT DE POUSSER LE CODE. Rejouable.
-- La fonction `notif-commerce` ne decide de rien, tout se joue ici. Elle se REDEPLOIE
-- quand meme, une fois, pour son pied de mail (« Tout le bureau le recoit » devenu faux).
--
-- CE QUE FAIT CE LOT
--   1. Deux colonnes sur `profils`, cochees par defaut : ne rien toucher garde le
--      comportement du lot 57 pour la signature et la gagnee.
--   2. `notif_detail()` rend null pour une perdue, et ne garde dans les destinataires que
--      ceux qui ont laisse la case de CETTE sorte cochee.
--   3. Le declencheur n'appelle plus la fonction d'envoi pour une perdue : un appel qui
--      n'enverrait rien ne part pas.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. LES DEUX CASES, UNE PAR PERSONNE
-- ---------------------------------------------------------------------------
alter table public.profils add column if not exists notif_mail_signe  boolean not null default true;
alter table public.profils add column if not exists notif_mail_gagnee boolean not null default true;

-- Meme modele que `consent_courrier` (lot 12) : un droit d'ecriture par COLONNE. La regle
-- « modifier sa fiche » borne deja a SA ligne.
grant update (notif_mail_signe, notif_mail_gagnee) on public.profils to authenticated;

-- ---------------------------------------------------------------------------
-- 2. CE QUE DIT LE MAIL, ET A QUI
-- ---------------------------------------------------------------------------
-- Identique au lot 57, sauf deux endroits marques « LOT 58 ».
create or replace function public.notif_detail(p_bureau uuid, p_affaire uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  a record; d record; v_sig_nom text; v_sig_qual text; v_sorte text; v_client text; v_type text; v_par text;
  v_bureau text; v_lignes jsonb; v_dest jsonb;
begin
  select x.* into a from public.affaires x where x.bureau = p_bureau and x.affaire_id = p_affaire;
  if not found or a.issue = 'en_cours' or a.close_le is null then return null; end if;

  -- LOT 58 : une perdue n'envoie jamais de mail (decision de Ted du 03/10/2026).
  if a.issue = 'perdue' then return null; end if;

  select x.* into d from public.devis x
   where x.bureau = p_bureau and x.affaire_id = p_affaire and x.statut = 'accepte'
   order by x.accepte_le desc nulls last limit 1;

  v_sorte := case
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
     and case v_sorte when 'signe' then pr.notif_mail_signe else pr.notif_mail_gagnee end;

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
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. LE DECLENCHEUR NE PREVIENT PLUS POUR UNE PERDUE
-- ---------------------------------------------------------------------------
create or replace function public.affaires_notifier()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.issue = 'en_cours' or (tg_op = 'UPDATE' and old.issue <> 'en_cours') then return null; end if;
  -- LOT 58 : une perdue n'envoie jamais de mail, inutile de reveiller la fonction.
  if new.issue = 'perdue' then return null; end if;
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

-- CONTROLES (a lancer apres avoir colle, chacun doit dire ce qui est annonce)
--   select column_name, column_default from information_schema.columns
--    where table_name = 'profils' and column_name like 'notif_mail_%';          -- 2 lignes, true
--   select count(*) from public.profils where not notif_mail_signe or not notif_mail_gagnee;  -- 0
--   select has_column_privilege('authenticated', 'public.profils', 'notif_mail_signe', 'update'); -- true
