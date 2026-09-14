-- ===========================================================================
-- LOT 20, 14/09/2026 : L'INVITE N'A PAS DE DOMAINE, ET LE LIEN PART PAR MAIL.
-- ===========================================================================
-- A coller dans l'editeur SQL Supabase (projet qukmncqqwomhmrdhvetj).
-- Recopie dans supabase/schema.sql, qui est la REFERENCE.
--
-- Ce lot ne casse rien : il corrige des fonctions et en ajoute une. Le code deja
-- en ligne continue de tourner pendant qu'il passe.
--
-- TROIS DEMANDES DE TED, ET UNE QUATRIEME QUI VIENT AVEC.

-- ---------------------------------------------------------------------------
-- 1. UN INVITE NE RECOIT PLUS DE BUREAU SOLO
-- ---------------------------------------------------------------------------
-- Defaut signale par Ted le 14/09/2026 : « ca dedouble le bureau que tu as deja ».
-- Il a raison, et la faute vient du lot 15. « Chaque compte nait avec son bureau »
-- etait juste quand tout le monde etait independant. Un salarie qu'on invite n'a
-- pas de domaine : il travaille dans celui de son patron. Son bureau solo est un
-- doublon vide, il encombre le selecteur, et c'est LUI qui obligeait a interdire
-- de quitter son dernier bureau.
--
-- Le declencheur regarde donc s'il existe une invitation en attente POUR CETTE
-- ADRESSE au moment de l'inscription. C'est la seule facon de le savoir sans rien
-- demander au navigateur, et c'est aussi la plus sure : le client ne peut pas
-- mentir sur une invitation qu'il n'a pas.
create index if not exists invitations_email_en_attente
  on public.invitations (email) where utilise_le is null;

create or replace function public.creer_profil()
returns trigger language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  insert into public.profils (id, email) values (new.id, new.email)
  on conflict (id) do nothing;

  if not exists (select 1 from public.membres m where m.personne = new.id)
     and not exists (
       select 1 from public.invitations i
        where i.email = lower(new.email)
          and i.utilise_le is null
          and i.expire_le > now()
     ) then
    insert into public.bureaux (nom, cree_par) values ('Mon bureau', new.id)
      returning bureau into b;
    insert into public.membres (bureau, personne, role) values (b, new.id, 'maitre');
    update public.profils set bureau_courant = b where id = new.id;
  end if;

  return new;
end $$;

revoke all on function public.creer_profil() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. ON PEUT DONC N'APPARTENIR A AUCUN BUREAU
-- ---------------------------------------------------------------------------
-- Consequence directe de la section 1, et il faut la regarder en face : le jour
-- ou un maitre retire un salarie qui n'a que ce bureau-la, ce salarie se retrouve
-- avec zero bureau. C'etait exactement ce que le garde du lot 18 interdisait.
--
-- LE GARDE EST DONC RETIRE ICI, ET REMPLACE PAR UN ECRAN. `bureau_courant` passe a
-- `null`, le navigateur le voit, et la piece « L'equipe » le dit en toutes lettres
-- avec un bouton pour creer son propre bureau. Un etat nomme vaut mieux qu'un etat
-- interdit : interdire de partir, c'est enfermer quelqu'un chez son ancien patron.
--
-- Le garde du DERNIER MAITRE, lui, reste : un bureau sans maitre est un bureau que
-- plus personne ne peut administrer, et ca, aucun ecran ne le rattrape.
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

  delete from public.membres where bureau = b and personne = personne_ciblee;
  if not found then raise exception 'cette personne n''est pas dans ce bureau'; end if;

  -- Nul quand il ne reste rien, et c'est un etat VALIDE depuis ce lot. Laisser un
  -- bureau courant qu'on n'a plus le droit de lire donnerait des ecrans vides sans
  -- un mot, ce que le projet refuse partout ailleurs.
  update public.profils p
     set bureau_courant = (select m.bureau from public.membres m
                            where m.personne = personne_ciblee
                            order by m.depuis limit 1)
   where p.id = personne_ciblee and p.bureau_courant = b;
end $$;

