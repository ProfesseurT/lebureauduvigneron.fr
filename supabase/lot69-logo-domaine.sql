-- ============================================================================
-- LOT 69, 06/10/2026 : LE LOGO DU DOMAINE. A COLLER DANS SUPABASE, APRES LE LOT 68.
-- ============================================================================
-- Demande de Ted : un logo dans Mes reglages, imprime en tete des devis et pose en
-- bas de la barre laterale du bureau. Arbitrages du 06/10/2026 :
--   - UN logo par bureau, range DANS LA BASE (pas dans le stockage de fichiers) :
--     le navigateur le reduit a 600 px de large, il pese moins de ~110 ko ;
--   - SEUL LE MAITRE du bureau le depose, le change ou le retire. C'est la BASE qui
--     refuse : aucune ecriture directe pour `authenticated`, deux fonctions
--     `security definer` qui verifient `est_maitre()` en premiere ligne ;
--   - PNG ou JPEG seulement. Pas de SVG : un SVG peut porter du code, et le logo
--     part dans la copie du devis que le client ouvre. La base verifie la FORME
--     (une adresse data: en base64) ET les premiers octets du fichier : un SVG
--     renomme en PNG est refuse ici, pas seulement a l'ecran.
--
-- « VIDER LA BASE » N'Y TOUCHE PAS : rien ici ne vient d'un export.
-- Les devis deja envoyes ne changent pas : leur copie (lot 52) porte le logo du
-- jour de l'envoi, et elle est figee.
-- REJOUABLE.
-- ============================================================================

create table if not exists public.domaine_logo (
  bureau     uuid primary key references public.bureaux(bureau) on delete cascade,
  image      text not null,
  empreinte  text not null,
  largeur    integer not null check (largeur between 1 and 600),
  hauteur    integer not null check (hauteur between 1 and 600),
  maj_par    uuid references auth.users(id) on delete set null,
  maj_le     timestamptz not null default now(),
  constraint domaine_logo_forme check (
    char_length(image) <= 150000
    and image ~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$'),
  -- L'empreinte est celle du texte range : le navigateur s'en sert pour ne retelecharger
  -- l'image que si elle a change. Elle est calculee par la base, jamais recue.
  constraint domaine_logo_empreinte check (empreinte = encode(sha256(convert_to(image, 'UTF8')), 'hex'))
);

-- Les premiers octets disent ce qu'est vraiment le fichier : PNG (89 50 4E 47) ou
-- JPEG (FF D8 FF), et le type annonce doit dire la meme chose.
create or replace function public.domaine_logo_valide(p_image text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_image is not null
    and char_length(p_image) <= 150000
    and p_image ~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$'
    and case
      when p_image like 'data:image/png;base64,%'
        then substring(decode(substring(p_image from 23), 'base64') from 1 for 4) = '\x89504e47'::bytea
      when p_image like 'data:image/jpeg;base64,%'
        then substring(decode(substring(p_image from 24), 'base64') from 1 for 3) = '\xffd8ff'::bytea
      else false end;
$$;
revoke all on function public.domaine_logo_valide(text) from public, anon, authenticated;

-- Une ligne invalide ne passe jamais, meme ecrite par le role de service.
create or replace function public.domaine_logo_controler()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.domaine_logo_valide(new.image) then
    raise exception 'logo invalide : PNG ou JPEG seulement' using errcode = '22023';
  end if;
  new.empreinte := encode(sha256(convert_to(new.image, 'UTF8')), 'hex');
  new.maj_le := now();
  return new;
end
$$;
revoke all on function public.domaine_logo_controler() from public, anon, authenticated;
drop trigger if exists domaine_logo_controler on public.domaine_logo;
create trigger domaine_logo_controler
  before insert or update on public.domaine_logo
  for each row execute function public.domaine_logo_controler();

-- Tout le bureau LIT. Personne n'ecrit en direct : les deux fonctions ci-dessous.
alter table public.domaine_logo enable row level security;
drop policy if exists domaine_logo_lire on public.domaine_logo;
create policy domaine_logo_lire on public.domaine_logo for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );

-- Supabase accorde tout par defaut : on retire, puis on donne (regle du 09/09/2026).
revoke all on public.domaine_logo from anon, authenticated;
grant select on public.domaine_logo to authenticated;

-- POSER : le maitre seul. Rend la ligne sans l'image (le navigateur l'a deja).
create or replace function public.domaine_logo_poser(p_bureau uuid, p_image text, p_largeur integer, p_hauteur integer)
returns table (empreinte text, largeur integer, hauteur integer, maj_le timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_maitre(p_bureau) then
    raise exception 'seul le maitre du bureau change le logo' using errcode = '42501';
  end if;
  if not public.domaine_logo_valide(p_image) then
    raise exception 'logo invalide : PNG ou JPEG seulement' using errcode = '22023';
  end if;
  if p_largeur is null or p_hauteur is null or p_largeur not between 1 and 600 or p_hauteur not between 1 and 600 then
    raise exception 'logo trop grand : 600 px au plus' using errcode = '22023';
  end if;
  insert into public.domaine_logo as l (bureau, image, empreinte, largeur, hauteur, maj_par)
  values (p_bureau, p_image, encode(sha256(convert_to(p_image, 'UTF8')), 'hex'), p_largeur, p_hauteur, auth.uid())
  on conflict on constraint domaine_logo_pkey do update
    set image = excluded.image, empreinte = excluded.empreinte, largeur = excluded.largeur,
        hauteur = excluded.hauteur, maj_par = excluded.maj_par;
  return query select l.empreinte, l.largeur, l.hauteur, l.maj_le from public.domaine_logo l where l.bureau = p_bureau;
end
$$;

-- RETIRER : le maitre seul. Rend vrai si un logo existait.
create or replace function public.domaine_logo_retirer(p_bureau uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  if not public.est_maitre(p_bureau) then
    raise exception 'seul le maitre du bureau change le logo' using errcode = '42501';
  end if;
  delete from public.domaine_logo where bureau = p_bureau;
  get diagnostics n = row_count;
  return n > 0;
end
$$;

-- Un revoke sur `public` ne retire pas un droit nominatif (regle du 13/09/2026).
revoke all on function public.domaine_logo_poser(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.domaine_logo_retirer(uuid) from public, anon, authenticated;
grant execute on function public.domaine_logo_poser(uuid, text, integer, integer) to authenticated;
grant execute on function public.domaine_logo_retirer(uuid) to authenticated;

-- CONTROLES, a lancer apres (ils ne modifient rien)
-- 1) select policyname, cmd from pg_policies where tablename = 'domaine_logo';      -> 1 ligne, SELECT
-- 2) select privilege_type from information_schema.role_table_grants
--     where table_name = 'domaine_logo' and grantee in ('anon','authenticated');     -> SELECT seul
