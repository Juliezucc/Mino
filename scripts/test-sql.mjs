#!/usr/bin/env node
/**
 * Applique `supabase/schema.sql` sur un PostgreSQL jetable, puis lui lance
 * `supabase/test/rls.sql` dessus.
 *
 * Pourquoi un vrai serveur plutôt qu'une relecture : les deux premières fautes
 * trouvées ici — un index déclaré avant sa table, et une expression d'index mal
 * parenthésée — rendaient `supabase db push` impossible. Aucune n'était visible
 * à la lecture, et toutes deux emportaient la contrainte qui tient la
 * validation automatique.
 *
 * Il faut PostgreSQL installé localement (le paquet `postgresql`, pas un
 * serveur qui tourne : le script monte et démonte le sien). Sans lui, le script
 * le dit et sort en 0 — c'est une vérification de plus, pas une porte fermée.
 *
 * Usage : npm run test:sql
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BIN = ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/local/bin'].find(
  (dir) => existsSync(join(dir, 'initdb')),
);

if (!BIN) {
  console.log('PostgreSQL absent — schéma non vérifié.');
  console.log('Sur Debian/Ubuntu : sudo apt install postgresql');
  console.log('Sur macOS : brew install postgresql@16');
  process.exit(0);
}

// initdb refuse de tourner en root : sous CI comme en local on retombe sur le
// compte `postgres` quand il existe.
const asPostgres = process.getuid?.() === 0;
const run = (cmd, args, opts = {}) =>
  asPostgres
    ? execFileSync('su', ['postgres', '-c', [cmd, ...args].join(' ')], opts)
    : execFileSync(cmd, args, opts);

const dir = asPostgres
  ? mkdtempSync('/var/tmp/mino-sql-')
  : mkdtempSync(join(tmpdir(), 'mino-sql-'));
const data = join(dir, 'data');
let started = false;

const stop = () => {
  if (started) {
    try {
      run(`${BIN}/pg_ctl`, ['-D', data, '-m', 'immediate', 'stop'], { stdio: 'ignore' });
    } catch {
      /* le serveur est déjà tombé */
    }
  }
  rmSync(dir, { recursive: true, force: true });
};

process.on('exit', stop);

try {
  if (asPostgres) execFileSync('chown', ['-R', 'postgres', dir]);
  run(`${BIN}/initdb`, ['-D', data, '-A', 'trust'], { stdio: 'ignore' });
  // Socket dans le répertoire jetable, et pas de port TCP : le test n'entre
  // jamais en collision avec un PostgreSQL déjà installé sur la machine.
  run(`${BIN}/pg_ctl`, ['-D', data, '-l', join(dir, 'log'), '-o', `'-k ${dir} -h ""'`, 'start'], {
    stdio: 'ignore',
  });
  started = true;

  const psql = (file, db = 'mino') =>
    spawnSync(
      asPostgres ? 'su' : `${BIN}/psql`,
      asPostgres
        ? ['postgres', '-c', `${BIN}/psql -h ${dir} -d ${db} -v ON_ERROR_STOP=1 -q -f ${file}`]
        : ['-h', dir, '-d', db, '-v', 'ON_ERROR_STOP=1', '-q', '-f', file],
      { encoding: 'utf8' },
    );

  run(`${BIN}/createdb`, ['-h', dir, 'mino'], { stdio: 'ignore' });

  // Dans l'ordre d'application indiqué par docs/ARCHITECTURE.md : c'est
  // celui-là qu'on vérifie, pas un ordre commode.
  for (const [label, file] of [
    ['préalables Supabase', 'supabase/test/harness.sql'],
    ['schema.sql', 'supabase/schema.sql'],
    ['scale.sql', 'supabase/scale.sql'],
    ['support.sql', 'supabase/support.sql'],
    ['analytics.sql', 'supabase/analytics.sql'],
    ['store.sql', 'supabase/store.sql'],
    ['companion.sql', 'supabase/companion.sql'],
  ]) {
    const out = psql(file);
    const errors = `${out.stderr}`.split('\n').filter((l) => l.includes('ERROR'));
    if (out.status !== 0 || errors.length) {
      console.error(`${label} : refusé par PostgreSQL`);
      console.error(errors.join('\n') || out.stderr);
      process.exit(1);
    }
    console.log(`${label} : appliqué`);
  }

  const out = psql('supabase/test/rls.sql');
  const lines = `${out.stderr}`
    .split('\n')
    .filter((l) => l.includes('ok ·') || l.includes('ÉCHEC'))
    .map((l) => l.replace(/^.*NOTICE:\s+/, '').replace(/^.*ERROR:\s+/, '❌ '));
  console.log(lines.join('\n'));

  if (out.status !== 0) {
    console.error('\nUne tentative est passée. Voir ci-dessus.');
    process.exit(1);
  }
  console.log(`\n${lines.length} vérifications — toutes les tentatives repoussées.`);
} catch (error) {
  console.error(String(error.stderr || error.message));
  process.exit(1);
}
