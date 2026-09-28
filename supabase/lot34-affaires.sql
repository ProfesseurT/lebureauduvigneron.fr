-- ============================================================================
-- LOT 34, 28/09/2026 : LES AFFAIRES. A COLLER DANS SUPABASE, APRES LE LOT 33.
-- ============================================================================
--
-- Ce que Ted a decide du 26 au 28/09/2026, et que ce lot porte :
--
--   1. LE VIGNERON CREE SES TYPES D'AFFAIRES ET LEURS ETAPES (prospection, mariages,
--      seminaires...). Chaque type se rattache a une FAMILLE fixe (conquete, evenement,
--      client) : c'est elle qui dit ce que le bureau calculera, et elle garde les chiffres
--      comparables d'un vigneron a l'autre.
--   2. UNE AFFAIRE PORTE SUR UNE PISTE (pas encore cliente) OU SUR UN CLIENT VITISOFT,
--      jamais les deux. Une piste gagnee devient cliente dans Vitisoft ; le lien se pose
--      plus tard, dans `pistes.client_id`, et la piste ne disparait jamais.
--   3. DEUX FINS SEULEMENT, « gagnee » et « perdue » (a l'ecran « Pas pour cette fois »),
--      et elles ne sont PAS des etapes : ce sont des valeurs de `affaires.issue`. Un
--      vigneron ne peut donc ni les renommer ni les supprimer.
--   4. TOUT LE BUREAU LIT ET ECRIT, et la base signe chaque geste (`maj_par`), sur le
--      modele du lot 33. Arbitrage par defaut, a rouvrir si Ted le veut.
--   5. « VIDER LA BASE » NE TOUCHE PAS AUX AFFAIRES : elles ne viennent pas d'un export.
--      Ce lot ne modifie donc pas `effacer_mes_donnees()`.
--
-- CE QUI N'EST PAS DANS CE LOT : le devis, la signature, l'envoi a Vitisoft, le retour
-- de facture (lots suivants), et le journal des echanges d'une piste (a trancher).
--
-- LA BASE REFUSE CE QUE L'ECRAN NE DOIT PAS PERMETTRE, et pas l'inverse :
--   - supprimer une etape qui porte encore une affaire (cle etrangere `restrict`) ;
--   - plus de six etapes par type (declencheur) ;
--   - une etape qui n'appartient pas au type de l'affaire (declencheur) ;
--   - un proprietaire qui n'est pas membre du bureau (declencheur).
--
-- REJOUABLE : chaque instruction se repasse sans erreur.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. LES TYPES D'AFFAIRES
-- ---------------------------------------------------------------------------
create table if not exists public.affaire_types (
  bureau        uuid not null references public.bureaux(bureau) on delete cascade,
  type_id       uuid not null default gen_random_uuid(),
  nom           text not null check (char_length(btrim(nom)) between 1 and 60),
  famille       text not null default 'conquete'
                check (famille in ('conquete', 'evenement', 'client')),
  sommeil_jours integer not null default 30 check (sommeil_jours between 1 and 365),
  ordre         integer not null default 0,
  archive       boolean not null default false,
  cree_par      uuid default auth.uid() references auth.users(id) on delete set null,
  maj_par       uuid default auth.uid() references auth.users(id) on delete set null,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now(),
  primary key (bureau, type_id),
  constraint affaire_types_nom unique (bureau, nom)
);


-- ---------------------------------------------------------------------------
-- 2. LES ETAPES D'UN TYPE
-- ---------------------------------------------------------------------------
-- Supprimer un type supprime ses etapes, SAUF si une affaire y est encore : la cle
-- etrangere `restrict` des affaires bloque alors toute la cascade. C'est voulu.
create table if not exists public.affaire_etapes (
  bureau    uuid not null,
  etape_id  uuid not null default gen_random_uuid(),
  type_id   uuid not null,
  nom       text not null check (char_length(btrim(nom)) between 1 and 60),
  ordre     integer not null default 0,
  cree_le   timestamptz not null default now(),
  primary key (bureau, etape_id),
  constraint affaire_etapes_type_fk foreign key (bureau, type_id)
    references public.affaire_types(bureau, type_id) on delete cascade,
  constraint affaire_etapes_nom unique (bureau, type_id, nom)
);

create index if not exists affaire_etapes_type on public.affaire_etapes (bureau, type_id, ordre);


-- ---------------------------------------------------------------------------
-- 3. LES PISTES (des etablissements qui ne sont pas encore clients)
-- ---------------------------------------------------------------------------
-- `client_id` est la cle du client dans « Mes clients » une fois la piste devenue
-- cliente. Vide tant que le lien n'est pas pose. Un client n'est lie qu'a une piste.
-- `opposition` : la personne a demande a ne plus etre contactee (RGPD, droit
-- d'opposition). On garde le nom pour ne pas la rappeler, on efface le reste.
create table if not exists public.pistes (
  bureau           uuid not null references public.bureaux(bureau) on delete cascade,
  piste_id         uuid not null default gen_random_uuid(),
  nom              text not null check (char_length(btrim(nom)) between 1 and 120),
  nature           text not null default 'autre'
                   check (nature in ('caviste', 'restaurant', 'importateur', 'ce', 'particulier', 'autre')),
  contact_nom      text check (contact_nom is null or char_length(contact_nom) <= 120),
  contact_fonction text check (contact_fonction is null or char_length(contact_fonction) <= 80),
  email            text check (email is null or char_length(email) <= 200),
  telephone        text check (telephone is null or char_length(telephone) <= 40),
  ville            text check (ville is null or char_length(ville) <= 80),
  code_postal      text check (code_postal is null or char_length(code_postal) <= 12),
  pays             text check (pays is null or char_length(pays) <= 60),
  source           text check (source is null or char_length(source) <= 120),
  notes            text check (notes is null or char_length(notes) <= 2000),
  client_id        text,
  lie_par          uuid references auth.users(id) on delete set null,
  lie_le           timestamptz,
  opposition       boolean not null default false,
  cree_par         uuid default auth.uid() references auth.users(id) on delete set null,
  maj_par          uuid default auth.uid() references auth.users(id) on delete set null,
  cree_le          timestamptz not null default now(),
  maj_le           timestamptz not null default now(),
  primary key (bureau, piste_id)
);

create unique index if not exists pistes_client_unique
  on public.pistes (bureau, client_id) where client_id is not null;


-- ---------------------------------------------------------------------------
-- 4. LES AFFAIRES
-- ---------------------------------------------------------------------------
-- UNE PISTE OU UN CLIENT, JAMAIS LES DEUX, JAMAIS AUCUN : la contrainte `sujet`.
-- `etape_le` : date d'entree dans l'etape en cours, posee par la base. C'est d'elle
-- que se deduit l'affaire « endormie », jamais d'une date tapee.
-- `motif` n'existe que pour une affaire perdue (contrainte `motif_si_perdue`).
create table if not exists public.affaires (
  bureau        uuid not null references public.bureaux(bureau) on delete cascade,
  affaire_id    uuid not null default gen_random_uuid(),
  type_id       uuid not null,
  etape_id      uuid not null,
  piste_id      uuid,
  client_id     text,
  titre         text not null check (char_length(btrim(titre)) between 1 and 120),
  issue         text not null default 'en_cours'
                check (issue in ('en_cours', 'gagnee', 'perdue')),
  motif         text check (motif is null or motif in
                  ('prix', 'fournisseur', 'moment', 'sans_reponse', 'indisponible', 'autre')),
  notes         text check (notes is null or char_length(notes) <= 2000),
  rappel        date,
  rappel_titre  text check (rappel_titre is null or char_length(rappel_titre) <= 120),
  proprietaire  uuid references auth.users(id) on delete set null,
  etape_le      timestamptz not null default now(),
  ouverte_le    timestamptz not null default now(),
  close_le      timestamptz,
  cree_par      uuid default auth.uid() references auth.users(id) on delete set null,
  maj_par       uuid default auth.uid() references auth.users(id) on delete set null,
  maj_le        timestamptz not null default now(),
  primary key (bureau, affaire_id),
  constraint affaires_type_fk  foreign key (bureau, type_id)
    references public.affaire_types(bureau, type_id) on delete restrict,
  constraint affaires_etape_fk foreign key (bureau, etape_id)
    references public.affaire_etapes(bureau, etape_id) on delete restrict,
  constraint affaires_piste_fk foreign key (bureau, piste_id)
    references public.pistes(bureau, piste_id) on delete restrict,
  constraint affaires_sujet check ((piste_id is null) <> (client_id is null)),
  constraint affaires_motif_si_perdue check (motif is null or issue = 'perdue')
);

create index if not exists affaires_issue  on public.affaires (bureau, issue);
create index if not exists affaires_piste  on public.affaires (bureau, piste_id) where piste_id is not null;
create index if not exists affaires_client on public.affaires (bureau, client_id) where client_id is not null;
create index if not exists affaires_rappel on public.affaires (bureau, rappel) where issue = 'en_cours';


-- ---------------------------------------------------------------------------
-- 5. LES DECLENCHEURS
-- ---------------------------------------------------------------------------
-- `security definer` pour lire `membres` et `affaire_etapes` quoi qu'en disent les
-- politiques de l'appelant. `auth.uid()` reste celui de l'appelant : il vient du jeton
-- de la requete. Aucune de ces fonctions ne s'appelle en RPC (revoke plus bas).

create or replace function public.affaires_proprietaire_ok(b uuid, p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p is null or exists (select 1 from public.membres m where m.bureau = b and m.personne = p)
$$;

create or replace function public.affaire_types_signer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.cree_par := coalesce(auth.uid(), new.cree_par); new.cree_le := now();
  else
    new.cree_par := old.cree_par; new.cree_le := old.cree_le;
  end if;
  if auth.uid() is not null then new.maj_par := auth.uid(); end if;
  new.maj_le := now();
  return new;
end
$$;

create or replace function public.affaire_etapes_plafond()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.affaire_etapes e
       where e.bureau = new.bureau and e.type_id = new.type_id
         and e.etape_id <> new.etape_id) >= 6 then
    raise exception 'six etapes au plus par type d''affaire' using errcode = '23514';
  end if;
  return new;
end
$$;

create or replace function public.pistes_signer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare avant text;
begin
  if tg_op = 'INSERT' then
    new.cree_par := coalesce(auth.uid(), new.cree_par); new.cree_le := now();
    avant := null;
  else
    new.cree_par := old.cree_par; new.cree_le := old.cree_le;
    new.lie_par := old.lie_par; new.lie_le := old.lie_le;
    avant := old.client_id;
  end if;
  if auth.uid() is not null then new.maj_par := auth.uid(); end if;
  new.maj_le := now();
  -- Le lien vers un client se signe par la base, comme le reste.
  if new.client_id is distinct from avant then
    if new.client_id is null then
      new.lie_par := null; new.lie_le := null;
    else
      new.lie_par := auth.uid(); new.lie_le := now();
    end if;
  elsif tg_op = 'INSERT' then
    new.lie_par := null; new.lie_le := null;
  end if;
  -- L'opposition efface les coordonnees et garde le nom : ne plus la rappeler.
  if new.opposition then
    new.contact_nom := null; new.contact_fonction := null;
    new.email := null; new.telephone := null; new.notes := null;
  end if;
  return new;
end
$$;

create or replace function public.affaires_signer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then new.maj_par := auth.uid(); end if;
  new.maj_le := now();

  if not public.affaires_proprietaire_ok(new.bureau, new.proprietaire) then
    raise exception 'proprietaire hors du bureau' using errcode = '23514';
  end if;

  if not exists (select 1 from public.affaire_etapes e
                  where e.bureau = new.bureau and e.etape_id = new.etape_id
                    and e.type_id = new.type_id) then
    raise exception 'etape hors du type de l''affaire' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.cree_par := coalesce(auth.uid(), new.cree_par);
    new.etape_le := now();
    new.ouverte_le := now();
  else
    new.cree_par := old.cree_par;
    new.ouverte_le := old.ouverte_le;
  end if;

  if tg_op = 'INSERT' then
    null;
  elsif new.etape_id is distinct from old.etape_id then
    new.etape_le := now();
  else
    new.etape_le := old.etape_le;
  end if;

  if new.issue = 'en_cours' then
    new.close_le := null;
    new.motif := null;
  elsif tg_op = 'INSERT' then
    new.close_le := now();
  elsif old.issue = 'en_cours' then
    new.close_le := now();
  else
    new.close_le := old.close_le;
  end if;

  -- Une affaire close n'a plus de rappel : elle ne doit plus remonter dans la journee.
  if new.issue <> 'en_cours' then
    new.rappel := null; new.rappel_titre := null;
  end if;
  return new;
end
$$;

revoke all on function public.affaires_proprietaire_ok(uuid, uuid) from public, anon, authenticated;
revoke all on function public.affaire_types_signer()   from public, anon, authenticated;
revoke all on function public.affaire_etapes_plafond() from public, anon, authenticated;
revoke all on function public.pistes_signer()          from public, anon, authenticated;
revoke all on function public.affaires_signer()        from public, anon, authenticated;

drop trigger if exists affaire_types_signer on public.affaire_types;
create trigger affaire_types_signer
  before insert or update on public.affaire_types
  for each row execute function public.affaire_types_signer();

drop trigger if exists affaire_etapes_plafond on public.affaire_etapes;
create trigger affaire_etapes_plafond
  before insert or update of type_id on public.affaire_etapes
  for each row execute function public.affaire_etapes_plafond();

drop trigger if exists pistes_signer on public.pistes;
create trigger pistes_signer
  before insert or update on public.pistes
  for each row execute function public.pistes_signer();

drop trigger if exists affaires_signer on public.affaires;
create trigger affaires_signer
  before insert or update on public.affaires
  for each row execute function public.affaires_signer();


-- ---------------------------------------------------------------------------
-- 6. LES POLITIQUES : TOUT LE BUREAU, ET RIEN QUE LUI
-- ---------------------------------------------------------------------------
-- Forme « IN », jamais `est_membre(bureau)` : une politique ne passe jamais une
-- colonne a une fonction (regle du 17/09/2026).
alter table public.affaire_types  enable row level security;
alter table public.affaire_etapes enable row level security;
alter table public.pistes         enable row level security;
alter table public.affaires       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['affaire_types', 'affaire_etapes', 'pistes', 'affaires'] loop
    execute format('drop policy if exists %I on public.%I', t || '_lire', t);
    execute format('drop policy if exists %I on public.%I', t || '_creer', t);
    execute format('drop policy if exists %I on public.%I', t || '_modifier', t);
    execute format('drop policy if exists %I on public.%I', t || '_supprimer', t);
    execute format('create policy %I on public.%I for select to authenticated using '
      || '( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) )',
      t || '_lire', t);
    execute format('create policy %I on public.%I for insert to authenticated with check '
      || '( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) )',
      t || '_creer', t);
    execute format('create policy %I on public.%I for update to authenticated using '
      || '( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) ) with check '
      || '( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) )',
      t || '_modifier', t);
    execute format('create policy %I on public.%I for delete to authenticated using '
      || '( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) )',
      t || '_supprimer', t);
  end loop;
end
$$;

-- Supabase accorde TOUT par defaut : un `grant` seul ne retire rien (regle du 09/09/2026).
revoke all on public.affaire_types, public.affaire_etapes, public.pistes, public.affaires from anon, authenticated;
grant select, insert, update, delete on public.affaire_types, public.affaire_etapes, public.pistes, public.affaires to authenticated;
-- Les colonnes de signature (cree_par, maj_par, lie_par, les dates) ne se protegent PAS
-- par un `revoke update (colonne)` : un droit de table les couvre toutes et un retrait de
-- colonne n'y change rien. Ce sont les declencheurs qui les reecrivent a chaque geste.


-- ---------------------------------------------------------------------------
-- 7. LA PURGE RGPD DES PISTES : TROIS ANS SANS SIGNE DE VIE
-- ---------------------------------------------------------------------------
-- Une piste jamais devenue cliente, sans affaire en cours et sans geste depuis trois
-- ans perd ses coordonnees (reference CNIL pour la prospection). Le nom et l'historique
-- des affaires restent : ce ne sont pas des donnees personnelles de contact.
-- La page rgpd ne l'annoncera qu'une fois cette tache en place (regle du 11/09/2026).
create or replace function public.pistes_purger()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  update public.pistes p
     set contact_nom = null, contact_fonction = null, email = null, telephone = null, notes = null
   where p.client_id is null
     and p.maj_le < now() - interval '3 years'
     and (p.contact_nom is not null or p.email is not null or p.telephone is not null or p.notes is not null)
     and not exists (select 1 from public.affaires a
                      where a.bureau = p.bureau and a.piste_id = p.piste_id
                        and (a.issue = 'en_cours' or a.maj_le >= now() - interval '3 years'));
  get diagnostics n = row_count;
  return n;
end
$$;

-- Les trois roles NOMMEMENT : un revoke sur `public` seul ne retire rien (regle du 13/09/2026).
revoke all on function public.pistes_purger() from public, anon, authenticated;

select cron.unschedule('pistes-purge') where exists (select 1 from cron.job where jobname = 'pistes-purge');
select cron.schedule('pistes-purge', '29 3 * * 1', $cron$ select public.pistes_purger(); $cron$);


-- ---------------------------------------------------------------------------
-- CONTROLES, a lancer apres (ils ne modifient rien)
-- ---------------------------------------------------------------------------
-- select tablename, count(*) from pg_policies
--  where tablename in ('affaire_types','affaire_etapes','pistes','affaires') group by 1 order by 1;
--   -> 4 lignes, 4 politiques chacune
-- select grantee, table_name, privilege_type from information_schema.role_table_grants
--  where table_name in ('affaires','pistes') and grantee = 'anon';
--   -> aucune ligne
-- select jobname, schedule from cron.job where jobname = 'pistes-purge';
--   -> 1 ligne
