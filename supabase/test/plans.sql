/**
 * Les politiques laissent-elles encore la base se servir de ses index ?
 *
 * Ce fichier ne vérifie pas une frontière, il vérifie un CHEMIN. C'est
 * inhabituel pour un test, et c'est pourtant le défaut le plus cher qu'on ait
 * trouvé : écrite `family_id in (select auth_family_ids())`, une politique se
 * comporte exactement comme il faut — aucune famille ne voit l'autre — mais
 * oblige PostgreSQL à lire le grand livre de TOUT LE MONDE avant de jeter ce
 * qui ne la concerne pas. À mille familles, une ouverture d'application
 * demandait déjà une demi-seconde de base de données ; à dix mille, cinq.
 *
 * Rien ne l'aurait signalé : ni les tests, ni la relecture, ni l'usage à trois
 * familles. Seule la mesure l'a vu (`npm run test:charge`), et seule cette
 * vérification-ci empêchera qu'on le réintroduise en récrivant une politique
 * « proprement » un jour de ménage.
 *
 * La méthode : on interdit le parcours séquentiel, on demande le plan, et on
 * exige que la colonne de famille apparaisse dans la CONDITION D'INDEX. Si la
 * politique redevient un filtre, la condition ne mentionne plus la famille et
 * le test tombe — sans qu'il faille remplir la base de millions de lignes.
 *
 * Lancer avec `npm run test:sql`.
 */

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo 'Les index restent atteignables sous RLS'

/**
 * Exige que le plan d'une requête porte une condition d'index sur `colonne`.
 *
 * `explain (format json)` plutôt que le texte : le plan est alors un document
 * qu'on interroge, et non une page qu'on devine.
 */
create or replace function plan_uses_index(sql text, colonne text, quoi text)
returns void
language plpgsql
as $$
declare
  plan jsonb;
  conds text;
begin
  -- Sans cela, une base de test presque vide choisit le parcours séquentiel
  -- pour de bonnes raisons, et ne dirait rien de ce qu'on cherche à savoir.
  set local enable_seqscan = off;
  execute 'explain (format json) ' || sql into plan;

  select string_agg(value #>> '{}', ' ') into conds
  from jsonb_path_query(plan, '$.**."Index Cond"') as t(value);

  if conds is null or position(colonne in conds) = 0 then
    raise exception 'ÉCHEC — % : « % » n''est pas dans la condition d''index (%)',
      quoi, colonne, coalesce(conds, 'aucune condition d''index');
  end if;
  raise notice '  ok · %', quoi;
end $$;

/**
 * Et qu'aucune politique ne redevienne une sous-requête rejouée.
 *
 * `in (select …)` laisse dans le plan un « SubPlan » : la liste des familles y
 * est recalculée au lieu d'être connue d'avance, et c'est précisément ce qui
 * ferme l'index. La forme retenue ne laisse qu'un paramètre, `$0`. Cette
 * vérification-là vaut pour toutes les requêtes, y compris celles où l'index
 * choisi n'est pas celui de la famille.
 */
create or replace function plan_without_subplan(sql text, quoi text)
returns void
language plpgsql
as $$
declare plan jsonb;
begin
  set local enable_seqscan = off;
  execute 'explain (format json) ' || sql into plan;
  if plan::text like '%SubPlan%' then
    raise exception 'ÉCHEC — % : la liste des familles est recalculée (SubPlan)', quoi;
  end if;
  raise notice '  ok · %', quoi;
end $$;

set session role authenticated;
set session "mino.uid" = '11111111-1111-1111-1111-111111111111';

do $$ begin
  perform plan_uses_index(
    $sql$select * from screen_time_transactions
         where created_at >= now() - interval '120 days'
         order by created_at desc limit 400$sql$,
    'family_id',
    'le grand livre se lit par sa famille, pas en entier');

  perform plan_uses_index(
    $sql$select * from mission_completions
         where completed_at >= now() - interval '120 days'
         order by completed_at desc limit 400$sql$,
    'family_id',
    'les missions faites aussi');

  perform plan_uses_index(
    $sql$select * from screen_time_sessions
         where started_at >= now() - interval '120 days'
         order by started_at desc limit 400$sql$,
    'family_id',
    'les sessions aussi');

  -- Celle-ci passe par l'index partiel des demandes en attente, qui est déjà
  -- très sélectif : la famille y reste un filtre, mais un filtre sur un
  -- paramètre, pas sur une sous-requête. C'est la différence qui compte.
  perform plan_without_subplan(
    $sql$select * from mission_completions where status = 'pending'$sql$,
    'ce qui attend le parent ne recalcule pas la famille');

  -- La seule table sans `family_id` : elle passe par l'enfant, et il faut que
  -- ce chemin-là soit indexé lui aussi.
  perform plan_uses_index(
    $sql$select * from mission_assignments$sql$,
    'child_id',
    'les affectations se lisent par leurs enfants');

  perform plan_without_subplan(
    $sql$select * from screen_time_sessions where status in ('running', 'requested')$sql$,
    'les écrans en cours ne recalculent pas la famille');
  -- Un index PARTIEL ne sert que les requêtes qui répètent sa condition.
  -- `idx_missions_family` est posé `where archived = false` ; l'application
  -- demande toutes les missions de sa famille. Il fallait donc l'index sans
  -- condition, et cette vérification-ci le dit — c'est le même défaut que
  -- celui des affectations, trouvé au même endroit et de la même façon.
  perform plan_uses_index($sql$select * from missions$sql$,
    'family_id', 'les missions se lisent par leur famille');
  perform plan_uses_index($sql$select * from children$sql$,
    'family_id', 'les enfants aussi');
  perform plan_uses_index($sql$select * from devices$sql$,
    'family_id', 'les autres écrans aussi');
  perform plan_uses_index($sql$select * from parents$sql$,
    'family_id', 'les parents aussi');
end $$;

reset role;
