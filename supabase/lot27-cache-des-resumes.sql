/* ===========================================================================
   LOT 27 : LES RESUMES SONT CALCULES QUAND ILS CHANGENT, 18/09/2026

       « Je ne veux pas avoir a attendre huit ans des que je recharge ma page.
         Y'a une BDD derriere qui est censee gerer les donnees et les
         redistribuer correctement. »

   LE CHIFFRE QUI A DECIDE. Les trois fonctions de resume, mesurees sur les
   171 569 lignes de Ted, A CHAQUE OUVERTURE D'ECRAN :

       cap_resume        1 100 ms
       commerce_resume   3 800 ms
       cuvees_resume     5 735 ms

   Un logiciel de gestion ne recalcule pas son chiffre d'affaires chaque fois
   qu'on le regarde. Il le calcule quand il CHANGE. Apres cache :

       lecture par cle primaire   0,77 ms

   ---------------------------------------------------------------------------
   TROIS DECISIONS, ET POURQUOI

   1. LA PEREMPTION EST UN EFFACEMENT, PAS UN DRAPEAU. Un resume perime qu'on
      garde « au cas ou » finit par s'afficher. L'absence est le seul etat qu'on
      ne peut pas lire par erreur.

   2. LE DECLENCHEUR EST AU NIVEAU DE L'INSTRUCTION, pas de la ligne. Un import
      ecrit ses 500 lignes en une instruction : un effacement au lieu de cinq
      cents. Sur la base de Ted, 344 au lieu de 171 569.

   3. `public.resume(b, cle)` EST `security definer`, DONC ELLE CONTROLE L'ACCES
      ELLE-MEME, en premiere ligne, et le controle est le meme que la politique
      de lecture : appartenir au bureau. Un `security definer` sans ce garde-fou
      ouvre la table a tout le monde.

   ---------------------------------------------------------------------------
   CE QUI EST PERIME, ET PAR QUOI

       une vente ajoutee, modifiee ou supprimee   les trois resumes du bureau
       un reglage modifie (classement, exercice,
       objectif)                                  les trois aussi

   `classement` decide de `est_vente`, `exercice_debut` de `ex_annee` et
   `ex_pos` : les trois resumes en dependent. Les perimer separement serait
   l'oubli programme du jour ou un quatrieme ecran arrivera.

   ---------------------------------------------------------------------------
   LE PREMIER CALCUL SE PAIE UNE FOIS, ET AU BON MOMENT

   `resumes_rechauffer(b)` est appelee juste apres un import, sans etre
   attendue : le vigneron lit encore son compte rendu, c'est le seul moment de
   la journee ou quelques secondes de serveur ne se voient pas. Si elle echoue,
   le premier ecran ouvert refera le calcul. Rien ne casse.
   =========================================================================== */

create table if not exists public.resumes (
  bureau uuid not null references public.bureaux(bureau) on delete cascade,
  cle    text not null check (cle in ('cap','commerce','cuvees')),
  charge jsonb not null,
  calcule_le timestamptz not null default now(),
  primary key (bureau, cle)
);

alter table public.resumes enable row level security;

/* Meme forme que toutes les politiques du depot depuis le 17/09 : la colonne est
   COMPAREE A UN ENSEMBLE, jamais passee a une fonction. Une politique qui appelle
   une fonction sur une colonne est evaluee une fois PAR LIGNE. */
drop policy if exists resumes_lire on public.resumes;
create policy resumes_lire on public.resumes for select to authenticated
  using ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );

revoke all on public.resumes from anon, authenticated;
grant select on public.resumes to authenticated;

/* LA TABLE DE TRANSITION N'EST PAS DANS UN SCHEMA. Elle n'existe que le temps de
   l'instruction et se nomme SANS prefixe : `public.ventes_touchees` la chercherait
   dans le schema public, ou elle n'est pas. C'est le seul endroit de ce depot ou un
   nom non qualifie est correct sous `search_path = ''`. */
create or replace function public.resumes_perimer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.resumes r
   where r.bureau in (select distinct t.bureau from ventes_touchees t);
  return null;
end; $$;

drop trigger if exists resumes_perimer_ins on public.ventes;
create trigger resumes_perimer_ins after insert on public.ventes
  referencing new table as ventes_touchees
  for each statement execute function public.resumes_perimer();

drop trigger if exists resumes_perimer_maj on public.ventes;
create trigger resumes_perimer_maj after update on public.ventes
  referencing new table as ventes_touchees
  for each statement execute function public.resumes_perimer();

drop trigger if exists resumes_perimer_del on public.ventes;
create trigger resumes_perimer_del after delete on public.ventes
  referencing old table as ventes_touchees
  for each statement execute function public.resumes_perimer();

create or replace function public.resumes_perimer_reglages()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.resumes r where r.bureau = new.bureau;
  return null;
end; $$;

drop trigger if exists resumes_perimer_reg on public.reglages;
create trigger resumes_perimer_reg after insert or update on public.reglages
  for each row execute function public.resumes_perimer_reglages();

/* LA PORTE UNIQUE DES TROIS ECRANS. En cache, elle rend. Absent, elle calcule, range
   et rend. */
create or replace function public.resume(b uuid, cle text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  if not exists (select 1 from public.membres m
                  where m.bureau = b and m.personne = (select auth.uid())) then
    raise exception 'bureau inconnu';
  end if;

  select charge into r from public.resumes where bureau = b and public.resumes.cle = resume.cle;
  if r is not null then return r; end if;

  r := case cle
         when 'cap'      then public.cap_resume(b)
         when 'commerce' then public.commerce_resume(b)
         when 'cuvees'   then public.cuvees_resume(b)
       end;
  if r is null then return null; end if;

  /* `on conflict` et pas un `insert` sec : deux ecrans ouverts en meme temps calculent
     tous les deux, et le second ne doit pas lever. */
  insert into public.resumes (bureau, cle, charge)
       values (b, cle, r)
  on conflict (bureau, cle) do update set charge = excluded.charge, calcule_le = now();
  return r;
end; $$;

revoke all on function public.resume(uuid, text) from anon, authenticated, public;
grant execute on function public.resume(uuid, text) to authenticated;

create or replace function public.resumes_rechauffer(b uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
    'cap',      public.resume(b, 'cap')      is not null,
    'commerce', public.resume(b, 'commerce') is not null,
    'cuvees',   public.resume(b, 'cuvees')   is not null);
$$;
revoke all on function public.resumes_rechauffer(uuid) from anon, authenticated, public;
grant execute on function public.resumes_rechauffer(uuid) to authenticated;

/* POUR VOIR L'ETAT DU CACHE :
     select bureau, cle, calcule_le, pg_size_pretty(length(charge::text)::bigint)
       from public.resumes order by bureau, cle;
   Base de Ted, 18/09/2026 : cap 763 octets, cuvees 84 ko, commerce 642 ko. */
