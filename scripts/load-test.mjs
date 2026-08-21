#!/usr/bin/env node
/**
 * Un tir de charge, pour cesser de calculer ce qu'on peut mesurer.
 *
 * `docs/ops/capacite.md` annonçait des volumes et des coûts déduits du modèle
 * de données. Ce script monte un vrai PostgreSQL, y applique le schéma réel,
 * y écrit le volume annoncé — familles, enfants, missions, grand livre,
 * sessions — puis exécute les requêtes de `load()` **sous la RLS**, chronomètre
 * en main.
 *
 * Il fait aussi la seule chose qui prouve qu'un index sert : il l'enlève et
 * rejoue la même mesure.
 *
 * Usage :
 *   npm run test:charge                        # 1 000 familles, un an
 *   npm run test:charge -- --familles=10000    # le parc visé
 *   npm run test:charge -- --familles=10000 --jours=365 --anciennes=50
 *
 * Les mesures sont locales : ce sont des ordres de grandeur et surtout des
 * rapports (avec index / sans index, famille jeune / famille ancienne), pas une
 * promesse de latence chez Supabase. Le réglage du serveur est imprimé avec les
 * résultats, parce qu'une mesure sans son réglage ne veut rien dire.
 */

import { announceMissing, BIN, startPostgres } from './pg.mjs';
import { SQL_FILES } from '../supabase/order.mjs';

if (!BIN) {
  announceMissing();
  process.exit(0);
}

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : def;
};

const familles = arg('familles', 1000);
const jours = arg('jours', 365);
const anciennes = Math.min(arg('anciennes', 50), familles);
const joursAnciennes = arg('jours-anciennes', 1095);
const runs = arg('runs', 25);

// Un Supabase Pro modeste, pas les réglages d'initdb : `shared_buffers` à
// 128 Mo mesurerait surtout `shared_buffers` à 128 Mo.
const SETTINGS = {
  shared_buffers: '2GB',
  effective_cache_size: '6GB',
  work_mem: '16MB',
  maintenance_work_mem: '1GB',
  random_page_cost: '1.1',
  max_parallel_workers_per_gather: '2',
  fsync: 'off', // base jetable : on mesure des requêtes, pas ce disque-ci
  synchronous_commit: 'off',
};

