-- ============================================================================
-- LOT 70, 06/10/2026 : LA SIGNATURE ELLE-MEME. A COLLER DANS SUPABASE, APRES LE LOT 69.
-- ============================================================================
-- Demande de Ted : sur /signer/, le client signe pour de vrai. Deux facons, au choix :
--   - « dessin »    : il dessine sa signature au doigt ou a la souris (le pad) ;
--   - « manuscrit » : son nom et prenom, ecrits dans une police manuscrite.
-- Dans les deux cas la page envoie une IMAGE PNG, rangee dans la preuve
-- (`devis_signatures`, figee depuis le lot 55). L'une des deux est OBLIGATOIRE :
-- sans elle, `signature_poser` refuse (`refus: trace`) et rien n'est ecrit.
--
-- ORDRE DE MISE EN PRODUCTION, A LA SUITE : ce SQL, puis le push, puis le
-- redeploiement de la fonction Edge `signature`. Entre ce SQL et le redeploiement,
-- une signature est refusee (l'ancienne fonction n'envoie pas d'image).
-- Les signatures deja posees n'ont pas d'image : `trace` reste vide, et c'est vrai.
-- REJOUABLE.
-- ============================================================================

alter table public.devis_signatures add column if not exists trace text;
alter table public.devis_signatures add column if not exists trace_mode text;

-- Les premiers octets d'un PNG (89 50 4E 47 0D 0A 1A 0A) s'ecrivent « iVBORw0KGgo » en
-- base64 : rien d'autre qu'un PNG ne passe, ni SVG, ni HTML. 150 000 signes au plus.
create or replace function public.signature_trace_valide(p_trace text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_trace is not null
     and char_length(p_trace) between 200 and 150000
     and p_trace ~ '^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/]+={0,2}$'
$$;
revoke all on function public.signature_trace_valide(text) from public, anon, authenticated;

alter table public.devis_signatures drop constraint if exists devis_signatures_trace;
-- coalesce : un mode NUL ferait une condition NULLE, et une contrainte NULLE laisse passer.
alter table public.devis_signatures add constraint devis_signatures_trace check (coalesce(
  (trace is null and trace_mode is null)
  or (trace_mode in ('dessin', 'manuscrit') and public.signature_trace_valide(trace)), false));

-- SIGNER : le corps du lot 55, plus l'image obligatoire. Neuf arguments ; l'appel NOMME
-- a sept arguments (ancienne fonction Edge) passe encore, et se fait refuser « trace ».
drop function if exists public.signature_poser(text, text, text, boolean, text, text, text);
drop function if exists public.signature_poser(text, text, text, boolean, text, text, text, text, text);
create function public.signature_poser(p_jeton text, p_nom text, p_qualite text,
  p_accord boolean, p_empreinte text, p_ip text default null, p_agent text default null,
  p_trace text default null, p_trace_mode text default null)
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
  -- LOT 70 : la signature elle-meme, dessinee au pad ou nom ecrit en manuscrit. Obligatoire.
  if p_trace_mode is null or p_trace_mode not in ('dessin', 'manuscrit')
     or not public.signature_trace_valide(p_trace) then
    return jsonb_build_object('etat', 'a_signer', 'refus', 'trace');
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
        au_nom_de, papier_empreinte, total_ht_c, total_ttc_c, ip, agent, trace, trace_mode)
      values (l.lien_id, l.bureau, d.devis_id, d.numero, maintenant, nom, qual, true,
        left(nullif(btrim(coalesce(d.acheteur->>'nom', '')), ''), 200), d.papier_empreinte,
        d.total_ht_c, d.total_ttc_c, left(nullif(btrim(coalesce(p_ip, '')), ''), 64),
        left(nullif(btrim(coalesce(p_agent, '')), ''), 400), p_trace, p_trace_mode);
    perform public.devis_accepter_coeur(l.bureau, d.devis_id, null, null, maintenant);
  exception when check_violation then
    return jsonb_build_object('etat', 'clos', 'bloque', sqlerrm);
  end;
  return public.signature_lire(p_jeton);
end
$$;
revoke all on function public.signature_poser(text, text, text, boolean, text, text, text, text, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.signature_poser(text, text, text, boolean, text, text, text, text, text) to service_role;
  end if;
end $$;

-- CE QUE VOIT LE CLIENT : le corps du lot 65, plus l'image de la signature.
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
  if etat in ('clos', 'expire') then
    return jsonb_build_object('etat', etat, 'numero', d.numero,
      'vendeur', coalesce(dom->>'raison_sociale', dom->>'nom', ''), 'vendeur_email', dom->>'email',
      'valable_jusqu', d.valable_jusqu);
  end if;
  select c.papier into pap from public.devis_copies c
   where c.bureau = l.bureau and c.devis_id = d.devis_id
     and c.empreinte = coalesce(s.papier_empreinte, d.papier_empreinte)
   order by c.version desc limit 1;
  return jsonb_build_object(
    'etat', etat,
    'numero', d.numero,
    'version', d.version,
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
    'signe_qualite', s.qualite,
    'signe_trace', s.trace,
    'signe_trace_mode', s.trace_mode);
end
$$;
revoke all on function public.signature_lire(text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.signature_lire(text) to service_role;
  end if;
end $$;

-- CONTROLES, a lancer apres (ils ne modifient rien)
-- 1) select pronargs from pg_proc where proname = 'signature_poser';                       -> 9
-- 2) select count(*) from information_schema.columns
--     where table_name = 'devis_signatures' and column_name in ('trace','trace_mode');    -> 2
-- 3) select has_function_privilege('anon',
--     'public.signature_poser(text,text,text,boolean,text,text,text,text,text)', 'execute'); -> false
