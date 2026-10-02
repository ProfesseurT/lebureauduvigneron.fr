-- ============================================================================
-- LOT 56, 01/10/2026 : LES AFFAIRES ET LES PISTES DURCIES. A COLLER APRES LE LOT 55.
-- ============================================================================
-- Ce que le verificateur « base » a trouve sur les lots 34 a 39 en les REJOUANT sur un
-- PostgreSQL 16 jetable (rapport du 01/10/2026), et que ce lot ferme :
--
--   1. Une etape deplacee vers un autre type figeait ses affaires pour toujours, et deux
--      ajouts d'etape simultanes passaient le plafond de six (B1, B5).
--   2. « Ne plus la contacter » et la purge a trois ans laissaient l'adresse, le code
--      postal et les notes des affaires de la piste, que la page rgpd dit effaces (B2).
--   3. Un simple utilisateur pouvait effacer d'une requete toutes les affaires, les pistes
--      et la fiche du domaine. L'ecran ne supprime jamais ni l'un ni l'autre (B4).
--   4. La purge effacait les coordonnees d'une piste dont l'affaire etait GAGNEE (B8).
--   5. Une opposition pouvait etre levee par n'importe quel membre, trace comprise.
--   6. Deux pistes au meme SIRET dans un bureau (zero doublon en production le 01/10/2026,
--      une seule piste). Et deux formes que l'ecran ne produit jamais : un client vide,
--      une affaire perdue sans motif.
--   7. (tour 2) Une affaire d'une piste en opposition restait a relancer, au courrier du
--      matin compris, et une nouvelle affaire ou une piste au meme nom passait (N3, N4).
--
-- CE QUI RESTE VRAI : « vider la base » n'y touche pas, la suppression d'un BUREAU
-- emporte toujours ses affaires, pistes et domaine par cascade (une action referentielle
-- ne passe ni par les droits ni par les politiques de l'appelant).
--
-- ATTENTION A L'ORDRE : rejouer ensuite les lots 34 ou 38 REMET le droit DELETE et les
-- politiques de suppression. Ce lot vient apres eux dans ORDRE (scripts/banc-rejeu.mjs).
-- REJOUABLE : chaque instruction se repasse sans erreur. Banc : banc-lot56-affaires-durcies.sql.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. UNE ETAPE NE CHANGE PAS DE TYPE, ET LE PLAFOND TIENT A DEUX SESSIONS
-- ---------------------------------------------------------------------------
-- Une etape passee d'un type a l'autre laisse ses affaires sur un couple (type, etape)
-- incoherent, et affaires_signer refuse ensuite TOUTE ecriture sur elles : ni titre, ni
-- conclure. L'ecran ne deplace jamais une etape : on interdit le geste.
-- Le verrou sur la ligne du type sert le plafond : sans lui, deux sessions comptent cinq
-- chacune, ajoutent chacune la sixieme, et le type en porte sept.
create or replace function public.affaire_etapes_plafond()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.type_id is distinct from old.type_id then
    raise exception 'une etape ne change pas de type d''affaire' using errcode = '23514';
  end if;
  perform 1 from public.affaire_types t
   where t.bureau = new.bureau and t.type_id = new.type_id
     for update;
  if (select count(*) from public.affaire_etapes e
       where e.bureau = new.bureau and e.type_id = new.type_id
         and e.etape_id <> new.etape_id) >= 6 then
    raise exception 'six etapes au plus par type d''affaire' using errcode = '23514';
  end if;
  return new;
end
$$;
revoke all on function public.affaire_etapes_plafond() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. L'OPPOSITION EFFACE TOUT CE QUI PERMET DE JOINDRE, ET ELLE NE SE LEVE PAS
-- ---------------------------------------------------------------------------
-- Effaces : contact, fonction, e-mail, telephone, notes, ADRESSE, CODE POSTAL (lot 39 les
-- avait ajoutes sans les ajouter ici), et les notes des affaires de la piste.
-- Gardes : le nom, la VILLE et le SIRET. Ils identifient l'etablissement (c'est ce qui
-- empeche de le recreer et de le rappeler) et ne permettent pas de le joindre.
--
-- POURQUOI UNE OPPOSITION NE REDEVIENT JAMAIS FAUSSE DEPUIS LE NAVIGATEUR : c'est la
-- trace qu'une personne a demande a ne plus etre contactee. La lever d'un clic effacerait
-- la seule preuve que la demande a ete respectee, et rouvrirait la saisie de coordonnees
-- que la personne a refusees. L'ecran ne propose pas le geste ; la base le refuse a tout
-- compte connecte. Si la personne revient d'elle-meme, c'est Solumatic, sur demande
-- ecrite, qui la leve (role de service, hors de toute session).
create or replace function public.pistes_signer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare avant text;
begin
  if tg_op = 'INSERT' then
    new.cree_par := coalesce(auth.uid(), new.cree_par); new.cree_le := now();
    avant := null;
  else
    new.cree_par := old.cree_par; new.cree_le := old.cree_le;
    new.lie_par := old.lie_par; new.lie_le := old.lie_le;
    avant := old.client_id;
    if old.opposition and not new.opposition and auth.uid() is not null then
      raise exception 'une opposition ne se leve pas depuis le bureau' using errcode = '42501';
    end if;
  end if;
  if auth.uid() is not null then new.maj_par := auth.uid(); end if;
  new.maj_le := now();
  -- N3 (tour 2) : une personne en opposition ne se recree pas sous le meme nom. Le meme
  -- SIRET est deja refuse par l'index unique de la section 5. Le nom se compare sans
  -- casse ni espaces multiples ; l'ecran compare plus large (noms proches).
  if tg_op = 'INSERT' and exists (
       select 1 from public.pistes o
        where o.bureau = new.bureau and o.opposition and o.piste_id <> new.piste_id
          and lower(regexp_replace(btrim(o.nom), '\s+', ' ', 'g'))
            = lower(regexp_replace(btrim(new.nom), '\s+', ' ', 'g'))) then
    raise exception 'cette personne ne veut plus etre contactee' using errcode = '23514';
  end if;
  if new.client_id is distinct from avant then
    if new.client_id is null then
      new.lie_par := null; new.lie_le := null;
    else
      new.lie_par := auth.uid(); new.lie_le := now();
    end if;
  elsif tg_op = 'INSERT' then
    new.lie_par := null; new.lie_le := null;
  end if;
  if new.opposition then
    new.contact_nom := null; new.contact_fonction := null;
    new.email := null; new.telephone := null; new.notes := null;
    new.adresse := null; new.code_postal := null;
  end if;
  return new;
