-- =====================================================================
-- Mino — tout le schéma, en un seul fichier
--
-- NE PAS MODIFIER : produit par `npm run db:bundle` à partir des fichiers
-- listés dans `supabase/order.mjs`. Toute correction se fait dans le fichier
-- d'origine, puis on regénère.
--
-- À coller dans l'éditeur SQL de Supabase, en une fois. L'éditeur exécute
-- l'ensemble dans une seule transaction : soit tout passe, soit rien ne passe,
-- et il n'y a donc aucun état intermédiaire à rattraper.
--
-- Rejouable : appliquer ce fichier deux fois de suite ne casse rien. C'est
-- vérifié à chaque `npm run test:sql`.
--
-- Contenu, dans l'ordre :
--   schema.sql     tables, RLS, fonctions
--   scale.sql      index, temps réel, purges
--   support.sql    signalements
--   analytics.sql  journal de facturation et vues
--   store.sql      achats App Store et Play Store
--   companion.sql  budget et conversations de Mino
--   retention.sql  ce qu’on garde, et combien de temps
-- =====================================================================

-- ---------------------------------------------------------------------
-- schema.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Mino — PostgreSQL schema and Row Level Security
--
-- Security model, in one sentence: a signed-in parent can read and write
-- ONLY the rows belonging to the family they are a member of. There is no
-- policy anywhere that lets one family see another family's children.
--
-- Children never authenticate. They use a device already signed in as the
-- parent (family code + profile selection), so no child row is ever exposed
-- to an anonymous session.
--
-- Apply with:  supabase db push   (or paste into the SQL editor)
-- =====================================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ types

do $$ begin
  create type completion_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_kind as enum (
    'mission_reward',
    'screen_time_used',
    'parent_adjustment',
    'initial_balance'
  );
exception when duplicate_object then null; end $$;

-- A gift, kept apart from a correction so the history stays readable.
do $$ begin
  alter type transaction_kind add value if not exists 'bonus';
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_status as enum ('requested', 'running', 'finished', 'stopped', 'refused');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------- tables

create table if not exists families (
  id            text primary key,
  name          text not null,
  code          text not null unique,
  -- Shared with other families, unlike `code`, which lets a device join.
  referral_code text not null unique,
  created_at    timestamptz not null default now()
);

-- One row per parent account. `user_id` links to Supabase Auth; it is the
-- only bridge between an authenticated session and a family.
create table if not exists parents (
  id           text primary key,
  family_id    text not null references families (id) on delete cascade,
  user_id      uuid unique default auth.uid() references auth.users (id) on delete cascade,
  -- No `pin` column, on purpose. This row is readable by every device in the
  -- family, the child's tablet included — it has to be. A four-digit code that
  -- unlocks the parent area cannot live somewhere a child can read. See
  -- `parent_secrets` at the end of this file.
  display_name text not null,
  email        text not null,
  -- Quand ce parent a déclaré être titulaire de l'autorité parentale.
  -- L'instant, et pas le simple fait : c'est la date qui vaut preuve le jour
  -- où on la demande. Nulle sur les comptes créés avant que l'écran ne pose la
  -- question — un fait historique, pas une permission de s'en passer.
  consent_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- Existing installations: the column has to go, not just stop being written.
alter table parents drop column if exists pin;
alter table parents add column if not exists consent_at timestamptz;

create table if not exists children (
  id               text primary key,
  family_id        text not null references families (id) on delete cascade,
  first_name       text not null,
  age              int  not null check (age between 0 and 21),
  avatar_key       text not null,
  pin              text,
  -- Ask a parent before every session, even on the device Mino runs on.
  require_approval boolean not null default false,
  created_at       timestamptz not null default now()
);

-- The family's other screens: a console, a television, the family computer.
-- None of them can be driven by Mino, so every session on one waits for a
-- parent. Archived rather than deleted, so past sessions still name them.
create table if not exists devices (
  id         text primary key,
  family_id  text not null references families (id) on delete cascade,
  label      text not null,
  kind       text not null check (kind in ('console','tv','computer','tablet','other')),
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists missions (
  id         text primary key,
  family_id  text not null references families (id) on delete cascade,
  title      text not null check (length(btrim(title)) > 0),
  icon       text not null,
  minutes    int  not null check (minutes > 0),
  repeat     jsonb not null default '{"kind":"daily"}'::jsonb,
  -- Set by a parent, read by the RLS policies below: it is what lets a child's
  -- device write an approved completion for this mission and nothing else.
  -- A device can never write this column — see missions_* policies.
  auto_approve boolean not null default false,
  created_by text not null,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Existing installs.
alter table missions add column if not exists auto_approve boolean not null default false;

create table if not exists mission_assignments (
  id         text primary key,
  mission_id text not null references missions (id) on delete cascade,
  child_id   text not null references children (id) on delete cascade,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (mission_id, child_id)
);

create table if not exists mission_completions (
  id                text primary key,
  family_id         text not null references families (id) on delete cascade,
  assignment_id     text not null references mission_assignments (id) on delete cascade,
  mission_id        text not null references missions (id) on delete cascade,
  child_id          text not null references children (id) on delete cascade,
  status            completion_status not null default 'pending',
  minutes_requested int not null check (minutes_requested >= 0),
  minutes_awarded   int not null default 0 check (minutes_awarded >= 0),
  completed_at      timestamptz not null default now(),
  reviewed_at       timestamptz,
  reviewed_by       text,
  celebrated_at     timestamptz
);

/**
 * Une mission qui se compte d'elle-même ne se compte qu'une fois par jour.
 *
 * Sans cela, un client modifié rejouerait la même déclaration en boucle : la
 * règle est tenue côté application, mais une règle qui n'existe que dans le
 * client n'est pas une règle. L'index la grave dans la base.
 *
 * Réserve assumée : la journée est comptée en UTC. Une mission déclarée deux
 * fois dans l'heure qui suit minuit heure de Paris passerait donc deux fois.
 * C'est une fenêtre d'une heure, la nuit, sur une fonctionnalité qu'un parent
 * a explicitement ouverte — le remède (stocker le fuseau de la famille et
 * l'appliquer ici) coûte plus cher que le mal.
 */
create unique index if not exists uniq_completion_approved_per_day
  on mission_completions (mission_id, child_id, ((completed_at at time zone 'UTC')::date))
  where status = 'approved';

/**
 * Et une seule demande en attente à la fois, pour la même mission.
 *
 * Un appareil a le droit d'écrire des lignes « en attente » : sans cette
 * contrainte, il peut en écrire mille, et c'est l'écran du parent qu'il noie.
 * Aucune minute n'est en jeu, mais une file d'attente inutilisable revient à
 * supprimer la confirmation.
 *
 * Une mission refusée n'est plus « pending » : l'enfant peut donc la refaire
 * et la redéclarer le jour même, ce qui est exactement l'intention de
 * « À refaire ».
 */
create unique index if not exists uniq_completion_pending_per_day
  on mission_completions (mission_id, child_id, ((completed_at at time zone 'UTC')::date))
  where status = 'pending';

-- Append-only ledger. The balance of a child is the SUM of `delta` here and
-- is never stored as a mutable counter.
create table if not exists screen_time_transactions (
  id         text primary key,
  family_id  text not null references families (id) on delete cascade,
  child_id   text not null references children (id) on delete cascade,
  delta      int  not null,
  kind       transaction_kind not null,
  reason     text not null,
  ref_id     text,
  created_at timestamptz not null default now()
);

/**
 * Une complétion ne paie qu'une fois.
 *
 * C'est la contrainte qui manquait, et sans elle tout le reste ne tenait pas :
 * les politiques vérifient qu'une ligne de récompense pointe bien vers une
 * complétion approuvée du bon montant, mais rien n'empêchait d'écrire cent
 * fois la même. Cent lignes valides, cent fois les minutes — le solde étant
 * la somme du registre.
 *
 * Vaut pour tout le monde, parent compris : deux récompenses pour une seule
 * mission accomplie est une erreur, quelle que soit la main qui l'écrit.
 */
create unique index if not exists uniq_reward_per_completion
  on screen_time_transactions (ref_id)
  where kind = 'mission_reward' and ref_id is not null;

create table if not exists screen_time_sessions (
  id                text primary key,
  family_id         text not null references families (id) on delete cascade,
  child_id          text not null references children (id) on delete cascade,
  requested_minutes int not null check (requested_minutes > 0),
  -- Null means the device Mino runs on, the only screen it drives by itself.
  device_id         text references devices (id) on delete set null,
  started_at        timestamptz not null default now(),
  ends_at           timestamptz not null,
  status            session_status not null default 'running',
  requested_at      timestamptz,
  ended_at          timestamptz,
  consumed_minutes  int
);

-- ---------------------------------------------------------------- indexes

create index if not exists idx_children_family        on children (family_id);
create index if not exists idx_devices_family         on devices (family_id);
create index if not exists idx_missions_family        on missions (family_id) where archived = false;
create index if not exists idx_assignments_child      on mission_assignments (child_id) where active = true;
create index if not exists idx_completions_family     on mission_completions (family_id, status);
create index if not exists idx_completions_child      on mission_completions (child_id, completed_at desc);
create index if not exists idx_transactions_child     on screen_time_transactions (child_id, created_at desc);
create index if not exists idx_sessions_child_running on screen_time_sessions (child_id) where status = 'running';

-- ------------------------------------------------------- balance (derived)

-- Convenience view. It is a projection of the ledger, never a source of truth.
create or replace view child_balances as
select
  c.id   as child_id,
  c.family_id,
  coalesce(sum(t.delta), 0)::int as minutes
from children c
left join screen_time_transactions t on t.child_id = c.id
group by c.id, c.family_id;

-- -------------------------------------------------------------------- RLS

-- Families the signed-in user belongs to. SECURITY DEFINER so the policies
-- below can read `parents` without recursing into its own policy.
create or replace function auth_family_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select family_id from parents where user_id = auth.uid();
$$;

/**
 * Les mêmes familles, mais dans un tableau — et c'est tout sauf un détail.
 *
 * Écrit `family_id in (select auth_family_ids())`, un filtre de POLITIQUE ne
 * devient jamais une condition d'index : PostgreSQL en fait un « hashed
 * SubPlan », c'est-à-dire un filtre appliqué APRÈS lecture. La colonne de tête de
 * `idx_transactions_family` reste donc inutilisée et chaque ouverture de
 * l'application lit le grand livre de TOUTES les familles pour n'en garder
 * qu'une.
 *
 * Mesuré, pas supposé (`npm run test:charge`, 500 familles, un an) :
 *
 *   in (select …)                131,9 ms   548 474 blocs lus
 *   = any (tableau, InitPlan)      1,1 ms     1 097 blocs lus
 *
 * D'où la forme retenue partout ci-dessous :
 *
 *   family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[]))
 *
 * Le `coalesce` n'est pas une précaution contre le nul — la fonction rend déjà
 * un tableau vide. Il est là pour que `any` reçoive une EXPRESSION et non une
 * sous-requête : `any ((select …))` seul se lit comme la forme « ensemble » et
 * refuse de compiler. Le `(select …)` autour de l'appel, lui, garantit une
 * évaluation unique par requête (un InitPlan) au lieu d'une par ligne.
 *
 * Ce que la politique autorise ne change pas d'un iota — `supabase/test/rls.sql`
 * le vérifie ligne à ligne. Seul le chemin d'accès change.
 */
create or replace function auth_family_ids_array()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(family_id), '{}'::text[])
  from parents where user_id = auth.uid();
$$;

/**
 * Les enfants de ces familles-là.
 *
 * `mission_assignments` est la seule table sans `family_id` : sa politique
 * passait par un `exists` sur `children`, que le planificateur ne peut pas
 * davantage transformer en condition d'index. Un tableau d'identifiants
 * d'enfants rend la colonne `child_id` indexable, exactement comme ci-dessus.
 */
create or replace function auth_child_ids_array()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(c.id), '{}'::text[])
  from children c
  where c.family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[]));
