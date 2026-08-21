-- =====================================================================
-- Mino — le compagnon qui parle
--
-- À appliquer APRÈS schema.sql, scale.sql, support.sql, analytics.sql et
-- store.sql.
--
-- Trois choses vivent ici, et une seule d'entre elles est un confort :
--
--   1. le compteur d'échanges du jour — qui tient à la fois la promesse du
--      produit et le plafond de dépense ;
--   2. l'interrupteur par enfant, côté parent ;
--   3. les conversations, gardées peu de temps et lisibles par les parents.
--
-- Ce qui n'existe pas ici, et c'est délibéré : aucun moyen pour un humain
-- extérieur d'écrire à un enfant. Mino est un personnage, jamais un salon.
-- =====================================================================

-- ------------------------------------------------------ l'autorisation

/**
 * L'interrupteur, par enfant.
 *
 * Par défaut allumé, mais un parent doit pouvoir l'éteindre en une touche,
 * sans explication à donner. Certaines familles ne voudront pas que leur
 * enfant parle à un personnage, et c'est une position parfaitement tenable.
 */
alter table children add column if not exists companion_enabled boolean not null default true;

-- --------------------------------------------------- le budget quotidien

/**
 * Ce qui a été consommé aujourd'hui.
 *
 * Compté ici, et nulle part ailleurs. L'appareil de l'enfant affiche un
 * compteur, il ne le décide pas : une application réinstallée, une date
 * changée dans les réglages ou un stockage effacé ne doivent pas rendre la
 * journée illimitée.
 *
 * La clé primaire porte le jour : la remise à zéro n'est donc pas une tâche
 * planifiée qui peut ne pas tourner, c'est une conséquence du changement de
 * date.
 */
create table if not exists companion_usage (
  child_id  text not null references children (id) on delete cascade,
  day       date not null default current_date,
  exchanges integer not null default 0,
  primary key (child_id, day)
);

create index if not exists idx_companion_usage_day on companion_usage (day);

alter table companion_usage enable row level security;

/**
 * Réservé aux parents.
 *
 * L'application de l'enfant n'en a pas besoin : elle demande ce qui lui reste
 * par `companion_left()`, une fonction SECURITY DEFINER qui ne renvoie qu'un
 * nombre. Ouvrir la table à toute la famille laisserait un appareil enfant lire
 * la consommation de son frère — sans utilité, et donc sans raison.
 */
drop policy if exists companion_usage_read on companion_usage;
create policy companion_usage_read on companion_usage
  for select using (
    auth_is_parent()
    and child_id = any (coalesce((select auth_child_ids_array()), '{}'::text[]))
  );

-- ------------------------------------------------------ les conversations

/**
 * Ce qui a été dit.
 *
 * Conservé pour deux raisons, et deux seulement : qu'un parent puisse lire ce
 * que son enfant raconte à Mino, et qu'un signalement de sécurité puisse être
 * compris après coup. Ce n'est pas une mémoire — Mino ne se souvient pas d'un
 * jour à l'autre, et c'est aussi ce qui garde les conversations courtes.
 *
 * Trente jours, puis effacement. Le cahier des charges dit « ne collecter
 * aucune donnée enfant inutile » : un message d'enfant de six ans conservé
 * deux ans n'a aucune utilité et beaucoup d'inconvénients.
 */
create table if not exists companion_messages (
  id         bigserial primary key,
  child_id   text not null references children (id) on delete cascade,
  family_id  text not null references families (id) on delete cascade,
  role       text not null check (role in ('child', 'mino')),
  text       text not null,
  -- 'none' | 'tender' | 'alert' — voir domain/companion.ts
  safety     text not null default 'none',
  created_at timestamptz not null default now()
);

create index if not exists idx_companion_messages_child
  on companion_messages (child_id, created_at desc);
create index if not exists idx_companion_messages_alert
  on companion_messages (family_id, created_at desc) where safety = 'alert';

alter table companion_messages enable row level security;

/**
 * Les parents lisent. Personne d'autre, et surtout pas les autres enfants.
 *
 * Tous les appareils enfants d'une famille partagent une même identité
 * anonyme : une politique ouverte à la famille laisserait donc l'appareil d'un
 * enfant lire les conversations de son frère. L'application ne l'affiche nulle
 * part — l'écran de discussion ne garde aucun historique — mais un client
 * modifié, lui, le pourrait, et une confidence entre un enfant et son
 * personnage n'a rien à faire sur la tablette de sa sœur.
 *
 * L'enfant, lui, est prévenu que ses parents peuvent lire : c'est écrit sous
 * sa conversation. Laisser croire à un enfant qu'un espace est privé alors
 * qu'il ne l'est pas est un mensonge qu'il découvrira un jour ; le lui dire et
 * n'ouvrir qu'aux parents est la seule position tenable.
 */
