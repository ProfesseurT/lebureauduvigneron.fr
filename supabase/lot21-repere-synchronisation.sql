/* ============================================================================
   LOT 21, 17/09/2026 : LE SERVEUR DATE LES LIGNES DE VENTE

   A COLLER DANS SUPABASE, editeur SQL. Ce fichier ne s'applique pas tout seul :
   tant qu'il n'est pas passe, le tirage rapide de `bdv-sync.js` ne se declenche
   jamais, et le bureau retelecharge la base entiere a chaque ouverture.

   POURQUOI. Mesure du 17/09/2026 sur la base de facturation de Ted, 171 569
   lignes. Journaux Supabase, POUR UNE SEULE OUVERTURE du bureau : 174 requetes
   GET sur `/ventes`, 299 ms en moyenne, plus autant de preflights CORS. Une
   minute d'attente pour des lignes que l'appareil possedait deja.

   `bdv-sync.js` ne redemande desormais que ce qui a change depuis sa derniere
   visite, et il se repere sur `maj_le`. Cette colonne etait remplie par le
   NAVIGATEUR (`new Date().toISOString()` dans le corps de l'upsert). Une machine
   dont l'horloge avance de dix minutes aurait donc pose un repere dans le futur,
   et toutes les lignes normales ecrites derriere seraient restees invisibles a
   cet appareil, pour toujours, sans un mot. Une date de synchronisation ne peut
   pas venir d'une horloge qu'on ne controle pas.

   LE DECLENCHEUR PLUTOT QU'UN SIMPLE DEFAUT DE COLONNE, et c'est la raison
   principale : un navigateur qui tourne encore sur une version en cache continue
   d'envoyer `maj_le`. Un `default` ne s'applique pas quand la colonne est
   fournie ; le declencheur, lui, ecrase dans tous les cas.

   ET LA DATE NE BOUGE QUE SI `brut` A VRAIMENT CHANGE. Sans cette condition,
   reimporter deux fois le meme export redaterait les 171 569 lignes d'un coup,
   et l'ouverture suivante les ferait toutes redescendre : exactement la minute
   qu'on vient de supprimer, ramenee par la porte de derriere.
   ============================================================================ */

-- 1. Le defaut, pour toute insertion qui ne nomme pas la colonne.
alter table public.ventes alter column maj_le set default now();

-- 2. Le declencheur, qui fait foi meme quand le navigateur envoie une date.
create or replace function public.ventes_maj_le_serveur()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.brut is not distinct from old.brut then
    new.maj_le := old.maj_le;   -- rien n'a change : la date ne bouge pas
  else
    new.maj_le := now();        -- et c'est l'heure du SERVEUR, jamais celle du poste
  end if;
  return new;
end;
$$;

drop trigger if exists ventes_maj_le_serveur on public.ventes;
create trigger ventes_maj_le_serveur
  before insert or update on public.ventes
  for each row execute function public.ventes_maj_le_serveur();

/* ----------------------------------------------------------------------------
   POUR CONTROLER, APRES COUP

   select tgname from pg_trigger where tgrelid = 'public.ventes'::regclass;
   -> ventes_maj_le_serveur doit y figurer.
   ---------------------------------------------------------------------------- */
