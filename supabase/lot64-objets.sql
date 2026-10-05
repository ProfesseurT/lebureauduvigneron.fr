-- ===========================================================================
-- LOT 64 : DES OBJETS ET DES NOTIFICATIONS QUI DISENT L'ESSENTIEL (05/10/2026)
-- ===========================================================================
-- Demande de Ted : savoir en un coup d'oeil s'il faut ouvrir. Arbitre avec le vigneron :
--   1. Les objets de mail commencent par le fait et nomment (client, montant) ; un texte
--      d'apercu dit l'action (fonctions notif-commerce et notif-horaire).
--   2. Une case par personne, DECOCHEE par defaut : « Montrer le client et le montant sur
--      mes notifications ». Decochee, les notifications restent sans nom ni montant (regle de
--      l'ecran verrouille). Cochee : client, montant, noms des rappels (2 au plus, puis « +n »).
--   Ni emoji, ni expediteur qui change (le vigneron : decoration, et les tris casseraient).
--
-- A COLLER PAR TED DANS SUPABASE, APRES LE LOT 63. Rejouable. Puis pousser, puis
-- redeployer `notif-commerce` et `notif-horaire`.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. LA CASE
-- ---------------------------------------------------------------------------
alter table public.profils add column if not exists notif_push_detail boolean not null default false;
grant update (notif_push_detail) on public.profils to authenticated;

-- ---------------------------------------------------------------------------
-- 2. DEUX NOMS AU PLUS, PUIS « +n »
-- ---------------------------------------------------------------------------
create or replace function public.notif_noms(p_noms text[])
returns text language sql immutable set search_path = public as $$
  select case
    when coalesce(cardinality(p_noms), 0) = 0 then ''
    when cardinality(p_noms) <= 2 then array_to_string(p_noms, ', ')
    else p_noms[1] || ', ' || p_noms[2] || ' +' || (cardinality(p_noms) - 2) end
$$;
revoke all on function public.notif_noms(text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. LES APPAREILS DISENT S'ILS VEULENT LE DETAIL
-- ---------------------------------------------------------------------------
-- Identique au lot 62, plus `detail` pour chaque appareil (la case de son proprietaire).
create or replace function public.push_cibles(p_bureau uuid, p_sorte text default 'signe', p_sauf uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
                                               'detail', pr.notif_push_detail)
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
-- 4. LE MATIN ET LE SOIR : identique au lot 63, sauf les textes (objets nominatifs,
--    notifications nominatives pour qui a coche la case)
-- ---------------------------------------------------------------------------
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
  v_noms text;
  v_mails int := (select count(*) from public.notif_mail_journal j where j.jour = (p_maintenant at time zone 'Europe/Paris')::date);
  v_plafonnes int := 0;
begin
  if p_moment not in ('matin', 'soir') then raise exception 'moment inconnu' using errcode = '22023'; end if;

  for r in
    select pr.id as personne, pr.bureau_courant as bureau, pr.email,
           coalesce(nullif(btrim(pr.prenom), ''), split_part(pr.email, '@', 1)) as prenom,
           pr.notif_push_signe, pr.notif_push_echeance, pr.notif_push_devis_expire, pr.notif_push_rappels,
           pr.notif_mail_echeance, pr.notif_mail_devis_expire, pr.notif_mail_rappels, pr.notif_push_detail,
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
          select count(*), public.notif_noms(array_agg(coalesce(nullif(btrim(d.acheteur->>'nom'), ''), d.numero) order by d.numero))
            into v_nb, v_noms from public.devis d
           where d.bureau = r.bureau and d.statut = 'envoye' and d.valable_jusqu = v_jour + 1;
          -- LOT 64 : avec la case « client et montant », le nom du client ; sinon rien de nominatif.
          if v_nb = 1 and r.notif_push_detail then v_items := v_items || ('Devis ' || v_noms || ' expire demain');
          elsif v_nb > 1 and r.notif_push_detail then v_items := v_items || (v_nb || ' devis expirent demain (' || v_noms || ')');
          elsif v_nb = 1 then v_items := v_items || 'Un devis expire demain sans réponse'::text;
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
          select count(*), public.notif_noms(array_agg(x.nom order by x.nom)) into v_nb, v_noms from (
            select coalesce(nullif(btrim(a.client_nom), ''), a.titre) as nom from public.affaires a
             where a.bureau = r.bureau and a.rappel = v_jour and a.issue = 'en_cours'
            union all
            select coalesce((select nullif(btrim(p.nom), '') from public.pistes p
                              where p.bureau = s.bureau and p.client_id = s.client_id order by p.nom limit 1),
                            'Client ' || s.client_id)
              from public.suivi_clients s
             where s.bureau = r.bureau and s.rappel = v_jour and coalesce(s.statut, '') <> 'traite') x;
          if v_nb > 0 and r.notif_push_detail then v_items := v_items || ('À rappeler aujourd''hui : ' || v_noms);
          elsif v_nb = 1 then v_items := v_items || 'Un rappel promis pour aujourd''hui n''est pas fait'::text;
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
      -- LOT 64 : l'objet commence par le fait et nomme (2 noms au plus, puis « +n »).
      if p_moment = 'soir' then
        v_sujet := 'À rappeler aujourd''hui : '
          || public.notif_noms(array(select e->>'quoi' from jsonb_array_elements(m_rap) e order by e->>'quoi'));
      else
        v_sujet := array_to_string(
          array(select (e->>'court') || ' à faire ' || (e->>'quand') from jsonb_array_elements(m_ech) e)
          || case jsonb_array_length(m_dev)
               when 0 then '{}'::text[]
               when 1 then array['devis ' || (m_dev->0->>'client') || ' expire demain']
               else array[jsonb_array_length(m_dev) || ' devis expirent demain ('
                          || public.notif_noms(array(select e->>'client' from jsonb_array_elements(m_dev) e)) || ')'] end,
          ' · ');
        v_sujet := upper(left(v_sujet, 1)) || substr(v_sujet, 2);
      end if;
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
    grant execute on function public.push_cibles(uuid, text, uuid) to service_role;
    grant execute on function public.notif_horaire_lots(text, timestamptz, int) to service_role;
    grant execute on function public.notif_noms(text[]) to service_role;
  end if;
end $$;
