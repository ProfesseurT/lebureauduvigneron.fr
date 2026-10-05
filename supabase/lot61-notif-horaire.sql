-- ===========================================================================
-- LOT 61 : LES NOTIFICATIONS DU MATIN ET DU SOIR, ET LE SILENCE DE LA NUIT (04-05/10/2026)
-- ===========================================================================
-- Quatrieme lot du chantier des notifications (CLAUDE.md, « LES NOTIFICATIONS ET LEURS
-- REGLAGES »). Une horloge passe chaque heure a la demi ; la fonction `notif-horaire` ne
-- travaille qu'a 7 h 30 et 17 h 30, heure de Paris.
--
--   7 h 30, UNE notification par personne au plus, qui regroupe :
--     - une echeance QUI COUTE UNE AMENDE demain, ou aujourd'hui et pas cochee ;
--     - un devis envoye, sans reponse, qui expire demain ;
--     - les devis signes pendant la nuit (rien ne sonne de 20 h a 7 h).
--   17 h 30, pour qui l'a coche (decoche par defaut) : les rappels promis pour aujourd'hui
--     et pas faits.
-- Une chose faite n'est jamais annoncee : echeance cochee, devis accepte ou refuse, rappel
-- traite ou deplace.
--
-- TOUT SE DECIDE ICI, la fonction ne fait qu'envoyer (regle de notif-commerce). Et la meme
-- fonction RESERVE le journal avant de rendre quoi que ce soit : deux passages la meme
-- heure n'envoient pas deux fois.
--
-- A COLLER PAR TED DANS SUPABASE, APRES LE LOT 60. Rejouable. Puis pousser, puis deployer
-- `notif-horaire` (nouvelle) et redeployer `notif-commerce`. Aucun secret nouveau : le
-- declencheur reprend l'adresse et la cle deja rangees dans `notif_reglage`.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. LES CASES « SUR MES APPAREILS », une par personne
-- ---------------------------------------------------------------------------
alter table public.profils add column if not exists notif_push_signe        boolean not null default true;
alter table public.profils add column if not exists notif_push_echeance     boolean not null default true;
alter table public.profils add column if not exists notif_push_devis_expire boolean not null default true;
alter table public.profils add column if not exists notif_push_rappels      boolean not null default false;
grant update (notif_push_signe, notif_push_echeance, notif_push_devis_expire, notif_push_rappels)
  on public.profils to authenticated;

-- ---------------------------------------------------------------------------
-- 2. LES OBLIGATIONS, en base
-- ---------------------------------------------------------------------------
-- Les sept echeances de `src/_data/echeances.json` dont le statut est « obligation »,
-- recopiees avec leur recurrence. `npm run banc:notif-horaire` compare cette liste au
-- fichier, cle par cle et regle par regle : une obligation ajoutee la-bas sans etre
-- ajoutee ici fait echouer `verif`. `court` est le nom dit sur l'ecran verrouille.
create or replace function public.notif_obligations()
returns table (cle text, court text, rtype text, mois int, jour int, le date)
language sql immutable as $$
  values
    ('drm',               'DRM',                                'mensuel', null::int, 10, null::date),
    ('dai',               'DAI',                                'annuel',  9,         10, null),
    ('stocks-arrete',     'Arrêté des stocks',                  'annuel',  7,         31, null),
    ('recolte',           'Déclaration de récolte',             'annuel',  12,        10, null),
    ('plantation',        'Déclaration de plantation',          'annuel',  5,         15, null),
    ('facture-reception', 'Facturation électronique, réception', 'unique', null,      null, date '2026-09-01'),
    ('facture-emission',  'Facturation électronique, émission',  'unique', null,      null, date '2027-09-01')
$$;
revoke all on function public.notif_obligations() from public, anon, authenticated;

-- Les obligations qui tombent CE jour-la.
create or replace function public.notif_obligations_du(p_jour date)
returns table (cle text, court text)
language sql immutable as $$
  select o.cle, o.court from public.notif_obligations() o
   where (o.rtype = 'mensuel' and extract(day from p_jour) = o.jour)
      or (o.rtype = 'annuel'  and extract(month from p_jour) = o.mois and extract(day from p_jour) = o.jour)
      or (o.rtype = 'unique'  and p_jour = o.le)
$$;
revoke all on function public.notif_obligations_du(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. LA NUIT : une signature differee
-- ---------------------------------------------------------------------------
alter table public.notif_envois add column if not exists push_differe boolean not null default false;

-- ---------------------------------------------------------------------------
-- 4. LES APPAREILS, SELON LA SORTE ET LES CASES
-- ---------------------------------------------------------------------------
-- Remplace la version du lot 60 (un seul argument) : la sorte decide de la case lue.
drop function if exists public.push_cibles(uuid);
create or replace function public.push_cibles(p_bureau uuid, p_sorte text default 'signe')
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth)
                            order by a.vu_le desc), '[]'::jsonb)
    from public.push_abonnements a
    join public.profils pr on pr.id = a.personne
   where a.personne in (select m.personne from public.membres m where m.bureau = p_bureau)
     and case p_sorte when 'signe' then pr.notif_push_signe else false end
