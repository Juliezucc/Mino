#!/usr/bin/env node
/**
 * Applique les six fichiers SQL sur la base Supabase, dans l'ordre.
 *
 * Écrit pour qu'appliquer le schéma ne soit jamais un geste manuel : coller
 * six fichiers dans l'éditeur SQL du tableau de bord, c'est se tromper d'ordre
 * une fois sur trois et ne pas savoir lequel a échoué.
 *
 * Usage :
 *   SUPABASE_DB_URL='postgresql://…' npm run db:push
 *
 * L'URL se trouve dans le tableau de bord Supabase, Project settings →
 * Database → Connection string → URI (celle qui contient le mot de passe de la
 * base, pas la clé anon). Elle ne doit jamais entrer dans le dépôt : le script
 * ne la lit que dans l'environnement, et n'en garde rien.
 *
 * `--dry-run` affiche ce qui serait appliqué sans rien écrire.
 *
 * Avant de pousser quoi que ce soit, `npm run test:sql` rejoue exactement la
 * même séquence sur une base jetable. Un fichier qui casse là casse ici.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { SQL_FILES } from '../supabase/order.mjs';

const url = process.env.SUPABASE_DB_URL;
const dryRun = process.argv.includes('--dry-run');

if (!url && !dryRun) {
  console.error('SUPABASE_DB_URL manquante.');
  console.error('');
  console.error("Tableau de bord Supabase → Project settings → Database →");
  console.error('Connection string → URI. Puis :');
  console.error("");
  console.error("  SUPABASE_DB_URL='postgresql://…' npm run db:push");
  console.error('');
  console.error('Pour voir ce qui serait appliqué : npm run db:push -- --dry-run');
  process.exit(1);
}

const PSQL = ['/usr/lib/postgresql/16/bin/psql', '/usr/lib/postgresql/15/bin/psql', 'psql'].find(
  (p) => p === 'psql' || existsSync(p),
);

console.log(dryRun ? 'Simulation — rien ne sera écrit.\n' : 'Application sur la base distante.\n');

for (const [name, what] of SQL_FILES) {
  const file = join('supabase', name);
  if (!existsSync(file)) {
    console.error(`${name} : introuvable`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`  ${name.padEnd(15)} ${what}`);
    continue;
  }

  process.stdout.write(`  ${name.padEnd(15)} `);
  // Une transaction par fichier : un fichier passe entièrement ou pas du tout.
  // À moitié appliqué, un fichier laisse des politiques sans les contraintes
  // qui les rendent vraies — c'est le pire des trois états possibles.
  const out = spawnSync(PSQL, [url, '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-q', '-f', file], {
    encoding: 'utf8',
  });

  const errors = `${out.stderr}`.split('\n').filter((l) => l.includes('ERROR'));
  if (out.status !== 0 || errors.length) {
    console.log('refusé');
    console.error(`\n${errors.join('\n') || out.stderr || out.error?.message}`);
    console.error(`\nRien n'a été appliqué depuis ${name}. Les fichiers précédents, si.`);
    process.exit(1);
  }
  console.log(`appliqué · ${what}`);
}

if (dryRun) {
  // Compté, jamais écrit en toutes lettres : le message annonçait « six
  // fichiers » alors que la liste en compte dix depuis longtemps. Un nombre
  // en dur dans une phrase est un mensonge à retardement.
  console.log(
    `\nAvec SUPABASE_DB_URL définie, ces ${SQL_FILES.length} fichiers seraient appliqués dans cet ordre.`,
  );
} else {
  console.log('\nBase à jour.');
}
