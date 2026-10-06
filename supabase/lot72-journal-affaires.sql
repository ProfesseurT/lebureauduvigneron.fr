-- ===========================================================================
-- LOT 72 : LE JOURNAL DES AFFAIRES (les mails et les notes), 06/10/2026
-- ===========================================================================
-- A coller APRES le lot 71. Rejouable deux fois.
--
-- Decision de Ted (06/10/2026, choix A) : les mails ecrits depuis une affaire et les
-- notes d'un NOUVEAU client (une piste, pas encore dans Vitisoft) ont leur journal a eux.
-- Pourquoi pas `echanges` : ce journal-la est range par numero client Vitisoft (une piste
-- n'en a pas) et il part avec « Vider la base ». Les affaires et les pistes, elles,
-- restent (decision du 28/09/2026) : leur journal reste avec elles.
--
-- L'ecran MELANGE ce journal et, pour un client Vitisoft, les echanges de sa fiche.
--
-- Regles :
--   - tout le bureau LIT et ECRIT (meme regle que les affaires) ; la base signe (cree_par,
--     le) : jamais le navigateur ;
--   - personne ne modifie ni ne supprime une ligne : c'est une trace ;
--   - aucune ligne neuve sur l'affaire d'une piste en opposition ;
--   - l'opposition et la purge a trois ans effacent le CONTENU (objet, texte,
--     destinataire), gardent la date et la sorte : la trace qu'on a ecrit, sans ce
--     qu'on a ecrit ;
--   - « Vider la base » n'y touche pas.
-- ===========================================================================

create table if not exists public.affaire_echanges (
  bureau        uuid not null references public.bureaux(bureau) on delete cascade,
  echange_id    uuid not null default gen_random_uuid(),
  affaire_id    uuid not null,
  le            timestamptz not null default now(),
  type          text not null check (type in ('email', 'note')),
  canal         text check (canal is null or canal ~ '^[a-z_]{1,40}$'),
  modele        text check (modele is null or modele ~ '^[a-z_]{1,40}$'),
  destinataire  text check (destinataire is null or char_length(destinataire) <= 320),
  sujet         text check (sujet is null or char_length(sujet) <= 300),
  corps         text check (corps is null or char_length(corps) <= 20000),
  cree_par      uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (bureau, echange_id),
  constraint affaire_echanges_affaire_fk foreign key (bureau, affaire_id)
    references public.affaires(bureau, affaire_id) on delete cascade
);
create index if not exists affaire_echanges_affaire
  on public.affaire_echanges (bureau, affaire_id, le desc);

-- La base signe, et refuse ce qui ne doit pas s'ecrire.
create or replace function public.affaire_echanges_signer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.cree_par := auth.uid();
    new.le := now();
  end if;
  if new.type = 'note' and char_length(btrim(coalesce(new.corps, ''))) = 0 then
    raise exception 'une note vide ne s''ecrit pas' using errcode = '23514';
  end if;
  if new.type = 'email' and char_length(btrim(coalesce(new.sujet, ''))) = 0
     and char_length(btrim(coalesce(new.corps, ''))) = 0 then
    raise exception 'un mail sans objet ni texte ne s''ecrit pas' using errcode = '23514';
  end if;
  if exists (select 1 from public.affaires a join public.pistes p
                on p.bureau = a.bureau and p.piste_id = a.piste_id
              where a.bureau = new.bureau and a.affaire_id = new.affaire_id and p.opposition) then
    raise exception 'cette personne a demande a ne plus etre contactee' using errcode = '42501';
  end if;
  return new;
end
$$;
revoke all on function public.affaire_echanges_signer() from public, anon, authenticated;

drop trigger if exists affaire_echanges_signer on public.affaire_echanges;
create trigger affaire_echanges_signer
  before insert on public.affaire_echanges
  for each row execute function public.affaire_echanges_signer();

alter table public.affaire_echanges enable row level security;
drop policy if exists affaire_echanges_lire  on public.affaire_echanges;
drop policy if exists affaire_echanges_creer on public.affaire_echanges;
create policy affaire_echanges_lire on public.affaire_echanges for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
create policy affaire_echanges_creer on public.affaire_echanges for insert to authenticated with check
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );

-- Supabase accorde tout par defaut : on retire, puis on donne (regle du 09/09/2026).
revoke all on public.affaire_echanges from anon, authenticated;
grant select, insert on public.affaire_echanges to authenticated;


-- ---------------------------------------------------------------------------
-- L'OPPOSITION : le contenu part tout de suite (reprend la fonction du lot 56)
-- ---------------------------------------------------------------------------
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
    -- LOT 72 : ce qu'on lui a ecrit, et ce qu'on a note sur elle.
    update public.affaire_echanges x set sujet = null, corps = null, destinataire = null
      from public.affaires a
     where a.bureau = new.bureau and a.piste_id = new.piste_id
       and x.bureau = a.bureau and x.affaire_id = a.affaire_id
       and (x.sujet is not null or x.corps is not null or x.destinataire is not null);
  end if;
  return null;
end
$$;
revoke all on function public.pistes_opposition_affaires() from public, anon, authenticated;

-- Les pistes deja en opposition avant ce lot n'ont pas de journal : rien a rattraper.


-- ---------------------------------------------------------------------------
-- LA PURGE A TROIS ANS (reprend la fonction du lot 56, plus le journal)
-- ---------------------------------------------------------------------------
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
                          and (x.sujet is not null or x.corps is not null or x.destinataire is not null)))
       and not exists (select 1 from public.affaires a
                        where a.bureau = p.bureau and a.piste_id = p.piste_id
                          and (a.issue in ('en_cours', 'gagnee')
                               or a.maj_le >= now() - interval '3 years'))
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
-- CONTROLES, a lancer apres (ils ne modifient rien)
-- ---------------------------------------------------------------------------
-- select policyname, cmd from pg_policies where tablename = 'affaire_echanges';   -> 2 lignes
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name = 'affaire_echanges' and grantee in ('anon','authenticated');
--   -> authenticated INSERT et SELECT, rien d'autre
