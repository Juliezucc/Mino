/**
 * Ce que coûte réellement une ouverture de l'application.
 *
 * Les requêtes ci-dessous sont celles de `src/data/supabaseRepository.ts`,
 * recopiées une à une : c'est ce que `load()` demande à la base, dans le même
 * ordre, avec les mêmes bornes. Elles sont exécutées sous le rôle
 * `authenticated` avec un utilisateur posé, donc **avec la RLS active** — une
 * mesure faite en tant que propriétaire de la base ne mesurerait rien de ce
 * qui tourne en production.
 *
 * Paramètre (psql -v) : `famille` — le numéro de la famille observée. On
 * mesure une famille ancienne, celle dont le grand livre est le plus long,
 * pas une famille moyenne.
 *
 * Voir `scripts/load-test.mjs`, qui monte la base, la remplit et appelle ceci.
 */

-- Rien de ce qui suit n'est un résultat : ce qui compte finit dans
-- `bench_runs` et sort tout en bas.
\o /dev/null

select set_config('mino.famille', :'famille', false);
-- Quelles requêtes rejouer : tout par défaut, les seuls journaux pour la
-- comparaison sans index.
select set_config('mino.rang_min', :'rang_min', false);
select set_config('mino.rang_max', :'rang_max', false);

drop table if exists bench_runs;
create table bench_runs (
  rang  int,
  label text,
  ms    double precision
);

create sequence if not exists bench_seq;

/**
 * Une requête, jouée `runs` fois, chaque durée conservée.
 *
 * `security invoker` — sans quoi la fonction s'exécuterait avec les droits de
 * son propriétaire et passerait à côté de toute la RLS, c'est-à-dire à côté du
 * sujet.
 */
create or replace function bench(p_rang int, p_label text, p_sql text, p_runs int default 25)
returns void
language plpgsql
as $$
declare
  t0 timestamptz;
  i  int;
begin
  -- La comparaison « avec index / sans index » ne rejoue que les journaux :
  -- sans index, un parcours complet de trente millions de lignes vingt-cinq
  -- fois de suite mesure surtout la patience de qui regarde.
  if p_rang < coalesce(nullif(current_setting('mino.rang_min', true), ''), '0')::int then return; end if;
  if p_rang > coalesce(nullif(current_setting('mino.rang_max', true), ''), '99')::int then return; end if;

  for i in 1..p_runs loop
    t0 := clock_timestamp();
    execute p_sql;
    insert into bench_runs values (p_rang, p_label, extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
end;
$$;

set role authenticated;
select set_config('mino.uid',
  '00000000-0000-0000-0000-' || lpad(current_setting('mino.famille'), 12, '0'), false);

-- --------------------------------------------------- l'ouverture, en entier

-- Premier lot : ce que l'application demande d'abord, en parallèle.
select bench(1, 'la famille', 'select * from families limit 1', :runs);
select bench(2, 'les parents', 'select * from parents', :runs);
select bench(3, 'les enfants', 'select * from children', :runs);
select bench(4, 'les missions', 'select * from missions', :runs);
select bench(5, 'les affectations', 'select * from mission_assignments', :runs);
select bench(6, 'les autres écrans', 'select * from devices', :runs);

-- Second lot : les journaux, bornés à 120 jours et 400 lignes.
select bench(7, 'missions faites (120 j, 400 max)', $q$
  select * from mission_completions
  where completed_at >= now() - interval '120 days'
  order by completed_at desc limit 400
$q$, :runs);

select bench(8, 'ce qui attend le parent', $q$
  select * from mission_completions where status = 'pending'
$q$, :runs);

select bench(9, 'grand livre (120 j, 400 max)', $q$
  select * from screen_time_transactions
  where created_at >= now() - interval '120 days'
  order by created_at desc limit 400
$q$, :runs);

select bench(10, 'sessions (120 j, 400 max)', $q$
  select * from screen_time_sessions
  where started_at >= now() - interval '120 days'
  order by started_at desc limit 400
$q$, :runs);

select bench(11, 'écrans en cours', $q$
  select * from screen_time_sessions where status in ('running', 'requested')
$q$, :runs);

select bench(12, 'solde exact (tout le grand livre)', 'select * from family_balances()', :runs);

-- ------------------------------------------------------------- l'écriture

-- Accorder un bonus : une ligne de plus dans le grand livre, la politique
-- d'écriture à franchir, et le déclencheur qui émet sur le canal de la
-- famille. C'est le chemin d'écriture le plus court du produit, donc le plus
-- honnête à mesurer.
select bench(13, 'accorder un bonus (écriture + canal)', $q$
  insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason, created_at)
  values ('bench_' || nextval('bench_seq'),
          'fam_m5k2p7q9' || lpad(current_setting('mino.famille'), 6, '0'),
          'child_m5k2p7q9' || lpad(current_setting('mino.famille'), 5, '0') || '1',
          15, 'bonus', 'Coup de main', now())
$q$, :runs);

\o
reset role;

-- ------------------------------------------------------------- le relevé

\echo ''
\echo '── Durées mesurées, en millisecondes ──'
select
  lpad(rang::text, 2) as n,
  rpad(label, 38)     as requete,
  round(percentile_cont(0.5)  within group (order by ms)::numeric, 2) as p50,
  round(percentile_cont(0.95) within group (order by ms)::numeric, 2) as p95,
  round(max(ms)::numeric, 2) as pire
from bench_runs
group by rang, label
order by rang;

\echo ''
\echo '── L''ouverture complète ──'
select
  round(sum(p50)::numeric, 1) as "travail total (ms)",
  round(coalesce(max(p50) filter (where rang <= 6), 0)::numeric, 1)
    + round(coalesce(max(p50) filter (where rang between 7 and 12), 0)::numeric, 1)
      as "attente si parallèle (ms)"
from (
  select rang, percentile_cont(0.5) within group (order by ms) as p50
  from bench_runs where rang <= 12 group by rang
) t;
