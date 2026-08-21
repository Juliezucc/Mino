#!/usr/bin/env node
/**
 * Combien d'octets partent vraiment du serveur à chaque ouverture.
 *
 * `capacite.md` a longtemps annoncé « ~150 à 400 Ko par ouverture » et
 * « ~360 Go/mois à 10 000 familles ». C'était une estimation, et c'était le
 * chiffre qui décide du plan Supabase — donc le plus mauvais endroit où en
 * rester à une estimation.
 *
 * Ce script mesure. Il monte un PostgreSQL, y remplit quelques familles, puis
 * rejoue les onze requêtes de `load()` en sérialisant chaque réponse en JSON
 * comme le fait PostgREST, et compresse comme le fait tout serveur HTTP.
 *
 * Le résultat a changé l'ordre de grandeur : un journal de missions est le cas
 * idéal pour un compresseur — quatre cents lignes qui répètent les mêmes noms
 * de colonnes et les mêmes identifiants — et il se réduit d'un facteur trente.
 *
 * Usage : npm run test:trafic
 */

import { gzipSync, brotliCompressSync } from 'node:zlib';

import { announceMissing, BIN, startPostgres } from './pg.mjs';
import { SQL_FILES } from '../supabase/order.mjs';

if (!BIN) {
  announceMissing();
  process.exit(0);
}

const arg = (nom, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${nom}=`));
  return hit ? Number(hit.split('=')[1]) : def;
};

// Par défaut on observe la famille la plus lourde possible : trois ans
// d'ancienneté, les trois fenêtres au plafond de 400 lignes. Une famille jeune
// pèse moins — mesurer la moyenne ferait passer le pire pour le normal.
const jours = arg('jours-anciennes', 1095);
const ouvertures = arg('ouvertures', 6.6); // 3 par appareil et par jour, 2,2 appareils

const pg = startPostgres({ settings: { shared_buffers: '512MB', fsync: 'off' } });
const fail = (label, res) => {
  if (res.status === 0) return res;
  console.error(`${label} : refusé par PostgreSQL`);
  console.error(res.stderr || res.stdout);
  process.exit(1);
};

for (const f of ['supabase/test/harness.sql', ...SQL_FILES.map(([n]) => `supabase/${n}`)]) {
  fail(f, pg.file(f));
}

// Le déclencheur de diffusion n'a rien à faire pendant un remplissage.
pg.query(
  ['children', 'missions', 'mission_assignments', 'mission_completions',
   'screen_time_transactions', 'screen_time_sessions', 'devices']
    .map((t) => `alter table ${t} disable trigger mino_broadcast`).join('; '),
);

fail('remplissage', pg.file('supabase/test/volume.sql', {
  familles: 20, jours: 365, anciennes: 3, jours_anciennes: jours,
}));
fail('analyze', pg.query('vacuum analyze'));

const FAM = "'fam_m5k2p7q9' || lpad('1',6,'0')";

// Les onze requêtes de `src/data/supabaseRepository.ts`, dans le même ordre et
// avec les mêmes bornes.
const REQUETES = {
  'la famille':        `select * from families where id = ${FAM}`,
  'les parents':       `select * from parents where family_id = ${FAM}`,
  'les enfants':       `select * from children where family_id = ${FAM}`,
  'les missions':      `select * from missions where family_id = ${FAM}`,
  'les affectations':  `select a.* from mission_assignments a join children c on c.id = a.child_id where c.family_id = ${FAM}`,
  'les autres écrans': `select * from devices where family_id = ${FAM}`,
  'missions faites':   `select * from (select * from mission_completions where family_id = ${FAM} and completed_at >= now() - interval '90 days' order by completed_at desc limit 400) t`,
  'en attente':        `select * from mission_completions where family_id = ${FAM} and status = 'pending'`,
  'grand livre':       `select * from (select * from screen_time_transactions where family_id = ${FAM} and created_at >= now() - interval '90 days' order by created_at desc limit 400) t`,
  'sessions':          `select * from (select * from screen_time_sessions where family_id = ${FAM} and started_at >= now() - interval '90 days' order by started_at desc limit 400) t`,
  'écrans en cours':   `select * from screen_time_sessions where family_id = ${FAM} and status in ('running','requested')`,
};

console.log(`\nUne ouverture, pour une famille de ${jours} jours d'ancienneté.\n`);
console.log('  requête              lignes      JSON');
console.log('  ' + '─'.repeat(43));

const morceaux = [];
for (const [nom, sql] of Object.entries(REQUETES)) {
  const json = fail(nom, pg.query(`select coalesce(json_agg(t)::text, '[]') from (${sql}) t`)).stdout.trim();
  const lignes = fail(nom, pg.query(`select count(*) from (${sql}) t`)).stdout.trim();
  morceaux.push(json);
  console.log(
    `  ${nom.padEnd(20)} ${lignes.padStart(6)} ${(Buffer.byteLength(json) / 1024).toFixed(1).padStart(9)} Ko`,
  );
}

const brut = Buffer.from(morceaux.join(''), 'utf8');
const gz = gzipSync(brut, { level: 6 });
const br = brotliCompressSync(brut);

console.log('  ' + '─'.repeat(43));
console.log(`  JSON brut                    ${(brut.length / 1024).toFixed(1).padStart(9)} Ko`);
console.log(`  gzip                         ${(gz.length / 1024).toFixed(1).padStart(9)} Ko   ${(brut.length / gz.length).toFixed(0)}×`);
console.log(`  brotli                       ${(br.length / 1024).toFixed(1).padStart(9)} Ko   ${(brut.length / br.length).toFixed(0)}×`);

const moisMo = (gz.length * ouvertures * 30) / 1024 / 1024;
console.log(`\n  À ${ouvertures} ouvertures par famille et par jour, réponses compressées :`);
console.log(`    par famille et par mois    ${moisMo.toFixed(1)} Mo`);
console.log(`    10 000 familles            ${((moisMo * 10000) / 1024).toFixed(0)} Go/mois`);

console.log(`
  Réserve : tout ceci suppose que la réponse voyage compressée. C'est le cas en
  pratique — les piles réseau d'iOS et d'Android annoncent \`gzip\` d'elles-mêmes
  — mais sur le vrai projet, il faut le vérifier une fois : l'en-tête
  \`content-encoding\` d'une réponse réelle. Sans compression, il faut lire la
  ligne « JSON brut » et multiplier par trente.`);

pg.stop();
