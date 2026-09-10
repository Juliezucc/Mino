-- =====================================================================
-- Mino — le code parent appartient à la FAMILLE, pas au compte
--
-- À appliquer APRÈS schema.sql.
--
-- **Le défaut, et c'était une promesse écrite à l'écran.** Sur la tablette d'un
-- enfant, l'écran du code affiche : « Le code se choisit sur le téléphone de
-- ton parent, dans Réglages. Ensuite, il marchera ici. » La dernière phrase
-- était fausse, et pas approximative : définitivement fausse.
--
-- `parent_secrets` était indexée par `user_id`. Or la tablette d'un enfant a
-- son propre compte — celui que crée le code famille — qui n'est le compte
-- d'aucun parent. Pour elle, `has_parent_pin()` rendait donc toujours faux et
-- `verify_parent_pin()` ne trouvait aucune ligne. Aucun code, jamais, quoi que
-- le parent fasse depuis son téléphone.
--
-- **Ce que cela coûtait, et ce n'est pas un confort.** C'est la boucle du
-- produit : l'enfant termine sa mission sur sa tablette, le parent est à côté
-- de lui, et il devait aller chercher son propre téléphone pour confirmer. Le
-- geste qui donne sa valeur au système devenait le geste le plus pénible.
--
-- **Le code devient donc celui de la famille.** C'est d'ailleurs ce qu'il a
-- toujours été dans la tête du parent : on ne choisit pas « son » code, on
-- protège « l'espace parent » de la maison.
--
-- **Ce que cela ouvre, et pourquoi c'est tenable.** Un appareil d'enfant peut
-- désormais soumettre des codes. C'est précisément ce contre quoi le blocage
-- existe : cinq essais ratés ferment la porte cinq minutes, et le compteur est
-- porté par la ligne de la famille — donc il ne se contourne pas en changeant
-- d'appareil. Dix mille combinaisons contre douze essais par heure : un enfant
-- patient y passerait plusieurs semaines, et l'écran de son parent lui dirait
-- au premier soir qu'on essaie d'entrer.
--
-- L'alternative — corriger la phrase et laisser la limitation — revenait à
-- répondre au parent « votre espace n'est pas atteignable depuis cette
-- tablette » pour un enfant qu'il a lui-même inscrit.
-- =====================================================================

/**
 * La nouvelle table, sous un nom neuf.
 *
 * On ne renomme pas la colonne de l'ancienne : `user_id` en est la clé
 * primaire, elle porte une contrainte vers `auth.users`, et une bascule en
 * place laisserait la base dans un état intermédiaire si la reprise échouait à
 * mi-chemin. Deux tables, une copie, un basculement des fonctions : chaque
 * étape est vérifiable, et l'ancienne reste lisible tant qu'on n'y touche pas.
 */
create table if not exists family_secrets (
  family_id     text primary key references families (id) on delete cascade,
  pin_hash      text not null,
  failed_count  int not null default 0,
  locked_until  timestamptz,
  updated_at    timestamptz not null default now()
);

alter table family_secrets enable row level security;
-- Aucune politique déclarée, et c'est le sujet : avec RLS active et zéro
-- politique, tout est refusé. Seules les fonctions `security definer`
-- ci-dessous touchent cette table, et aucune ne rend jamais l'empreinte.

/**
 * Reprendre les codes déjà posés.
 *
 * Chaque ligne existante appartient à un compte de parent ; on la rattache à sa
 * famille. Si deux parents d'une même famille avaient chacun le leur — cas
 * possible, jamais observé — on garde le plus récent : c'est celui que quelqu'un
 * a choisi en dernier, donc celui dont on se souvient.
 *
 * `on conflict do nothing` : rejouer ce fichier ne réécrit pas un code déjà
 * repris, et surtout n'écrase pas un code choisi depuis.
 */
insert into family_secrets (family_id, pin_hash, failed_count, locked_until, updated_at)
select distinct on (p.family_id)
  p.family_id, s.pin_hash, 0, null, s.updated_at
from parent_secrets s
join parents p on p.user_id = s.user_id
order by p.family_id, s.updated_at desc
on conflict (family_id) do nothing;

/**
 * Poser le code — réservé à un parent.
 *
 * `auth_is_parent()` et non `auth_family_ids()` : la tablette de l'enfant doit
 * pouvoir VÉRIFIER le code, jamais le CHOISIR. Sans cette ligne, un enfant
 * s'ouvrirait l'espace parent en quatre chiffres de son invention — c'est le
 * défaut que `parentGate` corrige côté application, et une règle qui n'existe
 * que dans le client n'est pas une règle.
 */
