-- ============================================================================
-- LOT 87, 08/10/2026 : BRANCHER BREVO. A COLLER DANS SUPABASE, APRES LE LOT 86.
-- ============================================================================
-- Arbitrages de Ted du 08/10/2026 (CLAUDE.md « BREVO ») :
--   - UNE cle API Brevo par bureau, collee par le MAITRE ;
--   - le maitre choisit ce qui part par Brevo PAR DEFAUT : les mails d'affaire et de fiche
--     client, les devis et commandes, les mails programmes ;
--   - CHAQUE PERSONNE choisit son adresse d'expediteur (parmi celles validees chez Brevo) et
--     peut faire passer SES mails par sa boite (Gmail ou serveur) au lieu de Brevo.
-- CE LOT BRANCHE ET REGLE. IL NE FAIT PARTIR AUCUN MAIL PAR BREVO : c'est le lot 88.
--
-- LA CLE :
--   - [Certain, aide Brevo lue le 08/10/2026] elle ouvre TOUT le compte Brevo du domaine et ne
--     se limite pas : elle est rangee dans Vault, chiffree, et nulle part ailleurs ;
--   - elle n'arrive en base QUE par `brevo_ranger()`, appelee par la fonction Edge `brevo` avec
--     la cle de service, APRES que Brevo l'a acceptee (lecture du compte). Une cle refusee ne
--     laisse rien ;
--   - personne ne la relit depuis le navigateur, pas meme le maitre : `secret_id` n'est pas
--     lisible par `authenticated` (droits par colonne). On garde ses 4 derniers signes pour
--     que le maitre la reconnaisse ;
--   - retirer Brevo, ou supprimer le bureau, efface le secret de Vault (`brevo_oublier`).
-- « VIDER LA BASE » N'Y TOUCHE PAS. REJOUABLE.
-- ============================================================================

create table if not exists public.brevo (
  bureau            uuid primary key references public.bureaux on delete cascade,
  secret_id         uuid,
  etat              text not null default 'branche',
  compte_email      text,
  compte_nom        text,
  cle_fin           text,
  defaut_affaires   boolean not null default true,
  defaut_devis      boolean not null default true,
  defaut_programmes boolean not null default true,
  branche_le        timestamptz not null default now(),
  branche_par       uuid references auth.users on delete set null,
  verifie_le        timestamptz,
  erreur            text,
  maj_le            timestamptz not null default now(),
  constraint brevo_etat check (etat in ('branche', 'refusee')),
  constraint brevo_secret check (secret_id is not null),
  constraint brevo_cle_fin check (cle_fin is null or cle_fin ~ '^[A-Za-z0-9_-]{1,4}$'),
  constraint brevo_compte_email check (compte_email is null or char_length(compte_email) <= 254),
  constraint brevo_compte_nom check (compte_nom is null or char_length(compte_nom) <= 120),
  constraint brevo_erreur check (erreur is null or char_length(erreur) <= 300)
);

-- Le choix de chaque personne. Une ligne n'existe que si la personne a choisi quelque chose.
--   chemin = 'bureau' : ses mails suivent ce que le maitre a regle ;
--   chemin = 'boite'  : ses mails partent par sa boite branchee (lot 76 / 86), pas par Brevo.
-- L'adresse d'expediteur est controlee par Brevo a l'envoi (lot 88) : ici, sa forme seulement.
create table if not exists public.brevo_choix (
  bureau         uuid not null,
  personne       uuid not null,
  chemin         text not null default 'bureau',
  expediteur     text,
  expediteur_nom text,
  maj_le         timestamptz not null default now(),
  primary key (bureau, personne),
  foreign key (bureau, personne) references public.membres (bureau, personne) on delete cascade,
  constraint brevo_choix_chemin check (chemin in ('bureau', 'boite')),
  constraint brevo_choix_expediteur check (expediteur is null or (char_length(expediteur) <= 254
    and expediteur ~* '^[^@\s()<>,;:"\[\]\\]+@[^@\s()<>,;:"\[\]\\]+\.[a-z]{2,}$')),
  constraint brevo_choix_nom check (expediteur_nom is null or (char_length(expediteur_nom) between 1 and 80
    and expediteur_nom !~ '[[:cntrl:]@<>"\\]'))
);

