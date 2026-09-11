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
--   essai.sql      les 30 jours d’essai, à la création de la famille
--   store.sql      achats App Store et Play Store
--   companion.sql  budget et conversations de Mino
--   retention.sql  ce qu’on garde, et combien de temps
--   compte.sql     quitter : suppression du compte
--   notifications.sql jetons de notification
--   courrier.sql   ce que Mino a déjà écrit à chaque famille
--   code-parent-famille.sql le code parent appartient à la famille, pas au compte
--   deux-parents.sql un second parent en profil, sans second compte
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
  -- `offert` : un accès sans terme et sans rail, accordé à la main aux familles
  -- qui essuient les plâtres. Voir `supabase/acces-offert.sql`.
  status               text not null check (status in ('trialing','active','past_due','canceled','offert')),
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
  -- `compteur-seul` n'est pas un état du système : c'est la réponse d'un parent
  -- qui ne veut pas de verrou sur cet appareil-là. Sans lui dans cette liste,
  -- la fonction levait « Statut inconnu » — et comme l'appelant avale l'erreur
  -- (c'est un rapport, pas une action), l'appareil cessait simplement de donner
  -- de ses nouvelles. Au bout de trois jours il passait « muet », c'est-à-dire
  -- exactement l'alerte qu'on venait de faire taire.
  if p_status is not null
     and p_status not in ('approved', 'denied', 'not-determined', 'unavailable', 'compteur-seul')
  then
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
    'devices',
    /**
     * Les plages libres, et il manquait l'essentiel.
     *
     * Une plage se règle sur le téléphone du parent et s'applique sur la
     * tablette de l'enfant : sans diffusion, la tablette garde celle d'hier —
     * elle refuse des séances pour un créneau terminé, et ignore celui qui
     * vient de s'ouvrir. Le parent voit son réglage enregistré chez lui et
     * sans effet chez son enfant, ce qui est la pire des deux moitiés.
     */
    'free_windows',
    /**
     * Et les parents, depuis qu'ils peuvent être deux.
     *
     * La mère ajoute « Marc » sur son téléphone ; celui de Marc, déjà appairé,
     * ne le voit pas dans la liste et ne peut pas s'y rattacher. Dans l'autre
     * sens, un appareil qui reprend un profil ne se signale nulle part. Une
     * liste qui ne se met à jour qu'au redémarrage n'est pas une liste, c'est
     * un souvenir.
     */
    'parents'
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

-- Planifié dans `supabase/planification.sql`, à coller une fois sur le projet.
-- La planification vit à part parce que pg_cron s'active par projet ; le
-- fichier déprogramme avant de programmer, ce qui le rend rejouable.

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

/**
 * L'adresse à laquelle répondre — et il n'y en avait aucune.
 *
 * **Le défaut, et c'est celui qui rendait tout le reste inutile.** Un parent
 * bloqué écrivait, recevait une référence, et attendait. Rien ne pouvait lui
 * revenir : la table ne garde que `user_id`, et `buildReport` EFFACE les
 * adresses du message — la ligne `EMAIL` de `src/domain/diagnostics.ts` est là
 * pour protéger la vie privée, et elle protégeait aussi le parent de toute
 * réponse. Depuis la tablette d'un enfant, l'identité est anonyme : il n'y
 * avait même pas de jointure possible.
 *
 * Séparée du message, donc, et jamais nettoyée : c'est le seul champ de cette
 * table que le parent donne POUR qu'on s'en serve. Facultatif — on répond si
 * on peut, on ne refuse pas un signalement anonyme.
 */
alter table support_reports add column if not exists reply_to text;

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
-- Supprimée puis recréée, et non « or replace » : PostgreSQL refuse de
-- remplacer une vue dont la liste de colonnes change ailleurs qu'à la fin, et
-- `repondre_a` s'insère avant `statut`. Une vue interne se reconstruit sans
-- rien perdre.
drop view if exists support_queue;
create view support_queue as
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
  -- À qui répondre. Sans cette colonne, le tableau de bord du matin disait
  -- quoi corriger sans jamais dire à qui l'annoncer.
  (array_agg(reply_to order by created_at desc) filter (where reply_to is not null))[1:3] as repondre_a,
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
-- essai.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Mino — l'essai de 30 jours
--
-- À appliquer APRÈS schema.sql.
--
-- **Le défaut que ce fichier répare, et il vidait le modèle économique.**
-- Aucune ligne n'était jamais créée dans `subscriptions` à la création d'une
-- famille : le seul écrivain était le webhook de paiement. Or `isLocked(null)`
-- rend `false` — une famille sans ligne avait donc un accès complet, gratuit,
-- pour toujours. Le compte à rebours des 30 jours ne démarrait jamais, et rien
-- ne se fermait jamais.
--
-- Le site, les CGV et la FAQ promettent tous les trois « 30 jours d'essai puis
-- 9,90 € ». Le produit promettait 30 jours et donnait l'infini.
--
-- Deuxième conséquence, qui confirme le diagnostic : `billing` allonge l'essai
-- du filleul en modifiant une ligne `trialing` existante. Sans ligne, le
-- parrainage n'accordait rien non plus.
--
-- **Ici et pas dans le client.** Une famille qui pourrait écrire son propre
-- statut le ferait, et la table n'a d'ailleurs aucune politique d'écriture :
-- avec RLS active et aucune politique, tout est refusé. Le déclencheur est
-- `security definer`, donc il s'exécute avec les droits du propriétaire de la
-- table — c'est la seule façon d'écrire cette ligne sans ouvrir la porte à qui
-- que ce soit d'autre.
-- =====================================================================

/**
 * 30 jours, et le nombre est écrit deux fois.
 *
 * `TRIAL_DAYS` dans `src/domain/billing.ts` décide de ce que l'application
 * affiche ; celui-ci décide de ce qui est vrai. Un test les compare —
 * `__tests__/billing.test.ts` — parce que deux nombres qui doivent être égaux
 * et qui vivent dans deux fichiers finissent toujours par diverger.
 */
create or replace function start_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into subscriptions (family_id, status, trial_ends_at)
  values (new.id, 'trialing', new.created_at + interval '30 days')
  on conflict (family_id) do nothing;
  return new;
end $$;

drop trigger if exists families_start_trial on families;
create trigger families_start_trial
  after insert on families
  for each row execute function start_trial();

/**
 * Les familles déjà créées, qui n'ont jamais eu d'essai.
 *
 * Leur compte à rebours part de leur inscription, pas d'aujourd'hui : c'est ce
 * que la promesse dit — trente jours à partir du moment où l'on s'inscrit. Une
 * famille inscrite il y a plus de trente jours se retrouve donc expirée
 * immédiatement, et c'est correct : elle a eu son essai, elle ne l'a
 * simplement jamais vu s'écouler.
 *
 * `on conflict do nothing` : une famille qui a déjà payé garde sa ligne.
 */
insert into subscriptions (family_id, status, trial_ends_at)
select f.id, 'trialing', f.created_at + interval '30 days'
from families f
left join subscriptions s on s.family_id = f.id
where s.family_id is null
on conflict (family_id) do nothing;


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
      and s.status in ('active', 'past_due', 'offert')
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
 * Planifiée dans `supabase/planification.sql`, à coller une fois sur le
 * projet. Une politique de conservation qui n'est écrite que dans un document
 * n'est pas une politique de conservation — et celle-ci ne l'a été que dans un
 * document jusqu'au 9 septembre 2026, alors que la politique de
 * confidentialité publiée annonçait déjà l'effacement à trente jours.
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

-- Planifié dans `supabase/planification.sql`, à coller une fois sur le projet.
--
-- Dans cet ordre et à quinze minutes d'intervalle : le repli du grand livre
-- doit avoir eu lieu avant qu'on efface les missions auxquelles ses lignes
-- faisaient référence. La planification vit à part parce que pg_cron s'active
-- par projet, et qu'elle est un acte d'exploitation, pas une définition de
-- schéma — mais elle vit désormais quelque part, ce qui n'était pas le cas :
-- ces deux tâches sont restées en commentaire, donc jamais exécutées.
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


-- ---------------------------------------------------------------------
-- compte.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- Mino — quitter
--
-- À appliquer APRÈS schema.sql. Un seul sujet : permettre à un parent de
-- s'en aller pour de bon, et que « pour de bon » soit vrai.
--
-- Trois raisons, et chacune suffirait :
--
--   1. La FAQ le promet déjà, mot pour mot : « Depuis Réglages, "Supprimer le
--      compte". Tout est effacé sous trente jours. » Une promesse écrite dans
--      le produit et absente du produit est un mensonge, pas un manque.
--
--   2. Apple l'exige. Règle 5.1.1(v) : une application qui permet de créer un
--      compte doit permettre de le supprimer, depuis l'application, sans
--      écrire à personne. Une application qui ne le fait pas est refusée —
--      pas commentée, refusée.
--
--   3. Le RGPD, article 17. Le droit à l'effacement ne se satisfait pas d'une
--      adresse e-mail à qui écrire.
--
-- POURQUOI DU SQL ET PAS DU JAVASCRIPT. Supprimer une ligne de `auth.users`
-- demande des droits que l'application n'a pas et ne doit jamais avoir : la
-- clé `service_role` passe outre toutes les règles RLS et donnerait, si elle
-- fuitait d'un téléphone, accès aux enfants de toutes les familles. Cette
-- fonction est `security definer` : elle s'exécute avec les droits de son
-- propriétaire, mais elle ne connaît qu'un seul compte — celui qui appelle,
-- lu dans `auth.uid()` et jamais reçu en paramètre. Il n'y a donc rien à
-- falsifier.
--
-- Appliquer avec :  npm run db:push   (ou coller dans l'éditeur SQL)
-- =====================================================================

-- ------------------------------------------------------------ supprimer

/**
 * Effacer le compte qui appelle, et la famille s'il en était le dernier parent.
 *
 * L'ordre compte, et il n'est pas celui qu'on écrirait d'instinct.
 *
 * On supprime la FAMILLE d'abord, la ligne `auth.users` ensuite. En sens
 * inverse, la cascade de `parents.user_id` emporterait la ligne `parents`
 * avant qu'on ait pu lire à quelle famille elle appartenait — et la famille
 * resterait là, avec ses enfants, ses missions et son grand livre, rattachée à
 * personne et lisible par personne. C'est-à-dire indestructible.
 *
 * Le cas à deux parents est traité à part, et il n'est pas symétrique : si un
 * autre parent reste, la famille ne lui appartient pas moins qu'avant. On
 * retire le partant, on ne touche pas aux enfants. Un parent qui s'en va n'a
 * pas le pouvoir d'effacer les données de l'autre.
 *
 * Ce que la fonction NE supprime PAS, et pourquoi :
 *
 *   - les factures. Elles ne sont pas ici : elles vivent chez Stripe, Apple ou
 *     Google, qui les gardent dix ans comme la loi comptable l'exige. Elles ne
 *     contiennent aucune donnée d'enfant — un montant, une date, une adresse
 *     de facturation d'adulte. C'est exactement ce que dit la FAQ.
 *
 *   - l'abonnement lui-même. Supprimer le compte n'annule pas un prélèvement
 *     en cours chez Apple : seul Apple le peut, et l'écran d'avertissement le
 *     dit avant de demander confirmation. Prétendre le contraire depuis le SQL
 *     serait la pire des deux erreurs possibles.
 *
 * Rend le nombre de familles effacées : 0 si le parent en quitte une où
 * quelqu'un reste, 1 dans le cas courant.
 */
create or replace function delete_my_account()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  moi        uuid := auth.uid();
  effacees   integer := 0;
  fam        text;
begin
  if moi is null then
    raise exception 'Aucune session' using errcode = '42501';
  end if;

  -- Un appareil enfant appairé porte lui aussi le rôle `authenticated` — c'est
  -- une session anonyme, pas un rôle à part. Sans cette ligne, la fonction lui
  -- serait ouverte : la boucle ne trouverait aucune famille, mais le `delete
  -- from auth.users` plus bas emporterait son identité, et l'appareil se
  -- désappairerait tout seul. Un enfant n'a pas ce pouvoir-là.
  if not exists (select 1 from parents where user_id = moi) then
    raise exception 'Seul un parent peut supprimer un compte' using errcode = '42501';
  end if;

  -- Une famille à la fois : un parent peut en théorie en avoir plusieurs, et
  -- la règle du dernier parent se décide famille par famille.
  for fam in select family_id from parents where user_id = moi loop
    if (select count(*) from parents where family_id = fam) <= 1 then
      -- Dernier parent : la famille part avec lui. Tout le reste — enfants,
      -- missions, grand livre, sessions, appareils, abonnement, parrainages —
      -- pend à `families.id` par des clés étrangères `on delete cascade`. Une
      -- seule ligne à supprimer, et rien ne survit.
      delete from families where id = fam;
      effacees := effacees + 1;
    else
      delete from parents where family_id = fam and user_id = moi;
    end if;
  end loop;

  -- Puis l'identité elle-même. La cascade emporte ce qui restait accroché à
  -- l'utilisateur : `parent_secrets` (le code parent), `family_devices`, et la
  -- ligne `parents` dans le cas à deux parents traité ci-dessus.
  delete from auth.users where id = moi;

  return effacees;
end;
$$;

comment on function delete_my_account() is
  'Efface le compte appelant et, s''il en était le dernier parent, sa famille entière. Ne prend aucun paramètre : le compte visé est toujours auth.uid().';

-- Aucun paramètre à falsifier, mais la porte se ferme quand même côté anonyme :
-- une session doit exister pour que `auth.uid()` rende autre chose que null,
-- et un appareil enfant appairé n'est pas un parent — il ne trouvera aucune
-- ligne `parents` à son nom et n'effacera donc rien.
revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;


-- ---------------------------------------------------------------------
-- notifications.sql
-- ---------------------------------------------------------------------

/**
 * Prévenir l'autre bout de la boucle, quand l'application est fermée.
 *
 * Mino savait déjà quoi dire et quand : `domain/notifications.ts` porte les
 * textes, les règles de silence et les deux publics. Mais tout partait
 * **localement**, sur l'appareil qui venait d'agir — c'est-à-dire à la seule
 * personne qui était déjà au courant.
 *
 * Concrètement : un enfant termine une mission à 19 h, le parent ne l'apprend
 * qu'en rouvrant Mino. Le parent valide à 21 h, l'enfant ne le découvre que le
 * lendemain matin. Or la boucle ne tient que si les deux bouts l'entendent :
 * un enfant qui attend jusqu'au lendemain cesse de relier l'effort à la
 * récompense, et c'est précisément la chose que ce produit existe pour relier.
 *
 * Une table, et rien de plus. `family_devices` sait déjà quel enfant un
 * appareil affiche, `parents` sait déjà qui est parent : il n'y a donc aucune
 * notion de rôle à dupliquer ici. Un jeton, une famille, un compte.
 */

create table if not exists push_tokens (
  -- Un compte, un appareil. Un parent qui installe Mino sur un second
  -- téléphone ouvre une seconde session, donc une seconde ligne.
  user_id    uuid primary key references auth.users (id) on delete cascade,
  family_id  text not null references families (id) on delete cascade,
  -- Le jeton d'Expo, pas celui d'Apple : c'est le service d'Expo qui parle à
  -- APNs, et c'est lui qui détient la clé.
  token      text not null,
  updated_at timestamptz not null default now()
);

/**
 * ------------------------------------------- à qui est cet appareil, côté serveur
 *
 * **Le défaut que cela répare, relevé sur une vraie tablette.** Un parent
 * valide une mission depuis l'espace parent, et la notification « Raphaël a
 * terminé sa mission » s'affiche sur la tablette — celle que Raphaël tient.
 * Du point de vue du serveur, c'était correct : la famille a été créée sur cet
 * appareil, le compte est donc un compte parent, et les notifications de
 * parents lui reviennent. Il avait raison sur le compte et tort sur la
 * situation.
 *
 * L'inscription pose pourtant la question — « à qui est cet appareil ? » — et
 * la réponse était gardée dans le téléphone, en `AsyncStorage`, sans jamais
 * remonter. `family_devices`, lui, ne connaît que les appareils arrivés par
 * code famille : celui sur lequel la famille est née n'y figure pas.
 *
 * Trois valeurs, et elles viennent mot pour mot des trois cartes de
 * l'inscription :
 *
 *   • `enfant`  — « il est à Raphaël ». Aucune notification de parent, jamais.
 *   • `partage` — « il est partagé à la maison ». La tablette du salon.
 *   • `parent`  — « c'est mon téléphone à moi ».
 *
 * **Volontairement sans contrainte de liste.** Ce matin même, `report_shield`
 * a refusé un statut légitime parce qu'il validait contre une liste fermée
 * qu'un nouvel état venait de dépasser — et comme l'appelant avale l'erreur,
 * l'appareil se contentait de cesser de donner de ses nouvelles. On ne
 * refera pas la même chose ici. Une valeur inconnue est traitée comme
 * inconnue par `notify`, qui ne l'exclut de rien : on n'agit que sur ce qu'on
 * sait vraiment.
 *
 * `null` a le même sens, et il compte : c'est ce que portent toutes les lignes
 * écrites avant cette colonne. Une application pas encore mise à jour continue
 * donc de recevoir exactement ce qu'elle recevait.
 */
alter table push_tokens add column if not exists usage text;

-- L'envoi lit toujours par famille, jamais par compte.
create index if not exists idx_push_tokens_family on push_tokens (family_id);

alter table push_tokens enable row level security;

/**
 * CHACUN NE VOIT QUE LE SIEN — pas ceux de sa famille, pas ceux de ses enfants.
 *
 * Un jeton de notification est une adresse d'appareil : qui l'obtient peut
 * écrire à l'appareil d'un enfant, avec le texte de son choix. Il n'y a aucune
 * raison qu'un client lise ceux des autres. Seule la fonction serveur `notify`,
 * qui tourne avec la clé de service, les consulte tous.
 *
 * **Pourquoi une politique de lecture existe quand même**, alors que l'intention
 * était « personne » : `insert … on conflict do update` doit LIRE la ligne en
 * conflit pour savoir qu'il y en a une. Sans politique de lecture, elle est
 * invisible, la fusion se croit neuve, et PostgreSQL refuse — « new row violates
 * row-level security policy », sur une ligne pourtant parfaitement légitime.
 *
 * Le client réécrit son jeton à chaque démarrage, donc la fusion est le chemin
 * normal. Lire son propre jeton ne révèle rien : c'est lui qui vient de
 * l'écrire.
 */
drop policy if exists push_tokens_select on push_tokens;
create policy push_tokens_select on push_tokens
  for select using (user_id = auth.uid());

drop policy if exists push_tokens_insert on push_tokens;
create policy push_tokens_insert on push_tokens
  for insert with check (
    user_id = auth.uid()
    and family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[]))
  );

