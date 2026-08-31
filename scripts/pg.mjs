/**
 * Un PostgreSQL jetable, monté puis démonté par le script qui l'appelle.
 *
 * Deux scripts en ont besoin — `test-sql.mjs` pour rejouer les politiques,
 * `load-test.mjs` pour mesurer la charge — et la mécanique n'est pas
 * anodine : initdb refuse de tourner en root, la socket doit rester dans le
 * répertoire jetable pour ne pas entrer en collision avec un serveur déjà
 * installé, et le serveur doit tomber même quand le script échoue. Écrit deux
 * fois, cela aurait divergé une fois.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const BIN = [
  '/usr/lib/postgresql/18/bin',
  '/usr/lib/postgresql/17/bin',
  '/usr/lib/postgresql/16/bin',
  '/usr/lib/postgresql/15/bin',
  '/usr/local/bin',
  '/opt/homebrew/bin',
].find((dir) => existsSync(join(dir, 'initdb')));

/**
 * Ce qu'on dit quand le paquet manque.
 *
 * Sur une machine de développement, c'est une vérification de moins et pas une
 * porte fermée : on le dit et on sort en 0. En intégration continue, c'est
 * l'inverse — un `test:sql` qui passe parce que PostgreSQL n'est pas installé
 * est exactement le pire des résultats : le vert d'une vérification qui n'a
 * pas eu lieu. `MINO_REQUIRE_PG=1` fait donc échouer franchement.
 */
export function announceMissing() {
  const exige = process.env.MINO_REQUIRE_PG === '1';
  const dire = exige ? console.error : console.log;
  dire('PostgreSQL absent.');
  dire('Sur Debian/Ubuntu : sudo apt install postgresql');
  dire('Sur macOS : brew install postgresql@16');
  if (exige) {
    console.error('');
    console.error('MINO_REQUIRE_PG=1 : on refuse de rendre un vert qui ne prouve rien.');
    process.exit(1);
  }
}

/**
 * Monte un serveur et rend de quoi lui parler.
 *
 * `options` passe des paramètres à `postgres` (`shared_buffers`, etc.) : une
 * mesure de charge sur les réglages par défaut d'initdb mesure surtout les
 * réglages par défaut d'initdb.
 */
export function startPostgres({ db = 'mino', settings = {} } = {}) {
  if (!BIN) throw new Error('PostgreSQL absent');

  const asPostgres = process.getuid?.() === 0;
  const run = (cmd, args, opts = {}) =>
    asPostgres
      ? execFileSync('su', ['postgres', '-c', [cmd, ...args].join(' ')], opts)
      : execFileSync(cmd, args, opts);

  const dir = asPostgres ? mkdtempSync('/var/tmp/mino-sql-') : mkdtempSync(join(tmpdir(), 'mino-sql-'));
  const data = join(dir, 'data');
  let started = false;

  const stop = () => {
    if (started) {
      try {
        run(`${BIN}/pg_ctl`, ['-D', data, '-m', 'immediate', 'stop'], { stdio: 'ignore' });
      } catch {
        /* le serveur est déjà tombé */
      }
      started = false;
    }
    rmSync(dir, { recursive: true, force: true });
  };

  process.on('exit', stop);

  if (asPostgres) execFileSync('chown', ['-R', 'postgres', dir]);
  run(`${BIN}/initdb`, ['-D', data, '-A', 'trust'], { stdio: 'ignore' });

  const opts = ['-k ' + dir, '-h ""']
    .concat(Object.entries(settings).map(([k, v]) => `-c ${k}=${v}`))
    .join(' ');

  /**
   * Les apostrophes autour des options ne valent QUE pour le chemin `su`.
   *
   * `su … -c` reçoit une chaîne unique, remise à un shell : sans elles, les
   * options se découpent aux espaces. `execFileSync`, lui, passe chaque
   * argument tel quel — les apostrophes y restaient littérales, et `pg_ctl`
   * transmettait à `postgres` un unique argument `'-k /tmp/… -h ""'`,
   * apostrophes comprises. Le serveur refusait de démarrer.
   *
   * Ce défaut ne se voyait jamais en root, où l'on passe par `su` : c'est
   * exactement le cas de la machine qui l'a écrit. Sur le runner GitHub et sur
   * un Mac de développement, où l'on est un utilisateur ordinaire, `test:sql`
   * n'a donc jamais pu tourner — et la vérification la plus précieuse du
   * dépôt était rouge sans que personne ne lise pourquoi.
   */
  const optionsPourPgCtl = asPostgres ? `'${opts}'` : opts;

  try {
    run(`${BIN}/pg_ctl`, ['-D', data, '-l', join(dir, 'log'), '-o', optionsPourPgCtl, 'start'], {
      stdio: 'ignore',
    });
  } catch (error) {
    // `pg_ctl` écrit la vraie raison dans son journal, et nulle part ailleurs.
    // Sans ces quelques lignes, il ne restait que « Command failed » suivi de
    // la commande — de quoi chercher longtemps.
    console.error(String(error.message || error));
    try {
      console.error('\n--- journal de PostgreSQL ---');
      console.error(readFileSync(join(dir, 'log'), 'utf8'));
    } catch {
      console.error('(aucun journal : le serveur n\'a même pas été lancé)');
    }
    throw error;
  }
  started = true;

  // `su … -c` reçoit UNE chaîne passée au shell : tout ce qui y entre doit être
  // cité, sans quoi une requête contenant une espace se coupe en deux.
  const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
  const call = (args, opts = {}) =>
    spawnSync(
      asPostgres ? 'su' : `${BIN}/psql`,
      asPostgres
        ? ['postgres', '-c', [`${BIN}/psql`, '-h', dir, '-d', db, ...args].map(shq).join(' ')]
        : ['-h', dir, '-d', db, ...args],
      { encoding: 'utf8', ...opts },
    );

  run(`${BIN}/createdb`, ['-h', dir, db], { stdio: 'ignore' });

  return {
    dir,
    stop,
    /** Applique un fichier. `vars` alimente les `:variables` de psql. */
    file: (path, vars = {}) =>
      call([
        '-v',
        'ON_ERROR_STOP=1',
        '-q',
        ...Object.entries(vars).flatMap(([k, v]) => ['-v', `${k}=${v}`]),
        '-f',
        path,
      ]),
    /** Exécute une commande et rend sa sortie brute. */
    query: (text) => call(['-v', 'ON_ERROR_STOP=1', '-At', '-c', text]),
  };
}
