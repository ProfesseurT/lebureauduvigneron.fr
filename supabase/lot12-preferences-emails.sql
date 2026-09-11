-- ============================================================================
-- LOT 12  LES PREFERENCES D'E-MAIL, ET LE LIEN QUI PERMET D'ARRETER
-- ============================================================================
-- A COLLER DANS L'EDITEUR SQL DE SUPABASE, projet qukmncqqwomhmrdhvetj.
--
-- CE QUE CE LOT CORRIGE, ET CE N'EST PAS UN OUBLI DE FINITION.
-- Le pied du courrier du matin dit : « Tu recois ce courrier parce que tu l'as
-- demande dans les reglages de ton bureau. » C'EST FAUX AUJOURD'HUI. Le bloc
-- « Le courrier » du panneau de reglages ne porte qu'une case, celle de
-- l'edition bimensuelle (`consent_news`). Le courrier du matin, lui, n'a AUCUN
-- interrupteur : la fonction d'envoi ecrit a tout compte present dans la vue.
-- Une phrase qui affirme un consentement qui n'existe pas est pire qu'une
-- phrase absente, et c'est exactement ce qu'un vigneron mecontent citerait.
--
-- DEUX DECISIONS DE TED, 11/09/2026 :
-- 1. On entre dans les preferences PAR LES DEUX CHEMINS : un jeton dans le lien
--    du mail, qui marche sans mot de passe, ET les memes cases dans les
--    reglages du bureau pour qui est connecte. Le premier est celui qui compte
--    juridiquement : se retirer doit etre aussi simple que consentir, et
--    quelqu'un qui a perdu son acces doit pouvoir le faire (RGPD 7-3).
-- 2. Le courrier du matin est ETEINT PAR DEFAUT. Un nouvel inscrit ne recoit
--    rien tant qu'il n'a pas coche. C'est ce qui rend la phrase du pied vraie.
--
-- POURQUOI UN JETON ET PAS L'IDENTIFIANT DU COMPTE DANS L'URL.
-- `profils.id` est l'identifiant d'authentification : il se retrouve dans des
-- jetons de session, des journaux, des exports. Un jeton dedie se revoque en
-- une ligne sans toucher au compte, et il ne sert qu'a ca. C'est la meme
-- raison qui a fait choisir `COURRIER_CLE` plutot que la cle de service.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. LES DEUX COLONNES
-- ---------------------------------------------------------------------------
alter table public.profils
  add column if not exists consent_courrier boolean not null default false;

alter table public.profils
  add column if not exists jeton_emails uuid not null default gen_random_uuid();

create unique index if not exists profils_jeton_emails_idx
  on public.profils (jeton_emails);

-- LA DATE DU CONSENTEMENT, ET POURQUOI ELLE N'EST PAS FACULTATIVE.
-- Le RGPD 7-1 met la charge de la preuve sur nous : c'est a nous de montrer
-- quand le vigneron a coche, et quand il a decoche. Un booleen seul ne prouve
-- rien -- il dit l'etat d'aujourd'hui, pas l'histoire. Et le jour ou quelqu'un
-- ecrit « je n'ai jamais demande ca », la seule reponse qui tient est une date.
alter table public.profils
  add column if not exists consent_courrier_le timestamptz;

alter table public.profils
  add column if not exists consent_news_le timestamptz;

-- Le compte connecte NE DOIT PAS pouvoir se donner un autre jeton : il s'en
-- servirait pour lire les preferences d'un autre. Il peut modifier son
-- consentement, pas son jeton.
grant update (consent_courrier) on public.profils to authenticated;

comment on column public.profils.jeton_emails is
  'Jeton du lien de preferences pose dans le pied des e-mails. Se regenere '
  'd''une ligne (update ... set jeton_emails = gen_random_uuid()) sans toucher '
  'au compte. N''est JAMAIS modifiable par le compte lui-meme.';

-- ---------------------------------------------------------------------------
-- 1bis. LE DECLENCHEUR QUI DATE LES BASCULES
-- ---------------------------------------------------------------------------
-- IL Y A TROIS CHEMINS qui touchent ces deux booleens : la page publique par
-- jeton, les reglages du bureau, et nos propres mains dans l'editeur SQL. Si la
-- date etait posee par l'appelant, il suffirait qu'UN des trois l'oublie pour
-- que la preuve manque justement sur la ligne contestee. Le declencheur la pose
-- pour les trois, et on ne peut pas l'oublier.
create or replace function public.profils_dater_consentements()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.consent_courrier is distinct from old.consent_courrier then
    new.consent_courrier_le := now();
  end if;
  if new.consent_news is distinct from old.consent_news then
    new.consent_news_le := now();
  end if;
  return new;
end;
$$;