create or replace function set_parent_pin(p_pin text)
returns boolean
language plpgsql
security definer
-- `extensions` pour `crypt()` et `gen_salt()` : sur Supabase, pgcrypto ne vit
-- pas dans `public`, et un `search_path` qui l'ignore ne trouve rien.
set search_path = public, extensions
as $$
declare
  v_family text;
begin
  if auth.uid() is null or p_pin !~ '^[0-9]{4}$' then
    return false;
  end if;

  if not auth_is_parent() then
    return false;
  end if;

  select family_id into v_family from parents where user_id = auth.uid() limit 1;
  if v_family is null then
    return false;
  end if;

  insert into family_secrets (family_id, pin_hash, failed_count, locked_until, updated_at)
  values (v_family, crypt(p_pin, gen_salt('bf', 10)), 0, null, now())
  on conflict (family_id) do update
    set pin_hash = excluded.pin_hash,
        failed_count = 0,
        locked_until = null,
        updated_at = now();

  return true;
end;
$$;

/**
 * Vérifier le code. Cinq essais ratés ferment la porte cinq minutes.
 *
 * Le blocage est porté par la famille, et c'est ce qui le rend utile : compté
 * par appareil, un enfant en ferait le tour en prenant la tablette d'à côté.
 *
 * Ouvert aux appareils d'enfant — c'est tout l'objet de ce fichier — et c'est
 * aussi ce qui rend le blocage nécessaire plutôt que prudent.
 */
create or replace function verify_parent_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_family text;
  v_secret family_secrets%rowtype;
begin
  if auth.uid() is null then
    return false;
  end if;

  select f into v_family from auth_family_ids() f limit 1;
  if v_family is null then
    return false;
  end if;

  select * into v_secret from family_secrets where family_id = v_family;
  if not found then
    return false;
  end if;

  if v_secret.locked_until is not null and v_secret.locked_until > now() then
    return false;
  end if;

  if v_secret.pin_hash = crypt(p_pin, v_secret.pin_hash) then
    update family_secrets
      set failed_count = 0, locked_until = null
      where family_id = v_family;
    return true;
  end if;

  update family_secrets
    set failed_count = failed_count + 1,
        locked_until = case
          when failed_count + 1 >= 5 then now() + interval '5 minutes'
          else null
        end
    where family_id = v_family;

  return false;
end;
$$;

/**
 * Le temps de blocage restant, pour que l'écran dise « dans 4 minutes » au lieu
 * de répéter « code incorrect » à quelqu'un qui tape le bon.
 *
 * Séparé de la vérification à dessein : ce n'est pas un secret, et le replier
 * dans la réponse ci-dessus rendrait un code faux et un compte bloqué
 * distinguables dans le même appel.
 */
create or replace function parent_pin_locked_seconds()
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select greatest(0, extract(epoch from (s.locked_until - now()))::int)
     from family_secrets s
     where s.family_id in (select auth_family_ids()) and s.locked_until is not null
     limit 1),
    0);
$$;

/**
 * Un code existe-t-il ? Aucun secret là-dedans, et c'est la seule chose entre
 * une famille qui n'en a jamais posé et un espace parent que personne ne peut
 * plus ouvrir.
 *
 * Rendu vrai aussi à la tablette de l'enfant, désormais — c'est ce qui fait
 * passer son écran de « demande à un parent » à « code parent », et donc ce qui
 * tient la promesse qui y était déjà écrite.
 */
create or replace function has_parent_pin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from family_secrets where family_id in (select auth_family_ids())
  )
$$;

revoke all on function set_parent_pin(text) from public;
revoke all on function verify_parent_pin(text) from public;
revoke all on function parent_pin_locked_seconds() from public;
revoke all on function has_parent_pin() from public;
grant execute on function set_parent_pin(text) to authenticated;
grant execute on function verify_parent_pin(text) to authenticated;
grant execute on function parent_pin_locked_seconds() to authenticated;
grant execute on function has_parent_pin() to authenticated;

/**
 * `parent_secrets` n'est pas supprimée ici, et c'est délibéré.
 *
 * Plus aucune fonction ne la lit : la laisser ne donne accès à rien — elle
 * porte RLS sans aucune politique, comme la nouvelle. Elle sert de filet le
 * temps de vérifier que les codes ont bien été repris, c'est-à-dire quelques
 * jours d'usage réel. La ligne qui l'efface est écrite juste en dessous, en
 * commentaire, pour que personne n'ait à la réinventer.
 *
 *   drop table if exists parent_secrets;
 */