$$;
revoke all on function public.push_cibles(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. LE JOURNAL : une notification par personne, par jour, par moment
-- ---------------------------------------------------------------------------
create table if not exists public.push_journal (
  personne  uuid not null references auth.users(id) on delete cascade,
  jour      date not null,
  moment    text not null check (moment in ('matin', 'soir')),
  titre     text,
  appareils integer,
  partis    integer,
  echec     text,
  cree_le   timestamptz not null default now(),
  primary key (personne, jour, moment)
);
alter table public.push_journal enable row level security;
revoke all on public.push_journal from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. CE QUI PART, DECIDE ET RESERVE EN UNE FOIS
-- ---------------------------------------------------------------------------
-- Rend un tableau : un element par personne a prevenir, avec son message et ses appareils.
-- La ligne du journal est POSEE ici (cle primaire), et seules les personnes pour qui
-- elle vient d'etre posee sont rendues. Les signatures de nuit annoncees sont marquees.
-- p_maintenant n'existe que pour le banc.
create or replace function public.notif_horaire_lots(p_moment text, p_maintenant timestamptz default now())
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_jour date := (p_maintenant at time zone 'Europe/Paris')::date;
  v_lots jsonb := '[]'::jsonb;
  r record; v_items text[]; v_nb int; v_cibles jsonb; v_titre text; v_corps text; v_ech record;
begin
  if p_moment not in ('matin', 'soir') then raise exception 'moment inconnu' using errcode = '22023'; end if;

  for r in
    select pr.id as personne, pr.bureau_courant as bureau, pr.notif_push_signe, pr.notif_push_echeance,
           pr.notif_push_devis_expire, pr.notif_push_rappels
      from public.profils pr
     where pr.bureau_courant is not null
       and exists (select 1 from public.membres m where m.bureau = pr.bureau_courant and m.personne = pr.id)
       and exists (select 1 from public.push_abonnements a where a.personne = pr.id)
  loop
    v_items := '{}';

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
        -- Tous les bureaux dont la personne est membre, comme le jour (push_cibles) : une
        -- signature de nuit dans un autre bureau que le courant ne doit pas disparaitre.
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

    continue when cardinality(v_items) = 0;

    if cardinality(v_items) = 1 then
      v_titre := v_items[1] || '.';
      v_corps := 'Ouvre ton bureau pour t''en occuper.';
    else
      -- « ce matin » et pas « pour aujourd'hui » : la liste peut dire « demain » (le vigneron).
      v_titre := cardinality(v_items) || ' choses ce matin';
      v_corps := array_to_string(v_items, '. ') || '.';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth)
                              order by a.vu_le desc), '[]'::jsonb)
      into v_cibles from public.push_abonnements a where a.personne = r.personne;

    -- LA RESERVATION : rien n'est rendu pour une personne deja servie a ce moment-la.
    insert into public.push_journal (personne, jour, moment, titre, appareils)
    values (r.personne, v_jour, p_moment, v_titre, jsonb_array_length(v_cibles))
    on conflict do nothing;
    continue when not found;

    v_lots := v_lots || jsonb_build_object(
      'personne', r.personne, 'jour', v_jour, 'moment', p_moment,
      'message', jsonb_build_object('titre', v_titre, 'corps', v_corps, 'url', '/mon-bureau/',
                                    'tag', p_moment || '-' || to_char(v_jour, 'YYYY-MM-DD')),
      'cibles', v_cibles);
  end loop;

  -- Les signatures de nuit sont annoncees : elles ne le seront plus. Et au matin, toute
  -- signature differee est soldee, annoncee ou non (personne n'avait la case, ou aucun
  -- appareil) : sans ca, elle reviendrait chaque matin comme « signee cette nuit ».
  if p_moment = 'matin' then
    update public.notif_envois set push_differe = false
     where sorte = 'signe' and push_differe and demande_le <= p_maintenant;
  end if;

  return v_lots;
end $$;
revoke all on function public.notif_horaire_lots(text, timestamptz) from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.push_cibles(uuid, text) to service_role;
    grant execute on function public.notif_horaire_lots(text, timestamptz) to service_role;
    grant select, update on public.push_journal to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. L'HORLOGE : chaque heure a la demie
-- ---------------------------------------------------------------------------
-- L'adresse est celle de notif-commerce, dont on change le dernier mot ; la cle est la meme.
-- Rien n'est recopie ici : le texte d'une tache cron se lit dans le catalogue. Sans reglage,
-- la tache ne poste rien. Pour l'arreter : select cron.unschedule('notif-horaire');
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('notif-horaire', '30 * * * *', $cron$
      select net.http_post(
        url := replace(r.url, '/notif-commerce', '/notif-horaire'),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notif-cle', r.cle),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000)
        from public.notif_reglage r where r.id
    $cron$);
  end if;
end $$;

-- CONTROLES
--   select jobname, schedule from cron.job where jobname = 'notif-horaire';      -- 30 * * * *
--   select * from public.notif_obligations_du(date '2026-10-10');                 -- DRM
--   select column_name from information_schema.columns where table_name = 'profils' and column_name like 'notif_push_%';  -- 4
