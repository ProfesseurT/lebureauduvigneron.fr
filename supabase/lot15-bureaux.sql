-- ===========================================================================
-- LOT 15, 13/09/2026 : LE SOCLE DU TRAVAIL A PLUSIEURS.
-- ===========================================================================
-- A coller tel quel dans l'editeur SQL Supabase (projet qukmncqqwomhmrdhvetj).
-- Ces lignes sont recopiees dans supabase/schema.sql, qui est la REFERENCE.
-- Ne pas les laisser diverger.
--
-- CE LOT NE CHANGE RIEN A L'ECRAN. Aucune table de donnees n'est touchee, aucun
-- appel du navigateur ne change. Il pose les trois tables, les deux fonctions de
-- controle, et transforme chaque compte existant en maitre d'un bureau a lui seul.
-- Le jour ou on le passe, tout continue exactement comme avant.
--
-- Ecrit pour etre rejouable sans erreur : le passer deux fois ne cree pas deux
-- bureaux par personne. Un script a moitie passe dans un onglet de navigateur est
-- le pire etat a deboguer, et c'est le seul mode d'execution qu'on a ici.

-- ---------------------------------------------------------------------------
-- 1. Les bureaux
-- ---------------------------------------------------------------------------
-- Un bureau est le PROPRIETAIRE des donnees. C'est tout le chantier : aujourd'hui
-- une ligne de vente appartient a une personne et meurt avec son compte, demain
-- elle appartient au domaine et les personnes n'ont qu'un droit d'acces dessus.
--
-- `cree_par` est en `on delete set null` et PAS en cascade : celui qui a cree le
-- bureau peut partir, le bureau reste. C'est exactement la faute qu'on repare.
create table if not exists public.bureaux (
  bureau   uuid primary key default gen_random_uuid(),
  nom      text not null,
  cree_le  timestamptz not null default now(),
  cree_par uuid references auth.users on delete set null
);

alter table public.bureaux enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Les membres
-- ---------------------------------------------------------------------------
-- Qui a le droit d'entrer dans quel bureau, et a quel titre. Une personne a
-- autant de lignes que de bureaux ou elle travaille : c'est cette table, et elle
-- seule, qui rend le changement de bureau possible.
create table if not exists public.membres (
  bureau     uuid not null references public.bureaux on delete cascade,
  personne   uuid not null references auth.users     on delete cascade,
  role       text not null default 'simple' check (role in ('maitre','simple')),
  depuis     timestamptz not null default now(),
  invite_par uuid references auth.users on delete set null,
  primary key (bureau, personne)
);

-- « Dans quels bureaux est cette personne » est la question posee a chaque
-- ouverture de session. La cle primaire repond a l'autre sens, pas a celui-la.
create index if not exists membres_personne on public.membres (personne);

alter table public.membres enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Les deux fonctions de controle
-- ---------------------------------------------------------------------------
-- ELLES SONT LE COEUR DU DISPOSITIF, ET ELLES EXISTENT POUR UNE RAISON PRECISE.
--
-- Une politique de securite posee sur `membres` qui interrogerait `membres` fait
-- echouer Postgres : « infinite recursion detected in policy for relation
-- membres ». Une fonction `security definer` traverse la securite par ligne, donc
-- la recursion n'a pas lieu. C'est la seule sortie, et c'est le mur sur lequel se
-- cogne tout le monde qui ecrit du multi-utilisateurs sur Supabase.
--
-- `stable` et pas `volatile` : Postgres peut alors n'evaluer la fonction qu'une
-- fois par requete au lieu d'une fois par ligne. Sur une lecture de 5 000 lignes
-- de vente, ce mot-cle est la difference entre une politique gratuite et une
-- politique qui double le temps de reponse.
--
-- `set search_path = public` : sans lui, quelqu'un qui peut poser un schema dans
-- le chemin de recherche detourne l'appel a `membres` vers une table a lui. Meme
-- precaution que sur `effacer_mes_donnees()`.
create or replace function public.est_membre(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.membres m
     where m.bureau = b and m.personne = auth.uid()
  );
$$;

create or replace function public.est_maitre(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.membres m
     where m.bureau = b and m.personne = auth.uid() and m.role = 'maitre'
  );
$$;

