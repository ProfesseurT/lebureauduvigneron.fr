-- ===========================================================================
-- LOT 83, 08/10/2026 : RELIER UN NOUVEAU CLIENT A VITISOFT, LE DELIER,
-- FUSIONNER DEUX NOUVEAUX CLIENTS
-- A COLLER DANS SUPABASE (editeur SQL), APRES le lot 80. Rejouable deux fois.
-- Aucune donnee n'est modifiee au collage : ce lot pose des regles et trois gestes.
-- ===========================================================================
-- Decisions de Ted du 08/10/2026 :
--   - un nouveau client (piste du lot 80) se RELIE a un client Vitisoft : tout seul a
--     l'import si l'e-mail est le meme, sinon sur sa reponse « C'est le meme ? », ou a
--     la main depuis sa fiche. Son suivi, son journal et ses affaires passent sur la
--     fiche Vitisoft ;
--   - « Delier » remet le nouveau client comme il etait au moment du lien ;
--   - deux nouveaux clients en double se FUSIONNENT, definitivement, apres
--     confirmation. Deux clients Vitisoft ne se fusionnent pas ici : Vitisoft les
--     renverrait separes a chaque export, c'est dans Vitisoft que ca se corrige.
--
-- POURQUOI DES FONCTIONS ET PAS DES ECRITURES DU NAVIGATEUR. Trois raisons, toutes
-- constatees en lisant la base :
--   1. un echange ne se modifie que par son AUTEUR (lot 17) : le navigateur ne peut
--      pas deplacer la note d'un collegue ;
--   2. une piste ne se supprime plus depuis le navigateur (lot 56) ;
--   3. le declencheur du lot 80 refuse toute ecriture sous « p:... » des que la piste
--      est reliee : il faut deplacer AVANT de relier, dans la meme transaction.
-- Et c'est un geste a plusieurs tables : a moitie fait, il perdrait des notes.
--
-- CE QUE CE LOT GARANTIT :
--   1. `pistes.client_id` ne change plus que par ces fonctions (le navigateur pouvait
--      le poser par un simple PATCH, sans rien deplacer) ;
--   2. relier deplace le suivi et le journal, et le note dans `liens_nouveaux`, qui est
--      ce que « Delier » relit ;
--   3. une opposition efface aussi cette trace (elle contient une copie du suivi).
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. « CE N'EST PAS LUI » : la reponse Non a « C'est le meme ? »
-- ---------------------------------------------------------------------------
-- Les numeros Vitisoft que le bureau a ecartes pour cette piste. Partage par tout le
-- bureau : la question ne revient pas chez un collegue. Il s'ecrit par `piste_ecarter`
-- (section 8), qui ajoute sans ecraser la reponse d'un collegue.
alter table public.pistes add column if not exists pas_vitisoft text[] not null default '{}';


-- ---------------------------------------------------------------------------
-- 2. LA TRACE DU LIEN
-- ---------------------------------------------------------------------------
-- Une ligne par piste reliee. Elle garde l'etat d'AVANT (le suivi de la piste, celui
-- du client Vitisoft) et la liste des echanges deplaces : c'est tout ce que « Delier »
-- doit savoir. Personne ne la lit ni ne l'ecrit depuis le navigateur.
create table if not exists public.liens_nouveaux (
  bureau        uuid not null,
  piste_id      uuid not null,
  client_id     text not null,
  le            timestamptz not null default now(),
  par           uuid references auth.users(id) on delete set null,
  echanges      text[] not null default '{}',
  suivi_piste   jsonb,
  suivi_client  jsonb,
  suivi_reuni   jsonb,
  primary key (bureau, piste_id),
  constraint liens_nouveaux_piste_fk foreign key (bureau, piste_id)
    references public.pistes(bureau, piste_id) on delete cascade
);
alter table public.liens_nouveaux enable row level security;
revoke all on public.liens_nouveaux from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. LE LIEN NE SE POSE PLUS A LA MAIN
-- ---------------------------------------------------------------------------
-- Un compte connecte ne change plus `client_id` d'une piste, ni a la creation ni
-- apres : seules les fonctions de ce lot le font, en posant `bdv.lien` pour leur
-- transaction. Le role de service et l'editeur SQL (sans compte) passent toujours.
create or replace function public.pistes_lien_garde()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(current_setting('bdv.lien', true), '') = 'oui' then
    return new;
  end if;
  if tg_op = 'INSERT' and new.client_id is not null then
    raise exception 'un nouveau client se relie a Vitisoft depuis sa fiche' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'un nouveau client se relie a Vitisoft depuis sa fiche' using errcode = '42501';
  end if;
  return new;
