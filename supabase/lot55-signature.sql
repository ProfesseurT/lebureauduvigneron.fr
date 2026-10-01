-- ============================================================================
-- LOT 55 : LA SIGNATURE EN LIGNE DU DEVIS, 01/10/2026
-- ============================================================================
-- A coller dans Supabase (SQL Editor) APRES lot54-devis-tva.sql. Rejouable.
--
-- Decisions de Ted du 01/10/2026 :
--   1. LE LIEN PART DE LA MESSAGERIE DU VIGNERON. Le bureau n'envoie AUCUN mail au
--      client : la regle du SEUIL ne joue pas. Pas de code par mail.
--   2. LE LIEN SE CREE AVEC L'ENVOI (« Je l'envoie avec un lien de signature ») et ne
--      vaut que pour la COPIE FIGEE du lot 52 : le client signe ce qu'il a eu en main.
--   3. APRES SIGNATURE, LE BUREAU ACCEPTE SEUL : devis accepte, affaire Gagnee, comme
--      `devis_accepter` (lot 49). Le client ne peut que signer, pas refuser en ligne.
--   4. LA PREUVE : nom, qualite, case « Bon pour accord », date et heure du SERVEUR,
--      empreinte de la copie signee, adresse IP (premiere valeur de x-forwarded-for :
--      un INDICE, le client peut la forger) et navigateur. Le signataire en est
--      informe sur la page (RGPD art. 13), et la politique de confidentialite le dit.
--   5. PROS SEULEMENT pour l'instant : l'ecran le dit, la page fait signer « au nom
--      de » l'entreprise cliente. Les particuliers attendent un juriste.
--
-- CE QUI EST OUVERT A L'EXTERIEUR, ET COMMENT :
--   La page /signer/ du site ne parle PAS a PostgREST. Elle parle a la fonction Edge
--   `signature` (verify_jwt desactive), qui appelle `signature_lire` et
--   `signature_poser` avec la cle de service. Ces deux fonctions ne sont executables
--   par AUCUN role du navigateur, ni anon ni authenticated : la doc Supabase deconseille
--   une fonction `security definer` ouverte a anon dans `public`.
--   Le jeton fait 64 caracteres hexadecimaux (244 bits aleatoires, deux uuid v4, comme
--   l'invitation du lot 18). La base n'en garde que l'EMPREINTE.
--
-- CE QUI CHANGE DANS CE QUI EXISTE :
--   - le corps de `devis_accepter` passe dans `devis_accepter_coeur`, appelable par la
--     seule base. `devis_accepter` garde sa signature, ses refus et ses messages ;
--   - `devis_annuler_accord` efface aussi `signe_le` et eteint les liens du devis : un
--     lien deja signe ne doit pas faire croire qu'il reste a signer ;
--   - `v_courrier` gagne une colonne `signes`, EN DERNIER.
-- ============================================================================

-- 1. LES LIENS. Une ligne par lien cree ; le dernier non remplace est le seul vivant.
create table if not exists public.devis_liens (
  lien_id     uuid primary key default gen_random_uuid(),
  bureau      uuid not null,
  devis_id    uuid not null,
  jeton_hash  text not null unique check (jeton_hash ~ '^[0-9a-f]{64}$'),
  cree_le     timestamptz not null default now(),
  cree_par    uuid references auth.users(id) on delete set null,
  remplace_le timestamptz,
  foreign key (bureau, devis_id) references public.devis(bureau, devis_id) on delete cascade
);
create index if not exists devis_liens_devis on public.devis_liens (bureau, devis_id);
alter table public.devis_liens enable row level security;
drop policy if exists devis_liens_lire on public.devis_liens;
create policy devis_liens_lire on public.devis_liens for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
revoke all on public.devis_liens from public, anon, authenticated;
-- L'empreinte du jeton ne se lit pas, meme par le bureau : elle ne sert qu'a la base.
grant select (lien_id, bureau, devis_id, cree_le, cree_par, remplace_le) on public.devis_liens to authenticated;

-- 2. LES SIGNATURES. La preuve, une par lien. Elle ne se modifie ni ne se supprime.
create table if not exists public.devis_signatures (
  lien_id          uuid primary key references public.devis_liens(lien_id) on delete cascade,
  bureau           uuid not null,
  devis_id         uuid not null,
  numero           text not null,
  signe_le         timestamptz not null default now(),
  nom              text not null check (char_length(nom) between 2 and 120),
  qualite          text not null check (char_length(qualite) between 2 and 120),
  accord           boolean not null check (accord),
  au_nom_de        text check (au_nom_de is null or char_length(au_nom_de) <= 200),
  papier_empreinte text not null check (papier_empreinte ~ '^[0-9a-f]{64}$'),
  total_ht_c       bigint,
  total_ttc_c      bigint,
  ip               text check (ip is null or char_length(ip) <= 64),
  agent            text check (agent is null or char_length(agent) <= 400),
  foreign key (bureau, devis_id) references public.devis(bureau, devis_id) on delete cascade
);
create index if not exists devis_signatures_devis on public.devis_signatures (bureau, devis_id);
create index if not exists devis_signatures_le on public.devis_signatures (signe_le);
alter table public.devis_signatures enable row level security;
drop policy if exists devis_signatures_lire on public.devis_signatures;
create policy devis_signatures_lire on public.devis_signatures for select to authenticated using
  ( bureau in (select m.bureau from public.membres m where m.personne = (select auth.uid())) );
revoke all on public.devis_signatures from public, anon, authenticated;
grant select on public.devis_signatures to authenticated;

create or replace function public.devis_signatures_figer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'signature du devis : elle ne se modifie ni ne se supprime' using errcode = '23514';
end
$$;
revoke all on function public.devis_signatures_figer() from public, anon, authenticated;
drop trigger if exists devis_signatures_figer on public.devis_signatures;
-- pg_trigger_depth() = 0 : la cascade d'une suppression de bureau passe, un geste direct non.
create trigger devis_signatures_figer before update or delete on public.devis_signatures
  for each row when (pg_trigger_depth() = 0) execute function public.devis_signatures_figer();

-- 3. CE QUI EMPECHE UNE COMMANDE, ECRIT UNE FOIS. Lu par l'acceptation et par la
--    creation d'un lien : on ne propose pas de signer ce qui ne pourrait pas s'accepter.
--    Rend null si rien ne bloque, sinon le message que l'ecran reconnait deja.
create or replace function public.devis_obstacle(p_bureau uuid, p_devis uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare d public.devis; af public.affaires;
begin
  select * into d from public.devis x where x.bureau = p_bureau and x.devis_id = p_devis;
  if not found then return 'devis introuvable'; end if;
  select * into af from public.affaires x where x.bureau = p_bureau and x.affaire_id = d.affaire_id;
  if af.issue = 'perdue' then return 'affaire close'; end if;
  if exists (select 1 from public.devis x where x.bureau = p_bureau and x.affaire_id = d.affaire_id
               and x.statut = 'accepte' and x.devis_id <> d.devis_id) then
    return 'affaire deja commandee';
  end if;
  if exists (select 1 from public.devis_lignes x where x.bureau = p_bureau and x.devis_id = d.devis_id
               and nullif(btrim(coalesce(x.num_produit, '')), '') is null) then
    return 'ligne sans numero produit';
  end if;
  if not coalesce((d.acheteur->>'nouveau')::boolean, false)
     and nullif(btrim(coalesce(d.num_client, d.acheteur->>'num_client', '')), '') is null
     and nullif(btrim(coalesce(d.acheteur->>'email', '')), '') is null then
    return 'client sans numero ni e-mail';
  end if;
  return null;
end
$$;
revoke all on function public.devis_obstacle(uuid, uuid) from public, anon, authenticated;

-- 4. ACCEPTER, LE COEUR. Le corps du lot 52 sans la verification de membre, plus
--    l'auteur et la date de signature passes par l'appelant. Appelable par la seule base.
drop function if exists public.devis_accepter_coeur(uuid, uuid, text, uuid, timestamptz);
create function public.devis_accepter_coeur(p_bureau uuid, p_devis uuid, p_papier text,
  p_par uuid, p_signe_le timestamptz)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare d public.devis; af public.affaires; v_tarif text; obst text;
begin
  select * into d from public.devis x
   where x.bureau = p_bureau and x.devis_id = p_devis for update;
  if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
  if d.statut = 'accepte' then return d; end if;
  if d.statut not in ('enregistre', 'envoye') then
    raise exception 'devis non acceptable : il n''est plus en cours' using errcode = '23514';
  end if;

  select * into af from public.affaires x
   where x.bureau = p_bureau and x.affaire_id = d.affaire_id for update;
  obst := public.devis_obstacle(p_bureau, d.devis_id);
  if obst is not null then raise exception '%', obst using errcode = '23514'; end if;

  if d.client_cle is not null then
    select (array_agg(btrim(l.code_tarif) order by l.le_jour desc nulls last)
              filter (where nullif(btrim(l.code_tarif), '') is not null))[1]
      into v_tarif
      from public.ventes_lignes l
     where l.bureau = p_bureau and l.client_cle = d.client_cle;
  end if;

  if d.papier_empreinte is null and d.statut = 'envoye' then
    perform public.devis_ranger_copie(p_bureau, d.devis_id, d.numero, p_papier);
  end if;

  update public.devis x
     set statut = 'accepte', accepte_le = now(), accepte_par = p_par,
         code_tarif = left(v_tarif, 40), signe_le = p_signe_le
   where x.bureau = p_bureau and x.devis_id = d.devis_id
  returning * into d;

  if af.issue = 'en_cours' then
    update public.affaires x set issue = 'gagnee'
     where x.bureau = p_bureau and x.affaire_id = af.affaire_id;
  end if;
  return d;
end
$$;
revoke all on function public.devis_accepter_coeur(uuid, uuid, text, uuid, timestamptz) from public, anon, authenticated;

-- 5. ACCEPTER, LA PORTE DU BUREAU. Meme signature, memes refus, memes messages.
drop function if exists public.devis_accepter(uuid, uuid, text);
create function public.devis_accepter(p_bureau uuid, p_devis uuid, p_papier text default null)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  return public.devis_accepter_coeur(p_bureau, p_devis, p_papier, auth.uid(), null);
end
$$;
revoke all on function public.devis_accepter(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.devis_accepter(uuid, uuid, text) to authenticated;

-- 6. ANNULER UNE ACCEPTATION : le corps du lot 51, plus `signe_le` efface et les liens
--    du devis eteints. Un lien deja signe ne doit plus faire croire qu'il reste a signer :
--    pour faire resigner, le vigneron cree un nouveau lien.
drop function if exists public.devis_annuler_accord(uuid, uuid, boolean);
create function public.devis_annuler_accord(p_bureau uuid, p_devis uuid, p_rouvrir boolean default true)
returns public.devis
language plpgsql
security definer
set search_path = ''
as $$
declare d public.devis; af public.affaires;
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  select * into d from public.devis x
   where x.bureau = p_bureau and x.devis_id = p_devis for update;
  if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
  if d.statut <> 'accepte' then
    raise exception 'devis non accepte : rien a annuler' using errcode = '23514';
  end if;
  select * into af from public.affaires x
   where x.bureau = p_bureau and x.affaire_id = d.affaire_id for update;

  update public.devis x
     set statut = case when x.envoye_le is not null then 'envoye' else 'enregistre' end,
         accepte_le = null, accepte_par = null, code_tarif = null, signe_le = null,
         accord_annule_le = now(), accord_annule_par = auth.uid()
   where x.bureau = p_bureau and x.devis_id = d.devis_id
  returning * into d;

  update public.devis_liens x set remplace_le = now()
   where x.bureau = p_bureau and x.devis_id = d.devis_id and x.remplace_le is null;

  if coalesce(p_rouvrir, true) and af.issue = 'gagnee' then
    update public.affaires x set issue = 'en_cours'
     where x.bureau = p_bureau and x.affaire_id = af.affaire_id;
  end if;
  return d;
end
$$;
revoke all on function public.devis_annuler_accord(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.devis_annuler_accord(uuid, uuid, boolean) to authenticated;

-- 7. CREER UN LIEN. Rend le jeton UNE fois : la base n'en garde que l'empreinte.
--    Un nouveau lien eteint le precedent (un lien perdu se remplace, comme une invitation).
-- Refus : 42501 hors du bureau ; P0002 devis introuvable ; 23514 devis non envoye, sans
-- copie, expire, affaire close ou deja commandee, ligne sans code, client sans numero ni e-mail.
drop function if exists public.devis_lien_creer(uuid, uuid);
create function public.devis_lien_creer(p_bureau uuid, p_devis uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare d public.devis; af public.affaires; obst text; jeton text;
begin
  if p_bureau is null or not public.est_membre(p_bureau) then
    raise exception 'pas membre de ce bureau' using errcode = '42501';
  end if;
  select * into d from public.devis x
   where x.bureau = p_bureau and x.devis_id = p_devis for update;
  if not found then raise exception 'devis introuvable' using errcode = 'P0002'; end if;
  if d.statut <> 'envoye' then
    raise exception 'devis non envoye : pas de lien de signature' using errcode = '23514';
  end if;
  if d.papier_empreinte is null then
    raise exception 'copie absente : pas de lien de signature' using errcode = '23514';
  end if;
  if d.valable_jusqu is not null and d.valable_jusqu < public.devis_jour(now()) then
    raise exception 'devis expire : pas de lien de signature' using errcode = '23514';
  end if;
  select * into af from public.affaires x where x.bureau = p_bureau and x.affaire_id = d.affaire_id;
  if af.issue <> 'en_cours' then raise exception 'affaire close' using errcode = '23514'; end if;
  obst := public.devis_obstacle(p_bureau, d.devis_id);
  if obst is not null then raise exception '%', obst using errcode = '23514'; end if;

  update public.devis_liens x set remplace_le = now()
   where x.bureau = p_bureau and x.devis_id = d.devis_id and x.remplace_le is null;
  jeton := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.devis_liens (bureau, devis_id, jeton_hash, cree_par)
    values (p_bureau, d.devis_id, encode(sha256(convert_to(jeton, 'UTF8')), 'hex'), auth.uid());
  return jeton;
end
$$;
revoke all on function public.devis_lien_creer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.devis_lien_creer(uuid, uuid) to authenticated;

-- 8. CE QUE VOIT LE CLIENT. Appelee par la fonction Edge `signature`, et par elle seule.
--    `etat` : inconnu, a_signer, signe, expire, clos. La copie ne part que pour a_signer
--    et signe : un lien eteint n'a rien a montrer.
drop function if exists public.signature_lire(text);
create function public.signature_lire(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare l public.devis_liens; d public.devis; s public.devis_signatures; af public.affaires; dom jsonb; etat text; pap text;
begin
  if p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then return jsonb_build_object('etat', 'inconnu'); end if;
  select * into l from public.devis_liens x where x.jeton_hash = encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex');
  if not found then return jsonb_build_object('etat', 'inconnu'); end if;
  select * into d from public.devis x where x.bureau = l.bureau and x.devis_id = l.devis_id;
  select * into s from public.devis_signatures x where x.lien_id = l.lien_id;
  select * into af from public.affaires x where x.bureau = l.bureau and x.affaire_id = d.affaire_id;
  dom := d.vendeur;
  if s.lien_id is not null then etat := 'signe';
  elsif l.remplace_le is not null or d.statut <> 'envoye' or af.issue <> 'en_cours' then etat := 'clos';
  elsif d.valable_jusqu is not null and d.valable_jusqu < public.devis_jour(now()) then etat := 'expire';
  elsif public.devis_obstacle(l.bureau, d.devis_id) is not null then etat := 'clos';
  else etat := 'a_signer';
  end if;
  -- Un lien eteint ou expire ne montre ni le client, ni les montants, ni la copie :
  -- le numero, le domaine (pour le contacter) et la date de validite suffisent a le dire.
  if etat in ('clos', 'expire') then
    return jsonb_build_object('etat', etat, 'numero', d.numero,
      'vendeur', coalesce(dom->>'raison_sociale', dom->>'nom', ''), 'vendeur_email', dom->>'email',
      'valable_jusqu', d.valable_jusqu);
  end if;
  select c.papier into pap from public.devis_copies c where c.bureau = l.bureau and c.devis_id = d.devis_id;
  return jsonb_build_object(
    'etat', etat,
    'numero', d.numero,
    'vendeur', coalesce(dom->>'raison_sociale', dom->>'nom', ''),
    'vendeur_email', dom->>'email',
    'client', coalesce(d.acheteur->>'nom', ''),
    'total_ht_c', d.total_ht_c,
    'total_ttc_c', d.total_ttc_c,
    'valable_jusqu', d.valable_jusqu,
    'empreinte', d.papier_empreinte,
    'papier', pap,
    'signe_le', s.signe_le,
    'signe_nom', s.nom,
    'signe_qualite', s.qualite);
end
$$;
revoke all on function public.signature_lire(text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.signature_lire(text) to service_role;
  end if;
end $$;

-- 9. SIGNER. Appelee par la fonction Edge `signature`, et par elle seule.
--    `p_empreinte` est celle de la copie que la page a MONTREE : si elle differe de celle
--    du devis, on ne signe pas (le client signerait autre chose que ce qu'il a lu).
--    Rend le meme objet que `signature_lire`, plus `bloque` (le message) si l'acceptation
--    est refusee : alors rien n'est ecrit, pas meme la preuve.
drop function if exists public.signature_poser(text, text, text, boolean, text, text, text);
create function public.signature_poser(p_jeton text, p_nom text, p_qualite text,
  p_accord boolean, p_empreinte text, p_ip text default null, p_agent text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare l public.devis_liens; d public.devis; af public.affaires; nom text; qual text; maintenant timestamptz := now(); obst text;
begin
  if p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then return jsonb_build_object('etat', 'inconnu'); end if;
  select * into l from public.devis_liens x
   where x.jeton_hash = encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex');
  if not found then return jsonb_build_object('etat', 'inconnu'); end if;
  -- Le devis puis l'affaire sont verrouilles, dans l'ordre de `devis_accepter` : deux
  -- signatures en meme temps n'en font qu'une, et une acceptation concurrente est vue.
  select * into d from public.devis x where x.bureau = l.bureau and x.devis_id = l.devis_id for update;
  select * into af from public.affaires x where x.bureau = l.bureau and x.affaire_id = d.affaire_id for update;
  -- Le lien est RELU sous le verrou : un nouveau lien cree pendant l'attente l'a eteint.
  select * into l from public.devis_liens x where x.lien_id = l.lien_id;
  if exists (select 1 from public.devis_signatures x where x.lien_id = l.lien_id)
     or l.remplace_le is not null or d.statut <> 'envoye' or af.issue <> 'en_cours'
     or (d.valable_jusqu is not null and d.valable_jusqu < public.devis_jour(maintenant)) then
    return public.signature_lire(p_jeton);
  end if;

  -- Les caracteres de controle partent, les blancs se resserrent.
  nom  := btrim(regexp_replace(regexp_replace(coalesce(p_nom, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g'));
  qual := btrim(regexp_replace(regexp_replace(coalesce(p_qualite, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g'));
  -- Au moins une lettre : un nom fait de caracteres invisibles n'est pas une preuve.
  if char_length(nom) not between 2 and 120 or nom !~ '[[:alpha:]]' then
    return jsonb_build_object('etat', 'a_signer', 'refus', 'nom');
  end if;
  if char_length(qual) not between 2 and 120 or qual !~ '[[:alpha:]]' then
    return jsonb_build_object('etat', 'a_signer', 'refus', 'qualite');
  end if;
  if not coalesce(p_accord, false) then
    return jsonb_build_object('etat', 'a_signer', 'refus', 'accord');
  end if;
  if p_empreinte is distinct from d.papier_empreinte then
    return jsonb_build_object('etat', 'a_signer', 'refus', 'empreinte');
  end if;
  obst := public.devis_obstacle(l.bureau, d.devis_id);
  if obst is not null then
    return jsonb_build_object('etat', 'clos', 'bloque', obst);
  end if;

  -- Si l'acceptation refuse malgre tout, rien n'est ecrit, pas meme la preuve, et la page
  -- recoit le refus en clair au lieu d'une erreur.
  begin
    insert into public.devis_signatures (lien_id, bureau, devis_id, numero, signe_le, nom, qualite, accord,
        au_nom_de, papier_empreinte, total_ht_c, total_ttc_c, ip, agent)
      values (l.lien_id, l.bureau, d.devis_id, d.numero, maintenant, nom, qual, true,
        left(nullif(btrim(coalesce(d.acheteur->>'nom', '')), ''), 200), d.papier_empreinte,
        d.total_ht_c, d.total_ttc_c, left(nullif(btrim(coalesce(p_ip, '')), ''), 64),
        left(nullif(btrim(coalesce(p_agent, '')), ''), 400));
    perform public.devis_accepter_coeur(l.bureau, d.devis_id, null, null, maintenant);
  exception when check_violation then
    return jsonb_build_object('etat', 'clos', 'bloque', sqlerrm);
  end;
  return public.signature_lire(p_jeton);
end
$$;
revoke all on function public.signature_poser(text, text, text, boolean, text, text, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.signature_poser(text, text, text, boolean, text, text, text) to service_role;
  end if;
end $$;

-- 10. LE COURRIER DU MATIN : la vue du lot 36 a l'identique, plus `signes` EN DERNIER.
--     Les devis signes en ligne depuis 24 heures : le courrier part vers 8 h 05, chaque
--     signature tombe donc dans UN courrier (a quelques minutes pres, aux deux bouts).
create or replace view public.v_courrier with (security_invoker = true) as
with base as (
  select p.id as personne, p.email, p.jeton_emails, p.bureau_courant as bureau
    from public.profils p
   where p.consent_courrier and p.bureau_courant is not null
), signaux_gardes as (
  select b.personne, jsonb_agg(s.valeur order by s.n) as signaux
    from base b
    join public.reglages r on r.bureau = b.bureau
    cross join lateral jsonb_array_elements(
      coalesce(r.file_travail -> 'signaux', '[]'::jsonb)) with ordinality s(valeur, n)
   where not exists (
     select 1 from public.suivi_clients sc
      where sc.bureau = b.bureau
        and sc.client_id = (s.valeur ->> 'id')
        and (sc.rappel is not null or sc.statut = 'traite'))
   group by b.personne
), suivis_actifs as (
  select b.personne, jsonb_agg(to_jsonb(sc.*)) as suivis
    from base b join public.suivi_clients sc on sc.bureau = b.bureau
   where sc.rappel is not null and sc.statut is distinct from 'traite'
   group by b.personne
), taches_ouvertes as (
  select b.personne, jsonb_agg(to_jsonb(t.*)) as taches
    from base b join public.taches t on t.bureau = b.bureau
   where t.fait_le is null
   group by b.personne
), affaires_a_relancer as (
  select b.personne,
         jsonb_agg(jsonb_build_object(
           'affaire_id',   a.affaire_id,
           'nom',          coalesce(pi.nom, a.client_nom, a.titre),
           'titre',        a.titre,
           'type',         ty.nom,
           'etape',        et.nom,
           'rappel',       a.rappel,
           'rappel_titre', a.rappel_titre,
           'issue',        a.issue
         ) order by a.rappel) as affaires
    from base b
    join public.affaires a on a.bureau = b.bureau
    left join public.pistes         pi on pi.piste_id = a.piste_id and pi.bureau = a.bureau
    left join public.affaire_types  ty on ty.type_id  = a.type_id  and ty.bureau = a.bureau
    left join public.affaire_etapes et on et.etape_id = a.etape_id and et.bureau = a.bureau
   where a.issue = 'en_cours' and a.rappel is not null
   group by b.personne
), devis_signes as (
  select b.personne,
         jsonb_agg(jsonb_build_object(
           'numero',     sig.numero,
           'client',     coalesce(sig.au_nom_de, ''),
           'signataire', sig.nom,
           'total_ht_c', sig.total_ht_c,
           'signe_le',   sig.signe_le
         ) order by sig.signe_le) as signes
    from base b
    join public.devis_signatures sig on sig.bureau = b.bureau
    join public.devis dv on dv.bureau = sig.bureau and dv.devis_id = sig.devis_id
   where sig.signe_le > now() - interval '24 hours'
     and dv.statut = 'accepte' and dv.signe_le = sig.signe_le
   group by b.personne
)
select b.personne as id,
       b.email,
       b.jeton_emails,
       r.depose_le,
       coalesce(r.file_travail -> 'noms', '{}'::jsonb) as noms,
       coalesce(sg.signaux, '[]'::jsonb) as signaux,
       coalesce(sa.suivis,  '[]'::jsonb) as suivis,
       coalesce(tc.taches,  '[]'::jsonb) as taches,
       r.resume_ventes,
       coalesce(ar.affaires, '[]'::jsonb) as affaires,
       coalesce(ds.signes, '[]'::jsonb) as signes
  from base b
  join public.reglages r on r.bureau = b.bureau
  left join signaux_gardes      sg on sg.personne = b.personne
  left join suivis_actifs       sa on sa.personne = b.personne
  left join taches_ouvertes     tc on tc.personne = b.personne
  left join affaires_a_relancer ar on ar.personne = b.personne
  left join devis_signes        ds on ds.personne = b.personne;

revoke all on public.v_courrier from anon, authenticated;
grant select on public.v_courrier to authenticated;

-- CONTROLES, a lancer apres (ils ne modifient rien)
-- 1) Personne du navigateur ne peut lire ni poser une signature par la base :
--    select has_function_privilege('anon', 'public.signature_poser(text, text, text, boolean, text, text, text)', 'execute'),
--           has_function_privilege('authenticated', 'public.signature_lire(text)', 'execute');
--    -> false, false
-- 2) La vue garde security_invoker et finit par `signes` :
--    select reloptions from pg_class where relname = 'v_courrier';
--    select column_name from information_schema.columns where table_name = 'v_courrier'
--     order by ordinal_position desc limit 1;
--    -> {security_invoker=true} ; signes