drop policy if exists companion_messages_read on companion_messages;
create policy companion_messages_read on companion_messages
  for select using (auth_is_parent() and family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[])));

-- Aucune politique d'écriture : seule la fonction serveur écrit ici.

/**
 * Purge des conversations de plus de trente jours.
 *
 * À planifier avec pg_cron, comme les autres purges de scale.sql. Une
 * politique de conservation qui n'est écrite que dans un document n'est pas
 * une politique de conservation.
 */
create or replace function purge_companion_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare removed integer;
begin
  delete from companion_messages where created_at < now() - interval '30 days';
  get diagnostics removed = row_count;

  delete from companion_usage where day < current_date - 90;
  return removed;
end;
$$;

-- Révoqué à `public` ET à `anon`/`authenticated`, et il faut les trois.
--
-- Supabase pose `alter default privileges in schema public grant all on
-- functions to anon, authenticated, service_role` : toute fonction créée
-- ensuite porte donc un droit d'exécution EXPLICITE pour ces rôles, qu'un
-- `revoke ... from public` ne retire pas — il ne défait que le droit implicite
-- de PostgreSQL. Écrire `from public` seul laisse la fonction ouverte à
-- n'importe quel appareil connecté, en croyant l'avoir fermée.
--
-- Trouvé par `supabase/test/companion.sql`, dont le préambule reproduit
-- exactement ces privilèges par défaut.
revoke all on function purge_companion_messages() from public, anon, authenticated;

-- ------------------------------------------------- ce que l'application lit

/** Combien d'échanges il reste à cet enfant aujourd'hui. */
create or replace function companion_left(p_child_id text, p_budget integer default 20)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    p_budget - coalesce(
      (select u.exchanges from companion_usage u
       where u.child_id = p_child_id and u.day = current_date), 0)
  )
  where exists (
    select 1 from children c
    where c.id = p_child_id
      and c.family_id in (select auth_family_ids())
      and c.companion_enabled
  );
$$;

revoke all on function companion_left(text, integer) from public;
grant execute on function companion_left(text, integer) to authenticated;

/**
 * Consomme un échange, et dit s'il était disponible.
 *
 * Atomique volontairement : deux messages envoyés en même temps depuis deux
 * onglets ne doivent pas consommer un seul crédit. `on conflict` fait
 * l'incrément dans la même instruction, et la clause finale renvoie faux quand
 * le budget était déjà épuisé.
 */
create or replace function companion_consume(p_child_id text, p_budget integer default 20)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare used integer;
begin
  insert into companion_usage (child_id, day, exchanges)
  values (p_child_id, current_date, 1)
  on conflict (child_id, day)
    do update set exchanges = companion_usage.exchanges + 1
  returning exchanges into used;

  return used <= p_budget;
end;
$$;

revoke all on function companion_consume(text, integer) from public, anon, authenticated;
-- Appelée uniquement par la fonction serveur, avec la clé de service.

/**
 * Rend un échange consommé pour rien.
 *
 * Le crédit est pris **avant** l'appel au modèle, pour qu'aucune requête ne
 * parte sans être décomptée. Quand le modèle ne répond pas, il faut donc le
 * rendre : sinon une panne de notre côté mange la journée d'un enfant qui n'a
 * rien obtenu en échange.
 */
create or replace function companion_refund(p_child_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update companion_usage
     set exchanges = greatest(0, exchanges - 1)
   where child_id = p_child_id and day = current_date;
$$;

revoke all on function companion_refund(text) from public, anon, authenticated;

-- ---------------------------------------------------------- pilotage

/**
 * Ce que le compagnon coûte et ce qu'il fait, par mois.
 *
 * `alertes` est la colonne à regarder en premier, et pas pour des raisons
 * financières : c'est le nombre de fois où un enfant a confié quelque chose de
 * grave à un personnage. Si ce nombre monte, ce n'est pas un problème de
 * produit.
 */
create or replace view metrics_compagnon as
select
  date_trunc('month', created_at)::date as mois,
  count(*) filter (where role = 'child')            as messages_enfants,
  count(distinct child_id)                          as enfants_actifs,
  count(*) filter (where safety = 'tender')         as moments_difficiles,
  count(*) filter (where safety = 'alert')          as alertes,
  round(count(*) filter (where role = 'child')::numeric
        / nullif(count(distinct child_id), 0), 1)   as messages_par_enfant
from companion_messages
group by 1
order by 1 desc;

revoke all on metrics_compagnon from anon, authenticated;
