-- ===========================================================================
-- LOT 18, 13/09/2026 : L'EQUIPE. Inviter, accepter, changer de bureau.
-- ===========================================================================
-- A coller dans l'editeur SQL Supabase (projet qukmncqqwomhmrdhvetj).
-- Recopie dans supabase/schema.sql, qui est la REFERENCE.
--
-- CE LOT NE CASSE RIEN. Il n'ajoute qu'une table et des fonctions : le code
-- deja en ligne continue de marcher pendant qu'il est passe. C'est l'inverse du
-- lot 17, et ca change l'ordre : ici on peut passer le SQL d'abord, tranquillement.
--
-- L'INVITATION EST UN LIEN, PAS UN MAIL. Arbitrage du 13/09/2026. La regle du
-- SEUIL, ecrite dans CLAUDE.md, dit qu'au premier destinataire qui n'est pas Ted
-- il faut sortir du sous-domaine `courrier.`, passer Resend au palier payant et
-- ecrire les textes legaux. Un lien ne declenche aucun des trois. Le jour ou
-- l'envoi par mail arrivera, il se posera PAR-DESSUS ce lot sans rien changer
-- ici : la fonction rend deja le jeton, il suffira de l'expedier.

-- ---------------------------------------------------------------------------
-- 1. La table des invitations
-- ---------------------------------------------------------------------------
-- LE JETON CLAIR N'EST JAMAIS STOCKE. La table ne porte que son empreinte, et la
-- fonction qui le fabrique est le seul endroit du systeme ou il existe en clair,
-- le temps d'une reponse. Quelqu'un qui lirait cette table entiere ne pourrait
-- accepter aucune invitation.
--
-- L'entropie vient de DEUX uuid concatenes, soit 244 bits, et pas de
-- `gen_random_bytes` : celui-la demande pgcrypto, et une dependance d'extension
-- pour tirer un nombre au hasard n'a pas sa place dans un chemin de securite.
create table if not exists public.invitations (
  jeton_hash  text primary key,
  bureau      uuid not null references public.bureaux on delete cascade,
  email       text not null,
  role        text not null default 'simple' check (role in ('maitre','simple')),
  invite_par  uuid references auth.users on delete set null,
  cree_le     timestamptz not null default now(),
  expire_le   timestamptz not null default (now() + interval '7 days'),
  utilise_le  timestamptz,
  utilise_par uuid references auth.users on delete set null
);

create index if not exists invitations_bureau on public.invitations (bureau, cree_le desc);

alter table public.invitations enable row level security;

-- Un maitre voit les invitations de SON bureau, pour savoir qui attend et
-- pouvoir annuler. Rien d'autre ne passe par le client : creer, accepter et
-- annuler sont des fonctions, parce que chacune a une regle a verifier.
drop policy if exists "lire les invitations de son bureau" on public.invitations;
create policy "lire les invitations de son bureau" on public.invitations
  for select using (public.est_maitre(bureau));

revoke all on public.invitations from anon, authenticated;
-- L'EMPREINTE RESTE DEHORS, colonne par colonne. Elle ne sert a rien a l'ecran,
-- et une empreinte qui circule est une empreinte qu'on peut essayer de casser
-- hors ligne. Le maitre annule par l'adresse invitee, pas par le jeton.
grant select (bureau, email, role, invite_par, cree_le, expire_le, utilise_le, utilise_par)
  on public.invitations to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Inviter
-- ---------------------------------------------------------------------------
-- Rend le jeton EN CLAIR, une seule fois, a celui qui invite. Il ne sera plus
-- jamais lisible nulle part : la table n'en garde que l'empreinte.
create or replace function public.inviter(b uuid, courriel text, r text default 'simple')
returns text language plpgsql security definer set search_path = public as $$
declare
  jeton text;
  adresse text := lower(trim(courriel));
begin
  if not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut inviter';
  end if;
  if adresse !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'cette adresse ne ressemble pas a une adresse e-mail';
  end if;
  if r not in ('maitre','simple') then
    raise exception 'role inconnu';
  end if;

  -- Deja dans le bureau : on le dit, au lieu de fabriquer un lien qui echouera.
  if exists (select 1 from public.membres m join auth.users u on u.id = m.personne
              where m.bureau = b and lower(u.email) = adresse) then
    raise exception 'cette personne est deja dans ce bureau';
  end if;

  -- Une invitation en attente pour la meme adresse est REMPLACEE. Sans ca, deux
  -- liens vivraient en meme temps pour la meme personne, et annuler le premier ne
  -- fermerait rien.
  delete from public.invitations
   where bureau = b and email = adresse and utilise_le is null;

  jeton := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.invitations (jeton_hash, bureau, email, role, invite_par)
  values (encode(sha256(convert_to(jeton, 'UTF8')), 'hex'), b, adresse, r, auth.uid());

  return jeton;
end $$;