drop trigger if exists profils_dater_consentements on public.profils;
create trigger profils_dater_consentements
  before update on public.profils
  for each row
  execute function public.profils_dater_consentements();

-- ---------------------------------------------------------------------------
-- 2. LES DEUX FONCTIONS QUE LA PAGE PUBLIQUE APPELLE
-- ---------------------------------------------------------------------------
-- `security definer` est OBLIGATOIRE : la page est ouverte, elle n'a que la
-- cle anon, et la securite par ligne de `profils` interdit a `anon` de lire ou
-- d'ecrire quoi que ce soit. Ces deux fonctions sont la seule porte, et elles
-- ne s'ouvrent que sur un jeton exact.
--
-- `set search_path` est OBLIGATOIRE AVEC `security definer`. Sans lui,
-- l'appelant peut poser son propre schema devant `public` et faire executer SA
-- table `profils` avec les droits du proprietaire de la fonction. C'est la
-- faille classique de ce motif, et elle ne se voit dans aucun test fonctionnel.

-- `create or replace` REFUSE de changer le type de retour d'une fonction
-- (« cannot change return type of existing function »). Sur une base neuve le
-- drop ne fait rien ; le jour d'un rejeu il evite une erreur au milieu du lot.
drop function if exists public.emails_lire(uuid);

