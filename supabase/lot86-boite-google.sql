-- ============================================================================
-- lot86-boite-google.sql : brancher sa boite « avec Google » (option D, Google seul)
-- A coller APRES le lot 84 (et 79). Rejouable. 08/10/2026.
-- ----------------------------------------------------------------------------
-- Arbitrage de Ted du 08/10/2026 : Google seul, Microsoft abandonne. Le vigneron clique
-- « Se connecter avec Google », accepte la permission « envoyer des mails en ton nom »
-- (gmail.send, et rien d'autre), et la fonction `google-retour` range le JETON DE
-- RENOUVELLEMENT dans Vault, a la place du mot de passe des lots 76 a 78. La boite est
-- branchee tout de suite : c'est Google qui a prouve que l'adresse est la sienne.
--   - `oauth_etats` : le jeton « state » d'une connexion en cours (son EMPREINTE), qui dit
--     QUI a commence et ou revenir. 10 minutes, une seule fois. Personne ne la lit du
--     navigateur.
--   - `boite_google_ranger()` : range le jeton et branche (cle de service seule).
--   - `boite_pour_envoi()` rend en plus `fournisseur` : 'google_api' part par l'API Gmail.
-- ============================================================================

create table if not exists public.oauth_etats (
  etat_hash text primary key,
  personne  uuid not null references auth.users(id) on delete cascade,
  bureau    uuid not null,
  retour    text not null,
  cree_le   timestamptz not null default now(),
  constraint oauth_etats_hash check (etat_hash ~ '^[0-9a-f]{64}$'),
  constraint oauth_etats_retour check (retour in ('https://lebureauduvigneron.fr', 'https://www.lebureauduvigneron.fr',
    'https://lebureauduvigneron.vercel.app'))
);
alter table public.oauth_etats enable row level security;
revoke all on public.oauth_etats from public, anon, authenticated;

-- ---------------------------------------------------------------- POSER (la fonction)
-- Membre du bureau, 10 connexions par heure au plus. Les etats perimes partent au passage.
create or replace function public.google_etat_poser(p_personne uuid, p_bureau uuid, p_hash text, p_retour text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  delete from public.oauth_etats where cree_le < now() - interval '1 hour';
  if (select count(*) from public.oauth_etats where personne = p_personne) >= 10 then return false; end if;
  insert into public.oauth_etats (etat_hash, personne, bureau, retour) values (p_hash, p_personne, p_bureau, p_retour);
  return true;
end $$;
revoke all on function public.google_etat_poser(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.google_etat_poser(uuid, uuid, text, text) to service_role;

-- ---------------------------------------------------------------- VOIR (la fonction)
-- Ou revenir, SANS consommer l'etat : le retour de Google renvoie le navigateur au bureau, et
-- c'est le bureau (le vigneron connecte) qui finit (lot 86, contre la connexion forcee).
create or replace function public.google_etat_voir(p_hash text)
returns text language sql stable security definer set search_path = '' as $$
  select e.retour from public.oauth_etats e where e.etat_hash = p_hash and e.cree_le > now() - interval '10 minutes';
$$;
revoke all on function public.google_etat_voir(text) from public, anon, authenticated;
grant execute on function public.google_etat_voir(text) to service_role;

-- ---------------------------------------------------------------- PRENDRE (la fonction)
-- Une seule fois : la ligne part. Perimee (10 min) : rien.
create or replace function public.google_etat_prendre(p_hash text)
returns table (personne uuid, bureau uuid, retour text)
language plpgsql security definer set search_path = '' as $$
begin
  return query
    with d as (delete from public.oauth_etats e where e.etat_hash = p_hash and e.cree_le > now() - interval '10 minutes'
               returning e.personne as qui, e.bureau as ou, e.retour as vers)
    select d.qui, d.ou, d.vers from d;
end $$;
revoke all on function public.google_etat_prendre(text) from public, anon, authenticated;
grant execute on function public.google_etat_prendre(text) to service_role;

-- ---------------------------------------------------------------- LA PURGE
-- La page rgpd promet : une heure au plus. Un etat jamais repris part avec cette tache.
select cron.unschedule('oauth-etats-purge') where exists (select 1 from cron.job where jobname = 'oauth-etats-purge');
select cron.schedule('oauth-etats-purge', '41 * * * *', $cron$ delete from public.oauth_etats where cree_le < now() - interval '1 hour'; $cron$);

-- ---------------------------------------------------------------- RANGER (la fonction)
-- Le jeton de renouvellement va dans Vault, la boite est branchee. Une boite deja branchee
-- par mot de passe est REMPLACEE (meme ligne, meme secret mis a jour) : on ne garde pas deux
-- facons d'envoyer. `copie_a_soi` passe a faux : Gmail range deja dans Envoyes.
create or replace function public.boite_google_ranger(p_personne uuid, p_bureau uuid, p_adresse text, p_jeton text)
returns text language plpgsql security definer set search_path = '' as $$
declare s uuid; nom text := 'boite:' || p_bureau || ':' || p_personne; a text := lower(btrim(coalesce(p_adresse, '')));
begin
  if not exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  if p_jeton is null or char_length(p_jeton) not between 10 and 2000 then
    raise exception 'jeton absent' using errcode = '22023';
  end if;
  select b.secret_id into s from public.boites b where b.bureau = p_bureau and b.personne = p_personne;
  if s is not null and exists (select 1 from vault.secrets v where v.id = s) then
    perform vault.update_secret(s, p_jeton, nom, 'Boite d''envoi (Google), Le Bureau du Vigneron', null);
  else
    s := vault.create_secret(p_jeton, nom, 'Boite d''envoi (Google), Le Bureau du Vigneron', null);
  end if;
  insert into public.boites as b (bureau, personne, adresse, fournisseur, serveur, port, identifiant,
      secret_id, etat, utiliser, copie_a_soi, code_hash, code_expire, code_essais, essai_le, branchee_le, erreur, maj_le)
  values (p_bureau, p_personne, a, 'google_api', 'gmail.googleapis.com', 465, a,
      s, 'branchee', true, false, null, null, 0, now(), now(), null, now())
  on conflict on constraint boites_pkey do update set
      adresse = excluded.adresse, fournisseur = 'google_api', serveur = 'gmail.googleapis.com', identifiant = excluded.identifiant,
      secret_id = excluded.secret_id, etat = 'branchee', utiliser = true, copie_a_soi = false, code_hash = null, code_expire = null,
      code_essais = 0, essai_le = now(), branchee_le = now(), erreur = null, maj_le = now();
  return 'branchee';
end $$;
revoke all on function public.boite_google_ranger(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.boite_google_ranger(uuid, uuid, text, text) to service_role;

-- ---------------------------------------------------------------- POUR L'ENVOI
-- Copie exacte du lot 79, plus `fournisseur` EN DERNIER.
drop function if exists public.boite_pour_envoi(uuid, uuid);
create function public.boite_pour_envoi(p_personne uuid, p_bureau uuid)
returns table (adresse text, serveur text, identifiant text, secret text, copie_a_soi boolean, nom text,
               logo text, logo_l integer, logo_h integer, fournisseur text)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query
    select b.adresse, b.serveur, b.identifiant, v.decrypted_secret, b.copie_a_soi,
           coalesce(b.nom_affiche, (select s.nom from public.signatures s
                                     where s.bureau = b.bureau and s.personne = b.personne)),
           case when b.logo_dans_mails then l.image end,
           case when b.logo_dans_mails then l.largeur end,
           case when b.logo_dans_mails then l.hauteur end,
           b.fournisseur
      from public.boites b
      join vault.decrypted_secrets v on v.id = b.secret_id
      left join public.domaine_logo l on l.bureau = b.bureau
     where b.bureau = p_bureau and b.personne = p_personne
       and b.etat = 'branchee' and b.utiliser
       and exists (select 1 from public.membres m where m.bureau = p_bureau and m.personne = p_personne);
end $$;
revoke all on function public.boite_pour_envoi(uuid, uuid) from public, anon, authenticated;
grant execute on function public.boite_pour_envoi(uuid, uuid) to service_role;

-- CONTROLE, a lancer apres (il ne modifie rien) : les quatre doivent dire « connecte = false ».
-- select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as connecte
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname in ('google_etat_poser', 'google_etat_prendre', 'boite_google_ranger', 'boite_pour_envoi');
