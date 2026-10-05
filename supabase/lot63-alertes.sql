-- ===========================================================================
-- LOT 63 : MES ALERTES, UN TABLEAU MAIL x NOTIFICATION (05/10/2026)
-- ===========================================================================
-- Demande de Ted : centraliser dans « Le courrier » un tableau qui dit, pour chaque
-- evenement, s'il part par mail, par notification, ou les deux. Et lisser : chaque
-- evenement existe sur les deux supports.
--   1. Quatre cases de mail, DECOCHEES par defaut : affaire perdue (Ted revient sur
--      « jamais de mail pour une perdue » : c'est desormais un choix de chacun),
--      echeance qui coute une amende (7 h 30), devis qui expire demain (7 h 30),
--      rappels du jour pas faits (17 h 30).
--   2. notif_detail : la perdue a des destinataires, ceux qui ont coche sa case.
--   3. notif_horaire_lots : le matin et le soir rendent aussi un mail par personne,
--      avec le DETAIL (noms, numeros, montants), reserve dans son propre journal.
--
-- A COLLER PAR TED DANS SUPABASE, APRES LE LOT 62. Rejouable. Puis pousser, puis
-- redeployer `notif-horaire` (qui envoie maintenant aussi des mails).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. LES QUATRE CASES DE MAIL
-- ---------------------------------------------------------------------------
alter table public.profils add column if not exists notif_mail_perdue boolean not null default false;
alter table public.profils add column if not exists notif_mail_echeance boolean not null default false;
alter table public.profils add column if not exists notif_mail_devis_expire boolean not null default false;
alter table public.profils add column if not exists notif_mail_rappels boolean not null default false;
grant update (notif_mail_perdue, notif_mail_echeance, notif_mail_devis_expire, notif_mail_rappels)
  on public.profils to authenticated;

-- ---------------------------------------------------------------------------
-- 2. LA PERDUE A SES DESTINATAIRES (ceux qui ont coche)
-- ---------------------------------------------------------------------------
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
     and case v_sorte when 'signe'  then pr.notif_mail_signe
                      when 'gagnee' then pr.notif_mail_gagnee
                      when 'perdue' then pr.notif_mail_perdue
                      else false end;

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

-- ---------------------------------------------------------------------------
-- 3. LE JOURNAL DES MAILS DU MATIN ET DU SOIR : un mail par personne, jour, moment
-- ---------------------------------------------------------------------------
create table if not exists public.notif_mail_journal (
  personne  uuid not null references auth.users(id) on delete cascade,
  jour      date not null,
  moment    text not null check (moment in ('matin', 'soir')),
  sujet     text,
  envoye_le timestamptz,
  echec     text,
  cree_le   timestamptz not null default now(),
  primary key (personne, jour, moment)
);
alter table public.notif_mail_journal enable row level security;
revoke all on public.notif_mail_journal from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. CE QUI PART LE MATIN ET LE SOIR : notification ET mail, decides et reserves ici
-- ---------------------------------------------------------------------------
-- Un element par personne a prevenir : `message` + `cibles` si une notification part,
-- `mail` si un mail part (adresse, prenom, bureau, et le detail par rubrique). Chaque
-- support a son journal, pose AVANT de rendre la liste : deux passages n'envoient
-- jamais deux fois. La notification ne porte ni nom ni montant ; le mail porte le detail.
-- p_plafond : le nombre de mails du matin et du soir PAR JOUR, tous comptes confondus
-- (le banc le met a 1 pour le tester). L'ancienne version a deux arguments disparait : une
-- seule fonction de ce nom, aucun appel ambigu.
drop function if exists public.notif_horaire_lots(text, timestamptz);
create or replace function public.notif_horaire_lots(p_moment text, p_maintenant timestamptz default now(),
                                                     p_plafond int default 20)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_jour date := (p_maintenant at time zone 'Europe/Paris')::date;
  v_lots jsonb := '[]'::jsonb;
  r record; v_items text[]; v_nb int; v_cibles jsonb; v_titre text; v_corps text; v_ech record;
  v_lot jsonb; v_mail jsonb; m_ech jsonb; m_dev jsonb; m_rap jsonb; v_sujet text; v_n int;
  -- Le plafond gratuit de Resend : 100 mails par jour, PARTAGES avec les codes d'inscription,
  -- les mails immediats (notif-commerce) et le courrier du matin (40 au plus). Ces mails-ci en
  -- prennent p_plafond PAR JOUR (matin et soir ensemble, 20 par defaut) : il en reste 40 pour
  -- le reste. Au-dela, on ne reserve plus, et le passage le compte (plafonnes).
  v_mails int := (select count(*) from public.notif_mail_journal j where j.jour = (p_maintenant at time zone 'Europe/Paris')::date);
  v_plafonnes int := 0;
begin
  if p_moment not in ('matin', 'soir') then raise exception 'moment inconnu' using errcode = '22023'; end if;

  for r in
    select pr.id as personne, pr.bureau_courant as bureau, pr.email,
           coalesce(nullif(btrim(pr.prenom), ''), split_part(pr.email, '@', 1)) as prenom,
           pr.notif_push_signe, pr.notif_push_echeance, pr.notif_push_devis_expire, pr.notif_push_rappels,
           pr.notif_mail_echeance, pr.notif_mail_devis_expire, pr.notif_mail_rappels,
           exists (select 1 from public.push_abonnements a where a.personne = pr.id) as appareils,
           (select b.nom from public.bureaux b where b.bureau = pr.bureau_courant) as bureau_nom
      from public.profils pr
     where pr.bureau_courant is not null
       and exists (select 1 from public.membres m where m.bureau = pr.bureau_courant and m.personne = pr.id)
  loop
    v_lot := null;

    -- ======================= LA NOTIFICATION (inchange, lot 61) =======================
    v_items := '{}';
    if r.appareils then
      if p_moment = 'matin' then
        if r.notif_push_echeance then
          for v_ech in
            select o.court, 'demain' as quand from public.notif_obligations_du(v_jour + 1) o
             where not exists (select 1 from public.taches t where t.bureau = r.bureau
                                 and t.tache_id = 'ech:' || o.cle || ':' || to_char(v_jour + 1, 'YYYY-MM-DD') and t.fait_le is not null)
            union all
            select o.court, 'aujourd''hui' from public.notif_obligations_du(v_jour) o
             where not exists (select 1 from public.taches t where t.bureau = r.bureau
                                 and t.tache_id = 'ech:' || o.cle || ':' || to_char(v_jour, 'YYYY-MM-DD') and t.fait_le is not null)
          loop
            v_items := v_items || (v_ech.court || ' à faire ' || v_ech.quand);
          end loop;
        end if;
        if r.notif_push_devis_expire then
          select count(*) into v_nb from public.devis d
           where d.bureau = r.bureau and d.statut = 'envoye' and d.valable_jusqu = v_jour + 1;
          if v_nb = 1 then v_items := v_items || 'Un devis expire demain sans réponse'::text;
          elsif v_nb > 1 then v_items := v_items || (v_nb || ' devis expirent demain sans réponse'); end if;
        end if;
        if r.notif_push_signe then
          select count(*) into v_nb from public.notif_envois e
           where e.bureau in (select m.bureau from public.membres m where m.personne = r.personne)
             and e.sorte = 'signe' and e.push_differe
             and e.demande_le > p_maintenant - interval '14 hours';
          if v_nb = 1 then v_items := v_items || 'Un devis a été signé cette nuit'::text;
          elsif v_nb > 1 then v_items := v_items || (v_nb || ' devis ont été signés cette nuit'); end if;
        end if;
      else
        if r.notif_push_rappels then
          select (select count(*) from public.suivi_clients s
                   where s.bureau = r.bureau and s.rappel = v_jour and coalesce(s.statut, '') <> 'traite')
               + (select count(*) from public.affaires a
                   where a.bureau = r.bureau and a.rappel = v_jour and a.issue = 'en_cours')
            into v_nb;
          if v_nb = 1 then v_items := v_items || 'Un rappel promis pour aujourd''hui n''est pas fait'::text;
          elsif v_nb > 1 then v_items := v_items || (v_nb || ' rappels promis pour aujourd''hui ne sont pas faits'); end if;
        end if;
      end if;
    end if;

    if cardinality(v_items) > 0 then
      if cardinality(v_items) = 1 then
        v_titre := v_items[1] || '.';
        v_corps := 'Ouvre ton bureau pour t''en occuper.';
      else
        v_titre := cardinality(v_items) || ' choses ce matin';
        v_corps := array_to_string(v_items, '. ') || '.';
      end if;
      select coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth)
                                order by a.vu_le desc), '[]'::jsonb)
        into v_cibles from public.push_abonnements a where a.personne = r.personne;
      insert into public.push_journal (personne, jour, moment, titre, appareils)
      values (r.personne, v_jour, p_moment, v_titre, jsonb_array_length(v_cibles))
      on conflict do nothing;
      if found then
        v_lot := jsonb_build_object(
          'message', jsonb_build_object('titre', v_titre, 'corps', v_corps, 'url', '/mon-bureau/',
                                        'tag', p_moment || '-' || to_char(v_jour, 'YYYY-MM-DD')),
          'cibles', v_cibles);
      end if;
    end if;

    -- ======================= LE MAIL (lot 63), avec le detail =======================
    m_ech := '[]'::jsonb; m_dev := '[]'::jsonb; m_rap := '[]'::jsonb;
    if r.email is not null and r.email like '%@%' then
      if p_moment = 'matin' then
        if r.notif_mail_echeance then
          select coalesce(jsonb_agg(jsonb_build_object('court', x.court, 'quand', x.quand) order by x.ordre, x.court), '[]'::jsonb)
            into m_ech from (
              select o.court, 'aujourd''hui' as quand, 0 as ordre from public.notif_obligations_du(v_jour) o
               where not exists (select 1 from public.taches t where t.bureau = r.bureau
                                   and t.tache_id = 'ech:' || o.cle || ':' || to_char(v_jour, 'YYYY-MM-DD') and t.fait_le is not null)
              union all
              select o.court, 'demain', 1 from public.notif_obligations_du(v_jour + 1) o
               where not exists (select 1 from public.taches t where t.bureau = r.bureau
                                   and t.tache_id = 'ech:' || o.cle || ':' || to_char(v_jour + 1, 'YYYY-MM-DD') and t.fait_le is not null)
            ) x;
        end if;
        if r.notif_mail_devis_expire then
          select coalesce(jsonb_agg(jsonb_build_object(
                   'numero', d.numero, 'client', coalesce(nullif(btrim(d.acheteur->>'nom'), ''), 'Client'),
                   'total_ht_c', d.total_ht_c, 'affaire_id', d.affaire_id) order by d.numero), '[]'::jsonb)
            into m_dev from public.devis d
           where d.bureau = r.bureau and d.statut = 'envoye' and d.valable_jusqu = v_jour + 1;
        end if;
      elsif r.notif_mail_rappels then
        select coalesce(jsonb_agg(x.l order by x.l->>'quoi'), '[]'::jsonb) into m_rap from (
          select jsonb_build_object('quoi', coalesce(nullif(btrim(a.client_nom), ''), a.titre),
                                    'motif', nullif(btrim(a.rappel_titre), ''), 'affaire_id', a.affaire_id) as l
            from public.affaires a
           where a.bureau = r.bureau and a.rappel = v_jour and a.issue = 'en_cours'
          union all
          -- Le nom vient de la piste devenue cliente (pistes.client_id) ; sinon le numero client.
          select jsonb_build_object('quoi', coalesce(
                   (select nullif(btrim(p.nom), '') from public.pistes p
                     where p.bureau = s.bureau and p.client_id = s.client_id order by p.nom limit 1),
                   'Client ' || s.client_id), 'motif', nullif(btrim(s.rappel_titre), ''))
            from public.suivi_clients s
           where s.bureau = r.bureau and s.rappel = v_jour and coalesce(s.statut, '') <> 'traite'
        ) x;
      end if;
    end if;

    v_n := jsonb_array_length(m_ech) + jsonb_array_length(m_dev) + jsonb_array_length(m_rap);
    if v_n > 0 and v_mails >= p_plafond then
      v_plafonnes := v_plafonnes + 1;
    elsif v_n > 0 then
      v_sujet := case
        when p_moment = 'soir' then
          case when v_n = 1 then 'Un rappel promis pour aujourd''hui n''est pas fait'
               else v_n || ' rappels promis pour aujourd''hui ne sont pas faits' end
        when v_n = 1 and jsonb_array_length(m_ech) = 1 then
          (m_ech->0->>'court') || ' à faire ' || (m_ech->0->>'quand')
        when v_n = 1 then 'Le devis ' || (m_dev->0->>'numero') || ' expire demain sans réponse'
        else v_n || ' choses à voir ce matin' end;
      insert into public.notif_mail_journal (personne, jour, moment, sujet)
      values (r.personne, v_jour, p_moment, v_sujet)
      on conflict do nothing;
      if found then
        v_mails := v_mails + 1;
        v_mail := jsonb_build_object('email', r.email, 'prenom', r.prenom, 'bureau_nom', r.bureau_nom,
                                     'sujet', v_sujet, 'echeances', m_ech, 'devis', m_dev, 'rappels', m_rap);
        v_lot := coalesce(v_lot, '{}'::jsonb) || jsonb_build_object('mail', v_mail);
      end if;
    end if;

    if v_lot is not null then
      v_lots := v_lots || (jsonb_build_object('personne', r.personne, 'jour', v_jour, 'moment', p_moment) || v_lot);
    end if;
  end loop;

  if v_plafonnes > 0 then
    v_lots := v_lots || jsonb_build_object('plafonnes', v_plafonnes);
  end if;

  if p_moment = 'matin' then
    update public.notif_envois set push_differe = false
     where sorte = 'signe' and push_differe and demande_le <= p_maintenant;
  end if;

  return v_lots;
end $$;
revoke all on function public.notif_horaire_lots(text, timestamptz, int) from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.notif_detail(uuid, uuid) to service_role;
    grant execute on function public.notif_horaire_lots(text, timestamptz, int) to service_role;
    grant select, update on public.notif_mail_journal to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. L'HORLOGE ATTEND PLUS LONGTEMPS : 120 s au lieu de 30
-- ---------------------------------------------------------------------------
-- Les mails partent un a un, avec une pause : un passage peut depasser 30 s. Meme tache,
-- meme nom, meme texte que le lot 61, seul le delai change (cron.schedule remplace).
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('notif-horaire', '30 * * * *', $cron$
      select net.http_post(
        url := replace(r.url, '/notif-commerce', '/notif-horaire'),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notif-cle', r.cle),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000)
        from public.notif_reglage r where r.id
    $cron$);
  end if;
end $$;