$$;

alter table families                enable row level security;
alter table parents                 enable row level security;
alter table children                enable row level security;
alter table missions                enable row level security;
alter table mission_assignments     enable row level security;
alter table mission_completions     enable row level security;
alter table screen_time_transactions enable row level security;
alter table screen_time_sessions    enable row level security;
alter table devices                 enable row level security;

-- families -------------------------------------------------------------
drop policy if exists families_select on families;
create policy families_select on families
  for select using (id = any (coalesce((select auth_family_ids_array()), '{}'::text[])));

drop policy if exists families_insert on families;
create policy families_insert on families
  for insert with check (true); -- a brand new family has no member yet

drop policy if exists families_update on families;
create policy families_update on families
  for update using (id = any (coalesce((select auth_family_ids_array()), '{}'::text[])));

drop policy if exists families_delete on families;
create policy families_delete on families
  for delete using (id = any (coalesce((select auth_family_ids_array()), '{}'::text[])));

-- parents --------------------------------------------------------------
drop policy if exists parents_select on parents;
create policy parents_select on parents
  for select using (family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[])));

drop policy if exists parents_insert on parents;
create policy parents_insert on parents
  for insert with check (user_id = auth.uid());

drop policy if exists parents_update on parents;
create policy parents_update on parents
  for update using (user_id = auth.uid());

drop policy if exists parents_delete on parents;
create policy parents_delete on parents
  for delete using (user_id = auth.uid());

-- Every remaining table is scoped by family_id, directly or through a join.
do $$
declare
  t text;
begin
  foreach t in array array[
    'children',
    'devices',
    'missions',
    'mission_completions',
    'screen_time_transactions',
    'screen_time_sessions'
  ] loop
    execute format('drop policy if exists %I_family_access on %I', t, t);
    execute format(
      -- Les guillemets doublés : tout ceci est une chaîne, et `''{}''` y écrit
      -- le tableau vide.
      'create policy %I_family_access on %I for all
         using (family_id = any (coalesce((select auth_family_ids_array()), ''{}''::text[])))
         with check (family_id = any (coalesce((select auth_family_ids_array()), ''{}''::text[])))',
      t, t
    );
  end loop;
end $$;

-- Assignments carry no family_id: they inherit it from the child. Le `exists`
-- corrélé qui servait ici disait la même chose, mais obligeait la base à
-- relire `children` pour chaque affectation examinée ; la liste des enfants,
-- calculée une fois, rend `child_id` indexable. Même frontière, autre chemin.
drop policy if exists mission_assignments_family_access on mission_assignments;
create policy mission_assignments_family_access on mission_assignments
  for all
  using (child_id = any (coalesce((select auth_child_ids_array()), '{}'::text[])))
  with check (child_id = any (coalesce((select auth_child_ids_array()), '{}'::text[])));

-- ---------------------------------------------------------------- realtime

-- Lets a child's tablet update the second a parent validates a mission.
alter publication supabase_realtime add table mission_completions;
alter publication supabase_realtime add table screen_time_transactions;
alter publication supabase_realtime add table missions;
alter publication supabase_realtime add table mission_assignments;
alter publication supabase_realtime add table children;
-- A console request has to reach the parent's phone the moment it is made.
alter publication supabase_realtime add table screen_time_sessions;

-- ------------------------------------------------------------- abonnements

-- Billing state mirrors what Stripe says. Nothing here is writable by a client:
-- a family that could set its own `status` to 'active' is a family that will.
-- The service role, driven by Stripe webhooks, is the only writer.
create table if not exists subscriptions (
  family_id            text primary key references families(id) on delete cascade,
  status               text not null check (status in ('trialing','active','past_due','canceled')),
  plan                 text check (plan in ('monthly','yearly')),
  trial_ends_at        timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  -- Referral months earned but not yet applied to a period.
  credit_months        integer not null default 0 check (credit_months >= 0),
  customer_id          text,
  subscription_id      text,
  updated_at           timestamptz not null default now()
);

create table if not exists referrals (
  id                 text primary key,
  code               text not null,
  referrer_family_id text not null references families(id) on delete cascade,
  referee_family_id  text not null references families(id) on delete cascade,
  status             text not null check (status in ('pending','qualified','credited','rejected')),
  created_at         timestamptz not null default now(),
  qualified_at       timestamptz,
  credited_at        timestamptz,
  rejection_reason   text,
  -- One family can only ever be referred once: the anti-farming rule, enforced
  -- by the database rather than by whoever remembers to check it.
  constraint referrals_one_per_referee unique (referee_family_id),
  constraint referrals_no_self check (referrer_family_id <> referee_family_id)
);

create index if not exists referrals_referrer_idx on referrals (referrer_family_id, status);

alter table subscriptions enable row level security;
alter table referrals     enable row level security;

-- Read-only for the family it belongs to. No insert, update or delete policy is
-- declared on purpose: with RLS enabled and no policy, those are all denied.
drop policy if exists subscriptions_select on subscriptions;
create policy subscriptions_select on subscriptions
  for select using (family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[])));

-- A family sees the referrals it made, and the one it benefited from.
drop policy if exists referrals_select on referrals;
create policy referrals_select on referrals
  for select using (
    referrer_family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[]))
    or referee_family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[]))
  );


-- ------------------------------------------------------- rejoindre une famille

-- One row per device that joined from the child's side. It is to a child's
-- tablet what `parents` is to a parent's phone: the only bridge between an
-- authenticated session and a family.
create table if not exists family_devices (
  id        text primary key,
  family_id text not null references families (id) on delete cascade,
  user_id   uuid not null unique references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now()
);

alter table family_devices enable row level security;

drop policy if exists family_devices_select on family_devices;
create policy family_devices_select on family_devices
  for select using (user_id = auth.uid());

-- Both kinds of member resolve through the same helper.
create or replace function auth_family_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select family_id from parents where user_id = auth.uid()
  union
  select family_id from family_devices where user_id = auth.uid()
$$;

