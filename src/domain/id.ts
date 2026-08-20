/**
 * Small id helper. UUID-shaped enough for Postgres later, dependency-free now.
 * Every entity id carries its prefix so logs stay readable during development.
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

function code(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
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
