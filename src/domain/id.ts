import { getRandomBytes } from 'expo-crypto';

/**
 * Small id helper. UUID-shaped enough for Postgres later.
 * Every entity id carries its prefix so logs stay readable during development.
 *
 * Deux tirages différents vivent dans ce fichier, et la différence est de
 * nature, pas de degré :
 *
 *   — Un IDENTIFIANT n'est pas un secret. Ce qui protège une ligne, c'est la
 *     politique RLS, jamais l'obscurité de sa clé. `Math.random()` suffit.
 *
 *   — Un CODE est une clé. Le code famille est, selon le commentaire de ce
 *     fichier lui-même, « la seule chose entre un inconnu et une famille avec
 *     des enfants dedans ». `Math.random()` n'est pas fait pour cela : ce
 *     n'est pas un générateur cryptographique, sa graine est prévisible, et
 *     ses tirages successifs sont liés — or le code famille et le code de
 *     parrainage, qui se partage avec des inconnus, étaient tirés coup sur
 *     coup. Ils viennent maintenant du générateur du système.
 */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomChunk(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomChunk(6)}`;
}

/** No I, O, 0 or 1: these codes get read aloud and retyped. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Un tirage sans biais dans un alphabet, à partir d'octets du système.
 *
 * Le rejet des octets qui dépassent le dernier multiple entier de la taille de
 * l'alphabet n'est pas de la coquetterie : un simple modulo favoriserait les
 * premières lettres, et un code deviné plus vite qu'annoncé n'est pas le code
 * annoncé. Avec les 32 caractères actuels, 256 est un multiple exact et rien
 * n'est jamais rejeté — mais le jour où quelqu'un ajoute une lettre, la
 * garantie tient toujours.
 */
function code(length: number): string {
  const plafond = Math.floor(256 / CODE_CHARS.length) * CODE_CHARS.length;
  let out = '';
  while (out.length < length) {
    const octets = getRandomBytes(length * 2);
    for (const octet of octets) {
      if (octet >= plafond) continue;
      out += CODE_CHARS[octet % CODE_CHARS.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/**
 * Family code shown to a parent so a child device can join: e.g. "MINO-7K2QX9".
 *
 * Six characters, not four. This code is the only thing standing between a
 * stranger and a family with children in it, so it has to be out of reach of an
 * exhaustive search: 32^6 is about a billion combinations, against a million
 * for four. Two extra characters to type, once, in exchange for that.
 */
export function createFamilyCode(): string {
  return `MINO-${code(6)}`;
}

/**
 * Referral code, deliberately distinct from the family code: one is shared with
 * strangers, the other lets a device join the family. They must never be the
 * same string.
 */
export function createReferralCode(): string {
  return code(6);
}
