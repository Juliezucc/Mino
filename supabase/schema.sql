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
  display_name text not null,
  email        text not null,
  pin          text not null,
  created_at   timestamptz not null default now()
);

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
  created_by text not null,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

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
  for select using (id in (select auth_family_ids()));

drop policy if exists families_insert on families;
create policy families_insert on families
  for insert with check (true); -- a brand new family has no member yet

drop policy if exists families_update on families;
create policy families_update on families
  for update using (id in (select auth_family_ids()));

drop policy if exists families_delete on families;
create policy families_delete on families
  for delete using (id in (select auth_family_ids()));

-- parents --------------------------------------------------------------
drop policy if exists parents_select on parents;
create policy parents_select on parents
  for select using (family_id in (select auth_family_ids()));

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
      'create policy %I_family_access on %I for all
         using (family_id in (select auth_family_ids()))
         with check (family_id in (select auth_family_ids()))',
      t, t
    );
  end loop;
end $$;

-- Assignments carry no family_id: they inherit it from the child.
drop policy if exists mission_assignments_family_access on mission_assignments;
create policy mission_assignments_family_access on mission_assignments
  for all
  using (
    exists (
      select 1 from children c
      where c.id = mission_assignments.child_id
        and c.family_id in (select auth_family_ids())
    )
  )
  with check (
    exists (
      select 1 from children c
      where c.id = mission_assignments.child_id
        and c.family_id in (select auth_family_ids())
    )
  );

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
  for select using (family_id in (select auth_family_ids()));

-- A family sees the referrals it made, and the one it benefited from.
drop policy if exists referrals_select on referrals;
create policy referrals_select on referrals
  for select using (
    referrer_family_id in (select auth_family_ids())
    or referee_family_id in (select auth_family_ids())
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

-- A child's device attaching itself to a family.
--
-- RLS deliberately hides a family from anyone outside it, so the client cannot
-- look one up to check a code — which is exactly right, and exactly why this
-- has to be a SECURITY DEFINER function instead.
--
-- Two secrets are required, never one. The family code is four characters, gets
-- read aloud across a kitchen and written on a fridge; on its own it is
-- guessable, and guessing it would drop a stranger inside a family with
-- children in it. The parent's e-mail has to match as well.
--
-- Returns the family id on success and null otherwise, without ever saying
-- which half was wrong: naming it would turn one secret into two separate
-- things to guess.
create or replace function join_family(p_code text, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select f.id into v_family_id
  from families f
  join parents p on p.family_id = f.id
  where upper(f.code) = upper(trim(p_code))
    and lower(p.email) = lower(trim(p_email))
  limit 1;

  if v_family_id is null then
    -- Roughly the cost of a success, so timing alone says nothing.
    perform pg_sleep(0.15);
    return null;
  end if;

  insert into family_devices (id, family_id, user_id, joined_at)
  values (gen_random_uuid()::text, v_family_id, auth.uid(), now())
  on conflict (user_id) do update set family_id = excluded.family_id;

  return v_family_id;
end;
$$;

revoke all on function join_family(text, text) from public;
grant execute on function join_family(text, text) to authenticated;

-- ------------------------------------------- ce qu'un appareil enfant peut faire

-- The blanket family_access policies above are replaced, for the three tables
-- where the difference between a parent and a child actually matters.

-- Completions: a child says "I have finished". Only a parent decides.
drop policy if exists mission_completions_family_access on mission_completions;

drop policy if exists mission_completions_select on mission_completions;
create policy mission_completions_select on mission_completions
  for select using (family_id in (select auth_family_ids()));

drop policy if exists mission_completions_insert on mission_completions;
create policy mission_completions_insert on mission_completions
  for insert with check (
    family_id in (select auth_family_ids())
    -- A device may only ever create a request. Approving one's own mission is
    -- the single most obvious thing a child would try.
    and (auth_is_parent() or (status = 'pending' and minutes_awarded = 0))
  );

drop policy if exists mission_completions_update on mission_completions;
create policy mission_completions_update on mission_completions
  for update using (family_id in (select auth_family_ids()) and auth_is_parent())
  with check (family_id in (select auth_family_ids()) and auth_is_parent());

-- Transactions: a child's device may spend time, never grant it.
drop policy if exists screen_time_transactions_family_access on screen_time_transactions;

drop policy if exists screen_time_transactions_select on screen_time_transactions;
create policy screen_time_transactions_select on screen_time_transactions
  for select using (family_id in (select auth_family_ids()));

drop policy if exists screen_time_transactions_insert on screen_time_transactions;
create policy screen_time_transactions_insert on screen_time_transactions
  for insert with check (
    family_id in (select auth_family_ids())
    and (
      auth_is_parent()
      -- The only line a device may write: time coming off, for time used.
      or (delta < 0 and kind = 'screen_time_used')
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
  for select using (family_id in (select auth_family_ids()));

drop policy if exists missions_write on missions;
create policy missions_write on missions
  for all
  using (family_id in (select auth_family_ids()) and auth_is_parent())
  with check (family_id in (select auth_family_ids()) and auth_is_parent());