-- Et la même chose en tableau, une fois `family_devices` connue. Voir le long
-- commentaire près de la première définition : c'est cette forme-là que lisent
-- les politiques, et c'est elle qui permet à l'index de servir.
create or replace function auth_family_ids_array()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(family_id), '{}'::text[]) from (
    select family_id from parents where user_id = auth.uid()
    union
    select family_id from family_devices where user_id = auth.uid()
  ) t;
$$;

/**
 * Is the caller a parent, or a child's device?
 *
 * This is the line the whole security model rests on. A child's device may read
 * everything in its family and say "I have finished" — it may never decide that
 * a mission is worth fifteen minutes, and it may never add time to a counter.
 */
create or replace function auth_is_parent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from parents where user_id = auth.uid())
$$;

-- Failed pairing attempts, so a script cannot walk the code space.
create table if not exists join_attempts (
  id         bigserial primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_join_attempts_user on join_attempts (user_id, attempted_at desc);

-- A child's device attaching itself to a family.
--
-- RLS deliberately hides a family from anyone outside it, so the client cannot
-- look one up to check a code — which is exactly right, and exactly why this
-- has to be a SECURITY DEFINER function instead.
--
-- The family code is the only thing asked of a child: at eight years old every
-- extra field is a wall. Proving that an adult is present happens afterwards,
-- when the system's own screen-time authorisation asks for the parent's
-- account — far better than a form could.
--
-- Which puts the whole weight of the pairing on this one code. Two things carry
-- it: six characters (32^6, about a billion), and the attempt limit below.
-- Ten tries an hour turns a billion combinations into millennia.
create or replace function join_family(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id text;
  v_recent    int;
begin
  if auth.uid() is null then
    return null;
  end if;

  select count(*) into v_recent
  from join_attempts
  where user_id = auth.uid()
    and attempted_at > now() - interval '1 hour';

  if v_recent >= 10 then
    return null;
  end if;

  select f.id into v_family_id
  from families f
  where upper(f.code) = upper(trim(p_code))
  limit 1;

  if v_family_id is null then
    insert into join_attempts (user_id) values (auth.uid());
    -- Roughly the cost of a success, so timing alone says nothing.
    perform pg_sleep(0.15);
    return null;
  end if;

  insert into family_devices (id, family_id, user_id, joined_at)
  values (gen_random_uuid()::text, v_family_id, auth.uid(), now())
  on conflict (user_id) do update set family_id = excluded.family_id;

  -- A success clears the slate: a child mistyping their own code four times
  -- should not be locked out of their own family.
  delete from join_attempts where user_id = auth.uid();

  return v_family_id;
end;
$$;

revoke all on function join_family(text) from public;
grant execute on function join_family(text) to authenticated;

-- ------------------------------------------- ce qu'un appareil enfant peut faire

-- The blanket family_access policies above are replaced, for the three tables
-- where the difference between a parent and a child actually matters.

-- Completions: a child says "I have finished". Only a parent decides.
drop policy if exists mission_completions_family_access on mission_completions;

drop policy if exists mission_completions_select on mission_completions;
create policy mission_completions_select on mission_completions
  for select using (family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[])));

drop policy if exists mission_completions_insert on mission_completions;
create policy mission_completions_insert on mission_completions
  for insert with check (
    family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[]))
    and (
      auth_is_parent()
      -- A device may only ever create a request. Approving one's own mission is
      -- the single most obvious thing a child would try.
      or (status = 'pending' and minutes_awarded = 0)
      -- …unless the PARENT decided this particular mission counts itself. The
      -- permission is read from the mission row, which no device can write, and
      -- the amount must match it exactly: a modified client may claim a mission,
      -- never invent the reward, and never claim one it was not granted.
      --
      -- The join on `mission_assignments` is what makes the last clause true.
      -- Without it, "granted" meant "granted to anyone in the family": a child
      -- could count a sibling's mission as their own, and the amount would
      -- match, and every other check would pass.
      --
      -- `reviewed_by` must stay empty: nobody reviewed this. Letting a device
      -- write a parent's id there would forge, in the family's own history,
      -- the one fact this whole feature is about — who vouched for it.
      or (
        status = 'approved'
        and reviewed_by is null
        and exists (
          select 1 from missions m
          join mission_assignments a
            on a.mission_id = m.id
           and a.child_id = mission_completions.child_id
           and a.active
          where m.id = mission_completions.mission_id
            and m.family_id = mission_completions.family_id
            and m.auto_approve
            and not m.archived
            and m.minutes = mission_completions.minutes_awarded
        )
      )
    )
  );

drop policy if exists mission_completions_update on mission_completions;
create policy mission_completions_update on mission_completions
  for update using (family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[])) and auth_is_parent())
  with check (family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[])) and auth_is_parent());

-- Transactions: a child's device may spend time, never grant it.
drop policy if exists screen_time_transactions_family_access on screen_time_transactions;

drop policy if exists screen_time_transactions_select on screen_time_transactions;
create policy screen_time_transactions_select on screen_time_transactions
  for select using (family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[])));

drop policy if exists screen_time_transactions_insert on screen_time_transactions;
create policy screen_time_transactions_insert on screen_time_transactions
  for insert with check (
    family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[]))
    and (
      auth_is_parent()
      -- The only line a device may write on its own: time coming off.
      or (delta < 0 and kind = 'screen_time_used')
      -- And the reward for a mission the parent allowed to count itself. Every
      -- part is checked against rows a device cannot write: the completion it
      -- points at must exist, be approved, belong to this child, and the amount
      -- must equal the mission's own reward. Without the join on `ref_id` a
      -- device could write any number it liked and call it a mission.
      --
      -- `uniq_reward_per_completion` complète cette politique et lui est
      -- indispensable : elle dit qu'une ligne est juste, l'index dit qu'il n'y
      -- en a qu'une.
      or (
        kind = 'mission_reward'
        and exists (
          select 1
          from mission_completions c
          join missions m on m.id = c.mission_id
          join mission_assignments a
            on a.mission_id = m.id and a.child_id = c.child_id and a.active
          where c.id = screen_time_transactions.ref_id
            and c.child_id = screen_time_transactions.child_id
            and c.family_id = screen_time_transactions.family_id
            and c.status = 'approved'
            and m.auto_approve
            and m.minutes = screen_time_transactions.delta
        )
      )
    )
  );

-- The ledger is append-only for everyone. Nothing is corrected by editing a
-- past line; a mistake is fixed by adding a new one, which is what keeps the
-- history and the balance from ever disagreeing.
drop policy if exists screen_time_transactions_update on screen_time_transactions;
drop policy if exists screen_time_transactions_delete on screen_time_transactions;

-- Missions belong to the parent. A device reads them and nothing more.
drop policy if exists missions_family_access on missions;

drop policy if exists missions_select on missions;
create policy missions_select on missions
  for select using (family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[])));

drop policy if exists missions_write on missions;
create policy missions_write on missions
  for all
  using (family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[])) and auth_is_parent())
  with check (family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[])) and auth_is_parent());


-- ------------------------------------------------------------ code parent

/**
 * The parent PIN, where nothing can read it.
 *
 * Deliberately NOT a column on `parents`: that row is visible to every device
 * in the family, and a child's tablet is one of them. Here there is no select
 * policy at all — with RLS enabled and no policy, every read is denied,
 * including the parent's own. The only way in is through the two functions
 * below.
 *
 * Four digits is ten thousand guesses, so hashing alone would settle nothing.
 * What protects it is that the hash never leaves the server and that attempts
 * are counted.
 */
create table if not exists parent_secrets (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  pin_hash      text not null,
  failed_count  int not null default 0,
  locked_until  timestamptz,
  updated_at    timestamptz not null default now()
);

alter table parent_secrets enable row level security;
-- No policy is declared. That is the point.

create extension if not exists pgcrypto;

create or replace function set_parent_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_pin !~ '^[0-9]{4}$' then
    return false;
  end if;

  insert into parent_secrets (user_id, pin_hash, failed_count, locked_until, updated_at)
  values (auth.uid(), crypt(p_pin, gen_salt('bf', 10)), 0, null, now())
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash,
        failed_count = 0,
        locked_until = null,
        updated_at = now();

  return true;
end;
$$;

/**
 * Checks the PIN. Five wrong tries lock it for five minutes.
 *
 * The lockout is per account, not per device: locking only the tablet a child
 * is holding would be a lock they walk around by picking up another one.
 */
create or replace function verify_parent_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret parent_secrets%rowtype;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into v_secret from parent_secrets where user_id = auth.uid();
  if not found then
    return false;
  end if;

  if v_secret.locked_until is not null and v_secret.locked_until > now() then
    return false;
  end if;

  if v_secret.pin_hash = crypt(p_pin, v_secret.pin_hash) then
    update parent_secrets
      set failed_count = 0, locked_until = null
      where user_id = auth.uid();
    return true;
  end if;

  update parent_secrets
    set failed_count = failed_count + 1,
        locked_until = case
          when failed_count + 1 >= 5 then now() + interval '5 minutes'
          else null
        end
    where user_id = auth.uid();

  return false;
end;
$$;

