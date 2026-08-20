#!/usr/bin/env node
/**
 * Recense les licences des bibliothèques utilisées.
 *
 * Deux raisons, et la seconde compte plus que la première.
 *
 * La première : une application vendue en Europe doit pouvoir dire de quoi elle
 * est faite, et certaines licences imposent une mention.
 *
 * La seconde : une licence contaminante (GPL, AGPL) dans les dépendances d'un
 * logiciel propriétaire est un problème juridique sérieux, et il se règle en dix
 * minutes le jour où il apparaît — contre plusieurs semaines de réécriture s'il
 * est découvert au moment d'une levée de fonds ou d'une cession. Ce script est
 * fait pour être relancé après chaque `npm install`.
 *
 * Usage :  npm run licences
 * Produit : docs/ops/dependances.md
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'node_modules';
const OUT = 'docs/ops';

/** Celles qui obligent à ouvrir le code d'un logiciel propriétaire. */
const CONTAMINANTES = ['GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0', 'SSPL', 'CC-BY-NC'];
/** Celles qui demandent une attention particulière sans être bloquantes. */
const A_SURVEILLER = ['LGPL', 'MPL-2.0', 'EPL', 'CDDL', 'CC-BY-SA'];

const contaminante = (terme) =>
  CONTAMINANTES.some((c) => terme.includes(c)) && !terme.includes('LGPL');

/**
 * Une licence double se lit comme un choix, pas comme une addition.
 *
 * `(BSD-3-Clause OR GPL-2.0)` veut dire « prenez celle que vous voulez » : on
 * prend BSD, et il n'y a pas de problème. Sans cette lecture, le rapport
 * signale une alerte à chaque exécution — et un rapport qui crie au loup finit
 * par n'être plus lu du tout, ce qui est pire que pas de rapport.
 */
const classe = (licence) => {
  if (!licence) return 'inconnue';

  const texte = String(licence);
  const options = texte
    .replace(/[()]/g, '')
    .split(/\s+OR\s+/i)
    .map((s) => s.trim());

  // Un seul choix acceptable suffit à rendre la dépendance acceptable.
  if (options.length > 1 && options.some((o) => !contaminante(o))) return 'ok';
  if (contaminante(texte)) return 'bloquante';
  if (A_SURVEILLER.some((c) => texte.includes(c))) return 'a surveiller';
  return 'ok';
};

/** Parcourt node_modules, y compris les paquets sous portée (@scope/nom). */
function* paquets(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;

    if (entry.name.startsWith('@')) {
      yield* paquets(join(dir, entry.name));
      continue;
    }

    const manifest = join(dir, entry.name, 'package.json');
    if (!existsSync(manifest)) continue;
    try {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      if (pkg.name) yield pkg;
    } catch {
      // Un paquet illisible n'est pas une raison d'échouer : il est simplement
      // signalé comme inconnu par son absence de la liste.
    }
  }
}

const manifests = new Map();
for (const pkg of paquets(ROOT)) manifests.set(pkg.name, pkg);

/**
 * Ce qui part réellement dans l'application, par opposition à ce qui sert à la
 * fabriquer.
 *
 * La distinction n'est pas cosmétique : une licence GPL n'oblige à rien tant
 * que le logiciel n'est pas distribué. `ffmpeg-static`, qui sert à générer les
 * icônes sur un poste de développement, n'est embarqué nulle part — le
 * signaler au même titre qu'une bibliothèque livrée dans l'application
 * reviendrait à noyer une vraie alerte au milieu de fausses.
 */
function clotureExecution() {
  const racine = JSON.parse(readFileSync('package.json', 'utf8'));
  const vus = new Set();
  const file = Object.keys(racine.dependencies ?? {});

  while (file.length) {
    const nom = file.shift();
    if (vus.has(nom)) continue;
    vus.add(nom);
    const manifest = manifests.get(nom);
    if (manifest) file.push(...Object.keys(manifest.dependencies ?? {}));
  }

  return vus;
}