end
$$;
revoke all on function public.pistes_lien_garde() from public, anon, authenticated;
drop trigger if exists pistes_lien_garde on public.pistes;
create trigger pistes_lien_garde before insert or update of client_id on public.pistes
  for each row execute function public.pistes_lien_garde();

-- L'opposition efface la trace du lien : elle porte une copie du suivi de la personne.
create or replace function public.pistes_opposition_lien()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.opposition and not coalesce(old.opposition, false) then
    delete from public.liens_nouveaux l where l.bureau = new.bureau and l.piste_id = new.piste_id;
  end if;
  return null;
end
$$;
revoke all on function public.pistes_opposition_lien() from public, anon, authenticated;
drop trigger if exists pistes_opposition_lien on public.pistes;
create trigger pistes_opposition_lien after update of opposition on public.pistes
  for each row execute function public.pistes_opposition_lien();


-- ---------------------------------------------------------------------------
-- 4. REUNIR DEUX SUIVIS (outil interne)
-- ---------------------------------------------------------------------------
-- Deplace le suivi de `de` vers `vers`. Si `vers` en a deja un, les deux se reunissent
-- (decision de Ted) : les notes bout a bout, le rappel le plus proche (avec son motif,
-- son canal et son statut), les etiquettes additionnees, le « suivi par » de `vers`
-- s'il y en a un. Rend la ligne finale, ou null s'il n'y avait rien a deplacer.
create or replace function public.suivi_reunir(p_bureau uuid, p_de text, p_vers text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.suivi_clients; v public.suivi_clients; garde_a boolean; fin public.suivi_clients;
begin
  select * into a from public.suivi_clients s where s.bureau = p_bureau and s.client_id = p_de for update;
  if not found then
    select * into v from public.suivi_clients s where s.bureau = p_bureau and s.client_id = p_vers;
    return case when found then to_jsonb(v) end;
  end if;
  select * into v from public.suivi_clients s where s.bureau = p_bureau and s.client_id = p_vers for update;
  if not found then
    update public.suivi_clients s set client_id = p_vers
     where s.bureau = p_bureau and s.client_id = p_de returning * into fin;
    return to_jsonb(fin);
  end if;
  -- Le rappel garde est le plus proche ; a egalite, celui de `vers`.
  garde_a := a.rappel is not null and (v.rappel is null or a.rappel < v.rappel);
  update public.suivi_clients s set
      statut       = case when garde_a then a.statut else coalesce(v.statut, a.statut) end,
      rappel       = case when garde_a then a.rappel else v.rappel end,
      rappel_titre = case when garde_a then a.rappel_titre else v.rappel_titre end,
      canal        = case when garde_a then a.canal else coalesce(v.canal, a.canal) end,
      notes        = case
                       when nullif(btrim(coalesce(a.notes, '')), '') is null then v.notes
                       when nullif(btrim(coalesce(v.notes, '')), '') is null then a.notes
                       when btrim(v.notes) = btrim(a.notes) then v.notes
                       else v.notes || E'\n' || a.notes end,
      tags         = coalesce(v.tags, '{}') || coalesce(array(
                       select t from unnest(coalesce(a.tags, '{}')) with ordinality u(t, o)
                        where not (t = any(coalesce(v.tags, '{}'))) order by o), '{}'),
      proprietaire = coalesce(v.proprietaire, a.proprietaire),
      maj_le       = now()
   where s.bureau = p_bureau and s.client_id = p_vers returning * into fin;
  delete from public.suivi_clients s where s.bureau = p_bureau and s.client_id = p_de;
  return to_jsonb(fin);
end
$$;
revoke all on function public.suivi_reunir(uuid, text, text) from public, anon, authenticated;

-- Les champs qui disent ce que le vigneron a ecrit (pas qui, ni quand).
create or replace function public.suivi_contenu(j jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select case when j is null then null else jsonb_build_object(
    'statut', j->'statut', 'notes', j->'notes', 'rappel', j->'rappel', 'rappel_titre', j->'rappel_titre',
    'canal', j->'canal', 'tags', j->'tags', 'proprietaire', j->'proprietaire') end;
$$;
revoke all on function public.suivi_contenu(jsonb) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 5. RELIER UN NOUVEAU CLIENT A UN CLIENT VITISOFT
-- ---------------------------------------------------------------------------
-- Rend { relie, client_id, echanges, suivi } ; { deja: true } si c'est deja fait.
-- Les affaires ne bougent pas : elles restent sur la piste, et le lien (lot 44) les
-- montre deja sur la fiche Vitisoft.
create or replace function public.relier_a_vitisoft(p_bureau uuid, p_piste uuid, p_client text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.pistes; autre text; c text := btrim(coalesce(p_client, ''));
        cle text := 'p:' || p_piste::text; sp jsonb; sc jsonb; fin jsonb; ids text[];
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'ce bureau n''est pas le tien' using errcode = '42501';
  end if;
  if c = '' or left(c, 2) = 'p:' or char_length(c) > 64 then
    raise exception 'numero client Vitisoft invalide' using errcode = '22023';
  end if;
  select * into p from public.pistes x where x.bureau = p_bureau and x.piste_id = p_piste for update;
  if not found then
    raise exception 'ce nouveau client n''existe pas dans ce bureau' using errcode = '23503';
  end if;
  if p.opposition then
    raise exception 'cette personne a demande a ne plus etre contactee' using errcode = '42501';
  end if;
  if p.client_id is not null then
    if p.client_id = c then return jsonb_build_object('deja', true, 'client_id', c); end if;
    raise exception 'ce nouveau client est deja relie a un autre client Vitisoft' using errcode = '23514';
  end if;
  select x.nom into autre from public.pistes x
   where x.bureau = p_bureau and x.client_id = c and x.piste_id <> p_piste;
  if found then
    raise exception 'ce client Vitisoft est deja relie a %', autre using errcode = '23505';
  end if;

  select to_jsonb(s) into sp from public.suivi_clients s where s.bureau = p_bureau and s.client_id = cle;
  select to_jsonb(s) into sc from public.suivi_clients s where s.bureau = p_bureau and s.client_id = c;
  fin := public.suivi_reunir(p_bureau, cle, c);
  with m as (
    update public.echanges e set client_id = c
     where e.bureau = p_bureau and e.client_id = cle returning e.echange_id)
  select coalesce(array_agg(echange_id order by echange_id), '{}') into ids from m;

  perform set_config('bdv.lien', 'oui', true);
  update public.pistes x set client_id = c where x.bureau = p_bureau and x.piste_id = p_piste;
  perform set_config('bdv.lien', '', true);

  insert into public.liens_nouveaux (bureau, piste_id, client_id, le, par, echanges, suivi_piste, suivi_client, suivi_reuni)
  values (p_bureau, p_piste, c, now(), auth.uid(), ids, sp, sc, fin)
  on conflict (bureau, piste_id) do update set client_id = excluded.client_id, le = excluded.le,
    par = excluded.par, echanges = excluded.echanges, suivi_piste = excluded.suivi_piste,
    suivi_client = excluded.suivi_client, suivi_reuni = excluded.suivi_reuni;

  return jsonb_build_object('relie', true, 'client_id', c, 'echanges', coalesce(array_length(ids, 1), 0),
    'suivi', case when sp is null then 'aucun' when sc is null then 'deplace' else 'reuni' end);
end
$$;
revoke all on function public.relier_a_vitisoft(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.relier_a_vitisoft(uuid, uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 6. DELIER
-- ---------------------------------------------------------------------------
-- Remet le nouveau client comme il etait au moment du lien :
--   - les echanges qui venaient de lui repartent sur sa fiche ; ceux ecrits apres le
--     lien restent sur la fiche Vitisoft (on ne peut pas deviner a qui ils etaient) ;
--   - son suivi reprend l'etat d'avant le lien ;
--   - le suivi Vitisoft reprend le sien (ou disparait s'il n'en avait pas), SAUF s'il a
--     ete modifie depuis le lien : on garde alors ce que le vigneron a ecrit.
-- Rend { delie, echanges, suivi_vitisoft: 'rendu' | 'garde' | 'aucun' }.
create or replace function public.delier_de_vitisoft(p_bureau uuid, p_piste uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.pistes; j public.liens_nouveaux; c text; cle text := 'p:' || p_piste::text;
        cur jsonb; fin jsonb; n int := 0; etat text := 'aucun';
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'ce bureau n''est pas le tien' using errcode = '42501';
  end if;
  select * into p from public.pistes x where x.bureau = p_bureau and x.piste_id = p_piste for update;
  if not found then
    raise exception 'ce nouveau client n''existe pas dans ce bureau' using errcode = '23503';
  end if;
  if p.client_id is null then return jsonb_build_object('deja', true); end if;
  if p.opposition then
    raise exception 'cette personne a demande a ne plus etre contactee' using errcode = '42501';
  end if;
  c := p.client_id;
  select * into j from public.liens_nouveaux l where l.bureau = p_bureau and l.piste_id = p_piste;

  perform set_config('bdv.lien', 'oui', true);
  update public.pistes x set client_id = null where x.bureau = p_bureau and x.piste_id = p_piste;
  perform set_config('bdv.lien', '', true);

  if j.piste_id is not null then
    update public.echanges e set client_id = cle
     where e.bureau = p_bureau and e.client_id = c and e.echange_id = any(j.echanges);
    get diagnostics n = row_count;

    select to_jsonb(s) into cur from public.suivi_clients s where s.bureau = p_bureau and s.client_id = c;
    if cur is not null and public.suivi_contenu(cur) is not distinct from public.suivi_contenu(j.suivi_reuni) then
      -- Rien n'a bouge depuis le lien : la fiche Vitisoft reprend exactement son etat d'avant.
      delete from public.suivi_clients s where s.bureau = p_bureau and s.client_id = c;
      if j.suivi_client is not null then
        insert into public.suivi_clients select * from jsonb_populate_record(null::public.suivi_clients, j.suivi_client);
      end if;
      etat := 'rendu';
    elsif cur is not null then
      -- UN GESTE DEPUIS LE LIEN (relecture adverse du 08/10/2026) : garder la ligne telle
      -- quelle laissait sur la fiche Vitisoft le rappel et les notes de la piste, en double
      -- avec ce qu'on rend a la piste, et perdait le rappel Vitisoft d'origine. Fusion a
      -- trois, champ par champ : ce qui a change depuis le lien reste ; ce qui n'a pas
      -- bouge reprend sa valeur d'avant le lien (celle de Vitisoft, ou rien).
      fin := (select jsonb_object_agg(k,
                case when cur->k is distinct from j.suivi_reuni->k then cur->k
                     else coalesce(j.suivi_client->k, 'null'::jsonb) end)
                from unnest(array['statut','notes','rappel','rappel_titre','canal','tags','proprietaire']) k);
      update public.suivi_clients s set
          statut = fin->>'statut', notes = fin->>'notes', rappel = (fin->>'rappel')::date,
          rappel_titre = fin->>'rappel_titre', canal = fin->>'canal',
          tags = coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(fin->'tags') = 'array' then fin->'tags' else '[]'::jsonb end)), '{}'),
          proprietaire = (fin->>'proprietaire')::uuid, maj_le = now()
       where s.bureau = p_bureau and s.client_id = c;
      etat := 'garde';
    end if;
    if j.suivi_piste is not null then
      delete from public.suivi_clients s where s.bureau = p_bureau and s.client_id = cle;
      insert into public.suivi_clients select * from jsonb_populate_record(null::public.suivi_clients, j.suivi_piste);
    end if;
    delete from public.liens_nouveaux l where l.bureau = p_bureau and l.piste_id = p_piste;
  end if;

  return jsonb_build_object('delie', true, 'client_id', c, 'echanges', n, 'suivi_vitisoft', etat);
end
$$;
revoke all on function public.delier_de_vitisoft(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delier_de_vitisoft(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 7. FUSIONNER DEUX NOUVEAUX CLIENTS (definitif)
-- ---------------------------------------------------------------------------
-- `p_garde` reste, `p_absorbe` disparait apres lui avoir tout donne : suivi (reuni),
-- journal, affaires, et les champs que `p_garde` n'a pas remplis (SIRET compris).
-- Les devis gardent leur copie de l'acheteur : un devis envoye est fige (lot 47). Leur
-- `piste_id` (sans cle etrangere) designe alors une fiche disparue : aucun code ne le lit,
-- c'est l'affaire, deplacee ici, qui porte le lien.
-- Rend { garde, echanges, affaires }.
create or replace function public.fusionner_nouveaux(p_bureau uuid, p_garde uuid, p_absorbe uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g public.pistes; a public.pistes; ne int; na int;
        cg text := 'p:' || p_garde::text; ca text := 'p:' || p_absorbe::text;
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'ce bureau n''est pas le tien' using errcode = '42501';
  end if;
  if p_garde is null or p_absorbe is null or p_garde = p_absorbe then
    raise exception 'il faut deux nouveaux clients differents' using errcode = '22023';
  end if;
  -- Toujours dans le meme ordre : deux fusions croisees ne s'attendent pas l'une l'autre.
  perform 1 from public.pistes x where x.bureau = p_bureau and x.piste_id in (p_garde, p_absorbe)
   order by x.piste_id for update;
  select * into g from public.pistes x where x.bureau = p_bureau and x.piste_id = p_garde;
  if not found then raise exception 'ce nouveau client n''existe pas dans ce bureau' using errcode = '23503'; end if;
  select * into a from public.pistes x where x.bureau = p_bureau and x.piste_id = p_absorbe;
  if not found then raise exception 'ce nouveau client n''existe pas dans ce bureau' using errcode = '23503'; end if;
  if g.opposition or a.opposition then
    raise exception 'cette personne a demande a ne plus etre contactee' using errcode = '42501';
  end if;
  if g.client_id is not null or a.client_id is not null then
    raise exception 'un client deja relie a Vitisoft se delie avant de fusionner' using errcode = '23514';
  end if;

  perform public.suivi_reunir(p_bureau, ca, cg);
  update public.echanges e set client_id = cg where e.bureau = p_bureau and e.client_id = ca;
  get diagnostics ne = row_count;
  -- Une affaire dont le « suivi par » a quitte le bureau serait refusee par affaires_signer
  -- (lot 34) et ferait echouer toute la fusion : elle perd ce nom, comme a la sortie du membre.
  update public.affaires f set piste_id = p_garde,
         proprietaire = case when public.affaires_proprietaire_ok(f.bureau, f.proprietaire) then f.proprietaire end
   where f.bureau = p_bureau and f.piste_id = p_absorbe;
  get diagnostics na = row_count;
  -- LES NOTES DE LA FICHE ABSORBEE NE SE COUPENT PAS (relecture adverse du 08/10/2026) : la
  -- colonne tient 2 000 caracteres. Si les deux ne tiennent pas ensemble, celles de la
  -- fiche absorbee vont ENTIERES au journal de la fiche gardee, datees de la fusion.
  if nullif(btrim(coalesce(a.notes, '')), '') is not null and nullif(btrim(coalesce(g.notes, '')), '') is not null
     and btrim(g.notes) <> btrim(a.notes) and char_length(g.notes) + 1 + char_length(a.notes) > 2000 then
    insert into public.echanges (bureau, echange_id, client_id, type, resume)
    values (p_bureau, 'fusion-' || replace(p_absorbe::text, '-', ''), cg, 'note',
            'Notes de la fiche « ' || a.nom || ' », fondue ici : ' || a.notes);
    a.notes := null;
  end if;

  -- Le SIRET est unique dans le bureau : on le libere avant de le donner.
  update public.pistes x set siret = null where x.bureau = p_bureau and x.piste_id = p_absorbe;
  update public.pistes x set
      nature           = case when coalesce(g.nature, 'autre') = 'autre' then coalesce(a.nature, g.nature) else g.nature end,
      contact_nom      = coalesce(nullif(g.contact_nom, ''), a.contact_nom),
      contact_fonction = coalesce(nullif(g.contact_fonction, ''), a.contact_fonction),
      email            = coalesce(nullif(g.email, ''), a.email),
      telephone        = coalesce(nullif(g.telephone, ''), a.telephone),
      adresse          = coalesce(nullif(g.adresse, ''), a.adresse),
      code_postal      = coalesce(nullif(g.code_postal, ''), a.code_postal),
      ville            = coalesce(nullif(g.ville, ''), a.ville),
      pays             = coalesce(nullif(g.pays, ''), a.pays),
      siret            = coalesce(g.siret, a.siret),
      notes            = case
                           when nullif(btrim(coalesce(a.notes, '')), '') is null then g.notes
                           when nullif(btrim(coalesce(g.notes, '')), '') is null then a.notes
                           when btrim(g.notes) = btrim(a.notes) then g.notes
                           else g.notes || E'\n' || a.notes end,
      pas_vitisoft     = array(select distinct t from unnest(g.pas_vitisoft || a.pas_vitisoft) t order by t)
   where x.bureau = p_bureau and x.piste_id = p_garde;
  delete from public.pistes x where x.bureau = p_bureau and x.piste_id = p_absorbe;

  return jsonb_build_object('garde', p_garde, 'echanges', ne, 'affaires', na);
end
$$;
revoke all on function public.fusionner_nouveaux(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.fusionner_nouveaux(uuid, uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 8. « CE N'EST PAS LUI », SANS PERDRE LA REPONSE D'UN COLLEGUE
-- ---------------------------------------------------------------------------
-- Ajoute le numero dans la base elle-meme : deux « Non » en meme temps (lire, ajouter,
-- reecrire depuis deux navigateurs) en perdaient un, et la question revenait.
create or replace function public.piste_ecarter(p_bureau uuid, p_piste uuid, p_client text)
returns text[] language plpgsql security definer set search_path = '' as $$
declare r text[];
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'ce bureau n''est pas le tien' using errcode = '42501';
  end if;
  update public.pistes x set pas_vitisoft = array(select distinct t from unnest(x.pas_vitisoft || array[btrim(p_client)]) t order by t)
   where x.bureau = p_bureau and x.piste_id = p_piste and nullif(btrim(coalesce(p_client, '')), '') is not null
   returning x.pas_vitisoft into r;
  if not found then
    raise exception 'ce nouveau client n''existe pas dans ce bureau' using errcode = '23503';
  end if;
  return r;
end
$$;
revoke all on function public.piste_ecarter(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.piste_ecarter(uuid, uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 9. LE DECLENCHEUR DU LOT 80 ATTEND UN LIEN EN COURS
-- ---------------------------------------------------------------------------
-- Relecture adverse du 08/10/2026, verifiee a deux sessions : pendant qu'une transaction
-- relie une piste, une note ecrite en meme temps sous « p:... » lisait encore la piste non
-- reliee et passait. Elle restait sous l'ancienne cle, invisible tant que dure le lien.
-- `for share` fait attendre la fin du lien : la note est alors refusee (23514) et l'ecran le
-- dit. Seul changement par rapport au lot 80 : ce verrou.
create or replace function public.cle_client_verifier()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pid uuid; v_p record;
begin
  if new.client_id is null or left(new.client_id, 2) <> 'p:' then
    return new;
  end if;
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  v_pid := public.piste_de_cle(new.client_id);
  if v_pid is null then
    raise exception 'cle de nouveau client mal formee' using errcode = '22023';
  end if;
  select p.opposition, p.client_id into v_p
    from public.pistes p where p.bureau = new.bureau and p.piste_id = v_pid for share;
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
