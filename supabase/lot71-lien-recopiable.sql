-- ============================================================================
-- LOT 71, 06/10/2026 : LE LIEN DE SIGNATURE SE RECOPIE. A COLLER DANS SUPABASE, APRES LE LOT 70.
-- ============================================================================
-- Demande de Ted : le lien de signature d'un devis envoye doit rester a disposition, a copier
-- depuis la carte du devis dans l'affaire. Jusqu'ici la base ne gardait que l'EMPREINTE du
-- jeton, et le lien ne s'affichait qu'une fois. Arbitrage de Ted : le jeton est garde EN BASE,
-- lisible par les membres du bureau seulement (ils pouvaient deja creer un lien).
--   - `devis_liens.jeton` : le jeton en clair, pour les liens crees a partir de ce lot.
--     Les liens deja crees ne l'ont pas : pour eux, il faut creer un nouveau lien.
--   - un lien remplace (nouveau lien) oublie son jeton ; la base compare toujours l'EMPREINTE
--     pour ouvrir /signer/, rien ne change de ce cote.
--   - `anon` ne lit rien de cette table, comme avant.
-- REJOUABLE.
-- ============================================================================

alter table public.devis_liens add column if not exists jeton text;
alter table public.devis_liens drop constraint if exists devis_liens_jeton;
alter table public.devis_liens add constraint devis_liens_jeton check (
  jeton is null or (jeton ~ '^[0-9a-f]{64}$' and jeton_hash = encode(sha256(convert_to(jeton, 'UTF8')), 'hex')));
grant select (jeton) on public.devis_liens to authenticated;

-- CREER UN LIEN : le corps du lot 55, plus le jeton garde.
create or replace function public.devis_lien_creer(p_bureau uuid, p_devis uuid)
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

  -- LOT 71 : un lien remplace oublie son jeton (il ne signe plus, il n'a plus a se copier).
  update public.devis_liens x set remplace_le = now(), jeton = null
   where x.bureau = p_bureau and x.devis_id = d.devis_id and x.remplace_le is null;
  jeton := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.devis_liens (bureau, devis_id, jeton_hash, jeton, cree_par)
    values (p_bureau, d.devis_id, encode(sha256(convert_to(jeton, 'UTF8')), 'hex'), jeton, auth.uid());
  return jeton;
end
$$;
revoke all on function public.devis_lien_creer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.devis_lien_creer(uuid, uuid) to authenticated;

-- CONTROLES, a lancer apres (ils ne modifient rien)
-- 1) select has_column_privilege('authenticated', 'public.devis_liens', 'jeton', 'select'); -> true
-- 2) select has_column_privilege('anon', 'public.devis_liens', 'jeton', 'select');          -> false
