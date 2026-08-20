#!/usr/bin/env node
/**
 * Exporte la base de connaissance vers le site et l'outil de support.
 *
 * Une réponse est écrite une fois, dans `src/content/faq.ts`, et publiée
 * partout depuis là. Trois copies d'une réponse, ce sont deux copies fausses au
 * bout de trois mois — et c'est le genre d'erreur qui coûte un SAV entier :
 * un parent lit sur le site que l'annulation prend deux touches, l'application
 * lui en demande quatre, il écrit.
 *
 * Usage :  node scripts/export-faq.mjs
 *
 * Produit :
 *   docs/support/faq.md    à publier sur le site (une section par catégorie)
 *   docs/support/faq.json  à importer dans l'outil de support (Crisp, Intercom…)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Node 22 sait effacer les types lui-même : le fichier de données est lu
// directement, sans étape de compilation à maintenir.
const { FAQ, FAQ_CATEGORIES } = await import(pathToFileURL('src/content/faq.ts').href);

const OUT = 'docs/support';
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ markdown */

const lines = [
  '# Questions fréquentes',
  '',
  '<!-- Généré par `node scripts/export-faq.mjs`. Ne pas modifier à la main :',
  '     la source est src/content/faq.ts, et c\'est elle que lit l\'application. -->',
  '',
];

for (const category of FAQ_CATEGORIES) {
  const entries = FAQ.filter((e) => e.category === category.id);
  if (entries.length === 0) continue;

  lines.push(`## ${category.icon} ${category.label}`, '');
  for (const entry of entries) {
    lines.push(`### ${entry.question}`, '', entry.answer, '');
  }
}

writeFileSync(`${OUT}/faq.md`, lines.join('\n'));

/* ---------------------------------------------------------------------- json */

const labels = Object.fromEntries(FAQ_CATEGORIES.map((c) => [c.id, c.label]));

writeFileSync(
  `${OUT}/faq.json`,
  JSON.stringify(
    {
      // Pas d'horodatage ici : il ferait apparaître une modification à chaque
      // exécution, et on ne verrait plus les vraies dans le diff.
      source: 'src/content/faq.ts',
      locale: 'fr-FR',
      entries: FAQ.map((entry) => ({
        id: entry.id,
        title: entry.question,
        body: entry.answer,
        category: labels[entry.category] ?? entry.category,
        // Beaucoup d'outils de support s'en servent pour leur propre recherche.
        keywords: entry.keywords,
      })),
    },
    null,
    2,
  ) + '\n',
);

console.log(`${FAQ.length} réponses · ${OUT}/faq.md · ${OUT}/faq.json`);
