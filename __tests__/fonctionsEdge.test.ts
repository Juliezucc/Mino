import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';

/**
 * Ce que les fonctions Edge peuvent importer, et pourquoi un test le surveille.
 *
 * Les fonctions Edge tournent sous **Deno**, pas sous Node ni Metro. Deux
 * règles y valent, qu'aucun outil du dépôt ne vérifie autrement :
 *
 *  1. **Un import relatif porte son extension.** Deno résout le chemin tel
 *     quel : `./types` n'est pas `./types.ts`, c'est une erreur de chargement.
 *     Un `import type`, lui, est effacé à la compilation et ne va chercher
 *     personne — il échappe donc à la règle, et c'est ce qui permet à
 *     `missionLibrary.ts` de nommer `Child` sans traîner tout `types.ts`.
 *
 *  2. **Pas de module React Native.** `expo-crypto`, `expo-notifications` et
 *     leurs semblables n'existent pas sous Deno. C'est la raison d'être de
 *     `identifiants.ts`, séparé de `id.ts`.
 *
 * Rien de tout cela n'apparaît à la compilation TypeScript ni dans les essais :
 * la faute ne se voit qu'au déploiement, et parfois seulement au premier appel
 * — c'est-à-dire sur une vraie inscription, chez un vrai parent.
 */

const RACINE = resolve(__dirname, '..');
const FONCTIONS = join(RACINE, 'supabase', 'functions');

/** Les modules React Native qu'une fonction Edge ne peut pas charger. */
const INTERDITS = [
  'expo-',
  'react-native',
  '@react-native',
  'react',
  '@/', // l'alias Metro, que Deno ne connaît pas
];

function fichiersTs(dossier: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) out.push(...fichiersTs(chemin));
    else if (entree.endsWith('.ts')) out.push(chemin);
  }
  return out;
}

interface Import {
  specifier: string;
  typeSeulement: boolean;
}

function importsDe(chemin: string): Import[] {
  const source = readFileSync(chemin, 'utf8');
  const out: Import[] = [];
  const motif = /^\s*import\s+(type\s+)?([\s\S]*?)from\s+['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(source)) !== null) {
    out.push({ specifier: m[3], typeSeulement: Boolean(m[1]) });
  }
  // `export … from` charge le module de la même façon.
  const reexport = /^\s*export\s+(type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]/gm;
  while ((m = reexport.exec(source)) !== null) {
    out.push({ specifier: m[2], typeSeulement: Boolean(m[1]) });
  }
  return out;
}

/**
 * Tout ce qu'une fonction Edge finit par charger : ses propres fichiers, plus
 * les fichiers du domaine qu'elle atteint, de proche en proche.
 */
function grapheDepuis(entrees: string[]): Map<string, string[]> {
  const vus = new Map<string, string[]>();
  const aVoir = [...entrees];

  while (aVoir.length > 0) {
    const chemin = aVoir.pop() as string;
    if (vus.has(chemin)) continue;
    const fautes: string[] = [];
    vus.set(chemin, fautes);

    for (const { specifier, typeSeulement } of importsDe(chemin)) {
      if (INTERDITS.some((i) => specifier === i || specifier.startsWith(i))) {
        fautes.push(`« ${specifier} » n'existe pas sous Deno`);
        continue;
      }
      if (!specifier.startsWith('.')) continue; // jsr:, npm:, https: — Deno sait faire

      if (typeSeulement) continue; // effacé à la compilation, jamais chargé

      if (!specifier.endsWith('.ts')) {
        fautes.push(`« ${specifier} » n'a pas d'extension .ts`);
        continue;
      }
      aVoir.push(resolve(dirname(chemin), specifier));
    }
  }
  return vus;
}

describe('les fonctions Edge', () => {
  const entrees = fichiersTs(FONCTIONS);

  it('existent, sinon ce test ne surveille rien', () => {
    expect(entrees.length).toBeGreaterThan(5);
  });

  it('n’importent que ce que Deno sait charger', () => {
    const graphe = grapheDepuis(entrees);
    const fautes: string[] = [];
    for (const [chemin, liste] of graphe) {
      for (const faute of liste) fautes.push(`${chemin.replace(RACINE + '/', '')} : ${faute}`);
    }
    expect(fautes).toEqual([]);
  });

  it('atteignent bien le domaine — le test lit le vrai graphe, pas une liste', () => {
    const graphe = grapheDepuis(entrees);
    const domaine = [...graphe.keys()].filter((c) => c.includes('/src/domain/'));
    expect(domaine.length).toBeGreaterThan(0);
  });
});

describe('inscription-web', () => {
  const chemin = join(FONCTIONS, 'inscription-web', 'index.ts');
  const source = readFileSync(chemin, 'utf8');

  it('ne prend jamais l’identifiant de famille dans le corps de la requête', () => {
    // La famille vient du compte authentifié, ou elle est créée ici. Un client
    // qui peut nommer la famille sur laquelle il agit est un client qui peut
    // agir sur celle de quelqu'un d'autre.
    expect(source).not.toMatch(/corps\.familyId|corps\.familleId/);
  });

  it('refuse un appel sans consentement', () => {
    expect(source).toMatch(/corps\.consentement !== true/);
  });

  it('ne fabrique jamais de mission à partir du corps de la requête', () => {
    // Titre, icône, minutes et récurrence sortent de la bibliothèque.
    expect(source).not.toMatch(/title:\s*corps\.|minutes:\s*corps\./);
  });

  it('n’écrit aucun message d’erreur en anglais', () => {
    const messages = [...source.matchAll(/fail\(\s*(?:'([^']*)'|`([^`]*)`)/g)].map(
      (m) => m[1] ?? m[2],
    );
    expect(messages.length).toBeGreaterThan(4);
    for (const message of messages) {
      expect(message).not.toMatch(/\b(failed|error|invalid|unauthorized|missing)\b/i);
    }
  });
});