const embarques = clotureExecution();

const trouves = new Map();
for (const pkg of manifests.values()) {
  const licence =
    typeof pkg.license === 'string'
      ? pkg.license
      : pkg.license?.type ?? (Array.isArray(pkg.licenses) ? pkg.licenses.map((l) => l.type).join(', ') : null);
  trouves.set(pkg.name, {
    nom: pkg.name,
    version: pkg.version,
    licence,
    verdict: classe(licence),
    embarque: embarques.has(pkg.name),
  });
}

const tous = [...trouves.values()].sort((a, b) => a.nom.localeCompare(b.nom));
// Seules celles qui partent avec l'application posent un problème de licence.
const bloquantes = tous.filter((p) => p.verdict === 'bloquante' && p.embarque);
const bloquantesOutillage = tous.filter((p) => p.verdict === 'bloquante' && !p.embarque);
const surveiller = tous.filter((p) => p.verdict === 'a surveiller' && p.embarque);
const inconnues = tous.filter((p) => p.verdict === 'inconnue' && p.embarque);

const compte = tous.reduce((acc, p) => {
  const clef = p.licence ?? 'non déclarée';
  acc[clef] = (acc[clef] ?? 0) + 1;
  return acc;
}, {});

const lignes = [
  '# Licences des dépendances',
  '',
  '<!-- Généré par `npm run licences`. Relancer après chaque npm install. -->',
  '',
  `${tous.length} paquets installés, dont ${embarques.size} réellement embarqués dans l'application.`,
  '',
  '## Verdict',
  '',
  bloquantes.length
    ? `> **${bloquantes.length} licence(s) incompatible(s) avec un logiciel propriétaire, embarquée(s) dans l'application.** À traiter avant toute publication :\n>\n` +
      bloquantes.map((p) => `> - \`${p.nom}\` (${p.licence})`).join('\n')
    : '> Aucune licence contaminante (GPL, AGPL, SSPL) parmi les paquets embarqués. Rien ne s\'oppose à une distribution propriétaire.',
  '',
  bloquantesOutillage.length
    ? `Pour mémoire, ${bloquantesOutillage.length} paquet(s) d'outillage sous licence contaminante — ` +
      bloquantesOutillage.map((p) => `\`${p.nom}\` (${p.licence})`).join(', ') +
      `. Ils servent à fabriquer l'application et ne sont distribués avec elle sous aucune forme : la licence ne s'applique donc pas à Mino. À ne pas confondre avec le cas ci-dessus.`
    : '',
  '',
  surveiller.length
    ? `${surveiller.length} licence(s) à connaître (LGPL, MPL, EPL) : ` +
      surveiller.map((p) => `\`${p.nom}\` (${p.licence})`).join(', ') +
      '. Elles n\'obligent pas à ouvrir le code de Mino, mais imposent de garder ouvertes les modifications apportées à ces bibliothèques elles-mêmes.'
    : '',
  '',
  inconnues.length ? `${inconnues.length} paquet(s) sans licence déclarée : à vérifier un par un si l\'un d\'eux est réellement embarqué dans l\'application.` : '',
  '',
  '## Répartition',
  '',
  '| Licence | Paquets |',
  '| --- | --- |',
  ...Object.entries(compte)
    .sort((a, b) => b[1] - a[1])
    .map(([licence, n]) => `| ${licence} | ${n} |`),
  '',
  '## Détail',
  '',
  '| Paquet | Version | Licence | Embarqué |',
  '| --- | --- | --- | --- |',
  ...tous.map((p) => `| ${p.nom} | ${p.version ?? ''} | ${p.licence ?? '—'} | ${p.embarque ? 'oui' : 'outillage'} |`),
  '',
];

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/dependances.md`, lignes.filter((l) => l !== '').join('\n') + '\n');

console.log(
  `${tous.length} paquets · ${bloquantes.length} bloquante(s) · ${surveiller.length} à surveiller · ${OUT}/dependances.md`,
);
if (bloquantes.length) process.exitCode = 1;