alter table public.brevo enable row level security;
alter table public.brevo_choix enable row level security;
drop policy if exists brevo_lire on public.brevo;
-- Tout le bureau lit l'etat de Brevo (sans la cle) : chacun doit savoir si ses mails peuvent y passer.
create policy brevo_lire on public.brevo for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
drop policy if exists brevo_choix_lire on public.brevo_choix;
-- Chacun lit SON choix. Le maitre n'en a pas besoin pour ce lot.
create policy brevo_choix_lire on public.brevo_choix for select to authenticated using
  ( personne = (select auth.uid())
    and bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
revoke all on public.brevo from anon, authenticated;
revoke all on public.brevo_choix from anon, authenticated;
grant select (bureau, etat, compte_email, compte_nom, cle_fin, defaut_affaires, defaut_devis,
  defaut_programmes, branche_le, verifie_le, erreur, maj_le) on public.brevo to authenticated;
grant select on public.brevo_choix to authenticated;

-- ---------------------------------------------------------------- OUBLIER LE SECRET
create or replace function public.brevo_oublier()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.secret_id is not null then
    delete from vault.secrets where id = old.secret_id;
  end if;
  return old;
end $$;
revoke all on function public.brevo_oublier() from public, anon, authenticated;
drop trigger if exists brevo_oublier on public.brevo;
create trigger brevo_oublier after delete on public.brevo
  for each row execute function public.brevo_oublier();

-- ---------------------------------------------------------------- EST-CE LE MAITRE ?
-- Pour la cle de service, qui n'a pas d'auth.uid().
create or replace function public.brevo_est_maitre(p_personne uuid, p_bureau uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membres m
    where m.bureau = p_bureau and m.personne = p_personne and m.role = 'maitre');
$$;
revoke all on function public.brevo_est_maitre(uuid, uuid) from public, anon, authenticated;
grant execute on function public.brevo_est_maitre(uuid, uuid) to service_role;

create or replace function public.brevo_est_membre(p_personne uuid, p_bureau uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne);
$$;
revoke all on function public.brevo_est_membre(uuid, uuid) from public, anon, authenticated;
grant execute on function public.brevo_est_membre(uuid, uuid) to service_role;

-- ---------------------------------------------------------------- RANGER (cle de service seule)
-- Apres que Brevo a accepte la cle. Cree ou remplace le secret ; garde les reglages par defaut
-- deja poses quand on remplace une cle.
create or replace function public.brevo_ranger(p_personne uuid, p_bureau uuid, p_cle text,
  p_email text, p_nom text)
returns text language plpgsql security definer set search_path = '' as $$
declare s uuid; nom text := 'brevo:' || p_bureau; c text := btrim(coalesce(p_cle, ''));
begin
  if not public.brevo_est_maitre(p_personne, p_bureau) then
    raise exception 'seul le maitre du bureau branche Brevo' using errcode = '42501';
  end if;
  if char_length(c) not between 20 and 200 or c ~ '\s' then
    raise exception 'cle absente ou invalide' using errcode = '22023';
  end if;
  select b.secret_id into s from public.brevo b where b.bureau = p_bureau for update;
  if s is not null and exists (select 1 from vault.secrets v where v.id = s) then
    perform vault.update_secret(s, c, nom, 'Cle API Brevo, Le Bureau du Vigneron', null);
  else
    s := vault.create_secret(c, nom, 'Cle API Brevo, Le Bureau du Vigneron', null);
  end if;
  insert into public.brevo as b (bureau, secret_id, etat, compte_email, compte_nom, cle_fin,
      branche_le, branche_par, verifie_le, erreur, maj_le)
  values (p_bureau, s, 'branche', nullif(left(btrim(coalesce(p_email, '')), 254), ''),
      nullif(left(regexp_replace(btrim(coalesce(p_nom, '')), '[[:cntrl:]]', '', 'g'), 120), ''),
      nullif(regexp_replace(right(c, 4), '[^A-Za-z0-9_-]', '', 'g'), ''),
      now(), p_personne, now(), null, now())
  on conflict on constraint brevo_pkey do update set
      secret_id = excluded.secret_id, etat = 'branche', compte_email = excluded.compte_email,
      compte_nom = excluded.compte_nom, cle_fin = excluded.cle_fin, branche_le = now(),
      branche_par = excluded.branche_par, verifie_le = now(), erreur = null, maj_le = now();
  return 'branche';
end $$;
revoke all on function public.brevo_ranger(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.brevo_ranger(uuid, uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------- LIRE LA CLE (cle de service seule)
-- Pour la fonction Edge, et seulement apres avoir verifie que l'appelant est membre du bureau.
create or replace function public.brevo_cle(p_bureau uuid)
returns text language sql stable security definer set search_path = '' as $$
  select v.decrypted_secret from public.brevo b join vault.decrypted_secrets v on v.id = b.secret_id
   where b.bureau = p_bureau;
$$;
revoke all on function public.brevo_cle(uuid) from public, anon, authenticated;
grant execute on function public.brevo_cle(uuid) to service_role;

-- ---------------------------------------------------------------- L'ETAT VU PAR BREVO (cle de service)
-- 'branche' quand Brevo a repondu, 'refusee' quand Brevo a refuse la cle (desactivee, supprimee,
-- adresse internet bloquee). Le motif est un texte du bureau, jamais un texte de Brevo.
create or replace function public.brevo_noter(p_bureau uuid, p_etat text, p_erreur text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_etat not in ('branche', 'refusee') then raise exception 'etat inconnu' using errcode = '22023'; end if;
  update public.brevo set etat = p_etat, verifie_le = now(),
      erreur = case when p_etat = 'branche' then null else left(p_erreur, 300) end, maj_le = now()
    where bureau = p_bureau;
  return found;
end $$;
revoke all on function public.brevo_noter(uuid, text, text) from public, anon, authenticated;
grant execute on function public.brevo_noter(uuid, text, text) to service_role;

-- ---------------------------------------------------------------- REGLER (le maitre)
-- Ce qui part par Brevo par defaut. Un NULL laisse la valeur en place.
create or replace function public.brevo_regler(p_bureau uuid, p_affaires boolean, p_devis boolean,
  p_programmes boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_maitre(p_bureau) then
    raise exception 'seul le maitre du bureau regle Brevo' using errcode = '42501';
  end if;
  update public.brevo set defaut_affaires = coalesce(p_affaires, defaut_affaires),
      defaut_devis = coalesce(p_devis, defaut_devis),
      defaut_programmes = coalesce(p_programmes, defaut_programmes), maj_le = now()
    where bureau = p_bureau;
  return found;
end $$;
revoke all on function public.brevo_regler(uuid, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.brevo_regler(uuid, boolean, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------- RETIRER (le maitre)
-- La ligne part, et le declencheur efface la cle de Vault. Les choix des personnes restent :
-- ils reservent si Brevo est rebranche.
create or replace function public.brevo_retirer(p_bureau uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_maitre(p_bureau) then
    raise exception 'seul le maitre du bureau retire Brevo' using errcode = '42501';
  end if;
  delete from public.brevo where bureau = p_bureau;
  return found;
end $$;
revoke all on function public.brevo_retirer(uuid) from public, anon, authenticated;
grant execute on function public.brevo_retirer(uuid) to authenticated;

-- ---------------------------------------------------------------- CHOISIR (chaque personne)
-- Son chemin et son expediteur. Un NULL laisse la valeur en place ; une chaine vide efface
-- l'expediteur (ou son nom).
create or replace function public.brevo_choisir(p_bureau uuid, p_chemin text, p_expediteur text,
  p_nom text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null or not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = moi) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  insert into public.brevo_choix as c (bureau, personne, chemin, expediteur, expediteur_nom, maj_le)
  values (p_bureau, moi, coalesce(p_chemin, 'bureau'),
      nullif(lower(btrim(coalesce(p_expediteur, ''))), ''),
      nullif(regexp_replace(btrim(coalesce(p_nom, '')), '\s+', ' ', 'g'), ''), now())
  on conflict on constraint brevo_choix_pkey do update set
      chemin = coalesce(p_chemin, c.chemin),
      expediteur = case when p_expediteur is null then c.expediteur
                        else nullif(lower(btrim(p_expediteur)), '') end,
      expediteur_nom = case when p_nom is null then c.expediteur_nom
                            else nullif(regexp_replace(btrim(p_nom), '\s+', ' ', 'g'), '') end,
      maj_le = now();
  return true;
end $$;
revoke all on function public.brevo_choisir(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.brevo_choisir(uuid, text, text, text) to authenticated;

-- CONTROLES, a lancer apres (ils ne modifient rien)
-- 1) select column_name from information_schema.column_privileges
--      where table_name = 'brevo' and grantee = 'authenticated' order by 1;
--      -> 12 colonnes, pas secret_id
-- 2) select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as connecte,
--           has_function_privilege('anon', p.oid, 'execute') as anon
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname like 'brevo%' order by 1;
--      -> brevo_ranger, brevo_cle, brevo_noter, brevo_est_* : connecte faux ; anon faux partout
