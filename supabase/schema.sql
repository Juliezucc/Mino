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

/**
 * Un parent sans nom ni adresse, et pourquoi c'est légitime.
 *
 * Le parcours d'inscription (voir `docs/ops/parcours-inscription.md`) crée la
 * famille et le premier enfant AVANT de demander quoi que ce soit au parent :
 * il voit sa famille exister d'abord, il donne son adresse ensuite. Entre les
 * deux, il est authentifié — Supabase ouvre une session anonyme — mais on ne
 * sait de lui ni son prénom ni son e-mail.
 *
 * Or l'appartenance à une famille se lit dans cette table, et nulle part
 * ailleurs : `auth_family_ids()` fait `select family_id from parents where
 * user_id = auth.uid()`. Sans ligne ici, l'utilisateur anonyme ne voit pas la
 * famille qu'il vient de créer et ne peut pas y ajouter d'enfant. La ligne
 * doit donc exister tout de suite.
 *
 * Restaient deux `not null` qui obligeaient à inventer une adresse. Écrire une
 * chaîne vide dans `email` aurait été le pire des deux mondes : la colonne
 * aurait cessé de mentir sur sa nullité en mentant sur son contenu, et tout le
 * code qui lit `parent.email` aurait affiché du vide sans savoir pourquoi.
 *
 * Un parent qui n'a pas encore donné son adresse n'en a pas. `null` le dit.
 */
alter table parents alter column email        drop not null;
alter table parents alter column display_name drop not null;

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

/**
 * Les plages libres : du temps d'écran qu'on n'a pas eu à gagner.
 *
 * Mercredi après-midi, vacances, anniversaire. Rien ici ne touche au grand
 * livre — une plage n'est ni un gain ni une dépense, et le solde d'un enfant
 * est exactement le même avant et après. Voir `src/domain/freeWindows.ts`.
 *
 * `child_ids` NULL veut dire « toute la fratrie », et ce n'est pas un oubli :
 * c'est le cas courant, et l'écrire ainsi évite qu'un petit frère arrivé
 * ensuite se retrouve exclu d'une plage que personne ne pensera à rouvrir.
 * Un tableau VIDE, lui, n'ouvrirait à personne — d'où la contrainte qui le
 * refuse plutôt que de laisser un réglage sans effet.
 *
 * Les bornes sont des minutes depuis minuit, en HEURE LOCALE de la famille.
 * « Mercredi 14 h », pour une famille, c'est mercredi 14 h là où elle est.
 * La contrainte `fin > début` interdit de traverser minuit : 22 h → 7 h
 * n'est pas une permission, c'est un couvre-feu — la fonctionnalité inverse,
 * qui n'a rien à faire dans le même objet.
 */
create table if not exists free_windows (
  id           text primary key,
  family_id    text not null references families (id) on delete cascade,
  label        text not null check (btrim(label) <> ''),
  child_ids    text[],
  days         smallint[] not null default '{}',
  on_date      date,
  start_minute int not null check (start_minute >= 0 and start_minute <= 1440),
  end_minute   int not null check (end_minute   >= 0 and end_minute   <= 1440),
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),

  constraint free_window_fin_apres_debut check (end_minute > start_minute),
  -- Une plage se répète certains jours, OU n'arrive qu'une fois. Pas les deux,
  -- et pas ni l'une ni l'autre — ce dernier cas ne s'ouvrirait jamais.
  constraint free_window_jours_ou_date check (
    (on_date is null     and array_length(days, 1) is not null) or
    (on_date is not null and array_length(days, 1) is null)
  ),
  constraint free_window_jours_valides check (
    days <@ array[0,1,2,3,4,5,6]::smallint[]
  ),
  constraint free_window_enfants_non_vides check (
    child_ids is null or array_length(child_ids, 1) is not null
  )
);

create index if not exists idx_free_windows_family on free_windows (family_id);

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

