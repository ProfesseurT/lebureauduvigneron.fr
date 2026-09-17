/* ============================================================================
   LOT 22, 17/09/2026 : LE SOCLE. DES COLONNES TYPEES SUR LES VENTES.

   A COLLER DANS SUPABASE, editeur SQL. Premier lot du chantier « le calcul
   remonte au serveur », decide par Ted le 17/09/2026 en abandonnant le
   hors-ligne.

   POURQUOI. Mesure du jour, meme regroupement (CA et bouteilles par client,
   171 569 lignes, 1 936 clients en sortie) :

       sur `brut` en JSON        6 949 ms
       sur des colonnes typees     344 ms

   Vingt fois. Le plan d'execution dit pourquoi : lire quarante-trois champs
   JSON sur chaque ligne coute cinq secondes de pur decodage, avant le moindre
   calcul. Aucun index ne repare ca, parce que ce n'est pas la recherche qui
   coute, c'est la lecture.

   DES COLONNES GENEREES, ET PAS UNE VUE MATERIALISEE. Une vue materialisee
   aurait evite la reecriture de la table, mais il aurait fallu la rafraichir
   apres chaque import. Une vue perimee affiche un chiffre d'affaires faux SANS
   RIEN DIRE, et ce depot a deja paye deux fois ce genre de silence (le depot du
   courrier, le compteur de lignes). Une colonne generee ne peut pas etre
   perimee : Postgres la recalcule a l'ecriture de la ligne, point.

   CE QUE CE LOT NE FAIT PAS. Il ne classe rien : `est_vente`, `offert`, le
   canal, la typologie et l'exercice dependent des reglages du vigneron, et
   c'est le lot 23 qui les lira dans `reglages.classement`. Ici on ne fait que
   TYPER ce qui est deja dans `brut`, a position fixe. Aucune ligne existante
   n'est modifiee, aucun ecran ne change, et un `drop column` retire tout.

   CE QUE CA COUTE. La table passe d'environ 166 Mo a environ 245 Mo, et
   l'operation reecrit la table (quelques dizaines de secondes, pendant
   lesquelles elle est verrouillee). C'est temporaire : `brut` deviendra
   redondant une fois l'export du registre servi par ces colonnes, et la table
   redeviendra plus petite qu'aujourd'hui.
   ============================================================================ */

/* -------------------------------------------------------------------------
   1. LES DEUX LECTEURS, PORTES A L'IDENTIQUE DEPUIS LE JAVASCRIPT

   Ils reproduisent `parseNum()` et `parseDateFR()` de `src/js/bdv-base.js`,
   Y COMPRIS LEURS BIZARRERIES, parce que c'est la seule facon que le serveur
   dise le meme chiffre que le navigateur. Un « nettoyage » ici se paierait en
   ecarts au centime que personne ne saurait expliquer dans six mois.
   ------------------------------------------------------------------------- */

/* parseNum : rend 0 et JAMAIS null quand il ne comprend pas. C'est le
   comportement du navigateur, et il est deliberé : une somme ne doit pas
   devenir nulle parce qu'une ligne sur dix mille porte un tiret.

   Les trois regles, dans l'ordre exact du JavaScript :
     1. on retire les espaces, les euros et les pourcents ;
     2. virgule ET point ensemble : le point est le separateur de milliers, on
        l'efface, la virgule devient le point decimal ;
     3. virgule seule : elle devient le point. La PREMIERE seulement, comme
        `replace(',', '.')` sans drapeau global en JavaScript.
   Puis on prend le prefixe numerique, comme `parseFloat`, qui lit « 12abc »
   comme 12 au lieu d'echouer. */
create or replace function public.bdv_nombre(t text)
returns numeric
language plpgsql immutable strict parallel safe
set search_path = ''
as $$
declare s text; m text;
begin
  s := regexp_replace(t, '[[:space:]€%]', '', 'g');
  if s = '' then return 0; end if;
  if position(',' in s) > 0 and position('.' in s) > 0 then
    s := replace(s, '.', '');
    s := regexp_replace(s, ',', '.');
  elsif position(',' in s) > 0 then
    s := regexp_replace(s, ',', '.');
  end if;
  /* UN SEUL GROUPE CAPTURANT, ET IL ENVELOPPE TOUT, LE SIGNE COMPRIS.
     `substring(x from motif)` rend le PREMIER GROUPE PARENTHESE quand le motif
     en contient un, et pas le motif entier. Le premier jet mettait le signe
     hors du groupe : `-0,02` etait lu `0.02`.

     Ce n'etait pas un detail. La base de Ted porte 1 144 lignes negatives, ses
     avoirs, pour -357 673,63 €. Le chiffre d'affaires sortait a 8 677 677,25 €
     au lieu de 7 962 329,99 € : 715 347 € de trop, soit deux fois les avoirs,
     et un total parfaitement credible. Trouve en comparant la fonction au
     JavaScript, pas en la relisant. */
  m := substring(s from '^([+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)');
  if m is null or m = '' or m = '+' or m = '-' then return 0; end if;
  return m::numeric;
exception when others then return 0;
end;
$$;

/* parseDateFR : « J/M/AAAA » ou « JJ/MM/AAAA », en PREFIXE (le JavaScript
   n'ancre pas la fin, une date suivie d'une heure passe donc). Bornes reprises
   telles quelles : annee entre 1990 et 2100, mois entre 1 et 12.

   LE JOUR N'EST PAS VERIFIE COTE NAVIGATEUR, et c'est le seul endroit ou le
   serveur ne peut pas suivre : `31/02/2026` produit un objet en JavaScript,
   et aucune date en SQL. Mesure du 17/09/2026 sur les 171 569 lignes : zero
   date de cette forme, zero annee hors bornes. On rend donc `null` sur un jour
   impossible, on ne devine pas, et la ligne sortira des totaux au lieu d'y
   entrer sous une fausse date. */
