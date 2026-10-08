-- ===========================================================================
-- LOT 80, 08/10/2026 : LES NOUVEAUX CLIENTS ONT LEUR SUIVI ET LEUR JOURNAL
-- A COLLER DANS SUPABASE (editeur SQL), APRES le lot 78. Rejouable deux fois.
-- Aucune donnee n'est modifiee : ce lot ne fait que poser des regles.
-- ===========================================================================
-- Decision de Ted du 08/10/2026 : un client qui n'est pas (encore) dans Vitisoft
-- apparait dans « Mes clients » avec une vraie fiche. Ce lot est LA BASE de ce
-- chantier, les ecrans viennent aux lots suivants.
--
-- LA CLE. Un nouveau client est une ligne de `pistes` (lot 34). Son suivi
-- (etiquettes, rappel, motif, suivi par) et son journal (notes, appels, mails de
-- la fiche) vont dans LES MEMES TABLES qu'un client Vitisoft, `suivi_clients` et
-- `echanges`, sous la cle « p:<piste_id> ». C'est ce qui permet a la fiche, au
-- sous-main, au calendrier et au courrier de le traiter comme un client sans une
-- deuxieme mecanique. Un numero Vitisoft est fait de chiffres : il ne peut pas
-- commencer par « p: » (verifie en production le 08/10/2026 : zero cle non
-- numerique dans les deux tables).
--
-- CE QUE CE LOT GARANTIT :
--   1. une cle « p:... » designe une piste QUI EXISTE, dans le MEME bureau, qui
--      n'est pas en opposition et pas encore reliee a un client Vitisoft ;
--   2. « Vider la base » ne touche pas a ces lignes (decision de Ted : elles ne
--      viennent pas d'un export), et sa preuve chiffree ne compte que le reste ;
--   3. l'opposition et la purge a trois ans les effacent comme le reste de la piste ;
--   4. le courrier du matin et la notification du soir connaissent leur NOM.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. LIRE UNE CLE DE NOUVEAU CLIENT
-- ---------------------------------------------------------------------------
-- Rend l'identifiant de la piste, ou null si la cle n'est pas une cle de piste.
-- Jamais d'erreur : une cle mal formee est refusee par le declencheur, pas ici.
create or replace function public.piste_de_cle(c text)
returns uuid language sql immutable parallel safe set search_path = '' as $$
  select case when c ~ '^p:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then substr(c, 3)::uuid end;
$$;
revoke all on function public.piste_de_cle(text) from public, anon, authenticated;
grant execute on function public.piste_de_cle(text) to authenticated;

-- Le nom d'un client pour un ecrit (courrier, notification) : la piste pour une
-- cle « p: », sinon une piste reliee a ce numero (comportement du lot 63),
-- sinon null. L'appelant pose son repli (« Client » + numero).
create or replace function public.nom_du_client(b uuid, c text)
returns text language sql stable security invoker set search_path = '' as $$
  select case
    when public.piste_de_cle(c) is not null then
      (select nullif(btrim(p.nom), '') from public.pistes p
        where p.bureau = b and p.piste_id = public.piste_de_cle(c))
    else
      (select nullif(btrim(p.nom), '') from public.pistes p
        where p.bureau = b and p.client_id = c order by p.nom limit 1)
  end;
$$;
-- SECURITY INVOKER, et c'est voulu : elle lit `pistes` avec les droits de qui
-- l'appelle. Un compte connecte n'y lit donc que les pistes de SES bureaux, et la
-- fonction du soir (security definer) les lit toutes.
revoke all on function public.nom_du_client(uuid, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. LA CLE EST VERIFIEE A L'ECRITURE, SUR LES DEUX TABLES
-- ---------------------------------------------------------------------------
create or replace function public.cle_client_verifier()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pid uuid; v_p record;
begin
  if new.client_id is null or left(new.client_id, 2) <> 'p:' then
    return new;
  end if;
  -- Appele depuis un autre declencheur de la base (l'opposition qui efface le
  -- texte de son journal) : c'est la base qui nettoie, on la laisse faire.
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  v_pid := public.piste_de_cle(new.client_id);
  if v_pid is null then
    raise exception 'cle de nouveau client mal formee' using errcode = '22023';
  end if;
  select p.opposition, p.client_id into v_p
    from public.pistes p where p.bureau = new.bureau and p.piste_id = v_pid;
  if not found then
    raise exception 'ce nouveau client n''existe pas dans ce bureau' using errcode = '23503';
  end if;
  if coalesce(v_p.opposition, false) then
    raise exception 'cette personne a demande a ne plus etre contactee' using errcode = '42501';
  end if;
  if v_p.client_id is not null then
    raise exception 'ce client est maintenant dans Vitisoft : ecris sur sa fiche Vitisoft'
      using errcode = '23514';
  end if;
  return new;
end
$$;
revoke all on function public.cle_client_verifier() from public, anon, authenticated;

drop trigger if exists suivi_cle_client on public.suivi_clients;
create trigger suivi_cle_client before insert or update on public.suivi_clients
  for each row execute function public.cle_client_verifier();
drop trigger if exists echanges_cle_client on public.echanges;
create trigger echanges_cle_client before insert or update on public.echanges
  for each row execute function public.cle_client_verifier();


-- ---------------------------------------------------------------------------
-- 3. « VIDER LA BASE » GARDE LES NOUVEAUX CLIENTS
-- ---------------------------------------------------------------------------
-- Reprend le lot 30 a la lettre, sauf deux choses : les lignes « p:... » de
-- `suivi_clients` et `echanges` ne sont ni effacees ni recomptees, et le compte de
-- ce qui est garde arrive sous un nom a lui, `gardes`. Les autres champs rendus
-- ne changent ni de nom ni de sens (bdv-base.js les lit).
create or replace function public.vider_la_base_du_bureau(b uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n_ventes  int;
  n_lignes  int;
  n_suivi   int;
  n_echange int;
  n_resume  int;
  r_ventes  int;
  r_lignes  int;
  r_suivi   int;
  r_echange int;
  r_resume  int;
  g_suivi   int;
  g_echange int;
  manque    text;
begin
  if b is null or not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut vider sa base';
  end if;

  delete from public.echanges      where bureau = b and left(client_id, 2) <> 'p:';
  get diagnostics n_echange = row_count;
  delete from public.suivi_clients where bureau = b and left(client_id, 2) <> 'p:';
  get diagnostics n_suivi   = row_count;
  delete from public.ventes        where bureau = b;  get diagnostics n_ventes  = row_count;
  delete from public.ventes_lignes where bureau = b;  get diagnostics n_lignes = row_count;

  update public.reglages
     set file_travail = null, resume_ventes = null, depose_le = null, maj_le = now()
   where bureau = b;

  delete from public.resumes where bureau = b;  get diagnostics n_resume = row_count;

  select count(*) into r_ventes  from public.ventes        where bureau = b;
  select count(*) into r_lignes  from public.ventes_lignes where bureau = b;
  select count(*) into r_suivi   from public.suivi_clients where bureau = b and left(client_id, 2) <> 'p:';
  select count(*) into r_echange from public.echanges      where bureau = b and left(client_id, 2) <> 'p:';
  select count(*) into r_resume  from public.resumes       where bureau = b;
  select count(*) into g_suivi   from public.suivi_clients where bureau = b and left(client_id, 2) = 'p:';
  select count(*) into g_echange from public.echanges      where bureau = b and left(client_id, 2) = 'p:';

  manque := concat_ws(', ',
    nullif(concat('ventes: ',        r_ventes),  'ventes: 0'),
    nullif(concat('ventes_lignes: ', r_lignes),  'ventes_lignes: 0'),
    nullif(concat('suivi_clients: ', r_suivi),   'suivi_clients: 0'),
    nullif(concat('echanges: ',      r_echange), 'echanges: 0'),
    nullif(concat('resumes: ',       r_resume),  'resumes: 0'));
  if manque <> '' then
    raise exception 'le vidage n''a pas abouti, il reste des lignes dans %', manque;
  end if;

  return jsonb_build_object(
    'vide',        true,
    'ventes',      n_ventes,
    'lignes',      n_lignes,
    'suivi',       n_suivi,
    'echanges',    n_echange,
    'resumes',     n_resume,
    'reste',       r_ventes,
    'reste_total', r_ventes + r_lignes + r_suivi + r_echange + r_resume,
    'gardes',      g_suivi + g_echange);
end
$$;
revoke all on function public.vider_la_base_du_bureau(uuid) from public, anon, authenticated;
grant execute on function public.vider_la_base_du_bureau(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 4. L'OPPOSITION EFFACE AUSSI SON SUIVI ET SON JOURNAL
-- ---------------------------------------------------------------------------
-- Reprend le lot 72 a la lettre, plus le dernier bloc. Le suivi est SUPPRIME
-- (etiquettes, rappel, motif, note) ; le journal garde ses lignes et leur date,
-- mais perd son texte, comme celui des affaires.
create or replace function public.pistes_opposition_affaires()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.opposition and not coalesce(old.opposition, false) then
    update public.affaires a set notes = null
     where a.bureau = new.bureau and a.piste_id = new.piste_id and a.notes is not null;
    update public.affaires a set rappel = null, rappel_titre = null
     where a.bureau = new.bureau and a.piste_id = new.piste_id
       and a.issue = 'en_cours' and a.rappel is not null;
    update public.affaire_echanges x set sujet = null, corps = null, destinataire = null
      from public.affaires a
     where a.bureau = new.bureau and a.piste_id = new.piste_id
       and x.bureau = a.bureau and x.affaire_id = a.affaire_id
       and (x.sujet is not null or x.corps is not null or x.destinataire is not null);
    -- LOT 80 : sa fiche de nouveau client.
    delete from public.suivi_clients s
     where s.bureau = new.bureau and s.client_id = 'p:' || new.piste_id::text;
    update public.echanges e set resume = null
     where e.bureau = new.bureau and e.client_id = 'p:' || new.piste_id::text
       and e.resume is not null;
  end if;
  return null;
end
$$;
revoke all on function public.pistes_opposition_affaires() from public, anon, authenticated;

-- RATTRAPAGE : une piste deja en opposition ne peut pas avoir de ligne « p: »
-- (le declencheur du point 2 les refuse) ; rien a rattraper.


-- ---------------------------------------------------------------------------
-- 5. LA PURGE A TROIS ANS COMPTE SA FICHE
-- ---------------------------------------------------------------------------
-- Reprend le lot 72, plus : une note ou un rappel de moins de trois ans sur sa
-- fiche est un geste (la piste n'est pas purgee) ; une fiche plus vieille est
-- effacee avec le reste.
create or replace function public.pistes_purger()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  with cibles as (
    select p.bureau, p.piste_id from public.pistes p
     where p.client_id is null
       and p.maj_le < now() - interval '3 years'
       and (p.contact_nom is not null or p.contact_fonction is not null or p.email is not null
            or p.telephone is not null or p.notes is not null
            or p.adresse is not null or p.code_postal is not null
            or exists (select 1 from public.affaires a
                        where a.bureau = p.bureau and a.piste_id = p.piste_id and a.notes is not null)
            or exists (select 1 from public.affaires a join public.affaire_echanges x
                          on x.bureau = a.bureau and x.affaire_id = a.affaire_id
                        where a.bureau = p.bureau and a.piste_id = p.piste_id
                          and (x.sujet is not null or x.corps is not null or x.destinataire is not null))
            or exists (select 1 from public.suivi_clients s
                        where s.bureau = p.bureau and s.client_id = 'p:' || p.piste_id::text)
            or exists (select 1 from public.echanges e
                        where e.bureau = p.bureau and e.client_id = 'p:' || p.piste_id::text
                          and e.resume is not null))
       and not exists (select 1 from public.affaires a
                        where a.bureau = p.bureau and a.piste_id = p.piste_id
                          and (a.issue in ('en_cours', 'gagnee')
                               or a.maj_le >= now() - interval '3 years'))
       and not exists (select 1 from public.suivi_clients s
                        where s.bureau = p.bureau and s.client_id = 'p:' || p.piste_id::text
                          and (s.maj_le >= now() - interval '3 years'
                               or s.rappel >= (now() - interval '3 years')::date))
       and not exists (select 1 from public.echanges e
                        where e.bureau = p.bureau and e.client_id = 'p:' || p.piste_id::text
                          and e.le >= now() - interval '3 years')
  ), notes as (
    update public.affaires a set notes = null
      from cibles c where a.bureau = c.bureau and a.piste_id = c.piste_id and a.notes is not null
    returning 1
  ), journal as (
    update public.affaire_echanges x set sujet = null, corps = null, destinataire = null
      from public.affaires a, cibles c
     where a.bureau = c.bureau and a.piste_id = c.piste_id
       and x.bureau = a.bureau and x.affaire_id = a.affaire_id
       and (x.sujet is not null or x.corps is not null or x.destinataire is not null)
    returning 1
  ), fiche as (
    delete from public.suivi_clients s
     using cibles c where s.bureau = c.bureau and s.client_id = 'p:' || c.piste_id::text
    returning 1
  ), fil as (
    update public.echanges e set resume = null
      from cibles c
     where e.bureau = c.bureau and e.client_id = 'p:' || c.piste_id::text and e.resume is not null
    returning 1
  )
  update public.pistes p
     set contact_nom = null, contact_fonction = null, email = null, telephone = null,
         notes = null, adresse = null, code_postal = null
    from cibles c where p.bureau = c.bureau and p.piste_id = c.piste_id;
  get diagnostics n = row_count;
  return n;
end
$$;
revoke all on function public.pistes_purger() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 6. LE COURRIER DU MATIN : MEMES COLONNES, ET LE NOM DANS CHAQUE SUIVI
-- ---------------------------------------------------------------------------
-- Recreee a l'identique du lot 56 (memes onze colonnes, meme ordre), sauf une
-- chose : chaque element de `suivis` porte en plus `nom` (nom_du_client), parce
-- qu'un nouveau client n'est pas dans `noms` (qui vient de l'export). Ajouter une
-- cle dans un objet ne change rien pour qui ne la lit pas.
create or replace view public.v_courrier with (security_invoker = true) as
with base as (
  select p.id as personne, p.email, p.jeton_emails, p.bureau_courant as bureau
    from public.profils p
   where p.consent_courrier and p.bureau_courant is not null
), signaux_gardes as (
  select b.personne, jsonb_agg(s.valeur order by s.n) as signaux
    from base b
    join public.reglages r on r.bureau = b.bureau
    cross join lateral jsonb_array_elements(
      coalesce(r.file_travail -> 'signaux', '[]'::jsonb)) with ordinality s(valeur, n)
   where not exists (
     select 1 from public.suivi_clients sc
      where sc.bureau = b.bureau
        and sc.client_id = (s.valeur ->> 'id')
        and (sc.rappel is not null or sc.statut = 'traite'))
   group by b.personne
), suivis_actifs as (
  select b.personne,
         jsonb_agg(to_jsonb(sc.*) || jsonb_build_object('nom', public.nom_du_client(sc.bureau, sc.client_id))) as suivis
    from base b join public.suivi_clients sc on sc.bureau = b.bureau
   where sc.rappel is not null and sc.statut is distinct from 'traite'
   group by b.personne
), taches_ouvertes as (
  select b.personne, jsonb_agg(to_jsonb(t.*)) as taches
    from base b join public.taches t on t.bureau = b.bureau
   where t.fait_le is null
   group by b.personne
), affaires_a_relancer as (
  select b.personne,
         jsonb_agg(jsonb_build_object(
           'affaire_id',   a.affaire_id,
           'nom',          coalesce(pi.nom, a.client_nom, a.titre),
           'titre',        a.titre,
           'type',         ty.nom,
           'etape',        et.nom,
           'rappel',       a.rappel,
           'rappel_titre', a.rappel_titre,
           'issue',        a.issue
         ) order by a.rappel) as affaires
    from base b
    join public.affaires a on a.bureau = b.bureau
    left join public.pistes         pi on pi.piste_id = a.piste_id and pi.bureau = a.bureau
    left join public.affaire_types  ty on ty.type_id  = a.type_id  and ty.bureau = a.bureau
    left join public.affaire_etapes et on et.etape_id = a.etape_id and et.bureau = a.bureau
   where a.issue = 'en_cours' and a.rappel is not null
     and not coalesce(pi.opposition, false)
   group by b.personne
), devis_signes as (
  select b.personne,
         jsonb_agg(jsonb_build_object(
           'numero',     sig.numero,
           'client',     coalesce(sig.au_nom_de, ''),
           'signataire', sig.nom,
           'total_ht_c', sig.total_ht_c,
           'signe_le',   sig.signe_le
         ) order by sig.signe_le) as signes
    from base b
    join public.devis_signatures sig on sig.bureau = b.bureau
    join public.devis dv on dv.bureau = sig.bureau and dv.devis_id = sig.devis_id
   where sig.signe_le > now() - interval '24 hours'
     and dv.statut = 'accepte' and dv.signe_le = sig.signe_le
   group by b.personne
)
select b.personne as id,
       b.email,
       b.jeton_emails,
       r.depose_le,
       coalesce(r.file_travail -> 'noms', '{}'::jsonb) as noms,
       coalesce(sg.signaux, '[]'::jsonb) as signaux,
       coalesce(sa.suivis,  '[]'::jsonb) as suivis,
       coalesce(tc.taches,  '[]'::jsonb) as taches,
       r.resume_ventes,
       coalesce(ar.affaires, '[]'::jsonb) as affaires,
       coalesce(ds.signes, '[]'::jsonb) as signes
  from base b
  join public.reglages r on r.bureau = b.bureau
  left join signaux_gardes      sg on sg.personne = b.personne
  left join suivis_actifs       sa on sa.personne = b.personne
  left join taches_ouvertes     tc on tc.personne = b.personne
  left join affaires_a_relancer ar on ar.personne = b.personne
  left join devis_signes        ds on ds.personne = b.personne;

revoke all on public.v_courrier from anon, authenticated;
grant select on public.v_courrier to authenticated;

-- La vue est `security_invoker` : celui qui la lit doit pouvoir appeler
-- nom_du_client, qui lit `pistes` avec SES droits (politique du lot 34).
grant execute on function public.nom_du_client(uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 7. LA NOTIFICATION ET LE MAIL DU SOIR : LE NOM D'UN NOUVEAU CLIENT
-- ---------------------------------------------------------------------------
-- Copie EXACTE de la fonction du lot 64, sauf les deux recherches de nom, qui
-- passent par nom_du_client (meme resultat pour un numero Vitisoft).
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
            select coalesce(public.nom_du_client(s.bureau, s.client_id),
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
                   public.nom_du_client(s.bureau, s.client_id),
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
    grant execute on function public.notif_horaire_lots(text, timestamptz, int) to service_role;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- CONTROLES, a lancer apres (ils ne modifient rien)
-- ---------------------------------------------------------------------------
-- select tgname, tgrelid::regclass from pg_trigger
--  where tgname in ('suivi_cle_client', 'echanges_cle_client');          -> 2 lignes
-- select string_agg(attname, ',' order by attnum) from pg_attribute
--  where attrelid = 'public.v_courrier'::regclass and attnum > 0;
--   -> id,email,jeton_emails,depose_le,noms,signaux,suivis,taches,resume_ventes,affaires,signes