/**
 * C'est LA BASE qui date une déclaration, pas le téléphone.
 *
 * Les deux index ci-dessus gravent la règle « une fois par jour » — mais ils
 * la gravent sur `completed_at`, et `completed_at` arrivait du client. Or
 * l'horloge d'un téléphone se règle. Il suffisait d'avancer la date d'un jour
 * pour que la déclaration d'hier cesse d'être celle d'aujourd'hui : l'index ne
 * voyait plus de collision, la mission redevenait déclarable, et la même
 * mission rapportait deux fois. Les deux index protégeaient donc exactement
 * rien contre le seul adversaire qu'ils avaient.
 *
 * `now()` est l'heure du serveur. Elle n'est pas dans les mains de l'enfant.
 *
 * La condition sur `auth.uid()` distingue une écriture venue d'un client — un
 * parent, un appareil appairé — d'une écriture d'administration : les jeux
 * d'essai qui datent volontairement une mission de six mois passent par le
 * propriétaire de la base, sans session, et doivent continuer de pouvoir le
 * faire. Un client, lui, n'a jamais de raison légitime de choisir sa date.
 */
create or replace function mino_stamp_completion()
returns trigger
language plpgsql
-- `security definer`, comme toutes les fonctions de ce fichier qui touchent au
-- schéma `auth` : c'est leur propriétaire qui a le droit d'y lire, pas le rôle
-- qui écrit. La fonction ne fait rien d'autre que poser une date, il n'y a
-- donc aucune surface à élargir.
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.completed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_completion on mission_completions;
create trigger trg_stamp_completion
  before insert on mission_completions
  for each row execute function mino_stamp_completion();

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
alter table free_windows            enable row level security;

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

/**
 * Qui a le droit de devenir parent d'une famille.
 *
 * **La faille que cela ferme, et un enfant pouvait l'ouvrir.** La condition
 * était `user_id = auth.uid()` — seulement. Elle vérifie qu'on s'inscrit
 * soi-même, jamais dans QUELLE famille. Or la tablette d'un enfant est un
 * utilisateur authentifié, et elle connaît l'identifiant de sa propre famille :
 * il est dans les données qu'elle lit légitimement.
 *
 * Il lui suffisait donc d'écrire une ligne dans `parents` avec son propre
 * `user_id` et le `family_id` sous ses yeux. `auth_is_parent()` devenait vrai,
 * et avec lui tout le reste : confirmer ses propres missions, s'accorder des
 * minutes, supprimer un profil, résilier l'abonnement. Toutes les politiques
 * qui protègent l'espace parent s'appuient sur cette fonction ; aucune ne
 * protégeait la fonction elle-même.
 *
 * Deux cas sont légitimes, et seulement deux :
 *
 * 1. **Fonder.** Une famille qui n'a encore aucun parent : c'est l'inscription,
 *    y compris celle d'une session anonyme qui vient de créer sa famille au
 *    premier écran du parcours.
 * 2. **Se réécrire.** Un parent qui renvoie sa propre ligne — la
 *    synchronisation le fait à chaque écriture de la famille.
 *
 * Le second cas exige `auth_is_parent()`, et c'est lui qui referme la porte :
 * un appareil d'enfant appartient bien à la famille (`auth_family_ids()` lit
 * aussi `family_devices`), mais il n'est parent de personne.
 */
create or replace function family_has_parent(fid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from parents where family_id = fid)
$$;

/**
 * Déjà parent de CETTE famille — la nuance est tout le correctif.
 *
 * `auth_is_parent()` ne dit que « parent quelque part », ce qui ne protège
 * rien ici. Et cette fonction est définie plus bas dans le fichier, après les
 * tables dont elle dépend : la nommer ici échouerait à la création.
 */
create or replace function is_parent_of(fid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from parents where family_id = fid and user_id = auth.uid()
  )
$$;

drop policy if exists parents_insert on parents;
create policy parents_insert on parents
  for insert with check (
    user_id = auth.uid()
    and (not family_has_parent(family_id) or is_parent_of(family_id))
  );

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