end
$$;
revoke all on function public.pistes_signer() from public, anon, authenticated;

-- Les notes des AFFAIRES de la piste : une table voisine, donc un declencheur apres.
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
    -- N4 (tour 2) : on ne rappelle plus. Le rappel de ses affaires en cours part avec.
    update public.affaires a set rappel = null, rappel_titre = null
     where a.bureau = new.bureau and a.piste_id = new.piste_id
       and a.issue = 'en_cours' and a.rappel is not null;
  end if;
  return null;
end
$$;
revoke all on function public.pistes_opposition_affaires() from public, anon, authenticated;

drop trigger if exists pistes_opposition_affaires on public.pistes;
create trigger pistes_opposition_affaires
  after update of opposition on public.pistes
  for each row execute function public.pistes_opposition_affaires();


-- ---------------------------------------------------------------------------
-- 3. LA PURGE A TROIS ANS : ADRESSE ET NOTES D'AFFAIRES, ET JAMAIS UNE PISTE GAGNEE
-- ---------------------------------------------------------------------------
-- Une piste dont une affaire a ete GAGNEE est devenue cliente, meme si le lien vers
-- « Mes clients » n'est pas pose (rien ne le pose encore) : ce n'est plus de la
-- prospection, la reference CNIL des trois ans ne s'applique pas.
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
                        where a.bureau = p.bureau and a.piste_id = p.piste_id and a.notes is not null))
       and not exists (select 1 from public.affaires a
                        where a.bureau = p.bureau and a.piste_id = p.piste_id
                          and (a.issue in ('en_cours', 'gagnee')
                               or a.maj_le >= now() - interval '3 years'))
  ), notes as (
    update public.affaires a set notes = null
      from cibles c where a.bureau = c.bureau and a.piste_id = c.piste_id and a.notes is not null
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
-- 4. PERSONNE NE SUPPRIME UNE AFFAIRE, UNE PISTE NI LA FICHE DU DOMAINE
-- ---------------------------------------------------------------------------
-- L'ecran ne le fait jamais (une affaire se classe, une piste passe en opposition, la
-- fiche se corrige). Le droit ne servait qu'a rendre une perte d'historique possible
-- d'une seule requete. Les types et les etapes gardent le leur : l'ecran retire une
-- etape vide, et la cle `restrict` refuse deja une etape qui porte une affaire.
revoke delete on public.affaires, public.pistes, public.domaine from authenticated;
drop policy if exists affaires_supprimer on public.affaires;
drop policy if exists pistes_supprimer  on public.pistes;
drop policy if exists domaine_supprimer on public.domaine;