revoke all on function public.retirer_membre(uuid, uuid) from public, anon;
grant execute on function public.retirer_membre(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. CREER SON PROPRE BUREAU
-- ---------------------------------------------------------------------------
-- La sortie de l'etat « aucun bureau », et accessoirement ce qui permet a un
-- vigneron de tenir deux domaines. Le plafond n'est pas decoratif : sans lui, un
-- compte peut fabriquer des bureaux a la chaine et se servir du plafond
-- d'invitations de chacun (section 4) pour envoyer du courrier a volonte.
create or replace function public.creer_bureau(nom text)
returns uuid language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid(); b uuid; propre text := nullif(trim(nom), '');
begin
  if moi is null then raise exception 'aucune session'; end if;
  if propre is null then raise exception 'il faut un nom'; end if;
  if (select count(*) from public.membres where personne = moi) >= 10 then
    raise exception 'tu es deja dans dix bureaux, c''est le maximum';
  end if;

  insert into public.bureaux (nom, cree_par) values (left(propre, 120), moi)
    returning bureau into b;
  insert into public.membres (bureau, personne, role) values (b, moi, 'maitre');
  update public.profils set bureau_courant = b where id = moi;
  return b;
end $$;

revoke all on function public.creer_bureau(text) from public, anon;
grant execute on function public.creer_bureau(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. UN PLAFOND D'INVITATIONS, PARCE QUE LE LIEN PART MAINTENANT PAR MAIL
-- ---------------------------------------------------------------------------
-- Tant que le maitre copiait le lien lui-meme, inviter ne coutait rien a personne.
-- Des lors que le bouton ENVOIE un mail a une adresse quelconque, c'est un relais
-- a courrier indesirable, et il porte le nom de domaine du Bureau du Vigneron.
--
-- Deux plafonds et pas un : par BUREAU, et par PERSONNE. Le premier seul se
-- contourne en creant des bureaux, le second seul se contourne a plusieurs.
-- Vingt par jour est tres au-dessus d'un usage reel (un domaine invite deux ou
-- trois personnes dans sa vie) et tres en-dessous de ce qui interesse un
-- spammeur.
--
-- ET LE PLAFOND EST DANS LA BASE, pas dans la fonction d'envoi : c'est la base qui
-- fait foi, et elle protege aussi l'appel direct a /rest/v1/rpc/inviter.
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
  if exists (select 1 from public.membres m join auth.users u on u.id = m.personne
              where m.bureau = b and lower(u.email) = adresse) then
    raise exception 'cette personne est deja dans ce bureau';
  end if;

  if (select count(*) from public.invitations
       where bureau = b and cree_le > now() - interval '1 day') >= 20 then
    raise exception 'vingt invitations depuis ce bureau aujourd''hui, c''est le maximum. Reessaie demain.';
  end if;
  if (select count(*) from public.invitations
       where invite_par = auth.uid() and cree_le > now() - interval '1 day') >= 20 then
    raise exception 'vingt invitations envoyees aujourd''hui, c''est le maximum. Reessaie demain.';
  end if;

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
-- 5. L'APERCU REND L'ADRESSE INVITEE
-- ---------------------------------------------------------------------------
-- Arbitrage de Ted du 14/09/2026, et c'est ce qui fait marcher le cas « je n'ai
-- pas encore de compte » : l'ecran preremplit l'inscription avec cette adresse et
-- ne la laisse pas changer. Sans elle, l'invite cree un compte avec l'adresse de
-- son choix, et l'acceptation echoue APRES coup sur « cette invitation a ete
-- envoyee a une autre adresse », c'est-a-dire au pire moment.
--
-- Ce que ca coute : quelqu'un qui tient le lien apprend l'adresse invitee. Il tient
-- deja un jeton de 244 bits, il est donc soit l'invite, soit quelqu'un a qui il l'a
-- transmis. Ce qui protege reste entier : accepter demande le lien ET d'etre
-- connecte avec cette adresse-la.
-- `create or replace` NE SUFFIT PAS ICI : la fonction gagne une colonne, et Postgres
-- refuse de changer le type de retour d'une fonction existante (« cannot change return
-- type of existing function »). Elle se supprime donc d'abord. C'est le genre de detail
-- qui arrete un script au milieu dans un onglet de navigateur.
drop function if exists public.invitation_apercu(text);

create or replace function public.invitation_apercu(jeton text)
returns table (bureau_nom text, invite_par_prenom text, email text, etat text)
language sql stable security definer set search_path = public as $$
  select b.nom,
         coalesce(nullif(trim(p.prenom), ''), split_part(p.email, '@', 1)),
         i.email,
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
-- 6. A CONTROLER APRES AVOIR PASSE CE SCRIPT
-- ---------------------------------------------------------------------------
-- a) Les deux nouvelles fonctions sont la, et `creer_bureau` est fermee a anon :
--    select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_peut
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname in ('creer_bureau','inviter','invitation_apercu')
--     order by 1;
--
-- b) L'apercu rend bien quatre colonnes, dont l'adresse :
--    select * from public.invitation_apercu('jeton-invente');   -- zero ligne, sans erreur
--
-- c) Et le controle de securite de Supabase, comme apres tout lot SQL.
