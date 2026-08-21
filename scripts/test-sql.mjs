#!/usr/bin/env node
/**
 * Applique les fichiers SQL du projet sur un PostgreSQL jetable, puis leur
 * lance les tests de `supabase/test/` dessus.
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

import { announceMissing, BIN, startPostgres } from './pg.mjs';
import { SQL_FILES } from '../supabase/order.mjs';

if (!BIN) {
  announceMissing();
  process.exit(0);
}

try {
  const pg = startPostgres();

  // Le même ordre que `db:push`, et depuis la même source : c'est
  // l'application réelle qu'on répète ici, pas une variante commode.
  const files = [
    ['préalables Supabase', 'supabase/test/harness.sql'],
    ...SQL_FILES.map(([name]) => [name, `supabase/${name}`]),
  ];

  const apply = (label, file, pass) => {
    const out = pg.file(file);
    const errors = `${out.stderr}`.split('\n').filter((l) => l.includes('ERROR'));
    if (out.status !== 0 || errors.length) {
      console.error(`${label} : refusé par PostgreSQL${pass === 2 ? ' à la deuxième passe' : ''}`);
      console.error(errors.join('\n') || out.stderr);
      process.exit(1);
    }
  };

  for (const [label, file] of files) {
    apply(label, file, 1);
    console.log(`${label} : appliqué`);
  }

  // Deuxième passe, sur la base déjà peuplée. C'est le cas réel : la première
  // application se fait sur une base vide une seule fois dans la vie du
  // produit, toutes les suivantes corrigent quelque chose. Deux politiques de
  // `companion.sql` se créaient sans se supprimer d'abord — la correction
  // était donc impossible à appliquer, et rien ne le disait.
  for (const [label, file] of files) apply(label, file, 2);
  console.log('réappliqués sur une base déjà en place : ok');

  const out = pg.file('supabase/test/rls.sql');
  const companion = pg.file('supabase/test/companion.sql');
  const realtime = pg.file('supabase/test/realtime.sql');
  // `plans.sql` doit venir après `rls.sql` : il se sert de la famille que
  // celui-ci a créée, et lui emprunte son parent.
  const plans = pg.file('supabase/test/plans.sql');
  const lines = `${out.stderr}${companion.stderr}${realtime.stderr}${plans.stderr}`
    .split('\n')
    .filter((l) => l.includes('ok ·') || l.includes('ÉCHEC'))
    .map((l) => l.replace(/^.*NOTICE:\s+/, '').replace(/^.*ERROR:\s+/, '❌ '));
  console.log(lines.join('\n'));

  if (out.status !== 0 || companion.status !== 0 || realtime.status !== 0 || plans.status !== 0) {
    console.error('\nUne tentative est passée. Voir ci-dessus.');
    process.exit(1);
  }
  console.log(`\n${lines.length} vérifications — toutes les tentatives repoussées.`);
} catch (error) {
  console.error(String(error.stderr || error.message));
  process.exit(1);
}
