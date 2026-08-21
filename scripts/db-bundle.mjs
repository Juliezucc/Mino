#!/usr/bin/env node
/**
 * Les sept fichiers SQL réunis en un seul, à coller d'un bloc.
 *
 * `npm run db:push` reste la bonne façon de faire quand on a `psql` sous la
 * main. Mais sur une machine ordinaire on ne l'a pas, et la route qui marche
 * toujours est l'éditeur SQL du tableau de bord Supabase — où coller sept
 * fichiers dans le bon ordre est exactement le genre de geste qu'on rate une
 * fois sur trois.
 *
 * D'où ce fichier unique. Il est produit à partir de `order.mjs`, jamais écrit
 * à la main, et `--check` vérifie qu'il est à jour : un fichier SQL modifié
 * sans regénération ferait pousser en production autre chose que ce que le
 * dépôt contient, sans que rien ne le dise.
 *
 * Usage :
 *   npm run db:bundle           # (re)fabrique supabase/tout.sql
 *   npm run db:bundle -- --check   # sort en erreur s'il a dérivé
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { SQL_FILES } from '../supabase/order.mjs';

const CIBLE = 'supabase/tout.sql';

const entete = `-- =====================================================================
-- Mino — tout le schéma, en un seul fichier
--
-- NE PAS MODIFIER : produit par \`npm run db:bundle\` à partir des fichiers
-- listés dans \`supabase/order.mjs\`. Toute correction se fait dans le fichier
-- d'origine, puis on regénère.
--
-- À coller dans l'éditeur SQL de Supabase, en une fois. L'éditeur exécute
-- l'ensemble dans une seule transaction : soit tout passe, soit rien ne passe,
-- et il n'y a donc aucun état intermédiaire à rattraper.
--
-- Rejouable : appliquer ce fichier deux fois de suite ne casse rien. C'est
-- vérifié à chaque \`npm run test:sql\`.
--
-- Contenu, dans l'ordre :
${SQL_FILES.map(([n, quoi]) => `--   ${n.padEnd(14)} ${quoi}`).join('\n')}
-- =====================================================================

`;

const corps = SQL_FILES.map(([nom]) => {
  const barre = '-'.repeat(69);
  return `-- ${barre}\n-- ${nom}\n-- ${barre}\n\n${readFileSync(`supabase/${nom}`, 'utf8').trimEnd()}\n`;
}).join('\n\n');

const attendu = entete + corps;

if (process.argv.includes('--check')) {
  let actuel = '';
  try {
    actuel = readFileSync(CIBLE, 'utf8');
  } catch {
    /* absent : c'est une dérive comme une autre */
  }
  if (actuel !== attendu) {
    console.error(`${CIBLE} a dérivé des fichiers d'origine.`);
    console.error('Régénérer avec :  npm run db:bundle');
    process.exit(1);
  }
  console.log(`${CIBLE} : à jour`);
} else {
  writeFileSync(CIBLE, attendu);
  const lignes = attendu.split('\n').length;
  console.log(`${CIBLE} écrit — ${lignes.toLocaleString('fr-FR')} lignes, ${
    Math.round(attendu.length / 1024)
  } Ko.`);
  console.log("À coller d'un bloc dans l'éditeur SQL de Supabase.");
}
