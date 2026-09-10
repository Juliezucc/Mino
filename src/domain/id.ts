import { getRandomBytes } from 'expo-crypto';

import {
  fabriquerCode,
  fabriquerCodeFamille,
  fabriquerCodeParrainage,
  fabriquerId,
} from './identifiants';

/**
 * Les identifiants et les codes, côté application.
 *
 * **Ce fichier ne porte plus les règles — il porte le hasard.** L'alphabet, la
 * longueur des codes, le préfixe des identifiants et l'échantillonnage par
 * rejet vivent dans `identifiants.ts`, qui est pur et que le serveur peut lire.
 *
 * La raison est simple : le jour où le serveur a eu besoin de créer une famille
 * — l'inscription depuis le site — il lui fallait exactement les mêmes règles.
 * Or ce fichier-ci importe `expo-crypto`, un module React Native qu'une
 * fonction Edge ne peut pas charger. Sans la séparation, il aurait fallu
 * recopier ces règles ailleurs, et deux copies d'une même règle finissent
 * toujours par diverger — celle-ci décide de ce qui sépare un inconnu d'une
 * famille avec des enfants dedans.
 *
 * Le reste est inchangé : mêmes noms, mêmes formats, mêmes garanties.
 *
 *   — Un IDENTIFIANT n'est pas un secret. Ce qui protège une ligne, c'est la
 *     politique RLS, jamais l'obscurité de sa clé.
 *
 *   — Un CODE est une clé, et vient du générateur du système. `Math.random()`
 *     n'est pas fait pour cela : sa graine est prévisible et ses tirages
 *     successifs sont liés — or le code famille et le code de parrainage
 *     étaient tirés coup sur coup.
 */

/** Le générateur du système, tel que React Native le fournit. */
const octetsDuSysteme = (taille: number): Uint8Array => getRandomBytes(taille);

export function createId(prefix: string): string {
  return fabriquerId(prefix);
}

export function createFamilyCode(): string {
  return fabriquerCodeFamille(octetsDuSysteme);
}

export function createReferralCode(): string {
  return fabriquerCodeParrainage(octetsDuSysteme);
}

/** Conservé pour les appelants qui veulent une longueur à eux. */
export function createCode(length: number): string {
  return fabriquerCode(length, octetsDuSysteme);
}