/**
 * Ce que l'appareil de l'enfant dit de son bouclier.
 *
 * Sans ces trois colonnes, le produit avait un mode de panne silencieux, et
 * c'était le pire de tous : un adolescent retire à Mino l'accès aux
 * statistiques d'usage — deux touches dans les réglages Android — et le
 * bouclier cesse d'exister. L'application le sait, sur SA tablette. Le parent,
 * lui, n'apprend rien : son écran de blocage lit l'autorisation de SON
 * téléphone à lui, où tout va bien. Il continue de croire que Mino encadre
 * quelque chose.
 *
 * Un bouclier mort dont le parent ignore la mort est pire qu'un bouclier
 * absent : il produit la confiance sans la protection.
 *
 * `shield_seen_at` compte autant que `shield_status` : un appareil qui cesse
 * complètement de donner de ses nouvelles — Mino désinstallé, téléphone
 * éteint depuis trois jours — ne dira jamais « denied ». C'est le silence
 * qu'il faut savoir lire, et c'est l'écran parent qui le lit.
 */
alter table family_devices add column if not exists shield_status  text;
alter table family_devices add column if not exists shield_seen_at timestamptz;
alter table family_devices add column if not exists label          text;
alter table family_devices add column if not exists child_id       text
  references children (id) on delete set null;

alter table family_devices enable row level security;

drop policy if exists family_devices_select on family_devices;
create policy family_devices_select on family_devices
  for select using (
    -- L'appareil voit sa propre ligne…
    user_id = auth.uid()
    -- …et les parents de la famille voient toutes celles de leur famille.
    -- C'est ce qui manquait : ils ne pouvaient pas même savoir combien
    -- d'appareils avaient rejoint.
    or family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[]))
  );

/**
 * L'appareil rend compte de lui-même, et de rien d'autre.
 *
 * Une fonction plutôt qu'une politique `update` : une politique laisserait
 * l'appareil écrire n'importe quelle colonne de sa ligne, `family_id` compris
 * — c'est-à-dire se rattacher à la famille de quelqu'un d'autre. Ici il n'y a
 * que trois champs à poser, et `where user_id = auth.uid()` n'est pas
 * négociable depuis l'appelant.
 *
 * `p_child_id` est vérifié contre la famille de l'appareil : sans cela, un
 * appareil pourrait se déclarer comme étant celui d'un enfant d'une autre
 * famille, et l'écran du parent afficherait un prénom qui n'est pas le sien.
 */