/**
 * How long the lock still has to run, so the app can say "in 4 minutes"
 * instead of repeating "wrong code" at someone typing the right one.
 *
 * Separate from the check on purpose: this is not a secret, and folding it into
 * the answer above would make a wrong code and a locked account distinguishable
 * in the same call.
 */
create or replace function parent_pin_locked_seconds()
returns int
language sql
security definer
set search_path = public
as $$
  select greatest(0, extract(epoch from (locked_until - now()))::int)
  from parent_secrets
  where user_id = auth.uid() and locked_until is not null
$$;

/**
 * Whether a PIN exists at all — no secret, and the only thing standing between
 * an account that never set one and a parent area nobody can ever open.
 */
create or replace function has_parent_pin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from parent_secrets where user_id = auth.uid())
$$;

revoke all on function has_parent_pin() from public;
grant execute on function has_parent_pin() to authenticated;

revoke all on function set_parent_pin(text) from public;
revoke all on function verify_parent_pin(text) from public;
revoke all on function parent_pin_locked_seconds() from public;
grant execute on function set_parent_pin(text) to authenticated;
grant execute on function verify_parent_pin(text) to authenticated;
grant execute on function parent_pin_locked_seconds() to authenticated;


-- ---------------------------------------------------------------------
-- scale.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Mino — passage à l'échelle
--
-- À appliquer APRÈS schema.sql. Ce fichier ne crée aucune donnée : il
-- corrige trois choses qui tiennent à cent familles et tombent à dix mille.
--
--   1. Le temps réel. `postgres_changes` fait vérifier CHAQUE écriture de la
--      base contre CHAQUE client connecté, un par un, dans un seul processus.
--      Le coût est le produit des deux : à 10 000 familles il ne s'agit plus
--      d'un serveur lent mais d'un serveur qui ne suit plus du tout. On passe
--      donc à `broadcast` : la base envoie sur un canal privé par famille,
--      et un message ne traverse que les appareils de cette famille-là.
--
--   2. Les index. Les politiques RLS filtrent sur `family_id` ; les index
--      existants portaient sur `child_id`. Tant que les tables sont petites
--      personne ne le voit ; à quelques millions de lignes, chaque ouverture
--      de l'application devient un parcours de table complet.
--
--   3. La rétention. `join_attempts` ne grossissait que dans un sens.
--
-- Appliquer avec :  supabase db push   (ou coller dans l'éditeur SQL)
-- =====================================================================

-- ------------------------------------------------------------ 1. index

-- Ce que lit vraiment l'application : « tout ce qui appartient à ma famille,
-- le plus récent d'abord ». C'est cet accès-là qu'il faut indexer, et c'est
-- celui qui manquait.
create index if not exists idx_transactions_family
  on screen_time_transactions (family_id, created_at desc);

create index if not exists idx_completions_family_recent
  on mission_completions (family_id, completed_at desc);

create index if not exists idx_sessions_family
  on screen_time_sessions (family_id, started_at desc);

-- Une session en cours est cherchée par famille, pas seulement par enfant :
-- c'est la question que pose l'écran parent toutes les secondes.
create index if not exists idx_sessions_family_running
  on screen_time_sessions (family_id) where status in ('running', 'requested');

-- Les affectations n'ont pas de family_id : elles se rejoignent par l'enfant,
-- et la jointure part de la mission aussi souvent que de l'enfant.
create index if not exists idx_assignments_mission
  on mission_assignments (mission_id);

-- Et par l'enfant, sans condition. `idx_assignments_child` ne couvre que les
-- affectations actives ; la politique, elle, ne parle pas d'« active » — un
-- index partiel ne pouvait donc pas la servir.
create index if not exists idx_assignments_child_all
  on mission_assignments (child_id);

/**
 * La même leçon, deux fois de plus.
 *
 * Un index partiel ne sert une requête que si celle-ci répète sa condition.
 * `idx_missions_family` est posé `where archived = false` ; l'application, elle,
 * demande toutes les missions de sa famille, archivées comprises, et se
 * retrouvait donc à parcourir les cinquante mille missions de la plateforme —
 * 6 ms mesurées à 10 000 familles, soit le tiers d'une ouverture.
 *
 * `parents` n'avait aucun index sur `family_id` : seulement dix mille lignes,
 * mais lues à chaque ouverture, et le parcours coûtait plus que la lecture.
 */
create index if not exists idx_missions_family_all on missions (family_id);
create index if not exists idx_parents_family      on parents (family_id);

-- Les deux entrées du parrainage. `code` est cherché à chaque saisie.
create index if not exists idx_referrals_code on referrals (code);

-- ---------------------------------------------------- 2. temps réel

-- On sort les tables de la publication `postgres_changes`. Rien ne les
-- écoutait de façon sûre, et les y laisser signifie payer le coût du
-- mécanisme qu'on abandonne.
do $$
declare t text;
begin
  foreach t in array array[
    'mission_completions',
    'screen_time_transactions',
    'missions',
    'mission_assignments',
    'children',
    'screen_time_sessions'
  ] loop
    begin
      execute format('alter publication supabase_realtime drop table %I', t);
    exception when others then null; -- déjà retirée
    end;
  end loop;
end $$;

/**
 * Qui a le droit d'écouter le canal d'une famille.
 *
 * Un canal privé s'autorise par RLS sur `realtime.messages`, exactement comme
 * une table. Le nom du canal est `famille:<id>` : on en extrait l'identifiant
 * et on le passe par `auth_family_ids()`, la même fonction qui garde tout le
 * reste. Une famille ne peut donc pas s'abonner au canal d'une autre, même en
 * devinant son identifiant.
 */
drop policy if exists mino_family_channel_read on realtime.messages;
create policy mino_family_channel_read on realtime.messages
  for select to authenticated
  using (
    realtime.topic() like 'famille:%'
    and substring(realtime.topic() from 9) = any (coalesce((select auth_family_ids_array()), '{}'::text[]))
  );

-- Aucune politique d'insertion : seule la base émet sur ces canaux, via le
-- déclencheur ci-dessous. Un appareil qui pourrait écrire sur le canal de sa
-- famille pourrait faire croire à une validation qui n'a pas eu lieu.
drop policy if exists mino_family_channel_write on realtime.messages;

/**
 * Le signal, et rien de plus.
 *
 * Le message ne transporte pas la ligne modifiée, seulement le nom de la table.
 * Deux raisons : rien de sensible ne transite par le canal, et une validation
 * de mission ne coûte que quelques dizaines d'octets au lieu d'une ligne
 * complète multipliée par le nombre d'appareils connectés.
 */
create or replace function mino_broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    record;
  v_family text;
begin
  /**
   * Le ménage ne réveille personne.
   *
   * Ce déclencheur émet un message par ligne écrite — c'est ce qu'il doit
   * faire quand un enfant termine une mission. Mais `compact_ledger()` efface
   * des millions de lignes anciennes d'un coup : sans cette porte, la purge
   * nocturne enverrait des millions de messages et réveillerait les appareils
   * de toutes les familles pour leur annoncer que leur historique d'il y a un
   * an a été rangé. Personne n'a besoin de le savoir, et surtout pas à trois
   * heures du matin.
   *
   * `set local` : la porte ne vaut que pour la transaction qui la pose. Une
   * écriture ordinaire d'un parent, au même instant, diffuse normalement.
   */
  if current_setting('mino.silence', true) = 'on' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  if tg_table_name = 'mission_assignments' then
    select c.family_id into v_family
    from children c
    where c.id = (to_jsonb(v_row) ->> 'child_id');
  else
    -- Passer par jsonb plutôt que par v_row.family_id : la même fonction sert
    -- six tables, et une seule d'entre elles n'a pas la colonne.
    v_family := to_jsonb(v_row) ->> 'family_id';
  end if;

  if v_family is null then
    return v_row;
  end if;

  perform realtime.send(
    jsonb_build_object('table', tg_table_name, 'op', lower(tg_op)),
    'change',
    'famille:' || v_family,
    true  -- canal privé : soumis à la politique ci-dessus
  );

  return v_row;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'children',
    'missions',
    'mission_assignments',
    'mission_completions',
    'screen_time_transactions',
    'screen_time_sessions',
    'devices'
  ] loop
    execute format('drop trigger if exists mino_broadcast on %I', t);
    execute format(
      'create trigger mino_broadcast after insert or update or delete on %I
         for each row execute function mino_broadcast_change()', t);
  end loop;
end $$;

-- --------------------------------------------------------- 3. rétention

/**
 * Les tentatives de rattachement ratées n'ont d'intérêt qu'une heure — c'est la
 * fenêtre que regarde `join_family`. Au-delà, ce n'est plus une protection,
 * c'est une table qui grossit.
 */
create or replace function purge_join_attempts()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from join_attempts where attempted_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::int from gone;
$$;

revoke all on function purge_join_attempts() from public, anon, authenticated;

/**
 * Les comptes anonymes orphelins.
 *
 * Chaque appareil enfant qui se rattache à une famille crée un utilisateur
 * anonyme. Une réinstallation en crée un deuxième, et le premier reste — sans
 * famille, sans usage, mais compté comme utilisateur actif et facturé comme
 * tel. À dix mille familles, ce sont des milliers de comptes fantômes par an.
 *
 * Ne sont supprimés que les comptes anonymes qui n'ont jamais rejoint de
 * famille et qui ont plus de trente jours. Un appareil enfant réellement
 * rattaché a une ligne dans `family_devices` et n'est jamais touché.
 */
create or replace function purge_orphan_devices()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from auth.users u
    where u.is_anonymous is true
      and u.created_at < now() - interval '30 days'
      and not exists (select 1 from family_devices d where d.user_id = u.id)
    returning 1
  )
  select count(*)::int from gone;