-- ---------------------------------------------------------------------------
-- 5. UN SIRET, UNE PISTE PAR BUREAU
-- ---------------------------------------------------------------------------
-- L'ecran le refuse sur ce qu'il a en memoire ; un collegue au meme moment passait.
-- Verifie le 01/10/2026 en production : zero doublon. L'index simple du lot 39 devient
-- inutile, l'index unique sert les memes recherches.
create unique index if not exists pistes_siret_unique
  on public.pistes (bureau, siret) where siret is not null;
drop index if exists public.pistes_siret;


-- ---------------------------------------------------------------------------
-- 6. DEUX FORMES QUE L'ECRAN NE PRODUIT JAMAIS
-- ---------------------------------------------------------------------------
-- Un client vide passait la contrainte « piste ou client » (elle ne voit que null).
-- Une affaire perdue sans motif : l'ecran envoie toujours le motif du menu, et
-- `devis_refuser` pose « autre » par defaut. Posees NOT VALID puis validees : si une
-- ligne ancienne les enfreint, la validation echoue sans rien casser, le lot continue,
-- et la contrainte tient quand meme pour toute ecriture neuve.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'affaires_client_non_vide') then
    alter table public.affaires add constraint affaires_client_non_vide
      check (client_id is null or btrim(client_id) <> '') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'affaires_perdue_motif') then
    alter table public.affaires add constraint affaires_perdue_motif
      check (issue <> 'perdue' or motif is not null) not valid;
  end if;
  begin
    alter table public.affaires validate constraint affaires_client_non_vide;
  exception when check_violation then
    raise notice 'affaires_client_non_vide : des lignes anciennes ont un client vide, contrainte gardee non validee';
  end;
  begin
    alter table public.affaires validate constraint affaires_perdue_motif;
  exception when check_violation then
    raise notice 'affaires_perdue_motif : des affaires perdues anciennes sont sans motif, contrainte gardee non validee';
  end;
end
$$;