const chrono = async (label, fn) => {
  const t0 = Date.now();
  const out = await fn();
  console.log(`   ${label} : ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return out;
};

const fail = (label, res) => {
  if (res.status === 0) return res;
  console.error(`${label} : refusé par PostgreSQL`);
  console.error(res.stderr || res.stdout);
  process.exit(1);
};

console.log(
  `Tir de charge : ${familles.toLocaleString('fr-FR')} familles, ${jours} jours ` +
    `(dont ${anciennes} à ${joursAnciennes} jours).`,
);
console.log(
  'Réglage du serveur : ' +
    Object.entries(SETTINGS)
      .map(([k, v]) => `${k}=${v}`)
      .join(', '),
);
console.log('');

const pg = startPostgres({ settings: SETTINGS });

// ------------------------------------------------------------------ schéma

console.log('1. Le schéma réel, dans l’ordre de `db:push`.');
for (const [label, file] of [
  ['préalables Supabase', 'supabase/test/harness.sql'],
  ...SQL_FILES.map(([name]) => [name, `supabase/${name}`]),
]) {
  fail(label, pg.file(file));
}
console.log('   appliqué.');

// -------------------------------------------------------------- remplissage

// Écrire soixante millions de lignes en maintenant huit index à jour prend
// plusieurs fois le temps de les écrire puis de reconstruire les index. C'est
// aussi ce que ferait n'importe quelle reprise de données.
const JOURNAUX = ['mission_completions', 'screen_time_transactions', 'screen_time_sessions'];
const indexes = fail(
  'index des journaux',
  pg.query(`select indexdef from pg_indexes
            where schemaname = 'public' and tablename in (${JOURNAUX.map((t) => `'${t}'`).join(',')})
              and indexname not like '%_pkey'`),
).stdout
  .trim()
  .split('\n')
  .filter(Boolean);

// Le déclencheur de diffusion écrit un message par ligne écrite. C'est
// exactement ce qu'il doit faire quand un enfant termine une mission, et
// exactement ce qu'il ne doit pas faire pendant qu'on rejoue une année
// d'historique en trois minutes : chez Supabase, `realtime.messages` est une
// table de passage, pas un an d'archives. On le coupe le temps du remplissage
// et on mesure son coût là où il a lieu — à l'écriture, rang 13.
const DIFFUSE = [
  'children', 'missions', 'mission_assignments', 'mission_completions',
  'screen_time_transactions', 'screen_time_sessions', 'devices',
];
const diffusion = (verbe) =>
  fail(`${verbe} du déclencheur`,
    pg.query(DIFFUSE.map((t) => `alter table ${t} ${verbe} trigger mino_broadcast`).join('; ')));

diffusion('disable');

fail(
  'retrait des index',
  pg.query(`do $$ declare r record; begin
    for r in select indexname from pg_indexes where schemaname='public'
      and tablename in (${JOURNAUX.map((t) => `'${t}'`).join(',')}) and indexname not like '%_pkey'
    loop execute format('drop index %I', r.indexname); end loop; end $$;`),
);

console.log(`\n2. Le volume de \`capacite.md\`, réellement écrit.`);
await chrono('écriture', async () =>
  fail(
    'remplissage',
    pg.file('supabase/test/volume.sql', {
      familles,
      jours,
      anciennes,
      jours_anciennes: joursAnciennes,
    }),
  ),
);

diffusion('enable');
fail('purge des messages', pg.query('truncate realtime.messages'));

// Les mêmes définitions, remises telles quelles : si le remplissage avait
// écrit deux validations de la même mission le même jour, l'index unique
// refuserait de se reconstruire, et c'est très bien ainsi.
await chrono('reconstruction des index', async () =>
  fail('reconstruction des index', pg.query(indexes.join('; '))),
);
await chrono('analyse', async () => fail('analyze', pg.query('vacuum analyze')));

const volumes = fail(
  'volumétrie',
  pg.query(`select relname,
                   to_char(n_live_tup, 'FM999 999 999') as lignes,
                   pg_size_pretty(pg_relation_size(relid)) as donnees,
                   pg_size_pretty(pg_indexes_size(relid)) as index,
                   pg_size_pretty(pg_total_relation_size(relid)) as total
            from pg_stat_user_tables
            where n_live_tup > 0 order by pg_total_relation_size(relid) desc`),
).stdout;

console.log('\n── Ce que pèse la base ──');
console.log(
  ['table', 'lignes', 'données', 'index', 'total']
    .map((h, i) => (i === 0 ? h.padEnd(26) : h.padStart(12)))
    .join(''),
);
for (const line of volumes.trim().split('\n')) {
  const [t, l, d, i, tot] = line.split('|');
  console.log(t.padEnd(26) + [l, d, i, tot].map((c) => c.padStart(12)).join(''));
}
console.log(
  '\n   base entière : ' + fail('taille', pg.query("select pg_size_pretty(pg_database_size('mino'))")).stdout.trim(),
);

// ------------------------------------------------------------------ mesures

console.log(`\n3. Une ouverture d’application, ${runs} fois, sous RLS.`);
console.log(`   Famille observée : la n° 1, ${joursAnciennes} jours d’ancienneté.`);
const mesure = fail('mesures', pg.file('supabase/test/bench.sql', { famille: 1, runs, rang_min: 0, rang_max: 99 }));
console.log(mesure.stdout);

// Une écriture = un message sur le canal de la famille, et un seul. C'est la
// promesse de `scale.sql` ; la compter coûte une requête.
const messages = fail('messages', pg.query('select count(*) from realtime.messages')).stdout.trim();
console.log(`   messages de diffusion émis par les ${runs} écritures : ${messages}\n`);

console.log('── Les plans, pour voir par où passe la base ──');
const plans = [
  ['grand livre (120 j, 400 max)', `select * from screen_time_transactions
     where created_at >= now() - interval '120 days' order by created_at desc limit 400`],
  ['solde exact', 'select * from family_balances()'],
  ['les affectations', 'select * from mission_assignments'],
];
for (const [label, sql] of plans) {
  const out = fail(
    label,
    pg.query(
      `set role authenticated;
       select set_config('mino.uid', '00000000-0000-0000-0000-000000000001', false);
       explain (analyze, buffers, costs off) ${sql};`,
    ),
  ).stdout;
  console.log(`\n· ${label}`);
  console.log(
    out
      .trim()
      .split('\n')
      .filter((l) => l && l !== 'SET' && !l.startsWith('00000000'))
      .map((l) => '  ' + l)
      .join('\n'),
  );
}

// ------------------------------------------- la même chose, index retirés

console.log('\n\n4. Les mêmes journaux, sans les index de journal de `scale.sql`.');
console.log("   C'est la seule façon de savoir si un index sert à quelque chose.");
const SCALE = [
  'idx_transactions_family',
  'idx_completions_family_recent',
  'idx_sessions_family',
  'idx_sessions_family_running',
];
fail('retrait', pg.query(SCALE.map((i) => `drop index ${i}`).join('; ')));

const sansIndex = fail(
  'mesures sans index',
  pg.file('supabase/test/bench.sql', {
    famille: 1,
    runs: Math.max(3, Math.min(runs, 5)),
    rang_min: 7,
    rang_max: 12,
  }),
);
console.log(sansIndex.stdout);

pg.stop();