$$;

-- Celle-ci supprime des comptes : elle n'appartient qu'au planificateur.
revoke all on function purge_orphan_devices() from public, anon, authenticated;

-- Planifier avec pg_cron (extension à activer dans le tableau de bord) :
--
--   select cron.schedule('mino-purge-join-attempts', '0 4 * * *',
--                        $$select purge_join_attempts()$$);
--   select cron.schedule('mino-purge-orphan-devices', '30 4 * * *',
--                        $$select purge_orphan_devices()$$);
--
-- Laissé en commentaire volontairement : pg_cron s'active par projet, et une
-- planification créée deux fois s'exécute deux fois.

-- ------------------------------------------- 4. le solde sans tout l'historique

/**
 * Le solde d'un enfant, calculé par la base.
 *
 * L'application borne l'historique qu'elle télécharge — sans quoi une famille
 * de trois ans d'ancienneté rapatrie dix mille lignes à chaque ouverture. Mais
 * le solde, lui, doit rester exact : il est ici la somme du grand livre entier,
 * et l'application reconstitue la différence en une seule ligne d'ouverture.
 *
 * La règle du projet ne bouge pas d'un pouce : le solde reste une somme de
 * transactions, jamais un compteur que l'on modifie.
 */
create or replace function family_balances()
returns table (child_id text, minutes int)
language sql
stable
security definer
set search_path = public
as $$
  select t.child_id, coalesce(sum(t.delta), 0)::int
  from screen_time_transactions t
  where t.family_id in (select auth_family_ids())
  group by t.child_id;
$$;

revoke all on function family_balances() from public;
grant execute on function family_balances() to authenticated;


-- ---------------------------------------------------------------------
-- support.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Mino — signalements
--
-- À appliquer APRÈS schema.sql.
--
-- Un seul endroit où arrivent les problèmes. Un bug remonté par e-mail, un
-- autre par un avis sur la boutique et un troisième par message privé, ce sont
-- trois endroits à consulter et trois occasions d'en perdre un.
-- =====================================================================

