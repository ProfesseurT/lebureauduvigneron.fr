/* ============================================================================
   LOT 31, 23/09/2026 : UN RESUME QUI N'A RIEN CALCULE NE REPOND PAS

   A COLLER DANS SUPABASE. Ce fichier est la reference : c'est lui qu'on modifie,
   et on colle ensuite (regle du 10/09/2026).

   ================= CE QUI S'EST PASSE, ET C'EST MESURE =================

   Ted a importe une base et a ouvert « Mon cap ». L'ecran annoncait -26,1 % et
   72 267 euros dans son bandeau, puis « 0 euro », « null mois connus » et
   « objectif menace, -164 000 euros » dans les trois cartes juste dessous, et
   « objectif jouable, atterrissage 223 302 euros » dans le conseil encore en
   dessous. Trois reponses a une seule question, sur un seul ecran.

   LA CAUSE : `v_ventes.est_vente` vaut NULL tant que `reglages.classement` ne
   porte pas `valide: true`. C'est voulu depuis le lot 23 (« le mode devine n'est
   pas porte »), et c'est la bonne decision. Ce qui ne l'etait pas, c'est ce que
   les trois fonctions de resume rendent DANS CET ETAT : un objet complet dont
   presque tous les champs sont null.

   Releve du 23/09/2026 sur le bureau de Ted, 5 210 lignes, ZERO vente :

     cap_resume      -> { exerciceNum: 2026, ca: null, dernierMois: null,
                          atterrissage: null, ... }        objet a trous
     commerce_resume -> { bridge: {0,0,0,0,0}, decroche: null, ... }  idem
     cuvees_resume   -> { ok: false, ... }                 CELUI-LA disait non

   Cote navigateur, `Number(null)` vaut 0 et un zero ne se distingue pas d'un
   vrai chiffre. Seul `cuvees_resume` s'annoncait vide, et c'est le seul des trois
   ecrans qui etait juste. Ce n'est pas une coincidence, c'est la demonstration.

   LA REGLE : **une fonction qui n'a pas su decider ce qu'est une vente ne rend
   pas un objet, elle ne rend rien.** Une absence, l'appelant sait la lire ; un
   objet a trous, il croit le comprendre.

   OU LE GARDE SE POSE, ET POURQUOI LA : dans `public.resume(b, cle)`, la porte
   unique des trois ecrans depuis le lot 27. Le poser dans les trois fonctions
   demanderait de les reecrire toutes les trois, dont une de trois cents lignes,
   pour dire trois fois la meme chose ; le poser ici le dit une fois, et un
   quatrieme ecran en heritera sans qu'on y pense. Les trois fonctions restent
   appelables directement, ce dont les bancs `controle:commerce` et
   `controle:cuvees` ont besoin.

   AVANT LE CACHE, ET PAS APRES : un resume range avant que le classement change
   est deja perime par le declencheur `resumes_perimer_reg`, mais on ne se repose
   pas dessus pour une reponse qui n'a pas le droit d'exister.

   CE N'EST PAS LE SEUL VERROU. `capPoser()` et `comPoser()` dans
   src/js/bdv-ecrans.js refusent desormais un resume qui ne porte pas son chiffre,
   et l'ecran retombe sur son calcul local. Les deux se doublent expres : celui-ci
   ferme la classe pour tout appelant futur, celui-la tient meme si ce fichier
   n'est pas passe. `npm run banc:cap-serveur` et `npm run banc:commerce-serveur`
   gardent la moitie navigateur, verifies en remettant le defaut.
   ============================================================================ */

create or replace function public.resume(b uuid, cle text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  if not exists (select 1 from public.membres m
                  where m.bureau = b and m.personne = (select auth.uid())) then
    raise exception 'bureau inconnu';
  end if;

  /* LE GARDE DU LOT 31. Voir l'en-tete : sans classement valide, `est_vente` est
     null sur toutes les lignes et les trois fonctions ne peuvent rien calculer.
     On rend null, ce que le navigateur lit comme « le serveur n'a pas repondu »
     et qui le fait retomber sur son propre calcul, qui lui est juste. */
  if not exists (select 1 from public.reglages g
                  where g.bureau = b
                    and coalesce((g.classement->>'valide')::boolean, false)) then
    return null;
  end if;

  select t.charge into r
    from public.resumes t
   where t.bureau = b and t.cle = resume.cle;
  if r is not null then return r; end if;

  r := case resume.cle
         when 'cap'      then public.cap_resume(b)
         when 'commerce' then public.commerce_resume(b)
         when 'cuvees'   then public.cuvees_resume(b)
       end;
  if r is null then return null; end if;

  /* `on conflict` et pas un `insert` sec : deux ecrans ouverts en meme temps calculent
     tous les deux, et le second ne doit pas lever.

     `ON CONSTRAINT resumes_pkey` ET PAS `(bureau, cle)` : nommer la colonne `cle` dans
     la cible du conflit la rend ambigue avec le parametre du meme nom, Postgres leve
     42702, et la fonction meurt APRES avoir calcule. Correction du 18/09/2026 au soir,
     le raisonnement complet est dans lot27-cache-des-resumes.sql. */
  insert into public.resumes (bureau, cle, charge)
       values (b, resume.cle, r)
  on conflict on constraint resumes_pkey
    do update set charge = excluded.charge, calcule_le = now();
  return r;
end; $$;

revoke all on function public.resume(uuid, text) from anon, authenticated, public;
grant execute on function public.resume(uuid, text) to authenticated;

/* POUR CONTROLER, A TOUT MOMENT : aucun bureau ne doit avoir un resume range sans
   classement valide.

     select r.bureau, r.cle from public.resumes r
       join public.reglages g on g.bureau = r.bureau
      where not coalesce((g.classement->>'valide')::boolean, false);

   Zero ligne. */