create or replace function public.bdv_jour(t text)
returns date
language plpgsql immutable strict parallel safe
set search_path = ''
as $$
declare m text[]; j int; mo int; a int;
begin
  m := regexp_match(btrim(t), '^([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})');
  if m is null then return null; end if;
  j := m[1]::int; mo := m[2]::int; a := m[3]::int;
  if a < 1990 or a > 2100 or mo < 1 or mo > 12 then return null; end if;
  return make_date(a, mo, j);
exception when others then return null;
end;
$$;

/* La cuvee, portee depuis `cuveeBase()` de bdv-ecrans.js : le produit ampute
   d'un millesime final. Le repli sur le produit entier compte : une cuvee qui
   ne serait QUE « 2024 » deviendrait une chaine vide, et toutes ces lignes se
   regrouperaient sous un meme nom vide. */
create or replace function public.bdv_cuvee(t text)
returns text
language sql immutable strict parallel safe
set search_path = ''
as $$
  select coalesce(nullif(btrim(regexp_replace(t, '[[:space:]]*(19|20)[0-9]{2}[[:space:]]*$', '')), ''), btrim(t));
$$;

/* -------------------------------------------------------------------------
   2. LES COLONNES

   Les positions sont celles de `COLS` dans bdv-base.js, et elles sont LUES PAR
   POSITION, comme l'import. `verifierEntete()` refuse deja un export dont les
   colonnes auraient bouge : c'est ce controle, et lui seul, qui rend ces
   index de position defendables.

   `client_cle` reproduit `clientKey()` : le NUMERO d'abord, le nom en repli,
   et `(inconnu)` en dernier. L'ordre n'est pas negociable, c'est la cle sous
   laquelle les fiches de suivi sont rangees depuis le 04/09/2026 : l'inverser
   rendrait orphelines toutes les notes du vigneron. Le `nullif` reproduit le
   `||` du JavaScript, pour lequel une chaine vide est fausse.
   ------------------------------------------------------------------------- */
alter table public.ventes
  add column if not exists le_jour         date generated always as (public.bdv_jour(brut->>0)) stored,
  add column if not exists num_facture     text generated always as (brut->>1) stored,
  add column if not exists produit         text generated always as (brut->>2) stored,
  add column if not exists cuvee           text generated always as (public.bdv_cuvee(brut->>2)) stored,
  add column if not exists famille         text generated always as (brut->>4) stored,
  add column if not exists conditionnement text generated always as (brut->>5) stored,
  add column if not exists appellation     text generated always as (brut->>11) stored,
  add column if not exists couleur         text generated always as (brut->>12) stored,
  add column if not exists millesime       text generated always as (brut->>13) stored,
  add column if not exists pu_ht           numeric generated always as (public.bdv_nombre(brut->>14)) stored,
  add column if not exists total_ht        numeric generated always as (public.bdv_nombre(brut->>15)) stored,
  add column if not exists client_nom      text generated always as (brut->>16) stored,
  add column if not exists client_cle      text generated always as (
      coalesce(nullif(brut->>17, ''), nullif(brut->>16, ''), '(inconnu)')) stored,
  add column if not exists commercial      text generated always as (brut->>18) stored,
  add column if not exists qte             numeric generated always as (public.bdv_nombre(brut->>19)) stored,
  add column if not exists code_tarif      text generated always as (brut->>20) stored,
  add column if not exists pays            text generated always as (brut->>30) stored,
  add column if not exists origine         text generated always as (brut->>31) stored,
  add column if not exists ville           text generated always as (brut->>32) stored,
  add column if not exists cp              text generated always as (brut->>33) stored,
  add column if not exists vendeur         text generated always as (brut->>34) stored,
  add column if not exists tri_perso1      text generated always as (brut->>35) stored,
  add column if not exists type_offert     text generated always as (brut->>36) stored,
  add column if not exists lieu_vente      text generated always as (brut->>39) stored;

/* -------------------------------------------------------------------------
   3. LES INDEX

   `(bureau, le_jour)` sert toutes les fenetres de periode, `(bureau,
   client_cle)` sert le regroupement par client, qui est le plus frequent.
   Rien de plus pour l'instant : un index qu'aucune requete n'utilise coute a
   chaque import et ne rend rien.
   ------------------------------------------------------------------------- */
create index if not exists ventes_bureau_jour   on public.ventes (bureau, le_jour);
create index if not exists ventes_bureau_client on public.ventes (bureau, client_cle);

analyze public.ventes;

/* -------------------------------------------------------------------------
   4. POUR CONTROLER, APRES COUP

   Le total doit etre EXACTEMENT celui que le bureau affiche, aux centimes.
   S'il ne l'est pas, ne pas corriger le SQL au jugé : c'est `bdv_nombre` qui
   ne reproduit pas `parseNum`, et il faut savoir sur quelle ligne.

     select count(*), sum(total_ht), sum(qte),
            min(le_jour), max(le_jour), count(*) filter (where le_jour is null)
       from public.ventes;

   Valeurs attendues sur le bureau de Ted au 17/09/2026, verifiees par DEUX
   chemins de calcul independants qui donnent un ecart de 0,00 :

     171 569 lignes, 7 962 329,99 € de total, 263 275,986 bouteilles,
     du 01/02/2021 au 31/12/2025, zero date perdue,
     dont 1 144 lignes negatives pour -357 673,63 € d'avoirs.
   ------------------------------------------------------------------------- */