create table if not exists support_reports (
  id          bigserial primary key,
  -- Renseigné par la base, jamais par le client : un rapport ne doit pas
  -- pouvoir se faire passer pour celui d'une autre famille.
  user_id     uuid not null default auth.uid() references auth.users (id) on delete set null,
  kind        text not null check (kind in ('manual', 'crash')),
  -- Déjà nettoyé côté application (voir src/domain/diagnostics.ts) : ni prénom
  -- d'enfant, ni adresse, ni code.
  message     text not null default '',
  stack       text,
  -- Regroupe les occurrences d'un même problème.
  fingerprint text not null,
  app_version text not null,
  platform    text not null,
  os_version  text,
  route       text,
  repository  text,
  -- Des compteurs (« trois enfants, douze missions »), jamais des contenus.
  counts      jsonb,
  status      text not null default 'nouveau'
              check (status in ('nouveau', 'en cours', 'corrige', 'sans suite')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_reports_fingerprint on support_reports (fingerprint, created_at desc);
create index if not exists idx_reports_status on support_reports (status, created_at desc);
create index if not exists idx_reports_user on support_reports (user_id, created_at desc);

alter table support_reports enable row level security;

-- Écrire, oui, chacun pour soi. Un appareil enfant en a le droit aussi : c'est
-- souvent lui qui plante, et lui refuser la parole reviendrait à ne jamais
-- entendre parler des bugs du côté enfant.
drop policy if exists support_reports_insert on support_reports;
create policy support_reports_insert on support_reports
  for insert to authenticated
  with check (user_id = auth.uid());

-- Relire ses propres signalements, pour en suivre l'état.
drop policy if exists support_reports_select on support_reports;
create policy support_reports_select on support_reports
  for select to authenticated
  using (user_id = auth.uid());

-- Ni modification ni suppression : aucune politique n'est déclarée, donc tout
-- est refusé. Un signalement qu'un utilisateur peut réécrire après coup ne vaut
-- rien comme trace.

-- ------------------------------------------------------------ la file d'attente

/**
 * Ce qu'il faut regarder le matin.
 *
 * Un groupe, pas un ticket : cent parents touchés par le même plantage font une
 * ligne « 100 fois », ce qui dit lequel corriger en premier. Réservé au rôle de
 * service — c'est un tableau de bord interne, pas une donnée de famille.
 */
create or replace view support_queue as
select
  fingerprint,
  kind,
  count(*)                                as occurrences,
  count(distinct user_id)                 as familles,
  min(created_at)                         as premiere_fois,
  max(created_at)                         as derniere_fois,
  mode() within group (order by app_version) as version_frequente,
  mode() within group (order by platform)    as plateforme_frequente,
  mode() within group (order by route)       as ecran_frequent,
  -- Trois exemples suffisent à comprendre ; le reste est du volume.
  (array_agg(message order by created_at desc) filter (where message <> ''))[1:3] as exemples,
  min(status)                             as statut
from support_reports
group by fingerprint, kind
order by max(created_at) desc;

revoke all on support_queue from anon, authenticated;


-- ---------------------------------------------------------------------
-- analytics.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Mino — mesure de l'activité
--
-- À appliquer APRÈS schema.sql.
--
-- Le problème que ce fichier règle, en une phrase : `subscriptions` est un
-- miroir de ce que dit Stripe *aujourd'hui*. Chaque changement l'écrase. Une
-- famille qui a essayé, payé quatre mois puis résilié n'y laisse qu'une ligne
-- « canceled » — et cette ligne ne dit ni quand elle a commencé, ni combien
-- elle a payé, ni quand elle est partie.
--
-- Autrement dit : sans ce qui suit, le churn, les cohortes, la LTV et le MRR
-- des mois passés sont **définitivement incalculables**. Pas difficiles à
-- calculer : incalculables, parce que l'information n'a jamais été écrite.
--
-- C'est exactement la règle déjà appliquée au temps d'écran — on ne stocke
-- jamais qu'un compteur qui change — appliquée cette fois à l'argent.
--
-- Rien ici n'est lisible par un client : tout est réservé au rôle de service.
-- =====================================================================

-- ------------------------------------------------------ le journal facturation

create table if not exists billing_events (
  id           bigserial primary key,
  family_id    text not null references families(id) on delete cascade,
  kind         text not null check (kind in (
                 'essai_commence',
                 'abonnement_commence',
                 'paiement',
                 'paiement_echoue',
                 'resiliation_demandee',
                 'resiliation_effective',
                 'formule_changee',
                 'parrainage_credite'
               )),
  -- L'état et la formule au moment de l'événement : c'est ce qui permet de
  -- reconstituer la situation d'une famille à n'importe quelle date passée.
  status       text check (status in ('trialing','active','past_due','canceled')),
  plan         text check (plan in ('monthly','yearly')),
  -- En centimes, hors taxes, tel qu'encaissé. Nul pour tout ce qui n'est pas
  -- un paiement.
  amount_cents integer,
  currency     text not null default 'eur',
  -- L'identifiant de l'événement Stripe. Unique : Stripe rejoue ses webhooks,
  -- et un paiement compté deux fois fausse tout ce qui suit.
  stripe_event_id text unique,
  occurred_at  timestamptz not null default now()
);

create index if not exists idx_billing_events_family on billing_events (family_id, occurred_at desc);
create index if not exists idx_billing_events_kind on billing_events (kind, occurred_at desc);

alter table billing_events enable row level security;
-- Aucune politique : ni lecture ni écriture par un client. Seul le webhook,
-- qui utilise la clé de service, écrit ici.

-- --------------------------------------------------- dépenses d'acquisition

/**
 * Ce que Stripe ne saura jamais : ce que la publicité a coûté.
 *
 * Sans cette table, le CAC n'est pas calculable — il n'y a aucune source
 * automatique pour le montant dépensé. Une ligne par mois et par canal,
 * saisie à la main ou importée. C'est cinq minutes par mois, et c'est le
 * seul chiffre qui dise si l'acquisition est rentable.
 */
create table if not exists marketing_spend (
  month      date not null,
  channel    text not null,
  amount_eur numeric(10,2) not null check (amount_eur >= 0),
  -- Renseigné depuis App Store Connect et la Play Console, qui ne se
  -- connectent pas à la base : c'est le haut de l'entonnoir.
  installs   integer,
  note       text,
  primary key (month, channel)
);

alter table marketing_spend enable row level security;

-- ----------------------------------------- l'état de chaque famille, mois par mois

/**
 * La brique de tout le reste : où en était chaque famille à la fin de chaque
 * mois. Le `lateral` prend le dernier événement antérieur à la fin du mois —
 * un seul accès à l'index par famille et par mois.
 */
create or replace view metrics_famille_mois as
select
  p.family_id,
  p.month::date as mois,
  coalesce(e.status, 'canceled') as statut,
  e.plan as formule
from (
  select f.family_id, m.month
  from (select distinct family_id from billing_events) f
  cross join generate_series(
    coalesce(date_trunc('month', (select min(occurred_at) from billing_events)), date_trunc('month', now())),
    date_trunc('month', now()),
    interval '1 month'
  ) m(month)
) p
left join lateral (
  select b.status, b.plan
  from billing_events b
  where b.family_id = p.family_id
    and b.occurred_at < p.month + interval '1 month'
  order by b.occurred_at desc
  limit 1
) e on true;

-- ------------------------------------------------------------------- MRR

/**
 * Le revenu récurrent mensuel.
 *
 * L'annuel est ramené au mois (79 € / 12 = 6,58 €) : sans cela, un mois de
 * ventes annuelles fait un pic magnifique et un trou les onze mois suivants.
 * Les chiffres sont hors taxes — c'est le revenu, pas l'encaissement.
 */
create or replace view metrics_mrr as
select
  mois,
  count(*) filter (where statut = 'active')                        as clients_payants,
  count(*) filter (where statut = 'trialing')                      as en_essai,
  count(*) filter (where statut = 'past_due')                      as impayes,
  count(*) filter (where statut = 'active' and formule = 'monthly') as mensuels,
  count(*) filter (where statut = 'active' and formule = 'yearly')  as annuels,
  round(sum(
    case when statut = 'active'
      then case when formule = 'yearly' then 79.0 / 12 else 9.90 end
      else 0 end
  )::numeric, 2) as mrr,
  round(sum(
    case when statut = 'active'
      then case when formule = 'yearly' then 79.0 else 9.90 * 12 end
      else 0 end
  )::numeric, 2) as arr
from metrics_famille_mois
group by mois
order by mois;

-- ----------------------------------------------------------------- churn

/**
 * Le taux de résiliation mensuel, et son inverse utile : la durée de vie.
 *
 * 1 / churn donne le nombre de mois qu'une famille reste en moyenne. À 5 % par
 * mois, vingt mois ; à 8 %, douze et demi. C'est ce nombre, et non le MRR, qui
 * décide de combien on peut dépenser pour acquérir un client.
 */
create or replace view metrics_churn as
select
  courant.mois,
  count(*) filter (where precedent.statut = 'active')                                as base_debut,
  count(*) filter (where precedent.statut = 'active' and courant.statut <> 'active') as perdus,
  count(*) filter (where precedent.statut <> 'active' and courant.statut = 'active') as gagnes,
  round(
    100.0 * count(*) filter (where precedent.statut = 'active' and courant.statut <> 'active')
    / nullif(count(*) filter (where precedent.statut = 'active'), 0), 2
  ) as taux_churn_pct,
  round(
    1.0 / nullif(
      count(*) filter (where precedent.statut = 'active' and courant.statut <> 'active')::numeric
      / nullif(count(*) filter (where precedent.statut = 'active'), 0), 0), 1
  ) as duree_de_vie_mois
from metrics_famille_mois courant
join metrics_famille_mois precedent
  on precedent.family_id = courant.family_id
 and precedent.mois = (courant.mois - interval '1 month')::date
group by courant.mois
order by courant.mois;

-- -------------------------------------------------------------- cohortes

/**
 * Les cohortes, ancrées sur la création du compte et non sur le premier
 * paiement. C'est le seul ancrage qui laisse voir la conversion de l'essai :
 * partir du premier paiement revient à ne regarder que ceux qui ont converti.
 */
create or replace view metrics_cohortes as
with cohorte as (
  select id as family_id, date_trunc('month', created_at)::date as mois_arrivee
  from families
)
select
  c.mois_arrivee,
  m.mois,
  ((extract(year from age(m.mois, c.mois_arrivee)) * 12
    + extract(month from age(m.mois, c.mois_arrivee))))::int as mois_apres,
  count(*)                                        as familles,
  count(*) filter (where m.statut = 'active')     as payantes,
  round(100.0 * count(*) filter (where m.statut = 'active') / nullif(count(*), 0), 1) as retention_pct
from cohorte c
join metrics_famille_mois m on m.family_id = c.family_id and m.mois >= c.mois_arrivee
group by c.mois_arrivee, m.mois
order by c.mois_arrivee, m.mois;

-- ------------------------------------------------------------------- LTV

/**
 * Deux LTV, et il faut les deux.
 *
 * `revenu_encaisse_par_famille` est un fait : ce que cette cohorte a réellement
 * rapporté à ce jour. Il sous-estime toujours les cohortes récentes, qui n'ont
 * pas fini de payer.
 *
 * `ltv_projetee` est une estimation : revenu mensuel moyen ÷ taux de churn.
 * C'est elle qu'on compare au CAC — mais elle vaut ce que vaut le churn, donc
 * pas grand-chose avant six mois d'historique. Les deux ensemble, jamais l'une
 * seule.
 */
create or replace view metrics_ltv as
with cohorte as (
  select id as family_id, date_trunc('month', created_at)::date as mois_arrivee
  from families
),
encaisse as (
  select c.mois_arrivee,
         count(distinct c.family_id)                                     as familles,
         coalesce(sum(b.amount_cents), 0) / 100.0                        as revenu_total,
         count(distinct b.family_id) filter (where b.kind = 'paiement')  as familles_payantes
  from cohorte c
  left join billing_events b on b.family_id = c.family_id and b.kind = 'paiement'
  group by c.mois_arrivee
),
churn_moyen as (
  select avg(taux_churn_pct) / 100.0 as taux
  from metrics_churn
  where base_debut > 0
)
select
  e.mois_arrivee,
  e.familles,
  e.familles_payantes,
  round(100.0 * e.familles_payantes / nullif(e.familles, 0), 1) as conversion_pct,
  round((e.revenu_total / nullif(e.familles, 0))::numeric, 2)   as revenu_encaisse_par_famille,
  round((e.revenu_total / nullif(e.familles_payantes, 0))::numeric, 2) as revenu_par_payante,
  round((9.90 / nullif((select taux from churn_moyen), 0))::numeric, 2) as ltv_projetee
from encaisse e
order by e.mois_arrivee;

-- ------------------------------------------------------------------- CAC

/**
 * Le coût d'acquisition, et le seul ratio qui compte vraiment : LTV / CAC.
 *
 * Le repère habituel est 3. En dessous de 1, chaque client acquis coûte plus
 * qu'il ne rapporte — et dépenser davantage aggrave la situation au lieu de
 * l'améliorer, ce qui est le piège le plus courant à ce stade.
 *
 * `cac_paye` ne compte que les dépenses déclarées : les clients venus du
 * parrainage ou du bouche-à-oreille tirent le CAC moyen vers le bas, ce qui
 * est juste — ils ont vraiment coûté moins cher.
 */
create or replace view metrics_cac as
with nouveaux as (
  select date_trunc('month', min(occurred_at))::date as mois, family_id
  from billing_events
  where kind = 'abonnement_commence'
  group by family_id
),
par_mois as (
  select mois, count(*) as nouveaux_payants from nouveaux group by mois
),
depense as (
  select month as mois, sum(amount_eur) as depense_eur, sum(installs) as installs
  from marketing_spend group by month
)
select
  coalesce(p.mois, d.mois)                                        as mois,
  coalesce(p.nouveaux_payants, 0)                                 as nouveaux_payants,
  coalesce(d.depense_eur, 0)                                      as depense_eur,
  d.installs,
  round((d.depense_eur / nullif(p.nouveaux_payants, 0))::numeric, 2) as cac,
  round(
    (select ltv_projetee from metrics_ltv order by mois_arrivee desc limit 1)
    / nullif(d.depense_eur / nullif(p.nouveaux_payants, 0), 0), 2
  ) as ltv_sur_cac
from par_mois p
full outer join depense d on d.mois = p.mois
order by 1;

-- ------------------------------------------------------------ entonnoir

/**
 * De l'installation au paiement. Le taux qui compte est le dernier : un essai
 * qui ne devient pas payant a coûté un client sans en rapporter un.
 */
create or replace view metrics_entonnoir as
with mois as (
  select date_trunc('month', created_at)::date as mois, count(*) as comptes_crees
  from families group by 1
),
-- On compte les familles, pas les événements : c'est le PREMIER essai de
-- chaque famille qui la range dans un mois, d'où le regroupement en deux
-- temps. Le faire en un seul — `group by date_trunc(min(...))` — est refusé
-- par PostgreSQL, et à raison : ça n'a pas de sens.
essais as (
  select mois, count(*) as essais
  from (
    select family_id, date_trunc('month', min(occurred_at))::date as mois
    from billing_events where kind = 'essai_commence' group by family_id
  ) premiers group by mois
),
payants as (
  select mois, count(*) as payants
  from (
    select family_id, date_trunc('month', min(occurred_at))::date as mois
    from billing_events where kind = 'abonnement_commence' group by family_id
  ) premiers group by mois
),
installs as (
  select month as mois, sum(installs) as installs from marketing_spend group by 1
)
select
  m.mois,
  i.installs,
  m.comptes_crees,
  e.essais,
  p.payants,
  round(100.0 * m.comptes_crees / nullif(i.installs, 0), 1) as install_vers_compte_pct,
  round(100.0 * e.essais / nullif(m.comptes_crees, 0), 1)   as compte_vers_essai_pct,
  round(100.0 * p.payants / nullif(e.essais, 0), 1)         as essai_vers_payant_pct
from mois m
left join essais e on e.mois = m.mois
left join payants p on p.mois = m.mois
left join installs i on i.mois = m.mois
order by m.mois;

-- ----------------------------------------------------------- parrainage

/**
 * Le parrainage rapporte-t-il plus qu'il ne coûte ?
 *
 * Un mois offert vaut 9,90 € de revenu abandonné. Tant que le filleul reste
 * plus d'un mois, l'opération est gagnante — d'où la colonne qui compare les
 * mois offerts au revenu réellement encaissé auprès des filleuls.
 */
create or replace view metrics_parrainage as
with filleuls as (
  select r.referee_family_id, r.status,
         date_trunc('month', r.created_at)::date as mois,
         coalesce(sum(b.amount_cents) filter (where b.kind = 'paiement'), 0) / 100.0 as revenu
  from referrals r
  left join billing_events b on b.family_id = r.referee_family_id
  group by r.referee_family_id, r.status, date_trunc('month', r.created_at)
)
select
  mois,
  count(*)                                          as parrainages,
  count(*) filter (where status = 'credited')       as credites,
  count(*) filter (where status = 'pending')        as en_attente,
  round(sum(revenu)::numeric, 2)                    as revenu_filleuls,
  round((count(*) filter (where status = 'credited') * 9.90)::numeric, 2) as cout_mois_offerts,
  round((sum(revenu) - count(*) filter (where status = 'credited') * 9.90)::numeric, 2) as gain_net
from filleuls
group by mois
order by mois;

-- ------------------------------------------------------------ verrouillage

-- Ce sont des chiffres d'entreprise, pas des données de famille. Aucun client
-- n'y accède : seul le rôle de service, depuis le tableau de bord Supabase.
do $$
declare v text;
begin
  foreach v in array array[
    'metrics_famille_mois', 'metrics_mrr', 'metrics_churn', 'metrics_cohortes',
    'metrics_ltv', 'metrics_cac', 'metrics_entonnoir', 'metrics_parrainage'
  ] loop
    execute format('revoke all on %I from anon, authenticated', v);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- store.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Mino — achats App Store et Play Store
--
-- À appliquer APRÈS schema.sql et analytics.sql.
--
-- Deux rails, un seul abonnement. Dans l'application, Apple et Google exigent
-- leur propre système de paiement ; sur le web, Stripe. Ce fichier fait en
-- sorte que les trois écrivent dans la MÊME table `subscriptions`, de sorte
-- qu'une famille qui a payé sur iPhone soit abonnée sur le site, et
-- réciproquement.
--
-- La règle ne change pas d'un rail à l'autre : le client ne décide jamais
-- qu'il est abonné. Il transmet une preuve, le serveur la fait vérifier, et
-- seule la notification serveur à serveur fait foi — App Store Server
-- Notifications V2 côté Apple, Real-time Developer Notifications côté Google,
-- webhook côté Stripe.
-- =====================================================================

-- --------------------------------------------------- d'où vient le paiement

do $$ begin
  alter table subscriptions add column if not exists source text
    check (source in ('stripe', 'apple', 'google'));
exception when others then null; end $$;

-- Les identifiants côté boutique, à côté de ceux de Stripe.
alter table subscriptions add column if not exists store_product_id text;
alter table subscriptions add column if not exists store_transaction_id text;

-- Le journal de facturation doit dire par où l'argent est passé, sans quoi on
-- ne peut plus comparer ce que rapporte réellement chaque rail.
alter table billing_events add column if not exists source text
  check (source in ('stripe', 'apple', 'google'));

/**
 * Ce qui reste après commission, en centimes.
 *
 * Indispensable, et pas cosmétique : une commission de boutique porte sur le
 * prix hors taxes et la TVA est reversée par la boutique, tandis que les frais
 * Stripe portent sur le montant encaissé et la TVA reste à reverser. Comparer
 * les montants bruts des deux rails se trompe d'environ un cinquième — soit
 * exactement l'ordre de grandeur de la décision qu'on prend avec ce chiffre.
 */
alter table billing_events add column if not exists net_cents integer;

-- ------------------------------------------- relier un achat à une famille

/**
 * Le jeton de compte, et pourquoi il existe.
 *
 * C'est le détail que les intégrations d'achat in-app ratent le plus souvent,
 * et il n'a aucun rattrapage : quand Apple prévient le serveur qu'un
 * abonnement vient d'être renouvelé ou résilié, la seule chose qui accompagne
 * la notification est ce jeton, transmis au moment de l'achat. S'il n'a pas
 * été envoyé, la notification arrive sans qu'on sache de quelle famille elle
 * parle — et il est alors trop tard.
 *
 * Apple impose un UUID (`appAccountToken`), Google une chaîne opaque
 * (`obfuscatedAccountId`). Nos identifiants de famille n'étant ni l'un ni
 * l'autre, la base en attribue un.
 */
alter table families add column if not exists store_account_token uuid
  not null default gen_random_uuid();

create unique index if not exists idx_families_store_token on families (store_account_token);

/** Le jeton de la famille du parent connecté, à joindre à l'achat. */
create or replace function store_account_token()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select f.store_account_token
  from families f
  where f.id in (select auth_family_ids())
  limit 1;
$$;

revoke all on function store_account_token() from public;
grant execute on function store_account_token() to authenticated;

-- ------------------------------------------------- les notifications reçues

/**
 * Tout ce qu'Apple et Google nous envoient, tel quel.
 *
 * Gardé brut et en ajout seul, pour la même raison que le journal de
 * facturation : le jour où un abonnement est dans un état incompréhensible,
 * la seule façon de comprendre est de relire la suite exacte des
 * notifications. Une table qui ne garde que l'état final ne permet jamais ce
 * travail-là.
 */
create table if not exists store_notifications (
  id              bigserial primary key,
  platform        text not null check (platform in ('apple', 'google')),
  -- L'identifiant de la notification côté boutique. Unique : Apple et Google
  -- réémettent leurs notifications, et un renouvellement compté deux fois
  -- fausse le MRR.
  notification_id text unique,
  kind            text,
  account_token   uuid,
  family_id       text references families (id) on delete set null,
  product_id      text,
  transaction_id  text,
  payload         jsonb not null,
  -- Faux tant que la signature n'a pas été vérifiée ; rien n'est appliqué
  -- avant. Une notification non vérifiée est une notification que n'importe
  -- qui peut envoyer.
  verified        boolean not null default false,
  received_at     timestamptz not null default now()
);

create index if not exists idx_store_notifications_family
  on store_notifications (family_id, received_at desc);
create index if not exists idx_store_notifications_token
  on store_notifications (account_token, received_at desc);

alter table store_notifications enable row level security;
-- Aucune politique : seules les fonctions serveur, avec la clé de service,
-- écrivent et lisent ici.

-- ------------------------------------------------------ un seul abonnement

/**
 * Empêche une famille de payer deux fois.
 *
 * Le cas arrive vraiment : un parent souscrit sur le site, puis, sur son
 * iPhone, retombe sur l'écran d'abonnement avant que l'état ne soit
 * rafraîchi, et paie une seconde fois — à Apple cette fois. Il a alors deux
 * abonnements, dont un qu'il ne sait pas résilier, et il écrit au support en
 * colère avec raison.
 *
 * Cette fonction donne à l'application de quoi ne pas proposer l'achat.
 * Elle ne remplace pas le contrôle à l'affichage : elle le rend possible.
 */
create or replace function has_active_subscription()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from subscriptions s
    where s.family_id in (select auth_family_ids())
      and s.status in ('active', 'past_due')
  );
$$;

revoke all on function has_active_subscription() from public;
grant execute on function has_active_subscription() to authenticated;

-- ------------------------------------------------- revenu net, par rail

/**
 * Ce que chaque rail rapporte réellement.
 *
 * La vue à regarder avant de décider où pousser les gens à s'abonner. Elle
 * répond à une question et une seule : le gain de conversion de l'achat natif
 * couvre-t-il la commission qu'il coûte ?
 */
create or replace view metrics_par_rail as
select
  date_trunc('month', occurred_at)::date as mois,
  coalesce(source, 'inconnu')            as rail,
  count(*) filter (where kind = 'paiement')          as paiements,
  count(distinct family_id)                          as familles,
  round(sum(amount_cents) filter (where kind = 'paiement') / 100.0, 2) as encaisse,
  round(sum(net_cents)    filter (where kind = 'paiement') / 100.0, 2) as net,
  round(
    100.0 * (1 - sum(net_cents) filter (where kind = 'paiement')::numeric
                 / nullif(sum(amount_cents) filter (where kind = 'paiement'), 0)), 1
  ) as prelevement_pct
from billing_events
group by 1, 2
order by 1 desc, 2;

revoke all on metrics_par_rail from anon, authenticated;


-- ---------------------------------------------------------------------
-- companion.sql
-- ---------------------------------------------------------------------

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


-- ---------------------------------------------------------------------
-- retention.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Mino — ce qu'on garde, et pendant combien de temps
--
-- À appliquer APRÈS schema.sql. Ce fichier ne crée aucune donnée : il en
-- efface, et c'est tout son sujet.
--
-- Jusqu'ici la base gardait tout, pour toujours. Trois raisons de ne plus le
-- faire, dans l'ordre d'importance :
--
--   1. La règle du produit. « Ne collecter aucune donnée enfant inutile. »
--      Trois ans de « Léa a rangé sa chambre le 12 mars » forment exactement
--      le dossier que Mino promet de ne pas constituer. Aucun écran ne les
--      affiche : le tableau de bord montre six lignes, la fiche d'un enfant
--      trente, son profil douze. Au-delà d'un trimestre, personne ne regarde
--      jamais rien.
--
--   2. Le RGPD, qui dit la même chose en droit : on ne conserve pas au-delà
--      de ce qui sert.
--
--   3. Le coût, qui vient loin derrière mais qui suit : le grand livre d'une
--      famille cesse de grandir, et avec lui la seule requête dont le prix
--      grandissait avec l'ancienneté (`family_balances()`).
--
-- LE SOLDE NE BOUGE PAS D'UNE MINUTE. C'est la seule chose qui ne se négocie
-- pas ici. La règle du projet — le solde est une somme de transactions, jamais
-- un compteur qu'on modifie — reste entière : on ne modifie aucune ligne, on
-- remplace un paquet de lignes par **leur somme exacte**, écrite comme une
-- transaction de plus. Après passage, `sum(delta)` rend le même nombre
-- qu'avant, pour chaque enfant. C'est vérifié à chaque `npm run test:sql`, et
-- c'est exactement ce que l'application fait déjà de son côté quand elle ne
-- télécharge que 90 jours (`withOpeningBalances`).
--
-- Appliquer avec :  npm run db:push   (ou coller dans l'éditeur SQL)
-- =====================================================================

-- --------------------------------------------------------- la fenêtre

/**
 * Combien de jours de détail on garde.
 *
 * Un trimestre : de quoi revenir de vacances et voir ce qui s'est passé, de
 * quoi répondre à « et le mois dernier ? », et rien de plus. Descendre à 30
 * ou à 7 ne demande que de changer ce nombre — le reste du fichier suit, et
 * `HISTORY_DAYS` côté application doit alors suivre aussi
 * (`src/data/supabaseRepository.ts`).
 */
create or replace function mino_history_days()
returns integer
language sql
immutable
as $$ select 90 $$;

-- --------------------------------------------- replier le grand livre

/**
 * Le détail ancien, replié en une ligne par enfant.
 *
 * Pour chaque enfant ayant des lignes antérieures à la fenêtre : on en fait la
 * somme, on les supprime, et on écrit cette somme comme une seule transaction
 * datée juste avant la fenêtre. Le solde est inchangé par construction — c'est
 * une somme partielle remplacée par sa valeur.
 *
 * La ligne d'ouverture est elle-même antérieure à la fenêtre : au passage
 * suivant elle sera repliée dans la nouvelle, avec ce qui aura vieilli entre
 * temps. La fonction se rattrape donc toute seule, et deux exécutions de suite
 * donnent le même résultat qu'une.
 *
 * Rend le nombre de lignes effacées.
 */
create or replace function compact_ledger(p_days integer default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cut     timestamptz := now() - make_interval(days => coalesce(p_days, mino_history_days()));
  v_efface  integer := 0;
begin
  -- Silence : ce ménage efface des lignes par millions, et le déclencheur de
  -- diffusion émettrait un message pour chacune. Voir `mino_broadcast_change()`
  -- dans `scale.sql`. `true` = valable pour cette transaction seulement.
  perform set_config('mino.silence', 'on', true);

  -- Trois temps, et pas un seul : effacer et réécrire la même clé dans une
  -- seule instruction fait travailler les deux moitiés sur le même instantané,
  -- et la ligne d'ouverture du passage précédent entrerait en collision avec
  -- celle qu'on écrit. Séparées, les étapes se lisent et se prouvent.
  create temp table pg_temp.mino_repli on commit drop as
    select family_id, child_id, sum(delta)::int as total, count(*)::int as lignes
    from screen_time_transactions
    where created_at < v_cut
    group by family_id, child_id;

  -- La ligne d'ouverture écrite au passage précédent est datée d'avant sa
  -- propre fenêtre : elle part avec le reste, et son montant est déjà compté
  -- dans la somme ci-dessus. C'est ce qui rend la fonction rejouable.
  delete from screen_time_transactions where created_at < v_cut;

  insert into screen_time_transactions
    (id, family_id, child_id, delta, kind, reason, created_at)
  select
    'opening_' || r.child_id || '_' || to_char(v_cut, 'YYYYMMDD'),
    r.family_id, r.child_id, r.total, 'initial_balance',
    'Minutes gagnées avant cette période',
    v_cut - interval '1 second'
  from pg_temp.mino_repli r
  -- Un enfant dont tout l'ancien s'annule à zéro n'a pas besoin de ligne.
  where r.total <> 0;

  select coalesce(sum(lignes), 0)::int into v_efface from pg_temp.mino_repli;
  drop table pg_temp.mino_repli;

  -- On rend la parole : la fonction ne fait taire que son propre ménage, pas
  -- ce que la transaction ferait ensuite.
  perform set_config('mino.silence', 'off', true);
  return v_efface;
end;
$$;

-- Elle efface des lignes du grand livre : elle n'appartient qu'au
-- planificateur. `revoke from public` ne suffit pas — Supabase accorde
-- l'exécution à `anon` et `authenticated` par privilège par défaut.
revoke all on function compact_ledger(integer) from public, anon, authenticated;

-- ------------------------------------------------ effacer le reste

/**
 * Les missions faites et les sessions terminées, passé la fenêtre.
 *
 * Deux exceptions, et elles sont vitales :
 *
 *   — une mission déclarée que personne n'a relue reste, quel que soit son
 *     âge. C'est la seule ligne qui attend quelqu'un, et l'application refuse
 *     déjà de la tronquer au téléchargement ; l'effacer ici reviendrait à
 *     répondre « non » à la place du parent, quatre mois plus tard.
 *
 *   — une session en cours ou demandée reste, pour la même raison.
 *
 * Rend le nombre de lignes effacées, les deux tables confondues.
 */
create or replace function purge_history(p_days integer default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cut    timestamptz := now() - make_interval(days => coalesce(p_days, mino_history_days()));
  v_total  integer := 0;
  v_lot    integer;
begin
  perform set_config('mino.silence', 'on', true);

  with gone as (
    delete from mission_completions c
    where c.completed_at < v_cut and c.status <> 'pending'
    returning 1
  )
  select count(*)::int into v_lot from gone;
  v_total := v_total + v_lot;

  with gone as (
    delete from screen_time_sessions s
    where s.started_at < v_cut and s.status not in ('running', 'requested')
    returning 1
  )
  select count(*)::int into v_lot from gone;
  v_total := v_total + v_lot;

  perform set_config('mino.silence', 'off', true);
  return v_total;
end;
$$;

revoke all on function purge_history(integer) from public, anon, authenticated;

-- Planifier avec pg_cron (extension à activer dans le tableau de bord) :
--
--   select cron.schedule('mino-compact-ledger', '0 3 * * *',
--                        $$select compact_ledger()$$);
--   select cron.schedule('mino-purge-history', '15 3 * * *',
--                        $$select purge_history()$$);
--
-- Dans cet ordre et à quinze minutes d'intervalle : le repli du grand livre
-- doit avoir eu lieu avant qu'on efface les missions auxquelles ses lignes
-- faisaient référence. Laissé en commentaire volontairement — pg_cron s'active
-- par projet, et une planification créée deux fois s'exécute deux fois.
--
-- LE PREMIER PASSAGE N'EST PAS COMME LES AUTRES. Chaque nuit, le repli ne
-- touche qu'une journée de retard — quelques dizaines de milliers de lignes,
-- l'affaire de secondes. Mais le tout premier, sur une base qui a déjà des
-- années derrière elle, efface tout d'un coup, dans une seule transaction.
--
-- Le remède est simple et ne demande aucun code : y aller par fenêtres
-- décroissantes, chacune dans son propre appel.
--
--   select compact_ledger(365);   -- d'abord tout ce qui a plus d'un an
--   select compact_ledger(180);
--   select compact_ledger(90);    -- puis le régime normal
--
-- Chaque appel est court, et le suivant repart de ce que le précédent a laissé.