/**
 * La mise à jour existe pour une seule raison, et elle n'est pas théorique :
 * un jeton d'appareil change. Après une réinstallation, une restauration de
 * sauvegarde, parfois une mise à jour d'iOS. Le client réécrit donc le sien à
 * chaque démarrage, par une fusion.
 *
 * Les deux politiques sont nécessaires **ensemble** : `insert … on conflict do
 * update` fait appliquer par PostgreSQL la clause de la politique de MISE À
 * JOUR à la ligne neuve. Une seule des deux, et la fusion échoue — c'est
 * exactement le défaut qui empêchait de créer une famille.
 */
drop policy if exists push_tokens_update on push_tokens;
create policy push_tokens_update on push_tokens
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[]))
  );

-- Se déconnecter, c'est cesser de recevoir. Sans cela, le téléphone revendu
-- continuerait d'être prévenu des missions d'une famille qui n'est plus la
-- sienne.
drop policy if exists push_tokens_delete on push_tokens;
create policy push_tokens_delete on push_tokens
  for delete using (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- courrier.sql
-- ---------------------------------------------------------------------

/**
 * Ce que Mino a déjà écrit à chaque famille.
 *
 * **Le défaut que cette table empêche.** Un rappel envoyé deux fois est pire
 * qu'un rappel manqué : il dit au parent que personne ne tient les comptes
 * chez nous, à l'instant précis où on lui parle d'argent. Or les messages du
 * cycle de vie se déclenchent depuis plusieurs endroits — l'application après
 * l'inscription, une tâche planifiée pour les échéances — et rien ne garantit
 * qu'aucun ne se rejoue : un réseau qui hoquette, une fonction qui reprend, un
 * parent qui rouvre l'application au mauvais moment.
 *
 * La clé primaire porte donc la famille ET le genre du message. Ce n'est pas
 * une condition qu'on pourrait oublier d'écrire dans le code : c'est la base
 * qui refuse.
 *
 * Aucune politique de lecture n'est ouverte. Cette table ne sert qu'à la
 * fonction `courrier`, qui parle avec la clé de service ; personne d'autre n'a
 * de raison de savoir ce qu'on a écrit à qui, et surtout pas depuis un
 * appareil.
 */
create table if not exists courriers (
  family_id  text not null references families (id) on delete cascade,
  -- 'bienvenue', 'fin_essai', 'reconduction' — la liste vit dans la fonction,
  -- pas ici : une contrainte `check` obligerait à migrer la base à chaque
  -- message ajouté, pour une valeur qu'aucun client ne choisit librement.
  genre      text not null,
  sent_at    timestamptz not null default now(),
  primary key (family_id, genre)
);

alter table courriers enable row level security;

-- Volontairement sans politique : aucune n'existe, donc personne ne lit ni
-- n'écrit cette table à travers l'API. Seule la clé de service y accède, et
-- elle contourne RLS par construction.


-- ---------------------------------------------------------------------
-- code-parent-famille.sql
-- ---------------------------------------------------------------------

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


-- ---------------------------------------------------------------------
-- deux-parents.sql
-- ---------------------------------------------------------------------

/**
 * Deux parents dans une famille — et un seul compte.
 *
 * Le second parent rejoint avec le CODE FAMILLE, comme le reste de la maison.
 * Sa ligne `parents` porte le `user_id` de SON appareil — c'est ce qui en fait
 * un parent aux yeux de `auth_is_parent()`, donc quelqu'un qui peut créer une
 * mission et pas seulement les regarder — mais elle n'a pas d'`email` : c'est
 * un parent, pas un compte. Le schéma le prévoyait déjà — « un parent qui n'a pas encore donné
 * son adresse n'en a pas, `null` le dit » — mais une seule fonction comptait
 * les parents sans faire la différence, et cette différence coûte la famille
 * entière.
 *
 * L'insertion elle-même ne passe pas par ici : `parents_insert` exige
 * `user_id = auth.uid()`, et il n'est pas question d'y toucher — c'est cette
 * clause qui empêche la tablette d'un enfant de se déclarer parent. La
 * fonction Edge `ajouter-parent` écrit la ligne avec la clé de service, après
 * avoir vérifié le code à quatre chiffres.
 *
 * À appliquer après `compte.sql`, dont il corrige une fonction.
 */

-- ------------------------------------------------------- supprimer (corrigé)

/**
 * Le défaut, et il rendait une famille indestructible.
 *
 * `delete_my_account()` décidait d'effacer la famille ou d'en retirer le
 * partant en comptant les lignes de `parents`. La règle est bonne — « si un
 * autre parent reste, la famille ne lui appartient pas moins qu'avant » — mais
 * elle a été écrite quand toute ligne `parents` portait un compte.
 *
 * Avec un second parent, le compte à deux devenait faux : le titulaire du
 * compte partait, sa ligne était supprimée, et la famille restait — avec ses
 * enfants, son historique et son abonnement — rattachée à quelqu'un qui ne
 * peut pas se reconnecter. Plus aucune session ne pouvait la rouvrir depuis un
 * autre téléphone, et plus aucune ne pouvait l'effacer. C'est-à-dire exactement
 * l'état que le commentaire d'origine décrivait comme celui à ne jamais
 * produire, et un refus de suppression au sens du RGPD comme de la règle
 * 5.1.1(v) d'Apple.
 *
 * **On compte les ADRESSES, et pas les `user_id`.** La nuance est tout le
 * correctif, et elle a failli m'échapper deux fois. Le second parent PORTE un
 * `user_id` — celui de son téléphone, c'est ce qui lui donne ses droits — mais
 * cette identité-là est anonyme : elle vit dans l'application installée sur cet
 * appareil, et rien ne permet de la retrouver ailleurs. Un téléphone reformaté,
 * et la famille serait perdue pour tout le monde. Ce qui permet de revenir,
 * c'est une adresse et un mot de passe. C'est donc cela qu'on compte.
 *
 * Un parent sans adresse ne survit pas à la famille : sa ligne pend à
 * `families.id` par une clé étrangère `on delete cascade`, et part avec elle.
 */
create or replace function delete_my_account()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  moi        uuid := auth.uid();
  effacees   integer := 0;
  fam        text;
begin
  if moi is null then
    raise exception 'Aucune session' using errcode = '42501';
  end if;

  /**
   * Un parent AVEC UNE ADRESSE, et la nuance est devenue vitale.
   *
   * La clause d'origine — « une ligne `parents` à mon nom » — suffisait tant
   * qu'être parent voulait dire avoir un compte. Depuis qu'un second parent
   * rejoint par le code famille et porte le `user_id` de son téléphone,
   * `auth_is_parent()` répond oui pour lui : il franchissait ce garde, la
   * boucle trouvait sa famille, le compte des adresses donnait 1, et la
   * FAMILLE ENTIÈRE partait — enfants, historique, abonnement — effacée par
   * quelqu'un qui n'en est pas le titulaire. Un enfant qui aurait vu le code à
   * quatre chiffres pouvait faire la même chose.
   *
   * Supprimer un compte demande d'en avoir un. Un second parent qui veut s'en
   * aller se retire depuis « Les parents », ce qui ne touche à rien d'autre.
   */
  if not exists (
    select 1 from parents where user_id = moi and email is not null
  ) then
    raise exception 'Seul le titulaire du compte peut le supprimer' using errcode = '42501';
  end if;

  for fam in select family_id from parents where user_id = moi loop
    -- `email is not null` : la clause entière tient dans ces trois mots.
    -- Un parent sans adresse ne peut pas hériter d'une famille, puisque
    -- personne ne peut s'y reconnecter depuis un autre appareil pour la
    -- reprendre. Compter les `user_id` aurait laissé la famille à une
    -- identité anonyme, c'est-à-dire à personne.
    if (
      select count(*) from parents where family_id = fam and email is not null
    ) <= 1 then
      delete from families where id = fam;
      effacees := effacees + 1;
    else
      delete from parents where family_id = fam and user_id = moi;
    end if;
  end loop;

  delete from auth.users where id = moi;

  return effacees;
end;
$$;

comment on function delete_my_account() is
  'Efface le compte appelant et, s''il en était le dernier parent AVEC UNE ADRESSE, sa famille entière. Un second parent sans adresse ne peut pas hériter d''une famille : son identité est celle de son téléphone, et rien ne permet de la retrouver ailleurs.';

revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