-- ---------------------------------------------------------------------------
-- 7. UNE PERSONNE EN OPPOSITION NE SE RAPPELLE PLUS (tour 2, N3 et N4, 02/10/2026)
-- ---------------------------------------------------------------------------
-- L'opposition effacait les coordonnees, mais l'affaire de la piste restait « a relancer »,
-- dans Ma journee et dans le courrier du matin, et une nouvelle affaire pouvait s'ouvrir
-- dessus. L'ecran ne le propose plus ; la base le refuse aussi :
--   - aucune affaire ne s'ouvre sur une piste en opposition, ni ne s'y rattache ;
--   - aucun rappel neuf ne se pose sur l'affaire d'une piste en opposition ;
--   - l'opposition efface le rappel des affaires en cours (section 2) ;
--   - une affaire classee d'une piste en opposition ne se rouvre pas (T5, tour 3) ;
--   - le courrier du matin ne porte plus ces affaires.
-- Classer l'affaire (« Pas pour cette fois ») et relire ses notes restent permis.
create or replace function public.affaires_opposition_garde()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.piste_id is null or not exists (
       select 1 from public.pistes p
        where p.bureau = new.bureau and p.piste_id = new.piste_id and p.opposition) then
    return new;
  end if;
  if tg_op = 'INSERT' or new.piste_id is distinct from old.piste_id then
    raise exception 'cette personne ne veut plus etre contactee' using errcode = '23514';
  end if;
  if new.issue = 'en_cours' and new.rappel is not null and new.rappel is distinct from old.rappel then
    raise exception 'cette personne ne veut plus etre contactee' using errcode = '23514';
  end if;
  -- T5 (tour 3) : une affaire CLASSEE d'une personne en opposition ne se rouvre pas.
  -- Rouverte, elle redeviendrait une affaire a relancer sur quelqu'un qu'on ne rappelle plus.
  if new.issue = 'en_cours' and old.issue is distinct from 'en_cours' then
    raise exception 'cette personne ne veut plus etre contactee' using errcode = '23514';
  end if;
  return new;
end
$$;
revoke all on function public.affaires_opposition_garde() from public, anon, authenticated;

drop trigger if exists affaires_opposition_garde on public.affaires;
create trigger affaires_opposition_garde
  before insert or update of piste_id, rappel, issue on public.affaires
  for each row execute function public.affaires_opposition_garde();

-- Les rappels deja poses sur une piste en opposition avant ce lot.
update public.affaires a set rappel = null, rappel_titre = null
  from public.pistes p
 where p.bureau = a.bureau and p.piste_id = a.piste_id and p.opposition
   and a.issue = 'en_cours' and a.rappel is not null;

-- T3 (tour 3) : LE RATTRAPAGE DES OPPOSITIONS D'AVANT CE LOT. Les sections 2 et 3 n'effacent
-- qu'au PASSAGE de l'opposition a vrai : une piste deja en opposition gardait son adresse,
-- son code postal (le lot 34 ne les connaissait pas, le lot 39 les a ajoutes sans eux) et
-- les notes de ses affaires, que la page rgpd dit effaces. Rejouable : la seconde passe ne
-- trouve plus rien a effacer et ne touche aucune ligne.
update public.pistes p set adresse = null, code_postal = null
 where p.opposition and (p.adresse is not null or p.code_postal is not null);
update public.affaires a set notes = null
  from public.pistes p
 where p.bureau = a.bureau and p.piste_id = a.piste_id and p.opposition
   and a.notes is not null;

-- Le courrier du matin : la vue du lot 55 A L'IDENTIQUE (memes colonnes, meme ordre,
-- security_invoker garde), plus une ligne dans `affaires_a_relancer`.
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
     and not coalesce(pi.opposition, false)
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


-- ---------------------------------------------------------------------------
-- CONTROLES, a lancer apres (ils ne modifient rien)
-- ---------------------------------------------------------------------------
-- select tablename, policyname from pg_policies
--  where tablename in ('affaires','pistes','domaine') and cmd = 'DELETE';          -> 0 ligne
-- select table_name from information_schema.role_table_grants
--  where grantee = 'authenticated' and privilege_type = 'DELETE'
--    and table_name in ('affaires','pistes','domaine');                            -> 0 ligne
-- select conname, convalidated from pg_constraint
--  where conname in ('affaires_client_non_vide','affaires_perdue_motif');          -> 2 lignes, t
-- select indexname from pg_indexes where tablename = 'pistes' and indexname like 'pistes_siret%';
--   -> pistes_siret_unique seul
-- select reloptions from pg_class where relname = 'v_courrier';                  -> {security_invoker=true}