revoke all on function public.inviter(uuid, text, text) from public, anon;
grant execute on function public.inviter(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Ce que voit l'invite AVANT d'accepter
-- ---------------------------------------------------------------------------
-- OUVERTE SANS SESSION, et c'est deliberé : l'invite n'a pas forcement de compte,
-- il doit voir qui l'invite et ou avant de decider d'en creer un. Meme porte que
-- `emails_lire`, et meme justification : elle ne rend RIEN sans un jeton exact de
-- 244 bits, et ce qu'elle rend tient en quatre champs.
--
-- ELLE NE DIT PAS SI L'ADRESSE CORRESPOND. Repondre « ce n'est pas ton adresse »
-- a quelqu'un qui n'est pas connecte apprendrait a un curieux quelle adresse a
-- ete invitee. La verification a lieu a l'acceptation, ou il y a une session.
create or replace function public.invitation_apercu(jeton text)
returns table (bureau_nom text, invite_par_prenom text, etat text)
language sql stable security definer set search_path = public as $$
  select b.nom,
         coalesce(nullif(trim(p.prenom), ''), split_part(p.email, '@', 1)),
         case when i.utilise_le is not null then 'utilisee'
              when i.expire_le < now()      then 'expiree'
              else 'valide' end
    from public.invitations i
    join public.bureaux b on b.bureau = i.bureau
    left join public.profils p on p.id = i.invite_par
   where i.jeton_hash = encode(sha256(convert_to(jeton, 'UTF8')), 'hex');
$$;

revoke all on function public.invitation_apercu(text) from public;
grant execute on function public.invitation_apercu(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Accepter
-- ---------------------------------------------------------------------------
-- L'ADRESSE DOIT CORRESPONDRE, et c'est le verrou central de tout le lot. Sans
-- lui, n'importe qui ayant vu passer le lien (un mail transfere, une capture
-- d'ecran, un historique de navigateur partage) entrerait dans le fichier client
-- d'un domaine. Le lien seul ne suffit donc jamais : il faut le lien ET etre
-- connecte avec l'adresse invitee.
create or replace function public.accepter_invitation(jeton text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv public.invitations%rowtype;
  moi uuid := auth.uid();
  mon_email text;
begin
  if moi is null then raise exception 'aucune session'; end if;
  select lower(email) into mon_email from auth.users where id = moi;

  select * into inv from public.invitations
   where jeton_hash = encode(sha256(convert_to(jeton, 'UTF8')), 'hex')
   for update;

  if inv.jeton_hash is null then raise exception 'invitation inconnue'; end if;
  if inv.utilise_le is not null then raise exception 'invitation deja utilisee'; end if;
  if inv.expire_le < now() then raise exception 'invitation expiree'; end if;
  if inv.email is distinct from mon_email then
    raise exception 'cette invitation a ete envoyee a une autre adresse';
  end if;

  insert into public.membres (bureau, personne, role, invite_par)
  values (inv.bureau, moi, inv.role, inv.invite_par)
  on conflict (bureau, personne) do nothing;

  update public.invitations
     set utilise_le = now(), utilise_par = moi
   where jeton_hash = inv.jeton_hash;

  -- On arrive DANS le bureau ou l'on vient d'entrer : sans ca, l'invite accepte
  -- et se retrouve devant son propre bureau vide, sans comprendre ce qui a change.
  update public.profils set bureau_courant = inv.bureau where id = moi;

  return inv.bureau;
end $$;

revoke all on function public.accepter_invitation(text) from public, anon;
grant execute on function public.accepter_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Annuler une invitation en attente
-- ---------------------------------------------------------------------------
-- Par l'ADRESSE et pas par le jeton : le maitre ne l'a plus, et l'empreinte ne
-- lui est pas servie. C'est aussi ce qui rend le geste lisible a l'ecran.
create or replace function public.annuler_invitation(b uuid, courriel text)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut annuler une invitation';
  end if;
  delete from public.invitations
   where bureau = b and email = lower(trim(courriel)) and utilise_le is null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.annuler_invitation(uuid, text) from public, anon;
grant execute on function public.annuler_invitation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Qui est dans le bureau
-- ---------------------------------------------------------------------------
-- UNE FONCTION ET PAS UNE VUE, parce que `profils` appartient a la PERSONNE :
-- sa politique de securite est `auth.uid() = id`, et un maitre ne lit donc pas la
-- fiche de son collegue. Ouvrir cette politique aux gens du meme bureau rendrait
-- visible TOUTE la fiche, y compris `jeton_emails`, qui permet de modifier les
-- preferences d'e-mail de quelqu'un d'autre sans etre connecte.
--
-- Cette fonction rend donc les six champs dont l'ecran a besoin, et rien de plus.
create or replace function public.equipe(b uuid)
returns table (personne uuid, role text, depuis timestamptz,
               prenom text, nom text, email text)
language sql stable security definer set search_path = public as $$
  select m.personne, m.role, m.depuis, p.prenom, p.nom, p.email
    from public.membres m
    join public.profils p on p.id = m.personne
   where m.bureau = b and public.est_membre(b)
   order by (m.role = 'maitre') desc, m.depuis;
$$;

revoke all on function public.equipe(uuid) from public, anon;
grant execute on function public.equipe(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Changer le role de quelqu'un
-- ---------------------------------------------------------------------------
-- Le declencheur `garder_un_maitre` du lot 15 refuse deja de retrograder le
-- dernier maitre, et il tient meme depuis l'editeur SQL. Ici on ajoute la seule
-- chose qu'il ne peut pas savoir : QUI demande.
create or replace function public.changer_role(b uuid, personne_ciblee uuid, r text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut changer un role';
  end if;
  if r not in ('maitre','simple') then raise exception 'role inconnu'; end if;
  update public.membres set role = r
   where bureau = b and personne = personne_ciblee;
  if not found then raise exception 'cette personne n''est pas dans ce bureau'; end if;
end $$;

revoke all on function public.changer_role(uuid, uuid, text) from public, anon;
grant execute on function public.changer_role(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Retirer quelqu'un, ou partir soi-meme
-- ---------------------------------------------------------------------------
-- DEUX GESTES DANS UNE SEULE FONCTION, parce que c'est la meme ecriture avec la
-- meme consequence : un maitre retire un collegue, ou n'importe qui quitte un
-- bureau ou il ne travaille plus.
--
-- LE DECLENCHEUR DU LOT 15 NE COUVRE PAS CE CAS. Il porte sur l'UPDATE seulement,
-- et deliberement : un declencheur sur le DELETE ferait echouer la suppression
-- d'un compte, qui efface les lignes de `membres` en cascade. Le dernier maitre
-- se protege donc ICI, a la main.
--
-- ET ON RANGE LE BUREAU COURANT. Sans ca, la personne retiree garde un bureau
-- courant qu'elle n'a plus le droit de lire : tous ses ecrans deviennent vides,
-- sans un mot, et c'est exactement le pire etat connu du projet.
create or replace function public.retirer_membre(b uuid, personne_ciblee uuid)
returns void language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid();
begin
  if moi is null then raise exception 'aucune session'; end if;
  if personne_ciblee <> moi and not public.est_maitre(b) then
    raise exception 'seul un maitre de ce bureau peut retirer quelqu''un';
  end if;

  if exists (select 1 from public.membres
              where bureau = b and personne = personne_ciblee and role = 'maitre')
     and not exists (select 1 from public.membres
                      where bureau = b and role = 'maitre' and personne <> personne_ciblee) then
    raise exception 'ce bureau n''aurait plus aucun maitre';
  end if;

  /* ON NE QUITTE PAS SON DERNIER BUREAU, trouve par le banc le 13/09/2026.
     Le cas se produit vraiment : Alice, maitresse de son propre bureau, nomme son
     associe maitre a son tour, puis s'en va. Elle n'appartient alors a AUCUN
     bureau. Consequence, cote navigateur : `monBureau()` rend nul, `pret()` est
     faux dans tous les modules, et tout le bureau devient muet SANS UN MESSAGE.
     C'est exactement l'etat que le projet refuse partout ailleurs.

     Tout compte nait avec son bureau solo (declencheur du lot 15), donc un
     collegue invite en a toujours au moins deux et se retire sans probleme. Cette
     exception ne se declenche que dans le cas ci-dessus, et elle rend l'invariant
     tenable : une personne appartient toujours a au moins un bureau. */
  if not exists (select 1 from public.membres
                  where personne = personne_ciblee and bureau <> b) then
    raise exception 'c''est le dernier bureau de cette personne : un compte appartient toujours a au moins un bureau';
  end if;

  delete from public.membres where bureau = b and personne = personne_ciblee;
  if not found then raise exception 'cette personne n''est pas dans ce bureau'; end if;

  update public.profils p
     set bureau_courant = (select m.bureau from public.membres m
                            where m.personne = personne_ciblee
                            order by m.depuis limit 1)
   where p.id = personne_ciblee and p.bureau_courant = b;
end $$;

revoke all on function public.retirer_membre(uuid, uuid) from public, anon;
grant execute on function public.retirer_membre(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. A CONTROLER APRES AVOIR PASSE CE SCRIPT
-- ---------------------------------------------------------------------------
-- a) Les six fonctions sont la, et seule `invitation_apercu` est ouverte a anon :
--    select p.proname,
--           has_function_privilege('anon', p.oid, 'execute') as anon_peut
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public'
--       and p.proname in ('inviter','invitation_apercu','accepter_invitation',
--                         'annuler_invitation','equipe','changer_role','retirer_membre')
--     order by 1;
--
-- b) L'empreinte du jeton n'est PAS lisible par un compte connecte. On attend
--    zero ligne pour `jeton_hash` :
--    select column_name from information_schema.column_privileges
--     where table_schema='public' and table_name='invitations'
--       and grantee='authenticated' and privilege_type='SELECT'
--       and column_name='jeton_hash';
--
-- c) Et le controle de securite de Supabase, comme apres tout lot SQL.