create or replace function public.emails_lire(jeton uuid)
returns table (email_masque text, rappels boolean, edition boolean,
               rappels_le timestamptz, edition_le timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  -- L'adresse est MASQUEE. Un jeton aleatoire de 128 bits ne se devine pas,
  -- mais rendre l'adresse en clair transformerait une fuite de lien en fuite
  -- d'adresse. Le vigneron a juste besoin de reconnaitre laquelle c'est.
  -- Les deux dates sortent aussi : la page peut dire « demande le 11/09 »,
  -- ce qui vaut mieux qu'une case a cocher muette sur son propre passe.
  select left(p.email, 2) || '…@' || split_part(p.email, '@', 2),
         p.consent_courrier,
         p.consent_news,
         p.consent_courrier_le,
         p.consent_news_le
    from public.profils p
   where p.jeton_emails = jeton;
$$;

create or replace function public.emails_ecrire(jeton uuid, rappels boolean, edition boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  touchees int;
begin
  update public.profils
     set consent_courrier = coalesce(rappels, consent_courrier),
         consent_news     = coalesce(edition, consent_news)
   where jeton_emails = jeton;
  get diagnostics touchees = row_count;
  -- Rend `true` si le jeton existait, `false` sinon. La page n'apprend donc
  -- rien de plus qu'avec emails_lire, et un jeton faux ne provoque pas d'erreur
  -- bavarde.
  return touchees = 1;
end;
$$;

-- LES DROITS DES FONCTIONS SE REVOQUENT D'ABORD, comme ceux des tables.
-- Postgres accorde EXECUTE a PUBLIC sur toute fonction neuve : le meme piege
-- que les droits par defaut de Supabase sur le schema public, decouvert le
-- 09/09/2026 sur la vue v_courrier.
revoke all on function public.emails_lire(uuid)                  from public;
revoke all on function public.emails_ecrire(uuid, boolean, boolean) from public;
grant execute on function public.emails_lire(uuid)                  to anon, authenticated;
grant execute on function public.emails_ecrire(uuid, boolean, boolean) to anon, authenticated;

-- CE QUI N'EST PAS PROTEGE, ET IL FAUT LE SAVOIR : rien ne limite le nombre
-- d'appels. Un attaquant peut tirer des jetons au hasard. A 128 bits d'entropie
-- c'est hors d'atteinte, et le gain serait de basculer la case d'un inconnu.
-- A revoir si ces fonctions servent un jour a autre chose.

-- ---------------------------------------------------------------------------
-- 3. LA VUE FILTRE SUR LE CONSENTEMENT
-- ---------------------------------------------------------------------------
-- C'EST ICI QUE LE CONSENTEMENT DEVIENT EFFECTIF, et pas dans index.ts. Une
-- regle qui vit dans la requete ne peut pas etre oubliee par un futur appelant,
-- et la fonction d'envoi n'a meme pas a la connaitre. Meme raison qui a mis
-- l'anti-jointure des clients suivis dans la vue plutot que dans la fabrique.
-- Le jeton sort de la vue parce que le pied du mail en a besoin.
drop view if exists public.v_courrier;

create view public.v_courrier
with (security_invoker = true)
as
with signaux_gardes as (
  select r.id, jsonb_agg(s.valeur order by s.n) as signaux
    from public.reglages r
    cross join lateral jsonb_array_elements(
           coalesce(r.file_travail -> 'signaux', '[]'::jsonb)
         ) with ordinality as s(valeur, n)
   where not exists (
           select 1
             from public.suivi_clients sc
            where sc.id = r.id
              and sc.client_id = s.valeur ->> 'id'
              and (sc.rappel is not null or sc.statut = 'traite')
         )
   group by r.id
),
suivis_actifs as (
  select sc.id, jsonb_agg(to_jsonb(sc)) as suivis
    from public.suivi_clients sc
   where sc.rappel is not null and sc.statut is distinct from 'traite'
   group by sc.id
),
taches_ouvertes as (
  select t.id, jsonb_agg(to_jsonb(t)) as taches
    from public.taches t
   where t.fait_le is null
   group by t.id
)
select r.id,
       p.email,
       p.jeton_emails,
       r.depose_le,
       coalesce(r.file_travail -> 'noms', '{}'::jsonb) as noms,
       coalesce(sg.signaux, '[]'::jsonb)               as signaux,
       coalesce(sa.suivis,  '[]'::jsonb)               as suivis,
       coalesce(tc.taches,  '[]'::jsonb)               as taches,
       r.resume_ventes
  from public.reglages r
  join public.profils p          on p.id  = r.id
  left join signaux_gardes sg    on sg.id = r.id
  left join suivis_actifs sa     on sa.id = r.id
  left join taches_ouvertes tc   on tc.id = r.id
 where p.consent_courrier;

-- ATTENTION, LA JOINTURE A CHANGE DE NATURE : `left join public.profils` est
-- devenu `join`. Avec un `left join` et un `where p.consent_courrier`, une
-- ligne de reglages sans fiche de profil sortait de toute facon ; le `join`
-- le dit franchement au lieu de le laisser deviner.

revoke all on public.v_courrier from anon, authenticated;
grant select on public.v_courrier to authenticated;

comment on view public.v_courrier is
  'Tout ce dont le courrier du matin a besoin, une ligne par compte QUI A '
  'CONSENTI (profils.consent_courrier). Ecarte les signaux des clients deja '
  'suivis et les taches faites. Porte le jeton de preferences, dont le pied du '
  'mail a besoin. security_invoker = true est obligatoire.';

-- ---------------------------------------------------------------------------
-- 4. LES DEUX COMPTES DE TED CONTINUENT DE RECEVOIR
-- ---------------------------------------------------------------------------
-- Ils recevaient avant ce lot, ils ont demande a recevoir, et Ted est la
-- personne qui a mis le systeme en place. Aucun autre compte n'est allume.
-- Le declencheur pose `consent_courrier_le` tout seul : c'est le premier
-- controle de son bon fonctionnement, et il tombe sur les deux seules lignes ou
-- une date fausse serait sans consequence.
update public.profils
   set consent_courrier = true
 where email in ('teddy@solumatic.fr', 'teddypereira88@gmail.com');

-- ---------------------------------------------------------------------------
-- 5. LES CONTROLES
-- ---------------------------------------------------------------------------
-- 5.1  Les colonnes et le jeton. Attendu : 2 lignes, consent_courrier = true,
--      un jeton different par compte.
select email, consent_courrier, consent_courrier_le, consent_news,
       left(jeton_emails::text, 8) || '…' as jeton_debut
  from public.profils order by cree_le;

-- 5.2  La vue ne rend que les comptes consentants. Attendu : 2 aujourd'hui.
select count(*) as comptes_dans_la_vue from public.v_courrier;

-- 5.3  LE CONTROLE QUI COMPTE : couper le consentement d'un compte le fait
--      SORTIR de la vue. On coupe, on compte, on remet.
update public.profils set consent_courrier = false where email = 'teddypereira88@gmail.com';
select count(*) as attendu_1 from public.v_courrier;
update public.profils set consent_courrier = true  where email = 'teddypereira88@gmail.com';
select count(*) as attendu_2 from public.v_courrier;

-- 5.3bis  LE DECLENCHEUR DATE. Attendu : consent_courrier_le porte l'heure du
--         rallumage de 5.3, pas celle du remplissage de l'etape 4.
select email, consent_courrier, consent_courrier_le
  from public.profils where email = 'teddypereira88@gmail.com';

-- 5.4  Les deux fonctions repondent sur un jeton, et rien sur un faux.
select * from public.emails_lire((select jeton_emails from public.profils
                                   where email = 'teddy@solumatic.fr'));
select * from public.emails_lire('00000000-0000-0000-0000-000000000000');  -- attendu : zero ligne
select public.emails_ecrire('00000000-0000-0000-0000-000000000000', true, true) as attendu_false;

-- 5.5  Un compte connecte ne peut PAS se donner un autre jeton. Attendu : la
--      colonne jeton_emails ne figure pas dans la liste.
select privilege_type, string_agg(column_name, ', ' order by column_name) as colonnes
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'profils' and grantee = 'authenticated'
 group by privilege_type order by privilege_type;