-- `authenticated` DOIT pouvoir les executer : une fonction appelee dans une
-- politique s'execute avec les droits de celui qui lit, pas du proprietaire.
-- Sans ce grant, toutes les lectures echouent. Ce n'est pas une ouverture : ces
-- deux fonctions ne repondent que sur l'APPELANT, elles ne disent rien de
-- personne d'autre, et elles rendent `false` sans session.
revoke all on function public.est_membre(uuid) from public, anon;
revoke all on function public.est_maitre(uuid) from public, anon;
grant execute on function public.est_membre(uuid) to authenticated;
grant execute on function public.est_maitre(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Les politiques
-- ---------------------------------------------------------------------------
-- LA CLE ANON EST PUBLIQUE, elle est lisible dans un fichier JavaScript du site.
-- Ces politiques sont le SEUL mur. Une seule mal ecrite, et c'est le fichier
-- client d'un domaine qui devient lisible par un autre.

-- Un bureau se lit par ses membres, et se renomme par ses maitres.
drop policy if exists "lire son bureau" on public.bureaux;
create policy "lire son bureau" on public.bureaux
  for select using (public.est_membre(bureau));

drop policy if exists "renommer son bureau" on public.bureaux;
create policy "renommer son bureau" on public.bureaux
  for update using (public.est_maitre(bureau)) with check (public.est_maitre(bureau));

-- PAS de politique d'insertion ni de suppression : un bureau nait par le
-- declencheur d'inscription (section 6), et rien ne le supprime depuis le
-- navigateur. Creer un deuxieme bureau a la main viendra avec son ecran.

-- La liste des membres se lit par les membres du meme bureau : on doit savoir
-- avec qui on travaille.
drop policy if exists "lire les membres de son bureau" on public.membres;
create policy "lire les membres de son bureau" on public.membres
  for select using (public.est_membre(bureau));

-- ET AUCUNE AUTRE. C'est un vide VOLONTAIRE, le verrou le plus important du lot :
-- sans politique d'update, un simple utilisateur ne peut pas se nommer maitre en
-- une requete sur sa propre ligne. Les changements de role passeront par une
-- fonction qui verifie d'abord `est_maitre()`, au lot des invitations. Ne jamais
-- ajouter ici une politique d'update « pour simplifier ».

-- ---------------------------------------------------------------------------
-- 5. Les droits
-- ---------------------------------------------------------------------------
-- `revoke all` D'ABORD, sur anon ET sur authenticated. Supabase accorde INSERT,
-- UPDATE, DELETE, TRUNCATE, REFERENCES et TRIGGER par defaut a toute table neuve
-- du schema public : un `grant select` seul est redondant et laisse les six
-- autres en place. Regle du depot, payee le 09/09/2026 sur `v_courrier`.
revoke all on public.bureaux from anon, authenticated;
revoke all on public.membres from anon, authenticated;

grant select on public.bureaux to authenticated;
grant select on public.membres to authenticated;
grant update (nom) on public.bureaux to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Le dernier maitre ne peut pas etre retrograde
-- ---------------------------------------------------------------------------
-- Un bureau sans maitre est un bureau ou plus personne ne peut inviter ni
-- renommer. Le garde-fou est en base et pas dans l'ecran : il tient meme quand
-- l'ecriture ne vient pas du code, depuis cet editeur SQL par exemple.
--
-- SUR L'UPDATE SEULEMENT, et c'est deliberé. Un declencheur qui refuserait aussi
-- le DELETE ferait ECHOUER la suppression d'un compte : `membres.personne` est en
-- cascade sur `auth.users`, et quelqu'un qui supprime son compte doit pouvoir le
-- faire. Ce qu'il advient d'un bureau dont le seul maitre s'en va est une
-- question ouverte du plan, pas un cas a bloquer ici.
create or replace function public.garder_un_maitre()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'maitre' and new.role is distinct from 'maitre'
     and not exists (
       select 1 from public.membres m
        where m.bureau = old.bureau and m.role = 'maitre' and m.personne <> old.personne
     ) then
    raise exception 'ce bureau n''aurait plus aucun maitre';
  end if;
  return new;
end $$;

drop trigger if exists garder_un_maitre_avant_maj on public.membres;
create trigger garder_un_maitre_avant_maj
  before update on public.membres
  for each row execute function public.garder_un_maitre();

-- ---------------------------------------------------------------------------
-- 7. Le bureau courant
-- ---------------------------------------------------------------------------
-- Range sur la fiche pour suivre d'un appareil a l'autre : le vigneron qui change
-- de bureau sur son ordinateur le retrouve sur son telephone.
--
-- LA BASE NE LE CROIT JAMAIS. Cette colonne ne sert qu'a se souvenir d'un choix.
-- Aucune politique de securite ne la lit : elles verifient toutes l'appartenance
-- sur le bureau REEL de la ligne. Un navigateur trafique qui reclamerait le
-- bureau du voisin lit zero ligne, meme s'il arrive a ecrire ce nom ici.
alter table public.profils
  add column if not exists bureau_courant uuid references public.bureaux on delete set null;

grant update (bureau_courant) on public.profils to authenticated;

-- Le compte ne peut pas se poser un bureau dont il n'est pas membre. Ce n'est pas
-- une protection de donnees, c'est une protection de COHERENCE : un bureau
-- courant impossible ferait un ecran vide sans message, le pire des etats.
create or replace function public.verifier_bureau_courant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.bureau_courant is not null
     and new.bureau_courant is distinct from old.bureau_courant
     and not exists (
       select 1 from public.membres m
        where m.bureau = new.bureau_courant and m.personne = new.id
     ) then
    raise exception 'ce compte n''est pas membre de ce bureau';
  end if;
  return new;
end $$;

drop trigger if exists verifier_bureau_courant_avant_maj on public.profils;
create trigger verifier_bureau_courant_avant_maj
  before update on public.profils
  for each row execute function public.verifier_bureau_courant();

-- ---------------------------------------------------------------------------
-- 8. Un compte neuf nait avec son bureau
-- ---------------------------------------------------------------------------
-- Sans ca, la migration de la section 9 serait perimee des la premiere
-- inscription du lendemain, et le nouveau venu n'aurait de bureau nulle part.
--
-- Le bureau s'appelle « Mon bureau » et pas l'adresse de la personne : le nom du
-- domaine n'est pas encore connu a l'inscription, il est demande a l'ecran
-- suivant. Il se renomme ensuite, c'est ce que permet la politique de la
-- section 4.
create or replace function public.creer_profil()
returns trigger language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  insert into public.profils (id, email) values (new.id, new.email)
  on conflict (id) do nothing;

  -- `not exists` plutot qu'un `on conflict` : la cle du bureau est tiree au
  -- hasard, elle ne peut pas servir de garde contre un deuxieme passage.
  if not exists (select 1 from public.membres m where m.personne = new.id) then
    insert into public.bureaux (nom, cree_par) values ('Mon bureau', new.id)
      returning bureau into b;
    insert into public.membres (bureau, personne, role) values (b, new.id, 'maitre');
    update public.profils set bureau_courant = b where id = new.id;
  end if;

  return new;
end $$;

-- Fonction de DECLENCHEUR : elle n'a jamais besoin d'un droit d'execution, et une
-- fonction `security definer` joignable par /rest/v1/rpc/ n'a rien a faire dans
-- une surface publique. Meme regle qu'a la section 10 de schema.sql.
revoke all on function public.creer_profil()            from public, anon, authenticated;
revoke all on function public.garder_un_maitre()        from public, anon, authenticated;
revoke all on function public.verifier_bureau_courant() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. La migration des comptes existants
-- ---------------------------------------------------------------------------
-- Chaque compte deja inscrit devient MAITRE d'un bureau a lui seul. Personne ne
-- gagne ni ne perd un acces : il possede exactement ce qu'il possedait, sous un
-- nom nouveau.
--
-- Le bureau prend le nom du domaine quand il est renseigne, sinon le nom de la
-- personne, sinon son adresse. Le `where` rend le bloc rejouable : un compte qui
-- a deja un bureau est saute.
do $$
declare c record;
        b uuid;
begin
  for c in
    select p.id,
           coalesce(
             nullif(trim(p.domaine), ''),
             nullif(trim(concat_ws(' ', p.prenom, p.nom)), ''),
             p.email,
             'Mon bureau'
           ) as nom
      from public.profils p
     where not exists (select 1 from public.membres m where m.personne = p.id)
  loop
    insert into public.bureaux (nom, cree_par) values (left(c.nom, 120), c.id)
      returning bureau into b;
    insert into public.membres (bureau, personne, role) values (b, c.id, 'maitre');
    update public.profils set bureau_courant = b where id = c.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 10. A CONTROLER APRES AVOIR PASSE CE SCRIPT
-- ---------------------------------------------------------------------------
-- Les trois requetes ci-dessous ne changent rien, elles verifient. A lancer une
-- par une dans le meme editeur.
--
-- a) Autant de bureaux que de comptes, et un maitre par bureau :
--    select (select count(*) from public.profils)  as comptes,
--           (select count(*) from public.bureaux)  as bureaux,
--           (select count(*) from public.membres where role = 'maitre') as maitres;
--
-- b) Aucun compte orphelin, aucun bureau courant vide :
--    select count(*) as sans_bureau from public.profils p
--     where not exists (select 1 from public.membres m where m.personne = p.id)
--        or p.bureau_courant is null;
--
-- c) Les droits reellement poses. On attend `SELECT` seul, sur les deux tables, et
--    AUCUNE ligne pour `anon` :
--    select table_name, grantee, privilege_type
--      from information_schema.role_table_grants
--     where table_schema = 'public' and table_name in ('bureaux','membres')
--       and grantee in ('anon','authenticated')
--     order by table_name, grantee, privilege_type;
--
--    PIEGE, mesure le 13/09/2026 : le `grant update (nom)` de la section 5 N'APPARAIT
--    PAS dans cette vue. Un droit accorde colonne par colonne vit dans une AUTRE vue,
--    et lire la premiere seule fait conclure que le grant n'est pas passe. La question
--    « le maitre peut-il renommer son bureau » se pose donc ici :
--    select table_name, column_name, grantee, privilege_type
--      from information_schema.column_privileges
--     where table_schema = 'public' and table_name in ('bureaux','membres')
--       and grantee in ('anon','authenticated') and privilege_type <> 'SELECT'
--     order by table_name, column_name;