create or replace function report_shield(
  p_status   text,
  p_label    text default null,
  p_child_id text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Aucune session' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('approved', 'denied', 'not-determined', 'unavailable') then
    raise exception 'Statut inconnu' using errcode = '22023';
  end if;

  update family_devices d
     set shield_status  = coalesce(p_status, d.shield_status),
         shield_seen_at = now(),
         label          = coalesce(nullif(btrim(p_label), ''), d.label),
         child_id       = case
                            when p_child_id is null then d.child_id
                            when exists (
                              select 1 from children c
                               where c.id = p_child_id and c.family_id = d.family_id
                            ) then p_child_id
                            else d.child_id
                          end
   where d.user_id = auth.uid();
end;
$$;

revoke all on function report_shield(text, text, text) from public, anon;
grant execute on function report_shield(text, text, text) to authenticated;

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

/**
 * Verrouillée, et SANS politique : personne n'y touche directement.
 *
 * Cette table est le compteur qui empêche un script de balayer l'espace des
 * codes famille. Elle était la seule du schéma sans RLS — donc ouverte en
 * lecture ET EN SUPPRESSION à tout appareil connecté, l'appareil d'un enfant
 * compris. Il suffisait d'effacer ses propres lignes entre deux essais pour
 * que la limite ne compte plus jamais : la protection s'annulait elle-même,
 * et rien ne l'aurait signalé.
 *
 * Aucune politique n'est ajoutée, et c'est volontaire — RLS active sans
 * politique veut dire « personne ». `join_family()` est `security definer` :
 * elle s'exécute avec les droits de son propriétaire, qui outrepasse la RLS,
 * et reste donc seule à pouvoir compter, insérer et purger.
 *
 * Trouvé en vérifiant la base réelle après application : 21 tables, 20 avec
 * RLS. C'est l'écart d'une seule qui a mis la puce à l'oreille.
 */
alter table join_attempts enable row level security;

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

/**
 * Marquer une célébration comme vue — la seule modification qu'un appareil
 * d'enfant ait le droit de faire sur sa complétion.
 *
 * La politique ci-dessus a raison : un enfant ne doit jamais pouvoir toucher au
 * statut d'une complétion ni au montant crédité. Mais `celebrated_at` n'est
 * rien de tout cela — c'est un drapeau d'affichage, qui empêche les confettis
 * de se rejouer au prochain lancement.
 *
 * Sans cette fonction, l'écran de fête tentait une mise à jour ordinaire depuis
 * l'appareil de l'enfant, la base la refusait, et le magasin annulait toute
 * l'opération en annonçant « Rien n'a été enregistré ». Les minutes, elles,
 * étaient bien écrites : l'enfant lisait donc « +5 minos » et « rien n'a été
 * enregistré » sur le même écran, et l'une des deux phrases était fausse.
 *
 * `security definer`, donc au-dessus de la RLS — d'où le soin porté à ce
 * qu'elle ne puisse rien faire d'autre. Elle ne prend qu'un identifiant, ne
 * touche qu'une colonne, exige que la complétion appartienne à une famille de
 * l'appelant, et ne repasse jamais sur une célébration déjà marquée.
 */
create or replace function mark_celebrated(p_completion_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_touche int;
begin
  if auth.uid() is null then
    return false;
  end if;

  update mission_completions
     set celebrated_at = now()
   where id = p_completion_id
     and celebrated_at is null
     and family_id = any (coalesce(auth_family_ids_array(), '{}'::text[]));

  get diagnostics v_touche = row_count;
  return v_touche > 0;
end;
$$;

revoke all on function mark_celebrated(text) from public, anon;
grant execute on function mark_celebrated(text) to authenticated;

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

/**
 * Les plages libres : lues par tout le monde, écrites par les parents seuls.
 *
 * L'appareil de l'enfant DOIT les lire — c'est ainsi qu'il sait que son écran
 * est ouvert le mercredi après-midi, et qu'il évite de lui faire dépenser des
 * minutes pour un temps qu'il a déjà.
 *
 * Mais une plage libre est du temps d'écran gratuit. Laisser un appareil
 * enfant en écrire une reviendrait à lui laisser s'accorder l'accès permanent
 * en une ligne — « tous les jours, de 00 h 00 à 23 h 59 » — et le produit
 * entier ne voudrait plus rien dire. C'est la même frontière que pour les
 * missions, et pour la même raison.
 */
drop policy if exists free_windows_family_access on free_windows;

drop policy if exists free_windows_select on free_windows;
create policy free_windows_select on free_windows
  for select using (family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[])));

drop policy if exists free_windows_write on free_windows;
create policy free_windows_write on free_windows
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

/**
 * `public, extensions`, et pas `public` seul — sans quoi le code parent ne peut
 * pas s'enregistrer du tout.
 *
 * `crypt()` et `gen_salt()` viennent de pgcrypto. Sur un PostgreSQL nu,
 * l'extension s'installe dans `public` et tout va bien ; sur Supabase, elle vit
 * dans un schéma à part, `extensions`, et un `search_path` qui ne le mentionne
 * pas ne trouve donc aucune de ses fonctions. La création de famille échouait
 * sur « Impossible d'enregistrer le code », et seulement en production : le
 * banc d'essai, lui, montait un PostgreSQL nu.
 *
 * `set search_path` est obligatoire sur une fonction `security definer` — sans
 * lui, l'appelant choisit où la fonction va chercher ses tables, ce qui revient
 * à lui prêter les droits du propriétaire. On l'élargit donc du strict
 * nécessaire, et pas d'un schéma de plus.
 */
create or replace function set_parent_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
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
-- `extensions` pour `crypt()` : voir `set_parent_pin` juste au-dessus.
set search_path = public, extensions
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
